-- =============================================================================
-- Migration: Reviews persistence — ensure tags, images columns and review_images table
-- Date: 2026-11-02
-- Description:
--   Ensures all reviews columns are present and review_images table exists.
--   The initial schema (20260101) already creates these, so all statements use
--   IF NOT EXISTS / ADD COLUMN IF NOT EXISTS guards for idempotency.
--   This migration also refreshes the reviews RLS policies to the latest version.
-- =============================================================================

-- 1. Ensure extra columns exist on reviews (no-op if initial schema ran first)
alter table public.reviews add column if not exists images text[] default '{}';
alter table public.reviews add column if not exists tags text[] default '{}';

-- 2. Ensure status default matches app expectation ('approved' for customer submissions)
alter table public.reviews alter column status set default 'approved';

-- 3. Ensure review_images table exists (no-op if initial schema ran first)
create table if not exists public.review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Indexes (all idempotent)
create index if not exists reviews_product_created_idx on public.reviews (product_id, created_at desc);
create index if not exists reviews_product_rating_idx on public.reviews (product_id, rating desc);
create index if not exists reviews_user_product_idx on public.reviews (user_id, product_id);
create index if not exists review_images_review_idx on public.review_images (review_id, sort_order);

-- 5. Enable RLS on review_images (idempotent)
alter table public.reviews enable row level security;
alter table public.review_images enable row level security;

-- 6. Permissions
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant select on public.review_images to anon, authenticated;
grant insert, delete on public.review_images to authenticated;

-- 7. Refresh reviews policies (drop and recreate for idempotency)
drop policy if exists app_reviews_read on public.reviews;
drop policy if exists app_reviews_insert on public.reviews;
drop policy if exists app_reviews_update_own on public.reviews;
drop policy if exists app_reviews_delete_own on public.reviews;
drop policy if exists app_reviews_admin on public.reviews;

create policy app_reviews_read on public.reviews
  for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()));

create policy app_reviews_insert on public.reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy app_reviews_update_own on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy app_reviews_delete_own on public.reviews
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Admin policy only if private.is_admin() function exists
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'is_admin'
  ) then
    drop policy if exists app_reviews_admin on public.reviews;
    create policy app_reviews_admin on public.reviews
      for all to authenticated
      using ((select private.is_admin()))
      with check ((select private.is_admin()));
  end if;
end;
$$;

-- 8. review_images policies
drop policy if exists app_review_images_read on public.review_images;
drop policy if exists app_review_images_write on public.review_images;

create policy app_review_images_read on public.review_images
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and (r.status = 'approved' or r.user_id = (select auth.uid()))
    )
  );

create policy app_review_images_write on public.review_images
  for all to authenticated
  using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.user_id = (select auth.uid())
    )
  );

-- 9. Ensure profiles are readable for review display
grant select on public.profiles to anon, authenticated;
drop policy if exists app_profiles_public_read on public.profiles;
create policy app_profiles_public_read on public.profiles
  for select to anon, authenticated
  using (true);
