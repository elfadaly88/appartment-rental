import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
}

interface LoginResponse {
  token: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT token');
  }

  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  const json = atob(padded);
  return JSON.parse(json) as Record<string, unknown>;
}

function readClaim(
  payload: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }
  }
  return null;
}

function parseUserFromToken(token: string): AuthUser {
  const payload = decodeJwtPayload(token);

  const id =
    readClaim(payload, [
      'sub',
      'nameid',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
    ]) ?? '';

  const email =
    readClaim(payload, [
      'email',
      'unique_name',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    ]) ?? '';

  const role =
    readClaim(payload, [
      'role',
      'roles',
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
    ]) ?? 'guest';

  const displayName = readClaim(payload, ['DisplayName']) ?? undefined;
  const avatarUrl = readClaim(payload, ['AvatarUrl', 'ProfilePictureUrl']) ?? undefined;
  const bio = readClaim(payload, ['Bio']) ?? undefined;

  return { id, email, role, displayName, avatarUrl, bio };
}

// auth.store.ts (النسخة المعدلة)
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);

  // ✅ التعديل: السجنال بيبدأ بمحاولة قراءة التوكن فوراً
  private readonly _currentUser = signal<AuthUser | null>(
    (() => {
      if (typeof window !== 'undefined' && window.localStorage) {
        const token = localStorage.getItem('jwtToken');
        if (token) {
          try {
            return parseUserFromToken(token);
          } catch { return null; }
        }
      }
      return null;
    })()
  );
  readonly isAdmin = computed(() => this._currentUser()?.role?.toLowerCase() === 'admin');
  readonly isAuthenticated = computed(() => !!this._currentUser());
  private readonly _isLoading = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  // readonly isAuthenticated = computed(() => this._currentUser() !== null);
  // readonly isAdmin = computed(() => this.normalizeRole(this._currentUser()?.role) === 'admin');
  readonly isHost = computed(() => this.normalizeRole(this._currentUser()?.role) === 'host');

  // ✅ وظيفة مساعدة لقراءة البيانات لحظة التحميل
  private getInitialUser(): AuthUser | null {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('jwtToken');
      if (token) {
        try {
          return parseUserFromToken(token);
        } catch {
          localStorage.removeItem('jwtToken');
        }
      }
    }
    return null;
  }
    async login(credentials: AuthCredentials): Promise<boolean> {
    this._isLoading.set(true);

    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, credentials),
      );

      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('jwtToken', response.token);
      }
      const user = parseUserFromToken(response.token);
      this._currentUser.set(user);
      return true;
    } catch {
      this._currentUser.set(null);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.removeItem('jwtToken');
      }
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('jwtToken');
      void this.router.navigate(['/auth']);
    }
    this._currentUser.set(null);
  }

  initAuth(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this._currentUser.set(null);
      return;
    }

    const token = localStorage.getItem('jwtToken');
    if (!token) {
      this._currentUser.set(null);
      return;
    }

    try {
      const user = parseUserFromToken(token);
      this._currentUser.set(user);
    } catch {
      localStorage.removeItem('jwtToken');
      this._currentUser.set(null);
    }
  }

  private normalizeRole(role: string | undefined): string {
    return (role ?? '').trim().toLowerCase();
  }
}
