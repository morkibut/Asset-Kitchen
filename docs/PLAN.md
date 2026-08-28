# Plan : Asset Kitchen — V1, puis V2

> **PRD source** : `docs/PRD.md` — 157 user stories.
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
| **Calque** *(personnage)* | C3 | planche payée et sa case, pièce, **pose**, recette de différence, zone, masque rectangle, mesures | C4 (masque libre et couche de retouche au pixel) |

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

Avec les 114 de la V1, le PRD est couvert de bout en bout : **157 user stories, une tranche
chacune.**

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

Cinq décisions prises en écrivant, et qui ne sont pas dans le cadrage :

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

## C3 · La pièce et le calque

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
d'autre ne bouge.

### Critères d'acceptation

- [ ] Un casque posé sur six poses d'un personnage donne six calques distincts, un par pose, après **un seul** appel payant, et le journal du projet montre un appel et non six
- [ ] Chacun de ces six calques s'affiche superposé au corps de **sa** pose, et le corps d'origine de chaque pose est retrouvé **octet pour octet**
- [ ] Une planche d'équipement où figurerait une pose sans corps est impossible à lancer : la pose est visiblement inéligible et porte sa raison
- [ ] La planche revenue est redécoupée sur la grille exacte que l'atelier a posée, et la comparaison se fait case par case contre ce qu'il avait envoyé
- [ ] Rien n'est ajouté à l'image envoyée au fournisseur : ni ancre, ni mire, ni silhouette de repère
- [ ] Écrire un nom d'emplacement ou de pièce qui n'existe pas le crée sur-le-champ ; les emplacements sont ordonnés
- [ ] Une pièce déclare sa portée — contenue ou qui agrandit —, le défaut est « contenue », et rien ne la devine à la place de l'auteur
- [ ] Une pièce déclarée « qui agrandit », revenue à une autre échelle que celle envoyée, ne produit **aucun** calque : la dérive est nommée à l'écran et ce qui revient est proposé à garder comme corps habillés
- [ ] Un corps habillé est un asset ordinaire : rangé, exportable, avec son coût — il ne s'empile simplement pas
- [ ] Par défaut, aucun masque n'est donné : la différence est cherchée sur toute la case
- [ ] Le masque rectangle d'un calque déjà fabriqué se déplace et se retaille, le calque se recalcule, et **le journal du projet ne bouge pas d'un centime**
- [ ] Le calque est rangé à côté de l'image payée et jamais écrit dedans ; revenir à la différence brute est un geste unique
- [ ] Les mesures — silhouette retrouvée, corps repeint, part ajoutée, échelle au retour, objet ou poussière — s'affichent toutes, et aucune ne rend un calque impossible à garder
- [ ] Aucune génération de pièce seule sur fond vide n'existe : une pièce n'apparaît que sur un corps
- [ ] Le produit ne propose nulle part de reposer un calque sur une autre pose que la sienne
- [ ] Réseau coupé : le masque, le recalcul de différence et la superposition fonctionnent

## Bloquée par

- C1 — une pièce se pose sur un corps, et le corps vient du plan de poses
- C2 — la planche d'équipement **est** le pliage de C2, appliqué à des corps existants. La
  construire à côté serait un doublon de la grille, du gabarit et du découpeur

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

### Critères d'acceptation

- [ ] Un masque s'affine à main levée, puis au pixel, sans repayer d'image
- [ ] Un calque se retouche au pixel avec le corps affiché en repère sous lui
- [ ] L'avant et l'après se comparent d'un seul geste
- [ ] Les calques restant à regarder se trient par la mesure la plus défavorable, le pire en tête
- [ ] Le masque et la retouche au pixel sont deux couches distinctes de la recette : modifier le masque ne détruit pas la retouche, et inversement
- [ ] Chaque couche s'annule, se rejoue et se nomme, comme toute recette depuis T2
- [ ] Aucune de ces opérations n'appelle le fournisseur ni ne mobilise la carte graphique

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

- [ ] Un personnage complet s'exporte dans le dossier du jeu avec un descriptif qui nomme chaque fichier, sa pose et sa pièce
- [ ] Ce qui part est le **rendu**, jamais l'image payée qui reste dans l'atelier, et le descriptif dit lequel il est — comme en T6
- [ ] Les trois règles du dossier de jeu de T7 tiennent : dossier manquant créé, fichier existant jamais écrasé, dossier non inscriptible refusé avec son chemin
- [ ] L'agent ajoute une pose au plan d'un personnage existant et la génère **sans que l'écran soit ouvert**
- [ ] Les outils MCP de la V2 n'ont aucune logique propre : chacun appelle un service que l'écran appelle déjà, et n'offre aucun geste que l'écran n'a pas
- [ ] Les garde-fous de T7 s'appliquent aux appels de la V2 : au plafond, l'agent reçoit un refus qui nomme le plafond et le moyen de le relever, sans aucune invite à l'écran
- [ ] L'atelier n'écrit aucune ligne de code de jeu, et aucun chemin de fichier n'est inventé par l'agent
- [ ] Export d'un personnage sans aucune pose remplie : l'action est grisée avec sa raison, comme toute action indisponible du produit

## Bloquée par

- C3 — un personnage se livre avec ses calques, et il n'y a rien à livrer sans eux
- C4 est **recommandée mais non bloquante** : on peut livrer des calques non retouchés

---

## Ce que ce plan ne couvre pas

La V3 — l'animation de sprites —, la V4 — les tuiles qui se raccordent — et la V5 — le son —
sont décrites en `ARCHITECTURE.md` §8 à §10, et ne sont pas découpées ici. Elles ne
commencent pas avant que la V2 serve pour de vrai, comme la V2 n'a commencé qu'une fois la V1
tenue.

Trois points restent ouverts, et aucune tranche ne les présuppose :

- **La toile avec marge n'a jamais été essayée** — c'est le seul risque de méthode qui reste
  en V2, et il se lève en un appel payant dans C3. L'idée que donner de la place au modèle
  l'empêche de dézoomer sur une pièce qui agrandit la silhouette est plausible et non mesurée.
  Si elle tombe, la pièce qui agrandit se rabat sur le corps habillé, que C3 livre de toute
  façon. *(Ce plan a porté un temps « le report d'un calque sur une autre pose » comme risque
  principal de la V2. C'en était un faux : un calque est solidaire de sa pose, il en faut un
  par pose, et c'est le pliage qui en divise le prix. Retiré le 28 août 2026.)*
- **La recette d'animation** est le risque de la V3. Une piste sérieuse a été observée le
  26 août 2026 ; elle demande un prototypage dédié avant tout engagement.
- **Le coût croît avec le nombre de références chez certains fournisseurs et pas chez
  d'autres.** Le regroupement par famille livré en T4 limite l'envoi, mais un univers riche
  renchérit quand même et peut inverser le classement des modèles par coût. Le pliage tire
  dans l'autre sens — il divise le prix d'une planche par quatre en C2, et le prix d'un jeu de
  calques par N en C3. À surveiller dès les premières séances réelles.
