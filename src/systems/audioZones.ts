import { AUDIO_ZONES, CROSSFADE_SECONDS, type AudioZoneId } from "../config/audio";

interface ZoneChannel {
  gain: GainNode;
  source: AudioBufferSourceNode;
}

/**
 * Zone-based crossfading background audio. One looping buffer per land,
 * faded via GainNodes over CROSSFADE_SECONDS. Buffers load lazily on first
 * entry. The AudioContext unlocks from the "click to enter" gesture; until
 * then requests queue as the pending zone.
 */
export class AudioZoneSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly channels = new Map<AudioZoneId, ZoneChannel>();
  private readonly loading = new Set<AudioZoneId>();
  private active: AudioZoneId | null = null;
  private pending: AudioZoneId | null = null;

  private volumeValue = 0.7;
  private mutedValue = false;

  get volume(): number {
    return this.volumeValue;
  }

  get muted(): boolean {
    return this.mutedValue;
  }

  /** Call from the user gesture (click-to-enter) to satisfy autoplay policy. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.mutedValue ? 0 : this.volumeValue;
    this.master.connect(this.ctx.destination);
    if (this.pending) {
      const zone = this.pending;
      this.pending = null;
      this.setZone(zone);
    }
  }

  setZone(zone: AudioZoneId | null): void {
    if (!this.ctx || !this.master) {
      this.pending = zone;
      return;
    }
    if (zone === this.active) return;

    const now = this.ctx.currentTime;
    if (this.active) {
      const from = this.channels.get(this.active);
      if (from) {
        from.gain.gain.cancelScheduledValues(now);
        from.gain.gain.setValueAtTime(from.gain.gain.value, now);
        from.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS);
      }
    }
    this.active = zone;
    if (zone) void this.fadeIn(zone);
  }

  setVolume(volume: number): void {
    this.volumeValue = Math.max(0, Math.min(1, volume));
    this.applyMaster();
  }

  setMuted(muted: boolean): void {
    this.mutedValue = muted;
    this.applyMaster();
  }

  private applyMaster(): void {
    if (!this.ctx || !this.master) return;
    const target = this.mutedValue ? 0 : this.volumeValue;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  private async fadeIn(zone: AudioZoneId): Promise<void> {
    if (!this.ctx || !this.master) return;
    let channel = this.channels.get(zone);
    if (!channel) {
      if (this.loading.has(zone)) return;
      this.loading.add(zone);
      try {
        // no-cache: revalidate with the server so swapped-in MP3s are picked
        // up without a hard reload (tracks load once per session anyway).
        const res = await fetch(AUDIO_ZONES[zone].file, { cache: "no-cache" });
        if (!res.ok) return;
        const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        gain.connect(this.master);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        source.start();
        channel = { gain, source };
        this.channels.set(zone, channel);
      } catch (err) {
        console.warn(`audio zone ${zone} failed to load`, err);
        return;
      } finally {
        this.loading.delete(zone);
      }
      // The player may have crossed into another land while we loaded.
      if (this.active !== zone) return;
    }
    const now = this.ctx.currentTime;
    channel.gain.gain.cancelScheduledValues(now);
    channel.gain.gain.setValueAtTime(channel.gain.gain.value, now);
    channel.gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
  }
}
