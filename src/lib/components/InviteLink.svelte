<script lang="ts">
	export let inviteUrl = '';

	let copied = false;
	let copyFailed = false;

	$: absoluteInviteUrl = getAbsoluteInviteUrl(inviteUrl);

	async function copyInviteUrl() {
		copied = false;
		copyFailed = false;

		try {
			await navigator.clipboard.writeText(absoluteInviteUrl);
			copied = true;
		} catch {
			copyFailed = true;
			return;
		}

		window.setTimeout(() => {
			copied = false;
		}, 1800);
	}

	function getAbsoluteInviteUrl(value: string): string {
		if (!value) {
			return '';
		}

		try {
			const baseUrl = typeof window === 'undefined' ? 'https://murlan.local' : window.location.origin;
			return new URL(value, baseUrl).toString();
		} catch {
			return value;
		}
	}
</script>

<div class="invite-link">
	<label>
		Link invito
		<input readonly value={absoluteInviteUrl} on:focus={(event) => event.currentTarget.select()} />
	</label>

	<button type="button" class="secondary" on:click={copyInviteUrl} disabled={!absoluteInviteUrl}>
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
		color: var(--white-2);
		font-size: 0.8rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--line);
		border-radius: 0.85rem;
		padding: 0.8rem 0.95rem;
		background: var(--black);
		color: var(--white);
		font: inherit;
	}

	button {
		display: inline-grid;
		min-height: 2.8rem;
		place-items: center;
		border: 1px solid var(--white);
		border-radius: 999px;
		padding: 0.85rem 1rem;
		background: var(--white);
		color: var(--black);
		font: inherit;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-align: center;
		text-transform: uppercase;
		cursor: pointer;
		white-space: nowrap;
		transition:
			transform 140ms ease,
			background 140ms ease,
			color 140ms ease;
	}

	button:hover:not(:disabled) {
		transform: translateY(-2px);
		background: var(--black);
		color: var(--white);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.copy-error {
		margin: 0.65rem 0 0;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		padding: 0.65rem 0.8rem;
		background: var(--wash);
		color: var(--white);
		font-size: 0.9rem;
		font-weight: 800;
		text-align: center;
	}

	@media (max-width: 760px) {
		.invite-link {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
