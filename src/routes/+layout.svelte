<script>
  import '../app.css';
  import { page } from '$app/state';
  import {
    LayoutDashboard,
    Camera,
    History,
    Users,
    FileSpreadsheet,
    ShieldCheck,
    Settings,
    FileText,
    LogOut,
    UserCircle,
    Building2,
    Menu,
    X
  } from '@lucide/svelte';

  let { data, children } = $props();

  let sidebarOpen = $state(false);

  const role = $derived(data?.profile?.role);
  const isKaryawan = $derived(role === 'karyawan');
  const isAdminOrOwner = $derived(['administrator', 'pemilik', 'admin_hr'].includes(role));
  const isSuperAdmin = $derived(role === 'administrator');

  // Halaman mandiri (tanpa shell sidebar)
  const isAuthPage = $derived(
    page.url.pathname === '/login' || page.url.pathname === '/ganti-password'
  );
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</svelte:head>

{#if isAuthPage || !data?.user}
  {@render children()}
{:else}
  <div class="flex h-svh overflow-hidden bg-slate-50 font-['Plus_Jakarta_Sans',sans-serif] text-slate-800 antialiased">
    <!-- Desktop Sidebar (Khusus Admin / Pemilik / HR) -->
    {#if isAdminOrOwner}
      <aside class="hidden h-svh w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white lg:flex">
        <!-- Brand -->
        <div class="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-6">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-600/20">
            <Building2 class="h-5 w-5" />
          </div>
          <div>
            <h2 class="text-sm font-bold tracking-tight text-slate-900">Admin Portal</h2>
            <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{role}</p>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav class="flex-1 space-y-1.5 overflow-y-auto p-4 text-xs font-medium">
          <a
            href="/admin/dashboard"
            class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition {page.url.pathname === '/admin/dashboard' ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
          >
            <LayoutDashboard class="h-4 w-4" />
            <span>Dashboard</span>
          </a>

          <a
            href="/admin/karyawan"
            class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition {page.url.pathname.startsWith('/admin/karyawan') ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
          >
            <Users class="h-4 w-4" />
            <span>Kelola Karyawan</span>
          </a>

          <a
            href="/admin/laporan"
            class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition {page.url.pathname.startsWith('/admin/laporan') ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
          >
            <FileSpreadsheet class="h-4 w-4" />
            <span>Laporan & Rekap</span>
          </a>

          {#if isSuperAdmin}
            <div class="pt-4 pb-1">
              <p class="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Kontrol Sistem</p>
            </div>

            <a
              href="/admin/akun"
              class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition {page.url.pathname.startsWith('/admin/akun') ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
            >
              <ShieldCheck class="h-4 w-4" />
              <span>Monitoring Akun</span>
            </a>

            <a
              href="/admin/audit-log"
              class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition {page.url.pathname.startsWith('/admin/audit-log') ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
            >
              <FileText class="h-4 w-4" />
              <span>Audit Log</span>
            </a>

            <a
              href="/admin/pengaturan"
              class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition {page.url.pathname.startsWith('/admin/pengaturan') ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
            >
              <Settings class="h-4 w-4" />
              <span>Pengaturan Jam & GPS</span>
            </a>
          {/if}
        </nav>

        <!-- User Info & Logout -->
        <div class="shrink-0 border-t border-slate-100 p-4">
          <div class="flex items-center justify-between gap-3">
            <a href="/profil" class="flex items-center gap-2.5 truncate hover:opacity-80">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold text-xs uppercase">
                {data.profile?.full_name?.slice(0, 2) || 'AD'}
              </div>
              <div class="truncate text-left">
                <p class="truncate text-xs font-semibold text-slate-900">{data.profile?.full_name}</p>
                <p class="truncate text-[11px] text-slate-500">{data.profile?.email}</p>
              </div>
            </a>
            <form method="POST" action="/auth/logout">
              <button
                type="submit"
                class="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                title="Keluar"
              >
                <LogOut class="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <!-- Mobile Drawer for Admin -->
      {#if sidebarOpen}
        <div class="fixed inset-0 z-50 flex lg:hidden">
          <button
            class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onclick={() => (sidebarOpen = false)}
            aria-label="Tutup menu"
          ></button>
          <div class="relative flex w-72 max-w-xs flex-1 flex-col bg-white p-6 shadow-2xl overflow-y-auto">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white">
                  <Building2 class="h-5 w-5" />
                </div>
                <div class="min-w-0">
                  <h3 class="font-bold text-slate-900 text-sm truncate">Admin Portal</h3>
                  <p class="text-[10px] text-emerald-600 font-semibold uppercase truncate">{role}</p>
                </div>
              </div>
              <button onclick={() => (sidebarOpen = false)} class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 shrink-0">
                <X class="h-5 w-5" />
              </button>
            </div>

            <nav class="mt-4 flex-1 space-y-1 text-xs font-medium">
              <a
                href="/admin/dashboard"
                onclick={() => (sidebarOpen = false)}
                class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 {page.url.pathname === '/admin/dashboard' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600'}"
              >
                <LayoutDashboard class="h-4 w-4" />
                <span>Dashboard</span>
              </a>
              <a
                href="/admin/karyawan"
                onclick={() => (sidebarOpen = false)}
                class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 {page.url.pathname.startsWith('/admin/karyawan') ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600'}"
              >
                <Users class="h-4 w-4" />
                <span>Kelola Karyawan</span>
              </a>
              <a
                href="/admin/laporan"
                onclick={() => (sidebarOpen = false)}
                class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 {page.url.pathname.startsWith('/admin/laporan') ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600'}"
              >
                <FileSpreadsheet class="h-4 w-4" />
                <span>Laporan & Rekap</span>
              </a>

              {#if isSuperAdmin}
                <div class="pt-4 pb-1">
                  <p class="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Kontrol Sistem</p>
                </div>
                <a
                  href="/admin/akun"
                  onclick={() => (sidebarOpen = false)}
                  class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 {page.url.pathname.startsWith('/admin/akun') ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600'}"
                >
                  <ShieldCheck class="h-4 w-4" />
                  <span>Monitoring Akun</span>
                </a>
                <a
                  href="/admin/audit-log"
                  onclick={() => (sidebarOpen = false)}
                  class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 {page.url.pathname.startsWith('/admin/audit-log') ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600'}"
                >
                  <FileText class="h-4 w-4" />
                  <span>Audit Log</span>
                </a>
                <a
                  href="/admin/pengaturan"
                  onclick={() => (sidebarOpen = false)}
                  class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 {page.url.pathname.startsWith('/admin/pengaturan') ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600'}"
                >
                  <Settings class="h-4 w-4" />
                  <span>Pengaturan Jam & GPS</span>
                </a>
              {/if}
            </nav>

            <div class="border-t border-slate-100 pt-4">
              <form method="POST" action="/auth/logout">
                <button
                  type="submit"
                  class="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-2.5 text-xs font-semibold text-red-600"
                >
                  <LogOut class="h-4 w-4" />
                  <span>Keluar dari Akun</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      {/if}
    {/if}

    <!-- Main Content Area -->
    <div class="flex h-svh flex-1 flex-col min-w-0 overflow-hidden">
      <!-- Top Bar -->
      <header class="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          {#if isAdminOrOwner}
            <button
              onclick={() => (sidebarOpen = true)}
              class="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Buka Menu"
            >
              <Menu class="h-5 w-5" />
            </button>
          {/if}
          <div class="flex items-center gap-2">
            {#if isKaryawan}
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xs">
                <Building2 class="h-4 w-4" />
              </div>
              <span class="text-sm font-bold text-slate-900">Presensi Karyawan</span>
            {:else}
              <span class="text-xs font-bold uppercase tracking-wider text-slate-700 lg:hidden">Admin Portal</span>
            {/if}
          </div>
        </div>

        <div class="flex items-center gap-3 min-w-0">
          <div class="hidden text-right sm:block min-w-0">
            <p class="text-xs font-semibold text-slate-900 truncate max-w-[140px] md:max-w-[200px]">{data.profile?.full_name}</p>
            <p class="text-[11px] text-slate-500 capitalize truncate">{data.profile?.role}</p>
          </div>
          <a
            href="/profil"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold text-xs transition hover:bg-slate-200"
            title="Profil Saya"
          >
            <UserCircle class="h-5 w-5" />
          </a>
          {#if isKaryawan}
            <form method="POST" action="/auth/logout" class="shrink-0">
              <button
                type="submit"
                class="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                title="Keluar"
              >
                <LogOut class="h-4 w-4" />
              </button>
            </form>
          {/if}
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 {isKaryawan ? 'pb-24 sm:pb-6' : 'pb-6'}">
        {@render children()}
      </main>

      <!-- Bottom Bar (Mobile Karyawan) -->
      {#if isKaryawan}
        <nav class="fixed right-0 bottom-0 left-0 z-40 flex h-16 items-center justify-around border-t border-slate-200/80 bg-white/95 px-4 backdrop-blur-lg sm:hidden">
          <a
            href="/presensi"
            class="flex flex-col items-center gap-1 text-xs transition {page.url.pathname === '/presensi' ? 'font-bold text-emerald-600' : 'text-slate-400 hover:text-slate-600'}"
          >
            <Camera class="h-5 w-5" />
            <span>Presensi</span>
          </a>

          <a
            href="/riwayat"
            class="flex flex-col items-center gap-1 text-xs transition {page.url.pathname === '/riwayat' ? 'font-bold text-emerald-600' : 'text-slate-400 hover:text-slate-600'}"
          >
            <History class="h-5 w-5" />
            <span>Riwayat</span>
          </a>

          <a
            href="/profil"
            class="flex flex-col items-center gap-1 text-xs transition {page.url.pathname === '/profil' ? 'font-bold text-emerald-600' : 'text-slate-400 hover:text-slate-600'}"
          >
            <UserCircle class="h-5 w-5" />
            <span>Profil</span>
          </a>
        </nav>
      {/if}
    </div>
  </div>
{/if}
