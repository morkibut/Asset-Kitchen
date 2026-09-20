# Les retours du 20 septembre — quel modèle sur quelle tranche

> Compagnon de [`PLAN-retours-du-20-septembre.md`](PLAN-retours-du-20-septembre.md). Il ne change
> ni le contenu ni l'ordre des tranches : il dit seulement avec quel modèle et quel niveau de
> réflexion chacune se prend.
>
> Le classement est fait sur ce que la tranche demande **au moment de l'écrire**, pas sur sa
> valeur ni sur sa taille. Écrit le 21 septembre 2026, après mesure dans le dépôt — pas sur la
> lecture du plan seul.

## Les cinq étiquettes

| Étiquette | Modèle | Réflexion | Le critère d'entrée |
|---|---|---|---|
| `[VERY-EASY]` | Haiku 4.5 | faible | la forme existe déjà ailleurs et se recopie ; on peut décrire le résultat exact avant de commencer ; aucune décision |
| `[EASY]` | Sonnet | faible | montre des données existantes par des routes existantes ; ni schéma, ni invariant, ni algorithme |
| `[MEDIUM]` | Sonnet | élevée | une règle métier neuve, une route neuve, ou un algorithme standard et nommé |
| `[HARD]` | Opus | moyenne | change une forme de données ; **ou** pose un invariant dont d'autres tranches héritent ; **ou** touche à l'argent, à un secret, au disque de l'utilisateur ; **ou** c'est un sous-système qui n'existe nulle part |
| `[VERY-HARD]` | Opus | max | traverse plusieurs couches à la fois **et** doit faire passer un corpus d'essais existant sans qu'une assertion bouge |

---

## Ce que la mesure a donné

Quatre relevés faits dans le dépôt avant de classer, parce que le vocabulaire du plan aurait
menti dans les deux sens.

- **Le rendu d'aperçu n'est pas un sous-système neuf.** Douze routes d'aperçu existent déjà, et
  la forme est stable — on rend une image calculée sans rien enregistrer. `RT1` en ajoute une
  treizième. **Ce qui est neuf, c'est le cache**, et lui seul.
- **Le fond est plus verrouillé qu'il n'en a l'air** : 33 essais dans le seul fichier qui le
  couvre, et 13 fichiers d'essais qui passent un fond explicite. `RT3` les fera bouger — et
  c'est légitime, puisque la décision change.
- **L'étape de l'allure est tenue par 939 lignes d'essais**, la toile par 715, l'écran des sons
  par 140. Les trois tranches d'écran travaillent sous surveillance.
- **Le renommage en Codex est large mais plat** : 20 libellés hors essais, 20 dans les essais,
  aucun schéma, aucune route.

---

## Les neuf tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **RT1** · L'aperçu se calcule et se garde | `[MEDIUM]` | Une treizième route d'aperçu sur une forme déjà stable ; seul le cache est neuf, et il sort comme point dur. |
| **RT2** · Les trois rangées montrent | `[EASY]` | Montre des images rendues par une route qui existera, sans schéma ni invariant — l'écran suit les données. |
| **RT3** · Le fond se calcule | `[HARD]` | Change ce qui part au fournisseur, pose l'invariant dont `RT4` hérite, et renverse une décision datée qu'elle doit réécrire. |
| **RT4** · Le réglage du fond s'efface | `[EASY]` | Retrait d'une section d'écran et des fiches d'aide qui la décrivaient ; le résultat se décrit exactement d'avance. |
| **RT5** · L'étape se dégraisse | `[MEDIUM]` | Aucune donnée ne bouge, mais chaque phrase se juge une par une, et le guide doit rester d'accord avec l'écran. |
| **RT6** · Le garde-fou reparaît | `[MEDIUM]` | Une règle métier neuve : à quelle condition l'avertissement se déclenche, et combien d'images il annonce. |
| **RT7** · Une note se corrige | `[EASY]` | Le serveur sait déjà le faire ; la tranche branche un champ existant sur un écran existant. |
| **RT8** · « Les sons » rentre dans l'atelier | `[MEDIUM]` | La forme se recopie du voisin, mais elle passe par le routage central de l'application et par le guide, tout juste réparé. |
| **RT9** · Les sujets deviennent le Codex | `[VERY-EASY]` | Quarante libellés, aucune décision : le résultat exact s'écrit avant de commencer. |

**Compte** : 0 `[VERY-HARD]`, 1 `[HARD]`, 4 `[MEDIUM]`, 3 `[EASY]`, 1 `[VERY-EASY]`.

*Contrôle de vraisemblance : une tranche sur neuf en `[HARD]` ou au-dessus. La grille n'a pas été
appliquée trop généreusement.*

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| **RT1** | La clé du cache et sa péremption — de quoi un aperçu est la fonction, et ce qui le rend faux | Opus, réflexion moyenne |
| **RT5** | Arbitrer quelle information est vitale et laquelle embrouille, phrase par phrase | Opus, réflexion moyenne |
| **RT8** | Décider ce que devient l'écran des sons quand on le quitte, et d'où l'on y revient | Sonnet, réflexion élevée |

**Le point dur de `RT1` n'est pas théorique.** Le dépôt porte déjà le piège, écrit le 20 septembre
2026 : *l'index jetable se périme à un changement de schéma*. Un aperçu gardé sur le disque pose la
même question, et se trompe de la même façon.

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| **RT3** | Une fois la source et le repli décidés : reporter le changement sur les 13 fichiers d'essais qui passent un fond, et sur les 33 essais du fond lui-même | Sonnet, réflexion faible |
| **RT3** | Écrire les essais du nouveau comportement d'après les critères d'acceptation, déjà rédigés | Sonnet, réflexion faible |
| **RT5** | Une fois tranché ce qui part : le retrait lui-même, et la reprise des fiches d'aide correspondantes | Sonnet, réflexion faible |
| **RT6** | Une fois la condition de déclenchement posée : l'écran de l'avertissement et son texte | Sonnet, réflexion faible |

---

## Ce qui n'est pas dans le tableau, et qu'il faut savoir

- **`RT3` fait payer un prix qui n'est pas en jetons.** Elle change ce qui part au fournisseur, donc
  elle invalide les comparaisons avec les tirages déjà payés. C'est écrit dans le plan et dans le
  code ; ce n'est pas une affaire de modèle, mais ça se décide avant de la lancer.
- **`RT9` fera tomber une vingtaine d'essais d'un coup.** C'est le renommage, pas une régression. La
  session qui la prend doit le savoir avant de voir le rouge, sans quoi elle cherchera un bug qui
  n'existe pas.
- **`RT2`, `RT4` et `RT5` touchent le même fichier d'écran.** Elles ne se lancent pas en parallèle
  sur la même branche.
- **`RT7`, `RT8` et `RT9` sont indépendantes et sur trois fichiers différents.** Ce sont les trois
  qui peuvent partir ensemble.

---

## Les règles qui priment sur le tableau

1. **Le relecteur est toujours le plus gros modèle**, quelle que soit l'étiquette de la tranche.
   Son travail est de confronter des fichiers entre eux ; c'est exactement ce qu'un modèle plus
   petit rate.
2. **Ce qui touche au modèle de données passe avant l'écran qui l'affiche**, et c'est la partie
   données qui porte l'étiquette. L'écran qui suit descend souvent d'un cran — c'est le cas de
   `RT1` devant `RT2`, et de `RT3` devant `RT4`.
3. **Une tranche `[HARD]` se découpe avant d'être confiée.** Le gros modèle sert à poser la
   décision et l'invariant ; ce qui en découle repart plus bas — voir les deux lignes de `RT3`
   au tableau des descentes.
4. **Un point dur qui monte se traite en sous-agent, pas en changement de session.** La session qui
   tient la tranche l'appelle avec le modèle imposé par le point dur, sur un prompt autonome et
   étroit ; elle continue elle-même le reste.
