# Plan : Asset Kitchen — V1, puis V2

> **PRD source** : `docs/PRD.md` — 173 user stories.
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

Avec les 114 de la V1 et les 43 de la V2, le PRD est couvert de bout en bout : **173 user
stories, une tranche chacune.**

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

## Ce que ce plan ne couvre pas

La V3 — l'animation de sprites —, la V4 — les tuiles qui se raccordent — et la V5 — le son —
sont décrites en `docs/archi-versions.md` §8 à §10, et ne sont pas découpées ici. Elles ne
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
