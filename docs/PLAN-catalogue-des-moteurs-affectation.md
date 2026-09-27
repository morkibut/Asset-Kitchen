# Le catalogue des moteurs — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN-catalogue-des-moteurs.md`. Il ne change ni le contenu ni l'ordre des
> tranches : il dit seulement avec quel modèle et quel niveau de réflexion chacune se prend.
>
> Classé le 27 septembre 2026, sur le relevé écrit en tête du plan.

## Les cinq étiquettes

| Étiquette | Modèle | Réflexion | Le critère d'entrée |
|---|---|---|---|
| `[VERY-EASY]` | Haiku 4.5 | faible | la forme existe déjà ailleurs et se recopie ; aucune décision |
| `[EASY]` | Sonnet | faible | montre des données existantes par des routes existantes |
| `[MEDIUM]` | Sonnet | élevée | une règle métier neuve, une route neuve, ou un algorithme standard et nommé |
| `[HARD]` | Opus | moyenne | change une forme de données ; ou pose un invariant dont d'autres héritent ; ou c'est un sous-système qui n'existe nulle part |
| `[VERY-HARD]` | Opus | max | traverse plusieurs couches **et** doit faire passer un corpus d'essais sans qu'une assertion bouge |

---

## Les 9 tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **MOM** · La maquette de la page « Moteurs » | `[MEDIUM]` | Une maquette sur le style papier et le choix du modèle dans trois outils ; aucune forme de données. |
| **MO1** · Les images de la machine : créer et repeindre | `[VERY-HARD]` | Pose la forme du catalogue dont toutes les suivantes héritent, fond deux listes en une à travers fournisseur, services, API et écran, et doit faire passer les essais des moteurs locaux et de PX2/PX7/PX9 sans qu'une assertion bouge. |
| **MO2** · La page « Moteurs » | `[MEDIUM]` | Un écran neuf sur le catalogue posé par MO1, et le renvoi depuis les outils. |
| **MO3** · La vidéo | `[HARD]` | Trois sources à fondre dans la forme de MO1, et une capacité (image de fin) à déduire des workflows importés. |
| **MO4** · Le son | `[MEDIUM]` | Les moteurs sont déjà construits à un seul endroit ; il s'agit de les faire sortir par le catalogue. |
| **MO5** · La 3D, le détourage et le texte | `[EASY]` | Montrer sur la page des moteurs qui existent déjà, par leurs routes. |
| **MO6** · Les workflows importés | `[HARD]` | Déduire des capacités d'un graphe importé, dont héritent tous les outils. |
| **MO7** · Les écrans ne tiennent plus de liste | `[MEDIUM]` | Retirer des listes en dur et fondre des routes en double, avec un garde-fou qui les refuse. |
| **MO8** · La relecture croisée | `[MEDIUM]` | Confronter les tranches et jouer les parcours au navigateur. |

**Compte** : 1 `[VERY-HARD]`, 2 `[HARD]`, 5 `[MEDIUM]`, 1 `[EASY]`, 0 `[VERY-EASY]`.

## L'ordre et ce qui part ensemble

- **MOM d'abord**, validée par l'auteur.
- **MO1 ensuite, seule** : elle pose la forme.
- **MO2, MO3, MO4, MO5 après MO1** ; MO3 et MO4 peuvent partir ensemble (fichiers séparés).
- **MO6 après MO3** (elle touche les mêmes workflows vidéo).
- **MO7, puis MO8, en dernier.**
