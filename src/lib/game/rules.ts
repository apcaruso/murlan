import { getCardValue, isJoker, isThreeOfSpades, sortCards } from './cards';
import type { Card } from './cards';

export const FIRST_HAND_NUMBER = 1;

export type CombinationType = 'single' | 'pair' | 'triple' | 'four' | 'straight';

export type Combination = {
	type: CombinationType;
	cards: Card[];
	length: number;
	value: number;
};

export function detectCombination(cards: readonly Card[]): Combination | null {
	if (isSingle(cards)) {
		return createCombination('single', cards);
	}

	if (isPair(cards)) {
		return createCombination('pair', cards);
	}

	if (isTriple(cards)) {
		return createCombination('triple', cards);
	}

	if (isFour(cards)) {
		return createCombination('four', cards);
	}

	if (isStraight(cards)) {
		return createCombination('straight', cards);
	}

	return null;
}

export function canBeat(candidate: Combination, previous: Combination): boolean {
	return (
		candidate.type === previous.type &&
		candidate.length === previous.length &&
		candidate.value > previous.value
	);
}

export function isValidResponse(
	candidateCards: readonly Card[],
	previousCombination: Combination
): boolean {
	const candidateCombination = detectCombination(candidateCards);

	return candidateCombination !== null && canBeat(candidateCombination, previousCombination);
}

export function isValidOpeningMove(
	cards: readonly Card[],
	handNumber: number,
	isFirstMove: boolean
): boolean {
	const combination = detectCombination(cards);

	if (combination === null) {
		return false;
	}

	if (handNumber === FIRST_HAND_NUMBER && isFirstMove) {
		return cards.some(isThreeOfSpades);
	}

	return true;
}

export function isSingle(cards: readonly Card[]): boolean {
	return cards.length === 1;
}

export function isPair(cards: readonly Card[]): boolean {
	return hasSameValue(cards, 2);
}

export function isTriple(cards: readonly Card[]): boolean {
	return hasSameValue(cards, 3);
}

export function isFour(cards: readonly Card[]): boolean {
	return hasSameValue(cards, 4);
}

export function isStraight(cards: readonly Card[]): boolean {
	if (cards.length < 4 || cards.some(isJoker)) {
		return false;
	}

	const values = sortCards(cards).map(getCardValue);

	return values.every((value, index) => index === 0 || value === values[index - 1] + 1);
}

function hasSameValue(cards: readonly Card[], expectedLength: number): boolean {
	if (cards.length !== expectedLength) {
		return false;
	}

	const [firstCard] = cards;
	const firstValue = getCardValue(firstCard);

	return cards.every((card) => getCardValue(card) === firstValue);
}

function createCombination(type: CombinationType, cards: readonly Card[]): Combination {
	const sortedCards = sortCards(cards);
	const highestCard = sortedCards[sortedCards.length - 1];

	return {
		type,
		cards: sortedCards,
		length: sortedCards.length,
		value: getCardValue(highestCard)
	};
}
