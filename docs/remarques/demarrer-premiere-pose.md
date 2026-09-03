# Démarrer la première pose d'un personnage

> **État : tranchée.** Les quatre pistes sont arbitrées ; ce qu'il faut construire est au § 7.
> Index : `docs/remarques.md`. Mise en contexte le 3 septembre 2026, sur lecture du code.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> je suis un peux bloqué sur la compréhension de comment je démarre les première génération d'un
> personnage sur un nouveau projet.
> j'ai créer quelque artwork dans l'univers, mon personnage "pelerin" a un artwork officiel, mais
> qui le représente pas dans la bonne vue (c'est ujsute une image d'inspiration).
> comment je démarre concrètement pour générer la première pose de ce personnage ?
> Enfait a force de chercher j'ai compris, il faut utiliser les bouton "fabriquer" sur chaque pose
> pour démarrer. Mais c'et absoluement pas intuitif. Il faut propsoer quelque chose.

---

## 2 · Ce que le produit fait aujourd'hui

Le diagnostic de l'auteur est juste. Il lui manquait une porte, et le dépôt en promet une
troisième qui n'existe pas.

**Le petit « Fabriquer › » ressemble à trois liens qui ne coûtent rien.** Sur chaque ligne de
pose, il est écrit en 10 pixels, sans cadre et sans fond, dans exactement la même couleur et la
même taille que « sa fiche › », « la vitrine › » et « le calibrage › ». Sur l'établi du pèlerin,
**neuf liens ont cette forme identique, et six seulement mènent à une dépense.** Rien à l'écran
ne sépare ce qui ouvre une page de ce qui arme un appel payant.

- `interface/src/composants/Personnages.tsx:2069-2081` — le bouton d'une ligne de pose
- `interface/src/composants/Personnages.tsx:1310-1340` — les trois liens gratuits, même classe

**Il existe un vrai bouton, et il est invisible parce qu'il dépend d'où l'on clique.** Dans le
codex, cliquer **le corps** de la carte d'une chose fait apparaître à droite « Fabriquer ce qui
manque ». Cliquer **son nom** saute cette colonne et descend directement dans l'établi — c'est
sans doute ce que l'auteur a fait. Deux clics sur le même objet mènent à deux endroits
différents, et rien ne le dit.

- `interface/src/composants/Codex.tsx:918-931` — le bouton « Fabriquer ce qui manque »

**Et ce bouton-là est un piège pour une première image.** Il arme les six poses d'un coup, en un
seul appel plié : c'est le geste le plus cher et le plus risqué du produit. Si le nombre
d'images qui revient n'est pas le bon, **rien n'entre et tout se repaie au prix plein.**

**Le point le plus lourd : trois textes promettent un comportement que le code n'a pas.** La
maquette du codex, celle du premier lancement, et **le Guide de l'application lui-même** — que
l'auteur peut lire dans le produit — écrivent qu'écrire un nom ouvre l'établi de la chose. Le
code se contente de la sélectionner dans la colonne de droite.

- `interface/src/composants/Guide.tsx:236-240` — « le tonneau entre dans la liste sur-le-champ,
  et son établi s'ouvre »
- `interface/src/composants/Codex.tsx:566-575` — le code appelle `onChoisir`, jamais `onOuvrir`
- `docs/maquettes-v2.1/05-codex.html:561` et `31-le-premier-lancement.html:485` — même promesse
- `docs/user-stories.md:287` — **US-189** demande qu'un clic sur une case vide remplisse le
  prompt. Elle est **comptée comme livrée**, et le geste n'existe pas.

**Sur un projet neuf, rien n'accueille.** L'assistant de démarrage ne s'ouvre **qu'une seule fois
dans la vie de l'atelier** — quand il n'y a qu'un jeu encore nommé « Bac à sable » et aucune
image. Créer un second jeu ne déclenche rien.

- `atelier/services/bibliotheque.py:852-874` — la règle du « premier lancement »

**Et l'application s'ouvre sur la galerie**, le seul des trois onglets qui ne sait pas dépenser.
Le bouton Générer y est éteint avec la mention « aucun prompt », qui dit ce qui manque sans dire
où cliquer.

- `interface/src/App.tsx:230, 882-892, 1161`

---

## 3 · Pourquoi c'est comme ça

**Ce que le bouton fait a sa raison, écrite.** *« Armer, pas payer. Ce bouton remplit le prompt
de l'atelier et rend la main : c'est là-bas qu'on relit et qu'on dépense »*
(`Personnages.tsx:2069-2071`). Elle sert un invariant du produit : *une seule barre de saisie
dans tout l'atelier, et deux lieux seulement d'où l'argent part.*

**Mais la forme de ce bouton n'a aucune raison écrite nulle part.** Qu'il soit un lien de 10 px
identique à trois liens gratuits, plutôt que la case elle-même, n'est consigné dans aucun
document. Il est arrivé tel quel avec la première version de l'écran, sans que la décision soit
écrite.

**Et les documents qui font foi disent le contraire du code.** La maquette de l'établi dessine
des lignes **sans bouton** et décrit *« cliquer une case vide remplit le prompt »*. Ce n'est donc
pas un arbitrage qu'on rouvrirait : c'est un écart entre ce qui est écrit et ce qui est construit.

**Sur l'absence d'accueil à la création d'un projet, aucune raison trouvée.** La règle du premier
lancement explique pourquoi l'assistant ne se rouvre pas sous les doigts de quelqu'un qui
travaille. Elle ne dit rien du cas « nouveau jeu dans un atelier déjà plein ».

---

## 4 · Ce qui borne la solution

| La règle | Ce qu'elle interdit ici |
|---|---|
| **Une seule barre de saisie, deux lieux d'où l'argent part** — `PLAN.md`, invariants | Pas de troisième champ de prompt, ni dans la galerie ni ailleurs |
| **Le manque n'a aucune couleur d'alerte, et rien ne réclame jamais rien** — `PLAN.md` + `design-motifs.md:1437` | Pas de pastille rouge, pas de badge « commence ici », pas de flèche clignotante |
| **La case vide est une case, pas un trou** — `design-motifs.md:1432` | Elle garde sa hauteur, son « rien encore » et son compte. Elle ne devient pas un gros bouton d'appel |
| **Aucune hauteur inventée** — cinq valeurs : 44 · 38 · 34 · 30 · 26 | Un bouton posé sur une ligne prend l'une des cinq |
| **La police à empattements n'a que trois emplois**, dont les états vides — `DESIGN.md:90` | Une phrase d'accueil en serif est permise. Un quatrième emploi, non |
| **Une explication ne se recopie jamais** — invariant `R4`, étendu en `R8` | Toute phrase d'accueil se lit dans le recueil, jamais tapée dans l'écran |
| **Aucun écran n'est obligatoire** — `PLAN.md`, depuis `E19` | Un accueil doit se quitter d'un clic |
| **Un onglet ne se recouvre pas ; aucune surface modale** — `PLAN.md` + `Arbre.tsx:115` | Pas de fenêtre flottante. Nuance : les Réglages et le Guide couvrent déjà tout l'écran, donc un plein cadre a un précédent |

**À noter, et ça pèse sur toutes les pistes :** le recueil d'explications compte 120 entrées,
dont trois pour le codex et neuf pour l'établi — et **aucune ne parle de la matrice, d'une case,
d'une attitude, ni du geste « fabriquer ».**

---

## 5 · Les pistes

### A · Nommer une chose ouvre son établi
*Faire ce que trois documents promettent déjà.*

**Ce que ça fait** — Tu tapes « Le pèlerin », tu fais Entrée, et l'écran descend tout de suite
dans son établi : ses six poses sous les yeux, le champ de prompt en pied, le curseur déjà
dedans. Tu ne devines plus où aller. Ça aligne aussi le Guide sur la réalité au lieu de le
laisser mentir.

**Ce que ça coûte** — Une poignée de lignes, l'interface seulement. Rien côté Python, aucune
donnée nouvelle. Sept essais d'écran à relire.

**Le risque** — Nommer cinq personnages d'affilée devient plus lourd : aujourd'hui on reste dans
la liste et on enchaîne. Ça se compense si Échap remonte au codex. **Elle n'enfreint aucune
règle** — elle répare un écart. Mais seule elle ne suffit pas : arrivé dans l'établi, le geste
reste un lien de 10 px.

### B · La ligne d'une pose vide devient elle-même le bouton
*C'est littéralement ce que demande US-189 et ce que dessine la maquette.*

**Ce que ça fait** — Cliquer n'importe où sur la bande vide d'une pose — là où il est écrit
« rien encore » — arme l'atelier, avec un survol qui éclaire la ligne pour le dire. La cible
passe d'environ 70 pixels de large sur une ligne de texte de 10 px à **toute la largeur de la
ligne, sur ses 52 px de haut.**

**Ce que ça coûte** — L'interface seulement, dans deux fonctions. Aucun appel serveur nouveau.
Un essai d'écran à écrire.

**Le risque** — Une ligne à moitié pleine devient ambiguë : ses vignettes ouvrent la retouche,
son fond armerait l'atelier. Il faut limiter le geste à la zone vide, ce qui réintroduit une
frontière invisible. **Le clic n'engage aucune dépense**, donc un clic accidentel ne coûte rien —
c'est ce qui rend le risque supportable.

### C · Une chose sans aucune image porte une phrase d'accueil
**Ce que ça fait** — Tant qu'une chose n'a strictement aucune image, la matrice affiche
au-dessus de ses lignes une invitation en serif, du même ton que le « Ce jeu n'a encore personne.
Nomme le premier. » du codex. Elle disparaît dès la première image.

**Ce que ça coûte** — Quelques lignes, plus **une entrée neuve au recueil** — l'invariant impose
de lire la phrase là et non de la taper dans l'écran. Aucune largeur, couleur ni hauteur
nouvelle.

**Le risque** — Elle prend de la hauteur dans un écran qui en manque déjà. Elle n'existe que dans
la minute que personne ne revoit. Et elle frôle la règle *rien ne réclame jamais rien* : la
phrase doit **constater**, pas presser. Seule, elle explique sans rendre le geste plus facile à
viser.

### D · Le bouton du codex propose une première pose au lieu des six
**Ce que ça fait** — Sur une chose qui n'a encore rien, « Fabriquer ce qui manque » proposerait
la **première pose seule**, avec son prix, et garderait le lot complet en second geste explicite.
Tu vois une image revenir, tu juges le style, et seulement après tu lances les cinq autres.

**Ce que ça coûte** — Une condition et un libellé. L'interface seulement ; le calcul du prix
existe déjà.

**Le risque** — C'est la piste qui protège le mieux l'argent et **la plus faible sur la question
posée** : elle ne rend pas le geste plus visible, elle le rend moins cher. Elle enlève aussi le
geste en un clic à l'usager expérimenté, donc il faut garder les deux — et deux boutons côte à
côte au même endroit, c'est exactement le défaut d'aujourd'hui.

---

## 6 · Ce qui est tranché, ce qui reste ouvert

### Tranché

**La piste A est retenue — 3 septembre 2026.** Taper le nom d'une chose dans le codex et faire
Entrée **descend dans son établi**, avec le champ de prompt en pied et le curseur dedans.
**Échap remonte au codex**, ce qui rend l'enchaînement de plusieurs noms.

*Ce que ça règle du même coup* : les trois documents cessent de mentir — la maquette du codex,
celle du premier lancement, et le Guide lisible dans le produit (`Guide.tsx:238`) décrivaient
déjà ce comportement.

*Ce que ça ne règle pas* : arrivé dans l'établi, le geste qui arme reste un lien de 10 px
identique à trois liens gratuits. Les pistes B et C restent entières.

**La piste D est retenue, avec une addition — 3 septembre 2026.** Sur une chose qui n'a
strictement aucune image, le bouton du codex propose **une pose seule avec son prix**, et non les
six. Le lot complet reste disponible en second geste.

*L'addition, et c'est elle qui rend la piste tenable* : la pose obtenue, si elle plaît, **se
retient comme image d'exemple du personnage** — un geste qui existe déjà (`promouvoirReference`,
bloc « ses images de référence » de la fiche). Les cinq suivantes partent alors en une feuille
**avec cette première image jointe**, ce qui rend la cohérence d'échelle et de style que la pose
isolée avait fait perdre.

*Pourquoi cette addition était nécessaire* : une planche n'achète pas seulement un prix, elle
achète la cohérence — *« les cases sortent à la même échelle et dans le même style, puisqu'elles
ont été peintes ensemble »* (`docs/maquettes-v2.1/08-planche-de-pose.html:938`). Casser la
planche en 1 + 5 sans référence aurait donné une première image qui ne ressemble pas aux cinq
autres, c'est-à-dire le défaut exact que l'écran de calibrage existe pour rattraper.

*Ce que ça préserve* : au-delà de quatre cases une feuille coûte moins que quatre appels
séparés, donc le lot garde tout son intérêt une fois le style validé. Et on ne risque plus six
images d'un coup sur un style qu'on n'a pas vu, alors qu'un compte d'images faux fait tout
rejeter et tout repayer au prix plein — le seul refus automatique du produit.

**Les pistes B et C sont retenues — 3 septembre 2026.**

**B — la ligne d'une pose vide devient elle-même le bouton.** Elle n'a demandé aucun arbitrage :
c'est littéralement ce que dessine `docs/maquettes-v2.1/02-etabli-personnage.html` et ce que
demande **US-189**, comptée comme livrée alors que le geste n'existe pas. La cible passe d'un
lien de 10 px large d'environ 70 pixels à toute la largeur de la ligne, sur ses 52 px de haut.
Le geste se borne à **la zone vide** d'une ligne : sur une ligne à moitié pleine, les vignettes
gardent leur sens et ouvrent la retouche.

**C — une chose sans aucune image porte une phrase d'accueil, et elle disparaît à la première
image.** Elle ne parle qu'à l'instant où l'on est perdu. Elle **constate**, elle ne presse pas,
donc elle ne heurte pas la règle *rien ne réclame jamais rien* : la garder tant que la chose
n'est pas complète aurait créé le troisième état que le produit s'interdit — le vert dit *fini*,
l'absence de couleur dit *pas encore*, il n'y a rien entre les deux.

*Sa phrase est une **entrée neuve du recueil**, pas un texte tapé dans l'écran* — l'invariant
`R4`, étendu en `R8`, l'impose. C'est la première entrée que le recueil aura sur la matrice
d'une chose : il n'en a aucune aujourd'hui.

### Reporté ailleurs

**La quatrième question est sans objet sous la forme où elle était posée.** L'écran qui montre ce
qui va partir affiche déjà chaque image jointe sur sa ligne, avec sa vignette, sa provenance, son
prix et **un interrupteur** — et ce qui est éteint ne part pas
(`interface/src/composants/Envoi.tsx:275-290` et `:780`). Le geste existe ; ce qui manquait était
de savoir qu'il existe.

Ce qui restait à trancher — *faut-il que le produit signale qu'une image d'exemple n'est pas dans
la vue du jeu ?* — appartenait à la remarque **« concept art de » contre « artwork officiel
promu »**. Le fait mesuré qui la motive est au journal, séance du 1<sup>er</sup> septembre : le
texte demandait une vue de dessus, l'image jointe était de face, et **ce qui est revenu était de
face**.

→ **Tranchée le 3 septembre 2026, et refermée sans rien construire** :
[`concept-art-contre-artwork.md` § 6c](concept-art-contre-artwork.md). Le produit **ne peut pas le
savoir** — l'univers porte une vue, une carte n'en porte aucune. Il ne pourrait que la demander,
carte par carte, ou faire lire l'image par un modèle, donc payer. Les deux coûtent plus que la
gêne. La question est écrite là-bas pour le jour où elle reviendra d'elle-même.

---

## 7 · Ce qu'il faut construire

Quatre changements, l'interface seulement. **Aucun appel payant, aucune donnée nouvelle sur le
disque, aucune largeur, couleur, hauteur, police ni symbole neufs.**

1. **Nommer une chose ouvre son établi**, curseur dans le champ de prompt ; Échap remonte au
   codex. — `Codex.tsx:566-575`
2. **La zone vide d'une ligne de pose arme l'atelier**, avec un survol qui éclaire la ligne. —
   `Personnages.tsx`, dans `LigneCase` et `SousLigneDirection`
3. **Sur une chose sans aucune image, le bouton du codex propose la première pose seule**, avec
   son prix ; le lot complet reste en second geste. Et la pose obtenue se retient en image
   d'exemple, pour que les cinq suivantes partent avec elle. — `Codex.tsx:918-931`
4. **Une chose sans aucune image porte une phrase d'accueil**, lue dans le recueil, effacée dès
   la première image. — `Personnages.tsx:1650-1680` + une entrée neuve dans `aide.ts`

**Deux corrections qui ne demandent l'avis de personne :**
- la phrase du Guide (`Guide.tsx:238`) devient vraie du fait du point 1 — vérifier qu'elle l'est ;
- **US-189** est à rouvrir : elle est comptée livrée et son geste n'existe pas. Le point 2 la
  livre pour de bon.

**Ce que ça ne couvre pas, et qui est la même cause :** sur un projet neuf, rien n'accueille —
l'assistant ne s'ouvre qu'une fois dans la vie de l'atelier
(`atelier/services/bibliotheque.py:852-874`). **À trancher avec la remarque sur l'assistant de
démarrage**, sinon on posera deux accueils.

---

## Ce que cette remarque recoupe

- **La remarque sur l'assistant de démarrage**, de la même séance. **Même cause exacte** :
  l'assistant ne s'ouvre qu'une fois dans la vie de l'atelier, jamais à la création d'un jeu.
  **Les deux doivent être tranchées ensemble**, sinon on pose deux accueils.
- **La remarque « concept art de » contre « artwork officiel promu »**, même séance : c'est le
  même instant de la vie du produit — on vient de créer des artworks et on ne sait pas ce
  qu'ils font au moment de générer.
- **La tranche `R8` du plan** : même famille de défaut, un écran du codex qui ne dit pas à quoi
  il sert, et même remède annoncé. Elle ne couvre pas l'établi, mais ce qui sera fait ici devrait
  employer le même mécanisme.
