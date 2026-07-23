begin;

create or replace function
public.get_dashboard_summary(
  plant_id_value uuid,
  production_date_value date,
  shift_id_value uuid default null
)
returns table (
  total_combinations bigint,
  reported_combinations bigint,
  pending_combinations bigint,
  within_target_combinations bigint,
  outside_target_combinations bigint,
  produced_quantity bigint,
  defective_harness_quantity bigint,
  total_defects bigint,
  ipd_percentage numeric,
  completion_percentage numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with board as (
    select *
    from public.get_live_operation_board(
      plant_id_value,
      production_date_value,
      shift_id_value
    )
  ),
  totals as (
    select
      count(*)::bigint as total_combinations,

      count(*) filter (
        where status in (
          'submitted'::public.ipd_record_status,
          'closed'::public.ipd_record_status,
          'no_production'::public.ipd_record_status
        )
      )::bigint as reported_combinations,

      count(*) filter (
        where record_id is null
           or status = 'draft'::public.ipd_record_status
      )::bigint as pending_combinations,

      count(*) filter (
        where status in (
          'submitted'::public.ipd_record_status,
          'closed'::public.ipd_record_status
        )
          and is_within_target = true
      )::bigint as within_target_combinations,

      count(*) filter (
        where status in (
          'submitted'::public.ipd_record_status,
          'closed'::public.ipd_record_status
        )
          and is_within_target = false
      )::bigint as outside_target_combinations,

      coalesce(
        sum(produced_quantity) filter (
          where status in (
            'submitted'::public.ipd_record_status,
            'closed'::public.ipd_record_status,
            'no_production'::public.ipd_record_status
          )
        ),
        0
      )::bigint as produced_quantity,

      coalesce(
        sum(defective_harness_quantity) filter (
          where status in (
            'submitted'::public.ipd_record_status,
            'closed'::public.ipd_record_status,
            'no_production'::public.ipd_record_status
          )
        ),
        0
      )::bigint as defective_harness_quantity,

      coalesce(
        sum(total_defects) filter (
          where status in (
            'submitted'::public.ipd_record_status,
            'closed'::public.ipd_record_status,
            'no_production'::public.ipd_record_status
          )
        ),
        0
      )::bigint as total_defects

    from board
  )
  select
    totals.total_combinations,
    totals.reported_combinations,
    totals.pending_combinations,
    totals.within_target_combinations,
    totals.outside_target_combinations,
    totals.produced_quantity,
    totals.defective_harness_quantity,
    totals.total_defects,

    case
      when totals.produced_quantity > 0 then
        round(
          (
            totals.total_defects::numeric
            /
            totals.produced_quantity::numeric
          ) * 100,
          4
        )
      else null
    end as ipd_percentage,

    case
      when totals.total_combinations > 0 then
        round(
          (
            totals.reported_combinations::numeric
            /
            totals.total_combinations::numeric
          ) * 100,
          2
        )
      else 0::numeric
    end as completion_percentage

  from totals;
$$;

revoke all
on function public.get_dashboard_summary(
  uuid,
  date,
  uuid
)
from public, anon;

grant execute
on function public.get_dashboard_summary(
  uuid,
  date,
  uuid
)
to authenticated;

create or replace function
public.get_dashboard_daily_trend(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null
)
returns table (
  production_date date,
  produced_quantity bigint,
  defective_harness_quantity bigint,
  total_defects bigint,
  ipd_percentage numeric,
  reported_records bigint,
  within_target_records bigint,
  outside_target_records bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with request_context as (
    select
      private.current_app_role() as current_role,
      private.current_employee_id() as current_employee_id
  ),
  days as (
    select
      generated_day::date as production_date
    from pg_catalog.generate_series(
      date_from_value::timestamp,
      least(
        date_to_value,
        date_from_value + 365
      )::timestamp,
      interval '1 day'
    ) as generated_day
    where date_to_value >= date_from_value
  ),
  records_by_day as (
    select
      record.production_date,

      coalesce(
        sum(record.produced_quantity),
        0
      )::bigint as produced_quantity,

      coalesce(
        sum(record.defective_harness_quantity),
        0
      )::bigint as defective_harness_quantity,

      coalesce(
        sum(record.total_defects),
        0
      )::bigint as total_defects,

      count(*)::bigint as reported_records,

      count(*) filter (
        where record.status in (
          'submitted'::public.ipd_record_status,
          'closed'::public.ipd_record_status
        )
          and record.target_percentage is not null
          and record.ipd_percentage
              <= record.target_percentage
      )::bigint as within_target_records,

      count(*) filter (
        where record.status in (
          'submitted'::public.ipd_record_status,
          'closed'::public.ipd_record_status
        )
          and record.target_percentage is not null
          and record.ipd_percentage
              > record.target_percentage
      )::bigint as outside_target_records

    from public.daily_ipd_records as record

    join public.line_model_assignments as assignment
      on assignment.id =
         record.line_model_assignment_id

    join public.production_lines as line
      on line.id =
         assignment.production_line_id

    cross join request_context

    where private.is_active_user()
      and line.plant_id =
          plant_id_value
      and private.has_plant_access(
        line.plant_id
      )
      and record.production_date between
          date_from_value
          and least(
            date_to_value,
            date_from_value + 365
          )
      and (
        shift_id_value is null
        or record.shift_id =
           shift_id_value
      )
      and record.status in (
        'submitted'::public.ipd_record_status,
        'closed'::public.ipd_record_status,
        'no_production'::public.ipd_record_status
      )
      and (
        request_context.current_role
          is distinct from
          'quality_supervisor'::public.app_role

        or exists (
          select 1
          from public.supervisor_assignments
            as supervisor_assignment
          where supervisor_assignment
                  .supervisor_employee_id =
                request_context.current_employee_id
            and supervisor_assignment
                  .line_model_assignment_id =
                record.line_model_assignment_id
            and supervisor_assignment.shift_id =
                record.shift_id
            and supervisor_assignment.active = true
            and supervisor_assignment.effective_from <=
                record.production_date
            and (
              supervisor_assignment.effective_to is null
              or supervisor_assignment.effective_to >=
                 record.production_date
            )
        )
      )

    group by
      record.production_date
  )
  select
    days.production_date,

    coalesce(
      records_by_day.produced_quantity,
      0
    )::bigint as produced_quantity,

    coalesce(
      records_by_day.defective_harness_quantity,
      0
    )::bigint as defective_harness_quantity,

    coalesce(
      records_by_day.total_defects,
      0
    )::bigint as total_defects,

    case
      when coalesce(
        records_by_day.produced_quantity,
        0
      ) > 0 then
        round(
          (
            records_by_day.total_defects::numeric
            /
            records_by_day.produced_quantity::numeric
          ) * 100,
          4
        )
      else null
    end as ipd_percentage,

    coalesce(
      records_by_day.reported_records,
      0
    )::bigint as reported_records,

    coalesce(
      records_by_day.within_target_records,
      0
    )::bigint as within_target_records,

    coalesce(
      records_by_day.outside_target_records,
      0
    )::bigint as outside_target_records

  from days

  left join records_by_day
    on records_by_day.production_date =
       days.production_date

  order by
    days.production_date;
$$;

revoke all
on function public.get_dashboard_daily_trend(
  uuid,
  date,
  date,
  uuid
)
from public, anon;

grant execute
on function public.get_dashboard_daily_trend(
  uuid,
  date,
  date,
  uuid
)
to authenticated;

create or replace function
public.get_dashboard_top_defects(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  result_limit_value integer default 5
)
returns table (
  defect_type_id uuid,
  defect_type_code text,
  defect_type_name text,
  defect_category text,
  quantity bigint,
  record_count bigint,
  percentage numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with request_context as (
    select
      private.current_app_role() as current_role,
      private.current_employee_id() as current_employee_id
  ),
  grouped_defects as (
    select
      defect_type.id as defect_type_id,
      defect_type.code as defect_type_code,
      defect_type.name_es as defect_type_name,
      defect_type.category as defect_category,
      sum(detail.quantity)::bigint as quantity,
      count(
        distinct detail.daily_ipd_record_id
      )::bigint as record_count

    from public.daily_ipd_defects as detail

    join public.defect_types as defect_type
      on defect_type.id =
         detail.defect_type_id

    join public.daily_ipd_records as record
      on record.id =
         detail.daily_ipd_record_id

    join public.line_model_assignments as assignment
      on assignment.id =
         record.line_model_assignment_id

    join public.production_lines as line
      on line.id =
         assignment.production_line_id

    cross join request_context

    where private.is_active_user()
      and line.plant_id =
          plant_id_value
      and private.has_plant_access(
        line.plant_id
      )
      and record.production_date between
          date_from_value
          and date_to_value
      and (
        shift_id_value is null
        or record.shift_id =
           shift_id_value
      )
      and record.status in (
        'submitted'::public.ipd_record_status,
        'closed'::public.ipd_record_status
      )
      and (
        request_context.current_role
          is distinct from
          'quality_supervisor'::public.app_role

        or exists (
          select 1
          from public.supervisor_assignments
            as supervisor_assignment
          where supervisor_assignment
                  .supervisor_employee_id =
                request_context.current_employee_id
            and supervisor_assignment
                  .line_model_assignment_id =
                record.line_model_assignment_id
            and supervisor_assignment.shift_id =
                record.shift_id
            and supervisor_assignment.active = true
            and supervisor_assignment.effective_from <=
                record.production_date
            and (
              supervisor_assignment.effective_to is null
              or supervisor_assignment.effective_to >=
                 record.production_date
            )
        )
      )

    group by
      defect_type.id,
      defect_type.code,
      defect_type.name_es,
      defect_type.category
  ),
  ranked_defects as (
    select
      grouped_defects.*,
      sum(grouped_defects.quantity)
        over () as grand_total,
      row_number() over (
        order by
          grouped_defects.quantity desc,
          grouped_defects.defect_type_name
      ) as row_number_value
    from grouped_defects
  )
  select
    ranked_defects.defect_type_id,
    ranked_defects.defect_type_code,
    ranked_defects.defect_type_name,
    ranked_defects.defect_category,
    ranked_defects.quantity,
    ranked_defects.record_count,

    case
      when ranked_defects.grand_total > 0 then
        round(
          (
            ranked_defects.quantity::numeric
            /
            ranked_defects.grand_total::numeric
          ) * 100,
          2
        )
      else 0::numeric
    end as percentage

  from ranked_defects

  where ranked_defects.row_number_value <=
        greatest(
          1,
          least(
            coalesce(
              result_limit_value,
              5
            ),
            20
          )
        )

  order by
    ranked_defects.row_number_value;
$$;

revoke all
on function public.get_dashboard_top_defects(
  uuid,
  date,
  date,
  uuid,
  integer
)
from public, anon;

grant execute
on function public.get_dashboard_top_defects(
  uuid,
  date,
  date,
  uuid,
  integer
)
to authenticated;

create or replace function
public.get_dashboard_recent_alerts(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  result_limit_value integer default 5
)
returns table (
  record_id uuid,
  production_date date,
  production_line_name text,
  product_model_name text,
  model_year smallint,
  shift_code text,
  shift_name text,
  supervisor_employee_number text,
  supervisor_name text,
  produced_quantity integer,
  total_defects integer,
  ipd_percentage numeric,
  target_percentage numeric,
  target_difference numeric,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with request_context as (
    select
      private.current_app_role() as current_role,
      private.current_employee_id() as current_employee_id
  )
  select
    record.id as record_id,
    record.production_date,
    line.name as production_line_name,
    model.name as product_model_name,
    model.model_year,
    shift.code as shift_code,
    shift.name as shift_name,
    employee.employee_number as supervisor_employee_number,
    employee.full_name as supervisor_name,
    record.produced_quantity,
    record.total_defects,
    record.ipd_percentage,
    record.target_percentage,

    round(
      record.ipd_percentage
      - record.target_percentage,
      4
    ) as target_difference,

    record.updated_at

  from public.daily_ipd_records as record

  join public.line_model_assignments as assignment
    on assignment.id =
       record.line_model_assignment_id

  join public.production_lines as line
    on line.id =
       assignment.production_line_id

  join public.product_models as model
    on model.id =
       assignment.product_model_id

  join public.shifts as shift
    on shift.id =
       record.shift_id

  join public.employees as employee
    on employee.id =
       record.supervisor_employee_id

  cross join request_context

  where private.is_active_user()
    and line.plant_id =
        plant_id_value
    and private.has_plant_access(
      line.plant_id
    )
    and record.production_date between
        date_from_value
        and date_to_value
    and (
      shift_id_value is null
      or record.shift_id =
         shift_id_value
    )
    and record.status in (
      'submitted'::public.ipd_record_status,
      'closed'::public.ipd_record_status
    )
    and record.target_percentage is not null
    and record.ipd_percentage
        > record.target_percentage
    and (
      request_context.current_role
        is distinct from
        'quality_supervisor'::public.app_role

      or exists (
        select 1
        from public.supervisor_assignments
          as supervisor_assignment
        where supervisor_assignment
                .supervisor_employee_id =
              request_context.current_employee_id
          and supervisor_assignment
                .line_model_assignment_id =
              record.line_model_assignment_id
          and supervisor_assignment.shift_id =
              record.shift_id
          and supervisor_assignment.active = true
          and supervisor_assignment.effective_from <=
              record.production_date
          and (
            supervisor_assignment.effective_to is null
            or supervisor_assignment.effective_to >=
               record.production_date
          )
      )
    )

  order by
    record.production_date desc,
    (
      record.ipd_percentage
      - record.target_percentage
    ) desc,
    record.updated_at desc

  limit greatest(
    1,
    least(
      coalesce(
        result_limit_value,
        5
      ),
      20
    )
  );
$$;

revoke all
on function public.get_dashboard_recent_alerts(
  uuid,
  date,
  date,
  uuid,
  integer
)
from public, anon;

grant execute
on function public.get_dashboard_recent_alerts(
  uuid,
  date,
  date,
  uuid,
  integer
)
to authenticated;

commit;
