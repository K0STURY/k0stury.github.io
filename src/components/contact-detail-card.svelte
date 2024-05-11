<script lang="ts">
  import { fade } from "svelte/transition";
  import type { ContactProps } from "../site.config";

  export let contact: ContactProps;

  let copied: boolean = false;
  let overlayTime: number = 750;

  function copy() {
    navigator.clipboard.writeText(contact.value);
    copied = true;

    setTimeout(() => (copied = false), overlayTime);
  }
</script>

{#if contact.link}
  <a
    data-action="overlay"
    class="flex items-center gap-4 p-4 transition-all duration-200 ease-in-out rounded-md cursor-pointer bg-primary outline outline-2 outline-primary hover:bg-secondary hover:outline-primary group hover:animate-gelatine-in-out"
    href={contact.link}
    target="_blank"
  >
    <div><slot name="icon" /></div>
    <div class="pointer-events-none">
      <span class="font-mono">{contact.value}</span>
    </div>
  </a>
{:else}
  <button
    data-action="overlay"
    class="relative flex items-center gap-4 p-4 transition-all duration-200 ease-in-out rounded-md cursor-pointer bg-primary outline outline-2 outline-primary hover:bg-secondary hover:outline-primary group hover:animate-gelatine-in-out"
    on:click={copy}
  >
    <div><slot name="icon" /></div>
    <div class="pointer-events-none">
      <span class="font-mono">{contact.value}</span>
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
  </button>
{/if}
