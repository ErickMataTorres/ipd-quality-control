begin;

create extension if not exists btree_gist
with schema extensions;

alter table public.ipd_targets
  drop constraint if exists ipd_targets_no_overlap;

alter table public.ipd_targets
  add constraint ipd_targets_no_overlap
  exclude using gist (
    line_model_assignment_id with =,
    (
      coalesce(
        shift_id,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    ) with =,
    daterange(
      effective_from,
      coalesce(effective_to, 'infinity'::date),
      '[]'
    ) with &&
  )
  where (active);

create index if not exists
  ipd_targets_current_lookup_idx
on public.ipd_targets (
  line_model_assignment_id,
  shift_id,
  effective_from,
  effective_to
)
where active = true;

drop view if exists public.ipd_target_overview;

create view public.ipd_target_overview
with (security_invoker = true)
as
select
  target.id,
  target.line_model_assignment_id,
  production_line.id as production_line_id,
  production_line.name as production_line_name,
  production_line.display_order,
  plant.id as plant_id,
  plant.code as plant_code,
  plant.name as plant_name,
  line_model_assignment.product_model_id,
  product_model.name as product_model_name,
  product_model.model_year,
  target.shift_id,
  shift.code as shift_code,
  shift.name as shift_name,
  target.target_percentage,
  target.effective_from,
  target.effective_to,
  target.active,
  (target.shift_id is null) as is_general_target,
  (
    target.active
    and target.effective_from <=
      (pg_catalog.now() at time zone plant.timezone)::date
    and (
      target.effective_to is null
      or target.effective_to >=
        (pg_catalog.now() at time zone plant.timezone)::date
    )
  ) as is_current,
  target.created_at,
  target.updated_at
from public.ipd_targets as target
join public.line_model_assignments as line_model_assignment
  on line_model_assignment.id = target.line_model_assignment_id
join public.production_lines as production_line
  on production_line.id = line_model_assignment.production_line_id
join public.plants as plant
  on plant.id = production_line.plant_id
join public.product_models as product_model
  on product_model.id = line_model_assignment.product_model_id
left join public.shifts as shift
  on shift.id = target.shift_id;

grant select
on public.ipd_target_overview
to authenticated;

create or replace function public.save_ipd_target(
  target_id_value uuid,
  line_model_assignment_id_value uuid,
  shift_id_value uuid,
  target_percentage_value numeric,
  effective_from_value date,
  effective_to_value date,
  active_value boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_target_id uuid;
  target_plant_id uuid;
  original_assignment_id uuid;
begin
  if not private.is_quality_manager_or_administrator() then
    raise exception
      'The current user cannot manage IPD targets.'
      using errcode = '42501';
  end if;

  if line_model_assignment_id_value is null then
    raise exception
      'Production line and model assignment are required.'
      using errcode = '22023';
  end if;

  if target_percentage_value is null
     or target_percentage_value < 0 then
    raise exception
      'IPD target must be zero or greater.'
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
  into target_plant_id
  from public.line_model_assignments as line_model_assignment
  join public.production_lines as production_line
    on production_line.id =
       line_model_assignment.production_line_id
  join public.plants as plant
    on plant.id = production_line.plant_id
  join public.product_models as product_model
    on product_model.id =
       line_model_assignment.product_model_id
  where line_model_assignment.id =
        line_model_assignment_id_value
    and line_model_assignment.active = true
    and production_line.active = true
    and plant.active = true
    and product_model.active = true;

  if not found then
    raise exception
      'The selected line/model assignment does not exist or is inactive.'
      using errcode = '22023';
  end if;

  if not private.has_plant_access(target_plant_id) then
    raise exception
      'The current user cannot access the selected plant.'
      using errcode = '42501';
  end if;

  if shift_id_value is not null
     and not exists (
       select 1
       from public.shifts as shift
       where shift.id = shift_id_value
         and shift.active = true
     ) then
    raise exception
      'The selected shift does not exist or is inactive.'
      using errcode = '22023';
  end if;

  if target_id_value is null then
    insert into public.ipd_targets (
      line_model_assignment_id,
      shift_id,
      target_percentage,
      effective_from,
      effective_to,
      active
    )
    values (
      line_model_assignment_id_value,
      shift_id_value,
      target_percentage_value,
      effective_from_value,
      effective_to_value,
      coalesce(active_value, true)
    )
    returning id
    into saved_target_id;

    return saved_target_id;
  end if;

  select target.line_model_assignment_id
  into original_assignment_id
  from public.ipd_targets as target
  where target.id = target_id_value
  for update;

  if not found then
    raise exception
      'IPD target was not found.'
      using errcode = 'P0002';
  end if;

  if not private.can_access_assignment(original_assignment_id) then
    raise exception
      'The current user cannot access the original IPD target.'
      using errcode = '42501';
  end if;

  update public.ipd_targets
  set
    line_model_assignment_id =
      line_model_assignment_id_value,
    shift_id = shift_id_value,
    target_percentage = target_percentage_value,
    effective_from = effective_from_value,
    effective_to = effective_to_value,
    active = coalesce(active_value, true),
    updated_at = pg_catalog.now()
  where id = target_id_value
  returning id
  into saved_target_id;

  return saved_target_id;
end;
$$;

revoke all
on function public.save_ipd_target(
  uuid,
  uuid,
  uuid,
  numeric,
  date,
  date,
  boolean
)
from public, anon;

grant execute
on function public.save_ipd_target(
  uuid,
  uuid,
  uuid,
  numeric,
  date,
  date,
  boolean
)
to authenticated;

commit;
