# La revue du 21 septembre — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN-revue-du-21-septembre.md`. Il ne change ni le contenu ni l'ordre des
> tranches : il dit seulement avec quel modèle et quel niveau de réflexion chacune se prend.
>
> Le classement est fait sur ce que la tranche demande **au moment de l'écrire**, pas sur sa
> valeur ni sur sa taille. Mesuré dans le dépôt le 21 septembre 2026 : `main` n'a aucun commit
> d'avance sur la branche des retours ; le moteur de la maison lit déjà la mémoire de la carte ;
> le statut `echouee` existe ; le montage automatique d'un clip est un drapeau déjà porté par la
> génération ; l'écran « Faire une vidéo » est monté par 16 fichiers d'essais, « Tout animer » et
> « Cases et planches » par aucun ; le guide tutoie 153 fois pour 1 vouvoiement.

## Les cinq étiquettes

| Étiquette | Modèle | Réflexion | Le critère d'entrée |
|---|---|---|---|
| `[VERY-EASY]` | Haiku 4.5 | faible | la forme existe déjà ailleurs et se recopie ; on peut décrire le résultat exact avant de commencer ; aucune décision |
| `[EASY]` | Sonnet | faible | montre des données existantes par des routes existantes ; ni schéma, ni invariant, ni algorithme |
| `[MEDIUM]` | Sonnet | élevée | une règle métier neuve, une route neuve, ou un algorithme standard et nommé |
| `[HARD]` | Opus | moyenne | change une forme de données ; **ou** pose un invariant dont d'autres tranches héritent ; **ou** touche à l'argent, à un secret, au disque de l'utilisateur ; **ou** c'est un sous-système qui n'existe nulle part |
| `[VERY-HARD]` | Opus | max | traverse plusieurs couches à la fois **et** doit faire passer un corpus d'essais existant sans qu'une assertion bouge |

---

## Les 28 tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **RV0** · Les retours du 20 sept. rejoignent `main` | `[VERY-EASY]` | Fusion en avance rapide sans conflit, plus trois lignes du tableau d'état. |
| **RV1** · Une vidéo ratée se dit ratée | `[MEDIUM]` | Une règle neuve sur un statut qui existe déjà ; le point dur est où elle s'insère avant le montage automatique. |
| **RV2** · La carte prévient avant de lancer | `[MEDIUM]` | La mémoire est déjà lue ; il manque le besoin de chaque modèle et la règle d'alerte. |
| **RV3** · Le fond évite la couleur du sujet | `[MEDIUM]` | Une entrée de plus dans un calcul existant, avec une petite lecture des couleurs nommées. |
| **RV4** · Les mots | `[EASY]` | Du texte, lu dans le recueil ; les noms lisibles des modèles existent déjà. |
| **RV5** · La fenêtre « Animer » reçoit le meilleur de A | `[MEDIUM]` | Des champs neufs sur la fabrication suivie, dont le nombre de clips que son circuit ne porte pas encore. |
| **RV6** · Un seul chemin pour animer | `[HARD]` | Retire deux écrans et un circuit serveur, rebranche onze portes et l'agent, et fait tomber seize fichiers d'essais. |
| **RV7** · Le retour, là où l'on a cliqué | `[MEDIUM]` | Montrer un état que le serveur connaît déjà, à un endroit neuf ; le point dur est de le faire remonter par le serveur. |
| **RV8** · Un seul écran de livraison | `[HARD]` | Écrit sur le disque de l'utilisateur (le projet Godot) et doit rendre les mêmes fichiers qu'avant. |
| **RV9** · Une seule liste de fabrications | `[MEDIUM]` | Fondre trois sources en une liste, avec la règle de regroupement des séries. |
| **RV10** · La fiche perd ses doublons | `[MEDIUM]` | Retirer un écran sans essais est simple ; le compte d'avancement unique est une règle métier neuve. |
| **RV11** · Les petits doublons | `[EASY]` | Filtrer une liste, remplacer une section par un lien, retirer un champ. |
| **RV12** · La fiche à quatre onglets | `[EASY]` | Redistribuer des contenus existants selon un rangement déjà décidé au plan. |
| **RV13** · La page d'un son et la Galerie | `[EASY]` | Marges, titres et filtres sur des données déjà remontées. |
| **RV14** · Le montage, le calibrage, les mouvements | `[EASY]` | Remise sur la grille du design, sans changer ce que les écrans font. |
| **RV15** · Les premiers pas | `[EASY]` | Changer l'écran d'arrivée et brancher « Échap » là où il manque. |
| **RV17** · Sous le ruban d'une animation | `[MEDIUM]` | Remettre en page un écran existant sans perdre un réglage ; le point dur est de rendre le chutier évident sans le réécrire. |
| **RV18** · « Sa vue » dit vrai, et se voit en scène | `[MEDIUM]` | corriger les exemples est facile ; les scènes animées au survol sont un petit sous-système d'affichage neuf, et le texte qui part au modèle change |
| **RV19** · L'image de départ se voit avant de choisir | `[MEDIUM]` | le serveur sait déjà choisir l'image à la relecture ; il faut l'exposer avant, par la même règle, et réordonner la fenêtre |
| **RV20** · Un texte envoyé se copie | `[EASY]` | un petit composant « Copier » posé là où le texte est déjà affiché |
| **RV21** · « Modifier la fiche » se range en onglets | `[MEDIUM]` | remettre en page une fenêtre existante sans perdre un réglage, avec un état partagé entre onglets |
| **RV22** · Ce qui n'est pas encore rangé se supprime ou s'écarte | `[EASY]` | deux gestes qui existent déjà ailleurs, posés dans le bandeau |
| **RV23** · Espace agrandit toute image, partout | `[MEDIUM]` | une règle par défaut au niveau de l'atelier, qui doit céder aux surfaces qui se servent déjà d'Espace |
| **RV24** · La table « Couleurs » montre les couleurs de l'image | `[MEDIUM]` | la liste existe côté serveur ; il faut la faire remonter, et une pipette de plus sur un geste qui existe |
| **RV25** · Le fond enfermé se voit, et s'enlève | `[MEDIUM]` | un compte neuf et déterministe des poches de fond, qui propose une passe existante sans jamais agir seul |
| **RV26** · L'agrandissement passe devant les fenêtres | `[EASY]` | une couche d'affichage à changer, la cause est déjà lue |
| **RV27** · La colonne des images de « Relire avant l'envoi » | `[EASY]` | une largeur de colonne et un retour à la ligne, la cause est déjà lue |
| **RV16** · La maquette, remesurée | `[MEDIUM]` | Un relevé au navigateur qui juge 26 écrans contre la maquette, avec la grille du 13 septembre. |

**Compte** : 0 `[VERY-HARD]`, 2 `[HARD]`, 15 `[MEDIUM]`, 10 `[EASY]`, 1 `[VERY-EASY]`.

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| RV1 | Choisir où le contrôle s'exécute (avant le montage automatique, sur le clip ou sur les images tirées) et ses seuils, sans jamais faire rater un clip réussi du dépôt | Opus, moyenne |
| RV5 | Faire porter le nombre de clips et le texte corrigé pour cet appel par la fabrication suivie, sans casser la relecture existante | Opus, moyenne |
| RV7 | La forme de l'état « en cours » que le serveur remonte par case visée, pour qu'il survive à un rechargement | Opus, moyenne |
| RV10 | La définition du compte d'avancement unique (ce qui compte comme « prêt pour le jeu ») et où il se calcule | Opus, moyenne |

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| RV4 | Passer au « tu » les textes qui vouvoient, une fois la liste relevée | Haiku 4.5 |
| RV6 | Rebrancher les onze boutons sur la fenêtre, une fois la fenêtre de `RV5` faite | Sonnet, faible |
| RV6 | Retirer les essais des deux écrans supprimés et réécrire ceux qui gardent un sens sur la fenêtre | Sonnet, faible |
| RV8 | Refaire la mise en page de l'écran unique, une fois le dossier Godot unique et les fichiers écrits vérifiés identiques | Sonnet, faible |
| RV16 | Prendre les captures et remplir la grille, écran par écran, avant le jugement | Haiku 4.5 |

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
5. **Toute tranche qui crée un état nouveau à l'écran (RV1, RV7) se vérifie au navigateur sur
   un atelier jetable**, pas seulement par les essais d'écran : ceux-ci poussent l'état eux-mêmes
   et ne voient pas ce que le serveur ne remonte pas.
