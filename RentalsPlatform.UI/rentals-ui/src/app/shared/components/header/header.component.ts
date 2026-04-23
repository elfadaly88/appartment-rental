import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { filter, map, startWith } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule, NotificationBellComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected readonly authService = inject(AuthService);
  protected readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly userName = computed(() => {
    const user = this.authService.currentUser();
    return user?.displayName || user?.fullName || user?.email || 'User';
  });

  protected readonly toggleLabel = computed(() =>
    this.lang.currentLang() === 'ar' ? 'EN' : 'عربي',
  );

  protected readonly isHostWorkspaceRoute = computed(() => this.currentUrl().startsWith('/host'));

  protected readonly isDev = computed(() => !environment.production);

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/']);
  }

  // Dev helper: set a test host JWT in localStorage and reload (for local testing)
  // Dev helpers removed for production readiness.

  /** Clears the broken avatarUrl so the initial-letter fallback renders instead. */
  protected onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';   // hide the broken <img>
    console.warn('Avatar image failed to load');
  }
}
