import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api/api.types';
import { authErrorMessage } from '../../core/auth/auth-messages';
import { AuthService } from '../../core/auth/auth.service';
import { NEIGHBORHOODS, coordinatesOf } from '../../core/auth/neighborhoods';

type FieldName = 'firstName' | 'lastName' | 'email' | 'password';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register-page.html',
})
export class RegisterPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly neighborhoods = NEIGHBORHOODS;
  readonly errorMessage = signal<string | null>(null);
  /** Erorile de validare venite de la API, pe câmp. */
  readonly serverErrors = signal<Partial<Record<FieldName, string>>>({});
  readonly submitting = signal(false);

  readonly registerForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    // Aceleași reguli ca în backend: minim 8 caractere (maxim 72 de octeți verifică serverul).
    password: ['', [Validators.required, Validators.minLength(8)]],
    neighborhood: ['Centru', [Validators.required]],
    consentAccepted: [false, [Validators.requiredTrue]],
  });

  onSubmit(): void {
    this.errorMessage.set(null);
    this.serverErrors.set({});
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { neighborhood, consentAccepted: _consent, ...fields } = this.registerForm.getRawValue();
    this.submitting.set(true);
    this.auth
      .register({ ...fields, ...coordinatesOf(neighborhood), consentAccepted: true })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          void this.router.navigate(['/profile']);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          const apiError = ApiError.from(err);
          this.serverErrors.set({
            firstName: apiError.fieldError('firstName'),
            lastName: apiError.fieldError('lastName'),
            email:
              apiError.fieldError('email') ??
              (apiError.code === 'EMAIL_TAKEN' ? 'This email is already registered.' : undefined),
            password: apiError.fieldError('password'),
          });
          this.errorMessage.set(authErrorMessage(apiError));
        },
      });
  }
}
