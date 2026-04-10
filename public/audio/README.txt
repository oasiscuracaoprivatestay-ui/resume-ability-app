Place your audio files here. The app has two audio systems:

═══════════════════════════════════════
  TIMER AUDIO (3 modes, random selection)
═══════════════════════════════════════

Motivational:
  motivation-1.mp3
  motivation-2.mp3
  motivation-3.mp3

Alternative:
  alternative-1.mp3
  alternative-2.mp3

Music:
  background-1.mp3
  background-2.mp3

A random file is selected each time a mode is chosen.
The same file will not repeat consecutively.
If a file is not present, the play controls will be disabled for that track.
The user's last selected mode is saved in localStorage.

═══════════════════════════════════════
  COACHING NARRATION (premium audio)
═══════════════════════════════════════

Place pre-generated narration files in /audio/coaching/:

  coaching/emotional.mp3
  coaching/trigger.mp3
  coaching/habit.mp3
  coaching/not_hungry.mp3
  coaching/loss_of_control.mp3

These are used on the "Learn about this slip" screen.
If a file exists → it plays instead of browser text-to-speech.
If a file is missing → the app falls back to browser TTS automatically.

To generate these files, use ElevenLabs or similar TTS service
with the coaching text from LearnScreen.tsx.
