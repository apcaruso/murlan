import type { Card } from '../lib/game/cards';
import { GameActionError } from '../lib/game/actions';

export type ClientCard = Card & { id: string };

export function getCardId(card: Card): string {
	return 'suit' in card ? `${card.suit}-${card.rank}` : card.rank;
}

export function toClientCard(card: Card): ClientCard {
	return {
		...card,
		id: getCardId(card)
	} as ClientCard;
}

export function toClientCards(cards: readonly Card[]): ClientCard[] {
	return cards.map(toClientCard);
}

export function selectCardsByIds(hand: readonly Card[], cardIds: readonly string[]): Card[] {
	const cardsById = new Map(hand.map((card) => [getCardId(card), card] as const));
	const selectedCards: Card[] = [];

	for (const cardId of cardIds) {
		const card = cardsById.get(cardId);

		if (!card) {
			throw new GameActionError('cards_not_owned');
		}

		selectedCards.push(card);
		cardsById.delete(cardId);
	}

	return selectedCards;
}
