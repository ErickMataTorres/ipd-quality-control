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

type LiveOperationArguments =
  Database['public']['Functions']['get_live_operation_board']['Args'];

type LiveOperationRow =
  Database['public']['Functions']['get_live_operation_board']['Returns'][number];

type IpdRecordStatus =
  Database['public']['Enums']['ipd_record_status'];

type LiveOperationPayload = Omit<
  LiveOperationArguments,
  'shift_id_value'
> & {
  shift_id_value: string | null;
};

export type RealtimeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface LiveAssignedSupervisor {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  photoPath: string | null;
}

export interface LiveOperationItem {
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

  assignedSupervisors:
    LiveAssignedSupervisor[];

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
  isWithinTarget: boolean | null;

  defectTypeCount: number;

  topDefectTypeId: string | null;
  topDefectTypeCode: string | null;
  topDefectTypeName: string | null;
  topDefectQuantity: number | null;

  comment: string | null;
  status: IpdRecordStatus | null;
  version: number | null;

  submittedAt: string | null;
  closedAt: string | null;
  updatedAt: string | null;

  monthlyProducedQuantity: number;
  monthlyTotalDefects: number;
  monthlyIpdPercentage: number | null;
  monthlyRecordCount: number;
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
export class LiveOperationsService {
  private readonly supabase =
    inject(SupabaseService);

  readonly board =
    signal<LiveOperationItem[]>([]);

  readonly isLoading =
    signal(false);

  readonly isRefreshing =
    signal(false);

  readonly errorMessage =
    signal('');

  readonly realtimeStatus =
    signal<RealtimeConnectionStatus>(
      'disconnected',
    );

  readonly lastLoadedAt =
    signal<Date | null>(null);

  private realtimeChannel:
    RealtimeChannel | null = null;

  async loadBoard(
    plantId: string,
    productionDate: string,
    shiftId: string | null,
    silent = false,
  ): Promise<void> {
    if (
      !plantId
      || !productionDate
    ) {
      this.board.set([]);
      return;
    }

    if (silent) {
      this.isRefreshing.set(true);
    } else {
      this.isLoading.set(true);
    }

    this.errorMessage.set('');

    try {
      const payload: LiveOperationPayload = {
        plant_id_value:
          plantId,

        production_date_value:
          productionDate,

        shift_id_value:
          shiftId,
      };

      const { data, error } =
        await this.supabase.client.rpc(
          'get_live_operation_board',
          payload as LiveOperationArguments,
        );

      if (error) {
        throw error;
      }

      const board = (data ?? [])
        .map(row => this.mapBoardItem(row))
        .filter(
          (
            item,
          ): item is LiveOperationItem =>
            item !== null,
        );

      this.board.set(board);
      this.lastLoadedAt.set(new Date());
    } catch (error: unknown) {
      console.error(
        'Unable to load the live operation board.',
        error,
      );

      if (!silent) {
        this.board.set([]);
      }

      this.errorMessage.set(
        'No fue posible cargar la operación en tiempo real.',
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
          `live-operations-${crypto.randomUUID()}`,
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

    this.realtimeStatus.set('disconnected');
  }

  private mapBoardItem(
    row: LiveOperationRow,
  ): LiveOperationItem | null {
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

      isWithinTarget:
        row.is_within_target,

      defectTypeCount:
        Number(
          row.defect_type_count ?? 0,
        ),

      topDefectTypeId:
        row.top_defect_type_id,

      topDefectTypeCode:
        row.top_defect_type_code,

      topDefectTypeName:
        row.top_defect_type_name,

      topDefectQuantity:
        row.top_defect_quantity,

      comment:
        row.comment,

      status:
        row.status,

      version:
        row.version,

      submittedAt:
        row.submitted_at,

      closedAt:
        row.closed_at,

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

  private parseAssignedSupervisors(
    value: Json | null,
  ): LiveAssignedSupervisor[] {
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
        ): supervisor is LiveAssignedSupervisor =>
          supervisor !== null,
      );
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
