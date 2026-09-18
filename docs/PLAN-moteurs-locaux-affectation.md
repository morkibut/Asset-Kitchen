# Les moteurs d'image locaux — quel modèle sur quelle tranche

> Compagnon de [PLAN-moteurs-locaux.md](PLAN-moteurs-locaux.md). Il ne change ni le contenu ni
> l'ordre des tranches : il dit seulement avec quel modèle et quel niveau de réflexion chacune
> se prend.
>
> Le classement est fait sur ce que la tranche demande **au moment de l'écrire**, pas sur sa
> valeur ni sur sa taille. Mesuré le 18 septembre 2026 : une cinquantaine de fichiers d'essais
> touchent aux profils de workflow, et vingt-six fichiers lisent le nombre de références d'un
> modèle.

## Les cinq étiquettes

| Étiquette | Modèle | Réflexion | Le critère d'entrée |
|---|---|---|---|
| `[VERY-EASY]` | Haiku 4.5 | faible | la forme existe déjà ailleurs et se recopie ; on peut décrire le résultat exact avant de commencer ; aucune décision |
| `[EASY]` | Sonnet | faible | montre des données existantes par des routes existantes ; ni schéma, ni invariant, ni algorithme |
| `[MEDIUM]` | Sonnet | élevée | une règle métier neuve, une route neuve, ou un algorithme standard et nommé |
| `[HARD]` | Opus | moyenne | change une forme de données ; **ou** pose un invariant dont d'autres tranches héritent ; **ou** touche à l'argent, à un secret, au disque de l'utilisateur ; **ou** c'est un sous-système qui n'existe nulle part |
| `[VERY-HARD]` | Opus | max | traverse plusieurs couches à la fois **et** doit faire passer un corpus d'essais existant sans qu'une assertion bouge |

---

## Les 7 tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **ML1** · La graine, et 0 à N références | `[HARD]` | change la forme d'un profil et d'une génération, sans changer la version des profils déjà gardés ; toutes les tranches suivantes en héritent |
| **ML2** · Le catalogue des 22 styles | `[MEDIUM]` | un portage de code qui existe, une recherche par motif et une route neuve, sur le format que ML1 a posé |
| **ML3** · Les références | `[MEDIUM]` | des graphes supplémentaires dans le format de ML1, plus une règle : quel genre de référence prend chaque style |
| **ML4** · Le texte qui part vers un modèle local | `[HARD]` | touche la résolution unique de l'envoi, que partagent la fiche et l'écran de confirmation, sans qu'un seul texte payant ne bouge |
| **ML5** · Les écrans | `[MEDIUM]` | des routes existantes, avec une règle d'affichage : un réglage inerte disparaît |
| **ML6** · La texture raccordable | `[EASY]` | deux nœuds recopiés de sc-clone et une option grisée, déjà mesurés là-bas |
| **ML7** · S'en servir | `[MEDIUM]` | des tirages réels à lire et à consigner ; aucune décision de structure |

**Compte** : 0 `[VERY-HARD]`, 2 `[HARD]`, 4 `[MEDIUM]`, 1 `[EASY]`, 0 `[VERY-EASY]`.

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| ML3 | câbler `ReferenceLatent` pour Klein, distillé et base, à une, deux et trois références, d'après le gabarit d'édition officiel de ComfyUI | `[HARD]` — Opus |
| ML2 | la règle qui départage deux fichiers compatibles et celle qui dit quand une réinstallation crée une version | `[HARD]` — Opus |

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| ML2 | recopier les 22 lignes du catalogue (motifs, déclencheurs, forces, étapes) | `[VERY-EASY]` — Haiku 4.5 |
| ML1 | les essais, écrits d'après les critères d'acceptation déjà rédigés | `[MEDIUM]` — Sonnet |
| ML4 | les essais du texte envoyé, par famille et par genre de fabrication | `[MEDIUM]` — Sonnet |

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
