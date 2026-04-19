import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import AnimatedBackground from '../components/AnimatedBackground';
import { ConfettiEffect, CoinShower } from '../components/ParticleEffects';
import { getAvatarColor, getInitials } from '../engine/GameEngine';
import './LeaderboardScreen.css';

export default function LeaderboardScreen() {
  const { rankings, reset, user, updateStats } = useGame();
  const navigate = useNavigate();
  const [showConfetti, setShowConfetti] = useState(true);
  const [showCoins, setShowCoins] = useState(true);
  const [revealedRanks, setRevealedRanks] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setShowConfetti(false), 6000);
    const t2 = setTimeout(() => setShowCoins(false), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Staggered rank reveal
  useEffect(() => {
    if (!rankings) return;
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setRevealedRanks(count);
      if (count >= rankings.length) clearInterval(interval);
    }, 300);
    return () => clearInterval(interval);
  }, [rankings]);

  useEffect(() => {
    if (rankings && rankings.length > 0 && user) {
      const myId = user.id || user.googleId || user._id;
      const myRanking = rankings.find(r => r.id === myId);
      if (myRanking) {
        updateStats(myRanking.totalMoney, myRanking.rank === 1);
      }
    }
  }, [rankings, user, updateStats]);

  // FIX BUG-08: Don't call navigate() during render — use effect instead
  useEffect(() => {
    if (!rankings || rankings.length === 0) {
      navigate('/home');
    }
  }, [rankings, navigate]);

  if (!rankings || rankings.length === 0) {
    return null;
  }

  const top3 = rankings.slice(0, 3);
  // Reorder for podium display: 2nd, 1st, 3rd
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length >= 2
    ? [top3[1], top3[0]]
    : [top3[0]];

  const handlePlayAgain = () => {
    reset();
    navigate('/home');
  };

  const medals = ['🥇', '🥈', '🥉'];
  const podiumHeights = { 1: 160, 2: 110, 3: 80 };

  return (
    <div className="leaderboard-screen">
      <AnimatedBackground />
      <ConfettiEffect active={showConfetti} />
      <CoinShower active={showCoins} duration={4000} />

      <div className="leaderboard-content">
        <div className="leaderboard-header">
          <div className="leaderboard-trophy">🏆</div>
          <h1 className="title title--lg">
            <span className="text-gold">Final Results</span>
          </h1>
          <p className="leaderboard-subtitle">The Money War has ended!</p>
        </div>

        {/* Podium */}
        <div className="leaderboard-podium">
          {podiumOrder.map((player) => {
            const actualRank = player.rank;
            const color = getAvatarColor(player.colorIndex || 0);
            const height = podiumHeights[actualRank] || 60;

            return (
              <div key={player.id} className={`podium-item podium-item--${actualRank}`}>
                {/* Avatar */}
                <div className="podium-avatar-area">
                  <div
                    className="podium-avatar"
                    style={{
                      background: `${color}25`,
                      color: color,
                      border: `3px solid ${color}80`,
                      boxShadow: actualRank === 1 ? `0 0 30px rgba(212,175,55,0.4)` : undefined,
                    }}
                  >
                    {getInitials(player.name)}
                  </div>
                  <span className="podium-medal">{medals[actualRank - 1]}</span>
                </div>

                <div className="podium-player-name">{player.name}</div>
                <div className="podium-player-money">₹{player.totalMoney.toLocaleString()}</div>

                {/* Stand */}
                <div
                  className="podium-stand"
                  style={{
                    height: `${height}px`,
                    background: actualRank === 1
                      ? 'linear-gradient(180deg, rgba(212,175,55,0.35), rgba(212,175,55,0.1))'
                      : actualRank === 2
                      ? 'linear-gradient(180deg, rgba(192,192,192,0.3), rgba(192,192,192,0.08))'
                      : 'linear-gradient(180deg, rgba(205,127,50,0.3), rgba(205,127,50,0.08))',
                    borderColor: actualRank === 1
                      ? 'rgba(212,175,55,0.5)'
                      : actualRank === 2
                      ? 'rgba(192,192,192,0.3)'
                      : 'rgba(205,127,50,0.3)',
                  }}
                >
                  <span className="podium-stand-rank">{actualRank}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full ranked list */}
        <div className="leaderboard-list glass-card">
          <div className="leaderboard-list-title">📊 Full Rankings</div>
          {rankings.map((player, i) => {
            const role = player.roleData;
            const isTop3 = player.rank <= 3;
            const color = getAvatarColor(player.colorIndex || 0);
            const isRevealed = i < revealedRanks;

            return (
              <div
                key={player.id}
                className={`leaderboard-row ${isTop3 ? 'leaderboard-row--winner' : ''} ${isRevealed ? 'leaderboard-row--visible' : ''}`}
                style={{ transitionDelay: `${i * 0.08}s` }}
              >
                <div className="leaderboard-rank">
                  {player.rank <= 3 ? medals[player.rank - 1] : `#${player.rank}`}
                </div>
                <div
                  className="leaderboard-avatar"
                  style={{
                    background: `${color}20`,
                    color: color,
                    border: `2px solid ${color}50`,
                  }}
                >
                  {role?.emoji || getInitials(player.name)}
                </div>
                <div className="leaderboard-info">
                  <div className="leaderboard-name">{player.name}</div>
                  <div className="leaderboard-role-name" style={{ color: role?.color }}>
                    {role?.emoji} {role?.name || 'Unknown'}
                  </div>
                </div>
                <div className="leaderboard-total">₹{player.totalMoney.toLocaleString()}</div>
              </div>
            );
          })}
        </div>

        {rankings.length > 3 && (
          <div className="leaderboard-luck-msg">Better luck next time! 🍀</div>
        )}

        <div className="leaderboard-actions">
          <button
            className="btn btn--gold btn--lg"
            onClick={handlePlayAgain}
            id="play-again-btn"
          >
            🎮 Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
