<script lang="ts">
	import type { ClientCard } from '../cloudflare/rooms';
	import { sortCards } from '../game/cards';
	import CardComponent from './Card.svelte';

	export let cards: ClientCard[] = [];
	export let selectedCardIds: string[] = [];
	export let disabled = false;
	export let highlightedCardIds: string[] = [];
	export let onToggleCard: (cardId: string) => void = () => {};

	$: sortedCards = sortCards(cards);
	$: selected = new Set(selectedCardIds);
	$: highlighted = new Set(highlightedCardIds);
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
					highlighted={highlighted.has(card.id)}
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
		gap: 0.75rem;
		min-width: 0;
	}

	.hand-header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.3rem;
		color: var(--white-2);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.22em;
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
		color: var(--white-2);
		font-weight: 800;
	}

	.cards {
		display: flex;
		gap: clamp(0.45rem, 1.2vw, 0.7rem);
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-x: contain;
		padding: 0.75rem 0.25rem 1.05rem;
		scroll-padding-inline: 1rem;
		scroll-snap-type: x proximity;
		touch-action: pan-x pinch-zoom;
		-webkit-overflow-scrolling: touch;
	}

	.cards :global(.card) {
		flex: 0 0 auto;
		scroll-snap-align: center;
	}

	@media (max-width: 760px) {
		.hand {
			gap: 0.45rem;
		}

		.hand-header {
			align-items: flex-start;
			gap: 0.55rem;
		}

		.hand-header h2 {
			font-size: 0.95rem;
		}

		.hand-header span {
			font-size: 0.78rem;
		}

		.cards {
			gap: 0;
			margin-inline: -0.6rem;
			overflow-y: visible;
			overscroll-behavior-inline: contain;
			padding: 0.75rem 0.6rem 1rem;
			scroll-snap-type: x mandatory;
		}

		.cards :global(.card) {
			margin-right: -1.15rem;
			scroll-snap-align: start;
		}

		.cards :global(.card:last-child) {
			margin-right: 0;
		}

		.cards :global(.card.selected) {
			margin-right: -0.55rem;
		}
	}
</style>
