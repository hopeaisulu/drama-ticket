import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    const [events, setEvents] = useState([]);
    const [seats, setSeats] = useState([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    // Initial Data Fetch
    useEffect(() => {
        fetchData();
        checkUser();

        // Real-time subscription for seats
        const channel = supabase
            .channel('public:seats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'seats' }, (payload) => {
                if (payload.eventType === 'UPDATE') {
                    setSeats(prev => prev.map(s => {
                        if (s.id === payload.new.id) {
                            return {
                                ...s,
                                ...payload.new,
                                row: payload.new.row_num,
                                seat: payload.new.seat_num,
                                isBooked: payload.new.is_booked
                            };
                        }
                        return s;
                    }));
                } else if (payload.eventType === 'INSERT') {
                    const newSeat = {
                        ...payload.new,
                        row: payload.new.row_num,
                        seat: payload.new.seat_num,
                        isBooked: payload.new.is_booked
                    };
                    setSeats(prev => {
                        if (prev.find(s => s.id === newSeat.id)) return prev;
                        return [...prev, newSeat];
                    });
                } else if (payload.eventType === 'DELETE') {
                    setSeats(prev => prev.filter(s => s.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchData = async () => {
        try {
            // Only show major loading spinner if we have NO data yet
            if (events.length === 0) {
                setLoading(true);
            }
            const { data: eventsData, error: eventsError } = await supabase
                .from('events')
                .select('*')
                .order('id', { ascending: true });

            if (eventsError) throw eventsError;

            // Map DB columns to app state
            const mappedEvents = (eventsData || []).map(e => ({
                ...e,
                cast: e.cast_members || [], // Map snake_case DB to camelCase/expected App state
                tiers: e.seat_tiers || [] // Map seat_tiers from DB
            }));
            setEvents(mappedEvents);

            const { data: seatsData, error: seatsError } = await supabase
                .from('seats')
                .select('*')
                .order('row_num', { ascending: true })
                .order('seat_num', { ascending: true });

            const mappedSeats = (seatsData || []).map(s => ({
                ...s,
                row: s.row_num,
                seat: s.seat_num,
                isBooked: s.is_booked
            }));

            setSeats(mappedSeats);
        } catch (error) {
            console.error('Error fetching data:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);

        supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(!!session);
        });
    };

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            console.error('Login error:', error.message);
            return false;
        }
        return true;
    };

    const logout = async () => {
        await supabase.auth.signOut();
    };

    // Admin Actions
    const updateEvent = async (updatedEvent) => {
        const originalEvent = events.find(e => e.id === updatedEvent.id);
        const originalTitle = originalEvent ? originalEvent.title : '';

        // Update in DB: all events that have the same title
        // This ensures title/description/image changes apply to the whole "Play"
        const { error } = await supabase
            .from('events')
            .update({
                title: updatedEvent.title,
                location: updatedEvent.location,
                description: updatedEvent.description,
                image: updatedEvent.image,
                category: updatedEvent.category,
                duration: updatedEvent.duration,
                director: updatedEvent.director,
                cast_members: updatedEvent.cast,
                seat_tiers: updatedEvent.tiers
            })
            .or(`id.eq.${updatedEvent.id}${originalTitle ? `,title.eq."${originalTitle}"` : ''}`);

        if (error) {
            console.error('Error updating event:', error.message);
            await fetchData(); // Refresh even on error to stay in sync
            return false;
        } else {
            await fetchData();
            // Force a slight delay to ensure DB state is stable before UI refresh
            await new Promise(resolve => setTimeout(resolve, 500));
            await fetchData();
            return true;
        }
    };

    const addShowing = async (baseEventId, newDate) => {
        try {
            const baseEvent = events.find(e => e.id === baseEventId);
            if (!baseEvent) throw new Error('Base event not found');

            // 1. Create new event
            const { data: newEvent, error: eventError } = await supabase
                .from('events')
                .insert({
                    title: baseEvent.title,
                    date: newDate,
                    location: baseEvent.location,
                    description: baseEvent.description,
                    image: baseEvent.image,
                    category: baseEvent.category,
                    duration: baseEvent.duration,
                    director: baseEvent.director,
                    cast_members: baseEvent.cast,
                    seat_tiers: baseEvent.tiers
                })
                .select()
                .single();

            if (eventError) throw eventError;

            // 2. Clone seats
            const { data: baseSeats, error: seatsFetchError } = await supabase
                .from('seats')
                .select('*')
                .eq('event_id', baseEventId);

            if (seatsFetchError) throw seatsFetchError;

            if (baseSeats.length > 0) {
                const clonedSeats = baseSeats.map(s => ({
                    id: `${newEvent.id}-${s.row_num}-${s.seat_num}`,
                    row_num: s.row_num,
                    seat_num: s.seat_num,
                    type: s.type,
                    price: s.price,
                    is_booked: false,
                    event_id: newEvent.id
                }));

                const { error: seatsInsertError } = await supabase
                    .from('seats')
                    .insert(clonedSeats);

                if (seatsInsertError) throw seatsInsertError;
            }

            await fetchData();
            return true;
        } catch (error) {
            console.error('Error adding showing:', error.message);
            return false;
        }
    };

    const deletePlayGroup = async (title) => {
        try {
            const playEvents = events.filter(e => e.title === title);
            const eventIds = playEvents.map(e => e.id);

            // Check for bookings in ANY of these events
            const { data: bookings, error: bookingsError } = await supabase
                .from('bookings')
                .select('id')
                .in('event_id', eventIds)
                .limit(1);

            if (bookings && bookings.length > 0) {
                throw new Error(`Cannot delete "${title}" because one or more showings have active bookings.`);
            }

            // Delete seats first (foreign key constraint)
            const { error: seatsError } = await supabase
                .from('seats')
                .delete()
                .in('event_id', eventIds);

            if (seatsError) throw seatsError;

            // Delete all events in this group
            const { error: eventError } = await supabase
                .from('events')
                .delete()
                .in('id', eventIds);

            if (eventError) throw eventError;

            await fetchData();
            return true;
        } catch (error) {
            console.error('Error deleting play group:', error.message);
            throw error;
        }
    };

    const deleteShowing = async (eventId) => {
        try {
            // Check for bookings first
            const { data: bookings, error: bookingsError } = await supabase
                .from('bookings')
                .select('id')
                .eq('event_id', eventId)
                .limit(1);

            if (bookings && bookings.length > 0) {
                throw new Error('Cannot delete showing with existing bookings.');
            }

            const { error: seatsError } = await supabase
                .from('seats')
                .delete()
                .eq('event_id', eventId);

            if (seatsError) throw seatsError;

            const { error: eventError } = await supabase
                .from('events')
                .delete()
                .eq('id', eventId);

            if (eventError) throw eventError;

            await fetchData();
            return true;
        } catch (error) {
            console.error('Error deleting event:', error.message);
            throw error;
        }
    };

    // Tier Management
    const addTier = async (newTier, eventId) => {
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        const updatedTiers = [...(event.tiers || []), newTier];
        const updatedEvent = { ...event, tiers: updatedTiers };

        await updateEvent(updatedEvent);
    };

    const deleteTier = async (tierName, eventId) => {
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        const updatedTiers = (event.tiers || []).filter(t => t.name !== tierName);
        const updatedEvent = { ...event, tiers: updatedTiers };
        await updateEvent(updatedEvent);

        const { error } = await supabase
            .from('seats')
            .update({
                type: 'standard',
                price: 500
            })
            .match({ type: tierName, event_id: eventId });

        if (error) {
            console.error('Error cleaning up seats:', error.message);
        } else {
            setSeats(prev => prev.map(s =>
                (s.type === tierName && s.event_id === eventId) ? { ...s, type: 'standard', price: 500 } : s
            ));
        }
    };

    const updateSeat = async (seatId, updates) => {
        setSeats(prev => prev.map(s => s.id === seatId ? { ...s, ...updates } : s));

        const dbUpdates = {};
        if (updates.type) dbUpdates.type = updates.type;
        if (updates.price !== undefined) dbUpdates.price = updates.price;

        const { error } = await supabase
            .from('seats')
            .update(dbUpdates)
            .eq('id', seatId);

        if (error) {
            console.error('Update seat error:', error.message);
            fetchData();
        }
    };

    const addRow = async (eventId) => {
        const eventSeats = seats.filter(s => s.event_id === eventId);
        const lastRow = Math.max(...eventSeats.map(s => s.row), 0);
        const newRow = lastRow + 1;
        const seatsPerRow = eventSeats.length > 0
            ? Math.max(...eventSeats.filter(s => s.row === lastRow).map(s => s.seat))
            : 10;

        const newSeats = [];
        for (let s = 1; s <= seatsPerRow; s++) {
            newSeats.push({
                id: `${eventId}-${newRow}-${s}`,
                row_num: newRow,
                seat_num: s,
                type: 'standard',
                price: 500,
                is_booked: false,
                event_id: eventId
            });
        }

        const optimisiticSeats = newSeats.map(s => ({
            ...s,
            row: s.row_num,
            seat: s.seat_num,
            isBooked: s.is_booked
        }));

        setSeats(prev => [...prev, ...optimisiticSeats]);

        const { error } = await supabase
            .from('seats')
            .insert(newSeats);

        if (error) {
            console.error('Add row error:', error.message);
            setSeats(prev => prev.filter(s => !(s.row === newRow && s.event_id === eventId)));
            alert(`Error adding row: ${error.message}`);
        }
    };

    const removeRow = async (rowNum, eventId) => {
        const rowSeats = seats.filter(s => s.row === rowNum && s.event_id === eventId);
        const hasBooked = rowSeats.some(s => s.isBooked);

        if (hasBooked) {
            throw new Error(`Cannot delete Row ${rowNum} because it has booked seats.`);
        }

        const previousSeats = [...seats];
        setSeats(prev => prev.filter(s => !(s.row === rowNum && s.event_id === eventId)));

        const { error } = await supabase
            .from('seats')
            .delete()
            .match({ row_num: rowNum, event_id: eventId });

        if (error) {
            console.error('Remove row error:', error.message);
            setSeats(previousSeats);
            throw new Error(error.message);
        }
    };

    const toggleSeatStatus = async (seatId) => {
        const seat = seats.find(s => s.id === seatId);
        if (!seat) return;

        const newStatus = !seat.isBooked;
        setSeats(prev => prev.map(s => s.id === seatId ? { ...s, isBooked: newStatus } : s));

        const { error } = await supabase
            .from('seats')
            .update({ is_booked: newStatus })
            .eq('id', seatId);

        if (error) {
            console.error('Toggle status error:', error.message);
            fetchData();
        }
    };

    const markSeatsAsBooked = (seatIds) => {
        setSeats(prev => prev.map(s =>
            seatIds.includes(s.id) ? { ...s, isBooked: true } : s
        ));
    };

    return (
        <DataContext.Provider value={{
            events,
            seats,
            isAuthenticated,
            loading,
            login,
            logout,
            updateEvent,
            addShowing,
            deleteShowing,
            deletePlayGroup,
            updateSeat,
            addRow,
            removeRow,
            toggleSeatStatus,
            markSeatsAsBooked,
            addTier,
            deleteTier,
            fetchData
        }}>
            {children}
        </DataContext.Provider>
    );
};
