import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { LanguageService } from './core/services/language.service';
// تأكد إن المسار ده سليم مية في المية
import { HeaderComponent } from './shared/components/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  // لازم الهيدر يكون موجود هنا عشان الـ HTML يشوفه
  imports: [RouterOutlet, HeaderComponent],
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
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  protected readonly isScopedLayoutRoute = computed(() => {
    const path = this.currentUrl().split('?')[0].toLowerCase();
    // بنخفيه بس في صفحات الدخول والتسجيل
    return path.includes('/auth/login') || path.includes('/auth/register') || path === '/auth';
  });
}