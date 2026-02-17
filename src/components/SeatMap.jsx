import React from 'react';
import { useData } from '../context/DataProvider';
import '../styles/SeatMap.css';

const SeatMap = ({
    selectedSeats = [],
    onSeatClick,
    readOnly = false,
    onAddRow,
    onAddColumn,
    onRemoveRow,
    seats: propSeats,
    tiers: propTiers
}) => {
    const { seats: contextSeats, events } = useData();
    const seats = propSeats || contextSeats;
    const tiers = propTiers || events[0]?.tiers || [];

    // Pre-calculate map for performance O(1) lookups
    const tiersMap = React.useMemo(() => {
        const map = {};
        // Add default fallbacks first
        map['vip'] = { color: '#8e6d1c', price: 1000 };
        map['standard'] = { color: '#2c3e50', price: 500 };
        map['budget'] = { color: '#006266', price: 300 };

        // Overwrite with custom tiers from DB
        tiers.forEach(t => {
            map[t.name.toLowerCase()] = {
                color: t.color,
                price: t.price
            };
        });
        return map;
    }, [tiers]);

    const getSeatStatus = (seat) => {
        if (seat.isBooked) return 'booked';
        if (selectedSeats.find(s => s.id === seat.id)) return 'selected';
        return 'available';
    };


    const getSeatColor = (type) => {
        return tiersMap[type.toLowerCase()]?.color || tiersMap['standard'].color;
    };

    const getSeatPrice = (type) => {
        return tiersMap[type.toLowerCase()]?.price || 0;
    };


    const maxSeatsInRow = React.useMemo(() => {
        if (seats.length === 0) return 10;
        return Math.max(...seats.map(s => s.seat));
    }, [seats]);

    const seatsByRow = React.useMemo(() => {
        const rows = {};
        seats.forEach(seat => {
            if (!rows[seat.row]) rows[seat.row] = [];
            rows[seat.row].push(seat);
        });
        // Sort seats in each row by seat number
        Object.values(rows).forEach(row => row.sort((a, b) => a.seat - b.seat));
        return Object.entries(rows).sort(([a], [b]) => a - b);
    }, [seats]);

    return (
        <div className="seat-map-container">
            <div className="stage-screen">Stage</div>
            <div className="seats-grid-shell">
                <div
                    className="seats-grid labels-enabled"
                    style={{
                        gridTemplateColumns: `auto repeat(${maxSeatsInRow}, 1fr) auto`,
                        alignItems: 'center'
                    }}
                >
                    {seatsByRow.map(([rowNum, rowSeats]) => (
                        <React.Fragment key={rowNum}>
                            <div className="row-label left">
                                Row {rowNum}
                                {!readOnly && onRemoveRow && (
                                    <button
                                        className="row-delete-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveRow(parseInt(rowNum));
                                        }}
                                        title={`Delete Row ${rowNum}`}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            {/* Render seats for this row */}
                            {Array.from({ length: maxSeatsInRow }).map((_, idx) => {
                                const seat = rowSeats.find(s => s.seat === idx + 1);
                                if (!seat) return <div key={`empty-${rowNum}-${idx}`} className="seat-spacer" />;

                                const status = getSeatStatus(seat);
                                const backgroundColor = status === 'booked' ? '#d1d5db' :
                                    status === 'selected' ? '#e74c3c' :
                                        getSeatColor(seat.type);

                                const price = seat.price || getSeatPrice(seat.type);

                                return (
                                    <button
                                        key={seat.id}
                                        type="button"
                                        className={`seat ${status}`}
                                        style={{ backgroundColor }}
                                        onClick={() => !readOnly && !seat.isBooked && onSeatClick(seat)}
                                        disabled={readOnly || seat.isBooked}
                                        title={`Row ${seat.row}, Seat ${seat.seat} - ${price} KGS (${seat.type})`}
                                    >
                                        <span className="seat-tooltip">
                                            Row {seat.row}, Seat {seat.seat}<br />
                                            {price} KGS
                                        </span>
                                    </button>
                                );
                            })}

                            <div className="row-label right">Row {rowNum}</div>
                        </React.Fragment>
                    ))}

                    {/* Inline Add Row Button */}
                    {!readOnly && onAddRow && (
                        <React.Fragment>
                            <div /> {/* Spacer for label col */}
                            <div
                                style={{ gridColumn: `span ${maxSeatsInRow}` }}
                                className="add-row-inline-container"
                            >
                                <button className="add-row-inline-btn" onClick={onAddRow}>
                                    + Add Row {seatsByRow.length + 1}
                                </button>
                            </div>
                            <div /> {/* Spacer for right label col */}
                        </React.Fragment>
                    )}
                </div>

                {!readOnly && onAddColumn && (
                    <button className="add-column-side-btn" onClick={onAddColumn} title="Add new column">
                        + Column
                    </button>
                )}
            </div>

            <div className="seat-legend">
                {tiers.map(tier => (
                    <div className="legend-item" key={tier.name}>
                        <div className="seat-sample" style={{ backgroundColor: tier.color }}></div>
                        <span style={{ textTransform: 'capitalize' }}>{tier.name} ({tier.price} KGS)</span>
                    </div>
                ))}
                <div className="legend-item">
                    <div className="seat-sample booked"></div>
                    <span>Booked</span>
                </div>
                <div className="legend-item">
                    <div className="seat-sample selected"></div>
                    <span>Selected</span>
                </div>
            </div>
        </div>
    );
};

export default SeatMap;
