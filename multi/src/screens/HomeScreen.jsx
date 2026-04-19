import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import AnimatedBackground from '../components/AnimatedBackground';
import { getInitials } from '../engine/GameEngine';
import { API_USER_PROFILE } from '../services/api';
import './HomeScreen.css';

export default function HomeScreen() {
  const { user, logout, joinRoom } = useGame();
  const [roomCode, setRoomCode] = useState('');
  const [stats, setStats] = useState(null);
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

  const handleCreateRoom = () => navigate('/create-room');

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (roomCode.trim().length < 4) return;
    const success = await joinRoom(roomCode.trim().toUpperCase());
    if (success) navigate('/lobby');
    else alert("Room not found or game in progress!");
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="home-screen">
      <AnimatedBackground />



      <div className="home-content">
        {/* Profile card */}
        <div className="home-profile glass-card glass-card--elevated">
          <div className="home-avatar-ring">
            <div className="home-avatar">{getInitials(user.name)}</div>
          </div>
          <p className="home-welcome">Welcome back</p>
          <h1 className="home-name">{user.name}</h1>
          <button className="home-profile-link" onClick={() => navigate('/profile')}>
             View Full Profile →
          </button>
          {stats && (
            <div className="home-stats">
              <div className="home-stat">
                <span className="home-stat-icon">💰</span>
                <div>
                  <div className="home-stat-value">₹{stats.totalEarnings?.toLocaleString() || 0}</div>
                  <div className="home-stat-label">Earnings</div>
                </div>
              </div>
              <div className="home-stat-divider" />
              <div className="home-stat">
                <span className="home-stat-icon">🎮</span>
                <div>
                  <div className="home-stat-value">{stats.gamesPlayed || 0}</div>
                  <div className="home-stat-label">Games</div>
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
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="home-actions">
          <button
            className="btn btn--gold btn--lg btn--pulse"
            onClick={handleCreateRoom}
            id="create-room-btn"
          >
            👑 Create Room
          </button>

          <div className="home-or-divider">
            <span>or join a room</span>
          </div>

          <form className="home-join-form" onSubmit={handleJoinRoom}>
            <input
              className="input-field input-field--code"
              type="text"
              placeholder="ROOM CODE"
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
              🚪 Join Room
            </button>
          </form>
        </div>

        <button className="home-logout" onClick={handleLogout} id="logout-btn">
          Sign Out
        </button>
      </div>
    </div>
  );
}
