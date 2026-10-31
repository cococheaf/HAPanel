# Using HAPanel 2.0

HAPanel is a vibe-coded project built with AI assistance. Implemented features and outstanding physical-device checks are distinguished in [validation](validation.md).

## Build a layout

Choose a layout under **Edit display**. **Create from template** adds a room, camera, energy or empty view. HA rooms and floors populate the library. Select devices explicitly; existing views remain intact. The energy template asks for a solar power source; configure other sources in the inspector.

Shift-click selects multiple tiles. Arrow keys move the selection; ⌘/Ctrl C and V copy/paste within the designer. Alignment, distribution and matching sizes are validated atomically. Insufficient room rejects the whole operation. Position locks prevent accidental dragging.

**Appearance & interaction** controls icons, backgrounds, presentation, secondary text, tap/hold bindings and conditional visibility. Actions depend on device capabilities. Mixed light groups have no dimmer. **Review layout** flags missing entities, unavailable devices, cramped tiles and broken links. Missing entities can be replaced. Publishing remains explicit; drafts and revisions stay separate.

**Refresh devices** reloads the catalog and room metadata. Filters cover room, function and unplaced devices. Search also finds layouts and views; ⌘/Ctrl K focuses it. Simple editing reduces the toolbar. Local recovery may offer unsaved work after a connection loss.

## Assign physical displays

**Connect displays → Displays & access** assigns a layout, home view and language to each paired tablet. Multiple tablets may share one layout. Layout deletion and revoking a device session remain separate operations.

Measurements show browser CSS pixels, device pixel ratio and last contact. Identify displays the layout name for 15 seconds. Applying a measured viewport changes the draft; publish afterwards. Measure in the final browser/PWA mode, since browser chrome and the HA sidebar affect available space.

Display appearance settings include density, light/dark/automatic colours, adaptive arrangement, safe insets, swipe navigation, home view, automatic return and idle view. Adaptive rendering preserves stored positions and may scroll vertically. Paired displays show only the dashboard and its controls. Configure language and layout assignment in the designer. Administrators see **Open designer** in the HA add-on. Night hours use the browser clock. Webpage idle/night modes cannot change iPad hardware brightness or wake a locked operating system.

## Restrict access

Global camera and alarm grants remain the upper limit. Device and user settings can only narrow them. Administrators retain management access. View-only blocks device and alarm actions; camera and alarm blocks are independent. Allowed layouts restrict published documents, snapshots, actions, history, statistics and camera endpoints on the server. Layout assignment alone selects the starting layout, so choose allowed layouts as well when restricting access.

Select an active HA user by name or enter the user ID. These rules do not give ordinary HA users general device controls. The separately enabled alarm grant from 1.5 remains available. No HA roles or credentials are changed.

## Alerts and doorbell cameras

Configure alerts with a title, message, state condition, priority, duration, target layouts and an optional published camera. State alerts trigger only on false-to-true transitions. Initial loading and the first snapshot after reconnect do not replay old alerts. Unknown/unavailable states do not match.

An HA automation can fire `hapanel_alert` with `event_data: {rule_id: alert_id_from_designer}`. Only a published rule ID is accepted. Text, targets and camera bindings come from the published configuration. Events run no device actions; camera access is still enforced. Alerts can dismiss webpage idle mode, not an OS lock.

## Cameras

The tile's main camera entity supplies details. An optional low-bandwidth overview camera entity supplies overview snapshots and streams. Choose an existing HA entity; HAPanel does not enable extra camera channels. Concurrent overview streams are configurable from 1 to 8, default 2. Additional cameras remain reachable in detail. Hidden, obscured and background previews pause.

Auto playback tries WebRTC and can fall back to HLS. No external STUN/TURN service is configured. Startup time and HLS buffer distance are diagnostic measurements, not camera capture latency. Proxy byte counters exclude direct WebRTC media.

## Energy

Assign import, export, solar generation and house-consumption meters. Additional solar meters must represent independent, non-overlapping sources. HA Recorder statistics use completed hourly intervals for 24-hour, 7-day and 30-day ranges. Energy counters use changes; measurements use means. Wh/kWh/MWh are normalised. Missing data remains unknown and requests are cached for five minutes.

Self-consumption needs complete solar/export measurements. Self-sufficiency needs a real house-consumption meter and grid import. Battery systems require compatible measurement boundaries. Cost is an estimate using configured fixed import/export tariffs, not historical dynamic pricing or a utility bill. Missing prices produce no invented amount.

## Recovery and diagnostics

First startup with existing files preserves immutable `dashboard-before-2.0.json` and `devices-before-2.0.json` backups in private add-on storage. Existing schema-1 documents remain valid; unknown schema versions are rejected. Diagnostics include version, connection, revisions, subscription count and aggregate proxied bytes, without tokens, alarm codes, session secrets, camera images or entity names. Supervisor backups and revision history remain complementary recovery methods.
