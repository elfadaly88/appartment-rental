import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { PropertyFormComponent } from './property-form.component';

@Component({
  selector: 'app-edit-property',
  standalone: true,
  imports: [PropertyFormComponent],
  template: `
    <app-property-form
      [resolvedProperty]="resolvedProperty()"
      [resolvedPropertyId]="propertyId()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditPropertyComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly resolvedProperty = () =>
    this.route.snapshot.data['property'] ?? null;

  protected readonly propertyId = () =>
    this.route.snapshot.paramMap.get('id');
}
