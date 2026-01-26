import React from 'react';
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
  const dotSize = size === 'sm' ? 4 : size === 'md' ? 6 : 8;
  const gridSize = size === 'sm' ? 24 : size === 'md' ? 36 : 48;
  const spacing = gridSize / 3;

  return (
    <svg width={gridSize} height={gridSize} viewBox={`0 0 ${gridSize} ${gridSize}`}>
      {dots.map(([row, col], i) => (
        <circle
          key={i}
          cx={spacing / 2 + col * spacing}
          cy={spacing / 2 + row * spacing}
          r={dotSize / 2}
          fill="currentColor"
        />
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

  const baseClasses = `
    ${horizontal ? horizontalSize : tileSize}
    bg-white rounded-lg border-2
    ${selected ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-gray-800'}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-yellow-300'}
    transition-all duration-150
    flex ${horizontal ? 'flex-row' : 'flex-col'} items-center justify-center
    shadow-md
  `;

  const dividerClasses = horizontal
    ? 'w-px h-full bg-gray-800'
    : 'w-full h-px bg-gray-800';

  return (
    <div
      className={baseClasses}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <div className="flex-1 flex items-center justify-center text-gray-900">
        <DotGrid value={horizontal ? domino.left : domino.left} size={size} />
      </div>
      <div className={dividerClasses} />
      <div className="flex-1 flex items-center justify-center text-gray-900">
        <DotGrid value={horizontal ? domino.right : domino.right} size={size} />
      </div>
    </div>
  );
}
