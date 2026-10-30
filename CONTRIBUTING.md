# Contributing to Asset Kitchen

🇫🇷 *Version française plus bas.*

Thanks for wanting to help! Asset Kitchen started as one person's tool, so a few things work differently from a typical project. Read this page once and you will save yourself a rejected pull request.

## Before you start

- **Open an issue first** for anything bigger than a bug fix: a new feature, a new screen, a new engine. A short discussion avoids building something that clashes with the product's choices.
- **The project speaks French.** Code identifiers, comments, docs, commit messages and the interface are in French. Issues and pull requests can be written in English or French — both are fine.
- **Read [`AGENTS.md`](AGENTS.md)** if you work with an AI coding agent (Claude Code, Cursor, Codex…). It holds the repo's working rules and is written for them.

## Set up

Follow the *Quick start* in the [README](README.md), then:

```bash
uv pip install -e ".[dev]"
```

```bash
cd interface && npm install
```

## The house rules (please keep them)

Every change must respect the product's invariants, listed in the README under *The house rules* and detailed in [`docs/PLAN.md`](docs/PLAN.md) § *Les invariants du produit*. The most important ones:

1. **Nothing paid leaves without its cost announced first.**
2. **The user's text is never rewritten silently.**
3. **Processing is non-destructive and replayable to the exact pixel.**
4. **A file the kitchen did not write is never overwritten.**
5. **A missing engine or library greys a feature out with its reason** — no half-installed states, no crash.
6. **Image processing never touches the GPU** (`torch` must not be imported by the processing path — a test checks `sys.modules`).

## Tests

- **Every test is free.** Engines are faked; no test may call a paid API. Paid benchmarks live in `essais/` and run by hand only.
- Server suite: `python essais/lancer_les_essais.py` (parallel, ~10 minutes).
- Interface suite: `cd interface && npm test`.
- A pull request should keep both suites green and add tests for what it changes.

## Pull requests

- One topic per pull request, branched from `main` (`feat/…` or `fix/…`).
- Say **what the user will see** change, not only what the code does.
- Keep commits readable; the history is part of the documentation.

## Licence

By contributing, you agree that your contribution is released under the [GPL-3.0](LICENSE), like the rest of the project.

---

# Contribuer à Asset Kitchen

Merci de vouloir aider ! Asset Kitchen est né comme l'outil d'une seule personne : certaines choses marchent autrement que dans un projet habituel. Lis cette page une fois, elle t'évitera une pull request refusée.

## Avant de commencer

- **Ouvre d'abord un ticket** pour tout ce qui dépasse la correction d'un bug : une fonction, un écran, un moteur. Une courte discussion évite de construire ce qui heurte les choix du produit.
- **Le projet parle français.** Noms dans le code, commentaires, doc, messages de commit et interface sont en français. Tickets et pull requests peuvent s'écrire en anglais ou en français.
- **Lis [`AGENTS.md`](AGENTS.md)** si tu travailles avec un agent de code IA : il porte les règles de travail du dépôt et il est écrit pour eux.

## Installer

Suis le *Démarrage rapide* du [README](README.fr.md), puis `uv pip install -e ".[dev]"` et `npm install` dans `interface/`.

## Les règles de la maison (à garder)

Tout changement respecte les invariants du produit, résumés dans le README (*Les règles de la maison*) et détaillés dans [`docs/PLAN.md`](docs/PLAN.md) § *Les invariants du produit* : rien de payant ne part sans son coût annoncé, le texte de l'auteur n'est jamais réécrit en silence, le traitement ne détruit rien et se rejoue au pixel près, un fichier que l'atelier n'a pas écrit n'est jamais écrasé, un manque grise une fonction avec sa raison, et le traitement d'image ne touche jamais la carte graphique.

## Les essais

Aucun essai ne coûte un centime : les moteurs y sont simulés. Les bancs payants vivent dans `essais/` et ne partent qu'à la main. Une pull request garde vertes la suite serveur (`python essais/lancer_les_essais.py`) et la suite d'écran (`npm test` dans `interface/`), et ajoute les essais de ce qu'elle change.

## Licence

En contribuant, tu acceptes que ta contribution soit publiée sous [GPL-3.0](LICENSE), comme le reste du projet.
