import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame, getSharedSocket } from '../context/GameContext';
import AnimatedBackground from '../components/AnimatedBackground';
import ChatBox from '../components/ChatBox';
import './DiscussionScreen.css';
import { getAvatarColor, getInitials } from '../engine/GameEngine';
import { vibrate, HAPTICS } from '../utils/haptics';

export default function DiscussionScreen() {
  const { room, players, myPlayerId, setPhase, isHost } = useGame();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(30);
  const [votes, setVotes] = useState({}); // { playerId: 'ACCUSE' | 'TRUST' }
  const [claims, setClaims] = useState({}); // { playerId: 'Raja' }
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [evidence, setEvidence] = useState(null);

  const myPlayer = players.find(p => p.id === myPlayerId);

  useEffect(() => {
    // Basic local timer for now, real implementation would sync with server timer
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTimeUp = () => {
    // Host auto-advances phase when time is up
    if (isHost && room) {
       fetch('http://localhost:5001/api/room/force-action', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ code: room.code })
       }).catch(console.error);
    }
  };

  useEffect(() => {
    // Auto navigate if phase changes
    if (room && room.currentPhase === 'action') {
       navigate('/action');
    }
  }, [room?.currentPhase, navigate]);

  useEffect(() => {
    const socket = getSharedSocket();
    if (!socket) return;
    
    const handleClaim = (data) => {
      setClaims(prev => ({ ...prev, [data.playerId]: data.claim }));
    };
    
    const handleVote = (data) => {
      if (data.playerId !== myPlayerId) {
        // Technically voting is anonymous visually? Masterplan says "anonymous accusation".
        // Let's just track it for real-time vibe, maybe animate a counter.
        // For now, we'll store who voted for whom to show it.
      }
    };

    socket.on('receive_claim', handleClaim);
    socket.on('receive_vote', handleVote);
    
    return () => {
      socket.off('receive_claim', handleClaim);
      socket.off('receive_vote', handleVote);
    };
  }, [myPlayerId]);

  const handleVote = (targetId, type) => {
    setVotes(prev => ({ ...prev, [targetId]: type }));
    vibrate(HAPTICS.TAP);
    const socket = getSharedSocket();
    if (socket) {
      socket.emit('game:vote', { code: room.code, targetId, type });
    }
  };

  const handleClaim = (roleName) => {
    const socket = getSharedSocket();
    if (socket) {
      socket.emit('game:claim', { code: room.code, claimedRole: roleName });
    }
    setShowRoleSelector(false);
  };

  return (
    <div className="discussion-screen">
      <AnimatedBackground />

      <div className="discussion-content">
        <div className="discussion-header">
           <h1 className="title title--md text-gold">Discussion Phase</h1>
           <div className={`discussion-timer ${timeLeft <= 5 ? 'discussion-timer--danger' : ''}`}>
             ⏱️ 0:{timeLeft.toString().padStart(2, '0')}
           </div>
        </div>

        <div className="discussion-evidence glass-card">
           <div className="evidence-title">🔍 Intercepted Intel</div>
           <div className="evidence-text">
             "The Thief's username has more than 4 letters..."
           </div>
        </div>

        <div className="discussion-players-grid">
           {players.filter(p => !p.isBot).map(p => {
             const isMe = p.id === myPlayerId;
             const myVote = votes[p.id];
             const color = getAvatarColor(p.colorIndex || 0);

             return (
               <div key={p.id} className={`discussion-player-row ${isMe ? 'discussion-player-row--me' : ''}`}>
                 <div className="d-player-avatar" style={{ background: `${color}30`, borderColor: color, color }}>
                    {getInitials(p.name)}
                 </div>
                 
                 <div className="d-player-info">
                   <div className="d-player-name">{p.name} {isMe && '(You)'}</div>
                   {claims[p.id] && (
                     <div className="d-player-claim">Claims: {claims[p.id]}</div>
                   )}
                 </div>

                 {!isMe && (
                   <div className="d-player-actions">
                     <button 
                       className={`d-vote-btn d-vote-btn--trust ${myVote === 'TRUST' ? 'active' : ''}`}
                       onClick={() => handleVote(p.id, 'TRUST')}
                     >
                       🟢 Trust
                     </button>
                     <button 
                       className={`d-vote-btn d-vote-btn--accuse ${myVote === 'ACCUSE' ? 'active' : ''}`}
                       onClick={() => handleVote(p.id, 'ACCUSE')}
                     >
                       🔴 Accuse
                     </button>
                   </div>
                 )}
               </div>
             );
           })}
        </div>

        <div className="discussion-footer">
          <button className="btn btn--secondary" onClick={() => setShowRoleSelector(true)}>
            📢 Claim a Role
          </button>
          {isHost && (
            <button className="btn btn--gold" onClick={() => {
                fetch('http://localhost:5001/api/room/force-action', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ code: room.code })
                }).catch(console.error);
            }}>
              Skip &gt;&gt;
            </button>
          )}
        </div>
      </div>

      {showRoleSelector && (
         <div className="claim-modal-overlay">
            <div className="claim-modal glass-card">
               <h3 className="claim-title">What role will you claim?</h3>
               <p className="claim-subtitle">This helps build alibis (or spread lies!)</p>
               <div className="claim-options">
                 {['Raja', 'Rani', 'Mantri', 'Soldier', 'Milkman', 'Gardener'].map(r => (
                   <button key={r} className="claim-btn" onClick={() => handleClaim(r)}>
                     {r}
                   </button>
                 ))}
               </div>
               <button className="claim-cancel" onClick={() => setShowRoleSelector(false)}>Cancel</button>
            </div>
         </div>
      )}

      <ChatBox players={players} myPlayerId={myPlayerId} myName={myPlayer?.name || 'Player'} />
    </div>
  );
}
