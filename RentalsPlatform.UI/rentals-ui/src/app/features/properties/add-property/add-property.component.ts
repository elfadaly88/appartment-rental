import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';
import { PropertyService } from '../services/property.service';
import { LocationStepComponent } from './location-step.component';
import { GovernorateDto, LookupService } from '../../../core/services/lookup.service';

@Component({
  selector: 'app-add-property',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LocationStepComponent],
  templateUrl: './add-property.component.html',
  styleUrl: './add-property.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddPropertyComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly propertyService = inject(PropertyService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lookupService = inject(LookupService);

  readonly currentStep = signal(1);
  readonly isSubmitting = signal(false);
  readonly uploadProgress = signal<number>(0);
  readonly selectedFiles = signal<File[]>([]);
  readonly isDragOver = signal(false);
  readonly governorates = signal<GovernorateDto[]>([]);

  readonly totalSteps = 4;
  readonly stepItems = [
    { id: 1, label: 'Basic Info' },
    { id: 2, label: 'Location' },
    { id: 3, label: 'Pricing' },
    { id: 4, label: 'Images' },
  ] as const;

  readonly form = this.fb.group({
    basicInfo: this.fb.group({
      nameAr: this.fb.control('', [Validators.required, Validators.minLength(3)]),
      nameEn: this.fb.control('', [Validators.required, Validators.minLength(3)]),
      descriptionAr: this.fb.control('', [Validators.required, Validators.minLength(20)]),
      descriptionEn: this.fb.control('', [Validators.required, Validators.minLength(20)]),
    }),
    location: this.fb.group({
      governorateId: this.fb.control<string | null>(null, [Validators.required]),
      cityId: this.fb.control<string | null>(null, [Validators.required]),
    }),
    pricing: this.fb.group({
      pricePerNight: this.fb.control(0, [Validators.required, Validators.min(1)]),
    }),
  });

  readonly wizardProgress = computed(
    () => (this.currentStep() / this.totalSteps) * 100,
  );

  readonly canGoPrev = computed(() => this.currentStep() > 1);
  readonly canGoNext = computed(() => this.currentStep() < this.totalSteps);

  get basicInfoGroup() {
    return this.form.controls.basicInfo;
  }

  get locationGroup() {
    return this.form.controls.location;
  }

  get pricingGroup() {
    return this.form.controls.pricing;
  }

  ngOnInit(): void {
    this.lookupService
      .getEgyptLocations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.governorates.set(data ?? []),
        error: () => this.governorates.set([]),
      });
  }

  nextStep(): void {
    if (this.currentStep() === 1) {
      this.basicInfoGroup.markAllAsTouched();
      if (this.basicInfoGroup.invalid) return;
    }

    if (this.currentStep() === 2) {
      this.locationGroup.markAllAsTouched();
      if (this.locationGroup.invalid) return;
    }

    if (this.currentStep() === 3) {
      this.pricingGroup.markAllAsTouched();
      if (this.pricingGroup.invalid) return;
    }

    this.currentStep.update((value) => Math.min(value + 1, this.totalSteps));
  }

  prevStep(): void {
    this.currentStep.update((value) => Math.max(value - 1, 1));
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);

    const files = Array.from(event.dataTransfer?.files ?? []);
    this.addFiles(files);
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.addFiles(files);
    input.value = '';
  }

  removeFile(index: number): void {
    this.selectedFiles.update((files) => files.filter((_, i) => i !== index));
  }

  submitForm(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.selectedFiles().length === 0) {
      void Swal.fire({
        icon: 'warning',
        title: 'Missing required data',
        text: 'Please complete all steps and upload at least one image.',
      });
      return;
    }

    const { basicInfo, location, pricing } = this.form.getRawValue();
    const selectedGovernorate = this.governorates().find(
      (gov) => gov.id === location.governorateId,
    );
    const selectedCity = selectedGovernorate?.cities.find(
      (city) => city.id === location.cityId,
    );

    const formData = new FormData();
    formData.append('nameAr', basicInfo.nameAr);
    formData.append('nameEn', basicInfo.nameEn);
    formData.append('descriptionAr', basicInfo.descriptionAr);
    formData.append('descriptionEn', basicInfo.descriptionEn);
    formData.append('governorateId', location.governorateId ?? '');
    formData.append('cityId', location.cityId ?? '');
    // Send both IDs and readable names for backend processing and analytics dimensions.
    formData.append('governorateNameAr', selectedGovernorate?.nameAr ?? '');
    formData.append('governorateNameEn', selectedGovernorate?.nameEn ?? '');
    formData.append('cityNameAr', selectedCity?.nameAr ?? '');
    formData.append('cityNameEn', selectedCity?.nameEn ?? '');
    formData.append('pricePerNight', String(pricing.pricePerNight));

    this.selectedFiles().forEach((file) => {
      formData.append('images', file, file.name);
    });

    this.isSubmitting.set(true);
    this.uploadProgress.set(0);

    this.propertyService
      .createProperty(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const total = event.total ?? event.loaded;
            const percentage = total > 0 ? Math.round((100 * event.loaded) / total) : 0;
            this.uploadProgress.set(percentage);
          }

          if (event.type === HttpEventType.Response) {
            this.uploadProgress.set(100);

            void Swal.fire({
              icon: 'success',
              title: 'Property created',
              text: 'Your listing was uploaded successfully.',
            }).then(() => {
              this.form.reset({
                basicInfo: {
                  nameAr: '',
                  nameEn: '',
                  descriptionAr: '',
                  descriptionEn: '',
                },
                location: {
                  governorateId: null,
                  cityId: null,
                },
                pricing: {
                  pricePerNight: 0,
                },
              });
              this.selectedFiles.set([]);
              this.currentStep.set(1);
              this.uploadProgress.set(0);
              this.isSubmitting.set(false);
              void this.router.navigateByUrl('/host/dashboard');
            });
          }
        },
        error: () => {
          this.isSubmitting.set(false);
          this.uploadProgress.set(0);
          void Swal.fire({
            icon: 'error',
            title: 'Upload failed',
            text: 'We could not upload your property. Please try again.',
          });
        },
      });
  }

  private addFiles(files: File[]): void {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) return;

    this.selectedFiles.update((current) => [...current, ...imageFiles]);
  }
}
