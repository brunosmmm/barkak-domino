import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

export function ReactionDisplay() {
  const { activeReactions, removeReaction } = useGameStore();
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Auto-remove reactions after 3 seconds with proper cleanup
  useEffect(() => {
    activeReactions.forEach((reaction) => {
      // Only set timer if not already tracking this reaction
      if (!timersRef.current.has(reaction.id)) {
        const timer = setTimeout(() => {
          removeReaction(reaction.id);
          timersRef.current.delete(reaction.id);
        }, 3000);
        timersRef.current.set(reaction.id, timer);
      }
    });

    // Cleanup timers for removed reactions
    return () => {
      timersRef.current.forEach((timer, id) => {
        if (!activeReactions.find(r => r.id === id)) {
          clearTimeout(timer);
          timersRef.current.delete(id);
        }
      });
    };
  }, [activeReactions, removeReaction]);

  if (activeReactions.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden" data-testid="reaction-display">
      {activeReactions.map((reaction, index) => (
        <div
          key={reaction.id}
          data-testid={`reaction-bubble-${index}`}
          data-player-id={reaction.playerId}
          data-emoji={reaction.emoji}
          className="absolute animate-bounce"
          style={{
            // Stagger positions based on index (no animation delay)
            top: `${20 + (index % 3) * 15}%`,
            left: `${10 + ((index * 20) % 80)}%`,
          }}
        >
          <div className="bg-black/70 backdrop-blur rounded-xl px-4 py-2 shadow-2xl border border-white/20 animate-in fade-in zoom-in slide-in-from-bottom-4 duration-150">
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
