import { AfterViewInit, ChangeDetectionStrategy, Component, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';

// Angular Material Imports - استورد الموديولات فقط
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { AdminBookingDto, AdminService } from '../admin.service';

@Component({
  selector: 'app-admin-bookings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    MatTableModule,          // ده كافي جداً لكل ما يخص الجدول
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './admin-bookings.component.html',
  styleUrl: './admin-bookings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBookingsComponent implements AfterViewInit {
  private readonly adminService = inject(AdminService);

  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly filterControl = new FormControl('', { nonNullable: true });
  protected readonly displayedColumns = [
    'property',
    'guest',
    'dates',
    'bookingStatus',
    'paymentStatus',
    'transactionId',
    'amount',
  ];

  protected readonly dataSource = new MatTableDataSource<AdminBookingDto>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor() {
    this.dataSource.filterPredicate = (item: AdminBookingDto, filter: string) => {
      const f = filter.trim().toLowerCase();
      return [
        item.propertyTitle,
        item.guestEmail,
        item.hostName,
        item.bookingStatus,
        item.paymentStatus,
        item.transactionId ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(f);
    };

    this.filterControl.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged())
      .subscribe((value) => {
        this.dataSource.filter = value;
        if (this.dataSource.paginator) {
          this.dataSource.paginator.firstPage();
        }
      });

    void this.load();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  protected async load(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const rows = await firstValueFrom(this.adminService.getAllBookings());
      this.dataSource.data = rows;
    } catch {
      this.error.set('ADMIN.BOOKINGS.ERROR');
      this.dataSource.data = [];
    } finally {
      this.isLoading.set(false);
    }
  }

  protected paymentChipClass(status: string): string {
    return status.toLowerCase() === 'paid' 
      ? 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' 
      : 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/20';
  }

  protected bookingChipClass(status: string): string {
    const normalized = status.toLowerCase();
    if (normalized === 'confirmed' || normalized === 'completed') {
      return 'bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-600/20';
    }
    if (normalized === 'cancelled') {
      return 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-600/20';
    }

    return 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/20';
  }
}