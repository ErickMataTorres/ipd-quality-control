begin;

-- =========================================================
-- PRODUCTION LINE OVERVIEW
-- =========================================================

drop view if exists public.production_line_overview;

create view public.production_line_overview
with (security_invoker = true)
as
select
  production_line.id,
  production_line.plant_id,
  plant.code as plant_code,
  plant.name as plant_name,
  production_line.name,
  production_line.description,
  production_line.display_order,
  production_line.active,
  production_line.created_at,
  production_line.updated_at,

  current_assignment.id as line_model_assignment_id,
  current_assignment.product_model_id,
  product_model.name as product_model_name,
  product_model.model_year,
  current_assignment.effective_from as model_effective_from,
  current_assignment.effective_to as model_effective_to
from public.production_lines as production_line
join public.plants as plant
  on plant.id = production_line.plant_id
left join lateral (
  select assignment.*
  from public.line_model_assignments as assignment
  where assignment.production_line_id = production_line.id
    and assignment.active = true
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
  order by assignment.effective_from desc
  limit 1
) as current_assignment
  on true
left join public.product_models as product_model
  on product_model.id =
     current_assignment.product_model_id;

grant select
on public.production_line_overview
to authenticated;

-- =========================================================
-- SUPPORTING INDEX
-- =========================================================

create index if not exists
  line_model_assignments_current_idx
on public.line_model_assignments (
  production_line_id,
  effective_from desc,
  effective_to
)
where active = true;

-- =========================================================
-- TRANSACTIONAL SAVE FUNCTION
-- =========================================================

create or replace function public.save_production_line(
  line_id_value uuid,
  plant_id_value uuid,
  line_name_value text,
  description_value text,
  display_order_value integer,
  product_model_id_value uuid,
  effective_from_value date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_line_id uuid;
  original_plant_id uuid;

  current_assignment_id uuid;
  current_assignment_model_id uuid;
  current_assignment_start date;
  assignment_found boolean := false;

  next_assignment_start date;
begin
  if not private.is_quality_manager_or_administrator() then
    raise exception
      'The current user cannot manage production lines.'
      using errcode = '42501';
  end if;

  if plant_id_value is null then
    raise exception 'Plant is required.'
      using errcode = '22023';
  end if;

  if line_name_value is null
     or length(pg_catalog.btrim(line_name_value)) = 0 then
    raise exception 'Production line name is required.'
      using errcode = '22023';
  end if;

  if length(pg_catalog.btrim(line_name_value)) > 120 then
    raise exception
      'Production line name cannot exceed 120 characters.'
      using errcode = '22023';
  end if;

  if display_order_value is null
     or display_order_value < 0 then
    raise exception
      'Display order must be zero or greater.'
      using errcode = '22023';
  end if;

  if product_model_id_value is null then
    raise exception 'Product model is required.'
      using errcode = '22023';
  end if;

  if effective_from_value is null then
    raise exception 'Effective date is required.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.plants as plant
    where plant.id = plant_id_value
      and plant.active = true
  ) then
    raise exception
      'The selected plant does not exist or is inactive.'
      using errcode = '22023';
  end if;

  if not private.has_plant_access(plant_id_value) then
    raise exception
      'The current user cannot access the selected plant.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.product_models as product_model
    where product_model.id = product_model_id_value
      and product_model.active = true
  ) then
    raise exception
      'The selected product model does not exist or is inactive.'
      using errcode = '22023';
  end if;

  if line_id_value is null then
    insert into public.production_lines (
      plant_id,
      name,
      description,
      display_order,
      active
    )
    values (
      plant_id_value,
      pg_catalog.btrim(line_name_value),
      nullif(
        pg_catalog.btrim(description_value),
        ''
      ),
      display_order_value,
      true
    )
    returning id
    into saved_line_id;
  else
    select production_line.plant_id
    into original_plant_id
    from public.production_lines as production_line
    where production_line.id = line_id_value
    for update;

    if not found then
      raise exception 'Production line was not found.'
        using errcode = 'P0002';
    end if;

    if not private.has_plant_access(original_plant_id) then
      raise exception
        'The current user cannot access the original plant.'
        using errcode = '42501';
    end if;

    update public.production_lines
    set
      plant_id = plant_id_value,
      name = pg_catalog.btrim(line_name_value),
      description = nullif(
        pg_catalog.btrim(description_value),
        ''
      ),
      display_order = display_order_value
    where id = line_id_value
    returning id
    into saved_line_id;
  end if;

  select
    assignment.id,
    assignment.product_model_id,
    assignment.effective_from
  into
    current_assignment_id,
    current_assignment_model_id,
    current_assignment_start
  from public.line_model_assignments as assignment
  where assignment.production_line_id = saved_line_id
    and assignment.active = true
    and assignment.effective_from <= effective_from_value
    and (
      assignment.effective_to is null
      or assignment.effective_to >= effective_from_value
    )
  order by assignment.effective_from desc
  limit 1
  for update;

  assignment_found := found;

  if assignment_found
     and current_assignment_model_id =
         product_model_id_value then
    return saved_line_id;
  end if;

  if assignment_found then
    if current_assignment_start =
       effective_from_value then
      update public.line_model_assignments
      set
        product_model_id =
          product_model_id_value,
        active = true
      where id = current_assignment_id;

      return saved_line_id;
    end if;

    update public.line_model_assignments
    set effective_to =
      effective_from_value - 1
    where id = current_assignment_id;
  end if;

  select min(assignment.effective_from)
  into next_assignment_start
  from public.line_model_assignments as assignment
  where assignment.production_line_id = saved_line_id
    and assignment.active = true
    and assignment.effective_from >
        effective_from_value;

  insert into public.line_model_assignments (
    production_line_id,
    product_model_id,
    effective_from,
    effective_to,
    active
  )
  values (
    saved_line_id,
    product_model_id_value,
    effective_from_value,
    case
      when next_assignment_start is null
        then null
      else next_assignment_start - 1
    end,
    true
  );

  return saved_line_id;
end;
$$;

revoke all
on function public.save_production_line(
  uuid,
  uuid,
  text,
  text,
  integer,
  uuid,
  date
)
from public, anon;

grant execute
on function public.save_production_line(
  uuid,
  uuid,
  text,
  text,
  integer,
  uuid,
  date
)
to authenticated;

commit;
