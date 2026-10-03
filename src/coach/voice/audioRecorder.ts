/**
 * SDA AI Coach — Browser Audio Capture & MediaRecorder (Phase 38B)
 *
 * Captures microphone audio using standard browser MediaStream & MediaRecorder.
 *
 * Privacy & Security Guarantees:
 * 1. Microphone access activates ONLY after explicit user tap.
 * 2. All audio tracks are stopped and released immediately upon stop() or cancel().
 * 3. Chunks are held in volatile memory only and never written to storage.
 * 4. Zero persistent audio files or blobs in localStorage or database.
 */

export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private activeMimeType = 'audio/webm';
  private recording = false;

  isRecording(): boolean {
    return this.recording;
  }

  getActiveMimeType(): string {
    return this.activeMimeType;
  }

  /**
   * Detects the best audio MIME type supported by this browser.
   */
  private selectSupportedMimeType(): string {
    if (typeof MediaRecorder === 'undefined') {
      return 'audio/webm';
    }

    const preferred = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
    ];

    for (const mime of preferred) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }

    return '';
  }

  /**
   * Explicitly starts microphone capture upon user click.
   */
  async start(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone recording is not supported on this browser.');
    }

    // Ensure previous recording is cleared
    await this.cancel();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.activeMimeType = this.selectSupportedMimeType();
      this.recordedChunks = [];

      const options: MediaRecorderOptions = {};
      if (this.activeMimeType) {
        options.mimeType = this.activeMimeType;
      }

      this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.recording = true;
      this.mediaRecorder.start(250); // collect 250ms chunks
    } catch (err: any) {
      this.releaseTracks();
      this.recording = false;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission was denied. Please allow microphone access to use voice.');
      }
      throw new Error(err.message || 'Failed to start microphone recording.');
    }
  }

  /**
   * Stops recording, releases microphone tracks immediately, and returns audio Blob.
   */
  async stop(): Promise<{ blob: Blob; mimeType: string } | null> {
    if (!this.recording || !this.mediaRecorder) {
      this.releaseTracks();
      return null;
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        this.recording = false;
        this.releaseTracks();

        if (this.recordedChunks.length === 0) {
          resolve(null);
          return;
        }

        const combinedBlob = new Blob(this.recordedChunks, {
          type: this.activeMimeType || 'audio/webm',
        });
        this.recordedChunks = [];
        resolve({ blob: combinedBlob, mimeType: this.activeMimeType || 'audio/webm' });
      };

      try {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        } else {
          this.recording = false;
          this.releaseTracks();
          resolve(null);
        }
      } catch {
        this.recording = false;
        this.releaseTracks();
        resolve(null);
      }
    });
  }

  /**
   * Cancels active recording without returning audio and releases all hardware tracks.
   */
  async cancel(): Promise<void> {
    this.recording = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore
      }
    }
    this.releaseTracks();
    this.recordedChunks = [];
  }

  /**
   * Immediately stops hardware microphone tracks so user indicator turns off.
   */
  private releaseTracks(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
  }
}
