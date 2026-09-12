# Sources vidéo et 3D — conception et vérifications du prototype

Ce relevé accompagne le complément demandé le 12 septembre. Le plan actif et ses
critères restent dans [PLAN-atelier-unifie.md](../PLAN-atelier-unifie.md).
Les traitements décrits par la maquette sont des simulations locales ; ils ne
constituent pas une intégration à un fournisseur, à ComfyUI ou à asset3d.

## Ce que l'existant a appris à la conception

Le code vidéo de l'atelier conserve le clip et sa recette de montage. Le clip est une
source ; le livrable du jeu est une bande issue d'une sélection de frames, avec une
cadence, une boucle et un cadre commun. Le nouveau parcours conserve cette séparation.

La lecture d'asset3d a porté sur son API, les étapes de fabrication, les corrections
du squelette, l'attache d'animation, le rendu Blender et la capture du viewer :

- [API](../../../asset3d/serveur/main.py) et [catalogue](../../../asset3d/serveur/modeles.py) :
  la génération exposée prend une image. Un prompt peut préparer l'image en amont ;
  il n'est pas présenté comme un paramètre actuel du moteur image vers 3D.
- [Fabrication](../../../asset3d/serveur/etapes/modele_3d.py) : le contrôle de silhouette
  et de détourage précède le modèle. La pose technique ne vaut pas animation prête.
- [Corrections](../../../asset3d/serveur/corrections.py) et
  [attache d'animation](../../../asset3d/blender/attacher_animation.py) : un squelette
  réutilisable, des corrections d'articulations et des animations FBX locales compatibles.
  Ni génération de mouvement par prompt ni adaptation universelle de squelettes n'est
  annoncée comme une capacité déjà intégrée.
- [Rendu](../../../asset3d/blender/rendu.py) et
  [viewer](../../../asset3d/page/src/ApercuSquelette.tsx) : l'orbite du viewer et les
  préréglages Blender ne garantissent pas les mêmes pixels. Caméra effective, dimensions,
  nombre de frames et cadence doivent se conserver avec le résultat.

Changer un mouvement réutilise le rig ; changer la caméra ou le style réutilise le
modèle et la piste. Une correction amont peut rendre une préparation à revoir sans
réécrire les rendus antérieurs. Ces règles prolongent US-521, US-522, US-523 et US-528.

## Parcours de vérification

Essais dans une session de démonstration séparée, avec les contrôles visibles du
navigateur, sur un bureau de 1 280 × 720 px. Aucune donnée de la séance de l'auteur
n'a été réinitialisée.

### Vidéo : une source, puis une animation

Depuis le pèlerin, création d'une demande Marche / Ouest : image de référence,
consigne modifiée, modèle local de démonstration, 720p, 1:1, seed 42 et 6 secondes.
La relecture précède le travail simulé. Son résultat ouvre un **clip source**, sans
ajouter prématurément une animation prête. L'écran distingue les 6 secondes demandées
des 5 frames réellement fournies par l'exemple : 0,625 seconde à 8 images/s.

Sélection de 0,125 à 0,500 seconde : trois frames. Montage nommé « Marche courte »,
cadence 11 images/s, cadre commun de 48 × 64 et pivot (32, 56), puis retouche au
pinceau sur la capuche. La comparaison montre la source intacte et le trait au bon
endroit dans le résultat cadré. Après fermeture et rechargement, reprendre le montage
depuis le clip retrouve les trois frames, la cadence, le passage, le cadre, le pivot,
le nom et la cible Marche / Ouest. Monter une autre animation reprend aussi la cible
du clip, sans reprendre les réglages d'un autre brouillon.

### 3D : les six étapes jusqu'aux sprites

Image d'exemple choisie, contrôles de silhouette validés, profil Pixal3D relu.
Échec simulé, rechargement, reprise des mêmes paramètres : la seconde tentative
conserve le profil et la référence. Le modèle reçu reste à contrôler. Après validation,
un squelette est préparé séparément ; correction de flexion des épaules à 12°, puis
attache du mouvement Marche, nommé « Marche test 3D », à 11 images/s.

La caméra et le style changent effectivement l'aperçu géométrique. Les réglages
choisis — azimut 45°, élévation 35°, projection orthographique, style BD et pivot
vertical 84 % — sont retrouvés après rechargement. La relecture annonce deux
animations, Sud et Ouest, de huit frames chacune ; le modèle et le squelette restent
les mêmes. Les deux résultats entrent dans l'asset. Ouvrir Ouest dans l'atelier montre
les huit images du mannequin, avec les poses distinctes et la cadence de 11 images/s.

### Corrections issues de l'essai et de la revue

- La destination du montage venait du premier mouvement de l'asset : elle vient
  désormais de la demande du clip, puis du brouillon si l'auteur l'a modifiée.
- L'aperçu central du montage était trop petit : sa taille minimale est 128 px,
  avec les explications longues repliées.
- Le cadre commun est appliqué au rendu et inversé pour les coordonnées du pinceau :
  le trait se place sur le pixel visé après cadrage, y compris après un retournement.
- La revue 3D a relevé les contrôles amont insuffisants, la cadence d'aperçu fixe,
  les valeurs de caméra périmées après manipulation, et le pivot absent de la recette
  commune. Ces points ont été corrigés et couverts par les essais ci-dessous.

### Vérification après corrections

Réouverture du squelette : la flexion de 12° est conservée. La modifier à 18° remet
le contrôle à faire ; la page Rendus indique « Marche · à vérifier », son bouton de
relecture est désactivé, et les deux anciens résultats restent accessibles avec la
mention « réglages actuels différents ; version conservée ». Revalider le squelette
puis le mouvement permet de rendre à nouveau sans créer un autre modèle ou rig.

La flèche droite sur l'aperçu passe l'azimut de 45° à 50°, synchronise le curseur et
la valeur numérique, et marque la vue « Personnalisée ». Le nouveau rendu Pixel art
conserve le nom « Marche test 3D · Sud ». Son ouverture rejoint la retouche commune ;
sa sélection pour le jeu l'affiche dans Livrer au jeu, avec huit frames à 11 images/s.
La livraison simulée réussit, garde un historique, puis considère cette version
inchangée. Aucun fichier n'est écrit dans Godot.

Dernier contrôle de galerie : le filtre Rattachement « Le pèlerin » + Média « 3D »
retrouve le modèle v1, étiqueté au nom du personnage ; l'ouvrir reprend sa version
contrôlée et les réglages conservés. Les clips portent aussi leur rattachement, et
les rendus 3D sont regroupés avec leur source. La première présentation les classait
à tort comme essais libres : ce raccord a été corrigé pendant la vérification.

Le guide propose aussi « Essayer le parcours vidéo » et « Essayer le parcours 3D ».
La préparation d'une animation offre aussi un accès aux sources 3D du personnage.
Lorsqu'il n'en a pas encore, la nouvelle source reprend la consigne, les références
explicites et la cible choisies ; une source existante garde sa préparation antérieure.

Contrôles automatisés : **15 tests réussis** dans les bancs de montage, de livraison
et de sources 3D. Le nouveau banc 3D exerce la factory, les handlers et les vues avec
stockage et dessin doublés : trois invalidations amont, instantané immuable après
modification et reprise, nombre entier de frames et pivot commun, échec puis reprise
sans doublon. Il ne prouve ni le rigging ni la qualité du rendu réel. Les vérifications
de syntaxe des modules passent ; aucune erreur de console relevée pendant les essais.

Le banc documentaire résout les 1 758 renvois du corpus. Les cinq documents de démarrage
occupent 163,5 Ko ; leur hausse arrondie est inférieure à 0,1 Ko sur cette extension.

## Limites

L'aperçu 3D du prototype est une géométrie de démonstration calculée dans le navigateur.
Il permet de juger les réglages et l'enchaînement, pas la qualité d'un maillage généré
ni la validité d'un rig réel. Les imports et les profils sans moteur raccordé sont
signalés comme tels. Aucun téléchargement de poids ni changement d'installation n'est effectué.

Les images importées dans la source 3D sont réduites explicitement pour la copie de
démonstration stockée dans le navigateur ; l'original ne change pas. Les imports vidéo
et maillages complets restent à raccorder : la vidéo utilise cinq frames préparées,
le rendu 3D produit des PNG de mannequin de 64 × 64 px. Une dimension souhaitée plus
grande reste une intention documentée, jamais une fausse résolution annoncée.
