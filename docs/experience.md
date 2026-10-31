# HAPanel 2.0 bedienen

HAPanel ist ein Vibe-Coding-Projekt mit KI-Unterstützung. Diese Anleitung beschreibt implementierte Funktionen. Physische iPad-, Reverse-Proxy- und Langzeittests sind im [Prüfstand](validation.md) getrennt ausgewiesen.

## Einrichten und gestalten

1. **Designer öffnen** und oben unter **Display bearbeiten** die Layoutvorlage wählen.
2. Über **Aus Vorlage erstellen** eine Raum-, Kamera-, Energie- oder leere Ansicht ergänzen. Räume und Etagen stammen aus HA. Geräte werden ausdrücklich ausgewählt; vorhandene Ansichten bleiben erhalten. Die Energievorlage fragt nach einer PV-Leistungsquelle. Weitere Quellen stehen danach in den Kacheleinstellungen.
3. Kacheln hinzufügen, am Griff bewegen oder an der Ecke vergrößern. Umschalt-Tipp wählt mehrere Kacheln. Pfeiltasten bewegen die Auswahl; ⌘/Strg C und V kopieren und fügen ein. Die Zwischenablage gilt nur innerhalb des Designers. Fehlende Fläche lehnt den gesamten Vorgang ab.
4. **Gestaltung & Bedienung** öffnet optionale Einstellungen: Icon, Hintergrund, Wert/Verlauf, Zusatzzeile, Positionssperre, Tipp-/Halteaktion und Sichtbarkeitsbedingung. Unterstützte Aktionen hängen von den tatsächlichen Gerätefähigkeiten ab. Sensoren bleiben reine Anzeigen. Lichtgruppen mit gemischten Fähigkeiten erhalten keinen Dimmer.
5. **Layout prüfen** zeigt fehlende Entitäten, nicht verfügbare Geräte, kleine Kacheln und ungültige Navigationsziele. Fehlende Entitäten lassen sich ersetzen. Warnungen sind sichtbar; bewusst weiterverwendete Offline-Geräte verhindern eine Veröffentlichung nicht.
6. Erst **Veröffentlichen** übernimmt den Entwurf auf Displays. Entwürfe, Revisionen und Wiederherstellung bleiben getrennt. Eine zusätzliche lokale Entwurfssicherung kann nach einem Verbindungsabbruch zur Wiederherstellung angeboten werden.

**Geräte aktualisieren** lädt Katalog und Raumzuordnungen neu. Die Bibliothek filtert nach Raum und Funktion und kann bereits platzierte Geräte ausblenden. Die Suche findet außerdem Layouts und Ansichten. ⌘/Strg K fokussiert sie. Einfache Bearbeitung reduziert die Werkzeuge; kleine Ansichten behalten die bestehenden Bibliotheks- und Eigenschaften-Schaltflächen.

## Ein Tablet zuordnen

**Geräte koppeln** öffnet **Displays & Zugriffe**. Eine Layoutvorlage kann mehreren Tablets zugeordnet werden. Das Löschen einer Vorlage und der Widerruf eines Gerätezugangs sind getrennte Vorgänge.

Pro Gerät werden Layout, Startansicht, Sprache und zusätzliche Einschränkungen gespeichert. Die letzte gemessene Browserfläche und der letzte Kontakt werden angezeigt. **Display identifizieren** zeigt den Namen 15 Sekunden auf dem verbundenen Display. **Gemessene Fläche übernehmen** ändert nur den Layoutentwurf und blendet dort die Werkzeugleiste aus; anschließend veröffentlichen.

Die Messung erfasst CSS-Pixel, Pixelverhältnis und Kontaktzeit. Hardwareauflösung und die tatsächlich verfügbare Browserfläche bleiben unterschiedliche Werte. Safari-Leisten und eine HA-Seitenleiste können die Fläche verändern. Kalibriere deshalb in dem Betriebsmodus, in dem das Tablet später verwendet wird.

Unter **Display → Gestaltung & Bedienung**: Dichte, hell/dunkel/automatisch, Hintergrund, adaptive Anordnung, sichere Ränder, Wischen, Startseite, Rückkehrzeit und Ruheansicht. Adaptive Anordnung verändert nur die Darstellung und erhält die gespeicherten Rasterpositionen. Bei wenig Höhe darf die Ansicht scrollen. Die Werkzeugleiste lässt sich über das schwebende Zahnrad wieder einblenden.

Nachtzeiten verwenden die Uhr des Browsers. Ruheansicht und Nachtfarben steuern die Webseite; sie ändern weder iPad-Helligkeit noch Gerätesperre. Ein gesperrtes iPad wird dadurch nicht aufgeweckt.

## Zugriffe begrenzen

Die globalen Optionen `camera_access` und `alarm_access` bleiben die Obergrenze. Geräte- und Benutzerregeln können Zugriffe zusätzlich einschränken, keine globale Freigabe erweitern. Administratoren behalten den Designerzugang.

- **Nur anzeigen** sperrt Geräte- und Alarmbefehle.
- **Kameras sperren** und **Alarmbedienung sperren** gelten unabhängig voneinander.
- **Erlaubte Layouts** begrenzt die veröffentlichten Daten, Aktionen, Verläufe, Statistiken und Kameraendpunkte serverseitig.
- Die **Layoutzuweisung** allein ist eine Startauswahl. Für eine Zugriffsbeschränkung zusätzlich erlaubte Layouts auswählen.
- HA-Benutzer werden über ihre Namen ausgewählt; die Benutzer-ID ist alternativ manuell eintragbar. Normale HA-Benutzer erhalten dadurch keine allgemeine Gerätebedienung. Die gesonderte Alarmfreigabe aus 1.5 bleibt erhalten.

Kopplungen bleiben widerrufbar. Neue Funktionen erstellen keine neuen HA-Zugangsdaten und ändern keine HA-Benutzerrollen.

## Meldungen und Klingelkamera

**Meldungen & Ereignisse** definiert Titel, Nachricht, Bedingung, Priorität, Dauer, Ziel-Displays und optional eine veröffentlichte Kamera. Zustandsmeldungen erscheinen beim Wechsel einer Bedingung von falsch zu wahr. Das erste Laden und die erste Zustandsaufnahme nach einer Unterbrechung erzeugen keine nachträglichen Meldungen. Nicht verfügbare Daten werden nicht als erfüllte Bedingung behandelt.

Eine bestehende HA-Automation kann eine veröffentlichte Meldung über ein Ereignis auslösen. Der Designer zeigt die Regel-ID. Beispiel:

```yaml
event: hapanel_alert
event_data:
  rule_id: alert_id_aus_dem_designer
```

HAPanel nimmt ausschließlich die ID einer veröffentlichten Regel entgegen. Nachricht, Ziel-Displays und Kamera stammen aus der veröffentlichten Konfiguration. Das Ereignis führt keine Geräteaktion aus. Eine Kamerameldung respektiert die Kamerafreigabe. Meldungen können die Ruheansicht der Webseite verlassen, jedoch keine Betriebssystemsperre umgehen.

## Kameraübersicht

Die normale Entität einer Kamerakachel ist die Detailquelle. **Sparsame Kameraquelle für die Übersicht** kann einen bereits vorhandenen weiteren Kamera-Kanal derselben Kamera verwenden. HAPanel aktiviert keine zusätzlichen HA-Entitäten. Standbilder und Live-Übersichten verwenden diese Quelle; Details verwenden weiterhin die normale Entität.

Das Limit gleichzeitiger Live-Vorschauen ist pro Layout von 1 bis 8 einstellbar, Standard 2. Weitere Kacheln bleiben per Detailansicht erreichbar. Unsichtbare, verdeckte und im Hintergrund liegende Streams pausieren. WebRTC versucht eine direkte Verbindung; Auto kann auf HLS zurückfallen. Keine zusätzlichen externen STUN-/TURN-Server werden eingerichtet.

Die Detailansicht zeigt Startzeit und bei HLS den Abstand zum Pufferrand. Diese Werte messen keine Verzögerung zwischen Kameraaufnahme und Wiedergabe. Auflösung, Kamera, HA und Netzwerk beeinflussen die tatsächliche Latenz. Die Diagnose zählt über HAPanel weitergeleitete Kamerabytes; direkter WebRTC-Datenverkehr ist darin nicht enthalten.

## Energie und Verlauf

Im Energiecockpit lassen sich Bezugs-, Einspeise-, Erzeugungs- und Hausverbrauchszähler zuordnen. Mehrere PV-Zähler müssen unabhängige Anlagen beziehungsweise disjunkte Quellen abdecken. Ein zusätzlicher PV-Zähler darf nicht bereits im Hauptzähler enthalten sein.

Die Auswertung nutzt HA-Recorder-Statistiken abgeschlossener Stunden für 24 Stunden, 7 und 30 Tage. Energiezähler verwenden Änderungen, Messwerte ihre Mittelwerte. Wh/kWh/MWh werden normalisiert. Fehlende oder unpassende Daten bleiben offen. Historische Statistiken werden bedarfsgesteuert geladen und fünf Minuten zwischengespeichert.

Eigenverbrauch benötigt vollständige Erzeugung und Einspeisung, Autarkie einen echten Hausverbrauchszähler und Netzbezug. Bei Batteriesystemen müssen die gewählten Messgrenzen zur Interpretation passen. Die Kostenanzeige ist eine Schätzung mit den eingetragenen festen Bezugs- und Einspeisetarifen. Sie bildet keine dynamischen historischen Tarife oder Stromrechnung nach. Ohne Preise wird kein Betrag erfunden.

## Sicherung und Diagnose

Beim ersten Start mit vorhandenen Daten werden `dashboard-before-2.0.json` und `devices-before-2.0.json` im privaten Add-on-Verzeichnis angelegt. Die erste Sicherung wird nicht überschrieben. Bestehende Schema-1-Konfigurationen bleiben gültig. Unbekannte Schemaversionen werden weiterhin abgelehnt.

**Diagnose** zeigt Version, Verbindung, abonnierte Entitäten, Revisionen und zusammengefasste Proxy-Datenmenge. Der Download enthält keine HA-Tokens, Alarmcodes, Geräte-Sitzungsschlüssel, Kamerabilder oder Entitätsnamen. Ein Supervisor-Backup und die HAPanel-Revisionshistorie ergänzen diese Sicherungen.
