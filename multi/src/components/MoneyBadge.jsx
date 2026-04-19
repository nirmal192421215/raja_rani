import { useState, useEffect } from 'react';

export default function MoneyBadge({ amount, animate = false, size = 'md' }) {
  const [displayAmount, setDisplayAmount] = useState(animate ? 0 : amount);

  useEffect(() => {
    if (!animate) {
      setDisplayAmount(amount);
      return;
    }

    let start = 0;
    const end = amount;
    const duration = 1500;
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayAmount(Math.round(start + (end - start) * eased));

      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [amount, animate]);

  const sizes = {
    sm: { fontSize: '0.9rem', padding: '4px 10px' },
    md: { fontSize: '1.1rem', padding: '6px 14px' },
    lg: { fontSize: '1.5rem', padding: '8px 18px' },
    xl: { fontSize: '2rem', padding: '10px 24px' },
  };

  return (
    <div className="money-display" style={sizes[size]}>
      <span className="money-coin">💰</span>
      <span className="money-amount">₹{displayAmount.toLocaleString()}</span>
    </div>
  );
}
