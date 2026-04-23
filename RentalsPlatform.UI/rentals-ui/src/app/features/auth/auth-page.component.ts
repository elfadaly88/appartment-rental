import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, Injector, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { startWith } from 'rxjs/operators';
import { FacebookLoginProvider, SocialAuthService } from '@abacritt/angularx-social-login';
import { GoogleAuthService } from '../../core/auth/google-auth.service';
import { AuthService } from '../../core/auth/auth.service';
import { TranslateModule } from '@ngx-translate/core'; // 👈 ضروري
import { LanguageService } from '../../core/services/language.service'; // مسار السيرفيس بتاعك
import { HostTermsModalComponent } from './host-terms-modal.component';
type AuthView = 'login' | 'register';
type RegisterRole = 'guest' | 'host';
type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';
type SocialProvider = 'google' | 'facebook';

const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

interface PasswordRule {
  key: 'minLength' | 'uppercase' | 'number' | 'special';
  translationKey: string;
  test: (value: string) => boolean;
}

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, HostTermsModalComponent],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPageComponent {
  langService = inject(LanguageService); // حقن السيرفيس
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly googleAuthService = inject(GoogleAuthService);
  private readonly passwordRules: PasswordRule[] = [
    {
      key: 'minLength',
      translationKey: 'AUTH.PASSWORD_RULE_MIN_LENGTH',
      test: (value) => value.length >= 8,
    },
    {
      key: 'uppercase',
      translationKey: 'AUTH.PASSWORD_RULE_UPPERCASE',
      test: (value) => /[A-Z]/.test(value),
    },
    {
      key: 'number',
      translationKey: 'AUTH.PASSWORD_RULE_NUMBER',
      test: (value) => /\d/.test(value),
    },
    {
      key: 'special',
      translationKey: 'AUTH.PASSWORD_RULE_SPECIAL',
      test: (value) => /[^A-Za-z0-9]/.test(value),
    },
  ];

  readonly view = signal<AuthView>('login');
  readonly registerRole = signal<RegisterRole>('guest');
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly registerSubmitAttempted = signal(false);
  readonly isHostTermsModalOpen = signal(false);
  readonly loginPasswordVisible = signal(false);
  readonly registerPasswordVisible = signal(false);
  readonly socialProviderPending = signal<SocialProvider | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly registerForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(PASSWORD_POLICY_REGEX)]],
    acceptedHostTerms: [false],
  });

  readonly registerPasswordValue = signal(this.registerForm.controls.password.value ?? '');
  readonly acceptedHostTermsValue = signal(!!this.registerForm.controls.acceptedHostTerms.value);

  readonly passwordRequirements = computed(() => {
    const passwordValue = this.registerPasswordValue() ?? '';

    return this.passwordRules.map((rule) => {
      const isMet = rule.test(passwordValue);
      return {
        key: rule.key,
        translationKey: rule.translationKey,
        isMet,
        state: isMet ? 'success' : 'pending',
      };
    });
  });

  readonly metPasswordRulesCount = computed(() => this.passwordRequirements().filter((rule) => rule.isMet).length);
  readonly allPasswordRequirementsMet = computed(() => this.metPasswordRulesCount() === this.passwordRules.length);
  readonly passwordStrengthLevel = computed<PasswordStrengthLevel>(() => {
    const score = this.metPasswordRulesCount();
    if (score <= 1) {
      return 'weak';
    }

    if (score <= 3) {
      return 'medium';
    }

    return 'strong';
  });
  readonly passwordStrengthLabelKey = computed(() => {
    const level = this.passwordStrengthLevel();
    if (level === 'strong') {
      return 'AUTH.PASSWORD_STRENGTH_STRONG';
    }

    if (level === 'medium') {
      return 'AUTH.PASSWORD_STRENGTH_MEDIUM';
    }

    return 'AUTH.PASSWORD_STRENGTH_WEAK';
  });
  readonly passwordStrengthProgress = computed(() => (this.metPasswordRulesCount() / this.passwordRules.length) * 100);
  readonly isBusy = computed(() => this.isSubmitting() || this.socialProviderPending() !== null);

  // 3-Step Validation for Register Button
  readonly isFormValid = computed(() => this.registerForm.valid);
  readonly isPasswordStrong = computed(() => this.allPasswordRequirementsMet());
  readonly hasAcceptedTerms = computed(() => this.registerRole() === 'guest' || this.hostTermsAccepted());

  readonly isRegisterSubmitDisabled = computed(
    () =>
      this.isSubmitting() ||
      !this.isFormValid() ||
      !this.isPasswordStrong() ||
      !this.hasAcceptedTerms(),
  );

  readonly registerButtonState = computed(() => {
    if (this.isSubmitting()) return 'submitting';
    if (!this.isFormValid()) return 'pending';
    if (!this.isPasswordStrong()) return 'pending';
    if (this.registerRole() === 'host' && !this.hostTermsAccepted()) return 'pending-terms';
    return 'active';
  });

  readonly showRegisterPasswordError = computed(() => {
    const control = this.registerForm.controls.password;
    return this.registerSubmitAttempted() && control.invalid;
  });
  readonly hostTermsAccepted = computed(() => !!this.acceptedHostTermsValue());

  constructor() {
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.navigateAfterAuth().catch(() => {});
        return;
      }

      const hostTermsControl = this.registerForm.controls.acceptedHostTerms;
      if (this.registerRole() === 'host') {
        hostTermsControl.addValidators(Validators.requiredTrue);
      } else {
        hostTermsControl.clearValidators();
        hostTermsControl.setValue(false, { emitEvent: false });
        this.acceptedHostTermsValue.set(false);
      }
      hostTermsControl.updateValueAndValidity({ emitEvent: false });
    });

    this.registerForm.controls.password.valueChanges
      .pipe(startWith(this.registerForm.controls.password.value), takeUntilDestroyed())
      .subscribe((value) => this.registerPasswordValue.set(value ?? ''));

    this.registerForm.controls.acceptedHostTerms.valueChanges
      .pipe(startWith(this.registerForm.controls.acceptedHostTerms.value), takeUntilDestroyed())
      .subscribe((value) => this.acceptedHostTermsValue.set(!!value));
  }

  switchView(nextView: AuthView): void {
    if (this.isBusy()) {
      return;
    }

    this.view.set(nextView);
    this.submitError.set(null);
    this.registerSubmitAttempted.set(false);
    this.isHostTermsModalOpen.set(false);
  }

  switchRole(role: RegisterRole): void {
    if (this.isBusy()) {
      return;
    }

    this.registerRole.set(role);
    this.submitError.set(null);
    this.isHostTermsModalOpen.set(false);
  }

  toggleRegisterPasswordVisibility(): void {
    this.registerPasswordVisible.update((current) => !current);
  }

  toggleLoginPasswordVisibility(): void {
    this.loginPasswordVisible.update((current) => !current);
  }

  openHostTermsModal(): void {
    this.isHostTermsModalOpen.set(true);
  }

  closeHostTermsModal(): void {
    this.isHostTermsModalOpen.set(false);
  }

  acceptHostTerms(): void {
    const control = this.registerForm.controls.acceptedHostTerms;
    control.setValue(true);
    control.markAsTouched();
    control.updateValueAndValidity();
    this.isHostTermsModalOpen.set(false);
  }

  revokeHostTerms(): void {
    const control = this.registerForm.controls.acceptedHostTerms;
    control.setValue(false);
    control.markAsTouched();
    control.updateValueAndValidity();
  }

  t(ar: string, en: string): string {
    return this.langService.currentLang() === 'ar' ? ar : en;
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

    if (control.errors['pattern']) {
      return 'AUTH.ERROR_PASSWORD_POLICY';
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
      await this.navigateAfterAuth();
    } catch {
      this.submitError.set('Unable to sign in. Please check your credentials.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private async submitRegister(): Promise<void> {
    this.registerSubmitAttempted.set(true);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    try {
      const payload = this.registerForm.getRawValue();
      if (this.registerRole() === 'host') {
        await this.authService.registerHost(payload);
      } else {
        await this.authService.registerGuest({
          fullName: payload.fullName,
          email: payload.email,
          password: payload.password,
        });
      }

      await this.navigateAfterAuth();
    } catch {
      this.submitError.set('Unable to create your account right now. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async socialSignIn(provider: SocialProvider): Promise<void> {
    if (!this.isBrowser || this.isBusy()) {
      return;
    }

    if (this.view() === 'register' && this.registerRole() === 'host' && !this.hostTermsAccepted()) {
      this.registerForm.controls.acceptedHostTerms.markAsTouched();
      this.submitError.set(this.t('يجب قبول شروط الاستضافة قبل المتابعة.', 'You must accept the host terms before continuing.'));
      this.isHostTermsModalOpen.set(true);
      return;
    }

    this.submitError.set(null);
    this.socialProviderPending.set(provider);

    try {
      if (provider === 'google') {
        await this.signInWithGoogle();
      } else {
        await this.signInWithFacebook();
      }
      await this.navigateAfterAuth();
    } catch (err) {
      console.error('[SocialSignIn] Failed:', err);
      this.submitError.set(
        this.t(
          'تعذر إكمال تسجيل الدخول الاجتماعي حالياً. حاول مرة أخرى.',
          'Unable to complete social authentication right now. Please try again.',
        ),
      );
    } finally {
      this.socialProviderPending.set(null);
    }
  }

  /** Google: uses GIS credential flow — idToken returned directly as `credential`. */
  private async signInWithGoogle(): Promise<void> {
    const idToken = await this.googleAuthService.signIn();
    await this.authService.externalLogin({
      provider: 'google',
      accessToken: idToken,   // backend also reads accessToken if idToken not present
      idToken: idToken,       // backend ValidateGoogleAsync uses this
      role: this.view() === 'register' ? this.registerRole() : 'guest',
      acceptedHostTerms: this.view() === 'register' && this.registerRole() === 'host' ? this.hostTermsAccepted() : false,
    });
  }

  /** Facebook: still uses the @abacritt library's SocialAuthService. */
  private async signInWithFacebook(): Promise<void> {
    const socialAuthService = this.resolveSocialAuthService();
    if (!socialAuthService) throw new Error('Facebook auth service not available');

    const socialUser = await socialAuthService.signIn(FacebookLoginProvider.PROVIDER_ID, {
      scope: 'email,public_profile',
      return_scopes: true,
      enable_profile_selector: true,
    });

    await this.authService.externalLogin({
      provider: 'facebook',
      accessToken: socialUser.authToken ?? '',
      idToken: socialUser.idToken ?? undefined,
      role: this.view() === 'register' ? this.registerRole() : 'guest',
      acceptedHostTerms: this.view() === 'register' && this.registerRole() === 'host' ? this.hostTermsAccepted() : false,
    });

    socialAuthService.signOut().catch(() => {});
  }

  private resolveSocialAuthService(): SocialAuthService | null {
    if (!this.isBrowser) {
      return null;
    }

    try {
      return this.injector.get<SocialAuthService>(SocialAuthService);
    } catch {
      return null;
    }
  }

  private async navigateAfterAuth(): Promise<void> {
    if (this.authService.isAdmin()) {
      try {
        await Promise.resolve();
        await this.router.navigateByUrl('/admin/dashboard');
      } catch (err) {
        console.debug('[Auth] Navigation to admin dashboard aborted or failed', err);
      }
      return;
    }

    if (this.authService.isHost()) {
      try {
        await Promise.resolve();
        await this.router.navigateByUrl('/host/dashboard');
      } catch (err) {
        console.debug('[Auth] Navigation to host dashboard aborted or failed', err);
      }
      return;
    }

    try {
      await Promise.resolve();
      await this.router.navigateByUrl('/properties');
    } catch (err) {
      console.debug('[Auth] Navigation to properties aborted or failed', err);
    }
  }
}
