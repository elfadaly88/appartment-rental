import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';
import { Property } from '../../models/property.model';
import { PropertyCard } from '../property-card/property-card';
import { PropertyGallery } from '../property-gallery/property-gallery';
import { signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-properties-list',
  imports: [PropertyCard, PropertyGallery, TranslateModule],
  templateUrl: './properties-list.html',
  styleUrl: './properties-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesList {
  readonly properties = input.required<Property[]>();
  readonly locale = input<'ar' | 'en'>('en');

  protected readonly selectedPropertyId = signal<string | null>(null);

  protected readonly trackById = (_index: number, property: Property) =>
    property.id;
}
