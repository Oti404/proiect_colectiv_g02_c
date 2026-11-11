import { Injectable, computed, inject } from '@angular/core';
import { ActionResult, Breed, Dog, DogDraft, DogWithDetails } from '../models';
import { DemoStateService } from '../state/demo-state.service';
import { calculateApproxDistanceKm } from '../../shared/utils/distance.util';
import { formatDogAge } from '../../shared/utils/dog-age.util';
import { DemoAuthService } from './demo-auth.service';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class DogService {
  private readonly store = inject(DemoStateService);
  private readonly auth = inject(DemoAuthService);
  private readonly userService = inject(UserService);

  readonly breeds = computed<Breed[]>(() => this.store.state().breeds);

  readonly myDogs = computed<Dog[]>(() => {
    const me = this.auth.currentUser();
    if (!me) {
      return [];
    }
    return this.store.state().dogs.filter((d) => d.ownerId === me.id);
  });

  getBreedById(breedId: string): Breed | undefined {
    return this.store.state().breeds.find((b) => b.id === breedId);
  }

  getDogsByOwner(ownerId: string): Dog[] {
    return this.store.state().dogs.filter((d) => d.ownerId === ownerId);
  }

  getDogById(dogId: string): DogWithDetails | undefined {
    const state = this.store.state();
    const dog = state.dogs.find((d) => d.id === dogId);
    if (!dog) {
      return undefined;
    }
    const breed = state.breeds.find((b) => b.id === dog.breedId);
    const owner = state.users.find((u) => u.id === dog.ownerId);
    if (!breed || !owner) {
      return undefined;
    }

    const me = this.auth.currentUser();
    if (me && me.id !== owner.id && this.userService.isBlockedEitherWay(me.id, owner.id)) {
      return undefined;
    }

    const distanceKm =
      me && me.id !== owner.id
        ? calculateApproxDistanceKm(
            me.approxLatitude,
            me.approxLongitude,
            owner.approxLatitude,
            owner.approxLongitude,
          )
        : null;

    return {
      dog,
      breed,
      owner,
      ageLabel: formatDogAge(dog.birthDate),
      distanceKm,
    };
  }

  addDog(draftData: DogDraft): ActionResult<Dog> {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in to add a dog.' };
    }
    const name = draftData.name.trim();
    if (!name) {
      return { ok: false, error: 'Dog name is required.' };
    }
    const breedExists = this.store.state().breeds.some((b) => b.id === draftData.breedId);
    if (!breedExists) {
      return { ok: false, error: 'Please select a valid breed.' };
    }

    const newDog: Dog = {
      id: this.store.allocateId('dog'),
      ownerId: me.id,
      breedId: draftData.breedId,
      name,
      birthDate: draftData.birthDate || null,
      sex: draftData.sex,
      size: draftData.size,
      temperament: draftData.temperament,
      neutered: draftData.neutered,
      photoUrl: draftData.photoUrl || null,
    };

    this.store.updateState((draft) => {
      draft.dogs.push(newDog);
      return draft;
    });

    return { ok: true, data: newDog };
  }

  updateDog(dogId: string, patch: Partial<DogDraft>): ActionResult<Dog> {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }

    const existing = this.store.state().dogs.find((d) => d.id === dogId);
    if (!existing) {
      return { ok: false, error: 'Dog not found.' };
    }
    if (existing.ownerId !== me.id) {
      return { ok: false, error: 'You can only edit your own dogs.' };
    }

    if (patch.name !== undefined && !patch.name.trim()) {
      return { ok: false, error: 'Dog name cannot be empty.' };
    }

    let updated: Dog | undefined;
    this.store.updateState((draft) => {
      const target = draft.dogs.find((d) => d.id === dogId);
      if (target) {
        if (patch.name !== undefined) target.name = patch.name.trim();
        if (patch.breedId !== undefined) target.breedId = patch.breedId;
        if (patch.birthDate !== undefined) target.birthDate = patch.birthDate || null;
        if (patch.sex !== undefined) target.sex = patch.sex;
        if (patch.size !== undefined) target.size = patch.size;
        if (patch.temperament !== undefined) target.temperament = patch.temperament;
        if (patch.neutered !== undefined) target.neutered = patch.neutered;
        if (patch.photoUrl !== undefined) target.photoUrl = patch.photoUrl || null;
        updated = target;
      }
      return draft;
    });

    return updated ? { ok: true, data: updated } : { ok: false, error: 'Update failed.' };
  }

  removeDog(dogId: string): ActionResult {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }
    const existing = this.store.state().dogs.find((d) => d.id === dogId);
    if (!existing) {
      return { ok: false, error: 'Dog not found.' };
    }
    if (existing.ownerId !== me.id) {
      return { ok: false, error: 'You can only remove your own dogs.' };
    }

    this.store.updateState((draft) => {
      draft.dogs = draft.dogs.filter((d) => d.id !== dogId);
      draft.eventDogRsvps = draft.eventDogRsvps.filter((r) => r.dogId !== dogId);
      draft.healthRecords = draft.healthRecords.filter((h) => h.dogId !== dogId);
      draft.posts = draft.posts.map((p) => (p.dogId === dogId ? { ...p, dogId: null } : p));
      return draft;
    });

    return { ok: true };
  }
}
