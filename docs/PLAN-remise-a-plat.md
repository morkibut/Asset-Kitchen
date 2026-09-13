# Plan — remettre l'interface d'aplomb sur la maquette validée

> **Ouvert le 13 septembre 2026**, sur ce constat de l'auteur : *« c'est quand même encore pas
> mal le bordel l'interface… j'ai des écrans que je pensais qui avaient été remplacés ou
> disparu depuis l'intégration de la nouvelle maquette. Je ne sais même pas s'ils marchent et
> s'ils sont en double ou pas. »*
>
> Ce plan **ne remplace pas** [le plan de l'atelier unifié](PLAN-atelier-unifie.md) : celui-ci
> ajoute des capacités, celui-là remet d'aplomb ce qui existe déjà. Les deux avancent, et
> l'ordre entre eux est dit dans [PLAN.md](PLAN.md) § *Où en est le dépôt*.
>
> Il ne nomme aucun fichier que les relevés ne nomment déjà. Les preuves vivent dans cinq
> relevés du 13 septembre 2026, et **chaque affirmation de ce plan en vient** :
>
> | Relevé | Ce qu'il établit |
> |---|---|
> | [la maquette](releves/2026-09-13-carte-de-la-maquette.md) | les 26 écrans validés le 12 septembre, et ce qu'on fait dans chacun. **C'est le contrat.** |
> | [les écrans du code](releves/2026-09-13-carte-des-ecrans-du-code.md) | les 99 écrans réels : atteignables, morts, en double |
> | [le serveur](releves/2026-09-13-carte-du-serveur.md) | 314 routes, 85 outils pour l'agent, ce que plus personne n'appelle |
> | [**l'écart**](releves/2026-09-13-ecart-maquette-produit.md) | **le croisement des deux premiers, geste par geste.** C'est lui qui commande ce plan |
> | [les documents](releves/2026-09-13-etat-des-docs.md) | ce qui fait foi, ce qui est périmé, ce qui est descendu en archive |

> **Quel modèle sur quelle tranche** : [PLAN-remise-a-plat-affectation.md](PLAN-remise-a-plat-affectation.md).

---

## Le vrai état, en chiffres

| Ce qu'on croyait | Ce qui est mesuré |
|---|---|
| « la maquette est implémentée » | **0 écran sur 26 tenu de bout en bout.** 22 le sont en partie, 4 n'existent pas |
| « les anciens écrans ont disparu » | **30 écrans du produit** n'existent pas dans la maquette. La plupart sont à garder — le produit en fait plus qu'elle |
| « il y a peut-être des doublons » | **4 paires d'écrans** font le même travail à l'écran, et l'auteur atteint les deux côtés de chaque paire |
| « certains écrans ne marchent peut-être plus » | **2 fichiers morts**, 1 écran mort dans un fichier vivant, **7 morceaux morts** dans des fichiers vivants |
| — | **80 désaccords de nom** entre ce que la maquette dit et ce que le produit affiche |

**Ce que ces chiffres ne disent pas, et qui compte autant.** Le produit n'est pas en retard sur
la maquette : il est à côté. Sur chaque écran il manque deux ou trois gestes, il en ajoute
cinq que la maquette n'a pas, et il les nomme autrement. C'est cette dérive-là qui fait le
désordre, pas un manque de travail.

**Le serveur, lui, n'a pas de mort.** Aucun module de `atelier/services/` ni de
`atelier/domaine/` n'est orphelin. Il a neuf routes sans écran et trois portes en double —
c'est tout. Le désordre est côté écran.

---

## Les trois décisions qui commandent tout le reste

Prises le 13 septembre 2026 en autonomie, et écrites ici pour qu'on ne les rejoue pas à chaque
tranche.

### 1. La maquette fait foi sur l'ossature et le vocabulaire ; le produit fait foi sur la profondeur

Là où la maquette est plus simple que le produit, **c'est la maquette qui gagne** : le nombre
de portes, le nom de chaque porte, l'endroit où un geste se trouve, le mot écrit sur un bouton.

Là où le produit fait plus que la maquette, **c'est le produit qui gagne** : l'atelier d'une
animation, le calibrage, la planche de poses, les tuiles, les sons, l'aide, la barre de gestes.
La maquette ne les a pas prévus ; elle ne les périme pas pour autant.

Ce qui se déduit de cette règle, et qu'il ne faut pas redemander : **on ne supprime jamais une
capacité au motif que la maquette ne la dessine pas.** On la range à l'endroit que la maquette
nomme.

### 2. Un doublon se résout par fusion, jamais par suppression

Les quatre paires d'écrans en double portent, chacune, des gestes que l'autre n'a pas. Fusionner
veut dire : **un seul écran, qui sait tout ce que les deux savaient**, atteint par le chemin que
la maquette nomme. L'autre chemin disparaît le jour où le premier tient tout, pas avant.

### 3. Le vocabulaire se ferme écran par écran, avec l'écran

Les 80 désaccords de nom ne se corrigent pas en une passe. Ceux de l'ossature — les portes, les
onglets, les titres d'écran — se ferment d'un coup, parce qu'ils ne bougeront plus. Les autres
se ferment **dans la tranche qui touche leur écran**, sinon on renomme deux fois.

---

## L'ordre

Quatre temps. À l'intérieur d'un temps, les tranches ne se bloquent pas entre elles, sauf quand
c'est écrit.

```
Temps 1 — le ménage           RP1 · RP2 · RP3
   │      ce qui ne coûte presque rien et qu'on ne peut plus retarder
   ▼
Temps 2 — les doublons        RP4 · RP5 · RP6 · RP7 · RP8
   │      un seul écran par travail, avant d'en ajouter
   ▼
Temps 3 — les manques         RP9 · RP10 · RP11 · RP12 · RP13 · RP14 · RP15 · RP16
   │      les dix écarts qui coûtent le plus, dans l'ordre du relevé
   ▼
Temps 4 — les décisions       RP17 · RP18
          ce qui demande de trancher, pas d'écrire
```

---

# Temps 1 — Le ménage

## RP1 · Retirer ce qui est mort, garder ce qui n'a pas de remplaçant

**Bloquée par** : rien. **Elle bloque** : rien, mais elle rend tout le reste lisible.

Quatre écrans et sept morceaux sont morts, chacun prouvé par une recherche dans
[la carte des écrans du code](releves/2026-09-13-carte-des-ecrans-du-code.md) § *Les écrans
morts*. Ils font croire que le produit contient des choses qu'il ne contient pas.

**Deux d'entre eux ne partent pas : ils portent une capacité qui n'existe nulle part ailleurs.**
Le point dur a été tranché le 13 septembre 2026, avant d'ouvrir la tranche.

- **L'écran mort de l'agent reste**, et RP2 le rebranche. C'est le **seul** écran du produit qui
  lise et règle le cadre de délégation — ce que l'agent a le droit de dépenser, combien d'appels
  il peut faire, et quels modèles il peut employer pour l'image, la vidéo, la 3D et le son.
  Le panneau vivant de l'atelier montre bien *l'agent*, mais pas le même objet : il montre le
  plafond et le modèle du garde-fou, pas la liste des modèles autorisés. **Supprimer cet écran,
  c'est retirer à l'auteur le seul endroit d'où il borne la dépense de l'agent.**
- **Le mode *réglages* des règles du jeu reste** et part avec RP2, pour la même raison.

**Une seule chose a l'air morte et ne l'est que par accident** : le champ qui crée une collection
depuis la grille d'une famille. Il mourra encore après RP1 ; c'est RP7 qui le rallume. On n'y
touche pas ici.

**Le doute le plus coûteux est levé et ne coûte rien** : le journal des appels ratés n'est pas
perdu. L'écran des dépenses le remplace et distingue trois issues — gardé, payé pour rien,
refusé.

### Critères d'acceptation

- [ ] Le fichier de la colonne de gauche d'avant est retiré, et le composant du carnet aussi —
  ses constantes, elles, restent : cinq écrans vivants les emploient.
- [ ] Les morceaux morts logés dans des fichiers vivants sont retirés sans toucher au reste du
  fichier : la grille de référence écrite dans l'écran principal, les deux composants jamais
  montés de l'établi, l'emballage d'un travail conservé, et le second nom de l'atelier des sons.
- [ ] L'écran de l'agent et le mode *réglages* des règles du jeu **ne sont pas retirés** : ils
  attendent RP2.
- [ ] Le champ de nouvelle collection d'une famille **n'est pas retiré** : il attend RP7.
- [ ] Aucun essai ne teste plus un écran injoignable.
- [ ] Les deux suites passent, et le nombre d'essais baisse exactement du nombre d'essais
  orphelins retirés.

## RP2 · Rendre les quatre règles du jeu

**Bloquée par** : rien.

Le nom du jeu, sa description du monde, sa direction artistique et sa taille de référence se
règlent **une seule fois**, au moment de créer le jeu. L'écran qui les rouvre existe ; aucune
porte ne l'ouvre. Le mot *Réglages* de la colonne ouvre la machine — les clés, ComfyUI, le
dossier de travail —, pas le jeu.

Ce sont les quatre réglages qui partent dans chaque demande d'image. Les rouvrir n'est pas un
confort.

**Où les mettre** : la maquette tranche déjà. Ses *Réglages* ont quatre onglets — Univers,
Moteurs & workflows, Agent MCP, Consommations. Le premier est exactement cet écran.

**Et le troisième onglet rend un second écran mort.** L'écran de délégation est le seul du
produit qui règle **ce que l'agent a le droit de dépenser** : le plafond en appels, le plafond
en argent, s'il peut payer, s'il peut appeler la machine, et quels modèles il peut employer pour
l'image, la vidéo, la 3D et le son. Il n'est monté nulle part. *Agent MCP* est sa place.

### Critères d'acceptation

- [ ] *Réglages* ouvre un écran à onglets, et le premier onglet rouvre les quatre questions du
  jeu.
- [ ] Ce qui est modifié là repart dans la demande suivante, et l'écran le montre avant de
  payer.
- [ ] L'écran de création du jeu et celui des réglages restent le même écran dans deux modes ;
  on ne réécrit pas les quatre questions deux fois.
- [ ] L'onglet *Agent MCP* rouvre le cadre de délégation : plafond d'appels, plafond en argent,
  droit de payer, droit d'appeler la machine, et modèles autorisés par type de résultat.
- [ ] Ce qui est réglé là borne réellement l'agent, et un essai le prouve en le laissant
  dépasser.
- [ ] Les deux autres onglets mènent aux écrans qui existent déjà — les moteurs et workflows
  locaux, les dépenses — sans les réécrire.

## RP3 · Fermer le vocabulaire de l'ossature

**Bloquée par** : rien. **Elle bloque** : rien, mais chaque tranche d'après s'appuie dessus.

Quatre-vingts désaccords de nom sont relevés. Ceux de l'ossature se ferment ici, en une fois,
parce qu'ils ne bougeront plus : le nom des portes, le nom des onglets d'une fiche, le titre de
chaque écran, et le mot de chaque retour en arrière.

Les autres — les libellés à l'intérieur d'un écran — se ferment dans la tranche qui touche cet
écran. C'est la décision 3.

### Critères d'acceptation

- [ ] Les portes de la colonne portent les mots de la maquette, et le compte des portes est
  celui de la maquette.
- [ ] Les onglets de la fiche d'un sujet portent les mots de la maquette, et leur nombre est
  celui de la maquette.
- [ ] Chaque titre d'écran est le mot par lequel on y entre : on ne clique pas *Livrer au jeu*
  pour arriver sur *Exporter des fichiers*.
- [ ] La liste des désaccords restants est écrite, écran par écran, et chaque tranche d'après
  ferme les siens.
- [ ] Un essai tient la liste fermée des noms de portes et d'onglets, comme les listes fermées
  du design tiennent les tailles.

---

# Temps 2 — Les doublons

Cinq tranches, une par doublon, plus celle qui les rend possibles. Chacune suit la décision 2 :
**un seul écran qui sait tout ce que les deux savaient.**

## RP4 · Une seule préparation, une seule relecture

**Bloquée par** : RP3. **Elle bloque** : rien, mais c'est la plus grosse.

La maquette fait tenir toute la fabrication dans deux fenêtres : *Préparer une fabrication* et
*Relire avant l'envoi*. Le produit en a huit, plus une d'aiguillage. Trois préparent une image
fixe, trois préparent un clip, et aucune n'est atteignable depuis une autre : le type de
résultat est décidé par le bouton qu'on a pressé, pas dans la fenêtre.

Chacune a ses libellés, son bouton de relecture, son format de prix.

**C'est la tranche la plus lourde du plan**, et la seule qui touche à l'argent. L'invariant tient
sans changer : le texte montré avant de payer est demandé par le chemin même que l'envoi
emprunte.

### Critères d'acceptation

- [ ] Une seule fenêtre prépare, et le type de résultat — image fixe, clip, son, rendu 3D — s'y
  choisit.
- [ ] Une seule fenêtre relit avant l'envoi, quel que soit le type.
- [ ] Ce qui est montré avant de payer vient du chemin que l'envoi emprunte, et un essai le
  prouve pour chacun des quatre types.
- [ ] Le prix s'écrit d'une seule façon dans tout le produit.
- [ ] Aucune capacité des huit fenêtres n'est perdue : chacune est nommée, puis retrouvée dans
  la fenêtre unique.
- [ ] Les deux lieux d'où l'argent part restent deux, et pas trois.

## RP5 · Un seul écran d'import sur une fiche

**Bloquée par** : RP3.

Deux écrans importent pour un sujet. L'un ne pose aucune question et devine ce qu'on lui donne —
vidéo, planche, image — puis ouvre la suite qui convient. L'autre demande la pose et la direction
**avant** d'accepter les fichiers, sait reprendre une image déjà en bibliothèque, et accepte
plusieurs fichiers d'un coup.

L'auteur atteint les deux : le premier par le bouton du bandeau, le second par une rangée vide
de l'onglet des images fixes.

**Ce qui gagne** : le premier, parce que la question posée d'avance ne veut rien dire pour une
vidéo. **Ce qu'il doit apprendre** : reprendre une image de la bibliothèque, et accepter
plusieurs fichiers.

### Critères d'acceptation

- [ ] Un seul écran d'import pour un sujet, atteint depuis le bandeau **et** depuis une rangée
  vide.
- [ ] Entrer par une rangée vide range dans cette case-là, sans reposer la question.
- [ ] L'import accepte plusieurs fichiers, et une image déjà en bibliothèque.
- [ ] Une vidéo et une planche ouvrent toujours la suite qui convient.
- [ ] Ce qui entre sans case reste visible dans *Pas encore rangé*.

## RP6 · Une seule grille de choix d'image

**Bloquée par** : RP3.

Deux grilles choisissent une image, et une troisième était morte. La grille, la recherche, les
favoris et la pagination sont écrits deux fois. Ce qui les sépare : le filtre par collection et
l'aperçu en grand d'un côté, le rôle demandé après le choix et l'import de fichier de l'autre.

### Critères d'acceptation

- [ ] Une seule grille de choix d'image dans tout le produit.
- [ ] Elle porte le filtre par collection, l'aperçu en grand, l'import de fichier, et le rôle
  quand celui qui l'ouvre en demande un.
- [ ] Le rôle ne se demande que là où il a un sens.
- [ ] L'invariant tient : cette grille n'est pas *la* grille d'assets du produit, et elle n'a ni
  filtres multiples ni sélection multiple.

## RP7 · Une seule grille d'assets

**Bloquée par** : RP3, RP6.

La porte *Les assets* et la grille d'une famille lisent la même route du serveur avec les mêmes
filtres. On atteint la seconde en cliquant une famille depuis la première. La seconde a deux
gestes de plus — le glisser-déposer vers les collections, et les réglages de famille — et deux
défauts hérités du carnet mort : son champ de nouvelle collection ne s'ouvre plus, et l'une de
ses cibles de dépôt a disparu.

⚠️ **Les deux écrans emploient deux types de glisser incompatibles.** C'est le point dur de la
tranche.

**L'invariant** : une seule grille d'assets dans tout le produit. Il est enfreint depuis la mort
du carnet ; cette tranche le rend vrai.

### Critères d'acceptation

- [ ] Une seule grille d'assets, qui montre toutes les familles ou une seule selon ce qu'on
  ouvre.
- [ ] Le glisser-déposer vers une collection marche, d'un seul type, et un essai le prouve.
- [ ] Créer une collection depuis la grille marche de nouveau.
- [ ] Les réglages d'une famille restent atteignables depuis la famille.
- [ ] La vue *Les poses* n'est pas perdue.

## RP8 · Une seule fiche de sujet

**Bloquée par** : RP3.

La fiche courte s'ouvre avec la page du sujet. La fiche longue demande trois clics, dont un menu
qui parle de calibrage — et elle est seule à porter trois réglages : le signalement qui part dans
chaque demande, les textes de style, et les images de référence du sujet.

Trois réglages qui partent au modèle, enterrés sous un menu qui parle d'autre chose.

### Critères d'acceptation

- [ ] Une seule fiche de sujet, atteinte en ouvrant le sujet.
- [ ] Le signalement, les textes de style et les images de référence s'y règlent.
- [ ] Le portrait, le nom et la description ne sont plus écrits deux fois.
- [ ] Ce que la fiche règle et qui part au modèle se relit avant de payer.

---

# Temps 3 — Les manques

Les huit écarts qui restent parmi les dix que le relevé classe comme les plus coûteux, dans son
ordre.

## RP9 · La toile donne du travail

**Bloquée par** : RP4 — elle débouche sur la fenêtre de préparation unique.

L'auteur pose des références et des notes sur la toile, et il ne peut rien en faire. Il n'y a pas
de sélection multiple : une seule carte à la fois. Ce qui tombe avec : mettre un lot en réserve,
effacer une sélection, et fabriquer depuis une sélection.

La toile est l'outil de conception du projet. Aujourd'hui elle ne mène nulle part.

### Critères d'acceptation

- [ ] Plusieurs cartes se sélectionnent sur la toile.
- [ ] Une sélection se met en réserve, et s'efface, d'un geste.
- [ ] *Fabriquer depuis la sélection* ouvre la préparation avec les images cochées d'avance.
- [ ] Les notes libres de la toile ne partent pas dans la demande sans qu'on le dise.
- [ ] Les positions et la réserve se retrouvent après fermeture.

## RP10 · La livraison décide au lieu de bloquer

**Bloquée par** : rien.

Un conflit de fichier arrête tout : l'écran écrit la raison en rouge et éteint le bouton. La
maquette proposait trois décisions par conflit — conserver, copier à côté, remplacer.

S'y ajoutent trois manques : pas de *Tout sélectionner*, pas de case par fichier, et **un
brouillon non enregistré part sans avertir**. Les tuiles et les sons ont déjà ce garde-fou ; la
livraison ne l'a pas.

### Critères d'acceptation

- [ ] Chaque conflit propose trois décisions, et l'écran dit ce que chacune fait avant de la
  prendre.
- [ ] Les fichiers se cochent un par un, et tous d'un coup.
- [ ] Un brouillon non enregistré arrête la livraison et demande, comme ailleurs.
- [ ] Ce qui est écrit dans le jeu est exactement ce que la relecture annonçait.
- [ ] Aucune livraison ne change la cadence ni le sens de lecture de ce qui a été préparé.

## RP11 · La galerie se trie, se filtre et se regroupe

**Bloquée par** : RP3.

C'est l'écran d'ouverture du produit, celui où l'auteur passe le plus de temps. On y cherche par
texte, on filtre par famille et par favori. **Pas de tri** — l'ordre est figé en date
décroissante. Pas de filtre par rôle, pas de filtre par jugement, et une planche ne se voit
jamais avec les images qui en sortent.

### Critères d'acceptation

- [ ] Le tri se choisit, et le choix se retrouve après fermeture.
- [ ] Le filtre par rôle et le filtre par jugement existent.
- [ ] Une planche et ses dérivés se regroupent, et le groupe se déplie.
- [ ] La galerie reste lisible avec plusieurs centaines de résultats, et un essai le mesure.

## RP12 · Comparer deux versions d'une même animation

**Bloquée par** : rien.

L'écran de comparaison compare deux sujets, ou deux images d'un même sujet, et il mesure leurs
tailles. Il ne lit aucune animation. L'auteur qui a trois versions d'une marche ne peut pas les
regarder tourner côte à côte pour choisir.

C'est un écran absent, pas un écran incomplet.

### Critères d'acceptation

- [ ] Deux versions d'un même résultat se lisent côte à côte, sur le même temps.
- [ ] Chacune tourne à sa propre cadence, et la cadence lue est celle qui sortira à l'export.
- [ ] *Choisir pour le jeu* existe de chaque côté.
- [ ] Le favori reste distinct du choix pour le jeu.

## RP13 · Déclarer un mouvement et une direction là où on les regarde

**Bloquée par** : RP3.

L'onglet qui dit ce qu'il faut produire ne sait pas ajouter un mouvement ni une direction : ils
viennent du serveur. Le seul endroit où l'on ajoute une attitude est la matrice, sous *Autres
outils* → *Cases, planches et calibrage*.

Et la fenêtre de fabrication, quand la liste est vide, **renvoie vers l'écran qui ne sait pas le
faire**.

### Critères d'acceptation

- [ ] Un mouvement et une direction s'ajoutent depuis l'onglet qui dit ce qu'il faut produire.
- [ ] Le renvoi de la fenêtre de fabrication mène à l'endroit qui sait le faire.
- [ ] Ce qui est ajouté paraît immédiatement dans la matrice et dans la fabrication.
- [ ] Écrire un nom crée la chose, sur-le-champ, sans formulaire et sans rien payer.

## RP14 · La découpe se règle

**Bloquée par** : rien.

Les zones sont anonymes : ni nom, ni case *garder*, ni coordonnées. Pas d'ajout de zone, pas de
retour arrière, pas de déplacement ni de redimensionnement d'un rectangle, et rien ne se relit
avant de créer. Une découpe ratée se refait en entier.

### Critères d'acceptation

- [ ] Une zone se nomme, se garde ou s'écarte, et ses coordonnées se règlent au clavier.
- [ ] Une zone s'ajoute, une zone se déplace, une zone se redimensionne.
- [ ] Le dernier geste se défait.
- [ ] Les sorties se relisent avant d'être créées.
- [ ] La source est conservée, et la découpe se reprend depuis un résultat.

## RP15 · Le cadre du montage se règle, ou ne se propose plus

**Bloquée par** : rien.

L'écran de montage propose trois façons de mesurer le cadre, dont *à la main*. **Aucun contrôle
ne modifie ce cadre** : choisir *à la main* repose le rectangle que la machine venait de mesurer.
Il n'y a pas non plus de pivot.

Un choix qui promet ce qu'il ne fait pas est pire qu'un choix absent. Deux issues, et il faut en
prendre une : donner les champs, ou retirer le choix.

**Décision** : donner les champs. Le relevé du cadre et du pivot a déjà son outillage depuis
AU11, et la maquette les demande.

### Critères d'acceptation

- [ ] Quatre champs règlent le cadre — gauche, haut, largeur, hauteur.
- [ ] Deux champs règlent le pivot.
- [ ] Ce qui est réglé à la main survit à la mesure automatique, et l'écran dit lequel des deux
  fait foi.
- [ ] Le cadre réglé est celui qui sort à l'export.

## RP16 · Savoir ce qu'on a laissé en plan

**Bloquée par** : rien.

Deux choses, et elles se renforcent. Les brouillons existent par écran et ne se voient que depuis
cet écran : rien ne les rassemble. Et le compteur de la colonne, à côté de *Fabrications*, compte
les emplacements d'images du chantier de la galerie — pas les animations, pas les équipements,
pas la 3D, pas les sons.

L'auteur ne peut donc pas savoir ce qui est en cours, ni ce qu'il a laissé à moitié.

### Critères d'acceptation

- [ ] Un tiroir rassemble tous les brouillons, avec ce que chacun reprend et depuis quand.
- [ ] Un brouillon s'ouvre depuis ce tiroir, et s'y jette.
- [ ] Le compteur de la colonne compte tous les travaux, pas une seule famille.
- [ ] Un travail interrompu par un redémarrage paraît dans le tiroir, avec ce qu'il attendait.

---

# Temps 4 — Les décisions

Deux tranches qui demandent de trancher avant d'écrire. Elles se placent en dernier parce que
rien ne les bloque et qu'elles ne bloquent rien — mais elles ne se referment pas toutes seules.

## RP17 · Une seule porte pour faire sortir un personnage

**Bloquée par** : rien.

Deux chemins sortent un personnage du jeu. L'ancien écrit un personnage nommé directement dans le
dossier, **sans aperçu et sans comparaison**. Le nouveau écrit un lot entier, avec aperçu avant
écriture et comparaison à la sortie précédente.

Le second a été construit **à côté** du premier, jamais à sa place — le code le dit lui-même — et
personne n'a retiré l'ancien depuis. L'auteur a donc deux boutons dans deux écrans, l'un sans
filet, l'autre avec, et rien ne dit lequel préférer.

⚠️ **C'est le doublon le plus gênant du serveur**, et le seul qui écrit dans le dossier du jeu.

### Critères d'acceptation

- [ ] Un seul chemin écrit dans le dossier du jeu, et il prévisualise avant d'écrire.
- [ ] Sortir un seul personnage reste possible, par ce chemin-là.
- [ ] Ce que l'agent peut faire, l'écran le peut aussi, et l'inverse.
- [ ] Les variantes archive — un fichier compressé au lieu d'une écriture disque — restent
  disponibles ou sont retirées explicitement, jamais laissées de côté sans le dire.
- [ ] Rien n'est écrasé sans que la comparaison l'ait annoncé.

## RP18 · Les neuf routes sans écran

**Bloquée par** : rien.

Neuf routes du serveur ne sont appelées ni par l'écran, ni par un script, et n'ont pas d'outil
pour l'agent. Elles fonctionnent, elles sont testées, et personne ne les emprunte :

- les jeux de réglages nommés — trois routes, déclarées à la première tranche du produit et
  restées vides depuis ;
- chercher un sujet par son nom dans tout le projet, au-delà d'une famille ;
- redemander le catalogue vidéo — son pendant image, lui, est bien appelé ;
- défaire le calage d'un calque animé, et en voir l'aperçu ;
- l'image de référence et l'image de départ d'un travail en cours.

Chacune se tranche séparément : **soit on construit l'écran qui l'emprunte, soit on retire la
route.** Une route sans emprunteur n'est pas neutre : elle se teste, elle se maintient, et elle
fait croire à une capacité qui n'existe pas pour l'auteur.

### Critères d'acceptation

- [ ] Chacune des neuf routes a reçu une décision écrite : construite, ou retirée.
- [ ] Aucune route retirée n'emportait une capacité que l'agent emprunte.
- [ ] Les essais des routes retirées partent avec elles.
- [ ] Le relevé du serveur est mis à jour, et le compte des routes y redescend d'autant.

---

## Ce que ce plan ne couvre pas

- **Les capacités neuves.** Elles restent dans [le plan de l'atelier unifié](PLAN-atelier-unifie.md).
  Ce plan-ci ne construit rien que la maquette n'ait déjà dessiné.
- **Le dessin.** Aucune tranche ne rouvre une décision d'apparence : `docs/DESIGN.md` fait foi, et
  ses listes fermées valent pour chaque écran touché ici.
- **Les doutes du relevé d'écart.** Cinq points n'ont pas pu être tranchés depuis le code : ils
  demandent un essai au navigateur, et ils sont nommés en fin du
  [relevé d'écart](releves/2026-09-13-ecart-maquette-produit.md) § *Ce que je n'ai pas pu
  vérifier*. Le premier à lever est le glisser-déposer, parce que RP7 en dépend.
- **Les 57 ateliers jetables** de la configuration de lancement. Ils ne gênent personne et se
  relisent ; les ranger n'apporte rien à l'auteur.
- **Les images payées déjà versées dans l'historique.** Les retirer demanderait de réécrire
  l'historique, et la règle du dépôt dit de ne pas le faire.

## Comment fermer une tranche

Les mêmes règles que partout : les critères se cochent **après** vérification, jamais à
l'écriture ; un critère se vérifie **par le chemin qu'emprunte l'auteur**, pas par la capacité
qui le rend possible — c'est la leçon d'AU20 —, et une tranche qui compile mais casse un essai
existant n'est pas finie.

Pour ce plan, une règle de plus, parce que c'est son sujet : **une tranche qui fusionne deux
écrans nomme, avant de commencer, la liste des gestes des deux côtés, et coche cette liste à la
fin.** Une capacité perdue dans une fusion ne se voit pas ; elle se retrouve six mois plus tard.
