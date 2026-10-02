-- Daily price history for the charts, fetched inside Supabase (already applied to the live project on 28 Sep 2026).
-- Weekdays 7:30pm Malaysia time: request Yahoo Finance daily prices for every stock in the last 10 reports,
-- then save them into public.price_bars at 7:40pm (catch-up pass at 8:30pm).

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create schema if not exists jobs;
revoke all on schema jobs from anon, authenticated;

create table if not exists jobs.bar_requests (
  request_id   bigint primary key,
  code         text not null,
  yahoo        text not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  status       int,
  bars_saved   int,
  error        text
);

create or replace function jobs.request_bars() returns int
language plpgsql set search_path = '' as $$
declare rec record; n int := 0; rid bigint; rng text;
begin
  for rec in
    select distinct c.code, c.extra->>'yahoo' as yahoo
    from public.candidates c
    where c.extra->>'yahoo' is not null
      and c.run_date in (select run_date from public.runs order by run_date desc limit 10)
  loop
    rng := case when (select count(*) from public.price_bars p where p.code = rec.code) >= 300 then '1mo' else '2y' end;
    select net.http_get(
      url := format('https://query1.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=1d', rec.yahoo, rng),
      headers := '{"User-Agent":"Mozilla/5.0 (compatible; klse-swing-desk/1.0)"}'::jsonb,
      timeout_milliseconds := 30000) into rid;
    insert into jobs.bar_requests (request_id, code, yahoo) values (rid, rec.code, rec.yahoo);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function jobs.process_bars() returns int
language plpgsql set search_path = '' as $$
declare rec record; saved int; total int := 0; j jsonb; q jsonb; off int;
begin
  for rec in
    select b.request_id, b.code, r.status_code, r.content, r.error_msg
    from jobs.bar_requests b join net._http_response r on r.id = b.request_id
    where b.processed_at is null
  loop
    begin
      if rec.status_code is distinct from 200 then
        update jobs.bar_requests set processed_at = now(), status = rec.status_code, bars_saved = 0,
          error = coalesce(rec.error_msg, left(rec.content, 200)) where request_id = rec.request_id;
        continue;
      end if;
      j := rec.content::jsonb -> 'chart' -> 'result' -> 0;
      q := j -> 'indicators' -> 'quote' -> 0;
      off := coalesce((j -> 'meta' ->> 'gmtoffset')::int, 28800);
      insert into public.price_bars (code, date, open, high, low, close, volume)
      select rec.code, (to_timestamp(t.ts::bigint + off) at time zone 'UTC')::date,
             round((q->'open'->>(t.i-1)::int)::numeric, 4), round((q->'high'->>(t.i-1)::int)::numeric, 4),
             round((q->'low'->>(t.i-1)::int)::numeric, 4), round((q->'close'->>(t.i-1)::int)::numeric, 4),
             coalesce((q->'volume'->>(t.i-1)::int)::numeric, 0)
      from jsonb_array_elements_text(j -> 'timestamp') with ordinality as t(ts, i)
      where q->'open'->>(t.i-1)::int is not null and q->'close'->>(t.i-1)::int is not null
        and q->'high'->>(t.i-1)::int is not null and q->'low'->>(t.i-1)::int is not null
      on conflict (code, date) do update set open = excluded.open, high = excluded.high,
        low = excluded.low, close = excluded.close, volume = excluded.volume;
      get diagnostics saved = row_count;
      update jobs.bar_requests set processed_at = now(), status = 200, bars_saved = saved where request_id = rec.request_id;
      total := total + saved;
    exception when others then
      update jobs.bar_requests set processed_at = now(), status = rec.status_code, bars_saved = 0, error = sqlerrm
        where request_id = rec.request_id;
    end;
  end loop;
  delete from jobs.bar_requests where requested_at < now() - interval '30 days';
  return total;
end $$;

revoke all on function jobs.request_bars() from public, anon, authenticated;
revoke all on function jobs.process_bars() from public, anon, authenticated;

select cron.schedule('klse-request-bars', '30 11 * * 1-5', $$select jobs.request_bars()$$);
select cron.schedule('klse-process-bars', '40 11 * * 1-5', $$select jobs.process_bars()$$);
select cron.schedule('klse-process-bars-catchup', '30 12 * * 1-5', $$select jobs.process_bars()$$);
