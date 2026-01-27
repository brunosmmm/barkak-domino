import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

interface TurnTimerProps {
  compact?: boolean;  // Compact mode for mobile header
}

export function TurnTimer({ compact = false }: TurnTimerProps) {
  const { gameState } = useGameStore();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!gameState?.turn_timer) {
      setRemaining(null);
      return;
    }

    // Calculate initial remaining time from server timestamp
    const serverStarted = new Date(gameState.turn_timer.started_at).getTime();
    const now = Date.now();
    const elapsed = (now - serverStarted) / 1000;
    const initialRemaining = Math.max(0, gameState.turn_timer.timeout - elapsed);
    setRemaining(initialRemaining);

    // Update every 100ms for smooth countdown
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev === null || prev <= 0) return 0;
        return Math.max(0, prev - 0.1);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [gameState?.turn_timer?.started_at, gameState?.turn_timer?.timeout]);

  if (remaining === null || !gameState?.turn_timer) {
    return null;
  }

  const timeout = gameState.turn_timer.timeout;
  const percentage = (remaining / timeout) * 100;
  const isLow = remaining <= 10;
  const isCritical = remaining <= 5;
  const isYourTurn = gameState.current_turn === gameState.your_player_id;

  if (compact) {
    // Compact circular timer for mobile header
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - percentage / 100);

    return (
      <div className={`relative w-7 h-7 flex items-center justify-center ${
        isCritical && isYourTurn ? 'animate-pulse' : ''
      }`}>
        <svg className="w-7 h-7 transform -rotate-90" viewBox="0 0 24 24">
          {/* Background circle */}
          <circle
            cx="12"
            cy="12"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2"
          />
          {/* Progress circle */}
          <circle
            cx="12"
            cy="12"
            r={radius}
            fill="none"
            stroke={isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-100"
          />
        </svg>
        <span className={`absolute text-[9px] font-bold ${
          isCritical ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-white'
        }`}>
          {Math.ceil(remaining)}
        </span>
      </div>
    );
  }

  // Full timer bar display
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-medium ${
          isCritical ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-gray-400'
        }`}>
          {isYourTurn ? 'Your time' : 'Turn timer'}
        </span>
        <span className={`text-sm font-bold ${
          isCritical ? 'text-red-400 animate-pulse' : isLow ? 'text-amber-400' : 'text-white'
        }`}>
          {Math.ceil(remaining)}s
        </span>
      </div>
      <div className="h-2 bg-black/30 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-100 rounded-full ${
            isCritical ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
