# Plan : Asset Kitchen — V1, puis V2

> **PRD source** : `docs/PRD.md` — 173 user stories.
> **Découpage** : les sept tranches T1→T7 ont été décidées le 26 août 2026, à l'établissement
> de `docs/ARCHITECTURE.md` §6.3. Ce plan ne les redécoupe pas : il leur accroche les user
> stories, leur donne un ordre et des critères d'acceptation vérifiables. C'est lui, désormais,
> qui fait foi sur l'ordre de construction et sur les critères d'acceptation de la V1.
>
> **T8 et T9 sont venues après, le 27 août 2026**, d'une séance d'essai sur le produit tenu :
> la grille du tableau d'inspiration montre tout d'un coup d'œil et ne permet d'organiser rien.
> Elles ne s'intercalent nulle part — elles se posent après T7, et aucune tranche de la V1 ne
> les attend.
>
> **Les cinq tranches C1 à C5 sont venues le 28 août 2026** : deux essais payés ont levé ce
> qui retenait le personnage, il est passé devant les tuiles, et son équipement — qui n'était
> nulle part — entre avec lui. Elles ne changent rien à T1–T10 : la V1 est close, et la V2 se
> pose dessus.
>
> **Les quatre reprises R1 à R4 sont venues le 28 août 2026**, d'une séance d'usage et non
> d'un cadrage : ce que le produit impose à l'apparence ne se voyait nulle part, un réglage
> d'univers ne se voyait qu'en rechargeant la page, on ne pouvait pas importer une image depuis
> l'écran, et l'infobulle se posait sur le réglage d'à côté. Elles ne s'intercalent pas dans la
> V2 : **elles ne bloquent ni ne sont bloquées par C3, C4 et C5**, et se prennent quand on veut.
> Elles sont rangées ici avant C3 parce que c'est l'ordre de valeur, pas un ordre de dépendance.
>
> **R5 est venue le 29 août 2026**, de la première séance d'usage de C3 : un mauvais recalage a
> figé quatre images alors que les planches qui les ont payées sont toujours sur le disque. Elle
> est rangée après C3, qu'elle est la seule reprise à supposer.
>
> Ce document fait foi sur **l'ordre**. Il ne nomme ni fichier, ni fonction, ni route :
> comment c'est construit vit dans `docs/ARCHITECTURE.md`, à quoi ça ressemble dans
> `docs/DESIGN.md`, ce que ça doit faire dans `docs/PRD.md`.

---

## Décisions architecturales

Ce plan ne décide ni du squelette, ni du schéma, ni des routes — voir `ARCHITECTURE.md`
§4, §4 bis et §5. Ce qu'il décide, et que personne d'autre ne dit : **à quel moment
chaque objet et chaque invariant entrent en vigueur**. C'est ce calendrier qui rend une
tranche livrable seule.

### Quand chaque entité du modèle d'objets apparaît

| Entité | Apparaît en | Ce qu'elle porte à ce moment-là | Se complète en |
|---|---|---|---|
| **Génération** | T1 | identifiant unique, statut, avancement, paramètres résolus, coût réel, résultats | T4 (références envoyées), T7 (provenance agent) |
| **Asset** | T2 | image brute, recette, dimensions mesurées, label | T3 (projet, collection, favori, filiation), T5 (filiation de découpe) |
| **Projet** | T3 | nom, rangement, total des coûts, journal | T4 (bible, artworks, palette, réglages par défaut) |
| **Collection** | T3 | nom, projet optionnel | — |
| **Carte** | T4 | type, contenu, groupe, note, provenance, taille d'affichage, artwork officiel, famille | T8 (sa place sur la toile : position, largeur libre) |
| **Lien** | T9 | les deux objets qu'il joint, son mot, sa pointe | — |

Un objet n'est jamais rétro-adapté en catastrophe : chaque tranche sait déjà ce que la
suivante viendra y ajouter.

### Les invariants, et la tranche qui les instaure

Un invariant instauré ne se renégocie plus : les tranches suivantes le conservent, et
c'est un critère d'acceptation de chacune d'elles.

| Invariant | Instauré en |
|---|---|
| L'identifiant de génération est unique — deux soumissions ne facturent qu'une fois | T1 |
| Le coût enregistré est celui que l'appel facture, jamais le tarif affiché au catalogue | T1 |
| Les dimensions mesurées font foi, jamais celles demandées | T1 |
| Le catalogue décide, jamais une liste en dur | T1 |
| Ce qui est indisponible est grisé avec sa raison, jamais proposé puis refusé | T1, étendu à chaque nouvelle raison (T2, T6) |
| Rien n'est jamais relancé automatiquement | T1 |
| Le traitement est non destructif : image brute + recette, le rendu est un cache effaçable | T2 |
| Le post-traitement ne touche jamais le GPU, et n'appelle jamais le fournisseur | T2 |
| Les fichiers font foi, la base est un index reconstructible | T3 |
| Une seule grille d'assets dans tout le produit | T3 |
| Tout ce qui ne demande pas le fournisseur fonctionne réseau coupé | T3, reconduit en T4, T5, T6 |
| Aucune carte graphique mobilisée, aucun modèle **génératif** local — ni ComfyUI, ni LM Studio, ni GPU | T1, et chaque tranche le conserve. **Précisé en T2**, pas contourné : un modèle de *segmentation* sur processeur est admis comme **second** moteur de détourage, facultatif, et grisé avec sa raison quand il n'est pas installé. Le geste courant n'en demande aucun — le détourage par défaut ne charge rien et marche hors ligne |
| Le MCP n'a aucune logique propre : il appelle les services de l'écran | T7 — et c'est ce qui interdit d'y ajouter un geste que l'écran n'a pas |
| La toile montre ce qui est classé, la réserve contient ce qui reste à classer | T8 |
| L'îlot **est** le groupe — hors îlot, pas de groupe, et jamais deux rangements concurrents | T8 |

### Couverture des 114 user stories de la V1

Chaque user story appartient à une tranche et à une seule.

| Tranche | User stories | Nombre |
|---|---|---:|
| T1 | 1, 3, 4, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 75, 93, 94, 95 | 23 |
| T2 | 59, 62, 63, 64, 65, 66, 70, 71 | 8 |
| T3 | 2, 5, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 40, 92, 97 | 22 |
| T4 | 41 à 58, 60, 61, 67, 68, 69 | 23 |
| T5 | 72, 73, 74 | 3 |
| T6 | 76, 77 | 2 |
| T7 | 39, 78 à 91, 96 | 16 |
| T8 | 98 à 107 | 10 |
| T9 | 108, 109, 110, 111 | 4 |
| T10 | 112, 113 | 2 |
| — | 114 | 1 |
| | **Total** | **114** |

Deux user stories s'achèvent dans une tranche postérieure à celle qui les porte, et le
critère correspondant y est écrit : **US-14** (le total par projet arrive en T3) et
**US-65** (la quantification, grisée en T2, s'allume en T4).

**US-114 est livrée sans tranche, et c'est assumé.** L'aperçu — voir en grand l'image
survolée à la barre d'espace, et la zoomer à la molette — a été écrit d'un jet le 28 août
2026 (`541fe4b`), sans passer par le plan. Ses critères existent, mais **sous forme d'essais**
(`interface/src/App.test.tsx`, § « l'aperçu », six cas nommés comme des critères). Les
recopier ici les dédoublerait sans rien garantir de plus : un essai tombe quand c'est faux,
une case cochée non.

La règle qui en sort, et qui vaut pour la suite : **ce qui naît de l'usage plutôt que du
cadrage peut se passer de tranche, à condition que ses essais soient nommés comme des
critères.** Ce plan fait foi sur l'ordre de construction ; pour ce qui est déjà construit,
il n'y a plus d'ordre à trancher.

---

## V1 — les dix tranches, toutes tenues

**La V1 n'a plus de tranche ouverte.** Les 115 critères d'acceptation sont cochés ; 195
tests de serveur et 80 d'écran les tiennent. Chaque tranche ci-dessous garde son résumé ;
**ses critères, ce qui la bloquait et son rapport de tenue vivent dans
`docs/plan-archive.md`**, qui ne fait foi sur rien et qu'on ouvre à la demande.

### T1 · La première image
*16 critères · 23 US (1, 3, 4, 6–11, 13–22, 75, 93–95) · tenue le 27 août 2026*

Le squelette : la clé, le catalogue que le fournisseur déclare, un appel qui rend une image
téléchargeable, l'écran Atelier ouvert sur un prompt actif. La génération vit côté serveur —
fermer l'onglet ne l'arrête pas, et chaque variation est un emplacement indépendant. Le flux
d'événements remplace le sondage, la jauge est déterminée, et sans réseau le dernier
catalogue reçu sert de repli daté en clair.

### T2 · Le post-traitement
*10 critères · 8 US (59, 62–66, 70, 71) · tenue le 27 août 2026*

L'image se retouche sans repayer : recadrage, redimensionnement, pixellisation sur grille
cible, quantification, nettoyage des bords, détourage en une ou plusieurs passes. Tout sur le
processeur, sans jamais mobiliser la carte graphique ni rappeler le fournisseur. L'asset, la
recette, le rendu-cache, les recettes nommées et la fiche naissent ici.

### T3 · La bibliothèque
*16 critères · 22 US (2, 5, 12, 23–38, 40, 92, 97) · tenue le 27 août 2026*

Tout ce qui sort entre en bibliothèque de lui-même, rangé dans le projet courant — un « Bac à
sable » existe au premier lancement, donc ranger reste un geste et jamais un préalable.
Projets et collections, une seule grille filtrable et cherchable, la sélection multiple, le
favori, la suppression avec son annulation courte, la filiation, le journal des appels ratés,
la réinjection dans ses quatre rôles, et l'index reconstructible.

### T4 · Le tableau et l'univers
*19 critères · 23 US (41–58, 60, 61, 67–69) · tenue le 27 août 2026*

Le tableau d'inspiration, où coller est le geste principal : une image, une adresse ou un
texte devient une carte, et une adresse qui n'aboutit pas garde sa raison. Et l'univers que
le projet porte et impose — bible en cinq champs nommés, barème d'échelles, taille de pixel
imposée à tout ce qui rentre, modèle par défaut par famille, et la palette extraite par
calcul puis appliquée rétroactivement.

### T5 · Le slicer
*5 critères · 3 US (72–74) · tenue le 27 août 2026*

Une planche multi-sprites se découpe par zones opaques connexes — une planche de huit devient
huit assets, chacun entier, rangé comme les autres, filié vers sa planche. Quand la détection
se trompe on corrige à la main, en grille fixe ou au rectangle, jamais bloqué. Plus les deux
dettes reportées : le zoom de la grille, et la première exécution du second moteur de
détourage.

### T6 · L'export
*5 critères · 2 US (76, 77) · tenue le 27 août 2026*

Une sélection sort en archive avec son descriptif — de quoi transférer un lot d'un coup et le
retrouver plus tard. Ce qui part est le **rendu**, jamais le brut qui reste ici, et le
descriptif dit lequel il est. Sélection vide : l'export est grisé et dit pourquoi, comme
toute action indisponible du produit.

### T7 · Le MCP — *et la V1 avec elle*
*13 critères · 16 US (39, 78–91, 96) · tenue le 27 août 2026*

Onze outils épais, façade sur les services que l'écran appelle déjà, montés dans le **même
processus** que l'API sur `/mcp`. Aucune logique propre : un agent fait exactement ce que
l'écran fait, et rien de plus. Les deux garde-fous relus à chaque appel, le dossier du jeu et
ses trois règles, la provenance héritée par l'asset, et l'écran Réglages qui tient enfin les
trois questions promises depuis T1.

### T8 · La toile
*13 critères · 10 US (98–107) · tenue le 28 août 2026*

Le tableau gagne une **seconde vue** : un plan qu'on déplace et qu'on zoome, où une carte se
pose où l'on veut et garde sa place, avec des îlots nommés et une réserve à droite pour ce
qui reste à classer. L'îlot **est** le groupe — ni identité, ni fichier, ni position à lui :
l'écran le calcule à chaque rendu, donc aucun état ne montre un rangement que le disque ne
dit pas.

### T9 · Les liens et les notes
*9 critères · 4 US (108–111) · tenue le 28 août 2026*

Ce que T8 permet de ranger, T9 permet de le **dire** : un trait d'un objet à un autre, une
note posée à même la toile, et six teintes sourdes portées par le projet. Le lien naît muet —
ni mot, ni pointe — parce que *le défaut est muet, l'exception s'exprime* ; il ne survit pas à
ses extrémités, et c'est la suppression qui l'emporte, jamais un balayage.

### T10 · L'îlot se saisit, et ce qui va partir se voit
*9 critères · 2 US (112, 113) · tenue le 28 août 2026*

Deux décisions de T8 que l'usage a démenties, sans ajouter ni objet, ni écran, ni glyphe. Un
îlot se déplace par la bande de son titre avec ce qu'il contient, en **un seul appel** qui
écrit toutes les places ou aucune. Et un îlot que le geste en cours ferait disparaître le dit
en `--echec` pendant qu'on le fait.

---

## V2 — Le personnage et son équipement

*Cinq tranches, décidées le 28 août 2026.* Elles ne s'intercalent nulle part dans la V1 : la
chaîne s'arrête à T7, rien avant elles ne les attend, et **aucune tranche de T1 à T10 ne
change d'ordre ni de contenu**. Le personnage était renvoyé à un « ensuite » sans rang,
derrière les tuiles ; deux essais payés le 28 août ont levé les deux doutes qui le retenaient
(`essais/essai_grille.py`, `essais/essai_silhouette.py`), et il passe devant. L'ordre des
versions devient **V2 le personnage et son équipement, V3 l'animation, V4 les tuiles, V5 le
son** — `ARCHITECTURE.md` §7 à §10 suit cette numérotation.

Le critère de découpage est celui de la V1, inchangé : **chaque tranche est utilisable à sa
livraison, et on ne passe à la suivante que lorsque la précédente sert vraiment.**

**Le découpage est passé de six tranches à cinq le 28 août 2026 au soir**, quand la méthode de
l'équipement a été refaite. Les références d'un personnage, qui formaient une tranche à elles
seules, rejoignent C1 : une génération de pose annonce déjà ce qui part et ce que ça coûte, et
séparer les deux revenait à livrer un panneau à moitié. La pièce et le calque remontent donc en
C3, la main en C4, la sortie en C5.

Deux points de ce découpage sont **délibérés et ne se déplacent pas** :

- **Le masque rectangle est en C3, pas en C4.** Sans lui, la différence emporte le visage, et
  C3 ne serait pas utilisable à sa livraison. C4 apporte la finesse, pas la fonction.
- **Le MCP suit en C5 sans rien décider.** L'invariant de T7 tient : il n'a aucune logique
  propre et n'expose que les gestes de l'écran.

### Ce que la V2 hérite et ne rediscute pas

Tout ce que la V1 a instauré tient, et chaque tranche de la V2 le conserve — c'est un critère
d'acceptation de chacune d'elles :

- le coût réel facturé fait foi, les dimensions mesurées font foi, le catalogue décide ;
- rien n'est jamais relancé automatiquement ;
- ce qui est indisponible est grisé avec sa raison ;
- le traitement est non destructif : image payée + recette, le rendu est un cache effaçable ;
- les fichiers font foi, la base est un index reconstructible ;
- aucune carte graphique mobilisée, aucun modèle génératif local ;
- tout ce qui ne demande pas le fournisseur fonctionne réseau coupé ;
- le MCP n'a aucune logique propre : il appelle les services de l'écran ;
- **une seule grille d'assets dans tout le produit** — la matrice de production n'en est pas
  une, exactement comme la réserve de T8 n'en était pas une.

### Quand chaque entité de la V2 apparaît

| Entité | Apparaît en | Ce qu'elle porte à ce moment-là | Se complète en |
|---|---|---|---|
| **Plan de poses** *(projet)* | C1 | nom, poses nommées, nombre d'images par pose | — |
| **Personnage** *(projet)* | C1 | nom, description, plan rattaché, poses tenues, concept arts désignés | — |
| **Emplacement** *(projet)* | C3 | nom, rang | — |
| **Pièce** *(projet)* | C3 | nom, description, emplacement, portée (contenue \| agrandit), concept arts désignés | — |
| **Calque** *(personnage)* | C3 | planche payée et sa case, pièce, **pose**, recette de différence, zone, masque rectangle, mesures | C4 — deux couches de plus dans la même place : le masque affiné à la main, et la retouche au pixel |

### Les invariants que la V2 instaure

| Invariant | Instauré en |
|---|---|
| Le corps naît dans l'atelier et nulle part ailleurs — pas d'écran de création avec son propre prompt | C1 |
| Le plan appartient au projet, jamais au personnage — un personnage dit lesquelles de ses poses il tient | C1 |
| Nommer, c'est créer : un nom de pose, d'emplacement ou de pièce qui n'existe pas est créé sur-le-champ | C1, étendu en C3 |
| La matrice de production n'est pas une grille d'assets — ni recherche, ni filtres, ni sélection multiple | C1 |
| La préséance des références est écrite à l'écran, jamais devinée | C1 |
| Le pliage est une ruse d'appel, jamais un format de livraison : ce qui sort, ce sont des images séparées | C2 |
| **Le pliage est une fonction générale de l'atelier** — habiller ou transformer N images d'un seul appel | C2, réemployé tel quel en C3 |
| Un lot est tout ou rien sur le compte, indépendant sur le reste | C2 |
| **Le compte d'images est le seul refus automatique du produit** — toute autre mesure informe et n'empêche jamais de garder | C2, reconduit en C3 |
| Rien n'est ajouté à l'image envoyée pour aider le recalage — ni ancre, ni mire, ni silhouette | C3 |
| Le corps d'origine n'est jamais modifié : le calque est rangé à côté de l'image payée | C3 |
| **Un calque est solidaire de sa pose** — il en faut un par pose, et c'est le pliage qui en divise le prix | C3 |
| **Une pièce est contenue dans la silhouette ou elle l'agrandit, et c'est l'auteur qui le déclare** | C3 |
| La zone et la retouche au pixel sont deux couches séparées et rejouables | C4 |

### Couverture des user stories de la V2

| Tranche | User stories | Nombre |
|---|---|---:|
| C1 | 115 à 127 | 13 |
| C2 | 128 à 135 | 8 |
| C3 | 136 à 148 | 13 |
| C4 | 149 à 153 | 5 |
| C5 | 154 à 157 | 4 |
| | **Total** | **43** |

### Couverture des user stories des reprises

| Tranche | User stories | Nombre |
|---|---|---:|
| R1 | 165, 166 | 2 |
| R2 | 158 à 164 | 7 |
| R3 | 167 à 170 | 4 |
| R4 | 171, 172 | 2 |
| R5 | 173 | 1 |
| | **Total** | **16** |

Avec les 114 de la V1 et les 43 de la V2, le PRD est couvert de bout en bout : **173 user
stories, une tranche chacune.**

---

## C1 · Le personnage, son plan, une pose, et ce qui part avec elle
*18 critères · 13 US (115–127) · tenue le 28 août 2026*

**User stories** : 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127

### Ce qu'on livre

Un personnage se crée dans un projet, se décrit une fois, et on ne réécrit plus son
signalement à chaque prompt. Le projet porte une liste de poses — un plan qu'il a déjà au
premier lancement, sans qu'une ligne ait été écrite — et chaque personnage dit lesquelles il
tient : un figurant ne réclame pas les images d'un héros. Une matrice montre d'un coup d'œil
ce qui est fait et ce qui manque, et on lance depuis là **une pose à la fois**.

Et ce qui part avec cette pose se lit et se décide, parce qu'annoncer un coût sans montrer ce
qui le fait n'est qu'à moitié utile. Un personnage ou une pièce désigne des cartes du tableau
comme concept art — elles restent où elles sont, visibles sur la toile, et il n'existe aucun
second endroit où ranger des images. Avant de générer, chaque référence envoyée se lit ligne
par ligne avec sa provenance, et se décoche pour cette génération, pour ce personnage, ou pour
tout le projet. L'image obtenue est un asset ordinaire, rangé comme les autres, et sa fiche
nomme enfin le modèle qui l'a produite.

La tranche vaut son temps seule : sans elle, décrire un personnage est un copier-coller de
prose à chaque génération, savoir ce qui manque est un effort de mémoire, et ce qui contamine
une génération est invisible.

### Critères d'acceptation

- [x] Un projet neuf porte un plan de poses utilisable sans qu'aucune ligne n'ait été écrite
- [x] Un personnage se crée avec un nom et une description ; sa description part avec chaque génération de pose, sans être retapée
- [x] Une pose s'ajoute, se renomme et se retire du plan du projet à tout moment ; ajouter une pose ajoute une case vide à chaque personnage qui porte ce plan, et ne lance **aucune** génération
- [x] Un personnage rattaché à six poses affiche six cases vides ; une pose générée en remplit une, et les cinq autres restent visiblement vides
- [x] Écrire un nom de pose qui n'existe pas le crée sur-le-champ, sans passer par un écran de gestion
- [x] La matrice n'offre ni recherche, ni filtres, ni sélection multiple — et la grille de la bibliothèque reste la seule grille d'assets du produit
- [x] Une carte image du tableau se désigne concept art d'un personnage ou d'une pièce, et reste à sa place — aucune copie, aucun second rangement
- [x] Une carte désignée se distingue sur la toile de celle qui dort
- [x] Avant de lancer, chaque référence envoyée est listée avec sa provenance nommée, et le coût est annoncé
- [x] Une référence se décoche à trois portées — cette génération, ce personnage, tout le projet — et la portée retenue est lisible
- [x] La règle de préséance entre les trois portées est affichée à l'écran, pas déduite
- [x] Décocher une référence ne modifie ni l'univers, ni les artworks officiels du projet
- [x] Le nombre de références effectivement envoyées reste visible au moment de générer, comme depuis T4
- [x] Une pose générée entre en bibliothèque comme tout asset : projet courant, filiation, coût réel enregistré
- [x] Aucun écran de création de personnage avec son propre prompt n'existe : le corps se désigne depuis une image née dans l'atelier
- [x] La fiche de **n'importe quel** asset nomme le modèle qui l'a produit — le modèle exact pour une image générée, « importé » pour une image importée
- [x] Réseau coupé : le plan, le personnage, la matrice et le panneau des références se consultent et se modifient ; seule la génération échoue, au moment où on l'essaie
- [x] Supprimer un personnage laisse ses images en place, chacune marquée « personnage supprimé » — jamais de cascade

### Ce que la construction a décidé

Quatre décisions prises en écrivant, et qui ne sont pas dans le cadrage :

- **Un seul plan par projet, et il n'a pas de nom.** Le découpage en prévoyait plusieurs,
  nommés ; c'est inutile tant qu'un personnage peut **écarter** les poses qu'il ne tient pas
  (US-117) — un figurant et un héros se comparent au même plan, l'un en cochant moins de
  cases. Deux façons de dire « ce personnage n'a pas besoin de ça » auraient fini par se
  contredire.
- **Le personnage range ce qu'il écarte, jamais ce qu'il tient.** À l'écran on coche des
  poses tenues ; sur le disque on garde le complément. C'est ce qui rend « ajouter une pose
  ajoute une case vide à chaque personnage » vrai **sans écrire un seul fichier de
  personnage** — donc sans balayage capable de réussir à moitié.
- **La case n'est pas un objet : c'est l'image qui dit sa case.** L'asset porte son
  personnage et sa pose, la matrice se calcule là-dessus. Une image supprimée vide sa case
  toute seule, et supprimer un personnage n'a rien à défaire — l'image reste, marquée.
- **Le coût annoncé est mesuré, jamais lu dans un tarif.** Le produit ne porte aucun prix de
  catalogue et ne doit pas en porter : ce qu'il annonce est la médiane de ce que ce
  modèle-là a réellement facturé sur cette machine, et « jamais appelé » quand il n'en sait
  rien. Même geste que l'attente de la jauge de T1.

### Ce que la première séance a trouvé

**C1 a été utilisée pour de vrai au navigateur, et ça a trouvé trois défauts.** Neuvième fois
de suite. Deux tiennent à la même racine — *un objet qui voyage par deux routes doit avoir la
même forme sur les deux* : le personnage porte des cases déduites, et seul le tableau de bord
les mettait dans sa charge. Écrire une description remplaçait donc un personnage entier par
un personnage à trous, la matrice se vidait, et le rendu suivant tombait — écran blanc. Le
second est le même défaut vu de l'autre bout : élargir la portée d'un décochage écrivait bien
sur le disque, mais rien ne redemandait ce qui part, et le panneau montrait l'état d'avant.
Le troisième était une **copie périmée** : la case visée gardait l'objet du moment où on
l'avait armée. Elle ne garde plus qu'un identifiant, et se relit dans la liste que le flux
tient à jour. Les deux premiers sont dans `docs/PIEGES.md`, avec ce qui les avait rendus
invisibles : **le double des essais d'écran, lui, rendait la forme entière** — il avait été
écrit d'après l'intention, pas d'après le serveur.

## Bloquée par

- Aucune — T7 est tenue, et C1 se pose dessus sans rien y changer

---

## C2 · Le lot plié
*12 critères · 8 US (128–135) · tenue le 28 août 2026*

**User stories** : 128, 129, 130, 131, 132, 133, 134, 135

### Ce qu'on livre

La même chose que C1, pour une fraction du prix. On coche les poses qu'on veut voir partir
ensemble — de deux à autant qu'on ose, le produit annonce ce que ça coûte et ce qu'un compte
faux coûterait, il ne plafonne pas — et elles partent en **un seul appel**. La planche revient
et se déplie toute seule en autant d'images de corps qu'il y avait de cases : on ne découpe
jamais à la main ce qu'on a demandé plié. Si le compte ne tombe pas juste, rien n'entre et le
lot se relance d'un geste. Si le compte est bon, tout entre, et chaque pose redevient jugeable
et régénérable seule. Une coupure ne coûte que ce qu'elle a coûté, et un jeu de réglages se
garde sous un nom pour être rejoué sur un autre personnage.

Deux planches sur vingt-quatre, à l'essai du 28 août, ont répété la même pose : le compte était
bon et le contrat tenu, mais la planche sans valeur. L'auteur le voit, case par case, et rien
ne refuse à sa place.

**Cette tranche construit le pliage, et C3 le réemploie tel quel.** Ce n'est pas un dispositif
du lot de poses : c'est la manière dont l'atelier habille ou transforme N images d'un seul
appel. La grille carrée, le gabarit de cases vides et le redécoupage sur la géométrie connue
servent les deux usages.

### Critères d'acceptation

- [x] Neuf poses sélectionnées et lancées ensemble donnent neuf images de corps distinctes après **un seul** appel payant, et le journal du projet montre un appel et non neuf
- [x] La planche reçue est dépliée automatiquement ; aucun geste de découpe n'est demandé à l'auteur
- [x] Un lot qui revient avec huit images pour neuf demandées est refusé : aucune image n'entre dans le plan, et le lot se relance d'un geste
- [x] Le compte d'images est le **seul** refus automatique — les mesures de ressemblance et de dérive de grille s'affichent et ne bloquent rien
- [x] Deux poses trop semblables dans un même lot sont signalées case par case ; le lot n'est pas refusé et les images entrent
- [x] Avant de lancer, l'écran dit ce qu'un compte faux coûterait — le lot entier refusé et relancé au prix plein — sans annoncer de probabilité
- [x] Une pose ratée à l'intérieur d'un lot accepté se régénère seule, sans toucher aux autres
- [x] Un lot interrompu par la fermeture de l'application se reprend au redémarrage sans repayer les images déjà reçues, et rien ne se relance tout seul
- [x] Ce qui part en référence et les réglages d'une génération s'enregistrent sous un nom, et se rappellent d'un geste sur un autre personnage
- [x] Ce qui sort du produit reste des images séparées : aucune feuille assemblée n'est livrable
- [x] Le modèle par défaut pour produire une planche et celui pour éditer un corps se règlent séparément sur l'univers du projet, et l'auteur n'a pas à les choisir à chaque génération
- [x] Le coût réel du lot est enregistré et totalisé par projet, comme tout appel depuis T1

### Ce que la construction a décidé

Six décisions prises en écrivant, et qui ne sont pas dans le cadrage :

- **La planche payée n'est pas un asset.** Elle reste le brut de sa génération — payée,
  gardée, redépliable — et seules les N images séparées entrent en bibliothèque. C'est ce qui
  rend « aucune feuille assemblée n'est livrable » vrai **par construction** plutôt que par un
  filtre d'export qu'il faudrait tenir. Le prix est assumé et il faut l'écrire : les N corps
  n'ont pas de `parent`, c'est la **génération** qui les relie — et quand le compte tombe faux,
  on ne voit pas ce qui est revenu.
- **Un lot refusé sur le compte est un emplacement échoué, et rien de plus.** La relance de T1
  s'applique alors telle quelle — un geste, au prix plein —, sans qu'aucun état neuf soit
  inventé. Conséquence assumée, et c'est la règle du produit depuis T1 : il reste relançable
  **dans l'onglet qui l'a vu échouer**, et un rechargement n'en garde que la ligne de coût au
  journal.
- **Le gabarit ne s'enregistre nulle part.** Ni asset, ni carte : il se redessine du geste
  depuis la géométrie, à la soumission comme à la relance, donc les deux envoient exactement la
  même chose. Il compte en revanche comme **une référence** — il occupe une place dans le
  plafond du modèle et il coûte chez ceux qui facturent au token —, et l'écran le dit dans
  *Ce qui part*. Un modèle qui n'accepte aucune référence part sans lui, et ne se grise pas
  pour autant : il peut honorer la demande, un peu moins bien.
- **La ressemblance s'affiche avec son jumeau, et sans seuil.** Un seuil serait un nombre
  inventé sur un corpus de vingt-quatre planches. Ce corpus dit ceci, et c'est assez : les deux
  planches qui répétaient une pose ressortent à 0,999 et 1,000 quand les vingt-deux autres
  plafonnent à 0,897.
- **La case à cocher de la matrice porte une attitude, jamais une image.** C'est ce qui garde
  vrai l'invariant de C1 — *la matrice n'offre pas de sélection multiple* : on n'y sélectionne
  toujours aucun asset. La distinction n'est pas de vocabulaire, c'est elle qui empêche l'écran
  de redevenir une seconde planche contact, et un essai d'écran tombe le jour où une coche
  passera sur une vignette.

### Ce que la première séance a trouvé

*À écrire après usage.* Le pliage pur a été éprouvé sur les **vingt-quatre planches réelles**
de `essais/essai_grille.py` — zéro écart de compte avec le banc du 28 août —, mais la tranche
n'a pas encore servi au navigateur, et la règle du dépôt tient : *une tranche n'est finie que
lorsqu'on s'en est servi*.

## Bloquée par

- C1 — il n'y a pas de lot sans plan de poses ni cases à remplir

---

## Les quatre reprises — R1 à R4

Elles sortent d'une séance d'usage du 28 août 2026, pas d'un cadrage. Aucune ne dépend d'une
autre, aucune ne bloque la V2 et aucune n'est bloquée par elle : **elles se prennent dans
l'ordre où elles sont écrites, ou à l'unité.** L'ordre est celui de la valeur — sauf R1, mise
en tête parce qu'elle coûte quelques heures et que **R2 ne se juge pas sans elle** : changer une
taille de pixel sans voir l'écran la prendre, c'est régler à l'aveugle.

---

## R1 · Le réglage d'univers se voit à l'instant
*6 critères · 2 US (165–166) · tenue le 28 août 2026*

**User stories** : 165, 166

### Ce qu'on livre

Un réglage posé dans l'univers change l'écran tout de suite. C'est une correction, pas une
fonctionnalité : le réglage était bien écrit sur le disque, il ne remontait simplement pas.

**Deux causes indépendantes pour un seul symptôme**, et c'est ce qui l'a rendu insaisissable :
le service n'annonce le changement au flux que lorsque l'empreinte de palette bouge — changer
le nombre de couleurs se voyait donc, changer la taille de pixel, la bible, le barème ou les
modèles ne se voyait pas —, et l'écran jetait par ailleurs la réponse du réglage au lieu de la
poser. Corriger l'une des deux suffirait à faire disparaître le symptôme ; les deux se
corrigent, parce qu'un écran qui ne sait pas poser ce qu'on lui rend est un piège qui se
réveillera ailleurs.

**Ce que la tranche ajoute et qui n'existait pas** : un essai d'écran qui vérifie *ce que
l'écran affiche après le réglage*, et non plus seulement qu'il a bien appelé le serveur. C'est
exactement le trou par lequel ce défaut est passé — 122 essais d'écran, et aucun ne regardait
après.

### Critères d'acceptation

- [x] Changer la taille de pixel, la bible, le barème ou un modèle par défaut met l'écran à jour sans rechargement, et la valeur affichée est celle qui vient d'être écrite
- [x] Le même changement fait dans un onglet apparaît dans un second onglet ouvert sur le même projet, comme tout ce qui passe par le flux
- [x] Un réglage refusé par le serveur laisse l'écran sur la valeur d'avant, avec sa raison — jamais sur la valeur tentée
- [x] Rouvrir l'écran Univers après un réglage montre la même valeur que le fichier du projet
- [x] Un essai d'écran vérifie, pour chacun des cinq blocs de l'univers, ce qui est affiché **après** le réglage
- [x] Aucun appel payant, aucun aller-retour supplémentaire au réglage : ce qui manquait est une annonce et une pose, pas une relecture

## Bloquée par

- rien

---

## R2 · Ce qui décide de l'apparence se voit et se règle
*13 critères · 7 US (158–164) · tenue le 29 août 2026*

**User stories** : 158, 159, 160, 161, 162, 163, 164

### Ce qu'on livre

L'auteur voit ce qu'il demande et ce qu'on lui applique, et il peut trancher les deux.

**Le prompt exact, avant de lancer.** Un dépliant sous le champ montre le texte tel qu'il
partira, dans l'ordre où il part : la bible active, le sujet, puis les consignes de pliage
quand il y a une planche. Un geste le bascule en édition libre **pour cette génération-là** :
la bible n'est pas touchée, et ce qui est parti reste attaché à la génération, au même titre
que le modèle et le coût. Rien n'est traduit ni enrichi en chemin — montrer autre chose que ce
qui part serait pire que ne rien montrer.

**La bible gagne deux champs nommés** : la vue et le cadrage, la technique de rendu. La liste
close passe de cinq à sept et **reste close** : c'est le dosage qui fait sa valeur, pas le
texte libre. Ces deux-là entrent parce que ce sont exactement les deux décisions d'apparence
que l'auteur prenait à chaque prompt sans avoir où les poser.

**La taille de pixel accepte « aucune ».** La remise sur grille cesse d'être sans échappatoire :
un projet qui n'est pas en pixel art reçoit ce que le modèle a rendu. Le reste ne bouge pas —
détourage, recadrage et barème d'échelles continuent de s'appliquer, et la quantification reste
liée à l'existence d'une palette.

**Et la fiche dit ce que le projet a imposé** à l'image affichée : sans ça, l'auteur voit une
image qui ne ressemble pas à ce que le modèle a rendu, sans jamais savoir pourquoi.

À la livraison, `docs/ARCHITECTURE.md` §4 bis et §6.1 sont corrigés dans la foulée : « la
remise sur grille est systématique, jamais optionnelle » devient « systématique tant qu'une
cible est posée », et la bible y compte sept champs.

### Critères d'acceptation

- [x] Avant de lancer, le texte exact qui partira s'affiche : bible active, sujet, consignes de pliage — dans l'ordre d'envoi, sans rien de masqué
- [x] Ce texte suit ce qu'on tape et ce qu'on décoche : décocher un champ de bible le retire de l'aperçu à l'instant
- [x] Le texte repris à la main part **mot pour mot**, et `generation.json` porte ce texte-là
- [x] Reprendre le texte n'écrit rien dans l'univers : rouvrir l'écran Univers montre la bible inchangée
- [x] Une génération relancée depuis un asset repart avec le texte qui était parti, repris compris
- [x] La bible compte sept champs nommés, chacun activable indépendamment comme les cinq premiers
- [x] Un projet écrit avant cette tranche s'ouvre avec ses deux nouveaux champs vides et actifs, et rien de ce qu'il portait n'est perdu
- [x] Taille de pixel « aucune » : l'image générée entre en bibliothèque **aux dimensions rendues par le modèle**, sans rééchantillonnage
- [x] Avec « aucune », le détourage et le recadrage continuent de s'appliquer, et le barème d'échelles reste lisible avec la raison de son inaction
- [x] Avec « aucune », « Tout réaligner » ne rééchantillonne rien et le dit
- [x] La fiche d'un asset nomme le traitement que le projet lui a imposé — cible, occupation, palette — et le distingue de ce que l'auteur a réglé à la main
- [x] Un univers vide ne contraint toujours rien : générer sans bible, sans artwork et sans cible reste possible (US-57 reconduite)
- [x] Réseau coupé : l'aperçu du prompt, l'édition du texte et le réglage de la bible fonctionnent

### Ce que la construction a décidé

**Le texte qui part n'a qu'un auteur, et l'aperçu emprunte son chemin.** Composer la bible en
tête et les consignes de planche en queue vit à un seul endroit du dépôt ; l'aperçu appelle
cette composition-là, sans la refaire. L'écran ne joint donc rien — il *demande*, sur une route
à lui, et affiche ce qu'on lui rend. Un aperçu recomposé au navigateur aurait été une seconde
vérité sur ce qui part, et la seule qui compte est celle qui part. Le prix est un aller-retour
local par frappe, atténué d'un délai de 140 ms ; il ne sort pas de la machine et n'écrit rien.

**Reprendre le texte ne touche qu'au texte.** L'échelle continue de décider des artworks qui
partent, du modèle par défaut et de l'occupation ; le gabarit d'un lot part toujours ; les cases
sont toujours vérifiées avant qu'un centime parte. C'est ce qui fait de la reprise une
correction de formulation et non une sortie du projet.

**Et elle a réparé un défaut que personne n'avait vu** : « reprendre les réglages » d'un asset
reposait le prompt **déjà habillé** dans le champ de l'atelier, qui le rhabillait une seconde
fois — la bible partait en double. Le geste rend désormais la main à l'auteur, en repris : ce
qui est reparti est exactement ce qui était parti.

**« Aucune » est une valeur, pas un réglage éteint**, et zéro est traité à part du contrôle de
bornes plutôt qu'en élargissant le minimum : élargir aurait laissé entrer 1, 2 et 4 pixels, qui
ne sont ni une échappatoire ni une grille. Sans cible, la grille **disparaît** de la recette au
lieu de valoir zéro — un asset ne doit pas porter une remise sur grille que le projet n'impose
plus. « Tout réaligner » la retire donc au lieu d'en poser une, et le dit avec son compte.

**Ce que le projet impose se calcule, il ne se range pas.** La question posée par la fiche est
« qu'est-ce que le projet impose *maintenant* » : une valeur enregistrée à la naissance aurait
vieilli au premier réglage d'univers, et la fiche aurait comparé l'image à un souvenir. La
lecture est une route à part de l'asset, parce que la grille en affiche deux cents à la fois
pour une phrase que seule la fiche montre.

**Le prix payé, et il est écrit ici** : l'aperçu vérifie les cases d'un lot comme la soumission
les vérifie, donc un lot dont une pose a disparu montre un refus au lieu d'un texte. C'est
voulu — l'aperçu ne montre jamais un texte qui ne partirait pas — mais cela veut dire qu'un
onglet resté ouvert sur une pose décochée voit d'abord la raison, et le texte ensuite.

## Bloquée par

- R1 en fait, pas en droit — poser « aucune » sans voir l'écran le prendre est intenable

---

## R3 · Faire entrer une image depuis l'écran
*10 critères · 4 US (167–170) · tenue le 29 août 2026*

**User stories** : 167, 168, 169, 170

### Ce qu'on livre

Le geste que l'agent a depuis T7 et que l'écran n'a jamais eu. Un bouton, et le glisser-déposer
depuis le bureau dans la grille. L'image devient un asset entier — rangée, retouchable,
découpable, exportable, marquée comme importée — et sa génération dit d'où le fichier venait,
comme aujourd'hui côté agent.

**Une route qui prend les octets, et c'est la seule pièce neuve du serveur.** Celle qui existe
prend un *chemin*, ce qu'un navigateur ne donne jamais. Elle appelle le même service que l'outil
MCP : « ce que l'agent peut faire, l'écran le peut aussi » reste vrai dans les deux sens, et il
n'y a toujours qu'un seul endroit qui fait entrer une image.

**On dit au moment du geste si le traitement du projet s'applique**, et le défaut est « telle
quelle ». Aujourd'hui l'import hérite de la recette du projet en silence : une référence de
2048 pixels revient à 64, ce que personne n'a demandé.

### Critères d'acceptation

- [x] Un bouton d'import fait entrer un fichier choisi, et le déposer sur la grille fait la même chose
- [x] Plusieurs fichiers déposés d'un coup entrent tous, chacun avec son propre sort
- [x] Ce qui n'est pas une image est refusé **en le nommant**, et les autres fichiers du même dépôt entrent quand même
- [x] Un doublon est signalé avec le lien vers l'existant, et l'import forcé reste possible — comme au tableau d'inspiration
- [x] L'image importée est un asset ordinaire : filiation, retouche, découpe, export, suppression avec annulation
- [x] Sa provenance est lisible sur sa fiche : importée, coût nul, et le nom du fichier d'origine
- [x] Le choix « traitement du projet / telle quelle » est offert au moment de l'import, et le défaut est « telle quelle »
- [x] L'écran et l'outil MCP passent par le même service : aucun geste que l'un a et l'autre pas
- [x] Un fichier de plusieurs mégaoctets entre sans que l'écran se fige
- [x] Réseau coupé : l'import fonctionne de bout en bout

### Ce que la construction a décidé

**Le service qui faisait entrer une image n'a pas bougé de place ; il a changé de réponse.**
Il rend désormais *ce qui est entré* **ou** *ce qui était déjà là*, comme le collage du
tableau depuis T4 : un doublon n'est pas un refus, donc il ne lève pas. Les deux routes et
l'outil de l'agent rendent la même forme — un objet a la même forme sur toutes les routes qui
le portent, et la leçon de C1 s'appliquait ici mot pour mot.

**Le défaut « telle quelle » vaut des deux côtés, et c'est une décision.** Le PRD ne parlait
que de l'écran ; l'appliquer à l'agent aussi change son comportement d'avant. C'est assumé :
le défaut d'hier — hériter de la recette du projet en silence — est le défaut que la reprise
corrige, et un agent qui le garderait ferait vivre l'auteur et lui dans deux produits
différents. Les deux options sont donc sur l'outil MCP, comme sur la route.

**La décision voyage sur la génération, pas sur l'asset.** L'index est jetable : ce qui n'est
pas dans un `generation.json` n'existe plus après la première évolution du schéma. Une image
entrée telle quelle se retrouverait sinon ramenée sur la grille du projet un matin, sans que
personne l'ait demandé.

**Et elle n'a rien coûté au balayage de palette** : une recette vide est déjà ce que
« Tout réaligner » laisse tranquille — « un asset ramené au brut reste au brut ». Une image
entrée telle quelle le reste donc sans qu'aucune règle nouvelle ait eu à le dire. C'est le
signe qu'elle est posée au bon endroit.

**Le doublon se compte par projet**, comme au tableau : un univers n'a pas à savoir ce qu'un
autre a fait entrer, et la même référence a de bonnes raisons de servir dans deux jeux. Il se
cherche sur les **générations d'import** — elles seules portent l'empreinte des octets — et
il se relit par l'asset : ce qui a quitté la bibliothèque n'a plus de lien à proposer.

**Le prix payé, et il est écrit ici** : le choix « telle quelle / traitement du projet » vaut
pour la séance et non pour chaque fichier. Douze fichiers déposés ensemble ne peuvent pas
avoir douze sorts différents sans douze questions, et le produit n'a aucune boîte modale.
Qui veut mélanger les deux fait deux dépôts.

## Bloquée par

- rien

---

## R4 · L'infobulle ne couvre plus le réglage
*6 critères · 2 US (171–172) · tenue le 29 août 2026*

**User stories** : 171, 172

### Ce qu'on livre

L'infobulle se pose là où il n'y a rien à cliquer. Elle choisit aujourd'hui son côté par
rapport au **milieu de l'écran** — l'intention étant « elle s'ouvre vers la grille, jamais sur
l'image qu'elle règle » —, ce qui est juste à l'atelier et faux partout où l'écran n'est que
du réglage : à l'univers, aux réglages, dans la fiche, la surface d'à côté est encore du
réglage, et la bulle atterrit dessus.

Elle se placera par rapport au **panneau qui porte l'ancre**, pas par rapport à la fenêtre :
hors du panneau, et rabattue dans l'écran comme aujourd'hui. Le motif, le pointillé, la durée
de repos et l'épingle ne changent pas — `docs/DESIGN.md` n'a rien à rouvrir, seule la mesure
de la place change.

### Critères d'acceptation

- [x] Une infobulle ouverte depuis un panneau de réglages ne recouvre aucun contrôle de ce panneau, à l'univers, aux réglages et dans la fiche
- [x] Un panneau plus large que la place restante fait sortir la bulle du panneau, jamais dessus, et elle reste entièrement dans l'écran
- [x] Pointer un autre élément referme la bulle non épinglée sans qu'il faille la chasser
- [x] Une bulle épinglée reste, et Échap la lâche — inchangé
- [x] Le pointillé, la durée de repos, l'animation et le lien vers le guide sont inchangés
- [x] Un essai d'écran vérifie le non-recouvrement sur les trois écrans, et non seulement le rendu de la bulle

### Ce que la construction a décidé

**Le panneau se déclare lui-même, et la bulle le demande à son ancre.** Six panneaux portent
désormais une marque, et le placement remonte de l'ancre au premier ancêtre marqué. Nul
registre des panneaux, nulle liste d'écrans à tenir à jour dans l'infobulle : un panneau de
plus se déclare, et il est servi. Sans marque, le calcul retombe sur l'ancre — la barre
d'outils traverse l'écran, « hors du panneau » n'y voudrait rien dire, et elle garde la règle
d'avant, là où elle était juste.

**Le côté se choisit par la place, pas par le milieu de l'écran.** La bulle sort du côté du
panneau où il reste le plus de place, puis se rabat dans l'écran. C'est ce qui rend le cas des
réglages : un panneau posé au milieu a de la place des deux côtés, et l'ancienne règle — qui
comparait l'ancre au milieu de la fenêtre — ouvrait la bulle **sur le panneau lui-même** dès
que l'ancre était dans sa moitié gauche.

**La verticale suit l'ancre, pas le panneau.** Une bulle alignée sur le haut du panneau
expliquerait le réglage d'en bas depuis le haut de l'écran. Elle remonte quand elle sortirait
par le bas, et se borne sans plancher quand elle est plus haute que l'écran — un plancher la
rendrait plus haute que la place offerte, donc rognée, donc son pied inatteignable.

**Le calcul est sorti du composant pour être vérifiable.** `placer()` prend des rectangles et
rend une position ; c'est la leçon de `Toile.test.tsx`, et elle était nécessaire ici : jsdom ne
met rien en page, donc un essai qui monterait l'univers et mesurerait le recouvrement lirait
des rectangles nuls et **passerait avant comme après la correction**. L'essai d'écran vérifie
l'autre moitié — que chaque panneau se déclare — sans quoi la règle serait juste et ne
s'appliquerait à personne. Aucune des deux moitiés ne suffit ; un essai nomme l'erreur d'avant
et montre qu'elle tombe.

**Le prix payé, et il est écrit ici** : la bulle peut recouvrir *un autre* panneau. Ouverte
depuis les réglages posés au milieu, elle atterrit sur la fiche restée derrière — inerte tant
que les réglages sont ouverts. La règle protège le panneau qui porte l'ancre, celui qu'on est
en train de régler ; protéger tout l'écran demanderait de replier la bulle sous son libellé,
et ce n'est pas ce motif-là.

## Bloquée par

- rien

---

## C3 · La pièce et le calque
*16 critères · 13 US (136–148) · tenue le 29 août 2026*

**User stories** : 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148

### Ce qu'on livre

L'équipement. Le projet porte des emplacements ordonnés — la tête, le dos, les jambes — et des
pièces décrites une seule fois ; écrire un nom qui n'existe pas le crée. Chaque pièce déclare
si elle **tient dans la silhouette** ou si elle **l'agrandit**, et c'est l'auteur qui le dit.

On coche les poses qu'on veut habiller, parmi celles qui ont déjà un corps. L'atelier compose
lui-même la planche de ces corps sur une grille dont il connaît la géométrie case par case,
l'envoie avec « la même planche, avec la pièce en plus, ne touche à rien d'autre », redécoupe
le retour sur la même grille, et compare case par case l'avant qu'il connaît exactement et
l'après. **Chaque différence est un calque, propre à sa pose : N calques pour un appel.**

Rien n'est ajouté à l'image envoyée pour aider le recalage, et le corps d'origine n'est jamais
modifié. Le calque se voit superposé au corps de sa pose et se borne à un **masque rectangle**
qu'on déplace et retaille après coup sans repayer — sans lui, la différence emporte le visage,
et c'est pour ça qu'il est ici et pas en C4. Les mesures disent ce qui a bougé ; aucune ne
refuse à la place de l'auteur.

**Le seul appel payant à risque de la tranche est la toile avec marge.** Pour une pièce qui
agrandit la silhouette, l'essai du 28 août a mesuré le modèle dézoomant le personnage sur les
six candidats sans exception — échelle 0,62, 23,5 % du corps repeint. L'hypothèse est que lui
donner de la place l'en empêche ; elle n'a jamais été essayée. Si elle tombe, la pièce qui
agrandit se rabat sur le **corps habillé**, ce que la tranche livre de toute façon, et rien
d'autre ne bouge. *(Écrit avant la construction. L'appel a été tiré le 29 août 2026, six fois :
voir « Ce que la première séance a trouvé » plus bas.)*

### Critères d'acceptation

- [x] Un casque posé sur six poses d'un personnage donne six calques distincts, un par pose, après **un seul** appel payant, et le journal du projet montre un appel et non six
- [x] Chacun de ces six calques s'affiche superposé au corps de **sa** pose, et le corps d'origine de chaque pose est retrouvé **octet pour octet**
- [x] Une planche d'équipement où figurerait une pose sans corps est impossible à lancer : la pose est visiblement inéligible et porte sa raison
- [x] La planche revenue est redécoupée sur la grille exacte que l'atelier a posée, et la comparaison se fait case par case contre ce qu'il avait envoyé
- [x] Rien n'est ajouté à l'image envoyée au fournisseur : ni ancre, ni mire, ni silhouette de repère
- [x] Écrire un nom d'emplacement ou de pièce qui n'existe pas le crée sur-le-champ ; les emplacements sont ordonnés
- [x] Une pièce déclare sa portée — contenue ou qui agrandit —, le défaut est « contenue », et rien ne la devine à la place de l'auteur
- [x] Une pièce déclarée « qui agrandit », revenue à une autre échelle que celle envoyée, ne produit **aucun** calque : la dérive est nommée à l'écran et ce qui revient est **gardé** comme corps habillés
- [x] Un corps habillé est un asset ordinaire : rangé, exportable, avec son coût — il ne s'empile simplement pas
- [x] Par défaut, aucun masque n'est donné : la différence est cherchée sur toute la case
- [x] Le masque rectangle d'un calque déjà fabriqué se déplace et se retaille, le calque se recalcule, et **le journal du projet ne bouge pas d'un centime**
- [x] Le calque est rangé à côté de l'image payée et jamais écrit dedans ; revenir à la différence brute est un geste unique
- [x] Les mesures — silhouette retrouvée, corps repeint, part ajoutée, échelle au retour, objet ou poussière — s'affichent toutes, et aucune ne rend un calque impossible à garder
- [x] Aucune génération de pièce seule sur fond vide n'existe : une pièce n'apparaît que sur un corps
- [x] Le produit ne propose nulle part de reposer un calque sur une autre pose que la sienne
- [x] Réseau coupé : le masque, le recalcul de différence et la superposition fonctionnent

### Ce que la construction a décidé

Cinq décisions prises en écrivant, et qui ne sont pas dans le cadrage :

- **Un calque est un asset, et c'est sa *recette* qui le dit.** Le modèle d'objets annonçait
  « une recette, pas un fichier figé » ; la construction en tire la conséquence exacte — la
  recette gagne une **sixième place**, `différence`, juste après le détourage. Elle nomme
  l'asset du corps et le masque rectangle, et rien d'autre. Trois critères deviennent alors
  vrais par construction plutôt que par soin : le corps n'est jamais modifié — la place ne
  décrit qu'un calcul —, le masque se déplace sans un centime — c'est un rendu qu'on
  recalcule, comme depuis T2 —, et revenir à la différence brute est un geste unique — on
  vide la zone. C4 y a posé ses deux couches sans rouvrir quoi que ce soit. **Le prix est écrit
  ici** : une place de plus change l'empreinte de toutes les recettes déjà écrites, donc
  chaque rendu du disque se recalcule une fois. C'est exactement ce qu'un cache est censé
  supporter, et la seule alternative — la déclarer en queue — aurait rangé l'ordre
  d'exécution ailleurs que dans l'ordre du fichier.
- **Rien ne distingue un calque d'un corps habillé qu'un drapeau aurait dit.** Les deux
  portent la même pièce, la même pose, le même personnage ; seule la présence d'une
  différence les sépare. C'est la règle « un état dérivable ne se garde pas en double »,
  appliquée au verdict de US-148 : il n'existe nulle part une liste de calques à tenir
  d'accord avec le disque, et l'écran lit la recette.
- **La marge d'une pièce qui agrandit est exactement le dézoom que le modèle s'accordait tout
  seul.** L'essai du 28 août a mesuré 0,62 sur les six modèles sans exception ; le sujet part
  donc à 0,62 de sa case. Ce n'est pas un réglage choisi, c'est la mesure retournée — et si
  l'hypothèse tombe, le chiffre qui l'a fixée est celui qui dira pourquoi. La tolérance de
  dérive, 0,08, sort des trois mêmes mesures : 1,00 et 0,96 passent, 0,62 non, et rien
  d'intermédiaire n'a jamais été observé.
- **Une seule case qui dérive décide pour la planche entière.** Un appel, une pièce, un
  verdict : rendre trois calques et deux corps habillés du même lot aurait fait un état que
  personne ne sait lire, et la dérive est de toute façon une propriété de la façon dont le
  modèle a traité *la pièce*, pas telle ou telle pose. C'est le « tout ou rien » du compte de
  C2, appliqué au second verdict de la version.
- **Ce qui revient est gardé, pas proposé.** Ce critère disait « proposé à garder », et
  `docs/PRD.md` (US-148) dit « gardé » — c'est la question du PRD, il l'emporte, et cette
  ligne est corrigée dans la foulée. Le sens du produit est le même dans les deux cas :
  l'appel payé est acquis, rien n'est jeté. Une proposition aurait demandé un écran de plus,
  un état « en attente d'être gardé » à tenir, et un chemin où la fermeture de l'onglet perd
  ce qui est déjà payé.
- **La matrice a deux axes et se lit une colonne à la fois.** Un damier de vignettes aurait
  croisé les poses et les emplacements à l'écran — et aurait rendu à cet écran très
  exactement ce que la privation de C1 lui refuse, une seconde planche contact. On choisit
  donc la colonne qu'on lit, et la matrice reste une ligne par attitude. Le motif de C1 le
  disait déjà, mot pour mot : *on lit une colonne, on ne balaie pas une planche contact.*

**Et deux seuils que la construction a déplacés, chacun pour une raison mesurée.** Un lot de
C2 exige deux poses — une seule n'est pas un lot, c'est la génération de C1. Une planche
d'équipement en accepte **une** : il n'y a pas d'autre chemin vers un calque, et ce qui part
n'est pas un gabarit vide mais le corps lui-même. Et la planche d'équipement compte comme une
référence dès la première case, pour la même raison.

### Ce que la première séance a trouvé

**C3 a servi au navigateur, sur un personnage qui portait déjà la pièce, et ça a trouvé un
défaut qu'aucun des vingt-sept essais ne voyait.** Le recalage notait chaque échelle candidate
à *la part du corps qu'elle recouvre* — une mesure juste, et **monotone** : agrandir le revenu
finit toujours par tout recouvrir, donc le critère demandait « quelle est la plus grande
échelle ? », et la bonne réponse ne gagnait que par l'égalité. Une planche revenue intacte
était déclarée revenue à 0,58×, et le calque valait toute la silhouette au lieu du seul casque.
On cherche désormais sur le recouvrement rapporté à l'**union**, qui pénalise ce qui déborde,
et on rend la couverture au placement retenu. Le piège est dans `docs/PIEGES.md` avec ce qui
l'avait rendu invisible — les essais dessinaient des blocs pleins, qui traversent un
rééchantillonnage sans perdre un pixel, donc l'égalité tenait et le départage sauvait la mise.
**Les seize critères tiennent après correction**, et la suite du dépôt passe ce jour-là de 343
essais de serveur à 345.

**La toile avec marge n'a pas eu à servir, et le seul risque de méthode de la V2 tombe avec
elle.** Six planches payées, un seul modèle, deux pièces — un casque, et une hache, celle-ci
étant très exactement l'« arme longue » que le cadrage donnait en exemple de pièce qui agrandit
—, chacune envoyée aux deux occupations. **L'échelle au retour est restée dans la tolérance à
chaque fois, à 0,92 comme à 0,62.** L'hypothèse n'est donc pas validée : elle n'a pas été mise
à l'épreuve, faute que le dézoom qu'elle prévient se présente. La marge reste posée — elle ne
coûte rien —, et le repli n'a jamais été pris pour une autre raison que le défaut ci-dessus.
`docs/ARCHITECTURE.md` § Le risque de la version est corrigé dans la foulée : l'appel payant à
risque a été tiré, six fois.

**Et la séance a trouvé où la méthode s'arrête vraiment, ce qui n'est pas où le cadrage
l'attendait.** Le casque est revenu en poussière, sur les quatre planches où il figurait — y
compris celle que l'échelle et les mesures déclaraient bonne. Et **la hache dit les deux
moitiés du défaut à elle seule** : son fer, qui dépasse de la silhouette, revient entier au
pixel près ; son manche, là où il croise le bras, ne revient pas. Ce qui décide n'est donc ni
l'échelle ni la taille de la pièce, mais la place qu'elle prend : ce qui **s'ajoute** hors du
corps relève d'`ajout`, et rien ne peut l'effacer ; ce qui **se substitue** à l'intérieur
relève de `touche`, et la comparaison de couleur — tolérante au voisin de 3×3 pour ne pas
compter un résidu de recalage comme du repeint — l'efface avec le bruit. Deux décisions justes
séparément, dont la composition perd la pièce. Le cadrage oppose *contenue* et *qui agrandit* ;
ce qui décide est *ajoute* contre *substitue*, et les deux découpes ne se recouvrent pas. Ce
n'est ni cadré ni planifié : c'est dans `docs/releve-usage.md`. **C4 l'a rattrapé le 29 août
sans le supprimer** : sa retouche ramène ce que la mesure n'a pas vu — 451 pixels contre 1 044
sur ce casque-ci —, mais rien n'annonce toujours *d'avance* qu'une pièce va se substituer.

**Enfin, la séance laisse quatre images fausses sur le disque, et la question qui va avec.**
Deux calques figés sur un mauvais recalage, et deux corps habillés qui n'en sont pas — la
dérive ayant été prononcée sur une échelle inventée. Repassées dans le recalage corrigé, les
six planches reviennent dans la tolérance. Rien n'est perdu : les planches payées sont sur le
disque, les corps aussi, et la mesure juste coûte des millisecondes. Le produit, lui, ne sait
pas s'en servir.

**La décision : une planche déjà dépliée ne réaccouche jamais ; ce qu'elle a calculé se
rejoue.** Redéplier créerait N assets de plus, à des rangs neufs, et il faudrait supprimer les
anciens — or un calque désigne son corps par identifiant, donc redéplier un lot de corps de C2
laisserait orphelins tous les calques posés dessus. Ce n'est pas un geste, c'est un piège. Ce
qui se rejoue est le **calcul** du dépliage, sur les assets qu'il a déjà produits : même
identifiant, même rang, même fichier, même place en bibliothèque, et le journal du projet ne
bouge pas d'un centime.

Le périmètre exact est **l'alignement, et le verdict qui en dépend** — rien de plus, parce que
rien de plus n'est figé : le seuil, le masque et le calcul de différence vivent déjà dans la
recette et se rejouent à chaque rendu. Et l'écriture est légitime pour une raison qui vaut
au-delà du calque : **le brut d'un calque n'a jamais été l'image payée.** L'image payée est la
planche, et elle n'est pas touchée ; le brut du calque est déjà un dérivé — la case découpée
puis recalée —, au même titre que le brut d'une découpe de T5. Un brut dérivé est un cache, et
un cache se recalcule. C'est **R5**, ci-dessous.

## Bloquée par

- C1 — une pièce se pose sur un corps, et le corps vient du plan de poses
- C2 — la planche d'équipement **est** le pliage de C2, appliqué à des corps existants. La
  construire à côté serait un doublon de la grille, du gabarit et du découpeur

---

## R5 · Un calque se recale sans repayer
*9 critères · 1 US (173) · tenue le 29 août 2026*

**User stories** : 173

### Ce qu'on livre

Le recalage d'un calque se rejoue depuis la planche qui l'a payé. **Rien n'est créé, rien n'est
supprimé** : l'asset garde son identifiant, son rang, son fichier, son label, ses collections,
son état de favori et son masque ; son alignement, ses cinq mesures et le verdict calque /
corps habillé se recalculent. Le geste est gratuit et local — la planche et les corps sont sur
le disque —, et le journal du projet ne bouge pas d'un centime.

**Ce n'est pas un dépliage de plus, et c'est la moitié de la décision.** Une planche déjà
dépliée ne donne jamais naissance une seconde fois : des rangs neufs laisseraient orphelins les
calques qui désignent leur corps par identifiant, et il faudrait supprimer les anciens assets
pour ne pas doubler la matrice. Ce qui se rejoue est le calcul, sur les assets déjà nés.

Le verdict se rejoue **par planche**, jamais par case : *un appel, une pièce, un verdict* est
l'invariant de C3, et le rejeu ne le rouvre pas.

Ce qui rend l'écriture légitime tient en une phrase, et elle dépasse le calque : **le brut d'un
calque n'a jamais été l'image payée.** L'image payée est la planche, et le rejeu n'y touche
pas ; le brut du calque est déjà un dérivé — la case découpée puis recalée —, au même titre que
le brut d'une découpe de T5. **Un brut dérivé est un cache**, et un cache se recalcule.

**Ce que la reprise ne fait pas** : elle ne rejoue ni le seuil, ni le masque, ni le calcul de
différence — ceux-là vivent déjà dans la recette et se recalculent à chaque rendu depuis C3. Le
périmètre est l'alignement, et le verdict qui en dépend.

### Critères d'acceptation

- [x] Le recalage d'un calque se rejoue depuis la planche de sa génération, et **le journal du projet ne bouge pas d'un centime**
- [x] L'asset rejoué garde son identifiant, son rang, son label, ses collections, son état de favori et son masque
- [x] Le verdict calque / corps habillé se rejoue **pour la planche entière**, jamais pour une case seule
- [x] Un corps habillé qui redevient un calque garde son identifiant : aucun calque désignant un corps par identifiant ne perd sa base
- [x] Une planche absente du disque refuse le rejeu **en le disant**, et ne touche à rien
- [x] Une image qui n'est pas sortie d'une planche d'équipement refuse **en le disant**, plutôt que de rendre une liste vide qui passerait pour un succès
- [x] Aucun rang neuf ne naît d'une planche déjà dépliée, par ce geste ni par un autre
- [x] L'image payée — la planche — n'est jamais réécrite
- [x] Réseau coupé : le rejeu fonctionne

### Ce que la construction a décidé

**Le calcul du dépliage est sorti dans une lecture partagée.** Le dépliage et le rejeu doivent
tomber sur exactement le même résultat, sans quoi recaler changerait l'image pour une raison
qui n'est pas le défaut qu'on répare. Une seule fonction lit donc la planche et rend les N
retours ; `deplier` en fait naître des assets, `recaler` en repose ceux qui existent. C'est la
raison qui avait déjà sorti le découpage de `deplier` en C3, appliquée un cran plus haut.

**La recette n'est remplacée que si le verdict a changé.** Un calque qui reste calque garde la
sienne, zone comprise ; un corps habillé qui reste corps habillé garde la sienne, retouches
comprises. Repartir de zéro à chaque rejeu effacerait le détourage ou la grille que l'auteur a
posés à la main, sans que rien ne l'ait demandé — et le masque, qui est du travail de la main
et non un résultat de mesure, ne survivrait pas à un geste censé ne rien coûter.

**Le geste part d'une image et agit sur sa planche**, parce que c'est ce qui préserve *un
appel, une pièce, un verdict*. Un rejeu case par case aurait pu rendre trois calques et deux
corps habillés du même lot — très exactement l'état que C3 refuse de produire.

**Ce que le rejeu a mesuré sur les six planches du 29 août, et qui n'était pas prévu** : **cinq
sur six bougent**, pas quatre. Aux deux calques manifestement faux et aux deux corps habillés
prononcés sur une échelle inventée s'ajoute un calque dont l'échelle était pourtant juste et
dont le *placement* se déplace — le critère monotone départageait aussi les décalages, pas
seulement les échelles. La sixième, seule produite après la correction, revient **identique**.
C'est la meilleure vérification qu'on pouvait souhaiter : le rejeu est fidèle là où il n'y a
rien à réparer, et il ne change que ce que le défaut avait changé.

## Bloquée par

- C3 — il n'y a pas de calque à recaler avant elle

---

## C4 · La main

**User stories** : 149, 150, 151, 152, 153

### Ce qu'on livre

Ce que le rectangle ne sait pas dire. Le masque s'affine à main levée puis au pixel ; le calque
se retouche au pixel avec le corps visible en repère dessous, pour corriger sans perdre
l'alignement ; l'avant et l'après se comparent d'un seul geste. Et ce qui reste à regarder se
trie en commençant par le pire, pour attaquer par ce qui va poser problème. Les deux couches —
le masque et la retouche au pixel — restent séparées et rejouables : aucune ne détruit l'autre,
exactement comme les passes de recette de T2.

C4 apporte la finesse, jamais la fonction : C3 est utilisable sans elle.

*(**Écrit avant, et à moitié démenti par l'écriture.** Le masque affiné est bien de la finesse.
La retouche, elle, ne l'est pas : elle **ramène** ce que la mesure n'a pas vu, et c'est le seul
geste du produit qui répare une pièce qui se substitue au corps au lieu de s'y ajouter — le
défaut trouvé le 29 août 2026 à la première séance de C3. Sans elle, ces calques-là restaient
illisibles quoi qu'on règle. La phrase reste vraie de la moitié gauche de la tranche, et fausse
de la droite ; elle est gardée telle quelle parce que c'est ce qu'on croyait en planifiant.)*

### Critères d'acceptation

- [x] Un masque s'affine à main levée, puis au pixel, sans repayer d'image
- [x] Un calque se retouche au pixel avec le corps affiché en repère sous lui
- [x] L'avant et l'après se comparent d'un seul geste
- [x] Les calques restant à regarder se trient par la mesure la plus défavorable, le pire en tête
- [x] Le masque et la retouche au pixel sont deux couches distinctes de la recette : modifier le masque ne détruit pas la retouche, et inversement
- [x] Chaque couche s'annule, se rejoue et se nomme, comme toute recette depuis T2
- [x] Aucune de ces opérations n'appelle le fournisseur ni ne mobilise la carte graphique

### Ce que C4 a tranché en écrivant

**La retouche ne fait pas que retirer : elle ramène.** C'était le choix décisif, et il n'était
pas dans le cadrage. Une couche qui n'aurait su qu'effacer aurait laissé le défaut du 29 août
entier — *la différence trouve ce qui s'ajoute et manque ce qui se substitue* —, puisque aucun
réglage de masque ne fabrique une différence que la comparaison de couleur n'a pas vue. La
seconde couche tranche donc **après** la mesure et dans les deux sens : elle ôte ce qui est en
trop, et elle ramène les pixels revenus là où la mesure n'a rien trouvé. Mesuré le 29 août 2026
sur le casque de la séance : 451 pixels de poussière, 1044 après un seul passage de la main, et
le casque est lisible.

**Une couche est un vecteur, jamais une image.** Ce qu'on enregistre est le chemin parcouru et
son rayon. Un masque en octets aurait pesé la taille de l'image à chaque geste, et surtout il
aurait perdu ce qui fait une recette : se rejouer. Le prix : la rasterisation doit être
déterministe, ce qui est déjà un critère depuis T2.

**Rayon zéro est le pixel.** « À main levée, puis au pixel » n'est pas deux outils mais les
deux bouts d'un seul réglage — même liste de points, même rasterisation, un nombre de
différence. Deux chemins de code séparés auraient fini par ne plus se rejoindre au rayon 1.

**L'ordre est le pire, et c'est un choix, pas le défaut.** Le plan du jeu reste l'ordre des
rangées, parce que c'est l'ordre de l'auteur et le seul dans lequel une case *vide* se lit ; le
tri par le pire est à un clic et se nomme. « Ce qui reste à regarder » ne s'écrit nulle part :
c'est un calque sur lequel la main n'est pas passée, et ça se lit dans sa recette.

**Un défaut de C3 est tombé avec** : un calque dont le corps a changé de taille — parce que la
cible de pixel du projet a bougé depuis — ne se rendait plus du tout. C4 l'a révélé plutôt que
causé, en changeant l'empreinte de toutes les recettes de calque, donc en les faisant toutes
recalculer. Un corps qui a changé de taille est désormais traité comme un corps disparu, et le
geste qui répare est le rejeu du recalage (`docs/PIEGES.md`).

## Bloquée par

- C3 — on ne retouche à la main que ce que la différence a produit

---

## C5 · La sortie — le dossier du jeu, et l'agent

**User stories** : 154, 155, 156, 157

### Ce qu'on livre

Le personnage part dans le jeu. Ses poses et ses calques s'exportent dans le dossier du jeu,
utilisables sans manipulation, accompagnés d'un descriptif qui nomme chaque fichier, sa pose et
sa pièce. **L'atelier décrit, l'agent écrit** : le descriptif dit ce qu'est chaque fichier,
l'agent en tire les lignes de catalogue de son jeu, et l'atelier n'écrit jamais de code de jeu
ni n'invente de structure. Et l'agent dispose sur les personnages et les calques exactement des
mêmes gestes que l'écran — ni plus, ni moins, comme depuis T7.

### Critères d'acceptation

- [x] Un personnage complet s'exporte dans le dossier du jeu avec un descriptif qui nomme chaque fichier, sa pose et sa pièce
- [x] Ce qui part est le **rendu**, jamais l'image payée qui reste dans l'atelier, et le descriptif dit lequel il est — comme en T6
- [x] Les trois règles du dossier de jeu de T7 tiennent : dossier manquant créé, fichier existant jamais écrasé, dossier non inscriptible refusé avec son chemin
- [x] L'agent ajoute une pose au plan d'un personnage existant et la génère **sans que l'écran soit ouvert**
- [x] Les outils MCP de la V2 n'ont aucune logique propre : chacun appelle un service que l'écran appelle déjà, et n'offre aucun geste que l'écran n'a pas
- [x] Les garde-fous de T7 s'appliquent aux appels de la V2 : au plafond, l'agent reçoit un refus qui nomme le plafond et le moyen de le relever, sans aucune invite à l'écran
- [x] L'atelier n'écrit aucune ligne de code de jeu, et aucun chemin de fichier n'est inventé par l'agent
- [x] Export d'un personnage sans aucune pose remplie : l'action est grisée avec sa raison, comme toute action indisponible du produit

### Ce que C5 a tranché en écrivant

**Ce qui sort est ce que la matrice retient — un corps par pose, un calque par pièce.** Le
choix décisif, et il n'était pas dans le cadrage : sortir les quatre variations d'une pose
aurait rendu le tri à qui ouvre le dossier, alors que l'auteur y a déjà répondu en marquant
son favori. La règle n'est pas neuve — c'est `corps_retenu`, celle qui compose déjà la
planche d'équipement —, et c'est le second endroit qui la lit plutôt qu'un second barème.
Une pose sans corps ne sort pas, ses calques compris : un calque est une différence posée
sur un corps, et seul dans un dossier de jeu il ne se pose sur rien.

**Tout ce qui porte une pièce n'est pas un calque, et le premier vrai personnage sorti l'a
prouvé.** Une pièce qui agrandit la silhouette et revient à une autre échelle est gardée comme
un **corps habillé** (US-148) : la même image, entière, qui ne s'empile pas. Le descriptif
portait « calque » pour les deux — donc un fichier montrant un nain entier annoncé comme une
surcouche à empiler, et rien à l'autre bout pour s'en apercevoir avant de le voir à l'écran.
Le rôle vient maintenant de `Recette.calque`, c'est-à-dire de la même question que l'écran
pose déjà pour afficher « ceci n'est pas un calque ». Trois rôles, donc : `corps`, `calque`,
`corps_habille`.

**L'atelier pose des fichiers à plat ; il n'invente pas d'arborescence.** Pas de sous-dossier
par personnage, pas de convention de moteur. « Aucune structure inventée » ne s'arrête pas au
code : un dossier `sprites/héros/` créé d'office est une décision de rangement prise pour un
jeu dont l'atelier ne sait rien. Ce qui remplace la structure, c'est le descriptif — et il
porte le **rang de l'emplacement**, sans quoi un agent qui empile un casque et une cape doit
inventer lequel passe devant.

**Un seul descriptif dans tout le produit.** L'archive de T6 et le dossier de C5 écrivent la
même fiche, par le même code ; C5 n'y ajoute que ce que la V2 sait de plus — le rôle, la
pose, la pièce. Deux formats auraient divergé au premier champ ajouté d'un seul côté, et le
numéro de format n'aurait plus rien appris à personne.

**Le sujet d'une case est descendu dans le service, et c'est C5 qui l'a exigé.** L'écran le
composait lui-même depuis C1 — signalement du personnage et nom de l'attitude pour une case,
signalement seul pour un lot, description de la pièce pour une planche d'équipement. L'agent
arme les mêmes cases : deux compositions à deux endroits auraient fini par demander deux
choses différentes pour la même case, sans que rien ne le signale. `ServiceProduction.sujet`
l'écrit une fois, l'écran le demande en armant, le MCP l'appelle en générant. Le prix est un
aller-retour de plus sur un geste local — accepté, parce qu'armer est gratuit et que l'aperçu
en fait déjà un juste derrière.

**Le MCP a perdu sa dernière logique au passage.** `export_assets` rouvrait l'archive de T6
pour en ressortir les fichiers un par un : c'était la seule fonction du serveur qui *faisait*
quelque chose, donc la seule entorse à l'invariant de T7. Le geste vit dans le service
(`export.deposer`), les deux sorties le partagent, et l'essai qui lit les imports interdit
désormais `zipfile` en plus des quatre autres.

**Cinq outils, et pas les gestes de finesse de C4.** Lire, compléter le plan, remplir,
habiller, livrer : la boucle entière de la V2 au grain épais de T7. Borner une zone, affiner
un masque ou retoucher au pixel demandent un œil sur l'image — un agent qui le ferait à
l'aveugle abîmerait ce que la mesure vient de produire. L'invariant tient dans le sens qui
compte : aucun geste que l'écran n'a pas.

## Bloquée par

- C3 — un personnage se livre avec ses calques, et il n'y a rien à livrer sans eux
- C4 est **recommandée mais non bloquante** : on peut livrer des calques non retouchés.
  C'est ce qui a permis de l'écrire pendant que la main de C4 s'éprouvait encore.. Elle
  est faite depuis le 29 août 2026, donc la question ne se pose plus.

---

## Ce que ce plan ne couvre pas

La V3 — l'animation de sprites —, la V4 — les tuiles qui se raccordent — et la V5 — le son —
sont décrites en `ARCHITECTURE.md` §8 à §10, et ne sont pas découpées ici. Elles ne
commencent pas avant que la V2 serve pour de vrai, comme la V2 n'a commencé qu'une fois la V1
tenue.

Quatre points restent ouverts, et aucune tranche ne les présuppose :

- **La différence trouve ce qui s'ajoute, et manque ce qui se substitue.** C'est le risque de
  méthode qui reste en V2, et il a remplacé le précédent le 29 août 2026. Sur les six planches
  de la première séance de C3, la hache est revenue en calque net et le casque en poussière :
  une pièce qui déborde de la silhouette est trouvée entière, une pièce qui remplace ce qu'il y
  avait à sa place — un casque sur une chevelure, même empreinte, valeurs voisines — est effacée
  avec le bruit de rééchantillonnage que la comparaison de couleur est faite pour absorber. Le
  cadrage oppose *contenue* et *qui agrandit* ; ce qui décide est *ajoute* contre *substitue*, et
  les deux découpes ne se recouvrent pas. Ce n'est ni cadré ni planifié — `docs/releve-usage.md`
  le porte.
  *(**C4 l'a rattrapé sans le supprimer**, le 29 août 2026 : la retouche au pixel ramène ce que
  la mesure n'a pas vu, et le casque de la séance est revenu lisible d'un seul passage. Ce qui
  reste ouvert est la **détection** — le produit ne dit toujours pas d'avance qu'une pièce va se
  substituer, il laisse l'auteur le voir et le corriger à la main. Le risque a donc changé de
  gravité, pas de nature : il coûte désormais un geste, plus une image illisible.)*
  *(Ce plan a porté un temps « la toile avec marge n'a jamais été essayée » comme risque
  principal de la V2, et avant elle « le report d'un calque sur une autre pose ». La seconde
  était fausse — un calque est solidaire de sa pose. La première est levée : six planches
  payées le 29 août 2026 sont revenues dans la tolérance d'échelle, à 0,92 comme à 0,62. Le
  dézoom que la marge prévient ne s'est pas présenté, la marge reste posée puisqu'elle ne coûte
  rien, et le repli n'a jamais eu à servir.)*
- **La quantification reste liée à la palette, et R2 ne la débrance pas.** Un projet qui choisit « aucune » comme taille de pixel reçoit encore ses images ramenées sur la palette dès qu'un artwork officiel existe : pour qu'elle se taise, il faut n'en promouvoir aucun. C'est atteignable mais indirect, et c'est une limite acceptée le 28 août 2026 plutôt qu'un oubli. Si une séance montre qu'un projet veut la palette **sans** la quantification — la lire pour s'y tenir à la main, sans que l'image y soit forcée —, c'est un réglage de plus dans le même bloc, pas une tranche.
- **La recette d'animation** est le risque de la V3. Une piste sérieuse a été observée le
  26 août 2026 ; elle demande un prototypage dédié avant tout engagement.
- **Le coût croît avec le nombre de références chez certains fournisseurs et pas chez
  d'autres.** Le regroupement par famille livré en T4 limite l'envoi, mais un univers riche
  renchérit quand même et peut inverser le classement des modèles par coût. Le pliage tire
  dans l'autre sens — il divise le prix d'une planche par quatre en C2, et le prix d'un jeu de
  calques par N en C3. À surveiller dès les premières séances réelles.
