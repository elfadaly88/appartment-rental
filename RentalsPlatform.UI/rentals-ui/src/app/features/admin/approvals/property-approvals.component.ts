import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  AdminPropertyStore,
  PendingPropertyDto,
} from '../state/admin-property.store';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-property-approvals',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './property-approvals.component.html',
  styleUrl: './property-approvals.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PropertyApprovalsComponent {
  protected readonly store = inject(AdminPropertyStore);
  protected readonly lang = inject(LanguageService);

  protected readonly isRejectModalOpen = signal(false);
  protected readonly selectedProperty = signal<PendingPropertyDto | null>(null);
  protected readonly rejectionReason = signal('');
  protected readonly modalError = signal<string | null>(null);

  protected readonly title = computed(() =>
    this.t('موافقة العقارات', 'Property Approvals'),
  );

  constructor() {
    void this.store.loadPending();
  }

  protected async refresh(): Promise<void> {
    await this.store.loadPending();
  }

  protected async approve(propertyId: string): Promise<void> {
    await this.store.approve(propertyId);
  }

  protected openRejectModal(item: PendingPropertyDto): void {
    this.selectedProperty.set(item);
    this.rejectionReason.set('');
    this.modalError.set(null);
    this.isRejectModalOpen.set(true);
  }

  protected closeRejectModal(): void {
    this.isRejectModalOpen.set(false);
    this.selectedProperty.set(null);
    this.rejectionReason.set('');
    this.modalError.set(null);
  }

  protected updateReason(value: string): void {
    this.rejectionReason.set(value);
    if (value.trim().length > 0 && this.modalError()) {
      this.modalError.set(null);
    }
  }

  protected async submitRejection(): Promise<void> {
    const target = this.selectedProperty();
    const reason = this.rejectionReason().trim();

    if (!target) {
      return;
    }

    if (!reason) {
      this.modalError.set(
        this.t('سبب الرفض مطلوب', 'A rejection reason is required.'),
      );
      return;
    }

    await this.store.reject(target.id, reason);

    if (!this.store.error()) {
      this.closeRejectModal();
    }
  }

  protected imageTrackBy(index: number): number {
    return index;
  }

  protected formatPrice(amount: number, currency: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currency} ${Math.round(amount).toLocaleString(locale)}`;
    }
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}
