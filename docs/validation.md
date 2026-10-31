# Prüfstand für 2.0.1

## Automatisiert

84 Tests mit Node.js-Test-Runner: Geometrie aller Beispielprofile, Schema- und Domänenvalidierung, Rastergrenzen und Überlappungen, Revisionskonflikte, Entwurf/Veröffentlichung/Wiederherstellung, persistente Sitzungen, einmalige Kopplungscodes, Zugriffsschutz für Ingress und lokale Verwaltung, eingeschränkte Display-API, YAML-Import und aktiver WebSocket-Widerruf.

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

## 1.2.0 · Displays und WebRTC

Automatisierte Prüfungen ergänzen unabhängige Ansichten, unveränderte Entitätsbindungen, stabile Migration, bytegenaue Original-Sicherung, Kopieren auf neue und unterschiedlich große Displays, Löschgrenzen, Navigation, Erscheinungsbild und Lokalisierung. Ein simulierter HA-WebSocket prüft WebRTC-Signalisierung, private Sitzungsschlüssel, Cache und Freigabe der HA-Sitzung. API-Prüfungen decken Ingress-Schutz, feste Kamerabindung und Sitzungsende bei Änderung der Veröffentlichung ab.

Im Browser wurden Anlage, Kopieren einer Ansicht auf ein neues und ein vorhandenes Display, Löschen gefüllter Ansichten, Entfernen eines Displays und Rückgängig mit reinen Beispieldaten geprüft. Die Verwaltung wurde auf 1440 × 900 und im iPad-Hochformat geprüft. Keine echten Gerätezugänge wurden für die Abnahme widerrufen oder erstellt.

## 1.3.0 · Licht und Eingaben

Gezielte Regressionen prüfen Dimmfähigkeit mit ausgeschalteten Lampen, On/Off-Geräten mit irreführendem Helligkeitsattribut, gemischten, verschachtelten und unvollständigen Gruppen sowie Zyklen. Der HA-Simulator prüft, dass Gruppenmetadaten keine zusätzlichen Mitgliedsabonnements oder Zustandsfreigaben erzeugen und ein unerlaubter Dimmerbefehl keinen Serviceaufruf erreicht.

Einseitige Schaltregeln und Zustandsanzeige werden in verschachtelten Geräten, im Action-Resolver und über die veröffentlichte HTTP-API geprüft. Verbotene Toggle-, Ein- und Dimmerbefehle bleiben wirkungslos. Texte behalten Leerzeichen über Schema- und JSON-Roundtrips. Echte Lichter werden zur Abnahme nicht geschaltet.

Die Durchsicht umfasst Schema und Migration, Entwurf/Veröffentlichung, Eingaben, Lichtaktionen, WebSocket-Daten, Kamera- und Alarmgrenzen, Kopplungen, Übersetzungen und Builds. Das ist keine vollständige Hardware-, Langzeit- oder unabhängige Sicherheitsprüfung; die offenen Abnahmen bleiben oben dokumentiert.

Im Browser wurden alle vier Licht-Schaltmodi mit Beispieldaten durchgespielt, Dimmer in Raumdetails ein-/ausgeblendet, ein Raumgerät hinzugefügt und per Undo wieder entfernt. Seitenname und Überschrift wurden Wort für Wort eingegeben und nach Neuladen im gespeicherten Entwurf wiedergefunden. Deutsch/Englisch sowie Designer bei 1440 × 900 und 810 × 1080 wurden geprüft.

## 1.4.0 · Kamera-Zugriff ohne Administratorrolle

API- und WebSocket-Tests prüfen aktive normale HA-Benutzer, deaktivierte/unbekannte Konten, gefälschte Ingress-Header, Origin-Prüfung und die Standardoption ohne zusätzliche Freigabe. Nach ausdrücklicher Freigabe sind Standbilder, HLS-Ressourcen, Fähigkeiten und WebRTC auf veröffentlichte Kamera-IDs begrenzt. Normale HA-Betrachter können keine Geräteaktionen, Alarmbefehle, Entwürfe, Veröffentlichungen oder Kopplungsverwaltung aufrufen.

Gekoppelte Kameraansichten verlangen weiterhin eine gültige Sitzung; Widerruf beendet WebRTC und entzieht nachfolgende HTTP-Abrufe. Eine deaktivierte HA-Identität beendet aktive Viewer- und Kamera-Sockets nach erneuter Prüfung. Administrator- und Viewerprüfung teilen denselben Rollen-Cache. Eine Anmeldung mit einem tatsächlichen Nicht-Administrator-Account und ein physischer Tablet-Test sind nicht durch den Simulator ersetzt.

## 1.5.0 · Getrennte Alarmfreigabe

Regressionstests prüfen Alarmzugang für normale HA-Benutzer und gekoppelte Tablets bei gesperrter Kameraanzeige. Nur veröffentlichte Alarmziele und konfigurierte Modi werden akzeptiert; PIN-Pflicht, numerisches Format und führende Nullen bleiben erhalten. Andere Geräteaktionen, Designer und Kopplungsverwaltung bleiben für normale HA-Betrachter gesperrt. Fehlende, fremde oder widerrufene Sitzungen bleiben abgewiesen.

Standbilder, HLS-Ressourcen, Fähigkeiten und Kamera-WebRTC bleiben ohne Kamerafreigabe auch bei aktiver Alarmfreigabe gesperrt. Zwei gekoppelte Geräte hinter derselben IP erhalten unabhängige Alarm-Versuchslimits; private HA-Fehler werden weiterhin bereinigt. Die Prüfungen verwenden ausschließlich synthetische Alarme. Die reale Alarmanlage wird zur Abnahme nicht scharf oder unscharf geschaltet.

Im Browser wurde der gebaute Player mit einem lokalen, synthetischen Nicht-Administrator geprüft: Designer ausgeblendet, normale Licht-/Automationsbefehle deaktiviert, Alarmmodi bedienbar. PIN-Abfrage, Bestätigung, Rückmeldung und das Leeren des Codefelds wurden durchgespielt; der Beispielalarm wurde anschließend wieder deaktiviert. Deutsch und Englisch wurden bei 1080 × 810 geprüft. Die Testumgebung besitzt weder eine echte HA-Adresse noch HA-Zugangsdaten.

Der Abhängigkeitscheck berücksichtigt die neuen Meldungen [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) und [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Ein auf `@fastify/static` begrenzter Override verwendet `glob` 14.0.3 und darüber `minimatch` 11.0.3. Die von HAPanel verwendete statische Auslieferung wird nach dem Update am Produktionsbuild geprüft. Der Override kann entfallen, sobald die direkte Bibliothek selbst einen gepatchten Versionsbereich verwendet.

## 2.0.0 · Flexibler Designer und Displaybetrieb

84 automatisierte Tests prüfen zusätzlich: veröffentlichte Gesten und einseitige Lichtregeln, bedingte Abonnements, unbekannte Zustände, adaptive Geometrie ohne Änderung der gespeicherten Positionen, atomare Gruppenoperationen, gesperrte Kacheln, Raumvorlagen, Entitätsersatz, originale Sicherung vor 2.0, persistente zusätzliche Geräte-/Benutzerregeln, Layoutgrenzen für Snapshot/Aktionen/History/Statistiken/Kameras und die Auflösung von Alarmkamera-Verweisen auf freigegebene Kopien.

Ein lokaler HA-WebSocket prüft Registry-Metadaten, Cache-Wiederverwendung, Einheiten für Recorder-Statistiken und die Zurückweisung nicht unterstützter beziehungsweise nicht schrittgerechter Werte vor einem Serviceaufruf. Kameraübersicht und Detailquelle bleiben über getrennte API-Pfade an veröffentlichte Entitäten gebunden. Kopierte Layouts erhalten passende Gesten- und Startseitenverweise. Beispiel-Timer behalten reale Fristen sowie Restzeit beim Pausieren.

Im Browser geprüft: Mehrfachauswahl und Kopieren in eine neue leere Vorlage, Import/Entwurf/Prüfung/Veröffentlichung, helle adaptive Ansicht bei tatsächlich gemessenen 1080 × 810 und 810 × 1080 CSS-Pixeln, englische Oberfläche sowie eine schmale 375 × 812 Ansicht ohne horizontalen Seitenüberlauf. Der Desktop-Designer wurde bei 1440 × 900 geprüft. Die Viewport-Änderung wurde jeweils nach Neuladen anhand der tatsächlichen DOM-Fläche kontrolliert.

Ein isoliertes Backend mit ausschließlich synthetischen Daten und dem Produktionsbuild prüft die normale Kopplung, Messung, Identifikation und Layout-/Sprachzuweisung. Änderungen auf Nur-anzeigen und auf ein einziges erlaubtes Layout erschienen ohne Reload auf dem gekoppelten Testdisplay. Rücknahme der Einschränkung, Übernahme der Messung als Entwurf und Undo wurden ebenfalls geprüft. Timer, Auswahl, Zahlenregler, Staubsauger und Tasten lieferten bestätigte simulierte Zustandsänderungen. Ein veröffentlichtes Testereignis zeigte eine Klingelmeldung. Fehlende statistische Daten wurden als unbekannt dargestellt.

Die veröffentlichten neuen Screenshots enthalten ausschließlich Beispieldaten. Es wurden keine echten Lampen, Beschattungen, Automationen, Alarmzustände oder HA-Benutzerrollen für die Prüfung verändert. Physische iPad-, reale Benutzeranmeldung-, HTTPS-Proxy-, vollständige Supervisor-Wiederherstellungs- und mehrtägige ARM-Prüfungen bleiben offen. Ein Simulator und eine Browsergrößenprüfung ersetzen diese Abnahmen nicht.

## 2.0.1 · Einstellungen und Detailfenster

- Browserkontrolle mit gekoppeltem Testdisplay und synthetischen Daten bei 1080×810 und 375×812 CSS-Pixeln.
- Wetterdetails geöffnet, nach Scrollen geschlossen und erneut geöffnet; Escape geprüft.
- Gekoppelte Displays ohne Einrichtungsleiste; administrativer Designerzugang wird gesondert geprüft.
- Detaildialog direkt unter `body`; Schließen-Fläche im sichtbaren Bereich, mindestens 48 Pixel hoch und beim Hit-Test erreichbar.
- Zusätzlich Bildschirmklicks auf Schließen in macOS Safari geprüft.
- Die konkret gemeldete Touch-Störung ließ sich auf dem Desktop nicht zuverlässig reproduzieren. Die Korrektur entfernt die Abhängigkeit der Dialoge von skalierten und begrenzten Kacheln; die Prüfung am physischen iPad bleibt offen.
