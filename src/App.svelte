<script lang="ts">
	import Home from './Home.svelte';
	import Room from './Room.svelte';

	const path = window.location.pathname;
</script>

{#if path.startsWith('/room/')}
	<Room />
{:else}
	<Home />
{/if}
