import {
  ApplicationConfig,
  isDevMode,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader, provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import {
  FacebookLoginProvider,
  SOCIAL_AUTH_CONFIG,
  SocialAuthServiceConfig,
  SocialLoginModule,
} from '@abacritt/angularx-social-login';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { securityInterceptor } from './core/interceptors/security.interceptor';
import { environment } from '../environments/environment';

const socialAuthProviders =
  typeof window !== 'undefined'
    ? [
        importProvidersFrom(SocialLoginModule),
        {
          provide: SOCIAL_AUTH_CONFIG,
          useValue: {
            autoLogin: false,
            providers: [
              // Google is now handled via the native GIS script (GoogleAuthService).
              // Only Facebook still uses @abacritt/angularx-social-login.
              {
                id: FacebookLoginProvider.PROVIDER_ID,
                provider: new FacebookLoginProvider(environment.socialAuth.facebookAppId, {
                  scope: 'email,public_profile',
                  return_scopes: true,
                  enable_profile_selector: true,
                }),
              },
            ],
            onError: (error: unknown) => console.error('Social auth error', error),
          } satisfies SocialAuthServiceConfig,
        },
      ]
    : [];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimationsAsync(),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withFetch(), withInterceptors([securityInterceptor, authInterceptor])),
    provideClientHydration(withEventReplay()),
    // ngx-translate v17: forRoot registers the module; provideTranslateHttpLoader configures the path
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'en',
        loader: {
          provide: TranslateLoader,
          useClass: TranslateHttpLoader,
        },
      }),
    ),
    ...socialAuthProviders,
    ...provideTranslateHttpLoader({ prefix: './assets/i18n/', suffix: '.json' }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
