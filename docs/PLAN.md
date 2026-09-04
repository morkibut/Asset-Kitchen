# Plan : Asset Kitchen — ce qui reste à construire

> **PRD source** : `docs/PRD.md`. **Bilan technique de la V3** : `docs/bilan-v3.md` — à lire
> avant d'ouvrir quoi que ce soit de la V3. *(La V2.3 est close depuis le 3 septembre 2026 ;
> ce que ses cinq tranches ont mesuré est dans leurs sections et dans `docs/status/etat.md`.)*
>
> Ce document fait foi sur **l'ordre de construction** et sur les **critères d'acceptation**.
> Il ne nomme ni fichier, ni fonction, ni route : comment c'est construit vit dans
> `docs/ARCHITECTURE.md`, à quoi ça ressemble dans `docs/DESIGN.md`, ce que ça doit faire dans
> `docs/PRD.md`, ce sur quoi on s'est déjà cassé les dents dans `docs/PIEGES.md`.
>
> **Dégraissé le 2 septembre 2026.** Il pesait 173 Ko dont plus des trois quarts racontaient
> du travail fini, et il s'ouvre à chaque séance. Le détail des cinq versions livrées est
> descendu dans `docs/archive/plan-versions-tenues.md`, **sans qu'un mot change**. Ce qui en
> est remonté ici, et ne devait pas descendre : **les invariants**, parce qu'un invariant
> instauré vaut pour toutes les tranches suivantes.

---

## Où en est le dépôt

| Version | Ce qu'elle a apporté | État | Où lire |
|---|---|---|---|
| **V1** — T1 à T10 | La première image, le traitement non destructif, la bibliothèque, l'univers, la découpe, l'export, l'agent, la toile | **tenue** | archive § V1, `docs/tranches/T*.md` |
| **V2** — C1 à C5 | Le personnage, son plan de poses, le lot plié, la pièce et le calque, la main, la sortie | **tenue** | archive § V2, `docs/tranches/C*.md` |
| **R1 à R5** | Cinq reprises d'usage : le réglage qui se voit, ce qui décide de l'apparence, l'import depuis l'écran, l'infobulle, le calque qui se recale | **tenues** | archive § reprises, `docs/tranches/R*.md` |
| **V2.1** — E0 à E20 | L'interface refaite : trois lieux au lieu de sept surfaces, le codex, l'établi, la galerie | **tenue** | archive § V2.1, `docs/tranches/V2.1.md` |
| **U1 à U13** | Treize reprises de deux séances d'usage sur l'interface refaite | **tenues** | archive § U, `docs/tranches/U.md` |
| **V2.2** — F0 à F6 | D'autres fournisseurs, dont un qui ne demande ni compte ni clé | **close à 5 sur 6** — reste `F4`, qui attend un compte Cloudflare | archive § V2.2, `docs/tranches/V2.2.md` |
| **R6** | La planche qui revient de travers ne se jette plus | **close le 3 septembre 2026, hors version** | ci-dessous |
| **R7** | Le texte qui part s'organise en trois parties | **close le 3 septembre 2026, hors version** — construite *pour la relisibilité seule*, contre une mesure qui disait non | ci-dessous, `docs/tranches/R7.md` |
| **R8**, **R9** | Deux écrans qui ne disaient pas à quoi ils servaient : la fiche d'une chose, le calibrage | **closes le 3 septembre 2026, hors version** | ci-dessous, `docs/tranches/R8.md` et `R9.md` |
| **V2.3** — D1 à D5 | Le traitement cesse d'être à refaire | **close le 3 septembre 2026, cinq sur cinq** — le réglage de départ, la réduction et la grille retrouvée, le fond du jeu, les moteurs et le contour net, les tailles | ci-dessous |
| **V2.4** — M1 à M7 | Ce qui est cassé se répare avant qu'on anime : une image payée qu'un découpage vide, un écran qui fige à chaque lettre, une case dont on ne savait pas laquelle des deux images part — et le coin du parcours où l'on fabrique un calque se redessine | **ouverte le 4 septembre 2026, cinq closes sur sept** — née des remarques d'usage des 3 et 4 septembre, instruites une par une ; `M1`, `M3` et `M4` réparent des pertes mesurées, `M2` ne construit rien et dessine, et `M6` a été **close le jour de sa naissance** — la règle existait, seul l'écran manquait. `M1` a fermé le même soir, et sa mesure a élargi le défaut : le geste était cassé pour **les neuf pièces du dépôt**, pas pour deux ; `M3` a fait tomber les lectures du projet de **42 à 1** par demande ; `M4` a rendu à l'écran de confirmation le droit de nommer la troisième image pour ce qu'elle est, et cessé d'envoyer au modèle **la description d'une grille qui n'existe pas** | ci-dessous |
| **V2.5** — N1… | Le design reprend la main : l'audit du 31 août 2026 repris, puis ce qu'on garde de la densité et ce qu'on rouvre | **ouverte le 4 septembre 2026, une seule tranche écrite** — `N1` est un relevé et ne touche aucun écran ; la suite ne s'écrit qu'après lui | ci-dessous |
| **V3** — l'animation | Animer un personnage **par la vidéo**, chez un fournisseur **ou sur la carte de la maison**, et découper le clip image par image | **refondue le 2, recadrée le 3 septembre 2026, non ouverte** ; `A0` clos, le serveur d'`A9` écrit et éprouvé | ci-dessous |
| **V3.1** — G1 à G16 | L'atelier tient ce qu'il dit : les phrases devenues fausses, l'attente qu'on ne voit pas, les explications décrochées, les gestes qu'on ne trouve pas | **ouverte, 2 closes sur 16** — `G1` et `G16` closes le 3 septembre 2026, la seconde **prise hors tour** à la demande de l'auteur ; l'arbitrage de `G15` est écrit et retourne son titre, mais **rien d'autre n'y est construit : la V3 passe devant** — `R7`, `R8`, `R9` et la V2.3 entière sont closes | ci-dessous |
| **V3.5** — P1, P2 | Le dépliage généralisé : la planche se garde, son découpage se refait, et il s'ouvre aux objets | **née du recadrage du 3 septembre 2026, non ouverte** | ci-dessous |
| **V4**, **V5** | Les tuiles qui se raccordent, le son | **non découpées** | `docs/archi-versions.md` §9 et §10 |

**Ce que chaque tranche a appris en se construisant** est dans `docs/status/etat.md`, les
plus récentes en tête. Il ne fait foi sur rien et ne se lit pas au démarrage d'une séance.

---

## Les invariants du produit

**Un invariant instauré ne se renégocie plus** : chaque tranche suivante le conserve, et c'est
un critère d'acceptation de chacune. Les versions qui en ont révisé un l'ont écrit noir sur
blanc, et la révision figure ici à la place de l'ancienne règle.

### L'argent et l'appel

| L'invariant | Depuis |
|---|---|
| L'identifiant de génération est unique — deux soumissions ne facturent qu'une fois | T1 |
| Ce qui est enregistré est ce que l'appel a **consommé**, dans l'unité du fournisseur, jamais un chiffre annoncé | T1, *élargi en F2 : l'unité change, la règle ne change pas* |
| Un total en argent ne compte que de l'argent | F2 |
| Un chiffre de réserve dit toujours s'il est relevé chez le fournisseur ou compté ici | F2 |
| **Rien n'est jamais relancé automatiquement** | T1 — la règle la plus ancienne du produit |
| Aucun repli automatique d'un fournisseur sur un autre — ce serait une relance, et elle appartient à l'auteur | F1 |
| Une dépense ne s'efface jamais — une image supprimée change l'état de son appel, jamais sa ligne | E18 |
| Le texte montré avant de payer est demandé par le chemin même que l'envoi emprunte | E14 |
| Une correction faite avant de payer vaut **pour cet appel seulement** ; garder est un second geste écrit | E14 |
| Une seule barre de saisie dans tout le produit, et deux lieux seulement d'où l'argent part | E2 |

### Ce qui décide, et ce qui refuse

| L'invariant | Depuis |
|---|---|
| Le catalogue décide, jamais une liste en dur — **l'adaptateur répond, et jamais de mémoire** | T1, *révisé en F1 : soit il relit le fournisseur, soit il sert une fiche datée, et l'écran dit laquelle* |
| Les dimensions mesurées font foi, jamais celles demandées | T1 |
| Ce qui est indisponible est grisé avec sa raison, jamais proposé puis refusé | T1, *déplacé en E3 : ça s'ouvre quand même et porte sa raison à la place de ses réglages* |
| **Un compte d'images *insuffisant* est le seul refus automatique du produit** — toute autre mesure informe, et arrête au plus la planche pour demander un regard | C2, *devenu littéralement vrai en V2.1 ; **réécrit en R6** : un sujet en trop ne refuse plus, il se choisit ; un carré plein ne s'accepte plus en silence, il se signale* |
| L'auteur déclare, l'application enregistre — jamais l'inverse | C3, et partout depuis |

### Le traitement des images

| L'invariant | Depuis |
|---|---|
| Le traitement est **non destructif** : image brute + recette, le rendu est un cache effaçable | T2 |
| Le post-traitement ne touche jamais la carte graphique, et n'appelle jamais le fournisseur | T2 |
| Aucun modèle **génératif** local. Un modèle de *segmentation* sur processeur est admis comme moteur de détourage **facultatif**, grisé avec sa raison quand il n'est pas là ; le geste courant n'en demande aucun | T1, précisé en T2 |
| Une place de recette décrit **cette** image ; une fabrique en produit d'autres, et n'a pas d'état | E3 |
| Le carré d'une place se remplit quand elle **change l'image**, pas quand elle figure dans la recette | E3 |
| Une coordonnée ne voyage pas — ni cadre tracé, ni point de pipette, ni forme entourée, ni passage de la main | lot U |
| Une place s'éteint sans se vider : éteindre et vider ne sont pas le même geste | lot U |

### Le rangement

| L'invariant | Depuis |
|---|---|
| Les fichiers font foi, la base est un index reconstructible | T3 |
| **Une seule grille d'assets dans tout le produit** — la matrice d'une chose, la réserve, les dépenses et **la colonne des sœurs** n'en sont pas : ni recherche, ni filtres, ni sélection multiple | T3, *reformulé en E1, **amendé en `G12`** : la colonne des sœurs est une quatrième surface, et elle porte une sélection parce qu'elle est l'ensemble déjà sous les yeux* |
| Tout ce qui ne demande pas le fournisseur fonctionne **réseau coupé** | T3, reconduit partout |
| Écrire un nom crée la chose, sur-le-champ, sans formulaire et sans rien payer | C1, généralisé en E2 |
| Une case est prise dès qu'une image la porte, pas parce que l'image est bonne | E2 |
| Une jauge ne compte que ce qu'on peut fabriquer maintenant | E12 |
| Le manque n'a aucune couleur d'alerte, et rien ne réclame jamais rien | E2 |
| Aucun écran n'est obligatoire : l'assistant se saute à n'importe quelle étape | E19 |

### Le personnage, la planche et le calque

| L'invariant | Depuis |
|---|---|
| Le corps naît dans l'atelier et nulle part ailleurs | C1, *reformulé en E2 : une seule barre de saisie, deux lieux qui paient* |
| Le plan appartient au projet, jamais au personnage | C1 |
| **Le pliage est une fonction générale de l'atelier** — habiller ou transformer N images d'un seul appel | C2 |
| ~~Le pliage est une ruse d'appel, jamais un format de livraison~~ | C2, **renversé en G16** : une planche entre en bibliothèque, s'y regarde et s'exporte. `P1` en garde la seconde moitié — elle se déplie autant de fois qu'on veut |
| Rien n'est ajouté à l'image envoyée pour aider le recalage — ni ancre, ni mire, ni silhouette | C3 |
| Le corps d'origine n'est jamais modifié : le calque est rangé à côté de l'image payée | C3 |
| **Un calque est solidaire de sa pose** — il en faut un par pose, et c'est le pliage qui en divise le prix | C3 |
| Une planche ne porte qu'une seule chose du jeu | E13 |

### Les fournisseurs

| L'invariant | Depuis |
|---|---|
| Un modèle se nomme par son fournisseur **et** par son nom ; les deux ensemble, jamais l'un seul | F1 |
| Un fournisseur injoignable grise ses modèles et n'en efface aucun autre | F1 |
| **Aucune image de l'auteur n'est publiée à une adresse lisible par un tiers** pour servir de référence | F1 |
| Retirer une clé grise, et n'efface jamais ni une image ni une dépense | F3 |
| Ce que le produit ajoute de lui-même cède devant le plafond du modèle ; ce que l'auteur a joint ne cède jamais | F6 |
| ~~La clé du fournisseur est le seul préalable dur du produit~~ | T1, **tombé en F1** : sur une machine où rien n'a été déposé, une image arrive |

### L'écran

| L'invariant | Depuis |
|---|---|
| Aucune largeur ni hauteur inventée — hauteurs `44 · 38 · 34 · 30 · 26`, largeurs `380 · 300 · 240` | E1 |
| Un onglet ne se recouvre pas : trois lieux, et l'établi est une profondeur, pas un quatrième onglet | E1 |
| Le total affiché dit toujours de quoi il est le total, et il est cliquable | E1 |
| La barre d'espace montre en grand n'importe quelle vignette, partout, sans exception | E0 |
| Le MCP n'a aucune logique propre : il appelle les services de l'écran | T7 |
| **Une explication ne se recopie jamais** : ce qu'un écran écrit à demeure pour dire à quoi sert un réglage est **lu dans le recueil**, jamais retapé dans l'écran | R4, *étendu en `R8` : la règle valait pour la bulle et le guide, elle vaut désormais pour la ligne écrite sous un titre — et `R9` l'a employée le lendemain sur le calibrage, dont l'explication dormait écrite depuis six jours* |
| **Une explication écrite pour un réglage est atteignable depuis ce réglage** — l'autre bout de la règle du dessus, et un essai le tient | `G3` — 23 entrées sur 122 étaient écrites et accrochées à rien |
| **Un curseur envoie ce qu'on a lâché, pas ce qu'on a traversé** — et un essai le tient | R4 *écrit le 27 août, non tenu quatre fois ; devenu vérifiable en `G4`* |
| **Une bascule se pose contre ce qu'elle commande** | `G7`, *révise la règle d'`E1` qui les regroupait toutes dans la barre du haut : la raison était qu'un geste unique se cherche à un endroit unique, l'usage a dit le contraire* |
| **L'assistant s'ouvre sur un jeu qui n'a rien** — le premier comme le cinquième | `G8`, *révise `E19`, qui refermait la porte à la création d'un second jeu* |
| ~~Sur la toile, un menu ne se borne pas : on déplace la carte ou on dézoome~~ | *`E1`, **tombé en `G6`** : le plan est infini, le regard ne l'est pas — et l'objection du zoom a été levée par l'ancre d'écran* |

---

## Couverture des user stories

**503 user stories écrites**, dont **493 portées par une tranche**, dans `docs/user-stories.md`.
Le détail par tranche des versions tenues est dans l'archive.

| Bloc | User stories | Nombre |
|---|---|---:|
| V1 — T1 à T10 | 1 à 114 | 114 |
| V2 — C1 à C5 | 115 à 157 | 43 |
| Reprises R1 à R5 | 158 à 173 | 16 |
| V2.1 — E0 à E20 | 174 à 308 | 135 |
| V2.2 — F0 à F6 | 309 à 333 | 25 *(2 sans objet, F5 retirée)* |
| Les cinq capacités du lot U | 334 à 366 | 33 |
| **R6** | **367, 368** | **2** |
| **V2.3 — D1 à D5** | **407 à 430**, plus **476 à 481** | **30** |
| **R7** | **431 à 433** | **3** |
| **R8** *(la fiche d'une chose)* | **462 à 468** | **7** |
| **R9** *(le calibrage)* | **469 à 475** | **7** |
| **V2.4 — M1 à M7** *(ce qui est cassé, et le coin redessiné)* | `US-504`, `US-505` | **2** *(les deux sont de `M6`, close. Les cinq autres n'en ouvrent aucune : `M1` rend son sens à `US-503`, écrite pour `G16` ; `M3` tient `US-296`, `M4` et `M5` tiennent `US-126`, et `M4` ferme une phrase du genre de `G1` ; `M2` est une maquette, et une maquette n'a pas d'utilisateur qui la demande — c'est le cas d'`E0`, `F0` et `A0`)* |
| **V2.5 — N1…** *(le design reprend la main)* | **aucune** | **0** *(`N1` est un relevé, comme `E0`, `F0` et `A0`)* |
| **V3 — A2, A4 à A7, A9 à A13** *(l'animation)* | **376, 379 à 388, 390 à 400, 434 à 461, 482 à 490** | **59** |
| **V3.1 — G1 à G16** *(l'atelier tient ce qu'il dit)* | **495 à 501**, plus **369** *(reprise à `P1`)* et **502, 503** | **10** *(les quarante-trois autres changements tiennent des stories déjà écrites)* |
| **V3.5 — P1, P2** *(le dépliage généralisé)* | **370 à 374, 491 à 494** | **9** *(`369` est partie en `G16` le 3 septembre 2026)* |
| *Retirées le 3 septembre 2026, dépassées par l'écran de montage et par `D4`* | *375, 377, 378, 389* | *4* |
| *Sorties du plan avec le pantin* | *401 à 406* | *6* |
| | **Total écrit** | **505** |

*Les numéros suivent le jour où la story a été écrite, jamais l'ordre de construction* : la
V2.3 se construit avant la V3 et porte pourtant les numéros d'après. C'est déjà vrai des
reprises R1 à R5, et ça évite de renuméroter un catalogue que des critères citent.

**Ce que le recadrage du 3 septembre 2026 a changé à ce tableau.** Les stories `369` à `406`
formaient un seul bloc « V3 » ; elles se répartissent maintenant entre trois destinations, parce
que la version ne fait plus qu'animer. **Treize stories neuves** — `482` à `494` — portent ce que
l'auteur a demandé ce jour-là : couvrir toute la matrice d'un personnage en animation, attraper
une image d'un clip pour s'en servir ailleurs, et ouvrir le dépliage à plusieurs sujets.

*Et le total annoncé ici était faux de six depuis le début : le tableau disait 475 là où ses
propres lignes en comptaient 481. Corrigé en passant, sans qu'aucune story bouge.*

**Ce que la V3.1 ajoute à ce tableau, et pourquoi c'est si peu.** Neuf stories neuves pour seize
tranches, plus une reprise à `P1` : c'est la marque de cette version. **Elle ne promet presque rien de neuf** — elle tient
ce qui avait déjà été promis, construit ou décidé. Les quarante-trois autres changements
n'ouvrent aucune story parce qu'ils en servent d'anciennes que le produit avait cessé d'honorer :
`G2` sert `US-6` et `US-13`, `G3` sert `US-268`, `G5` sert `US-352`, et `G9` **rouvre `US-189`**,
comptée livrée alors que son geste n'existait pas.

**`G16` est la seule exception à cette économie, et elle s'explique** : c'est la seule tranche de la
version qui **reprend une story à une autre** — `US-369`, *retrouver la planche entière dans la
galerie*, écrite pour `P1` et livrée ici parce que l'auteur en a besoin trois versions plus tôt.
Ses deux stories neuves — `502` et `503` — sont ce que `P1` ne prévoyait pas : **voir la case telle
qu'elle est revenue**, et **refaire son calage à la main**.

**A0 ne porte aucune user story**, et c'est la troisième du dépôt dans ce cas — après E0 et
F0 : c'est un relevé, et un relevé n'a pas d'utilisateur qui le demande.

---

## L'ordre de ce qui reste, et les deux endroits où il se resserre

```
R6  ✔ close le 3 septembre 2026 — hors version
 │
 ▼
V2.3  ┌ D1  le réglage de départ  ✔ close ┐  ✅ close, cinq sur cinq,
      ├ D2  la réduction ✔ · la grille ✔ │  le 3 septembre 2026
      ├ D3  le fond              ✔ close  │  D3 n'a pas coûté de banc :
      ├ D4  les moteurs, le contour ✔     │  deux mesures l'ont remplacé
      └ D5  les tailles          ✔ close  ┘  D4 attendait D2, qui était close
 │
 ▼
V2.4  ┌ M1  le découpage du coin ✔ close   ┐  ouverte le 4 septembre 2026,
      │ M2  la maquette du coin ✔ dessinée │  cinq closes sur sept.
      │ M3  l'écran ne fige plus ✔ close   │  Aucune n'en bloque une autre.
      │ M4  la planche dit vrai ✔ close    │  M2 dessine, les autres réparent.
      ├ M5  la référence qui manque ───────┤  La tranche qui bâtit l'écran de
      ├ M6  laquelle part      ✔ close     │  M2 ne s'écrit qu'après elle.
      └ M7  le détourage complet ──────────┘
           ▲ après M4, qui refait la
             liste où son geste se pose    M3, M4 et M5 sont le même écran,
                                           pris par trois bouts : ce qu'il
                                           fait, ce qu'il dit, ce qu'il perd.
                                           M4 seule change ce qui part au
                                           modèle, et le plan l'écrit.

                                           M6 est ailleurs : la matrice de la
                                           fiche, où aucune des cinq n'entre.
                                           Close le jour où elle est née — la
                                           règle existait, seul l'écran
                                           manquait.
 │
 ▼
V2.5    N1  l'audit de design repris        ouverte le 4 septembre 2026.
                                            N1 est un relevé : il ne touche
        N2… ne s'écrit qu'après N1          aucun écran, et il bloque tout
                                            le reste de la version.
 │
 ▼
V3    A6  le mouvement, dit une fois pour toutes
       │                                     A2  le cadre qui ne dérive pas
       ▼                                      │   n'attend rien et n'est attendue
      A9  commander un clip, et l'attendre    │   que par A10 : à faire quand on
       │   ← le serveur est écrit ;           │   veut, de front avec A6 ou A9
       │     l'écran et la file restent       │
       │                                      │
       ├──► A11  le moteur de la maison       │
       │         ne bloque rien, mais c'est   │
       ▼         lui qui rend A12 tenable     │
      A10 le montage — le cœur de la version ◄┘
       │
       ├──► A12  toutes les poses, en animation   ← l'objectif de la version
       ├──► A13  l'image attrapée au vol
       ├──► A4   la bande sort de l'atelier
       ├──► A5   le contour qui ne bout pas       (D2 l'attendait, elle est close)
       └──► A7   reprendre une image sans refaire la bande

      A0  clos le 2 septembre 2026 — son verdict est plus haut

 │
 ▼
V3.1  ① G1   les phrases devenues fausses  ✔ close ┐  quinze tranches, et
                                                    │  aucune n'en bloque une
      ② G2   la barre d'attente revient             │  autre. L'ordre des
        G3   les 23 explications s'accrochent       │  familles est celui de
        G4   les curseurs posent au relâchement     │  la thèse, pas une
        G5   le geste qu'on ne trouve pas           │  contrainte : on peut
                                                    │  entamer par ④ si
      ③ G6   le menu ne sort plus de l'écran ──┐    │  l'usage le réclame
        G7   l'écran de l'univers se refait ◄──┘    │
        G8   l'accueil s'ouvre sur chaque jeu neuf  │  G6 est jetée par G7,
                                                    │  et c'est assumé
      ④ G9   démarrer la première pose              │
        G10  le zoom des tables monte               │  G11 est le seul point
        G11  éteindre un type d'objet               │  qui touche au disque
        G12  une recette sur plusieurs images       │
                                                    │  G13-G15 s'arbitrent
        G13  le modèle « lourd » ne détoure rien    │  avant d'être
        G14  le calage effacé en silence            │  construites
        G15  aucune couleur réduite, sans le dire   ┘

      ⑤ G16  ce qui est revenu du modèle se voit ✔ close le 3 sept. 2026,
             et se reprend à la main               prise hors tour : elle est
                                                   passée devant la V2.3 et la
                                                   V3, sans rien déplacer
 │
 ▼
V3.5  P1  la planche se garde, son découpage se refait   ← ex-A1, sortie de la V3
       │
       ▼
      P2  une planche pour plusieurs choses

R7  le texte en trois parties  ✔ close le 3 septembre 2026 — hors version
R8  la fiche d'une chose       ✔ close le 3 septembre 2026 — hors version
R9  le calibrage               ✔ close le 3 septembre 2026 — hors version
```

**Deux resserrements, et ils ne sont pas négociables.**

1. **La V2.3 passe entièrement avant la V3**, et le passage à la vidéo rend cette règle **plus
   contraignante, pas moins**. Le geste principal de la V3 est *découper plusieurs bandes dans un
   clip*, et l'écran de montage montre en direct la bande **passée par la chaîne du produit** :
   détourage, grille, palette. Un traitement qu'il faut refaire à la main sur chaque image
   transforme ce geste en corvée, et une bande mal ramenée sur sa grille n'est **pas jugeable du
   tout**. *Tranché avec l'auteur le 2 septembre 2026.*
2. **La V3 ne s'ouvre pas avant que la V2 serve pour de vrai** — même règle que la V2, qui n'a
   commencé qu'une fois la V1 tenue.

*Le troisième resserrement — `R6` d'abord — est levé : elle est close depuis le 3 septembre 2026.*

**La V3.1 n'en ajoute aucun, et c'est délibéré.** Elle répare ce qui existe : aucune de ses quinze
tranches n'attend une autre, et aucune ne bloque la V3.5. Sa place après la V3 vient de l'objectif —
l'animation d'abord —, pas d'une dépendance. *Si une gêne devient insupportable à l'usage, sa
tranche se prend seule, sans rien déplacer.* Les deux seuls liens internes sont écrits dans le
diagramme : `G6` disparaît avec `G7`, et `G12` réclame une réparation avant elle.

**Le critère de découpage ne bouge pas**, celui des cinq versions précédentes, mot pour mot :
*chaque tranche est utilisable à sa livraison, et on ne passe à la suivante que lorsque la
précédente sert vraiment.*

> ⚠️ **Une exception assumée, et la seule de la version.** `A9` livrée seule pose l'écran de
> commande et fait arriver un clip dans la bibliothèque — c'est utilisable. Mais **son serveur a
> été écrit avant son écran**, et pendant cet intervalle la tranche n'était démontrable que par
> ses essais. C'était le bon ordre — le port asynchrone et l'écriture de la dépense sont ce qui
> pouvait faire perdre de l'argent, et il valait mieux les tenir d'abord —, mais il faut l'écrire
> plutôt que de le laisser passer pour la règle.

**Et un critère de plus, propre à la V3 : chaque tranche rend une animation plus facile ou moins
chère à obtenir.** C'est l'ordre dans lequel elles sont rangées. `A6` et `A2` préparent le
terrain, `A9` et `A10` fabriquent la première animation, **`A11` en amène le prix à zéro**, `A12`
la répète sur toute la matrice, et les quatre dernières la rendent bonne et sortable.

**`A11` ne remplace aucune des autres**, elle change l'échelle : un moteur gratuit ne dispense ni
de recadrer d'un seul tenant, ni de découper, ni de faire sortir. Ce qu'il change, c'est que
*lancer plusieurs clips et garder le bon* cesse d'être un arbitrage de dépense — et sans ça,
couvrir vingt-quatre cases se compte en dollars à chaque essai raté.

---

## R6 — la planche qui revient de travers, **close**

*Décidée le 2 septembre 2026, **construite et close le 3**. Elle n'appartient à aucune version,
et c'est délibéré : elle répare aussi les planches d'équipement que la V2 produit déjà, et elle
se rembourse le jour où elle est prise. Ce qui suit garde le raisonnement qui l'a ouverte —
c'est lui qui explique les décisions, et il se relit mieux que sa conclusion.*

> **Ce que la refonte de la V3 lui ajoute, le 2 septembre 2026.** Le seul gain mesuré du côté
> planche atterrit ici, faute de tranche pour l'accueillir ailleurs : une grille de **quatre
> colonnes sur deux rangées** bat le 3×3 à case vide — **2 bonnes sur 2 contre 1 sur 2, aucun
> sujet en trop**, là où le 3×3 laisse une case que le modèle remplit. La mesure est mince
> (deux tirages contre deux) et demande à être confirmée à huit avant de changer la formule.
>
> ⚠️ **Et elle ne se change pas sans précaution.** La géométrie d'une planche est aujourd'hui
> *déduite* du nombre de cases et **jamais enregistrée** — « deux planches du même compte ont la
> même géométrie, et la garder dans le fichier en ferait une seconde vérité ». Changer la
> formule redécouperait donc **toutes les planches anciennes** sur une grille sur laquelle elles
> n'ont pas été dessinées, ce qui contredit frontalement la promesse de `P1`. **La géométrie doit
> s'écrire sur le pliage le jour où la formule change**, et les planches d'avant gardent la
> leur. Sans cette ligne, le gain se paie en historique cassé. *(C'était `A1` jusqu'au 3 septembre
> 2026 ; la tranche est descendue en V3.5 avec le reste du dépliage, et le critère l'a suivie.)*

**Le compte est le seul refus automatique du produit, et il jette du travail payé.** Sur le
banc d'animation, **quatre planches sur treize ont été refusées pour un sujet de trop** — neuf
au lieu de huit, le modèle ayant complété une grille que le gabarit ne dessinait qu'aux trois
quarts. Trente-et-un pour cent des appels perdus, sur un geste dont c'est le régime normal
(`docs/archive/essais-v3/essai-animation.md`). La règle *« seul le compte refuse »* a été
écrite pour un lot de poses, où une case en trop n'a pas de sens ; sur une planche, elle coûte
de l'argent.

**Et le contrôle qui manque à côté est plus grave, parce qu'il ne se voit pas.** Quand un
modèle redessine les traits du quadrillage, le remplissage depuis le bord **s'arrête sur eux** :
le fond de chaque case reste opaque, huit cases bordées font huit taches, le compte tombe juste,
l'atelier accepte, et il en tire **huit carrés pleins**. **Le produit garde du vide payé en
silence, ce qui est pire que refuser.**

> **Mesuré le 3 septembre 2026, et la première estimation était fausse dans les deux sens.**
> Elle disait *« 64 % de chaque vignette reste opaque, contre 34 % pour une planche saine »* ;
> la chaîne du produit passée sur les **135 planches des deux bancs** dit autre chose, et dit
> mieux :
>
> | | remplissage de la boîte du sujet | planches |
> |---|---|---|
> | planche saine | **0,34 à 0,77**, médiane 0,63 | 32 à huit sujets sur le banc des recettes |
> | quadrillage redessiné | **0,99 à 1,00** | **47 sur 95** du même banc |
>
> Les deux populations **ne se touchent pas** : il n'y a rien entre 0,77 et 0,99, et le seuil
> est posé au milieu du vide, à **0,90**. C'est la formulation d'US-368 — *« plus de neuf
> dixièmes de sa boîte »* — qui avait raison, pas le chiffre du plan.
>
> ⚠️ **Et la mesure se prend dans la boîte, jamais dans la vignette découpée.** La vignette est
> taillée dans les octets d'origine, fond compris : elle est opaque à **1,00 sur toutes les
> planches, saines comprises**, et ne sépare donc rien. C'est ce que « 64 % de chaque vignette »
> aurait fait chercher au mauvais endroit.
>
> **L'ampleur, elle, était sous-estimée.** Quarante-sept planches sur quatre-vingt-quinze — une
> sur deux — sont entrées en bibliothèque comme des cases bordées dont les deux tiers sont du
> fond. Là où le sujet en trop coûte **31 % des appels d'une planche**, celui-ci en abîmait la
> moitié sans qu'aucun écran le dise.

### R6 · Une planche qui revient de travers ne se jette plus
*2 US (367–368)*

**Ce qu'on livre.** Une planche qui rend plus de sujets que demandé n'est plus refusée : elle
s'ouvre avec ses cases en trop signalées, et l'auteur écarte celles qu'il ne veut pas. Et une
« silhouette » qui occupe plus de neuf dixièmes de sa boîte est annoncée pour ce qu'elle est —
une case, pas un sujet —, avant que quoi que ce soit entre en bibliothèque.

**Critères d'acceptation**

- [x] Une planche à neuf sujets pour huit demandés entre, avec le choix de la case à écarter
- [x] Une planche à sept sujets pour huit demandés reste refusée — il y manque une étape
- [x] Le taux de remplissage de chaque sujet est mesuré et affiché avant l'entrée en bibliothèque
- [x] Une planche au quadrillage redessiné est signalée en toutes lettres, jamais acceptée en silence
- [x] L'appel payé reste au journal avec son coût, refus ou non
- [x] Vérifié sur une planche réelle de chaque cas — *deux prises dans `essais/resultats_recette/`,
      la troisième dans `essais/resultats_animation/`, parce que le banc des recettes ne porte
      **aucun** surplus propre : ses planches en trop sont toutes quadrillées*

**Bloquée par** — aucune, démarrable immédiatement.

### Où en est la tranche

*Close le 3 septembre 2026. 25 essais dans `tests/test_r6.py`, 8 de plus dans
`interface/src/App.test.tsx`, tous gratuits.*

| Ce qui a été fait | Où |
|---|---|
| Le remplissage de chaque sujet, et sa boîte | `atelier/image/pliage.py` · `MesuresLot` |
| Le seuil, mesuré et documenté | `atelier/domaine/pliage.py` · `SEUIL_PLEINE` |
| Ce que l'arrivée a trouvé, et la décision de l'auteur | `atelier/domaine/pliage.py` · `Pliage` |
| Le surplus ne refuse plus, il ouvre | `atelier/services/pliage.py` · `ChoixAttendu` |
| Le geste qui tranche, et qui ne repaie rien | `atelier/services/generation.py` · `ecarter` |
| L'écran du choix | `interface/src/composants/Depliage.tsx` |

**Trois décisions durables, prises en la construisant.**

1. **Un surplus s'ouvre, un manque refuse.** Neuf sujets pour huit contiennent tout ce qui a
   été demandé ; sept n'en contiennent pas assez, et **aucun choix ne fabriquera l'étape qui
   manque**. C'est la seule asymétrie de la tranche, et elle tient en cette phrase.
2. **`null` et `[]` ne disent pas la même chose.** *Personne n'a regardé* d'un côté, *j'ai
   regardé et je garde tout* de l'autre. Sans cette distinction, une planche aux cases pleines
   entrerait en silence — ce que la tranche existe pour empêcher —, et « garder tout » cesserait
   d'être une décision.
3. **Une planche qui attend reste au chantier**, bien que son emplacement soit *réussi*. Trouvé
   en regardant l'atelier, pas en lisant le code : sans cette ligne, sa tuile quittait la grille
   à l'arrivée et aucune image ne prenait sa place. L'appel payé s'évanouissait sous les yeux de
   l'auteur — le gâchis silencieux de la tranche, refait à l'identique par sa propre réparation.

---

## R7 — le texte qui part s'organise, **close le 3 septembre 2026**

*Décidée le 2 septembre 2026 sur désaccord explicite de l'auteur avec la conclusion des bancs,
puis **mesurée le même jour, et le désaccord a été tranché contre elle**. Rouverte et construite
le 3 septembre 2026, **pour la relisibilité seule**, sur décision de l'auteur prise en
connaissance du chiffre. Elle n'appartient à aucune version, comme `R6`.*

**Sept critères cochés, 18 essais serveur ; le détail est dans `docs/tranches/R7.md`.**

> ## ⚠️ La mesure disait non, et elle est construite quand même — lire ceci avant de la rouvrir
>
> **Ce que la tranche pariait a été essayé, et n'a rien donné.** Le pari était que *ranger* ce
> qui part vaudrait mieux que le *réécrire*, et surtout que **nommer chaque image jointe** —
> « celle-ci est le style, celle-là est le personnage, celle-là est la grille » — était *la
> partie dont on peut attendre quelque chose*. Cinq variantes ont été tirées le 2 septembre
> 2026, à images égales et témoin neuf :
>
> | La variante | Ce qu'elle changeait | Bonnes planches |
> |---|---|---|
> | le témoin | rien | 2 sur 4, puis 1 sur 2 |
> | les références nommées | une ligne par image jointe, disant ce qu'elle est | **0 sur 4** |
> | trois titres posés dessus | contexte, références, demande | **0 sur 4** |
> | vraiment rangé | sept sections, la vue dite une fois, les exclusions regroupées | **0 sur 2** |
> | rangé, plus la priorité des images | et si les images se contredisent, laquelle décide | **0 sur 2** |
> | entièrement réécrit par une IA | tout, d'après trois relectures externes | **0 sur 2** |
>
> **Aucune ne passe la barre, et le pavé du produit les bat toutes.** La règle écrite d'avance
> disait *au moins la moitié de bonnes, sinon on n'insiste pas* : elle s'applique.
>
> **Ce qui reste vrai malgré tout, et qui ne se mesure pas en taux** : le texte qui part est un
> pavé, et l'écran qui le montre montre un pavé. Si la tranche revient un jour, ce sera pour la
> **relisibilité seule**, sans rien promettre sur le résultat — et en sachant que trois façons
> de ranger ont déjà échoué. *Le détail des tirages est dans `essais/verdict-essais.json`.*
>
> **Elle est revenue le lendemain, sur cette base-là exactement**, et c'est l'auteur qui l'a
> tranché après avoir relu le tableau ci-dessus. Ce qui est construit est donc **la relisibilité
> et rien d'autre** : aucune amélioration de taux n'est promise, ni dans le code, ni dans le
> recueil, ni sur l'écran. Les deux variantes reprises — les trois titres et les références
> nommées — sont recopiées **mot pour mot** du banc, pour qu'un tirage futur mesure la même
> chose que celui qui a déjà été payé ; `tests/test_r7.py` compare les deux à chaque exécution.
>
> **Ce qui n'a pas bougé, et c'est ce qui rendait la tranche faisable** : la caméra ferme
> toujours le texte. Elle appartient à *la demande*, qui est la troisième partie, et elle en est
> la dernière ligne. Le seul déplacement est le bloc des références, qui remonte au deuxième
> rang — et c'est celui que le banc avait tiré.

**Ce que les bancs ont mesuré, et ce qu'ils n'ont pas mesuré — la distinction est tout.** Trois
bancs payés ont établi que **réécrire la demande ne donne rien** : cinq réécritures de fond,
zéro bonne planche sur vingt. J'en avais conclu *« le texte du produit ne bouge pas »*, et
c'était aller trop loin. **Ce qui a été essayé, ce sont des formulations** — dire la même chose
avec d'autres mots. **Ce qui n'a jamais été essayé, c'est la mise en page** : ranger ce qui part
en parties nommées au lieu d'un bloc continu.

*« Il faut quand même revoir la mise en page du prompt pour qu'il soit mieux organisé et
clarifié, en séparant bien les infos de contexte, les références, et ce qu'on demande exactement
au modèle. »*

**Ce qu'on livre.** Le texte qui part cesse d'être un bloc. Il se range en trois parties
nommées, et l'écran qui montre ce qui va partir les montre séparément :

- **le contexte** — ce que le jeu est, son style, sa palette, sa vue, ce qui vient de la bible
  et de l'ambiance ; c'est ce qui ne change pas d'une image à l'autre ;
- **les références** — les images jointes, **et ce que chacune est** ; c'est le point le plus
  concret de la tranche, voir ci-dessous ;
- **la demande** — le sujet, l'attitude, la direction, le nombre de cases : ce qu'on veut
  **cette fois-ci**, et rien d'autre.

> ⚠️ **Une image jointe ne dit pas ce qu'elle est, et c'est un défaut relevé à l'usage.** Le
> produit envoie aujourd'hui un artwork de style, un gabarit de découpe et un sprite de
> référence de pose **dans le même sac**, sans qu'une ligne dise lequel est lequel. Un modèle
> qui reçoit une image de style peut la prendre pour une consigne de posture — et c'est
> exactement le comportement qui a donné le gabarit : *le modèle recopie la structure de son
> entrée*. **Nommer chaque image jointe est la partie de cette tranche dont on peut attendre
> quelque chose**, bien plus que la mise en page elle-même.

**Ce que ça ne promet pas.** Aucune amélioration du taux d'une bonne planche sur dix n'est
promise ici : ce n'est pas mesuré, et les bancs invitent à la prudence. Ce que la tranche
livre à coup sûr, c'est **un texte relisible** — et le produit a déjà un écran fait pour ça,
qui montre aujourd'hui un pavé.

> ⚠️ **Elle change ce qui part au fournisseur, comme `D3`.** Les 135 notes d'animation restent
> valables entre elles, **jamais contre un tirage postérieur**. Prendre `R7` et `D3` avant la
> V3 groupe cette rupture en une seule fois, au lieu de l'étaler.

### R7 · Le texte qui part se lit en trois parties
*3 US (431–433)*

**Critères d'acceptation**

- [x] Le texte qui part est rangé en trois parties nommées : le contexte, les références, la demande
- [x] L'écran qui montre ce qui va partir les montre **séparément**, et l'on corrige l'une sans toucher aux autres
- [x] Chaque image jointe est annoncée pour ce qu'elle est — style, pose, gabarit, édition — dans le texte lui-même
- [x] Ce qui est montré reste **exactement** ce qui part, mot pour mot — l'invariant d'`E14` ne bouge pas
- [x] Une génération enregistrée avant cette tranche se relit sans rien perdre
- [x] Le texte d'avant et le texte d'après sont montrés côte à côte une fois, pour que le changement se voie — `essais/rangement_r7.py`, gratuit
- [x] Aucun mot n'est ajouté ni retiré au fond de la demande : **on range, on ne réécrit pas**

**Close le 3 septembre 2026.** *Le détail, les trois défauts trouvés en la construisant et ce
qu'elle a coûté ailleurs sont dans `docs/tranches/R7.md`.*

---

## R8 et R9 — les deux écrans qui ne disaient pas à quoi ils servaient
*Les deux closes le 3 septembre 2026*

*Décidées le 3 septembre 2026, après une séance d'usage sur deux écrans déjà livrés — la fiche
d'une chose du jeu et le calibrage. Elles n'appartiennent à aucune version, comme `R6` et `R7`,
et elles ne bloquent rien.*

*« Il n'y a que du texte, pas une image. Pas d'explication sur le propos de chaque partie de la
fiche et leur utilité. »* Puis, sur le calibrage : *« C'est super d'avoir plein d'outils, mais
si on ne comprend pas à quoi ils servent ni comment on s'en sert, et si leur interface n'est pas
intuitive, il faut les revoir. »*

**Le défaut est le même sur les deux, et il est mécanique.** Le produit possède deux systèmes
faits exactement pour ça, construits et documentés : **l'explication au survol**, qui pose un
pointillé sous le nom d'un réglage et rend trois lignes issues d'un recueil unique — le même qui
alimente le guide — et **la vignette**, qui montre toute image en petit et l'ouvre en grand à la
barre d'espace. **Ces deux écrans n'emploient ni l'un ni l'autre** : ils ne posent pas une seule
poignée d'explication, ne se déclarent pas comme panneaux auprès du mécanisme qui place les
bulles, et n'affichent pas une seule image. Le recueil compte trente-neuf entrées pour les
tables de retouche et vingt-trois pour le jeu ; **la fiche d'une chose en a zéro**, et
l'explication du calibrage y dort depuis le 30 août 2026 sans qu'aucun écran ne la branche.

**Ce que ces deux tranches ne changent pas.** Ni ce que la fiche contient, ni ce que le
calibrage calcule ou écrit. Ces deux questions restent tranchées par leurs premiers dessins —
`docs/maquettes-v2.1/07bis-fiche-entite.html` et `docs/maquettes-v2.1/20-outil-calibrage.html`,
qui restent vrais. **Ce qui change est comment ces écrans se lisent.** Aucun appel payant, aucun
changement de ce qui part au fournisseur, aucune donnée nouvelle sur le disque.

**Les maquettes sont écrites et validées** — `docs/maquettes-v2.1/07ter-la-fiche-repensee.html`
et `docs/maquettes-v2.1/20bis-le-calibrage-repense.html`. Elles portent l'écran dessiné aux
polices et aux couleurs du produit, ses annotations numérotées, et **le texte complet des dix
entrées de recueil à écrire**, prêtes à poser.

*Le compte annoncé était de neuf, et il était faux d'une : la maquette de la fiche en rédige six
là où son récapitulatif en annonçait cinq. Corrigé en construisant `R8`, sans qu'une entrée
bouge — le détail est dans l'encadré de la tranche.*

**La décision d'apparence de ces deux tranches, tranchée avec l'auteur le 3 septembre 2026 :
le propos d'une section s'écrit sous son titre, et cette ligne est *lue dans le recueil*.**

*Elle a d'abord été posée comme un arbitrage en suspens — écrire une phrase à demeure semblait
ajouter un troisième rendu au recueil, qui n'en a que deux, la bulle au survol et le guide. **Le
comptage du code a montré que la question était mal posée.*** Le produit écrit déjà ce genre de
phrase partout : **74 lignes explicatives en dur dans dix-sept écrans**, et sur les quinze
relues une par une, **treize expliquent ce que fait un réglage sans rien refuser** — « l'opacité
ne pose aucune couleur : elle décide de ce qui est là », « multiples entiers seulement — un
sprite agrandi d'une fois et demie fabrique des pixels qui n'existent pas ». La règle « un seul
corpus, deux rendus » n'a jamais interdit d'écrire une phrase à l'écran ; ce qu'elle interdit
est de **recopier le corpus dans un second fichier**, parce que les deux divergent en trois
semaines et que la fausse sera celle qu'on a sous les yeux.

**La vraie question était donc : cette phrase, on la tape dans l'écran comme les 74 autres, ou
on la lit dans le corpus ?** On la lit. Ce n'est alors pas un troisième texte, c'est **le même
texte montré une troisième fois** : corriger l'entrée corrige la bulle, le guide *et* la ligne.
Rien n'est à rédiger en plus — le corpus impose déjà que *ce que c'est* tienne en **une phrase,
jamais deux**, ce qui est exactement le format d'une ligne sous un titre. La règle en sort
**mieux tenue** qu'avec les 74 lignes tapées à la main d'aujourd'hui, et elle monte au § Les
invariants du produit, *L'écran*.

**La limite, pour que ça ne se répande pas :** la ligne ne s'écrit **que là où l'on peut se
tromper de section**. Sur un panneau où chaque ligne porte un nom sans ambiguïté — *occupation*,
*décalage* —, rien ne change : le pointillé au survol suffit. C'est le même test binaire qui
décide déjà de l'existence d'une bulle. *Le détail est au § 05 de la maquette de la fiche.*

**Trois relevés faits dans le code en écrivant les maquettes, et qui sont des corrections à part
entière** — deux règles d'apparence déjà écrites sont enfreintes sur la fiche, et trois morceaux
du premier dessin du calibrage n'ont jamais été construits. Le détail est dans les critères.

### R8 · La fiche d'une chose montre la chose, et dit à quoi chaque partie sert — ✅ **livrée le 3 septembre 2026**
*7 US (462–468)* · *le détail est dans `docs/tranches/R8.md`*

**Critères d'acceptation**

- [x] La fiche montre la chose : son portrait, **pris parmi ses images déjà faites** — rien n'est fabriqué, rien n'est payé
- [x] La fiche porte le nom de la chose sur sa propre surface, et non plus seulement dans le fil du châssis
- [x] Les cinq parties sont lisibles sans clic : elles défilent dans une seule page, et la colonne de gauche en est le sommaire
- [x] Chaque partie porte son propos sous son titre, et sa version longue au survol — la ligne est **lue dans le recueil**, jamais retapée dans l'écran, et corriger l'entrée corrige les trois affichages d'un coup
- [x] Chaque image d'exemple porte sa vignette : on la retient ou on la retire **en la regardant**
- [x] Les images faites sont montrées, et une case vide occupe **la même place** qu'une case pleine
- [x] Le compte des cases n'est plus écrit trois fois, et aucun résumé de la colonne de gauche ne se coupe — ⚠️ *lire l'encadré ci-dessous : ce qui est tenu est qu'il est **calculé** une fois*
- [x] Aucune mesure n'est écrite dans la police à empattements, et aucun nom de réglage dans le gris le plus sourd — *deux règles de `docs/DESIGN.md` enfreintes aujourd'hui sur cet écran*
- [x] La fente réservée aux refus ne porte plus une seule explication
- [x] Le codex gagne **cinq entrées** au recueil, lisibles au survol **et** dans le guide — ⚠️ *il en gagne **six** : lire l'encadré ci-dessous*
- [x] Aucune largeur, couleur, hauteur, police ni symbole neufs

> ⚠️ **Deux critères ont été corrigés en se construisant, et les deux corrections
> sont conservées ici plutôt que réécrites dans la phrase.** Une phrase de critère
> qu'on retouche après coup pour qu'elle colle à ce qui a été fait ne mesure plus
> rien.
>
> **« Cinq entrées » en annonçait cinq et la maquette en rédigeait six.** Son § 06
> compte les cinq parties de la page ; son § 04 écrit le texte de six — les cinq,
> **plus la matrice de droite**. Six sont posées : un sixième titre sans entrée
> serait le seul de l'écran sans bulle, sans ligne de propos et absent du guide.
> Elles sont préfixées `codex.` et non `fiche.`, parce que `fiche.*` désigne déjà
> la fiche d'une *image* dans la galerie.
>
> **« Écrit trois fois » visait deux défauts, et le second était le vrai** : le
> compte paraissait à trois endroits **et deux des trois ne comptaient pas
> pareil** — l'un sur toutes les cases du plan, rangées comprises, l'autre sur les
> seules poses tenues. Le dessin validé garde le compte à trois endroits, qui
> répondent à trois questions différentes ; ce qui disparaît est le **quatrième**,
> le très gros chiffre à empattements du milieu. Ce que la tranche tient est donc
> **un seul calcul**, lu par les quatre écritures — et un essai le mesure sur une
> chose à deux poses rangées, là où les deux anciennes formules divergeaient.

**Bloquée par** — aucune. *(Était indépendante de `R9`, qui reste à prendre.)*

### R9 · Le calibrage montre le défaut qu'il répare — ✅ **livrée le 3 septembre 2026**
*7 US (469–475)* · *le détail est dans `docs/tranches/R9.md`*

**Critères d'acceptation**

- [x] L'écran dit **ce qu'il répare** avant de proposer de le réparer, en clair et sans survol — et cette phrase est **lue dans le recueil**, jamais retapée dans l'écran
- [x] Ce que le bouton va faire se lit **au-dessus** du bouton, une ligne par fait, et non dans un paragraphe en dessous
- [x] Le bouton annonce son **résultat** et non son verbe : le nombre de poses qu'il touche, et la hauteur qu'il pose
- [x] Quand il n'y a rien à calibrer, le bouton **s'éteint et porte sa raison** dans la fente permanente — *il reste allumé aujourd'hui* — ⚠️ *à moitié faux : lire l'encadré ci-dessous*
- [x] L'empilement d'aujourd'hui et celui d'après se voient **côte à côte**, avant tout geste
- [x] Une légende nomme les trois traitements de silhouette — celle qu'on règle, la référence, les autres
- [x] Chaque ligne de pose porte **sa silhouette**, et ses deux mesures dans deux colonnes alignées qui ne se replient jamais — *la silhouette était au premier dessin et n'a pas été construite ; les mesures se replient sur trois lignes aujourd'hui*
- [x] *Prendre comme référence* et *mettre de côté* sont des **mots** ; sur la ligne il ne reste qu'une marque, sans encadré et sans clic
- [x] Le recueil gagne **quatre entrées**, et celle du calibrage — écrite le 30 août 2026 — devient lisible depuis l'écran
- [x] Aucun symbole neuf : l'écran en **retire** deux
- [x] Rien de ce que l'outil calcule ne change : aucune écriture nouvelle dans la recette, aucun appel payant

> ⚠️ **« Il reste allumé aujourd'hui » était vrai à moitié**, et la moitié fausse
> était la plus intéressante. Le bouton s'éteignait bien — mais dans le seul cas
> dégénéré, et **muet**. La hauteur commune est le plus petit plafond des poses
> retenues, et un plafond vaut toujours au moins 1 : elle ne tombait à zéro que si
> aucune pose n'avait de corps, ou si toutes étaient mises de côté. Dans ce dernier
> cas l'écran montrait un bouton gris marqué « Calibrer les 0 poses », le
> paragraphe explicatif disparaissait avec lui, et rien ne disait pourquoi.
>
> Ce que la tranche a posé n'est donc pas une extinction mais **un compte** — combien
> de poses le bouton changerait vraiment — et **trois raisons distinctes**.

> ⚠️ **Un défaut trouvé en construisant, et laissé exprès.** `_occupation` borne
> l'occupation calibrée à l'échelle déclarée par l'ensemble des poses — jusqu'à
> 300 % depuis la tranche des tailles — et `_poser` la borne à 100 % en écrivant :
> un géant déclaré tel voit son calibrage écrasé. **Le réparer changerait ce que
> l'outil écrit**, ce que le dernier critère interdit. `R9` le *montre* au lieu de
> le cacher — la valeur rendue est celle qui sera écrite, et l'empilement d'après
> dessine la hauteur vraiment obtenue. Consigné dans `docs/PIEGES.md`.

**Bloquée par** — aucune. *(Était indépendante de `R8`.)*

---

## V2.3 — Le traitement cesse d'être à refaire

*Décidée le 2 septembre 2026, sur une remarque d'usage de l'auteur — « le détourage par défaut
n'est pas du tout efficace, ça m'évitera de systématiquement le refaire à la main » — et sur le
relevé d'outillage ouvert le même jour. Les mesures et leurs sources sont dans
`docs/bilan-v3.md` § 3 et § 4.*

**Ce n'est pas une version de confort.** Elle rend la V3 tenable : une image mal traitée n'est
pas jugeable, et le geste principal de la V3 est de juger vite.

**Élargie le 2 septembre 2026, sur décision de l'auteur** : l'amélioration des tables ne se
limite pas aux défauts mesurés ici, elle prend aussi ce que le relevé d'outillage a rapporté
d'ailleurs — d'autres modèles de détourage, un contour qui se pose net, une pixelisation qui ne
fabrique plus de bouillie. D'où la quatrième tranche.

### Les quatre mesures qui l'ont décidée

Toutes faites sur les images de ce dépôt le 2 septembre 2026. Le détail est dans
`docs/bilan-v3.md`.

1. **La recette par défaut est fausse plus d'une fois sur deux.** Sur 123 découpages, **64
   portent un durcissement du bord** quand le défaut est zéro. La tolérance, elle, n'est
   presque jamais touchée — 111 sur 118 restent à la valeur livrée : **ce n'est pas elle le
   problème**.
2. ~~**Une planche et une image seule ne veulent pas le même réglage**~~ : durcissement non nul
   dans **67 %** des images ordinaires contre **38 %** des morceaux de planche, et la pipette
   employée **onze fois sur les images seules, jamais sur un morceau de planche**.
   > ⚠️ **Cette lecture-là est fausse, et D1 l'a corrigée en la recomptant** (3 septembre 2026).
   > L'écart est réel mais il n'appartient pas à la nature de l'image : il appartient au
   > **moteur** que l'auteur avait choisi, et il disparaît dès qu'on croise les deux. La mesure 3
   > juste en dessous en portait déjà la raison. Le détail est dans l'encadré de `D1`.
3. **Le compromis « liseré contre halo » ne mord que sur un moteur.** Le moteur par défaut ne
   produit **aucun** pixel à demi transparent — il est binaire par construction. Le moteur par
   modèle, lui, en produit sur 95 % du sujet.
4. **Le halo, cherché sur quarante vraies images, vaut 80 pixels sur 138 465** — un millième.
   **Un chantier entier de correction par calcul de transparence a été évité**, et la raison
   est écrite dans le bilan pour qu'il ne se repropose pas.

---

### D1 · Une recette par défaut, par nature d'image — ✅ **livrée le 3 septembre 2026**
*6 US (407–412)*

**Ce qu'on livre.** La recette par défaut cesse d'être unique. Elle se règle **par nature de ce
qu'on fabrique** — au minimum une image seule et une planche, et par famille si l'univers en
distingue —, et l'auteur voit ce que chaque défaut contient avant qu'il s'applique.

**Pourquoi c'est la première.** C'est la seule tranche de cette version qui ne demande aucune
mesure préalable : la mesure est déjà faite, elle est ci-dessus, et elle dit exactement quoi
changer. Elle se rembourse sur chaque image dès le jour de sa livraison, y compris sur les
planches d'équipement que la V2 produit déjà.

Le produit range déjà par famille le modèle par défaut d'un univers ; **la recette suit le même
rangement, et n'invente aucun vocabulaire.**

> ### ⚠️ La mesure de départ ne survit pas au recomptage, et le troisième critère change
>
> **Recompté le 3 septembre 2026 en croisant avec le moteur employé** (`essais/essai_defauts_de_detourage.py`,
> gratuit, il relit la base). Le chiffre du § « Les quatre mesures » reste juste — 64 découpages
> sur 123 portent un durcissement quand le réglage livré est zéro —, mais sa **cause** n'est pas
> celle qu'on lui prêtait :
>
> | moteur de détourage | passes | durcissement laissé à zéro | valeur la plus fréquente |
> |---------------------|--------|----------------------------|--------------------------|
> | le bord (livré)     |   72   |          **78 %**          | **0** (56 sur 72)        |
> | la pipette          |   11   |           0 %              | **1** (6 sur 11)         |
> | le modèle           |   40   |           2 %              | **2** (32 sur 40)        |
>
> **À moteur égal, la nature de l'image ne décide presque plus rien** — 100 % contre 93 % de
> durcissement non nul sur le moteur par modèle. Le moteur, lui, décide tout. Et la raison était
> déjà écrite deux mesures plus haut sans avoir jamais été jointe à ce comptage : le moteur du
> bord **ne produit aucun pixel à demi transparent, il est binaire par construction**, donc il n'y
> a pas de frange à ronger ; le moteur par modèle en produit sur 95 % du sujet. *Le durcissement
> ne corrige pas un goût, il corrige une frange — et la frange appartient au moteur qui la
> fabrique.*
>
> **Ce que ça change.** La structure demandée est bâtie en entier : les deux natures et les quatre
> familles se règlent, la provenance se lit avant de générer et après coup, rien du passé n'est
> réécrit. Le **contenu livré**, lui, suit la mesure vraie plutôt que celle du plan : les deux
> natures partent du même détourage, et c'est **le durcissement qui voyage avec le moteur** — y
> compris quand l'auteur change de moteur sur une image, ce qu'il avait retapé à la main **39 fois
> sur 40**. Un durcissement qu'il a déplacé lui-même n'est jamais réécrit.
>
> **Ce que ça rapporte, mesuré sur ses 123 passes** : le durcissement tapé à la main tombe de
> **54 % à 24 %**.

**Critères d'acceptation**

- [x] Le défaut d'une image seule et celui d'une planche se règlent séparément
- [x] Une famille d'univers peut porter son propre défaut ; sans quoi elle hérite de celui de sa nature
- [x] ~~Le défaut livré n'est plus le même pour les deux~~ → **le défaut livré suit le moteur, et
      c'est ce que les mesures disent** : les deux natures veulent le même détourage de base, et
      l'écart apparent entre elles était celui des moteurs qu'elles employaient (encadré ci-dessus)
- [x] L'auteur voit quel défaut s'applique, et d'où il vient, avant de générer
- [x] Un défaut modifié ne touche à aucune recette déjà écrite — le non destructif tient
- [x] Une recette écrite avant cette tranche s'ouvre et rend exactement ce qu'elle rendait
- [x] Vérifié en comptant, après la tranche : **53 recettes sur 108 s'écartent encore de leur
      défaut**, et le durcissement est en cause dans les 53. Ce n'est pas un échec — c'est ce qu'un
      moteur choisi image par image produit, et aucun défaut ne peut le deviner. Le chiffre qui
      juge la tranche est l'autre : les durcissements retapés à la main passent de 54 % à 24 %.

**Bloquée par** — aucune, démarrable immédiatement.

**Où en est la tranche**

| | |
|---|---|
| **Domaine** | `Univers.detourage_image`, `detourage_planche`, `detourages` par famille ; `Univers.detourage(nature, famille)` rend la passe **et sa provenance** ; `DURCISSEMENT_LIVRE` et `moteurs_suivis` dans `recette.py` |
| **Services** | `recette_du_projet(generation, nature)` — les trois chemins de planche le disent ; `poser_les_places` fait suivre le durcissement ; `impose` rend la nature et la provenance |
| **API** | `PUT /api/universe` prend les trois champs ; `null` y veut dire *remets au produit*, et *ne touche pas* est **ne pas envoyer le champ** |
| **Écran** | onzième étape de l'Univers, « Le détourage de départ » ; la ligne « détourer le fond » de l'écran qui confirme ; la rubrique « Imposé par le projet » de la fiche |
| **Essais** | `tests/test_d1.py` (29), 7 essais d'écran, `essais/essai_defauts_de_detourage.py` |

**Trois décisions qui tiennent le reste**

1. **La famille l'emporte sur la nature, et elle l'emporte en entier.** Un défaut de famille qui
   ne remplacerait que ce qu'il déclare demanderait de distinguer « posé à zéro » de « pas posé »
   sur chaque réglage, et un écran qui montre cette distinction. C'est pour qu'elle ne surprenne
   jamais que la provenance sort du domaine **avec** la passe, et que les deux écrans l'affichent.
2. **`null` n'est pas une passe vide.** *Jamais réglé* laisse décider le produit — c'est ce qui
   fait qu'un univers écrit avant D1 rend exactement ce qu'il rendait. *Réglé* impose ce qui est
   écrit. Sans l'écart, un réglage posé une fois ne pourrait plus jamais être retiré.
3. **Un défaut ne porte pas ce qui appartient à une image.** Le point de la pipette, le tracé à
   main levée et le masquage sont retirés à la relecture : appliqués à la première image venue,
   ils désigneraient des pixels qui n'ont rien à voir. Retirés au seul passage entre un fichier et
   un univers, plutôt que défendus par une validation qu'une route pourrait contourner.

---

### D2 · La grille retrouvée, et la réduction qui ne bave plus — ✔ **close le 3 septembre 2026, en deux moitiés le même jour**
*7 US (413–419)*

> ### La seconde moitié, livrée le 3 septembre 2026 : le pas est retrouvé, et la détection sait se taire
>
> **Le taux est mesuré et il est écrit : 200 cas justes sur 204, soit 98 %**, sur un lot bâti à
> partir de douze vrais dessins du dépôt pris dans les six jeux, reposés sur des grilles de pas
> connu de 3 à 32 px — nets, flous, décalés, et à pas non entier, qui est le cas réel. Zéro erreur
> d'octave, zéro franc raté ; les quatre écarts sont des **renoncements**. Le banc de réception est
> `essais/essai_grille_produit.py`, gratuit, et il appelle le produit au lieu de le rejouer.
>
> **Et la pièce qui manquait n'est pas un meilleur détecteur, c'est un refus.** `mesurer_grille`
> répondait **2 avec une netteté de 0,94 sur une peinture** : l'autocorrélation d'une image lisse
> décroît doucement depuis le pas 2 sans jamais faire de bosse, et la règle du plus petit pas
> qualifié attrapait ce 2 parce qu'il n'a pas de voisin de gauche à qui se comparer. Le **peigne**
> demande autre chose — que le contraste tombe sur les *multiples* du pas — et il sépare
> franchement : sur les 149 images brutes du dépôt, **0,40 au plus bas quand la détection annonce,
> 0,35 au plus haut quand elle se tait**.
>
> Sur ces mêmes images brutes, la séparation suit les jeux : le jeu du marais, qui a reçu des
> carrés, fait annoncer **26 fois sur 27** ; *cœur de pierre*, qui a reçu des peintures alors que sa
> bible réclamait mot pour mot *« strict 64x64 px tile snap »*, fait renoncer **24 fois sur 26**.
>
> **La borne est 32 px, et les trois chiffres qui circulaient étaient tous faux** : 80 n'a jamais
> été relevé, 24 coupe le dépôt par le haut, 64 balaie deux fois trop large. ⚠️ *Et une
> affirmation de ce plan n'est pas reproduite* : « relever la borne fait perdre de la finesse » ne
> se mesure pas — à 64 la réussite est celle de 32, et sur les images brutes la borne ne change
> rien du tout, 61 annonces de 24 à 128. Ce qui décide n'est pas ce qu'une grande borne coûterait,
> c'est ce qu'une petite borne **coupe**.
>
> **L'arbitre d'aller-retour, mesuré puis écarté.** L'idée qui vient d'instinct — réduire au pas
> candidat, réagrandir, regarder ce qui a changé — **abîme** le détecteur : 170 sur 204 contre 200,
> et 30 erreurs d'octave qu'il fabrique lui-même, toutes sur les pas non entiers.
>
> ### La première moitié, tranchée par l'auteur le matin même
>
> **Ce qui est livré** : la réduction devient un **choix entre quatre méthodes**, au projet et sur
> chaque image ; et les **couleurs se réduisent enfin sans artwork**.
>
> **La coupure n'est pas un abandon, c'est la mesure qui l'a dessinée.** Le banc du 3 septembre
> (`essais/essai_pixelisation_complet.py`, gratuit) est parti des deux illustrations que l'auteur a
> fournies, et elles n'ont **aucune grille à retrouver** : ce sont des peintures. Le chemin qu'elles
> demandent est celui que la revue externe appelle *pipeline B* — convertir —, et il ne dépend en
> rien de la détection. Livrer la détection d'abord aurait été livrer la moitié qui ne sert à aucune
> des images du dépôt qu'on a sous la main.
>
> **Les quatre méthodes, mesurées côte à côte, toutes ramenées au même nombre de couleurs** pour que
> la comparaison porte sur la seule réduction :
>
> | méthode | ce qu'elle rend |
> |---|---|
> | **vote en deux temps** | contour net **et** intérieur lisible — un sprite calme. **Le défaut**, choisi par l'auteur |
> | **traits épaissis** (PixelOE) | garde les traits d'un pixel — la hampe d'une lance reste entière —, contour plus agité |
> | **réduction douce** (Lanczos) | la silhouette la plus lisse, l'intérieur mou : un dessin réduit, pas un sprite |
> | **au plus proche** | ce que l'atelier faisait : un pixel sur N gardé, les autres jetés sans être regardés |
>
> **Ce n'est pas un classement, et c'est la décision de l'auteur** : *« clairement les 4 ont des
> rendus différents avec leurs avantages et inconvénients et peuvent influencer le style souhaité
> par le créateur »*. Les quatre restent donc vivantes, choisissables au projet et **changeables
> image par image en cours de route**.
>
> ### ⚠️ Le défaut trouvé en chemin était plus gros que la tranche
>
> La quantification n'entrait dans une recette **que s'il existait une palette**, et la palette se
> déduit des artworks officiels. **Un projet sans artwork ne réduisait donc aucune couleur** : un
> personnage ramené à 64 carrés sortait à **905 couleurs**. Le réglage `Univers.couleurs` existait
> depuis T4, se réglait, s'enregistrait — et ne faisait rien. Pire : l'écran **cachait** le réglage
> dans ce cas, et le service **refusait** la quantification si on l'écrivait à la main, refus figé
> par trois essais dont un nommé *reste refusée*.
>
> C'est corrigé, et le pivot est ailleurs : **ce qui commande la quantification est la taille de
> case**, c'est-à-dire le fait même de faire du pixel art. Sans taille imposée — un jeu en dessin —
> les couleurs ne sont plus touchées, parce que réduire les couleurs d'un dessin le transformerait
> en affiche sérigraphiée.
>
> ### Les six paliers de couleurs, plafonnés par le côté du sprite
>
> Tranchés par l'auteur : **8 · 16 · 32 · 64 · 128 · 256**, *« avec le max bloqué au nombre de pixel
> (on peut pas avoir du 128 couleurs sur du 32px) »*. Le plafond est **le côté du sprite**, et il
> est mesuré : le sujet occupe environ 27 % de la toile à toutes les tailles, et au-delà du côté
> l'image ne contient plus assez de teintes distinctes pour remplir la palette demandée — 32 carrés
> rendent 30 couleurs quand on en demande 32, et 229 quand on en demande 256.
>
> **Et le banc s'est trompé avant de se corriger**, ce qui vaut d'être écrit : jugé sur une image
> **non détourée**, le fond uni occupait 73 % des pixels et raflait la majorité de la palette — à 8
> couleurs demandées, 5 partaient au fond et il en restait **3** pour le personnage. On allait
> écarter des paliers parfaitement utilisables. Le produit détoure avant de quantifier ; palette
> comptée sur le sujet seul, **8 couleurs suffisent déjà** à 64 carrés, et 24 est le palier où la
> flamme d'une torche retrouve son orange.

> ### Le style graphique, arrivé en chemin, et il est devenu la deuxième question du jeu
>
> **Il n'était pas au programme de la tranche, et il est sorti de la question précédente.** En
> réglant les couleurs, une chose est apparue : *ne pas réduire les couleurs* et *ne pas faire de
> pixel art* sont la même décision, et le produit ne la posait nulle part. Elle se **déduisait** de
> la neuvième valeur d'une liste de tailles, trois étapes plus loin, dont le libellé disait *ce jeu
> n'est pas en pixel art*. Autrement dit : la décision la plus lourde du jeu se prenait par accident,
> en choisissant une taille.
>
> **Ce qu'elle commande, une fois posée.** Trois choses, et ce sont trois choses que l'auteur ne
> réglait pas séparément :
>
> | | en pixel art | en dessin |
> |---|---|---|
> | ce que la taille veut dire | **combien de carrés** de côté — 8 à 512 | **combien de détail** — 256 à 2048 |
> | les couleurs | réduites au palier choisi | gardées : un dessin a ses nuances |
> | ce qui part au modèle | *2D pixel art on a 64x64 grid*, et le calage | rien de tout cela |
>
> La troisième ligne était un vrai dégât, pas une élégance : un jeu en dessin qui gardait une
> finesse de 1024 envoyait au modèle *2D pixel art on a 1024x1024 grid* — **le contraire mot pour
> mot de ce que l'auteur avait choisi**, sur la case qui décide de l'allure. Le défaut n'était pas
> atteignable avant, parce que « aucune taille » était la seule façon de dire « pas de pixel art »,
> et qu'elle vidait les deux phrases par le même geste.
>
> **Elle se choisit en image, et c'est la demande de l'auteur** : *« on propose le choix du style de
> jeu ici et on met une image cliquable pour chaque style »*. Les deux vignettes sont **le même
> personnage**, passé par la chaîne du produit elle-même — pas des illustrations trouvées ailleurs —,
> de sorte que ce qu'on compare est bien ce que l'atelier rend. Elle est **deuxième**, juste après le
> nom, parce que toutes les étapes suivantes changent de sens selon la réponse.
>
> **Changer d'avis ne casse rien**, et c'est la règle de D1 réemployée : *on ne réécrit que ce que
> personne n'a choisi*. Passer en dessin ramène la taille dans la nouvelle liste et pose la
> réduction douce **seulement si** la méthode était encore celle du défaut d'avant ; une méthode
> choisie à la main survit à la bascule. Et les projets d'avant se relisent sans un fichier
> réécrit : sans champ `style`, il se **déduit** de la taille, exactement comme le produit le
> déduisait déjà.

**Ce qu'on livre.** Le problème le plus ancien du produit. Un modèle rend une image de mille
pixels « à l'allure pixel art » dont la grille est fausse — blocs inégaux, bords flous,
centaines de couleurs. L'atelier retrouve le vrai pas, et ramène à la cible **sans bouillie**.

**Les quatre choses à reprendre** sont listées dans `docs/bilan-v3.md` § 4 : la réduction en
deux temps (les couleurs triées décident **où** tombe chaque case, les pixels d'origine
décident **quelle couleur** — erreur 4,56 contre 5,51), trier les couleurs avant de chercher la
grille, la règle du plus petit pas qualifié, et la palette appliquée **après** la réduction.

> ⚠️ **Le piège qui vise ce dépôt en particulier — et ce que la mesure en a fait.** Le paragraphe
> ci-dessous est celui d'avant la tranche, gardé parce qu'il a servi à la cadrer ; deux de ses
> quatre affirmations n'ont pas tenu, et il faut les lire ensemble.
>
> *« Les détecteurs de référence cherchent des blocs jusqu'à vingt-quatre pixels. Ce dépôt a
> mesuré des blocs approchant quatre-vingts pixels sur une image de mille. Repris tels quels, ils
> ne verront jamais notre vrai pas et rendront une fraction du bon avec un bon score. Relever la
> borne n'est pas gratuit : le détecteur y perd de la finesse. En cas de doute, viser fin — une
> grille un peu trop fine se rattrape presque parfaitement, une grille trop grossière non. »*
>
> - **la borne de 24 coupe vraiment** : le jeu des vignettes monte à 32, et à 24 douze cas du lot
>   de réception passent de « trouvé » à « renoncé ». ✔ tenu ;
> - **« viser fin »** est la règle du plus petit pas qualifié, et elle rend zéro erreur d'octave
>   sur les deux bancs. ✔ tenu ;
> - **les quatre-vingts pixels n'existent pas.** Mesuré sur les 149 images brutes du dépôt : le pas
>   le plus grossier est de **32 px**, et 99 % tiennent sous 22. ✘ ;
> - **« relever la borne fait perdre de la finesse » ne se mesure pas.** À 64, la réussite est
>   exactement celle de 32, et sur les images brutes la borne ne change rien du tout — 61 annonces,
>   de 24 à 128. ✘ *(Un seul indice va dans ce sens et il est trop mince pour la fonder : à 80, un
>   cas sur 204 sort en franche erreur, le seul du banc.)*

**Deux résultats contre-intuitifs à respecter**, et la mesure les a repris tous les deux :

- **le détecteur qu'on écrirait d'instinct est le pire des onze mesurés.** ✔ Vérifié sur notre
  propre code : `mesurer_grille` *est* celui-là, et elle répond **2 avec une netteté de 0,94 sur
  une peinture**. Ce qui la répare n'est pas une meilleure recherche de période, c'est le peigne —
  une épreuve qui demande que le contraste tombe sur les *multiples* du pas ;
- **additionner plusieurs canaux de couleur bat le meilleur canal seul.** ✔ Repris, et **nuancé** :
  sur des images pleines l'écart est d'un cas sur 204. Ce qui décide est ailleurs et c'est franc —
  un sprite détouré d'une seule teinte porte toute sa grille dans sa silhouette, le gris jette
  l'alpha en entrant, et il répond **2 à tous les coups**.

**Critères d'acceptation**

- [x] Le pas réel est retrouvé sur un lot d'images du dépôt, et le taux est mesuré et écrit —
      **200 sur 204, soit 98 %**, sur douze vrais dessins des six jeux reposés sur des grilles de
      pas connu ; zéro octave, zéro raté, les quatre écarts sont des renoncements
      (`essais/essai_grille_produit.py`, gratuit, qui appelle le produit au lieu de le rejouer)
- [x] Les bornes de balayage couvrent la dérive réelle mesurée ici, pas celle du banc d'origine —
      **32 px**, le pas le plus grossier des 149 images brutes du dépôt, 99 % sous 22
      (`atelier/image/traitement.py::PAS_MAXIMAL`, où les trois chiffres écartés sont écrits)
- [x] La réduction se fait en deux temps : le tri pour le placement, les pixels d'origine pour la couleur
      — **et c'est le défaut du produit**, `atelier/image/traitement.py::_par_vote`
- [x] La palette imposée s'applique après la réduction, jamais avant — l'ordre l'était déjà ; ce qui
      manquait est qu'elle s'applique **tout court** sans artwork
- [x] La transparence traverse toute la chaîne — l'alpha est réduit **à part**, par vote majoritaire
      de case, sans quoi les trois nouvelles méthodes rendraient des bords translucides
- [x] L'auteur peut imposer le pas à la main quand la détection renonce, et la détection dit qu'elle
      renonce — trois refus, trois phrases en français qui partent telles quelles à l'écran, au-
      dessus des crans de taille qui restent là *(la moitié « à la main » existait depuis toujours :
      la cible est demandée, jamais déduite)*
- [x] Comparé image par image à la remise sur grille actuelle, avec le résultat écrit —
      `essais/essai_pixelisation_complet.py`, 4 tailles × 4 méthodes × 6 paliers sur deux
      illustrations, page à ouvrir dans le navigateur

**Où en est la tranche**

| Ce que D2 devait livrer | État |
|---|---|
| Le choix de la façon de réduire, au projet et par image | ✅ livré, quatre méthodes |
| Les couleurs réduites sans artwork officiel | ✅ livré, et c'était un défaut silencieux |
| Les paliers de couleurs plafonnés par la taille | ✅ livré, plafond mesuré |
| Le style graphique, choisi en image, et ce que la taille veut dire | ✅ livré — hors périmètre, sorti de la question des couleurs |
| Retrouver le pas d'une image qui porte déjà une grille | ✅ livré, 98 % sur le lot de réception |
| Renoncer plutôt qu'inventer, et le dire à l'auteur | ✅ livré — le peigne, et trois phrases en français |
| L'écran montre le pas retrouvé | ✅ livré — une ligne au-dessus de la taille, avec le compte en carrés |

**Bloquée par** — aucune. *(Indépendante de D1 : l'une règle ce qu'on applique par défaut,
l'autre comment on réduit.)*

**Ce que la tranche ne fait pas, et c'est volontaire.** Le pas retrouvé est **montré**, jamais
appliqué : la cible reste demandée et jamais déduite de l'image reçue (`US-61`), et se caler
d'office sur la grille du modèle reviendrait à laisser le fournisseur décider de l'échelle du jeu.
Une cinquième méthode de réduction *« se caler sur le pas trouvé »* est écrite au banc
(`essais/essai_conversion_pixel.py`) et n'entre pas dans le produit : l'auteur a tranché quatre
méthodes, et il n'a pas été consulté sur une cinquième.

**Ce qui a suivi immédiatement, à la demande de l'auteur le 3 septembre** — *« puis la tranche sur
les tailles en suivant »* — est la tranche `D5`, **close le jour même**. Rien dans l'atelier ne
pouvait être plus grand qu'un personnage ; un bâtiment, un arbre ou une tour étaient inexprimables.
Elle est plus bas dans ce document.

---

### D3 · Le fond devient un réglage du projet — ✅ **livrée le 3 septembre 2026**
*5 US (420–424)*

> **Cette tranche a changé de forme le 2 septembre 2026, sur décision de l'auteur.** Elle
> proposait que l'atelier **calcule** une couleur de fond sûre et l'impose. L'auteur tranche
> autrement, et c'est plus simple : **le fond est un réglage du projet, choisi par lui, et
> modifiable à la main au lancement de chaque génération** — c'est un morceau du texte qui part,
> au même titre que le reste.

**Ce qu'on livre.** Le fond cesse d'être une phrase enterrée dans le code. Il devient un
réglage d'univers qu'on voit, qu'on choisit, et qu'on peut corriger juste avant de payer, sur
l'écran de confirmation qui montre déjà tout ce qui part.

**Ce que ça débloque, et c'est la raison de la tranche.** Le produit demande aujourd'hui un
fond gris clair — c'est-à-dire une couleur que le sujet porte aussi, d'où le découpage à
reprendre sur presque chaque image. Un fond d'une **couleur franche que rien dans le jeu ne
contient** rend le découpage presque gratuit et presque parfait. Mais **c'est un choix
d'auteur, pas un calcul** : l'atelier peut proposer, il ne décide pas.

**Ce qui est déjà en place et ne coûte rien** : le fond **est déjà écrit en toutes lettres**
dans le texte qui part ; et le produit porte déjà un champ d'interdiction que l'adaptateur
replie en fin de demande. **La phrase qui interdit au modèle d'employer cette couleur et ses
voisines dans le sujet, les reflets, les accessoires et les ombres y entre sans une ligne de
code.**

**Ce que l'atelier propose sans l'imposer** : la palette d'un projet est une liste fermée de
vingt-quatre couleurs. Calculer la distance de quelques candidats à cette liste et proposer le
premier qui passe le seuil est un calcul fait une fois. **S'il n'y a pas de candidat sûr, il le
dit** au lieu de choisir en silence — et l'auteur tranche.

> **Pas de banc — tranché par l'auteur le 2 septembre 2026.** La version précédente de cette
> tranche exigeait huit tirages par branche avant la première ligne. C'est retiré : *« pas
> besoin de tester ça »*. La raison tient : **le fond devient un réglage, pas une valeur
> imposée** — si la couleur choisie donne un moins bon résultat, l'auteur la change en un geste
> et le voit sur l'image suivante. Un banc mesurerait pendant trois heures ce que l'usage dit en
> trois images.
>
> ⚠️ **Ce que ça coûte quand même, et qu'il faut savoir** : cette tranche change ce qui part au
> fournisseur, donc elle **invalide les comparaisons avec les tirages déjà payés**. Les 135
> notes d'animation restent valables entre elles, jamais contre un tirage postérieur à cette
> tranche. C'est un prix accepté, pas un oubli.
>
> **Et la branche « demander une image déjà détourée » est refermée avant d'être ouverte** : le
> catalogue déclare l'option, mais relevé le 2 septembre 2026, **elle n'est pas ouverte sur le
> modèle que le produit emploie**. Elle l'est sur quatre autres — la mesurer voudrait dire
> changer de modèle, donc changer tout le reste avec.

**Critères d'acceptation**

- [x] Le fond est un réglage d'univers : il se voit, il se choisit, il s'enregistre —
      `Univers.fond`, l'étape *Références et couleurs* de l'assistant, `tests/test_d3.py`
- [x] Il se corrige à la main sur l'écran de confirmation, avant de payer, pour cet appel seulement
- [x] L'atelier **propose** une couleur sûre depuis la palette du projet, et ne l'impose jamais
- [x] Aucun candidat sûr : il le dit et laisse le fond en place, il ne choisit pas en silence
- [x] La phrase d'interdiction part avec la demande, et se relit dans la génération enregistrée
- [x] Un univers sans palette garde exactement le comportement d'aujourd'hui
- [x] Deux mesures d'acceptation s'affichent sur une planche revenue : les pixels de bord, et les pixels encore collés à la couleur de fond — **c'est ce qui remplace le banc** : la mesure se lit sur les images qu'on voulait de toute façon

**Bloquée par** — aucune. *(La correction du bord sur la couleur ne s'écrit que si l'usage
montre qu'elle sert : deux mesures d'acceptation sur les images ordinaires suffisent à le dire,
sans séance dédiée.)* **Elle a été écrite quand même, et par `D4`** — c'est la décontamination,
que la mesure du bord de cette tranche-ci rendait justement lisible.

#### Ce que la construction a tranché, et qui n'était pas écrit

**Le fond ne fabrique pas de ligne à lui dans le texte qui part.** La case `technique` disait
déjà *un fond plat* sans dire lequel ; elle dit maintenant lequel. Lui donner une ligne de plus
aurait fait partir la couleur deux fois dans le même appel.

**Mais il a fallu un quatrième écart sur l'écran de confirmation**, à côté des lignes éteintes,
des lignes rallumées et des textes corrigés. La raison est mécanique : le fond fabrique **deux**
textes qui partent dans **deux champs différents** — la phrase de calage et la phrase
d'interdiction. Le corriger en tapant dans la ligne aurait changé l'un sans l'autre, et l'appel
serait parti en demandant du magenta tout en interdisant du cyan, sans que rien ne le dise.

**Un jeu en dessin a un fond comme les autres.** La phrase de calage ne partait qu'en pixel art,
puisqu'elle porte le calage en carrés ; elle se coupe désormais en deux moitiés, et le fond part
seul quand il n'y a pas de carrés. Sans ça la tranche aurait été muette pour la moitié des
projets.

**Le seuil de sûreté est le seul chiffre de la tranche qui ne vienne pas d'un relevé**, et il est
écrit comme tel plutôt que tu : trois fois la tolérance du détourage. Une tolérance parce
qu'en dessous la couleur serait mangée avec le fond ; les deux autres paient le fait que **le
modèle ne rend jamais exactement l'hexadécimal demandé**. Cette dérive-là n'est pas connue —
aucune image du dépôt n'a été tirée sur un fond franc — et c'est la mesure « pixels encore
collés à la couleur de fond » qui la dira sur les premières qui reviendront.

#### ⚠️ Ce que le passage au navigateur a corrigé, une fois tout au vert

Les essais étaient tous verts quand un atelier jetable a été monté sur deux jeux — l'un dont la
palette laisse le magenta loin, l'autre construit pour qu'aucune couleur candidate ne soit sûre.
Deux défauts en sont sortis, et **aucun essai ne pouvait les voir**.

- **La phrase d'interdiction disait le contraire de ce qu'elle voulait dire.** Elle énumérait en
  écrivant *« (not on its outfit, its skin… ) »*, et elle part derrière *« Do not include: »* —
  une négation dans une négation, qui transformait l'énumération en liste d'exceptions. Corrigée
  en affirmations, et gardée par un essai : *aucun « not » dans ce qui part en interdiction*.
- **Les deux écrans du fond affichaient une couleur qu'ils n'avaient pas.** `<input
  type="color">` n'a pas d'état vide, donc une pastille magenta jouxtait les mots *« aucun fond
  posé »*. Le damier prend sa place, et le sélecteur reste dessous, atteignable — le retirer
  aurait fermé le seul chemin qui reste quand rien de sûr ne se propose.

*Les deux sont consignés dans `docs/PIEGES.md`, et le second élargit une garde déjà payée.*

---

### D4 · Les moteurs de détourage s'ouvrent, et le contour se pose net — ✅ **livrée le 3 septembre 2026**
*6 US (425–430), plus les astuces de bord relues le 3 septembre 2026*

*Ajoutée le 2 septembre 2026, sur décision de l'auteur : l'amélioration des tables prend aussi
ce que le relevé d'outillage a rapporté d'ailleurs, et pas seulement ce qui est mesuré faux ici.*

> ⚠️ **Cette tranche a été écrite deux fois, et la première version réclamait du travail déjà
> fait.** Elle annonçait *« il manque un cran entre nos deux modèles »* et *« le catalogue est
> deux noms en dur »*. Vérifié dans le code le 2 septembre 2026 : le produit porte **trois**
> modèles depuis `U13`, dans un catalogue structuré — nom, titre, poids relevé, note —, et
> celui du milieu porte littéralement le titre **« intermédiaire »**. Le commentaire du code
> invoque même la règle du dépôt : *« le catalogue décide, jamais une liste en dur »*. Et le
> produit compte **quatre** moteurs de découpe, pas trois : le remplissage depuis le bord, la
> pipette, le modèle, et la sélection magique arrivée en V2.1.
>
> **L'erreur venait du relevé d'outillage lui-même**, qui parle de *« nos deux modèles »*, et
> elle a été recopiée sans vérifier. C'est écrit ici parce qu'une tranche qui réclame du travail
> livré est la façon la plus chère de perdre une journée.

**Ce qu'on livre, une fois le faux retiré.** Trois manques réels.

**1 · Aucun de nos trois modèles n'a été entraîné sur du dessin.** Ils viennent tous de la
photographie, et nos images sont des dessins. Le catalogue de la bibliothèque en contient **un**
entraîné sur du dessin animé — c'est le plus proche de notre cas d'usage, et il n'a jamais été
essayé.

> **Le doute sur son entraînement est connu et assumé — tranché par l'auteur le 2 septembre
> 2026.** Ses jeux d'entraînement sont vraisemblablement des images sous droit d'auteur
> rassemblées sans licence ; c'est le cas de la quasi-totalité des modèles du marché, celui que
> le produit emploie déjà compris. **L'atelier est un projet personnel, rien n'en sort
> commercialement**, et l'auteur choisit en le sachant. *Ce n'est donc pas une condition de la
> tranche.* La seule chose écrite d'avance : **le jour où quelque chose sortirait de ce jeu
> contre de l'argent, cette question se rouvre** — pour ce modèle comme pour tous les autres.

**2 · Essayer le modèle lourd coûte 972 Mo.** C'est le seul de nos trois qui vise les
silhouettes difficiles — cheveux, frange, objet ajouré —, et son prix d'entrée fait qu'on ne
l'essaie pas. Un allégé de la même famille est annoncé à **88,6 Mo**, un onzième, et il n'a pas
été essayé non plus.

**3 · Le contour se pose net.** La place *contours* existe depuis la V2.1 ; ce qui lui manque
est la garantie qu'un trait posé sur un sujet réduit tombe **sur la vraie frontière** et non sur
la moyenne des deux côtés — ce que D2 rend enfin possible, puisque la frontière devient connue.

> ⚠️ **Deux pièges d'intégration sont signalés par le relevé et non vérifiés ici** : une
> normalisation qui ne divise pas par ce qu'on croit, et le comportement d'un masque réduit puis
> réagrandi sur un sprite. **À vérifier avant d'ajouter le premier modèle**, pas après.

#### Ce que la revue externe du 2 septembre 2026 nomme, et qui manquait ici

*Relu le 3 septembre 2026 dans `revue-externe-2026-09-02/`. La tranche disait « un modèle
entraîné sur du dessin » sans le nommer, et ne parlait pas du tout des trois astuces de bord.*

**Les modèles ont un nom, une licence et un poids.**

| modèle | licence | poids | entrée | ce qu'il apporte |
|---|---|---|---|---|
| `isnet-anime` | Apache-2.0 | ~170 Mo | 1024 | **le seul entraîné sur du dessin** ; c'est le manque 1 de cette tranche |
| `birefnet-general-lite` | MIT | 88,6 Mo | 1024 | l'allégé du lourd — un onzième de ses 972 Mo ; c'est le manque 2 |

> ⚠️ **Et un troisième manque, qui n'est pas une amélioration mais un défaut du réglage actuel.**
> `u2net` — **notre défaut du moteur par modèle** — infère à **320 × 320**, puis réagrandit le
> masque à la taille de l'image en Lanczos. Sur une image de 1024, c'est une carte de 320
> étirée trois fois : ce qui est plus fin que trois pixels disparaît, les coins s'arrondissent,
> et le rebond de Lanczos fabrique des alphas à 240–254 *à l'intérieur* du sujet. `isnet` et
> `birefnet` infèrent à 1024. **Les « 95 % de pixels à demi transparents » que trois documents de
> ce dépôt citent sont donc en partie la trace de ce réagrandissement, pas une frange à
> détourer.** Le défaut du moteur par modèle devrait passer à `isnet-general-use`, qui est déjà
> au catalogue : c'est une ligne, et elle change ce que rendent toutes les passes par modèle —
> donc elle se mesure avant, elle ne se glisse pas.

**Les trois astuces de bord, qui n'étaient nulle part dans le plan.** Elles répondent toutes
les trois à « un contour net, de la bonne couleur », et elles sont indépendantes :

1. **Le rongement conditionnel** — n'ôter que les pixels de bord *plus proches du fond que de
   leur voisin intérieur*, au lieu d'éroder en aveugle. Le durcissement d'aujourd'hui maigrit le
   sujet ; celui-ci ne retire que ce qui est effectivement contaminé. **~20 lignes.** C'est la
   version juste de ce que `D1` vient de rattacher au moteur.
2. **La décontamination sans matting** — donner à un pixel de bord dont la couleur est polluée
   par le fond *(distance Lab au fond sous un seuil)* la couleur du pixel intérieur le plus
   proche. C'est ce qui rend « de la bonne couleur » vrai sur un alpha binaire, sans jamais
   fabriquer de demi-transparence.
3. **Le contour qui sait qu'il est en pixel art** — deux moitiés, toutes deux absentes :
   - **la forme** : à **une** épaisseur d'un pixel, la convention du pixel art est la **croix**
     et non le carré, qui pose des pixels de coin en diagonale. Le code impose le carré partout,
     et **il a une bonne raison de le faire au-delà d'un pixel** — une croix répétée donne un
     losange, visible aux quatre coins d'un sprite (`atelier/image/traitement.py`, § La
     morphologie). Les deux ont donc raison à des épaisseurs différentes : *la croix à un pixel,
     le carré au-dessus.*
   - **la couleur** : elle est **fixe** aujourd'hui (`#000000` par défaut). Elle devrait pouvoir
     être *dérivée* — la teinte dominante du bord assombrie de 30 à 40 % en Oklab — ou **prise
     dans la palette du jeu**, ce qui est la seule des trois qui garantisse qu'un trait ne
     fabrique pas une couleur que le jeu ne contient pas.

> **La mise en garde qui va avec, et elle est ferme.** *Sur les images fabriquées ici, sur fond
> plat, aucun modèle ne battra le remplissage depuis le bord* — il est exact au pixel, sans
> rééchantillonnage, en 130 ms. Le moteur par modèle sert **les images importées** et les pièces
> qui n'ont pas de fond plat. C'est là que `isnet-anime` se mesurera, pas ailleurs.

**Critères d'acceptation**

- [x] Un modèle entraîné sur du dessin est essayé et comparé aux trois actuels sur des images du dépôt, avec le résultat écrit — **et il perd**, voir ci-dessous
- [x] L'allégé du modèle lourd est essayé, et l'écart de qualité contre ses 972 Mo est mesuré et écrit — **il gagne contre lui**
- [x] Le catalogue accueille ces modèles **sans qu'aucune autre règle change** : grisage avec sa raison, poids annoncé avant le rapatriement, choix passe par passe
- [x] **Le défaut du moteur par modèle est tranché sur mesure** : `u2net` infère à 320 et réagrandit, `isnet-general-use` à 1024 — comparés sur les mêmes images, et le verdict écrit
- [x] Le contour se pose sur la frontière retrouvée par D2, et le même réglage rend deux fois le même trait
- [x] **Le contour d'un pixel se pose en croix**, au-dessus en carré, et l'écran dit lequel
- [x] **Sa couleur peut se prendre dans la palette du jeu** au lieu d'être saisie — un trait ne fabrique plus une couleur que le jeu ne contient pas. ⚠️ **Déjà livré depuis E5**, vérifié plutôt que réécrit : `ChoixDeCouleur` montre la palette du projet en pastilles et marque une couleur hors palette. `tests/test_d4.py` le fige pour que ça ne se reperde pas
- [x] **Le rongement devient conditionnel** : il n'ôte que les pixels de bord plus proches du fond que de leur voisin intérieur, et il est comparé à l'érosion aveugle sur les images du dépôt — **47 185 pixels de sujet épargnés** sur les quatre images du banc
- [x] **Un pixel de bord contaminé prend la couleur de son voisin intérieur**, sans jamais fabriquer de demi-transparence
- [x] Les deux pièges d'intégration sont vérifiés **avant** le premier modèle ajouté, et le verdict est écrit — **les deux confirmés dans le code**, et le premier ne mord pas ici
- [x] Aucun invariant ne bouge : pas de carte graphique, pas d'appel au fournisseur, ça marche réseau coupé — `tests/test_d4.py` regarde `sys.modules`, comme `T2`

**Bloquée par** — plus rien : `D2` est close le 3 septembre 2026 et livre la frontière que le
contour attendait, `atelier.image.retrouver_grille`. *(Les modèles et les trois astuces de bord
étaient déjà indépendants.)*

> **Ce que D2 donne au contour, et ce qu'elle ne donne pas.** Elle rend le pas sur lequel le
> modèle a peint **quand il y en a un**, et elle **renonce** sur une peinture plutôt que
> d'inventer. Le contour a donc deux régimes à écrire, pas un : sur une image qui porte une
> grille, il se pose sur la frontière retrouvée ; sur une peinture, la seule frontière qui
> existe est celle de la case demandée, et c'est elle qu'il longe. Écrire le premier régime en
> supposant que la mesure répond toujours ferait exactement le défaut que D2 vient de retirer.
>
> **Et il lui manquait une chose que D2 trouvait sans la rendre : *où* la grille commence.** Le
> pas seul ne suffit pas à poser un trait dessus — un trait calé au mauvais départ tombe à
> cheval sur deux blocs, ce qui est la moitié du défaut qu'on répare. La recherche de phase
> existait dans le peigne depuis D2 ; elle était jetée aussitôt faite. `GrilleRetrouvee.phase`
> la rend, et c'est la seule chose que D4 ajoute au travail de D2.

#### Ce que le banc a répondu, et deux réponses contredisent la tranche

*Le 3 septembre 2026, `essais/essai_moteurs_de_detourage.py`, gratuit — cinq modèles, quatre
images du dépôt, relevé versionné dans `essais/mesures_moteurs_de_detourage.json`.*

| modèle | entrée | ms | part gardée | **ajouré trouvé** | accord au défaut |
|---|---|---|---|---|---|
| `birefnet-general-lite` | 1024 | 12 058 | 0,214 | **4,8** | 0,993 |
| `isnet-anime` | 1024 | 1 578 | 0,213 | **2,2** | 0,979 |
| `u2net` | 320 | 894 | 0,219 | 2,5 | 0,977 |
| `isnet-general-use` | 1024 | 1 539 | 0,215 | 3,8 | — |
| `birefnet-general` | 1024 | 21 595 | 0,214 | 3,5 | 0,996 |

**La part gardée ne sépare rien** — cinq modèles à quatre millièmes près, et c'est le chiffre
que le relevé d'outillage regardait. Ce qui sépare est **l'ajouré trouvé** : l'espace entre un
bras et un torse, une boucle de ceinture, une frange.

> ⚠️ **1 · Le modèle entraîné sur du dessin est le plus mauvais des cinq**, et c'est l'inverse
> de ce que cette tranche annonçait — *« c'est le plus proche de notre cas d'usage »*. La raison
> se comprend après coup : `isnet-anime` apprend à découper **un personnage d'un seul tenant**,
> ce qui est le contraire de garder l'ajouré. Il trouve **un** trou là où les autres en trouvent
> trois à sept, et c'est celui qui s'écarte le plus de tous les autres — 0,925 d'accord au pire.
> Il reste au catalogue, avec cette note-là écrite à côté de lui : *un modèle qu'on écarte sans
> l'avoir essayé se repropose tous les six mois.*

> ⚠️ **2 · L'allégé bat le lourd**, et il pèse **214 Mo et non 88,6** — pesé sur le disque. Le
> chiffre du plan et du relevé d'outillage était celui des poids PyTorch, pas de l'export ONNX
> que `rembg` rapatrie : un quart du lourd, pas un onzième. Et il le bat quand même : plus
> d'ajouré (4,8 contre 3,5), deux fois moins de temps, 99,5 % d'accord avec lui.

> ⚠️ **3 · Les « 95 % de pixels à demi transparents » ne viennent pas du réagrandissement**, et
> c'est cette tranche qui l'affirmait deux paragraphes plus haut. `isnet-general-use`, qui infère
> à 1024 et ne réagrandit rien, en rend **autant** que `u2net` à 3 % près — 421 092 contre
> 445 278. C'est la sortie douce du modèle, pas l'étirement du masque, et c'est le durcissement
> qui la tranche depuis toujours. *Le paragraphe fautif est laissé plus haut avec cette
> correction sous les yeux, parce qu'une affirmation retirée en silence se réécrit toute seule.*

**Le défaut passe donc à `isnet-general-use`**, et il y passe pour la ligne de l'ajouré : une
moitié de détails en plus, à part gardée égale, pour 0,7 seconde. ⚠️ **Le prix est écrit une
fois** : une recette d'avant `U13` ne nomme aucun modèle, retombe sur ce défaut-ci, et son rendu
change. Celles qui nomment `u2net` ne bougent pas d'un pixel.

#### Ce que les deux réparations de bord ont coûté, et il faut le savoir

**Elles s'appliquent sans réglage**, comme le pinceau carré de `U11`, et pour la même raison :
un réglage de plus pour choisir entre *juste* et *faux* n'est pas un réglage. Le prix se paie
donc une fois, et il est ici.

- **Le rongement conditionnel épargne 47 185 pixels de sujet** sur les quatre images du banc, et
  il **ne peut jamais en manger plus** que l'érosion aveugle — c'est un sous-ensemble, vérifié.
  Un trait d'un pixel d'épaisseur ne se ronge plus jamais : aucun de ses pixels n'a de voisin
  franchement intérieur à qui se comparer. *C'est le cas que l'érosion aveugle effaçait en
  entier — une antenne, une lanière, la pointe d'une épée.*
- **La décontamination repeint 9 à 51 % du pourtour** selon l'image, d'un écart moyen de 88 à
  197 niveaux. C'est beaucoup, et c'est le signe que le défaut était réel : ces pixels-là
  portaient la couleur du fond gris clair.
- **Un durcissement à zéro ne fait toujours rien**, et une recette qui en porte un rend donc
  exactement ce qu'elle rendait sur ce point-là.

---

### D5 · Rien ne peut être plus grand qu'un personnage — ✅ **livrée le 3 septembre 2026**
*6 US (476–481)* · **ouverte par l'auteur le jour même** : *« puis la tranche sur les tailles en suivant »*

> ### Le plafond était le personnage, et il était écrit en douze endroits
>
> Le réglage d'échelle ne savait dire que *plus petit*. Chaque image revenait dans une case carrée
> du même côté, et l'échelle disait **quelle part de cette case** le sujet remplit — un personnage
> 100 %, un meuble 66 %, un objet tenu 40 %. Un moulin, un arbre, une tour, une porte de ville :
> **le produit n'avait aucune façon de les demander**. Le modèle était juste vers le bas, et faux
> vers le haut, où il n'allait pas.
>
> Les douze endroits, comptés : trois corps de route, deux refus de service, un calcul d'image,
> trois du calibrage, la liste des positions du curseur, et les deux curseurs d'écran — celui
> d'un type dans le barème, celui d'une image dans sa table.
>
> ### Ce que font les vrais jeux 2D, et c'est ce qui a dessiné la réparation
>
> **Le carré ne change jamais de taille.** Ce qui change entre un personnage et un bâtiment est le
> *nombre* de carrés qu'il couvre, jamais leur dimension : un personnage fait 32 carrés de haut, une
> maison en fait 96 — trois fois plus de carrés de la même taille. Agrandir les carrés pour les gros
> objets est l'erreur classique, et elle porte un nom : des **« mixels »**, de *mixed pixels*. Deux
> tailles de pixel dans la même image se voient immédiatement, parce que l'œil compare les bords.
>
> Les moteurs le confirment — la résolution de base, la taille de tuile, le filtrage : **aucun de
> ces trois réglages n'a de variante « pour les gros objets »**. La taille de tuile est une propriété
> du jeu, pas de l'objet. Le détail et ses sources sont dans `docs/bilan-v3.md` § 3.
>
> ### Donc l'occupation reste, et c'est son plafond qui tombe
>
> Elle disait déjà la bonne chose — une hauteur relative au personnage —, et 300 % se lit *trois
> personnages*. **Rien ne se convertit, aucun fichier ne se réécrit**, et tout ce qui est en dessous
> de 100 % rend exactement l'image d'avant : c'est le premier critère de la tranche, et le plus
> important, puisque le dépôt a des centaines d'images déjà traitées.
>
> | ce qu'on déclare | ce qui revient | ce que ça vaut |
> |---|---|---|
> | 40 % — un objet tenu | 26 carrés dans une image de 64 | inchangé depuis T4 |
> | 100 % — un personnage | 64 carrés, l'image entière | inchangé depuis T4 |
> | 300 % — un bâtiment | **une image de 192 carrés** | **impossible avant cette tranche** |
> | 800 % — le plafond | une image de 512 carrés | huit personnages |
>
> ### La forme du fichier est une décision, et l'auteur l'a laissée au produit
>
> Ses mots : *« choisis ce qui est le mieux et compatible avec godot »*. C'est **une boîte carrée
> dont le côté suit la hauteur déclarée** — un moulin de trois personnages revient en 192 carrés de
> côté. Trois raisons, et la troisième est la plus lourde :
>
> 1. un moteur la pose telle quelle, sans un calcul ;
> 2. son côté reste **un multiple entier de la case du projet**, donc elle tombe aussi sur une
>    grille de tuiles ;
> 3. les images d'une même animation **continuent de se superposer au pixel**. Un fichier taillé au
>    ras du sujet aurait été plus léger et aurait fait perdre cette superposition — qui est très
>    exactement le défaut que la tranche d'animation doit réparer (`docs/bilan-v3.md` § 3).
>
> ### Le plafond vient de deux bornes, et chacune a sa raison
>
> **Celle du métier — huit personnages.** Un bâtiment de trois étages fait quatre à cinq
> personnages, un grand arbre cinq à six, une porte de ville six à huit. Au-delà, on ne fabrique plus
> un sujet mais un fond, et un fond est un décor : il passe par l'homothétie et ignore la case.
>
> **Celle de la machine — un canevas de 2048 carrés**, le plus grand nombre que le produit connaisse
> déjà. La plus basse des deux gagne : sur une case de 64 carrés c'est le métier qui borne, à 800 % ;
> sur une case de 512, c'est le canevas, à 400 %.
>
> **Sans la première, le curseur devenait inutilisable** — et c'est un essai qui l'a dit en
> échouant. Une case de 16 carrés autorisait 12 800 %, soit cent vingt-huit personnages :
> physiquement possible, jamais utile, et **deux mille positions** sur le curseur qu'on venait
> d'ouvrir.
>
> ### Et l'auteur a demandé les deux lectures à la fois
>
> *« Les deux, avec un rappel visuel, une sorte d'échantillon »*. Un nombre de carrés est ce que
> réclament les moteurs de jeu et les outils de dessin ; un nombre de personnages est ce qui se lit
> quand on décrit un monde. L'écran dit donc les deux, et il **dessine** le rapport : le cadre de
> l'échantillon *est* le fichier qui reviendra, et un trait pointillé y marque la hauteur d'un
> personnage — au tiers du cadre pour un bâtiment de trois.
>
> **Le dessin d'avant plafonnait à la case**, et c'est ce qui le rendait faux : une barre dans un
> carré ne peut jamais dépasser le carré, donc il montrait très exactement la limite qu'on venait
> de lever.

**Ce qu'on livre.** Une famille entière d'assets que le produit ne savait pas commander :
bâtiments, arbres, tours, portes de ville. Et pas un pixel de changé sur ce qui existe.

**Critères d'acceptation**

- [x] Un type d'objet peut se déclarer plus haut qu'un personnage, et le barème l'accepte —
      `tests/test_tailles.py`, le décor posé à 300 % par la vraie route
- [x] L'image d'un sujet à 300 % revient en 192 carrés de côté, et le sujet la remplit
- [x] **Tout ce qui est à 100 % ou en dessous rend exactement l'image d'avant la tranche**, au carré
      près et pas seulement à la taille près
- [x] Le côté de l'image reste un multiple entier de la case du projet — c'est ce qui la rend
      posable sur une grille de tuiles
- [x] L'écran dit la hauteur en personnages **et** en carrés, et la dessine
- [x] Le plafond est annoncé avec sa case, et le refus le dit au chiffre exact
- [x] Le curseur garde moins de positions qu'il n'offre de pour cent, et la propriété d'E3 tient
      de nouveau : une case plus fine laisse plus de crans
- [x] Le calibrage d'un personnage ordinaire ne bouge pas d'un carré, et celui d'un géant garde
      l'échelle déclarée

**Bloquée par** — aucune.

**Ce qui reste ouvert et n'appartient pas à cette tranche** : la **largeur**. Un sujet déclare sa
hauteur, et sa largeur suit ses propres proportions dans une boîte carrée. Un mur trois fois plus
large que haut y laisse donc du vide de part et d'autre. Aucune image du dépôt n'est dans ce cas, et
l'ouvrir demanderait une seconde question à chaque type — on attend qu'un vrai sujet la réclame.

---

## V2.4 — Ce qui est cassé se répare, et le coin du parcours se redessine

*Née le 4 septembre 2026, en reprenant une par une les remarques d'usage du carnet. **Elle ne prend
que ce qui est cassé** : des gestes que le produit propose et qui perdent du travail déjà payé, ou
qui rendent un écran impraticable. Ce qui manque attend son tour ; ce qui est rompu passe devant
l'animation.*

**Deux remarques l'ont ouverte, et aucune n'était ce qu'elle paraissait** — c'est devenu la marque
de ce carnet. *« Je ne peux pas zoomer »* cachait une image payée dont le calcul ne garde rien ;
*« ça freeze quand je tape »* cachait un projet relu quarante-deux fois pour composer un écran.
Les dossiers sont `docs/remarques/fabriquer-un-calque-a-la-main.md` et
`docs/remarques/l-ecran-fige-a-chaque-lettre.md`.*

**Une troisième s'y est ajoutée le même jour, et elle n'était rien de cassé du tout** : *« j'ai
deux calques pour la même pose, comment je choisis celui qui part ? »*. La règle qui choisit
existait et décidait déjà ; c'est l'écran qui ne la montrait ni ne la posait. Elle est devenue
`M6`, **close le jour de sa naissance** — et elle a mis au jour deux vrais défauts en passant.

**Ce qu'elle répare, en clair.** Quand on met un casque sur un personnage, l'atelier ne range pas
« le personnage casqué » : il range **le casque seul**, découpé, prêt à être reposé ailleurs. C'est
ce que le produit appelle un *calque*, et l'écran qui le fabrique s'appelle la *superposition*.
`G16` a ouvert le geste **refaire ce découpage à la main** — et il ne marche pas sur les seules
images pour lesquelles il a été ouvert.

**La mesure, faite le 4 septembre 2026 sur les deux cas réels du dépôt.** Le serveur ne
redimensionne pas l'image du dessus pour la faire entrer dans le cadre du dessous : il la colle
dans le coin haut-gauche et jette ce qui dépasse. C'est un contrat écrit, sain, et sans conséquence
tant que les deux images ont des tailles voisines — ce qui était vrai avant `G16`. Depuis, le
dessus peut être la case telle qu'elle est arrivée du modèle, et elle est bien plus grande :

| | La case arrivée | Le corps dessous | Ce que le serveur garde | Ce qu'il reste du casque |
|---|---|---|---|---|
| premier casque de *balthazar-2* | 1024 × 1024 | 253 × 321 | le coin, **7,7 %** | **0 pixel sur 214 718** |
| second casque de *balthazar-2* | 1024 × 1024 | 128 × 128 | le coin, **1,6 %** | **0 pixel sur 180 876** |

Le dessin commence à 271 pixels du bord gauche ; le coin gardé s'arrête à 253. **Le sujet est
entièrement dehors.** Le coin ne contient que du fond uni, qui ne ressemble en rien au corps : la
comparaison le garde donc en entier, et le calque qui sort est un **rectangle plein de fond**, 98 %
du cadre rempli, sans un pixel de casque. Le bouton *recaler* calcule sa proposition sur ce même
vide et rend des chiffres d'apparence honnête.

**Et c'est le pire endroit possible.** Ces deux casques sont ceux que le produit signale lui-même
comme les plus mal revenus — leur défaut est enregistré sous le nom *« échelle au retour »*, à la
gravité maximale. Sur les huit pièces d'équipement du dépôt, **deux sont dans ce cas, et ce sont
les deux qui avaient besoin du geste**.

**Pourquoi aucun essai ne l'a vu.** Tous ceux de la superposition emploient deux images de même
taille. La phrase *« ce qui déborde est perdu »* n'a pas été rouverte quand `G16` a introduit une
image huit fois plus grande.

### Pourquoi cette version passe devant l'animation

Parce qu'elle ne fait pas attendre l'animation longtemps, et parce que le contraire coûterait plus
cher : `G16` est **livrée**, l'auteur s'en sert, et chaque équipement mal revenu qu'il essaie de
rattraper lui rend un rectangle vide sans un mot. Ce n'est pas un geste qui manque, c'est du
travail payé qui se perd.

### Ce que cette version ne fait pas

- **Elle ne construit pas le grossissement, ni la main.** Les deux sont réels — l'écran n'a
  **aucun** grossissement, et la main est écrite du domaine jusqu'au calcul sans avoir jamais eu
  d'écran. *Tranché par l'auteur le 4 septembre 2026 : les poser sur l'écran d'aujourd'hui
  reviendrait à les construire deux fois, puisqu'on va le refondre.* Ils entrent dans le dessin de
  `M2`.
- **Elle ne bâtit pas l'écran refondu.** `M2` le dessine ; la tranche qui le construit ne s'écrit
  qu'une fois la maquette arbitrée — on ne sait pas encore si c'est un écran ou deux.
- **Elle ne touche pas au défaut voisin** — un calque né d'une superposition s'annonce *« corps
  habillé »*, parce que sa recette est vide et que c'est la recette qui départage les deux. Relevé
  le 4 septembre 2026, cohérent avec `E6`, faux à l'usage. Il attend son tour.

### ⚠️ Ce que la version tient pour acquis sans l'avoir mesuré

**Que ramener l'image entière donne un meilleur point de départ que le coin.** C'est évident quand
le sujet est hors du coin — mesuré, deux fois sur deux —, et ça reste à voir pour une image dont le
sujet serait *dans* le coin : la réduire l'éloignerait de sa taille d'arrivée. **Aucune image du
dépôt n'est dans ce cas**, et le calage à la main rattrape l'écart en un geste. C'est un prix
accepté, pas un oubli.

---

### M1 · Le découpage du coin, réparé — ✅ **livrée le 4 septembre 2026**

*Aucune US neuve — elle rend son sens à `US-503`, écrite pour `G16`*

**Ce qu'on livre.** Une image du dessus plus grande que le cadre du dessous **entre entière**,
réduite pour tenir, au lieu d'être coupée à son coin haut-gauche. Le calage part alors d'un point
de départ qui a un sens, et le bouton *recaler* travaille sur ce qu'il y a vraiment à caler.

**Ce que ça ne change pas, et c'est la moitié de la tranche.** Quand les deux images sont de même
taille, ou que le dessus est plus petit, **rien ne bouge, au pixel près**. C'est le cas de six des
huit pièces du dépôt, de la seule superposition qui y ait été fabriquée, et de tous les essais
existants. La loi ne change pas non plus : *le cadre du dessous fait loi*, et le calque sort à la
taille du corps — sans quoi il ne se reposerait sur rien.

**Ce que ça ne casse pas, et c'est vérifié** : **aucun réglage de superposition n'est gardé dans le
dépôt**, et la seule superposition fabriquée emploie deux images de 64 carrés de côté. La
réparation n'a rien à rattraper derrière elle.

**Ce que l'écran en dit.** Rien de neuf à dessiner, une phrase à ajouter : quand le dessus a été
ramené au cadre, l'écran le **dit**, pour qu'on ne lise pas l'échelle comme si elle partait de la
taille d'arrivée.

**Aucun appel, aucun centime** — tout se recalcule d'images déjà payées, et la tranche entière se
vérifie réseau coupé.

**Critères d'acceptation**

- [x] Un dessus plus grand que le cadre du dessous y entre **entier**, réduit pour tenir, et non
      coupé à son coin
- [x] Sur les deux casques de *balthazar-2*, le calque contient le casque — mesuré en pixels de
      sujet gardés, là où il y en avait **zéro**
- [x] Le bouton *recaler* rend sa proposition sur l'image entière, et sa couverture cesse d'être
      calculée sur du fond uni
- [x] **Deux images de même taille rendent exactement l'image d'avant la tranche**, au pixel près —
      et un essai le tient
- [x] Un essai emploie enfin **deux tailles différentes, le dessus le plus grand** : c'est ce
      qu'aucun essai de la superposition ne faisait
- [x] Le cadre de travail montre la même image que celle sur laquelle le serveur calcule
- [x] L'écran dit quand le dessus a été ramené au cadre, au lieu de le faire en silence
- [x] Aucun appel au fournisseur, aucun centime : la tranche entière se vérifie réseau coupé

**Bloquée par** — aucune. *Elle ne dépend pas de `M2` : elle ne change pas un pixel de l'écran.*

#### ⚠️ Ce que la mesure a corrigé de la tranche elle-même

**Le geste était cassé pour les neuf pièces du dépôt, et non pour deux.** Le banc écrit pour la
tranche reprend chaque pièce d'équipement, la repose sur son corps en repartant de la case telle
qu'elle est arrivée, et compte les pixels de sujet que le calque contient. **Neuf sur neuf en
rendaient zéro**, et le calque sortait rempli de fond uni à 95–98 % du cadre. La raison est simple
et vaut pour toutes : *un modèle rend 1 024 quelle que soit la taille du corps envoyé* — la case
arrivée est donc toujours bien plus grande que le cadre, et le coin ne tombait jamais sur le sujet.

Les deux casques de *balthazar-2* restent ceux dont la tranche parle, mais pour l'autre raison :
ce sont les deux **qui avaient besoin du geste**, signalés à la gravité maximale sous le nom
*« échelle au retour »*. Les chiffres de la tranche se retrouvent : *0 sur 213 836* pour le premier
casque — la tranche annonçait 213 836 sous la forme 214 718 —, *0 sur 180 320* pour le second,
et le coin gardait 7,7 % et 1,6 % de l'image.

**Et le compte de ce qui ne bouge pas était mesuré sur la mauvaise image.** La tranche disait *six
des huit pièces* : c'est vrai des tailles **rangées sur le disque**. Le service, lui, lit l'image
**rendue** — et sur le rendu, **les neuf pièces tiennent déjà dans le cadre de leur corps**. Elles
rendent donc toutes le calque d'avant la tranche, au pixel près, ce que le banc vérifie une par une.

---

### M2 · Le coin du parcours se redessine — maquette seule — ✅ **dessinée le 4 septembre 2026**

*Aucune US neuve — une maquette n'a pas d'utilisateur qui la demande ; c'est le cas d'`E0`, `F0` et
`A0`*

> **Elle est dans `docs/maquettes-v2.4/01-le-coin-du-calque.html`**, et elle s'ouvre d'un
> double-clic. **Elle attend l'arbitrage de l'auteur** : ce qu'elle tranche fait foi pour la
> tranche qui bâtira l'écran, et cette tranche-là ne s'écrit pas avant.

**Ce qu'on livre.** Une maquette, et rien d'autre. **Elle ne construit rien et ne se code pas.**

**Le fait qu'elle a à régler.** Trois endroits du produit fabriquent ou réparent un calque, et
aucun ne ressemble aux autres :

| | Choisir les deux images | Caler l'une sur l'autre | Grossir | La main |
|---|---|---|---|---|
| **La planche d'équipement** — on commande, l'atelier déduit | non | non | — | non |
| **La carte d'un vêtement** — *zone · affinage · retouche* | non | non | **non** | **oui** |
| **La superposition** | **oui** | **oui** | **non** | **non** |

Aucun des trois n'a de grossissement. L'un a la main sans le choix des images ; l'autre le choix et
le calage sans la main. **Pour faire le travail en entier il faut passer de l'un à l'autre, et rien
ne dit qu'ils se complètent.** C'est le mot de l'auteur : *« ce n'est pas trop logique ni bien
organisé cette partie du workflow »*.

**Ce qu'elle réemploie plutôt que d'inventer.** Deux choses sont déjà construites et l'attendent :

- **Le grossissement libre** — molette, image qu'on attrape et qu'on déplace, jusqu'à seize fois
  l'ajustement — existe sur l'écran « voir en grand » de la galerie, avec sa raison écrite : *seize
  fois suffit à compter les pixels d'un sprite*. La maquette le reprend ; elle n'en dessine pas un
  troisième, à côté de celui des tables qui compte en pour-cent.
- **La main** est écrite de bout en bout — la définition, l'échange avec le serveur, le calcul, et
  jusqu'à sa raison : *« un casque sombre sur des cheveux sombres, qu'aucun seuil ne distingue »*.
  **Seul l'écran manque.** Le seul endroit qui la nomme aujourd'hui est le bouton *Tout défaire*,
  qui propose d'annuler un geste qu'on ne peut pas faire.

**Ce à quoi elle doit répondre, et qu'aucune des deux autres pistes ne réglait**

- Un écran ou deux ? Et si c'est un, par quelles portes y entre-t-on ?
- Que devient **la carte d'un vêtement** et ses trois outils : elle disparaît, elle se réduit, ou
  elle reste et renvoie vers l'écran unique ?
- Comment **tracer un rectangle** et **attraper l'image pour la déplacer** cohabitent, puisque
  c'est la même main. Le produit a déjà tranché ce conflit ailleurs, par un seuil de trois pixels
  entre un clic et un glissement ; ici il faudra sans doute séparer autrement.
- Où va la main : sur le même cadre que le calage, ou sur un moment d'après ?

**Critères d'acceptation**

- [x] La maquette existe dans `docs/maquettes-v2.4/`, ouvrable seule, sans serveur
- [x] Elle montre le parcours entier — entrer, choisir, caler, grossir, retoucher, fabriquer — et
      dit d'où l'on y entre
- [x] Elle tranche ce que devient la carte d'un vêtement, et l'écrit
- [x] Elle tranche le partage entre tracer et déplacer, et l'écrit
- [x] Elle réemploie le grossissement de l'aperçu et la main du calque : **aucun troisième
      mécanisme** pour un geste qui existe deux fois
- [x] Elle doit sa ligne au guide pour tout écran ou réglage qu'elle ajoute — la règle du dépôt
- [x] **Elle ne code rien** : aucun fichier de l'interface ni du serveur n'est touché par cette
      tranche

**Bloquée par** — aucune. *`M1` peut se construire avant, pendant ou après : elles ne se touchent
pas.*

#### Les quatre réponses, et ce qu'elles écartent

*Elles font foi pour la tranche qui bâtira l'écran. Le détail, les croquis et les raisons vivent
dans la maquette ; ce qui suit en est le verdict, pour qu'on n'ait pas à l'ouvrir pour le
connaître.*

| La question | La réponse | Ce qu'elle écarte, et pourquoi |
|---|---|---|
| **Un écran ou deux ?** | **Un seul** — la superposition élargie, qui prend le grossissement et la main | Les deux sortes de calque ne diffèrent que sur un point : **le dessous est imposé** quand on vient d'une pose, **choisi** quand on vient d'une image. Deux écrans pour un seul écart seraient deux vérités sur le même calque |
| **Que devient la carte d'un vêtement ?** | **Elle reste, et se réduit à une fiche qui montre et qui renvoie** : le calque sur son corps, ses cinq mesures, *◤ favori*, *Supprimer cette image*, et une porte neuve *reprendre ce calque ›* | Ses trois outils partent, et **ils ne se perdent pas** : la *zone* **est** le rectangle, l'*affinage* et la *retouche* **sont** les deux couches de la main. La faire disparaître obligerait à ouvrir un atelier pour regarder un calque, ce qu'on fait dix fois plus souvent qu'on ne le retouche |
| **Tracer contre déplacer ?** | **L'outil décide, pas le geste** — quatre outils au-dessus du cadre : *déplacer* (le défaut), *rectangle*, *ôter*, *remettre*. La molette grossit toujours | **Le seuil de trois pixels ne s'applique pas** : les deux gestes sont des glissements de même longueur au même endroit, et un seuil sépare des longueurs, pas des intentions. Le choix d'outil est déjà le motif de la carte d'un vêtement — on lui ajoute un outil, on n'invente pas un mécanisme |
| **Où va la main ?** | **Sur le même cadre que le calage**, et après lui dans l'ordre de lecture de la colonne | C'est l'ordre du calcul — la main tranche **après** la mesure. Un second cadre aurait donné deux vues de la même image à tenir d'accord ; *« trois outils, une seule surface »* est déjà la règle de la carte d'un vêtement |

**Les quatre portes**, dont deux sont neuves : la puce *superposition* d'une image *(existe)*, la
carte d'un vêtement *(neuve)*, la matrice d'un personnage sur la vignette du calque retenu
*(neuve)*, et la planche d'équipement — qui **n'y mène pas et ne doit pas y mener** : c'est le
chemin qui paie, et l'écran unique promet qu'aucun appel n'en part.

**Ce que la construction devra au guide**, et la maquette le nomme : le grossissement du cadre, la
main, l'outil du cadre, le dessous imposé. Trois entrées existantes se relisent au passage plutôt
que de se dédoubler.

**Ce que la maquette laisse ouvert, et à l'auteur** — **le nom de l'écran.** *« Superposition »*
décrit ce qu'il faisait, pas ce qu'il fera ; un nom se choisit une fois l'écran vu, et le changer
coûte aussi la ligne du guide, la puce des tables et deux essais.

---

### M3 · Corriger un texte cesse de figer l'écran — ✅ **livrée le 4 septembre 2026**

*Aucune US neuve — elle tient `US-296`, l'écran qui montre ce qui part avant de payer*

**Ce qu'on livre.** On corrige une ligne de la fenêtre de confirmation comme on écrit dans
n'importe quel champ : les lettres s'affichent au fur et à mesure, **le curseur reste où on l'a
mis**, et le prix se remet à jour quand la frappe se pose.

**Trois défauts, et ils ne sont pas de la même famille.** L'auteur les a vécus comme un seul —
*« ça freeze »* — et ils se réparent ensemble parce qu'ils se cachent l'un l'autre.

> ### ① Composer ce qui part relit le projet quarante-deux fois
>
> **Mesuré le 4 septembre 2026, sur les vraies données, un sac de voyage posé sur une pose du
> pèlerin.** Le temps que met l'atelier à dire ce qui part ne suit rien d'autre que le nombre de
> fois où il relit le projet du jeu :
>
> | Ce qu'on demande | Lectures du projet | Le temps |
> |---|---|---|
> | l'aperçu du texte seul | **5** | 27 ms |
> | la confirmation d'une image ordinaire | **15** | 122 ms |
> | **la confirmation d'un équipement** | **42** | **322 ms** |
>
> Une lecture ouvre une connexion neuve à la base, pose deux réglages, lit un bloc de 5,4 Ko, le
> reconstruit entièrement en mémoire, puis referme. **Refermer à chaque opération est une décision
> écrite** — c'est ce qui permet d'effacer le fichier de la base sous Windows, et c'est un critère
> du produit depuis `T3`. **Ce qui n'a jamais été décidé, c'est de le faire quarante-deux fois pour
> répondre à une seule question.** Le compte vient de ce que chaque petit service redemande le
> projet pour son compte : la liste des personnages est relue dix-huit fois, l'ambiance quatre fois.
>
> **Mesuré en alternant les deux façons de faire, quarante fois, même machine, même instant** :
> 351 ms tel quel, **100 ms** quand le projet est lu une seule fois. **71 % de moins**, sans rien
> changer à ce que l'écran affiche ni à ce qu'on y fait.

> ### ② Chaque lettre déclenche un aller-retour
>
> Une lettre tapée écrit dans le tri, le tri est une dépendance de l'effet qui redemande ce qui
> part. **Un mot de dix lettres, dix allers-retours enchaînés.** L'appel rapporte le texte et le
> prix ensemble et ne peut pas être coupé en deux — c'est une règle écrite, et elle ne bouge pas.

> ### ③ Le curseur repart à la fin, deux fois par lettre
>
> **Relevé par l'auteur le 4 septembre 2026** : *« si je modifiais le début ou le milieu c'est
> chiant »*. Le champ de correction n'a aucune mémoire à lui — ce qu'il affiche vient directement
> de la dernière réponse du serveur. À chaque lettre : l'écran se redessine **avant** la réponse,
> donc avec le texte d'avant la lettre ; le navigateur, à qui l'on réécrit le contenu d'un champ,
> replace le curseur à la fin ; puis la réponse arrive, le texte est réécrit, et le curseur repart
> à la fin. **Deux sauts par lettre, et entre les deux un texte en retard d'une frappe.**
>
> C'est ce défaut-là qui rend la correction du milieu d'une ligne impraticable, quand les deux
> autres ne la rendaient que lente. Taper à la fin le masque, puisque la fin est là où le curseur
> atterrit.

**Ce que la tranche ne fait pas.** Elle ne pose **pas** de bouton *valider* à la place du lien
*fermer*. C'était la proposition de départ de l'auteur, et **il l'a écartée lui-même en
arbitrant** : elle existait pour supprimer les allers-retours, et une fois ① et ② faits il n'y en a
plus à supprimer. Elle aurait coûté un geste de plus à chaque correction, et surtout elle aurait
laissé, entre la frappe et la validation, **un prix affiché qui ne correspond plus au texte lu** —
exactement ce que la règle *« le texte et le prix ensemble »* interdit.

**La portée est la composition entière, et c'est tranché.** On ne répare pas le seul écran où la
lenteur se voit : les cinq lectures de l'aperçu, les quinze de l'écran ordinaire et les quarante-deux
de l'équipement sortent du même endroit. On y passe une fois.

**Aucun appel, aucun centime** — la tranche entière se vérifie serveur du fournisseur coupé.

**Critères d'acceptation**

- [x] Composer ce qui part **lit le projet une seule fois** par demande, et un essai compte les
      lectures au lieu de mesurer un temps — un temps dépend de la machine, un compte non
- [x] Le compte tombe à **1** sur les trois cas mesurés : l'aperçu du texte, la confirmation d'une
      image ordinaire, la confirmation d'un équipement
- [x] **Ce que l'écran affiche ne change pas d'un caractère** avant et après la réparation, sur ces
      trois cas
- [x] La demande ne repart qu'une fois la frappe posée, et jamais à chaque lettre
- [x] **Le curseur reste où l'auteur l'a mis**, y compris au milieu d'une ligne, y compris pendant
      qu'une demande est en vol
- [x] Le champ montre toujours ce qui vient d'être tapé, jamais un texte en retard
- [x] Le prix et le texte restent affichés ensemble, et jamais l'un sans l'autre : la règle ne bouge
      pas
- [x] Aucun appel au fournisseur, aucun centime

**Bloquée par** — aucune. *Elle ne touche ni `M1` ni `M2`.*

#### Ce que la construction a appris

**Le montage d'essai retrouve les chiffres des vraies données, à l'unité près** — 5, 15 et 42
lectures. Cela dit que le compte ne dépendait pas du contenu du jeu mais de **la façon dont la
composition est écrite** : chaque petit service redemande le projet pour son compte, et un projet
de deux images le relit autant de fois qu'un projet de deux cents. La réparation valait donc pour
tout le monde, pas seulement pour l'atelier chargé de l'auteur.

**La portée du mémo est explicite et courte, et c'est le cœur de la décision.** Un cache posé sur
`lire_projet` une fois pour toutes aurait été plus court à écrire et faux : on n'aurait plus su
dire de quand datait ce qu'on lisait. Ici un service l'ouvre le temps de composer et le referme —
hors de là, `lire_projet` relit le disque comme avant, et enregistrer ou oublier un projet vide le
mémo sur-le-champ. **La connexion par opération ne bouge pas** : refermer à chaque fois est ce qui
permet d'effacer le fichier de l'index sous Windows, critère du produit depuis `T3`.

**Un essai qui compte a besoin d'une couture pour compter.** `Base` sépare désormais `lire_projet`,
qui répond, de `_lire_projet_du_disque`, qui va chercher : sans cette séparation, l'essai aurait
compté des **appels** — quarante-deux avant comme après — au lieu de compter des **lectures**.

**Et le témoin est la moitié qui compte.** Chaque cas est joué deux fois, mémo débranché puis
branché, et les deux réponses sont comparées caractère par caractère. Un mémo qui répondrait autre
chose que le disque serait pire que la lenteur qu'il répare.

**Deux essais d'écran ont été écrits contre eux-mêmes avant d'être gardés.** Le premier essai du
repos passait **même sans repos du tout** : six frappes d'affilée dans une seule bouffée
d'instructions ne laissent rien se déclencher entre elles. Espacées de trente millisecondes — la
frappe d'un dactylo pressé —, elles font six demandes sans la réparation et une seule avec. Le
curseur, lui, saute de 11 à 18 quand on retire le brouillon du champ. **Un essai qu'on n'a pas vu
échouer ne prouve rien.**

> #### Vérifié au navigateur, sur un atelier jetable en 8427
>
> Curseur posé au septième caractère de *marais de fer*, cinq lettres tapées à la main : le champ
> montre *marais gris de fer*, **le curseur reste au douzième**, et il y reste encore après que la
> réponse du serveur a redessiné l'écran. L'onglet réseau ne montre que **deux** demandes en tout
> — une à l'ouverture, une une fois la frappe posée. Le texte qui part dit *World: marais gris de
> fer* mot pour mot, avec son prix à côté. *Remettre* efface le brouillon avec la correction, et
> le mot *gris* disparaît des deux endroits à la fois.
>
> L'atelier de l'auteur, sur 8420, n'a pas été touché.

---

### M4 · La planche cesse d'être mal décrite — ✅ **livrée le 4 septembre 2026**

*Aucune US neuve — elle tient `US-126` et `US-296`, prolonge le travail de `R7` sur les images
nommées, et **ferme une phrase du genre de `G1`**, née le jour de sa clôture*

**Ce qu'on livre.** Partout où le produit parle de la planche — l'écran qui montre ce qui part,
l'écran de la planche elle-même, et le texte envoyé au modèle — **il en dit la même chose, et c'est
vrai**.

> **Deux remarques, et c'est une seule cause.** *« Le gabarit qu'on me propose, je ne l'ai jamais
> validé »* et *« pourquoi on parle de planche et de cases pour une seule pose ? »* ont été écrites
> le même jour, sur le même écran, sans se ressembler. Elles disent la même chose : **la planche est
> mal décrite, et elle l'est à trois endroits différents.**

---

#### ① L'écran nomme une image autrement que le texte qui part, au même instant

Les deux phrases s'affichent ensemble, à quelques centimètres l'une de l'autre :

| | Ce qui est écrit |
|---|---|
| le texte qui part au modèle | *« Image 3 — THE SPRITE SHEET TO CHANGE : 1 sprites of the same character, already drawn. Keep every cell where it is and change only what the request below asks »* |
| l'écran, plus bas | *« Image 3 · le gabarit de la grille, qui dit au modèle où poser les 1 sujets »* |

L'un dit *voici la planche existante, n'y change que ce qu'on demande* ; l'autre dit *voici une
grille vide, place les sujets dedans*. **Deux demandes opposées, une seule image** — et c'est au
moment où l'auteur décide de payer. Il cherchait une image qu'il aurait validée : c'était son
propre corps, redessiné à la volée.

**Le serveur sait très bien laquelle des deux c'est.** Il distingue deux rôles — *le gabarit*, des
cases vides à remplir, et *la planche*, des corps déjà là à modifier — et une seule fonction en
décide, écrite exprès pour qu'aucun rang ne se trompe. Son propre commentaire l'écrit : *« une
planche d'équipement en envoie une aussi — et c'est la planche elle-même, pas un gabarit »*. Mais
**ce qu'il renvoie à l'écran est un nombre, sans le rôle** : l'écran n'a pas de quoi choisir ses
mots, et il a gardé ceux du plus ancien des deux cas. Le gabarit vient de `C2` ; la planche
d'équipement est arrivée en `C3`, a réemployé la même place et le même compteur, et la phrase n'a
pas été rouverte.

**Les trois images, et ce que l'écran en fait aujourd'hui** — mesuré le 4 septembre 2026 sur un sac
de voyage posé sur une pose du pèlerin :

| L'image | Où l'écran la met | Vignette | S'ouvre | Se décoche |
|---|---|---|---|---|
| **1** — le personnage déjà dessiné | une ligne de la liste | oui | oui | oui |
| **2** — l'artwork officiel, pour le style | une ligne de la liste | oui | oui | oui |
| **3** — la planche du corps à habiller | **un paragraphe sous la liste** | **non** | **non** | non |

**Qu'elle ne se décoche pas reste vrai, et c'est écrit** : *décocher reviendrait à demander une
planche sans dire à quoi elle ressemble*. **Qu'on ne puisse pas la voir n'a jamais été décidé.**

**La légende ne peut pas déménager**, et l'auteur ne pouvait pas le savoir en l'écrivant : le bloc
*« Image 1 — …, Image 2 — … »* est du texte qui part au modèle, et l'écran promet de montrer ce qui
part mot pour mot, dans l'ordre où c'est assemblé. Elle est donc **recopiée** sous chaque image, et
l'écran dit ce que chaque endroit est : en haut *ce qui part*, en bas *ce que ça décrit*.

**La traduction est écartée, et par l'auteur.** Montrer la légende en français à côté de l'image la
rendrait lisible d'un coup, au prix d'un second texte à tenir d'accord avec le premier — la
fabrique à deux vérités que le dépôt refuse partout ailleurs. *La question se rouvre si la légende
recopiée ne suffit pas ; pas avant.*

#### ② Le texte qui part décrit une grille qui n'existe pas — sur 64 % des planches

**La mécanique, elle, est juste, et la question de l'auteur a une bonne réponse.** Une pose qu'on
*crée* n'est jamais pliée en dessous de deux cases — plier pour une seule ferait payer un gabarit
pour rien. Une pièce posée sur un corps l'est **toujours**, même à une case : habiller consiste à
renvoyer la même planche avec la pièce en plus, et le calque se fabrique par différence entre les
deux. **Sans planche, il n'y a rien à comparer.** Rien à changer là.

**Ce qui en sort, si.** Le texte est composé avec les nombres de la grille, sans jamais accorder :

> *« The attached image is a sprite sheet of **1 sprites** of the same character, laid out in
> exactly **1 columns** and **1 rows** »*

**Mesuré le 4 septembre 2026 sur les vraies planches du dépôt.** La faute apparaît dès qu'une
dimension vaut un, ce qui est le cas courant :

| Cases | La grille | Ce qui est faux | |
|---|---|---|---|
| **1** | 1 × 1 | *1 sprites*, *1 columns*, *1 rows* | **7 planches du dépôt** |
| **2** | 2 × 1 | *1 rows* | **7 planches du dépôt** |
| 3 et au-delà | 2 × 2, 3 × 2… | rien | 8 planches |

**14 planches sur 22 — 64 % — ont reçu un pluriel faux. Et les 7 planches d'équipement du dépôt
sont toutes dans ce cas.**

**Ce n'est pas qu'une faute d'accord.** À une case, le texte affirme au modèle qu'il regarde une
feuille de contact quadrillée, lui demande de *garder exactement la même grille*, et lui interdit
*les bordures de cases et les lignes de grille* — pour une image qui n'a ni cases ni grille. **Ce
qui part est une description de ce que l'image n'est pas.**

**La redondance du texte ne se rediscute pas** : un banc du 28 août 2026 l'a étalonnée, et la règle
qu'il en tire est que *tout ce qu'on ne dit pas explicitement « ne change pas » est une invitation à
le changer*. Ce qui est en cause n'est pas la redondance, c'est qu'elle décrive une grille absente.

#### ③ Et l'écran de la planche affirme le contraire de ce que le produit fait depuis la veille

Trouvée en vérifiant le point ②, hors du périmètre des deux remarques. L'écran de la planche dit
encore :

> *« la planche n'y entre **pas** — ses N morceaux, oui, chacun dans sa direction. C'est une ruse
> pour payer moins, pas un format de livraison. »*

**C'était vrai jusqu'au 3 septembre 2026 à 23 h 45**, heure de la livraison de `G16`. Depuis, la
planche **entre en bibliothèque** : elle s'y regarde, s'y met en favori, s'en exporte, et un fichier
entier du produit ne décrit qu'elle. L'invariant qui portait la phrase — *le pliage est une ruse
d'appel, jamais un format de livraison* — est **renversé**, et ce plan l'écrit deux cents lignes
plus haut. L'écran de la planche n'a pas été touché depuis la tranche qui l'a créé.

**C'est une dixième phrase du genre de celles de `G1`**, et elle a tenu **un jour**. La `V3.1` avait
écrit noir sur blanc que rien dans le produit n'empêchait la dixième ; la voici.

---

**⚠️ Ce que la tranche coûte, et il faut le savoir.** Le point ② **change ce qui part au
fournisseur**, donc il **invalide les comparaisons avec les tirages déjà payés** sur les planches
d'une et de deux cases. C'est le même prix que `D3` a accepté en l'écrivant, et il est accepté ici
de la même façon : *un prix, pas un oubli.*

**Ce que la tranche ne fait pas.** Elle n'explique nulle part **pourquoi** une planche d'une case
existe. Un auteur qui en voit passer une n'a toujours aucun moyen de l'apprendre. *Écarté par
l'auteur le 4 septembre 2026 ; à reprendre si la question revient.*

**Aucun appel, aucun centime** — les deux sortes d'images sont des octets que le serveur fabrique
déjà pour l'appel, et il sait les rendre en aperçu sans rien ranger sur le disque. Mesurer le gain
du point ②, en revanche, coûterait des tirages : **ce n'est pas fait, et ce n'est pas promis.**

**Critères d'acceptation**

*① l'écran de confirmation*

- [x] Le serveur dit **lequel des deux rôles** il a choisi, et l'écran a deux phrases au lieu d'une
- [x] Sur une planche d'équipement, l'écran dit *la planche du corps, que le modèle doit modifier* —
      **et un essai compare cette phrase à celle du texte qui part**, pour que les deux ne puissent
      plus diverger
- [x] Sur une grille vide, l'écran dit toujours *le gabarit de la grille, qui dit où poser les
      sujets*
- [x] La troisième image a **sa vignette** et s'ouvre en grand, comme les deux autres
- [x] Elle **n'a pas de case à cocher** — pas une case grisée : une ligne sans case, qui porte sa
      raison
- [x] Chaque image porte, sous elle, le morceau de légende qui la concerne
- [x] La légende reste **entière et inchangée** dans ce qui part, mot pour mot

*② le texte qui part au modèle*

- [x] Les nombres s'accordent : *1 sprite*, *1 column*, *1 row* — **et un essai le tient pour 1, 2 et
      4 cases**, les trois formes que le dépôt produit
- [x] À **une seule case**, le texte dit ce que l'image est — une image unique à modifier — et ne
      parle plus ni de feuille, ni de cases, ni de lignes de grille, ni de bordures à ne pas dessiner
- [x] À deux cases et au-delà, le texte reste **mot pour mot celui d'aujourd'hui**, redondance
      comprise : le banc du 28 août n'est pas rejoué
- [x] Le plan **écrit** que les comparaisons avec les tirages d'avant ne valent plus sur les
      planches d'une et deux cases

*③ l'écran de la planche*

- [x] *« la planche n'y entre pas »* est réécrite : elle y entre, avec le coût de l'appel, et ses
      morceaux à côté
- [x] Aucune autre phrase de cet écran ne contredit ce que `G16` a livré — **il est relu en entier**

- [x] Aucun appel au fournisseur, aucun centime : la tranche se vérifie serveur du fournisseur coupé

**Bloquée par** — aucune. *Elle touche le même écran que `M3` et `M5`, et pas les mêmes endroits :
`M3` répare ce qu'il fait, `M5` ce qu'il perd, celle-ci ce qu'il dit. **`M5` se pose après elle**,
parce que le geste de `M5` vient dans la liste que celle-ci refait.*

**Ce qui reste ouvert** — **le dessin de la ligne sans case.** Une ligne sans case dans une liste de
cases doit se lire autrement qu'une case grisée, et c'est exactement ce que la décision d'origine
voulait éviter. *À trancher en construisant, contre le motif écrit du dépôt — « le grisé porte sa
raison ».*

#### Ce que la construction a appris, et ce qu'elle a tranché

**La ligne sans case est dessinée, et voici ce qui a été retenu.** La colonne de la case reste
**vide** au lieu de porter un carré grisé, et la vignette garde donc son alignement avec celles du
dessus. La raison s'écrit à la suite du nom, sur la même ligne, dans le gris des origines : *elle ne
se décoche pas — sans elle, il n'y aurait rien à modifier — et elle compte dans les places*. Le
motif du dépôt — *le grisé porte sa raison* — n'est pas enfreint : il vaut pour **ce qu'on pourrait
faire et qui est refusé ici**, et cette image-là n'est refusée nulle part. Une case grisée aurait
demandé de comprendre pourquoi elle l'est ; une ligne sans case dit qu'il n'y a rien à décider.

**Le rôle est descendu d'un cran, et c'est ce qui répare vraiment ①.** La décision *gabarit ou
planche* existait à deux endroits — le texte qui nomme les images, et le compte des images — et les
deux copies avaient divergé. Elle vit désormais dans une seule fonction, `role_de_planche`, que les
deux appellent. Le compte, lui, rendait un **nombre** ; il rend maintenant le nom du rôle à côté, et
l'écran n'a plus rien à deviner.

> #### ⚠️ Une troisième phrase fausse, trouvée en relisant l'écran de la planche
>
> Le critère demandait de relire l'écran **en entier**, et la relecture a rapporté plus que ce
> qu'elle cherchait. *« Un compte de cases faux ne fait rien entrer : la planche entière se relance,
> au prix plein »* n'est plus vrai que d'une moitié depuis `R6` : **un sujet qui manque refuse
> encore, un sujet de trop ne jette plus rien.** Le relevé qui avait changé la règle est net —
> quatre planches sur treize du banc d'animation refusées pour un sujet en trop, soit 31 % des
> appels payés perdus sur un geste dont c'est le régime normal. La phrase promettait donc, avant de
> payer, exactement le contraire de ce que le produit fait.
>
> Elle est réécrite dans les deux sens. **Ce n'est pas une phrase du genre de `G1` de plus** : celle
> de `G16` avait tenu un jour, celle-ci a tenu **le jour même** — `R6` et cet écran ont été touchés
> à quelques heures d'intervalle le 3 septembre.

**Ce que la mesure a confirmé, et il ne change pas.** Les comparaisons avec les tirages déjà payés
ne valent plus sur les planches d'**une et de deux cases**, et sur elles seules : à trois cases et
au-delà, la grille la plus carrée n'a jamais de dimension à un, et le texte est **identique au
caractère près** à celui d'avant. C'est le prix écrit avant de commencer, et il est payé tel quel.

> #### Vérifié au navigateur, sur l'atelier jetable en 8427
>
> Sur une planche d'équipement à deux poses : la troisième image est une **ligne comme les autres**,
> avec la feuille elle-même en vignette — les deux corps côte à côte —, *Image 1*, la phrase *la
> planche du corps, que le modèle doit modifier*, sa raison à côté, **aucun bouton dans la ligne**,
> et sous elle la légende telle qu'elle part. La barre d'espace l'ouvre en grand comme n'importe
> quelle autre image, et le bas de l'aperçu la nomme.
>
> Le texte qui part écrit *laid out in exactly 2 columns and 1 row* — l'accord est là où il
> manquait. À **une seule** case, la consigne de planche ne contient plus un seul mot de grille :
> ni *sheet*, ni *cell*, ni *column*, ni *row*, ni *border*, et les six garanties de non-changement
> y sont mot pour mot.
>
> Sur l'écran de la planche : *la planche y entre, et elle porte le prix de l'appel — ses 4 morceaux
> entrent à côté*, et la phrase du compte dit maintenant ce qui arrive dans les deux sens.

---

### M5 · Une référence s'ajoute sans perdre ses corrections

*Aucune US neuve — elle tient `US-126` et `US-160`, et **révise une décision écrite**, celle du tri
qui repart de rien*

**Ce qu'on livre.** En lisant ce qui va partir, on s'aperçoit qu'une image de référence manque. On
l'ajoute — **sans refermer la fenêtre** —, et si l'on doit malgré tout sortir, **les corrections
qu'on venait d'écrire sont encore là au retour**.

> ### Le défaut n'est pas un oubli : trois décisions justes se rencontrent
>
> Aucune des trois n'est fautive prise seule, et c'est ce qui l'a rendu invisible.
>
> | La décision | Où elle est écrite | Ce qu'elle fait ici |
> |---|---|---|
> | **la fenêtre de confirmation recouvre tout le produit** — c'est ce qui en fait le seul endroit d'où l'argent part | huit conditions dans l'écran principal | il n'existe **aucun chemin** vers une image sans la refermer |
> | ***réinjecter* va où son effet se voit** — *« sinon l'auteur est devant un geste dont rien n'a bougé à l'écran »* | le geste lui-même | ajouter une référence **force un changement d'onglet** |
> | **le tri repart de rien à chaque ouverture** — *« ce qu'on a éteint la fois d'avant ne vaut que pour l'appel d'avant »* | l'ouverture de la fenêtre, et le changement d'onglet | changer d'onglet **vide les corrections** |
>
> **Leur rencontre met l'auteur devant un choix que personne n'a voulu lui imposer** : garder ses
> corrections, ou ajouter l'image dont il vient de voir qu'elle manquait. Et c'est le pire moment
> pour ça — cette fenêtre est **le seul endroit du produit qui montre quelles références partent**,
> donc le seul où l'on s'aperçoit qu'il en manque une.
>
> Dans la fenêtre, on peut **décocher** une image jointe ; on ne peut jamais en ajouter une.

**⚠️ Ce que la tranche révise, et elle le fait par écrit.** La règle du tri visait un vrai danger —
un réglage qui traînerait d'un appel au suivant — et elle reste. Ce qui change est **ce qu'elle
appelle un autre appel** : sortir chercher une image et revenir n'en est pas un. *La décision est
réécrite avec sa nouvelle raison, à l'endroit où elle est écrite ; elle n'est pas contournée en
silence.* C'est le motif du dépôt, celui de `G6`, `G7` et `G8`.

**Les deux moitiés, et leur ordre compte**

- **① les corrections survivent à l'aller-retour.** Peu de travail, et c'est le vrai reproche. Elle
  est **livrable seule**, et elle rend l'écran acceptable tout de suite.
- **② ajouter une référence sans refermer.** Un geste *ajouter une référence ›* dans la section des
  images jointes, qui ouvre une surface de choix par-dessus et revient avec l'image.

`①` seule laisse le détour ; `②` seule laisserait la perte entière dès qu'on sort pour une autre
raison. **On ne construit pas `②` avant `①`.**

**La surface de choix ne s'invente pas.** L'invariant du produit dit **une seule grille d'assets
dans tout l'atelier** : celle qui s'ouvre ici est celle-là, réemployée. En dessiner une neuvième
serait une neuvième façon de choisir une image, et c'est la contrainte principale de la seconde
moitié — c'est aussi ce qui en fait la plus chère.

**Ce que la tranche ne fait pas.** Elle n'empêche pas *réinjecter* de changer d'onglet. Ç'aurait été
utile si l'on devait continuer à sortir ; une fois `②` faite, on ne sort plus. *Si `②` devait
tarder, la question se rouvre.*

**Aucun appel, aucun centime** : choisir une image de référence ne fait aucun appel.

**Critères d'acceptation**

- [ ] Sortir de la fenêtre de confirmation et y revenir **pour le même appel** rend les corrections
      intactes — chaque ligne éteinte, allumée ou réécrite est comme on l'avait laissée
- [ ] Un appel qui a changé repart d'un tri vide, comme aujourd'hui — **et un essai tient les deux
      cas**, pas seulement le nouveau
- [ ] La décision écrite est **réécrite avec sa nouvelle raison**, et dit ce qu'est « le même
      appel »
- [ ] Un geste *ajouter une référence ›* vit dans la section des images jointes
- [ ] Il ouvre **la grille d'assets du produit**, pas une surface neuve — l'invariant ne bouge pas
- [ ] L'image choisie entre dans la liste, avec son rôle, **sans que la fenêtre se referme**
- [ ] Les corrections en cours ne bougent pas d'un caractère pendant l'ajout
- [ ] Aucun appel au fournisseur, aucun centime

**Bloquée par** — aucune. *Elle touche le même écran que `M3` et `M4`, et pas les mêmes endroits.
`M4` refait la section des images jointes, où le geste de celle-ci vient se poser : **les faire dans
cet ordre évite de dessiner deux fois la même liste.***

---

### M6 · Deux images pour une case : laquelle part — **close le 4 septembre 2026**

*`US-504` et `US-505`*

**Ce qu'on livre.** Une pose qui porte deux images — deux corps, ou deux calques d'une même pièce
— dit **laquelle des deux partira dans le jeu**, et on en change d'un clic sans quitter la fiche
du personnage. Celle qu'on ne garde pas se jette du même endroit.

> ### Ce n'était pas un défaut : c'était la règle sans son écran
>
> **La règle existe depuis `C2` et décide déjà.** *Le favori d'abord, sinon la plus récente*
> (`corps_retenu`), écrite une seule fois dans tout le dépôt, et lue par trois chemins : le corps
> qu'une planche d'équipement emporte, le calque qui sort à l'export vers le jeu, et le calibrage.
> Rien n'était cassé.
>
> **Ce qui manquait tenait entièrement à l'écran.** La fiche du personnage est le seul endroit du
> produit qui montre des images concurrentes côte à côte — et c'était le seul à n'offrir ni la
> marque qui décide, ni la réponse à *« laquelle gagne ? »*. Le geste existait ailleurs, dans la
> galerie, ce qui suppose de savoir que la règle existe et d'aller retrouver la bonne image dans un
> autre écran.
>
> **Et deux vrais défauts se cachaient dedans**, trouvés en vérifiant. Les mesures posées à droite
> d'une rangée décrivaient la **première image de la case** et non la retenue : les deux coïncident
> tant que personne ne marque de favori — la liste arrive la plus fraîche en tête —, et dès qu'un
> favori plus ancien est posé, la rangée décrit un calque quand l'export en sort un autre. Et
> **marquer un favori était le seul geste de la bibliothèque à ne prévenir personne** : la galerie
> s'en tirait parce qu'elle se recharge elle-même après l'appel, la fiche du personnage n'a pas ce
> second chemin — elle écrit et elle reçoit —, et c'est justement l'écran dont le favori décide de
> ce qui part.

**Ce que la matrice dit en plus.** Le serveur y ajoute, pièce par pièce, **le calque qu'il
sortirait**, calculé par la fonction même qui décide à l'export. Jamais recomposé dans la page :
deux règles à deux endroits finiraient par désigner deux images différentes, et l'écran montrerait
alors autre chose que ce qui part.

**Ce qui se voit, et quand.** Le retenu porte un liseré — **et seulement quand la case a le
choix**. Une marque répond à une question, et une case à une seule image n'en pose pas ; un liseré
sur chaque vignette du produit aurait fait un ornement au lieu d'une réponse.

**Le geste est celui qui existe, pas un neuf.** Le coin plein en cyan veut dire *favori* sur toutes
les tuiles de la galerie et du codex ; il se pose maintenant d'un clic sur les vignettes de la
matrice, calques comme corps. La carte d'un vêtement reprend, elle, les deux mots de la fiche de la
galerie — *◤ favori* et *Supprimer cette image* — sous la phrase qui dit lequel part. **Rien
d'inventé** : c'est *« juger, c'est marquer favori ou supprimer »*, appliqué là où l'on juge.

**Deux déplacements, chacun pour éviter un piège.** La croix qui vide une case est descendue en bas
de la vignette : elle occupait l'angle du coin de favori, et c'est le coin qui ne peut pas déménager
sans cesser d'être la même marque partout. Et le bouton de la carte dit *Supprimer cette image* et
non *Supprimer* : la colonne de gauche du même écran porte déjà un *Supprimer*, celui de la chose
entière.

**Supprimer passe par le chemin de la galerie** : un second chemin de suppression aurait été un
second endroit d'où l'on jette sans pouvoir défaire. **Le geste qui rend a dû suivre, et c'est le
navigateur qui l'a dit** — le bandeau *annuler* vit dans la barre d'outils de la galerie, que cet
écran-ci ne montre pas. Le compte rendu part donc dans la fente du châssis, *l'image est à la
corbeille — la rendre*, avec le geste dedans.

**Aucun appel, aucun centime** — tout se lit d'images déjà payées, et la tranche entière se vérifie
réseau coupé.

**Critères d'acceptation**

- [x] La matrice désigne, pièce par pièce, le calque qui partirait — par la **même fonction** que
      l'export, et un essai confronte les deux
- [x] Sans favori, c'est la plus récente ; un favori posé sur une plus ancienne renverse la
      désignation, et l'export suit
- [x] Le retenu porte sa marque **quand la case a le choix**, et rien quand elle n'a qu'une image
- [x] Un clic sur le coin marque le favori, et c'est le seul appel qui part
- [x] Les mesures de la rangée sont celles du **retenu**, et non de la première image de la case
- [x] Le favori **s'annonce**, comme le rangement et la suppression : la fiche se remet d'accord
      sans se recharger
- [x] La carte d'un calque dit lequel part avant d'offrir le moindre bouton
- [x] Jeter le retenu laisse l'autre, qui devient le retenu — sans cascade sur les poses voisines
- [x] **On peut défaire depuis l'endroit où l'on a jeté** : le compte rendu porte le geste qui rend
- [x] Le geste vaut pour les corps comme pour les calques : *« et en vrai c'est pareil pour les
      poses de base »*
- [x] Aucun appel au fournisseur, aucun centime : la tranche entière se vérifie réseau coupé

**Bloquée par** — aucune. *Elle ne touche ni l'écran de confirmation (`M3`, `M4`, `M5`) ni la
superposition (`M1`, `M2`) : elle vit dans la matrice de la fiche, où aucune des cinq n'entre.*

---

### M7 · Le détourage de départ redevient complet, et se règle depuis l'image

*Aucune US neuve — elle tient `US-407` à `US-412`, écrites pour `D1`*

**Ce qu'on livre.** Deux choses. L'étape *Le détourage de départ* montre **les quatre réglages**
qu'elle commande, au lieu de deux. Et la table de détourage d'une image gagne un lien
**« enregistrer ce réglage comme défaut du projet »**, qui met le geste dans le bon sens.

> ### ⚠️ Le chiffre qui a servi à cacher deux réglages ne se reproduit pas
>
> Deux des quatre réglages — **la tolérance** et **le seuil de transparence** — ont été écartés de
> l'écran par `D1`, délibérément, sur une mesure : *« tu les as laissés à leur valeur livrée 96 fois
> sur 100 »*.
>
> **Recompté le 4 septembre 2026 sur les 147 passes de détourage du dépôt** :
>
> | Le réglage | Laissé tel quel | **Changé à la main** | Offert par l'écran ? |
> |---|---|---|---|
> | la tolérance | 91 % | 13 fois — **9 %** | non |
> | **le seuil de transparence** | 77 % | **34 fois — 23 %** | **non** |
> | le bord rongé | 51 % | 72 fois — **49 %** | oui |
> | le modèle de silhouette | — | 16 fois — **11 %** | non |
>
> **Le seuil de transparence a été déplacé une fois sur quatre**, dans cinq des six projets, et
> **vingt-deux de ces trente-quatre fois avec le moteur *modèle***. Le chiffre de 96 % portait
> peut-être sur un autre sous-ensemble ; sur le corpus entier, il ne se retrouve pas.
>
> **La sélection de l'écran est juste pour un des quatre.** Le réglage le plus déplacé de tous — le
> bord rongé, une fois sur deux — est bien celui qu'il offre ; les trois autres sont écartés à tort,
> et le plus employé des trois l'est sur un chiffre faux.

**Le mauvais moment se répare par l'autre bout, et pas en déplaçant l'étape.** L'auteur écrivait que
l'étape arrive trop tôt — onzième sur douze, donc **avant d'avoir fabriqué la moindre image**, alors
qu'on ne sait quel détourage convient qu'après. **La réponse n'est pas de la déplacer** : c'est de
laisser régler une image, puis de dire *« garde ça »* depuis l'image elle-même. L'étape des réglages
devient alors la **relecture** de ce qu'on a promu.

> **Et son repli au démarrage est déjà écrit ailleurs, dans `G8`.** *« Les douze étapes sont
> réparties en deux groupes, le second replié derrière une ligne qui dit pourquoi il peut
> attendre »* — et le détourage est nommément dans le groupe replié ; *« aucune étape ne disparaît :
> la page des réglages reste entière »*. **Cette tranche-ci ne touche donc pas au repli**, et les
> deux ne se gênent pas : `G8` décide *quand on la voit*, celle-ci décide *ce qu'elle contient*.
>
> ⚠️ **À savoir en construisant** : le parcours de démarrage et la page des réglages de l'univers
> **sont le même écran** — l'assistant *est* le côté *réglages* de l'onglet Univers. Il n'existe
> aucun drapeau disant si un jeu a déjà été réglé une fois. *C'est `G8` qui aura à le poser, pas
> celle-ci.*

**Ce que la tranche ne fait pas.** Elle **ne remet pas le choix du modèle de silhouette**. *Tranché
par l'auteur le 4 septembre 2026 : il attend `G13`.* Il est déjà établi que le modèle annoncé comme
lourd **ne détoure rien du tout** — la bibliothèque ne connaît pas ce nom-là et retombe en silence
sur le rapide. Offrir ici un choix dont un des termes ne fait rien serait pire que de ne pas
l'offrir.

**Aucun appel, aucun centime.**

**Critères d'acceptation**

- [ ] L'étape montre **quatre réglages par ligne** : le moteur, la tolérance, le seuil de
      transparence, le bord rongé
- [ ] **Le modèle de silhouette n'y est pas**, et la raison est écrite dans la tranche : il attend
      `G13`
- [ ] Une ligne sans moteur **dit ce qu'elle cache** — *choisis un moteur pour régler le reste* — au
      lieu de n'afficher que « — » : c'est ce qui a fait lire le bord rongé comme absent
- [ ] La décision de `D1` qui avait écarté deux réglages est **réécrite avec le bon chiffre**, et
      dit lequel des deux reste discutable
- [ ] La table de détourage d'une image porte un lien **enregistrer ce réglage comme défaut du
      projet**
- [ ] Le lien dit **pour quoi** le défaut vaudra — la nature de l'image, ou sa famille — et laisse
      choisir
- [ ] Il dit aussi ce qu'il ne fait pas : **aucune image déjà faite n'est retouchée**, la règle de
      `D1` ne bouge pas
- [ ] Aucun appel au fournisseur, aucun centime

**Bloquée par** — aucune. *`G8` replie l'étape de son côté et ne la vide pas ; les deux tranches
peuvent se faire dans n'importe quel ordre.*

---

## V2.5 — Le design reprend la main

*Ouverte le 4 septembre 2026, sur demande de l'auteur, en instruisant sa remarque du 3 septembre :
**« cette interface hyper chargée qui assomme d'infos techniques »**. Elle était écartée du
périmètre de la V3.1 le jour même — *« après la V3, voire plus tard »* ; l'auteur l'avance, et lui
donne sa version à elle. Le dossier est `docs/remarques/masquer-l-avance-et-la-passe-de-design.md`.*

**Ce qu'elle vise, en clair.** L'atelier est dense, et **c'est une thèse, pas un accident** :
`docs/DESIGN.md` écrit *« la densité est celle d'un instrument, pas d'une page »*, et le principe
dont tout découle est que *chaque décision retire une concurrence à la grille*. Un auteur qui trouve
son outil assommant a raison sur le ressenti, quelle que soit la thèse. **Cette version décide, par
écrit, ce qu'on garde de la thèse et ce qu'on rouvre.**

### ⚠️ Pourquoi elle commence par un relevé et non par un dessin

**Une passe de design a déjà eu lieu, et personne ne sait où elle en est.**
`docs/audit-design-post-v21.html`, daté du 31 août 2026, relève **quatorze défauts** classés par ce
qu'ils coûtent à l'usage. Il est cité par `docs/DESIGN.md` et par `docs/PIEGES.md`. **Il n'est cité
nulle part dans ce plan** — zéro occurrence avant aujourd'hui. Ses quatorze défauts ne sont jamais
devenus une liste de travaux.

**Et une bonne partie a été réparée sans que personne ne le note.** Sondage du 4 septembre 2026, sur
trois défauts pris au hasard plus celui que le plan connaît :

| Le défaut de l'audit | Aujourd'hui |
|---|---|
| *Échap ne ferme pas ce qu'on ouvre* | **fait** — quatorze écrans écoutent la touche |
| *la galerie télécharge 26 Mo pour 49 vignettes* | **fait** — vignettes calibrées, employées dans quatre écrans |
| *la description s'écrit par un hublot de quatre lignes* | **fait** — le champ va de 3 à 16 lignes |
| *le zoom absent des tables* | **pas fait** — c'est `G10`, écrite au plan |

**Redessiner avant de relever, ce serait refaire un travail déjà payé.**

### Les trois demandes de l'auteur, et elles n'ont pas le même statut

| La demande | Ce que le dépôt en dit aujourd'hui |
|---|---|
| **masquer l'avancé** | **compatible, et sa forme est déjà tranchée** — *un bloc replié porte son réglage à droite de son titre*, écrit le 27 août 2026, *« sans elle, le repli cacherait au lieu de résumer »*. Ce n'est pas la demande qui est refusée, c'est le repli muet |
| **ajouter des icônes, des retours visuels** | **refusé par écrit** — *« aucune icône illustrative »*, trois glyphes dans tout le produit, et *« l'absence de mouvement retire la concurrence d'attention »*. **Le refus a déjà été payé** : les premières maquettes dessinaient une roue dentée et un point d'interrogation, *« les deux ont été retirés, et remplacés par des mots »* |
| **teinter l'interface à la palette du jeu** | **contredit le principe fondateur** — *« le froid retire la concurrence chromatique »* — et **le cas exact a déjà été jugé** : la maquette du 26 août 2026, châssis ambre sur charbon, écartée avec sa raison — *« entre en concurrence avec le pixel art, qui sature déjà les ors et les bruns »* |

**Rien de tout cela n'est un refus définitif.** Le dépôt rouvre ses décisions ; il les rouvre **par
écrit, avec leur nouvelle raison**, et jamais en les contournant. C'est ce que cette version aura à
faire — ou à ne pas faire, en le disant.

### Ce que cette version ne fait pas encore

**Elle n'a qu'une tranche écrite.** `N2` et au-delà — replier l'avancé, rouvrir la direction,
trancher la teinte — **ne s'écrivent qu'une fois `N1` rendu** : on ne sait pas encore si la charge
dont l'auteur se plaint est faite de défauts déjà relevés ou d'une direction à rouvrir, et c'est
exactement ce que `N1` répond.

### ⚠️ Ce qu'elle tient pour acquis sans l'avoir mesuré

**Que ce qui est *avancé* pour l'auteur l'est pour tout usage.** Le dépôt n'a **aucune mesure de qui
ouvre quoi** : replier au jugé revient à parier. `N1` ne le mesurera pas non plus. *Si `N2` existe,
elle devra dire comment elle décide, ou l'assumer comme un pari.*

---

### N1 · L'audit de design repris, et ce qu'il en reste

*Aucune US — c'est un relevé, et un relevé n'a pas d'utilisateur qui le demande ; c'est le cas d'`E0`,
`F0` et `A0`*

**Ce qu'on livre.** Un état écrit des quatorze défauts de l'audit du 31 août 2026 : **fait**, **pas
fait**, ou **devenu sans objet**, chacun avec sa preuve dans le code. Et, pour ce qui reste, une
place : une tranche existante qui le porte déjà, ou une ligne dans cette version.

**Ce que ça ne fait pas.** **Aucun écran n'est touché.** C'est une lecture, pas une correction.

**Pourquoi ça compte plus qu'il n'y paraît.** Trois défauts sur quatre sondés étaient déjà réparés
sans que rien ne l'écrive. Si la proportion tient, la « grosse passe de design » que l'auteur
réclame est **en grande partie déjà faite**, et ce qui reste est une poignée de points — pas un
chantier. *Si elle ne tient pas, on saura enfin de quoi on parle.*

**Aucun appel, aucun centime** : c'est une relecture du dépôt.

**Critères d'acceptation**

- [ ] Les quatorze défauts de l'audit portent chacun un état : **fait**, **pas fait**, **sans objet**
- [ ] Chaque « fait » cite le fichier et la ligne qui le prouvent — pas une impression
- [ ] Chaque « pas fait » nomme la tranche qui le porte, ou dit qu'aucune ne le porte
- [ ] Les surfaces que l'audit déclare **non examinées** sont listées telles quelles — l'assistant de
      démarrage, la planche de pose, les états d'erreur et d'attente — sans être jugées
- [ ] L'audit lui-même gagne, en tête, la ligne qui dit où il en est et à quelle date
- [ ] `docs/PLAN.md` le cite : il ne doit plus être un document que le plan ignore
- [ ] **Aucun fichier de l'interface n'est modifié par cette tranche**

**Bloquée par** — aucune. *Elle ne dépend de rien et bloque tout le reste de la version.*

---

## V3 — L'animation

*Cadrée le 2 septembre 2026 après trois bancs de planches — **141 planches, 6,03 $** —, refondue
le même jour par six essais neufs — **48 appels de planche et 18 clips, 2,29 $** —, puis
**recadrée le 3 septembre 2026 sur demande de l'auteur**. Le recadrage ne change pas le chemin,
il change le périmètre : **la version ne fait plus qu'une chose, animer.** Tout ce qui suit
s'appuie sur `docs/bilan-v3.md` pour les planches, sur `essais/verdict-essais.json` pour la
refonte, et sur `docs/recherche-video-locale/` pour le moteur de la maison.*

**Ce que la V3 fait, en une phrase.** On part d'une image du personnage, on demande une petite
vidéo — sur la carte graphique de la maison, ou chez un fournisseur quand on n'a pas la patience
—, et on découpe les animations dedans, **image par image**. Un même clip donne plusieurs
animations. Une fois la version tenue, **toutes les cases du plan de poses d'un personnage
peuvent être animées**, et n'importe quelle image d'un clip peut servir ailleurs.

**Ce que la V3 ne fait plus, et où ça part.** La planche et son dépliage traînaient dans cette
version depuis le premier découpage. Ils n'ont jamais servi l'animation : ils servent le **prix
de toutes les autres générations**, et ils méritent leur propre version. *Tranché par l'auteur le
3 septembre 2026.*

| La tranche qui sort | Pourquoi elle était là | Où elle va |
|---|---|---|
| **A1** — la planche se garde, son dépliage se refait | Un argument d'avant la vidéo : *« il faut voir les planches avant de choisir »* | **V3.5**, sous le nom `P1` — plus bas |
| **A3** — commander plusieurs et garder le bon | Commander est `A9`, choisir dans un tirage est `A10` ; il ne restait que le lot | **fondue dans `A9`** : une file de clips, pas une tranche |
| **A8** — le pantin | Il était le seul moyen d'animer sans payer ; le moteur de la maison l'est aussi, et il ne demande ni squelette ni maillage | **hors plan**, arguments intacts, en fin de document |

**Et trois user stories sont retirées** parce qu'une décision durable les contredit : `US-375`
*(déclarer une bande avec un nombre d'étapes)*, `US-377` et `US-378` *(voir la bande tourner et
régler sa vitesse)* — les trois sont reprises et dépassées par l'écran de montage, qui les rend
en mieux. `US-389` est retirée aussi : elle décrit le défaut que `D4` répare, pas celui d'`A5`.

**Les quatre faits qui commandent le découpage.** Le quatrième recouvre les trois autres.

1. **Une bonne planche sur dix.** Ce n'est pas un échec, c'est un prix. Mais il **interdit un
   certain produit** : on ne bâtit pas une animation sur *« on commande une planche, on la
   corrige »*.
2. **Réécrire la demande est épuisé comme levier.** Trente-et-un réglages sur trois bancs, puis
   six variantes de plus. **Aucune ne passe la barre**, et le témoin les bat. La question est
   close.
3. **Ce qui est payé est détruit avant d'être vu.** Le recadrage prend chaque image sur sa propre
   boîte, si bien qu'un personnage grandit en tendant le bras. Ce défaut ne dépend pas de la
   méthode, et c'est `A2` qui le répare.
4. **Un clip rend ce qu'une planche ne rend pas : des images qui se suivent.** Un modèle
   image-vers-vidéo reçoit le sprite et rend une centaine d'images d'un mouvement continu. On y
   prélève ce qu'on veut, on le passe dans la chaîne du produit, et **le même clip peut donner
   plusieurs animations**.

### Ce que le relevé `A0` a tranché, et ce qu'il n'a pas tranché

`A0` devait dire lequel de quatre chemins la V3 construit. Il en a tué trois, et **le gagnant
n'était dans aucun des quatre** — il est né d'une question posée en cours de route : *et si on
demandait une vidéo plutôt qu'une planche ?*

| Le chemin | Ce qu'il a donné | Son sort |
|---|---|---|
| **Mieux demander** — nommer les images, ranger le texte, le faire réécrire par une IA | témoin 2 bonnes sur 4 ; les cinq variantes 0 bonne | **mort, mesuré** — le texte du produit ne bouge pas |
| **Agrandir la référence** — le sprite en 256 ou 512 px au lieu de 64 | 64 px n'est pas battu ; 512 px fait pire | **mort, mesuré** |
| **Préparer la pose d'abord** — une image de profil, puis la planche depuis elle | 4 planches mauvaises sur 4 contre 1 bonne au témoin | **mort, mesuré** |
| **Imposer la géométrie par une image de posture** | la pose est suivie au pixel, mais le modèle **emprunte la carrure du guide** ; trois correctifs, trois échecs identiques | **mort, mesuré** — et le plus instructif : ce qu'on montre, le modèle le copie en entier |
| **La vidéo puis le découpage** | six clips, marches lisibles, personnage stable, fond détourable ; puis quatre clips qui portent **deux animations chacun** | **retenu** |

**Le seul gain du côté planche, et il ne se perd pas.** Une grille de **quatre colonnes sur deux
rangées** bat le 3×3 à case vide — 2 bonnes sur 2 contre 1 sur 2. Ce résultat ne sert plus
l'animation ; il est **consigné dans `R6`**, avec sa précaution : la géométrie est aujourd'hui
*déduite* du nombre de cases et jamais enregistrée, si bien que changer la formule redécouperait
toutes les planches anciennes sur une grille sur laquelle elles n'ont pas été dessinées. **La
géométrie devra s'écrire sur le pliage le jour où la formule change**, et c'est `P1` qui en
hérite.

### ⚠️ Ce que la version tient pour acquis sans l'avoir mesuré

Écrit ici parce qu'un plan qui s'ouvre sur un chemin neuf doit dire ce qu'il ignore. **Aucun de
ces points n'empêche d'ouvrir la version** ; chacun est une dette, et chacun a sa tranche.

- **Un personnage, un projet, un angle.** Tous les clips partent du même voyageur encapuchonné,
  bipède, de profil, cerné d'un contour noir, sur une cible de 64 px. C'est le cas le plus facile
  qui existe. **Rien ne dit ce que rendent un quadrupède, un flottant sans jambes, un personnage
  clair ou une créature.**
- **Aucune bande pixelisée n'a été notée.** Les notes portent sur le clip brut. Or c'est la bande
  passée par la chaîne du produit qui entre en bibliothèque.
- **Le prix par bande utilisable n'est pas établi.** Ce qui est mesuré, c'est le prix d'un clip.
  Combien de clips pour une bonne bande, personne ne le sait encore. **La vidéo ne se justifie
  donc pas par son prix mais par ce qu'elle fait et qu'une planche ne fait pas** : plusieurs
  animations pour un seul paiement, et un tri qui se fait *dans* le tirage. Le chiffre se prend
  en `A10`, sur l'écran qui l'affiche.
- **L'image envoyée n'était pas un sprite de la bibliothèque** mais une image préparée à 1024 px.
  Ce que rend un sprite de 64 px agrandi n'est pas mesuré, et c'est `A9` qui le verra en premier.
- **Une seule direction a été essayée.** Les clips partent tous du profil. Ce que rend une
  demande d'animation sur une pose vue de face ou de dos n'est pas mesuré, et c'est `A12` qui
  s'en apercevra en couvrant la matrice.
- ~~**Le montant réellement facturé n'a jamais été relu.**~~ **Levé le 2 septembre 2026** : il se
  lit dans la réponse du travail, sous `usage.cost`. Treize clips relus : le facturé dépasse
  l'estimation de **20 %** au total, mais le modèle rapide coûte **0,056 à 0,067 $ et non 0,134 $** —
  l'estimation par jetons vidéo est une borne haute, jamais un montant.

### Les décisions durables de cette version

Elles ne se renégocient plus une fois posées, et chaque tranche en est comptable. Les quatre
dernières ont été tranchées par l'auteur le 3 septembre 2026.

| La décision | Ce qu'elle renverse ou instaure | Posée en |
|---|---|---|
| **Une animation s'obtient en animant puis en découpant**, pas en demandant une planche | **Renverse** le cadrage du 2 septembre matin | A9 |
| **Un clip est un objet du produit** — il se voit, se garde, se découpe autant de fois qu'on veut, et **un clip peut porter plusieurs animations** | Instaure. C'est la découverte qui commande l'éditeur : un paiement, plusieurs bandes | A9, A10 |
| **L'image de départ d'un clip n'est pas une référence : c'est l'entrée de l'appel** | Instaure une distinction que le produit n'a pas. Ses trois rôles d'image jointe sont facultatifs et cèdent devant le plafond du modèle ; celle-ci est obligatoire et ne cède jamais | A9 |
| **Une bande est une liste d'images choisies**, pas un début et une période — la fenêtre qu'on tire ne fait que *proposer* cette liste | Instaure. Un cycle de marche n'est pas régulier : le contact demande deux images serrées, la glisse une seule | A10 |
| **Une bande est un tout** — ses images se recadrent sur une **fenêtre commune**, jamais chacune sur la sienne | Instaure. **Seule décision déjà vérifiée au banc** sur des images extraites de clip | A2 |
| **La fenêtre commune se prend sur le clip entier**, jamais sur la bande seule | **Renverse** le montage des essais. Une fenêtre par bande cale les images d'une bande ; il faut une fenêtre par clip pour caler les bandes entre elles — 10 % d'écart de taille mesuré | A2, A10 |
| **La recette du jeu est le point de départ, jamais une prison** — et une bande qui s'en écarte le dit | **Amende** *une bande n'invente pas une autre grille que son jeu*. Le fond est gardé : ce qui compte n'est pas l'interdiction, c'est que l'écart se voie | A10 |
| **Un mouvement appartient à l'atelier, pas à un projet** | Une bibliothèque de mouvements se paie une fois et sert tous les jeux suivants | A6 |
| **Un mouvement n'est pas une seconde liste à côté des poses : c'est ce que la même pose sait dire quand on l'anime** | Instaure, et **évite deux listes qui divergeraient**. Le projet dit *quelles* cases il veut ; l'atelier sait *comment* chacune se dit, figée et animée | A6 |
| **L'image de départ se propose, et se change** — la case visée si elle porte déjà une image, le portrait du personnage sinon | Instaure. *Tranché le 3 septembre 2026.* Ni l'un ni l'autre imposé : le défaut suit ce qui est mesuré, la main décide | A9, A12 |
| **La matrice d'un personnage se lit sur deux calques** — les images fixes, et les animations —, chacun avec sa jauge | Instaure. *Tranché le 3 septembre 2026.* Une case fixe remplie ne doit pas masquer une animation manquante : c'est très exactement ce qu'on veut voir | A12 |
| **Une image attrapée dans un clip entre en bibliothèque, et se range ensuite** | Instaure, et **reprend l'enchaînement du produit** : générer puis affecter. Le geste court d'abord, le rangement en second et facultatif | A13 |
| **Ce qui sort, ce sont les images** — planche de sprites, descriptif, image animée, dans des formats existants | Instaure. *Le pantin sortant du plan, la sortie du squelette part avec lui* | A4 |
| **Un coût de zéro n'est pas un coût inconnu** | Instaure, et **corrige une règle qui se retournerait contre le produit** : le prix inconnu grise un modèle, à raison. Un moteur de la maison n'a aucun tarif chez personne et coûte pourtant zéro, ce qui est un fait, pas une ignorance | A11 |
| **Ce qui coûte s'annonce toujours avant de partir — en argent ou en temps** | **Étend** l'invariant du produit au lieu de l'affaiblir. Un moteur gratuit se paie en minutes, et une attente non annoncée est une mauvaise surprise comme une autre | A11 |
| **Le produit ne modifie jamais l'installation de ComfyUI** — ni paquet, ni réglage, ni nœud | Instaure une limite née d'un fait : au banc du 3 septembre, mettre à jour une bibliothèque pour la vidéo aurait pu casser le générateur de bruitages. **Le produit s'adapte à ce qu'il trouve** | A11 |

**Ce que la V3 n'est pas.** Ni un moteur de jeu, ni un éditeur de squelette, ni un montage vidéo,
**ni un second ComfyUI**, **et plus du tout un découpeur de planches**. Elle commande des clips —
chez un fournisseur ou sur la carte de la maison —, en découpe des bandes, en prélève des images,
et les fait sortir dans des formats que d'autres lisent déjà.

### Les chemins écartés, et pourquoi ils ne reviendront pas

Écrits ici parce qu'un chemin abandonné qu'on ne consigne pas se repropose. Les quatre premiers
sont ceux du tableau de `A0`, tués le 2 septembre 2026. S'y ajoutent :

- **Le brouillon sur un fournisseur gratuit** — impossible ici : le modèle gratuit n'accepte
  aucune image en entrée, donc pas le personnage.
- **La correction du bord par calcul de transparence** — écartée : le défaut vaut un pixel sur
  mille sur les vraies images.
- **Le report d'un mouvement filmé** — non mesuré, suspendu à un compte que ce dépôt n'a pas.
- **Chercher un fournisseur vidéo de plus** — inutile : les vingt-huit modèles vidéo passent par
  le compte déjà en place. Ils se demandent explicitement —
  `GET /api/v1/models?output_modalities=video` —, et c'est de ne pas l'avoir su qui a fait croire
  une demi-journée qu'aucun n'existait.
- **Un second écran pour le moteur local** — écarté avant d'être écrit : le moteur de la maison
  entre dans la même liste que les payants, avec le même geste. *Décision d'`A11`.*

---

### A0 · Le relevé qui a décidé du chemin — **clos le 2 septembre 2026**
*relevé, pas une tranche de code — aucune ligne dans `atelier/`*

> **La règle de méthode qu'il a produite tient, et elle vaut au-delà de lui.** Quand on
> **explore** — « est-ce que ça marche seulement ? » —, on avance **une tentative à la fois**, en
> écrivant d'avance ce qui peut casser. Quand on **arbitre** — « laquelle de ces deux branches
> est la meilleure ? » —, il faut assez de tirages pour que le bruit ne décide pas, et c'est **la
> règle des huit**.

**Ce qu'il a livré.** Le tableau des cinq chemins, plus haut. **Trois chemins morts par la
mesure, un quatrième mort après trois correctifs, un cinquième retenu.** Le détail tirage par
tirage vit dans `essais/verdict-essais.json` et dans les six rapports notés par l'auteur.

**Ce qu'il a coûté** — 2,29 $ en tout :

| Ce qui a été tiré | Appels | Dépense |
|---|---|---|
| Les références nommées, deux séances | 16 planches | 0,41 $ |
| La taille de la référence | 4 planches | 0,13 $ |
| La grille complète 4×2 | 4 planches | 0,11 $ |
| La mise en pose | 8 planches | 0,16 $ |
| La pose imposée par image, trois tours et une bande | 14 appels | 0,24 $ |
| La vidéo, quatre bancs | 18 clips | 1,25 $ |

**Ce qu'il n'a pas livré, et qui part avec le pantin.** Deux questions gratuites du relevé
d'origine — *un membre plié survit-il à la réduction en pixels ?* et *à quelle amplitude un
pantin casse-t-il ?* — ne servaient que `A8`. **Elles sortent du plan avec lui.**

**Ce qui a été appris sur la façon de chercher**, et qui vaut d'être gardé :

- **Un témoin doit partir avec les mêmes images que ce qu'il juge.** La première séance a comparé
  des variantes à un témoin tiré la veille avec un artwork retiré depuis : elle ne mesurait rien.
- **Une note se dépose dans le rapport, jamais dans une tête.** Les douze clips des bancs de poses
  ne sont notés nulle part ; ils portent pourtant la découverte centrale de la version.
- **Ce qu'on montre à un modèle, il le copie en entier.** Un guide de posture impose sa pose *et*
  sa carrure. Trois formulations différentes n'y ont rien changé.

---

### A6 · Le mouvement, dit une fois pour toutes
*4 US (392–395)* · **avant tout le reste : on ne commande pas un clip sans nommer ce qu'on demande**

**Ce qu'on livre.** Un mouvement — repos, marche, course, saut, attaque — cesse d'être une phrase
retapée à chaque personnage et à chaque case. Il porte son texte, sa cadence et les directions où
il a un sens ; une commande de clip s'y réfère au lieu de le redécrire.

**Ce n'est pas une seconde liste à côté des poses, et c'est ce qui rend la tranche petite.** Le
produit sait déjà dire une pose : la case « marche » du plan sait qu'elle s'écrit *walking
posture, full body*. Ce qui manque n'est pas une liste, c'est **ce que la même pose dit quand on
l'anime** — un cycle qui boucle au lieu d'une posture figée —, plus une cadence et les directions
où le mouvement existe. **Deux listes concurrentes finiraient par diverger**, et l'auteur
découvrirait l'écart sur une case.

**Et les deux rangements ne se contredisent pas.** Le plan de poses appartient au projet, c'est
un invariant de `C1`. La recette d'un mouvement appartient à l'atelier, c'est la décision durable
ci-dessus. Les deux tiennent ensemble exactement comme aujourd'hui : **le projet dit *quelles*
cases il veut, l'atelier sait *comment* chacune se dit.** Une pose fabriquée par l'auteur qui ne
correspond à aucun mouvement connu se commande quand même, avec le texte qu'il écrit.

**Ce que ça change au prix.** Deux tirages de la même intention partent aujourd'hui avec deux
textes différents, et l'écart entre eux est alors imputé au modèle. Un mouvement nommé rend un
clip **redemandable à l'identique** : ce qui varie d'un tirage à l'autre redevient le tirage, et
non la frappe. Sur une matrice de vingt-quatre cases, c'est vingt-quatre frappes en moins.

**Critères d'acceptation**

- [ ] L'atelier arrive avec une liste de mouvements livrés, et la distinction livré / fabriqué est celle qu'il emploie déjà partout
- [ ] Un mouvement porte son texte, sa cadence et les directions où il a un sens
- [ ] Un mouvement fabriqué se crée, se renomme et se masque ; un livré se masque sans se supprimer
- [ ] **Une pose du plan dont l'identifiant correspond à un mouvement connu hérite de son texte animé**, sans rien relier à la main
- [ ] Une pose sans mouvement connu se commande quand même, avec le texte que l'auteur écrit
- [ ] Deux clips du même mouvement partent avec **exactement le même texte**
- [ ] Un mouvement survit au changement de projet
- [ ] Rien ici ne part vers le fournisseur, rien ne coûte, et tout fonctionne réseau coupé

**Bloquée par** — aucune.

---

### A2 · Le cadre qui ne dérive pas
*2 US (376, 379)* · **une correction de cinq lignes, pas une fonctionnalité**

**Ce qu'on livre.** Les images d'une bande cessent de se recadrer chacune sur sa propre boîte.
Elles se recadrent sur **une seule fenêtre**, prise sur **le clip entier**, et le personnage
cesse de grandir en tendant le bras.

**Pourquoi c'est avant le montage et pas dedans.** L'écran de montage montre en direct la bande
passée par la chaîne du produit ; si le cadrage dérive, **ce que l'auteur juge à droite est faux**,
et il jugera le cadrage au lieu du mouvement. La correction doit donc être faite avant que
quiconque regarde cet aperçu.

> ⚠️ **La ligne fautive est trouvée, et son commentaire dit l'inverse de ce qu'elle fait.** Quand
> le sujet a une silhouette, **l'échelle est calculée sur la boîte de l'image courante**, et le
> centrage aussi. **Un bras tendu agrandit la boîte, donc réduit tout le personnage.** Le
> commentaire du code affirme pourtant que c'est justement ce qui fait que deux images d'un même
> personnage se superposent. Le code connaît la dérive *horizontale* — il la décrit et offre un
> décalage à la main — mais **pas la dérive d'échelle**, qui est la fatale. **Le premier travail
> de la tranche n'est pas d'ajouter du code : il est d'en corriger cinq lignes et un
> commentaire.**

**La fenêtre se prend sur le clip entier, et c'est un renversement.** Mesuré le 3 septembre 2026 :
le montage des essais prenait la fenêtre de la bande, ce qui est *l'erreur juste à côté* de la
bonne réponse.

| Le cadre pris sur | Ce que ça donne sur le clip mesuré | Ce que le jeu voit |
|---|---|---|
| **la bande seule** | le repos tient dans 217 × 376, la marche dans 246 × 380 | le personnage sort à **37 px de large au repos et 41 en marchant** : il grandit de 10 % en se mettant à marcher |
| **le clip entier** | 246 × 381 pour les deux | la même assise partout, **et rien ne bouge au changement d'animation** |

*Une fenêtre par bande cale les images **d'une** bande entre elles ; il faut une fenêtre par clip
pour caler **les bandes** entre elles.* Deux autres choix restent — la bande, et la main — parce
qu'une bande où le personnage quitte le champ a besoin des siens ; ils se prennent depuis l'écran
de montage, en `A10`.

**Et un corollaire d'ordre, à ne pas découvrir en route** : l'ancrage vertical pose le **bas de
la boîte englobante** sur le bas de la case. Toute poussière, toute ombre isolée sous les pieds
soulève donc le personnage d'autant. **Le nettoyage des taches doit précéder le calcul de la
boîte** — et c'est plus vrai encore sur un clip, dont les images sont lissées et compressées et
dont le fond n'est uni qu'à une tolérance près.

**L'aperçu montre les pixels du modèle, fond compris.** C'est la manœuvre que le banc a dû
improviser pour pouvoir juger, et elle est devenue une règle : le détourage grignote un pied,
laisse des miettes, et l'on finit par juger le détourage au lieu de la marche. **Juger le
mouvement et juger le découpage sont deux métiers.**

**Critères d'acceptation**

- [ ] Toutes les images d'une bande partagent une fenêtre unique, calculée sur ce qu'elles occupent ensemble
- [ ] **Sur un clip, cette fenêtre se prend sur les images du clip entier**, pas sur les seules images gardées — sinon deux bandes du même clip n'ont plus la même échelle, mesuré à 10 % le 3 septembre 2026
- [ ] Deux images de tailles différentes ne produisent jamais deux sorties de tailles différentes
- [ ] Le nettoyage des taches précède le calcul des boîtes
- [ ] L'aperçu brut est monté sur les images du modèle : aucun détourage entre le clip et l'œil
- [ ] Le commentaire fautif du code est corrigé en même temps que la ligne, faute de quoi la prochaine lecture le croira
- [ ] Vérifié sur le clip que l'auteur décrit comme « il avance de gauche à droite puis repart en arrière en moonwalk »
- [ ] Aucun invariant du traitement ne bouge : non destructif, sans carte graphique, sans appel au fournisseur

**Bloquée par** — aucune. *Elle peut se faire en même temps qu'`A6`.*

---

### A9 · Commander un clip, et l'attendre
*11 US (380–383, 434–440)* · **le serveur est écrit ; l'écran reste**

**Ce qu'on livre.** L'atelier sait commander un clip et le voir arriver. On choisit un
personnage, un mouvement et un modèle vidéo ; **l'image de départ se propose et se change** ; le
clip revient, il entre en bibliothèque avec ce qu'il a coûté, et ses images sont extraites une
fois pour toutes. **On peut en lancer plusieurs à la suite** et les regarder revenir un par un.

**L'image de départ, et comment elle se choisit.** *Tranché par l'auteur le 3 septembre 2026.* Un
clip part toujours d'**une** image. L'écran en propose une et l'auteur peut en changer d'un clic :

| Ce que l'écran propose | Quand |
|---|---|
| **L'image de la case visée** | quand on anime une pose qui porte déjà une image fixe — le résultat suit alors l'attitude et la direction déjà validées |
| **Le portrait du personnage** | sinon — c'est le défaut, et c'est ce que les essais ont mesuré |
| **N'importe quelle image de la bibliothèque** | toujours, d'un clic, parce qu'aucun automatisme ne sait tout |

**Pourquoi c'est un port neuf et pas un modèle de plus.** Trois choses séparent un appel vidéo
d'un appel d'image, et chacune casse quelque chose si on l'ignore.

1. **Il est asynchrone.** On soumet, on reçoit un numéro de travail, on attend, on télécharge. Un
   appel d'image tient dans une requête ; un clip se fait attendre plusieurs minutes et **survit à
   une fermeture de l'atelier**. Le numéro du travail s'écrit sur l'emplacement **dès la
   soumission**, avant la première attente.
2. **Son entrée n'est pas une référence.** Le produit a trois rôles d'image jointe — référence,
   style, édition — tous facultatifs, et tous cèdent devant le plafond du modèle. L'image de
   départ d'un clip est **obligatoire** : sans elle il n'y a pas d'appel. Elle a donc son propre
   rôle, sa propre phrase de refus, et **le plafond ne peut jamais la faire céder**.
3. **Ce qui revient n'est pas une image.** La chaîne actuelle mesure tout fichier reçu avec la
   bibliothèque d'images ; un fichier vidéo y lève « illisible », et le rattrapage enregistre
   alors un échec **à zéro dollar**. Un clip payé disparaîtrait du journal. **Le port vidéo écrit
   la dépense lui-même, avant toute mesure de fichier.**

**La file — ce qui reste de l'ancienne `A3`.** *Le geste survit au changement de chemin, l'objet
change, et il n'a plus besoin d'une tranche.* On choisit combien de clips on lance — **un reste
le défaut, et le produit n'impose jamais un lot** —, le prix du lot s'annonce avant, les clips
reviennent un par un et se regardent arriver sans qu'on attende les autres. En garder un et jeter
les autres est un seul geste, annulable. **Sur le moteur de la maison ce geste devient gratuit**,
et c'est là qu'il prend son sens : `A11` le dit.

**Les modèles proposés, et l'état de ce qu'on sait d'eux.** Trois, choisis par l'auteur, et le
produit dit pour chacun ce qui est mesuré. **Aucun n'atteint la règle des huit** : ce sont des
propositions étayées, pas un arbitrage clos, et l'écran doit le dire.

| Le modèle | Ce à quoi il sert | Coût réel du clip | Attente | Ce qui est mesuré |
|---|---|---|---|---|
| `bytedance/seedance-2.0-mini` | **plusieurs poses dans un clip** — il suit un minutage écrit seconde par seconde | **0,056 à 0,067 $** selon la durée | 118 s en moyenne, **138 s au pire** | 5 clips relus, 2 notés bons sur 2 ; le seul dont un tirage ait été noté bon |
| `bytedance/seedance-1-5-pro` | **une pose simple** | **0,048 $** | 107 s en moyenne, **301 s au pire** | 2 clips relus, aucun noté bon : un moyen dont l'échec est *le personnage se retourne*, l'autre non noté |
| **`maison/wan-2.2-pixel`** — la carte graphique de l'atelier | **une pose simple, en clips courts et en quantité** — il ne facture rien, donc on en tire autant qu'on veut | **0,00 $** | **130 s** pour une seconde | 3 clips, fond plus propre que le payant ; **la bande se dégrade quand le clip s'allonge**. Détail en `A11` |

*Montants **relus chez le fournisseur**, pas estimés — `essais/resultats_video/mesures.json`, le
champ `cout_usd` de chaque clip. **Un montant n'est pas une constante** : le même modèle passe de
0,056 $ à 0,067 $ selon la durée demandée, ce qui est la raison même pour laquelle le prix se
relit et ne s'écrit jamais en dur. Les deux payants se tiennent à un centime près, et c'est la
**régularité de l'attente** qui les sépare — elle va à 2.0 mini. Pour mémoire, les trois modèles
écartés coûtent de 0,20 $ à 0,25 $ le clip, quatre fois plus.*

> **Le troisième arrive avec `A11`**, et il figure ici pour que la liste de l'écran soit complète
> dès qu'on la dessine. Il **change ce que l'écran doit savoir afficher** : une attente au lieu
> d'un prix, un compte d'images au lieu d'une durée ronde, et un coût de zéro qui ne doit pas se
> confondre avec un prix inconnu. Ces trois conséquences sont écrites en `A11`.

**Le prix, et pourquoi il ne peut pas s'écrire en dur.** Un modèle vidéo se facture soit à la
seconde, soit au **jeton vidéo** — hauteur × largeur × images par seconde × durée. Le prix se
relit donc chez le fournisseur au moment de proposer, jamais dans le code, et **la formule
s'affiche à côté du montant** : un prix sans sa formule n'est pas vérifiable.

**L'écran, et il est déjà dessiné.** Les deux premiers moments de `docs/maquettes-v3/01-du-sprite-a-la-bande.html` :
*Commander* — l'image de départ à gauche, le mouvement au milieu, les modèles et leur prix à
droite, le bouton qui porte le montant — et *Attendre* — le clip en cours, ce qu'il a coûté, et
la certitude que rien ne se perd si l'atelier ferme.

**Critères d'acceptation**

- [x] ~~**Verrou d'ouverture**~~ **levé le 2 septembre 2026** : le montant facturé se lit dans `usage.cost` de la réponse du travail, treize clips relus
- [x] Le montant enregistré est **celui de la réponse**, jamais l'estimation — qui n'est qu'une borne haute affichée avant l'envoi, et l'écran distingue les deux
- [x] Les modèles vidéo apparaissent au catalogue avec leur durée, leur résolution et leur prix du jour ; un modèle dont le prix n'a pas pu être relu est **grisé avec sa raison**
- [x] L'image de départ part sous son propre rôle, et **aucun plafond ne la fait céder**
- [x] Le prix annoncé avant l'envoi porte sa formule, et le montant enregistré après dit s'il a été **relu ou estimé**
- [x] Un clip payé garde sa dépense même si son fichier est illisible, si l'extraction échoue, ou si l'atelier se ferme pendant l'attente
- [x] Un clip commandé et pas encore revenu se retrouve au redémarrage, et **le récupérer est un geste que l'auteur demande**
- [x] Les images du clip sont extraites une fois, à l'arrivée, et le clip dit combien il en porte et à quelle cadence
- [x] Un clip hérite son style de son sprite de départ **et de rien d'autre**
- [x] Ce que le décodeur de clips ajoute au dépôt est déclaré et justifié
- [ ] **L'écran de commande existe** : l'image de départ, le mouvement, les modèles avec leur prix, et un bouton qui porte le montant
- [ ] **L'image de départ se propose et se change** : la case visée si elle porte une image, le portrait sinon, n'importe quelle image de la bibliothèque d'un clic
- [ ] **Le mouvement se choisit dans la liste d'`A6`**, et le texte qui part se lit avant l'envoi
- [ ] Le nombre de clips à lancer se choisit à chaque fois — **un est le défaut** —, et le prix du lot s'annonce avant
- [ ] Les clips reviennent **un par un**, chacun visible dès son arrivée : on n'attend pas les autres
- [ ] Garder un clip et jeter les autres est un seul geste, et il est annulable
- [ ] Le journal garde ce qui a été payé, **y compris les clips jetés**
- [ ] Un clip en cours se voit, dit ce qu'il a coûté, et **survit à la fermeture de l'atelier**
- [ ] La galerie montre un clip par une image prélevée dedans, jamais par une tuile en erreur
- [ ] **Un modèle proposé sans avoir été assez mesuré le dit**, à l'endroit où on le choisit
- [ ] Rien n'est jamais relancé automatiquement — l'invariant de `T1` tient jusqu'ici

**Où en est la tranche, au 3 septembre 2026.** **Le côté serveur est écrit et éprouvé : trente-six
essais, aucun appel payant.**

| Ce qui est écrit | Où | Ce que ça tient |
|---|---|---|
| La demande de clip, le modèle vidéo, le tarif et sa formule | `atelier/domaine/animation.py` | l'entrée obligatoire, le refus en français, le prix vérifiable |
| Le second port et ce qu'il rend | `atelier/fournisseur/port.py` | soumettre et récupérer sont **deux gestes**, jamais un seul |
| L'adaptateur vidéo d'OpenRouter | `atelier/fournisseur/openrouter_video.py` | les trois pièges payés une fois : la liste filtrée, l'adresse qui veut la clé, le montant qui n'est pas où on le cherche |
| Le décodeur de clips, optionnel | `atelier/image/clip.py` | un clip payé n'est jamais perdu faute d'une bibliothèque |
| Commander, attendre, encaisser, reprendre | `atelier/services/animation.py` | l'ordre : le numéro du travail, puis la dépense, puis le fichier, puis les images |
| Les routes du clip | `atelier/api/animation.py` | ce que l'écran lira |
| Les essais | `tests/test_a9.py` | 36 essais, dont l'ordre d'écriture et la reprise sans repaiement |

**Ce qu'il reste** : l'écran, la file, et le choix de l'image de départ. **Le serveur ne connaît
aujourd'hui ni personnage, ni pose, ni mouvement** — la demande porte un texte libre. C'est ce
lien-là qui s'ajoute ici.

**Bloquée par** — `A6`, pour le mouvement que l'écran fait choisir. **Elle bloque tout le reste de
la version.**

---

### A10 · Le montage — plusieurs animations dans un clip
*13 US (441–453)* · **le cœur de la version**

**Ce qu'on livre.** L'écran qui transforme un clip payé en bandes utilisables. Le clip s'ouvre en
tournant déjà en boucle ; l'auteur prend ou laisse les images une par une, nomme ce qu'il garde,
et **recommence dans le même clip** pour l'animation suivante.

**Pourquoi c'est le geste central.** Un clip de cinq secondes porte plus qu'un cycle de marche.
Le banc du 2 septembre l'a montré deux fois : un texte minuté seconde par seconde, avec ses
transitions nommées et un retour à la même pose neutre entre deux actions, rend un clip où
**repos et marche se découpent séparément**. **Le tri se fait donc dans le tirage, et non entre
les tirages** — c'est la différence de nature avec la planche.

**L'écran existe déjà en maquette, et elle est vivante** :
`docs/maquettes-v3/01-du-sprite-a-la-bande.html`, troisième moment. La bande de droite y est
calculée pour de vrai par la chaîne de l'atelier, et changer un réglage la refait sous les yeux.
**C'est elle qui fait foi sur la disposition** ; ce qui suit dit pourquoi chaque zone existe.

- **Deux boucles côte à côte, sur un seul métronome.** À gauche les images du clip telles que le
  modèle les a rendues, fond compris : elle répond à *le mouvement est-il bon ?* À droite les
  mêmes images passées par la chaîne du jeu — détourage, fenêtre commune, grille du projet,
  palette du projet : elle répond à *la bande est-elle bonne ?* **Juger un mouvement et juger un
  découpage sont deux métiers**, et une seule image obligerait à en trancher un au jugé. Un seul
  métronome, même vitesse et même phase de départ : au banc, chaque animation partait quand elle
  avait fini de charger, donc jamais en phase avec sa voisine.
- **La pellicule, et chaque image qui s'y prend ou s'y laisse.** Toutes les images du clip, une
  cellule chacune, en tranches prises au centre : le repos y est uni, la marche y bat, et on lit
  le mouvement avant de le regarder. **Un clic prend ou laisse une image**, et une loupe suit le
  curseur parce qu'à sept pixels de large on ne sait pas ce qu'on clique. La fenêtre est toujours
  là, mais elle a changé de statut : elle **enjambe ce qui est retenu** et ses poignées rejettent
  des images régulièrement espacées. C'est le chemin rapide, et il n'empêche plus le chemin fin.
  Sous la pellicule, **les images retenues dans l'ordre**, chacune retirable d'un clic.
- **Ce que la machine mesure gratuitement, et qui ne décide de rien.** Deux propositions calculées
  à l'ouverture : où le clip **se referme** le mieux — la longueur de cycle dont la dernière image
  enchaîne sur la première —, et où **presque rien ne bouge** — les moments de repos. **La
  détection propose, l'auteur juge** : c'est la règle déjà écrite de l'écran de découpe, et c'est
  elle qui fait qu'une machine qui s'est trompée ne bloque personne.
- **Les bandes déjà gardées de ce clip**, dessinées à leur place sur la pellicule, chacune avec
  son nom et la case qu'elle remplit.
- **Le cadre, montré et repris à la main.** Une vignette du personnage avec le rectangle de la
  fenêtre commune dessiné dessus, et trois choix : **du clip** — le défaut, posé par `A2` —, de la
  bande, ou à la main. Un cadrage automatique se trompe parfois, et une bande où le personnage
  quitte le champ a besoin du sien.
- **La recette du découpage**, ouverte ici plutôt qu'ailleurs : la taille du pixel, le nombre de
  couleurs, le détourage. Elle **part de celle du jeu**, et ce qui s'en écarte est écrit en clair
  au pied de l'écran.
- **Le pupitre**, et il n'y a presque rien à y décider : la vitesse, et le sens, en boucle ou
  aller-retour. Le nombre d'images n'y est plus : c'est le nombre d'images retenues, et il se lit
  au lieu de se régler.

**Un seul curseur pour la vitesse, et c'est voulu.** Il règle l'aperçu **et** il est la cadence
écrite dans le fichier d'accompagnement à l'export. Deux réglages séparés finiraient par se
contredire, et c'est l'auteur qui paierait l'écart.

**Ce que l'éditeur ne fait pas.** Il ne dépense rien : le clip est déjà payé, et il n'y a pas de
barre de dépense sur cet écran.

> **⚠️ Une règle a changé de forme le 3 septembre 2026, sur demande de l'auteur.** Elle disait :
> *l'éditeur n'invente aucune taille de pixel ni aucune palette ; ce sont celles du projet, en
> lecture seule.* Elle dit maintenant : **la recette du jeu est le point de départ, jamais une
> prison.** Le projet donne la taille de pixel, la palette et le détourage ; la bande part de là,
> et ce que l'auteur change ici s'écrit **sur la bande**. Ce qui reste de l'ancienne règle, et qui
> en était le fond : *une bande qui s'écarte de son jeu le dit*, en clair, à l'écran, à côté du
> chiffre changé.

**L'ordre du traitement est contraint**, et il ne se réordonne pas : nettoyage des taches, puis
détourage à la recette du projet, puis calcul des boîtes, puis fenêtre commune, puis grille à la
cible du projet, puis palette du projet. **Une ombre sous les pieds, mesurée avant nettoyage,
soulèverait l'image entière.**

**Et c'est ici que se prend le chiffre qui manque à la version.** Combien de clips pour une bande
utilisable, personne ne le sait. L'écran affiche le prix par bande de ce clip et le voit baisser à
chaque bande gardée ; **c'est cet affichage-là qui produit le chiffre**, à l'usage, sans banc
supplémentaire.

**Critères d'acceptation**

- [ ] Un clip s'ouvre déjà en train de tourner, sans qu'on ait à régler quoi que ce soit
- [ ] La fenêtre se déplace et se redimensionne à la souris ; l'aperçu brut **suit la main**, l'aperçu pixelisé se refait au relâchement
- [ ] **Chaque image du clip se prend ou se laisse d'un clic**, et la bande n'est jamais forcée à des images régulièrement espacées — un pas de marche demande deux images serrées au contact et une seule pendant la glisse
- [ ] Les images retenues se voient **dans l'ordre, au format de la bande**, et chacune se retire de là aussi
- [ ] Le cadrage se **reprend à la main** quand l'automatique tombe mal, et l'écran dit lequel des trois cadres est en usage
- [ ] Toutes les bandes d'un même clip partagent la même assise par défaut — **un personnage ne change pas de taille en passant du repos à la marche**
- [ ] La recette du découpage se règle depuis cet écran, elle **part de celle du jeu**, et tout écart avec le jeu est écrit en clair
- [ ] Plusieurs bandes se gardent depuis le même clip, chacune nommée, et la liste s'en voit
- [ ] Une bande gardée dit **quelle case du plan de poses elle remplit** ; une bande sans case visée reste un brouillon et ne bloque rien
- [ ] Ce qui sort est exactement ce que l'aperçu de droite montrait
- [ ] La vitesse réglée ici est celle qui part à l'export
- [ ] Les deux propositions de la machine — la boucle qui se referme, les moments calmes — s'affichent sans rien décider, et se ferment
- [ ] Le prix par bande utilisable de ce clip se lit à l'écran, et **il baisse à chaque bande gardée**
- [ ] Rien sur cet écran n'engage une dépense, et une phrase le dit
- [ ] Tout se fait au clavier autant qu'à la souris, parce que le geste se répète trois fois par clip
- [ ] Le guide reçoit sa ligne, et la table des mouvements du design reçoit **sa septième entrée avec sa raison** : ici le mouvement n'est pas un effet, c'est le contenu qu'on juge

**Bloquée par** — `A9` pour le clip, `A2` pour la fenêtre commune.

---

### A11 · Le moteur de la maison — animer sans payer
*8 US (454–461)* · **la seule tranche qui amène le prix d'un clip à zéro**

**Ce qu'on livre.** L'atelier sait fabriquer un clip **sur la carte graphique de la maison**. Le
moteur local apparaît dans la même liste que les modèles payants, avec la même phrase de grisé
quand il n'est pas là, et le même geste pour commander. Ce qui change est ce qui s'affiche à
côté : **une attente au lieu d'un prix.**

**Pourquoi elle arrive après le montage et pas avant.** Le chemin complet — commander, attendre,
découper, obtenir une bande — se tient debout dès `A10`, et il se construit **sans dépenser un
centime** : les treize clips du banc existent déjà et suffisent à l'écrire. `A11` ne change pas la
chaîne, **elle en change l'échelle** — et c'est à partir d'`A12`, quand il faut couvrir toute une
matrice, que cette échelle devient la question.

**Ce qui est mesuré, et sur quoi la tranche s'appuie.** RTX 3080 Laptop, 8 Go, bridée à 100 W.
Wan 2.2 image→vidéo, quatorze milliards de paramètres en version compressée, plus un greffon
entraîné sur des sprites et un greffon d'accélération. Tout sous licence Apache 2.0 — utilisable
dans un jeu vendu depuis la France. Le détail vit dans `docs/recherche-video-locale/`.

| Ce qui est mesuré | Le local | Le clip payé qui a marché |
|---|---|---|
| Mémoire prise | **6,0 Go sur 6,92 disponibles** — jamais le mur | — |
| Une seconde de clip | **130 s** *(17 images, 832 × 480)* | quelques dizaines de secondes |
| Deux secondes | 151 s *(33 images)* | — |
| Le clip le plus long tiré | 210 s *(45 images, soit 2,8 s)* | — |
| Le personnage garde sa taille | 4 à 5 % d'écart | 3 % |
| **Le fond reste détourable** | **étalement 1 à 3 niveaux** | 0 à 9 |
| **Le fond dérive en luminosité** | **3 niveaux** | **20 niveaux** |
| Prix | **0 $** | 0,048 à 0,067 $ |

**Sur les deux lignes qui décident du détourage, le local est meilleur.** Le défaut relevé par
l'auteur sur le clip payé — *« la première image est plus lumineuse »* — n'existe pas ici. Et la
bande ramenée sur 64 pixels et 24 couleurs garde capuchon, sac, lanterne, ceinture et bottes,
blocs carrés et contour net.

#### Les quatre décisions que ça impose au code

**1. Un prix de zéro n'est pas un prix inconnu — et le code confond aujourd'hui les deux.**
`ModeleVideo.refus` grise tout modèle dont le prix n'a pas pu être relu, et c'est une bonne
règle : elle interdit d'engager l'auteur sans savoir ce qu'il engage. Mais un moteur de la maison
n'a **aucun tarif chez aucun fournisseur**, et son montant est pourtant parfaitement connu : il
vaut zéro. **Sans une troisième valeur, la règle qui protège de la dépense griserait le seul
modèle qui n'en fait aucune.** Le tarif porte donc un genre de plus — *maison* —, son montant est
zéro, et sa formule dit *gratuit, la carte de la maison* au lieu d'une multiplication.

**2. Ce qui coûte n'est plus de l'argent, c'est du temps — et il s'annonce pareil.** L'invariant
*rien ne part sans que le prix soit annoncé* ne disparaît pas, il change d'unité. L'écran annonce
**une attente**, calculée sur des mesures de cette machine et non sur une constante : relevé
≈ 7,6 s par image au premier tirage, ≈ 4,7 s ensuite, le modèle restant chargé. Et il dit
**lequel des deux** il annonce, comme il dit aujourd'hui *estimation* ou *relu*.

**3. La durée descend à une seconde, et c'est le réglage le plus important de l'écran.** Mesuré :
**plus le clip est long, plus la bande se dégrade.** Dix-sept images donnent une bande nettement
plus propre que trente-trois, elle-même plus propre que quarante-cinq — la lanterne se dédouble,
la cape fusionne avec le corps. L'explication est connue : le greffon a été entraîné **par paquets
de 8, 16, 24 et 32 images**, et au-delà il travaille hors de son terrain.

> ⚠️ **Et les mesures automatiques ne voient rien de cette dégradation.** Écart de taille, fond
> uni, dérive : les trois longueurs donnent les mêmes chiffres. **Seul l'œil la voit.** C'est la
> troisième fois que ce dépôt le constate — après le banc des planches (`bilan-v3.md` § 6) et le
> classement calculé qui avait été rejeté. La règle tient : *la mesure propose, l'auteur juge.*

> **Ce que ça commande au produit**, et qui rejoint la file d'`A9` au lieu de la contredire : ne
> pas demander un clip long pour y prélever plusieurs animations, mais **demander des clips
> courts, et en demander beaucoup**. Le geste *lancer plusieurs et garder le bon* ne change pas ;
> le local le rend gratuit, donc praticable à une échelle que le payant interdisait.

**4. Le nombre d'images n'est pas libre, et l'écran doit dire le vrai.** Le modèle n'accepte que
des comptes de la forme `4n + 1` : à seize images par seconde, une seconde fait **17 images**,
deux **33**, trois **49**. Le produit convertit, et **annonce le compte réel** plutôt que celui
qu'on a demandé — même règle que partout ailleurs : *ce qui est enregistré est ce qui s'est
passé.* ⚠️ *Le banc n'est jamais monté jusqu'à trois secondes pleines : son plus long tirage
faisait **45 images, soit 2,8 s**. Les 49 images sont le compte que la formule donne, pas un
chiffre mesuré, et l'écran ne doit pas les présenter autrement.*

#### Ce qui manque se dit, et les trois absences ne sont pas la même

Motif déjà écrit et éprouvé dans le dépôt — `etat_des_silhouettes` pour les moteurs de détourage
(`U13`). Il se reprend tel quel, avec trois raisons distinctes :

| Ce qui manque | Ce que l'écran dit | Le modèle est |
|---|---|---|
| ComfyUI n'est pas lancé | *le moteur de la maison n'est pas allumé — ouvrez ComfyUI* | **grisé**, avec sa raison |
| ComfyUI est lancé, les fichiers ne sont pas descendus | *il manque 26,7 Go de modèles* — et **la liste de ce qui manque, avec sa taille** | **choisissable**, et il dit ce qu'il va rapatrier |
| Les fichiers sont là, un greffon manque | *le greffon pixel art est absent : le clip sortira lissé* | **choisissable**, avec l'avertissement |

**Confondre les trois obligerait à sortir de l'atelier pour un téléchargement que l'atelier sait
faire**, ou laisserait tomber une attente de plusieurs minutes sur un geste annoncé comme
immédiat.

#### Les trois pièges, payés une fois au banc du 3 septembre 2026

Aucun n'est documenté nulle part, et chacun a demandé un diagnostic.

1. **Le nœud que la recette officielle emploie n'existe pas dans un ComfyUI ordinaire.** Le
   montage livré avec le greffon pixel art appelle `PainterI2V`, absent de l'installation.
   Remplacé par `WanImageToVideo`, livré d'origine. **Vérifié après coup : la substitution est
   bonne** — le sprite est ancré au pixel près sur la première image du clip.
2. **Le chargeur d'encodeur de texte compressé refuse de démarrer** : il reconstruit son
   dictionnaire de mots et réclame une bibliothèque plus récente que celle installée. Or **cette
   version-là est celle qu'exigent les paquets du générateur de bruitages** : la mettre à jour
   aurait risqué de casser le son. Contourné en prenant l'encodeur non compressé, qui embarque son
   propre dictionnaire — 6,3 Go au lieu de 3,9. *Le produit ne doit jamais toucher à
   l'environnement de ComfyUI : il s'adapte à ce qu'il y trouve.*
3. **Un téléchargement de neuf gigaoctets se coupe, et le dire n'est pas automatique.** Deux se
   sont interrompus en silence. Il faut comparer la taille obtenue à celle que le serveur annonce,
   et reprendre — jamais supposer qu'un fichier présent est un fichier complet.

#### Ce que cette tranche n'est pas

Ni un second atelier, ni un éditeur de montages ComfyUI. **Le produit envoie un montage qu'il
écrit lui-même**, au format que l'interface attend, et ne propose aucun réglage de nœud. Le jour
où l'auteur voudra ses propres montages, ce sera une autre tranche et elle se discutera.

**Critères d'acceptation**

- [ ] Le moteur de la maison apparaît **dans la même liste** que les modèles payants, avec le même geste pour le choisir
- [ ] Son coût affiché est **une attente, pas un prix**, et l'écran dit si c'est le premier tirage — modèle à charger — ou un suivant
- [ ] **Un clip local enregistre une dépense de zéro, et zéro n'est pas « inconnu »** : le journal des dépenses le distingue d'un montant qui n'a pas pu être relu
- [ ] Les durées de **1, 2 et 3 secondes** sont proposées, et l'écran annonce **le nombre d'images réel** — 17, 33, 49 — jamais celui demandé
- [ ] L'écran **recommande la durée courte** et dit pourquoi en une phrase, avec le fait mesuré derrière
- [ ] ComfyUI éteint, modèles absents et greffon absent donnent **trois phrases différentes**, et seule la première grise le modèle
- [ ] Ce qu'il faut télécharger est **listé avec sa taille et sa licence** avant que l'auteur lance quoi que ce soit
- [ ] Un téléchargement interrompu se **détecte et se reprend** : la taille obtenue se compare à celle annoncée
- [ ] Le produit **ne modifie jamais l'installation de ComfyUI** — ni paquet, ni réglage, ni nœud
- [ ] Un clip local suit **exactement le même chemin** qu'un clip payé une fois revenu : mêmes images extraites, même entrée en bibliothèque, même écran de montage
- [ ] **La file d'`A9` marche sur le local**, et c'est là qu'elle prend son sens : lancer quatre clips ne coûte que du temps
- [ ] Une panne de ComfyUI en cours de calcul rend **une phrase française qui dit quoi faire**, et le clip raté ne coûte rien à personne
- [ ] Le montage envoyé est **écrit par le produit**, pas importé d'un fichier que l'auteur devrait maintenir

**Bloquée par** — `A9`, dont elle reprend le port, la demande de clip et l'objet clip. **Elle ne
bloque rien**, mais elle rend `A12` supportable.

---

### A12 · Toutes les poses, en animation
*5 US (482–486)* · **c'est ici que l'objectif de la version se vérifie**

**Ce qu'on livre.** La matrice d'un personnage se lit **sur deux calques** : les images fixes, et
les animations. Chacun a sa jauge, et l'on voit d'un coup d'œil quelles cases sont animées et
lesquelles ne le sont pas. Depuis une case vide du calque animé, on commande le clip qui la
remplira — l'image de départ étant déjà proposée par `A9`.

**Pourquoi c'est un calque et pas un contenu de plus dans la case.** *Tranché par l'auteur le
3 septembre 2026.* Si une case portait l'image fixe **et** l'animation, elle serait « remplie »
dès qu'elle a l'une des deux — et une pose animée manquante se cacherait derrière une pose fixe
présente. **C'est très exactement ce que l'auteur veut voir.** Deux calques gardent aussi
l'invariant de `E2` intact — *une case est prise dès qu'une image la porte* — au lieu de le
tordre : il vaut deux fois, une fois par calque.

**Ce que ça change à la jauge.** Elle ne compte toujours que ce qu'on peut fabriquer maintenant,
invariant de `E12`. Il y en a simplement deux, et l'écran dit laquelle est laquelle. *« Il manque
la mort du nain »* devient lisible en deux versions : l'image, ou l'animation.

**Le chemin complet, et c'est le geste que la version promet.** Depuis la fiche d'un personnage :
on bascule sur le calque animé, on voit les cases vides, on en choisit une, on commande le clip —
l'image de départ est proposée, le mouvement est déduit de la pose par `A6` —, le clip revient, on
le découpe en `A10`, on affecte la bande à la case, la case se remplit. **Et le même clip peut en
remplir plusieurs.**

**Ce qui n'est pas encore mesuré, et se verra ici.** Tous les clips du banc partent du profil.
**Ce que rend une demande d'animation sur une pose vue de face ou de dos est inconnu.** Cette
tranche est la première qui l'exerce à l'échelle, et c'est elle qui rapportera le fait.

**Critères d'acceptation**

- [ ] La matrice d'un personnage se lit **sur deux calques** — images fixes, animations —, et l'on passe de l'un à l'autre d'un geste
- [ ] Chaque calque porte **sa propre jauge**, et l'écran dit de quoi chacune est le total
- [ ] Une case du calque animé est prise **dès qu'une bande la porte**, pas parce que la bande est bonne — même règle que pour les images
- [ ] Depuis une case vide du calque animé, **commander le clip qui la remplira est un geste**, et l'image de départ est déjà proposée
- [ ] Une bande affectée à une case s'y voit en train de tourner, à la taille de la vignette
- [ ] Une case animée dit **de quel clip** sa bande vient, et se remonte jusqu'à lui
- [ ] Retirer une bande d'une case ne supprime ni la bande, ni le clip
- [ ] Une pose écartée par le personnage n'apparaît sur aucun des deux calques
- [ ] Un projet sans aucune animation se comporte exactement comme aujourd'hui
- [ ] Tout fonctionne réseau coupé, sauf commander

**Bloquée par** — `A10`, qui produit les bandes à ranger.

---

### A13 · L'image attrapée au vol
*4 US (487–490)* · **la version rend service au-delà de l'animation**

**Ce qu'on livre.** Sur l'écran de montage, un second geste sur une image de la pellicule la
**met de côté** : elle entre en bibliothèque comme une image de plus, avec sa filiation — de quel
clip, quelle image —, et se range ensuite comme tout le reste. Une pose fixe, un objet, un détail
de décor : ce qu'on en fait n'appartient plus à l'animation.

**Pourquoi ça ne coûte presque rien à construire, et pourquoi c'est ici.** *Demandé par l'auteur
le 3 septembre 2026.* L'écran a déjà tout : les images sont extraites, la loupe est là parce qu'à
sept pixels de large on ne sait pas ce qu'on clique, et la chaîne du jeu tourne déjà sur l'aperçu
de droite. **Il ne manque qu'une destination.**

**Où elle atterrit.** *Tranché par l'auteur le 3 septembre 2026 :* **en bibliothèque d'abord, et
rangeable ensuite.** Un clic la pose, un second geste facultatif l'affecte à une case du plan de
poses ou à un objet. C'est l'enchaînement que le produit emploie déjà partout — générer puis
affecter —, et il évite d'alourdir le geste court par une question au moment où l'on prélève
« pour voir ».

**Elle passe par la chaîne du jeu, et l'image brute est gardée.** Même règle que pour tout ce qui
entre : détourage, fenêtre, grille, palette du projet, et une recette qu'on peut reprendre après
coup. Le traitement est non destructif, invariant de `T2` — une image prélevée n'y fait aucune
exception.

**Ce que ça ouvre, et qui n'est pas promis ici.** Si une image tirée d'une vidéo tient comme pose
officielle, alors le moteur de la maison sait produire des poses gratuitement — *tourne-toi*,
*meurs*, *lève le bras*, et l'on prélève. **C'est la question que le banc animé n'a pas eu à
poser**, parce que l'animation pardonne le flou : ça défile. Cette tranche donne le geste ; la
réponse viendra de l'usage, et elle est notée en fin de document.

**Critères d'acceptation**

- [ ] Un second geste sur une image de la pellicule la met de côté, **sans quitter l'écran de montage** et sans toucher aux images retenues pour la bande
- [ ] L'image mise de côté **entre en bibliothèque** avec sa filiation : de quel clip, quelle image, quelle génération l'a payé
- [ ] Elle passe par **la chaîne du jeu**, et sa recette se reprend après coup comme celle de n'importe quelle image
- [ ] **L'image brute est gardée** : le traitement reste non destructif
- [ ] Un second geste facultatif l'affecte à une case du plan de poses ou à un objet — jamais demandé au moment du prélèvement
- [ ] Prélever plusieurs images d'affilée ne demande pas de recommencer le geste depuis le début
- [ ] Rien ici ne dépense, et la filiation dit que le clip, lui, a été payé
- [ ] Tout fonctionne réseau coupé

**Bloquée par** — `A10`, dont il reprend la pellicule et la loupe.

---

### A4 · La bande sort de l'atelier
*4 US (385–388)*

**Ce qu'on livre.** Une bande gardée devient un fichier utilisable dans un moteur de jeu : planche
de sprites accompagnée de sa description, et image animée pour la montrer sans rien installer. La
cadence voulue voyage avec.

**On n'invente aucun format.** Le format d'accompagnement d'une planche de sprites le plus lu par
les moteurs est connu et ses clés exactes sont relevées (`docs/bilan-v3.md` § 4). **À écrire tel
quel** : un moteur ouvre alors la planche sans avoir à la remesurer.

**Pourquoi ici et pas à la fin.** Une bande qui reste dans l'atelier n'est pas livrée. Dès qu'on
sait en garder une, on doit pouvoir la sortir — sinon les tranches précédentes ne servent qu'à
regarder.

**La tranche est courte** : l'export existe déjà, et c'est le seul geste du produit qui fasse
sortir des images. Ce qui s'ajoute est le format de la bande, pas la machinerie. *La sortie du
squelette partait avec le pantin ; elle sort du plan avec lui.*

**Critères d'acceptation**

- [ ] Une bande sort en planche de sprites, avec un descriptif qui dit la taille d'une case, leur nombre et leur ordre
- [ ] Le descriptif est écrit dans le format existant le plus lu, jamais dans un format inventé ici
- [ ] Une bande sort en image animée, lisible sans moteur de jeu
- [ ] La cadence est écrite dans le descriptif, et l'image animée la respecte
- [ ] Toutes les bandes d'un personnage sortent en une seule archive
- [ ] Ce qui sort est exactement ce que l'aperçu montrait — mêmes pixels, même fenêtre

**Bloquée par** — `A10`.

---

### A5 · Le contour qui ne bout pas
*2 US (390, 391)*

**Ce qu'on livre.** Le contour cesse de grésiller quand la bande tourne. Aujourd'hui la réduction
sur la grille de pixels prend **un pixel par bloc** ; d'une image à l'autre ce tirage change
indépendamment, et le bord se met à bouillir alors que le personnage n'a pas bougé. La palette
recalculée par image ajoute son propre scintillement.

**Pourquoi ça n'existe qu'en V3, et pourquoi c'est ce que « de qualité » veut dire ici.** Un
défaut fixe est un défaut ; **un défaut animé est un défaut qu'on regarde**. Les trois défauts qui
décident du sort d'une bande — le contour qui bout, l'échelle qui pompe, le pied qui patine — ne
se voient **qu'entre les images**, et le produit n'a aujourd'hui aucune mesure qui regarde deux
images ensemble.

**La mesure qui manque, et elle est simple** : sur deux images d'un mouvement lent, compter les
pixels de contour qui changent d'état alors que le sujet n'a pas bougé d'un pixel entier. C'est
elle qui dit si la tranche a servi.

**Ce qu'elle ne traite pas, et qui est ailleurs.** Le bord *juste* — le halo contre le sprite qui
maigrit — est le sujet de `D4`, et il se règle sur une image seule. Ici il ne s'agit que de la
**stabilité entre deux images**.

**Critères d'acceptation**

- [ ] La stabilité d'une bande se mesure, et le chiffre s'affiche à côté de l'aperçu
- [ ] La réduction d'une bande décide la silhouette de la même façon sur toutes ses images
- [ ] La palette d'une bande est calculée une fois pour la bande, jamais par image
- [ ] Le contour retracé, s'il existe, l'est identiquement sur toutes les images
- [ ] Comparé avant/après sur une bande du banc, avec le chiffre écrit
- [ ] Aucun invariant du traitement ne bouge : non destructif, sans carte graphique, sans appel au fournisseur

**Bloquée par** — `A10` seule. *(`D2` était l'autre blocage — *une réduction stable suppose une
grille juste* — et elle est close le 3 septembre 2026.)*

---

### A7 · Reprendre une image sans refaire la bande
*6 US (384, 396–400)* · **rétrécie le 3 septembre 2026 : choisir les images, c'est `A10`**

**Ce qu'on livre.** Les trois gestes qui manquent à l'écran de montage une fois la bande gardée :
voir l'image précédente en transparence sous celle qu'on corrige, pousser une image au pixel dans
sa fenêtre, et ancrer la bande par l'un de ses neuf points pour que le personnage tienne au sol
plutôt qu'au cadre. **Et remplacer une image par une autre — du même clip, ou d'un autre.**

> **Ce que la refonte lui a retiré, et il faut le dire.** Cette tranche promettait de *remplacer
> une image par un nouveau tirage*, et son économie était celle de la planche : *« on repaie une
> image au lieu de dix »*. Sur le chemin vidéo, remplacer une image ne coûte rien — on en prend
> une autre dans le clip, et **c'est déjà le geste principal d'`A10`**. Ce qui reste est ce
> qu'`A10` ne fait pas : corriger la position d'une image gardée, et aller en chercher une dans un
> autre clip.

**Composer avec deux clips.** C'est ce qui reste de l'ancienne `A3` : quand deux clips sont chacun
bons à moitié, prendre une image dans l'un et une image dans l'autre. La bande dit alors **de quel
clip vient chaque image**, comme une image dit de quel clip elle vient.

**Critères d'acceptation**

- [ ] L'image précédente s'affiche en transparence sous l'image courante, et l'intensité se règle
- [ ] Une image se déplace au pixel, au clavier comme à la souris
- [ ] Une image se remplace par une autre du même clip, **ou d'un autre clip**, sans quitter l'écran
- [ ] Une bande composée de plusieurs clips dit **de quel clip vient chaque image**
- [ ] La fenêtre commune se recalcule à chaque changement, et jamais à moitié
- [ ] L'ancrage se choisit parmi neuf points, et la bande entière le respecte
- [ ] Chaque correction est annulable, et la bande d'origine reste lisible
- [ ] Rien ici ne dépense

**Bloquée par** — `A10`.

---

## V3.1 — L'atelier tient ce qu'il dit

*Née le 3 septembre 2026 du carnet de l'auteur — douze remarques relevées en une semaine d'usage,
mesurées et arbitrées une par une le jour même. **Aucune n'était ce qu'elle paraissait.***

**Ce qu'elle répare, en clair.** Presque rien de cette version n'est neuf. Ce sont des choses que
le produit **avait déjà faites** — une phrase juste le jour où elle a été écrite, une barre
d'attente calculée à chaque geste, une explication rédigée avec soin, une décision prise pour une
bonne raison — et qui ont cessé d'être vraies, ou branchées, ou justes, **sans que rien ne le
signale**.

**L'écart se paie deux fois.** Il coûte à l'usage : on dézoome pour lire un menu, on regarde un
écran figé pendant deux secondes, on lit qu'un fond est écarté alors qu'il n'y a rien à écarter.
Et il coûte à la confiance : quand une phrase du produit s'est révélée fausse, les suivantes ne se
croient plus. C'est le vrai sujet de cette version.

**Ce qu'elle livre.** L'atelier redevient d'accord avec lui-même. Ce qu'il affirme est vrai au
moment où on le lit ; ce qu'il a construit est atteignable ; les règles qu'il a posées et que
l'usage contredit sont rouvertes plutôt que défendues. Et les quelques gestes qui manquaient
vraiment arrivent sur des écrans qu'on aura déjà rouverts pour le reste.

**Pourquoi après la V3.** L'animation est l'objectif, et rien ici ne la bloque. Mais rien ici ne
dépend d'elle non plus : chaque tranche se prend seule, et les quatre familles peuvent s'entamer
dans n'importe quel ordre si l'usage le réclame.

### Les quatre familles, et elles commandent l'ordre

Les quarante-trois changements ne sont pas quarante-trois problèmes. Ils retombent dans quatre
familles, et les trois premières ont la même racine : **le dépôt écrit ses règles mieux qu'il ne
les tient, et rien ne mesure l'écart.**

| | La famille | Ce qu'on y trouve | Tranches |
|---|---|---|---|
| **①** | **Ce que le produit dit de lui-même a cessé d'être vrai** | neuf phrases mesurées ou promises, justes le jour où elles ont été écrites | `G1` |
| **②** | **Ce qui est construit et jamais branché** | une barre d'attente jetée, une image servie et jamais montrée, vingt-trois explications accrochées à rien, un bouton qu'on ne trouve pas, **une image payée que rien n'ouvre** | `G2` · `G3` · `G4` · `G5` · `G16` |
| **③** | **Des décisions que l'usage contredit** | un menu non borné, un accueil qui ne s'ouvre qu'une fois, des replis regroupés loin de ce qu'ils commandent, un calcul posé au milieu d'une surface d'idées | `G6` · `G7` · `G8` |
| **④** | **Des gestes qui manquent vraiment** | et ceux-là seuls ouvrent des user stories neuves | `G9` → `G12` · `G16` |

Trois défauts mesurés la même semaine mais jamais arbitrés ferment la version : `G13` à `G15`.
*L'arbitrage de `G15` est écrit, et il retourne le titre de la tranche : la réduction de couleurs a
cessé de dépendre de l'artwork en `D2`. Il est en bas, sous ses critères.*

### Ce que cette version ne fait pas

- **La hiérarchie du prompt.** Mesuré : l'univers pèse 41 à 45 % du texte envoyé, et **la consigne
  de pose 1,5 à 2,3 %**. *Reporté après la V3 par l'auteur, le 3 septembre 2026*, avec la mesure
  faite — c'est elle qui servira de point de départ, et elle ne se refait pas. La remarque du
  1ᵉʳ septembre sur la vue du jeu est la même question prise deux jours plus tôt.
- **Une IA qui aide à formuler l'univers.** Le produit n'a **aucun contrat de texte** — deux ports
  seulement, l'image et l'animation. C'est un troisième genre de fournisseur, avec sa clé, son
  catalogue et sa place dans les dépenses ; pas un réglage.
- **L'historique des retouches**, et le retour en arrière qu'il permettrait. *« Pour bien plus
  tard »*, et c'est son absence qui rend `G12` prudente.
- **Masquer l'avancé, et la grosse passe de design.** *Écarté par l'auteur le 3 septembre 2026 :
  après la V3, voire plus tard.*
- **Les types d'objets sur mesure.** On peut en éteindre un ; on n'en crée pas.
- **Un banc qui mesurerait ce qu'une case de l'univers change.** *« Ça a été testé ? »* restera
  **non**, et c'est assumé : deux mots dans un prompt ne valent pas huit tirages payés par branche.

### ⚠️ Ce que la version ne se donne pas les moyens de tenir

**Aucun garde-fou mécanique sur les nombres écrits dans les phrases.** *Tranché par l'auteur le
3 septembre 2026 : on relit, et on corrige quand ça se voit.* La règle proposée — *un nombre
affiché se calcule, ou il ne s'affiche pas* — a été écartée.

**Le risque est connu et il est écrit ici plutôt que découvert plus tard** : les neuf phrases de
`G1` avaient toutes été écrites **justes**, par quelqu'un d'attentif, et aucune relecture ne les a
rattrapées — la plus ancienne a tenu sept jours, la plus récente deux. Rien dans cette version
n'empêche la dixième.

*Les trois autres familles, elles, ont leur garde-fou, et il est tranché : un essai par famille —
`G2`, `G3` et `G4` le portent chacun.*

---

### G1 · Les phrases qui ont cessé d'être vraies — ✔ **close le 3 septembre 2026**
*Aucune US neuve — elles tiennent celles qui existent* · **famille ①**

**Ce qu'on livre.** Neuf phrases visibles du produit disent à nouveau vrai. Aucune n'était une
approximation : toutes ont été mesurées ou vérifiées le jour de leur écriture, et toutes ont été
démenties par un changement venu d'ailleurs.

> ### Ce que la tranche a trouvé en plus, en les corrigeant
>
> **Elles étaient douze, pas neuf, et les trois de plus sont de la même famille.** Le tableau
> ci-dessous en listait neuf ; en les corrigeant une par une, trois autres nombres écrits à la
> main sont tombés dans le même filet : *« les huit vues en cartes, les neuf tailles à leur vraie
> échelle, les huit types côte à côte »* — une seule ligne de commentaire, trois comptes, et le
> produit en porte aujourd'hui **dix** de tailles. Ils sont **retirés** plutôt que remesurés :
> ce que la phrase dit ne dépend d'aucun d'eux.
>
> **Les numéros d'étape étaient huit et non sept, et ils sont désormais calculés.** Ils se
> désignent par leur **nom d'abord** — « l'étape « La vue » » — parce que c'est le nom qu'on
> retrouve dans la colonne de gauche ; le rang suit, compté depuis la liste. Le nom suit le style,
> puisque la quatrième étape en porte deux depuis `D2`.
>
> **Et cinq commentaires du code citaient « l'étape 10 » pour la douzième** — décalés de deux
> crans, par `D1` puis par `D2`. Ils ne s'affichent nulle part, mais ils envoient le prochain
> lecteur au mauvais endroit. Ils nomment l'étape au lieu de la numéroter.
>
> ### Deux chiffres remesurés, deux chiffres retirés
>
> | la phrase | ce qu'elle disait | ce qui est écrit maintenant |
> |---|---|---|
> | la lecture de palette | *« une centaine de millisecondes »* | **6 ms à 1,2 s, 360 ms en médiane** — remesuré sur les 92 cartes du dépôt |
> | le fond écarté d'un artwork | *« 100 % … le reste — le fond — est écarté »* | deux phrases selon qu'il reste quelque chose : **3 des 10 artworks officiels du dépôt sont lus à 100,0 %**, et il n'y a alors rien à écarter |
> | le poids de l'univers dans le prompt | *« plus de la moitié du texte »* | **retiré** — c'est un rapport entre deux textes qui bougent chacun de leur côté |
> | la hauteur du menu d'une carte | *« il fait 300 px pour une carte 1× qui en fait 190 »* | **retiré** — ce qui décide la règle est le rapport, pas les valeurs |
>
> **Le seuil de 100 % a un effet de plus, trouvé en écrivant la phrase** : la case *« me le
> montrer sur l'image »* et le renvoi *« découper le montre en magenta »* s'offraient sur une
> carte où le magenta ne couvrirait aucun pixel. Une case qui ne change pas l'image est pire
> qu'une case absente — on la coche deux fois avant de conclure qu'elle est cassée. Les deux se
> retirent au même seuil.
>
> ### Le garde-fou est là où il ne coûte rien, et nulle part ailleurs
>
> La règle générale — *un nombre affiché se calcule, ou il ne s'affiche pas* — reste écartée,
> c'est la décision de l'auteur. **Un seul essai la fige, et sur la seule famille où le calcul est
> gratuit** : `tests/test_g1.py` refuse qu'un numéro d'étape soit écrit à la main dans l'écran, et
> il est **sans exception** — les deux commentaires qui racontent la correction disent « la
> deuxième » en toutes lettres plutôt que de demander une dérogation. Une règle à deux étages dont
> le second demande de savoir qu'il existe n'est pas une règle.

| Ce que le produit dit | Ce qui est vrai | Depuis |
|---|---|---|
| *« plus de la moitié du texte »* — l'univers dans le prompt | **41 à 45 %** | le 1ᵉʳ septembre 23 h 14, quand le bloc caméra a ajouté 512 caractères |
| *« il fait 300 px »* — le menu d'une carte | deux blocs de plus depuis | l'arrivée de *concept art de* et de la lecture de palette |
| *« une centaine de millisecondes »* — la lecture de palette | **913 ms** sur la plus grande image du dépôt | la mesure n'a jamais couvert les grandes images |
| *« les huit types couvrent ce qu'on sait faire »* | **sept** dans le projet de l'auteur | le 31 août, quand un huitième type est entré dans le barème livré |
| **sept numéros d'étape** cités en dur | tous décalés d'un cran | l'insertion de l'étape *Le style* |
| *« une carte non promue ne part jamais »* | **faux** — un concept art part sans être promu | l'arrivée des concept arts |
| *« une retouche dans la fiche porte la même barre »* | la retouche n'est plus dans la fiche | le 31 août, tranche `E4` |
| *« et l'image avec, en magenta »* — l'explication de la lecture de palette | le bloc ne montre aucune image | depuis toujours |
| *« 100 % … le reste — le fond — est écarté »* | **il n'y a pas de reste** | sur 4 des 9 artworks du dépôt |

**Et trois textes qui ne sont pas faux, seulement illisibles ou à côté.** L'aide de l'*époque*
affirme qu'elle *« décide des armes, des vêtements et des outils »* — c'est l'auteur qui décide, en
écrivant sa description ; elle cadre une **époque technologique**, et c'est tout ce qu'elle fait.
Les deux phrases *« Écrit par l'étape N. On le lit ici, on le choisit là-bas — sur une vignette »*
demandent de tenir deux endroits en tête sans dire lesquels. Et le texte à copier réclame *« trois
variantes qui explorent différentes températures de couleur »* quand ce qu'on cherche est **trois
manières de penser la même scène**.

**Ce qui remplace un nombre écrit à la main, quand c'est possible sans rien construire** : le rang
d'une étape se calcule depuis la liste des étapes, le compte des types se lit sur le barème du
projet, et le poids de l'univers **disparaît de la phrase** plutôt que d'être remesuré.

**Critères d'acceptation**

- [x] Les neuf phrases disent vrai, vérifié sur les projets de l'auteur — et **trois de plus**,
      tombées dans le même filet en les corrigeant
- [x] Aucun numéro d'étape n'est écrit à la main : le rang se calcule depuis la liste des étapes
      (`laDesignation`), et un essai le refuse sans exception — `tests/test_g1.py`
- [x] Le compte des types d'objets se lit sur le projet ouvert — `univers.bareme.length`, affiché
      trois lignes sous le barème qui le porte
- [x] La phrase de l'allure ne cite plus de proportion, et dit *l'univers* au lieu de *la tête*
- [x] L'aide de l'*époque* dit ce qu'elle fait — *« ce sont tes descriptions qui décident des
      armes »* — et dit qu'aucun banc n'a mesuré ce qu'elle change
- [x] Les deux phrases *« écrit par l'étape N »* nomment l'étape par son nom, et le nom suit le
      style pour la seule étape qui en porte deux
- [x] Le texte à copier demande trois approches de la même scène, et non trois températures de
      couleur — on choisissait un filtre là où l'on cherche une direction
- [x] Aucun appel payant : cette tranche est de l'écriture. Les deux remesures — la lecture de
      palette et la part lue des artworks — se font sur des fichiers déjà sur le disque

**Bloquée par** — aucune, et elle ne bloque plus rien : *les numéros d'étape étaient à corriger
avant que `D2` soit committée, et c'est fait le même jour.*

---

### G2 · La barre d'attente revient aux tables
*Aucune US neuve — US-6 et US-13 le promettaient déjà* · **famille ②**

**Ce qu'on livre.** Quand une retouche fait attendre, l'écran le dit. Mesuré : l'attente va de
**0,8 à 2,3 seconde**, et elle est la pire **au premier contact avec l'écran** — une image qui sort
d'une génération fait 1 024 px et n'a pas encore de grille, ce qui est exactement l'état dans
lequel on ouvre les tables la première fois. Une fois l'image sur une grille de 64 px, tout retombe
sous le quart de seconde.

**Ce n'est pas un manque, c'est une régression.** La barre a été posée sur la retouche le 27 août,
avec son attente **apprise** — le crochet retient ce que la dernière retouche du même genre a mis,
sur cette machine et sur cette image. Le 31 août, la retouche a déménagé de la fiche vers les
tables : la barre a été retirée d'un côté et jamais remontée de l'autre. **Le calcul, lui, a suivi
le déménagement** — il tourne encore, et personne ne le lit.

**Et aucun essai ne l'a vue partir.** Le seul essai qui exerce cette barre vise le travail des
couleurs, et son commentaire affirme pourtant qu'elle sert *« à la génération **et à la
retouche** »*. Il affirme le partage sans l'exercer.

**Aucune roue qui tourne.** La liste de ce qui bouge reste close, et son seul mouvement continu
reste celui qui dit *où ça en est* — une roue dirait seulement *ça travaille*.

**Critères d'acceptation**

- [ ] Une retouche qui dépasse 240 ms montre la barre ; en dessous, rien ne paraît
- [ ] La barre est celle du produit — la même que la génération et le travail des couleurs
- [ ] Elle se pose en pleine largeur, entre la barre des tables et les trois colonnes, sur 2 px **réservés en permanence**
- [ ] Deux retouches lancées coup sur coup sont une seule attente, pas deux
- [ ] Les réglages restent manœuvrables pendant l'attente : rien ne se verrouille
- [ ] **Un essai pose une retouche lente et attend la barre** — c'est ce qui a manqué pendant une semaine
- [ ] La documentation de la barre cesse de dire que la retouche vit dans la fiche

**Bloquée par** — aucune.

---

### G3 · Les vingt-trois explications s'accrochent
*Aucune US neuve — US-268 les promettait toutes* · **famille ②**

**Ce qu'on livre.** Une explication écrite pour un réglage devient atteignable **depuis ce
réglage**. Compté le 3 septembre 2026 : **35 entrées du recueil sur 122 ne sont citées par aucun
écran**. Une douzaine décrivent un écran entier et vivent légitimement au guide ; **les
vingt-trois autres nomment un contrôle que l'écran montre pourtant** — les sept cases de l'univers,
les trois du barème, les sept places de la recette, et six autres.

**Le cas qui a fait remonter la remarque.** L'auteur n'a pas compris trois réglages des *types
d'objets*. Les trois ont **chacun leur explication écrite dans le recueil**, et l'une d'elles
répond mot pour mot à sa question. Aucune n'est branchée. *Le reproche n'est pas qu'on ne lui a
rien expliqué : c'est qu'on lui a tout expliqué ailleurs.*

**Le dépôt s'était posé la question, et dans un seul sens.** Une règle existe déjà — *une maquette
qui ajoute un écran ou un réglage doit une ligne au guide, et elle l'écrit chez elle* —, écrite
après avoir découvert que onze sujets entiers n'étaient expliqués nulle part. **Elle ne couvre pas
l'inverse**, et l'inverse s'est produit vingt-trois fois.

**Un mot à corriger au passage** : l'interrupteur du barème affiche *« il se découpe »*, quand ce
qu'il fait est **détourer** — et *découper* est le nom d'un autre geste du produit. Le bon mot
était déjà écrit, dans l'entrée qu'on ne pouvait pas atteindre.

**Critères d'acceptation**

- [ ] Les vingt-trois entrées sont atteignables depuis le contrôle qu'elles nomment
- [ ] Aucune explication n'est recopiée dans un écran : elles sont lues dans le recueil
- [ ] **Un essai refuse une entrée qui nomme un contrôle sans être citée par un écran**, avec une liste d'exceptions déclarée pour celles qui décrivent un écran entier
- [ ] Le message d'échec de cet essai nomme la clé et le contrôle attendu
- [ ] L'interrupteur du barème dit *il se détoure*

**Bloquée par** — aucune.

---

### G4 · Les curseurs posent au relâchement
*Aucune US neuve — la règle existe depuis le 27 août 2026* · **famille ②**

**Ce qu'on livre.** Un glissement de curseur envoie **un** ordre au serveur, pas quatre-vingt-dix.

**Ce que l'auteur voyait.** *« Si on les déplace, il continue à bouger tout seul pendant plusieurs
secondes. »* Ce n'est pas un défaut d'affichage : la poignée du curseur **montre l'écho du serveur
au lieu de montrer la main**. Chaque cran traversé écrit l'univers entier ; la réponse remplace
l'univers ; la poignée lit sa position dedans. Elle suit donc la main avec le retard de la file, et
quand on lâche, elle rejoue les réponses en route une par une.

**Mesuré** : 15,4 ms par écrit, **90 crans** pour un glissement d'un bout à l'autre, soit ≈ 1,4 s
de calcul serveur, 90 allers-retours et 90 redessins de tout l'écran. Pendant ce temps, **le
serveur ne sert rien d'autre**.

**La règle est écrite sur le curseur lui-même depuis le 27 août** — *« il envoie ce qu'on a lâché,
pas ce qu'on a traversé »* —, et le produit la tient **dix fois sur dix-sept**. Sur les sept
curseurs qui ne la tiennent pas, quatre font travailler le serveur à chaque cran : celui du barème,
et les trois de la découpe, qui font recalculer une détection **jusqu'à 128 fois** pour un seul
glissement.

**Le piège, et il est déjà écrit ailleurs** : la valeur locale se resynchronise **sur le projet,
jamais sur la réponse du serveur**. S'y resynchroniser rendrait la dérive telle quelle.

**Critères d'acceptation**

- [ ] Un glissement du curseur d'occupation envoie un seul ordre au serveur
- [ ] Les trois curseurs de la découpe ne redemandent une détection qu'au relâchement
- [ ] La poignée suit la main sans attendre aucune réponse
- [ ] Un chiffre écrit dans le champ vaut un relâchement : un seul envoi
- [ ] **Un essai exige que tout curseur pose au relâchement**, ou porte une ligne disant pourquoi il n'en a pas besoin
- [ ] Les trois curseurs légitimes — le pinceau, les deux opacités — portent cette ligne

**Bloquée par** — aucune.

---

### G5 · Le geste qu'on ne trouve pas
*Aucune US neuve — US-352 le livrait déjà* · **famille ②**

**Ce qu'on livre.** Mettre à jour une recette nommée cesse d'être un geste caché. **Le bouton
existe déjà** : retaper le nom exact d'une recette change *Enregistrer* en *Remplacer ›*. Ce n'est
pas un manque, c'est un geste que rien n'annonce — l'auteur l'a réclamé sans savoir qu'il l'avait.

**Critères d'acceptation**

- [ ] Remplacer une recette nommée se voit sans avoir à retaper son nom
- [ ] Le geste reste explicite : rien ne se remplace par accident

**Bloquée par** — aucune. *Se pose dans le même panneau que `G12`.*

---

### G6 · Le menu ne sort plus de l'écran
*Aucune US neuve* · **famille ③** · **provisoire, et assumé**

**Ce qu'on livre.** Sur la toile, le menu d'une carte cesse de sortir par le bas. Le garde-fou
**existe depuis le 27 août** — le menu bascule au-dessus, s'aligne à droite, et défile en dedans
quand il ne tient nulle part — mais il est **éteint sur la toile**, par une décision écrite :
*« un plan n'a pas de bord contre lequel un menu se cogne — on le déplace, ou on l'agrandit »*.

**La décision avait prévu le contournement, et l'auteur dit qu'il ne convient pas** : *« on ne peut
jamais le voir entier sauf si on dézoome et colle le visuel tout en haut »*. Le plan est infini, le
regard ne l'est pas.

**Et son objection technique a été levée depuis, dans le fichier voisin.** Elle disait qu'une
hauteur en pixels d'écran serait fausse dès le premier cran de zoom ; la toile sait désormais poser
du contenu à taille d'écran dans le plan zoomé, et **cinq choses passent déjà par là**, dont les
prises d'une carte.

> ⚠️ **Cette tranche sera jetée par `G7`, et c'est su d'avance.** Une fois la colonne construite, le
> menu flottant ne paraît plus sur la toile : il n'y a plus rien à borner. *Arbitré dans ce sens
> sciemment — quelques lignes perdues contre des semaines de gêne en moins.*

**Critères d'acceptation**

- [ ] Sur la toile, aucun menu ne sort du cadre visible, à aucun cran de zoom
- [ ] Le menu se pose à taille d'écran **par la forme unique** que la toile emploie déjà, jamais par un calcul à lui
- [ ] La décision écrite est réécrite avec sa nouvelle raison, pas retirée en silence

**Bloquée par** — aucune.

---

### G7 · L'écran de l'univers se refait
*1 US (499)* · **famille ③** · **la plus grosse tranche de la version**

**Ce qu'on livre.** La toile redevient ce qu'elle doit être — *un cadre pour poser des idées et les
organiser en concepts et en ambiances* — et le détail d'une carte s'en va dans une colonne.

**Trois choses en une, parce qu'elles se posent au même endroit.**

**Une colonne de droite** de 380 px, qui paraît **quand une carte est choisie** et pas au survol :
son visuel en grand, ses réglages, et ses explications lues dans le recueil. Le problème de
placement **cesse d'exister** au lieu d'être borné.

> ⚠️ **Sur la toile, le survol cesse d'ouvrir un menu.** Sinon le débordement revient par la porte
> qu'on vient de fermer : deux endroits régleraient la même carte, et l'un des deux sortirait
> toujours de l'écran. **En vue grille, rien ne change.**

**La réserve passe à gauche**, et sa bascule quitte la barre du haut pour venir contre la colonne
qu'elle commande. *Cela révise une règle du châssis* — toutes les bascules au même endroit — dont
la raison était qu'un geste unique se cherche à un endroit unique. L'usage dit le contraire :
l'auteur a cherché ce bouton contre sa colonne. **La règle devient : une bascule se pose contre ce
qu'elle commande**, et elle se réécrit avec cette raison.

**Le bloc de lecture de palette s'en va.** *« Ce que la palette y lit »* quitte l'écran de
l'univers — *« une mécanique avancée qui ne devrait pas être mise comme ça sur la toile »*. Avec
lui partent le bouton *regarder*, le pour cent, la phrase contradictoire et le renvoi vers
*Découper*. **On ne répare donc pas cette phrase, on la retire**, et le menu perd son bloc le plus
lourd. La question déménage dans le détail d'une palette, là où elle se pose ; son explication —
l'une des meilleures du recueil — part avec elle.

> ⚠️ **Un calcul de plus, à chiffrer avant de le promettre.** L'atelier sait dire **quelle part**
> d'une image a été écartée et **où** elle est. Il ne sait pas dire **quelle couleur** ce fond
> aurait apportée : la palette se calcule après le détourage. La *« couleur exclue »* demandée par
> l'auteur est un calcul neuf, pas un déplacement.

**Et les cinq changements du menu s'y posent en même temps**, parce que les faire deux fois serait
les faire une fois pour rien : les deux réglages voisins deviennent **« Référence de tout le jeu »**
et **« Référence de cette chose »** ; une ligne mesurée dit ce que **cette carte-ci** fera —
mesuré, **quatre désignations sur six ne font rien** dans le dépôt, parce que la carte partait
déjà ; et le pied de carte cesse de taire une désignation quand la carte est aussi promue.

**Et une chose du jeu se crée depuis là — ajouté le 4 septembre 2026.** *« On règle l'univers avant
d'avoir peuplé le codex ; à ce moment-là il n'y a aucun personnage à qui attribuer une image. »*

> ⚠️ **Le geste ne manque pas seulement : il est invisible.** Le bloc *Concept art de* n'existe
> qu'à la condition qu'il y ait au moins une chose du jeu. **Quand le codex est vide, il ne
> s'affiche pas du tout** — pas une liste vide, pas une phrase, pas un grisé avec sa raison :
> rien. L'auteur ne voit pas qu'il ne peut pas désigner, il ne voit pas qu'il *pourrait*. Le motif
> du dépôt — *le grisé porte sa raison* — n'est pas appliqué là où il servirait le plus.
>
> **Mesuré le 4 septembre 2026** : **deux projets du dépôt sur six ont des images sur leur toile
> et aucune chose du jeu à qui les attribuer** — *cœur de pierre* avec **55 cartes**, *bac à
> sable* avec 5. Sur ces soixante cartes, le geste n'a jamais pu être proposé une seule fois.
>
> **Le réglage voisin, lui, s'affiche toujours** : promouvoir en artwork officiel ne demande
> aucune chose du jeu. Les deux sont côte à côte dans le même menu — celui que cette tranche
> refait — et **l'un est toujours là quand l'autre disparaît sans un mot**.

La colonne montre donc le bloc **même quand le codex est vide**, avec sa raison, et **un champ pour
nommer une chose sur place**. Le champ du codex est réemployé tel quel : nommer suffit à créer, et
le serveur pose la famille. La chose naît, la carte lui est désignée dans le même geste, et la
marque apparaît sur la carte — *le geste va où son effet se voit*, et son effet est là.

*Cela ferme une promesse que le Guide fait et que le code ne tient pas* : « nommer, c'est créer,
**partout** ». `G9` la relève par l'autre bout, pour les poses.

**Critères d'acceptation**

- [ ] Cliquer une carte ouvre une colonne de 380 px qui montre son visuel en grand
- [ ] Tous les réglages d'une carte vivent dans la colonne, et à un seul endroit
- [ ] Les explications y sont **lues** dans le recueil, jamais recopiées
- [ ] Sur la toile, le survol n'ouvre plus de menu ; en vue grille, rien ne change
- [ ] La réserve est à gauche, sa bascule est contre elle, et replier n'est toujours pas fermer
- [ ] *Ce que la palette y lit* a disparu de l'écran de l'univers
- [ ] Les deux réglages de référence portent des noms qui se répondent
- [ ] Une ligne dit ce que cette carte-ci fera, y compris *« la désigner n'ajoute rien »* — en constat, jamais en reproche
- [ ] Une carte promue **et** désignée dit les deux dans son pied
- [ ] La règle des bascules et la décision du menu non borné sont réécrites avec leur raison
- [ ] **Le bloc de désignation s'affiche même quand le codex est vide**, avec sa raison — il ne
      disparaît plus en silence
- [ ] Un champ y nomme une chose du jeu **sur place**, et la carte lui est désignée dans le même geste
- [ ] La marque de la désignation apparaît sur la carte sans qu'on ait changé d'écran
- [ ] Le Guide dit vrai : *nommer, c'est créer* vaut aussi ici

**Bloquée par** — `G6` la rend inutile ; les deux peuvent se faire dans l'ordre inverse.

---

### G8 · L'accueil s'ouvre sur chaque jeu neuf
*2 US (500, 501)* · **famille ③**

**Ce qu'on livre.** Créer un jeu ouvre l'assistant, et ses douze étapes se coupent en deux.

**Mesuré sur les six projets de l'auteur** : **trois n'ont ni vue ni bible** — exactement ceux où
l'assistant ne s'est jamais ouvert. Le barème a été touché **une fois sur quarante-quatre
rangées**. Et trois étapes sur douze n'ont **jamais servi**, dans aucun projet.

**Ce que ça révise.** Une décision écrite dit que créer un second jeu *« referme la porte, et c'est
exactement quand elle doit se refermer »*. Sa raison reste juste pour ce qu'elle visait — ne pas
rouvrir l'assistant sous les doigts de quelqu'un qui travaille. **Elle n'avait pas examiné le jeu
neuf créé plus tard**, qui est aussi vide que le premier. La règle devient : *l'assistant s'ouvre
sur un jeu qui n'a rien*.

**Le partage des douze étapes n'est pas une opinion, il sort de la mesure.** Ce qu'on sait en
commençant — le nom, le style, la vue, la taille, les poses, les emplacements. Ce que le produit
décide déjà bien tout seul, replié — les types, les modèles, le détourage, la façon de réduire, les
fournisseurs. **Chacune des repliées porte déjà, dans son explication, la phrase qui dit que son
défaut est bon.**

**Critères d'acceptation**

- [ ] Créer un projet ouvre l'assistant
- [ ] Un jeu qui n'a rien ouvre l'assistant ; un jeu où l'on travaille ne le voit jamais s'ouvrir seul
- [ ] Les douze étapes sont réparties en deux groupes, le second replié derrière une ligne qui dit pourquoi il peut attendre
- [ ] **Aucune étape ne disparaît** : la page des réglages reste entière
- [ ] **Rien n'est exigé pour commencer** : l'accueil ne ressemble pas à un formulaire à remplir
- [ ] La décision de la porte qui se referme est réécrite avec sa nouvelle raison

**Bloquée par** — aucune.

---

### G9 · Démarrer la première pose
*Aucune US neuve — US-189 rouvre* · **famille ④**

**Ce qu'on livre.** Sur un projet neuf, on voit par où commencer. Aujourd'hui le bouton qui lance
tout ressemble à trois liens gratuits, et **trois documents — dont le guide du produit — promettent
que nommer une chose ouvre son établi**, ce que le code ne fait pas.

**Critères d'acceptation**

- [ ] Nommer une chose ouvre son établi, et Échap remonte au codex
- [ ] Une ligne de pose vide arme l'atelier sur cette pose
- [ ] Le codex propose **une pose seule** d'abord, qui sert ensuite de référence aux autres
- [ ] La phrase d'accueil se lit dans le recueil, et disparaît dès la première image
- [ ] Le guide du produit cesse de promettre ce que l'écran ne fait pas
- [ ] US-189 est rouverte : elle était comptée livrée, et son geste n'existait pas

**Bloquée par** — aucune.

---

### G10 · Le zoom des tables monte
*Aucune US neuve* · **famille ④**

**Ce qu'on livre.** Le zoom des tables cesse de plafonner à 250 %. Le plafond devient **une règle
et non un nombre** — 32 pixels d'écran par pixel d'image, avec un plancher —, ce qui le rend juste
sur une image de 16 px comme sur une de 1 024.

**Et *ajusté* cesse de mentir.** Il promet de remplir le cadre et **échoue sur 73 des 118 images du
dépôt**, parce qu'il passe par le même plafond que le zoom manuel.

**Critères d'acceptation**

- [ ] Le plafond s'adapte à l'image ; *ajusté* remplit le cadre quelle que soit la taille
- [ ] Le champ dit son maximum pendant qu'on tape
- [ ] Le damier grossit avec le zoom, et un quadrillage sourd paraît au-delà d'un seuil
- [ ] Les trois textes qui citaient l'ancien plafond sont corrigés

**Bloquée par** — aucune.

---

### G11 · Éteindre un type d'objet
*2 US (495, 496)* · **famille ④** · **le seul point de la version qui touche au disque**

**Ce qu'on livre.** Un type d'objet s'éteint sans se supprimer — comme une table de la recette
s'éteint sans se vider. Il reste dans le barème, ses réglages sont gardés, il cesse d'être proposé
au moment de fabriquer. *Un jeu de plateforme n'a que faire de « meuble » et d'« objet posé ».*

> ⚠️ **Éteindre ne retire pas du barème, et c'est essentiel.** Une image déjà fabriquée porte le nom
> de son type, et le serveur refuse un nom qu'il ne trouve plus. Un type éteint doit rester
> résoluble, sans quoi l'éteindre casserait des images anciennes.

**Et ça débloque un défaut mesuré.** Tant qu'on ne pouvait rien retirer, ajouter les types manquants
à un vieux projet lui imposait des rangées dont il n'a que faire. Une fois qu'on peut éteindre, **un
projet reçoit les types entrés après sa création** — le projet principal de l'auteur en porte sept
là où le produit en livre huit, et sa bible en porte cinq là où les autres en ont sept.

**Critères d'acceptation**

- [ ] Un type éteint ne paraît plus dans le choix du sujet, et ses réglages sont gardés
- [ ] Une image fabriquée avec un type depuis éteint reste lisible et relançable
- [ ] Un projet reçoit les types du barème livré entrés après sa création
- [ ] Le bouton *+ type sur mesure* reste éteint et porte une raison qui dit vrai

**Bloquée par** — aucune. *Se pose avec `G1`, qui corrige la phrase de ce bouton.*

---

### G12 · Une recette sur plusieurs images
*2 US (497, 498)* · **famille ④** · **et un défaut à réparer avant**

**Ce qu'on livre.** Une recette nommée se pose sur une sélection d'images en un geste, depuis la
colonne des sœurs — l'ensemble qu'on a déjà sous les yeux.

> ⚠️ **Un défaut se répare d'abord.** Poser une recette nommée peut réécrire en silence un réglage
> de bord que l'auteur avait posé à la main, ce qui contredit un critère d'acceptation déjà livré.
> *Sur une image à la fois, on le verrait. Sur trente, non.*

**Ce qui protège le travail fait à la main.** Un liseré orange sur les images déjà retouchées à la
main, avec une légende et un bouton pour toutes les désélectionner. Un liseré rouge, non
sélectionnable, sur **les calques que la recette choisie décalerait** — et **seulement pour ces
recettes-là** : mesuré place par place, la grille et le recadrage décalent un calque, la
quantification et les contours ne lui font rien. Les liserés se recalculent quand on change de
recette.

**Ce qui n'a pas voyagé se dit une fois pour le lot**, pas trente fois.

**Critères d'acceptation**

- [ ] Le défaut du bord réécrit en silence est réparé **avant** que la pose en lot existe
- [ ] La colonne des sœurs porte un zoom, et une sélection au clic
- [ ] Un sélecteur de recette et un bouton *appliquer* au pied de la colonne
- [ ] Liseré orange sur les images retouchées à la main, légende, et bouton pour les désélectionner
- [ ] Liseré rouge et non sélectionnable sur les calques que **la recette choisie** décalerait, recalculé à chaque changement de recette
- [ ] Ce qui n'a pas voyagé est dit une fois pour tout le lot
- [ ] Une route serveur qui prend une liste, pour ne pas sérialiser trente appels
- [ ] L'invariant de la grille unique est amendé : la colonne des sœurs est une quatrième surface

**Bloquée par** — aucune. *`G5` se pose dans le même panneau.*

---

### G13 · Le modèle « lourd » ne détoure rien
*Aucune US neuve* · **les trois défauts**

**Ce qu'on livre.** Le catalogue des modèles de détourage cesse de proposer un modèle qui ne fait
rien. **Vérifié le 3 septembre 2026** : la bibliothèque installée ne connaît pas ce nom-là et
**retombe sans rien dire sur le rapide** — 100,00 % d'accord entre les deux résultats, à la
milliseconde près. L'écran annonce pourtant *« plusieurs secondes par image »*, et **973 Mo dorment
sur le disque dans un dossier que rien n'ouvre**.

**Ce qui reste à trancher** : retirer le modèle du catalogue, ou exiger la version de bibliothèque
qui le connaît. La dépendance est déclarée sans borne haute, donc rien n'oblige une machine à porter
la version sur laquelle les mesures ont été faites.

**Critères d'acceptation**

- [ ] Aucun modèle proposé ne rend silencieusement le résultat d'un autre
- [ ] Un modèle que la bibliothèque installée ne connaît pas est grisé avec sa raison, jamais proposé
- [ ] Le poids annoncé et la lenteur annoncée correspondent à ce que le modèle fait vraiment

**Bloquée par** — aucune. *À arbitrer avant d'être construite.*

---

### G14 · Le calage horizontal effacé en silence
*Aucune US neuve* · **les trois défauts**

**Ce qu'on livre.** Un calage patiemment ajusté cesse de disparaître au premier cran de curseur.
**Vérifié par la route** : le décalage n'est écrit que par le calibrage, et la charge de l'écran ne
le porte pas — reposer n'importe quel réglage de la grille le remet donc à zéro, sans un mot.

**Critères d'acceptation**

- [ ] Reposer un réglage de grille ne remet aucun calage à zéro
- [ ] Un calage ne se perd jamais sans que l'auteur l'ait demandé

**Bloquée par** — aucune. *À arbitrer avant d'être construite.*

---

### G15 · Sans artwork officiel, aucune couleur n'est réduite
*Aucune US neuve* · **les trois défauts**

**Ce qu'on livre.** L'atelier cesse de laisser sortir un sprite à dix mille couleurs sans le dire.
La réduction de couleurs n'entre que s'il existe une palette, et **la palette se déduit des artworks
officiels et d'eux seuls** — pas d'artwork déposé, donc pas de palette, donc aucune réduction, et
rien ne le signale.

**Ce que ça demande.** L'annoncer, proposer de choisir une image de l'univers, et renvoyer vers un
chapitre du guide qui explique comment fabriquer les artworks d'un personnage — **ce chapitre
n'existe pas**.

> Un auteur qui a désigné des concept arts et promu zéro carte n'a **aucune palette**, et croit
> avoir donné ses couleurs à son jeu. C'est le même fait que `G7` prend par l'autre bout.

**Et le mur tombe : une image de la galerie peut être promue — ajouté le 4 septembre 2026.**

> ⚠️ **Une image que l'atelier a fabriquée et payée ne peut pas donner ses couleurs au jeu.**
> Mesuré le 4 septembre 2026 : promouvoir en artwork officiel **se pose sur une carte** de la
> toile, et rien d'autre n'est promouvable ; une image fabriquée est un **asset**, elle vit dans la
> galerie ; **aucun geste ne fait passer l'un dans l'autre, dans un sens ni dans l'autre.** Et une
> carte ne naît que de quatre collages — un fichier, une adresse, un texte, le découpage d'une
> carte déjà là : **aucun ne passe par un fournisseur.**
>
> Le seul chemin existant est de **télécharger l'image puis de la redéposer** sur la toile, ce qui
> fabrique une seconde copie du même fichier dont l'atelier ne saura plus qu'elle vient de lui.

La tranche l'ouvre : **une image de la bibliothèque se promeut en artwork officiel**, exactement
comme une carte. Rien ne bouge sur la toile, rien ne se duplique, et la palette gagne les images que
l'atelier sait faire. *C'est ce qui donne une réponse au cas que le reste de la tranche ne couvre
pas* : proposer de **choisir** une image de l'univers suppose qu'il y en ait une, et cette
remarque-ci est née du cas où il n'y en a aucune.

> **Deux tiers de la remarque d'origine n'ont rien à construire, et il faut le dire.** L'auteur
> demandait aussi *« que la description du personnage vive quelque part »* et *« pouvoir composer
> des prompts sur mesure et fournir différentes références »*. **Les deux existent** : la
> description est un champ de la chose du jeu, qui part dans chaque appel la concernant et que le
> geste *garder cette correction sur la chose* écrit ; la composition d'un prompt avec plusieurs
> références **est le cœur du produit**. Ce qui manque n'est pas de les construire, c'est que
> l'auteur ne sache pas qu'ils existent — **et c'est le sujet de cette tranche-ci**, qui est celle
> qui dit ce que le produit fait.
**Critères d'acceptation**

- [ ] Un projet sans artwork officiel le dit avant qu'une image en sorte
- [ ] Le produit propose de promouvoir une image de l'univers depuis l'endroit où le manque se voit
- [ ] Le guide gagne le chapitre qui explique comment fabriquer les artworks d'une chose
- [ ] Rien ne réclame : le manque s'annonce, il ne s'excuse pas
- [ ] **Une image de la bibliothèque se promeut en artwork officiel**, et compte dans la palette
      exactement comme une carte promue
- [ ] Elle ne se duplique nulle part : aucun fichier de plus sur le disque
- [ ] La promotion dit la même chose des deux côtés — sur une carte et sur une image — **et un
      essai le tient**
- [ ] Le manque annoncé propose **les deux** chemins : choisir une image de l'univers, ou en
      fabriquer une

#### L'arbitrage, commencé le 3 septembre 2026 puis arrêté

> **Rien n'a été construit, et c'est voulu** : la V3.1 est deux versions plus loin que ce qui est
> ouvert — la V2.3 est close depuis le 3 septembre 2026, et la V3 n'est pas ouverte. Ce qui
> suit est **mesuré**, et n'attend que d'être relu le jour où la tranche s'ouvrira pour de bon.

**Le titre de la tranche est faux, et il faudra le réécrire.** « Sans artwork officiel, aucune
couleur n'est réduite » a cessé d'être vrai en `D2`. Ce qui commande la réduction est désormais le
**style** du jeu et l'existence d'une **taille de carrés** — plus la palette : `Univers.recette_de`
pose une quantification dès qu'un jeu est en pixel art et porte une cible, avec ou sans artwork.

> **Mesuré.** Un jeu en pixel art, 64 carrés de côté, 32 couleurs demandées, **zéro artwork
> officiel** : une image de **65 536 teintes en ressort avec 32**. Le sprite à dix mille couleurs
> que la tranche veut empêcher **ne peut plus sortir**.

**Les deux cas où rien n'est réduit sont des décisions, pas des défauts**, et aucun des deux ne
dépend de l'artwork : un jeu **en dessin** — le réduire en ferait une affiche sérigraphiée, et
`Univers.recette_de` le dit en toutes lettres —, et un jeu **sans taille de carrés**, où il n'y a
pas de sprite du tout.

**Ce qui reste vrai est plus petit, et mérite quand même la tranche.** Sans artwork officiel il n'y
a **pas de palette commune** : chaque image invente son propre vocabulaire de couleurs, et le jeu ne
parle donc pas d'une seule voix. C'est *ce fait-là* que la tranche doit annoncer — pas l'absence de
réduction, qui n'existe plus.

| Critère | Ce qui est déjà là, mesuré |
| --- | --- |
| ① le dire avant qu'une image sorte | **à moitié.** L'assistant le dit, et branche même sur le style — deux phrases, l'une pour le pixel art, l'autre pour le dessin. **Les tables disent autre chose** : *« ce jeu n'a pas de palette — l'univers en déduit une des artworks officiels »*, une promesse de mécanisme là où il faudrait la conséquence, et sans branche de style. Le serveur, lui, rend déjà `traitement.quantification.note` — **et personne ne la lit** : le champ existe depuis `D2` et aucun écran ne s'en sert. Son texte ne branche pas non plus sur le style, alors que l'écran, si : c'est le piège *« une phrase exacte dans un mode devient un mensonge dans l'autre »* en germe |
| ② proposer de promouvoir une image | **pas fait.** Les deux phrases existent, **aucune n'est cliquable**. Le chemin se copie sans rien inventer : `Raison` porte déjà `ouAller` / `onAller`, et `EcranUnivers` porte déjà `onAllerAuxAmbiances`, qui fait exactement ce geste vers un autre côté. Il manque le jumeau vers le côté Inspiration, descendu jusqu'à l'assistant **et** jusqu'à la table de quantification |
| ③ le chapitre du guide | **pas fait.** Le guide a deux parties — *Le geste* (six temps) et *Les lieux* (quatre) — et son chapitre `L'univers` nomme le tableau d'inspiration sans dire un mot de la promotion en artwork officiel, ni de ce qu'elle change |
| ④ rien ne réclame | **tenu** partout où le manque se dit aujourd'hui |

> ⚠️ **Un défaut trouvé en chemin, dans le panneau même qu'il faudra réécrire.** La table de
> quantification propose **4 · 8 · 16 · 32 · 64** couleurs. Le projet, lui, compte depuis `D2` en
> **8 · 16 · 32 · 64 · 128 · 256**, plafonnés par le côté du sprite. Un jeu réglé à 128 couleurs
> ouvre sa table et **n'y voit aucun segment allumé** — la comparaison est stricte —, et le premier
> clic écrase son réglage sans un mot. `paliersDeCouleurs(univers.cible_px)` existe déjà et rend la
> bonne liste ; il faudra la seconde rangée, comme la cible de la table de grille.

> ⚠️ **Ce que la promotion d'une image laisse ouvert.** Un artwork officiel porte une **famille**, qui décide avec quelles générations il part. Une carte en a une ; une image de la bibliothèque porte autre chose — un personnage, une pose, une pièce. *À trancher en construisant : la déduire de la chose du jeu à laquelle l'image appartient est la piste évidente, elle n'est pas vérifiée.*

**Bloquée par** — aucune, mais **elle ne se prend pas maintenant** : c'est la V3.1, et la V3 passe
devant — la V2.3 est close depuis le 3 septembre 2026. *L'arbitrage ci-dessus est fait ; il reste
à trancher le nouveau titre et à construire.*

---

### G16 · Ce qui est revenu du modèle se voit, et se reprend à la main — ✅ **livrée le 3 septembre 2026**
*3 US — `US-369` reprise à `P1`, `US-502` et `US-503` neuves* · **familles ② et ④**

> **Prise hors tour, le 3 septembre 2026, à la demande de l'auteur.** La V2.3 attendait alors `D3`
> et `D4`, et la V3 n'est pas ouverte : cette tranche passe devant en vertu de la seule permission que la
> version se donne — *si une gêne devient insupportable à l'usage, sa tranche se prend seule, sans
> rien déplacer*. Rien d'autre ne bouge, et l'ordre des autres tranches est intact.

**Le défaut, en clair.** Quand une pièce d'équipement revient du modèle, l'atelier ne range pas ce
qu'il a reçu : il le compare au corps de la pose, en déduit le vêtement seul, et c'est ce
vêtement-là qui entre en bibliothèque. **L'image payée, elle, reste sur le disque sans aucune porte
pour l'ouvrir.** L'auteur ne voit donc jamais ce qu'il a acheté. Et quand le calage automatique
tombe mal, il ne peut pas le refaire : la table de superposition existe, mais elle ne travaille
qu'avec deux images qu'on lui nomme, et la seule qu'on puisse lui donner aujourd'hui est **le
résultat** du calage qu'on voudrait justement défaire.

**Ce qu'on livre**, et les quatre morceaux tiennent ensemble parce qu'ils reposent tous sur la même
image — celle que le modèle a renvoyée :

1. **La planche revenue entre dans la galerie**, comme une image à part entière : elle se cherche,
   s'ouvre en grand, se met en favori, s'exporte, et elle porte sa génération et son coût.
2. **La carte d'une pose d'équipement gagne une bascule *calque* / *brut***, dans la colonne de
   droite de la fiche du personnage : on voit le vêtement découpé, ou **la case telle qu'elle est
   arrivée**, sans quitter l'écran ni perdre ce qu'on était en train de régler. La carte parle
   d'une pose, elle montre donc la case de cette pose ; la planche entière se regarde dans la
   galerie.
3. **Un bouton *superposition* sur cette même carte** ouvre la table qui existe déjà, **remplie des
   deux bonnes images** : la case telle qu'elle est arrivée en dessus, le corps de la pose en
   dessous. On y refait le calage, le seuil, la zone, à la main.
4. **Valider fabrique un second vêtement à côté du premier**, sans toucher au premier. Les deux
   coexistent, on compare, on supprime le moins bon. *Choix de l'auteur le 3 septembre 2026, contre
   le remplacement — qui était l'autre option, et qui aurait fait perdre l'ancien résultat.*

**Ce qui la rend courte, et ce n'est pas une impression.** L'adresse qui sert l'image renvoyée
**existe et fonctionne** — elle n'est branchée sur aucun écran qu'on puisse atteindre, ce qui est le
cas d'école de la famille ②. Le recalcul d'une case à partir de la planche **existe aussi** : c'est
ce que fait le rejeu du recalage, qui sait déjà refuser proprement quand la planche a quitté le
disque. Et une image sans recette s'affiche déjà par l'adresse de son emplacement plutôt que par son
rendu. Il n'y a donc ni fichier neuf, ni migration, ni calcul neuf : **il y a des portes à poser sur
ce qui est là**.

**Quatre décisions durables.**

- **Rien de plus sur le disque.** La case telle qu'elle est arrivée se **recalcule** de la planche,
  elle ne se range jamais. C'est la règle du rejeu du recalage, réemployée sans une ligne de plus —
  et c'est ce qui évite de dupliquer chaque équipement en bibliothèque.
- **Aucune adresse neuve pour la planche.** Celle des images d'une génération la sert déjà.
- **La planche entre sans recette**, comme une image importée telle quelle : ce n'est pas un sprite,
  on ne la met ni sur grille ni en palette, et la nature *morceau de planche* continue de ne
  désigner que ses morceaux. **Aucune troisième nature ne s'ouvre**, et la phrase du dépôt qui
  l'affirme reste vraie.
- **Aucun appel, aucun centime.** Tout se recalcule de ce qui a été payé une fois, et la tranche
  entière se vérifie réseau coupé.

**Le mot *brut* cesse de désigner deux choses en silence.** Sur un corps habillé, *brut* est la case
telle qu'elle est arrivée ; sur un vêtement, c'est la case **déjà mise à l'échelle et calée sur le
corps**. Deux images d'une même planche, deux sens du même mot, et rien à l'écran ne dit lequel on
regarde — c'est ce qui a fait écrire à l'auteur *« le brut semble prendre souvent le calque déjà
découpé »*, et il avait raison. La tranche ne refait pas le rangement : elle **dit**, sur la bascule
et sur la table, ce que chacun des deux montre. *Faire que les deux bruts soient la même chose est
un autre sujet, et il n'est pas ouvert ici.*

> ⚠️ **Ce que cette tranche prend à `P1`, et ce qu'elle lui laisse.** `US-369` — *« retrouver la
> planche entière dans ma galerie »* — quitte `P1` et arrive ici ; le critère correspondant a été
> retiré de sa liste, qui le dit. `P1` garde tout son vrai sujet : **refaire un découpage à la
> main**, plusieurs découpages qui coexistent, la filiation de chaque image jusqu'à son découpage, et
> la suppression qui ne casse rien. *Elle n'en est ni raccourcie, ni avancée d'un jour.*

**Critères d'acceptation**

- [ ] Une planche revenue apparaît dans la galerie comme une image, avec sa génération et son coût
- [ ] Elle se cherche, s'ouvre en grand, se met en favori et s'exporte comme n'importe quelle image
- [ ] Elle porte un nom qui dit ce qu'elle est et de quelle demande elle vient
- [ ] **Elle n'hérite d'aucune recette** : ni grille, ni réduction de couleurs, ni détourage du projet
- [ ] La carte d'une pose d'équipement porte une bascule *calque* / *brut*, et l'écran dit lequel des deux il montre
- [ ] Sur cette carte, *brut* montre **la case de cette pose**, telle qu'elle est arrivée — pas la planche entière
- [ ] Basculer ne perd rien de ce qui était en cours de réglage sur la carte
- [ ] Un bouton *superposition* sur cette carte ouvre la table **déjà remplie** : la case telle qu'elle est arrivée en dessus, le corps de la pose en dessous
- [ ] La case telle qu'elle est arrivée se recalcule de la planche — **aucun fichier neuf, aucune migration**
- [ ] Valider fabrique un **second** vêtement à côté du premier, et ne touche pas au premier
- [ ] La fiche du personnage dit lequel des deux compte pour cette pose, et laisse en changer
- [ ] Supprimer l'un des deux ne touche ni à l'autre, ni à la planche
- [ ] Une planche qui a quitté le disque **refuse** le geste avec sa raison, au lieu de l'offrir et d'échouer
- [ ] Aucun appel au fournisseur, aucun centime : la tranche entière se vérifie réseau coupé

> ⚠️ **Ce qu'elle laisse à `P1`, et qui se voit à l'usage dès maintenant.** Supprimer une
> planche depuis la galerie efface son fichier — c'est la règle du produit depuis T3, *pas
> d'image sur le disque, pas d'asset*. Le recalage et la case arrivée refusent alors **avec
> leur raison**, proprement ; mais l'auteur ne sait pas, au moment où il supprime, combien
> d'images en dépendent. C'est mot pour mot le critère de `P1` — *supprimer la planche
> demande confirmation et dit combien d'images en dépendent* —, et il reste chez elle.

**Bloquée par** — aucune.

---

## V3.5 — Le dépliage généralisé

*Née le 3 septembre 2026 du recadrage de la V3. Elle ne fabrique rien de neuf : **elle divise le
prix de tout ce que le produit fabrique déjà.***

**Ce qu'elle est, en clair.** Demander huit images à un modèle coûte huit appels. Demander **une
grande image qui en contient huit** coûte un appel, et l'atelier la découpe. C'est le pliage, et
il existe depuis `C2`. Ce qui manque n'est pas le pliage : c'est **le retour en arrière** quand le
découpage tombe mal, et **l'ouverture** de la technique aux objets, aux décors et à tout ce qui
viendra.

**Pourquoi après la V3.** *Tranché par l'auteur le 3 septembre 2026.* L'animation est l'objectif
de la V3 et le dépliage n'y sert plus. Il ne bloque rien et ne dépend de rien : il se prend en
entier dès la V3 tenue.

**Ce qu'elle hérite de la V3.** Le gain mesuré au banc des planches, qui ne sert plus l'animation :
une grille de **quatre colonnes sur deux rangées** bat le 3×3 à case vide. Avec sa précaution —
**la géométrie devra s'écrire sur le pliage le jour où la formule change**, sinon toutes les
planches anciennes se redécouperaient sur une grille sur laquelle elles n'ont pas été dessinées.

---

### P1 · La planche se garde, et son découpage se refait
*5 US (370–374)* · **ex-`A1`, sortie de la V3 le 3 septembre 2026**

> **Tranché par l'auteur le 2 septembre 2026, et ça reste vrai.** Le dépliage **reste
> automatique** : une planche revient, elle est découpée toute seule, les images entrent en
> bibliothèque — exactement comme aujourd'hui, et sans un geste de plus. Ce qui s'ajoute, c'est le
> **retour en arrière**. *Le coupable n'a jamais été « automatique », c'était « sans retour ».*

> **La première moitié de sa phrase d'ouverture est déjà livrée**, par `G16`, le 3 septembre
> 2026 : la planche entre en bibliothèque et s'y regarde. Ce qui reste — et c'est le vrai sujet de
> la tranche — est **le retour en arrière** sur son découpage. `US-369` est partie avec.

**Ce qu'on livre.** Ce qui a été payé cesse d'être jeté après usage. La planche entre dans la
bibliothèque et **elle y reste** — *fait en `G16`*. Son premier découpage se fait tout seul. Quand il tombe mal — et
c'est le cas qui coûte cher —, l'auteur le **refait** : l'atelier repropose ses coupes, l'auteur
les corrige — déplacer, ajouter, retirer un rectangle —, et valide. Autant de fois qu'il veut.
Chaque image sortie porte de quelle planche et de quel découpage elle vient, et l'on peut
supprimer les images d'un découpage sans toucher ni à la planche, ni aux autres.

**Le geste ordinaire ne coûte rien de plus qu'aujourd'hui** : refaire un découpage est un geste
**qu'on demande**, jamais une étape qu'on traverse. Un écran de validation posé sur chaque planche
revenue aurait fait payer à toutes les générations le prix des rares qui tombent mal.

**La moitié de la machinerie existe déjà**, et c'est ce qui rend la tranche courte : le découpage
manuel sépare exactement ces deux gestes — proposer des rectangles, couper ceux qu'on lui donne —,
et l'asset porte déjà une filiation de découpe. Ce qui manque est que le **pliage** emprunte ce
chemin-là au lieu du sien.

**Et la reprise au redémarrage ne change pas.** Une planche payée et reçue que la fermeture a
laissée non dépliée se déplie au démarrage, gratuitement et sans rien demander — c'est la règle de
`C2`.

**Critères d'acceptation**

- [ ] **Le premier dépliage reste automatique** : une planche qui revient bien ne demande aucun geste, ni avant ni après
- [ ] **La géométrie s'écrit sur le pliage** au lieu d'être déduite du nombre de cases — sans quoi changer la formule redécouperait les planches anciennes de travers
- [ ] Refaire un dépliage est un geste que l'auteur demande, et il repart des coupes proposées
- [ ] Une coupe se déplace, s'ajoute et se retire à la main avant de valider un dépliage refait
- [ ] Une planche se déplie plusieurs fois ; les dépliages coexistent sans se marcher dessus
- [ ] Chaque image dit sa planche et son dépliage d'origine, et se remonte jusqu'à eux
- [ ] Supprimer un dépliage n'emporte ni la planche ni les autres dépliages
- [ ] Supprimer la planche demande confirmation et dit combien d'images en dépendent
- [ ] Une planche reçue mais non dépliée à la fermeture se déplie seule au redémarrage, comme depuis `C2`
- [ ] Aucun appel au fournisseur : déplier une planche déjà là marche réseau coupé

**Bloquée par** — aucune. *`R6` l'attendait ; elle est close depuis le 3 septembre 2026.*

---

### P2 · Une planche pour plusieurs choses
*4 US (491–494)* · **et un invariant à lever d'abord**

**Ce qu'on livre.** La planche cesse de ne servir qu'un seul sujet. On commande **huit objets
différents en un appel** — des potions, des clés, des pièces d'équipement, des tuiles de décor —,
et l'atelier les découpe et les range chacun à sa place. C'est ce qui divise par huit le prix d'un
inventaire.

> ⚠️ **Un invariant du produit s'y oppose aujourd'hui, et il faut le lever explicitement.** *Une
> planche ne porte qu'une seule chose du jeu*, posé en `E13`. Il avait une raison : une planche
> qui mélange les sujets rend le rangement ambigu — on ne sait plus quelle case chaque morceau
> remplit. **Cette tranche ne le lève qu'en apportant la réponse** : la demande dit d'avance ce
> que chaque case contient, dans l'ordre, et le découpage s'y réfère. Sans cette liste, on garde
> l'ancienne règle.

**Ce qui reste à trancher, et qui se décidera à l'ouverture de la version** — écrit ici pour que
personne ne croie la question réglée :

- **Ce que devient une case ratée** dans une planche de huit sujets. Refaire les huit, ou refaire
  la case seule dans une planche de un ?
- **Comment on désigne huit sujets en un texte** sans que le modèle les mélange. Le banc des
  planches a mesuré que *ce qu'on montre, le modèle le copie en entier* ; rien ne dit ce qu'il
  fait d'une liste de huit sujets différents.
- **Jusqu'où ça monte.** Les décors et les tuiles se raccordent entre eux, ce qui est le sujet de
  la V4. La frontière entre « huit objets sur une planche » et « des tuiles qui se raccordent »
  n'est pas tracée.

**Critères d'acceptation**

- [ ] Une planche peut porter **plusieurs choses différentes du jeu**, et la demande dit d'avance ce que chaque case contient
- [ ] Le découpage range chaque morceau à la place que la demande annonçait
- [ ] Une case dont le sujet n'est pas celui annoncé **se signale** au lieu de se ranger de travers
- [ ] Le prix par sujet s'affiche avant l'envoi, à côté du prix de la planche
- [ ] L'ancienne règle continue de s'appliquer aux planches qui ne portent pas cette liste
- [ ] Refaire le découpage d'une telle planche marche comme en `P1`

**Bloquée par** — `P1`.

---

## Ce que ce plan ne couvre pas

La **V4** — les tuiles qui se raccordent — et la **V5** — le son — sont décrites dans
`docs/archi-versions.md` §9 et §10, et ne sont pas découpées ici.

### Le pantin — sorti de la V3 le 3 septembre 2026, arguments intacts

*Ex-`A8`, 6 US (401–406), aucune ligne écrite. **Tranché par l'auteur** : la V3 ne fait qu'une
chose, animer par la vidéo, et le pantin est une seconde façon de faire la même chose.*

**Ce que c'était.** On obtient les pièces d'un personnage à partir d'une de ses images, l'atelier
y pose un squelette tout seul, on applique un mouvement de la bibliothèque, et l'on obtient une
bande **sans payer un seul appel**. Les pixels de chaque image sont ceux du sprite d'origine,
déplacés : le personnage ne peut donc pas changer de taille d'une image à l'autre, et il n'y a
plus de tirage.

**Pourquoi il sort, et ce n'est pas parce qu'il est mauvais.** Il était la finale de la version
tant qu'il était **le seul moyen d'animer sans payer**. `A11` l'est aussi, sur la même machine,
sans squelette, sans maillage et sans découpage en pièces. Ce qui reste en propre au pantin :
**la même bande redemandée revient identique à l'octet**, et **une animation de plus ne coûte
rien du tout, pas même deux minutes d'attente**. C'est vrai, et ça ne vaut pas six chantiers dans
une version dont l'objectif est d'animer par la vidéo.

**Ce qu'il faudrait savoir avant de le reposer**, et les deux questions ne coûtent rien : *un
membre plié survit-il à la réduction en pixels ?* et *à quelle amplitude le pantin casse-t-il ?*
La seconde peut supprimer la moitié du travail — si une marche et une attaque de profil passent
sans découvrir de zone cachée, toute la décomposition en pièces devient facultative.

**Et trois choses acquises qu'il ne faut pas reperdre.** L'ordre des opérations est décidé —
**déformer en grand format, pixeliser à la fin** —, trois preuves indépendantes le disent, et le
problème n'est pas la rotation mais **quantifier la géométrie trop tôt**. Le dépôt de référence
libre est **archivé depuis septembre 2025** : on recopie l'algorithme, on n'en fait pas une
dépendance. Et le squelette a un **format éprouvé à reprendre** — seize articulations, trois
champs chacune (`docs/bilan-v3.md` § 4). *Ce qu'il ne remplacera jamais, et c'était écrit
d'avance : il ne fait bouger que ce qui est déjà dessiné. Une marche de profil, oui ; un
demi-tour, une main qui se retourne, un visage qui change d'expression, non.*

**Et une version d'édition viendra, sans rang fixé.** Le dessin à la main reste jusque-là ce
qu'il est : un pinceau d'un seul pixel. *Tranché par l'auteur le 2 septembre 2026 — « on ne les
fait pas, il y aura plus tard une version avec éditeur. »* Le trait droit, le rectangle, le pot
de peinture et la symétrie avaient été proposés comme un ajout léger à la table de retouche ; ils
sont **écartés du plan actuel**, et pour une raison qui vaut d'être gardée : chacun paraît petit
isolé, et les prendre un par un fabriquerait un demi-éditeur que personne n'aurait décidé.
**Aucune tranche du plan ne présuppose leur existence.**

**Et une piste ouverte par la V3 elle-même, à essayer après elle : fabriquer les poses fixes
avec le moteur de la maison.** *Idée de l'auteur, 3 septembre 2026, notée dans
`docs/remarques/journal.md`.*

Fabriquer une image d'asset en local n'a jamais donné de résultat gardable — c'est pour ça que
les images passent par des modèles payants. Mais `A11` établit qu'**animer** en local marche et
ne coûte rien (`docs/recherche-video-locale/rapport.md`). Or une machine qui sait animer un
sprite sait produire des images de ce sprite **sous un autre angle ou dans une autre attitude** :
on demanderait un clip — *tourne-toi*, *meurs*, *lève le bras* —, et l'on irait y **prélever la
case** qui convient. Un clip de dix secondes qui enchaîne plusieurs mouvements donnerait, en
théorie, plusieurs poses pour un seul temps de calcul.

**C'est lent — dix à trente minutes le clip sur une carte de 8 Go — et c'est précisément le
point** : sur ce sujet, le seul chiffre qui compte est que ce soit gratuit. Le payant ne coûte
pas cher au clip, il coûte de **devoir compter**.

**Ce qui n'est pas acquis, et qui décidera** : une case tirée d'une vidéo est-elle assez nette et
assez fidèle au personnage pour tenir comme pose officielle, là où l'animation pardonne le flou
parce que ça défile ? C'est la question que le banc animé n'a pas eu à poser. **Aucune tranche du
plan ne présuppose la réponse**, et l'ouvrir demande que le moteur de la maison existe et ait
servi. **Sa moitié utilisable est devenue une tranche** : `A13` donne le geste pour attraper une
image d'un clip et la faire entrer en bibliothèque. Ce qui reste ouvert n'est plus le geste, c'est
la qualité — et c'est l'usage d'`A13` qui y répondra.

**Et seize questions de la V2.1 restent ouvertes**, chacune avec ce qui manque pour y répondre
et l'étape où elle se pose : `docs/v21-arbitrages.md` § B. Aucune n'empêche d'ouvrir l'étape qui
la porte — ce sont des questions qui se tranchent **à l'usage**, et c'est délibéré : les
trancher d'avance, c'est décider sans mesure.

**Quinze choix tranchés seuls pendant le lot U attendent l'auteur** dans
`docs/questions-du-lot-U.md`.

### Les trois risques encore ouverts

Aucune tranche ne les présuppose.

- **La différence trouve ce qui s'ajoute, et manque ce qui se substitue.** C'est le risque de
  méthode qui reste en V2. Une pièce qui déborde de la silhouette est trouvée entière ; une
  pièce qui remplace ce qu'il y avait à sa place — un casque sur une chevelure, même empreinte,
  valeurs voisines — est effacée avec le bruit que la comparaison de couleur est faite pour
  absorber. Le cadrage oppose *contenue* et *qui agrandit* ; ce qui décide est *ajoute* contre
  *substitue*, et les deux découpes ne se recouvrent pas.
  *(**C4 l'a rattrapé sans le supprimer** : la retouche au pixel ramène ce que la mesure n'a pas
  vu. Ce qui reste ouvert est la **détection** — le produit ne dit toujours pas d'avance qu'une
  pièce va se substituer. Le risque a changé de gravité, pas de nature : il coûte désormais un
  geste, plus une image illisible.)* — `docs/releve-usage.md`.
- **La quantification reste liée à la palette.** Un projet qui choisit « aucune » comme taille
  de pixel reçoit encore ses images ramenées sur la palette dès qu'un artwork officiel existe :
  pour qu'elle se taise, il faut n'en promouvoir aucun. Limite acceptée le 28 août 2026 plutôt
  qu'oubli. Si une séance montre qu'un projet veut la palette **sans** la quantification, c'est
  un réglage de plus dans le même bloc, pas une tranche.
- **Le coût croît avec le nombre de références chez certains fournisseurs et pas chez
  d'autres.** Le regroupement par famille limite l'envoi, mais un univers riche renchérit quand
  même et peut inverser le classement des modèles par coût. Le pliage tire dans l'autre sens. À
  surveiller dès les premières séances réelles.

### Un risque qui est levé, et il faut le dire

**La recette d'animation** était le risque de la V3. **Il est levé, et la réponse est
négative** : trois bancs payés les 1ᵉʳ et 2 septembre 2026 — 141 planches, 6,03 $ —, puis six
essais de plus le 2 au soir — 2,29 $ —, toutes les planches notées une par une par l'auteur.
**La façon de demander est épuisée comme levier**, y compris en rangeant le texte au lieu de le
récrire, et le texte du produit ne bouge pas.

**Mais le risque chiffré qui en découlait a changé de forme, et c'est le fait de la journée.**
*Une bonne planche sur dix* était le prix d'une version bâtie sur la planche. La V3 n'est plus
bâtie dessus : elle commande un clip et le découpe. **Le risque n'est donc plus le taux, c'est
l'ignorance** — combien de clips pour une bande utilisable, personne ne le sait. **`A10` le
mesure sans banc supplémentaire** : son écran affiche le prix par bande de chaque clip et le voit
baisser à chaque bande gardée, si bien que le chiffre se prend à l'usage. Tout est dans
`docs/bilan-v3.md` pour les planches, et dans `essais/verdict-essais.json` pour la refonte.

**Et un second risque s'ouvre avec le recadrage, qu'il faut nommer** : *une seule direction a été
essayée.* Tous les clips mesurés partent du profil, et l'objectif de la version est d'animer
**toutes** les cases d'une matrice — donc aussi la face et le dos. Rien ne dit ce qu'un modèle
vidéo fait d'un sprite vu de face. **`A12` est la tranche qui s'en apercevra**, et c'est délibéré :
la question ne se mesure qu'en couvrant une matrice, pas en tirant un clip de plus.
