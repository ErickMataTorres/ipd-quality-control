begin;

-- =========================================================
-- PRODUCTION LINE AUTHORIZATION HELPERS
-- =========================================================

create or replace function private.production_line_plant_id(
  target_production_line_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select production_line.plant_id
  from public.production_lines as production_line
  where production_line.id =
        target_production_line_id
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
  select
    private.is_active_user()
    and private.has_plant_access(
      private.production_line_plant_id(
        target_production_line_id
      )
    );
$$;

grant execute on function
  private.production_line_plant_id(uuid)
to authenticated;

grant execute on function
  private.can_access_production_line(uuid)
to authenticated;

-- =========================================================
-- ONE MODEL ASSIGNMENT PER LINE AND PERIOD
-- =========================================================

alter table public.line_model_assignments
  drop constraint if exists
  line_model_assignments_no_overlap;

alter table public.line_model_assignments
  add constraint line_model_assignments_no_overlap
  exclude using gist (
    production_line_id with =,
    daterange(
      effective_from,
      coalesce(effective_to, 'infinity'::date),
      '[]'
    ) with &&
  );

-- =========================================================
-- CORRECT LINE-MODEL ASSIGNMENT POLICIES
-- =========================================================

drop policy if exists
  line_model_assignments_insert_policy
on public.line_model_assignments;

drop policy if exists
  line_model_assignments_update_policy
on public.line_model_assignments;

create policy line_model_assignments_insert_policy
on public.line_model_assignments
for insert
to authenticated
with check (
  private.is_quality_manager_or_administrator()
  and private.can_access_production_line(
    production_line_id
  )
);

create policy line_model_assignments_update_policy
on public.line_model_assignments
for update
to authenticated
using (
  private.is_quality_manager_or_administrator()
  and private.can_access_assignment(id)
)
with check (
  private.is_quality_manager_or_administrator()
  and private.can_access_production_line(
    production_line_id
  )
);

commit;
