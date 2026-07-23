import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import {
  Database,
} from '../../../core/types/database.types';

import {
  SupabaseService,
} from '../../../core/services/supabase';

type IpdRecordStatus =
  Database['public']['Enums']['ipd_record_status'];

type SummaryArgs =
  Database['public']['Functions']['get_reports_summary']['Args'];

type SummaryRow =
  Database['public']['Functions']['get_reports_summary']['Returns'][number];

type DailyArgs =
  Database['public']['Functions']['get_reports_daily']['Args'];

type DailyRow =
  Database['public']['Functions']['get_reports_daily']['Returns'][number];

type ByLineArgs =
  Database['public']['Functions']['get_reports_by_line']['Args'];

type ByLineRow =
  Database['public']['Functions']['get_reports_by_line']['Returns'][number];

type RecordsArgs =
  Database['public']['Functions']['get_reports_records']['Args'];

type RecordRow =
  Database['public']['Functions']['get_reports_records']['Returns'][number];

type DefectsArgs =
  Database['public']['Functions']['get_reports_defects']['Args'];

type DefectRow =
  Database['public']['Functions']['get_reports_defects']['Returns'][number];

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

export interface ReportsQuery {
  plantId: string;
  dateFrom: string;
  dateTo: string;
  shiftId: string | null;
  lineModelAssignmentId: string | null;
  status: IpdRecordStatus | null;
}

export interface ReportsSummary {
  totalRecords: number;
  draftRecords: number;
  submittedRecords: number;
  closedRecords: number;
  noProductionRecords: number;
  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;
  ipdPercentage: number | null;
  defectiveHarnessPercentage: number | null;
  withinTargetRecords: number;
  outsideTargetRecords: number;
  recordsWithoutTarget: number;
  firstRecordDate: string | null;
  lastRecordDate: string | null;
}

export interface ReportsDailyItem {
  productionDate: string;
  totalRecords: number;
  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;
  ipdPercentage: number | null;
  withinTargetRecords: number;
  outsideTargetRecords: number;
  noProductionRecords: number;
}

export interface ReportsLineItem {
  lineModelAssignmentId: string;
  productionLineId: string;
  productionLineName: string;
  displayOrder: number;
  productModelId: string;
  productModelName: string;
  modelYear: number | null;
  totalRecords: number;
  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;
  ipdPercentage: number | null;
  weightedTargetPercentage: number | null;
  withinTargetRecords: number;
  outsideTargetRecords: number;
  compliancePercentage: number | null;
}

export interface ReportsRecordItem {
  recordId: string;
  productionDate: string;
  plantId: string;
  plantCode: string;
  plantName: string;
  lineModelAssignmentId: string;
  productionLineId: string;
  productionLineName: string;
  productModelId: string;
  productModelName: string;
  modelYear: number | null;
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  supervisorEmployeeId: string;
  supervisorEmployeeNumber: string;
  supervisorName: string;
  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;
  ipdPercentage: number | null;
  targetPercentage: number | null;
  targetDifference: number | null;
  isWithinTarget: boolean | null;
  status: IpdRecordStatus;
  recordComment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportsDefectItem {
  detailId: string;
  recordId: string;
  productionDate: string;
  plantCode: string;
  plantName: string;
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
  defectiveHarnessQuantity: number;
  recordTotalDefects: number;
  ipdPercentage: number | null;
  targetPercentage: number | null;
  recordStatus: IpdRecordStatus;
  recordComment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportsLineOption {
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

@Injectable({
  providedIn: 'root',
})
export class ReportsService {
  private readonly supabase =
    inject(SupabaseService);

  readonly summary =
    signal<ReportsSummary | null>(null);

  readonly daily =
    signal<ReportsDailyItem[]>([]);

  readonly byLine =
    signal<ReportsLineItem[]>([]);

  readonly previewRecords =
    signal<ReportsRecordItem[]>([]);

  readonly lineOptions =
    signal<ReportsLineOption[]>([]);

  readonly isLoading =
    signal(false);

  readonly isLoadingOptions =
    signal(false);

  readonly isRefreshing =
    signal(false);

  readonly isExporting =
    signal(false);

  readonly errorMessage =
    signal('');

  readonly optionsErrorMessage =
    signal('');

  readonly lastLoadedAt =
    signal<Date | null>(null);

  async loadLineOptions(
    plantId: string,
  ): Promise<void> {
    if (!plantId) {
      this.lineOptions.set([]);
      return;
    }

    this.isLoadingOptions.set(true);
    this.optionsErrorMessage.set('');

    try {
      const { data, error } =
        await this.supabase.client
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
          );

      if (error) {
        throw error;
      }

      const rows =
        (data ?? []) as unknown as LineOptionQueryRow[];

      this.lineOptions.set(
        rows
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
    } catch (error: unknown) {
      console.error(
        'Unable to load report line options.',
        error,
      );

      this.lineOptions.set([]);

      this.optionsErrorMessage.set(
        'No fue posible cargar las líneas disponibles.',
      );
    } finally {
      this.isLoadingOptions.set(false);
    }
  }

  async loadReport(
    query: ReportsQuery,
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

        status_value:
          query.status,
      };

      const [
        summaryResult,
        dailyResult,
        byLineResult,
        recordsResult,
      ] = await Promise.all([
        this.supabase.client.rpc(
          'get_reports_summary',
          commonPayload as SummaryArgs,
        ),

        this.supabase.client.rpc(
          'get_reports_daily',
          commonPayload as DailyArgs,
        ),

        this.supabase.client.rpc(
          'get_reports_by_line',
          commonPayload as ByLineArgs,
        ),

        this.supabase.client.rpc(
          'get_reports_records',
          {
            ...commonPayload,
            row_limit_value: 250,
          } as RecordsArgs,
        ),
      ]);

      const firstError = [
        summaryResult.error,
        dailyResult.error,
        byLineResult.error,
        recordsResult.error,
      ].find(Boolean);

      if (firstError) {
        throw firstError;
      }

      const summaryRow =
        summaryResult.data?.[0];

      this.summary.set(
        summaryRow
          ? this.mapSummary(summaryRow)
          : null,
      );

      this.daily.set(
        (dailyResult.data ?? [])
          .map(row => this.mapDaily(row)),
      );

      this.byLine.set(
        (byLineResult.data ?? [])
          .map(row => this.mapLine(row)),
      );

      this.previewRecords.set(
        (recordsResult.data ?? [])
          .map(row => this.mapRecord(row)),
      );

      this.lastLoadedAt.set(new Date());
    } catch (error: unknown) {
      console.error(
        'Unable to load reports.',
        error,
      );

      if (!silent) {
        this.clearData();
      }

      this.errorMessage.set(
        'No fue posible cargar la información de reportes.',
      );
    } finally {
      this.isLoading.set(false);
      this.isRefreshing.set(false);
    }
  }

  async loadAllRecordsForExport(
    query: ReportsQuery,
  ): Promise<ReportsRecordItem[]> {
    this.isExporting.set(true);

    try {
      const payload = {
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

        status_value:
          query.status,

        row_limit_value: 20000,
      };

      const { data, error } =
        await this.supabase.client.rpc(
          'get_reports_records',
          payload as RecordsArgs,
        );

      if (error) {
        throw error;
      }

      return (data ?? [])
        .map(row => this.mapRecord(row));
    } finally {
      this.isExporting.set(false);
    }
  }

  async loadAllDefectsForExport(
    query: ReportsQuery,
  ): Promise<ReportsDefectItem[]> {
    this.isExporting.set(true);

    try {
      const payload: DefectsArgs = {
        plant_id_value:
          query.plantId,

        date_from_value:
          query.dateFrom,

        date_to_value:
          query.dateTo,

        shift_id_value:
          query.shiftId ?? undefined,

        line_model_assignment_id_value:
          query.lineModelAssignmentId
          ?? undefined,

status_value:
  query.status ?? undefined,

        defect_type_id_value:
          undefined,

        row_limit_value: 50000,
      };

      const { data, error } =
        await this.supabase.client.rpc(
          'get_reports_defects',
          payload,
        );

      if (error) {
        throw error;
      }

      return (data ?? [])
        .map(row => this.mapDefect(row));
    } finally {
      this.isExporting.set(false);
    }
  }

  private clearData(): void {
    this.summary.set(null);
    this.daily.set([]);
    this.byLine.set([]);
    this.previewRecords.set([]);
  }

  private mapSummary(
    row: SummaryRow,
  ): ReportsSummary {
    return {
      totalRecords:
        Number(row.total_records ?? 0),

      draftRecords:
        Number(row.draft_records ?? 0),

      submittedRecords:
        Number(row.submitted_records ?? 0),

      closedRecords:
        Number(row.closed_records ?? 0),

      noProductionRecords:
        Number(
          row.no_production_records ?? 0,
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

      defectiveHarnessPercentage:
        this.toNullableNumber(
          row.defective_harness_percentage,
        ),

      withinTargetRecords:
        Number(
          row.within_target_records ?? 0,
        ),

      outsideTargetRecords:
        Number(
          row.outside_target_records ?? 0,
        ),

      recordsWithoutTarget:
        Number(
          row.records_without_target ?? 0,
        ),

      firstRecordDate:
        row.first_record_date,

      lastRecordDate:
        row.last_record_date,
    };
  }

  private mapDaily(
    row: DailyRow,
  ): ReportsDailyItem {
    return {
      productionDate:
        row.production_date,

      totalRecords:
        Number(row.total_records ?? 0),

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

      withinTargetRecords:
        Number(
          row.within_target_records ?? 0,
        ),

      outsideTargetRecords:
        Number(
          row.outside_target_records ?? 0,
        ),

      noProductionRecords:
        Number(
          row.no_production_records ?? 0,
        ),
    };
  }

  private mapLine(
    row: ByLineRow,
  ): ReportsLineItem {
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

      totalRecords:
        Number(row.total_records ?? 0),

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

      weightedTargetPercentage:
        this.toNullableNumber(
          row.weighted_target_percentage,
        ),

      withinTargetRecords:
        Number(
          row.within_target_records ?? 0,
        ),

      outsideTargetRecords:
        Number(
          row.outside_target_records ?? 0,
        ),

      compliancePercentage:
        this.toNullableNumber(
          row.compliance_percentage,
        ),
    };
  }

  private mapRecord(
    row: RecordRow,
  ): ReportsRecordItem {
    return {
      recordId:
        row.record_id,

      productionDate:
        row.production_date,

      plantId:
        row.plant_id,

      plantCode:
        row.plant_code,

      plantName:
        row.plant_name,

      lineModelAssignmentId:
        row.line_model_assignment_id,

      productionLineId:
        row.production_line_id,

      productionLineName:
        row.production_line_name,

      productModelId:
        row.product_model_id,

      productModelName:
        row.product_model_name,

      modelYear:
        row.model_year,

      shiftId:
        row.shift_id,

      shiftCode:
        row.shift_code,

      shiftName:
        row.shift_name,

      supervisorEmployeeId:
        row.supervisor_employee_id,

      supervisorEmployeeNumber:
        row.supervisor_employee_number,

      supervisorName:
        row.supervisor_name,

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

      targetPercentage:
        this.toNullableNumber(
          row.target_percentage,
        ),

      targetDifference:
        this.toNullableNumber(
          row.target_difference,
        ),

      isWithinTarget:
        row.is_within_target,

      status:
        row.status,

      recordComment:
        row.record_comment,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    };
  }

  private mapDefect(
    row: DefectRow,
  ): ReportsDefectItem {
    return {
      detailId:
        row.detail_id,

      recordId:
        row.record_id,

      productionDate:
        row.production_date,

      plantCode:
        row.plant_code,

      plantName:
        row.plant_name,

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

      defectiveHarnessQuantity:
        Number(
          row.defective_harness_quantity
          ?? 0,
        ),

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

      recordStatus:
        row.record_status,

      recordComment:
        row.record_comment,

      createdAt:
        row.created_at,

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
