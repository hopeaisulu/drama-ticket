import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../../context/DataProvider';
import { supabase } from '../../utils/supabaseClient';
import { useBlocker } from 'react-router-dom';
import SeatMap from '../../components/SeatMap';
import Button from '../../components/Button';
import Swal from 'sweetalert2';
import { deleteBookingWithSeats, findBookingBySeat } from '../../utils/bookingHelpers';
import { notifyError, notifyInfo, notifySuccess } from '../../utils/notify';
import '../../styles/Admin.css';

const EditSeatsPage = () => {
    const DEFAULT_STANDARD_TIER = { name: 'standard', price: 500, color: '#630d0d' };

    const { seats: contextSeats, events, fetchData } = useData();
    const [selectedEventId, setSelectedEventId] = useState(events[0]?.id);
    const [localSeats, setLocalSeats] = useState([]);
    const [localTiers, setLocalTiers] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Update selected event if it's not set and events load
    useEffect(() => {
        if (!selectedEventId && events.length > 0) {
            setSelectedEventId(events[0].id);
        }
    }, [events]);

    const currentEvent = events.find(e => e.id === selectedEventId);

    const [selectedSeat, setSelectedSeat] = useState(null);
    const [error, setError] = useState('');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const colorPickerRef = useRef(null);

    // React Router navigation blocker (for internal links)
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            hasChanges && currentLocation?.pathname !== nextLocation?.pathname
    );

    // Handle blocker state
    useEffect(() => {
        // Only show prompt if blocked AND we still have changes
        if (blocker.state === "blocked" && hasChanges) {
            Swal.fire({
                title: 'Unsaved Changes!',
                text: 'You have drafted changes. Do you want to save them before leaving?',
                icon: 'warning',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonColor: '#ff4757',
                denyButtonColor: '#94a3b8',
                confirmButtonText: 'Save & Leave',
                denyButtonText: "Discard & Leave",
                cancelButtonText: 'Stay Here'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await saveChanges(true); // Save silently
                    blocker.proceed();
                } else if (result.isDenied) {
                    setHasChanges(false); // Clear flag before proceeding to avoid re-triggering
                    blocker.proceed();
                } else {
                    blocker.reset();
                }
            });
        }
    }, [blocker.state, hasChanges]);

    // Warn before leaving with unsaved changes (for browser close/refresh)
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasChanges]);

    // Close color picker on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
                setShowColorPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initial sync and fresh fetch
    React.useEffect(() => {
        fetchData();
    }, []);

    React.useEffect(() => {
        if (contextSeats.length > 0 && !hasChanges) {
            const eventSeats = contextSeats.filter(s => s.event_id === selectedEventId);
            setLocalSeats(JSON.parse(JSON.stringify(eventSeats)));
        }
    }, [contextSeats, selectedEventId]);

    React.useEffect(() => {
        if (currentEvent?.tiers && !hasChanges) {
            const incomingTiers = JSON.parse(JSON.stringify(currentEvent.tiers));
            setLocalTiers(incomingTiers.length > 0 ? incomingTiers : [DEFAULT_STANDARD_TIER]);
        }
    }, [currentEvent, selectedEventId]);

    // Tier Management State
    const [newTier, setNewTier] = useState({ name: '', price: '', color: '#630d0d' });


    const handleSeatClick = async (seat) => {
        // Find seat in local state to ensure we edit the draft version
        const draftingSeat = localSeats.find(s => s.id === seat.id);

        // If seat is booked, offer to unbook it
        if (draftingSeat.isBooked) {
            const result = await Swal.fire({
                title: 'Unbook this seat?',
                html: `
                    <p><strong>Row ${draftingSeat.row}, Seat ${draftingSeat.seat}</strong></p>
                    <p>This will release the seat and delete the booking record.</p>
                `,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#ff4757',
                confirmButtonText: 'Yes, Unbook',
                cancelButtonText: 'Cancel'
            });

            if (result.isConfirmed) {
                try {
                    // Delete the owning booking, which releases all related seats.
                    const booking = await findBookingBySeat(draftingSeat.id);
                    if (booking?.id) {
                        await deleteBookingWithSeats(booking.id);
                    } else {
                        // Fallback for legacy/inconsistent rows with no booking_seats link.
                        const { error: seatError } = await supabase
                            .from('seats')
                            .update({ is_booked: false })
                            .eq('id', draftingSeat.id);
                        if (seatError) throw seatError;
                    }

                    // Refresh data
                    await fetchData();
                    notifySuccess('Seat released successfully.');
                } catch (error) {
                    notifyError(error.message || 'Failed to release seat.');
                }
            }
        } else {
            // Seat is available - select it for editing
            setSelectedSeat(draftingSeat);
            setError('');
        }
    };

    const handleTypeChange = (tier) => {
        if (!selectedSeat) return;

        setLocalSeats(prev => prev.map(s =>
            s.id === selectedSeat.id ? { ...s, type: tier.name, price: parseInt(tier.price) } : s
        ));

        setSelectedSeat(prev => ({
            ...prev,
            type: tier.name,
            price: parseInt(tier.price)
        }));
        setHasChanges(true);
    };

    const handleAddTier = (e) => {
        e.preventDefault();
        const tierName = newTier.name.trim().toLowerCase();
        const tierPrice = parseInt(newTier.price, 10);

        if (!tierName || Number.isNaN(tierPrice) || tierPrice <= 0) return;
        if (localTiers.some(t => t.name.toLowerCase() === tierName)) {
            setError(`Category "${tierName}" already exists.`);
            return;
        }

        const tierToAdd = {
            name: tierName,
            price: tierPrice,
            color: newTier.color
        };

        setLocalTiers(prev => [...prev, tierToAdd]);
        setNewTier({ name: '', price: '', color: '#630d0d' });
        setError('');
        setHasChanges(true);
    };

    const deleteTierLocal = (tierName) => {
        if (localTiers.length <= 1) {
            setError('At least one seat category is required.');
            return;
        }

        const remainingTiers = localTiers.filter(t => t.name !== tierName);
        const fallbackTier = remainingTiers.find(t => t.name === 'standard') || remainingTiers[0] || DEFAULT_STANDARD_TIER;

        setLocalTiers(remainingTiers);
        setLocalSeats(prev => prev.map(s =>
            s.type === tierName ? { ...s, type: fallbackTier.name, price: fallbackTier.price } : s
        ));
        setSelectedSeat(prev => {
            if (!prev || prev.type !== tierName) return prev;
            return { ...prev, type: fallbackTier.name, price: fallbackTier.price };
        });
        setError('');
        setHasChanges(true);
    };

    const handlePriceChange = (e) => {
        if (!selectedSeat) return;
        const price = parseInt(e.target.value) || 0;
        setLocalSeats(prev => prev.map(s => s.id === selectedSeat.id ? { ...s, price } : s));
        setSelectedSeat(prev => ({ ...prev, price }));
        setHasChanges(true);
    };

    const handleAddRow = () => {
        const lastRow = Math.max(...localSeats.map(s => s.row), 0);
        const newRow = lastRow + 1;
        const seatsPerRow = localSeats.length > 0
            ? Math.max(...localSeats.filter(s => s.row === lastRow).map(s => s.seat))
            : 10;

        const newSeats = [];
        for (let s = 1; s <= seatsPerRow; s++) {
            newSeats.push({
                id: `temp-${Date.now()}-${s}`, // Temp ID until saved
                row: newRow,
                seat: s,
                type: 'standard',
                price: 500,
                isBooked: false,
                event_id: selectedEventId,
                isNew: true // Flag to identify for saving
            });
        }

        setLocalSeats(prev => [...prev, ...newSeats]);
        setHasChanges(true);
    };

    const handleAddColumn = () => {
        const rowNumbers = [...new Set(localSeats.map(s => s.row))].sort((a, b) => a - b);
        if (rowNumbers.length === 0) {
            setError('Add at least one row before adding a column.');
            return;
        }

        const newSeats = rowNumbers.map((rowNum) => {
            const rowSeats = localSeats.filter(s => s.row === rowNum);
            const maxSeatNum = rowSeats.length > 0 ? Math.max(...rowSeats.map(s => s.seat)) : 0;
            const nextSeatNum = maxSeatNum + 1;

            return {
                id: `temp-${Date.now()}-${rowNum}-${nextSeatNum}`,
                row: rowNum,
                seat: nextSeatNum,
                type: 'standard',
                price: 500,
                isBooked: false,
                event_id: selectedEventId,
                isNew: true
            };
        });

        setLocalSeats(prev => [...prev, ...newSeats]);
        setHasChanges(true);
        setError('');
    };

    const removeRowLocal = (rowNum) => {
        const rowSeats = localSeats.filter(s => s.row === rowNum);
        if (rowSeats.some(s => s.isBooked)) {
            setError(`Cannot delete Row ${rowNum} with booked seats.`);
            return;
        }
        setLocalSeats(prev => prev.filter(s => s.row !== rowNum));
        setHasChanges(true);
    };

    const handleApplyToRow = () => {
        if (!selectedSeat) return;
        setLocalSeats(prev => prev.map(s =>
            s.row === selectedSeat.row ? { ...s, type: selectedSeat.type, price: selectedSeat.price } : s
        ));
        setHasChanges(true);
    };

    const saveChanges = async (silent = false) => {
        setIsSaving(true);
        setError('');
        try {
            const eventId = selectedEventId;
            if (localTiers.length === 0) {
                throw new Error('At least one seat category is required before saving.');
            }

            // 1. Save Event Tiers
            const { error: tierError } = await supabase
                .from('events')
                .update({ seat_tiers: localTiers })
                .eq('id', eventId);
            if (tierError) throw tierError;

            // 2. Identify deletions (only for the current event)
            const eventContextSeats = contextSeats.filter(s => s.event_id === eventId);
            const contextIds = eventContextSeats.map(s => s.id);
            const localIds = localSeats.map(s => s.id);
            const deletedIds = contextIds.filter(id => !localIds.includes(id));

            if (deletedIds.length > 0) {
                const { error: delError } = await supabase
                    .from('seats')
                    .delete()
                    .in('id', deletedIds);
                if (delError) throw delError;
            }

            // 3. Identify insertions and updates
            const newSeats = localSeats.filter(s => s.isNew).map(s => ({
                id: `${eventId}-${s.row}-${s.seat}`, // Generate the final composite ID
                row_num: s.row,
                seat_num: s.seat,
                type: s.type,
                price: s.price,
                is_booked: s.isBooked,
                event_id: eventId
            }));

            if (newSeats.length > 0) {
                const { error: insError } = await supabase
                    .from('seats')
                    .insert(newSeats);
                if (insError) throw insError;
            }

            // 4. Update existing seats
            const existingSeats = localSeats.filter(s => !s.isNew);
            // Optimization: Filter only those that actually changed
            const updatedSeats = existingSeats.filter(ls => {
                const cs = contextSeats.find(c => c.id === ls.id);
                return cs && (cs.type !== ls.type || cs.price !== ls.price || cs.isBooked !== ls.isBooked);
            });

            // Update them one by one or in batch if possible (Supabase doesn't support batch update with different values easily)
            for (const seat of updatedSeats) {
                await supabase.from('seats').update({
                    type: seat.type,
                    price: seat.price,
                    is_booked: seat.isBooked
                }).eq('id', seat.id);
            }

            await fetchData();
            setHasChanges(false);

            if (!silent) {
                notifySuccess('Seat layout saved successfully.');
            }
        } catch (err) {
            console.error(err);
            if (!silent) {
                notifyError(err.message || 'Failed to save seat layout.');
            } else {
                setError(err.message);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const discardChanges = () => {
        Swal.fire({
            title: 'Discard changes?',
            text: "You will lose all your unsaved edits!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff4757',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Yes, discard',
            cancelButtonText: 'No, keep them'
        }).then((result) => {
            if (result.isConfirmed) {
                setLocalSeats(JSON.parse(JSON.stringify(contextSeats)));
                setLocalTiers(JSON.parse(JSON.stringify(events[0]?.tiers || [])));
                setHasChanges(false);
                setSelectedSeat(null);
                setError('');
                notifyInfo('Unsaved changes discarded.');
            }
        });
    };

    const PRESET_COLORS = [
        '#630d0d', '#2d3436', '#2c3e50', '#1e272e',
        '#4834d4', '#1b1464', '#009432', '#006266',
        '#d35400', '#7f8c8d'
    ];

    return (
        <div className="admin-page edit-seats-page">

            <h1 className="page-title">Manage Seating & Prices</h1>

            <div className="seats-admin-container">
                <div className="seats-editor">
                    <div className="admin-card">
                        <h3>Seat Map</h3>
                        <SeatMap
                            seats={localSeats}
                            tiers={localTiers}
                            onSeatClick={handleSeatClick}
                            readOnly={false}
                            onAddRow={handleAddRow}
                            onAddColumn={handleAddColumn}
                            onRemoveRow={(rowNum) => {
                                removeRowLocal(rowNum);
                            }}
                        />
                        <div className="mt-4">
                            <p className="hint-text">
                                • Click a seat to edit its type and price.<br />
                                • Use the '+' at the bottom to add a new row.<br />
                                • Use labels for deleting specific rows.
                            </p>
                        </div>

                        <div className="seat-map-actions mt-4">
                            <Button
                                variant="secondary"
                                onClick={discardChanges}
                                disabled={!hasChanges || isSaving}
                            >
                                Cancel Changes
                            </Button>
                            <Button
                                onClick={() => saveChanges(false)}
                                disabled={!hasChanges || isSaving}
                            >
                                {isSaving ? 'Saving...' : 'Save Layout'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="seats-sidebar">
                    {/* Showing Selector */}
                    <div className="admin-card mb-4 p-compact">
                        <h4 className="card-subtitle mb-3">Selected Showing</h4>
                        <select
                            className="showing-select-sidebar"
                            value={selectedEventId || ''}
                            onChange={(e) => {
                                const newId = parseInt(e.target.value);
                                if (hasChanges) {
                                    Swal.fire({
                                        title: 'Unsaved Changes!',
                                        text: 'You have drafted changes for this showing. Switch anyway?',
                                        icon: 'warning',
                                        showCancelButton: true,
                                        confirmButtonText: 'Yes, Switch',
                                        cancelButtonText: 'Stay Here'
                                    }).then(result => {
                                        if (result.isConfirmed) {
                                            setHasChanges(false);
                                            setSelectedEventId(newId);
                                        }
                                    });
                                } else {
                                    setSelectedEventId(newId);
                                }
                            }}
                        >
                            {events.map(ev => (
                                <option key={ev.id} value={ev.id}>{ev.date}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tier Manager */}
                    <div className="admin-card mb-4 p-compact">
                        <h4 className="card-subtitle mb-3">Seat Categories</h4>
                        <form onSubmit={handleAddTier} className="tier-form-v2">
                            <div className="tier-form-main">
                                <label className="tier-field">
                                    <span>Category</span>
                                    <input
                                        className="input-field input-small"
                                        placeholder="e.g. vip"
                                        value={newTier.name}
                                        onChange={e => setNewTier({ ...newTier, name: e.target.value })}
                                    />
                                </label>
                                <label className="tier-field tier-field-price">
                                    <span>Price</span>
                                    <input
                                        type="number"
                                        className="input-field input-small"
                                        placeholder="500"
                                        value={newTier.price}
                                        onChange={e => setNewTier({ ...newTier, price: e.target.value })}
                                    />
                                </label>
                            </div>

                            <div className="tier-form-actions">
                                <div className="color-selector-wrapper compact" ref={colorPickerRef}>
                                    <button
                                        type="button"
                                        className="tier-color-pill"
                                        onClick={() => setShowColorPicker(!showColorPicker)}
                                        title="Pick color"
                                    >
                                        <div
                                            className="current-color-preview"
                                            style={{ backgroundColor: newTier.color }}
                                        />
                                        <span>Color</span>
                                    </button>

                                    {showColorPicker && (
                                        <div className="color-palette-popover side">
                                            {PRESET_COLORS.map(color => (
                                                <div
                                                    key={color}
                                                    className={`color-swatch-item ${newTier.color === color ? 'selected' : ''}`}
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => {
                                                        setNewTier({ ...newTier, color });
                                                        setShowColorPicker(false);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button type="submit" className="tier-add-btn">Add Category</button>
                            </div>
                        </form>

                        {localTiers.length > 0 && (
                            <div className="tier-list-compact mt-4">
                                {localTiers.map(tier => (
                                    <div key={tier.name} className="tier-item-row">
                                        <div className="tier-dot" style={{ backgroundColor: tier.color }}></div>
                                        <span className="tier-name">{tier.name}</span>
                                        <span className="tier-price">{tier.price} KGS</span>
                                        <button
                                            className="tier-remove-tiny"
                                            type="button"
                                            disabled={localTiers.length <= 1}
                                            title={localTiers.length <= 1 ? 'At least one category is required' : 'Delete category'}
                                            onClick={() => {
                                                deleteTierLocal(tier.name);
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="admin-card">
                        <h3>Editor Tools</h3>

                        {selectedSeat ? (
                            <div className="seat-details-editor">
                                <h4>Selected: R{selectedSeat.row}, S{selectedSeat.seat}</h4>

                                <div className="form-group">
                                    <label className="input-label">Assign Type</label>
                                    <div className="type-buttons-grid">
                                        {localTiers.map(tier => (
                                            <button
                                                key={tier.name}
                                                className={`type-btn ${selectedSeat.type === tier.name ? 'active' : ''}`}
                                                style={{ borderLeft: `4px solid ${tier.color}` }}
                                                onClick={() => handleTypeChange(tier)}
                                            >
                                                {tier.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="input-label">Override Price (KGS)</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={selectedSeat.price}
                                        onChange={handlePriceChange}
                                    />
                                </div>

                                <div className="form-group mt-2">
                                    <Button
                                        variant="secondary"
                                        fullWidth
                                        onClick={handleApplyToRow}
                                    >
                                        Apply to All in Row {selectedSeat.row}
                                    </Button>
                                </div>

                                <p className="hint-text">Drafting changes...</p>
                            </div>
                        ) : (
                            <p className="placeholder-text">Select a seat to edit properties.</p>
                        )}
                    </div>

                    {error && (
                        <div className="admin-card">
                            <p className="error-text">{error}</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default EditSeatsPage;
