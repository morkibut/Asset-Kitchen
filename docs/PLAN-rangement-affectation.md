# Le rangement — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN-rangement.md`. Il ne change ni le contenu ni l'ordre des tranches :
> il dit seulement avec quel modèle et quel niveau de réflexion chacune se prend.
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

## Les huit tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **RG1** · Une nature dit ce qu'elle peut | `[MEDIUM]` | La table est déjà écrite au mot près dans le plan (D1) : ce qui reste est une règle neuve à poser à côté de deux tables existantes, sans en recopier aucune. |
| **RG2** · La page d'un sujet ne montre que ce qui s'applique | `[EASY]` | La liste des onglets est déjà fermée et déclarée en un endroit ; il s'agit de la filtrer par ce que RG1 sait déjà dire. |
| **RG3** · La fiche d'une image, en trois zones | `[MEDIUM]` | Aucune donnée ne bouge, mais deux blocs qui disent presque la même chose fusionnent en un seul qui doit dire la valeur **et** sa raison — c'est une règle d'affichage neuve, pas un déplacement. |
| **RG4** · La colonne de gauche des sujets | `[EASY]` | Familles, natures et comptes existent tous déjà côté serveur ; la tranche les groupe autrement et corrige un libellé qui ment. |
| **RG5** · Les matières deviennent une bibliothèque | `[HARD]` | Change la forme d'un asset — une image cesse d'avoir besoin d'un sujet porteur — et pose l'invariant dont RG6, RG7 et RG8 héritent. |
| **RG6** · L'écran des tuiles adopte la bibliothèque | `[MEDIUM]` | Le branchement est mécanique, mais « déclarer une image comme matière depuis sa fiche » est un geste neuf, avec son refus à écrire. |
| **RG7** · L'agent voit les matières | `[MEDIUM]` | Un outil de plus sur une surface qui en compte déjà des dizaines, sur le modèle exact des voisins — plus un essai de bout en bout à écrire. |
| **RG8** · La migration, et la relecture croisée | `[HARD]` | Réécrit des fichiers déjà posés sur le disque de l'auteur, et se termine par une relecture qui confronte plan, écrans et maquette. |

**Compte** : 0 `[VERY-HARD]`, 2 `[HARD]`, 4 `[MEDIUM]`, 2 `[EASY]`, 0 `[VERY-EASY]`.

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| **RG2** | Sur quoi s'ouvre la page d'un sujet qui n'a ni animations ni poses — la règle actuelle ouvre sur *Animations*, ce qui est précisément le défaut à corriger. | `[MEDIUM]` |
| **RG3** | Ce que dit le bloc fusionné, ligne par ligne, sans perdre une information que l'un des deux blocs portait seul. | `[HARD]` |
| **RG5** | À qui appartient la bibliothèque — au projet, ou à l'écran des tuiles. C'est la première question laissée ouverte par le plan, et elle décide de la forme retenue. | `[HARD]` |

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| **RG1** | Les essais de la table, écrits d'après des critères déjà rédigés. | `[VERY-EASY]` |
| **RG5** | Une fois la forme arrêtée, le report sur les routes et les refus qui l'accompagnent. | `[MEDIUM]` |
| **RG8** | Une fois la règle de migration posée, le balayage des projets et des images. | `[EASY]` |

---

## Les règles qui priment sur le tableau

1. **Le relecteur est toujours le plus gros modèle**, quelle que soit l'étiquette de la
   tranche. Son travail est de confronter des fichiers entre eux ; c'est exactement ce qu'un
   modèle plus petit rate. Vaut pour la relecture croisée de `RG8`.
2. **Ce qui touche au modèle de données passe avant l'écran qui l'affiche**, et c'est la partie
   données qui porte l'étiquette. C'est pourquoi `RG5` précède `RG6`.
3. **Une tranche `[HARD]` se découpe avant d'être confiée.** Le gros modèle sert à poser la
   décision et l'invariant ; ce qui en découle repart plus bas.
4. **Un point dur qui monte se traite en sous-agent, pas en changement de session.** La
   session qui tient la tranche l'appelle via l'outil `Agent` avec le modèle imposé par le
   point dur, sur un prompt autonome et étroit ; elle continue elle-même le reste.
