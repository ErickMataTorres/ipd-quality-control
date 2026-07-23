begin;

-- =========================================================
-- LIVE OPERATION BOARD
--
-- Returns one row per active line/model and shift for a plant.
-- When shift_id_value is null, all active shifts are returned.
-- Quality supervisors only receive rows assigned to them for
-- the selected date. Managers and administrators receive all
-- accessible rows.
-- =========================================================

create or replace function
public.get_live_operation_board(
  plant_id_value uuid,
  production_date_value date,
  shift_id_value uuid default null
)
returns table (
  line_model_assignment_id uuid,

  production_line_id uuid,
  production_line_name text,
  display_order integer,

  plant_id uuid,
  plant_code text,
  plant_name text,

  product_model_id uuid,
  product_model_name text,
  model_year smallint,

  shift_id uuid,
  shift_code text,
  shift_name text,

  assigned_supervisors jsonb,
  current_user_is_assigned boolean,

  target_id uuid,
  target_percentage numeric,

  record_id uuid,
  supervisor_employee_id uuid,
  supervisor_employee_number text,
  supervisor_name text,

  produced_quantity integer,
  defective_harness_quantity integer,
  total_defects integer,
  ipd_percentage numeric,
  is_within_target boolean,

  defect_type_count integer,
  top_defect_type_id uuid,
  top_defect_type_code text,
  top_defect_type_name text,
  top_defect_quantity integer,

  comment text,
  status public.ipd_record_status,
  version integer,

  submitted_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz,

  monthly_produced_quantity bigint,
  monthly_total_defects bigint,
  monthly_ipd_percentage numeric,
  monthly_record_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with request_context as (
    select
      private.current_app_role()
        as current_role,

      private.current_employee_id()
        as current_employee_id,

      date_trunc(
        'month',
        production_date_value::timestamp
      )::date
        as month_start,

      (
        date_trunc(
          'month',
          production_date_value::timestamp
        )
        + interval '1 month'
      )::date
        as next_month_start
  )
  select
    assignment.id
      as line_model_assignment_id,

    line.id
      as production_line_id,

    line.name
      as production_line_name,

    line.display_order,

    plant.id
      as plant_id,

    plant.code
      as plant_code,

    plant.name
      as plant_name,

    model.id
      as product_model_id,

    model.name
      as product_model_name,

    model.model_year,

    shift.id
      as shift_id,

    shift.code
      as shift_code,

    shift.name
      as shift_name,

    coalesce(
      supervisors.assigned_supervisors,
      '[]'::jsonb
    ) as assigned_supervisors,

    exists (
      select 1
      from public.supervisor_assignments
        as own_assignment
      cross join request_context
      where own_assignment
              .supervisor_employee_id =
            request_context
              .current_employee_id
        and own_assignment
              .line_model_assignment_id =
            assignment.id
        and own_assignment.shift_id =
            shift.id
        and own_assignment.active = true
        and own_assignment.effective_from <=
            production_date_value
        and (
          own_assignment.effective_to is null
          or own_assignment.effective_to >=
             production_date_value
        )
    ) as current_user_is_assigned,

    coalesce(
      record.target_id,
      selected_target.id
    ) as target_id,

    coalesce(
      record.target_percentage,
      selected_target.target_percentage
    ) as target_percentage,

    record.id
      as record_id,

    record.supervisor_employee_id,

    record_supervisor.employee_number
      as supervisor_employee_number,

    record_supervisor.full_name
      as supervisor_name,

    record.produced_quantity,
    record.defective_harness_quantity,
    record.total_defects,
    record.ipd_percentage,

    case
      when record.ipd_percentage is null
        or record.target_percentage is null
        then null
      else record.ipd_percentage
           <= record.target_percentage
    end as is_within_target,

    coalesce(
      defect_summary.defect_type_count,
      0
    ) as defect_type_count,

    defect_summary.top_defect_type_id,
    defect_summary.top_defect_type_code,
    defect_summary.top_defect_type_name,
    defect_summary.top_defect_quantity,

    record.comment,
    record.status,
    record.version,

    record.submitted_at,
    record.closed_at,
    record.updated_at,

    coalesce(
      monthly.monthly_produced_quantity,
      0
    ) as monthly_produced_quantity,

    coalesce(
      monthly.monthly_total_defects,
      0
    ) as monthly_total_defects,

    monthly.monthly_ipd_percentage,

    coalesce(
      monthly.monthly_record_count,
      0
    ) as monthly_record_count

  from public.line_model_assignments
    as assignment

  join public.production_lines
    as line
    on line.id =
       assignment.production_line_id

  join public.plants
    as plant
    on plant.id =
       line.plant_id

  join public.product_models
    as model
    on model.id =
       assignment.product_model_id

  cross join public.shifts
    as shift

  cross join request_context

  left join lateral (
    select
      jsonb_agg(
        jsonb_build_object(
          'employeeId',
          employee.id,
          'employeeNumber',
          employee.employee_number,
          'fullName',
          employee.full_name,
          'photoPath',
          employee.photo_path
        )
        order by employee.full_name
      ) as assigned_supervisors

    from public.supervisor_assignments
      as supervisor_assignment

    join public.employees
      as employee
      on employee.id =
         supervisor_assignment
           .supervisor_employee_id

    where supervisor_assignment
            .line_model_assignment_id =
          assignment.id
      and supervisor_assignment.shift_id =
          shift.id
      and supervisor_assignment.active = true
      and employee.active = true
      and supervisor_assignment.effective_from <=
          production_date_value
      and (
        supervisor_assignment.effective_to is null
        or supervisor_assignment.effective_to >=
           production_date_value
      )
  ) as supervisors
    on true

  left join lateral (
    select
      target.id,
      target.target_percentage

    from public.ipd_targets
      as target

    where target.line_model_assignment_id =
          assignment.id
      and target.active = true
      and (
        target.shift_id = shift.id
        or target.shift_id is null
      )
      and target.effective_from <=
          production_date_value
      and (
        target.effective_to is null
        or target.effective_to >=
           production_date_value
      )

    order by
      case
        when target.shift_id = shift.id
          then 0
        else 1
      end,
      target.effective_from desc

    limit 1
  ) as selected_target
    on true

  left join public.daily_ipd_records
    as record
    on record.production_date =
       production_date_value
   and record.line_model_assignment_id =
       assignment.id
   and record.shift_id =
       shift.id

  left join public.employees
    as record_supervisor
    on record_supervisor.id =
       record.supervisor_employee_id

  left join lateral (
    select
      count(*)::integer
        as defect_type_count,

      top_defect.defect_type_id
        as top_defect_type_id,

      top_defect.defect_type_code
        as top_defect_type_code,

      top_defect.defect_type_name
        as top_defect_type_name,

      top_defect.quantity
        as top_defect_quantity

    from public.daily_ipd_defects
      as detail

    left join lateral (
      select
        ranked_detail.defect_type_id,

        defect_type.code
          as defect_type_code,

        defect_type.name_es
          as defect_type_name,

        ranked_detail.quantity

      from public.daily_ipd_defects
        as ranked_detail

      join public.defect_types
        as defect_type
        on defect_type.id =
           ranked_detail.defect_type_id

      where ranked_detail.daily_ipd_record_id =
            record.id

      order by
        ranked_detail.quantity desc,
        defect_type.display_order,
        defect_type.name_es

      limit 1
    ) as top_defect
      on true

    where detail.daily_ipd_record_id =
          record.id

    group by
      top_defect.defect_type_id,
      top_defect.defect_type_code,
      top_defect.defect_type_name,
      top_defect.quantity
  ) as defect_summary
    on true

  left join lateral (
    select
      coalesce(
        sum(month_record.produced_quantity),
        0
      )::bigint
        as monthly_produced_quantity,

      coalesce(
        sum(month_record.total_defects),
        0
      )::bigint
        as monthly_total_defects,

      case
        when sum(
          month_record.produced_quantity
        ) > 0 then
          round(
            (
              sum(
                month_record.total_defects
              )::numeric
              /
              sum(
                month_record.produced_quantity
              )::numeric
            ) * 100,
            4
          )
        else null
      end
        as monthly_ipd_percentage,

      count(*)::bigint
        as monthly_record_count

    from public.daily_ipd_records
      as month_record

    where month_record
            .line_model_assignment_id =
          assignment.id
      and month_record.shift_id =
          shift.id
      and month_record.production_date >=
          request_context.month_start
      and month_record.production_date <
          request_context.next_month_start
      and month_record.status in (
        'submitted'::public.ipd_record_status,
        'closed'::public.ipd_record_status
      )
  ) as monthly
    on true

  where private.is_active_user()
    and plant.id =
        plant_id_value
    and private.has_plant_access(
      plant.id
    )
    and plant.active = true
    and line.active = true
    and model.active = true
    and shift.active = true
    and (
      shift_id_value is null
      or shift.id = shift_id_value
    )
    and assignment.active = true
    and assignment.effective_from <=
        production_date_value
    and (
      assignment.effective_to is null
      or assignment.effective_to >=
         production_date_value
    )
    and (
      request_context.current_role
        is distinct from
        'quality_supervisor'::public.app_role

      or exists (
        select 1
        from public.supervisor_assignments
          as visible_assignment

        where visible_assignment
                .supervisor_employee_id =
              request_context
                .current_employee_id
          and visible_assignment
                .line_model_assignment_id =
              assignment.id
          and visible_assignment.shift_id =
              shift.id
          and visible_assignment.active = true
          and visible_assignment.effective_from <=
              production_date_value
          and (
            visible_assignment.effective_to is null
            or visible_assignment.effective_to >=
               production_date_value
          )
      )
    )

  order by
    shift.code,
    line.display_order,
    line.name,
    model.name;
$$;

revoke all
on function public.get_live_operation_board(
  uuid,
  date,
  uuid
)
from public, anon;

grant execute
on function public.get_live_operation_board(
  uuid,
  date,
  uuid
)
to authenticated;

commit;
