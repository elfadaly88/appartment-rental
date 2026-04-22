import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

// ── GIS type declarations ────────────────────────────────────────────────────
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void;
          prompt: (cb?: (n: PromptMomentNotification) => void) => void;
          renderButton: (parent: HTMLElement, options: object) => void;
          cancel: () => void;
          disableAutoSelect: () => void;
          revoke: (hint: string, cb: () => void) => void;
        };
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
        };
      };
    };
  }
}

interface GoogleIdConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  /** Explicitly opt-in to the FedCM-native flow (Chrome 116+). */
  use_fedcm_for_prompt?: boolean;
  /** Suppresses the GSI_LOGGER "plugin_name not set" warning. */
  plugin_name?: string;
  itp_support?: boolean;
}

interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
  client_id?: string;
}

interface PromptMomentNotification {
  isDisplayMoment: () => boolean;
  isDisplayed: () => boolean;
  isNotDisplayed: () => boolean;
  getNotDisplayedReason: () => string;
  isSkippedMoment: () => boolean;
  getSkippedReason: () => string;
  isDismissedMoment: () => boolean;
  getDismissedReason: () => string;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  prompt?: string;
  callback: (response: { access_token?: string; error?: string }) => void;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string; hint?: string }) => void;
}

// Reasons that mean the user is not logged into Google in this browser.
const IDENTITY_PROVIDER_REASONS = new Set([
  'suppressed_by_user',
  'opt_out_or_no_session',
  'unregistered_origin',
  'unknown_reason',
]);

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly clientId = environment.socialAuth.googleClientId;
  private gisLoadPromise: Promise<void> | null = null;

  // ── Script loader ────────────────────────────────────────────────────────
  private loadGis(): Promise<void> {
    if (this.gisLoadPromise) return this.gisLoadPromise;

    this.gisLoadPromise = new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Not a browser context'));
        return;
      }

      if (window.google?.accounts?.id) {
        resolve();
        return;
      }

      // Reuse existing script tag (e.g. SSR hydration scenarios)
      const existing = document.getElementById('gis-client');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () =>
          reject(new Error('GIS script failed to load')),
        );
        return;
      }

      const script = document.createElement('script');
      script.id = 'gis-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });

    return this.gisLoadPromise;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Attempt Google sign-in using FedCM prompt first.
   * If the browser blocks the prompt (user not signed into Google, FedCM
   * disabled, or suppressed), falls back to the OAuth2 popup flow so the
   * user always gets a chance to sign in.
   *
   * Resolves with the Google **ID token** (credential) string.
   */
  async signIn(): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Google Sign-In is only available in the browser.');
    }

    await this.loadGis();

    // Reset any stored auto-select state so users don't get stuck.
    window.google!.accounts.id.disableAutoSelect();

    return this.tryPromptFlow();
  }

  /** Cancel any pending GIS prompt. */
  cancel(): void {
    if (isPlatformBrowser(this.platformId) && window.google?.accounts?.id) {
      window.google.accounts.id.cancel();
    }
  }

  // ── Private flows ────────────────────────────────────────────────────────

  /**
   * Primary path: GIS `prompt()` with FedCM opt-in.
   * If suppressed/not-signed-in, falls back to popup.
   */
  private tryPromptFlow(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let settled = false;

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true;
          fn();
        }
      };

      window.google!.accounts.id.initialize({
        client_id: this.clientId,
        plugin_name: 'luxe_rentals',   // stops GSI_LOGGER warnings
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,    // explicit FedCM opt-in
        itp_support: true,             // Safari ITP compatibility
        callback: (resp: GoogleCredentialResponse) => {
          if (resp.credential) {
            settle(() => resolve(resp.credential));
          } else {
            settle(() => reject(new Error('Google did not return a credential.')));
          }
        },
      });

      window.google!.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          const reason = notification.getNotDisplayedReason();
          console.warn('[GoogleAuth] Prompt not displayed:', reason);

          if (IDENTITY_PROVIDER_REASONS.has(reason)) {
            // User not signed into Google in this browser → popup fallback
            settle(() =>
              this.popupFallbackFlow().then(resolve, reject),
            );
          } else {
            settle(() =>
              reject(
                new Error(
                  `Google sign-in unavailable: ${reason}. ` +
                  'Please ensure you are signed into a Google account in your browser.',
                ),
              ),
            );
          }
        } else if (notification.isSkippedMoment()) {
          const reason = notification.getSkippedReason();
          console.warn('[GoogleAuth] Prompt skipped:', reason);
          // Skipped = user dismissed; offer popup as alternative
          settle(() => this.popupFallbackFlow().then(resolve, reject));
        }
        // isDisplayMoment / isDismissedMoment resolve via the callback above
      });
    });
  }

  /**
   * Fallback: OAuth2 token + userinfo.
   * Opens the Google account picker popup (force `select_account`).
   * Returns an ID token by fetching `/openid-connect/v1/userinfo` with
   * the access token — but since we need an ID token for the backend,
   * we fall back to requesting the `openid` scope which gives us an id_token.
   *
   * NOTE: The cleanest approach is to re-initialize `id` with a popup trigger.
   * We do this by rendering a hidden GIS button and programmatically clicking it.
   */
  private popupFallbackFlow(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      // Re-initialize with prompt: 'select_account' so user picks account
      window.google!.accounts.id.initialize({
        client_id: this.clientId,
        plugin_name: 'luxe_rentals',
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: false,   // disable FedCM for popup path
        callback: (resp: GoogleCredentialResponse) => {
          if (resp.credential) {
            resolve(resp.credential);
          } else {
            reject(new Error('Google sign-in was cancelled or failed.'));
          }
        },
      });

      // Render a hidden button container and click it programmatically
      const container = document.createElement('div');
      container.style.cssText =
        'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;';
      document.body.appendChild(container);

      window.google!.accounts.id.renderButton(container, {
        type: 'standard',
        size: 'large',
        text: 'signin_with',
        theme: 'outline',
        width: 300,
      });

      // Click the rendered button after a short paint frame
      requestAnimationFrame(() => {
        const btn = container.querySelector<HTMLElement>('div[role="button"]');
        if (btn) {
          btn.click();
        } else {
          document.body.removeChild(container);
          reject(
            new Error(
              'Unable to open Google sign-in. ' +
              'Please ensure you are signed into Google in your browser.',
            ),
          );
        }

        // Clean up the container once the flow starts
        setTimeout(() => {
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
        }, 1000);
      });
    });
  }
}
