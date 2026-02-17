import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Header.css';

const Header = () => {
    return (
        <header className="header">
            <div className="container header-content">
                <Link to="/" className="logo">
                    Ticket<span className="logo-accent">Hub</span>
                </Link>
                <nav className="nav">
                    <Link to="/" className="nav-link">Events</Link>
                    <Link to="/about" className="nav-link">About</Link>
                </nav>
            </div>
        </header>
    );
};

export default Header;
