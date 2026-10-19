-- TLS observations share the original permit authority and bounded history.
ALTER TABLE probe_permits MODIFY COLUMN measurement ENUM('tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1') NOT NULL DEFAULT 'tcp-connect-v1';
ALTER TABLE probe_permits ADD COLUMN tls_context JSON NULL;
ALTER TABLE probe_permits ADD CONSTRAINT probe_permit_tls_context CHECK((measurement='tcp-ingress-tls-v1' AND tls_context IS NOT NULL AND JSON_TYPE(tls_context)='OBJECT' AND OCTET_LENGTH(tls_context)<=16384) OR (measurement<>'tcp-ingress-tls-v1' AND tls_context IS NULL));
ALTER TABLE probe_type_qualifications ADD COLUMN services_version TINYINT UNSIGNED NULL DEFAULT NULL;
ALTER TABLE probe_type_qualifications ADD CONSTRAINT probe_qualification_services_version CHECK(services_version IS NULL OR (services_version=1 AND state<>'empty'));
ALTER TABLE probe_runs MODIFY COLUMN measurement ENUM('tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1') NOT NULL DEFAULT 'tcp-connect-v1';
ALTER TABLE probe_runs ADD COLUMN service_selection JSON NULL;
ALTER TABLE probe_runs ADD COLUMN result_tls JSON NULL;
ALTER TABLE probe_runs MODIFY COLUMN result_status ENUM('connected','unreachable','verified','unverified') NULL;
ALTER TABLE probe_runs MODIFY COLUMN result_code ENUM('tcp-connected','tcp-connect-failed','tls-handshake-verified','tls-handshake-failed') NULL;
ALTER TABLE probe_runs DROP CHECK probe_runs_chk_18;
ALTER TABLE probe_runs ADD CONSTRAINT probe_run_result_classification CHECK(result_status IS NULL OR
 (measurement<>'tcp-ingress-tls-v1' AND ((result_status='connected' AND result_code='tcp-connected') OR (result_status='unreachable' AND result_code='tcp-connect-failed'))) OR
 (measurement='tcp-ingress-tls-v1' AND ((result_status='verified' AND result_code='tls-handshake-verified') OR
 (result_status='unverified' AND result_code='tls-handshake-failed') OR (result_status='unreachable' AND result_code='tcp-connect-failed'))));
ALTER TABLE probe_runs ADD CONSTRAINT probe_run_service_selection CHECK((measurement='tcp-ingress-tls-v1' AND service_selection IS NOT NULL AND JSON_TYPE(service_selection)='OBJECT' AND OCTET_LENGTH(service_selection)<=1024) OR (measurement<>'tcp-ingress-tls-v1' AND service_selection IS NULL));
ALTER TABLE probe_runs ADD CONSTRAINT probe_run_result_tls CHECK((measurement='tcp-ingress-tls-v1' AND result_status IS NOT NULL AND result_status='verified' AND result_tls IS NOT NULL AND JSON_TYPE(result_tls)='OBJECT' AND OCTET_LENGTH(result_tls)<=512) OR ((result_status IS NULL OR result_status<>'verified' OR measurement<>'tcp-ingress-tls-v1') AND result_tls IS NULL));
