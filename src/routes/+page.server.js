import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
  const { user, profile } = await locals.safeGetSession();
  if (!user || !profile) {
    throw redirect(303, '/login');
  }
  if (profile.must_change_password) {
    throw redirect(303, '/ganti-password');
  }
  if (profile.role === 'karyawan') {
    throw redirect(303, '/presensi');
  } else {
    throw redirect(303, '/admin/dashboard');
  }
};
