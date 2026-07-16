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
        title:
          'Operación en tiempo real · IPD Quality',
        data: {
          pageTitle:
            'Operación en tiempo real',
          icon: 'monitoring',
          description:
            'Aquí se mostrarán en tiempo real las capturas, líneas pendientes y alertas de IPD.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'daily-entries',
        title:
          'Registros diarios · IPD Quality',
        canActivate: [roleGuard],
        data: {
          roles: captureRoles,
          pageTitle: 'Registros diarios',
          icon: 'edit_note',
          description:
            'Captura diaria de producción, arneses defectuosos y defectos por tipo.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'line-performance',
        title:
          'Rendimiento por línea · IPD Quality',
        data: {
          pageTitle:
            'Rendimiento por línea',
          icon: 'query_stats',
          description:
            'Consulta mensual, tendencias, cumplimiento del target y comparativos.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'defect-analysis',
        title:
          'Análisis de defectos · IPD Quality',
        data: {
          pageTitle: 'Análisis de defectos',
          icon: 'bug_report',
          description:
            'Pareto, distribución y tendencias de los diferentes tipos de defecto.',
        },
        loadComponent: loadPlaceholder,
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
          pageTitle:
            'Asignaciones de supervisores',
          icon: 'assignment_ind',
          description:
            'Asignación de una o varias líneas y turnos a los supervisores de calidad.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'ipd-targets',
        title: 'Objetivos IPD · IPD Quality',
        canActivate: [roleGuard],
        data: {
          roles: managementRoles,
          pageTitle: 'Objetivos IPD',
          icon: 'track_changes',
          description:
            'Configuración de targets por línea, modelo, turno y periodo de vigencia.',
        },
        loadComponent: loadPlaceholder,
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
