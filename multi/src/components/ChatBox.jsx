import { useState, useRef, useEffect, useCallback } from 'react';
import { useGame, getSharedSocket } from '../context/GameContext';
import { API_CHAT_SEND } from '../services/api';
import './ChatBox.css';

// FIX BUG-03: Use shared socket singleton instead of creating a second connection

const QUICK_MESSAGES = [
  "Good luck! 🍀",
  "Nice move! 👏",
  "GG! 🎮",
  "Hmm... 🤔",
  "Let's go! 🔥",
  "No way! 😱",
  "LOL 😂",
  "Well played 👑",
];

const EMOJI_LIST = [
  '😀', '😂', '🤣', '😍', '🤩', '😎', '🤔', '😏',
  '😤', '😠', '🤯', '😱', '🥳', '🤑', '😈', '👻',
  '👑', '👸', '🕵️', '👮', '⚔️', '🛡️', '💰', '💎',
  '🎯', '🎮', '🃏', '🏆', '🔥', '💥', '⚡', '✨',
  '👍', '👎', '👏', '🙌', '🤝', '💪', '🎉', '🍀',
  '❤️', '💔', '💯', '🚨', '🔒', '🗝️', '⏰', '🎭',
];

export default function ChatBox({ players = [], myPlayerId, myName = 'You' }) {
  const { room } = useGame();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'sys-1',
      type: 'system',
      text: '🎮 Game chat started! Say hello to your opponents.',
      time: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Sockets for Live Chat — using shared socket (FIX BUG-03)
  useEffect(() => {
    if (!room) return;
    const socket = getSharedSocket();
    if (!socket) return;
    
    // Join channel
    socket.emit('join_room', { code: room.code, playerId: myPlayerId });

    // Listen for new messages
    const handleRecieve = (msg) => {
      setMessages(prev => {
        // Prevent duplicate self-messages
        if (prev.find(m => m.id === msg.id)) return prev;
        
        if (!isOpen) setUnreadCount(c => c + 1);
        return [...prev, msg];
      });
    };

    socket.on('receive_message', handleRecieve);

    return () => {
      socket.off('receive_message', handleRecieve);
    };
  }, [room, isOpen, myPlayerId]);

  const addMessage = useCallback(async (text, isEmoji = false) => {
    if (!text.trim() || !room) return;
    const socket = getSharedSocket();

    const newMsg = {
      id: `msg-${Date.now()}-${Math.random()}`,
      senderId: myPlayerId,
      senderName: myName,
      text: text.trim(),
      isEmoji,
      time: new Date(),
      isSelf: true,
    };

    // Optimistically update
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setShowEmojis(false);

    // Emit over shared socket (FIX BUG-03)
    if (socket) {
      socket.emit('send_message', { code: room.code, message: { ...newMsg, isSelf: false } });
    }

    // Also backup to DB via API 
    try {
      await fetch(API_CHAT_SEND, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: room.code, message: { ...newMsg, isSelf: false } })
      });
    } catch (err) {
      console.error("Failed to post message backup", err);
    }
  }, [myPlayerId, myName, room]);

  const handleSend = (e) => {
    e?.preventDefault();
    addMessage(inputText);
  };

  const handleQuickMessage = (msg) => {
    addMessage(msg);
  };

  const handleEmojiClick = (emoji) => {
    addMessage(emoji, true);
  };

  const handleMicToggle = () => {
    setIsRecording(prev => !prev);
    if (!isRecording) {
      // Simulate recording
      setTimeout(() => {
        setIsRecording(false);
        addMessage("🎤 Voice message (coming soon!)");
      }, 2000);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getPlayerColor = (senderId) => {
    const player = players.find(p => p.id === senderId);
    const colors = ['#D4AF37', '#E91E8B', '#7B2FF7', '#059669', '#2563EB', '#DC2626', '#0891B2', '#65A30D'];
    return colors[(player?.colorIndex || 0) % colors.length];
  };

  return (
    <>
      {/* Toggle button */}
      <button
        className="chat-toggle-btn"
        onClick={() => setIsOpen(prev => !prev)}
        id="chat-toggle-btn"
        aria-label="Toggle chat"
      >
        {isOpen ? '✕' : '💬'}
        {unreadCount > 0 && !isOpen && (
          <span className="chat-badge-count">{unreadCount}</span>
        )}
      </button>

      {/* Chat panel */}
      <div className={`chat-panel ${isOpen ? 'chat-panel--open' : ''}`}>
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-title">
            💬 Game Chat
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              {players.length} players
            </span>
          </div>
          <button className="chat-close-btn" onClick={() => setIsOpen(false)} aria-label="Close chat">
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map(msg => {
            if (msg.type === 'system') {
              return (
                <div key={msg.id} style={{
                  textAlign: 'center',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  padding: '8px 0',
                  fontStyle: 'italic',
                }}>
                  {msg.text}
                </div>
              );
            }

            const color = getPlayerColor(msg.senderId);
            const initial = msg.senderName?.charAt(0)?.toUpperCase() || '?';

            const isSelf = msg.senderId === myPlayerId;
            return (
              <div key={msg.id} className={`chat-msg ${isSelf ? 'chat-msg--self' : ''}`}>
                <div
                  className="chat-msg-avatar"
                  style={{ background: `${color}22`, color: color, border: `2px solid ${color}50` }}
                >
                  {initial}
                </div>
                <div className="chat-msg-content">
                  <div className="chat-msg-name" style={{ color }}>{msg.senderName}</div>
                  <div className={`chat-msg-bubble ${msg.isEmoji ? 'chat-msg-bubble--emoji' : ''}`}>
                    {msg.text}
                  </div>
                  <div className="chat-msg-time">{formatTime(msg.time)}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick messages */}
        <div className="chat-quick-bar">
          {QUICK_MESSAGES.map((msg, i) => (
            <button
              key={i}
              className="chat-quick-btn"
              onClick={() => handleQuickMessage(msg)}
            >
              {msg}
            </button>
          ))}
        </div>

        {/* Emoji grid (togglable) */}
        {showEmojis && (
          <div className="chat-emoji-grid">
            {EMOJI_LIST.map((emoji, i) => (
              <button
                key={i}
                className="chat-emoji-btn"
                onClick={() => handleEmojiClick(emoji)}
                aria-label={`Send ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="chat-input-bar">
          {/* Emoji toggle */}
          <button
            className={`chat-action-btn ${showEmojis ? 'chat-action-btn--active' : ''}`}
            onClick={() => setShowEmojis(prev => !prev)}
            aria-label="Toggle emoji picker"
          >
            😊
          </button>

          {/* Mic button */}
          <button
            className={`chat-action-btn ${isRecording ? 'chat-action-btn--active' : ''}`}
            onClick={handleMicToggle}
            aria-label="Voice message"
            style={isRecording ? { color: 'var(--color-danger)' } : {}}
          >
            🎤
          </button>

          {isRecording ? (
            <div className="chat-mic-recording">
              <div className="chat-mic-dot" />
              Recording...
            </div>
          ) : (
            <form onSubmit={handleSend} style={{ flex: 1, display: 'flex' }}>
              <input
                ref={chatInputRef}
                className="chat-input"
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                maxLength={200}
                id="chat-input"
              />
            </form>
          )}

          {/* Send */}
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!inputText.trim() && !isRecording}
            aria-label="Send message"
          >
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
