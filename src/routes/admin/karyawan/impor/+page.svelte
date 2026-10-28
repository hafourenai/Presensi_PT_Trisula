<script>
  import { enhance } from '$app/forms';
  import { ArrowLeft, Upload, Download, CheckCircle2, AlertCircle, FileSpreadsheet } from '@lucide/svelte';

  let { data, form } = $props();
  let loading = $state(false);
  let csvText = $state(`NIP,Nama,Email,Password,Departemen,Jabatan
KRY002,Budi Santoso,budi@perusahaan.com,Password123,Teknologi Informasi,Software Engineer
KRY003,Siti Rahma,siti@perusahaan.com,Password123,Keuangan,Staff Akuntansi`);

  function downloadTemplate() {
    const template = `NIP,Nama,Email,Password,Departemen,Jabatan\nKRY002,Budi Santoso,budi@perusahaan.com,Password123,Teknologi Informasi,Software Engineer\nKRY003,Siti Rahma,siti@perusahaan.com,Password123,Keuangan,Staff Akuntansi`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_karyawan_presensi.csv';
    link.click();
  }
</script>

<svelte:head>
  <title>Impor Massal Karyawan — Admin Portal</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-3">
      <a href="/admin/karyawan" class="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 shrink-0">
        <ArrowLeft class="h-4 w-4" />
      </a>
      <div>
        <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Impor Massal Karyawan</h1>
        <p class="mt-0.5 text-xs text-slate-500">Impor hingga ratusan data karyawan sekaligus melalui format CSV</p>
      </div>
    </div>

    <button
      onclick={downloadTemplate}
      class="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 shrink-0"
    >
      <Download class="h-4 w-4" />
      <span>Unduh Template CSV</span>
    </button>
  </div>

  {#if form?.importResult}
    <div class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
      <h3 class="text-sm font-bold text-slate-900">Hasil Impor Data</h3>
      <div class="mt-4 grid grid-cols-2 gap-4 text-center">
        <div class="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
          <p class="text-xs font-bold text-emerald-700">Berhasil Dibuat</p>
          <p class="mt-1 text-2xl font-extrabold text-emerald-900">{form.importResult.success}</p>
        </div>
        <div class="rounded-2xl bg-red-50 p-4 border border-red-100">
          <p class="text-xs font-bold text-red-700">Gagal / Dilewati</p>
          <p class="mt-1 text-2xl font-extrabold text-red-900">{form.importResult.failed}</p>
        </div>
      </div>

      {#if form.importResult.errors.length > 0}
        <div class="mt-4 rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
          <p class="font-bold text-red-600">Catatan Error:</p>
          <ul class="mt-2 list-disc pl-4 space-y-1 text-slate-600 font-mono text-[11px] break-all">
            {#each form.importResult.errors as err}
              <li>{err}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}

  <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-8">
    <h3 class="text-sm font-bold text-slate-900">Format dan Teks CSV</h3>
    <p class="mt-1 text-xs text-slate-500">
      Pastikan baris pertama adalah nama kolom: <code class="break-all font-mono">NIP,Nama,Email,Password,Departemen,Jabatan</code>
    </p>

    <form
      method="POST"
      use:enhance={() => {
        loading = true;
        return async ({ update }) => {
          loading = false;
          await update();
        };
      }}
      class="mt-4 space-y-4"
    >
      <textarea
        name="csvContent"
        bind:value={csvText}
        rows="10"
        required
        class="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 font-mono text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
        placeholder="Paste data CSV di sini..."
      ></textarea>

      <button
        type="submit"
        disabled={loading}
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/25 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
      >
        {#if loading}
          <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          <span>Memproses Impor...</span>
        {:else}
          <Upload class="h-4 w-4" />
          <span>Mulai Impor Massal Sekarang</span>
        {/if}
      </button>
    </form>
  </div>
</div>
