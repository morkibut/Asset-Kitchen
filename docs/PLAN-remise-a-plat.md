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

### 1. La maquette fait foi sur l'ossature ; le produit fait foi sur la profondeur ; `docs/vocabulaire.html` fait foi sur les mots

Là où la maquette est plus simple que le produit, **c'est la maquette qui gagne** : le nombre
de portes, l'endroit où un geste se trouve, ce qui s'ouvre en cliquant quoi.

⚠️ **Mais pas sur les mots.** Le produit a déjà un vocabulaire fermé, et `docs/DESIGN.md` dit
qu'il s'applique partout — écrans, menus, guide, messages d'erreur. Il tient une liste noire, et
`asset` y figure : on écrit *un sujet* ou *une image*, selon ce qu'on désigne. La maquette écrit
pourtant *asset* à plusieurs endroits, et le produit aussi. **Les deux ont tort, et c'est le
vocabulaire qui tranche.** Il porte ses raisons, et deux exceptions gardées — `prompt` et
`frame`, parce que leur traduction est plus longue et moins claire.

*Ce document vivait dans le dossier des pistes du 4 septembre, descendu en archive le matin
même. Un document qui gouverne ne vit pas dans `archive/` : il est remonté à `docs/vocabulaire.html`
le 13 septembre 2026, et `docs/DESIGN.md` le nomme désormais par son chemin.*

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

**Et on ne renomme pas d'après la maquette : d'après `docs/vocabulaire.html`.** C'est la
décision 1. Quand ni la maquette ni le produit n'emploient le mot juste, c'est le vocabulaire
qui donne le mot, et s'il n'en a pas, **c'est lui qu'on modifie d'abord, pas l'écran** — sa
propre règle le dit.

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
   │
   │                          RP19 · RP20 · RP21 · RP22
   │      quatre manques que l'auteur a nommés en se servant du produit, le 15 septembre 2026 —
   │      ils ne dépendent d'aucun doublon et se prennent dès que RP3 est close
   ▼
Temps 4 — les décisions       RP17 · RP18
          ce qui demande de trancher, pas d'écrire
```

---

# Temps 1 — Le ménage

## RP1 · Retirer ce qui est mort, garder ce qui n'a pas de remplaçant  ✅ **close le 13 septembre 2026**

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

- [x] Le fichier de la colonne de gauche d'avant est retiré, et le composant du carnet aussi —
  ses constantes, elles, restent : cinq écrans vivants les emploient.
- [x] Les morceaux morts logés dans des fichiers vivants sont retirés sans toucher au reste du
  fichier : la grille de référence écrite dans l'écran principal, les deux composants jamais
  montés de l'établi, et le second nom de l'atelier des sons.
- [x] L'écran de l'agent et le mode *réglages* des règles du jeu **ne sont pas retirés** : ils
  attendent RP2. **L'emballage d'un travail conservé non plus** : il n'est mort que parce que
  l'écran de l'agent l'est, et il revivra avec lui.
- [x] Le champ de nouvelle collection d'une famille **n'est pas retiré** : il attend RP7.
- [x] Aucun essai ne teste plus un écran injoignable.
- [x] Les deux suites passent, et le nombre d'essais baisse exactement du nombre d'essais
  orphelins retirés.

## RP2 · Rendre les quatre règles du jeu  ✅ **close le 13 septembre 2026**

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

- [x] *Réglages* ouvre un écran à onglets, et le premier onglet rouvre les quatre questions du
  jeu.
- [x] Ce qui est modifié là repart dans la demande suivante, et l'écran le montre avant de
  payer. — vérifié au navigateur, de bout en bout : une ligne écrite dans l'onglet *Univers*
  se relit mot pour mot sous `CONTEXT` / `World:` dans *Relire avant envoi*, avant le bouton
  qui paie. Rien n'a été lancé.
- [x] L'écran de création du jeu et celui des réglages restent le même écran dans deux modes ;
  on ne réécrit pas les quatre questions deux fois.
- [ ] L'onglet *Agent MCP* rouvre le cadre de délégation : plafond d'appels, plafond en argent,
  droit de payer, droit d'appeler la machine, et modèles autorisés par type de résultat.
  ⚠️ **Décoché pour un mot : par type de résultat.** L'onglet rouvre bien le cadre, et les
  quatre premières bornes s'y règlent et s'y enregistrent ; mais l'écran ne choisit les modèles
  que pour l'image et pour le clip vidéo. Le cadre garde `modeles_3d` et `modeles_audio`, et
  **aucun écran ne les a jamais montrés** : c'est un manque à construire, pas une capacité
  perdue ici — et le construire aurait été réécrire un écran que la tranche devait seulement
  ranger.
- [x] Ce qui est réglé là borne réellement l'agent, et un essai le prouve en le laissant
  dépasser. — `tests/test_au3.py`, qui pose un plafond puis voit l'atelier refuser sur
  *budget* ; l'écran, lui, écrit ce cadre par son seul chemin d'écriture, et un essai d'écran
  le prouve depuis la porte *Réglages*.
- [x] Les deux autres onglets mènent aux écrans qui existent déjà — les moteurs et workflows
  locaux, les dépenses — sans les réécrire.

**Ce que la tranche a rangé, sans rien réécrire.** `PanneauAtelier` — la fenêtre posée sur le
carnet — est dissoute : « Les fournisseurs » vit sous *Moteurs & workflows*, « L'agent », « Les
dossiers » et « Les mouvements » sous *Agent MCP*. Le lieu `delegation`, que rien n'écrivait
jamais, part avec elle : le cadre de délégation est un onglet, pas un étage. Et les mouvements
restent où ils étaient faute de place dans la maquette ; `RP13` les mènera à l'onglet qui dit ce
qu'il faut produire.

## RP3 · Fermer le vocabulaire de l'ossature ✅ **close le 15 septembre 2026**

**Bloquée par** : rien. **Elle bloque** : rien, mais chaque tranche d'après s'appuie dessus.

Quatre-vingts désaccords de nom sont relevés. Ceux de l'ossature se ferment ici, en une fois,
parce qu'ils ne bougeront plus : le nom des portes, le nom des onglets d'une fiche, le titre de
chaque écran, et le mot de chaque retour en arrière.

Les autres — les libellés à l'intérieur d'un écran — se ferment dans la tranche qui touche cet
écran. C'est la décision 3.

**Le mot juste vient de `docs/vocabulaire.html`, pas de la maquette.** Quatre désaccords sont
déjà tranchés par la liste noire, et ils ne se rediscutent pas :

| Ce que la maquette et le produit écrivent | Ce qui s'écrit |
|---|---|
| *asset* | **un sujet** quand on désigne la chose, **une image** quand on désigne le fichier |
| *chose du jeu* | **un sujet** — le mot a servi, il ne sert plus |
| *projet* | **un jeu** |
| *appel*, *requête* | **une génération** |

Et deux règles d'usage du même document : **on dit la famille quand on peut** — *Ajouter un
personnage*, pas *Ajouter un sujet* ; le mot *sujet* ne sort que lorsqu'on mélange les familles.
**Les familles restent au pluriel** dans la colonne et dans les menus.

Trois désaccords ne sont tranchés par personne et se décident ici, une fois :

1. **L'écran de livraison porte quatre noms** — *Livrer au jeu*, *La sortie*, *Les livraisons*,
   et un composant qui s'appelle encore autrement. Un seul reste.
2. **La table de retouche se conjugue** — *Détourer* contre *Détourage*. Un nom ou un verbe,
   mais le même pour les huit.
3. **Le champ du modèle porte huit noms** — et *Moyen de fabrication* est déjà pris ailleurs,
   pour autre chose. Ce nom-là se règle avec RP4, qui réunit les huit fenêtres ; RP3 ne fait que
   l'inscrire dans la liste.

### Critères d'acceptation

- [x] Aucun mot de la liste noire de `docs/vocabulaire.html` ne paraît plus dans un libellé
  d'ossature — porte, onglet, titre d'écran, fil d'Ariane, retour en arrière.
- [x] Les portes de la colonne sont celles de la maquette, en nombre et en ordre, avec les mots
  du vocabulaire.
- [x] Les onglets de la fiche d'un sujet sont ceux de la maquette, en nombre et en ordre.
- [x] Chaque titre d'écran est le mot par lequel on y entre : on ne clique pas *Livrer au jeu*
  pour arriver sur *La sortie*.
- [x] Les trois désaccords non tranchés ci-dessus le sont, et la décision est écrite dans
  `docs/vocabulaire.html` — c'est lui qu'on modifie d'abord, pas l'écran.
- [x] La liste des désaccords restants est écrite, écran par écran, et chaque tranche d'après
  ferme les siens.
- [x] Un essai tient la liste fermée des noms de portes, d'onglets et de titres, comme les
  listes fermées du design tiennent les tailles. Il lit `docs/vocabulaire.html`, il ne recopie
  pas ses mots.

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

## RP6 · Une seule grille de choix d'image ✅ **close le 15 septembre 2026**

**Bloquée par** : RP3.

Deux grilles choisissent une image, et une troisième était morte. La grille, la recherche, les
favoris et la pagination sont écrits deux fois. Ce qui les sépare : le filtre par collection et
l'aperçu en grand d'un côté, le rôle demandé après le choix et l'import de fichier de l'autre.

### Critères d'acceptation

- [x] Une seule grille de choix d'image dans tout le produit.
- [x] Elle porte le filtre par collection, l'aperçu en grand, l'import de fichier, et le rôle
  quand celui qui l'ouvre en demande un.
- [x] Le rôle ne se demande que là où il a un sens.
- [x] L'invariant tient : cette grille n'est pas *la* grille d'assets du produit, et elle n'a ni
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
### Les gestes des deux côtés

`BibliothequePourImage.tsx` (« Choisir une référence ») :

- [x] Chercher par texte, filtrer par collection, filtrer par favoris.
- [x] Pagination (« Afficher les suivantes »).
- [x] L'aperçu en grand : le pointeur vise, la barre d'espace ouvre.
- [x] Reçoit des images voisines déjà connues (`voisines`), utilisé par la Superposition.
- [x] Un clic choisit l'image tout de suite, sans étape de confirmation.
- [x] Montée à neuf endroits : *Ce qui part*, Fabriquer en 3D, Vidéo libre, Les tuiles (deux
  fois), Workflows locaux, Importer des images, Superposition.

`ChoisirImageEquipement.tsx` (choisir une image pour un équipement) :

- [x] Chercher par texte, filtrer par favoris.
- [x] Pagination (« Afficher les images suivantes »).
- [x] Importer un fichier depuis le disque.
- [x] Un clic sélectionne l'image, puis demande son rôle — corps équipé, calque, ou référence —
  avant de confirmer.
- [x] Un mode *référence seulement* : le rôle est fixé, aucun sélecteur ne se montre.
- [x] Montée à deux endroits : les calques d'un emploi, la référence commune d'une pièce.

**La fusion.** `BibliothequePourImage.tsx` porte désormais tous ces gestes ; `ChoisirImageEquipement.tsx`
a disparu et ses deux montages lisent la grille unique avec `role="choix"` ou `role="reference"`.
Sans rôle demandé, le clic choisit tout de suite, comme avant ; avec un rôle demandé, il ouvre le
même temps de relecture qu'avant. Au passage, deux mots de
[`docs/releves/2026-09-15-desaccords-restants.md`](releves/2026-09-15-desaccords-restants.md)
§ RP6 se ferment : le bouton de fermeture porte désormais `‹ ` suivi du nom de l'écran d'où l'on
vient, et la pagination porte *Suivant* / *Précédent* au lieu d'« Afficher les suivantes ».


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

## RP14 · La découpe se règle  ✅ **close le 13 septembre 2026**

**Bloquée par** : rien.

Les zones sont anonymes : ni nom, ni case *garder*, ni coordonnées. Pas d'ajout de zone, pas de
retour arrière, pas de déplacement ni de redimensionnement d'un rectangle, et rien ne se relit
avant de créer. Une découpe ratée se refait en entier.

### Critères d'acceptation

- [x] Une zone se nomme, se garde ou s'écarte, et ses coordonnées se règlent au clavier.
- [x] Une zone s'ajoute, une zone se déplace, une zone se redimensionne.
- [x] Le dernier geste se défait.
- [x] Les sorties se relisent avant d'être créées.
- [x] La source est conservée, et la découpe se reprend depuis un résultat.

## RP15 · Le cadre du montage se règle, ou ne se propose plus  ✅ **close le 13 septembre 2026**

**Bloquée par** : rien.

L'écran de montage propose trois façons de mesurer le cadre, dont *à la main*. **Aucun contrôle
ne modifie ce cadre** : choisir *à la main* repose le rectangle que la machine venait de mesurer.
Il n'y a pas non plus de pivot.

Un choix qui promet ce qu'il ne fait pas est pire qu'un choix absent. Deux issues, et il faut en
prendre une : donner les champs, ou retirer le choix.

**Décision** : donner les champs. Le relevé du cadre et du pivot a déjà son outillage depuis
AU11, et la maquette les demande.

### Critères d'acceptation

- [x] Quatre champs règlent le cadre — gauche, haut, largeur, hauteur.
- [x] Deux champs règlent le pivot.
- [x] Ce qui est réglé à la main survit à la mesure automatique, et l'écran dit lequel des deux
  fait foi.
- [x] Le cadre réglé est celui qui sort à l'export.

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

# Temps 3 bis — Ce que l'usage a nommé le 15 septembre 2026

Quatre manques que l'auteur a trouvés en se servant du produit, et qu'aucun relevé n'avait vus :
un relevé compare le produit à la maquette, et la maquette ne les dessinait pas non plus. Ils
suivent la règle de tout ce plan — un seul écran par travail — et n'attendent aucun doublon :
ils se prennent dès que RP3 est close, avant ou après le temps 2, selon ce qui est libre.

## RP19 · L'image de référence d'une fiche se choisit  ✅ **close le 15 septembre 2026**

**Bloquée par** : rien.

La fiche d'un personnage montre une image en grand, en haut, à côté de sa description. C'est
elle que l'auteur voit en premier, et c'est elle qui dit *« voilà Champy »*. Aujourd'hui, elle
est choisie par le produit et l'auteur n'a pas la main dessus.

Ce qui manque est un geste, pas un écran : sur n'importe quelle image fixe du sujet, *En faire
l'image de référence*. La fiche la montre, le serveur la retient, et elle survit à la
fermeture. Une image retirée de la bibliothèque cesse d'être la référence, et la fiche retombe
sur le choix du produit — sans rien casser et sans rien demander.

**Ce qui est distinct, et doit le rester** : l'*artwork officiel* d'un jeu sert à la palette
et part avec les demandes ; l'*image retenue* d'une case est celle qui part dans le jeu.
L'image de référence d'une fiche n'est ni l'un ni l'autre — c'est un portrait, et en choisir
un ne change ni la palette, ni ce qui est livré.

**Ce qui a été posé.** Un champ sur le sujet, `image_de_reference`, écrit dans son fichier —
l'index le relit sans rien à migrer. Une route, `PUT /characters/{id}/reference-image`, où
`asset: null` retire : poser et retirer sont le même geste. Le geste vit sur le volet d'*Images
fixes*, avec les deux autres gestes de la case. L'agent le lit dans `list_characters` ; aucun
outil ne l'écrit.

**Et le repli n'est pas un rattrapage, c'est la forme du champ.** Le choix est un identifiant,
jamais une copie : on le cherche parmi les images fixes du sujet, et s'il n'y est plus — image
supprimée, écartée, rattachée ailleurs, devenue un calque — la règle d'avant reprend la main.
Il n'y a donc rien à nettoyer quand une image part, et aucun chemin où l'écran pourrait
montrer un trou.

### Critères d'acceptation

- [x] Depuis une image fixe du sujet, un geste en fait l'image de référence de la fiche, et la
  fiche la montre aussitôt.
  *Le geste vit sur le volet de l'image, à côté des deux autres gestes de la case, et il est
  grisé avec sa raison sur celle qui l'est déjà. « Aussitôt » tient parce que la route rend le
  sujet entier et que l'onglet le remonte d'un cran : rien n'est rechargé. Vérifié aux essais
  d'écran, pas au navigateur.*
- [x] Le choix survit à la fermeture et à la réouverture du jeu ; il est écrit dans le dossier
  du sujet, pas dans le navigateur.
  *Un essai relit le JSON de `donnees/projets/<jeu>/personnages/` et y trouve le champ ; un
  autre efface l'index et le reconstruit.*
- [x] Une fiche sans choix montre ce qu'elle montrait avant, et rien d'autre ne change.
- [x] Choisir une image de référence ne promeut aucun artwork officiel, ne retient aucune case,
  et n'appelle jamais le fournisseur.
- [x] Supprimer l'image de référence ramène la fiche au choix du produit, sans message d'erreur.
  *Le repli est tenu par construction des deux côtés : l'écran cherche le choix parmi les
  images que la fiche a déjà, le serveur le revalide avant de le rendre. Une image écartée,
  rattachée ailleurs ou devenue un calque cesse donc d'être la référence sans qu'on efface
  quoi que ce soit — le champ garde son identifiant, et il ne désigne plus rien.*
- [x] L'agent peut lire quelle image est la référence d'un sujet ; il ne peut pas la choisir.
  *`list_characters` porte `reference_image`, **résolu** — le choix de l'auteur, sinon le
  repli. Aucun outil neuf : un essai vérifie qu'aucun nom d'outil ne parle de référence.*

## RP20 · Enregistrer sous — une image ou une animation modifiée devient une autre pose ou direction

**Bloquée par** : rien. **Elle s'appuie sur** : l'invariant *le traitement est non destructif*
(`T2`) et sur ce que le domaine sait déjà — la direction au miroir d'une direction existe.

L'auteur ouvre l'animation *marche vers l'est* dans l'atelier, lui applique le miroir, et
obtient une marche vers l'ouest sous ses yeux. Il ne peut pas la garder : la recette décrit
*cette* animation, et l'enregistrer la changerait de sens sans lui donner de nouvelle case.
Il manque le geste **Enregistrer sous** — le résultat devient une nouvelle image ou une
nouvelle animation, rangée sous une autre pose ou une autre direction du même sujet.

Ce que le geste fait, et ne fait pas :

- il **crée** un nouvel asset dont l'image brute est le rendu actuel, avec une recette vide —
  l'original garde sa recette, intacte, et son rendu ne bouge pas ;
- il **propose** la case d'arrivée : quand la recette porte un miroir, la direction proposée
  est la direction au miroir de l'original ; sinon la même case, à corriger ;
- il **écrit la filiation** : le nouvel asset dit de quel original et de quelle recette il
  vient, et l'original sait qu'il a été enregistré sous ;
- il vaut pour une **image** comme pour une **animation** — dans ce cas chaque frame est
  rendue, et la bande garde sa cadence ;
- il ne paie rien, n'appelle rien, marche réseau coupé.

**Ce que ce n'est pas.** Ce n'est pas *retenir* : la nouvelle case n'est pas retenue pour le
jeu tant que l'auteur ne le dit pas. Et ce n'est pas *dupliquer* au sens d'une copie à
l'identique : la copie porte le rendu, pas la recette — sinon deux recettes divergeraient sur
la même image brute.

### Critères d'acceptation

- [ ] Depuis l'atelier d'une image et depuis l'atelier d'une animation, un geste *Enregistrer
  sous* est disponible dès qu'une recette est appliquée, et grisé avec sa raison sinon.
- [ ] L'écran demande le sujet, la pose et la direction d'arrivée, préremplis ; avec un miroir
  dans la recette, la direction proposée est celle au miroir.
- [ ] Le nouvel asset entre en bibliothèque avec le rendu pour image brute et une recette
  vide ; l'original garde sa recette et son rendu, vérifié à l'octet.
- [ ] Pour une animation, la nouvelle bande a le même nombre de frames et la même cadence, et
  chaque frame est le rendu de la frame d'origine.
- [ ] Le nouvel asset dit son origine — original et recette —, et la fiche de l'original le
  liste parmi ses dérivés.
- [ ] La nouvelle case n'est pas retenue pour le jeu ; la retenir est un second geste.
- [ ] Aucun appel au fournisseur ; le geste marche réseau coupé, et un essai le tient.
- [ ] L'agent dispose du même geste par l'outil MCP correspondant, avec les mêmes règles.

## RP21 · Une planche découpée sur la toile devient une animation

**Bloquée par** : rien. **Elle s'appuie sur** : `AU19` — une feuille de sprites découpée
devient un clip et ses bandes — et `RP14` — la découpe se règle.

L'auteur pose sur la toile de l'univers une planche qui contient les huit images d'une marche,
la découpe, et obtient huit images séparées. Il ne peut pas en faire une animation : le geste
*Animer* de la découpe n'est offert qu'à une planche de la bibliothèque, jamais à une carte de la
toile, et rien ensuite ne permet de reprendre huit images pour en faire une bande. Le chemin
d'`AU19` existe ; il n'a qu'une porte, et ce n'est pas celle par laquelle l'auteur passe.

Ce qui se livre :

- **la découpe d'une carte de la toile offre *Animer*** aux mêmes conditions qu'une planche de
  la bibliothèque — sujet, pose, direction, et une bande par ligne quand les lignes sont les
  directions du jeu ;
- **et le chemin inverse** : depuis une sélection d'images fixes d'un même sujet — celles qu'une
  découpe vient de créer, ou n'importe lesquelles —, *En faire une animation* ouvre l'atelier
  de montage avec ces images pour frames, dans l'ordre de la sélection, et la bande se range
  sous la pose et la direction que l'auteur nomme.

La toile n'apprend rien de neuf : elle mène à l'atelier qui sait déjà faire. C'est la règle
du produit depuis `E1` — l'établi est une profondeur, pas un lieu de plus.

### Critères d'acceptation

- [ ] Sur la toile, la découpe d'une carte importée offre *Animer*, et une bande en sort avec
  le même résultat que depuis une planche de la bibliothèque — un essai compare les deux.
- [ ] Une sélection d'images fixes d'un même sujet offre *En faire une animation* ; l'atelier
  de montage s'ouvre avec ces images pour frames, dans l'ordre de la sélection.
- [ ] La bande créée se range sous le sujet, la pose et la direction nommés, et chaque frame
  dit de quelle image elle vient.
- [ ] Une sélection qui mélange deux sujets ne propose pas le geste, et dit pourquoi.
- [ ] Aucun appel au fournisseur, aucun encodage vidéo : la transparence des images est
  conservée, comme en `AU19`.
- [ ] Les huit images restent en bibliothèque après le montage ; en faire une bande ne les
  consomme pas.

## RP22 · Une table se défait, se remet à zéro, et se voit avant d'enregistrer

**Bloquée par** : rien. **Elle s'appuie sur** : l'invariant du lot U — *une place s'éteint
sans se vider : éteindre et vider ne sont pas le même geste* — et sur `G3` — *une explication
écrite pour un réglage est atteignable depuis ce réglage*.

L'auteur ouvre une animation dans l'atelier, clique *miroir gauche-droite*, et ne peut plus
le décliquer : les choix d'un *sens* sont une liste où l'on choisit, jamais où l'on renonce.
Sur l'établi d'une image, chaque table a sa bascule *L'endormir / La réveiller* ; dans
l'atelier d'une animation, cette bascule n'est pas sous la main, et aucun geste ne remet une
table à zéro. Et le résultat de la retouche n'est visible qu'après *Enregistrer*, alors que
le code prétend refaire l'aperçu à chaque geste — ce qu'il fait pour les prises et la
position, pas pour la recette qu'on vient de toucher. Enfin la section *Position, source et
pelure d'oignon* ne dit ni ce qu'elle fait ni comment on s'en sert.

Ce qui se livre, dans l'atelier d'une animation comme sur l'établi d'une image :

- **un choix se déclique** : cliquer le *sens* déjà choisi le retire, et la recette ne porte
  plus de retournement ;
- **une table s'éteint et se vide, en deux gestes distincts**, avec les mots de l'établi ;
  *remettre à zéro* vide la table et la laisse allumée ;
- **l'aperçu montre la recette avant d'enregistrer**, retournement compris — *Enregistrer*
  écrit, il ne révèle pas ;
- **la section de la frame dit ce qu'elle fait** : elle se renomme d'après ses trois gestes —
  déplacer l'image dans son cadre, la remplacer par une autre image du clip ou d'un clip
  voisin, voir la précédente en transparence — et chaque geste porte son explication lue dans
  le recueil, jamais retapée.

### Critères d'acceptation

- [ ] Dans l'atelier d'une animation, cliquer un *sens* déjà choisi le retire ; la recette
  n'en porte plus, et l'aperçu le montre sans enregistrer.
- [ ] Chaque table de l'atelier d'une animation a la bascule *L'endormir / La réveiller* de
  l'établi, et un geste *Remettre à zéro* qui vide la table sans l'éteindre.
- [ ] L'aperçu se refait à chaque geste sur la recette, retournement compris ; un essai le
  tient en comparant l'aperçu avant *Enregistrer* au rendu après.
- [ ] La section *Position, source et pelure d'oignon* porte un titre qui dit ses trois
  gestes, et chacun a une explication atteignable depuis lui, lue dans le recueil.
- [ ] Les mêmes mots pour les mêmes gestes sur l'établi d'une image et dans l'atelier d'une
  animation — `docs/vocabulaire.html` les fixe.
- [ ] Aucun de ces gestes n'écrit sur le disque avant *Enregistrer*, et *Défaire* les reprend.

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
