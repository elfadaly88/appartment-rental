import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../../core/state/auth.store';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-host-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './host-layout.component.html',
  styleUrl: './host-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class HostLayoutComponent {
  protected readonly lang = inject(LanguageService);
  private readonly authStore = inject(AuthStore);

  // ── UI state ────────────────────────────────────────────────
  protected readonly isMenuOpen = signal(false);
  protected readonly isRtl = computed(() => this.lang.dir() === 'rtl');

  // ── Tab navigation ───────────────────────────────────────────
  protected readonly navItems = computed(() => [
    {
      path: '/host/dashboard',
      label: this.t('نظرة عامة', 'Overview'),
      icon: '📊',
      exact: true,
    },
    {
      path: '/host/bookings',
      label: this.t('الحجوزات', 'Bookings'),
      icon: '📅',
      exact: false,
    },
    {
      path: '/host/block-dates',
      label: this.t('حظر التواريخ', 'Block Dates'),
      icon: '🚫',
      exact: false,
    },
    {
      path: '/profile',
      label: this.t('الملف الشخصي', 'Profile'),
      icon: '👤',
      exact: false,
    },
  ]);

  // ── Methods ──────────────────────────────────────────────────
  protected toggleMenu(): void {
    this.isMenuOpen.update((s) => !s);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}