import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { ApiError, ApiModel } from '../../core/api/api.types';
import { BreedApiService } from '../../core/api/breed-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { NEIGHBORHOODS, coordinatesOf, nearestNeighborhood } from '../../core/auth/neighborhoods';
import { DogSize, Sex, Temperament } from '../../core/models';
import { DogService, UserService } from '../../core/services';
import { formatDogAge } from '../../shared/utils/dog-age.util';

type PublicDog = ApiModel<'PublicProfile'>['dogs'][number];

function profileErrorMessage(err: unknown, fallback: string): string {
  const apiErr = ApiError.from(err);
  switch (apiErr.code) {
    case 'INVALID_PASSWORD':
      return 'Incorrect password. Please try again.';
    case 'VALIDATION_ERROR':
      return apiErr.fieldErrors[0]?.message ?? fallback;
    case 'NOT_FOUND':
      return 'Requested record was not found.';
    case 'FORBIDDEN':
      return 'You do not have permission to perform this action.';
    case 'NETWORK_ERROR':
      return 'Cannot reach the server. Check your connection.';
    default:
      return fallback;
  }
}

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './profile-page.html',
})
export class ProfilePageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly dogService = inject(DogService);
  private readonly breedApi = inject(BreedApiService);

  private lastSyncedUserId: string | null = null;

  readonly currentUser = this.auth.user;
  readonly currentNeighborhood = computed(() => {
    const user = this.currentUser();
    return user ? nearestNeighborhood(user.approxLatitude, user.approxLongitude) : 'Centru';
  });
  readonly neighborhoods = NEIGHBORHOODS;

  readonly breedsResource = rxResource({
    stream: () => this.breedApi.list(),
  });
  readonly breeds = computed(() => this.breedsResource.value() ?? []);

  readonly myProfileResource = rxResource({
    params: () => this.currentUser()?.id ?? null,
    stream: ({ params }) => (params ? this.userService.getPublicProfile(params) : of(null)),
  });
  readonly myDogs = computed(() => this.myProfileResource.value()?.dogs ?? []);

  readonly blocksResource = rxResource({
    params: () => this.currentUser()?.id ?? null,
    stream: ({ params }) => (params ? this.userService.listBlocks() : of([])),
  });
  readonly blockedUsers = computed(() => this.blocksResource.value() ?? []);

  readonly savingProfile = signal(false);
  readonly profileMessage = signal<string | null>(null);
  readonly profileError = signal<string | null>(null);

  readonly showDogForm = signal(false);
  readonly editingDogId = signal<string | null>(null);
  readonly confirmingDeleteDogId = signal<string | null>(null);
  readonly savingDog = signal(false);
  readonly deletingDogId = signal<string | null>(null);
  readonly dogFormError = signal<string | null>(null);
  readonly dogActionMessage = signal<string | null>(null);

  readonly unblockingUserId = signal<string | null>(null);

  readonly showDeleteAccount = signal(false);
  readonly deletingAccount = signal(false);
  readonly deleteAccountError = signal<string | null>(null);

  readonly profileForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    neighborhood: ['Centru', [Validators.required]],
    bio: [''],
  });

  readonly dogForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    breedId: ['', [Validators.required]],
    sex: ['MALE' as Sex, [Validators.required]],
    size: ['MEDIUM' as DogSize, [Validators.required]],
    temperament: ['FRIENDLY' as Temperament, [Validators.required]],
    birthDate: [''],
    neutered: [false],
    photoUrl: [''],
  });

  readonly deleteAccountForm = this.fb.nonNullable.group({
    password: ['', [Validators.required]],
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
          neighborhood: nearestNeighborhood(user.approxLatitude, user.approxLongitude),
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
        this.showDeleteAccount.set(false);
        this.deleteAccountError.set(null);
      }
    });
  }

  getDogAge(birthDate: string | null): string {
    return formatDogAge(birthDate, new Date().toISOString());
  }

  onSaveProfile(): void {
    this.profileMessage.set(null);
    this.profileError.set(null);
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const raw = this.profileForm.getRawValue();
    const coords = coordinatesOf(raw.neighborhood);

    this.savingProfile.set(true);
    this.userService
      .updateMe({
        firstName: raw.firstName.trim(),
        lastName: raw.lastName.trim(),
        bio: raw.bio.trim() ? raw.bio.trim() : null,
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
      .subscribe({
        next: (updated) => {
          this.savingProfile.set(false);
          this.auth.syncUser(updated);
          this.profileMessage.set('Profile updated.');
        },
        error: (err) => {
          this.savingProfile.set(false);
          this.profileError.set(profileErrorMessage(err, 'Could not update profile.'));
        },
      });
  }

  onOpenAddDog(): void {
    this.dogFormError.set(null);
    this.dogActionMessage.set(null);
    this.editingDogId.set(null);
    this.confirmingDeleteDogId.set(null);
    this.dogForm.reset({
      name: '',
      breedId: this.breeds()[0]?.id ?? '',
      sex: 'MALE',
      size: 'MEDIUM',
      temperament: 'FRIENDLY',
      birthDate: '',
      neutered: false,
      photoUrl: '',
    });
    this.showDogForm.set(true);
  }

  onOpenEditDog(dog: PublicDog): void {
    this.dogFormError.set(null);
    this.dogActionMessage.set(null);
    this.confirmingDeleteDogId.set(null);
    this.editingDogId.set(dog.id);
    this.dogForm.reset({
      name: dog.name,
      breedId: dog.breed.id,
      sex: dog.sex,
      size: dog.size,
      temperament: dog.temperament,
      birthDate: dog.birthDate ? dog.birthDate.slice(0, 10) : '',
      neutered: dog.neutered,
      photoUrl: dog.photoUrl ?? '',
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
      name: raw.name.trim(),
      breedId: raw.breedId,
      sex: raw.sex,
      size: raw.size,
      temperament: raw.temperament,
      birthDate: raw.birthDate.trim() ? raw.birthDate.trim() : null,
      neutered: raw.neutered,
      photoUrl: raw.photoUrl.trim() ? raw.photoUrl.trim() : null,
    };

    const editId = this.editingDogId();
    this.savingDog.set(true);

    const request$ = editId
      ? this.dogService.update(editId, payload)
      : this.dogService.create(payload);

    request$.subscribe({
      next: () => {
        this.savingDog.set(false);
        this.showDogForm.set(false);
        this.editingDogId.set(null);
        this.dogActionMessage.set(editId ? 'Dog updated.' : 'New dog added.');
        this.myProfileResource.reload();
      },
      error: (err) => {
        this.savingDog.set(false);
        const apiErr = ApiError.from(err);
        const fieldMsg =
          apiErr.fieldError('name') ??
          apiErr.fieldError('breedId') ??
          apiErr.fieldError('birthDate') ??
          apiErr.fieldError('photoUrl');
        this.dogFormError.set(fieldMsg ?? profileErrorMessage(err, 'Could not save dog.'));
      },
    });
  }

  onRequestDeleteDog(dogId: string): void {
    this.confirmingDeleteDogId.set(dogId);
  }

  onCancelDeleteDog(): void {
    this.confirmingDeleteDogId.set(null);
  }

  onConfirmDeleteDog(dogId: string): void {
    this.deletingDogId.set(dogId);
    this.dogService.delete(dogId).subscribe({
      next: () => {
        this.deletingDogId.set(null);
        this.confirmingDeleteDogId.set(null);
        this.dogActionMessage.set('Dog removed.');
        this.myProfileResource.reload();
      },
      error: (err) => {
        this.deletingDogId.set(null);
        this.confirmingDeleteDogId.set(null);
        this.dogFormError.set(profileErrorMessage(err, 'Could not remove dog.'));
      },
    });
  }

  onUnblockUser(userId: string): void {
    this.unblockingUserId.set(userId);
    this.userService.unblock(userId).subscribe({
      next: () => {
        this.unblockingUserId.set(null);
        this.blocksResource.reload();
      },
      error: () => {
        this.unblockingUserId.set(null);
      },
    });
  }

  onToggleDeleteAccount(open: boolean): void {
    this.showDeleteAccount.set(open);
    this.deleteAccountError.set(null);
    this.deleteAccountForm.reset({ password: '' });
  }

  onConfirmDeleteAccount(): void {
    this.deleteAccountError.set(null);
    if (this.deleteAccountForm.invalid) {
      this.deleteAccountForm.markAllAsTouched();
      return;
    }

    const { password } = this.deleteAccountForm.getRawValue();
    this.deletingAccount.set(true);
    this.userService.deleteMe(password).subscribe({
      next: () => {
        this.deletingAccount.set(false);
        this.auth.logout();
        void this.router.navigate(['/login']);
      },
      error: (err) => {
        this.deletingAccount.set(false);
        this.deleteAccountError.set(profileErrorMessage(err, 'Could not delete account.'));
      },
    });
  }
}
