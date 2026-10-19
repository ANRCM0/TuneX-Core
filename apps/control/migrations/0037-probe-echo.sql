-- Echo extends the original bounded authority; no new execution owner or replay budget.
ALTER TABLE probe_permits MODIFY COLUMN measurement ENUM('tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1') NOT NULL DEFAULT 'tcp-connect-v1';
ALTER TABLE probe_permits ADD COLUMN echo_challenge JSON NULL;
ALTER TABLE probe_permits DROP CHECK probe_permit_tls_context;
ALTER TABLE probe_permits ADD CONSTRAINT probe_permit_service_context CHECK(
 (measurement IN ('tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1') AND tls_context IS NOT NULL AND JSON_TYPE(tls_context)='OBJECT' AND OCTET_LENGTH(tls_context)<=16384)
 OR (measurement NOT IN ('tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1') AND tls_context IS NULL));
ALTER TABLE probe_permits ADD CONSTRAINT probe_permit_echo_challenge CHECK(
 (measurement IN ('tcp-ingress-echo-v1','udp-ingress-echo-v1') AND echo_challenge IS NOT NULL AND JSON_TYPE(echo_challenge)='OBJECT' AND OCTET_LENGTH(echo_challenge)<=512)
 OR (measurement NOT IN ('tcp-ingress-echo-v1','udp-ingress-echo-v1') AND echo_challenge IS NULL));
ALTER TABLE probe_type_qualifications ADD COLUMN echo_version TINYINT UNSIGNED NULL DEFAULT NULL;
ALTER TABLE probe_type_qualifications ADD CONSTRAINT probe_qualification_echo_version CHECK(echo_version IS NULL OR (echo_version=1 AND services_version IS NOT NULL AND services_version=1 AND state<>'empty'));

ALTER TABLE probe_runs MODIFY COLUMN measurement ENUM('tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1') NOT NULL DEFAULT 'tcp-connect-v1';
ALTER TABLE probe_runs ADD COLUMN echo_challenge JSON NULL;
ALTER TABLE probe_runs ADD COLUMN result_echo JSON NULL;
ALTER TABLE probe_runs ADD COLUMN result_request_bytes SMALLINT UNSIGNED NULL;
ALTER TABLE probe_runs ADD COLUMN result_response_bytes SMALLINT UNSIGNED NULL;
ALTER TABLE probe_runs MODIFY COLUMN result_status ENUM('connected','unreachable','verified','unverified','echoed') NULL;
ALTER TABLE probe_runs MODIFY COLUMN result_code ENUM('tcp-connected','tcp-connect-failed','tls-handshake-verified','tls-handshake-failed','nonce-echo-verified','nonce-echo-rejected') NULL;
ALTER TABLE probe_runs DROP CHECK probe_run_result_classification;
ALTER TABLE probe_runs DROP CHECK probe_run_service_selection;
ALTER TABLE probe_runs DROP CHECK probe_run_result_tls;
ALTER TABLE probe_runs ADD CONSTRAINT probe_run_result_classification_v4 CHECK(result_status IS NULL OR
 (measurement IN ('tcp-connect-v1','tcp-ingress-connect-v1') AND ((result_status='connected' AND result_code='tcp-connected') OR (result_status='unreachable' AND result_code='tcp-connect-failed'))) OR
 (measurement='tcp-ingress-tls-v1' AND ((result_status='verified' AND result_code='tls-handshake-verified') OR (result_status='unverified' AND result_code='tls-handshake-failed') OR (result_status='unreachable' AND result_code='tcp-connect-failed'))) OR
 (measurement IN ('tcp-ingress-echo-v1','udp-ingress-echo-v1') AND ((result_status='echoed' AND result_code='nonce-echo-verified') OR (result_status='unverified' AND result_code='nonce-echo-rejected'))) OR
 (measurement='tcp-ingress-echo-v1' AND result_status='unreachable' AND result_code='tcp-connect-failed'));
ALTER TABLE probe_runs ADD CONSTRAINT probe_run_service_selection_v4 CHECK(
 (measurement IN ('tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1') AND service_selection IS NOT NULL AND JSON_TYPE(service_selection)='OBJECT' AND OCTET_LENGTH(service_selection)<=1024)
 OR (measurement NOT IN ('tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1') AND service_selection IS NULL));
ALTER TABLE probe_runs ADD CONSTRAINT probe_run_result_tls_v4 CHECK(
 (measurement='tcp-ingress-tls-v1' AND result_status IS NOT NULL AND result_status='verified' AND result_tls IS NOT NULL AND JSON_TYPE(result_tls)='OBJECT' AND OCTET_LENGTH(result_tls)<=512)
 OR ((result_status IS NULL OR result_status<>'verified' OR measurement<>'tcp-ingress-tls-v1') AND result_tls IS NULL));
ALTER TABLE probe_runs ADD CONSTRAINT probe_run_echo_challenge CHECK(
 (measurement IN ('tcp-ingress-echo-v1','udp-ingress-echo-v1') AND echo_challenge IS NOT NULL AND JSON_TYPE(echo_challenge)='OBJECT' AND OCTET_LENGTH(echo_challenge)<=512)
 OR (measurement NOT IN ('tcp-ingress-echo-v1','udp-ingress-echo-v1') AND echo_challenge IS NULL));
ALTER TABLE probe_runs ADD CONSTRAINT probe_run_echo_counts CHECK(
 ((measurement NOT IN ('tcp-ingress-echo-v1','udp-ingress-echo-v1') OR result_status IS NULL) AND result_request_bytes IS NULL AND result_response_bytes IS NULL)
 OR (measurement IN ('tcp-ingress-echo-v1','udp-ingress-echo-v1') AND result_status IS NOT NULL AND result_request_bytes IS NOT NULL AND result_response_bytes IS NOT NULL
 AND result_request_bytes BETWEEN 0 AND 256 AND result_response_bytes BETWEEN 0 AND 256
 AND ((result_status='echoed' AND result_request_bytes=256 AND result_response_bytes=256)
 OR (result_status='unverified' AND result_request_bytes=256)
 OR (measurement='tcp-ingress-echo-v1' AND result_status='unreachable' AND result_request_bytes=0 AND result_response_bytes=0))));
ALTER TABLE probe_runs ADD CONSTRAINT probe_run_result_echo CHECK(
 (measurement IN ('tcp-ingress-echo-v1','udp-ingress-echo-v1') AND result_status IS NOT NULL AND result_status='echoed' AND result_echo IS NOT NULL AND JSON_TYPE(result_echo)='OBJECT' AND OCTET_LENGTH(result_echo)<=512)
 OR ((measurement NOT IN ('tcp-ingress-echo-v1','udp-ingress-echo-v1') OR result_status IS NULL OR result_status<>'echoed') AND result_echo IS NULL));
