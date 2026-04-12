import { Component, computed, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from './core/services/language.service';
import { AuthService } from './core/auth/auth.service';
import { NotificationBellComponent } from './shared/components/notification-bell/notification-bell.component';
import { filter, map, startWith } from 'rxjs/operators';
import { HeaderComponent } from './shared/components/header/header.component';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HeaderComponent,NotificationBellComponent, TranslateModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class App {
  protected readonly lang = inject(LanguageService);
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly isMenuOpen = signal(false);
  protected readonly userEmail = computed(() => this.authService.currentUser()?.email ?? 'host@local.com');
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly isScopedLayoutRoute = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/host');
  });

  protected readonly toggleLabel = () =>
    this.lang.currentLang() === 'ar' ? 'EN' : 'عربي';

  protected toggleMenu(): void {
    this.isMenuOpen.update((value) => !value);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected logout(): void {
    this.closeMenu();
    this.authService.logout();
    void this.router.navigate(['/auth']);
  }
}
