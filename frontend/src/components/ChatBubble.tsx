import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

// Player colors by position - matches TableVisualization
const PLAYER_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: 'bg-orange-400/20', border: 'border-orange-400/50', text: 'text-orange-400' },
  1: { bg: 'bg-purple-400/20', border: 'border-purple-400/50', text: 'text-purple-400' },
  2: { bg: 'bg-cyan-400/20', border: 'border-cyan-400/50', text: 'text-cyan-400' },
  3: { bg: 'bg-lime-400/20', border: 'border-lime-400/50', text: 'text-lime-400' },
};

export function ChatBubble() {
  const { activeChatBubbles, removeChatBubble } = useGameStore();
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Auto-remove bubbles after 4 seconds
  useEffect(() => {
    activeChatBubbles.forEach((bubble) => {
      if (!timersRef.current.has(bubble.id)) {
        const timer = setTimeout(() => {
          removeChatBubble(bubble.id);
          timersRef.current.delete(bubble.id);
        }, 4000);
        timersRef.current.set(bubble.id, timer);
      }
    });

    // Cleanup timers for removed bubbles
    return () => {
      timersRef.current.forEach((timer, id) => {
        if (!activeChatBubbles.find(b => b.id === id)) {
          clearTimeout(timer);
          timersRef.current.delete(id);
        }
      });
    };
  }, [activeChatBubbles, removeChatBubble]);

  if (activeChatBubbles.length === 0) return null;

  return (
    <div className="lg:hidden fixed top-20 left-4 z-[90] pointer-events-none space-y-2" data-testid="chat-bubbles">
      {activeChatBubbles.slice(-3).map((bubble, index) => {
        const colors = PLAYER_COLORS[bubble.playerPosition] || PLAYER_COLORS[0];
        return (
          <div
            key={bubble.id}
            className={`animate-slide-in-left ${colors.bg} ${colors.border} border backdrop-blur-md rounded-xl px-3 py-2 shadow-lg max-w-[80vw]`}
            style={{
              animationDelay: `${index * 50}ms`,
            }}
            data-testid={`chat-bubble-${index}`}
          >
            <div className={`text-xs font-semibold ${colors.text}`}>
              {bubble.playerName}
            </div>
            <p className="text-white text-sm break-words line-clamp-2">
              {bubble.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
