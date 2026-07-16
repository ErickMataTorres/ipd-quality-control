begin;

-- =========================================================
-- EMPLOYEE DIRECTORY SEARCH SUPPORT
-- =========================================================

create extension if not exists pg_trgm
with schema extensions;

create index if not exists employees_number_trgm_idx
on public.employees
using gin (
  public.normalize_text(employee_number)
  extensions.gin_trgm_ops
);

create index if not exists employees_full_name_trgm_idx
on public.employees
using gin (
  public.normalize_text(full_name)
  extensions.gin_trgm_ops
);

create index if not exists employees_plant_active_name_idx
on public.employees (
  plant_id,
  active,
  full_name
);

create index if not exists employees_shift_active_idx
on public.employees (
  shift_id,
  active
);

-- =========================================================
-- PAGINATED EMPLOYEE DIRECTORY RPC
-- The function runs with the caller's permissions, so the
-- existing employees RLS policy remains the source of truth.
-- =========================================================

create or replace function public.search_employees(
  search_value text default null,
  plant_id_value uuid default null,
  shift_id_value uuid default null,
  active_value boolean default null,
  page_number_value integer default 1,
  page_size_value integer default 25
)
returns table (
  id uuid,
  employee_number text,
  full_name text,

  plant_id uuid,
  plant_code text,
  plant_name text,

  shift_id uuid,
  shift_code text,
  shift_name text,

  production_line_id uuid,
  production_line_name text,

  service_date date,
  department_name text,
  department_code text,
  job_position text,

  source_location_code text,
  source_shift_code text,
  source_line_code text,

  photo_path text,
  active boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with parameters as (
    select
      nullif(
        public.normalize_text(
          coalesce(search_value, '')
        ),
        ''
      ) as normalized_search,

      greatest(
        coalesce(page_number_value, 1),
        1
      ) as page_number,

      least(
        greatest(
          coalesce(page_size_value, 25),
          1
        ),
        100
      ) as page_size
  ),
  filtered_employees as (
    select
      employee.id,
      employee.employee_number,
      employee.full_name,

      employee.plant_id,
      plant.code as plant_code,
      plant.name as plant_name,

      employee.shift_id,
      shift.code as shift_code,
      shift.name as shift_name,

      employee.production_line_id,
      production_line.name
        as production_line_name,

      employee.service_date,
      employee.department_name,
      employee.department_code,
      employee.job_position,

      employee.source_location_code,
      employee.source_shift_code,
      employee.source_line_code,

      employee.photo_path,
      employee.active
    from public.employees as employee
    cross join parameters
    left join public.plants as plant
      on plant.id = employee.plant_id
    left join public.shifts as shift
      on shift.id = employee.shift_id
    left join public.production_lines
      as production_line
      on production_line.id =
         employee.production_line_id
    where (
      plant_id_value is null
      or employee.plant_id = plant_id_value
    )
    and (
      shift_id_value is null
      or employee.shift_id = shift_id_value
    )
    and (
      active_value is null
      or employee.active = active_value
    )
    and (
      parameters.normalized_search is null
      or public.normalize_text(
        employee.employee_number
      ) like (
        '%' ||
        parameters.normalized_search ||
        '%'
      )
      or public.normalize_text(
        employee.full_name
      ) like (
        '%' ||
        parameters.normalized_search ||
        '%'
      )
    )
  )
    select
    filtered_employees.id,
    filtered_employees.employee_number,
    filtered_employees.full_name,

    filtered_employees.plant_id,
    filtered_employees.plant_code,
    filtered_employees.plant_name,

    filtered_employees.shift_id,
    filtered_employees.shift_code,
    filtered_employees.shift_name,

    filtered_employees.production_line_id,
    filtered_employees.production_line_name,

    filtered_employees.service_date,
    filtered_employees.department_name,
    filtered_employees.department_code,
    filtered_employees.job_position,

    filtered_employees.source_location_code,
    filtered_employees.source_shift_code,
    filtered_employees.source_line_code,

    filtered_employees.photo_path,
    filtered_employees.active,

    count(*) over() as total_count
  from filtered_employees
  order by
    filtered_employees.full_name asc,
    filtered_employees.employee_number asc
  offset (
    (
      greatest(
        coalesce(page_number_value, 1),
        1
      ) - 1
    )
    *
    least(
      greatest(
        coalesce(page_size_value, 25),
        1
      ),
      100
    )
  )
  limit least(
    greatest(
      coalesce(page_size_value, 25),
      1
    ),
    100
  );
$$;

revoke all
on function public.search_employees(
  text,
  uuid,
  uuid,
  boolean,
  integer,
  integer
)
from public, anon;

grant execute
on function public.search_employees(
  text,
  uuid,
  uuid,
  boolean,
  integer,
  integer
)
to authenticated;

commit;
