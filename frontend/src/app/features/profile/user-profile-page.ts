import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  DemoAuthService,
  DogService,
  MessageService,
  UserService,
} from '../../core/services';
import { calculateApproxDistanceKm } from '../../shared/utils/distance.util';
import { formatDogAge } from '../../shared/utils/dog-age.util';

@Component({
  selector: 'app-user-profile-page',
  imports: [RouterLink],
  templateUrl: './user-profile-page.html',
})
export class UserProfilePageComponent {
  private readonly auth = inject(DemoAuthService);
  private readonly userService = inject(UserService);
  private readonly dogService = inject(DogService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  readonly confirmingBlock = signal(false);

  readonly profileView = computed(() => {
    const userId = this.id();
    const me = this.auth.currentUser();
    if (!userId || !me) {
      return null;
    }

    const user = this.userService.getUserById(userId);
    if (!user) {
      return null;
    }

    const isOwnProfile = user.id === me.id;
    const isBlockedByMe = this.userService
      .getBlockedUsers()
      .some((b) => b.id === user.id);
    const isBlockedEitherWay =
      !isOwnProfile && this.userService.isBlockedEitherWay(me.id, user.id);

    const dogs = this.dogService.getDogsByOwner(user.id).map((dog) => ({
      dog,
      breedName: this.dogService.getBreedById(dog.breedId)?.name ?? 'Unknown breed',
      ageLabel: formatDogAge(dog.birthDate),
    }));

    const distanceKm = isOwnProfile
      ? 0
      : calculateApproxDistanceKm(
          me.approxLatitude,
          me.approxLongitude,
          user.approxLatitude,
          user.approxLongitude,
        );

    return {
      user,
      isOwnProfile,
      isBlockedByMe,
      isBlockedEitherWay,
      dogs,
      distanceKm,
    };
  });

  onSendMessage(userId: string): void {
    const res = this.messageService.startOrOpenConversation(userId);
    if (res.ok && res.data) {
      void this.router.navigate(['/messages', res.data.id]);
    }
  }

  onInviteToPlaydate(userId: string): void {
    void this.router.navigate(['/events/new'], {
      queryParams: {
        inviteUserId: userId,
        type: 'PLAYDATE',
        visibility: 'PRIVATE',
      },
    });
  }

  onConfirmBlock(userId: string): void {
    this.userService.blockUser(userId);
    this.confirmingBlock.set(false);
  }

  onUnblock(userId: string): void {
    this.userService.unblockUser(userId);
  }
}
