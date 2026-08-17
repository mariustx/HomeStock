import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'homeStock.auth',
  },
});

export async function updateOpenedAt(id: string, openedAt: string | null): Promise<void> {
  const { error } = await supabase
    .from('inventory')
    .update({ opened_at: openedAt })
    .eq('id', id);
  if (error) throw error;
}
