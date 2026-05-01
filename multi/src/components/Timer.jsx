import { useState, useEffect, useRef } from 'react';

export default function Timer({ duration = 30, onComplete, size = 80 }) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const intervalRef = useRef(null);

  useEffect(() => {
    setTimeLeft(duration);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [duration]);

  // Trigger onComplete in a separate effect to avoid setState-during-render
  useEffect(() => {
    if (timeLeft === 0) {
      onComplete?.();
    }
  }, [timeLeft, onComplete]);

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (timeLeft / duration) * circumference;

  const getColor = () => {
    if (timeLeft <= 5) return '#EF4444';
    if (timeLeft <= 10) return '#F59E0B';
    return '#10B981';
  };

  return (
    <div className="timer-container" style={{ width: size, height: size }}>
      <svg className="timer-svg" style={{ width: size, height: size }} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="timer-circle-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        <circle
          className="timer-circle"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={timeLeft <= 5 ? { animation: 'glow 1s ease-in-out infinite', color: '#EF4444' } : {}}
        />
      </svg>
      <div className="timer-text" style={{ color: getColor(), fontSize: size * 0.22 }}>
        {timeLeft}
      </div>
    </div>
  );
}
