# Database Migration Guide: Booking-Seat Junction Table

## Overview
This migration creates a proper many-to-many relationship between bookings and seats using a junction table, replacing the current array-based approach.

## Benefits
✅ Proper referential integrity with foreign keys
✅ Automatic cascade deletes
✅ Better query performance with indexes
✅ Easier to maintain and extend
✅ Standard relational database pattern

---

## Step-by-Step Migration Process

### Step 1: Access Supabase SQL Editor
1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar

### Step 2: Run the Migration Script
1. Open the file `database-migration.sql` in this project
2. Copy the entire SQL script
3. Paste it into the Supabase SQL Editor
4. Click **Run** to execute

### Step 3: Verify the Migration
Run this query to check the data was migrated correctly:

```sql
SELECT 
    b.id, 
    b.name, 
    b.seat_ids as old_array,
    array_agg(bs.seat_id) as new_junction
FROM bookings b
LEFT JOIN booking_seats bs ON b.id = bs.booking_id
GROUP BY b.id, b.name, b.seat_ids
ORDER BY b.id;
```

**Expected Result:**
- `old_array` and `new_junction` should match for each booking
- All bookings should have corresponding entries in `booking_seats`

### Step 4: Enable Row Level Security (RLS)
Add these policies to the `booking_seats` table:

```sql
-- Enable RLS
ALTER TABLE booking_seats ENABLE ROW LEVEL SECURITY;

-- Allow public to read booking_seats (needed for seat availability checks)
CREATE POLICY "Allow public read access" ON booking_seats
    FOR SELECT
    USING (true);

-- Allow authenticated users (admins) to manage booking_seats
CREATE POLICY "Allow authenticated insert" ON booking_seats
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete" ON booking_seats
    FOR DELETE
    TO authenticated
    USING (true);
```

### Step 5: Update Application Code
The new helper functions are in `src/utils/bookingHelpers.js`. Update these files:

#### Files to Update:
1. ✅ `src/pages/BookingPage.jsx` - Use `createBookingWithSeats()`
2. ✅ `src/pages/admin/EditSeatsPage.jsx` - Use `findBookingBySeat()` and `deleteBookingWithSeats()`
3. ✅ `src/pages/admin/BookingsPage.jsx` - Use `getBookingsWithSeats()`

### Step 6: Test the Migration
1. **Create a new booking** from the public booking page
2. **Check the admin bookings page** - should display correctly
3. **Try to annulate a booking** - should release seats
4. **Book a seat from admin** - should create proper records
5. **Unbook a seat from admin** - should delete the booking

### Step 7: Clean Up (After Testing)
Once you've verified everything works for at least a week:

```sql
-- Remove the old seat_ids column (BACKUP YOUR DATA FIRST!)
ALTER TABLE bookings DROP COLUMN seat_ids;
```

---

## Rollback Plan (If Needed)

If something goes wrong, you can rollback:

```sql
-- Drop the junction table
DROP TABLE IF EXISTS booking_seats CASCADE;

-- The old seat_ids column is still there as backup
-- Your app will continue to work with the old code
```

---

## New Database Schema

### `booking_seats` (Junction Table)
```
┌─────────────┬──────────┬─────────────────────────┐
│ Column      │ Type     │ Constraints             │
├─────────────┼──────────┼─────────────────────────┤
│ booking_id  │ INTEGER  │ FK → bookings(id)       │
│ seat_id     │ TEXT     │ FK → seats(id)          │
│             │          │ PRIMARY KEY (both)      │
└─────────────┴──────────┴─────────────────────────┘
```

### Relationships
```
bookings (1) ←→ (many) booking_seats (many) ←→ (1) seats
```

---

## Helper Functions Available

### `createBookingWithSeats(bookingData, seatIds)`
Creates a booking with proper seat relationships

### `deleteBookingWithSeats(bookingId)`
Deletes a booking and releases all its seats

### `getBookingsWithSeats(eventId)`
Fetches bookings with full seat details

### `findBookingBySeat(seatId)`
Finds which booking owns a specific seat

### `checkSeatsAvailability(seatIds)`
Checks if seats are available before booking

---

## Questions?
If you encounter any issues during migration, check:
1. Supabase logs in the dashboard
2. Browser console for errors
3. Network tab for failed requests

The migration is designed to be **non-destructive** - your old data remains intact as a backup.
