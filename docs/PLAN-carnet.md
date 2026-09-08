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
| **6** | `B16`, `B17`, `B18` | les tables rangées, puis les moteurs |
| **7** | `B12`, `B13` ✔, `B19`, `B20`, `B21`, `B22` | l'essai, la grille du jeu, le vestiaire, les calques d'animation, la sortie, la galerie |

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

- [ ] Le personnage se pilote au clavier, et la vitesse jouée est celle qui sortira à l'export.
- [ ] Une animation qui manque le dit et laisse le personnage au repos — il ne joue jamais une
      autre animation à sa place.
- [ ] Le bouton « demander un clip » part d'ici pré-rempli avec la pose et la direction, et son
      prix est annoncé.
- [ ] La scène se règle sans rien fabriquer et sans rien payer.

### Bloquée par

- `B10`, `B11`

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
double l'ancien au lieu de le remplacer** (l'ancien garde le cadre de découpe, la colonne des
sœurs et les trois surfaces à coordonnées, que `B17`/`B18` déménageront), et **le plafond
avait une seconde moitié à l'écran** — la table ne proposait que les tailles du pixel art.

### Bloquée par

- `B0`

---

## B17 · Les moteurs qui remplacent une génération

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

- [ ] Un fichier exporté ne porte plus de magenta sous ses pixels transparents.
- [ ] Une cape change de couleur sans une génération, et la silhouette est identique à
      l'octet près.
- [ ] Les quatre curseurs se posent avant la quantification, et un essai le vérifie sur
      l'ordre de la chaîne.
- [ ] Les recettes existantes rendent la même empreinte qu'avant.
- [ ] Chaque moteur neuf est mesuré : temps de calcul, et ce qu'il épargne.

### Bloquée par

- `B1` — c'est `B1` qui pose la règle « une place neuve ne change pas l'empreinte ».

---

## B18 · Le reste des moteurs

**Planches** : les neuf `atelier-*.dc.html`

### Ce qu'on livre

Les 44 moteurs restants, atelier par atelier, chacun livré avec sa mesure. Ce n'est pas une
tranche : c'est **une file**, prise dans l'ordre où l'usage la réclame, et chaque atelier se
livre seul.

| Atelier | Existants | À écrire |
|---|---|---|
| Détourer | 8 | 5 — la couleur déclarée du jeu, la teinte plutôt que la valeur, la palette en garde-fou, le pinceau remonté en amont, la même passe sur les frames voisines |
| Recadrer | 7 | 6 — taille imposée, format verrouillé, calage sur multiple, centré sur la masse, ligne de pied, rognage d'un bord uni |
| Pixéliser | 4 | 4 — sur les carrés du modèle, couleur dominante de case, médiane de case, lumière juste |
| Couleurs | 7 | 9 — trame régulière, force du tramage, k-moyennes, octree, distance à l'œil, rampes d'ombre… |
| Nettoyer | 2 | 9 — le relevé se contredit sur le compte (9, 11 ou 12) ; à trancher avant de chiffrer |
| Retourner | 1 après `B1` | 9 — haut-bas, quarts de tour, demi-tour, diagonale, repli, zones protégées, rotation libre, RotSprite |
| Contour | 1 procédé | 6 capacités — couleur dérivée, trait inégal, contour sur l'ensemble empilé… |
| Découpe | 2 | 1 — les gouttières, le cas le plus courant d'une planche générée |

**Deux items ne rentrent pas dans le modèle actuel** et sont sortis de cette file : l'ombre
portée et le raccord de tuile. Le pipeline déduit la taille finale de la seule boîte opaque du
sujet — une ombre agrandit le canevas au-delà, et un raccord a besoin des pixels d'à côté.
Ce sont des changements d'architecture, pas des fonctions de plus.

### Critères d'acceptation

- [ ] Chaque atelier livré porte tous ses moteurs à l'écran, et aucun n'est en dur dans le code
      sans réglage.
- [ ] Trois réglages figés dans le code de la réduction sortent enfin à l'écran.
- [ ] Chaque moteur neuf porte sa mesure de temps, et l'écran l'annonce quand elle dépasse
      240 ms.
- [ ] Les 1 347 essais de serveur passent sans modification.

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
son icône — chacun avec ses propres images, et sa matrice de 24 calques.

**Vérifié** : l'emplacement, la portée *contenue*/*agrandit* et ses deux valeurs (92 % / 62 %)
existent déjà. C'est le lien vers un personnage qui manque, et lui seul.

### Critères d'acceptation

- [ ] Une pièce créée depuis la fiche d'un personnage lui est attribuée d'emblée.
- [ ] Une pièce ne porte personne par défaut.
- [ ] Les emplacements de corps restent au jeu, jamais au personnage.
- [ ] Les pièces déjà écrites sur le disque se relisent sans perte et sans porteur.
- [ ] Un calque reste solidaire de sa pose — l'invariant de `C3` tient.
- [ ] Les 19 entrées du guide rangées sous `fabriques` trouvent leur écran.

### Bloquée par

- `B10`

---

## B20 · Les calques d'animation

**Planche** : `Emploi.dc.html`

### Ce qu'on livre

Un calque déjà obtenu se recale sur chaque image d'une animation, gratuitement, sur la
machine. C'est le seul chemin pour qu'un personnage équipé bouge.

**Vérifié** : une bande porte le projet, le personnage, la pose et la direction. Elle n'a
aucun champ *pièce*, et les mots *pièce* et *équipement* n'apparaissent nulle part dans toute
la couche animation. Le calcul de recalage, lui, existe déjà.

### Critères d'acceptation

- [ ] Une bande porte sa pièce, et une case sans animation du personnage reste vide sans
      compter comme un manque.
- [ ] L'écran distingue « le calque tient » (recalé image par image) de « le calque glisse »
      (un seul calage pour toute la bande).
- [ ] Le recalage ne coûte rien et ne rappelle aucun fournisseur.
- [ ] Un calage gardé à la main se réutilise sur la pièce suivante.

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

- [ ] L'arbre des fichiers se lit avant d'écrire, avec le compte et le poids total.
- [ ] Chaque fichier est marqué nouveau, remplacé ou inchangé face à la sortie précédente.
- [ ] Les quatre modes de collision existent, et « remplacer » en est un.
- [ ] Un panneau dit ce qui n'est pas prêt : sujets sans image, personnages à direction unique,
      animations vides.
- [ ] La sortie reste gratuite et fonctionne réseau coupé.
- [ ] Le format Aseprite ne gagne aucune clé de notre cru.

### Bloquée par

- `B10`, `B11`

---

## B22 · La galerie connaît les clips

**Planche** : `Galerie.dc.html`

### Ce qu'on livre

Un clip devient une entrée durable de la galerie, et pas seulement un résultat frais qu'on
regarde une fois. Un coin de lecture avec sa durée ; au survol, les frames défilent en boucle.

**Trois choses à savoir, et la maquette les dit elle-même** : la galerie ne connaît pas les
clips aujourd'hui (le type qu'elle parcourt n'a que deux formes, et le clip n'apparaît que tant
qu'il est le résultat d'un lot) ; une vignette animée réclame une image de couverture que le
serveur ne fabrique pas ; et un clip n'a pas de famille, donc pas de place dans le filtre
actuel.

### Critères d'acceptation

- [ ] Un clip reste dans la galerie après la fermeture de son lot.
- [ ] Ouvrir la galerie ne télécharge aucune vidéo — seule la couverture arrive.
- [ ] Le survol joue les frames en boucle, sans son, et revient à la première en sortant.
- [ ] Un filtre « clips » existe, distinct des six familles.
- [ ] La grille ne ralentit pas quand le jeu porte cent clips.

### Bloquée par

- `B0`, `B3`

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
   en préambule, onze dans un réglage, neuf dans le détail.
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
