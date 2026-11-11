import { Injectable, computed, inject } from '@angular/core';
import {
  DEFAULT_DEMO_USER_ID,
  DEMO_ACCOUNT_OPTIONS,
  NEIGHBORHOOD_COORDINATES,
} from '../mock-data/demo-seed';
import { ActionResult, DemoAccountOption, User } from '../models';
import { DemoStateService } from '../state/demo-state.service';

export interface DemoRegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  neighborhood: string;
  consentAccepted: boolean;
}

@Injectable({ providedIn: 'root' })
export class DemoAuthService {
  private readonly store = inject(DemoStateService);

  readonly currentUser = computed<User | null>(() => {
    const state = this.store.state();
    if (!state.currentUserId) {
      return null;
    }
    return state.users.find((u) => u.id === state.currentUserId) ?? null;
  });

  readonly isAuthenticated = computed<boolean>(() => this.currentUser() !== null);

  readonly demoAccounts = computed<DemoAccountOption[]>(() => DEMO_ACCOUNT_OPTIONS);

  readonly neighborhoods = Object.keys(NEIGHBORHOOD_COORDINATES);

  enterDemo(userId: string = DEFAULT_DEMO_USER_ID): ActionResult<User> {
    const user = this.store.state().users.find((u) => u.id === userId);
    if (!user) {
      return { ok: false, error: 'Selected demo account was not found.' };
    }
    this.store.updateState((draft) => {
      draft.currentUserId = user.id;
      return draft;
    });
    return { ok: true, data: user };
  }

  switchDemoAccount(userId: string): ActionResult<User> {
    return this.enterDemo(userId);
  }

  loginWithEmail(email: string): ActionResult<User> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return { ok: false, error: 'Please enter an email address or use Enter Demo.' };
    }
    const user = this.store.state().users.find((u) => u.email.toLowerCase() === normalized);
    if (!user) {
      return {
        ok: false,
        error: 'No fictional demo user matches that email. Try one of the preset demo accounts.',
      };
    }
    this.store.updateState((draft) => {
      draft.currentUserId = user.id;
      return draft;
    });
    return { ok: true, data: user };
  }

  register(payload: DemoRegisterPayload): ActionResult<User> {
    const firstName = payload.firstName.trim();
    const lastName = payload.lastName.trim();
    const email = payload.email.trim().toLowerCase();
    const neighborhood = payload.neighborhood.trim() || 'Centru';

    if (!firstName || !lastName) {
      return { ok: false, error: 'First name and last name are required.' };
    }
    if (!email || !email.includes('@')) {
      return { ok: false, error: 'Please provide a valid email format.' };
    }
    if (!payload.consentAccepted) {
      return { ok: false, error: 'GDPR consent is required to create a demo profile.' };
    }

    const exists = this.store.state().users.some((u) => u.email.toLowerCase() === email);
    if (exists) {
      return { ok: false, error: 'A demo user with this email already exists.' };
    }

    const coords = NEIGHBORHOOD_COORDINATES[neighborhood] ?? NEIGHBORHOOD_COORDINATES['Centru'];
    const nowIso = new Date().toISOString();
    const newUser: User = {
      id: this.store.allocateId('user'),
      email,
      firstName,
      lastName,
      avatarUrl: null,
      bio: null,
      neighborhood,
      approxLatitude: coords.lat,
      approxLongitude: coords.lng,
      consentAt: nowIso,
      createdAt: nowIso,
    };

    this.store.updateState((draft) => {
      draft.users.push(newUser);
      draft.currentUserId = newUser.id;
      return draft;
    });

    return { ok: true, data: newUser };
  }

  logout(): void {
    this.store.updateState((draft) => {
      draft.currentUserId = null;
      return draft;
    });
  }
}
