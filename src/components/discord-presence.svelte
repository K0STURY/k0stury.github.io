<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";

  const DISCORD_ID = "206867415210917888";
  const API_URL = `https://api.lanyard.rest/v1/users/${DISCORD_ID}`;

  type LanyardData = {
    discord_status: "online" | "idle" | "dnd" | "offline";
    discord_user: {
      avatar: string;
      display_name: string;
      username: string;
      id: string;
    };
    activities: Array<{
      name: string;
      type: number;
      state?: string;
      details?: string;
      assets?: {
        large_image?: string;
        large_text?: string;
      };
    }>;
    listening_to_spotify: boolean;
    spotify: {
      song: string;
      artist: string;
      album: string;
      album_art_url: string;
      timestamps: {
        start: number;
        end: number;
      };
    } | null;
  };

  let data: LanyardData | null = null;
  let ws: WebSocket | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  const statusColors: Record<string, string> = {
    online: "#43b581",
    idle: "#faa61a",
    dnd: "#f04747",
    offline: "#747f8d",
  };

  const statusLabels: Record<string, string> = {
    online: "Online",
    idle: "Idle",
    dnd: "Do Not Disturb",
    offline: "Offline",
  };

  function connect() {
    ws = new WebSocket("wss://api.lanyard.rest/socket");

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.op === 1) {
        // Hello — send subscribe and start heartbeat
        ws?.send(
          JSON.stringify({
            op: 2,
            d: { subscribe_to_id: DISCORD_ID },
          }),
        );

        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
          ws?.send(JSON.stringify({ op: 3 }));
        }, msg.d.heartbeat_interval);
      }

      if (msg.op === 0) {
        // Event — initial state or presence update
        data = msg.d;
      }
    };

    ws.onclose = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      // Reconnect after 5s
      setTimeout(connect, 5000);
    };
  }

  onMount(() => {
    connect();
  });

  onDestroy(() => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  });

  $: activity = data?.activities?.find(
    (a) => a.type === 0 && a.name !== "Spotify",
  );
</script>

{#if data}
  <div
    class="flex items-center gap-3 p-3 rounded-md bg-primary outline outline-2 outline-primary transition-all duration-200 text-sm"
    transition:fade={{ duration: 250 }}
  >
    <!-- Status dot -->
    <div class="relative flex-shrink-0">
      <div
        class="w-3 h-3 rounded-full"
        style="background-color: {statusColors[data.discord_status]};"
        title={statusLabels[data.discord_status]}
      ></div>
    </div>

    <!-- Content -->
    <div class="flex flex-col gap-1 min-w-0">
      {#if data.listening_to_spotify && data.spotify}
        <!-- Spotify -->
        <div class="flex items-center gap-2">
          <img
            src={data.spotify.album_art_url}
            alt={data.spotify.album}
            class="w-10 h-10 rounded"
          />
          <div class="min-w-0">
            <p class="text-color font-bold truncate">{data.spotify.song}</p>
            <p class="text-color opacity-60 text-xs truncate">
              {data.spotify.artist}
            </p>
          </div>
        </div>
      {:else if activity}
        <!-- Game/Activity -->
        <div class="min-w-0">
          <p class="text-color opacity-60 text-xs">Playing</p>
          <p class="text-color font-bold truncate">{activity.name}</p>
          {#if activity.details}
            <p class="text-color opacity-60 text-xs truncate">
              {activity.details}
            </p>
          {/if}
        </div>
      {:else}
        <!-- Just status -->
        <p class="text-color opacity-60">
          {statusLabels[data.discord_status]}
        </p>
      {/if}
    </div>
  </div>
{/if}
