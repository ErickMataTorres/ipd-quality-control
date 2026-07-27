begin;

drop policy if exists
product_models_insert_policy
on public.product_models;

drop policy if exists
product_models_update_policy
on public.product_models;

create policy
product_models_insert_policy
on public.product_models
for insert
to authenticated
with check (
  private.is_quality_manager_or_administrator()
);

create policy
product_models_update_policy
on public.product_models
for update
to authenticated
using (
  private.is_quality_manager_or_administrator()
)
with check (
  private.is_quality_manager_or_administrator()
);

commit;
