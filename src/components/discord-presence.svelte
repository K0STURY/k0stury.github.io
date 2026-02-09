<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";

  const DISCORD_ID = "206867415210917888";

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
        data = msg.d;
      }
    };

    ws.onclose = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
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
  <div class="presence-card" transition:fade={{ duration: 250 }}>
    <!-- Discord header -->
    <div class="presence-header">
      <svg class="discord-logo" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
      <span class="presence-label">Discord</span>
      <div class="presence-status-dot" style="background-color: {statusColors[data.discord_status]};"></div>
      <span class="presence-status-text" style="color: {statusColors[data.discord_status]};">
        {statusLabels[data.discord_status]}
      </span>
    </div>

    <!-- Content -->
    <div class="presence-body">
      {#if data.listening_to_spotify && data.spotify}
        <div class="presence-activity">
          <img
            src={data.spotify.album_art_url}
            alt={data.spotify.album}
            class="presence-art"
          />
          <div class="presence-info">
            <span class="presence-type">Listening to Spotify</span>
            <span class="presence-title">{data.spotify.song}</span>
            <span class="presence-detail">by {data.spotify.artist}</span>
            <span class="presence-detail">{data.spotify.album}</span>
          </div>
        </div>
      {:else if activity}
        <div class="presence-activity">
          {#if activity.assets?.large_image}
            <img
              src={activity.assets.large_image.startsWith("mp:external/")
                ? `https://media.discordapp.net/external/${activity.assets.large_image.slice(12)}`
                : `https://cdn.discordapp.com/app-assets/${activity.name}/${activity.assets.large_image}.png`}
              alt={activity.assets.large_text || activity.name}
              class="presence-art"
            />
          {/if}
          <div class="presence-info">
            <span class="presence-type">Playing</span>
            <span class="presence-title">{activity.name}</span>
            {#if activity.details}
              <span class="presence-detail">{activity.details}</span>
            {/if}
            {#if activity.state}
              <span class="presence-detail">{activity.state}</span>
            {/if}
          </div>
        </div>
      {:else}
        <span class="presence-idle">Prob doodling</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .presence-card {
    width: 100%;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(88, 101, 242, 0.25);
    overflow: hidden;
    transition: border-color 0.2s ease;
  }

  .presence-card:hover {
    border-color: #5865F2;
  }

  .presence-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.85rem;
    background: rgba(88, 101, 242, 0.08);
    border-bottom: 1px solid rgba(88, 101, 242, 0.12);
  }

  .discord-logo {
    color: #5865F2;
    flex-shrink: 0;
  }

  .presence-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #5865F2;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-right: auto;
  }

  .presence-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .presence-status-text {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .presence-body {
    padding: 0.75rem 0.85rem;
  }

  .presence-activity {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .presence-art {
    width: 52px;
    height: 52px;
    border-radius: 8px;
    flex-shrink: 0;
    object-fit: cover;
  }

  .presence-info {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .presence-type {
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
  }

  .presence-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #fff;
    line-height: 1.3;
  }

  .presence-detail {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.45);
    line-height: 1.3;
  }

  .presence-idle {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.3);
    font-style: italic;
  }
</style>
