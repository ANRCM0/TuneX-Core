import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNotificationDestinationUrl } from '../src/compatibility/public.ts';
import { parseNotificationDestinationUrl as legacy } from '../src/application/notification-destination.ts';
import { ControlError } from '../src/framework/public.ts';

test('notification destinations share the native parser and return canonical HTTPS without credentials or query', () => {
    assert.equal(legacy, parseNotificationDestinationUrl);
    assert.deepEqual(legacy('https://Notify.TuneX.org:443/a/../hook'),
        { url: 'https://notify.tunex.org/hook', hostname: 'notify.tunex.org', path: '/hook' });
    assert.deepEqual(legacy('https://notify.tunex.org'),
        { url: 'https://notify.tunex.org/', hostname: 'notify.tunex.org', path: '/' });
    const escaped = legacy('https://notify.tunex.org/events/%E4%BD%A0');
    assert.equal(escaped.path, '/events/%E4%BD%A0');
});

test('notification destination rejects alternate trust/address channels with the original public error', () => {
    const denied: unknown[] = [null, 42, {},
        'http://notify.tunex.org/', 'HTTPS://notify.tunex.org/', 'https://notify.tunex.org:444/',
        'https://user:secret@notify.tunex.org/', 'https://@notify.tunex.org/',
        'https://notify.tunex.org/?', 'https://notify.tunex.org/#', 'https://notify.tunex.org/?token=secret',
        'https://notify.tunex.org/\\hook', 'https://notify.tunex.org/\nhook', 'https://notify.tunex.org/你',
        'https://127.0.0.1/', 'https://2130706433/', 'https://0x7f000001/', 'https://[::1]/',
        'https://localhost/', 'https://node.local/', 'https://node.internal/', 'https://node.home/',
        'https://node.lan/', 'https://node.test/', 'https://node.invalid/', 'https://node.example/',
        'https://node.onion/', 'https://node.arpa/', 'https://notify.tunex.org./',
        'https://bad_label.tunex.org/', 'https://-bad.tunex.org/', 'https://bad-.tunex.org/',
        'https://notify.123/', `https://${'a'.repeat(64)}.org/`,
    ];
    for (const input of denied) assert.throws(() => parseNotificationDestinationUrl(input as string), error => {
        assert.ok(error instanceof ControlError);
        assert.deepEqual([error.code, error.status, error.message],
            ['INVALID_CONFIG', 422, 'Controlled public HTTPS destination required']);
        return true;
    }, String(input));
});

test('notification destination bounds both supplied and canonical URL bytes', () => {
    const prefix = 'https://notify.tunex.org/';
    assert.equal(legacy(prefix + 'a'.repeat(2048 - prefix.length)).url.length, 2048);
    assert.throws(() => legacy(prefix + 'a'.repeat(2049 - prefix.length)), { code: 'INVALID_CONFIG', status: 422 });
    // A permitted ASCII path character needs percent encoding; the normalized URL has its own bound.
    assert.throws(() => legacy(prefix + '<'.repeat(2048 - prefix.length)), { code: 'INVALID_CONFIG', status: 422 });
    const labels = ['a'.repeat(63), 'b'.repeat(63), 'c'.repeat(63), 'd'.repeat(58), 'org'];
    assert.throws(() => legacy(`https://${labels.join('.')}/`), { code: 'INVALID_CONFIG', status: 422 });
});
