import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { Property } from '../../models/property.model';
import { PropertyCard } from '../property-card/property-card';

@Component({
  selector: 'app-properties-list',
  imports: [PropertyCard],
  templateUrl: './properties-list.html',
  styleUrl: './properties-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesList {
  readonly properties = input.required<Property[]>();
  readonly locale = input<'ar' | 'en'>('en');

  protected readonly heading = computed(() =>
    this.locale() === 'ar' ? 'العقارات المميزة' : 'Featured Properties'
  );

  protected readonly emptyMessage = computed(() =>
    this.locale() === 'ar'
      ? 'لا توجد عقارات متاحة حالياً'
      : 'No properties available at this time'
  );

  protected readonly trackById = (_index: number, property: Property) =>
    property.id;
}
