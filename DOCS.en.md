# Install and use HAPanel

**[Deutsch](DOCS.md) · English**

## Language

Studio, dashboard and pairing support German and English. The language selector initially uses **Auto**, following the browser’s preferred languages. Unsupported languages fall back to English. Choose **Deutsch** or **English** to override this per browser/display. The choice is stored locally and does not change HA language settings or dashboard documents.

Dates, times, numbers, controls and HAPanel errors follow the selection. Untouched sample labels are also localised. Custom titles, greetings, device names and HA entity names remain as entered. UI language does not convert temperature units or change device setpoints.

## Public iPad demo

1. Open <https://cococheaf.github.io/HAPanel/> in Safari.
2. Select a landscape or portrait profile as appropriate.
3. Try lights, dimming, temperature and media controls.
4. **Explore Studio** opens the visual editor. Edit tiles/pages and **Publish** to apply the draft to the demo dashboard.
5. Use **Share → Add to Home Screen** for a standalone web app.

The demo uses sample data and browser-local configuration. Safari and a Home Screen app may have separate storage. No audio is played. Fullscreen behaviour, screen locking and keeping the screen awake depend on the operating system.

## Home Assistant OS / Supervisor

This alpha includes a source-built add-on for `amd64` and `aarch64`. It has not yet passed acceptance on a real Supervisor installation. Start with the default demo mode.

1. In **Settings → Apps/Add-ons → Store → Repositories**, add `https://github.com/cococheaf/HAPanel`.
2. Install **HAPanel**. The container image is built from the repository; the first build may take several minutes.
3. Start it and enable **Show in sidebar**.
4. Open Studio as a HA administrator. The backend checks the Ingress user ID against active HA administrators.
5. After testing the design, set `demo_mode` to `false` and restart. Assign your own entities in Studio and publish.

The add-on reads `/data/options.json` and writes only to `/data/hapanel`. It requests HA Core API access, but no Supervisor management permissions, host networking or HA configuration mounts.

| Option            | Default | Purpose                                                                              |
| ----------------- | ------- | ------------------------------------------------------------------------------------ |
| `demo_mode`       | `true`  | Use sample data; Ingress administrator checks still use HA.                          |
| `display_enabled` | `false` | Start the separate display endpoint on container port 8098.                          |
| `public_origin`   | empty   | Exact public HTTPS origin, e.g. `https://panel.example.net`; enables Secure cookies. |

Changing modes does not trigger device actions. In live mode, example entities may initially be unavailable; select your own entities in Studio.

## Pair a wall tablet

1. Enable `display_enabled` and map `8098/tcp` to an available host port. Port 8099 remains reserved for Ingress.
2. Expose the display endpoint through a local HTTPS reverse proxy and set `public_origin` to its exact origin. The proxy must support WebSocket upgrades and preserve paths.
3. In Studio, choose **Connect displays → Create pairing code**.
4. Open `https://YOUR-PANEL-ADDRESS/display.html` on the tablet and enter a display name and code.
5. Select a display profile; optionally add the page to the iPad Home Screen.

Codes expire after five minutes and can be used once. Device sessions are stored as hashes, expire after 90 days and can be revoked under **Connect displays**, which also closes active streams. Displays receive only the published configuration and its authorised entities.

HAPanel does not configure a reverse proxy, DNS or TLS certificates. Ingress provides the editor; independent tablets use the separate display address. An HTTP endpoint can be used for local sample-data testing.

## Without Supervisor

The demo and standalone editor bind only to loopback. The separate display server has its own pairing authentication.

```sh
npm ci
npm run build
npm start
```

For local live testing, set `HAPANEL_MODE=standalone`, `HA_URL` and `HA_TOKEN` in the server environment. `HA_URL` is the HA instance’s base URL. Keep credentials out of the frontend, repository and dashboard files. `.env` is ignored by Git, but is **not loaded automatically**; load it explicitly in your calling environment if used.

| Variable                | Default / meaning                                           |
| ----------------------- | ----------------------------------------------------------- |
| `HAPANEL_MODE`          | `demo`, or `standalone`; the add-on uses `ingress`.         |
| `HAPANEL_DATA_DIR`      | `.data`; `/data/hapanel` in the add-on.                     |
| `PORT`                  | `4310`; `8099` in the add-on.                               |
| `HA_URL` / `HA_TOKEN`   | Server-side HA base URL and credential for standalone mode. |
| `HAPANEL_DISPLAY_PORT`  | If set, starts a separate display server on this port.      |
| `HAPANEL_PUBLIC_ORIGIN` | Public HTTPS origin of the display server.                  |

## Editor workflow

- **Add:** Click a tile type or entity in the library. Desktop dragging from the tile library is also supported; tap to add on touch devices.
- **Move:** Drag the upper-right handle. Tiles snap to the grid without moving other tiles automatically.
- **Resize:** Drag the lower-right handle or enter dimensions in the properties panel.
- **Keyboard:** Select a tile and use **Alt + arrow keys**. **Cmd/Ctrl + Z** undoes; add Shift to redo.
- **Pages:** Switch or add pages at the bottom. A blank page can be renamed or removed in the properties panel.
- **Profiles:** Each display profile has independent tile positions. Duplicate a profile to copy its positions.
- **Save:** Drafts autosave after a short pause. If there is a revision conflict, export the visible draft before reloading.
- **Preview:** Uses the same tiles as the player. Controls are initially disabled. Enabling **Test mode** executes real actions in live mode.
- **Publish:** Makes the saved draft available to paired displays, without a full reload.
- **History:** Restore up to 30 previous drafts. Restoration creates a new draft and preserves the published version.
- **Import/export:** JSON or YAML HAPanel documents. Imports first affect the draft. Exports include entity names but no server credentials or device sessions.

## Display dimensions

Physical pixels and browser CSS pixels differ. An iPad 8 has 2160 × 1620 physical pixels in landscape and, at DPR 2, a nominal 1080 × 810 CSS-pixel area. Browser bars and safe areas may reduce the usable area. **Use resolution and pixel ratio** computes nominal dimensions; adjust them to the actual viewport as needed.

**Fit proportionally** preserves the aspect ratio. **Exact CSS pixels** renders without scaling; a smaller viewport shows a scrollable portion. Studio zoom is relative to its fitted preview. The configured diagonal does not imply a physical-size preview on the editor’s monitor.

The display information menu shows viewport size and DPR. In Home Screen standalone mode, HAPanel hides its demo toolbar. The webpage does not control operating-system chrome.

## Backup and updates

Normal add-on updates preserve private data. Keep a HA backup and a JSON/YAML export before updating. Reinstallation may remove private add-on data. `dashboard.json` stores draft, publication and history; `devices.json` stores hashed pairing/session data. Invalid stored dashboards are never overwritten at startup.
