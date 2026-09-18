# V3.5 — Le dépliage généralisé — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN.md` § « V3.5 — Le dépliage généralisé ». Il ne change ni le contenu ni
> l'ordre des tranches : il dit seulement avec quel modèle et quel niveau de réflexion chacune se
> prend.
>
> Le classement est fait sur ce que la tranche demande **au moment de l'écrire**, pas sur sa
> valeur ni sur sa taille.

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

Relevées dans le dépôt le 18 septembre 2026.

| Ce qui a été mesuré | Le chiffre |
|---|---|
| Critères de P1 déjà tenus | 3 sur 10 — le dépliage automatique, la reprise au redémarrage, le réseau coupé |
| Critères de P1 à moitié tenus | 3 — le découpeur manuel existe, mais ne repart pas des coupes du pliage ; le lien image → planche n'existe que pour les découpes à la main |
| Formes de données à changer | deux : la grille de la planche (aujourd'hui recalculée depuis le nombre de cases, jamais enregistrée) et un dépliage identifié, qui n'existe nulle part |
| Ce qui lit la grille recalculée | une formule, sept fichiers de production, quatre fichiers d'essai |
| Essais qui verrouillent le pliage et la découpe | une douzaine de fichiers, environ 180 essais ; **un seul** verrouille la déduction que P1 supprime, et il se réécrit |
| Le disque de l'utilisateur | supprimer une planche efface aujourd'hui le fichier dont le dépliage a besoin, sans compter ce qui en dépend |

---

## Les 2 tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **P1** · La planche se garde, et son découpage se refait | `[HARD]` | Deux formes de données neuves et une suppression qui touche aux fichiers de l'utilisateur. |
| **P2** · Une planche pour plusieurs choses | `[HARD]` | Lève l'invariant « une planche, une seule chose » posé en `E13`, dont le rangement hérite. |

**Compte** : 0 `[VERY-HARD]`, 2 `[HARD]`, 0 `[MEDIUM]`, 0 `[EASY]`, 0 `[VERY-EASY]`.

*Deux tranches sur deux en `[HARD]` dépassent le tiers ; c'est la taille de la version, pas une
grille trop généreuse : les deux sont découpées ci-dessous, et le gros modèle n'y garde que les
décisions.*

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| P2 | Les trois questions ouvertes du plan (une case ratée, huit sujets en un texte, la frontière avec les tuiles) | **décision de l'auteur**, avant tout code |

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| P1 | Faire lire la grille enregistrée aux sept fichiers qui la recalculent, une fois la forme posée | `[MEDIUM]` — Sonnet, réflexion élevée |
| P1 | L'écran « refaire le dépliage », qui reprend l'éditeur de rectangles du découpeur, prérempli des coupes | `[MEDIUM]` — Sonnet, réflexion élevée |
| P1 | Les essais des critères d'acceptation, déjà rédigés dans le plan | `[EASY]` — Sonnet |
| P2 | L'écran du prix par sujet à côté du prix de la planche | `[EASY]` — Sonnet |

---

## Les règles qui priment sur le tableau

1. **Le relecteur est toujours le plus gros modèle**, quelle que soit l'étiquette de la
   tranche. Son travail est de confronter des fichiers entre eux ; c'est exactement ce qu'un
   modèle plus petit rate.
2. **Ce qui touche au modèle de données passe avant l'écran qui l'affiche**, et c'est la partie
   données qui porte l'étiquette. L'écran qui suit descend souvent d'un cran.
3. **Une tranche `[HARD]` ou `[VERY-HARD]` se découpe avant d'être confiée.** Le gros modèle
   sert à poser la décision et l'invariant ; ce qui en découle repart plus bas.
4. **Un point dur qui monte se traite en sous-agent, pas en changement de session.** La
   session qui tient la tranche l'appelle via l'outil `Agent` avec le modèle imposé par le
   point dur, sur un prompt autonome et étroit ; elle continue elle-même le reste.
