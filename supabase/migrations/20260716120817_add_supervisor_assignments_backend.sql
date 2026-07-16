begin;

create extension if not exists btree_gist
with schema extensions;

alter table public.supervisor_assignments
  drop constraint if exists
  supervisor_assignments_no_overlap;

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
  )
  where (active);

create index if not exists
  supervisor_assignments_current_idx
on public.supervisor_assignments (
  line_model_assignment_id,
  shift_id,
  effective_from,
  effective_to
)
where active = true;

drop view if exists
  public.supervisor_assignment_overview;

create view public.supervisor_assignment_overview
with (security_invoker = true)
as
select
  assignment.id,

  assignment.supervisor_employee_id,
  employee.employee_number,
  employee.full_name as supervisor_name,
  employee.photo_path,
  employee.plant_id as supervisor_plant_id,

  assignment.line_model_assignment_id,

  production_line.id as production_line_id,
  production_line.name as production_line_name,
  production_line.display_order,

  plant.id as plant_id,
  plant.code as plant_code,
  plant.name as plant_name,

  line_model_assignment.product_model_id,
  product_model.name as product_model_name,
  product_model.model_year,

  assignment.shift_id,
  shift.code as shift_code,
  shift.name as shift_name,

  assignment.effective_from,
  assignment.effective_to,
  assignment.active,

  (
    assignment.active
    and assignment.effective_from <=
      (
        pg_catalog.now()
        at time zone plant.timezone
      )::date
    and (
      assignment.effective_to is null
      or assignment.effective_to >=
        (
          pg_catalog.now()
          at time zone plant.timezone
        )::date
    )
  ) as is_current,

  assignment.created_at,
  assignment.updated_at
from public.supervisor_assignments
  as assignment
join public.employees as employee
  on employee.id =
     assignment.supervisor_employee_id
join public.line_model_assignments
  as line_model_assignment
  on line_model_assignment.id =
     assignment.line_model_assignment_id
join public.production_lines
  as production_line
  on production_line.id =
     line_model_assignment.production_line_id
join public.plants as plant
  on plant.id =
     production_line.plant_id
join public.product_models
  as product_model
  on product_model.id =
     line_model_assignment.product_model_id
join public.shifts as shift
  on shift.id =
     assignment.shift_id;

grant select
on public.supervisor_assignment_overview
to authenticated;

create or replace function
public.create_supervisor_assignments(
  supervisor_employee_id_value uuid,
  line_model_assignment_ids_value uuid[],
  shift_id_value uuid,
  effective_from_value date,
  effective_to_value date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee_plant_id uuid;
  requested_count integer := 0;
  allowed_count integer := 0;
  inserted_count integer := 0;
begin
  if not private.is_quality_manager_or_administrator() then
    raise exception
      'The current user cannot manage supervisor assignments.'
      using errcode = '42501';
  end if;

  if supervisor_employee_id_value is null then
    raise exception
      'Supervisor employee is required.'
      using errcode = '22023';
  end if;

  if shift_id_value is null then
    raise exception
      'Shift is required.'
      using errcode = '22023';
  end if;

  if effective_from_value is null then
    raise exception
      'Effective start date is required.'
      using errcode = '22023';
  end if;

  if effective_to_value is not null
     and effective_to_value < effective_from_value then
    raise exception
      'Effective end date cannot be earlier than the start date.'
      using errcode = '22023';
  end if;

  if line_model_assignment_ids_value is null
     or cardinality(
       line_model_assignment_ids_value
     ) = 0 then
    raise exception
      'Select at least one production line.'
      using errcode = '22023';
  end if;

  select employee.plant_id
  into employee_plant_id
  from public.employees as employee
  where employee.id =
        supervisor_employee_id_value
    and employee.active = true;

  if not found then
    raise exception
      'The selected employee does not exist or is inactive.'
      using errcode = '22023';
  end if;

  if employee_plant_id is null then
    raise exception
      'The selected employee does not have an identified plant.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.shifts as shift
    where shift.id = shift_id_value
      and shift.active = true
  ) then
    raise exception
      'The selected shift does not exist or is inactive.'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into requested_count
  from (
    select distinct assignment_id
    from unnest(
      line_model_assignment_ids_value
    ) as requested(assignment_id)
    where assignment_id is not null
  ) as distinct_assignments;

  select count(*)::integer
  into allowed_count
  from (
    select distinct
      requested.assignment_id
    from unnest(
      line_model_assignment_ids_value
    ) as requested(assignment_id)
    join public.line_model_assignments
      as line_model_assignment
      on line_model_assignment.id =
         requested.assignment_id
    join public.production_lines
      as production_line
      on production_line.id =
         line_model_assignment.production_line_id
    join public.plants as plant
      on plant.id =
         production_line.plant_id
    join public.product_models
      as product_model
      on product_model.id =
         line_model_assignment.product_model_id
    where requested.assignment_id is not null
      and line_model_assignment.active = true
      and production_line.active = true
      and plant.active = true
      and product_model.active = true
      and production_line.plant_id =
          employee_plant_id
      and private.has_plant_access(
        production_line.plant_id
      )
  ) as allowed_assignments;

  if requested_count = 0
     or allowed_count <> requested_count then
    raise exception
      'One or more selected lines are unavailable, inactive, outside the employee plant, or outside your access.'
      using errcode = '42501';
  end if;

  insert into public.supervisor_assignments (
    supervisor_employee_id,
    line_model_assignment_id,
    shift_id,
    effective_from,
    effective_to,
    active
  )
  select
    supervisor_employee_id_value,
    requested.assignment_id,
    shift_id_value,
    effective_from_value,
    effective_to_value,
    true
  from (
    select distinct assignment_id
    from unnest(
      line_model_assignment_ids_value
    ) as selected(assignment_id)
    where assignment_id is not null
  ) as requested;

  get diagnostics inserted_count = row_count;

  return inserted_count;
end;
$$;

create or replace function
public.update_supervisor_assignment(
  assignment_id_value uuid,
  shift_id_value uuid,
  effective_from_value date,
  effective_to_value date,
  active_value boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_plant_id uuid;
begin
  if not private.is_quality_manager_or_administrator() then
    raise exception
      'The current user cannot manage supervisor assignments.'
      using errcode = '42501';
  end if;

  if assignment_id_value is null then
    raise exception
      'Supervisor assignment is required.'
      using errcode = '22023';
  end if;

  if shift_id_value is null then
    raise exception
      'Shift is required.'
      using errcode = '22023';
  end if;

  if effective_from_value is null then
    raise exception
      'Effective start date is required.'
      using errcode = '22023';
  end if;

  if effective_to_value is not null
     and effective_to_value < effective_from_value then
    raise exception
      'Effective end date cannot be earlier than the start date.'
      using errcode = '22023';
  end if;

  select production_line.plant_id
  into assignment_plant_id
  from public.supervisor_assignments
    as assignment
  join public.line_model_assignments
    as line_model_assignment
    on line_model_assignment.id =
       assignment.line_model_assignment_id
  join public.production_lines
    as production_line
    on production_line.id =
       line_model_assignment.production_line_id
  where assignment.id =
        assignment_id_value
  for update of assignment;

  if not found then
    raise exception
      'Supervisor assignment was not found.'
      using errcode = 'P0002';
  end if;

  if not private.has_plant_access(
    assignment_plant_id
  ) then
    raise exception
      'The current user cannot access this assignment plant.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.shifts as shift
    where shift.id = shift_id_value
      and shift.active = true
  ) then
    raise exception
      'The selected shift does not exist or is inactive.'
      using errcode = '22023';
  end if;

  update public.supervisor_assignments
  set
    shift_id = shift_id_value,
    effective_from = effective_from_value,
    effective_to = effective_to_value,
    active = coalesce(active_value, true),
    updated_at = pg_catalog.now(),
    updated_by = (select auth.uid())
  where id = assignment_id_value;
end;
$$;

revoke all
on function public.create_supervisor_assignments(
  uuid,
  uuid[],
  uuid,
  date,
  date
)
from public, anon;

revoke all
on function public.update_supervisor_assignment(
  uuid,
  uuid,
  date,
  date,
  boolean
)
from public, anon;

grant execute
on function public.create_supervisor_assignments(
  uuid,
  uuid[],
  uuid,
  date,
  date
)
to authenticated;

grant execute
on function public.update_supervisor_assignment(
  uuid,
  uuid,
  date,
  date,
  boolean
)
to authenticated;

commit;
begin;

create extension if not exists btree_gist
with schema extensions;

alter table public.supervisor_assignments
  drop constraint if exists
  supervisor_assignments_no_overlap;

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
  )
  where (active);

create index if not exists
  supervisor_assignments_current_idx
on public.supervisor_assignments (
  line_model_assignment_id,
  shift_id,
  effective_from,
  effective_to
)
where active = true;

drop view if exists
  public.supervisor_assignment_overview;

create view public.supervisor_assignment_overview
with (security_invoker = true)
as
select
  assignment.id,

  assignment.supervisor_employee_id,
  employee.employee_number,
  employee.full_name as supervisor_name,
  employee.photo_path,
  employee.plant_id as supervisor_plant_id,

  assignment.line_model_assignment_id,

  production_line.id as production_line_id,
  production_line.name as production_line_name,
  production_line.display_order,

  plant.id as plant_id,
  plant.code as plant_code,
  plant.name as plant_name,

  line_model_assignment.product_model_id,
  product_model.name as product_model_name,
  product_model.model_year,

  assignment.shift_id,
  shift.code as shift_code,
  shift.name as shift_name,

  assignment.effective_from,
  assignment.effective_to,
  assignment.active,

  (
    assignment.active
    and assignment.effective_from <=
      (
        pg_catalog.now()
        at time zone plant.timezone
      )::date
    and (
      assignment.effective_to is null
      or assignment.effective_to >=
        (
          pg_catalog.now()
          at time zone plant.timezone
        )::date
    )
  ) as is_current,

  assignment.created_at,
  assignment.updated_at
from public.supervisor_assignments
  as assignment
join public.employees as employee
  on employee.id =
     assignment.supervisor_employee_id
join public.line_model_assignments
  as line_model_assignment
  on line_model_assignment.id =
     assignment.line_model_assignment_id
join public.production_lines
  as production_line
  on production_line.id =
     line_model_assignment.production_line_id
join public.plants as plant
  on plant.id =
     production_line.plant_id
join public.product_models
  as product_model
  on product_model.id =
     line_model_assignment.product_model_id
join public.shifts as shift
  on shift.id =
     assignment.shift_id;

grant select
on public.supervisor_assignment_overview
to authenticated;

create or replace function
public.create_supervisor_assignments(
  supervisor_employee_id_value uuid,
  line_model_assignment_ids_value uuid[],
  shift_id_value uuid,
  effective_from_value date,
  effective_to_value date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee_plant_id uuid;
  requested_count integer := 0;
  allowed_count integer := 0;
  inserted_count integer := 0;
begin
  if not private.is_quality_manager_or_administrator() then
    raise exception
      'The current user cannot manage supervisor assignments.'
      using errcode = '42501';
  end if;

  if supervisor_employee_id_value is null then
    raise exception
      'Supervisor employee is required.'
      using errcode = '22023';
  end if;

  if shift_id_value is null then
    raise exception
      'Shift is required.'
      using errcode = '22023';
  end if;

  if effective_from_value is null then
    raise exception
      'Effective start date is required.'
      using errcode = '22023';
  end if;

  if effective_to_value is not null
     and effective_to_value < effective_from_value then
    raise exception
      'Effective end date cannot be earlier than the start date.'
      using errcode = '22023';
  end if;

  if line_model_assignment_ids_value is null
     or cardinality(
       line_model_assignment_ids_value
     ) = 0 then
    raise exception
      'Select at least one production line.'
      using errcode = '22023';
  end if;

  select employee.plant_id
  into employee_plant_id
  from public.employees as employee
  where employee.id =
        supervisor_employee_id_value
    and employee.active = true;

  if not found then
    raise exception
      'The selected employee does not exist or is inactive.'
      using errcode = '22023';
  end if;

  if employee_plant_id is null then
    raise exception
      'The selected employee does not have an identified plant.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.shifts as shift
    where shift.id = shift_id_value
      and shift.active = true
  ) then
    raise exception
      'The selected shift does not exist or is inactive.'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into requested_count
  from (
    select distinct assignment_id
    from unnest(
      line_model_assignment_ids_value
    ) as requested(assignment_id)
    where assignment_id is not null
  ) as distinct_assignments;

  select count(*)::integer
  into allowed_count
  from (
    select distinct
      requested.assignment_id
    from unnest(
      line_model_assignment_ids_value
    ) as requested(assignment_id)
    join public.line_model_assignments
      as line_model_assignment
      on line_model_assignment.id =
         requested.assignment_id
    join public.production_lines
      as production_line
      on production_line.id =
         line_model_assignment.production_line_id
    join public.plants as plant
      on plant.id =
         production_line.plant_id
    join public.product_models
      as product_model
      on product_model.id =
         line_model_assignment.product_model_id
    where requested.assignment_id is not null
      and line_model_assignment.active = true
      and production_line.active = true
      and plant.active = true
      and product_model.active = true
      and production_line.plant_id =
          employee_plant_id
      and private.has_plant_access(
        production_line.plant_id
      )
  ) as allowed_assignments;

  if requested_count = 0
     or allowed_count <> requested_count then
    raise exception
      'One or more selected lines are unavailable, inactive, outside the employee plant, or outside your access.'
      using errcode = '42501';
  end if;

  insert into public.supervisor_assignments (
    supervisor_employee_id,
    line_model_assignment_id,
    shift_id,
    effective_from,
    effective_to,
    active
  )
  select
    supervisor_employee_id_value,
    requested.assignment_id,
    shift_id_value,
    effective_from_value,
    effective_to_value,
    true
  from (
    select distinct assignment_id
    from unnest(
      line_model_assignment_ids_value
    ) as selected(assignment_id)
    where assignment_id is not null
  ) as requested;

  get diagnostics inserted_count = row_count;

  return inserted_count;
end;
$$;

create or replace function
public.update_supervisor_assignment(
  assignment_id_value uuid,
  shift_id_value uuid,
  effective_from_value date,
  effective_to_value date,
  active_value boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_plant_id uuid;
begin
  if not private.is_quality_manager_or_administrator() then
    raise exception
      'The current user cannot manage supervisor assignments.'
      using errcode = '42501';
  end if;

  if assignment_id_value is null then
    raise exception
      'Supervisor assignment is required.'
      using errcode = '22023';
  end if;

  if shift_id_value is null then
    raise exception
      'Shift is required.'
      using errcode = '22023';
  end if;

  if effective_from_value is null then
    raise exception
      'Effective start date is required.'
      using errcode = '22023';
  end if;

  if effective_to_value is not null
     and effective_to_value < effective_from_value then
    raise exception
      'Effective end date cannot be earlier than the start date.'
      using errcode = '22023';
  end if;

  select production_line.plant_id
  into assignment_plant_id
  from public.supervisor_assignments
    as assignment
  join public.line_model_assignments
    as line_model_assignment
    on line_model_assignment.id =
       assignment.line_model_assignment_id
  join public.production_lines
    as production_line
    on production_line.id =
       line_model_assignment.production_line_id
  where assignment.id =
        assignment_id_value
  for update of assignment;

  if not found then
    raise exception
      'Supervisor assignment was not found.'
      using errcode = 'P0002';
  end if;

  if not private.has_plant_access(
    assignment_plant_id
  ) then
    raise exception
      'The current user cannot access this assignment plant.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.shifts as shift
    where shift.id = shift_id_value
      and shift.active = true
  ) then
    raise exception
      'The selected shift does not exist or is inactive.'
      using errcode = '22023';
  end if;

  update public.supervisor_assignments
  set
    shift_id = shift_id_value,
    effective_from = effective_from_value,
    effective_to = effective_to_value,
    active = coalesce(active_value, true),
    updated_at = pg_catalog.now(),
    updated_by = (select auth.uid())
  where id = assignment_id_value;
end;
$$;

revoke all
on function public.create_supervisor_assignments(
  uuid,
  uuid[],
  uuid,
  date,
  date
)
from public, anon;

revoke all
on function public.update_supervisor_assignment(
  uuid,
  uuid,
  date,
  date,
  boolean
)
from public, anon;

grant execute
on function public.create_supervisor_assignments(
  uuid,
  uuid[],
  uuid,
  date,
  date
)
to authenticated;

grant execute
on function public.update_supervisor_assignment(
  uuid,
  uuid,
  date,
  date,
  boolean
)
to authenticated;

commit;
