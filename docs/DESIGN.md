# Asset Kitchen — Design System

> **Réécrit le 6 septembre 2026, d'après les planches de `docs/archive/pistes-2026-09-04/carnet/`.**
> L'auteur a tranché le même jour : *les maquettes font foi*. Ce document ne décide donc
> presque rien — il **relève** ce que les planches emploient déjà, et il ferme les listes.
>
> ⚠️ **Le dossier de planches grandit, et c'est normal** : une fonctionnalité neuve amène ses
> maquettes. Aucun chiffre de ce document ne dit *combien* il y en a — un compte écrit ici
> serait faux la semaine suivante, et il l'a été : le relevé portait sur 43 planches le matin,
> il y en avait 47 le soir. **Ce qui fait foi, c'est le dossier, pas son cardinal.** Une planche
> neuve n'oblige pas à rouvrir ce document ; elle l'oblige seulement à ne rien employer qui n'y
> soit pas.
>
> Le système d'avant — châssis chaud et sombre, *« mode clair : il n'y en a pas »* — est
> archivé dans `docs/archive/DESIGN-chassis-chaud-2026-09-04.md`. **Il décrit encore le code**
> tant que la tranche `B0` de `docs/PLAN-carnet.md` n'est pas livrée.
>
> Les décisions datées vivent dans `docs/design-decisions.md`, les motifs dans
> `docs/design-motifs.md`. Ce fichier ne les recopie pas.

---

## Comment ce document a été obtenu

Pas par consultation : par comptage. Toutes les planches du dossier ont été relevées, et les
valeurs retenues sont celles qu'elles emploient vraiment.

| Ce qui a été compté | Résultat |
|---|---|
| Couleurs employées, toutes planches | Les plus fréquentes sont **exactement celles que `Systeme.dc.html` déclare**, et dans le même ordre. La palette n'est pas une intention, elle est tenue |
| Polices | Trois, et trois seulement : Instrument Serif, Instrument Sans, IBM Plex Mono |
| Tailles de texte | 18 valeurs employées pour 9 déclarées. La liste déclarée fait loi, **plus une** : voir *Typography* |
| Arrondis | 10 valeurs employées pour 4 déclarées. La liste déclarée fait loi : voir *Layout* |
| Écarts (`gap`) | 14 valeurs employées pour 5 déclarées. La liste déclarée fait loi |

**Ce que ce comptage établit** : la couleur et la typographie du carnet sont un système ;
les arrondis et les écarts sont du dessin à la main. Les uns se reprennent tels quels, les
autres se referment.

### ⚠️ Et un second comptage, fait en fermant `D0`, a trouvé le trou inverse

Le premier comptage vérifiait que *ce que le document écrit, les planches l'emploient*. Il ne
vérifiait pas la réciproque, et c'est elle qui manquait : **huit couleurs de châssis employées
dans 21 à 40 planches n'étaient déclarées nulle part ici.** Pas du dessin à la main — les mêmes
huit, aux mêmes endroits, partout.

La cause tient en une phrase : **un signal n'est pas une couleur, c'est un trio** — un fond, un
trait, une encre. Le document n'en déclarait que le fond, si bien qu'un bandeau d'avertissement
n'était pas dessinable à partir de lui. Les deux autres manquantes sont l'encre d'un bouton et
l'encre *sur* le bouton rouille : sans elles, le bouton qui lance n'a pas de couleur de texte.

Puis le même comptage a été passé **sur le spécimen**, et il y a trouvé trois écarts de plus :
le damier n'avait pas de couleurs du tout — seulement une taille de carreau —, l'étiquette verte
se bordait d'une teinte que rien ne déclarait, et le bouton rouille écrivait en **blanc pur**
là où les planches écrivent `#fff8f4`. Corrigés : le spécimen ne contient plus une seule valeur
hors des listes de ce document, sur 415 éléments mesurés.

Les tables de *Color* sont complétées en conséquence. **C'est très exactement le défaut que la
dernière section de ce document dit avoir fermé par construction**, pris par l'autre bout : là,
une couleur déclarée et définie nulle part ; ici, une couleur employée et déclarée nulle part.
**Le garde-fou de `B0` doit refuser les deux sens**, et c'est le seul enseignement de `D0` qui
change une autre tranche.

---

## Product Context

**Précision du 11 septembre 2026.** Le produit est une application desktop de fabrication
d'assets pour un jeu développé avec un agent IA. L'auteur conserve l'identité graphique
décidée et autorise de nouvelles compositions pour améliorer l'UX. Le comportement relève
du PRD. La [maquette de l'atelier](maquettes-atelier-unifie/02-atelier.html), validée dans son
ensemble le 12 septembre 2026, fait référence pour la composition et les interactions.
Ses données fictives ne remplacent pas les services du produit ; les jetons et le spécimen
de ce document restent la référence visuelle. Pas de déclinaison mobile.

- **Quoi** : un atelier personnel de production d'assets 2D pour jeu vidéo. On définit
  l'univers d'un jeu une fois, puis on fabrique au cas par cas ses personnages, objets,
  décors, terrains, équipements et interface. Ce qui coûte se paie à l'image ; tout le reste
  tourne sur la machine, réseau coupé.
- **Pour qui** : un auteur seul, qui n'est pas développeur, qui fait son jeu et qui paie ses
  générations de sa poche.
- **Type** : outil de production, dense en données, employé des heures d'affilée.
- **Ce qu'on doit retenir en trois secondes** : *un carnet ouvert sur un établi.* On voit ce
  que le jeu contient, on voit ce qui manque, et rien ne coûte tant qu'on n'a pas appuyé sur
  le seul bouton rouille de l'écran.

---

## Aesthetic Direction

- **Direction** : éditorial sur papier. Une serif pour ce qui se lit une fois, des trames de
  lignes pour ce qui se lit tout le temps, et le vide comme seul séparateur à l'intérieur d'un
  panneau.
- **Décoration** : minimale. Aucune texture, aucun dégradé, aucune ombre portée. La seule
  texture du produit est le damier de transparence, et il veut dire quelque chose.
- **Mood** : un cahier de travail qu'on annote, pas un tableau de bord qui surveille.

### Le principe unique dont tout découle

**Le châssis est du papier ; l'image sort du papier et se juge sur une lumière neutre.**

C'est la seule décision structurelle du système, et elle résout la contradiction que le
produit portait depuis son premier jour.

- Le châssis — carnet, surface, volets, tables, boutons — est un papier chaud,
  `#f7f3ec`. Il ne prétend rien être d'autre qu'un support.
- **Derrière une image, et uniquement là, `#6c6c6c`** : un gris strictement neutre, à 15 % de
  réflectance, la valeur que la norme de jugement d'image demande. Cette surface ne change
  jamais, ni avec le thème, ni avec le jeu ouvert, ni avec l'écran.

Le système d'avant tenait qu'un fond clair faussait le contraste perçu d'un sprite. **Cette
phrase avait déjà été retirée le 4 septembre 2026, et pour la raison inverse** : c'est
l'entourage *sombre* qui abaisse le contraste perçu — effet Bartleson-Breneman —, et le
damier de l'atelier était à 1,08 % de réflectance quand la norme en demande 10 à 20. L'atelier
poussait l'auteur à surcontraster ses sprites, et il ne s'en apercevait qu'une fois l'image
dans le jeu.

Ce qui survit de l'ancienne règle : **un châssis chaud entre en concurrence avec les verts,
les bruns et les ors du pixel art.** C'est vrai du papier comme il était vrai du bois. C'est
exactement pour ça que le pourtour de l'image est neutre et ne l'est qu'à cet endroit.

---

## Color

**Approche** : retenue. **Trente-deux valeurs, liste fermée**, et rien d'autre n'entre. Le
nombre paraît grand ; il ne l'est pas, parce que onze d'entre elles ne sont que **trois signaux
déclinés en trio** — fond, trait, encre —, trois de plus l'étiquette, deux les encres de
contrôle et deux les carreaux du damier. **Trois teintes seulement portent un sens**, et ce sont
elles qu'on retient : le rouille, le vert, le rouge sombre.

### Le papier

| Jeton | Valeur | Où |
|---|---|---|
| `--papier` | `#f7f3ec` | le fond général de la surface |
| `--papier-cote` | `#f2ede4` | le carnet, le volet — ce qui borde |
| `--carte` | `#fffdfa` | une carte, un champ, une case posée sur le papier |
| `--ligne-ouverte` | `#e6dfd2` | la ligne du carnet actuellement dépliée |
| `--pourtour` | `#6c6c6c` | **derrière une image, et nulle part ailleurs** |
| `--damier-clair` | `#ece7dc` | le damier — carreaux de **14 px**, et il dit *transparent*, jamais décoratif |
| `--damier-sombre` | `#e4dfd4` | l'autre carreau du même damier |

⚠️ **Le damier a deux valeurs, et elles étaient tues.** La version d'avant écrivait *« carreaux
de 14 px »* sans dire de quelle couleur, ce qui n'est pas dessinable ; le spécimen, faute de
mieux, avait gardé le gris de l'ancien système sombre — `#cfcfcf` sur `#b6b6b6`, deux valeurs
qui n'existent nulle part dans le carnet. Les deux ci-dessus sont celles des planches.

### Les traits

| Jeton | Valeur | Où |
|---|---|---|
| `--trait-faible` | `#ece6db` | une séparation qui ne promet rien |
| `--trait` | `#e2dbd0` | le trait courant, le cadre d'un panneau |
| `--contour` | `#ddd5c8` | **le contour de ce qui réagit** — bouton, champ, onglet |
| `--pointille` | `#c9c2b6` | le pointillé d'un vide, d'une zone à remplir |

**À l'intérieur d'un panneau, on groupe par le vide.** Le trait sépare des panneaux, pas des
lignes.

### Les encres

| Jeton | Valeur | Où |
|---|---|---|
| `--encre` | `#221f1b` | un titre, le nom d'une chose |
| `--encre-2` | `#4e483f` | la phrase, le texte courant |
| `--encre-3` | `#6d675e` | l'étiquette, la précision sous une pièce |
| `--encre-4` | `#948c80` | un compteur, une entête de section |
| `--eteint` | `#b0a89b` | ce qui est grisé — **et la raison est écrite à côté** |
| `--encre-controle` | `#3d382f` | **le texte d'un bouton, d'un champ, d'une ligne du carnet** |
| `--encre-sur-signal` | `#fff8f4` | le texte **sur** le bouton rouille, et le galet d'une bascule |

**Les deux dernières sont des encres de contrôle, pas de lecture.** Un bouton n'écrit pas dans
la même encre qu'un titre : `#3d382f` se tient entre `--encre` et `--encre-2`, et c'est ce que
les planches emploient sur tout ce qui réagit. Sans `--encre-sur-signal`, le bouton qui lance
n'a pas de couleur de texte du tout.

### Les trois signaux

| Jeton | Valeur | Ce qu'il dit |
|---|---|---|
| `--signal` | `#a8492c` | *ce qu'on fait, ce qui coûte* — le rouille |
| `--ok` | `#5c7a52` | *ce qui est fait, ce qui est gratuit* |
| `--echec` | `#8a3f33` | *ce qui a raté* |

**Le rouille ne sert qu'à deux choses : le bouton qui lance, et le chiffre qui coûte.** Un
seul bouton rouille par écran. Partout ailleurs, il ment.

### Un signal qui se pose est un trio, jamais une couleur seule

Un bandeau, une pastille, un champ en faute : les planches leur donnent toujours **un fond, un
trait et une encre**, et les trois vont ensemble. Écrire le fond sans le trait donne une
pastille qui bave sur le papier — les deux sont trop proches en clarté pour se séparer seuls.

| Ce que ça dit | Fond | Trait | Encre |
|---|---|---|---|
| **un raté** | `--fond-echec` `#f8ece9` | `--trait-echec` `#dcbcb2` | `--echec` `#8a3f33` |
| **un avertissement** | `--fond-attention` `#f4ece2` | `--trait-attention` `#e0cfb8` | `--encre-attention` `#8a5a2c` |
| **un oui** | `--fond-ok` `#eef1ea` | `--trait-ok` `#cfd9c8` | `--encre-ok` `#4c6644` |

⚠️ **`--ok` et `--encre-ok` ne sont pas la même couleur, et c'est voulu.** `#5c7a52` est le vert
qu'on emploie *sur le papier* — une coche, un mot « gratuit ». `#4c6644` est plus sombre parce
qu'il s'écrit sur `#eef1ea` et non sur `#f7f3ec`. Les confondre rend un des deux illisible.

⚠️ **Et `--fond-ok` vaut `#eef1ea`, pas `#e4ecdf`.** La version d'avant déclarait `#e4ecdf`, qui
est autre chose : le fond d'une **étiquette** verte, une pièce plus petite et plus saturée qu'un
bandeau. Les deux existent, et se sont confondus parce qu'ils se ressemblent.

L'étiquette a donc son propre jeu, et il est **le seul de ce document qui ne soit employé que
par `Systeme.dc.html`** — aucun écran ne s'en sert encore. Il est déclaré pour que le premier
qui en aura besoin ne l'invente pas :

| Jeton | Valeur | Où |
|---|---|---|
| `--etiquette-fond-ok` | `#e4ecdf` | le fond d'une étiquette verte |
| `--etiquette-encre-ok` | `#45613b` | son texte |
| `--etiquette-fond-echec` | `#f4e2dc` | le fond d'une étiquette rouge |

Son texte à elle est `--echec`, déjà déclaré. Une étiquette neutre est `--trait-faible` sur
`--encre-2`, tous deux déclarés plus haut.

### Mode sombre

Il n'y en a pas, et c'est une décision — la symétrique de celle qu'on vient de retirer. Un
produit qui doit rendre un jugement de couleur fiable n'offre pas deux entourages : le
pourtour de l'image serait le même dans les deux, et tout le reste changerait autour de lui,
ce qui est exactement la condition qui fausse le jugement.

### Deux trous, et ils sont réels

Le comptage les a trouvés, les planches ne les couvraient pas. **Les deux sont fermés depuis le
11 septembre 2026**, par la tranche qui a porté la toile au papier (`D2`) — l'historique reste
écrit parce que c'est lui qui explique les valeurs.

1. ~~**Il n'y a pas de couleur pour *réglé à la main*.**~~ **Fermé le 11 septembre 2026
   (`D2`), et sans quatrième signal.** Le produit a la notion : un asset porte un champ
   `epingle`, et l'ancien système lui donnait une couleur à lui. Elle est reprise par le
   **trio d'attention** — `--fond-attention`, `--trait-attention`, `--encre-attention` —, qui
   était déjà déclaré et qui dit exactement la même chose : *ceci a été touché à la main, et ce
   n'est ni une réussite ni un échec*. La marque reste donc une couleur, et la liste des
   signaux ne bouge pas.
2. ~~**Les dix teintes d'îlot de la toile ne sont pas dans les planches.**~~ **Fermé le
   11 septembre 2026 (`D2`).** Les dix d'avant avaient été choisies pour un fond presque noir.
   Le principe s'est retourné plutôt que changé : elles sont maintenant **plus sombres que le
   papier**, toutes les dix à 4,6 : 1 sur `--papier` — donc le nom d'un îlot s'écrit dessus en
   `--papier`, à ce même contraste, et les dix ne se distinguent plus que par leur teinte et
   leur saturation. Leur teinte et leur saturation viennent des onze pastilles du menu d'îlot
   de `Toile.dc.html`, qui les dessine ; seule leur clarté est calculée. Les valeurs sont dans
   `interface/src/index.css`.

---

## Typography

Trois familles, et c'est un système de rôles, pas de goût : **une serif pour ce qui se lit
une fois, une sans pour ce qui se lit tout le temps, une chasse fixe pour tout ce qui se
compte.**

| Rôle | Police | Pourquoi celle-ci |
|---|---|---|
| Titres | **Instrument Serif** | c'est celle de toutes les planches, et elle ne descend jamais sous 25 px, où le produit lui donne raison : en dessous elle se confond avec la sans |
| Texte | **Instrument Sans** | la même famille de dessin que la serif, donc les deux ne se disputent pas |
| Mesures | **IBM Plex Mono** | ce que les planches importent. Le produit livre aujourd'hui JetBrains Mono : le changement est d'une ligne |

**Chargement : auto-hébergé, jamais tiré du réseau.** Ce n'est pas une préférence, c'est un
invariant du produit — *tout ce qui ne demande pas le fournisseur fonctionne réseau coupé*.
Les planches emploient l'adresse de Google Fonts parce que ce sont des documents autonomes ;
l'application ne le peut pas.

### L'échelle — liste fermée

| Police | Tailles | Emploi |
|---|---|---|
| Serif | **52** / 1.02 · **38** / 1.05 · **25** / 1.15 | titre de planche · titre d'écran · nom du jeu |
| Sans | **15** / 1.55 · **14** · **13.5** · **13** · **12.5** · **12** | chapô · ligne du carnet · courant et boutons · précision |
| Mono | **12** · **11.5** · **11** · **10.5** (+.14 em, majuscules) | compte, prix, taille · entête de section |

**La serif ne descend jamais sous 25.** **Rien ne descend sous 10.5.**

Le comptage a trouvé dix-huit tailles employées, dont 9.5, 9 et 8. Ces trois-là appartiennent
au **texte de commentaire qui entoure les écrans dans les planches**, pas aux écrans — les
planches sont des documents, pas des captures. Elles sont refusées.

**La seule taille ajoutée à la liste déclarée est 11.5**, et elle est ajoutée parce que la
mesure l'impose : les six planches d'atelier de retouche l'emploient 280 fois, dans leurs
tables de réglages. Refuser une taille employée à ce point aurait décrit un système que le
dessin ne suit pas.

⚠️ **Ce que ce plancher coûte, et il faut le savoir avant de dessiner.** Le relevé du
4 septembre 2026 avait fixé un plancher à 13 px, après avoir compté que 526 déclarations sur
732 étaient à 10 px ou moins et que 94 % du texte du produit tenait dans une bande de 4,5 px.
Le carnet redescend à 12.5, et ses tables d'atelier à 11.5. **La densité des ateliers est donc
payée en taille de texte, et c'est le premier endroit où regarder si la lisibilité redevient
un grief.**

---

## Spacing

- **Base** : 2 px, parce que la moitié des écarts du carnet sont impairs.
- **Densité** : compacte. C'est un outil de production, pas une page.
- **Les seuls écarts** : **4 · 8 · 14 · 22 · 34**. Liste fermée.
- **Marges de la surface** : 30. **Gouttières** : 14.

Le comptage trouve quatorze valeurs employées, de 2 à 20. C'est du dessin à la main : aucune
ne domine, aucune ne porte de sens. La liste déclarée l'emporte, et un écran qui en réclame
une seizième est un écran mal découpé.

### Hauteurs de contrôle — liste fermée

**34 · 30 · 26 · 22**, et le champ de prompt à **54** parce que c'est une zone de saisie et
non une bande.

Un bouton et un champ font tous les deux **34** — c'est ce que les planches montrent, et c'est
dérivé et non choisi : une ligne de 13 px avec son interligne de 18, plus 8 px de garde de
chaque côté.

### Largeurs de colonne — liste fermée

**240** la navigation de l’atelier unifié, **76** quand l’auteur la replie ·
**300** le carnet historique · **380** le volet (fixe, se ferme, ne se rétrécit
jamais) · **880** la barre (un plafond, pas une largeur : elle se centre et rétrécit sous
lui) · **128** ses sœurs (fixe, une vignette de front) · la surface prend le reste.

Les dimensions 240/76 reprennent le châssis desktop approuvé le 12 septembre 2026.
Le repli reste explicite, sans être déclenché par l’ouverture d’un outil ; ses jetons sont
`--spacing-navigation-atelier` et `--spacing-navigation-repliee`.

Le plafond de 880 est entré avec `B6`, relevé sur `Barre.dc.html`. Ce n'est pas une colonne : la
barre se pose **par-dessus** les deux autres et ne partage la grille avec personne. Elle est
dans cette liste parce que c'est la seule largeur fixe que le produit écrive en dehors du
châssis, et qu'une valeur non déclarée est une valeur qu'on réinventera un peu différente au
prochain écran.

La quatrième est entrée avec `B24`, relevée sur la colonne « ses sœurs » de `Retouche.tsx`.
Ce n'est ni le carnet ni le volet : c'est une colonne qui ne montre qu'une vignette de large,
son cadre de sélection et rien d'autre, jamais une liste de texte ni un réglage. 300 y aurait
laissé la moitié de la colonne vide ; 380 plus encore. Une largeur aussi étroite et aussi
particulière se déclare, sans quoi le prochain écran à vignette unique en invente une autre.

### Largeurs de petit contrôle — liste fermée

**70**, la mollette d'opacité du témoin « par-dessus » (`B24`, `Retouche.tsx`). Ce n'est ni un
écart ni une colonne : c'est un curseur qu'on tire au doigt, et il doit rester assez long pour
se régler sans trembler. Rien dans les listes ci-dessus ne s'en approche sans se voir — 54 s'y
traîne, 300 dévore la barre d'outils.

### Vignettes — liste fermée

**81**, la vignette d'une animation ou d'une tenue sur la page d'un sujet (19 septembre 2026).
Elle était à 54 ; agrandie d'une fois et demie pour que le pixel art se lise sans ouvrir l'image.

---

## Layout

**Approche** : grille disciplinée. Trois colonnes, toujours les mêmes largeurs.

```
┌──────────┬──────────────────────────────┬────────────┐
│ le carnet│         la surface           │  le volet  │
│   300    │  le reste · marges 30        │    380     │
│  fixe    │  gouttières 14               │  se ferme  │
└──────────┴──────────────────────────────┴────────────┘
```

### Les quatre présentations, et la cinquième est interdite

La surface ne prend que quatre formes. Un écran neuf est l'une des quatre.

| La forme | Ce qu'elle montre |
|---|---|
| **une page** | une seule chose, et tout ce qu'on en sait |
| **une matrice** | des choses en lignes, des états en colonnes — on voit les trous |
| **une planche** | une grande image qu'on découpe, qu'on retouche, qu'on assemble |
| **une table** | des lignes qu'on trie et qu'on compte |

**Deux écrans seulement prennent la fenêtre entière** : l'ouverture, et le parcours de
création d'un jeu.

### Arrondis — liste fermée

**5 · 7 · 8 · 10**.

Le comptage trouve dix valeurs, de 1 à 10, sans qu'aucune domine — 9 px est même la plus
fréquente et n'est pas dans la liste déclarée. C'est du dessin, pas un système : la liste
déclarée l'emporte, sans quoi il n'y a pas de liste du tout.

---

## Les onze pièces

Onze, et rien de plus. Un écran qui en réclame une douzième est un écran mal découpé.

| La pièce | La règle |
|---|---|
| **Les boutons** | un seul rouille par écran. Hauteur 34 |
| **Les champs** | hauteur 34, comme les boutons |
| **Les réglages** | la valeur se lit **à droite**, toujours |
| **Les onglets** | quatre au plus — au-delà, c'est le carnet qui doit s'en charger |
| **Les lignes du carnet** | trois états, pas quatre |
| **Les étiquettes** | jamais cliquables |
| **Les vignettes** | le damier dit *transparent*, le gris dit *pas encore détouré* |
| **Les bandeaux** | au-dessus de ce qu'ils concernent, **jamais flottants** |
| **Le vide** | une phrase, un geste, rien d'autre |
| **L'attente** | le temps qui reste, **jamais un pourcentage** |
| **Les compteurs** | chasse fixe, alignés à droite |

---

## Les six règles

Six phrases qui décident à notre place quand un écran hésite.

1. **Cliquer ne coûte jamais.** Seul un bouton rouille dépense. Ouvrir, trier, découper,
   retoucher, exporter : gratuit, et on peut le refaire.
2. **Le grisé porte sa raison.** Un bouton éteint dit à côté de lui pourquoi il l'est, et
   donne le geste qui le rallume. Jamais une infobulle.
3. **L'échec arrive au moment où on génère.** Pas à l'ouverture d'un écran. Une clé manquante
   ne barre rien tant qu'on ne demande rien.
4. **Une seule ligne du carnet est ouverte.** En ouvrir une referme l'autre. Fermé, le carnet
   tient en dix lignes.
5. **Un chiffre affiché est un chiffre compté.** Pas d'à-peu-près, pas de « plusieurs ». Si on
   ne sait pas compter, on n'affiche pas.
6. **Rien ne se perd sans être dit.** Une liste coupée dit qu'elle est coupée. Un import raté
   se nomme. Un fichier écarté reste écarté, pas effacé.

---

## Motion

Assez pour comprendre d'où vient ce qui apparaît. Pas assez pour attendre.

| Durée | Pour quoi | Comment |
|---|---|---|
| **120 ms** | survol, appui, coche | la couleur seule change |
| **180 ms** | une ligne du carnet s'ouvre | la hauteur, et rien d'autre |
| **220 ms** | un volet entre ou sort | il glisse depuis son bord |
| **220 ms** | une image arrive dans une grille | elle apparaît sur place, sans grandir |
| **aucune** | changer de surface | l'écran est là, tout de suite |

Quatre durées, et une absence. Rien d'autre n'entre.

---

## L'écriture

**Il fait foi sur les mots, et la maquette ne le révise pas.** Remonté du dossier des pistes le
13 septembre 2026 : un document qui gouverne ne vit pas dans `archive/`. La maquette de
l'atelier unifié écrit *asset* à plusieurs endroits ; la liste noire ci-dessous l'interdit, et
c'est elle qui l'emporte — voir `docs/PLAN-remise-a-plat.md` § *Les trois décisions*.

Le vocabulaire fermé de `docs/vocabulaire.html` s'applique partout : écrans, menus, guide,
messages d'erreur. Un mot de la liste noire ne s'écrit pas, et ce qui n'a pas de mot dans la
liste ne se dit pas — c'est la liste qu'on modifie d'abord, pas l'écran.

Deux exceptions gardées, parce qu'elles n'ont pas d'équivalent employé : **prompt** et
**frame**.

Une phrase dit la conséquence, jamais la règle. *« Décoche une case et elle n'entre pas en
bibliothèque »*, pas *« les cases décochées sont exclues de l'import »*.

---

## Ce que ce document ne tranche pas

Six points restent ouverts. Les cinq premiers se posent avant l'écran qui en dépend ; le sixième
est une dette de renvois, et il se solde dans `B0`.

1. **La couleur de *réglé à la main*** — voir *Color*, deux trous.
2. **Les dix teintes d'îlot sur papier** — voir *Color*, deux trous.
3. **La serif n'a pas de gras, et n'en aura pas.** Instrument Serif n'existe qu'en romain et
   italique d'un seul poids ; le produit s'en est déjà trouvé bloqué une fois, et c'est ce qui
   avait fait choisir Fraunces le 4 septembre. Dans le carnet la serif ne sert qu'aux titres,
   jamais sous 25 px, donc la contrainte ne mord pas. **Le jour où un titre gras est
   nécessaire, il n'y en a pas.**
4. **`docs/design-motifs.md` décrit encore l'ancien système** — 1 852 lignes écrites pour un
   châssis sombre. Il se reprend motif par motif, pendant `B0`, pas avant.
5. **Le commentaire en tête de `interface/src/index.css`** porte encore la phrase retirée sur
   le fond clair. Il se corrige dans `B0`, avec le reste du fichier de style.
6. **Dix-sept renvois pointent vers des sections de ce document qui n'existent plus** — treize
   depuis le code, quatre entre documents —, et `py essais/essai_docs.py` les nomme un par un.
   Ils visent *les teintes d'îlot*, *sur la toile*, *un panneau est borné par l'écran*, *les
   interrupteurs* : des sections de systèmes antérieurs. **Seize étaient déjà cassés avant le
   6 septembre 2026** et un l'a été par la réécriture du matin ; aucun ne l'a été en fermant
   `D0`. ⚠️ **Un renvoi cassé ne lève aucune erreur — il ment en silence**, et celui de
   `interface/src/index.css:31` renvoie à la palette d'îlots, qui est justement l'un des deux
   trous ouverts. Ils se réparent dans `B0`, en même temps que la feuille de style qui les
   porte.

---

## Un défaut d'avant, fermé par construction

`--color-signal-sourd` était déclaré dans le document de design et **défini nulle part dans la
feuille de style**, alors que deux boutons actifs de l'écran des tables l'employaient : ils
n'avaient aucun fond, et rien ne levait d'erreur. La table de jetons ci-dessus est écrite de
zéro et ne le contient pas.

Le garde-fou qui empêche que ça recommence est écrit dans `docs/design-decisions.md` du
4 septembre 2026, et il tient toujours : **une vérification refuse le code qui écrit une
couleur en dur au lieu de passer par son nom, une taille hors de la liste, ou un bouton écrit
à la main au lieu du composant partagé.** Elle se pose dans `B0`.

⚠️ **Et `D0` lui a ajouté une moitié qui manquait.** Le garde-fou ci-dessus ne regarde que dans
un sens : *ce que le code écrit est-il déclaré ?* Il ne demande jamais *ce qui est déclaré
est-il défini, et ce qui est employé est-il déclaré ?* — et c'est par là que le carnet a fui :
huit couleurs de châssis employées dans 21 à 40 planches n'étaient nulle part dans ce document,
parce qu'un signal y était écrit comme une couleur alors que le dessin en fait un trio.

**Le contrôle de `B0` se fait donc dans les deux sens**, et il est peu coûteux : d'un côté
refuser une valeur du code absente de la liste, de l'autre lister les valeurs de la liste que
rien n'emploie. La seconde moitié ne refuse rien — elle rend un compte. Un jeton que personne
n'emploie est soit une pièce pas encore dessinée, soit un jeton mort, et seul un humain sait
lequel.

---

## Motifs → `docs/design-motifs.md`

## Journal des décisions → `docs/design-decisions.md`
