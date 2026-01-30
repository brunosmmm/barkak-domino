import { useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Sound types available in the game
export type SoundName =
  | 'tilePlace'
  | 'tileSelect'
  | 'turnNotify'
  | 'victory'
  | 'defeat'
  | 'blocked'
  | 'pass'
  | 'gameStart'
  | 'reaction';

// Sound file paths (will be in /sounds/ directory)
const SOUND_FILES: Record<SoundName, string> = {
  tilePlace: '/sounds/tile-place.mp3',
  tileSelect: '/sounds/tile-select.mp3',
  turnNotify: '/sounds/turn-notify.mp3',
  victory: '/sounds/victory.mp3',
  defeat: '/sounds/defeat.mp3',
  blocked: '/sounds/blocked.mp3',
  pass: '/sounds/pass.mp3',
  gameStart: '/sounds/game-start.mp3',
  reaction: '/sounds/reaction.mp3',
};

// Sound settings store (persisted to localStorage)
interface SoundSettings {
  enabled: boolean;
  volume: number; // 0-1
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  toggle: () => void;
}

export const useSoundSettings = create<SoundSettings>()(
  persist(
    (set) => ({
      enabled: true,
      volume: 0.5,
      setEnabled: (enabled) => set({ enabled }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      toggle: () => set((state) => ({ enabled: !state.enabled })),
    }),
    {
      name: 'barkak-sound-settings',
    }
  )
);

// Audio cache to avoid reloading
const audioCache = new Map<SoundName, HTMLAudioElement>();

// Preload a sound
function preloadSound(name: SoundName): HTMLAudioElement | null {
  if (audioCache.has(name)) {
    return audioCache.get(name)!;
  }

  const path = SOUND_FILES[name];
  if (!path) return null;

  try {
    const audio = new Audio(path);
    audio.preload = 'auto';
    audioCache.set(name, audio);
    return audio;
  } catch (e) {
    console.warn(`Failed to preload sound: ${name}`, e);
    return null;
  }
}

// Main sound hook
export function useSound() {
  const { enabled, volume } = useSoundSettings();
  const lastPlayTime = useRef<Record<string, number>>({});

  // Preload all sounds on mount
  useEffect(() => {
    Object.keys(SOUND_FILES).forEach((name) => {
      preloadSound(name as SoundName);
    });
  }, []);

  // Play a sound
  const play = useCallback(
    (name: SoundName, options?: { debounceMs?: number }) => {
      if (!enabled) return;

      // Debounce to prevent sound spam
      const debounceMs = options?.debounceMs ?? 50;
      const now = Date.now();
      const lastTime = lastPlayTime.current[name] ?? 0;
      if (now - lastTime < debounceMs) return;
      lastPlayTime.current[name] = now;

      const audio = preloadSound(name);
      if (!audio) return;

      try {
        // Clone audio for overlapping plays
        const clone = audio.cloneNode() as HTMLAudioElement;
        clone.volume = volume;
        clone.play().catch((e) => {
          // Ignore autoplay errors (user hasn't interacted yet)
          if (e.name !== 'NotAllowedError') {
            console.warn(`Failed to play sound: ${name}`, e);
          }
        });
      } catch (e) {
        console.warn(`Failed to play sound: ${name}`, e);
      }
    },
    [enabled, volume]
  );

  // Play sound for game events
  const playTilePlace = useCallback(() => play('tilePlace'), [play]);
  const playTileSelect = useCallback(() => play('tileSelect'), [play]);
  const playTurnNotify = useCallback(() => play('turnNotify'), [play]);
  const playVictory = useCallback(() => play('victory'), [play]);
  const playDefeat = useCallback(() => play('defeat'), [play]);
  const playBlocked = useCallback(() => play('blocked'), [play]);
  const playPass = useCallback(() => play('pass'), [play]);
  const playGameStart = useCallback(() => play('gameStart'), [play]);
  const playReaction = useCallback(() => play('reaction', { debounceMs: 200 }), [play]);

  return {
    play,
    playTilePlace,
    playTileSelect,
    playTurnNotify,
    playVictory,
    playDefeat,
    playBlocked,
    playPass,
    playGameStart,
    playReaction,
    enabled,
    volume,
  };
}
