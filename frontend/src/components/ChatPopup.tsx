import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

// Player colors by position - matches TableVisualization
const PLAYER_COLORS: Record<number, string> = {
  0: 'text-orange-400',
  1: 'text-purple-400',
  2: 'text-cyan-400',
  3: 'text-lime-400',
};

interface ChatPopupProps {
  onClose: () => void;
  onSendMessage: (text: string) => void;
}

export function ChatPopup({ onClose, onSendMessage }: ChatPopupProps) {
  const { chatMessages } = useGameStore();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (text) {
      onSendMessage(text);
      setInputValue('');
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col animate-slide-up"
      data-testid="chat-popup"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neon-amber/20">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-neon-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-neon-amber text-lg font-medium">Chat</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          aria-label="Close chat"
          data-testid="chat-popup-close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMessages.length === 0 ? (
          <p className="text-gray-500 text-center mt-8">No messages yet. Start the conversation!</p>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}
            >
              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                msg.isOwn
                  ? 'bg-neon-amber/20 border border-neon-amber/30'
                  : 'bg-white/10 border border-white/10'
              }`}>
                {!msg.isOwn && (
                  <div className={`text-xs font-semibold ${PLAYER_COLORS[msg.playerPosition] || 'text-gray-400'}`}>
                    {msg.playerName}
                  </div>
                )}
                <p className="text-white break-words">{msg.text}</p>
                <div className="text-[10px] text-gray-500 text-right mt-1">
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-neon-amber/20 flex gap-2 bg-black/50">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          maxLength={200}
          className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-neon-amber/50"
          data-testid="chat-popup-input"
        />
        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="px-4 py-2 bg-neon-amber/20 border border-neon-amber/40 rounded-xl text-neon-amber hover:bg-neon-amber/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="chat-popup-send"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
