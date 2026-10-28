<script>
  import {
    FileSpreadsheet,
    FileText,
    Download,
    Search,
    Filter,
    Calendar,
    CheckCircle2,
    Clock,
    XCircle,
    Image,
    X,
    Users,
    AlertTriangle,
    RotateCcw
  } from '@lucide/svelte';

  let { data } = $props();

  let activeTab = $state('detail'); // 'detail' | 'rekap'
  let selectedPhotoUrl = $state('');
  let modalTitle = $state('');
  let photoModalOpen = $state(false);
  let photoLoading = $state(false);

  async function openPhoto(path, title) {
    if (!path) return;
    photoLoading = true;
    modalTitle = title;
    photoModalOpen = true;
    try {
      const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
      const json = await res.json();
      if (json.success) {
        selectedPhotoUrl = json.url;
      }
    } catch (e) {
      console.error(e);
    } finally {
      photoLoading = false;
    }
  }

  function formatTime(isoString) {
    if (!isoString) return '--:--';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(isoString));
  }

  // Ekspor Excel (.xlsx) dengan Template & Styling (Header Banner, Banded Rows, Status Color, Borders, Freeze Pane)
  async function exportExcel() {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Presensi App Admin';
    workbook.created = new Date();

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    const headerFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // Slate 900
    };

    const zebraFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' } // Slate 50
    };

    const titleFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' } // Emerald 600
    };

    // --- SHEET 1: Detail Presensi ---
    const sheetDetail = workbook.addWorksheet('Detail Presensi', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }]
    });

    // Judul Banner
    sheetDetail.mergeCells('A1:K1');
    const titleCell = sheetDetail.getCell('A1');
    titleCell.value = 'LAPORAN RIWAYAT PRESENSI KARYAWAN';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = titleFill;
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheetDetail.getRow(1).height = 30;

    // Subtitle / Info Filter
    sheetDetail.mergeCells('A2:K2');
    const infoCell = sheetDetail.getCell('A2');
    const deptLabel = data.filters.deptId
      ? data.departments.find((d) => d.id === data.filters.deptId)?.name || 'Departemen Terpilih'
      : 'Semua Departemen';
    const empLabel = data.filters.employeeId
      ? data.employees.find((e) => e.id === data.filters.employeeId)?.full_name || 'Karyawan Terpilih'
      : 'Semua Karyawan';
    infoCell.value = `Periode: ${data.filters.startDate} s/d ${data.filters.endDate}   |   Departemen: ${deptLabel}   |   Karyawan: ${empLabel}   |   Total: ${data.attendances.length} Baris`;
    infoCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
    infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheetDetail.getRow(2).height = 18;

    sheetDetail.getRow(3).height = 6; // Spacing

    // Header Tabel Detail (Row 4)
    const detailHeaders = [
      'No',
      'Tanggal',
      'NIP',
      'Nama Karyawan',
      'Departemen',
      'Jam Masuk (WIB)',
      'Jam Pulang (WIB)',
      'Status',
      'Terlambat (m)',
      'Pulang Cepat (m)',
      'Jarak Masuk (m)'
    ];

    const detailHeaderRow = sheetDetail.getRow(4);
    detailHeaderRow.values = detailHeaders;
    detailHeaderRow.height = 24;
    detailHeaderRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = headerFill;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder;
    });

    // Data Rows
    data.attendances.forEach((r, idx) => {
      const rowNum = 5 + idx;
      const row = sheetDetail.getRow(rowNum);
      const isZebra = idx % 2 === 1;

      const statusText =
        r.status === 'tepat_waktu'
          ? 'Tepat Waktu'
          : r.status === 'terlambat'
            ? 'Terlambat'
            : 'Tidak Hadir';

      row.values = [
        idx + 1,
        r.work_date,
        r.profile?.nip || '-',
        r.profile?.full_name || '-',
        r.profile?.department?.name || '-',
        formatTime(r.check_in_at),
        formatTime(r.check_out_at),
        statusText,
        r.late_minutes || 0,
        r.early_leave_minutes || 0,
        r.check_in_distance_m !== null ? `${r.check_in_distance_m}m` : '-'
      ];

      row.height = 20;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 9 };
        cell.border = thinBorder;
        if (isZebra) cell.fill = zebraFill;

        // Alignment per kolom
        if ([1, 2, 6, 7, 8, 9, 10, 11].includes(colNum)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }

        // Status coloring
        if (colNum === 8) {
          cell.font = { name: 'Calibri', size: 9, bold: true };
          if (r.status === 'tepat_waktu') {
            cell.font.color = { argb: 'FF047857' }; // Emerald 700
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          } else if (r.status === 'terlambat') {
            cell.font.color = { argb: 'FFB45309' }; // Amber 700
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          } else {
            cell.font.color = { argb: 'FFB91C1C' }; // Red 700
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          }
        }
      });
    });

    // Lebar Kolom Detail
    sheetDetail.columns = [
      { width: 6 },  // No
      { width: 13 }, // Tanggal
      { width: 14 }, // NIP
      { width: 26 }, // Nama
      { width: 20 }, // Dept
      { width: 16 }, // Masuk
      { width: 16 }, // Pulang
      { width: 16 }, // Status
      { width: 14 }, // Telat
      { width: 16 }, // Cepat
      { width: 16 }  // Jarak
    ];

    sheetDetail.autoFilter = {
      from: 'A4',
      to: 'K4'
    };

    // --- SHEET 2: Rekapitulasi per Karyawan ---
    const sheetRekap = workbook.addWorksheet('Rekapitulasi Karyawan', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }]
    });

    // Judul Banner Rekap
    sheetRekap.mergeCells('A1:L1');
    const titleRekap = sheetRekap.getCell('A1');
    titleRekap.value = 'REKAPITULASI KEHADIRAN PER KARYAWAN';
    titleRekap.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRekap.fill = titleFill;
    titleRekap.alignment = { vertical: 'middle', horizontal: 'center' };
    sheetRekap.getRow(1).height = 30;

    // Subtitle Rekap
    sheetRekap.mergeCells('A2:L2');
    const infoRekap = sheetRekap.getCell('A2');
    infoRekap.value = `Periode: ${data.filters.startDate} s/d ${data.filters.endDate}   |   Total Karyawan: ${data.recap.length}`;
    infoRekap.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
    infoRekap.alignment = { vertical: 'middle', horizontal: 'center' };
    sheetRekap.getRow(2).height = 18;

    sheetRekap.getRow(3).height = 6;

    // Header Rekap (Row 4)
    const rekapHeaders = [
      'No',
      'NIP',
      'Nama Karyawan',
      'Departemen',
      'Total Hari',
      'Hadir',
      'Tepat Waktu',
      'Terlambat',
      'Total Telat (m)',
      'Pulang Cepat',
      'Tidak Hadir',
      'Kehadiran (%)'
    ];

    const rekapHeaderRow = sheetRekap.getRow(4);
    rekapHeaderRow.values = rekapHeaders;
    rekapHeaderRow.height = 24;
    rekapHeaderRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = headerFill;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder;
    });

    // Data Rekap
    data.recap.forEach((k, idx) => {
      const rowNum = 5 + idx;
      const row = sheetRekap.getRow(rowNum);
      const isZebra = idx % 2 === 1;

      row.values = [
        idx + 1,
        k.nip,
        k.fullName,
        k.departmentName,
        k.totalDays,
        k.presentCount,
        k.onTimeCount,
        k.lateCount,
        k.totalLateMinutes,
        k.earlyLeaveCount,
        k.absentCount,
        `${k.attendanceRate}%`
      ];

      row.height = 20;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 9 };
        cell.border = thinBorder;
        if (isZebra) cell.fill = zebraFill;

        if ([1, 2, 5, 6, 7, 8, 9, 10, 11, 12].includes(colNum)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }

        // Kehadiran % coloring
        if (colNum === 12) {
          cell.font = { name: 'Calibri', size: 9, bold: true };
          if (k.attendanceRate >= 90) {
            cell.font.color = { argb: 'FF047857' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          } else if (k.attendanceRate >= 75) {
            cell.font.color = { argb: 'FFB45309' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          } else {
            cell.font.color = { argb: 'FFB91C1C' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          }
        }
      });
    });

    // Lebar Kolom Rekap
    sheetRekap.columns = [
      { width: 6 },  // No
      { width: 14 }, // NIP
      { width: 26 }, // Nama
      { width: 20 }, // Dept
      { width: 12 }, // Total
      { width: 10 }, // Hadir
      { width: 13 }, // Tepat
      { width: 12 }, // Telat
      { width: 15 }, // Total Telat
      { width: 14 }, // Plg Cepat
      { width: 13 }, // Absen
      { width: 15 }  // %
    ];

    sheetRekap.autoFilter = {
      from: 'A4',
      to: 'L4'
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Presensi_${data.filters.startDate}_sampai_${data.filters.endDate}.xlsx`;
    link.click();
  }

  // Ekspor PDF menggunakan jsPDF + autoTable (Tabel Rekap + Tabel Detail)
  async function exportPDF() {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF('landscape');

    // Judul
    doc.setFontSize(14);
    doc.text(
      `Laporan & Rekapitulasi Presensi (${data.filters.startDate} s/d ${data.filters.endDate})`,
      14,
      14
    );

    // Section 1: Rekapitulasi per Karyawan
    doc.setFontSize(11);
    doc.text('1. Rekapitulasi Per Karyawan', 14, 22);

    const rekapRows = data.recap.map((k) => [
      k.nip,
      k.fullName,
      k.departmentName,
      String(k.totalDays),
      String(k.presentCount),
      String(k.onTimeCount),
      String(k.lateCount),
      `${k.totalLateMinutes}m`,
      String(k.earlyLeaveCount),
      String(k.absentCount),
      `${k.attendanceRate}%`
    ]);

    autoTable(doc, {
      head: [
        [
          'NIP',
          'Nama',
          'Departemen',
          'Total',
          'Hadir',
          'Tepat',
          'Telat',
          'Mnt Telat',
          'Plg Cepat',
          'Absen',
          'Kehadiran'
        ]
      ],
      body: rekapRows,
      startY: 25,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42] }
    });

    // Section 2: Detail Presensi Harian (di halaman baru jika perlu)
    doc.addPage();
    doc.setFontSize(11);
    doc.text('2. Detail Presensi Harian', 14, 14);

    const detailRows = data.attendances.map((r) => [
      r.work_date,
      r.profile?.nip || '-',
      r.profile?.full_name || '-',
      r.profile?.department?.name || '-',
      formatTime(r.check_in_at),
      formatTime(r.check_out_at),
      r.status === 'tepat_waktu' ? 'Tepat' : r.status === 'terlambat' ? 'Telat' : 'Absen',
      r.late_minutes ? `+${r.late_minutes}m` : '0',
      r.check_in_distance_m !== null ? `${r.check_in_distance_m}m` : '-'
    ]);

    autoTable(doc, {
      head: [
        ['Tanggal', 'NIP', 'Nama', 'Departemen', 'Masuk', 'Pulang', 'Status', 'Telat', 'Jarak']
      ],
      body: detailRows,
      startY: 18,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`Laporan_Presensi_${data.filters.startDate}_sampai_${data.filters.endDate}.pdf`);
  }
</script>

<svelte:head>
  <title>Laporan & Rekap — Admin Portal</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Laporan & Rekap Presensi</h1>
      <p class="mt-1 text-xs text-slate-500">
        Rekapitulasi kehadiran {data.recap.length} karyawan dan riwayat {data.attendances.length} presensi
      </p>
    </div>

    <!-- Export Action Buttons -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        onclick={exportExcel}
        class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
      >
        <FileSpreadsheet class="h-4 w-4 text-emerald-600" />
        <span>Ekspor Excel (.xlsx)</span>
      </button>

      <button
        onclick={exportPDF}
        class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
      >
        <FileText class="h-4 w-4" />
        <span>Ekspor PDF</span>
      </button>
    </div>
  </div>

  <!-- Filter Card -->
  <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
    <form method="GET" class="space-y-3 text-xs">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label for="startDate" class="block font-semibold uppercase tracking-wider text-slate-500 mb-1">Dari Tanggal</label>
          <input
            id="startDate"
            type="date"
            name="startDate"
            value={data.filters.startDate}
            class="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:outline-none"
          />
        </div>

        <div>
          <label for="endDate" class="block font-semibold uppercase tracking-wider text-slate-500 mb-1">Sampai Tanggal</label>
          <input
            id="endDate"
            type="date"
            name="endDate"
            value={data.filters.endDate}
            class="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:outline-none"
          />
        </div>

        <div>
          <label for="dept" class="block font-semibold uppercase tracking-wider text-slate-500 mb-1">Departemen</label>
          <select
            id="dept"
            name="dept"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-700 focus:outline-none"
          >
            <option value="">Semua Departemen</option>
            {#each data.departments as d}
              <option value={d.id} selected={data.filters.deptId === d.id}>{d.name}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="employeeId" class="block font-semibold uppercase tracking-wider text-slate-500 mb-1">Karyawan</label>
          <select
            id="employeeId"
            name="employeeId"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-700 focus:outline-none"
          >
            <option value="">Semua Karyawan</option>
            {#each data.employees as emp}
              <option value={emp.id} selected={data.filters.employeeId === emp.id}>
                {emp.full_name || 'Tanpa Nama'} ({emp.nip || '-'})
              </option>
            {/each}
          </select>
        </div>
      </div>

      <div class="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100">
        <div class="flex flex-wrap items-center gap-4">
          <div class="w-full sm:w-48">
            <label for="status" class="sr-only">Status Kehadiran</label>
            <select
              id="status"
              name="status"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="tepat_waktu" selected={data.filters.status === 'tepat_waktu'}>Tepat Waktu</option>
              <option value="terlambat" selected={data.filters.status === 'terlambat'}>Terlambat</option>
              <option value="tidak_hadir" selected={data.filters.status === 'tidak_hadir'}>Tidak Hadir</option>
            </select>
          </div>

          <label class="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="outsideOnly"
              value="true"
              checked={data.filters.outsideOnly}
              class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span class="text-xs font-medium text-slate-700">Hanya yang di luar radius ({data.radiusM}m)</span>
          </label>
        </div>

        <div class="flex items-center gap-2">
          {#if data.filters.deptId || data.filters.employeeId || data.filters.status || data.filters.outsideOnly}
            <a
              href="/admin/laporan"
              class="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              title="Reset Filter"
            >
              <RotateCcw class="h-3.5 w-3.5" />
              <span>Reset</span>
            </a>
          {/if}
          <button
            type="submit"
            class="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
          >
            Terapkan Filter
          </button>
        </div>
      </div>
    </form>
  </div>

  <!-- Tab Toggle (Rekap vs Detail) -->
  <div class="flex items-center justify-between border-b border-slate-200 pb-2">
    <div class="flex flex-wrap gap-2">
      <button
        onclick={() => (activeTab = 'detail')}
        class="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors {activeTab === 'detail'
          ? 'bg-slate-900 text-white'
          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}"
      >
        <Calendar class="h-4 w-4" />
        <span class="hidden sm:inline">Riwayat Presensi ({data.attendances.length})</span>
        <span class="sm:hidden">Riwayat ({data.attendances.length})</span>
      </button>

      <button
        onclick={() => (activeTab = 'rekap')}
        class="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors {activeTab === 'rekap'
          ? 'bg-slate-900 text-white'
          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}"
      >
        <Users class="h-4 w-4" />
        <span class="hidden sm:inline">Rekapitulasi Karyawan ({data.recap.length})</span>
        <span class="sm:hidden">Rekap ({data.recap.length})</span>
      </button>
    </div>
  </div>

  {#if activeTab === 'rekap'}
    <!-- Rekapitulasi Per Karyawan Card (FR-L4) -->
    <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-6">
      <div class="mb-4">
        <h3 class="text-sm font-bold text-slate-900">Rekapitulasi Kehadiran Per Karyawan</h3>
        <p class="text-xs text-slate-500">Agregasi presensi pada rentang tanggal {data.filters.startDate} s/d {data.filters.endDate}</p>
      </div>

      {#if data.recap.length === 0}
        <div class="py-12 text-center text-xs text-slate-400">
          Tidak ada data rekapitulasi untuk filter yang dipilih.
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="border-b border-slate-100 text-slate-400">
              <tr>
                <th class="pb-3 font-semibold uppercase tracking-wider">Karyawan</th>
                <th class="pb-3 font-semibold uppercase tracking-wider">Departemen</th>
                <th class="pb-3 text-center font-semibold uppercase tracking-wider">Total Hari</th>
                <th class="pb-3 text-center font-semibold uppercase tracking-wider">Tepat Waktu</th>
                <th class="pb-3 text-center font-semibold uppercase tracking-wider">Terlambat</th>
                <th class="pb-3 text-center font-semibold uppercase tracking-wider">Plg Cepat</th>
                <th class="pb-3 text-center font-semibold uppercase tracking-wider">Tidak Hadir</th>
                <th class="pb-3 text-center font-semibold uppercase tracking-wider">Luar Radius</th>
                <th class="pb-3 text-right font-semibold uppercase tracking-wider">% Kehadiran</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              {#each data.recap as k}
                <tr class="hover:bg-slate-50/50">
                  <td class="py-3 max-w-[140px] sm:max-w-[200px]">
                    <p class="font-semibold text-slate-900 truncate">{k.fullName}</p>
                    <p class="text-[11px] text-slate-400 truncate">{k.nip}</p>
                  </td>
                  <td class="py-3 max-w-[120px] sm:max-w-[180px] truncate">{k.departmentName}</td>
                  <td class="py-3 text-center font-medium">{k.totalDays}</td>
                  <td class="py-3 text-center">
                    <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      {k.onTimeCount}
                    </span>
                  </td>
                  <td class="py-3 text-center">
                    {#if k.lateCount > 0}
                      <span class="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700" title="Total {k.totalLateMinutes} menit">
                        {k.lateCount} ({k.totalLateMinutes}m)
                      </span>
                    {:else}
                      <span class="text-slate-400">0</span>
                    {/if}
                  </td>
                  <td class="py-3 text-center">
                    {#if k.earlyLeaveCount > 0}
                      <span class="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700" title="Total {k.totalEarlyLeaveMinutes} menit">
                        {k.earlyLeaveCount}
                      </span>
                    {:else}
                      <span class="text-slate-400">0</span>
                    {/if}
                  </td>
                  <td class="py-3 text-center">
                    {#if k.absentCount > 0}
                      <span class="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                        {k.absentCount}
                      </span>
                    {:else}
                      <span class="text-slate-400">0</span>
                    {/if}
                  </td>
                  <td class="py-3 text-center">
                    {#if k.outsideRadiusCount > 0}
                      <span class="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                        {k.outsideRadiusCount}
                      </span>
                    {:else}
                      <span class="text-slate-400">0</span>
                    {/if}
                  </td>
                  <td class="py-3 text-right">
                    <span class="font-mono font-bold {k.attendanceRate >= 90 ? 'text-emerald-600' : k.attendanceRate >= 75 ? 'text-amber-600' : 'text-red-600'}">
                      {k.attendanceRate}%
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Records Table Card -->
    <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-6">
      {#if data.attendances.length === 0}
        <div class="py-12 text-center text-xs text-slate-400">
          Tidak ada data presensi yang sesuai dengan filter.
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="border-b border-slate-100 text-slate-400">
              <tr>
                <th class="pb-3 font-semibold uppercase tracking-wider">Tanggal</th>
                <th class="pb-3 font-semibold uppercase tracking-wider">Karyawan</th>
                <th class="pb-3 font-semibold uppercase tracking-wider">Departemen</th>
                <th class="pb-3 font-semibold uppercase tracking-wider">Jam Masuk</th>
                <th class="pb-3 font-semibold uppercase tracking-wider">Jam Pulang</th>
                <th class="pb-3 font-semibold uppercase tracking-wider">Status</th>
                <th class="pb-3 font-semibold uppercase tracking-wider">Jarak Kantor</th>
                <th class="pb-3 font-semibold uppercase tracking-wider">Integritas GPS</th>
                <th class="pb-3 text-right font-semibold uppercase tracking-wider">Foto</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              {#each data.attendances as r}
                <tr class="hover:bg-slate-50/50">
                  <td class="py-3 font-bold text-slate-900 whitespace-nowrap">{r.work_date}</td>
                  <td class="py-3 max-w-[140px] sm:max-w-[200px]">
                    <p class="font-semibold text-slate-900 truncate">{r.profile?.full_name || '-'}</p>
                    <p class="text-[11px] text-slate-400 truncate">{r.profile?.nip || '-'}</p>
                  </td>
                  <td class="py-3 max-w-[120px] sm:max-w-[180px] truncate">{r.profile?.department?.name || '-'}</td>
                  <td class="py-3 font-mono font-medium whitespace-nowrap">{formatTime(r.check_in_at)}</td>
                  <td class="py-3 font-mono font-medium whitespace-nowrap">{formatTime(r.check_out_at)}</td>
                  <td class="py-3 whitespace-nowrap">
                    {#if r.status === 'tepat_waktu'}
                      <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Tepat Waktu</span>
                    {:else if r.status === 'terlambat'}
                      <span class="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">+{r.late_minutes}m</span>
                    {:else}
                      <span class="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Tidak Hadir</span>
                    {/if}
                    {#if r.early_leave_minutes && r.early_leave_minutes > 0}
                      <span class="ml-1 rounded-full bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold text-orange-700" title="Pulang lebih awal">
                        -{r.early_leave_minutes}m
                      </span>
                    {/if}
                  </td>
                  <td class="py-3 whitespace-nowrap">
                    {#if r.check_in_distance_m !== null}
                      <span class="{r.check_in_distance_m > data.radiusM ? 'font-bold text-amber-700' : 'text-slate-600'}">
                        {r.check_in_distance_m}m
                        {#if r.check_in_distance_m > data.radiusM}
                          <span class="block text-[10px] text-amber-600">(Luar Radius)</span>
                        {/if}
                      </span>
                    {:else}
                      <span class="text-slate-400">-</span>
                    {/if}
                  </td>
                  <td class="py-3 whitespace-nowrap">
                    {#if r.is_suspicious_location}
                      <span class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700" title={r.location_flags ? r.location_flags.join(', ') : 'Indikasi manipulasi lokasi'}>
                        <AlertTriangle class="h-3 w-3 text-red-600" />
                        <span>Indikasi Fake GPS</span>
                      </span>
                    {:else}
                      <span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                        <CheckCircle2 class="h-3.5 w-3.5" />
                        <span>Valid</span>
                      </span>
                    {/if}
                  </td>
                  <td class="py-3 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      {#if r.check_in_photo}
                        <button
                          onclick={() => openPhoto(r.check_in_photo, `Foto Masuk - ${r.profile?.full_name} (${r.work_date})`)}
                          class="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50"
                          title="Foto Masuk"
                        >
                          <Image class="h-4 w-4" />
                        </button>
                      {/if}
                      {#if r.check_out_photo}
                        <button
                          onclick={() => openPhoto(r.check_out_photo, `Foto Pulang - ${r.profile?.full_name} (${r.work_date})`)}
                          class="rounded-lg p-1 text-blue-600 hover:bg-blue-50"
                          title="Foto Pulang"
                        >
                          <Image class="h-4 w-4" />
                        </button>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Modal Foto Popup -->
{#if photoModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
    <div class="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 shadow-2xl">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100">
        <h4 class="text-xs font-bold text-slate-900">{modalTitle}</h4>
        <button
          onclick={() => {
            photoModalOpen = false;
            selectedPhotoUrl = '';
          }}
          class="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <div class="mt-4 flex min-h-64 items-center justify-center rounded-2xl bg-slate-100 overflow-hidden">
        {#if photoLoading}
          <div class="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"></div>
        {:else if selectedPhotoUrl}
          <img src={selectedPhotoUrl} alt="Foto Presensi" class="w-full object-cover" />
        {:else}
          <p class="text-xs text-slate-400">Foto tidak dapat dimuat.</p>
        {/if}
      </div>
    </div>
  </div>
{/if}
