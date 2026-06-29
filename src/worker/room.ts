import { passTurn as applyPassTurn, playCards as applyPlayCards, startHand, startNextHand } from '../lib/game/actions';
import { MAX_PLAYERS, MIN_PLAYERS } from '../lib/game/deck';
import {
	createGameState,
	getPlayer,
	getPlayersInSeatOrder
} from '../lib/game/state';
import type { Combination } from '../lib/game/rules';
import type { GamePhase, GameState, PlayerState } from '../lib/game/state';
import { selectCardsByIds, toClientCards } from './card-ids';
import { generateSecret } from './random';
import {
	ApiError,
	assertMethod,
	errorResponse,
	getBoolean,
	getOptionalInteger,
	getOptionalString,
	getString,
	getStringArray,
	json,
	parseJsonBody
} from './http';
import type {
	JoinRoomResponse,
	PlayerSession,
	PublicPlayer,
	PublicRoomState,
	RoomCreatedResponse,
	RoomEvent,
	RoomSnapshot,
	StoredPlayer,
	StoredRoom,
	WorkerEnv
} from './types';

const STORAGE_KEY = 'room';
const MAX_EVENTS = 100;

type SocketSession = {
	playerId: string;
};

export class RoomDurableObject implements DurableObject {
	private sockets = new Map<WebSocket, SocketSession>();

	constructor(
		private readonly state: DurableObjectState,
		private readonly env: WorkerEnv
	) {}

	async fetch(req: Request): Promise<Response> {
		try {
			const action = new URL(req.url).pathname.replace(/^\/+/, '') || 'state';

			switch (action) {
				case 'create':
					return await this.createRoom(req);
				case 'join':
					return await this.joinRoom(req);
				case 'ready':
					return await this.setReady(req);
				case 'start':
					return await this.startGame(req);
				case 'play':
					return await this.playCards(req);
				case 'pass':
					return await this.passTurn(req);
				case 'leave':
					return await this.leaveRoom(req);
				case 'socket':
					return await this.openSocket(req);
				case 'state':
					return await this.getRoomState(req);
				default:
					throw new ApiError(404, 'not_found', 'Route not found.');
			}
		} catch (error) {
			return errorResponse(error);
		}
	}

	private async createRoom(req: Request): Promise<Response> {
		assertMethod(req, ['POST']);

		const existingRoom = await this.loadRoom();

		if (existingRoom) {
			throw new ApiError(409, 'room_already_exists', 'Room already exists.');
		}

		const input = await parseJsonBody(req);
		const id = getString(input, 'roomId').toUpperCase();
		const name = getString(input, 'name');
		const siteOrigin = getOptionalString(input, 'siteOrigin') ?? this.getSiteOrigin(req);
		const maxPlayers = getOptionalInteger(input, 'maxPlayers', MAX_PLAYERS, {
			min: MIN_PLAYERS,
			max: MAX_PLAYERS
		});
		const now = new Date().toISOString();
		const session = createPlayerSession();
		const hostPlayer: StoredPlayer = {
			...session,
			joinedAt: now
		};
		const gameState = createGameState({
			phase: 'waiting',
			players: [createPlayerState(hostPlayer.playerId, name, 0)]
		});
		let room: StoredRoom = {
			id,
			code: id,
			inviteToken: generateSecret(),
			hostPlayerId: hostPlayer.playerId,
			maxPlayers,
			players: [hostPlayer],
			gameState,
			events: [],
			nextEventId: 1,
			createdAt: now,
			updatedAt: now
		};

		room = addEvent(room, 'player_joined');
		await this.saveRoom(room);

		const snapshot = toSnapshot(room, hostPlayer.playerId, siteOrigin);
		const response: RoomCreatedResponse = {
			roomId: room.id,
			code: room.code,
			inviteToken: room.inviteToken,
			inviteUrl: buildInviteUrl(room, siteOrigin),
			session,
			snapshot
		};

		return json(response);
	}

	private async joinRoom(req: Request): Promise<Response> {
		assertMethod(req, ['POST']);

		let room = await this.requireRoom();
		const input = await parseJsonBody(req);
		const name = getString(input, 'name');
		const maybeSession = getSessionFromInput(input);
		const existingPlayer = maybeSession
			? room.players.find((player) => player.playerId === maybeSession.playerId)
			: null;

		if (existingPlayer) {
			assertPlayerSecret(existingPlayer, maybeSession?.playerSecret);
			room = updatePlayerState(room, existingPlayer.playerId, { name, connected: true });
			room = addEvent(room, 'player_rejoined');
			await this.saveRoom(room);
			await this.broadcast(room, 'player_rejoined');

			return json({
				roomId: room.id,
				code: room.code,
				session: {
					playerId: existingPlayer.playerId,
					playerSecret: existingPlayer.playerSecret
				},
				snapshot: toSnapshot(room, existingPlayer.playerId, this.getSiteOrigin(req))
			} satisfies JoinRoomResponse);
		}

		const inviteToken = getString(input, 'inviteToken');

		if (inviteToken !== room.inviteToken) {
			throw new ApiError(404, 'invalid_invite', 'Invalid room invite.');
		}

		if (!isLobbyPhase(room.gameState.phase)) {
			throw new ApiError(409, 'room_not_joinable', 'Room is not accepting new players.');
		}

		if (room.players.length >= room.maxPlayers) {
			throw new ApiError(409, 'room_full', 'Room is full.');
		}

		const session = createPlayerSession();
		const seatIndex = nextSeatIndex(room);
		const player: StoredPlayer = {
			...session,
			joinedAt: new Date().toISOString()
		};

		room = {
			...room,
			players: [...room.players, player],
			gameState: createGameState({
				...room.gameState,
				players: [...room.gameState.players, createPlayerState(player.playerId, name, seatIndex)]
			})
		};
		room = syncLobbyState(room);
		room = addEvent(room, 'player_joined');
		await this.saveRoom(room);
		await this.broadcast(room, 'player_joined');

		return json({
			roomId: room.id,
			code: room.code,
			session,
			snapshot: toSnapshot(room, player.playerId, this.getSiteOrigin(req))
		} satisfies JoinRoomResponse);
	}

	private async setReady(req: Request): Promise<Response> {
		assertMethod(req, ['POST']);

		let room = await this.requireRoom();
		const input = await parseJsonBody(req);
		const player = authenticate(room, input);
		const ready = getBoolean(input, 'ready');

		if (!isLobbyPhase(room.gameState.phase)) {
			throw new ApiError(409, 'room_not_waiting', 'Ready state can only change in lobby.');
		}

		room = updatePlayerState(room, player.playerId, { ready });
		room = syncLobbyState(room);
		room = addEvent(room, 'ready_changed');
		await this.saveRoom(room);
		await this.broadcast(room, 'ready_changed');

		return json({ snapshot: toSnapshot(room, player.playerId, this.getSiteOrigin(req)) });
	}

	private async startGame(req: Request): Promise<Response> {
		assertMethod(req, ['POST']);

		let room = await this.requireRoom();
		const input = await parseJsonBody(req);
		const player = authenticate(room, input);

		if (player.playerId !== room.hostPlayerId) {
			throw new ApiError(403, 'host_required', 'Only the room host can start the game.');
		}

		if (isLobbyPhase(room.gameState.phase)) {
			assertReadyToStart(room);
			room = applyStateToRoom(room, startHand(room.gameState));
			room = addEvent(room, 'game_started');
		} else if (room.gameState.phase === 'hand_finished') {
			room = applyStateToRoom(room, startNextHand(room.gameState));
			room = addEvent(room, 'hand_started');
		} else {
			throw new ApiError(409, 'room_not_startable', 'Room cannot be started in its current phase.');
		}

		await this.saveRoom(room);
		await this.broadcast(room, 'game_started');

		return json({ snapshot: toSnapshot(room, player.playerId, this.getSiteOrigin(req)) });
	}

	private async playCards(req: Request): Promise<Response> {
		assertMethod(req, ['POST']);

		let room = await this.requireRoom();
		const input = await parseJsonBody(req);
		const player = authenticate(room, input);
		const cardIds = getStringArray(input, 'cardIds');
		const playerState = getPlayer(room.gameState, player.playerId);

		if (!playerState) {
			throw new ApiError(403, 'not_room_participant', 'User is not a participant in this room.');
		}

		const cards = selectCardsByIds(playerState.hand, cardIds);
		const previousFinishOrder = [...room.gameState.finishOrder];
		const nextState = applyPlayCards(room.gameState, player.playerId, cards);
		const playerJustFinished =
			!previousFinishOrder.includes(player.playerId) && nextState.finishOrder.includes(player.playerId);

		room = applyStateToRoom(room, nextState);
		room = addEvent(room, 'play_accepted');

		if (playerJustFinished) {
			room = addEvent(room, 'player_finished');
		}

		if (nextState.phase === 'hand_finished') {
			room = addEvent(room, 'hand_finished');
		}

		if (nextState.phase === 'game_finished') {
			room = addEvent(room, 'game_finished');
		}

		await this.saveRoom(room);
		await this.broadcast(room, 'play_accepted');

		return json({ snapshot: toSnapshot(room, player.playerId, this.getSiteOrigin(req)) });
	}

	private async passTurn(req: Request): Promise<Response> {
		assertMethod(req, ['POST']);

		let room = await this.requireRoom();
		const input = await parseJsonBody(req);
		const player = authenticate(room, input);
		const nextState = applyPassTurn(room.gameState, player.playerId);
		const trickWasReset = room.gameState.lastPlay !== null && nextState.lastPlay === null;

		room = applyStateToRoom(room, nextState);
		room = addEvent(room, 'player_passed');

		if (trickWasReset) {
			room = addEvent(room, 'turn_changed');
		}

		await this.saveRoom(room);
		await this.broadcast(room, 'player_passed');

		return json({ snapshot: toSnapshot(room, player.playerId, this.getSiteOrigin(req)) });
	}

	private async leaveRoom(req: Request): Promise<Response> {
		assertMethod(req, ['POST']);

		let room = await this.requireRoom();
		const input = await parseJsonBody(req);
		const player = authenticate(room, input);

		if (isLobbyPhase(room.gameState.phase)) {
			room = {
				...room,
				players: room.players.filter((roomPlayer) => roomPlayer.playerId !== player.playerId),
				gameState: createGameState({
					...room.gameState,
					players: room.gameState.players.filter((statePlayer) => statePlayer.id !== player.playerId)
				})
			};
			room = addEvent(room, 'player_left');

			if (room.players.length === 0) {
				room = {
					...room,
					gameState: createGameState({ phase: 'closed' })
				};
				room = addEvent(room, 'room_closed');
			} else {
				if (room.hostPlayerId === player.playerId) {
					room = { ...room, hostPlayerId: room.players[0].playerId };
					room = addEvent(room, 'host_changed');
				}

				room = syncLobbyState(room);
			}
		} else {
			room = updatePlayerState(room, player.playerId, { connected: false });
			room = addEvent(room, 'player_left');
		}

		await this.saveRoom(room);
		await this.broadcast(room, 'player_left');

		return json({ left: true, roomClosed: room.gameState.phase === 'closed' });
	}

	private async getRoomState(req: Request): Promise<Response> {
		assertMethod(req, ['GET', 'POST']);

		const room = await this.requireRoom();
		const input = req.method === 'GET' ? queryInput(req) : await parseJsonBody(req);
		const player = authenticate(room, input);

		return json(toSnapshot(room, player.playerId, this.getSiteOrigin(req)));
	}

	private async openSocket(req: Request): Promise<Response> {
		assertMethod(req, ['GET']);

		if (req.headers.get('Upgrade') !== 'websocket') {
			throw new ApiError(426, 'websocket_required', 'Expected a WebSocket upgrade request.');
		}

		let room = await this.requireRoom();
		const player = authenticate(room, queryInput(req));
		room = updatePlayerState(room, player.playerId, { connected: true });
		await this.saveRoom(room);

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

		server.accept();
		this.sockets.set(server, { playerId: player.playerId });
		server.send(
			JSON.stringify({
				type: 'snapshot',
				snapshot: toSnapshot(room, player.playerId, this.getSiteOrigin(req))
			})
		);
		server.addEventListener('message', (event) => {
			if (event.data === 'ping') {
				server.send(JSON.stringify({ type: 'pong' }));
			}
		});
		server.addEventListener('close', () => {
			this.sockets.delete(server);
			void this.markDisconnectedIfNeeded(player.playerId);
		});
		server.addEventListener('error', () => {
			this.sockets.delete(server);
			void this.markDisconnectedIfNeeded(player.playerId);
		});

		await this.broadcast(room, 'player_connected');

		return new Response(null, { status: 101, webSocket: client });
	}

	private async markDisconnectedIfNeeded(playerId: string): Promise<void> {
		if ([...this.sockets.values()].some((session) => session.playerId === playerId)) {
			return;
		}

		let room = await this.loadRoom();

		if (!room || room.gameState.phase === 'closed') {
			return;
		}

		if (!room.players.some((roomPlayer) => roomPlayer.playerId === playerId)) {
			return;
		}

		room = updatePlayerState(room, playerId, { connected: false });
		await this.saveRoom(room);
		await this.broadcast(room, 'player_disconnected');
	}

	private async broadcast(room: StoredRoom, type: string): Promise<void> {
		for (const [socket, session] of this.sockets) {
			try {
				socket.send(
					JSON.stringify({
						type,
						snapshot: toSnapshot(room, session.playerId, this.env.PUBLIC_SITE_URL)
					})
				);
			} catch {
				this.sockets.delete(socket);
			}
		}
	}

	private async loadRoom(): Promise<StoredRoom | null> {
		return (await this.state.storage.get<StoredRoom>(STORAGE_KEY)) ?? null;
	}

	private async requireRoom(): Promise<StoredRoom> {
		const room = await this.loadRoom();

		if (!room) {
			throw new ApiError(404, 'room_not_found', 'Room not found.');
		}

		return room;
	}

	private async saveRoom(room: StoredRoom): Promise<void> {
		room.updatedAt = new Date().toISOString();
		await this.state.storage.put(STORAGE_KEY, room);
	}

	private getSiteOrigin(req: Request): string {
		return this.env.PUBLIC_SITE_URL?.replace(/\/$/, '') ?? new URL(req.url).origin;
	}
}

function createPlayerSession(): PlayerSession {
	return {
		playerId: crypto.randomUUID(),
		playerSecret: generateSecret()
	};
}

function createPlayerState(id: string, name: string, seatIndex: number): PlayerState {
	return {
		id,
		name,
		seatIndex,
		hand: [],
		score: 0,
		connected: true,
		ready: false,
		finishedPosition: null
	};
}

function queryInput(req: Request): Record<string, string> {
	return Object.fromEntries(new URL(req.url).searchParams.entries());
}

function getSessionFromInput(input: Record<string, unknown>): PlayerSession | null {
	const playerId = getOptionalString(input, 'playerId');
	const playerSecret = getOptionalString(input, 'playerSecret');

	return playerId && playerSecret ? { playerId, playerSecret } : null;
}

function authenticate(room: StoredRoom, input: Record<string, unknown>): StoredPlayer {
	const session = getSessionFromInput(input);

	if (!session) {
		throw new ApiError(401, 'unauthorized', 'Missing player session.');
	}

	const player = room.players.find((roomPlayer) => roomPlayer.playerId === session.playerId);

	if (!player) {
		throw new ApiError(403, 'not_room_participant', 'Player is not part of this room.');
	}

	assertPlayerSecret(player, session.playerSecret);

	return player;
}

function assertPlayerSecret(player: StoredPlayer, playerSecret: string | null | undefined): void {
	if (!playerSecret || player.playerSecret !== playerSecret) {
		throw new ApiError(403, 'invalid_player_session', 'Invalid player session.');
	}
}

function assertReadyToStart(room: StoredRoom): void {
	const players = room.gameState.players;

	if (players.length < MIN_PLAYERS) {
		throw new ApiError(409, 'not_enough_players', `At least ${MIN_PLAYERS} players are required.`);
	}

	if (players.length > MAX_PLAYERS) {
		throw new ApiError(409, 'too_many_players', `At most ${MAX_PLAYERS} players are allowed.`);
	}

	const notReadyPlayers = players.filter((player) => player.id !== room.hostPlayerId && !player.ready);

	if (notReadyPlayers.length > 0) {
		throw new ApiError(409, 'players_not_ready', 'All non-host players must be ready.');
	}
}

function nextSeatIndex(room: StoredRoom): number {
	const occupiedSeats = new Set(room.gameState.players.map((player) => player.seatIndex));

	for (let seatIndex = 0; seatIndex < room.maxPlayers; seatIndex += 1) {
		if (!occupiedSeats.has(seatIndex)) {
			return seatIndex;
		}
	}

	throw new ApiError(409, 'room_full', 'Room is full.');
}

function syncLobbyState(room: StoredRoom): StoredRoom {
	if (room.gameState.phase === 'closed') {
		return room;
	}

	const nonHostPlayers = room.gameState.players.filter((player) => player.id !== room.hostPlayerId);
	const phase: GamePhase =
		room.gameState.players.length >= MIN_PLAYERS &&
		nonHostPlayers.length > 0 &&
		nonHostPlayers.every((player) => player.ready)
			? 'ready'
			: 'waiting';

	return {
		...room,
		gameState: createGameState({
			...room.gameState,
			phase,
			currentPlayerId: null,
			controllerPlayerId: null,
			lastPlay: null,
			passedPlayerIds: [],
			finishOrder: []
		})
	};
}

function updatePlayerState(
	room: StoredRoom,
	playerId: string,
	patch: Partial<Pick<PlayerState, 'name' | 'connected' | 'ready' | 'score'>>
): StoredRoom {
	return {
		...room,
		gameState: createGameState({
			...room.gameState,
			players: room.gameState.players.map((player) =>
				player.id === playerId ? { ...player, ...patch } : player
			)
		})
	};
}

function applyStateToRoom(room: StoredRoom, gameState: GameState): StoredRoom {
	return {
		...room,
		gameState: createGameState(gameState)
	};
}

function addEvent(room: StoredRoom, type: string): StoredRoom {
	const event: RoomEvent = {
		id: room.nextEventId,
		type,
		createdAt: new Date().toISOString()
	};

	return {
		...room,
		nextEventId: room.nextEventId + 1,
		events: [...room.events, event].slice(-MAX_EVENTS)
	};
}

function toSnapshot(room: StoredRoom, playerId: string, siteOrigin?: string): RoomSnapshot {
	const publicState = toPublicState(room);

	return {
		room: {
			id: room.id,
			code: room.code,
			inviteUrl: buildInviteUrl(room, siteOrigin),
			hostPlayerId: room.hostPlayerId,
			maxPlayers: room.maxPlayers,
			createdAt: room.createdAt,
			updatedAt: room.updatedAt
		},
		player: publicState.players.find((player) => player.id === playerId) ?? null,
		state: publicState,
		hand: toClientCards(getPlayer(room.gameState, playerId)?.hand ?? []),
		events: room.events
	};
}

function toPublicState(room: StoredRoom): PublicRoomState {
	return {
		phase: room.gameState.phase,
		handNumber: room.gameState.handNumber,
		targetScore: room.gameState.targetScore,
		currentPlayerId: room.gameState.currentPlayerId,
		controllerPlayerId: room.gameState.controllerPlayerId,
		lastPlay: room.gameState.lastPlay
			? {
					playerId: room.gameState.lastPlay.playerId,
					cards: toClientCards(room.gameState.lastPlay.cards),
					combination: toClientCombination(room.gameState.lastPlay.combination)
				}
			: null,
		passedPlayerIds: [...room.gameState.passedPlayerIds],
		finishOrder: [...room.gameState.finishOrder],
		players: getPlayersInSeatOrder(room.gameState).map((player): PublicPlayer => ({
			id: player.id,
			name: player.name,
			seatIndex: player.seatIndex,
			connected: player.connected,
			ready: player.ready,
			score: player.score,
			finishedPosition: player.finishedPosition,
			cardCount: player.hand.length,
			isHost: room.hostPlayerId === player.id
		}))
	};
}

function toClientCombination(combination: Combination): Omit<Combination, 'cards'> & {
	cards: ReturnType<typeof toClientCards>;
} {
	return {
		...combination,
		cards: toClientCards(combination.cards)
	};
}

function buildInviteUrl(room: StoredRoom, siteOrigin?: string): string {
	const origin = siteOrigin?.replace(/\/$/, '') ?? '';

	return `${origin}/room/${encodeURIComponent(room.code)}?invite=${encodeURIComponent(room.inviteToken)}`;
}

function isLobbyPhase(phase: GamePhase): boolean {
	return phase === 'waiting' || phase === 'ready';
}
