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
  home_motivation: string;
  global_start_timer: string;
  home_exit: string;
  home_feedback: string;
  home_quiz_link: string;
  // ── Quiz ──
  quiz_start_label: string;
  quiz_start_heading: string;
  quiz_start_body: string;
  quiz_start_btn: string;
  quiz_q_label: string;
  quiz_next: string;
  quiz_result_label: string;
  quiz_result_heading: string;
  quiz_score_label: string;
  quiz_result_strong: string;
  quiz_result_moderate: string;
  quiz_result_needs: string;
  quiz_result_strong_body: string;
  quiz_result_moderate_body: string;
  quiz_result_needs_body: string;
  quiz_result_cta: string;
  quiz_result_retake: string;
  quiz_questions: Array<{ q: string; options: string[] }>;
  // ── Daily Check-In ──
  ci_entry_label: string;
  ci_entry_sub: string;
  ci_label: string;
  ci_title: string;
  ci_supporting: string;
  ci_hold_label: string;
  ci_holding_label: string;
  ci_status_label: string;
  ci_status_sub: string;
  ci_on_structure: string;
  ci_on_structure_body: string;
  ci_near_slip: string;
  ci_near_slip_body: string;
  ci_slip: string;
  ci_slip_body: string;
  ci_confirm_btn: string;
  ci_done_heading: string;
  ci_done_on_structure: string;
  ci_done_near_slip: string;
  ci_done_slip: string;
  // ── Phase 3: post-check-in support ──
  ci_done_near_slip_desc: string;
  ci_near_support_heading: string;
  ci_action_motivation: string;
  ci_action_timer: string;
  ci_action_why: string;
  ci_action_ability: string;
  ci_back_home: string;
  ci_why_heading: string;
  ci_why_body: string;
  ci_why_cta: string;
  ci_resumeability_heading: string;
  ci_ability_body: string;
  ci_ability_cta: string;
  ci_slip_recovery_body: string;
  ci_slip_recovery_cta: string;
  // ── Celebration + wins ──
  ci_win_heading: string;          // shown on celebration overlay
  ci_checkin_wins_label: string;   // "Check-In Wins" label
  ci_near_slip_win: string;        // subtle win confirmation for near-slip
  // ── Dashboard — Check-In KPI ──
  kpi_section_label: string;
  kpi_section_heading: string;
  kpi_section_sub: string;
  kpi_today_heading: string;
  kpi_7day_heading: string;
  kpi_no_checkins_today: string;
  kpi_status_on_structure: string;
  kpi_status_near_slip: string;
  kpi_status_slip: string;
  kpi_insight_none: string;
  kpi_insight_on_structure: string;
  kpi_insight_near_slip: string;
  kpi_insight_slip: string;
  kpi_insight_mixed: string;
  kpi_total_checkins: string;      // "Total Check-Ins" label for the wins card
  kpi_nn_reviews_label: string;    // compact "NN Reviews" label for dashboard

  // ── Pledge / Commitment (hold step) ──
  pledge_banner: string;           // "I commit to my structured diet!"
  pledge_why_question: string;     // "Why Am I Doing This?"
  pledge_why_title: string;        // "Why I'm Doing This"
  pledge_why_empty: string;        // "Add your reason →"
  pledge_why_manage: string;       // "Manage"
  pledge_nn_title: string;         // "Non-Negotiables"
  pledge_nn_empty: string;         // "Set your non-negotiables →"
  pledge_nn_review_btn: string;    // "Review My Non-Negotiables"
  pledge_review_heading: string;   // "My Non-Negotiables" (review screen title)
  pledge_review_done: string;      // "Done — I've Reviewed These"
  pledge_review_win: string;       // "Awareness is a win."
  pledge_review_empty: string;     // "No non-negotiables set yet."

  // ── Commitment Screen (editing) ──
  commit_label: string;            // screen section label
  commit_heading: string;          // "My Commitment"
  commit_why_section: string;      // "Why I'm Doing This" heading
  commit_why_placeholder: string;  // input placeholder
  commit_why_add: string;          // "+ Add a reason"
  commit_nn_section: string;       // "My Non-Negotiables" heading
  commit_nn_placeholder: string;   // input placeholder
  commit_nn_add: string;           // "+ Add a non-negotiable"
  commit_nn_limit: string;         // "You can set up to 7 non-negotiables."
  commit_nn_limit_reached: string; // "7 of 7 — limit reached"
  commit_edit: string;             // "Edit"
  commit_delete: string;           // "Delete"
  commit_save: string;             // "Save"
  commit_cancel: string;           // "Cancel"

  home_timer_learn_link: string;
  // ── Timer Learn ──
  tl_label: string;
  tl_heading: string;
  tl_a_title: string;
  tl_a_body: string;
  tl_b_title: string;
  tl_b_body: string;
  tl_c_title: string;
  tl_c_body: string;
  tl_d_title: string;
  tl_d_body: string;
  tl_back: string;

  // ── Context ──
  ctx_learn_link: string;
  ctx_label: string;
  ctx_question: string;
  ctx_question_accent: string;
  ctx_late_night: string;
  ctx_stress: string;
  ctx_social: string;
  ctx_boredom: string;
  ctx_habit: string;
  ctx_after_meal: string;
  ctx_people_social: string;
  ctx_environment: string;
  ctx_temptation: string;
  ctx_celebration: string;
  ctx_hunger: string;
  ctx_time_of_day: string;
  ctx_delay: string;
  ctx_all_or_nothing: string;

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
  timer_pause: string;
  timer_resume: string;
  timer_reset: string;
  timer_add15: string;
  // Section headers
  timer_section_label: string;
  audio_section_label: string;
  // Audio button labels
  audio_btn_play: string;
  audio_btn_pause: string;
  audio_btn_next: string;

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
  daily_next: string;
  daily_random: string;
  daily_error: string;

  // ── Premium ──
  prem_title: string;
  prem_subtitle: string;
  prem_feat_audio: string;
  prem_feat_audio_desc: string;
  prem_feat_sessions: string;
  prem_feat_sessions_desc: string;
  prem_feat_daily: string;
  prem_feat_daily_desc: string;
  prem_feat_ai: string;
  prem_feat_ai_desc: string;
  prem_feat_book: string;
  prem_feat_book_desc: string;
  prem_value: string;
  prem_upgrade: string;
  prem_free: string;
  prem_coming_soon: string;
  prem_redirect: string;
  prog_btn_label: string;

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

  // ── Structured Diet Builder (Phase 6B) ──
  sdb_label: string;
  sdb_heading: string;
  sdb_sub: string;
  sdb_default_plan_name: string;
  sdb_plan_name_label: string;
  sdb_rename_plan: string;
  sdb_add_block: string;
  sdb_edit_block: string;
  sdb_editor_title: string;
  sdb_start_time: string;
  sdb_end_time: string;
  sdb_block_type: string;
  sdb_food_label: string;
  sdb_custom_label: string;
  sdb_custom_placeholder: string;
  sdb_optional: string;
  sdb_overnight: string;
  sdb_next_day: string;
  sdb_empty_title: string;
  sdb_empty_sub: string;
  sdb_err_start_required: string;
  sdb_err_end_required: string;
  sdb_err_type_required: string;
  // ── Commitment screen entry ──
  sdb_commit_hint: string;
  sdb_open_builder: string;
  // ── Block types ──
  sdb_type_breakfast: string;
  sdb_type_lunch: string;
  sdb_type_dinner: string;
  sdb_type_snack: string;
  sdb_type_beverages: string;
  sdb_type_protein_shake: string;
  sdb_type_micro_fasting: string;
  sdb_type_kitchen_closed: string;
  sdb_type_custom: string;
  // ── Food / structure options ──
  sdb_food_unsweetened_beverages: string;
  sdb_food_black_coffee: string;
  sdb_food_tea: string;
  sdb_food_herbal_drink: string;
  sdb_food_protein_shake: string;
  sdb_food_protein_rich_food: string;
  sdb_food_vegetables: string;
  sdb_food_minimal_carbs: string;
  sdb_food_micro_fasting: string;
  sdb_food_kitchen_closed: string;

  // ── Slip Type Selection (Phase 7B) ──
  slip_type_title: string;
  slip_type_subtitle: string;
  slip_type_slippery_zone: string;
  slip_type_slippery_zone_desc: string;
  slip_type_non_negotiable: string;
  slip_type_non_negotiable_desc: string;

  // ── Non-Negotiable Slip (Phase 7B) ──
  slip_nn_label: string;
  slip_nn_question: string;
  slip_nn_question_accent: string;
  slip_nn_empty_title: string;
  slip_nn_empty_desc: string;
  slip_nn_empty_cta: string;

  // ── History Screen (Phase 7B) ──
  hist_slip_type_nn: string;
  hist_slip_type_sz: string;

  // ── Slip Insights & Trends (Phase 7C) ──
  insights_label: string;
  insights_title: string;
  insights_subtitle: string;
  insights_card_specific_title: string;
  insights_card_overall_title: string;
  insights_today_label: string;
  insights_trend_label: string;
  insights_trend_up: string;
  insights_trend_down: string;
  insights_trend_stable: string;
  insights_trend_insufficient: string;
  insights_btn_continue: string;

  // ── Re-Commit (Phase 7D) ──
  help_recommit_title: string;
  help_recommit_desc: string;
  recommit_label: string;
  recommit_title: string;
  recommit_subtitle: string;
  recommit_hold_instruction: string;
  recommit_success_heading: string;
  recommit_success_body: string;
  recommit_btn_main_menu: string;

  // ── "I Am in Control" Win + Commit (Phase 7E) ──
  control_badge: string;
  control_win_title: string;
  control_win_subtitle: string;
  control_btn_commit: string;
  control_btn_home: string;
  commit_badge: string;
  commit_title: string;
  commit_subtitle: string;
  commit_why_label: string;
  commit_why_empty: string;
  commit_why_link: string;
  commit_hold_instruction: string;
  commit_success_heading: string;
  commit_success_body: string;
  commit_btn_main_menu: string;

  // ── Daily Resume-Ability Score (Phase 8) ──
  dash_resume_ability_score_label: string;
  score_feedback_high_recovery: string;
  score_feedback_strong_structure: string;
  score_feedback_slips_no_recommit: string;
  score_feedback_low_engagement: string;
  score_feedback_no_activity: string;
}
