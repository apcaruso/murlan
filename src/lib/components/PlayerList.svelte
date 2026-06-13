<script lang="ts">
	import type { PublicPlayer } from '../../worker/types';

	export let players: PublicPlayer[] = [];
	export let currentPlayerId: string | null = null;
</script>

<div class="player-list">
	<div class="list-header">
		<h2>Giocatori</h2>
		<span>{players.length} in lobby</span>
	</div>

	<ul>
		{#each players as player}
			<li class:current={player.id === currentPlayerId}>
				<div class="identity">
					<strong>{player.name}</strong>
					<span>Posto {player.seatIndex + 1} · {player.cardCount} carte · {player.score} punti</span>
				</div>

				<div class="badges" aria-label={`Stato ${player.name}`}>
					{#if player.isHost}<span class="host">host</span>{/if}
					<span class:ready={player.ready}>{player.ready ? 'ready' : 'non ready'}</span>
					<span class:connected={player.connected}>{player.connected ? 'online' : 'offline'}</span>
				</div>
			</li>
		{/each}
	</ul>
</div>

<style>
	.player-list {
		display: grid;
		gap: 0.9rem;
	}

	.list-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.list-header span {
		color: #b7c8bc;
		font-size: 0.9rem;
		font-weight: 800;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.7rem;
	}

	li {
		display: flex;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.85rem;
		border-radius: 1rem;
		background: rgba(8, 12, 10, 0.32);
	}

	li.current {
		outline: 2px solid rgba(141, 240, 173, 0.5);
	}

	.identity {
		display: grid;
		gap: 0.25rem;
	}

	.identity strong,
	.identity span {
		display: block;
	}

	.identity span {
		color: #b7c8bc;
		font-size: 0.9rem;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.35rem;
	}

	.badges span {
		border: 1px solid rgba(246, 242, 233, 0.16);
		border-radius: 999px;
		padding: 0.35rem 0.65rem;
		background: rgba(246, 242, 233, 0.08);
		color: #d8d4c9;
		font-size: 0.72rem;
		font-weight: 900;
		text-transform: uppercase;
	}

	.badges span.host {
		color: #f1d281;
	}

	.badges span.ready,
	.badges span.connected {
		color: #8df0ad;
	}

	@media (max-width: 760px) {
		.list-header,
		li {
			align-items: stretch;
			flex-direction: column;
		}

		.badges {
			justify-content: flex-start;
		}
	}
</style>
