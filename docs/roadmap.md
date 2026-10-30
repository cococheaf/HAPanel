# Roadmap

## 0.1 · Funktionsfähige Vorschau

- [x] Eigenständiger Editor und Player mit gemeinsamem Kachelrenderer.
- [x] Licht, Klima, Medien, Wetter, Szene und Sensor.
- [x] Mehrere Seiten und Displayprofile mit festem Raster.
- [x] Drag/Resize, numerische Eigenschaften, Undo/Redo.
- [x] Entwurf, Veröffentlichung, Import/Export und Revisionen.
- [x] HA-WebSocket-Adapter, Ingress-Administratoren und Displaykopplung.
- [x] Statische, interaktive iPad-Demo ohne HA-Verbindung.
- [x] Add-on-Metadaten, Dockerfile und CI.

## Vor Freigabe für den Dauerbetrieb

- [ ] Installation, Update und Backup-Restore mit echtem Home Assistant Supervisor prüfen.
- [ ] Physisches iPad 8: Safari, Home-Screen-Start, Rotation, Touch-Drag/Resize, Schlafen/Aufwachen und Wiederverbindung abnehmen.
- [ ] Display-Cookies und WebSockets hinter einem realen HTTPS-Reverse-Proxy abnehmen.
- [ ] Servicefähigkeiten anhand verschiedener realer Licht-, Klima- und Medienintegrationen prüfen; erweiterte Temperatureinheiten ergänzen.
- [ ] Langzeittest auf kleinem ARM-Host und mit mehreren Displays.

## 0.2 · Display und Bedienkomfort

- [ ] Gemessene Display-Viewports ins Studio übernehmen, sichere Randbereiche pro Gerät kalibrieren.
- [ ] Mindestgröße von Touchflächen prüfen und kleine Layouts gezielt verbessern.
- [ ] Optional adaptive Layouts je Größenklasse; Profile bleiben explizit überschreibbar.
- [ ] Profile entfernen, Seiten umordnen und Räume als Kachelgruppen anlegen.
- [ ] Details für Lichtfarbe, Farbtemperatur und HVAC-Modi.
- [ ] Tastaturbedienung und Screenreader-Abnahme vertiefen.

## Danach

- [ ] Mehrsprachige Oberfläche und nutzerabhängige Zahlen-/Einheitenformate.
- [ ] Weitere Kacheltypen und ein dokumentiertes Widget-Modell.
- [ ] Explizite Schema-Migrationen vor Einführung einer zweiten Schemaversion.
- [ ] Signierte, vorgebaute Containerimages und automatisierte Releases.

Firmware, USB-Flashing, ESPHome-Generierung und Mikrocontroller-Protokolle gehören nicht zu HAPanel.
