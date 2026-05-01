import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useToast } from '../components/Toast';
import AnimatedBackground from '../components/AnimatedBackground';
import { getInitials } from '../engine/GameEngine';
import { API_USER_PROFILE } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { playClick } from '../engine/SoundEngine';
import './HomeScreen.css';


export default function HomeScreen() {
  const { user, logout, joinRoom, quickMatch } = useGame();
  const { t, lang, changeLanguage } = useLanguage();
  const toast = useToast();
  const [roomCode, setRoomCode] = useState('');
  const [stats, setStats] = useState(null);
  const [loadingQuick, setLoadingQuick] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    const myId = user.id || user.googleId || user._id;
    fetch(API_USER_PROFILE(myId))
      .then(res => res.json())
      .then(data => {
        if (data.success) setStats(data.user);
      })
      .catch(err => console.error("Error fetching stats", err));
  }, [user, navigate]);

  if (!user) return null;

  const handleCreateRoom = () => {
    playClick();
    navigate('/create-room');
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    playClick();
    if (roomCode.trim().length < 4) return;
    const success = await joinRoom(roomCode.trim().toUpperCase());
    if (success) navigate('/lobby');
    else toast.error("Room not found or game already in progress!");
  };

  const handleQuickMatch = async () => {
    playClick();
    setLoadingQuick(true);
    toast.info("Finding a match...", 2000);
    const success = await quickMatch();
    setLoadingQuick(false);
    if (success) navigate('/lobby');
    else toast.error("Quick Match failed. Try again or create a room!");
  };

  const handleLogout = () => {
    playClick();
    logout();
    navigate('/login');
  };

  return (
    <div className="home-screen">
      <AnimatedBackground />

      <div className="home-top-left">
        <select 
          className="language-select glass-card"
          value={lang} 
          onChange={(e) => changeLanguage(e.target.value)}
        >
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
          <option value="ta">தமிழ்</option>
        </select>
      </div>

      {stats && (
        <div className="home-top-right" onClick={() => navigate('/store')}>
          <div className="home-coin-pill">
            <span className="coin-icon">💰</span>
            <span className="coin-amount">{(stats.rajaCoins || 0).toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="home-content">
        {/* Profile card */}
        <div className="home-profile glass-card glass-card--elevated">
          <div className="home-avatar-ring">
            <div className="home-avatar">{getInitials(user.name)}</div>
          </div>
          <p className="home-welcome">{t('home.welcome')}</p>
          <h1 className="home-name">{user.name}</h1>
          <button className="home-profile-link" onClick={() => navigate('/profile')}>
             View Full Profile →
          </button>
          {stats && (
            <div className="home-stats">
              <div className="home-stat">
                <span className="home-stat-icon">📈</span>
                <div>
                  <div className="home-stat-value">{stats.elo || 1200}</div>
                  <div className="home-stat-label">Elo Rank</div>
                </div>
              </div>
              <div className="home-stat-divider" />
              <div className="home-stat">
                <span className="home-stat-icon">🏆</span>
                <div>
                  <div className="home-stat-value">{stats.wins || 0}</div>
                  <div className="home-stat-label">Wins</div>
                </div>
              </div>
              <div className="home-stat-divider" />
              <div className="home-stat">
                <span className="home-stat-icon">💰</span>
                <div>
                  <div className="home-stat-value">₹{stats.totalEarnings?.toLocaleString() || 0}</div>
                  <div className="home-stat-label">Earnings</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="home-actions">
          <button
            className="btn btn--primary btn--lg btn--pulse"
            onClick={handleQuickMatch}
            disabled={loadingQuick}
            style={{ marginBottom: '10px' }}
          >
            {loadingQuick ? t('home.findingMatch') : `⚡ ${t('home.quickPlay')}`}
          </button>

          <button
            className="btn btn--gold btn--lg"
            onClick={handleCreateRoom}
            id="create-room-btn"
          >
            👑 {t('home.createRoom')}
          </button>

          <div className="home-or-divider">
            <span>{t('home.orJoin')}</span>
          </div>

          <form className="home-join-form" onSubmit={handleJoinRoom}>
            <input
              className="input-field input-field--code"
              type="text"
              placeholder={t('home.roomCodePlaceholder')}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              id="room-code-input"
            />
            <button
              className="btn btn--secondary"
              type="submit"
              disabled={roomCode.trim().length < 4}
              id="join-room-btn"
            >
              🚶 {t('home.join')}
            </button>
          </form>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              className="btn btn--outline"
              onClick={() => { playClick(); navigate('/global-leaderboard'); }}
              id="global-lb-btn"
              style={{ flex: 1 }}
            >
              🌍 {t('home.leaderboard')}
            </button>
            <button
              className="btn btn--outline"
              onClick={() => { playClick(); navigate('/store'); }}
              id="store-btn"
              style={{ flex: 1 }}
            >
              💎 {t('home.store')}
            </button>
          </div>
        </div>

        <button className="home-logout" onClick={handleLogout} id="logout-btn">
          {t('home.logout')}
        </button>
      </div>
    </div>
  );
}
