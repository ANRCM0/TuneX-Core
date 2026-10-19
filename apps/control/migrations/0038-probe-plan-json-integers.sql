-- MySQL may store an already-valid positive JSON expiry as UNSIGNED INTEGER.
ALTER TABLE probe_plans
 DROP CHECK probe_plans_chk_7,
 ADD CONSTRAINT probe_plan_expiry_json_integer CHECK(
  JSON_TYPE(JSON_EXTRACT(config,'$.expiresAt')) IN ('INTEGER','UNSIGNED INTEGER')
  AND JSON_EXTRACT(config,'$.expiresAt') IS NOT NULL
 );
