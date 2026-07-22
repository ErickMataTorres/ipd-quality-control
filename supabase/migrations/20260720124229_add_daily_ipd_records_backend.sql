begin;

-- =========================================================
-- DAILY IPD OVERVIEW
-- =========================================================

drop view if exists public.daily_ipd_overview;

create view public.daily_ipd_overview
with (security_invoker = true)
as
select
  record.id,
  record.production_date,
  record.line_model_assignment_id,

  plant.id as plant_id,
  plant.code as plant_code,
  plant.name as plant_name,

  line.id as production_line_id,
  line.name as production_line_name,
  line.display_order,

  model.id as product_model_id,
  model.name as product_model_name,
  model.model_year,

  shift.id as shift_id,
  shift.code as shift_code,
  shift.name as shift_name,

  employee.id as supervisor_employee_id,
  employee.employee_number
    as supervisor_employee_number,
  employee.full_name as supervisor_name,
  employee.photo_path as supervisor_photo_path,

  record.produced_quantity,
  record.defective_harness_quantity,
  record.total_defects,
  record.ipd_percentage,

  record.target_id,
  record.target_percentage,

  case
    when record.ipd_percentage is null
      or record.target_percentage is null
      then null
    else record.ipd_percentage
         - record.target_percentage
  end as target_difference,

  case
    when record.ipd_percentage is null
      or record.target_percentage is null
      then null
    else record.ipd_percentage
         <= record.target_percentage
  end as is_within_target,

  (
    select count(*)::integer
    from public.daily_ipd_defects as detail
    where detail.daily_ipd_record_id =
          record.id
  ) as defect_type_count,

  record.comment,
  record.modification_reason,
  record.status,

  record.submitted_at,
  record.submitted_by,
  record.closed_at,
  record.closed_by,

  record.version,
  record.created_at,
  record.updated_at
from public.daily_ipd_records as record
join public.line_model_assignments as assignment
  on assignment.id =
     record.line_model_assignment_id
join public.production_lines as line
  on line.id =
     assignment.production_line_id
join public.plants as plant
  on plant.id =
     line.plant_id
join public.product_models as model
  on model.id =
     assignment.product_model_id
join public.shifts as shift
  on shift.id =
     record.shift_id
join public.employees as employee
  on employee.id =
     record.supervisor_employee_id;

grant select
on public.daily_ipd_overview
to authenticated;

-- =========================================================
-- DAILY DEFECT OVERVIEW
-- =========================================================

drop view if exists
  public.daily_ipd_defect_overview;

create view public.daily_ipd_defect_overview
with (security_invoker = true)
as
select
  detail.id,
  detail.daily_ipd_record_id,

  detail.defect_type_id,
  defect_type.code as defect_type_code,
  defect_type.name_es as defect_type_name,
  defect_type.category as defect_category,
  defect_type.display_order,

  detail.quantity,
  detail.comment,

  detail.created_at,
  detail.updated_at
from public.daily_ipd_defects as detail
join public.defect_types as defect_type
  on defect_type.id =
     detail.defect_type_id;

grant select
on public.daily_ipd_defect_overview
to authenticated;

-- =========================================================
-- DAILY OPERATION BOARD
-- One row per active line/model for a plant, shift and date.
-- Supervisors only receive their assigned lines.
-- =========================================================

create or replace function
public.get_daily_operation_board(
  plant_id_value uuid,
  shift_id_value uuid,
  production_date_value date
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

  record_target_percentage numeric,
  is_within_target boolean,

  comment text,
  status public.ipd_record_status,
  version integer,
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
      )::date as month_start,

      (
        date_trunc(
          'month',
          production_date_value::timestamp
        )
        + interval '1 month'
      )::date as next_month_start
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

    selected_target.id
      as target_id,

    selected_target.target_percentage,

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

    record.target_percentage
      as record_target_percentage,

    case
      when record.ipd_percentage is null
        or record.target_percentage is null
        then null
      else record.ipd_percentage
           <= record.target_percentage
    end as is_within_target,

    record.comment,
    record.status,
    record.version,
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
  join public.production_lines as line
    on line.id =
       assignment.production_line_id
  join public.plants as plant
    on plant.id =
       line.plant_id
  join public.product_models as model
    on model.id =
       assignment.product_model_id
  join public.shifts as shift
    on shift.id =
       shift_id_value
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
    join public.employees as employee
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
    from public.ipd_targets as target
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

  left join public.daily_ipd_records as record
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
      end as monthly_ipd_percentage,

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
    and plant.id = plant_id_value
    and private.has_plant_access(plant.id)
    and plant.active = true
    and line.active = true
    and model.active = true
    and shift.active = true
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
    line.display_order,
    line.name,
    model.name;
$$;

revoke all
on function public.get_daily_operation_board(
  uuid,
  uuid,
  date
)
from public, anon;

grant execute
on function public.get_daily_operation_board(
  uuid,
  uuid,
  date
)
to authenticated;

-- =========================================================
-- ATOMIC DAILY RECORD SAVE
--
-- defects_value example:
-- [
--   {
--     "defectTypeId": "uuid",
--     "quantity": 2,
--     "comment": "optional"
--   }
-- ]
-- =========================================================

create or replace function
public.save_daily_ipd_record(
  record_id_value uuid,
  production_date_value date,
  line_model_assignment_id_value uuid,
  shift_id_value uuid,
  supervisor_employee_id_value uuid,
  produced_quantity_value integer,
  defective_harness_quantity_value integer,
  comment_value text,
  status_value public.ipd_record_status,
  expected_version_value integer,
  defects_value jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_record_id uuid;
  current_record public.daily_ipd_records%rowtype;
  selected_supervisor_id uuid;
  normalized_comment text;
  defect_input_count integer := 0;
  valid_defect_count integer := 0;
begin
  if not private.is_active_user() then
    raise exception
      'The current user is not active.'
      using errcode = '42501';
  end if;

  if production_date_value is null
     or line_model_assignment_id_value is null
     or shift_id_value is null then
    raise exception
      'Date, line/model and shift are required.'
      using errcode = '22023';
  end if;

  if produced_quantity_value is null
     or produced_quantity_value < 0 then
    raise exception
      'Produced quantity must be zero or greater.'
      using errcode = '22023';
  end if;

  if defective_harness_quantity_value is not null
     and (
       defective_harness_quantity_value < 0
       or defective_harness_quantity_value >
          produced_quantity_value
     ) then
    raise exception
      'Defective harness quantity is invalid.'
      using errcode = '22023';
  end if;

  if status_value not in (
    'draft'::public.ipd_record_status,
    'submitted'::public.ipd_record_status,
    'no_production'::public.ipd_record_status
  ) then
    raise exception
      'The requested record status is not available in this workflow.'
      using errcode = '22023';
  end if;

  normalized_comment :=
    nullif(
      pg_catalog.btrim(
        coalesce(comment_value, '')
      ),
      ''
    );

  if normalized_comment is not null
     and length(normalized_comment) > 2000 then
    raise exception
      'The general comment cannot exceed 2000 characters.'
      using errcode = '22023';
  end if;

  if defects_value is null then
    defects_value := '[]'::jsonb;
  end if;

  if pg_catalog.jsonb_typeof(defects_value)
     <> 'array' then
    raise exception
      'Defect details must be a JSON array.'
      using errcode = '22023';
  end if;

  defect_input_count :=
    pg_catalog.jsonb_array_length(
      defects_value
    );

  create temporary table
    pg_temp.daily_defect_input (
      defect_type_id uuid null,
      quantity integer null,
      comment text null
    )
  on commit drop;

  insert into pg_temp.daily_defect_input (
    defect_type_id,
    quantity,
    comment
  )
  select
    input_row."defectTypeId",
    input_row.quantity,
    nullif(
      pg_catalog.btrim(
        coalesce(
          input_row.comment,
          ''
        )
      ),
      ''
    )
  from pg_catalog.jsonb_to_recordset(
    defects_value
  ) as input_row (
    "defectTypeId" uuid,
    quantity integer,
    comment text
  );

  if exists (
    select 1
    from pg_temp.daily_defect_input
    where defect_type_id is null
       or quantity is null
       or quantity <= 0
       or (
         comment is not null
         and length(comment) > 1000
       )
  ) then
    raise exception
      'One or more defect details are invalid.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_temp.daily_defect_input
    group by defect_type_id
    having count(*) > 1
  ) then
    raise exception
      'A defect type cannot be repeated in the same record.'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into valid_defect_count
  from pg_temp.daily_defect_input
    as input_detail
  join public.defect_types
    as defect_type
    on defect_type.id =
       input_detail.defect_type_id
   and defect_type.active = true;

  if valid_defect_count
     <> defect_input_count then
    raise exception
      'One or more defect types do not exist or are inactive.'
      using errcode = '22023';
  end if;

  if status_value =
       'no_production'::public.ipd_record_status then
    if defect_input_count > 0 then
      raise exception
        'A No Production record cannot contain defects.'
        using errcode = '22023';
    end if;

    produced_quantity_value := 0;
    defective_harness_quantity_value := 0;
  end if;

  if status_value =
       'submitted'::public.ipd_record_status
     and produced_quantity_value <= 0 then
    raise exception
      'A submitted record must have production greater than zero.'
      using errcode = '22023';
  end if;

  if record_id_value is null then
    selected_supervisor_id :=
      coalesce(
        supervisor_employee_id_value,
        private.current_employee_id()
      );

    if selected_supervisor_id is null then
      raise exception
        'A responsible supervisor is required.'
        using errcode = '22023';
    end if;

    if not private.can_create_daily_record(
      line_model_assignment_id_value,
      shift_id_value,
      production_date_value,
      selected_supervisor_id
    ) then
      raise exception
        'The current user cannot create this daily record.'
        using errcode = '42501';
    end if;

    insert into public.daily_ipd_records (
      production_date,
      line_model_assignment_id,
      shift_id,
      supervisor_employee_id,
      produced_quantity,
      defective_harness_quantity,
      comment,
      status
    )
    values (
      production_date_value,
      line_model_assignment_id_value,
      shift_id_value,
      selected_supervisor_id,
      produced_quantity_value,
      defective_harness_quantity_value,
      normalized_comment,
      'draft'::public.ipd_record_status
    )
    returning id
    into saved_record_id;
  else
    select *
    into current_record
    from public.daily_ipd_records
    where id = record_id_value
    for update;

    if not found then
      raise exception
        'The daily IPD record was not found.'
        using errcode = 'P0002';
    end if;

    if expected_version_value is null
       or current_record.version
          <> expected_version_value then
      raise exception
        'The daily IPD record changed in another session. Reload it before saving.'
        using errcode = '40001';
    end if;

    if not private.can_edit_daily_record(
      current_record.id
    )
    and not (
      private.is_quality_manager_or_administrator()
      and current_record.status =
          'no_production'::public.ipd_record_status
      and private.can_access_assignment(
        current_record.line_model_assignment_id
      )
    ) then
      raise exception
        'The current user cannot edit this daily record.'
        using errcode = '42501';
    end if;

    if production_date_value
         is distinct from
         current_record.production_date
       or line_model_assignment_id_value
         is distinct from
         current_record
           .line_model_assignment_id
       or shift_id_value
         is distinct from
         current_record.shift_id
       or coalesce(
            supervisor_employee_id_value,
            current_record
              .supervisor_employee_id
          )
         is distinct from
         current_record
           .supervisor_employee_id then
      raise exception
        'Date, line, shift and responsible supervisor cannot be changed from this form.'
        using errcode = '22023';
    end if;

    saved_record_id :=
      current_record.id;
  end if;

  delete from public.daily_ipd_defects
  where daily_ipd_record_id =
        saved_record_id;

  insert into public.daily_ipd_defects (
    daily_ipd_record_id,
    defect_type_id,
    quantity,
    comment
  )
  select
    saved_record_id,
    input_detail.defect_type_id,
    input_detail.quantity,
    input_detail.comment
  from pg_temp.daily_defect_input
    as input_detail;

  update public.daily_ipd_records
  set
    produced_quantity =
      produced_quantity_value,

    defective_harness_quantity =
      defective_harness_quantity_value,

    comment =
      normalized_comment,

    status =
      status_value
  where id =
        saved_record_id;

  return saved_record_id;
exception
  when unique_violation then
    raise exception
      'A record already exists for the selected date, line/model and shift.'
      using errcode = '23505';
end;
$$;

revoke all
on function public.save_daily_ipd_record(
  uuid,
  date,
  uuid,
  uuid,
  uuid,
  integer,
  integer,
  text,
  public.ipd_record_status,
  integer,
  jsonb
)
from public, anon;

grant execute
on function public.save_daily_ipd_record(
  uuid,
  date,
  uuid,
  uuid,
  uuid,
  integer,
  integer,
  text,
  public.ipd_record_status,
  integer,
  jsonb
)
to authenticated;

-- =========================================================
-- CLOSE OR REOPEN A DAILY RECORD
-- Managers and administrators only.
-- =========================================================

create or replace function
public.review_daily_ipd_record(
  record_id_value uuid,
  requested_status_value
    public.ipd_record_status,
  expected_version_value integer,
  modification_reason_value text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_record public.daily_ipd_records%rowtype;
  normalized_reason text;
begin
  if not private
    .is_quality_manager_or_administrator() then
    raise exception
      'Only a quality manager or administrator can review daily records.'
      using errcode = '42501';
  end if;

  if requested_status_value not in (
    'submitted'::public.ipd_record_status,
    'closed'::public.ipd_record_status
  ) then
    raise exception
      'The requested review status is invalid.'
      using errcode = '22023';
  end if;

  select *
  into current_record
  from public.daily_ipd_records
  where id = record_id_value
  for update;

  if not found then
    raise exception
      'The daily IPD record was not found.'
      using errcode = 'P0002';
  end if;

  if not private.can_access_assignment(
    current_record.line_model_assignment_id
  ) then
    raise exception
      'The current user cannot access this daily record.'
      using errcode = '42501';
  end if;

  if expected_version_value is null
     or current_record.version
        <> expected_version_value then
    raise exception
      'The daily IPD record changed in another session. Reload it before continuing.'
      using errcode = '40001';
  end if;

  normalized_reason :=
    nullif(
      pg_catalog.btrim(
        coalesce(
          modification_reason_value,
          ''
        )
      ),
      ''
    );

  if current_record.status =
       'submitted'::public.ipd_record_status
     and requested_status_value =
       'closed'::public.ipd_record_status then
    update public.daily_ipd_records
    set
      status =
        'closed'::public.ipd_record_status,

      modification_reason = null
    where id = current_record.id;

    return;
  end if;

  if current_record.status =
       'closed'::public.ipd_record_status
     and requested_status_value =
       'submitted'::public.ipd_record_status then
    if normalized_reason is null then
      raise exception
        'A modification reason is required to reopen a closed record.'
        using errcode = '22023';
    end if;

    if length(normalized_reason) > 1000 then
      raise exception
        'The modification reason cannot exceed 1000 characters.'
        using errcode = '22023';
    end if;

    update public.daily_ipd_records
    set
      status =
        'submitted'::public.ipd_record_status,

      modification_reason =
        normalized_reason
    where id = current_record.id;

    return;
  end if;

  raise exception
    'The requested review transition is not allowed.'
    using errcode = '22023';
end;
$$;

revoke all
on function public.review_daily_ipd_record(
  uuid,
  public.ipd_record_status,
  integer,
  text
)
from public, anon;

grant execute
on function public.review_daily_ipd_record(
  uuid,
  public.ipd_record_status,
  integer,
  text
)
to authenticated;

commit;
