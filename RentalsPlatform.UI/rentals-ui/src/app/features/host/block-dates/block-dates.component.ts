import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import Swal from 'sweetalert2';

import { Property } from '../../../models/property.model';
import { PropertyService } from '../../../core/services/property.service';
import { HostBookingService } from '../../../core/services/host-booking.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-block-dates',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './block-dates.component.html',
  styleUrl: './block-dates.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class BlockDatesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly propertyService = inject(PropertyService);
  private readonly hostBookingService = inject(HostBookingService);
  protected readonly lang = inject(LanguageService);

  readonly isSubmitting = signal(false);
  readonly hostProperties = signal<Property[]>([]);

  readonly form = this.fb.group({
    propertyId: this.fb.control<string | null>(null, [Validators.required]),
    startDate: this.fb.control('', [Validators.required]),
    endDate: this.fb.control('', [Validators.required]),
    reason: this.fb.control('', [Validators.maxLength(500)]),
  });

  private readonly startDateSignal = toSignal(
    this.form.controls.startDate.valueChanges.pipe(startWith(this.form.controls.startDate.value)),
    { initialValue: this.form.controls.startDate.value },
  );

  protected readonly minEndDate = computed(() => this.startDateSignal() || this.today);
  protected readonly today = new Date().toISOString().split('T')[0];

  ngOnInit(): void {
    this.propertyService
      .getAll()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (properties) => this.hostProperties.set(properties ?? []),
        error: () => this.hostProperties.set([]),
      });
  }

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    const { propertyId, startDate, endDate, reason } = this.form.getRawValue();
    if (!propertyId || !startDate || !endDate) {
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      void Swal.fire({
        icon: 'warning',
        title: this.t('تأكد من التواريخ', 'Check your dates'),
        text: this.t(
          'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.',
          'End date must be after start date.',
        ),
      });
      return;
    }

    this.isSubmitting.set(true);

    this.hostBookingService
      .blockDates({
        propertyId,
        startDate,
        endDate,
        reason: reason?.trim() || undefined,
      })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: () => {
          void Swal.fire({
            toast: true,
            position: 'top-end',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            icon: 'success',
            title: this.t('تم حظر التواريخ بنجاح', 'Dates blocked successfully'),
          });

          this.form.reset({
            propertyId: null,
            startDate: '',
            endDate: '',
            reason: '',
          });

          this.isSubmitting.set(false);
        },
        error: () => {
          this.isSubmitting.set(false);
          void Swal.fire({
            icon: 'error',
            title: this.t('تعذر حفظ الحظر', 'Could not save block dates'),
            text: this.t(
              'حدث خطأ غير متوقع. حاول مرة أخرى.',
              'An unexpected error occurred. Please try again.',
            ),
          });
        },
      });
  }

  protected propertyLabel(property: Property): string {
    return this.lang.currentLang() === 'ar' ? property.name.ar : property.name.en;
  }

  protected isFilled(value: string | null): boolean {
    return Boolean(value);
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}
