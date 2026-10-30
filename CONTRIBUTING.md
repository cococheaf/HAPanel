# Mit HAPanel arbeiten

**Deutsch · [English](CONTRIBUTING.en.md)**

Node.js 24 LTS verwenden und Abhängigkeiten mit `npm ci` installieren. `npm run dev` startet Demo-API und Vite. Die Browserdemo unter `/demo.html` benötigt keine HA-Zugangsdaten.

Vor einem Pull Request:

```sh
npm test
npm run build
npm run build:demo
```

Layout-, Persistenz- und Zugriffskontrolländerungen brauchen gezielte Regressionstests. Reine Text- oder Farbänderungen benötigen keine Tests, die nur die Implementierung wiederholen. Mit `npx prettier --write DATEI` die geänderten Dateien formatieren.

Kachelrenderer gehören in `src/client/ui`, Konfigurationsregeln in `src/shared` und HA-Kommunikation ausschließlich ins Backend. Simulatoren und Tests dürfen keine echte HA-Instanz kontaktieren. Schemaänderungen müssen eine Versionsentscheidung und eine Migration oder ausdrückliche Ablehnung älterer Dateien enthalten.

Keine Zugangsdaten, privaten HA-Exporte oder Bildschirmfotos mit echten Haushaltsdaten committen. `.data/`, `.env` und Buildausgaben sind ignoriert. Neue Beiträge müssen zur MIT-Lizenz passen. Bei Codeübernahmen die Herkunft und Lizenz dokumentieren; insbesondere Tessera-Implementierungen nicht ohne Lizenzprüfung übernehmen.

Fehlerberichte mit Browser-/HA-Version, Displayprofil und reproduzierbaren Schritten helfen am meisten. Für Sicherheitslücken siehe [SECURITY.md](SECURITY.md).

Oberflächentexte, barrierefreie Beschriftungen und HAPanel-Fehlermeldungen gehören in die zentralen deutschen und englischen Kataloge. Weitere Sprachen sind in der [Übersetzungsanleitung](docs/translations.md) beschrieben.
