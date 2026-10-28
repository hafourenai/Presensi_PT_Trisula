import { redirect } from '@sveltejs/kit';
import { createAuditLog } from '$lib/server/audit.js';

export const actions = {
  default: async ({ locals }) => {
    const { user } = await locals.safeGetSession();
    if (user) {
      await createAuditLog({
        actorId: user.id,
        action: 'logout',
        targetType: 'auth',
        targetId: user.id
      });
      await locals.supabase.auth.signOut();
    }
    throw redirect(303, '/login');
  }
};
