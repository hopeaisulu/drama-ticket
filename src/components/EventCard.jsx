import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/EventCard.css';

const EventCard = ({ id, title, date, location, image, price }) => {
    return (
        <Link to={`/event/${id}`} className="event-card">
            <div className="event-card-image">
                <img src={image} alt={title} />
                <span className="event-price">From {price} KGS</span>
            </div>
            <div className="event-card-content">
                <div className="event-date">{date}</div>
                <h3 className="event-title">{title}</h3>
                <p className="event-location">{location}</p>
            </div>
        </Link>
    );
};

export default EventCard;
