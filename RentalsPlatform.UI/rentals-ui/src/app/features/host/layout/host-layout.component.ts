import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  protected readonly isMenuOpen = signal(false);
  protected readonly isRtl = computed(() => this.lang.dir() === 'rtl');
  protected readonly userEmail = computed(() => this.authStore.currentUser()?.email ?? 'host@local.com');
  protected readonly userDisplayName = computed(() => this.authStore.currentUser()?.displayName ?? this.authStore.currentUser()?.email ?? 'host@local.com');
  protected readonly userAvatar = computed(() => this.authStore.currentUser()?.avatarUrl);

  protected readonly navItems = computed(() => [
    { path: '/host/dashboard', label: this.t('نظرة عامة', 'Overview') },
    { path: '/host/properties/new', label: this.t('إضافة عقار', 'Add Property') },
    { path: '/host/bookings', label: this.t('الحجوزات', 'Bookings') },
    { path: '/host/block-dates', label: this.t('حظر التواريخ', 'Block Dates') },
    { path: '/profile', label: this.t('الملف الشخصي', 'Profile') },
  ]);

  protected readonly languageLabel = computed(() => this.t('عربي', 'EN'));

  protected toggleMenu(): void {
    this.isMenuOpen.update((state) => !state);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected toggleLanguage(): void {
    this.lang.toggleLanguage();
  }

  protected logout(): void {
    this.closeMenu();
    this.authStore.logout();
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}