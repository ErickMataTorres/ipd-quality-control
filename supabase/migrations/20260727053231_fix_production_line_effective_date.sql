begin;

-- =========================================================
-- FIX PRODUCTION LINE EFFECTIVE DATE EDITING
--
-- The previous save_production_line implementation interpreted
-- effective_from_value only as the start of a new model period.
-- When the model stayed the same, moving the date backwards
-- created an additional historical row instead of updating the
-- current assignment shown in the interface.
--
-- This migration preserves the original implementation as a
-- private legacy function and exposes a wrapper with the same
-- public signature. The wrapper updates the current assignment
-- date when the selected model has not changed.
-- =========================================================

alter function public.save_production_line(
  uuid,
  uuid,
  text,
  text,
  integer,
  uuid,
  date
)
set schema private;

alter function private.save_production_line(
  uuid,
  uuid,
  text,
  text,
  integer,
  uuid,
  date
)
rename to save_production_line_legacy;

revoke all
on function private.save_production_line_legacy(
  uuid,
  uuid,
  text,
  text,
  integer,
  uuid,
  date
)
from public, anon, authenticated;

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

  current_assignment_id uuid;
  current_assignment_model_id uuid;
  current_assignment_start date;
  current_assignment_end date;

  current_assignment_found boolean := false;

  conflicting_assignment_id uuid;
  referenced_duplicate_id uuid;
begin
  -- For a new production line, or when no current assignment
  -- exists, keep the original transactional behavior.
  if line_id_value is not null then
    select
      assignment.id,
      assignment.product_model_id,
      assignment.effective_from,
      assignment.effective_to
    into
      current_assignment_id,
      current_assignment_model_id,
      current_assignment_start,
      current_assignment_end
    from public.line_model_assignments as assignment
    join public.production_lines as production_line
      on production_line.id =
         assignment.production_line_id
    join public.plants as plant
      on plant.id =
         production_line.plant_id
    where assignment.production_line_id =
          line_id_value
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
    order by
      assignment.effective_from desc
    limit 1
    for update;

    current_assignment_found := found;
  end if;

  if current_assignment_found
    and current_assignment_model_id =
        product_model_id_value
  then
    -- First execute the original function with the unchanged
    -- assignment date. This keeps all existing validations,
    -- authorization checks and production-line updates.
    saved_line_id :=
      private.save_production_line_legacy(
        line_id_value,
        plant_id_value,
        line_name_value,
        description_value,
        display_order_value,
        product_model_id_value,
        current_assignment_start
      );

    if effective_from_value =
       current_assignment_start
    then
      return saved_line_id;
    end if;

    -- =======================================================
    -- MOVING THE CURRENT START DATE BACKWARDS
    -- =======================================================
    if effective_from_value <
       current_assignment_start
    then
      -- A different model cannot be overwritten silently.
      select assignment.id
      into conflicting_assignment_id
      from public.line_model_assignments as assignment
      where assignment.production_line_id =
            saved_line_id
        and assignment.id <>
            current_assignment_id
        and assignment.active = true
        and assignment.product_model_id <>
            current_assignment_model_id
        and pg_catalog.daterange(
              assignment.effective_from,
              coalesce(
                assignment.effective_to,
                'infinity'::date
              ),
              '[]'
            )
            &&
            pg_catalog.daterange(
              effective_from_value,
              current_assignment_start - 1,
              '[]'
            )
      limit 1;

      if conflicting_assignment_id
         is not null
      then
        raise exception
          'The effective date overlaps a period assigned to a different model.'
          using errcode = 'P2101';
      end if;

      -- A previous same-model row can be merged only when it is
      -- fully contained in the period being absorbed. This also
      -- removes rows accidentally created by the old behavior.
      select assignment.id
      into conflicting_assignment_id
      from public.line_model_assignments as assignment
      where assignment.production_line_id =
            saved_line_id
        and assignment.id <>
            current_assignment_id
        and assignment.active = true
        and assignment.product_model_id =
            current_assignment_model_id
        and pg_catalog.daterange(
              assignment.effective_from,
              coalesce(
                assignment.effective_to,
                'infinity'::date
              ),
              '[]'
            )
            &&
            pg_catalog.daterange(
              effective_from_value,
              current_assignment_start - 1,
              '[]'
            )
        and not (
          assignment.effective_from >=
            effective_from_value
          and assignment.effective_to <=
            current_assignment_start - 1
        )
      limit 1;

      if conflicting_assignment_id
         is not null
      then
        raise exception
          'The requested date intersects an existing historical period that cannot be merged automatically.'
          using errcode = 'P2102';
      end if;

      -- Do not delete a duplicate period if another business
      -- record already references it.
      select assignment.id
      into referenced_duplicate_id
      from public.line_model_assignments as assignment
      where assignment.production_line_id =
            saved_line_id
        and assignment.id <>
            current_assignment_id
        and assignment.active = true
        and assignment.product_model_id =
            current_assignment_model_id
        and assignment.effective_from >=
            effective_from_value
        and assignment.effective_to <=
            current_assignment_start - 1
        and (
          exists (
            select 1
            from public.supervisor_assignments
              as supervisor_assignment
            where supervisor_assignment
                    .line_model_assignment_id =
                  assignment.id
          )
          or exists (
            select 1
            from public.ipd_targets
              as target
            where target.line_model_assignment_id =
                  assignment.id
          )
          or exists (
            select 1
            from public.daily_ipd_records
              as daily_record
            where daily_record
                    .line_model_assignment_id =
                  assignment.id
          )
        )
      limit 1;

      if referenced_duplicate_id
         is not null
      then
        raise exception
          'A historical period that would be merged is already referenced by operational records.'
          using errcode = 'P2103';
      end if;

      -- Remove unreferenced adjacent/contained same-model rows,
      -- including the row produced by the former bug.
      delete from public.line_model_assignments
      where production_line_id =
            saved_line_id
        and id <>
            current_assignment_id
        and active = true
        and product_model_id =
            current_assignment_model_id
        and effective_from >=
            effective_from_value
        and effective_to <=
            current_assignment_start - 1;

    -- =======================================================
    -- MOVING THE CURRENT START DATE FORWARDS
    -- =======================================================
    else
      if current_assignment_end is not null
        and effective_from_value >
            current_assignment_end
      then
        raise exception
          'The effective date cannot be later than the end of the current model period.'
          using errcode = 'P2104';
      end if;

      -- Moving the date forward cannot leave existing records
      -- outside the period to which they belong.
      if exists (
        select 1
        from public.daily_ipd_records
          as daily_record
        where daily_record
                .line_model_assignment_id =
              current_assignment_id
          and daily_record.production_date <
              effective_from_value
      )
      or exists (
        select 1
        from public.supervisor_assignments
          as supervisor_assignment
        where supervisor_assignment
                .line_model_assignment_id =
              current_assignment_id
          and supervisor_assignment.effective_from <
              effective_from_value
      )
      or exists (
        select 1
        from public.ipd_targets
          as target
        where target.line_model_assignment_id =
              current_assignment_id
          and target.effective_from <
              effective_from_value
      )
      then
        raise exception
          'The effective date cannot be moved forward because operational records already exist before the requested date.'
          using errcode = 'P2105';
      end if;
    end if;

    update public.line_model_assignments
    set effective_from =
          effective_from_value
    where id =
          current_assignment_id;

    return saved_line_id;
  end if;

  -- Model changes continue using the original history-preserving
  -- implementation.
  return private.save_production_line_legacy(
    line_id_value,
    plant_id_value,
    line_name_value,
    description_value,
    display_order_value,
    product_model_id_value,
    effective_from_value
  );
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
