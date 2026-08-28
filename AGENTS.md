# Asset Kitchen

Atelier personnel de production d'assets 2D pour jeu. On y définit **l'univers** d'un jeu
une fois, puis on fabrique au cas par cas les personnages, objets, décors et interfaces qui
lui appartiennent. **Tout ce qui est produit entre en bibliothèque de lui-même** ; juger,
c'est marquer favori ou supprimer, et ce qui est jugé l'est avant de partir dans le jeu, pas
avant d'entrer dans la bibliothèque. Un serveur MCP expose les mêmes gestes à un agent qui
code le jeu.

Ce fichier-ci ne dit que **comment travailler dans ce dépôt**. Ce qu'il faut construire vit
dans `docs/`, réparti selon la règle d'autorité ci-dessous.

## Où en est le dépôt → `docs/status/etat.md`

**Les dix tranches T1 à T10 sont finies, C1 et C2 — les deux premières de la V2 — le sont
aussi, et les reprises R1 et R2 également.** Les 164 critères d'acceptation sont cochés dans
`docs/PLAN.md` ; 307 tests de serveur et 138 d'écran les tiennent. La V1 s'est arrêtée à T7 ;
T8, T9 et T10 sont venues après.
**La suite ouverte du plan compte trois entrées** : les deux reprises restantes, R3 et R4 —
l'import depuis l'écran, l'infobulle qui ne couvre plus le réglage —, et C3, la pièce et le
calque, qui réemploie le pliage de C2 tel quel. **Les reprises ne bloquent pas C3 et C3 ne les
bloque pas** : elles se prennent dans l'ordre qu'on veut.

Le journal complet — ce que chaque tranche a livré, et surtout ce que chacune a appris en
étant *utilisée* — vit dans **`docs/status/etat.md`**. Il ne fait foi sur rien : on l'ouvre
pour savoir pourquoi c'est comme ça, pas pour savoir quoi faire.

**La règle qui en est sortie, elle, tient ici** : *une tranche n'est finie que lorsqu'on s'en
est servi*. Neuf tranches de suite, s'en servir a trouvé des défauts qu'aucun test ne voyait
— jusqu'à cinq d'un coup. Et depuis T9, une conception mise à juger **avant** la première
ligne de code en a trouvé un qu'aucune séance n'aurait vu : deux gestes corrects isolément
dont la composition perdait quelque chose en silence.

## Lancer

```
uv venv --python 3.11
uv pip install -e ".[dev]"
uv pip install -e ".[detourage]"   facultatif — le second moteur de détourage, ~180 Mo
                                   (le modèle `u2net` se télécharge au premier appel)
cd interface && npm install && npm run build

py -m atelier                        lance le serveur et ouvre le navigateur
py -m atelier --sans-navigateur --port 8421
pytest -q                            les critères d'acceptation, sans un centime
cd interface && npm test             les essais d'écran — flux et fetch doublés, sans serveur
py essais/essai_couverture.py        la couverture du fournisseur, gratuit
py essais/essai_pixel.py             brut contre traité, sur les images déjà là, gratuit
py essais/essai_export.py            l'archive rouverte, sur ce que l'atelier a — gratuit
                                     (demande un atelier lancé)
py essais/essai_premiere_image.py    UN APPEL PAYANT, ~$0,006
py essais/essai_univers_chaine.py    UN APPEL PAYANT, ~$0,023 — la chaîne de T4 de bout en bout
py essais/essai_decoupe_planche.py   UN APPEL PAYANT, ~$0,004 — une vraie planche, découpée
```

**Brancher un agent.** Le serveur MCP vit dans le même processus que l'API, sur `/mcp` :

```
claude mcp add --transport http atelier http://127.0.0.1:8420/mcp
```

L'atelier doit tourner — c'est le même processus. `localhost` marche aussi ; **rien d'autre**,
l'en-tête `Host` étant vérifié par le transport contre le réattachement DNS.

`interface/dist` est un produit de compilation, hors Git : **sans `npm run build`, le
serveur sert une page qui le dit** au lieu de l'atelier. En développement,
`cd interface && npm run dev` sert l'interface sur 5173 et relaie `/api` vers 8420.

`donnees/atelier.sqlite3` est un **index jetable**. Au premier démarrage qui suit une
évolution du schéma, il est effacé et refait en relisant `donnees/` : quelques dizaines de
millisecondes, rien à faire, et rien à sauvegarder. L'effacer soi-même est un geste sans
conséquence — c'est même un critère d'acceptation de T3.

L'API est documentée d'elle-même sur `/api/docs`.

## Les documents et leur autorité

**Une question, un document qui fait foi.** Aucun ne répète ce qu'un autre dit — il le
référence. C'est cette règle, et elle seule, qui évite la divergence entre documents : la
fragilité n°1 relevée chez SpriteCook, où la doc publique et le schéma du serveur ne se
recouvraient plus.

| La question | Le document qui tranche | Produit par |
|---|---|---|
| Que doit faire le produit, du point de vue de l'usage ? | `docs/PRD.md` | `/cadre` |
| Comment est-ce construit ? | `docs/ARCHITECTURE.md` | à la main, `/interroge` en amont |
| Dans quel ordre le construit-on ? | `docs/PLAN.md` | `/planifie` |
| À quoi ça ressemble ? | `docs/DESIGN.md` | `/design` |
| À quoi ressemble *cet écran-là* ? | `docs/design-motifs.md` | `/design` |
| Pourquoi ce choix d'apparence, et à quel coût ? | `docs/design-decisions.md` | `/design` |
| Comment travaille-t-on ici ? | `AGENTS.md` | à la main |
| Sur quoi va-t-on se casser les dents ? | `docs/PIEGES.md` | à la main, à chaque piège payé |
| Comment en est-on arrivé là ? | `docs/status/etat.md` | à la main, à chaque fin de tranche |

En cas de contradiction entre deux documents, **celui dont c'est la question l'emporte**, et
l'autre est corrigé dans la foulée — jamais laissé en l'état.

**Cinq documents se lisent au démarrage d'une session, et cinq seulement** : `AGENTS.md`,
`docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/PLAN.md`, `docs/DESIGN.md`. Tout le reste de
`docs/` **se lit à la demande, quand la tâche le demande** — jamais « pour se mettre en
contexte » : c'est là qu'un corpus de démarrage triple sans que personne ne le décide.

| Annexe | On l'ouvre quand |
|---|---|
| `docs/PIEGES.md` | avant de toucher un terrain déjà miné, ou sur renvoi du code |
| `docs/plan-archive.md` | on veut les critères d'acceptation ou le rapport de tenue d'une tranche |
| `docs/design-motifs.md` | on dessine un écran |
| `docs/design-decisions.md` | on rouvre une décision d'apparence |
| `docs/status/etat.md` | on cherche pourquoi c'est comme ça plutôt qu'autrement |
| `docs/design-preview.html`, `docs/diagrams/`, `docs/maquette-atelier.html` | jamais d'office |

**Un document d'autorité ne grossit pas indéfiniment.** Dès qu'une section pèse plus que le
document qui la porte, elle sort en annexe et laisse un renvoi. Le corpus de démarrage a
triplé une fois, en dix tranches, sans que personne ne le décide : c'est le seul garde-fou.

## Les skills et leurs frontières

Chaque skill possède **un livrable et un seul**. Un skill qui écrit hors de sa colonne
produit de la duplication, et la duplication devient contradiction.

| Skill | Écrit | S'arrête à |
|---|---|---|
| `/interroge` | **rien** | dialogue de cadrage. Ce qui en sort est reporté à la main dans le bon document. |
| `/cadre` | `docs/PRD.md` | l'usage. Ni techno nommée, ni chemin de fichier, ni code. Test : si l'utilisateur ne peut pas observer la différence, c'est hors PRD. |
| `/planifie` | `docs/PLAN.md` | l'ordre. Pas de noms de fichiers ni de fonctions — ils changeront. |
| `/design` | `docs/DESIGN.md`, ses deux annexes, `docs/design-preview.html` | l'apparence. Aucune décision de comportement produit. |
| `/investigue` | **rien** | réactif, sur un symptôme constaté. Quatre phases, chacune validée avant la suivante. |
| `/illustre` | un PNG/SVG dans `docs/` | un diagramme qui *argumente*. Jamais décoratif. |
| `/branche`, `/livre` | git | — |

**Les trois débordements à surveiller**, parce qu'ils se produiront :

1. **`/cadre` qui redemande ce qui est tranché.** Le skill explore le repo avant d'interroger :
   lui donner `docs/ARCHITECTURE.md` en entrée le fait aller droit aux trous — les user
   stories, les états vides, les erreurs.
2. **`/planifie` qui réinvente le découpage.** Les tranches T1→T7 existent déjà dans
   `ARCHITECTURE.md` §6.3. Son travail est de les accrocher aux user stories et de leur
   donner des critères d'acceptation, pas d'en inventer d'autres.
3. **`/design` qui décide du produit.** Il choisit la typo, la couleur, la densité, le
   mouvement. Il ne choisit pas ce que fait un écran — ça, c'est le PRD.

**Après chaque skill, élaguer.** Ce qui migre vers `PRD.md` ou `PLAN.md` sort
d'`ARCHITECTURE.md` et y devient une simple référence. Le document rétrécit à mesure que la
chaîne avance : c'est le signe que ça marche.

## Où sont les choses

| | |
|---|---|
| `atelier/` | le paquet Python — `domaine/` les objets et les règles, `fournisseur/` le port et l'adaptateur OpenRouter, `services/` les gestes, `api/` les routes, `depot/` SQLite et fichiers, `image/` le traitement, `mcp/` vide jusqu'à T7 |
| `atelier/services/evenements.py` | la diffusion — ce que l'atelier annonce, à qui écoute. C'est elle qui remplace le sondage : un service qui change d'état le dit, personne ne redemande |
| `atelier/domaine/recette.py` | les cinq places d'une recette, **dans un ordre fixe** — détourage, recadrage, grille, quantification, bords. Et l'empreinte, qui nomme un rendu et rend deux recettes égales interchangeables |
| `atelier/image/traitement.py` | le pipeline : CPU, pur, aucune entrée-sortie. `detourer` et `finir` sont séparés parce que le premier coûte 130 ms et le second 28 — c'est ce qui rend la retouche instantanée |
| `atelier/services/assets.py` | poser une recette, revenir au brut, nommer une recette — et **le seul endroit du dépôt qui écrive un asset** (`sauver`). **Aucun `fournisseur` dans ce fichier**, et ça se lit dans les imports : T2 n'appelle jamais l'extérieur |
| `atelier/services/bibliotheque.py` | ranger, retrouver, juger, jeter, reconstruire. Pas de `fournisseur` non plus : tout T3 marche réseau coupé. C'est ici que vivent l'annulation courte, le refus de supprimer le dernier projet, l'adoption de ce qui existait avant les projets — et **le seul endroit qui écrive un projet** (`sauver_projet`), par où l'univers passe |
| `atelier/services/pliage.py` | C2 — demander N images en un seul appel, et déplier ce qui revient. **Il ne connaît ni personnage, ni pose, ni matrice**, et ça se lit dans ses imports : c'est la manière dont l'atelier traite N images d'un seul appel, et C3 le réemploie tel quel. Deux gestes séparés comme le slicer — `plier` prépare ce qui part, `deplier` range ce qui revient. Aucun `fournisseur` : déplier une planche déjà là marche réseau coupé. **Le seul refus automatique du produit vit ici**, et il est arithmétique |
| `atelier/image/pliage.py` | le gabarit de cases vides, et les deux mesures d'un lot — ressemblance entre cases, dérive de grille. CPU, pur : il compose ce que `decoupe.py` et `traitement.py` savent déjà faire, et c'est ce qui rend le pliage gratuit à réemployer. **Rien ici ne refuse** |
| `atelier/domaine/pliage.py` | la géométrie carrée d'un lot — **déduite du nombre de cases, jamais enregistrée** —, ses cases, et ce qu'on a mesuré sur chacune. `geometrie_connue` est la seule différence entre les deux usages du pliage : faux, l'atelier redécoupe sur les zones opaques (C2) ; vrai, sur la grille qu'il a posée lui-même (C3) |
| `atelier/services/production.py` | C1 — le plan de poses, les personnages, la matrice. **Trois gestes et un calcul** : la matrice n'est enregistrée nulle part, elle se déduit du plan, du personnage et des assets qui portent leur case. Aucun `fournisseur`, aucun `catalogue` : tout y marche réseau coupé, et ça se lit dans ses imports. Un personnage qui franchit le port porte **toujours** ses cases — `en_charge` est le seul endroit qui compose sa charge, et c'est un piège payé |
| `atelier/domaine/plan.py` | la pose et le plan d'un projet. Une pose porte un **identifiant** distinct de son nom : elle se renomme à tout moment, et les images déjà faites ne doivent pas perdre leur case. `plan_depuis_json` distingue **l'absence du vide** — un projet qui n'a jamais écrit de plan en reçoit un, un plan que l'auteur a vidé le reste |
| `atelier/domaine/personnage.py` | le personnage — et il **range ce qu'il écarte, jamais ce qu'il tient**. C'est ce qui rend « ajouter une pose ajoute une case vide à chacun » vrai sans réécrire un seul fichier de personnage. Il ne porte aucune image : c'est l'asset qui dit sa case |
| `atelier/services/univers.py` | le tableau et l'univers — coller, promouvoir, extraire la palette, réaligner. **Le seul service qui sorte sans être une génération**, et par une seule méthode : `recuperer`, l'adresse collée. Tout le reste marche réseau coupé |
| `atelier/domaine/lien.py` | **le seul objet neuf du modèle depuis T4** — un trait entre deux objets de la toile. Il naît muet, et une extrémité est un couple `(genre, valeur)` parce qu'une carte et un îlot ne se nomment pas dans le même espace. `depuis_json` rend **rien** plutôt que de lever : un lien illisible est un lien sans extrémité, donc un lien qui doit disparaître, et c'est déjà la règle |
| `atelier/domaine/teinte.py` | la liste close des six teintes, et rien de ce qu'elles valent — **aucun hexadécimal ici** : le produit range un *nom*, l'écran seul sait ce qu'il vaut par son token. Un module à part parce que la carte et le projet s'en servent tous les deux et qu'aucun ne la possède |
| `atelier/domaine/carte.py` | la deuxième famille d'images du produit. Elle ne s'exporte jamais, ne compte pas dans la bibliothèque, n'a ni recette ni rendu. Elle appartient à son projet, et part avec lui |
| `atelier/domaine/projet.py` (§ Univers) | la bible en cinq champs nommés, le barème d'échelles — une nature de sujet porte **sa famille et son occupation à la fois** —, la cible de pixel, les modèles par famille, et `recette_de()`, **le seul endroit qui dise ce qu'un projet impose** |
| `atelier/image/palette.py` | d'où vient la palette d'un univers. CPU, pure, aucune entrée-sortie. Détoure d'abord — sans quoi le fond plat écrit la palette à lui seul |
| `atelier/image/decoupe.py` | **où** couper une planche. CPU, pure : elle reçoit un alpha ou des dimensions, elle rend des rectangles. Ce qu'on en fait appartient au service |
| `atelier/services/decoupe.py` | découper. **Deux gestes séparés exprès** — `proposer` ne crée rien, `decouper` coupe ce qu'on lui donne. C'est cette séparation, et rien d'autre, qui tient « sans jamais bloquer ». Aucun `fournisseur` : une planche déjà là se découpe réseau coupé |
| `atelier/mcp/serveur.py` | les onze outils de l'agent. **Une façade, et rien d'autre** : chaque fonction traduit, appelle un service, retraduit. Le jour où l'une d'elles calcule quelque chose, c'est que le geste manquait aux services. Ça se lit dans les imports — ni `fournisseur`, ni `depot`, ni `sqlite3` —, et un essai le vérifie. Les noms d'outils sont en anglais ; les **raisons de refus** restent en français, parce qu'un agent les répète à l'auteur |
| `atelier/services/agent.py` | le **cadre** de l'agent, pas un geste de plus : le plafond de la séance, le modèle d'exploration imposé, et le dépôt d'un fichier dans le dossier du jeu. Les garde-fous se relisent **à chaque appel** — même règle que la clé —, et la consommation se *lit* sur les générations plutôt que se tenir en double. Aucun `fournisseur` : autoriser une dépense ne demande pas de sortir |
| `atelier/services/export.py` | sortir de l'atelier. **Le seul service qui ne reçoive pas la diffusion** : un export ne change aucun état — rien n'est rangé, rien n'est jugé, rien n'est créé —, donc il n'a rien à annoncer, et ça se lit dans la ligne qui le compose. Aucun `fournisseur` non plus : l'archive se fabrique réseau coupé |
| `atelier/fournisseur/toile.py` | aller chercher une image à une adresse collée. Le second sortant du dépôt, et il traduit toute panne de transport en une phrase du produit |
| `atelier/api/univers.py` | les routes de T4 — le tableau et l'univers. Un troisième routeur parce qu'il répond à une troisième question : ce qui contraint une image **avant** qu'elle existe |
| `atelier/api/production.py` | les routes de C1 — le plan de poses, les personnages, la case qu'une image remplit, et ce qui ne part plus. Un **quatrième** routeur, pour une quatrième question : *ce qu'il reste à fabriquer*. Les poses y sont à trois segments (`/characters/poses/…`), pour la raison de `board/groups/tint` — à deux, l'adresse dépendrait de l'ordre des fonctions dans le fichier |
| `atelier/domaine/projet.py` | deux niveaux de rangement, et pas un de plus. `repere()` fait du nom un dossier lisible — `projets/bac-a-sable/` — pour que `donnees/` s'ouvre aussi à la main |
| `atelier/api/bibliotheque.py` | les routes de T3, montées sous le même préfixe que les autres. Un module à part parce qu'elles répondent à une autre question : `routes.py` dit comment on fabrique une image, celles-ci où elle se range |
| `interface/` | React + Vite + Tailwind. `src/index.css` porte **tous** les tokens de `docs/DESIGN.md` — aucune couleur, aucun rayon, aucune durée n'est écrit ailleurs. **Trois dépendances d'exécution depuis T8** : `react`, `react-dom` et `@xyflow/react`, la seule que l'interface ait gagnée depuis l'origine. Elle tient la surface — le plan, le nœud, le glissement —, le produit tient la matière ; `docs/ARCHITECTURE.md` §6.5 fait la part exacte, et le rester est une décision renouvelée, pas un état de fait |
| `tests/conftest.py` | le double de fournisseur et les trois montages partagés. Il rend de vraies images, de vrais coûts, de vraies dimensions — **aucun test ne coûte un centime** |
| `tests/test_t1_jalon1.py` | les critères de T1 tenus par les jalons 1 et 2 — clé, catalogue, image téléchargeable, variations concurrentes, emplacements indépendants |
| `tests/test_t1_jalon3_4.py` | ceux des jalons 3 et 4 — flux d'événements, jauge déterminée, onglet rouvert, repli hors ligne |
| `interface/src/App.test.tsx` | les essais d'écran — le seul endroit du dépôt où l'interface est **montée et pilotée**. `fetch` et `EventSource` y sont doublés, comme `tests/conftest.py` double le fournisseur. Ils existent parce qu'un défaut a traversé T1 et T2 sans que rien ne le voie : ce que le serveur tient, l'écran ne le tient pas. Cinq des seize critères de T3 n'existent que là |
| `interface/src/composants/Arbre.tsx` | la colonne de 240 px : projets, collections, total, et le journal des ratés sous l'arbre |
| `interface/src/composants/BarreOutils.tsx` | les 38 px au-dessus de la grille — chercher, filtrer, agir sur une sélection, et la fente de l'annulation |
| `interface/src/composants/Decoupe.tsx` | l'écran Découpe — `1fr · 380px`, la planche à gauche, ce qui sortira à droite. Le sujet est l'image, donc c'est elle qui prend la largeur. Il porte sa propre fente de refus, comme l'écran Univers. **Le cadre est mis à l'échelle par calcul** : `aspect-ratio` cède devant `max-height`, et un cadre qui ment décale les rectangles de l'image |
| `interface/src/composants/Univers.tsx` | l'écran Univers — `380px · 1fr`, l'univers à gauche, le tableau à droite. Il couvre l'atelier, donc **il porte sa propre fente de refus** : une raison envoyée derrière lui serait invisible au moment où elle compte |
| `interface/src/composants/Tableau.tsx` | le tableau d'inspiration. Le collage y est le geste principal, et il devine : des octets font une carte image, une adresse une carte en attente, le reste une note. Depuis T8 il porte **une seule grille pour les deux vues** — la réserve n'est pas une grille de plus, c'est celle-ci filtrée sur ce qui n'a encore ni groupe ni place —, et la carte y est un seul composant posé de deux façons |
| `interface/src/composants/Toile.tsx` | la seconde vue du tableau. **Trois fonctions pures en tiennent toute la géométrie** — où une carte se pose, jusqu'où un îlot s'étend, lequel attrape une carte lâchée — et c'est ce qui les rend vérifiables : `Toile.test.tsx` les éprouve sans monter d'écran, là où jsdom ne pourrait rien mesurer. Chaque nœud porte ses **dimensions données** : la librairie cache ce qu'elle n'a pas mesuré, et elle mesure par un `ResizeObserver` |
| `interface/src/aide.ts` | **le corpus des explications — un seul texte, deux rendus.** 62 entrées, cinq écrans. Chacune tient trois champs obligatoires : *ce que c'est · ce que ça change · d'où ça sort*, et la deuxième porte tout le poids — « Rien à la génération. » est une réponse, c'est même la plus utile. Il ne porte **jamais une raison** : ce qui refuse un geste vit dans une fente permanente, et ne se survole pas |
| `interface/src/composants/ChampPrompt.tsx` | le champ de prompt, et **le dépliant de ce qui partira** (R2). Il ne compose rien : le serveur rend le texte et ses parties, par le chemin même que la soumission emprunte — deux compositions écrites à deux endroits finiraient par diverger, et celle qui compte est celle qui part. Repris, le champ change de bord et de police : ce n'est plus un sujet qu'on décrit, c'est un prompt qu'on écrit |
| `interface/src/composants/Infobulle.tsx` | le survol qui révèle et le clic qui épingle. Le **libellé est la cible** — aucun glyphe neuf : le nom du réglage devient sa propre poignée, souligné d'un pointillé `--bord-fort`. Rendre un libellé sans clé n'est pas une erreur : rien ne se marque, et c'est le cas d'un réglage que le corpus ne documente pas |
| `interface/src/composants/Apercu.tsx` | l'aperçu — le pointeur posé sur une image, Espace, et elle emplit l'écran. **Un geste, aucun contrôle** : rien ne paraît sur une tuile pour l'annoncer, sans quoi la planche contact porterait une loupe sur chacune de ses vignettes. Il porte aussi `imageAsset`, **le seul endroit qui nomme l'adresse de l'image d'un asset** — la tuile, la fiche et l'aperçu la lisent tous les trois, et c'est ce qui rend vraie sans machinerie la phrase « l'aperçu est la vignette en grand, et rien d'autre ». Son garde de saisie tient sur *deux* conditions, jamais sur le focus seul : le champ de prompt le prend au démarrage et ne le rend jamais |
| `interface/src/composants/EcranReglages.tsx` | les trois questions promises depuis T1, au même endroit (US-96) : la clé, les garde-fous de l'agent, le dossier du jeu. Un panneau posé sur l'atelier et non un quatrième écran plein — il ne couvre pas le travail, il le règle. Le compteur de l'agent y est **à côté du réglage qu'il fait relever** : lu ailleurs, il faudrait revenir |
| `interface/src/composants/Guide.tsx` | l'écran Guide, la seule prose du produit. Il **ne porte pas de fente de refus**, et c'est la preuve qu'on a compris la règle : il ne demande rien au serveur, ne dépense rien, ne peut pas échouer. Sa troisième partie est le corpus rendu à la file, groupé **par écran** — pas par thème : quand on cherche une explication, on se souvient d'où l'on était |
| `tests/test_t3.py` | les critères de T3 — le Bac à sable, le journal des ratés, la grille unique, la suppression sans cascade, l'annulation, la reconstruction depuis les fichiers, les quatre rôles de réinjection, et le hors ligne. Deux tests **prouvent** le hors ligne en comptant les appels du double avant et après |
| `tests/test_t4.py` | les critères de T4 — la palette extraite de **vraies** planches (`essais/guide/`), la famille qui décide des références, le compte dédoublonné, la palette rétroactive et ses deux comptes, le barème, et le hors ligne. Trois tests **comptent les appels du double** : le tableau et la palette ne demandent jamais le fournisseur |
| `tests/test_t5.py` | les critères de T5 — la planche de huit, la filiation dans les deux sens, les trois issues d'une détection ratée, la suppression sans cascade, la reconstruction, et le hors ligne prouvé en comptant les appels du double. Plus le symétrique du moteur absent : **le moteur par modèle exécuté pour de vrai** quand il est là |
| `tests/test_t6.py` | les critères de T6 — l'archive et son descriptif, les homonymes numérotés, le rendu et non le brut, le JPEG converti, le refus d'une sélection vide, l'image seule qui se télécharge encore, et le hors ligne prouvé en comptant les appels du double. Ils **ouvrent** l'archive au lieu de la mesurer : `zipfile` la relit, `json` relit le descriptif, Pillow rouvre chaque PNG et confronte ses dimensions à celles annoncées. L'export est le seul geste dont personne ne voit le résultat avant de l'ouvrir ailleurs, une semaine plus tard |
| `tests/test_c2.py` | les critères de C2 — le lot d'un seul appel **compté sur les appels du double**, la planche dépliée toute seule, le compte faux qui refuse tout et se relance d'un geste, la feuille qui n'entre pas en bibliothèque, les mesures case par case, la reprise sans repayer, les deux modèles d'appel, et les jeux de réglages. Son double rend une **vraie planche** — fond plat, N sujets séparables, chacun sa silhouette —, qui traverse la même chaîne que les vingt-quatre planches réelles du 28 août : un double écrit d'après l'intention prouve l'intention, pas le serveur |
| `tests/test_r1.py` | les critères de R1 — la réponse du réglage qui porte déjà la valeur écrite, **les cinq réglages annoncés au flux** un par un, l'annonce unique même quand la palette bouge en même temps, le refus qui n'écrit rien, et le hors ligne prouvé en comptant les appels du double. Un helper y accorde la palette **avant** de mesurer : un projet neuf porte une empreinte vide alors que celle d'un univers sans artwork ne l'est pas, donc le tout premier accord annonce quoi qu'on règle — sans ce helper, le fichier passerait sans la correction |
| `tests/test_r2.py` | les critères de R2 — l'aperçu du prompt confronté **à ce que le fournisseur a reçu**, le champ décoché qui disparaît de ce qui part, le texte repris qui part mot pour mot, la relance qui rejoue l'appel et non une recomposition, la migration de cinq champs à sept **relue depuis le disque**, la cible « aucune » mesurée sur les dimensions de l'image, et le hors ligne prouvé en comptant les appels du double. Le seul juge acceptable de l'aperçu y est `double.demandes[-1].prompt` : un aperçu vérifié contre lui-même ne prouverait que lui-même |
| `tests/test_c1.py` | les critères de C1 — le plan d'un projet neuf, le personnage et sa description, la case déduite des assets, la désignation d'un corps, les concept arts, les trois portées du décochage, le coût **mesuré**, et le hors ligne prouvé en comptant les appels du double. Deux essais y gardent une leçon plutôt qu'un geste : *un objet a la même forme sur toutes les routes qui le portent*, comparé sur les **jeux de clés** et sur l'annonce du flux |
| `interface/src/composants/Personnages.tsx` | l'écran Personnages — `380px · 1fr`, les personnages et le plan du jeu à gauche, les cases à droite. **La matrice arme, l'atelier tire** : « Fabriquer » remplit le prompt et rend la main, il n'existe qu'un endroit d'où l'on paie. Ce n'est pas une grille d'assets — ni recherche, ni filtre, ni sélection multiple —, et c'est cette privation qui préserve l'invariant de T3 |
| `tests/test_t9.py` | les critères de T9 — le lien muet à la naissance, la toile lue en un aller-retour, la paire déjà jointe refusée en le disant, le lien qui meurt avec son extrémité **et sur le disque**, la note née posée et classée, le texte corrigé en place, les six teintes seules, et le hors ligne prouvé en comptant les appels du double. Trois des neuf critères n'y sont pas : deux sont de la géométrie ou de la couleur, le troisième est une pile qui n'existe que dans l'onglet |
| `tests/test_t8.py` | les critères de T8 — la place et la largeur libre écrites par la route du groupe, le vide qui efface là où l'absence ne touche pas, la toile relue du disque après l'index effacé, la largeur libre qui ne touche jamais au cran de vignette et réciproquement, et le hors ligne prouvé en comptant les appels du double. Six des treize critères n'y sont pas : ils portent sur ce que l'écran montre ou sur une géométrie que le serveur ne connaît pas |
| `interface/src/composants/Toile.test.tsx` | la géométrie de la toile, **sans monter d'écran**. Il existe parce que jsdom ne met rien en page : un essai qui tirerait une carte à travers le plan classerait toujours dans le même îlot, celui de la boîte vide qui contient l'origine. Les fonctions sont pures pour cette raison-là |
| `tests/test_t7.py` | les critères de T7 — les outils appelés **par le serveur**, `call_tool` comme un vrai client, parce qu'appeler les fonctions Python sauterait la validation de schéma et ne prouverait rien du contrat. Plus la vraie poignée de main MCP sur les deux écritures de l'adresse, et deux tests qui **comptent les appels du double** : importer, retoucher, découper et exporter ne demandent jamais le fournisseur |
| `tests/test_t2.py` | les critères de T2 — grille cible, même bloc de pixel, brut conservé, rendu recalculable, recette nommée, quantification grisée, passes de détourage. Plusieurs **comptent les appels du double** avant et après une retouche : c'est ainsi que « le post-traitement n'appelle jamais le fournisseur » se prouve |
| `essais/essai_couverture.py` | la couverture image du fournisseur, et sa dérive depuis le relevé précédent. Gratuit |
| `essais/essai_detourage_modele.py` | les deux moteurs de détourage, l'un contre l'autre. Gratuit. Sortie : `essais/mesures_detourage.json` et `essais/planches/detourage_moteurs.png`. Le cas « fond chargé » y est **composé**, et le banc le dit : aucune des 188 images du dépôt n'a de fond qui résiste au remplissage depuis le bord |
| `essais/essai_pixel.py` | le banc du post-traitement — brut contre traité, sur les 44 images des bancs déjà sur le disque. Gratuit. Sortie : `essais/mesures_pixel.json` et `essais/planches/pixel_64.png` |
| `essais/essai_export.py` | l'archive de T6, **ouverte** — sur ce que l'atelier contient vraiment, pas sur des images fabriquées. Gratuit, mais il demande un atelier lancé : il passe par la route. Chaque fiche du descriptif est confrontée à son fichier, dimensions remesurées par Pillow. Sortie : `essais/mesures_export.json` |
| `essais/essai_premiere_image.py` | la première image, de bout en bout par l'API. **Payant**, ne part qu'à la main |
| `essais/essai_univers_chaine.py` | la chaîne de T4 : bible repliée, artworks choisis par famille, asset né habillé, barème mesuré. **Payant**, un seul appel — le barème se vérifie en appliquant six échelles à la même image reçue. Travaille dans son propre `donnees/`, et ne range dans celui de l'atelier que sur `--ranger` |
| `essais/essai_decoupe_planche.py` | la chaîne de T5 : une planche **demandée exprès** à un modèle, puis détectée, découpée, filiée. **Payant**, un seul appel — tout le reste est gratuit, et c'est ce que la tranche promet. Même règle de `donnees/` séparé et de `--ranger`. C'est le seul essai qui vérifie ce qu'aucune image fabriquée ne peut vérifier : une planche **que personne n'a disposée pour la détection** |
| `donnees/` | l'index SQLite (**jetable**), `agent.json` le cadre de l'agent — un fichier à part de l'état parce qu'il se relit à chaque appel du MCP —, `atelier.json` le projet courant, la photo du catalogue, les recettes nommées, `collections.json`, `projets/<repère>/projet.json` — l'univers —, `projets/<repère>/tableau/<carte>.json` et ses octets à côté, et par génération : `generation.json`, `<rang>-brut.<ext>` l'image telle qu'elle est arrivée, `<rang>-asset.json` la recette, le rangement et les mesures, `<rang>-rendu.png` **un cache, effaçable sans rien perdre**. Les découpes de T5 y tiennent les rangs 100 et suivants, dans le dossier de la génération de leur planche. Hors Git. **Les cartes n'entrent jamais dans l'index** — elles n'ont aucune question à lui poser, et effacer `atelier.sqlite3` ne peut donc pas les perdre |
| `docs/ARCHITECTURE.md` | décisions techniques, squelette, fournisseur et modèles, modèle d'objets, contrat de génération, MCP, V1→V5, risques |
| `docs/PRD.md` | ce que le produit doit faire, à l'usage — 97 user stories, états vides, erreurs, cas limites |
| `docs/PLAN.md` | l'ordre de construction — les sept tranches, leurs user stories, leurs dépendances et leurs critères d'acceptation |
| `docs/DESIGN.md` + `docs/design-preview.html` | l'apparence — typographie, palette, densité, mouvement, et le spécimen qui les montre |
| `docs/maquette-atelier.html` | **brouillon écarté** — jugé trop chargé et trop loin de la fluidité recherchée. Reste sur disque, ne sert pas de base. L'interface part du geste quotidien : écrire, générer, juger, garder. |
| `essais/essai_identite.py` | banc de modèles — quatre appels enchaînés, deux jets, parallèle |
| `essais/resultats/jet<N>/<config>/` | images produites + `mesures.json` (coût et durée réels) |
| `essais/planches/` | planches contact assemblées, pour comparer d'un coup d'œil |
| `essais/catalogue.json`, `prix.json` | relevé OpenRouter du 26 août 2026 |
| `screen_spritecook/` | 30 captures de SpriteCook — la référence d'ergonomie, écran par écran |
| `Anatomie de SpriteCook.html` | l'analyse fonctionnelle qui a servi de point de départ |

## Les projets voisins — les lire avant de réinventer

Deux tentatives précédentes vivent à côté. Elles ne sont pas des impasses : elles portent du
savoir payé au prix fort.

- **`../MySpriteAi`** — pipeline pixel complet en TypeScript, détourage BiRefNet, module SFX,
  gestionnaire de VRAM. `src/lib/pixelPipeline.ts` est à porter en Python : les décisions
  dedans ont été acquises par la douleur (durcir l'alpha à 128 **avant** la réduction, sinon
  liseré clair autour du sprite). Son `AGENTS.md` est un inventaire de pièges vérifiés.
- **`../game-asset-generator`** (GAG) — architecture hexagonale Python, 29 décisions.
  `gag/domaine/direction.py` et `gag/ports/vision.py` portent la dérivation de direction
  artistique : c'est le cœur de l'univers d'Asset Kitchen, déjà écrit.

**GAG n'est pas l'ancêtre d'Asset Kitchen, c'est son opposé** : GAG fabrique de la quantité
en lot avec des modèles locaux, Asset Kitchen fabrique peu et bien, à la main, par API. Les
deux vivent côte à côte.

## Règles durables

Écrites ici une fois pour toutes. Elles n'ont jamais à être répétées dans un prompt.

- **Français partout, sauf ce qu'un tiers lit.** Les noms d'outils MCP sont en anglais (ils
  sont lus par des modèles entraînés en anglais ; `generer_asset` dégraderait le
  déclenchement) et les chemins de routes HTTP par convention. Domaine, services, traitement
  d'image, colonnes SQL, interface : en français.
- **Le catalogue décide, jamais une liste en dur.** `GET /api/v1/images/models` donne les
  plafonds de références, les résolutions et les paramètres de chaque modèle. Un modèle qui
  ne peut pas honorer la demande est **grisé avec sa raison**, jamais proposé puis rejeté en 400.
- **Le traitement est non destructif.** On garde l'image brute et la recette. Le rendu est un
  cache effaçable. Recalculer coûte des millisecondes ; regénérer coûte de l'argent et ne rend
  jamais la même image.
- **Le post-traitement ne touche jamais le GPU, et n'appelle jamais le fournisseur.** CPU,
  pur, étapes dans un ordre fixe : détourage, recadrage, grille, quantification, bords.
  Aucune ne se réordonne — trois des cinq n'ont pas de sens avant celle qui les précède.
- **Chaque étape est déterministe, et c'est un critère.** « Une recette nommée, réappliquée
  ailleurs, donne exactement le même résultat » : une initialisation tirée au sort — le
  k-means++ de MySpriteAi, par exemple — rendrait deux images différentes pour la même
  recette. La coupe médiane de Pillow ne tire rien au sort ; c'est elle qui quantifie.
- **Pas de ComfyUI dans l'application.** Le local reste dehors : on génère ailleurs, on importe.
- **Aucune clé en dur.** `.env` seul, jamais versionné ; `.env.example` documente les noms.

## Pièges connus → `docs/PIEGES.md`

Quatre-vingt-deux pièges payés une fois chacun — encodage Windows, lots payants,
`ResizeObserver`, onglet d'arrière-plan, SQLite, montages FastAPI et Starlette, transport
MCP, mise en page CSS — vivent dans **`docs/PIEGES.md`**, que le code cite là où chacun mord.

**Se lit à la demande, jamais au démarrage** : on y cherche avant d'attaquer un terrain déjà
miné, et on y ajoute en bas dès qu'un piège a coûté quelque chose. Un piège s'écrit avec ce
qui l'avait rendu invisible, jamais seulement avec sa correction.

## Règle systématique : comment finir une étape

Toute fin d'étape se rend en **trois temps, dans cet ordre**. Systématiquement, sans qu'on
ait à le redemander.

1. **Les questions ouvertes sont posées de façon cliquable**, jamais en prose. La réponse
   recommandée passe en premier et le dit.
2. **Les actions à faire et les informations importantes sont mises en exergue** — titrées,
   isolées, écrites pour quelqu'un qui ne connaît pas le projet. Une action noyée dans un
   paragraphe technique ne se fait pas.
3. **Le prompt de reprise vient en dernier**, dans un bloc à copier.

**Le prompt de reprise fait trois lignes** : la tâche du jour, l'état en une phrase, et
« lis `AGENTS.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/PLAN.md` et
`docs/DESIGN.md` ». **Ces cinq-là nommés, et rien de plus** — jamais « les documents de
`docs/` », qui n'a pas de plafond et fait avaler au démarrage un dossier d'un méga-octet.
Ne jamais y recopier le contexte du dépôt, les règles ci-dessus, l'état Git ni la liste du
reste à faire : tout cela vit déjà dans les fichiers, et la nouvelle session les lit seule.
