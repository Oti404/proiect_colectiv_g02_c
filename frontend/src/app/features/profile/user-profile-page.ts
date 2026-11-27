import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { ApiError } from '../../core/api/api.types';
import { AuthService } from '../../core/auth/auth.service';
import { nearestNeighborhood } from '../../core/auth/neighborhoods';
import { UserService } from '../../core/services';
import { calculateApproxDistanceKm } from '../../shared/utils/distance.util';
import { formatDogAge } from '../../shared/utils/dog-age.util';

@Component({
  selector: 'app-user-profile-page',
  imports: [RouterLink],
  templateUrl: './user-profile-page.html',
})
export class UserProfilePageComponent {
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  readonly confirmingBlock = signal(false);
  readonly blocking = signal(false);

  readonly showReportForm = signal(false);
  readonly reportReason = signal('');
  readonly submittingReport = signal(false);
  readonly reportSuccess = signal<string | null>(null);
  readonly reportError = signal<string | null>(null);

  readonly profileResource = rxResource({
    params: () => this.id() ?? null,
    stream: ({ params }) => (params ? this.userService.getPublicProfile(params) : of(null)),
  });

  readonly blocksResource = rxResource({
    params: () => this.auth.user()?.id ?? null,
    stream: ({ params }) => (params ? this.userService.listBlocks() : of([])),
  });

  readonly profileView = computed(() => {
    const user = this.profileResource.value();
    const me = this.auth.user();
    if (!user || !me) {
      return null;
    }

    const isOwnProfile = user.id === me.id;
    const isBlockedByMe = (this.blocksResource.value() ?? []).some((b) => b.user.id === user.id);

    const dogs = user.dogs.map((dog) => ({
      dog,
      breedName: dog.breed.name,
      ageLabel: formatDogAge(dog.birthDate, new Date().toISOString()),
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
      neighborhood: nearestNeighborhood(user.approxLatitude, user.approxLongitude),
      isOwnProfile,
      isBlockedByMe,
      dogs,
      distanceKm,
    };
  });

  onSendMessage(userId: string): void {
    void this.router.navigate(['/messages'], { queryParams: { with: userId } });
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
    this.blocking.set(true);
    this.userService.block(userId).subscribe({
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

  onUnblock(userId: string): void {
    this.userService.unblock(userId).subscribe({
      next: () => {
        this.blocksResource.reload();
        this.profileResource.reload();
      },
    });
  }

  onOpenReport(): void {
    this.showReportForm.set(true);
    this.reportReason.set('');
    this.reportError.set(null);
    this.reportSuccess.set(null);
  }

  onCancelReport(): void {
    this.showReportForm.set(false);
    this.reportError.set(null);
  }

  onUpdateReportReason(event: Event): void {
    this.reportReason.set((event.target as HTMLTextAreaElement).value);
  }

  onSubmitReport(userId: string): void {
    const reason = this.reportReason().trim();
    this.reportError.set(null);
    this.reportSuccess.set(null);
    if (!reason) {
      this.reportError.set('Please describe the reason for your report.');
      return;
    }

    this.submittingReport.set(true);
    this.userService.reportUser(userId, reason).subscribe({
      next: () => {
        this.submittingReport.set(false);
        this.showReportForm.set(false);
        this.reportReason.set('');
        this.reportSuccess.set('Report submitted. Thank you for helping keep the community safe.');
      },
      error: (err) => {
        this.submittingReport.set(false);
        const apiErr = ApiError.from(err);
        if (apiErr.code === 'ALREADY_REPORTED') {
          this.reportError.set('You have already reported this user.');
        } else if (apiErr.code === 'CANNOT_REPORT_SELF') {
          this.reportError.set('You cannot report yourself.');
        } else if (apiErr.code === 'VALIDATION_ERROR') {
          this.reportError.set(apiErr.fieldError('reason') ?? 'Please provide a valid reason.');
        } else {
          this.reportError.set('Could not submit report. Please try again.');
        }
      },
    });
  }
}
