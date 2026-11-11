import { Injectable, inject } from '@angular/core';
import {
  ActionResult,
  Breed,
  DailyCareTip,
  Dog,
  HealthRecord,
  HealthRecordDraft,
  HealthRecordType,
  WeightPoint,
} from '../models';
import { DemoStateService } from '../state/demo-state.service';
import { DEMO_REFERENCE_DATE_ISO, isWithinNextDays } from '../../shared/utils/date.util';
import { calculateDogAgeYears } from '../../shared/utils/dog-age.util';
import { DemoAuthService } from './demo-auth.service';

export type ReminderStatus = 'OVERDUE' | 'DUE_SOON' | 'FUTURE';

export interface HealthReminder {
  record: HealthRecord;
  status: ReminderStatus;
  daysDelta: number;
}

export const MEDICAL_DISCLAIMER_TEXT =
  'Demo care tips are informational only and never replace a licensed veterinarian consultation.';

const DEMO_WEATHER_LABEL = '14°C · Crisp autumn sun in Cluj-Napoca (Demo Weather)';

@Injectable({ providedIn: 'root' })
export class CareService {
  private readonly store = inject(DemoStateService);
  private readonly auth = inject(DemoAuthService);

  getHealthRecords(
    dogId: string,
    typeFilter: HealthRecordType | 'ALL' = 'ALL',
  ): HealthRecord[] {
    return this.store
      .state()
      .healthRecords.filter(
        (r) => r.dogId === dogId && (typeFilter === 'ALL' || r.type === typeFilter),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  getUpcomingReminders(dogId: string, withinDays: number = 21): HealthRecord[] {
    return this.store
      .state()
      .healthRecords.filter(
        (r) => r.dogId === dogId && isWithinNextDays(r.nextDueDate, withinDays),
      )
      .sort(
        (a, b) =>
          new Date(a.nextDueDate ?? '').getTime() - new Date(b.nextDueDate ?? '').getTime(),
      );
  }

  getReminders(dogId: string): HealthReminder[] {
    const refMs = this.parseIsoDayUtcMs(DEMO_REFERENCE_DATE_ISO);
    const msPerDay = 86_400_000;
    const reminders: { reminder: HealthReminder; dueMs: number }[] = [];

    for (const record of this.store.state().healthRecords) {
      if (record.dogId !== dogId || !record.nextDueDate) {
        continue;
      }
      const dueMs = this.parseIsoDayUtcMs(record.nextDueDate);
      if (Number.isNaN(dueMs)) {
        continue;
      }
      const daysDelta = Math.round((dueMs - refMs) / msPerDay);
      const status: ReminderStatus =
        daysDelta < 0 ? 'OVERDUE' : daysDelta <= 14 ? 'DUE_SOON' : 'FUTURE';
      reminders.push({
        reminder: { record, status, daysDelta },
        dueMs,
      });
    }

    return reminders.sort((a, b) => a.dueMs - b.dueMs).map((entry) => entry.reminder);
  }

  getWeightHistory(dogId: string): WeightPoint[] {
    return this.store
      .state()
      .healthRecords.filter(
        (r): r is HealthRecord & { weightKg: number } =>
          r.dogId === dogId && r.type === 'WEIGHT' && typeof r.weightKg === 'number',
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((r) => ({ date: r.date, weightKg: r.weightKg }));
  }

  getDailyCareTip(dog: Dog, breed: Breed): DailyCareTip {
    const ageYears = calculateDogAgeYears(dog.birthDate);

    if (breed.breathingIssues) {
      return {
        weatherLabel: DEMO_WEATHER_LABEL,
        headline: `Gentle pace for ${dog.name} (${breed.name})`,
        advice:
          'Keep walks steady with short sniff breaks and always use a Y-front harness instead of a neck collar.',
        isWarning: true,
      };
    }

    if (breed.heatSensitive) {
      return {
        weatherLabel: DEMO_WEATHER_LABEL,
        headline: `Great coat weather for ${dog.name}`,
        advice:
          'Cooler autumn temperatures are ideal for longer outdoor play, while remembering to avoid intense sun on warmer days.',
        isWarning: false,
      };
    }

    if (ageYears !== null && ageYears >= 7) {
      return {
        weatherLabel: DEMO_WEATHER_LABEL,
        headline: `Joint-friendly routine for senior ${dog.name}`,
        advice:
          'Favor softer park paths over concrete and split daily movement into two comfortable walks.',
        isWarning: false,
      };
    }

    if (breed.energyLevel >= 4) {
      return {
        weatherLabel: DEMO_WEATHER_LABEL,
        headline: `High-energy day plan for ${dog.name}`,
        advice:
          'Combine a 45-minute brisk walk with 10 minutes of scent work or fetch to tire out body and mind.',
        isWarning: false,
      };
    }

    return {
      weatherLabel: DEMO_WEATHER_LABEL,
      headline: `Balanced daily routine for ${dog.name}`,
      advice: breed.careTips,
      isWarning: false,
    };
  }

  addHealthRecord(dogId: string, draftData: HealthRecordDraft): ActionResult<HealthRecord> {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }
    const dog = this.store.state().dogs.find((d) => d.id === dogId);
    if (!dog || dog.ownerId !== me.id) {
      return { ok: false, error: 'You can only add records for your own dogs.' };
    }
    const title = draftData.title.trim();
    if (!title) {
      return { ok: false, error: 'Record title is required.' };
    }
    const dateMs = draftData.date ? this.parseIsoDayUtcMs(draftData.date) : Number.NaN;
    if (!draftData.date || Number.isNaN(dateMs)) {
      return { ok: false, error: 'Please provide a valid record date.' };
    }
    const nextDueDate = draftData.nextDueDate ? draftData.nextDueDate.trim() : '';
    if (nextDueDate) {
      const nextDueMs = this.parseIsoDayUtcMs(nextDueDate);
      if (Number.isNaN(nextDueMs)) {
        return { ok: false, error: 'Please provide a valid next due date.' };
      }
      if (nextDueMs < dateMs) {
        return { ok: false, error: 'Next due date cannot be earlier than record date.' };
      }
    }
    if (
      draftData.type === 'WEIGHT' &&
      (draftData.weightKg === null || Number.isNaN(draftData.weightKg) || draftData.weightKg <= 0)
    ) {
      return { ok: false, error: 'Weight (kg) must be greater than 0.' };
    }

    const record: HealthRecord = {
      id: this.store.allocateId('hr'),
      dogId,
      type: draftData.type,
      title,
      date: draftData.date,
      nextDueDate: nextDueDate || null,
      weightKg: draftData.type === 'WEIGHT' ? draftData.weightKg : null,
      notes: draftData.notes ? draftData.notes.trim() : null,
    };

    this.store.updateState((draft) => {
      draft.healthRecords.push(record);
      return draft;
    });

    return { ok: true, data: record };
  }

  removeHealthRecord(recordId: string): ActionResult {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }
    const state = this.store.state();
    const record = state.healthRecords.find((r) => r.id === recordId);
    if (!record) {
      return { ok: false, error: 'Record not found.' };
    }
    const dog = state.dogs.find((d) => d.id === record.dogId);
    if (!dog || dog.ownerId !== me.id) {
      return { ok: false, error: 'You can only delete records for your own dogs.' };
    }

    this.store.updateState((draft) => {
      draft.healthRecords = draft.healthRecords.filter((r) => r.id !== recordId);
      return draft;
    });

    return { ok: true };
  }

  private parseIsoDayUtcMs(dateStr: string): number {
    const dayPart = dateStr.slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayPart);
    if (!match) {
      return Number.NaN;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const ms = Date.UTC(year, month - 1, day);
    const check = new Date(ms);
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return Number.NaN;
    }
    return ms;
  }
}
