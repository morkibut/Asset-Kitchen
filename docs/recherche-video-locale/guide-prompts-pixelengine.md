# Bien écrire un prompt d'animation — ce que dit Pixel Engine

> Source : [pixelengine.ai/guides/animate](https://pixelengine.ai/guides/animate), relevé le 12
> septembre 2026. Pixel Engine est un concurrent direct de `PixelLab` et `SpriteCook` — un
> [[etalon-qualite|étalon de qualité]] pour ce que doit produire notre propre pipeline
> image→vidéo (Wan 2.2, cf. `docs/recherche-video-locale/rapport.md`).
>
> **Ce document ne décide rien sur le produit.** Il rassemble une bonne pratique externe pour
> nourrir, plus tard, une aide à l'écriture du prompt dans l'atelier (un futur bouton
> « Améliorer le prompt », à l'image du leur).

---

## L'idée centrale

Un bon prompt d'animation est **dense dans le temps, factuel, centré sur le mouvement**. Il
décrit toute la séquence — ce qui se passe d'abord, ensuite, et comment ça finit — jamais
l'ambiance ni l'apparence (ça, c'est le rôle de l'image de référence, pas du prompt).

**Structure recommandée :**

```
état de départ → action avec des transitions ("commence par…", "puis…", "alors que…") → conclusion (retour au repos, boucle, effondrement…)
```

Trois mots de liaison à retenir : **"begins by" (commence par), "then" (puis), "as they" (alors
que)**. Ils enchaînent les mouvements dans l'ordre où ils doivent apparaître.

## Faible vs détaillé — deux exemples de la page

Un prompt de deux mots ne suffit jamais : le modèle doit deviner la forme exacte du mouvement, et
il devine mal.

**Sort de mage**
- Faible : *« the wizard casts a spell »* — pas absurde, mais le modèle doit imaginer à quoi
  ressemble « un sort ».
- Détaillé : *« from a standing position. the blue wizard raises his staff above his head.
  energy accumulates around the staff before a ball of yellow light fires from the staff. The
  wizard then lowers the staff back down to his neutral starting position »*

**Coup de poing**
- Faible : *« punch animation »* — le modèle ne sait ni quel type de coup, ni quel bras, ni
  comment le personnage doit récupérer.
- Détaillé : *« Facing right in a boxing stance with purple gloves and blue trunks, the boxer
  begins by snapping his lead left arm forward in a rapid, straight motion to execute a quick
  jab. As the fist reaches full extension, a small white impact spark appears at the tip, then
  the boxer swiftly pulls his arm back to his face. The sequence concludes as he returns to his
  original defensive guard with his knees slightly bent. »*

Ce qui fait la différence entre les deux, à chaque fois : **position/orientation de départ →
mécanique précise du mouvement (quel membre, quelle trajectoire) → effet visuel si pertinent
(étincelle, traînée) → état de récupération explicite**.

## La pose de départ fait partie du prompt

L'image de référence compte comme une partie du prompt, pas seulement le texte. Demander une
course à un personnage debout et statique force le modèle à d'abord sortir de cette pose figée —
et le résultat en pâtit. Le modèle généralise ce qu'il peut, mais une pose de départ cohérente
avec l'action demandée aide dans la majorité des cas.

*(Exemples de la page : un loup au galop rendu depuis une pose debout vs. une pose déjà en
action ; un chevalier en marche, même comparaison — dans les deux cas la pose d'action donne un
cycle plus fluide et plus crédible.)*

## Laisser de la place au personnage

L'espace autour du personnage dans l'image de référence est un indice visuel : le modèle l'utilise
pour placer le mouvement. Un cadrage trop serré comprime l'animation et la rend statique sur
place ; plus d'espace permet au personnage de se projeter, avancer, remplir le cadre.

*(Exemples : un démon qui frappe avec une traînée de mouvement — comprimée si l'espace manque,
étalée si l'espace est là ; un cactus qui sautille sur place vs. qui bondit dans l'espace
disponible.)*

**Application directe à l'atelier** : avant d'envoyer un prompt d'animation, vérifier que le
cadrage de la base laisse de la marge dans la direction du mouvement demandé — sinon le prévenir
à l'auteur plutôt que de laisser le résultat le décevoir.

## Le nombre d'images (frames) change tout

Un même prompt, sur la même image, peut donner un résultat très différent selon le nombre
d'images demandées. Sur l'exemple d'un coup d'épée testé de 4 à 16 images, 10 était le meilleur
compromis pour cette animation précise ; 4 et 16 étaient les deux pires.

**Repères de départ par type d'action** (ce sont des points de départ, pas des règles — à ajuster
au cas par cas) :

| Action | Images |
|---|---|
| Attaque | 8–12 |
| Idle (repos) | 4–8 |
| Course | 4–8 |
| Marche | 6–8 |
| Mort | 6–8 |

## Le nombre de couleurs — un plafond, pas une cible

Le réglage « Colors » fixe un **maximum** de couleurs après quantification, pas un objectif exact
— le modèle peut très bien utiliser moins.

- **Trop bas** : les couleurs proches fusionnent pour tenir la limite — ombrages fins, contours et
  reflets peuvent s'aplatir et disparaître.
- **Trop haut** : chaque image est quantifiée indépendamment, donc de petites variations de
  couleur d'une image à l'autre deviennent visibles — ça scintille.

**24 couleurs** est le défaut raisonnable pour un personnage pixel art. Descendre pour un rendu
rétro plus restreint ; monter un peu si le personnage a du détail fin qui se perd.

## Erreurs courantes à éviter

- Pose de départ qui ne correspond pas à l'action demandée (debout + demande de course).
- Personnage trop serré dans le cadre, sans marge pour le mouvement.
- Nombre d'images extrême dans un sens ou dans l'autre (voir tableau ci-dessus comme point de
  départ).
- Description d'action trop vague — deux ou trois mots ne suffisent jamais, le modèle comble le
  vide en devinant.
- Ne pas re-tirer : certaines animations sont plus dures que d'autres, 3 à 4 essais avec un prompt
  ou un nombre d'images légèrement différent est normal, pas un échec.

## Gabarit de prompt réutilisable

En reprenant la structure de la page, un prompt d'animation solide répond dans l'ordre à ces
questions :

1. **Position de départ** — orientation (face, profil, diagonale), posture, tenue/équipement
   visible si pertinent.
2. **Le déclencheur du mouvement** — quel membre ou quelle partie du corps initie, avec quelle
   qualité de geste (rapide, ample, brusque…).
3. **Le point culminant** — ce qui se passe au sommet du mouvement (extension complète, impact,
   apex du saut) et l'effet visuel qui l'accompagne si besoin (étincelle, traînée, flash).
4. **Le retour** — comment le personnage revient à un état stable : pose de garde, position
   neutre, ou boucle explicite vers la première image.

Un prompt qui ne coche que le point 1 (ou pire, rien) reproduit exactement les exemples « faibles »
ci-dessus.

## Pour plus tard — l'aide à l'écriture dans l'atelier

Pixel Engine propose un bouton « Enhance Prompt » qui reformule une idée brute en suivant cette
même structure. Le jour où l'atelier veut la même chose (probablement branché sur le champ
`eq-prompt` / le futur prompt d'animation évoqué dans `docs/PLAN-carnet.md`), ce document donne le
squelette de la reformulation à appliquer :

- détecter un prompt trop court ou sans verbe de transition → proposer le gabarit à 4 questions
  ci-dessus plutôt que de générer directement ;
- vérifier le cadrage de la base (espace disponible dans la direction du mouvement) avant l'envoi,
  et prévenir si le cadrage est serré ;
- proposer le nombre d'images du tableau ci-dessus comme valeur par défaut selon le mouvement
  choisi, modifiable ensuite par l'auteur.
