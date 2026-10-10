# Relevé du 10 octobre 2026 — lot 1 de Cœur de Pierre : les huit parois

> Ce que gag2 a fait, et ce qu'il n'a pas su faire, en produisant les **huit murs bloquants**
> de Cœur de Pierre (`wall_lave_0/1/2/rubble`, `wall_abime_0/1/2/rubble`, 64 × 64). Premier lot
> où le jeu se sert de gag2 à la place de SpriteCook. Rien de payant : tout en local.

## Le chemin pris

| Étape | Ce qui a servi |
|---|---|
| Référence | une paroi des Galeries (déjà au langage « dessus + face verticale »), agrandie en 512 et versée dans le projet `coeur-de-pierre-01` |
| Génération | **FLUX.2 Klein · Tuiles et décors**, sur ComfyUI local, la référence en rôle **édition** : « garde la même découpe, change seulement la matière » |
| Texte | `brut` + `repris` : seul le texte écrit part, sans l'univers du jeu (voir défaut 3) |
| Sortie | le brut 512 copié côté jeu, raccordé gauche-droite et réduit en 64 par le script d'import du jeu |

**Le geste qui marche est l'édition d'une paroi qui fait déjà foi.** Elle garde l'arête à la même
hauteur sans avoir à le demander deux fois — c'était le réglage qui avait coûté une reprise chez
SpriteCook.

`TU14` (mur vertical) n'a pas servi : elle vise l'atlas vu de dessus des « Tuiles », pas une case
de 64 qui porte à la fois le dessus et la face. Le format du jeu n'a pas de place dans gag2 aujourd'hui.

## Les défauts rencontrés

| # | Défaut | Gravité | Suite |
|---|---|---|---|
| 1 | **Un ComfyUI redémarré bloque toute la file locale.** Une étape soumise avant le redémarrage reste « à reprendre » ; l'annulation est refusée (« calcul déjà lancé ») et la reprise attend 30 min un travail que ComfyUI a oublié. Seize tirages sont restés bloqués derrière, sans que la génération le dise (elle affichait « en cours », durée attendue 20 s). | bloquant | **corrigé** sur `fix/comfy-redemarre-file-locale` : absent de la file *et* de l'historique, le travail échoue tout de suite. L'étape du jour a été marquée échouée à la main pour débloquer. |
| 2 | **« Tuiles et décors raccordables » fait planter ComfyUI** (`CircularVAEDecode` : `CUDA error: invalid argument`, carte de 8 Go). C'est la panne qui a déclenché le défaut 1. | bloquant pour ce modèle | non corrigé : à griser, ou à mesurer à une autre résolution. Le raccord est fait côté jeu à la place. |
| 3 | **Pas de cadrage « tuile pleine » pour une image fixe.** Sans `brut` + `repris`, l'appel ajoute « single isolated sprite on a flat background », « subject centred », « 4-directional orientation » et une caméra de personnage — l'inverse d'une texture bord à bord. Seule la toile connaît ce couple de drapeaux ; l'écran d'image ne l'offre pas. | gêne forte | à cadrer : une nature « tuile / texture » qui retire cadre, fond et caméra |
| 4 | **Le négatif du fond part quand même en `brut`** : « the background colour #00FFFF cyan… on the subject » sur une tuile sans fond. | mineur | **laissé tel quel, et ce n'est pas un oubli** : le même fond sert à poser les références et à détourer ensuite ; le retirer en `brut` toucherait la toile. À trancher avec le défaut 3. |
| 5 | ~~Le temps annoncé est faux~~ — **corrigé à la relecture : ce n'est pas un défaut de l'écran.** L'API rend à la fois la phrase du style (« 1 à 3 minutes ») et la médiane mesurée (≈ 5 min) ; l'écran montre la mesure dès qu'il en a une (`api-workflows.ts`). Reste que la phrase de repli de Klein est optimiste pour « Tuiles » en 512, et que la case affichait « 20 s » tant qu'elle attendait derrière une étape bloquée. | mineur | — |
| 6 | **Une génération « interrompue » finit « réussie »** : la session précédente a été arrêtée, ses générations sont passées « interrompue », puis leurs étapes ont tourné et elles sont devenues « réussie ». Le mot ment pendant une heure. | moyen | à relire avec la file locale |
| 7 | **Aucune mesure d'arête ni de raccord pour une image fixe.** La hauteur d'arête et le raccord gauche-droite se vérifient côté jeu, à la main. | manque | voir § Ce qui manque |

| 8 | **Les sols vus de dessus sortent moins bien que les murs.** Sur quatre gravats édités depuis les gravats des Galeries : un cadre dessiné sur les bords (`80022dfc`), un centre plus clair qui fait damier au pavage (`7feb670b`), des traînées qui forment un quadrillage (`1297ba39`). Le modèle « Tuiles » n'a pas tenu « edge to edge, no border » une fois sur quatre. | moyen | rien dans gag2 ne montre la case pavée avant de garder : c'est la planche du jeu qui l'a vu |

## Ce que le lot a coûté

Seize tirages en 512, **0 $**, de 5 min à 5 min 25 chacun sur la carte de 8 Go : 1 h 25 de calcul,
plus 20 min de file bloquée (défaut 1). Retenus : 3 murs de lave sur 6, revue de l'auteur entre
chaque groupe ; il a écarté un mur trop sombre **en le voyant en rangée**, pas seul — c'est la
rangée qui juge une paroi.

## Ce qui manque pour que gag2 fasse ce lot seul

- **Voir la case répétée avant de la garder** : trois côte à côte pour une paroi, 3 × 3 pour un
  sol. C'est ce qui a fait écarter un mur et trois gravats sur quatre.

- **Une nature « case de paroi »** : dessus + arête + face jusqu'au noir, raccord gauche-droite
  seulement, arête alignée sur une référence. Aujourd'hui c'est une édition d'image fixe plus un
  script du jeu.
- **Le raccord à la livraison**, puisque le modèle raccordable plante : fondre une bande d'un bord
  dans l'autre est déterministe et ne coûte rien.
