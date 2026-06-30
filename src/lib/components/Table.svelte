<script lang="ts">
	import type { PublicRoomState } from '../../worker/types';
	import { getCardDetailLabel, getCardFaceLabel } from '../game/cards';
	import CardIcon from './CardIcon.svelte';
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

	function phaseLabel(phase: string): string {
		const labels: Record<string, string> = {
			waiting: 'In attesa',
			ready: 'Si parte',
			playing: 'In gioco',
			hand_finished: 'Mano finita',
			game_finished: 'Partita finita'
		};

		return labels[phase] ?? phase;
	}

	function combinationLabel(type: string): string {
		const labels: Record<string, string> = {
			single: 'Singola',
			pair: 'Coppia',
			triple: 'Tris',
			four: 'Poker',
			straight: 'Scala'
		};

		return labels[type] ?? type;
	}
</script>

<section class="table-panel">
	<div class="table-header">
		<div>
			<p class="eyebrow">Tavolo</p>
			<h2>Mano {state.handNumber || '-'}</h2>
		</div>
		<span class="phase">{phaseLabel(state.phase)}</span>
	</div>

	<div class="center-play">
		{#if state.lastPlay}
			<p>Ultima giocata di <strong>{playerName(state.lastPlay.playerId)}</strong></p>
			<div class="played-cards">
				{#each state.lastPlay.cards as card}
					<span class="played-card">
						<span class="played-rank">{getCardFaceLabel(card)}</span>
						<CardIcon {card} />
						<span class="played-label">{getCardDetailLabel(card)}</span>
					</span>
				{/each}
			</div>
			<small>{combinationLabel(state.lastPlay.combination.type)}</small>
		{:else}
			<p>Nessuna giocata sul tavolo.</p>
			<small>Chi ha il controllo puo aprire il prossimo colpo.</small>
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
		grid-template-rows: auto minmax(13rem, 1fr) auto auto;
		gap: clamp(0.75rem, 1.5vw, 1rem);
		min-height: 100%;
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
		color: var(--white-2);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.22em;
		text-transform: uppercase;
	}

	h2,
	p {
		margin: 0;
	}

	.phase {
		display: inline-grid;
		min-height: 2rem;
		place-items: center;
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		background: var(--wash);
		color: var(--white);
		font-weight: 900;
		text-align: center;
		text-transform: uppercase;
	}

	.center-play {
		position: relative;
		min-height: clamp(13rem, 32vh, 24rem);
		display: grid;
		place-items: center;
		gap: 0.75rem;
		border-radius: 1.35rem;
		padding: 1rem;
		background: var(--wash);
		text-align: center;
		overflow: hidden;
	}

	.center-play > * {
		position: relative;
		z-index: 1;
	}

	.played-cards {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.45rem;
	}

	.played-card {
		display: grid;
		grid-template-rows: auto 1fr auto;
		width: clamp(3.65rem, 7vw, 4.8rem);
		aspect-ratio: 5 / 7;
		align-items: center;
		justify-items: center;
		gap: 0.18rem;
		border-radius: 0.82rem;
		padding: 0.45rem 0.35rem;
		background: var(--white);
		color: var(--black);
		font-weight: 900;
		text-align: center;
		text-transform: uppercase;
		box-shadow: 0 0.55rem 1.3rem rgba(0, 0, 0, 0.28);
	}

	.played-rank {
		font-size: clamp(1.05rem, 2vw, 1.35rem);
		letter-spacing: -0.04em;
		line-height: 1;
	}

	.played-label {
		max-width: 100%;
		overflow: hidden;
		font-size: 0.55rem;
		line-height: 1;
		opacity: 0.62;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	small,
	.turn-strip {
		color: var(--white-2);
	}

	.turn-strip {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-items: stretch;
		gap: 0.55rem;
		border-radius: 1rem;
		padding: 0;
		background: transparent;
		font-size: 0.92rem;
	}

	.turn-strip p {
		display: grid;
		place-items: center;
		min-height: 3rem;
		border-radius: 0.85rem;
		padding: 0.65rem;
		background: var(--wash);
		text-align: center;
	}

	.turn-strip strong {
		color: var(--white);
	}

	.players-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: 0.75rem;
	}

	@media (max-width: 760px) {
		.table-panel {
			grid-template-rows: auto minmax(10rem, auto) auto auto;
			gap: 0.5rem;
		}

		.table-header,
		.turn-strip {
			align-items: stretch;
		}

		.table-header {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			flex-direction: column;
			gap: 0.55rem;
		}

		.table-header h2 {
			font-size: 1rem;
		}

		.phase {
			min-height: 1.9rem;
			padding: 0.3rem 0.55rem;
			font-size: 0.72rem;
		}

		.turn-strip {
			grid-template-columns: repeat(3, minmax(7.2rem, 1fr));
			overflow-x: auto;
			padding-bottom: 0.15rem;
			scroll-snap-type: x proximity;
		}

		.turn-strip p {
			min-height: 2.55rem;
			padding: 0.45rem 0.55rem;
			font-size: 0.78rem;
			scroll-snap-align: start;
		}

		.center-play {
			min-height: clamp(8.2rem, 24dvh, 10rem);
			border-radius: 0.95rem;
			padding: 0.7rem;
			gap: 0.5rem;
		}

		.played-cards {
			gap: 0.35rem;
		}

		.played-card {
			width: 3.15rem;
			padding: 0.36rem 0.28rem;
			border-radius: 0.72rem;
		}

		.played-rank {
			font-size: 1.05rem;
		}

		.played-label {
			font-size: 0.48rem;
		}

		.players-grid {
			display: flex;
			gap: 0.45rem;
			overflow-x: auto;
			overflow-y: hidden;
			padding: 0.1rem 0 0.35rem;
			scroll-padding-inline: 0.5rem;
			scroll-snap-type: x proximity;
		}

		.players-grid :global(.player-panel) {
			flex: 0 0 8.7rem;
			scroll-snap-align: start;
		}
	}
</style>
