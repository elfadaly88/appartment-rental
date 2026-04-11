import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

interface ProfileResponse {
  email: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly toastMessage = signal<string | null>(null);
  readonly previewUrl = signal<string | null>(null);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  selectedFile: File | null = null;

  readonly profileForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.maxLength(100)]],
    bio: ['', [Validators.maxLength(500)]],
  });

  async ngOnInit(): Promise<void> {
    try {
      const profile = await firstValueFrom(
        this.http.get<ProfileResponse>(`${environment.apiUrl}/profile/me`)
      );

      this.profileForm.patchValue({
        displayName: profile.displayName ?? '',
        bio: profile.bio ?? '',
      });
      
      if (profile.avatarUrl) {
        this.previewUrl.set(profile.avatarUrl);
      }
    } catch (error) {
      console.error('Failed to load profile', error);
      this.showToast('Failed to load profile data.');
    } finally {
      this.isLoading.set(false);
    }
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      this.showToast('File size must be under 2MB.');
      (event.target as HTMLInputElement).value = '';
      return;
    }

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      this.showToast('Please upload a valid JPEG or PNG image.');
      (event.target as HTMLInputElement).value = '';
      return;
    }

    this.selectedFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) return;

    this.isSaving.set(true);

    const formData = new FormData();
    const { displayName, bio } = this.profileForm.getRawValue();
    
    if (displayName) formData.append('displayName', displayName);
    if (bio) formData.append('bio', bio);
    if (this.selectedFile) formData.append('avatar', this.selectedFile);

    try {
      const currentProfile = await firstValueFrom(
        this.http.put<ProfileResponse>(`${environment.apiUrl}/profile`, formData)
      );

      // Update AuthStore immediately
      this.authService.updateProfileData({
        displayName: currentProfile.displayName,
        bio: currentProfile.bio,
        avatarUrl: currentProfile.avatarUrl
      });

      this.showToast('Profile updated successfully!');
      this.selectedFile = null;
    } catch (error) {
      console.error('Failed to save profile', error);
      this.showToast('Error saving profile. Please try again.');
    } finally {
      this.isSaving.set(false);
    }
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3000);
  }
}
