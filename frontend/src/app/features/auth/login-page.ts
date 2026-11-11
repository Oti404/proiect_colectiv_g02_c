import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemoAuthService } from '../../core/services';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.html',
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(DemoAuthService);
  private readonly router = inject(Router);

  readonly demoAccounts = this.auth.demoAccounts;
  readonly errorMessage = signal<string | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['ana.pop@demo.dogapp', [Validators.required, Validators.email]],
  });

  onEnterDefaultDemo(): void {
    this.errorMessage.set(null);
    const res = this.auth.enterDemo();
    if (res.ok) {
      void this.router.navigate(['/search']);
    } else {
      this.errorMessage.set(res.error ?? 'Could not enter demo.');
    }
  }

  onEnterAsAccount(userId: string): void {
    this.errorMessage.set(null);
    const res = this.auth.enterDemo(userId);
    if (res.ok) {
      void this.router.navigate(['/search']);
    } else {
      this.errorMessage.set(res.error ?? 'Could not switch demo account.');
    }
  }

  onSubmitEmailLogin(): void {
    this.errorMessage.set(null);
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const res = this.auth.loginWithEmail(this.loginForm.getRawValue().email);
    if (res.ok) {
      void this.router.navigate(['/search']);
    } else {
      this.errorMessage.set(res.error ?? 'Demo login failed.');
    }
  }
}
