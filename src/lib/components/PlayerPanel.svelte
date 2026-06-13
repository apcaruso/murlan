<script lang="ts">
	import type { PublicPlayer } from '../../worker/types';

	export let player: PublicPlayer;
	export let isCurrent = false;
	export let isController = false;
	export let isSelf = false;
	export let hasPassed = false;
</script>

<article class="player-panel" class:current={isCurrent} class:self={isSelf}>
	<div>
		<strong>{player.name}</strong>
		<span>{player.cardCount} carte · {player.score} punti</span>
	</div>

	<div class="badges">
		{#if isSelf}<span>tu</span>{/if}
		{#if player.isHost}<span>capo tavolo</span>{/if}
		{#if isCurrent}<span class="turn">turno</span>{/if}
		{#if isController}<span class="control">controllo</span>{/if}
		{#if hasPassed}<span>pass</span>{/if}
		<span class:connected={player.connected}>{player.connected ? 'online' : 'offline'}</span>
	</div>
</article>

<style>
	.player-panel {
		display: grid;
		gap: 0.7rem;
		border: 1px solid var(--line);
		border-radius: 1rem;
		padding: 0.85rem;
		background: var(--wash);
		text-align: center;
	}

	.player-panel.current {
		border-color: var(--white);
		box-shadow: 0 0 0 2px rgba(247, 247, 242, 0.16);
	}

	.player-panel.self {
		background: var(--wash-strong);
	}

	strong,
	span {
		display: block;
	}

	strong {
		font-size: 1rem;
	}

	div > span {
		color: var(--white-2);
		font-size: 0.9rem;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem;
	}

	.badges span {
		display: inline-grid;
		min-height: 1.65rem;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 0.3rem 0.55rem;
		background: transparent;
		color: var(--white-2);
		font-size: 0.68rem;
		font-weight: 900;
		text-align: center;
		text-transform: uppercase;
	}

	.badges .turn,
	.badges .control,
	.badges .connected {
		border-color: var(--white);
		background: var(--white);
		color: var(--black);
	}

	@media (max-width: 760px) {
		.player-panel {
			gap: 0.4rem;
			border-radius: 0.8rem;
			padding: 0.55rem;
		}

		strong {
			overflow: hidden;
			font-size: 0.9rem;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		div > span {
			font-size: 0.74rem;
		}

		.badges {
			gap: 0.25rem;
		}

		.badges span {
			min-height: 1.35rem;
			padding: 0.22rem 0.38rem;
			font-size: 0.56rem;
		}
	}
</style>
