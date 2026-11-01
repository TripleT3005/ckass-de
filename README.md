# ckass.de

Persönliche Website.

Die Startseite zeigt den Namen „ckass“, dessen Buchstaben ihre Schriftstärke dezent wellenförmig ändern und auf Maus oder Berührung reagieren, darunter Links zu GitHub und Twitch sowie zu den Projektseiten. Unter `/chat-below-for-twitch/` liegt die Seite der Browser-Erweiterung [Chat Below for Twitch](https://github.com/TripleT3005/chat-below-for-twitch) mit Beschreibung, Datenschutz und Screenshots. Das Farbschema folgt dem Hell-/Dunkelmodus des Geräts.

Die Seite ist rein statisch (HTML, CSS und ein wenig JavaScript) und kommt ohne externe Ressourcen, Cookies und Tracking aus. Verwendet wird die Systemschrift des Geräts.

### Projektseiten aus READMEs

Projekte in [`projects.json`](projects.json) bekommen unter `/<slug>/` eine Seite, die aus ihrer `README.md` erzeugt wird. Der Workflow [`sync-projects.yml`](.github/workflows/sync-projects.yml) läuft täglich und von Hand. Er holt README und verlinkte Bilder per `gh api` aus den öffentlichen Projekt-Repos, erzeugt die Seiten mit [`scripts/project-pages`](scripts/project-pages) (Node.js ohne Pakete), prüft sie und schlägt Änderungen als Pull Request auf dem Branch `sync/projects` vor. Ohne Änderung entsteht kein Pull Request.

```json
[{ "repo": "TripleT3005/FlexPad", "slug": "flexpad", "branch": "main", "download": true, "changelog": "flexpad-desktop/CHANGELOG.md" }]
```

`download: true` zeigt einen Download-Knopf auf `https://github.com/<repo>/releases/latest`, `changelog` einen Knopf auf diese Datei im Repo. Die Reihenfolge in `projects.json` ist die Reihenfolge auf der Startseite.

Regeln für die README:

- `# <img src="…"> Titel` in der ersten Zeile liefert Titel und Logo.
- Abschnitte `## English` und `## Deutsch` werden zu den beiden Sprachfassungen der Seite. Angezeigt wird die erste unterstützte Sprache aus den Spracheinstellungen des Browsers, sonst Englisch; die Flaggen oben rechts schalten um. Die Wahl wird im `localStorage` des Browsers gespeichert und nirgendwohin gesendet. Ohne JavaScript erscheinen beide Fassungen untereinander.
- Alles zwischen `<!-- web:skip -->` und `<!-- /web:skip -->` fehlt auf der Seite. Fehlt das Ende, bricht der Generator ab.
- Sprungmarken werden wie auf GitHub über die ganze README gebildet (`#firmware`, `#firmware-1` …). Links auf weggelassene Abschnitte zeigen auf die README auf GitHub.
- Relative Links werden zu GitHub-Adressen (`blob`, `tree`, `../../releases`). Ziele, die es im Repo nicht gibt, sind ein Fehler.
- Bilder aus dem Repo (PNG, JPEG, GIF, WebP, SVG ohne Skripte) werden mitkopiert; externe Bilder werden entfernt.
- Roh-HTML ist auf `p`, `img` (`src`, `alt`, `width`, `align`) und `br` beschränkt, alles andere erscheint als Text.

Pull Requests, die ein Workflow mit dem `GITHUB_TOKEN` öffnet, starten keine weiteren Workflows. Darum laufen Tests und Link-Prüfung im Sync-Workflow selbst, bevor der Pull Request entsteht. Einmalig nötig: *Settings → Actions → General → „Allow GitHub Actions to create and approve pull requests“*.

Lokal: `node --test scripts/project-pages/test/*.test.mjs`, `node scripts/project-pages/sync.mjs` (braucht ein angemeldetes `gh`) und `node scripts/project-pages/check.mjs`.

---

Personal website.

The home page shows the name "ckass". Its letters subtly change weight in a wave and react to mouse or touch, with links to GitHub, Twitch and the project pages below. `/chat-below-for-twitch/` hosts the page of the browser extension [Chat Below for Twitch](https://github.com/TripleT3005/chat-below-for-twitch) with description, privacy information and screenshots. The color scheme follows the device's light/dark mode.

The site is fully static (HTML, CSS and a little JavaScript) with no external resources, cookies or tracking. It uses the device's system font.

### Project pages from READMEs

Projects listed in [`projects.json`](projects.json) get a page at `/<slug>/` generated from their `README.md`. The workflow [`sync-projects.yml`](.github/workflows/sync-projects.yml) runs daily and on demand. It fetches the README and the images it links from the public project repositories via `gh api`, builds the pages with [`scripts/project-pages`](scripts/project-pages) (Node.js without packages), checks them and proposes changes as a pull request from the branch `sync/projects`. Without changes, no pull request is opened.

```json
[{ "repo": "TripleT3005/FlexPad", "slug": "flexpad", "branch": "main", "download": true, "changelog": "flexpad-desktop/CHANGELOG.md" }]
```

`download: true` adds a download button pointing to `https://github.com/<repo>/releases/latest`, `changelog` a button pointing to that file in the repository. The order in `projects.json` is the order on the home page.

Rules for the README:

- `# <img src="…"> Title` on the first line provides title and logo.
- Sections `## English` and `## Deutsch` become the two language versions of the page. It shows the first supported language from the browser's language settings, otherwise English; the flags at the top right switch languages. The choice is kept in the browser's `localStorage` and never sent anywhere. Without JavaScript both versions are shown one below the other.
- Everything between `<!-- web:skip -->` and `<!-- /web:skip -->` is left out. A missing end marker stops the generator.
- Anchors are built like on GitHub across the whole README (`#firmware`, `#firmware-1` …). Links to left-out sections point to the README on GitHub.
- Relative links become GitHub URLs (`blob`, `tree`, `../../releases`). Targets missing from the repository are an error.
- Images from the repository (PNG, JPEG, GIF, WebP, SVG without scripts) are copied; external images are removed.
- Raw HTML is limited to `p`, `img` (`src`, `alt`, `width`, `align`) and `br`; anything else is shown as text.

Pull requests opened by a workflow with the `GITHUB_TOKEN` do not start other workflows. That is why tests and the link check run inside the sync workflow before the pull request is opened. Needed once: *Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"*.

Locally: `node --test scripts/project-pages/test/*.test.mjs`, `node scripts/project-pages/sync.mjs` (needs a signed-in `gh`) and `node scripts/project-pages/check.mjs`.
