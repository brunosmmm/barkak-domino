import { create } from 'zustand';
import type { GameState, Domino, ValidMove, ChatMessage } from '../types';

// Session persistence helpers
const SESSION_KEY = 'barkak-domino-session';

interface SessionData {
  gameId: string;
  playerId: string;
  playerName: string;
}

function saveSession(data: SessionData): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save session to localStorage:', e);
  }
}

function loadSession(): SessionData | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load session from localStorage:', e);
  }
  return null;
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.warn('Failed to clear session from localStorage:', e);
  }
}

// Load saved session on startup
const savedSession = loadSession();

interface RoundOverInfo {
  roundNumber: number;
  winnerId: string | null;
  winnerName: string | null;
  winnerTeam: string | null;
  pointsAwarded: number;
  remainingPips: Record<string, number>;
  wasBlocked: boolean;
  scores: Record<string, number>;
  matchWinner: string | null;
  isTeamGame: boolean;
}

interface MatchOverInfo {
  winner: string;
  isTeamGame: boolean;
  finalScores: Record<string, number>;
  totalRounds: number;
}

interface GameStore {
  // Connection state
  gameId: string | null;
  playerId: string | null;
  playerName: string | null;
  connected: boolean;

  // Game state from server
  gameState: GameState | null;
  validMoves: ValidMove[];

  // UI state
  selectedDomino: Domino | null;
  error: string | null;
  roundOverInfo: RoundOverInfo | null;
  matchOverInfo: MatchOverInfo | null;
  showRoundOverlay: boolean;
  lastPlayedTile: { position: number; side: string; playerId: string } | null;
  passNotification: { playerName: string; message: string } | null;
  activeReactions: { playerId: string; playerName: string; emoji: string; id: number }[];

  // Chat state
  chatMessages: ChatMessage[];
  activeChatBubbles: ChatMessage[];  // Mobile popup bubbles
  unreadChatCount: number;
  isChatOpen: boolean;

  // Actions
  setCredentials: (gameId: string, playerId: string, playerName: string) => void;
  setConnected: (connected: boolean) => void;
  setGameState: (state: GameState) => void;
  setValidMoves: (moves: ValidMove[]) => void;
  setSelectedDomino: (domino: Domino | null) => void;
  setError: (error: string | null) => void;
  setRoundOverInfo: (info: RoundOverInfo | null) => void;
  setMatchOverInfo: (info: MatchOverInfo | null) => void;
  setShowRoundOverlay: (show: boolean) => void;
  setLastPlayedTile: (tile: { position: number; side: string; playerId: string } | null) => void;
  setPassNotification: (notification: { playerName: string; message: string } | null) => void;
  addReaction: (playerId: string, playerName: string, emoji: string) => void;
  removeReaction: (id: number) => void;

  // Chat actions
  addChatMessage: (msg: ChatMessage) => void;
  addChatBubble: (msg: ChatMessage) => void;
  removeChatBubble: (id: string) => void;
  clearUnreadChat: () => void;
  setChatOpen: (open: boolean) => void;

  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Initial state - restore from localStorage if available
  gameId: savedSession?.gameId ?? null,
  playerId: savedSession?.playerId ?? null,
  playerName: savedSession?.playerName ?? null,
  connected: false,
  gameState: null,
  validMoves: [],
  selectedDomino: null,
  error: null,
  roundOverInfo: null,
  matchOverInfo: null,
  showRoundOverlay: false,
  lastPlayedTile: null,
  passNotification: null,
  activeReactions: [],

  // Chat initial state
  chatMessages: [],
  activeChatBubbles: [],
  unreadChatCount: 0,
  isChatOpen: false,

  // Actions
  setCredentials: (gameId, playerId, playerName) => {
    saveSession({ gameId, playerId, playerName });
    set({ gameId, playerId, playerName });
  },

  setConnected: (connected) => set({ connected }),

  setGameState: (gameState) => set((state) => {
    // Clear selected domino if it's no longer in our hand (e.g., auto-played on timeout)
    // or if it's no longer our turn
    let selectedDomino = state.selectedDomino;
    const isOurTurn = gameState.current_turn === gameState.your_player_id;

    if (selectedDomino) {
      if (!isOurTurn) {
        // Not our turn anymore, clear selection
        selectedDomino = null;
      } else if (gameState.your_hand) {
        // Still our turn, but check if tile was auto-played
        const stillHaveIt = gameState.your_hand.some(
          d => d.left === selectedDomino!.left && d.right === selectedDomino!.right
        );
        if (!stillHaveIt) {
          selectedDomino = null;
        }
      }
    }
    // Clear error on successful state update (stale errors like "don't have that domino")
    return { gameState, selectedDomino, error: null };
  }),

  setValidMoves: (validMoves) => set({ validMoves }),

  setSelectedDomino: (selectedDomino) => set({ selectedDomino }),

  setError: (error) => set({ error }),

  setRoundOverInfo: (roundOverInfo) => set({ roundOverInfo, showRoundOverlay: roundOverInfo !== null }),

  setMatchOverInfo: (matchOverInfo) => set({ matchOverInfo }),

  setShowRoundOverlay: (showRoundOverlay) => set({ showRoundOverlay }),

  setLastPlayedTile: (lastPlayedTile) => set({ lastPlayedTile }),

  setPassNotification: (passNotification) => set({ passNotification }),

  addReaction: (playerId, playerName, emoji) => set((state) => ({
    activeReactions: [
      ...state.activeReactions,
      { playerId, playerName, emoji, id: Date.now() + Math.random() }
    ]
  })),

  removeReaction: (id) => set((state) => ({
    activeReactions: state.activeReactions.filter(r => r.id !== id)
  })),

  // Chat actions
  addChatMessage: (msg) => set((state) => ({
    chatMessages: [...state.chatMessages.slice(-99), msg], // Keep last 100 messages
    unreadChatCount: state.isChatOpen ? state.unreadChatCount : state.unreadChatCount + (msg.isOwn ? 0 : 1),
  })),

  addChatBubble: (msg) => set((state) => ({
    activeChatBubbles: [...state.activeChatBubbles, msg],
  })),

  removeChatBubble: (id) => set((state) => ({
    activeChatBubbles: state.activeChatBubbles.filter(b => b.id !== id),
  })),

  clearUnreadChat: () => set({ unreadChatCount: 0 }),

  setChatOpen: (isChatOpen) => set((state) => ({
    isChatOpen,
    unreadChatCount: isChatOpen ? 0 : state.unreadChatCount,
  })),

  reset: () => {
    clearSession();
    set({
      gameId: null,
      playerId: null,
      playerName: null,
      connected: false,
      gameState: null,
      validMoves: [],
      selectedDomino: null,
      error: null,
      roundOverInfo: null,
      matchOverInfo: null,
      showRoundOverlay: false,
      lastPlayedTile: null,
      passNotification: null,
      activeReactions: [],
      chatMessages: [],
      activeChatBubbles: [],
      unreadChatCount: 0,
      isChatOpen: false,
    });
  },
}));
