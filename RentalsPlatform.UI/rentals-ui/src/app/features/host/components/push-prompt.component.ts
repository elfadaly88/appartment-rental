import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PushNotificationService } from '../../../core/services/push-notification.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-push-prompt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './push-prompt.component.html',
  styleUrl: './push-prompt.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PushPromptComponent {
  protected readonly pushService = inject(PushNotificationService);
  protected readonly lang = inject(LanguageService);

  private readonly dismissed = signal(this.loadDismissedState());
  protected readonly denied = signal(false);

  protected readonly isVisible = computed(
    () =>
      !this.dismissed() &&
      this.pushService.isSupported() &&
      this.pushService.permissionState() !== 'granted',
  );

  protected readonly subtitle = computed(() => {
    if (this.pushService.permissionState() === 'denied' || this.denied()) {
      return this.t(
        'تم رفض الإذن. يمكنك التفعيل من إعدادات المتصفح لاحقا.',
        'Permission is blocked. You can enable notifications later from browser settings.',
      );
    }

    return this.t(
      'لا تفوت أي حجز. احصل على تنبيهات فورية على جهازك.',
      'Never miss a booking. Get instant alerts on your device.',
    );
  });

  protected async turnOn(): Promise<void> {
    const result = await this.pushService.requestPermissionAndSubscribe();

    if (result === 'subscribed') {
      this.dismissed.set(true);
      this.saveDismissedState(true);
      return;
    }

    if (result === 'denied') {
      this.denied.set(true);
    }
  }

  protected notNow(): void {
    this.dismissed.set(true);
    this.saveDismissedState(true);
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  private loadDismissedState(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    return localStorage.getItem('host.pushPrompt.dismissed') === '1';
  }

  private saveDismissedState(value: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem('host.pushPrompt.dismissed', value ? '1' : '0');
  }
}
