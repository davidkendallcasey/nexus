import type { NexusExport } from '../db';

const LAST_SYNC_KEY = 'nexus-last-synced-at';

function storageUrl() {
  const bucket = import.meta.env.VITE_SUPABASE_BUCKET ?? 'nexus-sync';
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/backup.json`;
}

function authHeaders() {
  const key = import.meta.env.VITE_SUPABASE_KEY;
  return { 'apikey': key, 'Authorization': `Bearer ${key}` };
}

export function isSyncConfigured(): boolean {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_KEY);
}

export async function uploadBackup(data: NexusExport, keepalive = false): Promise<void> {
  const res = await fetch(storageUrl(), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json', 'x-upsert': 'true' },
    body: JSON.stringify(data),
    keepalive,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  localStorage.setItem(LAST_SYNC_KEY, String(data.exportedAt));
}

export async function downloadBackup(): Promise<NexusExport | null> {
  const res = await fetch(storageUrl(), { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.json() as Promise<NexusExport>;
}

export function getLastSyncedAt(): number {
  return Number(localStorage.getItem(LAST_SYNC_KEY) ?? '0');
}
