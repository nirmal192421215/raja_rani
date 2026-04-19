import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import AnimatedBackground from '../components/AnimatedBackground';
import { CoinShower } from '../components/ParticleEffects';
import ChatBox from '../components/ChatBox';
import { getRoleById } from '../engine/GameEngine';
import { vibrate, HAPTICS } from '../utils/haptics';
import './MoneyScreen.css';
import { motion } from 'framer-motion';

export default function MoneyScreen() {
  const {
    players, roundResult, currentRound, totalRounds,
    totals, room, phaseReady, pollPhaseStatus, syncNextRound,
    myPlayerId, user, endGame, phase
  } = useGame();
  const navigate = useNavigate();
  const [waiting, setWaiting] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [totalCount, setTotalCount] = useState(1);
  const [showCoins, setShowCoins] = useState(true);
  const pollingRef = useRef(null);
  const advancedRef = useRef(false);

  const isLastRound = currentRound >= totalRounds;
  const willReshuffle = !isLastRound;

  // FIX BUG-11: Was redirecting after 100ms — way too fast for socket events to arrive.
  // Increased to 5s and added a flag to cancel if result arrives.
  useEffect(() => {
    if (!roundResult && !isLastRound) {
      const timer = setTimeout(() => {
        if (!roundResult) navigate('/home');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [roundResult, navigate, isLastRound]);

  // Stop coins after 3s
  useEffect(() => {
    vibrate(HAPTICS.COINS);
    const t = setTimeout(() => setShowCoins(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // Global Navigation Sync: Listen for phase changes from GameContext (sockets)
  useEffect(() => {
    if (phase === 'roleReveal' && !isLastRound) {
       navigate('/role-reveal');
    } else if (phase === 'leaderboard' && isLastRound) {
       navigate('/leaderboard');
    }
  }, [phase, isLastRound, navigate]);

  // Poll phase status while waiting (This is still useful to show readyCount UI)
  useEffect(() => {
    if (!waiting || !room) return;
    const currentWaitPhase = isLastRound ? 'leaderboard' : 'money';

    pollingRef.current = setInterval(async () => {
      const status = await pollPhaseStatus(currentWaitPhase);
      setReadyCount(status.readyCount || 0);
      setTotalCount(status.totalCount || 1);

      // We no longer manually advance here! 
      // The server will broadcast 'new_round' which GameContext handles.
    }, 1500);

    return () => clearInterval(pollingRef.current);
  }, [waiting, room, isLastRound, pollPhaseStatus]);

  const handleNext = async () => {
    if (waiting) return;
    setWaiting(true);

    if (!room) {
      navigate(isLastRound ? '/leaderboard' : '/role-reveal');
      return;
    }

    const readyPhase = isLastRound ? 'leaderboard' : 'money';
    const result = await phaseReady(readyPhase);
    setReadyCount(result.readyCount || 1);
    setTotalCount(result.totalCount || 1);

    // No need to manually call advance-round! 
    // The server now triggers triggerAdvanceRound internally 
    // when the last person marks themselves as phaseReady('money').
    if (result.allReady && isLastRound) {
       endGame();
       navigate('/leaderboard');
    }
  };

  // Build player rows sorted by total money
  const rows = players.map(p => {
    const role = getRoleById(p.role);
    const roundEarnings = roundResult?.earnings[p.id] || 0;
    const total = totals[p.id] || 0;
    return { ...p, role, roundEarnings, total };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="money-screen">
      <AnimatedBackground />
      <CoinShower active={showCoins} duration={3000} />

      <div className="money-content">
        <div className="money-header">
          <div className="round-indicator" style={{ marginBottom: '8px' }}>
            💰 Round {currentRound} / {totalRounds}
          </div>
          <h1 className="title title--lg" style={{ marginBottom: '4px' }}>
            <span className="text-gold">Money Board</span>
          </h1>
          <div className="money-multiplier-badge" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, rgba(236,72,153,0.2) 0%, rgba(123,47,247,0.2) 100%)',
            border: '1px solid rgba(236,72,153,0.5)',
            color: '#F472B6',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            marginBottom: '1rem'
          }}>
            🔥 { (1 + ((currentRound - 1) * 0.2)).toFixed(1) }x Payout Multiplier
          </div>
        </div>

        {/* Scoreboard */}
        <motion.div 
          className="money-board glass-card glass-card--elevated"
          initial={{ scale: 0.5, opacity: 0, rotateX: 45 }}
          animate={{ scale: 1, opacity: 1, rotateX: 0 }}
          transition={{ duration: 0.7, type: 'spring', bounce: 0.6 }}
        >
          <div className="money-board-header">
            <span>Player</span>
            <span>Round</span>
            <span>Total</span>
          </div>

          {rows.map((row, i) => {
            const isTop = i === 0;
            const isMe = row.id === myPlayerId;
            return (
              <motion.div
                key={row.id}
                className={`money-row ${isTop ? 'money-row--top' : ''} ${isMe ? 'money-row--me' : ''}`}
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 + 0.3, type: 'spring' }}
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 215, 0, 0.1)', cursor: 'crosshair' }}
              >
                <div className="money-row-left">
                  <div className="money-row-rank">
                    {i === 0 ? '👑' : `#${i + 1}`}
                  </div>
                  <div className="money-row-role-icon">{row.role?.emoji || '❓'}</div>
                  <div className="money-row-info">
                    <div className="money-row-name">
                      {row.name}
                      {isMe && <span className="money-row-me-tag">YOU</span>}
                    </div>
                    <div className="money-row-role-name">{row.role?.name || 'Unknown'}</div>
                  </div>
                </div>

                <div className="money-row-earnings">
                  <div className={`money-row-round ${row.roundEarnings > 0 ? 'money-row-round--positive' : 'money-row-round--zero'}`}>
                    {row.roundEarnings > 0 ? '+' : ''}₹{row.roundEarnings.toLocaleString()}
                  </div>
                </div>

                <div className="money-row-total">
                  ₹{row.total.toLocaleString()}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {willReshuffle && !waiting && (
          <div className="money-reshuffle-notice">
            🔄 Cards will reshuffle next round!
          </div>
        )}

        <div className="money-actions">
          {!waiting ? (
            <button
              className="btn btn--gold btn--lg btn--pulse"
              onClick={handleNext}
              id="next-round-btn"
            >
              {isLastRound ? '🏆 View Final Results' : '🔄 Reshuffle & Continue'}
            </button>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div className="btn btn--secondary btn--lg" style={{ opacity: 0.7, pointerEvents: 'none' }}>
                ✅ Waiting for others... ({readyCount}/{totalCount})
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '8px' }}>
                Waiting for all players to continue
              </p>
            </div>
          )}
        </div>
      </div>

      <ChatBox
        players={players}
        myPlayerId={myPlayerId}
        myName={user?.name || 'Player'}
      />
    </div>
  );
}
