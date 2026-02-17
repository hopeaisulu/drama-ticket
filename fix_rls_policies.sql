-- Fix Row Level Security (RLS) policies to allow public bookings

-- 1. Drop existing policies that might be blocking updates
DROP POLICY IF EXISTS "Enable read access for all users" ON public.seats;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.seats;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.seats;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.seats;
DROP POLICY IF EXISTS "Allow public read access to seats" ON public.seats;
DROP POLICY IF EXISTS "Allow public to book seats" ON public.seats;
DROP POLICY IF EXISTS "Allow authenticated users to insert seats" ON public.seats;
DROP POLICY IF EXISTS "Allow authenticated users to delete seats" ON public.seats;

-- 2. Create new policies that allow public to read and book seats
-- Allow everyone to read seats
CREATE POLICY "Allow public read access to seats"
ON public.seats FOR SELECT
USING (true);

-- Allow everyone to update seats (for booking)
CREATE POLICY "Allow public to book seats"
ON public.seats FOR UPDATE
USING (true)
WITH CHECK (true);

-- Guardrail for public updates:
-- unauthenticated users may only perform seat booking transition
-- (is_booked: false -> true) and may not alter structure/pricing fields.
CREATE OR REPLACE FUNCTION public.enforce_public_seat_booking_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.role() <> 'authenticated' THEN
        IF OLD.is_booked IS DISTINCT FROM FALSE OR NEW.is_booked IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION 'Public users can only book available seats';
        END IF;

        IF NEW.row_num IS DISTINCT FROM OLD.row_num
           OR NEW.seat_num IS DISTINCT FROM OLD.seat_num
           OR NEW.type IS DISTINCT FROM OLD.type
           OR NEW.price IS DISTINCT FROM OLD.price
           OR NEW.event_id IS DISTINCT FROM OLD.event_id
        THEN
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

-- Only authenticated users can insert/delete seats (admin only)
CREATE POLICY "Allow authenticated users to insert seats"
ON public.seats FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete seats"
ON public.seats FOR DELETE
TO authenticated
USING (true);

-- 3. Ensure RLS is enabled
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

-- 4. Also update events table policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.events;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.events;
DROP POLICY IF EXISTS "Allow public read access to events" ON public.events;
DROP POLICY IF EXISTS "Allow authenticated users to update events" ON public.events;

CREATE POLICY "Allow public read access to events"
ON public.events FOR SELECT
USING (true);

CREATE POLICY "Allow authenticated users to update events"
ON public.events FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
