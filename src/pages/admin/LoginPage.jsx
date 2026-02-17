import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataProvider';
import Button from '../../components/Button';
import Input from '../../components/Input';
import '../../styles/Admin.css';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, isAuthenticated } = useData();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/admin/dashboard');
        }
    }, [isAuthenticated, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const success = await login(email, password);
            if (!success) {
                setError('Invalid credentials.');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="admin-login-container">
            <div className="admin-login-card">
                <h2>Admin Portal</h2>
                <p>Please enter your email and password.</p>
                <form onSubmit={handleLogin}>
                    <Input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <div style={{ height: '10px' }}></div>
                    <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    {error && <p className="error-text">{error}</p>}
                    <Button type="submit" fullWidth>Login</Button>
                </form>
                {/* 
                <div className="login-hint">
                    (Hint: admin123)
                </div> 
                */}
            </div>
        </div>
    );
};

export default LoginPage;
