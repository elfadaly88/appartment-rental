import { Injectable, signal, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

export type Lang = 'ar' | 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private document: Document = inject(DOCUMENT);
  private translate: TranslateService = inject(TranslateService);
  private platformId: object = inject(PLATFORM_ID); // للتأكد أننا في المتصفح وليس السيرفر (SSR)

  private readonly STORAGE_KEY = 'app_lang';

  // 1. قراءة اللغة المحفوظة أو استخدام 'en' كافتراضية
  private getInitialLang(): Lang {
    if (isPlatformBrowser(this.platformId)) {
      const savedLang = localStorage.getItem(this.STORAGE_KEY) as Lang;
      return savedLang || 'en';
    }
    return 'en';
  }

  private readonly _lang = signal<Lang>(this.getInitialLang());

  readonly currentLang = this._lang.asReadonly();
  readonly dir = computed(() => (this._lang() === 'ar' ? 'rtl' : 'ltr'));

  constructor() {
    effect(() => {
      const lang = this._lang();
      const dir = this.dir();
      const htmlTag = this.document.getElementsByTagName('html')[0];
      htmlTag.dir = dir;
      htmlTag.lang = lang;
      this.translate.use(lang);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem(this.STORAGE_KEY, lang);
      }
    });
  }

  toggleLanguage(): void {
    this._lang.update((l) => (l === 'en' ? 'ar' : 'en'));
  }

  setLanguage(lang: Lang): void {
    this._lang.set(lang);
  }
}