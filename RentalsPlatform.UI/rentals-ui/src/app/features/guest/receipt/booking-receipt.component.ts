import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

import { LanguageService } from '../../../core/services/language.service';

interface ReceiptLineItem {
  label: string;
  amount: number;
}

interface BookingReceiptDetails {
  propertyName: string;
  hostName: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  currency: string;
  paymobTransactionId: string;
  bookingDate: string;
  receiptNumber: string;
  guestName: string;
  breakdown: ReceiptLineItem[];
}

@Component({
  selector: 'app-booking-receipt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booking-receipt.component.html',
  styleUrl: './booking-receipt.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class BookingReceiptComponent {
  protected readonly lang = inject(LanguageService);
  private readonly documentRef = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly isDownloading = signal(false);

  protected readonly bookingDetails = signal<BookingReceiptDetails>({
    propertyName: 'Azure Palm Residence',
    hostName: 'Nadine Hassan',
    checkInDate: '2026-04-18',
    checkOutDate: '2026-04-24',
    totalAmount: 4200,
    currency: 'USD',
    paymobTransactionId: 'PMB-98421377',
    bookingDate: '2026-04-07',
    receiptNumber: 'REC-20260407-1842',
    guestName: 'Sara Ibrahim',
    breakdown: [
      { label: '6 nights', amount: 3600 },
      { label: 'Service fee', amount: 320 },
      { label: 'Taxes', amount: 280 },
    ],
  });

  protected readonly formattedTotal = computed(() =>
    this.formatCurrency(this.bookingDetails().totalAmount, this.bookingDetails().currency),
  );

  protected readonly nightsLabel = computed(() => {
    const checkIn = new Date(this.bookingDetails().checkInDate);
    const checkOut = new Date(this.bookingDetails().checkOutDate);
    const diff = Math.max(
      1,
      Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return this.t(`${diff} ليال`, `${diff} nights`);
  });

  protected async downloadPdf(): Promise<void> {
    if (this.isDownloading() || !isPlatformBrowser(this.platformId)) {
      return;
    }

    this.isDownloading.set(true);

    try {
      const receiptElement = this.documentRef.getElementById('receipt-document');
      if (!receiptElement) {
        throw new Error('Receipt document element not found.');
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imageData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageWidth = pageWidth;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;

      let renderedHeight = imageHeight;
      if (renderedHeight > pageHeight) {
        renderedHeight = pageHeight;
      }

      pdf.addImage(imageData, 'PNG', 0, 0, imageWidth, renderedHeight, undefined, 'FAST');
      pdf.save(`Booking_Receipt_${this.bookingDetails().paymobTransactionId}.pdf`);
    } catch (error) {
      console.error('[BookingReceiptComponent] downloadPdf failed', error);
    } finally {
      this.isDownloading.set(false);
    }
  }

  protected printReceipt(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    window.print();
  }

  protected formatDate(value: string): string {
    const date = new Date(value);
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  protected formatCurrency(amount: number, currency: string): string {
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
