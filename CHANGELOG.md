# Changelog

## 0.1.0-alpha.4

Die HA-Seitenleiste öffnet jetzt das veröffentlichte Dashboard direkt über Ingress. Studio bleibt über „Studio erkunden“ erreichbar. Dashboard-Daten, Medien und Bedienaktionen nutzen denselben geprüften HA-Administratorzugang wie der Editor und benötigen weder separaten Netzwerkport noch zusätzliche Gerätesitzung. Der optionale eigenständige Displayserver verlangt weiterhin eine Kopplung. / The HA sidebar now opens the published player through authenticated Ingress, with Studio one click away. Separate display endpoints still require device pairing.

## 0.1.0-alpha.3

Fehlende konfigurierte Entitäten bleiben im Editor als nicht verfügbar sichtbar, statt irreführend die erste reale Entität auszuwählen. Dadurch kann auch die einzige verfügbare Entität eines Typs beim Wechsel von Beispieldaten auf Live-Daten korrekt zugeordnet werden. / Missing configured entities retain an explicit unavailable option, allowing the first or only real entity to be selected reliably.

## 0.1.0-alpha.2

Deutsch und Englisch sind jetzt in Studio, Dashboard, Kopplungsdialog und HAPanel-Fehlermeldungen verfügbar. Sprachwahl pro Browser mit automatischer Erkennung und englischem Fallback; Datums- und Zahlenformate folgen der Auswahl. Zentrale, typgeprüfte JSON-Kataloge ermöglichen weitere Sprachen. Eigene Dashboard-Texte, Layouts und HA-Einstellungen bleiben erhalten. Englische Dokumentation und zweisprachige Add-on-Optionen ergänzt.

## 0.1.0-alpha.1

Erste eigenständige Vorschau von HAPanel: gemeinsamer Kachelrenderer, visueller Editor, exakte Displayprofile, getrennte Entwürfe und Veröffentlichungen, JSON/YAML-Import und Export, HA-WebSocket-Adapter und widerrufbare Displaykopplung. Enthält eine statische iPad-Demo, Add-on-Paketierung und automatisierte Prüfungen. Echte Supervisor- und iPad-Hardwareabnahme stehen noch aus.
