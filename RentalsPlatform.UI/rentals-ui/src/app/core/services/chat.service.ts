import {
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  IHttpConnectionOptions,
  LogLevel,
} from '@microsoft/signalr';

import { environment } from '../../../environments/environment';
import { AuthStore } from '../state/auth.store';

export interface ChatMessageDto {
  id: string;
  bookingId: string;
  senderId: string;
  receiverId: string;
  content: string;
  sentAt: string;
  senderName?: string;
  senderAvatarUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly platformId = inject(PLATFORM_ID);

  private hubConnection: HubConnection | null = null;
  private readonly activeBookingId = signal<string | null>(null);

  readonly messages = signal<ChatMessageDto[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly connectionState = signal<HubConnectionState>(HubConnectionState.Disconnected);
  readonly isConnected = computed(
    () => this.connectionState() === HubConnectionState.Connected,
  );

  async startConnection(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const token = this.getAuthToken();
    if (!token) {
      return;
    }

    if (
      this.hubConnection &&
      (this.hubConnection.state === HubConnectionState.Connected ||
        this.hubConnection.state === HubConnectionState.Connecting ||
        this.hubConnection.state === HubConnectionState.Reconnecting)
    ) {
      return;
    }

    if (!this.hubConnection) {
      this.buildConnection();
    }

    if (!this.hubConnection) {
      return;
    }

    try {
      await this.hubConnection.start();
      this.connectionState.set(this.hubConnection.state);

      const bookingId = this.activeBookingId();
      if (bookingId) {
        await this.loadHistory(bookingId);
      }
    } catch (error) {
      this.connectionState.set(HubConnectionState.Disconnected);
      this.error.set(this.readErrorMessage(error, 'Unable to connect to booking chat.'));
    }
  }

  async stopConnection(): Promise<void> {
    if (!this.hubConnection) {
      return;
    }

    await this.hubConnection.stop();
    this.connectionState.set(HubConnectionState.Disconnected);
  }

  async openConversation(bookingId: string): Promise<void> {
    const normalizedBookingId = bookingId.trim();
    if (!normalizedBookingId) {
      this.messages.set([]);
      this.activeBookingId.set(null);
      return;
    }

    if (this.activeBookingId() !== normalizedBookingId) {
      this.messages.set([]);
      this.activeBookingId.set(normalizedBookingId);
    }

    await this.startConnection();

    if (!this.isConnected()) {
      await this.loadHistory(normalizedBookingId);
    }
  }

  async loadHistory(bookingId: string): Promise<void> {
    const normalizedBookingId = bookingId.trim();
    if (!normalizedBookingId) {
      this.messages.set([]);
      return;
    }

    this.activeBookingId.set(normalizedBookingId);
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const history = await firstValueFrom(
        this.http.get<ChatMessageDto[]>(
          `${environment.apiUrl}/chat/bookings/${encodeURIComponent(normalizedBookingId)}/messages`,
        ),
      );

      const normalized = (history ?? [])
        .map((message) => this.normalizeMessage(message))
        .sort((left, right) =>
          Date.parse(left.sentAt || '') - Date.parse(right.sentAt || ''),
        );

      this.messages.set(normalized);
    } catch (error) {
      this.error.set(this.readErrorMessage(error, 'Unable to load chat history.'));
      this.messages.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async sendMessage(
    bookingId: string,
    receiverId: string,
    content: string,
  ): Promise<void> {
    const normalizedBookingId = bookingId.trim();
    const normalizedReceiverId = receiverId.trim();
    const trimmedContent = content.trim();

    if (!normalizedBookingId || !normalizedReceiverId || !trimmedContent) {
      return;
    }

    this.error.set(null);
    await this.startConnection();

    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      this.error.set('Booking chat is currently offline.');
      return;
    }

    try {
      await this.hubConnection.invoke(
        'SendMessage',
        normalizedBookingId,
        normalizedReceiverId,
        trimmedContent,
      );
    } catch (error) {
      this.error.set(this.readErrorMessage(error, 'Unable to send message.'));
    }
  }

  private buildConnection(): void {
    const options: IHttpConnectionOptions = {
      accessTokenFactory: () => this.getAuthToken(),
    };

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.buildChatHubUrl(), options)
      .withAutomaticReconnect([0, 1500, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();

    this.hubConnection.off('ReceiveMessage');
    this.hubConnection.on('ReceiveMessage', (payload: ChatMessageDto) => {
      const incoming = this.normalizeMessage(payload);
      if (!incoming.bookingId || incoming.bookingId !== this.activeBookingId()) {
        return;
      }

      this.messages.update((current) => this.mergeMessage(current, incoming));
    });

    this.hubConnection.onreconnecting(() => {
      this.connectionState.set(HubConnectionState.Reconnecting);
    });

    this.hubConnection.onreconnected(async () => {
      this.connectionState.set(HubConnectionState.Connected);

      const bookingId = this.activeBookingId();
      if (bookingId) {
        await this.loadHistory(bookingId);
      }
    });

    this.hubConnection.onclose(() => {
      this.connectionState.set(HubConnectionState.Disconnected);
    });
  }

  private mergeMessage(
    current: ChatMessageDto[],
    incoming: ChatMessageDto,
  ): ChatMessageDto[] {
    if (current.some((message) => message.id === incoming.id)) {
      return current;
    }

    return [...current, incoming].sort(
      (left, right) => Date.parse(left.sentAt || '') - Date.parse(right.sentAt || ''),
    );
  }

  private normalizeMessage(message: Partial<ChatMessageDto>): ChatMessageDto {
    return {
      id:
        message.id?.trim() ||
        `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      bookingId: message.bookingId?.trim() ?? '',
      senderId: message.senderId?.trim() ?? '',
      receiverId: message.receiverId?.trim() ?? '',
      content: message.content?.trim() ?? '',
      sentAt: message.sentAt?.trim() ?? new Date().toISOString(),
      senderName: message.senderName?.trim() || undefined,
      senderAvatarUrl: message.senderAvatarUrl?.trim() || undefined,
    };
  }

  private buildChatHubUrl(): string {
    const hubUrl = environment.hubUrl?.trim();
    if (hubUrl) {
      return hubUrl.replace(/notifications$/i, 'chat');
    }

    const apiBase = environment.apiUrl.replace(/\/?api$/i, '');
    return `${apiBase}/hubs/chat`;
  }

  private getAuthToken(): string {
    this.authStore.initAuth();

    if (!isPlatformBrowser(this.platformId)) {
      return '';
    }

    return localStorage.getItem('jwtToken') ?? localStorage.getItem('token') ?? '';
  }

  private readErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }
}