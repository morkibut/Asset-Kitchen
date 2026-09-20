# Asset Kitchen

Atelier personnel de production d'assets 2D pour jeu. On y définit **l'univers** d'un jeu
une fois, puis on fabrique au cas par cas les personnages, objets, décors et interfaces qui
lui appartiennent. **Tout ce qui est produit entre en bibliothèque de lui-même** ; juger,
c'est marquer favori ou supprimer, et ce qui est jugé l'est avant de partir dans le jeu, pas
avant d'entrer dans la bibliothèque. Un serveur MCP expose les mêmes gestes à un agent qui
code le jeu.

Ce fichier-ci ne dit que **comment travailler dans ce dépôt**. Ce qu'il faut construire vit
dans `docs/`, réparti selon la règle d'autorité ci-dessous.

## Où en est le dépôt → `docs/PLAN.md`

**Le tableau d'état vit dans `docs/PLAN.md`, § Où en est le dépôt, et nulle part ailleurs.**
Il tenait ici aussi jusqu'au 6 septembre 2026 : deux documents répondaient à la même question,
ce que la règle *une question, un document* interdit plus bas. La mise à jour de fin de tranche
se fait donc désormais à **un seul endroit**.

Les chantiers actifs sont indiqués uniquement dans `docs/PLAN.md`. Ils sont **deux depuis le
13 septembre 2026** : `docs/PLAN-atelier-unifie.md` ajoute des capacités,
`docs/PLAN-remise-a-plat.md` remet d'aplomb sur la maquette validée ce qui existe déjà — et
celui-ci passe devant quand les deux touchent le même écran. La V4 reste le socle existant et ses
critères historiques dans `docs/tranches/V4.md`. Ce qu'une tranche a appris en se
construisant est dans `docs/status/etat.md` ; ses critères cochés dans `docs/tranches/<code>.md`.
Rien de tout ça ne se lit pour ouvrir une tranche neuve.

**Ce qu'il faut savoir avant de toucher au code ne se lit nulle part ailleurs**, et c'est la
suite immédiate.


### Ce qu'il faut savoir avant de toucher au code — dix points, et pas un de plus

Ce sont les endroits où une règle a changé de forme sans changer de nom. Les découvrir en
cours de route coûte cher ; les lire ici coûte deux minutes.

1. **Un modèle se nomme par son fournisseur *et* par son nom, les deux ensemble** —
   `OpenRouter:openai/gpt-image-2` —, et c'est cette chaîne qui s'enregistre sur une
   génération et sur un asset. Chaque fournisseur a son état à lui, et couper la liaison de
   l'un ne touche pas à la liste de l'autre.
2. **Ce qu'un appel a consommé s'enregistre dans l'unité du fournisseur.** Un emplacement, un
   asset et une génération portent `consomme` et `unite` ; `cout_usd` en est **déduit**, et il
   est nul dès que l'unité n'est pas de l'argent. *Un total en argent ne compte que de
   l'argent* est donc tenu par construction. Une dépense d'avant la V2.2 se relit sans rien
   perdre : pas d'unité veut dire des dollars.
3. **`atelier/reglages.py` ne connaît que « une place nommée, et ce qu'il y a dedans ».**
   Quelles places existent, c'est aux adaptateurs de le dire. `PUT` et
   `DELETE /api/settings/keys/{nom}` refusent tout nom qu'aucun fournisseur n'a déclaré —
   sans quoi un navigateur écrirait n'importe quoi dans le `.env` de l'auteur.
4. **Ce que le produit ajoute de lui-même cède devant le plafond du modèle ; ce que l'auteur a
   joint ne cède jamais.** Un modèle gratuit n'accepte aucune image d'entrée ; sans cette
   règle, un jeu ayant **un seul** artwork officiel refuserait tout appel chez lui. Ce qui cède
   est enregistré (`hors_plafond`), montré avant de partir, et relu sur la fiche de l'image.
5. **Dans une recette, la transparence s'accumule et ne se rend jamais — mais la couleur qu'une
   passe examine est toujours celle de l'image d'origine.** Effacer un pixel ne change pas sa
   couleur. C'est ce qui explique le défaut de la pipette sur une seconde passe.
6. **Le tiroir « qu'est-ce qui part avec ? » est un écran entier**, entre le bouton et la
   dépense, et le seul endroit où l'on relit ce qui part. Le champ de texte ne porte plus que
   le signalement ; l'attitude et l'angle sont des lignes composées par le chemin de l'envoi.
   Une **seule** résolution des trois couches (`atelier/domaine/envoi.py`, `resoudre`) sert la
   fiche d'une chose *et* l'écran de confirmation — ce qui les distingue est le tri, pas la
   règle —, et **le tri ne porte que des écarts**, jamais un état complet.
7. **Quand un écran naît, il doit une ligne au guide, et rien ne le rappelle tout seul.**
   `interface/src/aide.ts` est le seul endroit où cette ligne s'écrit ; `SANS_ENTREE`, en bas
   du même fichier, liste ce que le guide ne dit pas encore. La règle qui a fait vieillir six
   phrases seulement sur cent après vingt étapes : *une entrée décrit un réglage, pas un
   écran*.
8bis. **Il y a deux ports derrière `fournisseur/` depuis la V3**, et un appel vidéo n'est pas
   un modèle de plus. Son image de départ est **obligatoire** — le point 4 ci-dessus ne
   s'applique pas à elle, aucun plafond ne la fait céder —, il se soumet puis s'attend, et le
   numéro du travail s'écrit **avant** la première attente : sans lui, un clip payé pendant
   qu'on ferme l'atelier se repaie. Ce qui revient n'est pas une image, et **la dépense s'écrit
   avant toute mesure de fichier** : un fichier vidéo lève « illisible » dans la chaîne
   d'images, et le rattrapage enregistrait alors un échec à zéro dollar.
8ter. **Un modèle vidéo peut ne rien coûter, et zéro n'est pas « inconnu ».** Depuis `A11`, un
   des modèles de la liste tourne sur la carte graphique de la machine. Deux règles en
   découlent, et elles se cassent facilement. La première : *ce qui manque au fournisseur* grise
   ses modèles à lui — **pas tous** ; une clé absente chez le payant ne dit rien du local, et le
   routage se fait par le nom du fournisseur, celui qui voyage déjà sur chaque modèle. La
   seconde : l'invariant *rien ne part sans que ce que ça coûte soit annoncé* **change d'unité**
   au lieu de disparaître — le bouton porte un temps, mesuré et non deviné. ⚠️ Ce temps **ne se
   multiplie pas** pour un lot : le premier tirage charge le modèle en mémoire, les suivants non.
8quater. **La matrice d'un personnage a deux calques, et ils ne se comptent pas pareil.**
   Depuis `A12` : les images fixes, et les animations. ⚠️ **Ils ne se mêlent pas** — une case qui
   porterait les deux serait pleine dès qu'elle a l'une des deux, et une animation manquante se
   cacherait derrière une image présente. L'invariant *une case est prise dès qu'une image la
   porte* n'est pas tordu : il vaut deux fois, une fois par calque. ⚠️ Et le second compte **ne
   se multiplie pas** comme le premier : une marche demande huit images *par direction* pour être
   dessinée et **une seule bande** par direction pour être animée — la bande porte déjà ses huit
   images dedans.
8quinquies. **Le fichier qui accompagne une planche de sprites n'est pas de nous, et on n'y
   ajoute rien.** Depuis `A4`, une animation sort avec le descriptif qu'écrit Aseprite, le plus
   lu par les moteurs, **clé pour clé** d'après un relevé
   (`revue-externe-2026-09-02/research/12-ui-hud-exports.md`). ⚠️ Un format emprunté ne se
   dégrade pas d'un coup : il se dégrade d'une clé ajoutée « qui ne gêne personne », et six mois
   plus tard le fichier ne s'ouvre plus nulle part. Un essai compare donc le **jeu de clés
   exact**, pas seulement la présence des bonnes. Ce que l'atelier sait en plus — de quel clip,
   quelle recette, quel appel payé — va dans le descriptif maison, **à côté**. Et l'image animée
   est **découpée dans la planche exportée** : les deux fichiers ne peuvent pas diverger parce
   que l'un est fait de l'autre.
8sexies. **Une mesure trop large ne dit pas « il n'y a rien » : elle dit « je ne sais pas
   regarder ».** Payé sur `A5`, et c'est ce que la tranche a coûté de plus cher. Le plan écrivait
   la mesure du contour qui bout en toutes lettres — *la part du bord qui change d'une image à
   l'autre* —, et elle compte **le grésil et le vrai mouvement ensemble** : le mouvement pèse
   tellement plus lourd qu'il l'enterre, et trois bancs de suite ont annoncé un gain nul sur une
   correction qui marchait. ⚠️ **Le réflexe a été, chaque fois, de corriger le sujet d'essai
   jusqu'à ce que le chiffre bouge.** La bonne mesure tenait dans une phrase : *un pixel que le
   sujet traverse s'allume une fois et reste allumé ; un pixel qui s'allume, s'éteint et se
   rallume est revenu sur ses pas.* Avant de fabriquer un banc, écrire **en une phrase et sans
   chiffre ce que la mesure sépare de quoi** — et si le banc reste muet, suspecter la mesure
   avant le sujet, et le sujet avant le code.
8septies. **Un objet qu'on sait écrire et qu'on ne sait pas relire n'est pas fini.** Payé sur
   `A7`, et trouvé par l'auteur à l'usage — pas par un essai. Le produit gardait une animation
   avec tous ses réglages et **ne savait pas la rouvrir** : l'écran repartait des réglages du
   jeu, et corriger une virgule demandait de tout refaire de mémoire. ⚠️ **Aucun essai ne pouvait
   le voir, et c'est leur forme qui l'expliquait** : ils gardaient puis vérifiaient la réponse du
   `POST`, c'est-à-dire ce qu'ils venaient d'envoyer. Pour tout objet que le produit garde, un
   essai le **referme et le rouvre**, et il garde avec des réglages qui ne sont pas ceux du
   défaut — sinon la relecture passe par accident.
8octies. **Un essai d'écran qui met les choses au calme avant d'agir supprime le défaut qu'il
   cherche.** Payé sur `A7` aussi, et vu au navigateur. L'atelier d'une animation s'ouvre en
   jouant ; les essais commençaient donc par arrêter le lecteur, pour pouvoir lire l'écran — or
   **arrêté, le défaut ne peut pas se produire**. Le vrai geste arrive pendant que ça tourne.
   Quand un essai neutralise un état pour observer, se demander si le défaut vit dans l'état
   neutralisé, et en écrire un qui le laisse en marche — **ralenti plutôt qu'arrêté**. Et
   vérifier qu'il tombe **en défaisant le correctif** : un essai écrit après coup passe souvent
   des deux côtés.
8nonies. **Une route qui sert quelque chose que nul écran n'affiche n'existe pas.** Trois
   demandes de l'auteur le 5 septembre 2026, et les trois avaient la même forme : la vidéo
   d'un clip était servie par une route depuis `A9` et **aucun écran ne la montrait** ; les
   recettes nommées existaient et ne se posaient que sur une image ; le détourage offrait un
   curseur de tolérance que **deux moteurs sur quatre ne lisent pas**. ⚠️ Ni une revue de code
   ni un essai d'écran ne voient ça — la route est là, testée, correcte, et l'essai vérifie ce
   que l'écran montre, jamais ce qu'il ne montre pas. **À la fin d'une tranche, lister ce que
   le serveur sait rendre et vérifier que chaque chose a un chemin depuis un écran** ; ce qui
   n'en a pas est soit à brancher, soit à retirer. Corollaire du même jour : **un contrôle qui
   dépend d'un choix voisin disparaît quand ce choix le rend inerte**, et laisse une phrase à
   sa place — un curseur qui bouge sans que l'image change ne se distingue pas d'un curseur
   cassé.

8. **Une planche coûte le prix d'un appel, quel que soit ce qu'elle porte.** Mesuré le 31 août
   2026 sur trois appels payés : trois cases et six cases ont coûté exactement le même prix, et
   cinq cases quatre fois plus. **La variance entre deux appels identiques est plus grande que
   l'écart entre deux tailles de planche** — donc l'écran ne montre **aucun** prix par nombre de
   cases : un prix d'appel, multiplié par le nombre d'appels que chaque choix demande.

### Deux risques qui restent, et une règle qui vient de l'usage

**Le risque de méthode de la V2 est ailleurs qu'on ne croyait.** L'appel payant à risque a été
tiré le 29 août 2026, six fois : la toile avec marge n'a pas eu à servir. Ce qui reste est que
**la différence trouve ce qui s'ajoute et manque ce qui se substitue** — `C4` l'a rattrapé sans
le supprimer, la main ramène ce que la mesure n'a pas vu, mais le produit ne dit toujours pas
*d'avance* qu'une pièce va se substituer (`docs/archi-versions.md` § Le risque de la version).

**Ce que la seconde séance d'usage a appris, et qui vaut pour toutes les suivantes.** Regarder
un écran de près cesse de trouver des défauts et commence à trouver des **absences** : deux de
ses six points n'étaient pas des réparations mais des outils qui manquaient.

Le journal complet — ce que chaque tranche a livré, et surtout ce que chacune a appris en étant
*utilisée* — vit dans **`docs/status/etat.md`**. Il ne fait foi sur rien : on l'ouvre pour
savoir pourquoi c'est comme ça, pas pour savoir quoi faire. Ce qui n'est **pas encore** cadré
ni planifié est dans `docs/releve-usage.md`.

**La règle qui en est sortie, elle, tient ici** : *une tranche n'est finie que lorsqu'on s'en
est servi*. Neuf tranches de suite, s'en servir a trouvé des défauts qu'aucun test ne voyait —
jusqu'à cinq d'un coup. Et depuis `T9`, une conception mise à juger **avant** la première ligne
de code en a trouvé un qu'aucune séance n'aurait vu : deux gestes corrects isolément dont la
composition perdait quelque chose en silence.


## Lancer

```
uv venv --python 3.11
uv pip install -e ".[dev]"
uv pip install -e ".[detourage]"   facultatif — le détourage par modèle, ~180 Mo. Le modèle
                                   se télécharge au premier appel, et **c'est
                                   `isnet-general-use` depuis le 3 septembre 2026**, pas
                                   `u2net` : 170 Mo au lieu de 168, une moitié de détails
                                   ajourés en plus pour 0,7 seconde. Le catalogue en propose
                                   cinq, et chacun arrive de la même façon, à son tour
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
py essais/lancer_les_essais.py       **le contrôle rapide — à chaque tranche.** Tout ce qui
                                     n'est pas marqué lent, sur quatre processus, plus les
                                     garde-fous et ce qui touche à ce qu'on vient d'écrire.
                                     C'est la commande de tous les jours
py essais/lancer_les_essais.py --complet
                                     **le contrôle complet — avant de fusionner dans main.**
                                     Tout, lent compris, les lents sans concurrence
py essais/lancer_les_essais.py --proches
                                     **le cran le plus court** — les garde-fous, plus les
                                     essais qui nomment ce qu'on vient d'écrire. Le geste de
                                     la boucle de travail ; il ne remplace pas le rapide
py essais/lancer_les_essais.py --liste
                                     ne lance rien : dit quels essais touchent ce qu'on a
                                     modifié, **et quels fichiers modifiés n'en ont aucun**
pytest -q                            les critères d'acceptation d'un seul bloc, sans un
                                     centime. ⚠️ **Compter une heure** — 71 minutes de
                                     processeur mesurées le 20 septembre 2026, contre une
                                     dizaine de minutes à quatre processus. Les commandes
                                     ci-dessus existent pour ça
cd interface && npm test             les essais d'écran — flux et fetch doublés, sans serveur.
                                     3 min 19 pour les 95 fichiers. ⚠️ **Ne pas trier** :
                                     `vitest related` sur trois fichiers met aussi longtemps
                                     que la suite entière, mesuré (`docs/essais.md`)
py essais/essai_docs.py              le corpus de démarrage pesé et sa dérive lue,
                                     et tous les renvois vers les documents résolus
py essais/essai_jetons.py            le système de design **dans les deux sens** :
                                     il refuse une couleur que la liste ne déclare
                                     pas, et il **compte** les jetons que rien
                                     n'emploie — la seconde moitié ne refuse rien,
                                     elle rend un compte, parce qu'un jeton
                                     inemployé est soit une pièce pas encore
                                     dessinée, soit un jeton mort
py essais/essai_vocabulaire.py       les mots de l'ossature contre la **liste
                                     fermée** de `docs/vocabulaire.html` — portes
                                     du carnet, onglets de la fiche d'un sujet,
                                     titre de chaque écran, forme d'un retour.
                                     Il **lit** le document et ne recopie pas
                                     ses mots : changer un mot là-bas suffit.
                                     Chaque écart se nomme en entier — fichier,
                                     ligne, mot trouvé, mot attendu
py essais/essai_imports.py           le garde-fou d'import : un fichier du carnet
                                     n'emprunte aucune fonction, constante ni crochet à
                                     un écran hors carnet — monter un composant reste
                                     permis, la majuscule qui ouvre le nom fait la
                                     différence entre monter et emprunter
```

**Les 29 autres bancs vivent dans `docs/bancs.md`** — ce que chacun mesure, ce qu'il coûte, et
ce qu'il a trouvé. *Descendus le 6 septembre 2026, où le catalogue pesait 13 Ko de ce document.*
⚠️ **Les payants ne partent qu'à la main**, et le fichier dit lesquels et combien.


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

## Les essais : deux niveaux de contrôle → `docs/essais.md`

```
py essais/lancer_les_essais.py --proches   le cran court — pendant qu'on écrit
py essais/lancer_les_essais.py             le rapide — à chaque tranche de travail
py essais/lancer_les_essais.py --complet   le complet — avant de fusionner dans main
```

**Le rapide** lance tout ce qui n'est pas marqué `lent`, plus les garde-fous, plus les essais
qui touchent à ce qu'on vient d'écrire. **Le complet** lance tout, les lents sans concurrence.

`docs/essais.md` dit le reste, et surtout **ce que le rapide ne voit pas** : la règle des
essais proches se fait par les noms et rate ce qu'un essai n'appelle qu'à travers l'API.

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

**Quelle annexe s'ouvre quand → `docs/README.md`.** Une trentaine de fichiers y sont listés,
chacun avec ce qu'il prolonge et le moment où on l'ouvre. *Descendu le 6 septembre 2026.*


**Un document d'autorité ne grossit pas indéfiniment, et sa dérive se mesure** :
`py essais/essai_docs.py` pèse les cinq documents de démarrage, document par document et
section par section, et compare au relevé précédent. Ce qui se surveille est la **tendance**.

**Trois descentes, et la troisième dit ce qui manquait.** Le 31 août 2026 le corpus était à
**301 Ko** : les décisions d'implémentation pesaient 55 % du PRD et les vingt-et-une étapes de
la V2.1 43 % du plan ; les deux sections sont descendues d'un bloc, et il est retombé à 235. Le
2 septembre, le détail des cinq versions livrées est descendu du plan. Le 6 septembre, il était
à **596 Ko — presque le double de son plus haut connu**, et le banc l'annonçait à chaque
lancement sans que rien ne se passe. Il est redescendu à **165 Ko le même jour** : sept sections
en annexe, deux fichiers d'archive, **et pas un mot changé**.

⚠️ **La leçon de la troisième est que mesurer ne suffit pas.** Un garde-fou qu'on lit en
diagonale n'en est pas un. Depuis le 6 septembre, le banc **ouvre sa sortie par un bandeau** dès
que le corpus dépasse le relevé précédent, et la ligne remonte dans le rapport de fin de tranche.
Il ne refuse toujours rien : un seuil rond refuserait le jour où l'on écrit une phrase de plus,
ce qui n'est pas une faute, et se relèverait le jour où il gêne, ce qui n'est pas un garde-fou.

**Ce qui ne descend jamais avec une section** : les invariants. Un invariant instauré vaut pour
toutes les tranches suivantes, y compris celles d'une version qui n'existe pas encore.

**Le banc pèse aussi les renvois**, et c'est l'autre moitié : une section qui part en
annexe emporte avec elle les renvois du code et des documents qui la visaient, et un
renvoi qui pointe une section déplacée **ne lève aucune erreur** — il ment en silence.
Après tout déplacement de section, le banc se relance ; il nomme ce qui est tombé. Le
6 septembre 2026 il en a nommé **dix-sept d'un coup**, tous redirigés dans la foulée : c'est la
seule raison pour laquelle une descente de 430 Ko est vérifiable.

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
| `essais/` | les bancs — ce qui se mesure au lieu de se supposer. Les payants ne partent qu'à la main, et **`docs/bancs.md` dit lesquels et combien** |
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

  **Le 3 septembre 2026, `D4` a changé trois choses de plus, et les voici.** *Le rongement de
  bord* ne mange plus un pixel que s'il ressemble davantage au fond qu'à son voisin intérieur :
  47 185 pixels de sujet épargnés sur quatre images, et un trait d'un pixel d'épaisseur ne
  disparaît plus jamais. *La décontamination* repeint ensuite les pixels de bord restés à la
  couleur du fond — 9 à 51 % du pourtour selon l'image, sans jamais toucher à la transparence.
  Ces deux-là s'appliquent à **tout** détourage, donc une recette d'avant ce jour rend une image
  un peu différente. *Et le moteur par défaut du détourage par modèle* passe de `u2net` à
  `isnet-general-use` : une recette qui ne nomme aucun moteur — c'est-à-dire toute recette
  d'avant `U13` — retombe sur le nouveau et change. Celles qui nomment `u2net` ne bougent pas.
- **Génération locale autorisée depuis le 11 septembre 2026.** ComfyUI et asset3d restent
  des moteurs externes, pilotés par des adaptateurs de l'atelier. Ne pas modifier leur
  installation ni télécharger leurs poids implicitement. L'import reste disponible.
- **Aucune clé en dur.** `.env` seul, jamais versionné ; `.env.example` documente les noms.

## Pièges connus → `docs/PIEGES.md`

Cent soixante-deux pièges payés une fois chacun — encodage Windows, lots payants,
`ResizeObserver`, onglet d'arrière-plan, SQLite, montages FastAPI et Starlette, transport
MCP, mise en page CSS, préparation cachée d'une bibliothèque de vision — vivent dans
**`docs/PIEGES.md`**, que le code cite là où chacun mord.

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

**Le prompt de reprise s'ouvre sur l'en-tête de la tâche suivante.** Avant les trois lignes,
une ligne d'en-tête qui donne, dans cet ordre : **le nom de la tâche, sa difficulté, et le
modèle recommandé**, lus dans le fichier d'affectation du plan actif — sans le rejuger à froid.

```
B1 · Le miroir — [MEDIUM] — Sonnet, réflexion élevée
(point dur : la règle d'empreinte se pose en Opus avant le reste)
```

Trois précisions :

- **Si la tâche est un morceau d'une tranche et non la tranche entière**, c'est l'étiquette du
  morceau qui vaut — les tableaux « points durs » et « morceaux qui descendent » du même
  fichier priment sur la ligne de la tranche.
- **Si la tâche n'est dans aucun des deux tableaux**, l'écrire quand même et dire pourquoi en
  une phrase, sur le même critère que le fichier : ce que la tâche demande au moment de
  l'écrire, pas sa valeur ni sa taille.
- **Une étape ne se poursuit pas sans cet arrêt.** On rend l'étape, on donne le prompt, et on
  attend — même quand la suite paraît évidente et même en mode automatique.

## Avant de coder une tranche, vérifier son affectation

Lire le classement de la prochaine tranche avant d'écrire du code ; si elle n'est pas classée,
appliquer `/affecte` d'abord. Comparer le modèle actif au modèle et au niveau recommandés.
S'ils correspondent, poursuivre ; sinon annoncer tranche, difficulté, modèle et réflexion,
donner le prompt de reprise et attendre, sauf demande explicite de continuer ici. Ne pas
répéter cet arrêt pour la même tranche dans la même conversation. Les points durs isolés
suivent leur propre affectation ; les traiter séparément selon les règles du fichier compagnon.

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
