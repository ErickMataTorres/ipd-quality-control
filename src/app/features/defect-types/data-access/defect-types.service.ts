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

type DefectTypeRow =
  Database['public']['Tables']['defect_types']['Row'];

type DefectTypeInsert =
  Database['public']['Tables']['defect_types']['Insert'];

type DefectTypeUpdate =
  Database['public']['Tables']['defect_types']['Update'];

export type DefectType = Pick<
  DefectTypeRow,
  | 'id'
  | 'code'
  | 'name_es'
  | 'name_en'
  | 'category'
  | 'description'
  | 'display_order'
  | 'active'
  | 'created_at'
  | 'updated_at'
>;

export interface DefectTypeInput {
  code: string;
  nameEs: string;
  nameEn: string;
  category: string | null;
  description: string | null;
  displayOrder: number;
}

const DEFECT_TYPE_COLUMNS = `
  id,
  code,
  name_es,
  name_en,
  category,
  description,
  display_order,
  active,
  created_at,
  updated_at
`;

@Injectable({
  providedIn: 'root',
})
export class DefectTypesService {
  private readonly supabase =
    inject(SupabaseService);

  readonly defectTypes =
    signal<DefectType[]>([]);

  readonly isLoading =
    signal(false);

  readonly errorMessage =
    signal('');

  async loadDefectTypes():
    Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const { data, error } =
        await this.supabase.client
          .from('defect_types')
          .select(DEFECT_TYPE_COLUMNS)
          .order(
            'active',
            {
              ascending: false,
            },
          )
          .order(
            'display_order',
            {
              ascending: true,
            },
          )
          .order(
            'name_es',
            {
              ascending: true,
            },
          );

      if (error) {
        throw error;
      }

      this.defectTypes.set(
        (data ?? []) as DefectType[],
      );
    } catch (error: unknown) {
      console.error(
        'Unable to load defect types.',
        error,
      );

      this.errorMessage.set(
        'No fue posible cargar los tipos de defecto.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async createDefectType(
    input: DefectTypeInput,
  ): Promise<DefectType> {
    const payload: DefectTypeInsert = {
      code:
        this.normalizeCode(input.code),

      name_es:
        input.nameEs.trim(),

      name_en:
        input.nameEn.trim(),

      category:
        input.category?.trim()
        || null,

      description:
        input.description?.trim()
        || null,

      display_order:
        input.displayOrder,

      active: true,
    };

    const { data, error } =
      await this.supabase.client
        .from('defect_types')
        .insert(payload)
        .select(DEFECT_TYPE_COLUMNS)
        .single();

    if (error) {
      throw error;
    }

    const createdDefectType =
      data as DefectType;

    this.defectTypes.update(
      currentDefectTypes =>
        [
          ...currentDefectTypes,
          createdDefectType,
        ].sort(
          this.compareDefectTypes,
        ),
    );

    return createdDefectType;
  }

  async updateDefectType(
    defectTypeId: string,
    input: DefectTypeInput,
  ): Promise<DefectType> {
    const payload: DefectTypeUpdate = {
      code:
        this.normalizeCode(input.code),

      name_es:
        input.nameEs.trim(),

      name_en:
        input.nameEn.trim(),

      category:
        input.category?.trim()
        || null,

      description:
        input.description?.trim()
        || null,

      display_order:
        input.displayOrder,
    };

    const { data, error } =
      await this.supabase.client
        .from('defect_types')
        .update(payload)
        .eq('id', defectTypeId)
        .select(DEFECT_TYPE_COLUMNS)
        .single();

    if (error) {
      throw error;
    }

    const updatedDefectType =
      data as DefectType;

    this.defectTypes.update(
      currentDefectTypes =>
        currentDefectTypes
          .map(defectType =>
            defectType.id
              === defectTypeId
              ? updatedDefectType
              : defectType,
          )
          .sort(
            this.compareDefectTypes,
          ),
    );

    return updatedDefectType;
  }

  async setDefectTypeActive(
    defectTypeId: string,
    active: boolean,
  ): Promise<DefectType> {
    const { data, error } =
      await this.supabase.client
        .from('defect_types')
        .update({
          active,
        })
        .eq('id', defectTypeId)
        .select(DEFECT_TYPE_COLUMNS)
        .single();

    if (error) {
      throw error;
    }

    const updatedDefectType =
      data as DefectType;

    this.defectTypes.update(
      currentDefectTypes =>
        currentDefectTypes
          .map(defectType =>
            defectType.id
              === defectTypeId
              ? updatedDefectType
              : defectType,
          )
          .sort(
            this.compareDefectTypes,
          ),
    );

    return updatedDefectType;
  }

  private normalizeCode(
    value: string,
  ): string {
    return value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
  }

  private readonly compareDefectTypes = (
    firstDefectType: DefectType,
    secondDefectType: DefectType,
  ): number => {
    if (
      firstDefectType.active
      !== secondDefectType.active
    ) {
      return firstDefectType.active
        ? -1
        : 1;
    }

    if (
      firstDefectType.display_order
      !== secondDefectType.display_order
    ) {
      return (
        firstDefectType.display_order
        - secondDefectType.display_order
      );
    }

    return firstDefectType.name_es
      .localeCompare(
        secondDefectType.name_es,
        'es',
        {
          sensitivity: 'base',
        },
      );
  };
}
