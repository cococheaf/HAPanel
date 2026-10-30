import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HomeAssistantHub } from './hub';
import { DocumentStore, PairingStore } from './store';
import { createApp } from './app';

async function main() {
  const mode = process.env.HAPANEL_MODE ?? 'demo';
  if (!['demo', 'standalone', 'ingress'].includes(mode))
    throw new Error('HAPANEL_MODE muss demo, standalone oder ingress sein.');
  let addon: {
    demo_mode?: boolean;
    display_enabled?: boolean;
    public_origin?: string;
    camera_access?: 'admin' | 'authenticated';
  } = {};
  if (mode === 'ingress') addon = JSON.parse(await readFile('/data/options.json', 'utf8'));
  const demo = mode === 'demo' || (mode === 'ingress' && addon.demo_mode === true);
  const token = mode === 'ingress' ? process.env.SUPERVISOR_TOKEN : process.env.HA_TOKEN;
  if ((!demo || mode === 'ingress') && !token)
    throw new Error('Serverseitiger Home-Assistant-Zugang fehlt.');
  const haUrl =
    mode === 'ingress'
      ? 'http://supervisor/core/'
      : `${(process.env.HA_URL ?? '').replace(/\/$/, '')}/`;
  if (mode === 'standalone' && !/^https?:\/\//.test(haUrl))
    throw new Error('HA_URL muss eine HTTP(S)-Adresse sein.');
  const liveOptions = {
    demo: false,
    token,
    websocketUrl: `${haUrl.replace(/^http/, 'ws')}${mode === 'ingress' ? 'websocket' : 'api/websocket'}`,
    apiUrl: `${haUrl}api/`,
  };
  const hub = new HomeAssistantHub(demo ? { demo: true } : liveOptions);
  const authHub = mode === 'ingress' && demo ? new HomeAssistantHub(liveOptions) : hub;
  const directory = resolve(
    process.env.HAPANEL_DATA_DIR ?? (mode === 'ingress' ? '/data/hapanel' : '.data'),
  );
  const store = new DocumentStore(directory),
    pairings = new PairingStore(directory);
  await store.init();
  await pairings.init();
  const sync = () => {
    const draft = store.getRevision('draft'),
      published = store.getRevision('published');
    hub.setDocuments([draft.document, published.document]);
  };
  store.on('change', sync);
  sync();
  hub.start();
  if (authHub !== hub) authHub.start();
  const displayEnabled = addon.display_enabled ?? process.env.HAPANEL_DISPLAY_PORT !== undefined;
  const common = {
    mode: mode as 'demo' | 'standalone' | 'ingress',
    store,
    pairings,
    hub,
    staticDir: resolve('dist/web'),
    publicOrigin: addon.public_origin || process.env.HAPANEL_PUBLIC_ORIGIN,
    displayEnabled,
    isAdmin: (id: string) => authHub.isAdmin(id),
    isActiveUser: (id: string) => authHub.isActiveUser(id),
    cameraAccess:
      addon.camera_access ??
      (process.env.HAPANEL_CAMERA_ACCESS === 'authenticated' ? 'authenticated' : 'admin'),
  };
  const editor = await createApp({ ...common, surface: 'editor' });
  const port = Number(process.env.PORT ?? (mode === 'ingress' ? 8099 : 4310));
  await editor.listen({ host: mode === 'ingress' ? '0.0.0.0' : '127.0.0.1', port });
  console.log(`HAPanel ${demo ? 'Beispieldaten' : 'Live'} · Editor: http://127.0.0.1:${port}`);
  const display = displayEnabled ? await createApp({ ...common, surface: 'display' }) : undefined;
  if (display) {
    const displayPort = Number(process.env.HAPANEL_DISPLAY_PORT ?? 8098);
    await display.listen({ host: '0.0.0.0', port: displayPort });
    console.log(`Display-Port: ${displayPort} · Kopplung im Studio erforderlich`);
  }
  const shutdown = async () => {
    await Promise.all([
      editor.close(),
      display?.close(),
      hub.stop(),
      authHub !== hub ? authHub.stop() : undefined,
    ]);
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
