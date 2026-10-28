-- Mystery shoppers: a 'shopper' role that can log quotes and see only their own,
-- while moderators see everything and the public only ever sees the aggregate flag.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'shopper', 'moderator', 'admin'));

alter table public.shop_quotes add column if not exists created_by uuid default auth.uid() references auth.users (id);
alter table public.shop_quotes add column if not exists delivered boolean;
alter table public.shop_quotes add column if not exists phone_called text;

create or replace function public.is_shopper() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('shopper', 'moderator', 'admin'))
$$;

drop policy if exists "shops moderators only" on public.shop_quotes;
create policy "shop quotes moderators" on public.shop_quotes for all
  using (public.is_moderator()) with check (public.is_moderator());
create policy "shop quotes shoppers read own" on public.shop_quotes for select
  using (created_by = auth.uid());
create policy "shop quotes shoppers add own" on public.shop_quotes for insert to authenticated
  with check (public.is_shopper() and created_by = auth.uid());
create policy "shop quotes shoppers fix own" on public.shop_quotes for update
  using (created_by = auth.uid() and public.is_shopper()) with check (created_by = auth.uid());
create policy "shop quotes shoppers delete own" on public.shop_quotes for delete
  using (created_by = auth.uid() and public.is_shopper());
