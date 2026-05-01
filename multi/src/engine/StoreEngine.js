// =============================================
// RAJA RANI: MONEY WAR — Store Engine
// All cosmetic items, categories, and coin rewards
// =============================================

// ─── Coin Rewards per game event ─────────────────────────────
export const COIN_REWARDS = {
  GAME_PLAYED:      15,   // Every completed game
  WIN_GAME:         50,   // Win overall
  CATCH_THIEF:      20,   // Police catches thief
  ESCAPE_AS_THIEF:  25,   // Thief escapes
  DAILY_BONUS:      100,  // First game of the day
};

// ─── Store Categories ─────────────────────────────────────────
export const STORE_CATEGORIES = ['All', 'Card Themes', 'Avatars', 'Titles', 'Emotes'];

// ─── Store Items ──────────────────────────────────────────────
export const STORE_ITEMS = [
  // ── Card Themes ──────────────────────────────────────
  {
    id: 'card_gold',
    name: 'Gold Royal',
    category: 'Card Themes',
    emoji: '🃏',
    price: 300,
    rarity: 'rare',
    desc: 'Gleaming gold card backs fit for a Raja.',
    preview: 'linear-gradient(135deg, #D4AF37, #FFD700, #B8860B)',
    freebie: false,
  },
  {
    id: 'card_midnight',
    name: 'Midnight Black',
    category: 'Card Themes',
    emoji: '🌑',
    price: 250,
    rarity: 'uncommon',
    desc: 'Dark as night, sharp as a blade.',
    preview: 'linear-gradient(135deg, #0f0f1a, #1a1a3e, #0f0f1a)',
    freebie: false,
  },
  {
    id: 'card_crimson',
    name: 'Crimson Fire',
    category: 'Card Themes',
    emoji: '🔥',
    price: 400,
    rarity: 'epic',
    desc: 'Blazing red card backs — only for the bold.',
    preview: 'linear-gradient(135deg, #7f1d1d, #DC2626, #7f1d1d)',
    freebie: false,
  },
  {
    id: 'card_emerald',
    name: 'Emerald Forest',
    category: 'Card Themes',
    emoji: '💎',
    price: 500,
    rarity: 'epic',
    desc: 'Rare emerald shimmer — a true collector\'s item.',
    preview: 'linear-gradient(135deg, #064e3b, #10B981, #064e3b)',
    freebie: false,
  },
  {
    id: 'card_galaxy',
    name: 'Galaxy Edition',
    category: 'Card Themes',
    emoji: '🌌',
    price: 800,
    rarity: 'legendary',
    desc: 'The cosmos itself as your card. Ultra rare.',
    preview: 'linear-gradient(135deg, #1e1b4b, #7c3aed, #4c1d95, #1e1b4b)',
    freebie: false,
  },

  // ── Avatar Frames ─────────────────────────────────────
  {
    id: 'avatar_gold_ring',
    name: 'Gold Ring',
    category: 'Avatars',
    emoji: '👑',
    price: 200,
    rarity: 'uncommon',
    desc: 'A shimmering gold ring around your avatar.',
    preview: 'rgba(212,175,55,0.9)',
    freebie: false,
  },
  {
    id: 'avatar_fire_ring',
    name: 'Fire Ring',
    category: 'Avatars',
    emoji: '🔥',
    price: 350,
    rarity: 'rare',
    desc: 'Your avatar burns with fierce energy.',
    preview: 'rgba(220,38,38,0.9)',
    freebie: false,
  },
  {
    id: 'avatar_galaxy_ring',
    name: 'Galaxy Ring',
    category: 'Avatars',
    emoji: '🌌',
    price: 700,
    rarity: 'legendary',
    desc: 'A cosmic ring — you are the universe.',
    preview: 'rgba(124,58,237,0.9)',
    freebie: false,
  },

  // ── Profile Titles ────────────────────────────────────
  {
    id: 'title_kingpin',
    name: 'Kingpin',
    category: 'Titles',
    emoji: '💼',
    price: 500,
    rarity: 'rare',
    desc: 'Display "Kingpin" under your name.',
    preview: '#D4AF37',
    freebie: false,
  },
  {
    id: 'title_thief_lord',
    name: 'Thief Lord',
    category: 'Titles',
    emoji: '🥷',
    price: 400,
    rarity: 'rare',
    desc: 'Show the world you rule the shadows.',
    preview: '#DC2626',
    freebie: false,
  },
  {
    id: 'title_detective',
    name: 'Master Detective',
    category: 'Titles',
    emoji: '🔍',
    price: 400,
    rarity: 'rare',
    desc: 'The badge of the sharpest Police.',
    preview: '#3B82F6',
    freebie: false,
  },
  {
    id: 'title_maharaja',
    name: 'Maharaja',
    category: 'Titles',
    emoji: '🏯',
    price: 2000,
    rarity: 'legendary',
    desc: 'The rarest title — reserved for true royalty.',
    preview: '#FFD700',
    freebie: false,
  },

  // ── Emote Packs ───────────────────────────────────────
  {
    id: 'emote_royal',
    name: 'Royal Pack',
    category: 'Emotes',
    emoji: '🎭',
    price: 150,
    rarity: 'common',
    desc: 'Unlock 👑 🏆 💎 🎯 emotes in chat.',
    preview: '#A78BFA',
    freebie: false,
  },
  {
    id: 'emote_savage',
    name: 'Savage Pack',
    category: 'Emotes',
    emoji: '💥',
    price: 200,
    rarity: 'uncommon',
    desc: 'Unlock 🔥 💀 ⚔️ 😈 emotes in chat.',
    preview: '#F87171',
    freebie: false,
  },

  // ── Festive Skins (Phase 6) ───────────────────────────
  {
    id: 'table_diwali',
    name: 'Diwali Night',
    category: 'Card Themes',
    emoji: '🪔',
    price: 600,
    rarity: 'epic',
    desc: 'Special edition festive theme with glowing diyas.',
    preview: 'linear-gradient(135deg, #7c2d12, #ea580c, #fcd34d)',
    freebie: false,
  },
];

// ─── Rarity config ────────────────────────────────────────────
export const RARITY_CONFIG = {
  common:    { label: 'Common',    color: '#9CA3AF', glow: 'rgba(156,163,175,0.3)' },
  uncommon:  { label: 'Uncommon',  color: '#34D399', glow: 'rgba(52,211,153,0.3)'  },
  rare:      { label: 'Rare',      color: '#60A5FA', glow: 'rgba(96,165,250,0.3)'  },
  epic:      { label: 'Epic',      color: '#A78BFA', glow: 'rgba(167,139,250,0.4)' },
  legendary: { label: 'Legendary', color: '#FBBF24', glow: 'rgba(251,191,36,0.5)'  },
};

export function getStoreItem(id) {
  return STORE_ITEMS.find(item => item.id === id) || null;
}
