-- Security hardening after Supabase advisor review.

-- Views that only read public data run with the caller's permissions.
alter view public.review_scores set (security_invoker = on);
alter view public.price_points set (security_invoker = on);
alter view public.price_index set (security_invoker = on);
-- seller_directory stays owner-run on purpose: it publishes the price-discrimination flag
-- computed from raw mystery-shop quotes, which the public must never read directly.
comment on view public.seller_directory is 'Owner-run by design: exposes aggregate flags from moderator-only shop_quotes.';

-- Pin search_path on every function.
alter function public.is_service() set search_path = public;
alter function public.guard_profile() set search_path = public;
alter function public.guard_seller() set search_path = public;
alter function public.guard_review() set search_path = public;

-- Trigger functions should not be callable over the API.
-- (is_moderator stays executable: RLS policies call it as the requesting user.)
revoke execute on function public.apply_evidence() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- Keep extensions out of the API schema.
alter extension pg_trgm set schema extensions;
