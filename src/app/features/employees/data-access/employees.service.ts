import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { SupabaseService } from '../../../core/services/supabase';
import { Database } from '../../../core/types/database.types';

type SearchEmployeesArguments =
  Database['public']['Functions']['search_employees']['Args'];

type SearchEmployeeRow =
  Database['public']['Functions']['search_employees']['Returns'][number];

export type EmployeeStatusFilter =
  | 'all'
  | 'active'
  | 'inactive';

export interface EmployeeSearchRequest {
  search: string;
  plantId: string | null;
  shiftId: string | null;
  status: EmployeeStatusFilter;
  pageIndex: number;
  pageSize: number;
}

interface SearchEmployeesPayload {
  search_value?: string;
  plant_id_value?: string;
  shift_id_value?: string;
  active_value?: boolean;
  page_number_value: number;
  page_size_value: number;
}

export interface EmployeeDirectoryItem {
  id: string;
  employeeNumber: string;
  fullName: string;

  plantId: string | null;
  plantCode: string | null;
  plantName: string | null;

  shiftId: string | null;
  shiftCode: string | null;
  shiftName: string | null;

  productionLineId: string | null;
  productionLineName: string | null;

  serviceDate: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  jobPosition: string | null;

  sourceLocationCode: string | null;
  sourceShiftCode: string | null;
  sourceLineCode: string | null;

  photoPath: string | null;
  active: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class EmployeesService {
  private readonly supabase = inject(SupabaseService);

  readonly employees =
    signal<EmployeeDirectoryItem[]>([]);

  readonly totalCount = signal(0);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  async searchEmployees(
    request: EmployeeSearchRequest,
  ): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const payload: SearchEmployeesPayload = {
        page_number_value:
          request.pageIndex + 1,

        page_size_value:
          request.pageSize,
      };

      const normalizedSearch =
        request.search.trim();

      if (normalizedSearch) {
        payload.search_value =
          normalizedSearch;
      }

      if (request.plantId) {
        payload.plant_id_value =
          request.plantId;
      }

      if (request.shiftId) {
        payload.shift_id_value =
          request.shiftId;
      }

      if (request.status !== 'all') {
        payload.active_value =
          request.status === 'active';
      }

      const { data, error } =
        await this.supabase.client.rpc(
          'search_employees',
          payload as SearchEmployeesArguments,
        );

      if (error) {
        throw error;
      }

      const employees = (data ?? [])
        .map(row => this.mapEmployee(row))
        .filter(
          (
            employee,
          ): employee is EmployeeDirectoryItem =>
            employee !== null,
        );

      this.employees.set(employees);

      this.totalCount.set(
        Number(
          data?.[0]?.total_count ?? 0,
        ),
      );
    } catch (error: unknown) {
      console.error(
        'Unable to search employees.',
        error,
      );

      this.employees.set([]);
      this.totalCount.set(0);

      this.errorMessage.set(
        'No fue posible consultar los empleados.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  clear(): void {
    this.employees.set([]);
    this.totalCount.set(0);
    this.errorMessage.set('');
  }

  private mapEmployee(
    row: SearchEmployeeRow,
  ): EmployeeDirectoryItem | null {
    if (
      !row.id
      || !row.employee_number
      || !row.full_name
      || typeof row.active !== 'boolean'
    ) {
      return null;
    }

    return {
      id: row.id,
      employeeNumber:
        row.employee_number,

      fullName:
        row.full_name,

      plantId:
        row.plant_id,

      plantCode:
        row.plant_code,

      plantName:
        row.plant_name,

      shiftId:
        row.shift_id,

      shiftCode:
        row.shift_code,

      shiftName:
        row.shift_name,

      productionLineId:
        row.production_line_id,

      productionLineName:
        row.production_line_name,

      serviceDate:
        row.service_date,

      departmentName:
        row.department_name,

      departmentCode:
        row.department_code,

      jobPosition:
        row.job_position,

      sourceLocationCode:
        row.source_location_code,

      sourceShiftCode:
        row.source_shift_code,

      sourceLineCode:
        row.source_line_code,

      photoPath:
        row.photo_path,

      active:
        row.active,
    };
  }
}
