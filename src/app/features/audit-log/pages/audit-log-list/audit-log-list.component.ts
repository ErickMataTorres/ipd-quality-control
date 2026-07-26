import {
  DatePipe,
} from '@angular/common';

import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';

import {
  MatButtonModule,
} from '@angular/material/button';

import {
  MatDialog,
} from '@angular/material/dialog';

import {
  MatFormFieldModule,
} from '@angular/material/form-field';

import {
  MatIconModule,
} from '@angular/material/icon';

import {
  MatInputModule,
} from '@angular/material/input';

import {
  PageEvent,
  MatPaginatorModule,
} from '@angular/material/paginator';

import {
  MatProgressSpinnerModule,
} from '@angular/material/progress-spinner';

import {
  MatSelectModule,
} from '@angular/material/select';

import {
  MatTooltipModule,
} from '@angular/material/tooltip';

import {
  AuditLogDetailDialogComponent,
} from '../../components/audit-log-detail-dialog/audit-log-detail-dialog.component';

import {
  AuditAction,
  AuditActorRole,
  AuditLogActorOption,
  AuditLogEntry,
  AuditLogQuery,
  AuditLogService,
} from '../../data-access/audit-log.service';

type DatePreset =
  | 'today'
  | 'last_7'
  | 'last_30'
  | 'last_90'
  | 'custom';

const ACTION_LABELS:
  Record<AuditAction, string> = {
    insert: 'Alta',
    update: 'Modificación',
    delete: 'Eliminación',
  };

const ROLE_LABELS:
  Record<AuditActorRole, string> = {
    system_administrator:
      'Administrador del sistema',
    quality_manager:
      'Gerente de calidad',
    quality_supervisor:
      'Supervisor de calidad',
    viewer:
      'Usuario de consulta',
  };

const TABLE_LABELS:
  Record<string, string> = {
    plants: 'Plantas',
    shifts: 'Turnos',
    product_models: 'Modelos',
    production_lines:
      'Líneas de producción',
    line_model_assignments:
      'Asignaciones línea-modelo',
    employees: 'Empleados',
    source_location_mappings:
      'Equivalencias HDC',
    user_profiles:
      'Perfiles de usuario',
    user_plant_access:
      'Accesos por planta',
    supervisor_assignments:
      'Asignaciones de supervisores',
    ipd_targets: 'Objetivos IPD',
    defect_types:
      'Tipos de defecto',
    daily_ipd_records:
      'Registros diarios',
    daily_ipd_defects:
      'Detalles de defectos',
};

function formatLocalDate(
  date: Date,
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, '0');

  const day =
    String(
      date.getDate(),
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function todayValue(): string {
  return formatLocalDate(new Date());
}

function subtractDays(
  days: number,
): string {
  const date =
    new Date();

  date.setDate(
    date.getDate() - days,
  );

  return formatLocalDate(date);
}

@Component({
  selector:
    'app-audit-log-list',

  imports: [
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
  ],

  templateUrl:
    './audit-log-list.component.html',

  styleUrl:
    './audit-log-list.component.scss',
})
export class AuditLogListComponent
  implements OnInit, OnDestroy {
  private readonly dialog =
    inject(MatDialog);

  readonly auditLogService =
    inject(AuditLogService);

  readonly selectedPreset =
    signal<DatePreset>('last_30');

  readonly dateFrom =
    signal(subtractDays(29));

  readonly dateTo =
    signal(todayValue());

  readonly selectedTables =
    signal<string[]>([]);

  readonly selectedActions =
    signal<AuditAction[]>([]);

  readonly selectedActorId =
    signal('all');

  readonly searchTerm =
    signal('');

  readonly pageIndex =
    signal(0);

  readonly pageSize =
    signal(25);

  readonly pageSizeOptions = [
    25,
    50,
    100,
  ];

  readonly actionOptions:
    Array<{
      value: AuditAction;
      label: string;
      icon: string;
    }> = [
      {
        value: 'insert',
        label: 'Altas',
        icon: 'add_circle',
      },
      {
        value: 'update',
        label: 'Modificaciones',
        icon: 'edit',
      },
      {
        value: 'delete',
        label: 'Eliminaciones',
        icon: 'delete',
      },
    ];

  private searchTimer:
    ReturnType<typeof setTimeout>
    | null = null;

  readonly hasActiveFilters =
    computed(
      () =>
        this.selectedTables()
          .length > 0
        || this.selectedActions()
          .length > 0
        || this.selectedActorId()
          !== 'all'
        || Boolean(
          this.searchTerm().trim(),
        )
        || this.selectedPreset()
          !== 'last_30',
    );

  readonly resultRange =
    computed(() => {
      const total =
        this.auditLogService
          .totalFiltered();

      if (total === 0) {
        return '0 resultados';
      }

      const first =
        this.pageIndex()
        * this.pageSize()
        + 1;

      const last =
        Math.min(
          first
          + this.auditLogService
            .entries()
            .length
          - 1,
          total,
        );

      return `${first}–${last} de ${total}`;
    });

  ngOnInit(): void {
    void this.initialize();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  applyPreset(
    preset: DatePreset,
  ): void {
    this.selectedPreset.set(preset);

    switch (preset) {
      case 'today':
        this.dateFrom.set(todayValue());
        this.dateTo.set(todayValue());
        break;

      case 'last_7':
        this.dateFrom.set(
          subtractDays(6),
        );
        this.dateTo.set(todayValue());
        break;

      case 'last_30':
        this.dateFrom.set(
          subtractDays(29),
        );
        this.dateTo.set(todayValue());
        break;

      case 'last_90':
        this.dateFrom.set(
          subtractDays(89),
        );
        this.dateTo.set(todayValue());
        break;

      case 'custom':
        return;
    }

    this.resetPageAndLoad();
  }

  handleDateChange(
    field: 'from' | 'to',
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    if (field === 'from') {
      this.dateFrom.set(input.value);
    } else {
      this.dateTo.set(input.value);
    }

    this.selectedPreset.set('custom');
    this.resetPageAndLoad();
  }

  handleFilterChange(): void {
    this.resetPageAndLoad();
  }

  updateSearch(
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    this.searchTerm.set(input.value);

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer =
      setTimeout(
        () => {
          this.resetPageAndLoad();
        },
        450,
      );
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.resetPageAndLoad();
  }

  clearFilters(): void {
    this.selectedPreset.set('last_30');
    this.dateFrom.set(subtractDays(29));
    this.dateTo.set(todayValue());
    this.selectedTables.set([]);
    this.selectedActions.set([]);
    this.selectedActorId.set('all');
    this.searchTerm.set('');
    this.pageIndex.set(0);

    void this.loadAuditLog();
  }

  handlePage(
    event: PageEvent,
  ): void {
    this.pageIndex.set(
      event.pageIndex,
    );

    this.pageSize.set(
      event.pageSize,
    );

    void this.loadAuditLog();
  }

  openDetail(
    entry: AuditLogEntry,
  ): void {
    this.dialog.open(
      AuditLogDetailDialogComponent,
      {
        width: '1020px',
        maxWidth:
          'calc(100vw - 28px)',
        data: entry,
      },
    );
  }

  tableLabel(
    tableName: string,
  ): string {
    return TABLE_LABELS[tableName]
      ?? tableName
        .replace(/_/g, ' ')
        .replace(
          /^\w/,
          letter =>
            letter.toUpperCase(),
        );
  }

  actionLabel(
    action: AuditAction,
  ): string {
    return ACTION_LABELS[action];
  }

  actionIcon(
    action: AuditAction,
  ): string {
    switch (action) {
      case 'insert':
        return 'add_circle';

      case 'update':
        return 'edit';

      case 'delete':
        return 'delete';
    }
  }

  roleLabel(
    role: AuditActorRole | null,
  ): string {
    return role
      ? ROLE_LABELS[role]
      : 'Sin rol disponible';
  }

  actorDisplayName(
    actor: AuditLogActorOption,
  ): string {
    return (
      actor.actorName
      || actor.actorEmail
      || actor.changedBy
    );
  }

  entryActorName(
    entry: AuditLogEntry,
  ): string {
    return (
      entry.actorName
      || entry.actorEmail
      || 'Proceso del sistema'
    );
  }

  entryActorDetail(
    entry: AuditLogEntry,
  ): string {
    const values = [
      entry.actorEmployeeNumber
        ? `Reloj ${entry.actorEmployeeNumber}`
        : '',
      entry.actorRole
        ? this.roleLabel(
          entry.actorRole,
        )
        : '',
    ].filter(Boolean);

    return values.join(' · ')
      || 'Sin información adicional';
  }

  changedFieldsLabel(
    entry: AuditLogEntry,
  ): string {
    if (
      entry.changedFields.length === 0
    ) {
      return entry.action === 'insert'
        ? 'Registro creado'
        : entry.action === 'delete'
          ? 'Registro eliminado'
          : 'Sin campos identificados';
    }

    const visibleFields =
      entry.changedFields
        .slice(0, 3)
        .map(
          field =>
            field.replace(/_/g, ' '),
        );

    const remaining =
      entry.changedFields.length
      - visibleFields.length;

    return remaining > 0
      ? `${visibleFields.join(', ')} y ${remaining} más`
      : visibleFields.join(', ');
  }

  async reload(): Promise<void> {
    await Promise.all([
      this.auditLogService
        .loadOptions(),

      this.loadAuditLog(),
    ]);
  }

  private async initialize():
    Promise<void> {
    await Promise.all([
      this.auditLogService
        .loadOptions(),

      this.loadAuditLog(),
    ]);
  }

  private resetPageAndLoad(): void {
    this.pageIndex.set(0);
    void this.loadAuditLog();
  }

  private async loadAuditLog():
    Promise<void> {
    if (
      !this.dateFrom()
      || !this.dateTo()
      || this.dateFrom()
        > this.dateTo()
    ) {
      return;
    }

    await this.auditLogService
      .loadAuditLog(
        this.currentQuery(),
      );
  }

  private currentQuery():
    AuditLogQuery {
    return {
      dateFrom:
        this.dateFrom(),

      dateTo:
        this.dateTo(),

      tableNames:
        this.selectedTables(),

      actions:
        this.selectedActions(),

      changedBy:
        this.selectedActorId()
          === 'all'
          ? null
          : this.selectedActorId(),

      search:
        this.searchTerm(),

      pageIndex:
        this.pageIndex(),

      pageSize:
        this.pageSize(),
    };
  }
}
