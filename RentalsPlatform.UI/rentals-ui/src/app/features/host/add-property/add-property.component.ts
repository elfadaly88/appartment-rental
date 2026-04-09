import {
  ChangeDetectionStrategy,
  Component,
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
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-property',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-property.component.html',
  styleUrl: './add-property.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddPropertyComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly currentStep = signal(1);
  readonly isSubmitting = signal(false);
  readonly selectedFiles = signal<File[]>([]);
  readonly isDragOver = signal(false);

  readonly totalSteps = 4;
  readonly stepItems = [
    { id: 1, ar: 'البيانات الأساسية', en: 'Basic Info' },
    { id: 2, ar: 'الموقع', en: 'Location' },
    { id: 3, ar: 'التسعير', en: 'Pricing' },
    { id: 4, ar: 'الصور', en: 'Images' },
  ] as const;

  readonly form = this.fb.group({
    basicInfo: this.fb.group({
      nameAr: this.fb.control('', [Validators.required, Validators.minLength(3)]),
      nameEn: this.fb.control('', [Validators.required, Validators.minLength(3)]),
      descriptionAr: this.fb.control('', [Validators.required, Validators.minLength(20)]),
      descriptionEn: this.fb.control('', [Validators.required, Validators.minLength(20)]),
    }),
    location: this.fb.group({
      country: this.fb.control('', [Validators.required]),
      city: this.fb.control('', [Validators.required]),
      street: this.fb.control('', [Validators.required]),
      zipCode: this.fb.control('', [Validators.required]),
    }),
    pricing: this.fb.group({
      pricePerNight: this.fb.control(0, [Validators.required, Validators.min(1)]),
    }),
  });

  readonly progressPercentage = computed(
    () => (this.currentStep() / this.totalSteps) * 100,
  );

  readonly canGoPrev = computed(() => this.currentStep() > 1);
  readonly canGoNext = computed(() => this.currentStep() < this.totalSteps);

  readonly currentStepLabel = computed(() => {
    const step = this.stepItems.find((item) => item.id === this.currentStep());
    return step?.en ?? '';
  });

  get basicInfoGroup() {
    return this.form.controls.basicInfo;
  }

  get locationGroup() {
    return this.form.controls.location;
  }

  get pricingGroup() {
    return this.form.controls.pricing;
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

  jumpToStep(step: number): void {
    if (step < 1 || step > this.totalSteps) return;
    this.currentStep.set(step);
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

  async submitForm(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.selectedFiles().length === 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Missing required data',
        text: 'Please complete all steps and upload at least one image.',
      });
      return;
    }

    this.isSubmitting.set(true);

    try {
      const { basicInfo, location, pricing } = this.form.getRawValue();

      // FormData payload for .NET API file upload endpoint
      const formData = new FormData();

      // Basic Info
      formData.append('nameAr', basicInfo.nameAr);
      formData.append('nameEn', basicInfo.nameEn);
      formData.append('descriptionAr', basicInfo.descriptionAr);
      formData.append('descriptionEn', basicInfo.descriptionEn);

      // Location
      formData.append('country', location.country);
      formData.append('city', location.city);
      formData.append('street', location.street);
      formData.append('zipCode', location.zipCode);

      // Pricing
      formData.append('pricePerNight', String(pricing.pricePerNight));

      // Images - append each image file under a repeated key expected by .NET backend
      this.selectedFiles().forEach((file) => {
        formData.append('images', file, file.name);
      });

      // Example API call integration point:
      // await firstValueFrom(this.hostService.createProperty(formData));

      await Swal.fire({
        icon: 'success',
        title: 'Property added successfully',
        text: 'Your luxury listing has been submitted for review.',
      });

      this.form.reset({
        basicInfo: {
          nameAr: '',
          nameEn: '',
          descriptionAr: '',
          descriptionEn: '',
        },
        location: {
          country: '',
          city: '',
          street: '',
          zipCode: '',
        },
        pricing: {
          pricePerNight: 0,
        },
      });
      this.selectedFiles.set([]);
      this.currentStep.set(1);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private addFiles(files: File[]): void {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) return;

    this.selectedFiles.update((current) => [...current, ...imageFiles]);
  }
}
