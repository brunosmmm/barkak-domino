import { useState } from 'react';

interface ReactionPickerProps {
  onReaction: (emoji: string) => void;
}

const REACTIONS = [
  { emoji: '😂', label: 'Laughing' },
  { emoji: '😤', label: 'Angry' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💀', label: 'Dead' },
  { emoji: '🤡', label: 'Clown' },
  { emoji: '👑', label: 'Crown' },
  { emoji: '🎯', label: 'Bullseye' },
  { emoji: '💪', label: 'Strong' },
  { emoji: '😈', label: 'Devil' },
  { emoji: '🙏', label: 'Pray' },
  { emoji: '👎', label: 'Thumbs down' },
  { emoji: '🍀', label: 'Lucky' },
];

export function ReactionPicker({ onReaction }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const handleReaction = (emoji: string) => {
    if (cooldown) return;

    onReaction(emoji);
    setIsOpen(false);
    setCooldown(true);

    // 2 second cooldown between reactions
    setTimeout(() => setCooldown(false), 2000);
  };

  return (
    <div className="relative inline-block" data-testid="reaction-picker">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={cooldown}
        data-testid="reaction-toggle-btn"
        data-cooldown={cooldown}
        className={`w-12 h-12 rounded-full text-2xl transition-all
          ${cooldown
            ? 'bg-gray-600 cursor-not-allowed opacity-50'
            : 'bg-neon-amber hover:bg-neon-amber-glow hover:scale-110 shadow-neon-amber'
          }
          shadow-lg`}
        title={cooldown ? 'Wait...' : 'Send reaction'}
      >
        {cooldown ? '⏳' : '😎'}
      </button>

      {/* Emoji picker popup */}
      {isOpen && !cooldown && (
        <div
          data-testid="reaction-popup"
          className="absolute z-50 bg-gray-900/95 backdrop-blur rounded-xl p-3 shadow-2xl border border-gray-700"
          style={{
            bottom: '60px',
            right: '0',
            width: '200px'
          }}
        >
          <div className="flex flex-wrap gap-2">
            {REACTIONS.map(({ emoji, label }) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                data-testid={`reaction-${label.toLowerCase().replace(' ', '-')}`}
                data-emoji={emoji}
                className="w-11 h-11 text-2xl hover:bg-white/20 rounded-lg transition-transform hover:scale-110 flex items-center justify-center"
                title={label}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
