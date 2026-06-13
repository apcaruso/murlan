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

<section class="action-bar">
	<div>
		<p class="status">
			{#if isCurrentTurn}
				Tocca a te.
			{:else}
				In attesa del tuo turno.
			{/if}
		</p>
		<p class="selected">Carte selezionate: {selectedCount}</p>
	</div>

	<div class="buttons">
		<button type="button" on:click={onPlay} disabled={!canPlay || isActing}>
			Gioca carte
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
	}

	p {
		margin: 0;
	}

	.status {
		font-weight: 900;
	}

	.selected {
		color: #b7c8bc;
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
		border: 0;
		border-radius: 999px;
		padding: 0.85rem 1rem;
		background: #8df0ad;
		color: #0d1711;
		font: inherit;
		font-weight: 900;
		cursor: pointer;
	}

	button.secondary {
		background: #f1d281;
	}

	button.ghost {
		border: 1px solid rgba(246, 242, 233, 0.18);
		background: transparent;
		color: #f6f2e9;
	}

	button.next {
		background: #f6f2e9;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.error {
		flex-basis: 100%;
		color: #ffb4a8;
		font-weight: 800;
	}

	@media (max-width: 760px) {
		.action-bar {
			align-items: stretch;
			flex-direction: column;
		}

		.buttons {
			justify-content: stretch;
		}

		button {
			flex: 1;
		}
	}
</style>
