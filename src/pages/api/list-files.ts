import type { NextApiRequest, NextApiResponse } from 'next';
import { getServiceClient, BUCKET } from '@/app/lib/supabaseServer';
import { requireSession } from '@/app/lib/requireSession';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireSession(req))) return res.status(401).json({ error: 'Unauthorized' });
  const supabase = getServiceClient();
  // Files live under <folder>/<name>; list folders then their contents.
  const { data: top, error } = await supabase.storage.from(BUCKET)
    .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) return res.status(500).json({ error: 'List failed' });
  const files: { name: string; path: string; lastModified: string | null }[] = [];
  for (const entry of top || []) {
    if (entry.id === null) {
      const { data: inner } = await supabase.storage.from(BUCKET).list(entry.name, { limit: 1000 });
      for (const f of inner || []) {
        files.push({
          name: f.name,
          path: `${entry.name}/${f.name}`,
          lastModified: f.created_at ?? null,
        });
      }
    } else {
      files.push({ name: entry.name, path: entry.name, lastModified: entry.created_at ?? null });
    }
  }
  return res.status(200).json({ files });
}
