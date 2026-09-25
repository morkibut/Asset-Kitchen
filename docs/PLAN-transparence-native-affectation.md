# La transparence native — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN-transparence-native.md`. Il ne change ni le contenu ni l'ordre des
> tranches : il dit seulement avec quel modèle et quel niveau de réflexion chacune se prend.
>
> Le classement est fait sur ce que la tranche demande **au moment de l'écrire**, pas sur sa
> valeur ni sur sa taille. Mesuré dans le dépôt le 22 septembre 2026 : la fiche d'un modèle du
> catalogue se sérialise en deux endroits et aucun essai ne la construit directement ; la phrase
> du fond part d'un seul endroit côté domaine et de deux côté service, verrouillés par quatre
> fichiers d'essais ; la mise en sommeil d'une place de recette existe déjà et sert dans dix
> fichiers ; la recette de naissance d'un asset vit en un seul endroit, sans essai direct ; la
> provenance d'un réglage est lue par 72 fichiers.

## Les cinq étiquettes

| Étiquette | Modèle | Réflexion | Le critère d'entrée |
|---|---|---|---|
| `[VERY-EASY]` | Haiku 4.5 | faible | la forme existe déjà ailleurs et se recopie ; on peut décrire le résultat exact avant de commencer ; aucune décision |
| `[EASY]` | Sonnet | faible | montre des données existantes par des routes existantes ; ni schéma, ni invariant, ni algorithme |
| `[MEDIUM]` | Sonnet | élevée | une règle métier neuve, une route neuve, ou un algorithme standard et nommé |
| `[HARD]` | Opus | moyenne | change une forme de données ; **ou** pose un invariant dont d'autres tranches héritent ; **ou** touche à l'argent, à un secret, au disque de l'utilisateur ; **ou** c'est un sous-système qui n'existe nulle part |
| `[VERY-HARD]` | Opus | max | traverse plusieurs couches à la fois **et** doit faire passer un corpus d'essais existant sans qu'une assertion bouge |

---

## Les 6 tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **TN1** · Le catalogue sait qui rend la transparence | `[MEDIUM]` | Un champ facultatif de plus sur la fiche d'un modèle, sur le modèle des limites de références, et une règle d'arrivée neuve. |
| **TN2** · Le texte envoyé demande un fond vide | `[HARD]` | Elle pose la règle « capacité × silhouette × pas une planche » dont TN3 et TN5 héritent, sur trois couches du texte verrouillées par des essais. |
| **TN3** · Le détourage s'endort pour une image née transparente | `[MEDIUM]` | La mise en sommeil existe ; il s'agit de la décider à la naissance et de l'écrire dans la provenance. |
| **TN4** · Un trou dans le sujet se voit à l'arrivée | `[MEDIUM]` | Un algorithme standard (zones transparentes non reliées au bord), un seuil calé sur le banc, un message et un geste. |
| **TN5** · L'agent fait pareil | `[EASY]` | Le chemin MCP passe par les mêmes services ; il ne reste qu'à le prouver par un essai de bout en bout. |
| **TN6** · Le banc rejoué, puis les planches | `[EASY]` | Rejouer un script de mesure existant et écrire les chiffres. |
| **TN7** · Un texte repris retrouve le fond de son appel | `[MEDIUM]` | Une règle de composition du texte sur un chemin déjà verrouillé par des essais (RT3, RV3, TN2) ; pas de forme de données neuve. |

**Compte** : 0 `[VERY-HARD]`, 1 `[HARD]`, 3 `[MEDIUM]`, 2 `[EASY]`, 0 `[VERY-EASY]`.

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| TN1 | Où l'alpha de bruit est aplati à l'arrivée d'une image locale, sans toucher aux images importées qui portent un vrai alpha | `[HARD]` — Opus, moyenne |
| TN3 | Ce qui prouve à la naissance que le fond est vraiment vide (demandé **et** reçu), plutôt que de se fier au seul drapeau de la demande | `[HARD]` — Opus, moyenne |
| TN4 | Le seuil qui sépare la robe trouée de l'espace entre un bras et le corps | `[HARD]` — Opus, moyenne |

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| TN2 | Les essais du texte composé, écrits d'après les critères d'acceptation une fois la règle posée | `[MEDIUM]` — Sonnet, élevée |
| TN2 | Le retrait de la couleur du fond et de sa phrase interdite pour les appels concernés, une fois la règle écrite | `[MEDIUM]` — Sonnet, élevée |

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
