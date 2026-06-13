<script lang="ts">
	import type { RoomSnapshot } from '../cloudflare/rooms';
	import InviteLink from './InviteLink.svelte';
	import PlayerList from './PlayerList.svelte';

	export let snapshot: RoomSnapshot;
	export let isActing = false;
	export let error = '';
	export let onReadyToggle: () => void | Promise<void> = () => {};
	export let onStartGame: () => void | Promise<void> = () => {};
	export let onLeaveRoom: () => void | Promise<void> = () => {};

	$: players = snapshot.state.players;
	$: currentPlayer = snapshot.player;
	$: isLobbyPhase = snapshot.state.phase === 'waiting' || snapshot.state.phase === 'ready';
	$: canToggleReady = Boolean(currentPlayer && !currentPlayer.isHost && isLobbyPhase);
	$: canStart = currentPlayer?.isHost === true && snapshot.state.phase === 'ready';
	$: readyPlayers = players.filter((player) => player.ready || player.isHost).length;

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
</script>

<section class="lobby-grid">
	<div class="panel room-summary">
		<p class="eyebrow">Stanza</p>
		<div class="room-code-row">
			<h1>{snapshot.room.code}</h1>
			<span>{players.length}/{snapshot.room.maxPlayers}</span>
		</div>
		<p class="phase-copy">
			<strong>{phaseLabel(snapshot.state.phase)}</strong>. Pronti {readyPlayers}/{players.length}.
		</p>

		<InviteLink inviteUrl={snapshot.room.inviteUrl} />
	</div>

	<div class="panel player-panel">
		<PlayerList {players} currentPlayerId={currentPlayer?.id ?? null} />
	</div>

	<div class="panel actions-panel">
		<div>
			<p class="eyebrow">Tavolo</p>
			<h2>{currentPlayer?.isHost ? 'Controlli tavolo' : 'Preparati'}</h2>
		</div>

		<div class="actions">
			{#if currentPlayer?.isHost}
				<button type="button" on:click={onStartGame} disabled={!canStart || isActing}>
					Avvia partita
				</button>
				{#if snapshot.state.phase !== 'ready'}
					<p class="hint">Tutti gli altri giocatori devono essere pronti prima di iniziare.</p>
				{/if}
			{:else}
				<button type="button" on:click={onReadyToggle} disabled={!canToggleReady || isActing}>
					{currentPlayer?.ready ? 'Non pronto' : 'Sono pronto'}
				</button>
			{/if}

			<button type="button" class="danger" on:click={onLeaveRoom} disabled={isActing}>
				Lascia stanza
			</button>
		</div>

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
	</div>
</section>

<style>
	.lobby-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
		gap: 1rem;
		width: min(100%, 76rem);
		margin: 0 auto;
	}

	.panel {
		border: 1px solid var(--line);
		border-radius: 1.4rem;
		padding: clamp(1rem, 2.5vw, 1.35rem);
		background: rgba(5, 5, 5, 0.72);
		box-shadow: var(--shadow);
		backdrop-filter: blur(16px);
	}

	.room-summary {
		position: relative;
		overflow: hidden;
	}

	.room-summary::after {
		position: absolute;
		right: -4rem;
		bottom: -4rem;
		width: 14rem;
		height: 14rem;
		border: 1px solid var(--line);
		border-radius: 50%;
		content: '';
		opacity: 0.75;
		pointer-events: none;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		color: var(--white-2);
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.22em;
		text-transform: uppercase;
	}

	.room-code-row {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 0;
		font-size: clamp(2rem, 8vw, 4.5rem);
		line-height: 0.95;
		letter-spacing: -0.08em;
		text-transform: uppercase;
	}

	h2 {
		margin-bottom: 0.5rem;
		font-size: 1.1rem;
	}

	.room-code-row span {
		display: inline-grid;
		min-height: 2.1rem;
		place-items: center;
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--line);
		background: var(--wash);
		color: var(--white);
		font-weight: 900;
		text-align: center;
	}

	.phase-copy,
	.hint {
		color: var(--white-2);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	button {
		display: inline-grid;
		min-height: 2.8rem;
		place-items: center;
		border: 1px solid var(--white);
		border-radius: 999px;
		padding: 0.85rem 1rem;
		background: var(--white);
		color: var(--black);
		font: inherit;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-align: center;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			transform 140ms ease,
			background 140ms ease,
			color 140ms ease;
	}

	button:hover:not(:disabled) {
		transform: translateY(-2px);
		background: var(--black);
		color: var(--white);
	}

	button.danger {
		border-color: var(--line-strong);
		background: transparent;
		color: var(--white);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.error {
		margin: 0.9rem 0 0;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		padding: 0.7rem 0.85rem;
		background: var(--wash);
		color: var(--white);
		font-weight: 800;
		text-align: center;
	}

	@media (max-width: 760px) {
		.lobby-grid {
			grid-template-columns: 1fr;
		}

		.room-code-row,
		.actions {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
