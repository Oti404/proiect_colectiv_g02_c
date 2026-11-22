import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService, DEMO_PASSWORD } from './core/auth/auth.service';
import { DEMO_ACCOUNTS } from './core/auth/demo-accounts';
import { DemoAuthService, EventService, MessageService } from './core/services';
import { DemoStateService } from './core/state/demo-state.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly demoBridge = inject(DemoAuthService);
  private readonly stateService = inject(DemoStateService);
  private readonly eventService = inject(EventService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  readonly currentUser = this.auth.user;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly unreadMessagesCount = this.messageService.totalUnreadCount;
  readonly pendingInvitationsCount = this.eventService.pendingInvitationsCount;

  /** Login rapid cu un cont demo (prezentare / testare). Contul curent apare și dacă nu e demo. */
  readonly switcherOptions = computed(() => {
    const options = DEMO_ACCOUNTS.map((a) => ({ email: a.email, label: `${a.name} (${a.hint})` }));
    const current = this.currentUser();
    if (current && !options.some((o) => o.email === current.email)) {
      options.push({ email: current.email, label: `${current.firstName} ${current.lastName}` });
    }
    return options;
  });

  onSwitchAccount(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const email = select.value;
    if (!email || email === this.currentUser()?.email) {
      return;
    }
    this.auth.login(email, DEMO_PASSWORD).subscribe({
      error: () => {
        // Contul nu mai există sau serverul nu răspunde: revenim la contul curent în selector.
        select.value = this.currentUser()?.email ?? '';
      },
    });
  }

  /** Resetează doar datele demo din browser (modulele încă nemutate pe API). Sesiunea rămâne. */
  onResetDemoData(): void {
    this.stateService.resetDemoData();
    const user = this.currentUser();
    if (user) {
      this.demoBridge.adoptApiUser(user);
    } else {
      void this.router.navigate(['/login']);
    }
  }

  onLogout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
