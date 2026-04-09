import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PropertyMediaService } from '../services/property-media.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-upload.component.html',
  styleUrl: './image-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class ImageUploadComponent {
  readonly propertyId = input<string>('');
  readonly propertyTitle = input<string>('');

  readonly selectedFiles = signal<File[]>([]);
  readonly previews = signal<string[]>([]);
  readonly isDragging = signal<boolean>(false);
  readonly uploadProgress = signal(0);
  readonly isUploading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  private readonly propertyMediaService = inject(PropertyMediaService);
  protected readonly lang = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly selectedCount = computed(() => this.selectedFiles().length);
  protected readonly uploadLabel = computed(() => {
    const count = this.selectedCount();
    if (this.isUploading()) {
      return this.t('جارٍ الرفع...', 'Uploading...');
    }

    return count === 1
      ? this.t('رفع صورة واحدة', 'Upload 1 Image')
      : this.t(`رفع ${count} صور`, `Upload ${count} Images`);
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.revokePreviews(this.previews());
    });
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.isUploading()) {
      return;
    }

    this.isDragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();

    const container = event.currentTarget;
    const nextTarget = event.relatedTarget;
    if (container instanceof Node && nextTarget instanceof Node && container.contains(nextTarget)) {
      return;
    }

    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);

    if (this.isUploading()) {
      return;
    }

    const files = Array.from(event.dataTransfer?.files ?? []);
    this.addFiles(files);
  }

  protected onFileSelection(event: Event): void {
    if (this.isUploading()) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.addFiles(files);
    input.value = '';
  }

  protected removeFile(index: number): void {
    if (this.isUploading()) {
      return;
    }

    const currentFiles = this.selectedFiles();
    const currentPreviews = this.previews();
    const previewToRemove = currentPreviews[index];

    if (previewToRemove) {
      URL.revokeObjectURL(previewToRemove);
    }

    this.selectedFiles.set(currentFiles.filter((_, itemIndex) => itemIndex !== index));
    this.previews.set(currentPreviews.filter((_, itemIndex) => itemIndex !== index));
    this.successMessage.set(null);
  }

  protected upload(): void {
    const propertyId = this.propertyId().trim();
    const files = this.selectedFiles();

    if (!propertyId || !files.length || this.isUploading()) {
      return;
    }

    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.propertyMediaService
      .uploadImages(propertyId, files)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const total = event.total ?? event.loaded;
            const progress = total > 0 ? Math.round((event.loaded / total) * 100) : 0;
            this.uploadProgress.set(progress);
          }

          if (event.type === HttpEventType.Response) {
            this.uploadProgress.set(100);
            this.successMessage.set(this.t('تم رفع الصور بنجاح.', 'Images uploaded successfully.'));
            this.resetSelection();
            this.isDragging.set(false);
            this.isUploading.set(false);
          }
        },
        error: () => {
          this.errorMessage.set(this.t('تعذر رفع الصور. حاول مرة أخرى.', 'Unable to upload images. Please try again.'));
          this.isDragging.set(false);
          this.isUploading.set(false);
          this.uploadProgress.set(0);
        },
      });
  }

  protected trackPreview(index: number, preview: string): string {
    return `${index}-${preview}`;
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  private addFiles(files: File[]): void {
    const nextFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!nextFiles.length) {
      return;
    }

    const nextPreviews = nextFiles.map((file) => URL.createObjectURL(file));
    this.selectedFiles.update((current) => [...current, ...nextFiles]);
    this.previews.update((current) => [...current, ...nextPreviews]);
    this.isDragging.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  private resetSelection(): void {
    this.revokePreviews(this.previews());
    this.selectedFiles.set([]);
    this.previews.set([]);
  }

  private revokePreviews(previews: string[]): void {
    for (const preview of previews) {
      URL.revokeObjectURL(preview);
    }
  }
}
