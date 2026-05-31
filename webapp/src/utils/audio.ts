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

  /**
   * Initializes the AudioContext in response to a user gesture.
   * This is required by mobile browsers (Safari/Chrome) to allow audio playback.
   */
  public init() {
    if (this.audioCtx) return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    } catch (e) {
      console.error("Web Audio API not supported:", e);
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
      
      // Play a micro-silent oscillator to unlock iOS Safari
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(0);
      osc.stop(0.01);
      
      this.isUnlocked = true;
      console.log("AudioContext successfully unlocked");
    }
  }

  /**
   * Starts playing an inaudible sub-bass frequency carrier wave.
   * This signals the mobile OS that active media is playing, keeping the browser
   * tab's JS execution alive in background so the rest timer ticks on time.
   */
  public startSilence() {
    this.init();
    if (!this.audioCtx || this.silenceOsc) return;

    try {
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

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
    } catch (e) {
      console.error("Failed to start background silence carrier:", e);
    }
  }

  /**
   * Stops the silent background carrier wave.
   * Call this when the rest timer finishes or is cancelled.
   */
  public stopSilence() {
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
    } catch (e) {
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

    // Play 2-tone melodic chime
    // Tone 1: 880 Hz (A5), starts immediately, duration 0.35s
    this.synthesizeBellTone(880, now, 0.35);
    
    // Tone 2: 1109.73 Hz (C#6), starts after 0.15s, duration 0.45s
    this.synthesizeBellTone(1109.73, now + 0.15, 0.45);
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
