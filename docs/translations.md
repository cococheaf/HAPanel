# Languages and translations / Sprachen und Übersetzungen

HAPanel ships with German and English. Additional languages use the same UI and schema; there is no separate application fork per language.

## Add a language

1. Copy `src/shared/i18n/locales/en.json` to a new catalog, for example `fr.json`.
2. Translate the values. Keep every key and each `{placeholder}` unchanged. Messages are plain text, never HTML.
3. Import the catalog into `src/shared/i18n/index.ts` and add it to `languages`, with a native display name and an `Intl` locale, for example `fr: { name: 'Français', intlLocale: 'fr-FR', messages: fr satisfies Catalog }`.
4. Use a lowercase base language tag as the registry key. Browser language tags such as `fr-CA` will resolve to that base language. The selector is populated from the registry automatically.
5. Add `translations/fr.yaml` if localising Home Assistant’s native add-on configuration fields as well.
6. Run `npm test`, `npm run build` and `npm run build:demo`. Review the editor, pairing form and all display profiles in the new language.

TypeScript checks catalog keys and UI lookups. Tests check complete coverage and matching interpolation placeholders across every registered language. Unsupported languages fall back to English. English is the canonical catalog for new message IDs.

## Implementation boundaries

- `src/shared/i18n` is independent of React, browser storage and HA. It is also used for validation and server errors.
- `src/client/i18n.tsx` handles browser-language detection, manual preference, persistence, HTML language metadata and the shared selector.
- API requests send the current language through `Accept-Language`. Responses provide localised messages and stable error keys. HA-originated error details remain as supplied by HA.
- Dates and numbers use `Intl` with the registered locale. Changing UI language does not convert device units or alter setpoints.
- Preferences are per browser and stored separately from dashboard JSON/YAML. Language changes do not create dashboard revisions.
- Untouched, identifiable sample labels are translated only for presentation. Custom names and greetings remain literal content. Do not translate entity IDs, service names, file formats, schema keys or user-entered text.

## Deutsch

Deutsch und Englisch gehören zum anfänglichen Funktionsumfang. Für weitere Sprachen eine Kopie des englischen JSON-Katalogs anlegen, Werte übersetzen und die Sprache in `languages` registrieren. Alle Schlüssel und Platzhalter müssen erhalten bleiben. Die Sprachwahl erscheint danach automatisch; Tests prüfen Vollständigkeit und Platzhalter. Die Spracheinstellung gilt pro Browser und verändert keine Layouts oder Home-Assistant-Einstellungen.
