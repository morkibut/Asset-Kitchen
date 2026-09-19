# Le coup de main — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN-assistant.md`. Il ne change ni le contenu ni l'ordre des tranches :
> il dit seulement avec quel modèle et quel niveau de réflexion chacune se prend.
>
> Le classement porte sur ce que la tranche demande **au moment de l'écrire**, pas sur sa
> valeur ni sur sa taille. Mesuré le 19 septembre 2026 : le produit n'appelle **aucun** modèle
> de texte aujourd'hui — l'adaptateur existant ne connaît que `/images`, et le compteur de
> dépenses ne compte que des images. Tout ce qui parle de texte payé est donc neuf.

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
| **CM1** · Parler à un modèle de texte | `[HARD]` | Un sous-système qui n'existe nulle part, qui touche à la clé et à l'argent, et dont les six autres tranches héritent. |
| **CM2** · La fiche du produit | `[MEDIUM]` | Écrire juste sur tout le produit demande de le relire en entier ; ce n'est pas du code, mais ce n'est pas mécanique. |
| **CM3** · Améliorer un texte de génération | `[MEDIUM]` | Une route neuve sur un adaptateur déjà posé, plus la règle « il propose, il ne remplace jamais ». |
| **CM4** · Demander, là où on est | `[MEDIUM]` | Un geste au clavier qui ne doit déplacer aucun écran ni voler aucun raccourci. |
| **CM5** · Expliquer ce qui bloque | `[EASY]` | Reprend le contexte déjà monté par CM4 et l'envoie à une consigne de plus. |
| **CM6** · Le plafond et le compteur | `[HARD]` | Touche à l'argent : un plafond qui ne tient pas en rafale est un plafond qui n'existe pas. |
| **CM7** · Partout où il y a un champ de prompt | `[EASY]` | Une seule pose sur un composant partagé ; c'est la relecture qui compte, pas le branchement. |

**Compte** : 0 `[VERY-HARD]`, 2 `[HARD]`, 3 `[MEDIUM]`, 2 `[EASY]`, 0 `[VERY-EASY]`.

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| CM2 | Confronter la fiche au vocabulaire publié et aux écrans réels : c'est de la relecture croisée, et le plus gros modèle est le seul à voir les contradictions | `[HARD]` |
| CM3 | La consigne elle-même — ce qu'on demande au modèle pour qu'il traduise sans inventer et sans avaler les mots de l'univers de l'auteur | `[HARD]` |
| CM4 | Le choix de la touche : prouver qu'elle est libre dans le produit **et** dans les navigateurs visés, plutôt que la supposer | `[MEDIUM]` |
| CM7 | La relecture qui vérifie qu'aucun écran n'a gagné un second chemin d'aide | `[HARD]` |

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| CM1 | Les erreurs traduites et le silence sans clé : le motif existe mot pour mot chez l'adaptateur des images | `[EASY]` |
| CM3 | L'affichage côté à côté, « Garder » et Échap, une fois la consigne arrêtée | `[EASY]` |
| CM6 | Le compteur dans l'écran des dépenses, une fois le plafond posé et prouvé | `[EASY]` |
| CM7 | La pose de la marque sur le composant partagé | `[VERY-EASY]` |

---

## Les règles qui priment sur le tableau

1. **Le relecteur est toujours le plus gros modèle**, quelle que soit l'étiquette de la
   tranche. Son travail est de confronter des fichiers entre eux ; c'est exactement ce qu'un
   modèle plus petit rate.
2. **Ce qui touche au modèle de données passe avant l'écran qui l'affiche.** Ici, CM1 passe
   avant tout le reste : sans lui, les six autres n'ont rien à appeler.
3. **Une tranche `[HARD]` se découpe avant d'être confiée.** Le gros modèle pose la décision et
   l'invariant ; ce qui en découle repart plus bas.
4. **Un point dur qui monte se traite en sous-agent, pas en changement de session.** La session
   qui tient la tranche l'appelle avec le modèle imposé par le point dur, sur un prompt
   autonome et étroit ; elle continue elle-même le reste.
5. **Le prix se mesure avant CM6, pas pendant.** Le plafond se règle sur des appels réels
   comptés, jamais sur une estimation — et c'est ce qui rend la décision 8 du plan défendable
   ou non.
