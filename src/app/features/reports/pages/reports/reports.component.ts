import {
  DecimalPipe,
} from '@angular/common';

import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import {
  MatButtonModule,
} from '@angular/material/button';

import {
  MatFormFieldModule,
} from '@angular/material/form-field';

import {
  MatIconModule,
} from '@angular/material/icon';

import {
  MatInputModule,
} from '@angular/material/input';

import {
  MatProgressSpinnerModule,
} from '@angular/material/progress-spinner';

import {
  MatSelectModule,
} from '@angular/material/select';

import {
  MatSnackBar,
  MatSnackBarModule,
} from '@angular/material/snack-bar';

import {
  MatTooltipModule,
} from '@angular/material/tooltip';

import {
  Database,
} from '../../../../core/types/database.types';

import {
  UserProfileService,
} from '../../../../core/user-profile/user-profile.service';

import {
  PlantsService,
} from '../../../plants/data-access/plants.service';

import {
  ShiftsService,
} from '../../../shifts/data-access/shifts.service';

import {
  ReportsDailyItem,
  ReportsLineItem,
  ReportsQuery,
  ReportsRecordItem,
  ReportsService,
} from '../../data-access/reports.service';

type IpdRecordStatus =
  Database['public']['Enums']['ipd_record_status'];

type DatePreset =
  | 'current_month'
  | 'last_7'
  | 'last_30'
  | 'last_90'
  | 'custom';

type PreviewMode =
  | 'records'
  | 'daily'
  | 'lines';

const STATUS_LABELS:
  Record<IpdRecordStatus, string> = {
    draft:
      'Borrador',

    submitted:
      'Enviado',

    closed:
      'Cerrado',

    no_production:
      'Sin producción',
  };

function formatLocalDate(
  date: Date,
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, '0');

  const day =
    String(
      date.getDate(),
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function todayValue(): string {
  return formatLocalDate(new Date());
}

function currentMonthStart(): string {
  const date =
    new Date();

  return formatLocalDate(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      1,
      12,
    ),
  );
}

function subtractDays(
  days: number,
): string {
  const date =
    new Date();

  date.setDate(
    date.getDate() - days,
  );

  return formatLocalDate(date);
}

function parseLocalDate(
  value: string,
): Date {
  const [
    year,
    month,
    day,
  ] = value
    .split('-')
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
    12,
  );
}

@Component({
  selector:
    'app-reports',

  imports: [
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],

  templateUrl:
    './reports.component.html',

  styleUrl:
    './reports.component.scss',
})
export class ReportsComponent
  implements OnInit {
  private readonly snackBar =
    inject(MatSnackBar);

  private readonly userProfileService =
    inject(UserProfileService);

  readonly plantsService =
    inject(PlantsService);

  readonly shiftsService =
    inject(ShiftsService);

  readonly reportsService =
    inject(ReportsService);

  readonly selectedPlantId =
    signal('');

  readonly selectedShiftId =
    signal('all');

  readonly selectedLineId =
    signal('all');

  readonly selectedStatus =
    signal<'all' | IpdRecordStatus>(
      'all',
    );

  readonly selectedPreset =
    signal<DatePreset>('current_month');

  readonly dateFrom =
    signal(currentMonthStart());

  readonly dateTo =
    signal(todayValue());

  readonly previewMode =
    signal<PreviewMode>('records');

  readonly recordSearch =
    signal('');

  readonly statusOptions:
    Array<{
      value: IpdRecordStatus;
      label: string;
    }> = [
      {
        value: 'draft',
        label: STATUS_LABELS.draft,
      },
      {
        value: 'submitted',
        label: STATUS_LABELS.submitted,
      },
      {
        value: 'closed',
        label: STATUS_LABELS.closed,
      },
      {
        value: 'no_production',
        label: STATUS_LABELS.no_production,
      },
    ];

  readonly isLoading = computed(
    () =>
      this.reportsService.isLoading()
      || this.reportsService
        .isLoadingOptions()
      || this.plantsService.isLoading()
      || this.shiftsService.isLoading(),
  );

  readonly filteredPreviewRecords =
    computed(() => {
      const search =
        this.recordSearch()
          .trim()
          .toLocaleLowerCase('es');

      if (!search) {
        return this.reportsService
          .previewRecords();
      }

      return this.reportsService
        .previewRecords()
        .filter(record =>
          [
            record.productionDate,
            record.plantCode,
            record.productionLineName,
            record.productModelName,
            record.shiftCode,
            record.supervisorName,
            record.supervisorEmployeeNumber,
            this.statusLabel(record.status),
            record.recordComment ?? '',
          ]
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(search),
        );
    });

  readonly dailyMaximum = computed(
    () =>
      Math.max(
        1,
        ...this.reportsService
          .daily()
          .map(
            day =>
              day.ipdPercentage ?? 0,
          ),
      ),
  );

  readonly lineMaximum = computed(
    () =>
      Math.max(
        1,
        ...this.reportsService
          .byLine()
          .map(
            line =>
              line.totalDefects,
          ),
      ),
  );

  readonly periodLabel = computed(
    () => {
      const formatter =
        new Intl.DateTimeFormat(
          'es-MX',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          },
        );

      return `${
        formatter.format(
          parseLocalDate(
            this.dateFrom(),
          ),
        )
      } – ${
        formatter.format(
          parseLocalDate(
            this.dateTo(),
          ),
        )
      }`;
    },
  );

  readonly selectedPlantLabel = computed(
    () => {
      const plant =
        this.plantsService
          .plants()
          .find(
            item =>
              item.id
              === this.selectedPlantId(),
          );

      return plant
        ? `${plant.code} · ${plant.name}`
        : 'Sin planta';
    },
  );

  readonly selectedLineLabel = computed(
    () => {
      if (
        this.selectedLineId()
        === 'all'
      ) {
        return 'Todas las líneas';
      }

      const line =
        this.reportsService
          .lineOptions()
          .find(
            item =>
              item.id
              === this.selectedLineId(),
          );

      if (!line) {
        return 'Línea no disponible';
      }

      return [
        line.productionLineName,
        line.productModelName,
        line.modelYear ?? '',
      ]
        .filter(Boolean)
        .join(' · ');
    },
  );

  ngOnInit(): void {
    void this.initialize();
  }

  async handlePlantChange(
    plantId: string,
  ): Promise<void> {
    this.selectedPlantId.set(plantId);
    this.selectedLineId.set('all');

    await this.reportsService
      .loadLineOptions(plantId);

    await this.loadReport();
  }

  handleFilterChange(): void {
    void this.loadReport();
  }

  applyPreset(
    preset: DatePreset,
  ): void {
    this.selectedPreset.set(preset);

    switch (preset) {
      case 'current_month':
        this.dateFrom.set(
          currentMonthStart(),
        );
        this.dateTo.set(todayValue());
        break;

      case 'last_7':
        this.dateFrom.set(
          subtractDays(6),
        );
        this.dateTo.set(todayValue());
        break;

      case 'last_30':
        this.dateFrom.set(
          subtractDays(29),
        );
        this.dateTo.set(todayValue());
        break;

      case 'last_90':
        this.dateFrom.set(
          subtractDays(89),
        );
        this.dateTo.set(todayValue());
        break;

      case 'custom':
        return;
    }

    void this.loadReport();
  }

  handleDateChange(
    target:
      | 'from'
      | 'to',
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    if (target === 'from') {
      this.dateFrom.set(input.value);
    } else {
      this.dateTo.set(input.value);
    }

    this.selectedPreset.set('custom');

    void this.loadReport();
  }

  updateRecordSearch(
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    this.recordSearch.set(input.value);
  }

  clearRecordSearch(): void {
    this.recordSearch.set('');
  }

  async reload(): Promise<void> {
    await this.loadReport(true);
  }

  async exportRecordsCsv(): Promise<void> {
    try {
      const records =
        await this.reportsService
          .loadAllRecordsForExport(
            this.currentQuery(),
          );

      if (records.length === 0) {
        this.showNoExportData();
        return;
      }

      const rows = records.map(record => [
        record.productionDate,
        record.plantCode,
        record.plantName,
        record.productionLineName,
        record.productModelName,
        record.modelYear,
        record.shiftCode,
        record.shiftName,
        record.supervisorEmployeeNumber,
        record.supervisorName,
        record.producedQuantity,
        record.defectiveHarnessQuantity,
        record.totalDefects,
        record.ipdPercentage,
        record.targetPercentage,
        record.targetDifference,
        this.targetResultLabel(
          record.isWithinTarget,
        ),
        this.statusLabel(record.status),
        record.recordComment,
        record.createdAt,
        record.updatedAt,
      ]);

      this.downloadCsv(
        this.reportFileName(
          'registros-ipd',
        ),
        [
          'Fecha',
          'Código de planta',
          'Planta',
          'Línea',
          'Modelo',
          'Año modelo',
          'Código de turno',
          'Turno',
          'No. reloj supervisor',
          'Supervisor',
          'Producción',
          'Arneses defectuosos',
          'Total de defectos',
          'IPD (%)',
          'Target (%)',
          'Diferencia contra target',
          'Resultado',
          'Estado',
          'Comentario',
          'Creado',
          'Actualizado',
        ],
        rows,
      );

      this.showExportSuccess(
        records.length,
        'registros',
      );
    } catch (error: unknown) {
      console.error(
        'Unable to export report records.',
        error,
      );

      this.showExportError();
    }
  }

  async exportDefectsCsv(): Promise<void> {
    try {
      const defects =
        await this.reportsService
          .loadAllDefectsForExport(
            this.currentQuery(),
          );

      if (defects.length === 0) {
        this.showNoExportData();
        return;
      }

      const rows = defects.map(item => [
        item.productionDate,
        item.plantCode,
        item.plantName,
        item.productionLineName,
        item.productModelName,
        item.modelYear,
        item.shiftCode,
        item.shiftName,
        item.supervisorEmployeeNumber,
        item.supervisorName,
        item.defectTypeCode,
        item.defectTypeName,
        item.defectCategory,
        item.quantity,
        item.defectComment,
        item.producedQuantity,
        item.defectiveHarnessQuantity,
        item.recordTotalDefects,
        item.ipdPercentage,
        item.targetPercentage,
        this.statusLabel(
          item.recordStatus,
        ),
        item.recordComment,
        item.createdAt,
        item.updatedAt,
      ]);

      this.downloadCsv(
        this.reportFileName(
          'detalle-defectos',
        ),
        [
          'Fecha',
          'Código de planta',
          'Planta',
          'Línea',
          'Modelo',
          'Año modelo',
          'Código de turno',
          'Turno',
          'No. reloj supervisor',
          'Supervisor',
          'Código de defecto',
          'Defecto',
          'Categoría',
          'Cantidad',
          'Comentario del defecto',
          'Producción del registro',
          'Arneses defectuosos',
          'Defectos del registro',
          'IPD (%)',
          'Target (%)',
          'Estado del registro',
          'Comentario del registro',
          'Creado',
          'Actualizado',
        ],
        rows,
      );

      this.showExportSuccess(
        defects.length,
        'detalles de defecto',
      );
    } catch (error: unknown) {
      console.error(
        'Unable to export report defects.',
        error,
      );

      this.showExportError();
    }
  }

  printReport(): void {
const summary =
  this.reportsService.summary();

if (
  !summary
  || summary.totalRecords === 0
) {
  this.showNoExportData();
  return;
}

const reportWindow =
  window.open(
    '',
    '_blank',
  );

if (!reportWindow) {
  this.snackBar.open(
    'El navegador bloqueó la ventana de impresión.',
    'Cerrar',
    {
      duration: 5000,
    },
  );

  return;
}

reportWindow.opener = null;

    const lineRows =
      this.reportsService
        .byLine()
        .map(
          line => `
            <tr>
              <td>${this.escapeHtml(
                line.productionLineName,
              )}</td>
              <td>${this.escapeHtml(
                [
                  line.productModelName,
                  line.modelYear ?? '',
                ]
                  .filter(Boolean)
                  .join(' · '),
              )}</td>
              <td>${line.totalRecords}</td>
              <td>${this.numberText(
                line.producedQuantity,
              )}</td>
              <td>${this.numberText(
                line.defectiveHarnessQuantity,
              )}</td>
              <td>${this.numberText(
                line.totalDefects,
              )}</td>
              <td>${this.percentText(
                line.ipdPercentage,
              )}</td>
              <td>${this.percentText(
                line.weightedTargetPercentage,
              )}</td>
              <td>${this.percentText(
                line.compliancePercentage,
              )}</td>
            </tr>
          `,
        )
        .join('');

    reportWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>Reporte IPD</title>
          <style>
            @page {
              size: landscape;
              margin: 12mm;
            }

            body {
              margin: 0;
              color: #1d1b25;
              font-family: Arial, sans-serif;
              font-size: 10px;
            }

            header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              padding-bottom: 12px;
              border-bottom: 2px solid #4f398f;
            }

            h1 {
              margin: 0 0 5px;
              color: #2f1e65;
              font-size: 22px;
            }

            p {
              margin: 3px 0;
            }

            .meta {
              text-align: right;
            }

            .kpis {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 8px;
              margin: 14px 0;
            }

            .kpi {
              padding: 9px;
              border: 1px solid #ddd8e8;
              border-radius: 7px;
            }

            .kpi span {
              display: block;
              color: #6f6a78;
              font-size: 8px;
              text-transform: uppercase;
            }

            .kpi strong {
              display: block;
              margin-top: 3px;
              font-size: 15px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
            }

            th,
            td {
              padding: 6px;
              border: 1px solid #dedbe5;
              text-align: left;
              vertical-align: top;
            }

            th {
              color: #ffffff;
              background: #4f398f;
              font-size: 8px;
              text-transform: uppercase;
            }

            tbody tr:nth-child(even) {
              background: #f7f5fb;
            }

            footer {
              margin-top: 10px;
              color: #77717f;
              text-align: right;
            }
          </style>
        </head>

        <body>
          <header>
            <div>
              <h1>Reporte de producción e IPD</h1>
              <p>
                <strong>Planta:</strong>
                ${this.escapeHtml(
                  this.selectedPlantLabel(),
                )}
              </p>
              <p>
                <strong>Periodo:</strong>
                ${this.escapeHtml(
                  this.periodLabel(),
                )}
              </p>
              <p>
                <strong>Línea:</strong>
                ${this.escapeHtml(
                  this.selectedLineLabel(),
                )}
              </p>
            </div>

            <div class="meta">
              <p>
                <strong>Turno:</strong>
                ${this.escapeHtml(
                  this.selectedShiftLabel(),
                )}
              </p>
              <p>
                <strong>Estado:</strong>
                ${this.escapeHtml(
                  this.selectedStatusLabel(),
                )}
              </p>
              <p>
                <strong>Generado:</strong>
                ${this.escapeHtml(
                  new Date().toLocaleString(
                    'es-MX',
                  ),
                )}
              </p>
            </div>
          </header>

          <section class="kpis">
            ${this.printKpi(
              'Registros',
              this.numberText(
                summary.totalRecords,
              ),
            )}
            ${this.printKpi(
              'Producción',
              this.numberText(
                summary.producedQuantity,
              ),
            )}
            ${this.printKpi(
              'Arneses defectuosos',
              this.numberText(
                summary
                  .defectiveHarnessQuantity,
              ),
            )}
            ${this.printKpi(
              'Defectos',
              this.numberText(
                summary.totalDefects,
              ),
            )}
            ${this.printKpi(
              'IPD',
              this.percentText(
                summary.ipdPercentage,
              ),
            )}
            ${this.printKpi(
              'Fuera del target',
              this.numberText(
                summary.outsideTargetRecords,
              ),
            )}
          </section>

          <h2>Consolidado por línea y modelo</h2>

          <table>
            <thead>
              <tr>
                <th>Línea</th>
                <th>Modelo</th>
                <th>Registros</th>
                <th>Producción</th>
                <th>Defectuosos</th>
                <th>Defectos</th>
                <th>IPD</th>
                <th>Target</th>
                <th>Cumplimiento</th>
              </tr>
            </thead>

            <tbody>
              ${lineRows || `
                <tr>
                  <td colspan="9">
                    Sin información por línea.
                  </td>
                </tr>
              `}
            </tbody>
          </table>

          <footer>
            IPD Quality Control · Reporte generado
            desde el sistema.
          </footer>
        </body>
      </html>
    `);

reportWindow.document.close();

reportWindow.focus();

window.setTimeout(
  () => {
    if (!reportWindow.closed) {
      reportWindow.print();
    }
  },
  300,
);
  }

  dailyBarHeight(
    day: ReportsDailyItem,
  ): number {
    if (
      day.ipdPercentage === null
      || day.ipdPercentage <= 0
    ) {
      return 3;
    }

    return Math.max(
      6,
      (
        day.ipdPercentage
        / this.dailyMaximum()
      ) * 100,
    );
  }

  lineBarWidth(
    line: ReportsLineItem,
  ): number {
    return Math.max(
      4,
      (
        line.totalDefects
        / this.lineMaximum()
      ) * 100,
    );
  }

  statusLabel(
    status: IpdRecordStatus,
  ): string {
    return STATUS_LABELS[status];
  }

  statusClass(
    status: IpdRecordStatus,
  ): string {
    return status.replace(
      '_',
      '-',
    );
  }

  targetResultLabel(
    value: boolean | null,
  ): string {
    if (value === true) {
      return 'Dentro del objetivo';
    }

    if (value === false) {
      return 'Fuera del objetivo';
    }

    return 'Sin comparación';
  }

  formatDate(
    value: string | null,
  ): string {
    if (!value) {
      return '—';
    }

    return new Intl.DateTimeFormat(
      'es-MX',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      },
    ).format(
      parseLocalDate(value),
    );
  }

  private async initialize():
    Promise<void> {
    try {
      await Promise.all([
        this.plantsService.loadPlants(),
        this.shiftsService.loadShifts(),
      ]);

      const profile =
        this.userProfileService.profile()
        ?? await this.userProfileService
          .loadCurrentProfile();

      const activePlants =
        this.plantsService
          .plants()
          .filter(
            plant => plant.active,
          );

      const selectedPlant =
        activePlants.find(
          plant =>
            plant.id
            === profile?.defaultPlantId,
        )
        ?? activePlants[0];

      this.selectedPlantId.set(
        selectedPlant?.id ?? '',
      );

      await this.reportsService
        .loadLineOptions(
          this.selectedPlantId(),
        );

      await this.loadReport();
    } catch (error: unknown) {
      console.error(
        'Unable to initialize reports.',
        error,
      );

      this.snackBar.open(
        'No fue posible preparar el módulo de reportes.',
        'Cerrar',
        {
          duration: 5000,
        },
      );
    }
  }

  private async loadReport(
    silent = false,
  ): Promise<void> {
    if (
      this.dateFrom()
      > this.dateTo()
    ) {
      this.snackBar.open(
        'La fecha inicial no puede ser posterior a la fecha final.',
        'Cerrar',
        {
          duration: 4500,
        },
      );

      return;
    }

    await this.reportsService
      .loadReport(
        this.currentQuery(),
        silent,
      );
  }

  private currentQuery():
    ReportsQuery {
    const selectedStatus =
      this.selectedStatus();

    return {
      plantId:
        this.selectedPlantId(),

      dateFrom:
        this.dateFrom(),

      dateTo:
        this.dateTo(),

      shiftId:
        this.selectedShiftId()
          === 'all'
          ? null
          : this.selectedShiftId(),

      lineModelAssignmentId:
        this.selectedLineId()
          === 'all'
          ? null
          : this.selectedLineId(),

      status:
        selectedStatus === 'all'
          ? null
          : selectedStatus,
    };
  }

  private selectedShiftLabel():
    string {
    if (
      this.selectedShiftId()
      === 'all'
    ) {
      return 'Todos los turnos';
    }

    const shift =
      this.shiftsService
        .shifts()
        .find(
          item =>
            item.id
            === this.selectedShiftId(),
        );

    return shift
      ? `${shift.code} · ${shift.name}`
      : 'Turno no disponible';
  }

  private selectedStatusLabel():
    string {
    const status =
      this.selectedStatus();

    return status === 'all'
      ? 'Todos los estados'
      : this.statusLabel(status);
  }

  private reportFileName(
    prefix: string,
  ): string {
    const plant =
      this.selectedPlantLabel()
        .split('·')[0]
        .trim()
        .replace(
          /[^a-zA-Z0-9_-]/g,
          '',
        );

    return [
      prefix,
      plant || 'planta',
      this.dateFrom(),
      this.dateTo(),
    ].join('_');
  }

  private downloadCsv(
    fileName: string,
    headers: string[],
    rows: unknown[][],
  ): void {
    const separator = ',';

    const content = [
      headers,
      ...rows,
    ]
      .map(
        row =>
          row
            .map(
              value =>
                this.escapeCsv(value),
            )
            .join(separator),
      )
      .join('\r\n');

    const blob =
      new Blob(
        [
          '\uFEFF',
          content,
        ],
        {
          type:
            'text/csv;charset=utf-8;',
        },
      );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement('a');

    anchor.href = url;
    anchor.download = `${fileName}.csv`;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  private escapeCsv(
    value: unknown,
  ): string {
    if (
      value === null
      || value === undefined
    ) {
      return '';
    }

    const text =
      String(value);

    if (
      text.includes(',')
      || text.includes('"')
      || text.includes('\n')
      || text.includes('\r')
    ) {
      return `"${text.replace(
        /"/g,
        '""',
      )}"`;
    }

    return text;
  }

  private escapeHtml(
    value: unknown,
  ): string {
    return String(
      value ?? '',
    )
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private printKpi(
    label: string,
    value: string,
  ): string {
    return `
      <div class="kpi">
        <span>${this.escapeHtml(label)}</span>
        <strong>${this.escapeHtml(value)}</strong>
      </div>
    `;
  }

  private numberText(
    value: number,
  ): string {
    return new Intl.NumberFormat(
      'es-MX',
    ).format(value);
  }

  private percentText(
    value: number | null,
  ): string {
    if (value === null) {
      return '—';
    }

    return `${
      new Intl.NumberFormat(
        'es-MX',
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        },
      ).format(value)
    } %`;
  }

  private showNoExportData(): void {
    this.snackBar.open(
      'No existen datos para exportar con los filtros seleccionados.',
      'Cerrar',
      {
        duration: 4500,
      },
    );
  }

  private showExportSuccess(
    count: number,
    itemLabel: string,
  ): void {
    this.snackBar.open(
      `Se exportaron ${count} ${itemLabel}.`,
      'Cerrar',
      {
        duration: 4000,
      },
    );
  }

  private showExportError(): void {
    this.snackBar.open(
      'No fue posible generar la exportación.',
      'Cerrar',
      {
        duration: 5000,
      },
    );
  }
}
