import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemoAuthService } from '../../core/services';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register-page.html',
})
export class RegisterPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(DemoAuthService);
  private readonly router = inject(Router);

  readonly neighborhoods = this.auth.neighborhoods;
  readonly errorMessage = signal<string | null>(null);

  readonly registerForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    neighborhood: ['Centru', [Validators.required]],
    consentAccepted: [false, [Validators.requiredTrue]],
  });

  onSubmit(): void {
    this.errorMessage.set(null);
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const res = this.auth.register(this.registerForm.getRawValue());
    if (res.ok) {
      void this.router.navigate(['/profile']);
    } else {
      this.errorMessage.set(res.error ?? 'Could not create demo account.');
    }
  }
}
