import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { StateCleanupService } from '../services/state-cleanup.service';

export interface User {
  id: string;
  email: string;
  role: string;
  fullName?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterGuestPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface RegisterHostPayload {
  fullName: string;
  email: string;
  password: string;
  acceptedHostTerms: boolean;
}

interface AuthResponse {
  token: string;
  fullName: string;
  email: string;
  isSuccess: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly stateCleanup = inject(StateCleanupService);
  private readonly router = inject(Router);
  private readonly authApiUrl = `${environment.apiUrl}/auth`;

  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isAdmin = computed(() => this.normalizeRole(this.currentUser()?.role) === 'admin');
  readonly isHost = computed(() => this.normalizeRole(this.currentUser()?.role) === 'host');

  constructor() {
    this.restoreSessionFromStorage();
  }

  async login(credentials: LoginCredentials): Promise<User> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.authApiUrl}/login`, credentials),
    );

    return this.persistAndDecodeToken(response.token);
  }

  async registerGuest(data: RegisterGuestPayload): Promise<User> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.authApiUrl}/register/guest`, data),
    );

    return this.persistAndDecodeToken(response.token);
  }

  async registerHost(data: RegisterHostPayload): Promise<User> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.authApiUrl}/register/host`, data),
    );

    return this.persistAndDecodeToken(response.token);
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('jwtToken');
      this.clearAllStorage();
    }

    this.currentUser.set(null);
    this.stateCleanup.resetAllStores();

    // Redirect to login safely after logout
    if (isPlatformBrowser(this.platformId)) {
      void this.router.navigate(['/auth']);
    }
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    return localStorage.getItem('jwtToken');
  }

  private restoreSessionFromStorage(): void {
    const token = this.getToken();
    if (!token) {
      return;
    }

    try {
      const user = this.decodeUserFromToken(token);
      this.currentUser.set(user);
    } catch {
      this.logout();
    }
  }

  private persistAndDecodeToken(token: string): User {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('jwtToken', token);
    }

    const user = this.decodeUserFromToken(token);
    this.currentUser.set(user);
    return user;
  }

  private decodeUserFromToken(token: string): User {
    const payload = this.decodeJwtPayload(token);

    const exp = payload['exp'];
    if (typeof exp === 'number' && exp * 1000 <= Date.now()) {
      throw new Error('Token expired');
    }

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

    const fullName =
      this.readClaim(payload, ['FullName', 'unique_name', 'name', 'given_name']) ?? undefined;

    const displayName = this.readClaim(payload, ['DisplayName']) ?? undefined;
    const avatarUrl = this.readClaim(payload, ['AvatarUrl', 'ProfilePictureUrl']) ?? undefined;
    const bio = this.readClaim(payload, ['Bio']) ?? undefined;

    return { id, email, role, fullName, displayName, avatarUrl, bio };
  }

  updateProfileData(data: { displayName?: string; bio?: string; avatarUrl?: string }): void {
    this.currentUser.update(user => {
      if (!user) return user;
      return {
        ...user,
        displayName: data.displayName ?? user.displayName,
        bio: data.bio ?? user.bio,
        avatarUrl: data.avatarUrl ?? user.avatarUrl
      };
    });
  }

  private readClaim(payload: Record<string, unknown>, keys: string[]): string | null {
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

  private decodeJwtPayload(token: string): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token');
    }

    if (!isPlatformBrowser(this.platformId)) {
      return {};
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);

    return JSON.parse(json) as Record<string, unknown>;
  }

  private normalizeRole(role: string | undefined): string {
    return (role ?? '').trim().toLowerCase();
  }

  private clearAllStorage(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.startsWith('ngx-translate')) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }
}
