# Remise à plat — quel modèle sur quelle tranche

> Compagnon de [PLAN-remise-a-plat.md](PLAN-remise-a-plat.md). Il ne change ni le contenu ni
> l'ordre des tranches : il dit seulement avec quel modèle et quel niveau de réflexion chacune
> se prend.
>
> Le classement est fait sur ce que la tranche demande **au moment de l'écrire**, pas sur sa
> valeur ni sur sa taille. Ces noms de modèles sont ceux de la grille du skill, pas une
> affirmation qu'ils sont disponibles.

## Les cinq étiquettes

| Étiquette | Modèle | Réflexion | Le critère d'entrée |
|---|---|---|---|
| `[VERY-EASY]` | Haiku 4.5 | faible | la forme existe déjà ailleurs et se recopie ; on peut décrire le résultat exact avant de commencer ; aucune décision |
| `[EASY]` | Sonnet | faible | montre des données existantes par des routes existantes ; ni schéma, ni invariant, ni algorithme |
| `[MEDIUM]` | Sonnet | élevée | une règle métier neuve, une route neuve, ou un algorithme standard et nommé |
| `[HARD]` | Opus | moyenne | change une forme de données ; **ou** pose un invariant dont d'autres tranches héritent ; **ou** touche à l'argent, à un secret, au disque de l'utilisateur ; **ou** c'est un sous-système qui n'existe nulle part |
| `[VERY-HARD]` | Opus | max | traverse plusieurs couches à la fois **et** doit faire passer un corpus d'essais existant sans qu'une assertion bouge |

---

## Mesures avant classement

Relevées dans le dépôt le 13 septembre 2026, pas déduites du plan.

| Ce qui a été mesuré | Le chiffre |
|---|---|
| Lignes des écrans touchés | toile 2 844 · règles du jeu 1 906 · montage 1 456 · galerie 1 438 · ce qui part 1 430 · clip 1 436 · famille 1 182 · fiche longue 1 070 · découpe 927 · sortie 664 · comparer 609 |
| Les petits | grille d'assets 144 · livraison 157 · objectif 169 · import intelligent 142 · import pour un sujet 89 · fiche courte 80 · choix d'image pour équipement 71 · brouillon 65 · grille de choix d'image 63 · aiguillage de fabrication 47 |
| Essais qui verrouillent le comportement touché | toile 39 + 51 mentions dans la grande suite · règles du jeu 25 · famille 22 + 6 · comparer 9 · import pour un sujet 6 · grille d'assets 4 · galerie 53 mentions · univers 51 mentions |
| Écrans **sans aucun essai propre** | fiche longue, fiche courte, découpe, import intelligent, grille de choix d'image, choix d'image pour équipement, galerie |
| Ce que le serveur sait déjà faire | ajouter une attitude : route écrite · filtrer la bibliothèque : **côté serveur par décision explicite**, et sans paramètre de tri · conflits de livraison : deux raisons en dur, aucune décision par fichier |
| Ce qu'il faut ajouter au serveur | un tri et deux filtres sur la route de la grille · une décision par conflit de livraison · rien d'autre |

**Deux mesures changent un classement à elles seules.** La route de la bibliothèque filtre
**côté serveur par décision écrite dans le code** — « la recherche doit porter sur toute la
bibliothèque, pas sur les deux cents assets qu'un navigateur a en mémoire ». Trier et grouper
la galerie n'est donc pas un travail d'écran. Et l'écran de livraison n'a pas de décision par
fichier **parce que le serveur n'en a pas** : il calcule `prêt = aucun conflit`, et c'est cette
ligne-là qu'il faut ouvrir.

---

## Les 18 tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **RP1** · Retirer ce qui est mort | `[EASY]` | chaque mort est déjà prouvé, fichier et ligne, par le relevé des écrans — il reste à retirer et à faire passer les suites |
| **RP2** · Rendre les quatre règles du jeu | `[HARD]` | la coque à onglets est mécanique, mais l'onglet *Agent MCP* rebranche le seul écran qui **borne la dépense de l'agent** — plafond en appels, plafond en argent, droit de payer |
| **RP3** · Fermer le vocabulaire de l'ossature | `[MEDIUM]` | renommer est mécanique, mais la liste fermée qui l'empêche de redériver est une règle neuve |
| **RP4** · Une seule préparation, une seule relecture | `[VERY-HARD]` | huit fenêtres et l'aiguillage, plus de 5 000 lignes, quatre types de résultat, l'argent — et la grande suite d'écran doit passer sans qu'une assertion bouge |
| **RP5** · Un seul écran d'import sur une fiche | `[MEDIUM]` | deux petits fichiers, mais la règle de ce qui est demandé et quand est neuve, et six essais la verrouillent |
| **RP6** · Une seule grille de choix d'image | `[EASY]` | les deux grilles lisent la même route avec les mêmes filtres ; aucun schéma, aucun invariant neuf |
| **RP7** · Une seule grille d'assets | `[HARD]` | 1 326 lignes, 28 essais, **deux types de glisser incompatibles**, et l'invariant « une seule grille » à rendre vrai |
| **RP8** · Une seule fiche de sujet | `[MEDIUM]` | 1 150 lignes sans un seul essai propre, et trois réglages qui partent dans chaque demande |
| **RP9** · La toile donne du travail | `[HARD]` | la sélection multiple change ce qu'une carte de toile porte, sur l'écran le plus gros du produit, verrouillé par 90 essais |
| **RP10** · La livraison décide au lieu de bloquer | `[HARD]` | une décision par conflit est une forme de données neuve côté serveur, et elle écrit dans le dossier du jeu |
| **RP11** · La galerie se trie, se filtre et se regroupe | `[MEDIUM]` | le tri et les deux filtres s'ajoutent à une route existante ; le regroupement est un algorithme nommé |
| **RP12** · Comparer deux versions d'une animation | `[MEDIUM]` | l'écran de comparaison existe et les lecteurs d'animation aussi ; la règle de cadence est déjà posée depuis B12 |
| **RP13** · Déclarer un mouvement là où on le regarde | `[EASY]` | la route qui ajoute une attitude est écrite ; il reste à la brancher et à corriger un renvoi qui mène au mauvais écran |
| **RP14** · La découpe se règle | `[MEDIUM]` | 927 lignes sans essai propre, mais nommer, déplacer et défaire des rectangles est un algorithme standard |
| **RP15** · Le cadre du montage se règle | `[MEDIUM]` | six champs dans un écran de 1 456 lignes, plus la règle de qui l'emporte entre la mesure et la main |
| **RP16** · Savoir ce qu'on a laissé en plan | `[MEDIUM]` | rassembler des brouillons écrits par écran demande un index, et le compteur de la colonne compte aujourd'hui une seule famille |
| **RP17** · Une seule porte pour sortir un personnage | `[HARD]` | elle écrit dans le dossier du jeu et retire des routes que l'agent peut emprunter |
| **RP18** · Les neuf routes sans écran | `[MEDIUM]` | neuf décisions séparées, chacune petite ; c'est la décision qui est le travail, pas l'écriture |
| **RP19** · L'image de référence d'une fiche se choisit | `[HARD]` | un champ de plus sur le sujet, écrit dans son dossier — une forme de données change —, et la règle qui le distingue de l'artwork officiel et de l'image retenue ; l'écran, lui, descend d'un cran |
| **RP20** · Enregistrer sous | `[HARD]` | crée un asset sur le disque à partir d'un rendu, écrit une filiation neuve, vaut pour l'image et pour la bande, et ouvre un outil à l'agent |
| **RP21** · Une planche découpée sur la toile devient une animation | `[MEDIUM]` | la route qui anime une feuille existe ; il reste à l'ouvrir aux cartes de la toile et à écrire le chemin sélection → montage, une route neuve |
| **RP22** · Une table se défait, se remet à zéro, et se voit avant d'enregistrer | `[MEDIUM]` | la bascule et l'aperçu à chaque geste existent sur l'établi ; il reste à les porter dans l'atelier d'une animation, à trouver pourquoi l'aperçu n'y suit pas la recette, et à expliquer une section depuis le recueil — une règle d'écran, pas de données |

**Compte** : 1 `[VERY-HARD]`, 7 `[HARD]`, 11 `[MEDIUM]`, 3 `[EASY]`, 0 `[VERY-EASY]`.

Huit tranches sur vingt-deux sont en `[HARD]` ou au-dessus — un peu plus d'un tiers. RP2 y
est montée après coup : en tranchant le point dur de RP1, on a découvert que l'onglet *Agent MCP*
rebranche le seul écran qui borne la dépense de l'agent. Une tranche qui touche à l'argent est
`[HARD]`, quelle que soit sa taille. RP19 et RP20, ajoutées le 15 septembre 2026, y sont pour
la même raison de forme : elles écrivent une donnée neuve dans le dossier du jeu.

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| ~~**RP1**~~ | ~~Décider si le cadre de l'agent que portait l'écran mort a un remplaçant ailleurs~~ | **tranché le 13 septembre 2026, avant d'ouvrir la tranche** : il n'en a pas, il ne part pas, et RP2 le rebranche |
| **RP3** `[MEDIUM]` | Écrire la liste fermée des noms — c'est elle que toutes les tranches d'après héritent | Opus, réflexion moyenne |
| **RP5** `[MEDIUM]` | Décider quand la pose et la direction se demandent, et quand elles se déduisent | Opus, réflexion moyenne |
| **RP11** `[MEDIUM]` | Le contrat de tri et de regroupement sur la route de la grille unique, qui sert aussi l'agent | Opus, réflexion moyenne |
| **RP12** `[MEDIUM]` | La règle du temps commun à deux cadences différentes, sans toucher à ce qui sort à l'export | Opus, réflexion moyenne |
| **RP14** `[MEDIUM]` | Ce qui voyage et ce qui ne voyage pas — l'invariant « une coordonnée ne voyage pas » tient dans les deux sens | Opus, réflexion moyenne |
| **RP16** `[MEDIUM]` | La forme de l'index des brouillons : ce qu'un brouillon porte pour être retrouvé depuis un tiroir | Opus, réflexion moyenne |
| **RP18** `[MEDIUM]` | Les neuf décisions elles-mêmes — construire ou retirer, une par route | Opus, réflexion moyenne |

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| **RP4** `[VERY-HARD]` | Reporter les libellés et le format de prix des huit fenêtres dans la fenêtre unique, une fois sa forme arrêtée | Sonnet, réflexion faible |
| **RP4** `[VERY-HARD]` | Écrire les essais des quatre types de résultat d'après les critères déjà rédigés | Sonnet, réflexion faible |
| **RP7** `[HARD]` | Remplacer le second type de glisser par le premier, une fois le type retenu décidé | Sonnet, réflexion faible |
| **RP9** `[HARD]` | Brancher *Mettre en réserve* et *Effacer la sélection* sur la sélection, une fois qu'elle existe | Sonnet, réflexion faible |
| **RP10** `[HARD]` | Poser les trois boutons et leurs libellés, une fois la décision par conflit écrite côté serveur | Sonnet, réflexion faible |
| **RP17** `[HARD]` | Retirer les routes et leurs essais, une fois la porte unique décidée et éprouvée | Sonnet, réflexion faible |
| **RP2** `[MEDIUM]` | Brancher les trois autres onglets sur les écrans qui existent déjà | Sonnet, réflexion faible |
| **RP3** `[MEDIUM]` | Appliquer la liste fermée écran par écran, une fois qu'elle est écrite | Haiku 4.5, réflexion faible |
| **RP19** `[HARD]` | Le geste sur l'image et l'affichage sur la fiche, une fois le champ et sa route écrits | Sonnet, réflexion faible |
| **RP20** `[HARD]` | L'écran qui demande la case d'arrivée, et le bouton dans les deux ateliers, une fois la route et la filiation écrites | Sonnet, réflexion faible |

---

## Les règles qui priment sur le tableau

1. **Le relecteur est toujours le plus gros modèle**, quelle que soit l'étiquette de la
   tranche. Son travail est de confronter des fichiers entre eux ; c'est exactement ce qu'un
   modèle plus petit rate. Sur ce plan-ci, c'est doublement vrai : cinq tranches fusionnent
   deux écrans, et une capacité perdue dans une fusion ne se voit pas.
2. **Ce qui touche au modèle de données passe avant l'écran qui l'affiche**, et c'est la partie
   données qui porte l'étiquette. L'écran qui suit descend souvent d'un cran — c'est le cas de
   RP10 et de RP11.
3. **Une tranche `[HARD]` ou `[VERY-HARD]` se découpe avant d'être confiée.** Le gros modèle
   sert à poser la décision et l'invariant ; ce qui en découle repart plus bas.
4. **Un point dur qui monte se traite en sous-agent, pas en changement de session.** La
   session qui tient la tranche l'appelle avec le modèle imposé par le point dur, sur un prompt
   autonome et étroit ; elle continue elle-même le reste.
5. **Propre à ce plan** : une tranche de fusion nomme la liste des gestes des deux côtés avant
   de commencer, et la coche à la fin. Cette liste se relit par le plus gros modèle, pas par
   celui qui a écrit la fusion.
