<script>
  import { ArrowUpRight, Search, Users, Clock, UserCheck, Calendar, MapPin, ShieldAlert, ChevronLeft, ChevronRight, Bell } from '@lucide/svelte';

  let { data } = $props();
  let query = $state('');
  let status = $state('all');
  let sort = $state('latest');
  let page = $state(0);
  const pageSize = 5;
  const time = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  const date = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long' });
  const number = new Intl.NumberFormat('id-ID');
  const metrics = $derived([
    { label: 'Karyawan aktif', value: data.totalActiveEmployees, note: 'Terdaftar dalam sistem', icon: Users },
    { label: 'Sudah hadir', value: data.summary.totalHadir, note: `${data.summary.hadirTepatWaktu} tepat waktu`, icon: UserCheck },
    { label: 'Terlambat', value: data.summary.terlambat, note: 'Memerlukan perhatian', icon: Clock },
    { label: 'Belum presensi', value: data.summary.belumPresensi, note: 'Menunggu check-in', icon: Calendar }
  ]);
  const distribution = $derived([
    { label: 'Tepat waktu', value: data.summary.hadirTepatWaktu, color: '#37715a' },
    { label: 'Terlambat', value: data.summary.terlambat, color: '#d5743c' },
    { label: 'Belum presensi', value: data.summary.belumPresensi, color: '#b7ac99' },
    { label: 'Tidak hadir', value: data.summary.tidakHadir, color: '#a34f4f' }
  ]);
  const distributionTotal = $derived(distribution.reduce((sum, item) => sum + item.value, 0));
  const rows = $derived.by(() => {
    const term = query.trim().toLocaleLowerCase('id-ID');
    return data.recentAttendances.filter((item) => {
      const text = `${item.profile?.full_name || ''} ${item.profile?.nip || ''} ${item.profile?.department?.name || ''}`.toLocaleLowerCase('id-ID');
      return (!term || text.includes(term)) && (status === 'all' || item.status === status);
    }).toSorted((a, b) => sort === 'name'
      ? (a.profile?.full_name || '').localeCompare(b.profile?.full_name || '', 'id-ID')
      : new Date(b.check_in_at).getTime() - new Date(a.check_in_at).getTime());
  });
  const pages = $derived(Math.max(1, Math.ceil(rows.length / pageSize)));
  const currentPage = $derived(Math.min(page, pages - 1));
  const visible = $derived(rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize));
  function resetPage() { page = 0; }
  function initials(name = '') { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'KY'; }
</script>

<svelte:head><title>Dashboard Kehadiran — Presensi Karyawan</title></svelte:head>

<div class="attendance-dashboard">
  <header class="dashboard-heading">
    <div>
      <p class="eyebrow">Ringkasan operasional</p>
      <h1>Dashboard kehadiran</h1>
      <p class="subtitle">{date.format(new Date(`${data.today}T12:00:00+07:00`))} · Waktu Indonesia Barat</p>
    </div>
    <a class="action" href="/admin/laporan">Buka laporan <ArrowUpRight size={16} /></a>
  </header>

  <section class="metrics" aria-label="Ringkasan kehadiran hari ini">
    {#each metrics as metric}
      <article class="panel metric">
        <div class="metric-label"><h2>{metric.label}</h2><metric.icon size={17} strokeWidth={1.6} /></div>
        <p class="metric-value">{number.format(metric.value)}</p>
        <p class="muted">{metric.note}</p>
      </article>
    {/each}
  </section>

  <div class="overview-grid">
    <section class="panel distribution" aria-labelledby="distribution-title">
      <div class="section-heading"><div><h2 id="distribution-title">Kehadiran hari ini</h2><p class="muted">Distribusi status presensi yang tercatat</p></div><span class="date-label">HARI INI</span></div>
      <div class="attendance-total"><strong>{number.format(data.summary.totalHadir)}</strong><span>karyawan sudah hadir</span></div>
      <div class="distribution-bar" aria-hidden="true">
        {#each distribution as item}
          {#if item.value > 0}<span style:width={`${item.value / (distributionTotal || 1) * 100}%`} style:background={item.color}></span>{/if}
        {/each}
      </div>
      <ul class="distribution-legend">
        {#each distribution as item}
          <li><span class="legend-label"><i style:background={item.color}></i>{item.label}</span><strong>{number.format(item.value)}</strong></li>
        {/each}
      </ul>
      <div class="signals"><span><MapPin size={15} /> {data.summary.diLuarRadius} di luar radius</span><span><ShieldAlert size={15} /> {data.summary.perangkatTidakDikenal} perangkat asing</span></div>
    </section>

    <section class="panel ranking" aria-labelledby="ranking-title">
      <div class="section-heading"><div><h2 id="ranking-title">Keterlambatan terbanyak</h2><p class="muted">Bulan berjalan</p></div><Clock size={18} /></div>
      {#if data.topLateList.length}
        <ol class="ranking-list">
          {#each data.topLateList as item, index}
            <li><span class="rank">{index + 1}</span><div class="person"><strong>{item.name}</strong><span>{item.dept}</span></div><div class="late-count"><strong>{item.count} kali</strong><span>{item.totalMinutes} menit</span></div></li>
          {/each}
        </ol>
      {:else}
        <div class="empty"><UserCheck size={26} /><p>Belum ada keterlambatan bulan ini.</p></div>
      {/if}
    </section>
  </div>

  <section class="panel activity" aria-labelledby="activity-title">
    <div class="section-heading activity-heading"><div><h2 id="activity-title">Aktivitas presensi terbaru</h2><p class="muted">Pencarian dan filter pada 10 check-in terbaru hari ini.</p></div><a class="text-link" href="/admin/laporan">Lihat semua <ArrowUpRight size={14} /></a></div>
    <div class="table-toolbar">
      <label class="search"><Search size={16} /><span class="sr-only">Cari nama, NIP, atau departemen</span><input type="search" bind:value={query} oninput={resetPage} placeholder="Cari nama, NIP, departemen…" /></label>
      <div class="filters"><label><span class="sr-only">Filter status</span><select bind:value={status} onchange={resetPage}><option value="all">Semua status</option><option value="tepat_waktu">Tepat waktu</option><option value="terlambat">Terlambat</option></select></label><label><span class="sr-only">Urutan presensi</span><select bind:value={sort} onchange={resetPage}><option value="latest">Terbaru</option><option value="name">Nama A–Z</option></select></label></div>
    </div>
    <div class="table-scroll">
      <table>
        <caption class="sr-only">Sepuluh check-in terbaru, dengan filter lokal dan lima baris per halaman</caption>
        <thead><tr><th scope="col">Karyawan</th><th scope="col">Departemen</th><th scope="col">Status</th><th scope="col" aria-sort={sort === 'latest' ? 'descending' : 'none'}>Masuk (WIB)</th><th scope="col">Catatan</th></tr></thead>
        <tbody>
          {#each visible as item (item.id)}
            <tr><td><div class="employee"><span class="avatar">{initials(item.profile?.full_name)}</span><div class="person"><strong>{item.profile?.full_name || 'Tanpa nama'}</strong><span>{item.profile?.nip || '—'}</span></div></div></td><td>{item.profile?.department?.name || '—'}</td><td><span class:late={item.status === 'terlambat'} class="status">{item.status === 'tepat_waktu' ? 'Tepat waktu' : item.status === 'terlambat' ? `Terlambat ${item.late_minutes || 0}m` : 'Tidak hadir'}</span></td><td class="numeric">{item.check_in_at ? time.format(new Date(item.check_in_at)) : '—'}</td><td><div class="flags">{#if item.is_unrecognized_device}<span>Perangkat asing</span>{/if}{#if item.is_suspicious_location}<span>Lokasi mencurigakan</span>{/if}{#if !item.is_unrecognized_device && !item.is_suspicious_location}<span class="muted">—</span>{/if}</div></td></tr>
          {:else}
            <tr><td colspan="5"><div class="empty"><Search size={24} /><p>{query || status !== 'all' ? 'Tidak ada presensi yang sesuai filter.' : 'Belum ada check-in hari ini.'}</p>{#if query || status !== 'all'}<button class="text-link" onclick={() => { query = ''; status = 'all'; page = 0; }}>Hapus filter</button>{/if}</div></td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <footer class="pagination"><span aria-live="polite">{rows.length ? `${currentPage * pageSize + 1}–${Math.min(rows.length, (currentPage + 1) * pageSize)} dari ${rows.length}` : '0 hasil'}</span><div><button aria-label="Halaman sebelumnya" disabled={currentPage === 0} onclick={() => page = currentPage - 1}><ChevronLeft size={16} /></button><span>{currentPage + 1} / {pages}</span><button aria-label="Halaman berikutnya" disabled={currentPage >= pages - 1} onclick={() => page = currentPage + 1}><ChevronRight size={16} /></button></div></footer>
  </section>

  {#if data.latestNotifications.length}
    <section class="panel notifications" aria-labelledby="notifications-title"><div class="section-heading"><h2 id="notifications-title">Pemberitahuan audit</h2><Bell size={17} /></div><ul>{#each data.latestNotifications as notification}<li><div><strong>{notification.title}</strong><p>{notification.message}</p></div><time datetime={notification.created_at}>{time.format(new Date(notification.created_at))} WIB</time></li>{/each}</ul></section>
  {/if}
  <p class="footnote">Data diperbarui saat halaman dimuat. Buka laporan untuk riwayat dan ekspor lengkap.</p>
</div>

<style>
  .attendance-dashboard { --surface: var(--color-surface); --border: var(--color-rule); --muted: var(--color-muted); --accent: var(--color-brand); color: var(--color-ink); background: var(--color-paper); border-radius: 14px; padding: clamp(16px, 2.5vw, 32px); max-width: 1360px; margin: 0 auto; }
  .dashboard-heading, .section-heading, .metric-label, .table-toolbar, .pagination, .pagination > div { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .dashboard-heading { flex-wrap: wrap; margin-bottom: 24px; }
  .eyebrow, .date-label { font: 10px/1.5 monospace; letter-spacing: .12em; color: var(--muted); text-transform: uppercase; }
  h1 { font-size: clamp(23px, 3vw, 32px); letter-spacing: -.045em; font-weight: 650; margin: 4px 0 8px; }
  h2 { font-size: 13px; font-weight: 650; }
  .subtitle, .muted, .footnote { color: var(--muted); font-size: 12px; line-height: 1.6; }
  .action { display: inline-flex; align-items: center; gap: 16px; background: #303028; color: #fffaf1; padding: 10px 14px; border-radius: 9px; font-size: 12px; }
  .action:hover { background: #49483d; }
  .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 3px 12px -8px #58483133; min-width: 0; }
  .metric { padding: 19px; }
  .metric-label { color: var(--muted); gap: 8px; }
  .metric-value { font-size: 34px; font-weight: 600; line-height: 1; letter-spacing: -.04em; margin: 21px 0 10px; font-variant-numeric: tabular-nums; }
  .overview-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr); gap: 16px; margin-bottom: 16px; }
  .distribution, .ranking { padding: 22px; }
  .section-heading .muted { margin-top: 4px; }
  .attendance-total { display: flex; align-items: baseline; gap: 10px; margin: 26px 0 18px; }
  .attendance-total strong { font-size: 38px; font-weight: 600; letter-spacing: -.04em; }
  .attendance-total span { color: var(--muted); font-size: 12px; }
  .distribution-bar { display: flex; gap: 3px; height: 24px; border-radius: 6px; overflow: hidden; background: #eee7db; }
  .distribution-bar span { min-width: 2px; }
  .distribution-legend { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; margin-top: 24px; font-size: 12px; }
  .distribution-legend li, .legend-label { display: flex; align-items: center; gap: 8px; }
  .distribution-legend li { justify-content: space-between; }
  .legend-label i { width: 8px; height: 8px; border-radius: 2px; }
  .signals { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 25px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); }
  .signals span { display: inline-flex; align-items: center; gap: 6px; }
  .ranking-list { margin-top: 16px; }
  .ranking-list li { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
  .ranking-list li:last-child { border: 0; }
  .rank { font: 12px monospace; color: var(--muted); }
  .person { min-width: 0; flex: 1; }
  .person strong, .person span, .late-count strong, .late-count span { display: block; }
  .person strong { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .person span, .late-count span { color: var(--muted); font-size: 11px; margin-top: 3px; }
  .late-count { text-align: right; flex-shrink: 0; }
  .late-count strong { color: var(--accent); font-size: 12px; }
  .activity-heading { padding: 20px 22px 16px; flex-wrap: wrap; }
  .text-link { display: inline-flex; align-items: center; gap: 6px; color: var(--accent); font-size: 12px; cursor: pointer; }
  .text-link:hover { text-decoration: underline; }
  .table-toolbar { padding: 0 22px 18px; flex-wrap: wrap; }
  .search { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border); border-radius: 8px; padding: 0 10px; color: var(--muted); flex: 1; max-width: 350px; min-width: 180px; }
  input { width: 100%; min-width: 0; height: 35px; font-size: 12px; background: transparent; }
  input:focus { outline: none; }
  .search:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  .filters { display: flex; gap: 8px; }
  select { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; height: 35px; padding: 0 8px; font-size: 12px; }
  .table-scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }
  th { color: var(--muted); background: #f8f2e7; font: 10px/1.5 monospace; text-transform: uppercase; letter-spacing: .06em; padding: 12px 18px; white-space: nowrap; border-block: 1px solid var(--border); }
  td { padding: 14px 18px; border-bottom: 1px solid var(--border); }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: #f8f3e9; }
  .employee { display: flex; gap: 10px; align-items: center; min-width: 160px; }
  .avatar { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: #eee5d6; color: #62543c; font-size: 10px; flex-shrink: 0; }
  .status { display: inline-block; white-space: nowrap; background: #e9f0e8; color: #365e43; padding: 4px 8px; border-radius: 5px; font-size: 11px; }
  .status.late { background: #faecdc; color: #8c4b1c; }
  .numeric { font-family: monospace; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .flags { display: flex; flex-direction: column; gap: 4px; color: #974b39; font-size: 11px; }
  .empty { min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--muted); font-size: 12px; text-align: center; }
  .pagination { padding: 12px 22px; border-top: 1px solid var(--border); color: var(--muted); font: 11px monospace; }
  .pagination > div { gap: 10px; }
  .pagination button { padding: 5px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }
  .pagination button:disabled { opacity: .35; cursor: default; }
  .notifications { margin-top: 16px; padding: 20px 22px; }
  .notifications li { display: flex; justify-content: space-between; gap: 20px; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px; font-size: 12px; }
  .notifications strong { font-weight: 600; }
  .notifications p { color: var(--muted); margin-top: 4px; }
  .notifications time { white-space: nowrap; font: 10px monospace; color: var(--muted); }
  .footnote { margin-top: 18px; font-size: 10px; }
  a:focus-visible, button:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  @media (max-width: 1000px) { .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } .overview-grid { grid-template-columns: 1fr; } }
  @media (max-width: 480px) { .metric { padding: 14px; } .metric-label h2 { font-size: 11px; } .metric-value { font-size: 29px; } .distribution, .ranking { padding: 16px; } .distribution-legend { gap: 12px; font-size: 11px; } .activity-heading, .table-toolbar { padding-inline: 16px; } .notifications li { flex-direction: column; gap: 6px; } .search { max-width: none; } }
</style>
