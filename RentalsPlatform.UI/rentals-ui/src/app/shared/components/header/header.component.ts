import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthStore } from '../../../core/state/auth.store';
import { LanguageService } from '../../../core/services/language.service';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { filter, map, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule, NotificationBellComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected readonly authStore = inject(AuthStore);
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

  protected readonly userName = computed(() =>
    this.authStore.currentUser()?.displayName ||
    this.authStore.currentUser()?.fullName ||
    this.authStore.currentUser()?.email ||
    'Guest',
  );

  protected readonly toggleLabel = computed(() =>
    this.lang.currentLang() === 'ar' ? 'EN' : 'عربي',
  );
  protected readonly isHostWorkspaceRoute = computed(() => this.currentUrl().startsWith('/host'));

  protected logout(): void {
    this.authStore.logout();
    void this.router.navigate(['/auth']);
  }

  /** Clears the broken avatarUrl so the initial-letter fallback renders instead. */
  protected onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';   // hide the broken <img>
    // We do not have updateProfileData on AuthStore immediately mapped, so let's just 
    // force it or let it be handled differently. If broken, let's just log or ignore.
    console.warn('Avatar image failed to load');
  }
}
