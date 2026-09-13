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

## Reprise visuelle de la maquette

Captures réelles sous `essais/resultats/ui-au` : `fiche-finale-1600.png`,
`fiche-finale-1280.png`, `relecture-finale-1600.png`, `retouche-enregistree-1280.png`
et `retouche-enregistree-1600.png`. Parcours couverts : `Navigation6portes`,
`Fiche5onglets` et `pagecompacte`, avec les quatre tests de raccord UI livrés ici.

Pour le brouillon : cinq tests UI, deux tests API, et un essai navigateur signalé par
l'agent UI sur « Enregistrer → fermer → rouvrir ». Cela ne constitue pas une suite
complète de vérification visuelle.

## Livraison des autres médias et composition des équipements

Les vérifications AU12 chargent les images fixes dans Sprite2D et TextureRect ; un coffre
animé utilise le parcours commun sans squelette. AU13 importe un atlas, garde la sélection
et les corrections, puis charge TileSet et TileMapLayer dans Godot avec bords, coins,
transparence et dimensions vérifiés. Le parcours de génération d'un ensemble de tuiles
de qualité reste à essayer avec un vrai modèle.

AU15–AU17 contrôlent extraction, masques, placements et occurrences de frames conservées
au réordre. Les huit combinaisons de trois pièces restent indépendantes de toute génération.
Le test Godot des tenues joue plusieurs couches à 6,5 images/s, avec le repère 11,5 / 41,
puis retire une pièce. Le format Aseprite est comparé strictement ; les informations
de tenue vivent dans le manifeste séparé. Les essais ne prouvent pas la qualité d'une
extraction automatique sur toutes les silhouettes réelles.

Le son possède import, écoute, forme d'onde, découpe temporelle, fondus, normalisation,
fréquence de sortie, boucle et versions. Les 28 vérifications serveur audio/MCP et les
10 vérifications UI audio/délégation avaient passé au moment de ce relevé. **Mise à jour du
12 septembre 2026, mesurée à nouveau sur cette machine :** `imageio_ffmpeg` a livré une
version 7.1 qui rend le PCM 32 bits en `WAVE_FORMAT_EXTENSIBLE` plutôt qu'en
`WAVE_FORMAT_PCM` ; le module `wave` de la bibliothèque standard refusait cette étiquette et
les dix essais serveur audio (`tests/test_au14_sons.py`, `tests/test_au14_generation.py`)
échouaient, aucun fichier ne s'important plus. Corrigé par un lecteur RIFF minimal qui accepte
les deux étiquettes (voir `docs/PIEGES.md`) ; les treize essais serveur de ces deux fichiers,
dont un nouveau qui verrouille cette étiquette-là, passent à nouveau. Le comptage UI n'a pas
été rejoué ici. Godot lit le fichier corrigé via AudioStreamPlayer. Les workflows audio
partagent le registre durable et la file locale ; leurs graines, paramètres et références se
rouvrent. Le moteur ComfyUI des tests est doublé. Les fichiers silencieux ou invalides restent
acquis avec leur raison, sans être dits prêts.

## Sources locales et 3D : ce qui est établi

Les profils image et vidéo sont importables, diagnostiqués et conservés par version.
Leurs essais traversent les vrais services, fichiers et routes avec un moteur HTTP doublé.
Une vidéo revient au montage et à une bande ouvrable. Une acceptation externe inconnue
ne déclenche jamais un second envoi automatique. Aucun poids n'est téléchargé par ces tests.

Le pont asset3d expose séparément modèle, squelette, mouvements et rendu. Les identifiants
externes et les corrections du squelette sont figés ; modifier ensuite une correction
ne réécrit pas la provenance d'un ancien rendu. La caméra et la plage sont transmises au
rendu Blender ; cadre commun et repère ne se recalculent pas indépendamment sur chaque frame.
Le contrat HTTP et l'exécuteur natif ont été vérifiés sans GPU et sans écrire dans
l'installation voisine. **La qualité des modèles, du rigging et du rendu complet sur le
GPU de l'auteur n'a pas été vérifiée.** AU10 et AU11 gardent cette preuve ouverte.

## Parcours manuels supplémentaires

Le chemin manuel complet est désormais tenu par un essai plutôt que par une séance de
navigateur : `tests/test_au3_manuel.py` va du personnage vide aux fichiers `.tscn` et
`.png` écrits dans un projet Godot jetable, en n'utilisant que les routes de l'interface,
et vérifie qu'aucune session MCP n'a été ouverte pendant ce temps. Le second essai du même
fichier tient la garantie d'attribution : après une fabrication manuelle payée, le
compteur de séance de l'agent est toujours à zéro, aucune génération ne porte sa
provenance, et son cadre de délégation lui laisse encore la totalité de ses deux appels.

Dans le navigateur de test, création de « Le garde de contrôle », puis import d'un PNG
transparent vers marche / est : l'image apparaît sur la bonne ligne du personnage.
La création de « La sentinelle de contrôle » ouvre directement Objectif & règles ;
« Commencer par une animation » retire la demande de fixes, puis l'objectif est enregistré
avec cadence 11 et repère X 29. Tout cela utilise l'API et les fichiers jetables, sans MCP.

La galerie montre séparément images, bandes, clips, sources 3D et sons. Les bandes sont
lues depuis le catalogue complet du jeu, y compris celles qui ne proviennent pas des clips
visibles. Le retour à une page mémorisée et la relance d'une vignette indisponible font
l'objet d'essais de fermeture/réouverture et de panne. Les raccords d'import conservent
l'image reçue même si son classement échoue, et ne réimportent pas le fichier à la relance.

## Régression du serveur et limites de la passe générale

La première passe a été interrompue dans C5 : une attente de tâches terminées pouvait
boucler sans rendre la main. Le correctif a passé 23 tests ; l'ancien code a été reproduit
dans un processus borné par un délai externe. Le reliquat a produit 1 075 réussites,
3 échecs et 4 tests ignorés. Les trois échecs ont ensuite été corrigés et revérifiés :
11 tests G1, puis 29 tests U13/aperçu non persistant/T2, avec 3 ignorés pour moteurs absents.
Il n'existe donc pas de rapport unique disant que toute la suite serveur a passé d'un coup.

Les preuves sont dans `essais/resultats` : `regression-serveur-reste-20260912.log`,
`attente-generations-c5.xml`, `regression-g1-final.xml`, `regression-u13-final.xml`.
Python 3.12.14, pytest 9.1.1, pytest-asyncio 1.4.0 et MCP 2.2 ont servi à ces vérifications.
## Le grand fichier de tests de navigation React

Il est à niveau. `interface/src/App.test.tsx` — 623 essais au départ — en
comptait 227 en échec avant cette passe, pour 396 réussites : aucun n'accusait
un défaut du produit, tous cherchaient des mots, des boutons et des chemins que
la refonte des écrans avait déplacés. `npx vitest run src/App.test.tsx` rend
maintenant **612 réussites et 12 essais en attente sur 624** — un de plus qu'au
départ, l'essai des avertissements ayant été coupé en deux pour garder la moitié
de sa garantie qui tient encore.

Les douze en attente ne sont pas des essais réécrits ni supprimés : ils portent
chacun un `test.skip` et le commentaire qui nomme la capacité manquante, et ils
repartiront tels quels le jour où elle revient. Ces capacités — sept, dont
quatre autour de l'écran de confirmation et de la barre qui paie — sont
inventoriées dans [releve-au4-outils.md](../releve-au4-outils.md),
§ « Capacités encore ouvertes ».

Quatre défauts réels du produit ont été trouvés en chemin et réparés à la cause :
l'onglet Images de la galerie masquait toute génération dont le champ `clip`
était absent plutôt que `null` (`Galerie.tsx`) ; l'onglet Vidéos ignorait la
liste du chantier et ne montrait donc pas un clip qui venait d'être payé
(`GalerieMedias.tsx`) ; les références jointes du guichet avaient perdu la
vignette réduite et l'aperçu à la barre d'espace (`BarreQuiPaie.tsx`) ; et le
choix d'une référence, devenu un cadre de dialogue, n'était refermé par aucune
des sorties de l'écran de confirmation — partir par une porte laissait une
fenêtre modale posée sur l'écran d'à côté (`App.tsx`).

`npx tsc --noEmit` reste sans erreur.
