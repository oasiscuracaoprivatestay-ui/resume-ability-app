export type Language = 'en' | 'es' | 'nl';

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'EN',
  es: 'ES',
  nl: 'NL',
};

export interface Translations {
  // ── Home ──
  home_brand_title: string;
  home_brand: string;
  home_question: string;
  home_question_accent: string;
  home_subtitle: string;
  home_slipped: string;
  home_in_control: string;
  home_dashboard: string;
  home_history: string;
  home_daily_audio: string;

  // ── Context ──
  ctx_label: string;
  ctx_question: string;
  ctx_question_accent: string;
  ctx_late_night: string;
  ctx_stress: string;
  ctx_social: string;
  ctx_boredom: string;
  ctx_habit: string;
  ctx_after_meal: string;

  // ── Help Options ──
  help_label: string;
  help_question: string;
  help_question_accent: string;
  help_timer_title: string;
  help_timer_desc: string;
  help_learn_title: string;
  help_learn_desc: string;
  help_ai_title: string;
  help_ai_desc: string;
  help_ai_badge: string;

  // ── Mode ──
  mode_label: string;
  mode_question: string;
  mode_question_accent: string;
  mode_single_title: string;
  mode_single_desc: string;
  mode_single_badge: string;
  mode_loop_title: string;
  mode_loop_desc: string;
  mode_loop_badge: string;
  mode_extended_title: string;
  mode_extended_desc: string;
  mode_extended_badge: string;
  mode_back_to_modes: string;
  mode_custom: string;
  mode_choose_blocks: string;
  mode_loop_blocks: string;
  mode_start: string;
  mode_back_to_presets: string;

  // ── Timer ──
  timer_message: string;
  timer_all_blocks: string;
  timer_recovered: string;
  timer_extend: string;
  timer_relapsed: string;
  timer_block_of: string; // "Block {x} of {y}" — use {x} {y} placeholders
  timer_block_started: string; // "Block {x} started"
  timer_motivational: string;
  timer_alternative: string;
  timer_music: string;
  timer_audio_error: string;

  // ── Result ──
  result_recovered_in: string;
  result_control_restored: string;
  result_slip_recorded: string;
  result_duration: string;
  result_note_relapsed: string;
  result_note_fast: string;
  result_note_solid: string;
  result_note_default: string;
  result_continue: string;

  // ── Control ──
  control_continue: string;
  control_messages: string[];

  // ── Learn ──
  learn_label: string;
  learn_listen: string;
  learn_stop: string;
  learn_start_timer: string;
  learn_back: string;

  // ── Dashboard ──
  dash_label: string;
  dash_heading: string;
  dash_slips_today: string;
  dash_most_frequent: string;
  dash_avg_recovery: string;
  dash_empty: string;

  // ── History ──
  hist_label: string;
  hist_heading: string;
  hist_empty: string;
  hist_avg_recovery: string;
  hist_slips: string;
  hist_range_today: string;
  hist_range_7d: string;
  hist_range_30d: string;
  hist_range_all: string;
  hist_tab_summary: string;
  hist_tab_log: string;
  hist_log_duration: string;
  hist_log_mode: string;
  hist_log_status: string;
  hist_status_recovered: string;
  hist_status_extended: string;
  hist_status_relapsed: string;
  hist_clear: string;
  hist_clear_confirm: string;
  hist_clear_yes: string;
  hist_clear_no: string;
  hist_refresh: string;
  hist_total_slips: string;
  hist_most_common: string;

  // ── Daily Audio ──
  daily_label: string;
  daily_heading: string;
  daily_morning: string;
  daily_morning_desc: string;
  daily_midday: string;
  daily_midday_desc: string;
  daily_evening: string;
  daily_evening_desc: string;
  daily_play: string;
  daily_pause: string;
  daily_error: string;

  // ── Loop presets ──
  loop_2_label: string;
  loop_2_detail: string;
  loop_4_label: string;
  loop_4_detail: string;
  loop_6_label: string;
  loop_6_detail: string;
  loop_day_label: string;
  loop_day_detail: string;
  loop_2days_label: string;
  loop_2days_detail: string;
}
