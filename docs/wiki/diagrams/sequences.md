# Sequence Diagram

## Alur: Presensi Masuk

Karyawan menekan "Presensi Masuk" di `/presensi` selama jam kerja.

```mermaid
sequenceDiagram
    actor K as Karyawan
    participant UI as presensi/+page.svelte
    participant MP as MediaPipe FaceDetector (WASM)
    participant API as api/presensi/+server.js
    participant DB as PostgreSQL (supabaseAdmin.from)
    participant ST as Supabase Storage
    participant N as notifications.js
    K->>UI: tekan Presensi Masuk
    UI->>UI: cek timeStatus.allowed (jam kerja)
    UI->>MP: initFaceDetector() (lazy import, GPU lalu CPU)
    UI->>UI: getUserMedia (kamera depan) + watchPosition (GPS)
    loop setiap frame
        UI->>MP: detectForVideo(video)
        MP-->>UI: detections.length
    end
    K->>UI: Ambil Foto (aktif hanya jika 1 wajah)
    UI->>UI: canvas 480px, toBlob JPEG 0.65, pratinjau
    K->>UI: Kirim
    UI->>API: POST multipart (photo, lat, lng, accuracy, timestamp, is_mock, device_id)
    API->>API: safeGetSession: role karyawan dan aktif?
    API->>API: cek anomali GPS, hitung tanggal & jam server WIB
    API->>DB: select user_devices
    alt belum ada perangkat utama
        API-->>UI: 403 needsRegistration
    else perangkat asing
        API->>DB: insert user_devices (is_trusted=false)
        API->>N: alertUnrecognizedDevice()
    end
    API->>DB: select settings (jam kerja, kantor)
    API->>API: calculateDistance() Haversine
    API->>ST: upload {uid}/{tanggal}/in.jpg
    API->>DB: select attendances hari ini
    alt sudah presensi masuk
        API-->>UI: 400 sudah presensi masuk
    else
        API->>DB: insert/update attendances (status, late_minutes, jarak, flags)
        API->>DB: insert audit_logs (check_in)
        API-->>UI: 200 {status, lateMinutes, distanceM, message}
    end
    UI-->>K: ringkasan + form terkunci
```

### Walkthrough

1. **Validasi jam kerja & kamera**: `startAttendanceFlow()` di [`presensi/+page.svelte`](../../../src/routes/presensi/+page.svelte).
2. **Deteksi wajah**: `detectFaces()` dengan `requestAnimationFrame`.
3. **Kompresi**: `capturePhoto()`.
4. **Pengiriman**: `submitAttendance()`.
5. **Pencatatan**: `POST` di [`api/presensi/+server.js`](../../../src/routes/api/presensi/+server.js).

## Alur: Login Karyawan + Verifikasi Perangkat

```mermaid
sequenceDiagram
    actor K as Karyawan
    participant L as login/+page.server.js
    participant AUTH as Supabase Auth
    participant DB as PostgreSQL
    participant DA as device-auth.js
    participant N as notifications.js
    K->>L: identifier (NIP/email) + password + device_id
    opt identifier bukan email
        L->>DB: select email from profiles where nip
    end
    L->>AUTH: signInWithPassword
    AUTH-->>L: user + cookie sesi
    L->>DB: select profile (aktif? role sesuai portal?)
    L->>DB: select user_devices
    L->>DA: evaluateLoginDevice()
    alt mismatch & belum konfirmasi
        L->>AUTH: signOut
        L->>DB: audit login_unrecognized_device_warning
        L-->>K: 409 Peringatan perangkat lain
    else mismatch & sudah konfirmasi
        L->>DA: recordUnrecognizedDevice(alwaysAlert)
        DA->>N: alertUnrecognizedDevice (in-app + Telegram)
        L-->>K: redirect /presensi?device_warning=1
    else needs_registration atau must_change_password
        L-->>K: redirect /ganti-password
    else trusted
        L->>DB: update last_login_at, audit login
        L-->>K: redirect /presensi
    end
```

### Walkthrough

1. **Terjemahan NIP ke email, lalu login**: [`login/+page.server.js`](../../../src/routes/login/+page.server.js).
2. **Evaluasi perangkat**: `evaluateLoginDevice()` di [`device-auth.js`](../../../src/lib/server/device-auth.js).

## Alur: Pembuatan Akun Karyawan oleh HR

```mermaid
sequenceDiagram
    actor HR as Admin HR
    participant P as admin/karyawan/baru/+page.server.js
    participant AUTH as Supabase Auth Admin API
    participant DB as PostgreSQL
    HR->>P: NIP, nama, email, role, departemen, password awal
    P->>P: cek role aktor (administrator/admin_hr), role target (admin_hr/karyawan)
    P->>AUTH: auth.admin.createUser(email_confirm: true)
    AUTH-->>P: user.id
    P->>DB: insert profiles (must_change_password=true)
    alt insert profil gagal
        P->>AUTH: auth.admin.deleteUser (rollback)
        P-->>HR: error
    else berhasil
        P->>DB: insert audit_logs (create_employee_account)
        P-->>HR: tampilkan NIP + password awal
    end
```

## Alur: Melihat Foto Presensi (Signed URL)

```mermaid
sequenceDiagram
    actor U as Pengguna
    participant S as api/storage/signed-url/+server.js
    participant ST as Supabase Storage
    U->>S: GET ?path={uid}/{tanggal}/in.jpg
    S->>S: karyawan hanya boleh path miliknya sendiri
    S->>ST: createSignedUrl(path, 60 detik)
    ST-->>S: signedUrl
    S-->>U: {url}
```
