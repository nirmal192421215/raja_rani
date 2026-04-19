import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import AnimatedBackground from '../components/AnimatedBackground';
import { getInitials } from '../engine/GameEngine';
import { API_USER_PROFILE } from '../services/api';
import './ProfileScreen.css';
import { motion } from 'framer-motion';

export default function ProfileScreen() {
  const { user, logout } = useGame();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
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
        if (data.success) {
          setStats(data.user);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching stats", err);
        setLoading(false);
      });
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="profile-screen">
      <AnimatedBackground />
      
      <div className="profile-container">
        <header className="profile-header">
          <button className="profile-back-btn" onClick={() => navigate('/home')}>
            ← Back
          </button>
          <h1 className="title title--sm text-gold">Player Profile</h1>
          <div style={{ width: 44 }}></div> 
        </header>

        <motion.div 
          className="profile-card glass-card glass-card--elevated"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="profile-avatar-section">
            <div className="profile-avatar">
              {user.picture ? (
                <img src={user.picture} alt={user.name} />
              ) : (
                getInitials(user.name)
              )}
            </div>
            <h2 className="profile-name">{user.name}</h2>
            <p className="profile-email">{user.email || 'Guest Player'}</p>
          </div>

          <div className="profile-stats-grid">
            <div className="profile-stat-box">
              <span className="profile-stat-icon">💰</span>
              <span className="profile-stat-label">Total Earnings</span>
              <span className="profile-stat-value">₹{stats?.totalEarnings?.toLocaleString() || 0}</span>
            </div>
            <div className="profile-stat-box">
              <span className="profile-stat-icon">🎮</span>
              <span className="profile-stat-label">Games Played</span>
              <span className="profile-stat-value">{stats?.gamesPlayed || 0}</span>
            </div>
            <div className="profile-stat-box">
              <span className="profile-stat-icon">🏆</span>
              <span className="profile-stat-label">Total Wins</span>
              <span className="profile-stat-value">{stats?.wins || 0}</span>
            </div>
            <div className="profile-stat-box">
              <span className="profile-stat-icon">📈</span>
              <span className="profile-stat-label">Win Rate</span>
              <span className="profile-stat-value">
                {stats?.gamesPlayed > 0 
                  ? `${Math.round((stats.wins / stats.gamesPlayed) * 100)}%` 
                  : '0%'}
              </span>
            </div>
          </div>

          <div className="profile-footer">
            <p className="profile-joined">Joined on {new Date(stats?.createdAt || user.createdAt || Date.now()).toLocaleDateString()}</p>
            <button className="btn btn--secondary profile-logout-btn" onClick={() => {
              logout();
              navigate('/login');
            }}>
              Sign Out
            </button>
          </div>
        </motion.div>

        <div className="profile-achievements">
           <h3 className="profile-section-title">Achievements</h3>
           <div className="achievements-list">
              <div className={`achievement-item ${stats?.totalEarnings >= 10000 ? 'achievement-item--earned' : ''}`}>
                 <span className="achievement-icon">🛡️</span>
                 <div className="achievement-info">
                    <div className="achievement-name">Wealthy Merchant</div>
                    <div className="achievement-desc">Earn a total of ₹10,000</div>
                 </div>
              </div>
              <div className={`achievement-item ${stats?.wins >= 10 ? 'achievement-item--earned' : ''}`}>
                 <span className="achievement-icon">⚔️</span>
                 <div className="achievement-info">
                    <div className="achievement-name">Royal Champion</div>
                    <div className="achievement-desc">Win 10 games as Raja or Rani</div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
