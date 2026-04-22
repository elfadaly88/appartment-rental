import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  PLATFORM_ID,
  NgZone,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { LandingService, FeaturedProperty, FeaturedPropertiesResult } from './landing.service';
import { LandingStats } from './landing-stats.model';
import { LanguageService } from '../../core/services/language.service';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, SafeHtmlPipe],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit, OnDestroy {
  // ─── DI ─────────────────────────────────────────────────────────────────
  private readonly landingService  = inject(LandingService);
  private readonly translate       = inject(TranslateService);
  private readonly langService     = inject(LanguageService);
  private readonly titleService    = inject(Title);
  private readonly metaService     = inject(Meta);
  private readonly router          = inject(Router);
  private readonly platformId      = inject(PLATFORM_ID);
  private readonly zone            = inject(NgZone);

  // ─── Static data ─────────────────────────────────────────────────────────
  readonly features = [
    {
      key: 'VERIFIED',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    },
    {
      key: 'SUPPORT',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0z"/></svg>`,
    },
    {
      key: 'INSTANT',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>`,
    },
    {
      key: 'SECURE',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    },
  ];

  // ─── State (Signals) ────────────────────────────────────────────────────
  readonly stats     = signal<LandingStats | null>(null);
  readonly isLoading = signal(true);
  readonly hasError  = signal(false);

  /** Animated display values */
  readonly displayClients      = signal(0);
  readonly displayUnits        = signal(0);
  readonly displayTransactions = signal(0);

  readonly currentLang = computed(() => this.langService.currentLang());
  readonly dir         = computed(() => this.langService.dir());

  // ─── Featured Properties ─────────────────────────────────────────────────
  readonly featuredProperties  = signal<FeaturedProperty[]>([]);
  readonly featuredTotalCount  = signal(0);
  readonly featuredPage        = signal(1);
  readonly featuredPageSize    = 12;
  readonly availableCities     = signal<string[]>([]);
  readonly selectedCity        = signal<string>('');
  readonly featuredLoading     = signal(false);

  readonly totalPages = computed(() =>
    Math.ceil(this.featuredTotalCount() / this.featuredPageSize)
  );

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  // ─── Internal ────────────────────────────────────────────────────────────
  private langSub?: Subscription;
  private observer?: IntersectionObserver;
  private statsAnimated = false;

  // ─── Lifecycle ───────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.updateSeoTags();
    this.langSub = this.translate.onLangChange.subscribe(() => this.updateSeoTags());

    this.landingService.getLandingStats().subscribe({
      next: data => {
        this.stats.set(data);
        this.isLoading.set(false);
        if (isPlatformBrowser(this.platformId)) {
          this.setupIntersectionObserver();
        }
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });

    this.loadFeaturedProperties();

    if (isPlatformBrowser(this.platformId)) {
      this.setupScrollReveal();
    }
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.observer?.disconnect();
  }

  // ─── Featured Properties ─────────────────────────────────────────────────
  loadFeaturedProperties(): void {
    this.featuredLoading.set(true);
    this.landingService
      .getFeaturedProperties(this.selectedCity() || undefined, this.featuredPage(), this.featuredPageSize)
      .subscribe({
        next: (result: FeaturedPropertiesResult) => {
          this.featuredProperties.set(result.items);
          this.featuredTotalCount.set(result.totalCount);
          this.availableCities.set(result.availableCities);
          this.featuredLoading.set(false);
        },
        error: () => this.featuredLoading.set(false),
      });
  }

  filterByCity(city: string): void {
    this.selectedCity.set(city);
    this.featuredPage.set(1);
    this.loadFeaturedProperties();
  }

  goToPage(page: number): void {
    this.featuredPage.set(page);
    this.loadFeaturedProperties();
  }

  formatPrice(price: number, currency: string): string {
    return new Intl.NumberFormat('en-EG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
  }

  // ─── Navigation ──────────────────────────────────────────────────────────
  navigateToProperties(): void {
    this.router.navigate(['/properties']);
  }

  // ─── SEO ─────────────────────────────────────────────────────────────────
  private updateSeoTags(): void {
    const lang = this.translate.currentLang ?? 'en';

    const isAr = lang === 'ar';

    const title       = isAr ? 'لوكس للإيجار — إقامات فاخرة لا تُنسى'
                              : 'Luxe Rentals — Unforgettable Luxury Stays';
    const description = isAr
      ? 'اكتشف أفخم العقارات المعتمدة في مصر. احجز إقامة فاخرة بثقة مع لوكس للإيجار.'
      : 'Discover Egypt\'s finest approved luxury properties. Book with confidence on Luxe Rentals.';
    const keywords = isAr
      ? 'إيجار فاخر, شقق مفروشة, عقارات مصر, حجز فيلا, فنادق فاخرة'
      : 'luxury rentals, furnished apartments, Egypt properties, villa booking, premium stays';

    this.titleService.setTitle(title);
    this.metaService.updateTag({ name: 'description', content: description });
    this.metaService.updateTag({ name: 'keywords', content: keywords });
    this.metaService.updateTag({ property: 'og:title', content: title });
    this.metaService.updateTag({ property: 'og:description', content: description });
    this.metaService.updateTag({ property: 'og:type', content: 'website' });
    this.metaService.updateTag({ property: 'og:locale', content: isAr ? 'ar_EG' : 'en_US' });
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: title });
    this.metaService.updateTag({ name: 'twitter:description', content: description });
  }

  // ─── Counter Animation ───────────────────────────────────────────────────
  private setupIntersectionObserver(): void {
    const statsEl = document.getElementById('stats-section');
    if (!statsEl) return;

    this.observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !this.statsAnimated) {
          this.statsAnimated = true;
          const data = this.stats();
          if (data) {
            this.animateCounter(this.displayClients,      data.totalClients,       1800);
            this.animateCounter(this.displayUnits,        data.luxuryUnits,        2000);
            this.animateCounter(this.displayTransactions, data.annualTransactions, 2200);
          }
          this.observer?.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    this.observer.observe(statsEl);
  }

  private animateCounter(
    sig: ReturnType<typeof signal<number>>,
    target: number,
    durationMs: number
  ): void {
    if (target === 0) { sig.set(0); return; }
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      this.zone.run(() => sig.set(Math.round(eased * target)));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ─── Scroll-Reveal ───────────────────────────────────────────────────────
  private setupScrollReveal(): void {
    const revealObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  }
}
