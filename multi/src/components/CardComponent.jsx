import { useState } from 'react';
import { motion } from 'framer-motion';

const roleToImageMap = {
  raja: '/cards/RAJA.png',
  rani: '/cards/QUEEN.png',
  mantri: '/cards/MANTRI.png',
  soldier: '/cards/SOLDIER.png',
  milkman: '/cards/MILKMAN.png',
  gardener: '/cards/GARDENER.png',
  police: '/cards/POLICE.png',
  thief: '/cards/THIEF.png',
};

export default function CardComponent({
  role = null,
  flipped = false,
  size = 'default',
  onClick,
  className = '',
  style = {},
  animated = false,
  dealDelay = 0,
}) {
  const [hasFlipped, setHasFlipped] = useState(flipped);

  const handleClick = () => {
    if (onClick) onClick();
    if (!hasFlipped) setHasFlipped(true);
  };

  const isFlipped = flipped || hasFlipped;

  const sizeClass = size === 'sm' ? 'game-card--sm'
    : size === 'md' ? 'game-card--md'
    : size === 'lg' ? 'game-card--lg'
    : ''; 

  const imageUrl = role ? roleToImageMap[role.id] : null;

  return (
    <motion.div
      className={`game-card ${sizeClass} ${className}`}
      onClick={handleClick}
      style={style}
      initial={animated ? { opacity: 0, y: 100, scale: 0.5 } : false}
      animate={animated ? { opacity: 1, y: 0, scale: 1 } : false}
      transition={{ duration: 0.6, delay: dealDelay, type: 'spring' }}
      whileHover={{ scale: 1.05, translateY: -10 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className="game-card-inner"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.8, type: 'spring', bounce: 0.4 }}
        style={{ transformStyle: 'preserve-3d', position: 'relative', width: '100%', height: '100%' }}
      >
        {/* Back of Card / Placeholder */}
        <div 
          className="game-card-face"
          style={{ 
            background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)',
            backfaceVisibility: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '10px',
            border: '2px solid rgba(255,255,255,0.2)'
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)',
            fontSize: size === 'sm' ? '2rem' : '4rem',
            borderRadius: '8px'
          }}>
            🃏
          </div>
        </div>

        {/* Front of Card / Image Asset */}
        <div 
          className="game-card-face"
          style={{ 
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden', 
            backgroundColor: '#111',
            borderRadius: '10px',
            boxShadow: '0 0 30px rgba(212,175,55,0.4)',
            border: '2px solid rgba(212,175,55,0.6)',
            overflow: 'hidden'
          }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={role?.name || 'Card'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#111' }}>
               <div style={{ fontSize: size === 'sm' ? '1.5rem' : '3rem' }}>{role?.emoji}</div>
               <div style={{ fontSize: size === 'sm' ? '0.7rem' : '1.2rem', fontWeight: 'bold', marginTop: '8px', color: role?.color }}>{role?.name}</div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
