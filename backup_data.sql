SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict P5iPt6S66BkCwptgN6XUHcr357YYZYIf6dAyRx1bZoKPJc4otdY1igS1jP9Ujbe

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: keepalive; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."keepalive" ("id", "pinged_at") VALUES
	(1, '2026-03-15 12:54:05.238+00'),
	(2, '2026-03-15 12:58:34.336+00'),
	(3, '2026-03-15 13:52:25.378+00'),
	(4, '2026-03-15 19:37:01.263+00'),
	(5, '2026-03-16 01:18:49.052+00'),
	(6, '2026-03-16 07:10:07.737+00'),
	(7, '2026-03-16 13:52:25.459+00'),
	(8, '2026-03-16 19:37:01.368+00'),
	(9, '2026-03-17 01:18:48.466+00'),
	(10, '2026-03-17 07:10:07.293+00'),
	(11, '2026-03-17 13:52:25.251+00'),
	(12, '2026-03-17 19:37:05.702+00'),
	(13, '2026-03-18 01:18:48.348+00'),
	(14, '2026-03-18 07:10:07.391+00'),
	(15, '2026-03-18 13:52:26.838+00'),
	(16, '2026-03-18 19:37:01.375+00'),
	(17, '2026-03-19 01:18:48.264+00'),
	(18, '2026-03-19 07:10:07.36+00'),
	(19, '2026-03-19 13:52:25.399+00'),
	(20, '2026-03-19 19:37:01.607+00'),
	(21, '2026-03-20 01:18:50.469+00'),
	(22, '2026-03-20 07:10:07.53+00');


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 1, false);


--
-- Name: keepalive_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."keepalive_id_seq"', 22, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict P5iPt6S66BkCwptgN6XUHcr357YYZYIf6dAyRx1bZoKPJc4otdY1igS1jP9Ujbe

RESET ALL;
