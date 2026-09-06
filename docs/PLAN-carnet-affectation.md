# V4 — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN-carnet.md`. Il ne change ni le contenu ni l'ordre des tranches :
> il dit seulement **avec quel modèle et quel niveau de réflexion** chacune se prend, pour ne
> pas payer du raisonnement d'architecte sur un écran qui affiche des chiffres déjà calculés.
>
> Le classement est fait sur ce que la tranche demande **au moment de l'écrire**, pas sur sa
> valeur ni sur sa taille.

## Les cinq étiquettes

| Étiquette | Modèle | Réflexion | Ce que ça veut dire |
|---|---|---|---|
| `[VERY-EASY]` | Haiku 4.5 | faible | mécanique : rien à décider, la forme est déjà écrite ailleurs |
| `[EASY]` | Sonnet | faible | un écran qui montre des données existantes, par des routes existantes |
| `[MEDIUM]` | Sonnet | élevée | une règle métier neuve, un algorithme standard, une route à ajouter |
| `[HARD]` | Opus | moyenne | un changement de schéma, un invariant transverse, un sous-système neuf |
| `[VERY-HARD]` | Opus | max | une refonte d'architecture qui touche tout le produit à la fois |

---

## Les 24 tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **D0** · le système de design | `[HARD]` | c'est la source de valeurs de toutes les autres tranches, relevée en croisé sur 43 planches — une valeur fausse ici se propage partout |
| **B0** · le socle du carnet | `[VERY-HARD]` | onze booléens et 150 lignes de `if/else` deviennent une pile de lieux, 24 fichiers portent des tailles en dur, et 714 essais doivent passer sans qu'une assertion bouge |
| **B1** · le miroir | `[MEDIUM]` | le retournement lui-même est trivial, mais la tranche pose la règle « une place neuve ne change pas l'empreinte » dont B17 et B18 héritent |
| **B2** · les clips payés qui attendent | `[EASY]` | les deux routes existent depuis le 4 septembre ; il s'agit de les appeler et de dessiner un bandeau |
| **B3** · les huit états | `[MEDIUM]` | huit cas d'affichage sans difficulté, plus trois pertes silencieuses dont une vient du serveur qui jette un réglage |
| **B4** · l'ouverture | `[MEDIUM]` | l'écran est simple ; ce qui coûte, c'est le changement de jeu qui doit recharger l'univers sans recharger la page |
| **B5** · le tableau de bord | `[EASY]` | six cartes qui montrent des comptes déjà calculés ; seule l'addition du lot avant clic est neuve |
| **B6** · la barre | `[HARD]` | il faut concevoir la liste d'actions que la barre et l'agent lisent tous les deux, avec la règle « elle ne paie jamais » tenue par construction |
| **B7** · le guide en volet | `[EASY]` | un volet à la place d'un recouvrement, et un remappage de 157 entrées vers neuf lignes du carnet — du volume, pas de la difficulté |
| **B8** · la collection | `[HARD]` | colonne simple → table de jointure, avec relecture du disque sans perte et l'index de recherche élargi dans la foulée |
| **B9** · la grille d'une famille | `[MEDIUM]` | 250 sujets qui défilent sans recalculer leurs vignettes, plus le glisser-déposer et les filtres comptés |
| **B10** · la page d'un sujet | `[MEDIUM]` | les sept champs existent déjà ; le travail est le rangement en rangées et la règle « la retenue est toujours en tête » |
| **B11** · les animations et le départage | `[MEDIUM]` | trois colonnes reportées telles quelles depuis les images, et un écran de tri qui n'invente aucune donnée |
| **B12** · l'essai | `[HARD]` | une boucle de jeu entièrement neuve, où la vitesse jouée doit être exactement celle qui sortira à l'export |
| **B13** · la grille du jeu et comparer | `[EASY]` | deux écrans qui montrent ensemble des nombres déjà calculés ; seul le plafond réel d'occupation est un calcul neuf |
| **B14** · les règles du jeu | `[HARD]` | supprimer deux des trois consignes de caméra en double change ce qui part au modèle sur **toutes** les générations à venir |
| **B15** · l'installation | `[HARD]` | l'écran pose une clé de fournisseur et déplace le dossier de travail : c'est le seul endroit du plan qui manipule un secret et le disque de l'utilisateur |
| **B16** · les tables dans la grammaire | `[MEDIUM]` | beaucoup d'écran et peu d'algorithme, mais six contradictions relevées doivent être tranchées, chacune par un essai |
| **B17** · les moteurs qui remplacent une génération | `[MEDIUM]` | trois des quatre sont des traitements standards ; le quatrième, le pixel de couleur accroché au sujet, ne l'est pas |
| **B18** · le reste des moteurs | `[MEDIUM]` | c'est une file de 44 moteurs indépendants, pas une tranche : la moyenne est Sonnet, le détail est plus bas |
| **B19** · le vestiaire | `[HARD]` | la relation qui manque au modèle, avec les pièces déjà sur le disque à relire sans porteur et sans perte |
| **B20** · les calques d'animation | `[MEDIUM]` | le calcul de recalage existe déjà ; il faut lui donner un axe *pièce* et distinguer le calque qui tient de celui qui glisse |
| **B21** · la sortie | `[HARD]` | prévisualiser sans écrire, et se souvenir de la sortie précédente pour la comparer, sont deux sous-systèmes qui n'existent nulle part |
| **B22** · la galerie connaît les clips | `[MEDIUM]` | un type neuf dans la galerie, une couverture fabriquée par le serveur, et cent clips qui ne doivent pas ralentir la grille |

**Compte** : 1 `[VERY-HARD]`, 8 `[HARD]`, 11 `[MEDIUM]`, 4 `[EASY]`, 0 `[VERY-EASY]` en tranche
entière — les `[VERY-EASY]` sont des sous-tâches, pas des tranches.

---

## Les points durs qui montent d'un cran

Une tranche `[MEDIUM]` peut contenir une heure de travail qui, elle, demande Opus. Ces
morceaux-là se sortent et se traitent à part, avant le reste de la tranche.

| Dans | Le morceau | Traité en |
|---|---|---|
| **B1** | la règle « une place absente ne compte pas dans l'empreinte » — elle vaut pour les 14 places à venir | `[HARD]` |
| **B3** | trouver pourquoi le serveur jette le décalage horizontal quand un autre réglage bouge | `[HARD]` |
| **B4** | le changement de jeu qui doit recharger la bible, la taille de pixel et les grisés sans recharger la page | `[HARD]` |
| **B9** | tenir 250 sujets sans recalculer les vignettes à chaque rendu | `[HARD]` |
| **B16** | l'arbitrage des six contradictions : ce sont des décisions de produit, pas du code | `[HARD]` |
| **B17** | le nettoyage du pixel de couleur accroché au sujet — aucun algorithme existant ne le voit | `[HARD]` |
| **B20** | la géométrie du recalage image par image, sans casser l'invariant « un calque reste solidaire de sa pose » | `[HARD]` |

---

## Les morceaux qui descendent d'un cran

À l'inverse, ces morceaux-là sont mécaniques une fois la décision prise en amont. Les donner à
Haiku est sans risque, et c'est là que l'économie se fait vraiment.

| Dans | Le morceau | Traité en |
|---|---|---|
| **B0** | basculer les 61 appels `getByRole("tab", …)` sur la fonction d'aide, une fois qu'elle est écrite | `[VERY-EASY]` |
| **B7** | réadresser les 157 entrées du guide vers les neuf lignes du carnet, une fois la table des lieux fixée | `[VERY-EASY]` |
| **B16** | poser à l'écran les sept tables et les deux fabriques, une fois la grammaire du carnet livrée par `B0` | `[EASY]` |
| **partout** | écrire les essais d'un comportement déjà décrit par un critère d'acceptation | `[VERY-EASY]` |
| **partout** | le rôle *relevé* de la flotte : mesurer, citer fichier et ligne, compter | `[EASY]` |

---

## B18 en détail, atelier par atelier

`B18` est une file, et ses huit ateliers ne se valent pas. Pris séparément :

| Atelier | À écrire | Étiquette | Pourquoi |
|---|---|---|---|
| Détourer | 5 | `[MEDIUM]` | la même passe sur les frames voisines sort du cadre « une image à la fois » |
| Recadrer | 6 | `[EASY]` | de la géométrie de boîte, sans surprise |
| Pixéliser | 4 | `[MEDIUM]` | « sur les carrés du modèle » demande de retrouver la grille du tirage |
| Couleurs | 9 | `[HARD]` | k-moyennes, octree, distance perceptuelle et rampes d'ombre — les vrais algorithmes du lot |
| Nettoyer | 9 | `[MEDIUM]` | le compte se contredit trois fois dans la planche : trancher avant de chiffrer |
| Retourner | 9 | `[MEDIUM]` | huit sont triviaux, RotSprite ne l'est pas |
| Contour | 6 | `[MEDIUM]` | le contour sur l'ensemble empilé demande de composer avant de tracer |
| Découpe | 1 | `[EASY]` | les gouttières d'une planche générée, cas simple et fréquent |

---

## Trois règles qui priment sur le tableau

1. **Le relecteur est toujours Opus, quelle que soit l'étiquette de la tranche.** Son travail
   est de confronter des fichiers entre eux ; c'est exactement ce qu'un modèle plus petit rate,
   et une tranche n'est pas close sans lui.
2. **Le serveur passe avant l'écran sur `B8`, `B11`, `B19`, `B20`** — et c'est la partie serveur
   qui porte l'étiquette. L'écran qui suit descend souvent d'un cran, parce que la relation est
   déjà posée.
3. **Une tranche `[HARD]` ou `[VERY-HARD]` se découpe avant d'être confiée.** Opus sert à poser
   la décision et l'invariant ; ce qui en découle repart en `[MEDIUM]` ou plus bas. Confier
   `B0` entière à un seul agent Opus coûte cher pour rien.
