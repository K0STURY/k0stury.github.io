<script lang="ts">
  import { onMount } from "svelte";
  import extractThemes from "../scripts/extractThemes";

  let html: HTMLElement;

  let themes = extractThemes();

  let selectedTheme: string | null = null;

  function setTheme(newTheme: string) {
    selectedTheme = newTheme;
    localStorage.setItem("theme", selectedTheme);
    html.setAttribute("data-theme", selectedTheme);
  }

  onMount(() => {
    html = document.documentElement;

    selectedTheme =
      localStorage.getItem("theme") !== null && typeof window !== "undefined"
        ? localStorage.getItem("theme")
        : "default";
      
    html.setAttribute("data-theme", selectedTheme ?? "default");
  });
</script>

<ul class="flex gap-4 ">
  {#each themes as theme}
    <li>
      <button
        data-theme={theme}
        class=" rounded-md cursor-pointer  hover:animate-gelatine-in-out w-6 h-6 gradient"
        class:outline={theme === selectedTheme}
        class:outline-primary={theme === selectedTheme}
        class:outline-offset-2={theme === selectedTheme}
        on:click={(e) => setTheme(theme)}
      ></button>
    </li>
  {/each}
</ul>

<style>
  .gradient {
    background: linear-gradient(
      to right,
      var(--primary-color) 0 33%,
      var(--secondary-color) 33% 66%,
      var(--text-color) 66%
    );
  }
</style>
