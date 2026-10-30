# Prüfstand für 0.1.0-alpha.1

## Automatisiert

16 Tests mit Node.js-Test-Runner: Geometrie aller Beispielprofile, Schema- und Domänenvalidierung, Rastergrenzen und Überlappungen, Revisionskonflikte, Entwurf/Veröffentlichung/Wiederherstellung, persistente Sitzungen, einmalige Kopplungscodes, Zugriffsschutz für Ingress und lokale Verwaltung, eingeschränkte Display-API, YAML-Import und aktiver WebSocket-Widerruf.

Der HA-Adapter wird mit einem lokalen WebSocket-Simulator geprüft: Authentifizierung, gefilterte Abonnements, komprimierte Attribut-Deltas, Prognosen, Administratorprüfung, typisierte Serviceaufrufe und Unterbrechung. Es werden keine echten HA-Geräte angesteuert.

TypeScript-Prüfung, Produktionsbuild, separater Demo-Build und Abhängigkeitsprüfung sind Teil der Validierung. GitHub Actions ergänzt Linux-Container-Builds für amd64 und aarch64. Ein erfolgreicher Container-Build bestätigt nicht die Installation im Supervisor.

## Im Browser geprüft

- Demo-Licht schalten, Klima-Sollwert ändern und Medien pausieren.
- Kachel auf einer zweiten Seite hinzufügen.
- Skalierte Arbeitsfläche: Verschieben um zwei Spalten/eine Zeile ergibt genau diese Rasterposition.
- Größenänderung um eine Spalte/eine Zeile; Undo und Redo stellen die korrekten Maße wieder her.
- Umbenannter Entwurf bleibt im Player unsichtbar, bis er veröffentlicht wird.
- Nach Veröffentlichung erscheint die neue Kachel im Player.
- JSON-Import eines vollständigen Beispieldashboards im Editor.
- Ansichten mit 1080 × 810, 810 × 1080 und 800 × 480 CSS-Pixeln visuell geprüft.

Die Prüfung erfolgt im In-App-Browser auf dem Entwicklungsrechner. Physische Touch-Eingabe, Safari auf dem iPad und die tatsächliche Supervisor-Installation müssen separat abgenommen werden. Siehe [Roadmap](roadmap.md).

Eine im Browser gefundene Abweichung in React Grid Layout 2.3.0 wurde bei der Integration umgangen: Die skalierte Positionierungsstrategie muss den Ursprung relativ zum Grid-Elternelement berechnen. HAPanel übernimmt die Transform-Strategie mit Skalierungsfaktor und verwendet den eingebauten relativen Drag-Ursprung.
