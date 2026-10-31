# Install and use HAPanel

HAPanel is a **vibe-coded project built with AI assistance**. Its creator has no programming background and develops the idea through design and hands-on testing. Reviews and contributions are welcome; validation and remaining limits are documented in [Validation](docs/validation.md).

**[Deutsch](DOCS.md) · English**

## Language

Studio, dashboard and pairing support German and English. The language selector initially uses **Auto**, following the browser’s preferred languages. Unsupported languages fall back to English. Choose **Deutsch** or **English** to override this per browser/display. The choice is stored locally and does not change HA language settings or dashboard documents.

Dates, times, numbers, controls and HAPanel errors follow the selection. Untouched sample labels are also localised. Custom titles, greetings, device names and HA entity names remain as entered. UI language does not convert temperature units or change device setpoints.

## Public iPad preview

1. Open <https://cococheaf.github.io/HAPanel/> in Safari.
2. Select a landscape or portrait profile as appropriate.
3. Try lights, dimming, temperature and media controls.
4. **Open Designer** opens the visual editor. Edit tiles/pages and **Publish** to apply the draft to the preview dashboard.
5. Use **Share → Add to Home Screen** for a standalone web app.

The preview uses sample data and browser-local configuration. Safari and a Home Screen app may have separate storage. No audio is played. Fullscreen behaviour, screen locking and keeping the screen awake depend on the operating system.

## Home Assistant OS / Supervisor

This release includes a source-built add-on for `amd64` and `aarch64`. Installation, updates, Ingress and live data have been checked on Home Assistant OS 18.4 with Core 2026.10.4 (amd64). The default preview mode remains available for initial setup.

1. In **Settings → Apps/Add-ons → Store → Repositories**, add `https://github.com/cococheaf/HAPanel`.
2. Install **HAPanel**. The container image is built from the repository; the first build may take several minutes.
3. Start it and enable **Show in sidebar**.
4. **HAPanel** in the HA sidebar opens the published dashboard. **Open Designer** opens the editor. The Designer uses the verified HA administrator session. Explicitly enabling `camera_access` also gives signed-in users access to the published view without a separate network port. The home icon in Studio returns to the dashboard.
5. After testing the design, set `demo_mode` to `false` and restart. Assign your own entities in Studio and publish.

The add-on reads `/data/options.json` and writes only to `/data/hapanel`. It requests HA Core API access, but no Supervisor management permissions, host networking or HA configuration mounts.

| Option            | Default | Purpose                                                                                                                                           |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo_mode`       | `true`  | Use sample data; Ingress administrator checks still use HA.                                                                                       |
| `display_enabled` | `false` | Start the separate display endpoint on container port 8098.                                                                                       |
| `public_origin`   | empty   | Exact public HTTPS origin, e.g. `https://panel.example.net`; enables Secure cookies.                                                              |
| `camera_access`   | `admin` | `admin`: existing administrator access; `authenticated`: published view with cameras for active HA users, plus cameras for valid paired displays. |
| `alarm_access`    | `admin` | `authenticated` additionally permits configured alarm commands for active HA users and valid paired displays.                                     |

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

The preview and standalone editor bind only to loopback. The separate display server has its own pairing authentication.

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

## Room and energy cards

In tile properties, choose Device, Room or Energy under **Card view**. Rooms have an icon, optional temperature/humidity sources, contacts and their own devices. Tap a room to open its device controls. A navigation target can instead open another page, such as a floor overview. Page headings and descriptions are editable with no tile selected.

Bind existing sensors for energy. Solar sources must be disjoint; never add a total together with its component meters. Grid import and export are separate power readings. Configure the battery sign convention to match the integration. Monitored loads include only selected devices and are not total home consumption. Clearly distinguish daily energy values from cumulative counters in their labels. Missing values remain unknown.

Tap weather, a meter or an energy source for details. Forecast availability depends on the weather integration; 24-hour history depends on the HA recorder. HAPanel creates no new history records in HA. Existing saved layouts are preserved and are not replaced by the new sample layout.

## Home controls and contact status

Light groups use an existing HA light entity. Automation cards show whether triggers are enabled; the power button enables or disables the automation. **Run now** invokes it while retaining its existing conditions. On small cards, open details to reach the manual run action.

The alarm card shows live status and opens its mode picker directly inside HAPanel. In the Designer, enable and reorder the desired modes: Disarmed, Home, Away, Night, Vacation and Custom bypass. Unsupported integration modes remain disabled. Every command requires confirmation. Open and unavailable configured contacts are listed before arming. When required by HA, enter the code in a password field; it is used only for that request and is never stored in the layout or on the server. The visible alarm state always comes from HA, rather than an optimistic command result.

Alarm commands default to the HA administrator Ingress session; `alarm_access: authenticated` additionally allows active HA users and valid paired displays. Camera images can additionally be shared with active HA users and valid paired displays through `camera_access: authenticated`. The default `admin` preserves existing access.

## Surveillance

Create a **Surveillance** page and **Camera** tiles in the Designer, then select your existing HA camera entities. Set the thumbnail refresh interval (15–120 seconds) and image fit per tile. Tapping opens video on demand. Safari plays HLS natively; compatible browsers load the HLS player as needed. Cameras without streaming show an updated image every two seconds. Playback stops when the detail view closes or the page is hidden.

The add-on uses the existing HA camera integration, stores no UniFi credentials and creates no recordings. Camera tokens and upstream stream URLs remain on the backend. The public preview shows labelled sample camera placeholders and no private footage.

**Doors & windows** uses a configurable contact list. Open contacts appear first in details, with unavailable contacts shown separately. “None reported open” does not mean unknown contacts are safely closed. These settings are editable in the Designer.

## Display dimensions

Physical pixels and browser CSS pixels differ. An iPad 8 has 2160 × 1620 physical pixels in landscape and, at DPR 2, a nominal 1080 × 810 CSS-pixel area. Browser bars and safe areas may reduce the usable area. **Use resolution and pixel ratio** computes nominal dimensions; adjust them to the actual viewport as needed.

**Fit proportionally** preserves the aspect ratio. **Exact CSS pixels** renders without scaling; a smaller viewport shows a scrollable portion. Studio zoom is relative to its fitted preview. The configured diagonal does not imply a physical-size preview on the editor’s monitor.

The display information menu shows viewport size and DPR. In Home Screen standalone mode, HAPanel hides its preview toolbar. The webpage does not control operating-system chrome.

## Backup and updates

Normal add-on updates preserve private data. Keep a HA backup and a JSON/YAML export before updating. Reinstallation may remove private add-on data. `dashboard.json` stores draft, publication and history; `devices.json` stores hashed pairing/session data. Invalid stored dashboards are never overwritten at startup.

## Display management in 1.2

1. Open the Designer and choose a layout under **Edit display** at the top. The selection is remembered in this browser.
2. Choose **Manage displays → Add display**. Reuse existing dimensions and either copy all views or start empty.
3. Use a view’s copy button to target an existing display or **Create a new display …**. Copies retain all tiles and adapt to the target grid. Unavailable navigation targets are removed.
4. Arrows reorder views. The trash button deletes populated views after confirmation. At least one view and one display must remain.
5. A display’s trash button removes its layout and views. Undo and version history can restore draft changes; devices receive changes only after publication.
6. **Manage devices** manages browser pairings. Revoking access signs out that browser while preserving layouts. Layout selection is not a permission boundary; existing server permissions still apply.

Previously shared views are copied independently per display on first startup. First-display IDs and entity bindings are retained. The unmodified original file is backed up as `dashboard-before-display-views.json` in private add-on storage. Drafts, publications and history remain separate. Export JSON and keep the HA app backup before updating. Older versions cannot read the extended file; restore the matching backup when rolling back.

## Camera connections and live overview

Each camera has **Camera overview: Snapshot / Live stream** and **Connection: Automatic / WebRTC / HLS**. Automatic detects HA capabilities, prefers WebRTC and falls back to HLS after a bounded wait when the direct connection is unavailable. The live indicator identifies the transport. Smaller HLS buffers and **Jump to live edge** reduce additional player delay without guaranteeing camera or network latency.

Signalling uses the same camera access check as snapshots and HLS through the add-on. Media uses the local route offered by HA. HAPanel uses no external STUN/TURN service, requests no microphone and installs no additional camera server. HLS fallback may be necessary across network boundaries or remote connections. Router, firewall and HA user roles are preserved. Additional HAPanel camera sharing is explicitly selected through `camera_access`.

Live tiles start only while visible and pause behind an open detail view. For multiple streams on weaker tablets, choose a lower-resolution camera channel already available in HA. Cameras without video keep the updated-image fallback.

## Icon

`public/mark.svg` is the scalable source. `npm run icons` generates browser, iPad and Web App PNGs, plus `icon.png`/`logo.png` for the add-on. The standalone display Web App has its own Apple Touch icon; viewing HAPanel inside HA does not replace the HA app icon.

## Light options and text editing

Select a light tile in the Designer and open **Switch behaviour**. The two checkboxes allow toggling, on only, off only or a state-only display. Devices inside room cards have the same options beneath each device. Existing controls keep toggling unless configured otherwise. Dimming requires confirmed support from the light and every group member. Mixed and incomplete groups have no slider; restricted switching hides it as well.

Capabilities use HA colour modes and recursive group membership. Extra group members are neither exposed to displays nor added to live subscriptions. HA metadata is cached; reload the Designer after about a minute when changing HA groups.

Custom text retains spaces. Required names may be cleared temporarily while renaming, but empty values are not saved. **Publish** activates the valid configuration.

The extension retains schema 1 and reads existing configurations with their previous default actions. Older HAPanel versions do not understand the new light options. Retain the Supervisor update backup and restore its matching configuration when downgrading.

## Camera sharing for users and tablets

The add-on option **Camera viewing** (`camera_access`) accepts `admin` (default) or `authenticated`. With `authenticated`, active HA-authenticated users may read the published dashboard and cameras. Designer, drafts and device management remain blocked. Other device controls remain blocked; alarm commands may be shared separately through `alarm_access`. Valid paired tablets receive camera images in addition to their existing controls. Snapshots, HLS resources and WebRTC always require HA authentication or a valid pairing.

The published configuration acts as the sharing allowlist. All cameras bound there are shared with these viewers; clients cannot choose arbitrary camera targets or HA services. This is an explicit HAPanel administrator sharing policy; individual HA entity permissions are not replicated. Camera tokens and private stream URLs stay on the server.

Save changes and restart the app. The sidebar entry is visible to non-administrators, but the data API remains blocked until sharing is enabled. Revoking a pairing closes active camera WebRTC sessions. HA accounts are revalidated (30-second role cache, 20-second session check). Selecting `admin` disables camera sharing for paired and non-admin viewers again.

For standalone deployment, `HAPANEL_CAMERA_ACCESS=authenticated` enables the same sharing policy; the default is `admin`.

## Alarm controls for non-administrators

The **Alarm controls** option (`alarm_access`) is independent of camera sharing: `admin` is the default; `authenticated` permits active HA users and valid paired tablets. Save changes and restart. Only alarm entities and modes bound in the published HAPanel configuration can be used. Ordinary HA viewers receive alarm controls alongside their view; other device commands, Designer, drafts and device management remain blocked.

PIN requirements and format come from the HA alarm entity. Leading zeros are retained; codes are cleared from the input on submission and are neither stored nor echoed in errors. Mode confirmation, connectivity checks, contact warnings and a limit of five alarm attempts per minute per HA user or paired device remain active.

| Access                    | Camera viewing  | Alarm controls | Other devices     | Designer |
| ------------------------- | --------------- | -------------- | ----------------- | -------- |
| HA administrator          | Yes             | Yes            | Yes               | Yes      |
| Active HA user            | `camera_access` | `alarm_access` | View only         | No       |
| Paired tablet             | `camera_access` | `alarm_access` | Existing controls | No       |
| No authentication/pairing | No              | No             | No                | No       |

For standalone installs, use `HAPANEL_ALARM_ACCESS=authenticated`. Sharing changes no HA user roles and does not replicate individual HA entity permissions.

## HAPanel 2.0

See the [2.0 user guide](docs/experience.en.md) for designer, display, camera, alert and energy features.
