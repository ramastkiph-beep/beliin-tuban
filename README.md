# Nitip Tuban Chat — Setup Guide

## File yang ada di folder ini

```
nitip-chat/
├── index.html       ← Landing page (pilih role, masuk chat)
├── chat-user.html   ← Chat untuk user (realtime)
├── chat-kurir.html  ← UI kurir: list order + chat
├── admin.html       ← Dashboard admin: semua order, assign kurir, chat
├── supabase.js      ← Shared config, utilities, phone filter
└── schema.sql       ← SQL schema untuk Supabase
```

---

## Langkah Setup

### 1. Buat Project Supabase
- Daftar di https://supabase.com
- New Project → catat **Project URL** dan **anon public key**

### 2. Ganti config di `supabase.js`
```js
const SUPABASE_URL  = 'https://NAMAPROJECT.supabase.co';
const SUPABASE_ANON = 'eyJhbGci...';
```

### 3. Jalankan SQL Schema
- Buka Supabase Dashboard → **SQL Editor**
- Copy-paste isi `schema.sql` → Run

### 4. Buat akun Admin
- Supabase Dashboard → **Authentication → Users → Add User**
- Email: `admin@nitiptuban.com`, Password: bebas
- Salin UUID-nya, jalankan di SQL Editor:
```sql
UPDATE public.profiles
SET role = 'admin', name = 'Admin Nitip Tuban'
WHERE id = 'UUID-ADMIN-DI-SINI';
```

### 5. Buat akun Kurir
- Supabase Dashboard → **Authentication → Users → Add User**
- Email: `KUR-001@kurir.nitiptuban.local`
- Password: `KUR-001` (harus sama dengan kode)
- Salin UUID, jalankan:
```sql
UPDATE public.profiles
SET role = 'kurir', name = 'Nama Kurir', kurir_code = 'KUR-001'
WHERE id = 'UUID-KURIR-DI-SINI';
```

Ulangi untuk setiap kurir (KUR-002, KUR-003, dst).

### 6. Deploy
Upload semua file ke hosting statis apa saja:
- **Netlify** (drag-drop folder) — gratis
- **Vercel** — gratis
- **GitHub Pages** — gratis
- Atau taruh di folder yang sama dengan `nitip.html`

---

## Cara Kerja

### Flow Order
1. Admin buat order dari sistem utama (atau bisa integrasi dari `nitip.html`)
2. Admin buka `admin.html` → assign kurir ke order
3. User dapat kode order → buka `index.html` → masuk sebagai User → chat
4. Kurir login di `index.html` pakai kode (misal `KUR-001`) → `chat-kurir.html`
5. Admin bisa masuk chat mana saja kapan saja

### Keamanan Nomor HP
Filter di `supabase.js → filterMessage()` mendeteksi:
- Nomor HP Indonesia (08xx, +62, 62xxx)
- @username sosmed
- Link wa.me, t.me
- Teks "wa: 081234..."

Pesan yang terfilter otomatis diganti `[📵 nomor disembunyikan]`.
Pesan yang ter-flag ditandai `is_flagged = true` di database.
Admin bisa lihat semua pesan ter-flag di dashboard.

### Row Level Security (RLS)
- User hanya bisa baca pesan order miliknya
- Kurir hanya bisa baca pesan order yang dia-assign
- Admin bisa baca semua pesan
- Kurir tidak bisa lihat order kurir lain

---

## Integrasi dengan nitip.html

Di `nitip.html`, tombol order WA bisa diubah menjadi:
```js
// Setelah order berhasil dibuat di DB:
const order = await createOrder(userId, layanan, detail);
const chatUrl = `https://DOMAIN-KAMU/chat/chat-user.html?order=${order.id}`;
// Kirim chatUrl ke user via WA
```
