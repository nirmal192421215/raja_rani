import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useGame } from '../context/GameContext';
import AnimatedBackground from '../components/AnimatedBackground';
import './LoginScreen.css';

export default function LoginScreen() {
  const [name, setName] = useState('');
  const { login, loginWithGoogle } = useGame();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    const success = await login(trimmed);
    if (success) navigate('/home');
  };

  const handleGoogleSuccess = async (response) => {
    const success = await loginWithGoogle(response.credential);
    if (success) navigate('/home');
  };

  return (
    <div className="login-screen">
      <AnimatedBackground />

      <div className="login-card glass-card glass-card--elevated">
        <div className="login-crown">👑</div>
        <h1 className="login-title">
          <span className="text-gold">Raja Rani</span>
        </h1>
        <p className="login-subtitle">Enter the kingdom and battle for wealth</p>

        <div className="login-google-container">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => console.log('Login Failed')}
            theme="filled_blue"
            shape="pill"
          />
        </div>

        <div className="login-divider">
          <span>or enter as guest</span>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-input-group">
            <span className="login-input-icon">🎭</span>
            <input
              className="input-field"
              type="text"
              placeholder="Your name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={15}
              id="login-name-input"
              style={{ paddingLeft: '44px' }}
            />
          </div>
          <button
            className="btn btn--gold btn--lg"
            type="submit"
            disabled={name.trim().length < 2}
            id="login-submit-btn"
          >
            ⚔️ Enter the Arena
          </button>
        </form>

        <p className="login-footer">🔒 Secure login provided</p>
      </div>
    </div>
  );
}
