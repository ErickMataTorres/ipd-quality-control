import {
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly hidePassword = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');

  readonly loginForm = this.formBuilder.nonNullable.group({
    employeeNumber: [
      '',
      [
        Validators.required,
        Validators.pattern(/^[0-9]+$/),
      ],
    ],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(6),
      ],
    ],
  });

  togglePasswordVisibility(): void {
    this.hidePassword.update(
      currentValue => !currentValue,
    );
  }

  async submit(): Promise<void> {
    if (this.loginForm.invalid || this.isSubmitting()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.isSubmitting.set(true);

    const {
      employeeNumber,
      password,
    } = this.loginForm.getRawValue();

    try {
      await this.authService.signIn(
        employeeNumber,
        password,
      );

      const returnUrl =
        this.activatedRoute.snapshot.queryParamMap.get(
          'returnUrl',
        ) ?? '/dashboard';

      await this.router.navigateByUrl(returnUrl);
    } catch (error: unknown) {
      this.errorMessage.set(
        this.translateAuthenticationError(error),
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private translateAuthenticationError(
    error: unknown,
  ): string {
    const message =
      error instanceof Error
        ? error.message
        : '';

    if (
      message
        .toLowerCase()
        .includes('invalid login credentials')
    ) {
      return 'El número de reloj o la contraseña no son correctos.';
    }

    if (
      message
        .toLowerCase()
        .includes('email not confirmed')
    ) {
      return 'La cuenta todavía no ha sido confirmada.';
    }

    return 'No fue posible iniciar sesión. Verifica tus datos e inténtalo nuevamente.';
  }
}
