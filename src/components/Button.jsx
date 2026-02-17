import React from 'react';
import '../styles/Button.css';

const Button = ({ children, variant = 'primary', onClick, type = 'button', fullWidth, disabled }) => {
    return (
        <button
            className={`btn btn-${variant} ${fullWidth ? 'btn-full' : ''}`}
            onClick={onClick}
            type={type}
            disabled={disabled}
        >
            {children}
        </button>
    );
};

export default Button;
