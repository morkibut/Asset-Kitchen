# RG3 · « Imposé par le jeu » et « Sa recette » deviennent un seul bloc

> Décision écrite le 20 septembre 2026. Elle arrête **ce que le bloc dit**, ligne par ligne.
> Elle ne touche à aucun fichier de code : c'est la session appelante qui applique.
>
> Fichiers concernés à l'application : `interface/src/composants/Fiche.tsx`
> (`ImposeParLeProjet` l. 537-703, `RecetteEnLecture` l. 1476-1531), `interface/src/aide.ts`
> (`fiche.impose`, `fiche.recette`, `fiche.reinjecter`, `fiche.personnage`).

---

## 1 · Le relevé — ce que chacun dit aujourd'hui

| | **Imposé par le jeu** (`ImposeParLeProjet`) | **Sa recette** (`RecetteEnLecture`) |
|---|---|---|
| **Sa source** | route `/assets/{id}/imposed` — la recette que le jeu imposerait **maintenant**, recalculée | la recette que **cette image porte**, rangée avec elle |
| **Sa forme** | bloc repliable (`Bloc`), 5 lignes max, colonne droite `appliqué` / `réglé à la main` | table plate toujours ouverte, 8 places, celles qui sont posées |
| **Replié** | les premiers segments collés : `bord · 96 px · 100 % · vote e…` | ne se replie pas |
| **Ses lignes** | `détourage` · `taille de pixel` · `occupation` · `réduction` · `palette` / `couleurs` | `détourage` · `recadrage` · `grille` · `quantification` · `bords` · `contours` · `retournement` · `la main` |
| **Ce qu'il porte seul** | la **provenance** du détourage (famille / nature / produit), l'**échelle** à côté de l'occupation (`40 % · objet tenu`), l'écart **jeu ↔ main**, l'état « on ne sait pas » | les cinq places que le jeu n'impose jamais : **bords, contours, retournement, la main**, et le **recadrage** avec sa boîte et sa marge |
| **Ce qu'il tait** | tout ce qui a été posé à la main hors des cinq lignes ; et **la cause de chaque étape** | d'où vient chaque valeur ; si elle est encore celle du jeu ; **la cause de chaque étape** |

**Les deux taisent la même chose, et c'est celle qui manquait.** Aucun ne dit *pourquoi* une
passe existe ou n'existe pas. Dans `Univers.recette_de` (`atelier/domaine/projet.py` l. 1149),
chaque étape a pourtant une cause unique et nommable :

| Étape | Ce qui décide qu'elle existe |
|---|---|
| détourage (passe) | `echelle.silhouette` — la **nature du sujet**, pas un réglage |
| recadrage | exactement la même — `silhouette` |
| grille | `cible_px != AUCUNE_CIBLE` — le jeu a posé une taille de pixel, ou non |
| occupation | dans la grille ; sa valeur est `echelle.occupation`, donc la nature |
| quantification | `sur_grille` **et** `style == PIXEL_ART` — un jeu en dessin ne réduit pas |
| palette imposée | `palette` non vide, c'est-à-dire des artworks déposés ; vide → couleurs lues sur l'image |
| bords | **jamais** imposé (`bords=None`) — il efface, et on n'efface pas sans demande |
| ce qui n'a pas d'échelle | `echelle=None` → `silhouette=True` par défaut : le jeu traite l'image **comme un personnage** |

Cette dernière ligne est le défaut qui a coûté une séance à l'auteur. Ni l'un ni l'autre des
deux blocs ne l'écrivait.

### Un défaut à corriger au passage

`ImposeParLeProjet` affiche la ligne `détourage` dès que `impose.detourage` n'est pas `null`.
Or `_provenance_du_detourage` (`atelier/services/assets.py`) rend la passe par défaut **sans
regarder `silhouette`** : elle répond « voilà la passe qui s'appliquerait », pas « voilà la
passe qui s'est appliquée ». Sur une matière — `silhouette=False`, donc `recette.passes` vide —
le bloc montre donc une ligne de détourage, et comme `premiere === null` force `main: true`,
il la marque **« réglé à la main »**. Le produit accuse l'auteur d'avoir posé un détourage
sur une image qui n'en a jamais eu.

**Règle du bloc fusionné** : la valeur affichée est celle que l'image **porte**
(`recette`) ; `impose` ne sert qu'à dire la **provenance** et à détecter l'écart. Une place
vide des deux côtés n'est jamais « réglée à la main ».

---

## 2 · Les lignes du bloc unique

**Titre : « Ce que le jeu lui a fait ».** Conservé de la maquette. Le titre pourrait mentir sur
une image entièrement reprise à la main — mais chaque ligne porte alors sa marque à droite, et
le titre n'a pas à couvrir le cas rare au prix du cas courant, qui est la question posée :
*pourquoi cette image ne ressemble-t-elle pas à ce que le modèle a rendu ?*

**Ordre : celui du traitement**, fixé par `recette.py` — découpe, cadre, taille, couleurs, puis
ce qui a été ajouté après. C'est l'ordre vrai, et c'est celui qui explique : chaque ligne
suppose la précédente.

**Forme d'une ligne** : `libellé` — `valeur — raison` — `marque`.
Libellé en sans 11 px `encre-2` ; valeur et raison en mono 10.5 px, la raison en `encre-4` ;
marque à droite, mono 10.5 px. Tailles de `docs/DESIGN.md` § Typography, rien de neuf.

### Les lignes, dans l'ordre

**1 · Découpe du contour** — toujours présente.

| Cas | Valeur et raison |
|---|---|
| une passe, posée par le jeu | `bord, 2 px rongés — le réglage livré` |
| idem, venue d'un réglage de famille | `bord, 2 px rongés — ton réglage pour les Décors` |
| idem, venue de la sorte d'image | `pipette — ton réglage pour cette sorte d'image` |
| plusieurs passes | `3 passes` |
| `silhouette=False` (matière, décor, tuile) | `non — une matière remplit son cadre` |
| **échelle introuvable au barème** | `oui — « matière » n'est pas au barème du jeu, il la découpe comme un personnage` |
| image entrée telle quelle (`traiter=False` ou sans projet) | la ligne n'existe pas — voir l'état du bloc |

Les mots `bord` · `pipette` · `modèle` · `sélection` · `palette du jeu` sont ceux de `MOTEUR`.
La formule de la raison pour `silhouette=False` se fabrique sur le nom de l'échelle :
*« non — {une matière / un décor / une tuile} remplit son cadre »*.

**2 · Cadre resserré** — **seulement quand elle dit quelque chose**, c'est-à-dire quand le
recadrage porte une boîte tracée ou une marge non nulle.
`tracé 96×96` · `marge 4 px` · `tracé 80×96 · marge 2 px`.
Le recadrage automatique n'a pas de ligne : sa cause est exactement celle de la découpe, et
une ligne qui répète la précédente n'apprend rien.

**3 · Taille des pixels** — toujours présente.

| Cas | Valeur et raison |
|---|---|
| grille posée | `96 px` |
| `cible_px == AUCUNE_CIBLE` | `aucune — ce jeu n'impose pas de taille de pixel` |

**4 · Part de la case remplie** — présente quand la grille existe.

| Cas | Valeur et raison |
|---|---|
| échelle connue | `40 % — c'est ce que le jeu donne à un objet tenu` |
| plein cadre | `100 % — c'est ce que le jeu donne à une matière` |
| échelle introuvable au barème | `100 % — « matière » n'est pas au barème du jeu, il la met plein cadre` |

**5 · Façon de réduire** — présente quand la grille existe.
`vote en deux temps` · `réduction douce` · `au plus proche`… (`NOM_DE_LA_METHODE`, déjà en
français). Pas de raison : c'est un réglage du jeu, et le lien du pied mène là où on le change.

**6 · Couleurs** — toujours présente.

| Cas | Valeur et raison |
|---|---|
| palette du jeu | `64 — sur la palette du jeu` |
| pixel art sans artwork déposé | `64 — lues sur l'image, ce jeu n'a pas de palette` |
| `style == DESSIN` | `toutes — ce jeu est en dessin, on ne réduit pas les couleurs` |
| `AUCUNE_CIBLE` | `toutes — sans taille de pixel, le jeu ne réduit pas les couleurs` |

**7 à 10 · Ce que le jeu n'impose jamais** — chacune présente uniquement si elle est posée, et
marquée `posé par toi` :

| Libellé | Valeur | Quand |
|---|---|---|
| **Nettoyage des bords** | `tache 12 px · vote 3` | `recette.bords` |
| **Contour ajouté** | `2 px · externe` | `recette.contours` |
| **Retourné** | `miroir gauche-droite` | `recette.retournement` |
| **Retouches au pixel** | `3 passages` | `recette.main` |

Valeurs reprises telles quelles de `RESUME` (`interface/src/recette.ts`) : deux façons de
résumer la même recette en diraient deux choses.

### La marque de droite — trois états, plus deux

- **rien** — la valeur est celle du jeu, appliquée telle quelle. Le silence est le cas normal,
  et aujourd'hui `appliqué` le répète cinq fois sur cinq lignes pour ne rien apprendre.
- **`réglé à la main`** (encre d'attention) — le jeu imposait autre chose, et l'image porte
  autre chose. La comparaison est celle d'aujourd'hui, corrigée : une place vide des deux
  côtés ne se marque pas.
- **`posé par toi`** — la place que le jeu n'impose jamais (lignes 7 à 10). Écrire « réglé à
  la main » sur un nettoyage de bords laisserait croire qu'il existait un réglage du jeu à
  déranger.

### Le pied du bloc

Une seule ligne, en bas, `encre-controle` :

- cas courant — **`Voir ces règles dans Réglages ›`**, vers les règles du jeu.
- échelle introuvable au barème — **`Ajouter « matière » au barème ›`**, vers le barème de
  l'écran Univers, sur la nature manquante.

Ce n'est pas le troisième chemin retiré le 31 août 2026 : celui-là doublait « La retoucher »
et menait aux tables. Celui-ci mène à l'endroit où les **règles du jeu** se changent, et la
fiche n'y allait pas.

---

## 3 · Ce qui se replie, ce qui reste visible

Le bloc est **fermé par défaut** (`Bloc`, registre de repli global, clé `fiche.recette`).

Fermé, la rangée porte à droite, en mono 10.5 px, **au plus trois segments** :

| Situation | Ce qu'on lit fermé |
|---|---|
| courant | `96 px · 64 couleurs` |
| image non découpée | `sans découpe · 96 px · 64 couleurs` |
| des places reprises à la main | `96 px · 64 couleurs · 2 à la main` |
| **échelle introuvable au barème** | `« matière » n'est pas au barème` — seul, en encre d'attention |
| génération absente du disque | `on ne sait pas` |
| image entrée telle quelle | `rien — elle est entrée telle quelle` |

La règle du choix : **la taille et les couleurs sont les deux valeurs qui font qu'une image ne
ressemble pas à ce qui est revenu du modèle** ; la découpe ne se dit fermée que quand elle
dit *non*, parce que c'est l'état surprenant. Le compte des reprises à la main passe devant
les couleurs si les trois segments ne tiennent pas.

Quand le barème ne porte pas la nature, la rangée fermée ne dit plus que cela. C'est la seule
chose à lire à ce moment-là, et c'est ce qui aurait mis l'auteur devant sa cause sans ouvrir
quoi que ce soit.

Ouvert, la droite de la rangée passe à `tout est appliqué` / `2 réglés à la main`
(fente `mesure` de `Bloc` — les deux ne cohabitent jamais).

---

## 4 · Ce qui disparaît

| Ce qui part | Où ça va |
|---|---|
| le titre **« Sa recette »** et sa table de 8 places | chaque place devient une ligne du bloc, présente seulement si elle est posée |
| le titre **« Imposé par le jeu »** | le bloc s'appelle « Ce que le jeu lui a fait » |
| la ligne **`recadrage`** quand elle ne dit que `marge 0 px` | rien — elle répétait la cause de la découpe |
| la colonne **`appliqué`**, cinq fois sur cinq lignes | le silence. « Réglé à la main » garde tout son sens en étant la seule marque |
| **`bord · 96 px · 100 % · vote e…`** replié | remplacé par trois segments choisis, jamais tronqués au milieu d'un mot |
| la **tolérance** de la passe (`bord · 12` de `RESUME.detourage`) | les tables, où elle se règle. Seule, elle ne se lit pas ; le moteur et les pixels rongés, si |
| la phrase **« Rien n'est posé : cette image est celle qui est arrivée du fournisseur. »** | l'état du bloc fermé, `rien — elle est entrée telle quelle`, et la même phrase en clair une fois ouvert |
| l'entrée d'aide **`fiche.impose`** | fondue dans `fiche.recette` (ci-dessous) |

**Aucune perte d'information.** Les deux seules valeurs retirées sont la tolérance — qui part
vers l'écran où elle se règle — et le mot `appliqué`, qui n'était pas une information.

**Deux informations sont gagnées**, et ce sont celles du critère de RG3 : la **cause** de
chaque étape, et le fait qu'une nature **manque au barème**.

---

## 5 · Les trois fiches d'aide, réécrites

À écrire dans `interface/src/aide.ts`. `fiche.impose` est supprimée ; son contenu utile est
repris ici.

### `fiche.recette`

```ts
"fiche.recette": {
  nom: "Ce que le jeu lui a fait",
  ou: "case",
  quoi: "Chaque étape que cette image a subie depuis qu'elle est revenue du modèle — avec, pour chacune, pourquoi elle s'est appliquée ou non.",
  change:
    "Rien : c'est une lecture. Une ligne marquée « réglé à la main » dit que tu as changé ce que le jeu proposait ; une ligne marquée « posé par toi » dit que le jeu ne proposait rien. On règle dans les tables, sur l'image en grand — et on change les règles du jeu dans Réglages, par le lien du bas.",
  origine: "les règles de ton jeu, telles qu'elles sont maintenant · l'image elle-même",
  long:
    "Sans ce bloc, tu vois une image qui ne ressemble pas à ce que le modèle a rendu, sans savoir pourquoi : la remise sur grille et la réduction des couleurs s'appliquent à la naissance, sans rien demander et sans rien dire.\n\nCe qui décide n'est presque jamais un réglage, c'est la sorte d'image. Une matière remplit son cadre, donc elle n'est pas découpée ; un personnage a un contour, donc il l'est. Si la ligne du haut dit qu'une sorte d'image n'est pas au barème du jeu, c'est la cause à corriger en premier : le jeu traite alors cette image comme un personnage, il la découpe et la recadre — et le lien du bas mène droit à l'endroit où l'ajouter.\n\nLes valeurs du jeu sont recalculées à chaque lecture, jamais rangées avec l'image : la question posée est « qu'est-ce que le jeu impose maintenant », et une valeur enregistrée aurait vieilli au premier réglage changé.\n\nLe bloc dit « on ne sait pas » quand la génération de l'image n'est plus sur le disque, et une image importée n'en a jamais eu : le produit préfère l'avouer que de répondre « rien », qui est une réponse différente et fausse.",
},
```

### `fiche.reinjecter`

Le bloc s'appelle désormais **« S'en resservir »**, et ses quatre boutons portent ce qu'ils
font : *elle inspire* · *elle est le point de départ* · *elle donne la manière* ·
*reprendre ses réglages*.

> **Renversé à l'application (relecture croisée du 20 septembre 2026).** Les trois premiers
> libellés ont été refusés : ils faisaient parler l'image, ce que la consigne d'écriture de
> l'auteur interdit. L'écran porte **référence · image à retoucher · guide de style ·
> reprendre ses réglages** (`Fiche.tsx`, bloc « S'en resservir »). Le texte d'aide ci-dessous
> reste celui d'origine : à lire comme une intention, pas comme le libellé livré.

```ts
"fiche.reinjecter": {
  nom: "S'en resservir",
  ou: "case",
  quoi: "Repartir de cette image pour en fabriquer une autre, de quatre façons.",
  change:
    "Trois façons envoient l'image au modèle : elle inspire (une référence de plus), elle est le point de départ (le modèle la modifie), elle donne la manière (sa couleur et son trait). La quatrième n'envoie rien : elle recharge le texte, le modèle et les réglages qui ont fabriqué celle-ci, pour retenter.",
  origine: "toi · rien tant que tu n'as pas cliqué",
  long:
    "Rien ne part et rien n'est dépensé tant que tu n'as pas appuyé sur Générer : le rôle se pose dans le panneau de l'atelier, et le bloc « Ce qui part » se met à jour pour le dire. Le nombre de références y monte d'un cran, et chaque modèle a son plafond.\n\nLa quatrième est celle qu'on prend le plus souvent : après un tri, refaire une image dont on a perdu les réglages est le geste courant.",
},
```

### `fiche.personnage`

Le bloc s'appelle désormais **« Sujet »** — « Corps de » ne se comprenait pas —, et la case
Pose dit pourquoi elle est vide au lieu d'être grisée sans raison.

```ts
"fiche.personnage": {
  nom: "Sujet",
  ou: "case",
  quoi: "Le sujet du jeu auquel cette image appartient, et la pose qu'elle en montre.",
  change:
    "Rien à la génération. L'image vient remplir la case correspondante sur la page du sujet, en vignette — elle ne quitte pas la bibliothèque pour autant.",
  origine: "toi · les poses proposées viennent du sujet",
  long:
    "Une image naît dans l'atelier et nulle part ailleurs : on écrit ce qu'on veut, on génère, et c'est ici qu'on dit à quoi ça appartient.\n\nLes poses proposées sont celles que ce sujet-là réclame, jamais toutes celles du jeu. Quand la case est vide et le reste, c'est que sa sorte n'a pas de pose du tout — une matière, une tuile —, et la case l'écrit plutôt que de se griser.\n\nRetirer la désignation ne touche pas à l'image : elle reste dans la bibliothèque, la case redevient vide.",
},
```

---

## Ce qu'il reste à trancher à l'application

- **`_provenance_du_detourage` ne regarde pas `silhouette`.** Le bloc fusionné s'en protège en
  affichant `recette` et non `impose`. Corriger le service serait plus propre, mais c'est du
  serveur : hors de RG3, à poser en RG8 si la relecture croisée le confirme.
- La place **`difference`** de `Recette` (les calques d'équipement) n'était affichée par aucun
  des deux blocs et ne l'est pas davantage ici. Elle a son écran — laissé tel quel.
