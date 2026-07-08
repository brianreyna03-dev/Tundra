const STORAGE_KEY = "shift-board:v1";
const BOARD_ID = "main";
const TABLE_NAME = "shift_board";

const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL ||
  "https://debcntlkbrbtcgsrjdhy.supabase.co"
).replace(/\/$/, "");
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_0z72yZyLPZ4TZwx-pmBSVQ_8mMxLOdL";

function hasSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function localLoad() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function localSave(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...supabaseHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase request failed (${response.status}): ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function loadData() {
  if (!hasSupabase()) return localLoad();

  try {
    const rows = await request(
      `${TABLE_NAME}?id=eq.${encodeURIComponent(BOARD_ID)}&select=data&limit=1`,
      { method: "GET" }
    );

    const remoteData = Array.isArray(rows) ? rows[0]?.data : rows?.data;
    if (remoteData) {
      localSave(remoteData);
      return remoteData;
    }
  } catch (error) {
    console.warn("Could not load shared Supabase board. Falling back locally.", error);
  }

  return localLoad();
}

export async function saveData(data) {
  localSave(data);

  if (!hasSupabase()) return false;

  try {
    await request(TABLE_NAME, {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id: BOARD_ID,
        data,
        updated_at: new Date().toISOString(),
      }),
    });
    return true;
  } catch (error) {
    console.warn("Could not save shared Supabase board.", error);
    return false;
  }
}

