# Plan : le guide — ce qu'on lit quand on ne sait pas

> **Demandé par l'auteur** le 20 septembre 2026 : *« le guide actuel n'est pas toujours cohérent
> ni complet, il est très souvent pompeux, compliqué à lire, et n'aide pas vraiment. »*
>
> **Chantier à part.** Il ne bloque rien et rien ne le bloque. Aucune route serveur, aucune
> dépense.
>
> ⚠️ **« Un fichier de texte et un composant » était faux, et c'est la ligne d'ouverture qui
> l'annonçait** — corrigé à la clôture, le 20 septembre 2026. Le corpus
> (`interface/src/aide.ts`) et le volet (`interface/src/composants/Guide.tsx`) sont bien le
> gros du travail, mais **six tranches ont dû toucher le routage** : `App.tsx` (`ecranDuGuide`,
> réparé en `GU7`, `GU12`, `GU13`, `GU14`, `GU15`, `GU16`), `CadreDialogue.tsx` (le volet passe
> dans le dialogue modal, `GU16`), `PreparerUneFabrication.tsx` (une prop de plus pour que le
> guide sache le type préparé, `GU14`), plus les essais d'écran `App.test.tsx`,
> `Guide.test.tsx` et `aide.test.ts`. La panne la plus lourde du relevé n'était pas un texte
> pompeux : c'était **cinq écrans dont `?` montrait le guide du voisin**.
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

- [x] Chaque fiche de l'écran a un `groupe`, et les groupes suivent les zones de l'écran réel.
- [x] Chaque `quoi` tient en une phrase de moins de 140 signes.
- [x] Chaque `change` dit ce qui bouge en aval, en français simple — « Rien à la génération. »
      reste une réponse.
- [x] Les textes longs sont soit devenus un « à savoir » de moins de 400 signes, soit descendus
      dans `docs/design-decisions.md`.
- [x] Les fiches qui décrivent un réglage disparu sont retirées, et le relevé le note.
- [x] Les essais de `GU3` passent au vert **pour cet écran**.

  *(Vérifié pour `GU5` — les soixante-treize fiches de la retouche, retirées et complétées à
  soixante-cinq. Vérifié aussi pour `GU6` — la fiche d'un sujet, dans le même style : six
  zones réelles (la fiche, sa matrice, la barre qui paie, l'écran de confirmation, le
  calibrage, commander un clip), et huit des trente-cinq fiches sorties de l'écran plutôt
  que réécrites sur place — deux vers `ou: "galerie"` (l'import général, accroché dans
  `Import.tsx`/`BarreOutils.tsx`, pas dans la fenêtre d'import d'un sujet), six vers
  `ou: "bande"` (l'atelier d'une bande, `AtelierDeBande.tsx`, déjà le foyer de leurs
  voisines) — laissant vingt-sept fiches propres à cet écran. Vérifié aussi pour `GU7` — les
  règles du jeu, en deux temps : `GU7` (1/2) a d'abord réparé le routage qui rendait l'écran
  injoignable, `GU7` (2/2) a réécrit les vingt-deux fiches restantes sous sept zones réelles,
  retiré un doublon (`assistant.taille`, le même champ qu'`univers.cible_px` sous un autre
  nom) et corrigé deux fiches qui présentaient un champ en lecture seule comme un champ à
  taper (`bible.rendu`, `bible.vue`) — laissant vingt et une fiches propres à cet écran.
  Vérifié aussi pour `GU8` — les équipements : sur les vingt et une fiches nées sous
  `ou: "equipement"`, dix-neuf ne décrivaient pas cet écran et n'y ont jamais été
  atteignables — dix-huit sont les deux fabriques de la retouche (superposition,
  découpage), montées par `Retouche.tsx` et jamais par `Emplois.tsx` / `Emploi.tsx` /
  `CalquesDeLEmploi.tsx`, la dernière décrit la planche de poses de l'établi d'un sujet.
  Déplacées vers `ou: "tables"` et `ou: "sujet"`, textes inchangés — laissant deux fiches
  propres à cet écran, réécrites sous ses deux seules vraies zones. Vérifié aussi pour
  `GU9` — l'univers : quinze fiches d'Inspiration sous six zones, deux des quatre fiches
  d'Ambiances déplacées vers `ou: "jeu"` (`univers.couleurs`, `univers.fond`, relogées à
  l'étape « Son allure » depuis `C2`), laissant deux fiches propres à ce côté-ci. Vérifié
  aussi pour `GU10` — l'installation et les réglages : sur les treize fiches nées sous
  `ou: "reglages"`, six (`mouvement.*`, `style.*`) décrivaient des blocs déménagés le
  18 septembre dans l'onglet Univers et sont parties vers `ou: "jeu"`, une (`reglages.consommation`)
  décrivait la barre qui paie de l'établi et est partie vers `ou: "sujet"` — laissant six
  fiches propres à cet écran, réparties sur quatre zones (les fournisseurs, les
  consommations, le cadre de délégation de l'agent, la séance de l'agent). Vérifié aussi
  pour `GU11` — les animations : trois écrans voisins qu'on confondait facilement, démêlés
  à la lecture du code plutôt que du nom des fiches. Huit fiches de « commander un clip »
  vivaient sous `ou: "sujet"` depuis `GU6` alors qu'elles décrivent `Clip.tsx` au mot
  près — déplacées vers `ou: "clip"`. Cinq fiches (`bande.nom`, `bande.pivot`,
  `bande.vitesse`, `bande.gardees`, `bande.destination`) n'étaient wirées que dans
  `Montage.tsx` alors qu'elles vivaient sous `ou: "bande"` — déplacées vers `ou: "montage"`,
  qui gagne aussi trois fiches neuves pour ses zones jusque-là sans aucune (les deux
  boucles, la pellicule, les propositions gratuites). Une fiche (`bande.galerie`) décrivait
  l'onglet « Ses animations » de la fiche d'un sujet, oubliée par `GU6` — déplacée vers
  `ou: "sujet"`. Neuf fiches nées sous `ou: "clip"` restent hors sujet pour cette tranche :
  elles décrivent l'écran « Fabrications » et les rendus 3D, qui héritent de `"clip"` faute
  d'`ou` à eux — c'est `GU15` qui leur en donnera un. Vérifié aussi pour `GU12` — la galerie,
  la fiche d'une image, le codex et la livraison, en deux temps : `GU12` (1/2) a d'abord
  rangé les vingt-six fiches des quatre écrans sur leurs quatorze zones réelles et repéré une
  fiche morte (`codex.vitrine`) ; `GU12` (2/2) a réparé le routage de `ou: "sortie"`
  (`ecranDuGuide`, `App.tsx`), retiré `codex.vitrine`, réécrit `codex.nommer` contre l'écran
  réel et réécrit les vingt-quatre fiches restantes — cinq `long` et quatre `quoi` ramenés
  sous leur limite, une décision datée descendue dans `docs/design-decisions.md`. Toutes les
  tranches du tableau ci-dessous ont maintenant été reprises.)*

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

`GU5` était la plus grosse de tout le chantier : soixante-treize fiches pour un seul écran, et
c'est précisément la liste dont l'auteur dit qu'elle n'aide pas. Elle s'est découpée en groupes
avant d'être réécrite, pas l'inverse, en trois passes.

→ Les treize zones de l'écran sont réécrites au complet, dans l'ordre où la barre les affiche —
En haut de l'écran — enregistrer · L'image, et la barre au-dessus d'elle · La table Détourage ·
La table Recadrage · La table Pixelisation · La table Couleurs · La table Couleurs — avant et
après la réduction · La table Nettoyage · La table Nettoyage — la couleur, pas la silhouette ·
La table Contour · La table Contour — les cinq cases à cocher · La table Retournement · La
table Main. Sept fiches mortes retirées, une par une notées dans le relevé
(`detourage.seuil_alpha`, `detourage.poches`, `detourage.fond`, `grille.du-modele`,
`contours.taches`, `bords.taches`, `retournement.direction`) ; deux déplacées vers leur bon
écran (`tables.png` → `ou: "case"`, `bande.source` → `ou: "bande"`) ; une manquante ajoutée en
tête de la table Retournement (`etape.retournement`, qui décrit son geste général comme les
sept autres tables décrivent le leur). Les soixante-treize fiches d'origine sont aujourd'hui
**soixante-cinq**, et les six critères ci-dessus tiennent sur l'ensemble.

*(Complété hors tranche, le 20 septembre 2026 : les dix-huit fiches que `GU8` a déplacées ici
depuis `ou: "equipement"` sont maintenant groupées — « La fabrique Superposition », « La
fabrique Découpage », à la fin du bloc — et vérifiées contre `Superposition.tsx`/`Decoupe.tsx`.)*

→ `GU6` réécrit la fiche d'un sujet sous six zones, dans l'ordre où l'écran les montre : la
fiche du sujet (nom, style de combat, habillage, images d'exemple) · cases et planches, sa
matrice (ce que le jeu réclame, ce qui est fait, la matrice elle-même — trois fiches sans
bulle avant cette passe, jamais câblées mais toujours vraies) · la barre qui paie (modèle,
styles locaux, proportions, variations, sujet, l'aperçu de ce qui partira) · l'écran de
confirmation, avant l'envoi · le calibrage · commander un clip. Onze fiches sans bulle
relues une par une : toutes décrivent un réglage encore présent dans le code, donc réécrites
et gardées, aucune retirée. Huit fiches mal rangées trouvées en lisant le code, comme
`tables.png` et `bande.source` l'étaient en `GU5` : `atelier.import` et
`atelier.import.traitement` décrivent le bouton d'import général de la galerie
(`Import.tsx`, monté par `BarreOutils.tsx` dans `Galerie.tsx`), jamais la fenêtre d'import
d'un sujet (`ImporterPourUnSujet.tsx`, qui n'a aucune fiche) — déplacées vers `ou:
"galerie"`. `codex.bande.image`, `bande.main`, `bande.historique`, `bande.recette`,
`bande.chutier` et `bande.montage` décrivent l'atelier d'une bande (`AtelierDeBande.tsx`),
au même titre que leurs voisines déjà rangées sous `ou: "bande"` — déplacées avec elles,
texte inchangé, ce sera le travail de `GU11`. Les trente-cinq fiches d'origine sont
aujourd'hui **vingt-sept**, et les six critères ci-dessus tiennent sur l'écran restant.

→ `GU7` (1/2) — **la correction de routage, avant tout texte.** `GU1` avait trouvé la panne
la plus lourde du relevé : les vingt-cinq fiches de cet écran étaient **injoignables**. Leur
valeur `ou: "jeu"` ne pouvait être produite que par `coteUnivers`, typé
`"inspiration" | "ambiances"` — jamais `"jeu"`. Les réécrire d'abord n'aurait donc rien
changé à l'écran. Trois corrections, toutes dans le routage :

- `ecranDuGuide` (`App.tsx`) distingue enfin les quatre onglets des réglages : l'onglet
  *Univers*, qui monte `ReglesDuJeu` en mode reprise — l'écran qui affiche vraiment le titre
  *Réglages* —, produit `"jeu"` ; les trois autres gardent `"reglages"`.
- L'installation de la machine n'était testée nulle part dans cette chaîne : l'ouvrir montrait
  le guide de la racine du dessous. Elle produit maintenant `"reglages"`, qu'elle partage avec
  l'onglet *Moteurs & workflows* — les deux écrans montent les mêmes blocs (`BlocSecrets`).
  Au passage, l'ordre des conditions suit désormais les gardes du rendu : les dépenses
  couvrent tout, l'installation couvre les réglages.
- `NOM_DE_LECRAN.reglages` (`Guide.tsx`) ne dit plus « L'installation » — un nom qui ne
  couvrait ni les moteurs, ni l'agent, ni les dépenses — mais **« L'atelier et sa machine »**,
  qui couvre les deux écrans qu'il sert. `NOM_DE_LECRAN.jeu` reste « Réglages » : c'est le
  `<h1>` de `ReglesDuJeu.tsx` en mode reprise, au mot près.

Les vingt-cinq fiches sont ensuite découpées en **sept zones**, dans l'ordre de l'écran :
Son nom — le jeu et son dossier · Son allure — le style, la taille, les couleurs · Sa vue —
d'où l'on regarde le jeu · Son monde — les sept lignes de la bible · Son monde — les deux
lignes que l'atelier écrit (`rendu` et `vue`, en lecture seule depuis `B14`) · Son monde —
les étiquettes d'une ligne · S'applique à tout le jeu, mais se règle ailleurs (la liste que
`ReglesDAilleurs` rend sous les cinq étapes). Deux fiches mortes retirées et notées dans le
relevé (`assistant.ecran`, `assistant.texte`) ; une déplacée vers son bon écran
(`agent.cadre-durable` → `ou: "reglages"` : elle décrit `DelegationDuJeu`, monté par l'onglet
*Agent MCP*). Les vingt-cinq fiches d'origine sont aujourd'hui **vingt-deux**, toutes rangées
et toutes joignables — **mais aucune n'est encore réécrite** : c'est `GU7` (2/2).

→ `GU7` (2/2) réécrit les vingt-deux fiches sous leurs sept zones. **Son nom** est corrigée
contre l'étape réelle : elle ne se contente plus de renommer un jeu déjà là, elle dit qu'elle
crée le projet en `mode="creation"` et le renomme en `mode="reglages"` — le même écran, deux
usages, un dossier calculé une fois et jamais repris. **Son allure** perd un doublon :
`assistant.taille` et `univers.cible_px` décrivaient le même champ (`cible_px`) sous deux
noms, la première avec le compte des « dix réglages » d'un assistant qui n'existe plus —
`univers.cible_px` reste seule, rien d'exact ne disparaît avec l'autre (le détail est dans
`docs/releves/guide-2026-09-20.md`). **Son monde — les deux lignes que l'atelier écrit**
(`bible.rendu`, `bible.vue`) ne mentent plus : les deux disaient qu'on les tapait, elles
disent maintenant qu'elles s'écrivent seules depuis « Son allure » et « Sa vue », avec un
renvoi vers l'étape qui les remplit. **Les étiquettes** ne disent plus que la base part vide :
soixante-dix sont livrées, rangées par case, et la fiche le dit. **Les huit lignes de la
dernière zone** (barème, modèle par famille, détourage, poses, emplacements) disent
maintenant qu'elles sont en lecture seule ici et où elles se règlent vraiment ; elles restent
toutes sous `ou: "jeu"` plutôt que de suivre `univers.detourage` — seule du groupe à se régler
ailleurs que dans `ReglagesDeFamille.tsx` — vers `ou: "codex"`, ce qui aurait scindé un bloc
que l'écran affiche d'une pièce. Les neuf fiches qui dépassaient encore une limite de `GU3`
(`quoi` ou « à savoir ») sont retaillées ; ce qu'elles perdaient en détail mesuré part dans
sept lignes neuves de `docs/design-decisions.md`. Vingt et une fiches, réparties sur sept
zones, et les essais de `GU3` passent au vert pour cet écran.

→ `GU8` a commencé par lire le vrai écran plutôt que la liste des vingt et une fiches :
`Emplois.tsx` (la liste des emplois d'une pièce), `Emploi.tsx` (un emploi, sa matrice de
poses), `CalquesDeLEmploi.tsx` (les cibles d'un emploi et leurs calques) et
`CouvertureDeLEmploi.tsx`/`RelectureEquipement.tsx` (la fabrication des calques manquants).
Aucun des deux n'importe ni `Superposition.tsx` ni `Decoupe.tsx` — et `Emploi.tsx` le dit
lui-même dans son propre commentaire : « caler à la main… existe déjà ailleurs dans le
produit… le glisser [ici] l'aurait dupliqué au lieu de l'ouvrir ». En croisant `recette.ts`
(`TABLES`, où « decoupage » et « superposition » sont les deux seules entrées `fabrique:
true`, toutes deux montées par `Retouche.tsx`) avec `App.tsx` (`onSuperposition` ouvre le
lieu `retouche`, jamais `piece`/`emploi`/`calques-animes`), la conclusion s'est imposée :
**dix-huit des vingt et une fiches ne décrivaient jamais l'écran d'un emploi.** `fabrique.superposition`
et les douze `superposition.*` ainsi que les cinq `decoupe.*` sont les deux fabriques de la
retouche — déplacées vers `ou: "tables"`, textes inchangés, à leur emplacement d'origine
dans `aide.ts` (même traitement que `atelier.import` vers `"galerie"` en `GU6`) ; ce sera le
travail d'une reprise de la retouche que de les grouper sous des zones. Une dix-neuvième,
`fabrique.planche`, décrit la planche de poses de l'établi d'un sujet (`EtabliDuSujet.tsx`,
« les angles d'une planche de pose », E13) — déplacée vers `ou: "sujet"`, où elle rejoint la
zone `Cases et planches — sa matrice` déjà posée par `GU6`. Aucune fiche n'est morte : les
vingt et un réglages existent tous encore, seulement pas là où le corpus les rangeait.
Restaient deux fiches vraiment posées sur cet écran, les deux moitiés de « Cibles de cet
emploi » (`CalquesDeLEmploi.tsx`) : `equipement.association-image` (associer une image à une
cible — référence, personnage à extraire, ou calque déjà transparent) a perdu son ouverture
fausse, « Depuis la retouche », qui ne décrivait pas son vrai écran ; `equipement.couverture-fabrication`
était déjà exacte. Les vingt et une fiches d'origine sont aujourd'hui **deux**, réparties sur
deux zones, et les essais de `GU3` passent au vert pour cet écran.

*(Complété hors tranche, le 20 septembre 2026 : les dix-neuf fiches déplacées ici sont
maintenant groupées et vérifiées à leur nouvel écran — les dix-huit sous `ou: "tables"`, voir
la note sous `GU5` ci-dessus ; `fabrique.planche` sous `ou: "sujet"`, dans la zone `Cases et
planches — sa matrice` que `GU6` avait déjà posée.)*

→ `GU9` a commencé par le relevé lui-même (`docs/releves/guide-2026-09-20.md` §*Les côtés de
l'univers*) : `Univers.tsx` n'a que **deux** côtés réels, `"inspiration"` et `"ambiances"` —
« la toile » n'en est pas un troisième, c'est un mode d'affichage à l'intérieur du premier
(`vueUnivers === "toile"`). Les quinze fiches d'Inspiration sont réécrites sous six zones
réelles, dans l'ordre où l'écran les présente : la barre du tableau (sa bascule grille/toile),
le menu d'une carte (îlot, note, taille), une carte texte (son texte, sa teinte), une carte
image (concept art, artwork officiel, famille, ce que la palette y lit, la découper, sa
provenance), le menu d'un lien, le menu d'un îlot. En croisant `ReglesDuJeu.tsx` — son propre
tableau de migration, lignes « 7a » et « 7b » — avec l'écran Ambiances et couleurs
(`Ambiances.tsx`, qui ne les montre nulle part), deux des quatre fiches nées sous
`ou: "ambiances"` se sont révélées mal rangées : `univers.couleurs` et `univers.fond` se
règlent depuis `C2` à l'étape « Son allure » des règles du jeu, pas sur ce côté-ci de
l'univers — déplacées vers `ou: "jeu"`, dans le groupe que `GU7` y avait déjà posé, et
réécrites pour dire le double rôle réel de `couleurs` (avec palette, combien de teintes y lire ;
sans palette, combien en garder sur chaque image) que l'ancienne fiche ne couvrait qu'à moitié,
et le défaut réel de `couleurs` — 32, pas 24, une valeur confondue avec celle d'une ambiance.
Les deux fiches propres à ce côté, `ambiance.lot` et `univers.palette`, sont réécrites sous
deux zones dans l'ordre de l'écran : les ambiances, puis les palettes. Trois récits mesurés
sortis des « à savoir » trop longs rejoignent `docs/design-decisions.md` : la palette par
défaut se lit après détourage, le fond du jeu a longtemps coûté un découpage repris à la main
faute d'exister, et la famille d'un artwork filtre ses références depuis qu'un goblin a
contaminé un squelette au banc d'essai. Les dix-neuf fiches d'origine restent **dix-neuf**,
aucune n'était morte, et les six critères ci-dessus tiennent sur l'écran.

→ `GU10` a commencé par lire `Installation.tsx` et les quatre onglets de `Reglages.tsx`,
pas la liste des treize fiches : les quatre étapes de l'installation (ce qui va être
demandé, les images, les animations, où tout se range) et les trois onglets qui partagent
`"reglages"` avec elle (Moteurs & workflows, Agent MCP, Consommations — l'onglet Univers est
`GU7`). Aucune des treize fiches ne portait de `groupe`, et c'était la vraie panne de cet
écran plutôt qu'un texte trop long. Sept d'entre elles étaient aussi mal rangées, trouvées en
lisant le code plutôt qu'en le supposant : `mouvement.nom`, `mouvement.texte`,
`mouvement.cadence`, `style.nom`, `style.tient` et `style.texte` décrivaient
`BlocDirectionsAnimees`/`BlocMouvements`/`BlocStyles` (`Mouvements.tsx`), montés depuis le
18 septembre 2026 dans l'onglet Univers de `Reglages.tsx` et non plus dans l'onglet Agent
MCP — déplacées vers `ou: "jeu"`, groupe neuf « Ce qui part avec chaque animation », à la
suite du groupe que `GU7` y avait déjà posé ; `reglages.consommation` décrivait
`PanneauReglages.tsx` (monté par `BarreQuiPaie.tsx`, l'établi d'un sujet) et `Envoi.tsx`,
jamais un onglet des réglages — déplacée vers `ou: "sujet"`, dans le groupe « La barre qui
paie » que `GU6` y avait déjà posé. Un essai de `App.test.tsx` vérifiait encore
`ou: "reglages"` sur les trois premières et a été corrigé avec elles. Les six fiches
restantes sont réécrites sous quatre zones réelles : les fournisseurs (partagée avec
`Installation.tsx`), les consommations, le cadre de délégation de l'agent, la séance de
l'agent — et quatre d'entre elles dépassaient une limite de `GU3` (`quoi` ou « à savoir » sur
`assistant.fournisseurs`, `reglages.depenses`, `reglages.consommation`, `agent.modele`, plus
`agent.plafond` sur son seul « à savoir »), retaillées, ce qu'elles perdaient en détail
mesuré rejoignant cinq lignes neuves de `docs/design-decisions.md`. Treize fiches d'origine,
six propres à cet écran, et les six critères ci-dessus tiennent sur l'ensemble.

→ `GU11` a commencé par lire `lieux.ts` plutôt que la liste des vingt et une fiches : trois
lieux voisins qu'on confond facilement — `clip` (la fiche d'une commande de clip vidéo,
`Clip.tsx`/`FicheDuClip.tsx`), `montage` (l'écran où un clip payé devient plusieurs bandes,
`Montage.tsx`) et `bande` (l'atelier d'une animation image par image, `AtelierDeBande.tsx`,
qui sert aussi `montage-de-bande` par héritage). Le seul moyen de les distinguer était de
lire quel composant montait chaque `aide="…"`, pas de deviner au nom de la fiche.

Sur les huit fiches de « commander un clip » (`clip.depart`, `clip.format`, `clip.lot`,
`clip.prix`, `clip.moteur`, `clip.mesure`, `clip.liste`, `clip.confirmation`), toutes vivaient
sous `ou: "sujet"` depuis `GU6`, au motif que « c'est de l'établi qu'on ouvre l'écran ».
Mais leur `aide=` est posé dans `Clip.tsx`, dont le lieu produit `ou: "clip"` — le guide
ouvert *depuis cet écran* ne les montrait donc jamais. Déplacées vers `ou: "clip"`, texte
inchangé pour six d'entre elles, `clip.fiche` retaillée (« à savoir » à 726 signes). Neuf
fiches nées sous `ou: "clip"` restent hors sujet : `fabrication.video-libre`,
`workflow.version`, `fabrication.relecture`, `fabrication.file-locale`,
`fabrications-etat` décrivent l'écran « Fabrications » (`Fabrications.tsx`), et
`source3d.*` les rendus 3D — les deux héritent de `"clip"` faute d'`ou` à eux
(`App.tsx`, `surface === "fabrications" ? "clip" : …`), exactement comme les tuiles
héritaient de `codex` avant `GU9`. Ce n'est pas la fiche d'un clip, et ce sera `GU15`.

Les dix-huit fiches de `bande` sont réparties sur sept zones réelles, dans l'ordre où
`AtelierDeBande.tsx` les montre : en haut de l'écran — défaire, refaire, le brouillon
(`bande.historique`, `atelier.brouillon`, ce dernier rétréci pour ne plus parler des trois
écrans de la retouche que `retouche.brouillon` couvre déjà) · retoucher une frame à la main
(`bande.main`) · la recette — détourer, réduire, limiter les couleurs (`bande.recette`,
son « à savoir » retaillé de 2 752 à 336 signes) · viser ou découper une frame
(`bande.source`) · la frame choisie — position, remplacer, pelure d'oignon
(`codex.bande.image`, `bande.position`, `bande.remplacer`, `bande.pelure`) · le chutier, et
reprendre le montage (`bande.chutier`, `bande.montage`) · le cadre — la fenêtre commune
(`bande.cadre`). Cinq fiches (`bande.nom`, `bande.pivot`, `bande.vitesse`, `bande.gardees`,
`bande.destination`) n'étaient wirées que dans `Montage.tsx`, jamais dans l'atelier d'une
bande — déplacées vers `ou: "montage"`. Une (`bande.galerie`) décrit « Ses animations »,
l'onglet de `PageDuSujet.tsx` qui rend `AnimationsDuSujet.tsx` — une septième zone que `GU6`
n'avait pas repérée sur la fiche d'un sujet — déplacée vers `ou: "sujet"`, texte inchangé.

`montage` est le seul des trois écrans qui avait besoin de fiches neuves plutôt que d'une
réécriture : `montage.boucles` (les deux vignettes sur un même métronome — juger le
mouvement, juger le découpage), `montage.pellicule` (le ruban, prendre et laisser une
image) et `montage.propositions` (les découpages tout faits, gratuits) décrivent des zones
de `Montage.tsx` qui n'avaient encore aucune fiche. Avec les cinq fiches reçues de `bande`,
l'écran compte huit fiches sur huit zones — une par fiche, faute d'un geste qui en
regrouperait plusieurs sous un même titre. Le cadre de `Montage.tsx` reste documenté par
`bande.cadre` — une bulle partagée entre les deux écrans, comme `mouvement.texte` l'est déjà
entre `Clip.tsx` et `ou: "jeu"` ; c'est un point encore ouvert pour `GU16`, à trancher une
fois toutes les tranches passées. Deux décisions datées (3 et 5 septembre 2026, sur
`bande.recette`), une mesure (les dix pour cent de `bande.cadre`) et l'historique de
`V3.03.3` (`bande.montage`) rejoignent `docs/design-decisions.md`.

**Le compte, écran par écran.** `clip` portait dix fiches : neuf restent hors sujet
(`fabrication.*`, `workflow.version`, `source3d.*`) et une seule — `clip.fiche` — décrivait
vraiment cet écran ; avec les huit reçues de `sujet`, il en porte aujourd'hui neuf, sur deux
zones. `bande` portait dix-huit fiches (le compte de `GU1` a grossi avec les déplacements de
`GU5` et `GU6`, faits après la mesure du relevé) : douze restent, sur sept zones ; cinq sont
parties vers `montage`, une vers `sujet`. `montage` ne portait aucune fiche ; il en porte
aujourd'hui huit, sur huit zones. Les six critères ci-dessus tiennent sur les trois écrans.

→ `GU12` (1/2) — **quel écran sert quoi, avant d'écrire une ligne.** Les vingt-six fiches
des quatre écrans (le relevé en comptait vingt-trois ; `GU6` en a ajouté deux et `GU5` une)
relues contre `Galerie.tsx`/`BarreOutils.tsx`, `Fiche.tsx`, `Famille.tsx` et
`Livraisons.tsx`. **Six changent d'écran** : `fiche.recette` de `galerie` vers `case` (son
`aide=` est dans `Fiche.tsx`) ; `fiche.recettes` de `case` vers `bande` (la liste des
recettes nommées n'est pas dans la fiche — elle est dans `AtelierDeBande.tsx`, seul endroit
qui l'accroche, et dans le panneau de la retouche, qui n'accroche rien) ;
`bibliotheque.collections` et `tuiles.terrains` de `sortie` vers `codex` ;
`atelier.navigation` de `sortie` vers `galerie`. **Une est morte** : `codex.vitrine` décrit
`Vitrine.tsx`, supprimé du dépôt le 16 septembre 2026 — ce qu'il en reste est l'aperçu à la
barre d'espace (partout) et `Comparer.tsx` (orphelin de `GU15`). Laissée sans `groupe` ;
c'est `GU12` (2/2) qui la retire et qui le note au relevé. **Vingt-cinq fiches reçoivent
leur zone**, sur quatorze zones réelles : quatre pour `galerie` (la colonne de gauche, la
barre d'outils, faire entrer une image, l'atelier du son), cinq pour `case` (juger, corps
de, ses découpages, ce que l'image est, le pied), cinq pour `codex` (la colonne des familles
et des collections, nommer un sujet, la barre d'outils, la grille des sujets, l'atelier des
tuiles), deux pour `sortie` (les versions à livrer, l'historique). Les fiches sans `groupe`
tombent de **35 à 10** — les neuf qui restent sont les orphelines de `GU15` (`fabrication.*`,
`workflow.version`, `source3d.*`), plus `codex.vitrine`.

*Ce qui reste ouvert pour la suite.* **Trois écrans empruntent un `ou` qui n'est pas le
leur, et aucun n'est de cette tranche** : le son (`son.fabrication`, `son.coupe`,
`son.niveau`, `son.boucle` décrivent `AtelierSon.tsx`/`ReglagesSon.tsx`, qui s'ouvrent en
dialogue par-dessus la racine — restées sous `galerie`, groupées à part, pour `GU14`) ; les
tuiles (`tuiles.terrains`, désormais sous `codex` comme les écrans qu'elle décrit, pour
`GU13`) ; et le châssis (`atelier.navigation` décrit `NavigationAtelier.tsx`, visible
partout — posée sur l'écran d'ouverture, faute d'un `ou` pour ce qui se voit partout, comme
`bande.cadre` : à trancher en `GU16`). **Et `ou: "sortie"` n'est jamais calculé par
`ecranDuGuide`** (`App.tsx`) : `sortieOuverte` n'y est pas testé, donc presser `?` sur
*Livrer au jeu* montre le guide de la racine du dessous. C'est la panne de `ou: "jeu"` que
`GU7` (1/2) a réparée, sur un autre écran ; une ligne suffit, et elle n'a pas été posée ici
pour ne pas mêler du code à une tranche de décisions. Enfin, `codex.nommer` dit « la
dernière rangée de la liste » ; nommer un sujet se fait aujourd'hui en haut de l'écran,
par *Ajouter un…* — c'est `GU12` (2/2) qui corrige le texte.

→ `GU12` (2/2) — **le routage réparé, la fiche retirée, les vingt-quatre fiches
restantes réécrites.** Une ligne ajoutée en tête d'`ecranDuGuide` (`App.tsx`) : `sortieOuverte`
y est enfin testée, au même rang que `depensesOuvertes`/`installationOuverte`/`reglesOuvertes`,
et presser `?` sur *Livrer au jeu* montre désormais le guide de la sortie, plus celui de la
racine du dessous — un essai le couvre. `codex.vitrine` est retirée, notée au relevé.
`codex.nommer` est réécrite contre `Famille.tsx` (le bouton *Ajouter un…*, pas « la dernière
rangée »). Les vingt-quatre fiches restantes des quatre écrans sont relues contre le code :
cinq `long` raccourcis sous 400 signes (une décision datée — le défaut « brute » de l'import,
`US-170`/`D4` — descend dans `docs/design-decisions.md`), quatre `quoi` raccourcis sous
140 signes, `son.fabrication` corrigée (elle décrit `FabricationAudio.tsx`, pas l'atelier du
son, mais reste sous `ou: "galerie"` avec ses trois voisines — `GU14` leur donnera un écran),
et deux fiches de `codex.index`/`livraison-godot` corrigées contre une affirmation devenue
fausse. Rien d'autre ne bouge d'écran : les quatorze zones posées par `GU12` (1/2) tiennent.

---

## Les écrans qui n'ont rien

### `GU13` — Les tuiles

Les trois écrans du chantier livré le 19 septembre : l'atelier des tuiles, un jeu de tuiles, la
livraison. **Zéro fiche aujourd'hui.**

**Critères**
- [x] Les trois écrans ont leur résumé et leurs fiches.
- [x] Les deux champs de texte que `TU12` rend compréhensibles sont expliqués ici aussi, dans
      les mêmes mots qu'à l'écran.
- [x] Ce que coûte une matière générée sur la machine, et ce que ne coûte pas une matière
      intégrée, est dit.

→ `GU13` (1/2) — **la structure, avant tout texte.** Aucun des trois lieux n'était testé dans
`ecranDuGuide` (`App.tsx`) : les ouvrir montrait le guide de la racine du dessous, `codex` le
plus souvent. Trois valeurs neuves d'`Explication["ou"]` (`aide.ts`) portent désormais le nom
de leur genre dans `lieux.ts` — `tuiles`, `jeu-de-tuiles`, `livraison-de-tuiles` —, `Guide.tsx`
les nomme dans l'en-tête du volet (*Les tuiles du jeu*, *Un jeu de tuiles*, *Livrer à Godot* ;
le deuxième ne recopie aucun `<h1>`, parce que l'atelier ouvert porte le nom du jeu qu'on tape),
et `ecranDuGuide` les produit **au même rang que la sortie, du plus profond au moins profond** :
le lieu `tuiles` couvre la surface entière, et les deux autres se posent sur la racine d'où
l'on vient. Une variable de pile de plus, `livraisonDeTuiles`, sur le modèle de
`tuilesOuvertes`. Aucun résumé, aucune fiche : c'est `GU13` (2/2) qui les écrit, et les trois
essais « résumé manquant » d'`aide.test.ts` sont rouges jusque-là — en échange, les trois
essais « genre sans écran de guide » des tuiles sont passés au vert.

→ `GU13` (2/2) — **les trois résumés et vingt-sept fiches** (`aide.ts`, section *Les tuiles*, à
la fin du corpus). `ou: "tuiles"` ne couvre que la liste (`ListeDesJeux`) : deux fiches, la
carte d'un jeu et « À partir d'une image déjà faite ». `ou: "jeu-de-tuiles"` porte le gros du
travail, sur **huit zones** dans l'ordre où l'on rencontre les écrans : le choix de la sorte
(la sorte et son nom, la taille d'une pièce — qui reprend l'avertissement des 96 et 128 px
dans les mêmes mots que l'écran), préparer l'atlas depuis une image (les trois portes et la
grille ; l'éditeur, ses terrains et raccords, garder/restaurer, la carte d'essai), puis
l'atelier ouvert (les matières et leurs bordures liées, la carte / la planche / vérifier, les
réglages fins avec la palette du jeu et la graine, le tiroir de matière). `ou:
"livraison-de-tuiles"` : quatre fiches, ce qui part, la vérification à trois états, où ça va,
déposer. **Les deux champs de `TU12`** reprennent les phrases de `OngletGenerer` presque au
mot (*« C'est fait de quoi ? »*, *« Le motif »*), et **la fiche `cout-matiere` dit le prix
exact** : une matière générée est gratuite et sur la machine, mais coûte du temps (la file
locale, minutes par image, multipliées par les tirages) et une disponibilité (le modèle
installé, sinon la génération est bloquée) ; une matière intégrée ne coûte rien, redessinée à
la volée depuis la graine. `tuiles.terrains` quitte `ou: "codex"` pour `jeu-de-tuiles` —
texte inchangé, il était encore exact —, physiquement déplacée à côté de ses voisines pour
que ses zones se lisent d'un tenant. Les essais de `GU3` sont au vert pour les trois écrans ;
les quinze qui restent rouges sont `GU15` (`source3d.*`, `fabrications-etat`, `travail`,
`envoi`) et `fiche.recettes` (« à savoir » de 685 signes, oubliée par `GU11`).

*Incertitudes pour `GU16`.* Les fiches de l'atelier ouvert ne sont accrochées à aucune bulle :
seul `<Libelle aide="tuiles.terrains">` l'est dans `Tuiles.tsx` ; il faudra décider si
`AtelierTuiles.tsx` doit brancher ses contrôles, comme les autres écrans. Le comportement
exact de « Relier » (`relierBordure`) et de la restauration d'une révision n'a pas été relu
dans `atelier.ts` : les fiches en parlent à hauteur de ce que l'écran dit.

### `GU14` — Le son

L'atelier du son, le calage sonore, la livraison. **Zéro fiche aujourd'hui.**

**Critères**
- [x] Les écrans du son ont leur résumé et leurs fiches.
- [x] Ce qui tourne sur la machine et ce qui se paie est distingué à chaque fiche qui dépense.

→ `GU14` — **deux écrans de guide, un routage, trente et une fiches.** Le son n'est pas un lieu de
`lieux.ts` : l'atelier des sons (`AtelierSon.tsx`) est un dialogue (`sonsOuverts`, `App.tsx`)
posé par-dessus n'importe quelle racine, et *Un son* (`FabricationAudio.tsx`) est le corps de la
fenêtre de préparation quand son type est *Son*. Deux valeurs neuves d'`Explication["ou"]` :
`son` (*Les sons*) et `un-son` (*Un son*) — deux, parce qu'on y fait deux gestes, *régler* un son
reçu et *demander* un son. `ecranDuGuide` les teste **avant tout le reste**, l'atelier d'abord
(il se pose par-dessus la préparation). Pour savoir que la préparation est sur *Son*, une prop de
plus, `onType`, dans `PreparerUneFabrication.tsx` : le type se change dedans et seule la fenêtre
le sait. `Guide.tsx` nomme les deux écrans et porte les trois touches de la grille d'écoute
(← →, espace, G) sur `un-son`. Deux essais d'`App.test.tsx` couvrent les deux portes.

*Les fiches.* Quinze sous `son`, sur sept zones dans l'ordre de l'écran : la liste (importer), une
version (les versions, le jugement, la famille), l'écoute (le lecteur, la provenance), régler —
coupe et fondus (la coupe et le rognage, les fondus), régler — niveau et hauteur (le niveau, mono
et fréquence, la hauteur), régler — la boucle (la boucle, le raccord), puis conserver, relire,
livrer. Treize sous `un-son`, sur six zones : la demande (famille, texte, paroles et partition),
relire ce qui part, les réglages (durée, tirages, moteur), la musique (tempo et mesures, la
musique qui s'adapte), l'interface et rétro, puis lancer, écouter, garder (le lancement, la grille
des tirages, le jeu de variantes). Les quatre `son.*` qui logeaient sous `galerie` sont
revenues ici, **réécrites** : `son.niveau` disait « les fondus » alors qu'ils sont dans le bloc
*Coupe et fondus*, « la stéréo reste stéréo » alors que *En mono* existe, et « une saturation
empêche la livraison » alors que seul un rendu silencieux la bloque depuis le 18 septembre 2026 ;
`son.fabrication` est éclatée en durée, tirages et moteur. Trois fiches sont posées hors des deux
écrans, parce que leur écran est ailleurs : `son.emplacements` et `son.calage` sous `sujet`
(l'onglet *Sons* d'un sujet, dont le calage sonore que le plan nomme), `livraison.sons` sous
`sortie` (l'onglet *Sons* de *Livrer au jeu*). Aucune fiche d'un autre `ou` n'est touchée.

*Ce qui se paie.* **Rien, dans tout le son** — vérifié dans le code, pas supposé : l'annonce
de temps porte `cout_usd: 0`, la consommation locale d'un travail sonore aussi, sfxr est un
calcul sans modèle, l'import copie un fichier, la musique adaptative ne tire rien. Ce que chaque
geste coûte, c'est du **temps** et de la **disponibilité** (un moteur non installé est grisé) :
les fiches qui calculent le disent en ces mots-là (`son.lancer`, `son.moteur`, `son.paroles`,
`son.retro`, `son.tirages`, `son.adaptative`), et celles qui ne calculent rien disent « rien à
payer ». La décision est écrite dans `docs/design-decisions.md`.

*Incertitudes pour `GU16`.* **(1) Le guide est peut-être invisible sur les deux écrans du
son.** `CadreDialogue` ouvre un `<dialog>` par `showModal()`, donc dans la couche supérieure du
navigateur ; `VoletGuide` est un `fixed z-10` ordinaire, qui passe *sous* elle. `?` ouvre alors le
guide — le clavier remonte jusqu'à `window` — sans qu'on le voie. C'est vrai pour tout écran
posé en dialogue, pas pour le son seul ; non vérifié au navigateur ici (les essais jsdom ne
peignent rien). **(2) Un travail sonore rouvert depuis le suivi** (`FenetreDuTravail`,
`nature === "audio"`) monte le même formulaire, mais `App` ne connaît que l'identifiant du travail :
il garde le guide de la racine — c'est `GU15` (« la fiche d'un travail »). **(3)** Aucune fiche du
son n'est accrochée à une bulle : `AtelierSon.tsx`, `ReglagesSon.tsx` et `FabricationAudio.tsx` ne
posent aucun `aide=`. **(4)** Les niveaux visés d'une famille (ambiance −26 LUFS, musique −17)
sont ceux du code (`domaine/son.py`) ; le relevé du 19 septembre parle d'autres cibles (−19,
−16) et le banc reste à trancher par l'auteur — la fiche `son.famille` dit le code.

### `GU15` — Les douze orphelins

Le tableau de bord, les dépenses, les fabrications, la grille d'une famille, l'envoi, comparer
deux versions, la fiche d'un travail, les calques animés, le montage d'un clip — tous atteints
par l'auteur, aucun servi par le guide.

**Critères**
- [x] Plus aucun genre de `lieux.ts` ne retombe sur « les explications du voisin le plus proche ».
- [x] Le commentaire d'`App.tsx` qui l'annonçait est retiré, parce qu'il est devenu faux.
- [x] L'essai de `GU3` sur les genres sans écran passe au vert.

→ `GU15` (1/2) — **écran ou état, tranché genre par genre.** Quatre valeurs neuves
d'`Explication["ou"]`, nommées d'après le `<h1>` de leur écran : `fabrications` (*Fabrications*,
la racine du même nom), `envoi` (*Relire avant l'envoi*, le seul écran d'où l'argent part, testé
nulle part dans `ecranDuGuide` jusqu'ici), `grille` (*Sur la grille du jeu*) et `comparer` (*Deux
côte à côte*) — ces deux-là **prennent la place** de la page d'un sujet au lieu de s'y poser, et
le résumé de `sujet` n'y était vrai d'aucune de ses trois lignes. Les **neuf fiches orphelines**
qui empruntaient `ou: "clip"` rejoignent `fabrications`, groupées sur six zones dans l'ordre de
`Fabrications.tsx` ; trois `quoi` sont ramenés sous 140 signes par retrait de la phrase de trop
(un fait perdu, noté dans le code sur `source3d.camera`). Sept genres gardent un héritage, mais
**décidé et écrit** — la branche d'`ecranDuGuide` nomme chacun : `bibliotheque` et `famille` →
`codex` (même composant, `EcranFamille`, `<h1>` *Les sujets*), `travail` → `fabrications` (même
`FenetreDuTravail` que la liste des fabrications rend en place), `emploi` et `calques-animes` →
`equipement`, `carte` → `inspiration`. Un routage corrigé : `montage-de-bande` suit `montage` et
non plus `bande` — il monte `EcranMontage` en mode reprise, pas l'atelier d'une bande. Quatre
essais de routage dans `App.test.tsx`, `TOUS_LES_OU`/`GENRE_VERS_OU`/`LIEUX_FERMES` à jour. Les
quinze rouges de `GU3` tombent à cinq : les quatre « résumé manquant » des écrans neufs, que
`GU15` (2/2) écrira, et `fiche.recettes` (`ou: "bande"`, hors périmètre de cette moitié).
`tableau-de-bord` et `depenses` restent sans fiche, et c'est une décision : le premier n'est que
des boutons de navigation et des comptes, le second un écran de lecture dont le résumé de `GU4`
dit déjà les trois gestes — s'il faut des fiches, ce sont ses trois filtres et la reprise d'un
clip en attente, et `GU15` (2/2) tranche.

→ `GU15` (2/2) — **les quatre écrans neufs ont leur résumé et leurs fiches.** Les quatre
résumés de `RESUMES` (`fabrications`, `envoi`, `grille`, `comparer`) suivent le gabarit de `GU4` ;
quarante-six fiches en tout sous les quatre valeurs, dont trente-six écrites ici. Les trois
critères sont tenus, vérifiés un par un : le commentaire « le voisin le plus proche » n'est plus
dans `App.tsx` (`grep` vide), chaque genre de `lieux.ts` a une ligne non vide dans
`GENRE_VERS_OU`, et les 856 essais d'`aide.test.ts` passent — `tsc -b` propre, la suite complète
au vert (2742 essais).

*`envoi`, seize fiches.* **Le relevé de la première moitié disait « zéro fiche » et c'était faux :**
`envoi.ecran` existait, rangée sous `sujet` faute d'écran. Elle est passée sous `envoi`, et son
texte mis d'accord avec l'écran tel qu'il est (elle parlait d'interrupteurs et d'un gris « au
retour » que la seule présentation montée, `atelier`, ne dessine plus). Les autres suivent
l'écran de haut en bas : le cadre, les trois cases, les textes (lire, interrupteur, corriger, texte
à la main), le fond, le retour, les images, les consignes, le pied. **Ce qui coûte de l'argent est
dit là où il le faut** : *Consommation estimée* est une estimation mesurée, jamais une facture, et
« Coût inconnu » n'est pas zéro ; le bouton a trois formes — *Payer et lancer*, *Lancer sur ma
carte graphique* (un style local se lance, il ne se paie pas) et *Lancer la fabrication* (un
modèle qui ne facture pas en dollars) —, et **sans montant écrit l'argent part quand même** ; la
case *ne plus me le montrer pour cette série* fait payer le bouton de la barre directement, sans
dernière relecture. Tout ce qui se lit ou se corrige ne coûte rien : rien n'est appelé avant le
bouton.

*`fabrications`, neuf fiches de plus*, sur trois zones neuves : les portes (*Nouvelle fabrication*
et *Préparer une image* — deux boutons, une fenêtre —, *Animer un sujet*, *Préparer un son*), la
liste des travaux suivis (*Nouvelle animation*, et ce que la liste écrit), et le journal (la
recherche, *Actualiser* et *Consommation*, une ligne, ses quatre boutons). Le journal est passé
avant le rendu 3D rouvert, pour suivre l'écran. **Aucun de ces boutons ne paie** : les portes
ouvrent la préparation, *Reprendre depuis la galerie* n'ouvre que la galerie.

*`grille`, quatre fiches* — le zoom entier, *À côté de lui*, le volet *Ce qu'il occupe*, et le
plafond réel avec le barème, que l'inventaire de la première moitié avait oublié. Les clés portent
`grille-du-jeu.` : `grille.*` est déjà le préfixe des réglages de la table Pixelisation.
`grille.ancrage` **est restée sous `tables`** — elle décrit ce qu'on *règle* dans la retouche ;
l'écran de la grille ne fait que le lire, et le dit dans `grille-du-jeu.occupation`.

*`comparer`, huit fiches* sur quatre zones : ce qu'on compare (*Comparer avec* et le choix de la
pose ou du mouvement — le `<h1>` change avec le mode, et la fiche le dit), comment on le regarde
(fond, zoom, superposés ; lecture commune des animations), ce que les chiffres disent (les
écarts, *Ce qui ne va pas ensemble*, *Ce qui les sépare*), et le verdict sur une animation. Le
seul geste qui écrit sur tout l'écran, *Choisir pour le jeu*, est dit tel quel.

*Trois corrections.* `source3d.camera` reprend le fait tombé en première moitié — la vue 3D
transmet son angle au prochain rendu, par « Utiliser cet angle pour le rendu » — dans `change`.
`fiche.recettes` (`ou: "bande"`) **n'est pas dans le périmètre de `RG`** : `RG3` réécrit
`fiche.recette`, `fiche.reinjecter` et `fiche.personnage`, `RG5` ne cite aucune fiche `fiche.*` ;
son `long` passe de 685 à 375 signes, et ce qui racontait l'empreinte d'une recette est écrit dans
`docs/design-decisions.md`. `tableau-de-bord` et `depenses` **restent sans fiche, décision
confirmée** : des boutons de navigation, et un écran de lecture dont le résumé dit déjà les gestes.

*Incertitudes pour `GU16`.* **(1)** *Nouvelle animation*, dans la liste des travaux, et *Préparer
une vidéo* appellent exactement la même chose (`onPreparer("clip")`, sans sujet) : le premier ne
mène donc pas à l'animation d'un sujet donné, comme son nom le laisse croire — la fiche le dit, mais
c'est peut-être un défaut d'écran. **(2)** Seule l'image fixe monte encore `RelireAvantEnvoi` (avec
*Refaire cette case seule*, `Depliages.tsx`) : le commentaire de `Relecture.tsx` qui parle de
quatre types est périmé, et les relectures d'un clip, d'un son et d'un rendu 3D ont chacune leur
corps — la fiche `envoi.*` ne décrit que l'image. *Refaire cette case seule* est une fenêtre posée
par-dessus n'importe quelle racine : `ecranDuGuide` n'y connaît pas l'écran `envoi`. **(3)** Aucune
fiche des quatre écrans n'est accrochée à une bulle (`aide=`). **(4)** Rien n'a été ouvert au
navigateur : les essais jsdom ne peignent pas, et l'ordre de lecture des zones de `Envoi.tsx` (colonne
de gauche, puis colonne de droite) reste à confronter à l'écran. **(5)** *Lancer la fabrication* est
dit « un modèle dont la consommation se compte dans une autre unité » : c'est ce que `estArgent`
et le serveur MCP autorisent à écrire, mais la liste exacte des modèles concernés n'a pas été
relevée. **(6)** `fabrications-etat` et `fabrication.boutons-de-la-ligne` disent chacune, en
d'autres mots, ce que fait *Terminé* — c'est redondant, pas contradictoire.

---

## La fin

### `GU16` — La relecture croisée et l'essai au navigateur

**Critères**
- [x] Les 229 fiches (moins les retirées) sont relues d'affilée : deux fiches voisines ne se
      contredisent pas, et le même réglage porte le même nom partout.
- [x] Les écrans sont ouverts un par un dans un atelier jetable, `?` pressé sur chacun, et ce
      que le volet montre correspond à ce que l'écran porte.
- [x] Les renvois de `docs/` vers le guide sont vérifiés par `py essais/essai_docs.py`.
- [x] `docs/status/etat.md` et `docs/PLAN.md` portent le sort du chantier.

→ `GU16` (1/2) — **l'essai au navigateur**, commit `f50550e`. Un atelier jetable sur le port
8421, monté avec un jeu riche ; les vingt-cinq écrans du guide ouverts un par un par le chemin
normal du produit, `?` pressé sur chacun. **Quatre défauts de rendu corrigés** — le volet
invisible et inerte sous tout dialogue modal (`showModal()` met le dialogue dans la couche
supérieure, un `fixed z-10` passe dessous ; le volet s'y pose maintenant par `createPortal`),
Échap qui fermait le volet *et* le dialogue dessous, le volet qui couvrait la colonne qu'il
documente, et un titre faux (*Un clip* sur *Fabrications*). Le détail, écran par écran, est
dans `docs/releves/guide-2026-09-20.md` § *L'essai au navigateur*.

→ `GU16` (2/2) — **la relecture croisée, et la clôture.** Les 311 fiches relues d'affilée, dans
l'ordre du fichier qui est l'ordre du volet. **Vingt-trois désaccords trouvés et réglés**, chacun
noté au relevé avec sa correction (§ *La relecture croisée*) : une table qui s'annonçait « la
cinquième **et dernière** place » à côté de trois autres numérotées six, sept et huit ; un
personnage qui remplissait 90 % de sa case dans une fiche et 100 % dans deux autres ; quatre
paires de fiches voisines dont les `change` se recopiaient mot pour mot ; trois fiches qui
renvoyaient à des réglages retirés en `GU5` ; `atelier.apercu` qui décrivait encore le dépliant
remplacé par un écran en `E14`, et disait donc la même chose qu'`envoi.textes` ; et la phrase que
la **décision d'architecture n°6 donne elle-même en contre-exemple** — « l'atelier relit le cadre
et réserve le budget partagé » — toujours au corpus, sur `agent.cadre-durable`.

**Les noms mis d'accord avec `docs/vocabulaire.html`** : les cinq tables qui portaient encore
leur clé de recette (*Grille*, *Quantification*, *Nettoyage des bords*, *Les contours*, *La
main*) portent leur nom d'écran (**Pixelisation, Couleurs, Nettoyage, Contour, Main**) — la table
*Couleurs* s'appelle *Couleurs, la table*, parce que le réglage qu'elle contient s'appelle
*couleurs* lui aussi, et que l'essai « deux entrées du même écran ne portent pas le même nom »
(`GU2`) l'a refusé ; les deux
fabriques gardent leur verbe (*Superposer*, *Découper*, dix-huit fiches) ; douze fiches
disaient **« une chose »** pour un sujet et sept **« un asset »**, deux mots de la liste noire.

**Cinq fiches écrites, aucune retirée** : trois pour l'étape *Ses sons* des règles du jeu, qui
existe dans `ETAPES` et que `RESUMES.jeu` nommait depuis `GU4` sans qu'aucune fiche la décrive ;
`detourage.comparaison`, le réglage *par canal / par teinte* de `B18`, voisin de la tolérance et
jamais documenté ; `equipement.nouvel-emploi`, le seul réglage réel de la page d'une pièce. Le
corpus passe de **311 à 316 fiches**.

**Deux questions laissées ouvertes par les tranches précédentes, tranchées** : `bande.cadre`
reste sous `ou: "bande"`, là où le cadre *se règle* (le montage ne fait que le lire, et sa fiche
le dit) ; `atelier.navigation` reste sous `ou: "galerie"` — il n'y aura pas de valeur « le
châssis », parce qu'un écran de guide décrit l'écran qu'on a sous les yeux et qu'une telle valeur
ne serait jamais calculée par `ecranDuGuide`. Et la découpe **reste sous `ou: "tables"`** :
`Decoupe.tsx` a quatre portes dont une seule est un lieu de la pile, donc un `ou: "decoupe"` n'en
servirait qu'une et laisserait les trois autres sur le guide de leur racine ; `decoupe.mode` les
nomme maintenant toutes les quatre en une phrase.

**Un défaut d'ordre, réparé sans toucher un mot.** Deux fiches de `ou: "bande"` vivaient
physiquement ailleurs dans `aide.ts` — `bande.source` au milieu des tables, `codex.bande.image`
au milieu de la fiche d'un sujet. Comme le volet suit l'ordre du fichier, l'atelier d'une bande
s'ouvrait sur *La frame choisie* et montrait *En haut de l'écran* en quatrième. Les treize
fiches de cet écran suivent maintenant l'ordre d'`AtelierDeBande.tsx`.

**Les mesures de fin** : `npx tsc -b` propre, `aide.test.ts` **868 essais verts sur 868**, la
suite d'écran entière verte, et `py essais/essai_docs.py` vert — **2 218 renvois, tous justes**,
corpus de démarrage à 167,8 Ko.

---

## La clôture du chantier — 20 septembre 2026

**Seize tranches, ouvertes et closes le même jour.** Le relevé de départ comptait 229 fiches à
plat, dont soixante-treize sur un seul écran, 156 textes longs de 521 signes de médiane, aucun
résumé, seize valeurs de `ou` pour une trentaine de genres de lieu, et zéro fiche pour les tuiles
comme pour le son. Le corpus porte aujourd'hui **316 fiches sur 25 écrans du guide**, toutes
dans un groupe qui nomme leur zone d'écran, et **chacun des 25 écrans a son résumé**.

**Ce que le chantier a appris.**

1. **La panne n'était pas celle qu'on croyait.** L'auteur a demandé un guide moins pompeux ; la
   mesure a trouvé que **cinq écrans montraient le guide d'un autre écran**. Vingt-cinq fiches
   des règles du jeu étaient écrites depuis des semaines et **jamais atteignables** — la valeur
   `ou: "jeu"` ne pouvait être produite par aucune branche du code. Réécrire le texte d'abord
   n'aurait rien changé à l'écran. *Lire le composant, pas la liste des fiches*, a été la règle
   de chaque tranche, et c'est elle qui a rendu les déplacements : **plus de soixante fiches**
   ont changé d'écran parce qu'elles n'avaient jamais décrit celui où elles étaient rangées —
   dix-neuf d'un coup en `GU8`, quatorze en `GU11`.
2. **Un essai par fiche, jamais un essai qui additionne.** Les garde-fous de `GU3` étaient
   **404 rouges sur 658** le jour de leur écriture, et ce compte a servi de jauge d'avancement.
   Un essai unique aurait dit « une fiche est trop longue » sans dire laquelle ; `test.each` dit
   la clé, et un écran corrigé voit ses essais verdir sans toucher aux autres. Ces mêmes
   garde-fous ont trouvé le vingt-troisième désaccord de la relecture — un désaccord qu'elle
   venait de créer, en rendant à une table un nom que le réglage voisin portait déjà.
3. **L'ordre du fichier est l'ordre de l'écran, et rien ne le rappelle.** Deux fiches déplacées
   par leur `ou` mais pas par leur place ont suffi à désordonner un écran entier. C'est le genre
   de défaut qu'aucun essai ne voit et qu'une relecture croisée trouve en une lecture.
4. **Douze tranches écrivent douze fois la même chose autrement.** La relecture finale a rendu
   vingt-trois désaccords — des nombres, des noms, des phrases recopiées d'une fiche à sa
   voisine. Aucun n'était visible depuis l'intérieur d'une tranche.
5. **Les essais jsdom ne peignent rien.** Le volet était invisible sur tout dialogue modal, et
   aucun essai d'écran ne pouvait le dire : il fallait un navigateur. À l'inverse, le navigateur
   n'a pas pu éprouver les vraies touches. Les deux se complètent, aucun ne remplace l'autre.
6. **« Aucun mot n'est perdu » a tenu.** Ce qui sortait d'un « à savoir » trop long est descendu
   dans `docs/design-decisions.md` — une trentaine de lignes datées —, et les onze fiches
   retirées sont nommées une par une dans le relevé, avec la raison de leur retrait.

**Ce qui reste.** Sept limites connues, écrites au relevé (§ *Ce qui reste*). Aucune n'est un
défaut de texte : un travail sonore rouvert depuis le suivi porte le guide du journal ; la
fenêtre *Préparer une fabrication* n'a pas d'écran de guide à elle, alors que c'est là qu'on
prépare l'argent ; `workflow.version` ne peut servir qu'un des deux écrans qui la montrent ;
l'installation de la machine n'a pas de fiche propre ; aucune fiche des tuiles, du son ni des
quatre écrans de `GU15` n'est accrochée à une bulle ; deux noms de champ restent en désaccord
avec `RP4` dans le code ; et les vraies touches `?` et Échap n'ont pas été éprouvées à la main.

---

## Ce que ce chantier ne fait pas

- Il ne touche pas aux infobulles elles-mêmes : elles rendent le même corpus, donc elles
  s'améliorent sans une ligne de code de plus.
- Il n'écrit pas de parcours d'accueil (« par où commencer »). L'auteur ne l'a pas demandé ;
  l'ancien a été retiré en `B7` et reste lisible dans Git.
- Il n'appelle aucun modèle. Le guide est écrit à la main, et c'est ce qui le rend gratuit et
  vérifiable.
