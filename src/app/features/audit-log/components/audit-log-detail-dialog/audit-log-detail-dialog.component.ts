import {
  Component,
  inject,
} from '@angular/core';

import {
  DatePipe,
} from '@angular/common';

import {
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';

import {
  MatButtonModule,
} from '@angular/material/button';

import {
  MatIconModule,
} from '@angular/material/icon';

import {
  AuditLogEntry,
} from '../../data-access/audit-log.service';

interface ChangedFieldRow {
  field: string;
  label: string;
  previousValue: unknown;
  newValue: unknown;
}

const FIELD_LABELS:
  Record<string, string> = {
    active: 'Estado activo',
    code: 'Código',
    name: 'Nombre',
    name_es: 'Nombre en español',
    name_en: 'Nombre en inglés',
    description: 'Descripción',
    display_order: 'Orden de visualización',
    employee_number: 'Número de reloj',
    full_name: 'Nombre completo',
    department_name: 'Departamento',
    job_position: 'Puesto',
    plant_id: 'Planta',
    shift_id: 'Turno',
    role: 'Rol',
    default_plant_id: 'Planta predeterminada',
    preferred_theme: 'Tema preferido',
    production_date: 'Fecha de producción',
    produced_quantity: 'Arneses producidos',
    defective_harness_quantity:
      'Arneses defectuosos',
    total_defects: 'Total de defectos',
    ipd_percentage: 'IPD',
    target_percentage: 'Objetivo IPD',
    status: 'Estado',
    comment: 'Comentario',
    modification_reason:
      'Motivo de modificación',
    effective_from: 'Vigente desde',
    effective_to: 'Vigente hasta',
    supervisor_employee_id:
      'Supervisor',
    line_model_assignment_id:
      'Línea y modelo',
    defect_type_id: 'Tipo de defecto',
    quantity: 'Cantidad',
    employee_id: 'Empleado',
    user_id: 'Usuario',
    created_at: 'Fecha de creación',
    updated_at: 'Última actualización',
    created_by: 'Creado por',
    updated_by: 'Actualizado por',
  };

@Component({
  selector:
    'app-audit-log-detail-dialog',

  imports: [
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
  ],

  templateUrl:
    './audit-log-detail-dialog.component.html',

  styleUrl:
    './audit-log-detail-dialog.component.scss',
})
export class AuditLogDetailDialogComponent {
  readonly entry =
    inject<AuditLogEntry>(
      MAT_DIALOG_DATA,
    );

  readonly fieldRows =
    this.buildFieldRows();

  actionLabel(): string {
    switch (this.entry.action) {
      case 'insert':
        return 'Alta';

      case 'update':
        return 'Modificación';

      case 'delete':
        return 'Eliminación';
    }
  }

  actionIcon(): string {
    switch (this.entry.action) {
      case 'insert':
        return 'add_circle';

      case 'update':
        return 'edit';

      case 'delete':
        return 'delete';
    }
  }

  tableLabel(): string {
    const labels:
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

    return labels[this.entry.tableName]
      ?? this.entry.tableName;
  }

  actorLabel(): string {
    return (
      this.entry.actorName
      || this.entry.actorEmail
      || 'Proceso del sistema'
    );
  }

  formatValue(
    value: unknown,
  ): string {
    if (
      value === null
      || value === undefined
      || value === ''
    ) {
      return 'Vacío';
    }

    if (typeof value === 'boolean') {
      return value
        ? 'Sí'
        : 'No';
    }

    if (
      typeof value === 'object'
    ) {
      return JSON.stringify(
        value,
        null,
        2,
      );
    }

    if (
      typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}T/
        .test(value)
    ) {
      const date =
        new Date(value);

      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString(
          'es-MX',
        );
      }
    }

    return String(value);
  }

  rawJson(
    value: unknown,
  ): string {
    if (
      value === null
      || value === undefined
    ) {
      return 'Sin información';
    }

    return JSON.stringify(
      value,
      null,
      2,
    );
  }

  private buildFieldRows():
    ChangedFieldRow[] {
    const previousRecord =
      this.asRecord(
        this.entry.oldValues,
      );

    const newRecord =
      this.asRecord(
        this.entry.newValues,
      );

    const fieldNames =
      this.entry.changedFields.length > 0
        ? this.entry.changedFields
        : Array.from(
          new Set([
            ...Object.keys(
              previousRecord,
            ),
            ...Object.keys(
              newRecord,
            ),
          ]),
        ).sort();

    return fieldNames.map(field => ({
      field,

      label:
        FIELD_LABELS[field]
        ?? field
          .replace(/_/g, ' ')
          .replace(
            /^\w/,
            letter =>
              letter.toUpperCase(),
          ),

      previousValue:
        previousRecord[field],

      newValue:
        newRecord[field],
    }));
  }

  private asRecord(
    value: unknown,
  ): Record<string, unknown> {
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
    ) {
      return value as
        Record<string, unknown>;
    }

    return {};
  }
}
