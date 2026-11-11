import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  DemoAuthService,
  DogService,
  MessageService,
  UserService,
} from '../../core/services';

@Component({
  selector: 'app-dog-detail-page',
  imports: [RouterLink],
  templateUrl: './dog-detail-page.html',
})
export class DogDetailPageComponent {
  private readonly auth = inject(DemoAuthService);
  private readonly dogService = inject(DogService);
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  readonly confirmingBlock = signal(false);

  readonly details = computed(() => {
    const dogId = this.id();
    return dogId ? this.dogService.getDogById(dogId) : undefined;
  });

  readonly isOwnDog = computed(() => {
    const me = this.auth.currentUser();
    const info = this.details();
    return Boolean(me && info && info.owner.id === me.id);
  });

  onSendMessage(ownerId: string): void {
    const res = this.messageService.startOrOpenConversation(ownerId);
    if (res.ok && res.data) {
      void this.router.navigate(['/messages', res.data.id]);
    }
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
    this.userService.blockUser(ownerId);
    this.confirmingBlock.set(false);
    void this.router.navigate(['/search']);
  }
}
