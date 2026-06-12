export type PlayerSession = {
	playerId: string;
	playerSecret: string;
};

const STORAGE_KEY = 'murlan:room-sessions';

export function getRoomSession(roomId: string): PlayerSession | null {
	const sessions = readSessions();

	return sessions[normalizeRoomId(roomId)] ?? null;
}

export function saveRoomSession(roomId: string, session: PlayerSession): void {
	const sessions = readSessions();
	sessions[normalizeRoomId(roomId)] = session;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function clearRoomSession(roomId: string): void {
	const sessions = readSessions();
	delete sessions[normalizeRoomId(roomId)];
	localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function readSessions(): Record<string, PlayerSession> {
	if (typeof localStorage === 'undefined') {
		return {};
	}

	const stored = localStorage.getItem(STORAGE_KEY);

	if (!stored) {
		return {};
	}

	try {
		const parsed = JSON.parse(stored) as unknown;

		if (!isRecord(parsed)) {
			return {};
		}

		return Object.fromEntries(
			Object.entries(parsed).filter((entry): entry is [string, PlayerSession] =>
				isPlayerSession(entry[1])
			)
		);
	} catch {
		return {};
	}
}

function normalizeRoomId(roomId: string): string {
	return roomId.trim().toUpperCase();
}

function isPlayerSession(value: unknown): value is PlayerSession {
	return (
		isRecord(value) &&
		typeof value.playerId === 'string' &&
		typeof value.playerSecret === 'string'
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
