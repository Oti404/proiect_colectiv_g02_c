import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { ApiError } from '../../core/api/api.types';
import { AuthService } from '../../core/auth/auth.service';
import { HealthRecordType } from '../../core/models';
import {
  ApiHealthRecord,
  ApiReminder,
  ApiWeightPoint,
  CareService,
  DogService,
  ReminderStatus,
  UserService,
} from '../../core/services';
import { formatDogAge } from '../../shared/utils/dog-age.util';

type RecordFilter = HealthRecordType | 'ALL';

interface PlottedWeightPoint {
  point: ApiWeightPoint;
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

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-care-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './care-page.html',
})
export class CarePageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly dogService = inject(DogService);
  private readonly careService = inject(CareService);

  private lastAccountId: string | null = null;

  readonly filterOptions: { value: RecordFilter; label: string }[] = [
    { value: 'ALL', label: 'All Records' },
    { value: 'VACCINE', label: 'Vaccines' },
    { value: 'DEWORMING', label: 'Deworming' },
    { value: 'VET_VISIT', label: 'Vet Visits' },
    { value: 'WEIGHT', label: 'Weight' },
  ];

  readonly myProfileResource = rxResource({
    params: () => this.auth.user()?.id ?? null,
    stream: ({ params }) => (params ? this.userService.getPublicProfile(params) : of(null)),
  });
  readonly myDogs = computed(() => this.myProfileResource.value()?.dogs ?? []);

  readonly selectedDogId = signal<string>('');
  readonly typeFilter = signal<RecordFilter>('ALL');
  readonly editingRecordId = signal<string | null>(null);
  readonly confirmDeleteId = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly deletingId = signal<string | null>(null);

  readonly errorMessage = signal<string | null>(null);
  readonly nextDueDateError = signal<string | null>(null);
  readonly weightKgError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly recordForm = this.fb.nonNullable.group({
    type: ['VACCINE' as HealthRecordType, Validators.required],
    title: ['', [Validators.required, Validators.maxLength(120)]],
    date: [todayIsoDate(), Validators.required],
    nextDueDate: [''],
    weightKg: [''],
    notes: [''],
  });

  readonly selectedDogDetailResource = rxResource({
    params: () => this.selectedDogId() || null,
    stream: ({ params }) => (params ? this.dogService.getById(params) : of(null)),
  });

  readonly selectedDog = computed(() => {
    const id = this.selectedDogId();
    return this.myDogs().find((d) => d.id === id) ?? null;
  });

  readonly selectedBreed = computed(() => this.selectedDogDetailResource.value()?.breed ?? null);

  readonly selectedDogAgeLabel = computed<string>(() => {
    const dog = this.selectedDog();
    return dog ? formatDogAge(dog.birthDate, new Date().toISOString()) : '';
  });

  readonly dailyTipResource = rxResource({
    params: () => this.selectedDogId() || null,
    stream: ({ params }) => (params ? this.careService.getDailyTip(params) : of(null)),
  });

  readonly remindersResource = rxResource({
    params: () => this.selectedDogId() || null,
    stream: ({ params }) => (params ? this.careService.getReminders(params) : of([])),
  });

  readonly weightHistoryResource = rxResource({
    params: () => this.selectedDogId() || null,
    stream: ({ params }) => (params ? this.careService.getWeightHistory(params) : of([])),
  });

  readonly recordsResource = rxResource({
    params: () => {
      const dogId = this.selectedDogId();
      return dogId ? { dogId, type: this.typeFilter() } : null;
    },
    stream: ({ params }) =>
      params ? this.careService.getHealthRecords(params.dogId, params.type) : of([]),
  });

  readonly dailyTip = computed(() => this.dailyTipResource.value() ?? null);
  readonly reminders = computed(() => this.remindersResource.value() ?? []);
  readonly filteredRecords = computed(() => this.recordsResource.value() ?? []);

  readonly weightChart = computed<WeightChartView>(() => {
    const rawPoints = this.weightHistoryResource.value() ?? [];
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
      const accountId = this.auth.user()?.id ?? null;
      if (accountId !== this.lastAccountId) {
        this.lastAccountId = accountId;
        this.confirmDeleteId.set(null);
        this.editingRecordId.set(null);
        this.clearMessages();
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
        this.editingRecordId.set(null);
      }
    });
  }

  onDogSelectionChange(event: Event): void {
    const select = event.target as HTMLSelectElement | null;
    if (select) {
      this.selectedDogId.set(select.value);
      this.confirmDeleteId.set(null);
      this.editingRecordId.set(null);
      this.clearMessages();
    }
  }

  setTypeFilter(filter: RecordFilter): void {
    this.typeFilter.set(filter);
  }

  onEditRecord(record: ApiHealthRecord): void {
    this.clearMessages();
    this.confirmDeleteId.set(null);
    this.editingRecordId.set(record.id);
    this.recordForm.reset({
      type: record.type,
      title: record.title,
      date: record.date.slice(0, 10),
      nextDueDate: record.nextDueDate ? record.nextDueDate.slice(0, 10) : '',
      weightKg: record.weightKg !== null ? String(record.weightKg) : '',
      notes: record.notes ?? '',
    });
  }

  onCancelEdit(): void {
    this.editingRecordId.set(null);
    this.clearMessages();
    this.resetRecordForm('VACCINE');
  }

  onSubmitRecord(): void {
    this.clearMessages();

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

    const payload = {
      type: raw.type,
      title: raw.title.trim(),
      date: raw.date,
      nextDueDate: raw.nextDueDate.trim() || null,
      weightKg: parsedWeight,
      notes: raw.notes.trim() || null,
    };

    const editId = this.editingRecordId();
    this.submitting.set(true);

    const request$ = editId
      ? this.careService.updateHealthRecord(dog.id, editId, payload)
      : this.careService.createHealthRecord(dog.id, payload);

    request$.subscribe({
      next: (saved) => {
        this.submitting.set(false);
        this.editingRecordId.set(null);
        this.successMessage.set(
          editId
            ? `Updated "${saved.title}" for ${dog.name}.`
            : `Added "${saved.title}" for ${dog.name}.`,
        );
        this.resetRecordForm(raw.type);
        this.reloadDogCareData();
      },
      error: (err) => {
        this.submitting.set(false);
        const apiErr = ApiError.from(err);
        this.nextDueDateError.set(apiErr.fieldError('nextDueDate') ?? null);
        this.weightKgError.set(apiErr.fieldError('weightKg') ?? null);
        if (apiErr.code === 'VALIDATION_ERROR') {
          this.errorMessage.set(
            apiErr.fieldErrors[0]?.message ?? 'Please check the highlighted fields.',
          );
        } else if (apiErr.code === 'NETWORK_ERROR') {
          this.errorMessage.set('Cannot reach the server. Check your connection.');
        } else {
          this.errorMessage.set('Could not save health record.');
        }
      },
    });
  }

  requestDelete(recordId: string): void {
    this.confirmDeleteId.set(recordId);
    this.clearMessages();
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(recordId: string): void {
    const dog = this.selectedDog();
    if (!dog) {
      return;
    }
    this.deletingId.set(recordId);
    this.careService.deleteHealthRecord(dog.id, recordId).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.confirmDeleteId.set(null);
        if (this.editingRecordId() === recordId) {
          this.editingRecordId.set(null);
          this.resetRecordForm('VACCINE');
        }
        this.successMessage.set('Health record deleted.');
        this.reloadDogCareData();
      },
      error: () => {
        this.deletingId.set(null);
        this.confirmDeleteId.set(null);
        this.errorMessage.set('Could not delete health record.');
      },
    });
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

  formatReminderStatusLabel(reminder: ApiReminder): string {
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

  private reloadDogCareData(): void {
    this.recordsResource.reload();
    this.remindersResource.reload();
    this.weightHistoryResource.reload();
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.nextDueDateError.set(null);
    this.weightKgError.set(null);
    this.successMessage.set(null);
  }

  private resetRecordForm(type: HealthRecordType): void {
    this.recordForm.reset({
      type,
      title: '',
      date: todayIsoDate(),
      nextDueDate: '',
      weightKg: '',
      notes: '',
    });
  }
}
