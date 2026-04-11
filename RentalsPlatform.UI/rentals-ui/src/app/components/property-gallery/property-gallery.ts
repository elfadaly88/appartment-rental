import { Component, ChangeDetectionStrategy, input, output, signal, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PropertyService } from '../../core/services/property.service';

import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-property-gallery',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './property-gallery.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertyGallery implements OnInit {
  private readonly propertyService = inject(PropertyService);
  private readonly router = inject(Router);
  
  readonly propertyId = input.required<string>();
  readonly locale = input<'ar' | 'en'>('en');
  readonly close = output<void>();

  protected readonly details = signal<any>(null);
  protected readonly isLoading = signal(true);
  protected readonly mainImage = signal<string | null>(null);

  ngOnInit(): void {
    this.propertyService.getById(this.propertyId()).subscribe({
      next: (data: any) => {
        this.details.set(data);
        if (data.images?.length > 0) {
          this.mainImage.set(data.images[0]);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  setMainImage(url: string) {
    this.mainImage.set(url);
  }

  bookNow() {
    this.close.emit();
    void this.router.navigate(['/properties', this.propertyId()]);
  }
}
