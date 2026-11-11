import { HealthRecordType } from './enums';

export interface HealthRecord {
  id: string;
  dogId: string;
  type: HealthRecordType;
  title: string;
  date: string;
  nextDueDate: string | null;
  weightKg: number | null;
  notes: string | null;
}

export interface HealthRecordDraft {
  type: HealthRecordType;
  title: string;
  date: string;
  nextDueDate: string | null;
  weightKg: number | null;
  notes: string | null;
}

export interface DailyCareTip {
  weatherLabel: string;
  headline: string;
  advice: string;
  isWarning: boolean;
}

export interface WeightPoint {
  date: string;
  weightKg: number;
}
