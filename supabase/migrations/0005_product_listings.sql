-- Product-first browsing: one row per seller per product, with that seller's price for the product,
-- their score and their most useful recent review. The home page shows the top 10 per product.

-- Simplify cement to one product; grade goes in the review text.
update public.categories set
  items = '[{"key":"common_bricks","label":"Common bricks"},{"key":"cement","label":"Cement (50kg bag)"},
            {"key":"face_bricks","label":"Face bricks"},{"key":"blocks","label":"Concrete blocks"}]',
  units = '[{"key":"k1","label":"per 1,000"},{"key":"bag50","label":"50kg bag"},{"key":"each","label":"each"}]'
where id = 'cement_bricks';

create or replace view public.product_listings with (security_invoker = on) as
select
  sd.id, sd.name, sd.province, sd.town, sd.phones, sd.verified, sd.source,
  sd.review_count, sd.verified_count, sd.score,
  sd.short_flag, sd.discrim_flag, sd.signal_count,
  it.item,
  pr.unit, pr.price, pr.kind as price_kind, pr.n as price_reports,
  lr.body as latest_review, lr.overall as latest_rating, lr.tier as latest_tier
from public.seller_directory sd
cross join lateral unnest(sd.items) as it(item)
left join lateral (
  -- Prefer what buyers actually paid, then shopper quotes, then adverts; within that, the most-reported unit.
  select pp.unit, pp.kind, count(*) as n,
    percentile_cont(0.5) within group (order by pp.price_usd) as price
  from public.price_points pp
  where pp.seller_id = sd.id and pp.item = it.item
  group by pp.unit, pp.kind
  order by case pp.kind when 'paid' then 0 when 'quoted' then 1 else 2 end, count(*) desc
  limit 1
) pr on true
left join lateral (
  select r.body, (r.ratings ->> 'overall')::int as overall, r.tier
  from public.reviews r
  where r.seller_id = sd.id and r.status = 'published' and coalesce(r.body, '') <> ''
  order by r.tier desc, r.created_at desc
  limit 1
) lr on true;

grant select on public.product_listings to anon, authenticated;
