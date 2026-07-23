begin;

-- All functions are SECURITY INVOKER and read from the existing
-- security-invoker views, so current RLS and plant/role access remain active.

create or replace function public.get_defect_analysis_summary(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  line_model_assignment_id_value uuid default null,
  defect_type_id_value uuid default null
)
returns table (
  total_records bigint,
  affected_records bigint,
  produced_quantity bigint,
  defective_harness_quantity bigint,
  total_defects bigint,
  distinct_defect_types bigint,
  defect_ipd_percentage numeric,
  defective_harness_percentage numeric,
  average_defects_per_affected_record numeric,
  top_defect_type_id uuid,
  top_defect_type_code text,
  top_defect_type_name text,
  top_defect_quantity bigint
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
      and (shift_id_value is null or record.shift_id = shift_id_value)
      and (
        line_model_assignment_id_value is null
        or record.line_model_assignment_id = line_model_assignment_id_value
      )
      and record.status in (
        'submitted'::public.ipd_record_status,
        'closed'::public.ipd_record_status,
        'no_production'::public.ipd_record_status
      )
  ),
  defects_scope as (
    select
      detail.daily_ipd_record_id,
      detail.defect_type_id,
      detail.defect_type_code,
      detail.defect_type_name,
      detail.quantity
    from public.daily_ipd_defect_overview as detail
    join records_scope as record
      on record.id = detail.daily_ipd_record_id
    where defect_type_id_value is null
       or detail.defect_type_id = defect_type_id_value
  ),
  record_totals as (
    select
      count(*)::bigint as total_records,
      coalesce(sum(produced_quantity), 0)::bigint as produced_quantity,
      coalesce(sum(defective_harness_quantity), 0)::bigint
        as defective_harness_quantity
    from records_scope
  ),
  defect_totals as (
    select
      count(distinct daily_ipd_record_id)::bigint as affected_records,
      coalesce(sum(quantity), 0)::bigint as total_defects,
      count(distinct defect_type_id)::bigint as distinct_defect_types
    from defects_scope
  ),
  top_defect as (
    select
      defect_type_id,
      defect_type_code,
      defect_type_name,
      sum(quantity)::bigint as quantity
    from defects_scope
    group by defect_type_id, defect_type_code, defect_type_name
    order by quantity desc, defect_type_name
    limit 1
  )
  select
    record_totals.total_records,
    defect_totals.affected_records,
    record_totals.produced_quantity,
    record_totals.defective_harness_quantity,
    defect_totals.total_defects,
    defect_totals.distinct_defect_types,
    case
      when record_totals.produced_quantity > 0 then
        round(
          defect_totals.total_defects::numeric
          / record_totals.produced_quantity::numeric * 100,
          4
        )
      else null
    end,
    case
      when record_totals.produced_quantity > 0 then
        round(
          record_totals.defective_harness_quantity::numeric
          / record_totals.produced_quantity::numeric * 100,
          4
        )
      else null
    end,
    case
      when defect_totals.affected_records > 0 then
        round(
          defect_totals.total_defects::numeric
          / defect_totals.affected_records::numeric,
          2
        )
      else 0::numeric
    end,
    top_defect.defect_type_id,
    top_defect.defect_type_code,
    top_defect.defect_type_name,
    top_defect.quantity
  from record_totals
  cross join defect_totals
  left join top_defect on true;
$$;

revoke all on function public.get_defect_analysis_summary(
  uuid, date, date, uuid, uuid, uuid
) from public, anon;
grant execute on function public.get_defect_analysis_summary(
  uuid, date, date, uuid, uuid, uuid
) to authenticated;

create or replace function public.get_defect_analysis_pareto(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  line_model_assignment_id_value uuid default null,
  defect_type_id_value uuid default null,
  result_limit_value integer default 15
)
returns table (
  defect_type_id uuid,
  defect_type_code text,
  defect_type_name text,
  defect_category text,
  quantity bigint,
  affected_records bigint,
  percentage numeric,
  cumulative_percentage numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with records_scope as (
    select id
    from public.daily_ipd_overview as record
    where record.plant_id = plant_id_value
      and record.production_date between date_from_value and date_to_value
      and (shift_id_value is null or record.shift_id = shift_id_value)
      and (
        line_model_assignment_id_value is null
        or record.line_model_assignment_id = line_model_assignment_id_value
      )
      and record.status in (
        'submitted'::public.ipd_record_status,
        'closed'::public.ipd_record_status
      )
  ),
  grouped as (
    select
      detail.defect_type_id,
      detail.defect_type_code,
      detail.defect_type_name,
      detail.defect_category,
      sum(detail.quantity)::bigint as quantity,
      count(distinct detail.daily_ipd_record_id)::bigint as affected_records
    from public.daily_ipd_defect_overview as detail
    join records_scope as record
      on record.id = detail.daily_ipd_record_id
    where defect_type_id_value is null
       or detail.defect_type_id = defect_type_id_value
    group by
      detail.defect_type_id,
      detail.defect_type_code,
      detail.defect_type_name,
      detail.defect_category
  ),
  ranked as (
    select
      grouped.*,
      sum(quantity) over () as grand_total,
      sum(quantity) over (
        order by quantity desc, defect_type_name
        rows between unbounded preceding and current row
      ) as cumulative_total,
      row_number() over (
        order by quantity desc, defect_type_name
      ) as row_number_value
    from grouped
  )
  select
    defect_type_id,
    defect_type_code,
    defect_type_name,
    defect_category,
    quantity,
    affected_records,
    case
      when grand_total > 0 then
        round(quantity::numeric / grand_total::numeric * 100, 2)
      else 0::numeric
    end,
    case
      when grand_total > 0 then
        round(cumulative_total::numeric / grand_total::numeric * 100, 2)
      else 0::numeric
    end
  from ranked
  where row_number_value <= greatest(
    1,
    least(coalesce(result_limit_value, 15), 30)
  )
  order by row_number_value;
$$;

revoke all on function public.get_defect_analysis_pareto(
  uuid, date, date, uuid, uuid, uuid, integer
) from public, anon;
grant execute on function public.get_defect_analysis_pareto(
  uuid, date, date, uuid, uuid, uuid, integer
) to authenticated;

create or replace function public.get_defect_analysis_trend(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  line_model_assignment_id_value uuid default null,
  defect_type_id_value uuid default null
)
returns table (
  production_date date,
  produced_quantity bigint,
  defective_harness_quantity bigint,
  total_defects bigint,
  affected_records bigint,
  defect_ipd_percentage numeric
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
      least(date_to_value, date_from_value + 365)::timestamp,
      interval '1 day'
    ) as generated_day
    where date_to_value >= date_from_value
  ),
  records_scope as (
    select
      record.id,
      record.production_date,
      record.produced_quantity,
      record.defective_harness_quantity
    from public.daily_ipd_overview as record
    where record.plant_id = plant_id_value
      and record.production_date between
          date_from_value and least(date_to_value, date_from_value + 365)
      and (shift_id_value is null or record.shift_id = shift_id_value)
      and (
        line_model_assignment_id_value is null
        or record.line_model_assignment_id = line_model_assignment_id_value
      )
      and record.status in (
        'submitted'::public.ipd_record_status,
        'closed'::public.ipd_record_status,
        'no_production'::public.ipd_record_status
      )
  ),
  records_by_day as (
    select
      production_date,
      coalesce(sum(produced_quantity), 0)::bigint as produced_quantity,
      coalesce(sum(defective_harness_quantity), 0)::bigint
        as defective_harness_quantity
    from records_scope
    group by production_date
  ),
  defects_by_day as (
    select
      record.production_date,
      coalesce(sum(detail.quantity), 0)::bigint as total_defects,
      count(distinct detail.daily_ipd_record_id)::bigint as affected_records
    from records_scope as record
    join public.daily_ipd_defect_overview as detail
      on detail.daily_ipd_record_id = record.id
    where defect_type_id_value is null
       or detail.defect_type_id = defect_type_id_value
    group by record.production_date
  )
  select
    days.production_date,
    coalesce(records_by_day.produced_quantity, 0)::bigint,
    coalesce(records_by_day.defective_harness_quantity, 0)::bigint,
    coalesce(defects_by_day.total_defects, 0)::bigint,
    coalesce(defects_by_day.affected_records, 0)::bigint,
    case
      when coalesce(records_by_day.produced_quantity, 0) > 0 then
        round(
          coalesce(defects_by_day.total_defects, 0)::numeric
          / records_by_day.produced_quantity::numeric * 100,
          4
        )
      else null
    end
  from days
  left join records_by_day
    on records_by_day.production_date = days.production_date
  left join defects_by_day
    on defects_by_day.production_date = days.production_date
  order by days.production_date;
$$;

revoke all on function public.get_defect_analysis_trend(
  uuid, date, date, uuid, uuid, uuid
) from public, anon;
grant execute on function public.get_defect_analysis_trend(
  uuid, date, date, uuid, uuid, uuid
) to authenticated;

create or replace function public.get_defect_analysis_by_line(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  line_model_assignment_id_value uuid default null,
  defect_type_id_value uuid default null
)
returns table (
  line_model_assignment_id uuid,
  production_line_id uuid,
  production_line_name text,
  display_order integer,
  product_model_id uuid,
  product_model_name text,
  model_year smallint,
  produced_quantity bigint,
  defective_harness_quantity bigint,
  total_defects bigint,
  affected_records bigint,
  defect_ipd_percentage numeric,
  percentage_of_total_defects numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with records_scope as (
    select
      record.id,
      record.line_model_assignment_id,
      record.production_line_id,
      record.production_line_name,
      record.display_order,
      record.product_model_id,
      record.product_model_name,
      record.model_year,
      record.produced_quantity,
      record.defective_harness_quantity
    from public.daily_ipd_overview as record
    where record.plant_id = plant_id_value
      and record.production_date between date_from_value and date_to_value
      and (shift_id_value is null or record.shift_id = shift_id_value)
      and (
        line_model_assignment_id_value is null
        or record.line_model_assignment_id = line_model_assignment_id_value
      )
      and record.status in (
        'submitted'::public.ipd_record_status,
        'closed'::public.ipd_record_status,
        'no_production'::public.ipd_record_status
      )
  ),
  records_by_line as (
    select
      line_model_assignment_id,
      production_line_id,
      production_line_name,
      display_order,
      product_model_id,
      product_model_name,
      model_year,
      coalesce(sum(produced_quantity), 0)::bigint as produced_quantity,
      coalesce(sum(defective_harness_quantity), 0)::bigint
        as defective_harness_quantity
    from records_scope
    group by
      line_model_assignment_id,
      production_line_id,
      production_line_name,
      display_order,
      product_model_id,
      product_model_name,
      model_year
  ),
  defects_by_line as (
    select
      record.line_model_assignment_id,
      coalesce(sum(detail.quantity), 0)::bigint as total_defects,
      count(distinct detail.daily_ipd_record_id)::bigint as affected_records
    from records_scope as record
    join public.daily_ipd_defect_overview as detail
      on detail.daily_ipd_record_id = record.id
    where defect_type_id_value is null
       or detail.defect_type_id = defect_type_id_value
    group by record.line_model_assignment_id
  ),
  combined as (
    select
      records_by_line.*,
      coalesce(defects_by_line.total_defects, 0)::bigint as total_defects,
      coalesce(defects_by_line.affected_records, 0)::bigint
        as affected_records
    from records_by_line
    left join defects_by_line
      on defects_by_line.line_model_assignment_id =
         records_by_line.line_model_assignment_id
  ),
  with_total as (
    select
      combined.*,
      sum(total_defects) over () as grand_total_defects
    from combined
  )
  select
    line_model_assignment_id,
    production_line_id,
    production_line_name,
    display_order,
    product_model_id,
    product_model_name,
    model_year,
    produced_quantity,
    defective_harness_quantity,
    total_defects,
    affected_records,
    case
      when produced_quantity > 0 then
        round(total_defects::numeric / produced_quantity::numeric * 100, 4)
      else null
    end,
    case
      when grand_total_defects > 0 then
        round(total_defects::numeric / grand_total_defects::numeric * 100, 2)
      else 0::numeric
    end
  from with_total
  order by
    total_defects desc,
    display_order,
    production_line_name,
    product_model_name;
$$;

revoke all on function public.get_defect_analysis_by_line(
  uuid, date, date, uuid, uuid, uuid
) from public, anon;
grant execute on function public.get_defect_analysis_by_line(
  uuid, date, date, uuid, uuid, uuid
) to authenticated;

create or replace function public.get_defect_analysis_by_shift(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  line_model_assignment_id_value uuid default null,
  defect_type_id_value uuid default null
)
returns table (
  shift_id uuid,
  shift_code text,
  shift_name text,
  display_order integer,
  produced_quantity bigint,
  defective_harness_quantity bigint,
  total_defects bigint,
  affected_records bigint,
  defect_ipd_percentage numeric,
  percentage_of_total_defects numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with records_scope as (
    select
      record.id,
      record.shift_id,
      record.shift_code,
      record.shift_name,
      shift.display_order,
      record.produced_quantity,
      record.defective_harness_quantity
    from public.daily_ipd_overview as record
    join public.shifts as shift
      on shift.id = record.shift_id
    where record.plant_id = plant_id_value
      and record.production_date between date_from_value and date_to_value
      and (shift_id_value is null or record.shift_id = shift_id_value)
      and (
        line_model_assignment_id_value is null
        or record.line_model_assignment_id = line_model_assignment_id_value
      )
      and record.status in (
        'submitted'::public.ipd_record_status,
        'closed'::public.ipd_record_status,
        'no_production'::public.ipd_record_status
      )
  ),
  records_by_shift as (
    select
      shift_id,
      shift_code,
      shift_name,
      display_order,
      coalesce(sum(produced_quantity), 0)::bigint as produced_quantity,
      coalesce(sum(defective_harness_quantity), 0)::bigint
        as defective_harness_quantity
    from records_scope
    group by shift_id, shift_code, shift_name, display_order
  ),
  defects_by_shift as (
    select
      record.shift_id,
      coalesce(sum(detail.quantity), 0)::bigint as total_defects,
      count(distinct detail.daily_ipd_record_id)::bigint as affected_records
    from records_scope as record
    join public.daily_ipd_defect_overview as detail
      on detail.daily_ipd_record_id = record.id
    where defect_type_id_value is null
       or detail.defect_type_id = defect_type_id_value
    group by record.shift_id
  ),
  combined as (
    select
      records_by_shift.*,
      coalesce(defects_by_shift.total_defects, 0)::bigint as total_defects,
      coalesce(defects_by_shift.affected_records, 0)::bigint
        as affected_records
    from records_by_shift
    left join defects_by_shift
      on defects_by_shift.shift_id = records_by_shift.shift_id
  ),
  with_total as (
    select
      combined.*,
      sum(total_defects) over () as grand_total_defects
    from combined
  )
  select
    shift_id,
    shift_code,
    shift_name,
    display_order,
    produced_quantity,
    defective_harness_quantity,
    total_defects,
    affected_records,
    case
      when produced_quantity > 0 then
        round(total_defects::numeric / produced_quantity::numeric * 100, 4)
      else null
    end,
    case
      when grand_total_defects > 0 then
        round(total_defects::numeric / grand_total_defects::numeric * 100, 2)
      else 0::numeric
    end
  from with_total
  order by display_order, shift_code;
$$;

revoke all on function public.get_defect_analysis_by_shift(
  uuid, date, date, uuid, uuid, uuid
) from public, anon;
grant execute on function public.get_defect_analysis_by_shift(
  uuid, date, date, uuid, uuid, uuid
) to authenticated;

create or replace function public.get_defect_analysis_occurrences(
  plant_id_value uuid,
  date_from_value date,
  date_to_value date,
  shift_id_value uuid default null,
  line_model_assignment_id_value uuid default null,
  defect_type_id_value uuid default null,
  result_limit_value integer default 100
)
returns table (
  detail_id uuid,
  record_id uuid,
  production_date date,
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
  record_total_defects integer,
  ipd_percentage numeric,
  target_percentage numeric,
  record_comment text,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    detail.id,
    record.id,
    record.production_date,
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
    detail.comment,
    record.produced_quantity,
    record.total_defects,
    record.ipd_percentage,
    record.target_percentage,
    record.comment,
    detail.updated_at
  from public.daily_ipd_defect_overview as detail
  join public.daily_ipd_overview as record
    on record.id = detail.daily_ipd_record_id
  where record.plant_id = plant_id_value
    and record.production_date between date_from_value and date_to_value
    and (shift_id_value is null or record.shift_id = shift_id_value)
    and (
      line_model_assignment_id_value is null
      or record.line_model_assignment_id = line_model_assignment_id_value
    )
    and (
      defect_type_id_value is null
      or detail.defect_type_id = defect_type_id_value
    )
    and record.status in (
      'submitted'::public.ipd_record_status,
      'closed'::public.ipd_record_status
    )
  order by
    record.production_date desc,
    detail.quantity desc,
    detail.updated_at desc
  limit greatest(
    1,
    least(coalesce(result_limit_value, 100), 500)
  );
$$;

revoke all on function public.get_defect_analysis_occurrences(
  uuid, date, date, uuid, uuid, uuid, integer
) from public, anon;
grant execute on function public.get_defect_analysis_occurrences(
  uuid, date, date, uuid, uuid, uuid, integer
) to authenticated;

commit;
