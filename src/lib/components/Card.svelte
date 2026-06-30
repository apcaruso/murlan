<script lang="ts">
	import type { ClientCard } from '../cloudflare/rooms';
	import { getCardDetailLabel, getCardFaceLabel, getCardLabel } from '../game/cards';
	import CardIcon from './CardIcon.svelte';

	export let card: ClientCard;
	export let selected = false;
	export let disabled = false;
	export let highlighted = false;
	export let highlightLabel = 'Obbligatoria';
	export let onToggle: (cardId: string) => void = () => {};

	$: faceLabel = getCardFaceLabel(card);
	$: detailLabel = getCardDetailLabel(card);
	$: fullLabel = getCardLabel(card);
</script>

<button
	type="button"
	class="card"
	class:selected
	class:highlighted
	disabled={disabled}
	on:click={() => onToggle(card.id)}
	aria-pressed={selected}
	aria-label={`Carta ${fullLabel}`}
>
	<span class="face">
		<span class="rank">{faceLabel}</span>
		<CardIcon {card} />
	</span>
	<span class="id">{detailLabel}</span>
	{#if highlighted}
		<span class="flag">{highlightLabel}</span>
	{/if}
</button>

<style>
	.card {
		position: relative;
		display: grid;
		grid-template-rows: 1fr auto;
		place-items: center;
		min-width: clamp(4.65rem, 8.8vw, 5.7rem);
		min-height: clamp(6.55rem, 12.2vw, 7.95rem);
		border: 0;
		border-radius: 1rem;
		padding: 0.7rem;
		background: var(--white);
		color: var(--black);
		box-shadow: 0 0.7rem 1.6rem rgba(0, 0, 0, 0.3);
		cursor: pointer;
		font: inherit;
		text-align: center;
		touch-action: manipulation;
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
			inset 0 0 0 2px var(--white),
			0 1.1rem 2rem rgba(0, 0, 0, 0.54);
	}

	.card.highlighted:not(.selected) {
		box-shadow:
			inset 0 0 0 2px rgba(17, 16, 13, 0.35),
			0 0.7rem 1.6rem rgba(0, 0, 0, 0.3);
	}

	.card:disabled {
		cursor: not-allowed;
		opacity: 0.64;
	}

	.face {
		display: grid;
		min-height: 0;
		place-items: center;
		gap: 0.22rem;
		align-content: center;
	}

	.rank {
		display: grid;
		place-items: center;
		width: 100%;
		font-size: clamp(1.35rem, 3vw, 1.9rem);
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

	.flag {
		position: absolute;
		top: -0.45rem;
		left: 50%;
		display: grid;
		min-height: 1.25rem;
		place-items: center;
		border-radius: 999px;
		padding: 0.18rem 0.45rem;
		background: var(--black);
		color: var(--white);
		font-size: 0.52rem;
		font-weight: 950;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		transform: translateX(-50%);
		white-space: nowrap;
	}

	@media (max-width: 760px) {
		.card {
			min-width: 4.55rem;
			min-height: 6.45rem;
			border-radius: 0.9rem;
			padding: 0.55rem;
		}

		.card:hover:not(:disabled),
		.card.selected {
			transform: translateY(-0.55rem) scale(1.02);
		}

		.face {
			gap: 0.12rem;
		}

		.rank {
			font-size: 1.48rem;
		}

		.id {
			font-size: 0.58rem;
		}

		.flag {
			top: -0.38rem;
			font-size: 0.46rem;
		}
	}
</style>
