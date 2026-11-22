import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { authErrorMessage } from '../../core/auth/auth-messages';
import { AuthService, DEMO_PASSWORD } from '../../core/auth/auth.service';
import { DEMO_ACCOUNTS } from '../../core/auth/demo-accounts';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.html',
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Query params: pagina la care voia să ajungă utilizatorul și motivul trimiterii la login. */
  readonly returnUrl = input<string>();
  readonly reason = input<string>();

  readonly demoAccounts = DEMO_ACCOUNTS;
  readonly demoPassword = DEMO_PASSWORD;
  readonly errorMessage = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const { email, password } = this.loginForm.getRawValue();
    this.signIn(email, password);
  }

  onDemoLogin(email: string): void {
    this.loginForm.setValue({ email, password: DEMO_PASSWORD });
    this.signIn(email, DEMO_PASSWORD);
  }

  private signIn(email: string, password: string): void {
    this.errorMessage.set(null);
    this.submitting.set(true);
    this.auth.login(email, password).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl(this.safeReturnUrl());
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(authErrorMessage(err));
      },
    });
  }

  /** Doar rute interne, ca un link `?returnUrl=https://...` să nu poată trimite în afara aplicației. */
  private safeReturnUrl(): string {
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') ? url : '/search';
  }
}
