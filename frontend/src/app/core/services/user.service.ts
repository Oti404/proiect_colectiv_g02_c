import { Injectable, computed, inject } from '@angular/core';
import { NEIGHBORHOOD_COORDINATES } from '../mock-data/demo-seed';
import { ActionResult, User, UserProfileUpdate } from '../models';
import { DemoStateService } from '../state/demo-state.service';
import { DemoAuthService } from './demo-auth.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly store = inject(DemoStateService);
  private readonly auth = inject(DemoAuthService);

  readonly allUsers = computed(() => this.store.state().users);

  getCurrentUser(): User | null {
    return this.auth.currentUser();
  }

  getUserById(userId: string): User | undefined {
    return this.store.state().users.find((u) => u.id === userId);
  }

  getOtherUsers(): User[] {
    const me = this.auth.currentUser();
    if (!me) {
      return [];
    }
    return this.store
      .state()
      .users.filter((u) => u.id !== me.id && !this.isBlockedEitherWay(me.id, u.id));
  }

  updateCurrentUser(patch: UserProfileUpdate): ActionResult<User> {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed into a demo session.' };
    }
    const firstName = patch.firstName.trim();
    const lastName = patch.lastName.trim();
    if (!firstName || !lastName) {
      return { ok: false, error: 'First name and last name cannot be empty.' };
    }

    const neighborhood = patch.neighborhood.trim() || me.neighborhood;
    const coords = NEIGHBORHOOD_COORDINATES[neighborhood] ?? {
      lat: me.approxLatitude,
      lng: me.approxLongitude,
    };

    let updatedUser: User | undefined;
    this.store.updateState((draft) => {
      const target = draft.users.find((u) => u.id === me.id);
      if (target) {
        target.firstName = firstName;
        target.lastName = lastName;
        target.bio = patch.bio ? patch.bio.trim() : null;
        target.neighborhood = neighborhood;
        target.approxLatitude = coords.lat;
        target.approxLongitude = coords.lng;
        if (patch.avatarUrl !== undefined) {
          target.avatarUrl = patch.avatarUrl;
        }
        updatedUser = target;
      }
      return draft;
    });

    return updatedUser ? { ok: true, data: updatedUser } : { ok: false, error: 'User not found.' };
  }

  blockUser(targetUserId: string): ActionResult {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'No active session.' };
    }
    if (me.id === targetUserId) {
      return { ok: false, error: 'You cannot block yourself.' };
    }

    this.store.updateState((draft) => {
      const alreadyBlocked = draft.blocks.some(
        (b) => b.blockerId === me.id && b.blockedId === targetUserId,
      );
      if (!alreadyBlocked) {
        draft.blocks.push({
          blockerId: me.id,
          blockedId: targetUserId,
          createdAt: new Date().toISOString(),
        });
      }
      return draft;
    });
    return { ok: true };
  }

  unblockUser(targetUserId: string): void {
    const me = this.auth.currentUser();
    if (!me) {
      return;
    }
    this.store.updateState((draft) => {
      draft.blocks = draft.blocks.filter(
        (b) => !(b.blockerId === me.id && b.blockedId === targetUserId),
      );
      return draft;
    });
  }

  getBlockedUsers(): User[] {
    const me = this.auth.currentUser();
    if (!me) {
      return [];
    }
    const state = this.store.state();
    const blockedIds = new Set(
      state.blocks.filter((b) => b.blockerId === me.id).map((b) => b.blockedId),
    );
    return state.users.filter((u) => blockedIds.has(u.id));
  }

  isBlockedEitherWay(userIdA: string, userIdB: string): boolean {
    return this.store.state().blocks.some(
      (b) =>
        (b.blockerId === userIdA && b.blockedId === userIdB) ||
        (b.blockerId === userIdB && b.blockedId === userIdA),
    );
  }
}
