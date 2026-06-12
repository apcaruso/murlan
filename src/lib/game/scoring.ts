export const DEFAULT_TARGET_SCORE = 21;
export const TARGET_SCORE_STEPS = [21, 31, 41, 51] as const;
export const MIN_SCORING_PLAYERS = 2;
export const MAX_SCORING_PLAYERS = 5;

export type PlayerId = string;
export type HandScore = Record<PlayerId, number>;
export type ScoringPlayer = {
	id: PlayerId;
	score: number;
};

export function scoreHand(
	finishOrder: readonly PlayerId[],
	playerCount = finishOrder.length
): HandScore {
	assertValidPlayerCount(playerCount);

	if (finishOrder.length !== playerCount) {
		throw new RangeError('Finish order must contain exactly one entry for each player.');
	}

	assertUniquePlayerIds(finishOrder);

	return finishOrder.reduce<HandScore>((handScore, playerId, index) => {
		handScore[playerId] = playerCount - index - 1;
		return handScore;
	}, {});
}

export function applyScores<TPlayer extends ScoringPlayer>(
	players: readonly TPlayer[],
	handScore: Readonly<HandScore>
): TPlayer[] {
	return players.map((player) => ({
		...player,
		score: player.score + (handScore[player.id] ?? 0)
	}));
}

export function getWinners<TPlayer extends ScoringPlayer>(
	players: readonly TPlayer[],
	targetScore: number
): TPlayer[] {
	return players.filter((player) => player.score >= targetScore);
}

export function resolveTargetScore(
	players: readonly ScoringPlayer[],
	targetScore: number
): number {
	if (getWinners(players, targetScore).length <= 1) {
		return targetScore;
	}

	return TARGET_SCORE_STEPS.find((score) => score > targetScore) ?? targetScore;
}

function assertValidPlayerCount(playerCount: number): void {
	if (playerCount < MIN_SCORING_PLAYERS || playerCount > MAX_SCORING_PLAYERS) {
		throw new RangeError(
			`Murlan scoring supports ${MIN_SCORING_PLAYERS} to ${MAX_SCORING_PLAYERS} players.`
		);
	}
}

function assertUniquePlayerIds(playerIds: readonly PlayerId[]): void {
	if (new Set(playerIds).size !== playerIds.length) {
		throw new Error('Finish order cannot contain duplicate players.');
	}
}
