# Eigene Designs / Custom designs

**Deutsch · English below**

HAPanel bietet ab 2.1 vier Ausgangspunkte: **Glass Dunkel, Glass Hell, Aurora und Minimal**. Alle Designs sind editierbar; kein Display ist an eine Vorlage gebunden.

1. Im HA-Add-on **Designer öffnen** und oben das zu bearbeitende **Display** auswählen.
2. Rechts **Design** öffnen. Vorlage wählen oder Kachelstil, Hell/Dunkel, Hintergrundmotiv, Farben, Deckkraft, Unschärfe, Sättigung, Glaskante, Schatten, Rundung und Textgröße selbst einstellen. Die Arbeitsfläche zeigt jede Änderung sofort.
3. Unter **Meine Designs** einen Namen eingeben und speichern. Eine gespeicherte Vorlage auf einem anderen Display anwenden, ohne das ursprüngliche Design zu verändern. Entfernen und Anwenden lassen sich rückgängig machen.
4. Über **Exportieren / Importieren** eine Design-Datei austauschen. Sie enthält ausschließlich Gestaltung und einen selbst gewählten Namen, keine Entitäten, Kameraadressen oder Zugangsdaten. Maximal 24 Vorlagen, bis 16 KB pro Import. Import akzeptiert keine Skripte, externen URLs oder freies CSS.
5. Erst **Veröffentlichen** aktualisiert die Displays. Normale Displays enthalten keine Einrichtungsschaltflächen. Änderungen an einer Vorlage verändern bereits angewendete Kopien nicht.

**Glass-Übersicht hinzufügen** erstellt aus vorhandenen Kacheln eine zusätzliche Startseite mit vier Schnellzugriffen, zwei Raumgruppen, Energie und Wetter, sofern diese konfiguriert sind. Das Raster des ausgewählten Displays wird auf das Startlayout angepasst; bestehende Ansichten und Geräte bleiben erhalten. Rückgängig macht die gesamte Änderung rückgängig. Es werden keine Entitäten, Automationen oder Messwerte erfunden.

Die Bibliothek enthält **Abschnitt / Überschrift** als frei platzierbares Element ohne HA-Entität. Titel, Größe und Position sind frei; unter Aktionen kann ein Tipp auf eine andere Ansicht verweisen. Licht-, Automations-, Alarm- und Kontaktkacheln bieten zusätzlich die Darstellung **Kompakter Schnellzugriff**. Umfangreiche Bedienelemente sind dann in den Details erreichbar.

Bei schwächeren Displays hilft weniger Unschärfe oder **Deckend**. HAPanel berücksichtigt die Browserpräferenz für reduzierte Transparenz. Das klassische Erscheinungsbild bleibt für bestehende Layouts erhalten, bis ein Design gewählt wird. Hintergrundmotive sind lokal eingebunden; eigene Bild-Uploads und freie CSS-Themes sind derzeit nicht enthalten. Hintergrundfarbe wirkt beim einfarbigen Motiv und Farbverlauf; die Berglandschaft besitzt ihre eigene Farbpalette.

Konfigurationen mit neuen Designfeldern benötigen HAPanel 2.1 oder neuer. Für ein Downgrade die vor dem Update gesicherte Konfiguration verwenden.

---

HAPanel 2.1 includes **Glass Dark, Glass Light, Aurora and Minimal** as editable starting points.

1. In the HA app choose **Open designer**, select the target **Display**, then open **Design** in the inspector.
2. Adjust surface, appearance, wallpaper, colors, opacity, blur, saturation, edge, shadow, corner radius and text size. The canvas uses the same renderer as the display.
3. Name and save your design under **My designs**. Apply independent copies to other displays; editing a copy does not change the saved preset or another display. Apply/delete support undo.
4. Export/import appearance-only JSON files. No entity bindings, camera addresses or credentials are included. Up to 24 saved designs; imports up to 16 KB, strictly validated without executable CSS or remote URLs.
5. **Publish** to update displays. Configuration stays in the administrator’s designer.

**Add Glass overview** builds an additional editable page from existing quick controls, room views, energy and weather. It adapts the selected display’s grid, retains existing views and controls, and can be undone. It creates no HA entities, automations or fabricated readings.

Drag **Section / heading** into any view and optionally link it to another view. Lights, automations, alarms and contacts support **Compact quick control**, keeping detailed controls in their sheets. Lower blur or choose **Solid** for slower displays. Reduced-transparency preferences are respected. Existing classic layouts keep their appearance until a design is selected.

Wallpapers ship locally. Custom image uploads and arbitrary CSS themes are not included. Background color applies to plain/gradient wallpapers; the landscape has its own palette. New design fields require HAPanel 2.1+; restore the pre-update configuration when downgrading.
