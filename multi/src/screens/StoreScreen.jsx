import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useToast } from '../components/Toast';
import AnimatedBackground from '../components/AnimatedBackground';
import { STORE_ITEMS, STORE_CATEGORIES, RARITY_CONFIG } from '../engine/StoreEngine';
import { API_USER_PROFILE, API_STORE_PURCHASE, API_STORE_EQUIP } from '../services/api';
import { playClick, playCoin } from '../engine/SoundEngine';
import './StoreScreen.css';
import { motion } from 'framer-motion';


export default function StoreScreen() {
  const { user } = useGame();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('All');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchProfile();
  }, [user]);

  const fetchProfile = () => {
    const myId = user.id || user.googleId || user._id;
    fetch(API_USER_PROFILE(myId))
      .then(res => res.json())
      .then(data => {
        if (data.success) setStats(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handlePurchase = async (item) => {
    if (processingId) return;
    if ((stats?.rajaCoins || 0) < item.price) {
      toast.error('Not enough Raja Coins! Play games to earn more.');
      return;
    }

    setProcessingId(item.id);
    try {
      const res = await fetch(API_STORE_PURCHASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id || user.googleId || user._id, itemId: item.id, price: item.price }),
      });
      const data = await res.json();
      if (data.success) {
        playCoin();
        toast.success(`Purchased ${item.name}!`);
        setStats(prev => ({ ...prev, rajaCoins: data.coins, ownedCosmetics: data.owned }));
      } else {
        toast.error(data.message || 'Purchase failed.');
      }
    } catch (err) {
      toast.error('Network error during purchase.');
    }
    setProcessingId(null);
  };

  const handleEquip = async (item) => {
    if (processingId) return;
    setProcessingId(item.id);
    try {
      const res = await fetch(API_STORE_EQUIP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id || user.googleId || user._id, itemId: item.id }),
      });
      const data = await res.json();
      if (data.success) {
        playClick();
        toast.info(`Equipped ${item.name}`);
        setStats(prev => ({ ...prev, equippedCosmetic: data.equipped }));
      } else {
        toast.error(data.message || 'Equip failed.');
      }
    } catch (err) {
      toast.error('Network error during equip.');
    }
    setProcessingId(null);
  };

  if (!user || loading) return null;

  const coins = stats?.rajaCoins || 0;
  const owned = stats?.ownedCosmetics || [];
  const equipped = stats?.equippedCosmetic;

  const filteredItems = activeTab === 'All' 
    ? STORE_ITEMS 
    : STORE_ITEMS.filter(i => i.category === activeTab);

  return (
    <div className="store-screen">
      <AnimatedBackground />

      <div className="store-container">
        {/* Header */}
        <div className="store-header">
          <button className="store-back" onClick={() => { playClick(); navigate('/home'); }}>← Back</button>
          <div className="store-header-title">
            <h1 className="title title--md text-gold">Royal Store</h1>
            <div className="store-coin-balance">
              <span className="coin-icon">💰</span>
              <span className="coin-amount">{coins.toLocaleString()}</span>
            </div>
          </div>
          <p className="store-subtitle">Spend Raja Coins to unlock exclusive cosmetics.</p>
        </div>

        {/* Categories */}
        <div className="store-tabs scroll-x">
          {STORE_CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`store-tab ${activeTab === cat ? 'store-tab--active' : ''}`}
              onClick={() => { playClick(); setActiveTab(cat); }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="store-grid">
          {filteredItems.map((item, i) => {
            const isOwned = owned.includes(item.id);
            const isEquipped = equipped === item.id;
            const rarity = RARITY_CONFIG[item.rarity];
            const isProcessing = processingId === item.id;

            return (
              <motion.div
                key={item.id}
                className={`store-item glass-card ${isOwned ? 'store-item--owned' : ''} ${isEquipped ? 'store-item--equipped' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{ borderColor: isEquipped ? rarity.color : undefined }}
              >
                <div className="store-item-preview" style={{ background: item.preview, boxShadow: `inset 0 0 40px ${rarity.glow}` }}>
                  <span className="store-item-emoji">{item.emoji}</span>
                  <div className="store-item-rarity" style={{ color: rarity.color }}>{rarity.label}</div>
                </div>

                <div className="store-item-info">
                  <h3 className="store-item-name">{item.name}</h3>
                  <p className="store-item-desc">{item.desc}</p>
                </div>

                <div className="store-item-action">
                  {isOwned ? (
                    <button 
                      className={`btn ${isEquipped ? 'btn--secondary' : 'btn--outline'}`}
                      onClick={() => handleEquip(item)}
                      disabled={isEquipped || isProcessing}
                    >
                      {isEquipped ? '✓ Equipped' : 'Equip'}
                    </button>
                  ) : (
                    <button 
                      className={`btn btn--gold ${coins < item.price ? 'btn--disabled' : ''}`}
                      onClick={() => handlePurchase(item)}
                      disabled={coins < item.price || isProcessing}
                    >
                      <span className="price-tag">💰 {item.price}</span>
                      {isProcessing ? '...' : 'Buy'}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
