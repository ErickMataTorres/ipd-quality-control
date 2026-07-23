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

type SummaryArgs =
  Database['public']['Functions']['get_defect_analysis_summary']['Args'];

type SummaryRow =
  Database['public']['Functions']['get_defect_analysis_summary']['Returns'][number];

type ParetoArgs =
  Database['public']['Functions']['get_defect_analysis_pareto']['Args'];

type ParetoRow =
  Database['public']['Functions']['get_defect_analysis_pareto']['Returns'][number];

type TrendArgs =
  Database['public']['Functions']['get_defect_analysis_trend']['Args'];

type TrendRow =
  Database['public']['Functions']['get_defect_analysis_trend']['Returns'][number];

type ByLineArgs =
  Database['public']['Functions']['get_defect_analysis_by_line']['Args'];

type ByLineRow =
  Database['public']['Functions']['get_defect_analysis_by_line']['Returns'][number];

type ByShiftArgs =
  Database['public']['Functions']['get_defect_analysis_by_shift']['Args'];

type ByShiftRow =
  Database['public']['Functions']['get_defect_analysis_by_shift']['Returns'][number];

type OccurrencesArgs =
  Database['public']['Functions']['get_defect_analysis_occurrences']['Args'];

type OccurrenceRow =
  Database['public']['Functions']['get_defect_analysis_occurrences']['Returns'][number];

interface LineOptionQueryRow {
  id: string;
  active: boolean;
  effective_from: string;
  effective_to: string | null;

  production_lines: {
    id: string;
    name: string;
    display_order: number;
    plant_id: string;
    active: boolean;
  };

  product_models: {
    id: string;
    name: string;
    model_year: number | null;
    active: boolean;
  };
}

interface DefectTypeQueryRow {
  id: string;
  code: string;
  name_es: string;
  category: string | null;
  display_order: number;
  active: boolean;
}

export type DefectAnalysisRealtimeStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface DefectAnalysisQuery {
  plantId: string;
  dateFrom: string;
  dateTo: string;
  shiftId: string | null;
  lineModelAssignmentId: string | null;
  defectTypeId: string | null;
}

export interface DefectAnalysisSummary {
  totalRecords: number;
  affectedRecords: number;
  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;
  distinctDefectTypes: number;
  defectIpdPercentage: number | null;
  defectiveHarnessPercentage: number | null;
  averageDefectsPerAffectedRecord: number;
  topDefectTypeId: string | null;
  topDefectTypeCode: string | null;
  topDefectTypeName: string | null;
  topDefectQuantity: number;
}

export interface DefectParetoItem {
  defectTypeId: string;
  defectTypeCode: string;
  defectTypeName: string;
  defectCategory: string | null;
  quantity: number;
  affectedRecords: number;
  percentage: number;
  cumulativePercentage: number;
}

export interface DefectTrendPoint {
  productionDate: string;
  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;
  affectedRecords: number;
  defectIpdPercentage: number | null;
}

export interface DefectByLineItem {
  lineModelAssignmentId: string;
  productionLineId: string;
  productionLineName: string;
  displayOrder: number;
  productModelId: string;
  productModelName: string;
  modelYear: number | null;
  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;
  affectedRecords: number;
  defectIpdPercentage: number | null;
  percentageOfTotalDefects: number;
}

export interface DefectByShiftItem {
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  displayOrder: number;
  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;
  affectedRecords: number;
  defectIpdPercentage: number | null;
  percentageOfTotalDefects: number;
}

export interface DefectOccurrence {
  detailId: string;
  recordId: string;
  productionDate: string;
  productionLineName: string;
  productModelName: string;
  modelYear: number | null;
  shiftCode: string;
  shiftName: string;
  supervisorEmployeeNumber: string;
  supervisorName: string;
  defectTypeId: string;
  defectTypeCode: string;
  defectTypeName: string;
  defectCategory: string | null;
  quantity: number;
  defectComment: string | null;
  producedQuantity: number;
  recordTotalDefects: number;
  ipdPercentage: number | null;
  targetPercentage: number | null;
  recordComment: string | null;
  updatedAt: string;
}

export interface DefectAnalysisLineOption {
  id: string;
  productionLineId: string;
  productionLineName: string;
  productModelId: string;
  productModelName: string;
  modelYear: number | null;
  displayOrder: number;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface DefectAnalysisTypeOption {
  id: string;
  code: string;
  name: string;
  category: string | null;
  displayOrder: number;
  active: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class DefectAnalysisService {
  private readonly supabase =
    inject(SupabaseService);

  readonly summary =
    signal<DefectAnalysisSummary | null>(null);

  readonly pareto =
    signal<DefectParetoItem[]>([]);

  readonly trend =
    signal<DefectTrendPoint[]>([]);

  readonly byLine =
    signal<DefectByLineItem[]>([]);

  readonly byShift =
    signal<DefectByShiftItem[]>([]);

  readonly occurrences =
    signal<DefectOccurrence[]>([]);

  readonly lineOptions =
    signal<DefectAnalysisLineOption[]>([]);

  readonly defectTypeOptions =
    signal<DefectAnalysisTypeOption[]>([]);

  readonly isLoading =
    signal(false);

  readonly isLoadingOptions =
    signal(false);

  readonly isRefreshing =
    signal(false);

  readonly errorMessage =
    signal('');

  readonly optionsErrorMessage =
    signal('');

  readonly lastLoadedAt =
    signal<Date | null>(null);

  readonly realtimeStatus =
    signal<DefectAnalysisRealtimeStatus>(
      'disconnected',
    );

  private realtimeChannel:
    RealtimeChannel | null = null;

  async loadFilterOptions(
    plantId: string,
  ): Promise<void> {
    if (!plantId) {
      this.lineOptions.set([]);
      return;
    }

    this.isLoadingOptions.set(true);
    this.optionsErrorMessage.set('');

    try {
      const [
        linesResult,
        defectTypesResult,
      ] = await Promise.all([
        this.supabase.client
          .from('line_model_assignments')
          .select(`
            id,
            active,
            effective_from,
            effective_to,
            production_lines!inner (
              id,
              name,
              display_order,
              plant_id,
              active
            ),
            product_models!inner (
              id,
              name,
              model_year,
              active
            )
          `)
          .eq(
            'production_lines.plant_id',
            plantId,
          )
          .order(
            'display_order',
            {
              referencedTable:
                'production_lines',
            },
          ),

        this.supabase.client
          .from('defect_types')
          .select(`
            id,
            code,
            name_es,
            category,
            display_order,
            active
          `)
          .eq('active', true)
          .order('display_order')
          .order('name_es'),
      ]);

      if (linesResult.error) {
        throw linesResult.error;
      }

      if (defectTypesResult.error) {
        throw defectTypesResult.error;
      }

      const lineRows =
        (
          linesResult.data
          ?? []
        ) as unknown as LineOptionQueryRow[];

      const defectRows =
        (
          defectTypesResult.data
          ?? []
        ) as DefectTypeQueryRow[];

      this.lineOptions.set(
        lineRows
          .filter(
            row =>
              row.production_lines
              && row.product_models,
          )
          .map(row => ({
            id:
              row.id,

            productionLineId:
              row.production_lines.id,

            productionLineName:
              row.production_lines.name,

            productModelId:
              row.product_models.id,

            productModelName:
              row.product_models.name,

            modelYear:
              row.product_models.model_year,

            displayOrder:
              row.production_lines
                .display_order,

            active:
              row.active
              && row.production_lines.active
              && row.product_models.active,

            effectiveFrom:
              row.effective_from,

            effectiveTo:
              row.effective_to,
          }))
          .sort(
            (left, right) =>
              left.displayOrder
              - right.displayOrder
              || left.productionLineName
                .localeCompare(
                  right.productionLineName,
                  'es',
                )
              || left.productModelName
                .localeCompare(
                  right.productModelName,
                  'es',
                ),
          ),
      );

      this.defectTypeOptions.set(
        defectRows.map(row => ({
          id:
            row.id,

          code:
            row.code,

          name:
            row.name_es,

          category:
            row.category,

          displayOrder:
            row.display_order,

          active:
            row.active,
        })),
      );
    } catch (error: unknown) {
      console.error(
        'Unable to load defect analysis filters.',
        error,
      );

      this.lineOptions.set([]);
      this.defectTypeOptions.set([]);

      this.optionsErrorMessage.set(
        'No fue posible cargar las líneas y los tipos de defecto.',
      );
    } finally {
      this.isLoadingOptions.set(false);
    }
  }

  async loadAnalysis(
    query: DefectAnalysisQuery,
    silent = false,
  ): Promise<void> {
    if (
      !query.plantId
      || !query.dateFrom
      || !query.dateTo
    ) {
      this.clearData();
      return;
    }

    if (silent) {
      this.isRefreshing.set(true);
    } else {
      this.isLoading.set(true);
    }

    this.errorMessage.set('');

    try {
      const commonPayload = {
        plant_id_value:
          query.plantId,

        date_from_value:
          query.dateFrom,

        date_to_value:
          query.dateTo,

        shift_id_value:
          query.shiftId,

        line_model_assignment_id_value:
          query.lineModelAssignmentId,

        defect_type_id_value:
          query.defectTypeId,
      };

      const [
        summaryResult,
        paretoResult,
        trendResult,
        byLineResult,
        byShiftResult,
        occurrencesResult,
      ] = await Promise.all([
        this.supabase.client.rpc(
          'get_defect_analysis_summary',
          commonPayload as SummaryArgs,
        ),

        this.supabase.client.rpc(
          'get_defect_analysis_pareto',
          {
            ...commonPayload,
            result_limit_value: 12,
          } as ParetoArgs,
        ),

        this.supabase.client.rpc(
          'get_defect_analysis_trend',
          commonPayload as TrendArgs,
        ),

        this.supabase.client.rpc(
          'get_defect_analysis_by_line',
          commonPayload as ByLineArgs,
        ),

        this.supabase.client.rpc(
          'get_defect_analysis_by_shift',
          commonPayload as ByShiftArgs,
        ),

        this.supabase.client.rpc(
          'get_defect_analysis_occurrences',
          {
            ...commonPayload,
            result_limit_value: 100,
          } as OccurrencesArgs,
        ),
      ]);

      const resultErrors = [
        summaryResult.error,
        paretoResult.error,
        trendResult.error,
        byLineResult.error,
        byShiftResult.error,
        occurrencesResult.error,
      ].filter(Boolean);

      if (resultErrors.length > 0) {
        throw resultErrors[0];
      }

      const summaryRow =
        summaryResult.data?.[0];

      this.summary.set(
        summaryRow
          ? this.mapSummary(summaryRow)
          : null,
      );

      this.pareto.set(
        (paretoResult.data ?? [])
          .map(row => this.mapPareto(row)),
      );

      this.trend.set(
        (trendResult.data ?? [])
          .map(row => this.mapTrend(row)),
      );

      this.byLine.set(
        (byLineResult.data ?? [])
          .map(row => this.mapByLine(row)),
      );

      this.byShift.set(
        (byShiftResult.data ?? [])
          .map(row => this.mapByShift(row)),
      );

      this.occurrences.set(
        (occurrencesResult.data ?? [])
          .map(
            row =>
              this.mapOccurrence(row),
          ),
      );

      this.lastLoadedAt.set(new Date());
    } catch (error: unknown) {
      console.error(
        'Unable to load defect analysis.',
        error,
      );

      if (!silent) {
        this.clearData();
      }

      this.errorMessage.set(
        'No fue posible cargar el análisis de defectos.',
      );
    } finally {
      this.isLoading.set(false);
      this.isRefreshing.set(false);
    }
  }

  subscribeToChanges(
    onChange: () => void,
  ): void {
    this.unsubscribeFromChanges();

    this.realtimeStatus.set('connecting');

    this.realtimeChannel =
      this.supabase.client
        .channel(
          `defect-analysis-${crypto.randomUUID()}`,
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

  unsubscribeFromChanges(): void {
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

  private clearData(): void {
    this.summary.set(null);
    this.pareto.set([]);
    this.trend.set([]);
    this.byLine.set([]);
    this.byShift.set([]);
    this.occurrences.set([]);
  }

  private mapSummary(
    row: SummaryRow,
  ): DefectAnalysisSummary {
    return {
      totalRecords:
        Number(row.total_records ?? 0),

      affectedRecords:
        Number(row.affected_records ?? 0),

      producedQuantity:
        Number(row.produced_quantity ?? 0),

      defectiveHarnessQuantity:
        Number(
          row.defective_harness_quantity
          ?? 0,
        ),

      totalDefects:
        Number(row.total_defects ?? 0),

      distinctDefectTypes:
        Number(
          row.distinct_defect_types ?? 0,
        ),

      defectIpdPercentage:
        this.toNullableNumber(
          row.defect_ipd_percentage,
        ),

      defectiveHarnessPercentage:
        this.toNullableNumber(
          row.defective_harness_percentage,
        ),

      averageDefectsPerAffectedRecord:
        Number(
          row.average_defects_per_affected_record
          ?? 0,
        ),

      topDefectTypeId:
        row.top_defect_type_id,

      topDefectTypeCode:
        row.top_defect_type_code,

      topDefectTypeName:
        row.top_defect_type_name,

      topDefectQuantity:
        Number(
          row.top_defect_quantity ?? 0,
        ),
    };
  }

  private mapPareto(
    row: ParetoRow,
  ): DefectParetoItem {
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

      affectedRecords:
        Number(row.affected_records ?? 0),

      percentage:
        Number(row.percentage ?? 0),

      cumulativePercentage:
        Number(
          row.cumulative_percentage ?? 0,
        ),
    };
  }

  private mapTrend(
    row: TrendRow,
  ): DefectTrendPoint {
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

      affectedRecords:
        Number(row.affected_records ?? 0),

      defectIpdPercentage:
        this.toNullableNumber(
          row.defect_ipd_percentage,
        ),
    };
  }

  private mapByLine(
    row: ByLineRow,
  ): DefectByLineItem {
    return {
      lineModelAssignmentId:
        row.line_model_assignment_id,

      productionLineId:
        row.production_line_id,

      productionLineName:
        row.production_line_name,

      displayOrder:
        row.display_order,

      productModelId:
        row.product_model_id,

      productModelName:
        row.product_model_name,

      modelYear:
        row.model_year,

      producedQuantity:
        Number(row.produced_quantity ?? 0),

      defectiveHarnessQuantity:
        Number(
          row.defective_harness_quantity
          ?? 0,
        ),

      totalDefects:
        Number(row.total_defects ?? 0),

      affectedRecords:
        Number(row.affected_records ?? 0),

      defectIpdPercentage:
        this.toNullableNumber(
          row.defect_ipd_percentage,
        ),

      percentageOfTotalDefects:
        Number(
          row.percentage_of_total_defects
          ?? 0,
        ),
    };
  }

  private mapByShift(
    row: ByShiftRow,
  ): DefectByShiftItem {
    return {
      shiftId:
        row.shift_id,

      shiftCode:
        row.shift_code,

      shiftName:
        row.shift_name,

      displayOrder:
        row.display_order,

      producedQuantity:
        Number(row.produced_quantity ?? 0),

      defectiveHarnessQuantity:
        Number(
          row.defective_harness_quantity
          ?? 0,
        ),

      totalDefects:
        Number(row.total_defects ?? 0),

      affectedRecords:
        Number(row.affected_records ?? 0),

      defectIpdPercentage:
        this.toNullableNumber(
          row.defect_ipd_percentage,
        ),

      percentageOfTotalDefects:
        Number(
          row.percentage_of_total_defects
          ?? 0,
        ),
    };
  }

  private mapOccurrence(
    row: OccurrenceRow,
  ): DefectOccurrence {
    return {
      detailId:
        row.detail_id,

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

      defectComment:
        row.defect_comment,

      producedQuantity:
        Number(row.produced_quantity ?? 0),

      recordTotalDefects:
        Number(
          row.record_total_defects ?? 0,
        ),

      ipdPercentage:
        this.toNullableNumber(
          row.ipd_percentage,
        ),

      targetPercentage:
        this.toNullableNumber(
          row.target_percentage,
        ),

      recordComment:
        row.record_comment,

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
