import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataProvider';
import Swal from 'sweetalert2';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { notifyError, notifySuccess } from '../../utils/notify';
import '../../styles/Admin.css';

const DashboardPage = () => {
    const navigate = useNavigate();
    const { events, seats, loading, fetchData, addShowing, deleteShowing, updateShowingDate } = useData();

    React.useEffect(() => {
        // DataProvider handles initial fetch, only call if needed manual refresh
    }, []);

    const handleEditDate = async (showing) => {
        const { value: formValues } = await Swal.fire({
            title: '<h2>Edit Showing Date</h2>',
            html: `
                <div style="text-align: left; margin-bottom: 20px;">
                    <p style="color: #64748b; font-size: 0.9rem;">Change the performance time for this showing.</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="text-align: left;">
                        <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 5px;">New Date & Time</label>
                        <input id="swal-picker" class="input-field" style="width: 100%; margin: 0;" placeholder="Select date and time...">
                    </div>
                </div>
            `,
            didOpen: () => {
                flatpickr('#swal-picker', {
                    enableTime: true,
                    dateFormat: "F j, Y • H:i",
                    defaultDate: showing.date.replace(' • ', ' '),
                    minuteIncrement: 15,
                });
            },
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Update Date',
            confirmButtonColor: '#ff4757',
            cancelButtonColor: '#94a3b8',
            preConfirm: () => {
                const val = document.getElementById('swal-picker').value;
                if (!val) {
                    Swal.showValidationMessage('Please select a date and time');
                }
                return val;
            }
        });

        if (formValues) {
            const success = await updateShowingDate(showing.id, formValues);
            if (success) {
                notifySuccess('Showing date updated.');
            } else {
                notifyError('Failed to update showing date.');
            }
        }
    };

    const handleAddDate = async (baseEvent) => {
        const { value: formValues } = await Swal.fire({
            title: '<h2>Add New Showing</h2>',
            html: `
                <div style="text-align: left; margin-bottom: 20px;">
                    <p style="color: #64748b; font-size: 0.9rem;">The seating layout for <b>"${baseEvent.title}"</b> will be automatically cloned to this new date.</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="text-align: left;">
                        <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 5px;">Performance Date & Time</label>
                        <input id="swal-picker-add" class="input-field" style="width: 100%; margin: 0;" placeholder="Select date and time...">
                    </div>
                </div>
            `,
            didOpen: () => {
                flatpickr('#swal-picker-add', {
                    enableTime: true,
                    dateFormat: "F j, Y • H:i",
                    minDate: "today",
                    minuteIncrement: 15,
                    defaultDate: new Date().setHours(19, 0, 0, 0)
                });
            },
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Create Showing',
            confirmButtonColor: '#ff4757',
            cancelButtonColor: '#94a3b8',
            preConfirm: () => {
                const val = document.getElementById('swal-picker-add').value;
                if (!val) {
                    Swal.showValidationMessage('Please select a date and time');
                }
                return val;
            }
        });

        if (formValues) {
            const newDateString = formValues;
            Swal.fire({
                title: 'Creating showing...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const success = await addShowing(baseEvent.id, newDateString);

            if (success) {
                notifySuccess('New showing created.');
            } else {
                notifyError('Failed to create showing.');
            }
        }
    };

    const handleDelete = async (event) => {
        const result = await Swal.fire({
            title: 'Delete Showing?',
            text: `Are you sure you want to delete the "${event.date}" showing? This cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff4757',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteShowing(event.id);
                notifySuccess('Showing deleted.');
            } catch (err) {
                notifyError(err.message || 'Failed to delete showing.');
            }
        }
    };

    // Grouping events by title
    const plays = events.reduce((acc, event) => {
        if (!acc[event.title]) {
            acc[event.title] = {
                title: event.title,
                showings: []
            };
        }
        acc[event.title].showings.push(event);
        return acc;
    }, {});

    if (loading) return <div className="loading-spinner">Loading dashboard...</div>;

    return (
        <div className="dashboard-container dashboard-compact">
            <h1 className="page-title">Admin Dashboard</h1>

            <div className="plays-list">
                {Object.values(plays).map(play => (
                    <div key={play.title} className="admin-card mb-8">
                        <div className="flex-between mb-6 border-bottom pb-4">
                            <div>
                                <h2 className="m-0">{play.title}</h2>
                                <p className="text-muted m-0">Performance Management</p>
                            </div>
                            <div className="flex gap-2 dashboard-top-actions">
                                <button className="btn btn-secondary" onClick={() => navigate(`/admin/events/${play.showings[0].id}`)}>
                                    Manage Play Details
                                </button>
                                <button className="btn btn-primary" onClick={() => handleAddDate(play.showings[0])}>
                                    + Add New Showing Date
                                </button>
                            </div>
                        </div>

                        <div className="showings-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Date & Time</th>
                                        <th>Seats</th>
                                        <th>Booked</th>
                                        <th>Occupancy</th>
                                        <th>Revenue</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {play.showings.map(showing => {
                                        const eventSeats = seats.filter(s => s.event_id === showing.id);
                                        const totalSeats = eventSeats.length;
                                        const bookedSeats = eventSeats.filter(s => s.isBooked).length;
                                        const occupancy = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;
                                        const totalRevenue = eventSeats
                                            .filter(s => s.isBooked)
                                            .reduce((sum, s) => sum + s.price, 0);

                                        return (
                                            <tr key={showing.id}>
                                                <td>
                                                    <div className="font-bold">{showing.date}</div>
                                                </td>
                                                <td>{totalSeats}</td>
                                                <td>
                                                    <span className={`status-badge ${bookedSeats > 0 ? 'status-active' : 'status-idle'}`}>
                                                        {bookedSeats}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="occupancy-bar-mini">
                                                        <div className="bar-fill" style={{ width: `${occupancy}%` }}></div>
                                                        <span>{occupancy}%</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="font-bold">{totalRevenue} KGS</div>
                                                </td>
                                                <td className="text-right">
                                                    <button
                                                        className="btn btn-outline btn-small mr-2"
                                                        onClick={() => handleEditDate(showing)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-danger btn-small"
                                                        onClick={() => handleDelete(showing)}
                                                        disabled={play.showings.length <= 1}
                                                        title={play.showings.length <= 1 ? "Cannot delete the only showing" : ""}
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            {events.length === 0 && (
                <div className="admin-card text-center py-12">
                    <p className="text-muted">No events found. Please create one.</p>
                </div>
            )}
        </div>
    );
};

export default DashboardPage;
