export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message = code,
		readonly details?: unknown
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export type JsonObject = Record<string, unknown>;

export function json(data: unknown, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers);
	headers.set('Content-Type', 'application/json');

	return new Response(JSON.stringify(data), {
		...init,
		headers
	});
}

export function errorResponse(error: unknown): Response {
	if (error instanceof ApiError) {
		return json(
			{
				error: {
					code: error.code,
					message: error.message,
					details: error.details
				}
			},
			{ status: error.status }
		);
	}

	if (isGameActionError(error)) {
		return json(
			{
				error: {
					code: error.code,
					message: error.code
				}
			},
			{ status: 400 }
		);
	}

	console.error(error);

	return json(
		{
			error: {
				code: 'internal_error',
				message: 'Internal server error.'
			}
		},
		{ status: 500 }
	);
}

export async function parseJsonBody(req: Request): Promise<JsonObject> {
	const text = await req.text();

	if (!text.trim()) {
		return {};
	}

	try {
		const parsed = JSON.parse(text) as unknown;

		if (!isJsonObject(parsed)) {
			throw new ApiError(400, 'invalid_json', 'Request body must be a JSON object.');
		}

		return parsed;
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}

		throw new ApiError(400, 'invalid_json', 'Request body is not valid JSON.');
	}
}

export function getString(input: JsonObject, key: string): string {
	const value = input[key];

	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new ApiError(400, 'invalid_input', `${key} is required.`);
	}

	return value.trim();
}

export function getOptionalString(input: JsonObject, key: string): string | null {
	const value = input[key];

	if (value === undefined || value === null || value === '') {
		return null;
	}

	if (typeof value !== 'string') {
		throw new ApiError(400, 'invalid_input', `${key} must be a string.`);
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export function getBoolean(input: JsonObject, key: string): boolean {
	const value = input[key];

	if (typeof value !== 'boolean') {
		throw new ApiError(400, 'invalid_input', `${key} must be a boolean.`);
	}

	return value;
}

export function getOptionalInteger(
	input: JsonObject,
	key: string,
	defaultValue: number,
	options: { min?: number; max?: number } = {}
): number {
	const value = input[key];

	if (value === undefined || value === null || value === '') {
		return defaultValue;
	}

	const numberValue = typeof value === 'number' ? value : Number(value);

	if (!Number.isInteger(numberValue)) {
		throw new ApiError(400, 'invalid_input', `${key} must be an integer.`);
	}

	if (options.min !== undefined && numberValue < options.min) {
		throw new ApiError(400, 'invalid_input', `${key} must be at least ${options.min}.`);
	}

	if (options.max !== undefined && numberValue > options.max) {
		throw new ApiError(400, 'invalid_input', `${key} must be at most ${options.max}.`);
	}

	return numberValue;
}

export function getStringArray(input: JsonObject, key: string): string[] {
	const value = input[key];

	if (!Array.isArray(value) || value.length === 0) {
		throw new ApiError(400, 'invalid_input', `${key} must be a non-empty string array.`);
	}

	const values = value.map((item) => {
		if (typeof item !== 'string' || item.trim().length === 0) {
			throw new ApiError(400, 'invalid_input', `${key} must contain only non-empty strings.`);
		}

		return item.trim();
	});

	if (new Set(values).size !== values.length) {
		throw new ApiError(400, 'invalid_input', `${key} cannot contain duplicate values.`);
	}

	return values;
}

export function assertMethod(req: Request, methods: readonly string[]): void {
	if (!methods.includes(req.method)) {
		throw new ApiError(405, 'method_not_allowed', 'Method not allowed.');
	}
}

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGameActionError(error: unknown): error is { code: string } {
	return (
		typeof error === 'object' &&
		error !== null &&
		'name' in error &&
		error.name === 'GameActionError' &&
		'code' in error &&
		typeof error.code === 'string'
	);
}
