-- Run on a dedicated Supabase project. No shared password or secret key is
-- stored in SQL or client files. Add the approved Auth user UUID separately.
begin;
create table public.cms_admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.cms_admins enable row level security;
revoke all on public.cms_admins from anon,authenticated;
grant select on public.cms_admins to authenticated;
create policy admins_read_self on public.cms_admins for select to authenticated using (user_id=(select auth.uid()));

create table public.cms_updates (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 1 and 120),
 body text not null check(length(body) between 1 and 5000),
 image_url text, storage_path text,
 published boolean not null default false,
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(image_url is null or image_url ~ '^https://')
);
create table public.cms_gallery (
 id uuid primary key default gen_random_uuid(),
 image_url text not null check(image_url ~ '^https://' or image_url ~ '^assets/gallery/photo-[0-9]{2}\.webp$'),
 storage_path text, caption text not null default '' check(length(caption)<=200),
 sort_order integer not null default 0,
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.cms_updates enable row level security;
alter table public.cms_gallery enable row level security;
revoke all on public.cms_updates,public.cms_gallery from anon,authenticated;
grant select on public.cms_updates,public.cms_gallery to anon,authenticated;
grant insert,update on public.cms_updates,public.cms_gallery to authenticated;
revoke delete on public.cms_updates,public.cms_gallery from anon,authenticated;
create policy public_updates on public.cms_updates for select to anon,authenticated using (published and archived_at is null);
create policy public_gallery on public.cms_gallery for select to anon,authenticated using (archived_at is null);
create policy admin_updates_read on public.cms_updates for select to authenticated using (exists(select 1 from public.cms_admins where user_id=(select auth.uid())));
create policy admin_gallery_read on public.cms_gallery for select to authenticated using (exists(select 1 from public.cms_admins where user_id=(select auth.uid())));
create policy admin_updates_insert on public.cms_updates for insert to authenticated with check(exists(select 1 from public.cms_admins where user_id=(select auth.uid())));
create policy admin_updates_edit on public.cms_updates for update to authenticated using(exists(select 1 from public.cms_admins where user_id=(select auth.uid()))) with check(exists(select 1 from public.cms_admins where user_id=(select auth.uid())));
create policy admin_gallery_insert on public.cms_gallery for insert to authenticated with check(exists(select 1 from public.cms_admins where user_id=(select auth.uid())));
create policy admin_gallery_edit on public.cms_gallery for update to authenticated using(exists(select 1 from public.cms_admins where user_id=(select auth.uid()))) with check(exists(select 1 from public.cms_admins where user_id=(select auth.uid())));
create function public.cms_timestamp() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=clock_timestamp();return new;end $$;
create trigger update_timestamp before update on public.cms_updates for each row execute function public.cms_timestamp();
create trigger gallery_timestamp before update on public.cms_gallery for each row execute function public.cms_timestamp();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('site-media','site-media',true,10485760,array['image/jpeg','image/png','image/webp']);
create policy admin_media_read on storage.objects for select to authenticated using(bucket_id='site-media' and exists(select 1 from public.cms_admins where user_id=(select auth.uid())));
create policy admin_media_upload on storage.objects for insert to authenticated with check(bucket_id='site-media' and (storage.foldername(name))[1]='uploads' and exists(select 1 from public.cms_admins where user_id=(select auth.uid())));
-- Images are immutable. Removing a gallery entry archives it, preserving restore.
insert into public.cms_gallery(image_url,caption,sort_order)
select 'assets/gallery/photo-'||lpad(n::text,2,'0')||'.webp','פעילות בבית חב״ד עמק הכרמל',n from generate_series(1,17) n;
commit;
