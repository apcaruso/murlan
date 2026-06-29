import { DEFAULT_TARGET_SCORE } from './scoring';
import type { Card } from './cards';
import type { Combination } from './rules';

export type GamePhase = 'waiting' | 'ready' | 'playing' | 'hand_finished' | 'game_finished' | 'closed';
export type PlayerId = string;

export type PlayerState = {
	id: PlayerId;
	name: string;
	seatIndex: number;
	hand: Card[];
	score: number;
	connected: boolean;
	ready: boolean;
	finishedPosition: number | null;
};

export type LastPlay = {
	playerId: PlayerId;
	combination: Combination;
	cards: Card[];
};

export type GameState = {
	handNumber: number;
	targetScore: number;
	players: PlayerState[];
	currentPlayerId: PlayerId | null;
	controllerPlayerId: PlayerId | null;
	lastPlay: LastPlay | null;
	passedPlayerIds: PlayerId[];
	finishOrder: PlayerId[];
	phase: GamePhase;
};

export type CreateGameStateInput = Partial<
	Omit<GameState, 'players' | 'passedPlayerIds' | 'finishOrder'>
> & {
	players?: readonly PlayerState[];
	passedPlayerIds?: readonly PlayerId[];
	finishOrder?: readonly PlayerId[];
};

export function createGameState(input: CreateGameStateInput = {}): GameState {
	return {
		handNumber: input.handNumber ?? 0,
		targetScore: input.targetScore ?? DEFAULT_TARGET_SCORE,
		players: input.players?.map(clonePlayerState) ?? [],
		currentPlayerId: input.currentPlayerId ?? null,
		controllerPlayerId: input.controllerPlayerId ?? null,
		lastPlay: input.lastPlay ? cloneLastPlay(input.lastPlay) : null,
		passedPlayerIds: [...(input.passedPlayerIds ?? [])],
		finishOrder: [...(input.finishOrder ?? [])],
		phase: input.phase ?? 'waiting'
	};
}

export function getPlayer(state: GameState, playerId: PlayerId): PlayerState | undefined {
	return state.players.find((player) => player.id === playerId);
}

export function getPlayersInSeatOrder(state: GameState): PlayerState[] {
	return [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
}

export function hasCards(player: PlayerState): boolean {
	return player.hand.length > 0;
}

export function hasPlayerFinished(player: PlayerState): boolean {
	return player.finishedPosition !== null;
}

export function canPlayerTakeTurn(player: PlayerState): boolean {
	return !hasPlayerFinished(player) && hasCards(player);
}

export function getPlayersWithCards(state: GameState): PlayerState[] {
	return getPlayersInSeatOrder(state).filter(hasCards);
}

export function getActiveTurnPlayers(state: GameState): PlayerState[] {
	return getPlayersInSeatOrder(state).filter(canPlayerTakeTurn);
}

export function getNextPlayerId(
	state: GameState,
	fromPlayerId: PlayerId | null = state.currentPlayerId
): PlayerId | null {
	const activePlayers = getActiveTurnPlayers(state);

	if (activePlayers.length === 0) {
		return null;
	}

	if (fromPlayerId === null) {
		return activePlayers[0].id;
	}

	const activeIndex = activePlayers.findIndex((player) => player.id === fromPlayerId);

	if (activeIndex !== -1) {
		return activePlayers[(activeIndex + 1) % activePlayers.length].id;
	}

	const fromPlayer = getPlayer(state, fromPlayerId);

	if (!fromPlayer) {
		return activePlayers[0].id;
	}

	return (
		activePlayers.find((player) => player.seatIndex > fromPlayer.seatIndex) ?? activePlayers[0]
	).id;
}

function clonePlayerState(player: PlayerState): PlayerState {
	return {
		...player,
		hand: [...player.hand]
	};
}

function cloneLastPlay(lastPlay: LastPlay): LastPlay {
	return {
		...lastPlay,
		cards: [...lastPlay.cards],
		combination: {
			...lastPlay.combination,
			cards: [...lastPlay.combination.cards]
		}
	};
}
