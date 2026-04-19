export default function RoleIcon({ role, size = 'md' }) {
  if (!role) return null;

  const sizes = {
    sm: 32,
    md: 56,
    lg: 80,
    xl: 120,
  };

  const px = sizes[size] || sizes.md;

  return (
    <div
      className={`glow-${role.id}`}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: px * 0.5,
        background: `${role.color}18`,
        border: `2px solid ${role.color}40`,
        flexShrink: 0,
      }}
    >
      {role.emoji}
    </div>
  );
}
