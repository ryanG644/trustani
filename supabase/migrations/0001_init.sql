-- TrustAni core schema
-- Sellers keyed by +263 phone numbers, evidence-tiered reviews, price index, mystery-shop quotes.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

-- True for the service-role key and for direct database sessions (SQL editor, migrations).
-- API requests run as the anon/authenticated roles, so they never match the second test.
create or replace function public.is_service() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or (session_user <> 'authenticator'
          and coalesce(nullif(current_setting('role', true), ''), 'none') = 'none')
$$;

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_service() or exists (
    select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin')
  )
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Buyer')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.guard_profile() returns trigger
language plpgsql as $$
begin
  if not public.is_moderator() then
    new.role := old.role;
  end if;
  return new;
end $$;

create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- ---------------------------------------------------------------------------
-- Categories (config, not code)
-- ---------------------------------------------------------------------------
create table public.categories (
  id text primary key,
  name text not null,
  dims jsonb not null,   -- [{key, label, hint, weight}]
  items jsonb not null,  -- [{key, label}]
  units jsonb not null,  -- [{key, label}]
  sort int not null default 0
);

-- ---------------------------------------------------------------------------
-- Sellers
-- ---------------------------------------------------------------------------
create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  province text not null,
  town text,
  yard text,
  delivers_to text,
  trucks text,
  categories text[] not null default '{}',
  items text[] not null default '{}',
  source text not null default 'user' check (source in ('user', 'lead', 'seller')),
  source_url text,
  verified boolean not null default false, -- TrustTrust badge
  status text not null default 'active' check (status in ('active', 'hidden', 'merged')),
  merged_into uuid references public.sellers (id),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index sellers_name_trgm on public.sellers using gin (name gin_trgm_ops);
create index sellers_province on public.sellers (province);
create index sellers_items on public.sellers using gin (items);

create or replace function public.guard_seller() returns trigger
language plpgsql as $$
begin
  if not public.is_moderator() then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.status := 'active';
      new.source := 'user';
      new.created_by := auth.uid();
    else
      new.verified := old.verified;
      new.status := old.status;
      new.source := old.source;
      new.created_by := old.created_by;
      new.merged_into := old.merged_into;
    end if;
  end if;
  return new;
end $$;

create trigger guard_seller before insert or update on public.sellers
  for each row execute function public.guard_seller();

create table public.seller_phones (
  phone text primary key check (phone ~ '^\+[0-9]{8,15}$'),
  seller_id uuid not null references public.sellers (id) on delete cascade,
  is_whatsapp boolean not null default true,
  added_by uuid default auth.uid(),
  added_at timestamptz not null default now()
);
create index seller_phones_seller on public.seller_phones (seller_id);

-- ---------------------------------------------------------------------------
-- Reviews and evidence
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  category_id text not null references public.categories (id),
  ratings jsonb not null,
  load_status text check (load_status in ('full', 'slightly_short', 'clearly_short', 'not_measured')),
  item text,
  qty numeric check (qty > 0),
  unit text,
  paid_usd numeric check (paid_usd >= 0),
  purchase_month date,
  body text check (char_length(body) <= 2000),
  tier smallint not null default 1 check (tier between 1 and 3),
  status text not null default 'published' check (status in ('published', 'pending', 'removed')),
  is_mystery_shop boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, author_id)
);
create index reviews_seller on public.reviews (seller_id);

create or replace function public.guard_review() returns trigger
language plpgsql as $$
begin
  if not public.is_moderator() then
    if tg_op = 'INSERT' then
      new.tier := 1;
      new.status := 'published';
      new.is_mystery_shop := false;
      new.author_id := auth.uid();
    else
      new.tier := old.tier;
      new.status := old.status;
      new.is_mystery_shop := old.is_mystery_shop;
      new.author_id := old.author_id;
      new.seller_id := old.seller_id;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger guard_review before insert or update on public.reviews
  for each row execute function public.guard_review();

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  uploader_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('payment_ref', 'receipt', 'delivery_photo', 'chat', 'other')),
  txn_ref text check (char_length(txn_ref) <= 80),
  storage_path text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  granted_tier smallint check (granted_tier between 1 and 3),
  reviewed_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- When a moderator accepts evidence, lift the review's tier.
create or replace function public.apply_evidence() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and new.granted_tier is not null then
    update public.reviews set tier = greatest(tier, new.granted_tier) where id = new.review_id;
  end if;
  return new;
end $$;

create trigger apply_evidence after update on public.evidence
  for each row when (new.status is distinct from old.status)
  execute function public.apply_evidence();

-- ---------------------------------------------------------------------------
-- Prices, public signals, mystery shops
-- ---------------------------------------------------------------------------
create table public.price_reports (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.sellers (id) on delete set null,
  category_id text references public.categories (id),
  item text not null,
  unit text not null,
  price_usd numeric not null check (price_usd > 0),
  province text,
  town text,
  source text not null check (source in ('report', 'shop', 'listing')),
  source_url text,
  observed_on date not null default current_date,
  author_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index price_reports_item on public.price_reports (item, unit, province);

-- T0 signals: links to public complaints. Never imported as reviews.
create table public.signals (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers (id) on delete cascade,
  url text not null,
  note text check (char_length(note) <= 300),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.shop_quotes (
  id uuid primary key default gen_random_uuid(),
  round text not null,
  seller_id uuid not null references public.sellers (id) on delete cascade,
  item text not null,
  qty numeric not null default 1 check (qty > 0),
  unit text not null,
  area text,
  profile text not null check (profile in ('local_shona', 'local_ndebele', 'local_english', 'foreign', 'diaspora')),
  quote_usd numeric not null check (quote_usd > 0),
  quoted_at timestamptz not null default now(),
  shopper text,
  call_ref text,
  notes text,
  created_at timestamptz not null default now()
);
create index shop_quotes_seller on public.shop_quotes (seller_id, round);

-- ---------------------------------------------------------------------------
-- Derived views (run as owner, so they publish aggregates without exposing raw quotes)
-- ---------------------------------------------------------------------------
create or replace view public.review_scores as
select
  r.id,
  r.seller_id,
  r.tier,
  r.load_status,
  r.created_at,
  (
    select sum((r.ratings ->> (d ->> 'key'))::numeric * (d ->> 'weight')::numeric)
         / nullif(sum((d ->> 'weight')::numeric), 0)
    from public.categories c, jsonb_array_elements(c.dims) d
    where c.id = r.category_id and r.ratings ? (d ->> 'key')
  ) as weighted,
  (case r.tier when 3 then 1.0 when 2 then 0.7 else 0.4 end)
    * (case when r.created_at < now() - interval '12 months' then 0.5 else 1.0 end) as w
from public.reviews r
where r.status = 'published';

create or replace view public.seller_quote_spreads as
select seller_id, round, item, unit,
  max(quote_usd / qty) / nullif(min(quote_usd / qty), 0) - 1 as spread
from public.shop_quotes
group by seller_id, round, item, unit
having count(distinct profile) >= 2;

create or replace view public.seller_directory as
with stats as (
  select seller_id,
    count(*) as review_count,
    count(*) filter (where tier >= 2) as verified_count,
    round((((3.5 * 3) + sum(weighted * w)) / (3 + sum(w)) - 1) / 4 * 100)::int as score,
    count(*) filter (where load_status in ('slightly_short', 'clearly_short')) as short_count,
    count(*) filter (where load_status in ('full', 'slightly_short', 'clearly_short')) as measured_count
  from public.review_scores
  where weighted is not null
  group by seller_id
),
spreads as (
  select seller_id,
    count(distinct round) filter (where spread > 0.2) as discrim_rounds,
    max(spread) as max_spread
  from public.seller_quote_spreads
  group by seller_id
),
phones as (
  select seller_id, array_agg(phone order by added_at) as phones
  from public.seller_phones group by seller_id
),
sig as (
  select seller_id, count(*) as signal_count from public.signals group by seller_id
)
select
  s.id, s.name, s.province, s.town, s.yard, s.delivers_to, s.trucks,
  s.categories, s.items, s.source, s.source_url, s.verified, s.created_by, s.created_at,
  coalesce(p.phones, '{}') as phones,
  coalesce(st.review_count, 0) as review_count,
  coalesce(st.verified_count, 0) as verified_count,
  st.score,
  coalesce(st.short_count, 0) as short_count,
  coalesce(st.measured_count, 0) as measured_count,
  (coalesce(st.short_count, 0) >= 2
    and st.short_count::numeric / nullif(st.measured_count, 0) >= 0.25) as short_flag,
  coalesce(sp.discrim_rounds, 0) >= 2 as discrim_flag,
  sp.max_spread,
  coalesce(sg.signal_count, 0) as signal_count
from public.sellers s
left join stats st on st.seller_id = s.id
left join spreads sp on sp.seller_id = s.id
left join phones p on p.seller_id = s.id
left join sig sg on sg.seller_id = s.id
where s.status = 'active';

create or replace view public.price_points as
select pr.item, pr.unit, pr.price_usd, pr.province, pr.town, pr.observed_on, pr.seller_id,
  case pr.source when 'listing' then 'advertised' when 'shop' then 'quoted' else 'paid' end as kind
from public.price_reports pr
union all
select r.item, r.unit, r.paid_usd / r.qty, s.province, s.town,
  coalesce(r.purchase_month, r.created_at::date), r.seller_id, 'paid'
from public.reviews r
join public.sellers s on s.id = r.seller_id
where r.status = 'published' and r.item is not null and r.qty > 0 and r.paid_usd > 0;

create or replace view public.price_index as
select item, unit, province, kind,
  count(*) as n,
  percentile_cont(0.25) within group (order by price_usd) as p25,
  percentile_cont(0.5) within group (order by price_usd) as median,
  percentile_cont(0.75) within group (order by price_usd) as p75,
  max(observed_on) as latest
from public.price_points
where observed_on > current_date - 90
group by item, unit, province, kind;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.sellers enable row level security;
alter table public.seller_phones enable row level security;
alter table public.reviews enable row level security;
alter table public.evidence enable row level security;
alter table public.price_reports enable row level security;
alter table public.signals enable row level security;
alter table public.shop_quotes enable row level security;

create policy "profiles readable" on public.profiles for select using (true);
create policy "own profile" on public.profiles for update using (id = auth.uid() or public.is_moderator());

create policy "categories readable" on public.categories for select using (true);
create policy "categories admin" on public.categories for all using (public.is_moderator()) with check (public.is_moderator());

create policy "sellers readable" on public.sellers for select using (status = 'active' or public.is_moderator());
create policy "sellers insert" on public.sellers for insert to authenticated with check (true);
create policy "sellers update" on public.sellers for update using (public.is_moderator() or created_by = auth.uid());
create policy "sellers delete" on public.sellers for delete using (public.is_moderator());

create policy "phones readable" on public.seller_phones for select using (true);
create policy "phones insert" on public.seller_phones for insert to authenticated with check (
  public.is_moderator() or exists (select 1 from public.sellers s where s.id = seller_id and s.created_by = auth.uid())
);
create policy "phones moderate" on public.seller_phones for delete using (public.is_moderator());

create policy "reviews readable" on public.reviews for select using (status = 'published' or author_id = auth.uid() or public.is_moderator());
create policy "reviews insert" on public.reviews for insert to authenticated with check (true);
create policy "reviews update" on public.reviews for update using (author_id = auth.uid() or public.is_moderator());
create policy "reviews delete" on public.reviews for delete using (author_id = auth.uid() or public.is_moderator());

create policy "evidence own" on public.evidence for select using (uploader_id = auth.uid() or public.is_moderator());
create policy "evidence insert" on public.evidence for insert to authenticated with check (
  uploader_id = auth.uid() and status = 'pending' and granted_tier is null
  and exists (select 1 from public.reviews r where r.id = review_id and r.author_id = auth.uid())
);
create policy "evidence moderate" on public.evidence for update using (public.is_moderator());

create policy "prices readable" on public.price_reports for select using (true);
create policy "prices insert" on public.price_reports for insert to authenticated with check (
  public.is_moderator() or (source = 'report' and author_id = auth.uid())
);
create policy "prices moderate" on public.price_reports for delete using (public.is_moderator());

create policy "signals readable" on public.signals for select using (true);
create policy "signals moderate" on public.signals for all using (public.is_moderator()) with check (public.is_moderator());

create policy "shops moderators only" on public.shop_quotes for all using (public.is_moderator()) with check (public.is_moderator());

grant select on public.seller_directory, public.price_index, public.price_points, public.review_scores to anon, authenticated;
revoke select on public.seller_quote_spreads from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Evidence storage (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
on conflict (id) do nothing;

create policy "evidence upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "evidence read own or moderator" on storage.objects for select
  using (bucket_id = 'evidence' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_moderator()));
