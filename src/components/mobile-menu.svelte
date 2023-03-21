<script lang="ts">
    import { fade } from "svelte/transition";

    let dialog: HTMLDialogElement;
    let open = false;

    function changeDialogState() {
        open = !open;
        open ? dialog.showModal() : dialog.close();
    }
</script>

<button
    class="fixed bg-secondary rounded-full p-4 border-4 shadow-2xl shadow-primary border-primary bottom-0 right-0 mr-6 mb-6 lg:hidden z-[99999] hover:bg-primary hover:border-secondary transition-all duration-150 ease-linear"
    id="menu-button"
    on:click={changeDialogState}
>
    <slot name="menu-icon" />
</button>

<dialog
    bind:this={dialog}
    on:close={() => (open = false)}
    transition:fade
    id="mobile-menu"
    class="fixed inset-0 w-3/4 max-w-5xl bg-transparent m-auto text-color "
>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
        class="flex flex-col gap-4 p-4 bg-secondary border-2 border-primary rounded-lg"
        on:click|stopPropagation
    >
        <h1 class="text-2xl font-bold text-center">Kostur</h1>
        <div><slot name="details" /></div>

        <div class="bg-primary p-4 rounded-md flex flex-col gap-6">
            <slot name="actions" />
            <button
                id="close-button"
                class="px-4 py-2 bg-secondary border-2 border-primary font-bold hover:bg-primary hover:border-secondary transition-colors duration-150 ease-in-out"
                on:click={changeDialogState}>Close</button
            >
        </div>
    </div>
</dialog>

<style>
    dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(0.5rem);
    }

    dialog[open] {
        animation: zoom 0.1s ease-in-out;
    }
    @keyframes zoom {
        from {
            transform: scale(0.95);
        }
        to {
            transform: scale(1);
        }
    }
</style>
