# Plan : le guide — ce qu'on lit quand on ne sait pas

> **Demandé par l'auteur** le 20 septembre 2026 : *« le guide actuel n'est pas toujours cohérent
> ni complet, il est très souvent pompeux, compliqué à lire, et n'aide pas vraiment. »*
>
> **Chantier à part.** Il ne bloque rien et rien ne le bloque. Il touche un fichier de texte
> (`interface/src/aide.ts`) et un composant (`interface/src/composants/Guide.tsx`) ; aucune
> route serveur, aucune dépense.
>
> Quel modèle sur quelle tranche : [PLAN-guide-affectation.md](PLAN-guide-affectation.md).
>
> Ce document fait foi sur l'ordre de construction et les critères. Le vocabulaire vit dans
> `docs/vocabulaire.html`, l'apparence dans `docs/DESIGN.md`, la règle du corpus unique dans
> `docs/design-motifs.md` § *Un seul corpus, trois rendus*.

---

## Ce que c'est, en une phrase

**On presse `?`, et on comprend l'écran qu'on a sous les yeux en dix secondes** — sans lire les
soixante-treize réglages qu'il porte.

## Ce que c'est, en trois gestes

1. Le volet s'ouvre sur un **encadré de tête** : à quoi sert cette page, et les trois gestes
   qu'on y fait. Trois lignes. On a déjà ce qu'il faut pour continuer.
2. En dessous, les réglages **groupés par zone de l'écran**, une ligne chacun, repliés. On
   parcourt, on ne lit pas.
3. On clique une ligne : elle se déplie sur ce que ça change, d'où ça sort, et — seulement
   quand ça évite une vraie erreur — un « à savoir ».

## Ce que ce n'est pas

- **Pas un journal de conception.** Aujourd'hui les textes longs racontent pourquoi une
  décision a été prise en séance le 28 août. C'est précieux, ça ne va pas dans le guide.
- **Pas un manuel exhaustif.** Une fiche par réglage qu'on peut toucher, pas une par ligne de
  code.
- **Pas le coup de main.** Le guide est écrit à la main et ne coûte rien ; `docs/PLAN-assistant.md`
  répond à des questions en payant un modèle. Les deux se complètent : le coup de main
  citera le guide, le guide ne l'attend pas.

---

## Ce qui a été mesuré avant d'écrire ce plan, le 20 septembre 2026

| Constat | Mesure |
|---|---|
| Rien ne hiérarchise un écran | **73 fiches à la file** sur les tables, 35 sur la fiche d'un sujet, 25 sur les règles du jeu. Aucun titre intermédiaire, aucun repli |
| Aucun écran ne se présente | **0 résumé** sur 16 écrans déclarés. On tombe directement sur le premier réglage |
| Les textes longs sont des essais | **156 fiches** en portent un : **521 signes de médiane, 2 768 au maximum** |
| La phrase courte ne l'est plus | `quoi` doit faire une phrase : **310 signes** au pire, 98 de médiane |
| Trois écrans déclarés sont vides | `tableau-de-bord`, `depenses`, `montage` sont nommés dans `Guide.tsx` et n'ont **aucune fiche** |
| Des pans entiers du produit n'ont rien | **les tuiles : 0 fiche** (chantier livré le 19 septembre). **Le son : 0 fiche**. Plus les fabrications, la grille d'une famille, l'envoi, comparer, un travail, les calques animés |
| Le guide connaît moins d'écrans que le produit | **16 valeurs de `ou`** contre une trentaine de genres de lieu. Les écrans non couverts retombent « sur les explications du voisin le plus proche » — c'est écrit tel quel dans `App.tsx` |

**Total : 229 fiches**, dont 156 avec un texte long.

---

## Décisions d'architecture

1. **Le corpus reste unique.** Une seule source pour la bulle, la ligne sous un titre de
   section et le volet. La règle de `docs/design-motifs.md` ne bouge pas : ce chantier change
   ce que les fiches disent, pas combien il y en a de copies.

2. **Deux champs entrent, et ils sont obligatoires.**
   - `groupe` — la zone de l'écran où le réglage se trouve, en toutes lettres (« le pinceau »,
     « la palette », « ce qui part dans le prompt »). C'est ce qui casse les listes de 73.
   - un **résumé par écran**, à part des fiches : trois lignes, à quoi sert la page, et les
     trois gestes qu'on y fait.

3. **Le texte long devient un « à savoir », et il est facultatif.** On ne le garde que quand il
   évite une erreur concrète ou donne une astuce. Plafond : **400 signes**. Ce qui raconte
   l'histoire d'une décision descend dans `docs/design-decisions.md`, où c'est à sa place —
   **aucun mot n'est perdu**, il change de fichier.

4. **Les limites sont tenues par un essai, pas par la bonne volonté.** Un essai refuse une
   fiche dont le `quoi` dépasse 140 signes, une fiche sans `groupe`, un écran sans résumé, un
   « à savoir » de plus de 400 signes. Le gabarit produit la réponse ; c'est déjà ce qui a fait
   que `change` n'est jamais sauté.

5. **Un écran du guide par écran du produit.** La liste des `ou` cesse d'être un héritage : elle
   suit les genres de `lieux.ts` et les côtés d'écran, et un genre sans écran de guide est une
   erreur d'essai, pas un oubli silencieux.

6. **Le français d'abord.** Une fiche se lit à voix haute sans buter. Pas de « l'atelier relit
   le cadre et réserve le budget partagé » : « avant chaque appel, l'atelier vérifie qu'il reste
   de l'argent ». C'est un critère de relecture, tranche par tranche.

---

## L'ordre de construction

**Le code d'abord, le texte ensuite.** Réécrire 229 fiches dans un volet qui ne sait pas les
grouper, c'est les réécrire deux fois.

### `GU1` — Le relevé : quel écran, quelles fiches, lesquelles mentent

Le tableau de référence du chantier, écrit une fois : pour chacun des écrans du produit, son
nom à l'écran, le `ou` qui le sert aujourd'hui (ou rien), le nombre de fiches, et celles qui
parlent d'un réglage disparu. Aucun code.

**Critères**
- [x] Chaque genre de `lieux.ts`, chaque côté de l'univers et chaque onglet des règles figure
      dans le tableau, avec son compte de fiches.
- [x] Les fiches qui décrivent un réglage introuvable à l'écran sont nommées une par une.
- [x] Le relevé vit dans `docs/releves/guide-2026-09-20.md` et ce plan y renvoie.

→ [docs/releves/guide-2026-09-20.md](releves/guide-2026-09-20.md). Le plus lourd
qu'il montre : `ou: "jeu"` (25 fiches, « Les règles du jeu ») n'est **jamais
atteignable** — `coteUnivers` ne peut valoir que `"inspiration"` ou `"ambiances"` —
pendant que l'écran qui porte vraiment le nom « Réglages » à l'écran affiche un
volet titré « L'installation ». Et la retouche (73 fiches, le plus gros groupe)
n'a que 2 fiches accrochées à une bulle : `Retouche.tsx` et `Superposition.tsx`
ne branchent le corpus nulle part.

### `GU2` — La forme du volet : résumé en tête, groupes, replis

Le composant. Le volet s'ouvre sur l'encadré de tête, puis les groupes, puis les lignes
repliées. Une ligne dépliée montre ce que ça change, d'où ça sort, et le « à savoir » s'il y en
a un. Les touches de l'écran restent où elles sont.

**Critères**
- [x] Le résumé de l'écran paraît en tête, avant tout réglage.
- [x] Les fiches sont rendues sous le titre de leur `groupe`, dans l'ordre du fichier.
- [x] Une fiche est repliée par défaut et montre son nom et son `quoi` ; un clic la déplie.
- [x] Le lien « Le guide › » d'une bulle ouvre le volet **avec sa fiche déjà dépliée**.
- [x] Un écran sans résumé ni fiche dit ce qu'il dit déjà — « Rien à expliquer ici » — et rien
      de plus.
- [x] Essais d'écran : l'encadré, un groupe, un repli, le lien de bulle.

**Ce qui a été tranché, et dont les douze tranches suivantes héritent** : `groupe` est
facultatif au type le temps du chantier (le rendre obligatoire casserait la compilation sur
les 229 fiches ; c'est l'essai de `GU3` qui l'exige, pas le compilateur). Les résumés vivent
dans `RESUMES`, à part de `AIDE`, indexés par l'écran. Le volet **ne retrie jamais** : l'ordre
des groupes est celui de leur première apparition dans le fichier, et deux fiches éloignées
qui portent le même `groupe` se rejoignent sous un seul titre. Les fiches pas encore rangées
paraissent sans titre tant qu'aucune fiche de l'écran n'en a un, et passent à la fin sous
« Le reste de cet écran » dès qu'une seule est rangée — l'état d'un écran à moitié fait se
voit au lieu de se cacher.

### `GU3` — Les garde-fous : un essai refuse ce qui redevient pompeux

**Critères**
- [x] `quoi` au-delà de 140 signes : essai rouge, avec la clé fautive dans le message.
- [x] Fiche sans `groupe` : essai rouge.
- [x] « À savoir » au-delà de 400 signes : essai rouge.
- [x] Écran du guide sans résumé : essai rouge.
- [x] Genre de lieu sans écran de guide correspondant : essai rouge.
- [x] Les essais tournent dans la suite d'écran habituelle et ne coûtent rien.

⚠️ Les essais de `GU3` sont **rouges à leur écriture** — 229 fiches ne tiennent pas encore les
limites. Ils passent au vert tranche par tranche, et c'est la mesure d'avancement du chantier.

→ `interface/src/aide.test.ts` : **404 essais rouges sur 658**, un par fiche/écran/genre fautif,
compris ainsi — 47 fiches où `quoi` dépasse 140 signes, 229 fiches sans `groupe` (les 229, au
complet — `GU2` l'a laissé facultatif au type le temps du chantier), 106 fiches où le « à savoir »
dépasse 400 signes (sur 156 qui en portent un), 16 écrans du guide sans résumé dans `RESUMES` (les
16, au complet — vide depuis `GU2`), et 6 genres de lieu sans écran de guide, dédié ou hérité :
`travail`, `installation`, `envoi`, `tuiles`, `jeu-de-tuiles`, `livraison-de-tuiles`.

### `GU4` — Les résumés des écrans

Trois lignes par écran, pour tous les écrans du relevé : à quoi ça sert, les trois gestes qu'on
y fait. Écrits d'un coup, par la même main, pour qu'ils se ressemblent.

**Critères**
- [x] Chaque écran du relevé a son résumé.
- [x] Un résumé tient en trois phrases et se lit à voix haute sans buter.
- [x] Un résumé nomme les gestes, pas les concepts : « on y peint », pas « on y applique une
      recette non destructive ».

→ Écrits en deux passes, par la même main : `GU4` (1/2), commit `fb244e9`, pour les tables, la
fiche d'un sujet et les règles du jeu ; `GU4` (2/2) pour les treize écrans restants. Les seize
résumés de `RESUMES` (`interface/src/aide.ts`) couvrent maintenant toutes les valeurs de
`Explication["ou"]`, et l'essai « chaque écran du guide a un résumé » (`aide.test.ts`) passe au
vert sur les seize.

---

## La réécriture, écran par écran

Chaque tranche ci-dessous porte les **mêmes six critères**, et ils ne sont pas répétés :

- [ ] Chaque fiche de l'écran a un `groupe`, et les groupes suivent les zones de l'écran réel.
- [ ] Chaque `quoi` tient en une phrase de moins de 140 signes.
- [ ] Chaque `change` dit ce qui bouge en aval, en français simple — « Rien à la génération. »
      reste une réponse.
- [ ] Les textes longs sont soit devenus un « à savoir » de moins de 400 signes, soit descendus
      dans `docs/design-decisions.md`.
- [ ] Les fiches qui décrivent un réglage disparu sont retirées, et le relevé le note.
- [ ] Les essais de `GU3` passent au vert **pour cet écran**.

| Tranche | Écran | Fiches aujourd'hui |
|---|---|---|
| `GU5` | Les tables — la retouche, ses huit places | **73** |
| `GU6` | La fiche d'un sujet | **35** |
| `GU7` | Les règles du jeu — la bible, ce qu'elle impose | **25** |
| `GU8` | Les équipements — une pièce, un emploi | **21** |
| `GU9` | L'univers — inspiration, toile, ambiances | **19** |
| `GU10` | L'installation de l'atelier | **12** |
| `GU11` | Les animations — une bande, un clip, le montage | **21** |
| `GU12` | La galerie, la fiche d'une image, le codex, la livraison | **23** |

`GU5` est la plus grosse de tout le chantier : soixante-treize fiches pour un seul écran, et
c'est précisément la liste dont l'auteur dit qu'elle n'aide pas. Elle se découpe en groupes
avant d'être réécrite, pas l'inverse.

→ `GU5` (1/2), le découpage seul — aucun texte de fiche n'a bougé. **Treize zones**, dans
l'ordre de l'écran réel, et les noms de table sont ceux que la barre affiche (*Pixelisation*,
*Couleurs*, *Nettoyage*, *Contour*) et non ceux des fiches : En haut de l'écran — enregistrer
(2) · L'image, et la barre au-dessus d'elle (3) · La table Détourage (12) · La table Recadrage
(3) · La table Pixelisation (6) · La table Couleurs (9) · La table Couleurs — avant et après la
réduction (4) · La table Nettoyage (9) · La table Nettoyage — la couleur, pas la silhouette (3)
· La table Contour (6) · La table Contour — les cinq cases à cocher (5) · La table Retournement
(5) · La table Main (6). Les soixante-treize entrées `ou: "tables"` sont désormais contiguës
dans `aide.ts`, rangées dans cet ordre-là.

→ **Ce que la lecture du code a trouvé de mort, pour `GU5` (2/2)** : sept fiches décrivent un
réglage ou une lecture qui n'est plus à l'écran — `detourage.seuil_alpha`, `detourage.poches`,
`detourage.fond`, `grille.du-modele`, `contours.taches`, `bords.taches`,
`retournement.direction` — et deux sont sur le mauvais écran plutôt que mortes :
`tables.png` (le *PNG ↓* n'existe que sur la fiche d'une image et sur une tuile) et
`bande.source` (elle décrit l'atelier d'animation, son `ou` devrait être `bande`).

---

## Les écrans qui n'ont rien

### `GU13` — Les tuiles

Les trois écrans du chantier livré le 19 septembre : l'atelier des tuiles, un jeu de tuiles, la
livraison. **Zéro fiche aujourd'hui.**

**Critères**
- [ ] Les trois écrans ont leur résumé et leurs fiches.
- [ ] Les deux champs de texte que `TU12` rend compréhensibles sont expliqués ici aussi, dans
      les mêmes mots qu'à l'écran.
- [ ] Ce que coûte une matière générée sur la machine, et ce que ne coûte pas une matière
      intégrée, est dit.

### `GU14` — Le son

L'atelier du son, le calage sonore, la livraison. **Zéro fiche aujourd'hui.**

**Critères**
- [ ] Les écrans du son ont leur résumé et leurs fiches.
- [ ] Ce qui tourne sur la machine et ce qui se paie est distingué à chaque fiche qui dépense.

### `GU15` — Les douze orphelins

Le tableau de bord, les dépenses, les fabrications, la grille d'une famille, l'envoi, comparer
deux versions, la fiche d'un travail, les calques animés, le montage d'un clip — tous atteints
par l'auteur, aucun servi par le guide.

**Critères**
- [ ] Plus aucun genre de `lieux.ts` ne retombe sur « les explications du voisin le plus proche ».
- [ ] Le commentaire d'`App.tsx` qui l'annonçait est retiré, parce qu'il est devenu faux.
- [ ] L'essai de `GU3` sur les genres sans écran passe au vert.

---

## La fin

### `GU16` — La relecture croisée et l'essai au navigateur

**Critères**
- [ ] Les 229 fiches (moins les retirées) sont relues d'affilée : deux fiches voisines ne se
      contredisent pas, et le même réglage porte le même nom partout.
- [ ] Les écrans sont ouverts un par un dans un atelier jetable, `?` pressé sur chacun, et ce
      que le volet montre correspond à ce que l'écran porte.
- [ ] Les renvois de `docs/` vers le guide sont vérifiés par `py essais/essai_docs.py`.
- [ ] `docs/status/etat.md` et `docs/PLAN.md` portent le sort du chantier.

---

## Ce que ce chantier ne fait pas

- Il ne touche pas aux infobulles elles-mêmes : elles rendent le même corpus, donc elles
  s'améliorent sans une ligne de code de plus.
- Il n'écrit pas de parcours d'accueil (« par où commencer »). L'auteur ne l'a pas demandé ;
  l'ancien a été retiré en `B7` et reste lisible dans Git.
- Il n'appelle aucun modèle. Le guide est écrit à la main, et c'est ce qui le rend gratuit et
  vérifiable.
