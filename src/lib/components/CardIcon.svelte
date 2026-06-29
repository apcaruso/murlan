<script lang="ts">
	import type { Card } from '../game/cards';

	export let card: Card;
	export let compact = false;

	$: suit = 'suit' in card ? card.suit : null;
	$: red = suit === 'hearts' || suit === 'diamonds' || card.rank === 'red_joker';
	$: symbol = suit ? { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[suit] : '🃏';
</script>

<span class="card-icon" class:compact class:red aria-hidden="true">{symbol}</span>

<style>
	.card-icon {
		display: inline-grid;
		width: clamp(1.85rem, 4vw, 2.75rem);
		aspect-ratio: 1;
		place-items: center;
		color: currentColor;
		font-size: clamp(1.8rem, 4vw, 2.65rem);
		font-weight: 900;
		line-height: 1;
		text-shadow: 0 0.08rem 0.06rem rgba(0, 0, 0, 0.18);
	}

	.card-icon.red {
		color: #b9132b;
	}

	.card-icon.compact {
		width: 1rem;
		font-size: 1rem;
	}

	@media (max-width: 760px) {
		.card-icon {
			width: 2rem;
			font-size: 2rem;
		}

		.card-icon.compact {
			width: 0.85rem;
			font-size: 0.85rem;
		}
	}
</style>
