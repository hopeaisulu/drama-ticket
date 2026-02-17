import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataProvider';
import Button from '../components/Button';
import SeatMap from '../components/SeatMap';
import '../styles/BookingPage.css';

import emailjs from '@emailjs/browser';
import { EMAILJS_CONFIG } from '../utils/emailConfig';
import { createBookingWithSeats } from '../utils/bookingHelpers';


const BookingPage = () => {
    const { id } = useParams();
    const { events, seats: allSeats, markSeatsAsBooked, loading, fetchData } = useData();

    React.useEffect(() => {
        fetchData();
    }, []);

    const event = events.find(e => e.id === parseInt(id));
    const eventSeats = allSeats.filter(s => s.event_id === event?.id);

    const [status, setStatus] = useState('idle'); // idle, sending, success, error
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: ''
    });

    if (loading || !event) {
        return <div className="loading-spinner">Loading booking details...</div>;
    }

    const handleSeatClick = (seat) => {
        setSelectedSeats(prev => {
            const exists = prev.find(s => s.id === seat.id);
            if (exists) {
                return prev.filter(s => s.id !== seat.id);
            } else {
                return [...prev, seat];
            }
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const totalPrice = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (selectedSeats.length === 0) {
            alert("Please select at least one seat.");
            return;
        }

        setStatus('sending');

        // 1. Save booking details and mark seats as booked
        try {
            const bookingResult = await createBookingWithSeats({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                seats: selectedSeats.map(s => `Row ${s.row} Seat ${s.seat}`).join(', '),
                total_price: totalPrice,
                event_id: event.id
            }, selectedSeats.map(s => s.id));

            if (!bookingResult.success && bookingResult.reason === 'SEATS_UNAVAILABLE') {
                setStatus('idle');
                alert("Oops! Someone just booked one of your chosen seats. Please choose fresh seats.");
                fetchData(); // Refresh the map
                setSelectedSeats([]);
                return;
            }

            // Update local state immediately
            markSeatsAsBooked(selectedSeats.map(s => s.id));
        } catch (error) {
            console.error('Failed to save booking:', error);
            setStatus('error');
            alert('Failed to complete booking. Please try again.');
            return;
        }

        // 2. Check if EmailJS is configured for confirmation
        if (EMAILJS_CONFIG.SERVICE_ID === 'YOUR_SERVICE_ID_HERE') {
            console.log("EmailJS is not configured - skipping email, but booking is saved.");
            setTimeout(() => setStatus('success'), 1000);
            return;
        }

        // 3. Send confirmation email
        const templateParams = {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            event_title: event.title,
            tickets_count: selectedSeats.length,
            seats: selectedSeats.map(s => `Row ${s.row} Seat ${s.seat} `).join(', '),
            total_price: totalPrice
        };

        emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID,
            templateParams,
            EMAILJS_CONFIG.PUBLIC_KEY
        )
            .then((result) => {
                console.log('Email sent:', result.text);
                setStatus('success');
            }, (error) => {
                console.error('Email error:', error.text);
                // Booking is saved even if email fails
                setStatus('success');
            });
    };

    if (status === 'success') {
        return (
            <div className="container booking-success">
                <div className="success-card">
                    <div className="success-icon">✓</div>
                    <h2>Booking Confirmed!</h2>
                    <p>Thank you, {formData.name}.</p>
                    <p>You have booked {selectedSeats.length} ticket(s) for <strong>{event.title}</strong>.</p>

                    <div className="booked-seats-list">
                        <p><strong>Seats:</strong> {selectedSeats.map(s => `Row ${s.row} Seat ${s.seat} `).join(', ')}</p>
                    </div>

                    <p className="confirmation-note">A confirmation email has been sent to {formData.email}.</p>
                    <div className="success-actions">
                        <Link to="/">
                            <Button>Back to Home</Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container booking-page">
            <Link to="/" className="back-link">← Back to Event</Link>
            <h1 className="page-title">Complete Your Booking</h1>

            <div className="booking-grid">
                <div className="booking-form-section">
                    {/* Seat Selection First */}
                    <div className="section-card">
                        <h3 style={{ marginBottom: '1.5rem' }}>Select Your Seats</h3>
                        <SeatMap
                            seats={eventSeats}
                            tiers={event.tiers}
                            selectedSeats={selectedSeats}
                            onSeatClick={handleSeatClick}
                        />
                        {selectedSeats.length > 0 && (
                            <div className="selected-seats-summary">
                                You have selected {selectedSeats.length} seat(s).
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="booking-form expanded-form">
                        <h3 className="mb-4">Contact Information</h3>

                        <p className="text-small text-muted mb-6">
                            We only use your details to send ticket confirmations and contact you regarding show updates.
                        </p>

                        <div className="form-group">
                            <label className="input-label">Full Name</label>
                            <input
                                className="input-field"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="John Doe"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="input-label">Email</label>
                                <input
                                    className="input-field"
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div className="form-group">
                                <label className="input-label">Phone</label>
                                <input
                                    className="input-field"
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                    placeholder="+996 555 123 456"
                                />
                            </div>
                        </div>

                        <Button type="submit" fullWidth disabled={selectedSeats.length === 0 || status === 'sending'}>
                            {status === 'sending' ? 'Sending Confirmation...' :
                                selectedSeats.length === 0 ? 'Select Seats to Proceed' :
                                    `Confirm Booking(${totalPrice} KGS)`}
                        </Button>

                        <p className="text-tiny text-muted mt-4 text-center">
                            By clicking confirm, you agree to our processing of your personal data for booking purposes. We never share your data with third parties.
                        </p>
                    </form>
                </div>

                <div className="booking-summary-section">
                    <div className="summary-card">
                        <h3>Order Summary</h3>
                        <div className="summary-event">
                            <img src={event.image} alt={event.title} />
                            <div>
                                <h4>{event.title}</h4>
                                <p>{event.date}</p>
                                <p>{event.location}</p>
                            </div>
                        </div>

                        <div className="summary-details">
                            {selectedSeats.length === 0 ? (
                                <p className="empty-selection">No seats selected</p>
                            ) : (
                                selectedSeats.map(seat => (
                                    <div key={seat.id} className="summary-row">
                                        <span>Row {seat.row}, Seat {seat.seat} <span className="seat-type-tag">{seat.type}</span></span>
                                        <span>{seat.price} KGS</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="summary-row total">
                            <span>Total</span>
                            <span>{totalPrice} KGS</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BookingPage;
