import { useEffect, useRef, memo, useCallback } from 'react';

function CoinShower({ active = true, duration = 3000 }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const startAnimation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const coins = Array.from({ length: 30 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 200,
      vy: 1.5 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 2,
      size: 10 + Math.random() * 14,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 8,
      opacity: 0.6 + Math.random() * 0.4,
    }));

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      // FIX D07: Skip rendering when tab is hidden (saves battery on mobile)
      if (document.hidden) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      coins.forEach(coin => {
        coin.y += coin.vy;
        coin.x += coin.vx;
        coin.rotation += coin.rotationSpeed;

        if (coin.y > canvas.height + 20) {
          coin.y = -20;
          coin.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.translate(coin.x, coin.y);
        ctx.rotate((coin.rotation * Math.PI) / 180);
        ctx.globalAlpha = coin.opacity * (1 - elapsed / duration / 1.5);

        // Draw coin
        const scaleX = Math.abs(Math.cos((coin.rotation * Math.PI) / 180));
        ctx.beginPath();
        ctx.ellipse(0, 0, coin.size * Math.max(0.3, scaleX), coin.size, 0, 0, 2 * Math.PI);
        ctx.fillStyle = '#D4AF37';
        ctx.fill();
        ctx.strokeStyle = '#A67C00';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner circle
        ctx.beginPath();
        ctx.ellipse(0, 0, coin.size * 0.6 * Math.max(0.3, scaleX), coin.size * 0.6, 0, 0, 2 * Math.PI);
        ctx.strokeStyle = '#F0D878';
        ctx.lineWidth = 1;
        ctx.stroke();

        // ₹ symbol
        if (scaleX > 0.5) {
          ctx.fillStyle = '#A67C00';
          ctx.font = `bold ${coin.size * 0.7}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('₹', 0, 1);
        }

        ctx.restore();
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, [duration]);

  useEffect(() => {
    if (active) startAnimation();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [active, startAnimation]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    />
  );
}

function SparkleEffect({ active = true, color = '#D4AF37', count = 12 }) {
  if (!active) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${20 + Math.random() * 60}%`,
            top: `${20 + Math.random() * 60}%`,
            width: 4 + Math.random() * 6,
            height: 4 + Math.random() * 6,
            borderRadius: '50%',
            background: color,
            animation: `sparkle ${1 + Math.random() * 1.5}s ease-in-out ${Math.random() * 2}s infinite`,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      ))}
    </div>
  );
}

function ConfettiEffect({ active = true, duration = 5000 }) {
  const colors = ['#D4AF37', '#E91E8B', '#7B2FF7', '#059669', '#2563EB', '#DC2626', '#0891B2'];

  if (!active) return null;

  return (
    <div className="confetti-container" style={{
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 50,
      overflow: 'hidden',
    }}>
      {Array.from({ length: 60 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            bottom: '-10px',
            width: 6 + Math.random() * 8,
            height: 6 + Math.random() * 8,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            background: colors[i % colors.length],
            animation: `confetti ${2 + Math.random() * 3}s ease-out ${Math.random() * 3}s both`,
          }}
        />
      ))}
    </div>
  );
}

export { CoinShower, SparkleEffect, ConfettiEffect };
export default CoinShower;
