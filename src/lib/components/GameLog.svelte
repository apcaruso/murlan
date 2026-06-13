<script lang="ts">
	import type { RoomEvent } from '../cloudflare/rooms';

	export let events: RoomEvent[] = [];
	export let limit = 10;

	$: recentEvents = events.slice(-limit).reverse();

	function eventTitle(event: RoomEvent): string {
		const labels: Record<string, string> = {
			player_joined: 'Player entrato',
			player_rejoined: 'Player rientrato',
			player_left: 'Player uscito',
			host_changed: 'Host cambiato',
			ready_changed: 'Ready aggiornato',
			game_started: 'Partita iniziata',
			hand_started: 'Mano iniziata',
			play_accepted: 'Giocata valida',
			player_passed: 'Passaggio',
			turn_changed: 'Controllo cambiato',
			player_finished: 'Player ha chiuso',
			hand_finished: 'Mano conclusa',
			game_finished: 'Partita conclusa'
		};

		return labels[event.type] ?? event.type;
	}

	function payloadSummary(payload: Record<string, unknown>): string {
		const entries = Object.entries(payload).slice(0, 3);

		return entries.map(([key, value]) => `${key}: ${formatValue(value)}`).join(' · ');
	}

	function formatValue(value: unknown): string {
		if (Array.isArray(value)) {
			return `${value.length} elementi`;
		}

		if (typeof value === 'object' && value !== null) {
			return 'oggetto';
		}

		return String(value);
	}
</script>

<section class="game-log">
	<h2>Log eventi</h2>

	{#if recentEvents.length > 0}
		<ol>
			{#each recentEvents as event}
				<li>
					<strong>{eventTitle(event)}</strong>
					<span>{new Date(event.createdAt).toLocaleTimeString()}</span>
					{#if Object.keys(event.payload).length > 0}
						<p>{payloadSummary(event.payload)}</p>
					{/if}
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
		border-radius: 0.85rem;
		padding: 0.7rem;
		background: rgba(8, 12, 10, 0.26);
	}

	strong,
	span {
		display: block;
	}

	span,
	p,
	.empty {
		color: #b7c8bc;
		font-size: 0.86rem;
	}

	p {
		margin-top: 0.35rem;
	}
</style>
