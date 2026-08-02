-- 在 Supabase SQL Editor 中执行本文件。
-- 账号和密码请通过 Authentication > Users > Add user 创建，密码由 Supabase Auth 使用 bcrypt 保存。

create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resume_store jsonb not null default '{"resumes":[],"activeId":null}'::jsonb,
  ai_config jsonb not null default '{}'::jsonb,
  interview_store jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

revoke all on table public.app_state from anon;
grant select, insert, update, delete on table public.app_state to authenticated;

drop policy if exists "Users manage only their own app state" on public.app_state;
create policy "Users manage only their own app state"
on public.app_state
for all
to authenticated
using (
  (select auth.uid()) = user_id
  and lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'wzkmaster@resume.local'
)
with check (
  (select auth.uid()) = user_id
  and lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'wzkmaster@resume.local'
);
