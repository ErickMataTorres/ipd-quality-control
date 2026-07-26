begin;

-- =========================================================
-- AUDIT LOG QUERY BACKEND
-- Restricted to active system administrators.
-- =========================================================

create index if not exists
audit_logs_changed_by_idx
on public.audit_logs (
  changed_by,
  changed_at desc
);

create or replace function
public.get_audit_log_summary(
  date_from_value date,
  date_to_value date,
  table_names_value text[] default null,
  actions_value public.audit_action[] default null,
  changed_by_value uuid default null,
  search_value text default null
)
returns table (
  total_entries bigint,
  insert_entries bigint,
  update_entries bigint,
  delete_entries bigint,
  distinct_tables bigint,
  distinct_actors bigint,
  first_change_at timestamptz,
  last_change_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with filtered_logs as (
    select
      audit_log.*
    from public.audit_logs as audit_log
    left join public.user_profiles as profile
      on profile.id = audit_log.changed_by
    left join public.employees as employee
      on employee.id = profile.employee_id
    left join auth.users as auth_user
      on auth_user.id = audit_log.changed_by
    where private.is_system_administrator()
      and audit_log.changed_at >=
          date_from_value::timestamptz
      and audit_log.changed_at <
          (
            date_to_value
            + 1
          )::timestamptz
      and (
        table_names_value is null
        or cardinality(table_names_value) = 0
        or audit_log.table_name =
           any(table_names_value)
      )
      and (
        actions_value is null
        or cardinality(actions_value) = 0
        or audit_log.action =
           any(actions_value)
      )
      and (
        changed_by_value is null
        or audit_log.changed_by =
           changed_by_value
      )
      and (
        search_value is null
        or btrim(search_value) = ''
        or public.normalize_text(
          concat_ws(
            ' ',
            audit_log.table_name,
            audit_log.record_id::text,
            audit_log.action::text,
            coalesce(employee.employee_number, ''),
            coalesce(employee.full_name, ''),
            coalesce(auth_user.email, ''),
            coalesce(audit_log.old_values::text, ''),
            coalesce(audit_log.new_values::text, '')
          )
        ) like
        '%' || public.normalize_text(search_value) || '%'
      )
  )
  select
    count(*)::bigint as total_entries,

    count(*) filter (
      where action =
        'insert'::public.audit_action
    )::bigint as insert_entries,

    count(*) filter (
      where action =
        'update'::public.audit_action
    )::bigint as update_entries,

    count(*) filter (
      where action =
        'delete'::public.audit_action
    )::bigint as delete_entries,

    count(
      distinct table_name
    )::bigint as distinct_tables,

    count(
      distinct changed_by
    )::bigint as distinct_actors,

    min(changed_at)
      as first_change_at,

    max(changed_at)
      as last_change_at

  from filtered_logs;
$$;

revoke all
on function public.get_audit_log_summary(
  date,
  date,
  text[],
  public.audit_action[],
  uuid,
  text
)
from public, anon;

grant execute
on function public.get_audit_log_summary(
  date,
  date,
  text[],
  public.audit_action[],
  uuid,
  text
)
to authenticated;

create or replace function
public.get_audit_log_entries(
  date_from_value date,
  date_to_value date,
  table_names_value text[] default null,
  actions_value public.audit_action[] default null,
  changed_by_value uuid default null,
  search_value text default null,
  result_limit_value integer default 100,
  result_offset_value integer default 0
)
returns table (
  audit_log_id uuid,
  table_name text,
  record_id uuid,
  action public.audit_action,
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  record_label text,
  changed_by uuid,
  actor_employee_number text,
  actor_name text,
  actor_role public.app_role,
  actor_email text,
  changed_at timestamptz,
  total_filtered bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with filtered_logs as (
    select
      audit_log.id,
      audit_log.table_name,
      audit_log.record_id,
      audit_log.action,
      audit_log.old_values,
      audit_log.new_values,
      audit_log.changed_by,
      audit_log.changed_at,
      employee.employee_number,
      employee.full_name,
      profile.role,
      auth_user.email
    from public.audit_logs as audit_log
    left join public.user_profiles as profile
      on profile.id = audit_log.changed_by
    left join public.employees as employee
      on employee.id = profile.employee_id
    left join auth.users as auth_user
      on auth_user.id = audit_log.changed_by
    where private.is_system_administrator()
      and audit_log.changed_at >=
          date_from_value::timestamptz
      and audit_log.changed_at <
          (
            date_to_value
            + 1
          )::timestamptz
      and (
        table_names_value is null
        or cardinality(table_names_value) = 0
        or audit_log.table_name =
           any(table_names_value)
      )
      and (
        actions_value is null
        or cardinality(actions_value) = 0
        or audit_log.action =
           any(actions_value)
      )
      and (
        changed_by_value is null
        or audit_log.changed_by =
           changed_by_value
      )
      and (
        search_value is null
        or btrim(search_value) = ''
        or public.normalize_text(
          concat_ws(
            ' ',
            audit_log.table_name,
            audit_log.record_id::text,
            audit_log.action::text,
            coalesce(employee.employee_number, ''),
            coalesce(employee.full_name, ''),
            coalesce(auth_user.email, ''),
            coalesce(audit_log.old_values::text, ''),
            coalesce(audit_log.new_values::text, '')
          )
        ) like
        '%' || public.normalize_text(search_value) || '%'
      )
  ),
  enriched_logs as (
    select
      filtered_log.*,

      array(
        select changed_key
        from (
          select
            jsonb_object_keys(
              coalesce(
                filtered_log.old_values,
                '{}'::jsonb
              )
              ||
              coalesce(
                filtered_log.new_values,
                '{}'::jsonb
              )
            ) as changed_key
        ) as available_keys
        where
          filtered_log.old_values
            -> available_keys.changed_key
          is distinct from
          filtered_log.new_values
            -> available_keys.changed_key
        order by
          available_keys.changed_key
      )::text[] as changed_fields,

      case filtered_log.table_name
        when 'plants' then
          coalesce(
            filtered_log.new_values ->> 'name',
            filtered_log.old_values ->> 'name',
            filtered_log.record_id::text
          )

        when 'shifts' then
          concat_ws(
            ' · ',
            coalesce(
              filtered_log.new_values ->> 'code',
              filtered_log.old_values ->> 'code'
            ),
            coalesce(
              filtered_log.new_values ->> 'name',
              filtered_log.old_values ->> 'name'
            )
          )

        when 'product_models' then
          coalesce(
            filtered_log.new_values ->> 'name',
            filtered_log.old_values ->> 'name',
            filtered_log.record_id::text
          )

        when 'production_lines' then
          coalesce(
            filtered_log.new_values ->> 'name',
            filtered_log.old_values ->> 'name',
            filtered_log.record_id::text
          )

        when 'employees' then
          concat_ws(
            ' · ',
            coalesce(
              filtered_log.new_values
                ->> 'employee_number',
              filtered_log.old_values
                ->> 'employee_number'
            ),
            coalesce(
              filtered_log.new_values
                ->> 'full_name',
              filtered_log.old_values
                ->> 'full_name'
            )
          )

        when 'defect_types' then
          concat_ws(
            ' · ',
            coalesce(
              filtered_log.new_values ->> 'code',
              filtered_log.old_values ->> 'code'
            ),
            coalesce(
              filtered_log.new_values ->> 'name_es',
              filtered_log.old_values ->> 'name_es'
            )
          )

        when 'daily_ipd_records' then
          concat_ws(
            ' · ',
            coalesce(
              filtered_log.new_values
                ->> 'production_date',
              filtered_log.old_values
                ->> 'production_date'
            ),
            filtered_log.record_id::text
          )

        else
          filtered_log.record_id::text
      end as record_label,

      count(*) over ()
        as total_filtered

    from filtered_logs as filtered_log
  )
  select
    enriched_log.id
      as audit_log_id,

    enriched_log.table_name,
    enriched_log.record_id,
    enriched_log.action,
    enriched_log.old_values,
    enriched_log.new_values,
    enriched_log.changed_fields,
    nullif(
      btrim(
        enriched_log.record_label
      ),
      ''
    ) as record_label,
    enriched_log.changed_by,
    enriched_log.employee_number
      as actor_employee_number,
    enriched_log.full_name
      as actor_name,
    enriched_log.role
      as actor_role,
    enriched_log.email
      as actor_email,
    enriched_log.changed_at,
    enriched_log.total_filtered

  from enriched_logs as enriched_log

  order by
    enriched_log.changed_at desc,
    enriched_log.id desc

  limit greatest(
    1,
    least(
      coalesce(
        result_limit_value,
        100
      ),
      500
    )
  )

  offset greatest(
    coalesce(
      result_offset_value,
      0
    ),
    0
  );
$$;

revoke all
on function public.get_audit_log_entries(
  date,
  date,
  text[],
  public.audit_action[],
  uuid,
  text,
  integer,
  integer
)
from public, anon;

grant execute
on function public.get_audit_log_entries(
  date,
  date,
  text[],
  public.audit_action[],
  uuid,
  text,
  integer,
  integer
)
to authenticated;

create or replace function
public.get_audit_log_table_options()
returns table (
  table_name text,
  entry_count bigint,
  last_change_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    audit_log.table_name,
    count(*)::bigint as entry_count,
    max(audit_log.changed_at)
      as last_change_at

  from public.audit_logs as audit_log

  where private.is_system_administrator()

  group by
    audit_log.table_name

  order by
    audit_log.table_name;
$$;

revoke all
on function
public.get_audit_log_table_options()
from public, anon;

grant execute
on function
public.get_audit_log_table_options()
to authenticated;

create or replace function
public.get_audit_log_actor_options()
returns table (
  changed_by uuid,
  employee_number text,
  actor_name text,
  actor_role public.app_role,
  actor_email text,
  entry_count bigint,
  last_change_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    audit_log.changed_by,
    employee.employee_number,
    employee.full_name
      as actor_name,
    profile.role
      as actor_role,
    auth_user.email
      as actor_email,
    count(*)::bigint
      as entry_count,
    max(audit_log.changed_at)
      as last_change_at

  from public.audit_logs as audit_log

  left join public.user_profiles as profile
    on profile.id =
       audit_log.changed_by

  left join public.employees as employee
    on employee.id =
       profile.employee_id

  left join auth.users as auth_user
    on auth_user.id =
       audit_log.changed_by

  where private.is_system_administrator()
    and audit_log.changed_by is not null

  group by
    audit_log.changed_by,
    employee.employee_number,
    employee.full_name,
    profile.role,
    auth_user.email

  order by
    coalesce(
      employee.full_name,
      auth_user.email,
      audit_log.changed_by::text
    );
$$;

revoke all
on function
public.get_audit_log_actor_options()
from public, anon;

grant execute
on function
public.get_audit_log_actor_options()
to authenticated;

commit;
