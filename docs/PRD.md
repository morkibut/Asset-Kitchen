# Asset Kitchen — PRD

> Recentré le 11 septembre 2026 à la demande de l'auteur. Ce document fait foi sur
> l'usage ; l'architecture sur la construction, le plan sur l'ordre, le design sur l'apparence.
> Le cadrage précédent est conservé dans [l'archive](archive/prd-avant-atelier-unifie.md).
> Les décisions explicites du jour sont acquises ; les écrans proposés restent à éprouver.

## Problème

L'auteur crée un jeu seul sur ordinateur. Il veut produire un univers cohérent puis ses
personnages, objets, décors et éléments d'interface, fixes ou animés, sans reconstruire
ses intentions à chaque outil. Aujourd'hui les fonctions existent en partie mais leur
enchaînement reste difficile : retrouver la bonne version, passer de l'image à l'animation,
reprendre une correction et savoir exactement ce qui part dans le jeu.

Le personnage est trop souvent présenté comme un ensemble de poses fixes à remplir.
Pour le parcours prioritaire, le résultat attendu est une animation jouable, avec les
directions nécessaires au jeu. Une référence fixe peut aider à la fabriquer ; elle ne
doit pas devenir une collection obligatoire de livrables.

Les premières expériences ont montré les limites de certains procédés de génération.
Elles renseignent le choix d'un procédé, sans interdire de nouvelles sources locales.
Le problème à résoudre est la continuité du travail, y compris quand un calcul dure,
échoue ou doit être repris.

## Solution

Un atelier desktop pour **définir un univers → créer ses assets → les animer ou les
retoucher → les exporter vers le jeu**. Le parcours de référence, choisi par l'auteur,
est : **créer un personnage, produire ses animations, puis exporter ses sprites**.

**Ce parcours est aussi celui de l'IA qui développe le jeu Godot.** L'agent demande à
l'atelier les assets manquants, suit leur fabrication et récupère de quoi les utiliser
dans le jeu. L'auteur prépare l'univers, supervise et corrige depuis la même application.
Ce fonctionnement concerne la création du jeu ; le jeu terminé n'a pas besoin de lancer
une génération pour fonctionner.

**Le parcours manuel est complet et indépendant du MCP.** L'auteur peut créer le jeu,
composer son univers, créer un asset, importer ou générer ses sources, fabriquer ses images
et animations, les retoucher puis les exporter sans connecter d'agent. Le MCP est une
seconde façon de demander les mêmes fabrications, jamais un préalable de l'interface.

Le jeu porte ses règles visuelles et ses références communes. Chaque asset possède une
identité stable et un objectif explicite : images fixes, animations, ou les deux.
Les mouvements et les directions utiles sont choisis pour ce besoin. Une case non
demandée ne compte jamais comme du travail manquant.

**L'univers reste aussi un espace créatif.** Sa toile conserve les images, les textes,
les notes, les îlots et les liens que l'auteur organise librement. Elle reste accessible
depuis l'univers, à côté de ses règles visuelles ; un formulaire de réglages ne la remplace
pas. Les compositions existantes et leur organisation doivent se retrouver à la réouverture.

Depuis cet asset, l'auteur importe ou génère une référence, puis choisit une méthode de
fabrication disponible : génération distante, génération locale, import, ou rendu d'une
source 3D réutilisable. Les réglages utiles sont présentés dans le vocabulaire du résultat.
Les réglages avancés restent accessibles sans devenir le passage obligé du geste courant.

**Trois choses restent distinctes** : l'asset du jeu, les sources qui servent à le
fabriquer et les résultats produits. Une référence, un clip et un modèle 3D ne remplissent
pas une animation manquante. Refaire un angle ou un mouvement réutilise ce qui peut l'être,
sans demander une nouvelle fabrication de la source.

Tout résultat rejoint automatiquement la bibliothèque. L'auteur peut comparer,
marquer favori, supprimer avec annulation et choisir ce qu'il souhaite exporter.
Le choix pour le jeu reste explicite : une nouvelle variation n'écrase pas la précédente.
Les originaux et les réglages conservés permettent de rouvrir et corriger sans régénérer.

**Les capacités des tables de retouche sont conservées.** Depuis une image, une animation
ou une frame, l'auteur accède aux outils utiles : montage, découpe, détourage et masques,
recadrage, grille, couleurs et palette, nettoyage, contours, transformations, calques et
retouche au pixel. Les recettes réutilisables, réglages avancés et comparaisons restent
accessibles. L'organisation peut changer ; une capacité n'est pas supprimée pour alléger
l'écran. L'action précise si elle modifie cette frame, une sélection ou toute la bande.

Le travail long reste visible pendant que l'auteur continue ailleurs. Une fermeture
n'efface ni le résultat ni sa provenance. Après une interruption incertaine, l'atelier
cherche le travail déjà soumis et explique ce qu'il sait avant toute nouvelle demande.

Les demandes de l'agent nomment le jeu, le sujet et le résultat attendu. L'atelier cherche
d'abord un résultat réutilisable. Le cadre choisi par l'auteur précise les procédés permis,
les limites de dépense et de tentatives et le dossier de destination. Dans ce cadre,
l'agent peut produire et exporter sans attendre une validation humaine à chaque image.
Un résultat envoyé automatiquement reste identifié comme provisoire tant qu'il n'a pas été
retenu pour le jeu ; l'auteur peut le remplacer et retrouver les versions précédentes.

L'export termine le parcours : aperçu animé à la taille du jeu, sélection exacte,
dimensions, cadence, pivot et noms vérifiables, puis fichiers accompagnés de leur
description. Les animations exportées doivent être celles qui ont été prévisualisées.

Les tuiles et le son prolongeront le même univers et la même bibliothèque. Leur fabrication
aura ses outils propres ; ils ne seront pas forcés dans un formulaire de personnage.

## Utilisateur cible

L'auteur du jeu, sur ordinateur, au clavier et à la souris, souvent avec l'éditeur du jeu
ou un agent dans une autre fenêtre. L'interface reste en français et utilise efficacement
une fenêtre desktop. Il n'y a pas de parcours mobile à concevoir.

Il sait juger un sprite, une boucle et une palette. Il souhaite contrôler la qualité,
le coût et les méthodes utilisées, tout en déléguant les manipulations répétitives.
Il peut travailler avec une génération distante ou avec les capacités de sa machine.

## User Stories → `docs/user-stories.md`

Les stories historiques US-1 à US-518 restent dans [le catalogue](user-stories.md).
Les stories US-519 à US-536 ajoutées le 11 septembre couvrent le nouvel atelier :
objectif de production, sources, animation, reprise, export, travail long, procédés locaux,
3D réutilisable, futures familles et boucle de production avec l'agent Godot.
US-534 à US-536 garantissent explicitement le parcours sans MCP, la toile et les outils existants.
US-536 distingue les tables de retouche, la composition par calques, la découpe d'une
planche en plusieurs images et l'extraction d'un élément après calage de deux images.
En cas de conflit, le présent cadrage prévaut ;
les anciennes stories ne sont pas supprimées comme si elles n'avaient jamais été livrées.

## Critères de succès → `docs/prd-criteres.md`

Les critères antérieurs restent dans [leur annexe](prd-criteres.md).
Le parcours prioritaire est jugé sur ces résultats observables :

- Depuis un jeu et un personnage vide, produire une animation demandée et l'exporter,
  sans remplir préalablement un plan de poses fixes.
- Effectuer le parcours complet dans l'interface sans client MCP connecté ; aucun réglage
  ou échange avec un agent n'est exigé pour fabriquer ou exporter.
- Rouvrir une toile existante, déplacer une image, modifier une note et un îlot, puis
  retrouver leur disposition et leurs liens après fermeture.
- Reprendre les capacités des tables depuis une image et une frame, avec la portée du
  traitement explicite ; les opérations sans équivalent bloquent le retrait de l'ancien accès.
- Revenir dans le personnage après fermeture : retrouver les sources, les versions,
  les choix d'export et une correction enregistrée avec des réglages différents des défauts.
- Lire la couverture des seuls mouvements et directions demandés ; un résultat absent,
  à revoir, prêt et non demandé ne se confondent pas.
- Prévisualiser une boucle à sa taille réelle et retrouver les mêmes images, cadence et
  repères dans les fichiers exportés.
- Faire demander un personnage animé par l'agent, retrouver sa demande dans l'interface,
  ouvrir le résultat dans une scène Godot, puis remplacer une animation sans perdre les autres.
- Échouer puis reprendre sans perdre les réglages ni soumettre silencieusement un doublon.
- Réutiliser un modèle 3D et son squelette pour un autre rendu sans régénérer le personnage.
- Effectuer ces gestes dans une fenêtre desktop, avec retour au contexte précédent,
  sans action cachée par un panneau et sans contrôle qui ne produit aucun effet.

La première livraison est vérifiée avec des résultats locaux de démonstration.
La qualité des générations et l'intégration au moteur du jeu demandent ensuite un essai
réel avec l'auteur ; aucun taux de réussite n'est promis sur la seule lecture du code.

## Hors périmètre → `docs/prd-hors-perimetre.md`

Restent exclus : mobile, comptes multi-utilisateurs, place de marché, jugement artistique
automatique et moteur de jeu intégré. L'atelier ne devient pas un outil général de
modélisation 3D ni un éditeur universel de procédés graphiques.

L'ancienne exclusion de la génération locale est levée par la demande du 11 septembre.
La 3D sert d'abord à fabriquer des sprites ; éditer un monde 3D complet reste hors de ce
parcours. Tuiles et son sont prévus ensuite, sans faux boutons de production avant livraison.

[L'annexe](prd-hors-perimetre.md) conserve les exclusions détaillées et leurs raisons.

## Décisions d'implémentation → `docs/prd-decisions.md`

- L'identité graphique décidée reste la base ; l'organisation des écrans peut évoluer
  pour rendre le parcours meilleur.
- L'animation est le premier parcours à rendre excellent. Les images fixes restent
  disponibles et peuvent aussi être le seul objectif d'un asset.
- Les préparations nécessaires à une méthode sont expliquées au moment utile ;
  une référence technique n'est pas un livrable obligatoire du jeu.
- Toute fabrication annonce sa destination et ce qu'elle consomme. Une estimation de
  durée inconnue est dite inconnue ; elle n'est ni zéro ni une promesse inventée.
- Une méthode indisponible indique la raison et la prochaine action possible.
  Aucun remplacement par une autre méthode ni aucune dépense ne se fait en silence.
- L'existant reste ouvrable. Une évolution ne supprime pas les anciennes images,
  animations, recettes ou associations pour simplifier le nouvel écran.
- La sortie est volontaire : posséder un résultat, le préférer et le choisir pour le jeu
  sont trois décisions distinctes.

Les autres comportements acquis sont décrits dans [les décisions d'usage](prd-decisions.md).

## Notes complémentaires → `docs/prd-carnet.md`

Les enseignements antérieurs restent dans [le carnet](prd-carnet.md) et le
[bilan de l'animation](bilan-v3.md). Les limites observées d'une méthode ne constituent
pas un verdict sur toutes les méthodes futures. Les critiques et hypothèses nouvelles
sont consignées dans [la revue du 11 septembre](revue-conformite-carnet-2026-09-11.md).
