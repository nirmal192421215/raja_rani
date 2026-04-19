import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import AnimatedBackground from '../components/AnimatedBackground';
import GameTableLayout from '../components/GameTableLayout';
import Timer from '../components/Timer';
import ChatBox from '../components/ChatBox';
import { getAvatarColor, getInitials } from '../engine/GameEngine';
import { vibrate, HAPTICS } from '../utils/haptics';
import './ActionScreen.css';
import { motion, AnimatePresence } from 'framer-motion';

export default function ActionScreen() {
  const {
    players, myPlayerId, currentRound, totalRounds, user,
    submitAction, setPhase, totals,
  } = useGame();
  const navigate = useNavigate();
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showInvestigate, setShowInvestigate] = useState(false);

  const myPlayer = players.find(p => p.id === myPlayerId);

  useEffect(() => {
    if (!myPlayer || !myPlayer.roleData) {
      navigate('/home');
    }
  }, [myPlayer, navigate]);

  if (!myPlayer || !myPlayer.roleData) return null;

  const role = myPlayer.roleData;
  const isPolice = myPlayer.role === 'police';
  const isThief = myPlayer.role === 'thief';

  const handleSubmit = useCallback(() => {
    if (submitted) return;
    setSubmitted(true);
    vibrate(HAPTICS.SUBMIT);

    if (isPolice && selectedTarget) {
      submitAction(myPlayerId, selectedTarget);
      setShowInvestigate(true);
      setTimeout(() => setShowInvestigate(false), 1500);
    }

    setTimeout(() => {
      setPhase('waiting');
      navigate('/waiting');
    }, isPolice ? 1500 : 300);
  }, [submitted, isPolice, selectedTarget, submitAction, myPlayerId, setPhase, navigate]);

  const handleTimerComplete = useCallback(() => {
    if (!submitted) handleSubmit();
  }, [submitted, handleSubmit]);

  const handlePlayerClick = (playerId) => {
    if (!isPolice || submitted) return;
    // FIX BUG-06: Prevent Police from selecting another Police
    const targetPlayer = players.find(p => p.id === playerId);
    if (targetPlayer?.role === 'police') {
      vibrate(HAPTICS.ERROR);
      return;
    }
    
    if (playerId !== myPlayerId) {
      setSelectedTarget(playerId);
      vibrate(HAPTICS.TAP);
    }
  };

  const getInstruction = () => {
    switch (myPlayer.role) {
      case 'police':
        return { icon: '🔍', text: 'Select a suspect to investigate', sub: 'Find the Thief to earn ₹300!' };
      case 'thief':
        return { icon: '🕵️', text: 'Stay hidden...', sub: "Hope the Police doesn't find you to earn ₹300!" };
      case 'raja':
        return { icon: '👑', text: 'Observe the round', sub: 'You earn ₹1000 this round' };
      case 'rani':
        return { icon: '👸', text: 'Observe the round', sub: 'You earn ₹800 this round' };
      case 'mantri':
        return { icon: '🧠', text: 'Observe the round', sub: 'You earn ₹700 this round' };
      case 'soldier':
        return { icon: '⚔️', text: 'Observe the round', sub: 'You earn ₹600 this round' };
      case 'milkman':
        return { icon: '🥛', text: 'Observe the round', sub: 'You earn ₹500 this round' };
      case 'gardener':
        return { icon: '🌿', text: 'Observe the round', sub: 'You earn ₹400 this round' };
      default:
        return { icon: '🎮', text: 'Wait for results', sub: '' };
    }
  };

  const instruction = getInstruction();

  const centerContent = (
    <div className="action-center-panel">
      {/* Timer */}
      <Timer duration={30} onComplete={handleTimerComplete} />

      {/* Round badge */}
      <div className="round-indicator">
        🎯 Round {currentRound} / {totalRounds}
      </div>

      {/* Role & Instruction */}
      <motion.div 
        className="action-instruction-card glass-card"
        initial={{ scale: 0.8, y: -50, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.7 }}
        whileHover={{ scale: 1.05 }}
      >
        <div className="action-role-row">
          <span className="action-role-emoji">{role.emoji}</span>
          <span className="action-role-name" style={{ color: role.color }}>{role.name}</span>
        </div>
        <div className="action-instruction-text">{instruction.icon} {instruction.text}</div>
        <div className="action-instruction-sub">{instruction.sub}</div>
      </motion.div>

      {/* Action buttons */}
      {isPolice && (
        <div className="action-police-controls">
          {selectedTarget && (
            <div className="action-selected-label">
              🔍 Investigating: {players.find(p => p.id === selectedTarget)?.name}
            </div>
          )}
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={!selectedTarget || submitted}
            id="confirm-action-btn"
            style={{ maxWidth: '280px' }}
          >
            {submitted ? '✅ Submitted' : '🔍 Confirm Investigation'}
          </button>
        </div>
      )}

      {!isPolice && (
        <button
          className="btn btn--secondary"
          onClick={handleSubmit}
          disabled={submitted}
          id="continue-btn"
          style={{ maxWidth: '280px' }}
        >
          {submitted ? '✅ Done' : '⏭️ Continue'}
        </button>
      )}
    </div>
  );

  return (
    <motion.div 
      className={`action-screen ${isThief ? 'action-screen--thief' : ''}`}
      animate={showInvestigate ? { x: [-15, 15, -10, 10, -5, 5, 0], y: [-15, 15, -10, 10, -5, 5, 0] } : {}}
      transition={{ duration: 0.5 }}
    >
      <AnimatedBackground />

      {/* Investigation animation overlay */}
      {showInvestigate && (
        <div className="action-investigate-overlay">
          <div className="action-investigate-icon">🔍</div>
        </div>
      )}

      {/* Thief shadow effect */}
      {isThief && !submitted && (
        <div className="action-thief-shadow" />
      )}

      <GameTableLayout
        players={players}
        myPlayerId={myPlayerId}
        showRoles={false}
        onPlayerClick={isPolice && !submitted ? handlePlayerClick : undefined}
        selectedPlayerId={selectedTarget}
        centerContent={centerContent}
      />

      {/* Score Panel — FIX BUG-07: Shows actual totals instead of ₹0 */}
      <div className="score-panel">
        <div className="score-panel-title">📊 Current Score</div>
        {players.slice(0, 5).map(p => (
          <div key={p.id} className="score-panel-row">
            <span>{p.name}</span>
            <span className="score-panel-value">₹{(totals[p.id] || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <ChatBox
        players={players}
        myPlayerId={myPlayerId}
        myName={user?.name || 'Player'}
      />
    </motion.div>
  );
}
