# ScentOS v0.2.0 – Empfehlungsvorschau für Beta 1.0

GitHub-Pages-PWA mit **erklärbaren Top-3-Empfehlungen** aus der persönlichen Sammlung. Bisherige lokale IndexedDB-Daten werden weder gelöscht noch neu angelegt; das Datenbankschema ist unverändert.

## Neue Funktionen innerhalb des vereinbarten Beta-Umfangs
- Anlass manuell wählen, inklusive Freitext (gewinnt vor automatisch erkanntem Anlass).
- Tageszeit automatisch aus Gerätezeit, optional geplanten Zeitpunkt wählen.
- Open-Meteo-Wetter anhand **eines eingegebenen Orts ohne GPS** automatisch abrufen oder Temperatur manuell angeben, auch offline. Keine Wetterwerte werden als dauerhaft aktuell gespeichert.
- Bis zu drei Düfte: nur **vorhanden**, optional bestellte Proben; Wunschliste nie als tragbare Empfehlung. Optionaler Filter nur mit bestätigtem Approval.
- Unbewertete Düfte werden neutral gewertet, nie als abgelehnt. Profil-/Bewertungsdaten eines anderen Profils bleiben außen vor.
- Erklärung je Empfehlung und transparente Faktorbeiträge, von einem kleinen **vorläufigen Heuristik-Score (0–100)**.
- Der bestehende JSON-Export/Import, Duftsammel- und Testablauf funktioniert weiterhin.

## Vorläufiges Modell – K04/K05 noch nicht fachlich beschlossen
Die v0.2-Gewichte **Anlass 35, Wetter 25, Tageszeit 15, eigene Bewertung 15, Jahreszeit 10 %** werden proportional auf zusammen **95 %** reduziert. Die vereinbarten fünf persönlichen Eigenschaften erhalten **zusammen maximal 5 %**. Nur direkte Übereinstimmung einer Eigenschaft mit einem Katalog-Tag oder einer Duftnote wirkt positiv; **alle nicht zuordenbaren persönlichen Merkmale neutral (0,5)**. Es werden keine psychologischen Eigenschaften aus Duftnoten erraten.

Anlass-Tag-Aliase, Temperatureignung und Tageszeit sind bewusst **heuristisch**; fehlende Metadaten und Wetter bei Verbindungsproblemen zählen neutral. Der angezeigte Score ist kein objektives Gütesiegel. Nicht quantifizierte Duftbewertungen oder Approval-Kommentare werden nicht automatisch in eine Punktzahl übersetzt.

Wetterquelle: [Open-Meteo](https://open-meteo.com/). Der reine Ortsname wird an die Geocoding-API übertragen, kein GPS. Manuelles Wetter bleibt bei Offline-Nutzung möglich. Niederschlag/Luftfeuchte werden derzeit nicht numerisch gewichtet.

**Noch nicht implementiert:** Google-Calendar-OAuth und Veranstaltungsklassifizierung, voll ausgearbeitete gegenseitige Freigaben, bestätigte Tragehistorie. Kein Login, keine Geräte-Synchronisierung.

## Sicherheit, Deployment, Tests
Publiziere ausschließlich die Dateien dieses Ordners im öffentlichen GitHub-Repository. **Nie** die persönliche ScentOS-JSON-Datensicherung oder Testdaten in GitHub hochladen.

GitHub Pages: `Settings > Pages > Deploy from a branch > main > /(root)`; Änderungen am Branch lösen eine neue Bereitstellung aus.

Lokal: `python -m http.server 8080`, dann `http://localhost:8080`. Tests: `node --test tests/*.test.mjs`. Nach Deployment die installierte App **vollständig schließen und neu öffnen**, gegebenenfalls das PWA-Menü neu laden und unter „Empfehlungen“ die neue Ansicht prüfen. Kein Löschen von Website-Daten oder Neuinstallieren nötig.
