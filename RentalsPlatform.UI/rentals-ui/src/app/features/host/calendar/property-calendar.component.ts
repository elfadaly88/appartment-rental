import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import {
  HostBookingService,
  HostCalendarEntry,
} from '../../../core/services/host-booking.service';
import { LanguageService } from '../../../core/services/language.service';

interface DateRange {
  start: Date;
  end: Date;
}

interface QuickActionMenuState {
  x: number;
  y: number;
  range: DateRange;
}

interface CalendarDayCell {
  date: Date;
  isoDate: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isPast: boolean;
  isToday: boolean;
  isSelectable: boolean;
  isSelected: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  state: 'available' | 'booking' | 'blocked' | 'past';
  guestName: string;
  helperText: string;
}

interface AgendaItem {
  id: string;
  type: 'booking' | 'blocked';
  title: string;
  subtitle: string;
  rangeLabel: string;
}

@Component({
  selector: 'app-property-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './property-calendar.component.html',
  styleUrl: './property-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PropertyCalendarComponent {
  readonly propertyId = input<string>('');
  readonly propertyName = input<string>('');
  readonly customPriceRequested = output<{ startDate: string; endDate: string }>();

  private readonly hostBookingService = inject(HostBookingService);
  protected readonly lang = inject(LanguageService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly selectedRange = signal<{ start: Date; end: Date } | null>(null);
  readonly isLoading = signal(false);
  readonly isBlocking = signal(false);
  readonly error = signal<string | null>(null);

  private readonly currentMonth = signal(startOfMonth(new Date()));
  private readonly calendarEntries = signal<HostCalendarEntry[]>([]);
  private readonly selectionAnchor = signal<Date | null>(null);
  private readonly quickActionMenu = signal<QuickActionMenuState | null>(null);

  protected readonly weekdayLabels = computed(() => {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-EG' : 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const monday = new Date(Date.UTC(2026, 0, 5));

    return Array.from({ length: 7 }, (_, index) => formatter.format(addDays(monday, index)));
  });

  protected readonly monthLabel = computed(() => {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-EG' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
    }).format(this.currentMonth());
  });

  private readonly visibleRange = computed(() => {
    const month = this.currentMonth();
    const monthStart = startOfMonth(month);
    const offset = (monthStart.getDay() + 6) % 7;
    const gridStart = addDays(monthStart, -offset);
    const gridEnd = addDays(gridStart, 41);

    return {
      start: gridStart,
      end: gridEnd,
    };
  });

  private readonly entryIndex = computed(() => buildEntryIndex(this.calendarEntries()));

  protected readonly calendarDays = computed(() => {
    const today = startOfDay(new Date());
    const month = this.currentMonth();
    const range = this.visibleRange();
    const entryIndex = this.entryIndex();
    const selectedRange = this.selectedRange();

    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(range.start, index);
      const isoDate = toIsoDate(date);
      const entry = entryIndex.get(isoDate) ?? null;
      const isPast = isBeforeDay(date, today);
      const isCurrentMonth =
        date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
      const isSelected = selectedRange ? isWithinInclusiveRange(date, selectedRange) : false;
      const isRangeStart = selectedRange ? isSameDay(date, selectedRange.start) : false;
      const isRangeEnd = selectedRange ? isSameDay(date, selectedRange.end) : false;

      return {
        date,
        isoDate,
        dayNumber: date.getDate(),
        isCurrentMonth,
        isPast,
        isToday: isSameDay(date, today),
        isSelectable: isCurrentMonth && !isPast && !entry,
        isSelected,
        isRangeStart,
        isRangeEnd,
        state: entry?.type ?? (isPast ? 'past' : 'available'),
        guestName: entry?.guestName?.trim() ?? '',
        helperText: entry?.type === 'blocked'
          ? this.t('محجوز يدوياً', 'Manual block')
          : entry?.guestName?.trim() || (entry?.type === 'booking' ? this.t('حجز مؤكد', 'Confirmed booking') : ''),
      } satisfies CalendarDayCell;
    });
  });

  protected readonly agendaItems = computed(() => {
    const month = this.currentMonth();
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    return this.calendarEntries()
      .filter((entry) => rangesOverlap(parseIsoDate(entry.startDate), parseIsoDate(entry.endDate), monthStart, monthEnd))
      .slice()
      .sort((left, right) => left.startDate.localeCompare(right.startDate))
      .map((entry) => ({
        id: entry.id,
        type: entry.type,
        title: entry.type === 'booking'
          ? entry.guestName?.trim() || this.t('ضيف مؤكد', 'Confirmed guest')
          : this.t('حظر يدوي', 'Manual block'),
        subtitle: entry.type === 'booking'
          ? this.t('إقامة مؤكدة', 'Confirmed stay')
          : entry.note?.trim() || this.t('غير متاح للحجز', 'Unavailable for booking'),
        rangeLabel: this.formatRangeLabel(parseIsoDate(entry.startDate), parseIsoDate(entry.endDate)),
      })) satisfies AgendaItem[];
  });

  protected readonly selectedRangeLabel = computed(() => {
    const selectedRange = this.selectedRange();
    if (!selectedRange) {
      return '';
    }

    return this.formatRangeLabel(selectedRange.start, selectedRange.end);
  });

  constructor() {
    effect(() => {
      const propertyId = this.propertyId().trim();
      const visibleRange = this.visibleRange();

      if (!propertyId) {
        this.calendarEntries.set([]);
        this.error.set(null);
        return;
      }

      void this.loadTakenDates(propertyId, visibleRange.start, visibleRange.end);
    });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target || this.elementRef.nativeElement.contains(target)) {
      return;
    }

    this.selectionAnchor.set(null);
    this.quickActionMenu.set(null);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.selectionAnchor.set(null);
    this.quickActionMenu.set(null);
  }

  protected previousMonth(): void {
    this.currentMonth.update((month) => startOfMonth(addMonths(month, -1)));
    this.quickActionMenu.set(null);
    this.selectionAnchor.set(null);
    this.selectedRange.set(null);
  }

  protected nextMonth(): void {
    this.currentMonth.update((month) => startOfMonth(addMonths(month, 1)));
    this.quickActionMenu.set(null);
    this.selectionAnchor.set(null);
    this.selectedRange.set(null);
  }

  protected onDayClick(day: CalendarDayCell, event: MouseEvent): void {
    event.stopPropagation();

    if (!day.isSelectable) {
      this.quickActionMenu.set(null);
      this.selectionAnchor.set(null);
      this.selectedRange.set(null);
      return;
    }

    const anchor = this.selectionAnchor();
    if (!anchor) {
      this.selectionAnchor.set(day.date);
      this.selectedRange.set({ start: day.date, end: day.date });
      this.quickActionMenu.set(null);
      return;
    }

    const range = normalizeDateRange(anchor, day.date);
    if (!this.canSelectRange(range)) {
      this.selectionAnchor.set(day.date);
      this.selectedRange.set({ start: day.date, end: day.date });
      this.quickActionMenu.set(null);
      return;
    }

    this.selectionAnchor.set(null);
    this.selectedRange.set(range);
    this.quickActionMenu.set({
      x: clamp(event.clientX - 116, 16, Math.max(16, window.innerWidth - 260)),
      y: clamp(event.clientY + 18, 16, Math.max(16, window.innerHeight - 220)),
      range,
    });
  }

  protected async blockSelectedDates(): Promise<void> {
    const propertyId = this.propertyId().trim();
    const range = this.selectedRange();
    if (!propertyId || !range || this.isBlocking()) {
      return;
    }

    this.isBlocking.set(true);
    this.error.set(null);

    try {
      const startDate = toIsoDate(range.start);
      const endDate = toIsoDate(range.end);

      await firstValueFrom(
        this.hostBookingService.blockDates({
          propertyId,
          startDate,
          endDate,
        }),
      );

      this.calendarEntries.update((current) => [
        ...current,
        {
          id: `block-${startDate}-${endDate}-${Date.now()}`,
          propertyId,
          startDate,
          endDate,
          type: 'blocked',
          note: this.t('حظر يدوي', 'Manual block'),
        },
      ]);

      this.quickActionMenu.set(null);
      this.selectedRange.set(null);
      this.selectionAnchor.set(null);
    } catch {
      this.error.set(this.t('تعذر حظر التواريخ المحددة.', 'Unable to block the selected dates.'));
    } finally {
      this.isBlocking.set(false);
    }
  }

  protected requestCustomPrice(): void {
    const range = this.selectedRange();
    if (!range) {
      return;
    }

    this.customPriceRequested.emit({
      startDate: toIsoDate(range.start),
      endDate: toIsoDate(range.end),
    });
  }

  protected closeQuickAction(): void {
    this.quickActionMenu.set(null);
  }

  protected quickActionPosition(): QuickActionMenuState | null {
    return this.quickActionMenu();
  }

  protected trackDay(_index: number, day: CalendarDayCell): string {
    return day.isoDate;
  }

  protected trackAgenda(_index: number, item: AgendaItem): string {
    return item.id;
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  private async loadTakenDates(propertyId: string, start: Date, end: Date): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const entries = await firstValueFrom(
        this.hostBookingService.getTakenDates(propertyId, toIsoDate(start), toIsoDate(end)),
      );

      this.calendarEntries.set(entries ?? []);
    } catch {
      this.calendarEntries.set([]);
      this.error.set(this.t('تعذر تحميل تواريخ الإشغال الحالية.', 'Unable to load current occupancy dates.'));
    } finally {
      this.isLoading.set(false);
    }
  }

  private canSelectRange(range: DateRange): boolean {
    const entryIndex = this.entryIndex();
    const month = this.currentMonth();
    const today = startOfDay(new Date());

    for (const date of enumerateDays(range.start, range.end)) {
      if (
        date.getMonth() !== month.getMonth() ||
        date.getFullYear() !== month.getFullYear() ||
        isBeforeDay(date, today) ||
        entryIndex.has(toIsoDate(date))
      ) {
        return false;
      }
    }

    return true;
  }

  private formatRangeLabel(start: Date, end: Date): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-EG' : 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    });

    if (isSameDay(start, end)) {
      return formatter.format(start);
    }

    return `${formatter.format(start)} - ${formatter.format(end)}`;
  }
}

function buildEntryIndex(entries: HostCalendarEntry[]): Map<string, HostCalendarEntry> {
  const index = new Map<string, HostCalendarEntry>();

  for (const entry of entries) {
    const start = parseIsoDate(entry.startDate);
    const end = parseIsoDate(entry.endDate);

    for (const date of enumerateDays(start, end)) {
      const key = toIsoDate(date);
      const existing = index.get(key);

      if (!existing || existing.type === 'blocked') {
        index.set(key, entry);
      }
    }
  }

  return index;
}

function normalizeDateRange(first: Date, second: Date): DateRange {
  return first.getTime() <= second.getTime()
    ? { start: startOfDay(first), end: startOfDay(second) }
    : { start: startOfDay(second), end: startOfDay(first) };
}

function enumerateDays(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  let cursor = startOfDay(start);
  const boundary = startOfDay(end);

  while (cursor.getTime() <= boundary.getTime()) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function isSameDay(first: Date, second: Date): boolean {
  return toIsoDate(first) === toIsoDate(second);
}

function isBeforeDay(first: Date, second: Date): boolean {
  return startOfDay(first).getTime() < startOfDay(second).getTime();
}

function isWithinInclusiveRange(date: Date, range: DateRange): boolean {
  const time = startOfDay(date).getTime();
  return time >= startOfDay(range.start).getTime() && time <= startOfDay(range.end).getTime();
}

function rangesOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
): boolean {
  return firstStart.getTime() <= secondEnd.getTime() && secondStart.getTime() <= firstEnd.getTime();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}