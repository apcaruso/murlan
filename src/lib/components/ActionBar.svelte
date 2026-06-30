<script lang="ts">
	export let selectedCount = 0;
	export let isCurrentTurn = false;
	export let canPlay = false;
	export let canPass = false;
	export let canStartNextHand = false;
	export let isActing = false;
	export let error = '';
	export let onPlay: () => void | Promise<void> = () => {};
	export let onPass: () => void | Promise<void> = () => {};
	export let onClearSelection: () => void = () => {};
	export let onStartNextHand: () => void | Promise<void> = () => {};
</script>

<section class="action-bar" class:active={isCurrentTurn}>
	<div>
		<p class="status">
			{#if isCurrentTurn}
				Tocca a te
			{:else}
				In attesa del turno
			{/if}
		</p>
		<p class="selected">{selectedCount} carte selezionate</p>
	</div>

	<div class="buttons">
		<button type="button" on:click={onPlay} disabled={!canPlay || isActing}>
			Gioca
		</button>
		<button type="button" class="secondary" on:click={onPass} disabled={!canPass || isActing}>
			Passa
		</button>
		<button type="button" class="ghost" on:click={onClearSelection} disabled={selectedCount === 0 || isActing}>
			Deseleziona
		</button>
		{#if canStartNextHand}
			<button type="button" class="next" on:click={onStartNextHand} disabled={isActing}>
				Prossima mano
			</button>
		{/if}
	</div>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
</section>

<style>
	.action-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-width: 0;
	}

	p {
		margin: 0;
	}

	.status {
		font-size: clamp(1.1rem, 2.4vw, 1.55rem);
		font-weight: 900;
		letter-spacing: -0.04em;
	}

	.selected {
		color: var(--white-2);
		font-size: 0.9rem;
		font-weight: 800;
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.6rem;
	}

	button {
		display: inline-grid;
		min-height: 2.9rem;
		min-width: 7.2rem;
		place-items: center;
		border: 0;
		border-radius: 999px;
		padding: 0.85rem 1rem;
		background: var(--white);
		color: var(--black);
		font: inherit;
		font-weight: 900;
		letter-spacing: 0.05em;
		text-align: center;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			transform 140ms ease,
			background 140ms ease,
			color 140ms ease,
			opacity 140ms ease;
	}

	button:hover:not(:disabled) {
		transform: translateY(-2px);
		background: var(--black);
		color: var(--white);
	}

	button.secondary {
		background: var(--black-3);
		color: var(--white);
	}

	button.ghost {
		background: var(--wash);
		color: var(--white);
	}

	button.next {
		background: var(--white);
		color: var(--black);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.error {
		flex-basis: 100%;
		border-radius: var(--radius-sm);
		padding: 0.65rem 0.8rem;
		background: var(--wash);
		color: var(--white);
		font-weight: 800;
		text-align: center;
	}

	@media (max-width: 760px) {
		.action-bar {
			align-items: stretch;
			flex-direction: column;
			gap: 0.5rem;
		}

		.action-bar > div:first-child {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 0.75rem;
		}

		.status {
			font-size: 0.98rem;
		}

		.selected {
			font-size: 0.72rem;
			text-align: right;
			white-space: nowrap;
		}

		.buttons {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.45rem;
		}

		button {
			min-width: 0;
			min-height: 3rem;
			padding: 0.78rem 0.8rem;
			font-size: 0.86rem;
		}

		button.ghost,
		button.next {
			grid-column: 1 / -1;
			min-height: 2.35rem;
			font-size: 0.72rem;
		}
	}
</style>
