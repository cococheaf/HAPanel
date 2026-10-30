# Sicherheit

**Deutsch · [English](SECURITY.en.md)**

HAPanel ist in der Alpha-Phase. Der HA-Adapter läuft serverseitig mit den Berechtigungen seines HA-Zugangs; beim Supervisor ist das ein Administratorzugang. Der Editor ist über Ingress auf aktive HA-Administratoren beschränkt. Außerhalb von Ingress ist er nur lokal erreichbar.

Für echte Wanddisplays einen HTTPS-Endpunkt verwenden und `public_origin` entsprechend setzen. Den optionalen Display-Port nicht ungeschützt ins Internet weiterleiten. Das Backend verlangt auch im lokalen Netz eine Kopplung; eine Gerätesitzung darf die in der Veröffentlichung hinterlegten Bedienaktionen ausführen.

Die öffentliche Browserdemo enthält nur synthetische Zustände und hat keinen HA-Zugang. Dashboard-Exporte können private Entitätsnamen enthalten, aber keine serverseitigen Tokens oder Gerätesitzungen.

Bitte Sicherheitsprobleme über GitHubs **Report a vulnerability** im Repository melden, sobald Private Vulnerability Reporting aktiviert ist. Keine echten Tokens oder privaten HA-Konfigurationen in öffentliche Issues einstellen.
