begin;

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
  requested_active boolean;
begin
  requested_active :=
    coalesce(active_value, true);

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

  /*
   * El turno necesita permanecer activo solamente
   * cuando la asignación será activada.
   *
   * Esto permite desactivar asignaciones históricas
   * aunque el turno ya haya sido desactivado.
   */
  if requested_active
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

  update public.supervisor_assignments
  set
    shift_id =
      shift_id_value,

    effective_from =
      effective_from_value,

    effective_to =
      effective_to_value,

    active =
      requested_active,

    updated_at =
      pg_catalog.now()
  where id =
        assignment_id_value;
end;
$$;

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
on function public.update_supervisor_assignment(
  uuid,
  uuid,
  date,
  date,
  boolean
)
to authenticated;

commit;
