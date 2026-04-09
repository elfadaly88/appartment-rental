import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthStore } from '../../../core/state/auth.store';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class LoginComponent {
  readonly redirectTo = input<string>('/properties');
  readonly loggedIn = output<void>();

  protected readonly authStore = inject(AuthStore);
  protected readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly heroImageUrl =
    'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=2000&q=80';

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await Swal.fire({
        icon: 'warning',
        title: this.t('يرجى مراجعة البيانات', 'Please review your details'),
        text: this.t(
          'تأكد من إدخال البريد الإلكتروني وكلمة المرور بشكل صحيح.',
          'Make sure your email and password are entered correctly.',
        ),
        confirmButtonText: this.t('حسناً', 'OK'),
      });
      return;
    }

    const success = await this.authStore.login(this.form.getRawValue());

    if (!success) {
      await Swal.fire({
        icon: 'error',
        title: this.t('فشل تسجيل الدخول', 'Login failed'),
        text: this.t(
          'بيانات الدخول غير صحيحة أو حدث خطأ في الخادم.',
          'Invalid credentials or a server error occurred.',
        ),
        confirmButtonText: this.t('إعادة المحاولة', 'Try again'),
      });
      return;
    }

    this.loggedIn.emit();
    await this.router.navigateByUrl(this.redirectTo());
  }
}
