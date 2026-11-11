import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DemoAuthService, EventService, MessageService } from './core/services';
import { DemoStateService } from './core/state/demo-state.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(DemoAuthService);
  private readonly stateService = inject(DemoStateService);
  private readonly eventService = inject(EventService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  readonly currentUser = this.auth.currentUser;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly demoAccounts = this.auth.demoAccounts;
  readonly allUsers = computed(() => this.stateService.state().users);
  readonly unreadMessagesCount = this.messageService.totalUnreadCount;
  readonly pendingInvitationsCount = this.eventService.pendingInvitationsCount;

  readonly switcherOptions = computed(() => {
    const presets = this.demoAccounts();
    const current = this.currentUser();
    const presetIds = new Set(presets.map((p) => p.userId));
    if (current && !presetIds.has(current.id)) {
      return [
        ...presets,
        {
          userId: current.id,
          label: `${current.firstName} ${current.lastName} (${current.neighborhood})`,
          roleHint: 'Registered demo session',
        },
      ];
    }
    return presets;
  });

  onSwitchAccount(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (!select.value) {
      return;
    }
    this.auth.switchDemoAccount(select.value);
  }

  onResetDemoData(): void {
    this.stateService.resetDemoData({ keepSeededSession: this.isAuthenticated() });
    if (!this.isAuthenticated()) {
      void this.router.navigate(['/login']);
    }
  }

  onLogout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
