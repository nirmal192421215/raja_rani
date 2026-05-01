import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import AnimatedBackground from '../components/AnimatedBackground';
import { getInitials } from '../engine/GameEngine';
import { getLevelProgress, getLevelTitle, ACHIEVEMENTS } from '../engine/XPEngine';
import { API_USER_PROFILE } from '../services/api';
import './ProfileScreen.css';
import { motion } from 'framer-motion';

export default function ProfileScreen() {
  const { user, logout } = useGame();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const myId = user.id || user.googleId || user._id;
    fetch(API_USER_PROFILE(myId))
      .then(res => res.json())
      .then(data => {
        if (data.success) setStats(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, navigate]);

  if (!user) return null;

  const xp = stats?.xp || 0;
  const { current, needed, pct, level } = getLevelProgress(xp);
  const { title, emoji, color } = getLevelTitle(level);
  const earnedIds = stats?.achievements || [];
  const winRate = stats?.gamesPlayed > 0
    ? Math.round((stats.wins / stats.gamesPlayed) * 100)
    : 0;

  return (
    <div className="profile-screen">
      <AnimatedBackground />

      <div className="profile-container">
        <motion.div
          className="profile-card glass-card glass-card--elevated"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Close */}
          <button className="profile-close-btn" onClick={() => navigate('/home')}>✕</button>

          {/* Avatar + Name */}
          <div className="profile-avatar-section">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {user.picture
                  ? <img src={user.picture} alt={user.name} />
                  : getInitials(user.name)
                }
              </div>
              <div className="profile-level-badge" style={{ background: color }}>
                {emoji} {level}
              </div>
            </div>
            <h2 className="profile-name">{user.name}</h2>
            <div className="profile-rank-title" style={{ color }}>
              {title}
            </div>
            <p className="profile-email">{user.email || 'Guest Player'}</p>
          </div>

          {/* XP Progress Bar */}
          <div className="profile-xp-section">
            <div className="profile-xp-label">
              <span>Level {level}</span>
              <span>{current.toLocaleString()} / {needed.toLocaleString()} XP</span>
            </div>
            <div className="profile-xp-bar">
              <motion.div
                className="profile-xp-fill"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                style={{ background: color }}
              />
            </div>
            <div className="profile-xp-next">
              {pct < 100
                ? `${needed - current} XP to Level ${level + 1}`
                : '🏆 Max Level Reached!'
              }
            </div>
          </div>

          {/* Stats Grid */}
          <div className="profile-stats-grid">
            {[
              { icon: '💰', label: 'Total Earnings', value: `₹${(stats?.totalEarnings || 0).toLocaleString()}` },
              { icon: '🎮', label: 'Games Played',   value: stats?.gamesPlayed || 0 },
              { icon: '🏆', label: 'Total Wins',     value: stats?.wins || 0 },
              { icon: '📈', label: 'Win Rate',       value: `${winRate}%` },
              { icon: '🔍', label: 'Thieves Caught', value: stats?.policeCorrect || 0 },
              { icon: '🥷', label: 'Thief Escapes',  value: stats?.thiefEscapes || 0 },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                className="profile-stat-box"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
              >
                <span className="profile-stat-icon">{s.icon}</span>
                <span className="profile-stat-label">{s.label}</span>
                <span className="profile-stat-value">{s.value}</span>
              </motion.div>
            ))}
          </div>

          {/* Footer actions */}
          <div className="profile-footer">
            <p className="profile-joined">
              Member since {new Date(stats?.createdAt || Date.now()).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}
            </p>
            <div className="profile-actions-row">
              <button className="btn btn--secondary profile-logout-btn" onClick={() => { logout(); navigate('/login'); }}>
                Sign Out
              </button>
              <button className="btn btn--gold profile-home-btn" onClick={() => navigate('/home')}>
                Go Home
              </button>
            </div>
          </div>
        </motion.div>

        {/* Achievements Panel */}
        <motion.div
          className="profile-achievements glass-card"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h3 className="profile-section-title">
            🏅 Achievements
            <span className="achievements-count">
              {earnedIds.length} / {ACHIEVEMENTS.length}
            </span>
          </h3>
          <div className="achievements-list">
            {ACHIEVEMENTS.map((a, i) => {
              const earned = earnedIds.includes(a.id);
              return (
                <motion.div
                  key={a.id}
                  className={`achievement-item ${earned ? 'achievement-item--earned' : ''}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                >
                  <span className="achievement-icon">{a.emoji}</span>
                  <div className="achievement-info">
                    <div className="achievement-name">{a.name}</div>
                    <div className="achievement-desc">{a.desc}</div>
                  </div>
                  {earned && <span className="achievement-check">✅</span>}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
