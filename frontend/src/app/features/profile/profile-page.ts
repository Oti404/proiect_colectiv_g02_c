import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Dog, DogSize, Sex, Temperament } from '../../core/models';
import { DemoAuthService, DogService, UserService } from '../../core/services';
import { formatDogAge } from '../../shared/utils/dog-age.util';

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './profile-page.html',
})
export class ProfilePageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(DemoAuthService);
  private readonly userService = inject(UserService);
  private readonly dogService = inject(DogService);

  private lastSyncedUserId: string | null = null;

  readonly currentUser = this.auth.currentUser;
  readonly neighborhoods = this.auth.neighborhoods;
  readonly myDogs = this.dogService.myDogs;
  readonly breeds = this.dogService.breeds;
  readonly blockedUsers = computed(() => this.userService.getBlockedUsers());

  readonly profileMessage = signal<string | null>(null);
  readonly profileError = signal<string | null>(null);

  readonly showDogForm = signal(false);
  readonly editingDogId = signal<string | null>(null);
  readonly confirmingDeleteDogId = signal<string | null>(null);
  readonly dogFormError = signal<string | null>(null);
  readonly dogActionMessage = signal<string | null>(null);

  readonly profileForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    neighborhood: ['Centru', [Validators.required]],
    bio: [''],
  });

  readonly dogForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    breedId: ['breed-mixed', [Validators.required]],
    sex: ['MALE' as Sex, [Validators.required]],
    size: ['MEDIUM' as DogSize, [Validators.required]],
    temperament: ['FRIENDLY' as Temperament, [Validators.required]],
    birthDate: [''],
    neutered: [false],
  });

  constructor() {
    effect(() => {
      const user = this.currentUser();
      if (!user) {
        this.lastSyncedUserId = null;
        return;
      }

      const isAccountSwitch = user.id !== this.lastSyncedUserId;
      this.lastSyncedUserId = user.id;

      this.profileForm.patchValue(
        {
          firstName: user.firstName,
          lastName: user.lastName,
          neighborhood: user.neighborhood,
          bio: user.bio ?? '',
        },
        { emitEvent: false },
      );

      if (isAccountSwitch) {
        this.showDogForm.set(false);
        this.editingDogId.set(null);
        this.confirmingDeleteDogId.set(null);
        this.profileMessage.set(null);
        this.profileError.set(null);
        this.dogActionMessage.set(null);
      }
    });
  }

  getBreedName(breedId: string): string {
    return this.dogService.getBreedById(breedId)?.name ?? 'Unknown breed';
  }

  getDogAge(birthDate: string | null): string {
    return formatDogAge(birthDate);
  }

  onSaveProfile(): void {
    this.profileMessage.set(null);
    this.profileError.set(null);
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    const raw = this.profileForm.getRawValue();
    const res = this.userService.updateCurrentUser({
      firstName: raw.firstName,
      lastName: raw.lastName,
      neighborhood: raw.neighborhood,
      bio: raw.bio.trim() ? raw.bio.trim() : null,
    });
    if (res.ok) {
      this.profileMessage.set('Profile updated in demo state.');
    } else {
      this.profileError.set(res.error ?? 'Could not update profile.');
    }
  }

  onOpenAddDog(): void {
    this.dogFormError.set(null);
    this.dogActionMessage.set(null);
    this.editingDogId.set(null);
    this.confirmingDeleteDogId.set(null);
    this.dogForm.reset({
      name: '',
      breedId: this.breeds()[0]?.id ?? 'breed-mixed',
      sex: 'MALE',
      size: 'MEDIUM',
      temperament: 'FRIENDLY',
      birthDate: '',
      neutered: false,
    });
    this.showDogForm.set(true);
  }

  onOpenEditDog(dog: Dog): void {
    this.dogFormError.set(null);
    this.dogActionMessage.set(null);
    this.confirmingDeleteDogId.set(null);
    this.editingDogId.set(dog.id);
    this.dogForm.reset({
      name: dog.name,
      breedId: dog.breedId,
      sex: dog.sex,
      size: dog.size,
      temperament: dog.temperament,
      birthDate: dog.birthDate ?? '',
      neutered: dog.neutered,
    });
    this.showDogForm.set(true);
  }

  onCancelDogForm(): void {
    this.showDogForm.set(false);
    this.editingDogId.set(null);
    this.dogFormError.set(null);
  }

  onSubmitDog(): void {
    this.dogFormError.set(null);
    if (this.dogForm.invalid) {
      this.dogForm.markAllAsTouched();
      return;
    }

    const raw = this.dogForm.getRawValue();
    const payload = {
      name: raw.name,
      breedId: raw.breedId,
      sex: raw.sex,
      size: raw.size,
      temperament: raw.temperament,
      birthDate: raw.birthDate.trim() ? raw.birthDate.trim() : null,
      neutered: raw.neutered,
      photoUrl: null,
    };

    const editId = this.editingDogId();
    const res = editId
      ? this.dogService.updateDog(editId, payload)
      : this.dogService.addDog(payload);

    if (res.ok) {
      this.showDogForm.set(false);
      this.editingDogId.set(null);
      this.dogActionMessage.set(
        editId ? 'Dog updated across the app.' : 'New dog added and available in Events & Care.',
      );
    } else {
      this.dogFormError.set(res.error ?? 'Could not save dog.');
    }
  }

  onRequestDeleteDog(dogId: string): void {
    this.confirmingDeleteDogId.set(dogId);
  }

  onCancelDeleteDog(): void {
    this.confirmingDeleteDogId.set(null);
  }

  onConfirmDeleteDog(dogId: string): void {
    const res = this.dogService.removeDog(dogId);
    this.confirmingDeleteDogId.set(null);
    if (res.ok) {
      this.dogActionMessage.set('Dog removed from demo state.');
    }
  }

  onUnblockUser(userId: string): void {
    this.userService.unblockUser(userId);
  }
}
