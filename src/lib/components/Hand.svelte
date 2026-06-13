<script lang="ts">
	import type { ClientCard } from '../cloudflare/rooms';
	import CardComponent from './Card.svelte';

	export let cards: ClientCard[] = [];
	export let selectedCardIds: string[] = [];
	export let disabled = false;
	export let onToggleCard: (cardId: string) => void = () => {};

	const rankValues: Record<string, number> = {
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
	const suitValues: Record<string, number> = {
		clubs: 0,
		diamonds: 1,
		hearts: 2,
		spades: 3
	};

	$: sortedCards = [...cards].sort(compareCards);
	$: selected = new Set(selectedCardIds);

	function compareCards(left: ClientCard, right: ClientCard): number {
		const rankDifference = rankValues[left.rank] - rankValues[right.rank];

		if (rankDifference !== 0) {
			return rankDifference;
		}

		const leftSuit = 'suit' in left && left.suit ? suitValues[left.suit] : 0;
		const rightSuit = 'suit' in right && right.suit ? suitValues[right.suit] : 0;

		return leftSuit - rightSuit;
	}
</script>

<section class="hand" aria-label="La tua mano">
	<div class="hand-header">
		<div>
			<p class="eyebrow">Mano</p>
			<h2>Le tue carte</h2>
		</div>
		<span>{cards.length} carte</span>
	</div>

	{#if sortedCards.length > 0}
		<div class="cards">
			{#each sortedCards as card}
				<CardComponent
					{card}
					selected={selected.has(card.id)}
					{disabled}
					onToggle={onToggleCard}
				/>
			{/each}
		</div>
	{:else}
		<p class="empty">Le carte saranno visibili quando la mano parte.</p>
	{/if}
</section>

<style>
	.hand {
		display: grid;
		gap: 1rem;
	}

	.hand-header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.3rem;
		color: #8df0ad;
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	h2,
	p {
		margin: 0;
	}

	h2 {
		font-size: 1.1rem;
	}

	.hand-header span,
	.empty {
		color: #b7c8bc;
		font-weight: 800;
	}

	.cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		padding-top: 0.6rem;
	}
</style>
