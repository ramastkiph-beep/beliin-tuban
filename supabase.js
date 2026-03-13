// ═══════════════════════════════════════════════
// SUPABASE CONFIG — Nitip Tuban
// ═══════════════════════════════════════════════
const SUPABASE_URL  = 'ayhttps://aydqjvpqhtqyxwqvjhdk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5ZHFqdnBxaHRxeXh3cXZqaGRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzOTA3MzYsImV4cCI6MjA4ODk2NjczNn0.5KR2cRcHb12cunYwLbmgmgcsErQDmZo6begkLNMLkRA';

// Init client (loaded via CDN di setiap halaman)
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ═══════════════════════════════════════════════
// AUTH HELPERS
// ═══════════════════════════════════════════════
async function getSession() {
  const { data } = await _sb.auth.getSession();
  return data?.session ?? null;
}

async function getProfile(uid) {
  const { data } = await _sb.from('profiles').select('*').eq('id', uid).single();
  return data;
}

async function signInAnonymous() {
  const { data, error } = await _sb.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

async function signInKurir(kurirCode) {
  // Kurir login pakai email buatan dari kode unik (tanpa nomor HP terekspos)
  const email = `${kurirCode.toLowerCase()}@kurir.nitiptuban.local`;
  const { data, error } = await _sb.auth.signInWithPassword({ email, password: kurirCode });
  if (error) throw error;
  return data.user;
}

async function signInAdmin(email, password) {
  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

async function signOut() {
  await _sb.auth.signOut();
  location.href = 'index.html';
}

// ═══════════════════════════════════════════════
// PHONE / CONTACT FILTER
// Deteksi & sensor nomor HP, IG handle, dll
// ═══════════════════════════════════════════════
const PHONE_PATTERNS = [
  /(\+62|62|0)[\s\-.]?8[\d][\d\s\-\.]{7,12}/g,    // Indonesia mobile
  /(\+62|62|0)[\s\-.]?[2-9][\d\s\-\.]{6,11}/g,     // Landline
  /\b0\d{9,12}\b/g,                                  // Generic 08xxx
  /\b[\d]{10,13}\b/g,                                // Raw number block
];

const SOCIAL_PATTERNS = [
  /@[\w.]{3,}/g,           // @username
  /wa\.me\/[\d+]+/gi,      // wa.me links
  /t\.me\/\w+/gi,          // Telegram links
  /wa\s*:\s*[\d\s]+/gi,    // "wa: 0812..."
  /whatsapp\s*:?\s*[\d\s]+/gi,
];

function filterMessage(text) {
  let filtered = text;
  let flagged = false;

  for (const p of PHONE_PATTERNS) {
    if (p.test(filtered)) { flagged = true; }
    filtered = filtered.replace(p, '[📵 nomor disembunyikan]');
  }
  for (const p of SOCIAL_PATTERNS) {
    if (p.test(filtered)) { flagged = true; }
    filtered = filtered.replace(p, '[🔒 kontak disembunyikan]');
  }

  return { text: filtered, flagged };
}

// ═══════════════════════════════════════════════
// REALTIME MESSAGES
// ═══════════════════════════════════════════════
function subscribeMessages(orderId, callback) {
  return _sb
    .channel(`order-${orderId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `order_id=eq.${orderId}`
    }, (payload) => callback(payload.new))
    .subscribe();
}

async function sendMessage(orderId, senderId, role, text) {
  const { filtered, flagged } = (() => {
    const r = filterMessage(text);
    return { filtered: r.text, flagged: r.flagged };
  })();

  const { data, error } = await _sb.from('messages').insert({
    order_id: orderId,
    sender_id: senderId,
    role,
    content: filtered,
    is_flagged: flagged,
    created_at: new Date().toISOString()
  }).select().single();

  if (error) throw error;
  return data;
}

async function fetchMessages(orderId) {
  const { data } = await _sb
    .from('messages')
    .select('*, profiles(name, role)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

// ═══════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════
async function fetchOrder(orderId) {
  const { data } = await _sb.from('orders').select('*, profiles!orders_user_id_fkey(name)').eq('id', orderId).single();
  return data;
}

async function fetchUserOrders(userId) {
  const { data } = await _sb.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return data ?? [];
}

async function fetchKurirOrders(kurirId) {
  const { data } = await _sb.from('orders').select('*').eq('kurir_id', kurirId).in('status', ['active', 'pending']).order('created_at', { ascending: false });
  return data ?? [];
}

async function fetchAllOrders() {
  const { data } = await _sb.from('orders').select('*, user:profiles!orders_user_id_fkey(name), kurir:profiles!orders_kurir_id_fkey(name, kurir_code)').order('created_at', { ascending: false });
  return data ?? [];
}

async function createOrder(userId, layanan, detail) {
  const { data, error } = await _sb.from('orders').insert({
    user_id: userId,
    layanan,
    detail,
    status: 'pending',
    created_at: new Date().toISOString()
  }).select().single();
  if (error) throw error;
  return data;
}

async function assignKurir(orderId, kurirId) {
  const { error } = await _sb.from('orders').update({ kurir_id: kurirId, status: 'active' }).eq('id', orderId);
  if (error) throw error;
}

async function updateOrderStatus(orderId, status) {
  const { error } = await _sb.from('orders').update({ status }).eq('id', orderId);
  if (error) throw error;
}

// ═══════════════════════════════════════════════
// KURIR LIST (untuk admin)
// ═══════════════════════════════════════════════
async function fetchKurirList() {
  const { data } = await _sb.from('profiles').select('*').eq('role', 'kurir').eq('is_active', true);
  return data ?? [];
}

// ═══════════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════════
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusBadge(status) {
  const map = {
    pending: { label: 'Menunggu Kurir', color: '#f59e0b' },
    active:  { label: 'Sedang Berjalan', color: '#2ABFB3' },
    done:    { label: 'Selesai', color: '#22c55e' },
    cancel:  { label: 'Dibatalkan', color: '#ef4444' },
  };
  return map[status] ?? { label: status, color: '#888' };
}

// Short order ID for display
function shortId(id) {
  return id?.split('-')[0]?.toUpperCase() ?? '—';
}
