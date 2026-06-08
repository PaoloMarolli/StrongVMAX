/**
 * Premium Gym Chime Synthesizer using Web Audio API
 * Operates offline (PWA-compliant) and avoids heavy external audio assets.
 * Uses dual-tone high-fidelity electronic bell synthesis.
 * Incorporates a silent carrier wave technique to keep background JS execution
 * alive on mobile devices (iOS/Android), preventing timer throttling.
 */

class GymChimePlayer {
  private audioCtx: AudioContext | null = null;
  private isUnlocked = false;
  private silenceOsc: OscillatorNode | null = null;
  private silenceGain: GainNode | null = null;
  private htmlSilenceAudio: HTMLAudioElement | null = null;

  private getHtmlSilenceAudio(): HTMLAudioElement {
    if (!this.htmlSilenceAudio) {
      // 1-second completely silent WAV file as a Base64 Data URI
      const silenceUrl = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      this.htmlSilenceAudio = new Audio(silenceUrl);
      this.htmlSilenceAudio.loop = true;
    }
    return this.htmlSilenceAudio;
  }

  /**
   * Initializes the AudioContext in response to a user gesture.
   * This is required by mobile browsers (Safari/Chrome) to allow audio playback.
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
   * Unlocks the AudioContext by running a brief silent tone.
   * Call this on initial app interaction (e.g. click, touch) to enable background play.
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
   * Starts playing an inaudible sub-bass frequency carrier wave and looping HTML5 silent audio.
   * This signals the mobile OS that active media is playing, keeping the browser
   * tab's JS execution alive in background so the rest timer ticks on time.
   * If durationSeconds is provided, schedules the dual-tone chime in advance
   * on the AudioContext timeline, ensuring it plays perfectly even in background.
   */
  public startSilence(durationSeconds?: number) {
    // Check if background keep alive is enabled by user
    const keepAlive = typeof window !== "undefined" && localStorage.getItem("keep_alive_in_background") === "true";
    if (!keepAlive) {
      console.log("Background keepAlive is disabled, skipping silent carrier wave.");
      return;
    }

    this.init();
    
    // Play HTML5 silent audio to bypass iOS Safari background restrictions
    try {
      const audio = this.getHtmlSilenceAudio();
      audio.currentTime = 0;
      audio.play().then(() => {
        console.log("Looped HTML silence audio playback started");
      }).catch(e => {
        console.warn("Looped HTML silence audio blocked or failed to play:", e);
      });
    } catch (e) {
      console.warn("Failed to play HTML silence audio:", e);
    }
    
    if (!this.audioCtx) return;

    // If already active, cancel any scheduled values to avoid overlaps
    if (this.silenceOsc && this.silenceGain) {
      const now = this.audioCtx.currentTime;
      try {
        this.silenceGain.gain.cancelScheduledValues(now);
        this.silenceOsc.frequency.cancelScheduledValues(now);
        // Reset to inaudible carrier wave
        this.silenceOsc.frequency.setValueAtTime(1, now);
        this.silenceGain.gain.setValueAtTime(0.0001, now);
      } catch (e) {
        console.error("Error cancelling scheduled silence values", e);
      }
    }

    try {
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      if (!this.silenceOsc) {
        this.silenceOsc = this.audioCtx.createOscillator();
        this.silenceGain = this.audioCtx.createGain();

        // Constant inaudible 1Hz wave (completely silent but occupies the audio channel)
        this.silenceOsc.type = "sine";
        this.silenceOsc.frequency.setValueAtTime(1, this.audioCtx.currentTime);
        
        // Extremely low gain to guarantee no speaker noise
        this.silenceGain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);

        this.silenceOsc.connect(this.silenceGain);
        this.silenceGain.connect(this.audioCtx.destination);

        this.silenceOsc.start();
        console.log("Background audio keeper started successfully");
      }

      // Schedule the chime on the silence carrier timeline if a duration is specified!
      if (durationSeconds !== undefined && durationSeconds > 0 && this.silenceOsc && this.silenceGain) {
        const now = this.audioCtx.currentTime;
        const startTime = now + durationSeconds;
        
        console.log(`Scheduling background chime in ${durationSeconds}s (at currentTime + ${durationSeconds})`);

        // Cancel any future values on oscillator and gain just in case
        this.silenceGain.gain.cancelScheduledValues(now);
        this.silenceOsc.frequency.cancelScheduledValues(now);

        // Keep it silent until startTime
        this.silenceOsc.frequency.setValueAtTime(1, now);
        this.silenceGain.gain.setValueAtTime(0.0001, now);

        // Tone 1: A5 (880 Hz)
        this.silenceOsc.frequency.setValueAtTime(880, startTime);
        this.silenceGain.gain.setValueAtTime(0.4, startTime);
        this.silenceGain.gain.exponentialRampToValueAtTime(0.1, startTime + 0.15);

        // Tone 2: C#6 (1109.73 Hz)
        this.silenceOsc.frequency.setValueAtTime(1109.73, startTime + 0.15);
        this.silenceGain.gain.setValueAtTime(0.4, startTime + 0.15);
        this.silenceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.60);

        // Return to silence after the chime has finished
        this.silenceOsc.frequency.setValueAtTime(1, startTime + 0.60);
        this.silenceGain.gain.setValueAtTime(0.0001, startTime + 0.60);
      }
    } catch (e) {
      console.error("Failed to start background silence carrier or schedule chime", e);
    }
  }

  /**
   * Stops the silent background carrier wave and pauses the looping HTML silent audio.
   * Call this when the rest timer finishes or is cancelled.
   */
  public stopSilence() {
    try {
      if (this.htmlSilenceAudio) {
        this.htmlSilenceAudio.pause();
        console.log("Looped HTML silence audio paused");
      }
    } catch (e) {
      console.warn("Failed to pause HTML silence audio:", e);
    }

    try {
      if (this.silenceOsc) {
        this.silenceOsc.stop();
        this.silenceOsc.disconnect();
        this.silenceOsc = null;
      }
      if (this.silenceGain) {
        this.silenceGain.disconnect();
        this.silenceGain = null;
      }
      console.log("Background audio keeper stopped");
    } catch {
      // ignore
    }
  }

  /**
   * Synthesizes and plays a premium high-fidelity dual-tone Gym Chime.
   * Sequence: A5 (880Hz) chime followed by a higher C#6 (1109.73Hz) bell chime.
   */
  public play() {
    this.init();
    
    if (!this.audioCtx) {
      console.warn("AudioContext is unavailable, chime skipped.");
      return;
    }

    // Force resume if browser suspended it again
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;

    // Check if background silence carrier is active (PWA is in background)
    if (this.silenceOsc && this.silenceGain) {
      console.log("Playing background chime using active continuous carrier wave...");
      
      const osc = this.silenceOsc;
      const gainNode = this.silenceGain;

      // Clean up any scheduled values
      gainNode.gain.cancelScheduledValues(now);
      osc.frequency.cancelScheduledValues(now);

      // Tone 1: 880 Hz (A5)
      osc.frequency.setValueAtTime(880, now);
      gainNode.gain.setValueAtTime(0.4, now);
      gainNode.gain.exponentialRampToValueAtTime(0.1, now + 0.15);

      // Tone 2: 1109.73 Hz (C#6)
      osc.frequency.setValueAtTime(1109.73, now + 0.15);
      gainNode.gain.setValueAtTime(0.4, now + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      // Stop the silence carrier completely after the chime finishes (since rest is done)
      setTimeout(() => {
        this.stopSilence();
      }, 650);

    } else {
      // Normal foreground play with high-fidelity dual-tone synthesis
      // Tone 1: 880 Hz (A5), starts immediately, duration 0.35s
      this.synthesizeBellTone(880, now, 0.35);
      
      // Tone 2: 1109.73 Hz (C#6), starts after 0.15s, duration 0.45s
      this.synthesizeBellTone(1109.73, now + 0.15, 0.45);
    }
  }

  /**
   * Creates a beautiful FM-like synthesis of an electronic bell.
   */
  private synthesizeBellTone(freq: number, startTime: number, duration: number) {
    if (!this.audioCtx) return;

    // Primary oscillator (pure sine wave)
    const osc = this.audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);

    // Subtle overtone (sine wave at a higher octave + third) for bright bell Timbre
    const overtone = this.audioCtx.createOscillator();
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(freq * 2.5, startTime); // Harmonic overtone

    // Master Gain for envelope
    const gainNode = this.audioCtx.createGain();
    
    // Overtone Gain (quieter to blend nicely)
    const overtoneGain = this.audioCtx.createGain();
    overtoneGain.gain.setValueAtTime(0.05, startTime);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + (duration * 0.4)); // fades quicker

    // Connect nodes
    overtone.connect(overtoneGain);
    overtoneGain.connect(gainNode);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    // Bell Volume Envelope: Quick Attack -> Exponential Decay
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.02); // rapid rise
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration); // smooth decay

    // Start oscillators
    osc.start(startTime);
    osc.stop(startTime + duration);
    
    overtone.start(startTime);
    overtone.stop(startTime + duration);
  }
}

export const gymChime = new GymChimePlayer();
