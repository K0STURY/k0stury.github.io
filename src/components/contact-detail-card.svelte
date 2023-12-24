<script lang="ts">
  import { fade } from "svelte/transition";

  export let name: string = "";
  export let value: string = "";

  let copied: boolean = false;
  let overlayTime: number = 750;

  function copy() {
    navigator.clipboard.writeText(value);
    copied = true;

    setTimeout(() => (copied = false), overlayTime);
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<section
  data-action="overlay"
  class="relative flex items-center gap-4 p-4 transition-all duration-200 ease-in-out rounded-md cursor-pointer bg-primary outline outline-2 outline-primary hover:bg-secondary hover:outline-primary group"
  on:click={copy}
>
  <div><slot name="icon" /></div>
  <div class="pointer-events-none">
    <h5 class="font-bold tracking-widest">{name}</h5>
    <span class="font-mono">{value}</span>
  </div>
  {#if copied}
    <div
      transition:fade={{ duration: 250 }}
      data-action="copy"
      class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-1 bg-primary"
    >
      Copied to Clipboard
    </div>
  {/if}
</section>
