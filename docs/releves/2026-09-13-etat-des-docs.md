# État des documents — 13 septembre 2026

> Relevé demandé par l'auteur pour retrouver un plan clair dans `docs/`. Ce fichier **n'a rien
> déplacé** : c'est un inventaire et une proposition, rien de plus. Les poids viennent de
> `git ls-files` et de la taille réelle des fichiers ; les dates viennent de
> `git log -1 --date=short`. Les comptes de citation viennent d'une recherche du nom de chaque
> fichier dans tous les fichiers suivis par Git (`docs/`, `atelier/`, `interface/src/`, `tests/`,
> `essais/`, `AGENTS.md`) — les copies de travail sous `.claude/worktrees/` sont exclues, elles
> auraient triplé les chiffres pour rien.

## En un coup d'œil

| | Nombre | Poids |
|---|---|---|
| Documents vivants | 42 | 5,5 Mo |
| Périmés | 2 | 57 Ko |
| Doublons | 1 | 305 Ko |
| À archiver | 17 | 39,5 Mo |
| **Total** | **62** (47 fichiers, 15 dossiers) | **45,4 Mo** |

**Le poids ne dit pas grand-chose seul** : 39,5 Mo sur 45,4 Mo à archiver, c'est presque tout le
poids du dossier — mais c'est surtout deux dossiers de bancs d'essai (`recherche-video-locale`,
`pistes-2026-09-04`) qui pèsent des images et des vidéos, pas du texte. En nombre de fichiers, le
corpus est plutôt sain : 42 documents vivants sur 62 entrées.

## Ce qui fait foi aujourd'hui

- **`docs/PRD.md`** : ce que le produit doit faire.
- **`docs/ARCHITECTURE.md`** : comment c'est construit.
- **`docs/PLAN.md`**, § *Où en est le dépôt* : l'ordre de construction et l'avancement — **un
  seul endroit**, depuis le 6 septembre 2026.
- **`docs/DESIGN.md`** : à quoi ça ressemble.
- **`docs/PLAN-atelier-unifie.md`** : le détail du chantier actif, AU1 à AU20.
- **`docs/README.md`** : l'index de toutes les annexes, et quand ouvrir chacune.
- **`AGENTS.md`** (racine, hors `docs/`) : comment travailler ici, et qui fait foi sur quoi.

Cinq de ces documents se lisent au démarrage d'une session (`AGENTS.md`, `PRD.md`,
`ARCHITECTURE.md`, `PLAN.md`, `DESIGN.md`) ; tout le reste se lit à la demande.

## Les contradictions

### Le coin du calque — construit, mais l'index dit encore le contraire

- **`docs/README.md`** dit : la maquette `docs/maquettes-v2.4/01-le-coin-du-calque.html`
  « **attend l'arbitrage de l'auteur** — la tranche qui bâtira l'écran ne s'écrit pas avant. »
- **`docs/PLAN.md`** dit : la V2.4 (`M1` à `M7`, dont « le coin où l'on fabrique un calque se
  redessine ») est **close depuis le 4 septembre 2026, sept critères sur sept**.
- **Lequel a raison** : `docs/PLAN.md`. Vérifié dans `docs/archive/plan-r6-a-v3.02.md`, ligne
  1334 : le critère de la tranche `M1` — « la maquette existe dans `docs/maquettes-v2.4/`,
  ouvrable seule, sans serveur » — est coché, et la tranche est marquée « livrée le 4 septembre
  2026 ». L'écran existe. **`docs/README.md` n'a pas été corrigé après coup**, alors qu'il porte
  lui-même la date du 13 septembre — ce n'est pas une vieille copie oubliée, c'est une phrase
  qu'on a relue sans la changer.

### Trois tranches déjà construites, et aucun modèle recommandé pour les coder

- **`docs/PLAN-atelier-unifie-affectation.md`** (qui dit quel modèle utiliser pour chaque
  tranche) classe les tranches **jusqu'à `AU17`** et s'arrête là.
- **`docs/PLAN.md`** et **`docs/PLAN-atelier-unifie.md`** disent que **`AU18`, `AU19` et `AU20`
  sont closes depuis le 13 septembre 2026** — donc déjà codées.
- **Lequel a raison** : les deux plans sont à jour, c'est le fichier d'affectation qui n'a pas
  suivi. Trois tranches ont donc été construites sans qu'aucun document ne dise quel modèle les
  coder — ce que la règle d'`AGENTS.md` (« vérifier l'affectation avant de coder une tranche »)
  demande pourtant de lire à chaque fois. Ce n'est pas grave en soi puisque les tranches sont
  faites, mais le prochain arrêt de fin d'étape ne trouvera pas la ligne d'en-tête pour `AU21`
  si une tranche suivante s'ouvre sans que ce fichier soit complété d'abord.

### Deux tableaux de bord d'avancement, aucun des deux à jour

- **`docs/status/index.html`** (titre : « Asset Kitchen — avancement ») et
  **`docs/status-atelier-unifie/index.html`** (titre : « Asset Kitchen — PRD — avancement »)
  sont deux sorties du même outil de tableau de bord, générées à deux moments différents.
- Aucun document d'autorité ne renvoie vers l'un ou l'autre pour dire lequel regarder, et le
  second ne connaît pas `AU18` à `AU20` : il a été généré avant leur clôture.
- **Lequel a raison** : ni l'un ni l'autre. Le tableau d'état vit **exclusivement** dans
  `docs/PLAN.md` depuis le 6 septembre 2026 — c'est écrit noir sur blanc dans `AGENTS.md`, § *Où
  en est le dépôt*. Ces deux fichiers HTML sont des photos prises un jour donné par un outil, pas
  des documents qu'on met à jour ; les garder tous les deux à côté l'un de l'autre fait croire
  qu'il y a un choix à faire entre eux, alors qu'aucun ne fait foi.

## Les interfaces qui n'existent plus

Cinq documents décrivent un écran que le code ne montre plus, remplacé depuis par l'atelier
unifié (et, avant lui, par le carnet) : `docs/maquette-atelier.html`, `docs/maquettes-v2.1/`
(26 maquettes), `docs/maquettes-v2.4/`, `docs/maquettes-v3/` et `docs/audit-design-post-v21.html`.
Aucun n'est faux au sens où il mentirait sur ce qu'il montre — chacun date correctement de son
époque — mais aucun ne doit plus servir à construire un écran aujourd'hui. Trois d'entre eux
sont encore cités par du code ou des tests comme preuve d'une mesure passée (voir l'inventaire) :
ce sont des traces, pas des guides.

## L'inventaire

### Les cinq documents de démarrage

| Document | Poids | Dernière touche | Cité par | Verdict | Pourquoi |
|---|---|---|---|---|---|
| `docs/ARCHITECTURE.md` | 41 Ko | 2026-09-11 | 78 fichiers | Vivant | Comment c'est construit. À jour avec l'atelier unifié |
| `docs/DESIGN.md` | 28 Ko | 2026-09-12 | 117 fichiers | Vivant | L'apparence. Le plus cité de tous les documents |
| `docs/PLAN.md` | 47 Ko | 2026-09-13 | 115 fichiers | Vivant | L'ordre et l'avancement — un seul endroit depuis le 6 septembre |
| `docs/PRD.md` | 13 Ko | 2026-09-12 | 65 fichiers | Vivant | Ce que le produit doit faire, dégraissé en cinq annexes |

*(`AGENTS.md`, le cinquième document de démarrage, est à la racine du dépôt, hors `docs/` — non
compté ici.)*

### Le plan, ses annexes et son historique

| Document | Poids | Dernière touche | Cité par | Verdict | Pourquoi |
|---|---|---|---|---|---|
| `docs/PLAN-atelier-unifie.md` | 44 Ko | 2026-09-13 | 16 fichiers | Vivant | Le détail du chantier actif, AU1 à AU20 |
| `docs/PLAN-atelier-unifie-affectation.md` | 16 Ko | 2026-09-12 | 5 fichiers | Vivant, incomplet | S'arrête à AU17 alors qu'AU18-AU20 sont closes — voir contradictions |
| `docs/PLAN-carnet.md` | 223 Ko | 2026-09-11 | 33 fichiers | Vivant | Historique : sert à vérifier une capacité déjà livrée. L'ordre actif est ailleurs |
| `docs/PLAN-carnet-affectation.md` | 28 Ko | 2026-09-11 | 4 fichiers | À archiver | Affectation d'un plan dont l'exécution active s'est arrêtée le 11 septembre |
| `docs/bilan-v3.md` | 29 Ko | 2026-09-03 | 29 fichiers | Vivant | Remplace la lecture des sept documents préparatoires de la V3 |
| `docs/v3-animation.md` | 42 Ko | 2026-09-03 | 12 fichiers | À archiver | Détail planche par planche des trois bancs ; le bilan suffit dans presque tous les cas |
| `docs/cadrage-fil-et-3d.md` | 14 Ko | 2026-09-08 | 1 fichier | Vivant | Préparation pour après la V4 ; rien construit encore, mais toujours valable |
| `docs/archive/` (17 fichiers) | 894 Ko | 2026-09-11 | 97 fichiers | Vivant | Le dossier d'archive joue son rôle : versions tenues, études closes, plans périmés |
| `docs/tranches/` (27 fichiers) | 696 Ko | 2026-09-11 | 39 fichiers | Vivant | Critères d'acceptation par tranche — T1 à V4.md |
| `docs/status/` (`etat.md` + 2 fichiers) | 570 Ko | 2026-09-13 | 22 fichiers | Vivant | `etat.md` est le journal qui fait foi ; les 2 autres fichiers sont un tableau de bord — voir doublon |
| `docs/status-atelier-unifie/` (2 fichiers) | 305 Ko | 2026-09-12 | 1 fichier | Doublon | Second tableau de bord, généré avant AU18-AU20, sans lien depuis aucun document d'autorité |

### L'architecture et ses annexes

| Document | Poids | Dernière touche | Cité par | Verdict | Pourquoi |
|---|---|---|---|---|---|
| `docs/archi-atelier-unifie.md` | 10 Ko | 2026-09-11 | 5 fichiers | Vivant | Contrat de demande, travail, source, livraison de l'atelier unifié |
| `docs/archi-fournisseur.md` | 19 Ko | 2026-09-11 | 12 fichiers | Vivant | Modèles, catalogue, contrat de génération — à jour (Cloudflare bien retiré) |
| `docs/archi-objets.md` | 22 Ko | 2026-09-08 | 3 fichiers | Vivant | Le modèle d'objets, avec ses changements V4 et B20 annotés en marge |
| `docs/archi-risques.md` | 9 Ko | 2026-09-06 | 3 fichiers | Vivant | Ce qu'une version doit lever |
| `docs/archi-versions.md` | 64 Ko | 2026-09-03 | 34 fichiers | Vivant | Les briques par version, V1 à V5 |
| `docs/carte-du-depot.md` | 225 Ko | 2026-09-12 | 9 fichiers | Vivant | Fichier par fichier, ce que chacun tient. Le plus lourd des documents vivants — à surveiller |

### Le design et ses annexes

| Document | Poids | Dernière touche | Cité par | Verdict | Pourquoi |
|---|---|---|---|---|---|
| `docs/design-decisions.md` | 141 Ko | 2026-09-06 | 20 fichiers | Vivant | Journal des décisions d'apparence, daté et chiffré |
| `docs/design-motifs.md` | 125 Ko | 2026-09-06 | 42 fichiers | Vivant | À quoi ressemble chaque écran |
| `docs/design-preview.html` | 30 Ko | 2026-09-06 | 9 fichiers | Vivant | Le spécimen vivant actuel — annexe officielle du skill `/design` |
| `docs/design-preview-refonte.html` | 59 Ko | 2026-09-04 | 3 fichiers | À archiver | La proposition qui a précédé le système actuel ; gardée comme trace de décision |
| `docs/design-preview-propositions.html` | 19 Ko | 2026-08-29 | 0 fichier | À archiver | Quatre formes explorées avant la refonte ; personne ne la cite |
| `docs/audit-design-post-v21.html` | 68 Ko | 2026-08-31 | 7 fichiers | À archiver | Audit de l'interface V2.1 « telle qu'elle tournait » — interface remplacée depuis. Cité par du code comme preuve d'une mesure passée |
| `docs/maquette-atelier.html` | 57 Ko | 2026-08-26 | 7 fichiers | À archiver | Maquette pré-atelier-unifié. `docs/README.md` le classe déjà « jamais d'office » |
| `docs/vocabulaire-a-fermer.md` | 18 Ko | 2026-09-06 | 2 fichiers | À archiver | Proposition de vocabulaire soumise à validation le 4 septembre ; la décision est prise depuis |
| `docs/etiquettes-livrees.md` | 11 Ko | 2026-09-01 | 5 fichiers | Vivant | Catalogue des 70 étiquettes de champs livrées avec l'atelier |

### Le PRD et ses annexes

| Document | Poids | Dernière touche | Cité par | Verdict | Pourquoi |
|---|---|---|---|---|---|
| `docs/prd-carnet.md` | 11 Ko | 2026-09-03 | 4 fichiers | Vivant | Pourquoi une décision du PRD est ce qu'elle est |
| `docs/prd-criteres.md` | 18 Ko | 2026-09-06 | 4 fichiers | Vivant | Critères de succès |
| `docs/prd-decisions.md` | 47 Ko | 2026-09-06 | 12 fichiers | Vivant | Ce que le produit a tranché sur un usage |
| `docs/prd-hors-perimetre.md` | 25 Ko | 2026-09-11 | 4 fichiers | Vivant | Ce qui a été écarté, et pourquoi |
| `docs/user-stories.md` | 121 Ko | 2026-09-12 | 12 fichiers | Vivant | Les user stories par numéro, US-1 à US-544+ |

### Les relevés, revues et bancs

| Document | Poids | Dernière touche | Cité par | Verdict | Pourquoi |
|---|---|---|---|---|---|
| `docs/bancs.md` | 14 Ko | 2026-09-06 | 3 fichiers | Vivant | Les 29 bancs, ce qu'ils coûtent, ce qu'ils ont trouvé |
| `docs/modeles-et-workflows.md` | 11 Ko | 2026-09-13 | 1 fichier | Vivant | Le plus récent du dossier — mesures du banc `sc-clone`, 11-13 septembre |
| `docs/releve-outillage.md` | 34 Ko | 2026-09-03 | 5 fichiers | Vivant | Sources et licences du détourage — détail complet, le bilan en donne les conclusions |
| `docs/releve-pixel-engine.md` | 23 Ko | 2026-09-12 | 1 fichier | Vivant | Ce qui a été mesuré chez le fournisseur commun de SpriteCook |
| `docs/releve-usage.md` | 29 Ko | 2026-09-03 | 14 fichiers | Vivant | Ce qui n'est pas encore cadré ni planifié |
| `docs/releve-au4-outils.md` | 21 Ko | 2026-09-12 | 1 fichier | Vivant | Inventaire des accès conservés pour AU4, daté du 12 septembre |
| `docs/releve-fournisseurs.md` | 25 Ko | 2026-08-31 | 12 fichiers | Périmé | Recommande Cloudflare comme fournisseur principal ; retiré par l'auteur le 8 septembre |
| `docs/revue-conformite-carnet-2026-09-11.md` | 49 Ko | 2026-09-12 | 4 fichiers | Vivant | Écarts maquettes / code du carnet |
| `docs/revue-ux-complete-2026-09-12.md` | 36 Ko | 2026-09-12 | 3 fichiers | Vivant | Comparaison prototype / interface réelle / anciennes planches |
| `docs/releves/` (10 fichiers dont un README) | 762 Ko | 2026-09-13 | 8 fichiers | Vivant | Notes datées mesurant le produit tel qu'il est, sans opinion |
| `docs/remarques.md` + `docs/remarques/` (22 fichiers) | 30 Ko + 364 Ko | 2026-09-04 | 6 + 12 fichiers | Vivant | Journal de remarques d'usage. Absent de l'index `docs/README.md` — à y ajouter |
| `docs/v21-arbitrages.md` | 49 Ko | 2026-08-31 | 16 fichiers | À archiver | Arbitrages d'une version (V2.1) entièrement tenue ; ne fait foi sur rien par construction |
| `docs/questions-du-lot-U.md` | 17 Ko | 2026-09-01 | 4 fichiers | À archiver | Questions ouvertes du lot U, clos depuis et repris par l'usage |
| `docs/vignettes-vues.md` | 31 Ko | 2026-09-01 | 3 fichiers | Périmé | Consignes pour un écran de `maquettes-v2.1/` qui n'existe plus |

### Les maquettes et les pistes

| Document | Poids | Dernière touche | Cité par | Verdict | Pourquoi |
|---|---|---|---|---|---|
| `docs/maquettes-atelier-unifie/` (19 fichiers) | 544 Ko | 2026-09-12 | 4 fichiers | Vivant | Le design actuel, en proposition — toile, retouche, livraison |
| `docs/maquettes-v2.1/` (37 fichiers) | 2,5 Mo | 2026-09-03 | 28 fichiers | À archiver | Interface remplacée deux fois depuis (carnet, puis atelier unifié). Encore citée pour les critères déjà tenus |
| `docs/maquettes-v2.4/` (1 fichier) | 42 Ko | 2026-09-04 | 4 fichiers | À archiver | L'écran qu'elle proposait est construit depuis le 4 septembre — voir contradictions |
| `docs/maquettes-v3/` (1 fichier) | 2,6 Mo | 2026-09-03 | 6 fichiers | À archiver | Interface V3, remplacée par le carnet puis l'atelier unifié |
| `docs/pistes-2026-09-04/` (65 fichiers) | 7,5 Mo | 2026-09-06 | 57 fichiers | À archiver | Les planches d'exploration devenues la V4 (le carnet). Le carnet livré fait foi ; ce dossier garde la trace de l'origine |
| `docs/diagrams/` (6 fichiers) | 1,0 Mo | 2026-09-03 | 1 fichier | À archiver | Deux schémas Excalidraw. `docs/README.md` le classe déjà « jamais d'office » |
| `docs/analyse pre-v3/` (1 fichier) | 98 Ko | 2026-09-03 | 0 fichier | À archiver | Audit pré-V3, non cité, absent de l'index |

### Les recherches latérales

| Document | Poids | Dernière touche | Cité par | Verdict | Pourquoi |
|---|---|---|---|---|---|
| `docs/recherche-llm-local/` (6 fichiers) | 1,4 Mo | 2026-09-03 | 3 fichiers | À archiver | Étude de faisabilité conclue : la machine peut, le résultat n'est pas assez bon. Rien à construire dessus |
| `docs/recherche-video-locale/` (15 fichiers) | 24,1 Mo | 2026-09-12 | 7 fichiers | À archiver | Le dossier le plus lourd de `docs/` — bancs d'images et de vidéos. Ses conclusions sont déjà remontées dans `docs/releve-pixel-engine.md` |

## Ce qu'on propose de déplacer

- `docs/PLAN-carnet-affectation.md` → `docs/archive/` — affectation d'un plan dont l'exécution
  active s'est arrêtée le 11 septembre 2026.
- `docs/v3-animation.md` → `docs/archive/` — détail des trois bancs de la V3 ; `docs/bilan-v3.md`
  en donne les conclusions et suffit dans presque tous les cas.
- `docs/design-preview-refonte.html` → `docs/archive/` — proposition remplacée par
  `docs/design-preview.html`, gardée comme trace de la décision qui l'a suivie.
- `docs/design-preview-propositions.html` → `docs/archive/` — quatre formes explorées avant la
  refonte, citées par aucun document.
- `docs/audit-design-post-v21.html` → `docs/archive/` — audit d'une interface remplacée ; garder
  la trace pour les trois fichiers de code qui la citent encore comme preuve d'une mesure.
- `docs/maquette-atelier.html` → `docs/archive/` — maquette pré-atelier-unifié, déjà classée
  « jamais d'office » par `docs/README.md`.
- `docs/vocabulaire-a-fermer.md` → `docs/archive/` — proposition soumise le 4 septembre ; la
  décision de vocabulaire est prise depuis.
- `docs/v21-arbitrages.md` → `docs/archive/` — arbitrages d'une version entièrement tenue.
- `docs/questions-du-lot-U.md` → `docs/archive/` — questions d'un lot clos, reprises par l'usage
  depuis.
- `docs/releve-fournisseurs.md` → `docs/archive/` — recommande un fournisseur retiré par
  l'auteur le 8 septembre 2026.
- `docs/vignettes-vues.md` → `docs/archive/` — consignes pour un écran de `maquettes-v2.1/` qui
  n'existe plus.
- `docs/maquettes-v2.1/` → `docs/archive/maquettes-v2.1/` — interface remplacée deux fois ; 2,5 Mo.
- `docs/maquettes-v2.4/` → `docs/archive/maquettes-v2.4/` — écran déjà construit depuis le
  4 septembre.
- `docs/maquettes-v3/` → `docs/archive/maquettes-v3/` — interface remplacée deux fois ; 2,6 Mo.
- `docs/pistes-2026-09-04/` → `docs/archive/pistes-2026-09-04/` — source devenue le carnet livré ;
  7,5 Mo, le second dossier le plus lourd de `docs/`.
- `docs/diagrams/` → `docs/archive/diagrams/` — déjà « jamais d'office » selon `docs/README.md` ;
  1,0 Mo.
- `docs/analyse pre-v3/` → `docs/archive/analyse-pre-v3/` — non cité, absent de l'index ; 98 Ko.
- `docs/recherche-llm-local/` → `docs/archive/recherche-llm-local/` — étude conclue, rien à
  construire dessus ; 1,4 Mo.
- `docs/recherche-video-locale/` → `docs/archive/recherche-video-locale/` — conclusions déjà
  reprises dans `docs/releve-pixel-engine.md` ; 24,1 Mo, le dossier le plus lourd du dépôt.
- `docs/status-atelier-unifie/` → à supprimer plutôt qu'à archiver — instantané d'un outil de
  tableau de bord, généré avant AU18-AU20, sans lien depuis aucun document. Rien à en garder
  puisque `docs/status/etat.md` porte déjà le vrai journal.

**Deux corrections de texte, pas des déplacements** : la phrase de `docs/README.md` sur
`docs/maquettes-v2.4/` (« attend l'arbitrage ») est fausse depuis le 4 septembre et mérite d'être
réécrite ; `docs/README.md` ne mentionne nulle part `docs/remarques.md` ni `docs/remarques/`, à
ajouter à l'index.
