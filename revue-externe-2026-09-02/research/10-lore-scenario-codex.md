# 10 — Lore, scénario, dialogues, codex et assistance IA locale : outils et formats open source

> Périmètre : tout ce qui touche à l'écriture et à la structuration narrative (lore, scénario, quêtes, dialogues), au Codex d'entités, et à l'assistance IA locale (RAG, extraction, cohérence, génération de fiches et de prompts). Contrainte : **open source uniquement** (licence indiquée) ; le propriétaire n'apparaît qu'en référence, marqué **[PROPRIÉTAIRE]** ou **[SOURCE-AVAILABLE]**.
>
> Méthode : ~70 pages GitHub / Hugging Face / Ollama / docs officielles consultées le 2 septembre 2026 (licence, étoiles, dernière version). Les quelques données non re-vérifiées ce jour sont marquées *(à vérifier)*. Le budget de recherche web de la session ayant été épuisé, la couverture « long tail » (petits projets 2025-2026) provient des pages de topics GitHub plutôt que d'une recherche exhaustive.

---

## 1. Problèmes / verrous

1. **Le format pivot narratif.** Un dialogue à embranchements doit être écrit une fois, testé dans l'app, puis exporté vers Godot, Unity ou Phaser sans réécriture. Il faut un format texte (diffable, LLM-friendly) avec un runtime disponible dans les trois cibles.
2. **L'éditeur nodal de dialogues et de quêtes.** Le front utilise déjà @xyflow/react ; il faut décider ce qui se dessine (nœuds « ligne », « choix », « condition », « saut ») et comment le graphe se sérialise vers le format pivot sans perdre la mise en page.
3. **Modéliser la progression** (quêtes, arcs, flags, états du monde) de manière vérifiable : détecter les quêtes sans fin, les états inatteignables, les variables jamais lues.
4. **Stocker le lore et le codex sur disque** de façon lisible, versionnable (git), interopérable (Obsidian) et typée (schémas), avec liens bidirectionnels entre fiches.
5. **L'édition riche** dans React : fiches avec mentions `@Personnage`, templates par type d'entité, aller-retour Markdown ↔ éditeur sans perte.
6. **Visualiser** le monde : chronologies, graphes de relations (familles, factions), cartes.
7. **L'IA locale sur le lore** : retrouver le bon contexte (RAG), extraire entités et relations, détecter les contradictions entre fiches, générer des fiches depuis le wizard, résumer — tout cela avec un LLM qui tient dans 8 Go.
8. **Injecter le lore « à la demande »** dans les prompts (LLM et image) sans dépasser le budget de tokens : le modèle « lorebook » des frontends de roleplay est une réponse éprouvée.
9. **Du Codex au prompt image** : sérialiser une entité + la direction artistique en prompt structuré et déterministe, en tenant compte de la vue du jeu (top-down 4/8 directions, side-scroller, iso) pour savoir quelles poses générer.
10. **Localisation** des dialogues et des fiches (.po/CSV, IDs de lignes stables, traduction LLM).

---

## 2. Solutions par problème

### P1. Format pivot narratif (dialogues, embranchements)

| Nom | URL | Licence | Langage | Type | Maturité | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **ink** (inkle) | github.com/inkle/ink | MIT | C# (compilateur + runtime) | Langage de narration + JSON compilé | Très mature, v1.2.1 (mai 2026), 4,8k★ | 3 | Le plus expressif (weave, tunnels, threads, listes). Sortie JSON stable (v21). Éditeur Inky. | Runtimes : **inkjs** (MIT, 649★, v2.3.0, compilateur JS inclus + types TS) ; **godot-ink** (MIT, 768★, Godot 4 **C#**) ; **inkgd** (MIT, 382★, pur GDScript, branche godot4, plus lent) ; Unreal, Rust (blade-ink-rs), Java (blade-ink-java) *(licences à vérifier)*. Pas de runtime Python mature : côté FastAPI, compiler via `inkjs-compiler` (Node) ou `inklecate` (.NET). |
| **Yarn Spinner** | github.com/YarnSpinnerTool/YarnSpinner | MIT | C# | Langage « screenplay » + compilateur | Mature, v3.2.1 (mai 2026), 2,8k★ | 2 | Syntaxe la plus lisible pour des non-programmeurs (nœuds `title:` … `===`), commandes `<<if>>`, `<<jump>>`, tags `#line:` pour la localisation. | **YarnSpinner-Godot** (MIT, 215★, v0.3.22 mai 2026) exige **C#**. **GDYarn** (GDScript, 69★) inactif depuis janv. 2024. Runtimes JS communautaires (bondage.js, yarn-bound) *(à vérifier : compatibilité Yarn 3)*. |
| **Twee 3 / Twine** | github.com/klembot/twinejs · iftechfoundation/twine-specs | GPL-3.0 (Twine) ; spec Twee 3 libre | JS | Éditeur + formats d'histoire (Harlowe, SugarCube, Chapbook) | Mature, Twine 2.12.0 (avr. 2026), 2,8k★ | 2 | Twee 3 = texte : `:: Passage [tags] {"position":"600,400"}` + passage `StoryData` (ifid, format, start…). Orienté fiction web, pas moteur de jeu. | **Tweego** (BSD-2, Go, 162★) compile Twee→HTML mais dernière version 2020. Bon format d'**import/export** vers l'écosystème IF, pas de pivot pour Godot/Unity. |
| **Godot Dialogue Manager** | github.com/nathanhoad/godot_dialogue_manager | MIT | GDScript | Format texte `.dialogue` + runtime Godot | Mature, 3,8k★, Godot 4.6+ (v3 pour 4.4-4.5) | 2 | Conditions, mutations, traductions, wrapper C#. Sans état côté runtime. | Format uniquement Godot. Cible d'**export** naturelle si le jeu est en Godot GDScript. |
| **Dialogic 2** | github.com/dialogic-godot/dialogic | MIT | GDScript | Système complet (timelines, personnages, portraits) | Mature, 5,9k★, Godot ≥ 4.5 | 3 | Très complet côté visual novel ; format `.dtl` propre à Dialogic. | Cible d'export, pas pivot. |
| **Arrow** | github.com/mhgolkar/Arrow | MIT | GDScript (app Godot) | Outil nodal autonome de narrative design | v3.1.0 (juil. 2025), 1,3k★ | 2 | Nœuds logique/aléatoire/état, macros, variables, personnages, export HTML jouable + CSV i18n ; sauvegardes JSON « VCS-friendly ». | Le meilleur **modèle de référence open source** pour la taxonomie de nœuds d'un éditeur de dialogues ; runtime JS officiel + Bow SDK. |
| **Clyde** | github.com/viniciusgerevini/clyde | MIT | Spec + interpréteurs JS/TS et Godot (`godot-clyde-dialogue`, 147★) | Langage de dialogue léger | Actif (août 2026) | 1 | Branches, variations, tags, IDs de lignes, traductions, variables/événements ; éditeur en ligne. | Alternative minimaliste à Yarn ; deux runtimes (JS + GDScript) sans C#. |
| **Narrat** | github.com/liana-p/narrat-engine | MIT | TS/Vue | Moteur web RPG narratif (`.narrat`) | Actif, 202★ | 2 | Compétences, inventaire, **quêtes avec objectifs**, choix. | Intéressant pour le modèle de quêtes ; moteur complet plutôt que format. |
| **Ren'Py** | github.com/renpy/renpy | MIT (+ LGPL pour certains modules) | Python | Moteur visual novel + script | v8.5.3 (mai 2026), 6,5k★ | 2 | Script Ren'Py = cible d'export possible pour un « mode VN ». | Pas un pivot. |
| Tuesday JS | github.com/Kirilllive/tuesday-js | Apache-2.0 | JS | Éditeur VN navigateur, scénario en JSON | 681★, actif | 1 | Tout en JSON, éditeur visuel. | Référence pour un schéma JSON de scènes VN. |
| Monogatari | github.com/Monogatari/Monogatari | MIT | JS | Moteur VN web | 852★, dernière version 2021 | 1 | Peu maintenu. | Référence seulement. |
| topiary | (topic GitHub narrative-design) | *(à vérifier)* | Zig | Langage de dialogue | 19★ | — | Jeune. | Curiosité. |
| articy:draft, Dialogue Designer, drafft | — | **[PROPRIÉTAIRE]** | — | — | — | — | drafft (abonnement) : arbres de dialogue + scripts `@if/@set` + quêtes + GDD, export JSON. | Références UX ; articy = référence « pipeline » (export JSON/XLSX). |

**Comparaison.** Trois candidats sérieux pour un pivot : ink, Yarn Spinner, ou un **JSON maison**. Ink a le runtime le plus large (C#, JS avec compilateur, GDScript pur, Rust, Java) et un JSON compilé stable, mais sa syntaxe « weave » est moins évidente pour un graphe nodal (les nœuds ink sont des knots/stitches, pas des boîtes). Yarn Spinner a la syntaxe la plus proche d'un graphe (un nœud = un `title`), des IDs de lignes natifs (`#line:abc`), mais les runtimes non-C# sont communautaires. Un JSON maison est trivial à éditer nodalement mais impose d'écrire trois runtimes.

**Recommandation.** Adopter un **graphe JSON interne** (schéma Pydantic/JSON Schema, inspiré des nœuds d'Arrow) comme source de vérité éditée dans xyflow, et générer **deux exports** : **Yarn (.yarn)** comme format texte principal (lisible, localisable, un nœud par boîte, compilateur MIT) et **ink** en second (pour couvrir Godot GDScript pur via inkgd, Phaser via inkjs, Unity via ink-unity). Pour Godot, proposer en plus un export direct `.dialogue` (Dialogue Manager) car c'est ce que la communauté GDScript utilise réellement. Twee 3 = import/export optionnel pour les auteurs venant de Twine.

### P2. Éditeur nodal (dialogues, quêtes, arcs)

| Nom | URL | Licence | Langage | Type | Maturité | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **React Flow (@xyflow/react)** | github.com/xyflow/xyflow | MIT | TS/React | Bibliothèque de graphes | 38k★, v12 | 2 | Nœuds/arêtes custom, sous-graphes, layout via dagre/elk. **Déjà dans la stack.** | Choix évident. |
| Rete.js | github.com/retejs/rete | MIT | TS | Framework de programmation visuelle | 12,2k★ | 3 | Dataflow/controlflow, React/Vue/Svelte/Angular. | Surdimensionné pour du dialogue. |
| litegraph.js | github.com/jagenjo/litegraph.js | MIT | JS (Canvas2D) | Moteur de graphe (style Blueprints) | 8k★, v1.0 mars 2024 (fork actif chez ComfyUI *(à vérifier)*) | 3 | Exécution de graphe intégrée. | Ne s'intègre pas naturellement à React. |
| Baklava.js | github.com/newcat/baklavajs | MIT | TS/Vue | Éditeur de nœuds | 2k★, v2.8.1 nov. 2025 | 2 | Vue uniquement. | Non pertinent (React). |
| Drawflow | github.com/jerosoler/Drawflow | MIT | JS vanilla | Lib de flux simple | 6k★, v0.0.60 sept. 2024 | 1 | Simple, sans framework. | Non pertinent. |
| **Arrow** (voir P1) | — | MIT | GDScript | Éditeur nodal complet | 1,3k★ | — | Taxonomie de nœuds à copier : Dialog, Hub, Condition, Variable Update, Randomizer, Jump, Macro, User Input, Interaction, Marker, Frame. | Référence de conception n°1. |
| dialogue-forge, dialogbench, bark, MangoButtermilch/dialogue-editor, patter, NarrativeCanvas, StoryPlay, NodeFable | github.com/topics/dialogue-editor · /branching-narrative | MIT pour la plupart *(à vérifier un par un)* | TS/JS (React Flow pour dialogue-forge et bark) | Petits éditeurs web 2024-2026 | 2 à 33★ chacun | 1 | Preuves de concept ; utiles pour voir les choix de sérialisation JSON, pas comme dépendances. | **patter** (17★, sept. 2026) = « éditeur + compilateur + runtimes » en TS : à examiner. |
| Monologue, SproutyDialogs, parley | github.com/atomic-junky/Monologue, etc. | MIT *(à vérifier)* | GDScript | Éditeurs nodaux dans Godot | 48★ / 163★ / 83★, actifs 2026 | 2 | Bons exemples de nœuds + export JSON pour Godot. | Cibles d'export secondaires. |
| Talkit (Unity, 105★), DialogueGraph (C#, 215★) | topics | MIT *(à vérifier)* | C# | Éditeurs Unity | 2023 | — | Références Unity. | — |

**Recommandation.** Rester sur xyflow, coder ses propres nœuds typés (voir §5), et emprunter la taxonomie d'Arrow. Layout automatique avec `@dagrejs/dagre` (MIT) ou `elkjs` (EPL-2.0) ; **stocker les positions** dans le JSON interne et les recalculer seulement à la demande. Envisager d'exporter le graphe de haut niveau (arcs, actes) au format **JSON Canvas** (MIT, spec Obsidian) pour qu'il s'ouvre dans Obsidian.

### P3. Progression, quêtes, états du monde

| Nom | URL | Licence | Langage | Type | Maturité | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **XState v5** | github.com/statelyai/xstate | MIT | TS | Machines à états / statecharts | 30k★ | 2 | Config **JSON-sérialisable** ; états parallèles et hiérarchiques (parfait pour « quête = statechart » : `inactive → active(objectifs en parallèle) → completed/failed`). Stately Studio est partiellement payant, mais inutile ici. | Exécutable dans l'app (simulation) et exportable. |
| SCXML (W3C) | w3.org/TR/scxml | Standard ouvert | XML | Format d'échange de statecharts | Standard 2015 | 2 | Format neutre ; XState importe/exporte SCXML. | Pivot possible pour les moteurs. |
| python-statemachine / transitions | github.com/fgmacedo/python-statemachine · pytransitions/transitions | MIT / MIT | Python | Machines à états côté backend | Matures | 1 | Pour valider/simuler côté FastAPI. | — |
| **Narrat** (quêtes avec objectifs), **Cataclysm-DDA** (missions JSON) | voir P1 / P10 | MIT / CC-BY-SA 3.0 | — | Modèles de quêtes | — | — | CDDA : missions déclaratives (`goal`, `dialogue`, `start/end effects`). | Inspirations de schéma. |
| Story Grid, Save the Cat, Voyage du héros | — | (méthodes, pas logiciel) | — | Templates de structure | — | — | À encoder comme **templates d'arcs** (beats nommés, % de progression). | Aucun outil OSS dédié ne vaut le coup ; bibisco/Manuskript ont des « narrative strands »/« snowflake ». |

**Recommandation.** Modéliser chaque quête comme un **statechart XState** (JSON) : états = étapes, événements = flags du monde (`FLAG_SET:got_key`), gardes = expressions sur le contexte. Le graphe de dialogues émet des événements (nœud « Set flag »), la quête les consomme. Avantage : XState fournit des **chemins de test** (toutes les trajectoires) → détection automatique d'étapes inatteignables, et la même définition s'exporte en SCXML/JSON vers n'importe quel moteur.

### P4. Stockage du lore et du codex sur disque

| Nom | URL | Licence | Langage | Type | Maturité | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **Markdown + frontmatter YAML** (convention Obsidian) | obsidian.md (app **[PROPRIÉTAIRE]**, format ouvert) | Format libre | — | Une fiche = un fichier `.md` ; `[[wikilinks]]` | Standard de fait | 1 | Lisible, git-friendly, LLM-friendly, ouvrable dans Obsidian/Logseq/Chronicler. | **python-frontmatter** (MIT) côté backend ; validation via **Pydantic** (MIT) → JSON Schema. |
| **JSON Canvas** | github.com/obsidianmd/jsoncanvas | MIT | Spec JSON | Canevas infini (nœuds text/file/link/group + edges) | 3,5k★ | 1 | Pour les tableaux d'arcs et cartes mentales. | Interop Obsidian. |
| novelWriter | github.com/vkbo/novelWriter | GPL-3.0 | Python/PyQt6 | App d'écriture | 3,1k★ | — | Fichiers texte + tags `@char:`, `@pov:`, `@location:` → **références croisées** entre scènes et fiches. | Le modèle de « tags de référence » est à copier. |
| Manuskript | github.com/olivierkes/manuskript | GPL-3.0+ | Python/PyQt5 | Outliner / snowflake | 2,4k★ | — | Personnages, monde, plots, cartes-index. | Référence pour le wizard « premise → plot ». |
| bibisco CE | github.com/andreafeccomandi/bibisco | GPL-3.0 | JS (Electron) | Écriture de roman | 757★ | — | Prémisse, fabula, brins narratifs, lieux/objets, fiches personnages très détaillées. | Référence pour les templates de fiches. |
| Fantasia Archive | github.com/Elvanos/fantasia-archive | GPL-3.0 | Vue 3/Quasar/Electron, SQLite | Base de worldbuilding desktop | 406★, actif | — | Templates de documents avec champs custom, arbres, multi-mondes ; stockage `.faproject` (SQLite). | Bon modèle de « types d'objets » ; stockage opaque (SQLite) — moins git-friendly. |
| Notebook.ai | github.com/indentlabs/notebook | MIT | Rails | Worldbuilding web | 407★ | — | Personnages, lieux, objets, intrigues, univers ; dockerisable. | Référence de taxonomie d'entités. |
| TiddlyWiki 5 | github.com/TiddlyWiki/TiddlyWiki5 | BSD-3-Clause | JS | Wiki non linéaire (fichier unique ou `.tid`) | 8,6k★ | 2 | Champs libres par tiddler, filtres puissants. | Alternative de stockage si on veut un wiki autonome. |
| Logseq | github.com/logseq/logseq | AGPL-3.0 | Clojure/JS | Notes en graphe, fichiers Markdown/Org | 44,1k★ | — | Backlinks ; version DB en bêta. | Interop via Markdown. |
| Wiki.js | github.com/requarks/wiki | AGPL-3.0 | Vue/Node | Wiki serveur, sync git | 28,4k★, v2.5.314 (mai 2026) | — | Trop lourd ici. | — |
| Kanka | github.com/owlchester/kanka | **[SOURCE-AVAILABLE]** Commons Clause (pas OSI) | PHP/Laravel | Worldbuilding/RPG web | ~350★, v3.12 juin 2026 | — | Taxonomie très complète (personnages, lieux, familles, organisations, événements, calendriers, quêtes, journaux, cartes, chronologies). | **Référence de modèle de données**, pas réutilisable. |
| Chronicler | github.com/mak-kirkland/chronicler | **[SOURCE-AVAILABLE]** PolyForm Shield 1.0 | Rust/Tauri 2/Svelte 5 | Wiki de worldbuilding hors ligne, **vault Obsidian-compatible** | 668★, v0.56 alpha (juil. 2026) | — | Wikilinks + autocomplétion, backlinks, infoboxes par template, tags hiérarchiques. | Preuve que « Markdown + frontmatter + wikilinks » est le bon choix ; ne pas réutiliser le code. |
| World Anvil, LegendKeeper, Campfire, Plottr, Scrivener, Aeon Timeline, Notion, Milanote | — | **[PROPRIÉTAIRE]** | — | — | — | — | — | Références UX uniquement. |

**Recommandation.** Un dossier projet versionnable :

```
project/
  project.yaml                # DA, vue du jeu, style, époque, ambiance (sortie du wizard)
  lore/{history,peoples,factions,places,beliefs,rules}/<slug>.md
  codex/{characters,items,monsters,props}/<slug>.md   # frontmatter typé + corps libre
  story/arcs/<slug>.md · story/quests/<slug>.quest.json (XState) · story/dialogues/<slug>.dialogue.json
  timeline/events.yaml · maps/<name>.map (Azgaar) · canvas/*.canvas (JSON Canvas)
  .index/ (sqlite : liens, embeddings, cache LLM — régénérable)
```

Chaque `.md` porte un frontmatter validé par un modèle Pydantic par type (`type: character`, `id`, `tags`, `relations: [{to, kind}]`, champs visuels…). Les liens `[[slug]]` sont extraits au parsing (markdown-it-py ou mistune, tous deux BSD/MIT) pour construire le graphe de backlinks. Rien n'est stocké uniquement dans SQLite : l'index se reconstruit à partir des fichiers.

### P5. Édition riche avec mentions d'entités

| Nom | URL | Licence | Langage | Type | Maturité | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **TipTap** | github.com/ueberdosis/tiptap | MIT (cœur + 100+ extensions) ; extensions « Pro » et Cloud payantes | TS (ProseMirror) | Éditeur headless | 38k★ | 2 | Extension **Mention** open source (suggestion `@`), Markdown via `tiptap-markdown` (MIT) *(à vérifier)*. Collab Yjs via Hocuspocus (MIT). | Choix le plus courant avec React ; attention à ne pas dépendre des extensions Pro. |
| **Lexical** | github.com/facebook/lexical | MIT | TS | Framework d'éditeur (Meta) | 23,8k★ | 3 | Import/export JSON, Markdown, HTML ; plugin typeahead pour mentions. | Très performant, API plus bas niveau. |
| **BlockNote** | github.com/TypeCellOS/BlockNote | **MPL-2.0** (cœur) ; paquets « XL » en GPL-3.0/commercial | TS (ProseMirror/TipTap) | Éditeur en blocs façon Notion | 10,1k★ | 1 | Le plus rapide à intégrer pour une UX Notion (slash menu, drag de blocs). | Vérifier que les blocs nécessaires ne sont pas dans les paquets XL. |
| Plate | github.com/udecode/plate | MIT | TS (Slate) | Éditeur + composants shadcn/ui | 16,5k★ | 2 | Plugins mention, markdown, IA. | Bonne option si l'UI est déjà en shadcn. |
| Milkdown | github.com/Milkdown/milkdown | MIT | TS (ProseMirror + remark) | Éditeur **Markdown-first** WYSIWYG | 11,9k★ | 2 | Aller-retour Markdown le plus fidèle (remark). | Idéal si le fichier `.md` doit rester canonique. |
| Slate | github.com/ianstormtaylor/slate | MIT | TS | Framework bas niveau | — | 3 | — | Utiliser via Plate plutôt que nu. |

**Recommandation.** **Milkdown** ou **TipTap + tiptap-markdown** : le critère décisif est la fidélité Markdown, puisque le disque est la source de vérité. Implémenter les mentions comme des wikilinks `[[slug|Nom]]` dans le Markdown (compatibles Obsidian) rendus en « chips » cliquables dans l'éditeur ; l'autocomplétion `@` interroge l'index des entités.

### P6. Visualisation : chronologies, relations, cartes

| Nom | URL | Licence | Langage | Type | Maturité | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **vis-timeline** | github.com/visjs/vis-timeline | Apache-2.0 / MIT (au choix) | JS | Chronologie interactive (items, plages, groupes, zoom, drag) | 2,5k★, v8.5.1 (mai 2026) | 2 | La seule vraiment éditable (drag d'événements). Wrapper React à écrire (léger). | Pour la timeline du lore. |
| react-chrono | github.com/prabhuignoto/react-chrono | MIT | TS/React | Timeline de présentation | 4,2k★, v3.3.3, React 19 OK | 1 | Jolie, non éditable. | Pour l'affichage dans les fiches. |
| TimelineJS3 | github.com/NUKnightLab/TimelineJS3 | MPL-2.0 | JS | Timeline narrative | 3,2k★ | 1 | JSON simple (`start_date`, `text`, `media`, `group`). | Format de données à imiter. |
| **Cytoscape.js** | github.com/cytoscape/cytoscape.js | MIT | JS | Graphe de relations + analyse | 11,1k★ | 2 | Layouts fcose/dagre/cola, filtres, styles par type d'arête. | Pour les relations personnages/factions et le knowledge graph. |
| Sigma.js + graphology | github.com/jacomyal/sigma.js | MIT | TS (WebGL) | Graphe très grand | — | 2 | Plus rapide que Cytoscape au-delà de 10k nœuds. | Optionnel. |
| d3-force / xyflow | — | ISC / MIT | — | — | — | — | Une généalogie peut se dessiner directement en xyflow avec layout dagre. | Réutilise la stack. |
| **Azgaar's Fantasy Map Generator** | github.com/Azgaar/Fantasy-Map-Generator | **MIT** | JS/TS | Générateur de cartes (États, cultures, religions, provinces, villes, rivières, biomes, noms) | 5,7k★, v1.119 (avr. 2026) | 3 | Export `.map`, SVG/PNG ; migration vers TypeScript en cours. | Embarquable en iframe ou fork ; **importer ses États/cultures/villes comme entités de lore**. |
| Watabou TownGeneratorOS | github.com/watabou/TownGeneratorOS | Source publiée (Haxe) *(licence à vérifier)* | Haxe | Générateur de villes médiévales | — | 3 | Les versions récentes de Watabou sont propriétaires ; seule l'ancienne version est publiée. | Référence. |
| Wonderdraft, Dungeon Scrawl | — | **[PROPRIÉTAIRE]** | — | — | — | — | — | — |

### P7. IA locale : RAG, extraction, cohérence

| Nom | URL | Licence | Langage | Type | Maturité | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **sqlite-vec** | github.com/asg017/sqlite-vec | Apache-2.0 / MIT | C (ext. SQLite), pip | Vecteurs dans SQLite | 8k★, **pré-v1** | 1 | Zéro service, colonnes de métadonnées/partition pour filtrer par type d'entité. Ruptures possibles avant v1. | Le plus simple pour « un fichier `.index/lore.db` ». |
| **LanceDB** | github.com/lancedb/lancedb | Apache-2.0 | Rust/Python | Base vectorielle embarquée | 10,5k★, v0.33 (juin 2026) | 1 | **Hybride** (vecteur + plein texte + SQL), multimodal (images du Codex !). | Alternative robuste si sqlite-vec fait peur. |
| Chroma / FAISS | github.com/chroma-core/chroma · facebookresearch/faiss | Apache-2.0 / MIT | Python / C++ | Vecteurs | Matures | 1 | Chroma : simple ; FAISS : brut, sans métadonnées. | — |
| txtai | github.com/neuml/txtai | Apache-2.0 | Python | Framework tout-en-un (embeddings + graphe sémantique + RAG + LLM local via llama.cpp) | 12,9k★ | 2 | Inclut un **graphe sémantique** et des pipelines ; peut remplacer 3 briques. | Bon compromis « batteries incluses ». |
| **LightRAG** | github.com/HKUDS/LightRAG | MIT | Python | Graph-RAG léger (EMNLP 2025) | 39,3k★ | 3 | Extraction entités/relations par LLM, mises à jour incrémentales, suppression sélective, API compatible Ollama ; backends Neo4j/Memgraph/PostgreSQL/Milvus/Qdrant ; stockage fichier par défaut (« dev only »). | Le graphe extrait peut **alimenter le Codex** (entités candidates). Lourd en appels LLM à l'indexation. |
| nano-graphrag | github.com/gusye1234/nano-graphrag | MIT | Python | Graph-RAG minimal (~1 100 lignes) | 4k★ | 2 | NetworkX + FAISS/hnswlib + Ollama ; facile à hacker. | Idéal pour intégrer sans dépendre d'un framework. |
| Microsoft GraphRAG | github.com/microsoft/graphrag | MIT | Python | Graph-RAG « lourd » | 35,1k★ | 4 | Indexation coûteuse (avertissement officiel). | Référence, pas pour du local 8 Go. |
| **LadybugDB (ex-Kùzu)** | github.com/LadybugDB/ladybug | MIT | C++/Python | Graphe embarqué Cypher + vecteurs + plein texte | 1,3k★, v0.17.1 (juin 2026) | 2 | **Kùzu a été archivé le 10 oct. 2025** ; LadybugDB est le même projet renommé et poursuivi. | Si on veut Cypher sans serveur ; sinon NetworkX suffit. |
| NetworkX | github.com/networkx/networkx | BSD-3 | Python | Graphe en mémoire | Mature | 1 | Sérialisable en JSON ; parfait pour < 100k nœuds. | Choix par défaut. |
| Neo4j Community | github.com/neo4j/neo4j | GPL-3.0 | Java | Serveur graphe | Mature | 3 | Service séparé, JVM. | Surdimensionné. |
| **GLiNER** (+ RelEx) | github.com/urchade/GLiNER | Apache-2.0 | Python | NER zéro-shot avec **labels libres** (« personnage », « faction », « lieu ») + extraction de relations | 3,3k★, v0.2.27 (mai 2026) | 1 | Modèles ~200-500 Mo, CPU OK, multilingue. Beaucoup moins cher qu'un LLM pour repérer les entités dans un texte. | Première passe de détection de mentions non liées. |
| spaCy | github.com/explosion/spaCy | MIT | Python | NLP (FR disponible), EntityRuler, matcher | 33,8k★, v3.8 | 1 | Pour l'auto-linking par dictionnaire de noms/alias. | Complément de GLiNER. |
| **Outlines** | github.com/dottxt-ai/outlines | Apache-2.0 | Python | Génération **contrainte** (JSON Schema/Pydantic, regex, grammaires) | 15,7k★ | 2 | Backends llama.cpp, transformers, vLLM, Ollama. Garantit un JSON valide même avec un 4B. | Génération de fiches / extraction structurée. |
| **Instructor** | github.com/567-labs/instructor | MIT | Python | Sorties Pydantic avec validation + retries | 13,8k★ | 1 | `from_provider("ollama/…")`, OpenRouter natif. | Même code local et API. |
| sentence-transformers | github.com/UKPLab/sentence-transformers | Apache-2.0 | Python | Calcul d'embeddings | Mature | 1 | Charge bge/nomic/Qwen3-Embedding/EmbeddingGemma. | — |

Modèles d'embeddings vérifiés (tous multilingues, FR inclus) :

| Modèle | Licence | Taille | Dim. | Contexte | Remarque |
|---|---|---|---|---|---|
| **Qwen3-Embedding-0.6B** | Apache-2.0 | 0,6B | 32→1024 (MRL) | 32k | n°1 MTEB multilingue (famille) ; dispo Ollama (639 Mo). |
| bge-m3 | MIT | ~570M | 1024 | 8192 | Dense + sparse + multi-vecteur (hybride natif). |
| nomic-embed-text-v2-moe | Apache-2.0 | 475M (305M actifs) | 256→768 | 512 | Contexte court. |
| EmbeddingGemma-300m | Gemma Terms (**pas OSI**) | 300M | 128→768 | 2048 | Très léger ; licence restrictive → à éviter en « OSS only ». |

**Recommandation.** Pipeline **hybride** : (1) index lexical (SQLite FTS5) + (2) vecteurs sqlite-vec ou LanceDB sur des chunks « une fiche = un chunk + sections », embeddings **Qwen3-Embedding-0.6B** ; (3) graphe NetworkX construit **depuis les frontmatters et wikilinks** (déterministe, gratuit) et enrichi optionnellement par LightRAG/nano-graphrag ; (4) GLiNER pour repérer les mentions non liées et proposer des liens ; (5) Outlines/Instructor pour tout ce qui doit sortir en JSON (fiches, contradictions, relations).

### P8. LLM locaux (≤ 8 Go) et licences

| Modèle | Licence | Tailles utiles | Contexte | Notes (vérifié Ollama/HF, sept. 2026) |
|---|---|---|---|---|
| **Qwen3.5** (fév. 2026) | Apache-2.0 | 0,8B / 2B / **4B** / **9B** (6,6 Go en Q4) | 262k | Multimodal, 201 langues, thinking désactivable. Meilleur rapport qualité/VRAM à date. |
| Qwen3 (mai 2025) | Apache-2.0 | 4B / 8B | 32k (128k YaRN) | Toujours excellent ; thinking on/off. |
| **Gemma 4** (juil. 2026) | **Apache-2.0** (E4B-it vérifié) | E2B / **E4B** / 12B / 26B MoE (4B actifs) | 128k-256k | Changement majeur : Gemma 3 restait sous « Gemma Terms » (non OSI). |
| Gemma 3 | Gemma Terms (**pas OSI**) | 4B / 12B | 128k | À marquer non-OSS. |
| Phi-4-mini | MIT | 3,8B | 128k | Bon en logique, moins en FR créatif. |
| Llama 3.2 | Llama Community License (**pas OSI**) | 1B / 3B | 128k | Référence seulement. |
| Mistral Small 3.2 | Apache-2.0 | 24B (15 Go Q4) | 128k | Trop gros pour 8 Go ; option OpenRouter. |
| gpt-oss-20b | Apache-2.0 | 20B MoE (14 Go) | 128k | ≥ 16 Go RAM : hors cible locale. |

**Recommandation.** Par défaut **Qwen3.5-4B** (rapide, JSON fiable via Outlines) et **Qwen3.5-9B / Gemma 4 E4B** pour la rédaction ; OpenRouter (Mistral Small, etc.) en repli. Exposer les deux via une interface unique (Instructor `from_provider`).

### P9. Lore « à la demande » (lorebook) et prompts image

| Nom | URL | Licence | Type | Notes |
|---|---|---|---|---|
| **SillyTavern World Info** | github.com/SillyTavern/SillyTavern (docs.sillytavern.app) | AGPL-3.0 (app) ; le **format** est du JSON libre | Lorebook : entrées activées par mots-clés | Champs vérifiés : `key[]`, `keysecondary[]`, `selectiveLogic` (AND_ANY/AND_ALL/NOT_ANY/NOT_ALL), `content`, `constant`, `vectorized`, `order`, `position`, `depth`, `probability`, `scanDepth`, `caseSensitive`, `matchWholeWords`, `excludeRecursion`/`preventRecursion`/`delayUntilRecursion`, `group`/`groupWeight`, `sticky`/`cooldown`/`delay`, `disable`. Mécanique : scan des N derniers messages, activation par mot-clé ou similarité vectorielle, **budget de tokens**, récursion (une entrée peut en déclencher une autre). |
| Character Card V2 / V3 | github.com/malfoyslastname/character-card-spec-v2 · kwaroran/character-card-spec-v3 | V3 : MIT (« living standard ») | Fiche personnage + `character_book` embarqué (entries : `keys`, `secondary_keys`, `content`, `constant`, `selective`, `insertion_order`, `enabled`, `position`, `extensions`) | Format d'**export** utile : un personnage du Codex → carte V3 jouable dans SillyTavern/KoboldAI pour « interviewer » le PNJ. |
| KoboldAI / TavernAI world info | — | AGPL-3.0 / — | Même idée, moins riche | Référence. |
| Jinja2 | github.com/pallets/jinja | BSD-3 | Templates de prompts | Déjà dans l'écosystème FastAPI. |
| open-dungeon (222★, TS) | github.com/newideas99/open-dungeon | *(à vérifier)* | Roleplay IA local | Exemple 2026 de génération on-device avec lore. |

**Recommandation.** Implémenter un **lorebook dérivé automatiquement du Codex** : chaque fiche produit une entrée (`keys` = nom + alias, `content` = résumé court généré, `constant` pour les règles de l'univers, `group` = type). Le moteur d'activation (mots-clés + vecteurs + budget de tokens + récursion) sert **à la fois** aux prompts LLM (écriture de dialogue) et aux prompts image (injecter la description visuelle des entités mentionnées). Exporter en JSON SillyTavern pour interop.

### P10. Codex : modèle d'entité orienté génération d'assets

| Nom | URL | Licence | Type | Ce qu'on en retient |
|---|---|---|---|---|
| **LDtk** | github.com/deepnight/ldtk (ldtk.io/json) | MIT, 4,1k★ | Éditeur de niveaux, JSON | `EntityDef` : `identifier`, `uid`, `width/height`, `color`, `pivotX/Y`, `tileRect`, `tileRenderMode`, `nineSliceBorders`, `tags`, `fieldDefs`. Types de champs : `F_Int, F_Float, F_String, F_Text, F_Bool, F_Color, F_Enum, F_Point, F_Path, F_EntityRef, F_Tile` (+ `Array<…>`). `EnumDef` avec `iconTilesetUid`. → **Export direct du Codex en définitions d'entités LDtk.** |
| **Tiled** | doc.mapeditor.org (custom properties) | GPL-2.0+ (app), format libre | Types de propriétés : bool, color, file, float, int, object, string ; **classes** custom (avec valeurs par défaut, imbriquées) et **enums** (chaînes ou flags). | Export d'un fichier de types de propriétés. |
| Aseprite (spec de fichier) | github.com/aseprite/aseprite (ase-file-specs) | Spec publique ; app **[SOURCE-AVAILABLE]** (EULA). LibreSprite = GPL-2.0 | Chunk Tags : `from`, `to`, direction (forward/reverse/ping-pong/ping-pong reverse), `repeat`, couleur, nom + User Data par tag. | Nommer les animations du Codex exactement comme des tags Aseprite (`walk_down`, `attack_left`…). |
| Cataclysm-DDA (données JSON) | github.com/CleverRaven/Cataclysm-DDA (doc/JSON) | CC-BY-SA 3.0 | Tout le contenu en JSON : `type`, `id`, **héritage** `copy-from` / `abstract` / `extend` / `delete` / `relative` / `proportional`. | Le meilleur modèle d'**héritage déclaratif** pour un bestiaire (« gobelin archer copie gobelin, +2 portée »). |
| Veloren | github.com/veloren/veloren (GitLab principal) | GPL-3.0, 7,4k★ | Rust ; assets en RON ; `rtsim` pour la simulation des PNJ ; i18n Fluent. | Référence pour items/loot tables déclaratifs. |
| Mindustry | github.com/Anuken/Mindustry | GPL-3.0, 28,8k★ | Contenu en classes Java ; mods en JSON/HJSON typés (`type` + propriétés). | Référence. |
| Shattered Pixel Dungeon | github.com/00-Evan/shattered-pixel-dungeon | GPL-3.0, 6,4k★ | Items/mobs en classes Java ; textes en `.properties` i18n. | Moins déclaratif ; référence de taxonomie (bestiaire, objets). |
| Godot Resources (`.tres`) | docs.godotengine.org | MIT | Ressources texte typées. | Cible d'export (une `Resource` par entité). |

**Recommandation de schéma (extrait, Pydantic → JSON Schema) :**

```yaml
id: goblin_archer            # slug stable, référencé par [[goblin_archer]]
type: monster                 # character | item | monster | prop | place
extends: goblin               # héritage façon CDDA (copy-from) ; "abstract: true" pour les bases
name: Gobelin archer
lore_refs: [[peuples/gobelins], [factions/clan-du-croc]]
story_refs: [quests/defendre-le-moulin]
visual:
  palette: [#3a5f2b, #8b5a2b]  # ou référence à la DA du projet
  size_class: small            # → taille en pixels selon project.yaml (ex. 16/32/48)
  silhouette: "arc court, capuche, carquois"
  tags: [humanoid, ranged]
generation:
  view: topdown_4dir           # hérité de project.yaml (topdown_4dir | topdown_8dir | side | iso)
  animations:                  # noms = tags Aseprite
    - {name: idle, frames: 4, loop: forward}
    - {name: walk, frames: 6, loop: forward, directions: auto}   # 4 ou 8 selon view
    - {name: attack, frames: 5, loop: forward, directions: auto}
  prompt_overrides: {negative: "modern clothing"}
export: {ldtk: {tags: [enemy], fields: {hp: int, range: int}}, godot: {resource: EnemyData}}
```

La règle **« directions requises = f(vue du jeu) »** vit dans un seul endroit (`project.yaml`) : top-down 4 dir → `down,left,right,up` (ou `down,side,up` + flip), 8 dir → 8 sprites, side-scroller → `side` + flip, iso → 4 ou 8 diagonales.

### P11. Localisation

| Nom | Licence | Notes |
|---|---|---|
| gettext `.po/.pot` (Godot les lit nativement, comme le CSV) | Format libre | IDs de lignes stables (`#line:` Yarn, tags ink) comme `msgctxt`. |
| Babel / polib (Python) | BSD / MIT | Génération de `.pot` depuis le graphe de dialogues. |
| Weblate | GPL-3.0 | Plateforme de traduction si travail en équipe *(vérifier version)*. |
| Arrow (export CSV i18n), Yarn Spinner (CSV de lignes), Godot Dialogue Manager (traductions) | MIT | Confirme que **l'ID de ligne** est la clé de tout. |
| LLM (Qwen3.5 ≥ 9B) | Apache-2.0 | Traduction « première passe » avec le lorebook injecté pour garder les noms propres cohérents. |

---

## 3. Idées malines / astuces

- **Un identifiant par ligne de dialogue, dès la création** (`ulid`), jamais recalculé : c'est ce qui rend possible la localisation, le diff, le voice-over et le RAG « quelle ligne mentionne X ? ».
- **Le graphe de dialogue émet, la quête consomme.** Ne jamais coder la logique de quête dans les dialogues : un nœud « Set flag » + un statechart XState par quête → simulation et détection des impasses gratuites.
- **Le Codex génère son lorebook.** Pas de double saisie : `keys` = nom + alias, `content` = résumé LLM mis en cache par hash de la fiche.
- **Contradictions par paires ciblées.** Pas de « relis tout le lore » : pour chaque fiche modifiée, récupérer les k fiches voisines (RAG + graphe) et demander au LLM, en JSON contraint, `{claims: [...], conflicts: [{with, quote_a, quote_b, severity}]}`. Stocker les *claims* atomiques (sujet/prédicat/objet/date) pour comparer sans LLM la fois suivante.
- **Deux niveaux de prompt image** : un bloc « monde » stable (DA du wizard, palette, rendu, vue) mis en cache, et un bloc « objet » généré depuis la fiche via Jinja2. Le hash des deux blocs devient l'ID de génération → régénération incrémentale.
- **Héritage déclaratif** (`extends`) façon Cataclysm-DDA pour les bestiaires et objets : 80 % des variantes n'ont que 3 champs qui changent, et le prompt image hérite aussi.
- **Importer une carte Azgaar** : ses États, cultures, religions et villes deviennent des fiches de lore pré-remplies ; ses générateurs de noms (MIT) remplacent un générateur Markov maison.
- **Templates d'arcs** (Save the Cat, Story Grid, Voyage du héros) comme simples YAML de « beats » avec pourcentage cible ; l'app affiche les beats non couverts par une quête.
- **Exporter un personnage en Character Card V3** pour l'interroger dans SillyTavern : test de cohérence de la voix du PNJ à coût nul.
- **JSON Canvas pour la vue « tableau de liège »** des arcs : ouvrable dans Obsidian, ce qui rassure les auteurs.
- **Cache LLM par hash de prompt** (LightRAG le fait) : toute regénération de fiche/lorebook/prompt est gratuite si l'entrée n'a pas changé.

---

## 4. Architecture recommandée

**Stockage (disque, git).** Markdown + frontmatter YAML typé par Pydantic, wikilinks `[[slug]]`, un fichier par entité ; quêtes en JSON XState ; dialogues en JSON de graphe interne ; `project.yaml` issu du wizard ; index SQLite (FTS5 + sqlite-vec) et graphe NetworkX **régénérables**. Tout est ouvrable dans Obsidian/Logseq.

**Format pivot narratif.** Graphe JSON interne (taxonomie de nœuds d'Arrow : Line, Choice, Condition, SetVariable/Flag, Random, Jump, Hub, Marker, Macro) → compilateurs Python vers **Yarn** (`.yarn`, avec `#line:` IDs), **ink** (`.ink`) et **Godot Dialogue Manager** (`.dialogue`) ; import **Twee 3** optionnel. Test dans l'app via **inkjs** ou un interpréteur du JSON interne en TS (petit, à écrire, cf. patter).

**Éditeur nodal.** @xyflow/react avec nœuds custom typés, mentions `@` dans les lignes (autocomplétion depuis l'index du Codex), layout dagre à la demande, positions persistées. Le même canevas sert aux quêtes (rendu du statechart XState) et à la vue « arcs » (export JSON Canvas).

**RAG local.** Backend FastAPI : `sentence-transformers` + Qwen3-Embedding-0.6B → sqlite-vec (ou LanceDB si hybride natif souhaité) + FTS5 ; graphe NetworkX depuis frontmatters/wikilinks ; GLiNER pour l'auto-linking ; LLM via une couche unique (Instructor/Outlines) pointant sur Ollama (Qwen3.5-4B/9B, Gemma 4 E4B) ou OpenRouter. Option : nano-graphrag pour une extraction de relations « à la volée » sur les textes longs (histoire du monde).

**Liaison Codex ↔ lore ↔ scénario ↔ image.**
1. Wizard → `project.yaml` (DA, vue, palette, époque, ambiance) → génération de fiches de lore de base (JSON contraint) → validation humaine.
2. Fiches de lore et Codex se lient par wikilinks ; le graphe alimente les vues (Cytoscape) et la timeline (vis-timeline).
3. Dialogues et quêtes référencent des entités par `id` ; l'éditeur signale les entités inconnues et propose leur création.
4. Lorebook dérivé du Codex → injecté dans tout prompt (LLM ou image) selon les entités mentionnées et le budget.
5. Prompt image = Jinja2(`bloc monde` + `bloc objet` + `bloc rendu selon vue`) → liste de poses/directions/animations dérivée de `project.yaml.view` et des tags Aseprite déclarés ; exports LDtk EntityDef / Tiled classes / Godot Resource.

---

## 5. Ce qu'il faudrait développer soi-même

1. **Schémas Pydantic** des entités (personnage, lieu, faction, événement, objet, monstre, décor, croyance, règle) avec `extends` et validation des références.
2. **Parseur/indexeur** Markdown → frontmatter + wikilinks → SQLite/NetworkX, avec watcher de fichiers (watchdog, Apache-2.0).
3. **Nœuds xyflow** typés + sérialisation JSON du graphe de dialogue + interpréteur TS pour le « play » dans l'app.
4. **Compilateurs** JSON interne → Yarn, ink, `.dialogue`, `.po/.pot`, et import Twee 3.
5. **Modèle de quête XState** (générateur de statechart + analyse de chemins).
6. **Moteur de lorebook** (activation mots-clés/vecteurs/budget/récursion) — compatible export SillyTavern, ~300 lignes Python.
7. **Détecteur de contradictions** (claims atomiques + comparaison ciblée par LLM contraint).
8. **Générateur de prompts image** (templates Jinja2 + règles de vue/directions + hash de cache).
9. **Exports Codex** : LDtk EntityDef, Tiled property types, Godot Resources, Character Card V3.
10. **Wrapper React** pour vis-timeline et intégration Azgaar (iframe + import `.map`).

Aucune de ces briques n'existe sous forme réutilisable et open source en React/FastAPI ; les projets GitHub 2024-2026 recensés (dialogue-forge, patter, NarrativeCanvas, StoryPlay…) sont des preuves de concept à quelques étoiles, utiles comme lecture, pas comme dépendances.

---

## 6. Sources (consultées le 2 sept. 2026)

- https://github.com/inkle/ink · https://github.com/y-lohse/inkjs · https://github.com/paulloz/godot-ink · https://github.com/ephread/inkgd
- https://github.com/YarnSpinnerTool/YarnSpinner · https://github.com/YarnSpinnerTool/YarnSpinner-Godot
- https://github.com/klembot/twinejs · https://github.com/tmedwards/tweego · https://github.com/iftechfoundation/twine-specs/blob/master/twee-3-specification.md
- https://github.com/nathanhoad/godot_dialogue_manager · https://github.com/dialogic-godot/dialogic · https://github.com/mhgolkar/Arrow · https://github.com/viniciusgerevini/clyde · https://github.com/liana-p/narrat-engine · https://github.com/renpy/renpy · https://github.com/Kirilllive/tuesday-js · https://github.com/Monogatari/Monogatari · https://drafft.dev/
- https://github.com/topics/dialogue-editor · https://github.com/topics/dialogue-system · https://github.com/topics/branching-narrative · https://github.com/topics/narrative-design · https://github.com/topics/dialogue-tree · https://github.com/topics/interactive-fiction · https://github.com/topics/worldbuilding
- https://github.com/xyflow/xyflow · https://github.com/retejs/rete · https://github.com/jagenjo/litegraph.js · https://github.com/newcat/baklavajs · https://github.com/jerosoler/Drawflow · https://github.com/statelyai/xstate
- https://github.com/mak-kirkland/chronicler · https://github.com/indentlabs/notebook · https://github.com/owlchester/kanka (LICENSE : Commons Clause) · https://github.com/Elvanos/fantasia-archive · https://github.com/vkbo/novelWriter · https://github.com/olivierkes/manuskript · https://github.com/andreafeccomandi/bibisco · https://github.com/TiddlyWiki/TiddlyWiki5 · https://github.com/logseq/logseq · https://github.com/requarks/wiki · https://github.com/obsidianmd/jsoncanvas
- https://github.com/Azgaar/Fantasy-Map-Generator (LICENSE : MIT) · https://github.com/watabou
- https://github.com/ueberdosis/tiptap · https://github.com/facebook/lexical · https://github.com/TypeCellOS/BlockNote · https://github.com/udecode/plate · https://github.com/Milkdown/milkdown
- https://github.com/visjs/vis-timeline · https://github.com/prabhuignoto/react-chrono · https://github.com/NUKnightLab/TimelineJS3 · https://github.com/cytoscape/cytoscape.js
- https://github.com/HKUDS/LightRAG · https://github.com/microsoft/graphrag · https://github.com/gusye1234/nano-graphrag · https://github.com/kuzudb/kuzu (archivé 10/10/2025) · https://github.com/LadybugDB/ladybug · https://github.com/asg017/sqlite-vec · https://github.com/lancedb/lancedb · https://github.com/neuml/txtai · https://github.com/urchade/GLiNER · https://github.com/dottxt-ai/outlines · https://github.com/567-labs/instructor · https://github.com/explosion/spaCy
- https://huggingface.co/google/embeddinggemma-300m · https://huggingface.co/Qwen/Qwen3-Embedding-0.6B · https://huggingface.co/nomic-ai/nomic-embed-text-v2-moe · https://huggingface.co/BAAI/bge-m3
- https://huggingface.co/Qwen/Qwen3-8B · https://huggingface.co/Qwen/Qwen3.5-9B · https://huggingface.co/google/gemma-4-E4B-it · https://huggingface.co/google/gemma-3-12b-it · https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506 · https://huggingface.co/microsoft/Phi-4-mini-instruct · https://ollama.com/library/qwen3.5 · https://ollama.com/library/gemma4 · https://ollama.com/library/gpt-oss · https://ollama.com/library/qwen3-embedding · https://ollama.com/library/embeddinggemma · https://ollama.com/library/mistral-small3.2
- https://docs.sillytavern.app/usage/core-concepts/worldinfo/ · https://github.com/SillyTavern/SillyTavern (public/scripts/world-info.js) · https://github.com/malfoyslastname/character-card-spec-v2 · https://github.com/kwaroran/character-card-spec-v3
- https://ldtk.io/json/ · https://github.com/deepnight/ldtk (docs/JSON_SCHEMA.json) · https://doc.mapeditor.org/en/stable/manual/custom-properties/ · https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md · https://github.com/CleverRaven/Cataclysm-DDA (doc/JSON/JSON_INHERITANCE.md) · https://github.com/veloren/veloren · https://github.com/Anuken/Mindustry · https://github.com/00-Evan/shattered-pixel-dungeon
- https://docs.godotengine.org/en/stable/tutorials/i18n/localization_using_gettext.html
