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
    const uniqueSeatIds = dedupeSeatIds(seatIds).map((id) => String(id));

    if (uniqueSeatIds.length === 0) {
        throw new Error('At least one seat must be selected.');
    }

    const { data, error } = await supabase.rpc('create_booking_with_seats', {
        p_name: bookingData.name,
        p_email: bookingData.email,
        p_phone: bookingData.phone,
        p_event_id: bookingData.event_id,
        p_total_price: bookingData.total_price,
        p_seats: bookingData.seats,
        p_seat_ids: uniqueSeatIds,
    });

    if (error) {
        if (error.code === 'PGRST202') {
            throw new Error('Database function create_booking_with_seats() is missing. Run hardened-rls-patch.sql first.');
        }
        throw error;
    }

    if (!data?.success) {
        return {
            success: false,
            reason: data?.reason || 'BOOKING_FAILED',
            unavailableSeatIds: data?.unavailable_seat_ids || [],
        };
    }

    return {
        success: true,
        booking: {
            id: data.booking_id,
            ...bookingData,
        },
    };
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
