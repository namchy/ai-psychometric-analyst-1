-- Canonical GDT-01 Team Dynamics seed boundary.  This function is one PostgreSQL
-- transaction: any unhandled error rolls back assignment, wrappers, attempts,
-- responses and selections together.
--
-- Authorization boundary: SECURITY DEFINER plus EXECUTE granted only to service_role.
-- This RPC is exclusively for the controlled server-side operator. The operator's
-- explicit apply/confirmation is operational protection, not a SQL identity guard.
create or replace function public.create_gdt_01_team_dynamics_seed_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- SERVER_OWNED_MANIFEST: authored answers and roster never come from p_payload.
  v_manifest constant jsonb := $gdt01_manifest$
{"manifest_version":"gdt_01_team_dynamics_seed_manifest_v1","runtime_contract_checksum":"375a97663ed825ff2f8c09f3716d6a39bbea2722d5b45f4a61d60d2be210f48d","members":[{"candidate_id":"GD-001","email":"amel.kovacevic@partnerplus.ba","responses":[{"question_code":"TDM31_01","question_order":1,"response_type":"likert_single","option_code":"TDM31_01_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_02","question_order":2,"response_type":"likert_single","option_code":"TDM31_02_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_03","question_order":3,"response_type":"likert_single","option_code":"TDM31_03_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_04","question_order":4,"response_type":"likert_single","option_code":"TDM31_04_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_05","question_order":5,"response_type":"likert_single","option_code":"TDM31_05_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_06","question_order":6,"response_type":"likert_single","option_code":"TDM31_06_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_07","question_order":7,"response_type":"likert_single","option_code":"TDM31_07_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_08","question_order":8,"response_type":"likert_single","option_code":"TDM31_08_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_09","question_order":9,"response_type":"likert_single","option_code":"TDM31_09_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_10","question_order":10,"response_type":"likert_single","option_code":"TDM31_10_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_11","question_order":11,"response_type":"likert_single","option_code":"TDM31_11_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_12","question_order":12,"response_type":"likert_single","option_code":"TDM31_12_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_13","question_order":13,"response_type":"likert_single","option_code":"TDM31_13_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_14","question_order":14,"response_type":"likert_single","option_code":"TDM31_14_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_15","question_order":15,"response_type":"likert_single","option_code":"TDM31_15_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_16","question_order":16,"response_type":"likert_single","option_code":"TDM31_16_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_17","question_order":17,"response_type":"likert_single","option_code":"TDM31_17_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_18","question_order":18,"response_type":"likert_single","option_code":"TDM31_18_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_19","question_order":19,"response_type":"likert_single","option_code":"TDM31_19_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_20","question_order":20,"response_type":"likert_single","option_code":"TDM31_20_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_21","question_order":21,"response_type":"likert_single","option_code":"TDM31_21_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_22","question_order":22,"response_type":"likert_single","option_code":"TDM31_22_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_23","question_order":23,"response_type":"likert_single","option_code":"TDM31_23_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_24","question_order":24,"response_type":"likert_single","option_code":"TDM31_24_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_25","question_order":25,"response_type":"likert_single","option_code":"TDM31_25_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_26","question_order":26,"response_type":"likert_single","option_code":"TDM31_26_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_27","question_order":27,"response_type":"likert_single","option_code":"TDM31_27_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_28","question_order":28,"response_type":"likert_single","option_code":"TDM31_28_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_29","question_order":29,"response_type":"likert_single","option_code":"TDM31_29_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_30","question_order":30,"response_type":"likert_single","option_code":"TDM31_30_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_31","question_order":31,"response_type":"likert_single","option_code":"TDM31_31_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_1","question_order":32,"response_type":"likert_single","option_code":"TPSDP_1_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_2","question_order":33,"response_type":"likert_single","option_code":"TPSDP_2_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_3","question_order":34,"response_type":"likert_single","option_code":"TPSDP_3_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_4","question_order":35,"response_type":"likert_single","option_code":"TPSDP_4_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_5","question_order":36,"response_type":"likert_single","option_code":"TPSDP_5_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_6","question_order":37,"response_type":"likert_single","option_code":"TPSDP_6_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_7","question_order":38,"response_type":"likert_single","option_code":"TPSDP_7_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"SJT_TD_01","question_order":39,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_01_A","worst_option_code":"SJT_TD_01_D","selection_roles":[{"role":"best","option_code":"SJT_TD_01_A"},{"role":"worst","option_code":"SJT_TD_01_D"}]},{"question_code":"SJT_TD_02","question_order":40,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_02_A","worst_option_code":"SJT_TD_02_D","selection_roles":[{"role":"best","option_code":"SJT_TD_02_A"},{"role":"worst","option_code":"SJT_TD_02_D"}]},{"question_code":"SJT_TD_03","question_order":41,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_03_A","worst_option_code":"SJT_TD_03_D","selection_roles":[{"role":"best","option_code":"SJT_TD_03_A"},{"role":"worst","option_code":"SJT_TD_03_D"}]},{"question_code":"SJT_TD_04","question_order":42,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_04_A","worst_option_code":"SJT_TD_04_D","selection_roles":[{"role":"best","option_code":"SJT_TD_04_A"},{"role":"worst","option_code":"SJT_TD_04_D"}]},{"question_code":"SJT_TD_05","question_order":43,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_05_A","worst_option_code":"SJT_TD_05_D","selection_roles":[{"role":"best","option_code":"SJT_TD_05_A"},{"role":"worst","option_code":"SJT_TD_05_D"}]},{"question_code":"SJT_TD_06","question_order":44,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_06_A","worst_option_code":"SJT_TD_06_D","selection_roles":[{"role":"best","option_code":"SJT_TD_06_A"},{"role":"worst","option_code":"SJT_TD_06_D"}]},{"question_code":"OUTCOME_1","question_order":45,"response_type":"likert_single","option_code":"OUTCOME_1_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_2","question_order":46,"response_type":"likert_single","option_code":"OUTCOME_2_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_3","question_order":47,"response_type":"likert_single","option_code":"OUTCOME_3_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_4","question_order":48,"response_type":"likert_single","option_code":"OUTCOME_4_OPTION_3","option_value":3,"selection_roles":[]}]},{"candidate_id":"GD-002","email":"natasa.rapaic@partnerplus.ba","responses":[{"question_code":"TDM31_01","question_order":1,"response_type":"likert_single","option_code":"TDM31_01_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_02","question_order":2,"response_type":"likert_single","option_code":"TDM31_02_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_03","question_order":3,"response_type":"likert_single","option_code":"TDM31_03_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_04","question_order":4,"response_type":"likert_single","option_code":"TDM31_04_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_05","question_order":5,"response_type":"likert_single","option_code":"TDM31_05_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_06","question_order":6,"response_type":"likert_single","option_code":"TDM31_06_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_07","question_order":7,"response_type":"likert_single","option_code":"TDM31_07_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_08","question_order":8,"response_type":"likert_single","option_code":"TDM31_08_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_09","question_order":9,"response_type":"likert_single","option_code":"TDM31_09_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_10","question_order":10,"response_type":"likert_single","option_code":"TDM31_10_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_11","question_order":11,"response_type":"likert_single","option_code":"TDM31_11_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_12","question_order":12,"response_type":"likert_single","option_code":"TDM31_12_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_13","question_order":13,"response_type":"likert_single","option_code":"TDM31_13_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_14","question_order":14,"response_type":"likert_single","option_code":"TDM31_14_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_15","question_order":15,"response_type":"likert_single","option_code":"TDM31_15_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_16","question_order":16,"response_type":"likert_single","option_code":"TDM31_16_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_17","question_order":17,"response_type":"likert_single","option_code":"TDM31_17_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_18","question_order":18,"response_type":"likert_single","option_code":"TDM31_18_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_19","question_order":19,"response_type":"likert_single","option_code":"TDM31_19_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_20","question_order":20,"response_type":"likert_single","option_code":"TDM31_20_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_21","question_order":21,"response_type":"likert_single","option_code":"TDM31_21_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_22","question_order":22,"response_type":"likert_single","option_code":"TDM31_22_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_23","question_order":23,"response_type":"likert_single","option_code":"TDM31_23_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_24","question_order":24,"response_type":"likert_single","option_code":"TDM31_24_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_25","question_order":25,"response_type":"likert_single","option_code":"TDM31_25_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_26","question_order":26,"response_type":"likert_single","option_code":"TDM31_26_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_27","question_order":27,"response_type":"likert_single","option_code":"TDM31_27_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_28","question_order":28,"response_type":"likert_single","option_code":"TDM31_28_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_29","question_order":29,"response_type":"likert_single","option_code":"TDM31_29_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_30","question_order":30,"response_type":"likert_single","option_code":"TDM31_30_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_31","question_order":31,"response_type":"likert_single","option_code":"TDM31_31_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_1","question_order":32,"response_type":"likert_single","option_code":"TPSDP_1_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_2","question_order":33,"response_type":"likert_single","option_code":"TPSDP_2_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_3","question_order":34,"response_type":"likert_single","option_code":"TPSDP_3_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_4","question_order":35,"response_type":"likert_single","option_code":"TPSDP_4_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_5","question_order":36,"response_type":"likert_single","option_code":"TPSDP_5_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_6","question_order":37,"response_type":"likert_single","option_code":"TPSDP_6_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_7","question_order":38,"response_type":"likert_single","option_code":"TPSDP_7_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"SJT_TD_01","question_order":39,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_01_A","worst_option_code":"SJT_TD_01_D","selection_roles":[{"role":"best","option_code":"SJT_TD_01_A"},{"role":"worst","option_code":"SJT_TD_01_D"}]},{"question_code":"SJT_TD_02","question_order":40,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_02_A","worst_option_code":"SJT_TD_02_D","selection_roles":[{"role":"best","option_code":"SJT_TD_02_A"},{"role":"worst","option_code":"SJT_TD_02_D"}]},{"question_code":"SJT_TD_03","question_order":41,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_03_A","worst_option_code":"SJT_TD_03_D","selection_roles":[{"role":"best","option_code":"SJT_TD_03_A"},{"role":"worst","option_code":"SJT_TD_03_D"}]},{"question_code":"SJT_TD_04","question_order":42,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_04_A","worst_option_code":"SJT_TD_04_D","selection_roles":[{"role":"best","option_code":"SJT_TD_04_A"},{"role":"worst","option_code":"SJT_TD_04_D"}]},{"question_code":"SJT_TD_05","question_order":43,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_05_A","worst_option_code":"SJT_TD_05_D","selection_roles":[{"role":"best","option_code":"SJT_TD_05_A"},{"role":"worst","option_code":"SJT_TD_05_D"}]},{"question_code":"SJT_TD_06","question_order":44,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_06_A","worst_option_code":"SJT_TD_06_D","selection_roles":[{"role":"best","option_code":"SJT_TD_06_A"},{"role":"worst","option_code":"SJT_TD_06_D"}]},{"question_code":"OUTCOME_1","question_order":45,"response_type":"likert_single","option_code":"OUTCOME_1_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_2","question_order":46,"response_type":"likert_single","option_code":"OUTCOME_2_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_3","question_order":47,"response_type":"likert_single","option_code":"OUTCOME_3_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_4","question_order":48,"response_type":"likert_single","option_code":"OUTCOME_4_OPTION_3","option_value":3,"selection_roles":[]}]},{"candidate_id":"GD-003","email":"vladimir.lucic@partnerplus.ba","responses":[{"question_code":"TDM31_01","question_order":1,"response_type":"likert_single","option_code":"TDM31_01_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_02","question_order":2,"response_type":"likert_single","option_code":"TDM31_02_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_03","question_order":3,"response_type":"likert_single","option_code":"TDM31_03_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_04","question_order":4,"response_type":"likert_single","option_code":"TDM31_04_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_05","question_order":5,"response_type":"likert_single","option_code":"TDM31_05_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_06","question_order":6,"response_type":"likert_single","option_code":"TDM31_06_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_07","question_order":7,"response_type":"likert_single","option_code":"TDM31_07_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_08","question_order":8,"response_type":"likert_single","option_code":"TDM31_08_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_09","question_order":9,"response_type":"likert_single","option_code":"TDM31_09_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_10","question_order":10,"response_type":"likert_single","option_code":"TDM31_10_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_11","question_order":11,"response_type":"likert_single","option_code":"TDM31_11_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_12","question_order":12,"response_type":"likert_single","option_code":"TDM31_12_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_13","question_order":13,"response_type":"likert_single","option_code":"TDM31_13_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_14","question_order":14,"response_type":"likert_single","option_code":"TDM31_14_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_15","question_order":15,"response_type":"likert_single","option_code":"TDM31_15_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_16","question_order":16,"response_type":"likert_single","option_code":"TDM31_16_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_17","question_order":17,"response_type":"likert_single","option_code":"TDM31_17_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_18","question_order":18,"response_type":"likert_single","option_code":"TDM31_18_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_19","question_order":19,"response_type":"likert_single","option_code":"TDM31_19_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_20","question_order":20,"response_type":"likert_single","option_code":"TDM31_20_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_21","question_order":21,"response_type":"likert_single","option_code":"TDM31_21_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_22","question_order":22,"response_type":"likert_single","option_code":"TDM31_22_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_23","question_order":23,"response_type":"likert_single","option_code":"TDM31_23_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_24","question_order":24,"response_type":"likert_single","option_code":"TDM31_24_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_25","question_order":25,"response_type":"likert_single","option_code":"TDM31_25_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_26","question_order":26,"response_type":"likert_single","option_code":"TDM31_26_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_27","question_order":27,"response_type":"likert_single","option_code":"TDM31_27_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_28","question_order":28,"response_type":"likert_single","option_code":"TDM31_28_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_29","question_order":29,"response_type":"likert_single","option_code":"TDM31_29_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_30","question_order":30,"response_type":"likert_single","option_code":"TDM31_30_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_31","question_order":31,"response_type":"likert_single","option_code":"TDM31_31_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_1","question_order":32,"response_type":"likert_single","option_code":"TPSDP_1_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_2","question_order":33,"response_type":"likert_single","option_code":"TPSDP_2_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_3","question_order":34,"response_type":"likert_single","option_code":"TPSDP_3_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_4","question_order":35,"response_type":"likert_single","option_code":"TPSDP_4_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_5","question_order":36,"response_type":"likert_single","option_code":"TPSDP_5_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_6","question_order":37,"response_type":"likert_single","option_code":"TPSDP_6_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_7","question_order":38,"response_type":"likert_single","option_code":"TPSDP_7_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"SJT_TD_01","question_order":39,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_01_B","worst_option_code":"SJT_TD_01_D","selection_roles":[{"role":"best","option_code":"SJT_TD_01_B"},{"role":"worst","option_code":"SJT_TD_01_D"}]},{"question_code":"SJT_TD_02","question_order":40,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_02_B","worst_option_code":"SJT_TD_02_D","selection_roles":[{"role":"best","option_code":"SJT_TD_02_B"},{"role":"worst","option_code":"SJT_TD_02_D"}]},{"question_code":"SJT_TD_03","question_order":41,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_03_B","worst_option_code":"SJT_TD_03_D","selection_roles":[{"role":"best","option_code":"SJT_TD_03_B"},{"role":"worst","option_code":"SJT_TD_03_D"}]},{"question_code":"SJT_TD_04","question_order":42,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_04_B","worst_option_code":"SJT_TD_04_D","selection_roles":[{"role":"best","option_code":"SJT_TD_04_B"},{"role":"worst","option_code":"SJT_TD_04_D"}]},{"question_code":"SJT_TD_05","question_order":43,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_05_B","worst_option_code":"SJT_TD_05_D","selection_roles":[{"role":"best","option_code":"SJT_TD_05_B"},{"role":"worst","option_code":"SJT_TD_05_D"}]},{"question_code":"SJT_TD_06","question_order":44,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_06_B","worst_option_code":"SJT_TD_06_D","selection_roles":[{"role":"best","option_code":"SJT_TD_06_B"},{"role":"worst","option_code":"SJT_TD_06_D"}]},{"question_code":"OUTCOME_1","question_order":45,"response_type":"likert_single","option_code":"OUTCOME_1_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_2","question_order":46,"response_type":"likert_single","option_code":"OUTCOME_2_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_3","question_order":47,"response_type":"likert_single","option_code":"OUTCOME_3_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_4","question_order":48,"response_type":"likert_single","option_code":"OUTCOME_4_OPTION_3","option_value":3,"selection_roles":[]}]},{"candidate_id":"GD-004","email":"natali.delic@partnerplus.ba","responses":[{"question_code":"TDM31_01","question_order":1,"response_type":"likert_single","option_code":"TDM31_01_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_02","question_order":2,"response_type":"likert_single","option_code":"TDM31_02_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_03","question_order":3,"response_type":"likert_single","option_code":"TDM31_03_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_04","question_order":4,"response_type":"likert_single","option_code":"TDM31_04_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_05","question_order":5,"response_type":"likert_single","option_code":"TDM31_05_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_06","question_order":6,"response_type":"likert_single","option_code":"TDM31_06_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_07","question_order":7,"response_type":"likert_single","option_code":"TDM31_07_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_08","question_order":8,"response_type":"likert_single","option_code":"TDM31_08_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_09","question_order":9,"response_type":"likert_single","option_code":"TDM31_09_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_10","question_order":10,"response_type":"likert_single","option_code":"TDM31_10_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_11","question_order":11,"response_type":"likert_single","option_code":"TDM31_11_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_12","question_order":12,"response_type":"likert_single","option_code":"TDM31_12_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_13","question_order":13,"response_type":"likert_single","option_code":"TDM31_13_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_14","question_order":14,"response_type":"likert_single","option_code":"TDM31_14_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_15","question_order":15,"response_type":"likert_single","option_code":"TDM31_15_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_16","question_order":16,"response_type":"likert_single","option_code":"TDM31_16_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_17","question_order":17,"response_type":"likert_single","option_code":"TDM31_17_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_18","question_order":18,"response_type":"likert_single","option_code":"TDM31_18_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_19","question_order":19,"response_type":"likert_single","option_code":"TDM31_19_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_20","question_order":20,"response_type":"likert_single","option_code":"TDM31_20_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_21","question_order":21,"response_type":"likert_single","option_code":"TDM31_21_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_22","question_order":22,"response_type":"likert_single","option_code":"TDM31_22_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_23","question_order":23,"response_type":"likert_single","option_code":"TDM31_23_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_24","question_order":24,"response_type":"likert_single","option_code":"TDM31_24_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_25","question_order":25,"response_type":"likert_single","option_code":"TDM31_25_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_26","question_order":26,"response_type":"likert_single","option_code":"TDM31_26_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_27","question_order":27,"response_type":"likert_single","option_code":"TDM31_27_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_28","question_order":28,"response_type":"likert_single","option_code":"TDM31_28_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_29","question_order":29,"response_type":"likert_single","option_code":"TDM31_29_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_30","question_order":30,"response_type":"likert_single","option_code":"TDM31_30_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TDM31_31","question_order":31,"response_type":"likert_single","option_code":"TDM31_31_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_1","question_order":32,"response_type":"likert_single","option_code":"TPSDP_1_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_2","question_order":33,"response_type":"likert_single","option_code":"TPSDP_2_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_3","question_order":34,"response_type":"likert_single","option_code":"TPSDP_3_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_4","question_order":35,"response_type":"likert_single","option_code":"TPSDP_4_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_5","question_order":36,"response_type":"likert_single","option_code":"TPSDP_5_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_6","question_order":37,"response_type":"likert_single","option_code":"TPSDP_6_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_7","question_order":38,"response_type":"likert_single","option_code":"TPSDP_7_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"SJT_TD_01","question_order":39,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_01_A","worst_option_code":"SJT_TD_01_C","selection_roles":[{"role":"best","option_code":"SJT_TD_01_A"},{"role":"worst","option_code":"SJT_TD_01_C"}]},{"question_code":"SJT_TD_02","question_order":40,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_02_A","worst_option_code":"SJT_TD_02_C","selection_roles":[{"role":"best","option_code":"SJT_TD_02_A"},{"role":"worst","option_code":"SJT_TD_02_C"}]},{"question_code":"SJT_TD_03","question_order":41,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_03_A","worst_option_code":"SJT_TD_03_C","selection_roles":[{"role":"best","option_code":"SJT_TD_03_A"},{"role":"worst","option_code":"SJT_TD_03_C"}]},{"question_code":"SJT_TD_04","question_order":42,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_04_A","worst_option_code":"SJT_TD_04_C","selection_roles":[{"role":"best","option_code":"SJT_TD_04_A"},{"role":"worst","option_code":"SJT_TD_04_C"}]},{"question_code":"SJT_TD_05","question_order":43,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_05_A","worst_option_code":"SJT_TD_05_C","selection_roles":[{"role":"best","option_code":"SJT_TD_05_A"},{"role":"worst","option_code":"SJT_TD_05_C"}]},{"question_code":"SJT_TD_06","question_order":44,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_06_A","worst_option_code":"SJT_TD_06_C","selection_roles":[{"role":"best","option_code":"SJT_TD_06_A"},{"role":"worst","option_code":"SJT_TD_06_C"}]},{"question_code":"OUTCOME_1","question_order":45,"response_type":"likert_single","option_code":"OUTCOME_1_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"OUTCOME_2","question_order":46,"response_type":"likert_single","option_code":"OUTCOME_2_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"OUTCOME_3","question_order":47,"response_type":"likert_single","option_code":"OUTCOME_3_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"OUTCOME_4","question_order":48,"response_type":"likert_single","option_code":"OUTCOME_4_OPTION_4","option_value":4,"selection_roles":[]}]},{"candidate_id":"GD-005","email":"anisa.lojo.bajric@partnerplus.ba","responses":[{"question_code":"TDM31_01","question_order":1,"response_type":"likert_single","option_code":"TDM31_01_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_02","question_order":2,"response_type":"likert_single","option_code":"TDM31_02_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_03","question_order":3,"response_type":"likert_single","option_code":"TDM31_03_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_04","question_order":4,"response_type":"likert_single","option_code":"TDM31_04_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_05","question_order":5,"response_type":"likert_single","option_code":"TDM31_05_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_06","question_order":6,"response_type":"likert_single","option_code":"TDM31_06_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_07","question_order":7,"response_type":"likert_single","option_code":"TDM31_07_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_08","question_order":8,"response_type":"likert_single","option_code":"TDM31_08_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_09","question_order":9,"response_type":"likert_single","option_code":"TDM31_09_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_10","question_order":10,"response_type":"likert_single","option_code":"TDM31_10_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_11","question_order":11,"response_type":"likert_single","option_code":"TDM31_11_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_12","question_order":12,"response_type":"likert_single","option_code":"TDM31_12_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_13","question_order":13,"response_type":"likert_single","option_code":"TDM31_13_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_14","question_order":14,"response_type":"likert_single","option_code":"TDM31_14_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_15","question_order":15,"response_type":"likert_single","option_code":"TDM31_15_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_16","question_order":16,"response_type":"likert_single","option_code":"TDM31_16_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_17","question_order":17,"response_type":"likert_single","option_code":"TDM31_17_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_18","question_order":18,"response_type":"likert_single","option_code":"TDM31_18_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_19","question_order":19,"response_type":"likert_single","option_code":"TDM31_19_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_20","question_order":20,"response_type":"likert_single","option_code":"TDM31_20_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_21","question_order":21,"response_type":"likert_single","option_code":"TDM31_21_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_22","question_order":22,"response_type":"likert_single","option_code":"TDM31_22_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_23","question_order":23,"response_type":"likert_single","option_code":"TDM31_23_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_24","question_order":24,"response_type":"likert_single","option_code":"TDM31_24_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_25","question_order":25,"response_type":"likert_single","option_code":"TDM31_25_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_26","question_order":26,"response_type":"likert_single","option_code":"TDM31_26_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_27","question_order":27,"response_type":"likert_single","option_code":"TDM31_27_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_28","question_order":28,"response_type":"likert_single","option_code":"TDM31_28_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_29","question_order":29,"response_type":"likert_single","option_code":"TDM31_29_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_30","question_order":30,"response_type":"likert_single","option_code":"TDM31_30_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TDM31_31","question_order":31,"response_type":"likert_single","option_code":"TDM31_31_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"TPSDP_1","question_order":32,"response_type":"likert_single","option_code":"TPSDP_1_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_2","question_order":33,"response_type":"likert_single","option_code":"TPSDP_2_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_3","question_order":34,"response_type":"likert_single","option_code":"TPSDP_3_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_4","question_order":35,"response_type":"likert_single","option_code":"TPSDP_4_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_5","question_order":36,"response_type":"likert_single","option_code":"TPSDP_5_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_6","question_order":37,"response_type":"likert_single","option_code":"TPSDP_6_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"TPSDP_7","question_order":38,"response_type":"likert_single","option_code":"TPSDP_7_OPTION_4","option_value":4,"selection_roles":[]},{"question_code":"SJT_TD_01","question_order":39,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_01_B","worst_option_code":"SJT_TD_01_D","selection_roles":[{"role":"best","option_code":"SJT_TD_01_B"},{"role":"worst","option_code":"SJT_TD_01_D"}]},{"question_code":"SJT_TD_02","question_order":40,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_02_B","worst_option_code":"SJT_TD_02_D","selection_roles":[{"role":"best","option_code":"SJT_TD_02_B"},{"role":"worst","option_code":"SJT_TD_02_D"}]},{"question_code":"SJT_TD_03","question_order":41,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_03_B","worst_option_code":"SJT_TD_03_D","selection_roles":[{"role":"best","option_code":"SJT_TD_03_B"},{"role":"worst","option_code":"SJT_TD_03_D"}]},{"question_code":"SJT_TD_04","question_order":42,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_04_B","worst_option_code":"SJT_TD_04_D","selection_roles":[{"role":"best","option_code":"SJT_TD_04_B"},{"role":"worst","option_code":"SJT_TD_04_D"}]},{"question_code":"SJT_TD_05","question_order":43,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_05_B","worst_option_code":"SJT_TD_05_D","selection_roles":[{"role":"best","option_code":"SJT_TD_05_B"},{"role":"worst","option_code":"SJT_TD_05_D"}]},{"question_code":"SJT_TD_06","question_order":44,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_06_B","worst_option_code":"SJT_TD_06_D","selection_roles":[{"role":"best","option_code":"SJT_TD_06_B"},{"role":"worst","option_code":"SJT_TD_06_D"}]},{"question_code":"OUTCOME_1","question_order":45,"response_type":"likert_single","option_code":"OUTCOME_1_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_2","question_order":46,"response_type":"likert_single","option_code":"OUTCOME_2_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_3","question_order":47,"response_type":"likert_single","option_code":"OUTCOME_3_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_4","question_order":48,"response_type":"likert_single","option_code":"OUTCOME_4_OPTION_3","option_value":3,"selection_roles":[]}]},{"candidate_id":"GD-019","email":"ivan.bartulovic@partnerplus.ba","responses":[{"question_code":"TDM31_01","question_order":1,"response_type":"likert_single","option_code":"TDM31_01_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_02","question_order":2,"response_type":"likert_single","option_code":"TDM31_02_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_03","question_order":3,"response_type":"likert_single","option_code":"TDM31_03_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_04","question_order":4,"response_type":"likert_single","option_code":"TDM31_04_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_05","question_order":5,"response_type":"likert_single","option_code":"TDM31_05_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_06","question_order":6,"response_type":"likert_single","option_code":"TDM31_06_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_07","question_order":7,"response_type":"likert_single","option_code":"TDM31_07_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_08","question_order":8,"response_type":"likert_single","option_code":"TDM31_08_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_09","question_order":9,"response_type":"likert_single","option_code":"TDM31_09_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_10","question_order":10,"response_type":"likert_single","option_code":"TDM31_10_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_11","question_order":11,"response_type":"likert_single","option_code":"TDM31_11_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_12","question_order":12,"response_type":"likert_single","option_code":"TDM31_12_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_13","question_order":13,"response_type":"likert_single","option_code":"TDM31_13_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_14","question_order":14,"response_type":"likert_single","option_code":"TDM31_14_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_15","question_order":15,"response_type":"likert_single","option_code":"TDM31_15_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_16","question_order":16,"response_type":"likert_single","option_code":"TDM31_16_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_17","question_order":17,"response_type":"likert_single","option_code":"TDM31_17_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_18","question_order":18,"response_type":"likert_single","option_code":"TDM31_18_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_19","question_order":19,"response_type":"likert_single","option_code":"TDM31_19_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_20","question_order":20,"response_type":"likert_single","option_code":"TDM31_20_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_21","question_order":21,"response_type":"likert_single","option_code":"TDM31_21_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_22","question_order":22,"response_type":"likert_single","option_code":"TDM31_22_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_23","question_order":23,"response_type":"likert_single","option_code":"TDM31_23_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_24","question_order":24,"response_type":"likert_single","option_code":"TDM31_24_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_25","question_order":25,"response_type":"likert_single","option_code":"TDM31_25_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_26","question_order":26,"response_type":"likert_single","option_code":"TDM31_26_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_27","question_order":27,"response_type":"likert_single","option_code":"TDM31_27_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_28","question_order":28,"response_type":"likert_single","option_code":"TDM31_28_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_29","question_order":29,"response_type":"likert_single","option_code":"TDM31_29_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_30","question_order":30,"response_type":"likert_single","option_code":"TDM31_30_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TDM31_31","question_order":31,"response_type":"likert_single","option_code":"TDM31_31_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_1","question_order":32,"response_type":"likert_single","option_code":"TPSDP_1_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_2","question_order":33,"response_type":"likert_single","option_code":"TPSDP_2_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_3","question_order":34,"response_type":"likert_single","option_code":"TPSDP_3_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_4","question_order":35,"response_type":"likert_single","option_code":"TPSDP_4_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_5","question_order":36,"response_type":"likert_single","option_code":"TPSDP_5_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_6","question_order":37,"response_type":"likert_single","option_code":"TPSDP_6_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"TPSDP_7","question_order":38,"response_type":"likert_single","option_code":"TPSDP_7_OPTION_2","option_value":2,"selection_roles":[]},{"question_code":"SJT_TD_01","question_order":39,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_01_A","worst_option_code":"SJT_TD_01_D","selection_roles":[{"role":"best","option_code":"SJT_TD_01_A"},{"role":"worst","option_code":"SJT_TD_01_D"}]},{"question_code":"SJT_TD_02","question_order":40,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_02_A","worst_option_code":"SJT_TD_02_D","selection_roles":[{"role":"best","option_code":"SJT_TD_02_A"},{"role":"worst","option_code":"SJT_TD_02_D"}]},{"question_code":"SJT_TD_03","question_order":41,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_03_A","worst_option_code":"SJT_TD_03_D","selection_roles":[{"role":"best","option_code":"SJT_TD_03_A"},{"role":"worst","option_code":"SJT_TD_03_D"}]},{"question_code":"SJT_TD_04","question_order":42,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_04_A","worst_option_code":"SJT_TD_04_D","selection_roles":[{"role":"best","option_code":"SJT_TD_04_A"},{"role":"worst","option_code":"SJT_TD_04_D"}]},{"question_code":"SJT_TD_05","question_order":43,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_05_A","worst_option_code":"SJT_TD_05_D","selection_roles":[{"role":"best","option_code":"SJT_TD_05_A"},{"role":"worst","option_code":"SJT_TD_05_D"}]},{"question_code":"SJT_TD_06","question_order":44,"response_type":"sjt_best_worst","best_option_code":"SJT_TD_06_A","worst_option_code":"SJT_TD_06_D","selection_roles":[{"role":"best","option_code":"SJT_TD_06_A"},{"role":"worst","option_code":"SJT_TD_06_D"}]},{"question_code":"OUTCOME_1","question_order":45,"response_type":"likert_single","option_code":"OUTCOME_1_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_2","question_order":46,"response_type":"likert_single","option_code":"OUTCOME_2_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_3","question_order":47,"response_type":"likert_single","option_code":"OUTCOME_3_OPTION_3","option_value":3,"selection_roles":[]},{"question_code":"OUTCOME_4","question_order":48,"response_type":"likert_single","option_code":"OUTCOME_4_OPTION_3","option_value":3,"selection_roles":[]}]}]}
$gdt01_manifest$::jsonb;
  v_manifest_version constant text := 'gdt_01_team_dynamics_seed_manifest_v1';
  v_runtime_checksum constant text := '375a97663ed825ff2f8c09f3716d6a39bbea2722d5b45f4a61d60d2be210f48d';
  v_org_id uuid; v_team_id uuid; v_test_id uuid; v_assignment_id uuid;
  v_count integer; v_member record; v_attempt_id uuid; v_wrapper_id uuid;
  v_likert integer; v_sjt integer; v_wrapper_count integer; v_attempt_count integer;
  v_response_count integer; v_selection_count integer;
begin
  if p_payload is null
    or p_payload ->> 'schema_version' is distinct from 'gdt_01_team_dynamics_seed_payload_v1'
    or p_payload ? 'fixture_checksum'
    or p_payload ->> 'runtime_contract_checksum' is distinct from v_runtime_checksum
    or p_payload ->> 'organization_name' is distinct from 'Partner Plus d.o.o., Mikrokreditna organizacija'
    or p_payload ->> 'team_id' is distinct from 'GDT-01'
    or p_payload ->> 'team_name' is distinct from 'Kreditno poslovanje i rad s klijentima'
    or p_payload ->> 'package_slug' is distinct from 'team_dynamics_assessment_v1'
    or p_payload ->> 'locale' is distinct from 'bs'
    or p_payload #>> '{runtime,contract_identity}' is distinct from 'team_dynamics_assessment_v1'
    or p_payload #>> '{runtime,version}' is distinct from 'v1_content_spec'
    or p_payload #>> '{runtime,checksum}' is distinct from v_runtime_checksum
    or (p_payload #>> '{runtime,question_count}')::integer is distinct from 48
    or (p_payload #>> '{runtime,option_count}')::integer is distinct from 192 then
    raise exception 'GDT01_CONFLICT: canonical runtime identity mismatch';
  end if;

  if v_manifest ->> 'manifest_version' is distinct from v_manifest_version
    or v_manifest ->> 'runtime_contract_checksum' is distinct from v_runtime_checksum then
    raise exception 'GDT01_CONFLICT: server-owned manifest identity mismatch';
  end if;

  select count(*) into v_count
  from public.organizations
  where name = 'Partner Plus d.o.o., Mikrokreditna organizacija' and status = 'active';
  if v_count <> 1 then raise exception 'GDT01_CONFLICT: canonical organization must resolve exactly once'; end if;
  select id into v_org_id
  from public.organizations
  where name = 'Partner Plus d.o.o., Mikrokreditna organizacija' and status = 'active';

  select count(*) into v_count
  from public.teams
  where organization_id = v_org_id
    and name = 'Kreditno poslovanje i rad s klijentima'
    and archived_at is null;
  if v_count <> 1 then raise exception 'GDT01_CONFLICT: canonical GDT-01 team must resolve exactly once'; end if;
  select id into v_team_id
  from public.teams
  where organization_id = v_org_id
    and name = 'Kreditno poslovanje i rad s klijentima'
    and archived_at is null;

  -- Entity-scoped xact lock serializes only this resolved organization/team/package.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_org_id::text || ':' || v_team_id::text || ':team_dynamics_assessment_v1',
      0
    )
  );

  select count(*) into v_count
  from public.tests
  where slug = 'team_dynamics_assessment_v1'
    and status = 'active'
    and is_active = true
    and scoring_method = 'mixed_v1'
    and metadata ->> 'assessment_key' = 'team_dynamics_assessment_v1'
    and coalesce(metadata ->> 'version', metadata #>> '{content_spec,assessment,version}') = 'v1_content_spec';
  if v_count <> 1 then raise exception 'GDT01_CONFLICT: canonical active mixed_v1 test must resolve exactly once'; end if;
  select id into v_test_id
  from public.tests
  where slug = 'team_dynamics_assessment_v1'
    and status = 'active'
    and is_active = true
    and scoring_method = 'mixed_v1'
    and metadata ->> 'assessment_key' = 'team_dynamics_assessment_v1'
    and coalesce(metadata ->> 'version', metadata #>> '{content_spec,assessment,version}') = 'v1_content_spec';

  create temporary table gdt01_members (
    candidate_id text primary key,
    email text not null,
    participant_id uuid,
    membership_id uuid,
    attempt_id uuid,
    wrapper_id uuid
  ) on commit drop;

  insert into gdt01_members(candidate_id, email)
  select candidate_id, email
  from pg_catalog.jsonb_to_recordset(v_manifest -> 'members') as x(candidate_id text, email text);

  select count(*) into v_count from gdt01_members;
  if v_count <> 6
    or exists (
      select 1 from gdt01_members
      where candidate_id not in ('GD-001', 'GD-002', 'GD-003', 'GD-004', 'GD-005', 'GD-019')
    ) then
    raise exception 'GDT01_CONFLICT: server-owned manifest must contain exactly six canonical members';
  end if;

  -- Exact candidate_id -> canonical email -> participant -> active target membership mapping.
  update gdt01_members m
  set participant_id = p.id
  from public.participants p
  where p.organization_id = v_org_id
    and p.status = 'active'
    and lower(p.email) = lower(m.email);

  if (select count(*) from gdt01_members where participant_id is null) <> 0
    or (select count(distinct participant_id) from gdt01_members) <> 6
    or exists (
      select 1
      from gdt01_members m
      join public.participants p
        on p.organization_id = v_org_id
       and p.status = 'active'
       and lower(p.email) = lower(m.email)
      group by m.candidate_id
      having count(p.id) <> 1
    )
    or exists (
      select 1
      from gdt01_members m
      join public.participants p
        on p.id = m.participant_id
      where p.organization_id <> v_org_id or p.status <> 'active' or lower(p.email) <> lower(m.email)
    ) then
    raise exception 'GDT01_CONFLICT: canonical participants must resolve exactly once from server-owned identities';
  end if;

  update gdt01_members as target
  set membership_id = resolved.id
  from public.team_memberships as resolved
  where target.participant_id = resolved.participant_id
    and resolved.team_id = v_team_id
    and resolved.is_active = true
    and resolved.left_at is null;

  if (select count(*) from gdt01_members where membership_id is null) <> 0
    or (select count(*) from public.team_memberships tm join gdt01_members m on m.participant_id = tm.participant_id where tm.team_id = v_team_id and tm.is_active = true and tm.left_at is null) <> 6
    or exists (
      select 1
      from gdt01_members m
      join public.team_memberships tm
        on tm.team_id = v_team_id
       and tm.participant_id = m.participant_id
       and tm.is_active = true
       and tm.left_at is null
      group by m.candidate_id
      having count(tm.id) <> 1
    )
    or exists (
      select 1
      from gdt01_members m
      join public.team_memberships tm on tm.id = m.membership_id
      where tm.team_id <> v_team_id or tm.participant_id <> m.participant_id or not tm.is_active or tm.left_at is not null
    ) then
    raise exception 'GDT01_CONFLICT: canonical memberships must resolve exactly once on GDT-01';
  end if;

  create temporary table gdt01_answers (
    candidate_id text not null,
    question_code text not null,
    question_order integer not null,
    response_type text not null,
    option_code text,
    option_value text,
    best_option_code text,
    worst_option_code text,
    question_id uuid,
    option_id uuid,
    best_option_id uuid,
    worst_option_id uuid,
    primary key (candidate_id, question_code)
  ) on commit drop;

  insert into gdt01_answers(candidate_id, question_code, question_order, response_type, option_code, option_value, best_option_code, worst_option_code)
  select m.candidate_id, a.question_code, a.question_order, a.response_type, a.option_code, a.option_value, a.best_option_code, a.worst_option_code
  from pg_catalog.jsonb_to_recordset(v_manifest -> 'members') as m(candidate_id text, email text, responses jsonb)
  cross join lateral pg_catalog.jsonb_to_recordset(m.responses) as a(
    question_code text,
    question_order integer,
    response_type text,
    option_code text,
    option_value text,
    best_option_code text,
    worst_option_code text,
    selection_roles jsonb
  );

  select count(*) into v_count from gdt01_answers;
  if v_count <> 288
    or exists (select 1 from gdt01_answers group by candidate_id having count(*) <> 48) then
    raise exception 'GDT01_CONFLICT: server-owned manifest requires exactly 48 answers per member';
  end if;

  select count(*) filter (where response_type = 'likert_single'),
         count(*) filter (where response_type = 'sjt_best_worst')
  into v_likert, v_sjt
  from gdt01_answers;
  if v_likert <> 252 or v_sjt <> 36
    or exists (
      select 1 from gdt01_answers group by candidate_id
      having count(*) filter (where response_type = 'likert_single') <> 42
          or count(*) filter (where response_type = 'sjt_best_worst') <> 6
    ) then
    raise exception 'GDT01_CONFLICT: server-owned manifest Likert/SJT contract mismatch';
  end if;

  if (select count(*) from public.questions where test_id = v_test_id and is_active = true) <> 48
    or (select count(*) from public.answer_options o join public.questions q on q.id = o.question_id where q.test_id = v_test_id and q.is_active = true) <> 192 then
    raise exception 'GDT01_CONFLICT: runtime question/option count mismatch';
  end if;

  -- The runtime format is independently proven from question_type and mixed_v1 metadata.
  update gdt01_answers a
  set question_id = q.id
  from public.questions q
  where q.test_id = v_test_id
    and q.is_active = true
    and q.code = a.question_code
    and q.question_order = a.question_order
    and (
      (a.response_type = 'likert_single'
        and q.question_type = 'single_choice'
        and q.metadata ->> 'response_format' = 'single_select_likert')
      or
      (a.response_type = 'sjt_best_worst'
        and q.question_type = 'multiple_choice'
        and q.metadata ->> 'response_format' = 'best_worst')
    );

  if exists (select 1 from gdt01_answers where question_id is null)
    or (select count(distinct question_id) from gdt01_answers) <> 48 then
    raise exception 'GDT01_CONFLICT: manifest question code/order/format does not match canonical runtime';
  end if;

  update gdt01_answers a
  set option_id = o.id
  from public.answer_options o
  where a.response_type = 'likert_single'
    and o.question_id = a.question_id
    and o.code = a.option_code
    and o.value::text = a.option_value;

  update gdt01_answers a
  set best_option_id = o.id
  from public.answer_options o
  where a.response_type = 'sjt_best_worst'
    and o.question_id = a.question_id
    and o.code = a.best_option_code;

  update gdt01_answers a
  set worst_option_id = o.id
  from public.answer_options o
  where a.response_type = 'sjt_best_worst'
    and o.question_id = a.question_id
    and o.code = a.worst_option_code;

  if exists (
    select 1 from gdt01_answers
    where (response_type = 'likert_single' and option_id is null)
       or (response_type = 'sjt_best_worst' and (
         best_option_id is null or worst_option_id is null or best_option_id = worst_option_id
       ))
  ) then
    raise exception 'GDT01_CONFLICT: manifest option does not belong to its canonical question';
  end if;

  -- Canonical target-like lineage matches the seed inspector:
  -- (1) any assignment on GDT-01, including noncanonical packages;
  -- (2) canonical/legacy Team Dynamics assignments that wrap a canonical member;
  -- (3) canonical/legacy Team Dynamics attempts for a canonical member, including
  --     unwrapped attempts; and every response/selection downstream of those attempts.
  -- Other organizations, teams, packages and non-Team-Dynamics attempts are ignored.
  if exists (select 1 from public.team_assessment_assignments ta where ta.team_id = v_team_id)
    or exists (
      select 1
      from public.team_assessment_participants w
      join public.team_assessment_assignments ta on ta.id = w.team_assessment_assignment_id
      join gdt01_members m on m.participant_id = w.participant_id
      where ta.package_slug in ('team_dynamics_assessment_v1', 'team_dynamics_v1_strong')
    )
    or exists (
      select 1
      from public.attempts a
      join gdt01_members m on m.participant_id = a.participant_id
      join public.tests t on t.id = a.test_id
      where t.slug in ('team_dynamics_assessment_v1', 'team_dynamics_v1_strong')
    )
    or exists (
      select 1
      from public.responses r
      join public.attempts a on a.id = r.attempt_id
      join gdt01_members m on m.participant_id = a.participant_id
      join public.tests t on t.id = a.test_id
      where t.slug in ('team_dynamics_assessment_v1', 'team_dynamics_v1_strong')
    )
    or exists (
      select 1
      from public.response_selections s
      join public.responses r on r.id = s.response_id
      join public.attempts a on a.id = r.attempt_id
      join gdt01_members m on m.participant_id = a.participant_id
      join public.tests t on t.id = a.test_id
      where t.slug in ('team_dynamics_assessment_v1', 'team_dynamics_v1_strong')
    )
    or exists (
      select 1
      from public.team_assessment_participant_scores s
      join public.team_assessment_participants w on w.id = s.team_assessment_participant_id
      join public.team_assessment_assignments ta on ta.id = w.team_assessment_assignment_id
      where ta.team_id = v_team_id
    )
    or exists (
      select 1
      from public.team_assessment_aggregation_snapshots a
      join public.team_assessment_assignments ta on ta.id = a.team_assessment_assignment_id
      where ta.team_id = v_team_id
    )
    or exists (
      select 1
      from public.team_assessment_reports r
      join public.team_assessment_assignments ta on ta.id = r.team_assessment_assignment_id
      where ta.team_id = v_team_id
    )
    or exists (
      select 1
      from public.team_assessment_report_selection_drafts d
      join public.team_assessment_assignments ta on ta.id = d.team_assessment_assignment_id
      where ta.team_id = v_team_id
    )
    or exists (
      select 1
      from public.team_assessment_report_selection_members sm
      join public.team_assessment_report_selection_drafts d on d.id = sm.selection_draft_id
      join public.team_assessment_assignments ta on ta.id = d.team_assessment_assignment_id
      where ta.team_id = v_team_id
    )
    or exists (
      select 1
      from public.attempt_reports ar
      join public.attempts a on a.id = ar.attempt_id
      join gdt01_members m on m.participant_id = a.participant_id
      join public.tests t on t.id = a.test_id
      where t.slug in ('team_dynamics_assessment_v1', 'team_dynamics_v1_strong')
    )
    or exists (
      select 1
      from public.team_fit_reports tf
      join public.team_assessment_aggregation_snapshots ag on ag.id = tf.team_source_id
      join public.team_assessment_assignments ta on ta.id = ag.team_assessment_assignment_id
      where tf.organization_id = v_org_id
        and tf.team_id = v_team_id
        and ta.team_id = v_team_id
    ) then
    raise exception 'GDT01_NOT_EMPTY: canonical target persistence graph is not EMPTY';
  end if;

  insert into public.team_assessment_assignments(team_id, package_slug, status)
  values (v_team_id, 'team_dynamics_assessment_v1', 'active')
  returning id into v_assignment_id;

  for v_member in select * from gdt01_members order by candidate_id loop
    insert into public.attempts(user_id, test_id, status, organization_id, participant_id, locale, addressing_form_snapshot, metadata)
    values (null, v_test_id, 'in_progress', v_org_id, v_member.participant_id, 'bs', null, '{}'::jsonb)
    returning id into v_attempt_id;

    insert into public.team_assessment_participants(team_assessment_assignment_id, team_membership_id, participant_id, attempt_id, status, started_at, completed_at)
    values (v_assignment_id, v_member.membership_id, v_member.participant_id, v_attempt_id, 'invited', null, null)
    returning id into v_wrapper_id;

    update gdt01_members
    set attempt_id = v_attempt_id, wrapper_id = v_wrapper_id
    where candidate_id = v_member.candidate_id;
  end loop;

  insert into public.responses(attempt_id, question_id, answer_option_id, response_kind, raw_value, scored_value, text_value)
  select
    m.attempt_id,
    a.question_id,
    case when a.response_type = 'likert_single' then a.option_id else null end,
    case when a.response_type = 'likert_single' then 'single_choice' else 'best_worst' end,
    null,
    null,
    null
  from gdt01_answers a
  join gdt01_members m on m.candidate_id = a.candidate_id;

  insert into public.response_selections(response_id, question_id, answer_option_id, selection_role)
  select
    r.id,
    a.question_id,
    case role when 'best' then a.best_option_id else a.worst_option_id end,
    role
  from gdt01_answers a
  join gdt01_members m on m.candidate_id = a.candidate_id
  join public.responses r on r.attempt_id = m.attempt_id and r.question_id = a.question_id
  cross join lateral pg_catalog.unnest(array['best', 'worst']) role
  where a.response_type = 'sjt_best_worst';

  select count(*) into v_wrapper_count
  from public.team_assessment_participants
  where team_assessment_assignment_id = v_assignment_id;

  select count(*) into v_attempt_count
  from public.attempts
  where id in (select attempt_id from gdt01_members);

  select count(*) into v_response_count
  from public.responses
  where attempt_id in (select attempt_id from gdt01_members);

  select count(*) into v_selection_count
  from public.response_selections s
  join public.responses r on r.id = s.response_id
  where r.attempt_id in (select attempt_id from gdt01_members);

  if v_wrapper_count <> 6 or v_attempt_count <> 6
    or v_response_count <> 288 or v_selection_count <> 72 then
    raise exception 'GDT01_POSTCONDITION_FAILED: persisted graph row counts differ';
  end if;

  return pg_catalog.jsonb_build_object(
    'stateBefore', 'EMPTY',
    'stateAfter', 'EXACT_MATCH',
    'assignmentId', v_assignment_id,
    'assignmentCount', 1,
    'wrapperCount', v_wrapper_count,
    'attemptCount', v_attempt_count,
    'responseCount', v_response_count,
    'physicalSelectionCount', v_selection_count,
    'logicalSelectionCount', 324,
    'manifestVersion', v_manifest_version,
    'runtimeContractChecksum', v_runtime_checksum,
    'teamCode', 'GDT-01',
    'testSlug', 'team_dynamics_assessment_v1',
    'created', pg_catalog.jsonb_build_object(
      'assignments', 1,
      'wrappers', v_wrapper_count,
      'attempts', v_attempt_count,
      'responses', v_response_count,
      'responseSelections',72,
      'logicalSelections', 324
    )
  );
end;
$$;

revoke all on function public.create_gdt_01_team_dynamics_seed_v1(jsonb) from public;
revoke all on function public.create_gdt_01_team_dynamics_seed_v1(jsonb) from anon;
revoke all on function public.create_gdt_01_team_dynamics_seed_v1(jsonb) from authenticated;
grant execute on function public.create_gdt_01_team_dynamics_seed_v1(jsonb) to service_role;
