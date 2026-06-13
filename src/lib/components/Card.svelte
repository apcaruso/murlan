<script lang="ts">
	import type { ClientCard } from '../cloudflare/rooms';

	export let card: ClientCard;
	export let selected = false;
	export let disabled = false;
	export let onToggle: (cardId: string) => void = () => {};

	$: suit = 'suit' in card ? card.suit : null;
	$: label = suit ? `${card.rank}${suitSymbol(suit)}` : jokerLabel(card.rank);

	function suitSymbol(suitName: string): string {
		const symbols: Record<string, string> = {
			clubs: 'C',
			diamonds: 'D',
			hearts: 'H',
			spades: 'S'
		};

		return symbols[suitName] ?? '';
	}

	function jokerLabel(rank: string): string {
		return rank === 'red_joker' ? 'RJ' : 'BJ';
	}
</script>

<button
	type="button"
	class="card"
	class:selected
	disabled={disabled}
	on:click={() => onToggle(card.id)}
	aria-pressed={selected}
	aria-label={`Carta ${card.id}`}
>
	<span class="rank">{label}</span>
	<span class="id">{card.id}</span>
</button>

<style>
	.card {
		position: relative;
		display: grid;
		grid-template-rows: 1fr auto;
		place-items: center;
		min-width: clamp(4.35rem, 8vw, 5.35rem);
		min-height: clamp(6.1rem, 11vw, 7.45rem);
		border: 1px solid var(--white);
		border-radius: 1rem;
		padding: 0.65rem;
		background: var(--white);
		color: var(--black);
		box-shadow: 0 0.8rem 1.8rem rgba(0, 0, 0, 0.34);
		cursor: pointer;
		font: inherit;
		text-align: center;
		transition:
			transform 120ms ease,
			box-shadow 120ms ease,
			background 120ms ease,
			color 120ms ease;
	}

	.card:hover:not(:disabled),
	.card.selected {
		transform: translateY(-0.65rem) scale(1.02);
		box-shadow: 0 1.2rem 2.2rem rgba(0, 0, 0, 0.48);
	}

	.card.selected {
		z-index: 2;
		background: var(--black);
		color: var(--white);
		box-shadow:
			0 0 0 2px var(--white),
			0 1.2rem 2.2rem rgba(0, 0, 0, 0.58);
	}

	.card:disabled {
		cursor: not-allowed;
		opacity: 0.64;
	}

	.rank {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		font-size: clamp(1.25rem, 3vw, 1.75rem);
		font-weight: 950;
		letter-spacing: -0.04em;
		line-height: 1;
		text-transform: uppercase;
	}

	.id {
		display: block;
		max-width: 100%;
		overflow: hidden;
		color: currentColor;
		font-size: 0.62rem;
		font-weight: 900;
		line-height: 1.1;
		opacity: 0.62;
		text-align: center;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
	}

	@media (max-width: 760px) {
		.card {
			min-width: 3.7rem;
			min-height: 5.25rem;
			border-radius: 0.78rem;
			padding: 0.45rem;
		}

		.card:hover:not(:disabled),
		.card.selected {
			transform: translateY(-0.55rem) scale(1.02);
		}

		.rank {
			font-size: 1.18rem;
		}

		.id {
			font-size: 0.52rem;
		}
	}
</style>
