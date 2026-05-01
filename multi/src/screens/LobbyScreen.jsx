import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useToast } from '../components/Toast';
import AnimatedBackground from '../components/AnimatedBackground';
import PlayerCard from '../components/PlayerCard';
import CardComponent from '../components/CardComponent';
import ChatBox from '../components/ChatBox';
import './LobbyScreen.css';

export default function LobbyScreen() {
  const { room, players, isHost, addBot, startGame, phase, myPlayerId, user } = useGame();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (phase === 'roleReveal') {
      navigate('/role-reveal');
    }
  }, [phase, navigate]);

  if (!room) {
    navigate('/home');
    return null;
  }

  const canStart = players.length >= 2;

  const handleStart = async () => {
    await startGame();
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(room.code);
    toast.success(`Room code “${room.code}” copied!`);
  };

  const handleShareLink = () => {
    const link = `${window.location.origin}/home?join=${room.code}`;
    navigator.clipboard?.writeText(link);
    toast.success('Invite link copied! Share it with friends 😊');
  };

  return (
    <div className="lobby-screen">
      <AnimatedBackground />

      <div className="lobby-content">
        <div className="lobby-header">
          <h1 className="title title--md" style={{ color: 'var(--text-on-dark)' }}>
            <span className="text-gold">Game Lobby</span>
          </h1>
          <div className="lobby-badges">
            <span className="badge badge--gold">🎯 {room.totalRounds} Rounds</span>
            <span className="badge badge--purple">👥 {players.length}/10</span>
          </div>
        </div>

        <div className="room-code" onClick={handleCopyCode} title="Click to copy" id="room-code-display">
          {room.code}
        </div>
        <div className="lobby-code-actions">
          <p className="lobby-code-hint">Tap code to copy · Share with friends</p>
          <button className="lobby-share-btn" onClick={handleShareLink} id="share-invite-btn">
            🔗 Copy Invite Link
          </button>
        </div>

        <div className="lobby-players-section glass-card">
          <div className="lobby-players-header">
            <span className="lobby-players-title">⚔️ Players</span>
            {isHost && (
              <button
                className="lobby-add-bot"
                onClick={addBot}
                disabled={players.length >= 10}
                id="add-bot-btn"
              >
                🤖 Add Bot
              </button>
            )}
          </div>

          <div className="player-list">
            {players.map((player, i) => (
              <div
                key={player.id}
                className="player-join-anim"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <PlayerCard player={player} />
              </div>
            ))}
          </div>
        </div>

        <div className="lobby-bottom">
          {!canStart && (
            <p className="lobby-min-notice">
              ⚠️ Need at least 2 players to start
            </p>
          )}

          {isHost && (
            <button
              className={`btn btn--gold btn--lg ${canStart ? 'btn--pulse' : ''}`}
              onClick={handleStart}
              disabled={!canStart}
              id="start-game-btn"
            >
              🎮 Start Game
            </button>
          )}

          {!isHost && (
            <div className="glass-card text-center">
              <div className="lobby-waiting-icon">⏳</div>
              <p className="subtitle" style={{ color: 'var(--text-muted)' }}>Waiting for host to start the game...</p>
            </div>
          )}
        </div>
      </div>

      <ChatBox
        players={players}
        myPlayerId={myPlayerId}
        myName={user?.name || 'Player'}
      />
    </div>
  );
}
