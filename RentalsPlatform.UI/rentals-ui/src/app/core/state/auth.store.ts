import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface LoginResponse {
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _currentUser = signal<AuthUser | null>(null);
  private readonly _isLoading = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly isAdmin = computed(() => this.normalizeRole(this._currentUser()?.role) === 'admin');
  readonly isHost = computed(() => this.normalizeRole(this._currentUser()?.role) === 'host');

  async login(credentials: AuthCredentials): Promise<boolean> {
    this._isLoading.set(true);

    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, credentials),
      );

      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('jwtToken', response.token);
      }
      const user = this.parseUserFromToken(response.token);
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
      const user = this.parseUserFromToken(token);
      this._currentUser.set(user);
    } catch {
      localStorage.removeItem('jwtToken');
      this._currentUser.set(null);
    }
  }

  private parseUserFromToken(token: string): AuthUser {
    const payload = this.decodeJwtPayload(token);

    const id =
      this.readClaim(payload, [
        'sub',
        'nameid',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
      ]) ?? '';

    const email =
      this.readClaim(payload, [
        'email',
        'unique_name',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      ]) ?? '';

    const role =
      this.readClaim(payload, [
        'role',
        'roles',
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
      ]) ?? 'guest';

    return { id, email, role };
  }

  private readClaim(
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

  private normalizeRole(role: string | undefined): string {
    return (role ?? '').trim().toLowerCase();
  }

  private decodeJwtPayload(token: string): Record<string, unknown> {
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
}
