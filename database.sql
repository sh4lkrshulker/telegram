-- Core schema for Linea. Run once in the Supabase SQL Editor.
create table if not exists public.chat_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 40),
  bio text check (char_length(bio) <= 240),
  avatar_emoji text check (char_length(avatar_emoji) <= 4),
  created_at timestamptz not null default now()
);
create unique index if not exists chat_profiles_username_lower_idx
  on public.chat_profiles (lower(username));

create table if not exists public.chat_wallets (
  user_id uuid primary key references public.chat_profiles(user_id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_points_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.chat_profiles(user_id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_gift_catalog (
  code text primary key,
  title text not null,
  icon text not null,
  points integer not null check (points > 0),
  active boolean not null default true
);
insert into public.chat_gift_catalog (code, title, icon, points) values
  ('rose', 'Роза', '🌹', 10),
  ('heart', 'Сердце', '💝', 25),
  ('star', 'Звезда', '🌟', 50),
  ('trophy', 'Трофей', '🏆', 100)
on conflict (code) do update set title = excluded.title, icon = excluded.icon, points = excluded.points;

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.chat_profiles(user_id) on delete cascade,
  recipient_id uuid not null references public.chat_profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  message_type text not null default 'text' check (message_type in ('text', 'gift')),
  gift_code text references public.chat_gift_catalog(code),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists chat_messages_sender_idx on public.chat_messages(sender_id, created_at desc);
create index if not exists chat_messages_recipient_idx on public.chat_messages(recipient_id, created_at desc);

create table if not exists public.chat_gifts (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.chat_profiles(user_id),
  recipient_id uuid not null references public.chat_profiles(user_id),
  gift_code text not null references public.chat_gift_catalog(code),
  points integer not null check (points > 0),
  message_id bigint references public.chat_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.chat_profiles(user_id) on delete cascade,
  kind text not null check (kind in ('group', 'channel')),
  title text not null check (char_length(title) between 1 and 60),
  description text not null default '' check (char_length(description) <= 240),
  is_public boolean not null default true,
  default_permissions jsonb not null default '{"can_send":true,"can_invite":false,"can_manage":false}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.chat_rooms add column if not exists default_permissions jsonb not null
  default '{"can_send":true,"can_invite":false,"can_manage":false}'::jsonb;

create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.chat_profiles(user_id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  permissions jsonb not null default '{"can_send":false,"can_invite":false,"can_manage":false}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.room_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.chat_profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists room_messages_room_idx on public.room_messages(room_id, created_at);

create or replace function public.is_chat_room_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.chat_room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_send_chat_room_message(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.chat_room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid()
      and (m.role in ('owner', 'admin') or coalesce((m.permissions->>'can_send')::boolean, false))
  );
$$;

create or replace function public.create_chat_wallet()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.chat_wallets (user_id) values (new.user_id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists chat_profile_wallet on public.chat_profiles;
create trigger chat_profile_wallet after insert on public.chat_profiles
for each row execute function public.create_chat_wallet();
insert into public.chat_wallets (user_id)
select user_id from public.chat_profiles on conflict do nothing;

alter table public.chat_profiles enable row level security;
alter table public.chat_wallets enable row level security;
alter table public.chat_points_ledger enable row level security;
alter table public.chat_gift_catalog enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_gifts enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.room_messages enable row level security;

drop policy if exists "Profiles visible to authenticated users" on public.chat_profiles;
create policy "Profiles visible to authenticated users" on public.chat_profiles
for select to authenticated using (true);
drop policy if exists "Users create their own profile" on public.chat_profiles;
create policy "Users create their own profile" on public.chat_profiles
for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users update their own profile" on public.chat_profiles;
create policy "Users update their own profile" on public.chat_profiles
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users read own wallet" on public.chat_wallets;
create policy "Users read own wallet" on public.chat_wallets
for select to authenticated using (user_id = auth.uid());
drop policy if exists "Gift catalog visible to authenticated users" on public.chat_gift_catalog;
create policy "Gift catalog visible to authenticated users" on public.chat_gift_catalog
for select to authenticated using (active);

drop policy if exists "Participants read direct messages" on public.chat_messages;
create policy "Participants read direct messages" on public.chat_messages
for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "Users send their own messages" on public.chat_messages;
create policy "Users send their own messages" on public.chat_messages
for insert to authenticated with check (
  sender_id = auth.uid() and recipient_id <> auth.uid() and message_type = 'text' and gift_code is null
);

drop policy if exists "Public rooms and members can read rooms" on public.chat_rooms;
create policy "Public rooms and members can read rooms" on public.chat_rooms
for select to authenticated using (
  is_public or public.is_chat_room_member(id)
);
drop policy if exists "Members read room membership" on public.chat_room_members;
create policy "Members read room membership" on public.chat_room_members
for select to authenticated using (
  user_id = auth.uid() or public.is_chat_room_member(chat_room_members.room_id)
);
drop policy if exists "Members read room messages" on public.room_messages;
create policy "Members read room messages" on public.room_messages
for select to authenticated using (
  public.is_chat_room_member(room_messages.room_id)
);
drop policy if exists "Allowed members send room messages" on public.room_messages;
create policy "Allowed members send room messages" on public.room_messages
for insert to authenticated with check (
  sender_id = auth.uid() and public.can_send_chat_room_message(room_messages.room_id)
);

create or replace function public.send_chat_gift(p_recipient_id uuid, p_gift_code text)
returns void language plpgsql security definer set search_path = public, auth
as $$
declare
  gift public.chat_gift_catalog%rowtype;
  available integer;
  gift_message_id bigint;
begin
  if auth.uid() is null or p_recipient_id = auth.uid() then
    raise exception 'Недопустимый получатель подарка';
  end if;
  select * into gift from public.chat_gift_catalog where code = p_gift_code and active;
  if not found then raise exception 'Подарок недоступен'; end if;
  select points into available from public.chat_wallets where user_id = auth.uid() for update;
  if available is null or available < gift.points then raise exception 'Недостаточно очков'; end if;
  update public.chat_wallets set points = points - gift.points, updated_at = now() where user_id = auth.uid();
  update public.chat_wallets set points = points + gift.points, updated_at = now() where user_id = p_recipient_id;
  if not found then raise exception 'Профиль получателя не найден'; end if;
  insert into public.chat_messages (sender_id, recipient_id, body, message_type, gift_code)
  values (auth.uid(), p_recipient_id, gift.icon || ' ' || gift.title, 'gift', gift.code)
  returning id into gift_message_id;
  insert into public.chat_gifts (sender_id, recipient_id, gift_code, points, message_id)
  values (auth.uid(), p_recipient_id, gift.code, gift.points, gift_message_id);
  insert into public.chat_points_ledger (user_id, amount, reason)
  values (auth.uid(), -gift.points, 'gift:' || gift.code), (p_recipient_id, gift.points, 'gift_received:' || gift.code);
end;
$$;

create or replace function public.admin_list_chat_users(p_code text)
returns table(user_id uuid, username text, display_name text, points integer)
language plpgsql security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null or p_code is distinct from 'admin123' then raise exception 'Неверный код администратора'; end if;
  return query
    select p.user_id, p.username, p.display_name, coalesce(w.points, 0)
    from public.chat_profiles p
    left join public.chat_wallets w on w.user_id = p.user_id
    order by p.username;
end;
$$;

create or replace function public.admin_grant_chat_points(p_code text, p_target_user uuid, p_amount integer)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null or p_code is distinct from 'admin123' then raise exception 'Неверный код администратора'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000 then raise exception 'Количество очков должно быть от 1 до 1000000'; end if;
  update public.chat_wallets set points = points + p_amount, updated_at = now() where user_id = p_target_user;
  if not found then raise exception 'Пользователь не найден'; end if;
  insert into public.chat_points_ledger (user_id, amount, reason)
  values (p_target_user, p_amount, 'admin_grant:' || auth.uid()::text);
end;
$$;

create or replace function public.create_chat_room(
  p_kind text, p_title text, p_description text, p_is_public boolean, p_permissions jsonb
)
returns public.chat_rooms language plpgsql security definer set search_path = public, auth
as $$
declare
  new_room public.chat_rooms;
  member_permissions jsonb;
begin
  if auth.uid() is null then raise exception 'Требуется вход'; end if;
  if p_kind not in ('group', 'channel') then raise exception 'Неизвестный тип сообщества'; end if;
  if char_length(trim(p_title)) not between 1 and 60 then raise exception 'Название должно содержать от 1 до 60 символов'; end if;
  member_permissions := jsonb_build_object(
    'can_send', case when p_kind = 'channel' then false else coalesce((p_permissions->>'can_send')::boolean, true) end,
    'can_invite', coalesce((p_permissions->>'can_invite')::boolean, false),
    'can_manage', coalesce((p_permissions->>'can_manage')::boolean, false)
  );
  insert into public.chat_rooms(owner_id, kind, title, description, is_public, default_permissions)
  values (auth.uid(), p_kind, trim(p_title), coalesce(trim(p_description), ''), coalesce(p_is_public, true), member_permissions)
  returning * into new_room;
  insert into public.chat_room_members(room_id, user_id, role, permissions)
  values (new_room.id, auth.uid(), 'owner', '{"can_send":true,"can_invite":true,"can_manage":true}'::jsonb);
  return new_room;
end;
$$;

create or replace function public.join_chat_room(p_room_id uuid)
returns void language plpgsql security definer set search_path = public, auth
as $$
declare room_permissions jsonb;
begin
  if auth.uid() is null then raise exception 'Требуется вход'; end if;
  select default_permissions into room_permissions from public.chat_rooms where id = p_room_id and is_public;
  if not found then raise exception 'Публичное сообщество не найдено'; end if;
  insert into public.chat_room_members(room_id, user_id, role, permissions)
  values (p_room_id, auth.uid(), 'member', room_permissions)
  on conflict (room_id, user_id) do nothing;
end;
$$;

create or replace function public.invite_chat_room_member(p_room_id uuid, p_username text)
returns void language plpgsql security definer set search_path = public, auth
as $$
declare target_id uuid;
  room_permissions jsonb;
begin
  if auth.uid() is null then raise exception 'Требуется вход'; end if;
  if not exists (
    select 1 from public.chat_room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid()
      and (m.role in ('owner', 'admin')
        or coalesce((m.permissions->>'can_invite')::boolean, false)
        or coalesce((m.permissions->>'can_manage')::boolean, false))
  ) then raise exception 'Недостаточно прав для приглашения'; end if;
  select user_id into target_id from public.chat_profiles where lower(username) = lower(trim(p_username));
  if target_id is null then raise exception 'Пользователь не найден'; end if;
  select default_permissions into room_permissions from public.chat_rooms where id = p_room_id;
  insert into public.chat_room_members(room_id, user_id, role, permissions)
  values (p_room_id, target_id, 'member', room_permissions)
  on conflict (room_id, user_id) do nothing;
end;
$$;

create or replace function public.update_chat_room_member(
  p_room_id uuid, p_target_user uuid, p_role text, p_permissions jsonb
)
returns void language plpgsql security definer set search_path = public, auth
as $$
declare caller_role text;
begin
  if auth.uid() is null then raise exception 'Требуется вход'; end if;
  select role into caller_role from public.chat_room_members
  where room_id = p_room_id and user_id = auth.uid();
  if caller_role is null then raise exception 'Вы не состоите в сообществе'; end if;
  if caller_role not in ('owner', 'admin') and not coalesce((
    select (permissions->>'can_manage')::boolean from public.chat_room_members
    where room_id = p_room_id and user_id = auth.uid()
  ), false) then raise exception 'Недостаточно прав для управления участниками'; end if;
  if p_role not in ('member', 'admin') then raise exception 'Недопустимая роль'; end if;
  if p_role = 'admin' and caller_role <> 'owner' then raise exception 'Назначать администраторов может только владелец'; end if;
  update public.chat_room_members
  set role = p_role,
      permissions = jsonb_build_object(
        'can_send', coalesce((p_permissions->>'can_send')::boolean, false),
        'can_invite', coalesce((p_permissions->>'can_invite')::boolean, false),
        'can_manage', coalesce((p_permissions->>'can_manage')::boolean, false)
      )
  where room_id = p_room_id and user_id = p_target_user and role <> 'owner';
  if not found then raise exception 'Участник не найден или это владелец сообщества'; end if;
end;
$$;

revoke all on public.chat_wallets, public.chat_points_ledger, public.chat_gifts from anon, authenticated;
grant select on public.chat_wallets to authenticated;
grant select on public.chat_profiles, public.chat_messages, public.chat_gift_catalog, public.chat_rooms,
  public.chat_room_members, public.room_messages to authenticated;
grant insert, update on public.chat_profiles to authenticated;
grant insert on public.chat_messages, public.room_messages to authenticated;
grant usage, select on sequence public.chat_messages_id_seq, public.room_messages_id_seq to authenticated;
revoke all on function public.admin_list_chat_users(text) from public, anon;
revoke all on function public.admin_grant_chat_points(text, uuid, integer) from public, anon;
revoke all on function public.send_chat_gift(uuid, text) from public, anon;
revoke all on function public.create_chat_room(text, text, text, boolean, jsonb) from public, anon;
revoke all on function public.join_chat_room(uuid) from public, anon;
revoke all on function public.invite_chat_room_member(uuid, text) from public, anon;
revoke all on function public.update_chat_room_member(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.admin_list_chat_users(text) to authenticated;
grant execute on function public.admin_grant_chat_points(text, uuid, integer) to authenticated;
grant execute on function public.send_chat_gift(uuid, text) to authenticated;
grant execute on function public.create_chat_room(text, text, text, boolean, jsonb) to authenticated;
grant execute on function public.join_chat_room(uuid) to authenticated;
grant execute on function public.invite_chat_room_member(uuid, text) to authenticated;
grant execute on function public.update_chat_room_member(uuid, uuid, text, jsonb) to authenticated;
revoke all on function public.is_chat_room_member(uuid) from public, anon;
revoke all on function public.can_send_chat_room_message(uuid) from public, anon;
grant execute on function public.is_chat_room_member(uuid) to authenticated;
grant execute on function public.can_send_chat_room_message(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object or undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.room_messages;
exception when duplicate_object or undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.chat_wallets;
exception when duplicate_object or undefined_object then null;
end $$;