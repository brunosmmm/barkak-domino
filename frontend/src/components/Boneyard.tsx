import { useGameStore } from '../store/gameStore';

export function Boneyard() {
  const { gameState } = useGameStore();

  if (!gameState || gameState.status !== 'playing') return null;

  const boneyardCount = gameState.boneyard_count || 0;

  if (boneyardCount === 0) return null;

  // Create array for rendering face-down tiles
  const tiles = Array(boneyardCount).fill(null);

  return (
    <div className="fixed top-4 right-4 z-10">
      <div className="glass-panel p-3">
        <p className="text-neon-amber text-xs font-medium mb-2 text-center">
          Boneyard ({boneyardCount})
        </p>

        {/* Stack of face-down tiles for dramatic effect */}
        <div className="relative w-16 h-20">
          {tiles.slice(0, Math.min(5, boneyardCount)).map((_, index) => (
            <div
              key={index}
              className="absolute rounded-md shadow-md"
              style={{
                width: '40px',
                height: '72px',
                // Ivory/bone back with subtle pattern
                background: 'linear-gradient(145deg, #d4c9b5 0%, #c2b49a 50%, #b0a080 100%)',
                border: '1px solid #8b7355',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), inset 0 -1px 2px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.3)',
                // Stagger the tiles slightly for stack effect
                top: `${index * 2}px`,
                left: `${index * 2}px`,
                transform: `rotate(${(index - 2) * 2}deg)`,
                zIndex: index,
              }}
            >
              {/* Decorative back pattern */}
              <div
                className="absolute inset-2 rounded opacity-20"
                style={{
                  background: 'repeating-linear-gradient(45deg, #6b5344 0px, #6b5344 2px, transparent 2px, transparent 6px)',
                }}
              />
            </div>
          ))}
        </div>

        {/* Show count if more than 5 */}
        {boneyardCount > 5 && (
          <p className="text-gray-400 text-xs text-center mt-1">
            +{boneyardCount - 5} more
          </p>
        )}
      </div>
    </div>
  );
}
