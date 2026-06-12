import { createDeck, dealCards, findPlayerWithThreeOfSpades, shuffleDeck } from './deck';
import { applyScores, getWinners, resolveTargetScore, scoreHand } from './scoring';
import {
	FIRST_HAND_NUMBER,
	canBeat,
	detectCombination,
	isValidOpeningMove
} from './rules';
import {
	canPlayerTakeTurn,
	createGameState,
	getActiveTurnPlayers,
	getNextPlayerId,
	getPlayer,
	getPlayersInSeatOrder,
	getPlayersWithCards
} from './state';
import type { Card } from './cards';
import type { ShuffleSeed } from './deck';
import type { GameState, PlayerId, PlayerState } from './state';

const FULL_DECK_SIZE = 54;

export type ActionErrorCode =
	| 'invalid_phase'
	| 'player_not_found'
	| 'not_your_turn'
	| 'player_finished'
	| 'invalid_cards'
	| 'cards_not_owned'
	| 'invalid_combination'
	| 'invalid_opening_move'
	| 'cannot_beat_previous'
	| 'cannot_pass_without_play';

export class GameActionError extends Error {
	constructor(readonly code: ActionErrorCode) {
		super(code);
		this.name = 'GameActionError';
	}
}

export type StartHandOptions = {
	seed?: ShuffleSeed;
	deck?: readonly Card[];
};

export function startHand(state: GameState, options: StartHandOptions = {}): GameState {
	const baseState = createGameState(state);
	const players = getPlayersInSeatOrder(baseState).map((player) => ({
		...player,
		hand: [],
		finishedPosition: null
	}));
	const deck = options.deck ? [...options.deck] : shuffleDeck(createDeck(), options.seed);
	const dealtPlayers = dealCards(deck, players);
	const firstPlayer = findPlayerWithThreeOfSpades(dealtPlayers) ?? dealtPlayers[0];

	return {
		...baseState,
		handNumber: baseState.handNumber + 1,
		players: dealtPlayers,
		currentPlayerId: firstPlayer.id,
		controllerPlayerId: firstPlayer.id,
		lastPlay: null,
		passedPlayerIds: [],
		finishOrder: [],
		phase: 'playing'
	};
}

export function playCards(
	state: GameState,
	playerId: PlayerId,
	cards: readonly Card[]
): GameState {
	assertPlaying(state);

	if (state.currentPlayerId !== playerId) {
		throw new GameActionError('not_your_turn');
	}

	if (cards.length === 0) {
		throw new GameActionError('invalid_cards');
	}

	const player = getPlayer(state, playerId);

	if (!player) {
		throw new GameActionError('player_not_found');
	}

	if (!canPlayerTakeTurn(player)) {
		throw new GameActionError('player_finished');
	}

	if (!hasCardsInHand(player.hand, cards)) {
		throw new GameActionError('cards_not_owned');
	}

	const combination = detectCombination(cards);

	if (!combination) {
		throw new GameActionError('invalid_combination');
	}

	if (state.lastPlay) {
		if (!canBeat(combination, state.lastPlay.combination)) {
			throw new GameActionError('cannot_beat_previous');
		}
	} else if (!isValidOpeningMove(cards, state.handNumber, isFirstMoveOfFirstHand(state))) {
		throw new GameActionError('invalid_opening_move');
	}

	const nextState = createGameState(state);
	const players = nextState.players.map((statePlayer) =>
		statePlayer.id === playerId
			? {
					...statePlayer,
					hand: removeCardsFromHand(statePlayer.hand, cards)
				}
			: statePlayer
	);
	const playedCards = combination.cards;
	let updatedState: GameState = {
		...nextState,
		players,
		controllerPlayerId: playerId,
		lastPlay: {
			playerId,
			combination,
			cards: playedCards
		},
		passedPlayerIds: []
	};

	updatedState = finishPlayerIfNeeded(updatedState, playerId);
	updatedState = finishHandIfNeeded(updatedState);

	return updatedState.phase === 'playing' ? advanceTurn(updatedState) : updatedState;
}

export function passTurn(state: GameState, playerId: PlayerId): GameState {
	assertPlaying(state);

	if (state.currentPlayerId !== playerId) {
		throw new GameActionError('not_your_turn');
	}

	const player = getPlayer(state, playerId);

	if (!player) {
		throw new GameActionError('player_not_found');
	}

	if (!canPlayerTakeTurn(player)) {
		throw new GameActionError('player_finished');
	}

	if (!state.lastPlay || !state.controllerPlayerId) {
		throw new GameActionError('cannot_pass_without_play');
	}

	const passedPlayerIds = state.passedPlayerIds.includes(playerId)
		? [...state.passedPlayerIds]
		: [...state.passedPlayerIds, playerId];
	const controllerPlayerId = state.controllerPlayerId;
	const nextState = createGameState({ ...state, passedPlayerIds });

	if (haveAllChallengersPassed(nextState)) {
		const controllerPlayer = getPlayer(nextState, controllerPlayerId);
		const nextControllerId = controllerPlayer && canPlayerTakeTurn(controllerPlayer)
			? controllerPlayer.id
			: getNextPlayerId(nextState, controllerPlayerId);

		return {
			...nextState,
			currentPlayerId: nextControllerId,
			controllerPlayerId: nextControllerId,
			lastPlay: null,
			passedPlayerIds: []
		};
	}

	return advanceTurn(nextState);
}

export function advanceTurn(state: GameState): GameState {
	const nextState = createGameState(state);

	return {
		...nextState,
		currentPlayerId: getNextPlayerId(nextState)
	};
}

export function finishPlayerIfNeeded(state: GameState, playerId: PlayerId): GameState {
	const nextState = createGameState(state);
	const player = getPlayer(nextState, playerId);

	if (!player || player.hand.length > 0 || player.finishedPosition !== null) {
		return nextState;
	}

	const finishOrder = [...nextState.finishOrder, playerId];
	const finishedPosition = finishOrder.length;

	return {
		...nextState,
		players: nextState.players.map((statePlayer) =>
			statePlayer.id === playerId ? { ...statePlayer, finishedPosition } : statePlayer
		),
		finishOrder
	};
}

export function finishHandIfNeeded(state: GameState): GameState {
	const nextState = createGameState(state);

	if (nextState.phase !== 'playing' || getPlayersWithCards(nextState).length > 1) {
		return nextState;
	}

	const finishOrder = completeFinishOrder(nextState);
	const handScore = scoreHand(finishOrder, nextState.players.length);
	const playersWithPositions = applyFinishedPositions(nextState.players, finishOrder);
	const scoredPlayers = applyScores(playersWithPositions, handScore);
	const winners = getWinners(scoredPlayers, nextState.targetScore);
	const resolvedTargetScore = resolveTargetScore(scoredPlayers, nextState.targetScore);
	const hasSingleWinner = winners.length === 1;
	const hasFinalTie = winners.length > 1 && resolvedTargetScore === nextState.targetScore;

	return {
		...nextState,
		players: scoredPlayers,
		targetScore: resolvedTargetScore,
		currentPlayerId: null,
		controllerPlayerId: null,
		lastPlay: null,
		passedPlayerIds: [],
		finishOrder,
		phase: hasSingleWinner || hasFinalTie ? 'game_finished' : 'hand_finished'
	};
}

export function startNextHand(state: GameState, options: StartHandOptions = {}): GameState {
	if (state.phase !== 'hand_finished') {
		throw new GameActionError('invalid_phase');
	}

	return startHand(state, options);
}

function assertPlaying(state: GameState): void {
	if (state.phase !== 'playing') {
		throw new GameActionError('invalid_phase');
	}
}

function haveAllChallengersPassed(state: GameState): boolean {
	const controllerPlayerId = state.controllerPlayerId;

	if (!controllerPlayerId) {
		return false;
	}

	const challengerIds = getActiveTurnPlayers(state)
		.map((player) => player.id)
		.filter((id) => id !== controllerPlayerId);

	return challengerIds.length > 0 && challengerIds.every((id) => state.passedPlayerIds.includes(id));
}

function isFirstMoveOfFirstHand(state: GameState): boolean {
	return (
		state.handNumber === FIRST_HAND_NUMBER &&
		state.lastPlay === null &&
		state.finishOrder.length === 0 &&
		state.passedPlayerIds.length === 0 &&
		countCardsInHands(state.players) === FULL_DECK_SIZE
	);
}

function countCardsInHands(players: readonly PlayerState[]): number {
	return players.reduce((total, player) => total + player.hand.length, 0);
}

function hasCardsInHand(hand: readonly Card[], cards: readonly Card[]): boolean {
	const handCounts = countCardsByKey(hand);

	for (const card of cards) {
		const key = getCardKey(card);
		const count = handCounts.get(key) ?? 0;

		if (count === 0) {
			return false;
		}

		handCounts.set(key, count - 1);
	}

	return true;
}

function removeCardsFromHand(hand: readonly Card[], cards: readonly Card[]): Card[] {
	const cardCounts = countCardsByKey(cards);

	return hand.filter((card) => {
		const key = getCardKey(card);
		const count = cardCounts.get(key) ?? 0;

		if (count === 0) {
			return true;
		}

		cardCounts.set(key, count - 1);
		return false;
	});
}

function countCardsByKey(cards: readonly Card[]): Map<string, number> {
	return cards.reduce((counts, card) => {
		const key = getCardKey(card);
		counts.set(key, (counts.get(key) ?? 0) + 1);
		return counts;
	}, new Map<string, number>());
}

function getCardKey(card: Card): string {
	return 'suit' in card ? `${card.suit}:${card.rank}` : card.rank;
}

function completeFinishOrder(state: GameState): PlayerId[] {
	const finishOrder = [...state.finishOrder];

	for (const player of getPlayersInSeatOrder(state)) {
		if (!finishOrder.includes(player.id)) {
			finishOrder.push(player.id);
		}
	}

	return finishOrder;
}

function applyFinishedPositions(
	players: readonly PlayerState[],
	finishOrder: readonly PlayerId[]
): PlayerState[] {
	const positionByPlayerId = new Map(
		finishOrder.map((playerId, index) => [playerId, index + 1] as const)
	);

	return players.map((player) => ({
		...player,
		finishedPosition: positionByPlayerId.get(player.id) ?? player.finishedPosition
	}));
}
