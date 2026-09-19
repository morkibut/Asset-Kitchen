# Les jeux de tuiles — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN-tuiles.md`. Il ne change ni le contenu ni l'ordre des tranches : il
> dit seulement avec quel modèle et quel niveau de réflexion chacune se prend.
>
> Le classement porte sur ce que la tranche demande **au moment de l'écrire**. Mesuré le
> 19 septembre 2026 : le cœur de sc-clone fait environ 7 500 lignes de JavaScript pur, couvertes
> par plus de 200 essais. AU13 tient en 6 essais serveur, dont un qui charge le paquet dans un
> vrai Godot, et en 2 essais d'écran.

## Les cinq étiquettes

| Étiquette | Modèle | Réflexion | Le critère d'entrée |
|---|---|---|---|
| `[VERY-EASY]` | Haiku 4.5 | faible | la forme existe déjà ailleurs et se recopie ; on peut décrire le résultat exact avant de commencer ; aucune décision |
| `[EASY]` | Sonnet | faible | montre des données existantes par des routes existantes ; ni schéma, ni invariant, ni algorithme |
| `[MEDIUM]` | Sonnet | élevée | une règle métier neuve, une route neuve, ou un algorithme standard et nommé |
| `[HARD]` | Opus | moyenne | change une forme de données ; **ou** pose un invariant dont d'autres tranches héritent ; **ou** touche à l'argent, à un secret, au disque de l'utilisateur ; **ou** c'est un sous-système qui n'existe nulle part |
| `[VERY-HARD]` | Opus | max | traverse plusieurs couches à la fois **et** doit faire passer un corpus d'essais existant sans qu'une assertion bouge |

---

## Les 14 tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **TUM** · La maquette des tuiles | `[HARD]` | Le parcours doit rester aussi léger que SpriteCook tout en branchant le vrai moteur. |
| **TU1** · Le moteur entre dans l'interface | `[MEDIUM]` | Une recopie avec ses essais. Le point délicat est la déclaration TypeScript et la garde de design. |
| **TU2** · Un jeu de tuiles est une recette | `[HARD]` | Change la forme d'un ensemble, dont TU3 à TU10 héritent, sans migrer ceux qui sont sur disque. |
| **TU3** · L'atelier du jeu de tuiles | `[HARD]` | Un lieu neuf dans la pile, un rendu en direct à mettre en cache, un chemin AU13 à garder intact. |
| **TU4** · Livrer à Godot les trois sortes | `[VERY-HARD]` | Traverse le domaine, l'export et un vrai Godot, sans qu'un essai d'AU13 bouge. |
| **TU5** · Les matières générées sur la machine | `[MEDIUM]` | Un portage de 159 lignes pures et une route sur la file locale existante. |
| **TU6** · Les mêmes couleurs | `[MEDIUM]` | Des algorithmes déjà écrits, à brancher sur la palette de l'univers. |
| **TU7** · Le mur | `[VERY-HARD]` | La scène, l'export, les collisions et le tri en profondeur, prouvés dans Godot à deux hauteurs. |
| **TU8** · Le décor autour des bords | `[MEDIUM]` | Une seconde couche, sur une pose par paires déjà écrite. |
| **TU9** · Vérifier avant de livrer | `[EASY]` | Montre le résultat d'un module déjà recopié, dans une relecture qui existe. |
| **TU10** · L'agent fabrique des tuiles | `[HARD]` | Un rendu côté serveur par Node, un sous-système neuf ; il ferme AU13. |
| **TU11** · La relecture croisée | `[HARD]` | Confronter des fichiers entre eux, c'est le travail du plus gros modèle. |

| **TU12** · Les deux champs se comprennent | `[EASY]` | Des repères, un exemple et une ligne de blocage plus précise, sur un écran et des routes qui existent ; rien ne part vers le serveur. |
| **TU13** · Une image de référence | `[MEDIUM]` | Le graphe à une référence et son raccord existent déjà : ce qui reste est du passage de paramètre, de l'écran à ComfyUI, plus la parité de l'agent. |

**Compte, les 14 tranches** : 2 `[VERY-HARD]`, 5 `[HARD]`, 5 `[MEDIUM]`, 2 `[EASY]`,
0 `[VERY-EASY]`.

*Ajout du 19 septembre 2026.* Les douze premières lignes ne sont pas reclassées : elles sont
closes, et leur étiquette est un jugement porté à l'écriture.


**Ordre et parallélisme.** TUM et TU1 partent ensemble, puis TU2. TU3 et TU4 partent ensuite
en parallèle : ils touchent des fichiers différents, l'écran d'un côté et l'export de l'autre.
TU5, puis TU6. TU7, puis TU8. TU9 peut partir dès TU3. Ensuite TU10, puis TU11.

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| TU1 | Rendre le moteur appelable sous vitest (jsdom ou canevas de Node) sans toucher à sa logique | `[HARD]` |
| TU3 | Le rendu en direct : où il tourne (fil principal ou worker), comment il se met en cache, et ce qui se passe à 64 px | `[HARD]` |
| TU5 | Le portage Python du texte composé, qui doit égaler `composerPrompt` au caractère près | `[HARD]` |
| TU10 | Lancer le moteur par Node depuis le serveur Python (shim de `document`, `peintrePixels`), et prouver l'égalité au pixel près | `[VERY-HARD]` |
| TU13 | Prouver que le raccord tient **avec** une référence, et qu'une génération interrompue rejoue l'image jointe au lieu de la redemander | `[HARD]` |

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| TU1 | La copie des fichiers et le `LISEZMOI` de provenance | `[VERY-EASY]` |
| TU2 | La nature « matière » dans la famille `decors` | `[EASY]` |
| TU3 | Le tiroir des matières intégrées, sur des vignettes que le moteur rend | `[MEDIUM]` |
| TU4 | Les écrivains de texte `.tres`, recopiés d'`exports.js` en Python une fois la forme posée | `[MEDIUM]` |
| TU7 | Le `LISEZMOI` des règles de pose | `[EASY]` |
| TU12 | Les repères des deux champs et l'exemple qui les remplit, une fois la paire d'exemples choisie | `[VERY-EASY]` |
| TU13 | La pose du choix d'image : la grille de choix du produit se réemploie telle quelle | `[EASY]` |

---

## Les règles qui priment sur le tableau

1. **Le relecteur est toujours le plus gros modèle**, quelle que soit l'étiquette de la
   tranche.
2. **Ce qui touche au modèle de données passe avant l'écran qui l'affiche.** TU2 passe avant
   TU3.
3. **Une tranche `[HARD]` ou `[VERY-HARD]` se découpe avant d'être confiée.** Le gros modèle
   pose la décision et l'invariant ; ce qui en découle repart plus bas.
4. **Un point dur qui monte se traite en sous-agent, pas en changement de session.**
