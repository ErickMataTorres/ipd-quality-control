export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_at: string
          changed_by: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_ipd_defects: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          daily_ipd_record_id: string
          defect_type_id: string
          id: string
          quantity: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          daily_ipd_record_id: string
          defect_type_id: string
          id?: string
          quantity: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          daily_ipd_record_id?: string
          defect_type_id?: string
          id?: string
          quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_ipd_defects_daily_ipd_record_id_fkey"
            columns: ["daily_ipd_record_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_ipd_defects_daily_ipd_record_id_fkey"
            columns: ["daily_ipd_record_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_ipd_defects_defect_type_id_fkey"
            columns: ["defect_type_id"]
            isOneToOne: false
            referencedRelation: "defect_types"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_ipd_records: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          defective_harness_quantity: number | null
          id: string
          ipd_percentage: number | null
          line_model_assignment_id: string
          modification_reason: string | null
          produced_quantity: number
          production_date: string
          shift_id: string
          status: Database["public"]["Enums"]["ipd_record_status"]
          submitted_at: string | null
          submitted_by: string | null
          supervisor_employee_id: string
          target_id: string | null
          target_percentage: number | null
          total_defects: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          defective_harness_quantity?: number | null
          id?: string
          ipd_percentage?: number | null
          line_model_assignment_id: string
          modification_reason?: string | null
          produced_quantity?: number
          production_date: string
          shift_id: string
          status?: Database["public"]["Enums"]["ipd_record_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          supervisor_employee_id: string
          target_id?: string | null
          target_percentage?: number | null
          total_defects?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          defective_harness_quantity?: number | null
          id?: string
          ipd_percentage?: number | null
          line_model_assignment_id?: string
          modification_reason?: string | null
          produced_quantity?: number
          production_date?: string
          shift_id?: string
          status?: Database["public"]["Enums"]["ipd_record_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          supervisor_employee_id?: string
          target_id?: string | null
          target_percentage?: number | null
          total_defects?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_ipd_records_line_model_assignment_id_fkey"
            columns: ["line_model_assignment_id"]
            isOneToOne: false
            referencedRelation: "line_model_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_ipd_records_line_model_assignment_id_fkey"
            columns: ["line_model_assignment_id"]
            isOneToOne: false
            referencedRelation: "production_line_overview"
            referencedColumns: ["line_model_assignment_id"]
          },
          {
            foreignKeyName: "daily_ipd_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "daily_ipd_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_ipd_records_supervisor_employee_id_fkey"
            columns: ["supervisor_employee_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["supervisor_employee_id"]
          },
          {
            foreignKeyName: "daily_ipd_records_supervisor_employee_id_fkey"
            columns: ["supervisor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_ipd_records_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "ipd_target_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_ipd_records_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "ipd_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_types: {
        Row: {
          active: boolean
          category: string | null
          code: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          name_en: string
          name_es: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name_en: string
          name_es: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name_en?: string
          name_es?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          error_summary: Json | null
          id: string
          imported_by: string | null
          inserted_rows: number
          invalid_rows: number
          source_file_name: string
          source_file_sha256: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["import_batch_status"]
          total_rows: number
          updated_rows: number
          valid_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_summary?: Json | null
          id?: string
          imported_by?: string | null
          inserted_rows?: number
          invalid_rows?: number
          source_file_name: string
          source_file_sha256?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_batch_status"]
          total_rows?: number
          updated_rows?: number
          valid_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_summary?: Json | null
          id?: string
          imported_by?: string | null
          inserted_rows?: number
          invalid_rows?: number
          source_file_name?: string
          source_file_sha256?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_batch_status"]
          total_rows?: number
          updated_rows?: number
          valid_rows?: number
        }
        Relationships: []
      }
      employee_import_staging: {
        Row: {
          category: string | null
          created_at: string
          department_code: string | null
          department_name: string | null
          employee_number: string | null
          full_name: string | null
          function_name: string | null
          id: string
          import_batch_id: string
          job_position: string | null
          line_code: string | null
          location_code: string | null
          position_name: string | null
          process_name: string | null
          processed: boolean
          row_number: number
          service_date_text: string | null
          shift_code: string | null
          validation_errors: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          department_code?: string | null
          department_name?: string | null
          employee_number?: string | null
          full_name?: string | null
          function_name?: string | null
          id?: string
          import_batch_id: string
          job_position?: string | null
          line_code?: string | null
          location_code?: string | null
          position_name?: string | null
          process_name?: string | null
          processed?: boolean
          row_number: number
          service_date_text?: string | null
          shift_code?: string | null
          validation_errors?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string
          department_code?: string | null
          department_name?: string | null
          employee_number?: string | null
          full_name?: string | null
          function_name?: string | null
          id?: string
          import_batch_id?: string
          job_position?: string | null
          line_code?: string | null
          location_code?: string | null
          position_name?: string | null
          process_name?: string | null
          processed?: boolean
          row_number?: number
          service_date_text?: string | null
          shift_code?: string | null
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_import_staging_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "employee_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          department_code: string | null
          department_name: string | null
          employee_number: string
          full_name: string
          function_name: string | null
          id: string
          job_position: string | null
          photo_path: string | null
          plant_id: string | null
          position_name: string | null
          process_name: string | null
          production_line_id: string | null
          service_date: string | null
          shift_id: string | null
          source_line_code: string | null
          source_location_code: string | null
          source_shift_code: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          department_code?: string | null
          department_name?: string | null
          employee_number: string
          full_name: string
          function_name?: string | null
          id?: string
          job_position?: string | null
          photo_path?: string | null
          plant_id?: string | null
          position_name?: string | null
          process_name?: string | null
          production_line_id?: string | null
          service_date?: string | null
          shift_id?: string | null
          source_line_code?: string | null
          source_location_code?: string | null
          source_shift_code?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          department_code?: string | null
          department_name?: string | null
          employee_number?: string
          full_name?: string
          function_name?: string | null
          id?: string
          job_position?: string | null
          photo_path?: string | null
          plant_id?: string | null
          position_name?: string | null
          process_name?: string | null
          production_line_id?: string | null
          service_date?: string | null
          shift_id?: string | null
          source_line_code?: string | null
          source_location_code?: string | null
          source_shift_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "employees_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "ipd_target_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "employees_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "supervisor_assignment_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "employees_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["production_line_id"]
          },
          {
            foreignKeyName: "employees_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "ipd_target_overview"
            referencedColumns: ["production_line_id"]
          },
          {
            foreignKeyName: "employees_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "production_line_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "supervisor_assignment_overview"
            referencedColumns: ["production_line_id"]
          },
          {
            foreignKeyName: "employees_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "employees_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      ipd_targets: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          line_model_assignment_id: string
          shift_id: string | null
          target_percentage: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          line_model_assignment_id: string
          shift_id?: string | null
          target_percentage: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          line_model_assignment_id?: string
          shift_id?: string | null
          target_percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ipd_targets_line_model_assignment_id_fkey"
            columns: ["line_model_assignment_id"]
            isOneToOne: false
            referencedRelation: "line_model_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipd_targets_line_model_assignment_id_fkey"
            columns: ["line_model_assignment_id"]
            isOneToOne: false
            referencedRelation: "production_line_overview"
            referencedColumns: ["line_model_assignment_id"]
          },
          {
            foreignKeyName: "ipd_targets_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "ipd_targets_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      line_model_assignments: {
        Row: {
          active: boolean
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          product_model_id: string
          production_line_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          product_model_id: string
          production_line_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          product_model_id?: string
          production_line_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_model_assignments_product_model_id_fkey"
            columns: ["product_model_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["product_model_id"]
          },
          {
            foreignKeyName: "line_model_assignments_product_model_id_fkey"
            columns: ["product_model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_model_assignments_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["production_line_id"]
          },
          {
            foreignKeyName: "line_model_assignments_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "ipd_target_overview"
            referencedColumns: ["production_line_id"]
          },
          {
            foreignKeyName: "line_model_assignments_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "production_line_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_model_assignments_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_model_assignments_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "supervisor_assignment_overview"
            referencedColumns: ["production_line_id"]
          },
        ]
      }
      plants: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_models: {
        Row: {
          active: boolean
          created_at: string
          customer_id: string | null
          description: string | null
          id: string
          model_year: number | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          model_year?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          model_year?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_models_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_lines: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          plant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          plant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          plant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "production_lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "ipd_target_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "production_lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "supervisor_assignment_overview"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      shifts: {
        Row: {
          active: boolean
          code: string
          created_at: string
          display_order: number
          end_time: string | null
          id: string
          name: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          display_order?: number
          end_time?: string | null
          id?: string
          name: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          display_order?: number
          end_time?: string | null
          id?: string
          name?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      source_location_mappings: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          display_name: string | null
          id: string
          notes: string | null
          plant_id: string | null
          source_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          notes?: string | null
          plant_id?: string | null
          source_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          notes?: string | null
          plant_id?: string | null
          source_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_location_mappings_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "source_location_mappings_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "ipd_target_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "source_location_mappings_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_location_mappings_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "supervisor_assignment_overview"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      supervisor_assignments: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          line_model_assignment_id: string
          shift_id: string
          supervisor_employee_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          line_model_assignment_id: string
          shift_id: string
          supervisor_employee_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          line_model_assignment_id?: string
          shift_id?: string
          supervisor_employee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_assignments_line_model_assignment_id_fkey"
            columns: ["line_model_assignment_id"]
            isOneToOne: false
            referencedRelation: "line_model_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_assignments_line_model_assignment_id_fkey"
            columns: ["line_model_assignment_id"]
            isOneToOne: false
            referencedRelation: "production_line_overview"
            referencedColumns: ["line_model_assignment_id"]
          },
          {
            foreignKeyName: "supervisor_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "supervisor_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_assignments_supervisor_employee_id_fkey"
            columns: ["supervisor_employee_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["supervisor_employee_id"]
          },
          {
            foreignKeyName: "supervisor_assignments_supervisor_employee_id_fkey"
            columns: ["supervisor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plant_access: {
        Row: {
          active: boolean
          created_at: string
          id: string
          plant_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          plant_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          plant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plant_access_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "user_plant_access_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "ipd_target_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "user_plant_access_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_plant_access_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "supervisor_assignment_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "user_plant_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          active: boolean
          created_at: string
          default_plant_id: string | null
          employee_id: string
          id: string
          preferred_theme: Database["public"]["Enums"]["theme_preference"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_plant_id?: string | null
          employee_id: string
          id: string
          preferred_theme?: Database["public"]["Enums"]["theme_preference"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_plant_id?: string | null
          employee_id?: string
          id?: string
          preferred_theme?: Database["public"]["Enums"]["theme_preference"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_default_plant_id_fkey"
            columns: ["default_plant_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "user_profiles_default_plant_id_fkey"
            columns: ["default_plant_id"]
            isOneToOne: false
            referencedRelation: "ipd_target_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "user_profiles_default_plant_id_fkey"
            columns: ["default_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_default_plant_id_fkey"
            columns: ["default_plant_id"]
            isOneToOne: false
            referencedRelation: "supervisor_assignment_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "user_profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["supervisor_employee_id"]
          },
          {
            foreignKeyName: "user_profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      daily_ipd_defect_overview: {
        Row: {
          comment: string | null
          created_at: string | null
          daily_ipd_record_id: string | null
          defect_category: string | null
          defect_type_code: string | null
          defect_type_id: string | null
          defect_type_name: string | null
          display_order: number | null
          id: string | null
          quantity: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_ipd_defects_daily_ipd_record_id_fkey"
            columns: ["daily_ipd_record_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_ipd_defects_daily_ipd_record_id_fkey"
            columns: ["daily_ipd_record_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_ipd_defects_defect_type_id_fkey"
            columns: ["defect_type_id"]
            isOneToOne: false
            referencedRelation: "defect_types"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_ipd_overview: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          comment: string | null
          created_at: string | null
          defect_type_count: number | null
          defective_harness_quantity: number | null
          display_order: number | null
          id: string | null
          ipd_percentage: number | null
          is_within_target: boolean | null
          line_model_assignment_id: string | null
          model_year: number | null
          modification_reason: string | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          produced_quantity: number | null
          product_model_id: string | null
          product_model_name: string | null
          production_date: string | null
          production_line_id: string | null
          production_line_name: string | null
          shift_code: string | null
          shift_id: string | null
          shift_name: string | null
          status: Database["public"]["Enums"]["ipd_record_status"] | null
          submitted_at: string | null
          submitted_by: string | null
          supervisor_employee_id: string | null
          supervisor_employee_number: string | null
          supervisor_name: string | null
          supervisor_photo_path: string | null
          target_difference: number | null
          target_id: string | null
          target_percentage: number | null
          total_defects: number | null
          updated_at: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_ipd_records_line_model_assignment_id_fkey"
            columns: ["line_model_assignment_id"]
            isOneToOne: false
            referencedRelation: "line_model_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_ipd_records_line_model_assignment_id_fkey"
            columns: ["line_model_assignment_id"]
            isOneToOne: false
            referencedRelation: "production_line_overview"
            referencedColumns: ["line_model_assignment_id"]
          },
          {
            foreignKeyName: "daily_ipd_records_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "ipd_target_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_ipd_records_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "ipd_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      ipd_target_overview: {
        Row: {
          active: boolean | null
          created_at: string | null
          display_order: number | null
          effective_from: string | null
          effective_to: string | null
          id: string | null
          is_current: boolean | null
          is_general_target: boolean | null
          line_model_assignment_id: string | null
          model_year: number | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          product_model_id: string | null
          product_model_name: string | null
          production_line_id: string | null
          production_line_name: string | null
          shift_code: string | null
          shift_id: string | null
          shift_name: string | null
          target_percentage: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ipd_targets_line_model_assignment_id_fkey"
            columns: ["line_model_assignment_id"]
            isOneToOne: false
            referencedRelation: "line_model_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipd_targets_line_model_assignment_id_fkey"
            columns: ["line_model_assignment_id"]
            isOneToOne: false
            referencedRelation: "production_line_overview"
            referencedColumns: ["line_model_assignment_id"]
          },
          {
            foreignKeyName: "ipd_targets_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "ipd_targets_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_model_assignments_product_model_id_fkey"
            columns: ["product_model_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["product_model_id"]
          },
          {
            foreignKeyName: "line_model_assignments_product_model_id_fkey"
            columns: ["product_model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
        ]
      }
      production_line_overview: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string | null
          line_model_assignment_id: string | null
          model_effective_from: string | null
          model_effective_to: string | null
          model_year: number | null
          name: string | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          product_model_id: string | null
          product_model_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "line_model_assignments_product_model_id_fkey"
            columns: ["product_model_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["product_model_id"]
          },
          {
            foreignKeyName: "line_model_assignments_product_model_id_fkey"
            columns: ["product_model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "production_lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "ipd_target_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "production_lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "supervisor_assignment_overview"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      source_location_mapping_overview: {
        Row: {
          active: boolean | null
          created_at: string | null
          display_name: string | null
          employee_count: number | null
          id: string | null
          notes: string | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          source_code: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_location_mappings_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "source_location_mappings_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "ipd_target_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "source_location_mappings_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_location_mappings_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "supervisor_assignment_overview"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      supervisor_assignment_overview: {
        Row: {
          active: boolean | null
          created_at: string | null
          display_order: number | null
          effective_from: string | null
          effective_to: string | null
          employee_number: string | null
          id: string | null
          is_current: boolean | null
          line_model_assignment_id: string | null
          model_year: number | null
          photo_path: string | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          product_model_id: string | null
          product_model_name: string | null
          production_line_id: string | null
          production_line_name: string | null
          shift_code: string | null
          shift_id: string | null
          shift_name: string | null
          supervisor_employee_id: string | null
          supervisor_name: string | null
          supervisor_plant_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_plant_id_fkey"
            columns: ["supervisor_plant_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "employees_plant_id_fkey"
            columns: ["supervisor_plant_id"]
            isOneToOne: false
            referencedRelation: "ipd_target_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "employees_plant_id_fkey"
            columns: ["supervisor_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_plant_id_fkey"
            columns: ["supervisor_plant_id"]
            isOneToOne: false
            referencedRelation: "supervisor_assignment_overview"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "line_model_assignments_product_model_id_fkey"
            columns: ["product_model_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["product_model_id"]
          },
          {
            foreignKeyName: "line_model_assignments_product_model_id_fkey"
            columns: ["product_model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_assignments_line_model_assignment_id_fkey"
            columns: ["line_model_assignment_id"]
            isOneToOne: false
            referencedRelation: "line_model_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_assignments_line_model_assignment_id_fkey"
            columns: ["line_model_assignment_id"]
            isOneToOne: false
            referencedRelation: "production_line_overview"
            referencedColumns: ["line_model_assignment_id"]
          },
          {
            foreignKeyName: "supervisor_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "supervisor_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_assignments_supervisor_employee_id_fkey"
            columns: ["supervisor_employee_id"]
            isOneToOne: false
            referencedRelation: "daily_ipd_overview"
            referencedColumns: ["supervisor_employee_id"]
          },
          {
            foreignKeyName: "supervisor_assignments_supervisor_employee_id_fkey"
            columns: ["supervisor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_supervisor_assignments: {
        Args: {
          effective_from_value: string
          effective_to_value?: string
          line_model_assignment_ids_value: string[]
          shift_id_value: string
          supervisor_employee_id_value: string
        }
        Returns: number
      }
      get_daily_operation_board: {
        Args: {
          plant_id_value: string
          production_date_value: string
          shift_id_value: string
        }
        Returns: {
          assigned_supervisors: Json
          comment: string
          current_user_is_assigned: boolean
          defective_harness_quantity: number
          display_order: number
          ipd_percentage: number
          is_within_target: boolean
          line_model_assignment_id: string
          model_year: number
          monthly_ipd_percentage: number
          monthly_produced_quantity: number
          monthly_record_count: number
          monthly_total_defects: number
          plant_code: string
          plant_id: string
          plant_name: string
          produced_quantity: number
          product_model_id: string
          product_model_name: string
          production_line_id: string
          production_line_name: string
          record_id: string
          record_target_percentage: number
          shift_code: string
          shift_id: string
          shift_name: string
          status: Database["public"]["Enums"]["ipd_record_status"]
          supervisor_employee_id: string
          supervisor_employee_number: string
          supervisor_name: string
          target_id: string
          target_percentage: number
          total_defects: number
          updated_at: string
          version: number
        }[]
      }
      import_employee_batch: {
        Args: { rows_value: Json }
        Returns: {
          inserted_count: number
          processed_count: number
          rejected_count: number
          unmapped_location_count: number
          updated_count: number
        }[]
      }
      normalize_text: { Args: { input_value: string }; Returns: string }
      refresh_daily_ipd_record_total: {
        Args: { target_record_id: string }
        Returns: undefined
      }
      review_daily_ipd_record: {
        Args: {
          expected_version_value: number
          modification_reason_value: string
          record_id_value: string
          requested_status_value: Database["public"]["Enums"]["ipd_record_status"]
        }
        Returns: undefined
      }
      save_daily_ipd_record: {
        Args: {
          comment_value: string
          defective_harness_quantity_value: number
          defects_value: Json
          expected_version_value: number
          line_model_assignment_id_value: string
          produced_quantity_value: number
          production_date_value: string
          record_id_value: string
          shift_id_value: string
          status_value: Database["public"]["Enums"]["ipd_record_status"]
          supervisor_employee_id_value: string
        }
        Returns: string
      }
      save_ipd_target: {
        Args: {
          active_value: boolean
          effective_from_value: string
          effective_to_value: string
          line_model_assignment_id_value: string
          shift_id_value: string
          target_id_value: string
          target_percentage_value: number
        }
        Returns: string
      }
      save_production_line: {
        Args: {
          description_value: string
          display_order_value: number
          effective_from_value: string
          line_id_value: string
          line_name_value: string
          plant_id_value: string
          product_model_id_value: string
        }
        Returns: string
      }
      search_employees: {
        Args: {
          active_value?: boolean
          page_number_value?: number
          page_size_value?: number
          plant_id_value?: string
          search_value?: string
          shift_id_value?: string
        }
        Returns: {
          active: boolean
          department_code: string
          department_name: string
          employee_number: string
          full_name: string
          id: string
          job_position: string
          photo_path: string
          plant_code: string
          plant_id: string
          plant_name: string
          production_line_id: string
          production_line_name: string
          service_date: string
          shift_code: string
          shift_id: string
          shift_name: string
          source_line_code: string
          source_location_code: string
          source_shift_code: string
          total_count: number
        }[]
      }
      update_my_preferences: {
        Args: {
          default_plant_value?: string
          preferred_theme_value: Database["public"]["Enums"]["theme_preference"]
        }
        Returns: undefined
      }
      update_supervisor_assignment: {
        Args: {
          active_value: boolean
          assignment_id_value: string
          effective_from_value: string
          effective_to_value: string
          shift_id_value: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "system_administrator"
        | "quality_manager"
        | "quality_supervisor"
        | "viewer"
      audit_action: "insert" | "update" | "delete"
      import_batch_status:
        | "pending"
        | "processing"
        | "completed"
        | "completed_with_errors"
        | "failed"
      ipd_record_status: "draft" | "submitted" | "closed" | "no_production"
      theme_preference: "system" | "light" | "dark"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "system_administrator",
        "quality_manager",
        "quality_supervisor",
        "viewer",
      ],
      audit_action: ["insert", "update", "delete"],
      import_batch_status: [
        "pending",
        "processing",
        "completed",
        "completed_with_errors",
        "failed",
      ],
      ipd_record_status: ["draft", "submitted", "closed", "no_production"],
      theme_preference: ["system", "light", "dark"],
    },
  },
} as const
