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
  Json,
} from '../../../core/types/database.types';

import {
  SupabaseService,
} from '../../../core/services/supabase';

type OperationBoardArguments =
  Database['public']['Functions']['get_daily_operation_board']['Args'];

type OperationBoardRow =
  Database['public']['Functions']['get_daily_operation_board']['Returns'][number];

type SaveDailyRecordArguments =
  Database['public']['Functions']['save_daily_ipd_record']['Args'];

type DailyDefectOverviewRow =
  Database['public']['Views']['daily_ipd_defect_overview']['Row'];

type IpdRecordStatus =
  Database['public']['Enums']['ipd_record_status'];

export type DailyRecordSaveStatus = Extract<
  IpdRecordStatus,
  'draft' | 'submitted' | 'no_production'
>;

export interface AssignedSupervisor {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  photoPath: string | null;
}

export interface DailyOperationBoardItem {
  lineModelAssignmentId: string;

  productionLineId: string;
  productionLineName: string;
  displayOrder: number;

  plantId: string;
  plantCode: string;
  plantName: string;

  productModelId: string;
  productModelName: string;
  modelYear: number | null;

  shiftId: string;
  shiftCode: string;
  shiftName: string;

  assignedSupervisors: AssignedSupervisor[];
  currentUserIsAssigned: boolean;

  targetId: string | null;
  targetPercentage: number | null;

  recordId: string | null;
  supervisorEmployeeId: string | null;
  supervisorEmployeeNumber: string | null;
  supervisorName: string | null;

  producedQuantity: number | null;
  defectiveHarnessQuantity: number | null;
  totalDefects: number | null;
  ipdPercentage: number | null;

  recordTargetPercentage: number | null;
  isWithinTarget: boolean | null;

  comment: string | null;
  status: IpdRecordStatus | null;
  version: number | null;
  updatedAt: string | null;

  monthlyProducedQuantity: number;
  monthlyTotalDefects: number;
  monthlyIpdPercentage: number | null;
  monthlyRecordCount: number;
}

export interface DefectType {
  id: string;
  code: string;
  name: string;
  category: string | null;
  displayOrder: number;
}

export interface DailyRecordDefect {
  id: string;
  defectTypeId: string;
  defectTypeCode: string;
  defectTypeName: string;
  defectCategory: string | null;
  displayOrder: number;
  quantity: number;
  comment: string | null;
}

export interface DailyRecordDefectInput {
  defectTypeId: string;
  quantity: number;
  comment: string | null;
}

export interface SaveDailyRecordInput {
  recordId: string | null;

  productionDate: string;
  lineModelAssignmentId: string;
  shiftId: string;
  supervisorEmployeeId: string;

  producedQuantity: number;
  defectiveHarnessQuantity: number;

  comment: string | null;
  status: DailyRecordSaveStatus;

  expectedVersion: number | null;
  defects: DailyRecordDefectInput[];
}

interface AssignedSupervisorJson {
  employeeId?: unknown;
  employeeNumber?: unknown;
  fullName?: unknown;
  photoPath?: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class DailyEntriesService {
  private readonly supabase =
    inject(SupabaseService);

  readonly board =
    signal<DailyOperationBoardItem[]>([]);

  readonly defectTypes =
    signal<DefectType[]>([]);

  readonly isLoading =
    signal(false);

  readonly errorMessage =
    signal('');

  private realtimeChannel:
    RealtimeChannel | null = null;

  async loadBoard(
    plantId: string,
    shiftId: string,
    productionDate: string,
  ): Promise<void> {
    if (
      !plantId
      || !shiftId
      || !productionDate
    ) {
      this.board.set([]);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const payload: OperationBoardArguments = {
        plant_id_value: plantId,
        shift_id_value: shiftId,
        production_date_value: productionDate,
      };

      const { data, error } =
        await this.supabase.client.rpc(
          'get_daily_operation_board',
          payload,
        );

      if (error) {
        throw error;
      }

      const board = (data ?? [])
        .map(row => this.mapBoardItem(row))
        .filter(
          (
            item,
          ): item is DailyOperationBoardItem =>
            item !== null,
        );

      this.board.set(board);
    } catch (error: unknown) {
      console.error(
        'Unable to load daily operation board.',
        error,
      );

      this.board.set([]);

      this.errorMessage.set(
        'No fue posible cargar las líneas del registro diario.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadDefectTypes(): Promise<void> {
    const { data, error } =
      await this.supabase.client
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
        .order('display_order', {
          ascending: true,
        })
        .order('name_es', {
          ascending: true,
        });

    if (error) {
      throw error;
    }

    const defectTypes: DefectType[] =
      (data ?? [])
        .map(row => ({
          id: String(row.id),
          code: String(row.code),
          name: String(row.name_es),
          category:
            row.category === null
              ? null
              : String(row.category),

          displayOrder:
            Number(row.display_order ?? 0),
        }));

    this.defectTypes.set(defectTypes);
  }

  async loadRecordDefects(
    recordId: string,
  ): Promise<DailyRecordDefect[]> {
    const { data, error } =
      await this.supabase.client
        .from('daily_ipd_defect_overview')
        .select('*')
        .eq('daily_ipd_record_id', recordId)
        .order('display_order', {
          ascending: true,
        });

    if (error) {
      throw error;
    }

    return (data ?? [])
      .map(row => this.mapRecordDefect(row))
      .filter(
        (
          defect,
        ): defect is DailyRecordDefect =>
          defect !== null,
      );
  }

  async saveRecord(
    input: SaveDailyRecordInput,
  ): Promise<string> {
    const payload = {
      record_id_value:
        input.recordId,

      production_date_value:
        input.productionDate,

      line_model_assignment_id_value:
        input.lineModelAssignmentId,

      shift_id_value:
        input.shiftId,

      supervisor_employee_id_value:
        input.supervisorEmployeeId,

      produced_quantity_value:
        input.producedQuantity,

      defective_harness_quantity_value:
        input.defectiveHarnessQuantity,

      comment_value:
        input.comment,

      status_value:
        input.status,

      expected_version_value:
        input.expectedVersion,

      defects_value:
        input.defects as unknown as Json,
    };

    const { data, error } =
      await this.supabase.client.rpc(
        'save_daily_ipd_record',
        payload as SaveDailyRecordArguments,
      );

    if (error) {
      throw error;
    }

    return String(data);
  }

  subscribeToRecordChanges(
    onChange: () => void,
  ): void {
    this.unsubscribeFromRecordChanges();

    this.realtimeChannel =
      this.supabase.client
        .channel(
          `daily-ipd-records-${crypto.randomUUID()}`,
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
        .subscribe();
  }

  unsubscribeFromRecordChanges(): void {
    const channel =
      this.realtimeChannel;

    this.realtimeChannel = null;

    if (channel) {
      void this.supabase.client
        .removeChannel(channel);
    }
  }

  private mapBoardItem(
    row: OperationBoardRow,
  ): DailyOperationBoardItem | null {
    if (
      !row.line_model_assignment_id
      || !row.production_line_id
      || !row.production_line_name
      || row.display_order === null
      || !row.plant_id
      || !row.plant_code
      || !row.plant_name
      || !row.product_model_id
      || !row.product_model_name
      || !row.shift_id
      || !row.shift_code
      || !row.shift_name
      || typeof row.current_user_is_assigned
        !== 'boolean'
    ) {
      return null;
    }

    return {
      lineModelAssignmentId:
        row.line_model_assignment_id,

      productionLineId:
        row.production_line_id,

      productionLineName:
        row.production_line_name,

      displayOrder:
        row.display_order,

      plantId:
        row.plant_id,

      plantCode:
        row.plant_code,

      plantName:
        row.plant_name,

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

      assignedSupervisors:
        this.parseAssignedSupervisors(
          row.assigned_supervisors,
        ),

      currentUserIsAssigned:
        row.current_user_is_assigned,

      targetId:
        row.target_id,

      targetPercentage:
        this.toNullableNumber(
          row.target_percentage,
        ),

      recordId:
        row.record_id,

      supervisorEmployeeId:
        row.supervisor_employee_id,

      supervisorEmployeeNumber:
        row.supervisor_employee_number,

      supervisorName:
        row.supervisor_name,

      producedQuantity:
        row.produced_quantity,

      defectiveHarnessQuantity:
        row.defective_harness_quantity,

      totalDefects:
        row.total_defects,

      ipdPercentage:
        this.toNullableNumber(
          row.ipd_percentage,
        ),

      recordTargetPercentage:
        this.toNullableNumber(
          row.record_target_percentage,
        ),

      isWithinTarget:
        row.is_within_target,

      comment:
        row.comment,

      status:
        row.status,

      version:
        row.version,

      updatedAt:
        row.updated_at,

      monthlyProducedQuantity:
        Number(
          row.monthly_produced_quantity ?? 0,
        ),

      monthlyTotalDefects:
        Number(
          row.monthly_total_defects ?? 0,
        ),

      monthlyIpdPercentage:
        this.toNullableNumber(
          row.monthly_ipd_percentage,
        ),

      monthlyRecordCount:
        Number(
          row.monthly_record_count ?? 0,
        ),
    };
  }

  private mapRecordDefect(
    row: DailyDefectOverviewRow,
  ): DailyRecordDefect | null {
    if (
      !row.id
      || !row.daily_ipd_record_id
      || !row.defect_type_id
      || !row.defect_type_code
      || !row.defect_type_name
      || row.display_order === null
      || row.quantity === null
    ) {
      return null;
    }

    return {
      id: row.id,

      defectTypeId:
        row.defect_type_id,

      defectTypeCode:
        row.defect_type_code,

      defectTypeName:
        row.defect_type_name,

      defectCategory:
        row.defect_category,

      displayOrder:
        row.display_order,

      quantity:
        row.quantity,

      comment:
        row.comment,
    };
  }

  private parseAssignedSupervisors(
    value: Json | null,
  ): AssignedSupervisor[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(item => {
        if (
          !item
          || typeof item !== 'object'
          || Array.isArray(item)
        ) {
          return null;
        }

        const supervisor =
          item as AssignedSupervisorJson;

        if (
          typeof supervisor.employeeId
            !== 'string'
          || typeof supervisor.employeeNumber
            !== 'string'
          || typeof supervisor.fullName
            !== 'string'
        ) {
          return null;
        }

        return {
          employeeId:
            supervisor.employeeId,

          employeeNumber:
            supervisor.employeeNumber,

          fullName:
            supervisor.fullName,

          photoPath:
            typeof supervisor.photoPath
              === 'string'
              ? supervisor.photoPath
              : null,
        };
      })
      .filter(
        (
          supervisor,
        ): supervisor is AssignedSupervisor =>
          supervisor !== null,
      );
  }

  private toNullableNumber(
    value: number | string | null,
  ): number | null {
    if (value === null) {
      return null;
    }

    const numberValue = Number(value);

    return Number.isFinite(numberValue)
      ? numberValue
      : null;
  }
}
