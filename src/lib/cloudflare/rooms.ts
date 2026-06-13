import { clearRoomSession, getRoomSession, saveRoomSession } from './session';
import type { PlayerSession } from './session';
import type { ClientCard } from '../../worker/card-ids';
import type { JoinRoomResponse, RoomCreatedResponse, RoomEvent, RoomSnapshot } from '../../worker/types';

export type { ClientCard, JoinRoomResponse, PlayerSession, RoomCreatedResponse, RoomEvent, RoomSnapshot };

export class ApiRequestError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string
	) {
		super(message);
		this.name = 'ApiRequestError';
	}
}

export async function createRoom(name: string, maxPlayers = 5): Promise<RoomCreatedResponse> {
	const response = await requestJson<RoomCreatedResponse>('/api/rooms', {
		method: 'POST',
		body: { name, maxPlayers }
	});

	saveRoomSession(response.roomId, response.session);

	return response;
}

export async function joinRoom(
	code: string,
	inviteToken: string,
	name: string
): Promise<JoinRoomResponse> {
	const roomId = normalizeRoomId(code);
	const existingSession = getRoomSession(roomId);
	const response = await requestJson<JoinRoomResponse>(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
		method: 'POST',
		body: {
			name,
			inviteToken,
			...existingSession
		}
	});

	saveRoomSession(response.roomId, response.session);

	return response;
}

export async function setReady(roomId: string, ready: boolean): Promise<{ snapshot: RoomSnapshot }> {
	return roomAction(roomId, 'ready', { ready });
}

export async function startGame(roomId: string): Promise<{ snapshot: RoomSnapshot }> {
	return roomAction(roomId, 'start');
}

export async function playCards(roomId: string, cardIds: string[]): Promise<{ snapshot: RoomSnapshot }> {
	return roomAction(roomId, 'play', { cardIds });
}

export async function passTurn(roomId: string): Promise<{ snapshot: RoomSnapshot }> {
	return roomAction(roomId, 'pass');
}

export async function leaveRoom(roomId: string): Promise<{ left: boolean; roomClosed: boolean }> {
	const response = await roomAction<{ left: boolean; roomClosed: boolean }>(roomId, 'leave');
	clearRoomSession(roomId);

	return response;
}

export async function getRoomState(roomId: string): Promise<RoomSnapshot> {
	const session = requireRoomSession(roomId);
	const query = new URLSearchParams(session);

	return requestJson<RoomSnapshot>(`/api/rooms/${encodeURIComponent(normalizeRoomId(roomId))}/state?${query}`);
}

async function roomAction<T = { snapshot: RoomSnapshot }>(
	roomId: string,
	action: string,
	body: Record<string, unknown> = {}
): Promise<T> {
	return requestJson<T>(`/api/rooms/${encodeURIComponent(normalizeRoomId(roomId))}/${action}`, {
		method: 'POST',
		body: {
			...requireRoomSession(roomId),
			...body
		}
	});
}

async function requestJson<T>(
	path: string,
	options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<T> {
	const response = await fetch(path, {
		method: options.method ?? 'GET',
		headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
		body: options.body ? JSON.stringify(options.body) : undefined
	});
	const data = (await response.json()) as unknown;

	if (!response.ok) {
		throw getApiRequestError(response.status, data);
	}

	return data as T;
}

function requireRoomSession(roomId: string): PlayerSession {
	const session = getRoomSession(roomId);

	if (!session) {
		throw new Error('Missing local room session. Join the room again.');
	}

	return session;
}

function normalizeRoomId(roomId: string): string {
	return roomId.trim().toUpperCase();
}

function getApiRequestError(status: number, data: unknown): ApiRequestError {
	if (
		typeof data === 'object' &&
		data !== null &&
		'error' in data &&
		typeof data.error === 'object' &&
		data.error !== null &&
		'code' in data.error &&
		typeof data.error.code === 'string' &&
		'message' in data.error &&
		typeof data.error.message === 'string'
	) {
		return new ApiRequestError(status, data.error.code, data.error.message);
	}

	return new ApiRequestError(status, 'request_failed', 'Request failed.');
}
