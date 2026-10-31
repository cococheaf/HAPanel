# Roadmap

## HAPanel 2.0

- [x] Eigenständiger Editor/Player, echte HA-Daten, getrennte Entwürfe und Veröffentlichungen, Revisionen, JSON/YAML und Deutsch/Englisch.
- [x] Räume/Etagen, Energiecockpit, direkte Alarmbedienung und authentifizierte Kameras ohne Adminrolle nach ausdrücklicher Freigabe.
- [x] Mehrfachauswahl, Gruppenbewegung, Ausrichten, Verteilen, gleiche Größe, Kopieren/Einfügen und Positionssperre.
- [x] Raum-/Kamera-/Energievorlagen, Suche/Filter, Entitätsersatz und Layoutprüfung.
- [x] Layoutzuweisung pro Tablet, Browsermessung, Identifikation, zusätzliche Regeln pro Gerät/Benutzer und serverseitige Layoutgrenzen.
- [x] Adaptive Darstellung, Dichte, helle/dunkle Oberfläche, sichere Ränder, Nachtzeiten, Startansichten, Rückkehr, Wischen und Ruheansicht.
- [x] Kachelgesten, Bestätigung, bedingte Sichtbarkeit, Icons, Farben, Hintergründe und Zusatztexte.
- [x] Timer, Auswahlfelder, Zahlenregler, Ventilatoren, Staubsauger, Tasten, Lichtfarbe/Farbtemperatur, Klimamodi/Temperaturbereiche, Lamellenwinkel und Medienfavoriten.
- [x] Zustands- und HA-Ereignismeldungen mit optionaler Kamera, Streambudget und getrennte Vorschauquellen.
- [x] Recorder-Statistiken, explizite Energiezähler, mehrere unabhängige PV-Quellen und Schätzung mit festen Tarifen.
- [x] Diagnose, private Sicherung vor 2.0, dokumentiertes Widget-Modell und CI für amd64/arm64.

## Hardware- und Betriebsabnahme

- [ ] Physisches iPad: Safari/PWA, Finger-Drag/Resize, Rotation, Ruhezustand und Wiederverbindung.
- [ ] Physische Tablets mit unterschiedlichen Auflösungen und tatsächlich angemeldeten HA-Nicht-Administratoren.
- [ ] Vollständige Supervisor-Backup-Wiederherstellung in einer getrennten HA-Testinstallation.
- [ ] Display-Cookies und WebSockets hinter einem realen HTTPS-Reverse-Proxy.
- [ ] Mehrtägiger Betrieb mit mehreren Displays auf einem kleinen ARM-Host.
- [ ] Tatsächliche Kamera-Aufnahmeverzögerung und Codecverhalten auf verschiedenen UniFi-/Browser-Kombinationen.

## Weitere Entwicklung

- [ ] Zusätzliche Übersetzungskataloge und Community-Beiträge.
- [ ] Erweiterte Medienbibliothek, dynamische historische Stromtarife und weitere geprüfte Gerätetypen.
- [ ] Signierte vorgebaute Containerimages und zusätzliche Release-Automatisierung.
- [ ] Unabhängige Code-/Sicherheitsreviews und vertiefte Screenreader-Abnahme.

Das Projekt ist Vibe-coded. Offene Hardwareprüfungen werden nicht durch Simulatoren ersetzt. Mikrocontroller, USB-Flashing und Firmware gehören nicht zum Projekt.
