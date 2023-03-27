<script lang="ts">
    import ContactDetailCard from "@components/contact-detail-card.svelte";
    import { fade, fly } from "svelte/transition";
    import { sineInOut } from "svelte/easing";
    import { contact } from "../../../site.config";
    import ThemeToggler from "@components/theme-toggler.svelte";

    let open = false;

    function changeState() {
        open = !open;
    }
</script>

<button
    class="flex items-center h-full p-2 transition-all duration-200 ease-in-out rounded-md lg:hidden hover:bg-primary group"
    on:click={changeState}
>
    <slot name="title" />
</button>

{#if open}
    <div
        in:fade|local={{ duration: 250 }}
        out:fade|local={{ delay: 600 }}
        class="fixed inset-0 flex flex-col justify-between w-full h-full gap-4 overflow-y-scroll text-2xl bg-black/90 backdrop-blur-lg"
    >
        <div class="flex flex-shrink-0 gap-6 p-4 overflow-hidden rounded-lg">
            <img
                src="/images/kostur.png"
                class="object-cover h-96 w-96"
                alt="avatar"
            />
            <div class="flex flex-col items-center justify-between gap-6 pt-12">
                <div>
                    <h2 class="text-3xl ">Contact Details</h2>
                    <span
                        >Below are my contact details. You can click to copy.</span
                    >
                </div>
                <div>
                    <ThemeToggler />
                </div>
            </div>
        </div>

        <div class="flex flex-col h-full gap-4 p-4">
            {#each contact as c, index (c.name)}
                <div
                    transition:fly={{
                        x: -200,
                        duration: 250,
                        delay: 150 * index,
                        easing: sineInOut,
                    }}
                    class="text-2xl"
                >
                    <ContactDetailCard name={c.name} value={c.value} />
                </div>
            {/each}

            <div class="mt-auto font-mono">
                Kostur {new Date().getFullYear()}
            </div>
        </div>
    </div>
{/if}
