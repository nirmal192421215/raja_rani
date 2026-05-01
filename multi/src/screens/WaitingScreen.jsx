import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import AnimatedBackground from '../components/AnimatedBackground';
import CardComponent from '../components/CardComponent';
import { ROLES } from '../engine/GameEngine';
import { API_BASE } from '../services/api';
import './WaitingScreen.css';

const SHUFFLE_ROLES = [ROLES.RAJA, ROLES.RANI, ROLES.POLICE, ROLES.THIEF, ROLES.MANTRI, ROLES.SOLDIER];

export default function WaitingScreen() {
  const { roundResult, phase, room, myPlayerId, refreshRoom } = useGame();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [shuffleIndex, setShuffleIndex] = useState(0);

  // Wait for both the loading animation AND the server's websocket result
  useEffect(() => {
    // Navigate if we have the result OR if the global phase has already moved to result
    if (progress >= 100 && (roundResult || phase === 'result')) {
      setTimeout(() => navigate('/result'), 400);
    }
  }, [progress, roundResult, phase, navigate]);


  // Fallback: If we are stuck at 100% and don't have a result, poll the server
  useEffect(() => {
    if (progress < 100 || roundResult || phase === 'result') return;

    const interval = setInterval(async () => {
      console.log("WaitingScreen: Stuck at 100%. Forcing phase refresh...");
      const success = await refreshRoom();
      if (success && phase === 'result') {
        console.log("WaitingScreen: Server is in result phase! Navigating...");
        navigate('/result');
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [progress, roundResult, phase, room, myPlayerId, navigate]);


  useEffect(() => {
    const steps = [20, 45, 70, 85, 100];
    let i = 0;

    const interval = setInterval(() => {
      if (i < steps.length) {
        setProgress(steps[i]);
        i++;
      }
      if (i >= steps.length) {
        clearInterval(interval);
      }
    }, 600);

    return () => clearInterval(interval);
  }, []);

  // Card shuffle animation
  useEffect(() => {
    const interval = setInterval(() => {
      setShuffleIndex(prev => (prev + 1) % SHUFFLE_ROLES.length);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="waiting-screen">
      <AnimatedBackground />
      <div className="waiting-content">
        {/* Animated shuffling cards */}
        <div className="waiting-cards-shuffle">
          {SHUFFLE_ROLES.map((role, i) => (
            <div
              key={role.id}
              className={`waiting-shuffle-card ${i === shuffleIndex ? 'waiting-shuffle-card--active' : ''}`}
              style={{
                transform: `rotate(${(i - 2.5) * 15}deg) translateY(${i === shuffleIndex ? -20 : 0}px)`,
                zIndex: i === shuffleIndex ? 10 : 1,
              }}
            >
              <CardComponent size="sm" />
            </div>
          ))}
        </div>

        <div className="waiting-spinner-ring">
          <div className="waiting-spinner-inner" />
        </div>

        <h2 className="waiting-text">Processing Round...</h2>
        <p className="waiting-subtext">Revealing everyone's actions</p>

        <div className="waiting-progress">
          <div className="waiting-progress-bar">
            <div className="waiting-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="waiting-progress-label">
            {progress < 100 ? `${progress}% Complete` : '✅ All done!'}
          </div>
        </div>

        <div className="waiting-dots">
          <div className="waiting-dot" />
          <div className="waiting-dot" />
          <div className="waiting-dot" />
        </div>
      </div>
    </div>
  );
}
