import { validScope, parsePorts, parseCidrs, directCapable, allowedProtocols, directSpec, stateTone, pageCount, listResource, candidateChoices } from './model.js';
import { createConsoleRequests } from './console-request-owner/public.js';
import { browserConsoleRequestEffects, mountControlConsole } from './browser-native/public.js';
import { initRelayConsole } from './relay.js';
import { initProbeConsole } from './probe.js';
import { initProbeRuns } from './probe-runs.js';
import { initProbePlans } from './probe-plans.js';
import { initTransportConsole } from './transport-console.js';
import { initRuleConsole } from './rule-console.js';
import { initTunnelConsole } from './tunnel-console.js';
import { initTelemetryConsole } from './telemetry-console.js';
import { initForwardTelemetryConsole } from './forward-telemetry-console.js';
import { initHostTelemetryConsole } from './host-telemetry-console.js';
import { initProbeTelemetryConsole } from './probe-telemetry-console.js';
import { initTelemetryAggregateConsole } from './telemetry-aggregate-console.js';
import { initPathTemplates, initPathSwitch } from './path-templates.js';
import { initPathGroups } from './path-groups.js';
import { initPathPublications } from './path-publications.js';
import { initIngressGroups } from './ingress-groups.js';
import { initIngressMigrations } from './ingress-migrations.js';
import { initForwardDiagnostics } from './forward-diagnostics.js';
import { initAuditConsole } from './audit-console.js';
import { initStationAlerts } from './station-alerts.js';
import { initNotificationEndpoints } from './notification-endpoints.js';
import { initNotificationDeliveries } from './notification-deliveries.js';
import { initObservationServices } from './observation-services.js';

mountControlConsole({
  validScope, parsePorts, parseCidrs, directCapable, allowedProtocols, directSpec, stateTone, pageCount, listResource, candidateChoices,
  createRequests: state => createConsoleRequests(state, browserConsoleRequestEffects),
  initRelayConsole, initProbeConsole, initProbeRuns, initProbePlans, initTransportConsole, initRuleConsole, initTunnelConsole,
  initTelemetryConsole, initForwardTelemetryConsole, initHostTelemetryConsole, initProbeTelemetryConsole,
  initTelemetryAggregateConsole, initPathTemplates, initPathSwitch, initPathGroups, initPathPublications, initIngressGroups,
  initIngressMigrations, initForwardDiagnostics, initAuditConsole, initStationAlerts, initNotificationEndpoints,
  initNotificationDeliveries, initObservationServices,
});
