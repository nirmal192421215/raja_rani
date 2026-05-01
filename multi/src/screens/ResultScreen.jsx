import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import AnimatedBackground from '../components/AnimatedBackground';
import { CoinShower } from '../components/ParticleEffects';
import ChatBox from '../components/ChatBox';
import { playClick, playCoin, playWin, playLose } from '../engine/SoundEngine';
import './ResultScreen.css';

export default function ResultScreen() {
  const { roundResult, currentRound, totalRounds, setPhase, room, phaseReady, pollPhaseStatus, players, myPlayerId, user, phase } = useGame();
  const navigate = useNavigate();
  const [waiting, setWaiting] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [totalCount, setTotalCount] = useState(1);
  const [visibleEvents, setVisibleEvents] = useState(0);
  const [showCoins, setShowCoins] = useState(true);
  const pollingRef = useRef(null);

  const isLastRound = currentRound >= totalRounds;

  // Stop coins after 3s
  useEffect(() => {
    const t = setTimeout(() => setShowCoins(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // Wait for round results data
  useEffect(() => {
    if (!roundResult && phase !== 'roleReveal' && phase !== 'leaderboard') {
       // Optional: fetch or wait, but don't kick home during a valid round
    } else if (roundResult) {
       // Play win/lose sound based on my earnings
       const myEarnings = roundResult.earnings?.[myPlayerId] || 0;
       if (myEarnings > 0) playWin();
       else if (myEarnings <= 0) playLose();

       if (showCoins) playCoin();
    }
  }, [roundResult, phase]);

  // Staggered event reveal
  useEffect(() => {
    if (!roundResult?.events) return;
    const totalEvents = roundResult.events.length;
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setVisibleEvents(count);
      if (count >= totalEvents) clearInterval(interval);
    }, 600);
    return () => clearInterval(interval);
  }, [roundResult]);

  // Global Navigation Sync: Listen for phase changes from GameContext (sockets)
  useEffect(() => {
    if (phase === 'roleReveal' && !isLastRound) {
       navigate('/role-reveal');
    } else if (phase === 'leaderboard' && isLastRound) {
       navigate('/leaderboard');
    }
  }, [phase, isLastRound, navigate]);

  // Poll phase status if we are waiting (still useful for UI count)
  useEffect(() => {
    if (!waiting || !room) return;
    pollingRef.current = setInterval(async () => {
      const status = await pollPhaseStatus('result');
      setReadyCount(status.readyCount || 0);
      setTotalCount(status.totalCount || 1);
    }, 1500);
    return () => clearInterval(pollingRef.current);
  }, [waiting, room, pollPhaseStatus]);

  const handleContinue = async () => {
    if (waiting) return;
    playClick();
    setWaiting(true);

    if (!room) {
      navigate(isLastRound ? '/leaderboard' : '/role-reveal');
      return;
    }

    const result = await phaseReady('result');
    setReadyCount(result.readyCount || 1);
    setTotalCount(result.totalCount || 1);
    if (result.allReady) {
      clearInterval(pollingRef.current);
      if (isLastRound) navigate('/leaderboard');
    }
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'police_correct': return '✅';
      case 'police_wrong': return '❌';
      case 'police_skip': return '🚫';
      case 'thief_caught': return '🚨';
      case 'thief_escape': return '💨';
      case 'thief_hidden': return '👻';
      default: return '📌';
    }
  };

  return (
    <div className="result-screen">
      <AnimatedBackground />
      <CoinShower active={showCoins} duration={3000} />
      <div className="result-content">
        <div className="result-header">
          <div className="round-indicator" style={{ marginBottom: '8px' }}>
            🎯 Round {currentRound} / {totalRounds}
          </div>
          <h1 className="title title--lg">
            <span className="text-gold">Round Results</span>
          </h1>
        </div>

        {/* Events with dramatic reveal */}
        <div className="result-events glass-card">
          {roundResult?.events.map((event, i) => (
            <div
              key={i}
              className={`result-event ${i < visibleEvents ? 'result-event--visible' : ''}`}
              style={{ '--event-color': event.color }}
            >
              <div className="result-event-marker" style={{ background: event.color }} />
              <div className="result-event-icon">{getEventIcon(event.type)}</div>
              <div className="result-event-body">
                <div className="result-event-text">{event.text}</div>
              </div>
            </div>
          ))}

          {roundResult?.events.length === 0 && (
            <div className="result-event result-event--visible" style={{ '--event-color': 'var(--text-muted)' }}>
              <div className="result-event-icon">😶</div>
              <div className="result-event-body">
                <div className="result-event-text">Nothing eventful happened this round...</div>
              </div>
            </div>
          )}
        </div>

        {/* Earnings & Standings preview */}
        {roundResult && (
          <div className="result-earnings glass-card">
            <div className="result-earnings-title">📊 Standings After Round {currentRound}</div>
            <div className="result-earnings-header">
               <span>Player</span>
               <span>Earned</span>
               <span>Total</span>
            </div>
            <div className="result-earnings-grid">
              {players.map(p => {
                const earned = roundResult.earnings[p.id] || 0;
                const total = useGame().totals[p.id] || 0;
                return (
                  <div key={p.id} className="result-earning-item">
                    <span className="result-earning-name">
                      {p.roleData?.emoji} {p.name}
                    </span>
                    <span
                      className="result-earning-value"
                      style={{ color: earned > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
                    >
                      {earned > 0 ? '+' : ''}₹{earned.toLocaleString()}
                    </span>
                    <span className="result-total-value">
                      ₹{total.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="result-continue">
          {!waiting ? (
            <button
              className="btn btn--gold btn--lg btn--pulse"
              onClick={handleContinue}
              id="result-continue-btn"
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
