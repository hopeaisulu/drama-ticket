-- ============================================
-- Database Migration: Proper Seat-Booking Relationship
-- ============================================

-- Step 1: Create the junction table
CREATE TABLE IF NOT EXISTS booking_seats (
    booking_id BIGINT NOT NULL,
    seat_id TEXT NOT NULL,
    PRIMARY KEY (booking_id, seat_id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE
);

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_booking_seats_booking ON booking_seats(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_seats_seat ON booking_seats(seat_id);

-- Step 3: Migrate existing data from seat_ids array to junction table (if legacy column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'seat_ids'
    ) THEN
        INSERT INTO booking_seats (booking_id, seat_id)
        SELECT
            b.id as booking_id,
            unnest(b.seat_ids) as seat_id
        FROM bookings b
        WHERE b.seat_ids IS NOT NULL
          AND array_length(b.seat_ids, 1) > 0
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Step 4: RLS for booking_seats
ALTER TABLE booking_seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read booking_seats" ON booking_seats;
CREATE POLICY "Allow public read booking_seats"
ON booking_seats FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow public insert booking_seats" ON booking_seats;
CREATE POLICY "Allow public insert booking_seats"
ON booking_seats FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete booking_seats" ON booking_seats;
CREATE POLICY "Allow authenticated delete booking_seats"
ON booking_seats FOR DELETE
TO authenticated
USING (true);

-- Step 5: Verify the migration
-- Run this to check the data was migrated correctly:
-- SELECT 
--     b.id, 
--     b.name, 
--     b.seat_ids as old_array,
--     array_agg(bs.seat_id) as new_junction
-- FROM bookings b
-- LEFT JOIN booking_seats bs ON b.id = bs.booking_id
-- GROUP BY b.id, b.name, b.seat_ids;

-- Step 6: After verifying, you can optionally drop the old column
-- (Keep it for now as a backup, remove later after testing)
-- ALTER TABLE bookings DROP COLUMN IF EXISTS seat_ids;

-- ============================================
-- Notes:
-- - The junction table enforces referential integrity
-- - CASCADE deletes mean if a booking is deleted, its seat links are too
-- - If a seat is deleted, the booking link is removed (but booking stays)
-- - Much easier to query and maintain
-- ============================================
