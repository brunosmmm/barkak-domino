import { useGameStore } from '../store/gameStore';

export function PassNotification() {
  const { passNotification } = useGameStore();

  if (!passNotification) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
      <div className="bg-red-600/90 backdrop-blur border-2 border-red-400 rounded-xl px-8 py-5 shadow-2xl shadow-red-500/50">
        <div className="text-center">
          <p className="text-4xl mb-2">🙈</p>
          <p className="text-yellow-300 font-black text-2xl uppercase tracking-wide">
            {passNotification.playerName}
          </p>
          <p className="text-white font-bold text-lg mt-1">PASSED!</p>
          <p className="text-red-200 text-xs mt-2 italic">No valid moves available</p>
        </div>
      </div>
    </div>
  );
}
