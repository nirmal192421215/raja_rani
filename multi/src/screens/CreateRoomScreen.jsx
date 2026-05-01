import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import AnimatedBackground from '../components/AnimatedBackground';
import { playClick } from '../engine/SoundEngine';
import './CreateRoomScreen.css';

const ROUND_OPTIONS = [5, 10, 15, 20, 25];
const DIFFICULTY_OPTIONS = [
  { id: 'rookie', label: 'Rookie', icon: '👶' },
  { id: 'pro',    label: 'Pro',    icon: '😎' },
  { id: 'expert', label: 'Expert', icon: '🧠' }
];

export default function CreateRoomScreen() {
  const [selectedRounds, setSelectedRounds] = useState(5);
  const [difficulty, setDifficulty] = useState('rookie');
  const { createRoom } = useGame();
  const navigate = useNavigate();

  const handleCreate = async () => {
    playClick();
    const success = await createRoom(selectedRounds, difficulty);
    if (success) navigate('/lobby');
  };

  return (
    <div className="create-room-screen">
      <AnimatedBackground />
      <div className="create-room-content">
        <div className="create-room-header">
          <div className="create-room-icon">🏰</div>
          <h1 className="title title--lg text-center">
            <span className="text-gold">Create Room</span>
          </h1>
          <p className="subtitle text-center" style={{ color: 'var(--text-muted)' }}>Choose how many rounds to play</p>
        </div>

        <div className="glass-card">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', margin: '12px 0' }}>
            🔄 Cards reshuffle every round!
          </p>

          <div className="rounds-selector">
            {ROUND_OPTIONS.map((rounds) => (
              <button
                key={rounds}
                className={`rounds-option ${selectedRounds === rounds ? 'rounds-option--selected' : ''}`}
                onClick={() => { playClick(); setSelectedRounds(rounds); }}
                id={`rounds-${rounds}-btn`}
              >
                <div className="rounds-label">{rounds}</div>
                <div className="rounds-sub">rounds</div>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', margin: '12px 0 16px' }}>
            🤖 AI Bot Difficulty
          </p>
          <div className="difficulty-selector">
            {DIFFICULTY_OPTIONS.map((diff) => (
              <button
                key={diff.id}
                className={`diff-option ${difficulty === diff.id ? 'diff-option--selected' : ''}`}
                onClick={() => { playClick(); setDifficulty(diff.id); }}
              >
                <div className="diff-icon">{diff.icon}</div>
                <div className="diff-label">{diff.label}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn--gold btn--lg"
          onClick={handleCreate}
          id="create-room-submit-btn"
        >
          👑 Create Room
        </button>

        <button className="create-back" onClick={() => { playClick(); navigate('/home'); }} id="create-back-btn">
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
