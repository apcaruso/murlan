<script lang="ts">
	import type { PublicPlayer } from '../../worker/types';

	export let players: PublicPlayer[] = [];
	export let currentPlayerId: string | null = null;
</script>

<div class="player-list">
	<div class="list-header">
		<h2>Giocatori</h2>
		<span>{players.length} al tavolo</span>
	</div>

	<ul>
		{#each players as player}
			<li class:current={player.id === currentPlayerId}>
				<div class="identity">
					<strong>{player.name}</strong>
					<span>Posto {player.seatIndex + 1} · {player.cardCount} carte · {player.score} punti</span>
				</div>

				<div class="badges" aria-label={`Stato ${player.name}`}>
					{#if player.isHost}<span class="host">capo tavolo</span>{/if}
					<span class:ready={player.ready}>{player.ready ? 'pronto' : 'non pronto'}</span>
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
		color: var(--white-2);
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
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.85rem;
		border: 1px solid var(--line);
		border-radius: 1rem;
		background: var(--wash);
	}

	li.current {
		border-color: var(--white);
		background: var(--wash-strong);
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
		color: var(--white-2);
		font-size: 0.9rem;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.35rem;
	}

	.badges span {
		display: inline-grid;
		min-height: 1.75rem;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 0.35rem 0.65rem;
		background: rgba(5, 5, 5, 0.52);
		color: var(--white-2);
		font-size: 0.72rem;
		font-weight: 900;
		text-align: center;
		text-transform: uppercase;
	}

	.badges span.host,
	.badges span.ready {
		border-color: var(--white);
		background: var(--white);
		color: var(--black);
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
