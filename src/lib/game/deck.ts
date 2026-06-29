import { JOKER_RANKS, STANDARD_RANKS, SUITS, isThreeOfSpades } from './cards';
import type { Card } from './cards';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

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

export function shuffleDeck(deck: readonly Card[]): Card[] {
	const shuffled = [...deck];

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(randomUnit() * (index + 1));
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
