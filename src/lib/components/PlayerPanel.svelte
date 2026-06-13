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
		{#if player.isHost}<span>host</span>{/if}
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
		border: 1px solid rgba(246, 242, 233, 0.14);
		border-radius: 1rem;
		padding: 0.85rem;
		background: rgba(8, 12, 10, 0.28);
	}

	.player-panel.current {
		border-color: rgba(141, 240, 173, 0.72);
		box-shadow: 0 0 0 2px rgba(141, 240, 173, 0.18);
	}

	.player-panel.self {
		background: rgba(141, 240, 173, 0.08);
	}

	strong,
	span {
		display: block;
	}

	strong {
		font-size: 1rem;
	}

	div > span {
		color: #b7c8bc;
		font-size: 0.9rem;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.badges span {
		border-radius: 999px;
		padding: 0.3rem 0.55rem;
		background: rgba(246, 242, 233, 0.08);
		color: #d8d4c9;
		font-size: 0.68rem;
		font-weight: 900;
		text-transform: uppercase;
	}

	.badges .turn,
	.badges .control,
	.badges .connected {
		color: #8df0ad;
	}
</style>
