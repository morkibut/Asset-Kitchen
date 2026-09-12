# Atelier unifié — preuves d'implémentation du 12 septembre

Ce relevé décrit les essais et les contrats introduits. L'état du chantier reste
uniquement dans `../PLAN.md` ; les critères restent dans `../PLAN-atelier-unifie.md`.

La maquette interactive a été validée entièrement par l'auteur. Le produit conserve
le système de design existant et les anciens outils tant que leur reprise n'est pas
éprouvée. Une liste de fonctionnalités ne constitue pas une preuve d'intégration.

## Livraison Godot

Le service de livraison prépare un instantané durable des bandes choisies : PNG,
descriptif Aseprite inchangé, PNG animé, SpriteFrames, scène AnimatedSprite2D et
manifeste maison distinct. Une scène au chemin stable référence une révision immuable.
Les animations non remplacées sont conservées. Les fichiers inconnus ou modifiés
manuellement produisent un conflit ; aucune suppression de fichiers du jeu.

Le jeton relu est idempotent. Reprendre une ancienne révision prépare un nouveau jeton,
ce qui distingue restaurer un choix de répéter une requête déjà exécutée. Les verrous
sont libérés par le système après arrêt du processus. Une publication interrompue
conserve la révision précédente et se reprend avec son journal.

Essais : 22 critères serveur AU1 dont transport MCP HTTP ; import réel avec
Godot 4.7.2 en mode headless, scène instanciée et animation jouée. L'ordre aller-retour
`0,1,2,3,2,1`, la cadence, le pivot et le remplacement sont contrôlés. Dans le navigateur,
association d'un projet temporaire, relecture de sept fichiers, publication puis
fermeture/réouverture et préparation d'une révision historique ont été exercées.

## Objectif et fabrication suivie

L'objectif décrit séparément les images fixes et les animations demandées, format,
cadence, boucle et repère. La couverture distingue demandé, produit et retenu.
Une référence ne remplit jamais une animation. Les anciens personnages relisent leur
plan sans migration destructive ; API et MCP lisent la même couverture.

Une fabrication suivie conserve sa clé, ses sous-appels, les octets de référence,
le texte effectivement composé et les paramètres. L'édition de la relecture crée une
nouvelle clé. La reprise utilise le travail externe connu ; une acceptation incertaine
ne déclenche aucune nouvelle commande. La facture s'enregistre avant le décodage du
fichier, y compris quand celui-ci est illisible.

Les réservations de budget sont partagées entre demandes complètes du même jeu et
persistées. Elles utilisent des estimations ; elles n'imposent pas de plafond de facture
au fournisseur. Les anciens outils conservent leur garde-fou de séance, distinct et
expliqué dans le panneau de délégation. Zéro, montant inconnu et temps local restent
trois informations différentes.

Essais : AU2, AU3, génération T1, vidéo A9 et montage A10 ; trajet MCP HTTP depuis un
personnage vide jusqu'à image, vrai MP4 et bande. Réouverture, reprise du même identifiant
externe, budgets simultanés et dépassement après facture réelle sont éprouvés.
Les essais React relisent les références figées, modifient le texte, retirent une
référence puis vérifient que seul le nouvel instantané est lancé.

## Retouche et emplois

Les occurrences de frames acquièrent une identité conservée lors des déplacements et
renouvelée pour une copie. Une variante d'équipement vise une image ou une occurrence
précise d'une bande, avec sa pose et sa direction. Les sources et masques restent gardés
quand la base change ; la validation est invalidée, jamais réélue automatiquement.

La nouvelle Main d'une frame se pose après son déplacement borné, sur sa case finale.
Elle est distincte de la Main historique contenue dans une recette, dont le rendu est
inchangé. Les essais contrôlent les pixels sous le pinceau, les frames voisines
inchangées, la réouverture, le recalcul d'un cache effacé et le réordonnancement.

L'atelier de vérification utilise `essais/atelier_jetable_au.py`, un dossier sous
`essais/resultats/atelier-au` et des fournisseurs doublés. Aucun appel IA réel et aucune
écriture dans les données ou le projet Godot de l'auteur n'ont été nécessaires.

## Contrôles transversaux

Le garde-fou d'import du carnet avait encore besoin d'un inventaire supprimé : il est
recalculé depuis les sources. Deux constantes métier empruntées à des écrans sont
déplacées dans des modules partagés. Les règles de couleurs, typographie et géométrie
du système de design continuent de s'appliquer aux nouveaux écrans.

Le contrôle des documents a résolu 1 761 renvois ; son premier relevé a signalé une hausse
de 0,2 Ko du corpus de démarrage (163,7 Ko). Le détail d'implémentation reste ici, et les
phrases historiques redondantes du plan sont retirées au lieu d'allonger ce corpus.
