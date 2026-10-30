# Architektur

HAPanel ist eine eigenständige Browseranwendung. Es editiert keine Lovelace-Dashboards und installiert keine HA-Frontend-Ressourcen.

```text
HA Ingress ──> Editor API ───────────┐
                                   │
Studio ──> gemeinsames Modell ──> DocumentStore
                                   │ Entwurf / Veröffentlichung / Revisionen
                                   │
Browserdisplay ──> Display API ──────┘
                       │
                  HomeAssistantHub ──> HA WebSocket API
```

## Module

| Verzeichnis          | Verantwortung                                                                     |
| -------------------- | --------------------------------------------------------------------------------- |
| `src/shared`         | Versioniertes Schema, Geometrie, erlaubte Aktionen und synthetische Beispieldaten |
| `src/client/ui`      | Gemeinsame Kacheln und Dashboardrahmen                                            |
| `src/client/editor`  | React Grid Layout, Eigenschaften, History und Veröffentlichungsablauf             |
| `src/client/display` | Unabhängiger Player und Kopplungsoberfläche                                       |
| `src/client/demo`    | Rein statische Vorschau, Browserpersistenz und lazy geladener Editor              |
| `src/server`         | Fastify, Persistenz, Ingress-/Display-Zugriff, HA-Adapter                         |

Die Vite-Einstiegspunkte für Editor und Player sind getrennt. Der Player lädt den Grid-Editor nicht. Der statische Vorschau-Build enthält ausschließlich Browsercode und Grafiken; es gibt dort weder einen Backendprozess noch HA-Verbindungsparameter.

## Persistenz und Veröffentlichungen

`DocumentStore` serialisiert Schreiboperationen innerhalb eines Prozesses. Validierte Dokumente werden zunächst in eine Datei im gleichen Verzeichnis geschrieben und atomar umbenannt. Ein Revisionsvergleich verhindert, dass zwei Editorinstanzen einander still überschreiben. Eine Veröffentlichung kopiert eine unveränderliche Revision des Entwurfs; Wiederherstellen erzeugt eine neue Revision.

Ein Prozess ist der vorgesehene Schreibbesitzer eines Datenverzeichnisses. Mehrere Backendinstanzen dürfen nicht dasselbe Verzeichnis beschreiben. Die Dateiatomizität ersetzt keine externen Backups. Schemaversion 1 wird aktuell akzeptiert; unbekannte Versionen werden abgelehnt. Die erste Formatänderung benötigt eine explizite Migration mit Sicherung.

## Echtzeitdaten

Ein HA-WebSocket pro Live-Backend hält `subscribe_entities` für die Vereinigung der in Entwurf und Veröffentlichung verwendeten Entitäten. Hinzu kommen stündliche Wetter-Abonnements, soweit die Integration diese unterstützt. Der Editor lädt den Entitätenkatalog bedarfsgesteuert; er wird kurzzeitig zwischengespeichert.

Der HA-Adapter verarbeitet initiale Zustände, komprimierte Attributänderungen und entfernte Entitäten. Nach einer Unterbrechung verbindet er sich mit wachsendem Abstand erneut und baut die Abonnements neu auf. Die UI markiert die Verbindung als unterbrochen und sperrt die Gerätebedienung; Aktionen werden nicht für spätere Ausführung zwischengespeichert.

Im Beispielmodus des Add-ons existiert zusätzlich ein reiner HA-Authentifizierungsclient: Beispieldaten kommen aus dem Beispieldaten-Hub, die Administratorberechtigung eines Ingress-Benutzers wird weiterhin über HA verifiziert.

## Berechtigungen

Ingress-Identität wird ausschließlich von der dokumentierten Supervisor-Quelladresse akzeptiert. Fehlende Benutzer-IDs, nicht aktive Benutzer und Nicht-Administratoren werden abgewiesen. `panel_admin` ist eine Anzeigeeinstellung und ersetzt diese Serverprüfung nicht. Die Standalone-Verwaltung ist ausschließlich auf Loopback erreichbar und validiert zusätzlich den Host.

Display-Endpunkte sind separat registriert und besitzen keine Verwaltungsrouten. Gerätesitzungen werden über HttpOnly-/SameSite-Cookies identifiziert. Mit konfigurierter HTTPS-Origin sind Cookies zusätzlich Secure. Kopplungscodes und Sitzungen werden nur gehasht persistiert. Widerruf beendet aktive Displaystreams.

Der Server bestimmt aus einer Kachel-ID deren Zielentität und den zulässigen HA-Service. Clients können keine beliebigen Entitäten, URLs oder Services übergeben. HA-Zugangsdaten werden weder an den Browser übertragen noch in Dashboard-Dateien gespeichert. Supervisor-Zugang ist ein Administratorzugang, weshalb eine Veröffentlichung die Freigabe der dort enthaltenen Bedienaktionen bedeutet.

Album-Art ist auf bildliefernde HA-API-Pfade der konfigurierten Instanz begrenzt; es gibt keinen allgemeinen URL-Proxy. Weiterleitungen werden nicht verfolgt, Anfragen sind zeitlich begrenzt und Bilder dürfen maximal 5 MiB groß sein.

## Räume, Energie und Verläufe

Raum- und Energieansichten ergänzen das bestehende Schema 1 durch optionale Felder. Räume enthalten eigene typisierte Geräte mit eindeutigen IDs; deren Bedienung wird wie bei Hauptkacheln serverseitig geprüft. Navigation verweist ausschließlich auf vorhandene Seiten. Alle Raum- und Energiequellen fließen in dieselbe gefilterte Entitätenliste ein.

Verläufe werden erst beim Öffnen der Details aus der HA-History-API geladen. Der Zugriff ist auf Entitäten im berechtigten Entwurf bzw. in der Veröffentlichung beschränkt. Vier Minuten Cache, begrenzte Antwortgrößen, Zeitlimits und reduzierte Datenpunkte halten die Last klein. Im Live-Modus werden fehlende Messwerte oder Verläufe nicht durch Beispieldaten ersetzt.

Leistung (W/kW) und Energie (Wh/kWh) werden getrennt normalisiert. Solarquellen müssen disjunkt gewählt werden, Netzbezug und Einspeisung werden getrennt gebunden; das Vorzeichen der Batterieleistung ist konfigurierbar. Erfasste Einzelverbraucher sind ausdrücklich kein berechneter Hausgesamtverbrauch. Tageswerte und kumulierte Zählerstände benötigen eindeutige Beschriftungen.

## Layout

Kachelinhalt und Positionierung sind getrennt. Eine Kachel hat pro Displayprofil einen Rasterbereich. Der Editor verwendet React Grid Layout ohne automatische Verdichtung; der Player berechnet aus denselben Rastermaßen feste Rechtecke. Identische Rundung auf CSS-Pixel hält Vorschau und Player deckungsgleich.

Hardwareauflösung, Pixelverhältnis, Browserfläche, Raster und reservierte Kopf-/Navigationsflächen werden getrennt gespeichert. „Einpassen“ skaliert proportional; „Exakt“ behält CSS-Pixel bei. Automatisches Reflow ist eine spätere, ausdrücklich wählbare Strategie. Aktuell werden alternative Anordnungen über eigenständige Profile gepflegt.

## Prüfungen und Grenzen

Automatisierte Tests prüfen Schema und Rastergrenzen, persistente Revisionen, Konflikte, Veröffentlichungstrennung, Kopplung/Replay/Widerruf, Ingress-Vertrauensgrenzen, Display-Zugriff und den HA-WebSocket-Dialog gegen einen lokalen Simulator.

Zusätzlich erforderlich ist eine Abnahme mit echtem Supervisor, realen Gerätefähigkeiten und Safari auf physischer iPad-Hardware. Der Testsimulator ersetzt diese Abnahme nicht. Die ersten Klima-Steuerelemente sind auf ein einzelnes Temperatursoll ausgelegt; erweiterte HVAC-Modi, Temperaturbereiche und Fahrenheit folgen in einer weiteren Ausbaustufe.

## Alarm und Kamera

Alarmbefehle werden aus einer pro Kachel konfigurierten Liste von Modi auf feste HA-Services abgebildet. Entity-ID und Service bestimmt der Server. Die Laufzeitprüfung berücksichtigt unterstützte Funktionen und erforderliche Codes. Fehler enthalten keine von HA zurückgespiegelten Codes. Pro Administrator sind fünf Alarmversuche pro Minute erlaubt. Die bestehende Ingress-Administratorprüfung gilt für Editor und Player; separat gekoppelte Displays erhalten keine neuen Alarm-/Kamerarechte.

Kamerametadaten werden vor Katalog- und Snapshot-Ausgabe auf Name, unterstützte Funktionen und Streamtyp reduziert. Bilder und HLS-Ressourcen laufen durch einen authentifizierten Proxy. Bilder sind auf 5 MiB, Playlists auf 256 KiB und Segmente auf 12 MiB begrenzt. Playlists werden auf zufällige lokale Ressourcen-IDs umgeschrieben und dürfen den jeweiligen HA-Stream-Pfad nicht verlassen. HA-Streamadressen, Kameratokens und Supervisor-Zugangsdaten bleiben auf dem Server. Vorschaubilder werden kurz zwischengespeichert; Streams starten erst in der Detailansicht. Das Add-on transkodiert selbst keine Videos.

## Unabhängige Display-Ansichten

Seiten können über `profileIds` einem Display zugeordnet sein; fehlende Zuordnungen bedeuten beim Import zunächst alle Profile. Eine deterministische Migration kopiert gemeinsam genutzte Seiten in unabhängige Ansichten. Der erste Besitzer behält IDs, Kopien erhalten eigene IDs und angepasste Navigation. `originId` bewahrt die Herkunft für Navigation und die Lokalisierung unveränderter Beispieltexte. Validierung prüft Layouts nur in ihren zugeordneten Profilen, 1–12 Ansichten pro Display und maximal acht Displays. Kopieren zwischen Rastern erhält jede Kachel oder lehnt einen unmöglichen Kopiervorgang vollständig ab.

WebRTC nutzt `camera/capabilities`, `camera/webrtc/get_client_config`, `camera/webrtc/offer` und `camera/webrtc/candidate`. Sitzung und Entität bleiben serverseitig gebunden. Schließen und Veröffentlichung geänderter Bindungen beenden die zugehörige HA-Sitzung. Begrenzte SDP-/ICE-Größen, Nachrichten- und Sitzungsgrenzen sowie erneute Autorisierung begrenzen Ressourcen. ICE-Serverzugangsdaten werden nicht ausgegeben; der Browser verwendet lokale Host-Kandidaten ohne externe STUN-/TURN-Dienste.
