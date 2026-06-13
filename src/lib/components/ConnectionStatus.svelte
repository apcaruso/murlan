<script lang="ts">
	type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

	export let state: ConnectionState = 'idle';

	const labels: Record<ConnectionState, string> = {
		idle: 'non connesso',
		connecting: 'connessione...',
		connected: 'online',
		disconnected: 'disconnesso',
		error: 'errore realtime'
	};
</script>

<div class="connection" data-state={state} aria-live="polite">
	<span class="dot"></span>
	<span>{labels[state]}</span>
</div>

<style>
	.connection {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid rgba(246, 242, 233, 0.16);
		border-radius: 999px;
		padding: 0.42rem 0.7rem;
		background: rgba(246, 242, 233, 0.08);
		color: #d8d4c9;
		font-size: 0.78rem;
		font-weight: 900;
		text-transform: uppercase;
	}

	.dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		background: currentColor;
		box-shadow: 0 0 0.8rem currentColor;
	}

	.connection[data-state='connected'] {
		color: #8df0ad;
	}

	.connection[data-state='connecting'] {
		color: #f1d281;
	}

	.connection[data-state='disconnected'],
	.connection[data-state='error'] {
		color: #ffb4a8;
	}
</style>
