# Class Diagram

Proyek ini memakai JavaScript fungsional (tanpa banyak class), jadi diagram dibagi dua: **model data (ERD)** yang menjadi pusat sistem, dan **modul server** beserta fungsi publiknya.

## Model Data

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "id (1:1)"
    DEPARTMENTS ||--o{ PROFILES : department_id
    PROFILES ||--o{ ATTENDANCES : "user_id (1 per hari)"
    PROFILES ||--o{ USER_DEVICES : user_id
    PROFILES ||--o{ NOTIFICATIONS : user_id
    PROFILES ||--o{ AUDIT_LOGS : actor_id
    PROFILES {
        uuid id PK
        text nip UK
        text full_name
        text email UK
        user_role role
        bool is_active
        bool must_change_password
        timestamptz consent_accepted_at
        float work_lat
        float work_lng
        int work_radius_m
    }
    ATTENDANCES {
        uuid id PK
        uuid user_id FK
        date work_date
        timestamptz check_in_at
        text check_in_photo
        real check_in_distance_m
        timestamptz check_out_at
        attendance_status status
        int late_minutes
        int early_leave_minutes
        bool is_suspicious_location
        text_array location_flags
        bool is_unrecognized_device
    }
    USER_DEVICES {
        uuid id PK
        uuid user_id FK
        text device_id
        text device_name
        bool is_trusted
        timestamptz last_used_at
    }
    SETTINGS {
        int id PK "selalu 1"
        time work_start
        time work_end
        int late_tolerance_min
        float office_lat
        float office_lng
        int office_radius_m
        int photo_retention_days
    }
    HOLIDAYS {
        date holiday_date PK
        text name
    }
    DEPARTMENTS {
        uuid id PK
        text name UK
    }
    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        text target_role
        text type
        jsonb payload
    }
    AUDIT_LOGS {
        bigint id PK
        uuid actor_id FK
        text action
        jsonb detail
    }
```

## Modul Server

```mermaid
classDiagram
    class supabaseAdmin {
        <<Proxy>>
        +from(table) QueryBuilder
        +rpc(fn, args)
        +auth.admin
        +storage
        +isLocalPg bool
        +invalidateCache(table)
    }
    class LocalDbClient {
        +from(table) LocalQueryBuilder
        +rpc(fn, args)
        +invalidateCache(table)
    }
    class LocalQueryBuilder {
        +select(cols, opts)
        +insert(payload)
        +update(payload)
        +eq(col, val)
        +order(col)
        +range(from, to)
        +single()
        +maybeSingle()
    }
    class HotTableCache
    class SupabaseCloud {
        <<external>>
        +auth
        +storage
    }
    class deviceAuth {
        <<module>>
        +evaluateLoginDevice(devices, deviceId)
        +registerPrimaryDevice(...)
        +recordUnrecognizedDevice(...)
        +getPrimaryDevice(devices)
    }
    class notifications {
        <<module>>
        +createNotification(...)
        +alertUnrecognizedDevice(...)
    }
    class telegram {
        <<module>>
        +sendTelegramAlert(text)
    }
    class audit {
        <<module>>
        +createAuditLog(actorId, action, ...)
    }
    class geo {
        <<module>>
        +calculateDistance(lat1, lon1, lat2, lon2) int
    }
    supabaseAdmin --> LocalDbClient : from/rpc (jika DATABASE_URL)
    supabaseAdmin --> SupabaseCloud : auth/storage
    LocalDbClient --> LocalQueryBuilder
    LocalDbClient --> HotTableCache
    deviceAuth --> notifications : alert
    notifications --> telegram
    notifications --> supabaseAdmin
    audit --> supabaseAdmin
```

## Catatan

- `attendance_status` = `tepat_waktu | terlambat | tidak_hadir`. "Pulang cepat" bukan status tersendiri, tetapi `early_leave_minutes > 0`.
- `user_role` = `administrator | pemilik (legacy) | admin_hr | karyawan`.
