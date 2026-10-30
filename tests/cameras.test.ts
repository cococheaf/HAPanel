import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraProxy, publicEntity } from '../src/server/cameras';

const options = {
  apiUrl: 'http://supervisor/core/api/',
  token: 'server-only-secret',
  stream: async () => ({ url: '/api/hls/private-session/master_playlist.m3u8' }),
};
test('camera metadata excludes access tokens and upstream image URLs', () => {
  const entity = publicEntity({
    entity_id: 'camera.entrance',
    state: 'recording',
    attributes: {
      friendly_name: 'Entrance',
      supported_features: 2,
      access_token: 'private',
      entity_picture: '/api/camera_proxy/camera.entrance?token=private',
      frontend_stream_type: 'hls',
    },
  });
  assert.deepEqual(entity.attributes, {
    friendly_name: 'Entrance',
    supported_features: 2,
    frontend_stream_type: 'hls',
  });
});
test('camera proxy rewrites nested HLS resources to opaque local URLs, forwards only LL-HLS parameters and ranges', async (t) => {
  const requests: { url: URL; init?: RequestInit }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: URL, init?: RequestInit) => {
    const url = new URL(input);
    requests.push({ url, init });
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      'Bearer server-only-secret',
    );
    if (url.pathname.endsWith('master_playlist.m3u8'))
      return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=123\nplaylist.m3u8\n');
    if (url.pathname.endsWith('playlist.m3u8'))
      return new Response(
        '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-PART:DURATION=1,URI="part.m4s"\n#EXTINF:2,\nsegment.m4s\n',
      );
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 206,
      headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-2/3' },
    });
  });
  const proxy = new CameraProxy(options);
  const master = (await proxy.live('camera.entrance')).buffer.toString();
  assert.doesNotMatch(master, /private-session|supervisor|server-only-secret/);
  const playlist = master.trim().split('\n').at(-1)!.replace('assets/', '');
  assert.match(playlist, /^[a-f0-9]{32}\.m3u8$/);
  const body = (
    await proxy.live('camera.entrance', playlist, {
      _HLS_msn: '12',
      _HLS_part: '3',
      _HLS_skip: 'YES',
      token: 'attacker',
    })
  ).buffer.toString();
  assert.match(
    requests[1].url.href,
    /core\/api\/hls\/private-session\/playlist.m3u8\?_HLS_msn=12&_HLS_part=3&_HLS_skip=YES$/,
  );
  assert.doesNotMatch(body, /init.mp4|part.m4s|segment.m4s|assets\//);
  const segment = body.trim().split('\n').at(-1)!;
  const data = await proxy.live('camera.entrance', segment, {}, 'bytes=0-2');
  assert.equal(data.status, 206);
  assert.equal(data.contentRange, 'bytes 0-2/3');
  assert.equal((requests.at(-1)!.init?.headers as Record<string, string>).Range, 'bytes=0-2');
  await assert.rejects(proxy.live('camera.entrance', 'unregistered.mp4'));
  await assert.rejects(proxy.live('camera.entrance', segment, {}, 'bytes=0-1,3-5'));
});
test('upstream playlists cannot redirect the camera proxy outside the private stream root', async (t) => {
  let uri = '';
  t.mock.method(globalThis, 'fetch', async () => new Response('#EXTM3U\n' + uri + '\n'));
  for (uri of [
    'https://evil.example/stolen.ts',
    '../other/secret.ts',
    '/api/config',
    '%2e%2e/secret.ts',
    '//evil.example/file.ts',
    '/api/hls/other/secret.ts',
  ])
    await assert.rejects(new CameraProxy(options).live('camera.entrance'));
  await assert.rejects(
    new CameraProxy({
      ...options,
      stream: async () => ({ url: 'https://evil.example/stream.m3u8' }),
    }).live('camera.entrance'),
  );
  for (const url of ['/api/hls/token/../../config', '/api/hls/token/%2e%2e/config'])
    await assert.rejects(
      new CameraProxy({ ...options, stream: async () => ({ url }) }).live('camera.entrance'),
    );
});
test('still images are bounded, shared between clients and credentials stay on the backend', async (t) => {
  let calls = 0,
    oversized = false;
  t.mock.method(globalThis, 'fetch', async (input: URL) => {
    calls++;
    assert.match(String(input), /core\/api\/camera_proxy\/camera.entrance\?width=960$/);
    return new Response(new Uint8Array(oversized ? 5 * 1024 * 1024 + 1 : 3), {
      headers: { 'content-type': 'image/jpeg' },
    });
  });
  const proxy = new CameraProxy(options);
  await Promise.all([proxy.still('camera.entrance'), proxy.still('camera.entrance')]);
  assert.equal(calls, 1);
  await proxy.still('camera.entrance', true);
  assert.equal(calls, 2);
  oversized = true;
  await assert.rejects(new CameraProxy(options).still('camera.entrance'));
});
