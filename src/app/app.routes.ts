import { Routes } from '@angular/router';

import {
  authGuard,
  guestGuard,
} from './core/auth/auth.guard';

import {
  roleGuard,
} from './core/auth/role.guard';

import {
  AppRole,
} from './core/user-profile/user-profile.service';

const managementRoles: readonly AppRole[] = [
  'system_administrator',
  'quality_manager',
];

const captureRoles: readonly AppRole[] = [
  'system_administrator',
  'quality_manager',
  'quality_supervisor',
];

const administratorRoles:
  readonly AppRole[] = [
    'system_administrator',
  ];

const loadPlaceholder = () =>
  import(
    './shared/pages/feature-placeholder/feature-placeholder.component'
  ).then(
    component =>
      component.FeaturePlaceholderComponent,
  );

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión · IPD Quality',
    canActivate: [guestGuard],
    loadComponent: () =>
      import(
        './features/auth/pages/login/login.component'
      ).then(
        component => component.LoginComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './core/layout/app-shell/app-shell.component'
      ).then(
        component => component.AppShellComponent,
      ),
    children: [
      {
  path: 'source-location-mappings',
  title: 'Equivalencias HDC · IPD Quality',
  canActivate: [roleGuard],

  data: {
    roles: administratorRoles,
    pageTitle: 'Equivalencias HDC',
  },

  loadComponent: () =>
    import(
      './features/source-location-mappings/pages/source-location-mappings-list/source-location-mappings-list.component'
    ).then(
      component =>
        component
          .SourceLocationMappingsListComponent,
    ),
},
      {
        path: 'dashboard',
        title: 'Panel principal · IPD Quality',
        data: {
          pageTitle: 'Panel principal',
        },
        loadComponent: () =>
          import(
            './features/dashboard/pages/dashboard/dashboard.component'
          ).then(
            component =>
              component.DashboardComponent,
          ),
      },

      {
  path: 'live-operations',
  title: 'Operación en tiempo real · IPD Quality',

  data: {
    pageTitle: 'Operación en tiempo real',
  },

  loadComponent: () =>
    import(
      './features/live-operations/pages/live-operations-board/live-operations-board.component'
    ).then(
      component =>
        component.LiveOperationsBoardComponent,
    ),
},

{
  path: 'daily-entries',
  title: 'Registros diarios · IPD Quality',
  canActivate: [roleGuard],

  data: {
    roles: captureRoles,
    pageTitle: 'Registros diarios',
  },

  loadComponent: () =>
    import(
      './features/daily-entries/pages/daily-entries-list/daily-entries-list.component'
    ).then(
      component =>
        component.DailyEntriesListComponent,
    ),
},
{
  path: 'line-performance',
  title: 'Rendimiento por línea · IPD Quality',

  data: {
    pageTitle: 'Rendimiento por línea',
  },

  loadComponent: () =>
    import(
      './features/line-performance/pages/line-performance/line-performance.component'
    ).then(
      component =>
        component.LinePerformanceComponent,
    ),
},
{
  path: 'defect-analysis',
  title: 'Análisis de defectos · IPD Quality',

  data: {
    pageTitle: 'Análisis de defectos',
    icon: 'bug_report',
    description:
      'Pareto, distribución y tendencias de los diferentes tipos de defecto.',
  },

  loadComponent: () =>
    import(
      './features/defect-analysis/pages/defect-analysis/defect-analysis.component'
    ).then(
      component =>
        component.DefectAnalysisComponent,
    ),
},
      {
        path: 'reports',
        title: 'Reportes · IPD Quality',
        data: {
          pageTitle: 'Reportes',
          icon: 'summarize',
          description:
            'Generación y exportación de reportes de producción, defectos e IPD.',
        },
        loadComponent: loadPlaceholder,
      },
{
  path: 'employees',
  title: 'Empleados · IPD Quality',
  canActivate: [roleGuard],
  data: {
    roles: managementRoles,
    pageTitle: 'Empleados',
  },
  loadComponent: () =>
    import(
      './features/employees/pages/employees-list/employees-list.component'
    ).then(
      component =>
        component.EmployeesListComponent,
    ),
},
{
  path: 'supervisor-assignments',
  title: 'Asignaciones · IPD Quality',
  canActivate: [roleGuard],

  data: {
    roles: managementRoles,
    pageTitle: 'Asignaciones',
  },

  loadComponent: () =>
    import(
      './features/supervisor-assignments/pages/supervisor-assignments-list/supervisor-assignments-list.component'
    ).then(
      component =>
        component
          .SupervisorAssignmentsListComponent,
    ),
},
{
  path: 'ipd-targets',
  title: 'Objetivos IPD · IPD Quality',
  canActivate: [roleGuard],

  data: {
    roles: managementRoles,
    pageTitle: 'Objetivos IPD',
  },

  loadComponent: () =>
    import(
      './features/ipd-targets/pages/ipd-targets-list/ipd-targets-list.component'
    ).then(
      component =>
        component.IpdTargetsListComponent,
    ),
},
{
  path: 'plants',
  title: 'Plantas · IPD Quality',
  canActivate: [roleGuard],
  data: {
    roles: administratorRoles,
    pageTitle: 'Plantas',
  },
  loadComponent: () =>
    import(
      './features/plants/pages/plants-list/plants-list.component'
    ).then(
      component =>
        component.PlantsListComponent,
    ),
},
{
  path: 'production-lines',
  title: 'Líneas · IPD Quality',
  canActivate: [roleGuard],
  data: {
    roles: managementRoles,
    pageTitle: 'Líneas de producción',
  },
  loadComponent: () =>
    import(
      './features/production-lines/pages/production-lines-list/production-lines-list.component'
    ).then(
      component =>
        component.ProductionLinesListComponent,
    ),
},
{
  path: 'product-models',
  title: 'Modelos · IPD Quality',
  canActivate: [roleGuard],
  data: {
    roles: managementRoles,
    pageTitle: 'Modelos',
  },
  loadComponent: () =>
    import(
      './features/product-models/pages/product-models-list/product-models-list.component'
    ).then(
      component =>
        component.ProductModelsListComponent,
    ),
},
{
  path: 'shifts',
  title: 'Turnos · IPD Quality',
  canActivate: [roleGuard],
  data: {
    roles: administratorRoles,
    pageTitle: 'Turnos',
  },
  loadComponent: () =>
    import(
      './features/shifts/pages/shifts-list/shifts-list.component'
    ).then(
      component =>
        component.ShiftsListComponent,
    ),
},
      {
        path: 'defect-types',
        title:
          'Tipos de defecto · IPD Quality',
        canActivate: [roleGuard],
        data: {
          roles: managementRoles,
          pageTitle: 'Tipos de defecto',
          icon: 'rule',
          description:
            'Administración del catálogo de defectos utilizado en las capturas.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'user-management',
        title: 'Usuarios · IPD Quality',
        canActivate: [roleGuard],
        data: {
          roles: administratorRoles,
          pageTitle: 'Usuarios',
          icon: 'manage_accounts',
          description:
            'Creación de usuarios, asignación de roles y control de accesos.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'audit-log',
        title:
          'Historial de cambios · IPD Quality',
        canActivate: [roleGuard],
        data: {
          roles: administratorRoles,
          pageTitle: 'Historial de cambios',
          icon: 'history',
          description:
            'Consulta de altas, modificaciones y movimientos realizados en el sistema.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];
