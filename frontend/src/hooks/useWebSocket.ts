import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import type { WSMessage, Domino } from '../types';

const RECONNECT_KEY = 'barkak-reconnect-attempts';
const MAX_RECONNECT_ATTEMPTS = 3;

function getReconnectAttempts(): number {
  return parseInt(sessionStorage.getItem(RECONNECT_KEY) || '0', 10);
}

function incrementReconnectAttempts(): number {
  const attempts = getReconnectAttempts() + 1;
  sessionStorage.setItem(RECONNECT_KEY, String(attempts));
  return attempts;
}

function resetReconnectAttempts(): void {
  sessionStorage.removeItem(RECONNECT_KEY);
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const {
    gameId,
    playerId,
    setConnected,
    setGameState,
    setValidMoves,
    setError,
    setRoundOverInfo,
    setMatchOverInfo,
    setLastPlayedTile,
    setPassNotification,
    addReaction,
    gameState,
    reset,
  } = useGameStore();

  const connect = useCallback(() => {
    if (!gameId || !playerId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${gameId}/${playerId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      resetReconnectAttempts(); // Reset on successful connection
      setConnected(true);
      setError(null);
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected, code:', event.code);
      setConnected(false);

      // If game/player not found (4004), clear session and go back to lobby
      if (event.code === 4004) {
        console.log('Game not found, clearing session');
        resetReconnectAttempts();
        reset();
        return;
      }

      // Track failed connection attempts (code 1006 = abnormal closure, often means server rejected)
      const attempts = incrementReconnectAttempts();
      console.log(`Connection attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS}`);

      // If too many failures, game probably doesn't exist - clear session
      if (attempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('Too many failed attempts, clearing session');
        resetReconnectAttempts();
        reset();
        return;
      }

      // Attempt reconnection after 2 seconds for other disconnects
      reconnectTimeoutRef.current = window.setTimeout(() => {
        console.log('Attempting reconnection...');
        connect();
      }, 2000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error');
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
  }, [gameId, playerId, setConnected, setError]);

  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'game_state':
        setGameState(message.state);
        break;

      case 'valid_moves':
        setValidMoves(message.moves);
        break;

      case 'error':
        setError(message.message);
        break;

      case 'tile_played':
        console.log('Tile played by', message.player_id, 'on', message.side);
        // Track the last played tile for visual feedback with player color
        // Position will be 0 for left plays, or the last index for right plays
        setLastPlayedTile({
          position: message.side === 'left' ? 0 : -1, // -1 means last position
          side: message.side,
          playerId: message.player_id,
        });
        // Clear the highlight after animation completes
        setTimeout(() => setLastPlayedTile(null), 2000);
        break;

      case 'game_started':
        console.log('Game started!');
        setLastPlayedTile(null);
        break;

      case 'game_over':
        console.log('Game over! Winner:', message.winner_name);
        break;

      case 'round_over':
        console.log('Round over! Points:', message.points_awarded);
        setRoundOverInfo({
          roundNumber: message.round_number,
          winnerId: message.winner_id,
          winnerName: message.winner_name,
          winnerTeam: message.winner_team,
          pointsAwarded: message.points_awarded,
          remainingPips: message.remaining_pips,
          wasBlocked: message.was_blocked,
          scores: message.scores,
          matchWinner: message.match_winner,
          isTeamGame: message.is_team_game,
        });
        break;

      case 'round_started':
        console.log('New round started:', message.round_number);
        setRoundOverInfo(null);
        setLastPlayedTile(null);
        break;

      case 'match_over':
        console.log('Match over! Winner:', message.winner);
        setMatchOverInfo({
          winner: message.winner,
          isTeamGame: message.is_team_game,
          finalScores: message.final_scores,
          totalRounds: message.total_rounds,
        });
        break;

      case 'turn_passed':
        console.log('Turn passed by', message.player_id);
        // Find the player name and show a mocking notification
        // Use getState() to get the latest state, not the stale closure value
        const currentState = useGameStore.getState().gameState;
        const passingPlayer = currentState?.players.find(p => p.id === message.player_id);
        const playerName = passingPlayer?.name || message.player_name || 'Someone';
        const isYou = passingPlayer?.is_you;

        // Pick a random mocking message
        const mockMessages = isYou ? [
          "You got nothing? Pathetic! 😂",
          "Skill issue! 🤡",
          "Maybe try shuffling better next time? 💀",
          "L + ratio + no tiles 📉",
          "Imagine passing... couldn't be me! Oh wait... 😬",
        ] : [
          `${playerName} got nothing! 😂`,
          `${playerName} is washed! 🤡`,
          `${playerName} choked! 💀`,
          `L for ${playerName}! 📉`,
          `${playerName} forgot how to play! 🧠❌`,
          `${playerName}? More like ${playerName.slice(0, 3)}...LOSER! 😈`,
        ];
        const mockMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)];

        setPassNotification({ playerName, message: mockMessage });
        // Clear after 3 seconds
        setTimeout(() => setPassNotification(null), 3000);
        break;

      case 'player_joined':
        console.log(`${message.player_name} joined`);
        break;

      case 'player_disconnected':
        console.log(`Player ${message.player_id} disconnected`);
        break;

      case 'cpu_added':
        console.log('CPU player added, count:', message.player_count);
        break;

      case 'reaction':
        console.log('Reaction from', message.player_name, ':', message.emoji);
        // Add reaction to display - it will auto-remove via the component
        addReaction(message.player_id, message.player_name, message.emoji);
        break;

      default:
        console.log('Received message:', message);
    }
  }, [setGameState, setValidMoves, setError, setRoundOverInfo, setMatchOverInfo, setLastPlayedTile, setPassNotification, addReaction, gameState]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((data: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const playTile = useCallback((domino: Domino, side: 'left' | 'right') => {
    send({ type: 'play_tile', domino, side });
  }, [send]);

  const passTurn = useCallback(() => {
    send({ type: 'pass_turn' });
  }, [send]);

  const startGame = useCallback(() => {
    send({ type: 'start_game' });
  }, [send]);

  const addCpu = useCallback(() => {
    send({ type: 'add_cpu' });
  }, [send]);

  const nextRound = useCallback(() => {
    send({ type: 'next_round' });
  }, [send]);

  const sendReaction = useCallback((emoji: string) => {
    send({ type: 'reaction', emoji });
  }, [send]);

  const requestValidMoves = useCallback(() => {
    send({ type: 'get_valid_moves' });
  }, [send]);

  // Auto-connect when credentials are set
  useEffect(() => {
    if (gameId && playerId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [gameId, playerId, connect, disconnect]);

  return {
    connected: useGameStore.getState().connected,
    send,
    playTile,
    passTurn,
    startGame,
    addCpu,
    nextRound,
    sendReaction,
    requestValidMoves,
    disconnect,
  };
}
