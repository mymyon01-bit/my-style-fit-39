-- ── 1. user_body_images table ────────────────────────────────────────────
create table if not exists public.user_body_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  storage_path text not null,
  storage_bucket text not null default 'user-body-images',
  public_url text,
  image_hash text not null,
  width integer,
  height integer,
  is_active boolean not null default true,
  label text,
  source text not null default 'upload',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-user dedup on active rows only
create unique index if not exists user_body_images_user_hash_active_idx
  on public.user_body_images (user_id, image_hash)
  where is_active = true;

create index if not exists user_body_images_user_created_idx
  on public.user_body_images (user_id, created_at desc);

alter table public.user_body_images enable row level security;

create policy "Users can view own body images"
  on public.user_body_images for select
  using (auth.uid() = user_id);

create policy "Users can insert own body images"
  on public.user_body_images for insert
  with check (auth.uid() = user_id);

create policy "Users can update own body images"
  on public.user_body_images for update
  using (auth.uid() = user_id);

create policy "Users can delete own body images"
  on public.user_body_images for delete
  using (auth.uid() = user_id);

-- updated_at trigger
create trigger user_body_images_set_updated_at
  before update on public.user_body_images
  for each row execute function public.update_updated_at_column();

-- ── 2. New private storage bucket ────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('user-body-images', 'user-body-images', false)
on conflict (id) do nothing;

create policy "Users upload own body image files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-body-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read own body image files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'user-body-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users update own body image files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'user-body-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users delete own body image files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-body-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 3. fit_tryons cache key extension ────────────────────────────────────
alter table public.fit_tryons
  add column if not exists body_image_hash text;

create index if not exists fit_tryons_dedup_key_idx
  on public.fit_tryons (user_id, product_key, selected_size, body_image_hash);

-- ── 4. Backfill from body_scan_images ────────────────────────────────────
-- Use a placeholder hash derived from storage_path; frontend will reconcile
-- with real SHA-256 on first reuse. Skip rows that already exist.
insert into public.user_body_images
  (user_id, storage_path, storage_bucket, public_url, image_hash, source, label, metadata)
select
  bsi.user_id,
  bsi.storage_path,
  'body-scans',
  bsi.public_url,
  'legacy-bsi:' || encode(digest(bsi.storage_path, 'sha256'), 'hex'),
  'body_scan_images',
  initcap(bsi.image_type) || ' scan',
  jsonb_build_object('image_type', bsi.image_type, 'backfilled_at', now())
from public.body_scan_images bsi
where bsi.storage_path is not null
on conflict do nothing;

-- ── 5. Backfill from fit_tryons.user_image_url ───────────────────────────
insert into public.user_body_images
  (user_id, storage_path, storage_bucket, public_url, image_hash, source, label, metadata)
select distinct on (ft.user_id, ft.user_image_url)
  ft.user_id,
  ft.user_image_url,
  'external',
  ft.user_image_url,
  'legacy-ft:' || encode(digest(ft.user_image_url, 'sha256'), 'hex'),
  'fit_tryons',
  'Previous try-on photo',
  jsonb_build_object('source_url', ft.user_image_url, 'backfilled_at', now())
from public.fit_tryons ft
where ft.user_image_url is not null
  and ft.user_image_url <> ''
on conflict do nothing;