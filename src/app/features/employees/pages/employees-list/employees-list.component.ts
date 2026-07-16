import { DatePipe } from '@angular/common';

import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';

import {
  MatFormFieldModule,
} from '@angular/material/form-field';

import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import {
  MatPaginatorIntl,
  MatPaginatorModule,
  PageEvent,
} from '@angular/material/paginator';

import {
  MatProgressSpinnerModule,
} from '@angular/material/progress-spinner';

import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import {
  MatTooltipModule,
} from '@angular/material/tooltip';

import {
  debounceTime,
  distinctUntilChanged,
  Subject,
} from 'rxjs';

import {
  PlantsService,
} from '../../../plants/data-access/plants.service';

import {
  ShiftsService,
} from '../../../shifts/data-access/shifts.service';

import {
  EmployeeDirectoryItem,
  EmployeeStatusFilter,
  EmployeesService,
} from '../../data-access/employees.service';

@Component({
  selector: 'app-employees-list',
  imports: [
    DatePipe,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl:
    './employees-list.component.html',
  styleUrl:
    './employees-list.component.scss',
})
export class EmployeesListComponent
  implements OnInit {
  private readonly paginatorIntl =
    inject(MatPaginatorIntl);

  private readonly searchChanges =
    new Subject<string>();

  readonly employeesService =
    inject(EmployeesService);

  readonly plantsService =
    inject(PlantsService);

  readonly shiftsService =
    inject(ShiftsService);

  readonly searchTerm = signal('');
  readonly selectedPlantId = signal('all');
  readonly selectedShiftId = signal('all');

  readonly selectedStatus =
    signal<EmployeeStatusFilter>('all');

  readonly pageIndex = signal(0);
  readonly pageSize = signal(25);

  readonly pageSizeOptions = [
    25,
    50,
    100,
  ];

  readonly displayedColumns = [
    'employee',
    'employeeNumber',
    'plant',
    'shift',
    'line',
    'department',
    'position',
    'serviceDate',
    'status',
  ];

  readonly isLoading = computed(
    () =>
      this.employeesService.isLoading()
      || this.plantsService.isLoading()
      || this.shiftsService.isLoading(),
  );

  readonly currentPageCount = computed(
    () =>
      this.employeesService
        .employees()
        .length,
  );

  readonly currentPageWithPhoto = computed(
    () =>
      this.employeesService
        .employees()
        .filter(
          employee =>
            employee.photoPath !== null,
        )
        .length,
  );

  readonly currentPageWithoutLine = computed(
    () =>
      this.employeesService
        .employees()
        .filter(
          employee =>
            employee.productionLineId === null,
        )
        .length,
  );

  constructor() {
    this.configurePaginatorLabels();

    this.searchChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.pageIndex.set(0);
        void this.loadEmployees();
      });
  }

  ngOnInit(): void {
    void this.initialize();
  }

  updateSearch(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.searchTerm.set(input.value);
    this.searchChanges.next(input.value);
  }

  clearSearch(): void {
    if (!this.searchTerm()) {
      return;
    }

    this.searchTerm.set('');
    this.searchChanges.next('');
  }

  applyFilters(): void {
    this.pageIndex.set(0);
    void this.loadEmployees();
  }

  handlePageChange(
    event: PageEvent,
  ): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);

    void this.loadEmployees();
  }

  async reload(): Promise<void> {
    await this.loadEmployees();
  }

  initials(
    employee: EmployeeDirectoryItem,
  ): string {
    return employee.fullName
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        part =>
          part.charAt(0).toUpperCase(),
      )
      .join('');
  }

  private async initialize(): Promise<void> {
    await Promise.all([
      this.plantsService.loadPlants(),
      this.shiftsService.loadShifts(),
      this.loadEmployees(),
    ]);
  }

  private async loadEmployees(): Promise<void> {
    await this.employeesService.searchEmployees({
      search: this.searchTerm(),

      plantId:
        this.selectedPlantId() === 'all'
          ? null
          : this.selectedPlantId(),

      shiftId:
        this.selectedShiftId() === 'all'
          ? null
          : this.selectedShiftId(),

      status:
        this.selectedStatus(),

      pageIndex:
        this.pageIndex(),

      pageSize:
        this.pageSize(),
    });
  }

  private configurePaginatorLabels(): void {
    this.paginatorIntl.itemsPerPageLabel =
      'Registros por página';

    this.paginatorIntl.nextPageLabel =
      'Página siguiente';

    this.paginatorIntl.previousPageLabel =
      'Página anterior';

    this.paginatorIntl.firstPageLabel =
      'Primera página';

    this.paginatorIntl.lastPageLabel =
      'Última página';

    this.paginatorIntl.getRangeLabel = (
      page: number,
      pageSize: number,
      length: number,
    ): string => {
      if (length === 0 || pageSize === 0) {
        return `0 de ${length}`;
      }

      const startIndex =
        page * pageSize;

      const endIndex = Math.min(
        startIndex + pageSize,
        length,
      );

      return `${
        startIndex + 1
      }–${endIndex} de ${length}`;
    };

    this.paginatorIntl.changes.next();
  }
}
