import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-submit-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './submit-review.component.html',
  styleUrl: './submit-review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class SubmitReviewComponent {
  @Input() bookingId!: string;
  @Output() submitted = new EventEmitter<{ rating: number; comment: string }>();
  @Output() dismissed = new EventEmitter<void>();

  protected readonly http = inject(HttpClient);
  protected readonly lang = inject(LanguageService);

  protected readonly rating = signal<number>(0);
  protected readonly comment = signal<string>('');
  protected readonly hoveredRating = signal<number>(0);
  protected readonly isSubmitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly displayRating = computed(() => this.hoveredRating() || this.rating());
  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly canSubmit = computed(() => this.rating() > 0 && !this.isSubmitting());

  protected setRating(value: number): void {
    this.rating.set(value);
    this.hoveredRating.set(0);
  }

  protected setHoveredRating(value: number): void {
    this.hoveredRating.set(value);
  }

  protected clearHoveredRating(): void {
    this.hoveredRating.set(0);
  }

  protected onCommentInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.comment.set(target.value);
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) {
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    try {
      const payload = {
        bookingId: this.bookingId,
        rating: this.rating(),
        comment: this.comment().trim(),
      };

      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/reviews`, payload),
      );

      this.submitted.emit({
        rating: this.rating(),
        comment: this.comment(),
      });

      this.reset();
    } catch (err) {
      this.error.set(this.t('فشل إرسال التقييم. حاول مرة أخرى.', 'Failed to submit review. Please try again.'));
      console.error('[SubmitReviewComponent]', err);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected dismiss(): void {
    this.dismissed.emit();
    this.reset();
  }

  private reset(): void {
    this.rating.set(0);
    this.comment.set('');
    this.hoveredRating.set(0);
    this.error.set(null);
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}
