import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Breed,
  DailyCareTip,
  Dog,
  HealthRecord,
  HealthRecordType,
  WeightPoint,
} from '../../core/models';
import {
  CareService,
  DemoAuthService,
  DogService,
  HealthReminder,
  MEDICAL_DISCLAIMER_TEXT,
  ReminderStatus,
} from '../../core/services';
import { DEMO_REFERENCE_DATE_ISO } from '../../shared/utils/date.util';
import { formatDogAge } from '../../shared/utils/dog-age.util';

type RecordFilter = HealthRecordType | 'ALL';

interface PlottedWeightPoint {
  point: WeightPoint;
  x: number;
  y: number;
}

interface WeightChartView {
  points: PlottedWeightPoint[];
  polylinePoints: string;
  minWeight: number;
  maxWeight: number;
  latestWeight: number | null;
}

const DEFAULT_RECORD_DATE = DEMO_REFERENCE_DATE_ISO.slice(0, 10);

@Component({
  selector: 'app-care-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './care-page.html',
})
export class CarePageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(DemoAuthService);
  private readonly dogService = inject(DogService);
  private readonly careService = inject(CareService);

  private lastAccountId: string | null = null;

  readonly medicalDisclaimer = MEDICAL_DISCLAIMER_TEXT;
  readonly recordTypes: HealthRecordType[] = ['VACCINE', 'DEWORMING', 'VET_VISIT', 'WEIGHT'];
  readonly filterOptions: { value: RecordFilter; label: string }[] = [
    { value: 'ALL', label: 'All Records' },
    { value: 'VACCINE', label: 'Vaccines' },
    { value: 'DEWORMING', label: 'Deworming' },
    { value: 'VET_VISIT', label: 'Vet Visits' },
    { value: 'WEIGHT', label: 'Weight' },
  ];

  readonly myDogs = this.dogService.myDogs;
  readonly selectedDogId = signal<string>('');
  readonly typeFilter = signal<RecordFilter>('ALL');
  readonly confirmDeleteId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly recordForm = this.fb.nonNullable.group({
    type: ['VACCINE' as HealthRecordType, Validators.required],
    title: ['', [Validators.required, Validators.maxLength(120)]],
    date: [DEFAULT_RECORD_DATE, Validators.required],
    nextDueDate: [''],
    weightKg: [''],
    notes: [''],
  });

  readonly selectedDog = computed<Dog | null>(() => {
    const id = this.selectedDogId();
    return this.myDogs().find((d) => d.id === id) ?? null;
  });

  readonly selectedBreed = computed<Breed | null>(() => {
    const dog = this.selectedDog();
    if (!dog) {
      return null;
    }
    return this.dogService.getBreedById(dog.breedId) ?? null;
  });

  readonly selectedDogAgeLabel = computed<string>(() => {
    const dog = this.selectedDog();
    return dog ? formatDogAge(dog.birthDate) : '';
  });

  readonly dailyTip = computed<DailyCareTip | null>(() => {
    const dog = this.selectedDog();
    const breed = this.selectedBreed();
    if (!dog || !breed) {
      return null;
    }
    return this.careService.getDailyCareTip(dog, breed);
  });

  readonly reminders = computed<HealthReminder[]>(() => {
    const dog = this.selectedDog();
    return dog ? this.careService.getReminders(dog.id) : [];
  });

  readonly filteredRecords = computed<HealthRecord[]>(() => {
    const dog = this.selectedDog();
    return dog ? this.careService.getHealthRecords(dog.id, this.typeFilter()) : [];
  });

  readonly weightChart = computed<WeightChartView>(() => {
    const dog = this.selectedDog();
    const rawPoints = dog ? this.careService.getWeightHistory(dog.id) : [];
    if (rawPoints.length === 0) {
      return {
        points: [],
        polylinePoints: '',
        minWeight: 0,
        maxWeight: 0,
        latestWeight: null,
      };
    }

    const weights = rawPoints.map((p) => p.weightKg);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const latestWeight = rawPoints[rawPoints.length - 1]?.weightKg ?? null;

    if (rawPoints.length === 1) {
      const single: PlottedWeightPoint = { point: rawPoints[0]!, x: 180, y: 70 };
      return {
        points: [single],
        polylinePoints: '180,70',
        minWeight,
        maxWeight,
        latestWeight,
      };
    }

    const leftX = 36;
    const rightX = 324;
    const topY = 22;
    const bottomY = 114;
    const spanX = rightX - leftX;
    const weightSpan = maxWeight - minWeight;

    const plotted = rawPoints.map((point, index) => {
      const x = Math.round(leftX + (index / (rawPoints.length - 1)) * spanX);
      const y =
        weightSpan === 0
          ? 68
          : Math.round(bottomY - ((point.weightKg - minWeight) / weightSpan) * (bottomY - topY));
      return { point, x, y };
    });

    return {
      points: plotted,
      polylinePoints: plotted.map((p) => `${p.x},${p.y}`).join(' '),
      minWeight,
      maxWeight,
      latestWeight,
    };
  });

  constructor() {
    effect(() => {
      const accountId = this.auth.currentUser()?.id ?? null;
      if (accountId !== this.lastAccountId) {
        this.lastAccountId = accountId;
        this.confirmDeleteId.set(null);
        this.errorMessage.set(null);
        this.successMessage.set(null);
      }

      const dogs = this.myDogs();
      const currentId = this.selectedDogId();
      if (dogs.length === 0) {
        if (currentId !== '') {
          this.selectedDogId.set('');
        }
        return;
      }
      if (!dogs.some((d) => d.id === currentId)) {
        this.selectedDogId.set(dogs[0]!.id);
        this.confirmDeleteId.set(null);
      }
    });
  }

  onDogSelectionChange(event: Event): void {
    const select = event.target as HTMLSelectElement | null;
    if (select) {
      this.selectedDogId.set(select.value);
      this.confirmDeleteId.set(null);
      this.errorMessage.set(null);
      this.successMessage.set(null);
    }
  }

  setTypeFilter(filter: RecordFilter): void {
    this.typeFilter.set(filter);
  }

  onAddRecord(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const dog = this.selectedDog();
    if (!dog) {
      this.errorMessage.set('Please add or select a dog first.');
      return;
    }

    if (this.recordForm.invalid) {
      this.recordForm.markAllAsTouched();
      this.errorMessage.set('Please fill in the required title and record date.');
      return;
    }

    const raw = this.recordForm.getRawValue();
    const parsedWeight =
      raw.type === 'WEIGHT' && raw.weightKg.trim() !== '' ? Number(raw.weightKg) : null;

    const result = this.careService.addHealthRecord(dog.id, {
      type: raw.type,
      title: raw.title,
      date: raw.date,
      nextDueDate: raw.nextDueDate.trim() || null,
      weightKg: parsedWeight,
      notes: raw.notes.trim() || null,
    });

    if (!result.ok) {
      this.errorMessage.set(result.error ?? 'Could not save health record.');
      return;
    }

    this.successMessage.set(`Added "${result.data?.title ?? 'health record'}" for ${dog.name}.`);
    this.recordForm.reset({
      type: raw.type,
      title: '',
      date: DEFAULT_RECORD_DATE,
      nextDueDate: '',
      weightKg: '',
      notes: '',
    });
  }

  requestDelete(recordId: string): void {
    this.confirmDeleteId.set(recordId);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(recordId: string): void {
    const result = this.careService.removeHealthRecord(recordId);
    this.confirmDeleteId.set(null);
    if (!result.ok) {
      this.errorMessage.set(result.error ?? 'Could not delete health record.');
      return;
    }
    this.successMessage.set('Health record deleted.');
  }

  formatRecordType(type: HealthRecordType): string {
    switch (type) {
      case 'VACCINE':
        return 'Vaccine';
      case 'DEWORMING':
        return 'Deworming';
      case 'VET_VISIT':
        return 'Vet Visit';
      case 'WEIGHT':
        return 'Weight';
    }
  }

  getReminderBadgeClass(status: ReminderStatus): string {
    switch (status) {
      case 'OVERDUE':
        return 'badge badge-danger';
      case 'DUE_SOON':
        return 'badge badge-warn';
      case 'FUTURE':
        return 'badge badge-info';
    }
  }

  formatReminderStatusLabel(reminder: HealthReminder): string {
    if (reminder.status === 'OVERDUE') {
      const days = Math.abs(reminder.daysDelta);
      return `Overdue by ${days} day${days === 1 ? '' : 's'}`;
    }
    if (reminder.daysDelta === 0) {
      return 'Due today';
    }
    if (reminder.status === 'DUE_SOON') {
      return `Due soon (in ${reminder.daysDelta} day${reminder.daysDelta === 1 ? '' : 's'})`;
    }
    return `Scheduled in ${reminder.daysDelta} days`;
  }
}
