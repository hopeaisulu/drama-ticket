-- WARNING: This will DELETE all existing seats and create a new grid!
-- Use this in the Supabase SQL Editor to bulk generate a large hall.

DO $$
DECLARE
    -- CONFIGURATION: Change these numbers as needed
    total_rows INTEGER := 15;     -- Number of rows
    seats_per_row INTEGER := 20;  -- Number of seats per row
    event_id_val BIGINT;           -- Event ID to associate with
    
    r INTEGER;
    s INTEGER;
    s_type TEXT;
    s_price INTEGER;
BEGIN
    -- Get the ID of the 'Esfir' event (assuming it's the first one, or ID 1)
    SELECT id INTO event_id_val FROM public.events LIMIT 1;

    -- 1. DELETE EXISTING SEATS FOR THE TARGET EVENT ONLY
    DELETE FROM public.seats
    WHERE event_id = event_id_val;

    -- 2. GENERATE NEW SEATS
    FOR r IN 1..total_rows LOOP
        FOR s IN 1..seats_per_row LOOP
            
            -- Determine Type and Price based on Row
            IF r <= 3 THEN
                s_type := 'vip';
                s_price := 1000;
            ELSIF r >= (total_rows - 4) THEN
                s_type := 'budget';
                s_price := 300;
            ELSE
                s_type := 'standard';
                s_price := 500;
            END IF;

            -- Insert the seat
            INSERT INTO public.seats (id, row_num, seat_num, type, price, is_booked, event_id)
            VALUES (
                event_id_val || '-' || r || '-' || s,  -- ID format "event-row-seat"
                r,
                s,
                s_type,
                s_price,
                false,
                event_id_val
            );
            
        END LOOP;
    END LOOP;
END $$;
