<script lang="ts">
	import type { PublicPlayer } from '../../worker/types';

	export let players: PublicPlayer[] = [];
	export let targetScore = 21;

	$: rankedPlayers = [...players].sort((left, right) => right.score - left.score || left.seatIndex - right.seatIndex);
</script>

<section class="scoreboard">
	<div class="header">
		<h2>Punteggi</h2>
		<span>Si vince a {targetScore}</span>
	</div>

	<ol>
		{#each rankedPlayers as player}
			<li>
				<span>{player.name}</span>
				<strong>{player.score}</strong>
			</li>
		{/each}
	</ol>
</section>

<style>
	.scoreboard {
		display: grid;
		gap: 0.8rem;
	}

	.header,
	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.header span {
		color: var(--white-2);
		font-weight: 800;
	}

	ol {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}

	li {
		min-height: 2.8rem;
		border: 1px solid var(--line);
		border-radius: 0.8rem;
		padding: 0.65rem 0.75rem;
		background: var(--wash);
		text-align: center;
	}

	li span {
		font-weight: 800;
	}

	li strong {
		display: inline-grid;
		min-width: 2rem;
		min-height: 2rem;
		place-items: center;
		border-radius: 999px;
		background: var(--white);
		color: var(--black);
		font-size: 1.15rem;
	}
</style>
