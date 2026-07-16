import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { SupabaseService } from '../../../core/services/supabase';
import { Database } from '../../../core/types/database.types';

type ShiftRow =
  Database['public']['Tables']['shifts']['Row'];

type ShiftInsert =
  Database['public']['Tables']['shifts']['Insert'];

type ShiftUpdate =
  Database['public']['Tables']['shifts']['Update'];

export type Shift = Pick<
  ShiftRow,
  | 'id'
  | 'code'
  | 'name'
  | 'start_time'
  | 'end_time'
  | 'display_order'
  | 'active'
  | 'created_at'
  | 'updated_at'
>;

export interface ShiftInput {
  code: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  displayOrder: number;
}

const SHIFT_COLUMNS = `
  id,
  code,
  name,
  start_time,
  end_time,
  display_order,
  active,
  created_at,
  updated_at
`;

@Injectable({
  providedIn: 'root',
})
export class ShiftsService {
  private readonly supabase = inject(SupabaseService);

  readonly shifts = signal<Shift[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  async loadShifts(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const { data, error } = await this.supabase.client
        .from('shifts')
        .select(SHIFT_COLUMNS)
        .order('active', {
          ascending: false,
        })
        .order('display_order', {
          ascending: true,
        })
        .order('name', {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      this.shifts.set((data ?? []) as Shift[]);
    } catch (error: unknown) {
      console.error(
        'Unable to load shifts.',
        error,
      );

      this.errorMessage.set(
        'No fue posible cargar los turnos.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async createShift(
    input: ShiftInput,
  ): Promise<Shift> {
    const payload: ShiftInsert = {
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      start_time: input.startTime,
      end_time: input.endTime,
      display_order: input.displayOrder,
      active: true,
    };

    const { data, error } = await this.supabase.client
      .from('shifts')
      .insert(payload)
      .select(SHIFT_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    const createdShift = data as Shift;

    this.shifts.update(currentShifts =>
      [...currentShifts, createdShift].sort(
        this.compareShifts,
      ),
    );

    return createdShift;
  }

  async updateShift(
    shiftId: string,
    input: ShiftInput,
  ): Promise<Shift> {
    const payload: ShiftUpdate = {
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      start_time: input.startTime,
      end_time: input.endTime,
      display_order: input.displayOrder,
    };

    const { data, error } = await this.supabase.client
      .from('shifts')
      .update(payload)
      .eq('id', shiftId)
      .select(SHIFT_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    const updatedShift = data as Shift;

    this.shifts.update(currentShifts =>
      currentShifts
        .map(shift =>
          shift.id === shiftId
            ? updatedShift
            : shift,
        )
        .sort(this.compareShifts),
    );

    return updatedShift;
  }

  async setShiftActive(
    shiftId: string,
    active: boolean,
  ): Promise<Shift> {
    const { data, error } = await this.supabase.client
      .from('shifts')
      .update({
        active,
      })
      .eq('id', shiftId)
      .select(SHIFT_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    const updatedShift = data as Shift;

    this.shifts.update(currentShifts =>
      currentShifts
        .map(shift =>
          shift.id === shiftId
            ? updatedShift
            : shift,
        )
        .sort(this.compareShifts),
    );

    return updatedShift;
  }

  private readonly compareShifts = (
    firstShift: Shift,
    secondShift: Shift,
  ): number => {
    if (firstShift.active !== secondShift.active) {
      return firstShift.active ? -1 : 1;
    }

    if (
      firstShift.display_order
      !== secondShift.display_order
    ) {
      return (
        firstShift.display_order
        - secondShift.display_order
      );
    }

    return firstShift.name.localeCompare(
      secondShift.name,
      'es',
      {
        sensitivity: 'base',
      },
    );
  };
}
