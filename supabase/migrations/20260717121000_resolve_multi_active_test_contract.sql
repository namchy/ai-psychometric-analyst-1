-- Different versioned assessment slugs may be production-active together; the
-- standard battery requires IPIP, SAFRAN, and MWMS concurrently. Slug uniqueness
-- and the existing status/is_active consistency check remain the invariants.
drop index if exists public.tests_one_active_test_idx;
