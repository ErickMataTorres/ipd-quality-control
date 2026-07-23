begin;

-- =========================================================
-- REPORTS BACKEND
-- Uses the existing security-invoker views so current RLS,
-- plant access and supervisor visibility remain enforced.
-- =========================================================

create or replace function public.get_reports_summary(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  line_model_assignment_id_value uuid default null,
  status_value public.ipd_record_status default null
)
returns table (
  total_records bigint,
  draft_records bigint,
  submitted_records bigint,
  closed_records bigint,
  no_production_records bigint,
  produced_quantity bigint,
  defective_harness_quantity bigint,
  total_defects bigint,
  ipd_percentage numeric,
  defective_harness_percentage numeric,
  within_target_records bigint,
  outside_target_records bigint,
  records_without_target bigint,
  first_record_date date,
  last_record_date date
)
language sql
stable
security invoker
set search_path = ''
as $$
  with records_scope as (
    select *
    from public.daily_ipd_overview as record
    where record.plant_id = plant_id_value
      and record.production_date between date_from_value and date_to_value
      and (
        shift_id_value is null
        or record.shift_id = shift_id_value
      )
      and (
        line_model_assignment_id_value is null
        or record.line_model_assignment_id =
           line_model_assignment_id_value
      )
      and (
        status_value is null
        or record.status = status_value
      )
  )
  select
    count(*)::bigint as total_records,

    count(*) filter (
      where status = 'draft'::public.ipd_record_status
    )::bigint as draft_records,

    count(*) filter (
      where status = 'submitted'::public.ipd_record_status
    )::bigint as submitted_records,

    count(*) filter (
      where status = 'closed'::public.ipd_record_status
    )::bigint as closed_records,

    count(*) filter (
      where status = 'no_production'::public.ipd_record_status
    )::bigint as no_production_records,

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
    )::bigint as total_defects,

    case
      when coalesce(
        sum(produced_quantity) filter (
          where status in (
            'submitted'::public.ipd_record_status,
            'closed'::public.ipd_record_status,
            'no_production'::public.ipd_record_status
          )
        ),
        0
      ) > 0 then
        round(
          (
            coalesce(
              sum(total_defects) filter (
                where status in (
                  'submitted'::public.ipd_record_status,
                  'closed'::public.ipd_record_status,
                  'no_production'::public.ipd_record_status
                )
              ),
              0
            )::numeric
            /
            sum(produced_quantity) filter (
              where status in (
                'submitted'::public.ipd_record_status,
                'closed'::public.ipd_record_status,
                'no_production'::public.ipd_record_status
              )
            )::numeric
          ) * 100,
          4
        )
      else null
    end as ipd_percentage,

    case
      when coalesce(
        sum(produced_quantity) filter (
          where status in (
            'submitted'::public.ipd_record_status,
            'closed'::public.ipd_record_status,
            'no_production'::public.ipd_record_status
          )
        ),
        0
      ) > 0 then
        round(
          (
            coalesce(
              sum(defective_harness_quantity) filter (
                where status in (
                  'submitted'::public.ipd_record_status,
                  'closed'::public.ipd_record_status,
                  'no_production'::public.ipd_record_status
                )
              ),
              0
            )::numeric
            /
            sum(produced_quantity) filter (
              where status in (
                'submitted'::public.ipd_record_status,
                'closed'::public.ipd_record_status,
                'no_production'::public.ipd_record_status
              )
            )::numeric
          ) * 100,
          4
        )
      else null
    end as defective_harness_percentage,

    count(*) filter (
      where status in (
        'submitted'::public.ipd_record_status,
        'closed'::public.ipd_record_status
      )
        and target_percentage is not null
        and ipd_percentage <= target_percentage
    )::bigint as within_target_records,

    count(*) filter (
      where status in (
        'submitted'::public.ipd_record_status,
        'closed'::public.ipd_record_status
      )
        and target_percentage is not null
        and ipd_percentage > target_percentage
    )::bigint as outside_target_records,

    count(*) filter (
      where status in (
        'submitted'::public.ipd_record_status,
        'closed'::public.ipd_record_status
      )
        and target_percentage is null
    )::bigint as records_without_target,

    min(production_date) as first_record_date,
    max(production_date) as last_record_date

  from records_scope;
$$;

revoke all on function public.get_reports_summary(
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.ipd_record_status
) from public, anon;

grant execute on function public.get_reports_summary(
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.ipd_record_status
) to authenticated;

-- =========================================================
-- DAILY AGGREGATE
-- Missing dates are returned with zero quantities.
-- Range is capped at 366 days.
-- =========================================================

create or replace function public.get_reports_daily(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  line_model_assignment_id_value uuid default null,
  status_value public.ipd_record_status default null
)
returns table (
  production_date date,
  total_records bigint,
  produced_quantity bigint,
  defective_harness_quantity bigint,
  total_defects bigint,
  ipd_percentage numeric,
  within_target_records bigint,
  outside_target_records bigint,
  no_production_records bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select generated_day::date as production_date
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
      count(*)::bigint as total_records,

      coalesce(
        sum(record.produced_quantity) filter (
          where record.status in (
            'submitted'::public.ipd_record_status,
            'closed'::public.ipd_record_status,
            'no_production'::public.ipd_record_status
          )
        ),
        0
      )::bigint as produced_quantity,

      coalesce(
        sum(record.defective_harness_quantity) filter (
          where record.status in (
            'submitted'::public.ipd_record_status,
            'closed'::public.ipd_record_status,
            'no_production'::public.ipd_record_status
          )
        ),
        0
      )::bigint as defective_harness_quantity,

      coalesce(
        sum(record.total_defects) filter (
          where record.status in (
            'submitted'::public.ipd_record_status,
            'closed'::public.ipd_record_status,
            'no_production'::public.ipd_record_status
          )
        ),
        0
      )::bigint as total_defects,

      count(*) filter (
        where record.status in (
          'submitted'::public.ipd_record_status,
          'closed'::public.ipd_record_status
        )
          and record.target_percentage is not null
          and record.ipd_percentage <=
              record.target_percentage
      )::bigint as within_target_records,

      count(*) filter (
        where record.status in (
          'submitted'::public.ipd_record_status,
          'closed'::public.ipd_record_status
        )
          and record.target_percentage is not null
          and record.ipd_percentage >
              record.target_percentage
      )::bigint as outside_target_records,

      count(*) filter (
        where record.status =
              'no_production'::public.ipd_record_status
      )::bigint as no_production_records

    from public.daily_ipd_overview as record

    where record.plant_id = plant_id_value
      and record.production_date between
          date_from_value
          and least(
            date_to_value,
            date_from_value + 365
          )
      and (
        shift_id_value is null
        or record.shift_id = shift_id_value
      )
      and (
        line_model_assignment_id_value is null
        or record.line_model_assignment_id =
           line_model_assignment_id_value
      )
      and (
        status_value is null
        or record.status = status_value
      )

    group by record.production_date
  )
  select
    days.production_date,

    coalesce(
      records_by_day.total_records,
      0
    )::bigint as total_records,

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
      records_by_day.within_target_records,
      0
    )::bigint as within_target_records,

    coalesce(
      records_by_day.outside_target_records,
      0
    )::bigint as outside_target_records,

    coalesce(
      records_by_day.no_production_records,
      0
    )::bigint as no_production_records

  from days

  left join records_by_day
    on records_by_day.production_date =
       days.production_date

  order by days.production_date;
$$;

revoke all on function public.get_reports_daily(
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.ipd_record_status
) from public, anon;

grant execute on function public.get_reports_daily(
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.ipd_record_status
) to authenticated;

-- =========================================================
-- AGGREGATE BY LINE AND MODEL
-- =========================================================

create or replace function public.get_reports_by_line(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  line_model_assignment_id_value uuid default null,
  status_value public.ipd_record_status default null
)
returns table (
  line_model_assignment_id uuid,
  production_line_id uuid,
  production_line_name text,
  display_order integer,
  product_model_id uuid,
  product_model_name text,
  model_year smallint,
  total_records bigint,
  produced_quantity bigint,
  defective_harness_quantity bigint,
  total_defects bigint,
  ipd_percentage numeric,
  weighted_target_percentage numeric,
  within_target_records bigint,
  outside_target_records bigint,
  compliance_percentage numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with grouped as (
    select
      record.line_model_assignment_id,
      record.production_line_id,
      record.production_line_name,
      record.display_order,
      record.product_model_id,
      record.product_model_name,
      record.model_year,

      count(*)::bigint as total_records,

      coalesce(
        sum(record.produced_quantity) filter (
          where record.status in (
            'submitted'::public.ipd_record_status,
            'closed'::public.ipd_record_status,
            'no_production'::public.ipd_record_status
          )
        ),
        0
      )::bigint as produced_quantity,

      coalesce(
        sum(record.defective_harness_quantity) filter (
          where record.status in (
            'submitted'::public.ipd_record_status,
            'closed'::public.ipd_record_status,
            'no_production'::public.ipd_record_status
          )
        ),
        0
      )::bigint as defective_harness_quantity,

      coalesce(
        sum(record.total_defects) filter (
          where record.status in (
            'submitted'::public.ipd_record_status,
            'closed'::public.ipd_record_status,
            'no_production'::public.ipd_record_status
          )
        ),
        0
      )::bigint as total_defects,

      count(*) filter (
        where record.status in (
          'submitted'::public.ipd_record_status,
          'closed'::public.ipd_record_status
        )
          and record.target_percentage is not null
          and record.ipd_percentage <=
              record.target_percentage
      )::bigint as within_target_records,

      count(*) filter (
        where record.status in (
          'submitted'::public.ipd_record_status,
          'closed'::public.ipd_record_status
        )
          and record.target_percentage is not null
          and record.ipd_percentage >
              record.target_percentage
      )::bigint as outside_target_records,

      case
        when coalesce(
          sum(record.produced_quantity) filter (
            where record.target_percentage is not null
              and record.produced_quantity > 0
              and record.status in (
                'submitted'::public.ipd_record_status,
                'closed'::public.ipd_record_status
              )
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
                  and record.status in (
                    'submitted'::public.ipd_record_status,
                    'closed'::public.ipd_record_status
                  )
              )
              /
              sum(record.produced_quantity) filter (
                where record.target_percentage is not null
                  and record.produced_quantity > 0
                  and record.status in (
                    'submitted'::public.ipd_record_status,
                    'closed'::public.ipd_record_status
                  )
              )
            ),
            4
          )
        else null
      end as weighted_target_percentage

    from public.daily_ipd_overview as record

    where record.plant_id = plant_id_value
      and record.production_date between
          date_from_value
          and date_to_value
      and (
        shift_id_value is null
        or record.shift_id = shift_id_value
      )
      and (
        line_model_assignment_id_value is null
        or record.line_model_assignment_id =
           line_model_assignment_id_value
      )
      and (
        status_value is null
        or record.status = status_value
      )

    group by
      record.line_model_assignment_id,
      record.production_line_id,
      record.production_line_name,
      record.display_order,
      record.product_model_id,
      record.product_model_name,
      record.model_year
  )
  select
    grouped.line_model_assignment_id,
    grouped.production_line_id,
    grouped.production_line_name,
    grouped.display_order,
    grouped.product_model_id,
    grouped.product_model_name,
    grouped.model_year,
    grouped.total_records,
    grouped.produced_quantity,
    grouped.defective_harness_quantity,
    grouped.total_defects,

    case
      when grouped.produced_quantity > 0 then
        round(
          (
            grouped.total_defects::numeric
            /
            grouped.produced_quantity::numeric
          ) * 100,
          4
        )
      else null
    end as ipd_percentage,

    grouped.weighted_target_percentage,
    grouped.within_target_records,
    grouped.outside_target_records,

    case
      when (
        grouped.within_target_records
        + grouped.outside_target_records
      ) > 0 then
        round(
          (
            grouped.within_target_records::numeric
            /
            (
              grouped.within_target_records
              + grouped.outside_target_records
            )::numeric
          ) * 100,
          2
        )
      else null
    end as compliance_percentage

  from grouped

  order by
    grouped.display_order,
    grouped.production_line_name,
    grouped.product_model_name;
$$;

revoke all on function public.get_reports_by_line(
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.ipd_record_status
) from public, anon;

grant execute on function public.get_reports_by_line(
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.ipd_record_status
) to authenticated;

-- =========================================================
-- DETAILED DAILY RECORDS
-- =========================================================

create or replace function public.get_reports_records(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  line_model_assignment_id_value uuid default null,
  status_value public.ipd_record_status default null,
  row_limit_value integer default 5000
)
returns table (
  record_id uuid,
  production_date date,
  plant_id uuid,
  plant_code text,
  plant_name text,
  line_model_assignment_id uuid,
  production_line_id uuid,
  production_line_name text,
  product_model_id uuid,
  product_model_name text,
  model_year smallint,
  shift_id uuid,
  shift_code text,
  shift_name text,
  supervisor_employee_id uuid,
  supervisor_employee_number text,
  supervisor_name text,
  produced_quantity integer,
  defective_harness_quantity integer,
  total_defects integer,
  ipd_percentage numeric,
  target_percentage numeric,
  target_difference numeric,
  is_within_target boolean,
  status public.ipd_record_status,
  record_comment text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    record.id as record_id,
    record.production_date,
    record.plant_id,
    record.plant_code,
    record.plant_name,
    record.line_model_assignment_id,
    record.production_line_id,
    record.production_line_name,
    record.product_model_id,
    record.product_model_name,
    record.model_year,
    record.shift_id,
    record.shift_code,
    record.shift_name,
    record.supervisor_employee_id,
    record.supervisor_employee_number,
    record.supervisor_name,
    record.produced_quantity,
    record.defective_harness_quantity,
    record.total_defects,
    record.ipd_percentage,
    record.target_percentage,

    case
      when record.ipd_percentage is not null
        and record.target_percentage is not null
        then round(
          record.ipd_percentage
          - record.target_percentage,
          4
        )
      else null
    end as target_difference,

    case
      when record.status in (
        'submitted'::public.ipd_record_status,
        'closed'::public.ipd_record_status
      )
        and record.ipd_percentage is not null
        and record.target_percentage is not null
        then record.ipd_percentage
             <= record.target_percentage
      else null
    end as is_within_target,

    record.status,
    record.comment as record_comment,
    record.created_at,
    record.updated_at

  from public.daily_ipd_overview as record

  where record.plant_id = plant_id_value
    and record.production_date between
        date_from_value
        and date_to_value
    and (
      shift_id_value is null
      or record.shift_id = shift_id_value
    )
    and (
      line_model_assignment_id_value is null
      or record.line_model_assignment_id =
         line_model_assignment_id_value
    )
    and (
      status_value is null
      or record.status = status_value
    )

  order by
    record.production_date desc,
    record.display_order,
    record.production_line_name,
    record.shift_code,
    record.product_model_name

  limit greatest(
    1,
    least(
      coalesce(row_limit_value, 5000),
      20000
    )
  );
$$;

revoke all on function public.get_reports_records(
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.ipd_record_status,
  integer
) from public, anon;

grant execute on function public.get_reports_records(
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.ipd_record_status,
  integer
) to authenticated;

-- =========================================================
-- DETAILED DEFECT ROWS
-- =========================================================

create or replace function public.get_reports_defects(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  line_model_assignment_id_value uuid default null,
  status_value public.ipd_record_status default null,
  defect_type_id_value uuid default null,
  row_limit_value integer default 10000
)
returns table (
  detail_id uuid,
  record_id uuid,
  production_date date,
  plant_code text,
  plant_name text,
  production_line_name text,
  product_model_name text,
  model_year smallint,
  shift_code text,
  shift_name text,
  supervisor_employee_number text,
  supervisor_name text,
  defect_type_id uuid,
  defect_type_code text,
  defect_type_name text,
  defect_category text,
  quantity integer,
  defect_comment text,
  produced_quantity integer,
  defective_harness_quantity integer,
  record_total_defects integer,
  ipd_percentage numeric,
  target_percentage numeric,
  record_status public.ipd_record_status,
  record_comment text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    detail.id as detail_id,
    record.id as record_id,
    record.production_date,
    record.plant_code,
    record.plant_name,
    record.production_line_name,
    record.product_model_name,
    record.model_year,
    record.shift_code,
    record.shift_name,
    record.supervisor_employee_number,
    record.supervisor_name,
    detail.defect_type_id,
    detail.defect_type_code,
    detail.defect_type_name,
    detail.defect_category,
    detail.quantity,
    detail.comment as defect_comment,
    record.produced_quantity,
    record.defective_harness_quantity,
    record.total_defects as record_total_defects,
    record.ipd_percentage,
    record.target_percentage,
    record.status as record_status,
    record.comment as record_comment,
    detail.created_at,
    detail.updated_at

  from public.daily_ipd_defect_overview as detail

  join public.daily_ipd_overview as record
    on record.id =
       detail.daily_ipd_record_id

  where record.plant_id = plant_id_value
    and record.production_date between
        date_from_value
        and date_to_value
    and (
      shift_id_value is null
      or record.shift_id = shift_id_value
    )
    and (
      line_model_assignment_id_value is null
      or record.line_model_assignment_id =
         line_model_assignment_id_value
    )
    and (
      status_value is null
      or record.status = status_value
    )
    and (
      defect_type_id_value is null
      or detail.defect_type_id =
         defect_type_id_value
    )

  order by
    record.production_date desc,
    record.display_order,
    record.production_line_name,
    record.shift_code,
    detail.quantity desc,
    detail.defect_type_name

  limit greatest(
    1,
    least(
      coalesce(row_limit_value, 10000),
      50000
    )
  );
$$;

revoke all on function public.get_reports_defects(
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.ipd_record_status,
  uuid,
  integer
) from public, anon;

grant execute on function public.get_reports_defects(
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.ipd_record_status,
  uuid,
  integer
) to authenticated;

commit;
