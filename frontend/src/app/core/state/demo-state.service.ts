import { Injectable, signal } from '@angular/core';
import { createInitialDemoState } from '../mock-data/demo-seed';
import { DemoAppState, PersistedDemoEnvelope } from '../models';
import { deepClone } from '../../shared/utils/clone.util';

export const DEMO_STORAGE_KEY = 'dogapp.demo.state.v1';
export const DEMO_STORAGE_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class DemoStateService {
  private readonly _state = signal<DemoAppState>(this.loadInitialState());
  readonly state = this._state.asReadonly();

  updateState(updater: (current: DemoAppState) => DemoAppState): void {
    const next = updater(deepClone(this._state()));
    this._state.set(next);
    this.persistState(next);
  }

  allocateId(prefix: string): string {
    let allocated = '';
    this.updateState((draft) => {
      const counter = draft.nextIdCounter;
      draft.nextIdCounter = counter + 1;
      allocated = `${prefix}-${counter}`;
      return draft;
    });
    return allocated;
  }

  resetDemoData(options?: { keepSeededSession?: boolean }): void {
    const previousUserId = this._state().currentUserId;
    const fresh = createInitialDemoState();

    if (
      options?.keepSeededSession &&
      previousUserId &&
      fresh.users.some((u) => u.id === previousUserId)
    ) {
      fresh.currentUserId = previousUserId;
    }

    this._state.set(fresh);
    this.persistState(fresh);
  }

  private loadInitialState(): DemoAppState {
    const storage = this.getStorage();
    if (!storage) {
      return createInitialDemoState();
    }

    try {
      const raw = storage.getItem(DEMO_STORAGE_KEY);
      if (!raw) {
        const fresh = createInitialDemoState();
        this.persistState(fresh);
        return fresh;
      }

      const parsed: unknown = JSON.parse(raw);
      if (!this.isValidEnvelope(parsed)) {
        const fresh = createInitialDemoState();
        this.persistState(fresh);
        return fresh;
      }

      return parsed.state;
    } catch {
      const fresh = createInitialDemoState();
      this.persistState(fresh);
      return fresh;
    }
  }

  private persistState(state: DemoAppState): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }
    try {
      const envelope: PersistedDemoEnvelope = {
        version: DEMO_STORAGE_VERSION,
        state,
      };
      storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      // Ignore storage quota or private-mode errors to keep demo usable in memory.
    }
  }

  private getStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return window.localStorage ?? null;
    } catch {
      return null;
    }
  }

  private isValidEnvelope(value: unknown): value is PersistedDemoEnvelope {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const candidate = value as Partial<PersistedDemoEnvelope>;
    if (candidate.version !== DEMO_STORAGE_VERSION || !candidate.state || typeof candidate.state !== 'object') {
      return false;
    }
    const s = candidate.state as Partial<DemoAppState>;
    return (
      (s.currentUserId === null || typeof s.currentUserId === 'string') &&
      Array.isArray(s.users) &&
      Array.isArray(s.breeds) &&
      Array.isArray(s.dogs) &&
      Array.isArray(s.blocks) &&
      Array.isArray(s.places) &&
      Array.isArray(s.events) &&
      Array.isArray(s.eventInvitations) &&
      Array.isArray(s.eventDogRsvps) &&
      Array.isArray(s.conversations) &&
      Array.isArray(s.messages) &&
      Array.isArray(s.healthRecords) &&
      Array.isArray(s.posts) &&
      Array.isArray(s.comments) &&
      typeof s.nextIdCounter === 'number'
    );
  }
}
