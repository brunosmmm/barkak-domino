import { useGameStore } from '../store/gameStore';

export function PassNotification() {
  const { passNotification } = useGameStore();

  if (!passNotification) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
      <div className="bg-red-600/90 backdrop-blur border-2 border-red-400 rounded-xl px-6 py-4 shadow-2xl shadow-red-500/50">
        <div className="text-center">
          <p className="text-3xl mb-1">🚫</p>
          <p className="text-white font-bold text-lg">PASS!</p>
          <p className="text-red-200 text-sm mt-1">{passNotification.message}</p>
        </div>
      </div>
    </div>
  );
}
