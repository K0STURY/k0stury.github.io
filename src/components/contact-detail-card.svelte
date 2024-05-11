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
  function openLink() {
    window.open("https://k0stur.itch.io/")
    
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<section
  data-action="overlay"
  class="relative flex items-center gap-4 p-4 transition-all duration-200 ease-in-out rounded-md cursor-pointer bg-primary outline outline-2 outline-primary hover:bg-secondary hover:outline-primary group hover:animate-gelatine-in-out"
  on:click={copy}
  on:click={openLink}
>
  <div><slot name="icon" /></div>
  <div class="pointer-events-none">
    <span class="font-mono">{value}</span>
  </div>
  {#if copied}
    <div
      transition:fade={{ duration: 250 }}
      data-action="copy"
      class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-1 bg-primary font-bold text-accent"
    >
      Copied
    </div>
  {/if}
</section>
