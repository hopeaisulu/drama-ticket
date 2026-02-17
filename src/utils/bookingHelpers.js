import { supabase } from './supabaseClient';

/**
 * Database helper functions for booking-seat junction table flow
 */

const dedupeSeatIds = (seatIds = []) => [...new Set(seatIds.filter(Boolean))];

/**
 * Create a booking with atomic seat-lock attempt and junction rows.
 * Returns success=false when some seats were taken concurrently.
 */
export const createBookingWithSeats = async (bookingData, seatIds) => {
    const uniqueSeatIds = dedupeSeatIds(seatIds);

    if (uniqueSeatIds.length === 0) {
        throw new Error('At least one seat must be selected.');
    }

    // 1) Lock seats by flipping only currently available seats
    const { data: lockedSeats, error: lockError } = await supabase
        .from('seats')
        .update({ is_booked: true })
        .in('id', uniqueSeatIds)
        .eq('is_booked', false)
        .select('id');

    if (lockError) throw lockError;

    const lockedSeatIds = (lockedSeats || []).map((seat) => seat.id);
    if (lockedSeatIds.length !== uniqueSeatIds.length) {
        // Release any partial locks so users can retry safely.
        if (lockedSeatIds.length > 0) {
            await supabase
                .from('seats')
                .update({ is_booked: false })
                .in('id', lockedSeatIds);
        }

        return {
            success: false,
            reason: 'SEATS_UNAVAILABLE',
            unavailableSeatIds: uniqueSeatIds.filter((id) => !lockedSeatIds.includes(id)),
        };
    }

    let createdBookingId = null;

    try {
        // 2) Create booking row
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .insert({
                name: bookingData.name,
                email: bookingData.email,
                phone: bookingData.phone,
                event_id: bookingData.event_id,
                total_price: bookingData.total_price,
                seats: bookingData.seats,
            })
            .select()
            .single();

        if (bookingError) throw bookingError;
        createdBookingId = booking.id;

        // 3) Create junction rows
        const junctionEntries = uniqueSeatIds.map((seatId) => ({
            booking_id: booking.id,
            seat_id: seatId,
        }));

        const { error: junctionError } = await supabase
            .from('booking_seats')
            .insert(junctionEntries);

        if (junctionError) throw junctionError;

        return { success: true, booking };
    } catch (error) {
        // Best-effort rollback of booking + seat lock on failure.
        if (createdBookingId) {
            await supabase
                .from('bookings')
                .delete()
                .eq('id', createdBookingId);
        }

        await supabase
            .from('seats')
            .update({ is_booked: false })
            .in('id', uniqueSeatIds);

        throw error;
    }
};

/**
 * Delete a booking and release all seats linked in booking_seats.
 */
export const deleteBookingWithSeats = async (bookingId) => {
    const { data: bookingSeats, error: fetchError } = await supabase
        .from('booking_seats')
        .select('seat_id')
        .eq('booking_id', bookingId);

    if (fetchError) throw fetchError;

    const seatIds = (bookingSeats || []).map((bs) => bs.seat_id);

    const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

    if (deleteError) throw deleteError;

    if (seatIds.length > 0) {
        const { error: seatsError } = await supabase
            .from('seats')
            .update({ is_booked: false })
            .in('id', seatIds);

        if (seatsError) throw seatsError;
    }

    return { success: true, releasedSeats: seatIds.length };
};

/**
 * Get bookings with seat details via booking_seats junction.
 */
export const getBookingsWithSeats = async (eventId = null) => {
    let query = supabase
        .from('bookings')
        .select(`
            *,
            booking_seats (
                seat_id,
                seats (
                    row_num,
                    seat_num,
                    type,
                    price
                )
            )
        `)
        .order('created_at', { ascending: false });

    if (eventId) {
        query = query.eq('event_id', eventId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((booking) => {
        const seatDetails = (booking.booking_seats || [])
            .filter((bs) => bs?.seats)
            .map((bs) => ({
                id: bs.seat_id,
                row: bs.seats.row_num,
                seat: bs.seats.seat_num,
                type: bs.seats.type,
                price: bs.seats.price,
            }));

        return {
            ...booking,
            seatDetails,
            seatIds: (booking.booking_seats || []).map((bs) => bs.seat_id),
        };
    });
};

/**
 * Find booking row that owns a specific seat.
 */
export const findBookingBySeat = async (seatId) => {
    const { data, error } = await supabase
        .from('booking_seats')
        .select(`
            booking_id,
            bookings (
                id,
                name,
                email,
                phone,
                seats,
                total_price,
                event_id,
                created_at
            )
        `)
        .eq('seat_id', seatId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }

    return data?.bookings || null;
};

/**
 * Check if requested seats are currently available.
 */
export const checkSeatsAvailability = async (seatIds) => {
    const uniqueSeatIds = dedupeSeatIds(seatIds);

    const { data, error } = await supabase
        .from('seats')
        .select('id, is_booked')
        .in('id', uniqueSeatIds);

    if (error) throw error;

    const bookedSeats = (data || []).filter((seat) => seat.is_booked);

    return {
        available: bookedSeats.length === 0,
        bookedSeats: bookedSeats.map((s) => s.id),
        allSeatsFound: (data || []).length === uniqueSeatIds.length,
    };
};
