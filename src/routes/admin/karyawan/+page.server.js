import { supabaseAdmin } from '$lib/server/admin.js';

export const load = async ({ url }) => {
  const search = url.searchParams.get('q') || '';
  const dept = url.searchParams.get('dept') || '';
  const status = url.searchParams.get('status') || '';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = 10;

  // Query Departments
  const { data: departments } = await supabaseAdmin
    .from('departments')
    .select('*')
    .order('name', { ascending: true });

  // Query Profiles
  let query = supabaseAdmin
    .from('profiles')
    .select('*, department:departments(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,nip.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (dept) {
    query = query.eq('department_id', dept);
  }
  if (status === 'active') {
    query = query.eq('is_active', true);
  } else if (status === 'inactive') {
    query = query.eq('is_active', false);
  }

  const { data: employees, count } = await query;

  return {
    employees: employees || [],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
    departments: departments || [],
    filters: {
      search,
      dept,
      status
    }
  };
};
