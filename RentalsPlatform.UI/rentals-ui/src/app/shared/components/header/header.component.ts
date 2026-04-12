import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule, NotificationBellComponent],
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected readonly authService = inject(AuthService);
  protected readonly lang = inject(LanguageService);
  private readonly router = inject(Router);

  protected readonly userName = computed(() =>
    this.authService.currentUser()?.displayName ||
    this.authService.currentUser()?.fullName ||
    this.authService.currentUser()?.email ||
    'Guest',
  );

  protected readonly toggleLabel = computed(() =>
    this.lang.currentLang() === 'ar' ? 'EN' : 'عربي',
  );

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/auth']);
  }
}
