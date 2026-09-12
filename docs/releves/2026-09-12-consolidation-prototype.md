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

## Corrections trouvées par la revue croisée

La revue de code a repéré trois pertes possibles : retouches d'une copie de frame
réattribuées à l'original lors de la reprise du montage ; transfert d'une référence
brute alors que le sélecteur montre son rendu ; réinitialisation gardant des modules
liés à l'ancien état. Ces constats ont donné des correctifs ciblés.

Les identités d'occurrences du montage sont maintenant stables. Deux tests de contrat
dans `essais/essai_montage_maquette.cjs` ferment et rouvrent les données par JSON : copie
retouchée puis déplacée et resauvegardée, ancien montage sans identités d'occurrences.
Les deux passent ; les retouches de la copie restent distinctes de celles de l'original.

Le parent a peint un carré rouille sur le visage d'une référence, enregistré puis
comparé : la source reste sans marque, le rendu porte la marque. Après rechargement
avec les scripts actualisés, ouvrir la découpe depuis cette retouche montre la marque.
Choisir la même image dans la bibliothèque d'une fabrication libre puis relire l'envoi
montre également la marque dans la référence effectivement jointe. Les originaux
restent accessibles par un choix explicitement nommé.

La réinitialisation a été exécutée depuis « Vos remarques » dans une troisième séance
jetable. Après rechargement, la bibliothèque retrouve les deux assets initiaux, ses
familles et ses commandes de collection ; aucune erreur JavaScript n'est relevée dans
cette séance. Les séances de l'auteur et les autres données d'essai sont séparées.

## Toile vers fabrication

Le parent a élargi l'îlot « Ambiance des marais » à 680 pixels et rechargé la page :
sa dimension est conservée. Préparer depuis cet îlot propose son image et sa note ;
l'image est cochée, la note reste décochée. Choisir Le guetteur et une animation mène
à la relecture commune : une référence obligatoire, provenance « Toile · Ambiance des
marais », et aucune insertion de la note libre dans la consigne. Aucun travail lancé.

Une note mise en réserve reste présente après rechargement. La reposer sur la toile
retrouve son texte et la réserve revient à zéro. La revue du code a ensuite repéré
que son appartenance et sa position étaient réinitialisées ; ce défaut a été corrigé.
Le contrôle précis après correction utilise « Le voyageur » : îlot Ambiance des marais,
X=330, Y=110 avant mise en réserve, puis mêmes valeurs dans « Annoter » après
rechargement et restauration. Son texte est identique.

Le cadrage automatique et la saisie du zoom ont été corrigés après l'essai visuel :
« Tout cadrer » tient compte des cartes et îlots, puis la saisie à 100 % modifie
l'échelle. Le déplacement direct de cette vue agrandie a été vérifié à l'écran.

## Livraison et remplacement

Deux résultats retenus sont livrés en simulation. Ils deviennent « Inchangé » et
décochés. La marche du guetteur est ensuite enregistrée en v3 à 12 images/s, puis
le personnage renommé « Le veilleur » : le résultat devient « Modifié », avec les
mêmes chemins de fichiers sous `le-guetteur`. Une autre variante retenue de Marche /
Sud du pèlerin devient elle aussi « Modifié » ; les noms de sa première livraison
restent stables malgré son nouveau titre « Marche alternative ».

Un conflit fictif sur cette cible propose conserver, copier ou remplacer. Le choix
« Remplacer » puis la livraison des deux modifications ramènent les comptes à deux
inchangés, zéro conflit et zéro sélection. L'historique de la première livraison
retrouve « Le guetteur », v2, 11 images/s, ses cinq frames et ses anciens chemins.
L'instantané n'a donc pas repris le nom ni la cadence de la version courante.

Quatre contrats automatisés complètent cet essai dans `essais/essai_livraison_maquette.cjs` :
changement de résultat retenu avec chemins stables et instantané indépendant ; sélection
réévaluée après nouvelle révision ; ancien format relu ; réserve sans perte de placement.
Avec les deux contrats du montage, les six passent. Les neuf scripts du prototype
passent la vérification de syntaxe JavaScript.

## Portée des preuves

Ces essais ne prouvent ni la fidélité des exports Godot, ni la qualité de génération,
ni les performances du stockage de production. Les défauts de l'application réelle
relevés dans l'audit restent rattachés aux tranches AU concernées.
