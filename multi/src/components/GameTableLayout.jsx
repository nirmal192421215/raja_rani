import CardComponent from './CardComponent';
import { getAvatarColor, getInitials } from '../engine/GameEngine';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function GameTableLayout({
  players = [],
  myPlayerId,
  showRoles = false,
  onPlayerClick,
  selectedPlayerId,
  centerContent,
  children,
}) {
  const { activeEmotes, totals = {} } = useGame();

  const myPlayer = players.find(p => p.id === myPlayerId);
  const otherPlayers = players.filter(p => p.id !== myPlayerId);
  const count = otherPlayers.length; // number of opponents

  /**
   * Place opponents evenly on the TOP HALF of an ellipse.
   * angle=0 is right, angle=180 is left.
   * We go from 20° to 160° (top arc) evenly spaced.
   */
  const getPosition = (index, total) => {
    // arc from 210° to 330° (top semi-circle, left-to-right)
    const startAngle = 210;
    const endAngle = 330;
    const range = endAngle - startAngle;
    const step = total <= 1 ? 0 : range / (total - 1);
    const angleDeg = startAngle + index * step;
    const angleRad = (angleDeg * Math.PI) / 180;

    // Ellipse radii as percentage of container
    const rx = 40; // horizontal radius %
    const ry = 34; // vertical radius %

    const x = 50 + rx * Math.cos(angleRad);
    const y = 46 + ry * Math.sin(angleRad); // shifted up slightly
    return { x, y };
  };

  const renderSeat = (player, index, total, isMe = false) => {
    if (!player) return null;

    const color = getAvatarColor(player.colorIndex || 0);
    const isSelected = selectedPlayerId === player.id;
    const canClick = !!onPlayerClick && !isMe;

    let style = {};
    if (isMe) {
      // Always at bottom center, with enough space from center panel
      style = {
        position: 'absolute',
        bottom: '4%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 4,
      };
    } else {
      const { x, y } = getPosition(index, total);
      style = {
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 4,
      };
    }

    return (
      <div
        key={player.id}
        className={`gtl-seat ${isMe ? 'gtl-seat--me' : ''} ${isSelected ? 'gtl-seat--selected' : ''}`}
        style={{
          ...style,
          cursor: canClick ? 'pointer' : 'default',
        }}
        onClick={canClick ? () => onPlayerClick(player.id) : undefined}
      >
        {/* Card — above avatar for opponents, below for me */}
        {!isMe && (
          <div className="gtl-card">
            <CardComponent
              size="sm"
              flipped={showRoles}
              role={showRoles ? player.roleData : null}
              animated
              dealDelay={0.1 * index}
            />
          </div>
        )}

        {/* Avatar */}
        <div
          className="gtl-avatar"
          style={{
            background: `${color}30`,
            color: color,
            borderColor: isSelected ? '#7B2FF7' : `${color}80`,
            boxShadow: isSelected
              ? `0 0 20px rgba(123,47,247,0.6), 0 2px 12px rgba(0,0,0,0.4)`
              : `0 2px 12px rgba(0,0,0,0.3)`,
          }}
        >
          {getInitials(player.name)}
          {player.isBot && (
            <span className="gtl-bot-badge">🤖</span>
          )}
        </div>

        {/* Floating emote */}
        <AnimatePresence>
          {activeEmotes?.[player.id] && (
            <motion.div
              className="gtl-emote"
              initial={{ y: 0, opacity: 0, scale: 0.5 }}
              animate={{ y: -50, opacity: 1, scale: 2 }}
              exit={{ y: -80, opacity: 0, scale: 0.8 }}
              transition={{ duration: 1.5, type: 'spring' }}
            >
              {activeEmotes[player.id]}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Name */}
        <div className="gtl-name">
          {isMe ? `${player.name} (You)` : player.name}
        </div>

        {/* Money badge */}
        <div className="gtl-money">
          ₹{(totals[player.id] || 0).toLocaleString()}
        </div>

        {/* Role badge */}
        {showRoles && player.roleData && (
          <div
            className="gtl-role"
            style={{
              background: `${player.roleData.color}20`,
              color: player.roleData.color,
              border: `1px solid ${player.roleData.color}60`,
            }}
          >
            {player.roleData.emoji} {player.roleData.name}
          </div>
        )}

        {/* My card at bottom */}
        {isMe && (
          <div className="gtl-card gtl-card--me">
            <CardComponent
              size="md"
              flipped={showRoles}
              role={showRoles ? player.roleData : null}
              animated
              dealDelay={0.3}
            />
          </div>
        )}

        {/* Selection ring */}
        {isSelected && (
          <div className="gtl-selection-ring" />
        )}
      </div>
    );
  };

  return (
    <div className="gtl-table">
      {/* Ellipse decorative ring */}
      <div className="gtl-ellipse-ring" />

      {/* Center panel — timer, role info, buttons */}
      <div className="gtl-center">
        {centerContent}
      </div>

      {/* Opponents around the top arc */}
      {otherPlayers.map((p, i) => renderSeat(p, i, otherPlayers.length, false))}

      {/* Me at bottom */}
      {myPlayer && renderSeat(myPlayer, 0, 1, true)}

      {children}
    </div>
  );
}
