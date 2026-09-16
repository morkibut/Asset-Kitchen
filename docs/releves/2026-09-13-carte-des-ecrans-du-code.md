# Carte des écrans du code — 13 septembre 2026

Ce que l'interface contient vraiment, et ce que l'auteur peut réellement atteindre en cliquant.

Relevé fait sur la branche `codex/atelier-unifie`, sans rien modifier. Chaque « mort »
est prouvé par une recherche dont le résultat est cité.

## En un coup d'œil

| | Nombre |
|---|---|
| Fichiers de composants (hors essais) | 99 |
| Fichiers dont l'écran est atteignable en cliquant | 96 |
| Fichiers entièrement morts | 2 |
| Fichier dont l'écran principal est mort, le reste servant encore | 1 |
| Morceaux morts à l'intérieur de fichiers vivants | 7 |
| Doublons (paires d'écrans qui font le même travail) | 4 |
| Douteux | 3 |
| Fichiers d'essai qui testent du mort | 2 entiers, 3 partiels |

Il y a aussi 55 fichiers `.test.tsx` et 3 fichiers `.ts` d'outillage dans le même dossier ;
ils ne sont pas des écrans.

## Les lieux de l'interface

La navigation tient dans un seul état : une **pile de lieux** (`interface/src/lieux.ts`).
`App.tsx` lit cette pile et décide quel composant occupe la surface centrale.

Sept portes dans la colonne de gauche (`NavigationAtelier.tsx`) :

- **Le jeu** → lieu `tableau-de-bord` → `TableauDeBord`
- **Univers & toile** → lieu `univers` → `EcranUnivers`
  - vue grille → `Tableau` · vue toile → `Toile` + `Reserve`
  - côté *Ambiances et couleurs* → `CoteAmbiancesEtCouleurs`
  - découper une carte → lieu `carte` → `EcranDecoupe`
- **Les assets** → lieu `bibliotheque` → `EcranFamille` (sans famille : les quatre d'un coup)
- **Galerie** → lieu `galerie` → `Galerie`
  - une planche à déplier → `EcranDepliage`
  - un clip → lieu `montage` → `EcranMontage`
- **Fabrications** → lieu `fabrications` → `Fabrications`
- **Livrer au jeu** → lieu `sortie` → `Livraisons`
- **Réglages** → lieu `installation` → `Installation`

Le nom du jeu, en haut de cette colonne, ouvre `Ouverture` (choisir ou créer un jeu).
Le bouton **Guide** ouvre `VoletGuide`. **Rechercher un geste** (Ctrl K) ouvre `Barre`.

Dans la bande du haut (`EnTeteDeSurface.tsx`) : le total ouvre lieu `depenses` →
`EcranDepenses` ; le bouton *Réglages* et l'état de la clé ouvrent `PanneauAtelier`.

Sous la racine `codex`, les lieux d'un sujet et d'un équipement :

- lieu `famille` → `EcranFamille`
- lieu `sujet` → `PageDuSujet`
  - lieu `grille` → `GrilleDuJeu` · lieu `comparer` → `Comparer`
- lieu `piece` → `Emplois`
  - lieu `emploi` → `Emploi`
    - lieu `calques-animes` → `CalquesAnimes`
- lieu `retouche` → `Retouche` (depuis la galerie **et** depuis un sujet)
- lieu `bande` → `EcranAtelierDeBande` · lieu `montage-de-bande` → `EcranMontage`

Trois lieux qui recouvrent le produit pour payer : `clip` → `EcranClip`,
`envoi` → `EcranEnvoi`, et `reference` — **ce dernier n'est plus jamais ouvert**
(voir *Les écrans morts*).

Deux lieux déclarés dans `lieux.ts` ne sont **jamais entrés** : `delegation` et `regles`.
Voir *Les écrans morts*.

## Les écrans atteignables

### TableauDeBord — « Le jeu »
- **On y arrive par** : colonne de gauche → *Le jeu*.
- **Ce qu'il fait** : le résumé du jeu ouvert — images, dépense, familles, raccourcis.
- **Fichier** : `interface/src/composants/TableauDeBord.tsx`

### EcranUnivers — « Univers & toile »
- **On y arrive par** : colonne de gauche → *Univers & toile* ; ou *La toile* depuis le tableau de bord.
- **Ce qu'il fait** : les deux côtés de l'univers — *Inspiration* (la toile des cartes) et *Ambiances et couleurs*.
- **Fichier** : `interface/src/composants/Univers.tsx`

### Tableau — la toile en grille
- **On y arrive par** : *Univers & toile*, côté Inspiration, bascule *grille* (la vue de départ).
- **Ce qu'il fait** : les cartes d'inspiration rangées en grille, avec leurs groupes.
- **Fichier** : `interface/src/composants/Tableau.tsx`

### Toile — la toile libre
- **On y arrive par** : *Univers & toile*, côté Inspiration, bascule *toile*.
- **Ce qu'il fait** : les mêmes cartes posées librement, avec les liens et les îlots.
- **Fichier** : `interface/src/composants/Toile.tsx`

### CoteAmbiancesEtCouleurs — « Ambiances et couleurs »
- **On y arrive par** : *Univers & toile* → onglet *Ambiances et couleurs*.
- **Ce qu'il fait** : les palettes et les ambiances du jeu.
- **Fichier** : `interface/src/composants/Ambiances.tsx`

### EcranDecoupe — « Découpage »
- **On y arrive par** : menu d'une carte de la toile → *Découper* ; ou, dans la retouche, la fabrique *Découper* ; ou depuis l'atelier d'une animation.
- **Ce qu'il fait** : taille une planche ou une carte en plusieurs images (et en bandes).
- **Fichier** : `interface/src/composants/Decoupe.tsx`

### EcranFamille — « Les sujets », et la grille d'une famille
- **On y arrive par** : colonne de gauche → *Les sujets* ; ou *Les sujets* depuis le tableau de bord ; ou en cliquant une famille dans la colonne de l'écran lui-même.
- **Ce qu'il fait** : la liste des sujets et des équipements du jeu, par famille, avec recherche, filtres, collections, tri, glisser-déposer et trois vues.
- **RP7 (16 septembre 2026)** : c'est la fusion de cet écran et de l'ancien `BibliothequeDesAssets.tsx`, qui a disparu — c'était une seconde grille d'assets faisant le même travail. Voir *Les doublons*.
- **Fichier** : `interface/src/composants/Famille.tsx`

### Galerie — « Galerie »
- **On y arrive par** : colonne de gauche → *Galerie* ; c'est aussi l'écran de départ à l'ouverture.
- **Ce qu'il fait** : la grille de toutes les images du jeu, avec filtre, sélection, fiche à droite et ce qui est en cours de fabrication.
- **Fichier** : `interface/src/composants/Galerie.tsx`

### EcranMontage — le montage d'un clip
- **On y arrive par** : la tuile d'un clip dans la galerie ; ou *Reprendre le montage* depuis l'atelier d'une animation.
- **Ce qu'il fait** : taille une animation dans une vidéo.
- **Fichier** : `interface/src/composants/Montage.tsx`

### EcranAtelierDeBande — l'atelier d'une animation
- **On y arrive par** : la vignette d'une animation dans *Animations* d'un sujet ; la galerie ; une découpe qui produit des bandes ; une source 3D conservée.
- **Ce qu'il fait** : règle une animation gardée, image par image.
- **Fichier** : `interface/src/composants/AtelierDeBande.tsx`

### Fabrications — « Fabrications »
- **On y arrive par** : colonne de gauche → *Fabrications* ; ou *Les fabrications* depuis le tableau de bord.
- **Ce qu'il fait** : la file de tout ce qui est demandé — images, clips, sons, équipements, 3D — et les méthodes locales.
- **Fichier** : `interface/src/composants/Fabrications.tsx`

### Livraisons — « Livrer au jeu »
- **On y arrive par** : colonne de gauche → *Livrer au jeu* ; *Livrer…* sur la page d'un sujet ; les boutons *Livraisons* des tuiles et des sons.
- **Ce qu'il fait** : deux onglets — livrer dans Godot, ou exporter des fichiers.
- **Fichier** : `interface/src/composants/Livraisons.tsx`

### Sortie — « Exporter des fichiers »
- **On y arrive par** : *Livrer au jeu* → onglet *Exporter des fichiers*.
- **Ce qu'il fait** : sort un lot de fichiers dans un dossier.
- **Fichier** : `interface/src/composants/Sortie.tsx`

### Installation — « Réglages » (la machine)
- **On y arrive par** : colonne de gauche → *Réglages* ; ou *Réglages* dans la barre de recherche. Il s'ouvre aussi tout seul à la toute première ouverture.
- **Ce qu'il fait** : les clés, ComfyUI, le dossier de travail — ce qui vaut pour tous les jeux de cette machine.
- **Fichier** : `interface/src/composants/Installation.tsx`

### PanneauAtelier — la fenêtre « Réglages »
- **On y arrive par** : le bouton *Réglages* ou l'état de la clé, dans la bande du haut ; ou *Les autres réglages* depuis l'installation.
- **Ce qu'il fait** : les clés, les garde-fous de l'agent, le dossier du jeu, les mouvements.
- **Fichier** : `interface/src/composants/ReglesDuJeu.tsx`

### EcranDepenses — « Les dépenses »
- **On y arrive par** : le montant, dans la bande du haut ; ou *Les dépenses* depuis les Fabrications.
- **Ce qu'il fait** : ce que chaque appel a coûté.
- **Fichier** : `interface/src/composants/Depenses.tsx`

### Ouverture — choisir un jeu
- **On y arrive par** : le nom du jeu, en haut de la colonne de gauche.
- **Ce qu'il fait** : ouvrir, créer, supprimer ou reconstruire un jeu.
- **Fichier** : `interface/src/composants/Ouverture.tsx`

### ReglesDuJeu — « Commencer un jeu »
- **On y arrive par** : *Ouverture* → *Commencer un jeu*. **Seul ce mode-là est atteignable.**
- **Ce qu'il fait** : les quatre questions — son nom, son allure, sa vue, son monde.
- **Attention** : le même écran en mode *réglages*, pour rouvrir ces quatre questions sur un jeu qui existe, n'est plus atteignable. Voir *Les écrans morts*.
- **Fichier** : `interface/src/composants/ReglesDuJeu.tsx`

### EcranFamille — la grille d'une famille
- **On y arrive par** : une famille cliquée depuis le tableau de bord ou depuis *Les assets*.
- **Ce qu'il fait** : les sujets d'une famille, avec recherche, filtres, collections, et *nommer une chose*.
- **Fichier** : `interface/src/composants/Famille.tsx`

### ReglagesDeFamille — les réglages d'une famille
- **On y arrive par** : la grille d'une famille → *Réglages*.
- **Ce qu'il fait** : le barème d'échelle et les modèles par défaut de cette famille.
- **Fichier** : `interface/src/composants/ReglagesDeFamille.tsx`

### PageDuSujet — la page d'un sujet
- **On y arrive par** : un sujet cliqué depuis le tableau de bord, *Les assets*, la grille d'une famille, les Fabrications, la barre de recherche, ou après l'avoir créé.
- **Ce qu'il fait** : le nom, la fiche courte, et six onglets — Animations, Images fixes, Sources & clips, Pas encore rangé, Équipement, Objectif & règles — plus un menu *Autres outils*.
- **Fichier** : `interface/src/composants/PageDuSujet.tsx`

### EssaiDuSujet — « Tester les animations »
- **On y arrive par** : page d'un sujet → onglet *Animations* → *Tester les animations*.
- **Ce qu'il fait** : joue les animations du sujet, avec un second sujet à côté pour comparer les tailles.
- **Fichier** : `interface/src/composants/EssaiDuSujet.tsx`

### GrilleDuJeu — « Sur la grille du jeu »
- **On y arrive par** : page d'un sujet → *Autres outils* → *Voir la grille du jeu*.
- **Ce qu'il fait** : pose le sujet sur les cases du jeu pour juger sa taille.
- **Fichier** : `interface/src/composants/GrilleDuJeu.tsx`

### Comparer — « Comparer »
- **On y arrive par** : page d'un sujet → *Autres outils* → *Comparer* ; ou depuis la grille du jeu.
- **Ce qu'il fait** : deux sujets côte à côte, ou deux images du même sujet.
- **Fichier** : `interface/src/composants/Comparer.tsx`

### EcranEtabli — « Cases, planches et calibrage »
- **On y arrive par** : page d'un sujet → *Autres outils* → *Cases, planches et calibrage*.
- **Ce qu'il fait** : la matrice des cases du sujet, d'où s'ouvrent la planche, le calibrage, la vitrine, la fiche longue et le panneau d'un calque.
- **Fichier** : `interface/src/composants/EtabliDuSujet.tsx`

### EcranPlanche — une planche de pose
- **On y arrive par** : la matrice du sujet → une pose.
- **Ce qu'il fait** : prépare une planche d'une attitude vue sous plusieurs directions.
- **Fichier** : `interface/src/composants/Planche.tsx`

### EcranCalibrage — le calibrage
- **On y arrive par** : la matrice du sujet, ou la fiche longue.
- **Ce qu'il fait** : met toutes les poses d'un sujet à la même taille.
- **Fichier** : `interface/src/composants/Calibrage.tsx`

### EcranVitrine — la vitrine
- **On y arrive par** : la matrice, ou une planche.
- **Ce qu'il fait** : montre les images retenues du sujet.
- **Fichier** : `interface/src/composants/Vitrine.tsx`

### Retouche — « La retouche »
- **On y arrive par** : la fiche d'une image dans la galerie ; une image d'*Images fixes* ; *Autres outils → Retoucher l'image* ; le comparateur ; un calque depuis la page d'un emploi ; une image depuis les Fabrications, les tuiles ou la barre de recherche.
- **Ce qu'il fait** : la chaîne de retouche — huit tables — plus deux fabriques : découper, extraire un élément.
- **Fichier** : `interface/src/composants/Retouche.tsx`

### EcranSuperposition — « Extraire un élément »
- **On y arrive par** : la retouche → fabrique *Extraire* ; ou *Extraire un élément* sur la page d'un sujet.
- **Ce qu'il fait** : sépare un calque d'une image.
- **Fichier** : `interface/src/composants/Superposition.tsx`

### AssocierImageEquipement — « Associer cette image à un équipement »
- **On y arrive par** : la retouche → *Associer à un équipement*.
- **Ce qu'il fait** : rattache l'image ouverte à une pièce et à un emploi.
- **Fichier** : `interface/src/composants/AssocierImageEquipement.tsx`

### Emplois — la page d'une pièce d'équipement
- **On y arrive par** : *Les assets* → un équipement ; l'onglet *Équipement* d'un sujet ; après avoir créé une pièce.
- **Ce qu'il fait** : les emplois d'une pièce — qui la porte, comment — et sa référence.
- **Fichier** : `interface/src/composants/Emplois.tsx`

### Emploi — la page d'un emploi
- **On y arrive par** : la page d'une pièce → un emploi ; ou un calque d'équipement depuis les Fabrications.
- **Ce qu'il fait** : règle un emploi et montre ses calques.
- **Fichier** : `interface/src/composants/Emploi.tsx`

### CalquesAnimes — « Ses animations »
- **On y arrive par** : la page d'un emploi porté → *Ses animations*.
- **Ce qu'il fait** : repose le calque de la pièce sur chaque image de chaque bande.
- **Fichier** : `interface/src/composants/CalquesAnimes.tsx`

### EcranClip — commander un clip
- **On y arrive par** : *animer* une case, depuis les onglets *Animations*, *Sources & clips* ou l'essai d'un sujet.
- **Ce qu'il fait** : le dernier écran avant qu'une vidéo soit payée.
- **Fichier** : `interface/src/composants/Clip.tsx`

### EcranEnvoi — ce qui part
- **On y arrive par** : *Générer* dans la barre qui paie ; ou *Envoi* depuis la barre de recherche.
- **Ce qu'il fait** : montre le texte exact et les images qui partent, avec le prix sur le bouton.
- **Fichier** : `interface/src/composants/Envoi.tsx`

### BarreQuiPaie — « Préparer une image »
- **On y arrive par** : *Fabriquer une image libre* (repos du codex), *Demander une image* (tableau de bord), *Créer* (Fabrications), ou en armant une case.
- **Ce qu'il fait** : le seul endroit d'où une image se commande — modèle, proportions, références, prompt, prix.
- **Fichier** : `interface/src/composants/BarreQuiPaie.tsx`

### PreparerUneFabrication — « Préparer une fabrication »
- **On y arrive par** : page d'un sujet → *Fabriquer…* ; *Fabriquer une image libre* (repos du codex) ; *Demander une image* (tableau de bord) ; *Préparer une image*, *Préparer une vidéo*, *Préparer un son*, *Nouvelle animation* et *Utiliser ce workflow* (Fabrications) ; ou en armant une case.
- **Ce qu'il fait** : la **seule** fenêtre de préparation du produit. Le type de résultat — image fixe, clip, son, rendu 3D — s'y choisit ; le bouton pressé ne fait que dire lequel est ouvert en arrivant. Le corps du type est l'ancienne fenêtre, sans son cadre.
- **RP4 (16 septembre 2026)** : elle remplace `ChoisirFabricationDuSujet.tsx`, l'écran d'aiguillage à trois portes, qui a disparu — ses deux listes, *Mouvement ou pose* et *Direction*, sont ici, avec leurs deux groupes.
- **Fichier** : `interface/src/composants/PreparerUneFabrication.tsx`

### Relecture — « Relire avant l'envoi »
- **On y arrive par** : le bouton *Relire avant l'envoi*, quel que soit le type préparé.
- **Ce qu'il fait** : le cadre unique de la relecture — le résumé en trois cases (*Fournisseur et modèle*, *Résultat demandé*, *Consommation estimée*), le message rouge qui bloque, et le pied qui paie. Ce qui part, chaque type le lit sur l'objet que l'envoi emprunte ; ce fichier ne compose rien.
- **RP4 (16 septembre 2026)** : six écrans de relecture écrivaient chacun leur en-tête, leur prix et leur bouton.
- **Fichier** : `interface/src/composants/Relecture.tsx`

### FabricationSuivie — préparer et suivre un clip pour un sujet
- **On y arrive par** : le type *Clip* de la fenêtre unique, pour un sujet ; ou une ligne de la file des Fabrications.
- **Ce qu'il fait** : suit une demande jusqu'à son résultat. Son corps sert de type *Clip* dans la fenêtre unique (`autonome={false}`).
- **Fichier** : `interface/src/composants/FabricationSuivie.tsx`

### ImporterPourUnSujet — « Importer… »
- **On y arrive par** : page d'un sujet → *Importer…* (en haut à droite) ; **ou** onglet *Images fixes* → une rangée vide → *Importer*. Les deux ouvrent la même fenêtre ; la rangée vide lui passe sa case, le bandeau n'en passe aucune.
- **Ce qu'il fait** : accepte un ou plusieurs fichiers, ou une image déjà en bibliothèque. Il devine ce qu'on lui donne — vidéo, planche, image — et enchaîne sur la suite : le montage, la découpe, ou rien. Il ne demande jamais la case avant ; elle vient du clic, ou elle s'offre après.
- **RP5 (15 septembre 2026)** : c'est la fusion de cet écran et de l'ancien `ImporterIntelligemment.tsx`, qui a disparu — c'était un second import pour un sujet faisant le même travail. Voir *Les doublons*.
- **Fichier** : `interface/src/composants/ImporterPourUnSujet.tsx`

### BibliothequePourImage — « Choisir une image »
- **On y arrive par** : *Choisir une référence* dans la barre qui paie ; *Ajouter une référence* dans l'écran de ce qui part ; depuis les fabrications locales, les tuiles, la vidéo libre, la 3D ; la page d'un emploi → une cible de calque → *Choisir une image* ; et la référence d'une pièce.
- **Ce qu'il fait** : choisit une image déjà en bibliothèque, sans la recopier, ou en importe une nouvelle depuis le disque. Là où celui qui l'ouvre a besoin d'un rôle — corps équipé, calque, ou référence —, un temps de relecture le demande avant de confirmer.
- **RP6 (15 septembre 2026)** : c'est la fusion de cet écran et de l'ancien `ChoisirImageEquipement.tsx`, qui a disparu — c'était une seconde grille de choix d'image faisant le même travail. Voir *Les doublons*.
- **Fichier** : `interface/src/composants/BibliothequePourImage.tsx`

### CreerUnAsset — créer un asset
- **On y arrive par** : *Créer un asset* depuis le tableau de bord ; ou *Créer* dans *Les assets*.
- **Ce qu'il fait** : nomme un sujet ou une pièce et ouvre sa page.
- **Fichier** : `interface/src/composants/CreerUnAsset.tsx`

### Tuiles — « Les tuiles du jeu »
- **On y arrive par** : *Les assets* → *Tuiles*.
- **Ce qu'il fait** : les jeux de tuiles du projet.
- **Fichier** : `interface/src/composants/Tuiles.tsx`

### AtelierSon — « Les sons du jeu »
- **On y arrive par** : *Les assets* → *Sons* ; un son depuis la galerie ou les Fabrications.
- **Ce qu'il fait** : écoute, juge et range les sons.
- **Fichier** : `interface/src/composants/AtelierSon.tsx`

### Source3DConservee — une source 3D gardée
- **On y arrive par** : la galerie, onglet des médias 3D.
- **Ce qu'il fait** : rouvre un rendu 3D conservé et mène à sa bande ou à son personnage.
- **Fichier** : `interface/src/composants/Source3DConservee.tsx`

### VoletGuide — le Guide
- **On y arrive par** : *Guide* dans la colonne de gauche ou dans la bande du haut ; touche `?`.
- **Ce qu'il fait** : explique l'écran où l'on se trouve.
- **Fichier** : `interface/src/composants/Guide.tsx`

### Barre — « Rechercher un geste »
- **On y arrive par** : *Rechercher un geste* en bas de la colonne de gauche ; Ctrl K.
- **Ce qu'il fait** : cherche un sujet, une pièce, une image, et lance les gestes gratuits.
- **Fichier** : `interface/src/composants/Barre.tsx`

### Apercu — l'image en grand
- **On y arrive par** : pointer une vignette et presser la barre d'espace, presque partout dans le produit.
- **Ce qu'il fait** : montre l'image en grand par-dessus tout le reste.
- **Fichier** : `interface/src/composants/Apercu.tsx`

### Les panneaux et volets montés dans ces écrans

Ils ne s'ouvrent pas seuls : ils vivent dans un des écrans ci-dessus. Tous sont atteignables.

| Composant | Où il apparaît | Fichier |
|---|---|---|
| `NavigationAtelier` | la colonne de gauche, toujours | `NavigationAtelier.tsx` |
| `EnTeteDeSurface` | la bande du haut, toujours | `EnTeteDeSurface.tsx` |
| `BarreEtat` | la bande du bas, toujours | `BarreEtat.tsx` |
| `GalerieMedias` | les onglets images / vidéos / sons / 3D de la galerie | `GalerieMedias.tsx` |
| `BarreOutils` | la barre de la galerie | `BarreOutils.tsx` |
| `Tuile` | chaque vignette de la galerie | `Tuile.tsx` |
| `Fiche` | le volet de droite de la galerie, et dans *Images fixes* | `Fiche.tsx` |
| `FicheDuClip` | le volet de droite quand un clip est choisi | `FicheDuClip.tsx` |
| `EcranDepliage` | quand une planche demande quelle case garder | `Depliage.tsx` |
| `Import` (`CeQuiNEstPasEntre`) | au-dessus de la grille, après un import refusé | `Import.tsx` |
| `FicheDuSujet` | le résumé en haut de la page d'un sujet | `FicheDuSujet.tsx` |
| `ImagesDuSujet` | onglet *Images fixes* | `ImagesDuSujet.tsx` |
| `AnimationsDuSujet` | onglet *Animations* | `AnimationsDuSujet.tsx` |
| `SourcesDuSujet` | onglet *Sources & clips* | `SourcesDuSujet.tsx` |
| `Sources3D` | dans *Sources & clips* | `Sources3D.tsx` |
| `EnAttenteDuSujet` | onglet *Pas encore rangé* | `EnAttenteDuSujet.tsx` |
| `VestiaireDuSujet` | onglet *Équipement* | `VestiaireDuSujet.tsx` |
| `TenuesDuSujet` | onglet *Équipement*, sous le vestiaire | `TenuesDuSujet.tsx` |
| `ObjectifDuSujet` | onglet *Objectif & règles* | `ObjectifDuSujet.tsx` |
| `PanneauCalque` | à droite de la matrice, quand un calque est ouvert | `Calque.tsx` |
| `CalquesDeLEmploi` | le corps de la page d'un emploi | `CalquesDeLEmploi.tsx` |
| `CouvertureDeLEmploi` | la couverture, dans la page d'un emploi | `CouvertureDeLEmploi.tsx` |
| `LectureDesCalques` | depuis la couverture d'un emploi | `LectureDesCalques.tsx` |
| `RelectureEquipement` | depuis la couverture d'un emploi, et depuis les Fabrications | `RelectureEquipement.tsx` |
| `EditeurCalqueCible` | la cible de calque ouverte dans un emploi | `EditeurCalqueCible.tsx` |
| `ReferencePiece` | la référence sur la page d'une pièce | `ReferencePiece.tsx` |
| `ResumeEmploi` | une ligne d'emploi sur la page d'une pièce | `ResumeEmploi.tsx` |
| `SuiviDesTravaux` | la file, dans les Fabrications | `FabricationSuivie.tsx` |
| `FileDesCalculsLocaux` | les calculs locaux, dans les Fabrications | `FileDesCalculsLocaux.tsx` |
| `WorkflowsLocaux` | *Mes méthodes locales*, dans les Fabrications | `WorkflowsLocaux.tsx` |
| `FabricationAudio` | une fabrication de son | `FabricationAudio.tsx` |
| `FabricationVideoLibre` | une fabrication de vidéo libre | `FabricationVideoLibre.tsx` |
| `Fabrication3D` | une fabrication 3D, et *Sources & clips* | `Fabrication3D.tsx` |
| `CameraDeRendu3D` | dans la fabrication 3D | `CameraDeRendu3D.tsx` |
| `CorrectionsDuSquelette` | dans la fabrication 3D | `CorrectionsDuSquelette.tsx` |
| `ApercuModele3D` | la visionneuse d'un modèle 3D | `ApercuModele3D.tsx` |
| `SourceDeFrame` | une image de l'atelier d'une animation | `SourceDeFrame.tsx` |
| `ImagesALivrer` | *Livrer dans Godot*, choix des images | `ImagesALivrer.tsx` |
| `Mouvements` | le bloc des mouvements, dans la fenêtre Réglages | `Mouvements.tsx` |
| `PanneauReglages` | les réglages dépliés de la barre qui paie | `PanneauReglages.tsx` |
| `ChampPrompt` | le champ de texte de la barre qui paie | `ChampPrompt.tsx` |
| `CadreDialogue` | le cadre de toutes les fenêtres | `CadreDialogue.tsx` |
| `SurfaceZoomable` | le fond zoomable de la découpe et de la superposition | `SurfaceZoomable.tsx` |
| `Infobulle` | les bulles d'aide, partout | `Infobulle.tsx` |
| `BrouillonLocal` | l'avis « brouillon en cours » des écrans qui écrivent | `BrouillonLocal.tsx` |
| `MemoireDuParcours` | mémorise l'onglet et le défilement d'un écran à l'autre | `MemoireDuParcours.tsx` |
| `pieces` | les boutons, curseurs, jauges et libellés communs | `pieces.tsx` |

## Les écrans morts

### Arbre
- **Pourquoi il est mort** : **personne ne l'importe.** Recherche de tout ce qui contient `Arbre` dans `interface/src/` : une seule occurrence hors du fichier lui-même, et c'est un commentaire d'`App.tsx` ligne 1680 — « l'ancien `Arbre` un jour ». Aucun `import`, aucun `<Arbre`.
- **Ce qu'il faisait** : la colonne de gauche d'avant — les jeux, les collections, le total du projet, et le journal des appels ratés.
- **Ce qui l'a remplacé** : `NavigationAtelier.tsx` pour la colonne, `EcranDepenses` pour le total. **Le journal des appels ratés, lui, n'a pas de remplaçant** : c'était le seul écran qui listait ce qui avait coûté sans rien produire.
- **Encore testé ?** : non.
- **Fichier** : `interface/src/composants/Arbre.tsx` (390 lignes)

### Carnet
- **Pourquoi il est mort** : le composant `Carnet` n'est monté que dans son propre essai. Recherche de `<Carnet` dans tout `interface/src/` : une seule ligne, `composants/Carnet.test.tsx:65`. Les cinq fichiers qui importent `./Carnet` ne lui prennent que des constantes (`FAMILLES`, `NOM_DANS_LE_CARNET`, `NOM_DE_LA_RUBRIQUE`) et un type (`LigneDeFamille`) — vérifié ligne à ligne dans `App.tsx`, `BibliothequeDesAssets.tsx`, `CreerUnAsset.tsx`, `TableauDeBord.tsx` et `lieux-noms.ts`.
- **Ce qu'il faisait** : la colonne de gauche de la V4 — les familles dépliables, les collections, les cibles de dépôt du glisser-déposer, le pied avec les réglages.
- **Ce qui l'a remplacé** : `NavigationAtelier.tsx`, qui a sept portes fixes et ne déplie rien.
- **Conséquence à retenir** : deux fonctions d'`EcranFamille` dépendaient du carnet et sont tombées avec lui — le « ＋ Nouvelle collection » et la cible de dépôt du glisser-déposer (voir plus bas).
- **Encore testé ?** : oui — `interface/src/composants/Carnet.test.tsx`, 244 lignes.
- **Fichier** : `interface/src/composants/Carnet.tsx` (le composant seulement ; le reste du fichier sert encore)

### DelegationDuJeu
- **Pourquoi il est mort** : il n'est monté qu'à une condition, `dans(pile, "delegation")`, et **rien n'écrit jamais ce lieu**. Recherche de `"delegation"` dans `interface/src/`, hors essais : quatre occurrences seulement — la déclaration du type dans `lieux.ts`, son nom dans `lieux-noms.ts`, la lecture `dans(pile, "delegation")` dans `App.tsx:300`, et le montage lui-même dans `App.tsx:2853`. Aucun `entrer(..., { genre: "delegation" })`, aucun `poser`.
- **Ce qu'il faisait** : l'écran de l'agent — ce qu'on lui délègue, et ses travaux.
- **Encore testé ?** : oui — `interface/src/composants/DelegationDuJeu.test.tsx`, 80 lignes.
- **Fichier** : `interface/src/composants/DelegationDuJeu.tsx`

### TravailConserve
- **Pourquoi il est mort** : il n'est monté qu'à la condition `travailOuvert`, qui vient du lieu `travail`. Recherche de `genre: "travail"` hors essais : **une seule écriture**, et elle est à l'intérieur du bloc de `DelegationDuJeu` (`App.tsx:2853`), c'est-à-dire dans un écran lui-même injoignable.
- **Ce qu'il faisait** : rouvrait une fabrication conservée par son identifiant.
- **À savoir** : ce qu'il affichait (`FenetreDuTravail`) reste atteignable autrement — par la file des Fabrications. Seul l'emballage est mort.
- **Encore testé ?** : oui, indirectement — `composants/FabricationAudio.test.tsx` et `composants/TravauxEquipement.test.tsx` le montent.
- **Fichier** : `interface/src/composants/FabricationSuivie.tsx` (l'export `TravailConserve`)

### ReglesDuJeu, en mode « réglages »
- **Pourquoi il est mort** : il ne s'ouvre qu'avec le lieu `regles`, écrit uniquement par `setReglesOuvertes(true)`. Recherche de `setReglesOuvertes` dans tout `interface/src/` : trois lignes seulement — la déclaration (`App.tsx:271`) et **un seul appel, `setReglesOuvertes(false)`** (`App.tsx:1883`). Le mot *Réglages* de la colonne de gauche ouvre `Installation`, pas celui-ci.
- **Ce qu'il faisait** : rouvrait les quatre questions du jeu — son nom, son allure, sa vue, son monde.
- **Ce que ça coûte** : une fois le jeu créé, ces quatre questions ne se rouvrent plus nulle part. `Installation` parle de la machine, `PanneauAtelier` des clés, de l'agent, du dossier et des mouvements, et l'écran *Univers* n'a plus que deux côtés (Inspiration, Ambiances et couleurs). Le barème d'une famille reste réglable par `ReglagesDeFamille`, la palette par la retouche — le reste, non.
- **Encore testé ?** : oui — `composants/ReglesDuJeu.test.tsx` monte `mode="reglages"` par défaut (ligne 278). Les cas explicitement `mode="creation"` restent valables.
- **Fichier** : `interface/src/composants/ReglesDuJeu.tsx`

### « Choisir une image de référence » — la grille écrite dans App.tsx
- **Pourquoi il est mort** : il s'ouvre à la condition `envoiOuvert && choixDeReference`, et `choixDeReference` vient du lieu `reference`, écrit uniquement par `setChoixDeReference(true)`. Recherche de `setChoixDeReference` dans `interface/src/`, hors essais : sept lignes, **et les quatre appels réels sont tous à `false`** (`App.tsx:2099`, `gestes.ts:223`, `gestes.ts:248`, `paiement.ts:329`). Jamais `true`.
- **Ce qu'il faisait** : ouvrait la grille du produit par-dessus l'écran de confirmation pour y ajouter une référence sans perdre les corrections en cours.
- **Ce qui l'a remplacé** : la fenêtre *Choisir une référence* (`BibliothequePourImage`), ouverte par `setReferenceDePreparation(true)` — depuis la barre qui paie et depuis l'écran de ce qui part.
- **Encore testé ?** : non.
- **Fichier** : `interface/src/App.tsx`, lignes 2064 à 2125

### PlanDuJeu et Vestiaire
- **Pourquoi ils sont morts** : deux composants exportés par `EtabliDuSujet.tsx` et **jamais montés**. Recherche de `PlanDuJeu` dans tout `interface/src/` : une seule ligne, sa propre déclaration. Recherche de `<Vestiaire` : aucune (les occurrences de `Vestiaire` ailleurs sont un type de `api.ts` et le composant différent `VestiaireDuSujet`).
- **Ce qu'ils faisaient** : `PlanDuJeu`, la liste des attitudes du jeu ; `Vestiaire`, la liste des pièces et des emplacements de corps.
- **Ce qui les a remplacés** : `VestiaireDuSujet` et `Emplois` pour l'équipement.
- **Encore testés ?** : non.
- **Fichier** : `interface/src/composants/EtabliDuSujet.tsx`, lignes 543 et 735

### Le champ « ＋ Nouvelle collection » d'EcranFamille
- **Pourquoi il est mort** : ce champ s'ouvre quand la propriété `creerUnGroupe` passe au-dessus de zéro (`Famille.tsx:572`). `App.tsx` lui passe **la constante `0`** (`creerUnGroupe={0}`, ligne 2267). Son seul déclencheur était le bouton du carnet, qui est mort avec lui.
- **Ce qu'il faisait** : créer une collection depuis la grille d'une famille.
- **Encore testé ?** : non.
- **Fichier** : `interface/src/composants/Famille.tsx`

### L'alias SonsDuJeu
- **Pourquoi il est mort** : `export const SonsDuJeu = AtelierSon` — aucune autre occurrence du mot dans `interface/src/`.
- **Ce qu'il faisait** : rien de plus qu'`AtelierSon` ; c'est un second nom laissé derrière un renommage.
- **Encore testé ?** : non.
- **Fichier** : `interface/src/composants/AtelierSon.tsx`, ligne 75

## Les doublons

### ImporterIntelligemment et ImporterPourUnSujet font le même travail — **résolu par `RP5`, le 15 septembre 2026**
- **Ce qui reste** : `ImporterPourUnSujet.tsx` seul, ouvert par les deux portes. `ImporterIntelligemment.tsx` **a été retiré** ; sa règle, elle, a gagné — on ne demande rien avant de savoir ce qu'on donne. La suite du relevé décrit l'état d'avant.
- **Ce que fait `ImporterIntelligemment`** : un seul bouton *Importer…*, en haut de la page d'un sujet. Il prend le fichier, regarde ce que c'est — vidéo, planche, image —, l'importe, le rattache au sujet, puis ouvre la suite qui convient : le montage pour une vidéo, la découpe pour une planche, rien pour une image simple. Il ne pose aucune question.
- **Ce que fait `ImporterPourUnSujet`** : une fenêtre qui demande **d'abord** la pose et la direction, puis accepte un ou plusieurs fichiers, ou une image déjà en bibliothèque. Il les téléverse et les range dans la case choisie.
- **Ce qui les sépare vraiment** : la question posée avant. Le second demande la pose et la direction avant de savoir ce qu'on lui donne — la question qu'`AU21` a explicitement retirée du premier parce qu'elle ne veut rien dire pour une vidéo. Le second sait en revanche reprendre une image déjà en bibliothèque, et il accepte plusieurs fichiers d'un coup ; le premier ne sait faire ni l'un ni l'autre. Les deux appellent `api.designer` pour rattacher au sujet.
- **Lequel l'auteur atteint** : **les deux.** `ImporterIntelligemment` par le bouton *Importer…* du bandeau ; `ImporterPourUnSujet` par une rangée vide de l'onglet *Images fixes*.
- **Fichiers** : `interface/src/composants/ImporterIntelligemment.tsx`, `interface/src/composants/ImporterPourUnSujet.tsx`

### BibliothequeDesAssets et EcranFamille font le même travail — **résolu par `RP7`, le 16 septembre 2026**
- **Ce qui reste** : `EcranFamille` seul, dans `interface/src/composants/Famille.tsx`. Monté sans famille il montre les quatre d'un coup — c'est la porte *Les sujets* ; monté sur une famille il la montre seule. `BibliothequeDesAssets.tsx` **a été retiré**, et sa colonne des familles et des collections est passée dans l'écran unique. La suite du relevé décrit l'état d'avant.
- **Ce que faisait `BibliothequeDesAssets`** : la porte *Les assets*. Elle interrogeait `api.familleDeSujets` pour chaque famille, avec recherche, filtre (tous / incomplets / sans description), collection, tri, vue liste ou grille, sélection multiple et rangement en collection. Elle montrait aussi les pièces d'équipement, et portait les boutons *Tuiles* et *Sons*.
- **Ce que faisait `EcranFamille`** : la grille d'**une** famille. Elle interrogeait la même route `api.familleDeSujets`, avec recherche, les mêmes trois filtres, la collection ouverte, un volet de droite, le glisser-déposer vers les collections, la vue *Les poses*, et *nommer une chose* pour créer un sujet.
- **Ce qui les séparait vraiment** : la portée (toutes les familles contre une seule) et deux gestes que la seconde avait en plus — le glisser-déposer et les réglages de famille. Tout le reste était la même lecture du même serveur. `EcranFamille` avait de plus été dessiné pour vivre à côté du carnet, qui est mort : son champ de nouvelle collection ne s'ouvrait plus, et sa seconde cible de dépôt avait disparu avec lui. **Les deux employaient aussi deux types de glisser incompatibles** — du JSON sous `application/x-asset-kitchen-library-subjects` d'un côté, des identifiants séparés par un saut de ligne sous `application/x-sujets-atelier` de l'autre : attraper une carte dans l'un et la lâcher dans l'autre ne faisait rien. Le second l'a emporté.
- **Lequel l'auteur atteignait** : **les deux.** `BibliothequeDesAssets` par la porte *Les assets* ; `EcranFamille` en cliquant une famille depuis le tableau de bord ou depuis *Les assets* — c'est-à-dire depuis l'autre.
- **Fichiers** : `interface/src/composants/Famille.tsx` (reste), `interface/src/composants/BibliothequeDesAssets.tsx` (retiré).

### BibliothequePourImage et ChoisirImageEquipement font le même travail
- **Ce que fait `BibliothequePourImage`** : une grille de vignettes de 128 px, lue par `api.assets({ recherche, collection, favoris, limite })`, avec une recherche, un choix de collection, une case *Favoris*, un bouton *Afficher les suivantes*, et l'aperçu en grand au survol. Un clic choisit l'image.
- **Ce que fait `ChoisirImageEquipement`** : une grille de vignettes de 128 px, lue par `api.assets({ recherche, favoris, limite })`, avec une recherche, une case *Favoris*, un bouton *Afficher les suivantes*. Un clic sélectionne ; il faut ensuite dire le rôle de l'image — corps équipé, calque, ou référence — puis confirmer. Il sait aussi importer un fichier depuis le disque.
- **Ce qui les sépare vraiment** : le rôle demandé après le choix, et l'import de fichier — qui n'existent que dans le second. Le filtre par collection et l'aperçu en grand n'existent que dans le premier. La grille elle-même, la recherche, les favoris et la pagination sont écrits deux fois.
- **Lequel l'auteur atteint** : **les deux.** Le premier par *Choisir une référence* dans la barre qui paie ; le second dans la chaîne des équipements.
- **Et il y en avait un troisième** : la grille *Choisir une image de référence* écrite dans `App.tsx`, qui est morte (voir plus haut).
- **Fichiers** : `interface/src/composants/BibliothequePourImage.tsx`, `interface/src/composants/ChoisirImageEquipement.tsx`

### FicheDuSujet et FicheDeLaChose font le même travail — **résolu par `RP8`, le 16 septembre 2026**
- **Ce qui reste** : `FicheDuSujet.tsx` seul, ouvert en un clic depuis la page du sujet. `FicheChose.tsx` **a été retiré** ; son dialogue « Modifier la fiche » porte désormais aussi le signalement, les sept textes de style et les images de référence, chacun avec l'aide lue dans `interface/src/aide.ts`. La suite du relevé décrit l'état d'avant.
- **Ce que faisait `FicheDuSujet`** : le bloc en haut de la page d'un sujet. Portrait, nom, description, collections, compte d'images retenues, et un mode édition qui écrit `api.reglerPersonnage`.
- **Ce que faisait `FicheDeLaChose`** : une page entière, en cinq sections qui défilent — le sujet (nom, description, signalement), son habillage, ses textes de style, ses images de référence, son calibrage — avec un sommaire à gauche et le portrait en tête. Elle écrivait elle aussi `api.reglerPersonnage`.
- **Ce qui les séparait vraiment** : la longue portait trois choses que la courte n'avait pas — le signalement qui part dans chaque prompt, les textes de style, et les images de référence du sujet. Le portrait, le nom et la description étaient écrits deux fois, avec deux mises en page différentes. Deux de ses cinq sections n'ont pas suivi la fusion : « ce que le jeu réclame » et « ce qui est fait » redisaient en lecture seule les onglets *Objectif & règles*, *Images fixes* et *Animations* de la même page ; le lien vers le calibrage et celui vers la vitrine restent des gestes directs de la matrice, inchangés.
- **Lequel l'auteur atteignait** : **les deux**, mais pas au même prix. La courte s'ouvrait avec la page du sujet. La longue demandait trois clics : *Autres outils* → *Cases, planches et calibrage* → *Sa fiche* — ce qui faisait que les trois réglages qu'elle était seule à porter étaient enterrés sous un menu qui parle de calibrage.
- **Fichiers** : `interface/src/composants/FicheDuSujet.tsx` (reste), `interface/src/composants/FicheChose.tsx` (retiré).

## Les douteux

### Le glisser-déposer d'EcranFamille — **tranché par `RP7`, le 16 septembre 2026**
- **Ce qui empêchait de trancher** : l'écran calculait ce qu'on traîne et le remontait à `App.tsx` (`surGlisser` → l'état `glisses`), qui le lui rendait aussitôt et ne s'en servait nulle part ailleurs. La deuxième cible de dépôt vivait dans le carnet, qui est mort.
- **Ce qui a été fait** : l'aller-retour par le parent est supprimé — les deux cibles sont maintenant dans l'écran, les puces du volet et les lignes de collection de la colonne de gauche, revenue avec la fusion. Un seul type, `application/x-sujets-atelier`, et la charge utile voyage vraiment : deux essais de `Famille.test.tsx` la relisent au `drop` avec un `DataTransfer` doublé, un par cible.

### Le journal des appels ratés
- **Ce qui empêche de trancher** : il vivait dans `Arbre.tsx`, qui est mort. Je n'ai trouvé aucun autre écran qui liste les générations en échec — `EcranDepenses` liste ce qui a été dépensé, la galerie montre ce qui est en cours. Il se peut qu'une de ces deux listes couvre le besoin ; il se peut aussi que la capacité soit simplement perdue. **Pour trancher, il faudrait** savoir si un appel raté apparaît quelque part dans les dépenses.

### La barre qui paie sur la page d'un sujet
- **Ce qui empêche de trancher** : `App.tsx` passe `barreQuiPaie={null}` à `PageDuSujet` (ligne 2419). Le commentaire du dépôt dit pourtant que la page d'un sujet est « l'un des deux lieux d'où l'argent part ». En pratique on paie depuis la fenêtre *Préparer une image*, ouverte par *Fabriquer…*. **Il faut décider** si c'est voulu — un détour de plus pour payer — ou si le `null` est un reste.

## Les tests orphelins

| Fichier d'essai | Ce qu'il teste | État |
|---|---|---|
| `interface/src/composants/Carnet.test.tsx` | le composant `Carnet` (244 lignes) | **orphelin** — le composant n'est plus monté nulle part ; les constantes qu'il importe aussi, elles, servent encore |
| `interface/src/composants/DelegationDuJeu.test.tsx` | `DelegationDuJeu` (80 lignes) | **orphelin** — l'écran est injoignable |
| `interface/src/composants/ReglesDuJeu.test.tsx` | `ReglesDuJeu` | **partiel** — les cas montés en `mode="reglages"` (le défaut, ligne 278) testent un mode injoignable ; les cas `mode="creation"` restent valables |
| `interface/src/composants/FabricationAudio.test.tsx` | entre autres `TravailConserve` | **partiel** — cet emballage-là est injoignable, mais ce qu'il rend est atteignable par les Fabrications |
| `interface/src/composants/TravauxEquipement.test.tsx` | entre autres `TravailConserve` | **partiel** — même raison |

`Arbre.tsx`, les exports `PlanDuJeu` et `Vestiaire`, l'alias `SonsDuJeu` et la grille
de référence d'`App.tsx` ne sont testés nulle part : personne ne s'apercevra de leur
absence si on les retire.
