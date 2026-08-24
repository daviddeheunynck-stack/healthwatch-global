-- Lets a verification stamp be recorded without it reading as a data change.
--
-- `source_confirmed_at` (migration 20260822120000) records that a primary
-- source was re-opened and carried nothing newer than the row's `date`. Until
-- now nothing wrote it outside that migration's own backfill — yet the sync
-- crons reach exactly that conclusion on every `skip: "unchanged"` (source
-- fetched, an entry for this row parsed, nothing newer than `date`) and threw
-- it away. lib/source-confirmed.ts (2026-08-24) wires them to it.
--
-- That wiring runs into the BEFORE UPDATE trigger installed with the initial
-- schema, which stamps `updated_at = NOW()` on every update without exception.
-- A verification stamp would therefore refresh `updated_at` too — and
-- `updated_at` is what every staleness check reads, both the client-facing
-- badge and scripts/morning-don-check.mjs. The net effect would be to SILENCE
-- stale rows instead of labelling them correctly: precisely the failure mode
-- the 4d-bis comment in morning-don-check.mjs already warns about ("une
-- écriture cosmétique rafraîchit `updated_at` sans que personne n'ait cherché
-- une édition plus récente, et masquerait alors le cluster entier pendant 14
-- jours"), and the reason scripts/touch-verified-rows-2026-08-05.mjs — which
-- recorded "verified, unchanged" by bumping `updated_at` — was abandoned in
-- favour of the FROZEN_ROW_CHECKED / CLUSTER_EDITION_CHECKED maps.
--
-- So the trigger has to learn the difference between the two facts:
--   updated_at          — the epidemiological content of this row changed
--   source_confirmed_at — someone looked, and there was nothing new
-- An update whose only difference is the verification stamp now preserves the
-- previous `updated_at`.
--
-- Two deliberate consequences, both wanted:
--   * A genuine no-op write (every column re-sent identical) also stops
--     bumping `updated_at`. A write that changed nothing was never a refresh,
--     and counting it as one is what made `updated_at` unreliable here.
--   * The touch-to-silence workaround stops working by construction: an update
--     carrying `updated_at` alone is now a no-op. Recording a verification is
--     what `source_confirmed_at` is for.
--
-- Implemented as a dedicated function rather than by editing the shared
-- public.set_updated_at(): that one is generic and other tables must keep the
-- unconditional behaviour.

create or replace function public.set_outbreaks_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- Compare the whole row minus the two bookkeeping columns rather than an
  -- explicit column list: cheaper to reason about, and it cannot drift out of
  -- date the next time a column is added to `outbreaks`.
  if (to_jsonb(new) - 'source_confirmed_at' - 'updated_at')
     = (to_jsonb(old) - 'source_confirmed_at' - 'updated_at') then
    new.updated_at := old.updated_at;
    return new;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_outbreaks_updated_at on public.outbreaks;

create trigger set_outbreaks_updated_at
  before update on public.outbreaks
  for each row execute function public.set_outbreaks_updated_at();

comment on function public.set_outbreaks_updated_at() is
  'Stamps outbreaks.updated_at on real content changes only. An update whose sole difference is source_confirmed_at (a verification stamp) keeps the previous updated_at, so re-reading a source without finding anything new cannot masquerade as a refresh.';
