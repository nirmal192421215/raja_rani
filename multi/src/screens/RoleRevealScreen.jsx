import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import AnimatedBackground from '../components/AnimatedBackground';
import CardComponent from '../components/CardComponent';
import { SparkleEffect } from '../components/ParticleEffects';
import { API_BASE } from '../services/api';
import { vibrate, HAPTICS } from '../utils/haptics';
import { playReveal, playClick } from '../engine/SoundEngine';
import './RoleRevealScreen.css';

export default function RoleRevealScreen() {
  const [flipped, setFlipped] = useState(false);
  const { room, players, myPlayerId, currentRound, totalRounds, reshuffleNotice, setPhase } = useGame();
  const navigate = useNavigate();

  const myPlayer = players.find(p => p.id === myPlayerId);

  useEffect(() => {
    if (!myPlayer || !myPlayer.roleData) {
      navigate('/home');
    }
  }, [myPlayer, navigate]);

  if (!myPlayer || !myPlayer.roleData) {
    return null;
  }

  const role = myPlayer.roleData;

  const handleFlip = () => {
    if (!flipped) {
      playReveal();
      setFlipped(true);
      vibrate(HAPTICS.REVEAL);
    }
  };

  const handleReady = async () => {
    playClick();
    // Navigate immediately for responsive UX
    setPhase('discussion');
    navigate('/discussion');
    
    // Trigger server bots (fire-and-forget)
    try {
      if (room?.code) {
        await fetch(`${API_BASE}/api/room/enter-discussion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: room.code })
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="role-screen">
      <AnimatedBackground />

      <div className="role-content">
        <div className="role-round-badge">
          <div className="round-indicator">
            🎯 Round {currentRound} of {totalRounds}
          </div>
        </div>

        {reshuffleNotice && (
          <div className="role-reshuffle-notice badge badge--gold" style={{ animation: 'fadeInScale 0.5s ease-out' }}>
            🔄 Cards Reshuffled!
          </div>
        )}

        {/* Main card */}
        <div className="role-card-area" onClick={handleFlip}>
          <div className={`role-card-glow ${flipped ? 'role-card-glow--active' : ''}`}
            style={{ '--glow-color': role.color }}
          />

          <CardComponent
            role={role}
            size="lg"
            flipped={flipped}
            onClick={handleFlip}
          />

          {flipped && <SparkleEffect active color={role.color} count={15} />}
        </div>

        {!flipped && (
          <div className="role-tap-hint">
            <span className="role-tap-icon">👆</span>
            Tap the card to reveal your role
          </div>
        )}

        {flipped && (
          <div className="role-revealed-info animate-fadein-up">
            <div className="role-revealed-badge" style={{
              background: `${role.color}18`,
              border: `1px solid ${role.color}40`,
              color: role.color,
            }}>
              {role.emoji} {role.name} · ₹{role.value}
            </div>

            <p className="role-description">{role.description}</p>

            <div className="role-private-notice">
              🔒 Only you can see this
            </div>

            <button
              className="btn btn--gold btn--lg"
              onClick={handleReady}
              id="role-ready-btn"
              style={{ marginTop: '8px' }}
            >
              ⚡ I'm Ready
            </button>
          </div>
        )}

        {/* Other players' cards (face down) */}
        <div className="role-other-cards">
          {players.filter(p => p.id !== myPlayerId).slice(0, 6).map((p, i) => (
            <div
              key={p.id}
              className="role-other-card-item"
              style={{
                animationDelay: `${0.5 + i * 0.1}s`,
              }}
            >
              <CardComponent size="sm" animated dealDelay={0.5 + i * 0.1} />
              <span className="role-other-name">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
