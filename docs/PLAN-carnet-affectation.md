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

## Les 29 tranches

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
| **B23** · les trois surfaces déménagent | `[HARD]` | quatre surfaces à coordonnées redessinées sur le papier, où le moindre écart de convention décale ce qu'on pose sur l'image — l'invariant prime sur le calcul, déjà écrit |
| **B24** · ce qui restait dans les murs | `[MEDIUM]` | cinq gestes indépendants à reporter — sœurs, presse-papier, promotion, deux fabriques, zoom libre — aucun n'invente un algorithme neuf |
| **B25** · une seule porte | `[HARD]` | fondre trois genres de lieu en un seul touche la pile de navigation entière ; la panne qu'évite cette tranche est celle que `B0` a déjà payée une fois |
| **B26** · l'ancien châssis sort de la retouche | `[MEDIUM]` | une extraction puis une suppression, ordonnée et mécanique une fois `B23`-`B25` posées ; le seul arbitrage (`AtelierDeBande.tsx`) est déjà tranché dans le plan |
| **B27** · les garde-fous rattrapent la refonte | `[EASY]` | des mises à jour de listes et de phrases, plus un garde-fou d'import à écrire sur un patron déjà connu |

**Compte** : 1 `[VERY-HARD]`, 10 `[HARD]`, 13 `[MEDIUM]`, 5 `[EASY]`, 0 `[VERY-EASY]` en tranche
entière — les `[VERY-EASY]` sont des sous-tâches, pas des tranches.

---

## Les 9 tranches `C` — la sortie de l'ancien châssis

*Classées le 10 septembre 2026, mesurées fichier par fichier plutôt que sur la lecture seule
du plan — deux relevés indépendants ont compté les lignes, les montages et les doublons avant
ce classement.*

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **C1** · le compteur de sortie, et les cinq portes des réglages | `[MEDIUM]` | le garde-fou se retourne (mécanique), mais les garde-fous de l'agent et la bibliothèque de mouvements manquent réellement à `Installation.tsx` — `Installation.tsx:1251` le dit lui-même en renvoyant vers l'ancien écran — et leur y donner une place est un assemblage, pas de la conception |
| **C2** · l'univers s'efface | `[HARD]` | 8 200 lignes portées, dont `Toile`/`Tableau`/`Ambiances` (5 500 lignes) qui n'ont **aucun équivalent papier** nulle part ; et `Assistant.tsx` écrit le même endpoint que `ReglesDuJeu.tsx` (`api.reglerUnivers`), donc un vrai arbitrage précède le portage |
| **C3** · le codex s'efface | `[MEDIUM]` | retirer `Codex.tsx` est mécanique, mais le seul chemin qui **crée** une pièce d'équipement vit dans son `Vestiaire` (`Personnages.tsx:728`) et n'a pas d'équivalent dans `Emplois.tsx`/`Emploi.tsx`, qui ne savent qu'exploiter l'existant — ce geste se reloge avant que le codex parte |
| **C4** · la galerie passe au papier | `[VERY-HARD]` | la galerie n'est pas un fichier mais 2 000 lignes écrites en clair dans `App.tsx` (réinjection comprise), qui montent huit fichiers autour d'elle ; c'est la surface la plus couverte des 721 essais d'écran, et un doublon vrai (`Fiche.tsx` / le volet de `ImagesDuSujet.tsx`) doit se trancher au passage |
| **C5** · l'envoi, le clip, le montage | `[MEDIUM]` | trois écrans portés sur un patron déjà connu ; la seule décision — le sort d'un clip écarté, que deux planches se contredisent depuis le 6 septembre sans jamais avoir été arbitré — est le point dur, pas la tranche entière |
| **C6** · l'établi d'un sujet | `[MEDIUM]` | ~7 250 lignes sur cinq fichiers, mais aucune décision neuve : le patron des onglets de `PageDuSujet.tsx` existe déjà (`B10`, `B11`, `B19`), et `Calque.tsx`/`Calibrage.tsx` n'ont aucun second lecteur qui les disputerait |
| **C7** · l'atelier d'une animation | `[MEDIUM]` | les moteurs sont déjà ceux de `Retouche.tsx` depuis `B26` ; il ne reste que le châssis autour à reporter en papier |
| **C8** · les dépenses, la découpe, la différence | `[MEDIUM]` | `Depenses.tsx` affiche des nombres déjà calculés (patron `B5`/`B13`) ; `Decoupe.tsx`/`Superposition.tsx` sont déjà montées comme fabriques depuis la retouche neuve (`B24`), seul leur propre châssis reste ancien |
| **C9** · la barre tombe | `[VERY-HARD]` | c'est la tranche qui doit faire passer les 721 essais d'écran **sans qu'une assertion bouge** en changeant leur seul point d'entrée (`leLieu()`), tout en changeant le sens de `racine()` dans `lieux.ts` — exactement la définition du grade au tableau |

**Compte du bloc C** : 2 `[VERY-HARD]`, 1 `[HARD]`, 6 `[MEDIUM]`, 0 `[EASY]`, 0 `[VERY-EASY]` en
tranche entière.

⚠️ **Contrôle de vraisemblance, fait et assumé** : 3 tranches sur 9 sortent `[HARD]` ou
au-dessus — tout juste au tiers. Reprises une par une plutôt que rabotées d'office, parce que
ce bloc n'est pas une tranche de fonctionnalité ordinaire : c'est le bloc qui referme les
décisions que `B0` avait laissées ouvertes, et chacune des trois a une raison précise, citée
dans sa ligne — pas la taille du fichier qu'elle touche.

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
| **B23** | la convention de coordonnées des quatre surfaces — un pixel visé doit tomber au même endroit dans l'ancien et le neuf | `[HARD]` |
| **B25** | fondre `"case"`, `"tables"` et `"retouche"` en un seul genre de lieu, sans perdre une porte au passage | `[HARD]` |
| **C2** | l'arbitrage entre `Assistant.tsx` et `ReglesDuJeu.tsx` — quel geste de l'assistant survit, une fois qu'il n'écrit plus deux fois le même endpoint | `[HARD]` |
| **C4** | l'arbitrage entre `Fiche.tsx` et le volet de `ImagesDuSujet.tsx` — lequel des deux reste le volet d'image du produit, et ce qu'il doit couvrir de l'autre | `[HARD]` |
| **C5** | trancher la contradiction entre `Clip.dc.html` et `Clips.dc.html` sur le sort d'un clip écarté | `[HARD]` |
| **C9** | fixer la forme finale de `racine()` dans `lieux.ts` une fois les onglets retirés, et vérifier que `leLieu()` retrouve chacun des 721 essais sans qu'une assertion change | `[HARD]` |

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
| **C1** | retourner `essai_jetons.py` d'une liste blanche à un compte de restants, une fois la forme choisie | `[VERY-EASY]` |
| **C6** | reporter `Planche.tsx` / `Vitrine.tsx` / `Calibrage.tsx` dans l'onglet *Fiche* de `PageDuSujet.tsx`, sur le patron déjà posé par `B10`/`B11`/`B19` | `[EASY]` |
| **C7** | reporter le châssis de `AtelierDeBande.tsx` en papier — les moteurs sont déjà ceux de `Retouche.tsx` depuis `B26` | `[EASY]` |
| **C8** | `Depenses.tsx` — un affichage de nombres déjà calculés, comme `B5`/`B13` | `[EASY]` |

---

## B8 en détail, morceau par morceau

*Découpée le 6 septembre 2026, avant d'être confiée — règle 3 plus bas. La conception est dans
`docs/tranches/V4.md` § B8.* Six morceaux, **du serveur uniquement** : l'écran est `B9`.

| # | Le morceau | Étiquette |
|---|---|---|
| **B8.1** | le modèle de l'adhésion — la collection porte ses membres, et un membre est un couple `(jeu, sujet)` | `[HARD]` |
| **B8.2** | la table de jointure dans l'index, et sa reconstruction depuis le disque | `[MEDIUM]` |
| **B8.3** | les sujets entrent dans l'index — deux crochets, un seul endroit écrit un sujet | `[MEDIUM]` |
| **B8.4** | les gestes : ranger, retirer, supprimer une collection, et l'arbre qui compte des sujets | `[MEDIUM]` |
| **B8.5** | la recherche en deux groupes — les sujets, les images | `[MEDIUM]` |
| **B8.6** | le vocabulaire du serveur : « ses assets restent » devient « ses sujets restent » | `[VERY-EASY]` |

**Un seul morceau reste Opus** : `B8.1`, qui pose la forme dont les cinq autres héritent.
Le relevé a fait descendre `B8.3`, qu'on croyait dur — un seul endroit du dépôt écrit un sujet,
un seul l'efface, donc l'index se branche sur deux crochets nommés et non sur une chasse.

---

## B9 en détail, morceau par morceau

*Découpée le 7 septembre 2026, avant d'être confiée — règle 3 plus bas. La conception, le
relevé et la question posée à l'auteur sont dans `docs/tranches/V4.md` § B9.* Sept morceaux :
trois de serveur, quatre d'écran.

| # | Le morceau | Étiquette |
|---|---|---|
| **B9.1** | le compte groupé par sujet — une requête agrégée qui remplace un aller-retour SQL par sujet, combinée en Python aux règles de complétude déjà écrites sur `Personnage` | `[HARD]` |
| **B9.2** | la route qui sert une famille, paginée façon B3, avec le compte de B9.1 posé sur chaque sujet | `[MEDIUM]` |
| **B9.3** | chaque sujet servi porte déjà ses collections — une jointure de plus sur le patron de B8.4 | `[EASY]` |
| **B9.4** | la grille, la recherche et la sélection multiple | `[MEDIUM]` |
| **B9.5** | le glisser-déposer avec compte projeté avant le lâcher | `[MEDIUM]` |
| **B9.6** | les filtres et leur compte, dérivés de B9.1 | `[EASY]` |
| **B9.7** | le panneau des réglages de famille — trois tables, aucune route neuve | `[MEDIUM]` |

**Un seul morceau reste Opus** : `B9.1`, le point dur déjà repéré plus haut (§ Les points durs
qui montent d'un cran). Il pose la requête agrégée dont `B9.2` et `B9.6` héritent ; les quatre
morceaux d'écran n'ont ensuite aucun algorithme à inventer, seulement à composer ce que le
serveur leur sert.

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
