<script lang="ts">
	export let inviteUrl = '';

	let copied = false;
	let copyFailed = false;

	async function copyInviteUrl() {
		copied = false;
		copyFailed = false;

		try {
			await navigator.clipboard.writeText(inviteUrl);
			copied = true;
		} catch {
			copyFailed = true;
			return;
		}

		window.setTimeout(() => {
			copied = false;
		}, 1800);
	}
</script>

<div class="invite-link">
	<label>
		Link invito
		<input readonly value={inviteUrl} on:focus={(event) => event.currentTarget.select()} />
	</label>

	<button type="button" class="secondary" on:click={copyInviteUrl} disabled={!inviteUrl}>
		{copied ? 'Copiato' : 'Copia link'}
	</button>
</div>

{#if copyFailed}
	<p class="copy-error" role="alert">Copia non riuscita. Seleziona e copia il link manualmente.</p>
{/if}

<style>
	.invite-link {
		display: flex;
		gap: 0.75rem;
		align-items: end;
		margin-top: 1rem;
	}

	label {
		display: grid;
		flex: 1;
		gap: 0.45rem;
		color: #cfe7d4;
		font-size: 0.8rem;
		font-weight: 900;
		text-transform: uppercase;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid rgba(246, 242, 233, 0.18);
		border-radius: 0.85rem;
		padding: 0.8rem 0.95rem;
		background: rgba(8, 12, 10, 0.58);
		color: #f6f2e9;
		font: inherit;
	}

	button {
		border: 0;
		border-radius: 999px;
		padding: 0.85rem 1rem;
		background: #f6f2e9;
		color: #0d1711;
		font: inherit;
		font-weight: 900;
		cursor: pointer;
		white-space: nowrap;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.copy-error {
		margin: 0.65rem 0 0;
		color: #ffb4a8;
		font-size: 0.9rem;
		font-weight: 800;
	}

	@media (max-width: 760px) {
		.invite-link {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
