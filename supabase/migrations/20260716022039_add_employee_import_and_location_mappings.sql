begin;

-- =========================================================
-- EMPLOYEE SOURCE DATA COLUMNS
-- Preserve every useful value received from the HDC sheet.
-- =========================================================

alter table public.employees
  add column if not exists category text;

alter table public.employees
  add column if not exists position_name text;

alter table public.employees
  add column if not exists function_name text;

alter table public.employees
  add column if not exists process_name text;

-- =========================================================
-- SOURCE LOCATION → PLANT MAPPINGS
-- Unknown HDC locality codes remain valid but have plant_id = null.
-- =========================================================

create table if not exists public.source_location_mappings (
  id uuid primary key default gen_random_uuid(),

  source_code text not null,
  plant_id uuid null
    references public.plants(id)
    on update cascade
    on delete restrict,

  display_name text null,
  notes text null,

  active boolean not null default true,

  created_at timestamptz not null
    default pg_catalog.now(),

  updated_at timestamptz not null
    default pg_catalog.now(),

  created_by uuid null
    default auth.uid(),

  updated_by uuid null
    default auth.uid(),

  constraint source_location_mappings_code_not_blank
    check (
      length(pg_catalog.btrim(source_code)) > 0
    ),

  constraint source_location_mappings_code_length
    check (
      length(pg_catalog.btrim(source_code)) <= 50
    ),

  constraint source_location_mappings_display_name_length
    check (
      display_name is null
      or length(display_name) <= 150
    ),

  constraint source_location_mappings_notes_length
    check (
      notes is null
      or length(notes) <= 1000
    )
);

create unique index if not exists
  source_location_mappings_source_code_uq
on public.source_location_mappings (
  public.normalize_text(source_code)
);

create index if not exists
  source_location_mappings_plant_active_idx
on public.source_location_mappings (
  plant_id,
  active
);

alter table public.source_location_mappings
  enable row level security;

revoke all
on public.source_location_mappings
from anon, authenticated;

grant select, insert, update
on public.source_location_mappings
to authenticated;

create policy source_location_mappings_select_policy
on public.source_location_mappings
for select
to authenticated
using (
  private.is_active_user()
);

create policy source_location_mappings_insert_policy
on public.source_location_mappings
for insert
to authenticated
with check (
  private.is_system_administrator()
);

create policy source_location_mappings_update_policy
on public.source_location_mappings
for update
to authenticated
using (
  private.is_system_administrator()
)
with check (
  private.is_system_administrator()
);

-- Mappings are preserved for traceability.
-- No DELETE policy is intentionally created.

-- =========================================================
-- NORMALIZE MAPPING DATA BEFORE SAVE
-- =========================================================

create or replace function public.prepare_source_location_mapping()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.source_code :=
    pg_catalog.upper(
      pg_catalog.btrim(new.source_code)
    );

  new.display_name :=
    nullif(
      pg_catalog.btrim(new.display_name),
      ''
    );

  new.notes :=
    nullif(
      pg_catalog.btrim(new.notes),
      ''
    );

  if tg_op = 'INSERT' then
    new.created_at := pg_catalog.now();
    new.created_by := (select auth.uid());
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;

  new.updated_at := pg_catalog.now();
  new.updated_by := (select auth.uid());

  return new;
end;
$$;

drop trigger if exists
  prepare_source_location_mapping_trigger
on public.source_location_mappings;

create trigger prepare_source_location_mapping_trigger
before insert or update
on public.source_location_mappings
for each row
execute function public.prepare_source_location_mapping();

-- =========================================================
-- KEEP EMPLOYEES SYNCHRONIZED WHEN A MAPPING CHANGES
-- =========================================================

create or replace function public.sync_employees_from_location_mapping()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and public.normalize_text(old.source_code)
         is distinct from
         public.normalize_text(new.source_code) then

    update public.employees
    set
      plant_id = null,
      updated_at = pg_catalog.now()
    where public.normalize_text(
      source_location_code
    ) = public.normalize_text(
      old.source_code
    );
  end if;

  update public.employees
  set
    plant_id =
      case
        when new.active then new.plant_id
        else null
      end,
    updated_at = pg_catalog.now()
  where public.normalize_text(
    source_location_code
  ) = public.normalize_text(
    new.source_code
  );

  return new;
end;
$$;

drop trigger if exists
  sync_employees_from_location_mapping_trigger
on public.source_location_mappings;

create trigger sync_employees_from_location_mapping_trigger
after insert or update of
  source_code,
  plant_id,
  active
on public.source_location_mappings
for each row
execute function public.sync_employees_from_location_mapping();

-- =========================================================
-- MAPPING OVERVIEW FOR THE FUTURE ADMINISTRATION SCREEN
-- =========================================================

drop view if exists
  public.source_location_mapping_overview;

create view public.source_location_mapping_overview
with (security_invoker = true)
as
select
  mapping.id,
  mapping.source_code,
  mapping.plant_id,

  plant.code as plant_code,
  plant.name as plant_name,

  mapping.display_name,
  mapping.notes,
  mapping.active,
  mapping.created_at,
  mapping.updated_at,

  count(employee.id)::bigint
    as employee_count
from public.source_location_mappings
  as mapping
left join public.plants as plant
  on plant.id = mapping.plant_id
left join public.employees as employee
  on public.normalize_text(
       employee.source_location_code
     ) = public.normalize_text(
       mapping.source_code
     )
group by
  mapping.id,
  mapping.source_code,
  mapping.plant_id,
  plant.code,
  plant.name,
  mapping.display_name,
  mapping.notes,
  mapping.active,
  mapping.created_at,
  mapping.updated_at;

grant select
on public.source_location_mapping_overview
to authenticated;

-- =========================================================
-- INITIAL CONFIRMED MAPPING: HC0707 → MCH1
-- =========================================================

do $$
declare
  mch1_plant_id uuid;
begin
  select plant.id
  into mch1_plant_id
  from public.plants as plant
  where public.normalize_text(plant.code) =
        public.normalize_text('MCH1')
  limit 1;

  if mch1_plant_id is null then
    raise exception
      'Plant MCH1 was not found. Create MCH1 before applying this migration.';
  end if;

  insert into public.source_location_mappings (
    source_code,
    plant_id,
    display_name,
    notes,
    active
  )
  values (
    'HC0707',
    mch1_plant_id,
    'Planta MCH1',
    'Equivalencia confirmada para la hoja HDC.',
    true
  )
  on conflict (
    public.normalize_text(source_code)
  )
  do update
  set
    plant_id = excluded.plant_id,
    display_name = excluded.display_name,
    notes = excluded.notes,
    active = true;
end;
$$;

-- =========================================================
-- BATCH EMPLOYEE IMPORT
--
-- Angular will send validated rows in batches, normally 500.
-- Existing photo_path, shift_id and production_line_id are preserved.
-- plant_id is resolved exclusively through source_location_mappings.
-- =========================================================

create or replace function public.import_employee_batch(
  rows_value jsonb
)
returns table (
  processed_count integer,
  inserted_count integer,
  updated_count integer,
  rejected_count integer,
  unmapped_location_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  input_count integer := 0;
  valid_count integer := 0;
  existing_count integer := 0;
  unmapped_count integer := 0;
begin
  if not private.is_system_administrator() then
    raise exception
      'Only a system administrator can import employees.'
      using errcode = '42501';
  end if;

  if rows_value is null
     or pg_catalog.jsonb_typeof(rows_value) <> 'array' then
    raise exception
      'Employee import payload must be a JSON array.'
      using errcode = '22023';
  end if;

  input_count :=
    pg_catalog.jsonb_array_length(rows_value);

  if input_count = 0 then
    return query
    select 0, 0, 0, 0, 0;

    return;
  end if;

  if input_count > 1000 then
    raise exception
      'A single employee import batch cannot exceed 1000 rows.'
      using errcode = '22023';
  end if;

  create temporary table pg_temp.employee_import_rows
  on commit drop
  as
  with raw_rows as (
    select *
    from pg_catalog.jsonb_to_recordset(rows_value)
    as imported_row (
      "employeeNumber" text,
      "fullName" text,
      "sourceLocationCode" text,
      "sourceShiftCode" text,
      "serviceDate" text,
      "departmentName" text,
      "sourceLineCode" text,
      "jobPosition" text,
      "category" text,
      "positionName" text,
      "functionName" text,
      "processName" text,
      "departmentCode" text
    )
  ),
  cleaned_rows as (
    select
      pg_catalog.btrim(
        coalesce("employeeNumber", '')
      ) as employee_number,

      public.normalize_text(
        pg_catalog.btrim(
          coalesce("employeeNumber", '')
        )
      ) as normalized_employee_number,

      pg_catalog.btrim(
        coalesce("fullName", '')
      ) as full_name,

      nullif(
        pg_catalog.upper(
          pg_catalog.btrim(
            coalesce("sourceLocationCode", '')
          )
        ),
        ''
      ) as source_location_code,

      nullif(
        pg_catalog.upper(
          pg_catalog.btrim(
            coalesce("sourceShiftCode", '')
          )
        ),
        ''
      ) as source_shift_code,

      case
        when nullif(
          pg_catalog.btrim(
            coalesce("serviceDate", '')
          ),
          ''
        ) is null
          then null
        else pg_catalog.btrim("serviceDate")::date
      end as service_date,

      nullif(
        pg_catalog.btrim(
          coalesce("departmentName", '')
        ),
        ''
      ) as department_name,

      nullif(
        pg_catalog.upper(
          pg_catalog.btrim(
            coalesce("sourceLineCode", '')
          )
        ),
        ''
      ) as source_line_code,

      nullif(
        pg_catalog.btrim(
          coalesce("jobPosition", '')
        ),
        ''
      ) as job_position,

      nullif(
        pg_catalog.btrim(
          coalesce("category", '')
        ),
        ''
      ) as category,

      nullif(
        pg_catalog.btrim(
          coalesce("positionName", '')
        ),
        ''
      ) as position_name,

      nullif(
        pg_catalog.btrim(
          coalesce("functionName", '')
        ),
        ''
      ) as function_name,

      nullif(
        pg_catalog.btrim(
          coalesce("processName", '')
        ),
        ''
      ) as process_name,

      nullif(
        pg_catalog.btrim(
          coalesce("departmentCode", '')
        ),
        ''
      ) as department_code,

      pg_catalog.row_number() over (
        partition by public.normalize_text(
          pg_catalog.btrim(
            coalesce("employeeNumber", '')
          )
        )
        order by
          pg_catalog.btrim(
            coalesce("fullName", '')
          )
      ) as duplicate_rank
    from raw_rows
  )
  select
    employee_number,
    normalized_employee_number,
    full_name,
    source_location_code,
    source_shift_code,
    service_date,
    department_name,
    source_line_code,
    job_position,
    category,
    position_name,
    function_name,
    process_name,
    department_code
  from cleaned_rows
  where employee_number <> ''
    and full_name <> ''
    and duplicate_rank = 1;

  select count(*)::integer
  into valid_count
  from pg_temp.employee_import_rows;

  -- Keep every discovered HDC locality visible for later classification.
  insert into public.source_location_mappings (
    source_code,
    display_name,
    notes,
    active
  )
  select distinct
    imported.source_location_code,
    imported.source_location_code,
    'Código detectado automáticamente durante la importación HDC.',
    true
  from pg_temp.employee_import_rows as imported
  where imported.source_location_code is not null
  on conflict (
    public.normalize_text(source_code)
  )
  do nothing;

  select count(*)::integer
  into existing_count
  from pg_temp.employee_import_rows as imported
  join public.employees as employee
    on public.normalize_text(
         employee.employee_number
       ) = imported.normalized_employee_number;

  select count(*)::integer
  into unmapped_count
  from pg_temp.employee_import_rows as imported
  left join public.source_location_mappings
    as mapping
    on public.normalize_text(
         mapping.source_code
       ) = public.normalize_text(
         imported.source_location_code
       )
   and mapping.active = true
  where imported.source_location_code is not null
    and mapping.plant_id is null;

  insert into public.employees (
    employee_number,
    full_name,
    plant_id,

    service_date,
    department_name,
    department_code,
    job_position,

    category,
    position_name,
    function_name,
    process_name,

    source_location_code,
    source_shift_code,
    source_line_code,

    active
  )
  select
    imported.employee_number,
    imported.full_name,
    mapping.plant_id,

    imported.service_date,
    imported.department_name,
    imported.department_code,
    imported.job_position,

    imported.category,
    imported.position_name,
    imported.function_name,
    imported.process_name,

    imported.source_location_code,
    imported.source_shift_code,
    imported.source_line_code,

    true
  from pg_temp.employee_import_rows as imported
  left join public.source_location_mappings
    as mapping
    on public.normalize_text(
         mapping.source_code
       ) = public.normalize_text(
         imported.source_location_code
       )
   and mapping.active = true
  on conflict (
    public.normalize_text(employee_number)
  )
  do update
  set
    full_name = excluded.full_name,
    plant_id = excluded.plant_id,

    service_date = excluded.service_date,
    department_name = excluded.department_name,
    department_code = excluded.department_code,
    job_position = excluded.job_position,

    category = excluded.category,
    position_name = excluded.position_name,
    function_name = excluded.function_name,
    process_name = excluded.process_name,

    source_location_code =
      excluded.source_location_code,

    source_shift_code =
      excluded.source_shift_code,

    source_line_code =
      excluded.source_line_code,

    active = true,
    updated_at = pg_catalog.now();

  return query
  select
    valid_count,
    valid_count - existing_count,
    existing_count,
    input_count - valid_count,
    unmapped_count;
end;
$$;

revoke all
on function public.import_employee_batch(jsonb)
from public, anon, authenticated;

grant execute
on function public.import_employee_batch(jsonb)
to authenticated;

commit;
