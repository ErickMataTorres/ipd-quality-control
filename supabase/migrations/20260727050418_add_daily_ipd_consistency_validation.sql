begin;

-- =========================================================
-- DAILY IPD CONSISTENCY VALIDATION
--
-- Draft records may remain incomplete.
-- Submitted and closed records must satisfy:
--   1. defective harnesses <= produced harnesses
--   2. total defects = 0 when defective harnesses = 0
--   3. total defects >= defective harnesses
--
-- The triggers are deferred until the end of the transaction
-- so save_daily_ipd_record can replace the defect details and
-- then update the final record status atomically.
-- =========================================================

create or replace function
private.validate_daily_ipd_record_consistency(
  record_id_value uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_row
    public.daily_ipd_records%rowtype;

  total_defect_quantity
    integer := 0;
begin
  select *
  into record_row
  from public.daily_ipd_records
  where id = record_id_value;

  if not found then
    return;
  end if;

  -- Incomplete information is allowed while the record is a draft.
  if record_row.status not in (
    'submitted'::public.ipd_record_status,
    'closed'::public.ipd_record_status
  ) then
    return;
  end if;

  select
    coalesce(
      sum(detail.quantity),
      0
    )::integer
  into total_defect_quantity
  from public.daily_ipd_defects as detail
  where detail.daily_ipd_record_id =
        record_row.id;

  if record_row.produced_quantity <= 0 then
    raise exception
      'A submitted record must have production greater than zero.'
      using errcode = 'P2000';
  end if;

  if record_row.defective_harness_quantity < 0
    or record_row.defective_harness_quantity >
       record_row.produced_quantity
  then
    raise exception
      'Defective harness quantity is invalid.'
      using errcode = 'P2003';
  end if;

  if record_row.defective_harness_quantity = 0
    and total_defect_quantity > 0
  then
    raise exception
      'A record with defects must contain at least one defective harness.'
      using errcode = 'P2002';
  end if;

  if total_defect_quantity <
     record_row.defective_harness_quantity
  then
    raise exception
      'Total defect quantity cannot be lower than defective harness quantity.'
      using errcode = 'P2001';
  end if;
end;
$$;

revoke all
on function
private.validate_daily_ipd_record_consistency(uuid)
from public, anon, authenticated;

create or replace function
private.enforce_daily_ipd_record_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_record_id uuid;
begin
  if tg_table_name = 'daily_ipd_records' then
    affected_record_id := new.id;
  else
    if tg_op = 'DELETE' then
      affected_record_id :=
        old.daily_ipd_record_id;
    else
      affected_record_id :=
        new.daily_ipd_record_id;
    end if;
  end if;

  perform
    private.validate_daily_ipd_record_consistency(
      affected_record_id
    );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all
on function
private.enforce_daily_ipd_record_consistency()
from public, anon, authenticated;

drop trigger if exists
daily_ipd_records_consistency_trigger
on public.daily_ipd_records;

create constraint trigger
daily_ipd_records_consistency_trigger
after insert or update
on public.daily_ipd_records
deferrable initially deferred
for each row
execute function
private.enforce_daily_ipd_record_consistency();

drop trigger if exists
daily_ipd_defects_consistency_trigger
on public.daily_ipd_defects;

create constraint trigger
daily_ipd_defects_consistency_trigger
after insert or update or delete
on public.daily_ipd_defects
deferrable initially deferred
for each row
execute function
private.enforce_daily_ipd_record_consistency();

commit;
