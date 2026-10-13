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
  <a class="tag" href={contact.link} target="_blank" rel="noopener noreferrer">
    <span class="tag-icon"><slot name="icon" /></span>
    <span class="tag-text">{contact.value}</span>
  </a>
{:else}
  <button class="tag" on:click={copy}>
    <span class="tag-icon"><slot name="icon" /></span>
    <span class="tag-text">{contact.value}</span>
    {#if copied}
      <span class="tag-copied" transition:fade={{ duration: 250 }}>Copied</span>
    {/if}
  </button>
{/if}

<style>
  /* A paper tag: rounded "string" end with a punched hole; tilt comes from --tilt on the parent */
  .tag {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 1rem 0.55rem 1.75rem;
    border: none;
    border-radius: 16px 6px 6px 16px;
    background: var(--text-color);
    color: var(--primary-color);
    box-shadow: 3px 3px 0 var(--edge-color);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.9rem;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transform: rotate(var(--tilt, 0deg));
    transition:
      transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.2s ease,
      background-color 0.2s ease;
  }

  .tag::before {
    content: "";
    position: absolute;
    left: 0.65rem;
    top: 50%;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--primary-color);
    transform: translateY(-50%);
  }

  .tag:hover,
  .tag:focus-visible {
    transform: rotate(0deg) translateY(-3px);
    background: var(--accent-color);
    box-shadow: 5px 5px 0 var(--edge-color);
  }

  .tag:focus-visible {
    outline: 2px solid var(--text-color);
    outline-offset: 3px;
  }

  .tag-icon {
    display: inline-flex;
  }

  .tag-copied {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: inherit;
    background: var(--accent-color);
    color: var(--primary-color);
    pointer-events: none;
  }
</style>
