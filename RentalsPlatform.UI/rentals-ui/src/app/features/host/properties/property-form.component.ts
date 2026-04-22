import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter, firstValueFrom, startWith, tap } from 'rxjs';
import Swal from 'sweetalert2';
import { LanguageService } from '../../../core/services/language.service';
import {
  HostPropertyDetails,
  PropertyService,
} from '../services/property.service';

interface MediaPreview {
  file: File;
  previewUrl: string;
}

interface PropertyDraft {
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  category: string;
  country: string;
  city: string;
  street: string;
  zipCode: string;
  mapUrl: string;
  pricePerNight: number;
  maxGuests: number;
  houseRules: string;
  amenitiesText: string;
  media: MediaPreview[];
}

interface PropertyWizardState {
  step: number;
  draft: PropertyDraft;
}

@Component({
  selector: 'app-property-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './property-form.component.html',
  styleUrl: './property-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PropertyFormComponent implements OnDestroy {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly propertyService = inject(PropertyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  protected readonly lang = inject(LanguageService);
  protected readonly isRtl = computed(() => this.lang.dir() === 'rtl');

  readonly resolvedPropertyId = input<string | null>(null);
  readonly resolvedProperty = input<HostPropertyDetails | null>(null);

  readonly totalSteps = 4;
  readonly isDragOver = signal(false);
  readonly mediaTouched = signal(false);
  readonly existingImages = signal<HostPropertyDetails['images']>([]);
  private readonly hydratedPropertyId = signal<string | null>(null);

  readonly wizardState = signal<PropertyWizardState>({
    step: 1,
    draft: {
      nameAr: '',
      nameEn: '',
      descriptionAr: '',
      descriptionEn: '',
      category: 'villa',
      country: 'Egypt',
      city: '',
      street: '',
      zipCode: '',
      mapUrl: '',
      pricePerNight: 1,
      maxGuests: 1,
      houseRules: '',
      amenitiesText: 'Wi-Fi, Pool, Parking',
      media: [],
    },
  });

  readonly stepItems = [
    { id: 1, key: 'HOST_FORM.STEP_ESSENTIALS' },
    { id: 2, key: 'HOST_FORM.STEP_LOCATION' },
    { id: 3, key: 'HOST_FORM.STEP_DETAILS' },
    { id: 4, key: 'HOST_FORM.STEP_MEDIA' },
  ] as const;

  readonly form = this.fb.group({
    nameAr: this.fb.control('', [Validators.required, Validators.minLength(3)]),
    nameEn: this.fb.control('', [Validators.required, Validators.minLength(3)]),
    descriptionAr: this.fb.control('', [Validators.required, Validators.minLength(30)]),
    descriptionEn: this.fb.control('', [Validators.required, Validators.minLength(30)]),
    category: this.fb.control('villa', [Validators.required]),
    country: this.fb.control('Egypt', [Validators.required]),
    city: this.fb.control('', [Validators.required]),
    street: this.fb.control('', [Validators.required]),
    zipCode: this.fb.control(''),   // optional — not required in this region
    mapUrl: this.fb.control('', [Validators.pattern(/^$|https?:\/\/.+/i)]),
    pricePerNight: this.fb.control(1, [Validators.required, Validators.min(1)]),
    maxGuests: this.fb.control(1, [Validators.required, Validators.min(1)]),
    houseRules: this.fb.control(''),
    amenitiesText: this.fb.control('Wi-Fi, Pool, Parking'),
  });

  readonly uploadProgress = this.propertyService.uploadProgress;
  readonly isSaving = this.propertyService.isSaving;
  readonly propertyId = computed(() => this.resolvedPropertyId() ?? this.route.snapshot.paramMap.get('id'));
  readonly isEditMode = computed(() => Boolean(this.propertyId()));
  readonly currentStep = computed(() => this.wizardState().step);
  readonly canGoBack = computed(() => this.currentStep() > 1);
  readonly canGoForward = computed(() => this.currentStep() < this.totalSteps);
  readonly progress = computed(() => (this.currentStep() / this.totalSteps) * 100);
  readonly previews = computed(() => this.wizardState().draft.media);
  readonly hasMediaError = computed(
    () => this.mediaTouched() && !this.isEditMode() && this.previews().length === 0,
  );
  readonly isCurrentStepValid = computed(() => {
    const step = this.currentStep();
    if (step === 1) {
      return this.form.controls.nameAr.valid
        && this.form.controls.nameEn.valid
        && this.form.controls.descriptionAr.valid
        && this.form.controls.descriptionEn.valid
        && this.form.controls.category.valid;
    }

    if (step === 2) {
      return this.form.controls.country.valid
        && this.form.controls.city.valid
        && this.form.controls.street.valid
        && this.form.controls.mapUrl.valid;   // zipCode optional
    }

    if (step === 3) {
      return this.form.controls.pricePerNight.valid
        && this.form.controls.maxGuests.valid
        && this.form.controls.amenitiesText.valid;   // houseRules is optional
    }

    return this.isEditMode() || this.previews().length > 0;
  });

  constructor() {
    this.form.valueChanges
      .pipe(startWith(this.form.getRawValue()), takeUntilDestroyed())
      .subscribe((value) => {
        this.wizardState.update((state) => ({
          ...state,
          draft: {
            ...state.draft,
            nameAr: value.nameAr ?? '',
            nameEn: value.nameEn ?? '',
            descriptionAr: value.descriptionAr ?? '',
            descriptionEn: value.descriptionEn ?? '',
            category: value.category ?? 'villa',
            country: value.country ?? 'Egypt',
            city: value.city ?? '',
            street: value.street ?? '',
            zipCode: value.zipCode ?? '',
            mapUrl: value.mapUrl ?? '',
            pricePerNight: value.pricePerNight ?? 1,
            maxGuests: value.maxGuests ?? 1,
            houseRules: value.houseRules ?? '',
            amenitiesText: value.amenitiesText ?? '',
          },
        }));
      });

    effect(() => {
      const id = this.propertyId();
      if (!id) {
        return;
      }

      const resolved = this.resolvedProperty();
      if (resolved && this.hydratedPropertyId() !== resolved.id) {
        this.applyPropertyData(resolved);
        return;
      }

      if (!resolved && this.hydratedPropertyId() !== id) {
        void this.loadProperty(id);
      }
    });
  }

  ngOnDestroy(): void {
    for (const item of this.previews()) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }

  nextStep(): void {
    if (!this.validateCurrentStep()) {
      void Swal.fire({
        icon: 'warning',
        text: this.tr('HOST_FORM.ERROR_STEP_INVALID'),
      });
      return;
    }

    this.wizardState.update((state) => ({
      ...state,
      step: Math.min(state.step + 1, this.totalSteps),
    }));
  }

  previousStep(): void {
    this.wizardState.update((state) => ({
      ...state,
      step: Math.max(state.step - 1, 1),
    }));
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
    this.mediaTouched.set(true);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.mediaTouched.set(true);
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  removeFile(index: number): void {
    const preview = this.previews()[index];
    URL.revokeObjectURL(preview.previewUrl);
    this.wizardState.update((state) => ({
      ...state,
      draft: {
        ...state.draft,
        media: state.draft.media.filter((_, itemIndex) => itemIndex !== index),
      },
    }));

    if (this.previews().length === 0) {
      this.mediaTouched.set(true);
    }
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    if (!this.isEditMode() && this.previews().length === 0) {
      this.mediaTouched.set(true);
      await Swal.fire({
        icon: 'warning',
        text: this.tr('HOST_FORM.ERROR_MEDIA_REQUIRED'),
      });
      return;
    }

    const payload = this.wizardState().draft;
    const formData = new FormData();

    formData.append('nameAr', payload.nameAr);
    formData.append('nameEn', payload.nameEn);
    formData.append('descriptionAr', payload.descriptionAr);
    formData.append('descriptionEn', payload.descriptionEn);
    formData.append('country', payload.country);
    formData.append('city', payload.city);
    formData.append('street', payload.street);
    formData.append('zipCode', payload.zipCode);
    formData.append('mapUrl', payload.mapUrl);
    formData.append('pricePerNight', String(payload.pricePerNight));
    formData.append('maxGuests', String(payload.maxGuests));
    formData.append('category', payload.category);
    formData.append('houseRules', payload.houseRules || 'Please respect the property and neighbors.');
    formData.append('amenitiesText', payload.amenitiesText);

    this.previews().forEach((item) => {
      formData.append('images', item.file, item.file.name);
    });

    const propertyId = this.propertyId();
    const request$ = propertyId
      ? this.propertyService.updateProperty(propertyId, formData)
      : this.propertyService.createProperty(formData);

    try {
      await firstValueFrom(
        request$.pipe(
          tap((event) => this.propertyService.trackUpload(event)),
          filter((event) => event.type === HttpEventType.Response),
        ),
      );

      await Swal.fire({
        icon: 'success',
        text: this.tr(this.isEditMode() ? 'HOST_FORM.SUCCESS_UPDATE' : 'HOST_FORM.SUCCESS_CREATE'),
      });

      await this.propertyService.loadDashboard();
      await this.router.navigate(['/host/dashboard']);
    } catch {
      this.propertyService.resetSaveState();
      await Swal.fire({
        icon: 'error',
        text: this.tr('HOST_FORM.ERROR_SAVE'),
      });
    }
  }

  protected gotoStep(step: number): void {
    if (step < 1 || step > this.totalSteps) {
      return;
    }

    this.wizardState.update((state) => ({
      ...state,
      step,
    }));
  }

  protected hasControlError(fieldName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[fieldName];
    return control.touched && control.invalid;
  }

  protected getControlError(fieldName: keyof typeof this.form.controls): string {
    const control = this.form.controls[fieldName];
    if (!control.touched || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return this.tr('HOST_FORM.VALIDATION_REQUIRED');
    }

    if (control.errors['minlength']) {
      return this.tr('HOST_FORM.VALIDATION_MIN_LENGTH', {
        min: control.errors['minlength'].requiredLength,
      });
    }

    if (control.errors['min']) {
      return this.tr('HOST_FORM.VALIDATION_MIN', {
        min: control.errors['min'].min,
      });
    }

    if (control.errors['pattern']) {
      return this.tr('HOST_FORM.VALIDATION_URL');
    }

    return this.tr('HOST_FORM.VALIDATION_INVALID');
  }

  protected tr(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  private async loadProperty(id: string): Promise<void> {
    try {
      const property = await firstValueFrom(this.propertyService.getProperty(id));
      this.applyPropertyData(property);
    } catch {
      await Swal.fire({
        icon: 'error',
        text: this.tr('HOST_FORM.ERROR_SAVE'),
      });
      await this.router.navigate(['/host/dashboard']);
    }
  }

  private applyPropertyData(property: HostPropertyDetails): void {
    this.hydratedPropertyId.set(property.id);

    this.form.patchValue({
      nameAr: property.nameAr,
      nameEn: property.nameEn,
      descriptionAr: property.descriptionAr,
      descriptionEn: property.descriptionEn,
      country: property.country,
      city: property.city,
      street: property.street,
      zipCode: property.zipCode,
      mapUrl: property.mapUrl,
      pricePerNight: property.pricePerNight,
      maxGuests: property.maxGuests,
    });
    this.existingImages.set(property.images);

    this.wizardState.update((state) => ({
      ...state,
      draft: {
        ...state.draft,
        nameAr: property.nameAr,
        nameEn: property.nameEn,
        descriptionAr: property.descriptionAr,
        descriptionEn: property.descriptionEn,
        country: property.country,
        city: property.city,
        street: property.street,
        zipCode: property.zipCode,
        mapUrl: property.mapUrl,
        pricePerNight: property.pricePerNight,
        maxGuests: property.maxGuests,
      },
    }));
  }

  private validateCurrentStep(): boolean {
    const fieldGroups = [
      ['nameAr', 'nameEn', 'descriptionAr', 'descriptionEn', 'category'],
      ['country', 'city', 'street', 'mapUrl'],          // zipCode removed (optional)
      ['pricePerNight', 'maxGuests', 'amenitiesText'], // houseRules optional
      [],
    ] as const;

    for (const fieldName of fieldGroups[this.currentStep() - 1]) {
      this.form.controls[fieldName].markAsTouched();
      if (this.form.controls[fieldName].invalid) {
        return false;
      }
    }

    if (this.currentStep() === 4 && !this.isEditMode() && this.previews().length === 0) {
      this.mediaTouched.set(true);
      return false;
    }

    return true;
  }

  private addFiles(files: File[]): void {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      return;
    }

    this.wizardState.update((state) => ({
      ...state,
      draft: {
        ...state.draft,
        media: [
          ...state.draft.media,
          ...imageFiles.map((file) => ({
            file,
            previewUrl: URL.createObjectURL(file),
          })),
        ],
      },
    }));

    this.mediaTouched.set(false);
  }
}