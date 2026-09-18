# Styles de combat — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN-styles-de-combat.md`. Il ne change ni le contenu ni l'ordre des
> tranches : il dit seulement avec quel modèle et quel niveau de réflexion chacune se prend.
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
| Le rangement par jeu avec bibliothèque de départ | **existe** depuis le commit `ba72f12`, pour les mouvements — il se recopie |
| La composition direction + texte | **existe** (`texte_du_clip`), appelée par deux routes |
| Formes de données à étendre | deux : le personnage et la pièce d'équipement ; un seul essai lit leur JSON en entier |
| Ce qu'un personnage porte en main | déjà connu : les calques de pièce rangés sur ses poses |
| Écrans touchés | Réglages › Univers (bloc des mouvements, 450 lignes), la fiche d'un sujet (558 lignes, **aucun essai propre**), le clip (déjà branché sur la composition) |

---

## Les 4 tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **SC1** · Le style, une donnée du jeu | `[MEDIUM]` | Un objet neuf, mais sur un rangement par jeu qui vient d'être écrit pour les mouvements et se recopie. |
| **SC2** · Le style d'un personnage et d'une pièce | `[HARD]` | Étend deux formes de données existantes et pose la règle de résolution dont SC3 et SC4 héritent. |
| **SC3** · Le texte qui part | `[MEDIUM]` | Une règle de composition de plus sur deux routes déjà branchées. |
| **SC4** · Les écrans | `[EASY]` | Montre et règle, par les routes des trois tranches précédentes, ce qu'elles ont posé. |

**Compte** : 0 `[VERY-HARD]`, 1 `[HARD]`, 2 `[MEDIUM]`, 1 `[EASY]`, 0 `[VERY-EASY]`.

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| SC1 | Écrire les textes livrés des dix styles : une action, la main, l'objet tenu, le retour en position, sans mot qui fasse bouger la caméra | `[HARD]` — Opus |
| SC4 | Placer le choix du style sur la fiche d'un sujet d'après la maquette validée, sans l'alourdir | `[MEDIUM]` — Sonnet, réflexion élevée |

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| SC2 | Les routes pour poser et retirer un style, une fois la règle de résolution écrite | `[MEDIUM]` — Sonnet |
| SC2 | Les essais des trois critères d'acceptation, déjà rédigés dans le plan | `[EASY]` — Sonnet |

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
