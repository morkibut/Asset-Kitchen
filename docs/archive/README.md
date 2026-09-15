# Archive

**Rien ici ne fait foi, et rien ici n'est à faire.** Ce dossier garde ce qui a servi et qui
est fini : des versions livrées, des séances d'essai closes, des études qui ont tranché une
question et n'ont plus rien à dire.

On l'ouvre dans un seul cas : **quand on veut savoir pourquoi une décision est ce qu'elle
est**, et que le document qui fait foi ne suffit pas. Jamais au démarrage d'une séance.

Ce qui fait foi vit ailleurs :

| Le document | Ce sur quoi il fait foi |
|---|---|
| `docs/PRD.md` | Ce que le produit doit faire, du point de vue de l'usage |
| `docs/PLAN.md` | Ce qui reste à construire, et dans quel ordre |
| `docs/ARCHITECTURE.md` | Comment c'est construit |
| `docs/PIEGES.md` | Ce sur quoi on s'est déjà cassé les dents |
| `docs/bilan-v3.md` | Ce que les bancs et les analyses de la V3 ont établi |

---

## Ce que ce dossier contient

### `plan-versions-tenues.md`

**Le détail des cinq versions livrées** — V1 (dix tranches), V2 (le personnage et son
équipement, cinq tranches), les cinq reprises R1 à R5, la V2.1 (l'interface refaite,
vingt-et-une étapes), les treize reprises d'usage U1 à U13, et la V2.2 (les autres
fournisseurs, close à cinq tranches sur six).

Descendu de `docs/PLAN.md` le 2 septembre 2026. **Le texte n'a pas bougé d'un mot** : seul
l'endroit où on le lit a changé. Le plan pesait 173 Ko dont plus des trois quarts racontaient
du travail fini, et il est ouvert à chaque séance.

Les critères d'acceptation de chaque tranche, eux, n'ont jamais été ici : ils sont dans
`docs/tranches/`, un fichier par tranche.

### `essais-v3/`

**Les cinq documents préparatoires de la V3**, tous clos. Ce qu'ils ont trouvé est résumé,
chiffré et conclu dans `docs/bilan-v3.md` — c'est celui-là qu'il faut lire.

| Le fichier | Ce qu'il a servi à faire, et ce qu'il a répondu |
|---|---|
| `essai-animation.md` | Le mode d'emploi des deux premières séances de banc — comment monter le personnage jetable, quoi cliquer, où regarder. **Les séances sont faites** |
| `etude-prompts.md` | L'étude des façons de demander un mouvement. **Réponse : aucune ne bat celle du produit** |
| `etude-mannequin.md` | L'étude du mannequin articulé comme référence de posture. **Elle a mené au pantin en deux dimensions**, qui est la tranche A8 |
| `etude-gameforge.md` | Ce qu'un produit concurrent fait de ses assets. **Deux idées retenues** — la recette par type d'image, et les mesures d'acceptation d'un tirage. Rien n'y a été payé |
| `etude-matte.md` | Le chantier de correction du bord par calcul de transparence. **Écarté** : le défaut vaut un pixel sur mille sur les vraies images |

### Les quatre documents isolés

| Le fichier | Pourquoi il est ici |
|---|---|
| `v21-corrections-a-traiter.md` | Les vingt-et-un points relevés sur l'interface refaite, traités un par un. **Tous fermés** — ce qu'ils ont changé vit dans les treize reprises U1 à U13 |
| `recherche-vision.md` | La recherche sur les techniques de vision par ordinateur. **Elle a servi à écarter**, et les raisons sont reprises là où elles décident |
| `brainstorm-assistance.md` | Le carnet de l'assistance à l'écriture d'un texte de génération. Non planifié |
| `cadre-v2.prompt.md` | Le texte qui a servi à cadrer la V2. **La V2 est livrée** |

### Ce qui est descendu depuis le 6 septembre 2026

Les plans finis ou périmés, et ce que les documents d'autorité ont cessé de porter — toujours
**sans qu'un mot change**, et le banc `py essais/essai_docs.py` a nommé chaque renvoi cassé
par la descente.

| Le fichier | Ce qu'il garde | Descendu le |
|---|---|---|
| `plan-r6-a-v3.02.md` | le détail de sept blocs finis — `R6` à `R9`, V2.3, V2.4, V3, V3.02 | 6 sept. 2026 |
| `plan-perime-par-la-v4.md` | ce que la V2.5, la V3.01, la V3.03 et la V3.1 promettaient ; **les quatorze tranches `G` s'y relisent** | 6 sept. 2026 |
| `PLAN-carnet-affectation.md` | l'affectation d'un plan dont l'exécution active s'est arrêtée le 11 septembre | 13 sept. 2026 |
| `etat-carnet-2026-09-10.md` | le relevé du carnet tel qu'il était le 10 septembre | 11 sept. 2026 |
| `ordre-historique-jusqu-au-10-septembre.md` | dans quel ordre l'existant a été construit, de `R6` à la V3.1 — **et, depuis le 15 septembre, ce que `AGENTS.md` et `docs/PLAN.md` gardaient encore de la V3** : le pantin 2D, la piste des poses par le moteur de la maison, le risque levé de la recette d'animation | 13 et 15 sept. 2026 |
| `plan-carnet-amendement-rf.md` | l'amendement RF du plan du carnet — huit tranches proposées le 11 septembre et remplacées le jour même par l'atelier unifié ; ses soixante cases ne se cochent plus | 15 sept. 2026 |
| `DESIGN-avant-refonte-2026-09-04.md`, `DESIGN-chassis-chaud-2026-09-04.md` | les deux systèmes de design d'avant le papier — à ne pas confondre | 4 sept. 2026 |
| `maquettes-v2.1/`, `maquettes-v2.4/`, `maquettes-v3/`, `maquette-atelier.html`, `audit-design-post-v21.html` | des interfaces remplacées deux fois ; encore citées comme preuve de mesures passées | 13 sept. 2026 |
| `pistes-2026-09-04/` | les planches d'exploration devenues le carnet — **`vocabulaire.html` en est ressorti**, parce qu'il gouverne | 13 sept. 2026 |
| `recherche-llm-local/`, `recherche-video-locale/`, `analyse-pre-v3/`, `diagrams/` | des études conclues ; les conclusions qui comptent sont remontées dans `docs/releve-pixel-engine.md` et `docs/bilan-v3.md` | 13 sept. 2026 |
| `status-atelier-unifie/` | un instantané du tableau de bord, pris avant `AU18` | 13 sept. 2026 |
| `v3-animation.md`, `releve-fournisseurs.md`, `vignettes-vues.md`, `v21-arbitrages.md`, `questions-du-lot-U.md`, `vocabulaire-a-fermer.md`, `design-preview-refonte.html`, `design-preview-propositions.html` | le détail derrière des décisions prises — le bilan, le PRD et le vocabulaire fermé en donnent les conclusions | 13 sept. 2026 |
