const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 8): string {
	const values = new Uint32Array(length);
	crypto.getRandomValues(values);

	return Array.from(values, (value) => ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length]).join('');
}

export function generateSecret(byteLength = 24): string {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);

	return base64Url(bytes);
}

function base64Url(bytes: Uint8Array): string {
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
