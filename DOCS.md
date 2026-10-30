# HAPanel installieren und bedienen

## Öffentliche Demo auf dem iPad

1. <https://cococheaf.github.io/HAPanel/> in Safari öffnen.
2. Für eine passende Anordnung oben das Querformat- oder Hochformatprofil wählen.
3. Lichtschalter, Dimmer, Temperatur und Mediensteuerung ausprobieren.
4. **Studio erkunden** öffnet den visuellen Editor. Seiten und Kacheln bearbeiten; **Veröffentlichen** übernimmt die Änderungen in die Dashboard-Demo.
5. **Teilen → Zum Home-Bildschirm** fügt die Demo als eigenständige Web-App hinzu.

Die Demo besitzt Beispieldaten und speichert Konfigurationen nur im jeweiligen Browser. Safari und eine Home-Screen-Web-App können getrennte Speicherbereiche besitzen. Es wird kein Audio abgespielt. Fullscreen, Gerätesperre und dauerhaftes Wachhalten hängen vom verwendeten Betriebssystem ab.

## Home Assistant OS / Supervisor

Diese Alpha enthält ein aus Quellcode baubares Add-on für `amd64` und `aarch64`. Es wurde noch nicht auf einer echten Supervisor-Installation abgenommen. Für die erste Inbetriebnahme den voreingestellten Demo-Modus verwenden.

1. Unter **Einstellungen → Apps/Add-ons → App-Store → Repositories** dieses Repository hinzufügen:
   `https://github.com/cococheaf/HAPanel`
2. **HAPanel** installieren. Das Containerimage wird aus dem Repository gebaut; der erste Build kann einige Minuten dauern.
3. Starten und **In Seitenleiste anzeigen** aktivieren.
4. Studio als HA-Administrator öffnen. Der Server prüft die von Ingress gelieferte Benutzer-ID gegen die aktiven HA-Administratoren.
5. Nach dem ersten Design-Test `demo_mode` auf `false` setzen und das Add-on neu starten. Die Kacheln im Studio den eigenen Entitäten zuordnen und veröffentlichen.

Das Add-on liest `/data/options.json` und schreibt ausschließlich in `/data/hapanel`. Es fordert HA-Core-API-Zugriff an, aber keine Supervisor-Verwaltungsrechte, Host-Netzwerkfreigaben oder HA-Konfigurations-Mounts.

### Optionen

| Option            | Standard | Bedeutung                                                                                                    |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `demo_mode`       | `true`   | Beispieldaten verwenden. Ingress-Administratoren werden weiterhin über HA geprüft.                           |
| `display_enabled` | `false`  | Separaten Displayserver auf Container-Port 8098 starten.                                                     |
| `public_origin`   | leer     | Exakte externe HTTPS-Origin des Displayservers, z. B. `https://panel.example.net`. Aktiviert Secure-Cookies. |

Ein geänderter Modus startet nicht automatisch Geräteaktionen. Im Live-Modus sind die Beispielentitäten zunächst möglicherweise nicht verfügbar; im Editor eigene Entitäten wählen.

## Wandtablet mit dem eigenen Add-on verbinden

1. `display_enabled: true` aktivieren und für Container-Port `8098/tcp` einen freien Host-Port vergeben. Port 8099 bleibt ausschließlich dem Ingress vorbehalten.
2. Den Displayserver über einen lokalen HTTPS-Reverse-Proxy erreichbar machen. `public_origin` auf genau diese Origin setzen. Der Proxy muss HTTP-WebSocket-Upgrades unterstützen und Pfade unverändert weitergeben.
3. Im Studio **Displays verbinden → Kopplungscode erstellen** wählen.
4. Auf dem Tablet `https://DEINE-PANEL-ADRESSE/display.html` öffnen, Anzeigename und Code eingeben.
5. Das gewünschte Displayprofil auswählen. Auf dem iPad optional zum Home-Bildschirm hinzufügen.

Kopplungscodes gelten fünf Minuten und können genau einmal verwendet werden. Gerätesitzungen werden als Hash gespeichert, sind 90 Tage gültig und lassen sich unter **Displays verbinden** widerrufen. Das beendet auch aktive Datenstreams. Displays sehen ausschließlich die veröffentlichte Konfiguration und deren freigegebene Entitäten.

Das Add-on richtet selbst keinen Reverse Proxy, DNS-Namen oder TLS-Zertifikate ein. Ingress ist der Editorzugang; für das unabhängige Wandgerät dient die separate Displayadresse. Im reinen Demo-Test kann ein lokaler HTTP-Endpunkt verwendet werden, ohne dass echte HA-Zugangsdaten in den Browser gelangen.

## Ohne Supervisor: Node.js

Der Editor bindet im Demo- und Standalone-Modus ausschließlich an Loopback. Eine LAN-Freigabe des Editors ist bewusst nicht vorgesehen; der Displayserver hat eine eigene Authentifizierung.

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

## Displaymaße

Hardwareauflösung und Browserfläche sind verschieden. Das iPad 8 besitzt 2160 × 1620 Hardware-Pixel im Querformat und bei DPR 2 rechnerisch 1080 × 810 CSS-Pixel. Browserleisten und geschützte Randbereiche können die verfügbare Fläche reduzieren. Die Schaltfläche **Auflösung und Pixelverhältnis übernehmen** berechnet zunächst die rechnerische CSS-Größe; bei Bedarf anschließend an den tatsächlichen Viewport anpassen.

**Proportional einpassen** erhält das Seitenverhältnis. **Exakte CSS-Pixel** rendert ohne Skalierung; auf zu kleinen Viewports entsteht ein scrollbarerer Ausschnitt. Die Zoomanzeige im Studio beschreibt den Faktor relativ zur automatisch eingepassten Arbeitsfläche. Die tatsächliche physische Größe auf dem Editor-Monitor wird nicht aus der Zolldiagonale abgeleitet.

Das Display-Info-Menü zeigt den aktuellen Viewport und DPR. Im Standalone-Modus der Home-Screen-Web-App verschwinden Demo-Leiste und Browsernavigation aus der HAPanel-Oberfläche. Betriebssystemeigene Elemente kontrolliert die Webseite nicht.

## Sichern und aktualisieren

Im Add-on werden die privaten Daten bei normalen Updates beibehalten. Vor Updates eine HA-Sicherung und einen JSON/YAML-Export erstellen. Eine Neuinstallation kann den privaten Add-on-Speicher entfernen. `dashboard.json` enthält Entwurf, Veröffentlichung und Verlauf; `devices.json` enthält ausschließlich gehashte Kopplungs- und Sitzungsdaten. Ungültige gespeicherte Dashboard-Dateien werden beim Start nicht überschrieben.
