import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TranslateModule } from '@ngx-translate/core'; // 👈 ضروري
import { LanguageService } from '../../core/services/language.service'; // مسار السيرفيس بتاعك
type AuthView = 'login' | 'register';
type RegisterRole = 'guest' | 'host';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [ReactiveFormsModule,TranslateModule],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPageComponent {
  langService = inject(LanguageService); // حقن السيرفيس
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly view = signal<AuthView>('login');
  readonly registerRole = signal<RegisterRole>('guest');
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly registerForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    acceptedHostTerms: [false],
  });

  constructor() {
    effect(() => {
      if (this.authService.isAuthenticated()) {
        if (this.authService.isAdmin()) {
          this.router.navigateByUrl('/admin/dashboard').catch(() => {});
        } else if (this.authService.isHost()) {
          this.router.navigateByUrl('/host/dashboard').catch(() => {});
        } else {
          this.router.navigateByUrl('/properties').catch(() => {});
        }
        return;
      }

      const hostTermsControl = this.registerForm.controls.acceptedHostTerms;
      if (this.registerRole() === 'host') {
        hostTermsControl.addValidators(Validators.requiredTrue);
      } else {
        hostTermsControl.clearValidators();
        hostTermsControl.setValue(false, { emitEvent: false });
      }
      hostTermsControl.updateValueAndValidity({ emitEvent: false });
    });
  }

  switchView(nextView: AuthView): void {
    if (this.isSubmitting()) {
      return;
    }

    this.view.set(nextView);
    this.submitError.set(null);
  }

  switchRole(role: RegisterRole): void {
    if (this.isSubmitting()) {
      return;
    }

    this.registerRole.set(role);
    this.submitError.set(null);
  }

  async submit(): Promise<void> {
    this.submitError.set(null);

    if (this.view() === 'login') {
      await this.submitLogin();
      return;
    }

    await this.submitRegister();
  }

  fieldHasError(form: 'login' | 'register', field: string): boolean {
    const control = this.resolveControl(form, field);
    return !!control && control.touched && control.invalid;
  }

  fieldErrorText(form: 'login' | 'register', field: string): string {
    const control = this.resolveControl(form, field);

    if (!control?.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'AUTH.ERROR_REQUIRED';
    }

    if (control.errors['email']) {
      return 'AUTH.ERROR_EMAIL';
    }

    if (control.errors['minlength']) {
      return 'AUTH.ERROR_MINLENGTH';
    }

    if (control.errors['requiredTrue']) {
      return 'AUTH.ERROR_TERMS';
    }

    return 'AUTH.ERROR_FALLBACK';
  }

  fieldErrorParams(form: 'login' | 'register', field: string): Record<string, unknown> {
    const control = this.resolveControl(form, field);
    if (control?.errors?.['minlength']) {
      return { requiredLength: control.errors['minlength']['requiredLength'] as number };
    }
    return {};
  }

  private resolveControl(form: 'login' | 'register', field: string): AbstractControl | null {
    if (form === 'login') {
      return this.loginForm.controls[field as keyof typeof this.loginForm.controls] ?? null;
    }

    return this.registerForm.controls[field as keyof typeof this.registerForm.controls] ?? null;
  }

  private async submitLogin(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    try {
      await this.authService.login(this.loginForm.getRawValue());
      await this.router.navigateByUrl('/properties');
    } catch {
      this.submitError.set('Unable to sign in. Please check your credentials.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private async submitRegister(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    try {
      const payload = this.registerForm.getRawValue();
      if (this.registerRole() === 'host') {
        await this.authService.registerHost(payload);
        await this.router.navigateByUrl('/host/dashboard');
      } else {
        await this.authService.registerGuest({
          fullName: payload.fullName,
          email: payload.email,
          password: payload.password,
        });
        await this.router.navigateByUrl('/properties');
      }
    } catch {
      this.submitError.set('Unable to create your account right now. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
