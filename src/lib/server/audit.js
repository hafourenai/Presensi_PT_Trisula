import { supabaseAdmin } from '$lib/server/admin.js';

/**
 * Mencatat audit log ke tabel audit_logs
 * @param {object} param0
 * @param {string} [param0.actorId]
 * @param {string} param0.action
 * @param {string} [param0.targetType]
 * @param {string} [param0.targetId]
 * @param {object} [param0.detail]
 */
export async function createAuditLog({ actorId, action, targetType, targetId, detail }) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: actorId || null,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      detail: detail || null
    });
  } catch (err) {
    console.error('Gagal mencatat audit log:', err);
  }
}
