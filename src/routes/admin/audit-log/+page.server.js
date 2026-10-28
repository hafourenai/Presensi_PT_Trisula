import { supabaseAdmin } from '$lib/server/admin.js';

export const load = async () => {
  const { data: logs } = await supabaseAdmin
    .from('audit_logs')
    .select('*, actor:profiles(nip, full_name, role)')
    .order('created_at', { ascending: false })
    .limit(100);

  return { logs: logs || [] };
};
