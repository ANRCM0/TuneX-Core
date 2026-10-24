const guidance = Object.freeze({
  INVALID_OPTIONS: 'Select one role (control or agent) and one phase (initial or existing).',
  INVALID_CLOCK: 'Check the host clock before comparing certificate validity.',
  HOST_PERMISSIONS_UNCHECKED: 'Run the same preflight on the Linux host that will mount these directories.',
  UNSAFE_PERMISSIONS: 'Remove group/world write access after reviewing the intended service ownership.',
  SERVICE_ACCESS_DENIED: 'Give service UID/GID 10001 the required directory traversal, read and state-write access.',
  PRIVATE_FILE_PERMISSIONS: 'Protect private files with service ownership and owner-only access; do not print their contents.',
  ABSOLUTE_DIRECTORY_REQUIRED: 'Set the role-specific directory variables to existing absolute paths.',
  REAL_DIRECTORY_REQUIRED: 'Use actual directories; review symlinks rather than following or replacing them automatically.',
  DIRECTORY_UNAVAILABLE: 'Check the configured directory and parent traversal permissions on the deployment host.',
  DIRECTORY_OVERLAP: 'Use disjoint state and trust/secret directories; preserve existing state and keys.',
  UNSAFE_FILE_PATH: 'Review the configured mount and remove unintended symlink traversal without replacing protected state.',
  REGULAR_FILE_REQUIRED: 'Mount the expected regular file; do not substitute a directory or symlink.',
  INVALID_FILE_SIZE: 'Restore the correct bounded file from the original provisioning or recovery process.',
  FILE_CHANGED: 'Stop concurrent file replacement and inspect again while the configuration is stable.',
  FILE_UNAVAILABLE: 'Check the expected role-specific files and service read permission; preserve any existing identity.',
  CERTIFICATE_PURPOSE: 'Use the original CA and a leaf certificate with the correct server/client extended key usage.',
  CERTIFICATE_EXPIRED_OR_NOT_YET_VALID: 'Check time synchronization and rotate through the original credential process.',
  CERTIFICATE_INVALID: 'Supply the intended PEM certificate, without printing private material.',
  PRIVATE_KEY_MISMATCH: 'Restore the matching certificate/key pair; do not replace the CA or re-enroll to hide a mismatch.',
  PRIVATE_KEY_INVALID: 'Provide the original service-readable private key in its supported format.',
  CERTIFICATE_TRUST_MISMATCH: 'Confirm both sides use the intended CA; never disable certificate verification.',
  CONTROL_URL_CONFLICT: 'Make the explicit Control URL and service configuration refer to the same HTTPS origin.',
  CONTROL_URL_INVALID: 'Set an HTTPS Control origin without embedded credentials, a path, query or fragment.',
  IMMUTABLE_IMAGE_REQUIRED: 'Choose a published registry image@sha256 digest and record the corresponding source revision.',
  INITIAL_STATE_NOT_EMPTY: 'Use the existing-service/recovery flow; never empty a retained directory to pass initial setup.',
  DATABASE_URL_INVALID: 'Configure the protected MySQL connection with an explicit database; check connectivity separately.',
  INITIALIZATION_FLAG_RETAINED: 'Remove the initialization flag from steady service configuration; use it only in an explicit first start.',
  CONTROL_SAN_MISMATCH: 'Use the actual Control hostname/IP present in the server certificate SAN or provision a matching certificate.',
  PROTECTION_KEY_INVALID: 'Recover the original independent 32-byte protection key; do not generate a replacement over retained history.',
  NODE_ID_INVALID: 'Use the exact registered Node ID from the original private/shared provisioning command.',
  NODE_IDENTITY_MISMATCH: 'Check the Node ID and original state mount; do not reuse another machine identity.',
  INITIAL_SECRETS_NOT_EMPTY: 'Review the existing identity and use the existing-service flow; initial enrollment must not overwrite keys.',
  REMOTE_TLS_UNCHECKED: 'Verify the real Control HTTPS/mTLS connection using the original Agent and trusted CA.',
  PROTECTED_STATE_UNCHECKED: 'Let the original service authenticate its authority/Journal and enforce retained high-water state.',
  CLOCK_SYNC_UNCHECKED: 'Verify system time synchronization on every real host; local certificate time checks do not prove synchronization.',
  MOUNTS_UNCHECKED: 'Inspect actual mount flags, ACLs, security labels and UID mappings on the deployment host.',
  NETWORK_UNCHECKED: 'Verify database access, the authenticated Agent session and real TCP/UDP traffic as separate acceptance steps.',
});

const compose = role => `docker compose --env-file /secure/${role}.env -f deploy/compose.${role}.example.yaml`;
const stage = (id, title, instructions, commands = []) => ({ id, title, instructions, commands });

function review(report) {
  if (!report || report.version !== 1 || report.scope !== 'local-static' || report.runtimeReady !== false ||
      !['control', 'agent'].includes(report.role) || !['initial', 'existing'].includes(report.phase) ||
      !['passed', 'rejected', 'incomplete'].includes(report.status) ||
      !Array.isArray(report.checks) || report.checks.length < 1 || report.checks.length > 128)
    throw new Error('INVALID_PREFLIGHT_REPORT');
  for (const check of report.checks) {
    if (!check || !['passed', 'failed', 'not-checked'].includes(check.status) ||
        typeof check.required !== 'boolean' || typeof check.code !== 'string')
      throw new Error('INVALID_PREFLIGHT_REPORT');
  }
  const status = report.checks.some(check => check.status === 'failed') ? 'rejected' :
    report.checks.some(check => check.required && check.status === 'not-checked') ? 'incomplete' : 'passed';
  if (status !== report.status) throw new Error('INVALID_PREFLIGHT_REPORT');
  return status;
}

export function deploymentSetupPlan(report) {
  const status = review(report);
  const { role, phase } = report;
  const setup = compose(role);
  const steps = [stage('prepare', 'Prepare the protected role configuration', [
    'Use the role Compose template and replace /secure/role.env, IDs and public URL placeholders before manual execution.',
    'Keep tokens, database passwords, private keys and protection keys out of this plan and command arguments.',
    'Review actual Control bind/firewall access and preserve end-to-end TLS for remote Agents.',
  ]), stage('preflight', 'Resolve local static preflight findings', [
    'Resolve failed and required unchecked findings before proceeding.',
    'A passed static preflight does not establish database freshness, remote TLS, authenticated state or business reachability.',
  ], [`node --env-file=/secure/${role}.env deploy/preflight.mjs --role ${role} --phase ${phase} --json`])];
  if (phase === 'existing') {
    steps.push(stage('retain', 'Retain and assess the existing deployment', [
      'Back up the database, original authority/Journal, PKI and independent keys using the existing maintenance procedure.',
      'Review the upgrade assessment with the actual source/target profiles; do not initialize or enroll again.',
      'Resolve blocked or review-required assessment results before changing the running version.',
    ], ['npm run ops -- assess-upgrade /secure/tunex/upgrade-plan.json']));
  } else if (role === 'control') {
    steps.push(stage('bootstrap', 'Create the first workspace owner', [
      'Confirm an intentionally fresh database; empty local directories do not prove database freshness.',
      'Supply the owner token through the interactive environment, then run the original bootstrap once.',
      'If the response is uncertain, inspect the original result before attempting another bootstrap.',
    ], ["read -r -s -p 'Owner Token: ' TUNEX_OWNER_TOKEN; echo", 'export TUNEX_OWNER_TOKEN',
      `${setup} run --rm --no-deps -e TUNEX_OWNER_TOKEN control node apps/control/src/bootstrap.ts WORKSPACE_ID OWNER_ID`,
      'unset TUNEX_OWNER_TOKEN']));
    steps.push(stage('initialize', 'Perform the explicit first authority start', [
      'Use the original fresh-deployment start only after successful bootstrap and local checks.',
      'After the intended first start, stop this foreground instance before starting the steady service.',
      'Never retain initialization in the steady environment or use it against retained authority state.',
    ], [`${setup} run --rm --no-deps --service-ports -e TUNEX_AUTHORITY_INITIALIZE=1 control`]));
  } else {
    steps.push(stage('register', 'Register the intended private or shared machine', [
      'Create a private Node in My machines, or let the workspace owner create an administrator-shared Node.',
      'Record its exact Node ID and one-time enrollment expiry; shared use still needs an explicit grant.',
      'Set the public Control URL and registered Node ID in the protected Agent environment.',
    ]));
    steps.push(stage('enroll', 'Enroll once with the original Agent', [
      'Use the trusted Control CA and the prepared empty state; review all public URL/Node placeholders.',
      'Pass the enrollment token only through the interactive environment; never put it in the service file.',
      'After an uncertain result inspect the original state and Node before retrying; never erase history.',
    ], ["read -r -s -p 'Enrollment Token: ' TUNEX_ENROLLMENT_TOKEN; echo", 'export TUNEX_ENROLLMENT_TOKEN',
      `${setup} run --rm --no-deps -e TUNEX_ENROLLMENT_TOKEN agent --enroll --control 'https://CONTROL_HOST:41001' --node 'NODE_ID' --ca /run/tunex-agent-secrets/control-ca.pem --state /var/lib/tunex-agent --journal-key /run/tunex-agent-secrets/journal.key`,
      'unset TUNEX_ENROLLMENT_TOKEN']));
  }
  steps.push(stage('start', 'Start the steady service with retained identity', [
    'Use the same protected mounts; configure only the explicitly needed Relay, multi-hop, Probe and telemetry options.',
    'Keep the original restart, lease, authority and Journal behavior. The plan does not start a service.',
  ], [`${setup} up -d ${role}`]));
  steps.push(stage('session', 'Confirm actual authenticated service observations', role === 'control' ? [
    'Open the real HTTPS /console with the trusted CA, log in and select the intended workspace.',
    'Verify database-backed operations and an enrolled Agent session independently of container socket liveness.',
  ] : [
    'Read the intended Node session and fresh report from Control; inspect the original Agent diagnostics on failure.',
    'Distinguish registration, current authorization, applied configuration and actual listener readiness.',
  ]));
  steps.push(stage('traffic', 'Verify the first real forwarding rule', [
    'Create an authorized Direct TCP/UDP rule to a deliberately controlled target, then observe its original Operation and applied reports.',
    'Send real traffic from the intended client position and record the source revision, hosts, protocols and results.',
    'Relay/multi-hop and external reachability require their own enabled capabilities and real topology acceptance.',
  ]));
  const findings = report.checks.filter(check => check.status !== 'passed').map(check => ({
    code: Object.hasOwn(guidance, check.code) ? check.code : 'UNKNOWN_PREFLIGHT_CHECK',
    status: check.status, required: check.required,
    advice: Object.hasOwn(guidance, check.code) ? guidance[check.code] :
      'An unrecognized preflight check needs a reviewed tooling update; no raw diagnostic text is exported.',
  }));
  return {
    setupVersion: 1, role, phase, scope: 'local-static-plan', localStatus: status,
    manualOnly: true, executed: false, runtimeReady: false, executionAuthorized: false,
    findings, steps: steps.map(step => ({ ...step,
      status: step.id === 'preflight' ? status : status === 'passed' ? 'manual-action-required' : 'blocked-by-preflight',
    })),
  };
}
