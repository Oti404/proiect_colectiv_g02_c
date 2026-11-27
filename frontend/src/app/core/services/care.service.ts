import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import { ApiModel } from '../api/api.types';
import { HealthRecordType } from '../models';

export type ApiHealthRecord = ApiModel<'HealthRecord'>;
export type ApiReminder = ApiModel<'Reminder'>;
export type ApiWeightPoint = ApiModel<'WeightPoint'>;
export type ApiDailyTip = ApiModel<'DailyTip'>;
export type ReminderStatus = ApiReminder['status'];

export interface ApiHealthRecordDraft {
  type: HealthRecordType;
  title: string;
  date: string;
  nextDueDate?: string | null;
  weightKg?: number | null;
  notes?: string | null;
}

export type ApiHealthRecordPatch = Partial<ApiHealthRecordDraft>;

@Injectable({ providedIn: 'root' })
export class CareService {
  private readonly api = inject(ApiService);

  getHealthRecords(
    dogId: string,
    typeFilter: HealthRecordType | 'ALL' = 'ALL',
  ): Observable<ApiHealthRecord[]> {
    return this.api.get<ApiHealthRecord[]>(`/dogs/${dogId}/health-records`, {
      type: typeFilter === 'ALL' ? undefined : typeFilter,
    });
  }

  createHealthRecord(dogId: string, draft: ApiHealthRecordDraft): Observable<ApiHealthRecord> {
    return this.api.post<ApiHealthRecord>(`/dogs/${dogId}/health-records`, draft);
  }

  updateHealthRecord(
    dogId: string,
    recordId: string,
    patch: ApiHealthRecordPatch,
  ): Observable<ApiHealthRecord> {
    return this.api.patch<ApiHealthRecord>(`/dogs/${dogId}/health-records/${recordId}`, patch);
  }

  deleteHealthRecord(dogId: string, recordId: string): Observable<void> {
    return this.api.delete<void>(`/dogs/${dogId}/health-records/${recordId}`);
  }

  getReminders(dogId: string): Observable<ApiReminder[]> {
    return this.api.get<ApiReminder[]>(`/dogs/${dogId}/reminders`);
  }

  getWeightHistory(dogId: string): Observable<ApiWeightPoint[]> {
    return this.api.get<ApiWeightPoint[]>(`/dogs/${dogId}/weight-history`);
  }

  getDailyTip(dogId: string): Observable<ApiDailyTip> {
    return this.api.get<ApiDailyTip>(`/dogs/${dogId}/daily-tip`);
  }
}
