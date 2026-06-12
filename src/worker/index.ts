import { RoomDurableObject } from './room';
import { ApiError, corsHeaders, errorResponse, getOptionalInteger, getString, json, parseJsonBody } from './http';
import { generateRoomCode } from './random';
import { MAX_PLAYERS, MIN_PLAYERS } from '../lib/game/deck';
import type { WorkerEnv } from './types';

export { RoomDurableObject };

export default {
	async fetch(req: Request, env: WorkerEnv): Promise<Response> {
		if (req.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			const url = new URL(req.url);

			if (url.pathname === '/api/health') {
				return json({ ok: true });
			}

			if (url.pathname === '/api/rooms' && req.method === 'POST') {
				return await createRoom(req, env);
			}

			const match = url.pathname.match(/^\/api\/rooms\/([^/]+)(?:\/([^/]+))?$/);

			if (!match) {
				throw new ApiError(404, 'not_found', 'Route not found.');
			}

			const roomId = normalizeRoomId(match[1]);
			const action = match[2] ?? 'state';

			return await dispatchToRoom(env, roomId, action, req);
		} catch (error) {
			return errorResponse(error);
		}
	}
};

async function createRoom(req: Request, env: WorkerEnv): Promise<Response> {
	const input = await parseJsonBody(req);
	const name = getString(input, 'name');
	const maxPlayers = getOptionalInteger(input, 'maxPlayers', MAX_PLAYERS, {
		min: MIN_PLAYERS,
		max: MAX_PLAYERS
	});
	const siteOrigin = getSiteOrigin(req, env);

	for (let attempt = 0; attempt < 8; attempt += 1) {
		const roomId = generateRoomCode();
		const response = await dispatchToRoom(
			env,
			roomId,
			'create',
			new Request(new URL('/create', req.url), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roomId, name, maxPlayers, siteOrigin })
			})
		);

		if (response.status !== 409) {
			return response;
		}
	}

	throw new ApiError(500, 'room_code_generation_failed', 'Unable to generate a unique room code.');
}

async function dispatchToRoom(
	env: WorkerEnv,
	roomId: string,
	action: string,
	req: Request
): Promise<Response> {
	const id = env.ROOMS.idFromName(roomId);
	const room = env.ROOMS.get(id);
	const url = new URL(req.url);
	url.pathname = `/${action}`;

	return room.fetch(new Request(url, req));
}

function normalizeRoomId(value: string): string {
	return decodeURIComponent(value).trim().toUpperCase();
}

function getSiteOrigin(req: Request, env: WorkerEnv): string {
	return env.PUBLIC_SITE_URL?.replace(/\/$/, '') ?? new URL(req.url).origin;
}
