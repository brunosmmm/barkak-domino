"""Pydantic models for the domino game."""
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid


class GameVariant(str, Enum):
    BLOCK = "block"
    DRAW = "draw"
    ALL_FIVES = "all_fives"


class GameStatus(str, Enum):
    WAITING = "waiting"
    PLAYING = "playing"
    FINISHED = "finished"


class Domino(BaseModel):
    """A single domino tile."""
    left: int = Field(ge=0, le=6)
    right: int = Field(ge=0, le=6)

    def __hash__(self):
        return hash((min(self.left, self.right), max(self.left, self.right)))

    def __eq__(self, other):
        if not isinstance(other, Domino):
            return False
        return (self.left == other.left and self.right == other.right) or \
               (self.left == other.right and self.right == other.left)

    def is_double(self) -> bool:
        return self.left == self.right

    def total(self) -> int:
        return self.left + self.right

    def flipped(self) -> "Domino":
        return Domino(left=self.right, right=self.left)


class PlayedDomino(BaseModel):
    """A domino that has been played on the board."""
    domino: Domino
    position: int  # Position in the chain (0 = first played)


class Player(BaseModel):
    """A player in the game."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    hand: list[Domino] = Field(default_factory=list)
    score: int = 0
    connected: bool = True
    is_cpu: bool = False

    def hand_total(self) -> int:
        return sum(d.total() for d in self.hand)


class BoardEnds(BaseModel):
    """The current playable ends of the board."""
    left: Optional[int] = None
    right: Optional[int] = None


class Game(BaseModel):
    """The complete game state."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    variant: GameVariant = GameVariant.BLOCK
    status: GameStatus = GameStatus.WAITING
    players: list[Player] = Field(default_factory=list)
    current_turn: Optional[str] = None  # player_id
    board: list[PlayedDomino] = Field(default_factory=list)
    boneyard: list[Domino] = Field(default_factory=list)
    ends: BoardEnds = Field(default_factory=BoardEnds)
    max_players: int = 4
    winner_id: Optional[str] = None
    round_number: int = 1
    match_id: Optional[str] = None  # Link to parent match for multi-round play
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)

    def touch(self):
        """Update last activity timestamp."""
        self.last_activity = datetime.utcnow()

    def has_connected_humans(self) -> bool:
        """Check if any human players are connected."""
        return any(p.connected and not p.is_cpu for p in self.players)

    def get_player(self, player_id: str) -> Optional[Player]:
        for p in self.players:
            if p.id == player_id:
                return p
        return None

    def get_player_index(self, player_id: str) -> int:
        for i, p in enumerate(self.players):
            if p.id == player_id:
                return i
        return -1


# WebSocket message models
class JoinGameRequest(BaseModel):
    game_id: str
    player_name: str


class CreateGameRequest(BaseModel):
    player_name: str
    variant: GameVariant = GameVariant.BLOCK
    max_players: int = Field(default=4, ge=2, le=4)
    cpu_players: int = Field(default=0, ge=0, le=3)
    target_score: int = Field(default=100, ge=50, le=500)  # For multi-round matches


class PlayTileRequest(BaseModel):
    domino: Domino
    side: str  # "left" or "right"


class GameStateResponse(BaseModel):
    """Full game state sent to a player."""
    game: Game
    your_player_id: str


class ErrorResponse(BaseModel):
    error: str
    code: str = "error"


class TeamScores(BaseModel):
    """Team scores for 4-player games."""
    team_a: int = 0  # Players 0 and 2
    team_b: int = 0  # Players 1 and 3


class IndividualScores(BaseModel):
    """Individual scores for 2-3 player games."""
    scores: dict[str, int] = Field(default_factory=dict)  # player_id -> score


class RoundResult(BaseModel):
    """Result of a completed round."""
    round_number: int
    winner_id: Optional[str]
    winner_team: Optional[str] = None  # "team_a" or "team_b"
    points_awarded: int
    remaining_pips: dict[str, int]  # player_id -> remaining pip count
    was_blocked: bool = False


class Match(BaseModel):
    """A match consisting of multiple rounds."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    current_game: Optional[Game] = None
    completed_rounds: list[RoundResult] = Field(default_factory=list)

    # Team assignments (for 4 players)
    team_a: list[str] = Field(default_factory=list)  # player_ids
    team_b: list[str] = Field(default_factory=list)

    # Scoring
    is_team_game: bool = False
    team_scores: TeamScores = Field(default_factory=TeamScores)
    individual_scores: IndividualScores = Field(default_factory=IndividualScores)
    target_score: int = 100

    # Player info persisted across rounds
    player_names: dict[str, str] = Field(default_factory=dict)  # id -> name
    player_positions: list[str] = Field(default_factory=list)  # ordered player ids (seat positions)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)

    def touch(self):
        """Update last activity timestamp."""
        self.last_activity = datetime.utcnow()

    def get_current_scores(self) -> dict:
        """Get current scores based on game type."""
        if self.is_team_game:
            return {
                "team_a": self.team_scores.team_a,
                "team_b": self.team_scores.team_b
            }
        return self.individual_scores.scores.copy()

    def get_winner(self) -> Optional[str]:
        """Check if there's a match winner. Returns team name or player_id."""
        if self.is_team_game:
            if self.team_scores.team_a >= self.target_score:
                return "team_a"
            if self.team_scores.team_b >= self.target_score:
                return "team_b"
        else:
            for player_id, score in self.individual_scores.scores.items():
                if score >= self.target_score:
                    return player_id
        return None

    def get_team_for_player(self, player_id: str) -> Optional[str]:
        """Get which team a player is on."""
        if player_id in self.team_a:
            return "team_a"
        if player_id in self.team_b:
            return "team_b"
        return None
