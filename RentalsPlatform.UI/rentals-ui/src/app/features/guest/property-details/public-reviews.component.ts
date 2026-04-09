import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  input,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { JsonLdService } from '../../../core/seo/json-ld.service';
import { LanguageService } from '../../../core/services/language.service';
import { PropertyDto } from '../../../shared/models/property.dto';
import { PropertyReviewStatsDto, PropertyReviewDto } from '../../guest/reviews/reviews.dto';

@Component({
  selector: 'app-public-reviews',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-reviews.component.html',
  styleUrl: './public-reviews.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PublicReviewsComponent implements OnInit {
  protected readonly lang = inject(LanguageService);
  protected readonly seoService = inject(JsonLdService);
  protected readonly destroyRef = inject(DestroyRef);

  // Required inputs using Angular 18 input.required()
  protected readonly property = input.required<PropertyDto>();
  protected readonly stats = input.required<PropertyReviewStatsDto>();

  // UI State
  protected readonly expandedReviewId = signal<string | null>(null);
  protected readonly hoveredReviewId = signal<string | null>(null);

  // Computed properties
  protected readonly displayReviews = computed(() => {
    const allReviews = this.stats().reviews || [];
    return allReviews.slice(0, 50); // Max 50 reviews in scroll
  });

  protected readonly avgRatingDisplay = computed(() => {
    const avg = this.stats().averageRating || 0;
    return avg.toFixed(2);
  });

  protected readonly ratingPercentage = computed(() => {
    const max = 5;
    const avg = this.stats().averageRating || 0;
    return Math.round((avg / max) * 100);
  });

  constructor() {
    // Automatically update SEO schema when inputs change
    effect(
      () => {
        const prop = this.property();
        const stat = this.stats();
        if (prop && stat) {
          this.seoService.setAccommodationSchema(prop, stat);
        }
      },
      { allowSignalWrites: false },
    );

    // Clean up schema on component destroy
    this.destroyRef.onDestroy(() => {
      this.seoService.removeSchema();
    });
  }

  ngOnInit(): void {
    // Optional: Additional initialization if needed
  }

  /**
   * Toggle expanded state for a review card (for "Read More")
   */
  protected toggleExpanded(reviewId: string): void {
    this.expandedReviewId.set(this.expandedReviewId() === reviewId ? null : reviewId);
  }

  /**
   * Check if a review is currently expanded
   */
  protected isExpanded(reviewId: string): boolean {
    return this.expandedReviewId() === reviewId;
  }

  /**
   * Clamp review text to 4 lines or show full if expanded
   */
  protected getDisplayText(review: PropertyReviewDto, maxLines: number = 4): string {
    if (this.isExpanded(review.id)) {
      return review.comment || '';
    }

    const text = review.comment || '';
    const lines = text.split('\n');

    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n') + '...';
    }

    // Rough character limit for visual clamping (approx 200 chars)
    if (text.length > 200) {
      return text.substring(0, 200) + '...';
    }

    return text;
  }

  /**
   * Check if a review has more content to show
   */
  protected hasMoreContent(review: PropertyReviewDto): boolean {
    const text = review.comment || '';
    return text.length > 200 || text.split('\n').length > 4;
  }

  /**
   * Format date to "Month Year" format (e.g., "March 2025")
   */
  protected formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const formatter = new Intl.DateTimeFormat(
      this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US',
      {
        year: 'numeric',
        month: 'long',
      },
    );
    return formatter.format(d);
  }

  /**
   * Generate star array for display
   */
  protected getStars(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1);
  }

  /**
   * Get filled star count
   */
  protected getFilledStars(rating: number): number {
    return Math.floor(rating);
  }

  /**
   * Translate helper
   */
  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}
