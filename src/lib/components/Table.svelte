<script lang="ts">
	import type { PublicRoomState } from '../../worker/types';
	import PlayerPanel from './PlayerPanel.svelte';

	export let state: PublicRoomState;
	export let currentPlayerId: string | null = null;

	$: currentPlayer = state.players.find((player) => player.id === state.currentPlayerId) ?? null;
	$: controllerPlayer = state.players.find((player) => player.id === state.controllerPlayerId) ?? null;
	$: passedNames = state.passedPlayerIds
		.map((playerId) => state.players.find((player) => player.id === playerId)?.name)
		.filter((name): name is string => Boolean(name));

	function playerName(playerId: string): string {
		return state.players.find((player) => player.id === playerId)?.name ?? playerId;
	}
</script>

<section class="table-panel">
	<div class="table-header">
		<div>
			<p class="eyebrow">Tavolo</p>
			<h2>Mano {state.handNumber || '-'}</h2>
		</div>
		<span class="phase">{state.phase}</span>
	</div>

	<div class="center-play">
		{#if state.lastPlay}
			<p>Ultima giocata di <strong>{playerName(state.lastPlay.playerId)}</strong></p>
			<div class="played-cards">
				{#each state.lastPlay.cards as card}
					<span>{card.id}</span>
				{/each}
			</div>
			<small>{state.lastPlay.combination.type} · valore {state.lastPlay.combination.value}</small>
		{:else}
			<p>Nessuna giocata sul tavolo.</p>
			<small>Chi ha il controllo puo aprire una nuova combinazione.</small>
		{/if}
	</div>

	<div class="turn-strip">
		<p>Turno: <strong>{currentPlayer?.name ?? 'nessuno'}</strong></p>
		<p>Controllo: <strong>{controllerPlayer?.name ?? 'nessuno'}</strong></p>
		<p>Pass: <strong>{passedNames.length > 0 ? passedNames.join(', ') : 'nessuno'}</strong></p>
	</div>

	<div class="players-grid">
		{#each state.players as player}
			<PlayerPanel
				{player}
				isCurrent={player.id === state.currentPlayerId}
				isController={player.id === state.controllerPlayerId}
				isSelf={player.id === currentPlayerId}
				hasPassed={state.passedPlayerIds.includes(player.id)}
			/>
		{/each}
	</div>
</section>

<style>
	.table-panel {
		display: grid;
		gap: 1rem;
	}

	.table-header,
	.turn-strip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.3rem;
		color: #8df0ad;
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	h2,
	p {
		margin: 0;
	}

	.phase {
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		background: rgba(141, 240, 173, 0.16);
		color: #8df0ad;
		font-weight: 900;
		text-transform: uppercase;
	}

	.center-play {
		min-height: 8rem;
		display: grid;
		place-items: center;
		gap: 0.75rem;
		border: 1px dashed rgba(246, 242, 233, 0.22);
		border-radius: 1.2rem;
		padding: 1rem;
		background: rgba(8, 12, 10, 0.24);
		text-align: center;
	}

	.played-cards {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.45rem;
	}

	.played-cards span {
		border-radius: 0.65rem;
		padding: 0.5rem 0.65rem;
		background: #f6f2e9;
		color: #111816;
		font-weight: 900;
	}

	small,
	.turn-strip {
		color: #b7c8bc;
	}

	.turn-strip {
		align-items: stretch;
		border-radius: 1rem;
		padding: 0.8rem;
		background: rgba(8, 12, 10, 0.22);
		font-size: 0.92rem;
	}

	.players-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.75rem;
	}

	@media (max-width: 760px) {
		.table-header,
		.turn-strip {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
