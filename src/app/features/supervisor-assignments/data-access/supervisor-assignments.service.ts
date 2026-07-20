import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { Database } from '../../../core/types/database.types';
import { SupabaseService } from '../../../core/services/supabase';

type AssignmentOverviewRow =
  Database['public']['Views']['supervisor_assignment_overview']['Row'];

type SearchEmployeesArguments =
  Database['public']['Functions']['search_employees']['Args'];

type SearchEmployeeRow =
  Database['public']['Functions']['search_employees']['Returns'][number];

type CreateAssignmentsArguments =
  Database['public']['Functions']['create_supervisor_assignments']['Args'];

type UpdateAssignmentArguments =
  Database['public']['Functions']['update_supervisor_assignment']['Args'];

type CreateAssignmentsPayload = Omit<
  CreateAssignmentsArguments,
  'effective_to_value'
> & {
  effective_to_value: string | null;
};

type UpdateAssignmentPayload = Omit<
  UpdateAssignmentArguments,
  'effective_to_value'
> & {
  effective_to_value: string | null;
};

export interface SupervisorAssignment {
  id: string;

  supervisorEmployeeId: string;
  employeeNumber: string;
  supervisorName: string;
  photoPath: string | null;
  supervisorPlantId: string | null;

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

  effectiveFrom: string;
  effectiveTo: string | null;
  active: boolean;
  isCurrent: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface SupervisorCandidate {
  id: string;
  employeeNumber: string;
  fullName: string;
  plantId: string | null;
  plantCode: string | null;
  plantName: string | null;
  photoPath: string | null;
}

export interface CreateSupervisorAssignmentsInput {
  supervisorEmployeeId: string;
  lineModelAssignmentIds: string[];
  shiftId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface UpdateSupervisorAssignmentInput {
  assignmentId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  active: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SupervisorAssignmentsService {
  private readonly supabase = inject(SupabaseService);

  readonly assignments = signal<SupervisorAssignment[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  async loadAssignments(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const { data, error } = await this.supabase.client
        .from('supervisor_assignment_overview')
        .select('*')
        .order('is_current', {
          ascending: false,
        })
        .order('active', {
          ascending: false,
        })
        .order('plant_code', {
          ascending: true,
        })
        .order('display_order', {
          ascending: true,
        })
        .order('supervisor_name', {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      const assignments = (data ?? [])
        .map(row => this.mapAssignment(row))
        .filter(
          (
            assignment,
          ): assignment is SupervisorAssignment =>
            assignment !== null,
        );

      this.assignments.set(assignments);
    } catch (error: unknown) {
      console.error(
        'Unable to load supervisor assignments.',
        error,
      );

      this.assignments.set([]);
      this.errorMessage.set(
        'No fue posible cargar las asignaciones.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async searchSupervisorCandidates(
    search: string,
    plantId: string,
    pageSize = 20,
  ): Promise<SupervisorCandidate[]> {
    const normalizedSearch = search.trim();

    if (
      normalizedSearch.length < 2
      || !plantId
    ) {
      return [];
    }

    const payload: SearchEmployeesArguments = {
      search_value: normalizedSearch,
      plant_id_value: plantId,
      active_value: true,
      page_number_value: 1,
      page_size_value: pageSize,
    };

    const { data, error } =
      await this.supabase.client.rpc(
        'search_employees',
        payload,
      );

    if (error) {
      throw error;
    }

    return (data ?? [])
      .map(row => this.mapCandidate(row))
      .filter(
        (
          candidate,
        ): candidate is SupervisorCandidate =>
          candidate !== null,
      );
  }

  async createAssignments(
    input: CreateSupervisorAssignmentsInput,
  ): Promise<number> {
    const payload: CreateAssignmentsPayload = {
      supervisor_employee_id_value:
        input.supervisorEmployeeId,

      line_model_assignment_ids_value:
        input.lineModelAssignmentIds,

      shift_id_value:
        input.shiftId,

      effective_from_value:
        input.effectiveFrom,

      effective_to_value:
        input.effectiveTo,
    };

    const { data, error } =
      await this.supabase.client.rpc(
        'create_supervisor_assignments',
        payload as CreateAssignmentsArguments,
      );

    if (error) {
      throw error;
    }

    await this.loadAssignments();

    return Number(data ?? 0);
  }

  async updateAssignment(
    input: UpdateSupervisorAssignmentInput,
  ): Promise<void> {
    const payload: UpdateAssignmentPayload = {
      assignment_id_value:
        input.assignmentId,

      shift_id_value:
        input.shiftId,

      effective_from_value:
        input.effectiveFrom,

      effective_to_value:
        input.effectiveTo,

      active_value:
        input.active,
    };

    const { error } =
      await this.supabase.client.rpc(
        'update_supervisor_assignment',
        payload as UpdateAssignmentArguments,
      );

    if (error) {
      throw error;
    }

    await this.loadAssignments();
  }

  private mapAssignment(
    row: AssignmentOverviewRow,
  ): SupervisorAssignment | null {
    if (
      !row.id
      || !row.supervisor_employee_id
      || !row.employee_number
      || !row.supervisor_name
      || !row.line_model_assignment_id
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
      || !row.effective_from
      || typeof row.active !== 'boolean'
      || typeof row.is_current !== 'boolean'
      || !row.created_at
      || !row.updated_at
    ) {
      return null;
    }

    return {
      id: row.id,

      supervisorEmployeeId:
        row.supervisor_employee_id,

      employeeNumber:
        row.employee_number,

      supervisorName:
        row.supervisor_name,

      photoPath:
        row.photo_path,

      supervisorPlantId:
        row.supervisor_plant_id,

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

      effectiveFrom:
        row.effective_from,

      effectiveTo:
        row.effective_to,

      active:
        row.active,

      isCurrent:
        row.is_current,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    };
  }

  private mapCandidate(
    row: SearchEmployeeRow,
  ): SupervisorCandidate | null {
    if (
      !row.id
      || !row.employee_number
      || !row.full_name
    ) {
      return null;
    }

    return {
      id: row.id,
      employeeNumber: row.employee_number,
      fullName: row.full_name,
      plantId: row.plant_id,
      plantCode: row.plant_code,
      plantName: row.plant_name,
      photoPath: row.photo_path,
    };
  }
}
