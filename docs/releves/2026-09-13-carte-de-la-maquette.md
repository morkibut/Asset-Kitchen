# Carte de la maquette de l'atelier unifié — 13 septembre 2026

Ce que la maquette `docs/maquettes-atelier-unifie/02-atelier.html` propose, écran par écran.
Relevé de référence : il dit ce que l'auteur a validé, pas ce que le produit tient.

## L'ossature

La page est coupée en deux : une colonne de navigation à gauche, un écran à droite.
Un bandeau traverse le haut. Les fenêtres s'ouvrent par-dessus.

- **Bandeau de maquette** (toujours visible) — mention « MAQUETTE À ESSAYER » et bouton « Noter une remarque »
- **Colonne de gauche**
  - Nom du jeu ouvert, nombre d'assets, bouton pour replier la colonne
  - Groupe « Atelier »
    - Le jeu
    - Univers & toile
    - Les assets
    - Galerie
    - Fabrications (avec le nombre de travaux en attente)
    - Livrer au jeu
  - Arbre des familles et collections
    - Champ « Trouver une collection »
    - Personnages · Monstres · Objets · Décors · Interface · Équipement
      - « Tout voir », puis une ligne par collection, puis « + Collection »
  - Groupe « Préférences »
    - Réglages
    - Essayer la maquette
    - Vos remarques · nombre
  - Pied de colonne
    - Brouillons · nombre
    - Lien « Couverture et limites »
    - Lien « Planches de référence »
- **Barre de fil d'Ariane** (en haut de chaque écran) — flèches « ← » / « → », chemin « jeu / asset / écran », choix « Fond des images »
- **Écrans qui pendent sous les lieux**
  - Les assets → **Fiche de l'asset**
    - onglet **Animations**
    - onglet **Images fixes**
    - onglet **Sources & clips** → **Clip source** → **Du clip à l'animation** ; et → **Du modèle 3D aux sprites**
    - onglet **Équipement** → **Emploi d'un équipement** → **Calque d'un équipement** ; et → **Combiner les équipements**
    - onglet **Objectif & règles**
  - Les assets → **Fiche de la pièce** (quand l'asset est de la famille Équipement) → **Emploi d'un équipement**
  - Depuis n'importe quel résultat → **Retouche** → **Découper une image** · **Extraire un élément** · **Comparer les versions**
  - Les assets et la Fiche → **Découper une image** et **Extraire un élément** (aussi accessibles directement)
  - Univers & toile → **Découper une image** (sur une carte)
  - Réglages : quatre onglets — Univers · Moteurs & workflows · Agent MCP · Consommations
- **Fenêtres partagées** — Relire avant l'envoi · Choisir dans la bibliothèque · Noter une remarque · Brouillons à reprendre · Quitter cette retouche ?

## Les écrans

### Le jeu

- **On y entre par** : « Le jeu » dans la colonne de gauche. C'est l'écran d'ouverture.
- **Ce qu'on y fait** :
  - Lire le nom du jeu et la phrase qui le décrit.
  - Cliquer « Créer un asset » (ouvre la fenêtre « Créer un asset »).
  - Cliquer « Ouvrir la toile ».
  - Cliquer « Ouvrir le pèlerin ».
  - Cliquer « Parcourir les assets », « Préparer la livraison » ou « Commencer la visite ».
- **Ce qui en sort** : rien. L'écran ne fait qu'aiguiller.
- **Simulé dans la maquette** : les compteurs (nombre d'assets, de résultats, de retenus) sont vrais ; ils viennent des données de démonstration du navigateur.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:149`

### Univers & toile

- **On y entre par** : « Univers & toile » dans la colonne ; « Ouvrir la toile » depuis Le jeu.
- **Ce qu'on y fait** :
  - Ajouter une carte avec « + Note », « + Image », « Depuis la galerie », « + Îlot ».
  - Chercher dans le champ « Rechercher » (filtre les cartes sur leur titre et leur texte).
  - Déplacer une carte en tirant sa barre de titre ; déplacer un îlot par son nom, ses cartes suivent.
  - Basculer « Déplacer la vue » / « Main active » pour naviguer ; Espace + glisser fait la même chose ; la molette zoome.
  - Régler le zoom au clavier dans le champ « Zoom » (25 à 200 %), ou cliquer « Tout cadrer ».
  - Cliquer « Relier deux cartes », puis choisir la première et la seconde carte.
  - Cocher « Sélectionner » sur une carte ; la sélection est comptée au-dessus de la toile.
  - Cliquer « Annoter » sur une carte, ou double-cliquer dessus (fenêtre « Annoter la carte » : titre, texte libre, îlot, position X et Y).
  - Cliquer « Mettre en réserve » sur la sélection, puis « Reposer sur la toile » depuis le tiroir « Réserve ».
  - Cliquer « Effacer la sélection ».
  - Cliquer « Cadre » sur un îlot (fenêtre « Ajuster le cadre de l'îlot » : largeur, hauteur, ou « Ajuster aux cartes »).
  - Cliquer « Fabriquer depuis la sélection… », « Fabriquer depuis toute la toile… » ou « Fabriquer depuis cet îlot ».
  - Cliquer « Découper » sur une carte image.
  - Cliquer « Ouvrir le résultat » sur une carte issue de la galerie.
  - Cliquer « Règles de l'univers » (va aux Réglages).
- **Ce qui en sort** : la fenêtre « Choisir ce qui part de la toile ». On y choisit l'asset visé, « Image fixe » ou « Animation », puis on coche image par image et note par note. Les images sont cochées d'avance, les notes non. « Préparer avec ces références » ouvre la fenêtre « Préparer une fabrication » avec ces références et ces notes en consigne.
- **Simulé dans la maquette** : rien n'est envoyé. Les positions, le zoom, la sélection, la réserve et le déplacement de la vue sont conservés dans ce navigateur.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/toile-livraison.js:13`

### Les assets

- **On y entre par** : « Les assets » dans la colonne ; « Tout voir » ou un nom de collection dans l'arbre ; « Parcourir les assets » depuis Le jeu ; « Choisir des résultats » depuis Livrer au jeu.
- **Ce qu'on y fait** :
  - Chercher dans « Rechercher un asset ».
  - Filtrer avec « À faire » : Tous, À produire, À juger, Modifiés depuis livraison.
  - Trier avec « Trier les assets » : Nom A → Z, Nom Z → A, Plus de résultats.
  - Basculer entre « Liste » (40 par page) et « Grille » (24 par page).
  - Cliquer « Réinitialiser les filtres » quand un filtre est actif.
  - Cocher un asset, ou cliquer « Sélectionner cette page ».
  - Cliquer « Ranger la sélection » (fenêtres « Ranger par famille » puis « Ranger la sélection » — choisir une collection ou en créer une).
  - Cliquer « Retirer de cette collection » quand une collection est ouverte.
  - Cliquer « Effacer la sélection ».
  - Cliquer « Nouvelle collection », « Renommer », « Archiver la collection », « Collections archivées » (avec « Restaurer »), « Annuler le dernier rangement ».
  - Cliquer « Toutes les familles ».
  - Cliquer « Ouvrir » sur un asset.
  - Cliquer « Créer un asset ».
  - Paginer avec « Précédent » / « Suivant ».
  - Dans une session d'essai (`?essai=nom`) seulement : « Ajouter un catalogue de 600 exemples » et « Ajouter 24 collections d'essai ».
- **Ce qui en sort** : la Fiche de l'asset, ou la Fiche de la pièce si l'asset est de la famille Équipement.
- **Simulé dans la maquette** : chaque carte affiche un aperçu dessiné à partir de la version retenue, le nombre de résultats, de retenus et, pour une pièce, le nombre d'emplois et de calques prêts.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/parcours.js:108`

### Galerie

- **On y entre par** : « Galerie » dans la colonne ; « Voir tous les clips de la galerie » ; le bouton « Galerie » depuis le Clip source et le Montage.
- **Ce qu'on y fait** :
  - Chercher dans « Rechercher un résultat ».
  - Filtrer par « Média » : Tous, Image, Animation, Vidéo, 3D.
  - Filtrer par « Rôle » : Tous, Image, Animation, Clip source, Source 3D, Source équipée, Planche, Calque.
  - Filtrer par « Jugement / état » : Tous, Retenu, Non jugé, Écarté, Prêt, À vérifier, À extraire, À déplier.
  - Filtrer par « Rattachement » : tous les assets, ou « Essais libres ».
  - Trier par « Plus récents », « Plus anciens », « Nom A → Z ».
  - Basculer « Afficher les résultats séparément » / « Regrouper par fabrication / source ».
  - Cliquer « Tout déplier sur cette page » et « Tout replier ».
  - Ouvrir un groupe (« Ouvrir les dérivés ») pour voir source, planches et calques ensemble.
  - Cliquer « Ouvrir le résultat », « Ouvrir l'emploi et sa frame » ou « Ouvrir la planche » selon l'élément.
  - Cliquer « Poser sur la toile ».
  - Cliquer « Fabriquer librement ».
  - Paginer avec « Précédent » / « Suivant » (16 groupes, ou 24 résultats en vue séparée).
- **Ce qui en sort** : selon l'élément — la Retouche, le Clip source, l'atelier 3D, le Calque d'un équipement, ou une petite fenêtre avec « Rattacher à un asset », « Lire le clip », « Monter une animation », « Préparer des rendus 3D ».
- **Simulé dans la maquette** : la galerie rassemble les résultats des assets, les médias libres, les modèles 3D et les images d'équipement. Les vignettes s'animent au survol.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/parcours.js:127`

### Fabrications

- **On y entre par** : « Fabrications » dans la colonne ; automatiquement après « Lancer la simulation » sur une demande.
- **Ce qu'on y fait** :
  - Cliquer « Fabriquer librement » (fenêtre « Fabrication libre »).
  - Cliquer « Simuler une demande de l'agent ».
  - Dans « Explorations libres » : « Relire les paramètres », « Simuler le résultat libre », « Ouvrir le résultat ».
  - Dans « Équipements · images fabriquées » : « Relire l'envoi », « Ouvrir l'emploi ».
  - Dans « Travaux des sources 3D » : « Simuler la réussite », « Simuler un échec », « Reprendre les mêmes paramètres », « Revenir à cette source ».
  - Sur chaque demande normale : « Relire l'envoi », puis « Simuler le résultat », « Simuler un échec », « Interrompre », « Voir le résultat », « Reprendre explicitement ».
  - Après une référence technique terminée : « Préparer l'animation avec cette référence ».
- **Ce qui en sort** : un résultat dans la bibliothèque, ou un clip source à ouvrir, ou un échec qui garde ses paramètres.
- **Simulé dans la maquette** : les états (En attente, Terminé, Échec, Interrompu) changent au clic. Aucun fournisseur n'est appelé, aucun montant n'est débité. Une demande d'animation rend un clip source, pas une animation prête.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:303`, `parcours.js:159`, `sources-3d.js:85`

### Livrer au jeu

- **On y entre par** : « Livrer au jeu » dans la colonne ; « Préparer la livraison » depuis Le jeu.
- **Ce qu'on y fait** :
  - Lire le dossier de destination ; le changer sous « Changer la destination » puis « Garder cette destination ».
  - Lire le décompte : nouveaux, modifiés, inchangés, conflits, sélectionnés.
  - Cliquer « Sélectionner nouveaux et modifiés », « Tout sélectionner ».
  - Cocher ou décocher chaque ligne.
  - Déplier « N fichiers prévus » pour lire les noms exacts (`.png`, `.json`, `.tres`, `.atelier.json`).
  - Cliquer « Relire l'animation / image » (fenêtre de lecture frame par frame, avec « Corriger cette frame »).
  - Cliquer « Retoucher » pour ouvrir directement la Retouche.
  - Cliquer « Tester un conflit de fichier », puis « Décider avant de livrer » et choisir « Conserver le fichier du jeu », « Créer une copie à côté » ou « Remplacer par cette version ».
  - Cliquer « Simuler la livraison sélectionnée ».
  - Déplier « Historique », puis « Relire cette livraison » et « Relire cette version livrée ».
  - Cliquer « Choisir des résultats » pour revenir aux assets.
- **Ce qui en sort** : une entrée d'historique avec la date, la destination, les fichiers prévus, les décisions de conflit et un instantané des pixels de chaque version livrée.
- **Simulé dans la maquette** : aucun fichier n'est écrit. Les noms de fichiers restent stables quand on renomme l'asset ou qu'on change de version retenue. Un brouillon non enregistré est signalé et exclu.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/toile-livraison.js:80`

### Fiche de l'asset

- **On y entre par** : « Ouvrir » sur un asset ; « Ouvrir le pèlerin » depuis Le jeu.
- **Ce qu'on y fait** :
  - Lire le nom, la famille, les sorties souhaitées, la description, le nombre de résultats et de retenus.
  - Cliquer « Modifier la fiche » (fenêtre : nom, famille, sorties souhaitées, description).
  - Cliquer « Importer » (fenêtre « Importer une source » : fichier image de 2 Mo maximum, ou « Ouvrir le clip de démonstration »).
  - Cliquer « Fabriquer… » (fenêtre « Préparer une fabrication »).
  - Cliquer « Découper une image » ou « Extraire un élément ».
  - Changer d'onglet : « Animations », « Images fixes », « Sources & clips », « Équipement », « Objectif & règles ».
  - Cliquer « Retour au personnage » quand la fiche appartient à un asset issu d'une découpe.
- **Ce qui en sort** : le contenu de l'onglet choisi. L'onglet ouvert est mémorisé par asset.
- **Simulé dans la maquette** : rien de particulier ; la fiche lit les données du navigateur.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:165`

### Fiche de l'asset — onglet Animations

- **On y entre par** : l'onglet « Animations » de la fiche (c'est l'onglet par défaut).
- **Ce qu'on y fait** :
  - Cliquer « Choisir mouvements & directions » (fenêtre « Ce qui doit exister dans le jeu »).
  - Déplier ou replier un mouvement ; l'en-tête dit combien de directions et d'animations il contient, et combien de directions restent « à départager ».
  - Lire une rangée par direction : la version retenue à gauche, les autres au milieu, les écartées à droite.
  - Survoler une vignette pour la voir s'animer ; cliquer dessus pour la retoucher.
  - Juger une version avec les trois petits boutons sous la vignette : « ● » retenir, « ○ » remettre à juger, « ⊘ » écarter.
  - Cliquer « + générer » à droite d'une rangée pour demander cette direction.
  - Filtrer la galerie du bas par « Mouvement / pose », « Direction », « Jugement ».
  - Sur chaque carte de la galerie : « Retoucher », « ☆ Favori », « Choisir pour le jeu », « Comparer », « Reprendre le montage », « Reprendre la découpe », « Reprendre l'extraction », « Écarter ».
- **Ce qui en sort** : la Retouche, la fenêtre de fabrication, ou l'écran Comparer.
- **Simulé dans la maquette** : retenir une version dans une rangée retire automatiquement le choix des autres versions du même mouvement et de la même direction. Écarter conserve la version.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/ergonomie.js:18`

### Fiche de l'asset — onglet Images fixes

- **On y entre par** : l'onglet « Images fixes » de la fiche.
- **Ce qu'on y fait** :
  - Cliquer « Fabriquer une image ».
  - Sur chaque carte : « Retoucher », « ☆ Favori », « Choisir pour le jeu », « Comparer », « Écarter », et les reprises de découpe ou d'extraction.
- **Ce qui en sort** : la Retouche, ou la fenêtre de fabrication.
- **Simulé dans la maquette** : rien de particulier.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:179`

### Fiche de l'asset — onglet Sources & clips

- **On y entre par** : l'onglet « Sources & clips » ; « Essayer le parcours vidéo » depuis Essayer la maquette.
- **Ce qu'on y fait** :
  - Lire les trois étapes annoncées : image de départ + mouvement, clip source, montage puis retouche.
  - Cliquer « Créer un clip vidéo ».
  - Cliquer « Importer une image de départ ».
  - Cliquer « Essayer avec le clip d'exemple ».
  - Cliquer « Préparer une source 3D » ou « Reprendre <nom> » / « Nouvelle source 3D ».
  - Sur chaque clip : « Voir le clip et ses étapes », « Monter une autre animation ».
  - Cliquer « Voir tous les clips de la galerie ».
- **Ce qui en sort** : le Clip source, le Montage, ou l'atelier 3D.
- **Simulé dans la maquette** : chaque clip affiche le nombre de frames d'exemple, la cadence, la durée réellement disponible, et la durée qui avait été demandée au modèle.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/parcours.js:167`

### Fiche de l'asset — onglet Équipement

- **On y entre par** : l'onglet « Équipement » de la fiche d'un personnage.
- **Ce qu'on y fait** :
  - Cliquer « Créer un équipement » (fenêtre : nom, type — Casque, Sac à dos, Arme, Autre —, description commune, emplacement).
  - Cliquer « Utiliser une pièce existante » (fenêtre « Choisir une pièce du jeu », avec un filtre).
  - Cliquer « Essayer les combinaisons ».
  - Cliquer « Exemple : casque, sac et épée » quand il n'y a encore aucun emploi.
  - Sur chaque emploi : « Préparer les calques », « Fiche de la pièce ».
  - Dans la section « Ce que le personnage porte » : « Associer une pièce », « Extraire un élément », « Choisir son aperçu », « Retirer l'association ».
- **Ce qui en sort** : l'écran « Emploi d'un équipement », ou « Combiner les équipements ».
- **Simulé dans la maquette** : chaque emploi affiche son emplacement et son décompte « N / M calques prêts ».
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/equipements.js:47`, `ergonomie.js:27`

### Fiche de l'asset — onglet Objectif & règles

- **On y entre par** : l'onglet « Objectif & règles » de la fiche.
- **Ce qu'on y fait** :
  - Lire les sorties souhaitées, la liste des mouvements et celle des directions.
  - Cliquer « Modifier l'objectif » (fenêtre : sorties souhaitées, mouvements séparés par des virgules, cases à cocher pour Sud / Ouest / Est / Nord).
  - Cliquer « Modifier la fiche ».
  - Lire ce qui est hérité de l'univers : direction artistique et taille de grille.
  - Cliquer « Règles du jeu » pour aller aux Réglages.
- **Ce qui en sort** : l'objectif mis à jour. Retirer une direction ne supprime aucun résultat déjà produit.
- **Simulé dans la maquette** : rien de particulier.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:181`

### Fiche de la pièce

- **On y entre par** : « Ouvrir » sur un asset de la famille Équipement ; « Fiche de la pièce » depuis l'onglet Équipement d'un personnage.
- **Ce qu'on y fait** :
  - Cliquer « Modifier l'identité de la pièce » (fenêtre : nom, type, description commune).
  - Lire « Ses emplois · N » : pour chaque porteur, son nom, son emplacement et son décompte de calques prêts.
  - Cliquer « Ouvrir les poses et calques » sur un emploi.
  - Cliquer « Ajouter un emploi » (fenêtre : « Portée par un personnage », « Image à part » ou « Mise en scène »).
  - Cliquer « Modifier cet emploi » pour un emploi sans porteur.
  - Dans « Références communes de la pièce » : « Importer une référence », « Fabriquer une référence », « Retoucher la référence ».
- **Ce qui en sort** : l'écran « Emploi d'un équipement ».
- **Simulé dans la maquette** : « Image à part » et « Mise en scène » sont des déclarations. Elles ne remplissent aucune case de calque porté.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/equipements.js:54`

### Emploi d'un équipement

- **On y entre par** : « Préparer les calques » ou « Ouvrir les poses et calques » ; « Créer la pièce et son emploi » ; « Utiliser <pièce> » ; « Ouvrir l'emploi » depuis les Fabrications ou la Galerie.
- **Ce qu'on y fait** :
  - Lire les quatre étapes annoncées : choisir les frames, générer le personnage équipé, extraire et ajuster, vérifier en animation puis combiner.
  - Lire les trois compteurs : calques prêts sur les frames existantes, animations de base encore manquantes, bases modifiées et frames signalées.
  - Déplier « Voir les bases manquantes avant d'équiper tout le personnage », puis « Fabriquer les bases du personnage ».
  - Déplier « Emplacement et superposition par défaut », régler l'emplacement (liste enrichissable avec « Ajouter un emplacement ») et l'ordre — « Au-dessus du personnage » ou « Sous le personnage » —, puis « Garder les réglages de l'emploi ».
  - Déplier « Planches reçues · à déplier » et cliquer « Déplier ce résultat · aucun appel ».
  - Cocher des frames dans l'arbre mouvement → direction → frames, ou cliquer « Sélectionner les manquants », « Tout sélectionner », « Vider la sélection ».
  - Cliquer « Fabriquer la sélection » (fenêtre « Relire avant l'envoi »).
  - Cliquer « Extraire la sélection ».
  - Cliquer « Vérifier en animation » (fenêtre « Vérifier les calques en mouvement »).
  - Cliquer une vignette pour ouvrir le Calque d'un équipement.
  - Déplier « Toutes les bases : images fixes et animations » pour lire ce qui manque par mouvement.
  - Dans « Même pièce, autres personnages » : ouvrir un autre emploi, ou « Ajouter un autre personnage ».
- **Ce qui en sort** : des calques par frame, avec un état — Manquant, À déplier, À extraire, À vérifier, À corriger, Base modifiée, Prêt.
- **Simulé dans la maquette** : la génération dessine localement un casque, un sac ou une arme sur le sprite de base. Le pliage forme une vraie planche puis la redécoupe, en gardant la correspondance avec chaque frame.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/equipements.js:57`

### Calque d'un équipement

- **On y entre par** : une vignette de frame dans l'Emploi ; « Ajuster » sur un calque manquant depuis Combiner ; « Corriger cette frame » depuis la vérification ; « Ouvrir l'emploi et sa frame » depuis la Galerie.
- **Ce qu'on y fait** :
  - Zoomer avec « − », « + », le champ « Zoom », « Ajuster à la fenêtre », ou la molette ; les touches `+`, `-` et `0` font la même chose.
  - Passer d'une frame voisine à l'autre avec les boutons « Frame 1 », « Frame 2 »…
  - Comparer les trois images côte à côte : « Personnage de base », « Source équipée », « Calque extrait ».
  - Cliquer « Générer cette frame » ou « Regénérer cette frame ».
  - Importer un fichier puis cliquer « Importer comme source » ou « Importer comme calque ».
  - Cliquer « Extraire le calque par différence ».
  - Cliquer « Versions précédentes · N » puis « Restaurer cette version ».
  - Choisir les « Réglages affichés » : Placement, Aspect et ordre, Masques et pinceau.
  - Régler Position X, Position Y et Échelle au curseur ou au clavier ; ou glisser le calque directement dans l'image.
  - Régler Rotation, Opacité, « Superposition » et « Ordre entre équipements ».
  - Choisir l'« Outil » : Déplacer le calque, Déplacer la vue, Effacer le calque, Restaurer le calque, Masquer le corps, Restaurer le corps, Passer cette partie dessous, Ramener cette partie dessus.
  - Régler la « Taille du pinceau (pixels) » et cliquer « Réinitialiser les masques ».
  - Cliquer « Reporter les réglages sur la sélection ».
  - Cliquer « Adopter cette nouvelle base » quand la base a changé.
  - Cliquer « Valider cette frame ».
  - Cliquer « Toutes les poses et frames » pour revenir.
- **Ce qui en sort** : un calque marqué « Prêt », ou « À vérifier » après chaque modification.
- **Simulé dans la maquette** : l'extraction compare réellement les pixels de la base et de la source équipée. Le cadre de travail fait 64 × 64 px ; une image importée y est ramenée.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/equipements.js:64`

### Combiner les équipements

- **On y entre par** : « Essayer les combinaisons » depuis l'onglet Équipement ou depuis l'Emploi.
- **Ce qu'on y fait** :
  - Choisir la base dans « Pose / animation et direction ».
  - Zoomer avec « − », « + », le champ « Zoom », « Taille réelle », la molette ou le clavier.
  - Cliquer « Lire l'animation » / « Arrêter ».
  - Cliquer un numéro de frame pour s'y placer.
  - Cliquer « Sans équipement ».
  - Cocher ou décocher chaque pièce dans « Équipements portés ».
  - Lire l'alerte « N calque(s) manquant(s), modifié(s) ou à vérifier », déplier « Voir les éléments à terminer », cliquer « Ajuster ».
  - Nommer et cliquer « Garder la combinaison » ; recharger une combinaison gardée par son nom.
  - Cliquer « Exporter la planche assemblée (PNG) ».
  - Cliquer « Exporter les calques séparés (JSON + images) ».
- **Ce qui en sort** : un fichier téléchargé — une planche PNG de toutes les frames assemblées, ou un JSON qui garde le corps et chaque équipement séparés.
- **Simulé dans la maquette** : l'assemblage est réel dans le navigateur, en 64 × 64 px. Activer une combinaison ne génère aucune image supplémentaire. Le téléchargement part ; son contenu n'a pas été inspecté.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/equipements.js:71`

### Clip source · avant le montage

- **On y entre par** : « Voir le clip et ses étapes » ; « Essayer avec le clip d'exemple » ; « Voir le résultat » d'une demande d'animation terminée ; un clip ouvert depuis la Galerie.
- **Ce qu'on y fait** :
  - Regarder le clip brut : « Frame précédente », « Lire le clip source », « Frame suivante ».
  - Glisser le curseur « Position dans la source ».
  - Lire le repère de temps : numéro de frame et seconde.
  - Relire l'envoi conservé : modèle, résolution, format, durée demandée, graine, estimation, consigne, images de référence.
  - Cliquer « Reprendre la demande dans un nouvel envoi ».
  - Lire la liste « Animations issues de cette source · N » et cliquer « Reprendre ce montage ».
  - Cliquer « Choisir un passage et monter ».
  - Cliquer « Sources de cet asset » ou « Galerie » pour revenir.
- **Ce qui en sort** : l'écran de montage, avec le mouvement et la direction repris de la demande.
- **Simulé dans la maquette** : le clip est une séquence de cinq images d'exemple. Aucun fichier vidéo n'est décodé. La durée demandée au modèle est affichée à part de la durée réellement disponible. La source et la position sont retrouvées après fermeture.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/parcours.js:176`

### Du clip à l'animation

- **On y entre par** : « Choisir un passage et monter » ; « Monter une autre animation » ; « Reprendre le montage » sur un résultat ; « Reprendre ce montage » ; « Reprendre ce montage » dans le tiroir Brouillons.
- **Ce qu'on y fait** :
  - **1 · Source et passage** — parcourir les frames source au curseur ; cliquer « Marquer le début ici » et « Marquer la fin ici » ; saisir « Début du passage (s) », « Fin du passage (s) », « Prendre une frame sur » ; cliquer « Extraire cette sélection ».
  - Déplier « Numéros et sélection manuelle » : « Première frame », « Dernière frame », « Appliquer cette plage », cocher les frames une à une, « Tout prendre », « Une frame sur deux ».
  - Cliquer « Ajouter un clip » pour verser les frames d'un autre clip dans le chutier.
  - **2 · Vérifier l'animation** — « Lire les aperçus », régler « Cadence dans le jeu (images/s) » et « Boucler » ; cliquer « Comparer fin et début » et « Créer un aller-retour ».
  - **3 · Cadre et rangement** — choisir « Mesurer le cadre sur » (Clip entier, Frames sélectionnées, Manuel) ; cliquer « Mesurer la silhouette » ou « Rétablir le cadre complet » ; régler au curseur et au clavier Gauche, Haut, Largeur, Hauteur du cadre, et Pivot horizontal / vertical.
  - Renseigner « Nom de l'animation », « Personnage / asset », « Mouvement / pose », « Direction de l'animation ».
  - **Ordre de l'animation** — glisser une frame pour la déplacer, ou Alt + ← / → au clavier ; cliquer « Dupliquer cette frame », « Retirer cette frame », « Inverser l'ordre ».
  - Cliquer « Créer et retoucher » (ou « Garder et retoucher » lors d'une reprise).
- **Ce qui en sort** : une animation ajoutée à l'asset, avec sa cadence, sa boucle, son cadre commun et son pivot ; puis la Retouche s'ouvre dessus.
- **Simulé dans la maquette** : la mesure de silhouette cherche vraiment les pixels opaques des frames choisies, avec une marge de 3 px, dans un cadre de 64 px. Le brouillon de montage est conservé par clip et par reprise. Chaque frame dupliquée garde son identité : ses retouches ne migrent pas vers l'originale.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/parcours.js:193`

### Du modèle 3D aux sprites

- **On y entre par** : « Préparer une source 3D » ou « Nouvelle source 3D » depuis Sources & clips ; « Explorer le parcours 3D » ; « Essayer le parcours 3D » depuis Essayer la maquette ; « Animer depuis une source 3D… » dans la préparation d'une fabrication ; un modèle ouvert depuis la Galerie.
- **Ce qu'on y fait** :
  - Passer d'une étape à l'autre par la barre : 1 Image de départ, 2 Modèle, 3 Squelette, 4 Mouvements, 5 Caméra & style, 6 Rendus.
  - **Image de départ** — « Choisir une image dans la bibliothèque », « Importer une image », « Utiliser l'image d'exemple » ; écrire la consigne ; « Relire la préparation de l'image » ; cocher « Le fond ne fait pas partie du personnage » et « Le personnage est entier et ses membres sont lisibles » ; « Retoucher l'image de départ ».
  - **Modèle** — choisir le « Moteur de reconstruction » (TRELLIS.2 ou Pixal3D) ; « Relire la création du modèle » ; « Importer un modèle 3D » ; cocher les trois contrôles (silhouette, séparation des membres, sol et hauteur) puis « Valider ce modèle ».
  - **Squelette** — « Relire la création du squelette » ; choisir la « Partie du squelette » (Tête, Épaules, Avant-bras, Mains, Bassin) ; régler Vrille, Flexion, Écart ; cocher « J'ai vérifié les articulations de face et de profil » ; « Valider ces corrections ».
  - **Mouvements** — « Ajouter un mouvement » (fenêtre : fichier du catalogue local, mouvement de l'asset, nom, et import FBX facultatif) ; régler nom, mouvement, vitesse, début, fin, cadence ; cocher Boucler, Rester sur place, « J'ai lu le mouvement » ; « Valider ce mouvement ».
  - **Caméra & style** — choisir la vue de départ ; régler rotation, hauteur, projection, cadrage, déplacement vertical, pivot horizontal et vertical ; choisir le style (Couleurs du modèle, BD, Pixel art), l'éclairage, le contour, la taille des sprites ; glisser sur l'aperçu pour tourner ; molette pour cadrer.
  - **Rendus** — cocher les mouvements et les directions ; régler « Frames par animation » ; lire le décompte d'animations et de frames ; « Relire les rendus à produire » ; relire les versions déjà rendues et « Ouvrir <résultat> ».
  - Dans l'aperçu de droite : « Lire le mouvement », « Vue de face », « Vue de profil », « Recentrer », et la case « Voir les articulations ».
  - Déplier « Source et versions conservées » puis « Ouvrir cette version ».
  - Cliquer « Retour aux sources de l'asset ».
- **Ce qui en sort** : des animations dans la fiche de l'asset et dans la Galerie, avec leur cadence, leur cadre commun et leur pivot, plus l'instantané complet des réglages qui les ont produites.
- **Simulé dans la maquette** : le même mannequin dessiné sur le processeur sert à l'aperçu et aux frames rendues. Aucun maillage, poids ou fichier d'animation n'est lu. Un fichier 3D importé n'est référencé que par son nom. Les sprites sortent en 64 × 64 px quelle que soit la taille demandée.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/sources-3d.js:61`

### Retouche

- **On y entre par** : « Retoucher » sur une carte de résultat ; une vignette dans l'arbre des animations ; « Voir le résultat » d'une fabrication terminée ; « Reprendre cette retouche » dans les Brouillons ; « Créer et retoucher » depuis le Montage ; « Corriger cette frame » depuis la relecture de livraison.
- **Ce qu'on y fait** :
  - Lire l'état en haut : « Version enregistrée » ou « Brouillon conservé · version enregistrée intacte ».
  - Cliquer « Enregistrer les retouches » (ou Ctrl + S).
  - Cliquer « Annuler » / « Rétablir » (ou Ctrl + Z / Ctrl + Maj + Z).
  - Cliquer « Comparer à la source ».
  - Peindre dans l'aperçu à la souris (table « Main » seulement).
  - Zoomer à la molette, déplacer la vue avec Espace + glisser, ou utiliser les boutons « − », « + », « Adapter », « Déplacer la vue ».
  - Cliquer « Lire » / « Pause » ; régler « Cadence » et « Boucler ».
  - Choisir une frame dans la bande ; Ctrl + clic pour en sélectionner plusieurs.
  - Cliquer « Tout sélectionner », « Dupliquer », « ← », « → », « Retirer », « Extraire une image ».
  - Basculer le panneau de droite entre « Retouche » et « Calques ».
  - En mode Retouche : choisir la « Table de retouche » (Main, Détourage, Recadrage, Pixelisation, Couleurs, Nettoyage, Contour, Retourner) et la portée « Cette frame », « Les frames sélectionnées », « Toute l'animation ».
    - **Main** : taille du pinceau, couleur, « Gomme du calque actif », « Effacer les traits de la portée ».
    - **Détourage** : méthode (Conserver, Couleur du fond, Modèle CPU), tolérance, moteur.
    - **Recadrage** : marge dans l'aperçu, ancrage (Centre, Pieds, Origine commune).
    - **Pixelisation** : taille de sortie (16 à 128), « Montrer la grille de repères ».
    - **Couleurs** : lumière, saturation, palette, nuancier.
    - **Nettoyage** : îlots isolés, grésil temporel.
    - **Contour** : épaisseur, placement.
    - **Retourner** : miroir horizontal.
  - Déplier « Recettes réutilisables » : « Nommer une recette », « Réappliquer une recette ».
  - En mode Calques : « + Calque de peinture », choisir un calque, cocher « Visible » et « Verrou », renommer, régler l'opacité, décaler une image en X et Y, « Monter », « Descendre », « Dupliquer », « Retirer », « Modifier l'extraction ».
  - Cliquer « Découper une image » ou « Extraire un élément » à partir de la frame affichée.
  - Cliquer « Utiliser comme équipement… ».
  - Glisser la poignée entre l'image et le panneau pour changer sa largeur (260 à 460 px).
  - Cliquer « Retour à l'asset ».
- **Ce qui en sort** : une nouvelle version du résultat après « Enregistrer les retouches ». Sans enregistrement, un brouillon est conservé et la version enregistrée reste intacte.
- **Simulé dans la maquette** : la peinture, l'ordre des frames, la lecture, les calques, l'annulation et le brouillon fonctionnent vraiment. Les tables Détourage, Nettoyage et Contour mémorisent leurs réglages sans les appliquer. L'aperçu reste en 64 px, quelle que soit la taille de sortie choisie.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:215`, `ateliers.js:19`

### Découper une image

- **On y entre par** : « Découper une image » depuis Les assets, la Fiche, la Retouche ou Essayer la maquette ; « Découper » sur une carte de la toile ; « Reprendre la découpe » sur un résultat déjà découpé.
- **Ce qu'on y fait** :
  - Choisir la source : « Importer une image », « Choisir dans la bibliothèque », « Choisir un original sans retouches », ou « Essayer une planche de 4 images ».
  - Cliquer « Annuler le dernier réglage ».
  - Tracer un rectangle dans une zone libre de l'image ; déplacer un rectangle par son centre ; le redimensionner par son coin inférieur droit.
  - Changer de méthode : « Détection », « Grille », « Manuel ».
  - En Grille : régler « Colonnes » et « Lignes », puis « Proposer cette grille ».
  - En Détection : cliquer « Détecter les zones ».
  - Cliquer « + Zone ».
  - Cocher ou décocher « garder » chaque zone, la renommer, cliquer « Régler ».
  - Régler la zone choisie au clavier : X, Y, Largeur, Hauteur ; cliquer « Retirer cette zone ».
  - Choisir « Créer les résultats comme » : Images du sujet, Un asset par découpe, Une animation — ou Cartes de la toile si la source vient de la toile.
  - Cliquer « Relire N sorties ».
  - Zoomer et déplacer la vue (molette, Espace + glisser, boutons « − », « + », « Adapter »).
- **Ce qui en sort** : la fenêtre « Créer les images découpées » montre chaque découpe avec son nom et sa taille. « Créer ces résultats » produit de vraies images, conserve la planche originale, et mène aux Images fixes, à la bibliothèque, à la Retouche ou à la toile selon la destination.
- **Simulé dans la maquette** : la détection cherche des séparations dans l'image ; elle ne reconnaît pas les sujets. Les crops sont réellement calculés dans le navigateur. Refaire une découpe crée de nouvelles sorties.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/ateliers.js:51`

### Extraire un élément

- **On y entre par** : « Extraire un élément » depuis Les assets, la Fiche, la Retouche ou Essayer la maquette ; « Reprendre l'extraction » sur un résultat ; « Modifier l'extraction » sur un calque.
- **Ce qu'on y fait** :
  - Suivre les quatre étapes : « 1. Choisir les images », « 2. Caler », « 3. Isoler », « 4. Garder le calque ».
  - **Choisir les images** — donner le « Personnage de base » et la « Variante équipée », par import, par la bibliothèque ou par « Choisir un original sans retouches » ; ou cliquer « Essayer avec une pièce de démonstration ».
  - **Caler** — cliquer « Proposer un alignement » ; glisser la variante dans l'aperçu ; régler Déplacement X, Déplacement Y, Échelle, Opacité de superposition au curseur ou au clavier.
  - **Isoler** — régler « Sensibilité aux différences » ; choisir la correction manuelle « Retirer » ou « Garder » ; régler la taille du pinceau ; peindre dans l'aperçu ; cliquer « Effacer seulement les corrections manuelles ».
  - **Garder le calque** — nommer l'élément ; choisir « Sur quelles images afficher cet élément ? » entre « Cette frame » et « Tout le résultat (image statique) » ; cliquer « Garder le calque et ouvrir la composition ».
  - Changer l'affichage : « Superposition », « Élément seul », « Sur le personnage ».
  - Cliquer « Annuler le dernier réglage ».
  - Zoomer et déplacer la vue comme dans la Retouche.
- **Ce qui en sort** : un calque ajouté à la composition du personnage de base, et une image de l'élément ajoutée à ses images fixes. Le calage, le masque et les deux sources restent retrouvables.
- **Simulé dans la maquette** : le calcul se fait en 128 px. Le recalage cherche des pixels colorés communs, sur une plage bornée. La maquette n'invente pas les pixels du corps cachés par le vêtement, et un calque ne suit pas automatiquement un mouvement.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/ateliers.js:100`

### Comparer les versions

- **On y entre par** : « Comparer » sur une carte de résultat.
- **Ce qu'on y fait** :
  - Choisir la « Version A » et la « Version B » dans deux listes.
  - Cliquer « Lire ensemble » / « Pause synchronisée ».
  - Cliquer « Revenir au début ».
  - Lire, pour chaque côté, le nombre de frames, la cadence, la boucle et l'état (Retenu, Écarté, À juger).
  - Cliquer « Retoucher » ou « Choisir pour le jeu » sur un côté.
  - Cliquer « Retour à l'asset ».
- **Ce qui en sort** : rien de nouveau. C'est un écran de décision.
- **Simulé dans la maquette** : la lecture partage le même temps, chaque côté respectant sa propre cadence. Les deux aperçus font 64 × 64 px.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:331`

### Réglages

- **On y entre par** : « Réglages » dans la colonne ; « Règles du jeu » depuis l'onglet Objectif ; « Règles de l'univers » depuis la toile.
- **Ce qu'on y fait** :
  - **Onglet Univers** — modifier le nom du jeu, la description du monde, la direction artistique, la taille de référence (32 à 128) ; cliquer « Garder les règles ».
  - **Onglet Moteurs & workflows** — cocher « Simuler une connexion disponible » pour l'API ; cocher « Simuler un moteur local disponible » ; lire le tableau des profils de workflow d'exemple (entrée et sortie de chacun).
  - **Onglet Agent MCP** — cocher « Autoriser les méthodes locales disponibles », « Autoriser les appels payants dans une limite », « Permettre une livraison provisoire pour tester le jeu » ; régler le plafond fictif par demande et le nombre maximal de tentatives ; cliquer « Garder le cadre de l'agent ».
  - **Onglet Consommations** — lire le total documenté des appels terminés et le tableau demande par demande (modèle, état, annonce ou consommation fictive).
- **Ce qui en sort** : des règles héritées par les assets, et un cadre qui filtre les moyens de fabrication proposés à l'agent.
- **Simulé dans la maquette** : aucune clé n'est demandée, aucun serveur MCP n'est contacté. Les montants non conservés et les temps locaux non mesurés sont exclus du total, et le disent.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:315`

### Essayer avant de construire

- **On y entre par** : « Essayer la maquette » dans la colonne ; « Commencer la visite » depuis Le jeu.
- **Ce qu'on y fait** :
  - Lire dix parcours proposés, chacun avec sa consigne.
  - Cliquer « Essayer » sur : Créer sans MCP, Composer un univers, Corriger une animation, Livrer et remplacer, Déléguer à l'agent, Choisir un moyen de fabrication.
  - Cocher « Essayé » sur chacun de ces six parcours.
  - Cliquer « Essayer le parcours vidéo », « Essayer le parcours 3D », « Essayer la découpe », « Essayer l'extraction ».
  - Lire « La limite de cette version ».
  - Cliquer « Lire l'inventaire de couverture » ou « Exporter mes remarques ».
- **Ce qui en sort** : l'écran visé, et une case cochée conservée dans le navigateur.
- **Simulé dans la maquette** : les cases cochées sont reprises dans l'export des remarques.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:328`

### Vos remarques

- **On y entre par** : « Vos remarques · N » dans la colonne.
- **Ce qu'on y fait** :
  - Lire les remarques actives, avec l'écran où elles ont été prises.
  - Cliquer « Ajouter une remarque ».
  - Cliquer « Marquer comme traitée » sur une remarque.
  - Déplier « Historique · N remarques traitées » et cliquer « Remettre dans les remarques ».
  - Cliquer « Exporter les remarques ».
  - Déplier « Recommencer les essais » et cliquer « Réinitialiser la démonstration », puis confirmer.
- **Ce qui en sort** : la fenêtre « Remarques prêtes à transmettre » — un texte Markdown à copier, avec « Tout sélectionner » et « Télécharger le Markdown ».
- **Simulé dans la maquette** : rien n'est envoyé. Seules les remarques actives sont exportées. La réinitialisation efface les données de démonstration de ce navigateur et recharge la page.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:330`

## Les surfaces transverses

### Bandeau de maquette

- **On y entre par** : il est toujours en haut de la page.
- **Ce qu'on y fait** :
  - Lire « MAQUETTE À ESSAYER · données de démonstration · aucun appel IA ni accès au jeu ».
  - Cliquer « Noter une remarque ».
- **Ce qui en sort** : la fenêtre « Noter une remarque », qui garde le nom de l'écran d'où on l'ouvre (et la table de retouche en cours, le cas échéant).
- **Simulé dans la maquette** : avec `?essai=nom` dans l'adresse, le bandeau devient « SESSION D'ESSAI SÉPARÉE » et la séance utilise un stockage distinct.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/02-atelier.html:22`, `prototype.js:511`

### Colonne de navigation

- **On y entre par** : elle est toujours à gauche.
- **Ce qu'on y fait** :
  - Cliquer « ☰ » / « ‹ » pour replier ou déplier la colonne (les libellés deviennent des abrégés).
  - Aller à l'un des six lieux du groupe « Atelier ».
  - Lire le nombre de travaux en attente à côté de « Fabrications ».
  - Chercher une collection, déplier une famille, cliquer « Tout voir », une collection, ou « + Collection ».
  - Aller à l'un des trois lieux du groupe « Préférences ».
  - Cliquer « Brouillons · N ».
- **Ce qui en sort** : la navigation, et le tiroir des brouillons.
- **Simulé dans la maquette** : l'état replié, la famille et la collection ouvertes sont conservés.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:123`, `parcours.js:94`

### Barre de fil d'Ariane

- **On y entre par** : elle est en haut de chaque écran.
- **Ce qu'on y fait** :
  - Cliquer « ← » ou « → » pour revenir à l'écran précédent ou suivant (Alt + flèche gauche et Alt + flèche droite font la même chose).
  - Lire le chemin : nom du jeu, nom de l'asset s'il y en a un, nom de l'écran.
  - Choisir « Fond des images » : « Gris neutre » ou « Transparence ».
- **Ce qui en sort** : le fond derrière tous les aperçus change ; le choix est conservé.
- **Simulé dans la maquette** : l'historique garde les trente derniers écrans, avec leur asset, leur onglet et leur frame.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:129`

### Brouillons à reprendre

- **On y entre par** : « Brouillons · N » en bas de la colonne.
- **Ce qu'on y fait** :
  - Lire les retouches en attente, avec l'asset, le titre et la date de dernière reprise.
  - Cliquer « Reprendre cette retouche ».
  - Lire les montages en attente, avec leur nom et leur rattachement.
  - Cliquer « Reprendre ce montage ».
- **Ce qui en sort** : la Retouche ou le Montage, à l'endroit où on les avait laissés.
- **Simulé dans la maquette** : les brouillons sont distincts des versions enregistrées et survivent à un rechargement.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:438`

### Quitter cette retouche ?

- **On y entre par** : toute navigation qui quitte la Retouche alors qu'un brouillon existe.
- **Ce qu'on y fait** :
  - Cliquer « Continuer à retoucher ».
  - Cliquer « Abandonner les retouches ».
  - Cliquer « Garder le brouillon et quitter ».
  - Cliquer « Enregistrer et quitter ».
- **Ce qui en sort** : selon le choix, le brouillon est jeté, conservé, ou transformé en nouvelle version.
- **Simulé dans la maquette** : la version enregistrée reste intacte dans tous les cas.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:79`

### Relire avant l'envoi

- **On y entre par** : « Relire avant l'envoi » dans « Préparer une fabrication » ; « Relire cette fabrication » dans « Fabrication libre » ; « Fabriquer la sélection » dans un emploi d'équipement ; les quatre boutons « Relire… » du parcours 3D.
- **Ce qu'on y fait** :
  - Lire le résumé en trois cases : modèle / fournisseur, ce qui part, coût ou temps.
  - Basculer « Modifier cet envoi » / « Terminer les modifications » — hors modification, tous les champs sont verrouillés.
  - Relire et modifier le cadre « Images envoyées » : remplacer, retirer, ajouter une référence, importer une image.
  - Relire et modifier le cadre « Texte envoyé » : univers, texte de l'asset, consigne propre à cet envoi.
  - Relire et modifier le cadre « Profil et paramètres » : modèle, résolution, format, durée, nombre de clips, graine.
  - Lire le message rouge qui bloque l'envoi (trop de références pour le profil, image de départ manquante, budget de l'agent dépassé…).
  - Cliquer « Revenir aux paramètres », puis « Lancer la simulation » ou « Ajouter ce travail simulé ».
- **Ce qui en sort** : une ou plusieurs demandes en attente dans les Fabrications, avec toutes les images, tous les textes et tous les paramètres relus.
- **Simulé dans la maquette** : les noms de modèles (DemoLocal, DemoAPI, Démo locale:équipement, Démo API:équipement) et les prix sont fictifs. Le dépassement de références bloque le lancement sans jamais retirer une image choisie par l'auteur.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/relecture.js:12`, `ergonomie.js:40`, `equipements.js:98`, `parcours.js:141`, `sources-3d.js:72`

### Préparer une fabrication

- **On y entre par** : « Fabriquer… » sur une fiche ; « + générer » dans une rangée de direction ; « Simuler une demande de l'agent » ; « Créer un clip vidéo » ; « Préparer avec ces références » depuis la toile ; « Fabriquer une référence » sur une pièce.
- **Ce qu'on y fait** :
  - Choisir « Que fabriquer ? » entre Animation et Image fixe.
  - Choisir le « Mouvement » ou cliquer « Ajouter un mouvement ».
  - Choisir la « Direction ».
  - Nommer le résultat et décrire ce qu'on attend.
  - Choisir le « Moyen de fabrication » ; les moyens indisponibles sont grisés avec leur raison.
  - Régler la résolution, le format, la durée par clip, le nombre de clips, la graine.
  - Pour une animation : lire la chaîne « 1 · Référence de départ → 2 · Clip → 3 · Frames et montage » et cliquer « Choisir une référence », « Importer une référence » ou « Fabriquer sa référence puis animer ».
  - Cliquer « Animer depuis une source 3D… ».
  - Cliquer « Relire avant l'envoi ».
- **Ce qui en sort** : la fenêtre « Relire avant l'envoi ». Si l'on passe par « Fabriquer sa référence puis animer », la demande d'animation est mise de côté et proposée à nouveau une fois la référence relue.
- **Simulé dans la maquette** : la disponibilité des moyens dépend des cases cochées dans les Réglages. Pour l'agent, elle dépend aussi de son cadre et de son plafond.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:352`

### Fabrication libre

- **On y entre par** : « Fabriquer librement » depuis les Fabrications ou la Galerie.
- **Ce qu'on y fait** :
  - Nommer le résultat.
  - Choisir le « Type de résultat » : Image, Vidéo, 3D.
  - Écrire un prompt libre.
  - Choisir le moyen de fabrication (Local · démo, API · démo).
  - Régler la résolution, le format, la durée, le nombre de clips, la graine, le détail du modèle 3D.
  - Cocher « Inclure les règles de l'univers » et « Poser aussi le résultat sur la toile ».
  - Ajouter ou retirer des références ; pour une vidéo, la première est l'image de départ obligatoire.
  - Cliquer « Relire cette fabrication ».
- **Ce qui en sort** : un travail dans « Explorations libres ». Une fois simulé, le résultat entre dans la Galerie, et sur la toile si la case était cochée.
- **Simulé dans la maquette** : aucun asset n'est nécessaire. Les profils et les prix sont fictifs.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/parcours.js:139`

### Choisir dans la bibliothèque

- **On y entre par** : tout bouton « Choisir une référence », « Choisir dans la bibliothèque », « Associer une pièce », « Depuis la galerie », « Choisir une image dans la bibliothèque ».
- **Ce qu'on y fait** :
  - Chercher par nom d'asset ou de résultat.
  - Filtrer par « Famille », par « Asset », par « Jugement ».
  - Cliquer une vignette pour la sélectionner ; son aperçu, son asset, son état et sa provenance s'affichent à droite.
  - Survoler une vignette animée pour la lire.
  - Paginer avec « Précédent » / « Suivant » (30 par page).
  - Cliquer « Utiliser ce résultat » ou « Annuler le choix ».
- **Ce qui en sort** : l'image choisie revient dans l'écran ou la fenêtre d'où l'on venait, avec son origine indiquée.
- **Simulé dans la maquette** : la liste couvre les résultats des assets, les essais libres et les images d'équipement. Les animations ne sont proposées que là où elles sont compatibles.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/ergonomie.js:28`

### Vérifier les calques en mouvement

- **On y entre par** : « Vérifier en animation » dans un emploi d'équipement.
- **Ce qu'on y fait** :
  - Choisir la « Bande / direction à vérifier ».
  - Cliquer « Frame précédente », « Lire la bande », « Frame suivante ».
  - Cliquer une frame dans la liste de droite.
  - Cliquer « Signaler cette frame à corriger » ou « Retirer le signalement ».
  - Cliquer « Corriger cette frame » pour ouvrir le Calque d'un équipement.
  - Lire combien de calques peuvent être validés et déplier « Voir les N exclusions ».
  - Cliquer « Valider les N calques vérifiés ».
- **Ce qui en sort** : les calques éligibles passent à « Prêt ». Les frames signalées, les bases modifiées et les images non extraites restent à reprendre.
- **Simulé dans la maquette** : la lecture applique le cadre de toute la bande et montre les calques extraits même non validés.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/equipements.js:110`

### Utiliser cette image comme équipement

- **On y entre par** : « Utiliser comme équipement… » dans la Retouche.
- **Ce qu'on y fait** :
  - Choisir « Ce que contient cette image » : Référence de la pièce, Personnage portant la pièce, Calque transparent de la pièce.
  - Choisir une pièce existante ou « Créer une nouvelle pièce », et la nommer.
  - Choisir le personnage qui la porte.
  - Choisir la pose, la direction et la frame de base.
  - Cliquer « Garder les retouches et associer ».
- **Ce qui en sort** : une référence ajoutée à la pièce, ou un calque créé dans l'emploi visé. La version en cours est enregistrée au passage et l'image d'origine reste à sa place.
- **Simulé dans la maquette** : le rendu visible, avec ses retouches, est recopié dans un cadre de 64 px. L'ancien calque part dans l'historique.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/equipements-attribution.js:9`

### Vue de travail zoomable

- **On y entre par** : elle habille automatiquement l'aperçu de la Retouche, celui de la Découpe et celui de l'Extraction.
- **Ce qu'on y fait** :
  - Cliquer « − », « + », saisir un zoom de 25 à 3200 %, ou cliquer « Adapter ».
  - Basculer « Déplacer la vue ».
  - Zoomer à la molette, en gardant le point sous le curseur.
  - Déplacer la vue avec Espace + glisser, ou avec le bouton du milieu de la souris.
  - Voir l'empreinte du pinceau à l'échelle du zoom.
- **Ce qui en sort** : rien. Le niveau de zoom et la position de la vue sont conservés par écran.
- **Simulé dans la maquette** : rien ; c'est du confort d'affichage.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/ergonomie.js:55`

### Zone de message

- **On y entre par** : elle apparaît après un geste, en bas de la page.
- **Ce qu'on y fait** : lire la confirmation ou l'avertissement ; il s'efface au bout de quelques secondes.
- **Ce qui en sort** : rien.
- **Simulé dans la maquette** : c'est aussi par là que passe l'avertissement quand le stockage du navigateur est plein ou indisponible ; la séance reste alors en mémoire jusqu'à sa fermeture.
- **Fichier de maquette** : `docs/maquettes-atelier-unifie/prototype.js:60`

## Ce que la maquette annonce comme absent

Reprise de la colonne « Simulation ou détail encore absent » du tableau de `couverture.md`.

- **Jeu** — création de plusieurs jeux et premier lancement à détailler.
- **Univers / toile** — extraction de palette, officialisation d'artwork, placement des grands lots et passage assisté vers les règles à compléter.
- **Bibliothèque** — performance du stockage réel et particularités de chaque famille à vérifier dans le produit.
- **Objectif** — couverture partagée réelle avec API et MCP dans AU2.
- **Création manuelle** — les générations sont simulées et réemploient des images d'exemple ; une vidéo reçue ne devient pas automatiquement une animation prête.
- **Référence / import** — pas de téléversement au serveur ; le clip est représenté par une séquence préparée.
- **Fabrications** — ni travail distant, ni facturation, ni ordonnanceur réel.
- **Clip source** — cinq frames de démonstration, aucun nouveau fichier vidéo décodé ; la durée demandée au modèle est distincte de celle de l'exemple.
- **Montage** — mesure locale des pixels opaques de l'exemple, pas de détection sémantique des temps clés ; cadre en 64 px, aucun calcul pleine résolution ni export Godot vérifié.
- **Main** — sélection géométrique, pipette et outils de peinture avancés à compléter.
- **Composition** — édition de formes, transformations avancées, fusion et suivi automatique sur une animation à compléter.
- **Recette** — les filtres sont simplifiés ; les moteurs CPU actuels ne sont pas réécrits en JavaScript.
- **Tables avancées** — moteurs de détourage, quantification, nettoyage et contour non exécutés ; calibration et réglages fins à compléter.
- **Découper une image** — détection simplifiée par séparations, pas de reconnaissance de sujets ; gouttières, fusion de zones et remplacement choisi des anciennes sorties à détailler. Refaire une découpe crée de nouvelles sorties.
- **Extraire un élément** — démonstration en 128 px, recherche bornée de pixels communs ; pas de reconnaissance sémantique, de déformation ni de calque qui suit automatiquement un mouvement. Aucune garantie sur des variantes différentes de l'exemple.
- **Comparer / juger** — pas de comparaison synchronisée des animations complètes ni de grille de calibration.
- **Équipement / emplois** — dessins de démonstration et imports ramenés à 64 px ; aucun moteur IA ni migration des données du produit ; reprise complète après changement de base et grands volumes encore à éprouver.
- **Tenues** — téléchargements déclenchés, fichiers non inspectés ; aucun format final ni importeur Godot validé.
- **Livraison générale** — aucun fichier du jeu écrit ni SpriteFrames produit ; les téléchargements d'essai des équipements sont distincts de la preuve Godot AU1.
- **Réglages** — pas de clé réelle ; profils de workflow descriptifs ; installations, quotas et états GPU à détailler.
- **Sources 3D** — le mannequin ne représente pas l'image jointe ; aucun modèle IA, rigging réel, lecture de maillage ou FBX, ni appel asset3d. Les fichiers 3D importés ne sont référencés que par leur nom ; les rendus locaux restent en 64 px.
- **Tuiles / son** — ateliers spécialisés à concevoir plus tard, aucun faux outil annoncé comme prêt.
