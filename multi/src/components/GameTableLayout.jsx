import CardComponent from './CardComponent';
import { getAvatarColor, getInitials } from '../engine/GameEngine';

export default function GameTableLayout({
  players = [],
  myPlayerId,
  showRoles = false,
  onPlayerClick,
  selectedPlayerId,
  centerContent,
  children,
}) {
  // Find my player and others
  const myPlayer = players.find(p => p.id === myPlayerId);
  const otherPlayers = players.filter(p => p.id !== myPlayerId);

  // Assign positions: bottom = me, top = first other, left = second, right = third
  const positions = ['top', 'left', 'right'];
  const seatPlayers = positions.map((pos, i) => ({
    position: pos,
    player: otherPlayers[i] || null,
  }));

  // Extra players beyond 4
  const extraPlayers = otherPlayers.slice(3);

  const renderSeat = (player, position) => {
    if (!player) return null;

    const color = getAvatarColor(player.colorIndex || 0);
    const isSelected = selectedPlayerId === player.id;
    const canClick = !!onPlayerClick;

    const isVertical = position === 'left' || position === 'right';
    const cardCount = Math.min(3, Math.max(1, Math.floor(players.length / 2)));

    return (
      <div
        className={`game-table-seat game-table-seat--${position}`}
        key={player.id}
        onClick={canClick ? () => onPlayerClick(player.id) : undefined}
        style={{
          cursor: canClick ? 'pointer' : 'default',
          filter: isSelected ? 'brightness(1.2)' : 'none',
        }}
      >
        {/* Avatar */}
        <div
          className="seat-avatar"
          style={{
            background: `${color}30`,
            color: color,
            borderColor: isSelected ? '#7B2FF7' : `${color}80`,
            boxShadow: isSelected
              ? `0 0 20px rgba(123,47,247,0.5), 0 2px 12px rgba(0,0,0,0.3)`
              : `0 2px 12px rgba(0,0,0,0.3)`,
          }}
        >
          {getInitials(player.name)}
          {player.isBot && (
            <span style={{
              position: 'absolute', bottom: -2, right: -2,
              fontSize: '0.6rem', background: 'rgba(0,0,0,0.6)',
              borderRadius: '50%', width: 16, height: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>🤖</span>
          )}
        </div>

        {/* Name */}
        <div className="seat-name">{player.name}</div>

        {/* Role badge if revealed */}
        {showRoles && player.roleData && (
          <div
            className="seat-role-badge"
            style={{
              background: `${player.roleData.color}25`,
              color: player.roleData.color,
              border: `1px solid ${player.roleData.color}50`,
            }}
          >
            {player.roleData.emoji} {player.roleData.name}
          </div>
        )}

        {/* Card fan */}
        <div className={`card-fan ${isVertical ? 'card-fan--vertical' : 'card-fan--horizontal'}`}>
          {Array.from({ length: cardCount }, (_, i) => (
            <div
              key={i}
              className="card-fan-item"
              style={{
                transform: isVertical
                  ? `rotate(${(i - 1) * 5}deg)`
                  : `rotate(${(i - Math.floor(cardCount / 2)) * 8}deg)`,
              }}
            >
              <CardComponent
                size="sm"
                flipped={showRoles}
                role={showRoles ? player.roleData : null}
                animated
                dealDelay={i * 0.15}
              />
            </div>
          ))}
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div style={{
            position: 'absolute',
            inset: -6,
            border: '2px solid rgba(123, 47, 247, 0.5)',
            borderRadius: '16px',
            animation: 'cardGlowPulse 1.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </div>
    );
  };

  return (
    <div className="game-table">
      {/* Top seat */}
      {renderSeat(seatPlayers[0]?.player, 'top')}

      {/* Left seat */}
      {renderSeat(seatPlayers[1]?.player, 'left')}

      {/* Right seat */}
      {renderSeat(seatPlayers[2]?.player, 'right')}

      {/* Center content (Bid buttons, timer, etc.) */}
      <div className="game-table-center">
        {centerContent}
      </div>

      {/* Bottom seat (ME) */}
      {myPlayer && (
        <div className="game-table-seat game-table-seat--bottom">
          <div className={`card-fan card-fan--horizontal`}>
            {Array.from({ length: Math.min(5, players.length) }, (_, i) => (
              <div
                key={i}
                className="card-fan-item"
                style={{
                  transform: `rotate(${(i - 2) * 6}deg) translateY(${Math.abs(i - 2) * 4}px)`,
                }}
              >
                <CardComponent
                  size="md"
                  flipped={showRoles}
                  role={showRoles ? myPlayer.roleData : null}
                  animated
                  dealDelay={0.3 + i * 0.1}
                />
              </div>
            ))}
          </div>

          <div className="seat-avatar" style={{
            background: `${getAvatarColor(myPlayer.colorIndex || 0)}30`,
            color: getAvatarColor(myPlayer.colorIndex || 0),
            borderColor: `${getAvatarColor(myPlayer.colorIndex || 0)}80`,
          }}>
            {getInitials(myPlayer.name)}
          </div>
          <div className="seat-name">{myPlayer.name} (You)</div>

          {showRoles && myPlayer.roleData && (
            <div
              className="seat-role-badge"
              style={{
                background: `${myPlayer.roleData.color}25`,
                color: myPlayer.roleData.color,
                border: `1px solid ${myPlayer.roleData.color}50`,
              }}
            >
              {myPlayer.roleData.emoji} {myPlayer.roleData.name}
            </div>
          )}
        </div>
      )}

      {/* Extra players beyond 4 — show as mini seats along the table  */}
      {/* FIX BUG-09: Was pointerEvents:'none' on parent, blocking Police from clicking */}
      {extraPlayers.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          gap: '60px',
          zIndex: 2,
        }}>
          {extraPlayers.map((ep, i) => {
            const isSelected = selectedPlayerId === ep.id;
            const epColor = getAvatarColor(ep.colorIndex || 0);
            return (
              <div
                key={ep.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  opacity: 0.8,
                  cursor: onPlayerClick ? 'pointer' : 'default',
                  filter: isSelected ? 'brightness(1.2)' : 'none',
                  position: 'relative',
                }}
                onClick={onPlayerClick ? () => onPlayerClick(ep.id) : undefined}
              >
                <div className="seat-avatar" style={{
                  width: 36, height: 36, fontSize: '0.8rem',
                  background: `${epColor}30`,
                  color: epColor,
                  borderColor: isSelected ? '#7B2FF7' : `${epColor}80`,
                  boxShadow: isSelected
                    ? `0 0 20px rgba(123,47,247,0.5), 0 2px 12px rgba(0,0,0,0.3)`
                    : `0 2px 12px rgba(0,0,0,0.3)`,
                }}>
                  {getInitials(ep.name)}
                </div>
                <span className="seat-name" style={{ fontSize: '0.6rem' }}>{ep.name}</span>

                {/* Role badge if revealed */}
                {showRoles && ep.roleData && (
                  <div
                    className="seat-role-badge"
                    style={{
                      background: `${ep.roleData.color}25`,
                      color: ep.roleData.color,
                      border: `1px solid ${ep.roleData.color}50`,
                      fontSize: '0.55rem',
                      padding: '2px 6px',
                    }}
                  >
                    {ep.roleData.emoji} {ep.roleData.name}
                  </div>
                )}

                {/* Selection indicator */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    inset: -4,
                    border: '2px solid rgba(123, 47, 247, 0.5)',
                    borderRadius: '12px',
                    animation: 'cardGlowPulse 1.5s ease-in-out infinite',
                    pointerEvents: 'none',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {children}
    </div>
  );
}
