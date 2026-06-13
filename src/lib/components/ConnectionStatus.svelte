<script lang="ts">
	type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

	export let state: ConnectionState = 'idle';
	export let detail = '';

	const labels: Record<ConnectionState, string> = {
		idle: 'non connesso',
		connecting: 'connessione...',
		connected: 'online',
		reconnecting: 'riconnessione...',
		disconnected: 'disconnesso',
		error: 'problema rete'
	};
</script>

<div class="connection" data-state={state} aria-live="polite">
	<div class="label-row">
		<span class="dot"></span>
		<span>{labels[state]}</span>
	</div>
	{#if detail}
		<small>{detail}</small>
	{/if}
</div>

<style>
	.connection {
		display: inline-grid;
		gap: 0.5rem;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 0.42rem 0.7rem;
		background: rgba(5, 5, 5, 0.78);
		color: var(--white-2);
		font-size: 0.78rem;
		font-weight: 900;
		text-align: center;
		text-transform: uppercase;
	}

	.label-row {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	small {
		max-width: 18rem;
		color: var(--white-2);
		font-size: 0.68rem;
		font-weight: 800;
		line-height: 1.25;
		text-transform: none;
	}

	.dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		background: currentColor;
		box-shadow: 0 0 0.8rem currentColor;
	}

	.connection[data-state='connected'] {
		border-color: var(--white);
		background: var(--white);
		color: var(--black);
	}

	.connection[data-state='connecting'],
	.connection[data-state='reconnecting'] {
		border-style: dashed;
		color: var(--white);
	}

	.connection[data-state='disconnected'],
	.connection[data-state='error'] {
		border-color: var(--line-strong);
		color: var(--white);
	}
</style>
