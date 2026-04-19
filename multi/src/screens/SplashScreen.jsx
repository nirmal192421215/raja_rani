import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedBackground from '../components/AnimatedBackground';
import CardComponent from '../components/CardComponent';
import { ROLES } from '../engine/GameEngine';
import './SplashScreen.css';

const DEAL_ROLES = [ROLES.RAJA, ROLES.RANI, ROLES.POLICE, ROLES.THIEF, ROLES.MANTRI];

export default function SplashScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0); // 0=logo, 1=cards, 2=ready

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 2000);
    const t3 = setTimeout(() => {
      const user = localStorage.getItem('rr_user');
      navigate(user ? '/home' : '/login');
    }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [navigate]);

  return (
    <div className="splash-screen">
      <AnimatedBackground />

      <div className="splash-crown-glow" />

      <div className={`splash-logo ${phase >= 0 ? 'splash-logo--visible' : ''}`}>
        👑
      </div>

      <h1 className={`splash-title ${phase >= 0 ? 'splash-title--visible' : ''}`}>
        <span className="text-gold">Raja Rani</span>
        <br />
        <span className="splash-title-sub">Money War</span>
      </h1>

      {/* Dealing cards */}
      <div className={`splash-cards ${phase >= 1 ? 'splash-cards--visible' : ''}`}>
        {DEAL_ROLES.map((role, i) => (
          <div
            key={role.id}
            className="splash-card-wrapper"
            style={{
              transform: `rotate(${(i - 2) * 12}deg) translateY(${Math.abs(i - 2) * 8}px)`,
              animationDelay: `${0.8 + i * 0.15}s`,
            }}
          >
            <CardComponent
              role={role}
              size="sm"
              flipped={phase >= 2}
              animated
              dealDelay={i * 0.12}
            />
          </div>
        ))}
      </div>

      <p className={`splash-tagline ${phase >= 2 ? 'splash-tagline--visible' : ''}`}>
        Outsmart · Survive · Rule
      </p>

      <div className="splash-loader">
        <div className="splash-loader-bar">
          <div className={`splash-loader-fill ${phase >= 1 ? 'splash-loader-fill--active' : ''}`} />
        </div>
        <span className="splash-loader-text">
          {phase < 1 ? 'Loading...' : phase < 2 ? 'Dealing cards...' : 'Ready!'}
        </span>
      </div>
    </div>
  );
}
