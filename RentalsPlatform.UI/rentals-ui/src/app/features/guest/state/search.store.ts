import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap } from 'rxjs';
import { Property } from '../../../models/property.model';
import { environment } from '../../../../environments/environment';

export type ViewMode = 'list' | 'map';

export interface SearchCriteria {
  city: string;
  checkIn: string;
  checkOut: string;
  minPrice: number;
  maxPrice: number;
  guests: number;
}

@Injectable({ providedIn: 'root' })
export class SearchStore {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly filterUpdate$ = new Subject<SearchCriteria>();

  private readonly _searchCriteria = signal<SearchCriteria>({
    city: '',
    checkIn: '',
    checkOut: '',
    minPrice: 0,
    maxPrice: 15000,
    guests: 1,
  });

  private readonly _results = signal<Property[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _viewMode = signal<ViewMode>('list');

  readonly searchCriteria = this._searchCriteria.asReadonly();
  readonly results = this._results.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly viewMode = this._viewMode.asReadonly();

  readonly hasResults = computed(() => this._results().length > 0);
  readonly resultsCount = computed(() => this._results().length);

  constructor() {
    // Signal -> RxJS bridge for debounce, cancellation, and API request control.
    this.filterUpdate$
      .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap((criteria) => {
          this._isLoading.set(true);

          const params = this.buildParams(criteria);
          return this.http
            .get<Property[]>(`${environment.apiUrl}/properties/search`, { params })
            .pipe(
              catchError(() => of([])),
              finalize(() => this._isLoading.set(false)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((properties) => {
        this._results.set(properties);
      });

    // Initial load
    this.filterUpdate$.next(this._searchCriteria());
  }

  updateFilters(filters: Partial<SearchCriteria>): void {
    this._searchCriteria.update((current) => {
      const next = { ...current, ...filters };
      this.filterUpdate$.next(next);
      return next;
    });
  }

  setViewMode(mode: ViewMode): void {
    this._viewMode.set(mode);
  }

  toggleViewMode(): void {
    this._viewMode.update((mode) => (mode === 'list' ? 'map' : 'list'));
  }

  private buildParams(criteria: SearchCriteria): HttpParams {
    let params = new HttpParams();

    if (criteria.city.trim()) params = params.set('city', criteria.city.trim());
    if (criteria.checkIn) params = params.set('checkIn', criteria.checkIn);
    if (criteria.checkOut) params = params.set('checkOut', criteria.checkOut);
    params = params.set('minPrice', String(criteria.minPrice));
    params = params.set('maxPrice', String(criteria.maxPrice));
    params = params.set('guests', String(criteria.guests));

    return params;
    }

    reset(): void {
      this._searchCriteria.set({
        city: '',
        checkIn: '',
        checkOut: '',
        minPrice: 0,
        maxPrice: 15000,
        guests: 1,
      });
      this._results.set([]);
      this._isLoading.set(false);
      this._viewMode.set('list');
  }
}
