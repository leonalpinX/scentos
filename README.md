# ScentOS 0.1.2 | GitHub Pages Testversion

Dies ist ein **öffentlicher, bereinigter statischer Veröffentlichungsstand**, **nicht** die vollständig abgenommene Beta 1.0.

## Veröffentlichung

1. Auf GitHub ein neues **öffentliches** Repository `scentos` erstellen (ohne automatisch generierte README oder Gitignore).
2. **Alle Dateien und den `assets`-Ordner aus diesem entpackten Verzeichnis** direkt ins Wurzelverzeichnis des Repositories hochladen und committen; die ZIP-Datei selbst nicht hochladen.
3. In Repository-**Settings > Pages** unter **Build and deployment** die Quelle **Deploy from a branch** und danach `main` sowie `/(root)` wählen, **Save**.
4. Wenn GitHub die Bereitstellung bestätigt, die unter Pages angezeigte URL öffnen.

**Hinweis zur Datensicherheit:** GitHub-Pages-Seiten sind öffentlich erreichbar. Daher enthält dieses Paket **ausschließlich öffentliche Duftstammdaten** und ein generisches leeres Profil `Mein Profil`. Es enthält **keine** privaten Sammlungen, Approver-Namen, Bewertungen oder Testergebnisse. Eingaben im Browser bleiben in dessen **lokaler IndexedDB**, ohne Login und ohne Gerätesynchronisierung. Auf gemeinsam genutzten Geräten sind diese Daten nicht passwortgeschützt. Browserdaten können beim Löschen verloren gehen; regelmäßiger JSON-Export ist wichtig.

Persönliche Sammlungen, Approvals und Dufttests dürfen **niemals in das öffentliche Repository hochgeladen werden**. Individuelle Sicherungen lassen sich ausschließlich im eigenen Browser im Bereich **Daten sichern > Fehlende Einträge importieren** einlesen. Danach im Profil-Auswahlmenü auf das gewünschte persönliche Profil wechseln.

## Abnahmestand

Die Modelltests und die isolierten Chromium-UI-Tests der Ausgangsversion waren erfolgreich. Eine vollständige Abnahme von GitHub-Pages-Hosting, echter IndexedDB-Persistenz nach Neustart, Service Worker, Offline-Betrieb und PWA-Installation steht noch aus.

Einschränkungen: keine Empfehlungen, kein Wetter/Google Calendar, keine gegenseitig überprüfte Approval-Freigabe und keine Synchronisierung. Nur eine lokale Datenmodell-Testversion.
