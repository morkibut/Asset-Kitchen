# Le son — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN-son.md`. Il ne change ni le contenu ni l'ordre des tranches :
> il dit seulement avec quel modèle et quel niveau de réflexion chacune se prend.
>
> Le classement est fait sur ce que la tranche demande **au moment de l'écrire**, pas sur sa
> valeur ni sur sa taille. Mesuré le 18 septembre 2026 : le son d'AU14 tient en onze essais
> serveur et six d'écran ; la livraison, elle, est verrouillée par une trentaine de fichiers
> d'essais ; aucune scène livrée ne porte encore d'`AnimationPlayer`.

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
| **SN0** · Le banc des moteurs | `[MEDIUM]` | Un script hors produit qui envoie des graphes connus et mesure ; la seule difficulté est la conversion des modèles de workflow, sortie à part. |
| **SNM** · La maquette du son | `[MEDIUM]` | Une maquette à la manière des précédentes ; le parcours du geste est le point qui se décide, sorti à part. |
| **SN1** · Un bruitage sans coller de workflow | `[MEDIUM]` | Des profils livrés et un diagnostic de fichiers sur un format qui existe ; ses nouvelles liaisons sont le point dur. |
| **SN2** · L'univers sonore et le texte qui part | `[MEDIUM]` | Le bloc se recopie sur les champs de la bible ; la règle de composition dont héritent toutes les familles monte. |
| **SN3** · Une série et les variantes | `[MEDIUM]` | Lancer N travaux existants et mesurer le niveau perçu sont standards ; la forme du jeu de variantes monte. |
| **SN4** · Livrer des fichiers | `[HARD]` | Change le contenu d'une livraison que des dizaines d'essais tiennent, et garde lisibles les paquets déjà livrés. |
| **SN5** · Les ambiances qui bouclent | `[MEDIUM]` | Fondu enchaîné et passage par zéro sont des algorithmes nommés, dans un traitement qui existe. |
| **SN6** · Les sons d'un sujet | `[HARD]` | Un son gagne un sujet et un emplacement : forme de données neuve, dont SN7, SN11 et SN12 héritent. |
| **SN7** · Le son calé sur l'animation | `[VERY-HARD]` | Traverse la bande, la scène livrée du personnage et la salle d'essai, sans qu'une assertion de livraison bouge. |
| **SN8** · Interface et rétro, sans ComfyUI | `[MEDIUM]` | Une bibliothèque à envelopper et une nouvelle source de sons qui rejoint le chemin commun. |
| **SN9** · La musique | `[MEDIUM]` | Sur le socle de SN1 à SN4 : durée en mesures, coupe sur la mesure, partition affichée. |
| **SN10** · La musique qui s'adapte | `[MEDIUM]` | Deux ressources Godot à écrire depuis des sons déjà livrés ; l'ordre de leurs constantes est vérifié à part. |
| **SN11** · Les voix | `[HARD]` | Un moteur qui peut vivre hors de ComfyUI, et une voix de référence gardée sur la fiche : un sous-système neuf. |
| **SN12** · L'agent demande des sons | `[MEDIUM]` | Des outils sur des services écrits par les tranches précédentes, et un champ de plus dans le cadre. |

**Compte** : 1 `[VERY-HARD]`, 3 `[HARD]`, 10 `[MEDIUM]`, 0 `[EASY]`, 0 `[VERY-EASY]`.

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| SN0 | Passer un modèle de workflow officiel (avec ses sous-graphes) au format que l'API de ComfyUI accepte, ou établir qu'un export à la main par l'auteur est plus sûr | `[HARD]` |
| SNM | Le parcours du geste — décrire, écouter huit tirages, garder — tenu aussi léger que celui de SpriteCook | `[HARD]` |
| SN1 | Les liaisons neuves d'un profil sonore (graine, tirages, paroles, tempo, tonalité, mesure, durée libre dans un intervalle) et leur effet sur l'empreinte des profils déjà importés | `[HARD]` |
| SN2 | La règle de composition du texte : ce que chaque famille ajoute, dans quel ordre, et ce qu'un texte relu à la main court-circuite | `[HARD]` |
| SN3 | La forme du jeu de variantes : ce qu'il possède, ce qui arrive à un son qui en sort, comment il se livre | `[HARD]` |
| SN5 | Si le banc l'a permis : refaire la jointure par Stable Audio 3 sans perdre la source immuable | `[HARD]` |
| SN10 | Vérifier dans un vrai Godot 4.7 l'ordre des constantes de transition d'une musique à états | `[HARD]` |

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| SN4 | Le nommage stable (`sfx_`, `amb_`, `mus_`, `vo_`, `ui_`) une fois la règle écrite | `[EASY]` |
| SN4 | `credits.json`, copie de la provenance déjà conservée | `[EASY]` |
| SN4 | Les essais écrits d'après les critères déjà rédigés | `[MEDIUM]` |
| SN6 | La liste des emplacements par famille de sujet, une fois la forme posée | `[EASY]` |
| SN6 | L'onglet « Sons » de la fiche, sur les routes de la tranche | `[MEDIUM]` |
| SN7 | La pose d'un repère sur une image, à l'écran, une fois sa forme posée | `[MEDIUM]` |
| SN11 | Les gabarits de voix et les réglages de transformation, recopiés des relevés | `[EASY]` |

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
