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
