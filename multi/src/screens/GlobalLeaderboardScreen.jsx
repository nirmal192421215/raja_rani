import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedBackground from '../components/AnimatedBackground';
import { getLevelTitle } from '../engine/XPEngine';
import { getAvatarColor, getInitials } from '../engine/GameEngine';
import { API_GLOBAL_LEADERBOARD } from '../services/api';
import './GlobalLeaderboard.css';
import { motion } from 'framer-motion';

const TABS = [
  { id: 'earnings', label: '💰 Richest',  col: 'Total Earnings' },
  { id: 'wins',     label: '🏆 Most Wins', col: 'Wins' },
  { id: 'level',    label: '⭐ Top Level',  col: 'Level' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

export default function GlobalLeaderboardScreen() {
  const navigate = useNavigate();
  const [tab, setTab]       = useState('earnings');
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(API_GLOBAL_LEADERBOARD(tab))
      .then(r => r.json())
      .then(data => {
        if (data.success) setPlayers(data.players);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tab]);

  const getMainValue = (p) => {
    if (tab === 'earnings') return `₹${p.totalEarnings.toLocaleString()}`;
    if (tab === 'wins')     return `${p.wins} wins`;
    return `Lv.${p.level}`;
  };

  const getSubValue = (p) => {
    if (tab === 'earnings') return `${p.wins} wins · ${p.gamesPlayed} games`;
    if (tab === 'wins')     return `${p.winRate}% win rate`;
    return `${p.xp.toLocaleString()} XP`;
  };

  return (
    <div className="gl-screen">
      <AnimatedBackground />

      <div className="gl-container">
        {/* Header */}
        <div className="gl-header">
          <button className="gl-back" onClick={() => navigate('/home')}>← Back</button>
          <h1 className="gl-title">🌍 Global Leaderboard</h1>
          <p className="gl-subtitle">Top players from all around the world</p>
        </div>

        {/* Tabs */}
        <div className="gl-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`gl-tab ${tab === t.id ? 'gl-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="gl-loading">
            <div className="gl-spinner" />
            <span>Loading rankings...</span>
          </div>
        )}

        {/* Top 3 Podium */}
        {!loading && players.length >= 3 && (
          <div className="gl-podium">
            {[players[1], players[0], players[2]].map((p, displayIdx) => {
              const actualRank = displayIdx === 0 ? 2 : displayIdx === 1 ? 1 : 3;
              const color = getAvatarColor(p.id.charCodeAt(0) % 8);
              const { emoji } = getLevelTitle(p.level);
              const heights = { 1: 130, 2: 95, 3: 70 };
              return (
                <motion.div
                  key={p.id}
                  className={`gl-podium-item gl-podium-item--${actualRank}`}
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 * displayIdx, type: 'spring', bounce: 0.5 }}
                >
                  <div className="gl-podium-avatar" style={{ background: `${color}25`, color, border: `2px solid ${color}70` }}>
                    {p.picture
                      ? <img src={p.picture} alt={p.name} />
                      : getInitials(p.name)
                    }
                    <span className="gl-podium-level">{emoji}{p.level}</span>
                  </div>
                  <div className="gl-podium-medal">{MEDALS[actualRank - 1]}</div>
                  <div className="gl-podium-name">{p.name}</div>
                  <div className="gl-podium-value">{getMainValue(p)}</div>
                  <div className="gl-podium-stand" style={{ height: heights[actualRank] }}>
                    <span className="gl-podium-rank">#{actualRank}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Full list */}
        {!loading && (
          <div className="gl-list glass-card">
            {players.length === 0 && (
              <div className="gl-empty">No players yet. Be the first! 🎮</div>
            )}
            {players.map((p, i) => {
              const color = getAvatarColor(p.id.charCodeAt(0) % 8);
              const { title, emoji, color: rankColor } = getLevelTitle(p.level);
              return (
                <motion.div
                  key={p.id}
                  className="gl-row"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i }}
                >
                  <div className="gl-row-rank">
                    {i < 3 ? MEDALS[i] : `#${i + 1}`}
                  </div>
                  <div className="gl-row-avatar" style={{ background: `${color}20`, color, border: `2px solid ${color}50` }}>
                    {p.picture
                      ? <img src={p.picture} alt={p.name} />
                      : getInitials(p.name)
                    }
                  </div>
                  <div className="gl-row-info">
                    <div className="gl-row-name">{p.name}</div>
                    <div className="gl-row-rank-title" style={{ color: rankColor }}>
                      {emoji} {title} · {getSubValue(p)}
                    </div>
                  </div>
                  <div className="gl-row-value">{getMainValue(p)}</div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
