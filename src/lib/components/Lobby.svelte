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
</script>

<section class="lobby-grid">
	<div class="panel room-summary">
		<p class="eyebrow">Stanza</p>
		<div class="room-code-row">
			<h1>{snapshot.room.code}</h1>
			<span>{players.length}/{snapshot.room.maxPlayers}</span>
		</div>
		<p class="phase-copy">
			Fase <strong>{snapshot.state.phase}</strong>. Ready {readyPlayers}/{players.length}.
		</p>

		<InviteLink inviteUrl={snapshot.room.inviteUrl} />
	</div>

	<div class="panel player-panel">
		<PlayerList {players} currentPlayerId={currentPlayer?.id ?? null} />
	</div>

	<div class="panel actions-panel">
		<div>
			<p class="eyebrow">Azioni lobby</p>
			<h2>{currentPlayer?.isHost ? 'Controlli host' : 'Preparazione player'}</h2>
		</div>

		<div class="actions">
			{#if currentPlayer?.isHost}
				<button type="button" on:click={onStartGame} disabled={!canStart || isActing}>
					Start Game
				</button>
				{#if snapshot.state.phase !== 'ready'}
					<p class="hint">Tutti i non-host devono essere ready prima di iniziare.</p>
				{/if}
			{:else}
				<button type="button" on:click={onReadyToggle} disabled={!canToggleReady || isActing}>
					{currentPlayer?.ready ? 'Annulla ready' : 'Sono ready'}
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

	<div class="panel hand-panel">
		<h2>La tua mano</h2>
		{#if snapshot.hand.length > 0}
			<div class="hand-list">
				{#each snapshot.hand as card}
					<span>{card.id}</span>
				{/each}
			</div>
		{:else}
			<p>Le carte saranno visibili quando la partita parte.</p>
		{/if}
	</div>
</section>

<style>
	.lobby-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
		gap: 1rem;
		width: min(100%, 70rem);
		margin: 0 auto;
	}

	.panel {
		border: 1px solid rgba(246, 242, 233, 0.14);
		border-radius: 1.4rem;
		padding: 1.1rem;
		background: rgba(246, 242, 233, 0.08);
		box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.24);
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		color: #8df0ad;
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.16em;
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
		letter-spacing: -0.06em;
	}

	h2 {
		margin-bottom: 0.5rem;
		font-size: 1.1rem;
	}

	.room-code-row span {
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		background: rgba(141, 240, 173, 0.16);
		color: #8df0ad;
		font-weight: 900;
	}

	.phase-copy,
	.hint {
		color: #b7c8bc;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	button {
		border: 0;
		border-radius: 999px;
		padding: 0.85rem 1rem;
		background: #8df0ad;
		color: #0d1711;
		font: inherit;
		font-weight: 900;
		cursor: pointer;
	}

	button.danger {
		background: #ffb4a8;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.error {
		margin: 0.9rem 0 0;
		color: #ffb4a8;
		font-weight: 800;
	}

	.hand-panel {
		grid-column: 1 / -1;
	}

	.hand-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.hand-list span {
		border-radius: 0.8rem;
		padding: 0.55rem 0.7rem;
		background: #f6f2e9;
		color: #111816;
		font-weight: 900;
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
