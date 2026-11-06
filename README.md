# ckass.de

Persönliche Website.

Die Startseite zeigt den Namen „ckass“, dessen Buchstaben ihre Schriftstärke dezent wellenförmig ändern und auf Maus oder Berührung reagieren. Bei aktivierter Systemeinstellung für reduzierte Bewegung bleibt der Texteffekt zunächst aus; ein Hinweis ermöglicht die Aktivierung nur für diese Seite. Die Startseite gibt es unter `/en/` und `/de/`; `/` leitet wie die Projektseiten nach der Browsersprache weiter, die Flaggen oben rechts wechseln die Sprache, und die Projektlinks führen zur Projektseite in derselben Sprache. Sie wird aus [`templates/home.html`](templates/home.html) erzeugt; Änderungen gehören in die Vorlage, nicht nach `public/`. Unter dem Namen steht ein kurzer Vorstellungstext, darunter Links zu GitHub, Twitch und Discord sowie zu den Projektseiten. Unter `/chat-below-for-twitch/` liegt die Seite der Browser-Erweiterung [Chat Below for Twitch](https://github.com/TripleT3005/chat-below-for-twitch) mit Beschreibung, Datenschutz und Screenshots. Das Farbschema folgt dem Hell-/Dunkelmodus des Geräts.

Die Seite ist rein statisch (HTML, CSS und ein wenig JavaScript) und kommt ohne externe Ressourcen, Cookies und Tracking aus. Verwendet wird die Systemschrift des Geräts.

Impressum (`/imprint/`) und Datenschutzerklärung (`/privacy/`) entstehen aus [`templates/legal`](templates/legal), jeweils auf Deutsch und Englisch. Die Kontaktdaten stehen nur in `contact.html`; enthält eine Vorlage noch `TODO-`, bricht `sync.mjs` ab. Startseite, Projektseiten, Rechtstexte und die 404-Seite verlinken beide Seiten im Footer. Die Rechtstexte tragen `noindex` und fehlen deshalb in der Sitemap.

### Projektseiten aus READMEs

Projekte in [`projects.json`](projects.json) bekommen unter `/<slug>/` eine Seite, die aus ihrer `README.md` erzeugt wird. Der Workflow [`sync-projects.yml`](.github/workflows/sync-projects.yml) läuft täglich, von Hand und sobald sich `projects.json` oder der Generator auf `main` ändert. Er holt README und verlinkte Bilder per `gh api` aus den öffentlichen Projekt-Repos, erzeugt die Seiten mit [`scripts/project-pages`](scripts/project-pages) (Node.js ohne Pakete), prüft sie und schlägt Änderungen als Pull Request auf dem Branch `sync/projects` vor. Ohne Änderung entsteht kein Pull Request.

```json
[{ "repo": "TripleT3005/FlexPad", "slug": "flexpad", "branch": "main", "download": true, "changelog": "flexpad-desktop/CHANGELOG.md" }]
```

`download: true` zeigt einen Download-Knopf auf `https://github.com/<repo>/releases/latest`, `changelog` einen Knopf auf diese Datei im Repo. Die Reihenfolge in `projects.json` ist die Reihenfolge auf der Startseite.

Regeln für die README:

- `# <img src="…"> Titel` in der ersten Zeile liefert Titel und Logo.
- Abschnitte `## English` und `## Deutsch` werden zu eigenen Seiten unter `/<slug>/en/` und `/<slug>/de/`; die Flaggen oben rechts sind normale Links dorthin und brauchen kein JavaScript. `/<slug>/` leitet per `.htaccess` (Apache, `mod_rewrite`) auf die erste unterstützte Sprache aus dem `Accept-Language`-Header des Browsers um, sonst auf Englisch. Gespeichert wird dabei nichts. Ohne `mod_rewrite` zeigt `/<slug>/` die englische Fassung. Hat die README nur eine Sprache, entsteht eine einzelne Seite.
- Alles zwischen `<!-- web:skip -->` und `<!-- /web:skip -->` fehlt auf der Seite. Fehlt das Ende, bricht der Generator ab.
- Sprungmarken werden wie auf GitHub über die ganze README gebildet (`#firmware`, `#firmware-1` …). Links auf weggelassene Abschnitte zeigen auf die README auf GitHub.
- Relative Links werden zu GitHub-Adressen (`blob`, `tree`, `../../releases`). Ziele, die es im Repo nicht gibt, sind ein Fehler.
- Bilder aus dem Repo (PNG, JPEG, GIF, WebP, SVG ohne Skripte) werden mitkopiert; externe Bilder werden entfernt.
- Roh-HTML ist auf `p`, `img` (`src`, `alt`, `width`, `align`) und `br` beschränkt, alles andere erscheint als Text.

Pull Requests, die ein Workflow mit dem `GITHUB_TOKEN` öffnet, starten keine weiteren Workflows. Darum laufen Tests und Link-Prüfung im Sync-Workflow selbst, bevor der Pull Request entsteht. Einmalig nötig: *Settings → Actions → General → „Allow GitHub Actions to create and approve pull requests“*.

`--only <slug>` erzeugt nur einzelne Projekte, `--local <slug>=<ordner>` nimmt die README aus einem lokalen Ordner.

Jede Seite verweist per `canonical` auf ihre eigene Adresse und trägt Open-Graph-Angaben für Linkvorschauen. Strukturierte Daten (JSON-LD nach schema.org) beschreiben die Startseite als `WebSite` mit Autor und jede Projektseite als kostenlose `SoftwareApplication` mit Brotkrumen-Navigation; `check.mjs` prüft, dass sie gültiges JSON sind. Nach dem Erzeugen schreibt `sync.mjs` die `public/sitemap.xml` mit allen Seiten, die auf sich selbst als `canonical` zeigen und kein `noindex` haben; `robots.txt` verweist darauf, und `check.mjs` meldet eine veraltete Sitemap als Fehler.

Das Logo der Website liegt als einzige Quelle in [`assets/icons/icon.svg`](assets/icons); ICO und PNG in allen gängigen Größen entstehen daraus mit [`render-icons.mjs`](https://github.com/TripleT3005/TripleT3005/blob/main/scripts/render-icons.mjs) (`node render-icons.mjs assets/icons`). `sync.mjs` kopiert daraus `favicon.svg`, `favicon.ico` und `icon.png` (Vorschaubild für Linkvorschauen) nach `public/`, `check.mjs` meldet abweichende Kopien. Projektseiten zeigen in Linkvorschauen `assets/icons/icon-256.png` des jeweiligen Repos, sofern es die Datei gibt.

Lokal: `node --test scripts/project-pages/test/*.test.mjs`, `node scripts/project-pages/sync.mjs` (braucht ein angemeldetes `gh`) und `node scripts/project-pages/check.mjs`.

### Lizenzen

Der Code steht unter der [MIT-Lizenz](LICENSE). Die einzige Abhängigkeit ist PHPMailer (LGPL-2.1), installiert über Composer und nur auf dem Server verwendet. [`scripts/licenses/check.mjs`](scripts/licenses/check.mjs) prüft `composer.lock` und schlägt fehl, wenn eine Abhängigkeit keine Lizenz hat oder eine, die nicht auf der Liste erlaubter Lizenzen steht, etwa AGPL oder GPL. Lokal: `node --test scripts/licenses/*.test.mjs` und `node scripts/licenses/check.mjs`.

---

Personal website.

The home page shows the name "ckass". Its letters subtly change weight in a wave and react to mouse or touch. When the system prefers reduced motion, the text effect stays off until explicitly enabled for this page. The home page exists at `/en/` and `/de/`; `/` redirects by browser language like the project pages, the flags at the top right switch languages, and the project links lead to the project page in the same language. It is generated from [`templates/home.html`](templates/home.html); edit the template, not `public/`. Below the name, a short introduction is followed by links to GitHub, Twitch, Discord and the project pages. `/chat-below-for-twitch/` hosts the page of the browser extension [Chat Below for Twitch](https://github.com/TripleT3005/chat-below-for-twitch) with description, privacy information and screenshots. The color scheme follows the device's light/dark mode.

The site is fully static (HTML, CSS and a little JavaScript) with no external resources, cookies or tracking. It uses the device's system font.

The legal notice (`/imprint/`) and privacy policy (`/privacy/`) are built from [`templates/legal`](templates/legal), each in German and English. Contact details live only in `contact.html`; if a template still contains `TODO-`, `sync.mjs` stops. The home page, project pages, legal pages and the 404 page link both pages in their footer. The legal pages carry `noindex` and are therefore left out of the sitemap.

### Project pages from READMEs

Projects listed in [`projects.json`](projects.json) get a page at `/<slug>/` generated from their `README.md`. The workflow [`sync-projects.yml`](.github/workflows/sync-projects.yml) runs daily, on demand and whenever `projects.json` or the generator changes on `main`. It fetches the README and the images it links from the public project repositories via `gh api`, builds the pages with [`scripts/project-pages`](scripts/project-pages) (Node.js without packages), checks them and proposes changes as a pull request from the branch `sync/projects`. Without changes, no pull request is opened.

```json
[{ "repo": "TripleT3005/FlexPad", "slug": "flexpad", "branch": "main", "download": true, "changelog": "flexpad-desktop/CHANGELOG.md" }]
```

`download: true` adds a download button pointing to `https://github.com/<repo>/releases/latest`, `changelog` a button pointing to that file in the repository. The order in `projects.json` is the order on the home page.

Rules for the README:

- `# <img src="…"> Title` on the first line provides title and logo.
- Sections `## English` and `## Deutsch` become separate pages at `/<slug>/en/` and `/<slug>/de/`; the flags at the top right are plain links to them and need no JavaScript. `/<slug>/` redirects via `.htaccess` (Apache, `mod_rewrite`) to the first supported language from the browser's `Accept-Language` header, otherwise to English. Nothing is stored. Without `mod_rewrite`, `/<slug>/` shows the English version. A README with only one language becomes a single page.
- Everything between `<!-- web:skip -->` and `<!-- /web:skip -->` is left out. A missing end marker stops the generator.
- Anchors are built like on GitHub across the whole README (`#firmware`, `#firmware-1` …). Links to left-out sections point to the README on GitHub.
- Relative links become GitHub URLs (`blob`, `tree`, `../../releases`). Targets missing from the repository are an error.
- Images from the repository (PNG, JPEG, GIF, WebP, SVG without scripts) are copied; external images are removed.
- Raw HTML is limited to `p`, `img` (`src`, `alt`, `width`, `align`) and `br`; anything else is shown as text.

Pull requests opened by a workflow with the `GITHUB_TOKEN` do not start other workflows. That is why tests and the link check run inside the sync workflow before the pull request is opened. Needed once: *Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"*.

`--only <slug>` builds single projects only, `--local <slug>=<folder>` reads the README from a local folder.

Every page points to its own address as `canonical` and carries Open Graph tags for link previews. Structured data (JSON-LD per schema.org) describes the home page as a `WebSite` with its author and every project page as a free `SoftwareApplication` with breadcrumbs; `check.mjs` verifies that it is valid JSON. After generating, `sync.mjs` writes `public/sitemap.xml` with every page that is its own `canonical` and has no `noindex`; `robots.txt` points to it, and `check.mjs` reports an outdated sitemap as an error.

The site logo lives in [`assets/icons/icon.svg`](assets/icons) as the only source; ICO and PNG in all common sizes are generated from it with [`render-icons.mjs`](https://github.com/TripleT3005/TripleT3005/blob/main/scripts/render-icons.mjs) (`node render-icons.mjs assets/icons`). `sync.mjs` copies `favicon.svg`, `favicon.ico` and `icon.png` (preview image for link previews) from it into `public/`, and `check.mjs` reports copies that differ. Project pages show the repository's `assets/icons/icon-256.png` in link previews if it exists.

Locally: `node --test scripts/project-pages/test/*.test.mjs`, `node scripts/project-pages/sync.mjs` (needs a signed-in `gh`) and `node scripts/project-pages/check.mjs`.

### Licenses

The code is licensed under the [MIT License](LICENSE). The only dependency is PHPMailer (LGPL-2.1), installed with Composer and only used on the server. [`scripts/licenses/check.mjs`](scripts/licenses/check.mjs) checks `composer.lock` and fails if a dependency has no license or one that is not on the allow list, such as AGPL or GPL. Locally: `node --test scripts/licenses/*.test.mjs` and `node scripts/licenses/check.mjs`.
