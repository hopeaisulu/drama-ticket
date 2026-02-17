import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataProvider';
import Swal from 'sweetalert2';
import { deleteBookingWithSeats, getBookingsWithSeats } from '../../utils/bookingHelpers';
import { notifyError, notifySuccess } from '../../utils/notify';
import '../../styles/Admin.css';

const BookingsPage = () => {
    const { fetchData, events } = useData();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEventId, setSelectedEventId] = useState('all');

    useEffect(() => {
        fetchBookings();
    }, []);

    const fetchBookings = async () => {
        try {
            setLoading(true);
            const data = await getBookingsWithSeats();
            setBookings(data || []);
        } catch (error) {
            console.error('Error fetching bookings:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelBooking = async (booking) => {
        const seatSummary = booking.seatDetails?.length
            ? booking.seatDetails.map(s => `Row ${s.row} Seat ${s.seat}`).join(', ')
            : booking.seats;

        const result = await Swal.fire({
            title: 'Annulate Booking?',
            text: `This will delete ${booking.name}'s booking and release seats: ${seatSummary}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff4757',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Yes, annulate it!',
            cancelButtonText: 'No, keep it'
        });

        if (result.isConfirmed) {
            try {
                await deleteBookingWithSeats(booking.id);

                setBookings(prev => prev.filter(b => b.id !== booking.id));
                await fetchData();
                notifySuccess('Booking canceled. Seats are now available.');
            } catch (error) {
                console.error('Cancellation error:', error);
                notifyError('Failed to cancel booking.');
            }
        }
    };

    // Filter by search AND showing date
    const filteredBookings = bookings.filter(b => {
        const matchesSearch =
            b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.phone.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesEvent = selectedEventId === 'all' || b.event_id === parseInt(selectedEventId);

        return matchesSearch && matchesEvent;
    });

    const getSeatPreview = (booking) => {
        const detailItems = booking.seatDetails || [];
        if (detailItems.length > 0) {
            const full = detailItems.map(s => `R${s.row}-S${s.seat}`).join(', ');
            const preview = detailItems.slice(0, 3).map(s => `R${s.row}-S${s.seat}`).join(', ');
            const remainder = detailItems.length - 3;
            return {
                full,
                short: remainder > 0 ? `${preview} +${remainder}` : preview
            };
        }

        return {
            full: booking.seats || '',
            short: booking.seats || ''
        };
    };

    if (loading) return <div className="loading-spinner">Loading bookings...</div>;

    return (
        <div className="bookings-page bookings-compact">
            <div className="flex-between mb-4 flex-wrap gap-4">
                <h1 className="page-title m-0">Customer Bookings</h1>
                <div className="flex gap-4">
                    <div className="filter-group">
                        <select
                            className="input-field mb-0 w-auto"
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                        >
                            <option value="all">All Showings</option>
                            {events.map(ev => (
                                <option key={ev.id} value={ev.id}>{ev.date}</option>
                            ))}
                        </select>
                    </div>
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="Search name, email, phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field mb-0"
                        />
                    </div>
                </div>
            </div>

            <div className="admin-card p-0 overflow-hidden">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Customer Name</th>
                            <th>Contact Info</th>
                            <th>Performance Date</th>
                            <th>Seats</th>
                            <th>Total</th>
                            <th>Booked At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBookings.length > 0 ? (
                            filteredBookings.map((booking) => {
                                const event = events.find(e => e.id === booking.event_id);
                                const seatSummary = getSeatPreview(booking);
                                return (
                                    <tr key={booking.id}>
                                        <td>#{booking.id}</td>
                                        <td>
                                            <div className="font-bold">{booking.name}</div>
                                        </td>
                                        <td>
                                            <div className="text-small">{booking.email}</div>
                                            <div className="text-muted text-tiny">{booking.phone}</div>
                                        </td>
                                        <td>
                                            <div className="font-bold text-primary">{event?.date || 'Unknown'}</div>
                                        </td>
                                        <td>
                                            <span className="seat-summary-tag" title={seatSummary.full}>{seatSummary.short}</span>
                                        </td>
                                        <td>
                                            <div className="font-bold text-success">{booking.total_price} KGS</div>
                                        </td>
                                        <td>
                                            <div className="text-muted text-tiny">
                                                {new Date(booking.created_at).toLocaleDateString()}<br />
                                                {new Date(booking.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-danger btn-small"
                                                onClick={() => handleCancelBooking(booking)}
                                                title="Cancel booking"
                                                aria-label="Cancel booking"
                                            >
                                                x
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="8" className="text-center py-12 text-muted">
                                    {searchTerm || selectedEventId !== 'all' ? 'No bookings match your filters.' : 'No bookings found yet.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BookingsPage;
