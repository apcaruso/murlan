<script lang="ts">
	import { createRoom } from '../lib/cloudflare/rooms';

	let name = '';
	let maxPlayers = 5;
	let isSubmitting = false;
	let error = '';

	async function handleCreateRoom() {
		error = '';
		isSubmitting = true;

		try {
			const response = await createRoom(name, maxPlayers);
			window.location.assign(`/room/${encodeURIComponent(response.roomId)}`);
		} catch (caughtError) {
			error = caughtError instanceof Error ? caughtError.message : 'Impossibile creare la stanza.';
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Murlan - Apri il tavolo</title>
</svelte:head>

<main class="page-shell">
	<section class="hero">
		<p class="eyebrow">Murlan online</p>
		<h1>Chiudi prima di tutti.</h1>
		<p class="intro">
			Invita gli amici, prepara il tavolo e gioca una mano dopo l'altra. Quando tocca a te,
			scegli le carte giuste: rilancia, passa o liberati della mano.
		</p>

		<div class="signal-row" aria-label="Cosa ti aspetta">
			<span>Sfida privata</span>
			<span>Turni rapidi</span>
			<span>2-5 giocatori</span>
		</div>

		<form class="create-card" on:submit|preventDefault={handleCreateRoom}>
			<label>
				Nome giocatore
				<input bind:value={name} name="name" required maxlength="32" placeholder="Giocatore" />
			</label>

			<label>
				Giocatori massimi
				<select bind:value={maxPlayers} name="maxPlayers">
					<option value={2}>2</option>
					<option value={3}>3</option>
					<option value={4}>4</option>
					<option value={5}>5</option>
				</select>
			</label>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<button type="submit" disabled={isSubmitting || name.trim().length === 0}>
				{isSubmitting ? 'Preparazione...' : 'Apri il tavolo'}
			</button>
		</form>
	</section>
</main>

<style>
	.page-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: max(1rem, env(safe-area-inset-top)) clamp(1rem, 3vw, 2rem) max(1rem, env(safe-area-inset-bottom));
		background:
			linear-gradient(120deg, transparent 0 47%, rgba(247, 247, 242, 0.08) 47% 48%, transparent 48% 100%),
			radial-gradient(circle at 72% 18%, rgba(247, 247, 242, 0.14), transparent 18rem),
			linear-gradient(145deg, #050505 0%, #111111 100%);
		overflow-x: hidden;
	}

	.hero {
		position: relative;
		width: min(100%, 54rem);
		padding: clamp(1rem, 3vw, 2rem);
	}

	.hero::before {
		position: absolute;
		inset: -1rem;
		z-index: 0;
		border: 1px solid var(--line);
		border-radius: 2rem;
		background:
			linear-gradient(90deg, rgba(247, 247, 242, 0.08) 1px, transparent 1px),
			linear-gradient(180deg, rgba(247, 247, 242, 0.08) 1px, transparent 1px);
		background-size: 4.5rem 4.5rem;
		content: '';
		mask-image: linear-gradient(135deg, black, transparent 76%);
		pointer-events: none;
	}

	.hero > * {
		position: relative;
		z-index: 1;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--white-2);
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.24em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		max-width: 11ch;
		font-size: clamp(3.2rem, 13vw, 8.5rem);
		line-height: 0.92;
		letter-spacing: -0.08em;
		text-transform: uppercase;
	}

	.intro {
		max-width: 38rem;
		margin: 1.25rem 0 2rem;
		color: var(--white-2);
		font-size: 1.1rem;
		line-height: 1.65;
	}

	.signal-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-bottom: 1rem;
	}

	.signal-row span {
		display: inline-grid;
		min-height: 2.15rem;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 0.35rem 0.75rem;
		background: rgba(5, 5, 5, 0.72);
		color: var(--white);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-align: center;
		text-transform: uppercase;
	}

	.create-card {
		display: grid;
		gap: 1rem;
		padding: clamp(1rem, 3vw, 1.35rem);
		border: 1px solid var(--line);
		border-radius: var(--radius-lg);
		background: rgba(5, 5, 5, 0.78);
		box-shadow: var(--shadow);
		backdrop-filter: blur(16px);
	}

	label {
		display: grid;
		gap: 0.45rem;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--white-2);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	input,
	select {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--line);
		border-radius: 0.9rem;
		padding: 0.9rem 1rem;
		background: var(--black);
		color: var(--white);
		font: inherit;
	}

	button {
		display: inline-grid;
		min-height: 3.15rem;
		place-items: center;
		border: 1px solid var(--white);
		border-radius: 999px;
		padding: 1rem 1.2rem;
		background: var(--white);
		color: var(--black);
		font: inherit;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-align: center;
		text-transform: uppercase;
		cursor: pointer;
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
		opacity: 0.55;
	}

	.error {
		margin: 0;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		padding: 0.7rem 0.85rem;
		background: var(--wash);
		color: var(--white);
		font-weight: 700;
		text-align: center;
	}

	@media (max-width: 620px) {
		.page-shell {
			align-items: start;
			place-items: start center;
		}

		h1 {
			font-size: clamp(3rem, 18vw, 5.8rem);
		}

		.hero {
			padding: 0;
		}
	}
</style>
