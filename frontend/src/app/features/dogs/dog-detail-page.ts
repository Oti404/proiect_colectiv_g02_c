import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { nearestNeighborhood } from '../../core/auth/neighborhoods';
import { DogService, UserService } from '../../core/services';
import { calculateApproxDistanceKm } from '../../shared/utils/distance.util';
import { formatDogAge } from '../../shared/utils/dog-age.util';

@Component({
  selector: 'app-dog-detail-page',
  imports: [RouterLink],
  templateUrl: './dog-detail-page.html',
})
export class DogDetailPageComponent {
  private readonly auth = inject(AuthService);
  private readonly dogService = inject(DogService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  readonly confirmingBlock = signal(false);
  readonly blocking = signal(false);

  readonly dogResource = rxResource({
    params: () => this.id() ?? null,
    stream: ({ params }) => (params ? this.dogService.getById(params) : of(null)),
  });

  readonly details = computed(() => {
    const dog = this.dogResource.value();
    if (!dog) {
      return undefined;
    }

    const me = this.auth.user();
    const distanceKm =
      me && me.id !== dog.owner.id
        ? calculateApproxDistanceKm(
            me.approxLatitude,
            me.approxLongitude,
            dog.owner.approxLatitude,
            dog.owner.approxLongitude,
          )
        : null;

    return {
      dog,
      breed: dog.breed,
      owner: dog.owner,
      ownerNeighborhood: nearestNeighborhood(dog.owner.approxLatitude, dog.owner.approxLongitude),
      ageLabel: formatDogAge(dog.birthDate, new Date().toISOString()),
      distanceKm,
    };
  });

  readonly isOwnDog = computed(() => {
    const me = this.auth.user();
    const info = this.details();
    return Boolean(me && info && info.owner.id === me.id);
  });

  onSendMessage(ownerId: string): void {
    void this.router.navigate(['/messages'], { queryParams: { with: ownerId } });
  }

  onInviteToPlaydate(ownerId: string): void {
    void this.router.navigate(['/events/new'], {
      queryParams: {
        inviteUserId: ownerId,
        type: 'PLAYDATE',
        visibility: 'PRIVATE',
      },
    });
  }

  onConfirmBlock(ownerId: string): void {
    this.blocking.set(true);
    this.userService.block(ownerId).subscribe({
      next: () => {
        this.blocking.set(false);
        this.confirmingBlock.set(false);
        void this.router.navigate(['/search']);
      },
      error: () => {
        this.blocking.set(false);
        this.confirmingBlock.set(false);
      },
    });
  }
}
