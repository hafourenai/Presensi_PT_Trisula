<script>
  import {
    Users,
    UserPlus,
    Upload,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Eye,
    Shield,
    CheckCircle2,
    XCircle
  } from '@lucide/svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>Kelola Karyawan — Admin Portal</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Daftar Karyawan</h1>
      <p class="mt-1 text-xs text-slate-500">Kelola data kepegawaian dan akun presensi ({data.total} Karyawan)</p>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <a
        href="/admin/karyawan/impor"
        class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
      >
        <Upload class="h-4 w-4" />
        <span>Impor Massal</span>
      </a>

      <a
        href="/admin/karyawan/baru"
        class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
      >
        <UserPlus class="h-4 w-4" />
        <span>Tambah Karyawan</span>
      </a>
    </div>
  </div>

  <!-- Search & Filter Bar -->
  <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
    <form method="GET" class="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <div class="relative sm:col-span-2">
        <Search class="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
        <input
          type="text"
          name="q"
          value={data.filters.search}
          placeholder="Cari nama, NIP, atau email..."
          class="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
        />
      </div>

      <div>
        <select
          name="dept"
          class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-700 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none"
        >
          <option value="">Semua Departemen</option>
          {#each data.departments as d}
            <option value={d.id} selected={data.filters.dept === d.id}>{d.name}</option>
          {/each}
        </select>
      </div>

      <div>
        <select
          name="status"
          class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-700 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none"
        >
          <option value="">Semua Status</option>
          <option value="active" selected={data.filters.status === 'active'}>Aktif</option>
          <option value="inactive" selected={data.filters.status === 'inactive'}>Nonaktif</option>
        </select>
      </div>
    </form>
  </div>

  <!-- Table Card -->
  <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-6">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead class="border-b border-slate-100 text-slate-400">
          <tr>
            <th class="pb-3 font-semibold uppercase tracking-wider">Karyawan</th>
            <th class="pb-3 font-semibold uppercase tracking-wider">Departemen</th>
            <th class="pb-3 font-semibold uppercase tracking-wider">Lokasi Kerja</th>
            <th class="pb-3 font-semibold uppercase tracking-wider">Role</th>
            <th class="pb-3 font-semibold uppercase tracking-wider">Status</th>
            <th class="pb-3 text-right font-semibold uppercase tracking-wider">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-slate-700">
          {#each data.employees as emp}
            <tr class="hover:bg-slate-50/50">
              <td class="py-3.5 max-w-[200px] sm:max-w-[280px]">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-600">
                    {emp.full_name?.slice(0, 2) || 'KY'}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-bold text-slate-900 truncate">{emp.full_name}</p>
                    <p class="text-[11px] text-slate-400 truncate">{emp.nip} · {emp.email}</p>
                  </div>
                </div>
              </td>
              <td class="py-3.5 font-medium max-w-[140px] truncate">{emp.department?.name || '-'}</td>
              <td class="py-3.5 max-w-[150px] truncate">
                {#if emp.work_lat && emp.work_lng}
                  <span class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <span>{emp.work_location_name || 'Lokasi Khusus'}</span>
                  </span>
                {:else}
                  <span class="text-slate-400 text-[11px]">Kantor Pusat</span>
                {/if}
              </td>
              <td class="py-3.5">
                <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 capitalize">
                  {emp.role}
                </span>
              </td>
              <td class="py-3.5">
                {#if emp.is_active}
                  <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <CheckCircle2 class="h-3.5 w-3.5" />
                    <span>Aktif</span>
                  </span>
                {:else}
                  <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                    <XCircle class="h-3.5 w-3.5" />
                    <span>Nonaktif</span>
                  </span>
                {/if}
              </td>
              <td class="py-3.5 text-right">
                <a
                  href="/admin/karyawan/{emp.id}"
                  class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Eye class="h-3.5 w-3.5" />
                  <span>Detail</span>
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if data.totalPages > 1}
      <div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
        <p>Halaman {data.page} dari {data.totalPages}</p>
        <div class="flex items-center gap-1">
          <a
            href="?page={Math.max(1, data.page - 1)}"
            class="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 {data.page === 1 ? 'pointer-events-none opacity-40' : ''}"
          >
            <ChevronLeft class="h-4 w-4" />
          </a>
          <a
            href="?page={Math.min(data.totalPages, data.page + 1)}"
            class="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 {data.page === data.totalPages ? 'pointer-events-none opacity-40' : ''}"
          >
            <ChevronRight class="h-4 w-4" />
          </a>
        </div>
      </div>
    {/if}
  </div>
</div>
