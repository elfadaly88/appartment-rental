import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { PropertyStore } from '../../core/state/property.store';
import { LanguageService } from '../../core/services/language.service';
import { PropertiesList } from '../../components/properties-list/properties-list';

@Component({
  selector: 'app-properties-page',
  imports: [PropertiesList],
  template: `
    @if (store.isLoading()) {
      <div class="page-loader" aria-label="Loading properties">
        <div class="page-loader__spinner"></div>
      </div>
    } @else if (store.error(); as errorMsg) {
      <div class="page-error">
        <p class="page-error__text">{{ errorMsg }}</p>
        <button class="page-error__retry" (click)="retry()">
          {{ lang.currentLang() === 'ar' ? 'إعادة المحاولة' : 'Try Again' }}
        </button>
      </div>
    } @else {
      <app-properties-list
        [properties]="store.properties()"
        [locale]="lang.currentLang()"
      />
    }
  `,
  styles: `
    :host { display: block; }

    .page-loader {
      display: flex;
      align-items: center;
      justify-content: center;
      min-block-size: 60vh;
    }

    .page-loader__spinner {
      inline-size: 40px;
      block-size: 40px;
      border: 3px solid var(--border-subtle, #e5e7eb);
      border-block-start-color: var(--accent, #0f766e);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .page-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      min-block-size: 60vh;
      padding-inline: 1.5rem;
      text-align: center;
    }

    .page-error__text {
      margin: 0;
      font-size: 1.125rem;
      color: var(--text-secondary, #6b7280);
    }

    .page-error__retry {
      min-block-size: 48px;
      padding-block: 0.75rem;
      padding-inline: 2rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #fff;
      background: var(--accent, #0f766e);
      border: none;
      border-radius: 0.75rem;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .page-error__retry:active {
      transform: scale(0.96);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesPage implements OnInit {
  protected readonly store = inject(PropertyStore);
  protected readonly lang = inject(LanguageService);

  ngOnInit(): void {
    this.store.loadProperties();
  }

  protected retry(): void {
    this.store.invalidateCache();
    this.store.loadProperties();
  }
}
