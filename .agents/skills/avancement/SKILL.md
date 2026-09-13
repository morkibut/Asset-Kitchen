---
name: avancement
description: Génère et met à jour un tableau de bord HTML d'avancement projet (epics faits/à faire, étapes par équipe, % global, jalons, remarques et blocages) à partir de BMAD, de claude-mastery (docs/PLAN.md) ou de simples fichiers markdown. Utilise ce skill dès que l'utilisateur demande « où en est le projet », « état d'avancement », « point projet », « project status », « dashboard d'avancement », « récap pour le client / le comité », « qu'est-ce qui reste à faire », « marque la story X comme terminée », « ajoute une remarque au suivi », ou tape /avancement — même s'il ne dit pas explicitement le mot « dashboard ». Utilise-le aussi après avoir terminé un lot de stories, pour rafraîchir le suivi.
---

# Avancement — tableau de bord projet

Un script déterministe fait tout le travail : il scanne le dépôt, garde un état
incrémental (`docs/status/state.json`) et régénère une page HTML autonome
(`docs/status/index.html`). Ton rôle est d'appeler le script avec les bons
arguments, puis de résumer en 3 lignes. **Ne lis pas le dépôt toi-même et
n'écris jamais le HTML à la main** : c'est lent, cher en contexte, et ça casse
les mises à jour incrémentales.

## Localiser le script (toujours en premier)

Toutes les commandes se lancent **depuis la racine du projet** (le script écrit
dans `docs/status/`). Python 3.8+, zéro dépendance.

macOS / Linux :

```bash
SKILL=$(ls -d "$HOME/.claude/skills/avancement" ".claude/skills/avancement" \
  "$HOME/.claude/plugins"/*/skills/avancement 2>/dev/null | head -1)
python3 "$SKILL/scripts/status.py" scan
```

Windows (PowerShell) :

```powershell
$SKILL = if (Test-Path ".claude\skills\avancement") { ".claude\skills\avancement" } else { "$HOME\.claude\skills\avancement" }
python "$SKILL\scripts\status.py" scan
```

Sur Windows, utilise `python` — **jamais `python3`**, qui ouvre le Microsoft
Store au lieu d'exécuter le script. Si `python` est absent, essaie `py -3`.
Ensuite, la syntaxe des sous-commandes est identique sur les deux systèmes.

## Le flux standard : `/avancement` sans argument

1. `python3 "$SKILL/scripts/status.py" scan`
   Le scan détecte les sources, fusionne avec l'état existant (notes, statuts
   forcés et éléments manuels sont **conservés**), et régénère le HTML.
2. Lis la ligne de résumé imprimée par le script. Si tu veux le détail :
   `python3 "$SKILL/scripts/status.py" info` (sortie compacte, quelques lignes).
3. Si le scan ne détecte **rien** (0 epic), voir « Projet sans documentation »
   plus bas.
4. Réponds court : % global, ce qui est en cours, ce qui bloque, puis le chemin
   du fichier (`docs/status/index.html`) que l'utilisateur peut ouvrir.

C'est tout. Deux appels d'outil au maximum pour un point d'avancement.

## Mises à jour incrémentales

Le scan ne perd jamais ce qui a été saisi à la main : les statuts forcés vivent
dans `overrides`, les remarques dans `notes`, les éléments ajoutés dans
`manual`. Chaque commande régénère le HTML automatiquement.

| L'utilisateur dit | Commande |
|---|---|
| « la 2.1 est terminée » | `set 2.1 --status done` |
| « la 2.3 est bloquée par le fournisseur » | `set 2.3 --status blocked --blocked-by "firmware v2"` puis une note `--level blocker --scope 2.3` |
| « l'epic 3 c'est l'équipe data » | `set 3 --team "Data"` |
| « note : on part sur TimescaleDB » | `note "on part sur TimescaleDB" --level decision` |
| « attention, risque de dérive sur les alertes » | `note "risque de dérive sur les alertes" --level risk --scope 3` |
| « ajoute un jalon démo le 15/09 » | `milestone "Démo client" --date 2026-09-15` |
| « ajoute un chantier certification, hors BMAD » | `add --type epic --title "Certification IoT"` |
| « annule ce que j'avais forcé sur la 2.1 » | `set 2.1 --clear` |
| « le projet s'appelle X » | `project --name "X"` |

Niveaux de note : `blocker`, `risk`, `decision`, `win`, `info`. Le `--scope`
accepte un id d'epic ou d'élément ; sans scope la note est globale. Les notes
de blocage et de risque remontent en haut de la page.

Après une série de modifications, un simple `scan` final remet tout à jour.

## Sources détectées automatiquement

- **BMAD** (`.bmad-core/core-config.yaml`, `bmad/`) : epics shardés
  (`docs/prd/epic-*.md`, `docs/epics/`), stories (`devStoryLocation` ou
  `docs/stories/`), statut lu dans la section `## Status`, le frontmatter ou une
  ligne `Status:`, avancement affiné par les cases à cocher des tâches.
- **claude-mastery** (`docs/PLAN.md` **et ses satellites**) : chaque
  `## Phase N: …` devient un epic, chaque critère d'acceptation coché devient
  un élément terminé, `## Bloquée par` alimente la dépendance affichée. Un plan
  qui a grossi et s'est scindé (une tranche active dans `docs/PLAN-<nom>.md`,
  des phases closes dans une archive) est lu en entier : tout fichier
  `docs/PLAN-*.md`/`docs/plan-*.md`, plus tout fichier référencé par chemin
  depuis un plan déjà trouvé, sauf sous un dossier `archive/`. Reconnaît aussi
  un style de titre sans mot-clé (`## B1 · Titre`) si `Phase/Étape/Lot` est
  absent du fichier. Détail : `references/sources.md`.
- **Markdown générique** : `TODO.md` / `ROADMAP.md` avec des sections et des
  cases à cocher (utilisé seulement si rien d'autre n'est trouvé).
- Complément : présence des artefacts méthodo (PRD, PLAN, DESIGN, architecture,
  portes QA) et 12 derniers commits git.

Si BMAD **et** un PLAN.md coexistent, les deux sont affichés mais le pourcentage
global se calcule sur la source principale (BMAD par défaut) pour éviter de
compter deux fois. Pour inverser : passer `"primary_source": "plan"` dans le
bloc `config` de `state.json`.

Détail du parsing et manière d'ajouter une source : `references/sources.md`.

## Étapes par équipe

Les statuts sont projetés sur le pipeline BMAD : `Backlog · SM` → `Prêt · Dev` →
`En cours · Dev` → `Revue · QA` → `Livré`, plus une colonne `Bloqué` quand il y
en a. Un `--team` posé sur un élément (« Data », « Front », « QA externe »…)
s'affiche à côté de son titre — c'est le même champ pour une squad humaine ou un
agent BMAD.

## Projet sans documentation exploitable

Si `scan` ne trouve rien, ne bricole pas : pose **trois questions maximum**
(grandes étapes du projet, ce qui est terminé, ce qui bloque), puis crée la
structure avec `add` et `note`, et termine par `render`. L'état est ensuite
enrichi automatiquement dès que le projet aura un PRD ou des stories.

## Ne fais pas ça

- Ne réécris pas `index.html` à la main : il est régénéré à chaque commande.
- Ne supprime pas `state.json` pour « repartir propre » : tu perdrais les
  remarques et les statuts forcés. Un `scan` suffit toujours.
- Ne lis pas les stories une par une pour faire le point : le script le fait en
  une fraction de seconde.
- N'invente pas de pourcentage : celui de la page fait foi.

## Options

`--root DIR` (racine du projet), `--out DIR` (dossier de sortie, par défaut
`docs/status`), `--no-git` (pas d'historique git).

Aspect visuel : le gabarit unique `assets/template.html` (clair/sombre, aucune
dépendance externe, imprimable en PDF). Le modifier change toutes les pages
générées ensuite.
