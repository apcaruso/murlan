<script lang="ts">
	import { isJoker } from '../game/cards';
	import type { Card } from '../game/cards';

	export let card: Card;
	export let compact = false;

	$: suit = 'suit' in card ? card.suit : null;
	$: red = suit === 'hearts' || suit === 'diamonds' || card.rank === 'red_joker';
	$: joker = isJoker(card);
</script>

<span class="card-icon" class:compact class:red class:joker aria-hidden="true">
	{#if suit === 'hearts'}
		<svg viewBox="0 0 64 64" focusable="false">
			<path d="M32 56S10.3 43.1 5.7 27.7C2.6 17.2 8.5 8 18 8c5.9 0 10.7 3.4 14 8.9C35.3 11.4 40.1 8 46 8c9.5 0 15.4 9.2 12.3 19.7C53.7 43.1 32 56 32 56Z" />
		</svg>
	{:else if suit === 'diamonds'}
		<svg viewBox="0 0 64 64" focusable="false">
			<path d="M32 4 58 32 32 60 6 32 32 4Z" />
		</svg>
	{:else if suit === 'clubs'}
		<svg viewBox="0 0 64 64" focusable="false">
			<path d="M27.2 43.2c-3.3 3.6-7.6 5.4-12 4.6C7.4 46.5 2.4 39.2 4.5 31.9c1.7-6 7.5-9.8 14-9.2a14.5 14.5 0 0 1-1.3-6.1C17.2 8.8 23.7 3 32 3s14.8 5.8 14.8 13.6c0 2.2-.5 4.2-1.3 6.1 6.5-.6 12.3 3.2 14 9.2 2.1 7.3-2.9 14.6-10.7 15.9-4.4.8-8.7-1-12-4.6.7 5.7 2.8 10.4 6.9 14.8H20.3c4.1-4.4 6.2-9.1 6.9-14.8Z" />
		</svg>
	{:else if suit === 'spades'}
		<svg viewBox="0 0 64 64" focusable="false">
			<path d="M32 4s21.7 12.9 26.3 28.3C61.4 42.8 55.5 52 46 52c-5.4 0-10-2.9-13.5-7.7.7 5.3 2.8 9.7 6.6 13.7H24.9c3.8-4 5.9-8.4 6.6-13.7C28 49.1 23.4 52 18 52c-9.5 0-15.4-9.2-12.3-19.7C10.3 16.9 32 4 32 4Z" />
		</svg>
	{:else}
		<svg viewBox="0 0 64 64" focusable="false">
			<path d="M13 53h38l-4.5-31.5-9.8 10.7L32 10l-4.7 22.2-9.8-10.7L13 53Z" />
			<circle cx="21" cy="48" r="3" />
			<circle cx="32" cy="48" r="3" />
			<circle cx="43" cy="48" r="3" />
		</svg>
	{/if}
</span>

<style>
	.card-icon {
		display: inline-grid;
		width: clamp(1.85rem, 4vw, 2.75rem);
		aspect-ratio: 1;
		place-items: center;
		color: currentColor;
		line-height: 0;
	}

	.card-icon.red {
		color: #b9132b;
	}

	.card-icon.joker {
		color: currentColor;
	}

	.card-icon.compact {
		width: 1rem;
	}

	svg {
		width: 100%;
		height: 100%;
		overflow: visible;
		fill: currentColor;
		filter: drop-shadow(0 0.08rem 0.06rem rgba(0, 0, 0, 0.18));
	}

	@media (max-width: 760px) {
		.card-icon {
			width: 2rem;
		}

		.card-icon.compact {
			width: 0.85rem;
		}
	}
</style>
