# HAPanel installieren und bedienen

HAPanel ist ein **Vibe-Coding-Projekt mit KI-Unterstützung**. Der Initiator hat keine Programmiererfahrung und entwickelt die Idee durch Gestaltung und Praxistests weiter. Reviews und Beiträge sind willkommen; Entwicklung und Prüfgrenzen sind in [Prüfstand](docs/validation.md) dokumentiert.

**Deutsch · [English](DOCS.en.md)**

## Sprache

Studio, Dashboard und Kopplungsdialog unterstützen Deutsch und Englisch. Die Sprachwahl oben steht zunächst auf **Auto** und folgt den Browsersprachen. Bei nicht unterstützten Sprachen wird Englisch verwendet. **Deutsch** oder **English** wählen, um dies pro Browser bzw. Display zu überschreiben. Die Auswahl wird lokal gespeichert und verändert weder die HA-Sprache noch die Dashboard-Konfiguration.

Datum, Uhrzeit, Zahlen, Bedienelemente und HAPanel-Fehlermeldungen folgen der Auswahl. Unveränderte Beispielbezeichnungen passen sich ebenfalls an. Eigene Titel, Begrüßungen, Geräte- und Entitätsnamen bleiben als eingegebener Inhalt erhalten; die Auswahl übersetzt keine frei eingegebenen Texte. Sprache und Temperatureinheit sind unabhängig voneinander; HAPanel ändert keine Gerätesollwerte oder Temperatureinheiten beim Sprachwechsel.

## Öffentliche Vorschau auf dem iPad

1. <https://cococheaf.github.io/HAPanel/> in Safari öffnen.
2. Für eine passende Anordnung oben das Querformat- oder Hochformatprofil wählen.
3. Lichtschalter, Dimmer, Temperatur und Mediensteuerung ausprobieren.
4. **Designer öffnen** öffnet den visuellen Editor. Seiten und Kacheln bearbeiten; **Veröffentlichen** übernimmt die Änderungen in die Dashboard-Vorschau.
5. **Teilen → Zum Home-Bildschirm** fügt die Vorschau als eigenständige Web-App hinzu.

Die Vorschau besitzt Beispieldaten und speichert Konfigurationen nur im jeweiligen Browser. Safari und eine Home-Screen-Web-App können getrennte Speicherbereiche besitzen. Es wird kein Audio abgespielt. Fullscreen, Gerätesperre und dauerhaftes Wachhalten hängen vom verwendeten Betriebssystem ab.

## Home Assistant OS / Supervisor

Diese Version enthält ein aus Quellcode baubares Add-on für `amd64` und `aarch64`. Installation, Updates, Ingress und Live-Daten wurden auf Home Assistant OS 18.4 mit Core 2026.10.4 (amd64) geprüft. Für die erste Inbetriebnahme kann der voreingestellte Beispielmodus verwendet werden.

1. Unter **Einstellungen → Apps/Add-ons → App-Store → Repositories** dieses Repository hinzufügen:
   `https://github.com/cococheaf/HAPanel`
2. **HAPanel** installieren. Das Containerimage wird aus dem Repository gebaut; der erste Build kann einige Minuten dauern.
3. Starten und **In Seitenleiste anzeigen** aktivieren.
4. **HAPanel** in der HA-Seitenleiste öffnet das veröffentlichte Dashboard. **Designer öffnen** führt zum Editor. Der Designer verwendet den geprüften HA-Administratorzugang. Für angemeldete Benutzer ist die veröffentlichte Ansicht nach ausdrücklicher Freigabe unter `camera_access` ohne zusätzlichen Port verfügbar. Das Haus-Symbol im Studio führt zurück zum Dashboard.
5. Nach dem ersten Design-Test `demo_mode` auf `false` setzen und das Add-on neu starten. Die Kacheln im Studio den eigenen Entitäten zuordnen und veröffentlichen.

Das Add-on liest `/data/options.json` und schreibt ausschließlich in `/data/hapanel`. Es fordert HA-Core-API-Zugriff an, aber keine Supervisor-Verwaltungsrechte, Host-Netzwerkfreigaben oder HA-Konfigurations-Mounts.

### Optionen

| Option            | Standard | Bedeutung                                                                                                                                                         |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo_mode`       | `true`   | Beispieldaten verwenden. Ingress-Administratoren werden weiterhin über HA geprüft.                                                                                |
| `display_enabled` | `false`  | Separaten Displayserver auf Container-Port 8098 starten.                                                                                                          |
| `public_origin`   | leer     | Exakte externe HTTPS-Origin des Displayservers, z. B. `https://panel.example.net`. Aktiviert Secure-Cookies.                                                      |
| `camera_access`   | `admin`  | `admin`: bisheriger Administratorzugang; `authenticated`: veröffentlichte Ansicht samt Kameras für aktive HA-Benutzer und Kameras für gültig gekoppelte Displays. |
| `alarm_access`    | `admin`  | `authenticated` erlaubt konfigurierte Alarmbefehle zusätzlich für aktive HA-Benutzer und gültig gekoppelte Displays.                                              |

Ein geänderter Modus startet nicht automatisch Geräteaktionen. Im Live-Modus sind die Beispielentitäten zunächst möglicherweise nicht verfügbar; im Editor eigene Entitäten wählen.

## Wandtablet mit dem eigenen Add-on verbinden

1. `display_enabled: true` aktivieren und für Container-Port `8098/tcp` einen freien Host-Port vergeben. Port 8099 bleibt ausschließlich dem Ingress vorbehalten.
2. Den Displayserver über einen lokalen HTTPS-Reverse-Proxy erreichbar machen. `public_origin` auf genau diese Origin setzen. Der Proxy muss HTTP-WebSocket-Upgrades unterstützen und Pfade unverändert weitergeben.
3. Im Studio **Displays verbinden → Kopplungscode erstellen** wählen.
4. Auf dem Tablet `https://DEINE-PANEL-ADRESSE/display.html` öffnen, Anzeigename und Code eingeben.
5. Das gewünschte Displayprofil auswählen. Auf dem iPad optional zum Home-Bildschirm hinzufügen.

Kopplungscodes gelten fünf Minuten und können genau einmal verwendet werden. Gerätesitzungen werden als Hash gespeichert, sind 90 Tage gültig und lassen sich unter **Displays verbinden** widerrufen. Das beendet auch aktive Datenstreams. Displays sehen ausschließlich die veröffentlichte Konfiguration und deren freigegebene Entitäten.

Das Add-on richtet selbst keinen Reverse Proxy, DNS-Namen oder TLS-Zertifikate ein. Ingress ist der Editorzugang; für das unabhängige Wandgerät dient die separate Displayadresse. Im reinen Vorschautest kann ein lokaler HTTP-Endpunkt verwendet werden, ohne dass echte HA-Zugangsdaten in den Browser gelangen.

## Ohne Supervisor: Node.js

Der Editor bindet im Beispiel- und Standalone-Modus ausschließlich an Loopback. Eine LAN-Freigabe des Editors ist bewusst nicht vorgesehen; der Displayserver hat eine eigene Authentifizierung.

```sh
npm ci
npm run build
npm start
```

Für einen lokalen Live-Test `HAPANEL_MODE=standalone`, `HA_URL` und `HA_TOKEN` als Server-Umgebungsvariablen setzen. `HA_URL` ist die Basisadresse der HA-Instanz. Token nicht ins Frontend, ins Repository oder in die Dashboard-Konfiguration eintragen. `.env` wird ignoriert; wenn eine solche Datei genutzt wird, muss sie ausdrücklich durch die aufrufende Umgebung geladen werden. Das Programm liest keine `.env` automatisch.

| Variable                | Standard / Verwendung                                         |
| ----------------------- | ------------------------------------------------------------- |
| `HAPANEL_MODE`          | `demo`, alternativ `standalone` oder vom Add-on `ingress`     |
| `HAPANEL_DATA_DIR`      | `.data`, im Add-on `/data/hapanel`                            |
| `PORT`                  | `4310`, im Add-on `8099`                                      |
| `HA_URL`                | HA-Basisadresse im Standalone-Modus                           |
| `HA_TOKEN`              | Serverseitiger HA-Zugang im Standalone-Modus                  |
| `HAPANEL_DISPLAY_PORT`  | Wenn gesetzt, separaten Displayserver auf diesem Port starten |
| `HAPANEL_PUBLIC_ORIGIN` | Externe HTTPS-Origin des Displayservers                       |

## Editor

- **Kacheln:** Links einen Typ oder eine konkrete Entität anklicken. Desktop-Drag-and-Drop aus der Kachelbibliothek wird ebenfalls unterstützt. Auf Touchgeräten zum Hinzufügen antippen.
- **Verschieben:** Am Griff oben rechts ziehen. Kacheln rasten ein und verschieben andere Kacheln nicht automatisch.
- **Größe:** Am markierten Griff unten rechts ziehen oder Breite und Höhe im Eigenschaftenbereich ändern.
- **Tastatur:** Kachel auswählen, mit **Alt + Pfeiltasten** verschieben. **⌘/Strg + Z** macht rückgängig, mit zusätzlicher Umschalttaste wird wiederholt.
- **Seiten:** Unten Seite wechseln oder hinzufügen. Auf einer leeren Seite lässt sich rechts der Seitenname ändern. Eine Seite lässt sich entfernen, sobald ihre Kacheln entfernt wurden.
- **Displayprofile:** Oben wählen, rechts Maße und Raster bearbeiten. Jedes Profil besitzt eigene Kachelpositionen. Das Duplizieren kopiert alle Positionen in ein neues Profil.
- **Speichern:** Entwürfe werden nach einer kurzen Pause gespeichert. Bei einem Revisionskonflikt kann der sichtbare Entwurf weiterhin exportiert werden, bevor neu geladen wird.
- **Vorschau:** Verwendet dieselben Kacheln wie der Player. Gerätebedienung ist standardmäßig gesperrt. Der ausdrücklich eingeschaltete Testmodus führt im Live-Betrieb echte Aktionen aus.
- **Veröffentlichen:** Schaltet den gespeicherten Entwurf für gekoppelte Displays frei. Deren Ansicht aktualisiert sich ohne komplettes Neuladen.
- **Versionsverlauf:** Bis zu 30 ältere Entwürfe wiederherstellen. Das erzeugt einen neuen Entwurf; die Veröffentlichung bleibt bestehen.
- **Import/Export:** Versionierte HAPanel-Dokumente als JSON oder YAML. Ein Import verändert zuerst den Entwurf. Exporte enthalten Entitätsnamen und sollten entsprechend behandelt werden.

## Raum- und Energiekacheln

Im Eigenschaftenbereich unter **Kachelansicht** zwischen Gerät, Raum und Energie wechseln. Räume erhalten ein Symbol, optionale Temperatur-/Feuchtequellen, Kontakte und eigene Geräte. Die Geräte werden im antippbaren Raumdetail angezeigt. **Beim Antippen öffnen** kann stattdessen eine vorhandene Seite auswählen, etwa für eine Etagenübersicht. Seitenüberschrift und Beschreibung lassen sich auf einer nicht ausgewählten Kachel bearbeiten.

Für Energie werden ausschließlich vorhandene Sensoren gebunden. Solarquellen dürfen sich nicht überlappen; keinen Gesamtwert zusammen mit seinen Teilwerten addieren. Netzbezug und Einspeisung sind getrennte Leistungswerte. Das Vorzeichen der Batterieleistung entsprechend der Integration einstellen. Erfasste Verbraucher sind nur die ausgewählten Geräte und kein Hausgesamtverbrauch. Tageswerte und kumulierte Zählerstände individuell und eindeutig benennen. Unbekannte Werte bleiben als Strich sichtbar.

Ein Tipp auf Wetter, Messwert oder Energiequelle öffnet Details. Prognosen hängen von der Wetterintegration ab, 24-Stunden-Verläufe vom HA-Recorder. Es werden keine zusätzlichen History-Daten in HA angelegt. Bereits gespeicherte Layouts bleiben erhalten; die neue Beispielanordnung ersetzt keine eigenen Dashboards.

## Zuhause: Lichtgruppen, Automation und Sicherheit

Lichtgruppen verwenden die vorhandene HA-Lichtentität. Automationskacheln zeigen, ob die Automatik aktiviert ist; Ein/Aus steuert ihre Trigger. **Jetzt ausführen** ruft die Automation mit ihren bestehenden Bedingungen auf. Auf kleinen Kacheln ist der manuelle Aufruf in der Detailansicht erreichbar.

Das Alarmpanel zeigt den Live-Zustand und öffnet die Moduswahl direkt in HAPanel. Im Designer unter **Alarmmodi** lassen sich die angebotenen Modi aktivieren und sortieren. Unterstützt werden Unscharf, Zuhause, Abwesend, Nacht, Urlaub und benutzerdefinierter Bypass, soweit die HA-Integration diese unterstützt. Nicht unterstützte Modi sind deaktiviert. Vor jedem Befehl erscheint eine Bestätigung; offene und unbekannte Tür-/Fensterkontakte werden vor dem Scharfschalten angezeigt. Wenn HA einen Code verlangt, fragt HAPanel ihn als Passwort ab. Codes werden weder im Layout noch auf dem Server gespeichert. Ein bestätigter Befehl ersetzt keine Rückmeldung: Der angezeigte Alarmzustand stammt weiterhin aus HA.

Alarmbefehle sind standardmäßig dem HA-Administratorzugang über Ingress vorbehalten; `alarm_access: authenticated` erlaubt sie zusätzlich für aktive HA-Benutzer und gültig gekoppelte Displays. Kamerabilder können zusätzlich unter `camera_access: authenticated` für aktive HA-Benutzer und gültig gekoppelte Displays freigegeben werden. Der Standard `admin` erweitert bestehende Freigaben nicht.

## Überwachung

Im Designer eine Seite **Überwachung** und Kacheln vom Typ **Kamera** anlegen, dann die Kameraentitäten aus HA auswählen. Das Intervall der Vorschaubilder (15–120 Sekunden) und das Bildformat lassen sich pro Kachel einstellen. Erst das Antippen öffnet den Stream. Safari verwendet die native HLS-Wiedergabe; andere kompatible Browser laden einen HLS-Player bei Bedarf. Kameras ohne HLS-Unterstützung zeigen alle zwei Sekunden ein neues Bild. Beim Schließen oder Ausblenden der Seite stoppt die Wiedergabe.

Die Kamera wird ausschließlich über die bereits eingerichtete HA-Integration angesprochen. HAPanel speichert keine UniFi-Zugangsdaten, erstellt keine Aufzeichnungen und liefert keine HA-Kameratokens an den Browser aus. Die öffentliche Vorschau zeigt ausdrücklich Beispielplätze für Kameras und keine privaten Kamerabilder.

**Türen & Fenster** enthält eine konfigurierbare Kontaktliste. Offene Kontakte stehen im Detail zuerst, nicht erreichbare Kontakte werden separat ausgewiesen. „Keine offenen gemeldet“ bedeutet nicht, dass unbekannte Kontakte sicher geschlossen sind. Alle neuen Einstellungen sind im Designer bearbeitbar.

## Displaymaße

Hardwareauflösung und Browserfläche sind verschieden. Das iPad 8 besitzt 2160 × 1620 Hardware-Pixel im Querformat und bei DPR 2 rechnerisch 1080 × 810 CSS-Pixel. Browserleisten und geschützte Randbereiche können die verfügbare Fläche reduzieren. Die Schaltfläche **Auflösung und Pixelverhältnis übernehmen** berechnet zunächst die rechnerische CSS-Größe; bei Bedarf anschließend an den tatsächlichen Viewport anpassen.

**Proportional einpassen** erhält das Seitenverhältnis. **Exakte CSS-Pixel** rendert ohne Skalierung; auf zu kleinen Viewports entsteht ein scrollbarerer Ausschnitt. Die Zoomanzeige im Studio beschreibt den Faktor relativ zur automatisch eingepassten Arbeitsfläche. Die tatsächliche physische Größe auf dem Editor-Monitor wird nicht aus der Zolldiagonale abgeleitet.

Das Display-Info-Menü zeigt den aktuellen Viewport und DPR. Im Standalone-Modus der Home-Screen-Web-App verschwinden Vorschauleiste und Browsernavigation aus der HAPanel-Oberfläche. Betriebssystemeigene Elemente kontrolliert die Webseite nicht.

## Sichern und aktualisieren

Im Add-on werden die privaten Daten bei normalen Updates beibehalten. Vor Updates eine HA-Sicherung und einen JSON/YAML-Export erstellen. Eine Neuinstallation kann den privaten Add-on-Speicher entfernen. `dashboard.json` enthält Entwurf, Veröffentlichung und Verlauf; `devices.json` enthält ausschließlich gehashte Kopplungs- und Sitzungsdaten. Ungültige gespeicherte Dashboard-Dateien werden beim Start nicht überschrieben.

## Display-Verwaltung ab 1.2

1. **Designer öffnen** → oben unter **Display bearbeiten** das gewünschte Display wählen. Die Auswahl wird im Browser gemerkt.
2. **Displays verwalten** → **Display hinzufügen** für ein neues Layout. Bestehende Maße übernehmen und wahlweise alle Ansichten kopieren oder leer starten.
3. Im selben Dialog bei einer Ansicht auf das Kopiersymbol tippen. Ein vorhandenes oder **Neues Display erstellen …** als Ziel wählen. Die Kopie behält alle Kacheln und wird an das Zielraster angepasst. Navigation zu nicht verfügbaren Ansichten wird entfernt.
4. Pfeile ändern die Ansichtsreihenfolge. Das Papierkorbsymbol entfernt auch gefüllte Ansichten nach Bestätigung. Die letzte Ansicht und das letzte Display können nicht gelöscht werden.
5. Der Papierkorb am Display entfernt dessen Layout und Ansichten. **Rückgängig** und der Versionsverlauf können Änderungen am Entwurf wiederherstellen. Erst **Veröffentlichen** übernimmt sie auf den Geräten.
6. **Geräte verwalten** verwaltet Browserkopplungen. **Zugang widerrufen** meldet genau diesen Browser ab; seine Layouts bleiben erhalten. Layoutauswahl ist keine Berechtigungsgrenze: Die bisherigen Serverberechtigungen gelten weiterhin.

Die früher gemeinsam genutzten Ansichten werden beim ersten Start unabhängig pro Display kopiert. IDs des ersten Displays und bestehende Entitätsbindungen bleiben erhalten. Die unveränderte Originaldatei wird als `dashboard-before-display-views.json` im privaten Add-on-Verzeichnis gespeichert. Entwurf, Veröffentlichung und Verlauf bleiben getrennt. Ein JSON-Export vor dem Update und das HA-App-Backup ermöglichen die Rückkehr zur vorherigen Version. Alte App-Versionen können die erweiterte Datei nicht lesen; für einen Rollback das zugehörige Backup wiederherstellen.

## Kamera-Verbindung und Liveübersicht

Jede Kamerakachel besitzt **Kameraübersicht: Standbild / Livestream** und **Verbindung: Automatisch / WebRTC / HLS**. Automatisch ermittelt die aktuellen HA-Kamerafähigkeiten. WebRTC vermeidet den HLS-Puffer. Ist die direkte Verbindung nicht erreichbar, nutzt HAPanel nach begrenzter Wartezeit HLS. Der Verbindungsweg ist an der Live-Anzeige sichtbar. **Zur Livekante springen** und ein kleinerer Puffer helfen bei HLS; sie garantieren keine bestimmte Verzögerung der Kamera oder des Netzwerks.

Die WebRTC-Signalisierung läuft über das Add-on mit derselben Freigabeprüfung wie Standbilder und HLS. Medien nutzen die lokale Verbindung, die HA vermittelt. HAPanel verwendet keine externen STUN-/TURN-Dienste, fragt kein Mikrofon an und installiert keinen weiteren Kameraserver. Über Netzgrenzen oder Fernzugriffe kann deshalb der HLS-Rückfall erforderlich sein. Router, Firewall und HA-Benutzerrollen werden nicht verändert. Die zusätzliche HAPanel-Kamerafreigabe wird ausdrücklich über `camera_access` gewählt.

Live-Kacheln starten nur sichtbar und pausieren hinter einem geöffneten Detaildialog. Auf leistungsschwächeren Tablets für mehrere gleichzeitige Livekacheln möglichst einen niedrigeren, bereits in HA verfügbaren Kamerakanal wählen. Kameras ohne Videostream behalten die aktualisierte Bildfolge.

## Icon

`public/mark.svg` ist die skalierbare Quelle des HAPanel-Icons. `npm run icons` erzeugt Browser-, iPad- und Web-App-PNGs sowie `icon.png`/`logo.png` für das Add-on. Die eigenständige Display-Web-App besitzt ein eigenes Apple-Touch-Icon; eine innerhalb der HA-App geöffnete Oberfläche ersetzt nicht das HA-App-Icon.

## Lichtoptionen und Texteingaben

Im Designer die Lichtkachel auswählen und **Schaltverhalten** öffnen. Die beiden Checkboxen erlauben Ein/Aus, nur Ein, nur Aus oder eine reine Zustandsanzeige. Geräte in einer Raumkachel besitzen dieselben Optionen unter dem jeweiligen Gerät. Ohne eigene Einstellung bleibt Ein/Aus aktiv. Dimmen wird nur für nachweislich dimmbare Lampen und vollständig dimmbare Gruppen angeboten. Gemischte und unvollständig bekannte Gruppen bleiben ohne Slider. Eingeschränkte Schaltbedienung blendet den Dimmer aus.

Die Fähigkeiten werden aus den HA-Farbmodi und rekursiv aus Gruppenmitgliedern ermittelt. Zusätzliche Gruppenmitglieder werden nicht an Displays ausgeliefert und erhalten keine weiteren Live-Abonnements. HA-Metadaten werden gecacht; nach Änderungen an HA-Gruppen den Designer nach etwa einer Minute neu laden.

Eigene Texte behalten ihre Leerzeichen. Leere Pflichtfelder sind während des Umbenennens vorübergehend erlaubt, werden aber nicht gespeichert. **Veröffentlichen** aktiviert die gültige Konfiguration.

Die Erweiterung bleibt in Schema 1 und liest vorhandene Konfigurationen mit bisherigen Standardaktionen. Ältere HAPanel-Versionen kennen die neuen Lichtoptionen nicht. Vor einem Downgrade die zum alten Add-on passende Sicherung wiederherstellen; die Update-Sicherung im Supervisor beibehalten.

## Kamerafreigabe für Benutzer und Tablets

Die Add-on-Option **Kameraanzeige** (`camera_access`) bietet `admin` (Standard) und `authenticated`. Bei `authenticated` dürfen aktive, über HA angemeldete Benutzer die veröffentlichte Ansicht samt Kameras lesen. Designer, Entwürfe und Geräteverwaltung bleiben gesperrt. Andere Gerätebedienung bleibt gesperrt; Alarmbefehle sind separat über `alarm_access` freigebbar. Gültig gekoppelte Tablets erhalten Kamerabilder zusätzlich zu ihren bisherigen Bedienrechten. Ohne Anmeldung oder gültige Kopplung sind Standbilder, HLS-Dateien und WebRTC gesperrt.

Die Veröffentlichung bildet die Freigabeliste. Alle dort gebundenen Kameras sind für die genannten Betrachter sichtbar; Kamera-Ziele oder HA-Services können nicht frei angegeben werden. Dies ist eine eigene Freigabe durch den HAPanel-Administrator; individuelle HA-Entitätsrechte werden nicht nachgebildet. Kameratokens und private Streamadressen bleiben serverseitig.

Nach einer Änderung speichern und die App neu starten. Die Sidebar ist auch für Nicht-Administratoren sichtbar; ohne die Freigabe bleibt die Daten-API für sie gesperrt. Kopplungswiderruf beendet aktive Kamera-WebRTC-Sitzungen. Aktive HA-Konten werden nachgeprüft (30 Sekunden Rollen-Cache, 20 Sekunden Sitzungsprüfung). Die Option `admin` sperrt gekoppelte und nicht administrative Kameraansichten wieder.

Im eigenständigen Betrieb entspricht `HAPANEL_CAMERA_ACCESS=authenticated` dieser Freigabe; ohne die Variable bleibt `admin` aktiv.

## Alarmpanel für Nicht-Administratoren

Die Option **Alarmbedienung** (`alarm_access`) ist unabhängig von der Kameraanzeige: `admin` ist der Standard, `authenticated` erlaubt aktive HA-Benutzer und gültig gekoppelte Tablets. Nach einer Änderung speichern und neu starten. Es werden nur Alarm-Entitäten und Modi bedient, die in der veröffentlichten HAPanel-Konfiguration gebunden sind. Ein normaler HA-Betrachter erhält dadurch ausschließlich Alarmbedienung zusätzlich zu seiner Ansicht; andere Gerätebefehle, Designer, Entwürfe und Geräteverwaltung bleiben gesperrt.

PIN-Pflicht und PIN-Format stammen von der HA-Alarm-Entität. Führende Nullen bleiben erhalten; Codes werden nach dem Absenden im Eingabefeld gelöscht und nicht gespeichert oder in Fehlern ausgegeben. Die Modusbestätigung, Verbindungsprüfung, Hinweise zu Kontakten und die Begrenzung auf fünf Alarmversuche pro Minute und Benutzer beziehungsweise gekoppeltem Gerät bleiben aktiv.

| Zugang                  | Kameraanzeige   | Alarmbedienung | Andere Geräte          | Designer |
| ----------------------- | --------------- | -------------- | ---------------------- | -------- |
| HA-Administrator        | Ja              | Ja             | Ja                     | Ja       |
| Aktiver HA-Benutzer     | `camera_access` | `alarm_access` | Nur Anzeige            | Nein     |
| Gekoppeltes Tablet      | `camera_access` | `alarm_access` | Bisherige Bedienrechte | Nein     |
| Ohne Anmeldung/Kopplung | Nein            | Nein           | Nein                   | Nein     |

Für eigenständige Installationen entspricht `HAPANEL_ALARM_ACCESS=authenticated` dieser Freigabe. Die Freigabe verändert keine HA-Benutzerrollen und bildet individuelle HA-Entitätsrechte nicht nach.
