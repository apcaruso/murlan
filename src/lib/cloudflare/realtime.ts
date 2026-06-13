import { getRoomSession } from './session';
import type { RoomSnapshot } from './rooms';

export type RoomSocketMessage =
	| {
			type: string;
			snapshot: RoomSnapshot;
	  }
	| {
			type: 'pong';
	  };

export type RoomSubscription = {
	socket: WebSocket;
	unsubscribe: () => void;
};

export function subscribeToRoom(
	roomId: string,
	callbacks: {
		onMessage: (message: RoomSocketMessage) => void;
		onOpen?: () => void;
		onClose?: () => void;
		onError?: (event: Event) => void;
	}
): RoomSubscription {
	const session = getRoomSession(roomId);

	if (!session) {
		throw new Error('Missing local room session. Join the room again.');
	}

	const query = new URLSearchParams(session);
	const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
	const socket = new WebSocket(
		`${protocol}//${location.host}/api/rooms/${encodeURIComponent(roomId.trim().toUpperCase())}/socket?${query}`
	);

	socket.addEventListener('open', () => callbacks.onOpen?.());
	socket.addEventListener('close', () => callbacks.onClose?.());
	socket.addEventListener('error', (event) => callbacks.onError?.(event));
	socket.addEventListener('message', (event) => {
		if (typeof event.data !== 'string') {
			return;
		}

		try {
			callbacks.onMessage(JSON.parse(event.data) as RoomSocketMessage);
		} catch (error) {
			console.error('Invalid realtime message.', error);
		}
	});

	return {
		socket,
		unsubscribe: () => {
			if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
				socket.close();
			}
		}
	};
}
