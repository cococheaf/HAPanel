# Prüfstand für 1.1.0

## Automatisiert

44 Tests mit Node.js-Test-Runner: Geometrie aller Beispielprofile, Schema- und Domänenvalidierung, Rastergrenzen und Überlappungen, Revisionskonflikte, Entwurf/Veröffentlichung/Wiederherstellung, persistente Sitzungen, einmalige Kopplungscodes, Zugriffsschutz für Ingress und lokale Verwaltung, eingeschränkte Display-API, YAML-Import und aktiver WebSocket-Widerruf.

Der HA-Adapter wird mit einem lokalen WebSocket-Simulator geprüft: Authentifizierung, gefilterte Abonnements, komprimierte Attribut-Deltas, Prognosen, Administratorprüfung, typisierte Serviceaufrufe und Unterbrechung. Es werden keine echten HA-Geräte angesteuert.

TypeScript-Prüfung, Produktionsbuild, separater Vorschau-Build und Abhängigkeitsprüfung sind Teil der Validierung. GitHub Actions ergänzt Linux-Container-Builds für amd64 und aarch64. Ein erfolgreicher Container-Build bestätigt nicht die Installation im Supervisor.

## Im Browser geprüft

- Beispiellicht schalten, Klima-Sollwert ändern und Medien pausieren.
- Kachel auf einer zweiten Seite hinzufügen.
- Skalierte Arbeitsfläche: Verschieben um zwei Spalten/eine Zeile ergibt genau diese Rasterposition.
- Größenänderung um eine Spalte/eine Zeile; Undo und Redo stellen die korrekten Maße wieder her.
- Umbenannter Entwurf bleibt im Player unsichtbar, bis er veröffentlicht wird.
- Nach Veröffentlichung erscheint die neue Kachel im Player.
- JSON-Import eines vollständigen Beispieldashboards im Editor.
- Ansichten mit 1080 × 810, 810 × 1080 und 800 × 480 CSS-Pixeln visuell geprüft.

Die Prüfung erfolgt im In-App-Browser auf dem Entwicklungsrechner. Physische Touch-Eingabe, Safari auf dem iPad müssen separat abgenommen werden. Siehe [Roadmap](roadmap.md).

Eine im Browser gefundene Abweichung in React Grid Layout 2.3.0 wurde bei der Integration umgangen: Die skalierte Positionierungsstrategie muss den Ursprung relativ zum Grid-Elternelement berechnen. HAPanel übernimmt die Transform-Strategie mit Skalierungsfaktor und verwendet den eingebauten relativen Drag-Ursprung.

## 0.1.0-alpha.2 · Deutsch und Englisch

Zusätzliche Prüfungen decken vollständige Übersetzungskataloge, Platzhalter, Sprachpräferenzen und englischen Fallback, Zahlenformate, API-Sprachwahl und den Erhalt eigener Dashboard-Texte ab. Sprachwechsel speichern keine Dashboard-Revisionen.

Im Browser wurden deutsche und englische Oberflächen, persistente Sprachwahl, Importfehler innerhalb des Dialogs und Kopplungsfehler in beiden Sprachen geprüft. Der vorbelegte Gerätename folgt der Sprachwahl; selbst eingegebene Namen bleiben erhalten. Die englische iPad-Ansicht wurde im Quer- und Hochformat visuell geprüft.

## Supervisor und Live-Anbindung

Installation aus dem GitHub-Repository, Update mit App-Backup, Start/Neustart, Autostart, Watchdog und Ingress-Administratorzugriff wurden auf HA OS 18.4 / Core 2026.10.4 (amd64) geprüft. Reale Wetter-, Licht-, Klima-, Medien-, Szenen- und Sensorentitäten sind im privaten Dashboard zugeordnet und veröffentlicht. Keine Geräteaktionen wurden zur Abnahme ausgelöst. Bestehende HA-Dashboards und Konfigurationsdateien wurden nicht verändert.

Die Ingress-Player-API verwendet dieselbe Administratorprüfung wie Studio. Tests prüfen den Zugriffsschutz, veröffentlichte statt ungespeicherte Ziele und WebSocket-Aktualisierungen ohne zusätzliche Gerätesitzung. Der separate Displayserver bleibt an die Kopplung gebunden. Physisches iPad-/Touch-Verhalten ist weiterhin nicht abgenommen.

## 1.1.0 · Alarm und Überwachung

Zusätzliche automatisierte Prüfungen decken Alarm-Services, Moduslisten, Codeformate, führende Nullen in PINs, bereinigte HA-Fehler, Ratenbegrenzung und die unveränderten Rechte gekoppelter Displays ab. Kameratests prüfen bereinigte Metadaten, Entwurf-/Veröffentlichungsgrenzen, Bildgrößen, Cache-Wiederverwendung, HLS-Umschreibung, Range- und LL-HLS-Parameter sowie die Abweisung fremder und traversierender Pfade.

Im Browser sind die direkte Moduswahl, Bestätigung und Abbrechen, Kontaktfilter sowie die Konfiguration und Sortierung von Modi geprüft. Befehle wurden ausschließlich mit Beispieldaten ausgelöst. Die Kameraansicht wurde in 1080 × 810, 810 × 1080 und 800 × 480 geprüft; private Kamera-Raster bleiben außerhalb des öffentlichen Repositorys.
