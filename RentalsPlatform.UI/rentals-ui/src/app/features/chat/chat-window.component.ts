import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { ChatMessageDto, ChatService } from '../../core/services/chat.service';
import { LanguageService } from '../../core/services/language.service';
import { AuthStore } from '../../core/state/auth.store';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class ChatWindowComponent {
  readonly bookingIdInput = input<string | null>(null, { alias: 'bookingId' });
  readonly otherParticipantIdInput = input<string | null>(null, {
    alias: 'otherParticipantId',
  });
  readonly propertyNameInput = input<string | null>(null, { alias: 'propertyName' });
  readonly otherParticipantNameInput = input<string | null>(null, {
    alias: 'otherParticipantName',
  });
  readonly otherParticipantAvatarUrlInput = input<string | null>(null, {
    alias: 'otherParticipantAvatarUrl',
  });

  protected readonly chatService = inject(ChatService);
  protected readonly lang = inject(LanguageService);
  protected readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly messageViewport = viewChild<ElementRef<HTMLDivElement>>('messageViewport');
  private scrollFrameId = 0;
  private previousMessageCount = 0;

  private readonly routeBookingId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('bookingId'))),
    { initialValue: null },
  );
  private readonly routeOtherParticipantId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('otherParticipantId'))),
    { initialValue: null },
  );
  private readonly routePropertyName = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('propertyName'))),
    { initialValue: null },
  );
  private readonly routeParticipantName = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('participantName'))),
    { initialValue: null },
  );
  private readonly routeParticipantAvatar = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('avatarUrl'))),
    { initialValue: null },
  );

  protected readonly bookingId = computed(
    () => this.bookingIdInput()?.trim() || this.routeBookingId()?.trim() || '',
  );
  protected readonly otherParticipantId = computed(
    () =>
      this.otherParticipantIdInput()?.trim() ||
      this.routeOtherParticipantId()?.trim() ||
      '',
  );
  protected readonly propertyName = computed(
    () =>
      this.propertyNameInput()?.trim() ||
      this.routePropertyName()?.trim() ||
      this.t('محادثة الحجز', 'Booking Chat'),
  );
  protected readonly otherParticipantName = computed(
    () =>
      this.otherParticipantNameInput()?.trim() ||
      this.routeParticipantName()?.trim() ||
      this.t('الضيف', 'Guest'),
  );
  protected readonly otherParticipantAvatarUrl = computed(
    () =>
      this.otherParticipantAvatarUrlInput()?.trim() ||
      this.routeParticipantAvatar()?.trim() ||
      '',
  );

  protected readonly messages = this.chatService.messages;
  protected readonly isLoading = this.chatService.isLoading;
  protected readonly error = this.chatService.error;
  protected readonly isConnected = this.chatService.isConnected;
  protected readonly currentUserId = computed(
    () => this.authStore.currentUser()?.id?.trim() ?? '',
  );
  protected readonly avatarInitials = computed(() => {
    const name = this.otherParticipantName();
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase() ?? '')
      .join('');
  });

  protected readonly composer = new FormControl('', { nonNullable: true });

  constructor() {
    this.authStore.initAuth();

    effect(() => {
      const bookingId = this.bookingId();
      if (!bookingId) {
        return;
      }

      void this.chatService.openConversation(bookingId);
    });

    effect(() => {
      const count = this.messages().length;
      const behavior = count > this.previousMessageCount ? 'smooth' : 'auto';
      this.previousMessageCount = count;
      this.scheduleScroll(behavior);
    });

    afterNextRender(() => {
      this.scheduleScroll('auto');
    });

    this.destroyRef.onDestroy(() => {
      if (this.scrollFrameId && isPlatformBrowser(this.platformId)) {
        cancelAnimationFrame(this.scrollFrameId);
      }

      void this.chatService.stopConnection();
    });
  }

  protected async send(): Promise<void> {
    const bookingId = this.bookingId();
    const otherParticipantId = this.otherParticipantId();
    const content = this.composer.value.trim();

    if (!bookingId || !otherParticipantId || !content) {
      return;
    }

    await this.chatService.sendMessage(bookingId, otherParticipantId, content);

    if (!this.chatService.error()) {
      this.composer.setValue('');
    }
  }

  protected isOutgoing(message: ChatMessageDto): boolean {
    return !!this.currentUserId() && message.senderId === this.currentUserId();
  }

  protected trackByMessage(_index: number, message: ChatMessageDto): string {
    return message.id;
  }

  protected formatTime(isoDate: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(isoDate));
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  private scheduleScroll(behavior: ScrollBehavior): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.scrollFrameId) {
      cancelAnimationFrame(this.scrollFrameId);
    }

    this.scrollFrameId = requestAnimationFrame(() => {
      this.scrollFrameId = 0;
      const viewport = this.messageViewport()?.nativeElement;
      if (!viewport) {
        return;
      }

      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior,
      });
    });
  }
}