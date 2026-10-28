-- 1. Tabel Perangkat Terdaftar Karyawan
CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT 'Perangkat Utama',
  user_agent TEXT,
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  is_trusted BOOLEAN NOT NULL DEFAULT true,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON public.user_devices(device_id);

-- 2. Tambahkan kolom device info pada tabel attendances
ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS check_in_device_id TEXT,
  ADD COLUMN IF NOT EXISTS check_in_device_name TEXT,
  ADD COLUMN IF NOT EXISTS is_unrecognized_device BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS check_out_device_id TEXT;

-- 3. Tabel Notifikasi In-App (untuk Karyawan dan HR/Admin)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL berarti broadcast ke semua Admin/HR
  target_role TEXT, -- 'admin_hr', 'administrator', 'karyawan', atau null
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'device_mismatch', -- 'device_mismatch', 'system_alert', dll
  payload JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON public.notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- 4. Konfigurasi Telegram pada tabel settings
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_alerts_enabled BOOLEAN NOT NULL DEFAULT true;

-- 5. RLS Policies
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- User devices: Karyawan dapat melihat perangkatnya sendiri
CREATE POLICY "Users can view own devices"
  ON public.user_devices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin/HR dapat melihat semua perangkat
CREATE POLICY "Admin can view all devices"
  ON public.user_devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('administrator', 'pemilik', 'admin_hr')
    )
  );

-- Notifications: User dapat melihat notifikasi yang ditujukan padanya atau ke role-nya
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      user_id IS NULL AND target_role IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (
          profiles.role::text = target_role
          OR (target_role = 'admin_hr' AND profiles.role IN ('administrator', 'pemilik', 'admin_hr'))
        )
      )
    )
  );
