import {
  inject,
  Injectable,
} from '@angular/core';

import {
  Database,
  Json,
} from '../../../core/types/database.types';

import {
  SupabaseService,
} from '../../../core/services/supabase';

type ImportEmployeeBatchArguments =
  Database['public']['Functions']['import_employee_batch']['Args'];

type ImportEmployeeBatchResult =
  Database['public']['Functions']['import_employee_batch']['Returns'][number];

export interface EmployeeImportRow {
  employeeNumber: string;
  fullName: string;
  sourceLocationCode: string | null;
  sourceShiftCode: string | null;
  serviceDate: string | null;
  departmentName: string | null;
  sourceLineCode: string | null;
  jobPosition: string | null;
  category: string | null;
  positionName: string | null;
  functionName: string | null;
  processName: string | null;
  departmentCode: string | null;
}

export interface EmployeeImportError {
  rowNumber: number;
  employeeNumber: string;
  message: string;
}

export interface EmployeeImportPreview {
  fileName: string;
  sheetName: string;

  totalRows: number;
  validRows: EmployeeImportRow[];
  previewRows: EmployeeImportRow[];
  errors: EmployeeImportError[];

  hc0707Count: number;
  otherLocationCount: number;
  withoutLocationCount: number;
  uniqueLocationCodes: string[];
}

export interface EmployeeImportProgress {
  processedRows: number;
  totalRows: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
}

export interface EmployeeImportSummary {
  processedCount: number;
  insertedCount: number;
  updatedCount: number;
  rejectedCount: number;
  unmappedLocationCount: number;
  batchCount: number;
}

const EXPECTED_HEADERS = {
  employeeNumber: 'EMPLEADO',
  fullName: 'NOMBRE',
  sourceLocationCode: 'LOCALIDAD',
  sourceShiftCode: 'TURNO',
  serviceDate: 'F SERVICIO',
  departmentName: 'DEPARTAMENTO',
  sourceLineCode: 'LINEA',
  jobPosition: 'PUESTO',
  category: 'CATEGORIA',
  positionName: 'POSITION',
  functionName: 'FUNCTION',
  processName: 'PROCESO',
  departmentCode: 'DPTO',
} as const;

type ExpectedHeaderKey =
  keyof typeof EXPECTED_HEADERS;

const IMPORT_BATCH_SIZE = 500;

@Injectable({
  providedIn: 'root',
})
export class EmployeeImportService {
  private readonly supabase =
    inject(SupabaseService);

  async parseHdcFile(
    file: File,
  ): Promise<EmployeeImportPreview> {
    const xlsx = await import('xlsx');

    const fileBuffer =
      await file.arrayBuffer();

    const workbook = xlsx.read(
      fileBuffer,
      {
        type: 'array',
        cellDates: true,
      },
    );

    const sheetName =
      workbook.SheetNames.find(
        name =>
          this.normalizeText(name) === 'HDC',
      );

    if (!sheetName) {
      throw new Error(
        'El archivo no contiene una hoja llamada HDC.',
      );
    }

    const worksheet =
      workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error(
        'No fue posible leer la hoja HDC.',
      );
    }

    const matrix =
      xlsx.utils.sheet_to_json<unknown[]>(
        worksheet,
        {
          header: 1,
          defval: '',
          blankrows: false,
          raw: false,
          dateNF: 'yyyy-mm-dd',
        },
      );

    if (matrix.length < 2) {
      throw new Error(
        'La hoja HDC no contiene empleados.',
      );
    }

    const headerRow =
      matrix[0] ?? [];

    const headerIndexes =
      this.createHeaderIndexes(headerRow);

    this.validateRequiredHeaders(
      headerIndexes,
    );

    const validRows: EmployeeImportRow[] = [];
    const errors: EmployeeImportError[] = [];

    const employeeNumbers =
      new Map<string, number>();

    for (
      let matrixIndex = 1;
      matrixIndex < matrix.length;
      matrixIndex++
    ) {
      const row =
        matrix[matrixIndex] ?? [];

      const excelRowNumber =
        matrixIndex + 1;

      const employeeNumber =
        this.normalizeEmployeeNumber(
          this.readCell(
            row,
            headerIndexes,
            'employeeNumber',
          ),
        );

      const fullName =
        this.cleanRequiredText(
          this.readCell(
            row,
            headerIndexes,
            'fullName',
          ),
        );

      if (
        !employeeNumber
        && !fullName
      ) {
        continue;
      }

      const rowErrors: string[] = [];

      if (!employeeNumber) {
        rowErrors.push(
          'El número de reloj está vacío.',
        );
      } else if (
        !/^\d{1,20}$/.test(employeeNumber)
      ) {
        rowErrors.push(
          'El número de reloj debe contener únicamente números.',
        );
      }

      if (!fullName) {
        rowErrors.push(
          'El nombre del empleado está vacío.',
        );
      }

      const firstOccurrence =
        employeeNumbers.get(employeeNumber);

      if (
        employeeNumber
        && firstOccurrence !== undefined
      ) {
        rowErrors.push(
          `El número de reloj está repetido; apareció primero en la fila ${firstOccurrence}.`,
        );
      }

      const serviceDateText =
        this.cleanOptionalText(
          this.readCell(
            row,
            headerIndexes,
            'serviceDate',
          ),
        );

      const serviceDate =
        this.normalizeDate(
          serviceDateText,
        );

      if (
        serviceDateText
        && !serviceDate
      ) {
        rowErrors.push(
          'La fecha de servicio no tiene un formato válido.',
        );
      }

      if (rowErrors.length > 0) {
        errors.push({
          rowNumber: excelRowNumber,
          employeeNumber:
            employeeNumber || 'Sin número',
          message: rowErrors.join(' '),
        });

        continue;
      }

      employeeNumbers.set(
        employeeNumber,
        excelRowNumber,
      );

      validRows.push({
        employeeNumber,
        fullName,

        sourceLocationCode:
          this.cleanSourceCode(
            this.readCell(
              row,
              headerIndexes,
              'sourceLocationCode',
            ),
          ),

        sourceShiftCode:
          this.cleanSourceCode(
            this.readCell(
              row,
              headerIndexes,
              'sourceShiftCode',
            ),
          ),

        serviceDate,

        departmentName:
          this.cleanOptionalText(
            this.readCell(
              row,
              headerIndexes,
              'departmentName',
            ),
          ),

        sourceLineCode:
          this.cleanSourceCode(
            this.readCell(
              row,
              headerIndexes,
              'sourceLineCode',
            ),
          ),

        jobPosition:
          this.cleanOptionalText(
            this.readCell(
              row,
              headerIndexes,
              'jobPosition',
            ),
          ),

        category:
          this.cleanOptionalText(
            this.readCell(
              row,
              headerIndexes,
              'category',
            ),
          ),

        positionName:
          this.cleanOptionalText(
            this.readCell(
              row,
              headerIndexes,
              'positionName',
            ),
          ),

        functionName:
          this.cleanOptionalText(
            this.readCell(
              row,
              headerIndexes,
              'functionName',
            ),
          ),

        processName:
          this.cleanOptionalText(
            this.readCell(
              row,
              headerIndexes,
              'processName',
            ),
          ),

        departmentCode:
          this.cleanOptionalText(
            this.readCell(
              row,
              headerIndexes,
              'departmentCode',
            ),
          ),
      });
    }

    const uniqueLocationCodes = [
      ...new Set(
        validRows
          .map(
            row =>
              row.sourceLocationCode,
          )
          .filter(
            (
              code,
            ): code is string =>
              code !== null,
          ),
      ),
    ].sort((first, second) =>
      first.localeCompare(second),
    );

    const hc0707Count =
      validRows.filter(
        row =>
          row.sourceLocationCode
          === 'HC0707',
      ).length;

    const withoutLocationCount =
      validRows.filter(
        row =>
          row.sourceLocationCode === null,
      ).length;

    return {
      fileName: file.name,
      sheetName,
      totalRows:
        validRows.length + errors.length,

      validRows,

      previewRows:
        validRows.slice(0, 15),

      errors,

      hc0707Count,

      otherLocationCount:
        validRows.length
        - hc0707Count
        - withoutLocationCount,

      withoutLocationCount,
      uniqueLocationCodes,
    };
  }

  async importEmployees(
    rows: EmployeeImportRow[],
    onProgress?: (
      progress: EmployeeImportProgress,
    ) => void,
  ): Promise<EmployeeImportSummary> {
    if (rows.length === 0) {
      throw new Error(
        'No existen empleados válidos para importar.',
      );
    }

    const totalBatches =
      Math.ceil(
        rows.length / IMPORT_BATCH_SIZE,
      );

    const summary: EmployeeImportSummary = {
      processedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      rejectedCount: 0,
      unmappedLocationCount: 0,
      batchCount: totalBatches,
    };

    for (
      let batchIndex = 0;
      batchIndex < totalBatches;
      batchIndex++
    ) {
      const startIndex =
        batchIndex * IMPORT_BATCH_SIZE;

      const batch = rows.slice(
        startIndex,
        startIndex + IMPORT_BATCH_SIZE,
      );

      const payload:
        ImportEmployeeBatchArguments = {
          rows_value:
            batch as unknown as Json,
        };

      const { data, error } =
        await this.supabase.client.rpc(
          'import_employee_batch',
          payload,
        );

      if (error) {
        throw new Error(
          `Falló el lote ${
            batchIndex + 1
          } de ${totalBatches}: ${
            error.message
          }`,
        );
      }

      const batchResult:
        ImportEmployeeBatchResult
        | undefined = data?.[0];

      if (!batchResult) {
        throw new Error(
          `El lote ${
            batchIndex + 1
          } no devolvió un resultado.`,
        );
      }

      summary.processedCount +=
        Number(
          batchResult.processed_count ?? 0,
        );

      summary.insertedCount +=
        Number(
          batchResult.inserted_count ?? 0,
        );

      summary.updatedCount +=
        Number(
          batchResult.updated_count ?? 0,
        );

      summary.rejectedCount +=
        Number(
          batchResult.rejected_count ?? 0,
        );

      summary.unmappedLocationCount +=
        Number(
          batchResult
            .unmapped_location_count ?? 0,
        );

      const processedRows = Math.min(
        startIndex + batch.length,
        rows.length,
      );

      onProgress?.({
        processedRows,
        totalRows: rows.length,

        percentage: Math.round(
          (
            processedRows
            / rows.length
          ) * 100,
        ),

        currentBatch:
          batchIndex + 1,

        totalBatches,
      });
    }

    return summary;
  }

  private createHeaderIndexes(
    headers: unknown[],
  ): Map<string, number> {
    const indexes =
      new Map<string, number>();

    headers.forEach(
      (header, index) => {
        const normalizedHeader =
          this.normalizeText(
            String(header ?? ''),
          );

        if (normalizedHeader) {
          indexes.set(
            normalizedHeader,
            index,
          );
        }
      },
    );

    return indexes;
  }

  private validateRequiredHeaders(
    indexes: Map<string, number>,
  ): void {
    const missingHeaders =
      Object.values(
        EXPECTED_HEADERS,
      ).filter(
        header =>
          !indexes.has(header),
      );

    if (missingHeaders.length > 0) {
      throw new Error(
        `Faltan las siguientes columnas en HDC: ${missingHeaders.join(', ')}.`,
      );
    }
  }

  private readCell(
    row: unknown[],
    indexes: Map<string, number>,
    key: ExpectedHeaderKey,
  ): unknown {
    const columnIndex =
      indexes.get(
        EXPECTED_HEADERS[key],
      );

    return columnIndex === undefined
      ? ''
      : row[columnIndex];
  }

  private normalizeEmployeeNumber(
    value: unknown,
  ): string {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/\.0+$/, '');
  }

  private cleanRequiredText(
    value: unknown,
  ): string {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private cleanOptionalText(
    value: unknown,
  ): string | null {
    const cleaned =
      this.cleanRequiredText(value);

    return cleaned || null;
  }

  private cleanSourceCode(
    value: unknown,
  ): string | null {
    const cleaned =
      this.cleanRequiredText(value)
        .toUpperCase();

    return cleaned || null;
  }

  private normalizeDate(
    value: string | null,
  ): string | null {
    if (!value) {
      return null;
    }

    const isoMatch =
      value.match(
        /^(\d{4})-(\d{2})-(\d{2})$/,
      );

    if (isoMatch) {
      return this.isValidDate(
        Number(isoMatch[1]),
        Number(isoMatch[2]),
        Number(isoMatch[3]),
      )
        ? value
        : null;
    }

    const dayFirstMatch =
      value.match(
        /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/,
      );

    if (!dayFirstMatch) {
      return null;
    }

    const day =
      Number(dayFirstMatch[1]);

    const month =
      Number(dayFirstMatch[2]);

    const year =
      Number(dayFirstMatch[3]);

    if (
      !this.isValidDate(
        year,
        month,
        day,
      )
    ) {
      return null;
    }

    return [
      year.toString().padStart(4, '0'),
      month.toString().padStart(2, '0'),
      day.toString().padStart(2, '0'),
    ].join('-');
  }

  private isValidDate(
    year: number,
    month: number,
    day: number,
  ): boolean {
    const date =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day,
        ),
      );

    return (
      date.getUTCFullYear() === year
      && date.getUTCMonth()
        === month - 1
      && date.getUTCDate() === day
    );
  }

  private normalizeText(
    value: string,
  ): string {
    return value
      .trim()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }
}
