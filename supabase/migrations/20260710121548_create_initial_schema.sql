begin;

-- =========================================================
-- EXTENSIONS
-- =========================================================

create extension if not exists btree_gist
with schema extensions;

-- =========================================================
-- ENUMS
-- =========================================================

create type public.app_role as enum (
  'system_administrator',
  'quality_manager',
  'quality_supervisor',
  'viewer'
);

create type public.theme_preference as enum (
  'system',
  'light',
  'dark'
);

create type public.ipd_record_status as enum (
  'draft',
  'submitted',
  'closed',
  'no_production'
);

create type public.import_batch_status as enum (
  'pending',
  'processing',
  'completed',
  'completed_with_errors',
  'failed'
);

create type public.audit_action as enum (
  'insert',
  'update',
  'delete'
);

-- =========================================================
-- UTILITY FUNCTIONS
-- =========================================================

create or replace function public.normalize_text(input_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.lower(
    pg_catalog.regexp_replace(
      pg_catalog.btrim(input_value),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

-- =========================================================
-- PLANTS
-- =========================================================

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  timezone text not null default 'America/Mazatlan',
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plants_code_not_blank
    check (length(btrim(code)) > 0),

  constraint plants_name_not_blank
    check (length(btrim(name)) > 0)
);

create unique index plants_code_uq
  on public.plants (public.normalize_text(code));

create unique index plants_name_uq
  on public.plants (public.normalize_text(name));

-- =========================================================
-- SHIFTS
-- =========================================================

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  start_time time,
  end_time time,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shifts_code_not_blank
    check (length(btrim(code)) > 0),

  constraint shifts_name_not_blank
    check (length(btrim(name)) > 0),

  constraint shifts_display_order_valid
    check (display_order >= 0)
);

create unique index shifts_code_uq
  on public.shifts (public.normalize_text(code));

create unique index shifts_name_uq
  on public.shifts (public.normalize_text(name));

-- =========================================================
-- CUSTOMERS
-- =========================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customers_name_not_blank
    check (length(btrim(name)) > 0),

  constraint customers_code_not_blank
    check (code is null or length(btrim(code)) > 0)
);

create unique index customers_name_uq
  on public.customers (public.normalize_text(name));

create unique index customers_code_uq
  on public.customers (public.normalize_text(code))
  where code is not null;

-- =========================================================
-- PRODUCT MODELS
-- =========================================================

create table public.product_models (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  name text not null,
  model_year smallint,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_models_name_not_blank
    check (length(btrim(name)) > 0),

  constraint product_models_year_valid
    check (
      model_year is null
      or model_year between 1980 and 2200
    )
);

create unique index product_models_identity_uq
  on public.product_models (
    coalesce(
      customer_id,
      '00000000-0000-0000-0000-000000000000'::uuid
    ),
    public.normalize_text(name)
  );

create index product_models_customer_idx
  on public.product_models(customer_id);

-- =========================================================
-- PRODUCTION LINES
-- =========================================================

create table public.production_lines (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id),
  name text not null,
  description text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint production_lines_name_not_blank
    check (length(btrim(name)) > 0),

  constraint production_lines_display_order_valid
    check (display_order >= 0)
);

create unique index production_lines_plant_name_uq
  on public.production_lines (
    plant_id,
    public.normalize_text(name)
  );

create index production_lines_plant_idx
  on public.production_lines(plant_id);

-- =========================================================
-- LINE AND MODEL ASSIGNMENTS
-- =========================================================

create table public.line_model_assignments (
  id uuid primary key default gen_random_uuid(),
  production_line_id uuid not null
    references public.production_lines(id),
  product_model_id uuid not null
    references public.product_models(id),
  effective_from date not null,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint line_model_assignments_dates_valid
    check (
      effective_to is null
      or effective_to >= effective_from
    )
);

alter table public.line_model_assignments
  add constraint line_model_assignments_no_overlap
  exclude using gist (
    production_line_id with =,
    product_model_id with =,
    daterange(
      effective_from,
      coalesce(effective_to, 'infinity'::date),
      '[]'
    ) with &&
  );

create index line_model_assignments_line_idx
  on public.line_model_assignments(production_line_id);

create index line_model_assignments_model_idx
  on public.line_model_assignments(product_model_id);

create index line_model_assignments_dates_idx
  on public.line_model_assignments(
    effective_from,
    effective_to
  );

-- =========================================================
-- EMPLOYEES
-- =========================================================

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null,
  full_name text not null,

  plant_id uuid references public.plants(id),
  shift_id uuid references public.shifts(id),
  production_line_id uuid references public.production_lines(id),

  service_date date,
  department_name text,
  department_code text,
  job_position text,
  category text,
  position_name text,
  function_name text,
  process_name text,

  source_location_code text,
  source_shift_code text,
  source_line_code text,

  photo_path text,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint employees_number_not_blank
    check (length(btrim(employee_number)) > 0),

  constraint employees_name_not_blank
    check (length(btrim(full_name)) > 0)
);

create unique index employees_number_uq
  on public.employees (
    public.normalize_text(employee_number)
  );

create index employees_full_name_idx
  on public.employees (
    public.normalize_text(full_name)
  );

create index employees_plant_idx
  on public.employees(plant_id);

create index employees_shift_idx
  on public.employees(shift_id);

create index employees_line_idx
  on public.employees(production_line_id);

create index employees_active_idx
  on public.employees(active);

-- =========================================================
-- USER PROFILES
-- =========================================================

create table public.user_profiles (
  id uuid primary key
    references auth.users(id)
    on delete cascade,

  employee_id uuid not null unique
    references public.employees(id),

  role public.app_role not null default 'viewer',
  default_plant_id uuid references public.plants(id),
  preferred_theme public.theme_preference
    not null default 'system',

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_profiles_employee_idx
  on public.user_profiles(employee_id);

create index user_profiles_role_idx
  on public.user_profiles(role);

create index user_profiles_default_plant_idx
  on public.user_profiles(default_plant_id);

-- =========================================================
-- USER PLANT ACCESS
-- =========================================================

create table public.user_plant_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.user_profiles(id)
    on delete cascade,

  plant_id uuid not null
    references public.plants(id)
    on delete cascade,

  active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint user_plant_access_identity_uq
    unique (user_id, plant_id)
);

create index user_plant_access_user_idx
  on public.user_plant_access(user_id);

create index user_plant_access_plant_idx
  on public.user_plant_access(plant_id);

-- =========================================================
-- SUPERVISOR ASSIGNMENTS
-- =========================================================

create table public.supervisor_assignments (
  id uuid primary key default gen_random_uuid(),

  supervisor_employee_id uuid not null
    references public.employees(id),

  line_model_assignment_id uuid not null
    references public.line_model_assignments(id),

  shift_id uuid not null
    references public.shifts(id),

  effective_from date not null,
  effective_to date,
  active boolean not null default true,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint supervisor_assignments_dates_valid
    check (
      effective_to is null
      or effective_to >= effective_from
    )
);

alter table public.supervisor_assignments
  add constraint supervisor_assignments_no_overlap
  exclude using gist (
    supervisor_employee_id with =,
    line_model_assignment_id with =,
    shift_id with =,
    daterange(
      effective_from,
      coalesce(effective_to, 'infinity'::date),
      '[]'
    ) with &&
  );

create index supervisor_assignments_supervisor_idx
  on public.supervisor_assignments(
    supervisor_employee_id
  );

create index supervisor_assignments_line_model_idx
  on public.supervisor_assignments(
    line_model_assignment_id
  );

create index supervisor_assignments_shift_idx
  on public.supervisor_assignments(shift_id);

create index supervisor_assignments_dates_idx
  on public.supervisor_assignments(
    effective_from,
    effective_to
  );

-- =========================================================
-- IPD TARGETS
-- =========================================================

create table public.ipd_targets (
  id uuid primary key default gen_random_uuid(),

  line_model_assignment_id uuid not null
    references public.line_model_assignments(id),

  shift_id uuid references public.shifts(id),

  target_percentage numeric(9,4) not null,
  effective_from date not null,
  effective_to date,
  active boolean not null default true,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ipd_targets_percentage_valid
    check (
      target_percentage >= 0
      and target_percentage <= 1000
    ),

  constraint ipd_targets_dates_valid
    check (
      effective_to is null
      or effective_to >= effective_from
    )
);

alter table public.ipd_targets
  add constraint ipd_targets_specific_shift_no_overlap
  exclude using gist (
    line_model_assignment_id with =,
    shift_id with =,
    daterange(
      effective_from,
      coalesce(effective_to, 'infinity'::date),
      '[]'
    ) with &&
  )
  where (shift_id is not null);

alter table public.ipd_targets
  add constraint ipd_targets_general_no_overlap
  exclude using gist (
    line_model_assignment_id with =,
    daterange(
      effective_from,
      coalesce(effective_to, 'infinity'::date),
      '[]'
    ) with &&
  )
  where (shift_id is null);

create index ipd_targets_line_model_idx
  on public.ipd_targets(
    line_model_assignment_id
  );

create index ipd_targets_shift_idx
  on public.ipd_targets(shift_id);

create index ipd_targets_dates_idx
  on public.ipd_targets(
    effective_from,
    effective_to
  );

-- =========================================================
-- DEFECT TYPES
-- =========================================================

create table public.defect_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name_es text not null,
  name_en text not null,
  category text,
  description text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint defect_types_code_not_blank
    check (length(btrim(code)) > 0),

  constraint defect_types_name_es_not_blank
    check (length(btrim(name_es)) > 0),

  constraint defect_types_name_en_not_blank
    check (length(btrim(name_en)) > 0),

  constraint defect_types_display_order_valid
    check (display_order >= 0)
);

create unique index defect_types_code_uq
  on public.defect_types (
    public.normalize_text(code)
  );

create unique index defect_types_name_es_uq
  on public.defect_types (
    public.normalize_text(name_es)
  );

create index defect_types_active_order_idx
  on public.defect_types(
    active,
    display_order
  );

-- =========================================================
-- DAILY IPD RECORDS
-- =========================================================

create table public.daily_ipd_records (
  id uuid primary key default gen_random_uuid(),

  production_date date not null,

  line_model_assignment_id uuid not null
    references public.line_model_assignments(id),

  shift_id uuid not null
    references public.shifts(id),

  supervisor_employee_id uuid not null
    references public.employees(id),

  produced_quantity integer not null default 0,
  defective_harness_quantity integer,

  total_defects integer not null default 0,

  ipd_percentage numeric(12,4)
    generated always as (
      case
        when produced_quantity > 0 then
          round(
            (
              total_defects::numeric
              / produced_quantity::numeric
            ) * 100,
            4
          )
        else null
      end
    ) stored,

  target_id uuid
    references public.ipd_targets(id)
    on delete set null,

  target_percentage numeric(9,4),

  comment text,
  status public.ipd_record_status
    not null default 'draft',

  submitted_at timestamptz,
  submitted_by uuid references auth.users(id),

  closed_at timestamptz,
  closed_by uuid references auth.users(id),

  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),

  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_ipd_produced_quantity_valid
    check (produced_quantity >= 0),

  constraint daily_ipd_defective_quantity_valid
    check (
      defective_harness_quantity is null
      or defective_harness_quantity >= 0
    ),

  constraint daily_ipd_defective_not_greater_than_production
    check (
      defective_harness_quantity is null
      or defective_harness_quantity <= produced_quantity
    ),

  constraint daily_ipd_total_defects_valid
    check (total_defects >= 0),

  constraint daily_ipd_target_snapshot_valid
    check (
      target_percentage is null
      or (
        target_percentage >= 0
        and target_percentage <= 1000
      )
    ),

  constraint daily_ipd_comment_length_valid
    check (
      comment is null
      or length(comment) <= 2000
    ),

  constraint daily_ipd_version_valid
    check (version >= 1),

  constraint daily_ipd_status_quantities_valid
    check (
      status = 'draft'
      or (
        status = 'no_production'
        and produced_quantity = 0
        and coalesce(defective_harness_quantity, 0) = 0
        and total_defects = 0
      )
      or (
        status in ('submitted', 'closed')
        and produced_quantity > 0
      )
    ),

  constraint daily_ipd_record_identity_uq
    unique (
      production_date,
      line_model_assignment_id,
      shift_id
    )
);

create index daily_ipd_records_date_idx
  on public.daily_ipd_records(production_date);

create index daily_ipd_records_line_date_idx
  on public.daily_ipd_records(
    line_model_assignment_id,
    production_date desc
  );

create index daily_ipd_records_shift_date_idx
  on public.daily_ipd_records(
    shift_id,
    production_date desc
  );

create index daily_ipd_records_supervisor_date_idx
  on public.daily_ipd_records(
    supervisor_employee_id,
    production_date desc
  );

create index daily_ipd_records_status_date_idx
  on public.daily_ipd_records(
    status,
    production_date desc
  );

-- =========================================================
-- DAILY DEFECT DETAILS
-- =========================================================

create table public.daily_ipd_defects (
  id uuid primary key default gen_random_uuid(),

  daily_ipd_record_id uuid not null
    references public.daily_ipd_records(id)
    on delete cascade,

  defect_type_id uuid not null
    references public.defect_types(id),

  quantity integer not null,
  comment text,

  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_ipd_defects_quantity_valid
    check (quantity > 0),

  constraint daily_ipd_defects_comment_length_valid
    check (
      comment is null
      or length(comment) <= 1000
    ),

  constraint daily_ipd_defects_identity_uq
    unique (
      daily_ipd_record_id,
      defect_type_id
    )
);

create index daily_ipd_defects_record_idx
  on public.daily_ipd_defects(
    daily_ipd_record_id
  );

create index daily_ipd_defects_type_idx
  on public.daily_ipd_defects(
    defect_type_id
  );

-- =========================================================
-- EMPLOYEE IMPORT BATCHES
-- =========================================================

create table public.employee_import_batches (
  id uuid primary key default gen_random_uuid(),

  source_file_name text not null,
  source_file_sha256 text,

  status public.import_batch_status
    not null default 'pending',

  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  inserted_rows integer not null default 0,
  updated_rows integer not null default 0,

  error_summary jsonb,
  imported_by uuid references auth.users(id),

  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint employee_import_batches_file_not_blank
    check (length(btrim(source_file_name)) > 0),

  constraint employee_import_batches_counts_valid
    check (
      total_rows >= 0
      and valid_rows >= 0
      and invalid_rows >= 0
      and inserted_rows >= 0
      and updated_rows >= 0
    )
);

create index employee_import_batches_created_idx
  on public.employee_import_batches(
    created_at desc
  );

-- =========================================================
-- EMPLOYEE IMPORT STAGING
-- =========================================================

create table public.employee_import_staging (
  id uuid primary key default gen_random_uuid(),

  import_batch_id uuid not null
    references public.employee_import_batches(id)
    on delete cascade,

  row_number integer not null,

  employee_number text,
  full_name text,
  location_code text,
  shift_code text,
  service_date_text text,
  department_name text,
  line_code text,
  job_position text,
  category text,
  position_name text,
  function_name text,
  process_name text,
  department_code text,

  validation_errors jsonb,
  processed boolean not null default false,
  created_at timestamptz not null default now(),

  constraint employee_import_staging_row_valid
    check (row_number > 0),

  constraint employee_import_staging_row_uq
    unique (import_batch_id, row_number)
);

create index employee_import_staging_batch_idx
  on public.employee_import_staging(
    import_batch_id
  );

create index employee_import_staging_processed_idx
  on public.employee_import_staging(
    import_batch_id,
    processed
  );

-- =========================================================
-- AUDIT LOG
-- =========================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  table_name text not null,
  record_id uuid,
  action public.audit_action not null,

  old_values jsonb,
  new_values jsonb,

  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index audit_logs_table_record_idx
  on public.audit_logs(
    table_name,
    record_id
  );

create index audit_logs_changed_at_idx
  on public.audit_logs(
    changed_at desc
  );

create index audit_logs_changed_by_idx
  on public.audit_logs(
    changed_by
  );

-- =========================================================
-- DAILY RECORD TRIGGER
-- =========================================================

create or replace function public.prepare_daily_ipd_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_employee_id uuid;
begin
  if tg_op = 'INSERT' then
    new.total_defects := 0;
    new.version := 1;
    new.created_at := pg_catalog.now();
    new.updated_at := pg_catalog.now();

    new.created_by := coalesce(
      new.created_by,
      auth.uid()
    );

    new.updated_by := coalesce(
      new.updated_by,
      auth.uid()
    );

    if new.supervisor_employee_id is null then
      select profile.employee_id
      into current_employee_id
      from public.user_profiles as profile
      where profile.id = auth.uid()
        and profile.active = true
      limit 1;

      new.supervisor_employee_id := current_employee_id;
    end if;
  else
    select coalesce(sum(detail.quantity), 0)::integer
    into new.total_defects
    from public.daily_ipd_defects as detail
    where detail.daily_ipd_record_id = old.id;

    new.version := old.version + 1;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := pg_catalog.now();
    new.updated_by := coalesce(
      auth.uid(),
      old.updated_by
    );
  end if;

  if new.status = 'no_production' then
    new.produced_quantity := 0;
    new.defective_harness_quantity := 0;
  end if;

  if tg_op = 'INSERT'
     or new.production_date is distinct from old.production_date
     or new.line_model_assignment_id
        is distinct from old.line_model_assignment_id
     or new.shift_id is distinct from old.shift_id then

    select
      target.id,
      target.target_percentage
    into
      new.target_id,
      new.target_percentage
    from public.ipd_targets as target
    where target.line_model_assignment_id =
          new.line_model_assignment_id
      and target.active = true
      and (
        target.shift_id = new.shift_id
        or target.shift_id is null
      )
      and target.effective_from <= new.production_date
      and (
        target.effective_to is null
        or target.effective_to >= new.production_date
      )
    order by
      case
        when target.shift_id = new.shift_id then 0
        else 1
      end,
      target.effective_from desc
    limit 1;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'submitted' then
      new.submitted_at := coalesce(
        new.submitted_at,
        pg_catalog.now()
      );

      new.submitted_by := coalesce(
        new.submitted_by,
        auth.uid()
      );
    end if;

    if new.status = 'closed' then
      new.closed_at := coalesce(
        new.closed_at,
        pg_catalog.now()
      );

      new.closed_by := coalesce(
        new.closed_by,
        auth.uid()
      );
    end if;
  else
    if new.status = 'submitted'
       and old.status is distinct from 'submitted' then

      new.submitted_at := coalesce(
        new.submitted_at,
        pg_catalog.now()
      );

      new.submitted_by := coalesce(
        new.submitted_by,
        auth.uid()
      );
    end if;

    if new.status = 'closed'
       and old.status is distinct from 'closed' then

      new.closed_at := coalesce(
        new.closed_at,
        pg_catalog.now()
      );

      new.closed_by := coalesce(
        new.closed_by,
        auth.uid()
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger prepare_daily_ipd_record_trigger
before insert or update
on public.daily_ipd_records
for each row
execute function public.prepare_daily_ipd_record();

-- =========================================================
-- DEFECT DETAIL TRIGGERS
-- =========================================================

create or replace function public.prepare_daily_ipd_defect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := pg_catalog.now();
    new.updated_at := pg_catalog.now();

    new.created_by := coalesce(
      new.created_by,
      auth.uid()
    );

    new.updated_by := coalesce(
      new.updated_by,
      auth.uid()
    );
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := pg_catalog.now();

    new.updated_by := coalesce(
      auth.uid(),
      old.updated_by
    );
  end if;

  return new;
end;
$$;

create trigger prepare_daily_ipd_defect_trigger
before insert or update
on public.daily_ipd_defects
for each row
execute function public.prepare_daily_ipd_defect();

create or replace function public.refresh_daily_ipd_record_total(
  target_record_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.daily_ipd_records
  set updated_at = pg_catalog.now()
  where id = target_record_id;
end;
$$;

create or replace function public.sync_daily_ipd_record_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.daily_ipd_record_id
         is distinct from new.daily_ipd_record_id then

    perform public.refresh_daily_ipd_record_total(
      old.daily_ipd_record_id
    );

    perform public.refresh_daily_ipd_record_total(
      new.daily_ipd_record_id
    );

    return new;
  end if;

  perform public.refresh_daily_ipd_record_total(
    case
      when tg_op = 'DELETE'
        then old.daily_ipd_record_id
      else new.daily_ipd_record_id
    end
  );

  return coalesce(new, old);
end;
$$;

create trigger sync_daily_ipd_record_total_trigger
after insert or update or delete
on public.daily_ipd_defects
for each row
execute function public.sync_daily_ipd_record_total();

-- =========================================================
-- GENERIC UPDATED_AT TRIGGERS
-- =========================================================

create trigger plants_set_updated_at
before update on public.plants
for each row execute function public.set_updated_at();

create trigger shifts_set_updated_at
before update on public.shifts
for each row execute function public.set_updated_at();

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger product_models_set_updated_at
before update on public.product_models
for each row execute function public.set_updated_at();

create trigger production_lines_set_updated_at
before update on public.production_lines
for each row execute function public.set_updated_at();

create trigger line_model_assignments_set_updated_at
before update on public.line_model_assignments
for each row execute function public.set_updated_at();

create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger supervisor_assignments_set_updated_at
before update on public.supervisor_assignments
for each row execute function public.set_updated_at();

create trigger ipd_targets_set_updated_at
before update on public.ipd_targets
for each row execute function public.set_updated_at();

create trigger defect_types_set_updated_at
before update on public.defect_types
for each row execute function public.set_updated_at();

-- =========================================================
-- AUDIT FUNCTION
-- =========================================================

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_data jsonb;
  new_data jsonb;
  affected_record_id uuid;
begin
  if tg_op = 'INSERT' then
    old_data := null;
    new_data := to_jsonb(new);
    affected_record_id := new.id;
  elsif tg_op = 'UPDATE' then
    old_data := to_jsonb(old);
    new_data := to_jsonb(new);
    affected_record_id := new.id;
  else
    old_data := to_jsonb(old);
    new_data := null;
    affected_record_id := old.id;
  end if;

  insert into public.audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_by
  )
  values (
    tg_table_name,
    affected_record_id,
    pg_catalog.lower(tg_op)::public.audit_action,
    old_data,
    new_data,
    auth.uid()
  );

  return coalesce(new, old);
end;
$$;

-- =========================================================
-- AUDIT TRIGGERS
-- =========================================================

create trigger audit_plants
after insert or update or delete on public.plants
for each row execute function public.audit_row_change();

create trigger audit_shifts
after insert or update or delete on public.shifts
for each row execute function public.audit_row_change();

create trigger audit_customers
after insert or update or delete on public.customers
for each row execute function public.audit_row_change();

create trigger audit_product_models
after insert or update or delete on public.product_models
for each row execute function public.audit_row_change();

create trigger audit_production_lines
after insert or update or delete on public.production_lines
for each row execute function public.audit_row_change();

create trigger audit_line_model_assignments
after insert or update or delete
on public.line_model_assignments
for each row execute function public.audit_row_change();

create trigger audit_employees
after insert or update or delete on public.employees
for each row execute function public.audit_row_change();

create trigger audit_user_profiles
after insert or update or delete on public.user_profiles
for each row execute function public.audit_row_change();

create trigger audit_user_plant_access
after insert or update or delete on public.user_plant_access
for each row execute function public.audit_row_change();

create trigger audit_supervisor_assignments
after insert or update or delete
on public.supervisor_assignments
for each row execute function public.audit_row_change();

create trigger audit_ipd_targets
after insert or update or delete on public.ipd_targets
for each row execute function public.audit_row_change();

create trigger audit_defect_types
after insert or update or delete on public.defect_types
for each row execute function public.audit_row_change();

create trigger audit_daily_ipd_records
after insert or update or delete
on public.daily_ipd_records
for each row execute function public.audit_row_change();

create trigger audit_daily_ipd_defects
after insert or update or delete
on public.daily_ipd_defects
for each row execute function public.audit_row_change();

-- =========================================================
-- DAILY IPD OVERVIEW
-- =========================================================

create view public.daily_ipd_overview
with (security_invoker = true)
as
select
  record.id,
  record.production_date,

  plant.id as plant_id,
  plant.code as plant_code,
  plant.name as plant_name,

  line.id as production_line_id,
  line.name as production_line_name,

  model.id as product_model_id,
  model.name as product_model_name,
  model.model_year,

  shift.id as shift_id,
  shift.code as shift_code,
  shift.name as shift_name,

  employee.id as supervisor_employee_id,
  employee.employee_number as supervisor_employee_number,
  employee.full_name as supervisor_name,

  record.produced_quantity,
  record.defective_harness_quantity,
  record.total_defects,
  record.ipd_percentage,
  record.target_percentage,

  case
    when record.ipd_percentage is null then null
    else record.ipd_percentage
         - record.target_percentage
  end as target_difference,

  record.comment,
  record.status,
  record.version,
  record.created_at,
  record.updated_at
from public.daily_ipd_records as record
join public.line_model_assignments as assignment
  on assignment.id = record.line_model_assignment_id
join public.production_lines as line
  on line.id = assignment.production_line_id
join public.plants as plant
  on plant.id = line.plant_id
join public.product_models as model
  on model.id = assignment.product_model_id
join public.shifts as shift
  on shift.id = record.shift_id
join public.employees as employee
  on employee.id = record.supervisor_employee_id;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.plants enable row level security;
alter table public.shifts enable row level security;
alter table public.customers enable row level security;
alter table public.product_models enable row level security;
alter table public.production_lines enable row level security;
alter table public.line_model_assignments enable row level security;
alter table public.employees enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_plant_access enable row level security;
alter table public.supervisor_assignments enable row level security;
alter table public.ipd_targets enable row level security;
alter table public.defect_types enable row level security;
alter table public.daily_ipd_records enable row level security;
alter table public.daily_ipd_defects enable row level security;
alter table public.employee_import_batches enable row level security;
alter table public.employee_import_staging enable row level security;
alter table public.audit_logs enable row level security;

-- Policies will be created in the next migration.
-- Until then, the Data API cannot access these tables.

-- =========================================================
-- INITIAL DATA
-- =========================================================

insert into public.plants (
  code,
  name,
  timezone
)
values (
  'MCH1',
  'MCH1',
  'America/Mazatlan'
)
on conflict do nothing;

insert into public.shifts (
  code,
  name,
  display_order
)
values
  ('TA', 'Turno A', 1),
  ('TB', 'Turno B', 2)
on conflict do nothing;

insert into public.defect_types (
  code,
  name_es,
  name_en,
  display_order
)
values
  (
    'DAMAGED_WIRE',
    'Cable dañado',
    'Damaged Wire',
    1
  ),
  (
    'INCORRECTLY_APPLIED_COMPONENT',
    'Componente aplicado incorrectamente',
    'Incorrectly Applied Component',
    2
  ),
  (
    'DAMAGED_COMPONENT',
    'Componente dañado',
    'Damaged Component',
    3
  ),
  (
    'ILLEGIBLE_LABEL',
    'Etiqueta ilegible',
    'Illegible Label',
    4
  ),
  (
    'MISSING_CIRCUIT',
    'Circuito faltante',
    'Missing Circuit',
    5
  ),
  (
    'REVERSED_CIRCUIT',
    'Circuito invertido',
    'Reversed Circuit',
    6
  ),
  (
    'DAMAGED_TERMINAL',
    'Terminal dañada',
    'Damaged Terminal',
    7
  ),
  (
    'TNA',
    'TNA',
    'TNA',
    8
  ),
  (
    'OTHER',
    'Otro',
    'Other',
    9
  ),
  (
    'INCORRECT_COMPONENT',
    'Componente incorrecto',
    'Incorrect Component',
    10
  ),
  (
    'MISSING_COMPONENT',
    'Componente faltante',
    'Missing Component',
    11
  ),
  (
    'DIMENSIONAL_ISSUE',
    'Problema dimensional',
    'Dimensional Issue',
    12
  ),
  (
    'MISSING_CONTINUITY',
    'Falta de continuidad',
    'Missing Continuity',
    13
  ),
  (
    'INCORRECT_CONNECTOR_CONFIGURATION',
    'Conector o configuración incorrecta',
    'Incorrect Connector or Configuration',
    14
  ),
  (
    'MISSING_TAPING',
    'Encintado faltante',
    'Missing Taping',
    15
  ),
  (
    'KNOTTED_CIRCUIT',
    'Circuito anudado',
    'Knotted Circuit',
    16
  ),
  (
    'EXTRA_COMPONENT',
    'Componente adicional',
    'Extra Component',
    17
  ),
  (
    'INCORRECTLY_ORIENTED_COMPONENT',
    'Componente orientado incorrectamente',
    'Incorrectly Oriented Component',
    18
  ),
  (
    'CONTAMINATION',
    'Contaminación',
    'Contamination',
    19
  ),
  (
    'DEFECTIVE_COMPONENT',
    'Componente defectuoso',
    'Defective Component',
    20
  ),
  (
    'BROKEN_COMPONENT',
    'Componente roto',
    'Broken Component',
    21
  ),
  (
    'MISALIGNED_TERMINAL',
    'Terminal desalineada',
    'Misaligned Terminal',
    22
  ),
  (
    'INCORRECT_WIRE',
    'Cable incorrecto',
    'Incorrect Wire',
    23
  )
on conflict do nothing;

commit;
