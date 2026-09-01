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

**Les dix tranches T1 à T10 sont finies, C1 à C5 — la V2 entière — le sont aussi, et les
cinq reprises R1 à R5 également.** Leurs 226 critères d'acceptation sont cochés,
un fichier par tranche dans `docs/tranches/` ; 394 tests de serveur et 186 d'écran les
tiennent. La V1 s'est arrêtée à
T7 ; T8, T9 et T10 sont venues après.

**Et la V2.1 est ouverte depuis le 31 août 2026** — l'interface refaite, reportée du
chantier de maquettes de `docs/maquettes-v2.1/` dans les documents qui font foi. Elle ajoute
135 user stories, `US-174` à `US-308`, et **vingt-et-une étapes `E0` à `E20`** dans
`docs/PLAN.md`. **Les vingt-et-une sont livrées** — `E0` à `E20` —, dont **dix-neuf sans
réserve** ; deux gardent un critère ouvert : `E3` la pipette, qui demande un champ de plus à la
recette, et `E8` les **dix-sept vignettes d'exemple**, qui sont une production d'images et non
du code — les cases existent et disent *pas encore dessinée* tant qu'elles manquent
(`docs/vignettes-vues.md` porte les consignes). Les deux critères qui attendaient `E13` sont
réglés : la porte de la vitrine **depuis une planche** s'est posée avec elle, et la **planche
des quatre directions** en référence proposée est **fermée** — une planche n'entre jamais en
bibliothèque, donc cette image-là n'existe pas et n'existera pas.

**Et un lot correctif est ouvert depuis le 31 août 2026 : les treize reprises d'usage `U1` à
`U13`.** Elles viennent de **deux séances** de l'auteur sur l'interface refaite, le même
soir — la première sur la V2.1 entière (quinze points, trois déjà fermés, neuf étapes), la
seconde sur les seules tables de l'atelier (six points, quatre étapes). Quatre-vingt-sept
critères. Elles vivent dans `docs/PLAN.md` après la V2.1 et **avant** la V2.2, et leurs
critères dans `docs/tranches/U.md`. **`U1`, `U2`, `U3`, `U4` et `U11` sont tenues depuis le
1<sup>er</sup> septembre 2026 ; les huit autres restent à construire.**

`U1` passe d'abord parce que c'est la seule qui coûte de l'argent réel — cinq clics sur le
bouton qui paie lançaient cinq appels payants, un verrou existant que l'écran jetait ; `U2`
ensuite parce que rien d'autre ne se juge sans elle, et `U11` avec elle parce que les deux
réparent la même erreur à deux endroits : une surface qui reçoit un geste et qui ment sur
l'image qu'elle porte. **Cinq des treize ajoutent une capacité au produit, et elles sont
cadrées depuis le 1<sup>er</sup> septembre 2026** — `US-334` à `US-366`, trente-trois stories
et onze décisions dans `docs/prd-decisions.md`. Le cadrage a tranché quatre points que le lot
portait comme ouverts, et deux d'entre eux changent ce qui sera construit : **une coordonnée
ne voyage pas** — ni cadre tracé, ni point de pipette, ni passage de la main —, si bien qu'une
recette nommée perdra les passages qu'elle emporte aujourd'hui ; et **la sélection magique
agit avec le détourage**, avant le recadrage et la mise sur grille, et non avec la main comme
la séance l'avait vue.

**Ce que la seconde séance apprend, et qui vaut d'être su avant d'ouvrir une étape.** Regarder
un écran de près cesse de trouver des défauts et commence à trouver des **absences** : deux
de ses six points ne sont pas des réparations mais des outils qui manquent. Et sa question —
*une passe de détourage supplémentaire s'applique-t-elle à l'image d'origine ou au résultat de
la précédente ?* — a une réponse à moitié surprenante que le code portait sans que rien ne
l'écrive : **la transparence s'accumule et ne se rend jamais, mais la couleur qu'une passe
examine est toujours celle de l'image d'origine.** Effacer un pixel ne change pas sa couleur.
C'est écrit en `U10`, et c'est probablement ce qui explique le défaut de la pipette sur une
seconde passe.

**Ce que `E20` a appris, et qui vaut pour la suite.** Le guide est le seul écran qui parle de
tous les autres, donc le seul qui se périme à chaque décision prise ailleurs. On pouvait craindre
que ses cent entrées soient toutes à reprendre après vingt étapes d'interface refaite : **six
phrases seulement avaient vieilli**. La raison est une règle qui a bien tenu — *une entrée décrit
un réglage, pas un écran* —, et ce qui avait vieilli était le **cadre** : le tour des lieux, les
noms des groupes, la façon dont les entrées sont rangées. Le corollaire vaut d'être gardé :
**quand un écran naît, il doit une ligne au guide**, et rien ne le rappelle tout seul —
`interface/src/aide.ts` est le seul endroit où cette ligne s'écrit, et `SANS_ENTREE`, en bas du
même fichier, est la liste de ce qu'il ne dit pas encore.

**Ce que `E14` a déplacé, et qu'il faut savoir avant de toucher au chemin de l'envoi.** Le
tiroir « qu'est-ce qui part avec ? » a quitté le champ de texte : c'est un écran entier, entre
le bouton et la dépense, et il est le seul endroit où l'on relit ce qui part. Trois conséquences
qui se rattrapent mal si on les découvre en cours de route. **Le champ ne porte plus que le
signalement** — la consigne de l'attitude et celle de l'angle sont des lignes à part, composées
par le chemin de l'envoi ; `POST /api/characters/subject` ne prend donc plus ni poses ni
directions. **Une seule résolution des trois couches** (`atelier/domaine/envoi.py`, `resoudre`)
sert la fiche d'une chose du jeu *et* l'écran de confirmation ; ce qui les distingue est le
tri, pas la règle. Et **le tri ne porte que des écarts** — les lignes éteintes à la main, celles
rallumées, les textes corrigés —, jamais un état complet : c'est ce qui fait qu'éteindre les
lignes d'une ambiance rallume les textes du jeu d'eux-mêmes.

**Ce que les trois mesures de planche ont trouvé, et ce que `E13` en a fait.** Trois appels
payés le 31 août 2026 — `essais/essai_prix_planche.py`, $0,081, relevé versionné dans
`essais/mesures_prix_planche.json`. Trois cases et six cases ont coûté **exactement le même
prix**, $0,0139, pour la même taille d'image et la même durée ; cinq cases ont coûté $0,0534,
presque quatre fois plus, sur un appel dont rien ne distingue le résultat. Une planche coûte
donc le prix d'**un appel** quel que soit ce qu'elle porte — six cases reviennent à $0,0023
l'image contre $0,0128 pour une image seule, cinq fois moins —, mais **la variance entre deux
appels identiques est plus grande que l'écart entre deux tailles de planche**. L'écran ne montre
donc **aucun** prix par nombre de cases : il montre un prix d'appel, multiplié par le nombre
d'appels que chaque choix demande. Refaire les quatre et compléter les trois coûtent alors le
même prix — et refaire achète en plus quatre images qui se ressemblent. Les arbitrages pris en
autonomie et les questions encore ouvertes vivent dans `docs/v21-arbitrages.md`, qui ne fait
foi sur rien.
Ce qui viendra après elle viendra d'une séance d'usage, comme
les cinq reprises — `docs/releve-usage.md` garde ce qui n'est encore ni cadré ni planifié.
**C5 est écrite mais pas encore usée** : la règle ci-dessous vaut pour elle comme pour les
autres, et personne n'a encore sorti un personnage dans un vrai jeu.
**L'appel payant à risque de la V2 a été tiré le 29 août 2026**, six fois : la toile avec marge
n'a pas eu à servir, et le risque de méthode qui reste est ailleurs — la différence trouve ce
qui s'ajoute et manque ce qui se substitue (`docs/archi-versions.md` § Le risque de la version).
**C4 l'a rattrapé sans le supprimer** : la main ramène ce que la mesure n'a pas vu — mesuré sur
le casque de la séance, 451 pixels de poussière et 1044 après un passage —, mais le produit ne
dit toujours pas *d'avance* qu'une pièce va se substituer.

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

py -m atelier                        lance le serveur et ouvre le navigateur — si un atelier
                                     tourne déjà sur ce port, il ouvre celui-là plutôt que
                                     d'en réclamer un second, et le dit
py -m atelier --sans-navigateur --port 8421
lancer-atelier.bat                   le double-clic du bureau : il recompile l'interface si
                                     les sources ont bougé, et il prévient quand l'atelier
                                     qui tourne date d'avant les dernières modifications du
                                     serveur — une interface neuve devant un serveur périmé
                                     ne se voit pas autrement
pytest -q                            les critères d'acceptation, sans un centime
cd interface && npm test             les essais d'écran — flux et fetch doublés, sans serveur
py essais/essai_docs.py              le corpus de démarrage pesé et sa dérive lue,
                                     et tous les renvois vers les documents résolus
py essais/essai_couverture.py        la couverture du fournisseur, gratuit
py essais/essai_pixel.py             brut contre traité, sur les images déjà là, gratuit
py essais/essai_couleurs_et_taches.py  les deux dernières places de la recette — le nombre de
                                     couleurs, la palette, le tramage, les taches et l'aire
                                     minimale. Gratuit, sur les images déjà là ; c'est lui
                                     que citent les maquettes 14 et 15. Depuis le 31 août
                                     2026 il pèse aussi les **deux curseurs de fusion d'une
                                     palette** — la proportion et l'attraction — et c'est ce
                                     qui a levé le blocage de l'étape E11
py essais/essai_ce_qui_part.py       ce que l'univers pose et ce qui part vraiment — le poids de
                                     la bible dans le prompt, les générations qui l'ont portée,
                                     ses contradictions avec le projet et avec la consigne de
                                     reprise, ce que le nombre de couleurs achète, et le tableau.
                                     Gratuit, sur les projets déjà là ; c'est lui que cite la
                                     maquette 06
py essais/essai_export.py            l'archive rouverte, sur ce que l'atelier a — gratuit
                                     (demande un atelier lancé)
py essais/essai_premiere_image.py    UN APPEL PAYANT, ~$0,006
py essais/essai_univers_chaine.py    UN APPEL PAYANT, ~$0,023 — la chaîne de T4 de bout en bout
py essais/essai_decoupe_planche.py   UN APPEL PAYANT, ~$0,004 — une vraie planche, découpée
py essais/essai_prix_planche.py      TROIS APPELS PAYANTS, $0,081 le 31 août 2026 — ce qu'une
                                     planche coûte par image selon son nombre de cases. Son
                                     relevé, `essais/mesures_prix_planche.json`, est versionné :
                                     c'est lui que l'écran de `E13` lira, et un prix mesuré qui
                                     ne serait pas dans le dépôt serait un prix en dur
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

| Annexe | Ce qu'elle prolonge | On l'ouvre quand |
|---|---|---|
| `docs/prd-decisions.md` | le PRD | on veut savoir **ce que le produit a tranché** sur une question d'usage — ce qui entre en bibliothèque, ce qui se juge, ce que la génération refuse, ce que l'agent peut. *Descendu du PRD le 31 août 2026, où il pesait 55 % du document* |
| `docs/tranches/V2.1.md` | le plan | on construit une étape de la V2.1 et on veut ses critères d'acceptation, ou ce qui a été décidé en la faisant. *Descendu du plan le 31 août 2026, où les vingt-et-une étapes pesaient 43 % du document* |
| `docs/user-stories.md` | le PRD | on cherche ce qu'une user story demande, par son numéro |
| `docs/prd-carnet.md` | le PRD | une décision du PRD paraît arbitraire et on veut ce qui l'a dictée |
| `docs/archi-versions.md` | l'architecture | on travaille *dans* une version — les briques de la V1, le pliage et le calque de la V2, ce que les V3 à V5 supposent |
| `docs/archi-fournisseur.md` | l'architecture | on rouvre la question du modèle, du catalogue, du contrat de génération ou des outils MCP |
| `docs/carte-du-depot.md` | l'architecture | avant de toucher un fichier — ce qu'il tient, et pourquoi lui plutôt qu'un autre |
| `docs/tranches/<code>.md` | le plan | on veut les critères d'acceptation, ce qui bloquait une tranche ou son rapport de tenue — vingt-et-un fichiers, de `T1` à `R5`, plus `V2.1` |
| `docs/v21-arbitrages.md` | — | on ouvre une étape de la V2.1 et on veut savoir ce qui a été tranché en autonomie, ou ce qui reste ouvert. **Il ne fait foi sur rien** : ce qui est décidé vit dans le PRD, l'architecture, le design et le plan. Il garde la trace, et ses questions ouvertes se tranchent à l'usage |
| `docs/maquettes-v2.1/` | le design | on construit un écran de la V2.1 — vingt-six maquettes, une par écran, plus un sommaire qui dit dans quel ordre elles se lisent. **Quelle maquette va avec quelle étape se lit dans `docs/tranches/V2.1.md`**, sous le titre de l'étape. Elles décrivent l'interface future, jamais l'état du code |
| `docs/design-motifs.md` | le design | on dessine un écran |
| `docs/design-decisions.md` | le design | on rouvre une décision d'apparence |
| `docs/PIEGES.md` | — | avant de toucher un terrain déjà miné, ou sur renvoi du code |
| `docs/releve-usage.md` | — | on cherche ce qu'une séance d'usage a trouvé et qui n'est **pas encore** cadré ni planifié |
| `docs/brainstorm-assistance.md` | — | on reprend un point du carnet de l'assistance à l'écriture — rôles de réinjection, modèle de texte, prompt assisté, mode avancé |
| `docs/recherche-vision.md` | — | on se demande si une technique de vision par ordinateur — alignement, différence, morphologie — apporterait quelque chose, ou pourquoi celle-ci a été écartée |
| `docs/status/etat.md` | — | on cherche pourquoi c'est comme ça plutôt qu'autrement |
| `docs/design-preview.html`, `docs/diagrams/`, `docs/maquette-atelier.html` | — | jamais d'office |

**Un document d'autorité ne grossit pas indéfiniment, et sa dérive se mesure** :
`py essais/essai_docs.py` pèse les cinq documents de démarrage, document par document et
section par section, et compare au relevé précédent. **Il ne fixe aucun plafond** — un
seuil rond refuserait le jour où l'on écrit une phrase de plus, ce qui n'est pas une
faute, et se relèverait le jour où il gêne, ce qui n'est pas un garde-fou.

Ce qui se surveille est la **tendance**. La règle d'avant — *« dès qu'une section pèse
plus que le document qui la porte, elle sort en annexe »* — n'a jamais déclenché : le
corpus a triplé deux fois quand même, jusqu'à 315 Ko le 29 août 2026. Il est redescendu à
139 le même jour, sans qu'une ligne soit supprimée. Ce chiffre-là est le repère : quand le
banc annonce une dérive qui s'installe, une section descend en annexe et laisse un renvoi.

**La règle a déclenché pour la première fois le 31 août 2026, en reportant la V2.1**, et la
descente a été faite le même jour. La phrase qui tenait ici — *« aucune section n'atteint la
moitié de son document »* — était devenue fausse : les **décisions d'implémentation** du PRD
pesaient **55 %** de leur document, les vingt-et-une étapes de la V2.1 **43 %** du plan, et le
corpus était monté à **301 Ko**. Les deux sections sont descendues **d'un bloc** —
`docs/prd-decisions.md` et `docs/tranches/V2.1.md` —, sans qu'un mot soit réécrit : le corpus
est retombé à **235 Ko**, et les trois renvois que le déplacement a cassés ont été nommés par
le banc et réparés dans la foulée. C'est cette dernière phrase qui compte, et le paragraphe
suivant dit pourquoi.

**Le banc pèse aussi les renvois**, et c'est l'autre moitié : une section qui part en
annexe emporte avec elle les renvois du code et des documents qui la visaient, et un
renvoi qui pointe une section déplacée **ne lève aucune erreur** — il ment en silence.
Après tout déplacement de section, le banc se relance ; il nomme ce qui est tombé.

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
   `docs/archi-versions.md` §6.3. Son travail est de les accrocher aux user stories et de leur
   donner des critères d'acceptation, pas d'en inventer d'autres.
3. **`/design` qui décide du produit.** Il choisit la typo, la couleur, la densité, le
   mouvement. Il ne choisit pas ce que fait un écran — ça, c'est le PRD.

**Après chaque skill, élaguer.** Ce qui migre vers `PRD.md` ou `PLAN.md` sort
d'`ARCHITECTURE.md` et y devient une simple référence. Le document rétrécit à mesure que la
chaîne avance : c'est le signe que ça marche.

## Où sont les choses → `docs/carte-du-depot.md`

Le gros grain tient ici. **Fichier par fichier — ce que chacun tient, et pourquoi lui plutôt
qu'un autre — vit dans `docs/carte-du-depot.md`.** On l'ouvre avant de toucher un fichier,
jamais pour se mettre en contexte : beaucoup de ses lignes portent un invariant qu'aucun test
ne peut énoncer, ou un piège déjà payé.

| | |
|---|---|
| `atelier/` | le paquet Python, en sept couches : `domaine/` les objets et les règles, `fournisseur/` le port et son adaptateur, `image/` le traitement, `services/` les gestes, `depot/` SQLite et fichiers, `api/` les routes, `mcp/` la façade de l'agent |
| `interface/` | React + Vite + Tailwind. `src/index.css` porte **tous** les tokens de `docs/DESIGN.md` — aucune couleur, aucun rayon, aucune durée n'est écrit ailleurs |
| `tests/`, `interface/src/*.test.tsx` | les critères d'acceptation, un fichier par tranche et nommé d'après elle. **Aucun test ne coûte un centime** : le fournisseur est doublé côté serveur, `fetch` et `EventSource` côté écran |
| `essais/` | les bancs — ce qui se mesure au lieu de se supposer. Les payants ne partent qu'à la main, et § Lancer dit lesquels et combien |
| `donnees/` | ce que le produit écrit : les images payées, leurs recettes, les projets et leurs univers, et un index SQLite **jetable**. Hors Git |
| `docs/` | les documents ; leur autorité est tranchée plus haut, § Les documents et leur autorité |
| `screen_spritecook/`, `Anatomie de SpriteCook.html` | la référence d'ergonomie — 30 captures écran par écran, et l'analyse fonctionnelle qui a servi de point de départ |

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

  **Déterministe ne veut pas dire immuable, et la différence se paie une fois.** Le
  1<sup>er</sup> septembre 2026, `U11` a changé la forme du pinceau de la main — un
  **carré** de côté impair là où c'était un disque, parce qu'on peint des pixels et qu'un
  disque de rayon deux sur un sprite de soixante-quatre fait un escalier que personne n'a
  dessiné. Un calque peint avant ce jour ne se redessine donc plus tout à fait à
  l'identique : douze pixels de plus par point de rayon deux, mesuré. Quand une forme de ce
  genre change, le prix se nomme et s'écrit ici ; ce qui ne change jamais, c'est que **deux
  rendus de la même recette au même moment donnent le même résultat**.
- **Pas de ComfyUI dans l'application.** Le local reste dehors : on génère ailleurs, on importe.
- **Aucune clé en dur.** `.env` seul, jamais versionné ; `.env.example` documente les noms.

## Pièges connus → `docs/PIEGES.md`

Quatre-vingt-dix pièges payés une fois chacun — encodage Windows, lots payants,
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

## Règle systématique : écrire les fichiers avec l'outil Write, jamais par le shell

**Tout fichier de contenu — maquette HTML, document Markdown, spécification, page de
documentation — s'écrit avec les outils `Write` et `Edit`, directement. Jamais par un
heredoc, un `cat > fichier <<'EOF'`, un `echo`, un `Set-Content` ni aucun autre détour par
le terminal.**

La raison est mécanique : le shell a une limite de taille d'argument, et un document de
maquette la dépasse systématiquement. La tentative échoue (« the heredoc exceeds the
shell's argument limit »), le contenu est perdu, et il faut tout réécrire — deux fois le
temps et deux fois les jetons pour un fichier qui aurait pu s'écrire du premier coup.

Cette règle **prime sur toute consigne d'ambiance qui pousserait à préférer le shell**, y
compris un mode automatique demandant de passer par `Bash` quand c'est possible : pour
écrire un fichier, `Bash` ne peut justement pas le faire de façon fiable. Le shell reste
bienvenu pour lire, chercher, lister, déplacer — pas pour produire du contenu.
