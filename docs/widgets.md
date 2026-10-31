# Widget contract

HAPanel widgets share a renderer between designer and player. Firmware, flashing, ESPHome and MCU transports are outside this repository. Tessera inspires the editing workflow; HAPanel's browser implementation remains independent.

- `src/shared/model.ts`: validated persisted shape and typed client action payloads. Additive optional fields keep existing schema-1 documents valid. A breaking format change requires an explicit migration and original-file backup.
- `src/shared/widgets.ts`: domain mapping, widget commands and HA capability validation. Client-supplied entity IDs, service names and URLs are never action targets.
- `src/shared/experience.ts`: gesture/visibility/profile/alert schemas, pure adaptive rendering and review rules.
- `src/shared/designer.ts`: atomic selection transforms, paste and additive templates. Copies receive fresh control IDs. Navigation and home references are remapped when layouts are copied.
- `src/client/ui/Dashboard.tsx` and `AdvancedControls.tsx`: common rendering and capability-based controls. The player does not import the grid editor. Small containers adapt content without silently shrinking controls below their configured density.
- `src/client/editor/ExperienceSettings.tsx`: typed appearance and interaction forms. All visible strings belong to DE/EN catalogs; new languages register centrally.
- `src/server/hub.ts`: HA state, registry metadata, validated dispatch, bounded statistics cache and the fixed `hapanel_alert` event subscription.
- `src/server/app.ts`: administrator boundary, published scopes, device/user restrictions and authenticated media transport. New endpoints must enforce the same scope before fetching HA data.

To add a widget: register its kind/domains, schema, command mapping, server capability checks, renderer, inspector and translations. Include synthetic examples and meaningful capability/security regressions. Adding a renderer alone never grants service access. Third-party executable widget loading is deliberately not enabled; extensions are reviewed source contributions.

Widgets must preserve unknown/unavailable data, distinguish request acceptance from a confirmed HA state, stop hidden media and clean up effects/subscriptions. Preview fixtures contain no real HA credentials or private entity catalogs. Alarm codes are never persisted or echoed. View-only and per-layout policies apply before dispatch, independent of UI visibility.
