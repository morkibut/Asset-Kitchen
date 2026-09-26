# Les idées PixelLab — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN-idees-pixellab.md`. Il ne change ni le contenu ni l'ordre des tranches :
> il dit seulement avec quel modèle et quel niveau de réflexion chacune se prend.
>
> Le classement est fait sur ce que la tranche demande **au moment de l'écrire**. Relevé dans le
> dépôt le 26 septembre 2026 : une image jointe à ComfyUI est aplatie sur du blanc avant dépôt
> (`atelier/fournisseur/workflow.py`, `sur_fond_blanc`) ; les noms de liaison d'un profil sont
> une liste fermée (`atelier/domaine/workflow.py`) verrouillée par une douzaine de fichiers
> d'essais ; la part du sujet dans l'image envoyée au modèle vidéo est une constante
> (`atelier/image/clip.py`, `composer_entree`) ; l'image de départ d'un clip est la seule image
> que connaissent `DemandeClip`, `ModeleVideo` et les deux appels vidéo.

## Les cinq étiquettes

| Étiquette | Modèle | Réflexion | Le critère d'entrée |
|---|---|---|---|
| `[VERY-EASY]` | Haiku 4.5 | faible | la forme existe déjà ailleurs et se recopie ; aucune décision |
| `[EASY]` | Sonnet | faible | montre des données existantes par des routes existantes |
| `[MEDIUM]` | Sonnet | élevée | une règle métier neuve, une route neuve, ou un algorithme standard et nommé |
| `[HARD]` | Opus | moyenne | change une forme de données ; ou pose un invariant dont d'autres héritent ; ou c'est un sous-système qui n'existe nulle part |
| `[VERY-HARD]` | Opus | max | traverse plusieurs couches **et** doit faire passer un corpus d'essais sans qu'une assertion bouge |

---

## Les 10 tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **PX1** · Le banc de la zone | `[MEDIUM]` | Un banc sur le modèle de `essais/banc_tn6_transparence.py`, un graphe ComfyUI de retouche de zone écrit à la main, une mesure en trois classes. Le point délicat est le passage d'un sprite de 64 px à la taille du moteur et retour. |
| **PX2** · Le masque voyage jusqu'au moteur local | `[HARD]` | Change la forme d'un profil (une liaison neuve dans une liste fermée) et le dépôt des images ; les essais des moteurs locaux doivent passer tels quels. |
| **PX3** · Peindre une zone dans l'atelier | `[HARD]` | Un geste neuf sur trois couches (écran, service, agent), un calque qui se rouvre, et le recollage borné à la zone comme invariant. |
| **PX3bis** · La couleur demandée obéit | `[MEDIUM]` | Un banc gratuit sur le modèle de PX1, une mesure de couleur dominante à définir d'abord en une phrase, et un réglage par défaut qui en découle ; plus une règle neuve (un tirage servi par le cache n'est pas une mesure de temps). |
| **PX7** · Repeindre une zone avec chaque moteur local | `[MEDIUM]` | La recette existe (PX2) ; il s'agit de la décliner sur quatre familles de graphes déjà écrites, de laisser choisir le modèle, et d'un tirage de fonctionnement par outil. |
| **PX8** · La liste des pistes d'amélioration | `[EASY]` | Rassembler ce qui est déjà écrit dans le plan et le relevé ; aucun code, aucune mesure. |
| **PX9** · Repeindre, de A à Z : un résultat qui a un nom | `[HARD]` | Change ce que devient une génération (un résultat marqué « à décider », rangé mais tenu à l'écart des poses), branche le geste sur la création d'un sujet équipement et sur les calques d'équipement existants (AU15–AU17), et un parcours joué de bout en bout. |
| **PX4** · La marge avant d'animer | `[MEDIUM]` | Une constante devient un réglage gardé avec le clip et relu à la réouverture ; pas de forme neuve au-delà d'un champ. |
| **PX5** · Finir sur une image | `[HARD]` | Change `DemandeClip` et `ModeleVideo`, les deux appels vidéo, le découpage de la bande ; une capacité neuve grisée avec sa raison. |
| **PX6** · La relecture croisée | `[MEDIUM]` | Confronter les tranches entre elles et au plan ; corriger les coutures. |

**Compte** : 0 `[VERY-HARD]`, 4 `[HARD]`, 5 `[MEDIUM]`, 1 `[EASY]`, 0 `[VERY-EASY]`.

## L'ordre et ce qui part ensemble

- **PX1 et PX4 partent ensemble** : l'un n'écrit que dans `essais/` et le relevé, l'autre dans le
  chemin de l'animation.
- **PX5 attend PX4** : les deux touchent l'écran qui prépare une animation et l'objet du clip.
- **PX2 attend le verdict de PX1**, et **PX3 attend PX2**. Si le verdict est mauvais, les deux
  restent au plan, fermées, avec la raison.
- **PX6 vient en dernier.**
