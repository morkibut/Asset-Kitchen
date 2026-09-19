# P2 — une planche de huit objets, huit tirages payés

**19 septembre 2026. Coût : 0,143 $** (8 × 0,017882 $, le prix réel de chaque appel).

## En une phrase

**Le mécanisme tient : 64 cases sur 64 ont le bon objet, à la bonne place, rangé chez le bon
sujet, et aucune n'a été marquée « à vérifier ».** Un risque réel est apparu sur la dernière
ligne, incomplète, et un autre, déjà connu, vient de la palette du jeu.

## Ce qui est parti

- **Modèle** : le défaut du jeu pour les objets. La forêt magique n'en règle aucun pour cette
  famille, c'est donc celui du produit : `OpenRouter:openai/gpt-image-2`, qualité basse.
- **Texte** : l'univers de la forêt magique, la phrase d'ensemble de l'écran
  (« A set of separate game items. »), puis la liste numérotée « cell 1: … cell 8: … ».
- **Une image jointe** : la grille vide, 3 colonnes × 3 lignes, 8 cases à remplir.
- **Les huit objets, dans l'ordre** : potion, clé, bourse, champignon bleu lumineux, parchemin
  scellé, dague elfique, lanterne, coffre. Cinq objets tenus ou posés, un meuble.

L'atelier de l'auteur n'a pas été touché. Le banc monte un atelier à part, avec une copie de
l'univers et sans les sujets du jeu : `essais/banc_planche_objets.py` (`preparer`, gratuit, puis
`payer 8`).

## Case par case

| | Bon objet | À sa place | Marquée « à vérifier » |
|---|---|---|---|
| Tirages 1 à 8, cases 1 à 8 | **64 / 64** | **64 / 64** | **0**, et c'est juste : aucune case ne le méritait |

Aucun objet n'a été mélangé, dédoublé ou oublié. La liste numérotée suffit à ce modèle, sur huit
sujets différents. Les huit planches gardent le même style, sans quadrillage dessiné.

**Le fond** : l'univers demande un fond rose `#FF70B5`, la consigne de planche un fond gris clair.
Les deux partent ensemble. Le modèle a suivi le gris huit fois sur huit, et le détourage l'a pris
sans difficulté.

## Le risque trouvé : la dernière ligne incomplète

Avec 8 objets sur une grille de 9, **le modèle recentre la dernière ligne une fois sur deux**
(tirages 1, 2, 7, 8) au lieu de laisser la case 9 vide. Le découpage range chaque morceau selon
la case qui contient son centre. Il a eu raison 64 fois, mais parfois de très peu. Voici la
distance entre le centre du coffre et la frontière de sa case, sur une planche de 1024 px :

| Tirage | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Coffre (case 8) | 103 | **1** | 167 | 162 | 163 | 165 | 38 | 28 |

Ailleurs, les objets sont à 130–170 px de leur frontière. **Au tirage 2, le coffre était à un
pixel de passer dans la case 9**, qui n'existe pas dans la liste. Tant qu'on commande un nombre
d'objets qui ne remplit pas la grille, ce risque demeure.

**Tranché par l'auteur le 19 septembre 2026 : ranger par ordre de lecture.** Quand une planche à
plusieurs objets revient avec autant de morceaux que d'objets, le n-ième morceau (de gauche à
droite, de haut en bas) va au n-ième objet, même s'il déborde de sa case. L'autre piste, ne
proposer que 4, 6 ou 9 objets, est écartée.

## Ce que devient un objet une fois rangé

Chaque morceau sort en 96 × 96, entier, sans rien de coupé. Mais **le champignon bleu devient
blanc-vert** dans les huit tirages : la palette de la forêt magique n'a aucun bleu, et chaque
image y est ramenée. Ce n'est pas propre à P2 : c'est le risque déjà ouvert « la quantification
reste liée à la palette » (`docs/PLAN.md`, *Les trois risques encore ouverts*). Ici, il a fait
perdre à un objet ce qui le distinguait.

## L'écran partait sans réglage — corrigé

L'écran « Commander plusieurs objets » envoyait `options: {}` et prenait le premier modèle de la
liste, alors que la barre principale applique le défaut (`interface/src/App.tsx`, `defaut.options`).
Une planche lancée depuis l'écran partait donc sans « qualité basse », à la qualité que le
fournisseur choisit, et pas forcément sur le modèle du jeu. **Corrigé le même jour** : l'écran
demande au serveur le défaut d'une planche (le modèle de planche du jeu, sinon celui du produit)
et envoie ses réglages avec.

## Rangement par ordre de lecture — codé

`_ordre_de_lecture` dans `atelier/services/pliage.py`. Il ne joue que si le calage par centre a
raté **et** qu'il revient autant de morceaux que de cases, rangée par rangée. Sa limite : dans une
même rangée, un objet coupé en deux à côté d'une case vide fait le bon compte, et se range de
travers. C'est le geste « ce n'est pas le bon objet » qui le reprend.

## Où sont les images

`essais/resultats/planche-objets/` (non versionné) : `t1-planche.png` à `t8-planche.png`, les
morceaux `tN-r100.png` à `tN-r107.png`, `releve.json`, `envoi.json` (le texte exact) et
`planche-des-morceaux-t1-t2-t7-t8.png`.
