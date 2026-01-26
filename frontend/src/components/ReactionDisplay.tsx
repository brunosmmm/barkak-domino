import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function ReactionDisplay() {
  const { activeReactions, removeReaction } = useGameStore();

  // Auto-remove reactions after 3 seconds
  useEffect(() => {
    activeReactions.forEach((reaction) => {
      const timer = setTimeout(() => {
        removeReaction(reaction.id);
      }, 3000);
      return () => clearTimeout(timer);
    });
  }, [activeReactions, removeReaction]);

  if (activeReactions.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {activeReactions.map((reaction, index) => (
        <div
          key={reaction.id}
          className="absolute animate-bounce"
          style={{
            // Stagger positions based on index
            top: `${20 + (index % 3) * 15}%`,
            left: `${10 + ((index * 20) % 80)}%`,
            animationDelay: `${index * 100}ms`,
          }}
        >
          <div className="bg-black/70 backdrop-blur rounded-xl px-4 py-2 shadow-2xl border border-white/20 animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300">
            <div className="text-5xl mb-1 animate-pulse">{reaction.emoji}</div>
            <div className="text-white text-xs text-center font-medium truncate max-w-[100px]">
              {reaction.playerName}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
