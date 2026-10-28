import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/admin.js';

export async function GET({ url, locals }) {
  const { user, profile } = await locals.safeGetSession();
  if (!user || !profile) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const path = url.searchParams.get('path');
  const bucket = url.searchParams.get('bucket') || 'attendance-photos';

  if (!path) {
    return json({ success: false, message: 'Path foto diperlukan' }, { status: 400 });
  }

  // Jika role karyawan, pastikan hanya mengakses fotonya sendiri
  if (profile.role === 'karyawan' && !path.startsWith(`${user.id}/`)) {
    return json({ success: false, message: 'Akses ditolak.' }, { status: 403 });
  }

  // Generate signed URL berumur pendek (60 detik)
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, 60);

  if (error || !data?.signedUrl) {
    return json({ success: false, message: 'Foto tidak ditemukan atau sudah dihapus.' }, { status: 404 });
  }

  return json({ success: true, url: data.signedUrl });
}
