# Maquette de l’atelier — couverture et limites

[Ouvrir l’atelier à essayer](02-atelier.html). La première [proposition de parcours](01-parcours.html)
reste disponible pour comparer la simplification initiale avec cette version plus large.

Cette version sert à **essayer les parcours et faire apparaître les besoins oubliés**.
Elle ne remplace pas l’application et ne prouve pas ses traitements. L’identité reste celle
de [DESIGN.md](../DESIGN.md), avec polices de repli si les polices prévues ne sont pas installées.
Les limites sont affichées sur les écrans concernés, pas seulement dans ce document.

## Comment l’essayer

Ouvrir l’HTML dans un navigateur desktop, ou le servir avec un serveur statique local depuis
la racine du dépôt. Il utilise deux fichiers voisins et des images locales, sans dépendance
réseau. Le panneau **Essayer la maquette** propose six parcours courts. Commencer par
**Créer sans MCP**, puis **Corriger une animation** et **Composer un univers**.

Le bouton **Noter une remarque** garde le contexte de l’écran. Les remarques s’exportent
en texte Markdown copiable depuis **Vos remarques**, avec téléchargement facultatif selon
le navigateur ; elles ne sont pas envoyées automatiquement.
Les données de démonstration restent dans ce navigateur, pour cette adresse. Changer de
navigateur, de port ou de mode d’ouverture peut ouvrir une autre séance. Si le stockage est
indisponible ou plein, l’écran le signale ; la séance reste en mémoire jusqu’à sa fermeture.

## Ce que l’on peut éprouver

| Zone | Manipulations effectives dans la maquette | Simulation ou détail encore absent |
|---|---|---|
| Jeu | Vue d’ensemble, accès à l’univers, assets, fabrications et livraison | Création de plusieurs jeux et premier lancement à détailler |
| Univers / toile | Ajouter note, image et îlot ; annoter ; associer une carte à un îlot ; déplacer carte ou îlot avec ses cartes ; relier ; zoomer ; retrouver les positions | Découpe de carte, extraction de palette, officialisation d’artwork et passage assisté vers les règles à compléter |
| Bibliothèque | Créer un sujet, rechercher, filtrer les cinq familles actuelles, retrouver les résultats | Collections, tri fin, corbeille restaurable et vue de tous les résultats à compléter |
| Objectif | Fixe, animé ou mixte ; mouvements et directions ; matrice qui distingue résultats fixes et animés | Couverture partagée réelle avec API et MCP dans AU2 |
| Création manuelle | Fiche vide → référence → demande d’animation → relecture entière → fabrication → résultat | Les générations sont simulées et réemploient des images d’exemple |
| Référence / import | Importer PNG, JPEG, WebP dans le navigateur, limite de démonstration à 2 Mo | Pas de téléversement au serveur ; clip représenté par une séquence préparée |
| Fabrications | Origine manuelle ou agent ; attente, résultat, interruption, échec, reprise explicite ; résultat en bibliothèque | Ni travail distant, ni facturation, ni ordonnanceur réel |
| Montage | Lecture, cadence, boucle, choix et sélection multiple de frames, ordre, duplication, retrait, extraction fixe | Pas de décodage d’un clip importé ni de détection automatique des temps clés |
| Main | Peinture au pixel, gomme du calque peint, portée frame/sélection/animation, annuler/rétablir, opacité du calque | Sélection géométrique, masques avancés, pile libre et pipette à compléter |
| Recette | Miroir, marge, lumière, saturation et repères modifient l’aperçu ; recette nommée ; garder et rouvrir les réglages | Les filtres sont simplifiés. Les moteurs CPU actuels ne sont pas réécrits en JavaScript |
| Tables avancées | Portes visibles vers détourage, grille, nettoyage, contour, découpe et différence ; contrôles conditionnels et réglages gardés | Leurs algorithmes ne tournent pas ici ; découpe libre, différence d’équipement, calibration et réglages fins restent à dessiner |
| Comparer / juger | Comparer deux résultats ou source/retouche ; favori distinct du choix pour le jeu | Pas de comparaison synchronisée des animations complètes ni de grille de calibration |
| Équipement | Associer et retirer une pièce, retrouver l’association | Calage, emplois détaillés, extraction et calques animés à compléter en s’appuyant sur l’existant |
| Livraison | Choisir les résultats, destination proposée, aperçu des formats, historique par révision, conflit fictif | Aucun PNG/JSON/SpriteFrames produit, aucun fichier du jeu écrit ; la preuve Godot reste AU1 |
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
| atelier-decoupe, atelier-difference, Emplois, Emploi | Montage et équipement ; reprendre les outils dédiés avant tout remplacement de leurs écrans |
| Clips, Clip, Atelier-animation | Sources et montage ; compléter vidéo brute, plages temporelles et états de préparation |
| Envoi, Relecture | Préparation et écran entier de relecture, puis fabrications |
| Sortie | Livraison ; confirmer le contrat réel dans Godot avant de figer le détail |
| Installation, Depenses, Finesse | Réglages ; compléter installation, catalogue réel, barème et dimensions fines |
| Guide, Etats | Visite et états vides/erreur ; couverture d’aide par réglage à reprendre dans le produit |
| Navigation, Barre, Parcours, Vocabulaire, Systeme, Sommaire, l-atelier-en-carnet | Références transversales ; leurs fonctions se répartissent dans la navigation, les formulaires et le design conservé |
| Tuiles | Périmètre futur maintenu, atelier à concevoir |

La bibliothèque de mouvements, les collections, l’usage détaillé d’équipement, les règles de
famille et les ateliers de carte ne sont **pas abandonnés** parce que cette version les
dessine moins. Avant de remplacer une surface existante, compléter son inventaire de
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

## Matière visuelle et périmètre technique

Le pèlerin fixe vient des vignettes déjà présentes dans l’interface. `marche-demo.png` est
une copie inchangée d’une planche du banc vidéo local du dépôt (cinq vues d’exemple). Son
fond fait partie de l’image ; ce n’est pas une preuve de détourage. Aucun asset neuf n’a été
généré pour ce travail. La taille d’aperçu de la retouche est 64 px, quelle que soit la taille
de sortie sélectionnée : cette différence est affichée dans la table Grille.

Le HTML, le CSS et le script sont indépendants de l’application. La sauvegarde ne touche
qu’une clé propre à la maquette dans le stockage du navigateur. Elle n’est pas un format
de projet, ni une proposition de schéma pour le produit. La réinitialisation est explicite.

## Vérifications de cette version

Les essais navigateur détaillés sont consignés dans la
[revue du 11 septembre](../revue-conformite-carnet-2026-09-11.md).
Ils concernent uniquement les parcours de cette maquette. Les critères AU restent ouverts
tant que les fonctionnalités correspondantes n’existent pas dans l’application réelle.
