import React from 'react';
import '../styles/Input.css';

const Input = ({ label, type = 'text', placeholder, value, onChange, required }) => {
    return (
        <div className="input-group">
            {label && <label className="input-label">{label}</label>}
            <input
                className="input-field"
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                required={required}
            />
        </div>
    );
};

export default Input;
