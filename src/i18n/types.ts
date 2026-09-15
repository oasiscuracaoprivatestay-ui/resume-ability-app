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
  home_structured_diet: string;
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
  commit_btn_hold: string;
  commit_btn_holding: string;
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

  // ── Post Check-In Motivational Quote Screen (Phase 7F) ──
  quote_screen_label: string;
  quote_btn_home: string;
  motivational_quotes: string[];

  // ── I Need Motivation: Audio / Text Choice (Phase 7G) ──
  motivation_choice_label: string;
  motivation_choice_heading: string;
  motivation_choice_sub: string;
  motivation_btn_audio: string;
  motivation_btn_audio_desc: string;
  motivation_btn_text: string;
  motivation_btn_text_desc: string;
  motivational_text_label: string;
  motivational_text_btn_next: string;
  motivational_text_btn_back: string;
  motivational_text_btn_home: string;
  motivational_texts: { title: string; body: string }[];

  // ── Phase 24: Premium Motivation Library ──
  prem_badge: string;
  prem_free_badge: string;
  prem_info_title: string;
  prem_info_desc: string;
  prem_btn_explore: string;
  prem_coming_soon_title: string;
  prem_coming_soon_desc: string;
  prem_feature_audio: string;
  prem_feature_reading: string;
  prem_feature_library: string;
  mot_lib_tab_slots: string;
  mot_lib_tab_all: string;
  mot_reading_lib_title: string;
  mot_reading_btn_browse: string;
  mot_reading_btn_quick: string;
  mot_audio_m1_title: string;
  mot_audio_m1_desc: string;
  mot_audio_m2_title: string;
  mot_audio_m2_desc: string;
  mot_audio_m3_title: string;
  mot_audio_m3_desc: string;
  mot_audio_m4_title: string;
  mot_audio_m4_desc: string;
  mot_audio_d1_title: string;
  mot_audio_d1_desc: string;
  mot_audio_d2_title: string;
  mot_audio_d2_desc: string;
  mot_audio_d3_title: string;
  mot_audio_d3_desc: string;
  mot_audio_d4_title: string;
  mot_audio_d4_desc: string;
  mot_audio_e1_title: string;
  mot_audio_e1_desc: string;
  mot_audio_e2_title: string;
  mot_audio_e2_desc: string;
  mot_audio_e3_title: string;
  mot_audio_e3_desc: string;
  mot_audio_e4_title: string;
  mot_audio_e4_desc: string;
  mot_audio_prem_1_title: string;
  mot_audio_prem_1_desc: string;
  mot_audio_prem_2_title: string;
  mot_audio_prem_2_desc: string;
  mot_audio_prem_3_title: string;
  mot_audio_prem_3_desc: string;

  // ── Timer Audio Mode Toggle (Phase 7H & 18) ──
  timer_audio_toggle_label: string;
  timer_audio_with: string;
  timer_audio_without: string;
  timer_audio_disabled_desc: string;
  timer_audio_turn_on: string;
  timer_audio_turn_off: string;

  // ── SDA Terminology & Contextual Help (Phase 9) ──
  sda_terms_link: string;
  sda_terms_title: string;
  sda_terms_subtitle: string;
  sda_term_slip_title: string;
  sda_term_slip_def: string;
  sda_term_sz_title: string;
  sda_term_sz_def: string;
  sda_term_nn_title: string;
  sda_term_nn_def: string;
  sda_term_ra_title: string;
  sda_term_ra_def: string;
  sda_term_sd_title: string;
  sda_term_sd_def: string;
  sda_term_mf_title: string;
  sda_term_mf_def: string;
  sda_btn_close: string;
  sda_btn_home: string;
  sda_info_aria: string;

  // ── Structured Diet Weekly / Daily Planning (Phase 10) ──
  sdb_day_mon: string;
  sdb_day_tue: string;
  sdb_day_wed: string;
  sdb_day_thu: string;
  sdb_day_fri: string;
  sdb_day_sat: string;
  sdb_day_sun: string;
  sdb_day_mon_short: string;
  sdb_day_tue_short: string;
  sdb_day_wed_short: string;
  sdb_day_thu_short: string;
  sdb_day_fri_short: string;
  sdb_day_sat_short: string;
  sdb_day_sun_short: string;
  sdb_today: string;
  sdb_day_select_label: string;
  sdb_day_type: string;
  sdb_mode_structured: string;
  sdb_mode_unstructured: string;
  sdb_unstructured_title: string;
  sdb_unstructured_desc: string;
  sdb_unstructured_safe_hint: string;
  sdb_btn_copy_day: string;
  sdb_copy_modal_title: string;
  sdb_copy_modal_sub: string;
  sdb_copy_confirm_overwrite: string;
  sdb_copy_btn_submit: string;
  sdb_copy_success: string;
  sdb_select_all: string;

  // ── Structured Diet Daily Verification (Phase 11) ──
  sdb_v_today_plan: string;
  sdb_v_today_progress: string;
  sdb_v_not_reported: string;
  sdb_v_on_track: string;
  sdb_v_slip: string;
  sdb_v_slip_reported: string;
  sdb_v_what_happened: string;
  sdb_v_what_had: string;
  sdb_v_save_slip: string;
  sdb_v_clear_status: string;
  sdb_v_change_status: string;
  sdb_v_actual_label: string;
  sdb_v_earlier_verified: string;
  sdb_v_practice_ra: string;
  sdb_v_reported_summary: string;
  sdb_v_summary_breakdown: string;
  sdb_v_on_track_hint: string;
  sdb_v_slip_hint: string;
  sdb_note_ate_off_plan: string;
  sdb_note_late_night: string;
  sdb_note_social_meal: string;
  sdb_note_stress_eating: string;
  sdb_note_extra_portion: string;
  sdb_note_skipped_meal: string;
  sdb_today_unstructured_title: string;
  sdb_today_unstructured_desc: string;
  dash_diet_today_title: string;
  dash_breakdown_diet_on_track: string;
  dash_breakdown_diet_slip: string;

  // ── Phase 1 Detailed Outcomes & Separate Resume Tracking ──
  sdb_outcome_on_track: string;
  sdb_outcome_adjusted_on_track: string;
  sdb_outcome_planned_unstructured: string;
  sdb_outcome_near_slip: string;
  sdb_outcome_structured_slip: string;
  sdb_outcome_unstructured_slip: string;
  sdb_resumed_label: string;
  sdb_mark_resumed: string;
  sdb_marked_resumed: string;
  sdb_resume_rate: string;
  sdb_resume_count: string;
  sdb_select_outcome: string;
  sdb_outcome_select_hint: string;

  // ── Phase 2 Food Categories ──
  sdb_food_categories_label: string;
  sdb_cat_protein: string;
  sdb_cat_simple_carbs: string;
  sdb_cat_complex_carbs: string;
  sdb_cat_healthy_fats: string;
  sdb_cat_vegetables: string;
  sdb_cat_fruits: string;
  sdb_cat_desserts: string;
  sdb_cat_snacks: string;
  sdb_cat_beverages: string;

  // ── Phase 3 Structured vs Unstructured Awareness & Analytics ──
  sdb_awareness_title: string;
  sdb_awareness_how_structured: string;
  sdb_stat_structured: string;
  sdb_stat_unstructured: string;
  sdb_stat_structured_eating: string;
  sdb_stat_unstructured_eating: string;
  sdb_stat_structured_pct: string;
  sdb_stat_unstructured_pct: string;
  sdb_stat_structured_count: string;
  sdb_stat_unstructured_count: string;
  sdb_stat_record: string;
  sdb_stat_records: string;
  sdb_stat_eating_structure: string;
  sdb_stat_resume_count: string;
  sdb_stat_resume_rate: string;
  sdb_stat_food_categories: string;
  sdb_stat_category_distribution: string;
  sdb_period_today: string;
  sdb_period_7d: string;
  sdb_period_30d: string;
  sdb_period_all: string;
  sdb_no_structure_data: string;
  sdb_no_category_data: string;
  sdb_resume_summary_format: string;
  sdb_resume_no_slips: string;

  // ── Smart Notifications & Reminders (Phase 12) ──
  notif_screen_title: string;
  notif_screen_subtitle: string;
  notif_master_label: string;
  notif_master_desc: string;
  notif_perm_blocked: string;
  notif_perm_fallback_notice: string;
  notif_section_types: string;
  notif_type_checkin: string;
  notif_type_checkin_desc: string;
  notif_type_diet: string;
  notif_type_diet_desc: string;
  notif_type_why: string;
  notif_type_why_desc: string;
  notif_section_frequency: string;
  notif_freq_15m: string;
  notif_freq_30m: string;
  notif_freq_1h: string;
  notif_freq_twice_daily: string;
  notif_freq_daily: string;
  notif_freq_15m_caution: string;
  notif_section_active_hours: string;
  notif_active_from: string;
  notif_active_until: string;
  notif_section_specific_times: string;
  notif_time_primary: string;
  notif_time_secondary: string;
  notif_randomize_label: string;
  notif_randomize_desc: string;
  notif_privacy_label: string;
  notif_privacy_desc: string;
  notif_test_btn: string;
  notif_test_sent: string;
  notif_btn_not_now: string;
  notif_btn_checkin: string;
  notif_btn_diet: string;
  notif_btn_reconnect: string;
  notif_rem_checkin_title: string;
  notif_rem_checkin_body_1: string;
  notif_rem_checkin_body_2: string;
  notif_rem_checkin_body_3: string;
  notif_rem_diet_title: string;
  notif_rem_diet_body_general: string;
  notif_rem_diet_body_upcoming: string;
  notif_rem_why_title: string;
  notif_rem_why_body_general: string;
  notif_rem_why_body_custom: string;
  nav_reminders: string;
  commit_reminders_label: string;
  commit_reminders_desc: string;
  commit_reminders_btn: string;
  global_back: string;
  // ── Stats Reset ──
  stats_section_title: string;
  stats_reset_section_desc: string;
  stats_reset_btn: string;
  stats_modal_title: string;
  stats_modal_desc_1: string;
  stats_modal_desc_2: string;
  stats_modal_btn_cancel: string;
  stats_modal_btn_reset: string;
  stats_hold_title: string;
  stats_hold_instruction: string;
  stats_hold_subtext: string;
  stats_done_title: string;
  stats_done_desc: string;
  stats_done_btn: string;
  // ── Phase 4 Lifetime Reset Protection ──
  stats_lifetime_choice_title: string;
  stats_lifetime_choice_question: string;
  stats_lifetime_choice_desc: string;
  stats_btn_keep_lifetime: string;
  stats_btn_reset_lifetime: string;
  stats_lifetime_confirm_title: string;
  stats_lifetime_confirm_warning: string;
  stats_btn_confirm_lifetime_reset: string;
  stats_done_lifetime_kept: string;
  stats_done_lifetime_reset: string;
  // ── Phase 14: Background Push & PWA ──
  push_section_delivery: string;
  push_channel_push: string;
  push_channel_inapp: string;
  push_status_enabled: string;
  push_status_available: string;
  push_status_denied: string;
  push_status_unsupported: string;
  push_btn_enable: string;
  push_btn_disable: string;
  push_enabled_success: string;
  push_denied_desc: string;
  push_unsupported_desc: string;
  push_btn_install: string;
  push_status_installed: string;
  push_ios_install_title: string;
  push_ios_install_desc: string;
  push_btn_send_test: string;
  push_test_sent_backend: string;
  push_test_sent_fallback: string;
  push_test_failed: string;
  push_explain_prompt: string;
  push_inapp_desc: string;

  // ── Non-Negotiables Commitment (Task 2) ──
  nn_commit_btn: string;
  nn_recommit_btn: string;
  nn_commit_modal_title: string;
  nn_commit_affirmation: string;
  nn_commit_hold_instruction: string;
  nn_commit_success_title: string;
  nn_commit_success_sub: string;
  nn_commit_empty_hint: string;
  nn_commit_empty_add_btn: string;
  nn_commit_btn_return_home: string;
  nn_commit_btn_continue: string;
  ci_nn_add_btn: string;

  // ── Structured Diet Quick Build (Task 4) ──
  sdb_quick_build: string;
  sdb_qb_title: string;
  sdb_qb_sub: string;
  sdb_qb_start_time: string;
  sdb_qb_interval: string;
  sdb_qb_block_count: string;
  sdb_qb_preview: string;
  sdb_qb_btn_create: string;
  sdb_qb_btn_cancel: string;
  sdb_qb_conflict_title: string;
  sdb_qb_conflict_desc: string;
  sdb_qb_btn_add_existing: string;
  sdb_qb_btn_replace_existing: string;
  sdb_qb_unstructured_prompt: string;
  sdb_qb_btn_change_structured: string;
  sdb_qb_err_overflow: string;
  sdb_qb_hours_unit: string;
  sdb_qb_hour_unit_singular: string;
  sdb_qb_success: string;

  // ── Structured / Unstructured Templates (Task 5 & 6) ──
  sdb_choose_template: string;
  sdb_templates: string;
  sdb_templates_structured: string;
  sdb_templates_unstructured: string;
  sdb_tpl_preview: string;
  sdb_tpl_apply: string;
  sdb_tpl_btn_replace: string;
  sdb_tpl_confirm_prompt: string;
  sdb_tpl_structured_label: string;
  sdb_tpl_unstructured_label: string;
  sdb_tpl_days_unit: string;
  sdb_tpl_blocks_unit: string;
  sdb_tpl_demo_badge: string;
  sdb_tpl_applied_feedback: string;
  sdb_tpl_customize_hint: string;
  sdb_btn_customize: string;
  sdb_tpl_demo_struct_title: string;
  sdb_tpl_demo_struct_desc: string;
  sdb_tpl_demo_unstruct_title: string;
  sdb_tpl_demo_unstruct_desc: string;
  sdb_tpl_demo_all_unstruct_title: string;
  sdb_tpl_demo_all_unstruct_desc: string;

  // Task 6 — Daily template application & confirmation
  sdb_tpl_apply_to_day: string;
  sdb_tpl_replace_day_confirm: string;
  sdb_tpl_btn_replace_day: string;
  sdb_tpl_unstructured_guidance_badge: string;
  sdb_tpl_timeline_badge: string;
  sdb_tpl_next_day_ref: string;

  // Task 6 — Sergio's Approved Unstructured Templates (6)
  sdb_tpl_unstruct_loss_title: string;
  sdb_tpl_unstruct_loss_desc: string;
  sdb_tpl_moderate_loss_title: string;
  sdb_tpl_moderate_loss_desc: string;
  sdb_tpl_low_carb_flex_title: string;
  sdb_tpl_low_carb_flex_desc: string;
  sdb_tpl_balanced_flex_title: string;
  sdb_tpl_balanced_flex_desc: string;
  sdb_tpl_unstruct_maint_title: string;
  sdb_tpl_unstruct_maint_desc: string;
  sdb_tpl_social_free_title: string;
  sdb_tpl_social_free_desc: string;

  // Task 6 — Sergio's Approved Structured Templates (7)
  sdb_tpl_fasting_title: string;
  sdb_tpl_fasting_desc: string;
  sdb_tpl_low_cal_shakes_title: string;
  sdb_tpl_low_cal_shakes_desc: string;
  sdb_tpl_1_protein_shakes_title: string;
  sdb_tpl_1_protein_shakes_desc: string;
  sdb_tpl_2_protein_shakes_title: string;
  sdb_tpl_2_protein_shakes_desc: string;
  sdb_tpl_2_protein_dairy_title: string;
  sdb_tpl_2_protein_dairy_desc: string;
  sdb_tpl_2_protein_carbs_title: string;
  sdb_tpl_2_protein_carbs_desc: string;
  sdb_tpl_omad_title: string;
  sdb_tpl_omad_desc: string;

  // Task 6 — Timeline reference points
  sdb_tl_fast: string;
  sdb_tl_fast_no_planned_meal: string;
  sdb_tl_protein_meal_hungry: string;
  sdb_tl_usually_no_eating: string;
  sdb_tl_protein_centered_meal: string;
  sdb_tl_micro_fast_no_grazing: string;
  sdb_tl_continue_gap_between_meals: string;
  sdb_tl_protein_centered_dinner: string;
  sdb_tl_eating_usually_finished: string;
  sdb_tl_new_intentional_day: string;
  sdb_tl_fast_optional_breakfast: string;
  sdb_tl_protein_centered_breakfast: string;
  sdb_tl_optional: string;
  sdb_tl_protein_vegetables: string;
  sdb_tl_continue_gap: string;
  sdb_tl_eggs_meat_dairy: string;
  sdb_tl_meat_fish_eggs_veg: string;
  sdb_tl_optional_dairy_protein: string;
  sdb_tl_protein_veg_fat: string;
  sdb_tl_fast_if_finished: string;
  sdb_tl_breakfast_if_hungry: string;
  sdb_tl_protein_whole_food_carb: string;
  sdb_tl_protein_veg_healthy_carb: string;
  sdb_tl_optional_planned_snack: string;
  sdb_tl_eat_fast_choice: string;
  sdb_tl_normal_breakfast_desired: string;
  sdb_tl_meal_appetite: string;
  sdb_tl_flexible: string;
  sdb_tl_normal_balanced_dinner: string;
  sdb_tl_optional_eating: string;
  sdb_tl_preferably_finished: string;
  sdb_tl_continue_maintenance: string;
  sdb_tl_celebration_social_meal: string;
  sdb_tl_resume_structure_social: string;
  sdb_tl_resume_dont_extend: string;
  sdb_tl_normal_structure_resumes: string;
  sdb_tl_end_continue_fast: string;
  sdb_tl_shake_1: string;
  sdb_tl_shake_2: string;
  sdb_tl_shake_3: string;
  sdb_tl_shake_4: string;
  sdb_tl_next_structured_day: string;
  sdb_tl_protein_meal: string;
  sdb_tl_fast_begins: string;
  sdb_tl_protein_meal_1: string;
  sdb_tl_protein_meal_2: string;
  sdb_tl_fast_coffee_tea: string;
  sdb_tl_protein_1_dairy: string;
  sdb_tl_dairy_protein_option: string;
  sdb_tl_protein_2_dairy: string;
  sdb_tl_protein_1_healthy_carb: string;
  sdb_tl_protein_2_healthy_carb: string;
  sdb_tl_omad_meal: string;
  sdb_tl_continue_until_omad: string;

  // ── Settings Hub (Phase 16) ──
  settings_title: string;
  settings_subtitle: string;
  settings_sec_account: string;
  settings_sec_experience: string;
  settings_sec_data: string;
  settings_sec_support: string;
  settings_lang_title: string;
  settings_lang_desc: string;
  settings_lang_modal_title: string;
  settings_lang_en: string;
  settings_lang_es: string;
  settings_lang_nl: string;
  settings_theme_title: string;
  settings_theme_desc: string;
  settings_theme_dark: string;
  settings_theme_active: string;
  settings_theme_notice: string;
  settings_reminders_title: string;
  settings_reminders_desc: string;
  settings_sound_title: string;
  settings_sound_desc: string;
  settings_sound_screen_title: string;
  settings_sound_screen_subtitle: string;
  settings_sound_engine_notice: string;
  settings_sound_timer_audio: string;
  settings_sound_timer_audio_desc: string;
  settings_sound_haptic_title: string;
  settings_sound_haptic_desc: string;

  // Sound & Haptics Feedback (Phase 17)
  sound_toggle_label: string;
  sound_toggle_desc: string;
  haptic_toggle_label: string;
  haptic_toggle_desc: string;
  haptic_unsupported_notice: string;
  feedback_test_title: string;
  feedback_test_sound: string;
  feedback_test_haptic: string;
  feedback_test_success: string;
  feedback_sound_disabled: string;
  feedback_haptic_disabled: string;
  feedback_playing: string;
  feedback_vibrated: string;
  settings_motivation_title: string;
  settings_motivation_desc: string;
  settings_history_title: string;
  settings_history_desc: string;
  settings_export_title: string;
  settings_export_desc: string;
  settings_export_soon: string;
  settings_reset_stats_title: string;
  settings_reset_stats_desc: string;
  settings_terms_title: string;
  settings_terms_desc: string;
  settings_about_title: string;
  settings_about_desc: string;
  settings_app_version: string;
  settings_app_name: string;
  settings_app_framework: string;
  settings_about_summary: string;
  settings_privacy_title: string;
  settings_privacy_desc: string;
  settings_privacy_modal_title: string;
  settings_privacy_content: string;
  nav_settings: string;

  // ── Structure Goal / Master Profile System ──
  sdb_profile_title: string;
  sdb_profile_active_label: string;
  sdb_profile_switch_btn: string;
  sdb_profile_create_btn: string;
  sdb_profile_edit_btn: string;
  sdb_profile_delete_btn: string;
  sdb_profile_select_btn: string;
  sdb_profile_builtin_section: string;
  sdb_profile_custom_section: string;
  sdb_profile_no_custom_hint: string;
  sdb_profile_name_required: string;
  sdb_profile_built_in_badge: string;
  sdb_profile_custom_badge: string;
  sdb_profile_modal_title: string;
  sdb_profile_create_modal_title: string;
  sdb_profile_edit_modal_title: string;
  sdb_profile_name_label: string;
  sdb_profile_name_placeholder: string;
  sdb_profile_desc_label: string;
  sdb_profile_desc_placeholder: string;
  sdb_profile_save_btn: string;
  sdb_profile_delete_confirm_title: string;
  sdb_profile_delete_confirm: string;
  sdb_profile_delete_active_warning: string;
  sdb_profile_clone_from_active: string;
  sdb_profile_built_in_cannot_delete: string;

  // 6 Built-In Goal Names & Descriptions
  sdb_goal_rapid_fat_loss: string;
  sdb_goal_rapid_fat_loss_desc: string;
  sdb_goal_moderate_fat_loss: string;
  sdb_goal_moderate_fat_loss_desc: string;
  sdb_goal_protecting_current_loss: string;
  sdb_goal_protecting_current_loss_desc: string;
  sdb_goal_maintenance: string;
  sdb_goal_maintenance_desc: string;
  sdb_goal_vacation_maintenance: string;
  sdb_goal_vacation_maintenance_desc: string;
  sdb_goal_recovery_illness: string;
  sdb_goal_recovery_illness_desc: string;

  // ── Daily Review Feature ──
  dr_entry_title: string;
  dr_entry_subtitle: string;
  dr_entry_action: string;
  dr_entry_badge_completed: string;
  dr_entry_badge_pending: string;
  dr_screen_title: string;
  dr_screen_subtitle: string;
  dr_date_label: string;
  dr_select_date_picker: string;
  dr_associated_goal: string;
  dr_no_diet_warning_title: string;
  dr_no_diet_warning_desc: string;
  dr_autosaved: string;
  dr_save_finish_btn: string;
  dr_edit_review_btn: string;
  dr_done_back_btn: string;
  dr_optional_note_label: string;
  dr_optional_note_placeholder: string;
  dr_add_note_btn: string;
  dr_summary_title: string;
  dr_summary_subtitle: string;
  dr_summary_completed_badge: string;
  dr_summary_key_reflections: string;

  // Questions 1–10
  dr_q1_text: string;
  dr_q1_opt_all: string;
  dr_q1_opt_most: string;
  dr_q1_opt_partly: string;
  dr_q1_opt_none: string;

  dr_q2_text: string;
  dr_q2_opt_yes: string;
  dr_q2_opt_partly: string;
  dr_q2_opt_no: string;

  dr_q3_text: string;
  dr_q3_opt_planned: string;
  dr_q3_opt_mostly: string;
  dr_q3_opt_reactive: string;
  dr_q3_opt_no_flexible: string;

  dr_q4_text: string;
  dr_q4_opt_yes: string;
  dr_q4_opt_minor: string;
  dr_q4_opt_frequent: string;

  dr_q5_text: string;
  dr_q5_opt_replaced: string;
  dr_q5_opt_added: string;
  dr_q5_opt_both: string;
  dr_q5_opt_none: string;

  dr_q6_text: string;
  dr_q6_opt_yes: string;
  dr_q6_opt_delayed: string;
  dr_q6_opt_no: string;

  dr_q7_text: string;
  dr_q7_opt_immediate: string;
  dr_q7_opt_next_block: string;
  dr_q7_opt_next_day: string;
  dr_q7_opt_no_slip: string;

  dr_q8_text: string;
  dr_trigger_stress: string;
  dr_trigger_social: string;
  dr_trigger_visual: string;
  dr_trigger_boredom: string;
  dr_trigger_hunger: string;
  dr_trigger_fatigue: string;
  dr_trigger_celebration: string;
  dr_trigger_none: string;

  dr_q9_text: string;
  dr_q9_opt_yes: string;
  dr_q9_opt_partly: string;
  dr_q9_opt_no: string;

  dr_q10_text: string;
  dr_q10_opt_dominant: string;
  dr_q10_opt_recovering: string;
  dr_q10_opt_at_risk: string;
  dr_q10_opt_lost: string;

  // ── Global Score, Progression, and Level-up ──
  global_score_badge_today: string;
  global_score_badge_lifetime: string;
  global_score_badge_level: string;
  global_score_badge_title: string;
  level_label: string;
  level_max_reached: string;
  level_progress_to_next: string;
  level_xp_remaining: string;
  level_max_description: string;
  dash_progression_title: string;
  dash_progression_subtitle: string;
  dash_today_score_label: string;
  dash_lifetime_xp_label: string;
  dash_current_streak_label: string;
  dash_longest_streak_label: string;
  dash_total_active_days_label: string;
  dash_score_breakdown_title: string;
  dash_score_breakdown_empty: string;
  dash_view_dashboard: string;
  level_up_title: string;
  level_up_subtitle: string;
  level_up_continue: string;
  score_cat_day_start: string;
  score_cat_check_in: string;
  score_cat_diet_on_track: string;
  score_cat_slip_reported: string;
  score_cat_recommit: string;
  score_cat_daily_review: string;
  score_cat_commitment: string;
  score_cat_non_negotiables: string;
  score_cat_why_review: string;
  score_cat_diet_review: string;
  score_cat_in_control: string;
  score_cat_motivation: string;
  score_cat_timer: string;
  score_cat_consistency_bonus: string;

  // ── Phase 6: Food & Beverage Photos ──
  sdb_add_photo: string;
  sdb_add_food_photo: string;
  sdb_take_choose_photo: string;
  sdb_replace_photo: string;
  sdb_remove_photo: string;
  sdb_food_photo: string;
  sdb_view_photo: string;
  sdb_photo_preview_title: string;
  sdb_close_preview: string;
  sdb_err_process_photo: string;
  sdb_err_save_photo: string;
  sdb_confirm_remove_photo: string;

  // ── Phase 6B: Multi-Photo UX & Schedule Actions ──
  sdb_food_photos: string;
  sdb_add_another_photo: string;
  sdb_photo_counter: string;
  sdb_photo_nav_prev: string;
  sdb_photo_nav_next: string;

  // ── Phase 6C: Android Gallery & Photo Error Keys ──
  sdb_err_unsupported_format: string;
  sdb_err_photo_too_large: string;
  sdb_err_invalid_image: string;

  // ── Phase 7A: My Commitments Hub & My Slippery Zones ──
  score_cat_slippery_zones: string;
  home_my_commitments: string;
  home_my_commitments_sub: string;
  home_slippery_zones_shortcut: string;
  my_commitments_title: string;
  my_commitments_subtitle: string;
  my_commitments_card_commitment_title: string;
  my_commitments_card_commitment_desc: string;
  my_commitments_card_nn_title: string;
  my_commitments_card_nn_desc: string;
  my_commitments_card_sz_title: string;
  my_commitments_card_sz_desc: string;
  sz_screen_title: string;
  sz_screen_subtitle: string;
  sz_awareness_banner: string;
  sz_add_zone_btn: string;
  sz_empty_title: string;
  sz_empty_desc: string;
  sz_add_modal_title: string;
  sz_edit_modal_title: string;
  sz_input_placeholder: string;
  sz_save_btn: string;
  sz_cancel_btn: string;
  sz_delete_confirm: string;
  sz_edit_btn: string;
  sz_delete_btn: string;
  sz_hold_to_review: string;
  sz_holding_review: string;
  sz_review_success: string;
  sz_reviews_count: string;
  sz_never_reviewed: string;
  sz_reviewed_today: string;
  sz_last_reviewed: string;
  sz_points_awarded: string;
  sz_points_already_awarded: string;
}


