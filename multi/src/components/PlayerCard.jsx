import { getAvatarColor, getInitials } from '../engine/GameEngine';

export default function PlayerCard({
  player,
  selectable = false,
  selected = false,
  showRole = false,
  showMoney = false,
  moneyChange = null,
  onClick,
  rank,
}) {
  const color = getAvatarColor(player.colorIndex || 0);

  let className = 'player-item';
  if (selectable) className += ' player-item--selectable';
  if (selected) className += ' player-item--selected';
  if (rank === 1) className += ' player-item--highlight';

  return (
    <div className={className} onClick={selectable ? onClick : undefined} role={selectable ? 'button' : undefined}>
      {rank && (
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '1rem',
          color: rank === 1 ? '#F59E0B' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'var(--text-muted)',
          width: '28px',
          textAlign: 'center',
        }}>
          {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
        </span>
      )}

      <div
        className="player-avatar"
        style={{ background: `${color}22`, color: color, border: `2px solid ${color}40` }}
      >
        {player.roleData && showRole ? player.roleData.emoji : getInitials(player.name)}
      </div>

      <div className="player-info">
        <div className="player-name">
          {player.name}
          {player.isBot && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>🤖</span>}
          {player.isHost && <span style={{ color: 'var(--color-gold)', fontSize: '0.75rem', marginLeft: '6px' }}>👑</span>}
        </div>
        {showRole && player.roleData && (
          <div className="player-role" style={{ color: player.roleData.color }}>
            {player.roleData.emoji} {player.roleData.name}
          </div>
        )}
      </div>

      {showMoney && (
        <div style={{ textAlign: 'right' }}>
          <div className="player-money">₹{(player.roundMoney ?? player.totalMoney ?? 0).toLocaleString()}</div>
          {moneyChange !== null && moneyChange !== undefined && (
            <div className={`money-change ${moneyChange >= 0 ? 'money-change--positive' : 'money-change--negative'}`}>
              {moneyChange >= 0 ? '+' : ''}₹{moneyChange}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
