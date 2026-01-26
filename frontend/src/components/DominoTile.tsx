import type { CSSProperties } from 'react';
import type { Domino } from '../types';

interface DominoTileProps {
  domino: Domino;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  horizontal?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Dot positions for each value (0-6) on a 3x3 grid
const DOT_PATTERNS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function DotGrid({ value, size }: { value: number; size: 'sm' | 'md' | 'lg' }) {
  const dots = DOT_PATTERNS[value] || [];
  const dotSize = size === 'sm' ? 5 : size === 'md' ? 7 : 10;
  const gridSize = size === 'sm' ? 24 : size === 'md' ? 36 : 48;
  const spacing = gridSize / 3;

  return (
    <svg width={gridSize} height={gridSize} viewBox={`0 0 ${gridSize} ${gridSize}`}>
      <defs>
        {/* Gradient for recessed dot effect */}
        <radialGradient id="dotGradient" cx="30%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </radialGradient>
        {/* Inner shadow for dots */}
        <filter id="dotInset" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0.5" dy="0.5" stdDeviation="0.3" floodColor="#ffffff" floodOpacity="0.3"/>
        </filter>
      </defs>
      {dots.map(([row, col], i) => (
        <g key={i}>
          {/* Outer ring for depth */}
          <circle
            cx={spacing / 2 + col * spacing}
            cy={spacing / 2 + row * spacing}
            r={dotSize / 2 + 0.5}
            fill="#2d2d2d"
          />
          {/* Main dot with gradient */}
          <circle
            cx={spacing / 2 + col * spacing}
            cy={spacing / 2 + row * spacing}
            r={dotSize / 2}
            fill="url(#dotGradient)"
            filter="url(#dotInset)"
          />
          {/* Highlight */}
          <circle
            cx={spacing / 2 + col * spacing - dotSize / 6}
            cy={spacing / 2 + row * spacing - dotSize / 6}
            r={dotSize / 6}
            fill="rgba(255,255,255,0.15)"
          />
        </g>
      ))}
    </svg>
  );
}

export function DominoTile({
  domino,
  onClick,
  selected = false,
  disabled = false,
  horizontal = false,
  size = 'md',
}: DominoTileProps) {
  const tileSize = size === 'sm' ? 'w-8 h-16' : size === 'md' ? 'w-12 h-24' : 'w-16 h-32';
  const horizontalSize = size === 'sm' ? 'w-16 h-8' : size === 'md' ? 'w-24 h-12' : 'w-32 h-16';

  // Realistic ivory/bone domino styling
  const baseClasses = `
    ${horizontal ? horizontalSize : tileSize}
    rounded-lg
    ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
    transition-all duration-150
    flex ${horizontal ? 'flex-row' : 'flex-col'} items-center justify-center
    relative
  `;

  // Outer border glow for selection
  const glowClasses = selected
    ? 'ring-2 ring-neon-amber shadow-neon-amber'
    : disabled
    ? ''
    : 'hover:ring-1 hover:ring-neon-amber/50';

  // Ivory/bone gradient background
  const ivoryStyle: CSSProperties = {
    background: `
      linear-gradient(145deg, #f5f0e6 0%, #e8e0d0 50%, #d4c9b5 100%)
    `,
    boxShadow: selected
      ? '0 0 15px rgba(245, 158, 11, 0.5), inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -1px 2px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.4)'
      : 'inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -1px 2px rgba(0,0,0,0.1), 0 3px 6px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
    border: '1px solid #a89880',
  };

  const dividerClasses = horizontal
    ? 'w-px h-full'
    : 'w-full h-px';

  // Divider styled as an engraved line
  const dividerStyle: CSSProperties = {
    background: 'linear-gradient(to right, transparent, #8b7355 20%, #6b5344 50%, #8b7355 80%, transparent)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.3)',
  };

  const dividerStyleVertical: CSSProperties = {
    background: 'linear-gradient(to bottom, transparent, #8b7355 20%, #6b5344 50%, #8b7355 80%, transparent)',
    boxShadow: '1px 0 0 rgba(255,255,255,0.3)',
  };

  return (
    <div
      className={`${baseClasses} ${glowClasses}`}
      style={ivoryStyle}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <div className="flex-1 flex items-center justify-center">
        <DotGrid value={domino.left} size={size} />
      </div>
      <div className={dividerClasses} style={horizontal ? dividerStyleVertical : dividerStyle} />
      <div className="flex-1 flex items-center justify-center">
        <DotGrid value={domino.right} size={size} />
      </div>
    </div>
  );
}
