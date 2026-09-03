# Rien ne dit qu'un détourage est en cours

> **État : tranchée.** La barre d'attente **existe déjà**, elle est calculée à chaque retouche, et
> personne ne l'affiche : elle a été perdue le 31 août 2026 en déménageant la retouche. Les durées
> du § 2 sont mesurées sur cette machine, sur les images du dépôt. Les deux questions sont
> arbitrées ; ce qu'il faut construire est au § 7 — et une chose trouvée en mesurant n'appartient
> pas à cette remarque : elle est à la fin.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> 7. dans le détourage, quand on lance un modèle et qu'i lest pas instantanée, ce serait bien
> d'avoir un petit feedback (spining wheel) pour indiquer que le détourage est en cours et qu'il
> faut attendre.

---

## 2 · Ce que le produit fait aujourd'hui

### L'attente est réelle, et elle dure plus d'une seconde

Mesuré le 3 septembre 2026 sur cette machine, sur des images du dépôt, **calcul du serveur seul** —
sans le réseau, sans la file d'attente, sans le rechargement de l'image par le navigateur :

| Ce qu'on pose | Image de 1 024 px | Image de 424 × 658 |
|---|---|---|
| *rien du tout* — recette vide | **668 ms** | 235 ms |
| détourage par le bord — **le défaut** | **807 ms** | 289 ms |
| détourage par le bord, sur une image déjà mise sur grille | 171 ms | 66 ms |
| détourage par un modèle | **1 066 ms** | 570 ms |
| détourage par un modèle, sur une image déjà mise sur grille | 452 ms | 354 ms |

Trois choses s'en déduisent.

**Même ne rien faire coûte deux tiers de seconde.** Sur une image de 1 024 px, décoder le PNG et le
réencoder occupe déjà 668 ms : la retouche n'y ajoute qu'une fraction. Ce n'est donc pas *le
détourage* qui fait attendre, c'est **la taille de l'image**.

**Le pire moment est le premier.** Une image qui sort d'une génération fait 1 024 px et n'a pas
encore de grille — c'est exactement l'état dans lequel on ouvre les tables pour la première fois, et
c'est le plus lent des cas. Une fois l'image posée sur une grille de 64 px, tout retombe sous le
quart de seconde. **L'attente mord le plus fort à l'endroit précis où l'auteur découvre l'écran.**

**Et ce n'est pas propre au moteur par modèle.** Le moteur par le bord, qui est le défaut et qui ne
charge aucun modèle, met 807 ms. La remarque parle du modèle parce que c'est là qu'on l'a
remarquée ; le manque est le même partout.

Le relevé au navigateur du 27 août 2026, cité dans le code
([`Places.tsx:173`](../../interface/src/composants/Places.tsx#L173)), donne les durées **de bout en
bout**, réseau et file compris : *un cran de tolérance coûte 1 492 ms, le moteur modèle 2 255, là
où l'occupation en coûte 29.* Les deux relevés se recoupent.

### Pendant ce temps, l'écran ne bouge pas d'un pixel

L'image affichée tient son adresse de l'empreinte de l'asset
([`Tables.tsx:1932`](../../interface/src/composants/Tables.tsx#L1932)) : elle ne change que
lorsque le serveur a fini et publié la nouvelle. Les réglages ne s'éteignent pas, rien ne
s'assombrit, aucun compteur ne part. **Le seul signe qu'il se passe quelque chose est que l'image
change — c'est-à-dire le signe que c'est fini.**

### Et la barre existe déjà — elle est calculée à chaque retouche, et jetée

Le crochet qui pose une recette tient un état `enVol`
([`Places.tsx:184`](../../interface/src/composants/Places.tsx#L184)) : l'instant du départ, et
l'attente probable. **Cette attente n'est pas écrite en dur, elle s'apprend** — après chaque
retouche, le crochet retient ce que celle-ci a mis, séparément pour une retouche lourde et pour une
légère. Il le rend à l'écran, en toutes lettres
([`Places.tsx:251`](../../interface/src/composants/Places.tsx#L251)).

L'écran des tables l'ignore. Il prend cinq choses sur les six
([`Tables.tsx:1058`](../../interface/src/composants/Tables.tsx#L1058)) :

```
const { recette, setRecette, regler, poser, revenirAuBrut } = useRecette(asset, onErreur)
```

`enVol` n'est pas dedans. Il est calculé à chaque geste, tenu à jour, et **personne ne le lit**.

La barre, elle aussi, existe : c'est `Jauge`
([`chassis.tsx:904`](../../interface/src/composants/chassis.tsx#L904)), et sa documentation dit
mot pour mot ce que la remarque réclame —

> Le seul mouvement continu du produit, et il n'y en a qu'un : une génération dans la grille **et
> une retouche dans la fiche** portent la même barre, aux mêmes 2 px, dans la même couleur.

Elle est rendue à trois endroits : la génération, la tuile d'une image en route, et le travail des
ambiances. **Pas dans les tables.** La phrase de sa propre documentation est fausse depuis trois
jours.

### Comment elle s'est perdue, et pourquoi rien ne l'a dit

- **27 août 2026**, commit `46f349a` : la barre est posée sur la retouche, dans la fiche, avec
  l'attente apprise. C'est le commit qui mesure *« un cran de tolérance coûte 1 492 ms »* — elle
  est née de cette mesure-là.
- **31 août 2026**, commit `1bb3925` (tranche `E4`, *« la galerie rend sa place aux images »*) : la
  fiche perd la retouche, qui descend dans les tables. La barre est retirée de la fiche **et n'est
  pas remontée dans les tables**. Le crochet, lui, a déménagé entier — c'est pour ça que le calcul
  a survécu à son affichage.
- **Aucun essai ne l'a vue partir.** Le seul essai qui exerce la barre d'attente vise la palette
  ([`App.test.tsx:16114`](../../interface/src/App.test.tsx#L16114), `data-attente-palette`), et son
  commentaire dit pourtant *« une jauge, pas une neuve : celle de la génération **et de la
  retouche** »*. Il affirme le partage sans jamais exercer la retouche. Le commit `E4` le note
  lui-même, à propos d'une autre perte du même jour : *« les 238 essais sont restés verts — ils
  interrogent des rôles et des libellés »*.

**Ce n'est donc pas un manque, c'est une régression de trois jours**, et la remarque de l'auteur
est le premier signalement qui en soit sorti.

---

## 3 · Pourquoi c'est comme ça

**Parce que le produit refuse d'écrire une durée qu'il ne connaît pas.** Le serveur publie une
durée attendue pour une génération — il la tient du catalogue —, mais pas pour une retouche : elle
dépend de la machine, de la taille de l'image, et de ce qu'on a posé. Plutôt que d'inventer un
nombre, le crochet **apprend** : il garde ce que la dernière retouche du même genre a mis, ici, sur
cette image. C'est pour ça que la valeur de départ est une seconde et demie et qu'elle se corrige
toute seule dès le deuxième geste.

**Et parce que la barre ne ment pas.** Elle avance vers l'attente mesurée, puis ralentit sans
jamais atteindre le bout, faute de savoir quand ça finira. C'est la différence de fond avec la roue
qui tourne : une roue dit *ça travaille* ; la barre dit *ça travaille, et voilà où ça en est*.

**Le seuil de 240 ms** ([`chassis.tsx:904`](../../interface/src/composants/chassis.tsx#L904))
existe parce qu'une queue de recette répond en 29 ms : y faire clignoter une barre serait pire que
de ne rien montrer. Les mesures du § 2 disent que ce seuil est bien placé — le détourage d'une
image sur grille (171 ms) passe dessous et ne montrera rien, le détourage d'une image fraîche
(807 ms) passe dessus et se montrera.

---

## 4 · Ce qui borne la solution

- **La liste de ce qui bouge est close** (`docs/DESIGN.md` § Motion), et son seul mouvement continu
  est *déterminé* : « ça travaille, et voilà où ça en est ». **Une roue qui tourne n'y entre pas** —
  elle serait un second mouvement continu, et un mouvement qui en dit moins.
- **Une seule barre dans tout le produit.** La génération, la tuile et les ambiances portent la
  même ; la retouche doit porter celle-là, pas une neuve.
- **Rien au-dessus de 240 ms**, et rien ne paraît sous 240 ms.
- **La place se réserve en permanence.** Les ambiances gardent 2 px vides
  ([`Ambiances.tsx:169`](../../interface/src/composants/Ambiances.tsx#L169)) pour qu'une barre qui
  paraît ne pousse rien vers le bas : *« ça ferait sauter ce qu'on regarde, et c'est précisément le
  geste où l'œil est resté sur les couleurs »*. Aux tables, l'œil est resté sur l'image.
- **Le manque n'a aucune couleur d'alerte**, et rien ne réclame jamais rien : une attente
  s'annonce, elle ne s'excuse pas.
- **Aucune largeur ni hauteur inventée** : 2 px et la couleur du signal existent déjà.

---

## 5 · Les pistes

### A · Rebrancher la barre dans la colonne de la table, comme les ambiances

Une ligne de plus dans la destructuration, une bande de 2 px réservée sous l'en-tête du panneau
([`Tables.tsx:1468`](../../interface/src/composants/Tables.tsx#L1468)), et la barre s'y pose quand
une retouche dépasse le quart de seconde.

**Coût** : quatre lignes. **Risque** : aucun — c'est exactement le montage des ambiances, déjà
éprouvé. **La réserve** : aux tables, l'œil n'est pas sur la colonne, il est sur l'image. On pose
un réglage à gauche et on regarde ce qu'il fait au milieu. Une barre dans la colonne serait à
l'endroit qu'on vient de quitter.

### B · La rebrancher en pleine largeur, entre la barre des tables et les trois colonnes

Même branchement, autre place : une bande de 2 px sur toute la largeur, juste sous la barre des
sept tables, au-dessus du bandeau à trois colonnes
([`Tables.tsx:1462`](../../interface/src/composants/Tables.tsx#L1462)). Elle est alors dans le champ
de vision qu'on regarde la colonne, l'image ou les sœurs.

**Coût** : les mêmes quatre lignes, un cran plus haut dans le même fichier. **Risque** : une bande
pleine largeur est plus visible qu'une bande de colonne, et elle sera vue à chaque geste lourd —
mais elle ne paraît que quand ça dépasse 240 ms, et elle vaut 2 px. **Ce qu'elle gagne** : elle est
là où l'œil est.

### C · Une roue qui tourne, comme demandé — *la mauvaise piste, nommée pour qu'on n'y revienne pas*

C'est ce que la remarque demande, et le produit a déjà mieux. Une roue dit *ça travaille* ; la
barre dit *ça travaille, et voilà où ça en est* — sur une attente d'une à deux secondes, savoir
qu'on en est aux trois quarts change ce qu'on fait de la seconde suivante. Et la liste de ce qui
bouge est close : un second mouvement continu devrait passer par sa règle d'admission, qu'il ne
franchirait pas, puisqu'un autre moyen d'être remarqué existe déjà. Écartée.

### D · Éteindre les réglages pendant le vol

Griser ou verrouiller la colonne tant que le serveur n'a pas répondu. **Coût** : faible. **Risque** :
élevé, et contraire à une décision déjà prise — *« éteinte, pas verrouillée : les réglages restent
lisibles et manœuvrables »* ([`Tables.tsx:1514`](../../interface/src/composants/Tables.tsx#L1514)).
Empêcher un second geste pendant une seconde et demie ferait perdre plus de temps que l'attente
elle-même, et le serveur sait déjà mettre les retouches à la file. Écartée, mais elle éclaire une
question : **la barre doit-elle dire qu'il y en a deux en file ?** Le crochet le sait — il compte
les envols — et il garde exprès **le premier départ**, parce que le serveur sérialise : deux
retouches lancées coup sur coup sont une seule attente, pas deux. La barre dit donc déjà la vérité
sans rien ajouter.

---

## 6 · Ce qui est tranché — 3 septembre 2026

### a) La barre se pose en pleine largeur, sous la barre des sept tables — piste `B`

La question était *où est l'œil pendant qu'on attend ?*, et la réponse est *sur l'image*. Aux
ambiances, la barre est dans le panneau parce que l'œil y est resté, sur les couleurs. Aux tables,
on pose un réglage à gauche et **on regarde ce qu'il fait au milieu** — une barre dans la colonne
serait à l'endroit qu'on vient de quitter.

En pleine largeur, elle est dans le champ de vision quelle que soit la colonne regardée, elle vaut
2 px, et elle ne paraît qu'au-delà de 240 ms. La piste `A` reste écrite : c'est le même
branchement, un cran plus bas, si la place pleine largeur se révélait trop présente à l'usage.

**Les deux à la fois sont écartées** : deux barres pour une seule attente, alors que le produit
tient partout ailleurs la règle inverse — un fait, un seul endroit qui le dit.

### b) Un essai la garde, et rend vrai celui qui existe

La barre est partie sans qu'aucun essai ne bronche, et l'essai qui existe affirme le partage sans
l'exercer. Un essai qui pose une retouche lente et attend la barre coûte quelques lignes, dans le
fichier qui teste déjà celle de la palette — et il est le seul moyen que la **troisième** maison de
cette barre ne la perde pas comme la deuxième.

---

## 7 · Ce qu'il faut construire

Trois changements, l'interface seulement. **Aucun appel payant, aucune donnée nouvelle, aucune
largeur, hauteur, couleur ni police neuves** — tout ce qui sert existe déjà et sert ailleurs.

**1. Reprendre `enVol`.**
[`Tables.tsx:1058`](../../interface/src/composants/Tables.tsx#L1058) — la destructuration prend
cinq choses sur six ; elle en prend six.

**2. Poser la bande, en pleine largeur.** Entre la barre des sept tables et le bandeau à trois
colonnes ([`Tables.tsx:1462`](../../interface/src/composants/Tables.tsx#L1462)) : une bande de 2 px
**réservée en permanence**, qui porte la `Jauge` quand une retouche est en vol. La permanence est le
point qui compte — une bande qui apparaîtrait pousserait tout l'écran de 2 px sous les yeux, et
c'est le geste où l'œil est resté sur l'image. C'est le montage des ambiances
([`Ambiances.tsx:169`](../../interface/src/composants/Ambiances.tsx#L169)), transposé d'une colonne
à toute la largeur.

Les deux réglages de la `Jauge` se choisissent comme aux ambiances : **pas de compteur** — une
attente d'une à deux secondes afficherait un nombre qui change deux fois — et **un seuil de
240 ms**, la borne du § Motion.

**3. Un essai qui pose une retouche lente et attend la barre.** À côté de celui de la palette
([`App.test.tsx:16114`](../../interface/src/App.test.tsx#L16114)), et sur le même montage : une
horloge tenue à la main, un serveur qui répond lentement, la barre absente sous le seuil, présente
au-dessus, repartie à la fin. Il faut une marque à interroger — l'équivalent de
`data-attente-palette` sur la nouvelle bande.

> ⚠️ **Et une phrase à corriger dans le même geste.** La documentation de la `Jauge`
> ([`chassis.tsx:904`](../../interface/src/composants/chassis.tsx#L904)) dit *« une génération dans
> la grille et une retouche **dans la fiche** portent la même barre »*. La retouche n'est plus dans
> la fiche depuis le 31 août : elle est aux tables. La phrase redevient vraie en changeant un mot,
> et c'est elle qui aurait dû signaler la perte.

### Ce que ça ne fait pas

- **Aucune roue qui tourne.** La liste de ce qui bouge reste close, et son seul mouvement continu
  reste celui qui dit où ça en est.
- **Rien ne s'éteint pendant l'attente.** Les réglages restent manœuvrables : le serveur met les
  retouches à la file, et la barre garde exprès le **premier** départ, donc deux gestes coup sur
  coup restent une seule attente et une seule barre.
- **Rien ne change aux durées.** Cette tranche ne rend pas le détourage plus rapide ; elle le rend
  visible. Ce qui le rendrait plus rapide — travailler sur l'image mise sur grille plutôt que sur
  les 1 024 px d'origine — est une autre question, et elle n'a pas été posée.

---

## Ce qu'on a trouvé en mesurant, et qui n'est pas cette remarque

**Le modèle de détourage annoncé comme « lourd » ne détoure rien : il rend, au pixel près, le
résultat du rapide.**

En chronométrant les trois modèles de silhouette pour cette fiche, les deux mesures se sont
retrouvées identiques à la milliseconde. Vérifié :

- La bibliothèque de détourage installée ici est **`rembg` 2.0.57**, et elle connaît neuf modèles.
  **`birefnet-general` n'en fait pas partie.**
- Sa fabrique de session part d'un défaut et ne le remplace que si le nom demandé figure dans sa
  liste. Un nom inconnu ne lève pas d'erreur : **il retombe silencieusement sur le rapide.**
- Résultat mesuré sur une image de 1 024 px : **100,00 % d'accord** entre « lourd » et « rapide »,
  contre 99,80 % entre « rapide » et « intermédiaire ». Ce n'est pas une ressemblance, c'est le
  même calcul.
- Durées : « lourd » 0,39 s, « rapide » 0,39 s, « intermédiaire » 0,94 s. L'écran annonce pourtant
  que le lourd *« compte plusieurs secondes par image »*.
- **Et le fichier de 973 Mo est bien sur le disque**, descendu le 1<sup>er</sup> septembre à 8 h 03,
  dans un dossier que la bibliothèque installée ne lit pas. Le produit le voit et en conclut que le
  modèle est prêt, donc il n'affiche même pas l'avertissement de téléchargement
  ([`Fiche.tsx:1257`](../../interface/src/composants/Fiche.tsx#L1257)). **973 Mo occupés pour un
  fichier que rien n'ouvre.**
- Le banc du 1<sup>er</sup> septembre ne l'avait pas attrapé : il a **sauté** ce modèle, faute de
  l'avoir sur le disque à ce moment-là (`essais/mesures_moteurs_silhouette.json`, champ `sautes`).
  Il a mesuré son poids par une question à l'adresse de téléchargement — le poids était juste, et
  c'est la seule chose qui l'était.
- Enfin, la note du code parle de *« `rembg` 2.0.81 »* et de son défaut `bria-rmbg`, alors que la
  version installée est **2.0.57**. La dépendance est déclarée `rembg>=2.0`
  (`pyproject.toml:30`) : rien n'oblige la machine à porter la version sur laquelle les mesures ont
  été faites.

C'est un défaut à part entière, et il ne se range pas ici. **→ à ouvrir comme sa propre remarque.**
