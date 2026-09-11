/**
 * motivationalAudio.ts — Phase 24 Audio Library Architecture
 *
 * Organizes motivational audio tracks for the Free / Premium library.
 *
 * CRITICAL REQUIREMENTS:
 * - Preserve all existing working audio files.
 * - Do not create fake playable audio URLs.
 * - Locked premium entries exist as metadata only (src: '').
 * - Non-premium users see premium tracks as locked entries without playback.
 */

import type { Translations } from '../i18n/types';

export type AudioSlot = 'morning' | 'midday' | 'evening';

export interface AudioTrackMetadata {
  id: string;
  titleKey: keyof Translations;
  descKey: keyof Translations;
  slot: AudioSlot;
  src: string; // real base audio path or empty string for locked placeholders
  isPremium: boolean;
  durationLabel: string;
}

export const MOTIVATIONAL_AUDIO_TRACKS: AudioTrackMetadata[] = [
  // ── Morning Tracks (Free) ──
  {
    id: 'track-m1',
    titleKey: 'mot_audio_m1_title',
    descKey: 'mot_audio_m1_desc',
    slot: 'morning',
    src: '/audio/morning-1.mp3',
    isPremium: false,
    durationLabel: '2:30',
  },
  {
    id: 'track-m2',
    titleKey: 'mot_audio_m2_title',
    descKey: 'mot_audio_m2_desc',
    slot: 'morning',
    src: '/audio/morning-2.mp3',
    isPremium: false,
    durationLabel: '2:45',
  },
  {
    id: 'track-m3',
    titleKey: 'mot_audio_m3_title',
    descKey: 'mot_audio_m3_desc',
    slot: 'morning',
    src: '/audio/morning-3.mp3',
    isPremium: false,
    durationLabel: '2:15',
  },
  {
    id: 'track-m4',
    titleKey: 'mot_audio_m4_title',
    descKey: 'mot_audio_m4_desc',
    slot: 'morning',
    src: '/audio/morning-4.mp3',
    isPremium: false,
    durationLabel: '2:20',
  },

  // ── Midday Tracks (Free) ──
  {
    id: 'track-d1',
    titleKey: 'mot_audio_d1_title',
    descKey: 'mot_audio_d1_desc',
    slot: 'midday',
    src: '/audio/midday-1.mp3',
    isPremium: false,
    durationLabel: '2:40',
  },
  {
    id: 'track-d2',
    titleKey: 'mot_audio_d2_title',
    descKey: 'mot_audio_d2_desc',
    slot: 'midday',
    src: '/audio/midday-2.mp3',
    isPremium: false,
    durationLabel: '2:50',
  },
  {
    id: 'track-d3',
    titleKey: 'mot_audio_d3_title',
    descKey: 'mot_audio_d3_desc',
    slot: 'midday',
    src: '/audio/midday-3.mp3',
    isPremium: false,
    durationLabel: '2:35',
  },
  {
    id: 'track-d4',
    titleKey: 'mot_audio_d4_title',
    descKey: 'mot_audio_d4_desc',
    slot: 'midday',
    src: '/audio/midday-4.mp3',
    isPremium: false,
    durationLabel: '2:10',
  },

  // ── Evening Tracks (Free) ──
  {
    id: 'track-e1',
    titleKey: 'mot_audio_e1_title',
    descKey: 'mot_audio_e1_desc',
    slot: 'evening',
    src: '/audio/evening-1.mp3',
    isPremium: false,
    durationLabel: '2:30',
  },
  {
    id: 'track-e2',
    titleKey: 'mot_audio_e2_title',
    descKey: 'mot_audio_e2_desc',
    slot: 'evening',
    src: '/audio/evening-2.mp3',
    isPremium: false,
    durationLabel: '2:45',
  },
  {
    id: 'track-e3',
    titleKey: 'mot_audio_e3_title',
    descKey: 'mot_audio_e3_desc',
    slot: 'evening',
    src: '/audio/evening-3.mp3',
    isPremium: false,
    durationLabel: '2:35',
  },
  {
    id: 'track-e4',
    titleKey: 'mot_audio_e4_title',
    descKey: 'mot_audio_e4_desc',
    slot: 'evening',
    src: '/audio/evening-4.mp3',
    isPremium: false,
    durationLabel: '2:25',
  },

  // ── Premium Locked Audio Tracks (Metadata Only — No Fake URLs) ──
  {
    id: 'track-p1',
    titleKey: 'mot_audio_prem_1_title',
    descKey: 'mot_audio_prem_1_desc',
    slot: 'midday',
    src: '',
    isPremium: true,
    durationLabel: '10:00',
  },
  {
    id: 'track-p2',
    titleKey: 'mot_audio_prem_2_title',
    descKey: 'mot_audio_prem_2_desc',
    slot: 'morning',
    src: '',
    isPremium: true,
    durationLabel: '8:30',
  },
  {
    id: 'track-p3',
    titleKey: 'mot_audio_prem_3_title',
    descKey: 'mot_audio_prem_3_desc',
    slot: 'evening',
    src: '',
    isPremium: true,
    durationLabel: '12:00',
  },
];
