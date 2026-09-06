# Asset Kitchen — Design System

> **Réécrit de zéro le 4 septembre 2026**, sur demande de l'auteur, après douze relevés du code et
> de l'état de l'art. Ce document fait foi sur **l'apparence** — et sur rien d'autre. Ce que fait un
> écran est tranché par `docs/PRD.md` ; comment c'est construit, par `docs/ARCHITECTURE.md`.
> Spécimen vivant : `docs/design-preview-refonte.html`.
>
> **Le système d'avant est archivé tel quel dans `docs/archive/DESIGN-avant-refonte-2026-09-04.md`**,
> et il n'est pas périmé pour autant : **c'est encore lui qui tourne dans le code**. Tant que la
> refonte n'est pas livrée, l'archive décrit le produit et ce fichier-ci décrit la cible. Chaque
> section ci-dessous dit ce qu'elle change et ce qu'elle garde.

---

## Pourquoi on a tout repris

L'auteur, le 4 septembre 2026 : *« les écrans sont surchargés de texte et de liens, c'est pas
lisible, pas intuitif pour un sou, aucun workflow ne se dessine visuellement, on passe son temps à
faire des allers-retours avec ses yeux pour essayer de décrypter comment fonctionne l'interface, ce
qui est cliquable ou pas, à quel endroit… et pourtant les fonctionnalités sont bien. »*

**Il a raison, et la cause n'est pas celle qu'il nomme.** Ce n'est pas la quantité de texte : c'est
que **rien à l'écran n'a de bord**. Quatre mesures suffisent à l'établir, et elles commandent tout
ce document.

| Ce qui a été mesuré | Le chiffre | Ce que ça produit |
|---|---|---|
| Boutons sans cadre ni fond visible au repos | **231 sur 259** — le survol porte l'information pour 233 d'entre eux | « on ne sait pas ce qui est cliquable » |
| Apparences distinctes pour ces boutons | **108**, dont **71** qui n'existent qu'une fois ; le composant partagé n'est employé que 20 fois | aucune convention n'a pu se former |
| Soulignement — la seule décoration qui ressemble à un lien | **109 mots non cliquables** contre **1 cliquable** | la convention est inversée, pas absente |
| Écarts de 40 px dans tout le code | **un seul, dans 35 751 lignes** ; 92 % des 495 écarts tiennent entre 4 et 12 px | aucun endroit où l'œil se pose |

S'y ajoutent : **526 déclarations de taille sur 732 à 10 px ou moins**, 94 % du texte tassé dans une
bande de 4,5 px découpée en dix valeurs ; **427 lignes dessinées** dont 84 % sous la moitié du seuil
où l'œil perçoit un trait ; **quatre fonds qui ne couvrent que 10,3 points de clarté au total**,
avec 1,05 à 1,10 contre 1 entre deux surfaces voisines — c'est-à-dire deux surfaces qui ne se
distinguent pas.

Et trois paires, dans du code partagé donc sur **tous** les écrans, où un texte mort et un bouton
portent exactement les mêmes réglages, à quelques pixels l'un de l'autre.

**Ce qui n'était pas en cause** : l'audit du 31 août 2026 relevait quatorze défauts. Treize sont
réparés, un seul reste ouvert (*les douze étapes des réglages du jeu, qu'on voudrait voir
ensemble*). La « grosse passe de design » n'avait aucune matière là-dedans. `N1` du plan est donc
rendue par ce relevé.

---

## Product Context

- **Quoi** : atelier personnel de production d'assets 2D pour jeu. On définit l'univers d'un jeu une
  fois, on fabrique au cas par cas ce qui lui appartient. Voir `docs/PRD.md` § Solution.
- **Pour qui** : une personne — l'auteur du jeu, qui est aussi l'auteur de l'outil. Il juge la
  qualité à l'œil, mieux et plus vite qu'une machine.
- **Espace** : outils de production créative à forte densité — Lightroom, Aseprite, Blender, Linear,
  Raycast.
- **Type** : **outil interne de production**, écran large uniquement. Ni site marketing, ni produit
  grand public.
- **Ce qu'on doit retenir en trois secondes** : **le bois et la lampe** — *l'outil est chaud comme un
  plan de travail, et la seule lumière neutre de l'écran tombe sur l'image.*

**Il n'y a pas de novice à protéger.** Un seul utilisateur, expérimenté, qui est l'auteur du
produit. Les arguments d'apprentissage progressif ne s'appliquent pas ici, et le travail de
référence sur les dispositions plates (*CommandMaps*, CHI 2012) donne l'avantage à l'écran où tout
est visible chez les gens expérimentés, sans coût pour les débutants. **Replier reste donc
l'exception argumentée, jamais le réflexe.**

---

## Aesthetic Direction

- **Direction** : **organique et chaude** pour le châssis, **instrument** pour la densité. L'outil
  cesse de se retirer — il se tient bien, pour qu'on sache où poser la main.
- **Décoration** : **minimale, mais la forme est obligatoire.** Aucun dégradé, aucune ombre portée,
  aucune icône illustrative. **En échange, tout ce qui réagit porte un bord visible.** C'était le
  vide du système d'avant : il interdisait la décoration et n'imposait rien à la place.
- **Mood** : chaud, calme, franc. On voit d'un coup d'œil ce qui se clique, ce qui informe, et où va
  la suite.
- **Références** : Linear et Raycast pour la hiérarchie et la densité tenue ; Gruvbox et Everforest
  pour les fonds chauds à très faible saturation ; Lightroom et Capture One pour la lumière de
  jugement d'image.

### Le principe unique dont tout découle

**Ce qui réagit se voit sans la souris ; ce qui informe se range par le vide.**

C'est la phrase qui remplace *« chaque décision retire une concurrence à la grille »*. L'ancienne
était juste et elle a été appliquée jusqu'à retirer aussi ce qui n'était pas une concurrence — les
bords. Ce document rend le bord obligatoire à ce qui se clique, et le retire à tout le reste.

**Le test qui tranche, et il est vérifiable** : *sur une capture immobile, souris posée à côté,
peut-on nommer toutes les zones cliquables ?* Si non, le système ne marche pas. Aujourd'hui la
réponse est non pour 233 boutons sur 259.

### Ce que la refonte garde du système d'avant, et ce n'est pas peu

Ces acquis ont chacun une raison mesurée. **Une refonte qui les perdrait aurait à les repayer à
l'usage, comme la première fois.**

- **Le prix dans le libellé du bouton** — `Payer et lancer — $0,067` contre `Lancer — gratuit`,
  `Revenir sans rien dépenser`, `aucun appel ne part d'ici`. Dix-huit chaînes de ce genre dans douze
  écrans. C'est la promesse centrale d'un outil qui paie ses images, **aucun pictogramme ne sait la
  dire**, et c'est la seule chose que l'interface fait déjà mieux que ses concurrentes.
- **Les 88 à 95 explications qui disent la conséquence et non la fonction** — *« les images déjà
  faites restent »*, *« l'image part à la corbeille — le pied de l'écran propose de la rendre »*.
- **Le grisé qui porte sa raison en toutes lettres**, sous le contrôle, en permanence, jamais dans
  une bulle au survol. 68 emplois, un composant dédié. C'est rare, et c'est bon.
- **Le recueil d'explications** : 134 entrées, un gabarit imposé (*ce que c'est, ce que ça change,
  d'où ça sort*), en français clair. Un an de rédaction déjà faite.
- **Les états vides écrits comme des invitations** — *« Ce jeu n'a encore personne. Nomme le
  premier. »* Il ne leur manque pas un texte, il leur manque **un bouton à côté**.
- **L'écran de confirmation avant la dépense** : chaque texte et chaque image qui partent sur leur
  ligne avec un interrupteur, le prix dans le bouton, un dominant, une sortie explicite. **C'est le
  seul écran où la hiérarchie fait déjà son travail — il est le modèle de la refonte, pas sa
  matière.**
- **Le bloc replié qui porte sa valeur à droite de son titre** — sept appels sur sept respectent la
  règle. Le seul motif que le code applique intégralement.
- **La suite de segments** : le seul contrôle dont l'état se lit sans bouger la souris. 36 emplois.
- **Le budget de mouvement** : 74 transitions courtes, une seule jauge et elle est déterminée. C'est
  le point où le produit est **en avance** sur ses références. Rien à y faire.
- **La discipline des couleurs** : 27 couleurs dans un seul fichier, 2 108 emplois qui passent tous
  par un nom, **une seule valeur recopiée à la main dans tout le produit**. C'est ce qui rend une
  refonte de palette bon marché — et ce qu'une refonte bâclée détruirait.

---

## Color

**Approche : restrained.** Un seul accent, un châssis chaud à très faible saturation, quatre
sémantiques, et **une surface de jugement qui n'obéit à rien de tout cela**.

### La décision structurelle : le châssis se réchauffe, et l'image en sort

Le document d'avant affirmait qu'*un fond clair remonte la luminance d'entourage et fausse le
contraste perçu d'un sprite*. **C'est l'inverse qui est vrai**, et trois relevés le disent : c'est
l'entourage **sombre** qui abaisse le contraste perçu (effet Bartleson-Breneman). Le damier de
l'atelier est à **1,08 % de réflectance** quand la norme de jugement d'image (ISO 3664) en demande
**10 à 20**. L'atelier pousse donc l'auteur à **surcontraster** ses sprites — le défaut même que la
phrase croyait prévenir, et il ne s'en aperçoit qu'une fois l'image dans le jeu.

**L'autre moitié de la phrase reste vraie et survit intacte** : un châssis chaud entre bien en
concurrence avec les verts, les bruns et les ors du pixel art de fantasy. C'est ce qui a écarté la
maquette ambre du 26 août 2026, après essai.

> **Le produit confondait deux surfaces.** Le châssis et le pourtour de l'image sont deux choses
> différentes, et le refus du 26 août portait sur leur confusion. **On peut chauffer l'outil à
> condition de sortir l'image du châssis** — et c'est la seule chose de neuf qui autorise à rouvrir
> cette décision-là.

⚠️ **La phrase fausse vit à trois endroits et doit être retirée d'un seul geste** :
`docs/DESIGN.md` (fait — c'est ce paragraphe qui la remplace), le journal des décisions au
26 août 2026, et **le commentaire en tête de `interface/src/index.css`, lignes 7 à 9**. Si elle reste
dans le code, elle reviendra à la relecture suivante et refermera la décision. Le produit connaît ce
défaut : le 31 août 2026, une correction écrite dans un document et pas dans les deux autres endroits
où la même promesse était inscrite a été notée comme *une contradiction en attente*.

### Le châssis — teinte 60° en OKLCH, chroma plafonnée à 0,013

**Aucune valeur n'a été choisie à l'œil.** Chacune est le résultat d'une recherche sur sa clarté, à
teinte et saturation fixées, jusqu'à atteindre sa cible de contraste. Le script est
`docs/design-preview-refonte.html` (il recalcule tout dans la page) ; la méthode est décrite
au § Comment ces valeurs ont été obtenues.

**Tous les contrastes sont mesurés sur `--fond-2` `#48413C`** — le fond le plus clair sur lequel du
texte est réellement posé. Mesurer sur `--fond-0` donnerait des chiffres flatteurs et faux à l'usage.

| Token | Hex | Ce qu'il doit atteindre | WCAG | APCA |
|---|---|---|---|---|
| `--fond-0` | `#201B18` | 1,30 : 1 sous `--fond-1` | 1,70 | — |
| `--fond-1` | `#35302C` | 1,30 : 1 sous `--fond-2` | 1,30 | — |
| `--fond-2` | `#48413C` | la référence | — | — |
| `--fond-3` | `#58514B` | 1,28 : 1 sur `--fond-2` | 1,28 | — |
| `--trait` | `#69615B` | 1,65 : 1 — **visible, jamais une affordance** | 1,65 | — |
| `--contour` | `#958B83` | **3,00 : 1 — le seuil du bord perçu** | 3,00 | — |
| `--contour-fort` | `#B7ACA3` | 4,50 : 1 — le focus | 4,50 | — |
| `--texte` | `#F4F0EE` | contraste perçu 88 | 8,84 | −88 |
| `--texte-2` | `#D5D0CC` | contraste perçu 68 | 6,54 | −68 |
| `--texte-3` | `#B6B1AD` | contraste perçu 50 | 4,71 | −50 |

**La marche entre deux surfaces voisines vaut 1,30 : 1**, contre 1,05 à 1,10 aujourd'hui. C'est le
changement le plus mécanique du document et l'un des plus visibles : deux surfaces voisines se
distinguaient si peu qu'elles ne se distinguaient pas.

**`--texte-3` n'est plus sous le seuil.** Le gris le plus sombre d'avant (`#5E6771`, 3,01 : 1, et
contraste réellement perçu de **22** sur une échelle où 30 est le plancher absolu de tout texte)
était employé **496 fois** — plus que les deux autres gris réunis —, dont **318 fois sous 11 px** et
**103 fois sur des boutons**. La règle qui l'autorisait n'était pas fautive ; son application l'était.
Il remonte, et il est **rendu au texte inerte** — mais dans cet ordre : *on le remonte d'abord, en
une ligne, pour que plus rien ne reste illisible ; on le rend à ce qui ne se clique pas ensuite,
écran par écran, à mesure que le vocabulaire de boutons passe.*

### La garde des arcs s'étend au châssis, et voici sa borne

Deux arcs de la roue restent fermés parce que les quatre couleurs qui disent quelque chose y vivent.
Le châssis chaud tombe dedans — et il y reste, **sous une condition écrite** :

> **La garde des arcs vaut pour toute couleur dont la chroma dépasse 0,03. En dessous, ce n'est plus
> une couleur, c'est une matière.**
> Le châssis est à **0,013**, soit **huit fois moins que la plus sourde des quatre sémantiques**.
> Corollaire tenu par cette règle : `--epingle` doit garder **au moins huit fois la chroma du
> châssis**. Si une teinte de châssis future ne peut pas respecter cet écart, c'est la teinte qui
> change, jamais la sémantique.

Sans cette borne écrite, un châssis chaud éteindrait la seule couleur chaude que le produit s'était
autorisée — `--epingle`, qui dit *réglé à la main*, *interrompu*, *catalogue servi de repli*, et dont
le coût avait été nommé le 27 août 2026 : *« un point chaud de plus dans un châssis froid »*.

### Le signal et les quatre sémantiques

| Token | Hex | Cible | WCAG | APCA | Usage |
|---|---|---|---|---|---|
| `--signal` | `#5EC8E4` | perçu 55 | 5,18 | −55 | **le seul accent** — marque, texte d'accent, jauge |
| `--signal-plein` | `#87E5FF` | perçu 72 | 7,00 | −72 | **le fond du bouton dominant**, avec `--fond-0` par-dessus (perçu **81**) |
| `--ok` | `#81CB91` | perçu 55 | 5,19 | −55 | réussi, en ligne, posé dans le dossier du jeu |
| `--epingle` | `#DEB653` | perçu 55 | 5,21 | −55 | réglé à la main, interrompu, catalogue servi de repli |
| `--echec` | `#FFA29A` | perçu 55 | 5,19 | −55 | appel raté, suppression, refus |

**Le cyan reste, et il est le seul choix du châssis que la mesure confirme entièrement.** Sur les
quatre jeux réels du dépôt, aucune couleur de palette ne s'en approche — distance minimale mesurée
de 86 sur 441 possibles. C'est la seule famille chromatique qu'un asset de fantasy ne produit
presque jamais, et sur un châssis désormais chaud, elle est en plus complémentaire : elle ressort
mieux qu'avant, pas moins.

**Il se dédouble, et c'est ce qui résout la contradiction entre deux relevés.** L'un plafonnait le
fond parce qu'au-delà l'accent cesse d'être lisible en petit texte ; l'autre voulait monter le fond
et éclaircir l'accent. **Les deux ont raison sur des emplois différents** : `--signal` porte les
marques et le texte d'accent, `--signal-plein` porte les fonds pleins, où c'est le texte sombre
par-dessus qui doit être lisible. Le fond monte, et rien ne se perd.

`--info` reste retiré (27 août 2026) : un token sémantique qui nomme un état et ne colore plus rien
ré-autorise un second gris neutre le jour où quelqu'un cherchera « la couleur d'une information ».

### La lumière — la surface qui ne suit rien

**C'est la proposition centrale de cette refonte, et la seule surface du produit qui ne change
jamais**, quel que soit le fond retenu.

| Token | Hex | Réflectance | Usage |
|---|---|---|---|
| `--pourtour` | `#6C6C6C` | **15 %** | le fond immédiat de toute image qu'on regarde pour la juger |
| `--damier-a` | `#686868` | 13,8 % | damier alpha, carreau sombre |
| `--damier-b` | `#707070` | 16,2 % | damier alpha, carreau clair |

**Strictement neutres** : rouge, vert et bleu rigoureusement égaux. La valeur de 15 % est le milieu
de la fourchette de l'ISO 3664, et c'est ce qu'un gris de visionnage vaut dans Lightroom et
Capture One.

**Où elle s'applique, et la liste est fermée** : la tuile d'une image dans la grille, la fiche,
l'aperçu plein écran, la vitrine, la superposition, la planche. Partout ailleurs, c'est le châssis.
**Le damier et le pourtour ne se confondent pas** : le damier dit *il n'y a pas de couleur ici* — il
révèle la transparence d'un sprite détouré, et il a servi le 3 septembre 2026 à montrer qu'aucun
fond n'était posé, à la place d'une pastille qui affirmait le contraire. Il garde son écart
volontairement faible entre les deux carreaux — assez pour se lire, trop peu pour que l'œil suive le
motif — et il devient neutre, comme le pourtour. Carreaux de 12 px sur une tuile, 16 px en fiche.

### Les dix teintes de rangement

| Token | Hex | Token | Hex |
|---|---|---|---|
| `--ilot-ardoise` | `#90AECC` | `--ilot-mauve` | `#C7A0B5` |
| `--ilot-pervenche` | `#9EAACF` | `--ilot-bruyere` | `#CC9FA6` |
| `--ilot-iris` | `#ABA7CD` | `--ilot-paille` | `#B2AC84` |
| `--ilot-lavande` | `#B6A4C8` | `--ilot-mousse` | `#A3B089` |
| `--ilot-prune` | `#C0A1C0` | `--ilot-lichen` | `#96B292` |

Les dix sont posées à la **même clarté perçue** — contraste perçu 46, WCAG 4,33 à 4,36 : 1 sur
`--fond-2` —, **au-dessus du seuil AA et sous les quatre sémantiques**, dont la chroma est deux fois
la leur. C'est ce qui les fait lire comme un rangement plutôt que comme un état.

**Les quatre disciplines ne se négocient pas**, et elles sont reconduites telles quelles : chroma
plafonnée sous celle des sémantiques ; elles ne colorent que des **surfaces de la toile** — cadre
d'îlot, bandeau, fond d'îlot, fond de note — jamais une marque sur une carte, jamais un contrôle ;
la liste est **fermée** et il n'existe aucun sélecteur libre ; et les deux arcs des sémantiques leur
restent interdits.

### Mode clair — il n'y en a pas, et c'en est toujours une décision

Un seul utilisateur, un seul écran. Ce qui change, c'est que **la raison a changé** : ce n'est plus
« un fond clair fausse le jugement » — cette phrase était fausse. C'est que **doubler la palette
double la maintenance des états**, et que le besoin derrière la demande (*c'est trop sombre*) est
servi par la profondeur du châssis, qui a monté.

### La teinte du jeu ouvert — abandonnée par son auteur, le 4 septembre 2026

L'idée était de teindre automatiquement l'interface à la palette du jeu ouvert. Elle est
**abandonnée**, et c'est l'auteur qui l'abandonne après lecture des mesures. Elle s'écrit ici pour
qu'elle ne se rouvre pas par oubli.

Techniquement, elle coûtait presque rien : les 27 couleurs vivent dans un seul fichier, la palette
du jeu arrive déjà entière côté écran. **Ce sont quatre mesures qui l'ont tuée**, et la dernière
touche au métier même du produit :

1. **Aucune palette réelle ne peut fournir une couleur de texte.** Sur les 48 couleurs d'un jeu de
   l'auteur, une seule atteint le seuil minimal ; une autre palette plafonne à 2,60 : 1, un peu plus
   du tiers de ce qu'il faut.
2. **La teinte dominante des quatre projets pourvus tombe à moins de 30° d'une des quatre
   sémantiques — quatre fois sur quatre** (écarts mesurés : 12, 15, 23 et 29°).
3. **Deux projets sur six n'ont aucune palette**, et c'est l'état de tout jeu neuf.
4. **La boucle se referme sur elle-même** : un châssis teint à la couleur du jeu fait paraître les
   sprites de ce jeu **10 à 17 % moins colorés** à la teinte que le châssis porte déjà, **24 à 41 %**
   à une teinte franchement visible. C'est exactement le jugement que l'atelier sert à porter,
   faussé dans le sens qui trompe : *il fait rater ce qui est juste.*

**Ce qui existe déjà ne bouge pas** : la vitrine propose les trois premières couleurs de la palette
comme fonds de jugement, avec sa raison écrite dans le code — *une couleur que le jeu emploie, le
sujet s'y détache ou non*. Elle reste ce qu'elle est. **L'étendre n'est pas au programme** : l'auteur
a tranché *« laisse tomber cette idée »*, et cette phrase couvre la demande entière, pas seulement sa
forme la plus risquée.

---

## Les quatre formes, et la cinquième est interdite

**C'est le cœur de la refonte.** La liste est fermée, chaque forme a un métier, et **tout passe par
le composant partagé** — employé aujourd'hui 20 fois sur 259.

| Forme | Ce qu'elle porte | Comment elle se dessine |
|---|---|---|
| **Le plein** | le geste qui fait avancer le travail ou qui paie — **un seul par écran** | fond `--signal-plein`, texte `--fond-0`, graisse 600 |
| **Le cadre** | le geste ordinaire | fond `--fond-2`, bord `--contour` (**3,00 : 1**), texte `--texte` |
| **Le lien** | ce qui mène ailleurs | texte `--signal`, souligné 1 px à 3 px de la ligne de base |
| **L'éteint** | ce qui ne peut pas être fait maintenant | fond `--fond-2`, bord `--trait` **pointillé**, texte `--texte-3`, **plus sa raison en clair sous le contrôle** |

> **La cinquième forme — le mot gris cliquable — est interdite.** Elle compte aujourd'hui
> **85 emplois**, dont 12 qui ne se déclarent même pas au survol. C'est elle qui produit la plainte.

**Le soulignement change de camp.** Il est rendu au cliquable. **Et la marque qu'il libère doit être
remplacée dans le même mouvement** : les 109 mots soulignés d'aujourd'hui sont les **points
d'accroche des explications**, et sans marque ils deviennent introuvables — ce qui perdrait le
recueil de 134 entrées que ce document range parmi les acquis à ne pas perdre. La nouvelle marque ne
peut être ni un glyphe (le produit a refusé trente points d'interrogation pour ça) ni une couleur
(elles sont toutes prises). *C'est la seule question de forme que ce document laisse ouverte, et elle
se tranche avant la première passe d'écran.*

**« Éteint » et « allumé mais non choisi » cessent de partager les mêmes pixels.** Le même triplet de
classes sert aujourd'hui aux deux, quatre fois chacun.

**Toute zone cliquable fait au moins 24 × 24 px** (critère 2.5.8 de WCAG 2.2, contraignant en Europe
depuis le 28 juin 2025). Trois croix de fermeture sont en dessous, dont une qui mesure environ
10 × 14 px.

**Un contrôle est visible s'il est survolé OU choisi OU au focus clavier.** Le produit a déjà écrit
cette ligne correctement à un endroit ; il suffit de la généraliser. Quatre contrôles n'existent
aujourd'hui qu'à la souris, **dont deux sont hors du clavier** : poser un favori sur une image est un
geste que seule la souris peut faire.

### Les interrupteurs — la couleur porte l'état, pas le mot

**Décision de l'auteur, le 4 septembre 2026**, et elle vaut au-delà des onze contrôles qui l'ont
provoquée : *« une interface trop textuelle est fatigante et lourde à utiliser. Une icône ou un
bouton bascule se comprend naturellement, sans se lire. »*

Le produit avait **six dessins et cinq paires de mots pour une seule idée**. Il n'en reste **un
dessin et un couple de mots**.

| | Ce que c'est |
|---|---|
| **La forme** | un **interrupteur bascule**, et rien d'autre. Il remplace le carré de 9 px, le carré de 14 px, `●`/`○`, `✓`, et les libellés qui décrivaient l'état |
| **L'état** | il se lit **à la couleur d'abord** : actif en `--signal`, inactif en `--fond-2` bordé de `--trait`. La couleur est primordiale — on doit voir ce qui est actif avant de le lire |
| **Les mots** | **`actif` / `inactif`**, et le mot reste l'**étiquette de ce que l'interrupteur commande**, jamais la description de son état. L'interrupteur dit l'état ; le mot dit de quoi |
| **La cible** | 24 × 24 px minimum, comme tout ce qui se clique |

**La pastille ronde ne s'y confond pas** : elle reste réservée aux **états** — en ligne, réussi,
raté — qu'on ne clique pas. Un interrupteur est un geste, une pastille est un constat.

**Et une icône pour la seule idée qui n'est pas celle-là** : *voir ou ne pas voir*. **Un œil, ouvert
ou fermé.** Deux endroits seulement dans tout le produit — masquer un calque le temps de vérifier
qu'une pièce d'équipement tient sur le corps, et peindre en magenta sur l'image ce qui ne compte pas.
Partout ailleurs, éteindre ne cache rien : dans l'écran de confirmation, une ligne éteinte **reste à
l'écran, barrée**, et c'est tout le sens de cet écran.

### Les deux traits, et un seul est fort

**Le trait qui range n'est pas le trait qui se clique.**

- **`--trait`, 1,65 : 1** — il sépare et ne promet rien. Réservé au **cadre extérieur** d'un panneau
  et aux bandes. **À l'intérieur d'un panneau, on groupe par le vide, pas par des lignes.**
- **`--contour`, 3,00 : 1** — il ne se pose que sur ce qui réagit. Le voir, c'est savoir qu'on peut
  cliquer.
- **`--contour-fort`, 4,50 : 1** — le focus, plus l'anneau `--signal-plein` de 2 px.

C'est ce qui finance la suppression des **427 lignes** actuelles, dont 84 % sont sous le seuil de
perception : assez pour salir l'image, pas assez pour qu'une seule serve de repère.

⚠️ **Élaguer les traits se fait après la montée des fonds, jamais avant** — sans les marches à
1,30 : 1, un panneau sans trait n'a plus de bord du tout. Et c'est une passe à faire au navigateur,
écran par écran : on ne s'aperçoit qu'un trait manquait qu'en le voyant manquer.

### La bande d'action, et ce qu'elle doit à la fente

Une bande de **48 px au bas de la colonne de travail** : à droite le dominant, à sa gauche trois
secondaires au maximum, à gauche la ligne d'état. **Ancrée au bas de la colonne, jamais de l'écran,
jamais flottante** — Figma a fait flotter sa barre d'outils en bas dans sa refonte, et c'est devenu
la critique la plus reprise de son propre forum.

Elle répare trois défauts mesurés : il n'existe aucune zone d'action fixe dans tout le produit ; le
bouton qui paie flotte dans le flux du bloc de prompt et **se déplace verticalement selon la longueur
du texte saisi** ; et sur la matrice de l'établi, trois commandes de même apparence se suivent sur
chaque ligne — c'est la deuxième qui engage l'argent, répétée une trentaine de fois.

⚠️ **Ce qu'elle doit à la fente du champ de prompt, et qui doit être tranché en la construisant.**
Cette fente n'a jamais deux locataires à la fois, mais elle en a **trois qui se relaient** — le
raccourci au repos, la raison quand le bouton qui paie est grisé, le repli hors ligne. C'est ce qui
rend la règle tenable. Loger la ligne d'état de la bande dans cette fente y ajouterait un quatrième
locataire **toujours présent**, et détruirait le seul endroit du produit où un refus s'explique avant
le clic. **Soit la bande porte son propre état, soit elle n'en porte pas.**

---

## Typography

Trois familles, **trois rôles étanches**.

| Rôle | Police | Rationale |
|---|---|---|
| **Display** | **Fraunces** (variable) | Chaude, avec un axe d'*optique* qui l'épaissit quand elle rapetisse — et **elle a des graisses**. Instrument Serif n'existe qu'en romain et italique d'un seul poids : le produit s'en est déjà trouvé bloqué. |
| **Body et contrôles** | **Archivo** (variable) | Trois raisons mesurées. La **hauteur d'œil la plus haute** des grotesques pratiques (0,531 em), ce qui l'autorise à composer à 14,1 px là où d'autres exigent 15,5 ; **5,8 % de français en plus par ligne** qu'Instrument Sans ; et **le plus faible débord d'accent mesuré** — le É ne dépasse le H que de 0,18 em contre 0,23 —, ce qui compte énormément en français, où ce sont les capitales accentuées qu'une rangée serrée rogne en premier. Elle a en plus un **axe de chasse réel** (62 à 125 %) : condenser à 90 % rend 8,3 % de largeur sans toucher ni à la taille ni au contraste. |
| **Mesures** | **JetBrains Mono** | `tabular-nums`, zéro barré. Elle porte **toutes** les mesures et **rien d'autre**. |

⚠️ **Le piège d'Archivo** : la demander en instances fixes livre une fonte **sans l'axe de chasse**,
c'est-à-dire sans la moitié de la raison qui l'a fait choisir. Et **les trois fontes s'auto-hébergent**
au lieu d'être tirées du réseau à chaque ouverture, comme aujourd'hui.

### Les deux règles d'emploi

**1 — Fraunces ne descend jamais sous 19 px et n'entre jamais dans un contrôle.** Trois usages : le
nom du produit dans la barre de tête, les titres d'écran, les états vides. *« Ta bibliothèque est
vide. Écris. »* en serif est une invitation ; en sans, c'est un message d'erreur.

**2 — Toute mesure est en JetBrains Mono, et la chasse fixe ne porte que des mesures.** La règle
d'avant était juste et son application la contredisait : **313 de ses 604 emplois sont des boutons ou
de la prose**. Les explications du produit sont donc rendues en chasse fixe à 10 px, ce qui les rend
indistinguables d'un relevé de mesures — **c'est très exactement ce que l'auteur décrit comme « une
interface qui assomme d'infos techniques »**. Une phrase française prise dans la mono coûte 35,7 % de
largeur pour un bénéfice nul.

**La coupe se fait donc dans l'autre sens que le réflexe** : la chasse fixe **garde** les montants,
durées, dimensions, comptes et pourcentages ; elle **perd** la prose et les libellés de boutons. Le
1er septembre 2026, le produit a réparé un défaut avec la règle telle qu'elle est — le bouton de
téléchargement était invisible dans une bande où sept éléments sur huit sont des faits mesurés, et la
réparation a consisté à en faire **la seule chose de la bande qui ne soit pas en chasse fixe**. Cette
réparation ne fonctionne que si la chasse fixe veut dire *fait mesuré*.

Une seule exception, et elle dit la même chose qu'un nombre : `gratuit`, à la place d'un montant, chez
un fournisseur qui ne facture pas.

Corollaires : `font-variant-numeric: tabular-nums` systématique, virgule décimale, espace fine avant
l'unité (`4 px`, `$0,067`, `64×64`).

### Cinq tailles, et rien entre

| px | Interligne | Ce qu'elle porte |
|---|---|---|
| **11** | 16 px | ce qui n'est **jamais** porteur de sens tout seul — unité, en-tête de colonne en capitales espacées, méta d'une tuile |
| **13** | 18 px | **le plancher** — tout contrôle, tout libellé, toute rangée, tout tableau |
| **15** | 24 px | la prose qu'on lit vraiment, le nom en fiche |
| **19** | 26 px | titre de section |
| **28** | 34 px | titre d'écran, état vide — en Fraunces |

Cinq au lieu de **vingt**, et le plancher passe de 10 à 13 px. **Chaque taille porte son interligne
écrit**, au lieu du 1,5 hérité par accident sur 89 % des éléments. **Le poids par défaut passe de 400
à 500** : cela abaisse d'un cran entier l'exigence de contraste pour environ 1 % de largeur en plus.

⚠️ **Ce que le plancher coûte, et il faut le payer.** Remonter 526 déclarations de 10 à 13 px
augmente la surface de texte d'**environ un tiers**, sur un produit que son auteur trouve surchargé.
La chasse condensée en rend 8,3 % et le gain de police 5,8 % : **cela ne couvre pas la moitié**. Le
reste se paie en **enlevant des contrôles et des mots**, écran par écran, avec un budget chiffré
décidé avant de dessiner. Sans ce calcul, la refonte livre un écran plus lisible mot par mot et plus
lourd d'ensemble — c'est-à-dire une réponse à *pas lisible* qui aggrave *surchargé de texte*.

**Le contraste se mesure en perception réelle (APCA), et l'ancien calcul ne sert plus que de filet.**
Sur fond sombre, WCAG 2 délivre des certificats de conformité à des textes illisibles : le gris
secondaire du produit affiche 7,12 : 1, le meilleur niveau, pour un contraste réellement perçu de 50
quand il en faut 75. Et **on ne pousse pas le contraste au maximum** : la cible du texte principal est
88, pas 93,6 — au-delà, le texte clair bave sur le fond sombre, particulièrement chez les 30 à 50 %
d'adultes astigmates.

---

## Spacing

- **Base** : 4 px.
- **Densité** : **compacte, mais avec un palier de repos.** Ce n'est pas un adoucissement : c'est
  qu'il n'y avait aucun palier.
- **Cinq crans : `4 · 8 · 12 · 24 · 40`.**

**Le cinquième cran est la nouveauté qui compte.** 92 % des 495 écarts du produit sont tassés entre
4 et 12 px, et il existe **un seul écart de 40 px dans 35 751 lignes**. Il n'y a donc littéralement
aucun endroit où l'œil se pose — c'est ça, *les allers-retours avec les yeux*.

> **Deux blocs séparés de 40 px n'ont besoin d'aucun trait entre eux.** C'est cette règle qui finance
> la suppression des 427 lignes.

Gouttière de grille d'assets : 12 px. Padding de panneau : 12 px. Padding de zone centrale : 24 px.
Gouttière de défilement réservée en permanence partout où ça défile : **9 px** — reconduit tel quel,
parce que 9 px qui apparaissent peuvent retirer une colonne entière d'une grille au moment où l'on y
cherche quelque chose.

### Hauteurs de contrôle — nouvelle liste fermée, et elle est *dérivée*

**`48 · 40 · 36 · 30`.** Quatre valeurs. La liste d'avant — `44 · 38 · 34 · 30 · 26` — **ne survit
pas au plancher de 13 px**, et c'est écrit plutôt que subi : une rangée de 26 px portant une ligne de
13 px et son interligne de 18 laisserait 3 px de garde de chaque côté, bordure comprise. La liste
s'ouvrirait alors en silence, et avec elle la seule discipline qui empêchait chaque écran neuf de
réinventer sa propre hauteur.

**Chaque valeur est une ligne de texte plus une garde nommée** — c'est ce qui la rend défendable :

| px | Le calcul | Ce qui la porte |
|---|---|---|
| **48** | 18 + 2×14 + 2 | barre de tête, **bande d'action**, pied de l'assistant |
| **40** | 18 + 2×10 + 2 | toute barre d'outils, vignette d'une image de référence |
| **36** | 18 + 2×8 + 2 | **bouton, champ** — dont le bouton qui paie et le champ qui nomme |
| **30** | 18 + 2×5 + 2 | rangée d'arbre, rangée d'étape, bouton de segment, en-tête de panneau, champ de recherche, barre d'état |

**Deux valeurs sortent de la liste, et les deux sont nommées.** Le **champ de prompt** est une zone de
saisie sur plusieurs lignes, pas une bande : deux lignes de 18 px, plus 8 px de garde en haut et en
bas, plus le trait, font **54 px**. Et le **bouton compact reste à 24 px**, parce qu'il vit *à
l'intérieur* d'une rangée qui est elle-même dans la liste — c'est aussi le plancher de zone cliquable
imposé par WCAG 2.2, ce qui n'est pas une coïncidence.

**Une bande de la liste ne grandit pas — et ce qui en sort est une mesure, jamais un geste.**
Reconduit tel quel du système d'avant, avec l'ordre du sacrifice : *les dimensions de l'image partent
en premier, parce que c'est la seule mesure de cette bande qui se relise ailleurs ; puis les libellés
des contrôles, parce qu'un libellé n'est pas un geste non plus.* Aucune barre de défilement
horizontale : elle prend 16 px sur les 40 de la bande, construite et retirée le 1er septembre 2026.

⚠️ **Une bande précise doit être remesurée avant que l'échelle ne soit arrêtée** : le comparateur des
tables réclamait **973 px pour 840 disponibles** à 1 600 px de fenêtre, aux anciennes tailles. Ses
libellés passent de 10 à 13 px, en français qui coûte déjà +39,9 % de largeur sur l'anglais. Elle
déborde à toutes les tailles de fenêtre, et c'est l'un des quatre écrans que ce document déclare
**denses à juste titre**.

### Largeurs de colonne — la liste est fermée aussi

**`380 · 300 · 240`**, reconduites. **Et une règle nouvelle, qui répond aux allers-retours du
regard** :

> **Un contrôle se tient dans la même colonne que ce qu'il modifie, et un objet ne raconte pas sa vie
> à trois endroits à la fois.**

Elle se paie : elle interdit la mise en page qui met l'arbre à gauche, les réglages dans une deuxième
colonne, la grille au milieu et la fiche à droite — c'est-à-dire trois colonnes traversées deux fois
pour un seul geste. *Ce document pose la règle ; c'est `/design` qui l'applique écran par écran.*

---

## Layout

- **Approche** : **grid-disciplined**, sans exception.
- **Trois onglets, et une profondeur** : **Univers · Codex · Galerie**, plus un fil d'Ariane qui
  nomme la profondeur. Reconduit.
- **Grid de la Galerie et du Codex** : `240px · minmax(0,1fr) · 380px`.
- **Grid de l'Établi** : `380px · minmax(0,1fr) · 380px`, les deux colonnes repliables.
- **Max content width** : **aucune**, à deux exceptions nommées — la colonne de prose du Guide et la
  carte de texte du tableau d'inspiration ouverte en grand, bornées à **540 px**, soit 70 signes par
  ligne. **La borne s'écrit en `em`, jamais en `ch`** : un `ch` vaut la largeur du chiffre zéro, et
  une colonne de `72ch` tient 112 signes.
- **Grille d'assets** : `repeat(auto-fill, minmax(128px, 1fr))`, gouttière 12 px. Zoom 1× / 2× / 4×.
  **Un cran est disponible quand deux tuiles y tiennent côte à côte**, pas une. **Le cran choisi reste
  choisi même devenu indisponible**, et la barre le dit.
- **Border radius** : `sm 3px · md 5px · lg 8px · full 9999px`. **La tuile d'asset reste à 0** — le
  bord de la tuile et le bord du sprite deviennent la même sorte de ligne, et la grille se lit comme
  une planche contact. Corollaire obligatoire : **aucune ombre portée sur une tuile**.

Le rayon monte de `2/3/4` à `3/5/8` : c'est le seul geste franchement « moderne » du document, et il
est bon marché. **Ce n'est pas un « arrondi de confort »** au sens que le document d'avant interdisait
— l'argument contre l'arrondi, lui, tient et il est mesuré : *le pinceau de la main est passé du rond
au carré le 31 août 2026 parce qu'un disque de rayon 2 sur un sprite de 64 pixels ne fait pas un bord
net, il fait un escalier que personne n'a dessiné.* **Ce qui touche un sprite reste carré ; ce qui
touche le châssis s'arrondit.**

### Six règles de comportement que la refonte ne doit pas perdre

Elles ont été payées à l'écran, pas au banc d'essai, et elles vivent dans les mêmes fichiers que ce
que la refonte va réécrire. **À vérifier écran par écran pendant la passe.**

1. **Un panneau est borné par l'écran, jamais par son contenu.** Mesuré : trois colonnes sur quatre
   rognaient en silence, la fiche demandait 1 310 px pour ce qu'on lui donnait.
2. **Un bloc ne s'écrase jamais pour tenir.** La liste des modèles est tombée à 0 px et a disparu
   entièrement. Un contrôle écrasé ment sur son état.
3. **La gouttière de 9 px est réservée en permanence partout où ça défile.**
4. **Le cran de zoom choisi reste choisi même devenu indisponible, et la barre le dit** — le seul
   endroit du produit où l'on rend autre chose que ce qui est demandé, et il ne le fait jamais en
   silence.
5. **Un cran de zoom tient quand deux tuiles y tiennent, pas une.**
6. **Sur la toile, tout objet déclare son échelle** — écran ou plan. *Ce qui se lit est en pixels
   d'écran ; ce qui se mesure est en pixels de plan.*

Et une septième, du même ordre : **une image ne se met pas dans ce qui est borné plus court qu'elle.**
*Ce qui se lit par morceaux peut vivre dans un panneau borné ; ce qui ne se comprend qu'entier demande
son propre écran.*

---

## Les icônes

**Jeu retenu : Lucide**, habillé aux **bouts et angles carrés** — c'est le seul jeu libre sérieux dont
on peut écraser le bout de trait pour qu'il parle la même langue que le pinceau du produit, qui est
carré depuis le 31 août 2026, *parce que le pinceau l'est*.

**Deux tailles et pas une troisième** : **16 px** dans tout ce qui se clique, **20 px** dans la barre
des trois lieux. Trait **1,5 px**, calé sur le texte de la rangée et jamais sur sa hauteur.

**Toujours accompagnées de leur mot**, sauf dans une rangée répétée où le mot est déjà en tête de
colonne. **Jamais seules dans un panneau.**

### Le plafond, et pourquoi il n'est pas la vraie borne

**Plafond : 18 pictogrammes** — c'est le nombre de verbes distincts recensés dans le produit. Mais
**la règle d'admission posée le 28 août 2026 est plus sévère que le plafond, et c'est elle qui
tranche** :

> *Un dessin n'entre que là où aucun mot ne peut tenir, et où la forme est lue sans apprentissage.*

Un plafond est un compte ; cette règle est une condition. Dix-huit places libres admettraient
dix-sept formes que la condition refuserait.

### Ce que les icônes ne feront pas, et il faut le dire avant de les dessiner

- **Sur 223 emplacements de bouton, 77 seulement (35 %) peuvent devenir un pictogramme lu sans
  apprentissage.** 95 (43 %) ne le peuvent pas : ce sont des lieux que l'atelier a inventés —
  l'établi, la vitrine, le calibrage, la planche, les tables — ou des nuances de prix qu'aucune forme
  ne dit. 51 (23 %) sont ambigus dans les deux registres.
- **La place gagnée ne sauve pas la barre qui déborde** : la plus serrée passe de 1 284 à 1 011 px
  (−21 %) alors que sa colonne peut descendre à 520. Les icônes divisent le débordement par deux,
  elles ne le suppriment pas. **Si l'encombrement est un vrai sujet, il se traite en enlevant des
  contrôles, pas en rétrécissant leurs libellés.**
- **Le refus de la roue dentée et du point d'interrogation reste valable** : les remplacer par deux
  carrés dans la barre du haut libère 69 px sur 599, soit 12 %.

### L'inventaire des signes est à corriger, et il ne coûte rien

Le compte de « trois glyphes » **ne décrit plus le code depuis longtemps** : dix-huit
caractères-signes sont réellement rendus à l'écran, plus sept formes dessinées. Deux croix
différentes servent au même geste (`×` dans 17 boutons, `✕` dans 3), et **le même `×` sert aussi de
signe de multiplication dans une trentaine de mesures** — un libellé contient les deux emplois à trois
centimètres d'écart. Le triangle plein de 13 px dit **trois choses différentes**, même forme, même
couleur, même coin.

**Trois corrections d'inventaire, sans discussion de fond** : une seule croix, `×` rendu à la
multiplication, et un seul sens par forme dessinée.

---

## L'écriture — dire la conséquence, jamais l'aphorisme

**Décision de l'auteur, le 4 septembre 2026** : *« fini les phrases mystère sans sujet ni sens. On ne
fait pas de la philosophie. Tu mets un truc concret et clair. »*

| Ce qui est visé | Ce qui le remplace |
|---|---|
| *« un refus écrit, pas une case vide »* | **« ne sera pas utilisé pour la génération IA »** |

**La règle** : une explication nomme **la chose** et **ce qui va lui arriver**. Ce qui est condamné
n'est pas la longueur — c'est la forme qui oppose deux abstractions sans dire de quoi elle parle, et
qui laisse le lecteur reconstituer le sujet.

⚠️ **Elle ne condamne pas les explications rangées plus haut parmi les acquis** — *« les images déjà
faites restent »*, *« l'image part à la corbeille — le pied de l'écran propose de la rendre »*,
*« rien n'est consommé tant que le bouton n'est pas pressé »*. Celles-là ont un sujet et disent ce
qui arrive : **elles sont le modèle, pas la cible.** La distinction est nette et elle se teste —
*qui fait quoi, dans cette phrase ?* Si la question n'a pas de réponse, la phrase est à réécrire.

Le vocabulaire fermé — un mot par geste — vit dans **`docs/vocabulaire-a-fermer.md`**.

---

## Motion

**Inchangé.** C'est le point où le produit est en avance sur ses références comparées, et il n'y a
rien à y faire.

- **Approche** : **minimal-fonctionnel**.
- **Easing** : entrée `cubic-bezier(.2,0,0,1)` · sortie `ease-in` · déplacement `ease-in-out`
- **Durées** : micro 80 ms · court 160 ms · moyen 240 ms. **Rien au-dessus de 240 ms.**

La liste close de ce qui bouge est reconduite telle quelle (jauge déterminée, arrivée d'un asset,
annulation après suppression, repli de panneau, ouverture de fiche, ce qui paraît sans clic), ainsi
que **la règle qui la garde close** : *un mouvement n'entre dans la liste que si la chose qui arrive
n'a aucun autre moyen d'être remarquée.*

**Ce qui manque n'est pas du mouvement, ce sont des états.** L'auteur demandait « des retours
visuels » ; ce qui lui manque réellement est **ce qui s'affiche quand un appel part, quand il
revient, quand il rate, et quand la clé est absente** — cinq surfaces que l'audit du 31 août déclare
**jamais examinées**. Elles sont peu nombreuses et très visibles : *c'est ce qui se verra le plus
vite.*

---

## Comment ces valeurs ont été obtenues

Aucune couleur de ce document n'a été choisie à l'œil. Pour chacune, la teinte et la saturation sont
fixées et **la clarté est cherchée par dichotomie jusqu'à atteindre sa cible de contraste**, en
OKLCH, avec réduction automatique de la saturation quand la couleur sort de la gamme affichable.

Les contrastes sont donnés **deux fois** : en rapport classique (WCAG 2.1) et en **contraste
réellement perçu (APCA W3 0.1.9)**. Le second fait foi ; le premier n'est gardé que comme filet.

**La page `docs/design-preview-refonte.html` recalcule tout dans le navigateur**, sur les valeurs
réellement appliquées : le tableau de vérification qu'elle affiche n'est pas recopié, il est mesuré à
l'ouverture. **Elle porte aussi les quatre profondeurs de fond** — `ombre · bois · sable · lin` — et
c'est ainsi que la profondeur a été tranchée : en regardant, pas en discutant. `bois` est retenue.
`lin` était volontairement trop clair, pour borner.

---

## Ce que ce document ne tranche pas

1. **La nouvelle marque du point d'accroche d'une explication** — le soulignement lui est retiré. Ni
   un glyphe, ni une couleur. À trancher avant la première passe d'écran.
2. **Le geste dominant de l'établi** : *Fabriquer ce qui manque* ou *Poser les fichiers dans le
   dossier du jeu*. Personne d'autre que l'auteur ne sait lequel est l'aboutissement de son travail.
3. **Le budget de mots par écran**, sans lequel le plancher de 13 px alourdit ce qu'il éclaire.
4. **Les douze étapes des réglages du jeu** — lesquelles voir ensemble. C'est le seul défaut de
   l'audit encore ouvert, et aucune tranche du plan ne le porte.
5. **Cinq surfaces n'ont jamais été examinées** : le premier contact quand aucun jeu n'existe, la
   planche de pose, ce qui s'affiche quand un appel rate ou que la clé manque, ce que fait une
   génération pendant qu'elle tourne, et le comportement sur un écran plus petit.
6. **Le mot « fiche » nomme deux objets, et le chemin vers l'un des deux n'existe pas.** Trouvé par
   l'auteur le 4 septembre 2026 en relisant **le premier écran de la liste du vocabulaire**. Dans la
   galerie, on clique un asset et la colonne de droite s'appelle *la fiche*. Dans le codex, on clique
   un personnage et on n'arrive **pas** sur sa fiche : on arrive sur un écran qui porte son nom et
   qui sert à fabriquer des poses, avec dans la colonne de gauche **un morceau de fiche** et un lien
   minuscule vers *sa fiche*, *la vitrine* et *le calibrage*. **Ce n'est pas un mot à renommer, c'est
   une structure d'écrans à revoir** — et c'est très exactement *« aucun workflow ne se dessine
   visuellement »*, pris sur le fait.

### Et un défaut à réparer avant tout le reste

**`--color-signal-sourd` est déclaré dans le document d'avant et n'existe nulle part dans la feuille
de style**, alors que deux endroits de `Tables.tsx` l'emploient : **deux boutons actifs n'ont donc
aucun fond**, et c'est le motif que ce document range parmi les meilleurs du produit. Le même jeton
est annoncé pour l'anneau de focus, qui utilise en réalité l'accent plein. **Toute la thèse
« repeindre le produit coûte une ligne » repose sur l'idée qu'aucune couleur ne vit hors de la table
des noms — c'est le seul contre-exemple, et il est dans le sens le plus dangereux : un nom sans
valeur, qui ne lève aucune erreur.**

---

## Trois garde-fous mécaniques, pour que ça ne recommence pas

Le désordre d'aujourd'hui n'est pas venu d'un mauvais choix : il est venu de **l'absence de
barrière**. 259 boutons écrits à la main, 20 tailles de texte, 108 apparences. Remettre tout droit à
un instant donné ne sert à rien si la dérive peut reprendre au premier écran écrit vite.

1. **Une taille de texte hors des cinq autorisées** → refusée.
2. **Une couleur écrite en dur au lieu de passer par son nom** → refusée.
3. **Un bouton écrit à la main au lieu du composant partagé** → refusé.

Et une quatrième, plus ambitieuse et faisable : **le contraste minimal de toute marque au repos**.

C'est une demi-journée de travail, et cela protège des années.

---

## Motifs → `docs/design-motifs.md`

Les motifs transversaux — la tuile, l'emplacement, le grisé qui porte sa raison, la fente, le menu qui
sort du flux, les écrans un par un — vivent dans **`docs/design-motifs.md`**, qui a la même autorité
que ce fichier.

**Un motif ne redéfinit jamais un token** : il applique ce qui est décidé ci-dessus. En cas de
contradiction, les sections ci-dessus l'emportent.

> ⚠ **`docs/design-motifs.md` décrit le système d'avant — 4 septembre 2026.** Il portait déjà un
> retard sur la V2.1 ; il en porte un second sur cette refonte. Ses motifs restent utiles comme
> inventaire de ce que le produit fait, **et aucune de ses valeurs de couleur, de taille ou de hauteur
> ne fait plus foi**. Il se réécrit au fil des passes d'écran, pas avant.

---

## Decisions Log → `docs/design-decisions.md`

Le journal complet vit dans **`docs/design-decisions.md`**. Il ne tranche rien : il explique. On
l'ouvre pour rouvrir une décision, pas pour connaître le système.

**Toute décision nouvelle s'écrit là-bas**, en bas du tableau, y compris quand elle vient de
`/design-systeme`. Ne pas la réinstaller ici : c'est ce qui avait porté ce fichier à 140 Ko.
