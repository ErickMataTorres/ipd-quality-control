import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import {
  RealtimeChannel,
} from '@supabase/supabase-js';

import {
  Database,
} from '../../../core/types/database.types';

import {
  SupabaseService,
} from '../../../core/services/supabase';

type DashboardSummaryArgs =
  Database['public']['Functions']['get_dashboard_summary']['Args'];

type DashboardSummaryRow =
  Database['public']['Functions']['get_dashboard_summary']['Returns'][number];

type DashboardTrendArgs =
  Database['public']['Functions']['get_dashboard_daily_trend']['Args'];

type DashboardTrendRow =
  Database['public']['Functions']['get_dashboard_daily_trend']['Returns'][number];

type DashboardTopDefectsArgs =
  Database['public']['Functions']['get_dashboard_top_defects']['Args'];

type DashboardTopDefectRow =
  Database['public']['Functions']['get_dashboard_top_defects']['Returns'][number];

type DashboardRecentAlertsArgs =
  Database['public']['Functions']['get_dashboard_recent_alerts']['Args'];

type DashboardRecentAlertRow =
  Database['public']['Functions']['get_dashboard_recent_alerts']['Returns'][number];

export type DashboardRealtimeStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface DashboardSummary {
  totalCombinations: number;
  reportedCombinations: number;
  pendingCombinations: number;
  withinTargetCombinations: number;
  outsideTargetCombinations: number;
  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;
  ipdPercentage: number | null;
  completionPercentage: number;
}

export interface DashboardTrendPoint {
  productionDate: string;
  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;
  ipdPercentage: number | null;
  reportedRecords: number;
  withinTargetRecords: number;
  outsideTargetRecords: number;
}

export interface DashboardTopDefect {
  defectTypeId: string;
  defectTypeCode: string;
  defectTypeName: string;
  defectCategory: string | null;
  quantity: number;
  recordCount: number;
  percentage: number;
}

export interface DashboardRecentAlert {
  recordId: string;
  productionDate: string;
  productionLineName: string;
  productModelName: string;
  modelYear: number | null;
  shiftCode: string;
  shiftName: string;
  supervisorEmployeeNumber: string;
  supervisorName: string;
  producedQuantity: number;
  totalDefects: number;
  ipdPercentage: number;
  targetPercentage: number;
  targetDifference: number;
  updatedAt: string;
}

export interface DashboardQuery {
  plantId: string;
  productionDate: string;
  dateFrom: string;
  dateTo: string;
  shiftId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly supabase =
    inject(SupabaseService);

  readonly summary =
    signal<DashboardSummary | null>(null);

  readonly trend =
    signal<DashboardTrendPoint[]>([]);

  readonly topDefects =
    signal<DashboardTopDefect[]>([]);

  readonly recentAlerts =
    signal<DashboardRecentAlert[]>([]);

  readonly isLoading =
    signal(false);

  readonly isRefreshing =
    signal(false);

  readonly errorMessage =
    signal('');

  readonly lastLoadedAt =
    signal<Date | null>(null);

  readonly realtimeStatus =
    signal<DashboardRealtimeStatus>(
      'disconnected',
    );

  private realtimeChannel:
    RealtimeChannel | null = null;

  async loadDashboard(
    query: DashboardQuery,
    silent = false,
  ): Promise<void> {
    if (
      !query.plantId
      || !query.productionDate
      || !query.dateFrom
      || !query.dateTo
    ) {
      this.clear();
      return;
    }

    if (silent) {
      this.isRefreshing.set(true);
    } else {
      this.isLoading.set(true);
    }

    this.errorMessage.set('');

    try {
      const summaryPayload = {
        plant_id_value:
          query.plantId,

        production_date_value:
          query.productionDate,

        shift_id_value:
          query.shiftId,
      };

      const trendPayload = {
        plant_id_value:
          query.plantId,

        date_from_value:
          query.dateFrom,

        date_to_value:
          query.dateTo,

        shift_id_value:
          query.shiftId,
      };

      const topDefectsPayload = {
        plant_id_value:
          query.plantId,

        date_from_value:
          query.dateFrom,

        date_to_value:
          query.dateTo,

        shift_id_value:
          query.shiftId,

        result_limit_value: 6,
      };

      const recentAlertsPayload = {
        plant_id_value:
          query.plantId,

        date_from_value:
          query.dateFrom,

        date_to_value:
          query.dateTo,

        shift_id_value:
          query.shiftId,

        result_limit_value: 6,
      };

      const [
        summaryResult,
        trendResult,
        topDefectsResult,
        recentAlertsResult,
      ] = await Promise.all([
        this.supabase.client.rpc(
          'get_dashboard_summary',
          summaryPayload as DashboardSummaryArgs,
        ),

        this.supabase.client.rpc(
          'get_dashboard_daily_trend',
          trendPayload as DashboardTrendArgs,
        ),

        this.supabase.client.rpc(
          'get_dashboard_top_defects',
          topDefectsPayload as DashboardTopDefectsArgs,
        ),

        this.supabase.client.rpc(
          'get_dashboard_recent_alerts',
          recentAlertsPayload as DashboardRecentAlertsArgs,
        ),
      ]);

      if (summaryResult.error) {
        throw summaryResult.error;
      }

      if (trendResult.error) {
        throw trendResult.error;
      }

      if (topDefectsResult.error) {
        throw topDefectsResult.error;
      }

      if (recentAlertsResult.error) {
        throw recentAlertsResult.error;
      }

      const summaryRow =
        summaryResult.data?.[0];

      this.summary.set(
        summaryRow
          ? this.mapSummary(summaryRow)
          : null,
      );

      this.trend.set(
        (trendResult.data ?? [])
          .map(row => this.mapTrendPoint(row)),
      );

      this.topDefects.set(
        (topDefectsResult.data ?? [])
          .map(row => this.mapTopDefect(row)),
      );

      this.recentAlerts.set(
        (recentAlertsResult.data ?? [])
          .map(row => this.mapRecentAlert(row)),
      );

      this.lastLoadedAt.set(new Date());
    } catch (error: unknown) {
      console.error(
        'Unable to load dashboard.',
        error,
      );

      if (!silent) {
        this.clearData();
      }

      this.errorMessage.set(
        'No fue posible cargar la información del panel principal.',
      );
    } finally {
      this.isLoading.set(false);
      this.isRefreshing.set(false);
    }
  }

  subscribeToRecordChanges(
    onChange: () => void,
  ): void {
    this.unsubscribeFromRecordChanges();

    this.realtimeStatus.set('connecting');

    this.realtimeChannel =
      this.supabase.client
        .channel(
          `dashboard-${crypto.randomUUID()}`,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'daily_ipd_records',
          },
          () => onChange(),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'daily_ipd_defects',
          },
          () => onChange(),
        )
        .subscribe(status => {
          switch (status) {
            case 'SUBSCRIBED':
              this.realtimeStatus.set(
                'connected',
              );
              break;

            case 'CHANNEL_ERROR':
            case 'TIMED_OUT':
              this.realtimeStatus.set(
                'error',
              );
              break;

            case 'CLOSED':
              this.realtimeStatus.set(
                'disconnected',
              );
              break;
          }
        });
  }

  unsubscribeFromRecordChanges(): void {
    const channel =
      this.realtimeChannel;

    this.realtimeChannel = null;

    if (channel) {
      void this.supabase.client
        .removeChannel(channel);
    }

    this.realtimeStatus.set(
      'disconnected',
    );
  }

  clear(): void {
    this.clearData();
    this.errorMessage.set('');
    this.isLoading.set(false);
    this.isRefreshing.set(false);
  }

  private clearData(): void {
    this.summary.set(null);
    this.trend.set([]);
    this.topDefects.set([]);
    this.recentAlerts.set([]);
  }

  private mapSummary(
    row: DashboardSummaryRow,
  ): DashboardSummary {
    return {
      totalCombinations:
        Number(row.total_combinations ?? 0),

      reportedCombinations:
        Number(row.reported_combinations ?? 0),

      pendingCombinations:
        Number(row.pending_combinations ?? 0),

      withinTargetCombinations:
        Number(
          row.within_target_combinations
          ?? 0,
        ),

      outsideTargetCombinations:
        Number(
          row.outside_target_combinations
          ?? 0,
        ),

      producedQuantity:
        Number(row.produced_quantity ?? 0),

      defectiveHarnessQuantity:
        Number(
          row.defective_harness_quantity
          ?? 0,
        ),

      totalDefects:
        Number(row.total_defects ?? 0),

      ipdPercentage:
        this.toNullableNumber(
          row.ipd_percentage,
        ),

      completionPercentage:
        Number(
          row.completion_percentage ?? 0,
        ),
    };
  }

  private mapTrendPoint(
    row: DashboardTrendRow,
  ): DashboardTrendPoint {
    return {
      productionDate:
        row.production_date,

      producedQuantity:
        Number(row.produced_quantity ?? 0),

      defectiveHarnessQuantity:
        Number(
          row.defective_harness_quantity
          ?? 0,
        ),

      totalDefects:
        Number(row.total_defects ?? 0),

      ipdPercentage:
        this.toNullableNumber(
          row.ipd_percentage,
        ),

      reportedRecords:
        Number(row.reported_records ?? 0),

      withinTargetRecords:
        Number(
          row.within_target_records ?? 0,
        ),

      outsideTargetRecords:
        Number(
          row.outside_target_records ?? 0,
        ),
    };
  }

  private mapTopDefect(
    row: DashboardTopDefectRow,
  ): DashboardTopDefect {
    return {
      defectTypeId:
        row.defect_type_id,

      defectTypeCode:
        row.defect_type_code,

      defectTypeName:
        row.defect_type_name,

      defectCategory:
        row.defect_category,

      quantity:
        Number(row.quantity ?? 0),

      recordCount:
        Number(row.record_count ?? 0),

      percentage:
        Number(row.percentage ?? 0),
    };
  }

  private mapRecentAlert(
    row: DashboardRecentAlertRow,
  ): DashboardRecentAlert {
    return {
      recordId:
        row.record_id,

      productionDate:
        row.production_date,

      productionLineName:
        row.production_line_name,

      productModelName:
        row.product_model_name,

      modelYear:
        row.model_year,

      shiftCode:
        row.shift_code,

      shiftName:
        row.shift_name,

      supervisorEmployeeNumber:
        row.supervisor_employee_number,

      supervisorName:
        row.supervisor_name,

      producedQuantity:
        Number(row.produced_quantity ?? 0),

      totalDefects:
        Number(row.total_defects ?? 0),

      ipdPercentage:
        Number(row.ipd_percentage ?? 0),

      targetPercentage:
        Number(row.target_percentage ?? 0),

      targetDifference:
        Number(row.target_difference ?? 0),

      updatedAt:
        row.updated_at,
    };
  }

  private toNullableNumber(
    value: number | string | null,
  ): number | null {
    if (value === null) {
      return null;
    }

    const numberValue =
      Number(value);

    return Number.isFinite(numberValue)
      ? numberValue
      : null;
  }
}
