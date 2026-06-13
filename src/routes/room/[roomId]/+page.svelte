<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ActionBar from '../../../lib/components/ActionBar.svelte';
	import ConnectionStatus from '../../../lib/components/ConnectionStatus.svelte';
	import GameLog from '../../../lib/components/GameLog.svelte';
	import Hand from '../../../lib/components/Hand.svelte';
	import Lobby from '../../../lib/components/Lobby.svelte';
	import Scoreboard from '../../../lib/components/Scoreboard.svelte';
	import Table from '../../../lib/components/Table.svelte';
	import {
		ApiRequestError,
		getRoomState,
		joinRoom,
		leaveRoom,
		passTurn,
		playCards,
		setReady,
		startGame,
		type RoomSnapshot
	} from '../../../lib/cloudflare/rooms';
	import { subscribeToRoom, type RoomSubscription } from '../../../lib/cloudflare/realtime';
	import { clearRoomSession, getRoomSession } from '../../../lib/cloudflare/session';

	type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

	let roomId = '';
	let inviteToken = '';
	let playerName = '';
	let snapshot: RoomSnapshot | null = null;
	let hasLocalSession = false;
	let connectionState: ConnectionState = 'idle';
	let connectionMessage = '';
	let isLoading = true;
	let isJoining = false;
	let isActing = false;
	let error = '';
	let selectedCardIds: string[] = [];
	let subscription: RoomSubscription | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectAttempts = 0;
	let realtimeEnabled = false;
	let activeConnectionId = 0;

	$: currentPlayer = snapshot?.player ?? null;
	$: isLobbyPhase = snapshot?.state.phase === 'waiting' || snapshot?.state.phase === 'ready';
	$: isCurrentTurn = snapshot?.state.phase === 'playing' && snapshot.state.currentPlayerId === currentPlayer?.id;
	$: canPlay = isCurrentTurn && selectedCardIds.length > 0;
	$: canPass = isCurrentTurn && snapshot?.state.lastPlay !== null;
	$: canStartNextHand = currentPlayer?.isHost === true && snapshot?.state.phase === 'hand_finished';
	$: if (snapshot) {
		const availableCardIds = new Set(snapshot.hand.map((card) => card.id));
		const validSelectedCardIds = selectedCardIds.filter((cardId) => availableCardIds.has(cardId));

		if (validSelectedCardIds.length !== selectedCardIds.length) {
			selectedCardIds = validSelectedCardIds;
		}
	}

	onMount(() => {
		const url = new URL(window.location.href);
		roomId = getRoomIdFromPath(url.pathname);
		inviteToken = url.searchParams.get('invite') ?? '';
		hasLocalSession = roomId.length > 0 && getRoomSession(roomId) !== null;

		if (!roomId) {
			error = 'Codice stanza mancante.';
			isLoading = false;
			return;
		}

		if (hasLocalSession) {
			void loadExistingSession();
		} else {
			isLoading = false;
		}
	});

	onDestroy(() => {
		disconnect();
	});

	async function loadExistingSession() {
		error = '';
		connectionMessage = '';
		isLoading = true;

		try {
			snapshot = await getRoomState(roomId);
			hasLocalSession = true;
			reconnectAttempts = 0;
			connectRealtime();
		} catch (caughtError) {
			handleSessionLoadError(caughtError);
		} finally {
			isLoading = false;
		}
	}

	async function handleJoinRoom() {
		error = '';
		isJoining = true;

		try {
			const response = await joinRoom(roomId, inviteToken, playerName);
			snapshot = response.snapshot;
			hasLocalSession = true;
			reconnectAttempts = 0;
			connectionMessage = '';
			connectRealtime();
		} catch (caughtError) {
			error = caughtError instanceof Error ? caughtError.message : 'Impossibile entrare nella stanza.';
		} finally {
			isJoining = false;
		}
	}

	async function handleReadyToggle() {
		if (!snapshot?.player) {
			return;
		}

		error = '';
		isActing = true;

		try {
			const response = await setReady(roomId, !snapshot.player.ready);
			snapshot = response.snapshot;
		} catch (caughtError) {
			error = caughtError instanceof Error ? caughtError.message : 'Ready non aggiornato.';
		} finally {
			isActing = false;
		}
	}

	async function handleStartGame() {
		error = '';
		isActing = true;

		try {
			const response = await startGame(roomId);
			snapshot = response.snapshot;
		} catch (caughtError) {
			error = caughtError instanceof Error ? caughtError.message : 'Impossibile iniziare la partita.';
		} finally {
			isActing = false;
		}
	}

	async function handlePlaySelectedCards() {
		if (!canPlay) {
			return;
		}

		error = '';
		isActing = true;

		try {
			const response = await playCards(roomId, selectedCardIds);
			snapshot = response.snapshot;
			selectedCardIds = [];
		} catch (caughtError) {
			error = caughtError instanceof Error ? caughtError.message : 'Giocata rifiutata.';
		} finally {
			isActing = false;
		}
	}

	async function handlePassTurn() {
		if (!canPass) {
			return;
		}

		error = '';
		isActing = true;

		try {
			const response = await passTurn(roomId);
			snapshot = response.snapshot;
			selectedCardIds = [];
		} catch (caughtError) {
			error = caughtError instanceof Error ? caughtError.message : 'Passaggio rifiutato.';
		} finally {
			isActing = false;
		}
	}

	function toggleSelectedCard(cardId: string) {
		if (!isCurrentTurn || isActing) {
			return;
		}

		selectedCardIds = selectedCardIds.includes(cardId)
			? selectedCardIds.filter((selectedCardId) => selectedCardId !== cardId)
			: [...selectedCardIds, cardId];
	}

	function clearSelection() {
		selectedCardIds = [];
	}

	async function handleLeaveRoom() {
		error = '';
		isActing = true;

		try {
			await leaveRoom(roomId);
			disconnect();
			snapshot = null;
			hasLocalSession = false;
		} catch (caughtError) {
			error = caughtError instanceof Error ? caughtError.message : 'Impossibile uscire dalla stanza.';
		} finally {
			isActing = false;
		}
	}

	function connectRealtime() {
		realtimeEnabled = true;
		clearReconnectTimer();
		closeSubscription();

		const connectionId = activeConnectionId + 1;
		activeConnectionId = connectionId;
		connectionState = reconnectAttempts > 0 ? 'reconnecting' : 'connecting';
		connectionMessage = reconnectAttempts > 0 ? `Tentativo ${reconnectAttempts + 1} di riconnessione.` : '';

		try {
			subscription = subscribeToRoom(roomId, {
				onOpen: () => {
					if (connectionId !== activeConnectionId) {
						return;
					}

					connectionState = 'connected';
					connectionMessage = '';
					reconnectAttempts = 0;
				},
				onClose: () => {
					if (connectionId !== activeConnectionId) {
						return;
					}

					subscription = null;
					scheduleReconnect('Connessione realtime chiusa. Riprovo automaticamente.');
				},
				onError: () => {
					if (connectionId !== activeConnectionId) {
						return;
					}

					connectionState = 'error';
					connectionMessage = 'Errore realtime. Se la connessione si chiude, riprovo automaticamente.';
				},
				onMessage: (message) => {
					if (connectionId !== activeConnectionId) {
						return;
					}

					if ('snapshot' in message) {
						snapshot = message.snapshot;
					}
				}
			});
		} catch (caughtError) {
			scheduleReconnect(caughtError instanceof Error ? caughtError.message : 'WebSocket non disponibile.');
		}
	}

	function disconnect() {
		realtimeEnabled = false;
		activeConnectionId += 1;
		clearReconnectTimer();
		closeSubscription();
		connectionState = snapshot ? 'disconnected' : 'idle';
		connectionMessage = '';
	}

	function closeSubscription() {
		subscription?.unsubscribe();
		subscription = null;
	}

	function scheduleReconnect(message: string) {
		if (!realtimeEnabled || !hasLocalSession) {
			connectionState = 'disconnected';
			connectionMessage = message;
			return;
		}

		connectionState = 'reconnecting';
		const delay = Math.min(1000 * 2 ** reconnectAttempts, 10000);
		connectionMessage = `${message} Prossimo tentativo tra ${Math.ceil(delay / 1000)}s.`;
		reconnectAttempts += 1;
		clearReconnectTimer();
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			void refreshAndReconnect();
		}, delay);
	}

	async function refreshAndReconnect() {
		if (!realtimeEnabled || !hasLocalSession) {
			return;
		}

		try {
			snapshot = await getRoomState(roomId);
			connectRealtime();
		} catch (caughtError) {
			if (isSessionError(caughtError)) {
				handleInvalidLocalSession(caughtError.message);
				return;
			}

			scheduleReconnect(caughtError instanceof Error ? caughtError.message : 'Riconnessione non riuscita.');
		}
	}

	function clearReconnectTimer() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
	}

	function handleSessionLoadError(caughtError: unknown) {
		if (isSessionError(caughtError)) {
			handleInvalidLocalSession(caughtError.message);
			return;
		}

		error = caughtError instanceof Error ? caughtError.message : 'Sessione locale non caricata.';
		hasLocalSession = false;
		connectionState = 'error';
		connectionMessage = 'Non riesco a recuperare lo stato stanza. Puoi riprovare ricaricando la pagina.';
	}

	function handleInvalidLocalSession(message: string) {
		clearRoomSession(roomId);
		disconnect();
		snapshot = null;
		hasLocalSession = false;
		error = `${message} Rientra con il link invito.`;
		connectionState = 'idle';
		connectionMessage = 'Sessione locale rimossa.';
	}

	function isSessionError(error: unknown): error is ApiRequestError {
		return (
			error instanceof ApiRequestError &&
			['unauthorized', 'invalid_player_session', 'not_room_participant'].includes(error.code)
		);
	}

	function getRoomIdFromPath(pathname: string): string {
		const parts = pathname.split('/').filter(Boolean);
		const roomIndex = parts.indexOf('room');
		const value = roomIndex === -1 ? parts.at(-1) : parts[roomIndex + 1];

		return value ? decodeURIComponent(value).trim().toUpperCase() : '';
	}
</script>

<svelte:head>
	<title>{roomId ? `${roomId} - Murlan` : 'Stanza Murlan'}</title>
</svelte:head>

<main class="room-shell">
	<header class="topbar">
		<a href="/" class="home-link">Murlan</a>
		<ConnectionStatus state={connectionState} detail={connectionMessage} />
	</header>

	{#if isLoading}
		<section class="panel loading-panel">Caricamento stanza...</section>
	{:else if snapshot && isLobbyPhase}
		<Lobby
			{snapshot}
			{isActing}
			{error}
			onReadyToggle={handleReadyToggle}
			onStartGame={handleStartGame}
			onLeaveRoom={handleLeaveRoom}
		/>
	{:else if snapshot}
		<section class="game-grid">
			<div class="panel table-card">
				<Table state={snapshot.state} currentPlayerId={currentPlayer?.id ?? null} />
			</div>

			<div class="panel score-card">
				<Scoreboard players={snapshot.state.players} targetScore={snapshot.state.targetScore} />
			</div>

			<div class="panel action-card">
				<ActionBar
					selectedCount={selectedCardIds.length}
					{isCurrentTurn}
					{canPlay}
					{canPass}
					{canStartNextHand}
					{isActing}
					{error}
					onPlay={handlePlaySelectedCards}
					onPass={handlePassTurn}
					onClearSelection={clearSelection}
					onStartNextHand={handleStartGame}
				/>
			</div>

			<div class="panel hand-card">
				<Hand
					cards={snapshot.hand}
					{selectedCardIds}
					disabled={!isCurrentTurn || isActing}
					onToggleCard={toggleSelectedCard}
				/>
			</div>

			<div class="panel log-card">
				<GameLog events={snapshot.events} />
			</div>
		</section>
	{:else}
		<section class="panel join-panel">
			<p class="eyebrow">Stanza {roomId}</p>
			<h1>Entra nella lobby</h1>

			{#if hasLocalSession}
				<p>Sessione locale trovata ma non caricata.</p>
			{:else if !inviteToken}
				<p>Non hai una sessione locale. Incolla un invite token per entrare.</p>
			{/if}

			<form on:submit|preventDefault={handleJoinRoom}>
				<label>
					Nome giocatore
					<input bind:value={playerName} required maxlength="32" placeholder="Player 2" />
				</label>

				<label>
					Invite token
					<input bind:value={inviteToken} required placeholder="Token invito" />
				</label>

				{#if error}
					<p class="error" role="alert">{error}</p>
				{/if}

				<button type="submit" disabled={isJoining || playerName.trim().length === 0 || inviteToken.trim().length === 0}>
					{isJoining ? 'Ingresso...' : 'Entra nella stanza'}
				</button>
			</form>
		</section>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		background: #111816;
		color: #f6f2e9;
	}

	.room-shell {
		min-height: 100vh;
		padding: 1.25rem;
		background:
			radial-gradient(circle at 90% 0%, rgba(67, 150, 112, 0.28), transparent 24rem),
			linear-gradient(145deg, #111816 0%, #1d261f 100%);
	}

	.topbar {
		width: min(100%, 70rem);
		margin: 0 auto;
	}

	.game-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(17rem, 0.36fr);
		gap: 1rem;
		width: min(100%, 70rem);
		margin: 0 auto;
	}

	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 0 1.25rem;
	}

	.home-link {
		color: #f6f2e9;
		font-weight: 900;
		letter-spacing: -0.04em;
		text-decoration: none;
	}

	.panel {
		border: 1px solid rgba(246, 242, 233, 0.14);
		border-radius: 1.4rem;
		padding: 1.1rem;
		background: rgba(246, 242, 233, 0.08);
		box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.24);
	}

	.action-card,
	.hand-card {
		grid-column: 1 / -1;
	}

	.loading-panel,
	.join-panel {
		width: min(100%, 32rem);
		margin: 10vh auto 0;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		color: #8df0ad;
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	h1,
	p {
		margin-top: 0;
	}

	h1 {
		font-size: clamp(2rem, 8vw, 4.5rem);
		line-height: 0.95;
		letter-spacing: -0.06em;
	}

	form,
	label {
		display: grid;
		gap: 0.8rem;
	}

	label {
		font-size: 0.85rem;
		font-weight: 800;
		color: #cfe7d4;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid rgba(246, 242, 233, 0.18);
		border-radius: 0.85rem;
		padding: 0.8rem 0.95rem;
		background: rgba(8, 12, 10, 0.58);
		color: #f6f2e9;
		font: inherit;
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

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.error {
		margin: 0;
		color: #ffb4a8;
		font-weight: 800;
	}

	@media (max-width: 760px) {
		.room-shell {
			padding: 0.9rem;
		}

		.topbar {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.75rem;
		}

		.game-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
