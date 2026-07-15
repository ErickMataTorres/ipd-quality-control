import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { SupabaseService } from '../../../core/services/supabase';
import { Database } from '../../../core/types/database.types';

type ProductModelRow =
  Database['public']['Tables']['product_models']['Row'];

type ProductModelInsert =
  Database['public']['Tables']['product_models']['Insert'];

type ProductModelUpdate =
  Database['public']['Tables']['product_models']['Update'];

export type ProductModel = Pick<
  ProductModelRow,
  | 'id'
  | 'name'
  | 'model_year'
  | 'description'
  | 'active'
  | 'customer_id'
  | 'created_at'
  | 'updated_at'
>;

export interface ProductModelInput {
  name: string;
  modelYear: number | null;
  description: string | null;
}

const PRODUCT_MODEL_COLUMNS = `
  id,
  name,
  model_year,
  description,
  active,
  customer_id,
  created_at,
  updated_at
`;

@Injectable({
  providedIn: 'root',
})
export class ProductModelsService {
  private readonly supabase = inject(SupabaseService);

  readonly models = signal<ProductModel[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  async loadModels(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const { data, error } = await this.supabase.client
        .from('product_models')
        .select(PRODUCT_MODEL_COLUMNS)
        .order('active', {
          ascending: false,
        })
        .order('model_year', {
          ascending: false,
          nullsFirst: false,
        })
        .order('name', {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      this.models.set(
        (data ?? []) as ProductModel[],
      );
    } catch (error: unknown) {
      console.error(
        'Unable to load product models.',
        error,
      );

      this.errorMessage.set(
        'No fue posible cargar los modelos.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async createModel(
    input: ProductModelInput,
  ): Promise<ProductModel> {
    const payload: ProductModelInsert = {
      name: input.name.trim(),
      model_year: input.modelYear,
      description:
        input.description?.trim() || null,
      customer_id: null,
      active: true,
    };

    const { data, error } = await this.supabase.client
      .from('product_models')
      .insert(payload)
      .select(PRODUCT_MODEL_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    const createdModel = data as ProductModel;

    this.models.update(currentModels =>
      [...currentModels, createdModel].sort(
        this.compareModels,
      ),
    );

    return createdModel;
  }

  async updateModel(
    modelId: string,
    input: ProductModelInput,
  ): Promise<ProductModel> {
    const payload: ProductModelUpdate = {
      name: input.name.trim(),
      model_year: input.modelYear,
      description:
        input.description?.trim() || null,
    };

    const { data, error } = await this.supabase.client
      .from('product_models')
      .update(payload)
      .eq('id', modelId)
      .select(PRODUCT_MODEL_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    const updatedModel = data as ProductModel;

    this.models.update(currentModels =>
      currentModels
        .map(model =>
          model.id === modelId
            ? updatedModel
            : model,
        )
        .sort(this.compareModels),
    );

    return updatedModel;
  }

  async setModelActive(
    modelId: string,
    active: boolean,
  ): Promise<ProductModel> {
    const { data, error } = await this.supabase.client
      .from('product_models')
      .update({
        active,
      })
      .eq('id', modelId)
      .select(PRODUCT_MODEL_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    const updatedModel = data as ProductModel;

    this.models.update(currentModels =>
      currentModels
        .map(model =>
          model.id === modelId
            ? updatedModel
            : model,
        )
        .sort(this.compareModels),
    );

    return updatedModel;
  }

  private readonly compareModels = (
    firstModel: ProductModel,
    secondModel: ProductModel,
  ): number => {
    if (firstModel.active !== secondModel.active) {
      return firstModel.active ? -1 : 1;
    }

    const firstYear =
      firstModel.model_year ?? 0;

    const secondYear =
      secondModel.model_year ?? 0;

    if (firstYear !== secondYear) {
      return secondYear - firstYear;
    }

    return firstModel.name.localeCompare(
      secondModel.name,
      'es',
      {
        sensitivity: 'base',
      },
    );
  };
}
