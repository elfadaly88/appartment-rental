import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, input, output, signal } from '@angular/core';

interface TermsSection {
  accentGradient: string;   // CSS linear-gradient value for the side bar
  arTitle: string;
  enTitle: string;
  arBody: string[];
  enBody: string[];
}

@Component({
  selector: 'app-host-terms-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './host-terms-modal.component.html',
  styleUrl: './host-terms-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HostTermsModalComponent {
  readonly isOpen = input.required<boolean>();
  readonly hasAccepted = input(false);
  readonly closed = output<void>();
  readonly agreed = output<void>();

  private readonly document = inject(DOCUMENT);

  readonly arabicRead = signal(false);
  readonly englishRead = signal(false);
  readonly readProgress = computed(() => {
    // تحديث الـ progress ليكون 100% لو قرأ أي لغة منهم
    return (this.arabicRead() || this.englishRead()) ? 100 : 0;
  });
  readonly canAgree = computed(() => {
    if (this.hasAccepted()) {
      return true;
    }

    return this.arabicRead() || this.englishRead();
  });

  readonly sections: TermsSection[] = [
    {
      accentGradient: 'linear-gradient(to bottom, #0f766e, #14b8a6)',
      arTitle: 'معايير الجودة الراقية',
      enTitle: 'Premium Quality Standards',
      arBody: [
        'نستقبل فقط الوحدات الراقية الجاهزة لتجربة ضيافة فاخرة، مع صور واقعية ووصف دقيق ومرافق تعمل كما هو معلن.',
        'يلتزم المضيف بالحفاظ على مستوى نظافة وتجهيز وخدمة يليق بضيوف Luxe Rentals، مع سرعة الرد على الاستفسارات والطلبات الأساسية.',
      ],
      enBody: [
        'We onboard only high-end listings that are guest-ready, accurately represented, and supported with authentic media and polished presentation.',
        'Hosts are expected to maintain premium cleanliness, responsive communication, and a hospitality standard consistent with the Luxe Rentals brand.',
      ],
    },
    {
      accentGradient: 'linear-gradient(to bottom, #1d4ed8, #38bdf8)',
      arTitle: 'مدفوعات آمنة وشفافة',
      enTitle: 'Secure Paymob Payouts',
      arBody: [
        'تتم عمليات الدفع والتحصيل عبر Paymob بما يوفّر مسارًا موثوقًا وآمنًا للفواتير والتحويلات وجدولة المستحقات.',
        'يوافق المضيف على تقديم بيانات صحيحة للدفع، والالتزام بسياسات الإلغاء والاسترداد ورسوم المنصة قبل تفعيل الحجوزات.',
      ],
      enBody: [
        'All booking collections and host payouts are processed through Paymob to ensure reliable settlement, traceability, and secure financial handling.',
        'Hosts agree to keep payout details accurate and to respect platform fees, cancellation rules, and any applicable refund obligations.',
      ],
    },
    {
      accentGradient: 'linear-gradient(to bottom, #7c3aed, #c084fc)',
      arTitle: 'الثقة والحماية المتبادلة',
      enTitle: 'Mutual Trust & Protection',
      arBody: [
        'نحمي الضيف والمضيف بسياسات واضحة للتوثيق والمراجعات والنزاعات، مع حق المنصة في تعليق أي إعلان يضر بالثقة أو الجودة.',
        'يلتزم المضيف باحترام خصوصية الضيوف، وعدم التحايل خارج المنصة، والتعامل المهني مع الشكاوى أو الحوادث أو طلبات الدعم.',
      ],
      enBody: [
        'Guest and host protection is reinforced through transparent reviews, verification practices, and dispute handling policies.',
        'Hosts must respect guest privacy, avoid off-platform circumvention, and cooperate professionally with support and incident resolution.',
      ],
    },
  ];

  constructor() {
    effect(() => {
      this.document.body.style.overflow = this.isOpen() ? 'hidden' : '';
    });
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  accept(): void {
    if (!this.canAgree()) {
      return;
    }

    this.agreed.emit();
  }

  markRead(locale: 'ar' | 'en', event: Event): void {
    const element = event.target as HTMLElement;
    const reachedBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 16;

    if (!reachedBottom) {
      return;
    }

    if (locale === 'ar') {
      this.arabicRead.set(true);
      return;
    }

    this.englishRead.set(true);
  }

}