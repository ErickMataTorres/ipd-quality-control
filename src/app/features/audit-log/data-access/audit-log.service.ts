import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import {
  Database,
  Json,
} from '../../../core/types/database.types';

import {
  SupabaseService,
} from '../../../core/services/supabase';

export type AuditAction =
  Database['public']['Enums']['audit_action'];

export type AuditActorRole =
  Database['public']['Enums']['app_role'];

type SummaryArgs =
  Database['public']['Functions']['get_audit_log_summary']['Args'];

type EntriesArgs =
  Database['public']['Functions']['get_audit_log_entries']['Args'];

type TableOptionsArgs =
  Database['public']['Functions']['get_audit_log_table_options']['Args'];

type ActorOptionsArgs =
  Database['public']['Functions']['get_audit_log_actor_options']['Args'];

interface RawAuditSummary {
  total_entries: number | string | null;
  insert_entries: number | string | null;
  update_entries: number | string | null;
  delete_entries: number | string | null;
  distinct_tables: number | string | null;
  distinct_actors: number | string | null;
  first_change_at: string | null;
  last_change_at: string | null;
}

interface RawAuditEntry {
  audit_log_id: string;
  table_name: string;
  record_id: string | null;
  action: AuditAction;
  old_values: Json | null;
  new_values: Json | null;
  changed_fields: string[] | null;
  record_label: string | null;
  changed_by: string | null;
  actor_employee_number: string | null;
  actor_name: string | null;
  actor_role: AuditActorRole | null;
  actor_email: string | null;
  changed_at: string;
  total_filtered: number | string | null;
}

interface RawAuditTableOption {
  table_name: string;
  entry_count: number | string | null;
  last_change_at: string | null;
}

interface RawAuditActorOption {
  changed_by: string;
  employee_number: string | null;
  actor_name: string | null;
  actor_role: AuditActorRole | null;
  actor_email: string | null;
  entry_count: number | string | null;
  last_change_at: string | null;
}

export interface AuditLogQuery {
  dateFrom: string;
  dateTo: string;
  tableNames: string[];
  actions: AuditAction[];
  changedBy: string | null;
  search: string;
  pageIndex: number;
  pageSize: number;
}

export interface AuditLogSummary {
  totalEntries: number;
  insertEntries: number;
  updateEntries: number;
  deleteEntries: number;
  distinctTables: number;
  distinctActors: number;
  firstChangeAt: string | null;
  lastChangeAt: string | null;
}

export interface AuditLogEntry {
  auditLogId: string;
  tableName: string;
  recordId: string | null;
  action: AuditAction;
  oldValues: Json | null;
  newValues: Json | null;
  changedFields: string[];
  recordLabel: string | null;
  changedBy: string | null;
  actorEmployeeNumber: string | null;
  actorName: string | null;
  actorRole: AuditActorRole | null;
  actorEmail: string | null;
  changedAt: string;
}

export interface AuditLogTableOption {
  tableName: string;
  entryCount: number;
  lastChangeAt: string | null;
}

export interface AuditLogActorOption {
  changedBy: string;
  employeeNumber: string | null;
  actorName: string | null;
  actorRole: AuditActorRole | null;
  actorEmail: string | null;
  entryCount: number;
  lastChangeAt: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuditLogService {
  private readonly supabase =
    inject(SupabaseService);

  readonly summary =
    signal<AuditLogSummary | null>(null);

  readonly entries =
    signal<AuditLogEntry[]>([]);

  readonly tableOptions =
    signal<AuditLogTableOption[]>([]);

  readonly actorOptions =
    signal<AuditLogActorOption[]>([]);

  readonly totalFiltered =
    signal(0);

  readonly isLoading =
    signal(false);

  readonly isLoadingOptions =
    signal(false);

  readonly errorMessage =
    signal('');

  readonly optionsErrorMessage =
    signal('');

  readonly lastLoadedAt =
    signal<Date | null>(null);

  async loadOptions(): Promise<void> {
    this.isLoadingOptions.set(true);
    this.optionsErrorMessage.set('');

    try {
      const [
        tableResult,
        actorResult,
      ] = await Promise.all([
        this.supabase.client.rpc(
          'get_audit_log_table_options',
          {} as TableOptionsArgs,
        ),

        this.supabase.client.rpc(
          'get_audit_log_actor_options',
          {} as ActorOptionsArgs,
        ),
      ]);

      const firstError = [
        tableResult.error,
        actorResult.error,
      ].find(Boolean);

      if (firstError) {
        throw firstError;
      }

      const rawTables =
        (tableResult.data ?? []) as unknown as
          RawAuditTableOption[];

      const rawActors =
        (actorResult.data ?? []) as unknown as
          RawAuditActorOption[];

      this.tableOptions.set(
        rawTables.map(row => ({
          tableName:
            row.table_name,

          entryCount:
            Number(row.entry_count ?? 0),

          lastChangeAt:
            row.last_change_at,
        })),
      );

      this.actorOptions.set(
        rawActors.map(row => ({
          changedBy:
            row.changed_by,

          employeeNumber:
            row.employee_number,

          actorName:
            row.actor_name,

          actorRole:
            row.actor_role,

          actorEmail:
            row.actor_email,

          entryCount:
            Number(row.entry_count ?? 0),

          lastChangeAt:
            row.last_change_at,
        })),
      );
    } catch (error: unknown) {
      console.error(
        'Unable to load audit log options.',
        error,
      );

      this.optionsErrorMessage.set(
        'No fue posible cargar algunos filtros del historial.',
      );
    } finally {
      this.isLoadingOptions.set(false);
    }
  }

  async loadAuditLog(
    query: AuditLogQuery,
  ): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const commonPayload = {
        date_from_value:
          query.dateFrom,

        date_to_value:
          query.dateTo,

        table_names_value:
          query.tableNames.length > 0
            ? query.tableNames
            : undefined,

        actions_value:
          query.actions.length > 0
            ? query.actions
            : undefined,

        changed_by_value:
          query.changedBy ?? undefined,

        search_value:
          query.search.trim()
          || undefined,
      };

      const summaryPayload =
        commonPayload as SummaryArgs;

      const entriesPayload = {
        ...commonPayload,

        result_limit_value:
          query.pageSize,

        result_offset_value:
          query.pageIndex
          * query.pageSize,
      } as EntriesArgs;

      const [
        summaryResult,
        entriesResult,
      ] = await Promise.all([
        this.supabase.client.rpc(
          'get_audit_log_summary',
          summaryPayload,
        ),

        this.supabase.client.rpc(
          'get_audit_log_entries',
          entriesPayload,
        ),
      ]);

      const firstError = [
        summaryResult.error,
        entriesResult.error,
      ].find(Boolean);

      if (firstError) {
        throw firstError;
      }

      const summaryRows =
        (summaryResult.data ?? []) as unknown as
          RawAuditSummary[];

      const entryRows =
        (entriesResult.data ?? []) as unknown as
          RawAuditEntry[];

      const summaryRow =
        summaryRows[0];

      this.summary.set(
        summaryRow
          ? this.mapSummary(summaryRow)
          : null,
      );

      this.entries.set(
        entryRows.map(
          row => this.mapEntry(row),
        ),
      );

      this.totalFiltered.set(
        entryRows.length > 0
          ? Number(
            entryRows[0]
              .total_filtered
            ?? 0,
          )
          : Number(
            summaryRow?.total_entries
            ?? 0,
          ),
      );

      this.lastLoadedAt.set(new Date());
    } catch (error: unknown) {
      console.error(
        'Unable to load audit log.',
        error,
      );

      this.summary.set(null);
      this.entries.set([]);
      this.totalFiltered.set(0);

      this.errorMessage.set(
        'No fue posible consultar el historial de cambios.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  private mapSummary(
    row: RawAuditSummary,
  ): AuditLogSummary {
    return {
      totalEntries:
        Number(row.total_entries ?? 0),

      insertEntries:
        Number(row.insert_entries ?? 0),

      updateEntries:
        Number(row.update_entries ?? 0),

      deleteEntries:
        Number(row.delete_entries ?? 0),

      distinctTables:
        Number(row.distinct_tables ?? 0),

      distinctActors:
        Number(row.distinct_actors ?? 0),

      firstChangeAt:
        row.first_change_at,

      lastChangeAt:
        row.last_change_at,
    };
  }

  private mapEntry(
    row: RawAuditEntry,
  ): AuditLogEntry {
    return {
      auditLogId:
        row.audit_log_id,

      tableName:
        row.table_name,

      recordId:
        row.record_id,

      action:
        row.action,

      oldValues:
        row.old_values,

      newValues:
        row.new_values,

      changedFields:
        row.changed_fields ?? [],

      recordLabel:
        row.record_label,

      changedBy:
        row.changed_by,

      actorEmployeeNumber:
        row.actor_employee_number,

      actorName:
        row.actor_name,

      actorRole:
        row.actor_role,

      actorEmail:
        row.actor_email,

      changedAt:
        row.changed_at,
    };
  }
}
