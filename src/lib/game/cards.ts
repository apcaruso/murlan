export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

export const STANDARD_RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'] as const;
export type StandardRank = (typeof STANDARD_RANKS)[number];

export const JOKER_RANKS = ['black_joker', 'red_joker'] as const;
export type JokerRank = (typeof JOKER_RANKS)[number];

export const RANKS = [...STANDARD_RANKS, ...JOKER_RANKS] as const;
export type Rank = (typeof RANKS)[number];

export type StandardCard = {
	rank: StandardRank;
	suit: Suit;
};

export type JokerCard = {
	rank: JokerRank;
	suit?: never;
};

export type Card = StandardCard | JokerCard;

export const CARD_VALUES: Record<Rank, number> = {
	'3': 3,
	'4': 4,
	'5': 5,
	'6': 6,
	'7': 7,
	'8': 8,
	'9': 9,
	'10': 10,
	J: 11,
	Q: 12,
	K: 13,
	A: 14,
	'2': 15,
	black_joker: 16,
	red_joker: 17
};

const SUIT_VALUES: Record<Suit, number> = {
	clubs: 0,
	diamonds: 1,
	hearts: 2,
	spades: 3
};

const RANK_LABELS: Record<Rank, string> = {
	'3': '3',
	'4': '4',
	'5': '5',
	'6': '6',
	'7': '7',
	'8': '8',
	'9': '9',
	'10': '10',
	J: 'Fante',
	Q: 'Regina',
	K: 'Re',
	A: 'Asso',
	'2': '2',
	black_joker: 'Jolly nero',
	red_joker: 'Jolly rosso'
};

const SHORT_RANK_LABELS: Record<Rank, string> = {
	'3': '3',
	'4': '4',
	'5': '5',
	'6': '6',
	'7': '7',
	'8': '8',
	'9': '9',
	'10': '10',
	J: 'J',
	Q: 'Q',
	K: 'K',
	A: 'A',
	'2': '2',
	black_joker: 'Jolly',
	red_joker: 'Jolly'
};

const SUIT_LABELS: Record<Suit, string> = {
	clubs: 'Fiori',
	diamonds: 'Quadri',
	hearts: 'Cuori',
	spades: 'Picche'
};

const JOKER_DETAIL_LABELS: Record<JokerRank, string> = {
	black_joker: 'Nero',
	red_joker: 'Rosso'
};

export function getCardValue(card: Card): number {
	return CARD_VALUES[card.rank];
}

export function compareCardsAscending(a: Card, b: Card): number {
	const valueDifference = getCardValue(a) - getCardValue(b);

	if (valueDifference !== 0) {
		return valueDifference;
	}

	if (isJoker(a) || isJoker(b)) {
		return 0;
	}

	return SUIT_VALUES[a.suit] - SUIT_VALUES[b.suit];
}

export function sortCards<T extends Card>(cards: readonly T[]): T[] {
	return [...cards].sort(compareCardsAscending);
}

export function isJoker(card: Card): card is JokerCard {
	return card.rank === 'black_joker' || card.rank === 'red_joker';
}

export function isThreeOfSpades(card: Card): card is StandardCard & { rank: '3'; suit: 'spades' } {
	return !isJoker(card) && card.rank === '3' && card.suit === 'spades';
}

export function getCardLabel(card: Card): string {
	if (isJoker(card)) {
		return RANK_LABELS[card.rank];
	}

	return `${RANK_LABELS[card.rank]} di ${SUIT_LABELS[card.suit]}`;
}

export function getCardFaceLabel(card: Card): string {
	return SHORT_RANK_LABELS[card.rank];
}

export function getCardDetailLabel(card: Card): string {
	if (isJoker(card)) {
		return JOKER_DETAIL_LABELS[card.rank];
	}

	return SUIT_LABELS[card.suit];
}

export function getCardShortLabel(card: Card): string {
	if (isJoker(card)) {
		return getCardLabel(card);
	}

	return `${SHORT_RANK_LABELS[card.rank]} ${SUIT_LABELS[card.suit]}`;
}
