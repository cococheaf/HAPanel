# Sicherheit

**Deutsch · [English](SECURITY.en.md)**

Der HA-Adapter läuft serverseitig mit den Berechtigungen seines HA-Zugangs; beim Supervisor ist das ein Administratorzugang. Der Editor ist über Ingress auf aktive HA-Administratoren beschränkt. Außerhalb von Ingress ist er nur lokal erreichbar.

Für echte Wanddisplays einen HTTPS-Endpunkt verwenden und `public_origin` entsprechend setzen. Den optionalen Display-Port nicht ungeschützt ins Internet weiterleiten. Das Backend verlangt auch im lokalen Netz eine Kopplung; eine Gerätesitzung darf die in der Veröffentlichung hinterlegten Bedienaktionen ausführen.

Die öffentliche Browservorschau enthält nur synthetische Zustände und hat keinen HA-Zugang. Dashboard-Exporte können private Entitätsnamen enthalten, aber keine serverseitigen Tokens oder Gerätesitzungen.

Bitte Sicherheitsprobleme über GitHubs **Report a vulnerability** im Repository melden, sobald Private Vulnerability Reporting aktiviert ist. Keine echten Tokens oder privaten HA-Konfigurationen in öffentliche Issues einstellen.

Alarmsteuerung benötigt standardmäßig den bestehenden Administratorzugang über Ingress. Die getrennte Option `alarm_access: authenticated` erlaubt konfigurierte Alarmbefehle für aktive HA-Benutzer und gültig gekoppelte Displays. Kameras bleiben standardmäßig ebenfalls auf diesen Zugang begrenzt. Die ausdrückliche Option `camera_access: authenticated` gibt veröffentlichte Kameras für aktive HA-Benutzer und gültig gekoppelte Displays frei. Nicht administrative HA-Benutzer erhalten einen Lesezugang zur veröffentlichten Ansicht; eine ausdrücklich aktivierte Alarmfreigabe ergänzt ausschließlich die konfigurierten Alarmbefehle. Andere Geräteaktionen bleiben für sie gesperrt. Diese eigene HAPanel-Freigabe bildet individuelle HA-Entitätsrechte nicht nach. Designer, Entwürfe und Geräteverwaltung bleiben auf Administratoren begrenzt. Nicht angemeldete und nicht gekoppelte Aufrufe bleiben ausgeschlossen; Kopplungswiderruf beendet aktive Kamera-WebRTC-Sitzungen. Alarmcodes werden nicht gespeichert; Kameratokens und private Streamadressen bleiben auf dem Server.

Kamera- und Alarmfreigabe werden unabhängig auf jeder Anfrage geprüft. Eine reine Alarmfreigabe eröffnet weder Kamera-HTTP-Ressourcen noch Kamera-WebRTC. Codepflicht und Codeformat stammen aus HA; PINs werden nicht gespeichert und HA-Fehler bereinigt. Alarmversuche sind auf fünf pro Minute pro HA-Benutzer beziehungsweise gekoppeltem Gerät begrenzt. Designer, Veröffentlichungen und Kopplungsverwaltung bleiben Administratoren vorbehalten.
