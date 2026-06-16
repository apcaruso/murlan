<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ActionBar from '../../../lib/components/ActionBar.svelte';
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

	let roomId = '';
	let inviteToken = '';
	let hasInviteFromLink = false;
	let playerName = '';
	let snapshot: RoomSnapshot | null = null;
	let hasLocalSession = false;
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
	$: turnPlayer = snapshot?.state.players.find((player) => player.id === snapshot?.state.currentPlayerId) ?? null;
	$: controllerPlayer = snapshot?.state.players.find((player) => player.id === snapshot?.state.controllerPlayerId) ?? null;
	$: isLobbyPhase = snapshot?.state.phase === 'waiting' || snapshot?.state.phase === 'ready';
	$: isCurrentTurn = snapshot?.state.phase === 'playing' && snapshot.state.currentPlayerId === currentPlayer?.id;
	$: canPlay = isCurrentTurn && selectedCardIds.length > 0;
	$: canPass = isCurrentTurn && snapshot?.state.lastPlay !== null;
	$: canStartNextHand = currentPlayer?.isHost === true && snapshot?.state.phase === 'hand_finished';
	$: isFirstOpeningMove =
		snapshot?.state.phase === 'playing' &&
		snapshot.state.handNumber === 1 &&
		snapshot.state.lastPlay === null &&
		snapshot.state.finishOrder.length === 0 &&
		snapshot.state.passedPlayerIds.length === 0;
	$: highlightedCardIds = isFirstOpeningMove ? ['spades-3'] : [];
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
		hasInviteFromLink = inviteToken.length > 0;
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
			const response = await joinRoom(roomId, getInviteCode(inviteToken), playerName);
			snapshot = response.snapshot;
			hasLocalSession = true;
			reconnectAttempts = 0;
			connectRealtime();
		} catch (caughtError) {
			error = getPlayerErrorMessage(caughtError, 'Impossibile entrare nella stanza.');
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
			error = getPlayerErrorMessage(caughtError, 'Stato non aggiornato.');
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
			error = getPlayerErrorMessage(caughtError, 'Impossibile iniziare la partita.');
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
			error = getPlayerErrorMessage(caughtError, 'Giocata rifiutata.');
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
			error = getPlayerErrorMessage(caughtError, 'Passaggio rifiutato.');
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
			error = getPlayerErrorMessage(caughtError, 'Impossibile uscire dalla stanza.');
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

		try {
			subscription = subscribeToRoom(roomId, {
				onOpen: () => {
					if (connectionId !== activeConnectionId) {
						return;
					}
					reconnectAttempts = 0;
				},
				onClose: () => {
					if (connectionId !== activeConnectionId) {
						return;
					}

					subscription = null;
					scheduleReconnect();
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
		} catch {
			scheduleReconnect();
		}
	}

	function disconnect() {
		realtimeEnabled = false;
		activeConnectionId += 1;
		clearReconnectTimer();
		closeSubscription();
	}

	function closeSubscription() {
		subscription?.unsubscribe();
		subscription = null;
	}

	function scheduleReconnect() {
		if (!realtimeEnabled || !hasLocalSession) {
			return;
		}

		const delay = Math.min(1000 * 2 ** reconnectAttempts, 10000);
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

			scheduleReconnect();
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

		error = getPlayerErrorMessage(caughtError, 'Non riesco a farti rientrare in questa stanza.');
		hasLocalSession = false;
	}

	function handleInvalidLocalSession(message: string) {
		clearRoomSession(roomId);
		disconnect();
		snapshot = null;
		hasLocalSession = false;
		error = `${message} Rientra con il link invito.`;
	}

	function isSessionError(error: unknown): error is ApiRequestError {
		return (
			error instanceof ApiRequestError &&
			['unauthorized', 'invalid_player_session', 'not_room_participant'].includes(error.code)
		);
	}

	function getPlayerErrorMessage(caughtError: unknown, fallback: string): string {
		if (caughtError instanceof ApiRequestError) {
			const messages: Record<string, string> = {
				invalid_opening_move: 'La prima giocata deve contenere il 3 di picche.',
				cannot_beat_previous: 'Serve una giocata dello stesso tipo, con lo stesso numero di carte, ma piu alta.',
				invalid_combination: 'Queste carte non formano una giocata valida.',
				cards_not_owned: 'Una o piu carte non sono piu nella tua mano.',
				not_your_turn: 'Non e il tuo turno.',
				cannot_pass_without_play: 'Puoi passare solo dopo una giocata sul tavolo.',
				player_finished: 'Hai gia chiuso questa mano.',
				invalid_phase: 'Questa azione non e disponibile adesso.',
				invalid_invite: 'Questo invito non e valido.',
				room_not_joinable: 'Questa stanza non accetta nuovi giocatori.',
				room_full: 'Il tavolo e pieno.',
				not_enough_players: 'Servono almeno 2 giocatori.',
				players_not_ready: 'Tutti gli altri giocatori devono essere pronti.',
				host_required: 'Solo il capo tavolo puo avviare la partita.',
				unauthorized: 'Rientra al tavolo con il link invito.',
				invalid_player_session: 'Non riesco a riconoscerti in questa stanza.',
				not_room_participant: 'Non sei seduto a questo tavolo.'
			};

			return messages[caughtError.code] ?? caughtError.message ?? fallback;
		}

		return caughtError instanceof Error ? caughtError.message : fallback;
	}

	function getRoomIdFromPath(pathname: string): string {
		const parts = pathname.split('/').filter(Boolean);
		const roomIndex = parts.indexOf('room');
		const value = roomIndex === -1 ? parts.at(-1) : parts[roomIndex + 1];

		return value ? decodeURIComponent(value).trim().toUpperCase() : '';
	}

	function getInviteCode(value: string): string {
		const trimmedValue = value.trim();

		if (!trimmedValue) {
			return trimmedValue;
		}

		try {
			const baseUrl = typeof window === 'undefined' ? 'https://murlan.local' : window.location.origin;
			return new URL(trimmedValue, baseUrl).searchParams.get('invite')?.trim() || trimmedValue;
		} catch {
			return trimmedValue;
		}
	}
</script>

<svelte:head>
	<title>{roomId ? `${roomId} - Murlan` : 'Stanza Murlan'}</title>
</svelte:head>

<main class={snapshot && !isLobbyPhase ? 'game-shell' : 'room-shell'}>
	{#if !snapshot || isLobbyPhase}
		<header class="topbar">
			<a href="/" class="home-link">Murlan</a>
		</header>
	{/if}

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
		<section class="game-screen" class:your-turn={isCurrentTurn}>
			<header class="game-hud" aria-label="Stato partita">
				<div class="hud-block">
					<span>Room</span>
					<strong>{snapshot.room.code}</strong>
				</div>

				<div class="hud-block turn-block" class:active={isCurrentTurn}>
					<span>{isCurrentTurn ? 'Tocca a te' : 'Turno'}</span>
					<strong>{turnPlayer?.name ?? 'nessuno'}</strong>
				</div>

				<div class="hud-block">
					<span>Controllo</span>
					<strong>{controllerPlayer?.name ?? 'nessuno'}</strong>
				</div>

			</header>

			<section class="arena-card" aria-label="Tavolo di gioco">
				<Table state={snapshot.state} currentPlayerId={currentPlayer?.id ?? null} />
			</section>

			<aside class="game-rail" aria-label="Informazioni partita">
				<div class="panel score-card">
					<Scoreboard players={snapshot.state.players} targetScore={snapshot.state.targetScore} />
				</div>

				<div class="panel log-card">
					<GameLog events={snapshot.events} />
				</div>
			</aside>

			<details class="mobile-game-info">
				<summary>Giocatori e punti</summary>
				<div class="panel score-card">
					<Scoreboard players={snapshot.state.players} targetScore={snapshot.state.targetScore} />
				</div>
			</details>

			<section class="play-dock" aria-label="Controlli e mano">
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

				<Hand
					cards={snapshot.hand}
					{selectedCardIds}
					{highlightedCardIds}
					disabled={!isCurrentTurn || isActing}
					onToggleCard={toggleSelectedCard}
				/>
			</section>
		</section>
	{:else}
		<section class="panel join-panel">
			<p class="eyebrow">Stanza {roomId}</p>
			<h1>Entra al tavolo</h1>

			{#if hasLocalSession}
				<p>Ti ho riconosciuto, ma non riesco a riportarti al tavolo automaticamente.</p>
			{:else if hasInviteFromLink}
				<p>Invito trovato. Inserisci il nome e siediti al tavolo.</p>
			{:else}
				<p>Incolla il link invito per sederti a questo tavolo.</p>
			{/if}

			<form on:submit|preventDefault={handleJoinRoom}>
				<label>
					Nome giocatore
					<input bind:value={playerName} required maxlength="32" placeholder="Giocatore 2" />
				</label>

				{#if !hasInviteFromLink}
					<label>
						Link o codice invito
						<input bind:value={inviteToken} required placeholder="https://.../room/..." />
					</label>
				{/if}

				{#if error}
					<p class="error" role="alert">{error}</p>
				{/if}

				<button type="submit" disabled={isJoining || playerName.trim().length === 0 || inviteToken.trim().length === 0}>
					{isJoining ? 'Ingresso...' : 'Siediti al tavolo'}
				</button>
			</form>
		</section>
	{/if}
</main>

<style>
	.room-shell {
		min-height: 100dvh;
		padding: clamp(0.9rem, 2.4vw, 1.4rem);
		background:
			linear-gradient(120deg, transparent 0 49%, rgba(247, 247, 242, 0.08) 49% 50%, transparent 50% 100%),
			radial-gradient(circle at 88% 10%, rgba(247, 247, 242, 0.12), transparent 20rem),
			linear-gradient(145deg, #050505 0%, #111111 100%);
		overflow-x: hidden;
	}

	.game-shell {
		min-height: 100dvh;
		background:
			linear-gradient(90deg, rgba(247, 247, 242, 0.06) 1px, transparent 1px),
			linear-gradient(180deg, rgba(247, 247, 242, 0.05) 1px, transparent 1px),
			radial-gradient(circle at 50% 14%, rgba(247, 247, 242, 0.12), transparent 20rem),
			#050505;
		background-size: 4rem 4rem, 4rem 4rem, auto, auto;
	}

	.topbar {
		width: min(100%, 76rem);
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 0 1.25rem;
	}

	.home-link {
		color: var(--white);
		font-weight: 900;
		letter-spacing: 0.16em;
		text-decoration: none;
		text-transform: uppercase;
	}

	.panel {
		border: 1px solid var(--line);
		border-radius: 1.4rem;
		padding: clamp(1rem, 2vw, 1.15rem);
		background: rgba(5, 5, 5, 0.78);
		box-shadow: var(--shadow);
		backdrop-filter: blur(16px);
	}

	.loading-panel,
	.join-panel {
		width: min(100%, 32rem);
		margin: 10vh auto 0;
	}

	.loading-panel {
		display: grid;
		min-height: 9rem;
		place-items: center;
		color: var(--white-2);
		font-weight: 900;
		letter-spacing: 0.18em;
		text-align: center;
		text-transform: uppercase;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		color: var(--white-2);
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.22em;
		text-transform: uppercase;
	}

	h1,
	p {
		margin-top: 0;
	}

	h1 {
		font-size: clamp(2rem, 8vw, 4.5rem);
		line-height: 0.95;
		letter-spacing: -0.08em;
		text-transform: uppercase;
	}

	form,
	label {
		display: grid;
		gap: 0.8rem;
	}

	label {
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--white-2);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--line);
		border-radius: 0.85rem;
		padding: 0.8rem 0.95rem;
		background: var(--black);
		color: var(--white);
		font: inherit;
	}

	button {
		display: inline-grid;
		min-height: 2.85rem;
		place-items: center;
		border: 1px solid var(--white);
		border-radius: 999px;
		padding: 0.85rem 1rem;
		background: var(--white);
		color: var(--black);
		font: inherit;
		font-weight: 900;
		letter-spacing: 0.08em;
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

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.error {
		margin: 0;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		padding: 0.7rem 0.85rem;
		background: var(--wash);
		color: var(--white);
		font-weight: 800;
		text-align: center;
	}

	.game-screen {
		min-height: 100dvh;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 21rem);
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: clamp(0.75rem, 1.6vw, 1rem);
		padding: clamp(0.65rem, 1.6vw, 1.1rem);
	}

	.game-hud {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		align-items: stretch;
	}

	.hud-block {
		display: grid;
		min-height: 4.1rem;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: 1.15rem;
		padding: 0.65rem 0.8rem;
		background: rgba(5, 5, 5, 0.78);
		text-align: center;
		box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.28);
	}

	.hud-block span {
		color: var(--white-2);
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.hud-block strong {
		overflow: hidden;
		max-width: 100%;
		font-size: clamp(1rem, 2vw, 1.35rem);
		font-weight: 950;
		letter-spacing: -0.04em;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.turn-block.active {
		border-color: var(--white);
		background: var(--white);
		color: var(--black);
		animation: turn-pulse 1100ms ease-in-out infinite alternate;
	}

	.turn-block.active span,
	.turn-block.active strong {
		color: var(--black);
	}

	.arena-card,
	.play-dock {
		border: 1px solid var(--line);
		background: rgba(5, 5, 5, 0.82);
		box-shadow: var(--shadow);
		backdrop-filter: blur(18px);
	}

	.arena-card {
		min-height: 0;
		overflow: hidden;
		border-radius: 1.6rem;
		padding: clamp(0.8rem, 1.8vw, 1.15rem);
	}

	.game-rail {
		min-height: 0;
		display: grid;
		align-content: start;
		gap: 0.75rem;
		overflow: hidden;
	}

	.log-card {
		max-height: min(42vh, 24rem);
		overflow: auto;
	}

	.mobile-game-info {
		display: none;
	}

	.play-dock {
		position: sticky;
		bottom: max(clamp(0.5rem, 1.6vw, 0.9rem), env(safe-area-inset-bottom));
		z-index: 10;
		grid-column: 1 / -1;
		display: grid;
		gap: 0.85rem;
		border-radius: 1.4rem;
		padding: clamp(0.75rem, 1.6vw, 1rem);
	}

	.game-screen.your-turn .play-dock {
		border-color: var(--white);
		box-shadow:
			0 0 0 1px rgba(247, 247, 242, 0.28),
			0 1.5rem 4rem rgba(0, 0, 0, 0.62);
	}

	@keyframes turn-pulse {
		from {
			box-shadow: 0 0 0 rgba(247, 247, 242, 0);
		}

		to {
			box-shadow: 0 0 1.6rem rgba(247, 247, 242, 0.36);
		}
	}

	@media (max-width: 980px) {
		.game-screen {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto auto auto;
		}

		.game-hud {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.game-rail {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}

		.log-card {
			max-height: 14rem;
		}
	}

	@media (max-width: 760px) {
		.room-shell {
			padding: max(0.75rem, env(safe-area-inset-top)) 0.75rem max(0.75rem, env(safe-area-inset-bottom));
		}

		.join-panel,
		.loading-panel {
			margin-top: 2rem;
		}

		.topbar {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.75rem;
		}

		.game-screen {
			min-height: 100dvh;
			grid-template-columns: 1fr;
			grid-template-rows: auto minmax(0, 1fr) auto auto;
			gap: 0.55rem;
			padding: max(0.45rem, env(safe-area-inset-top)) 0.45rem max(0.45rem, env(safe-area-inset-bottom));
		}

		.game-hud {
			grid-template-columns: 1fr;
			gap: 0.45rem;
			order: 1;
		}

		.game-hud > .hud-block:first-child {
			display: none;
		}

		.game-hud > .turn-block {
			grid-column: 1 / -1;
		}

		.hud-block {
			min-height: 2.75rem;
			border-radius: 0.9rem;
			padding: 0.45rem 0.55rem;
		}

		.hud-block span {
			font-size: 0.58rem;
			letter-spacing: 0.14em;
		}

		.hud-block strong {
			font-size: 1rem;
		}

		.arena-card {
			order: 2;
			min-height: 0;
			overflow: auto;
			overscroll-behavior: contain;
			border-radius: 1.15rem;
			padding: 0.55rem;
		}

		.game-rail {
			display: none;
		}

		.play-dock {
			order: 3;
			gap: 0.55rem;
			border-radius: 1rem;
			padding: 0.6rem;
			bottom: max(0.45rem, env(safe-area-inset-bottom));
		}

		.mobile-game-info {
			order: 4;
			display: block;
		}

		.mobile-game-info summary {
			display: grid;
			min-height: 2.65rem;
			place-items: center;
			border: 1px solid var(--line);
			border-radius: 999px;
			padding: 0.65rem 0.9rem;
			background: rgba(5, 5, 5, 0.78);
			color: var(--white);
			font-weight: 900;
			letter-spacing: 0.08em;
			text-align: center;
			text-transform: uppercase;
			list-style: none;
		}

		.mobile-game-info summary::-webkit-details-marker {
			display: none;
		}

		.mobile-game-info[open] summary {
			border-radius: 1rem 1rem 0 0;
		}

		.mobile-game-info .panel {
			border-top: 0;
			border-radius: 0 0 1rem 1rem;
			padding: 0.75rem;
		}

		.log-card {
			display: none;
		}
		}
</style>
