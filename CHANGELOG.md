# Changelog

## 2.0.2

- Kachelinhalte passen sich automatisch an Breite und Höhe der Kachel an: Schrift, Icons, Abstände und Bedienelemente skalieren gemeinsam.
- Identische Darstellung beim Verkleinern im Designer und auf veröffentlichten Displays. Lange Überschriften dürfen umbrechen.
- Medienkacheln passen Album-Art und Bedienung an; umfangreiche Energieauswertungen bleiben scrollbar. Geöffnete Details bleiben in normaler Größe.

## 2.0.1

- Detailfenster werden außerhalb der skalierten Dashboard-Kacheln gerendert, damit Schließen-Flächen in Safari nicht von Skalierung und Clipping der Karten abhängen.
- Größere, beschriftete Schließen-Schaltflächen mit eindeutigen Touch-Zielen.
- Reine Displays zeigen keine Einstellungen oder Einrichtungsleiste. Im HA-Add-on bleibt für Administratoren nur „Designer öffnen“.
- Wisch-Navigation ignoriert geöffnete Dialoge und setzt abgebrochene Gesten zurück.

## 2.0.0

- Displayverwaltung mit Layoutzuweisung, Messung, Identifikation und zusätzlichen Geräte-/Benutzerregeln.
- Adaptive Layouts, Dichte, Hell-/Dunkelmodus, Nachtzeiten, Ruheansicht, sichere Ränder, Startseite, Rückkehr und Wischen.
- Mehrfachauswahl, Gruppenbewegung, Ausrichten, Verteilen, Kopieren/Einfügen, Sperren, Vorlagen, Filter und Layoutprüfung.
- Konfigurierbare Tipp-/Halteaktionen, Bedingungen, Icons, Farben, Hintergründe und Zusatztexte.
- Neue Timer-, Auswahl-, Zahlen-, Ventilator-, Staubsauger- und Tastenkacheln; erweiterte Licht-, Klima-, Beschattungs- und Medienfunktionen.
- Zustands- und HA-Ereignismeldungen mit Kameradetails; getrennte Vorschauquellen, konfigurierbare Streambudgets und Diagnose der Startzeit.
- Energie-Statistiken für 24 Stunden, 7 und 30 Tage, explizite Zähler, mehrere unabhängige PV-Quellen und Schätzung mit festen Tarifen.
- Private unveränderliche Sicherungen vor 2.0, Diagnose ohne Zugangsdaten, Widget-Vertrag und aktualisierte DE-/EN-Dokumentation.
- Bestehende Ansichten und globale Kamera-/Alarmfreigaben bleiben erhalten. Zusätzliche Zugriffsregeln können Rechte nur einschränken.

## 1.5.0

- Indirekte Bibliotheken für die statische Dateiauslieferung auf gepatchte Versionen aktualisiert.

- Eigene Option `alarm_access: authenticated` für Alarmbedienung durch aktive HA-Benutzer und gültig gekoppelte Tablets. Standard bleibt `admin`; Kamerafreigabe und Alarmfreigabe sind unabhängig.
- Nur veröffentlichte Alarm-Entitäten und konfigurierte Modi sind bedienbar. HA-Codeabfragen, Bestätigung und Begrenzung wiederholter Versuche bleiben erhalten.
- Normale HA-Betrachter können bei Alarmfreigabe das Alarmpanel bedienen; andere Geräte und der Designer bleiben geschützt. Kamera-HTTP und WebRTC prüfen ihre eigene Freigabe auch bei reinem Alarmzugang.
- Deutsche/englische Hinweise, Rollenübersicht und zusätzliche Tests für PINs, freigegebene Modi, Kopplungen und versuchsweise Rechteüberschreitung ergänzt.

## 1.4.0

- Explizite Kamerafreigabe für aktive HA-Benutzer ohne Administratorrolle und gültig gekoppelte Tablets über `camera_access: authenticated`. Standard `admin` erhält bestehende Freigaben.
- Veröffentlichung, Kameraanzeige, Gerätebedienung und Designerrechte sind getrennt. Neue HA-Betrachter erhalten Lesezugriff; Alarm und Designer bleiben auf Administratoren begrenzt.
- Einheitliche Prüfung für Standbilder, HLS und WebRTC, erneute Kontoprüfung und sofortiges Beenden der Kamera-WebRTC-Sitzung nach Kopplungswiderruf. Keine anonymen Kamerastreams und keine frei wählbaren Kameraentitäten.
- Nicht administrative Ansichten zeigen „Nur Anzeige“. Sidebar-Sichtbarkeit, deutsche/englische Hinweise und Dokumentation ergänzt.

## 1.3.0

- Licht-Dimmer nur bei bestätigter Dimmfähigkeit; Gruppen werden rekursiv geprüft. Gemischte oder unvollständig bekannte Gruppen und normale Schalter erhalten keinen Slider. Fehlende Helligkeitswerte bleiben unbekannt.
- Checkboxen für Ein/Aus, nur Ein, nur Aus oder reine Zustandsanzeige, auch für Geräte in Räumen. Gesperrte Aktionen und Dimmerbefehle werden im Backend abgewiesen.
- Leerzeichen in Seitenüberschriften und eigenen Beschriftungen bleiben beim Tippen und Speichern erhalten. Pflichtfelder lassen sich zum Umbenennen vorübergehend leeren.
- Raumgeräte können auch über HTTP hinzugefügt werden; Entitätsauswahl alphabetisch sortiert und neue Namen auf das erlaubte Format begrenzt.
- Gefilterte Snapshots kopieren nur benötigte Entitäten; gecachte Gruppenmetadaten erzeugen keine zusätzlichen Live-Abonnements.
- Dokumentation auf Deutsch und Englisch, transparenter Hinweis auf das Vibe-Coding-Projekt und erweiterte Regressionstests.

## 1.2.0

- Zentrale Display-Verwaltung: Layouts auswählen, anlegen, duplizieren und entfernen; Ansichten kopieren, auch auf neue Displays, sortieren und mit ihren Kacheln löschen.
- Ansichten, Raster, Farben und Begrüßung lassen sich pro Display unabhängig bearbeiten. Kopien erhalten eigene Kachel-IDs, passende Layouts und angepasste Navigation. Bestehende Konfigurationen werden automatisch überführt; die Originaldatei wird vorher separat gesichert.
- WebRTC über die vorhandene HA-Kamera-Schnittstelle als bevorzugte Verbindung, mit HLS-Rückfalloption. Kleinere HLS-Puffer und eine Funktion zum Sprung an die Livekante reduzieren den zusätzlichen Player-Versatz.
- Konfigurierbare Live-Kameraübersicht je Kachel. Wiedergabe pausiert außerhalb des sichtbaren Bereichs, im Hintergrund und hinter einer Detailansicht. WebRTC-Sitzungen werden beim Schließen freigegeben.
- Neues HAPanel-Icon als SVG, PNG, iPad-Touch-Icon und maskierbares Web-App-Icon.
- Geräteverwaltung ist klar von Display-Layouts getrennt. Widerruf benötigt eine Bestätigung, das Ablaufdatum des Zugangs ist sichtbar.

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
