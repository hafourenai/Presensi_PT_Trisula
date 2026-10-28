<script>
  import { enhance } from '$app/forms';
  import { ShieldCheck, UserCheck, UserX, Shield, CheckCircle2, AlertCircle, Trash2, MapPin } from '@lucide/svelte';

  let { data, form } = $props();

  let targetDeleteAccount = $state(null);
  let deleteNipInput = $state('');
  let isDeleting = $state(false);
</script>

<svelte:head>
  <title>Monitoring Semua Akun — Super Admin</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Monitoring Semua Akun</h1>
    <p class="mt-1 text-xs text-slate-500">
      Kontrol otoritas, manajemen role (Administrator, Pemilik, Admin HR, Karyawan), lokasi penempatan, dan penghapusan akun dari database
    </p>
  </div>

  {#if form?.successRole}
    <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
      Role akun berhasil diperbarui.
    </div>
  {/if}

  {#if form?.successDelete}
    <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
      Akun <strong>{form.deletedName}</strong> dan seluruh riwayat presensinya telah berhasil dihapus permanen dari database.
    </div>
  {/if}

  {#if form?.error}
    <div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
      {form.error}
    </div>
  {/if}

  <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-6">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead class="border-b border-slate-100 text-slate-400">
          <tr>
            <th class="pb-3 font-semibold uppercase tracking-wider">Identitas Pengguna</th>
            <th class="pb-3 font-semibold uppercase tracking-wider">Lokasi Kerja</th>
            <th class="pb-3 font-semibold uppercase tracking-wider">Status Login</th>
            <th class="pb-3 font-semibold uppercase tracking-wider">Role Akses</th>
            <th class="pb-3 font-semibold uppercase tracking-wider">Status Akun</th>
            <th class="pb-3 text-right font-semibold uppercase tracking-wider">Manajemen Akun</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-slate-700">
          {#each data.accounts as acc}
            <tr class="hover:bg-slate-50/50">
              <td class="py-3.5 max-w-[200px] sm:max-w-[280px]">
                <p class="font-bold text-slate-900 truncate">{acc.full_name}</p>
                <p class="text-[11px] text-slate-400 truncate">{acc.nip} · {acc.email}</p>
              </td>
              <td class="py-3.5 max-w-[140px] truncate">
                {#if acc.work_lat && acc.work_lng}
                  <span class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <MapPin class="h-3 w-3" />
                    <span>{acc.work_location_name || 'Khusus'}</span>
                  </span>
                {:else}
                  <span class="text-slate-400 text-[11px]">Kantor Pusat</span>
                {/if}
              </td>
              <td class="py-3.5 whitespace-nowrap">
                <p class="text-[11px] text-slate-600">
                  {acc.last_login_at ? new Date(acc.last_login_at).toLocaleString('id-ID') : 'Belum pernah'}
                </p>
                {#if acc.must_change_password}
                  <span class="inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Wajib Ganti Sandi</span>
                {/if}
              </td>
              <td class="py-3.5 whitespace-nowrap">
                <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 capitalize">
                  {acc.role}
                </span>
              </td>
              <td class="py-3.5 whitespace-nowrap">
                {#if acc.is_active}
                  <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <UserCheck class="h-3.5 w-3.5" />
                    <span>Aktif</span>
                  </span>
                {:else}
                  <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500">
                    <UserX class="h-3.5 w-3.5" />
                    <span>Nonaktif</span>
                  </span>
                {/if}
              </td>
              <td class="py-3.5 text-right whitespace-nowrap">
                <div class="inline-flex items-center gap-2">
                  <form method="POST" action="?/updateRole" use:enhance class="inline-flex items-center gap-1.5">
                    <input type="hidden" name="targetId" value={acc.id} />
                    <select
                      name="newRole"
                      class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
                    >
                      <option value="karyawan" selected={acc.role === 'karyawan'}>Karyawan</option>
                      <option value="hr" selected={acc.role === 'hr'}>HR</option>
                      <option value="administrator" selected={acc.role === 'administrator'}>Administrator</option>
                    </select>
                    <button
                      type="submit"
                      class="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                    >
                      Simpan
                    </button>
                  </form>

                  <button
                    type="button"
                    onclick={() => {
                      targetDeleteAccount = acc;
                      deleteNipInput = '';
                    }}
                    title="Hapus Akun Permanen"
                    class="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal Konfirmasi Hapus Akun -->
  {#if targetDeleteAccount}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div class="w-full max-w-md rounded-3xl border border-red-200 bg-white p-6 shadow-2xl space-y-4">
        <div class="flex items-center gap-2 text-red-600 font-bold text-sm">
          <Trash2 class="h-5 w-5 shrink-0" />
          <span>Hapus Akun dari Database</span>
        </div>

        <p class="text-xs text-slate-600 leading-relaxed">
          Anda akan menghapus akun <strong class="text-slate-900">{targetDeleteAccount.full_name}</strong> (<span class="font-mono">{targetDeleteAccount.nip}</span>) beserta seluruh riwayat presensi & file terkait. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
        </p>

        <div class="space-y-2 rounded-2xl bg-red-50 p-3.5 text-xs text-red-900">
          <p>Ketik NIP <strong class="font-mono text-red-700">{targetDeleteAccount.nip}</strong> untuk konfirmasi:</p>
          <input
            type="text"
            bind:value={deleteNipInput}
            placeholder="Ketik NIP di sini..."
            class="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-red-500 focus:outline-none"
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onclick={() => {
              targetDeleteAccount = null;
              deleteNipInput = '';
            }}
            class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Batal
          </button>

          <form
            method="POST"
            action="?/deleteAccount"
            use:enhance={() => {
              isDeleting = true;
              return async ({ update }) => {
                isDeleting = false;
                targetDeleteAccount = null;
                await update();
              };
            }}
          >
            <input type="hidden" name="targetId" value={targetDeleteAccount.id} />
            <button
              type="submit"
              disabled={deleteNipInput !== targetDeleteAccount.nip || isDeleting}
              class="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
            >
              {isDeleting ? 'Menghapus...' : 'Hapus Total'}
            </button>
          </form>
        </div>
      </div>
    </div>
  {/if}
</div>
