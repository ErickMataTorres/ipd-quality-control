begin;

-- =========================================================
-- USER MANAGEMENT BACKEND
-- Creates or updates the application profile linked to an
-- existing Supabase Auth user. Auth account operations remain
-- in the manage-users Edge Function.
-- =========================================================

create or replace function
public.configure_application_user(
  user_id_value uuid,
  employee_id_value uuid,
  role_value public.app_role,
  default_plant_id_value uuid,
  plant_ids_value uuid[],
  active_value boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid :=
    (select auth.uid());

  existing_role
    public.app_role;

  existing_active
    boolean;

  normalized_plant_ids
    uuid[];

  other_active_administrators
    integer;
begin
  if caller_user_id is null then
    raise exception
      'An authenticated user is required.'
      using errcode = '42501';
  end if;

  if not private.is_system_administrator() then
    raise exception
      'Only a system administrator can manage users.'
      using errcode = '42501';
  end if;

  if user_id_value is null then
    raise exception
      'The user identifier is required.'
      using errcode = '23502';
  end if;

  if employee_id_value is null then
    raise exception
      'The employee identifier is required.'
      using errcode = '23502';
  end if;

  if role_value is null then
    raise exception
      'The application role is required.'
      using errcode = '23502';
  end if;

  if active_value is null then
    raise exception
      'The active status is required.'
      using errcode = '23502';
  end if;

  if not exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = user_id_value
  ) then
    raise exception
      'The Supabase Auth user does not exist.'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.employees as employee
    where employee.id = employee_id_value
  ) then
    raise exception
      'The selected employee does not exist.'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.user_profiles as profile
    where profile.employee_id =
          employee_id_value
      and profile.id <>
          user_id_value
  ) then
    raise exception
      'The selected employee is already linked to another user.'
      using errcode = '23505';
  end if;

  select
    profile.role,
    profile.active
  into
    existing_role,
    existing_active
  from public.user_profiles as profile
  where profile.id = user_id_value;

  if user_id_value = caller_user_id
    and (
      role_value <>
        'system_administrator'::public.app_role
      or active_value = false
    )
  then
    raise exception
      'You cannot remove your own administrator access.'
      using errcode = '42501';
  end if;

  if existing_role =
       'system_administrator'::public.app_role
    and existing_active = true
    and (
      role_value <>
        'system_administrator'::public.app_role
      or active_value = false
    )
  then
    select count(*)::integer
    into other_active_administrators
    from public.user_profiles as profile
    where profile.id <>
          user_id_value
      and profile.role =
          'system_administrator'::public.app_role
      and profile.active = true;

    if other_active_administrators = 0 then
      raise exception
        'At least one active system administrator must remain.'
        using errcode = '23514';
    end if;
  end if;

  select coalesce(
    array_agg(
      distinct selected_plant_id
      order by selected_plant_id
    ),
    array[]::uuid[]
  )
  into normalized_plant_ids
  from unnest(
    coalesce(
      plant_ids_value,
      array[]::uuid[]
    )
  ) as selected_plant_id
  where selected_plant_id is not null;

  if exists (
    select 1
    from unnest(
      normalized_plant_ids
    ) as selected_plant_id
    left join public.plants as plant
      on plant.id =
         selected_plant_id
    where plant.id is null
       or plant.active = false
  ) then
    raise exception
      'One or more selected plants do not exist or are inactive.'
      using errcode = '23503';
  end if;

  if default_plant_id_value is not null
    and not exists (
      select 1
      from public.plants as plant
      where plant.id =
            default_plant_id_value
        and plant.active = true
    )
  then
    raise exception
      'The default plant does not exist or is inactive.'
      using errcode = '23503';
  end if;

  if role_value <>
       'system_administrator'::public.app_role
  then
    if cardinality(
      normalized_plant_ids
    ) = 0 then
      raise exception
        'A non-administrator user must have access to at least one plant.'
        using errcode = '23514';
    end if;

    if default_plant_id_value is null then
      raise exception
        'A non-administrator user must have a default plant.'
        using errcode = '23514';
    end if;

    if not (
      default_plant_id_value =
      any(normalized_plant_ids)
    ) then
      raise exception
        'The default plant must be included in the user plant access.'
        using errcode = '23514';
    end if;
  end if;

  insert into public.user_profiles (
    id,
    employee_id,
    role,
    default_plant_id,
    active
  )
  values (
    user_id_value,
    employee_id_value,
    role_value,
    default_plant_id_value,
    active_value
  )
  on conflict (id)
  do update
  set
    employee_id =
      excluded.employee_id,

    role =
      excluded.role,

    default_plant_id =
      excluded.default_plant_id,

    active =
      excluded.active,

    updated_at =
      pg_catalog.now();

  update public.user_plant_access
  set active = false
  where user_id =
        user_id_value
    and not (
      plant_id =
      any(normalized_plant_ids)
    );

  insert into public.user_plant_access (
    user_id,
    plant_id,
    active
  )
  select
    user_id_value,
    selected_plant_id,
    true
  from unnest(
    normalized_plant_ids
  ) as selected_plant_id
  on conflict (
    user_id,
    plant_id
  )
  do update
  set active = true;
end;
$$;

revoke all
on function
public.configure_application_user(
  uuid,
  uuid,
  public.app_role,
  uuid,
  uuid[],
  boolean
)
from public, anon;

grant execute
on function
public.configure_application_user(
  uuid,
  uuid,
  public.app_role,
  uuid,
  uuid[],
  boolean
)
to authenticated;

commit;
