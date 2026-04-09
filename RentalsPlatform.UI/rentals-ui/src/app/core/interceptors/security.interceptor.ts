import { HttpInterceptorFn } from '@angular/common/http';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';

/**
 * Functional security interceptor (Angular 18 style).
 *
 * Goals:
 * 1) Always send credentials for HttpOnly-cookie auth flows.
 * 2) Add safe, standard request headers expected by hardened APIs.
 * 3) Attach CSRF token (if available) for state-changing requests.
 *
 * NOTE: Security headers like CSP, HSTS, X-Frame-Options, and Referrer-Policy
 * are RESPONSE headers and must be set by the server/proxy, not by the browser client.
 */
export const securityInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const documentRef = inject(DOCUMENT);

  const isBrowser = isPlatformBrowser(platformId);

  const setHeaders: Record<string, string> = {
    // Marks request as AJAX/fetch-style; often used in backend security policies.
    'X-Requested-With': 'XMLHttpRequest',
  };

  // Keep Accept explicit for API consistency if omitted.
  if (!req.headers.has('Accept')) {
    setHeaders['Accept'] = 'application/json, text/plain, */*';
  }

  // Add CSRF token for mutating requests when token is present.
  // Typical token sources: <meta name="csrf-token" content="..."> or readable cookie.
  if (isBrowser && isMutatingMethod(req.method)) {
    const csrfFromMeta = readCsrfFromMeta(documentRef);
    const csrfFromCookie = readCookie(documentRef, 'XSRF-TOKEN');
    const csrfToken = csrfFromMeta || csrfFromCookie;

    if (csrfToken && !req.headers.has('X-CSRF-Token')) {
      setHeaders['X-CSRF-Token'] = csrfToken;
    }
  }

  // withCredentials is required for HttpOnly cookie auth/session-based APIs.
  const secureReq = req.clone({
    withCredentials: true,
    setHeaders,
  });

  return next(secureReq);
};

function isMutatingMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function readCsrfFromMeta(documentRef: Document): string {
  const node = documentRef.querySelector('meta[name="csrf-token"]');
  const token = node?.getAttribute('content')?.trim() ?? '';
  return token;
}

function readCookie(documentRef: Document, name: string): string {
  const source = documentRef.cookie || '';
  if (!source) {
    return '';
  }

  const prefix = `${name}=`;
  const part = source
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(prefix));

  if (!part) {
    return '';
  }

  const raw = part.slice(prefix.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
