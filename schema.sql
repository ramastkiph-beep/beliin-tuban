-- ═══════════════════════════════════════════════════
-- NITIP TUBAN CHAT — Supabase SQL Schema
-- Jalankan di: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════

-- 1. PROFILES (extends auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'kurir', 'admin')),
  name        text not null default 'Pengguna',
  kurir_code  text unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    coalesce(new.raw_user_meta_data->>'name', 'Pengguna')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. ORDERS
create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id),
  kurir_id    uuid references public.profiles(id),
  layanan     text not null,
  detail      text,
  status      text not null default 'pending'
              check (status in ('pending', 'active', 'done', 'cancel')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3. MESSAGES
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id),
  role        text not null check (role in ('user', 'kurir', 'admin', 'system')),
  content     text not null,
  is_flagged  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Enable Realtime for messages
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.orders;

-- ═══════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.orders   enable row level security;
alter table public.messages enable row level security;

-- PROFILES: siapa saja bisa baca profil sendiri
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_select_admin" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ORDERS: user hanya lihat order sendiri
create policy "orders_select_user" on public.orders
  for select using (user_id = auth.uid());

-- ORDERS: kurir hanya lihat order yang dia-assign
create policy "orders_select_kurir" on public.orders
  for select using (kurir_id = auth.uid());

-- ORDERS: admin lihat semua
create policy "orders_select_admin" on public.orders
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ORDERS: user bisa buat order
create policy "orders_insert_user" on public.orders
  for insert with check (user_id = auth.uid());

-- ORDERS: admin bisa update (assign kurir, ubah status)
create policy "orders_update_admin" on public.orders
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ORDERS: kurir bisa update status order miliknya
create policy "orders_update_kurir" on public.orders
  for update using (kurir_id = auth.uid());

-- MESSAGES: hanya peserta order yang bisa baca
create policy "messages_select_participant" on public.messages
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
      and (o.user_id = auth.uid() or o.kurir_id = auth.uid())
    )
    or
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- MESSAGES: peserta bisa kirim pesan
create policy "messages_insert_participant" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      exists (
        select 1 from public.orders o
        where o.id = order_id
        and (o.user_id = auth.uid() or o.kurir_id = auth.uid())
      )
      or
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

-- ═══════════════════════════════════════════════════
-- SEED: Buat akun admin pertama
-- Ganti email & password sesuai kebutuhan
-- ═══════════════════════════════════════════════════
-- Jalankan di Auth > Users: buat user manual dengan email admin@nitiptuban.com
-- Lalu update role-nya:
-- UPDATE public.profiles SET role = 'admin', name = 'Admin Nitip Tuban' WHERE id = 'UUID_ADMIN_DI_SINI';

-- ═══════════════════════════════════════════════════
-- SEED: Buat akun kurir contoh
-- ═══════════════════════════════════════════════════
-- Buat user di Auth dengan email KUR-001@kurir.nitiptuban.local, password: KUR-001
-- Lalu:
-- UPDATE public.profiles SET role = 'kurir', name = 'Budi Kurir', kurir_code = 'KUR-001' WHERE id = 'UUID_KURIR_DI_SINI';
