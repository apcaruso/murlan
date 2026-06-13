<script lang="ts">
	import type { ClientCard } from '../cloudflare/rooms';

	export let card: ClientCard;
	export let selected = false;
	export let disabled = false;
	export let onToggle: (cardId: string) => void = () => {};

	$: suit = 'suit' in card ? card.suit : null;
	$: isRed = suit === 'hearts' || suit === 'diamonds' || card.rank === 'red_joker';
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
	class:red={isRed}
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
		min-width: 4.2rem;
		min-height: 5.8rem;
		border: 1px solid rgba(17, 24, 22, 0.18);
		border-radius: 0.9rem;
		padding: 0.65rem;
		background: #f6f2e9;
		color: #111816;
		box-shadow: 0 0.6rem 1.5rem rgba(0, 0, 0, 0.2);
		cursor: pointer;
		font: inherit;
		text-align: left;
		transition:
			transform 120ms ease,
			box-shadow 120ms ease,
			outline-color 120ms ease;
	}

	.card:hover:not(:disabled),
	.card.selected {
		transform: translateY(-0.55rem);
		box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.28);
	}

	.card.selected {
		outline: 3px solid #8df0ad;
		outline-offset: 2px;
	}

	.card.red {
		color: #b93636;
	}

	.card:disabled {
		cursor: not-allowed;
		opacity: 0.64;
	}

	.rank {
		display: block;
		font-size: 1.35rem;
		font-weight: 950;
		letter-spacing: -0.04em;
	}

	.id {
		position: absolute;
		right: 0.55rem;
		bottom: 0.55rem;
		left: 0.55rem;
		color: rgba(17, 24, 22, 0.6);
		font-size: 0.62rem;
		font-weight: 900;
		line-height: 1.1;
		text-transform: uppercase;
	}

	.card.red .id {
		color: rgba(185, 54, 54, 0.65);
	}
</style>
