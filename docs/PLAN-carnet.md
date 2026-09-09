# Plan — V4, le carnet : la refonte de l'interface

> **Source** : les planches de `docs/pistes-2026-09-04/carnet/`, relevées une par une le
> 6 septembre 2026 — elles étaient 43 ce jour-là. **Ce sont elles qui font foi**, tranché par
> l'auteur le même jour — sur ce qu'il faut construire *et* sur ce à quoi ça ressemble.
>
> ⚠️ **Le dossier grandit, et ce n'est pas une dérive** : une fonctionnalité neuve amène ses
> maquettes, et il y en avait 47 le soir même. *Tranché par l'auteur le 6 septembre 2026 :* on
> construit sur les maquettes déjà faites et sur ce que le code tient déjà — porter la V4 sur
> l'existant d'abord. **Une planche neuve n'ouvre pas de tranche toute seule.**
>
> **Pourquoi ce fichier et pas `docs/PLAN.md`** : la refonte est un bloc de version entier, pas
> quelques tranches à glisser dans un plan de 5 257 lignes que l'auteur édite en parallèle.
> `docs/PLAN.md` porte une ligne V4 qui renvoie ici ; les tuiles descendent en V5 et le son
> en V6.
>
> **Ce document ne nomme ni fichier ni fonction** pour ce qui reste à écrire. Il en nomme
> pour ce qui existe déjà, parce que c'est ce qui a été mesuré.

## Les quatre décisions du 6 septembre 2026

| La question | Ce que l'auteur a tranché |
|---|---|
| Le fond, clair ou sombre | **Les maquettes font foi : papier clair.** `docs/DESIGN.md` est réécrit d'après elles, et sa décision « mode clair — il n'y en a pas » tombe |
| La pièce d'équipement | **Elle déclare qui la porte, et personne par défaut.** Le partage reste possible ; les emplacements de corps restent au jeu |
| Par où on commence | **Les trois tranches gratuites d'abord** — `B1`, `B2`, `B3` —, puis le socle |
| Le numéro | **V4**, et les tuiles et le son descendent d'un cran |

---

## Ce que la refonte est vraiment

Ce n'est pas un changement d'habillage. Le relevé des planches a trouvé, sous le dessin,
**quatre chantiers qui touchent le modèle de données et le serveur** :

| Le chantier | Ce que le code fait aujourd'hui | Ce que les maquettes demandent |
|---|---|---|
| **Les moteurs de retouche** | 8 places de recette, une poignée de moteurs par place | **58 items manquants** comptés atelier par atelier — 44 moteurs, 11 capacités, 3 traitements neufs. Une dizaine remplacent une génération payée |
| **La pièce d'équipement** | elle appartient au jeu, se pose sur n'importe qui (`atelier/domaine/equipement.py:109`) | elle déclare **qui la porte**, personne par défaut — sans quoi le vestiaire dessiné n'a pas de données à montrer |
| **La collection** | un asset a **0 ou 1** collection (`atelier/domaine/asset.py:220`), et elle range des images | un **sujet** appartient à **plusieurs** collections, et une collection range des sujets |
| **La bande d'animation** | elle porte le projet, le personnage, la pose, la direction | il lui manque `favori`, `rang`, `supprime_le` — le rangement que les images ont déjà — et un axe *pièce* |

Et deux chantiers d'écran qui ne sont pas des retouches non plus : le châssis (les trois
onglets tombent, un carnet de 300 px les remplace) et la sortie vers le moteur de jeu (rien
ne prévisualise, rien ne compare à la sortie précédente, aucun fichier de catalogue moteur
n'existe dans tout `atelier/`).

**Ce qui est hors périmètre, à la demande de l'auteur** : les décors et les terrains.
`Decors.dc.html` et `Tuiles.dc.html` sont marqués « mis de côté » — 8 étapes sur 14 et
8 sur 11 restent à imaginer, et **aucun** des 19 outils propres à ces deux familles n'existe.
Ils ne sont pas dans ce plan.

---

## Décisions architecturales

Ce qui ne se renégocie plus une fois posé. Chaque tranche les conserve, et c'est un critère
d'acceptation de chacune.

### Le papier clair

- **Les maquettes font foi sur l'apparence.** Le châssis chaud et sombre de l'ancien
  `docs/DESIGN.md` est abandonné, et avec lui la règle « mode clair — il n'y en a pas », qui
  était écrite jusque dans `interface/src/index.css`.
- **Le système de design se réécrit avant `B0`**, d'après les planches et non d'après
  l'intention : la palette fermée de `Systeme.dc.html`, ses trois familles de police, ses onze
  pièces, ses six règles et ses quatre durées. C'est ce document qui devient la source, et
  aucun écran n'invente une valeur qui n'y est pas.
- **Le rouille ne sert qu'à deux choses** : le bouton qui lance, et le chiffre qui coûte. Un
  seul bouton rouille par écran.
- **Ce qu'il faudra regarder à l'usage** : juger un sprite sur fond clair n'a jamais été mesuré
  ici, et l'ancien système avançait une raison — la luminance d'entourage fausse le contraste
  perçu. La décision est prise ; si elle gêne, c'est dans les ateliers de retouche, la galerie
  et l'essai que ça se verra en premier.

### Le châssis

- **Trois zones, et pas une quatrième** : le carnet (300 px, à gauche, jamais recouvert),
  la surface (le reste, une seule à la fois), la barre (par-dessus, appelée au clavier).
- **Quatre présentations fermées** pour la surface : *page*, *matrice*, *planche*, *table*.
  Un écran neuf est l'une des quatre. La question « où le mettre ? » n'a que quatre réponses.
- **Deux écrans seulement prennent la fenêtre entière** : l'ouverture (choisir un jeu) et le
  parcours de création. Partout ailleurs, le carnet reste visible, même pendant une
  génération.
- **Le lieu est un état, le fil d'Ariane en est dérivé.** Aujourd'hui c'est l'inverse : onze
  booléens d'ouverture dans `interface/src/App.tsx` et 150 lignes de `if/else` qui
  reconstruisent « où l'on est » à chaque rendu (`App.tsx:2204` et suivantes). Une pile de
  lieux remplace les onze booléens ; le fil et le carnet la lisent.
- **Bornes du carnet** : une seule ligne ouverte à la fois, une collection dépliée s'arrête à
  8 sujets, le carnet ne dépasse jamais 30 lignes ouvert.

### Le vocabulaire

- **Cinq niveaux** : jeu › famille › collection › sujet › image. Un calque se pose sur une
  image. Un équipement a en plus ses *emplois*.
- **Famille** = le type, fixe, six valeurs. **Collection** = le groupe libre. Les deux ne se
  confondent jamais, et aucun écran n'en invente une septième.
- **Clip** = la vidéo revenue d'une génération. **Frame** = une image du clip, qui se souvient
  d'où elle vient. **Bande** = le montage gardé.
- La liste noire de `Vocabulaire.dc.html` s'applique partout : écrans, menus, guide,
  messages d'erreur. Deux exceptions gardées : *prompt* et *frame*.

### Le modèle de données

- **Une collection est une adhésion multiple, et elle porte des sujets.** C'est un changement
  de schéma : colonne simple → table de jointure, et `ranger()` / `chercher()` /
  `PUT /assets/arrangement` / l'arbre `/library` suivent.
- **Une pièce d'équipement déclare qui la porte, et personne par défaut** — tranché le
  6 septembre 2026. Une pièce créée depuis la fiche d'un personnage lui est attribuée d'emblée ;
  le partage reste possible, pour qu'un casque porté par cinq gardes se décrive une fois. Les
  emplacements de corps restent au jeu — c'est le plan du corps, il est commun au casting.
- **Une bande se range comme une image** : `favori`, `rang`, `supprime_le`. Et elle gagne un
  axe *pièce*, sans quoi un calque ne se pose pas sur une animation.
- **`direction` reste facultative, et vide ne veut pas dire sud.** Une image faite avant que
  le jeu déclare ses directions est « à confirmer », pas « au sud ».
- **Un clip entre en bibliothèque comme entrée durable**, avec une image de couverture
  fabriquée une fois — sinon ouvrir la galerie télécharge toutes les vidéos.

### La recette de retouche

- **L'ordre des huit places ne change pas**, et aucune place neuve ne s'insère au milieu.
- **Une place absente d'une recette ne compte pas dans son empreinte.** C'est ce qui autorise
  à en ajouter sans recalculer tous les rendus déjà en cache : une recette écrite avant
  l'ajout doit rendre exactement la même empreinte après.
- **Une place neuve se pose en queue**, après les contours et **avant la main** — la main
  reste la dernière, rien ne se rejoue après elle.
- **Une borne se déclare une fois.** Le dépôt les déclare deux fois par construction (la route
  pour un 422 lisible, le service pour la vraie règle) et elles ont déjà divergé : la taille de
  case plafonne à 512 sur la route (`atelier/api/routes.py:883`) et à 2 048 dans le service
  (`atelier/services/assets.py:108`). Un jeu en style dessin ne peut donc rien retoucher.

### L'argent, et ce qui refuse

Tous les invariants de `docs/PLAN.md` § *Les invariants du produit* sont reconduits sans
exception. Trois comptent particulièrement ici :

- **Rien ne part sans que ce que ça coûte soit annoncé** — et l'unité peut être un temps.
- **Deux lieux seulement paient** : le bouton d'un écran de sujet, et l'agent. Le carnet et la
  barre n'engagent jamais une dépense : la barre ouvre l'écran d'envoi déjà rempli.
- **Ce qui est indisponible est grisé avec sa raison écrite à côté**, jamais en infobulle,
  jamais caché — et l'échec ne se manifeste qu'au moment de fabriquer, jamais à l'ouverture
  d'un écran.

### Les essais

- **On ne réécrit pas les 714 essais d'écran.** `interface/src/App.test.tsx` fait
  24 887 lignes et navigue par `getByRole("tab", …)` **61 fois**. Une seule fonction d'aide de
  navigation est introduite, les 61 appels basculent dessus, et les assertions de contenu ne
  bougent pas. Cette bascule est le premier critère de `B0` — pas un nettoyage d'après-coup.
- Les 1 347 essais de serveur qui verrouillent l'ordre des huit places sont le garde-fou de
  toute place neuve : ils doivent passer sans modification.

---

## Ce qui reste ouvert avant, et qui passe devant

Le tableau « Où en est le dépôt » de `docs/PLAN.md` porte trois versions ouvertes au
6 septembre 2026 : **V3.01** (la liste de modèles qui se plie), **V3.03** (`V3.03.4`, la main),
**V3.1** (14 tranches sur 16). Et **V2.5** — *« le design reprend la main »* — est ouverte avec
une seule tranche écrite, `N1`, qui est un relevé. **Ce plan-ci est la suite de `N1`** : le
relevé est fait, il a été fait deux fois, par cette session et par celle de `docs/releves/`.

---

## L'ordre de bataille

Tranché le 6 septembre 2026 : **les trois tranches gratuites passent devant le socle.** Elles
ne dépendent de rien, elles rapportent dès la première séance, et elles rodent la flotte
d'agents avant le gros morceau.

| Rang | Tranches | Pourquoi là |
|---|---|---|
| **1** | `B1` ✔, `B2` ✔, `B3` ✔ | aucune dépendance, du gain immédiat, et trois pertes silencieuses réparées |
| **2** | `D0` ✔, `B0` ✔ | le système de design réécrit, puis le socle du carnet — tout le reste s'y branche |
| **3** | `B4` ✔, `B5` ✔, `B6` ✔, `B7` | l'ouverture, le tableau de bord, la barre, le guide |
| **4** | `B8`, `B9`, `B10`, `B11` | la collection, la grille d'une famille, la page d'un sujet, le départage |
| **5** | `B14`, `B15` | les règles du jeu, l'installation |
| **6** | `B16`, `B17`, `B18` ✔ | les tables rangées, puis les moteurs |
| **7** | `B12`, `B13` ✔, `B19` ✔, `B20` ✔, `B21` ✔, `B22` ✔ | l'essai, la grille du jeu, le vestiaire, les calques d'animation, la sortie, la galerie |

`B8` et `B17` sont du serveur pur : ils se prennent en parallèle du rang qui les précède.

---

## D0 · Le système de design réécrit — **tenue le 6 septembre 2026**

`docs/DESIGN.md` réécrit d'après les planches, avec son spécimen vivant : **zéro valeur hors
des listes fermées, sur 412 éléments mesurés au navigateur**. Fermer la tranche a trouvé le
trou que le comptage du matin ne pouvait pas voir — il ne demandait que *ce que le document
écrit, les planches l'emploient-elles ?* La réciproque a trouvé **huit couleurs employées dans
21 à 40 planches et déclarées nulle part**, toutes pour la même raison : **un signal n'est pas
une couleur, c'est un trio** — un fond, un trait, une encre. `B0` reprend les deux sens.

→ son plan et son rapport de tenue : `docs/tranches/V4.md` § D0.

## Les tranches

23 tranches, plus `D0`. Chacune traverse toutes les couches et se démontre seule.

---

## B1 · Le miroir — **tenue le 6 septembre 2026**

Une image se retourne gratuitement, et le retournement est **une place de la recette**, pas un
bouton d'export. Elle pose la règle dont tout le reste dépend — *une place vide ne s'écrit pas
dans l'empreinte* —, et elle a trouvé un défaut livré que 2 300 essais ne voyaient pas : la
queue de la recette s'appliquait **deux fois** par rendu, ce qui traçait le contour deux fois
et annulait purement et simplement le miroir.

→ son plan, ses cinq critères et son rapport de tenue : `docs/tranches/V4.md` § B1.

## B2 · Les clips payés qui attendent — **tenue le 6 septembre 2026**

Un bandeau branché sur deux routes qui dormaient depuis le 4 septembre. Elle a trouvé un second
défaut : `_echouer` **écrasait** la dépense déjà enregistrée d'un clip au lieu de l'additionner
— une seconde panne de rapatriement en aurait remis le montant à zéro dans le journal.

→ son plan, ses quatre critères et son rapport de tenue : `docs/tranches/V4.md` § B2.

## B3 · Les huit états — **tenue le 6 septembre 2026**

Cinq des huit états étaient déjà tenus par le code. Les deux pertes silencieuses qui ne
l'étaient pas sont réparées : la grille dit désormais « N montrées sur T » au-delà de son
plafond de 200, et le **décalage horizontal**, que `PUT /assets/{id}/recipe` jetait en silence
à chaque réglage voisin posé, parce que `CorpsGrille` ne déclarait pas le champ et que Pydantic
ignore un champ non déclaré.

→ son plan, ses six critères et son rapport de tenue : `docs/tranches/V4.md` § B3.

## B0 · Le socle du carnet — **tenue le 6 septembre 2026**

Le châssis neuf **à côté de l'ancien**, avec un seul lieu branché : le tableau de bord. La pile
de lieux remplace douze états d'ouverture d'`App.tsx` — en les gardant **dérivés**, mêmes noms
et mêmes setters, si bien que deux cents lectures n'ont pas bougé —, et le fil d'Ariane se
déduit d'elle au lieu de se reconstruire en 110 lignes de ternaires. Les trois noms disputés —
`signal`, `ok`, `echec` — vont au carnet, et l'ancien système prend `ancien-` sur 504 emplois
dans 37 fichiers : **le préfixe est le compteur d'avancement de la refonte.**

Les trois dettes de `D0` sont payées. Le contrôle en sens inverse a trouvé **quinze emplois de
quatre couleurs déclarées nulle part** — dont deux boutons actifs sans aucun fond —, et les
quatre n'ont **pas** été déclarées : ce sont les écrans qu'on a ramenés sur des jetons qui
existent.

→ son plan, ses six critères et son rapport de tenue : `docs/tranches/V4.md` § B0.

## B4 · L'ouverture — **tenue le 6 septembre 2026**

Le premier écran de l'atelier — sur quel jeu travaille-t-on — et le point dur qui bloquait le
carnet depuis `B0` : **changer de jeu ne rechargeait que la bibliothèque, jamais l'univers**.
La bible, la taille de pixel et les grisés restaient ceux du jeu précédent jusqu'à
reconnexion du flux, parce que l'univers n'arrivait que par le flux — jamais refetché à la
bascule. Réparé côté client par un effet qui referme la boucle : un jeu qui vient de s'ouvrir
et dont l'univers n'a pas encore suivi redemande `GET /api/universe`, sans reconnecter le flux
ni recharger la page.

Le chantier suit désormais le même principe que la grille d'images : scopé au jeu ouvert,
côté serveur (`GenerationsService.chantier`) et dans le premier message du flux. Et la liste
se trie par dernier travaillé — une date neuve, `Projet.dernier_travail_le`, posée par
`choisir()` et servie dans l'arbre.

→ son plan, ses six critères et son rapport de tenue : `docs/tranches/V4.md` § B4.

---

## B5 · Le tableau de bord du jeu — **tenue le 6 septembre 2026**

**Planche** : `Accueil.dc.html`

La page d'un jeu ouvert : une carte par famille avec ce qui est complet et ce qui ne l'est pas,
« ce qui manque le plus » toutes familles confondues avec son coût, et le bandeau d'une feuille
reçue qui attend d'être découpée. Compté côté serveur (`GET /api/dashboard`,
`ServiceProduction.bilan_du_jeu`), jamais recalculé à l'écran. Détail et verdicts des six
critères dans `docs/tranches/V4.md` § B5.

### Bloquée par

- `B0`, `B4` — tenue le 6 septembre 2026.

---

## B6 · La barre — **tenue le 6 septembre 2026**

**Planches** : `Barre.dc.html`, `Navigation.dc.html`, `Parcours.dc.html`

La troisième zone du châssis, allumée. Elle ne tient **aucune liste d'actions à elle** : ce
qu'elle propose est la liste des outils du serveur MCP, la même que celle de l'agent, lue avec
`list_tools()` — une fonction ajoutée au serveur y paraît sans une ligne d'interface de plus.
Trois outils sont nés de la tranche pour trois gestes que le serveur savait faire et qu'aucun
bouton ne déclenchait : reconstruire l'index, recalculer le rendu, relire le catalogue.

**« Elle ne paie jamais » est tenu par ce qui n'est pas dans la réponse** : une action à
confirmer sort du serveur **sans route**, donc l'écran n'a rien à appeler. La règle survivra à
une réécriture de l'écran.

Elle a trouvé en passant que le pied du carnet annonçait `⌘K` sur une machine qui n'a pas cette
touche, et que le liseré rouille de mise au point valait un second rouille sur un écran qui n'en
autorise qu'un.

→ son plan, ses cinq critères et son rapport de tenue : `docs/tranches/V4.md` § B6.

---

## B7 · Le guide en volet, et les touches — **tenue le 6 septembre 2026**

**Planches** : `Guide.dc.html`, `Ouverture.dc.html`

Le guide ne recouvre plus l'écran : `VoletGuide` (`interface/src/composants/Guide.tsx`) est un
volet de 380 px posé à droite, qui ne montre que ce qui concerne l'écran ouvert. Les 157
entrées d'`aide.ts` sont réadressées — pas vers neuf écrans de la V1, mais, autant que
possible, vers les genres mêmes de `Lieu` (`interface/src/lieux.ts`) : neuf des quatorze
valeurs de `Explication["ou"]` sont des littéraux de `Lieu` réemployés tels quels. Le panneau
des touches est neuf : cinq raccourcis réels y entrent, chacun vérifié dans le code qui le lit
avant d'être annoncé. Détail, verdicts des six critères et ce qui reste ouvert dans
`docs/tranches/V4.md` § B7.

### Bloquée par

- `B0` — tenue le 6 septembre 2026.

---

## B8 · La collection devient un vrai groupe — **tenue le 7 septembre 2026**

**Planches** : `Famille.dc.html`, `Vocabulaire.dc.html`

**Six morceaux sont écrits.** `B8.1` a posé le modèle de l'adhésion — la collection
porte ses membres, un membre est le couple `(jeu, sujet)` —, et les cinq essais qui parlaient de
collection nomment désormais laquelle des deux ils vérifient. `B8.2` lui ajoute la table de
jointure de l'index, plus petite qu'annoncée : `reconstruire()` relisait déjà les adhésions
depuis `B8.1`, sans une ligne à changer. `B8.3` fait entrer le **sujet lui-même** dans l'index —
une table `personnages`, accrochée aux deux seuls endroits qui en écrivent un — et elle non plus
n'a rien eu à changer ailleurs : rien ne la lit encore, exactement comme `B8.2` à sa sortie.
`B8.4` referme les gestes — ranger un sujet, l'en retirer, supprimer une collection sans toucher
à ses sujets — et reprend les quatre chemins existants que la disparition d'`Asset.collection`
emportait avec elle : le rangement, le filtre de la grille, et l'arbre, qui compte désormais des
sujets au lieu d'images. `B8.5` rend la recherche en deux groupes — les sujets par leur nom et
leur description, les images par leur prompt, leur pose, leur direction et le nom de leur
sujet —, et c'est elle qui fait vraiment servir la table de `B8.3` : personne ne la lisait avant.
`B8.6`, le vocabulaire du serveur, était déjà acquis : docstrings de `supprimer_collection`, `ranger_sujet` et `retirer_sujet` disaient déjà « sujet(s) » plutôt qu'« assets », et la clé du retour de `supprimer_collection` portait `"sujets"` au lieu d'`"assets"`.

### Ce qu'on livre

Un changement de schéma, livré seul pour qu'il se mesure seul. Aujourd'hui un asset porte
`collection: str | None` — un rattachement à zéro ou un groupe, sur des images. Les maquettes
demandent qu'un **sujet** appartienne à **plusieurs** collections, et qu'y ranger un sujet ne
le retire d'aucune autre.

La recherche s'élargit dans la même tranche, parce qu'elle a la même cause : l'index ne porte
qu'une colonne, remplie du seul `label` (`atelier/depot/base.py:518`). Chercher un sujet par sa
description ou sa pose est impossible, et la barre de `B6` en dépend.

### Critères d'acceptation

- [x] Un sujet se range dans deux collections et reste dans les deux. *Tenu par `B8.4` :
      `ranger_sujet` pose le couple `(jeu, sujet)` dans une collection par `Collection.avec`,
      idempotent et indifférent à ce qui est déjà écrit dans les autres collections.*
- [x] Retirer une collection ne perd aucun sujet : ils redeviennent sans collection. *Tenu par
      `B8.4` : `supprimer_collection` ne lit ni ne parcourt plus un seul asset — seules la fiche
      et sa ligne de jointure partent.*
- [x] L'index se reconstruit du disque et retrouve les mêmes adhésions — les fichiers font
      foi, la base est reconstructible. *Tenu par `B8.2` : la table de jointure porte les mêmes
      adhésions que la fiche après un aller-retour disque complet.*
- [x] La recherche rend **deux groupes** : les sujets par leur nom et leur description, les
      images par leur prompt, leur pose, leur direction et le nom de leur sujet. *Précisé le
      6 septembre 2026 : le critère d'origine mêlait les deux — un sujet n'a pas de pose.*
      *Tenu par `B8.5` : `GET /api/characters/search` pour le premier groupe, sur la colonne
      `recherche` (nom + description) de la table `personnages` ; le filtre `recherche` existant
      de `GET /api/assets` pour le second, élargi à la pose et la direction — gravées dans la
      colonne `recherche` de l'image comme le prompt l'était déjà — et au nom du sujet, lu par
      une jointure à l'instant de la requête, jamais gravé, pour qu'un sujet renommé change
      aussitôt ce que ses images trouvent.*
- [x] Une collection ne range que des **sujets**. Le filtre `collection` de la galerie devient
      « les images des sujets de cette collection », et `Asset.collection` disparaît. *Tenu par
      `B8.4` : le filtre devient une jointure `EXISTS` sur `collections_membres` par
      `(jeu, sujet)`, et le champ, la colonne et l'index d'`Asset.collection` sont retirés.*
- [x] Les collections déjà écrites sur le disque se relisent sans perte. *Tenu par `B8.1` :
      une fiche sans clé `membres` — celles d'avant `B8` — rend simplement un groupe vide,
      par un chemin de lecture correct et non par une conversion ; il n'y avait d'ailleurs rien
      à migrer sur le disque de l'auteur au 6 septembre 2026. Coche restée en retard jusqu'ici.*

### Bloquée par

Aucune — le serveur seul, démarrable en parallèle de `B0`.

### Sa conception, jugée avant la première ligne

Le relevé, les deux décisions de modèle, les trois arbitrages de l'auteur et le découpage en
six morceaux sont dans `docs/tranches/V4.md` § B8. *Écrits le 6 septembre 2026.*

---

## B9 · La grille d'une famille

**Planche** : `Famille.dc.html`

### Ce qu'on livre

L'écran d'échelle : 54 personnages sur les 550 sujets d'un univers, en grille, avec les
collections, la recherche, les filtres et la sélection multiple. Et les réglages de la famille
sous un bouton d'entête — les natures, les poses attendues, les emplacements de corps, le
modèle par défaut.

**Bonne nouvelle du relevé** : le modèle porte déjà ce qu'il faut. Une nature de sujet est
déjà une `Echelle(nom, famille, occupation, silhouette, poses)` — elle porte sa famille *et*
ses poses ensemble — et le modèle par défaut est déjà rangé par famille. L'écran montre ce qui
existe.

### Critères d'acceptation

- [x] La grille tient 250 sujets sans ralentir : elle défile, elle ne recalcule pas ses
      vignettes à chaque rendu. *Cliquée sur 260 personnages : la page se charge par 120, et
      l'image d'une carte est une vignette réduite, servie en `lazy`, jamais l'image entière.*
- [x] Faire glisser une sélection sur une collection montre le compte projeté avant le lâcher.
      *`10 + 3` pendant le survol, `13` au lâcher — vérifié au navigateur sur la ligne
      « Les boss » du carnet, et le compte n'annonce que les sujets qui n'y sont pas déjà.*
- [x] Les filtres portent leur compte, et « incomplets » se dérive de ce que la nature attend.
      *Et le compte porte sur la famille entière, pas sur la page servie.*
- [x] Le panneau des réglages de famille écrit dans le modèle existant, sans nouvelle table.
      *Quatre lectures et trois écritures, toutes sur des routes qui existaient déjà.*
- [x] Une seule grille d'assets dans tout le produit — celle-ci n'en est pas une seconde : elle
      range des sujets, pas des images.

### Bloquée par

- `B0`, `B8`

### Sa conception, jugée avant la première ligne

Le relevé, les décisions et la question posée à l'auteur — mal posée une première fois, en
jargon, avant d'être reformulée — ainsi que le découpage en sept morceaux sont dans
`docs/tranches/V4.md` § B9. *Écrits le 7 septembre 2026.* **Les sept morceaux sont tenus le
8 septembre 2026** ; le compte rendu est au même endroit.

---

## B10 · La page d'un sujet

**Planches** : `Fiche.dc.html`, `Images.dc.html`

### Ce qu'on livre

On arrive sur la chose, plus sur son atelier. Quatre onglets sur une seule page : sa fiche,
ses images, ses animations, l'essai. La fiche dit ce qu'il est, ce qui existe de lui, ce qui
lui manque avec le prix, et ce qu'il a coûté.

Ses images se rangent en rangées, une par direction, la retenue en tête. Et une rangée
« à confirmer » recueille les images faites avant que le jeu déclare ses directions.

**Vérifié** : les sept champs dont ce rangement a besoin sont déjà sur l'image — `favori`,
`supprime_le`, `cree_le`, `pose`, `direction`, `rang`, `epingle`. Rien à ajouter au serveur.

### Critères d'acceptation

- [x] La retenue est toujours en tête, quelle que soit sa date ; les gardées suivent en ordre
      chronologique et ne se réordonnent pas. — `rangerLaLigne`, et le départage est celui du
      serveur : entre deux retenues, la plus récente, comme `corps_retenu`.
- [x] Retenir une image en démote une autre, et l'écart n'efface rien. — ⚠️ **la démotion se
      fait à l'écran** : `PUT /assets/favorite` écrit un champ et ne touche pas les voisines.
- [x] Une direction vide se lit « à confirmer » et jamais « sud » ; un clic confirme. — le clic
      est dans le volet, seul endroit qui sache de quelle image on parle.
- [x] La case « + générer » ne défile jamais. — troisième colonne de la grille, hors de la
      piste ; tenu par la structure, pas par une position calculée.
- [x] Les calques d'une image sont ceux de cette image, pas ceux de la pose — changer la
      retenue ne réattribue pas ses calques. — filtrés sur `recette.difference.base`.
- [x] Passer d'un onglet à l'autre ne recharge pas le carnet. — l'onglet est un état de la
      page, pas un lieu de la pile ; l'essai compte les appels, et il n'en part aucun.

### Bloquée par

- `B0`, `B9`

---

## B11 · Ses animations, et le départage

**Planche** : `Animations.dc.html`

### Ce qu'on livre

Le même rangement que les images, pour les bandes. C'est littéralement le report de trois
colonnes : `favori` (laquelle sort dans le jeu), `rang`, `supprime_le` (l'écart, non
destructif). Aucune des trois n'existe sur la table des bandes ; les trois existent sur les
images.

Et l'écran qui s'en sert : les essais d'une même case, groupés par pose puis direction, et le
seul cas rouge du produit — une case où plusieurs essais existent et où aucun n'est retenu.

### Critères d'acceptation

- [x] Une seule bande est retenue par case (pose × direction), et retenir bascule en un geste.
      — même départage qu'`ImagesDuSujet.tsx` : le serveur ne démote pas
      (`PUT /strips/favorite` écrit un champ et ne regarde pas les voisines), l'écran démote
      avant de promouvoir, vérifié sur l'ordre des deux appels.
- [x] Écarter une bande ne la détruit pas : elle passe derrière la flèche, et la plus récente
      des gardées prend sa place. — ⚠️ **contrairement aux images**, ce repêchage n'a rien
      d'automatique côté serveur (pas de `corps_retenu` pour une bande) : l'écran appelle
      `PUT /strips/favorite` sur la plus récente des gardées juste après le
      `POST /strips/delete`, et seulement s'il y en a une.
- [x] Le tri par pose, direction et date ne demande aucune donnée nouvelle. — `cree_le`
      existait déjà sur `Bande`.
- [x] « À départager » est le seul rouge de l'écran. — même règle qu'`ImagesDuSujet.tsx` :
      à partir de deux bandes vivantes sans retenue.
- [x] Écarter une bande ne perd pas les retouches par frame qui lui sont attachées. — seul
      `supprime_le` change ; `prises`, `recette` et `chutier` restent identiques, vérifié à
      l'octet dans `tests/test_b11.py`.

### Bloquée par

- `B10` — tenue.

---

## B12 · L'essai

**Planche** : `Essai.dc.html`

### Ce qu'on livre

Le personnage joué au clavier, à la taille du jeu. Il marche, il court, il attaque, il regarde
dans les quatre directions. Une scène qu'on règle — fond, grille, sol — et un second sujet
qu'on pose à côté pour comparer les tailles en mouvement.

**Entièrement neuf.** Une vitrine existe et montre le personnage à la bonne taille, mais son
bouton *jouer* est éteint en dur. Aucun écran du produit ne fait bouger quoi que ce soit.

### Critères d'acceptation

- [x] Le personnage se pilote au clavier, et la vitesse jouée est celle qui sortira à l'export.
      *`Z Q S D` déplacent et tournent, `Maj` fait courir, `Espace` attaque, `1` à `6` jouent
      une pose ; l'écouteur est sur la scène et non sur `window`, donc `Ctrl+K` et `?`
      restent au carnet. La vitesse est `dureeImageMs(cadence)` (`interface/src/api.ts`), le
      double exact de `duree_en_ms` (`atelier/domaine/aseprite.py`) — **pas `1000/cadence`**,
      que les trois lecteurs d'avant emploient. Mesuré au navigateur sur l'atelier jetable :
      repos 124,4 ms pour 125 annoncées, marche 83,3 pour 83, course 71,0 pour 71, et
      **attaque 62,0 ms sur 80 images pour les 62 du descriptif** — c'est la cadence où
      `Math.round` aurait rendu 63. `tests/test_b12.py` fait tourner la vraie fonction de
      l'écran sous Node et la compare à celle du serveur sur 123 cadences.*
- [x] Une animation qui manque le dit et laisse le personnage au repos — il ne joue jamais une
      autre animation à sa place. *Vérifié au navigateur : `4` en regardant vers le sud écrit
      « attaque vers sud n'existe pas », le pèlerin joue toujours `repos-sud`, et la liste
      montre que l'attaque existe vers l'est sans y aller. Sans repos non plus, rien ne bouge
      et la scène le dit.*
- [x] Le bouton « demander un clip » part d'ici pré-rempli avec la pose et la direction, et son
      prix est annoncé. *Vérifié au navigateur : le bouton porte « attaque · sud », l'écran du
      clip s'ouvre sur « Animer Le pèlerin — attaque · sud », le mouvement *attaque* est
      choisi par le serveur, l'image de départ est le portrait retenu, et chaque modèle porte
      son prix — `≈ $0,0324`, `≈ 10 min sur votre carte · gratuit`. Rien n'a été commandé.*
- [x] La scène se règle sans rien fabriquer et sans rien payer. *Fond (gris neutre, clair,
      damier, la couleur du jeu), grille, cadre de la case, sol plat ou en pente, un deuxième
      sujet, le zoom, le clavier : **zéro appel réseau**, compté au navigateur en enveloppant
      `fetch`, et par essai (`EssaiDuSujet.test.tsx`). La barre qui paie se retire sur cet
      onglet — un seul bouton rouille par écran.*

### Bloquée par

- `B10`, `B11` — tenues.

---

## B13 · La grille du jeu, et comparer

**Planches** : `Grille.dc.html`, `Comparer.dc.html`

### Ce qu'on livre

Deux écrans qui répondent à la même question — *est-ce à la bonne taille ?* — et qui ne
demandent aucun chiffre neuf : ils montrent ensemble des nombres que le produit calcule déjà.

Le sujet posé sur les cases du moteur, avec ses voisins étiquetés de leur occupation. Et deux
sujets côte à côte, même pose, même fond, même zoom, avec l'écart chiffré et l'action qui le
corrige.

**Un calcul manque** : le plafond réel d'occupation dépend de la taille de case, parce que la
toile ne dépasse pas 2 048 pixels de côté. Sur une case de 512, le plafond n'est pas 800 % mais
400 %, et rien ne le dit.

### Critères d'acceptation

- [x] Le zoom est entier et rien d'autre : ×1, ×2, ×4, ×8. *Les deux écrans partagent le
      même jeu de crans (`ZOOMS = [1,2,4,8]`) ; vérifié par essai et au navigateur —
      `×3` n'existe sur aucun des deux, `×8` s'active bien (`aria-pressed`).*
- [x] Le plafond d'occupation affiché est celui que la taille de case permet vraiment.
      *`occupationMax(cible)` (`interface/src/api.ts`), le même calcul que le serveur
      (`occupation_max`, `atelier/domaine/recette.py:786`, testé par
      `tests/test_tailles.py`) — 800 % sur une case de 64, 400 % sur une case de 512,
      vérifié aux deux essais et au navigateur.*
- [x] Comparer deux sujets ne coûte rien et ne modifie rien. *`Comparer.tsx` ne prend que
      des props et n'appelle jamais `fetch` — vérifié par essai (`fetchDouble` non
      appelé) et au navigateur (`read_network_requests` pendant zoom, choix du second
      sujet et bascule de mode : aucune requête neuve).*
- [x] Un écart hors norme porte l'action qui le corrige, avec son prix quand elle en a un.
      *Hauteur/largeur hors case → « La retoucher », qui ouvre réellement l'outil sur la
      bonne image ; contour ou couleurs hors norme → le dernier coût réel de l'image
      (`cout_usd`), jamais un prix promis. Deux défauts trouvés en vérifiant au
      navigateur et corrigés avant tenue : un écart de contour ne comptait pas quand un
      seul des deux côtés en portait un, et « La retoucher » restait sans effet quand
      l'écart appartenait au second sujet — voir `docs/tranches/V4.md § B13`.*
- [x] Choisir deux fois le même sujet bascule en comparaison de deux de ses images.
      *Sélectionner le même sujet dans « Comparer avec » bascule le titre sur « Le même,
      deux fois » et fait apparaître les deux sélecteurs d'image — vérifié par essai et
      au navigateur (avec le repli honnête « aucune pose comparable » quand le sujet n'a
      qu'une seule image).*

### Bloquée par

- `B10`

---

## B14 · Les règles du jeu, en quatre étapes

**Planche** : `Nouveau-jeu.dc.html`

### Ce qu'on livre

Commencer un jeu en quatre étapes — son nom, son allure, sa vue, son monde — et le même
parcours, rouvert, **est** l'écran des règles du jeu. Le critère d'entrée est celui de
l'auteur : un réglage est ici s'il part avec la demande d'image, ou s'il décide de la façon
dont l'image est fabriquée. Rien d'autre.

**L'étape de la vue est neuve**, et c'est elle qui rapporte le plus. Aujourd'hui l'auteur peut
écrire « top-down » dans la ligne *vue* de la bible **et** choisir une vue dans un autre écran :
deux consignes de caméra dans le même envoi. Le produit s'en défend avec une liste de 22 mots
anglais tenue à la main dans `atelier/domaine/projet.py` — et son propre commentaire dit la
liste volontairement courte, pour ne pas faire disparaître une phrase non remplacée. Poser la
vue et le rendu à un seul endroit fait tomber deux des trois doublons, et la moitié de cette
liste.

**Ce qui sort du parcours, et où ça va** : la palette et les ambiances → la toile ; la couleur
de fond et le détourage de départ → l'atelier Détourer ; les natures, le plan de poses et le
modèle → la famille ; les emplacements de corps → la famille personnages ; la clé et les
49 modèles → l'installation.

### Critères d'acceptation

- [x] Chacune des quatre étapes se saute, et le jeu se crée sans en régler une seule. *Vérifié
      au navigateur en espionnant `fetch` : les trois derniers pas sautés d'affilée n'envoient
      **aucun** appel d'écriture, et `univers.vide` vaut `true` sur le jeu créé.*
- [x] L'écran montre le texte de caméra exact qui partira au modèle. *Il ne le recompose pas :
      `phrase`, `contrainte`, `volume` et `corps` viennent de `GET /api/universe/views`, et un
      essai serveur vérifie que ces chaînes-là sont littéralement celles qui atteignent le
      fournisseur. Relu dans le DOM au navigateur, identique au caractère près.*
- [x] Sans vue choisie, rien n'est écrit et l'écran le dit — le modèle décide seul. *Et le
      texte d'auteur ne comble plus le trou : avant `B14`, un jeu sans vue envoyait quand même
      la caméra que quelqu'un avait tapée dans la case, un jour, sans plus savoir où elle se
      réglait.*
- [x] Deux des trois doublons de consigne disparaissent, et un essai le mesure sur un envoi
      réel. *`rendu` et `vue` deviennent des cases de l'atelier (`CHAMPS_DE_L_ATELIER`) ;
      `_REDITES` passe de **vingt** mots à quatre — la planche en annonçait vingt-deux, et
      c'est le seul chiffre d'elle que le relevé corrige. Mesuré sur
      `FournisseurDouble.demandes[-1].prompt`, donc sur ce qui est arrivé au bout du port, pas
      sur un texte d'écran. Le troisième, `technique`, reste ouvert — la planche le dit
      elle-même, et deux essais le disent aussi.*
- [x] Deux jeux ne peuvent plus porter le même nom sans avertissement. *Un avertissement, pas
      un refus : le jeu est créé, il reçoit son dossier `-2`, et la phrase nomme **l'autre
      jeu**. Une règle (`deja_porte`), deux gestes — créer et renommer.*
- [x] Le dossier reste figé au nom de création, même si le nom change ensuite. *Acquis depuis
      toujours, et vérifié plutôt que supposé : `repere` dérive à la création, `renommer_projet`
      ne touche jamais `identifiant`, et l'essai le relit **sur le disque** après deux
      renommages.*
- [x] Le parcours rouvert écrit dans les mêmes réglages que le parcours de création. *Tenu par
      construction : un seul fichier, deux modes. Un essai compare les deux sur la route, la
      méthode **et le corps du message** — ils sont identiques.*

### Bloquée par

- `B0` — tenue.

### Sa conception, jugée avant la première ligne

Le relevé — qui a trouvé **trois** sources de caméra là où la planche en annonçait deux —, la
décision qui commande la tranche, les huit arbitrages et le découpage en quatre morceaux sont
dans `docs/tranches/V4.md` § B14. *Écrits le 9 septembre 2026.* **Les quatre morceaux sont
tenus le même jour** ; le compte rendu est au même endroit.

---

## B15 · L'installation

**Planche** : `Installation.dc.html`

### Ce qu'on livre

Ce qu'on branche une fois sur cette machine, et qui n'a jamais eu d'écran : le compte et la
clé, ComfyUI, le catalogue des 49 modèles, le dossier de travail, le cache des rendus.

**Aujourd'hui la clé se pose en éditant un fichier `.env` à la main, avant de lancer
l'application**, et rien dans l'interface ne le dit. ComfyUI n'est expliqué nulle part : l'écran
des modèles grise le moteur avec la raison « pas allumé » sans dire ce que c'est ni où le
prendre. Et le dossier de travail est fixé à côté de l'application, sans moyen de le déplacer.

### Critères d'acceptation

- [x] La clé se pose depuis l'écran, et le bouton de vérification annonce le nombre de modèles
      trouvés et la réserve. *`POST /api/install/check/{fournisseur}` compte le catalogue et lit
      le solde ; la phrase est « **N modèles trouvés · il reste $X sur ce compte** ». Aucun
      chiffre n'est écrit en dur — la planche en annonçait 49, la photo du catalogue en porte 51
      aujourd'hui. Vu au navigateur avec une clé explicitement fictive, et l'aperçu ne montre
      jamais plus de six caractères.*
- [x] Retirer une clé grise les modèles de ce fournisseur-là, et n'efface ni image ni dépense.
      *Acquis depuis `F3`, et **déjà mesuré** par
      `tests/test_f3.py::test_retirer_grise_ses_modeles_et_n_efface_rien` — non redoublé,
      cité. Revu au navigateur : le catalogue passe à « 2 grisés » et la mesure du disque ne
      bouge pas d'un octet.*
- [x] Un fournisseur injoignable grise ses modèles à lui, jamais ceux d'un autre. *Acquis depuis
      `F1`, mesuré par `test_ce_qui_manque_a_un_fournisseur_grise_ses_modeles_et_eux_seuls` et
      `test_couper_un_seul_fournisseur_ne_touche_pas_a_l_autre`. `B15` ajoute le cas de la
      vérification : `test_verifier_un_fournisseur_ne_dit_rien_de_l_autre`.*
- [x] ComfyUI se détecte, son adresse se change, et le téléchargement des poids reprend après
      une coupure. *⚠️ **L'adresse ne se changeait pas du tout avant cette tranche** : un
      commentaire de `maison.py` promettait `ATELIER_COMFY` depuis six jours, et rien ne la
      lisait. Elle se règle maintenant par l'écran ou par l'environnement, et **prend effet sans
      redémarrer** — le seul adaptateur gardé du dépôt est refabriqué quand son adresse ne
      correspond plus. La reprise après coupure était déjà faite à l'octet près (`.part` +
      en-tête `Range`) et déjà mesurée par `test_a11.py:695` ; elle a été revue à l'écran, où
      deux clics font 7 → 6 → 5 fichiers.*
- [x] Le dossier de travail se choisit, et l'écran dit ce qui s'y range. *Choisir **écrit une
      adresse et ne déplace rien** : l'atelier la lit au démarrage suivant, l'ancien dossier
      reste intact, et l'écran montre les deux chemins pour qu'une copie à la main soit
      évidente. Un dossier absent est refusé et le créer est un second geste ; un dossier déjà
      plein n'est pas un refus. Trois essais mesurent des **absences** — rien de déplacé, rien
      de copié, rien d'effacé, et aucune route d'installation qui efface.*
- [x] Sur une machine où rien n'a été déposé, une image arrive quand même. *Acquis depuis `F1`
      et mesuré par `test_sans_aucune_cle_le_defaut_glisse_vers_le_gratuit_et_l_image_arrive`.
      L'écran le dit désormais en toutes lettres, à l'étape 1 comme à l'étape 2 : le gratuit
      répond déjà, et il reste le filet quand le reste tombe.*

### Bloquée par

- `B0` — tenue.

### Sa conception, jugée avant la première ligne

Le relevé — qui a trouvé que le tiroir à secrets et le grisé par fournisseur étaient **déjà
entiers**, et que l'adresse de ComfyUI ne se réglait **pas du tout** —, la décision qui commande
la tranche (*on choisit un dossier, on ne déménage rien*), les dix arbitrages, le découpage en
quatre morceaux et les six défauts que le navigateur a trouvés sont dans `docs/tranches/V4.md`
§ B15. *Écrits le 9 septembre 2026.* **Les quatre morceaux sont tenus le même jour** ; le compte
rendu est au même endroit.

---

## B16 · Les tables dans la grammaire du carnet

**Planches** : `Retouche.dc.html`, les neuf `atelier-*.dc.html`

### Ce qu'on livre

La chaîne de retouche redessinée : sept tables dans l'ordre, plus les deux fabriques à droite
du trait. Les réglages hors de l'image, la raison écrite à côté de chaque grisé, une jauge
pendant le calcul, et le témoin avant/après.

Cette tranche n'ajoute **aucun moteur**. Elle range, et elle tranche six contradictions que le
relevé a trouvées en confrontant les fiches entre elles :

- Six traitements annoncés d'un côté, huit tables de l'autre — **deux tables n'avaient été
  relevées par personne** : le contour (`atelier/domaine/recette.py:975`) et la différence
  (`atelier/domaine/superposition.py`). Elles existent, elles marchent, elles ne sont
  documentées nulle part.
- Peut-on annuler un calcul ? Non : aucun moyen d'interrompre quoi que ce soit n'existe.
- La marge du recadrage reste active quand une case est posée, alors qu'elle ne fait plus
  rien — mesuré le 30 août : marge 0 et marge 40 rendent le même fichier à l'octet près.
- Le nettoyage affiche 3 et pose 0 : tant qu'on n'a pas touché le curseur, rien n'est nettoyé.
  Et la table des contours lit la même valeur comme un zéro.
- Un décor a-t-il un contour ? Deux relevés décrivent la même ligne, l'un l'approuve, l'autre
  la dénonce.
- La couleur de fond du jeu n'est pas lue par le détourage — `atelier/domaine/fond.py` n'est
  jamais importé par la recette ni par le traitement.

Et le plafond de 512 s'aligne sur les 2 048 du service, sans quoi un jeu en style dessin ne
peut poser aucune retouche.

### Critères d'acceptation

- [x] Les sept tables et les deux fabriques sont à l'écran, aucune n'est cachée. — **huit**
      tables : voir l'arbitrage 1, la septième manquait au comptage des planches.
- [x] Un réglage grisé porte sa raison écrite à côté, et le geste qui le débloque.
- [x] Une jauge apparaît pendant un calcul de plus de 240 ms, et jamais avant.
- [x] Un jeu en style dessin peut poser une retouche à 1 024 et à 2 048. — la route **et** la
      table : le plafond avait deux moitiés.
- [x] Les six contradictions sont tranchées, chacune par un essai.
- [x] Une place s'éteint sans se vider ; une coordonnée ne voyage toujours pas.

### Sa conception, jugée avant la première ligne

Le relevé a mesuré la chaîne côté serveur et côté écran avant d'écrire, et les six
contradictions ont été tranchées comme des décisions de produit — chacune écrite, chacune
tenue par un essai. Le compte-rendu complet, arbitrage par arbitrage, est dans
`docs/tranches/V4.md`, section `B16`.

Deux choses que le relevé n'avait pas prévues et que l'écriture a imposées : **l'écran neuf
doublait l'ancien au lieu de le remplacer** (l'ancien gardait le cadre de découpe, la colonne
des sœurs et les trois surfaces à coordonnées, que `B17`/`B18` devaient déménager et n'ont pas
faites), et **le plafond avait une seconde moitié à l'écran** — la table ne proposait que les
tailles du pixel art. ⚠️ **Le doublement a été rattrapé, pas par `B17`/`B18` mais par
`B23`-`B26`** : les quatre surfaces posées sur l'image entrent dans l'écran neuf en `B23`, les
cinq derniers locataires de l'ancien châssis en `B24`, et `Places.tsx`/`Tables.tsx`/`EcranTables`
quittent le dépôt en `B26` — l'écran neuf est depuis la seule implémentation de la retouche.

### Bloquée par

- `B0`

---

## B17 · Les moteurs qui remplacent une génération — **tenue le 10 septembre 2026**

**Planches** : `Retouche.dc.html`, `atelier-couleurs.dc.html`, `atelier-nettoyer.dc.html`

### Ce qu'on livre

Quatre traitements gratuits qui font aujourd'hui repayer une image :

- **Le lit de couleur sous la transparence.** Le détourage met les pixels du fond à zéro
  d'opacité et ne touche pas à leur couleur : chaque pixel vide du fichier porte encore du
  magenta. Invisible tant que le jeu affiche au pixel près ; dès qu'une image est réduite,
  tournée ou rangée dans une planche, le magenta remonte en liseré autour du sujet.
- **L'échange de couleurs.** Trois pèlerins qui ne diffèrent que par la couleur de leur cape
  coûtent aujourd'hui trois générations — et les trois sont trois silhouettes différentes. Une
  table de correspondance les rend identiques au pixel près, gratuitement.
- **Les curseurs de couleur avant la réduction.** Aucune trace de luminosité, contraste,
  saturation ou teinte dans `atelier/`. Un tirage revenu trop sombre part à la quantification
  tel quel, et les 24 couleurs du jeu sont dépensées à décrire une image mal exposée.
- **Le nettoyage du pixel de couleur et de l'escalier.** `nettoyer()` n'efface que des taches
  détachées, et seulement sur la transparence. Un pixel resté vert vif au milieu d'une robe
  brune est bien accroché au sujet : rien ne le voit.

### Critères d'acceptation

- [x] Un fichier exporté ne porte plus de magenta sous ses pixels transparents. *Le lit de
      couleur étale 3 px de la couleur du sujet vers l'extérieur, en fin de chaîne, et met le
      reste à zéro. **Il n'est le réglage de personne** : le critère est écrit sans condition, et
      en faire une place l'aurait laissé éteint sur les 61 recettes du dépôt. Il ne se pose
      toutefois que si une passe de détourage agit — on répare ce qu'on a cassé. Mesuré sur les
      fichiers rendus par `/download`, **contre un second atelier monté le moteur éteint** :
      2 sujets sur 5 en portaient, 0 sur 5 en portent, et le moteur repeint des pixels
      transparents sur les cinq. ⚠️ Les rendus **déjà calculés** gardent leur fichier : leur
      empreinte n'a pas bougé, ce que le critère n° 4 exige. Un `del` sur les `<rang>-rendu.png`
      à la fusion les refait, gratuitement et sans perte (`T2`).*
- [x] Une cape change de couleur sans une génération, et la silhouette est identique à
      l'octet près. *L'échange se pose **après** la quantification et ne lit jamais l'alpha ;
      deux capes différentes rendent la même silhouette à l'octet près. Une paire ne repasse
      jamais sur ce qu'une autre a posé : `brun → bleu` puis `bleu → vert` laisse le brun bleu.
      Il reste un seul cas où l'ordre des lignes décide — deux paires dont les tolérances
      attrapent le même pixel : la première le prend, un essai l'épingle, et l'aide le dit.*
- [x] Les quatre curseurs se posent avant la quantification, et un essai le vérifie sur
      l'ordre de la chaîne. *`test_les_curseurs_se_posent_avant_la_quantification_et_l_echange_apres`
      mesure l'ordre **sans lire le code** : une couleur échangée après la réduction survit là où
      elle serait repartie au plus proche, et sans les curseurs la cape tombe sur l'autre couleur
      de la palette.*
- [x] Les recettes existantes rendent la même empreinte qu'avant. *Les 61 recettes du corpus figé
      de `B1`, empreinte **et** JSON canonique caractère pour caractère. La règle de `B1` descend
      d'un cran : **une clé neuve dans une place existante ne s'écrit que remplie**. Sept essais
      vérifient l'inverse — une clé posée change bien l'empreinte, donc refait le rendu.*
- [x] Chaque moteur neuf est mesuré : temps de calcul, et ce qu'il épargne. *Sur une case de
      64 carrés : lit de couleur 0,49 ms, échange 0,19 ms, curseurs 0,09 ms, grain 0,22 ms,
      escalier 0,16 ms. La mesure est **bornée par un essai** — un moteur qui dépasserait les
      240 ms de `B16` fait échouer la suite. ⚠️ **Et la case de 64 ne dit pas tout** : les deux
      moteurs qui balaient l'image sont mesurés à part sur un dessin de 2 048, où ils coûtaient
      2,2 s et 7,4 s — ramenés à 188 ms et 400 ms, mémoire bornée à 101 Mo. Le garde-fou de cet
      essai-là est le **pic de mémoire**, qui ne dépend pas de la machine.*

### Bloquée par

- `B1` — c'est `B1` qui pose la règle « une place neuve ne change pas l'empreinte ».

### Sa conception, jugée avant la première ligne

Le relevé — qui a compté **dix-sept phrases du dépôt citant un rang de place**, et confirmé que
les deux planches rangent les quatre moteurs dans des tables **qui existent déjà** —, la décision
qui commande la tranche (*aucune place neuve : huit clés dans deux places*), le raisonnement du
morceau `[HARD]` et les deux défauts trouvés en construisant sont dans `docs/tranches/V4.md`
§ B17. **Les trois morceaux sont tenus le même jour** ; le compte rendu est au même endroit.

**Trois défauts trouvés, aucun par les essais de la tranche.** Le lit de couleur cassait
l'involution du miroir en choisissant *le premier voisin dans un ordre fixe* — attrapé par les
essais de `B1`, sans qu'un pixel visible ne bouge. **Toute image gratuite du produit s'affichait
« miroir · gratuit » depuis `B1`**, parce que le serveur omet la clé quand la place est vide et
que l'écran testait `!== null` — trouvé au navigateur, réparé en un caractère. Et **la table
d'échange était inutilisable**, le bouton qui l'ouvre posant une paire vide que le serveur
refusait : un défaut né de la couture entre deux moitiés justes, que seul le navigateur pouvait
voir — un essai d'écran le *figeait* même.

**Puis une relecture critique en a trouvé six autres**, dont un défaut de calcul que rien ne
mesurait : la matrice de teinte mêlait les constantes du filtre du W3C à la luma de Rec. 601 et
n'était plus une rotation. Remplacée par l'identité, **86 essais sur 87 restaient au vert**.
Les deux moteurs qui balaient l'image coûtaient par ailleurs des secondes sur un dessin de 2 048 —
7,4 s et 1,78 Go pour le grain, qui n'y change rien. Tout est réparé et mesuré ; le détail est
dans `docs/tranches/V4.md` § B17.

---

## B18 · Le reste des moteurs — **tenue le 8 septembre 2026**

**Planches** : les neuf `atelier-*.dc.html`

### Ce qu'on livre

Les 44 moteurs restants, atelier par atelier, chacun livré avec sa mesure. Ce n'est pas une
tranche : c'est **une file**, prise dans l'ordre où l'usage la réclame, et chaque atelier se
livre seul.

| Atelier | Existants | À écrire |
|---|---|---|
| Détourer | 13 | 0 — livrés : la couleur déclarée du jeu, la teinte plutôt que la valeur, la palette en garde-fou, le pinceau remonté en amont, la même passe sur les frames voisines |
| Recadrer | 13 | 0 — **tenu** : taille imposée, format verrouillé, calage sur multiple, centré sur la masse, ligne de pied, rognage d'un bord uni. Les six sont des champs neufs de `Recadrage` (`atelier/domaine/recette.py`), du calcul pur dans `atelier/image/traitement.py`, câblés à l'écran dans `ReglagesDuRecadrage` (`Retouche.tsx`), essai à `tests/test_b18_recadrer.py` |
| Pixéliser | 8 | 0 — **tenu le 8 septembre 2026**, voir la note sous le tableau |
| Couleurs | 7 + 9 | **0 — tenu le 8 septembre 2026** |
| Nettoyer | 4 | 0 — **tenu.** Sept moteurs neufs : garder le sujet seul, boucher les trous, reboucher les poches de fond, ronger puis regonfler, regonfler puis ronger, vote des voisins, la désignation à la main. Le détail est sous le tableau. |
| Retourner | 10 — **livrés le 8 septembre 2026** | 0 |
| Contour | 7 | 0 — **les six capacités tenues** (couleur dérivée, réserver la place, trait inégal, contour sur l'ensemble empilé, s'éteindre sur un sujet plein cadre, aperçu sur plusieurs fonds) |
| Découpe | 3 | 0 — **les gouttières, tenu le 8 septembre 2026** : `atelier/image/decoupe.py::gouttieres` lit la brute telle quelle, sans détourage — une rangée ou une colonne entièrement de la couleur du fond (`_couleur_du_bord`, la médiane de la bordure) est une gouttière, et ce qui reste entre deux gouttières est une case. ⚠️ **Le fond se lit à la médiane de la bordure, jamais à l'uniformité de la case elle-même** : un sprite qui se trouve être un aplat d'une seule couleur — fréquent en pixel art — serait sinon confondu avec une case vide. Troisième segment de « Détection » dans `Decoupe.tsx`, `ModeDecoupe` gagne `"gouttieres"`, et `duree_ms` (critère commun à `B18`) est mesuré et annoncé au-delà de 240 ms. |

**Détourer, livré.** Un cinquième moteur — `palette`, la palette en garde-fou — s'ajoute à
`atelier/domaine/recette.py::MOTEURS`, plutôt que quatre réglages qui n'auraient été que des
variantes de `bord` et `couleur` : c'est le seul, par construction, qui ne peut jamais manger le
sujet — `tests/test_d4.py` fige désormais le compte à cinq. Le fond et la
palette déclarés arrivent dans la recette **copiés par le service au moment du choix** —
`Univers.recette_de()` le faisait déjà pour `Quantification.palette` — jamais lus en direct
depuis `atelier/domaine/fond.py`, ce qui aurait recréé le couplage que `B16` a fermé
(`tests/test_b16.py`).

⚠️ **Deux réglages n'ont pas d'écran interactif dédié, et c'est voulu.** Le pinceau remonté en
amont (`Passe.traits`) se montre en ligne de statut dans `Retouche.tsx` — *« N passages du
pinceau posés sur cette image, avant le recadrage »* — le même traitement que le point de la
pipette et la forme entourée, qui ne voyagent déjà pas (invariant du lot U). La même passe rejouée
sur les frames voisines (`detourer_meme_passe`) n'a aucune route qui consomme aujourd'hui une
recette sur plusieurs frames à la fois ; elle est prouvée par essai serveur et par le banc de
`essais/atelier_jetable_b18_detourer.py` (mode `sans-servir`), pas par un geste cliquable — la
construire aurait demandé une route neuve hors du périmètre d'un réglage de détourage.

**Deux items ne rentrent pas dans le modèle actuel** et sont sortis de cette file : l'ombre
portée et le raccord de tuile. Le pipeline déduit la taille finale de la seule boîte opaque du
sujet — une ombre agrandit le canevas au-delà, et un raccord a besoin des pixels d'à côté.
Ce sont des changements d'architecture, pas des fonctions de plus.

### Recadrer — tenu, six décisions tranchées en écrivant

Les six intitulés de la planche étaient elliptiques ; tranché sans remonter, comme demandé.

- **Taille imposée** fait tenir le sujet *dans* `largeur × hauteur` en gardant ses proportions
  (`object-fit: contain`), jamais étiré — la planche dit « agrandi ou réduit pour tenir », pas
  « déformé ». `loger_dans` complète l'espace qui reste sur l'axe le plus court en transparent.
- **Format verrouillé** ne rétrécit jamais le rectangle déjà décidé par le sujet, la boîte
  tracée ou la marge : il grandit l'axe le plus court pour tenir le rapport (`carré`, `2:1`,
  `3:4` — les trois que la planche nomme), borné par l'image plutôt que de sortir du cadre.
- **Calage sur un multiple** n'avance que les bords bas et droit ; le coin haut-gauche, qui
  porte déjà la marge et le format, ne bouge pas. Paliers `8 · 16 · 32`, comme la planche.
- ⚠️ **Centré sur la masse ne change quelque chose que sur une taille imposée.** Le recadrage
  seul ne fabrique jamais de rectangle plus grand que le sujet — il n'y a donc rien à répartir
  tant qu'aucune taille de sortie n'impose un espace vide sur un axe. L'écran le dit quand
  `masse` est activé sans `taille`.
- **Ligne de pied** est en pixels de l'image d'origine, comme `boite` et le point d'une pipette
  — même famille de coordonnées, même raison : la place se lit tôt dans la chaîne. Elle déplace
  le rectangle sans changer sa hauteur ; elle ne s'hérite pas à la découpe (`decoupe.py`), pour
  la même raison que `boite`.
- **Rognage d'un bord de couleur unie** cherche le sujet par couleur (`boite_hors_bord_uni`,
  médiane de la bordure comme `_couleur_du_bord`) et sert de recours quand l'image n'a pas
  d'alpha utile — il ne remplace jamais `boite_opaque` quand l'alpha existe déjà.
- ⚠️ **La taille imposée est avalée par `Pixéliser` comme l'est déjà la marge.** Quand une case
  (`Grille`) est posée, elle refait sa propre recherche de boîte sur l'image déjà recadrée et
  rogne dessus — c'est le même mécanisme mesuré le 30 août 2026 pour la marge
  (`Recette.marge_sans_effet`). Non traité ici : recalculer et exposer cette interaction pour
  les six réglages neufs aurait dépassé une tranche `[EASY]` ; un `taille_sans_effet` symétrique à
  `marge_sans_effet` reste à écrire si l'usage le réclame.

**Pixéliser, tenu.** Les quatre moteurs manquants sont écrits dans
`atelier/domaine/recette.py` (`SUR_LE_MODELE`, `DOMINANTE`, `MEDIANE`, `LUMIERE_JUSTE`, dans
`METHODES_DE_REDUCTION`) et `atelier/image/traitement.py` (`_par_sur_le_modele`,
`_par_dominante`, `_par_mediane`, `_par_lumiere_juste`), câblés à l'écran par le même mécanisme
que les quatre premiers — `traitement.reductions` nourrit le segment « façon de réduire » de
`Retouche.tsx` sans qu'une ligne d'écran n'ait bougé. Vérifié au navigateur : les huit crans
apparaissent, aucun des quatre neufs n'est grisé, et chacun change vraiment le rendu servi
(mesuré en JS dans la page — `couleur dominante de case` ramène un grain de 28 pixels à deux
teintes exactes, `réduction douce en lumière juste` sort à 166 de gris moyen contre 128 pour
`réduction douce` sur le même damier contrasté).

Deux décisions tranchées en écrivant la tranche :
- **`sur les carrés du modèle`** rejoue `retrouver_grille` (D2/D4) plutôt que d'inventer une
  seconde mesure de grille — c'est la fonction que la planche réclame déjà, simplement jamais
  appelée depuis la réduction. Sans grille détectée, elle retombe sur le vote en deux temps.
- **`couleur dominante de case`** et **`médiane de case`** rognent la source à un multiple exact
  du pas plutôt que de la rééchantillonner d'abord (comme le fait le vote) : les deux promettent
  de ne jamais peindre une couleur absente de l'image, et un rééchantillonnage Lanczos en
  mélange déjà avant que la case ne soit choisie.

⚠️ **« Trois réglages figés dans le code de la réduction » — non tenu, documenté plutôt que
bâclé.** L'épaisseur des traits de `traits épaissis` (figée à 2), le nombre de teintes de
travail du vote (figé à 32) et le choix de silhouette majorité/centre (décidé dans le code selon
qu'il s'agit d'une bande ou d'une image seule) restent sans réglage d'écran. Les exposer
demande des champs neufs sur `Grille` — donc une empreinte de recette qui bouge, la même
prudence que `B17` a payée sur ses six clés de `Quantification`/`Bords` — et cela déborde du
lot « quatre moteurs neufs » confié à cette tranche. Laissé à qui reprendra ce critère.

**Retourner, tenu le 8 septembre 2026.** Les neuf moteurs neufs — `atelier/domaine/recette.py`
(`SENS`, `Retournement`), `atelier/image/traitement.py` (`retourner` et ses dix branches),
câblés à l'écran dans `Places.tsx`/`Retouche.tsx`. `tests/test_b18_retourner.py` les prouve un
par un sur de vraies images (dimensions attendues, pixels effectivement déplacés) ; les essais
de `test_b1.py` restent verts, deux d'entre eux mis à jour pour compter dix sens au lieu d'un —
voir le commit.

**B18 compte huit noms pour neuf moteurs**, « quarts de tour » y étant écrit au pluriel — il en
désigne deux, le droit et le gauche. C'est bien **dix** moteurs en tout dans la planche, un déjà
livré par `B1` — le compte que `SENS_A_AJOUTER` (posé par `B1`, maintenant vidé) portait déjà
correctement.

⚠️ **Zones protégées, geste minimal** — « miroir, sauf ici » est un moteur réel côté serveur (un
`Trait` par zone, le même pinceau que la main), mais l'écran ne sait encore que poser une zone
ronde au centre de l'image, pas la peindre du bout du doigt à l'endroit voulu. Peindre une zone
demande le même geste de canevas que la huitième place (`Retouche.tsx`), hors du périmètre de
cette file.

⚠️ **Repli, réglages partiels** — l'axe et la moitié gardée sont posables à l'écran ; le curseur
qui fait glisser l'axe sur l'image, décrit par la planche, ne l'est pas encore.

#### Contour — les six capacités, tenues

Ajoutées à `atelier/domaine/recette.py::Contour` (`derivee`, `reserver`, `inegal`, `sur_calques`,
`desactive_plein_cadre`) et à l'engin de `atelier/image/traitement.py::contourner` ; câblées à
l'écran dans `interface/src/composants/Retouche.tsx::ReglagesDuContour` et
`interface/src/composants/Places.tsx::PanneauContours`. Essais réels dans
`tests/test_b18_contour.py`.

- **Couleur dérivée** — chaque pixel du trait prend la teinte du bord le plus proche, assombrie
  de 35 % (`ASSOMBRISSEMENT_DERIVE`), au lieu d'une couleur fixe partout.
- **Réserver la place** — `reserver` prime sur `position` : la case ne grandit jamais. ⚠️ **Ce
  n'est pas ce que la planche décrivait** (« poser le sujet 2 px plus petit à l'étape de la
  grille »). Le geste décrit demanderait de coordonner Contour avec Grille/Pixéliser — un autre
  atelier de cette même file, en cours en parallèle — et le pipeline actuel ne fait pas circuler
  cette information entre places. Tenu à la place : la case reste fixe en mangeant l'épaisseur
  sur le bord (même résultat que `position: dedans`, mais choisi automatiquement quel que soit
  le réglage de position). Vrai « réserver en amont » reste à écrire le jour où Grille le porte.
- **Trait inégal** — dégradé d'alpha du haut (quasi rien) vers le bas (plein), et la dernière
  rangée de l'anneau ne reçoit jamais le trait (pas de « semelle » sous les pieds).
- **Contour sur l'ensemble empilé** — `contourner_empile` compose des calques (le dessus gagne
  partout où il est opaque, comme `atelier/image/calque.py::superposer`) puis trace sur la
  silhouette de l'union. ⚠️ **Câblé, effet non observable en pratique aujourd'hui** : le réglage
  `sur_calques` part bien au serveur et le moteur existe et est testé sur de vraies images, mais
  aucun écran ne fournit encore à la retouche d'un asset les calques d'un porteur (ça suppose de
  brancher `B19`/`B20` — le vestiaire et les calques d'animation — jusqu'à cet endroit). Tant
  qu'un seul calque est connu, `sur_calques` ne change rien au rendu.
- **S'éteindre sur un sujet plein cadre** — actif par défaut (`desactive_plein_cadre=True`) :
  un sujet qui touche les quatre bords de l'image sur toute leur longueur ne trace plus de
  trait, même s'il n'est pas *entièrement* opaque (une tuile texturée). Celui-ci est câblé de
  bout en bout et se vérifie au navigateur.
- **Aperçu sur plusieurs fonds** — `apercu_sur_fonds` (herbe/pierre/eau) existe et est testée
  côté serveur ; à l'écran, la même idée est rendue **en CSS** plutôt qu'en rappelant le serveur
  à chaque clic (le PNG rendu porte déjà son alpha, poser un fond derrière est instantané et
  gratuit) — décision prise pour la fluidité, documentée ici plutôt que devinée en relisant le
  diff.

⚠️ **Nettoyer, le compte tranché.** La planche (`docs/pistes-2026-09-04/carnet/
atelier-nettoyer.dc.html`) se contredisait trois fois sur le compte des moteurs : douze en
préambule (c'est en fait le compte des *réglages*, douze aussi, pas celui des moteurs), onze
dans le réglage « méthode » (le total, existants compris), neuf dans le détail des cartes
« Les moteurs » (`— 2 sont là, 9 restent à ajouter`). **Le compte du détail a été retenu** —
c'est le seul qui corresponde à des cartes réellement décrites une par une plutôt qu'à une
phrase de synthèse, et c'est celui que `docs/PLAN-carnet-affectation.md` portait déjà.

**Et en relisant le code avant d'écrire une ligne, deux des neuf se sont révélées déjà
posées.** « Médiane des couleurs » est `Bords.grain_min` et « Décrocher les pixels de coin »
est `Bords.lissage` — les deux réglages neufs livrés par `B17` sous d'autres noms que ceux de
la planche, qui datait du 4 septembre et ne les connaissait pas encore. **Sept moteurs neufs
ont donc été écrits, pas neuf** : `garder`, `boucher_jusqua`, `reboucher_jusqua`,
`ronger_regonfler`, `regonfler_ronger`, `vote_voisins`, et `designations` (qui réunit à elle
seule trois cartes de la planche — *« cliquer une tache dans l'image »*, *« effacer une tache
d'un clic »*, *« à la main, une miette à la fois »* — en un seul mécanisme point + effacer/
protéger, plutôt que d'en écrire trois qui referaient la même chose). Compte final : quatre
moteurs existants avant `B18` (deux de la planche, deux de `B17`), sept écrits ici, onze en
tout — ce qui recoupe enfin le « onze » du réglage « méthode » de la planche elle-même.

**Aucune « méthode » à choisir n'a été ajoutée.** La planche imaginait un sélecteur unique
parmi onze manières, mais `B17` avait déjà tranché autrement pour `grain_min` et `lissage` —
un champ par moteur dans `Bords`, actif dès qu'il est posé, neutre à zéro. `B18` continue
cette forme plutôt que d'en ouvrir une seconde : deux modèles pour la même table auraient fini
par se contredire, exactement comme le compte de la planche s'est contredit lui-même.

### L'atelier **Couleurs** — tenu le 8 septembre 2026

**L'architecture, posée avant la première ligne** : *un algorithme de quantification de palette
choisit des couleurs, il ne peint rien.* Une interface commune —
`(pixels (N,3), couleurs) ▸ palette (K,3)`, `K ≤ couleurs` — et trois implémentations : coupe
médiane, k-moyennes, découpe en huit. **La carte des pixels sur la palette, le tramage, la
distance et les couleurs gardées sont écrits une fois** dans `atelier/image/palette.py` et
valent pour les trois. Sans cet invariant, « distance à l'œil » aurait eu trois implémentations
qui auraient fini par ne plus répondre pareil sur la même image ; quatre essais le mesurent
sans lire le code.

**Neuf moteurs livrés**, avec leur réglage à l'écran dans les deux écrans de la retouche —
l'ancien (`Places.tsx`) comme le neuf (`Retouche.tsx`), la règle que `B17` a posée le temps du
déménagement :

1. **la trame régulière** — une trame ordonnée de 4×4, qui pose ses points toujours au même
   endroit : le semis de Floyd se recalcule à chaque frame, donc l'herbe grésille ;
2. **la force du tramage** — de 0 à 100 % ;
3. **k-moyennes**, avec sa graine écrite dans la recette ;
4. **la découpe en huit** (octree) ;
5. **la distance à l'œil** (OKLab) contre la distance brute ;
6. **ne compter que les pixels qu'on voit** ;
7. **les couleurs gardées** — au plus six, jamais fondues avec une voisine ;
8. **les rampes d'ombre** — la palette rangée par familles, du plus sombre au plus clair ;
9. **« 24 demandées, 14 obtenues »** — le compte que la planche appelle *le seul chiffre qui
   explique pourquoi monter le réglage ne change plus rien*.

⚠️ **La planche nomme neuf moteurs « à ajouter », mais `B17` en avait déjà tenu deux** — les
quatre curseurs de teinte / saturation / luminosité / contraste, et le remplacement d'une
couleur par une autre. Sept des neuf restaient donc à écrire. Les deux places rendues à la
liste sont les couleurs gardées et le compte obtenu, que la planche marque « à ajouter » dans
sa table des réglages sans les compter parmi ses moteurs. **Le compte de neuf est donc tenu,
mais ce ne sont pas exactement les neuf de la liste des moteurs** ; c'est le seul écart de
périmètre de l'atelier.

⚠️ **Le neutre d'un réglage n'est pas ce que la planche affiche comme défaut**, et l'écart est
délibéré. La planche donne « à l'œil » et « oui » pour défauts, et 0 pour la force du tramage.
Le neutre d'une clé neuve, lui, est *la valeur pour laquelle une recette écrite avant la tranche
rend exactement l'image qu'elle rendait* — sans quoi les 61 recettes du corpus figé changeraient
d'empreinte, donc de nom de rendu, et tout leur cache se recalculerait. Les champs retombent
donc sur `brute`, `non`, et **100 pour la force** (le tramage d'aujourd'hui est plein). C'est
l'arbitrage exact de `D2` pour `Grille.methode`. ⚠️ **Et la distance en reste à `brute` pour
une recette neuve aussi** : une constante `DISTANCE_LIVREE` valant `oeil` avait été écrite,
mais rien ne la lisait — ni le corps du port, ni l'écran — et elle annonçait donc un défaut
produit qui n'existait pas. Elle est retirée ; le jour où l'on voudra vraiment livrer `oeil`,
c'est le corps du port et `quantificationDe` qu'il faudra changer, et ce sera visible.

⚠️ **`reglages_de_b18_neutres` doit compter le tramage, qui n'est pourtant pas une clé neuve.**
`trame` est une *valeur* neuve d'une clé qui existait, et l'oublier a coûté un défaut réel,
attrapé par les essais : la trame partait sur le chemin d'avant, où Pillow ne la connaît pas, et
retombait en silence sur « aucun tramage ». Le réglage était posé, déclaré, validé — et sans
effet, très exactement le mensonge que le commentaire de `TRAMAGES` raconte à propos de `bayer`.

⚠️ **Un défaut trouvé dans Pillow, et il n'est pas de nous.** Sous une palette imposée,
`Image.quantize(palette=…)` ne cherche pas exactement la couleur la plus proche : il passe par
un cache approché. Mesuré sur un dégradé de 64 carrés et une palette de quatre couleurs,
**1,9 % des pixels partent sur la mauvaise couleur** — un rose clair envoyé sur le brun alors
que le blanc est plus proche. Les deux chemins de `quantifier` ne rendent donc pas tout à fait
la même image sous palette imposée, et **c'est le chemin neuf qui a raison**. Un essai l'épingle
plutôt que de le taire ; faire passer tout le monde par la carte maison est une décision
d'après, parce qu'elle changerait des rendus déjà calculés.

⚠️ **Le seuil de gris des rampes est mesuré, et un premier choix était faux.** Le chroma d'OKLab
s'effondre avec la clarté : un seuil absolu rangeait les bruns sombres avec les gris, et un
premier seuil relatif à 0,10 rangeait encore un tan clair à 0,0985. Mesuré sur dix-sept
couleurs, le rapport chroma/clarté tombe dans un trou franc — les gris à 0,000–0,026, les
couleurs à 0,098–0,227 — et le seuil est posé au milieu, à 0,06. **Trouvé en regardant les
rampes de l'atelier jetable, pas par un essai** ; un essai les tient maintenant tous les deux.

**Les mesures, sur une case de 64 carrés** — la taille où le produit quantifie réellement, la
place `quantification` venant après la grille : coupe médiane 3,9 ms, trame régulière 13,4 ms,
couleurs gardées 13,6 ms, distance à l'œil 14,7 ms, trame à 30 % 17,7 ms, octree 10,8 ms,
k-moyennes 76,8 ms. Toutes sous les 240 ms de `B16`, et un essai le borne.

⚠️ **Un seul moteur dépasse le seuil, et par construction** : la diffusion d'erreur *à force
réduite*. Floyd-Steinberg est le seul algorithme de l'atelier qu'on ne peut pas écrire en
tableaux — le voisin de droite doit avoir reçu l'erreur du pixel courant avant d'être décidé —,
donc la boucle est irréductible en Python : 143 ms sur une case de 64, une seconde sur 256, et
treize sur 1 024. **À pleine force ce chemin n'est jamais pris** (Pillow diffuse en C et rend la
même image), et c'est de loin le cas courant ; la boucle ne sert qu'à ce que Pillow ne sait pas
faire — doser la force, et mesurer à l'œil. La jauge de `B16` l'annonce, et un essai garde le
chiffre pour qu'une accélération future se mesure contre lui.

**Deux accélérations ont été nécessaires pour tenir le seuil**, et aucune n'est une
approximation : la carte des pixels se calcule **par couleur distincte** et non par pixel
(un million de pixels, trente mille couleurs), et k-moyennes pondère les couleurs distinctes par
leur population au lieu de faire glisser cent mille fois le même pixel. Les deux rendent le même
résultat à l'octet près — ce sont des factorisations.

⚠️ **Un défaut de mémoire trouvé à la relecture, et il cassait pour de bon.** `_plus_proches`
ne découpait en blocs qu'un seul de ses deux axes. Tant que les cibles sont la palette — au plus
256 couleurs — ça suffit, et c'est le cas de la carte des pixels. Mais les trois algorithmes
appellent la fonction **à l'envers** pour ramener leurs couleurs calculées sur des couleurs
réelles : la palette d'un côté, *toutes les couleurs distinctes de l'image* de l'autre. Rien ne
bornait ce côté-là. La coupe médiane, seule des trois à ne pas passer par `_echantillon`, y
montait à **9,7 Go** sur un rendu de 2 048 px — un `MemoryError` sur une machine à 8 Go, une
attente de plusieurs dizaines de secondes ailleurs, dès que l'auteur posait un réglage de
*Couleurs* sur un asset sans grille. Deux réparations, mesurées : les **deux** axes se découpent
maintenant (c'est leur *produit* qui borne la mémoire, jamais un seul côté), et la coupe médiane
passe par `_echantillon` comme les deux autres. Mesuré sur une image de bruit à 512 px
(260 000 couleurs distinctes) : **1 603 Mo avant, 240 Mo après** ; à 2 048 px et 3,7 millions de
couleurs distinctes, les trois algorithmes tiennent ensemble sous **369 Mo**. Deux essais tiennent
la réparation — un sur le pic de mémoire, un sur l'égalité rang par rang entre le calcul par
blocs et le calcul d'un seul tenant, égalités comprises.

**Ce que la réparation change à l'image, et c'est mesuré.** Soixante rendus rejoués avec l'ancien
code et le neuf dans le même processus : **48 identiques à l'octet près**, et les 12 qui diffèrent
sont tous la coupe médiane sur une image de **plus de 300 000 pixels** — c'est-à-dire exactement
le plafond de `_echantillon` qui s'applique enfin, comme il s'appliquait déjà à k-moyennes et à
l'octree. En dessous du plafond, rien ne bouge ; la palette imposée, k-moyennes et l'octree ne
bougent nulle part. Aucune recette du disque n'est touchée : le corpus figé passe par le chemin
Pillow d'avant, et les réglages de `B18` ne sont posés dans aucune recette existante.

**Deux rendus complets par lecture d'une table, et ils sont tous deux nécessaires.** La route des
mesures rend l'image *arrêtée avant les bords* — c'est celle que le seuil va trancher —, et
`_couleurs_de` rend l'image *finale*, parce que le compte « obtenues » décrit ce qu'on a et non
ce qu'un réglage fera. Deux recettes différentes, donc deux images différentes : vérifié à la
relecture, ce n'est pas un calcul en double.

### Critères d'acceptation

- [x] Chaque atelier livré porte tous ses moteurs à l'écran, et aucun n'est en dur dans le code
      sans réglage. *Vrai pour Détourer, Recadrer, Pixéliser, Découpe, Retourner, Contour,
      Nettoyer et Couleurs — les huit livrés dans la file. Pour Couleurs, vérifié au navigateur
      sur l'atelier jetable du port 8491 : k-moyennes rend à la grenouille le vert franc que la
      coupe médiane noie, la trame pose un damier régulier là où il y avait des aplats, la force
      le dose (25 % laisse les aplats propres, 70 % les remplit), la graine ne paraît qu'avec
      k-moyennes.*
- [ ] Trois réglages figés dans le code de la réduction sortent enfin à l'écran. *Non tenu, voir
      la note sous Pixéliser ci-dessus.*
- [x] Chaque moteur neuf porte sa mesure de temps, et l'écran l'annonce quand elle dépasse
      240 ms. *Vrai pour les quatre moteurs de Pixéliser (26 à 108 ms sur une case de 64), pour
      les dix sens de Retourner (RotSprite mesuré à ~1,3 s sur une planche de 1024 px, seul des
      dix à dépasser le seuil), pour les sept moteurs de Nettoyer (moins de 4 ms chacun sur une
      case de 64) et pour les neuf moteurs de Couleurs (3,9 à 76,8 ms sur une case de 64 ; seule
      la diffusion d'erreur à force réduite dépasse, par construction, puisqu'elle ne peut pas
      s'écrire en tableaux) ; la jauge qui les annonce est le mécanisme générique déjà posé,
      commun à tout `PUT …/recipe`.*
- [x] Les 1 347 essais de serveur passent sans modification. *Chiffre d'une version antérieure du
      plan ; le compte a grandi à chaque atelier livré (plus de 2 000 après
      Détourer/Recadrer/Pixéliser/Découpe/Retourner/Contour/Nettoyer/Couleurs). Quatre essais
      existants ont dû changer pour refléter un compte qui grandit par construction —
      `tests/test_t2.py` (quatre méthodes de réduction devenues huit), `tests/test_b1.py` (un
      sens de retournement devenu dix), le compte d'entrées de `AIDE` dans `App.test.tsx`, et
      l'assertion sur le compte obtenu dans `tests/test_b18_couleurs.py` — même règle que
      `tests/test_d2.py` applique déjà à trois essais de `T2`/`T4`. Les 61 recettes du corpus
      figé de `B1` gardent leur empreinte au caractère près. ⚠️ **Un seul rouge côté écran, et il
      est antérieur à la tranche** — `App.test.tsx` › `A7 · une recette enregistrée ne jette pas
      la main d'une image` attend 48 couleurs et en lit 24. Vérifié à plusieurs reprises en
      remisant les fichiers d'écran de chaque atelier : il échoue à l'identique sans eux. Il
      n'appartient à aucun atelier de cette file et n'a été touché par aucun.*

### Bloquée par

- `B16`, `B17`

---

## B19 · Le vestiaire

**Planches** : `Emplois.dc.html`, `Emploi.dc.html`, `Main.dc.html`

### Ce qu'on livre

La relation qui manque au modèle, et les trois écrans qu'elle débloque. Aujourd'hui une pièce
d'équipement n'appartient à personne : toute pièce créée dans un jeu est disponible sur tout le
casting, et il n'existe nulle part de moyen de dire le contraire. C'est ce qui rend l'écran
Équipement illisible — il n'a personne à qui rattacher ce qu'il montre.

Trois griefs d'usage tombent d'un coup : l'écran Équipement devient une liste, la fiche d'un
personnage gagne son vestiaire en images, et la colonne « ce que l'entité réclame » cesse de
lister l'équipement du jeu entier pour chaque personnage.

Puis les emplois : l'épée portée par trois personnages, posée au sol, plantée dans un rocher,
son icône — chacun avec ses propres images, et sa matrice de calques.

**Vérifié** : l'emplacement, la portée *contenue*/*agrandit* et ses deux valeurs (92 % / 62 %)
existent déjà. C'est le lien vers un personnage qui manque, et lui seul.

**Corrigé en tenant la tranche** : la « matrice de 24 calques » n'existe pas et ne pouvait pas
naître ici — un calque n'a de direction nulle part dans le code, et 24 = 6 poses × 4 directions
est une addition de la planche. La matrice d'un emploi est **une rangée par pose** ; l'axe des
directions revient à `B20`. Et la perte silencieuse qu'il fallait craindre n'était pas dans la
lecture du disque mais dans `regler_piece`, qui reconstruisait une pièce champ par champ.

### Critères d'acceptation

- [x] Une pièce créée depuis la fiche d'un personnage lui est attribuée d'emblée.
      *`ajouter_piece(..., porteur)` naît déclarée avec son emploi ; vérifié par essai et au
      navigateur — « Bâton de sorcier » nommé sur la fiche du magicien remonte
      `declare: true, emplois: ["le-magicien"]` et apparaît aussitôt dans son vestiaire.*
- [x] Une pièce ne porte personne par défaut. *Nommée hors d'une fiche, elle naît **déclarée
      vide** (`emplois == ()`) — pas indéterminée : rien ne se déduira jamais dessus. Vérifié
      au navigateur sur « Casque de fer », créé sans porteur et sans calque : « aucun emploi ».*
- [x] Les emplacements de corps restent au jeu, jamais au personnage. *Acquis par construction
      — ils vivent sur `Projet`, et `Personnage` n'en porte aucun ; l'essai le mesure quand
      même, parce que c'en est un critère.*
- [x] Les pièces déjà écrites sur le disque se relisent sans perte et sans porteur. *Trois
      plans d'essai séparés : la lecture (les porteurs viennent des calques, pas du fichier),
      la réécriture (**identique à l'octet**, la clé `emplois` reste absente — mesuré sur les
      octets réels de `donnees/projets/test-v2/projet.json`), et le service (renommer une pièce
      ne perd pas ses emplois — le vrai vecteur de perte, trouvé au relevé dans `regler_piece`).
      Vérifié en vrai sur `essais/atelier_jetable_b19.py`, qui efface la clé du disque **et** de
      la colonne SQLite avant de servir : après une session entière de lecture, de navigation et
      de gestes, les deux pièces non touchées n'ont toujours aucune clé `emplois`.*
- [x] Un calque reste solidaire de sa pose — l'invariant de `C3` tient. *La matrice d'un emploi
      est **une rangée par pose**, et non la grille de 24 de la planche : un calque ne porte de
      direction nulle part dans le code. Un essai verrouille la décision ; l'axe des directions
      revient à `B20`.*
- [x] Les 19 entrées du guide rangées sous `fabriques` trouvent leur écran. *Les **17** entrées
      que le dépôt porte réellement ont leur écran ; l'écart entre 17 et 19 est dans le plan,
      pas dans le code, et il est noté tel quel dans `interface/src/aide.ts`.*

### Bloquée par

- `B10`

---

## B20 · Les calques d'animation — **tenue le 10 septembre 2026**

**Planche** : `Emploi.dc.html`

### Ce qu'on livre

Un calque déjà obtenu se recale sur chaque image d'une animation, gratuitement, sur la
machine. C'est le seul chemin pour qu'un personnage équipé bouge.

**Vérifié** : une bande porte le projet, le personnage, la pose et la direction. Elle n'a
aucun champ *pièce*, et les mots *pièce* et *équipement* n'apparaissent nulle part dans toute
la couche animation. Le calcul de recalage, lui, existe déjà — c'est
`atelier/image/calque.py::proposer`, écrit en `M1`, et il n'a pas été retouché d'une ligne.

**La géométrie, tranchée en tenant la tranche.** L'axe des directions que `B19` renvoyait ici
entre — et il entre **sans toucher aux calques**. Un calque reste solidaire de sa pose ; c'est
la **bande** qui porte la direction, depuis `A10`. Habiller les quatre bandes d'une pose relit
donc quatre fois *le même* calque, et l'écran rend la grille de vingt-quatre rangées de la
planche sans qu'aucun des dix-huit calques supplémentaires n'ait à exister. Le seul endroit du
module qui va chercher une image cherche par *(pièce, personnage, pose)*, jamais par direction :
`ServiceCalquesAnimes._calque_de`.

**Une bande habillée est une bande à elle**, comme un calque est un asset à lui (`C3`). La
symétrie n'est pas décorative : elle a obligé à poser le `piece IS NULL` de `C3` à deux
endroits de la couche animation — `Base.bandes_par_pose` et `ServiceProduction.cases()` —, sans
quoi habiller une marche aurait rempli la case *marche* une seconde fois.

### Critères d'acceptation

- [x] Une bande porte sa pièce, et une case sans animation du personnage reste vide sans
      compter comme un manque. *`Bande.habillage` porte la pièce, la tenue et le calage à la
      main ; `Bande.piece` s'en déduit et devient une colonne du rangement. Le compte de la
      matrice exclut `sans-animation` — **il n'y a rien à habiller, et aucun clic ne le
      changerait**. Vérifié au navigateur sur le goliath : 24 rangées, `2 sur 6 · 18 sans
      animation`, et la ligne « Attaque » porte son calque, dit « rien à habiller » et
      **n'offre aucun bouton**.*
- [x] L'écran distingue « le calque tient » (recalé image par image) de « le calque glisse »
      (un seul calage pour toute la bande). *Et la distinction est mesurable, pas
      déclarative : sur le clip d'essai — où le corps descend d'image en image — *tient* rend
      `dy = [1, 7, 10, 13, 16, 16, 16, 16]` et *glisse* rend `[1]` huit fois. Mesuré au
      navigateur sur les images habillées elles-mêmes, pas seulement sur les nombres.*
- [x] Le recalage ne coûte rien et ne rappelle aucun fournisseur. *Vérifiable plutôt
      qu'affirmé : `ServiceCalquesAnimes` ne reçoit **ni catalogue, ni fournisseur, ni
      animateur** — la privation du montage, pour la même raison. Trois essais le mesurent (le
      double ne reçoit aucun appel, aucune génération n'est créée, le service n'a pas les
      attributs), et l'atelier jetable compte les générations avant et après quatre
      habillages : écart 0.*
- [x] Un calage gardé à la main se réutilise sur la pièce suivante. *`ReglagesGardes` (`M1`)
      réemployé tel quel, gardé sur la bande **nue** — celle du corps que toutes les pièces
      partagent — et non sur l'habillée. Vérifié au navigateur : `1,15 / +5 / −4` posé sur
      l'épée, repris par le casque de fer sur la même animation, **et chaque pièce lit son
      propre calque**. Une bande nue jamais touchée, elle, recale bien de zéro.*

### Bloquée par

- `B11`, `B19`

---

## B21 · La sortie

**Planche** : `Sortie.dc.html`

### Ce qu'on livre

Un seul écran d'export, là où il y a aujourd'hui quatre gestes disjoints qui ne se parlent
pas : exporter un personnage, exporter ses animations, exporter une sélection de la galerie,
exporter une bande. On choisit ce qui sort, où, comment c'est rangé, ce qu'on fait des
doublons, et pour quel moteur.

**Trois choses n'existent nulle part dans `atelier/`** : la prévisualisation avant écriture
(aucune route ne dit ce qui sortirait sans l'écrire), le diff avec la sortie précédente (rien
n'est mémorisé d'une fois sur l'autre), et le fichier de catalogue par moteur.

**Ce qui existe déjà et qu'il ne faut pas refaire** : les PNG à plat avec leur descriptif, la
planche de sprites, le fichier d'accompagnement au format Aseprite (emprunté clé pour clé, on
n'y ajoute rien) et l'image animée de prévisualisation.

### Critères d'acceptation

- [x] L'arbre des fichiers se lit avant d'écrire, avec le compte et le poids total.
- [x] Chaque fichier est marqué nouveau, remplacé ou inchangé face à la sortie précédente.
- [x] Les quatre modes de collision existent, et « remplacer » en est un.
- [x] Un panneau dit ce qui n'est pas prêt : sujets sans image, personnages à direction unique,
      animations vides.
- [x] La sortie reste gratuite et fonctionne réseau coupé.
- [x] Le format Aseprite ne gagne aucune clé de notre cru.

> **Tenue le 10 septembre 2026.** `atelier/domaine/sortie.py` (le vocabulaire et ses cinq
> listes fermées), `atelier/services/sortie.py`, `atelier/api/sortie.py`,
> `interface/src/composants/Sortie.tsx`, `tests/test_b21.py`, `essais/atelier_jetable_b21.py`
> (port 8486).
>
> **Ce qui a été tranché en cours de route**, et qui s'écarte de la planche :
>
> 1. **Le diff se lit sur le dossier, pas sur une mémoire.** *Ce qui est là fait foi* est un
>    invariant du dépôt, déjà écrit dans l'export lui-même. Un fichier abîmé à la main dehors
>    se dit donc « remplacé » sans que rien n'ait bougé dans l'atelier. La sortie précédente
>    est gardée quand même — un fichier JSON à la racine, `sorties.json`, pas une table — et
>    elle ne sert qu'à une chose que le dossier ne sait pas trancher : **quels fichiers de
>    là-bas sont les nôtres**, pour qu'« effacer ce qui ne sort plus » ne touche jamais à ce
>    que l'auteur a mis là.
> 2. **Les quatre modes sont `remplacer`, `numeroter`, `arreter`, `effacer`.** La planche
>    dessine trois boutons ronds et une case à cocher sous un pointillé ; le critère en compte
>    quatre, et les quatre répondent bien à la même question — *ce qui existe déjà là-bas*.
>    `effacer` est le seul qui ait besoin de la fois d'avant.
> 3. **Écraser est un paramètre de `ServiceAgent.deposer`, pas un second écrivain.** « Un
>    second endroit qui écrirait dans le dossier du jeu serait un second endroit où oublier la
>    deuxième règle » : le défaut reste la numérotation, et l'agent ne lève jamais la règle.
> 4. **Deux lots de la planche n'existent pas** — *les terrains*, qui n'est pas une famille, et
>    *les calques d'équipement*, qui ne sont pas un lot mais ce qui accompagne un corps.
> 5. **La direction entre dans le nom du fichier.** C'est ce que la planche appelle *le piège
>    le plus cher du sujet* : l'export d'un personnage n'emportait qu'une image par pose sans
>    dire laquelle des quatre.
> 6. **Le gabarit de nom à jetons n'est pas construit** — `{famille}/{sujet}_{pose}_…` reste
>    sur la planche. Les deux rangements sont fermés, et le nom suit la règle de nommage qui
>    existe (`repere()`), plutôt que d'en ajouter une seconde.
> 7. **Le catalogue de moteur est réel pour Godot et Phaser**, et honnête pour Unity : Godot
>    reçoit une ressource `SpriteFrames` qu'il charge seul, Phaser un *asset pack*, et Unity
>    une liste que son import lit — l'écran le dit, parce qu'Unity n'a pas de catalogue en
>    texte qu'on dépose dans un dossier.
> 8. **L'écran est dans le carnet au-dessus du trait**, sous *Les dépenses*, et non dans le
>    pied : le pied porte ce qui appartient à l'atelier, et sortir appartient au jeu.

### Bloquée par

- `B10`, `B11`

---

## B22 · La galerie connaît les clips — **tenue le 8 septembre 2026**

**Planche** : `Galerie.dc.html`

Un clip gardé se relit désormais du dépôt, pas seulement du chantier : `GET /api/clips` scope
maintenant par `projet` (`Base.generations_du_projet`), et l'écran fusionne ce qu'il relit avec
ce que le chantier voit arriver en direct — la tuile ne bouge pas de clé quand le lot ferme. Sa
couverture est fabriquée par le serveur (`GET /api/clips/{id}/cover`, la même réduction que
`vignette_asset`, sur la première frame déjà écrite au disque à l'arrivée du clip) : ouvrir la
galerie ne télécharge donc jamais de vidéo. Le survol rejoue les frames en boucle sur la
planche contact déjà servie au montage (`A10`, `atelier/services/montage.py::contact()`) — zéro
appel neuf, zéro décodage — en pourcentages plutôt qu'en pixels, pour tenir dans une grille
`auto-fill` dont la largeur des cases n'est jamais connue d'avance. Un filtre « clips » existe
dans la barre, séparé des familles par une ligne creuse, non cliquable : un clip n'appartient à
aucune d'elles.

**Le relevé avait trouvé un troisième trou, plus profond que les deux annoncés par la
planche** : `GET /clips` (et `chantier()`, qu'il aurait pu réutiliser) bornait sa fenêtre aux
générations les plus récentes de *tous* les jeux confondus — un jeu resté tranquille perdait son
clip dès qu'un autre jeu avait été actif depuis, ce qui est très exactement ce qui rendait un
clip invisible après la fermeture de son lot. Un essai le démontre
(`test_un_clip_peu_actif_ne_se_fait_pas_chasser_par_un_autre_jeu`).

### Critères d'acceptation

- [x] Un clip reste dans la galerie après la fermeture de son lot.
- [x] Ouvrir la galerie ne télécharge aucune vidéo — seule la couverture arrive.
- [x] Le survol joue les frames en boucle, sans son, et revient à la première en sortant.
- [x] Un filtre « clips » existe, distinct des six familles.
- [x] La grille ne ralentit pas quand le jeu porte cent clips.

### Bloquée par

- `B0`, `B3` — tenues le 6 septembre 2026.

---

## Le déménagement — pourquoi il rouvre

`B16` avait décidé, en connaissance de cause, que l'écran neuf doublerait l'ancien « le temps
d'un déménagement », et confié ce déménagement à `B17`/`B18`. Les deux sont closes, et il n'a
pas eu lieu — `Retouche.tsx` continue de renvoyer six fois vers `Places.tsx`. Ce n'est pas un
oubli d'une tranche : personne n'avait chargé le déménagement lui-même dans une tranche. Ces
cinq tranches-là le font.

**Deux décisions tranchées ici, 9 septembre 2026**, pour ne pas les rouvrir tranche par
tranche :

- `Fiche.tsx` ne fait pas partie de ce chantier. Ce n'est pas un écran de retouche mais le
  panneau de détail de la galerie — jugement, filiation, visionneuse, réinjecter, supprimer —
  et le carnet n'a pas de remplaçant pour ça. Son bouton *Ouvrir les tables* est devenu
  *La retoucher* en `B25` — il ouvre la retouche, il reste ; il ne lui reste donc à perdre
  que son import de `Places.tsx` (`B26`), rien de plus. La refonte de ce panneau, si elle a
  lieu un jour, est un autre chantier.
- `AtelierDeBande.tsx`, qui monte aujourd'hui les six panneaux de réglage de `Places.tsx`,
  passe aux postes exportés de `Retouche.tsx` plutôt que d'être reconstruit — la voie la plus
  courte à vérifier, qui n'ouvre pas un second écran à refondre pour finir celui-ci.

## B23 · Les trois surfaces déménagent — **tenue le 9 septembre 2026**

**Planches** : `Retouche.dc.html`, `atelier-main.dc.html`, `atelier-detourer.dc.html`,
`atelier-recadrer.dc.html`, `atelier-retourner.dc.html`

### Ce qu'on livre

Les gestes qui se posent **sur l'image** entrent dans la chaîne redessinée. C'est le
déménagement que `B16` avait annoncé et que `B17`/`B18` n'ont pas fait : les deux tranches
ont câblé leurs moteurs *dans les deux écrans*, l'ancien comme le neuf, sans jamais
retirer le premier. Le décalage est écrit noir sur blanc dans le code — `Retouche.tsx`
renvoie six fois le lecteur à `Places.tsx`, et `lieux.ts:144` dit encore que le genre
`"retouche"` « ne remplace pas `"tables"`, il le double le temps d'un déménagement ».

Quatre surfaces, toutes dans `Tables.tsx` aujourd'hui, redessinées sur le papier du
carnet et montées dans le cadre de `Retouche.tsx` :

- **`CadreDeRecadrage`** — le rectangle tracé à la main, plus le rectangle réellement
  gardé en pointillé (U2). Sans lui, « une boîte tracée » reste grisée pour toujours avec
  la raison *« on trace le rectangle sur l'image, pas depuis cette colonne »*.
- **`PipetteSurImage`** — le point d'une passe de détourage, plancher et non arrondi.
- **`TraceSurImage`** — la forme entourée, qui se ferme d'elle-même.
- **`ToileDeLaMain`** — la huitième place : les calques, l'opacité, le curseur carré calé
  sur le pixel visé (U11), et les zones protégées de `miroir, sauf ici` que `B18` a
  livrées côté serveur sans main pour les peindre.

Et les **trois réglages du retournement** que `Retouche.tsx` renvoie explicitement à
`Places.tsx` : l'angle (`angle-libre`, `rotsprite`), la moitié gardée du repli, les zones
protégées de `sauf-zones`.

⚠️ **Une convention de coordonnées, pas deux.** Les quatre surfaces lisent le rectangle
de *l'image* et non celui de la surface (`rectangleDeLImage`), en pixels de l'image
**brute**, coins inclus. C'est déjà la règle des quatre, et la recopier de travers
décalerait ce qu'on pose dessus — la leçon du cadre de la Découpe.

⚠️ **On déménage, on ne réécrit pas.** Le calcul de chaque surface est repris tel quel ;
seul son habillage passe au papier. Deux implémentations d'un même geste finiraient par
ne plus viser le même pixel, et c'est l'invariant que `B18` a payé sur `palette.py`.

### Ce qui a été tenu

Les quatre surfaces sont **déclarées dans `Retouche.tsx`** et l'ancien écran les lui
emprunte — une seule implémentation, et c'est l'ancien qui importe le neuf, parce que
c'est lui qui s'en va en `B26` : ce qui s'en va n'emporte rien. Le calcul est repris au
caractère près, `rectangleDeLImage` compris ; seules les couleurs changent — le rouille
et l'encre du papier à la place de la lumière et du fond sombre de l'ancien châssis.
Aucune ligne de Python n'a bougé, et aucune clé n'est entrée dans le domaine.

Trois choses ont dû venir avec elles, faute de quoi les surfaces n'auraient rien eu à
poser : les **deux boutons qui arment** la pipette et la forme entourée (l'état vit
au-dessus des deux colonnes, comme dans l'ancien écran), la **pile de la main** entière —
calques, opacité, sens, diamètre, couleur, *Défaire le dernier* et son `Ctrl + Z` —, et
les **trois réglages du retournement**.

⚠️ **Deux écarts entre la fiche et ce que le code disait.**

- La fiche compte *trois surfaces* dans son titre et **quatre** dans son corps ; ce sont
  bien quatre, et `Tables.tsx` en portait quatre.
- La fiche range « les zones protégées de `miroir, sauf ici` » sous `ToileDeLaMain`,
  c'est-à-dire *une main pour les peindre*. Elle n'est pas livrée, et c'est un refus
  réfléchi : les points d'une zone protégée sont des coordonnées **au rang du
  retournement**, qui n'est pas celui du rendu qu'on regarde — un quart de tour en amont
  suffit à les décaler. Les peindre sur l'image affichée aurait posé un geste qui ne vise
  pas le pixel qu'il montre, c'est-à-dire exactement la panne que la convention de
  coordonnées de cette tranche existe pour éviter. Le bouton *Une zone au centre*
  déménage tel quel, et l'écran écrit pourquoi il n'y a pas mieux. **À reprendre le jour
  où la surface saura montrer l'image au rang d'une place**, ce qui est un chantier à
  soi.

### Critères d'acceptation

- [x] Les quatre surfaces se posent depuis `Retouche.tsx` seul, et le rendu servi change.
      Vérifié au navigateur sur l'atelier jetable de `B16` (port 8482), les quatre gestes
      faits à la souris : le rectangle `16, 16, 48, 48` avec sa boîte gardée en pointillé
      à `4, 4, 60, 60` (les 12 px de marge, montrés pour la première fois), le point
      `37, 11` et sa couleur `#d8d9d8` mesurée par le serveur, une forme de quatre points,
      un passage de la main qui touche 125 pixels du rendu — et l'empreinte change à
      chaque fois, donc l'adresse du rendu servi aussi.
- [x] Un pixel visé à la pipette dans l'écran neuf et dans l'ancien donne la **même**
      coordonnée dans la recette envoyée — mesuré, pas relu : les essais des deux écrans
      posent le même geste sur une surface de 512 px pour une image de 1 024, et attendent
      tous les deux `[128, 256]`. Le jour où les deux divergent, l'un des deux tombe.
- [x] Plus aucune phrase de `Retouche.tsx` ne renvoie à `Places.tsx` ni à « l'ancien
      écran » : `tests/test_b23.py` le tient sur le fichier.
- [x] L'angle, le repli et les zones protégées se règlent dans l'écran neuf, et les dix
      sens de `B18` restent les dix.
- [x] Les 61 recettes du corpus figé de `B1` gardent leur empreinte au caractère près :
      aucune ligne de domaine n'a bougé, et `tests/test_b1.py` le mesure.
- [x] `essais/essai_jetons.py` reste vert — les surfaces sont dans `Retouche.tsx`, déjà
      dans la liste fermée, donc mesurées aux six listes de `docs/DESIGN.md`.

### Bloquée par

- `B16`, `B18` — les moteurs que ces surfaces règlent doivent exister avant d'avoir un
  écran.

---

## B24 · Ce qui restait dans les murs — **tenue le 9 septembre 2026**

**Planches** : `Retouche.dc.html`, `Main.dc.html`, `atelier-difference.dc.html`,
`atelier-decoupe.dc.html`

### Ce qu'on livre

Les cinq locataires de `Tables.tsx` que personne n'avait comptés — `B16` en annonçait
trois, le relevé en trouve cinq de plus, et chacun est un geste que l'auteur fait
aujourd'hui et qu'il perdrait :

- **La colonne des sœurs.** On règle la même place sur six attitudes à la file, et la
  table ne se referme pas entre deux. C'est le geste qui distingue une table d'un
  panneau ; `Retouche.tsx` ne reçoit même pas de `soeurs`.
- **Le presse-papier et les recettes nommées** (`PanneauDesRecettes`, U5) — copier ces
  réglages-là, les coller ailleurs, les enregistrer sous un nom qui survit à la séance.
  Le presse-papier vit **hors de React**, délibérément, parce qu'il traverse le démontage
  de l'écran ; `reinitialiserPressePapier` reste exportée pour que deux essais ne se
  racontent pas l'un l'autre.
- **Promouvoir un détourage en défaut du projet** (`PromouvoirLeDetourage`, M7) — le
  geste inverse de la onzième étape de l'univers, avec ses **deux portées** proposées et
  jamais devinées : la nature de l'image, ou la famille de ce qu'elle montre.
- **Les deux fabriques montées dedans.** `EcranDecoupe` se monte dans le cadre de la
  table, et `EcranSuperposition` **n'est monté nulle part ailleurs** (`Tables.tsx:1508`) :
  aujourd'hui les deux boutons de `Retouche.tsx` referment l'écran neuf pour rouvrir
  l'ancien (`App.tsx:4635-4644`). Une fabrique qui renvoie chez l'ancêtre n'est pas une
  fabrique.
- **Le grossissement qui descend sous cent.** L'écran neuf ne connaît que ×1 ×2 ×4 ×8 et
  se rabat sur *« réduite pour tenir dans le cadre »* dès qu'une image de 1 024 arrive.
  C'est U2 entière, rouverte : un dessin ne se juge plus, on n'en voit que ce que
  `object-contain` en laisse. La table libre entre 1 et 250 % revient, **et le pas entier
  reste le défaut** — à ×1,5 un pixel du jeu n'est plus un carré.

⚠️ **Le témoin de l'ancien écran en dit plus que celui du neuf.** `Comparateur`
(`Tables.tsx`) porte deux contrôles pour deux questions — *ce qu'on travaille*
(`brut | rendu`) et *le témoin* (`aucun | à côté | par-dessus`, avec son opacité).
`Retouche.tsx` n'a que le second, et sans le par-dessus. Le premier est un état durable
qu'on oublie : il se redit en ambre sous l'image, sinon on juge la mauvaise.

### Ce qui a été tenu

Les cinq gestes sont dans `Retouche.tsx`, chacun repris de son calcul d'origine. Une
relecture Opus, sur le diff seul (avant que `B23` et `B24` ne se rencontrent en fusion),
a trouvé quatre défauts de mise en page qu'aucun essai `jsdom` ne pouvait voir — un zoom
au-delà de l'ajusté rendait la moitié de l'image inatteignable, le témoin « par-dessus »
ne se superposait pas à l'image qu'il double, le cadre cessait d'être mesuré après un
aller-retour par une fabrique, et découper depuis la retouche refermait l'écran sans un
mot. Les quatre sont corrigés et vérifiés au navigateur, mesures DOM à l'appui.

⚠️ **La fusion avec `B23` a demandé un arbitrage.** Les deux tranches réparaient le même
débordement à deux niveaux différents — `B23` pour la surface de dessin, `B24` pour le
témoin de comparaison. La structure retenue est celle de `B24` (`m-auto` sur un wrapper
interne, jamais `justify-center` sur le cadre qui défile), avec la figure de la surface
de `B23` posée dedans ; et **le pour cent ajusté se mesure sur la surface posée quand il
y en a une**, pas sur l'image "brut/rendu" — trois des quatre surfaces travaillent en
pixels du brut, la main sur le rendu, et les confondre aurait rouvert le coin
inatteignable que `B23` existait pour fermer.

⚠️ **La fusion a aussi révélé 18 tailles hors des listes fermées de `docs/DESIGN.md`** —
les trois pièces neuves (`SoeurDuCarnet`, `CommandesDuZoom`, `PanneauDesRecettes`) avaient
été reprises de `Tables.tsx`, jamais passé au crible du système de jetons. 16 réutilisent
maintenant une valeur déjà déclarée (souvent la gouttière de 14, ou 26 — la hauteur des
autres contrôles compacts du même écran) ; 2 sont entrées dans la liste, justifiées : 128
pour la largeur de la colonne des sœurs (ni 300 ni 380 ne conviennent à une colonne d'une
seule vignette), et 70 pour la mollette d'opacité du témoin par-dessus (54 s'est révélé
trop court à l'usage, mesuré avant de conclure).

### Critères d'acceptation

- [x] Passer d'une sœur à l'autre ne referme pas la table ouverte, et la barre des huit
      se rafraîchit sur la sœur affichée.
- [x] Copier une recette sur une image, la coller sur une autre, la nommer, la
      réappliquer après un changement d'écran — les quatre gestes tiennent, et le
      presse-papier ne survit pas au rechargement de la page. C'est le contrat.
- [x] Promouvoir un détourage écrit bien dans l'univers, et la portée est **choisie**.
- [x] Les deux fabriques ouvrent la découpe et la différence **sans repasser par
      `EcranTables`**, et `EcranSuperposition` reste atteignable.
- [x] Une image de 2 048 px se regarde entièrement, et le pour cent affiché est le pour
      cent appliqué — le défaut que le navigateur avait trouvé en `B16`.
- [x] `Retouche.test.tsx` monte de 30 essais à 59, et aucun n'est le doublon
      d'un essai de `Places.test.tsx`.

### Bloquée par

- `B16` — elle ne dépend pas de `B23` : les deux se tiennent en parallèle.

---

## B25 · Une seule porte — **tenue le 9 septembre 2026**

**Planche** : `Navigation.dc.html`, `Retouche.dc.html`

### Ce qu'on livre

Toutes les portes de la retouche mènent à `Retouche.tsx`, et les deux genres de lieu qui
doublaient le troisième s'en vont.

**Six portes mènent aujourd'hui à l'ancien écran**, et le relevé les a toutes suivies :

| D'où | Comment | Ce qu'elle ouvre |
|---|---|---|
| La galerie | `Fiche.tsx:302` « Ouvrir les tables » | `EcranTables` (`App.tsx:3979`) |
| La page d'un sujet | une image de *Ses images* (`onOuvrirCase`) | `EcranTables` en volet (`App.tsx:4566`) |
| La page d'un sujet | un calque, « la différence » (`onSuperposition`) | `EcranTables`, table `superposition` |
| Comparer | l'écart d'un des deux sujets (`App.tsx:4686`) | `EcranTables` |
| La retouche elle-même | ses deux fabriques | `EcranTables` — elle se referme pour ça |
| La page d'un sujet | *La retouche ›* du bandeau | `Retouche.tsx`, **et elle seule** |

Et la septième porte n'existe pas : **`Retouche` ne sait pas ouvrir une image sans
sujet.** Son asset est relu dans `choseOuverte.cases` (`App.tsx:1125`), alors que la porte
de la galerie sert justement les images qui n'appartiennent à aucune chose du jeu. C'est
le seul cas que les deux écrans ne couvrent pas pareil, et il commande cette tranche : on
ne peut pas retirer l'ancien tant que le neuf ne sait pas faire ce qu'il fait.

⚠️ **`"case"` et `"tables"` fondent dans `"retouche"`.** Trois genres de lieu pour un
seul écran, c'est trois façons d'y arriver et trois branches où oublier une condition —
la panne exacte que `B0` a payée sur `decoupeOuverte`, sept écritures à `null` et pas une
porte. Le genre survivant garde `asset`, et **il s'entre depuis les deux racines** :
`galerie` comme `codex`. La bascule se fait ici, pas à la suppression des fichiers, pour
que le fil d'Ariane et la pile de lieux soient mesurés seuls.

⚠️ **La retouche s'ouvre sur l'image qu'on regarde.** Le bandeau *La retouche ›* prend
aujourd'hui la référence du sujet, ou la dernière image — jamais celle qu'on désigne.
C'était juste tant qu'il existait une seconde porte par image ; ce ne l'est plus dès
qu'il n'y en a qu'une.

### Ce qui a été tenu

**Un seul chemin d'écriture dans la pile**, et c'est la pièce centrale : `ouvrirLaRetouche`
dans `App.tsx` est le seul endroit du produit qui écrive `{ genre: "retouche" }`. Les six
portes l'appellent, y compris celle qui demande une table (*la différence* passe
`"superposition"`) ; refermer, c'est l'appeler avec `null`. `"case"` et `"tables"` ont
quitté `lieux.ts`.

⚠️ **La cinquième porte était déjà fermée.** Le relevé annonçait les deux fabriques de la
retouche comme menant à l'ancien écran ; `B24` les avait montées dans le cadre la veille.
Vérifié avant de la re-traiter, rien n'a été touché de ce côté.

**Un seul montage pour les deux racines.** Il y en avait trois — le montage neuf du codex,
l'ancien écran à la profondeur de la galerie, et le même monté en volet dans la page d'un
sujet. Le montage retenu est celui du haut ; la page d'un sujet perd donc sa propriété
`outil`, et `EcranEtabli` avec elle.

⚠️ **Un montage unique démonte la page qui était derrière**, et une page démontée oublie
ce qu'elle tenait. Deux états remontent d'un cran pour que *remonter d'un cran revienne
d'où l'on venait* : **l'onglet ouvert** de la page d'un sujet et **sa matrice**. Ce ne
sont pas des lieux et ils ne s'écrivent pas dans la pile — `lieux.ts` range les onglets
avec la table ouverte et le panneau de droite — mais sans ce relais, ouvrir une image de
*Ses images* ramenait sur *Sa fiche*. La colonne ouverte de la matrice et le panneau d'un
calque, eux, ne sont pas rattrapés : on revient sur la matrice, pas sur le calque. Noté
plus bas, en `B27`.

**Le bouton de retour nomme ce qu'il y a derrière** : *‹ La galerie* quand on en vient,
*‹ Ses images* sinon — et c'est aussi ce que la colonne des sœurs montre dans chaque cas.
Il écrivait *Ses images* dans les deux, ce qui mentait à qui arrivait sur une image que
personne n'a adoptée.

**Les essais** : `npx tsc -b` propre, `1 246 essais verts sur 24 fichiers`. `App.test.tsx`
passe de 828 à 715 essais — 39 rejoués mécaniquement contre `[data-retouche]` et le
vocabulaire des planches, une trentaine adaptés un par un, 28 retirés avec leur note dans
le fichier. **Ce qu'ils mesuraient et qui n'existe plus est listé en `B27`** : ce n'est pas
une perte de couverture, c'est une perte de gestes, et elle se rattrape ou s'assume, mais
en connaissance de cause.

Vérifié au navigateur sur un atelier jetable (`essais/atelier_jetable_b25.py`, port 8497) :
les quatre chemins, le fil d'Ariane à chaque étage, et le retour depuis chacun.

### Ce que la relecture a corrigé, le même jour

Cinq points, tous appliqués avant la fusion.

**Deux libellés mentaient.** Le bouton de la fiche d'une image disait *Ouvrir les tables*
et ouvrait la retouche : il dit *La retoucher*, le mot que le produit emploie déjà dans
*Ses images* et dans le comparateur, et sa propriété suit (`onOuvrirLesTables` devient
`onRetoucher`). Et le bouton de retour de la retouche n'avait que deux cas — la galerie,
*Ses images* — alors que **la page d'un emploi en fait un troisième** : *la différence*
d'un calque s'y ouvre, et écrire *Ses images* là mentait sur d'où l'on venait. Le nom est
maintenant celui que le fil d'Ariane donne déjà à cet étage, `libelleDEmploi`, la même
fonction — sans quoi le bouton et le fil diraient deux choses du même endroit.

**Deux critères déjà cochés du lot `U` avaient régressé**, et ce n'étaient pas des gestes
de diagnostic : ils sont rendus à l'écran neuf plutôt que reportés.

- **La molette approche et recule dans le cadre**, en gardant le point de l'image sous le
  pointeur (U2). La logique est celle de `Tables.tsx` — écouteur natif non passif pour
  arrêter le défilement de la page, ancre notée au moment du geste, défilement rattrapé une
  fois la nouvelle taille posée — reprise et non réinventée. Elle est posée sur
  `[data-scene-de-retouche]`, avec le nœud en dépendance et non `[]` : une fabrique démonte
  ce cadre, et un écouteur armé une fois pour toutes resterait sur le nœud orphelin.
- **Chaque réglage à curseur porte un champ où sa valeur s'écrit** (U3). `Glissiere` était
  une glissière et un nombre en lecture ; elle prend le comportement de `Curseur`
  (`chassis.tsx`) : Entrée valide, Échap rend la valeur d'avant, quitter le champ vaut
  Entrée, une valeur hors bornes est **ramenée** — jamais refusée — et la ligne dessous dit
  laquelle. Un chiffre écrit vaut un relâchement : un seul envoi. Les vingt-deux glissières
  de l'écran l'ont d'un coup.

Sept essais neufs dans `Retouche.test.tsx` — un pour la molette, six pour le champ, ceux-là
mêmes que `App.test.tsx` avait retirés en § `U3`. **1 253 essais verts sur 24 fichiers**,
`npx tsc -b` propre.

**Et le tableau des gestes perdus, plus bas en `B27`, était faux sur sept lignes.** Il
comptait pour injoignable ce qui vit dans un des six panneaux de `Places.tsx` encore montés
par `AtelierDeBande.tsx`. La règle qui lui manquait est écrite là-bas.

### Critères d'acceptation

- [x] Les six portes ouvrent `Retouche.tsx`, et `EcranTables` n'est plus monté nulle part
      — vérifié au grep sur `App.tsx`, pas seulement aux essais.
- [x] Une image de la galerie **sans chose du jeu** s'ouvre en retouche, avec ses voisines
      de la grille pour sœurs.
- [x] La pile de lieux ne porte plus qu'un genre pour cet écran, et remonter d'un cran
      revient d'où l'on venait — depuis la galerie comme depuis un sujet.
- [x] Ouvrir la différence depuis un calque ouvre la retouche **sur la fabrique**, en un
      geste, comme `G16` le tenait déjà.
- [x] Les 148 essais des douze blocs d'`App.test.tsx` qui montent l'ancien écran passent,
      **rejoués contre le neuf** : chaque `[data-tables]` devient le cadre de la retouche,
      ou l'essai est retiré parce qu'il mesure une pièce qui n'existe plus.

### Bloquée par

- `B23`, `B24` — on ne re-câble pas une porte vers un écran qui perd un geste en chemin.

---

## B26 · L'ancien châssis sort de la retouche — **tenue le 9 septembre 2026**

**Planches** : aucune — c'est une tranche de retrait.

### Ce qu'on livre

`Places.tsx` (2 593 lignes) et `Tables.tsx` (2 615 lignes) quittent le dépôt, et rien ne
se perd en route. Ce n'est pas une suppression : c'est une extraction suivie d'une
suppression, et l'ordre n'est pas négociable.

**Le vocabulaire sort d'abord.** `Retouche.tsx` importe lui-même **quatorze symboles de
`Places.tsx`** — `CIBLES`, `CURSEURS`, `DURCISSEMENT_LIVRE`, `FINESSES`, `MOTEUR`,
`PAIRE_VIDE`, `RESUME`, `SENS_DU_RETOURNEMENT`, `SENS_LIVRES`,
`TOLERANCE_D_UNE_PAIRE_MAX`, `TROUS`, `debord`, `defautGrille`, `quantificationDe`, plus
les deux crochets `useRecette` et `useMesures` — et **sept de `Tables.tsx`** : `TABLES`,
`avecVeille`, `dort`, `indisponible`, `placeDe`, `valeur`, le type `Table`. Ce sont des
faits du domaine, pas du balisage : ils partent dans un module sans écran,
`interface/src/recette.ts`, qui n'importe ni `chassis.tsx` ni React sauf pour ses deux
crochets. **Une vérité par fait** — la règle que `B16` s'était donnée en empruntant plutôt
qu'en recopiant.

**Puis les quatre autres consommateurs se repointent** :

| Fichier | Ce qu'il prend | Ce qu'il devient |
|---|---|---|
| `AtelierDeBande.tsx` | les **six panneaux** `PanneauDetourage`…`PanneauContours` | les postes exportés de `Retouche.tsx` |
| `Assistant.tsx` | `DURCISSEMENT_LIVRE`, `MOTEUR` | le module neuf |
| `Fiche.tsx` | `DURCISSEMENT_LIVRE`, `MOTEUR`, `RESUME` | le module neuf |
| `Superposition.tsx` | `Reglage` | sa propre pièce, ou celle du carnet |

**`AtelierDeBande.tsx` est le vrai obstacle, et il n'était dans le relevé de personne.**
L'atelier d'une animation monte les six panneaux de `Places.tsx` empilés (lignes
2548-2573), tranché avec l'auteur le 5 septembre : *on corrige une pose en regardant deux
réglages à la fois, et une barre en cacherait toujours l'un des deux*. `Places.tsx` a donc
**deux consommateurs vivants**, pas un. **Tranché le 9 septembre 2026** : on exporte les
postes de `Retouche.tsx` (`ReglagesDuDetourage`, `ReglagesDuRecadrage`,
`ReglagesDeLaGrille`, `ReglagesDesCouleurs`, `ReglagesDuNettoyage`, `ReglagesDuContour`) et
on les empile là-bas, plutôt que de refaire l'atelier d'une animation — un écran entier
d'ancien châssis, hors périmètre de ce chantier. Cela rend au passage l'atelier
d'animation cohérent avec la retouche, ce qu'il n'est plus depuis `B17` : les moteurs
neufs n'y sont jamais arrivés.

⚠️ **`Fiche.tsx` ne part pas, et ce n'est pas un oubli.** Ce n'est pas un écran de
retouche : c'est la colonne de détail de l'onglet galerie — le jugement, la filiation, la
visionneuse, le texte qui l'a faite, réinjecter, supprimer — et **le carnet n'a pas encore
son remplaçant** ; `EcranFamille` (`B9`) range une famille, il ne montre pas une image.
Elle exporte de surcroît `BlocPasse` et `nomDuModele`, employés par quatre fichiers. Elle
a perdu le nom *Ouvrir les tables* en `B25` — le bouton dit *La retoucher* et ouvre la
retouche, il reste — et il ne lui reste ici que son import de `Places.tsx`, rien de plus. Son
retrait appartient à la refonte de `Galerie.dc.html`, qui n'est pas dans ce plan.

**Enfin les fichiers tombent** : `Places.tsx`, `Tables.tsx`, `Places.test.tsx` (22 essais),
et les douze blocs d'`App.test.tsx` sont rejoués ou retirés selon ce que `B25` en a fait.

### Ce qui a été tenu

**Le relevé du plan avait dérivé sur les deux comptes qu'il donnait.** `Retouche.tsx`
importait **vingt-cinq** symboles de `Places.tsx` et non quatorze, **quinze** de `Tables.tsx`
et non sept, et les consommateurs étaient **sept** et non quatre : `App.tsx` prenait le type
`Table`, `App.test.tsx` et `Retouche.test.tsx` le presse-papier. Les trois tranches
précédentes avaient touché ce fichier plusieurs fois ; c'est le grep qui a tranché, pas la
liste.

`interface/src/recette.ts` (768 lignes) porte le vocabulaire, **copié au caractère près** —
l'extraction s'est faite par plages de lignes plutôt qu'à la main, pour que « on déménage, on
ne réécrit pas » soit vrai et pas seulement voulu. Il n'importe que `./api` et trois crochets
de React. `Superposition.tsx` garde une copie locale de `Reglage` : c'est du balisage de
l'ancien châssis, il n'a plus qu'un lecteur, et le descendre dans le vocabulaire aurait fait
entrer une pièce d'écran dans un module qui n'en porte pas.

⚠️ **La parité des six postes, vérifiée un par un avant la bascule** — c'est ce que `B27`
annonçait comme le vrai travail de la tranche, et il l'était. Le tableau de `B27` est mis à
jour en conséquence ; ce qui suit dit ce qui a été rattrapé et par quel chemin.

| Poste | Ce qui manquait | Ce qui a été fait |
|---|---|---|
| **Détourage** | le catalogue des modèles (`traitement.silhouettes`), *masquer une passe* | ✅ les deux, repris de `BlocPasse` (`Fiche.tsx`) : le choix du modèle avec sa note, son côté d'inférence et son poids annoncé, et le masque avec la règle U10 — *toucher un réglage remontre la passe* |
| **Recadrage** | rien | le poste était déjà plus riche : format, multiple, bordure, ligne de pied, taille imposée, centrage |
| **Grille** | l'échantillon de l'occupation, *ce que la méthode rend* | ✅ les deux. L'échantillon est repris d'`EchantillonDeHauteur` au calcul près, seules les couleurs passent au papier — et sa case est à **34**, un écart déclaré, là où l'ancien écrivait 56 sans l'avoir déclaré nulle part |
| **Couleurs** | *couleurs de : le jeu / l'image* | ✅ rattrapé. L'écran **lisait** déjà une palette vide — c'est elle qui grise l'algorithme — mais aucun poste ne la **posait** : on reposait toujours celle du jeu |
| **Nettoyage** | rien | les dix réglages étaient là |
| **Contour** | la provenance de la couleur, la croissance sans case, l'unité du trait, le choix de couleur entier | ✅ les quatre. Le poste rendait douze pastilles à la main, sans champ hexadécimal, sans marque *hors palette*, et ne proposait pas la plus sombre de la palette : **il écrivait donc dans la recette une couleur que le jeu n'emploie pas**, au premier réglage touché. Trois critères déjà cochés de `D4` ne tenaient plus que par l'ancien panneau |

**Et une phrase de plus, trouvée par un essai** : deux moteurs sur cinq ne lisent aucune
tolérance, et le poste faisait disparaître le curseur sans un mot. C'est ce qu'`AGENTS.md`
compte à égalité avec un bouton inerte.

⚠️ **Quatre champs de `Poste` sont devenus facultatifs, et c'est ce qui rend les postes
montables ailleurs.** Une frame d'animation n'est l'image d'aucun asset : pas de surface où
viser, pas de pile de calques, pas de barre de places à ouvrir. **L'absence du geste voyage**
— elle ne se remplace pas par une fonction qui ne fait rien : la pipette et la sélection
disent où le geste se fait au lieu d'offrir un bouton mort, et *promouvoir ce détourage en
défaut du projet* s'absente au lieu de se griser. C'est la règle que `BlocPasse` tenait déjà,
reprise plutôt que redécouverte.

⚠️ **Un orphelin est né de cette tranche, et il n'a pas été retiré ici.** `BlocPasse`
(`Fiche.tsx`, ~370 lignes) n'avait qu'un lecteur — le panneau de détourage de l'ancien
châssis, monté par `AtelierDeBande.tsx` — et il n'en a plus aucun : il est déclaré, exporté,
et rendu nulle part. Il porte pourtant **une seconde implémentation** des deux gestes que
cette tranche vient de rattraper, le catalogue des modèles et *masquer une passe*. C'est très
exactement la forme du défaut qui a ouvert ce chantier, et il faut le retirer avant que les
deux ne divergent. **Laissé hors de cette tranche parce que `Fiche.tsx` en est fenced** —
c'est le panneau de détail de la galerie, pas un écran de retouche — et parce qu'une
suppression de 370 lignes de plus dans une tranche déjà large se relit mal. À faire seul.

⚠️ **Et une seconde implémentation de plus, née elle aussi de cette tranche.**
`EchantillonDeHauteur` (`chassis.tsx`) et `EchantillonDeLaHauteur` (`Retouche.tsx`) dessinent
la même hauteur, avec le même calcul. Le premier n'a plus qu'un lecteur, `Assistant.tsx` ; le
second est celui que la retouche rend. C'est la même famille de défaut que l'orphelin
`BlocPasse` — deux implémentations vivantes d'un même geste, qui finiront par ne plus dire la
même chose —, à ceci près que celle-ci a **deux** lecteurs et non un. Portée en `B27` avec
l'autre.

**Le gain, mesuré au navigateur** (atelier jetable de la V3.03.3, port 8491) : l'atelier
d'une animation règle maintenant **cinq moteurs de détourage et non quatre** — la palette du
jeu de `B18` n'y était jamais arrivée —, le format verrouillé, le calage sur un multiple, la
ligne de pied, la taille imposée, le centrage, et les sept moteurs de nettoyage de `B18`.
Vérifié sur le fil, pas à l'œil : chacun des six postes pose bien sa valeur dans
`/api/montage/preview`, `modele: "birefnet-general"` entre dans la recette là où
`Passe.modele` partait toujours vide, et masquer puis toucher un réglage rend
`masquee: false` — la règle U10, sur le fil.

**Les essais** : `npx tsc -b` propre, **1 231 essais verts sur 23 fichiers** — **1 253 depuis
la réparation du 9 septembre 2026**, vingt-deux de plus et pas un de moins ; **2 212 essais
Python verts**, dont les 61 recettes du corpus figé de `B1` au caractère près ;
`essai_jetons.py` et `essai_docs.py` verts. Seize essais d'`App.test.tsx` ont été rejoués
contre les postes neufs — quinze pour le nom de la glissière, qui nomme désormais la passe
qu'elle règle, et un pour le cinquième moteur.

⚠️ **« Les 22 essais de `Places.test.tsx`, tous doublés » était faux, et c'est la seule
phrase de cette tranche qui l'était.** Corrigé le 9 septembre 2026. **La capacité n'a bougé
pour aucun de ces réglages** — ils sont tous à l'écran, et le domaine les tient de son côté
(`tests/test_b17.py`, `tests/test_b18.py`) — mais leur **couverture d'écran** est tombée à
zéro le jour de la suppression :

| Réglage | Avant `B26` | Après `B26` | Depuis la réparation |
|---|---|---|---|
| `echanges` | 5 | 0 | 1 |
| `grain_min` | 4 | 0 | 1 |
| `lissage` | 4 | 0 | 1 |
| `luminosite` | 3 | 0 | 1 |
| `saturation` | 3 | 0 | 1 |
| `vote_voisins` | 2 | 0 | 1 |
| `ronger_regonfler` / `regonfler_ronger` | 2 | 0 | 1 |
| `boucher_jusqua` | 2 | 0 | 1 |
| `reboucher_jusqua` | 2 | 0 | 1 |
| `garder` | 2 | 0 | 1 |
| `epargner_traits_fins` | 2 | 0 | 1 |
| `contraste` | 2 | 0 | 1 |
| `visibles_seuls` | 0 | 0 | 1 |
| `force_tramage` | 0 | 0 | 1 |

⚠️ **Le compte a été refait ici plutôt que repris**, et il ne dit pas la même chose que
celui qu'on avait reçu : celui-là comptait `remplissage` pour `lissage` et une phrase de
commentaire pour un essai, et il laissait quatre réglages hors de sa liste. **La règle de
comptage, pour qu'elle se rejoue** : un essai = un bloc `test(`, commentaires retirés, le nom
du réglage cité sur une frontière de mot — sa clé de recette ou le nom français de sa
commande.

**Onze essais neufs** couvrent ces quatorze réglages — trois d'entre eux prennent une paire
qui ne se distingue que par sa clé (les deux morphologies, les trous et les poches, les
curseurs de `B17`), parce que les confondre est le défaut qu'on veut voir refuser. Ils sont
dans `Retouche.test.tsx`, sous *les réglages rendus sans essai par le départ de
`Places.test.tsx`*, et ils tiennent le seul fait dont l'écran répond : **la valeur réglée
part dans la recette envoyée**, sans effacer celle d'à côté.

⚠️ **Un seul réglage reste sans essai d'écran, et c'est écrit plutôt que laissé en blanc** :
`graine`, la graine des k-moyennes. Elle n'en avait pas avant `B26` non plus — ce n'est donc
pas une perte de cette tranche, et elle est notée pour ne pas se refermer en silence.

⚠️ **Et les six capacités rattrapées repartaient sans une assertion d'écran.** Onze essais de
comportement ont été ajoutés à `Retouche.test.tsx` le 9 septembre 2026, sous *les six
capacités rattrapées par `B26`* ; le détail est en `B27`, avec les lignes du tableau qu'ils
tiennent.

### Critères d'acceptation

- [x] `interface/src/composants/Places.tsx` et `Tables.tsx` n'existent plus, et
      `npx tsc -b` passe.
- [x] Aucun fichier de `interface/src/` n'importe plus l'un des deux — au grep.
- [x] L'atelier d'une animation règle les **mêmes** moteurs que la retouche, ceux de
      `B17` et `B18` compris : c'est un gain de la tranche, pas une régression à éviter.
      Vérifié au navigateur, et sur le fil plutôt qu'à l'œil.
- [x] Les essais Python qui lisent ces fichiers comme du texte sont repointés et
      passent. ⚠️ **Ils étaient six et non cinq** : `tests/test_b23.py` tenait l'invariant
      *une seule implémentation de chaque surface* en lisant `Tables.tsx`, c'est-à-dire le
      fichier qui s'en va. Il ne surveille plus un emprunteur, il balaie `interface/src/`
      entier — une seconde copie ne peut plus réapparaître nulle part.
- [x] La suite d'écran passe entière, et `App.test.tsx` a perdu ses `[data-tables]`.
- [x] Les 61 recettes du corpus figé de `B1` gardent leur empreinte : aucune ligne de
      domaine n'a bougé dans cette tranche, et `tests/test_b1.py` le mesure. Les capacités
      rattrapées n'écrivent que des champs qui existaient déjà — `Passe.modele`,
      `Passe.masquee`, `Quantification.palette`, `Contour.couleur`.

### Bloquée par

- `B25`

---

## B27 · Les garde-fous rattrapent la refonte — **tenue le 9 septembre 2026**

**Planche** : aucune — c'est une tranche d'outillage.

### Ce qu'on livre

Ce qui mesure l'avancement de la refonte doit dire la vérité le jour où elle avance.

- **`essais/essai_jetons.py`** — `Retouche.tsx` y est déjà ; entrent les fichiers que
  `B23` et `B24` ont écrits. ⚠️ **La liste ne s'étend pas au dépôt entier**, et c'est le
  contraire de ce qu'on croit en fermant ces tranches : retirer `Places.tsx` et
  `Tables.tsx` ne retire pas l'ancien châssis. Il en reste une trentaine d'écrans —
  `Montage`, `Toile`, `Univers`, `Codex`, `Personnages`, `AtelierDeBande`, `Assistant`,
  `Superposition`, `Calibrage`, `Envoi`, `Depenses`, `Ambiances`, `Planche`… — et
  `index.css:22` les nomme encore. Un garde-fou qu'on doit désactiver n'en est plus un.
- **`interface/src/index.css`** — la phrase du haut cite « la galerie, le codex,
  l'univers, **les tables** » : les tables n'existent plus, la liste se corrige.
  Les jetons `ancien-signal` restent : la galerie et le codex les emploient toujours.
- **`interface/src/lieux.ts`** — l'avertissement de vingt lignes qui dit que `"retouche"`
  « ne remplace pas `"tables"` » décrit un état qui n'est plus vrai. Il devient le compte
  rendu du déménagement, avec sa date, plutôt qu'une promesse périmée.
- **`atelier/domaine/recette.py:152`, `:1952` et `:2463`** — trois commentaires renvoient à
  `Places.tsx` : la liste jumelle des noms de moteur (`:152`), `SENS_A_AJOUTER` posé par
  `B1` (`:1952`), et `marge_sans_effet` (`:2463`). ⚠️ **Le troisième n'était pas dans ce
  relevé** : relu le 9 septembre 2026, il y entre.
- **Trois renvois pleins de plus, dans du code d'essai** — vérifiés un par un le
  9 septembre 2026, et aucun n'était listé :
  - `essais/atelier_jetable_b1.py:46` — *« La mesure d'E5
    (`interface/src/composants/Tables.tsx`) était faite à sept places : elle est à
    refaire. »* Le banc décrit ce qu'on vient voir à l'écran ; c'est la mesure qui reste à
    refaire, pas le fichier qui reste à lire.
  - `tests/test_b18_retourner.py:15` — *« `SENS_A_AJOUTER` (posé par `B1` dans
    `interface/src/composants/Places.tsx`, maintenant vidé) »*. La liste vit dans
    `interface/src/recette.ts` depuis `B26`.
  - `tests/test_b3.py:59` — *« `PUT /assets/{id}/recipe` est la route que chaque table de
    retouche appelle à chaque réglage relâché (`interface/src/composants/Places.tsx`,
    `useRecette.poser`) »*. `useRecette` est dans `interface/src/recette.ts`.

  ⚠️ **Et rien ne les attrape** : `essai_docs.py` ne résout que les renvois **vers
  `docs/`** (`essais/essai_docs.py`, la liste des cibles est `docs/` plus `AGENTS.md`). Un
  renvoi du code vers un fichier de `interface/` ou d'`atelier/` peut donc pointer un
  fichier supprimé sans qu'aucun banc ne bronche — c'est ce qui est arrivé aux six
  ci-dessus. Le garde-fou d'import de cette tranche ne couvre pas ce cas non plus : il
  regarde les `import`, pas les renvois écrits en prose.

  **Ce sont les six seuls hors de `docs/`**, au grep du 9 septembre 2026. `docs/remarques/`,
  `docs/tranches/V4.md`, `docs/releves/` et `docs/archive/` en portent une trentaine de plus,
  et ceux-là **ne se corrigent pas** : ce sont des relevés datés et des tranches closes, qui
  disent ce que le dépôt contenait le jour où ils ont été écrits. Les réécrire effacerait la
  mesure. Le critère au grep, plus bas, ne vise donc que le code et les documents vivants.
- **Trois documents portent la même phrase périmée** — `docs/status/etat.md`,
  `docs/tranches/V4.md` § B16, et `docs/PLAN-carnet.md` § B16 — *« l'écran neuf double
  l'ancien, il ne le remplace pas »*, renvoyée à des tranches closes qui ne l'ont pas
  faite. Elles sont corrigées **en place**, avec le renvoi à `B23`-`B26` : c'est cet
  écart-là qui a coûté une refonte annoncée close et livrée à moitié, et l'effacer sans
  le nommer coûterait la même chose la prochaine fois.
- **`docs/carte-du-depot.md`** — les deux fichiers y sont décrits.
- **Deux secondes implémentations vivantes, nées de `B26`, et c'est la même famille de
  défaut que celle qui a ouvert ce chantier.**
  - `BlocPasse` (`Fiche.tsx`, ~370 lignes) — **plus aucun lecteur**, et il porte pourtant
    une seconde version du catalogue des modèles et de *masquer une passe*, les deux gestes
    que `B26` vient de reprendre dans `ReglagesDuDetourage`. Il se retire.
  - `EchantillonDeHauteur` (`chassis.tsx`) et `EchantillonDeLaHauteur` (`Retouche.tsx`) —
    **le même dessin de hauteur, écrit deux fois**, avec le même calcul et deux jeux de
    couleurs. `Assistant.tsx` lit le premier, la retouche rend le second. ⚠️ **Celui-ci ne
    se supprime pas, il se fond** : les deux ont un lecteur vivant, et le retrait est donc
    une extraction — le dessin descend dans une seule pièce, que les deux montent. Le
    signaler ici parce que rien d'autre ne le voit : `tests/test_b23.py` tient l'invariant
    *une seule implémentation de chaque surface*, et une hauteur dessinée n'est pas une
    surface.

### Ce que le déménagement laisse derrière

⚠️ **Seize gestes de l'ancien écran : ce qui est perdu maintenant, ce qui ne le sera qu'à
la suppression des fichiers, et ce qui a déjà été rattrapé.** Le relevé en a été fait essai
par essai en re-câblant les portes ; chaque ligne a coûté un ou plusieurs essais retirés
d'`App.test.tsx`, et chacun de ces essais porte sa note dans le fichier. **Ce n'est pas une
perte de couverture, c'est une perte de gestes** — le serveur, lui, sait toujours tout
faire.

⚠️ **La règle qui départage les trois colonnes**, et la première écriture de ce tableau ne
l'avait pas : `AtelierDeBande.tsx` monte toujours les **six panneaux** de `Places.tsx`
(lignes 2548-2573), et il leur passe `mesures: null` (`AtelierDeBande.tsx:979`). Donc —

- ce qui **lit `mesures`** est perdu **maintenant**, partout : ni la retouche ni l'atelier
  d'une animation ne le montre ;
- ce qui vivait dans un des six panneaux **sans lire `mesures`** reste joignable
  aujourd'hui, mais **sur une frame d'animation seulement** — plus sur une image de la
  galerie —, et il partira avec les fichiers en `B26` si les postes de `Retouche.tsx` ne
  le portent pas ;
- ce qui vivait dans `Tables.tsx` lui-même — le pied d'une colonne, la bande du bas, le
  châssis — est perdu maintenant : aucun écran ne monte plus `EcranTables`.

| Ce qui n'a pas déménagé | Où c'était | Où ça en est |
|---|---|---|
| **Un curseur prend un chiffre** — le champ où la valeur s'écrit, Entrée, Échap, la valeur ramenée dans ses bornes (U3, six essais) | `Curseur` (`chassis.tsx`), par la table du détourage | ✅ **rattrapé le 9 septembre 2026** : `Glissiere` porte le champ, avec le comportement de `Curseur`, et ses vingt-deux emplois l'ont d'un coup. Les six essais sont dans `Retouche.test.tsx` |
| **La molette qui approche** — et qui garde le point visé sous le pointeur | le cadre de l'image | ✅ **rattrapée le 9 septembre 2026** : l'écouteur natif de `Tables.tsx:1439-1475` est posé sur `[data-scene-de-retouche]`. Un essai neuf le mesure, correction du défilement comprise |
| **Vider une seule place** — *Sans bords ›*, et ses huit sœurs | le pied de chaque colonne de table (`Tables.tsx`) | ❌ **perdu** : endormir existe (l'interrupteur) ; **vider** n'existe nulle part, et ce n'est pas le même geste |
| **Toucher un réglage réveille une table endormie** — en un seul envoi, avec son annonce (deux essais) | l'ancien châssis (`Tables.tsx`) | ❌ **perdu**, et assumé : une table endormie n'a plus de réglage à toucher — *endormie : ses réglages sont gardés*, et le réveil passe par l'interrupteur |
| **Le miroir à direction tapée** — *ça se range en …*, un nom de direction écrit à la main, puis *Retourner ›* (`POST /api/assets/<id>/mirror`) | `PanneauRetournement` (`Places.tsx`), et là seulement — ce panneau-là n'est monté nulle part ailleurs | ❌ **perdu**, mais **le geste survit** : la matrice d'un sujet porte *Retourner › gratuit* sur chaque case de direction vide (`Personnages.tsx:2719-2728`), avec la direction proposée par le serveur (`api.miroirPropose`). Seule la direction choisie à la main s'en va |
| **Les poches de fond une par une** — cerclées, comptées, avec *la retirer ›* sur chacune (une passe pipette de plus) | le détourage (`mesures.poches`) | ❌ **perdu** : comptées sous *Nettoyer*, rebouchées en bloc par un seuil, jamais désignées une par une |
| **La grille retrouvée du modèle** — *carrés de 8 pixels · 128 de côté*, et la phrase du serveur quand la détection renonce sur une peinture | la table de la grille, D2 (`mesures.grille_du_modele`) | ❌ **perdu** : le serveur la mesure toujours, **plus aucun écran ne la lit** |
| **La liste des taches** — triées de la plus petite à la plus grande, et *12 taches de plus, non listées* | l'aire minimale de *Nettoyer* (`mesures.taches`) | ❌ **perdu** : le compte seul |
| **Trois lectures du recadrage** — la part jetée avec le couple avant/après, les bords que le sujet touche, *plus large que le sujet · sans effet sur le rendu* | le panneau du recadrage (`mesures.recadrage`) | ❌ **perdu** : les quatre nombres et leur provenance, sans ces trois phrases |
| **Le compte des crans qui changent l'image** — *17 crans changent l'image, sur les 91 du curseur* | la table de la grille (`mesures.crans_occupation`) | ❌ **perdu** |
| **Masquer une passe** — *passe 2 — visible* / *masquée*, ses réglages gardés sous les yeux, la passe remontrée dès qu'on touche un curseur (quatre essais) | `BlocPasse` (`Fiche.tsx`), monté par `PanneauDetourage` | ✅ **rattrapé le 9 septembre 2026** (`B26`) : le geste est dans `ReglagesDuDetourage`, repris de `BlocPasse` — le bouton *La masquer*, la passe barrée, ses réglages lisibles et grisés, et la règle U10 : toucher un réglage la remontre. Mesuré sur le fil, `masquee: false` repart avec la valeur touchée |
| **Le catalogue des modèles de détourage** — *rapide*, *le meilleur sur les silhouettes difficiles*, le poids annoncé avant le téléchargement, le défaut du produit (quatre essais) | le moteur `modele` du détourage, dans `BlocPasse` | ✅ **rattrapé le 9 septembre 2026** (`B26`) : le catalogue est dans `ReglagesDuDetourage`, alimenté par `traitement.silhouettes` — le titre de chaque modèle, sa note, le côté auquel il infère avec sa licence (`D4`), et le poids annoncé avant le téléchargement. `Passe.modele` porte enfin ce qu'on a choisi |
| **L'échantillon de l'occupation** — le sujet dessiné dans sa case, les deux lectures d'une même hauteur (*3 personnages de haut*, *l'image revient en 192 carrés de côté*) | `EchantillonDeHauteur`, dans `PanneauGrille` | ✅ **rattrapé le 9 septembre 2026** (`B26`), et **fondu en une seule pièce le même jour** (`B27`) : `EchantillonDeHauteur` (`chassis.tsx`) et `EchantillonDeLaHauteur` (`Retouche.tsx`) — la même seconde implémentation née de `B26` — ne font plus qu'une, dans `chassis.tsx`, avec un réglage `palette` (`"ancien" \| "papier"`) qui ne fait varier que les jetons de couleur et les deux tailles du dessin. `Assistant.tsx` et `Retouche.tsx` montent tous les deux `EchantillonDeHauteur` ; le calcul ne se lit donc plus qu'à un seul endroit |
| **La source des couleurs** — *la palette du jeu* ou *l'image* | `PanneauQuantification` — qui ne reçoit même pas `mesures` | ✅ **rattrapé le 9 septembre 2026** (`B26`) : le réglage *couleurs de — le jeu / l'image* ouvre `ReglagesDesCouleurs`, grisé avec sa raison quand le jeu n'a pas de palette. L'écran **lisait** déjà ce fait — c'est lui qui grise l'algorithme — sans jamais le **poser** |
| **Deux lectures du contour** — la croissance à chaque cran (*la silhouette grandit de 2 px*) et la provenance de la couleur (*proposé, d'après ta palette*, *hors palette*) | `PanneauContours` — les deux se calculent sur la recette, pas sur `mesures` | ✅ **rattrapées le 9 septembre 2026** (`B26`), et une troisième avec elles. La croissance se dit aussi **sans case posée** — *la silhouette grandit de N px sur chaque dimension* —, la provenance revient avec le choix de couleur entier (pastilles de la palette, champ hexadécimal, marque *hors palette*, et la plus sombre proposée), et `uniteDuTrait` dit dans quelle unité l'épaisseur se compte. ⚠️ **Trois critères déjà cochés de `D4` ne tenaient plus que par l'ancien panneau**, et `tests/test_d4.py` les mesure maintenant sur `Retouche.tsx` |
| **Ce que chaque méthode de pixélisation rend** — *un pixel sur N gardé*, *contour net et intérieur lisible* | sous les segments de la grille (`CE_QUE_LA_METHODE_REND`) | ✅ **rattrapé le 9 septembre 2026** (`B26`) : `CE_QUE_LA_METHODE_REND` est rendu sous les crans de *façon de réduire*. Un libellé de trois mots ne dit pas ce qu'on gagne et ce qu'on perd, et c'est ce qui départage les méthodes |
| **Le PNG de l'état courant** — *PNG ↓*, le rendu ou le brut selon ce qu'on travaille | la bande du bas de l'ancien écran | 🟡 **perte quasi nulle** : la fiche d'une image le porte avec le même choix brut/rendu (`Fiche.tsx:303-308`, `montrerBrut`), et la tuile de la galerie l'a aussi (`Tuile.tsx:576`). Ce qui manque est le geste **sans quitter la retouche**, pas le téléchargement |

✅ **Les six lignes en attente étaient le vrai travail de `B26`, et les six ont été
rattrapées** — le 9 septembre 2026, avant la suppression des fichiers et non après. Elles ne
tenaient plus que par les six panneaux de l'ancien châssis que `AtelierDeBande.tsx` montait
encore ; les postes de `Retouche.tsx` les portent maintenant, et l'atelier d'une animation y
gagne au passage tous les moteurs de `B17` et `B18`. **Aucune perte n'a été assumée à ce
tour** : les six étaient petites et clairement dans l'esprit de leur poste, et chacune a été
reprise de son calcul d'origine plutôt que réécrite. Le détail poste par poste est en `B26`.

⚠️ **Les six ont été rattrapées le 9 septembre 2026 sans une assertion d'écran**, et c'est
réparé le même jour : ces lignes disaient « rattrapé » sur la foi d'une vérification au
navigateur et de trois essais Python au grep. Onze essais de comportement sont dans
`Retouche.test.tsx`, sous *les six capacités rattrapées par `B26`* — masquer une passe et la
règle U10, le catalogue avec et sans catalogue servi, les deux lectures de l'échantillon, la
phrase qui suit la méthode de pixélisation, la source des couleurs dans les deux sens et son
grisé, la provenance de la couleur du contour et la palette entière à la pastille. **Six
capacités rendues sans assertion, ce sont six capacités qui repartiraient à la prochaine
refonte sans que rien ne refuse** — le motif même que ce chantier existe pour clore.

⚠️ **Et ce qui a été trouvé en le faisant** : trois critères déjà cochés de `D4` — le choix de
couleur du contour, la marque *hors palette*, l'unité de l'épaisseur — **ne tenaient plus que
par l'ancien panneau**, sans qu'aucune ligne de ce tableau ne les compte. C'est le même
défaut que celui qui a ouvert ce chantier, un cran plus bas : un critère coché sur un écran
qui s'en va n'est pas un critère tenu. Ce sont les essais Python qui les ont rendus — repointés
sur `Retouche.tsx`, ils ont refusé.

⚠️ **Et deux retours qui ne revenaient pas tout à fait — rattrapés en aparté, hors des
critères d'acceptation.** La retouche se monte à la place de la page d'un sujet depuis
`B25` — plus en volet dedans —, et une page démontée oublie ce qu'elle tenait. L'onglet
ouvert et la matrice étaient déjà rattrapés (`App.tsx` les tient) ; **la colonne ouverte de
la matrice et le panneau d'un calque ne l'étaient pas** : ouvrir *la différence* d'un calque
puis remonter d'un cran ramenait sur la matrice, colonne au corps, panneau fermé. ✅
**Rattrapé le 9 septembre 2026**, sur le même patron que `B25` : deux états de plus montent
d'un cran, de `EcranEtabli` (`Personnages.tsx`) jusqu'à `App.tsx`, en passant par
`PageDuSujet.tsx` (qui garde le même relais optionnel — `colonne`/`onColonne`,
`calque`/`onCalque` — que `onglet` et `matrice`). Ce n'était pas un critère d'acceptation de
cette tranche ; traité parce que la correction s'est avérée triviale une fois lue.

✅ **Un garde-fou de plus, posé le 9 septembre 2026, et c'est celui qui aurait évité tout
ceci.** `essais/essai_imports.py` refuse qu'un fichier hors de `LES_FICHIERS_DU_CARNET`
soit importé par un fichier qui y est : c'est très exactement ce que `Retouche.tsx` faisait
de `Places.tsx` depuis `B16`, sans qu'aucune ligne du dépôt ne le signale. ⚠️ **La liste
d'exceptions a dû grandir à quatre, pas deux, pour que le garde-fou tienne sur le dépôt
réel** — la relecture a trouvé deux dépendances de plus, aussi réelles que les deux
prévues, chacune nommée avec sa raison : `interface/src/recette.ts` (le vocabulaire, `B26`),
`chassis.tsx` (fonctions et composants partagés), `Apercu.tsx` (même rôle que `chassis.tsx`,
pour l'image), et `FicheChose.tsx` (une dette assumée et non traitée par cette tranche —
`comptes`/`portraitDe`, empruntées par deux écrans du carnet sans être passées par un module
de vocabulaire). Le garde-fou distingue **monter un composant** (une majuscule, une
composition d'écrans normale) d'**emprunter une fonction** (le défaut d'origine) : c'est ce
qui permet à `Retouche.tsx` d'ouvrir `EcranSuperposition` sans exception, tout en refusant
d'emprunter une fonction à un fichier qui n'est ni dans le carnet ni dans les quatre
exceptions. Un second essai, dans le même fichier, fabrique une régression et une
composition légitimes **en mémoire, jamais dans le vrai code**, et prouve que le premier
refuse l'une et laisse passer l'autre.

### Ce qui a été tenu

**`essai_jetons.py` — confirmé plutôt que refait.** `Retouche.tsx` y était déjà (`B16`), et
ni `B23` ni `B24` n'ont écrit de fichier neuf qui doive y entrer — les deux n'ont fait
qu'étoffer `Retouche.tsx`, déjà dans la liste. ⚠️ **`interface/src/recette.ts` (`B26`)
n'y entre pas, et ce n'est pas un oubli** : ce n'est pas un écran — aucune classe Tailwind,
aucun rendu — et l'ajouter a produit un seul faux positif (`#ffffff`, un défaut de pinceau
en TypeScript pur, pas une couleur de balisage). Le fichier reste couvert par le Sens 1 du
banc (`sources()` le scanne comme les autres) : un vrai jeton de couleur qu'il emploierait
sans le déclarer serait toujours refusé. Le compte de fichiers du carnet reste donc à 22
pour cette tranche — la croissance de `B27` est dans le garde-fou d'import, pas dans cette
liste.

**Le grep large (point 5) a trouvé quatre renvois de plus que les six annoncés**, tous hors
de `docs/` et dans du code vivant : `interface/src/api.ts` (`PanneauRecadrage`, `Places.tsx`
— stale depuis que `B26` a migré l'atelier d'une animation sur `ReglagesDuRecadrage`),
`interface/src/composants/GrilleDuJeu.tsx` (`occupationMax` disait encore employé par
`Places.tsx`, c'est `Retouche.tsx` depuis `B26`), `interface/src/composants/Guide.tsx` (la
pile de la main disait vivre dans `Tables.tsx`, c'est `recette.ts` depuis `B26`), et
`interface/src/composants/Retouche.tsx` lui-même (`PanneauRecadrage, l'écran de montage` —
un nom de panneau qui n'existe plus, la vraie provenance est `AtelierDeBande.tsx`). Les six
prévus plus ces quatre sont corrigés. Les nombreuses mentions de `Tables.tsx`/`Places.tsx`
dans `Retouche.tsx` et `Retouche.test.tsx` (« repris de `Tables.tsx`, `B24` », « déménagé de
`Tables.tsx` ») **ne sont pas des renvois cassés** : ce sont des notes de provenance, au
passé, qui ne prétendent pas que le fichier existe encore — laissées telles quelles, comme
les archives.

**`lieux.ts` était déjà réécrit** (par `B25`, avant même que `B27` ne soit tenue) : l'ancien
avertissement « ne remplace pas `"tables"` » n'y est plus. Une seule phrase résiduelle
citait encore « l'écran des tables » comme exemple ; corrigée pour citer la retouche.

**`interface/src/composants/Fiche.tsx`** perd 386 lignes : `BlocPasse` (370 lignes),
`Reglage` (32 lignes, qui n'avait plus qu'un lecteur), et sept imports devenus inutiles
(`Passe`, `Silhouette`, `Curseur`, `NomDuReglage`, `POINTILLE`, `useInfobulle`,
`DURCISSEMENT_LIVRE`, `megaoctets`). Confirmé sans lecteur au grep avant le retrait. ⚠️ **La
suite pytest complète en a trouvé un que le grep de lecteurs React ne voyait pas** :
`tests/test_d4.py::test_l_ecran_dit_a_quel_cote_le_modele_infere` lisait le texte brut de
`Fiche.tsx` pour y trouver `choisi.entree`, qui ne vivait que dans `BlocPasse`. Repointé sur
`Retouche.tsx`, où `ReglagesDuDetourage` porte la même phrase depuis `B26`.

**`EchantillonDeHauteur`/`EchantillonDeLaHauteur` fondus dans `chassis.tsx`**, avec un
réglage `palette` (`"ancien" | "papier"`) et deux tailles (`haut`, `largeur`) — le calcul ne
bouge pas d'un caractère, seuls les jetons de couleur et les deux dimensions varient entre
les deux appelants. `Assistant.tsx` n'a rien eu à changer (les trois réglages gardent leur
défaut) ; `Retouche.tsx` passe `palette="papier"`, `haut={64}`, `largeur={34}`. Vérifié par
lecture attentive des deux rendus d'origine plutôt qu'au navigateur, faute de temps pour
monter un atelier jetable dédié — les onze essais de comportement de `Retouche.test.tsx`
sur l'échantillon (ajoutés en `B26`) couvrent le côté papier ; le côté ancien partage le même
calcul et les mêmes classes littérales, recopiées au caractère près.

⚠️ **Un test d'`App.test.tsx` (A7, « on va chercher une image dans le clip ») est
intermittent sous la suite complète** (`1252`/`1253` verts un coup sur deux) mais passe seul
à chaque fois : un défaut de minuterie déjà connu du dépôt (`docs/PIEGES.md`), sans rapport
avec cette tranche — aucun fichier qu'elle touche n'est sur son chemin.

✅ **Le point non listé, traité** : remonter d'un cran depuis *la différence* d'un calque
ramenait sur la matrice au lieu de la colonne et du panneau ouverts. Corrigé sur le patron
de `B25` — deux états montent de `EcranEtabli` jusqu'à `App.tsx`, relayés par
`PageDuSujet.tsx` comme `onglet`/`matrice` le sont déjà.

### Critères d'acceptation

- [ ] `py essais/essai_jetons.py` passe — **oui**. Son compte de fichiers du carnet
      **n'a pas grandi** cette tranche-ci, ce que le critère demandait littéralement : voir
      *Ce qui a été tenu*, `recette.ts` n'est pas un écran et rien d'autre n'entre. Écart
      assumé plutôt que forcé — ajouter `recette.ts` pour faire monter le chiffre aurait fait
      refuser un vrai défaut du garde-fou (`#ffffff`, une couleur de pinceau confondue avec
      un jeton de balisage) pour de mauvaises raisons.
- [x] Aucune phrase du dépôt ne dit plus que l'écran de la retouche est doublé : vérifié au
      grep sur `docs/`, `interface/` et `atelier/`, les trois occurrences vivantes corrigées
      avec leur renvoi à `B23`-`B26`.
- [x] Le garde-fou d'import (`essais/essai_imports.py`) refuse une régression fabriquée
      exprès, et son propre auto-essai le montre.
- [x] `py essais/essai_docs.py` passe, et le grep sur le dépôt entier ne trouve plus les six
      renvois relevés — plus quatre de plus trouvés en le refaisant soi-même.
- [x] Les deux secondes implémentations sont traitées : `BlocPasse` retiré,
      `EchantillonDeHauteur` / `EchantillonDeLaHauteur` fondus en une seule pièce que
      `Assistant.tsx` et `Retouche.tsx` montent tous les deux.
- [x] Les seize lignes de *Ce que le déménagement laisse derrière* sont tranchées une par
      une, et la ligne de l'échantillon de l'occupation reflète la fusion.

### Bloquée par

- `B26`

---

## Les agents, et qui fait quoi

Sept rôles. Un agent ne tient qu'un rôle, et **le relecteur passe toujours en dernier** — sans
lui, deux fiches écrites en parallèle se contredisent sans que personne ne le voie.

| Rôle | Ce qu'il fait | Ce qu'il ne fait jamais |
|---|---|---|
| **le relevé** | avant chaque tranche : mesure ce qui existe, cite fichier et ligne, compte | il n'écrit pas une ligne de code |
| **le serveur** | domaine, services, routes, essais Python | il ne touche pas à `interface/` |
| **l'écran** | React, TypeScript, essais d'écran | il n'ajoute pas de règle métier ; s'il lui en faut une, il la demande au serveur |
| **les moteurs** | les traitements d'image seuls — c'est le lot le plus gros et le plus indépendant | il ne dessine pas d'écran |
| **le vocabulaire** | tient la liste fermée des mots, remappe les 157 entrées du guide, refuse un mot banni | il ne tranche pas un choix de produit |
| **le relecteur** | confronte les fichiers entre eux et le livré aux maquettes | il ne corrige pas lui-même : il rapporte |
| **le navigateur** | vérifie à l'écran, sur un second atelier, sur un port à part | il ne touche pas à l'atelier de l'auteur, qui tourne pendant la séance |

**Les règles de la flotte** :

- Jamais plus de trois agents qui écrivent en même temps sur une même tranche.
- Le serveur passe avant l'écran sur toute tranche qui touche au modèle — `B8`, `B11`, `B19`,
  `B20`. La forme d'un écran découle de la relation qu'il affiche, pas l'inverse.
- Une tranche n'est pas close tant que le relecteur n'a pas confronté ce qui est livré à sa
  planche.
- **L'auteur travaille dans le dépôt pendant la séance.** Avant de diagnostiquer un écart,
  vérifier qu'il ne vient pas de son édition en cours.

**Quel modèle sur quelle tranche** : `docs/PLAN-carnet-affectation.md` classe les 24 tranches
de `[VERY-EASY]` à `[VERY-HARD]`, avec les morceaux qui montent ou descendent d'un cran.

---

## Ce que le relevé a trouvé et qui n'est pas dans les tranches

Sept écarts entre les planches elles-mêmes. Aucun n'est bloquant, tous se tranchent en une
phrase, et ils coûteront cher s'ils sont découverts en cours de construction.

1. **Le retournement n'est pas à la même place dans deux planches.** `Retouche.dc.html` le met
   *avant le recadrage* — « en faire un bouton d'export reviendrait à cadrer la mauvaise
   image ». `atelier-retourner.dc.html` le met *à la fin de la chaîne* — « un miroir n'a de sens
   que sur une image déjà finale ». **Ce plan retient la fin de la chaîne**, avant la main : la
   planche dédiée est la plus récente et la plus détaillée, et pour un miroir pur le recadrage
   sur la boîte opaque donne le même résultat des deux côtés.
2. **Un clip écarté se rend, ou ne se rend pas.** `Clip.dc.html` écrit qu'« un clip écarté se
   rend quand on veut » ; `Clips.dc.html` décrit un jeter définitif, qui emporte les bandes
   déjà taillées dans le clip jeté.
3. **La palette est dans le parcours de création, ou n'y est pas.** `Nouveau-jeu.dc.html`
   compte *Les couleurs* parmi les planches fondues dans le parcours, et un encadré du même
   fichier explique pourquoi la palette n'y est pas. Elle est sur la toile — c'est la seconde
   moitié qui est juste.
4. **Le compte des moteurs de nettoyage se contredit trois fois** dans la même planche : douze
   en préambule, onze dans un réglage, neuf dans le détail. ✅ **Tranché en `B18`** — le compte
   du détail (neuf) est retenu ; voir la note sous le tableau de `B18` pour le détail complet,
   et pour la découverte que deux des neuf étaient déjà posées par `B17`.
5. **Le mot « planche » désigne deux choses** : la feuille revenue d'une génération, et l'une
   des quatre présentations de la surface.
6. **La planche de l'atelier d'animation est en retard sur le dépôt** : elle annonce « à
   venir » ce que `V3.03.2` et `V3.03.3` ont déjà livré et commité.
7. **Le sommaire ment sur quatre planches.** `Sommaire.html` les marque « à faire » avec un
   fichier vide, et elles sont sur le disque : la sortie, l'atelier de découpe, le contour, la
   différence.

---

## Ce que ce plan ne couvre pas

- **Les décors et les terrains** — mis de côté par l'auteur. 19 outils de famille, zéro écrit.
- **L'ombre portée et le raccord de tuile** — ils demandent que le pipeline sache agrandir un
  canevas au-delà du sujet, et regarder une image voisine. Changement d'architecture.
- **La carte des écrans refaite** — l'auteur l'a lui-même remise à la fin : neuf planches ont
  disparu et une est neuve depuis son écriture.
- **Le report d'un calque d'une pose à une autre** — la planche de la différence dit elle-même
  que ce n'est peut-être pas faisable honnêtement. C'est une étude, pas un ticket.
