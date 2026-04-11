import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface PublicProfileResponse {
  id: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  joinedDate: string;
  roles: string[];
  averageRating?: number;
}

@Component({
  selector: 'app-public-profile',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './public-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfileComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  readonly profile = signal<PublicProfileResponse | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const userId = this.route.snapshot.paramMap.get('id');
    if (!userId) {
      this.error.set('No user specified.');
      this.isLoading.set(false);
      return;
    }

    try {
      const data = await firstValueFrom(
        this.http.get<PublicProfileResponse>(`${environment.apiUrl}/profile/${userId}`)
      );
      this.profile.set(data);
    } catch (err) {
      console.error('Failed to load profile', err);
      this.error.set('Could not load this user profile.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
