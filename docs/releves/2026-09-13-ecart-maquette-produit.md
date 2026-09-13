# Écart entre la maquette validée et le produit — 13 septembre 2026

Ce document croise deux relevés :

- `docs/releves/2026-09-13-carte-de-la-maquette.md` — les 26 écrans et 13 surfaces de la maquette
  `docs/maquettes-atelier-unifie/02-atelier.html`, validée le 12 septembre 2026. **C'est le contrat.**
- `docs/releves/2026-09-13-carte-des-ecrans-du-code.md` — les 99 fichiers d'écran du produit réel.

**Rien n'y est affirmé sans être allé le voir dans `interface/src/`.** Chaque ligne porte son fichier et sa
ligne, ou la recherche qui n'a rien donné. Ce qui n'a pas pu être vérifié est écrit comme un doute, et
rassemblé en fin de document.

Relevé fait sur la branche `feat/remise-a-plat-de-l-interface`, sans modifier un seul fichier.

---

## En un coup d'œil

| | Nombre |
|---|---|
| Écrans de la maquette | **26**, plus 13 surfaces transverses = **39** |
| Tenus par le produit | **0** sur 26 (1 sur 39) |
| Tenus en partie | **22** sur 26 (32 sur 39) |
| Absents du produit | **4** sur 26 (6 sur 39) |
| Écrans du produit absents de la maquette | **30** |
| Désaccords de nom relevés | **plus de 50** |

Les quatre écrans absents : **Clip source**, **Comparer les versions**, **Essayer avant de construire**,
**Vos remarques**. Les deux surfaces absentes : **Bandeau de maquette**, **Brouillons à reprendre**.
Le seul tenu en entier : **Quitter cette retouche ?**

**Ce que ce tableau veut dire.** Aucun écran de la maquette n'est tenu de bout en bout. Ce n'est pas que
le produit soit vide : il en fait souvent plus. C'est que sur chaque écran il manque deux ou trois gestes,
et qu'il les nomme autrement.

**Deux des quatre absences ne sont pas des manques.** « Essayer avant de construire » et « Vos remarques »
sont le mobilier de la maquette : une liste de parcours à essayer, et un carnet de retours. Elles n'ont pas
à être construites. Même chose pour le bandeau « MAQUETTE À ESSAYER ». Les vraies absences sont
**Clip source**, **Comparer les versions** et **Brouillons à reprendre**.

---

## L'ossature : ce qui ne se correspond pas

### Les portes de premier niveau — 9 contre 8, et une qui ment

Maquette : `docs/maquettes-atelier-unifie/prototype.js:124-126`.
Produit : `interface/src/composants/NavigationAtelier.tsx:7-14` (`PORTES`), `:39`, `:40`, `:43`.

| Maquette | Produit | |
|---|---|---|
| Le jeu | **Le jeu** | même mot |
| Univers & toile | **Univers & toile** | même mot |
| Les assets | **Les assets** | même mot |
| Galerie | **Galerie** | même mot |
| Fabrications · N | **Fabrications · N** | le N compte autre chose, voir plus bas |
| Livrer au jeu | **Livrer au jeu** | même mot, mais l'écran est ailleurs, voir plus bas |
| Réglages (les 4 onglets du jeu) | **Réglages → « L'installation »** | **ce n'est pas le même écran** |
| Essayer la maquette | — | mobilier de maquette, sans objet |
| Vos remarques · N | — | mobilier de maquette, sans objet |
| — | **Guide** | en plus |
| — | **Rechercher un geste · Ctrl K** | en plus |
| Arbre des familles et collections | déplacé **dans** l'écran « Les assets » | `interface/src/composants/BibliothequeDesAssets.tsx:96-104` |
| Brouillons · N | — | absent |
| Lien « Couverture et limites » | — | absent |
| Lien « Planches de référence » | — | absent |

**Le piège de « Réglages ».** Dans la maquette, il ouvre les règles du jeu — nom, monde, direction
artistique, taille, moteurs, agent, consommations. Dans le produit, il ouvre `Installation`, c'est-à-dire
la machine : clés, ComfyUI, dossier de travail. Preuve : `interface/src/App.tsx:1804` —
`else setInstallationOuverte(true)`. Le titre de l'écran est « L'installation »
(`interface/src/composants/Installation.tsx:1165`).

**Le compteur de « Fabrications » ne compte pas les fabrications.** Il est alimenté par
`travauxEnCours={enVol?.images ?? 0}` (`interface/src/App.tsx:1793`), où `enVol.images` est le nombre
d'emplacements d'images du chantier de la galerie (`interface/src/paiement.ts:241-274`). Une animation,
un équipement, une source 3D, un son, une vidéo libre ou une image locale en cours **n'y entrent pas**.

**L'arbre des familles a changé d'étage.** La maquette le pose dans la colonne, visible partout. Le produit
le pose dans l'écran « Les assets » : les trois libellés existent — `Trouver une collection`
(`BibliothequeDesAssets.tsx:97`), `Tout voir` (`:102`), `+ Collection` (`:104`) — mais ils disparaissent
dès qu'on quitte cet écran.

### Les onglets de la fiche d'un asset — 5 contre 6, et deux cachés

Maquette : 5 onglets, `docs/maquettes-atelier-unifie/prototype.js:169`.
Produit : `interface/src/composants/PageDuSujet.tsx:25-32`, rendus en `:329`.

| Maquette | Produit |
|---|---|
| Animations | **Animations** |
| Images fixes | **Images fixes** |
| Sources & clips | **Sources & clips** |
| — | **Pas encore rangé** (en plus) |
| Équipement | **Équipement** — affiché seulement si `ouvert.equipable` (`:329`) |
| Objectif & règles | **Objectif & règles** |

Et deux états d'onglet **sans bouton dans la barre** :

- `essai`, déclaré en `PageDuSujet.tsx:19` mais absent de `ONGLETS`. On y entre par
  « Tester les animations » (`:336`), on en sort par « Retour aux animations » (`:337`).
- `fiche`, la valeur de départ tenue par `App.tsx:946`, traduite en onglet réel dès l'affichage (`:145`).

### Les tables de retouche — 8 contre 8, et deux fabriques en plus

Maquette : Main, Détourage, Recadrage, Pixelisation, Couleurs, Nettoyage, Contour, Retourner.
Produit : `interface/src/recette.ts:565-580`, libellés en `interface/src/composants/Retouche.tsx:162-173`.

| Maquette | Produit |
|---|---|
| Main | **La main** |
| Détourage | **Détourer** |
| Recadrage | **Recadrer** |
| Pixelisation | **Pixéliser** |
| Couleurs | **Couleurs** |
| Nettoyage | **Nettoyer** |
| Contour | **Le contour** |
| Retourner | **Retourner** |
| — | **Découper** (fabrique) |
| — | **Superposer** (fabrique) |

Les huit tables y sont. Deux libellés sur huit coïncident : la maquette nomme par le nom, le produit par
le verbe. Le sélecteur les appelle collectivement « Outil de retouche » (`Retouche.tsx:3058`).

### Un écran de Réglages contre cinq endroits, dont deux sans chemin de clic

| Onglet de la maquette | Où c'est dans le produit | Comment on y arrive |
|---|---|---|
| **Univers** (nom, monde, allure, taille) | `ReglesDuJeu.tsx:1461`, mode `reglages`, titre « Les règles de ce jeu » (`:1715`) | **aucun chemin.** `setReglesOuvertes(true)` n'est jamais appelé — `App.tsx:271` (déclaration) et `App.tsx:1883` (`false`) sont les deux seules lignes |
| **Moteurs & workflows** (1/2) | `Installation.tsx:102-114`, étapes « Les images » et « Les animations » | colonne → Réglages |
| **Moteurs & workflows** (2/2) | `WorkflowsLocaux.tsx:36`, « Les workflows locaux » | colonne → Fabrications → déplier « Mes méthodes locales » |
| **Agent MCP** (1/2) | `ReglesDuJeu.tsx:1188`, `BlocAgent` dans `PanneauAtelier` | bande du haut → « N sur M », **et seulement s'il manque un fournisseur** (`EnTeteDeSurface.tsx:128`) |
| **Agent MCP** (2/2) | `DelegationDuJeu.tsx:90`, « Déléguer à l'agent » | **aucun chemin.** Rien n'écrit jamais `genre: "delegation"` |
| **Consommations** | `Depenses.tsx:486`, « Ce qui a été dépensé » | bande du haut → le total ; ou Fabrications → « Consommation » |

### Un écran « Livrer au jeu » contre deux onglets qui ne se parlent pas

`interface/src/composants/Livraisons.tsx:16-19`, `aria-label="Type de livraison"` :

- **Livrer dans Godot** (`:17`) — se pilote **par sujet** (`setSujetId`, `:29`), puis par animation ou par
  image fixe. Pas de décompte agrégé.
- **Exporter des fichiers** (`:18`) — monte `Sortie`, titre « La sortie » (`Sortie.tsx:338`). C'est là que
  vivent les comptes que la maquette demande : « nouveaux », « remplacés », « inchangés », « à effacer »
  (`Sortie.tsx:519-535`). Mais on n'y coche rien.

L'écran unique de la maquette est donc coupé en deux, et **ni l'une ni l'autre moitié ne fait tout**.

### Deux fenêtres de fabrication contre huit, et une relecture contre six

Maquette : « Préparer une fabrication » puis « Relire avant l'envoi ».

Huit fenêtres de préparation dans le produit, plus une d'aiguillage :

| Nom affiché | Où |
|---|---|
| « Fabriquer pour {nom} » (aiguillage, 3 portes) | `ChoisirFabricationDuSujet.tsx:37-38` |
| « Préparer une image » | `App.tsx:2856` + `BarreQuiPaie.tsx:150-231` |
| « Fabriquer une image locale » | `WorkflowsLocaux.tsx:124` |
| « Animer {nom} — {pose} » | `Clip.tsx:492` |
| « Préparer une animation » | `FabricationSuivie.tsx:136-137` |
| « Fabriquer une vidéo libre » | `FabricationVideoLibre.tsx:104` |
| « Fabriquer un bruitage » | `FabricationAudio.tsx:39-40` |
| « De l'image aux sprites en 3D » | `Fabrication3D.tsx:76` |
| « Images équipées · {pièce} » | `RelectureEquipement.tsx:90-92` |

Six écrans de relecture, et **un seul** est `EcranEnvoi` : `grep EcranEnvoi` hors essais ne rend qu'un
montage, `App.tsx:1968`. Les cinq autres sont des vues internes : `RelectureEquipement.tsx:143`,
`FabricationVideoLibre.tsx:137`, `Fabrication3D.tsx:85`, `FabricationAudio.tsx:55`,
`WorkflowsLocaux.tsx:134`, plus le tiroir de `Clip.tsx:818-1048`.

### Le fil d'Ariane — plus riche, mais sans retour et parfois vide

`interface/src/composants/EnTeteDeSurface.tsx:42-92` (`Fil`), alimenté par `interface/src/lieux.ts:360`.

- Le chemin est **plus détaillé** que celui de la maquette : il nomme chaque étage traversé, pas seulement
  « jeu / asset / écran ».
- **Les flèches « ← » et « → » n'existent pas**, ni Alt + flèche. Rien trouvé pour `altKey` en dehors d'un
  garde (`App.tsx:1065`). `lieux.ts` n'expose que `entrer` / `sortir` / `poser` / `remonterA` : il n'y a pas
  d'historique linéaire.
- **Le fil est vide sur six écrans.** `interface/src/lieux-noms.ts:95-98` rend `null` pour `galerie`,
  `univers` et `tableau-de-bord` ; `:200-206` rend `null` pour `clip`, `envoi`, `montage`, `bande` et
  `montage-de-bande`.
- **« Fond des images » n'existe pas.** Rien trouvé pour `Fond des images` dans tout `interface/`.

---

## Écran par écran

Les 26 écrans de la maquette, dans l'ordre de son relevé. Les 13 surfaces transverses suivent.

---

### Le jeu → `TableauDeBord.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Lire le nom du jeu et la phrase qui le décrit | partiel | nom : `TableauDeBord.tsx:104-106`. La phrase dessous n'est pas une description mais « N images · $X dépensés » (`:107-114`). La description du monde n'est jamais lue ici |
| « Créer un asset » | tenu | `TableauDeBord.tsx:124` |
| « Ouvrir la toile » | tenu | `TableauDeBord.tsx:129` |
| « Ouvrir le pèlerin » (ouvrir un asset) | partiel | aucun bouton ne nomme un asset. Le seul saut direct est une ligne de « Ce qui manque le plus » (`:204-209`), et elle n'apparaît que si le serveur renvoie des manques |
| « Parcourir les assets », « Préparer la livraison » | tenu | `TableauDeBord.tsx:130` |
| « Commencer la visite » | absent | rien trouvé pour `Commencer la visite` |
| Compteurs : assets, résultats, retenus | partiel | « N images » (`:108`) et un compte par famille (`:153`). **Résultats et retenus : rien trouvé** |

**Ce qui manque en une phrase** : la phrase qui décrit le jeu, l'ouverture directe d'un asset, et les deux
compteurs qui disent où en est la production.

**En plus de la maquette** : « Suivre les fabrications et reprendre les résultats → » (`:131`), une barre de
complétude par famille (`:158-165`), le bloc « Ce qui manque le plus » avec le prix de chaque manque
(`:181-241`), et l'avis « Une feuille attend d'être découpée » (`:262-270`).

---

### Univers & toile → `Univers.tsx` + `Toile.tsx` + `Tableau.tsx` + `Ambiances.tsx`

**Verdict : partiel** — 1 geste tenu, 7 partiels, 8 absents sur 16.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| « + Note », « + Image », « Depuis la galerie », « + Îlot » | partiel (1 sur 4) | `+ note` : `Tableau.tsx:759`. Une image entre par Ctrl+V ou par dépôt (`:237-271`, `:281-307`), sans bouton. Un îlot naît en tapant un nom dans le champ « Groupe » (`:1439`). Rien trouvé pour `Depuis la galerie` |
| Champ « Rechercher » qui filtre les cartes | absent | rien trouvé pour `Rechercher` dans `Tableau.tsx`, `Toile.tsx`, `Univers.tsx` |
| Déplacer une carte par sa barre de titre ; un îlot par son nom | partiel | l'îlot se tire bien par son bandeau (`Toile.tsx:2207`, `:2227`) et ses cartes suivent (`api.ts:5786`). La carte, elle, se tire **par toute sa surface** : pas de barre de titre, un pied (`Tableau.tsx:1095-1123`) |
| « Déplacer la vue » / « Main active » ; Espace + glisser ; molette | partiel | molette : tenu (aucun `zoomOnScroll` écrit, défaut de la librairie). **Espace + glisser : désactivé exprès** — `Toile.tsx:1838`, `panActivationKeyCode={null}`. Rien trouvé pour `Main active` |
| Champ « Zoom » 25–200 % ; « Tout cadrer » | absent | aucun contrôle de zoom. Bornes réelles 20–250 % (`Toile.tsx:1798-1799`). Le cadrage est automatique **une seule fois** à l'ouverture (`:1097-1114`) |
| « Relier deux cartes » puis choisir les deux | partiel | on tire un trait depuis un rond (`Toile.tsx:2524-2532`). Le mode « cliquer pour armer » est désactivé : `:1809`, `connectOnClick={false}` |
| Case « Sélectionner » ; compteur de sélection | absent | **il n'y a pas de sélection multiple.** Un seul état, `const [choisie, setChoisir] = useState<string \| null>(null)` (`Univers.tsx:119`) |
| « Annoter » ou double-clic (titre, texte, îlot, X, Y) | partiel | le double-clic **crée une note neuve** (`Toile.tsx:1769`), il n'annote pas. Le menu d'une carte a Groupe, Note, Taille, Texte, Teinte (`Tableau.tsx:1439-1505`) — **pas de titre, pas de X ni Y** |
| « Mettre en réserve » / « Reposer sur la toile » | partiel | le tiroir existe et porte le bon nom : `Réserve` (`Tableau.tsx:590`). Les deux boutons n'existent pas : c'est un glisser-déposer (`Univers.tsx:155-167`, `Tableau.tsx:315`), et pour une carte à la fois |
| « Effacer la sélection » | absent | rien trouvé. Le voisin est « Retirer » (`Tableau.tsx:1664`), qui **supprime** la carte |
| « Cadre » sur un îlot (largeur, hauteur, ajuster) | absent | le menu d'un îlot ne tient que « Teinte de l'îlot » et deux boutons (`Toile.tsx:2308-2395`). La boîte est toujours calculée sur ses membres (`:369`, `:255`) |
| « Fabriquer depuis la sélection / la toile / cet îlot » | partiel | deux boutons sur un îlot, et ils ne fabriquent pas d'image : « faire une palette de ce paquet » (`Toile.tsx:2353`), « faire une ambiance de ce paquet » (`:2367`) |
| « Découper » sur une carte image | tenu | `Tableau.tsx:1628` — `Découper ›` |
| « Ouvrir le résultat » sur une carte de la galerie | absent | rien trouvé pour `Ouvrir le résultat` dans tout `interface/src/` |
| « Règles de l'univers » vers les Réglages | absent | rien trouvé. Le côté « Réglages » de cet écran a été retiré (`Univers.tsx:198-200`) |
| Fenêtre « Choisir ce qui part de la toile » | absent | rien trouvé pour `Choisir ce qui part` ni `Préparer avec ces références`. **Aucun chemin ne part de la toile vers une fabrication** |

**Ce qui manque en une phrase** : il n'y a pas de sélection multiple, et rien ne part de la toile vers une
fabrication — c'est pourtant ce que la maquette donne comme la sortie de l'écran.

**En plus de la maquette** : tout le côté « Ambiances et couleurs » (`Univers.tsx:329`, `Ambiances.tsx:48`),
la bascule grille / toile (`Tableau.tsx:761-766`), le collage Ctrl+V et le dépôt de fichiers
(`Tableau.tsx:237-307`), le bandeau de doublon (`:640-672`), les réglages de lien — Mot, Pointe, Couper
(`Toile.tsx:2692-2722`), la poignée de largeur d'une carte (`:2777`), Ctrl+Z (`:1213-1224`).

---

### Les assets → `BibliothequeDesAssets.tsx` (et `Famille.tsx`, en double)

**Verdict : partiel**

Correspondance **un-vers-deux** : `BibliothequeDesAssets` est la porte « Les assets » ; cliquer une famille
depuis elle, ou depuis le tableau de bord, ouvre `EcranFamille` (`App.tsx:778-788`), qui relit la même
route et refait recherche, filtre, sélection et rangement.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| « Rechercher un asset » | tenu | `BibliothequeDesAssets.tsx:112` |
| Filtre « À faire » : Tous, À produire, À juger, Modifiés depuis livraison | partiel | le libellé `À faire` existe (`:113`), mais les valeurs sont `Tous les assets`, `Images fixes à compléter`, `Description à écrire`. Le type serveur n'en connaît que trois (`api.ts:3357`). Rien trouvé pour `À produire`, `À juger`, `Modifiés depuis` |
| Tri : Nom A → Z, Nom Z → A, Plus de résultats | tenu | `BibliothequeDesAssets.tsx:114` |
| « Liste » (40/page) / « Grille » (24/page) | partiel | la bascule existe (`:115`). Une seule limite pour les deux vues, 60 par clic (`:27`, `:136`) |
| « Réinitialiser les filtres » | tenu | `BibliothequeDesAssets.tsx:118` |
| Cocher un asset ; « Sélectionner cette page » | partiel | la case existe (`:127`). Le bouton s'appelle `Sélectionner les sujets affichés` (`:119`) et **ne coche que les sujets** : les pièces d'équipement n'ont pas de case (`:133`) |
| « Ranger la sélection » | tenu | `:119`, puis le panneau `:121` — `Collection de destination`, `Garder le rangement`, `Nouvelle collection`. La maquette passait par deux fenêtres, le produit par une |
| « Retirer de cette collection » | tenu | `BibliothequeDesAssets.tsx:119` |
| « Effacer la sélection » | tenu | `BibliothequeDesAssets.tsx:119` |
| « Nouvelle collection », « Renommer », « Archiver », « Collections archivées », « Restaurer », « Annuler le dernier rangement » | partiel (1 sur 6) | `Nouvelle collection` : `:93`. **Les cinq autres : rien trouvé.** L'API n'expose que `creerCollection` (`api.ts:4963`), `supprimerCollection` (`:4969`), `rangerSujet` (`:4982`), `retirerSujet` (`:4990`) |
| « Toutes les familles » | tenu | `BibliothequeDesAssets.tsx:98` |
| « Ouvrir » sur un asset | tenu | `Ouvrir →` (`:130`) ; `Voir les emplois →` pour une pièce (`:133`) |
| « Créer un asset » | tenu | `:93`, puis `CreerUnAsset.tsx:27` |
| Pagination « Précédent » / « Suivant » | absent | rien trouvé dans ce fichier. À la place : `Afficher davantage d’assets` (`:136`), +60 par clic, plafond 1000 |
| Sur la carte : résultats, retenus ; pour une pièce, emplois et calques prêts | partiel | résultats : `Images {fait}/{attendu} · Animations {fait}/{attendu}` (`:130`). **Retenus : absent** — `CompteDuSujet` n'a pas ce champ (`api.ts:3338-3342`). **Carte d'une pièce : aucun compte** (`:133`) |

**Ce qui manque en une phrase** : la vie des collections (renommer, archiver, restaurer, annuler), les
filtres de production, et le compte de ce qui est retenu.

**En plus de la maquette** : les portes `Les tuiles` et `Les sons` (`:107`),
`Tous les résultats dans la galerie` (`:108`), `Ouvrir et organiser` vers `EcranFamille` (`:117`), le
glisser-déposer sur une collection (`:84-88`), la ligne de comptes `{n} sujets · {n} équipement(s) ·
{n} sélectionné(s)` (`:119`), et la mémoire du parcours (`:19-33`).

---

### Galerie → `Galerie.tsx` + `GalerieMedias.tsx` + `BarreOutils.tsx` + `Tuile.tsx` + `Fiche.tsx`

**Verdict : partiel** — c'est l'écran de départ du produit (`lieux.ts:214`), et c'est celui où il manque
le plus de gestes.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| « Rechercher un résultat » | tenu | `Rechercher dans les résultats` (`GalerieMedias.tsx:161`) |
| Filtre « Média » : Tous, Image, Animation, Vidéo, 3D | partiel | la bascule existe : `Images`, `Animations`, `Vidéos`, `Modèles 3D`, `Sons` (`GalerieMedias.tsx:18-24`). Pas de valeur « Tous » ; « Sons » en plus |
| Filtre « Rôle » (8 valeurs) | absent | le filtre serveur ne porte que `collection`, `favoris`, `recherche` (`api.ts:3825-3829`). Rien trouvé pour `Clip source`, `Source équipée`, `Planche`, `Calque` comme options |
| Filtre « Jugement / état » (8 valeurs) | absent | rien dans la galerie. Le seul tri par jugement est le bouton binaire `Favoris` (`BarreOutils.tsx:192`) |
| Filtre « Rattachement » : par asset, ou « Essais libres » | partiel | `sans chose du jeu` (`BarreOutils.tsx:170`) tient les essais libres. Le choix **par asset** n'existe pas : c'est une liste de familles |
| Tri : Plus récents, Plus anciens, Nom A → Z | absent | l'ordre est figé, date décroissante (`Galerie.tsx:750-752`). Aucun `setTri` |
| « Afficher séparément » / « Regrouper par fabrication » | absent | rien trouvé pour `Regrouper par`. La grille est plate (`Galerie.tsx:348-353`) |
| « Tout déplier », « Tout replier », « Ouvrir les dérivés » | absent | rien trouvé. Le voisin est le bloc `Filiation` de la fiche de droite (`Fiche.tsx:1120`) |
| « Ouvrir le résultat », « Ouvrir la planche », « Ouvrir l'emploi et sa frame » | partiel (2 sur 3) | `Ouvrir la fiche` / `Ouvrir la planche` (`Tuile.tsx:248`). **Rien trouvé pour `Ouvrir l'emploi`** |
| « Poser sur la toile » | tenu | `Fiche.tsx:400`, branché `Galerie.tsx:1394-1398` |
| « Fabriquer librement » | absent de cet écran | rien trouvé. La galerie dit le contraire : « aucun appel ne part d'ici » (`Galerie.tsx:1353`) |
| Pagination « Précédent » / « Suivant » | partiel | `Précédent` / `Suivant`, 24 par page (`GalerieMedias.tsx:266`, `:26`) — mais seulement pour 3 médias sur 5. Images et vidéos ont `Charger la suite ›` (`Galerie.tsx:1344`) |
| Fenêtre : « Rattacher à un asset », « Lire le clip », « Monter une animation », « Préparer des rendus 3D » | absent | rien trouvé pour `Rattacher à un asset` ni `Préparer des rendus`. La lecture existe (`FicheDuClip.tsx:121-130`), le montage s'appelle `Découper ›` (`Tuile.tsx:518`), la 3D `Ouvrir la source 3D ›` (`GalerieMedias.tsx:236`). Et c'est un volet fixe de 380 px, pas une fenêtre |
| Vignettes animées au survol | tenu | `Tuile.tsx:272-279` et `GalerieMedias.tsx:223` |

**Ce qui manque en une phrase** : sur l'écran d'ouverture du produit, on ne peut ni trier, ni filtrer par
rôle, ni filtrer par jugement, ni regrouper une planche avec ce qui en est sorti.

**En plus de la maquette** : les onglets `Modèles 3D` et `Sons` (`GalerieMedias.tsx:22-23`), toute la barre
d'outils de sélection — `Ranger…`, `Favori`, `Supprimer`, `Exporter {n}` (`BarreOutils.tsx:192-432`) —,
l'annulation de suppression à rebours (`:367-372`), le zoom 1× / 2× / 4× (`:203-218`), le dépôt de fichier
sur la grille (`Galerie.tsx:303-306`), la sélection Ctrl et Maj (`:780-807`), et le fait que ce qui est en
cours de fabrication **tienne sa place dans la grille** avec sa jauge (`Galerie.tsx:681-723`,
`Tuile.tsx:281-288`).

---

### Fabrications → `Fabrications.tsx` + `FabricationSuivie.tsx` + `FileDesCalculsLocaux.tsx` + `WorkflowsLocaux.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| « Fabriquer librement » → fenêtre « Fabrication libre » | partiel | le geste existe, le nom non : `Nouvelle fabrication` (`Fabrications.tsx:55`), `Préparer une image` (`:59`). Rien trouvé pour `Fabriquer librement` |
| Section « Explorations libres » | partiel | pas de section. Des cartes : `Une image libre` (`:59`), `Une vidéo libre` (`:62`), `Un son` (`:63`). Les travaux libres sont fondus dans une liste unique (`FabricationSuivie.tsx:208`) |
| Section « Équipements · images fabriquées » | partiel | fondue dans la même liste. La fenêtre s'appelle `Images équipées · {pièce}` (`RelectureEquipement.tsx:90`) |
| Section « Travaux des sources 3D » | partiel | fondue aussi (`FabricationSuivie.tsx:208`). Les vrais écrans 3D sont sur la page de l'asset (`Fabrication3D.tsx:76`, `Sources3D.tsx:59`) |
| « Relire l'envoi » | tenu, sous six noms | `Relire les envois` (`FabricationSuivie.tsx:173`), `Relire l'envoi` (`WorkflowsLocaux.tsx:134`), `Relire l'envoi vidéo` (`FabricationVideoLibre.tsx:137`), `Relire avant envoi` (`RelectureEquipement.tsx:143`), `Relire avant de générer le son` (`FabricationAudio.tsx:55`), `Relire cette étape avant de lancer` (`Fabrication3D.tsx:85`) |
| « Interrompre » | partiel | seulement pour les équipements (`Arrêter les appels restants`, `RelectureEquipement.tsx:144`) et la file locale (`Annuler cette attente`, `FileDesCalculsLocaux.tsx:76`). **Aucun bouton d'interruption** pour l'animation, la vidéo libre, l'image locale, le son ni la 3D |
| « Voir le résultat » | tenu | `Ouvrir le clip et son montage` (`FabricationSuivie.tsx:170`), `Voir les résultats dans la galerie` (`Fabrications.tsx:71`) |
| « Reprendre explicitement » | tenu | `Reprendre ce travail` (`FabricationSuivie.tsx:173`), `Reprendre le suivi conservé` (`FabricationVideoLibre.tsx:144`) |
| « Préparer l'animation avec cette référence » | absent | rien trouvé pour `Préparer l'animation` |
| Compteur de travaux en attente | partiel | la pastille existe (`NavigationAtelier.tsx:36`), mais elle compte les emplacements d'images du chantier de la galerie, pas les travaux (`App.tsx:1793`, `paiement.ts:241-274`) |

**Ce qui manque en une phrase** : on ne peut pas interrompre une fabrication en cours sauf pour
l'équipement, et le compteur de la colonne ne compte pas ce qu'il annonce.

**En plus de la maquette** : le bloc « Les calculs locaux » avec l'état des moteurs
(`FileDesCalculsLocaux.tsx:49-79`), le repli « Mes méthodes locales » et ses workflows ComfyUI
(`WorkflowsLocaux.tsx:39-53`), le journal filtrable par recherche et par état (`Fabrications.tsx:68`), et
la colonne « Agent » / « Création manuelle » sur chaque travail (`FabricationSuivie.tsx:208`).

---

### Livrer au jeu → `Livraisons.tsx` (2 onglets) + `Sortie.tsx` + `ImagesALivrer.tsx`

**Verdict : partiel**

Correspondance **un-vers-trois**. L'écran de la maquette est coupé en deux onglets, et le second
(`Sortie`) porte les comptes que le premier n'a pas.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Lire, changer, garder la destination | partiel | `Dossier contenant project.godot` (`Livraisons.tsx:93`), `Sous-dossier des assets` (`:96`), `Associer ce projet` → `Projet associé` (`:99-101`). Rien trouvé pour `Changer la destination` ni `Garder cette destination` |
| Décompte : nouveaux, modifiés, inchangés, conflits, sélectionnés | partiel | onglet Godot : état **par ligne de fichier** seulement (`Livraisons.tsx:132`). Onglet Exporter : `nouveaux`, `remplacés`, `inchangés`, `à effacer` (`Sortie.tsx:519-535`). **Conflits et sélectionnés : nulle part** |
| « Sélectionner nouveaux et modifiés », « Tout sélectionner » | absent | rien trouvé pour `Tout sélectionner` ni `Sélectionner nouveaux` dans tout `interface/src` |
| Cocher ou décocher chaque ligne | partiel | une case **par animation** (`Livraisons.tsx:114`), un choix unique par vignette d'image (`ImagesALivrer.tsx:49`). **Aucune case sur les lignes de fichiers** (`Livraisons.tsx:132`, `Sortie.tsx:494-510`) |
| Déplier « N fichiers prévus » et lire les noms | partiel | les noms sont lus, en `font-mono`, avec état et poids (`Livraisons.tsx:132`) — mais la liste n'est jamais repliée. Rien trouvé pour `fichiers prévus` |
| « Relire l'animation / image » frame par frame, « Corriger cette frame » | partiel | la relecture existe (`Livraisons.tsx:123`, `ImagesALivrer.tsx:53`), mais c'est une vignette de 54 px qui tourne seule, **sans contrôles** (`Livraisons.tsx:115`). `Corriger cette frame` existe ailleurs, dans les calques d'équipement (`LectureDesCalques.tsx:124`) |
| « Retoucher » pour ouvrir la Retouche | absent | rien trouvé dans `Livraisons.tsx`, `ImagesALivrer.tsx` ni `Sortie.tsx` |
| Conflit : « Décider avant de livrer », trois choix | absent | le produit **bloque** au lieu de proposer : chaque conflit est un `role="alert"` (`Livraisons.tsx:133`) et le bouton est désactivé par `!apercu.pret` (`:134`). Côté serveur, deux raisons seulement (`atelier/services/livraison.py:388-394`) |
| Lancer la livraison | tenu | `Livrer ces versions dans Godot` (`Livraisons.tsx:139`) ; `Sortir {N} fichier(s) ›` (`Sortie.tsx:452`) |
| « Historique », « Relire cette livraison », « Relire cette version livrée » | partiel | la section s'appelle `Les livraisons conservées` (`:141`), n'est pas repliable, et n'a qu'un bouton : `Reprendre cette révision` / `Reprendre la livraison` (`:153`) |
| « Choisir des résultats » pour revenir aux assets | absent | rien trouvé. Le retour est `Retour à l'atelier` (`:86`) et le choix se fait par un menu `Asset` (`:105`) |
| Noms de fichiers stables | tenu | le chemin vient de l'identifiant, pas du nom (`atelier/services/livraison.py:250`, `:296`, `:56`) ; le nom de l'animation vient de pose/direction/pièce (`:262`). Dit à l'écran en `Livraisons.tsx:130` |
| Brouillon non enregistré signalé et exclu | absent pour animations et images | le filtre ne teste que `!b.supprime && b.compte > 0` (`Livraisons.tsx:47`). La règle est tenue ailleurs : tenues (`TenuesDuSujet.tsx:101`), tuiles (`Tuiles.tsx:127`), sons (`AtelierSon.tsx:69`) |

**Ce qui manque en une phrase** : on ne peut pas décider d'un conflit — il bloque —, on ne sélectionne rien
en masse, et un brouillon non enregistré part sans avertir.

**En plus de la maquette** : la bascule `Animations` / `Images fixes` (`Livraisons.tsx:109`), la case
`Jouer en boucle` (`:117`), le repli `Repère du personnage dans Godot` (`:120-122`), le choix
`Objet ou décor dans le monde · Sprite2D` / `Portrait ou interface · TextureRect` (`ImagesALivrer.tsx:51`),
et tout `Sortie.tsx` : cinq blocs numérotés, quatre règles de collision, quatre moteurs cibles, la colonne
« Ce qui n'est pas prêt » (`Sortie.tsx:345-605`).

**À savoir** : les sons, les tuiles et les tenues ne passent pas par cet écran. Ils se livrent depuis leur
propre atelier (`AtelierSon.tsx:69-70`, `Tuiles.tsx:131`, `TenuesDuSujet.tsx:100-101`).

---

### Fiche de l'asset → `PageDuSujet.tsx` + `FicheDuSujet.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Lire nom, famille, sorties, description, résultats, retenus | tenu | `PageDuSujet.tsx:300` (nom, famille, sorties) ; `FicheDuSujet.tsx:63-64` (description, `{n} résultats`, `{n} retenus pour le jeu`) |
| « Modifier la fiche » (nom, famille, sorties, description) | partiel | le bouton existe (`FicheDuSujet.tsx:64`), le dialogue s'appelle `La fiche de l’asset` (`:68`). **La famille est en lecture seule** (`:74`). **Rien trouvé pour `Sorties souhaitées`** dans tout `interface/src` |
| « Importer » (image de 2 Mo max, ou clip de démonstration) | partiel | `Importer…` (`ImporterIntelligemment.tsx:122`), qui accepte image **et** vidéo et devine ce que c'est (`:61-125`). Rien trouvé pour une limite de 2 Mo ni pour un clip de démonstration |
| « Fabriquer… » | tenu | `PageDuSujet.tsx:319` |
| « Découper une image », « Extraire un élément » | tenu | `PageDuSujet.tsx:334`, `:335`. Grisés sans image visée, avec la raison « Choisissez une image dans Images fixes. » |
| Changer d'onglet | tenu | `PageDuSujet.tsx:328-330` |
| « Retour au personnage » | absent | rien trouvé dans `interface/src` |
| L'onglet mémorisé par asset | tenu | `App.tsx:945-946`, clé `sujet:{projet}:{id}:onglet`. Mémoire de session, pas de rechargement (`MemoireDuParcours.tsx:5-9`) |

**Ce qui manque en une phrase** : on ne peut changer ni la famille ni les sorties souhaitées depuis la
fiche, et une image issue d'une découpe ne ramène pas à son personnage.

**En plus de la maquette** : « Tester les animations » (`:336`), le bouton « Livrer… » (`:320`), le menu
« Autres outils » et ses quatre entrées — `Voir la grille du jeu`, `Comparer`, `Retoucher l’image`,
`Cases, planches et calibrage` (`:341-346`) —, l'onglet « Pas encore rangé » (`:29`), et la fiche longue
`FicheDeLaChose`, enterrée sous la matrice (`EtabliDuSujet.tsx:1445`).

---

### Fiche de l'asset — onglet Animations → `AnimationsDuSujet.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| « Choisir mouvements & directions » | absent de cet onglet | rien trouvé pour `Choisir mouvements`. L'équivalent est dans l'onglet Objectif, `Ce qu’il faut pour le jeu` (`ObjectifDuSujet.tsx:87`) |
| Déplier un mouvement ; comptes et « à départager » | tenu | `AnimationsDuSujet.tsx:657-665`, `:672-676`, `:150-152` |
| Une rangée par direction : retenue / autres / écartées | tenu | `AnimationsDuSujet.tsx:334-414`, `la retenue` (`:320`), `{n} écartées` (`:371-411`) |
| Survol qui anime, clic qui retouche | partiel | survol tenu (`:185`, `:197`). Dans une rangée, le clic **ouvre le volet** (`:705`) ; il faut un **double-clic** pour la retouche (`:596-599`). Dans la galerie du bas, le simple clic ouvre bien (`:736`) |
| Juger : « ● », « ○ », « ⊘ » | tenu | `AnimationsDuSujet.tsx:230`, `:242`, `:250` |
| « + générer » à droite d'une rangée | tenu | `AnimationsDuSujet.tsx:268-283` |
| Filtres « Mouvement / pose », « Direction », « Jugement » | tenu | `AnimationsDuSujet.tsx:729`, `:730`, `:731` |
| Sur la carte : Retoucher, ☆ Favori, Choisir pour le jeu, Comparer, Reprendre le montage / la découpe / l'extraction, Écarter | partiel (3 sur 8) | `Retoucher` (`:740`), le `●` qui retient et le `⊘` qui écarte (`:739`). **Rien trouvé pour `☆ Favori`, `Choisir pour le jeu`, `Reprendre la découpe`, `Reprendre l’extraction`.** `Comparer` n'est qu'au niveau de la page, et compare deux sujets. `Reprendre le montage ›` est un cran plus loin (`AtelierDeBande.tsx:2349`) |
| Retenir démet les autres de la même rangée | tenu | `AnimationsDuSujet.tsx:536-549` |

**Ce qui manque en une phrase** : la carte d'un résultat ne porte ni favori, ni comparaison, ni reprise
de découpe ou d'extraction.

---

### Fiche de l'asset — onglet Images fixes → `ImagesDuSujet.tsx` + `Fiche.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| « Fabriquer une image » | absent de cet onglet | rien trouvé dans `ImagesDuSujet.tsx`. À la place : la case `+ générer` par rangée (`:302-317`) et le `Fabriquer…` de la page (`PageDuSujet.tsx:319`) |
| Sur la carte : Retoucher, ☆ Favori, Choisir pour le jeu, Comparer, Écarter, reprises | partiel | le produit n'a pas de cartes mais des rangées de vignettes (`ImagesDuSujet.tsx:362-384`) plus un volet `Fiche` (`:818-846`). `La retoucher` (`Fiche.tsx:393`), `favori` / `◤ favori` (`:898`), le `●` qui retient (`ImagesDuSujet.tsx:266`), `L'écarter` (`Fiche.tsx:415`). **Comparer et les reprises : rien trouvé** |

**Ce qui manque en une phrase** : comparer et reprendre une découpe ou une extraction ne se font pas
depuis une image.

**En plus de la maquette** : `Reprendre dans l'établi` (`Fiche.tsx:380`), `En générer une variante`
(`:406`), la réinjection avec ses rôles (`:929-941`), `PNG ↓` (`:428`), et l'avis
`Sa direction est à confirmer` (`:296`).

---

### Fiche de l'asset — onglet Sources & clips → `SourcesDuSujet.tsx` + `Sources3D.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Les trois étapes annoncées | partiel | deux maillons seulement : `De l'image au clip, puis aux frames` (`SourcesDuSujet.tsx:87`). Le montage n'est pas nommé |
| « Créer un clip vidéo » | partiel | `Préparer un clip vidéo` (`:87`) |
| « Importer une image de départ » | absent | le bouton de cet écran est `Importer une vidéo` (`:87`). Côté 3D on ne fait que **choisir** : `Choisir l'image de départ` (`Fabrication3D.tsx:80`) |
| « Préparer une source 3D », « Reprendre <nom> », « Nouvelle source 3D » | partiel | `Préparer une étape 3D` (`Fabrication3D.tsx:76`). La reprise existe sous forme de liste d'étapes (`:78`). Rien trouvé pour `Nouvelle source 3D` |
| « Voir le clip et ses étapes », « Monter une autre animation » | partiel | `Monter une animation` (`SourcesDuSujet.tsx:90`). **`Voir le clip et ses étapes` : rien trouvé** — la carte porte un `<video controls>` en ligne et un repli `Demande et paramètres conservés` |
| « Voir tous les clips de la galerie » | absent | rien trouvé dans ce fichier. À la place, un champ `Rechercher un clip` (`:88`) |
| Frames, cadence, durée disponible, durée demandée | partiel | `{secondes} s demandées · {images} images mesurées à {cadence} i/s` (`:90`). **La durée réellement disponible n'est calculée nulle part** |

**Ce qui manque en une phrase** : on ne peut pas ouvrir un clip pour le regarder image par image avant de
le monter.

---

### Fiche de l'asset — onglet Équipement → `VestiaireDuSujet.tsx` + `TenuesDuSujet.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| « Créer un équipement » (nom, type, description, emplacement) | partiel | un seul champ : `nommer une pièce qu'il porte` (`VestiaireDuSujet.tsx:234`) puis `La lui donner` (`:245`). **Pas de type** — `type Piece` n'a aucun champ de ce genre (`api.ts:1985-2005`) ; rien trouvé pour `Sac à dos`. Pas de description, pas d'emplacement à la création (`vestiaire.ts:135` n'envoie que `nom, porteur`) |
| « Utiliser une pièce existante » (fenêtre avec filtre) | partiel | un `<select aria-label="Pièce commune à attribuer">` puis `Créer son emploi pour {nom}` (`:251`). **Aucun filtre**, et rien trouvé pour `Choisir une pièce du jeu` |
| « Essayer les combinaisons » | partiel | `Composer une tenue` (`TenuesDuSujet.tsx:41`) |
| Sur chaque emploi : « Préparer les calques », « Fiche de la pièce » | partiel | un seul bouton, `aria-label="Ouvrir {pièce}"` (`VestiaireDuSujet.tsx:180-181`), qui ouvre l'emploi. **La fiche de la pièce n'est pas joignable depuis cet onglet** |
| « Associer une pièce », « Extraire un élément », « Choisir son aperçu », « Retirer l'association » | partiel | la section s'appelle `Son vestiaire` (`:155`). Associer : `La lui donner` (`:245`). Retirer : `Il ne porte plus {nom}` (`:208`). **`Extraire un élément` n'est pas là** (il est sur la barre de la page). **`Choisir son aperçu` : rien trouvé** — la vignette est choisie par le serveur (`:70-79`) |
| Emplacement + « N / M calques prêts » | partiel | l'emplacement est là (`:217`). Le décompte dit autre chose : `{calques_retenus} calques précis retenus · {images_disponibles} cibles disponibles` (`:216`) |

**Ce qui manque en une phrase** : créer une pièce ne demande que son nom — ni type, ni description, ni
emplacement — et sa fiche ne s'ouvre pas depuis le personnage qui la porte.

---

### Fiche de l'asset — onglet Objectif & règles → `ObjectifDuSujet.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Lire sorties, mouvements, directions | tenu | `ObjectifDuSujet.tsx:94-99` (deux cartes avec `{produit}/{demande} produites`), `:104-107` (un repli par mouvement), `:109-111` (une ligne par direction) |
| « Modifier l'objectif » (sorties, mouvements virgulés, cases Sud/Ouest/Est/Nord) | partiel | le bouton existe (`:90`), mais ouvre un formulaire **en place**, pas une fenêtre (`:115`). **On ne peut pas déclarer un nouveau mouvement ni une nouvelle direction** : les deux listes viennent du serveur (`:36-46`, `:105`, `:128`). Rien trouvé pour `Sorties souhaitées` ni pour `Sud\|Ouest\|Est\|Nord` dans ce fichier |
| « Modifier la fiche » | partiel | pas dans cet onglet. Le bouton reste à l'écran parce que le résumé est au-dessus des onglets (`FicheDuSujet.tsx:64`, monté en `PageDuSujet.tsx:324`) |
| Lire l'hérité de l'univers : direction artistique, taille de grille | absent | rien trouvé pour `Hérité de l’univers`, `direction artistique` ni `taille de grille` dans ce fichier |
| « Règles du jeu » vers les Réglages | absent | rien trouvé dans ce fichier |
| Retirer une direction ne supprime rien | tenu | « Objectif enregistré. Les résultats existants restent disponibles. » (`:70`) ; les rangées hors objectif restent, avec la pastille `hors objectif` (`AnimationsDuSujet.tsx:680-682`) |

**Ce qui manque en une phrase** : c'est l'écran qui dit ce qu'il faut produire, et on ne peut pas y ajouter
un mouvement — il faut passer par la matrice (`EtabliDuSujet.tsx:599`).

**En plus de la maquette** : une case `Animation` et un nombre d'`Images fixes` **par direction**
(`:134`, `:136-137`), les raccourcis `Commencer par une animation` et `Ne rien demander` (`:120-121`), et
le bloc `Format attendu dans le jeu` — largeur, hauteur, cadence, boucle, repère X/Y (`:145-157`).

---

### Fiche de la pièce → `Emplois.tsx` + `ReferencePiece.tsx` + `ResumeEmploi.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| « Modifier l'identité de la pièce » (nom, type, description) | partiel | seule la description est éditable ici : `Modifier la description` / `Conserver la description` (`ReferencePiece.tsx:28-30`). Le **nom** se change dans la matrice (`EtabliDuSujet.tsx:900-906`). Le **type** n'existe pas ; à sa place, une « portée » : `contenue` / `agrandit` (`EtabliDuSujet.tsx:913`) |
| « Ses emplois · N » avec porteur, emplacement, calques prêts | partiel | le titre est `Ses emplois` / `Ses {n} emplois` (`Emplois.tsx:314-319`). Par emploi : nom, emplacement, `{images} images fixes · {cadres} frames de corps disponibles · {pretes} calques vérifiés` (`ResumeEmploi.tsx:26`) |
| « Ouvrir les poses et calques » | partiel | le libellé est `Ouvrir →` (`ResumeEmploi.tsx:26`) |
| « Ajouter un emploi » : Portée par un personnage / Image à part / Mise en scène | tenu | `+ Ajouter un emploi` (`Emplois.tsx:424`) puis `Porté par quelqu'un`, `Une image à part`, `Une mise en scène` (`:62-66`) |
| « Modifier cet emploi » pour un emploi sans porteur | partiel | l'édition existe (`Emploi.tsx:279-287`, `:454-463`) mais aucun bouton ne porte ce nom |
| « Importer une référence », « Fabriquer une référence », « Retoucher la référence » | partiel (1 sur 3) | la section s'appelle `La pièce commune` (`ReferencePiece.tsx:28`). Import fondu dans `Choisir ou importer une référence` (`:31`). **Rien trouvé pour `Fabriquer une référence` ni `Retoucher la référence`** ; à la place, `Retirer cette référence` |

**Ce qui manque en une phrase** : une pièce n'a pas de type, et on ne peut ni fabriquer ni retoucher sa
référence depuis sa fiche.

---
### Emploi d'un équipement → `CalquesDeLEmploi.tsx` + `CouvertureDeLEmploi.tsx`

**Verdict : partiel**. Titre de l'écran : « {pièce} · {porteur} » (`CalquesDeLEmploi.tsx:75`).

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Les quatre étapes annoncées | absent | rien trouvé pour `Choisir les frames` ni pour `étape` dans `CalquesDeLEmploi.tsx`, `CouvertureDeLEmploi.tsx`, `Emploi.tsx`, `Emplois.tsx` |
| Trois compteurs (prêts, bases manquantes, bases modifiées et frames signalées) | partiel (2 sur 3) | `CouvertureDeLEmploi.tsx:63` — deux blocs, `{images_connues} images connues · {prete} calques prêts` et `{bases_absentes} … à produire`. **Le troisième manque** : il n'existe aucun signalement de frame (`api-travaux-equipement.ts:5`) |
| « Voir les bases manquantes » puis « Fabriquer les bases du personnage » | absent | rien trouvé pour `Voir les bases manquantes` ni `Fabriquer les bases`. Le produit énonce le manque sans offrir le chemin |
| « Emplacement et superposition par défaut », « Ajouter un emplacement », ordre, « Garder les réglages » | partiel | le repli existe au mot près (`CalquesDeLEmploi.tsx:82`), avec `Ajouter un emplacement au jeu` et `Ordre des calques par défaut` → `Au-dessus du personnage` / `Sous le personnage` (`:89`). **`Garder les réglages` : rien trouvé** — chaque changement écrit tout de suite |
| « Planches reçues · à déplier » + « Déplier ce résultat » | absent | rien trouvé. Le dépliage est fait côté serveur ; l'écran offre `J'ai vérifié la planche : garder toutes ses cases` (`RelectureEquipement.tsx:137`) |
| Arbre mouvement → direction → frames ; « Sélectionner les manquants », « Tout sélectionner », « Vider la sélection » | partiel (1 sur 3) | l'arbre existe (`CouvertureDeLEmploi.tsx:66`, `CalquesDeLEmploi.tsx:97`). `Vider la sélection` (`:64`). **Rien trouvé pour `Sélectionner les manquants` ni `Tout sélectionner`** |
| « Fabriquer la sélection » | tenu | `CouvertureDeLEmploi.tsx:64` |
| « Extraire la sélection » | absent | rien trouvé. L'extraction est unitaire : `Extraire une nouvelle variante` (`EditeurCalqueCible.tsx:168`) |
| « Vérifier en animation » | tenu | `CouvertureDeLEmploi.tsx:64` |
| Cliquer une vignette pour ouvrir le calque | tenu | `CouvertureDeLEmploi.tsx:66`, `CalquesDeLEmploi.tsx:99` |
| « Toutes les bases : images fixes et animations » | partiel | les deux natures sont séparées et comptées (`CouvertureDeLEmploi.tsx:63`, `CalquesDeLEmploi.tsx:93`), mais pas de repli récapitulatif par mouvement |
| « Même pièce, autres personnages », « Ajouter un autre personnage » | absent | rien trouvé. Il faut passer par `Les autres emplois` (`CalquesDeLEmploi.tsx:76`) puis `+ Ajouter un emploi` (`Emplois.tsx:424`) |
| Sept états de calque | partiel (5 sur 7) | `api-travaux-equipement.ts:5` : `Absente`, `À extraire`, `À vérifier`, `Prête`, `À revoir`. **`À déplier` et `À corriger` : rien trouvé** |

**Ce qui manque en une phrase** : l'écran dit ce qui manque mais n'offre pas de le fabriquer, et il n'y a
ni sélection des manquants ni extraction en lot.

**En plus de la maquette** : le choix de la version de base (`Équiper cette version`,
`CouvertureDeLEmploi.tsx:66`), le réemploi d'un calque en lot (`:70-71`), le suivi des fabrications
conservées (`:68`), et `CalquesAnimes.tsx` — un écran entier, « Ses animations, image par image » (`:249`).

---

### Calque d'un équipement → `EditeurCalqueCible.tsx`

**Verdict : partiel**. Aucun titre visible ; `aria-label="Éditeur du calque ciblé"` (`:136`).

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Zoom : « − », « + », champ, « Ajuster à la fenêtre », molette, touches + - 0 | partiel | `−`, champ 25–3200, `+`, `1:1` (`:148`). **`Ajuster à la fenêtre` : rien trouvé.** Molette seule ne zoome pas : `if (e.ctrlKey \|\| e.altKey)` (`:150`). Les touches `+ - 0` ne font rien (`:151`) |
| Passer d'une frame voisine à l'autre | partiel | pas de bande dans l'éditeur. Les frames se changent dans le volet de gauche resté visible (`CalquesDeLEmploi.tsx:97-100`) |
| Trois images côte à côte : base, source équipée, calque extrait | partiel | elles existent mais **l'une après l'autre**, dans un select : `Personnage équipé`, `Calque seul`, `Base conservée`, `Image source` (`:147`) |
| « Générer cette frame » / « Regénérer cette frame » | absent | rien trouvé. Aucun appel de fabrication dans ce fichier : il faut repasser par `Fabriquer la sélection` puis `Lancer {n} appel(s)` |
| « Importer comme source » / « Importer comme calque » | partiel | en deux temps : `Importer une image` (`ChoisirImageEquipement.tsx:56`) puis `Cette image représente` (`:65`) puis `Associer cette image` (`:67`) |
| « Extraire le calque par différence » | partiel | `Extraire une nouvelle variante` (`:168`), avec `Seuil de différence` (`:165`) et `Caler automatiquement les deux corps` (`:166`) |
| « Versions précédentes · N » + « Restaurer cette version » | absent | le produit **compte** seulement : `{n} révision(s) conservée(s).` (`:187`). Aucune route de restauration dans `api-calques.ts` |
| « Réglages affichés » : Placement, Aspect et ordre, Masques et pinceau | absent | rien trouvé. Tout est empilé dans la même colonne (`:158-187`) |
| Position X, Position Y, Échelle ; glisser le calque | partiel | `Échelle` (`:161`), `Déplacement horizontal` (`:162`), `Déplacement vertical` (`:163`), curseur + champ chiffré. Glisser : tenu (`:129-131`) |
| Rotation, Opacité, Superposition, Ordre entre équipements | partiel | `Rotation` (`:170`), `Opacité` (`:171`), `Ordre entre équipements` (`:181`). « Superposition » s'appelle `Ordre par défaut` (`:172`) |
| Les huit outils | tenu, au mot près | `EditeurCalqueCible.tsx:6` — les huit libellés de la maquette |
| « Taille du pinceau (pixels) », « Réinitialiser les masques » | partiel | `Rayon du pinceau` (`:160`). **`Réinitialiser les masques` : rien trouvé** — seul `Abandonner les corrections` (`:186`), qui rend tout |
| « Reporter les réglages sur la sélection » | partiel | le voisin est sur l'autre écran : `Réemployer un calque sur la sélection` (`CouvertureDeLEmploi.tsx:70`), qui recopie **aussi l'image** |
| « Adopter cette nouvelle base » | tenu | `Adopter cette base, puis revérifier` (`:143`) |
| « Valider cette frame » | partiel | `Vérifier et retenir cette variante` (`:183`) |

**Ce qui manque en une phrase** : on ne peut pas régénérer une frame depuis l'écran où on la corrige, ni
restaurer une version précédente.

---

### Combiner les équipements → `TenuesDuSujet.tsx`

**Verdict : partiel**. Le mot du produit est **tenue**, pas combinaison : `Ses tenues` et
`Composer une tenue` (`:41`), `Conserver la tenue` (`:103`). Rien trouvé pour `Combiner les équipements`.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Choisir la base dans « Pose / animation et direction » | partiel | deux gestes au lieu d'un : il faut d'abord inclure la version par `Choisir les versions` (`:89-90`), puis la lire dans `Aperçu de la version conservée` (`:91`) |
| Zoom, « Taille réelle » | partiel | `Zoom` en select fermé — 100 / 200 / 400 / 800 % (`:128`). Pas de `−`/`+`, pas de champ libre. **`Taille réelle` : rien trouvé** |
| « Lire l'animation » / « Arrêter » ; cliquer un numéro de frame | partiel | `Lire` / `Pause` (`:128`). Les numéros **ne se cliquent pas** : c'est un `<input type="range" aria-label="Frame de la tenue">` |
| « Sans équipement » | tenu | `Essayer le corps seul` (`:84`) |
| Cocher chaque pièce dans « Équipements portés » | tenu | une case par pièce sous la légende `Les pièces` (`:81-82`), plus un champ `Priorité de {nom}` |
| Alerte « N calques manquants », « Voir les éléments à terminer », « Ajuster » | partiel | `{n} points à compléter ou revoir` (`:97`). **`Voir les éléments à terminer` : rien trouvé.** `Ajuster` s'appelle `Corriger` (`:93`) |
| Nommer et « Garder la combinaison » ; recharger | tenu | `Nom de la tenue` (`:80`), `Conserver la tenue` (`:103`), grille des tenues gardées (`:44`) |
| « Exporter la planche assemblée (PNG) » | partiel | `Télécharger l'assemblage` (`:100`) — et c'est un **ZIP**, pas un PNG (`api-tenues.ts:19`) |
| « Exporter les calques séparés (JSON + images) » | partiel | `Télécharger les couches` (`:100`) — ZIP là aussi |

**Ce qui manque en une phrase** : le zoom est un menu à quatre valeurs, on ne clique pas une frame, et les
deux exports sortent des ZIP là où la maquette annonce un PNG et un JSON.

**En plus de la maquette** : les révisions de tenue (`:97`), le choix de variante par frame (`:93-94`), le
pivot commun (`:86`), et toute la livraison Godot des tenues (`:100-101`).

---

### Clip source · avant le montage → **aucun composant**

**Verdict : absent**

Cet écran n'existe pas. Recherche `clip source` sur `interface/src` : trois occurrences, toutes en prose
(`aide.ts:2077`, `Montage.tsx:801`, un identifiant d'essai). Aucun écran ne montre un clip image par image
avant le montage. Deux surfaces en portent des morceaux : le volet `FicheDuClip.tsx` et la pellicule de
`Montage.tsx`.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| « Frame précédente », « Lire le clip source », « Frame suivante » | absent | rien trouvé pour `Lire le clip source`. La lecture passe par le lecteur du navigateur : `<video controls loop autoPlay muted>` (`FicheDuClip.tsx:121-130`) |
| Curseur « Position dans la source » | absent | rien trouvé. Le seul curseur de ce nom est en 3D (`ApercuModele3D.tsx:147`) |
| Repère : numéro de frame et seconde | partiel | le numéro se lit (`Montage.tsx:1299`, `AtelierDeBande.tsx:1334`). **Le repère en secondes n'existe pas** : `Montage.tsx:552` n'écrit que la durée totale |
| Relire l'envoi : modèle, résolution, format, durée, graine, estimation, consigne, références | partiel | modèle, format, durée, consigne : `SourcesDuSujet.tsx:90` et `FicheDuClip.tsx:138-151`. **La graine n'est lisible que noyée dans `JSON.stringify(parametres_resolus)`.** L'estimation n'est pas relue : ce qui s'affiche est le montant réellement enregistré (`FicheDuClip.tsx:163-176`). Les références ne sont pas nommées : « le sprite dont il part » (`:202`) |
| « Reprendre la demande dans un nouvel envoi » | absent | rien trouvé. `reprendreReglages` (`gestes.ts:259`) part d'une image, jamais d'un clip |
| « Animations issues de cette source · N » + « Reprendre ce montage » | partiel | la liste existe deux fois : `les bandes qu'il a faites` (`FicheDuClip.tsx:211`) et `gardées de ce clip` (`Montage.tsx:903`). Pas de compteur dans le titre, pas de bouton `Reprendre ce montage` — il est un cran plus loin (`AtelierDeBande.tsx:2349`) |
| « Choisir un passage et monter » | partiel | deux portes mènent au montage, `Découper ›` (`FicheDuClip.tsx:234`) et `Monter une animation` (`SourcesDuSujet.tsx:90`), mais **aucun passage ne se choisit avant d'entrer** |
| « Sources de cet asset » / « Galerie » | absent | rien trouvé. Les retours sont `✕ Fermer la fiche` (`FicheDuClip.tsx:109`) et `‹ revenir` (`Montage.tsx:560`) |
| Source et position retrouvées après fermeture | partiel | le brouillon de montage est bien conservé par clip (`Montage.tsx:146-147`), mais le curseur de lecture repart à 0 (`:179`) |

**Ce qui manque en une phrase** : on ne peut pas regarder un clip payé image par image, ni relire ce qui a
été envoyé pour l'obtenir, ni repartir de cette demande.

---

### Du clip à l'animation → `Montage.tsx` (et `AtelierDeBande.tsx` pour la suite)

**Verdict : partiel**. Le produit n'est pas un assistant en trois étapes mais une grille à deux colonnes,
tout visible d'un coup (`Montage.tsx:543`). Rien trouvé pour `Étape 1`, `Source et passage`,
`Vérifier l'animation`, `Cadre et rangement`.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Parcourir au curseur ; « Marquer le début / la fin ici » ; champs de début et fin en secondes ; « Prendre une frame sur » ; « Extraire cette sélection » | partiel | le parcours se fait au **ruban** : poignées (`:1252`, `:1256`), flèches (`:355-364`), Espace (`:365-368`). **Rien trouvé pour `Marquer le début`.** **La sélection se fait en numéros d'image, jamais en secondes.** Le pas d'échantillonnage ne se règle pas (`regulier`, `:1429`, plafonné à 12, `:61`) |
| « Première frame », « Dernière frame », « Appliquer cette plage », « Tout prendre », « Une frame sur deux » | partiel | cocher une à une : tenu (`:1204`). **Les cinq libellés : rien trouvé.** À la place, deux poignées glissables, `repartir de zéro` (`:666-677`), et les propositions du serveur sous `l'atelier a remarqué` (`:1338-1357`) |
| « Ajouter un clip » | absent de cet écran | rien trouvé dans `Montage.tsx`. Verser les images d'un autre clip existe dans l'atelier : `la prendre dans` (`AtelierDeBande.tsx:1702-1736`) |
| « Lire les aperçus », « Cadence dans le jeu », « Boucler », « Comparer fin et début », « Créer un aller-retour » | partiel | les deux boucles tournent seules (`:569`, `:619`, `:311-315`). `Vitesse … images / s` (`:877-884`). `en boucle` / `aller-retour` (`:889`) — mais l'aller-retour est un **sens de lecture**, il ne duplique aucune frame (`:1450`). **`Comparer fin et début` : rien trouvé** |
| « Mesurer le cadre sur » ; « Mesurer la silhouette » ; « Rétablir le cadre complet » ; Gauche, Haut, Largeur, Hauteur ; Pivot | partiel | trois choix : `du clip` / `de la bande` / `à la main` (`:822-836`). `reprendre le cadre sur tout le clip ›` (`:864`). **`Rétablir le cadre complet` : rien trouvé.** **Et Gauche / Haut / Largeur / Hauteur ne se règlent pas** : `setCadreMain` n'est appelé qu'en `:155` (brouillon) et `:830` (amorçage) — choisir « à la main » repose le rectangle que la machine venait de mesurer. Le pivot est absent du montage ; un ancrage à neuf points existe dans l'atelier (`AtelierDeBande.tsx:2918-2955`) |
| Nom, personnage, mouvement, direction | tenu | `Le nom de l'animation` (`:733-740`), `Personnage` (`:774-782`), **`Mouvement / pose`** au mot près (`:783`), `Direction` (`:792-800`) |
| Glisser une frame, Alt + flèches, « Dupliquer », « Retirer », « Inverser l'ordre » | partiel | glisser (`:1393-1397`) et Alt + flèches (`:1398-1402`) : tenus, et la phrase le dit (`:699`). Retirer : le geste existe (`:1392`) mais aucun bouton ne porte ce nom. **`Dupliquer cette frame` est dans l'atelier** (`AtelierDeBande.tsx:1968-1974`). **`Inverser l'ordre` : rien trouvé** |
| « Créer et retoucher » / « Garder et retoucher » | absent | le bouton dit `Garder « {nom} » · {N} images` (`:993`) ou `Reprendre « {nom} » · {N} images` (`:980`). La retouche est une porte séparée, posée sur une animation **déjà gardée** (`:930`) |
| Brouillon conservé par clip et par reprise | tenu | `useBrouillonLocal({ cle: montage:{clip}:{reprise} })` (`:146-147`), avis en tête (`:711`) |

**Ce qui manque en une phrase** : on ne peut pas régler le cadre à la main alors que l'écran propose
« à la main », et le passage se choisit en numéros d'image, pas en secondes.

**En plus de la maquette** : `Mettre de côté ›` une image du clip en bibliothèque (`:1309-1317`),
`la vidéo entière ›` (`:587`), le prix par animation gardée et ce qu'il deviendrait « si une de plus »
(`:948-965`), `Sortir ›` (`:923`), et surtout tout `AtelierDeBande.tsx` — voir plus bas.

---

### Du modèle 3D aux sprites → `Fabrication3D.tsx` + `CameraDeRendu3D.tsx` + `CorrectionsDuSquelette.tsx` + `ApercuModele3D.tsx` + `Sources3D.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Barre de six étapes | absent | le produit en a **trois**, dans un select : `Créer le modèle 3D`, `Poser le squelette et son mouvement`, `Produire les frames` (`Fabrication3D.tsx:13`, `:79`) |
| Image de départ : bibliothèque, import, consigne, cases de contrôle, retoucher | partiel | `Choisir l'image de départ` / `Changer l'image de départ` (`:80`). **Import, champ de consigne, cases et retouche : rien trouvé** |
| Modèle : moteur, import d'un modèle 3D, trois contrôles, « Valider ce modèle » | partiel | `Moteur du modèle` (`:81`). **L'import n'existe pas** — le GLB va dans l'autre sens, on le télécharge (`:40`, `Sources3D.tsx:65`). **Contrôles et validation : rien trouvé** ; la sortie d'étape est `Relire cette étape avant de lancer` (`:85`) |
| Squelette : « Partie du squelette », Vrille / Flexion / Écart, « Valider ces corrections » | partiel | **`Partie du squelette` au mot près** (`CorrectionsDuSquelette.tsx:51`). Les noms d'os et d'axes viennent du serveur — **doute**, voir en fin de document. Le bouton dit `Enregistrer les corrections` (`:56`) |
| Mouvements : « Ajouter un mouvement », import FBX, vitesse, début, fin, cadence, Boucler, Rester sur place, valider | largement absent | le produit en choisit **un** dans un catalogue : `Mouvement 3D` (`Fabrication3D.tsx:81`). **Rien trouvé pour `Ajouter un mouvement`, `FBX` comme geste, `Boucler`, `Rester sur place`, `Valider ce mouvement`.** Début et fin sont une portion en pourcentage (`CameraDeRendu3D.tsx:29`), pas des secondes. La cadence est ailleurs (`Fabrication3D.tsx:82`) |
| Caméra & style : vue, rotation, hauteur, projection, cadrage, déplacement vertical, pivots, style, éclairage, contour, taille, glisser sur l'aperçu | partiel | `Angle de caméra` (`:81`), `Tour autour du personnage` et `Hauteur de la caméra` (`CameraDeRendu3D.tsx:24-25`), cadrage, style, éclairage, taille (`Fabrication3D.tsx:81`), glisser pour tourner (`ApercuModele3D.tsx:85`, `:151`). **Projection : absente** — l'aperçu est orthographique en dur (`:77`). **Déplacement vertical, pivots, contour : rien trouvé** |
| Rendus : cocher mouvements et directions, frames par animation, décompte, relire les versions | largement absent | un travail porte **un** mouvement et **une** direction, en select (`Fabrication3D.tsx:82`). `nombre_images` existe (`:81`). **Le décompte d'animations et de frames : rien trouvé** |
| Aperçu : « Lire le mouvement », « Vue de face », « Vue de profil », « Recentrer », « Voir les articulations » | partiel | `Lire` / `Pause` (`ApercuModele3D.tsx:147`), case `Voir le squelette` (`:148`). **Les trois boutons de vue : rien trouvé** — trois curseurs à la place (`:150`). Et l'aperçu n'est pas un panneau permanent : il s'ouvre derrière `Inspecter en 3D` (`Sources3D.tsx:65`) |
| « Source et versions conservées » + « Ouvrir cette version » | partiel | `Réglages conservés` (`Source3DConservee.tsx:23`), `Réglages de ce rendu conservé` (`Sources3D.tsx:69`). L'ouverture s'appelle `Inspecter en 3D` (`:65`) |
| « Retour aux sources de l'asset » | absent | les retours disent `Fermer` (`Fabrication3D.tsx:33`), `Revenir à l'étape` (`:45`), `Ouvrir le personnage` (`Source3DConservee.tsx:25`) |

**Ce qui manque en une phrase** : on ne produit qu'un mouvement et une direction à la fois, on ne peut pas
ajouter un mouvement à soi, et rien n'annonce le nombre de frames qui va sortir.

---

### Retouche → `Retouche.tsx` **et** `AtelierDeBande.tsx`

**Verdict : partiel**

Correspondance **un-vers-deux**, et c'est la coupure la plus importante du document :

- `Retouche.tsx` travaille **une image**. Aucune bande de frames, aucun lecteur, aucune portée.
- `AtelierDeBande.tsx` (2 900 lignes) travaille **une animation**. C'est là que vivent la bande, le
  lecteur, la portée et le chutier.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| État « Version enregistrée » / « Brouillon conservé · version enregistrée intacte » | partiel | `La retouche · Version enregistrée` ou `Brouillon · version enregistrée intacte` (`Retouche.tsx:4090`). Le mot « conservé » est ailleurs (`BrouillonLocal.tsx:64`) |
| « Enregistrer les retouches » (Ctrl + S) | tenu | `Retouche.tsx:4091` ; Ctrl+S en `:3786` |
| « Annuler » / « Rétablir » (Ctrl+Z, Ctrl+Maj+Z) | partiel | les raccourcis y sont (`:3785`). Les libellés sont **`Défaire`** et **`Refaire`** (`:4211`) |
| « Comparer à la source » | absent | rien trouvé. À la place, la bascule `Brut` / `Rendu` (`:3582`) et le témoin `Aucun` / `À côté` / `Par-dessus` (`:3589-3593`) |
| Peindre à la souris (table « Main ») | tenu | `Retouche.tsx:3130-3155`, table `La main` (`:170`) |
| Zoom molette, Espace + glisser, « − », « + », « Adapter », « Déplacer la vue » | partiel | molette libre avec le point sous le curseur conservé (`:3913-3931`). `−`, champ, `+`, `100 %`, **`ajusté`** (`:4721-4771`). **`Adapter` : rien trouvé** dans tout `interface/src`. **Espace + glisser et `Déplacer la vue` : rien trouvé dans ce fichier** |
| « Lire » / « Pause » ; « Cadence » ; « Boucler » | partiel, et ailleurs | `⏸ pause` / `▶ jouer` (`AtelierDeBande.tsx:2470`), `Vitesse … images/s` (`:2482`), `boucle` / `aller-retour` (`:2739-2751`) |
| Choisir une frame ; Ctrl + clic | tenu, et ailleurs | `AtelierDeBande.tsx:1831-1836` |
| « Tout sélectionner », « Dupliquer », « ← », « → », « Retirer », « Extraire une image » | partiel | `toutes` (`:1400`), `dupliquer` (`:1968`), `‹` / `›` (`:1980`, `:1990`), `retirer` (`:1959`). **`Extraire une image` : rien trouvé** ; le voisin est `Découper cette frame` (`:1211`) |
| Basculer « Retouche » / « Calques » | tenu | `Retouche.tsx:4541` ; `AtelierDeBande.tsx:1202` |
| Les huit tables | tenu, avec huit noms différents | voir la section *Ossature*. Deux libellés sur huit coïncident |
| Portée « Cette frame », « Les frames sélectionnées », « Toute l'animation » | partiel, et ailleurs | `Appliquer à` → `Frame {n}`, `Sélection (N)`, `Animation entière (N)` (`AtelierDeBande.tsx:1215-1222`). Absent de `Retouche.tsx` |
| Les réglages de chaque table | partiel | main, détourage, contour, retournement : tenus et plus riches. Recadrage : pas d'« ancrage » (il appartient à Pixéliser, `:1569`). Pixéliser : crans 8→512, pas 16→128 (`recette.ts:66`). Couleurs : `luminosité`, `contraste`, `saturation`, `teinte` — pas de « nuancier ». Nettoyer : `tache minimale` (`:2147`) mais **`grésil temporel` : rien trouvé** |
| « Recettes réutilisables », « Nommer une recette », « Réappliquer une recette » | partiel | le panneau existe : `Recettes ›` (`:4102`), avec `Les recettes nommées` (`:4870`), `Enregistrer`, `appliquer`, `oublier` (`:4890-4925`). **Les trois libellés de la maquette : rien trouvé** |
| Mode Calques : + calque, Visible, Verrou, renommer, opacité, décalage X/Y, Monter, Descendre, Dupliquer, Retirer, Modifier l'extraction | partiel | `Un calque de dessin de plus` (`:2915`), visible (`:2738`), renommer (`:2750`), `Monter` (`:2775`), `Descendre` (`:2785`), `Supprimer` (`:2795`). **`Verrou`, opacité par calque, `Décalage X`/`Y`, `Dupliquer`, `Modifier l'extraction` : rien trouvé** |
| « Découper une image » / « Extraire un élément » depuis la frame | partiel | `Découpe · plusieurs images` (`:4141`) et `Extraire un élément` (`:4142`) |
| « Utiliser comme équipement… » | partiel | `Associer à un équipement` (`:4143`) |
| Poignée de largeur du panneau (260–460 px) | absent | la grille est figée : `grid-cols-[minmax(0,1fr)_300px]` (`:4200`) |
| « Retour à l'asset » | partiel | `‹ {retour}`, où `retour` vaut `Ses images`, `La galerie` ou un libellé d'emploi (`:4085-4087`, `:3620`, `App.tsx:2560-2565`) |

**Ce qui manque en une phrase** : la retouche d'une image et celle d'une animation sont deux écrans
différents, et le mode Calques n'a ni verrou, ni opacité, ni décalage, ni duplication.

---

### Découper une image → `Decoupe.tsx`

**Verdict : partiel** — 1 tenu, 4 partiels, 7 absents sur 12.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Choisir la source : import, bibliothèque, original sans retouches, planche d'exemple | absent | la source est **imposée par l'appelant** : `{ famille: "planche" }` ou `{ famille: "carte" }` (`:125-144`). Rien trouvé pour `Importer une image` ni `Choisir dans la bibliothèque` dans ce fichier |
| « Annuler le dernier réglage » | absent | rien trouvé pour `annuler`, `défaire` ni `undo`. Seuls `Tout retirer` (`:529`) et Suppr sur le rectangle choisi (`:321-328`) |
| Tracer un rectangle ; le déplacer par son centre ; le redimensionner par son coin | partiel | tracer : tenu (`:764-786`). **Déplacer et redimensionner : absents** — `Rectangle` est un `<button>` sans poignée (`:816-855`) |
| Méthodes « Détection », « Grille », « Manuel » | partiel | l'étiquette est `Détection` et ses trois valeurs sont `zones opaques`, `grille fixe`, `les gouttières` (`:425-432`, `:53-57`). **Le mode manuel n'existe pas** : dessiner remplace la détection (`:474-478`) |
| En Grille : « Colonnes », « Lignes », « Proposer cette grille » | partiel | `colonnes` et `lignes` (`:442-447`). **`Proposer cette grille` : rien trouvé** — la détection se relance seule |
| « Détecter les zones » | absent | rien trouvé pour `Détecter`. Automatique, sans bouton |
| « + Zone » | absent | rien trouvé. Le geste est écrit en prose (`:476`) |
| Cocher « garder », renommer, « Régler » chaque zone | absent | `ListeBoites` (`:857-910`) ne porte ni case, ni nom, ni bouton de réglage : numéro, `L×H`, `@ x,y`, une croix |
| Régler X, Y, Largeur, Hauteur au clavier ; « Retirer cette zone » | absent | aucun champ. Le retrait est une croix (`:904`) |
| « Créer les résultats comme » (4 destinations) | partiel | pas de menu : deux sorties déduites du sujet — `Découper en N asset(s)` / `Découper en N carte(s)` (`:517-519`) et `En faire une animation de N images` (`:596-600`) |
| « Relire N sorties » puis « Créer ces résultats » | absent | rien trouvé pour `Relire` dans ce fichier. Le bouton fabrique directement |
| Zoom et déplacement de la vue | tenu | `SurfaceZoomable` (`:761`), `−` / champ % / `+` / `Ajuster` / `100 %` (`SurfaceZoomable.tsx:48-53`) |

**Ce qui manque en une phrase** : les zones sont anonymes, on ne les règle pas, on ne revient pas en
arrière, et rien ne se relit avant de créer.

---

### Extraire un élément → `Superposition.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Les quatre étapes numérotées | absent | rien trouvé pour `1. Choisir les images`, `Caler`, `Isoler`, `Garder le calque`. La colonne est une suite de blocs non numérotés (`:452`, `:500`, `:526`, `:539`, `:600`, `:636`) |
| « Personnage de base » et « Variante équipée » ; import, bibliothèque, original sans retouches | partiel | nommées par rôle géométrique : `DESSUS · SE DÉPLACE` (`:456`) et `DESSOUS · FIXE` (`:484`). **Rien trouvé pour `Personnage de base` ni `Variante équipée`.** Pas d'import de fichier ici (`:714`). `telle qu'arrivée` / `telle que rangée` couvre l'original, mais pour le dessus seulement (`:464-467`) |
| « Proposer un alignement », glisser, Déplacement X/Y, Échelle, Opacité | partiel | `Recaler` (`:558`), outil `Déplacer le dessus` (`:721`), `horizontal` (`:578`), `vertical` (`:590`), `échelle` (`:566`), deux opacités (`:530-535`) |
| « Sensibilité aux différences », « Retirer » / « Garder », pinceau, peindre, « Effacer seulement les corrections manuelles » | partiel | `seuil` (`:603`), `Garder` / `Retirer` (`:721`), pinceau (`:631`), peindre (`:1004`). **`Effacer seulement les corrections manuelles` : rien trouvé** — `Défaire le dernier trait (N)` (`:632`) retire un trait, `Tout défaire ›` (`:711`) rend aussi l'échelle et le calage |
| Nommer l'élément ; portée « Cette frame » / « Tout le résultat » ; « Garder le calque et ouvrir la composition » | largement absent | **aucun champ de nom.** Rien trouvé pour `Sur quelles images afficher cet élément`, `Cette frame`, `image statique` ni `composition`. À la place, deux cases — `calque` et `aplat` (`:640-641`) — et `Fabriquer — N image(s) ›` (`:702`) |
| « Superposition », « Élément seul », « Sur le personnage » | partiel | `Caler et retoucher`, `Calque seul`, `Résultat` (`:720`) |
| « Annuler le dernier réglage » | partiel | seuls les **traits** s'annulent (`:632`). Aucun retour arrière sur un réglage |

**Ce qui manque en une phrase** : on ne nomme pas l'élément extrait et on ne dit pas sur quelles images il
doit apparaître.

---

### Comparer les versions → **aucun équivalent** (`Comparer.tsx` fait autre chose)

**Verdict : absent**

`Comparer.tsx` compare **deux sujets** côte à côte, ou **deux images d'un même sujet**, et il mesure leurs
tailles. Il ne compare jamais deux versions d'un même résultat.

- `Comparer.tsx:2` — « Deux sujets côte à côte, même pose, même fond, même zoom ».
- `Comparer.tsx:16-18` — « Choisir deux fois le même sujet compare deux de ses images ».
- `Comparer.tsx:217-221` — titre `Le même, deux fois` ou `Deux côte à côte`.
- Les « versions » comparées sont des **dates de création** (`:33`, `:272`, `:285`), pas des versions
  retouchées.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Choisir « Version A » et « Version B » | partiel | `Comparer avec` (`:231`), `La pose comparée` (`:247`), `La première image` (`:267`), `La seconde image` (`:280`) |
| « Lire ensemble » / « Pause synchronisée » ; « Revenir au début » | absent | rien trouvé. L'écran ne montre que des images fixes |
| Par côté : frames, cadence, boucle, état (Retenu / Écarté / À juger) | absent | rien trouvé pour `Retenu`, `Écarté`, `À juger`, `cadence` ni `frames` dans ce fichier. À la place, **quatre écarts chiffrés** : hauteur, largeur, contour, palier de couleurs (`:385-420`) |
| « Retoucher » ou « Choisir pour le jeu » sur un côté | partiel | `La retoucher` (`:452`, `:460`), mais seulement dans la colonne `Ce qui ne va pas ensemble`, et seulement s'il y a un écart. **`Choisir pour le jeu` : absent**, et c'est assumé (`:21-23`) |
| « Retour à l'asset » | partiel | `‹ Sa page` (`:205`) |

**Ce qui manque en une phrase** : juger deux versions d'une même animation en les lisant ensemble, image
par image, n'existe nulle part dans le produit.

---

### Réglages → cinq endroits, dont deux sans chemin de clic

**Verdict : partiel**. Le détail est dans la section *Ossature* ci-dessus.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Onglet **Univers** : nom, description du monde, direction artistique, taille, « Garder les règles » | absent (injoignable) | l'écran existe — `Les règles de ce jeu` (`ReglesDuJeu.tsx:1715`), quatre étapes `Son nom`, `Son allure`, `Sa vue`, `Son monde` (`:137-142`) — mais **`setReglesOuvertes(true)` n'est jamais appelé** (`App.tsx:271`, `:1883`). Seul accès : le parcours de création, avant que le jeu existe (`App.tsx:1740-1757`). **`Garder les règles` : rien trouvé** — chaque choix écrit tout de suite (`:1564-1576`) |
| Onglet **Moteurs & workflows** | partiel | API : `Installation.tsx:102-107`. Moteur local : `:108-114`. Profils : `WorkflowsLocaux.tsx:36`, **une grille de cartes, pas un tableau**, et **sans les colonnes entrée / sortie** |
| Onglet **Agent MCP** | partiel | `BlocAgent` n'offre que `Plafond de la séance` **en images** (`ReglesDuJeu.tsx:1249`) et `Modèle d'exploration` (`:1272`). Le reste est dans `DelegationDuJeu.tsx:95-110`, **injoignable**. **Le nombre maximal de tentatives n'existe nulle part** (`api-travaux.ts:8-13`) |
| Onglet **Consommations** | partiel | `EcranDepenses` (`Depenses.tsx:118`) : total en argent (`:490`), ligne par appel avec modèle, état et consommation (`:716-747`), trois issues — `gardé`, `payé pour rien`, `refusé` (`:56-61`). Ce sont des **appels**, pas les demandes de l'agent |

**Ce qui manque en une phrase** : une fois le jeu créé, on ne peut plus rouvrir son nom, son monde, son
allure ni sa taille.

---

### Essayer avant de construire → **aucun équivalent**

**Verdict : absent** — rien trouvé pour `Essayer avant de construire`, `Essayer la maquette` ni `Essayé`
dans `interface/src/`.

**Ce n'est pas un manque.** C'est le mobilier de la maquette : dix parcours à essayer, avec une case cochée
par parcours. Le produit n'a pas à le construire. Il a un `Guide` à la place (`Guide.tsx:176`), qui
explique l'écran où l'on se trouve.

---

### Vos remarques → **aucun équivalent**

**Verdict : absent** — rien trouvé pour `Vos remarques` dans `interface/src/`. Les seules occurrences du
mot « remarque » sont des commentaires de code (`aide.ts:1518`, `App.tsx:1016`, `Depenses.tsx:320`).

**Ce n'est pas un manque non plus** : c'est le carnet de retours de la maquette.

---
## Les surfaces transverses de la maquette

---

### Bandeau de maquette → **aucun équivalent**

**Verdict : absent**, et sans objet. Rien trouvé pour `MAQUETTE` ni `Noter une remarque` dans
`interface/src/`. C'est le bandeau propre à la maquette.

---

### Colonne de navigation → `NavigationAtelier.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Replier / déplier (« ☰ » / « ‹ ») | tenu | `NavigationAtelier.tsx:27` |
| Aller aux six lieux du groupe « Atelier » | tenu | `NavigationAtelier.tsx:7-14`, `:34` |
| Lire le nombre de travaux en attente | partiel | la pastille existe (`:36`) mais compte les emplacements d'images de la galerie (`App.tsx:1793`) |
| Chercher une collection, déplier une famille, « Tout voir », « + Collection » | déplacé | les trois libellés existent, mais **dans l'écran « Les assets »** (`BibliothequeDesAssets.tsx:96-104`). Ils disparaissent dès qu'on en sort |
| Aller aux trois lieux du groupe « Préférences » | partiel (1 sur 3) | `Réglages` (`:39`) — mais il ouvre `Installation`. `Guide` (`:40`) en plus. `Essayer la maquette` et `Vos remarques` : sans objet |
| « Brouillons · N » | absent | rien trouvé pour `Brouillons` dans `interface/src/**/*.tsx` hors essais |

**En plus de la maquette** : `Rechercher un geste · Ctrl K` (`:43`) et l'état
« L'atelier ne répond pas » (`:44`, `App.tsx:1809`).

---

### Barre de fil d'Ariane → `EnTeteDeSurface.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Lire le chemin | tenu, et plus riche | `EnTeteDeSurface.tsx:42-92`, `lieux.ts:360`, `lieux-noms.ts` |
| « ← » / « → » et Alt + flèches | absent | rien trouvé pour `altKey` sauf un garde (`App.tsx:1065`). `lieux.ts` n'a pas d'historique linéaire |
| « Fond des images » : Gris neutre / Transparence | absent | rien trouvé pour `Fond des images` dans tout `interface/`. Le gris neutre est codé en dur (`index.css:42`, `Tuile.tsx:24`). Un choix voisin existe, mais ailleurs et avec d'autres valeurs : `gris neutre · clair · damier · la couleur de fond du jeu` (`EssaiDuSujet.tsx:925`) |
| Historique des trente derniers écrans | absent | pas d'historique linéaire |

**À savoir** : le fil est **vide** sur `galerie`, `univers`, `tableau-de-bord` (`lieux-noms.ts:95-98`) et
sur `clip`, `envoi`, `montage`, `bande`, `montage-de-bande` (`:200-206`). Huit écrans sans adresse.

---

### Brouillons à reprendre → **aucun équivalent**

**Verdict : absent**

Le mécanisme existe — `BrouillonLocal.tsx`, avec ses clés par écran
(`retouche-explicite:…` `RetoucheBrouillon.ts:62`, `decoupe:{quoi}:{id}` `Decoupe.tsx:151`,
`montage:{clip}:{reprise}` `Montage.tsx:146`) — mais il ne s'affiche **que sur l'écran où l'on est** :
« Un brouillon du {date} attend ici. » avec `Reprendre le brouillon` / `Abandonner le brouillon`
(`BrouillonLocal.tsx:61-63`).

Rien trouvé pour `Brouillons`, `Reprendre cette retouche` ni `Reprendre ce montage`. **Pas de compteur,
pas de tiroir, pas d'inventaire.** Un travail laissé en plan sur un écran est invisible depuis tous les
autres.

---

### Quitter cette retouche ? → `Retouche.tsx:4641`

**Verdict : tenu** — le seul des 39.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| « Continuer à retoucher » | tenu | `Retouche.tsx:4641` |
| « Abandonner les retouches » | tenu | idem |
| « Garder le brouillon et quitter » | tenu, autre nom | `Garder le brouillon et continuer` |
| « Enregistrer et quitter » | tenu, autre nom | `Enregistrer et continuer` |

Le titre du cadre est `Quitter les retouches`, le titre affiché `Des retouches attendent`. L'ordre des
deuxième et troisième boutons est inversé.

---

### Relire avant l'envoi → `Envoi.tsx` (et cinq autres écrans)

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Résumé en trois cases | tenu | `Envoi.tsx:209` — `Modèle · fournisseur`, `Résultat demandé`, `Consommation estimée` |
| « Modifier cet envoi » / « Terminer les modifications » ; champs verrouillés hors modification | tenu | `Envoi.tsx:207`, verrous en `:221`, `:233`, `:234` |
| Cadre « Images envoyées » : remplacer, retirer, ajouter, importer | partiel | titre exact (`:226`). `Ajouter une référence` (`:233`). On ne retire pas, on **décoche** (`:1207`). **`Remplacer` : rien trouvé. Import : aucun `<input type="file">` dans ce fichier** |
| Cadre « Texte envoyé » : univers, texte de l'asset, consigne de l'envoi | partiel | titre au pluriel, `Textes envoyés` (`:221`). `les textes du jeu`, `son ambiance`, `le sujet` (`:66-73`). La consigne propre à l'envoi est une **correction par ligne** (`:181-188`), pas un champ |
| Cadre « Profil et paramètres » : modèle, résolution, format, durée, clips, graine | partiel | c'est la case `Résultat demandé` (`:209`) : modèle et format y sont. **Résolution, durée et nombre de clips : absents** (`App.tsx:1971` n'envoie que `proportions`, `variations`, `options`). La graine n'apparaît que sous sa clé technique |
| Message rouge qui **bloque** | partiel | un blocage existe (`:238`, `:247`), mais sa liste est close et courte (`paiement.ts:175-199`). **Les trois exemples de la maquette ne bloquent pas** : trop de références est écrit en rouge sans effet (`PanneauReglages.tsx:336-343`, et `Envoi.tsx:246` dit « non bloquant ») ; l'image de départ manquante bloque **ailleurs** (`FabricationVideoLibre.tsx:96`) ; le budget dépassé est une information (`pieces.tsx:96-99`) |
| « Revenir aux paramètres » puis lancer | tenu | `Revenir à la préparation` (`:207`), `Payer et lancer {prix}` (`:247`) |
| Le même écran depuis un emploi, une fabrication libre, la 3D | **1 porte sur 4** | `grep EcranEnvoi` hors essais ne rend qu'un montage, `App.tsx:1968`. Les trois autres ont leur propre vue : `RelectureEquipement.tsx:91-150`, `FabricationVideoLibre.tsx:138-147`, `Fabrication3D.tsx:32-46` |

**Ce qui manque en une phrase** : la relecture n'est la même que sur une porte sur quatre, et le message
rouge n'arrête pas ce que la maquette lui demandait d'arrêter.

---

### Préparer une fabrication → huit fenêtres

**Verdict : partiel**. Voir la section *Ossature* pour la liste des huit.

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Choisir entre Animation et Image fixe | partiel | le choix est dans une **fenêtre séparée**, avec **trois** portes : `Une animation depuis une vidéo`, `Une image fixe`, `Un modèle 3D et ses animations` (`ChoisirFabricationDuSujet.tsx:41-43`). Chacune ferme et en ouvre une autre (`App.tsx:2902`) |
| Choisir le « Mouvement » ou « Ajouter un mouvement » | partiel | `Mouvement ou pose` (`ChoisirFabricationDuSujet.tsx:39`). **`Ajouter un mouvement` : rien trouvé** — l'option affichée quand la liste est vide est « Définir un mouvement dans Objectif & règles » (`:39`), et le vrai geste est dans la matrice (`EtabliDuSujet.tsx:599`) |
| Choisir la « Direction » | tenu | `Direction` (`ChoisirFabricationDuSujet.tsx:39`) |
| Nommer le résultat et décrire | partiel | décrire : `Ce que tu veux fabriquer` (`BarreQuiPaie.tsx:176`). **Nommer : aucun champ** — rien trouvé pour `Nom du résultat` ; le seul nom de résultat du produit est sonore (`FabricationAudio.tsx:44`) |
| « Moyen de fabrication » ; indisponibles grisés avec leur raison | tenu | le grisé porte sa raison partout : `BarreQuiPaie.tsx:182`, `FabricationVideoLibre.tsx:131`, `PanneauReglages.tsx:462-463`, `Clip.tsx:636-656`. Le nom du champ, lui, change huit fois — voir *Désaccords de nom* |
| Résolution, format, durée, clips, graine | partiel | format (`BarreQuiPaie.tsx:183`) et variations (`:184`). **Résolution : rien trouvé** dans `BarreQuiPaie.tsx` ni `PanneauReglages.tsx`. **Graine : aucun champ nommé** ; elle passe par la boucle générique d'options (`:186`) |
| La chaîne « 1 · Référence → 2 · Clip → 3 · Frames » ; « Choisir une référence », « Importer une référence », « Fabriquer sa référence puis animer » | partiel | la chaîne est annoncée dans **deux autres fenêtres**, avec deux et quatre étapes : `FabricationVideoLibre.tsx:104` et `FabricationSuivie.tsx:137`. Les trois portes ne coexistent que dans la première (`:110`) ; la seconde n'a **pas d'import** (`:150-151`) |
| « Animer depuis une source 3D… » | partiel | `Un modèle 3D et ses animations` (`ChoisirFabricationDuSujet.tsx:43`), qui mène au parcours d'étapes (`Fabrication3D.tsx:76`). Rien trouvé pour `Animer depuis une source 3D` |
| « Relire avant l'envoi » | tenu | `Relire avant envoi` (`BarreQuiPaie.tsx:209`) |
| La demande mise de côté puis reproposée | absent | le produit **fond** la fabrication d'image dans la même demande vidéo (`FabricationVideoLibre.tsx:110-142`) |

**Ce qui manque en une phrase** : on ne nomme pas ce qu'on fabrique, on ne règle pas sa résolution, et il
faut choisir entre huit fenêtres qui ne se parlent pas.

---

### Fabrication libre → `FabricationVideoLibre.tsx` + `WorkflowsLocaux.tsx` + `BarreQuiPaie.tsx`

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Nommer le résultat | absent | aucun champ nom dans `FabricationVideoLibre.tsx` ni `WorkflowsLocaux.tsx` |
| « Type de résultat » : Image, Vidéo, 3D | absent | aucun sélecteur. Le choix se fait **en amont, par le bouton cliqué** : `Préparer une image` (`Fabrications.tsx:59`), `Préparer une vidéo` (`:62`), `Préparer un son` (`:63`). La 3D n'y figure pas |
| Prompt libre | tenu | `Mouvement et consignes pour la vidéo` (`FabricationVideoLibre.tsx:129`), `Description de l'image` (`:117`) |
| Moyen de fabrication | tenu | `Modèle vidéo` (`:131`), grisés avec raison et prix |
| Résolution, format, durée, clips, graine, détail 3D | partiel | `Durée du clip`, `Résolution du clip`, `Proportions du clip` (`:130`). **Nombre de clips : absent, et c'est écrit** — « Cette demande fabrique un clip. » (`:135`). Graine : pas de champ. Détail 3D : ailleurs (`Fabrication3D.tsx:81`) |
| « Inclure les règles de l'univers », « Poser aussi le résultat sur la toile » | partiel | `Ajouter les règles de l'univers au texte de l'image` (`:118`). **`Poser aussi` : rien trouvé** — le geste n'existe qu'**après coup**, en bouton sur le résultat (`WorkflowsLocaux.tsx:137`) |
| Références ; la première obligatoire pour une vidéo | tenu | `Ajouter une référence pour l'image` (`:122`), `Retirer la référence {i+1}` (`:121`), blocage `Choisissez ou importez une image de départ.` (`:96`, `:137`) |
| Un travail sans asset | tenu | sous-titre `Image libre` (`App.tsx:2856`), `personnage: cible?.personnage ?? null` (`paiement.ts:382`) |

---

### Choisir dans la bibliothèque → `BibliothequePourImage.tsx` (et `ChoisirImageEquipement.tsx`, en double)

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Chercher par nom d'asset ou de résultat | doute | le champ existe — `Rechercher une image`, placeholder `Nom, description…` (`:51`) — et appelle `api.assets({ recherche })` (`:43`). **Ce que le serveur interroge n'est pas décidé ici** ; non vérifié |
| Filtrer par « Famille », « Asset », « Jugement » | absent | les filtres offerts sont `Toutes les collections` (`:52`) et une case `Favoris` (`:53`). Rien trouvé pour `Famille` ni `Jugement` dans ce fichier |
| Clic sur une vignette ; aperçu, asset, état et provenance à droite | absent | le clic **choisit et ferme** (`:21`). Aucun volet, aucun état, aucune provenance |
| Survol animé | absent | le survol arme la visée de la barre d'espace (`:20-21`), l'image reste un `<img>` figé (`:22`) |
| Pagination, 30 par page | absent | `useState(60)` (`:34`) et `Afficher les suivantes` (+60, `:60`) : une page qui grandit |
| « Utiliser ce résultat » / « Annuler le choix » | partiel | pas de bouton de validation — le clic **est** la validation (`:21`). L'annulation s'appelle `Revenir au travail` (`:49`) |

**Ce qui manque en une phrase** : on choisit une image sans pouvoir la filtrer par asset ni par jugement,
et sans rien lire d'elle avant de cliquer.

---

### Vérifier les calques en mouvement → `LectureDesCalques.tsx`

**Verdict : partiel**. Le titre de l'écran est le même que celui de la maquette (`:95`, `:104`).

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| Choisir la bande / direction | tenu | `Bande ou image à vérifier` (`:109`) |
| « Frame précédente », « Lire la bande », « Frame suivante » | tenu, au mot près | `:116`, `:117`, `:118` |
| « Signaler cette frame à corriger » / « Retirer le signalement » | absent | rien trouvé pour `Signaler` dans tout `interface/src`. Aucun état « signalée » dans `api-travaux-equipement.ts:5` ni `api-calques.ts:14` |
| « Corriger cette frame » | tenu | `:124` |
| « Valider les N calques vérifiés » + « Voir les N exclusions » | absent | rien trouvé pour `Valider les` ni `exclusions`. La validation est unitaire : `Vérifier et retenir cette variante` (`EditeurCalqueCible.tsx:183`) |

**Ce qui manque en une phrase** : on ne signale pas une frame à reprendre, et on ne valide pas un lot de
calques d'un coup.

---

### Utiliser cette image comme équipement → `AssocierImageEquipement.tsx`

**Verdict : partiel**. Le bouton d'entrée est `Associer à un équipement` (`Retouche.tsx:4142`) ; le cadre
s'intitule `Associer cette image à un équipement` (`App.tsx:2873`) ; l'écran dedans dit
`Utiliser cette image pour un équipement` (`:35`).

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| « Ce que contient cette image » : Référence / Personnage portant / Calque transparent | partiel | `Rôle de l'image` (`:41`) avec `Référence d'apparence`, `Personnage équipé, à extraire`, `Calque transparent déjà extrait`. Les trois natures sont là, aucun des trois libellés ne correspond |
| Choisir une pièce ou « Créer une nouvelle pièce » | partiel | `Pièce de cette image` (`:39`). **La création est absente** — rien trouvé pour `Créer une nouvelle pièce` ; le produit renvoie ailleurs : « Créez d'abord une pièce depuis l'onglet Équipements du personnage. » (`:45`) |
| Choisir le personnage porteur | tenu | on choisit l'emploi, ce qui revient au porteur (`:40`) |
| Choisir la pose, la direction, la frame de base | tenu | `Image ou frame de base` (`:44`) |
| « Garder les retouches et associer » | partiel | le bouton dit `Associer à cette cible` (`:46`). **Doute** : que les retouches en cours partent bien avec l'image n'a pas pu être établi — voir en fin de document |

---

### Vue de travail zoomable → trois implémentations qui ne s'accordent pas

**Verdict : partiel**

| Geste de la maquette | Dans le produit ? | Preuve |
|---|---|---|
| « − », « + », zoom de 25 à 3200 %, « Adapter » | partiel | `SurfaceZoomable.tsx:48-53` : `−`, champ **3,125 à 3200 %**, `+`, `Ajuster`, `100 %`. `Retouche.tsx:4707-4772` : bornes 1 à 1600 (`recette.ts:737`, `Retouche.tsx:3828`), bouton `ajusté`. `AtelierDeBande.tsx:2416-2445` : facteurs entiers `{n}×`, bouton `ajuster`. **Aucune des trois ne fait 25 à 3200, et `Adapter` n'existe nulle part** |
| Bascule « Déplacer la vue » | absent | rien trouvé dans ces écrans. Le seul `Déplacer la vue` est un outil de l'éditeur de calque (`EditeurCalqueCible.tsx:6`) |
| Molette en gardant le point sous le curseur ; Espace + glisser ; bouton du milieu | mitigé | `Retouche.tsx:3913-3931` : molette **libre**, point conservé, **mais pas d'Espace ni de bouton du milieu**. `SurfaceZoomable.tsx:19` : **Ctrl + molette obligatoire**, et le point sous le curseur **n'est pas conservé** ; Espace (`:39-45`) et bouton du milieu (`:58`) y sont. `AtelierDeBande.tsx:414-424` : Ctrl + molette, pas d'ancre, Espace et bouton du milieu |
| Empreinte du pinceau à l'échelle | tenu | `Retouche.tsx:3199-3213`, `Superposition.tsx:1004` |
| Zoom et position conservés par écran | partiel | Retouche : zoom mémorisé **par image** (`:3827`). `SurfaceZoomable` : `useState`, perdu au démontage (`:9`). **La position de défilement n'est jamais conservée** |

**Ce qui manque en une phrase** : trois écrans zooment de trois façons différentes, avec trois bornes et
trois gestes de molette.

---

### Zone de message → la fente de la bande du haut

**Verdict : partiel**

Le produit a deux choses, aucune en bas de page :

- **La fente**, dans la bande du **haut** : deux tons, `echec` et `ok` (`EnTeteDeSurface.tsx:217-238`,
  rendue `:288`). Elle est posée par `App.tsx:2476` et effacée **à la navigation** (`:370`, `:1797`,
  `:1829`). **Elle ne s'efface pas au bout de quelques secondes** : aucun `setTimeout` dans `App.tsx`.
- **`BarreEtat`** en pied (`App.tsx:2783`) : c'est l'état permanent du monde — en ligne, catalogue,
  nombre d'assets —, pas une confirmation de geste.

---

## Les écrans du produit que la maquette ne prévoit pas

**Comment lire la colonne « À garder ? ».** *Oui* veut dire : le produit sait faire quelque chose que la
maquette a oublié, ou qu'elle renvoyait à plus tard. *Fusionner* veut dire : deux écrans font le même
travail. *À trancher* veut dire : il faudra décider, et ce n'est pas à ce relevé de le faire.

| Composant | Ce qu'il fait | À garder ? | Pourquoi |
|---|---|---|---|
| `Ambiances.tsx` — « Ambiances et couleurs » | palettes et ambiances du jeu, deuxième côté d'*Univers & toile* (`Univers.tsx:329`) | **oui** | la maquette ne prévoit aucun endroit pour la couleur du jeu |
| `Famille.tsx` — la grille d'une famille | même route, mêmes filtres, plus la vue *Les poses*, le glisser-déposer et la création par le nom | **fusionner** | recouvre `BibliothequeDesAssets` sur recherche, filtre, sélection et rangement ; deux types MIME de glisser incompatibles (`BibliothequeDesAssets.tsx:86` contre `Famille.tsx:60`) |
| `ReglagesDeFamille.tsx` | barème d'échelle, natures, poses attendues, emplacements de corps, modèle par défaut (`:353-563`) | **oui** | la maquette n'a rien par famille |
| `EssaiDuSujet.tsx` — « Tester les animations » | joue le sujet au clavier, à la taille du jeu, avec un voisin pour comparer (`:654-668`) | **oui** | c'est la seule façon de voir un sprite bouger comme dans le jeu |
| `GrilleDuJeu.tsx` — « Sur la grille du jeu » | pose le sujet sur les cases du moteur (`:128-133`) | **oui** | juger une taille |
| `EtabliDuSujet.tsx` — « Cases, planches et calibrage » | la matrice du sujet ; d'elle partent planche, calibrage, vitrine, fiche longue, panneau d'un calque | **à trancher** | elle porte quatre écrans que la maquette n'a pas, mais elle double aussi la page du sujet |
| `Planche.tsx` — une planche de pose | prépare une pose vue sous plusieurs directions en un seul appel (`:132`, `:305`) | **oui** | c'est ce qui fait baisser le prix |
| `Calibrage.tsx` | met toutes les poses d'un sujet à la même taille (`:303`) | **oui** | rien d'équivalent dans la maquette |
| `Vitrine.tsx` | montre les images retenues du sujet (`:128`) | **à trancher** | recoupe l'onglet *Images fixes* |
| `FicheChose.tsx` — la fiche longue | six sections : signalement, textes de style, images de référence du sujet (`EtabliDuSujet.tsx:438`, ouverte par `sa fiche ›` `:1445`) | **fusionner** | elle porte trois réglages que `FicheDuSujet` n'a pas, et ils sont enterrés sous trois clics dont un menu qui parle de calibrage |
| Onglet « Pas encore rangé » (`EnAttenteDuSujet.tsx`) | ce qui appartient au sujet sans occuper de case (`:140-154`) | **oui** | sans lui, ce qui n'est rangé nulle part est nulle part |
| `AtelierDeBande.tsx` — l'atelier d'une animation | 2 900 lignes : retouche frame par frame, portée du réglage, chutier, pellicule du clip, pelure d'oignon, neuf ancrages, recettes nommées | **oui** | **la plus grosse absence de la maquette.** Elle s'arrête à « Créer et retoucher » |
| `CalquesAnimes.tsx` — « Ses animations, image par image » | repose le calque d'une pièce sur chaque image de chaque bande (`:249`) | **oui** | la maquette n'a rien entre *Emploi* et *Combiner* |
| `Tuiles.tsx` — « Les tuiles » | atlas, terrains, carte d'essai, export Godot (`:33`) | **oui** | la maquette l'annonce « à concevoir plus tard » |
| `AtelierSon.tsx` — « Les sons » | écouter, juger, ranger, livrer un son (`:38`) | **oui** | idem |
| `Sortie.tsx` — « La sortie » | cinq blocs, quatre règles de collision, quatre moteurs cibles, « Ce qui n'est pas prêt » (`:345-605`) | **à trancher** | il porte les comptes que l'onglet Godot n'a pas ; l'un des deux doit absorber l'autre |
| `Installation.tsx` — « L'installation » | clés, ComfyUI, dossier de travail ; quatre étapes (`:93-122`) | **oui** | la maquette ne distingue pas la machine du jeu |
| `Ouverture.tsx` — « Sur quel jeu travaille-t-on ? » | ouvrir, créer, supprimer, reconstruire un jeu (`:281-381`) | **oui** | la maquette l'annonce « à détailler » |
| `ReglesDuJeu.tsx` mode création | les quatre questions du jeu, avant qu'il existe (`:137-142`) | **oui** | et il faut lui rendre son mode *réglages*, voir plus bas |
| `Depenses.tsx` — « Ce qui a été dépensé » | trois colonnes, journal d'appels filtrable, trois issues dont « payé pour rien » (`:56-61`, `:486`) | **oui** | c'est l'onglet *Consommations* de la maquette, en plus complet |
| `Guide.tsx` — le Guide | 216 fiches d'aide (`aide.ts`), filtrées sur l'écran ouvert (`:176-228`) | **oui** | rien d'équivalent |
| `Barre.tsx` — « Rechercher un geste » (Ctrl K) | cherche un sujet, une pièce, une image ; lance les gestes gratuits (`:385-478`) | **oui** | rien d'équivalent |
| `Apercu.tsx` — l'image en grand | survoler une vignette, presser Espace (`:352`) | **oui** | rien d'équivalent |
| `BarreEtat.tsx` — la bande du bas | en ligne / hors ligne, catalogue et sa date, nombre d'assets (`:49-90`) | **oui** | rien d'équivalent |
| `WorkflowsLocaux.tsx` — « Les workflows locaux » | importer, vérifier et choisir un workflow ComfyUI (`:36-80`) | **oui** | la maquette n'a qu'un tableau descriptif |
| `FabricationAudio.tsx` — « Fabriquer un bruitage » | prépare et suit une fabrication de son (`:39-55`) | **oui** | le son n'existe pas dans la maquette |
| `Depliage.tsx` — « Choisir ce qu'on garde » | départage les cases d'une planche reçue (`Galerie.tsx:1280`) | **oui** | la maquette renvoie ça au serveur |
| `Source3DConservee.tsx` | rouvre un rendu 3D gardé et ses réglages (`:16-26`) | **oui** | rien d'équivalent |
| `ImporterPourUnSujet.tsx` | demande la pose et la direction **avant** d'accepter les fichiers | **fusionner** | fait le même travail qu'`ImporterIntelligemment`, avec la question qu'`AU21` avait retirée. Il sait deux choses de plus : reprendre une image de la bibliothèque, et accepter plusieurs fichiers |
| `ChoisirImageEquipement.tsx` | seconde grille de choix d'image, avec un rôle et un import | **fusionner** | la grille, la recherche, les favoris et la pagination sont écrits deux fois |

**Et quatre écrans morts**, déjà relevés par la carte du code : `Arbre.tsx` (personne ne l'importe),
`DelegationDuJeu.tsx` (`genre: "delegation"` n'est jamais posé), le composant `Carnet` (monté seulement
dans son essai), et la grille « Choisir une image de référence » d'`App.tsx:2064-2125`
(`setChoixDeReference` n'a que des appels à `false`). Deux d'entre eux portent des capacités que la
maquette réclame : `DelegationDuJeu` porte le cadre de l'agent, et le mode *réglages* de `ReglesDuJeu`
porte les quatre règles du jeu.

---

## Les désaccords de nom

Un libellé qui ne colle pas est un défaut à part entière : l'auteur cherche le mot de la maquette et ne le
trouve pas. Voici ce qui a été relevé, groupé par nature du désaccord.

### A. Un même lieu, plusieurs noms dans le produit

| La chose | Les noms que le produit lui donne |
|---|---|
| L'écran de livraison | **« Livrer au jeu »** dans la colonne (`NavigationAtelier.tsx:13`) et en titre (`Livraisons.tsx:85`) ; **« La sortie »** dans le fil d'Ariane (`lieux-noms.ts`, `case "sortie"`) ; **« Les livraisons »** dans le Guide (`Guide.tsx:104`) ; et le composant s'appelle `Livraisons` |
| L'écran d'accueil | **« Le jeu »** dans la colonne (`NavigationAtelier.tsx:8`) ; **« Le tableau de bord »** dans le Guide (`Guide.tsx:89`) |
| Les réglages | **« Réglages »** dans la colonne (`NavigationAtelier.tsx:39`) ouvre **« L'installation »** (`Installation.tsx:1165`) ; le Guide appelle « Réglages du jeu » un **autre** écran (`Guide.tsx:100`) |
| Un îlot de la toile | **« Teinte de l'îlot »** (`Toile.tsx:2323`) et **« de ce paquet »** (`:2353`), dans le même menu |
| Un calque au-dessus du corps | **« Au-dessus du corps »** dans l'éditeur (`EditeurCalqueCible.tsx:172`), **« Au-dessus du personnage »** dans l'emploi (`CalquesDeLEmploi.tsx:89`) |
| Une animation | **« animation »** et **« bande »** sur deux boutons voisins : `aria-label="Retoucher l'animation {nom}"` (`Montage.tsx:930`) à côté de `aria-label="Effacer la bande {nom}"` (`:934`) |
| Un calque prêt | **« Prête »** dans la couverture (`api-travaux-equipement.ts:5`), **« Vérifié »** dans la variante (`api-calques.ts:24`) |

### B. Le mot de l'objet : la maquette dit « asset », le produit en dit quatre

| Ce que dit la maquette | Ce que dit le produit | Où |
|---|---|---|
| asset | **asset** | `BibliothequeDesAssets.tsx:92`, `:93`, `:112` ; `FicheDuSujet.tsx:68` (« La fiche de l'asset ») |
| asset | **sujet** | `BibliothequeDesAssets.tsx:119` (« Sélectionner les sujets affichés ») ; `PageDuSujet.tsx:328` (« La page du sujet ») ; `Depenses.tsx:239` ; `Barre.tsx:401` |
| asset | **chose du jeu** | `TableauDeBord.tsx:130` (« Choisissez une chose du jeu ») ; `BarreOutils.tsx:170` (« sans chose du jeu ») |
| asset | **personnage** | `Montage.tsx:774-782` ; `Superposition.tsx` |

Le produit emploie **asset** et **sujet** dans le même écran : `FicheDuSujet.tsx:58` dit
`aria-label="Résumé de l'asset"`, `:71` dit `aria-label="Nom du sujet"`.

### C. Le mot de l'image : frame, image, case

| Ce que dit la maquette | Ce que dit le produit | Où |
|---|---|---|
| frame | **frame** | `AtelierDeBande.tsx:1334` (« Frame {n} / {n} ») ; `Fabrication3D.tsx:13` (« Produire les frames ») |
| frame | **image** | `Montage.tsx:1270-1272` (« image 0 », « les images retenues ») ; `AtelierDeBande.tsx:1924` |
| — | **case** = la case du jeu, jamais une frame | `Retouche.tsx:179`, `:2495` |

Le montage mélange les deux dans le même écran : `Montage.tsx:1270` dit « image 0 », `:1387` dit
`aria-label="Ordre des frames retenues"`.

### D. Le champ du modèle : huit noms pour un

| Ce que dit la maquette | Ce que dit le produit | Où |
|---|---|---|
| Moyen de fabrication | **Modèle · fournisseur** | `BarreQuiPaie.tsx:182` |
| Moyen de fabrication | **Modèle** | `PanneauReglages.tsx:171` |
| Moyen de fabrication | **Modèle vidéo** | `FabricationVideoLibre.tsx:131` |
| Moyen de fabrication | **Fournisseur et modèle vidéo** | `FabricationSuivie.tsx:160` |
| Moyen de fabrication | **Fournisseur et modèle** | `RelectureEquipement.tsx:104` |
| Moyen de fabrication | **Méthode locale** | `FabricationAudio.tsx:45` |
| Moyen de fabrication | **Workflow et version** | `WorkflowsLocaux.tsx:127` |
| Moyen de fabrication | **Moteur du modèle** | `Fabrication3D.tsx:81` |

Et « Moyen de fabrication » existe bien dans le produit, **pour autre chose** : c'est le choix entre
« Plier plusieurs bases dans une planche » et « Un appel distinct par image »
(`RelectureEquipement.tsx:98`).

### E. Les tables de retouche : la maquette nomme, le produit conjugue

| Maquette | Produit | Où |
|---|---|---|
| Détourage | **Détourer** | `Retouche.tsx:163` |
| Recadrage | **Recadrer** | `:164` |
| Pixelisation | **Pixéliser** | `:165` |
| Nettoyage | **Nettoyer** | `:166` |
| Contour | **Le contour** | `:167` |
| Main | **La main** | `:169` |
| table de retouche | **Outil de retouche** (sélecteur), **table** (repli) | `:3058`, `:4147` |

### F. Le reste, geste par geste

| Ce que dit la maquette | Ce que dit le produit | Où |
|---|---|---|
| Sélectionner cette page | **Sélectionner les sujets affichés** | `BibliothequeDesAssets.tsx:119` |
| Précédent / Suivant | **Afficher davantage d'assets** | `BibliothequeDesAssets.tsx:136` |
| Ouvrir | **Ouvrir →** / **Voir les emplois →** | `BibliothequeDesAssets.tsx:130`, `:133` |
| Rechercher un résultat | **Rechercher dans les résultats** | `GalerieMedias.tsx:161` |
| 3D · Vidéo | **Modèles 3D** · **Vidéos** | `GalerieMedias.tsx:22`, `:21` |
| Essais libres | **sans chose du jeu** | `BarreOutils.tsx:170` |
| Ouvrir le résultat | **Ouvrir la fiche** | `Tuile.tsx:248` |
| Monter une animation (galerie) | **Découper ›** | `Tuile.tsx:518`, `FicheDuClip.tsx:234` |
| Préparer des rendus 3D | **Ouvrir la source 3D ›** | `GalerieMedias.tsx:236` |
| Ouvrir les dérivés | **Filiation** | `Fiche.tsx:1120` |
| Fabriquer librement | **Nouvelle fabrication** | `Fabrications.tsx:55` |
| Fabrication libre (fenêtre) | **Préparer une image**, sous-titre **Image libre** | `App.tsx:2856` |
| Explorations libres | **Une image libre** / **Une vidéo libre** / **Un son** | `Fabrications.tsx:59`, `:62`, `:63` |
| Équipements · images fabriquées | **Images équipées · {pièce}** | `RelectureEquipement.tsx:90` |
| Travaux des sources 3D | **De l'image aux sprites en 3D** | `Fabrication3D.tsx:76` |
| Relire l'envoi | **Relire les envois** / **Relire avant envoi** / **Relire l'envoi vidéo** | `FabricationSuivie.tsx:173`, `RelectureEquipement.tsx:143`, `FabricationVideoLibre.tsx:137` |
| Relire avant l'envoi | **Relire avant envoi** (sans l'article) | `Envoi.tsx:207`, `BarreQuiPaie.tsx:209` |
| Interrompre | **Arrêter les appels restants** / **Annuler cette attente** | `RelectureEquipement.tsx:144`, `FileDesCalculsLocaux.tsx:76` |
| Voir le résultat | **Ouvrir le clip et son montage** | `FabricationSuivie.tsx:170` |
| Ouvrir l'emploi | **Extraire / corriger** | `RelectureEquipement.tsx:132` |
| Garder cette destination | **Associer ce projet** → **Projet associé** | `Livraisons.tsx:99-101` |
| Historique | **Les livraisons conservées** | `Livraisons.tsx:141` |
| Relire cette livraison / cette version livrée | **Reprendre la livraison** / **Reprendre cette révision** | `Livraisons.tsx:153` |
| Choisir des résultats | **Retour à l'atelier** | `Livraisons.tsx:86` |
| Ce qui doit exister dans le jeu | **Ce qu'il faut pour le jeu** | `ObjectifDuSujet.tsx:87` |
| ☆ Favori | **favori** / **◤ favori** | `Fiche.tsx:898` |
| Choisir pour le jeu | **●**, `aria-label="La retenir"` | `ImagesDuSujet.tsx:266`, `AnimationsDuSujet.tsx:230` |
| Non jugé · Retenu · Écarté | **À juger · Retenue · Écartée** | `AnimationsDuSujet.tsx:731` |
| Ce que le personnage porte | **Son vestiaire** | `VestiaireDuSujet.tsx:155` |
| Combiner les équipements | **Ses tenues** / **Composer une tenue** | `TenuesDuSujet.tsx:41` |
| Portée par un personnage · Image à part · Mise en scène | **Porté par quelqu'un · Une image à part · Une mise en scène** | `Emplois.tsx:62-66` |
| Manquant · Base modifiée | **Absente** · **À revoir** | `api-travaux-equipement.ts:5` |
| Superposition | **Ordre par défaut** | `EditeurCalqueCible.tsx:172` |
| Taille du pinceau (pixels) | **Rayon du pinceau** | `EditeurCalqueCible.tsx:160` |
| Position X / Y | **Déplacement horizontal / vertical** | `EditeurCalqueCible.tsx:162-163` |
| Valider cette frame | **Vérifier et retenir cette variante** | `EditeurCalqueCible.tsx:183` |
| Bande / direction à vérifier | **Bande ou image à vérifier** | `LectureDesCalques.tsx:109` |
| Lire l'animation / Arrêter | **Lire / Pause** | `TenuesDuSujet.tsx:128` |
| Ce que contient cette image | **Rôle de l'image** | `AssocierImageEquipement.tsx:41` |
| Utiliser comme équipement… | **Associer à un équipement** | `Retouche.tsx:4143` |
| Annuler / Rétablir | **Défaire / Refaire** | `Retouche.tsx:4211` |
| Adapter | **ajusté** / **Ajuster** / **ajuster** | `Retouche.tsx:4771`, `SurfaceZoomable.tsx:52`, `AtelierDeBande.tsx:2445` |
| Cadence | **Vitesse** dans le montage et l'atelier, **Cadence** en 3D | `Montage.tsx:878`, `AtelierDeBande.tsx:2481` contre `Fabrication3D.tsx:82` |
| Boucler | **en boucle** / **sens de lecture** | `Montage.tsx:889`, `AtelierDeBande.tsx:2739-2751` |
| Découper une image | **Découpe · plusieurs images**, et aucun titre dans l'écran lui-même | `Retouche.tsx:4141` ; `Decoupe.tsx` n'a ni `<h1>` ni `<h2>` |
| Extraire un élément | **superposition** (en-tête), **Superposer** (table), **Extraire un élément** (bouton) | `Superposition.tsx:447`, `Retouche.tsx:172`, `:4142` |
| Créer un clip vidéo | **Préparer un clip vidéo** | `SourcesDuSujet.tsx:87` |
| + Îlot | champ **Groupe** à remplir | `Tableau.tsx:1439` |
| Règles de l'univers | **Les règles du jeu**, et depuis un autre lieu | `lieux-noms.ts:111` |
| Autoriser les méthodes locales | **Autoriser la vidéo locale** | `DelegationDuJeu.tsx:95` |
| Garder le cadre de l'agent | **Enregistrer le cadre du jeu** | `DelegationDuJeu.tsx:110` |

**Un accord, pour mémoire** : « Mouvement / pose » est repris au mot près (`Montage.tsx:783`), et
« Vérifier les calques en mouvement » aussi (`LectureDesCalques.tsx:95`).

---

## Les dix écarts qui coûtent le plus à l'auteur

### 1 · Rien ne part de la toile vers une fabrication, et rien ne s'y sélectionne

**Aujourd'hui** : l'auteur pose des références et des notes sur la toile, et il ne peut rien en faire. La
fenêtre « Choisir ce qui part de la toile » n'existe pas — rien trouvé pour `Choisir ce qui part` ni
`Préparer avec ces références`. Et il n'y a pas de sélection multiple : `Univers.tsx:119` ne tient qu'une
carte à la fois, ce qui rend impossibles « Mettre en réserve » sur un lot, « Effacer la sélection » et
« Fabriquer depuis la sélection ».

**Ce qu'il faudrait** : une sélection multiple sur la toile, et un chemin de la sélection vers la fenêtre
de préparation, avec les images cochées d'avance et les notes en consigne.

### 2 · Les quatre règles du jeu ne se rouvrent plus une fois le jeu créé

**Aujourd'hui** : le nom du jeu, sa description du monde, sa direction artistique et sa taille de référence
se règlent **une seule fois**, au moment de créer le jeu. L'écran existe
(`ReglesDuJeu.tsx:1461`, mode `reglages`) mais aucune porte ne l'ouvre : `setReglesOuvertes(true)` n'est
jamais appelé. Le mot « Réglages » de la colonne ouvre la machine, pas le jeu.

**Ce qu'il faudrait** : rebrancher cette porte. C'est une ligne de code, et ce sont les quatre réglages qui
partent dans chaque prompt.

### 3 · La livraison ne se décide pas : elle bloque

**Aujourd'hui** : un conflit de fichier arrête tout. Le produit affiche
`{chemin} — {raison}` en rouge et désactive le bouton (`Livraisons.tsx:133-134`) ; le serveur ne connaît
que deux raisons (`atelier/services/livraison.py:388-394`). La maquette proposait trois décisions.
S'ajoutent : pas de « Tout sélectionner », pas de case par fichier, pas de « Retoucher » depuis la
livraison, et un brouillon non enregistré **part sans avertir** (`Livraisons.tsx:47`).

**Ce qu'il faudrait** : trois décisions par conflit — conserver, copier à côté, remplacer —, une sélection
en masse, et le même garde-fou de brouillon que les tuiles et les sons ont déjà.

### 4 · Huit fenêtres pour préparer, six écrans pour relire

**Aujourd'hui** : la maquette fait tenir la fabrication dans deux fenêtres. Le produit en a huit, plus une
d'aiguillage, et **aucune n'est atteignable depuis une autre**. Trois préparent une image fixe, trois
préparent un clip. Chacune a ses libellés, son bouton de relecture et son format de prix. Et `EcranEnvoi`,
la relecture de référence, n'est montée qu'à un seul endroit (`App.tsx:1968`).

**Ce qu'il faudrait** : une seule préparation et une seule relecture, où le type de résultat est un choix
dans la fenêtre et non le bouton par lequel on est entré.

### 5 · La galerie ne se trie pas et ne se filtre presque pas

**Aujourd'hui** : c'est l'écran d'ouverture du produit (`lieux.ts:214`). On y cherche par texte, on filtre
par famille et par favori. **Pas de tri** — l'ordre est figé en date décroissante (`Galerie.tsx:750-752`).
**Pas de filtre par rôle**, **pas de filtre par jugement**, **pas de regroupement** : une planche et les
images qui en sortent ne se voient jamais ensemble.

**Ce qu'il faudrait** : le tri, les deux filtres, et le regroupement par fabrication. C'est l'écran où
l'auteur passe le plus de temps.

### 6 · Juger deux versions d'une même animation n'existe pas

**Aujourd'hui** : `Comparer.tsx` compare **deux sujets**, ou deux images d'un même sujet, et il mesure
leurs tailles (`:2`, `:385-420`). Il ne lit aucune animation : rien trouvé pour `Lire ensemble`,
`cadence` ni `frames` dans ce fichier. L'auteur qui a trois versions d'une marche ne peut pas les regarder
tourner côte à côte pour choisir.

**Ce qu'il faudrait** : un écran qui lit deux versions d'un même résultat sur le même temps, chacune à sa
cadence, avec « Choisir pour le jeu » de chaque côté.

### 7 · Déclarer un mouvement ou une direction est enterré

**Aujourd'hui** : l'onglet « Objectif & règles » dit ce qu'il faut produire, mais les mouvements et les
directions viennent du serveur et ne s'y ajoutent pas (`ObjectifDuSujet.tsx:36-46`, `:105`, `:128`). Le
seul endroit où l'on ajoute une attitude est la matrice — `Autres outils` → `Cases, planches et
calibrage` → le champ `Nom de l'attitude à ajouter` (`EtabliDuSujet.tsx:599`). Et la fenêtre de
fabrication, quand la liste est vide, renvoie vers un écran qui ne sait pas le faire : « Définir un
mouvement dans Objectif & règles » (`ChoisirFabricationDuSujet.tsx:39`).

**Ce qu'il faudrait** : ajouter un mouvement et une direction depuis l'onglet Objectif, et corriger le
renvoi de la fenêtre de fabrication, qui envoie aujourd'hui au mauvais endroit.

### 8 · La découpe ne se règle pas

**Aujourd'hui** : les zones sont anonymes — `ListeBoites` ne porte ni nom, ni case « garder », ni
coordonnées (`Decoupe.tsx:857-910`). Pas de « + Zone », pas de retour arrière, pas de déplacement ni de
redimensionnement d'un rectangle (`:816-855`), et rien ne se relit avant de créer. Une découpe ratée se
refait en entier.

**Ce qu'il faudrait** : nommer une zone, la régler au clavier, en ajouter une, revenir en arrière, et
relire les sorties avant de les créer.

### 9 · Le cadre du montage ne se règle pas à la main, alors que l'écran le propose

**Aujourd'hui** : `Montage.tsx:822-836` offre trois façons de mesurer le cadre, dont « à la main ».
Mais `setCadreMain` n'est appelé qu'à deux endroits — la restauration d'un brouillon (`:155`) et
l'amorçage (`:830`) — et **aucun contrôle de l'écran ne le modifie**. Choisir « à la main » repose le
rectangle que la machine venait de mesurer. Il n'y a pas non plus de pivot dans le montage.

**Ce qu'il faudrait** : quatre champs — Gauche, Haut, Largeur, Hauteur — et deux pour le pivot. Ou retirer
le choix « à la main », qui promet ce qu'il ne fait pas.

### 10 · On ne sait pas ce qu'on a laissé en plan

**Aujourd'hui** : deux choses, et elles se renforcent.
Les brouillons existent par écran et ne se voient que depuis cet écran (`BrouillonLocal.tsx:61-63`) : rien
trouvé pour `Brouillons` dans tout `interface/src`. Et le compteur de la colonne, à côté de
« Fabrications », compte les emplacements d'images du chantier de la galerie (`App.tsx:1793`,
`paiement.ts:241-274`) — pas les animations, pas les équipements, pas la 3D, pas les sons.

**Ce qu'il faudrait** : le tiroir « Brouillons · N » de la maquette, et un compteur qui compte les
travaux.

---

## Ce que je n'ai pas pu vérifier

Ces points sont écrits comme des doutes parce qu'ils n'ont pas pu être tranchés depuis `interface/src/`.

- **Les valeurs qui viennent du serveur.** Les noms d'os du squelette 3D (Tête, Épaules, Avant-bras, Mains,
  Bassin) et les axes (Vrille, Flexion, Écart) viennent de `catalogue.os` et `selection.axes`
  (`CorrectionsDuSquelette.tsx:51`, `:53`). Les styles 3D (Couleurs du modèle, BD, Pixel art) viennent de
  `catalogue.styles` (`Fabrication3D.tsx:81`). La plage de la taille de référence (32 à 128) vient de
  `api.vuesEtTailles()` (`ReglesDuJeu.tsx:1519-1524`). Aucun de ces libellés n'est écrit dans l'interface.
- **Ce que le serveur cherche** quand `BibliothequePourImage` envoie `api.assets({ recherche })`
  (`:43`) : on ne sait pas, depuis l'écran, si le nom de l'asset porteur est couvert autant que le label
  du résultat.
- **Les retouches qui partent avec l'image** dans « Associer à un équipement ». Le produit envoie
  `image.identifiant` tel quel ; que cet asset porte déjà les retouches en cours, ou l'image d'origine, se
  décide dans `Retouche.tsx` et n'a pas été établi.
- **Le glisser-déposer d'`EcranFamille`** : les cibles du panneau *Les ranger* ont l'air intactes, mais
  aucun essai au navigateur n'a confirmé que le dépôt aboutit. Ce doute vient de la carte du code, il n'a
  pas été levé.
- **La molette qui zoome sur la toile** est prouvée par **absence** d'un `zoomOnScroll` dans `Toile.tsx`,
  donc par le défaut de la librairie — pas par la lecture d'un contrôle.

**Un doute de la carte du code est levé, en revanche.** Le *journal des appels ratés* qui vivait dans
`Arbre.tsx` n'est pas perdu : `EcranDepenses` le remplace et fait davantage. Il distingue trois issues —
`gardé`, `payé pour rien` (« l'appel a réussi, il a été facturé, rien n'en est resté »), et `refusé`
(« l'appel a échoué avant de rendre une image ») — `Depenses.tsx:55-61`, filtrables en `:522-535`. Son
propre en-tête explique pourquoi il fallait remplacer l'ancien journal (`Depenses.tsx:3-10`).


