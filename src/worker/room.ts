import { passTurn as applyPassTurn, playCards as applyPlayCards, startHand, startNextHand } from '../lib/game/actions';
import { MAX_PLAYERS, MIN_PLAYERS } from '../lib/game/deck';
import { detectCombination } from '../lib/game/rules';
import {
	createGameState,
	getPlayer,
	getPlayersInSeatOrder
} from '../lib/game/state';
import type { Card } from '../lib/game/cards';
import type { Combination } from '../lib/game/rules';
import type { GamePhase, GameState, PlayerState } from '../lib/game/state';
import { getCardId, selectCardsByIds, toClientCards } from './card-ids';
import { generateSecret } from './random';
import {
	ApiError,
	assertMethod,
	corsHeaders,
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
		if (req.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

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
			name,
			seatIndex: 0,
			connected: true,
			ready: false,
			score: 0,
			joinedAt: now
		};
		const gameState = createGameState({
			phase: 'waiting',
			players: [toPlayerState(hostPlayer)]
		});
		let room: StoredRoom = {
			id,
			code: id,
			inviteToken: generateSecret(),
			hostPlayerId: hostPlayer.playerId,
			maxPlayers,
			phase: 'waiting',
			players: [hostPlayer],
			gameState,
			events: [],
			nextEventId: 1,
			createdAt: now,
			updatedAt: now
		};

		room = addEvent(room, 'player_joined', {
			playerId: hostPlayer.playerId,
			name,
			seatIndex: 0
		});
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
			existingPlayer.name = name;
			existingPlayer.connected = true;
			room = syncPlayerIntoState(room, existingPlayer);
			room = addEvent(room, 'player_rejoined', {
				playerId: existingPlayer.playerId,
				name
			});
			await this.saveRoom(room);
			await this.broadcast(room, 'player_rejoined');

			return json({
				roomId: room.id,
				code: room.code,
				session: toSession(existingPlayer),
				snapshot: toSnapshot(room, existingPlayer.playerId, this.getSiteOrigin(req))
			} satisfies JoinRoomResponse);
		}

		const inviteToken = getString(input, 'inviteToken');

		if (inviteToken !== room.inviteToken) {
			throw new ApiError(404, 'invalid_invite', 'Invalid room invite.');
		}

		if (room.phase !== 'waiting' && room.phase !== 'ready') {
			throw new ApiError(409, 'room_not_joinable', 'Room is not accepting new players.');
		}

		if (room.players.length >= room.maxPlayers) {
			throw new ApiError(409, 'room_full', 'Room is full.');
		}

		const session = createPlayerSession();
		const player: StoredPlayer = {
			...session,
			name,
			seatIndex: nextSeatIndex(room),
			connected: true,
			ready: false,
			score: 0,
			joinedAt: new Date().toISOString()
		};

		room.players.push(player);
		room = syncLobbyState(room);
		room = addEvent(room, 'player_joined', {
			playerId: player.playerId,
			name,
			seatIndex: player.seatIndex
		});
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

		if (room.phase !== 'waiting' && room.phase !== 'ready') {
			throw new ApiError(409, 'room_not_waiting', 'Ready state can only change in lobby.');
		}

		player.ready = ready;
		room = syncLobbyState(room);
		room = addEvent(room, 'ready_changed', {
			playerId: player.playerId,
			ready,
			phase: room.phase
		});
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

		if (room.phase === 'waiting' || room.phase === 'ready') {
			assertReadyToStart(room);
			const state = createGameState({
				...room.gameState,
				players: room.players.map(toPlayerState),
				phase: room.phase
			});
			room = applyStateToRoom(room, startHand(state));
			room = addEvent(room, 'game_started', {
				startedBy: player.playerId,
				handNumber: room.gameState.handNumber,
				currentPlayerId: room.gameState.currentPlayerId
			});
		} else if (room.phase === 'hand_finished') {
			room = applyStateToRoom(room, startNextHand(room.gameState));
			room = addEvent(room, 'hand_started', {
				startedBy: player.playerId,
				handNumber: room.gameState.handNumber,
				currentPlayerId: room.gameState.currentPlayerId
			});
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
		const combination = detectCombination(cards);
		const previousFinishOrder = [...room.gameState.finishOrder];
		const nextState = applyPlayCards(room.gameState, player.playerId, cards);
		const playerJustFinished =
			!previousFinishOrder.includes(player.playerId) && nextState.finishOrder.includes(player.playerId);

		room = applyStateToRoom(room, nextState);
		room = addEvent(room, 'play_accepted', {
			playerId: player.playerId,
			cardIds,
			cards: cards.map(serializeCard),
			combination,
			nextPlayerId: nextState.currentPlayerId
		});

		if (playerJustFinished) {
			room = addEvent(room, 'player_finished', {
				playerId: player.playerId,
				position: nextState.finishOrder.indexOf(player.playerId) + 1
			});
		}

		if (nextState.phase === 'hand_finished') {
			room = addEvent(room, 'hand_finished', {
				finishOrder: nextState.finishOrder,
				scores: getScores(nextState)
			});
		}

		if (nextState.phase === 'game_finished') {
			room = addEvent(room, 'game_finished', {
				finishOrder: nextState.finishOrder,
				scores: getScores(nextState),
				winners: nextState.players
					.filter((statePlayer) => statePlayer.score >= nextState.targetScore)
					.map((statePlayer) => statePlayer.id)
			});
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
		room = addEvent(room, 'player_passed', {
			playerId: player.playerId,
			nextPlayerId: nextState.currentPlayerId,
			trickReset: trickWasReset
		});

		if (trickWasReset) {
			room = addEvent(room, 'turn_changed', {
				currentPlayerId: nextState.currentPlayerId,
				controllerPlayerId: nextState.controllerPlayerId
			});
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

		if (room.phase === 'waiting' || room.phase === 'ready') {
			room.players = room.players.filter((roomPlayer) => roomPlayer.playerId !== player.playerId);
			room = addEvent(room, 'player_left', {
				playerId: player.playerId,
				name: player.name
			});

			if (room.players.length === 0) {
				room.phase = 'closed';
				room.gameState = createGameState({ phase: 'closed' });
				room = addEvent(room, 'room_closed', { reason: 'empty_room' });
			} else {
				if (room.hostPlayerId === player.playerId) {
					room.hostPlayerId = room.players[0].playerId;
					room = addEvent(room, 'host_changed', { hostPlayerId: room.hostPlayerId });
				}

				room = syncLobbyState(room);
			}
		} else {
			player.connected = false;
			room = syncPlayerIntoState(room, player);
			room = addEvent(room, 'player_left', {
				playerId: player.playerId,
				name: player.name
			});
		}

		await this.saveRoom(room);
		await this.broadcast(room, 'player_left');

		return json({ left: true, roomClosed: room.phase === 'closed' });
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
		player.connected = true;
		room = syncPlayerIntoState(room, player);
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

		if (!room || room.phase === 'closed') {
			return;
		}

		const player = room.players.find((roomPlayer) => roomPlayer.playerId === playerId);

		if (!player) {
			return;
		}

		player.connected = false;
		room = syncPlayerIntoState(room, player);
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

function toSession(player: StoredPlayer): PlayerSession {
	return {
		playerId: player.playerId,
		playerSecret: player.playerSecret
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
	if (room.players.length < MIN_PLAYERS) {
		throw new ApiError(409, 'not_enough_players', `At least ${MIN_PLAYERS} players are required.`);
	}

	if (room.players.length > MAX_PLAYERS) {
		throw new ApiError(409, 'too_many_players', `At most ${MAX_PLAYERS} players are allowed.`);
	}

	const notReadyPlayers = room.players.filter(
		(player) => player.playerId !== room.hostPlayerId && !player.ready
	);

	if (notReadyPlayers.length > 0) {
		throw new ApiError(409, 'players_not_ready', 'All non-host players must be ready.');
	}
}

function nextSeatIndex(room: StoredRoom): number {
	const occupiedSeats = new Set(room.players.map((player) => player.seatIndex));

	for (let seatIndex = 0; seatIndex < room.maxPlayers; seatIndex += 1) {
		if (!occupiedSeats.has(seatIndex)) {
			return seatIndex;
		}
	}

	throw new ApiError(409, 'room_full', 'Room is full.');
}

function syncLobbyState(room: StoredRoom): StoredRoom {
	if (room.phase === 'closed') {
		return room;
	}

	const nonHostPlayers = room.players.filter((player) => player.playerId !== room.hostPlayerId);
	const phase: GamePhase =
		room.players.length >= MIN_PLAYERS &&
		nonHostPlayers.length > 0 &&
		nonHostPlayers.every((player) => player.ready)
			? 'ready'
			: 'waiting';

	return {
		...room,
		phase,
		gameState: createGameState({
			...room.gameState,
			phase,
			currentPlayerId: null,
			controllerPlayerId: null,
			lastPlay: null,
			passedPlayerIds: [],
			finishOrder: [],
			players: room.players.map(toPlayerState)
		})
	};
}

function syncPlayerIntoState(room: StoredRoom, player: StoredPlayer): StoredRoom {
	const gameState = createGameState({
		...room.gameState,
		players: room.gameState.players.map((statePlayer) =>
			statePlayer.id === player.playerId
				? {
						...statePlayer,
						name: player.name,
						connected: player.connected,
						ready: player.ready,
						score: player.score
					}
				: statePlayer
		)
	});

	return { ...room, gameState };
}

function applyStateToRoom(room: StoredRoom, gameState: GameState): StoredRoom {
	const players = room.players.map((player) => {
		const statePlayer = getPlayer(gameState, player.playerId);

		return statePlayer
			? {
					...player,
					name: statePlayer.name,
					connected: statePlayer.connected,
					ready: statePlayer.ready,
					score: statePlayer.score
				}
			: player;
	});

	return {
		...room,
		phase: gameState.phase,
		players,
		gameState: createGameState(gameState)
	};
}

function toPlayerState(player: StoredPlayer): PlayerState {
	return {
		id: player.playerId,
		name: player.name,
		seatIndex: player.seatIndex,
		hand: [],
		score: player.score,
		connected: player.connected,
		ready: player.ready,
		finishedPosition: null
	};
}

function addEvent(
	room: StoredRoom,
	type: string,
	payload: Record<string, unknown> = {}
): StoredRoom {
	const event: RoomEvent = {
		id: room.nextEventId,
		type,
		payload,
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

function getScores(state: GameState): Record<string, number> {
	return Object.fromEntries(state.players.map((player) => [player.id, player.score]));
}

function serializeCard(card: Card): Record<string, string> {
	return 'suit' in card && card.suit
		? { id: getCardId(card), rank: card.rank, suit: card.suit }
		: { id: getCardId(card), rank: card.rank };
}
