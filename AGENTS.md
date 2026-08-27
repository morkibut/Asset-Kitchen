# Asset Kitchen

Atelier personnel de production d'assets 2D pour jeu. On y définit **l'univers** d'un jeu
une fois, puis on fabrique au cas par cas les personnages, objets, décors et interfaces qui
lui appartiennent. **Tout ce qui est produit entre en bibliothèque de lui-même** ; juger,
c'est marquer favori ou supprimer, et ce qui est jugé l'est avant de partir dans le jeu, pas
avant d'entrer dans la bibliothèque. Un serveur MCP expose les mêmes gestes à un agent qui
code le jeu.

Ce fichier-ci ne dit que **comment travailler dans ce dépôt**. Ce qu'il faut construire vit
dans `docs/`, réparti selon la règle d'autorité ci-dessous.

## État au 27 août 2026

La chaîne de cadrage est finie — PRD, architecture, design, plan — et **le code a
commencé**. `docs/PLAN.md` fait foi sur ce qui reste.

**T1, T2, T3, T4 et T5 sont finies.** T1 : le squelette, la clé, le catalogue relu au
démarrage, un appel qui rend une image téléchargeable ; l'écran Atelier ; le flux
d'événements qui remplace le sondage, la jauge déterminée, la reprise vue du navigateur et
le repli hors ligne. T2 : l'asset, la recette, le rendu-cache, le détourage en plusieurs
passes, la remise sur grille, la quantification grisée, les recettes nommées, et la fiche.
T3 : la bibliothèque — projets et collections, une seule grille filtrable et cherchable, la
sélection multiple, le favori, la suppression avec son annulation courte, la filiation, le
journal des appels ratés, la réinjection dans ses quatre rôles, et l'index reconstructible.
T4 : le tableau d'inspiration et l'univers — coller une image, une adresse ou un texte,
promouvoir en artwork officiel par famille, la palette extraite par calcul, la bible en
champs nommés, le barème d'échelles, la taille de pixel imposée, la quantification allumée,
et la palette rétroactive. T5 : le slicer — les zones opaques connexes, la grille fixe, les
rectangles dessinés à la main, la filiation de découpe ; **plus les deux dettes reportées**,
le zoom de la grille et la première exécution du second moteur de détourage. **Les
soixante-six critères d'acceptation de T1 à T5 sont cochés dans `docs/PLAN.md`, et 108 tests
de serveur plus 17 d'écran les tiennent. La prochaine tranche est T6, l'export.**

**Le produit a été utilisé pour de vrai à chaque fin de tranche, et c'est ce qui a trouvé
tous les défauts.** T1 : l'écran doublait chaque génération lancée depuis l'onglet. T3 :
cinq de plus, dont deux venaient de la même racine — deux vérités sur la même chose
finissent par diverger. T4 : deux, dont un compte de références qui ne se remettait pas à
jour quand on promouvait un artwork. T5 : trois, tous de mise en page, dont deux de la même
famille — **une règle déléguée au navigateur dont personne n'a mesuré le résultat**.
**Aucun test de serveur ne pouvait les voir**, et les tableaux de `docs/PLAN.md` § T3, § T4
et § T5 disent pour chacun ce qui l'avait rendu invisible. C'est désormais une règle du
dépôt : **une tranche n'est finie que lorsqu'on s'en est servi.**

**Une planche se découpe, et chaque morceau est un asset entier.** Le serveur *propose* des
rectangles — zones opaques connexes, ou grille fixe —, l'auteur corrige, et ce qui part à la
découpe est **sa** liste. Chaque découpe possède ses propres octets bruts, hérite de la
recette de sa planche et pointe vers elle par sa filiation. Elle possède ses octets pour une
raison précise, et ça se paie en disque : **supprimer la planche doit laisser ses découpes
en place**, or la suppression définitive efface `<rang>-*`, brut compris.

**L'écran tient ses quatre colonnes.** `docs/DESIGN.md` § Layout donne
`240px · 300px · 1fr · 380px` — arbre · réglages · prompt+grille · fiche. Les trois
premières sont permanentes et repliables **par choix** ; la quatrième s'ouvre avec la
sélection d'une image et se referme sur la position, le filtre et le prompt d'avant.

**La grille est faite d'assets, et le chantier y tient sa place.** Un emplacement qui n'a
pas encore donné son asset occupe la case sous **la même clé** — `<génération>-<rang>`,
l'identifiant que l'asset portera —, si bien que l'image ne se glisse pas à côté de son
attente : elle la remplace. Un échec occupe sa place tant qu'on le regarde, mais il ne
s'installe pas : la bibliothèque relue ne le contient pas, et le journal du projet garde
l'appel avec son coût réel.

**La palette se lit sur le sujet, jamais sur le fond.** La coupe médiane appliquée aux
artworks tels quels rend vingt gris sur vingt-quatre : le fond plat occupe 75 % des pixels
et son anti-crénelage l'éclate en autant de seaux. `atelier/image/palette.py` détoure donc
d'abord, avec le moteur du geste courant, et la palette passe à quinze couleurs franchement
distinctes. *Ce qui est majoritaire n'est pas ce qui compte* — la même phrase que pour le
détourage au seuil global.

**L'univers est porté par le projet, et il contraint.** Bible en cinq champs nommés,
chacun activable ; barème d'échelles, où une nature de sujet porte **sa famille et son
occupation à la fois** — c'est ce qui garde un seul contrôle au moment de générer ; taille
de pixel imposée à tout ce qui rentre ; modèle par défaut **par famille** ; et la palette,
qui est un cache nommé par l'empreinte des artworks qui l'ont produite. Un univers vide ne
contraint rien : c'est un état, pas une configuration manquante.

**Deux risques ont été levés, aucun n'a coûté un centime.** « La couverture image
d'OpenRouter » (`essais/essai_couverture.py`) : 48 modèles image, 11 fournisseurs, 31
acceptent assez de références pour un univers. « La qualité pixel art directe »
(`essais/essai_pixel.py`) : sur 44 images de six modèles, **aucune sortie brute n'a de
transparence**, la médiane est à 33 986 couleurs, et la grille rendue va de 7 à 20 px —
facteur 2 à l'intérieur d'un même lot. Après traitement : 27 couleurs, alpha franc, grille
imposée, 0 sujet perdu sur 44, 0,17 s par image. **La question s'est retournée** : le
post-traitement n'est pas un supplément qui doit prouver son apport, c'est ce sans quoi
rien n'est utilisable.

**Le détourage par défaut n'a besoin d'aucun modèle.** Un remplissage depuis le bord — un
pixel n'est du fond que s'il est *relié au bord* par une chaîne de pixels proches de la
couleur de bordure — rend une silhouette propre sur les 44 images, squelette blanc sur fond
gris clair et fioles translucides compris. `rembg` reste un **second** moteur, facultatif
(`uv pip install -e ".[detourage]"`), grisé avec sa raison quand il n'est pas là. Le geste
courant ne charge rien, ne télécharge rien, et marche hors ligne.

**Ce chemin-là a été exécuté le 27 août 2026, et il a retourné une décision.**
`essais/essai_detourage_modele.py` compare les deux moteurs sur six vraies images plus un
cas composé. Sur ce que le produit fabrique — fond plat —, les deux **s'accordent à 96,3 %**
en médiane : le second n'apporte rien, et c'est ce qui justifie qu'il reste facultatif. Sur
un fond chargé, le bord garde **100 %** de l'image — il échoue entièrement — quand le modèle
en isole 19,8 % : c'est sa raison d'être, et elle se mesure. Il coûte 482 ms contre 147.
**Le modèle est nommé, jamais laissé au défaut de la bibliothèque** : le défaut de `rembg`
2.0.81 est `bria-rmbg`, un gigaoctet qui met 15,8 s par image de 1024 px sur processeur,
là où `u2net` met 0,47 s pour deux points d'écart. Le « ~180 Mo » écrit ici depuis T2 était
la taille d'`u2net`, et le défaut avait changé sous cette note.

**Deux choses ont rendu l'exécution possible, et elles se disent.** `raison_moteur` cherche
désormais le paquet avec `find_spec` au lieu de l'importer : demander « faut-il griser ce
bouton ? » ne charge plus `onnxruntime`, et `tests/test_t2.py` — qui vérifie qu'aucune
bibliothèque d'inférence n'entre dans `sys.modules` pendant une retouche — tient sur une
machine où le second moteur est installé. Et le test qui le concerne a désormais un
symétrique : l'un vaut quand le moteur manque, l'autre quand il est là, et il y en a
toujours exactement un des deux qui travaille.

**L'interface ne redemande plus rien, et elle se branche une seule fois.** Un abonnement
par onglet, pour toute sa vie : ni le filtre, ni le projet ouvert, ni les proportions, ni
l'écran Univers ne le font se rebrancher. Les seuls appels qu'elle refait d'elle-même sont
le catalogue — parce que le grisé de chaque modèle dépend de la demande en cours —, la
grille quand un filtre change, et le tableau quand le projet ouvert change, parce que c'est
le serveur qui filtre et que le tableau appartient à son projet.

**Et « la demande en cours » a grandi en T4** : elle porte désormais les artworks que
l'application ajoute seule. Promouvoir une carte change donc ce qui partira sans que
l'écran ait touché un réglage — d'où le catalogue redemandé sur l'événement `univers`.
C'est le défaut trouvé en ouvrant l'atelier le 27 août : **une règle juste dont l'hypothèse
a changé sous elle**.

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
py essais/essai_premiere_image.py    UN APPEL PAYANT, ~$0,006
py essais/essai_univers_chaine.py    UN APPEL PAYANT, ~$0,023 — la chaîne de T4 de bout en bout
```

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
| À quoi ça ressemble ? | `docs/DESIGN.md` + `docs/design-preview.html` | `/design` |
| Comment travaille-t-on ici ? | `AGENTS.md` | à la main |

En cas de contradiction entre deux documents, **celui dont c'est la question l'emporte**, et
l'autre est corrigé dans la foulée — jamais laissé en l'état.

## Les skills et leurs frontières

Chaque skill possède **un livrable et un seul**. Un skill qui écrit hors de sa colonne
produit de la duplication, et la duplication devient contradiction.

| Skill | Écrit | S'arrête à |
|---|---|---|
| `/interroge` | **rien** | dialogue de cadrage. Ce qui en sort est reporté à la main dans le bon document. |
| `/cadre` | `docs/PRD.md` | l'usage. Ni techno nommée, ni chemin de fichier, ni code. Test : si l'utilisateur ne peut pas observer la différence, c'est hors PRD. |
| `/planifie` | `docs/PLAN.md` | l'ordre. Pas de noms de fichiers ni de fonctions — ils changeront. |
| `/design` | `docs/DESIGN.md`, `docs/design-preview.html` | l'apparence. Aucune décision de comportement produit. |
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
| `atelier/services/univers.py` | le tableau et l'univers — coller, promouvoir, extraire la palette, réaligner. **Le seul service qui sorte sans être une génération**, et par une seule méthode : `recuperer`, l'adresse collée. Tout le reste marche réseau coupé |
| `atelier/domaine/carte.py` | la deuxième famille d'images du produit. Elle ne s'exporte jamais, ne compte pas dans la bibliothèque, n'a ni recette ni rendu. Elle appartient à son projet, et part avec lui |
| `atelier/domaine/projet.py` (§ Univers) | la bible en cinq champs nommés, le barème d'échelles — une nature de sujet porte **sa famille et son occupation à la fois** —, la cible de pixel, les modèles par famille, et `recette_de()`, **le seul endroit qui dise ce qu'un projet impose** |
| `atelier/image/palette.py` | d'où vient la palette d'un univers. CPU, pure, aucune entrée-sortie. Détoure d'abord — sans quoi le fond plat écrit la palette à lui seul |
| `atelier/image/decoupe.py` | **où** couper une planche. CPU, pure : elle reçoit un alpha ou des dimensions, elle rend des rectangles. Ce qu'on en fait appartient au service |
| `atelier/services/decoupe.py` | découper. **Deux gestes séparés exprès** — `proposer` ne crée rien, `decouper` coupe ce qu'on lui donne. C'est cette séparation, et rien d'autre, qui tient « sans jamais bloquer ». Aucun `fournisseur` : une planche déjà là se découpe réseau coupé |
| `atelier/fournisseur/toile.py` | aller chercher une image à une adresse collée. Le second sortant du dépôt, et il traduit toute panne de transport en une phrase du produit |
| `atelier/api/univers.py` | les routes de T4 — le tableau et l'univers. Un troisième routeur parce qu'il répond à une troisième question : ce qui contraint une image **avant** qu'elle existe |
| `atelier/domaine/projet.py` | deux niveaux de rangement, et pas un de plus. `repere()` fait du nom un dossier lisible — `projets/bac-a-sable/` — pour que `donnees/` s'ouvre aussi à la main |
| `atelier/api/bibliotheque.py` | les routes de T3, montées sous le même préfixe que les autres. Un module à part parce qu'elles répondent à une autre question : `routes.py` dit comment on fabrique une image, celles-ci où elle se range |
| `interface/` | React + Vite + Tailwind. `src/index.css` porte **tous** les tokens de `docs/DESIGN.md` — aucune couleur, aucun rayon, aucune durée n'est écrit ailleurs |
| `tests/conftest.py` | le double de fournisseur et les trois montages partagés. Il rend de vraies images, de vrais coûts, de vraies dimensions — **aucun test ne coûte un centime** |
| `tests/test_t1_jalon1.py` | les critères de T1 tenus par les jalons 1 et 2 — clé, catalogue, image téléchargeable, variations concurrentes, emplacements indépendants |
| `tests/test_t1_jalon3_4.py` | ceux des jalons 3 et 4 — flux d'événements, jauge déterminée, onglet rouvert, repli hors ligne |
| `interface/src/App.test.tsx` | les essais d'écran — le seul endroit du dépôt où l'interface est **montée et pilotée**. `fetch` et `EventSource` y sont doublés, comme `tests/conftest.py` double le fournisseur. Ils existent parce qu'un défaut a traversé T1 et T2 sans que rien ne le voie : ce que le serveur tient, l'écran ne le tient pas. Cinq des seize critères de T3 n'existent que là |
| `interface/src/composants/Arbre.tsx` | la colonne de 240 px : projets, collections, total, et le journal des ratés sous l'arbre |
| `interface/src/composants/BarreOutils.tsx` | les 38 px au-dessus de la grille — chercher, filtrer, agir sur une sélection, et la fente de l'annulation |
| `interface/src/composants/Decoupe.tsx` | l'écran Découpe — `1fr · 380px`, la planche à gauche, ce qui sortira à droite. Le sujet est l'image, donc c'est elle qui prend la largeur. Il porte sa propre fente de refus, comme l'écran Univers. **Le cadre est mis à l'échelle par calcul** : `aspect-ratio` cède devant `max-height`, et un cadre qui ment décale les rectangles de l'image |
| `interface/src/composants/Univers.tsx` | l'écran Univers — `380px · 1fr`, l'univers à gauche, le tableau à droite. Il couvre l'atelier, donc **il porte sa propre fente de refus** : une raison envoyée derrière lui serait invisible au moment où elle compte |
| `interface/src/composants/Tableau.tsx` | le tableau d'inspiration. Le collage y est le geste principal, et il devine : des octets font une carte image, une adresse une carte en attente, le reste une note |
| `tests/test_t3.py` | les critères de T3 — le Bac à sable, le journal des ratés, la grille unique, la suppression sans cascade, l'annulation, la reconstruction depuis les fichiers, les quatre rôles de réinjection, et le hors ligne. Deux tests **prouvent** le hors ligne en comptant les appels du double avant et après |
| `tests/test_t4.py` | les critères de T4 — la palette extraite de **vraies** planches (`essais/guide/`), la famille qui décide des références, le compte dédoublonné, la palette rétroactive et ses deux comptes, le barème, et le hors ligne. Trois tests **comptent les appels du double** : le tableau et la palette ne demandent jamais le fournisseur |
| `tests/test_t5.py` | les critères de T5 — la planche de huit, la filiation dans les deux sens, les trois issues d'une détection ratée, la suppression sans cascade, la reconstruction, et le hors ligne prouvé en comptant les appels du double. Plus le symétrique du moteur absent : **le moteur par modèle exécuté pour de vrai** quand il est là |
| `tests/test_t2.py` | les critères de T2 — grille cible, même bloc de pixel, brut conservé, rendu recalculable, recette nommée, quantification grisée, passes de détourage. Plusieurs **comptent les appels du double** avant et après une retouche : c'est ainsi que « le post-traitement n'appelle jamais le fournisseur » se prouve |
| `essais/essai_couverture.py` | la couverture image du fournisseur, et sa dérive depuis le relevé précédent. Gratuit |
| `essais/essai_detourage_modele.py` | les deux moteurs de détourage, l'un contre l'autre. Gratuit. Sortie : `essais/mesures_detourage.json` et `essais/planches/detourage_moteurs.png`. Le cas « fond chargé » y est **composé**, et le banc le dit : aucune des 188 images du dépôt n'a de fond qui résiste au remplissage depuis le bord |
| `essais/essai_pixel.py` | le banc du post-traitement — brut contre traité, sur les 44 images des bancs déjà sur le disque. Gratuit. Sortie : `essais/mesures_pixel.json` et `essais/planches/pixel_64.png` |
| `essais/essai_premiere_image.py` | la première image, de bout en bout par l'API. **Payant**, ne part qu'à la main |
| `essais/essai_univers_chaine.py` | la chaîne de T4 : bible repliée, artworks choisis par famille, asset né habillé, barème mesuré. **Payant**, un seul appel — le barème se vérifie en appliquant six échelles à la même image reçue. Travaille dans son propre `donnees/`, et ne range dans celui de l'atelier que sur `--ranger` |
| `donnees/` | l'index SQLite (**jetable**), `atelier.json` le projet courant, la photo du catalogue, les recettes nommées, `collections.json`, `projets/<repère>/projet.json` — l'univers —, `projets/<repère>/tableau/<carte>.json` et ses octets à côté, et par génération : `generation.json`, `<rang>-brut.<ext>` l'image telle qu'elle est arrivée, `<rang>-asset.json` la recette, le rangement et les mesures, `<rang>-rendu.png` **un cache, effaçable sans rien perdre**. Les découpes de T5 y tiennent les rangs 100 et suivants, dans le dossier de la génération de leur planche. Hors Git. **Les cartes n'entrent jamais dans l'index** — elles n'ont aucune question à lui poser, et effacer `atelier.sqlite3` ne peut donc pas les perdre |
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

## Pièges connus

- **`.env` en UTF-16.** PowerShell écrit en UTF-16 avec `>` et `Out-File`. Le lire comme de
  l'UTF-8 lève sur le tout premier octet. `lire_cle()` essaie plusieurs encodages — toute
  autre lecture de fichier écrit au terminal Windows doit faire pareil.
- **Toujours reconfigurer `sys.stdout` en UTF-8 dans un script à sortie longue.** Dès que la
  sortie est redirigée, Windows encode en cp1252 : un simple `──` lève un
  `UnicodeEncodeError`. Levée depuis un thread d'un `ThreadPoolExecutor`, elle remonte par
  `pool.map` et **tue tout le lot**. Constaté le 26 août : le jet 2 du banc s'est arrêté à 4
  configurations sur 12, après avoir payé les appels. Trois lignes en tête de `main()`
  l'évitent — jamais « on verra si ça pose problème ».
- **Un lot payant doit écrire ses résultats au fur et à mesure, jamais à la fin.** C'est ce
  qui a sauvé les 4 configurations déjà faites au moment du plantage ci-dessus : les PNG et
  le `mesures.json` étaient déjà sur le disque, et la reprise n'a rien repayé.
- **Ne jamais générer petit.** 512 px coûte $0,045 contre $0,067 en 1K chez Nano Banana 2 —
  un tiers de moins pour beaucoup moins de qualité. On génère en 1K et on réduit après.
- **Imposer `aspect_ratio`.** Sans lui, Gemini part en 16:9 et Seedream en 1:1. Deux essais ne
  sont plus comparables, et un sprite n'est plus cadrable.
- **Écrire « one single sprite, one pose only ».** Sans quoi Gemini rend spontanément une
  planche de trois poses — il calque la mise en page de son image de référence.
- **L'échelle du sujet dérive d'une génération à l'autre**, malgré tous les « same size » du
  prompt. Le recadrage et la normalisation d'échelle ne sont pas du confort : sans eux, deux
  frames ne se montent pas.
- **Aucun modèle ne déclare de prompt négatif.** Relevé sur les 48 modèles image du
  catalogue : zéro `negative_prompt`. Le champ existe dans le produit (US-6) ; c'est
  l'adaptateur qui le replie en fin de prompt (`Do not include: …`). Ne jamais l'envoyer
  comme un paramètre : il serait ignoré en silence, comme `output_format` chez Seedream.
- **Le catalogue bouge d'un jour à l'autre.** 47 modèles le 26 août, 48 le 27 —
  `meta/muse-image` est apparu entre les deux. C'est précisément ce qu'une liste écrite en
  dur ne verrait pas.
- **Le coût d'un appel dépend du nombre de références, chez ceux qui facturent au token.**
  Mesuré sur `gpt-image-2` en `quality: low` : $0,0064 sans référence, $0,0124 avec une,
  $0,0245 avec deux. Un univers riche renchérit chaque appel — à surveiller dès T4.
- **Un seul échantillon ne mesure rien.** Un modèle génératif n'est pas déterministe : tout
  banc se fait en deux jets au minimum, et l'écart entre eux compte autant que la moyenne.
- **Un générateur asynchrone ne se referme pas pendant qu'il attend.** Un abonnement écrit
  en `async def … yield` lève `aclose(): asynchronous generator is already running` dès que
  l'appelant le referme alors que l'attente en cours n'est pas finie — et un flux
  d'événements est *toujours* en attente. Constaté le 27 août sur `GET /api/events`. Un
  abonné reçoit donc une **file** (`asyncio.Queue`) : l'appelant décide comment il attend,
  et annuler cette attente n'abîme rien.
- **`TestClient` et `httpx.ASGITransport` attendent la fin de la réponse.** Ils ne
  conviennent pas à un flux qui n'en a pas : le test se fige jusqu'au délai du lot entier.
  On appelle l'application ASGI directement, on lit les premiers messages, et on envoie
  `http.disconnect` — ce qui vérifie du même coup que le serveur s'en remet.
- **Durcir l'alpha AVANT la réduction, jamais après.** Repris de
  `MySpriteAi/src/lib/pixelPipeline.ts`, où ça a été payé cher. Un contour à demi transparent
  est tranché à pile ou face par un rééchantillonnage au plus proche voisin : deux passes de
  suite rendent deux silhouettes différentes. Et la quantification force l'alpha à 255 sans
  toucher à la couleur, donc un pixel de contour à peine visible ressort **opaque, de la
  couleur du fond** — le liseré clair autour du sprite. Les deux moitiés du même piège.
- **Un détourage au seuil global perce le sujet ; un remplissage depuis le bord ne le perce
  pas.** La différence tient en un mot : *relié*. Un pixel de la couleur du fond qui n'est
  relié à aucun bord — l'os d'un squelette, le reflet d'une fiole — n'est pas du fond.
  Corollaire assumé : **une région fermée reste opaque**. L'intérieur d'un cadre d'interface
  survit au détourage, et c'est la même règle qui sauve le squelette. Le rendre transparent
  est un geste de l'auteur, jamais une décision de l'outil.
- **Une mesure de périodicité par « meilleure phase » ment à grand pas.** Écrite pour mesurer
  la grille rendue, elle a répondu 40 à 64 px sur tout le corpus — c'est-à-dire le haut de sa
  propre plage de recherche, ce qui aurait dû alerter tout de suite. La cause : à grand pas, la
  phase retenue porte peu d'échantillons, donc son maximum est mécaniquement flatté.
  L'autocorrélation, elle, tombe juste sur les sujets fins — mais **prend une harmonique sur
  les plus grossiers**. Elle situe un ordre de grandeur, elle ne remplace pas l'œil : aucun
  chiffre de dérive publié ne doit venir d'elle seule.
- **Deux chemins amènent le même objet à l'écran, et ils se croisent.** La réponse du
  `POST` et l'annonce du flux portent la même génération ; le serveur publie **avant** que
  le POST ne soit revenu. Insérer sans regarder d'un côté et fondre de l'autre a doublé
  chaque génération lancée depuis l'onglet — et une clé React doublée laisse des tuiles
  orphelines qu'aucun rendu ne retire ensuite. Le défaut ne survivait à aucun
  rechargement, puisque le message d'état remplace la liste par celle du serveur : il a
  donc traversé T1 et T2 sans se voir. **Tout ce qui arrive par deux chemins se fond par
  identifiant, jamais ne s'empile.** Constaté le 27 août 2026, à la première séance faite
  au navigateur.
- **Un test qui ne rejoue pas l'ordre du serveur ne prouve rien.** Le double du flux dans
  `interface/src/App.test.tsx` publie **avant** que le POST ne réponde, parce que c'est ce
  que fait le vrai serveur — il enregistre, il annonce, puis il rend la main. Avec l'ordre
  inverse, le même test passe sur le code fautif. Vérifié en réintroduisant le défaut : le
  test tombe sur « 4 tuiles au lieu de 2 ».
- **Le message d'erreur d'`httpx` est en anglais, et il finit à l'écran.** « All connection
  attempts failed » est ressorti tel quel dans la barre d'état. Toute erreur de
  transport se traduit en une phrase du produit avant de quitter `fournisseur/` ; un message
  de bibliothèque ne franchit jamais le port.

- **`with sqlite3.connect(...)` ne ferme pas la connexion**, il ne fait que valider la
  transaction. Rendre la connexion telle quelle laissait un descripteur ouvert par
  requête — et sous Windows un fichier encore ouvert **ne se supprime pas**. C'est
  exactement le geste que T3 doit permettre : effacer `atelier.sqlite3` pour voir la
  bibliothèque se reconstruire. Une connexion s'ouvre et se referme, toujours.
- **Une colonne qui double l'objet doit être réécrite depuis lui, sans exception.**
  `cree_le` manquait à la liste des colonnes mises à jour : la date changeait dans
  `contenu` et pas dans la colonne, donc l'objet disait une chose et l'ordre de la
  grille en disait une autre. Le fichier interdit les « deux vérités » dans sa première
  phrase, et c'est une colonne oubliée qui les a créées.
- **Un état dérivable ne se garde pas en double.** La fiche ouverte et la sélection
  étaient deux états pour la même chose : deux clics dans le même rendu lisaient la même
  sélection périmée, et le second effaçait le premier au lieu de s'y ajouter. La fiche
  **est** la sélection quand elle vaut un. Corollaire, dans React : toute mise à jour qui
  lit l'état précédent passe par la forme fonctionnelle, jamais par la valeur du rendu.
- **Un abonnement au flux ne doit dépendre de rien.** Mettre le filtre ou le projet ouvert
  dans les dépendances de l'effet ferme la liaison et en rouvre une à chaque changement —
  donc à chaque frappe dans le champ de recherche —, et le serveur renvoie l'état complet à
  chaque fois. Ce qui bouge vit dans un `ref` que les gestionnaires consultent.
- **Un événement qui porte un objet ne dit pas qu'il est encore d'ici.** Supprimer un
  projet détache ses assets, chaque détachement est annoncé, et les détachés venaient
  s'installer dans la grille du projet **ouvert**, qui n'est pas le leur. Ce qui se fond
  dans une liste filtrée doit être confronté au filtre — sauf à la recherche, qui vit sur
  le serveur et qu'on ne rejoue jamais à l'écran.
- **Un appel qui échoue peut avoir coûté.** L'adaptateur levait avant de lire `usage.cost`
  quand la réponse ne portait aucune image : le montant disparaissait du journal du projet,
  c'est-à-dire exactement celui qu'on cherche à expliquer. Le coût se lit **avant** tout ce
  qui peut lever.
- **Un champ ajouté à un objet ne se rétro-remplit pas tout seul.** Les assets écrits avant
  T3 n'ont ni coût ni date de lot : relire le disque sans aller les chercher dans la
  génération affichait `$0,0000` sur des images payées, et cassait l'ordre de la grille.
  `rattraper()` est l'endroit de ces réparations — il passe déjà à chaque démarrage.
- **« Sans projet » doit vouloir dire *détaché*, jamais *antérieur au rangement*.** À
  l'apparition du tout premier projet, ce qui n'en avait pas y entre : sinon l'atelier
  s'ouvre sur une grille vide alors qu'il a déjà six images.
- **Le type d'une image de référence se lit sur ses octets.** L'adaptateur annonçait
  `data:image/png` en dur : réinjecter une image d'un modèle qui ne rend que du JPEG
  l'aurait envoyée sous une fausse étiquette, et le refus serait venu du fournisseur après
  avoir traversé tout le produit.
- **Un fichier qui fait foi s'écrit entièrement ou pas du tout.** `write_text` sur le nom
  définitif laisse un JSON tronqué si le processus s'arrête au milieu — et un
  `generation.json` tronqué est le seul cas où « la bibliothèque se reconstruit sans perdre
  un asset » tombe pour de bon. On écrit à côté, puis on renomme.
- **Les polices de l'interface viennent du réseau.** `interface/index.html` charge
  Instrument Serif, Instrument Sans et JetBrains Mono depuis Google Fonts. Hors ligne,
  l'atelier fonctionne — les replis système prennent la main —, mais il ne **ressemble** pas
  à ce que `docs/DESIGN.md` décrit. À embarquer le jour où le hors ligne devient un usage
  et pas un accident.
- **Le démarrage attend le catalogue avant de servir quoi que ce soit.** Le délai est de
  30 s : un réseau qui absorbe sans refuser retarde donc l'ouverture d'autant, bibliothèque
  comprise. Un réseau franchement coupé, lui, refuse tout de suite. Le local se fait déjà
  en premier dans `Atelier.ouvrir()` ; rendre la main avant le catalogue demanderait de
  l'annoncer sur le flux, ce que l'écran sait déjà écouter.

- **Une table de palette Pillow se complète en répétant, jamais avec des zéros.** Elle
  compte toujours 256 entrées, et `quantize(palette=…)` ramène chaque pixel à la plus
  proche des **256** — pas à la plus proche de celles qu'on a écrites. Compléter avec des
  zéros posait donc 254 noirs purs : mesuré sur six gris et une palette de deux couleurs
  claires, les deux plus sombres ressortaient en `#000000`, une couleur que la palette du
  projet ne déclare pas. Même famille que le liseré du seuil alpha — *une valeur de
  remplissage qui n'est pas neutre finit par se voir*. Le défaut a dormi de T2 à T4 parce
  que le seul chemin qui l'empruntait était grisé.
- **Une palette lue sur des images entières ne dit rien du sujet.** La coupe médiane
  appliquée aux artworks tels quels rend vingt gris sur vingt-quatre : le fond plat occupe
  75 % des pixels et son anti-crénelage l'éclate en autant de seaux. On détoure d'abord.
  Corollaire à connaître : **une région fermée reste opaque**, donc l'intérieur d'un cadre
  d'interface entre dans la palette — c'est la même règle qui sauve le squelette.
- **Le dédoublonnage des références se fait sur le couple, pas sur l'identifiant.** Depuis
  T4 deux familles d'images partent par le même tuyau — un asset de la bibliothèque et une
  carte du tableau —, et elles ne se nomment pas dans le même espace.
- **Un artwork retiré ne doit pas rendre les générations passées non relançables.** Les
  artworks entrent dans `generation.references`, et `_octets_references` refusait l'appel
  dès qu'un identifiant manquait. Un asset disparu arrête toujours l'appel — c'est l'image
  que l'auteur a choisie de montrer ; une **carte** disparue est sautée, parce qu'un artwork
  inspire et n'a pas été choisi appel par appel. Sans cette différence, retirer une planche
  cassait US-19 sur tout l'univers.
- **Un balayage de masse n'écrit pas un événement par objet.** La diffusion garde 64
  messages par abonné : cent assets remis à jour en perdraient les plus anciens sur un
  onglet lent, pour un écran qui redemande de toute façon la grille entière. `sauver` prend
  donc `annoncer=False`, et l'appelant annonce **une fois**, à la fin.
- **Un asset ramené au brut reste au brut.** `revenir_au_brut` désépingle, donc l'épingle
  ne le protège pas d'un balayage de palette — et lui reposer une grille défferait « revenir
  à l'image d'origine est un seul geste » par un geste qui ne le concernait pas. Le vide
  **est** la décision : le balayage saute une recette vide et la compte comme conservée.
- **La réapplication de palette ne passe jamais par `poser_recette`**, qui épingle. Le
  premier passage épinglerait tout le projet et le second ne remettrait plus rien à jour :
  la fonction s'annulerait elle-même à son deuxième usage.
- **Un montage FastAPI ajouté après celui de l'interface n'est jamais atteint.**
  `creer_application` monte `interface/dist` sur « / », qui attrape tout. Constaté en montant
  un dossier de planches pour une séance : la planche revenait en JSON de vingt-deux octets,
  et le produit refusait à juste titre « ce n'est pas une image ».
- **Le message de Pillow ne franchit pas le port non plus.** `mesurer()` lève « cannot
  identify image file <_io.BytesIO object at 0x…> » — de l'anglais qui nomme un tampon
  mémoire. Ce qui compte, et que le PRD demande, c'est **quel fichier** pose problème parmi
  les douze qu'on vient de déposer. Même règle que pour `httpx`.
- **`aspect-ratio` cède devant `max-height`, et le cadre ment.** Un cadre en
  `width: 100%` + `aspect-ratio: 1/1` + `max-h-full` dans une zone de 1420 × 906 ressort en
  **1388 × 874** : le navigateur prend la largeur disponible, en déduit la hauteur, rabote
  la hauteur au maximum — et **ne redéduit pas la largeur**. L'image, elle, reste centrée
  par `object-contain`, donc tout ce qui est posé en pourcentage du cadre se décale de
  l'image qu'il désigne. Une mise à l'échelle qui doit être exacte se calcule : un seul
  facteur, `min(place_l / image_l, place_h / image_h)`, et le cadre **est** l'image.
- **`minmax(cran, 1fr)` accepte une colonne unique et l'étire.** Le zoom 4× de la grille
  rendait une tuile de 1028 px sur une colonne de 1060 — huit fois la taille de repos pour
  un contrôle qui en annonce quatre. Un cran de zoom n'est donc disponible que si **deux**
  tuiles y tiennent côte à côte, gouttière comprise : une grille d'une colonne n'est plus
  une planche contact, c'est une visionneuse.
- **Un `ResizeObserver` ne livre rien à un onglet qui ne compose pas ses images.** Ses
  rappels passent par la boucle de rendu ; sur un onglet en arrière-plan, le grisé du zoom
  n'est jamais apparu — la largeur mesurée restait à zéro pour toute la session. Une
  largeur se lit à la demande (`getBoundingClientRect`), au montage, au redimensionnement
  de la fenêtre, et à la fin de la transition de 160 ms des colonnes. Trois déclencheurs,
  une seule mesure.
- **Le défaut d'une bibliothèque est une cible mouvante, et il se nomme.** `rembg.new_session()`
  sans argument charge `bria-rmbg` depuis la version 2.0.81 : un gigaoctet, et **15,8 s**
  par image de 1024 px sur processeur. `u2net`, nommé, met **0,47 s** pour une silhouette
  équivalente à deux points près. Le dépôt annonçait « ~180 Mo » — la taille d'`u2net` —
  et le défaut avait changé sous cette note sans que rien ne le dise.
- **Demander si un paquet est là ne doit pas le charger.** `import rembg` tire
  `onnxruntime` dans le processus au premier `GET /api/status`, c'est-à-dire à l'ouverture
  de l'atelier, pour la seule question « faut-il griser ce bouton ? ». Or « le
  post-traitement ne touche jamais le GPU » se **prouve** en regardant `sys.modules` :
  installer le second moteur aurait fait tomber ce test sans qu'aucun détourage par modèle
  ait eu lieu. `importlib.util.find_spec` répond sans rien charger.
- **Un glob de suppression mord sur ce qui commence pareil — sauf avec son séparateur.**
  Les découpes de T5 vivent dans le dossier de la génération de leur planche, aux rangs 100
  et suivants ; effacer la planche fait `glob("0-*")`, qui ne touche pas `100-asset.json`
  parce que le motif exige le tiret. C'est ce qui rend le décalage de rang sûr, et c'est
  aussi ce qu'il ne faut pas défaire : nommer une découpe `0-1-asset.json` aurait fait
  disparaître les huit avec leur planche.
- **Zéro n'est pas une dimension mesurée, c'est l'absence de mesure.** Une carte d'adresse
  qui n'avait pas abouti annonçait `0×0`. Le produit dit partout que les dimensions mesurées
  font foi : une mesure ne s'affiche que si elle a été prise.

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
« lis `AGENTS.md` et les documents de `docs/` ». Ne jamais y recopier le contexte du dépôt,
les règles ci-dessus, l'état Git ni la liste du reste à faire : tout cela vit déjà dans les
fichiers, et la nouvelle session les lit seule.
