import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataProvider';
import Button from '../components/Button';
import '../styles/HomePage.css';

const HomePage = () => {
    const { events, loading, fetchData } = useData();

    React.useEffect(() => {
        // Handled by DataProvider
    }, []);

    if (loading) return <div className="loading-spinner">Loading...</div>;
    if (events.length === 0) return <div className="loading-spinner">No events found.</div>;

    // Grouping events by title (in case there are different plays)
    const plays = events.reduce((acc, event) => {
        if (!acc[event.title]) {
            acc[event.title] = {
                ...event,
                showings: []
            };
        }
        acc[event.title].showings.push(event);
        return acc;
    }, {});

    const mainPlay = Object.values(plays)[0];

    return (
        <div className="home-page">
            <section className="hero" style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.8)), url(${mainPlay.image})`
            }}>
                <div className="container hero-content">
                    <span className="hero-tag">Premiere</span>
                    <h1 className="hero-title">{mainPlay.title}</h1>
                    <p className="hero-subtitle">{mainPlay.description.split('.')[0]}.</p>

                    <div className="showings-selection mt-8">
                        <h3 className="text-white mb-4">Choose a showing:</h3>
                        <div className="showings-grid">
                            {mainPlay.showings.map(showing => (
                                <Link key={showing.id} to={`/booking/${showing.id}`} className="showing-link-card">
                                    <div className="showing-date">{showing.date.split('•')[0]}</div>
                                    <div className="showing-time">{showing.date.split('•')[1] || '19:00'}</div>
                                    <Button variant="primary" fullWidth>Book Now</Button>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section className="container section-about">
                <div className="about-grid">
                    <div className="about-text" style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <h2 className="section-title">About the Play</h2>
                        <p>{mainPlay.description}</p>
                        <div className="about-details">
                            <div className="detail-item">
                                <strong>Duration</strong>
                                <p>{mainPlay.duration}</p>
                            </div>
                            <div className="detail-item">
                                <strong>Director</strong>
                                <p>{mainPlay.director}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default HomePage;
