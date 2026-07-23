begin;

-- =========================================================
-- LINE PERFORMANCE OVERVIEW
-- One row per active line/model assignment for the month.
-- =========================================================

create or replace function
public.get_line_performance_overview(
  plant_id_value uuid,
  month_value date,
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
  produced_quantity bigint,
  defective_harness_quantity bigint,
  total_defects bigint,
  reported_records bigint,
  no_production_records bigint,
  within_target_records bigint,
  outside_target_records bigint,
  ipd_percentage numeric,
  configured_target_percentage numeric,
  weighted_target_percentage numeric,
  effective_target_percentage numeric,
  is_within_target boolean,
  compliance_percentage numeric,
  first_record_date date,
  last_record_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  with request_context as (
    select
      private.current_app_role() as current_role,
      private.current_employee_id() as current_employee_id,
      date_trunc(
        'month',
        month_value::timestamp
      )::date as month_start,
      (
        date_trunc(
          'month',
          month_value::timestamp
        )
        + interval '1 month'
      )::date as next_month_start
  ),
  visible_assignments as (
    select
      assignment.id as line_model_assignment_id,
      line.id as production_line_id,
      line.name as production_line_name,
      line.display_order,
      plant.id as plant_id,
      plant.code as plant_code,
      plant.name as plant_name,
      model.id as product_model_id,
      model.name as product_model_name,
      model.model_year

    from public.line_model_assignments as assignment

    join public.production_lines as line
      on line.id =
         assignment.production_line_id

    join public.plants as plant
      on plant.id =
         line.plant_id

    join public.product_models as model
      on model.id =
         assignment.product_model_id

    cross join request_context

    where private.is_active_user()
      and plant.id =
          plant_id_value
      and private.has_plant_access(
        plant.id
      )
      and plant.active = true
      and line.active = true
      and model.active = true
      and assignment.active = true
      and assignment.effective_from <
          request_context.next_month_start
      and (
        assignment.effective_to is null
        or assignment.effective_to >=
           request_context.month_start
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
                assignment.id
            and supervisor_assignment.active = true
            and supervisor_assignment.effective_from <
                request_context.next_month_start
            and (
              supervisor_assignment.effective_to is null
              or supervisor_assignment.effective_to >=
                 request_context.month_start
            )
            and (
              shift_id_value is null
              or supervisor_assignment.shift_id =
                 shift_id_value
            )
        )
      )
  )
  select
    visible_assignment.line_model_assignment_id,
    visible_assignment.production_line_id,
    visible_assignment.production_line_name,
    visible_assignment.display_order,
    visible_assignment.plant_id,
    visible_assignment.plant_code,
    visible_assignment.plant_name,
    visible_assignment.product_model_id,
    visible_assignment.product_model_name,
    visible_assignment.model_year,

    coalesce(
      monthly.produced_quantity,
      0
    )::bigint as produced_quantity,

    coalesce(
      monthly.defective_harness_quantity,
      0
    )::bigint as defective_harness_quantity,

    coalesce(
      monthly.total_defects,
      0
    )::bigint as total_defects,

    coalesce(
      monthly.reported_records,
      0
    )::bigint as reported_records,

    coalesce(
      monthly.no_production_records,
      0
    )::bigint as no_production_records,

    coalesce(
      monthly.within_target_records,
      0
    )::bigint as within_target_records,

    coalesce(
      monthly.outside_target_records,
      0
    )::bigint as outside_target_records,

    monthly.ipd_percentage,
    configured_target.target_percentage
      as configured_target_percentage,
    monthly.weighted_target_percentage,

    coalesce(
      monthly.weighted_target_percentage,
      configured_target.target_percentage
    ) as effective_target_percentage,

    case
      when monthly.ipd_percentage is null
        or coalesce(
          monthly.weighted_target_percentage,
          configured_target.target_percentage
        ) is null
        then null
      else monthly.ipd_percentage
           <= coalesce(
             monthly.weighted_target_percentage,
             configured_target.target_percentage
           )
    end as is_within_target,

    case
      when coalesce(
        monthly.within_target_records,
        0
      )
      + coalesce(
        monthly.outside_target_records,
        0
      ) > 0 then
        round(
          (
            coalesce(
              monthly.within_target_records,
              0
            )::numeric
            /
            (
              coalesce(
                monthly.within_target_records,
                0
              )
              + coalesce(
                monthly.outside_target_records,
                0
              )
            )::numeric
          ) * 100,
          2
        )
      else null
    end as compliance_percentage,

    monthly.first_record_date,
    monthly.last_record_date

  from visible_assignments
    as visible_assignment

  cross join request_context

  left join lateral (
    select
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
        where record.status =
              'no_production'::public.ipd_record_status
      )::bigint as no_production_records,

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
      )::bigint as outside_target_records,

      case
        when sum(record.produced_quantity) > 0 then
          round(
            (
              sum(record.total_defects)::numeric
              /
              sum(record.produced_quantity)::numeric
            ) * 100,
            4
          )
        else null
      end as ipd_percentage,

      case
        when coalesce(
          sum(record.produced_quantity) filter (
            where record.target_percentage is not null
              and record.produced_quantity > 0
          ),
          0
        ) > 0 then
          round(
            (
              sum(
                record.target_percentage
                * record.produced_quantity
              ) filter (
                where record.target_percentage is not null
                  and record.produced_quantity > 0
              )
              /
              sum(record.produced_quantity) filter (
                where record.target_percentage is not null
                  and record.produced_quantity > 0
              )
            ),
            4
          )
        else null
      end as weighted_target_percentage,

      min(record.production_date)
        as first_record_date,

      max(record.production_date)
        as last_record_date

    from public.daily_ipd_records as record

    where record.line_model_assignment_id =
          visible_assignment.line_model_assignment_id
      and record.production_date >=
          request_context.month_start
      and record.production_date <
          request_context.next_month_start
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
            as record_assignment

          where record_assignment
                  .supervisor_employee_id =
                request_context.current_employee_id
            and record_assignment
                  .line_model_assignment_id =
                record.line_model_assignment_id
            and record_assignment.shift_id =
                record.shift_id
            and record_assignment.active = true
            and record_assignment.effective_from <=
                record.production_date
            and (
              record_assignment.effective_to is null
              or record_assignment.effective_to >=
                 record.production_date
            )
        )
      )
  ) as monthly
    on true

  left join lateral (
    select
      target.target_percentage

    from public.ipd_targets as target

    where target.line_model_assignment_id =
          visible_assignment.line_model_assignment_id
      and target.active = true
      and (
        (
          shift_id_value is not null
          and (
            target.shift_id = shift_id_value
            or target.shift_id is null
          )
        )
        or (
          shift_id_value is null
          and target.shift_id is null
        )
      )
      and target.effective_from <=
          (
            request_context.next_month_start
            - 1
          )
      and (
        target.effective_to is null
        or target.effective_to >=
           request_context.month_start
      )

    order by
      case
        when target.shift_id =
             shift_id_value
          then 0
        else 1
      end,
      target.effective_from desc

    limit 1
  ) as configured_target
    on true

  order by
    visible_assignment.display_order,
    visible_assignment.production_line_name,
    visible_assignment.product_model_name;
$$;

revoke all
on function public.get_line_performance_overview(
  uuid,
  date,
  uuid
)
from public, anon;

grant execute
on function public.get_line_performance_overview(
  uuid,
  date,
  uuid
)
to authenticated;

-- =========================================================
-- DAILY LINE PERFORMANCE
-- Returns every calendar day in the selected month.
-- =========================================================

create or replace function
public.get_line_performance_daily(
  line_model_assignment_id_value uuid,
  month_value date,
  shift_id_value uuid default null
)
returns table (
  production_date date,
  produced_quantity bigint,
  defective_harness_quantity bigint,
  total_defects bigint,
  reported_records bigint,
  no_production_records bigint,
  within_target_records bigint,
  outside_target_records bigint,
  ipd_percentage numeric,
  target_percentage numeric,
  is_within_target boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with request_context as (
    select
      private.current_app_role() as current_role,
      private.current_employee_id() as current_employee_id,
      date_trunc(
        'month',
        month_value::timestamp
      )::date as month_start,
      (
        date_trunc(
          'month',
          month_value::timestamp
        )
        + interval '1 month'
      )::date as next_month_start
  ),
  authorized_assignment as (
    select
      assignment.id

    from public.line_model_assignments as assignment

    join public.production_lines as line
      on line.id =
         assignment.production_line_id

    cross join request_context

    where assignment.id =
          line_model_assignment_id_value
      and private.is_active_user()
      and private.has_plant_access(
        line.plant_id
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
                assignment.id
            and supervisor_assignment.active = true
            and supervisor_assignment.effective_from <
                request_context.next_month_start
            and (
              supervisor_assignment.effective_to is null
              or supervisor_assignment.effective_to >=
                 request_context.month_start
            )
            and (
              shift_id_value is null
              or supervisor_assignment.shift_id =
                 shift_id_value
            )
        )
      )
  ),
  days as (
    select
      generated_day::date as production_date

    from request_context

    cross join lateral
      pg_catalog.generate_series(
        request_context.month_start::timestamp,
        (
          request_context.next_month_start
          - 1
        )::timestamp,
        interval '1 day'
      ) as generated_day
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
        where record.status =
              'no_production'::public.ipd_record_status
      )::bigint as no_production_records,

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
      )::bigint as outside_target_records,

      case
        when sum(record.produced_quantity) > 0 then
          round(
            (
              sum(record.total_defects)::numeric
              /
              sum(record.produced_quantity)::numeric
            ) * 100,
            4
          )
        else null
      end as ipd_percentage,

      case
        when coalesce(
          sum(record.produced_quantity) filter (
            where record.target_percentage is not null
              and record.produced_quantity > 0
          ),
          0
        ) > 0 then
          round(
            (
              sum(
                record.target_percentage
                * record.produced_quantity
              ) filter (
                where record.target_percentage is not null
                  and record.produced_quantity > 0
              )
              /
              sum(record.produced_quantity) filter (
                where record.target_percentage is not null
                  and record.produced_quantity > 0
              )
            ),
            4
          )
        else null
      end as target_percentage

    from public.daily_ipd_records as record

    join authorized_assignment
      on authorized_assignment.id =
         record.line_model_assignment_id

    cross join request_context

    where record.production_date >=
          request_context.month_start
      and record.production_date <
          request_context.next_month_start
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
            as record_assignment

          where record_assignment
                  .supervisor_employee_id =
                request_context.current_employee_id
            and record_assignment
                  .line_model_assignment_id =
                record.line_model_assignment_id
            and record_assignment.shift_id =
                record.shift_id
            and record_assignment.active = true
            and record_assignment.effective_from <=
                record.production_date
            and (
              record_assignment.effective_to is null
              or record_assignment.effective_to >=
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

    coalesce(
      records_by_day.reported_records,
      0
    )::bigint as reported_records,

    coalesce(
      records_by_day.no_production_records,
      0
    )::bigint as no_production_records,

    coalesce(
      records_by_day.within_target_records,
      0
    )::bigint as within_target_records,

    coalesce(
      records_by_day.outside_target_records,
      0
    )::bigint as outside_target_records,

    records_by_day.ipd_percentage,
    records_by_day.target_percentage,

    case
      when records_by_day.ipd_percentage is null
        or records_by_day.target_percentage is null
        then null
      else records_by_day.ipd_percentage
           <= records_by_day.target_percentage
    end as is_within_target

  from days

  left join records_by_day
    on records_by_day.production_date =
       days.production_date

  order by
    days.production_date;
$$;

revoke all
on function public.get_line_performance_daily(
  uuid,
  date,
  uuid
)
from public, anon;

grant execute
on function public.get_line_performance_daily(
  uuid,
  date,
  uuid
)
to authenticated;

-- =========================================================
-- DEFECT DISTRIBUTION FOR A LINE
-- =========================================================

create or replace function
public.get_line_performance_defects(
  line_model_assignment_id_value uuid,
  month_value date,
  shift_id_value uuid default null,
  result_limit_value integer default 10
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
      private.current_employee_id() as current_employee_id,
      date_trunc(
        'month',
        month_value::timestamp
      )::date as month_start,
      (
        date_trunc(
          'month',
          month_value::timestamp
        )
        + interval '1 month'
      )::date as next_month_start
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

    where assignment.id =
          line_model_assignment_id_value
      and private.is_active_user()
      and private.has_plant_access(
        line.plant_id
      )
      and record.production_date >=
          request_context.month_start
      and record.production_date <
          request_context.next_month_start
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
            as record_assignment

          where record_assignment
                  .supervisor_employee_id =
                request_context.current_employee_id
            and record_assignment
                  .line_model_assignment_id =
                record.line_model_assignment_id
            and record_assignment.shift_id =
                record.shift_id
            and record_assignment.active = true
            and record_assignment.effective_from <=
                record.production_date
            and (
              record_assignment.effective_to is null
              or record_assignment.effective_to >=
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
              10
            ),
            30
          )
        )

  order by
    ranked_defects.row_number_value;
$$;

revoke all
on function public.get_line_performance_defects(
  uuid,
  date,
  uuid,
  integer
)
from public, anon;

grant execute
on function public.get_line_performance_defects(
  uuid,
  date,
  uuid,
  integer
)
to authenticated;

-- =========================================================
-- SHIFT BREAKDOWN FOR A LINE
-- =========================================================

create or replace function
public.get_line_performance_by_shift(
  line_model_assignment_id_value uuid,
  month_value date
)
returns table (
  shift_id uuid,
  shift_code text,
  shift_name text,
  display_order integer,
  produced_quantity bigint,
  defective_harness_quantity bigint,
  total_defects bigint,
  reported_records bigint,
  within_target_records bigint,
  outside_target_records bigint,
  ipd_percentage numeric,
  target_percentage numeric,
  is_within_target boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with request_context as (
    select
      private.current_app_role() as current_role,
      private.current_employee_id() as current_employee_id,
      date_trunc(
        'month',
        month_value::timestamp
      )::date as month_start,
      (
        date_trunc(
          'month',
          month_value::timestamp
        )
        + interval '1 month'
      )::date as next_month_start
  ),
  authorized_assignment as (
    select
      assignment.id

    from public.line_model_assignments as assignment

    join public.production_lines as line
      on line.id =
         assignment.production_line_id

    cross join request_context

    where assignment.id =
          line_model_assignment_id_value
      and private.is_active_user()
      and private.has_plant_access(
        line.plant_id
      )
  )
  select
    shift.id as shift_id,
    shift.code as shift_code,
    shift.name as shift_name,
    shift.display_order,

    coalesce(
      monthly.produced_quantity,
      0
    )::bigint as produced_quantity,

    coalesce(
      monthly.defective_harness_quantity,
      0
    )::bigint as defective_harness_quantity,

    coalesce(
      monthly.total_defects,
      0
    )::bigint as total_defects,

    coalesce(
      monthly.reported_records,
      0
    )::bigint as reported_records,

    coalesce(
      monthly.within_target_records,
      0
    )::bigint as within_target_records,

    coalesce(
      monthly.outside_target_records,
      0
    )::bigint as outside_target_records,

    monthly.ipd_percentage,

    coalesce(
      monthly.weighted_target_percentage,
      configured_target.target_percentage
    ) as target_percentage,

    case
      when monthly.ipd_percentage is null
        or coalesce(
          monthly.weighted_target_percentage,
          configured_target.target_percentage
        ) is null
        then null
      else monthly.ipd_percentage
           <= coalesce(
             monthly.weighted_target_percentage,
             configured_target.target_percentage
           )
    end as is_within_target

  from public.shifts as shift

  cross join authorized_assignment
  cross join request_context

  left join lateral (
    select
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
      )::bigint as outside_target_records,

      case
        when sum(record.produced_quantity) > 0 then
          round(
            (
              sum(record.total_defects)::numeric
              /
              sum(record.produced_quantity)::numeric
            ) * 100,
            4
          )
        else null
      end as ipd_percentage,

      case
        when coalesce(
          sum(record.produced_quantity) filter (
            where record.target_percentage is not null
              and record.produced_quantity > 0
          ),
          0
        ) > 0 then
          round(
            (
              sum(
                record.target_percentage
                * record.produced_quantity
              ) filter (
                where record.target_percentage is not null
                  and record.produced_quantity > 0
              )
              /
              sum(record.produced_quantity) filter (
                where record.target_percentage is not null
                  and record.produced_quantity > 0
              )
            ),
            4
          )
        else null
      end as weighted_target_percentage

    from public.daily_ipd_records as record

    where record.line_model_assignment_id =
          authorized_assignment.id
      and record.shift_id =
          shift.id
      and record.production_date >=
          request_context.month_start
      and record.production_date <
          request_context.next_month_start
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
            as record_assignment

          where record_assignment
                  .supervisor_employee_id =
                request_context.current_employee_id
            and record_assignment
                  .line_model_assignment_id =
                record.line_model_assignment_id
            and record_assignment.shift_id =
                record.shift_id
            and record_assignment.active = true
            and record_assignment.effective_from <=
                record.production_date
            and (
              record_assignment.effective_to is null
              or record_assignment.effective_to >=
                 record.production_date
            )
        )
      )
  ) as monthly
    on true

  left join lateral (
    select
      target.target_percentage

    from public.ipd_targets as target

    where target.line_model_assignment_id =
          authorized_assignment.id
      and target.active = true
      and (
        target.shift_id = shift.id
        or target.shift_id is null
      )
      and target.effective_from <
          request_context.next_month_start
      and (
        target.effective_to is null
        or target.effective_to >=
           request_context.month_start
      )

    order by
      case
        when target.shift_id = shift.id
          then 0
        else 1
      end,
      target.effective_from desc

    limit 1
  ) as configured_target
    on true

  where shift.active = true
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
              request_context.current_employee_id
          and visible_assignment
                .line_model_assignment_id =
              authorized_assignment.id
          and visible_assignment.shift_id =
              shift.id
          and visible_assignment.active = true
          and visible_assignment.effective_from <
              request_context.next_month_start
          and (
            visible_assignment.effective_to is null
            or visible_assignment.effective_to >=
               request_context.month_start
          )
      )
    )

  order by
    shift.display_order,
    shift.code;
$$;

revoke all
on function public.get_line_performance_by_shift(
  uuid,
  date
)
from public, anon;

grant execute
on function public.get_line_performance_by_shift(
  uuid,
  date
)
to authenticated;

commit;
