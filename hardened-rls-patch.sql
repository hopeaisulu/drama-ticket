-- =========================================
-- Hardened RLS Patch (Idempotent)
-- =========================================
-- What this does:
-- 1) Introduces reusable admin check function.
-- 2) Removes legacy/overly-broad policies.
-- 3) Recreates stricter policies for events, seats, bookings, booking_seats.
-- 4) Keeps public booking flow functional while restricting destructive actions.
--
-- IMPORTANT:
-- This expects admin users to have one of:
-- - JWT app_metadata.role = 'admin'
-- - JWT app_metadata.is_admin = true
--
-- Example (run separately as service role):
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin","is_admin":true}'::jsonb
-- where email = 'you@example.com';

-- ---------- 0) Helper function ----------
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    auth.role() = 'service_role'
    OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    OR coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true';
$$;

-- ---------- 1) Ensure RLS enabled ----------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_seats ENABLE ROW LEVEL SECURITY;

-- ---------- 2) Drop policy drift / legacy names ----------
-- events
DROP POLICY IF EXISTS "Public events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Allow public read access to events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Allow authenticated users to update events" ON public.events;

-- seats
DROP POLICY IF EXISTS "Public seats are viewable by everyone" ON public.seats;
DROP POLICY IF EXISTS "Allow public read access to seats" ON public.seats;
DROP POLICY IF EXISTS "Admins can update seats" ON public.seats;
DROP POLICY IF EXISTS "Allow public to book seats" ON public.seats;
DROP POLICY IF EXISTS "Allow authenticated users to insert seats" ON public.seats;
DROP POLICY IF EXISTS "Allow authenticated users to delete seats" ON public.seats;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.seats;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.seats;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.seats;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.seats;

-- bookings
DROP POLICY IF EXISTS "Admins can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;

-- booking_seats
DROP POLICY IF EXISTS "Allow public read booking_seats" ON public.booking_seats;
DROP POLICY IF EXISTS "Allow public insert booking_seats" ON public.booking_seats;
DROP POLICY IF EXISTS "Allow authenticated delete booking_seats" ON public.booking_seats;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.booking_seats;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.booking_seats;
DROP POLICY IF EXISTS "Allow public read access" ON public.booking_seats;

-- ---------- 3) Recreate hardened policies ----------
-- EVENTS
CREATE POLICY "events_public_select"
ON public.events
FOR SELECT
USING (true);

CREATE POLICY "events_admin_update"
ON public.events
FOR UPDATE
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "events_admin_insert"
ON public.events
FOR INSERT
WITH CHECK (public.is_admin_user());

CREATE POLICY "events_admin_delete"
ON public.events
FOR DELETE
USING (public.is_admin_user());

-- SEATS
CREATE POLICY "seats_public_select"
ON public.seats
FOR SELECT
USING (true);

-- Public booking transition is allowed; row-level guardrail is handled by trigger function below.
CREATE POLICY "seats_public_update_for_booking"
ON public.seats
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "seats_admin_insert"
ON public.seats
FOR INSERT
WITH CHECK (public.is_admin_user());

CREATE POLICY "seats_admin_delete"
ON public.seats
FOR DELETE
USING (public.is_admin_user());

CREATE POLICY "seats_admin_update"
ON public.seats
FOR UPDATE
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- BOOKINGS
CREATE POLICY "bookings_admin_select"
ON public.bookings
FOR SELECT
USING (public.is_admin_user());

-- Public create allowed for checkout flow.
CREATE POLICY "bookings_public_insert"
ON public.bookings
FOR INSERT
WITH CHECK (true);

CREATE POLICY "bookings_admin_update"
ON public.bookings
FOR UPDATE
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "bookings_admin_delete"
ON public.bookings
FOR DELETE
USING (public.is_admin_user());

-- BOOKING_SEATS
CREATE POLICY "booking_seats_public_select"
ON public.booking_seats
FOR SELECT
USING (true);

-- Public insert allowed for checkout flow.
CREATE POLICY "booking_seats_public_insert"
ON public.booking_seats
FOR INSERT
WITH CHECK (true);

CREATE POLICY "booking_seats_admin_delete"
ON public.booking_seats
FOR DELETE
USING (public.is_admin_user());

-- ---------- 4) Seat update guardrail trigger ----------
CREATE OR REPLACE FUNCTION public.enforce_public_seat_booking_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    -- Public users: only allowed transition is available -> booked
    IF OLD.is_booked IS DISTINCT FROM FALSE OR NEW.is_booked IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Public users can only book available seats';
    END IF;

    -- Public users cannot alter metadata
    IF NEW.row_num IS DISTINCT FROM OLD.row_num
       OR NEW.seat_num IS DISTINCT FROM OLD.seat_num
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.price IS DISTINCT FROM OLD.price
       OR NEW.event_id IS DISTINCT FROM OLD.event_id THEN
      RAISE EXCEPTION 'Public users cannot modify seat metadata';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_public_seat_booking_update ON public.seats;
CREATE TRIGGER trg_enforce_public_seat_booking_update
BEFORE UPDATE ON public.seats
FOR EACH ROW
EXECUTE FUNCTION public.enforce_public_seat_booking_update();

-- ---------- 5) Suggested supporting constraints ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'seats_event_row_seat_unique'
      AND conrelid = 'public.seats'::regclass
  ) THEN
    ALTER TABLE public.seats
      ADD CONSTRAINT seats_event_row_seat_unique UNIQUE (event_id, row_num, seat_num);
  END IF;
END $$;
