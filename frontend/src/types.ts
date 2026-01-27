// Game types matching backend models

export interface Domino {
  left: number;
  right: number;
}

export interface PlayedDomino {
  domino: Domino;
  position: number;
}

export interface Player {
  id: string;
  name: string;
  tile_count: number;
  score: number;
  connected: boolean;
  is_you: boolean;
  is_cpu?: boolean;
  position: number;  // Seat position (0-3) for table visualization
}

export interface BoardEnds {
  left: number | null;
  right: number | null;
}

export interface RoundResult {
  round_number: number;
  winner_id: string | null;
  winner_team: 'team_a' | 'team_b' | null;
  points_awarded: number;
  remaining_pips: Record<string, number>;
  was_blocked: boolean;
}

export interface MatchState {
  id: string;
  is_team_game: boolean;
  target_score: number;
  current_round: number;
  scores: Record<string, number>;  // team_a/team_b or player_id -> score
  team_a: string[];
  team_b: string[];
  team_a_name: string;  // Randomly selected monkey/ape species name
  team_b_name: string;
  player_positions: string[];
  player_names: Record<string, string>;
  avatar_ids: number[];  // Randomly selected avatar IDs (1-20) for positions 0-3
  completed_rounds: RoundResult[];
  match_winner: string | null;
}

export interface TurnTimer {
  timeout: number;     // Total timeout in seconds
  remaining: number;   // Remaining time in seconds
  started_at: string;  // ISO timestamp when turn started
}

export interface GameState {
  id: string;
  variant: 'block' | 'draw' | 'all_fives';
  status: 'waiting' | 'picking' | 'playing' | 'finished';
  current_turn: string | null;
  your_player_id: string;
  your_hand: Domino[];
  board: PlayedDomino[];
  ends: BoardEnds;
  players: Player[];
  winner_id: string | null;
  boneyard_count: number;
  round_number: number;
  match: MatchState | null;
  turn_timer: TurnTimer | null;
  picking_timer: TurnTimer | null;  // Reuses same structure
  // Picking phase: grid positions (0-27) that still have tiles
  available_tile_positions?: number[];
}

export interface ValidMove {
  domino: Domino;
  side: 'left' | 'right';
}

// WebSocket message types
export type WSMessage =
  | { type: 'game_state'; state: GameState }
  | { type: 'player_joined'; player_id: string; player_name: string; player_count: number }
  | { type: 'player_connected'; player_id: string; player_name: string }
  | { type: 'player_disconnected'; player_id: string }
  | { type: 'tile_played'; player_id: string; domino: Domino; side: string }
  | { type: 'tile_claimed'; player_id: string; tile_index: number }
  | { type: 'tiles_auto_assigned'; player_id: string; positions: number[]; reason: string }
  | { type: 'turn_passed'; player_id: string }
  | { type: 'game_started' }
  | { type: 'game_over'; winner_id: string; winner_name: string }
  | { type: 'round_over'; round_number: number; winner_id: string; winner_name: string | null;
      winner_team: string | null; points_awarded: number; remaining_pips: Record<string, number>;
      was_blocked: boolean; scores: Record<string, number>; match_winner: string | null; is_team_game: boolean }
  | { type: 'round_started'; round_number: number }
  | { type: 'match_over'; winner: string; is_team_game: boolean; final_scores: Record<string, number>; total_rounds: number }
  | { type: 'cpu_added'; player_count: number }
  | { type: 'valid_moves'; moves: ValidMove[] }
  | { type: 'reaction'; player_id: string; player_name: string; emoji: string }
  | { type: 'error'; message: string };
