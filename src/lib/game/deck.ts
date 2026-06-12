import { JOKER_RANKS, STANDARD_RANKS, SUITS, isThreeOfSpades } from './cards';
import type { Card } from './cards';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

export type ShuffleSeed = string | number;
export type DeckPlayer = string | { id: string };
export type DealtPlayer<TPlayer extends DeckPlayer = DeckPlayer> = TPlayer extends string
	? { id: TPlayer; hand: Card[] }
	: TPlayer & { hand: Card[] };

export function createDeck(): Card[] {
	const standardCards = STANDARD_RANKS.flatMap((rank) =>
		SUITS.map((suit): Card => ({ rank, suit }))
	);
	const jokers = JOKER_RANKS.map((rank): Card => ({ rank }));

	return [...standardCards, ...jokers];
}

export function shuffleDeck(deck: readonly Card[], seed?: ShuffleSeed): Card[] {
	const shuffled = [...deck];
	const random = seed === undefined ? randomUnit : createSeededRandom(seed);

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
	}

	return shuffled;
}

export function dealCards<TPlayer extends DeckPlayer>(
	deck: readonly Card[],
	players: readonly TPlayer[]
): DealtPlayer<TPlayer>[] {
	assertValidPlayerCount(players.length);

	const dealtPlayers = players.map((player) => {
		const hand: Card[] = [];

		return typeof player === 'string'
			? { id: player, hand }
			: { ...(player as Exclude<TPlayer, string>), hand };
	}) as unknown as DealtPlayer<TPlayer>[];

	deck.forEach((card, index) => {
		dealtPlayers[index % dealtPlayers.length].hand.push(card);
	});

	return dealtPlayers;
}

export function findPlayerWithThreeOfSpades<TPlayer extends { hand: readonly Card[] }>(
	players: readonly TPlayer[]
): TPlayer | undefined {
	return players.find((player) => player.hand.some(isThreeOfSpades));
}

function assertValidPlayerCount(playerCount: number): void {
	if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
		throw new RangeError(`Murlan supports ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
	}
}

function randomUnit(): number {
	const crypto = globalThis.crypto;

	if (crypto?.getRandomValues) {
		const values = new Uint32Array(1);
		crypto.getRandomValues(values);
		return values[0] / 0x100000000;
	}

	return Math.random();
}

function createSeededRandom(seed: ShuffleSeed): () => number {
	let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);

	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);

		return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
	};
}

function hashSeed(seed: string): number {
	let hash = 2166136261;

	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return hash >>> 0;
}
