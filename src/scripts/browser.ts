import libcurlPKG from '@mercuryworkshop/libcurl-transport';
import { Controller, config } from '@petezah-games/scramjet-controller';
const { LibcurlClient } = libcurlPKG;
export default async function (
  embedFrame: HTMLIFrameElement,
  initPath: string,
  controllerPath: string,
  statusEl: HTMLParagraphElement,
  url: string
): Promise<Controller> {
  config.prefix = initPath;
  config.wasmPath = `${initPath}scramjet.wasm`;
  config.injectPath = `${controllerPath}controller.inject.js`;
  config.wasmPath = `${initPath}scramjet.wasm`;
  config.scramjetPath = `${initPath}scram/scramjet.js`;
  async function init() {
    statusEl.textContent = 'Registering service worker...';
    const registration = await navigator.serviceWorker.register('/petezah/SJsw.js', { type: 'module', scope: '/petezah/scram' });
    // Wait for the service worker to be ready
    if (!navigator.serviceWorker.controller) {
      statusEl.textContent = 'Waiting for service worker to activate...';
      await new Promise((resolve) => {
        if (registration.active) {
          resolve();
          return;
        }
        const sw = registration.installing || registration.waiting;
        if (sw) {
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') resolve();
          });
        }
      });
      // Wait for controller
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        });
      }
    }
    statusEl.textContent = 'Initializing controller...';
    const transport = new LibcurlClient({
      wisp: 'ws://localhost:4501/'
    });

    const controller = new Controller({
      serviceworker: registration.active,
      transport
    });

    await controller.wait;

    const scramjetFrame = controller.createFrame(embedFrame);
    scramjetFrame.go(url);
  }

  init().catch((err) => {
    statusEl.textContent = `Error: ${err.message}`;
    console.error('Harness init error:', err);
  });
}
