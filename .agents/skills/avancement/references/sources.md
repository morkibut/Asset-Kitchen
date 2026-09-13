# Détection des sources — détail

Lire ce fichier seulement pour diagnostiquer un scan qui ne détecte pas ce
qu'on attend, ou pour brancher une nouvelle source.

## Ordre de priorité

1. `detect_bmad()` — s'exécute si un des marqueurs existe : `.bmad-core/`,
   `bmad-core/`, `bmad/`, `.bmad/`, ou des stories/epics aux emplacements
   standards.
2. `detect_plan()` — s'exécute en plus de BMAD (les phases du plan sont un autre
   niveau de lecture, pas un doublon).
3. `detect_generic()` — seulement si les deux précédents n'ont rien produit.

La source principale (celle qui pilote le % global et le pipeline) est la
première présente dans l'ordre `bmad > plan > generic`, sauf si
`config.primary_source` est fixé dans `state.json`.

## BMAD

| Élément | Emplacements testés |
|---|---|
| config | `.bmad-core/core-config.yaml`, `bmad-core/core-config.yaml`, `.bmad/core-config.yaml`, `bmad/bmm/config.yaml`, `bmad/core/config.yaml`, `bmad/_cfg/config.yaml` |
| stories | clé `devStoryLocation` / `dev_story_location` / `storyLocation` / `story_dir` du config, puis `docs/stories`, `docs/story`, `stories`, `docs/sm/stories` |
| epics | `docs/prd/epic*.md`, `docs/epics/*.md`, `docs/prd/epics/*.md`, sinon titres `## Epic N: …` dans `docs/prd.md` |

- L'id de story vient du nom de fichier (`1.2.slug.md`, `story-1-2.md`,
  `1-2-slug.md`) ou du titre `# Story 1.2: …`. Le premier nombre donne l'epic.
- Le statut est cherché dans cet ordre : frontmatter `status:`, section
  `## Status`, ligne `**Status**:`. Les libellés FR et EN sont reconnus.
- Les cases à cocher du fichier (tâches / critères) affinent l'avancement :
  une story « en cours » à 3/8 cases affiche 37 %.

## BMAD v6 (`sprint-status.yaml`)

Disposition `_bmad-output/` : la source de verite est le bloc `development_status:`
de `sprint-status.yaml` (cherche dans `_bmad-output/implementation-artifacts/`,
`_bmad-output/`, `docs/implementation-artifacts/`, la racine, puis par balayage sur
trois niveaux). `detect_bmad6()` tourne avant `detect_bmad()` et le court-circuite
des qu'elle produit des items.

- `epic-N: <statut>` cree l'epic ; `N-M-slug: <statut>` cree la story `N.M`.
  Les cles `epic-N-retrospective` sont ignorees.
- Le statut brut de la cle `epic-N` n'est **pas** repris : l'avancement d'un epic
  se derive de ses stories (un `epic-1: in-progress` dont les onze stories sont
  `done` s'affiche donc « Termine »).
- Les titres viennent de `_bmad-output/planning-artifacts/epics.md` (`## Epic N : …`
  et `### Story N.M : …`), sinon du slug de la cle, tronque tel quel dans le YAML.
- Les chemins cliquables viennent des fichiers `spec-N-M-*.md` / `story-N-M-*.md`
  du dossier nomme par `story_location`.

## claude-mastery (`docs/PLAN.md` et satellites)

Un plan qui grossit se scinde souvent : une tranche active part dans son propre
fichier (`docs/PLAN-carnet.md`), les phases closes descendent dans une archive.
`find_plan_files()` ne lit donc pas qu'un seul fichier :

1. Le point d'entrée canonique : `docs/PLAN.md` (ou `plan.md`, `PLAN.md` à la
   racine).
2. Les satellites voisins : tout fichier `docs/PLAN-*.md` / `docs/plan-*.md`.
3. Les fichiers référencés **par chemin** depuis un fichier déjà trouvé — un
   passage du type « la V4, dans `` `docs/PLAN-carnet.md` `` » ou un lien
   markdown — à condition que le chemin contienne « plan » (insensible à la
   casse). Suivi sur deux niveaux, 12 fichiers au maximum.
4. **Exclusion** : tout chemin sous un dossier `archive/` ou `archives/` est
   ignoré — son contenu est en général déjà résumé comme « terminé » ailleurs,
   et le compter aussi doublerait l'avancement.

Chaque fichier trouvé est découpé indépendamment sur `## Phase N : Titre`
(aussi `### Phase`, `Étape`, `Lot`) — et **si aucune de ces phases n'est
trouvée dans le fichier**, sur un repli plus permissif : un code nu suivi d'un
séparateur, `## B1 · Titre` ou `### P1 — Titre` (lettres+chiffres, `·`/`:`/`-`/
`—`). Un id d'epic déjà vu dans un fichier précédent n'est pas repris (le
premier fichier qui le définit gagne).

Dans le corps de chaque phase :

- les cases à cocher deviennent les éléments enfants (critères d'acceptation) ;
- le statut se déduit des cases (0 → à faire, toutes → terminé, sinon en cours),
  sauf si une ligne `**Statut**: …` est présente, ou si le titre porte son
  statut en ligne (`## B1 · Le miroir — **tenue le 6 septembre 2026**`) — l'un
  ou l'autre l'emporte sur les cases ;
- `## Bloquée par` alimente la dépendance affichée, y compris sous forme
  inline (`**Bloquée par** — \`B0\`.`) quand ce n'est pas un titre à part
  entière (« Aucune » est ignoré dans les deux cas).

Le nom du projet vient du premier titre de `docs/PRD.md`, sinon du `README.md`,
sinon du nom du dossier.

Diagnostic : `python3 -c "import status; print(status.find_plan_files('.'))"`
depuis `scripts/` liste les fichiers retenus sans lancer un scan complet.

## Normalisation des statuts

| Statut interne | Reconnu à partir de |
|---|---|
| `done` | done, completed, terminé, fini, closed, clos/close/closes, tenu/tenue/tenues, merged, livré, shipped, ✅ |
| `review` | review, revue, relecture, QA, testing, recette, validation |
| `in_progress` | in progress, WIP, en cours, started, doing, ongoing |
| `ready` | approved, approuvé, ready, prêt, planifié |
| `todo` | draft, brouillon, backlog, todo, à faire, proposed |
| `blocked` | blocked, bloqué, on hold, en attente, stuck |

Poids utilisés pour le pourcentage : done 1 · review 0,85 · in_progress 0,5 ·
blocked 0,25 · ready 0,15 · todo 0. Un élément avec des cases à cocher prend le
maximum entre son ratio de cases et le poids de son statut.

## Ajouter une source

Écrire une fonction `detect_xxx(root)` dans `scripts/status.py` qui renvoie
`(items, sources, notes)`, et l'appeler dans `cmd_scan`. Un item :

```python
{"id": "4.2", "type": "story",      # epic | story | check
 "parent": "4", "title": "…",
 "status": "in_progress", "status_raw": "In Progress",
 "team": None, "path": "docs/stories/4.2.md",
 "checks": {"done": 3, "total": 8},
 "source": "xxx", "order": 12}
```

Tout ce qui vient d'un `detect_*` est écrasé au scan suivant : c'est voulu.
Ce que l'utilisateur a saisi vit ailleurs (`overrides`, `manual`, `notes`,
`milestones`) et survit à tous les scans.
