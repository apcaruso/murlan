import type { Combination } from '../lib/game/rules';
import type { GamePhase, GameState } from '../lib/game/state';
import type { ClientCard } from './card-ids';

export type WorkerEnv = {
	ROOMS: DurableObjectNamespace;
	PUBLIC_SITE_URL?: string;
};

export type PlayerSession = {
	playerId: string;
	playerSecret: string;
};

export type StoredPlayer = PlayerSession & {
	joinedAt: string;
};

export type RoomEvent = {
	id: number;
	type: string;
	createdAt: string;
};

export type StoredRoom = {
	id: string;
	code: string;
	inviteToken: string;
	hostPlayerId: string;
	maxPlayers: number;
	players: StoredPlayer[];
	gameState: GameState;
	events: RoomEvent[];
	nextEventId: number;
	createdAt: string;
	updatedAt: string;
};

export type PublicPlayer = {
	id: string;
	name: string;
	seatIndex: number;
	connected: boolean;
	ready: boolean;
	score: number;
	finishedPosition: number | null;
	cardCount: number;
	isHost: boolean;
};

export type PublicRoomState = {
	phase: GamePhase;
	handNumber: number;
	targetScore: number;
	currentPlayerId: string | null;
	controllerPlayerId: string | null;
	lastPlay: {
		playerId: string;
		combination: Omit<Combination, 'cards'> & { cards: ClientCard[] };
		cards: ClientCard[];
	} | null;
	passedPlayerIds: string[];
	finishOrder: string[];
	players: PublicPlayer[];
};

export type RoomSnapshot = {
	room: {
		id: string;
		code: string;
		inviteUrl: string;
		hostPlayerId: string;
		maxPlayers: number;
		createdAt: string;
		updatedAt: string;
	};
	player: PublicPlayer | null;
	state: PublicRoomState;
	hand: ClientCard[];
	events: RoomEvent[];
};

export type RoomCreatedResponse = {
	roomId: string;
	code: string;
	inviteToken: string;
	inviteUrl: string;
	session: PlayerSession;
	snapshot: RoomSnapshot;
};

export type JoinRoomResponse = {
	roomId: string;
	code: string;
	session: PlayerSession;
	snapshot: RoomSnapshot;
};
