# Changelog

## 1.1.0

- Alarmpanel direkt in HAPanel: konfigurierbare Modi und Reihenfolge, Bestätigung, bedarfsabhängige PIN-Abfrage und Hinweise zu offenen oder unbekannten Kontakten.
- Neuer Kamerakacheltyp und Reiter Überwachung. Vorschaubilder und Streams werden über das Add-on ausgeliefert; HA-Kameratokens bleiben auf dem Server.
- Safari nutzt HLS direkt, andere Browser laden den HLS-Player bei Bedarf. Kameras ohne Stream-Unterstützung erhalten eine aktualisierte Bildfolge. Wiedergabe stoppt beim Schließen oder Ausblenden.
- Türen und Fenster lassen sich nach offen und nicht verfügbar filtern. Bedienungen verhindern doppelte Befehle während laufender Anfragen.
- Deutsche und englische Oberfläche, aktualisierte Vorschau und Dokumentation. Alarmsteuerung und Kamerabilder sind auf den bestehenden Administratorzugang über Ingress begrenzt. Bestehende Displaykopplungen behalten ihre bisherigen Rechte.

## 1.0.0

Erste finale Veröffentlichung. Die Zuhause-Übersicht unterstützt jetzt Lichtgruppen, Automationen, ein Alarmpanel mit Live-Status und direktem Zugang zur authentifizierten HA-Bedienung sowie offene Türen/Fenster mit klarer Kennzeichnung nicht erreichbarer Kontakte. Manuelle Automationsaufrufe respektieren bestehende Bedingungen. Die Schaltfläche zum Editor heißt „Designer öffnen“. Deutsch und Englisch, bestehende Räume und das Energiecockpit bleiben enthalten.

First final release. Home controls now include light groups, automations, alarm status linked to the existing authenticated Home Assistant panel, and door/window summaries that distinguish open, closed and unavailable contacts. Manual automation runs retain existing conditions. The editor button is now “Open Designer”. Existing room and energy views remain available.

## 0.2.0-alpha.1

Raumkacheln mit eigener Geräteansicht, Etagen-Navigation und individuellen Seitentiteln. Wetterdetails mit Stundenprognose und 24-Stunden-Verläufen. Energiecockpit für Solarleistung, Netzbezug/-einspeisung, Speicher und ausdrücklich gekennzeichnete erfasste Verbraucher; Tageswerte und Zählerstände bleiben getrennt. Beschattung mit Öffnen, Stoppen, Schließen und Position. Alle neuen Einstellungen sind im Studio auf Deutsch und Englisch bearbeitbar. Abwärtskompatible Erweiterung von Schema 1; vorhandene Veröffentlichungen werden nicht automatisch ersetzt.

Room cards with device details, floor navigation and page headings. Weather forecasts and scoped, cached 24-hour history. Energy cockpit with solar, grid, battery, monitored loads and individually labelled meter values. Cover controls and bilingual Studio settings. Existing dashboards remain unchanged until explicitly published.

## 0.1.0-alpha.5

Ingress-Startpfad relativ zum Supervisor-Präfix korrigiert. / Use the relative player entry path required by Supervisor URL concatenation.

## 0.1.0-alpha.4

Die HA-Seitenleiste öffnet jetzt das veröffentlichte Dashboard direkt über Ingress. Studio bleibt über „Studio erkunden“ erreichbar. Dashboard-Daten, Medien und Bedienaktionen nutzen denselben geprüften HA-Administratorzugang wie der Editor und benötigen weder separaten Netzwerkport noch zusätzliche Gerätesitzung. Der optionale eigenständige Displayserver verlangt weiterhin eine Kopplung. / The HA sidebar now opens the published player through authenticated Ingress, with Studio one click away. Separate display endpoints still require device pairing.

## 0.1.0-alpha.3

Fehlende konfigurierte Entitäten bleiben im Editor als nicht verfügbar sichtbar, statt irreführend die erste reale Entität auszuwählen. Dadurch kann auch die einzige verfügbare Entität eines Typs beim Wechsel von Beispieldaten auf Live-Daten korrekt zugeordnet werden. / Missing configured entities retain an explicit unavailable option, allowing the first or only real entity to be selected reliably.

## 0.1.0-alpha.2

Deutsch und Englisch sind jetzt in Studio, Dashboard, Kopplungsdialog und HAPanel-Fehlermeldungen verfügbar. Sprachwahl pro Browser mit automatischer Erkennung und englischem Fallback; Datums- und Zahlenformate folgen der Auswahl. Zentrale, typgeprüfte JSON-Kataloge ermöglichen weitere Sprachen. Eigene Dashboard-Texte, Layouts und HA-Einstellungen bleiben erhalten. Englische Dokumentation und zweisprachige Add-on-Optionen ergänzt.

## 0.1.0-alpha.1

Erste eigenständige Vorschau von HAPanel: gemeinsamer Kachelrenderer, visueller Editor, exakte Displayprofile, getrennte Entwürfe und Veröffentlichungen, JSON/YAML-Import und Export, HA-WebSocket-Adapter und widerrufbare Displaykopplung. Enthält eine statische iPad-Vorschau, Add-on-Paketierung und automatisierte Prüfungen. Echte Supervisor- und iPad-Hardwareabnahme stehen noch aus.
