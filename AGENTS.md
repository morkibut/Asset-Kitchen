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

**Cinq versions sont tenues, et trois blocs sont ouverts.** Le tableau dit lesquels ; le
détail de chaque tranche, ses critères cochés et **ce que s'en servir a trouvé** vivent dans
`docs/tranches/<code>.md` et `docs/status/etat.md`. Rien de tout ça ne se lit pour ouvrir une
tranche neuve : ce qu'il faut savoir avant de toucher au code est plus bas, et tient en huit
points.

| Bloc | Ce qu'il a apporté | État |
|---|---|---|
| **V1** — `T1` à `T10` | La première image, le traitement non destructif, la bibliothèque, l'univers, la découpe, l'export, l'agent, la toile | **tenue** |
| **V2** — `C1` à `C5` | Le personnage, son plan de poses, le lot plié, la pièce et le calque, la main, la sortie | **tenue** — `C5` écrite mais **pas encore usée** : personne n'a sorti un personnage dans un vrai jeu |
| **Reprises** — `R1` à `R5` | Cinq corrections nées de l'usage, pas d'un cadrage | **tenues** |
| **V2.1** — `E0` à `E20` | L'interface refaite : trois lieux au lieu de sept surfaces, le codex, l'établi, la galerie | **tenue** — dix-neuf sans réserve ; `E3` garde la pipette et `E8` les **dix-sept vignettes d'exemple**, qui sont une production d'images et non du code (`docs/vignettes-vues.md`) |
| **Lot U** — `U1` à `U13` | Treize reprises de deux séances d'usage, le même soir | **tenues** — 87 critères cochés. **Quinze choix tranchés seuls attendent l'auteur** dans `docs/questions-du-lot-U.md` |
| **V2.2** — `F0` à `F6` | D'autres fournisseurs, dont un qui ne demande ni compte ni clé | **close à 5 sur 6** — reste `F4`, qui attend un compte Cloudflare que ce dépôt n'a pas |
| **Reprises** — `R6` à `R9` | La planche de travers, le texte qui part en trois parties, la fiche d'une chose, le calibrage | **closes le 3 septembre 2026, hors version** |
| **V2.3** — `D1` à `D5` | Le traitement cesse d'être à refaire | **close le 3 septembre 2026, cinq sur cinq** |
| **V3** — `A0` à `A13` | L'animation, **par la vidéo et le découpage** | **close le 5 septembre 2026**. La méthode a changé après cadrage : on n'achète plus une planche de huit cases, on anime le sprite en vidéo et on découpe le clip. **`A10` était le cœur de la version** — un clip payé devient plusieurs animations, et l'écran dit ce que chacune a coûté. **`A11` en amène le prix à zéro** : le même clip se fabrique sur la carte de la maison, et le bouton porte un temps au lieu d'un montant. **`A12` est l'objectif de la version, et il est atteint** : la matrice d'un personnage se lit sur deux calques — images fixes, animations —, chacun avec sa jauge. **`A13` fait sortir la version de l'animation** : une image de la pellicule se met de côté et entre en bibliothèque avec sa filiation. **`A4` rend la version livrable** : une animation gardée sort en planche de sprites, avec le fichier d'accompagnement que les moteurs lisent et une image qui tourne toute seule. **`A5` fait tenir le contour en place** : la silhouette et la palette d'une bande se décident une fois pour la bande. **`A7` ferme la version, et son vrai sujet n'était pas dans son plan** : une animation gardée **ne se rouvrait par aucun chemin** — la vignette remontait au clip, donc l'écran repartait des réglages du jeu |
| **V3.01** à **V3.03** | Trois versions nées de l'usage, le 5 septembre 2026 : le tiroir qui relit ce qui part, la fiche d'un clip, et **l'atelier d'une animation au niveau des tables** | **ouvertes** — `V3.01` 1 sur 2 (reste la liste de modèles qui se plie), `V3.02` **close**, `V3.03` **2 sur 4**. `V3.03.1` donne à **chaque frame sa recette à elle** et refait l'écran dans la grammaire des tables ; `V3.03.2` pose ces tables **sur une sélection du ruban**, où *une valeur voyage seule quand une recette nommée remplace l'ensemble*. Restent `V3.03.3`, le montage de la bande, et `V3.03.4`, la main |

**226 critères d'acceptation cochés pour la V1 et la V2, 87 pour le lot U ; 1 480 essais de
serveur et 747 d'écran** tiennent aujourd'hui l'ensemble du dépôt — comptés le 5 septembre 2026,
et **aucun ne coûte un centime**.

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

### Ce qui est ouvert, et ce qui a été fermé devant

**La V3 est close, et trois versions nées de son usage l'ont remplacée** — `V3.01`, `V3.02` et
`V3.03`, ouvertes le 5 septembre 2026 le jour même où `A7` fermait la V3. Elles ne sont pas un
cadrage : chacune vient d'une séance où l'auteur s'est servi de ce qui venait d'être livré.
**`V3.03` est celle qui reste à finir** — l'édition d'une animation devient l'édition d'images,
et il en manque la moitié : le montage de la bande et la main.

Les deux choses qui passaient devant la V3 sont closes depuis le 3 septembre 2026, et le tableau
plus haut le dit : les quatre reprises hors version `R6` à `R9`, et la **V2.3** entière — un
réglage de départ par nature d'image, la vraie taille de bloc retrouvée, le fond devenu réglage
du jeu, une liste ouverte de moteurs de détourage, et le rendu qu'on voit avant de payer.

**L'ordre avait changé avec la méthode, et ça ne se lit plus qu'ici.** Tant que la V3 achetait
des planches, elle attendait la V2.3 : son geste principal était de juger une planche en une
seconde, et une image mal traitée n'est pas jugeable. Elle achète maintenant des clips vidéo
qu'elle découpe, et `A9` — le clip entre dans l'atelier — ne dépendait d'aucune tranche. **Elle
est donc partie la première.** `A10`, l'éditeur de montage, attendait la V2.3 parce qu'il montre
une image traitée : **il ne l'attend plus.**

**Ce qu'il faut savoir avant d'ouvrir une tranche de la V3 tient dans deux documents.**
`docs/PLAN.md` ouvre sur le cadrage refondu de la V3 et le verdict de ses cinq chemins ; `docs/bilan-v3.md`
garde les trois bancs de planches — **141 planches, 6,03 $** — qui ont tué la méthode
précédente. Trois conclusions commandent tout : **une bonne planche d'animation sur dix**, ce
qui interdit de bâtir un produit sur *« on commande une planche, on la corrige »* ; **la façon
de demander est épuisée comme levier**, mesuré sur trente-et-un réglages puis six de plus, donc
le texte du produit ne bouge pas ; et **ce qui est payé est détruit avant d'être vu**, parce que
le recadrage prend chaque étape sur sa propre boîte — ce défaut-là vaut pour un clip autant que
pour une planche, et c'est `A2` qui le répare.

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
pytest -q                            les critères d'acceptation, sans un centime
cd interface && npm test             les essais d'écran — flux et fetch doublés, sans serveur
py essais/essai_docs.py              le corpus de démarrage pesé et sa dérive lue,
                                     et tous les renvois vers les documents résolus
py essais/essai_couverture.py        la couverture du fournisseur, gratuit
py essais/essai_pollinations.py      l'adaptateur du fournisseur sans clé, contre le vrai
                                     fournisseur. GRATUIT — deux appels, un jeton chacun,
                                     aucun dollar, et une trentaine de secondes d'attente
                                     entre les deux : le palier sans compte n'accepte qu'un
                                     appel toutes les quinze secondes. C'est le seul essai
                                     qui prouve la promesse de F1 — *sans compte, sans clé,
                                     une image arrive* — et le seul qui lise chez lui
                                     l'en-tête de consommation de F2. **Il demande une phrase
                                     que personne n'a demandée**, l'horodatage compris : la
                                     même phrase reviendrait de son cache, sans en-têtes, et
                                     l'essai vérifierait le cache en croyant vérifier
                                     l'adaptateur (`docs/PIEGES.md`)
py essais/maquette_v3.py             les images de la maquette de la V3, refaites depuis un clip
                                     déjà payé. GRATUIT — rien ne part chez un fournisseur. Il
                                     écrit ses planches dans
                                     `docs/maquettes-v3/01-du-sprite-a-la-bande.html`, qui reste
                                     un fichier qu'on ouvre d'un double-clic. La page se fige
                                     par `?fige` ou la barre d'espace : sans ça elle ne se
                                     laisse pas photographier (`docs/PIEGES.md`)
py essais/essai_pixel.py             brut contre traité, sur les images déjà là, gratuit
py essais/essai_fenetre_commune.py   la dérive de cadrage d'un clip à l'autre — A2. GRATUIT :
                                     il lit un clip déjà payé et n'en commande aucun. Il ne
                                     mesure **pas** la taille du sprite rendu — un personnage
                                     qui marche est plus large qu'un personnage au repos, et
                                     ce chiffre-là mélangerait la pose et le cadrage — mais
                                     **le facteur appliqué**, qui doit être constant dans un
                                     clip. `--clip <chemin>` pour un autre que le moonwalk.
                                     Sortie : `essais/mesures_fenetre_commune.json`, qui
                                     s'accumule par clip au lieu de s'écraser
py essais/essai_superposition_cadre.py   ce que le découpage du coin gardait, et ce qu'il
                                     jetait — sur les pièces d'équipement du dépôt. GRATUIT,
                                     et **en lecture seule sur `donnees/`** : l'atelier de
                                     l'auteur peut tourner à côté. C'est lui qui a montré que
                                     le geste de G16 était cassé pour les neuf pièces et non
                                     pour deux. Sortie : `essais/mesures_superposition_cadre.json`
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
py essais/essai_palette_vive.py      le temps d'un relâchement de curseur sur une palette,
                                     avant et après U6 : 11 500 ms contre 25 sur trois vraies
                                     cartes, mesuré le 1er septembre 2026. Gratuit, et il
                                     n'écrit rien du jeu — il monte un atelier jetable dans
                                     un dossier temporaire et emprunte des octets
py essais/essai_moteurs_de_detourage.py  les cinq moteurs de détourage par modèle mis côte à
                                     côte, sur quatre images du dépôt. GRATUIT — rien ne part
                                     chez un fournisseur, tout tourne sur le processeur. **Le
                                     premier lancement rapatrie les modèles manquants depuis
                                     github.com/danielgatis/rembg — 382 Mo pour les deux qui
                                     manquaient le 3 septembre 2026, et non les 257 annoncés :
                                     l'allégé pèse 214 Mo, pas 88,6** ; les lancements suivants
                                     ne téléchargent rien. Il compte la part de l'image gardée,
                                     le temps, et surtout **l'ajouré trouvé** — c'est la seule
                                     colonne qui sépare les moteurs, et c'est elle qui a fait
                                     changer le moteur par défaut. Comptez trois minutes
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
py essais/essai_animation.py         BANC PAYANT, $2,87 le 1er septembre 2026 — huit modèles,
                                     la même demande à tous : le prompt du produit et ses
                                     trois images, relus dans une vraie génération. Sans ça
                                     le banc mesurerait autre chose que ce que le produit
                                     envoie. Sortie : `essais/resultats_animation/`
py essais/essai_recette.py           BANC PAYANT, $2,45 le 1er septembre 2026 — vingt-neuf
                                     demandes au même modèle, sept axes. Il a un **plafond
                                     cumulé** : il relit ce qui est déjà sur le disque et
                                     n'engage que la différence, donc une reprise ne repaie
                                     pas la séance. Sortie : `essais/resultats_recette/`
py essais/banc_complet.py            les deux bancs d'animation repassés par UN SEUL juge —
                                     gratuit, tout est sur le disque. Sortie : `essais/tout.json`
py essais/verdict_auteur.py          les mêmes, reclassés sur les NOTES DE L'AUTEUR, et la
                                     confrontation des deux jugements — c'est elle qui a
                                     montré que la mesure automatique ne prédisait rien.
                                     Gratuit. Entrée : `essais/notes-auteur.json`.
                                     Sortie : `essais/verdict.json`
py essais/rapport_tout.py            les 111 animations qui tournent, avec leur note, leur
                                     consigne, leurs images jointes et leur prix — gratuit,
                                     ~12 Mo. C'est en s'en servant qu'on a vu que la mesure
                                     était fausse. Sortie : `essais/rapport-animation.html`

pytest -q tests/test_essais_socle.py  les fonctions pures du socle des six essais du
                                     2 septembre 2026, sur le double, sans un centime
py essais/essai_references_nommees.py --a-sec   E1 — les références nommées. Le premier
                                     lancement de chaque essai est À SEC : il montre ce
                                     qui partirait — textes, différence mot à mot, images
                                     avec rôle et taille, appels, coût — et n'engage rien.
                                     Sans `--a-sec` : PAYANT. Refait le 2 septembre 2026 après
                                     une première séance à 0 bonne sur 8 : un témoin neuf et
                                     trois textes neufs — rangé, rangé avec priorité des images,
                                     réécrit par l'IA — à DEUX tirages chacun (~$0,25), avec
                                     les artworks officiels que le personnage désigne, dans
                                     l'ordre du produit ; plafond $0,60. Sortie :
                                     `essais/resultats_references_nommees/`,
                                     `essais/rapport-references-nommees.html`
py essais/essai_taille_reference.py --tirages 2   E2 — la référence en 64, 256 ou 512 px.
                                     QUATRE APPELS PAYANTS à deux tirages (~$0,14, la
                                     surface se paie), plafond $1,00. Le témoin est celui
                                     de E1 avec les artworks du jour, relu sans repayer.
                                     Sa taille retenue est relue par E4 et E5
py essais/essai_grille_complete.py --tirages 2    E3 — la grille 4×2 au lieu de 3×3.
                                     QUATRE APPELS PAYANTS à deux tirages (~$0,11),
                                     plafond $0,40 ; même témoin que E2
py essais/essai_mise_en_pose.py      E4 — la « prep » de SpriteCook, en deux temps : huit
                                     images seules (~$0,10), l'auteur en choisit une dans
                                     le rapport, puis huit planches (~$0,20). PAYANT,
                                     plafond $0,50 par lancement
py essais/essai_pose_imposee.py      E5 — la pose imposée par image, une exploration :
                                     UN APPEL PAYANT par pose (`--poses contact,passage`
                                     fait un tour à ~$0,03), quatre tours au plus, un seul
                                     correctif par tour, `--bande` pour le cinquième
                                     (huit appels, ~$0,14). Plafond $0,50 par lancement.
                                     Le script demande « ce que j'attends » et « ce qui
                                     peut rater » avant chaque envoi (`--attendu`,
                                     `--peut-rater` pour les passer sans terminal)
py essais/essai_video_planche.py     E6 — le sprite animé par un modèle image-vers-vidéo
                                     chez fal.ai (`FAL_KEY` dans `.env`, hors du produit).
                                     REFUSE DE PARTIR tant que l'endpoint et le prix du jour
                                     ne sont pas recopiés dans `essais/resultats_video/mesures.json`.
                                     Deux clips par modèle, trois modèles (Wan 2.2 5B,
                                     Seedance 1.0 pro fast, Kling 2.1 standard), cinq à
                                     vingt-huit centimes le clip relevés le 2 septembre
                                     2026, ~$0,96 en tout, plafond $3,00. Demande
                                     `uv pip install -e ".[essais-video]"` pour lire les clips
py essais/monter_bande_video.py      les huit images d'un cycle figé dans le rapport de E6,
                                     passées dans la chaîne du produit sur une fenêtre
                                     commune — gratuit
py essais/verdict_essais.py          les six relevés `essais/notes-<essai>.json` relus, et
                                     chaque règle du cahier appliquée telle qu'écrite —
                                     gratuit, ne conclut rien au-delà
```

Les six essais et leur cahier vivent dans `revue-externe-2026-09-02/cahier-des-essais.md`,
hors de `docs/` : ils décrivent des essais, pas le produit. Leur socle commun est
`essais/socle_essais.py`.

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
| `docs/tranches/<code>.md` | le plan | on veut les critères d'acceptation, ce qui bloquait une tranche ou son rapport de tenue — vingt-trois fichiers : les vingt tranches de `T1` à `R5`, le lot correctif `U`, et les deux versions d'écrans et de fournisseurs `V2.1` et `V2.2`. **`V2.2.md` porte en plus ce que chaque tranche livre**, descendu du plan le 1<sup>er</sup> septembre 2026 : on y ouvre **un seul** fichier pour reprendre une tranche de cette version-là |
| `docs/v21-arbitrages.md` | — | on ouvre une étape de la V2.1 et on veut savoir ce qui a été tranché en autonomie, ou ce qui reste ouvert. **Il ne fait foi sur rien** : ce qui est décidé vit dans le PRD, l'architecture, le design et le plan. Il garde la trace, et ses questions ouvertes se tranchent à l'usage |
| `docs/maquettes-v2.1/` | le design | on construit un écran de la V2.1 — vingt-six maquettes, une par écran, plus un sommaire qui dit dans quel ordre elles se lisent. **Quelle maquette va avec quelle étape se lit dans `docs/tranches/V2.1.md`**, sous le titre de l'étape. Elles décrivent l'interface future, jamais l'état du code |
| `docs/maquettes-v2.4/` | le design | on construit **le coin du calque** — l'écran unique où un calque se fabrique ou se reprend. Une seule maquette, `01-le-coin-du-calque.html`, ouvrable d'un double-clic. Elle ne bâtit rien : elle tranche quatre questions, écrit ce que chaque réponse écarte, et nomme ce que la construction devra au guide. **Elle attend l'arbitrage de l'auteur** — la tranche qui bâtira l'écran ne s'écrit pas avant |
| `docs/design-motifs.md` | le design | on dessine un écran |
| `docs/design-decisions.md` | le design | on rouvre une décision d'apparence |
| `docs/PIEGES.md` | — | avant de toucher un terrain déjà miné, ou sur renvoi du code |
| `docs/releve-usage.md` | — | on cherche ce qu'une séance d'usage a trouvé et qui n'est **pas encore** cadré ni planifié |
| **`docs/bilan-v3.md`** | le plan | **on ouvre une tranche de la V2.3 ou de la V3** — les conclusions chiffrées des trois bancs payés, ce que le relevé d'outillage a rapporté, les trois défauts que le code porte aujourd'hui, et **ce qui est mort et ne doit pas se reproposer**. Il remplace la lecture des sept documents préparatoires |
| `docs/v3-animation.md` | — | on veut les trois bancs planche par planche, avec les notes de l'auteur et les tableaux complets. **Le bilan suffit dans presque tous les cas** |
| `docs/releve-outillage.md` | — | on veut le relevé d'outillage entier — sources, licences, ce qui est écarté et pourquoi. **Le bilan en donne les conclusions** |
| `docs/archive/README.md` | — | on cherche un document qui a servi et qui est fini : les cinq versions livrées, les séances d'essai closes, les études qui ont tranché. **Rien n'y fait foi et rien n'y est à faire** |
| `docs/archive/plan-versions-tenues.md` | le plan | on veut le détail d'une tranche des cinq versions livrées — `T`, `C`, `R1`–`R5`, `E`, `U`, `F`. *Descendu du plan le 2 septembre 2026, où les versions tenues pesaient plus des trois quarts du document* |
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

  **Le 3 septembre 2026, `D4` a changé trois choses de plus, et les voici.** *Le rongement de
  bord* ne mange plus un pixel que s'il ressemble davantage au fond qu'à son voisin intérieur :
  47 185 pixels de sujet épargnés sur quatre images, et un trait d'un pixel d'épaisseur ne
  disparaît plus jamais. *La décontamination* repeint ensuite les pixels de bord restés à la
  couleur du fond — 9 à 51 % du pourtour selon l'image, sans jamais toucher à la transparence.
  Ces deux-là s'appliquent à **tout** détourage, donc une recette d'avant ce jour rend une image
  un peu différente. *Et le moteur par défaut du détourage par modèle* passe de `u2net` à
  `isnet-general-use` : une recette qui ne nomme aucun moteur — c'est-à-dire toute recette
  d'avant `U13` — retombe sur le nouveau et change. Celles qui nomment `u2net` ne bougent pas.
- **Pas de ComfyUI dans l'application.** Le local reste dehors : on génère ailleurs, on importe.
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
