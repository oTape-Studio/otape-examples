/**
 * Where the sound goes. The deck only needs this small interface, so tests
 * can use a fake, and an app can route audio elsewhere (Web Audio effects,
 * a native bridge).
 */
export interface PlaybackOutput {
  /** Whether this output can decode a media type such as `audio/mp4`. */
  canPlay(mediaType: string): boolean;
  /** Prepare the audio of a side, replacing the previous one. `null` for a blank side. */
  load(audio: Blob | null): void;
  /** Start playing at a position. Resolves once sound is actually running. */
  play(fromSeconds: number): Promise<void>;
  pause(): void;
  /** 0 … 1. */
  volume: number;
  /** Release everything. The output is unusable afterwards. */
  dispose(): void;
}

/**
 * Plays through an `<audio>` element. The browser streams the Blob from
 * disk, so even a 90-minute side costs almost no memory, and AAC encoder
 * delay is handled by the browser's MP4 demuxer (§7.3).
 */
export class AudioElementOutput implements PlaybackOutput {
  readonly #audio: HTMLAudioElement;
  #url: string | null = null;

  constructor(audio: HTMLAudioElement = new Audio()) {
    this.#audio = audio;
    this.#audio.preload = 'auto';
  }

  canPlay(mediaType: string): boolean {
    return this.#audio.canPlayType(mediaType) !== '';
  }

  load(audio: Blob | null): void {
    this.pause();
    this.#revoke();
    if (audio) {
      this.#url = URL.createObjectURL(audio);
      this.#audio.src = this.#url;
    } else {
      this.#audio.removeAttribute('src');
    }
    this.#audio.load();
  }

  async play(fromSeconds: number): Promise<void> {
    await this.#metadataLoaded();
    this.#audio.currentTime = fromSeconds;
    await this.#audio.play();
  }

  pause(): void {
    this.#audio.pause();
  }

  get volume(): number {
    return this.#audio.volume;
  }

  set volume(value: number) {
    this.#audio.volume = Math.min(1, Math.max(0, value));
  }

  dispose(): void {
    this.load(null);
  }

  /** Seeking needs the duration, which is known once metadata has loaded. */
  #metadataLoaded(): Promise<void> {
    const audio = this.#audio;
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const options = { signal: controller.signal, once: true };
      audio.addEventListener(
        'loadedmetadata',
        () => {
          controller.abort();
          resolve();
        },
        options,
      );
      audio.addEventListener(
        'error',
        () => {
          controller.abort();
          reject(new Error('The audio could not be loaded', { cause: audio.error }));
        },
        options,
      );
    });
  }

  #revoke(): void {
    if (this.#url) URL.revokeObjectURL(this.#url);
    this.#url = null;
  }
}
