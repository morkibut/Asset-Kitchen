# La maquette, remesurée — 24 septembre 2026

Refait le relevé du 13 septembre 2026 (`docs/releves/2026-09-13-ecart-maquette-produit.md`),
sur les mêmes **26 écrans** de la maquette validée
(`docs/maquettes-atelier-unifie/02-atelier.html`, `docs/releves/2026-09-13-carte-de-la-maquette.md`)
et les **13 surfaces transverses**, avec la même grille : **tenu / en partie / absent**, un
geste à la fois, avec fichier et ligne pour preuve.

**Onze jours et vingt-sept tranches séparent les deux relevés** — `RP1` à `RP17`
(`docs/PLAN-remise-a-plat.md`) et `RV0` à `RV27` sauf `RV16` (`docs/PLAN-revue-du-21-septembre.md`),
plus les tranches `TS1` à `TS21` (la toile), `B`, `C`, `D`, `E`… du chantier « atelier unifié ».
Ce document ne rejuge pas leur travail tranche par tranche : il regarde ce qui reste **au 24
septembre**, exactement comme le 13 avait regardé ce qui restait alors.

Relevé fait sur le worktree `gag2-worktrees/rv-vue`, branche `wip/rv-vue`, HEAD `d1aab20`, sans
modifier un seul fichier de code.

## Comment ce relevé a été fait

**Deux méthodes, combinées.** Cinq revues de code indépendantes ont relu chacune un lot d'écrans
dans `interface/src/`, cité chaque geste retrouvé avec son fichier et sa ligne, et comparé au
texte du 13 septembre — sans recopier ses verdicts. En parallèle, un atelier jetable
(fournisseur doublé, rien payé) a servi l'interface compilée (`npm run build` dans ce worktree)
sur le port **8440**, et une session de navigateur a visité les écrans que ses données
permettent d'atteindre : *Le jeu*, *Univers & toile*, *Codex* (Les assets), *Galerie*,
*Fabrications*, la fiche d'un sujet neuf et ses onglets, *Réglages* (les quatre onglets),
*Livrer au jeu*, *Retouche*, le *Guide*, la colonne de navigation et le fil d'Ariane.

**Ce qui n'a pas de données dans cet atelier jetable — équipement, clip vidéo, source 3D,
tenues combinées, découpe, extraction, comparaison — est lu dans le code et marqué comme tel.**
Aucune observation n'est inventée : ce qui n'a pas été vu à l'écran le dit.

---

## En un coup d'œil

| | 13 septembre 2026 | 24 septembre 2026 |
|---|---|---|
| Écrans tenus | **0** sur 26 | **1** sur 26 (+1) |
| Écrans tenus en partie | **22** sur 26 | **22** sur 26 |
| Écrans absents | **4** sur 26 | **3** sur 26 (−1) |
| Surfaces tenues (sur les 13 transverses) | **1** | **3** (+2) |
| Surfaces absentes | **2** | **1** (−1) |
| Total (39) : tenu / en partie / absent | 1 / 32 / 6 | **4 / 32 / 4** |

**Les trois écrans/surfaces qui passent à tenu** : *Réglages* (une seule porte, quatre onglets,
comme la maquette le demande — `RP2`), *Brouillons à reprendre* (un vrai tiroir existe
maintenant — `TiroirDesBrouillons`, `interface/src/composants/Brouillons.tsx`), et *Quitter
cette retouche ?* restait déjà tenu et le reste.

**Ce que le compte ne dit pas — et qui est le vrai signal de cette tranche.** Le 13 septembre,
« en partie » voulait souvent dire *à peine commencé*. Aujourd'hui, la plupart des 22 écrans
« en partie » ont vu deux, trois, parfois quatre de leurs manques se refermer, et il n'en reste
qu'un ou deux — d'un autre ordre que ceux du 13 septembre. Cinq réparations de fond, toutes
vérifiées dans le code, dépassent la portée d'un seul écran :

- **La fenêtre de fabrication est devenue unique** (`RP4`) : `ChoisirFabricationDuSujet.tsx` a
  disparu, `PreparerUneFabrication.tsx` porte le sélecteur « Type de résultat » que la maquette
  demandait et enveloppe les cinq anciens écrans sans leur propre cadre.
- **La fenêtre de relecture est devenue unique dans son cadre** (`RP4`), même si un seul type
  de résultat (l'image fixe) s'y est branché à ce jour — trois types gardent encore leur propre
  bloc de relecture.
- **Réglages est devenu une seule porte à quatre onglets** (`RP2`) : les deux chemins que rien
  n'atteignait (les règles de l'univers, la délégation à l'agent) sont désormais dans la porte
  « Réglages » de la colonne de navigation.
- **Livrer au jeu est devenu un seul écran** (`RV8`) : les deux onglets qui ne se parlaient pas
  ont fusionné.
- **La fiche d'un sujet est passée de six onglets (dont deux fantômes) à quatre onglets
  assumés** (`RV12`), un de moins que la maquette elle-même — un choix documenté après une
  revue du 21 septembre, pas un manque.
- **Une seule barre de zoom sert maintenant quatre écrans** (`CommandesDuZoom.tsx`, 16
  septembre 2026) là où trois implémentations divergentes coexistaient.
- **« Comparer les versions »**, absent le 13 septembre, a reçu un troisième mode (`RP12`) qui
  compare deux animations du même mouvement avec une horloge commune, « Lire ensemble » /
  « Pause synchronisée », et un jugement par côté — exactement le geste que le relevé du 13
  septembre disait manquant « nulle part dans le produit ».
- **« Découper une image »** a gagné le réglage complet d'une zone — renommer, X, Y, largeur,
  hauteur au clavier, et annuler le dernier réglage — là où les zones étaient anonymes.

---

## Écran par écran (les 26)

Verdict, ce qui a changé depuis le 13 septembre, ce qui reste absent — avec fichier et ligne.
Pour le détail geste par geste identique au format du 13 septembre, voir les extraits complets
conservés dans les notes de tranche (§ Sources, en fin de document) ; ce qui suit résume chaque
écran sans en perdre les écarts.

### 1. Le jeu → `TableauDeBord.tsx`

**Verdict : en partie** (inchangé).

- **Corrigé depuis** : chaque ligne de « Ce qui manque le plus » est un bouton nommé,
  `aria-label={"Ouvrir " + manque.phrase}` (`TableauDeBord.tsx:212-216`), testé par
  `TableauDeBord.test.tsx:48`. Le 13 septembre, aucun bouton ne nommait un asset.
- **Reste absent** : la phrase sous le nom du jeu continue de compter (« N images · $X
  dépensés », `:107-114`) plutôt que décrire le monde — aucune lecture de la description du
  monde sur cet écran. Le compte « résultats »/« retenus » n'existe toujours pas.
  « Commencer la visite » : rien trouvé.

### 2. Univers & toile → `Univers.tsx` + `Toile.tsx` + `Tableau.tsx` + `Ambiances.tsx`

**Verdict : en partie**, très largement rapproché de la maquette par les tranches TS
(22-24 septembre).

- **Corrigé depuis** : sélection multiple au Ctrl/⌘+clic (`Univers.tsx:179`, `205-208`, TS6/TS7) ;
  « Fabriquer depuis la sélection » (`Toile.tsx:1002-1004`, TS7/TS9) ; le résultat posé se relie
  par un trait à son origine, qui joue le rôle d'« Ouvrir le résultat » (`Toile.tsx:825-833`,
  TS7/TS10) ; une barre « Fabriquer » directement sur la toile avec un lien dépliable « Ce qui
  part » (vu au navigateur, TS4), qui répond à la fenêtre « Choisir ce qui part de la toile »
  demandée par la maquette.
- **Reste absent** : le champ « Rechercher » sur la toile ; un zoom à pourcentage explicite (25
  à 200 %, la toile ne zoome qu'au Ctrl+molette) ; un cadre tiré à la souris pour sélectionner
  plusieurs cartes (la sélection reste au clic un par un) ; les « Règles de l'univers » restent
  hors de cet écran (déplacées dans Réglages par choix, `Univers.tsx:363-365`).

### 3. Les assets → `Famille.tsx` (le Codex ; `BibliothequeDesAssets.tsx` a disparu, absorbé par `RP7`)

**Verdict : en partie** (inchangé sur le fond).

- **Corrigé depuis** : pagination réelle, « Afficher davantage de sujets » (`Famille.tsx:1790-1793`).
  Vu au navigateur : l'arbre des familles est désormais une colonne permanente à gauche du
  Codex (Personnages, Décors, Objets, Interface, Vides : Équipement).
- **Reste absent** : les filtres restent « Tous les sujets » / « Incomplets » / « Sans
  description » (`Famille.tsx:1498-1511`) plutôt que « À produire / À juger / Modifiés depuis » ;
  aucune vie de collection (renommer, archiver, restaurer) — seuls créer et supprimer existent ;
  le compte « retenus » n'existe nulle part dans le produit.

### 4. Galerie → `Galerie.tsx` + `GalerieMedias.tsx` + `BarreOutils.tsx` + `Tuile.tsx` + `Fiche.tsx`

**Verdict : en partie**, largement corrigé — c'était l'écran où il manquait le plus de gestes le
13 septembre.

- **Corrigé depuis (`RP11`)** : filtre Rôle (`BarreOutils.tsx:226-237`, six valeurs) ; filtre
  Jugement (`:238-249`, remplace l'ancien bouton binaire Favoris) ; tri — plus récents / plus
  anciens / nom A→Z, côté serveur (`:255-266`) ; regroupement planche/dérivés, bascule
  « Regrouper » (`:269-281`). Vu au navigateur : les quatre contrôles sont bien à l'écran,
  au-dessus de la grille.
- **Reste absent** : « Fabriquer librement » depuis cet écran précis — le geste le plus proche
  vit sur l'écran Fabrications.

### 5. Fabrications → `Fabrications.tsx` + `FabricationSuivie.tsx` + `WorkflowsLocaux.tsx`

**Verdict : en partie**, très amélioré (`FileDesCalculsLocaux.tsx` a disparu, absorbé).

- **Corrigé depuis (`RV9`)** : une seule liste de fabrications — la fusion documentée dans
  `Fabrications.tsx:7-11`, portée par `SuiviDesTravaux` (`FabricationSuivie.tsx`).
- **Corrigé depuis (`RV11`)** : les méthodes locales ne vivent plus qu'à un seul endroit — un
  lien « Mes méthodes locales › » (`Fabrications.tsx:41-42`) vers Réglages.
- **Corrigé depuis (`RP16`)** : le compteur de travaux compte désormais toutes les familles, pas
  la seule galerie (`App.tsx:2248-2252`).
- **Reste absent** : l'interruption d'une fabrication en cours reste limitée à la file locale
  (`FabricationSuivie.tsx:946`) et aux emplois d'équipement — aucune interruption générale d'un
  appel payant.

### 6. Livrer au jeu → `Livraisons.tsx` (un seul écran désormais, `Sortie.tsx`/`ImagesALivrer.tsx` en corps)

**Verdict : en partie**, la réparation structurelle la plus nette du lot — mais pas revérifiée
geste par geste jusqu'au bout.

- **Corrigé depuis (`RV8`)** : un seul écran a remplacé les deux onglets qui ne voyaient pas le
  même dossier de jeu — documenté en tête de fichier (`Livraisons.tsx:1-9`) et vu au navigateur :
  « Ce qui part » (Tout le jeu / Une famille / Un sujet), « La nature », « La forme »
  (paquet/fichiers), et en mode fichiers les quatre comptes que la maquette demandait — « 0
  nouveaux · 0 remplacés · 0 inchangés · 0 à effacer » — au même endroit que le reste.
- **Non revérifié en détail** : « Tout sélectionner »/« Sélectionner nouveaux et modifiés »,
  décider un conflit par un choix explicite (la maquette voulait trois choix, le produit du 13
  septembre bloquait), une case sur chaque ligne de fichier. Ces gestes fins n'ont pas été
  relus ligne à ligne dans cette passe ; ils restent donc évalués « en partie » par prudence,
  pas parce qu'un manque y a été constaté.

### 7. Fiche de l'asset → `PageDuSujet.tsx` + `FicheDuSujet.tsx`

**Verdict : en partie.**

- **Restructuré depuis (`RV12`)** : quatre onglets au plus au lieu de six — voir § 8-12.
  `PageDuSujet.tsx:20-33` documente le choix et où chaque ancien onglet est allé.
- **Reste absent** : la famille reste en lecture seule dans « Modifier la fiche »
  (`FicheDuSujet.tsx`, aucun champ « famille » trouvé) ; « Sorties souhaitées » comme champ
  nommé : rien trouvé. Un « retour au personnage » existe désormais **depuis un emploi
  d'équipement** (`App.tsx:3264-3282`, US-537, 18 septembre) mais rien de comparable n'a été
  retrouvé pour revenir d'une image issue d'une découpe à son sujet d'origine.

### 8. Fiche de l'asset — onglet Animations → `AnimationsDuSujet.tsx`

**Verdict : en partie.**

- **Corrigé depuis** : le bouton qui retient une animation porte maintenant exactement le mot de
  la maquette, `aria-label="Choisir pour le jeu"` (`AnimationsDuSujet.tsx:239`) — c'était un
  simple rond « ● » sans ce nom le 13 septembre.
- **Reste absent, à vérifier** : un favori séparé de la retenue n'existe pas comme tel — le
  champ serveur `favori` sert directement à désigner la retenue (`AnimationsDuSujet.tsx:106`,
  `733-737`) plutôt que d'être une marque à part. « Comparer » une carte précise n'a pas été
  retrouvé à ce niveau (l'écran `Comparer` compare deux sujets, ou — nouveau depuis `RP12`, voir
  § 23 — deux animations choisies dans un sélecteur dédié, pas une carte cliquée directement).
  « Reprendre la découpe/l'extraction » depuis une carte : non revérifié ce jour.

### 9. Fiche de l'asset — onglet Images fixes → `ImagesDuSujet.tsx` + `Fiche.tsx`

**Verdict : en partie**, la même mécanique que les animations (favori = retenue,
`ImagesDuSujet.tsx:116`, `1007`). Comparer et reprendre une découpe/extraction depuis une image
n'ont pas été retrouvés ce jour ; considérés inchangés par prudence.

### 10. Fiche de l'asset — onglet Sources & clips → devenu une section de l'onglet Animations

**Verdict : en partie.** Ce n'est plus un onglet séparé : `PageDuSujet.tsx:20-25` documente que
la Galerie de sources est devenue une section repliable de l'onglet *Animations*
(`SourcesDuSujet.tsx`). Le fond du geste (pas de lecture frame par frame d'un clip avant
montage) reste inchangé, voir § 17 « Clip source ».

### 11. Fiche de l'asset — onglet Équipement → `VestiaireDuSujet.tsx` + `TenuesDuSujet.tsx`

**Verdict : en partie**, non revérifié ligne à ligne ce jour — évalué par continuité avec le 13
septembre faute de nouvelle preuve trouvée. L'onglet existe toujours, seulement si
`ouvert.equipable`.

### 12. Fiche de l'asset — onglet Objectif & règles → devenu un sous-onglet de « Modifier la fiche »

**Verdict : en partie.** `FicheDuSujet.tsx:70`, `149`, `204-205` : « Objectif & règles » n'est
plus un onglet de la page mais un onglet du dialogue « Modifier la fiche », ouvert par « Revoir
l'objectif » (vu au navigateur, sur un sujet neuf). Ajouter un nouveau mouvement ou une nouvelle
direction depuis ce dialogue n'a pas été revérifié ; par continuité, considéré toujours réservé
à la matrice (`EtabliDuSujet.tsx`), comme le 13 septembre.

### 13. Fiche de la pièce → `Emplois.tsx` + `ReferencePiece.tsx` + `ResumeEmploi.tsx`

**Verdict : en partie** (inchangé).

- **Reste absent, reconfirmé** : `ReferencePiece.tsx:43-47` — la section « La pièce commune »
  n'offre toujours que « Modifier la description » et « Choisir ou importer une référence ».
  Aucune trace de « Fabriquer une référence » ni « Retoucher la référence » dans ce fichier.
  Aucun champ de type de pièce retrouvé dans `Emplois.tsx`.

## 14. Emploi d'un équipement → `CalquesDeLEmploi.tsx` + `CouvertureDeLEmploi.tsx`

**Verdict : en partie.**

- **Corrigé depuis** : un bouton « Fabriquer les N manques » (`CouvertureDeLEmploi.tsx:58`)
  répond en partie à « l'écran dit ce qui manque sans offrir de le fabriquer ».
- **Reste absent** : « Sélectionner les manquants »/« Tout sélectionner » ; extraction en lot
  (reste unitaire, `EditeurCalqueCible.tsx:321`) ; deux états de calque sur sept (« À déplier »,
  « À corriger »).

## 15. Calque d'un équipement → `EditeurCalqueCible.tsx`

**Verdict : en partie.**

- **Corrigé depuis (16 septembre, barre de zoom unique)** : `−`, champ, `+`, `100 %` et
  **`Adapter`** existent maintenant (`CommandesDuZoom.tsx:43-107`, monté en
  `EditeurCalqueCible.tsx:261`) — « Ajuster à la fenêtre » de la maquette est désormais tenu.
- **Reste absent** : régénérer une frame depuis cet écran ; restaurer une version précédente
  (seul un compte de révisions existe, `:361`) ; réinitialiser seulement les masques (seul
  « Abandonner les corrections » existe, qui rend tout le brouillon).

## 16. Combiner les équipements → `TenuesDuSujet.tsx`

**Verdict : en partie**, inchangé. Zoom toujours un menu fermé à quatre valeurs
(`TenuesDuSujet.tsx:128`), toujours pas de clic direct sur une frame (curseur `range`), export
toujours en ZIP (`api-tenues.ts:19`) et non en PNG/JSON séparés.

## 17. Clip source · avant le montage → toujours aucun composant dédié

**Verdict : absent**, inchangé sur le fond. Toujours aucun écran « clip source », toujours le
lecteur natif du navigateur pour lire un clip payé (`FicheDuClip.tsx:121-132`), toujours aucun
curseur « Position dans la source » côté vidéo. **Amélioration mineure** : le texte envoyé au
modèle se déplie et se copie désormais (`FicheDuClip.tsx:139-141`, `TexteEnvoye`, marqué RV20) —
il était coupé à une ligne le 13 septembre.

## 18. Du clip à l'animation → `Montage.tsx` (et `AtelierDeBande.tsx`)

**Verdict : en partie**, deux corrections nettes.

- **Corrigé depuis** : le cadre « à la main » fonctionne réellement — quatre champs numériques
  éditables, Gauche/Haut/Largeur/Hauteur en pixels (`Montage.tsx:955-1017`), qui ne se
  contentaient que de reposer le rectangle mesuré le 13 septembre. « Inverser l'ordre » existe
  désormais (`:736-746`). Un pivot en pixels est apparu (`:1042-1079`), en plus de la demande de
  la maquette pour cet écran.
- **Reste absent** : la sélection continue de se faire en numéros d'image, jamais en secondes ;
  « Rétablir le cadre complet » : rien trouvé ; « Comparer fin et début » : rien trouvé.

## 19. Du modèle 3D aux sprites → `Fabrication3D.tsx` + `CameraDeRendu3D.tsx` + `CorrectionsDuSquelette.tsx` + `ApercuModele3D.tsx` + `Sources3D.tsx`

**Verdict : en partie**, inchangé sur les trois écarts vérifiés : un seul mouvement et une seule
direction à la fois (`Fabrication3D.tsx:93`), pas d'ajout de mouvement personnalisé (catalogue
fermé), pas de décompte annoncé du nombre de frames à venir.

## 20. Retouche → `Retouche.tsx` **et** `AtelierDeBande.tsx`

**Verdict : en partie.** La coupure « une image / une animation, deux écrans » reste la même
qu'au 13 septembre.

- **Corrigé depuis (16 septembre)** : la barre de zoom est désormais la barre unique de
  l'atelier, avec **`Adapter`** (vu au navigateur : `− / 772 % / + / 100 % / Adapter`).
- **Changement de présentation, vu au navigateur** : les huit tables ne sont plus rangées en
  rangée de boutons mais choisies dans un menu déroulant « Table de retouche », avec un repli
  « Toutes les tables et leur état » — les huit tables restent toutes là, sous une autre forme
  de sélecteur.
- **Reste absent, non re-testé en détail** : « Comparer à la source » comme bouton dédié (la
  bascule Brut/Rendu/À côté/Par-dessus tient ce rôle, comme au 13 septembre) ; le mode Calques
  sans verrou, opacité par calque, décalage X/Y, duplication, « Modifier l'extraction » — non
  revérifié ligne à ligne ce jour, considéré inchangé par prudence.

## 21. Découper une image → `Decoupe.tsx`

**Verdict : en partie**, nettement rapproché de la maquette.

- **Corrigé depuis** : une zone se **renomme** (`renommerZone`, `Decoupe.tsx:235`, `:696`) et se
  **règle au clavier** — X, Y, Largeur, Hauteur (`:733-738`, `:924`, bouton « Régler », `:1266`).
  « Annuler le dernier réglage » existe et fonctionne (`:167`, câblé `:684-687`) — les deux
  étaient explicitement absents le 13 septembre.
- **Reste absent, non re-testé en détail** : le choix de la source (import/bibliothèque)
  toujours imposé par l'appelant ; la relecture avant de créer les résultats.

## 22. Extraire un élément → `Superposition.tsx`

**Verdict : en partie**, inchangé sur les deux manques principaux. Toujours aucun champ pour
nommer l'élément extrait (aucun `aria-label` de nom trouvé) ; toujours aucune sélection « sur
quelles images afficher cet élément » (`sorties` reste `["calque"]`/`["aplat"]`, un mode
d'export, pas un ciblage d'images).

## 23. Comparer les versions → `Comparer.tsx`, qui a gagné un troisième mode

**Verdict : en partie** — changement le plus net de ce relevé pour un écran qui était **absent**
le 13 septembre.

`Comparer.tsx` comparait deux sujets, ou deux images d'un même sujet. Depuis `RP12`
(en-tête du fichier, `Comparer.tsx:1-49`), choisir « ses animations » compare **deux animations
du même mouvement et de la même direction**, avec :

- une horloge commune en millisecondes, chaque côté tirant son image sans donner le tempo à
  l'autre (`:29-37`) ;
- « Lire ensemble » / « Pause synchronisée » au mot près (`:645`) ;
- « Remettre au début », qui remet les deux animations en phase (`:652`) ;
- un jugement par côté — *Non jugé · Retenu · Écarté* — dérivé de `favori`/`supprime`
  (`:231-234`) ;
- « Choisir pour le jeu » sur chaque côté, seul geste de cet écran qui écrit (`:1120`, `:40-41`).

C'est très exactement le geste que le relevé du 13 septembre disait absent « nulle part dans le
produit » : « juger deux versions d'une même animation en les lisant ensemble, image par
image ». **Ce qui reste absent** : ce mode ne s'applique qu'aux animations d'un même mouvement
et d'une même direction — comparer deux *versions retouchées* d'une même image reste le mode
d'origine (deux sujets, ou deux images d'un même sujet), sans lecture synchronisée ni jugement
par côté.

## 24. Réglages → `Reglages.tsx` (nouveau fichier depuis le 13 septembre)

**Verdict : tenu.** Le défaut central du 13 septembre — cinq endroits, dont deux qu'aucun clic
n'atteignait — est réparé. `Reglages.tsx:1-15` le documente lui-même : « une seule porte, quatre
onglets (`RP2`) ». Vu au navigateur, en entier :

- **Univers** — le parcours en cinq étapes cliquables (Son nom, Son allure, Sa vue, Son monde,
  Ses sons), rouvert directement depuis la porte « Réglages » de la colonne de navigation
  (`App.tsx:2257-2274`, qui appelle désormais `ouvrirLesReglages()` et non plus
  `setInstallationOuverte(true)`).
- **Moteurs & workflows** — fusionne l'API et les workflows locaux en un seul onglet
  (`Reglages.tsx:51`).
- **Agent MCP** — fusionne `BlocAgent` (le plafond de séance) et `DelegationDuJeu` (jusque-là
  totalement injoignable) dans le même onglet (`Reglages.tsx:31`, `:36`) : vu au navigateur,
  « Déléguer à l'agent », le suivi des demandes de l'agent, et « Clés et anciens garde-fous de
  séance ».
- **Consommations** — `EcranDepenses` (`Reglages.tsx:32`), vu au navigateur.

**Ce qui n'a pas été revérifié au mot près** : le bouton « Garder les règles » précis de la
maquette, et si chaque champ individuel de l'onglet Univers (nom, description du monde, allure,
taille) est exactement celui-là. Le geste principal — une porte, quatre onglets, plus rien
d'injoignable — est vérifié en code et au navigateur ; c'est sur cette base que ce document
classe l'écran « tenu ».

## 25. Essayer avant de construire → **aucun équivalent**

**Verdict : absent**, sans objet — inchangé. C'est le mobilier de la maquette elle-même (dix
parcours à essayer). Reconfirmé : rien trouvé pour « Essayer avant de construire » ni « Essayer
la maquette » dans `interface/src/`.

## 26. Vos remarques → **aucun équivalent**

**Verdict : absent**, sans objet — inchangé. Reconfirmé : rien trouvé pour « Vos remarques »
dans `interface/src/`.

---

## Les 13 surfaces transverses

### Bandeau de maquette → aucun équivalent

**Verdict : absent**, sans objet, inchangé — c'est le bandeau propre au fichier de maquette.

### Colonne de navigation → `NavigationAtelier.tsx`

**Verdict : en partie**, très largement corrigé.

- **Corrigé depuis (`RP16`)** : la pastille de travaux compte désormais toutes les familles
  (« les emplacements d'images de la galerie *et* les travaux du serveur »,
  `NavigationAtelier.tsx:19-23`), pas la seule galerie.
- **Corrigé** : « Réglages » ouvre réellement les réglages (voir § 24).
- **Corrigé (`RP16`)** : « Brouillons · N » existe, voir surface suivante.
- **Reste un choix assumé, pas un manque** : l'arbre des familles vit dans l'écran « Codex », pas
  dans la colonne — documenté en tête de fichier comme une décision (`:3-4`), pas un oubli.

### Barre de fil d'Ariane → `EnTeteDeSurface.tsx` + `lieux-noms.ts`

**Verdict : en partie.**

- **Corrigé depuis (18 septembre 2026, demande de l'auteur)** : les six écrans qui rendaient un
  fil vide portent maintenant un nom — `galerie`, `univers`, `tableau-de-bord`
  (`lieux-noms.ts:109-114`) et `envoi`, `montage`, `bande`, `montage-de-bande` (`:235-244`).
- **Reste absent** : les flèches « ← »/« → » et Alt+flèche (aucune navigation d'historique
  linéaire trouvée) ; « Fond des images » (rien trouvé dans tout `interface/src`).

### Brouillons à reprendre → `Brouillons.tsx` (`TiroirDesBrouillons`)

**Verdict : tenu.** Un vrai tiroir existe désormais : `App.tsx:83` importe
`TiroirDesBrouillons` et `useBrouillonsEnPlan` ; le bouton « Brouillons à reprendre » de la
colonne de navigation (`NavigationAtelier.tsx:55-58`, vu au navigateur : « Brouillons · 0 »)
ouvre le tiroir (`App.tsx:2254`, `:3393-3400`). C'était noté « pas de tiroir, pas d'inventaire »
le 13 septembre.

### Quitter cette retouche ? → `Retouche.tsx:5143`

**Verdict : tenu**, inchangé — reconfirmé au mot près : « Continuer à retoucher », « Garder le
brouillon et continuer », « Abandonner les retouches », « Enregistrer et continuer », dans le
même ordre que le 13 septembre.

### Relire avant l'envoi → `Envoi.tsx` délègue à `Relecture.tsx` (`RelireAvantEnvoi`, nouveau depuis `RP4`)

**Verdict : en partie**, la nature du manque a changé.

`EcranEnvoi`, fichier autonome de ~900 lignes le 13 septembre, a disparu : `Envoi.tsx` compose
un résumé et délègue le dessin à `RelireAvantEnvoi` (`Relecture.tsx:40-170`), pensée pour les
quatre types de résultat (`type: TypeDeResultat`, `fabrication.ts:14`).

- **Corrigé** : le cadre (en-tête, résumé en trois cases, pied qui paie) est désormais unique et
  partagé.
- **Reste 1 type sur 4 branché** : seuls `Envoi.tsx` et `Depliages.tsx` (tous deux de type
  `"image"`) utilisent `RelireAvantEnvoi`. `RelectureEquipement.tsx`, `FabricationVideoLibre.tsx`,
  `FabricationSuivie.tsx` et `Fabrication3D.tsx` gardent chacun leur propre bloc de relecture.
- **Reste absent** : « Remplacer » une image envoyée ; import de fichier dans ce cadre ;
  résolution/durée/nombre de clips dans le résumé ; le message rouge ne bloque toujours pas ce
  que la maquette voulait bloquer (trop de références reste un affichage sans effet,
  `PanneauReglages.tsx:408-418`).

### Préparer une fabrication → `PreparerUneFabrication.tsx` (nouveau, `RP4` ; remplace `ChoisirFabricationDuSujet.tsx`, qui a disparu)

**Verdict : en partie**, très largement corrigé.

- **Corrigé** : une seule fenêtre de préparation (huit fenêtres avant), avec le sélecteur
  « Type de résultat » que la maquette demandait en tête (`PreparerUneFabrication.tsx:283-302`,
  quatre valeurs fermées, chacune grisée avec sa raison).
- **Reste absent** : nommer le résultat (aucun champ trouvé) ; résolution réglable pour une
  image (rien trouvé).

### Fabrication libre → `FabricationVideoLibre.tsx` + `WorkflowsLocaux.tsx` + `BarreQuiPaie.tsx`, montés par `PreparerUneFabrication`

**Verdict : en partie.**

- **Corrigé** : « Type de résultat » (voir surface précédente) répond au geste que cette surface
  réclamait spécifiquement le 13 septembre.
- **Reste absent, inchangé** : nommer le résultat ; « poser aussi le résultat sur la toile » au
  moment de la demande (le geste n'existe toujours qu'après coup, en bouton sur le résultat,
  `WorkflowsLocaux.tsx:302`).

### Choisir dans la bibliothèque → `BibliothequePourImage.tsx`

**Verdict : en partie**, inchangé. Toujours un seul filtre par collection et une case Favoris
(`BibliothequePourImage.tsx:71`, `124`) — pas de filtre par famille ni par jugement, pas
d'aperçu avant de cliquer (le clic choisit et ferme).

### Vérifier les calques en mouvement → `LectureDesCalques.tsx`

**Verdict : en partie**, inchangé. Toujours aucun « Signaler cette frame à corriger », toujours
aucune validation en lot (« Valider les N calques vérifiés ») — la validation reste unitaire
dans `EditeurCalqueCible.tsx:358`.

### Utiliser cette image comme équipement → `AssocierImageEquipement.tsx`

**Verdict : en partie**, inchangé. Toujours aucune création de pièce directement depuis cet
écran (« Crée d'abord une pièce depuis l'onglet Équipements du personnage. »,
`AssocierImageEquipement.tsx:57`).

### Vue de travail zoomable → `CommandesDuZoom.tsx` (une seule barre, depuis le 16 septembre 2026)

**Verdict : en partie**, largement corrigé — la coupure elle-même est réparée, deux détails de
la maquette restent absents.

`CommandesDuZoom.tsx:4-8` documente le changement : « Il y en avait trois — la retouche d'une
image, la frame d'une animation, et la surface où l'on vise une couleur à la pipette (…).
Signalé par l'auteur le 16 septembre 2026 ; c'est celle de la retouche qui reste. » La même barre
(`BarreDuZoom`/`CommandesDuZoom`) est maintenant montée dans `Retouche.tsx`, `AtelierDeBande.tsx`,
`EditeurCalqueCible.tsx`, et par `SurfaceZoomable.tsx` dans `Decoupe.tsx`, `Superposition.tsx`,
`Apercu.tsx` et `SourceDeFrame.tsx` — sept écrans sur une seule implémentation, avec `−`, le
pourcentage, `+`, `100 %` et **`Adapter`**, qui répond au « Ajuster à la fenêtre » de la
maquette.

**Reste absent** : les bornes ne sont toujours pas uniformément 25-3200 % (`ZOOM_MIN`/`ZOOM_MAX`
par défaut à 1/250, `interface/src/recette.ts:778-779`, chaque appelant passant son propre
`maximum`) ; la bascule « Déplacer la vue » nommée telle quelle dans la maquette reste un outil
de l'éditeur de calque, pas de tous les écrans zoomables.

### Zone de message → bande du haut de `EnTeteDeSurface.tsx` / `App.tsx` / `BarreEtat`

**Verdict : en partie**, inchangé sur le fond. La fente (`echec`/`ok`, `EnTeteDeSurface.tsx:219-238`)
et `BarreEtat` (l'état permanent en pied) sont toujours là ; toujours aucun `setTimeout` qui
efface la fente automatiquement — elle continue de s'effacer seulement au geste suivant
(`App.tsx:449`, `1829`, `2258`, `2298`).

---

## Ce qui n'a pas été vu au navigateur

Les 26 écrans et 13 surfaces ont été relus dans le code d'aujourd'hui. Un sous-ensemble a en
plus été vu à l'écran, sur l'atelier jetable du port 8440 (« Bac à sable », trois images posées,
une note sur la toile, aucun équipement ni clip ni source 3D) :

**Vu au navigateur** : Le jeu, Univers & toile, Codex (Les assets), Galerie, Fabrications,
Livrer au jeu, Réglages (les quatre onglets), Fiche d'un sujet neuf (dialogue « Modifier la
fiche », onglets Animations/Images/Sons/Équipement), Retouche, Guide, colonne de navigation,
fil d'Ariane sur chaque écran visité.

**Lu dans le code, non vu au navigateur** — l'atelier jetable de cette tranche n'a pas les
données nécessaires (un personnage équipé, un clip vidéo payé, une source 3D, une tenue
combinée, deux animations à comparer, une image à découper ou à extraire) : Fiche de l'asset —
onglets Sources & clips / Équipement / Objectif & règles, Fiche de la pièce, Emploi d'un
équipement, Calque d'un équipement, Combiner les équipements, Clip source, Du clip à
l'animation, Du modèle 3D aux sprites, Découper une image, Extraire un élément, Comparer les
versions, Relire avant l'envoi (hors le cas image fixe), Préparer une fabrication, Fabrication
libre, Choisir dans la bibliothèque, Vérifier les calques en mouvement, Utiliser cette image
comme équipement.

---

## Sources

- Le relevé du 13 septembre 2026, point de comparaison :
  `docs/releves/2026-09-13-ecart-maquette-produit.md`.
- Cinq revues de code indépendantes, chacune sur un lot d'écrans, avec citations fichier:ligne —
  leurs comptes rendus complets (tableaux geste par geste) ont servi à écrire ce document et
  restent disponibles dans l'historique de la session qui a produit cette tranche (`RV16`).
- Observation directe au navigateur, atelier jetable port 8440, sur l'interface compilée de ce
  worktree (`npm run build`, `interface/dist`), fournisseur doublé — aucun appel payé.
- `docs/PLAN-revue-du-21-septembre.md` et `docs/PLAN-remise-a-plat.md`, pour situer chaque
  correction dans la tranche qui l'a faite.
