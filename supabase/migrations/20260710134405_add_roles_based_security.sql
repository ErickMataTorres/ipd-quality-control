begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter table public.daily_ipd_records
  add column if not exists modification_reason text;

alter table public.daily_ipd_records
  drop constraint if exists daily_ipd_modification_reason_length_valid;

alter table public.daily_ipd_records
  add constraint daily_ipd_modification_reason_length_valid
  check (
    modification_reason is null
    or length(modification_reason) <= 1000
  );

-- =========================================================
-- AUTHORIZATION HELPERS
-- =========================================================

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles as profile
    where profile.id = (select auth.uid())
      and profile.active = true
  );
$$;

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.user_profiles as profile
  where profile.id = (select auth.uid())
    and profile.active = true
  limit 1;
$$;

create or replace function private.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.employee_id
  from public.user_profiles as profile
  where profile.id = (select auth.uid())
    and profile.active = true
  limit 1;
$$;

create or replace function private.has_any_role(
  required_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_app_role() = any(required_roles),
    false
  );
$$;

create or replace function private.is_system_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_any_role(
    array['system_administrator'::public.app_role]
  );
$$;

create or replace function private.is_quality_manager_or_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_any_role(
    array[
      'system_administrator'::public.app_role,
      'quality_manager'::public.app_role
    ]
  );
$$;

create or replace function private.has_plant_access(
  target_plant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_plant_id is null then false
    when private.is_system_administrator() then true
    else exists (
      select 1
      from public.user_plant_access as access
      where access.user_id = (select auth.uid())
        and access.plant_id = target_plant_id
        and access.active = true
    )
  end;
$$;

create or replace function private.production_line_plant_id(
  target_production_line_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select line.plant_id
  from public.production_lines as line
  where line.id = target_production_line_id
  limit 1;
$$;

create or replace function private.can_access_production_line(
  target_production_line_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and private.has_plant_access(
      private.production_line_plant_id(target_production_line_id)
    );
$$;

create or replace function private.assignment_plant_id(
  target_assignment_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select line.plant_id
  from public.line_model_assignments as assignment
  join public.production_lines as line
    on line.id = assignment.production_line_id
  where assignment.id = target_assignment_id
  limit 1;
$$;

create or replace function private.can_access_assignment(
  target_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and private.has_plant_access(
      private.assignment_plant_id(target_assignment_id)
    );
$$;

create or replace function private.is_employee_assigned_supervisor(
  target_employee_id uuid,
  target_assignment_id uuid,
  target_shift_id uuid,
  target_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.supervisor_assignments as assignment
    where assignment.supervisor_employee_id = target_employee_id
      and assignment.line_model_assignment_id = target_assignment_id
      and assignment.shift_id = target_shift_id
      and assignment.active = true
      and assignment.effective_from <= target_date
      and (
        assignment.effective_to is null
        or assignment.effective_to >= target_date
      )
  );
$$;

create or replace function private.is_current_user_assigned_supervisor(
  target_assignment_id uuid,
  target_shift_id uuid,
  target_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_employee_assigned_supervisor(
    private.current_employee_id(),
    target_assignment_id,
    target_shift_id,
    target_date
  );
$$;

create or replace function private.can_create_daily_record(
  target_assignment_id uuid,
  target_shift_id uuid,
  target_date date,
  target_supervisor_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and (
      private.is_system_administrator()
      or (
        private.current_app_role() = 'quality_manager'::public.app_role
        and private.can_access_assignment(target_assignment_id)
        and private.is_employee_assigned_supervisor(
          target_supervisor_employee_id,
          target_assignment_id,
          target_shift_id,
          target_date
        )
      )
      or (
        private.current_app_role() = 'quality_supervisor'::public.app_role
        and target_supervisor_employee_id = private.current_employee_id()
        and private.is_current_user_assigned_supervisor(
          target_assignment_id,
          target_shift_id,
          target_date
        )
      )
    );
$$;

create or replace function private.can_read_daily_record(
  target_record_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and exists (
      select 1
      from public.daily_ipd_records as record
      where record.id = target_record_id
        and (
          private.can_access_assignment(record.line_model_assignment_id)
          or (
            private.current_app_role() = 'quality_supervisor'::public.app_role
            and record.supervisor_employee_id = private.current_employee_id()
            and private.is_current_user_assigned_supervisor(
              record.line_model_assignment_id,
              record.shift_id,
              record.production_date
            )
          )
        )
    );
$$;

create or replace function private.can_edit_daily_record(
  target_record_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and exists (
      select 1
      from public.daily_ipd_records as record
      where record.id = target_record_id
        and (
          (
            private.is_system_administrator()
            and record.status in (
              'draft'::public.ipd_record_status,
              'submitted'::public.ipd_record_status
            )
          )
          or (
            private.current_app_role() = 'quality_manager'::public.app_role
            and private.can_access_assignment(record.line_model_assignment_id)
            and record.status in (
              'draft'::public.ipd_record_status,
              'submitted'::public.ipd_record_status
            )
          )
          or (
            private.current_app_role() = 'quality_supervisor'::public.app_role
            and record.status = 'draft'::public.ipd_record_status
            and record.supervisor_employee_id = private.current_employee_id()
            and private.is_current_user_assigned_supervisor(
              record.line_model_assignment_id,
              record.shift_id,
              record.production_date
            )
          )
        )
    );
$$;

-- =========================================================
-- USER PREFERENCES RPC
-- =========================================================

create or replace function public.update_my_preferences(
  preferred_theme_value public.theme_preference,
  default_plant_value uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_user() then
    raise exception 'The current user is not active.';
  end if;

  if preferred_theme_value is null then
    raise exception 'Theme preference is required.';
  end if;

  if default_plant_value is not null
     and not private.has_plant_access(default_plant_value) then
    raise exception 'The selected plant is not available to this user.';
  end if;

  update public.user_profiles
  set preferred_theme = preferred_theme_value,
      default_plant_id = default_plant_value,
      updated_at = pg_catalog.now()
  where id = (select auth.uid());
end;
$$;

-- =========================================================
-- HARDEN DAILY RECORD WORKFLOW
-- =========================================================

create or replace function public.prepare_daily_ipd_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_role public.app_role;
  current_employee uuid;
  calculated_defects integer := 0;
begin
  current_user_role := private.current_app_role();
  current_employee := private.current_employee_id();

  if tg_op = 'INSERT' then
    if new.status = 'closed'::public.ipd_record_status then
      raise exception 'A new IPD record cannot be created as closed.';
    end if;

    new.total_defects := 0;
    new.version := 1;
    new.created_at := pg_catalog.now();
    new.updated_at := pg_catalog.now();
    new.created_by := (select auth.uid());
    new.updated_by := (select auth.uid());
    new.submitted_at := null;
    new.submitted_by := null;
    new.closed_at := null;
    new.closed_by := null;

    if new.supervisor_employee_id is null then
      new.supervisor_employee_id := current_employee;
    end if;

    if (select auth.uid()) is not null
       and current_user_role is distinct from 'system_administrator'::public.app_role
       and not private.is_employee_assigned_supervisor(
         new.supervisor_employee_id,
         new.line_model_assignment_id,
         new.shift_id,
         new.production_date
       ) then
      raise exception 'The selected supervisor is not assigned to this line, shift and date.';
    end if;

    new.target_id := null;
    new.target_percentage := null;

    select target.id, target.target_percentage
    into new.target_id, new.target_percentage
    from public.ipd_targets as target
    where target.line_model_assignment_id = new.line_model_assignment_id
      and target.active = true
      and (target.shift_id = new.shift_id or target.shift_id is null)
      and target.effective_from <= new.production_date
      and (target.effective_to is null or target.effective_to >= new.production_date)
    order by
      case when target.shift_id = new.shift_id then 0 else 1 end,
      target.effective_from desc
    limit 1;

    if new.status = 'no_production'::public.ipd_record_status then
      new.produced_quantity := 0;
      new.defective_harness_quantity := 0;
      new.total_defects := 0;
    end if;

    if new.status = 'submitted'::public.ipd_record_status then
      new.submitted_at := pg_catalog.now();
      new.submitted_by := (select auth.uid());
    end if;

    return new;
  end if;

  if current_user_role = 'quality_supervisor'::public.app_role then
    if old.status is distinct from 'draft'::public.ipd_record_status then
      raise exception 'Only draft records can be edited by a supervisor.';
    end if;

    if new.production_date is distinct from old.production_date
       or new.line_model_assignment_id is distinct from old.line_model_assignment_id
       or new.shift_id is distinct from old.shift_id
       or new.supervisor_employee_id is distinct from old.supervisor_employee_id then
      raise exception 'A supervisor cannot change the date, line, shift or responsible supervisor.';
    end if;

    if new.supervisor_employee_id is distinct from current_employee then
      raise exception 'A supervisor can only edit records assigned to their employee profile.';
    end if;

    if new.status not in (
      'draft'::public.ipd_record_status,
      'submitted'::public.ipd_record_status,
      'no_production'::public.ipd_record_status
    ) then
      raise exception 'The requested status transition is not allowed.';
    end if;
  end if;

  if old.status = 'closed'::public.ipd_record_status then
    if current_user_role not in (
      'system_administrator'::public.app_role,
      'quality_manager'::public.app_role
    ) then
      raise exception 'Closed records cannot be modified by this user.';
    end if;

    if new.status is distinct from 'submitted'::public.ipd_record_status then
      raise exception 'A closed record must be reopened before it can be modified.';
    end if;

    if new.modification_reason is null
       or length(btrim(new.modification_reason)) = 0 then
      raise exception 'A modification reason is required to reopen a closed record.';
    end if;

    if new.production_date is distinct from old.production_date
       or new.line_model_assignment_id is distinct from old.line_model_assignment_id
       or new.shift_id is distinct from old.shift_id
       or new.supervisor_employee_id is distinct from old.supervisor_employee_id
       or new.produced_quantity is distinct from old.produced_quantity
       or new.defective_harness_quantity is distinct from old.defective_harness_quantity
       or new.comment is distinct from old.comment then
      raise exception 'Reopen the record first, then apply the requested changes.';
    end if;
  end if;

  if new.status = 'closed'::public.ipd_record_status
     and old.status is distinct from 'closed'::public.ipd_record_status then
    if current_user_role not in (
      'system_administrator'::public.app_role,
      'quality_manager'::public.app_role
    ) then
      raise exception 'Only a quality manager or administrator can close records.';
    end if;

    if old.status is distinct from 'submitted'::public.ipd_record_status then
      raise exception 'Only a submitted record can be closed.';
    end if;
  end if;

  if (select auth.uid()) is not null
     and current_user_role is distinct from 'system_administrator'::public.app_role
     and (
       new.production_date is distinct from old.production_date
       or new.line_model_assignment_id is distinct from old.line_model_assignment_id
       or new.shift_id is distinct from old.shift_id
       or new.supervisor_employee_id is distinct from old.supervisor_employee_id
     )
     and not private.is_employee_assigned_supervisor(
       new.supervisor_employee_id,
       new.line_model_assignment_id,
       new.shift_id,
       new.production_date
     ) then
    raise exception 'The selected supervisor is not assigned to this line, shift and date.';
  end if;

  select coalesce(sum(detail.quantity), 0)::integer
  into calculated_defects
  from public.daily_ipd_defects as detail
  where detail.daily_ipd_record_id = old.id;

  new.total_defects := calculated_defects;
  new.version := old.version + 1;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := pg_catalog.now();
  new.updated_by := (select auth.uid());
  new.submitted_at := old.submitted_at;
  new.submitted_by := old.submitted_by;
  new.closed_at := old.closed_at;
  new.closed_by := old.closed_by;

  if new.production_date is distinct from old.production_date
     or new.line_model_assignment_id is distinct from old.line_model_assignment_id
     or new.shift_id is distinct from old.shift_id then
    new.target_id := null;
    new.target_percentage := null;

    select target.id, target.target_percentage
    into new.target_id, new.target_percentage
    from public.ipd_targets as target
    where target.line_model_assignment_id = new.line_model_assignment_id
      and target.active = true
      and (target.shift_id = new.shift_id or target.shift_id is null)
      and target.effective_from <= new.production_date
      and (target.effective_to is null or target.effective_to >= new.production_date)
    order by
      case when target.shift_id = new.shift_id then 0 else 1 end,
      target.effective_from desc
    limit 1;
  else
    new.target_id := old.target_id;
    new.target_percentage := old.target_percentage;
  end if;

  if new.status = 'no_production'::public.ipd_record_status then
    if calculated_defects > 0 then
      raise exception 'Remove all defect details before setting No Production.';
    end if;

    new.produced_quantity := 0;
    new.defective_harness_quantity := 0;
    new.total_defects := 0;
  end if;

  if new.status = 'submitted'::public.ipd_record_status
     and old.status is distinct from 'submitted'::public.ipd_record_status then
    new.submitted_at := pg_catalog.now();
    new.submitted_by := (select auth.uid());
  end if;

  if new.status = 'closed'::public.ipd_record_status
     and old.status is distinct from 'closed'::public.ipd_record_status then
    new.closed_at := pg_catalog.now();
    new.closed_by := (select auth.uid());
  end if;

  return new;
end;
$$;

create or replace function public.prepare_daily_ipd_defect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := pg_catalog.now();
    new.updated_at := pg_catalog.now();
    new.created_by := (select auth.uid());
    new.updated_by := (select auth.uid());
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := pg_catalog.now();
    new.updated_by := (select auth.uid());
  end if;

  return new;
end;
$$;

-- =========================================================
-- DATA API PRIVILEGES
-- =========================================================

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;

grant usage on type public.app_role to authenticated;
grant usage on type public.theme_preference to authenticated;
grant usage on type public.ipd_record_status to authenticated;
grant usage on type public.import_batch_status to authenticated;
grant usage on type public.audit_action to authenticated;

grant select on table
  public.plants,
  public.shifts,
  public.customers,
  public.product_models,
  public.production_lines,
  public.line_model_assignments,
  public.employees,
  public.user_profiles,
  public.user_plant_access,
  public.supervisor_assignments,
  public.ipd_targets,
  public.defect_types,
  public.daily_ipd_records,
  public.daily_ipd_defects,
  public.employee_import_batches,
  public.employee_import_staging,
  public.audit_logs,
  public.daily_ipd_overview
  to authenticated;

grant insert, update on table
  public.plants,
  public.shifts,
  public.customers,
  public.product_models,
  public.production_lines,
  public.line_model_assignments,
  public.employees,
  public.user_profiles,
  public.user_plant_access,
  public.supervisor_assignments,
  public.ipd_targets,
  public.defect_types,
  public.daily_ipd_records,
  public.employee_import_batches,
  public.employee_import_staging
  to authenticated;

grant insert, update, delete on table public.daily_ipd_defects to authenticated;

grant execute on function private.is_active_user() to authenticated;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.current_employee_id() to authenticated;
grant execute on function private.has_any_role(public.app_role[]) to authenticated;
grant execute on function private.is_system_administrator() to authenticated;
grant execute on function private.is_quality_manager_or_administrator() to authenticated;
grant execute on function private.has_plant_access(uuid) to authenticated;
grant execute on function private.production_line_plant_id(uuid) to authenticated;
grant execute on function private.can_access_production_line(uuid) to authenticated;
grant execute on function private.assignment_plant_id(uuid) to authenticated;
grant execute on function private.can_access_assignment(uuid) to authenticated;
grant execute on function private.is_employee_assigned_supervisor(uuid, uuid, uuid, date) to authenticated;
grant execute on function private.is_current_user_assigned_supervisor(uuid, uuid, date) to authenticated;
grant execute on function private.can_create_daily_record(uuid, uuid, date, uuid) to authenticated;
grant execute on function private.can_read_daily_record(uuid) to authenticated;
grant execute on function private.can_edit_daily_record(uuid) to authenticated;
grant execute on function public.update_my_preferences(public.theme_preference, uuid) to authenticated;

-- =========================================================
-- PLANTS
-- =========================================================

create policy plants_select_policy
on public.plants
for select
to authenticated
using (
  private.is_active_user()
  and private.has_plant_access(id)
);

create policy plants_insert_policy
on public.plants
for insert
to authenticated
with check (private.is_system_administrator());

create policy plants_update_policy
on public.plants
for update
to authenticated
using (private.is_system_administrator())
with check (private.is_system_administrator());

-- =========================================================
-- SHIFTS
-- =========================================================

create policy shifts_select_policy
on public.shifts
for select
to authenticated
using (private.is_active_user());

create policy shifts_insert_policy
on public.shifts
for insert
to authenticated
with check (private.is_system_administrator());

create policy shifts_update_policy
on public.shifts
for update
to authenticated
using (private.is_system_administrator())
with check (private.is_system_administrator());

-- =========================================================
-- GLOBAL CATALOGS
-- =========================================================

create policy customers_select_policy
on public.customers
for select
to authenticated
using (private.is_active_user());

create policy customers_insert_policy
on public.customers
for insert
to authenticated
with check (private.is_system_administrator());

create policy customers_update_policy
on public.customers
for update
to authenticated
using (private.is_system_administrator())
with check (private.is_system_administrator());

create policy product_models_select_policy
on public.product_models
for select
to authenticated
using (private.is_active_user());

create policy product_models_insert_policy
on public.product_models
for insert
to authenticated
with check (private.is_system_administrator());

create policy product_models_update_policy
on public.product_models
for update
to authenticated
using (private.is_system_administrator())
with check (private.is_system_administrator());

create policy defect_types_select_policy
on public.defect_types
for select
to authenticated
using (private.is_active_user());

create policy defect_types_insert_policy
on public.defect_types
for insert
to authenticated
with check (private.is_quality_manager_or_administrator());

create policy defect_types_update_policy
on public.defect_types
for update
to authenticated
using (private.is_quality_manager_or_administrator())
with check (private.is_quality_manager_or_administrator());

-- =========================================================
-- PRODUCTION LINES AND MODEL ASSIGNMENTS
-- =========================================================

create policy production_lines_select_policy
on public.production_lines
for select
to authenticated
using (
  private.is_active_user()
  and private.has_plant_access(plant_id)
);

create policy production_lines_insert_policy
on public.production_lines
for insert
to authenticated
with check (
  private.is_quality_manager_or_administrator()
  and private.has_plant_access(plant_id)
);

create policy production_lines_update_policy
on public.production_lines
for update
to authenticated
using (
  private.is_quality_manager_or_administrator()
  and private.has_plant_access(plant_id)
)
with check (
  private.is_quality_manager_or_administrator()
  and private.has_plant_access(plant_id)
);

create policy line_model_assignments_select_policy
on public.line_model_assignments
for select
to authenticated
using (
  private.is_active_user()
  and private.can_access_production_line(production_line_id)
);

create policy line_model_assignments_insert_policy
on public.line_model_assignments
for insert
to authenticated
with check (
  private.is_quality_manager_or_administrator()
  and private.can_access_production_line(production_line_id)
);

create policy line_model_assignments_update_policy
on public.line_model_assignments
for update
to authenticated
using (
  private.is_quality_manager_or_administrator()
  and private.can_access_production_line(production_line_id)
)
with check (
  private.is_quality_manager_or_administrator()
  and private.can_access_production_line(production_line_id)
);

-- =========================================================
-- EMPLOYEES AND USERS
-- =========================================================

create policy employees_select_policy
on public.employees
for select
to authenticated
using (
  private.is_active_user()
  and (
    id = private.current_employee_id()
    or private.is_system_administrator()
    or private.has_plant_access(plant_id)
  )
);

create policy employees_insert_policy
on public.employees
for insert
to authenticated
with check (private.is_system_administrator());

create policy employees_update_policy
on public.employees
for update
to authenticated
using (private.is_system_administrator())
with check (private.is_system_administrator());

create policy user_profiles_select_policy
on public.user_profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or private.is_system_administrator()
);

create policy user_profiles_insert_policy
on public.user_profiles
for insert
to authenticated
with check (private.is_system_administrator());

create policy user_profiles_update_policy
on public.user_profiles
for update
to authenticated
using (private.is_system_administrator())
with check (private.is_system_administrator());

create policy user_plant_access_select_policy
on public.user_plant_access
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_system_administrator()
);

create policy user_plant_access_insert_policy
on public.user_plant_access
for insert
to authenticated
with check (private.is_system_administrator());

create policy user_plant_access_update_policy
on public.user_plant_access
for update
to authenticated
using (private.is_system_administrator())
with check (private.is_system_administrator());

-- =========================================================
-- SUPERVISOR ASSIGNMENTS
-- =========================================================

create policy supervisor_assignments_select_policy
on public.supervisor_assignments
for select
to authenticated
using (
  private.is_active_user()
  and (
    supervisor_employee_id = private.current_employee_id()
    or private.can_access_assignment(line_model_assignment_id)
  )
);

create policy supervisor_assignments_insert_policy
on public.supervisor_assignments
for insert
to authenticated
with check (
  private.is_quality_manager_or_administrator()
  and private.can_access_assignment(line_model_assignment_id)
);

create policy supervisor_assignments_update_policy
on public.supervisor_assignments
for update
to authenticated
using (
  private.is_quality_manager_or_administrator()
  and private.can_access_assignment(line_model_assignment_id)
)
with check (
  private.is_quality_manager_or_administrator()
  and private.can_access_assignment(line_model_assignment_id)
);

-- =========================================================
-- IPD TARGETS
-- =========================================================

create policy ipd_targets_select_policy
on public.ipd_targets
for select
to authenticated
using (
  private.is_active_user()
  and private.can_access_assignment(line_model_assignment_id)
);

create policy ipd_targets_insert_policy
on public.ipd_targets
for insert
to authenticated
with check (
  private.is_quality_manager_or_administrator()
  and private.can_access_assignment(line_model_assignment_id)
);

create policy ipd_targets_update_policy
on public.ipd_targets
for update
to authenticated
using (
  private.is_quality_manager_or_administrator()
  and private.can_access_assignment(line_model_assignment_id)
)
with check (
  private.is_quality_manager_or_administrator()
  and private.can_access_assignment(line_model_assignment_id)
);

-- =========================================================
-- DAILY IPD RECORDS
-- =========================================================

create policy daily_ipd_records_select_policy
on public.daily_ipd_records
for select
to authenticated
using (
  private.is_active_user()
  and (
    private.can_access_assignment(line_model_assignment_id)
    or (
      private.current_app_role() = 'quality_supervisor'::public.app_role
      and supervisor_employee_id = private.current_employee_id()
      and private.is_current_user_assigned_supervisor(
        line_model_assignment_id,
        shift_id,
        production_date
      )
    )
  )
);

create policy daily_ipd_records_insert_policy
on public.daily_ipd_records
for insert
to authenticated
with check (
  status <> 'closed'::public.ipd_record_status
  and private.can_create_daily_record(
    line_model_assignment_id,
    shift_id,
    production_date,
    supervisor_employee_id
  )
);

create policy daily_ipd_records_manager_update_policy
on public.daily_ipd_records
for update
to authenticated
using (
  private.is_quality_manager_or_administrator()
  and private.can_access_assignment(line_model_assignment_id)
)
with check (
  private.is_quality_manager_or_administrator()
  and private.can_access_assignment(line_model_assignment_id)
);

create policy daily_ipd_records_supervisor_update_policy
on public.daily_ipd_records
for update
to authenticated
using (
  private.current_app_role() = 'quality_supervisor'::public.app_role
  and status = 'draft'::public.ipd_record_status
  and supervisor_employee_id = private.current_employee_id()
  and private.is_current_user_assigned_supervisor(
    line_model_assignment_id,
    shift_id,
    production_date
  )
)
with check (
  private.current_app_role() = 'quality_supervisor'::public.app_role
  and status in (
    'draft'::public.ipd_record_status,
    'submitted'::public.ipd_record_status,
    'no_production'::public.ipd_record_status
  )
  and supervisor_employee_id = private.current_employee_id()
  and private.is_current_user_assigned_supervisor(
    line_model_assignment_id,
    shift_id,
    production_date
  )
);

-- No DELETE policy: daily records are retained for auditability.

-- =========================================================
-- DAILY DEFECT DETAILS
-- =========================================================

create policy daily_ipd_defects_select_policy
on public.daily_ipd_defects
for select
to authenticated
using (
  private.can_read_daily_record(daily_ipd_record_id)
);

create policy daily_ipd_defects_insert_policy
on public.daily_ipd_defects
for insert
to authenticated
with check (
  private.can_edit_daily_record(daily_ipd_record_id)
);

create policy daily_ipd_defects_update_policy
on public.daily_ipd_defects
for update
to authenticated
using (
  private.can_edit_daily_record(daily_ipd_record_id)
)
with check (
  private.can_edit_daily_record(daily_ipd_record_id)
);

create policy daily_ipd_defects_delete_policy
on public.daily_ipd_defects
for delete
to authenticated
using (
  private.can_edit_daily_record(daily_ipd_record_id)
);

-- =========================================================
-- EMPLOYEE IMPORT
-- =========================================================

create policy employee_import_batches_select_policy
on public.employee_import_batches
for select
to authenticated
using (private.is_system_administrator());

create policy employee_import_batches_insert_policy
on public.employee_import_batches
for insert
to authenticated
with check (private.is_system_administrator());

create policy employee_import_batches_update_policy
on public.employee_import_batches
for update
to authenticated
using (private.is_system_administrator())
with check (private.is_system_administrator());

create policy employee_import_staging_select_policy
on public.employee_import_staging
for select
to authenticated
using (private.is_system_administrator());

create policy employee_import_staging_insert_policy
on public.employee_import_staging
for insert
to authenticated
with check (private.is_system_administrator());

create policy employee_import_staging_update_policy
on public.employee_import_staging
for update
to authenticated
using (private.is_system_administrator())
with check (private.is_system_administrator());

-- =========================================================
-- AUDIT LOG
-- =========================================================

create policy audit_logs_select_policy
on public.audit_logs
for select
to authenticated
using (private.is_system_administrator());

-- Audit inserts remain exclusive to the security-definer trigger.

-- =========================================================
-- REALTIME
-- daily_ipd_records is updated whenever its defect detail changes,
-- so this single publication feeds the live operations screen.
-- =========================================================

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'daily_ipd_records'
  ) then
    alter publication supabase_realtime
      add table public.daily_ipd_records;
  end if;
end;
$$;

commit;
