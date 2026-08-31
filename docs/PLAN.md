# Plan : Asset Kitchen — V1, V2, puis la V2.1

> **PRD source** : `docs/PRD.md` — **308 user stories, toutes couvertes ici.**
> **Découpage** : les sept tranches T1→T7 ont été décidées le 26 août 2026, à l'établissement
> de `docs/archi-versions.md` §6.3. Ce plan ne les redécoupe pas : il leur accroche les user
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
> **Les vingt-et-une étapes E0 à E20 sont venues le 31 août 2026**, du chantier de maquettes
> de `docs/maquettes-v2.1/` — vingt-six écrans dessinés, quarante-et-une décisions prises. Elles
> ne s'intercalent nulle part : **aucune tranche de T1 à R5 ne change d'ordre ni de contenu.**
> Ce qu'elles refont n'est pas ce que l'atelier fabrique, c'est l'endroit d'où on le fabrique.
>
> **Le détail de chaque tranche vit dans `docs/tranches/<code>.md`** — vingt fichiers,
> un par tranche : ce qu'elle livrait, ses critères cochés un par un, ce qui la bloquait,
> et ce que s'en servir a trouvé. Ils ne font foi sur rien, et ne se lisent qu'à la
> demande — vingt tranches finies n'aident pas à en ouvrir une vingt-et-unième.
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
`docs/tranches/T1.md` à `docs/tranches/T10.md`**, qui ne font foi sur rien et qu'on
ouvre à la demande.

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
son** — `docs/archi-versions.md` §7 à §10 suit cette numérotation.

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

Avec les 114 de la V1 et les 43 de la V2, les 173 premières user stories du PRD ont chacune
leur tranche. **Les 135 suivantes — `US-174` à `US-308` — sont celles de la V2.1, et leur
couverture est plus bas.** Total : **308 user stories, une tranche chacune.**

---

### C1 · Le personnage, son plan, une pose, et ce qui part avec elle
*18 critères · 13 US (115–127) · tenue le 28 août 2026*

Un personnage se crée dans un projet et se décrit une fois : son signalement ne se retape
plus à chaque prompt. Le projet porte un plan de poses qu'il a déjà au premier lancement, et
chaque personnage dit lesquelles il tient — un figurant ne réclame pas les images d'un héros.
Une matrice montre ce qui est fait et ce qui manque, et on lance depuis là **une pose à la
fois**. Ce qui part avec elle se lit ligne par ligne avec sa provenance, et se décoche à trois
portées : cette génération, ce personnage, tout le projet.

### C2 · Le lot plié
*12 critères · 8 US (128–135) · tenue le 28 août 2026*

La même chose que C1, pour une fraction du prix : les poses cochées partent en **un seul
appel**, et la planche qui revient se déplie toute seule en autant d'images qu'il y avait de
cases. Compte faux, rien n'entre et le lot se relance d'un geste ; compte bon, chaque pose
redevient jugeable et régénérable seule. **Le pliage construit ici est une fonction générale de
l'atelier** — habiller ou transformer N images d'un seul appel —, et C3 le réemploie tel quel.

### C3 · La pièce et le calque
*16 critères · 13 US (136–148) · tenue le 29 août 2026*

L'équipement. Le projet porte des emplacements ordonnés et des pièces décrites une seule
fois, chacune déclarant si elle tient dans la silhouette ou si elle l'agrandit. L'atelier
compose la planche des corps à habiller, l'envoie, redécoupe le retour sur la grille qu'il a
posée lui-même, et compare case par case : **chaque différence est un calque, propre à sa
pose**. Rien n'est ajouté à l'image envoyée pour aider le recalage, le corps d'origine n'est
jamais modifié, et un masque rectangle borne le calque sans repayer.

### C4 · La main
*7 critères · 5 US (149–153) · tenue le 29 août 2026*

Ce que le rectangle ne sait pas dire : le masque s'affine à main levée puis au pixel, le
calque se retouche avec le corps visible en repère dessous, l'avant et l'après se comparent
d'un geste, et ce qui reste à regarder se trie en commençant par le pire. Les deux couches
restent séparées et rejouables. La tranche ne devait apporter que de la finesse ; l'écriture
l'a démentie à moitié — **la retouche ramène ce que la mesure n'a pas vu**, et c'est le seul
geste qui répare une pièce qui se substitue au corps au lieu de s'y ajouter.

### C5 · La sortie — le dossier du jeu, et l'agent
*8 critères · 4 US (154–157) · écrite le 29 août 2026, **pas encore usée***

Le personnage part dans le jeu : ses poses et ses calques sont posés dans le dossier du jeu
avec un descriptif qui nomme chaque fichier, sa pose et sa pièce. **L'atelier décrit, l'agent
écrit** — l'atelier n'écrit jamais de code de jeu et n'invente aucune structure. Et l'agent
dispose sur les personnages et les calques exactement des gestes de l'écran, ni plus ni moins,
comme depuis T7.

---

## Les cinq reprises — R1 à R5

Le chapeau dit d'où elles viennent. Ce qui appartient à l'ordre, et à lui seul : **aucune
ne dépend d'une autre**, sauf R1, mise en tête parce qu'elle coûte quelques heures et que
**R2 ne se juge pas sans elle** — changer une taille de pixel sans voir l'écran la prendre,
c'est régler à l'aveugle. Et R5 suppose C3, dont elle répare la première séance.

**L'ordre dans lequel les dix ont été prises**, qui est celui de la valeur et non des
dépendances : C1, C2, R1, R2, R3, R4, C3, R5, C4, C5.

### R1 · Le réglage d'univers se voit à l'instant
*6 critères · 2 US (165–166) · tenue le 28 août 2026*

Une correction, pas une fonctionnalité : le réglage était bien écrit sur le disque, il ne
remontait pas. **Deux causes indépendantes pour un seul symptôme** — le service n'annonçait le
changement que lorsque l'empreinte de palette bougeait, et l'écran jetait par ailleurs la
réponse au lieu de la poser. Les deux se corrigent, alors qu'une seule suffirait à faire
disparaître le symptôme : un écran qui ne sait pas poser ce qu'on lui rend est un piège qui se
réveillera ailleurs.

### R2 · Ce qui décide de l'apparence se voit et se règle
*13 critères · 7 US (158–164) · tenue le 29 août 2026*

Le prompt exact se lit avant de partir, dans l'ordre où il part, et se bascule en édition
libre pour cette génération-là — sans que la bible soit touchée. La bible gagne deux champs
nommés, la vue et le cadrage puis la technique de rendu, et **la liste close reste close** :
c'est le dosage qui fait sa valeur, pas le texte libre. La taille de pixel accepte « aucune »,
donc la remise sur grille cesse d'être sans échappatoire. Et la fiche dit enfin ce que le
projet a imposé à l'image affichée.

### R3 · Faire entrer une image depuis l'écran
*10 critères · 4 US (167–170) · tenue le 29 août 2026*

Le geste que l'agent avait depuis T7 et que l'écran n'avait jamais eu : un bouton, et le
glisser-déposer depuis le bureau. Une route qui prend les **octets** — celle qui existait prend
un chemin, ce qu'un navigateur ne donne jamais — et qui appelle le même service que l'outil
MCP : il n'y a toujours qu'un seul endroit qui fasse entrer une image. On dit au moment du
geste si le traitement du projet s'applique, et le défaut est « telle quelle ».

### R4 · L'infobulle ne couvre plus le réglage
*6 critères · 2 US (171–172) · tenue le 29 août 2026*

La bulle choisissait son côté par rapport au milieu de l'écran : juste à l'atelier, faux
partout où l'écran n'est que du réglage — la surface d'à côté y est encore du réglage, et la
bulle atterrissait dessus. Elle se place désormais par rapport au **panneau qui porte l'ancre**,
et se rabat dans l'écran comme avant. Le motif, le pointillé, la durée de repos et l'épingle ne
changent pas : seule la mesure de la place change.

### R5 · Un calque se recale sans repayer
*9 critères · 1 US (173) · tenue le 29 août 2026*

Le recalage se rejoue depuis la planche qui l'a payé : rien n'est créé, rien n'est supprimé,
l'asset garde tout, et seuls son alignement, ses mesures et son verdict se recalculent. **Une
planche déjà dépliée ne réaccouche jamais** — des rangs neufs laisseraient orphelins les calques
qui désignent leur corps par identifiant. Ce qui rend le geste légitime tient en une phrase, et
elle dépasse le calque : **le brut d'un calque n'a jamais été l'image payée**. C'est un dérivé,
donc un cache, et un cache se recalcule.

---

## V2.1 — L'interface refaite

*Vingt-et-une étapes, décidées le 31 août 2026.* Elles viennent du chantier de maquettes de
`docs/maquettes-v2.1/` : vingt-six écrans dessinés, quarante-et-une décisions prises,
vingt-cinq arbitrages tranchés en autonomie — dont deux pris en construisant — et
dix-sept questions laissées ouvertes, dont une déjà répondue par un banc gratuit —
`docs/v21-arbitrages.md` les tient toutes, et ne fait foi sur rien.

**Ce qui a déclenché le chantier est une mesure, pas une envie.** Le produit fabriquait bien
et se laissait mal conduire : dix-sept appels payés sur vingt-huit sont partis **sans une
seule image de référence** alors que les modèles en acceptent quatorze à seize ; onze pour
cent de l'argent est parti **sans jeu ouvert**, donc sans univers pour contraindre l'image ;
la bande de réglages de l'univers faisait **1 843 px de haut dans 646 visibles** et la
première image d'inspiration attendait à **4 161 px de défilement** ; vingt-et-une des
quarante-huit images du dépôt n'ont **jamais été retouchées**, non par choix mais parce que
les outils se réglaient sur une vignette. Aucun de ces cinq chiffres ne dit qu'il manque une
capacité. Tous les cinq disent la même chose : **l'écran est le frottement.**

**Le critère de découpage ne bouge pas** — celui de la V1 et de la V2, mot pour mot :
*chaque tranche est utilisable à sa livraison, et on ne passe à la suivante que lorsque la
précédente sert vraiment.*

**Ce qui rend cette version différente des deux autres, et qu'il faut dire d'avance** : la
V1 et la V2 ajoutaient des capacités, la V2.1 en ajoute très peu. Cinq seulement — le trait
de contour, la retouche au pixel, les palettes et les ambiances, les directions, la planche
de pose. **Tout le reste déplace ce qui existe.** Un plan qui déplace se juge autrement
qu'un plan qui ajoute : il n'y a pas de « ça marche enfin », il n'y a que « ça se trouve
enfin ». Les critères d'acceptation ci-dessous sont donc écrits pour être vérifiables à
l'usage, jamais à la lecture du code.

### Ce que la V2.1 hérite et ne rediscute pas

Tout ce que la V1 et la V2 ont instauré tient, et c'est un critère d'acceptation de chaque
étape : le coût réel facturé fait foi, les dimensions mesurées font foi, le catalogue
décide ; rien n'est jamais relancé automatiquement ; ce qui est indisponible est grisé avec
sa raison ; le traitement est non destructif ; les fichiers font foi et la base est un index
reconstructible ; aucune carte graphique, aucun modèle génératif local ; tout ce qui ne
demande pas le fournisseur fonctionne réseau coupé ; le MCP n'a aucune logique propre ; le
pliage est une ruse d'appel et jamais un format de livraison ; un calque est solidaire de sa
pose.

**Et une chose n'a pas bougé alors que tout l'écran change** : le domaine. Les objets de la
V1 et de la V2 gardent leurs champs, l'ordre des étapes de traitement garde ses cinq
premières places, et le fournisseur ne voit aucune route neuve. La V2.1 ajoute **trois
entités, cinq champs et deux places de recette** — voir `docs/ARCHITECTURE.md` §4 et §5 — et
rien d'autre.

### Les trois invariants que la V2.1 révise, et pourquoi

Un invariant instauré ne se renégocie plus. Trois se renégocient ici, et chacun est écrit
parce qu'il vaut mieux nommer une révision que la laisser se découvrir en construisant.

**1 · « Une seule grille d'assets dans tout le produit » survit sur une base plus étroite.**
Le hors-périmètre du produit interdisait « un écran séparé pour la bibliothèque » ; la
galerie devient un onglet, donc l'exclusion tombe. Ce qui survit, et qui était la vraie
règle : **il n'y a qu'une seule grille**, et la matrice de production, la réserve de la
toile et la liste des dépenses n'en sont pas — aucune des trois n'a de recherche, de filtres
ni de sélection multiple, et c'est cette privation qui tient la règle. Une quatrième
surface qui les aurait ferait une seconde grille, et la règle serait morte.

**2 · « Le compte d'images est le seul refus automatique » devient littéralement vrai.**
Il ne l'était pas : le produit refusait aussi de produire un calque quand une pièce qui
agrandit revenait à une autre échelle. Ce refus tombe — l'échelle au retour **informe et
n'empêche jamais de garder**. C'était une contradiction interne du document du produit, et
c'est la seconde moitié qui l'emporte (`docs/v21-arbitrages.md` A-11).

**3 · « Le corps naît dans l'atelier et nulle part ailleurs » devient « une seule barre de
saisie, deux lieux qui paient ».** L'intention d'origine — pas d'écran de création avec son
propre prompt — est conservée et renforcée : **il n'existe qu'une barre de saisie dans tout
le produit**, elle appartient au châssis, et elle se pose au pied de deux écrans seulement,
l'établi et le codex. La galerie n'en a pas, l'univers n'en a pas. Écrire un nom dans le
codex **crée la chose sur-le-champ** et l'on génère depuis son établi : c'est le geste que
l'atelier connaissait déjà pour les poses et les pièces, étendu à tout.

### Quand chaque entité de la V2.1 apparaît

| Entité | Apparaît en | Ce qu'elle porte à ce moment-là | Se complète en |
|---|---|---|---|
| **Type d'objet** *(projet)* | E9 | nom, sa liste de poses, son modèle par défaut | E10 (les directions le traversent) |
| **Direction** *(liste sur le projet)* | E10 | nom, consigne anglaise | — |
| **Étiquette** *(application)* | E8 | libellé français, texte anglais, la case de bible où elle sert, nombre d'emplois | — |
| **Palette** *(projet)* | E11 | nom, sources, deux dosages, retouches, couleurs rendues et leur empreinte | — |
| **Ambiance** *(projet)* | E11 | nom, sa palette, ses images de référence, ses trois textes | E12 (une chose du jeu la désigne) |
| **Entité** *(généralisation du personnage)* | E15 | ce que le personnage portait, plus les références qu'elle désigne, son ambiance, ses directions rangées et ses pièces rangées | — |

**L'étiquette est la seule qui n'appartienne pas à un projet**, et c'est délibéré : comme la
clé du fournisseur, elle ne dépend d'aucun. Un deuxième jeu part de ce que le premier a
nommé, sinon la base repart vide à chaque fois et le mécanisme ne sert jamais.

**Cinq champs s'ajoutent à des objets qui existent**, et aucun ne rétro-adapte quoi que ce
soit : une `direction` sur l'asset et sur la génération (E10), le nom de l'ambiance sur une
chose du jeu (E12), ce qui a été pris de l'ambiance sur la génération (E14), et un
`décalage` horizontal sur la place *grille* de la recette (E17).

### Les invariants que la V2.1 instaure

| Invariant | Instauré en |
|---|---|
| Aucune largeur ni hauteur inventée — hauteurs `44 · 38 · 34 · 30 · 26`, largeurs `380 · 300 · 240` | E1, et chaque étape le conserve |
| Le total affiché dit toujours de quoi il est le total, et il est cliquable | E1 |
| Un onglet ne se recouvre pas : trois lieux, et l'établi est une profondeur, pas un quatrième onglet | E1 |
| La barre d'espace montre en grand n'importe quelle vignette, partout, sans exception | E0 |
| Une seule barre de saisie dans tout le produit, et deux lieux seulement d'où l'argent part | E2 |
| Écrire un nom crée la chose, sur-le-champ, sans formulaire et sans rien payer | E2 |
| Une case est prise dès qu'une image la porte, pas parce que l'image est bonne | E2 |
| Le manque n'a aucune couleur d'alerte, et rien ne réclame jamais rien | E2 |
| Ce qui est indisponible s'ouvre quand même et porte sa raison **en clair, à la place de ses réglages** | E3 — c'est le déplacement de la règle de T1, pas son abandon |
| Le carré d'une place se remplit quand elle **change l'image**, pas quand elle figure dans la recette | E3 |
| Une place de recette décrit cette image ; une fabrique en produit d'autres, et n'a pas d'état | E3 |
| Une jauge ne compte que ce qu'on peut fabriquer maintenant | E12 |
| Une planche ne porte qu'une seule chose du jeu | E13 |
| Le texte montré avant de payer est demandé par le chemin même que l'envoi emprunte | E14 |
| Une correction faite avant de payer vaut **pour cet appel seulement** ; garder est un second geste écrit | E14 |
| Une dépense ne s'efface jamais — une image supprimée change l'état de son appel, jamais sa ligne | E18 |
| Aucun écran n'est obligatoire : l'assistant se saute à n'importe quelle étape | E19 |

### Couverture des 135 user stories de la V2.1

Chaque user story appartient à une étape et à une seule. **E0 n'en porte aucune**, et c'est
la seule : elle solde de la dette de code que le chantier des maquettes a trouvée en lisant
le dépôt pour mesurer, et une dette n'a pas d'utilisateur qui la demande.

| Étape | User stories | Nombre |
|---|---|---:|
| E0 | — | 0 |
| E1 | 174 à 179 | 6 |
| E2 | 180 à 193 | 14 |
| E3 | 194 à 204 | 11 |
| E4 | 216 à 220 | 5 |
| E5 | 205 à 210 | 6 |
| E6 | 211 à 215 | 5 |
| E7 | 221 à 224 | 4 |
| E8 | 225 à 236 | 12 |
| E9 | 245 à 248 | 4 |
| E10 | 237 à 244 | 8 |
| E11 | 249 à 257 | 9 |
| E12 | 258 à 265 | 8 |
| E13 | 266 à 271 | 6 |
| E14 | 272 à 281 | 10 |
| E15 | 282, 283, 284 | 3 |
| E16 | 285 à 289 | 5 |
| E17 | 290 à 294 | 5 |
| E18 | 295 à 299 | 5 |
| E19 | 300 à 303 | 4 |
| E20 | 304 à 308 | 5 |
| | **Total** | **135** |

### Trois choses à produire avant que le code commence — *une faite, deux restent*

Aucune n'est une décision, et aucune ne coûte de réflexion — ce sont des travaux
préparatoires qui bloquent une étape précise. Les nommer ici évite qu'on découvre le manque
au milieu de l'étape.

| À produire | Ce que c'est | Ce que ça coûte | Bloque |
|---|---|---|---|
| **Dix-sept vignettes d'exemple** | une par vue du jeu — huit — et une par taille d'image — neuf | une petite production d'images, à faire une fois | **E8** — sans elles, deux étapes de l'assistant redeviennent une liste de mots et une liste de nombres, ce qu'elles sont là pour remplacer |
| ~~**Le banc d'essai des couleurs, étendu**~~ | **fait le 31 août 2026** — les deux dosages agissent, ils sont indépendants, et le seul endroit où l'attraction meurt est nommé | rien, comme prévu | ~~E11~~ — le blocage est levé |
| **Trois appels de mesure de planche** | le même sujet en trois, cinq et six cases | moins de cinq centimes en tout | **E13** — le gain d'une planche n'est mesuré qu'à quatre cases, et une seule fois : `$0,0128` par image à une case, aucun gain à deux, `$0,0057` à quatre |

### L'ordre, et les trois endroits où il se resserre

Vingt-et-une étapes ne font pas une file d'attente : la plupart n'attendent qu'une seule
chose. Trois enchaînements sont en revanche stricts, et il vaut mieux les lire ici que les
découvrir.

- **E1 → E2 → E3 → E4.** C'est la seule chaîne longue du plan, et elle est irréductible :
  la galerie ne peut perdre son champ de prompt qu'une fois qu'on paie ailleurs (E2), et sa
  colonne de réglages qu'une fois qu'on retouche ailleurs (E3). Dégraisser avant, c'est
  retirer un geste sans le rendre.
- **E9 avant E10, et c'est un choix, pas une contrainte.** Les deux touchent la liste des
  poses : E9 la déplace du projet vers le type d'objet, E10 la multiplie par les directions.
  Dans l'autre sens on déplacerait une liste déjà multipliée par quatre. *Déplacer une liste
  courte coûte moins que déplacer une liste longue.*
- **E20 en dernier, exprès.** Le guide est le seul écran qui décrit tous les autres, donc le
  seul qui se périme à chaque décision prise ailleurs. L'écrire au milieu, c'est l'écrire
  deux fois.

Tout le reste se prend dans l'ordre qu'on veut, aux blocages nommés sous chaque étape près.

---

### E0 · La dette du chantier des maquettes
**User stories** : aucune · *6 critères · tenue le 31 août 2026*

#### Ce qu'on livre

Le chantier des maquettes a lu le code pour mesurer, et il y a trouvé trois choses fausses
qui n'attendent aucun écran. Un commentaire du domaine de la recette, près du seuil de
transparence, accuse la quantification de rendre les pixels opaques : mesuré sur six images,
elle n'y touche pas — elle met la transparence de côté et la remet telle quelle. Le halo
naît au détourage, et c'est là qu'il se règle : un commentaire faux à cet endroit enverra le
prochain lecteur corriger la mauvaise étape. La fenêtre des réglages appelle « dépensé » un
total qui ne compte que ce que l'agent a dépensé. Et la barre d'espace, qui montre une
vignette en grand, ne sert que dans la grille d'assets alors que le produit affiche des
vignettes dans sept endroits.

La quatrième dette du chantier — le recueil des explications, six phrases à corriger, deux
entrées à réécrire, quatorze à ajouter — **n'est pas ici, et c'est délibéré** : onze des
quatorze entrées neuves décrivent des écrans qui n'existent pas encore, et les six phrases à
corriger ne deviennent fausses qu'une fois E1, E3 et E7 livrées. Elle est en E20, avec le
guide.

#### Critères d'acceptation

- [x] Le commentaire près du seuil de transparence dit ce que le code fait, et il nomme le détourage comme l'endroit où le halo se règle
- [x] Un essai gratuit vérifie que la quantification ne modifie aucune valeur de transparence — les 256 valeurs, sur les deux régimes de tramage
- [x] Le total de la fenêtre des réglages s'appelle « dépensé par l'agent »
- [x] La barre d'espace ouvre l'aperçu depuis **toute** vignette du produit, et la liste des endroits où elle sert n'a plus d'exception nommée
- [x] La molette zoome l'aperçu partout où la barre d'espace l'ouvre
- [x] Aucun écran ne change de forme, aucune route n'est ajoutée, aucun objet n'entre au modèle

#### Bloquée par

Aucune — démarrable immédiatement.

#### Ce que la tenir a trouvé

**Le commentaire faux en cachait un second, et une divergence d'adresse.** La phrase
accusatrice vivait à deux endroits — le commentaire du domaine et l'en-tête du module de
traitement — et seul le premier était relevé par le chantier ; le second disait la même
chose en plus doux, ce qui l'avait sauvé de la relecture. Et en cherchant où la barre
d'espace manquait, la bande *Repart avec* s'est révélée demander son image **en direct**
plutôt que par le seul endroit du produit qui nomme l'adresse d'un asset : sur une image
sans recette, cette adresse-là n'existe pas, et la bande montrait un trou pendant que la
grille montrait l'image. Personne ne l'avait vu parce qu'on réinjecte presque toujours une
image déjà retouchée.

**Les deux surfaces qui manquaient manquaient pour la même raison mécanique** : la visée est
un *hook*, un hook ne s'appelle pas dans une boucle, et les deux rendaient leurs vignettes
dans un `map`. Ce n'est pas un oubli d'attention, c'est une contrainte du langage qui a
choisi à la place de l'auteur — et ce genre d'oubli-là ne se rattrape qu'en comptant les
images du produit une par une, ce que le chantier des maquettes a fait.

**Ce qui n'a pas été touché, et pourquoi** : les deux grandes surfaces de travail — le cadre
de la découpe, le cadre du calque. Ce ne sont pas des vignettes, elles portent déjà leurs
propres gestes de souris, et la règle dit *toute miniature*, pas *toute image*.

---

### E1 · Trois onglets au lieu de sept surfaces
**User stories** : 174, 175, 176, 177, 178, 179 · *8 critères · tenue le 31 août 2026*

#### Ce qu'on livre

Le châssis. Sept surfaces qui se recouvraient et cinq boutons de même poids dans la barre
deviennent **trois onglets — Univers, Codex, Galerie —, dans l'ordre où ils servent**, plus
un fil d'Ariane qui remplace le nom de l'onglet dès qu'on descend dans une chose du jeu et
dont chaque segment ramène. Ce qui parle de l'outil — les réglages, le guide — se sépare de
ce qui parle du travail et passe à droite. Le total de la barre de tête porte son étiquette,
`ce jeu $2,140`, et devient cliquable. Les deux bascules de repli disent ce qu'elles
replient sur l'écran où l'on se trouve, au lieu d'un mot unique qui ment sur trois écrans
sur quatre.

**À l'intérieur, rien ne change encore.** Les trois écrans qui existent se rangent sous les
trois onglets tels quels ; c'est le cadre qu'on livre, et il doit servir seul. La liste
fermée des cinq hauteurs et des trois largeurs entre en vigueur ici et vaut pour tout ce qui
suit.

#### Critères d'acceptation

- [x] Trois onglets, et un seul allumé à la fois ; aucun écran ne se superpose à un autre
- [x] Descendre dans une chose du jeu remplace le nom de l'onglet par un fil, et chaque segment du fil ramène à son étage
- [x] Un même écran atteint par deux portes différentes montre deux fils différents, et chacun dit d'où l'on vient — *le mécanisme est livré et le fil court est en service ; la seconde porte, celle de l'établi, arrive avec lui en E3*
- [x] Le total de la barre de tête porte le nom de ce qu'il compte, et un clic ouvre l'écran qui l'explique — grisé avec sa raison tant que cet écran n'existe pas
- [x] Chaque bascule de repli nomme la colonne qu'elle replie sur l'écran courant
- [x] Les réglages et le guide sont séparés visuellement de ce qui touche au travail
- [x] Aucune bande du produit ne porte une hauteur hors de `44 · 38 · 34 · 30 · 26`, aucune colonne une largeur hors de `380 · 300 · 240`, et les deux exceptions — le champ de saisie et le bouton compact — sont les seules
- [x] Chaque écran d'avant est atteignable et fonctionne exactement comme avant

#### Bloquée par

Aucune — démarrable immédiatement.

#### Ce que la tenir a trouvé

**Un cinquième bouton n'avait pas de place à prendre, et il fallait lui en trouver une.** La
barre portait `Catalogue` au même poids que les onglets, alors qu'il ne change rien de ce
qu'on regarde : il redemande la liste des modèles. Il est descendu sur le compte de modèles
de la barre d'état, qui est déjà l'endroit du produit qui dit ce que le catalogue contient
et de quand il date. **Le geste rejoint l'état qu'il change**, et la règle vaudra pour les
autres commandes que la V2.1 délogera.

**Trois écrans portaient chacun leur fente de refus, et pour une raison qui vient de
tomber.** Chacun écrivait dans son propre en-tête de 44 px, parce qu'il *couvrait* la
galerie : une raison envoyée à la barre d'état se serait rendue derrière lui, donc invisible
au moment précis où elle compte. Les onglets ne couvrent rien — la barre d'état est visible
partout —, et les trois fentes sont devenues une, dans la bande du châssis. **Ce n'est pas
une économie de lignes, c'est une cause qui disparaît** : il n'y a plus d'écran caché sous
un autre, donc plus de raison invisible.

**Ce que les onglets ont cassé sans qu'on l'ait vu venir : les replis à état local.** Le
champ de prompt tenait chez lui l'ouverture de son dépliant *ce qui partira* et celle du
prompt négatif. C'était sûr tant que la galerie était le fond du produit et ne se démontait
jamais. Devenue un onglet, elle se démonte — et aller poser un champ de bible dans l'Univers
puis revenir refermait sous la main le dépliant qu'on venait d'ouvrir pour comparer,
c'est-à-dire exactement le défaut que le registre de replis du châssis existe pour empêcher.
Les deux replis y sont entrés, et le registre a gagné la porte qui lui manquait. **Le dépôt
avait écrit la règle dès T3** — *« il doit survivre au changement d'asset et à la fermeture
de la fiche, qui se démonte »* — et n'avait jamais eu à l'appliquer ailleurs que dans un
bloc de réglages.

**La droite de la bande prenait plus de la moitié de la bande.** Mesuré au navigateur sur
une fenêtre de 1 280 px : 672 px à droite, 268 px au fil, et les quatre segments réduits à
`cœur de pier… › Gal… › helmet-r… › Décou…`. La raison de grisé du total — une phrase qui
vivra jusqu'en E18 — poussait dehors la seule chose de la bande qui dise où l'on est. Deux
règles en sont sorties : **le fil cède en dernier**, et **le dernier segment ne se rogne
jamais**, parce que c'est le seul dont le nom ne se devine pas par le contexte.

**Une valeur de la liste fermée était fausse dans le code, et une autre l'était dans le
document.** Le bouton et le champ passent de 32 à 34 px, comme la V2.1 l'a décidé — la
question de savoir si ces deux pixels valent leur coût reste ouverte en B-9, et c'est là
qu'elle se tranche. Le champ de prompt, lui, passe de 62 à 56 : le document du design
annonçait que *« rien ne bouge à l'écran, seule la mesure était prise au mauvais endroit »*,
et le code dit le contraire — 62 était bien la hauteur du champ. **C'est un vrai changement
de 6 px**, obtenu en écrivant l'interligne au lieu de l'hériter : deux lignes à 19 px plus
8 px de garde de chaque côté font exactement 56, là où l'interligne détendu en faisait 62.
La phrase du document a été corrigée plutôt que gardée.

---

### E2 · Le codex et l'établi — nommer une chose, et payer depuis elle
**User stories** : 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193 · *12 critères · tenue le 31 août 2026*

#### Ce qu'on livre

Le cœur de la V2.1, et la seule étape qui vaut deux tranches ordinaires. **Le codex** montre
tout ce que le monde contient, rangé par famille, avec pour chaque chose le compte de ce qui
lui **manque** et non de ce qu'elle tient. Les deux listes que le projet impose à tout le
monde — le plan de poses et le vestiaire — montent du personnage vers le codex, où elles
cessent d'être la colonne d'un seul. **Écrire un nom crée la chose**, sur-le-champ, sans
formulaire et sans un centime : le champ qui nomme occupe le milieu de l'écran quand le
monde est vide et redevient une rangée quand il ne l'est plus.

**L'établi** s'ouvre sous une chose du jeu, à la profondeur du fil : ce qu'elle est, ce
qu'elle a déjà, ce qu'on peut lui ajouter. Un clic sur une case vide **arme le prompt**
rempli pour elle — la bible, l'identité, la consigne de la pose — et chaque champ prérempli
porte sa provenance écrite en dessous. Un clic sur une case pleine ouvre l'outil de cette
case en plein cadre sans quitter l'établi. **Une seule barre de saisie existe dans tout le
produit** : elle appartient au châssis, elle sert l'établi et le codex, et elle se retire
dès qu'un écran ouvert ne peut rien dépenser.

#### Critères d'acceptation

- [x] Le codex liste tout ce que le monde contient, rangé par famille, et chaque famille dit ce qu'elle réclame
- [x] Une chose du jeu porte le compte de ce qui lui manque ; le compte de ce qu'elle a rangé se lit à côté de la jauge
- [x] Aucune couleur d'alerte sur un manque, aucun message qui réclame quoi que ce soit
- [x] Écrire un nom crée la chose immédiatement, sans formulaire, sans appel et sans dépense
- [x] Le champ qui nomme est au milieu de l'écran quand le monde est vide, en rangée sinon, et c'est le même champ
- [x] Une case de l'établi est prise dès qu'une image la porte, quelle que soit la qualité de l'image
- [x] Cliquer une case vide remplit le prompt avec ce que la chose et le jeu imposent, et chaque valeur préremplie porte sa provenance
- [x] Ce qui est prérempli se défait d'un clic, et se défaire ne change rien au réglage durable
- [x] Cliquer une case pleine ouvre son outil en plein cadre, et l'on revient à l'établi sans avoir changé d'onglet — *le cadre et la porte sont livrés ; les tables qui les rempliront arrivent en E3, et d'ici là c'est la recette qui s'y ouvre*
- [x] Il n'existe qu'un seul champ de saisie dans le produit ; il paraît au pied de l'établi et du codex, et nulle part ailleurs
- [x] La barre qui paie disparaît sur tout écran incapable de dépenser
- [x] Lancer tout ce qui manque à une chose annonce le nombre d'images, le groupement en planches, le prix, et ce qu'un compte faux coûterait — avant de payer

#### Bloquée par

- **E1** — l'établi est une profondeur du codex, pas un onglet : sans le fil d'Ariane il n'a pas d'adresse.

#### Ce que la tenir a trouvé

**Déplacer la barre qui paie a déplacé trois gestes avec elle, et personne ne
l'avait écrit.** Réinjecter une image, reprendre les réglages d'un appel passé,
armer une case : les trois ont leur effet **dans** la barre — la bande *Repart
avec*, le texte du champ, la bande *Pour*. Tant que la barre vivait dans la
galerie, les trois y menaient ou y restaient. Elle vit maintenant au pied du
codex et de l'établi, et deux d'entre eux partent de la galerie : ils changent
donc d'onglet, parce que **le geste va où son effet se voit**. Le troisième, lui,
cesse d'en changer — armer une case ne déplace plus personne, la barre est à
quelques pixels de la case.

**Le prix a suivi la barre, et il fallait le remarquer.** *Coût attendu* et *un
compte faux* vivaient dans la colonne de réglages de 300 px, qui n'existe que
dans la galerie — et la galerie ne paie plus. Un critère de la tranche demande
que le prix s'annonce avant de payer : il aurait été tenu par un écran qui ne
paie pas. Le bloc est donc écrit une fois et rendu à deux endroits, en attendant
que E4 retire le second.

**La colonne de 300 px ne disparaît pas : elle change de locataire.** Le document
du design annonçait qu'elle disparaissait avec la V2.1, et c'est vrai de ce
qu'elle portait — les réglages d'une génération, qui descendent dans l'établi et
ne se ressaisissent plus. La maquette de l'établi lui redonne la même largeur
pour autre chose : l'identité d'une chose du jeu. La ligne du document a été
corrigée.

**Deux états, et les confondre aurait cassé le geste le plus courant.** *Choisie*
est la chose dont la colonne de droite parle ; *ouverte* est celle dans l'établi
de laquelle on est descendu. Un seul état aurait fait descendre d'un étage au
premier regard porté sur une carte, c'est-à-dire à chaque fois qu'on cherche
laquelle a le plus de manque.

---

### E3 · Le châssis des tables, et les cinq places qui existaient déjà
**User stories** : 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204 · *14 critères, 13 tenus le 31 août 2026*

#### Ce qu'on livre

L'endroit où l'on retouche. Une **barre de tables** montre les sept places de la recette dans
leur ordre, chacune disant si elle agit et avec quelle valeur : carré plein pour une place
qui change l'image, carré creux pour une place vide, pas de carré du tout pour une place
indisponible. **Une table indisponible s'ouvre quand même** et porte sa raison en clair à la
place de ses réglages, avec ce qu'il faut faire pour l'allumer — c'est la règle de T1 qui
change d'endroit, pas qui disparaît. L'image se regarde en grand entre la table et ses
sœurs, et l'on passe à l'image voisine sans refermer la table où l'on est.

Cette étape livre les **cinq places qui existent déjà** et leur donne enfin un écran à leur
taille. Elle atteint au passage quatre réglages que le modèle porte depuis T2 et qu'aucun
écran n'a jamais montrés : le rectangle de recadrage posé à la main, les couleurs déduites
d'une image plutôt que la palette du jeu, le tramage, et la liste des taches que l'aire
minimale va effacer. Le détourage gagne les poches de fond enfermées par le sujet — cerclées
et comptées, jamais effacées seules — et la pipette, qui retire une tache ou toutes celles de
sa couleur. Enfin le **découpage** devient la première des deux fabriques, et l'écran Découpe
disparaît : on ne le cherche plus, il est là quand il sert.

#### Critères d'acceptation

- [x] La barre montre les sept places dans l'ordre où elles s'appliquent, et l'ordre ne se change pas
- [x] Le carré d'une place est plein si et seulement si la place change l'image — une place posée qui ne change rien a un carré creux
- [x] Une table indisponible s'ouvre, et son panneau porte la raison en clair, à la place des réglages, avec ce qu'il faut faire
- [x] Le trait de la barre sépare les sept places des deux fabriques, et les fabriques n'ont pas de carré
- [x] L'image brute et l'image rendue se comparent côte à côte et superposées, et le mode est écrit dès que ce n'est pas le rendu
- [x] On passe à l'image voisine sans que la table ouverte se referme
- [x] Vider une place et vider la recette entière sont deux gestes distincts, à deux endroits distincts
- [x] Le détourage propose les poches de fond enfermées, cerclées et comptées, et n'en efface aucune de lui-même
- [ ] La pipette retire une tache, ou toutes les taches de sa couleur, au choix écrit — **le seul critère ouvert de l'étape.** Elle demande un champ de plus à la recette, et ce qu'il retient n'est pas tranché : des identifiants de taches, qui se recalculent et se déplacent, ou des points, qui survivent au recalcul
- [x] Le rectangle de recadrage se pose sur l'image, et le traitement l'honore
- [x] Le curseur d'occupation ne s'arrête que là où l'image change, et dit sur combien de pixels il tombe
- [x] La quantification atteint les couleurs déduites d'une image et le tramage, tous deux déjà portés par le modèle
- [x] L'aire minimale liste les taches qu'elle va effacer, triées, et la liste se coupe là où le seuil tombe
- [x] Le découpage s'ouvre depuis la barre, et l'écran Découpe n'existe plus

#### Bloquée par

- **E2** — un outil se dessine dans le cadre où il se pose, jamais avant : l'établi lui donne son plein cadre et sa porte.

---

### E4 · La galerie, dégraissée
**User stories** : 216, 217, 218, 219, 220 · *7 critères · tenue le 31 août 2026*

#### Ce qu'on livre

La galerie perd ce qui n'est plus à elle : ni champ de prompt, ni colonne de réglages, ni
curseur de retouche. L'écran dont le métier est de **juger** rend toute sa place aux images,
et son pied dit qu'aucun appel ne part d'ici — de quoi savoir d'un coup d'œil dans quelle
moitié du produit on se trouve. La fiche d'une image dit ce que l'image est et porte **deux
portes** : l'établi de la chose à qui elle appartient, et les tables. Une image qui
n'appartient à personne propose de la rattacher, et la grille se filtre par famille avec une
dernière valeur pour ce qui n'appartient à aucune chose du jeu.

**C'est le moins de travail des cinq écrans, et c'est la dernière de la chaîne** : dégraisser
avant que le geste soit rendu ailleurs, c'est retirer sans donner.

#### Critères d'acceptation

- [x] La galerie n'a ni champ de prompt, ni colonne de réglages, ni curseur de retouche
- [x] Le pied de l'écran dit qu'aucun appel ne part d'ici
- [x] La fiche d'une image porte deux portes : l'établi de sa chose, et les tables
- [x] Une image sans chose du jeu propose de la rattacher, et le rattachement se défait
- [x] Le filtre par famille a une valeur pour ce qui n'appartient à aucune chose du jeu — *posé sur la grille chargée, et non au serveur : la seule famille qui porte des choses est* personnages*, et il descendra avec les quatre autres en E15*
- [x] Aucune des trois surfaces qui ne sont pas des grilles — la matrice, la réserve, la liste des dépenses — n'est devenue une seconde planche contact : les deux premières restent sans recherche, sans filtre et sans sélection multiple, la troisième sans aucune image (A-24)
- [x] Tout ce que l'écran d'avant permettait se fait encore, ailleurs, et la fiche dit où

#### Bloquée par

- **E2** — la galerie ne perd son champ de prompt qu'une fois qu'on paie depuis l'établi et le codex.
- **E3** — elle ne perd sa colonne de réglages qu'une fois qu'on retouche dans les tables.

#### Ce que la tenir a trouvé

**La colonne de réglages ne pouvait pas disparaître, et il a fallu le dire.** Le
dossier des maquettes écrit qu'elle *disparaît* : les réglages descendent dans
l'établi, hérités de la chose du jeu, et ne se ressaisissent plus. C'est vrai —
mais l'héritage arrive en E12 et l'écran qui les montre avant de payer en E14. La
retirer ici aurait retiré **le seul endroit du produit où l'on choisit un
modèle**. Elle se replie donc au pied de la barre qui paie, sur une ligne qui dit
ce qu'elle vaut, et elle disparaîtra pour de bon quand ce qui la remplace
existera. C'est l'arbitrage A-25.

**Une colonne retirée sans toucher à la grille qui la portait, et l'écran s'est
tordu en silence.** Les essais sont tous restés verts : ils interrogent des rôles
et des libellés, pas des largeurs. C'est au navigateur que la galerie s'est
montrée à trois cent pixels de grille pour sept cent cinquante de vide — la piste
de 300 px était toujours dans le gabarit de la grille, vide. Le rappel est
ancien et il vaut d'être réécrit : **un test d'écran ne remplace pas un
navigateur ouvert**, et c'est précisément pour ça que les critères de mise en
page vivent dans les essais d'écran *et* que le dépôt en ouvre un.

**`Découper` a quitté la fiche, et son argument tient toujours.** Il y était
parce qu'*une planche est une image comme une autre* : rien ne permet de deviner
qu'elle en contient huit, donc rien ne doit paraître ou disparaître selon ce
qu'on croit deviner. C'est exactement pourquoi le découpage est devenu une
**fabrique de la barre des tables** — il y est pour toute image, toujours. Une
porte de moins, pas un geste de moins.

---

### E5 · Les deux places qui manquaient — le contour et la main
**User stories** : 205, 206, 207, 208, 209, 210 · *8 critères · tenue le 31 août 2026*

#### Ce qu'on livre

La sixième et la septième place de la recette, et les deux seules capacités de traitement que
la V2.1 ajoute. **Le contour** retrace le trait de la silhouette à l'épaisseur, à la couleur
et à la position qu'on choisit — il remet la ligne que la mise sur grille a mangée. Il vient
après la grille et après la quantification, et pour deux raisons mesurables : tracé avant, il
serait rééchantillonné comme le reste, et un noir pur ressortirait au plus proche de la
palette, c'est-à-dire pas noir. Posé à l'extérieur il **agrandit l'image rendue**, et l'écran
le dit au moment où l'on choisit la position.

**La main** est la septième et dernière place : ôter et remettre des pixels à main levée puis
au pixel. Les passages s'empilent en calques de dessin nommables, masquables et
réordonnables, et un passage est enregistré comme un **tracé et non comme des pixels** — il
survit donc à un changement de taille de grille, et se défait un par un. La palette du jeu est
proposée sans être imposée, et une couleur hors palette est marquée au lieu d'être refusée.

#### Critères d'acceptation

- [x] Le contour se règle en épaisseur, en couleur et en position, et se pose après la grille et après la quantification
- [x] Choisir la position extérieure écrit, au moment du choix, que l'image rendue s'agrandit, et de combien
- [x] La main ôte et remet des pixels à main levée puis au pixel
- [x] Les passages s'empilent en calques nommables, masquables et réordonnables
- [x] Un passage survit à un changement de taille de grille, et se défait passage par passage
- [x] La palette du jeu est proposée et jamais imposée ; une couleur hors palette est marquée, pas refusée
- [x] La main est la dernière place de la recette, et rien ne se rejoue après elle
- [x] Le rendu reste un cache : effacer le rendu et le recalculer redonne exactement la même image

#### Bloquée par

- **E3** — les deux places n'existent que dans la barre des tables, et se règlent en voyant grand.

#### Ce que la tenir a trouvé

**Poser un réglage effaçait le calque, et le défaut est plus vieux que les
tables.** La charge qu'envoie l'écran n'a pas de champ pour dire une différence
— elle se pose par ses propres routes, le rectangle d'un côté, les deux couches
de la main de l'autre. Elle repartait donc à *rien* à chaque réglage, et
**retoucher la grille d'un calque le rendait à sa case**, c'est-à-dire au corps
habillé, sans un mot. Le défaut vivait dans la fiche depuis C3 ; personne ne
l'avait vu parce qu'on ne retouche presque jamais un calque par sa recette — les
tables viennent de le mettre à un clic de toutes les images. Ce qui répare n'est
pas un champ de plus dans la charge, c'est de dire une fois **de quoi cette
charge-là parle**.

**Les mesures d'une table étaient prises à une autre échelle que le réglage
qu'elles décrivent.** Livrées en E3, elles se prenaient sur l'image *détourée* —
donc à la taille du brut, mille pixels de côté — alors que le nettoyage des
bords s'applique tout à la fin, sur la case. Une miette de six pixels dans le
rendu en pesait des centaines dans la liste, et le curseur d'aire minimale,
gradué de 0 à 64, ne pouvait rien y couper : les deux nombres ne parlaient pas
de la même image. La mesure rejoue désormais la recette **arrêtée avant les
bords**, qui est exactement l'image que le seuil va trancher — et c'est aussi
celle que le contour va longer.

**Une maquette a supposé le code une troisième fois, et sur la même famille de
détail.** La table des contours compte l'épaisseur « en blocs quand la grille
est posée », et écrit `2 blocs de 4 px · 8 px dans l'image rendue`. Or dans ce
dépôt la remise sur grille rend une case de la taille demandée : **un pixel de
l'image rendue *est* un bloc**, il n'y a pas de second facteur, et le jumeau
annoncé n'existe pas. L'écran écrit donc ce qui est vrai — *tant de pixels de
l'image rendue, celle qui part dans le jeu* — plutôt qu'un chiffre et sa
conversion vers rien. C'est le même défaut que B-9 et A-16, et il vaut la peine
d'être compté : trois fois sur vingt-six maquettes.

**Le pinceau a changé de maison, et c'est le sens de la dépendance qui l'a
décidé.** Il vivait dans le module du calque depuis C4, quand la main ne servait
qu'à affiner un masque de différence. Devenue la septième place, elle passe sur
n'importe quelle image — donc sur le traitement ordinaire, que le calque importe
déjà. L'écrire deux fois aurait fini par ne plus rendre le même masque au rayon
1, et c'est très exactement la panne que le remplissage par plages avait évitée
en T5.

**Une recette nommée emportait la différence de l'image où on l'avait prise.**
Trouvé en refermant la première correction : `nommer` enregistrait la recette
entière, différence comprise, et la rappeler ailleurs aurait fabriqué le calque
d'une autre image. Une différence nomme *une seconde image précise* ; elle ne se
transporte pas. Elle ne s'enregistre plus, et le rappel passe par le même chemin
que l'écran.

**Et le rappel de E4 s'est vérifié une seconde fois : un test d'écran ne
remplace pas un navigateur ouvert.** Les 249 essais d'écran étaient verts, et
trois défauts de mise en page attendaient dans le vrai atelier — tous les trois
nés du même fait, *deux places de plus dans une bande qui ne grandit pas*.
Mesuré : à sept places qui portent chacune leur valeur, la barre des tables
demande **1 323 px pour 1 280 offerts**. Elle se repliait donc sur deux lignes
et débordait de ses 34 px ; le comparateur faisait de même, et poussait
*Avant ›* hors de l'écran ; et une fois la bande passée en ligne unique, c'est
la **page entière** qui a gagné une barre de défilement horizontale, parce
qu'une case de grille a `min-width: auto` et se laisse pousser par son contenu.

Ce qui en sort et qui vaut pour la suite : **une bande de la liste fermée ne
grandit jamais** — ce qu'elle porte ne se replie pas, et ce qui dépasse défile
*dans* la bande, jamais autour. **Le geste de portée générale reste hors de ce
qui défile** : `tout défaire` aurait fallu aller le chercher. Et **la raison
d'un grisé descend là où il y a la place** — celle du comparateur vit désormais
dans le panneau de la main, parce qu'une bande de 38 px n'a pas la place d'une
phrase.

---

### E6 · La superposition quitte la recette
**User stories** : 211, 212, 213, 214, 215 · *8 critères · tenue le 31 août 2026*

#### Ce qu'on livre

La seconde fabrique. Le calque par différence sort de la recette, parce qu'il **nomme deux
images en entrée et en produit une troisième** — ce qu'aucune place de recette ne fait. On
choisit soi-même les deux images qu'on superpose et on les intervertit ; l'image du dessus se
détoure sans quitter la superposition, en héritant des passes de celle du dessous ; on la cale
au pixel, au rail comme au clavier, après une proposition automatique qu'on peut reprendre.
Trois vues en même temps : le travail, le calque seul sur un fond vif, et le résultat final.
Les réglages se gardent pour la pièce suivante posée sur la même image.

**Ce que cette étape ne fait pas, et c'est écrit pour que la question ne se rouvre pas une
troisième fois** : reposer un calque sur une autre pose. Un casque vu de face n'est pas un
casque vu de dos ; un calque est solidaire de sa pose, et c'est le pliage qui divise son prix.
La maquette de la superposition rouvrait cette promesse ; le sommaire du chantier la marque
lui-même « à reprendre » et écrit qu'aucune mesure ne la soutient
(`docs/v21-arbitrages.md` A-12).

#### Critères d'acceptation

- [x] Les deux images d'une superposition se choisissent à l'écran et s'intervertissent
- [x] L'image du dessus se détoure sans quitter l'écran, et hérite par défaut des passes de celle du dessous
- [x] Le calage se fait au pixel, au rail et au clavier, après une proposition automatique reprenable
- [x] Un recalage raté ne demande jamais de repayer une génération
- [x] Les trois vues — travail, calque seul sur fond vif, résultat — sont visibles ensemble
- [x] Les réglages se conservent pour la pièce suivante posée sur la même image
- [x] La superposition écrit des fichiers et ne pose aucun état sur la recette de l'image courante
- [x] Le corps d'origine n'est jamais modifié, et aucun écran ne propose de reposer un calque sur une autre pose

#### Bloquée par

- **E3** — elle vit à droite du trait de la barre des tables, et ce trait est ce qui la définit.

#### Ce que la tenir a trouvé

**La fabrique est là, et l'ancienne place ne l'est plus tout à fait — la dette
est nommée plutôt que cachée.** La superposition écrit désormais des assets
entiers : pixels et parent du dessus, le dessous en référence, recette vide,
prix nul, cinq mesures. Elle marche sur **n'importe quelles deux images**, ce
qui était le premier grief contre la place `Difference` — elle était grisée sur
presque toute la bibliothèque, faute de savoir *par rapport à quoi*.

Mais **le flux d'équipement de C3 pose toujours sa différence dans la recette**,
et le déplacer est un chantier à lui seul : il faudrait rejouer `_reposer`,
`recaler`, `borner` et `affiner`, et surtout **scinder chaque calque déjà sur le
disque en deux assets** — la case revenue d'un côté, le calque de l'autre —,
c'est-à-dire une migration de données avec des identifiants neufs. Ce n'est pas
un détail d'écriture, et le faire à moitié laisserait deux vérités.

Ce qui rend l'attente tenable, et qui n'est pas rien : **il n'y a qu'une seule
comparaison de pixels dans le dépôt**. La planche d'équipement et la
superposition appellent le même cœur — le même `_parts`, le même seuil, la même
tolérance au voisin, le même rectangle, le même pinceau. Ce sont deux appelants
d'un calcul, pas deux calculs. Ce qui diffère est **d'où vient l'alignement** :
la planche le connaît parce qu'elle a posé ses cases, la superposition le reçoit
de l'auteur — et le lui propose d'abord.

**Le détourage est emprunté, pas recopié, et la règle qui range un emprunt tient
en une phrase** : *si le réglage est vrai de l'image toute seule, il va dans la
recette de l'image ; s'il n'est vrai que de cette superposition, il va dans la
superposition*. Détourer le dessus est vrai pour lui-même — il en aura besoin
pour partir dans le jeu, et personne ne veut le détourer deux fois. Effacer
trois pixels pour qu'ils ne partent pas dans ce calque-ci n'est vrai que de ce
calque-ci.

**Et l'écran s'ouvrait sans porte vers sa seconde image** — trouvé au
navigateur. La rangée qui porte « changer › » n'existe que quand l'image existe,
donc un outil ouvert sur une image seule n'avait aucun moyen de désigner l'autre.
La raison est devenue le bouton, comme l'alerte du détourage juste en dessous.
C'est la troisième fois de la session que le navigateur trouve ce qu'aucun essai
ne voyait, et les trois fois c'était **une porte manquante ou une bande qui
déborde** — jamais un calcul.

---

### E7 · L'onglet Univers à trois côtés
**User stories** : 221, 222, 223, 224 · *8 critères · tenue le 31 août 2026*

#### Ce qu'on livre

L'univers cesse d'être une bande de réglages de 1 843 px devant laquelle le tableau tient la
moitié de la largeur. **Trois côtés — Inspiration, Réglages, Ambiances —, un seul allumé**,
et le côté allumé prend tout l'écran. Côté Inspiration, le tableau occupe la largeur entière
sans un seul réglage dessus, et la première image d'inspiration remonte de 4 161 px de
défilement à 712. Une carte de texte prend la hauteur que son cran de zoom lui donne, comme
une carte d'image, et dit en pied ce qui ne rentre pas ; ouverte en grand, elle s'affiche en
colonne de prose et défile. Le menu d'un paquet d'images gagne **faire une palette de ça** et
**faire une ambiance de ça** — grisés avec leur raison tant que E11 n'est pas livrée.

Et l'univers se lit enfin : combien de cases de texte partent, combien de signes, quelles
images, et ce qui n'agit qu'au retour.

#### Critères d'acceptation

- [x] Trois côtés, un seul allumé, et le côté allumé occupe tout l'écran sous une barre de 38 px
- [x] Côté Inspiration, aucun réglage n'est posé au-dessus du tableau
- [x] La première image d'inspiration est atteinte en moins d'un écran de défilement — *mesuré au navigateur : 54 px, dans 650 px visibles*
- [x] Une carte de texte a la hauteur de son cran de zoom et dit en pied ce qui est coupé
- [x] Une carte de texte ouverte en grand se pose en colonne de prose bornée, et défile
- [x] Le menu d'un paquet propose de fabriquer une palette et une ambiance, grisés avec leur raison tant que l'écran qui les tient n'existe pas
- [x] Un bandeau permanent dit ce que l'univers envoie : le nombre de cases de texte, le nombre de signes, les images, et ce qui n'agit qu'au retour
- [x] Les deux côtés qui portent une liste emploient la colonne de 240 px, et rien de neuf — *un seul en porte une pour l'instant ; le second arrive avec les ambiances, en E11*

#### Bloquée par

- **E1** — l'Univers est un des trois onglets, et sa barre des trois côtés est une bande du châssis.

#### Ce que la tenir a trouvé

**La mesure promise est dépassée, et dans le bon sens.** La maquette annonçait un
tableau ramené de 6 726 à 3 277 px et la première image de 4 161 à 712. Relevé au
navigateur sur le vrai projet, avec ses dix-neuf cartes : le tableau fait
**2 446 px**, et la première image est à **54 px** du haut, dans 650 px visibles.
L'écart vient de la carte de texte, qui prend maintenant exactement le carré de
ses voisines — la maquette l'avait estimée sur les hauteurs d'un cran, le rendu la
prend sur la colonne, qui est la vraie mesure.

**Une décision de T9 s'est retournée toute seule, et pour la raison qui l'avait
prise.** *Une note n'a pas d'aperçu* était juste tant que la carte grandissait
avec son texte : l'agrandir ne montrait rien de plus, et la touche ne faisait
rien. Dès que la carte a la hauteur de son cran, son texte est **coupé** — et il
faut un endroit où le lire en entier. C'est le même argument, pris par l'autre
bout, et il donne la réponse inverse. Le pied de la carte dit ce qui manque —
`4 350 mots · 1/6 visible`, relevé au navigateur sur la note du projet, exactement
le chiffre que la maquette annonçait.

**Trois bandes se sont évitées de justesse.** Le châssis en fait une de 44 px, le
tableau en avait déjà une de 38, et les trois côtés en demandaient une troisième —
que la maquette n'a jamais dessinée. Les côtés sont donc entrés *dans* la barre du
tableau, à sa gauche, et les deux autres côtés portent la même barre sans son
contenu. Une bande de plus au-dessus du travail aurait rendu à l'écran ce qu'on
venait de lui retirer.

**La colonne de 380 px de l'univers est morte, et avec elle sa bascule de
repli.** Elle empilait cinq blocs de réglage sur 1 843 px dans 646 px visibles ;
ils ont désormais l'écran entier, un par un, sous une liste de 240 px. La
conséquence n'était pas écrite : l'onglet Univers n'a plus qu'**une** colonne
repliable, la réserve, et seulement en vue toile.

---

### E8 · L'assistant de démarrage — dix étapes, et le seul écran de réglages
**User stories** : 225 à 236 · *13 critères, 12 tenus le 31 août 2026*

#### Ce qu'on livre

Le côté Réglages de l'univers **est** l'assistant, et il n'y a pas deux endroits qui règlent
la même chose. Il s'ouvre quand on crée un jeu, se rouvre quand on veut, s'enchaîne dans
l'ordre la première fois et se clique directement ensuite. La colonne de gauche porte la
valeur de chaque étape, et devient donc le récapitulatif du jeu sans qu'on ouvre quoi que ce
soit. On choisit la vue du jeu et la taille de ses images **sur des vignettes qui les
montrent**, pas sur un nombre dans l'abstrait ; un seul choix remplit d'un coup le réglage et
la phrase correspondante du texte qui part, si bien que les deux ne peuvent plus se
contredire.

Et le mécanisme central : **les étiquettes**. Une étiquette est une paire — un libellé qu'on
clique, et le texte anglais qui part vraiment. Cliquer *brume basse* écrit
`thick low-lying fog, volumetric haze` dans la case. La base naît vide, appartient à
l'atelier et non au projet, et grandit de chaque étiquette fabriquée dans n'importe quel jeu.
L'étape 6 assemble un texte tout prêt à copier dans un outil d'images grand public, sans
qu'un centime passe par l'atelier. Un changement qui casse du travail déjà payé annonce les
vrais chiffres — combien d'images, combien ça coûte — et **ne bloque jamais**.

#### Critères d'acceptation

- [x] L'assistant s'ouvre à la création d'un jeu et se rouvre à volonté, sans perdre ce qui est déjà répondu
- [x] Il n'existe aucun autre écran qui règle un jeu — l'assistant est celui-là
- [x] Les étapes s'enchaînent dans l'ordre la première fois, et se cliquent directement ensuite
- [x] La colonne des étapes porte la valeur de chacune, et se lit comme le récapitulatif du jeu
- [ ] La vue et la taille se choisissent sur des vignettes qui les montrent — **le seul critère ouvert.** Les cases sont là et vont chercher `/vignettes/<identifiant>.png` ; les dix-sept images ne sont pas dessinées, et tant qu'elles manquent chaque case le dit — *pas encore dessinée* — plutôt que de faire semblant. Les consignes de production vivent dans `docs/vignettes-vues.md`
- [x] Un choix unique remplit le réglage et la phrase du texte qui part, et il n'existe aucun moyen de les rendre contradictoires
- [x] Une étiquette porte son libellé et son texte anglais, et cliquer le libellé écrit le texte anglais dans la case
- [x] La base d'étiquettes est partagée par tous les jeux de l'atelier, part vide, et n'est jamais préremplie à la place de l'auteur
- [x] Une recherche d'étiquettes ne montre que celles de la case où l'on se trouve
- [x] Le texte à copier s'assemble depuis les réglages, se copie d'un geste, et ne déclenche aucun appel payant
- [x] Chaque type d'objet tient sur une rangée qui dit tout ce qu'il porte, jamais sur trois contrôles dépliés
- [x] Un changement qui casse du travail payé annonce le nombre d'images et le coût, et laisse passer
- [x] Une liste vide dit ce qui décidera à sa place

#### Bloquée par

- **E7** — l'assistant est un des trois côtés de l'Univers.
- ~~**Les dix-sept vignettes d'exemple**~~ — **le blocage a changé de nature le 31 août 2026.** Il ne retient plus le code : les cases existent, elles vont chercher leur image par identifiant, et une image absente le dit. Ce qui reste est une **production d'images**, à faire une fois, et elle décide d'un critère sur treize.

#### Ce que la tenir a trouvé

**L'écran des réglages ne changeait pas de contenu, il changeait de forme — et
c'est ce qui a permis de ne rien casser.** Les cinq blocs d'avant sont tous
restés : la bible, la palette, le barème et les modèles se règlent au même
endroit qu'hier, dans l'étape qui les porte. Ce qui est neuf est ce qui n'avait
nulle part où se poser — le nom, la vue, les étiquettes, le texte à copier, la
clé — et le fait que **la colonne dise ce que chaque étape vaut**.

**Une étape n'est pas un bloc repliable, et le confondre coûtait un repli de
trop.** Les premières étapes neuves ont été écrites dans le `Bloc` du produit,
qui se replie ; l'écran s'ouvrait alors sur une étape qu'il fallait déplier pour
voir. Le repli sert à ranger plusieurs réglages dans une colonne étroite ; ici
l'étape *est* l'unité, elle a l'écran entier, et la colonne dit déjà laquelle
est ouverte.

**Le produit ne réécrit que ce qu'il a lui-même écrit, et cette borne manquait à
la première écriture.** Un choix de taille réécrit la phrase de grille et celle
de calage — c'est ce qui répare la contradiction du dépôt. Mais la première
version réécrivait *toujours*, y compris une description que l'auteur avait mis
du temps à trouver. La liste de ce que le produit sait avoir écrit est donc
close et vient du domaine ; hors d'elle, il n'écrit que dans le vide.

**Et « aucune » ne se nie pas.** La même écriture posait `no pixel grid` dans la
bible quand la cible passait à *aucune* — une affirmation que personne n'avait
faite. Un essai de R2 l'a vu tout de suite : « un univers vide ne contraint
rien » cessait d'être vrai. Sans cible, la phrase est **vide**.

**Le piège du double qui répond « {} » a été payé une troisième fois.** L'écran
lisait `vues.vues.find(...)` sur une réponse sans forme, et l'application
entière disparaissait — exactement la panne de E3, au mot près. La règle vaut
d'être écrite une fois pour toutes : **on regarde la forme d'une réponse avant
de s'y fier**, parce qu'un serveur plus vieux que l'écran répond 200 sans se
plaindre.

---

### E9 · Les poses appartiennent au type d'objet
**User stories** : 245, 246, 247, 248

#### Ce qu'on livre

La liste des poses quitte le projet pour le **type d'objet**. Avant, le jeu déclarait une
seule liste et tout la recevait : un coffre héritait de *marche* et de *course*, qu'il
fallait ranger une par une, sur chaque coffre. Désormais un personnage a *repos, marche,
course, attaque, dégâts, mort*, un coffre a *fermé, ouvert, vidé*, et une tuile n'a pas de
poses du tout. Une chose du jeu peut ajouter les siennes, sur elle seule — un boss avec sa
transformation — et sa fiche écrit **l'origine de chaque pose**, du type ou ajoutée ici, pour
qu'on sache toujours qui la reproposera demain. Et ce qu'on range se relègue sous un trait,
barré et pâle, plutôt que de disparaître : on défait un rangement sans se rappeler ce qu'on a
rangé.

#### Critères d'acceptation

- [x] Chaque type d'objet porte sa propre liste de poses, et changer l'une ne touche pas les autres
- [x] Une chose du jeu peut ajouter une pose à elle seule, sans qu'une case vide paraisse chez les autres
- [x] La fiche d'une chose écrit l'origine de chaque pose — venue du type, ou ajoutée ici
- [x] Ce qui est rangé se relègue sous un trait, barré et pâle, et se dérange d'un clic
- [x] Les plans de poses existants sont repris sans perte : aucune image ne se retrouve orpheline
- [x] Une tuile n'a pas de rangée de poses du tout, plutôt qu'une rangée grisée

#### Ce qui a été décidé en la faisant

**Deux types suivent le plan du jeu, les autres ont le leur.** Un personnage et une créature
continuent de recevoir ce que le jeu déclare — sans quoi une attitude ajoutée au plan cesserait
de paraître là où on l'attend le plus. Les six autres types reçoivent ce que l'atelier propose
pour eux, et une chose sans type reçoit le plan du jeu : c'est l'état d'avant la tranche, et
c'est ce qui reprend les jeux existants sans qu'un seul fichier soit réécrit.

**Vider n'est pas oublier.** La liste vide d'un type est une décision qui tient — un décor ne
réclame rien —, et « revenir à la liste proposée » est un second geste, qui efface la liste
écrite au lieu de la vider. Sans lui, un type ne pourrait jamais revenir en arrière : il
faudrait retaper la liste de mémoire, et la moindre faute de frappe ferait une case orpheline.

**Le × ne veut pas dire la même chose des deux côtés.** Une pose du type se *range* — elle
reviendra chez les autres, et le trait la garde à un clic. Une pose ajoutée ici s'*efface* :
elle n'existe que sur cette chose, et la reléguer aurait laissé une ligne barrée que rien ne
reproposera jamais.

**Une liste de poses ne s'efface pas par un message qui n'en parle pas.** Le barème envoie
trois champs et pas la liste ; le service relit ce que le fichier gardait et le repose. C'est
le motif payé deux fois en E5, écrit dans `docs/PIEGES.md` avant qu'un utilisateur ne le paie.

#### Bloquée par

- **E2** — le codex est l'endroit où les listes que le jeu impose se règlent.
- **E8** — l'étape des types d'objets remplit ces listes.

---

### E10 · La vue du jeu, et les directions qu'elle donne
**User stories** : 237, 238, 239, 240, 241, 242, 243, 244

#### Ce qu'on livre

On déclare **une fois** comment le jeu regarde le monde, et l'atelier en tire la liste des
directions — une proposition, pas une contrainte : elles se renomment, se retirent et
s'ajoutent depuis le codex. Chaque case du plan devient **une pose dans une direction**, si
bien que le produit peut enfin dire qu'il manque le nord. La consigne d'une image se compose
de l'attitude, écrite une fois sur la pose, et de la direction, écrite une fois sur la
direction : on ne recopie plus *facing south* sur six poses. Et le nom d'une pose cesse de
partir en français au milieu d'un texte anglais — la correction au meilleur rapport de toute
la liste, à laquelle les directions s'accrochent sans rien coûter de plus.

Deux précautions, parce que déclarer quatre directions ferait passer un personnage de douze
cases à quarante-huit d'un coup. L'atelier **propose** de ramener à un le nombre d'images des
poses, avec la raison écrite, et la proposition se défait d'un clic. Les images faites avant
la déclaration se rangent dans la première direction avec la marque **à confirmer** et le
compte de celles qui l'attendent : un rangement par défaut ne se fait pas passer pour une
déduction.

#### Critères d'acceptation

- [x] La vue du jeu se déclare une fois, et la liste des directions s'en déduit
- [x] Les directions se renomment, se retirent et s'ajoutent depuis le codex
- [x] Une case du plan est une pose dans une direction, et le produit nomme la direction qui manque
- [x] L'attitude s'écrit une fois sur la pose, la direction une fois sur la direction, et la consigne se compose des deux
- [x] Le nom d'une pose part en anglais, et rien de français ne subsiste dans le texte envoyé
- [x] Déclarer des directions propose de ramener à un le nombre d'images des poses concernées, avec la raison, et la proposition se défait d'un clic
- [x] Les images antérieures se rangent dans la première direction, marquées « à confirmer », avec leur compte
- [x] Une direction se range pour une pose du projet entier, ou pour une seule chose du jeu
- [x] Une pose demande *tant d'images dans tant de directions*, et la jauge affiche toujours le produit des deux, jamais les deux facteurs séparés

#### Ce qui a été décidé en la faisant

**La liste lue et la liste écrite ne font pas la même promesse, et le codex dit laquelle.**
Tant qu'on n'y touche pas, la liste des directions **suit la vue du jeu** — c'est ce que la
colonne affiche, *4 · lues*. Dès qu'on renomme, retire ou ajoute, elle cesse de suivre, et
elle le dit. L'alternative — réécrire la liste à chaque changement de vue — aurait effacé en
silence des noms choisis à la main ; l'autre alternative — ne jamais suivre — aurait demandé
de tout retaper pour un jeu qui change d'angle. Le retour à la proposition est à un clic,
parce que sans lui il faudrait la retaper de mémoire.

**Le nom se lit, la consigne part — deux textes, et un seul sort.** C'était le même texte
jusqu'ici, et le nom français d'une pose partait au milieu d'une phrase anglaise. Les séparer
coûte un champ sur la pose et un sur la direction, et répare ça d'un coup. **Le produit ne
traduit pas à la place de l'auteur** : une pose qu'il n'a pas proposée n'a pas de consigne, et
c'est alors le nom qui part, comme avant — inventer un texte qui partira dans un appel payé
n'est pas une commodité.

**Et les projets d'avant reçoivent l'anglais sans qu'un fichier soit réécrit.** Un plan relu
d'un fichier d'avant E10 porte les six attitudes que tous les projets partageaient ; la
consigne que le produit proposait pour chacune leur est rendue **à la lecture**. Mesuré sur le
vrai projet : `marche` part en `walking posture, full body` dès la génération suivante, et pas
une ligne n'a été écrite pour ça.

**Manquer, c'est n'avoir rien du tout.** La rangée d'une attitude nomme les directions
**vides**, pas les incomplètes : une direction commencée porte déjà son compte sur sa propre
rangée, et la nommer deux fois aurait fait lire *il manque sud* sous une image de sud.

**La portée large écrit là où la pose est déclarée, et la réponse dit laquelle.** Depuis E9
une pose vit dans le plan du jeu ou dans la liste d'un type ; écrire ailleurs qu'à sa source
aurait fait deux vérités sur la même question. Le service rend donc *jeu* ou *type meuble*
plutôt que de promettre « tout le projet » — et une attitude ajoutée sur une seule chose n'a
pas de portée large du tout, ce que le refus dit plutôt que d'écrire au hasard.

**La défaite de la proposition est gardée sur le disque.** Tout l'intérêt de la baisse est de
ne pas prendre l'auteur en traître ; une défaite qui disparaîtrait au rechargement laisserait
ouvert très exactement le piège qu'elle ferme. Un champ sur la pose, qui ne porte que ça, et
que la première retouche du chiffre à la main efface.

**Mesuré sur le vrai projet, le 31 août 2026.** La bible dit `4-directional orientation`,
`repos` et `marche` demandent quatre images : la proposition les nomme, cite la bible mot pour
mot, et annonce **48 cases → 24**. Sans elle, déclarer la vue faisait passer chaque
personnage de douze cases à quarante-huit d'un coup.

#### Bloquée par

- **E9** — les deux étapes touchent la même liste : déplacer une liste courte coûte moins que déplacer une liste déjà multipliée par quatre.
- **E8** — la vue du jeu se déclare à l'assistant.

---

### E11 · Les palettes et les ambiances
**User stories** : 249, 250, 251, 252, 253, 254, 255, 256, 257

#### Ce qu'on livre

Le côté Ambiances de l'univers, et deux objets neufs. Une **palette** devient un objet nommé,
en plusieurs exemplaires, et **reste une recette** — des sources, deux dosages, des retouches
rangées une par une : promouvoir une image nouvelle se propage encore jusqu'en bas. Chaque
couleur du résultat dit d'où elle vient, et une couleur retirée reste montrée barrée, donc
annulable d'un clic. La palette se juge **posée sur de vraies images**, à côté de celles du
jeu, jamais sur une bande de pastilles.

Une **ambiance** porte une palette, des images de référence et trois textes — un lot de style
tout prêt, fabriqué une fois et réutilisé sur plusieurs choses du jeu. Les textes qui portent
la mécanique du jeu lui sont **fermés** : une variante de style ne doit pas fabriquer des
images qui ne rentrent pas dans le jeu. Une chose du jeu désigne son ambiance sur sa fiche,
jamais par la collection où elle est rangée — une collection reste un dossier qui ne décide de
rien. Et supprimer une ambiance ne détruit aucune image : ce qui s'en servait retombe
simplement sur le jeu.

#### Critères d'acceptation

- [x] Plusieurs palettes nommées coexistent dans un jeu, et celle du projet en est une comme les autres
- [x] Une palette se recalcule de ses sources, ses sources peuvent être d'autres palettes, et ses retouches se défont une par une
- [x] Chaque couleur du résultat dit d'où elle vient ; une couleur retirée reste montrée barrée et se remet d'un clic
- [x] La palette se juge posée sur de vraies images du jeu, côte à côte
- [x] Une ambiance porte une palette, des images de référence et trois textes, et rien d'autre
- [x] Les textes qui portent la mécanique du jeu ne sont pas ouverts à une ambiance
- [x] Une chose du jeu désigne son ambiance sur sa fiche ; aucune collection ne décide d'une ambiance
- [x] Les deux écrans disent qui utilise une ambiance et ce que chacun lui prend
- [x] Supprimer une ambiance ne détruit aucune image ; ce qui s'en servait retombe sur le jeu
- [x] Aucun appel payant n'est ajouté : la fusion des palettes et la correction des couleurs se font sur la machine
- [x] L'attraction est grisée avec sa raison quand la proportion ne laisse aucune couleur à l'ambiance — mesuré : dans ce cas seul, les cinq valeurs rendent le même fichier

#### Ce qui a été décidé en la faisant

**Chaque couleur du résultat est vraiment l'une de celles d'une source.** La coupe médiane
rend des moyennes — le milieu d'un seau —, et une moyenne n'est la couleur d'aucune source :
la pastille aurait dit « venue du jeu » en montrant une teinte que le jeu ne porte pas. Chaque
seau revient donc à la couleur réelle la plus proche. C'est le seul écart avec le banc
d'essai, et il **ajoute** une garantie plutôt qu'il n'en retire : la mesure des deux curseurs
est refaite après le raccrochage et donne le même compte — 21 résultats distincts sur 25.

**Une source seule donne toute la palette.** Le curseur de proportion partage entre la
première source et les suivantes ; sans suivante, il n'a rien à partager. Le laisser décider
aurait rendu une palette **vide** sur le cas le plus courant — celui de la palette du jeu, qui
n'a jamais qu'une source. Il est alors absent avec sa raison, et l'attraction est grisée avec
la sienne.

**L'empreinte porte les couleurs résolues, pas la liste des sources.** Sans ça, ajouter une
carte à un paquet n'aurait rien recalculé, et c'est très exactement ce que la tranche promet
de préserver : promouvoir une image se propage jusqu'en bas, même à travers une ambiance
retouchée à la main.

**Ce qu'une chose prend à son ambiance vit sur la chose.** Trois réponses — tout, les couleurs
seulement, tout sauf les images —, mesurées sur les trois cas réels de la maquette. Ce que
*chaque génération* a réellement pris reste à E14 : c'est une autre question, et la même
liste écrite à deux endroits aurait divergé.

**Les deux gestes du paquet cessent d'être grisés.** Ils portaient leur raison depuis E7 —
« les palettes et les ambiances n'ont pas encore d'écran où vivre » — et cet écran existe. La
raison a disparu parce qu'elle a cessé d'être vraie, pas parce qu'on l'a effacée.

#### Bloquée par

- **E7** — les ambiances sont un des trois côtés de l'Univers.
- ~~Le banc d'essai des couleurs, étendu~~ — **levé le 31 août 2026.** Les deux curseurs agissent, sur les six images essayées et sur les cinq valeurs de chacun, et croisés ils rendent 21 résultats distincts sur 25 combinaisons : ils ne font pas le même travail. Le banc a en plus trouvé le seul endroit où l'attraction meurt — à proportion « tout du jeu », il ne reste aucune couleur d'ambiance à tirer —, et c'est là qu'elle se grisera avec sa raison. Un critère d'acceptation de plus est né de là, le dernier ci-dessus.

---

### E12 · La fiche d'une chose du jeu
**User stories** : 258, 259, 260, 261, 262, 263, 264, 265

#### Ce qu'on livre

Un écran plein cadre — à ne pas confondre avec la fiche d'une image, qui reste le panneau de
380 px de la galerie : ce sont deux objets différents. Il rassemble ce qu'une chose du jeu
est, ce qui l'habille, ses images de référence, ce que le jeu lui réclame et ce qui est fait.
Chaque texte dit **d'où il vient** — du jeu, de son ambiance, écrit ici, éteint, verrouillé —
et un texte écrit sur la chose montre en dessous, barré, celui qu'il remplace. La valeur
imposée par le projet se lit juste sous le texte qui part : une bible qui annonce 64 pendant
que le projet impose 128 devient impossible à ne pas voir.

Et la correction du frottement le plus cher du dépôt : on **promeut une image déjà fabriquée
en référence permanente** d'une chose du jeu, et l'atelier propose de lui-même le corps retenu
et la planche des directions, avec leur provenance écrite. Dix-sept appels payés sur
vingt-huit sont partis sans une seule image de référence ; c'est cet écran qui doit rendre
cela difficile. La matrice change à droite pendant qu'on règle — on voit ce qu'un rangement
coûte ou économise au moment où on le fait — et le compte des places d'images du modèle se lit
à côté de celles qu'on occupe.

#### Critères d'acceptation

- [x] L'écran rassemble l'identité, l'équipement, les références, ce qui est réclamé et ce qui est fait
- [x] Chaque texte porte son origine parmi les cinq, et l'origine est lisible sans clic
- [x] Un texte écrit ici montre en dessous, barré, celui qu'il remplace
- [x] La valeur imposée par le projet se lit sous le texte qui part, et un désaccord se voit sans le chercher
- [x] Une image déjà fabriquée se promeut en référence permanente d'une chose du jeu
- [x] L'atelier propose de lui-même le corps retenu ~~et la planche des directions~~, avec leur provenance — *la planche attend `E13` : les directions existent depuis `E10`, mais l'image qui les montre ensemble est une planche de pose. La fiche le dit à sa place plutôt que de laisser un vide*
- [x] La matrice se met à jour pendant qu'on règle, à droite de la fiche
- [x] Le nombre de places d'images du modèle se lit à côté du nombre occupé, avant de payer
- [x] Une jauge ne compte que ce qu'on peut fabriquer maintenant — ce qui est rangé n'est jamais compté comme manquant
- [x] Le panneau de 380 px de la galerie n'a pas changé de métier : il reste la fiche d'une image

#### Ce qui a été décidé en la faisant

**Éteindre n'est pas vider, et vider n'est pas éteindre.** Une case vide est un texte qu'on n'a
pas écrit — elle rend la case au jeu, ou à l'ambiance. Une case éteinte est un refus écrit :
ce champ ne part pas pour cette chose-là, et il se rallume d'un clic. Les confondre aurait
rendu le refus indistinguable de l'oubli, donc impossible à défaire.

**Trois couches, et l'ordre est celui de la décision** : ce que la chose écrit gagne sur ce que
l'ambiance donne, qui gagne sur ce que le jeu dit. *Éteint* passe avant tout — un refus ne se
discute pas avec ce qu'il refuse.

**Le désaccord se mesure sur les carrés seulement.** `64x64` est une grille, `253x321` est la
taille d'une image dont personne ne parle. La fiche ne corrige rien — la bible s'écrit dans
l'Univers —, elle met le texte qui part et la valeur qui s'applique côte à côte. Sur le vrai
projet, elle a nommé les deux champs coupables du premier coup.

**Une image promue est une quatrième provenance, et elle a son mot.** « Réinjection » dit
*l'auteur l'a posée pour cet appel* ; une image promue part avec **tous** les appels de sa
chose. Les confondre aurait fait décocher en aveugle sur l'écran de confirmation.

**La planche des quatre directions n'est pas proposable avant E13**, et la fiche le dit à sa
place plutôt que de laisser un vide. Écrit ici *avant E10*, corrigé après elle : les
directions existent maintenant, et le produit sait qu'une pose est complète dans toutes les
siennes — ce qui manque n'est plus la notion, c'est **l'image qui les montre ensemble**, et
c'est une planche de pose.

#### Bloquée par

- **E2** — le codex ouvre cette fiche.
- **E11** — elle porte le champ « son ambiance », et ce champ n'a rien à désigner avant.

---

### E13 · La planche d'une pose
**User stories** : 266, 267, 268, 269, 270, 271

#### Ce qu'on livre

**La planche devient ce qu'on achète.** Avant de payer, on voit combien de cases, ce qui est
écrit dans chacune, ce qui part en référence, et le prix : une feuille cesse d'être un achat à
l'aveugle. Chaque case sait **avant de partir** dans quelle pose et quelle direction elle se
rangera — le rangement cesse d'être un geste séparé qu'on peut oublier. La géométrie de la
grille et la position de chaque case sont écrites par l'atelier, montrées et non modifiables :
c'est ce qui garantit le découpage du retour. Une planche n'entre **jamais** en bibliothèque,
ses morceaux si, et elle ne porte **qu'une seule chose du jeu** — sans quoi la consigne « le
même sujet dans chaque case » cesse d'être vraie.

Et l'écran propose de **refaire les quatre directions plutôt que de compléter les trois qui
manquent**, avec les trois prix et le nombre d'appels sur lequel chacun repose. C'est
contre-intuitif et c'est mesuré : à une case l'image revient à `$0,0128`, à quatre elle
descend à `$0,0057`. Le nombre d'appels est affiché parce que le second chiffre ne repose
que sur un seul, et qu'un gain annoncé sur une mesure unique est un gain **encadré**.

**Deux poses peuvent partager une planche quand chacune ne réclame qu'une case** — un appel
payé du dépôt le prouve, dont les quatre cases portaient course, attaque, dégâts et mort. Ce
qui ne se partage jamais, c'est la chose du jeu.

#### Critères d'acceptation

- [ ] Avant de payer, l'écran montre le nombre de cases, le texte de chacune, ce qui part en référence, et le prix
- [ ] Chaque case porte sa pose et sa direction de destination avant l'envoi
- [ ] La géométrie de la grille et la place de chaque case sont écrites par l'atelier, montrées, et non modifiables
- [ ] Une planche n'est jamais gardée en bibliothèque ; ses morceaux le sont, filiés vers elle
- [ ] Une planche ne porte qu'une seule chose du jeu
- [ ] Deux poses partagent une planche quand chacune ne réclame qu'une case
- [ ] Refaire les quatre est proposé à côté de compléter les trois, avec les trois prix et le nombre d'appels derrière chacun
- [ ] Un compte de cases faux ne fait rien entrer, et le lot se relance d'un geste — l'invariant de C2 tient

#### Bloquée par

- **E10** — une case est une pose dans une direction ; sans les directions, la planche n'a rien à ranger.
- **Les trois appels de mesure de planche** — à trois, cinq et six cases, moins de cinq centimes. Sans eux, l'écran affiche un prix par case qui ne repose que sur une seule mesure.

---

### E14 · L'écran de confirmation
**User stories** : 272, 273, 274, 275, 276, 277, 278, 279, 280, 281

#### Ce qu'on livre

Entre le bouton et la dépense. Chaque texte et chaque image qui part se relit **sur sa propre
ligne** : le sujet, les sept textes du jeu, les trois de l'ambiance, chaque image de
référence. On éteint n'importe quelle ligne d'un clic et on corrige un texte sur place — et
**la correction ne vaut que pour cet appel**. Garder une correction sur la chose du jeu est un
second geste, écrit, jamais un effet de bord. Le sujet et la pose demandée ne s'éteignent
jamais, avec leur marque grise : un appel ne part pas sans rien demander.

Le prix de chaque image jointe se lit sur la ligne où on la coche, et l'en-tête du groupe dit
ce que les cases cochées pèsent dans le total. La raison est mesurée : **une image de référence
jointe double le prix d'un appel** — `$0,0063` sans, `$0,0139` avec — et 48 % de la facture du
modèle principal part dans les images jointes. Une case éteinte garde son prix en gris : c'est
ce qu'elle coûterait.

**Le texte montré est demandé par le chemin même que l'envoi emprunte**, sinon il pourrait
diverger de ce qui part — c'est ce qui rend la règle *ce qui est montré est ce qui part*
vérifiable et pas seulement affirmée. Un avertissement s'écrit sur la ligne fautive avec des
chiffres, jamais en bandeau et jamais en conseil. Une case saute l'écran **pour la série en
cours**, sans jamais pouvoir l'éteindre pour toujours. Et l'on lit aussi, en gris, ce qui se
passera au retour — le découpage, la palette, le détourage — pour savoir d'avance que l'image
qu'on verra n'est pas celle que le modèle envoie.

#### Critères d'acceptation

- [ ] Chaque texte et chaque image qui part occupe sa propre ligne, avec un interrupteur
- [ ] Une ligne éteinte ne part pas, et l'extinction ne remonte nulle part
- [ ] Une correction faite ici vaut pour cet appel seulement ; un second geste, nommé, la garde sur la chose du jeu
- [ ] Le sujet et la pose demandée ne peuvent pas s'éteindre, et leur marque le dit
- [ ] Chaque image jointe porte son prix sur sa ligne ; une case éteinte garde le sien en gris
- [ ] L'en-tête du groupe dit ce que les cases cochées pèsent dans le total de l'appel
- [ ] Le texte montré vient du même chemin que l'envoi, et un essai le vérifie
- [ ] Un avertissement s'écrit sur la ligne fautive, avec des chiffres, jamais en bandeau
- [ ] Une case saute l'écran pour la série en cours et se remet à chaque nouvelle série ; aucun réglage ne l'éteint définitivement
- [ ] Ce qui agira au retour se lit en gris, et se distingue de ce qui part
- [ ] Ce qui a été pris de l'ambiance est enregistré avec la génération, et se relit sur une vieille image

#### Bloquée par

- **E13** — il paraît avant de payer une planche, et la planche est ce qu'on achète.
- **E11** — il porte les trois interrupteurs de l'ambiance et l'option d'envoyer la palette en image.

---

### E15 · Le codex généralisé — les cinq familles
**User stories** : 282, 283, 284

#### Ce qu'on livre

Le personnage se généralise en **entité**. Les décors, les objets et les éléments d'interface
deviennent des choses du jeu au même titre, avec leur compte de ce qui leur manque — jusqu'ici
ils avaient une ligne et un compte à zéro. Un établi n'affiche que ce que sa famille peut
avoir : **pas de rangée grisée « sans objet »**, parce que ce qu'une famille ne peut pas avoir
n'existe pas dans son établi. Ce qui reste grisé avec sa raison, c'est seulement ce qui sera
construit plus tard — et là, le grisé réserve la place. Et l'établi d'une pièce d'équipement
montre **sur quels personnages elle est posée** plutôt que des images : une chose qui n'a pas
d'image à elle ne fait pas semblant d'en avoir.

**C'est le travail de modèle le plus lourd de la V2.1**, et c'est ce qui rend le reste vrai
pour autre chose qu'un personnage.

#### Critères d'acceptation

- [x] Les cinq familles portent des entités de plein droit, avec leur compte de manque
- [x] Un établi ne montre aucune rangée « sans objet » ; ce qui n'existe pas pour la famille n'est pas dessiné
- [x] Ce qui viendra plus tard reste grisé avec sa raison, et occupe sa place
- [x] L'établi d'une pièce d'équipement montre les personnages qui la portent, pas des images
- [x] Tout ce qui marchait pour un personnage marche pour une entité des quatre autres familles
- [x] Aucun personnage existant ne perd quoi que ce soit à la généralisation

#### Ce qui a été décidé en la faisant

**Le travail de modèle le plus lourd de la V2.1 n'a ajouté aucun objet.** Une chose du jeu
porte son **type** depuis E9, et un type porte sa **famille** depuis T4 : la généralisation
est donc une *lecture*, pas une migration. Garder une famille sur la chose aurait fait deux
vérités sur la même question, et elles auraient fini par se contredire — un meuble rangé dans
les décors. C'est aussi ce qui rend vraie sans effort la promesse « aucun personnage existant
ne perd quoi que ce soit » : pas un fichier n'a eu à être réécrit.

**Nommer crée dans la famille où l'on nomme, et le type se voit.** « Un tonneau cerclé de
fer » tapé sous *Objets* y reste : le produit pose le premier type de cette famille-là, et ce
choix est écrit sur l'établi de la chose, dans un menu, changeable. Une décision du produit
qui ne se verrait pas serait une décision prise à la place de l'auteur.

**Ce qu'une famille ne peut pas avoir n'est pas dessiné, ce qui viendra reste grisé.** Un
décor n'a pas de vestiaire : son établi ne montre aucune colonne d'équipement, sa fiche ne
compte aucune pièce, et rien n'est barré ni pâle — il n'y a rien. Le grisé garde son seul
emploi : réserver la place de ce qui sera construit plus tard, et dire pourquoi.

**Une pièce d'équipement ne montre aucune image, et c'est tout son établi.** Le produit
interdit de générer un casque sur fond vide — un casque n'existe qu'apparu sur un corps —,
alors sa ligne dit *posée sur 2 personnages sur 3* et nomme lesquels, pose par pose. Comme
une case pleine, ça se déduit des images : rien de plus n'est enregistré, et supprimer un
calque retire la pièce du compte tout seul.

**Trois mensonges d'écran sont tombés en ouvrant les autres familles**, et aucun ne se voyait
tant que seuls des personnages existaient. Le compte de ce qui manque lisait **le plan du
jeu** au lieu de ce que la chose réclame : un décor y gagnait douze cases manquantes qu'aucun
écran ne sait remplir. Le pied de la colonne écrivait *0 décor, 0 objet, 0 élément
d'interface* en dur. Et le fil d'Ariane disait *Personnages* quoi qu'on regarde — vrai tant
qu'il n'y avait qu'une famille peuplée, faux dans quatre cas sur cinq dès qu'il y en a cinq.
La règle générale se lit ici : **une constante écrite en dur est une vérité qui attend de
devenir fausse**, et c'est la famille voisine qui la démasque.

**Et une phrase périmée avec eux** : la colonne de droite disait « les ambiances n'ont pas
encore d'écran où vivre », alors que E11 le leur a donné. Elle dit maintenant laquelle une
chose désigne, ou qu'elle suit le style du jeu.

#### Bloquée par

- **E12** — la fiche d'une chose doit exister avant d'être servie à cinq familles ; l'écrire pour une puis la refaire pour cinq, c'est l'écrire deux fois.

---

### E16 · La vitrine
**User stories** : 285, 286, 287, 288, 289

#### Ce qu'on livre

L'écran où l'on juge une image finie : seule, en grand, **sur le fond que la bible décrit**.
Un contour sombre disparaît sur du noir absolu, et aucun damier gris ne le montre. Les
échelles sont des multiples entiers et rien n'est lissé — on ne juge pas un défaut que la
fenêtre a inventé. Toutes les poses d'une chose se posent à la même échelle, ce qui rend
visible celle qui sort d'un quart plus petite que ses sœurs. L'écran s'ouvre depuis le codex,
depuis une fiche ou depuis une planche, et montre ce qu'on regardait : le monde entier, une
chose, ou une pose — sans trois écrans pour trois portées.

La place du mouvement est **réservée et grisée avec sa raison**, plutôt qu'occupée par un
lecteur posé sur zéro image.

#### Critères d'acceptation

- [x] L'image se regarde seule, en grand, sur le fond que la bible du jeu décrit
- [x] Les échelles sont des multiples entiers, et aucun lissage n'est appliqué à aucune
- [x] Toutes les poses d'une chose se posent à la même échelle
- [x] L'écran s'ouvre depuis le codex, depuis une fiche ~~et depuis une planche~~, et retient ce qu'on regardait — *la planche d'une pose est E13 ; la porte s'y posera avec elle, l'écran ne bouge pas*
- [x] La place du mouvement est réservée et grisée avec sa raison
- [x] Le fond de jugement vient du projet ; le damier de repérage reste ailleurs, et les deux ne se confondent nulle part

#### Ce qui a été décidé en la faisant

**La taille montrée est celle qu'on voit, pas celle qu'on espère.** Une image jamais traitée
n'a pas de rendu, et c'est son brut qui s'affiche — vingt et une des quarante-huit images du
vrai projet sont dans ce cas, et le codex les compte comme les autres. La vitrine les montre
telles quelles : c'est très exactement ce qu'elle est venue faire.

**La taille commune se déduit de ce qui existe, pas de la cible du projet.** Une chose peut
avoir été fabriquée entière à une autre taille, et c'est alors elle qui est cohérente. Ce
qu'on cherche est la sœur qui sort plus petite que les autres ; l'écart au réglage, lui, se lit
dans la fiche.

**Le noir n'est proposé que si la bible en parle, et la raison cite le texte.** Un fond posé
sans raison serait un fond inventé, et le produit n'en invente pas. Vérifié sur le vrai
projet : la citation nomme *absolute blackness*, mot pour mot.

**La portée se donne, elle ne se devine pas.** Au monde, la pose d'une image existe aussi dans
le plan du jeu : la deviner aurait écrit « repos » sous chacune des trois choses au lieu de
leurs noms.

#### Bloquée par

- **E2** — le codex est sa porte principale.

---

### E17 · Le calibrage
**User stories** : 290, 291, 292, 293, 294

#### Ce qu'on livre

La réparation d'un défaut que six vignettes côte à côte ne montrent pas : les six poses d'un
même personnage rendues à 64, 59, 64, 53, 64 et 43 pixels de haut. Toutes les poses d'une
chose se **superposent dans la même case**, un bouton propose une taille commune et dit quelle
pose a limité le résultat et ce que ça coûte en résolution, puis on reprend à la main pose par
pose. Une pose très différente des autres est proposée comme **mise de côté** : un personnage
debout ne doit pas rapetisser d'un tiers parce qu'il meurt dans une autre image.

Le calibrage écrit dans l'occupation, qui existe déjà et qui est déjà une part de la case —
c'est ce qui fait qu'il **survit à un changement de taille de case** : passer de 64 à 128 ne
défait aucun calibrage. Il ajoute une seule chose au traitement, le **décalage horizontal** de
la place *grille* : un bras tendu déplace le corps de six pixels dans une case de soixante-
quatre, parce que le centrage horizontal se fait sur la boîte du sujet et ne se règle pas.

#### Critères d'acceptation

- [x] Toutes les poses d'une chose se superposent dans la même case
- [x] Un bouton propose une taille commune, nomme la pose qui a limité le résultat, et dit le coût en résolution
- [x] La reprise à la main se fait pose par pose, après la proposition
- [x] Une pose très différente des autres est proposée comme mise de côté, et la mise de côté se défait
- [x] Le calage s'écrit dans l'occupation, et changer la taille de case ne défait aucun calibrage
- [x] Le décalage horizontal se règle et n'est écrit que par le calibrage — jamais à la main dans la table, jamais dans une recette nommée
- [x] Le décalage vaut zéro par défaut, et une recette sans calibrage rend exactement l'image d'avant

#### Ce qui a été décidé en la faisant

**Le calcul est celui de la mise sur grille, jamais un second.** Ce qu'une pose peut atteindre
sans sortir de sa case vaut `cible × hauteur / plus grand côté de la boîte`, et l'occupation à
poser en est l'inverse exact. Deux formules auraient fini par annoncer une hauteur et en
produire une autre — c'est très exactement la contradiction que cette étape répare, et la
rejouer ici aurait été comique.

**La hauteur commune est celle de la pose qui plafonne le plus bas**, et le produit la nomme.
Un bouton qui pose une valeur sans dire d'où elle vient serait une décision prise à la place de
l'auteur ; celui-ci écrit *c'est « mort » qui limite*, et ce que la cohérence coûte —
*45 px de la case ne servent pas · 35 % de résolution en moins*.

**Une seule pose est proposée à l'écart, et une décision prise arrête la proposition.**
Écarter la plus basse fait de la suivante la plus basse ; reproposer alors finirait par ne
garder qu'une pose, et l'outil aurait décidé à la place de l'auteur ce qu'il prétend seulement
proposer. Le seuil est **un dixième**, et ce n'est pas un seuil de confort : c'est la part de
hauteur que garder cette pose coûterait *à toutes les autres*.

**Le décalage est borné à la case, et il s'y arrête.** Sortir de la case couperait le sprite en
silence, et une case existe justement pour que rien n'en sorte. Aux bords, les boutons cessent
d'avoir un effet — ce qui se voit, et c'est mieux qu'une image rognée.

**Le calibrage n'épingle pas.** Toucher une recette à la main épingle l'asset depuis T2 ; ici
ce n'est pas une main posée sur une image, c'est un calage que le jeu impose à toutes les poses
d'une chose. L'épingler aurait exclu ces images du prochain réalignement de palette — même
décision que le balayage rétroactif de T4, pour la même raison.

**Ce n'est pas une table, et c'est ce qui décide de son emplacement.** Une table de la barre
décrit l'image ouverte ; le calibrage travaille sur *toutes* les poses à la fois et écrit dans
chacune. Le mettre dans la barre voudrait dire que la barre de l'image A porte un outil qui
modifie les images B, C et D — la barre cesserait de vouloir dire quelque chose. Il est donc
une profondeur de l'établi, comme la fiche et la vitrine, et comme elles il retire la barre qui
paie : il ne fabrique rien.

**Mesuré au navigateur sur le vrai projet, le 31 août 2026.** Cinq poses de Balthazar rendent
128 pixels de haut ; sa mort en rend **83**. Dans le jeu, le nain rapetisse d'un tiers en
mourant, et aucun écran ne le disait — six vignettes côte à côte ne le montrent pas, six
silhouettes empilées, si. L'outil propose de mettre la mort de côté, et le fait de lui-même
sans jamais le décider.

#### Bloquée par

- **E10** — le calibrage porte toutes les poses d'une chose, direction comprise.
- **E3** — le décalage se pose à côté de l'ancrage, dans la table grille.

---

### E18 · Les dépenses
**User stories** : 295, 296, 297, 298, 299 · *7 critères · tenue le 31 août 2026*

#### Ce qu'on livre

Tous les appels payés, du plus récent au plus ancien, avec ce que chacun a coûté et ce qu'il a
donné. L'écran remplace le journal des appels ratés, qui ne montrait **qu'un cas sur trois** —
et mesuré, celui qui n'a jamais rien coûté. Les trois se distinguent enfin : ce qu'on a gardé,
ce qu'on a payé pour rien, et ce qui a été refusé. **Une dépense ne s'efface jamais** : une
image supprimée change l'état de sa ligne, jamais sa présence.

Deux totaux, chacun étiqueté : celui du jeu ouvert, dans la barre de tête, et celui de
l'atelier entier, ici — avec ce qui n'appartient à aucun jeu, c'est-à-dire les **onze pour
cent** qu'aucun écran ne montrait. Et les appels consécutifs sur un même sujet se voient d'un
coup d'œil : six relances en trente-deux minutes ont coûté le quart de tout l'argent jamais
dépensé, et rien ne le disait.

#### Critères d'acceptation

- [x] Tous les appels payés se listent du plus récent au plus ancien, avec leur coût et leur résultat
- [x] Les trois issues se distinguent : gardé, payé pour rien, refusé
- [x] Supprimer une image change l'état de la ligne de son appel, et ne fait jamais disparaître la ligne
- [x] Le total de l'atelier entier et la part qui n'appartient à aucun jeu se lisent tous les deux
- [x] Les deux totaux du produit portent chacun son étiquette, et aucun montant n'est affiché nu
- [x] Les appels consécutifs sur un même sujet se repèrent sans lire les horodatages un par un
- [x] La liste n'est pas une grille d'assets — *reformulé en A-24 : ce n'est pas la privation de filtre qui le tient, c'est l'absence d'image et de sélection multiple*

#### Bloquée par

- **E1** — le total cliquable de la barre de tête est sa porte.
- **E0** — l'étiquette « dépensé par l'agent » de la fenêtre des réglages est le second des deux totaux, et elle mentait.

#### Ce que la tenir a trouvé

**Le document du produit et la maquette se contredisaient sur le seul point qui
fait cet écran.** Le premier écrivait que la liste des dépenses n'a « ni
recherche, ni filtre, ni sélection multiple », la seconde y dessine quatre
filtres et un champ de recherche, chacun avec la question à laquelle il répond.
Le conflit n'avait été relevé nulle part — ni par la relecture croisée des
maquettes, qui ne lit pas les documents d'autorité, ni par l'écriture du plan,
qui a recopié la phrase du produit sans la confronter au dessin. **C'est A-24**,
et le document du produit a été corrigé plutôt que la maquette : ce qui tient
l'invariant d'une seule grille d'assets n'est pas le même sur les trois surfaces,
et l'écrire d'un seul bloc allait faire retirer à cet écran le filtre qui répond
à sa seule question propre.

**La trichotomie ne se lit pas sur le statut d'un emplacement, et c'est ce qui la
rend possible.** Un emplacement qui a réussi reste « réussi » pour toujours ; ce
qui change quand on supprime l'image, c'est qu'il n'y a plus d'asset vivant à ce
rang. *Gardé* et *payé pour rien* se séparent donc en interrogeant la
bibliothèque, pas la génération — une requête pour tout le lot, jamais une par
ligne. C'est aussi ce qui fait tenir la promesse *une dépense ne s'efface
jamais* sans rien écrire pour elle : la ligne vient de la génération, l'état vient
des assets, et les deux ne se croisent qu'à la lecture.

**Le journal des appels ratés reste**, et il n'a pas été supprimé : il répond à
une autre question — *qu'est-ce qui a raté dans ce projet-ci* —, alors que celui-ci
répond à *où est passé l'argent*, sur l'atelier entier. C'est la colonne de la
galerie qui perd son bloc en E4, pas la route qui le sert.

---

### E19 · Le premier lancement
**User stories** : 300, 301, 302, 303

#### Ce qu'on livre

Ce qu'on voit sur une machine neuve : aucun jeu, aucune image, aucune clé. L'assistant s'ouvre
à la toute première ouverture de l'atelier — il faut bien un endroit où commencer. On en sort
à **n'importe quelle étape** et l'on tombe dans le codex avec le champ qui nomme allumé : on
fabrique sans avoir répondu à quoi que ce soit. La clé du fournisseur se dépose depuis une
étape de l'assistant **sans que ce soit un second endroit où elle habite** — trois portes, une
seule pièce. Et la barre du haut dit « aucune clé » dès la première seconde, sans qu'on ouvre
un menu.

**Aucun écran n'est obligatoire, et c'est le critère qui compte** : après le 30 août, il
n'existait plus nulle part où écrire un prompt sur une installation neuve, et c'est ce trou
que cette étape ferme — sans en creuser un autre, qui serait un tunnel.

#### Critères d'acceptation

- [x] L'assistant s'ouvre à la première ouverture de l'atelier, sur un jeu qui existe déjà
- [x] On en sort à n'importe quelle étape, et l'on arrive dans le codex avec le champ qui nomme allumé
- [x] La clé se dépose depuis l'assistant, et c'est la même valeur au même endroit que dans la fenêtre des réglages
- [x] La barre du haut dit « aucune clé » dès la première seconde
- [x] Le compte des écrans obligatoires du produit est zéro, et un essai le vérifie
- [x] Sur une installation neuve, on atteint un prompt actif sans avoir répondu à une seule question

#### Ce qui a été décidé en la faisant

**Le premier lancement est un fait, jamais un drapeau.** Le reconnaître demandait de savoir
si on l'avait déjà vu ; un drapeau posé une fois aurait été un état de plus à tenir, à effacer
quand on remet l'atelier à zéro, et à expliquer le jour où il se serait désaccordé du disque.
Trois faits suffisent : **aucune image nulle part, un seul jeu, et il porte encore le nom que
le produit lui a donné**. Chacun cesse d'être vrai au premier geste — importer, nommer son
jeu, en créer un second —, et c'est exactement quand la porte doit se refermer.

**La clé n'en fait pas partie**, et c'est délibéré : elle peut venir de l'environnement,
posée par quelqu'un qui n'a jamais ouvert l'atelier. Un jeu neuf reste un jeu neuf, et
l'étape 10 dira simplement qu'elle est déjà là.

**Et l'assistant ne se rouvre qu'une fois par onglet.** Le message d'état repart à chaque
rebranchement du flux ; le rejouer aurait ramené l'écran de la première minute par-dessus ce
qu'on était en train de faire. Une porte qui se rouvre sous les doigts de quelqu'un n'est plus
une porte.

**La clé est montée dans la barre du haut, et elle a quitté celle du bas.** Elle est le seul
préalable dur du produit : la lire ne doit pas demander d'ouvrir quoi que ce soit. Écrite aux
deux endroits, elle aurait été **deux endroits à tenir d'accord** pour une seule valeur — et
sans clé, le mot mène au champ, comme le bouton qui paie éteint porte déjà sa raison *et* le
chemin vers son réglage. Trois portes, une seule pièce.

**Le champ qui nomme réclame le curseur après tout le monde.** La barre qui paie monte dans la
même passe et le prend sans condition — c'est le geste de l'atelier, et il a raison partout
ailleurs. En sortant de l'assistant, le geste demandé est de *nommer* : le champ le réclame
donc à la frame suivante, quand chacun a fini de se monter. Écrit ici parce que ça se lit
comme un détail et que c'en est un — mais un détail qui décide de ce que le premier geste du
produit peut être.

**Vérifié sur une installation vraiment neuve, et pas sur celle de l'auteur.** Le banc de
`tests/test_e19.py` monte un atelier vide à chaque essai : c'est le seul endroit du dépôt où
la seconde zéro se rejoue à volonté. Ce qui a été vu au navigateur, sur le vrai projet, est ce
qui s'y voit — la clé dans la barre du haut, et la sortie de l'assistant qui dépose dans le
codex, curseur dans le champ qui nomme.

#### Bloquée par

- **E8** — c'est l'assistant qui s'ouvre.
- **E2** — c'est le champ qui nomme qui rattrape la sortie.

---

### E20 · Le guide
**User stories** : 304, 305, 306, 307, 308

#### Ce qu'on livre

La seule prose du produit, et **la dernière étape exprès** : c'est le seul écran qui décrit
tous les autres, donc le seul qui se périme à chaque décision prise ailleurs. Il refait le
tour des lieux qui existent vraiment et dit lequel n'est pas un onglet — on ne visite pas des
pièces que personne ne peut ouvrir. La boucle du produit commence par **nommer**, parce que
c'est le premier geste possible sur une machine neuve. Les explications se rangent par lieu
du produit et dans l'ordre où on les rencontre : on cherche où on était, pas de quelle
catégorie la chose relève.

C'est aussi ici que se solde la dernière dette du chantier des maquettes : **six phrases à
corriger, deux entrées à réécrire, quatorze à ajouter**. Une phrase nomme un écran qui
n'existe plus, deux décrivent l'univers sans ses trois côtés, trois comptent cinq places de
recette là où la barre en montre sept ; les deux entrées à réécrire décrivent le modèle de
palette d'avant. Les quatorze entrées neuves sont déjà écrites, chacune dans la maquette de
l'écran qu'elle explique. Deux règles gardent le guide honnête : **un groupe sans explication
affiche son zéro** au lieu de disparaître — un manque doit se voir dans le guide — et **un
réglage sans explication n'a simplement pas de trait sous son nom** — un trou du guide ne doit
jamais se voir dans le travail.

#### Critères d'acceptation

- [ ] Le guide fait le tour des lieux qui existent, et dit lequel n'est pas un onglet
- [ ] La boucle du produit commence par « nommer »
- [ ] Les explications sont rangées par lieu et dans l'ordre où on les rencontre
- [ ] Un groupe sans explication affiche son zéro
- [ ] Un réglage sans explication n'a pas de trait sous son nom, et rien ne signale le manque dans le travail
- [ ] Les six phrases fausses sont corrigées, et aucune ne nomme un écran disparu ni ne compte cinq places
- [ ] Les deux entrées du modèle de palette d'avant sont réécrites
- [ ] Les quatorze entrées manquantes sont présentes, dont celle de la clé du fournisseur — qui empêche absolument tout tant qu'elle est vide et n'avait pas une ligne
- [ ] Le titre du guide reste en serif, ses titres de section en sans majuscules, et sa colonne de prose reste bornée

#### Bloquée par

- **Toutes les autres.** Un guide écrit au milieu du plan est un guide à réécrire à la fin.

---

## Ce que ce plan ne couvre pas

La V3 — l'animation de sprites —, la V4 — les tuiles qui se raccordent — et la V5 — le son —
sont décrites en `docs/archi-versions.md` §8 à §10, et ne sont pas découpées ici. Elles ne
commencent pas avant que la V2 serve pour de vrai, comme la V2 n'a commencé qu'une fois la V1
tenue.

**Et seize questions de la V2.1 restent ouvertes** — dix-sept posées, une déjà répondue —, chacune avec ce qui manque pour y
répondre et l'étape où elle se pose : `docs/v21-arbitrages.md` § B. Aucune n'empêche
d'ouvrir l'étape qui la porte — ce sont des questions qui se tranchent **à l'usage**, et
c'est délibéré : les trancher d'avance, c'est décider sans mesure. Trois d'entre elles
méritent d'être connues avant de commencer, parce qu'elles pourraient annuler du travail
plutôt que le corriger : la case carrée coûte 17 % de résolution sur un sujet plus large que
haut (E3) ; les deux dosages d'une palette ne changent peut-être rien de distinguable (E11,
et c'est ce que le banc étendu doit dire) ; et deux hauteurs de contrôle valent-elles mieux
qu'une — le passage de 32 à 34 px touche tous les boutons et tous les champs du produit,
pour une raison de maquette qui s'est révélée fausse (E1).

Quatre points d'avant restent ouverts, et aucune tranche ne les présuppose :

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
