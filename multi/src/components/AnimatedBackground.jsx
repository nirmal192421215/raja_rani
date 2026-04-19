import { memo, useMemo } from 'react';

function AnimatedBackground() {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 8,
      size: 2 + Math.random() * 3,
      duration: 6 + Math.random() * 6,
    })), []);

  return (
    <div className="card-table-surface" aria-hidden="true">
      {particles.map(p => (
        <div
          key={p.id}
          className="table-particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export default memo(AnimatedBackground);
