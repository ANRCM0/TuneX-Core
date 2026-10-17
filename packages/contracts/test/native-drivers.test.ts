import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NATIVE_DRIVER_CATALOG, NATIVE_DRIVER_CATALOG_DIGEST, parseNativeDriverCatalog, digest, parseRuntimeMessage } from '../src/index.ts';

test('native catalog is immutable, versioned, and distinguishes business from physical carrier protocols', () => {
    const catalog = parseNativeDriverCatalog(JSON.stringify(NATIVE_DRIVER_CATALOG));
    assert.equal(digest(catalog), NATIVE_DRIVER_CATALOG_DIGEST);
    assert.deepEqual(catalog.drivers.map(d => d.id), ['native.direct.v1', 'native.relay.v1', 'native.multihop.v1']);
    assert.ok(Object.isFrozen(catalog)); assert.ok(Object.isFrozen(catalog.drivers[0]!.carrierByProtocol));
    assert.equal(catalog.drivers[0]!.carrierByProtocol.udp, 'udp');
    assert.ok(catalog.drivers.slice(1).every(d => d.carrierByProtocol.udp === 'tcp' && d.security === 'mutual-tls13'));
    assert.ok(catalog.drivers.every(d => d.usage === 'not-reported' && d.privileges.networkAdmin === false));
    assert.equal(catalog.drivers[2]!.controlGate, 'multihop');
    assert.throws(() => parseRuntimeMessage('HelloRequest', JSON.stringify(catalog)), /INVALID_CONFIG/);
});

test('catalog parser refuses new drivers, executable fields, duplicate keys, versions and unbounded metadata', () => {
    for (const modify of [
        (v: any) => { v.version = 2; }, (v: any) => { v.executionEnabled = true; }, (v: any) => { v.drivers.push(v.drivers[0]); },
        (v: any) => { v.drivers[0].id = 'external.shell'; }, (v: any) => { v.drivers[1] = v.drivers[0]; },
        (v: any) => { v.drivers[0].command = 'arbitrary'; }, (v: any) => { v.drivers[0].privileges.networkAdmin = true; },
        (v: any) => { v.drivers[0].roles = []; }, (v: any) => { v.drivers[0].businessProtocols = ['tcp', 'tcp']; },
        (v: any) => { v.drivers[0].agentFlags = ['--exec']; }, (v: any) => { v.drivers[0].usage = 'billing-authoritative'; },
        (v: any) => { v.drivers[0].requiredCapabilities = ['native.direct.v1']; },
    ]) {
        const value = structuredClone(NATIVE_DRIVER_CATALOG); modify(value);
        assert.throws(() => parseNativeDriverCatalog(JSON.stringify(value)));
    }
    assert.throws(() => parseNativeDriverCatalog('{"version":1,"version":1,"drivers":[]}'));
});
