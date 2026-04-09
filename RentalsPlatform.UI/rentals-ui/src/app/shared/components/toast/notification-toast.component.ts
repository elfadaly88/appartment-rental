import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { LanguageService } from '../../../core/services/language.service';
import {
  RealtimeNotification,
  SignalrService,
} from '../../../core/services/signalr.service';

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notification-toast.component.html',
  styleUrl: './notification-toast.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
    '[style.--toast-inline-offset]': "lang.currentLang() === 'ar' ? '-24px' : '24px'",
  },
})
export class NotificationToastComponent implements OnInit {
  protected readonly signalr = inject(SignalrService);
  protected readonly lang = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly leavingIds = signal<Set<string>>(new Set<string>());
  private readonly scheduledDismissals = new Map<string, ReturnType<typeof setTimeout>>();

  protected readonly notifications = this.signalr.notifications;

  protected readonly toastViewModels = computed(() =>
    this.notifications().map((item) => ({
      ...item,
      leaving: this.leavingIds().has(item.id),
      guestLabel:
        item.guestName ||
        this.t('ضيف جديد', 'New guest'),
      propertyLabel:
        item.propertyName ||
        this.t('عقار مميز', 'Premium property'),
      body:
        item.message ||
        item.title ||
        this.t('تم استلام إشعار جديد.', 'A new notification has arrived.'),
    })),
  );

  constructor() {
    effect(() => {
      for (const item of this.notifications()) {
        this.scheduleAutoDismiss(item.id);
      }
    });

    this.destroyRef.onDestroy(() => {
      for (const timer of this.scheduledDismissals.values()) {
        clearTimeout(timer);
      }
      this.scheduledDismissals.clear();
    });
  }

  ngOnInit(): void {
    void this.signalr.startConnection();
  }

  protected dismiss(id: string): void {
    if (!this.leavingIds().has(id)) {
      this.leavingIds.update((current) => {
        const next = new Set(current);
        next.add(id);
        return next;
      });
    }

    const existing = this.scheduledDismissals.get(id);
    if (existing) {
      clearTimeout(existing);
      this.scheduledDismissals.delete(id);
    }

    const removeTimer = setTimeout(() => {
      this.signalr.removeNotification(id);
      this.leavingIds.update((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      this.scheduledDismissals.delete(id);
    }, 280);

    this.scheduledDismissals.set(id, removeTimer);
  }

  protected trackById(_index: number, item: RealtimeNotification): string {
    return item.id;
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  private scheduleAutoDismiss(id: string): void {
    if (this.scheduledDismissals.has(id)) {
      return;
    }

    const timer = setTimeout(() => {
      this.dismiss(id);
    }, 5000);

    this.scheduledDismissals.set(id, timer);
  }
}
