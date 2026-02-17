import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataProvider';
import Button from '../components/Button';
import '../styles/EventDetailsPage.css';

const EventDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { events, fetchData, loading } = useData();

    useEffect(() => {
        fetchData();
    }, []);

    const event = events.find(e => e.id === parseInt(id));

    if (loading) return <div className="loading-spinner">Loading event details...</div>;
    if (!event) {
        return <div className="container">Event not found</div>;
    }

    const handleBookClick = () => {
        navigate(`/booking/${id}`);
    };

    return (
        <div className="event-details-page">
            {/* Hero/Header Section */}
            <div className="event-hero" style={{ backgroundImage: `url(${event.image})` }}>
                <div className="event-hero-overlay"></div>
                <div className="container event-hero-content">
                    <h1 className="event-hero-title">{event.title}</h1>
                    <div className="event-meta">
                        <span className="event-tag">{event.category}</span>
                        <span className="event-price-tag">From {event.price} KGS</span>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="container event-content-wrapper">
                <div className="event-main-info">
                    <div className="info-card">
                        <h2>About the Event</h2>
                        <p className="event-description">{event.description}</p>

                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label">Date</span>
                                <span className="info-value">{event.date}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Location</span>
                                <span className="info-value">{event.location}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar / Booking Action */}
                <div className="event-sidebar">
                    <div className="booking-card">
                        <h3>Ready to attend?</h3>
                        <p className="booking-note">Secure your spot now. No payment required online.</p>
                        <Button fullWidth onClick={handleBookClick}>Book Tickets Now</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventDetailsPage;
