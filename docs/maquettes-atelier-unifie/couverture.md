# Maquette de l’atelier — couverture et limites

[Ouvrir l’atelier à essayer](02-atelier.html). La première [proposition de parcours](01-parcours.html)
reste disponible pour comparer la simplification initiale avec cette version plus large.

Cette version sert à **essayer les parcours et faire apparaître les besoins oubliés**.
Elle ne remplace pas l’application et ne prouve pas ses traitements. L’identité reste celle
de [DESIGN.md](../DESIGN.md), avec polices de repli si les polices prévues ne sont pas installées.
Les limites sont affichées sur les écrans concernés, pas seulement dans ce document.

## Comment l’essayer

Ouvrir l’HTML dans un navigateur desktop, ou le servir avec un serveur statique local depuis
la racine du dépôt. Il utilise une feuille CSS, six scripts voisins et des images locales,
sans dépendance réseau. Le panneau **Essayer la maquette** propose huit parcours. Commencer par
**Créer sans MCP**, puis **Corriger une animation** et **Composer un univers**.

Pour les derniers retours : essayer **Une planche, plusieurs images** et **Un sac extrait
en calque**. Les deux ateliers proposent un exemple immédiat. Dans la retouche, le sélecteur
de table reste en haut du panneau droit ; **Calques** ouvre la composition séparément.
Pour les équipements complets, partir de **Personnage → Équipements** : créer une pièce,
préparer ses calques dans son emploi, puis ouvrir **Combiner les équipements**. Employer
la même pièce sur un autre héros permet d'essayer la séparation des adaptations.

Le bouton **Noter une remarque** garde le contexte de l’écran. Les remarques s’exportent
en texte Markdown copiable depuis **Vos remarques**, avec téléchargement facultatif selon
le navigateur ; elles ne sont pas envoyées automatiquement.
Les données de démonstration restent dans ce navigateur, pour cette adresse. Changer de
navigateur, de port ou de mode d’ouverture peut ouvrir une autre séance. Si le stockage est
indisponible ou plein, l'écran le signale ; la séance reste en mémoire jusqu'à sa fermeture.
Le paramètre facultatif `?essai=nom` ouvre un stockage de vérification séparé, signalé par
le bandeau. Les tests de cette révision ont utilisé cette séance séparée des essais de l'auteur.

## Ce que l’on peut éprouver

| Zone | Manipulations effectives dans la maquette | Simulation ou détail encore absent |
|---|---|---|
| Jeu | Vue d’ensemble, accès à l’univers, assets, fabrications et livraison | Création de plusieurs jeux et premier lancement à détailler |
| Univers / toile | Ajouter note, image et îlot ; annoter ; déplacer et relier ; zoomer ; retrouver les positions ; découper une image en cartes, original conservé | Extraction de palette, officialisation d'artwork, placement des grands lots et passage assisté vers les règles à compléter |
| Bibliothèque | Créer un sujet, rechercher, filtrer par famille, créer et rouvrir une collection, y ranger une sélection ; galerie distincte de tous les résultats | Gestion complète des collections, tri fin et charge avec des centaines d'assets non vérifiés |
| Objectif | Fixe, animé ou mixte ; dossiers de mouvements et rangées de directions ; résultats fixes et animés distincts | Couverture partagée réelle avec API et MCP dans AU2 |
| Création manuelle | Fiche vide → référence → demande d’animation → relecture entière → fabrication → résultat | Les générations sont simulées et réemploient des images d’exemple |
| Référence / import | Importer PNG, JPEG, WebP dans le navigateur, limite de démonstration à 2 Mo | Pas de téléversement au serveur ; clip représenté par une séquence préparée |
| Fabrications | Origine manuelle ou agent ; attente, résultat, interruption, échec, reprise explicite ; résultat en bibliothèque | Ni travail distant, ni facturation, ni ordonnanceur réel |
| Montage | Lecture, cadence, boucle, choix et sélection multiple de frames, ordre, duplication, retrait, extraction fixe | Pas de décodage d’un clip importé ni de détection automatique des temps clés |
| Main | Peinture au pixel, gomme du calque actif, portée frame/sélection/animation, annuler/rétablir | Sélection géométrique, pipette et outils de peinture avancés à compléter |
| Composition | Calques de peinture et d’image, ordre, duplication, nom, visibilité, verrouillage, opacité, déplacement d’image ; garder et rouvrir | Édition de formes, transformations avancées, fusion et suivi automatique sur une animation à compléter |
| Recette | Miroir, marge, lumière, saturation et repères modifient l’aperçu ; recette nommée ; garder et rouvrir les réglages | Les filtres sont simplifiés. Les moteurs CPU actuels ne sont pas réécrits en JavaScript |
| Tables avancées | Sélecteur permanent : Main, Détourage, Recadrage, Pixelisation, Couleurs, Nettoyage, Contour, Retourner ; contrôles conditionnels et réglages gardés | Moteurs de détourage, quantification, nettoyage et contour non exécutés ; calibration et réglages fins à compléter |
| Découper une image | Source importée, bibliothèque, frame ou carte ; détection, grille, tracé/déplacement/redimensionnement des rectangles, champs numériques, nom et sélection ; relecture des crops ; images, assets séparés, animation ou cartes ; source conservée et découpage repris depuis un résultat | Détection simplifiée par séparations, pas reconnaissance de sujets ; gouttières, fusion de zones et remplacement choisi des anciennes sorties à détailler. Refaire une découpe crée de nouvelles sorties |
| Extraire un élément | Base + variante ; proposition d’alignement, translation, échelle, opacité ; différence et masque Garder/Retirer ; aperçu seul/superposé/composé ; sauvegarde et reprise du calage et du masque depuis l’élément ou son calque | Démonstration en 128 px, recherche bornée de pixels communs ; pas reconnaissance sémantique, déformation ni calque qui suit automatiquement un mouvement. Pas de garantie sur des variantes différentes de l’exemple |
| Comparer / juger | Comparer deux résultats ou source/retouche ; favori distinct du choix pour le jeu | Pas de comparaison synchronisée des animations complètes ni de grille de calibration |
| Équipement / emplois | Pièce commune, emplois indépendants par personnage ; poses, directions et frames ; génération simulée ciblée ou groupée, extraction de pixels, validation des superpositions, placements et masques par frame, historique restaurable ; base modifiée signalée ; calques accessibles depuis la galerie | Dessins de démonstration et imports ramenés à 64 px ; aucun moteur IA ni migration des données du produit ; reprise complète après changement de base et grands volumes encore à éprouver |
| Tenues | Activer plusieurs équipements pendant la lecture, garder une combinaison et la rouvrir ; corps et calques séparés, aperçu des manques ; commandes de téléchargement PNG assemblé ou paquet JSON avec images | Téléchargements déclenchés, fichiers non inspectés ; aucun format final ni importeur Godot validé |
| Livraison générale | Choisir les résultats, destination proposée, aperçu des formats, historique par révision, conflit fictif | Aucun fichier du jeu écrit ni SpriteFrames produit ; les téléchargements d'essai des équipements sont distincts de la preuve Godot AU1 |
| Réglages | Règles de l’univers ; disponibilité indépendante des moteurs ; cadre de l’agent mémorisé et choix de méthode filtré | Pas de clé réelle ; profils de workflow descriptifs ; installations, quotas et états GPU à détailler |
| Sources 3D | Modèle conservé → rig → demande de rendu ; plusieurs rendus d’une source | Parcours entièrement simulé, aucun appel à asset3d |
| Tuiles / son | Place dans la feuille de route annoncée | Ateliers spécialisés à concevoir plus tard, aucun faux outil annoncé comme prêt |

Le prototype est donc **large et interactif, encore incomplet dans le détail des outils**.
Une table accessible par un bouton n’est pas une table terminée. Les lignes ci-dessus
empêchent précisément de confondre navigation présente et capacité réellement reprise.

## Raccord avec les planches du carnet et les écrans actuels

Le relevé porte sur les **49 fichiers HTML** présents le 11 septembre 2026 dans le carnet.
Il classe la totalité de ces fichiers ; ce compte n’est ni un nombre d’écrans de production
ni une garantie de couverture contrôle par contrôle. Les routes et états ont été recoupés
avec le carnet, les lieux, la retouche et la recette du code actuel.

| Planches du carnet | Destination proposée / travail restant |
|---|---|
| Accueil, Ouverture, Nouveau-jeu | Le jeu ; compléter premier lancement et changement de jeu |
| Toile, Carte | Univers & toile ; compléter outils de carte et références officielles |
| Familles, Famille, Decors, Fiche | Les assets et fiche ; compléter collections, règles par famille et particularités de décor |
| Images, Animations, Animation-chaine | Onglets séparés, objectif et fabrication ; éprouver les cas mixtes |
| Galerie, Comparer, Grille, Essai | Bibliothèque et comparaison ; compléter grille de cohérence, essai animé et calibration |
| Retouche, Main, atelier-main, atelier-detourer, atelier-recadrer, atelier-reduire, atelier-couleurs, atelier-nettoyer, atelier-contour, atelier-retourner | Éditeur commun ; les limites des tables avancées sont listées ci-dessus |
| atelier-decoupe, atelier-difference, Emplois, Emploi | Découpe et extraction dédiées ; parcours d'équipement complet dans la maquette, de l'emploi aux calques et à la tenue. Le raccord au domaine existant et à B20 reste à construire |
| Clips, Clip, Atelier-animation | Sources et montage ; compléter vidéo brute, plages temporelles et états de préparation |
| Envoi, Relecture | Préparation et écran entier de relecture, puis fabrications |
| Sortie | Livraison ; confirmer le contrat réel dans Godot avant de figer le détail |
| Installation, Depenses, Finesse | Réglages ; compléter installation, catalogue réel, barème et dimensions fines |
| Guide, Etats | Visite et états vides/erreur ; couverture d’aide par réglage à reprendre dans le produit |
| Navigation, Barre, Parcours, Vocabulaire, Systeme, Sommaire, l-atelier-en-carnet | Références transversales ; leurs fonctions se répartissent dans la navigation, les formulaires et le design conservé |
| Tuiles | Périmètre futur maintenu, atelier à concevoir |

La bibliothèque de mouvements, la gestion complète des collections, les règles de famille
et les ateliers de carte restent à détailler. L'équipement a désormais son parcours complet
de démonstration ; cela ne remplace pas les capacités du produit. Avant de remplacer une
surface existante, compléter son inventaire de
contrôles et de sauvegardes, puis tester son parcours de reprise.

## Choix et critiques à éprouver avec l’auteur

1. La séparation **univers / assets / fabrications / livraison** réduit le nombre de lieux
   à retenir. Vérifier qu’elle n’allonge pas les allers-retours quotidiens.
2. La fiche doit être orientée vers ce que le jeu attend. Sa matrice ne doit pas redevenir
   une liste obligatoire de poses et directions inutiles.
3. Le manque de référence doit être expliqué **avant l’envoi**, avec une suite claire.
   Une prochaine variante pourra proposer « préparer la référence puis animer » en un geste
   supervisé, en montrant ses deux opérations et leurs coûts.
4. Une même table peut corriger une image ou une bande. La portée doit rester évidente,
   surtout quand une lecture était en cours. La maquette fige la frame au début du trait.
5. Les réglages avancés méritent une place accessible sans rendre tous les écrans denses.
   Leur inventaire compte davantage que le nombre de boutons visibles.
6. Favori et résultat livré sont deux choix. Vérifier que les libellés suffisent à le faire
   comprendre sans mode d’emploi.
7. L’intégration 3D doit garder la source et proposer des rendus réutilisables ; elle ne doit
   pas imposer de comprendre ComfyUI pour fabriquer un personnage.
8. Une découpe est une fabrication de nouvelles images ; elle ne doit pas être confondue
   avec le recadrage d’une image ou le choix des frames d’un clip. La relecture nomme les
   sorties et leur destination avant leur création.
9. « Extraire un élément » décrit mieux le but que « Différence ». Le calage est une
   proposition visuelle, puis le masque reste corrigeable, notamment quand le vêtement
   remplace des pixels du corps. La maquette n’invente pas les pixels cachés du corps.
10. Une seule table affichée réduit le défilement sans masquer sa portée. Les calques ont
    une liste propre ; seuls les réglages du calque choisi se déplient. Vérifier à l’usage
    que les changements fréquents de table et de calque restent confortables.

## Matière visuelle et périmètre technique

Le pèlerin fixe vient des vignettes déjà présentes dans l’interface. `marche-demo.png` est
une copie inchangée d’une planche du banc vidéo local du dépôt (cinq vues d’exemple). Son
fond fait partie de l’image ; ce n’est pas une preuve de détourage. Aucune génération IA n’a
été lancée pour ce travail. La taille d’aperçu de la retouche est 64 px, quelle que soit la taille
de sortie sélectionnée : cette différence est affichée dans la table Pixelisation.

La planche de découpe d’essai assemble quatre copies de la vignette. Le sac d’essai est
une pièce dessinée en rectangles sur une copie du sprite de profil. Ce sont des supports
pour éprouver les gestes, pas des résultats d’une génération IA. La découpe crée de vrais
crops dans le navigateur ; l’extraction normalise ses deux sources en 128 px. Les images
originales importées ne sont pas modifiées sur disque. La fidélité pleine résolution et
les moteurs du produit doivent être vérifiés pendant leur raccord.

Les casques, sacs et armes du parcours d'équipement sont aussi dessinés localement sur les
sprites d'exemple. Leurs images équipées, différences, masques et compositions sont de
vraies manipulations de pixels dans un cadre de 64 × 64 ; elles ne prouvent ni la fidélité
d'un modèle IA ni un suivi automatique du mouvement. Les imports de ce parcours sont
également ramenés à 64 × 64. Les masques du corps s'appliquent avec l'équipement activé,
sans modifier sa source ; un déplacement de vue reste distinct du placement du calque.

Le HTML, le CSS et les scripts sont indépendants de l’application. La sauvegarde ne touche
qu’une clé propre à la maquette dans le stockage du navigateur. Elle n’est pas un format
de projet, ni une proposition de schéma pour le produit. La réinitialisation est explicite.
Les paramètres et corrections sont persistants ; la pile d’annulation des ateliers dédiés
reste limitée à la séance ouverte pour éviter de remplir le stockage avec des copies d’images.

## Vérifications de cette version

### Retours de 23 h 53 · itération du 12 septembre

- La fiche de pièce remet **Ses emplois** au premier plan, avec porteur, emplacement,
  couverture et accès aux poses/calques. Les genres portés, image à part et mise en scène
  reprennent B19 ; les deux derniers restent des déclarations, sans génération dédiée.
- « Au-dessus / sous le personnage » désigne l'ordre des pixels, pas l'angle de caméra.
  L'aide 3/4 et les pinceaux permettant de passer seulement une partie sous le corps
  rendent l'occultation explicite ; le corps brut ne change pas.
- La fabrication propose pliage ou appels séparés. Elle montre les images ciblées, les
  planches envoyées, le nombre d'appels et l'estimation fictive par appel. Le regroupement
  reprend le principe C3 ; sa capacité 4/6/9 cases est uniquement un réglage de maquette.
  La simulation forme une vraie image de planche puis la découpe localement en conservant
  les cibles. Revoir ou déplier le résultat n'appelle aucun fournisseur.
- Les frames issues d'un clip ou de rendus 3D empruntent ce même chemin d'images. Aucun
  workflow de modification vidéo ni habillage de maillage 3D n'est branché. L'interface
  l'explique ; la réutilisation d'une seed n'est pas présentée comme un verrou du mouvement.
- La retouche propose **Utiliser comme équipement…** : référence commune, personnage
  équipé à extraire, ou calque transparent à ajuster. Pièce, porteur et cible sont explicites.
  Le rendu courant est copié, les retouches gardées, et la source reste conservée.

Éprouvé dans `essai=equipements-appels` : cinq frames donnent un appel avec six cases,
deux appels avec quatre cases, cinq appels séparés ; génération simulée, dépliage réel
et extraction aboutissent à cinq calques vérifiables. Attribution d'une référence puis
d'une source équipée à Marche/Sud/frame 2, restauration de l'ancien calque, création d'un
emploi porté et d'une icône déclarée. Occultation partielle utilisée au pinceau.
La qualité sur des sprites 3/4 réels, une vidéo modifiée et de grands lots reste à éprouver.

### Équipements complets, après la précision de l'auteur

Le report proposé à 22 h 56 est annulé. Le parcours part désormais d'une pièce commune,
passe par son emploi chez un personnage, puis ses calques de poses, directions et frames,
et aboutit à une tenue composée. Une image du personnage équipé reste une source à
extraire ; elle ne rend pas la couverture prête. Les équipements s'ajoutent au corps de
base, sans commander une image pour chaque combinaison possible. La même pièce attribuée
à un autre héros ouvre un emploi avec ses propres calques et placements.

La fiche d'emploi permet de sélectionner les cibles, générer les images équipées simulées,
extraire leurs différences puis relire les superpositions avant validation individuelle ou
groupée. La frame s'ajuste par glisser-déposer et valeurs, avec position, échelle, rotation,
opacité, ordre, masque du calque et masque du corps. L'historique conserve une version à
restaurer. Les fabrications gardent le modèle fictif, la consigne et les images de base
envoyées ; les nouveaux envois gardent aussi l'estimation annoncée, sans recalculer un prix
inconnu pour les anciens. La galerie permet de retrouver un calque et de rouvrir sa frame.

La session séparée `?essai=equipements-complets` a éprouvé trois pièces avec six calques
chacune, la lecture avec trois équipements activés et la tenue « Exploration armée » gardée
puis rechargée. Un second emploi de l'épée chez le nain commence à zéro sur cinq frames ;
son placement X = 9, Y = −4 sur la frame 2 survit à la réouverture et à une restauration
d'ancienne version sans modifier celui du pèlerin. Le détail des gestes et limites de
vérification est dans la revue chronologique.

Les deux commandes d'export ont été déclenchées sans erreur relevée ; les téléchargements
n'ont pas été inspectés. Aucun résultat Godot ni format de livraison final n'est donc
validé. Une base modifiée par miroir est bien signalée et ne peut pas être validée par une
simple nouvelle extraction de son ancienne source. Le réordonnancement d'une bande déjà
équipée, la reprise complète sur une nouvelle base et la charge avec des centaines de
frames restent à tester. Les emplois et calques historiques
du produit, dont B20 TIENT/GLISSE, sont préservés dans le plan, sans modification du code
de production. Les garanties de stockage et d'intégration restent celles d'AU15–AU17 à venir.

La remarque connue qui demandait emplois et calques complets est archivée une seule fois
dans la maquette ; l'historique des remarques permet toujours de la restaurer.

### Complément demandé à 22 h 28

**Itération de 22 h 56.** Le montage sépare nom libre, personnage/asset, mouvement et
direction. Les frames sélectionnées disposent d'un ruban ordonné : glisser-déposer ou
Alt + flèches change l'ordre, conservé dans le brouillon et la bande.

Le premier inventaire d'emplois de cette itération est remplacé par le parcours complet
décrit ci-dessus. Les corrections de montage et les anciennes remarques reconnues sont
archivées ; le nettoyage ne supprime pas l'historique restaurable.

- Personnage → Équipements → Créer une pièce et son emploi : prépare les cibles de ce
  personnage ; l'identité de la pièce pourra être reprise dans un autre emploi.
- Navigation par familles, dont Monstres, et collections nommées ; recherche, sélection
  multiple, ajout à une collection, renommage et pagination de 24 assets. La bibliothèque
  organise les fiches ; la galerie rassemble les résultats. Aucun banc de charge avec
  des centaines d'assets n'a encore été exécuté sur ce prototype.
- Fabrications → Fabriquer librement : image, vidéo ou source 3D fictive ; prompt,
  résolution, graine, durée vidéo, références et règles de l'univers facultatives.
  Relecture avant mise en file, résultat en galerie et dépôt facultatif sur la toile.
- Galerie globale : recherche, filtres média et rattachement, aperçu, lecture du clip
  d'exemple, rattachement d'une image libre à un asset et accès aux rendus 3D simulés.
  Une carte de toile issue d'un résultat permet de le rouvrir.
- Sources & clips ou galerie vidéo → Montage : sélection des frames, ordre, cadence,
  boucle, aperçus synchronisés, destination et sauvegarde d'une bande. La source reste
  disponible pour d'autres bandes. Reprendre le montage conserve les frames corrigées
  encore sélectionnées ; le cadre commun est celui de l'exemple.
- Les remarques reconnues du relevé transmis sont archivées automatiquement une seule
  fois. L'export ne reprend que les actives ; l'historique permet de restaurer une remarque.

**Limites à ne pas confondre avec des écrans livrés dans le produit :** la vidéo est une
séquence de cinq images d'exemple, sans décodage d'un nouveau fichier vidéo ; la 3D est
une fiche simulée, sans maillage ni moteur. Les prix, modèles et paramètres sont fictifs.
Le choix de centaines de frames, le recadrage commun réglable, les profils réels et la
gestion complète des collections restent à raccorder aux capacités existantes du produit.
Le brouillon de montage se conserve par clip et par bande reprise ; rouvrir le même
parcours le retrouve. « Créer l'animation » reste nécessaire pour ajouter la bande à l'asset.

Les retours d'essai du 11 septembre à 21 h 49 sont intégrés : arborescence mouvement puis
direction, vignettes retenues / à juger / écartées et galerie filtrable ; lecture des
animations au survol ; équipements avec aperçu. Écarter conserve une version récupérable
et ne choisit pas automatiquement une autre version pour le jeu.

Après comparaison aux deux captures de l'auteur, seul le mouvement se replie : ses
directions sont des rangées compactes, sans second volet ni vignettes dans l'en-tête.
Chaque rangée réserve la retenue à gauche, aligne les autres versions, puis les écartées,
et place « générer » à droite. Les trois petits boutons sous chaque vignette permettent
de retenir, remettre à juger ou écarter ; leur intitulé est accessible et leur état indiqué.

La relecture permet de modifier ensemble les textes, le modèle et les références visibles.
Le modèle et son coût restent consultables sur la fabrication. Les noms DemoAPI/DemoLocal
et les prix sont fictifs : aucun fournisseur n'est appelé. La bibliothèque propose recherche,
filtres et vignettes pour les références, les sources d'extraction et les équipements.

Position, échelle et opacité combinent curseur et valeur ; la variante se déplace directement.
Le zoom commun aux tables, à la découpe et à l'extraction sépare déplacement de la vue et
du calque. Le pinceau montre son empreinte à l'échelle. La question « Sur quelles images
afficher cet élément ? » explique la portée et l'absence de suivi automatique du mouvement.
Zoom, défilement et filtres restent des états de séance ; les images et réglages gardés
restent dans le stockage propre à la maquette.

Les essais navigateur détaillés sont consignés dans la
[revue du 11 septembre](../revue-conformite-carnet-2026-09-11.md).
Ils concernent uniquement les parcours de cette maquette. Les critères AU restent ouverts
tant que les fonctionnalités correspondantes n’existent pas dans l’application réelle.
