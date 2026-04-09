import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  animate,
  keyframes,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { Router } from '@angular/router';

import { NotificationStore } from '../../../core/state/notification.store';
import { SignalrService } from '../../../core/services/signalr.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('bellShake', [
      state('idle', style({ transform: 'rotate(0deg)' })),
      state('shake', style({ transform: 'rotate(0deg)' })),
      transition('idle => shake', [
        animate(
          '640ms cubic-bezier(0.36, 0.07, 0.19, 0.97)',
          keyframes([
            style({ transform: 'rotate(0deg)', offset: 0 }),
            style({ transform: 'rotate(-9deg)', offset: 0.16 }),
            style({ transform: 'rotate(8deg)', offset: 0.32 }),
            style({ transform: 'rotate(-6deg)', offset: 0.48 }),
            style({ transform: 'rotate(3deg)', offset: 0.68 }),
            style({ transform: 'rotate(0deg)', offset: 1 }),
          ]),
        ),
      ]),
    ]),
  ],
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class NotificationBellComponent implements OnInit {
  protected readonly store = inject(NotificationStore);
  protected readonly signalr = inject(SignalrService);
  protected readonly lang = inject(LanguageService);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected readonly isOpen = signal(false);
  protected readonly bellState = signal<'idle' | 'shake'>('idle');

  protected readonly unreadCount = this.store.unreadCount;
  protected readonly notifications = computed(() => this.store.notifications().slice(0, 8));

  private previousTopNotificationId = '';

  constructor() {
    effect(() => {
      const top = this.store.notifications()[0];

      if (!top) {
        this.previousTopNotificationId = '';
        return;
      }

      if (this.previousTopNotificationId && this.previousTopNotificationId !== top.id) {
        this.triggerBellShake();
      }

      this.previousTopNotificationId = top.id;
    });

    this.destroyRef.onDestroy(() => {
      this.bellState.set('idle');
    });
  }

  async ngOnInit(): Promise<void> {
    await this.store.loadFromApi();
    await this.signalr.startConnection();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.isOpen.set(false);
    }
  }

  protected togglePopover(): void {
    this.isOpen.update((current) => !current);
  }

  protected async onNotificationClick(id: string, targetLink: string): Promise<void> {
    await this.store.markAsRead(id);
    this.isOpen.set(false);
    await this.router.navigateByUrl(targetLink || '/host/bookings');
  }

  protected async markAllAsRead(): Promise<void> {
    const unread = this.store.notifications().filter((item) => !item.isRead);
    await Promise.all(unread.map((item) => this.store.markAsRead(item.id)));
  }

  protected relativeTime(isoDate: string): string {
    const now = Date.now();
    const timestamp = new Date(isoDate).getTime();

    if (Number.isNaN(timestamp)) {
      return this.t('الان', 'now');
    }

    const deltaSeconds = Math.max(1, Math.floor((now - timestamp) / 1000));
    const rtf = new Intl.RelativeTimeFormat(this.lang.currentLang() === 'ar' ? 'ar' : 'en', {
      numeric: 'auto',
    });

    if (deltaSeconds < 60) {
      return rtf.format(-deltaSeconds, 'second');
    }

    const minutes = Math.floor(deltaSeconds / 60);
    if (minutes < 60) {
      return rtf.format(-minutes, 'minute');
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return rtf.format(-hours, 'hour');
    }

    const days = Math.floor(hours / 24);
    return rtf.format(-days, 'day');
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  private triggerBellShake(): void {
    this.bellState.set('shake');
    setTimeout(() => {
      this.bellState.set('idle');
    }, 660);
  }
}
