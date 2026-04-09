import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { LanguageService } from '../../../core/services/language.service';

export interface PropertyReviewDto {
  id: string;
  guestName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface PropertyReviewStatsDto {
  averageRating: number;
  totalReviews: number;
  reviews: PropertyReviewDto[];
}

const PAGE_SIZE = 5;

@Component({
  selector: 'app-property-reviews-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './property-reviews-widget.component.html',
  styleUrl: './property-reviews-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PropertyReviewsWidgetComponent implements OnInit {
  protected readonly http = inject(HttpClient);
  protected readonly lang = inject(LanguageService);

  protected readonly stats = signal<PropertyReviewStatsDto | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly currentPage = signal(1);

  protected readonly paginatedReviews = computed(() => {
    const allReviews = this.stats()?.reviews ?? [];
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return allReviews.slice(start, start + PAGE_SIZE);
  });

  protected readonly totalPages = computed(() => {
    const total = this.stats()?.totalReviews ?? 0;
    return Math.ceil(total / PAGE_SIZE);
  });

  protected readonly averageRating = computed(() => {
    const avg = this.stats()?.averageRating ?? 0;
    return avg.toFixed(1);
  });

  protected readonly hasNextPage = computed(() => this.currentPage() < this.totalPages());
  protected readonly hasPreviousPage = computed(() => this.currentPage() > 1);

  ngOnInit(): void {
    this.loadReviews();
  }

  protected async loadReviews(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const data = await firstValueFrom(
        this.http
          .get<PropertyReviewStatsDto>(`${environment.apiUrl}/properties/me/reviews/stats`)
          .pipe(catchError(() => of({ averageRating: 0, totalReviews: 0, reviews: [] }))),
      );

      this.stats.set(data);
    } catch (err) {
      this.error.set(this.t('فشل تحميل التقييمات', 'Failed to load reviews'));
      console.error('[PropertyReviewsWidgetComponent]', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected nextPage(): void {
    if (this.hasNextPage()) {
      this.currentPage.update(p => p + 1);
    }
  }

  protected previousPage(): void {
    if (this.hasPreviousPage()) {
      this.currentPage.update(p => p - 1);
    }
  }

  protected goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  protected renderStars(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1).map(() => 1);
  }

  protected getFilledStars(rating: number): number {
    return Math.floor(rating);
  }

  protected formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return this.t('اليوم', 'Today');
    } else if (diffDays === 1) {
      return this.t('أمس', 'Yesterday');
    } else if (diffDays < 7) {
      return this.t(`قبل ${diffDays} أيام`, `${diffDays} days ago`);
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return this.t(`قبل ${weeks} أسابيع`, `${weeks} weeks ago`);
    } else {
      return d.toLocaleDateString(this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}
