/**
 * Premium Gym Chime Synthesizer using Web Audio API and Short HTML5 Audio
 * Operates offline (PWA-compliant) and avoids heavy external audio assets.
 * Uses dual-tone high-fidelity electronic bell synthesis.
 * Does NOT interrupt background music (Spotify/Apple Music) during rest timer countdown.
 * When the rest timer ends, plays a short 0.65s chime that ducks Spotify and resumes playback.
 */

class GymChimePlayer {
  private audioCtx: AudioContext | null = null;
  private isUnlocked = false;
  private shortChimeBlobUrl: string | null = null;
  private htmlSilenceAudio: HTMLAudioElement | null = null;
  private silenceBlobUrl: string | null = null;

  /**
   * Initializes the AudioContext in response to a user gesture.
   */
  public init() {
    if (this.audioCtx) return;
    
    try {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    } catch {
      console.error("Web Audio API not supported");
    }
  }

  /**
   * Generates a 2-second silent WAV blob to keep iOS audio session alive in background mode.
   */
  private getSilenceBlobUrl(): string {
    if (this.silenceBlobUrl) return this.silenceBlobUrl;
    const sampleRate = 8000;
    const numSamples = sampleRate * 2;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeString = (v: DataView, o: number, s: string) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);
    const blob = new Blob([buffer], { type: 'audio/wav' });
    this.silenceBlobUrl = URL.createObjectURL(blob);
    return this.silenceBlobUrl;
  }

  /**
   * Unlocks the AudioContext by resuming it on user interaction.
   */
  public unlock() {
    if (this.isUnlocked) return;
    
    this.init();
    
    if (this.audioCtx) {
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      
      this.isUnlocked = true;
      console.log("AudioContext successfully unlocked");
    }
  }

  /**
   * Generates a short 0.65-second WAV file containing only the dual-tone bell chime.
   */
  private getShortChimeBlobUrl(): string {
    if (this.shortChimeBlobUrl) return this.shortChimeBlobUrl;

    const sampleRate = 11025;
    const chimeDuration = 0.65;
    const numSamples = Math.floor(chimeDuration * sampleRate);
    
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    
    const writeString = (view: DataView, offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    /* Write WAV Header */
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);
    
    const freq1 = 880;
    const dur1 = 0.35;
    const attack1 = 0.02;
    const k1 = 8.294 / (dur1 - attack1);
    
    const freq2 = 1109.73;
    const dur2 = 0.45;
    const attack2 = 0.02;
    const k2 = 8.294 / (dur2 - attack2);
    
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      let sample = 0;
      const t = i / sampleRate;
      
      // Tone 1 (A5)
      if (t >= 0 && t < dur1) {
        let amp = 0;
        if (t < attack1) {
          amp = 0.4 * (t / attack1);
        } else {
          amp = 0.4 * Math.exp(-k1 * (t - attack1));
        }
        sample += amp * (Math.sin(2 * Math.PI * freq1 * t) + 0.05 * Math.sin(2 * Math.PI * freq1 * 2.5 * t));
      }
      
      // Tone 2 (C#6)
      const t2 = t - 0.15;
      if (t2 >= 0 && t2 < dur2) {
        let amp = 0;
        if (t2 < attack2) {
          amp = 0.4 * (t2 / attack2);
        } else {
          amp = 0.4 * Math.exp(-k2 * (t2 - attack2));
        }
        sample += amp * (Math.sin(2 * Math.PI * freq2 * t2) + 0.05 * Math.sin(2 * Math.PI * freq2 * 2.5 * t2));
      }
      
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
    
    const blob = new Blob([buffer], { type: 'audio/wav' });
    this.shortChimeBlobUrl = URL.createObjectURL(blob);
    return this.shortChimeBlobUrl;
  }

  /**
   * Starts playing a background silence loop IF keep_alive_in_background is enabled.
   * If disabled (Spotify mode), does NOT play audio so Spotify plays 100% uninterrupted.
   * If enabled (Background mode), keeps the iOS audio session open so the chime fires on time even with screen locked.
   */
  public startSilence(durationSeconds?: number) {
    const isKeepAlive = typeof window !== "undefined" && localStorage.getItem("keep_alive_in_background") === "true";
    if (!isKeepAlive) {
      if (durationSeconds) {
        console.log(`Rest timer started (${durationSeconds}s) [Spotify Mode]. Spotify plays uninterrupted.`);
      }
      return;
    }

    this.init();

    // 1. Play looping HTML5 silent audio to hold iOS audio session
    try {
      if (!this.htmlSilenceAudio) {
        this.htmlSilenceAudio = new Audio(this.getSilenceBlobUrl());
        this.htmlSilenceAudio.loop = true;
      }
      this.htmlSilenceAudio.play().catch((e) => {
        console.warn("Background silence audio play skipped:", e);
      });
    } catch (e) {
      console.warn("Failed to play background silence:", e);
    }

    // 2. Pre-schedule the chime on AudioContext timeline for background execution
    if (this.audioCtx && durationSeconds && durationSeconds > 0) {
      try {
        if (this.audioCtx.state === "suspended") {
          this.audioCtx.resume();
        }
        const now = this.audioCtx.currentTime;
        this.synthesizeBellTone(880, now + durationSeconds, 0.35);
        this.synthesizeBellTone(1109.73, now + durationSeconds + 0.15, 0.45);
      } catch (e) {
        console.warn("Failed to pre-schedule chime on AudioContext:", e);
      }
    }
  }

  /**
   * Stops the background silence loop.
   */
  public stopSilence() {
    try {
      if (this.htmlSilenceAudio) {
        this.htmlSilenceAudio.pause();
        this.htmlSilenceAudio.currentTime = 0;
      }
    } catch {
      // ignore
    }
  }

  /**
   * Plays the 0.65-second gym chime.
   * Plays via Web Audio API and short HTML5 Audio.
   * Spotify will briefly duck/pause for 0.65s and then automatically resume music.
   */
  public play() {
    this.init();
    
    // 1. Web Audio API Synthesis
    if (this.audioCtx) {
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      const now = this.audioCtx.currentTime;
      this.synthesizeBellTone(880, now, 0.35);
      this.synthesizeBellTone(1109.73, now + 0.15, 0.45);
    }

    // 2. Short HTML5 Audio Playback (for iOS mobile audio ducking & speaker output)
    try {
      const url = this.getShortChimeBlobUrl();
      const audio = new Audio(url);
      audio.volume = 1.0;
      audio.play().catch((e) => {
        console.warn("HTML5 short chime playback skipped:", e);
      });
    } catch (e) {
      console.warn("Failed to trigger short HTML5 chime:", e);
    }
  }

  /**
   * Creates FM-like synthesis of an electronic bell.
   */
  private synthesizeBellTone(freq: number, startTime: number, duration: number) {
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);

    const overtone = this.audioCtx.createOscillator();
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(freq * 2.5, startTime);

    const gainNode = this.audioCtx.createGain();
    const overtoneGain = this.audioCtx.createGain();
    overtoneGain.gain.setValueAtTime(0.05, startTime);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + (duration * 0.4));

    overtone.connect(overtoneGain);
    overtoneGain.connect(gainNode);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);
    
    overtone.start(startTime);
    overtone.stop(startTime + duration);
  }
}

export const gymChime = new GymChimePlayer();
