begin;

grant execute
on function public.normalize_text(text)
to authenticated;

commit;
