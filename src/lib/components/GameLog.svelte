<script lang="ts">
	import type { RoomEvent } from '../cloudflare/rooms';

	export let events: RoomEvent[] = [];
	export let limit = 10;

	$: recentEvents = events.slice(-limit).reverse();

	function eventTitle(event: RoomEvent): string {
		const labels: Record<string, string> = {
			player_joined: 'Giocatore entrato',
			player_rejoined: 'Giocatore rientrato',
			player_left: 'Giocatore uscito',
			host_changed: 'Nuovo capo tavolo',
			ready_changed: 'Prontezza aggiornata',
			game_started: 'Partita iniziata',
			hand_started: 'Mano iniziata',
			play_accepted: 'Giocata valida',
			player_passed: 'Passaggio',
			turn_changed: 'Nuovo controllo',
			player_finished: 'Giocatore ha chiuso',
			hand_finished: 'Mano conclusa',
			game_finished: 'Partita conclusa'
		};

		return labels[event.type] ?? event.type;
	}

</script>

<section class="game-log">
	<h2>Cronologia</h2>

	{#if recentEvents.length > 0}
		<ol>
			{#each recentEvents as event}
				<li>
					<strong>{eventTitle(event)}</strong>
					<span>{new Date(event.createdAt).toLocaleTimeString()}</span>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="empty">Nessun evento recente.</p>
	{/if}
</section>

<style>
	.game-log {
		display: grid;
		gap: 0.8rem;
	}

	h2,
	p {
		margin: 0;
	}

	h2 {
		font-size: 1.1rem;
	}

	ol {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.6rem;
	}

	li {
		border: 1px solid var(--line);
		border-radius: 0.85rem;
		padding: 0.7rem;
		background: var(--wash);
		text-align: center;
	}

	strong,
	span {
		display: block;
	}

	span,
	p,
	.empty {
		color: var(--white-2);
		font-size: 0.86rem;
	}

	p {
		margin-top: 0.35rem;
	}
</style>
