import { deepFreeze, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeParseTime, nativeJsonEncoderBytes, nativeJsonClone,
    parseForwardTelemetryIdentity, parseProbeTelemetryIdentity, telemetryUint64 } from '../../compatibility/public.ts';
import type { NodeTelemetrySample, HostTelemetrySample, ForwardTelemetrySample, ForwardTelemetryPoint,
    ProbeTelemetrySample, ProbeTelemetryPoint } from '../../compatibility/public.ts';
import type { TelemetryObservation, TelemetrySeries, TelemetryFamily, TelemetryResolution, TelemetryRollupBucket, TelemetryMetricStats } from './rollup-contracts.ts';
import { TELEMETRY_ROLLUP_LIMITS } from './policy.ts';
export { TELEMETRY_ROLLUP_LIMITS } from './policy.ts';

const MAX_TIME = 253402300799999;
const MAX_SUM = 340282366920938463463374607431768211455n;
const gauges: Record<TelemetryFamily, readonly string[]> = {
    process: ['goroutines','heapAllocBytes','runtimeBytes','maxRssBytes','openFileDescriptors','tcpStreams','udpAssociations','drainingInstances','authorizationActive'],
    host: ['logicalProcessors','memoryTotalBytes','memoryAvailableBytes','filesystemTotalBytes','filesystemAvailableBytes','loadOneMilli','loadFiveMilli','loadFifteenMilli','networkAvailableInterfaces','networkReturnedInterfaces'],
    forward: [], probe: ['inFlight'],
};
const counters: Record<TelemetryFamily, readonly string[]> = {
    process: ['cpuTimeNanos'], host: ['totalTicks','idleTicks','ioWaitTicks'],
    forward: ['payloadSentBytes','payloadReceivedBytes','tcpAccepted','tcpConnected','tcpClosed','udpAssociationsCreated','udpAssociationsClosed','udpDatagramsSent','udpDatagramsReceived'],
    probe: ['attempted','succeeded','failed','unknown'],
};
function invalid(): never { throw new Error('INVALID_CONFIG: Invalid telemetry rollup'); }
function object(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input))) invalid();
    return input as Record<string, unknown>;
}
function closed(input: unknown, keys: readonly string[]): Record<string, unknown> {
    const value = object(input);
    if (Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) invalid();
    return value;
}
function integer(value: unknown, max = Number.MAX_SAFE_INTEGER, min = 0): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function wide(value: unknown): value is string {
    return typeof value === 'string' && !/\s/.test(value) && /^(0|[1-9][0-9]{0,38})$/.test(value) && BigInt(value) <= MAX_SUM;
}
function family(value: unknown): value is TelemetryFamily { return typeof value === 'string' && ['process','host','forward','probe'].includes(value); }
function epoch(value: unknown): value is string { return typeof value === 'string' && value.length === 32 && /^[a-f0-9]{32}$/.test(value); }
function metricMap(input: unknown, allowed: readonly string[]): Record<string,string> {
    const value = object(input);
    if (Object.keys(value).some(key => !allowed.includes(key) || !telemetryUint64(value[key]))) invalid();
    return { ...value } as Record<string,string>;
}
function parseSeries(input: unknown): TelemetrySeries {
    const value = closed(input, ['family','nodeId','bootId','sessionEpoch','sampleEpoch','counterEpoch','execution']);
    if (!family(value.family) || !isId(value.nodeId) || !isId(value.bootId) || !integer(value.sessionEpoch, Number.MAX_SAFE_INTEGER, 1) ||
        !epoch(value.sampleEpoch) || value.counterEpoch !== null && !epoch(value.counterEpoch)) invalid();
    let execution: TelemetrySeries['execution'] = null;
    if (value.family === 'forward') execution = parseForwardTelemetryIdentity(value.execution);
    else if (value.family === 'probe') execution = parseProbeTelemetryIdentity(value.execution);
    else if (value.execution !== null || value.counterEpoch !== null) invalid();
    if (execution) {
        const binding = 'binding' in execution ? execution.binding : execution;
        if (binding.nodeId !== value.nodeId || binding.bootId !== value.bootId || binding.sessionEpoch !== value.sessionEpoch) invalid();
    }
    return { ...value, execution } as unknown as TelemetrySeries;
}
function size(value: unknown, max: number): void { if (nativeJsonEncoderBytes(value) > max) invalid(); }
export function parseTelemetryObservation(input: unknown): TelemetryObservation {
    const value = closed(input, ['scopeId','nodeId','forwardId','family','seriesKey','series','sequence','uptimeMs','capturedAt','receivedAt','state','available','overflowed','counterContext','droppedSamples','tailsEvicted','tailsExpired','truncated','gauges','counters']);
    const series = parseSeries(value.series);
    if (!isId(value.scopeId) || value.nodeId !== series.nodeId || value.family !== series.family || value.seriesKey !== digest(series) ||
        !integer(value.sequence, Number.MAX_SAFE_INTEGER, 1) || !integer(value.uptimeMs) || !integer(value.capturedAt, MAX_TIME) || !integer(value.receivedAt, MAX_TIME) ||
        !['current','draining','terminal'].includes(value.state as string) || typeof value.available !== 'boolean' || typeof value.overflowed !== 'boolean' ||
        typeof value.truncated !== 'boolean' || !telemetryUint64(value.droppedSamples) || !telemetryUint64(value.tailsEvicted) || !telemetryUint64(value.tailsExpired)) invalid();
    const execution = series.execution;
    const forwardId = execution ? ('binding' in execution ? execution.binding.forwardId : execution.forwardId) : null;
    if (value.forwardId !== forwardId || typeof value.counterContext !== 'string' || /\s/.test(value.counterContext) ||
        (series.family === 'host' ? !/^(unavailable|[1-9][0-9]{0,4})$/.test(value.counterContext) || value.counterContext !== 'unavailable' && Number(value.counterContext) > 65536 : value.counterContext !== '')) invalid();
    const result = { ...value, series, gauges: metricMap(value.gauges, gauges[series.family]), counters: metricMap(value.counters, counters[series.family]) } as unknown as TelemetryObservation;
    if (!result.available && (Object.keys(result.gauges).length || Object.keys(result.counters).length)) invalid();
    if ((series.family === 'forward' || series.family === 'probe') && result.available !== (series.counterEpoch !== null)) invalid();
    if (result.gauges.authorizationActive !== undefined && !['0','1'].includes(result.gauges.authorizationActive)) invalid();
    if (series.family === 'process' && (!result.available || ['goroutines','heapAllocBytes','runtimeBytes','tcpStreams','udpAssociations','drainingInstances','authorizationActive'].some(key => result.gauges[key] === undefined))) invalid();
    if ((series.family === 'forward' || series.family === 'probe') && result.available && counters[series.family].some(key => result.counters[key] === undefined)) invalid();
    if (series.family === 'probe' && result.available && result.gauges.inFlight === undefined) invalid();
    if (series.family === 'probe' && result.available && !result.overflowed && BigInt(result.counters.attempted!) !==
        BigInt(result.counters.succeeded!) + BigInt(result.counters.failed!) + BigInt(result.counters.unknown!) + BigInt(result.gauges.inFlight!)) invalid();
    if (series.family === 'host') {
        const cpuPresent = Object.keys(result.counters).length > 0;
        if (cpuPresent ? counters.host.some(key => result.counters[key] === undefined) || result.counterContext !== result.gauges.logicalProcessors ||
            BigInt(result.counters.idleTicks!) + BigInt(result.counters.ioWaitTicks!) > BigInt(result.counters.totalTicks!) : result.counterContext !== 'unavailable' || result.gauges.logicalProcessors !== undefined) invalid();
        for (const [a,b] of [['memoryTotalBytes','memoryAvailableBytes'],['filesystemTotalBytes','filesystemAvailableBytes'],['networkAvailableInterfaces','networkReturnedInterfaces']] as const) {
            if ((result.gauges[a] === undefined) !== (result.gauges[b] === undefined) || result.gauges[a] !== undefined && BigInt(result.gauges[b]!) > BigInt(result.gauges[a]!)) invalid();
        }
        const loads = ['loadOneMilli','loadFiveMilli','loadFifteenMilli'].filter(key => result.gauges[key] !== undefined).length;
        if (loads !== 0 && loads !== 3 || result.available !== (Object.keys(result.gauges).length + Object.keys(result.counters).length > 0)) invalid();
    }
    size(result, TELEMETRY_ROLLUP_LIMITS.maxCursorBytes);
    return deepFreeze(result);
}
type Sample = Pick<NodeTelemetrySample, 'nodeId'|'bootId'|'sessionEpoch'|'sampleEpoch'|'sequence'|'uptimeMs'|'capturedAt'|'droppedSamples'>;
function base(scopeId: string, sample: Sample, receivedAt: number, kind: TelemetryFamily, execution: TelemetrySeries['execution'] = null, counterEpoch: string | null = null): TelemetryObservation {
    const series: TelemetrySeries = { family: kind, nodeId: sample.nodeId, bootId: sample.bootId, sessionEpoch: sample.sessionEpoch, sampleEpoch: sample.sampleEpoch, counterEpoch, execution };
    return { scopeId, nodeId: sample.nodeId, forwardId: execution ? ('binding' in execution ? execution.binding.forwardId : execution.forwardId) : null,
        family: kind, seriesKey: digest(series), series, sequence: sample.sequence, uptimeMs: sample.uptimeMs, capturedAt: nativeParseTime(sample.capturedAt), receivedAt,
        state: 'current', available: true, overflowed: false, counterContext: '', droppedSamples: sample.droppedSamples, tailsEvicted: '0', tailsExpired: '0', truncated: false, gauges: {}, counters: {} };
}
function put(target: Record<string,string>, key: string, value: string | number | null): void { if (value !== null) target[key] = String(value); }
export function processObservation(scopeId: string, sample: NodeTelemetrySample, receivedAt: number): TelemetryObservation {
    const result = base(scopeId, sample, receivedAt, 'process');
    for (const key of ['goroutines','heapAllocBytes','runtimeBytes','maxRssBytes','openFileDescriptors'] as const) put(result.gauges, key, sample.process[key]);
    for (const key of ['tcpStreams','udpAssociations','drainingInstances'] as const) put(result.gauges, key, sample.runtime[key]);
    result.gauges.authorizationActive = sample.runtime.authorizationActive ? '1' : '0';
    put(result.counters, 'cpuTimeNanos', sample.process.cpuTimeNanos);
    return parseTelemetryObservation(result);
}
export function hostObservation(scopeId: string, sample: HostTelemetrySample, receivedAt: number): TelemetryObservation {
    const result = base(scopeId, sample, receivedAt, 'host'), host = sample.host;
    result.counterContext = host.cpu.logicalProcessors === null ? 'unavailable' : String(host.cpu.logicalProcessors);
    put(result.gauges, 'logicalProcessors', host.cpu.logicalProcessors);
    put(result.counters, 'totalTicks', host.cpu.totalTicks); put(result.counters, 'idleTicks', host.cpu.idleTicks); put(result.counters, 'ioWaitTicks', host.cpu.ioWaitTicks);
    put(result.gauges, 'memoryTotalBytes', host.memory.totalBytes); put(result.gauges, 'memoryAvailableBytes', host.memory.availableBytes);
    put(result.gauges, 'filesystemTotalBytes', host.filesystem.totalBytes); put(result.gauges, 'filesystemAvailableBytes', host.filesystem.availableBytes);
    put(result.gauges, 'loadOneMilli', host.load.oneMilli); put(result.gauges, 'loadFiveMilli', host.load.fiveMilli); put(result.gauges, 'loadFifteenMilli', host.load.fifteenMilli);
    if (host.network.availability === 'available') { put(result.gauges, 'networkAvailableInterfaces', host.network.available); put(result.gauges, 'networkReturnedInterfaces', host.network.returned); }
    result.available = Object.keys(result.gauges).length + Object.keys(result.counters).length > 0;
    return parseTelemetryObservation(result);
}
export function forwardObservations(scopeId: string, sample: ForwardTelemetrySample, acceptedPoints: readonly ForwardTelemetryPoint[], receivedAt: number): TelemetryObservation[] {
    return deepFreeze(acceptedPoints.map(point => {
        const result = base(scopeId, sample, receivedAt, 'forward', point.identity, point.counterEpoch);
        Object.assign(result, { capturedAt: nativeParseTime(point.capturedAt), state: point.state, available: point.availability === 'available', overflowed: point.overflowed === true,
            truncated: sample.coverage.truncated, tailsEvicted: sample.coverage.tailsEvicted, tailsExpired: sample.coverage.tailsExpired });
        if (point.counters) result.counters = { ...point.counters };
        return parseTelemetryObservation(result);
    }));
}
export function probeObservations(scopeId: string, sample: ProbeTelemetrySample, acceptedPoints: readonly ProbeTelemetryPoint[], receivedAt: number): TelemetryObservation[] {
    return deepFreeze(acceptedPoints.map(point => {
        const result = base(scopeId, sample, receivedAt, 'probe', point.identity, point.counterEpoch);
        Object.assign(result, { capturedAt: nativeParseTime(point.capturedAt), state: point.state, available: point.availability === 'available', overflowed: point.overflowed === true,
            truncated: sample.coverage.truncated, tailsEvicted: sample.coverage.tailsEvicted, tailsExpired: sample.coverage.tailsExpired });
        if (point.counters) { result.gauges.inFlight = point.counters.inFlight; for (const key of counters.probe) result.counters[key] = point.counters[key as keyof typeof point.counters]; }
        return parseTelemetryObservation(result);
    }));
}
function statsMap(input: unknown, allowed: readonly string[], cumulative: boolean): Record<string, unknown> {
    const value = object(input), output: Record<string,unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
        if (!allowed.includes(key)) invalid();
        const stat = closed(raw, cumulative ? ['count','first','last','min','max'] : ['count','sum','min','max','elapsedMs']);
        if (!integer(stat.count, 1000000, 1) || !telemetryUint64(stat.min) || !telemetryUint64(stat.max) || BigInt(stat.min) > BigInt(stat.max)) invalid();
        if (cumulative) {
            if (!telemetryUint64(stat.first) || !telemetryUint64(stat.last) || [stat.first,stat.last].some(item => BigInt(item as string) < BigInt(stat.min as string) || BigInt(item as string) > BigInt(stat.max as string))) invalid();
        } else if (!wide(stat.sum) || !integer(stat.elapsedMs) || BigInt(stat.sum) < BigInt(stat.min) * BigInt(stat.count) || BigInt(stat.sum) > BigInt(stat.max) * BigInt(stat.count)) invalid();
        output[key] = { ...stat };
    }
    return output;
}
export function parseTelemetryRollupBucket(input: unknown): TelemetryRollupBucket {
    const value = closed(input, ['telemetryAggregateVersion','scopeId','nodeId','forwardId','family','seriesKey','series','resolution','start','end','sampleCount','receivedFrom','receivedTo','capturedFrom','capturedTo','quality','coverage','gauges','cumulative','increments']);
    const series = parseSeries(value.series), width = value.resolution === 'minute' ? 60000 : value.resolution === 'hour' ? 3600000 : invalid();
    const execution = series.execution, forwardId = execution ? ('binding' in execution ? execution.binding.forwardId : execution.forwardId) : null;
    if (value.telemetryAggregateVersion !== 1 || !isId(value.scopeId) || value.nodeId !== series.nodeId || value.family !== series.family || value.forwardId !== forwardId || value.seriesKey !== digest(series) ||
        !integer(value.start, MAX_TIME) || value.start % width !== 0 || value.end !== value.start + width || !integer(value.end, MAX_TIME) || !integer(value.sampleCount, 1000000, 1) ||
        !integer(value.receivedFrom, MAX_TIME) || !integer(value.receivedTo, MAX_TIME) || value.receivedFrom > value.receivedTo || value.receivedFrom < value.start || value.receivedTo >= (value.end as number) ||
        !integer(value.capturedFrom, MAX_TIME) || !integer(value.capturedTo, MAX_TIME) || value.capturedFrom > value.capturedTo) invalid();
    const quality = closed(value.quality, ['baseline','continuous','gap','counterReset','unavailable','overflowed','terminal','truncated','exporterDropsMax','tailsEvictedMax','tailsExpiredMax','historyComplete']);
    const primary = ['baseline','continuous','gap','counterReset','unavailable','overflowed','terminal'];
    if ([...primary,'truncated'].some(key => !integer(quality[key], value.sampleCount as number)) || primary.reduce((sum,key) => sum + (quality[key] as number), 0) !== value.sampleCount ||
        !telemetryUint64(quality.exporterDropsMax) || !telemetryUint64(quality.tailsEvictedMax) || !telemetryUint64(quality.tailsExpiredMax) || quality.historyComplete !== false) invalid();
    const coverage = closed(value.coverage, ['intervalCount','elapsedMs','from','to','boundaryIntervals','attribution']);
    if (!integer(coverage.intervalCount, quality.continuous as number) || !integer(coverage.elapsedMs) || !integer(coverage.boundaryIntervals, coverage.intervalCount as number) || coverage.attribution !== 'receipt-interval-end' ||
        (coverage.intervalCount === 0 ? coverage.from !== null || coverage.to !== null || coverage.elapsedMs !== 0 : coverage.elapsedMs === 0 || !integer(coverage.from, MAX_TIME) || !integer(coverage.to, MAX_TIME) || coverage.from > coverage.to || coverage.to < (value.receivedFrom as number) || coverage.to > (value.receivedTo as number))) invalid();
    const gaugeStats = statsMap(value.gauges, gauges[series.family], false), cumulative = statsMap(value.cumulative, counters[series.family], true), increments = statsMap(value.increments, counters[series.family], false);
    for (const stat of Object.values(gaugeStats)) if ((stat as TelemetryMetricStats).elapsedMs !== 0 || (stat as TelemetryMetricStats).count > (value.sampleCount as number)) invalid();
    for (const stat of Object.values(cumulative)) if ((stat as {count:number}).count > (value.sampleCount as number)) invalid();
    for (const [key,stat] of Object.entries(increments)) if ((stat as TelemetryMetricStats).count > (coverage.intervalCount as number) || (stat as TelemetryMetricStats).elapsedMs === 0 || (stat as TelemetryMetricStats).elapsedMs > (coverage.elapsedMs as number) || cumulative[key] === undefined) invalid();
    const result = { ...value, series, quality: { ...quality }, coverage: { ...coverage }, gauges: gaugeStats, cumulative, increments } as unknown as TelemetryRollupBucket;
    size(result, TELEMETRY_ROLLUP_LIMITS.maxBucketBytes);
    return deepFreeze(result);
}
function maximum(a: string, b: string): string { return BigInt(a) > BigInt(b) ? a : b; }
function addMetric(map: Record<string,TelemetryMetricStats>, key: string, value: string, elapsedMs: number): void {
    const old = map[key];
    map[key] = old ? { count: old.count + 1, sum: (BigInt(old.sum) + BigInt(value)).toString(), min: BigInt(old.min) < BigInt(value) ? old.min : value, max: maximum(old.max, value), elapsedMs: old.elapsedMs + elapsedMs } : { count: 1, sum: value, min: value, max: value, elapsedMs };
}
export function foldTelemetryRollup(existing: TelemetryRollupBucket | null, previous: TelemetryObservation | null, current: TelemetryObservation, resolution: TelemetryResolution): TelemetryRollupBucket {
    const observation = parseTelemetryObservation(current), before = previous === null ? null : parseTelemetryObservation(previous);
    const width = resolution === 'minute' ? 60000 : resolution === 'hour' ? 3600000 : invalid(), start = Math.floor(observation.receivedAt / width) * width;
    const parsed = existing === null ? null : parseTelemetryRollupBucket(existing);
    if (parsed && (parsed.scopeId !== observation.scopeId || parsed.seriesKey !== observation.seriesKey || parsed.start !== start || parsed.resolution !== resolution)) invalid();
    const bucket: TelemetryRollupBucket = parsed ? nativeJsonClone(parsed) : {
        telemetryAggregateVersion: 1, scopeId: observation.scopeId, nodeId: observation.nodeId, forwardId: observation.forwardId, family: observation.family, seriesKey: observation.seriesKey, series: observation.series,
        resolution, start, end: start + width, sampleCount: 0, receivedFrom: observation.receivedAt, receivedTo: observation.receivedAt, capturedFrom: observation.capturedAt, capturedTo: observation.capturedAt,
        quality: { baseline: 0, continuous: 0, gap: 0, counterReset: 0, unavailable: 0, overflowed: 0, terminal: 0, truncated: 0, exporterDropsMax: '0', tailsEvictedMax: '0', tailsExpiredMax: '0', historyComplete: false },
        coverage: { intervalCount: 0, elapsedMs: 0, from: null, to: null, boundaryIntervals: 0, attribution: 'receipt-interval-end' }, gauges: {}, cumulative: {}, increments: {},
    };
    bucket.sampleCount++; bucket.receivedFrom = Math.min(bucket.receivedFrom, observation.receivedAt); bucket.receivedTo = Math.max(bucket.receivedTo, observation.receivedAt);
    bucket.capturedFrom = Math.min(bucket.capturedFrom, observation.capturedAt); bucket.capturedTo = Math.max(bucket.capturedTo, observation.capturedAt);
    bucket.quality.truncated += Number(observation.truncated); bucket.quality.exporterDropsMax = maximum(bucket.quality.exporterDropsMax, observation.droppedSamples);
    bucket.quality.tailsEvictedMax = maximum(bucket.quality.tailsEvictedMax, observation.tailsEvicted); bucket.quality.tailsExpiredMax = maximum(bucket.quality.tailsExpiredMax, observation.tailsExpired);
    let quality: 'baseline'|'continuous'|'gap'|'counterReset'|'unavailable'|'overflowed'|'terminal' = 'baseline';
    if (!observation.available) quality = 'unavailable';
    else if (observation.overflowed) quality = 'overflowed';
    else if (observation.state === 'terminal') quality = 'terminal';
    else if (before) {
        const sameSeries = before.scopeId === observation.scopeId && before.seriesKey === observation.seriesKey;
        const regressed = sameSeries && (observation.sequence <= before.sequence || observation.uptimeMs < before.uptimeMs ||
            BigInt(observation.droppedSamples) < BigInt(before.droppedSamples) || BigInt(observation.tailsEvicted) < BigInt(before.tailsEvicted) ||
            BigInt(observation.tailsExpired) < BigInt(before.tailsExpired));
        quality = regressed ? 'counterReset' : sameSeries && before.sequence + 1 === observation.sequence &&
            observation.uptimeMs > before.uptimeMs && observation.receivedAt >= before.receivedAt && before.available && !before.overflowed && before.state !== 'terminal' &&
            !before.truncated && !observation.truncated && before.droppedSamples === observation.droppedSamples && before.tailsEvicted === observation.tailsEvicted && before.tailsExpired === observation.tailsExpired ? 'continuous' : 'gap';
    }
    const deltas: Record<string,string> = {};
    if (quality === 'continuous' && before) {
        for (const [key, value] of Object.entries(observation.counters)) {
            if (observation.family === 'host' && before.counterContext !== observation.counterContext) continue;
            if (before.counters[key] === undefined) continue;
            const delta = BigInt(value) - BigInt(before.counters[key]!);
            if (delta < 0n) { quality = 'counterReset'; break; }
            deltas[key] = delta.toString();
        }
        if (observation.family === 'host') {
            const cpuMissing = before.counterContext !== observation.counterContext || observation.counterContext === 'unavailable' ||
                deltas.totalTicks === undefined || deltas.idleTicks === undefined || deltas.ioWaitTicks === undefined;
            if (cpuMissing) { for (const key of Object.keys(deltas)) delete deltas[key]; }
            else if (BigInt(deltas.totalTicks!) <= 0n || BigInt(deltas.idleTicks!) + BigInt(deltas.ioWaitTicks!) > BigInt(deltas.totalTicks!)) quality = 'counterReset';
        }
    }
    bucket.quality[quality]++;
    if (observation.available && !observation.overflowed) {
        for (const [key,value] of Object.entries(observation.gauges)) addMetric(bucket.gauges, key, value, 0);
        for (const [key,value] of Object.entries(observation.counters)) {
            const old = bucket.cumulative[key];
            bucket.cumulative[key] = old ? { count: old.count + 1, first: old.first, last: value, min: BigInt(old.min) < BigInt(value) ? old.min : value, max: maximum(old.max, value) } : { count: 1, first: value, last: value, min: value, max: value };
        }
    }
    if (quality === 'continuous' && before && Object.keys(deltas).length > 0) {
        const elapsed = observation.uptimeMs - before.uptimeMs;
        bucket.coverage.intervalCount++; bucket.coverage.elapsedMs += elapsed; bucket.coverage.from = Math.min(bucket.coverage.from ?? before.receivedAt, before.receivedAt);
        bucket.coverage.to = Math.max(bucket.coverage.to ?? observation.receivedAt, observation.receivedAt); bucket.coverage.boundaryIntervals += Number(before.receivedAt < start);
        for (const [key,value] of Object.entries(deltas)) addMetric(bucket.increments, key, value, elapsed);
    }
    return parseTelemetryRollupBucket(bucket);
}
