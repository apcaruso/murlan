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
	<title>Murlan - Crea stanza</title>
</svelte:head>

<main class="page-shell">
	<section class="hero">
		<p class="eyebrow">Murlan multiplayer</p>
		<h1>Crea una stanza e invita gli altri giocatori.</h1>
		<p class="intro">
			Il server gestisce regole, mani e turni. Tu scegli il nome, condividi il link e inizi
			quando la lobby e pronta.
		</p>

		<form class="create-card" on:submit|preventDefault={handleCreateRoom}>
			<label>
				Nome giocatore
				<input bind:value={name} name="name" required maxlength="32" placeholder="Alessandro" />
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
				{isSubmitting ? 'Creazione...' : 'Crea stanza'}
			</button>
		</form>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		background: #17130f;
		color: #fff8ed;
	}

	.page-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 2rem;
		background:
			radial-gradient(circle at top left, rgba(214, 143, 57, 0.28), transparent 32rem),
			linear-gradient(135deg, #17130f 0%, #25180f 100%);
	}

	.hero {
		width: min(100%, 44rem);
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		color: #f0b35f;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.5rem, 8vw, 5.8rem);
		line-height: 0.92;
		letter-spacing: -0.06em;
	}

	.intro {
		max-width: 36rem;
		margin: 1.25rem 0 2rem;
		color: #d5c4ad;
		font-size: 1.1rem;
		line-height: 1.65;
	}

	.create-card {
		display: grid;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid rgba(255, 248, 237, 0.16);
		border-radius: 1.25rem;
		background: rgba(255, 248, 237, 0.08);
		box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(16px);
	}

	label {
		display: grid;
		gap: 0.45rem;
		font-size: 0.85rem;
		font-weight: 700;
		color: #f4dcc0;
	}

	input,
	select {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid rgba(255, 248, 237, 0.22);
		border-radius: 0.9rem;
		padding: 0.9rem 1rem;
		background: rgba(23, 19, 15, 0.8);
		color: #fff8ed;
		font: inherit;
	}

	button {
		border: 0;
		border-radius: 999px;
		padding: 1rem 1.2rem;
		background: #f0b35f;
		color: #1b130c;
		font: inherit;
		font-weight: 900;
		cursor: pointer;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.error {
		margin: 0;
		color: #ffb4a8;
		font-weight: 700;
	}
</style>
