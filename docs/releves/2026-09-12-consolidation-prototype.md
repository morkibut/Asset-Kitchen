# Essais de consolidation du prototype — 12 septembre 2026

Ces observations suivent la [revue comparative](../revue-ux-complete-2026-09-12.md).
Elles concernent uniquement la [maquette interactive](../maquettes-atelier-unifie/02-atelier.html).
L'état du chantier reste dans [PLAN.md](../PLAN.md) ; les limites du simulateur restent
dans sa [couverture](../maquettes-atelier-unifie/couverture.md).

## Conditions

Navigation dans le navigateur intégré, à 1280 × 720, sur le serveur local 8496.
Les essais utilisent des profils `?essai=...` séparés du stockage de la maquette de
l'auteur. Aucun appel à un fournisseur, aucun débit, aucune écriture dans un projet
Godot. Les exemples volumineux sont limités à ces profils.

## Reprise de retouche

Sur la marche du pèlerin, passer de 8 à 11 images par seconde puis revenir à l'asset
ouvre le choix continuer / abandonner / garder le brouillon / enregistrer.
Après « Garder le brouillon et quitter », recharger puis ouvrir « Brouillons · 1 »
retrouve la cadence 11 et signale que la version 1 enregistrée reste intacte.
Enregistrer, revenir à l'asset et rouvrir retrouve la version 2 à 11 images par seconde.

Le contrôle visuel après actualisation des styles montre l'image, le zoom, les cinq
frames et les gestes de timeline dans la même fenêtre. L'inspecteur possède son propre
défilement. Le fond neutre entoure l'image ; certains exemples incluent déjà du damier
dans leurs pixels, que ce choix d'affichage ne retire pas.

## Bibliothèque chargée

Le bouton d'essai ajoute 600 exemples : 602 assets au total avec les deux initiaux.
La liste affiche 40 éléments par page, soit 16 pages. Chercher « Décors exemple 004 »,
choisir la grille puis recharger conserve le filtre, la vue et l'unique résultat.
Ctrl + A puis Retour arrière rétablit les 602 résultats.

Une friction trouvée pendant ce test est transmise pour correction : ranger une
sélection sans collection existante doit proposer d'en créer une sur place.

Créer « Marais — décors », y ajouter l'asset trouvé, archiver la collection puis
recharger permet de la restaurer avec son membre. Les 602 fiches restent présentes.
Ajouter 24 collections d'essai, dont 18 dans Personnages, puis chercher « 18 » retrouve
la dix-huitième et ses quatre membres. Un ancien filtre d'asset peut masquer ces membres :
un bouton explicite de réinitialisation a donc été ajouté.

## Relecture des fabrications

L'agent chargé de ce parcours a vérifié les deux entrées normale et libre : passage
lecture → édition → lecture, consigne modifiée, références, deux clips de six secondes,
format 16:9, 720p, graine 42. La fabrication libre produit deux travaux distincts ;
recharger puis relire leur envoi conserve ces paramètres.

Le cas de dépassement des références a également été essayé : trois images jointes
restent visibles sur un profil fictif limité à deux ; le lancement est bloqué avec sa
raison. Choisir le profil fictif acceptant six références conserve les trois images et
autorise l'envoi. La maquette ne réduit pas silencieusement les références de l'auteur.

Une divergence de consommation a été corrigée avant livraison de ce lot : le journal
libre supposait 0,20 dollar pour tous les profils. Le montant et son unité sont désormais
conservés à l'envoi. Le parent a vérifié un profil qualité annoncé à 0,40 dollar fictif,
simulé son résultat puis rechargé : le journal affiche le modèle qualité, son montant
0,40 et le total 0,40 ; le travail local voisin reste non mesuré et exclu du total.
Un ancien envoi sans montant conservé reste inconnu, sans prix recalculé.

## Personnage sans référence

L'agent châssis a essayé un personnage vide : demander Marche / Ouest, deux clips de
six secondes, fabriquer une référence technique, relire son image puis reprendre
l'animation conserve la cible et les paramètres. Les deux étapes demandent chacune
leur relecture ; deux travaux d'animation sont ensuite retrouvés après rechargement.

Le parcours alternatif a été essayé par le parent : créer « Le guetteur », demander
Marche / Ouest, choisir une référence dans la bibliothèque visuelle, la joindre puis
relire conserve la cible et son image de départ obligatoire. Simuler le résultat,
passer à 11 images par seconde et peindre pendant la lecture produit une retouche
enregistrable. La peinture arrête la lecture au geste. La version 2 retenue apparaît
ensuite dans la livraison, avec le pèlerin déjà retenu.

## Montage

L'agent bibliothèque a essayé : clip de cinq frames → plage 2–4 → 11 images par seconde
→ Marche / Nord avec nom personnalisé → duplication et déplacement au clavier.
Recharger retrouve quatre frames dans l'ordre 2, 3, 2, 4 et les réglages. Inverser pendant
la lecture laisse le lecteur utilisable. Créer et retoucher, revenir à l'asset puis
reprendre le montage et recharger conserve la bande. L'image et la timeline ont été
contrôlées ensemble à 1280 × 720.

## Équipements

L'agent équipements a vérifié le sac : six images, pliage en quatre et deux cases,
deux appels annoncés à 0,08 dollar fictif, dépliage, extraction, lecture des cinq frames.
Signaler la frame 3 l'exclut de la validation collective. Ouvrir cette frame, régler sa
position, la valider puis activer le sac dans la combinaison laisse l'animation jouable.
Retoucher la première frame du personnage fait passer la couverture de 6/6 à 5/6 et
signale la base modifiée ; la validation du groupe l'exclut.

La relecture historique après rechargement retrouve le texte d'univers modifié,
les six bases, les deux appels, la graine 42 et la résolution demandée. Le parent a
également parcouru fabrication, dépliage, extraction et validation animée avec le
profil local, puis contrôlé visuellement les cadres de relecture et de vérification.

Le raccord de contexte du lot suivant a été essayé par le parent : Sac de voyage,
Marche / Sud, frame 3, position X=2 et zoom 700 %, puis rechargement. L'écran précis,
la position et le zoom se retrouvent ; le calque modifié reste « À vérifier ».

## Portée des preuves

Ces essais ne prouvent ni la fidélité des exports Godot, ni la qualité de génération,
ni les performances du stockage de production. Les défauts de l'application réelle
relevés dans l'audit restent rattachés aux tranches AU concernées.
