<script lang="ts">
  import { onMount } from "svelte";
  import extractThemes from "../scripts/extractThemes";

  let html: HTMLElement;

  let themes = extractThemes();

  let selectedTheme: string | null = null

    $: {
      if (html) {
        localStorage.setItem("theme", selectedTheme ?? "default");
        html.dataset.theme = selectedTheme ?? "default";
      }
    }

  onMount(() => {
    html = document.documentElement;

    selectedTheme = localStorage.getItem("theme") !== null && typeof window !== "undefined"
        ? localStorage.getItem("theme")
        : "default";
    
  });
</script>

<form class="flex flex-wrap items-center justify-center gap-2">
  {#each themes as theme}
    <div data-theme={theme}>
      <input
        type="radio"
        data-theme={theme}
        id={theme}
        name={theme}
        value={theme}
        bind:group={selectedTheme}
      />
      <label
        class="flex overflow-hidden border-2 rounded-full cursor-pointer border-primary hover:animate-gelatine-in-out"
        for={theme}
      >
        <div class="w-6 h-16 lg:w-2 lg:h-6 bg-primary" />
        <div class="w-6 h-16 lg:w-2 lg:h-6 bg-secondary" />
        <div class="w-6 h-16 lg:w-2 lg:h-6 bg-color" />
      </label>
    </div>
  {/each}
</form>

<!-- <script>
    const selectors = document.querySelectorAll("input[data-theme]");
    const html = document.documentElement;

    selectors.forEach((selector) => {
        selector.addEventListener("click", (e) => {
            const element = e.target as HTMLInputElement;
            localStorage.setItem("theme", element.value);
            html.dataset.theme = element.value;
        });
    });
</script> -->
<style>
  input[type="radio"] {
    position: fixed;
    opacity: 0;
    pointer-events: none;
  }
</style>
