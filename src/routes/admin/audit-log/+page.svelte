<script>
  import { FileText, ShieldAlert, Clock, User } from '@lucide/svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>Audit Log Sistem — Super Admin</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Audit Log Sistem</h1>
    <p class="mt-1 text-xs text-slate-500">
      Rekaman jejak aktivitas penting seluruh pengguna (login, logout, mutasi akun, presensi, ekspor data)
    </p>
  </div>

  <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-6">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead class="border-b border-slate-100 text-slate-400">
          <tr>
            <th class="pb-3 font-semibold uppercase tracking-wider">Waktu (WIB)</th>
            <th class="pb-3 font-semibold uppercase tracking-wider">Pelaku (Aktor)</th>
            <th class="pb-3 font-semibold uppercase tracking-wider">Aksi</th>
            <th class="pb-3 font-semibold uppercase tracking-wider">Target</th>
            <th class="pb-3 font-semibold uppercase tracking-wider">Detail</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-slate-700">
          {#each data.logs as log}
            <tr class="hover:bg-slate-50/50">
              <td class="py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                {new Date(log.created_at).toLocaleString('id-ID')}
              </td>
              <td class="py-3 max-w-[140px] sm:max-w-[200px]">
                <p class="font-bold text-slate-900 truncate">{log.actor?.full_name || 'Sistem / Anonim'}</p>
                {#if log.actor}
                  <p class="text-[10px] text-slate-400 truncate">{log.actor?.nip} ({log.actor?.role})</p>
                {/if}
              </td>
              <td class="py-3 font-mono text-emerald-700 font-semibold whitespace-nowrap">{log.action}</td>
              <td class="py-3 text-[11px] text-slate-500 whitespace-nowrap">{log.target_type || '-'}</td>
              <td
                class="py-3 font-mono text-[10px] text-slate-500 max-w-[160px] sm:max-w-xs truncate"
                title={log.detail ? JSON.stringify(log.detail) : '-'}
              >
                {log.detail ? JSON.stringify(log.detail) : '-'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
