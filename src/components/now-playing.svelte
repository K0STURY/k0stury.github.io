<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fly } from "svelte/transition";

  const DISCORD_ID = "206867415210917888";

  type SpotifyData = {
    song: string;
    artist: string;
    album_art_url: string;
    timestamps: {
      start: number;
      end: number;
    };
  };

  let spotify: SpotifyData | null = null;
  let ws: WebSocket | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let progress = 0;
  let progressInterval: ReturnType<typeof setInterval> | null = null;
  let collapsed = false;

  function updateProgress() {
    if (!spotify) return;
    const now = Date.now();
    const total = spotify.timestamps.end - spotify.timestamps.start;
    const elapsed = now - spotify.timestamps.start;
    progress = Math.min(Math.max(elapsed / total, 0), 1);
  }

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
        const data = msg.d;
        if (data.listening_to_spotify && data.spotify) {
          spotify = data.spotify;
          updateProgress();
        } else {
          spotify = null;
        }
      }
    };

    ws.onclose = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      setTimeout(connect, 5000);
    };
  }

  onMount(() => {
    connect();
    progressInterval = setInterval(updateProgress, 1000);
  });

  onDestroy(() => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (progressInterval) clearInterval(progressInterval);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  });
</script>

{#if spotify}
  <div
    class="now-playing"
    class:collapsed
    transition:fly={{ y: 20, duration: 300 }}
  >
    <button class="np-toggle" on:click={() => (collapsed = !collapsed)} aria-label="Toggle now playing">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
      </svg>
    </button>

    {#if !collapsed}
      <div class="np-content">
        <img
          src={spotify.album_art_url}
          alt="Album art"
          class="np-art"
        />
        <div class="np-info">
          <p class="np-label">Now Playing</p>
          <p class="np-song">{spotify.song}</p>
          <p class="np-artist">{spotify.artist}</p>
          <div class="np-bar">
            <div class="np-bar-fill" style="width: {progress * 100}%"></div>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .now-playing {
    position: fixed;
    bottom: 1.5rem;
    left: 1.5rem;
    z-index: 50;
    background: rgba(20, 20, 20, 0.9);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    overflow: hidden;
    max-width: 280px;
    transition: all 0.3s ease;
  }

  .now-playing:hover {
    border-color: #1DB954;
  }

  .now-playing.collapsed {
    border-radius: 50%;
    max-width: 40px;
  }

  .np-toggle {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.4);
    color: #1DB954;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: background 0.2s ease;
  }

  .collapsed .np-toggle {
    position: relative;
    top: auto;
    right: auto;
    width: 40px;
    height: 40px;
    background: rgba(20, 20, 20, 0.9);
  }

  .np-toggle:hover {
    background: rgba(29, 185, 84, 0.15);
  }

  .np-content {
    display: flex;
    gap: 0.6rem;
    padding: 0.6rem;
    align-items: center;
  }

  .np-art {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    flex-shrink: 0;
    object-fit: cover;
  }

  .np-info {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding-right: 1.5rem;
  }

  .np-label {
    font-size: 0.6rem;
    color: #1DB954;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
  }

  .np-song {
    font-size: 0.8rem;
    font-weight: bold;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .np-artist {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .np-bar {
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    margin-top: 0.3rem;
    overflow: hidden;
  }

  .np-bar-fill {
    height: 100%;
    background: #1DB954;
    border-radius: 2px;
    transition: width 1s linear;
  }

  @media (max-width: 640px) {
    .now-playing {
      bottom: auto;
      top: 0;
      left: 0;
      right: 0;
      max-width: 100%;
      border-radius: 0;
      border: none;
      border-bottom: 1px solid rgba(29, 185, 84, 0.2);
    }

    .now-playing.collapsed {
      border-radius: 0;
      max-width: 100%;
    }

    .collapsed .np-toggle {
      width: 100%;
      height: 28px;
      border-radius: 0;
      background: rgba(20, 20, 20, 0.9);
    }

    .np-content {
      padding: 0.4rem 0.6rem;
    }

    .np-art {
      width: 32px;
      height: 32px;
      border-radius: 6px;
    }

    .np-toggle {
      top: 4px;
      right: 8px;
      width: 20px;
      height: 20px;
    }
  }
</style>
