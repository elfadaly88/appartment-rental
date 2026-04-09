import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  Signal,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import {
  GovernorateDto,
  LookupService,
} from '../../../core/services/lookup.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-location-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './location-step.component.html',
  styleUrl: './location-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': "currentLang() === 'ar' ? 'rtl' : 'ltr'",
    '[attr.lang]': 'currentLang()',
  },
})
export class LocationStepComponent implements OnInit {
  private readonly lookupService = inject(LookupService);
  protected readonly lang = inject(LanguageService);

  readonly locationForm = input.required<
    FormGroup<{
      governorateId: FormControl<string | null>;
      cityId: FormControl<string | null>;
    }>
  >();

  readonly governorates = signal<GovernorateDto[]>([]);

  selectedGovId!: Signal<string | null>;

  readonly availableCities = computed(() => {
    const govId = this.selectedGovId();
    if (!govId) {
      return [];
    }

    const gov = this.governorates().find((item) => item.id === govId);
    return gov?.cities ?? [];
  });

  readonly currentLang = this.lang.currentLang;

  constructor() {}

  ngOnInit(): void {
    const form = this.locationForm();

    this.selectedGovId = toSignal(
      form.controls.governorateId.valueChanges.pipe(
        startWith(form.controls.governorateId.value),
      ),
      { initialValue: form.controls.governorateId.value },
    );

    effect(() => {
      const govId = this.selectedGovId();
      const cityControl = form.controls.cityId;

      cityControl.setValue(null, { emitEvent: false });

      if (govId) {
        cityControl.enable({ emitEvent: false });
      } else {
        cityControl.disable({ emitEvent: false });
      }
    });

    this.lookupService
      .getEgyptLocations()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (locations) => {
          this.governorates.set(locations ?? []);
        },
        error: () => {
          this.governorates.set([]);
        },
      });
  }

  protected isGovFilled(): boolean {
    return Boolean(this.locationForm().controls.governorateId.value);
  }

  protected isCityFilled(): boolean {
    return Boolean(this.locationForm().controls.cityId.value);
  }

  protected isCityDisabled(): boolean {
    return this.locationForm().controls.cityId.disabled;
  }
}
