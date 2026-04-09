import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { PropertyDto } from '../../shared/models/property.dto';
import { PropertyReviewStatsDto, PropertyReviewDto } from '../../features/guest/reviews/reviews.dto';

interface SchemaOrgAccommodation {
  '@context': string;
  '@type': string;
  name: string;
  image: string | string[];
  description: string;
  url?: string;
  aggregateRating: {
    '@type': string;
    ratingValue: number;
    reviewCount: number;
    bestRating: number;
    worstRating: number;
  };
  review: Array<{
    '@type': string;
    author: {
      '@type': string;
      name: string;
    };
    datePublished: string;
    reviewRating: {
      '@type': string;
      ratingValue: number;
      bestRating: number;
      worstRating: number;
    };
    reviewBody: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class JsonLdService {
  private readonly document = inject(DOCUMENT);
  private schemaScript: HTMLScriptElement | null = null;

  /**
   * Sets Schema.org JSON-LD structured data for an accommodation/property.
   * Optimized for Google Rich Snippets and search engine comprehension.
   */
  setAccommodationSchema(property: PropertyDto, stats: PropertyReviewStatsDto): void {
    // Clean up any existing schema first
    this.removeSchema();

    // Ensure we have minimal required data
    if (!property || !stats) {
      console.warn('[JsonLdService] Missing property or stats data for schema generation');
      return;
    }

    // Build the review array from available reviews
    const reviews = (stats.reviews || []).map((review: PropertyReviewDto) =>
      this.buildReviewObject(review),
    );

    // Build the main schema object
    const schema: SchemaOrgAccommodation = {
      '@context': 'https://schema.org',
      '@type': 'Accommodation',
      name: property.title || property.name || 'Property',
      image: this.normalizeImages(property.images),
      description:
        property.description || `Luxury accommodation with ${stats.totalReviews} verified reviews.`,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Math.round((stats.averageRating || 0) * 100) / 100, // Ensure 2 decimals max
        reviewCount: stats.totalReviews || 0,
        bestRating: 5,
        worstRating: 1,
      },
      review: reviews.slice(0, 10), // Top 10 reviews for search engines
    };

    // Add URL if available
    if (property.slug) {
      schema.url = `${this.getBaseUrl()}/properties/${property.slug}`;
    }

    // Create and inject the script element
    this.injectSchema(schema);
  }

  /**
   * Build a single review object conforming to Schema.org Review type.
   */
  private buildReviewObject(
    review: PropertyReviewDto,
  ): SchemaOrgAccommodation['review'][number] {
    return {
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.guestName || 'Anonymous Guest',
      },
      datePublished: this.formatDateISO(review.createdAt),
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating || 0,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody:
        review.comment || 'No comment provided', // Schema.org requires non-empty reviewBody
    };
  }

  /**
   * Normalize property images to a safe string or array format.
   */
  private normalizeImages(images: string | string[] | undefined): string | string[] {
    if (!images) {
      return 'https://via.placeholder.com/1200x630?text=Property';
    }

    if (Array.isArray(images)) {
      return images.length > 0 ? images : ['https://via.placeholder.com/1200x630?text=Property'];
    }

    return images;
  }

  /**
   * Format date to ISO 8601 string (YYYY-MM-DD).
   */
  private formatDateISO(date: string | Date | undefined): string {
    if (!date) {
      return new Date().toISOString().split('T')[0];
    }

    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  }

  /**
   * Get the base URL of the application for canonical URLs.
   */
  private getBaseUrl(): string {
    const location = this.document.location;
    return `${location.protocol}//${location.hostname}${location.port ? ':' + location.port : ''}`;
  }

  /**
   * Inject the schema script into the document head.
   */
  private injectSchema(schema: SchemaOrgAccommodation): void {
    try {
      const script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema, null, 2);
      script.setAttribute('data-service', 'json-ld-schema');

      // Insert at the beginning of head for better performance
      const head = this.document.head;
      if (head.firstChild) {
        head.insertBefore(script, head.firstChild);
      } else {
        head.appendChild(script);
      }

      this.schemaScript = script;

      // Log in development mode
      if (!this.isProduction()) {
        console.debug('[JsonLdService] Schema injected:', schema);
      }
    } catch (error) {
      console.error('[JsonLdService] Failed to inject schema:', error);
    }
  }

  /**
   * Remove the injected schema script from the document.
   */
  removeSchema(): void {
    if (this.schemaScript && this.schemaScript.parentElement) {
      try {
        this.schemaScript.parentElement.removeChild(this.schemaScript);
        this.schemaScript = null;

        if (!this.isProduction()) {
          console.debug('[JsonLdService] Schema removed');
        }
      } catch (error) {
        console.error('[JsonLdService] Failed to remove schema:', error);
      }
    }
  }

  /**
   * Check if running in production mode.
   */
  private isProduction(): boolean {
    return !this.document.location.hostname.includes('localhost') &&
      !this.document.location.hostname.includes('127.0.0.1');
  }
}
