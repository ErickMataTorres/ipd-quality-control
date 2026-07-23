import {
  DatePipe,
  DecimalPipe,
} from '@angular/common';

import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';

import {
  Subject,
  debounceTime,
} from 'rxjs';

import {
  MatButtonModule,
} from '@angular/material/button';

import {
  MatChipsModule,
} from '@angular/material/chips';

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
  MatProgressBarModule,
} from '@angular/material/progress-bar';

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
  UserProfileService,
} from '../../../../core/user-profile/user-profile.service';

import {
  PlantsService,
} from '../../../plants/data-access/plants.service';

import {
  ShiftsService,
} from '../../../shifts/data-access/shifts.service';

import {
  LiveAssignedSupervisor,
  LiveOperationItem,
  LiveOperationsService,
} from '../../data-access/live-operations.service';

type LiveStatusFilter =
  | 'all'
  | 'pending'
  | 'draft'
  | 'reported'
  | 'outside_target'
  | 'no_production';

type AudioContextConstructor =
  typeof AudioContext;

interface AudioWindow extends Window {
  webkitAudioContext?:
    AudioContextConstructor;
}

function getLocalDate(): string {
  const currentDate =
    new Date();

  const year =
    currentDate.getFullYear();

  const month = String(
    currentDate.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    currentDate.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

@Component({
  selector:
    'app-live-operations-board',

  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],

  templateUrl:
    './live-operations-board.component.html',

  styleUrl:
    './live-operations-board.component.scss',
})
export class LiveOperationsBoardComponent
  implements OnInit, OnDestroy {
  private readonly snackBar =
    inject(MatSnackBar);

  private readonly userProfileService =
    inject(UserProfileService);

  readonly liveOperationsService =
    inject(LiveOperationsService);

  readonly plantsService =
    inject(PlantsService);

  readonly shiftsService =
    inject(ShiftsService);

  readonly selectedPlantId =
    signal('');

  readonly selectedShiftId =
    signal('all');

  readonly selectedDate =
    signal(getLocalDate());

  readonly selectedStatus =
    signal<LiveStatusFilter>('all');

  readonly searchTerm =
    signal('');

  readonly soundEnabled =
    signal(this.readSoundPreference());

  private readonly realtimeReload =
    new Subject<void>();

  private fallbackTimer:
    ReturnType<typeof setInterval>
    | null = null;

  private knownAlertKeys =
    new Set<string>();

  private alertsInitialized = false;

  readonly isLoading = computed(
    () =>
      this.liveOperationsService
        .isLoading()
      || this.plantsService.isLoading()
      || this.shiftsService.isLoading(),
  );

  readonly filteredBoard = computed(() => {
    const search =
      this.searchTerm()
        .trim()
        .toLocaleLowerCase('es');

    const status =
      this.selectedStatus();

    return this.liveOperationsService
      .board()
      .filter(item => {
        if (
          status === 'pending'
          && item.recordId !== null
        ) {
          return false;
        }

        if (
          status === 'draft'
          && item.status !== 'draft'
        ) {
          return false;
        }

        if (
          status === 'reported'
          && !this.isReported(item)
        ) {
          return false;
        }

        if (
          status === 'outside_target'
          && !(
            this.isReported(item)
            && item.isWithinTarget === false
          )
        ) {
          return false;
        }

        if (
          status === 'no_production'
          && item.status !== 'no_production'
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        return [
          item.plantCode,
          item.productionLineName,
          item.productModelName,
          item.modelYear?.toString() ?? '',
          item.shiftCode,
          item.shiftName,
          item.supervisorName ?? '',
          item.topDefectTypeName ?? '',
          ...item.assignedSupervisors.map(
            supervisor =>
              supervisor.fullName,
          ),
        ]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(search);
      });
  });

  readonly totalLines = computed(
    () =>
      this.liveOperationsService
        .board()
        .length,
  );

  readonly reportedLines = computed(
    () =>
      this.liveOperationsService
        .board()
        .filter(item =>
          this.isReported(item),
        )
        .length,
  );

  readonly pendingLines = computed(
    () =>
      this.liveOperationsService
        .board()
        .filter(
          item =>
            item.recordId === null
            || item.status === 'draft',
        )
        .length,
  );

  readonly outsideTargetLines = computed(
    () =>
      this.liveOperationsService
        .board()
        .filter(
          item =>
            this.isReported(item)
            && item.isWithinTarget === false,
        )
        .length,
  );

  readonly totalProduced = computed(
    () =>
      this.reportedItems()
        .reduce(
          (
            total,
            item,
          ) =>
            total
            + (
              item.producedQuantity
              ?? 0
            ),
          0,
        ),
  );

  readonly totalDefects = computed(
    () =>
      this.reportedItems()
        .reduce(
          (
            total,
            item,
          ) =>
            total
            + (
              item.totalDefects
              ?? 0
            ),
          0,
        ),
  );

  readonly aggregateIpd = computed(() => {
    const produced =
      this.totalProduced();

    if (produced <= 0) {
      return null;
    }

    return Number(
      (
        (
          this.totalDefects()
          / produced
        ) * 100
      ).toFixed(4),
    );
  });

  readonly completionPercentage = computed(
    () => {
      const total =
        this.totalLines();

      if (total === 0) {
        return 0;
      }

      return Math.round(
        (
          this.reportedLines()
          / total
        ) * 100,
      );
    },
  );

  readonly realtimeLabel = computed(() => {
    switch (
      this.liveOperationsService
        .realtimeStatus()
    ) {
      case 'connected':
        return 'Conectado en tiempo real';

      case 'connecting':
        return 'Conectando...';

      case 'error':
        return 'Conexión degradada';

      default:
        return 'Actualización periódica';
    }
  });

  constructor() {
    this.realtimeReload
      .pipe(
        debounceTime(550),
      )
      .subscribe(() => {
        void this.loadBoard(true);
      });
  }

  ngOnInit(): void {
    void this.initialize();

    this.liveOperationsService
      .subscribeToRecordChanges(
        () =>
          this.realtimeReload.next(),
      );

    this.fallbackTimer =
      setInterval(
        () => {
          void this.loadBoard(true);
        },
        45000,
      );
  }

  ngOnDestroy(): void {
    this.liveOperationsService
      .unsubscribeFromRecordChanges();

    this.realtimeReload.complete();

    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  updateSearch(
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    this.searchTerm.set(input.value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  handleFilterChange(): void {
    this.alertsInitialized = false;
    this.knownAlertKeys.clear();

    void this.loadBoard();
  }

  async reload(): Promise<void> {
    await this.loadBoard(true);
  }

  toggleSound(): void {
    const nextValue =
      !this.soundEnabled();

    this.soundEnabled.set(nextValue);

    try {
      localStorage.setItem(
        'ipd-live-sound-enabled',
        String(nextValue),
      );
    } catch {
      // Storage can be unavailable in private contexts.
    }

    this.captureCurrentAlertKeys();

    if (nextValue) {
      this.playNotificationSound(
        false,
      );

      this.snackBar.open(
        'Alertas sonoras activadas.',
        'Cerrar',
        {
          duration: 3000,
        },
      );
    } else {
      this.snackBar.open(
        'Alertas sonoras desactivadas.',
        'Cerrar',
        {
          duration: 3000,
        },
      );
    }
  }

  primaryAssignedSupervisor(
    item: LiveOperationItem,
  ): LiveAssignedSupervisor | null {
    return item.assignedSupervisors[0]
      ?? null;
  }

  initials(
    fullName: string,
  ): string {
    return fullName
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        part =>
          part.charAt(0).toUpperCase(),
      )
      .join('');
  }

  isReported(
    item: LiveOperationItem,
  ): boolean {
    return item.status === 'submitted'
      || item.status === 'closed'
      || item.status === 'no_production';
  }

  statusLabel(
    item: LiveOperationItem,
  ): string {
    if (!item.recordId) {
      return 'Pendiente';
    }

    switch (item.status) {
      case 'draft':
        return 'Borrador';

      case 'submitted':
        return 'Enviado';

      case 'closed':
        return 'Cerrado';

      case 'no_production':
        return 'Sin producción';

      default:
        return 'Pendiente';
    }
  }

  statusIcon(
    item: LiveOperationItem,
  ): string {
    if (!item.recordId) {
      return 'schedule';
    }

    switch (item.status) {
      case 'draft':
        return 'edit_note';

      case 'submitted':
        return 'send';

      case 'closed':
        return 'lock';

      case 'no_production':
        return 'block';

      default:
        return 'schedule';
    }
  }

  targetStateLabel(
    item: LiveOperationItem,
  ): string {
    if (!this.isReported(item)) {
      return 'Pendiente de captura';
    }

    if (
      item.status === 'no_production'
    ) {
      return 'Sin producción';
    }

    if (
      item.targetPercentage === null
      || item.ipdPercentage === null
    ) {
      return 'Sin comparación';
    }

    return item.isWithinTarget
      ? 'Dentro del objetivo'
      : 'Fuera del objetivo';
  }

  private reportedItems():
    LiveOperationItem[] {
    return this.liveOperationsService
      .board()
      .filter(item =>
        this.isReported(item),
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
          .filter(plant => plant.active);

      const defaultPlantId =
        profile?.defaultPlantId;

      const selectedPlant =
        activePlants.find(
          plant =>
            plant.id === defaultPlantId,
        )
        ?? activePlants[0];

      this.selectedPlantId.set(
        selectedPlant?.id ?? '',
      );

      await this.loadBoard();
    } catch (error: unknown) {
      console.error(
        'Unable to initialize live operations.',
        error,
      );

      this.snackBar.open(
        'No fue posible cargar los catálogos de operación.',
        'Cerrar',
        {
          duration: 5000,
        },
      );
    }
  }

  private async loadBoard(
    silent = false,
  ): Promise<void> {
    await this.liveOperationsService
      .loadBoard(
        this.selectedPlantId(),
        this.selectedDate(),

        this.selectedShiftId() === 'all'
          ? null
          : this.selectedShiftId(),

        silent,
      );

    this.processNewAlerts();
  }

  private processNewAlerts(): void {
    const alertKeys =
      this.getCurrentAlertKeys();

    if (!this.alertsInitialized) {
      this.knownAlertKeys = alertKeys;
      this.alertsInitialized = true;
      return;
    }

    const newAlerts =
      [...alertKeys].filter(
        alertKey =>
          !this.knownAlertKeys.has(
            alertKey,
          ),
      );

    this.knownAlertKeys = alertKeys;

    if (
      this.soundEnabled()
      && newAlerts.length > 0
    ) {
      this.playNotificationSound(
        true,
      );

      this.snackBar.open(
        newAlerts.length === 1
          ? 'Nueva alerta: una línea quedó fuera del objetivo IPD.'
          : `Nuevas alertas: ${newAlerts.length} líneas quedaron fuera del objetivo IPD.`,
        'Cerrar',
        {
          duration: 6000,
        },
      );
    }
  }

  private captureCurrentAlertKeys():
    void {
    this.knownAlertKeys =
      this.getCurrentAlertKeys();

    this.alertsInitialized = true;
  }

  private getCurrentAlertKeys():
    Set<string> {
    return new Set(
      this.liveOperationsService
        .board()
        .filter(
          item =>
            this.isReported(item)
            && item.isWithinTarget === false,
        )
        .map(
          item =>
            `${item.lineModelAssignmentId}:${item.shiftId}:${item.recordId ?? ''}`,
        ),
    );
  }

  private readSoundPreference():
    boolean {
    try {
      return localStorage.getItem(
        'ipd-live-sound-enabled',
      ) === 'true';
    } catch {
      return false;
    }
  }

  private playNotificationSound(
    isAlert: boolean,
  ): void {
    try {
      const audioWindow =
        window as AudioWindow;

      const AudioContextClass =
        window.AudioContext
        ?? audioWindow.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      const audioContext =
        new AudioContextClass();

      const oscillator =
        audioContext.createOscillator();

      const gain =
        audioContext.createGain();

      oscillator.type =
        isAlert
          ? 'square'
          : 'sine';

      oscillator.frequency.setValueAtTime(
        isAlert ? 880 : 560,
        audioContext.currentTime,
      );

      if (isAlert) {
        oscillator.frequency
          .setValueAtTime(
            660,
            audioContext.currentTime
              + 0.14,
          );
      }

      gain.gain.setValueAtTime(
        0.0001,
        audioContext.currentTime,
      );

      gain.gain.exponentialRampToValueAtTime(
        isAlert ? 0.12 : 0.06,
        audioContext.currentTime
          + 0.02,
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime
          + (
            isAlert
              ? 0.34
              : 0.18
          ),
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();

      oscillator.stop(
        audioContext.currentTime
          + (
            isAlert
              ? 0.36
              : 0.2
          ),
      );

      oscillator.addEventListener(
        'ended',
        () => {
          void audioContext.close();
        },
        {
          once: true,
        },
      );
    } catch (error: unknown) {
      console.warn(
        'Unable to play live operation sound.',
        error,
      );
    }
  }
}
