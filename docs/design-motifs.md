# Asset Kitchen — Motifs

Annexe de `docs/DESIGN.md`, dont elle a l'autorité : **à quoi ça ressemble**. Les tokens, la
typographie, la couleur, l'espacement, la mise en page et le mouvement vivent dans
`docs/DESIGN.md` ; ce fichier-ci ne porte que les motifs transversaux, et un motif ne
redéfinit jamais un token.

**À lire quand on touche à un écran**, pas au démarrage d'une session. `docs/DESIGN.md`
suffit à connaître le système ; c'est ici qu'on vient quand on dessine une tuile, un menu,
une fente ou un état grisé.

---

## Motifs

Les motifs transversaux qui *sont* le design — chacun est une décision d'apparence ; le
comportement qu'ils rendent visible est tranché par `docs/PRD.md`.

### La tuile

L'objet central du produit. Structure fixe : zone image carrée sur damier alpha, pied à deux
lignes — nom (11,5 px sans, tronqué) puis méta (9,5 px mono : `64×64 · 4 px · $0,067`).

**Le dernier morceau de la méta dit ce que l'image a coûté, et « gratuit » y est un mot**
(F2). Un montant chez un fournisseur qui facture, le mot `gratuit` chez un fournisseur qui
n'en demande pas — jamais `$0,0000`, qui se lit *sans limite* là où il faut lire *sans prix*.
La tuile ne porte que celui des deux ; ce que l'image a **consommé** — `1 jeton` — se lit sur
sa fiche, où il y a la place de le dire avec son unité. Et un zéro en argent reste un zéro en
argent : une découpe de planche n'a rien coûté seule, elle a été payée en amont, et elle
continue d'écrire `$0,0000`.

| Marque | Forme | Ce qu'elle porte |
|---|---|---|
| **Coin plein** haut-droit, `--signal`, 13 px | triangle | favori — **la seule marque visuelle**, parce que c'est la seule que l'auteur pose lui-même |
| **Anneau** `--lumiere` 2 px | box-shadow externe | sélectionné — la lampe de la table |
| **Pastille** mono 8,5 px, fond `rgba(11,13,16,.82)` | texte | un état subi : `réglé`, `agent`, `parent supprimé` |

La hiérarchie est volontaire : ce que tu poses est une forme, ce que le système constate est un
mot. Aucune couleur supplémentaire n'entre dans la grille.

### Le grisé porte sa raison — jamais une infobulle

Un contrôle indisponible est rendu en `--texte-3` sur `--fond-2`, bordure `--bord`, et **une ligne
sœur permanente** juste dessous : mono 10 px, `--texte-3`, précédée d'un tiret de 8 px, avec un
lien en `--signal` quand il y a un endroit où aller.

```
[ Générer ]
 — aucune clé OpenRouter — Réglages ›
```

La raison n'est jamais au survol : le produit interdit de proposer puis refuser, l'apparence doit
donc dire pourquoi sans qu'on ait à chercher. Même traitement pour un modèle du catalogue qui ne
peut pas honorer la demande, un niveau de zoom trop grand pour la largeur, la quantification sans
palette, et l'export d'une sélection vide.

**Dans une barre de 38 px, la ligne sœur se pose à côté et non dessous.** La forme ne change pas —
tiret de 8 px, mono 10 px, `--texte-3` — seule la direction change, parce qu'aucune hauteur neuve
n'est disponible là (§ Spacing). C'est déjà ce que fait `— 4× ne tient pas ici` ; l'export grisé de
la barre d'outils est le second locataire de cette variante, et les deux ne cohabitent jamais avec
un troisième.

### Le revers — l'actif qui porte son risque

Le repli hors ligne est le **seul endroit du produit où l'on propose puis refuse** : le catalogue
est une photo, générer reste actif, et l'échec ne survient qu'au moment du clic (`docs/user-stories.md`
US-95). C'est donc l'exception au motif ci-dessus, et elle se rend **dans la même fente, avec la
même forme** — tiret de 8 px, mono 10 px, lien `--signal` pour le geste. Ce qui change est le
mot : le grisé dit *pourquoi c'est fermé*, le revers dit *ce qui va casser*.

**Où ça se pose : dans une fente qui existe déjà.** Aucun bandeau, aucune rangée, aucune hauteur
neuve sur une colonne qui compte 44 px en tête et 26 px en pied. Sous le bouton Générer, alignée
à droite, il y a une ligne mono 10 px qui a déjà deux locataires : `Ctrl + Entrée` au repos, et la
raison quand générer est grisé. **Le repli est le troisième, et les trois ne coexistent jamais.**

*Un quatrième est entré le 31 août 2026 — `Générer encore ›`, pendant qu'un lot est en route. Il
ne change rien à l'ordre ni à la règle : le refus l'emporte toujours, et jamais deux à la fois.
Voir § Le bouton qui paie porte l'état de ce qu'il a payé.*

```
   au repos                                    [ Générer 3 variations ]
                                                         Ctrl + Entrée

   hors ligne                                  [ Générer 3 variations ]
                                    — seul générer échouera   Réessayer ›

   jamais reçu                                         [ Générer ]
                             — le catalogue n'a jamais été reçu   Réessayer ›
```

**La fente prédit, elle ne raconte pas.** Elle porte deux choses — **ce qui échouera** et **le
geste** — plus, dans un seul mot, **ce qui marche encore** : `seul` borne la panne, et une panne
bornée dit son complément. Coût assumé : « écrire, régler, choisir un modèle » n'est pas écrit en
toutes lettres. Le champ prend le texte, le panneau répond, la bibliothèque est là — l'écran le
démontre pendant qu'on le lit, et § *Ce que le design n'affiche pas* a déjà tranché qu'une
décision peut être respectée sans être affichée.

**La date, elle, n'est pas dans la fente — et c'est une correction.** Elle y a été posée le
27 août, puis retirée le jour même : à l'ouverture de l'atelier le prompt est vide, donc le refus
« aucun prompt » occupe la fente, donc la date n'était lisible **nulle part tant que l'auteur
n'avait pas tapé un caractère**. Or c'est exactement au démarrage que le catalogue doit dire son
âge (US-93, et le critère T1 « le démarrage n'affiche aucune erreur, le catalogue affiche sa date
en clair »).

La règle qui l'a corrigée est celle du motif lui-même : **une date est un fait sur le monde, pas
sur le clic à venir.** Elle vit donc dans la barre d'état, seul élément rendu en permanence. Et
cette répartition rend l'ordre des trois locataires *juste* plutôt que subi : tant que la demande
n'est pas composée, le refus tient la fente, et il n'y a aucune prédiction à faire puisqu'il n'y a
pas encore de geste possible.

**Variante — catalogue jamais reçu.** Aucun modèle, donc générer redevient grisé, donc c'est le
motif ordinaire qui reprend la main, dans la même fente, sans machinerie supplémentaire et sans
rien d'autre à dire : il n'y a pas de date à porter, et rien qui marche encore à nuancer. La barre
d'état se tait alors sur le catalogue — elle n'a rien à dater — et dit seulement `hors ligne`.
Que la fente passe du revers au grisé selon le nombre de modèles revenus est **la preuve de
l'emplacement** : un seul fait, « le catalogue n'est pas frais », une seule fente, deux mots selon
la gravité. Deux traitements à deux endroits, c'est ce que le bandeau imposait.

**Deux altitudes, deux métiers, une seule occurrence de « hors ligne ».** La barre d'état (26 px)
porte **l'état du monde**, en permanence, qu'on la regarde ou non : le point `--epingle`, la
phrase de liaison, **la date** de la photo servie, et — quand le port a su la dire en français —
**la cause**. Elle ne prédit jamais.

```
 ● hors ligne · catalogue du 26/08 14:02 · aucune connexion au fournisseur · 2 modèles
```

**La clé a quitté cette barre le 31 août 2026** (E19). Elle y figurait en dernier segment, et
elle est montée dans la **barre du haut** : elle était alors le seul préalable dur du produit,
elle se lit à la seconde zéro d'une installation neuve, et l'écrire aux deux endroits aurait
fait deux endroits à tenir d'accord pour une seule valeur. Ce n'est pas une exception au
paragraphe ci-dessus — c'est le même raisonnement, appliqué à un fait qui compte avant qu'on
ait cliqué quoi que ce soit.

**Et elle y parle au pluriel depuis F3**, le 1<sup>er</sup> septembre 2026. Le segment disait
`clé …a41c` ou `aucune clé` ; il dit maintenant **avec quoi on peut produire** — `2
fournisseurs prêts`, `1 sur 2`, et `rien pour produire` dans le cas qui n'arrive plus. C'est
un renversement de ce que la barre annonce, pas un changement de mots : elle décrivait *ce qui
manque*, dans un monde où un seul manque suffisait à tout éteindre ; il en manque désormais un
sur deux et une image part quand même. **Ce qui n'est pas prêt reste un bouton** et mène au
tiroir, en portant sa raison ; ce qui l'est n'en est plus un — un contrôle qui n'ouvre sur
aucun geste utile est un contrôle de trop.

**Chacun de ces trois faits est un segment à lui**, et c'est ce qui les rend robustes : la phrase
de liaison est disputée — une génération refusée ou un flux rompu la prennent, et à juste titre,
c'est plus grave. Fondre la date dedans la ferait disparaître au moment où elle compte le plus.
La date et la cause survivent donc à la phrase, et la couleur du point suit la chose la plus grave.

La fente sous Générer porte **la conséquence pour le prochain geste**, et seulement hors ligne ;
elle ne raconte jamais l'état du réseau. Le doublon d'avant — le bandeau et la barre d'état
disaient « hors ligne » dans les mêmes mots — n'était pas une redondance voulue mais un
symptôme : deux éléments qui disent la même chose à deux altitudes, et aucun des deux n'est
l'autorité.

**La cinquième chose, et pourquoi elle est en bas.** Le port traduit toute panne de transport en
une phrase du produit — « aucune connexion au fournisseur », « le fournisseur n'a pas répondu à
temps ». C'est une information réelle : elle dit à l'auteur si c'est son réseau ou celui d'en face.
Mais ce n'est **pas** une conséquence du prochain clic, donc elle ne monte pas dans la fente : elle
reste en bas, en `--texte-3`, dans la bande qui rapporte l'état du monde.

Le bouton **Catalogue** de la barre de tête reste : c'est le geste permanent, disponible en ligne
comme hors ligne. `Réessayer ›` n'en est pas un doublon mais la règle du motif — *un lien
`--signal` quand il y a un endroit où aller* — appliquée là où la panne est nommée. Un nom, un
verbe : on rafraîchit un catalogue, on réessaie une panne.

**Une seule voix par bande.** La fente sous Générer, le pied de prompt, la méta de tuile et la
barre d'état sont en **mono de bout en bout, phrases comprises** — pas seulement leurs mesures. Ce sont
les bandes où la machine rapporte ; le sans est ce que l'auteur écrit et choisit. Corollaire de la
règle 2 du § Typography, et raison pratique : accorder deux familles sur une ligne de 10 px coûte
plus qu'il ne rapporte.

**La couleur : `--epingle`, pas `--info`.** Les trois usages d'`--epingle` — réglé à la main,
interrompu, catalogue de repli — partagent une définition : *arrêté à un instant, que le système
ne bougera pas tout seul, et que seul un geste de l'auteur relance*. C'est mot pour mot l'invariant
« rien n'est jamais relancé automatiquement ». `--info` `#7E8AA0` échouait deux fois : à 10 px il
ne se distingue pas de `--texte-2` `#98A2AC`, donc il ne lit pas comme une couleur ; et c'est un
bleu-gris posé à côté du cyan, ce qui coûte à l'accent son exclusivité. Il est retiré (§ Color).
Les deux emplois du jaune restent **hors de la grille** — le pied de l'écran, et la bande de
prompt au-dessus des tuiles — donc ce point chaud n'est jamais posé à côté d'un sprite.

**Rien ne bouge.** L'apparition n'entre pas dans la liste close du § Motion : le fragment arrive
dans la seule couleur chaude du châssis, il n'a pas besoin d'un fondu pour se faire voir. Et
l'état peut battre plusieurs fois dans une séance — un fragment qui entre et sort en fondu dans
une bande relue avant chaque clic devient un clignotement. Seule s'applique la tolérance générale
du § Motion : 80 ms de transition de couleur sur le point de la barre d'état, `--ok` →
`--epingle`.

### Le bouton qui paie porte l'état de ce qu'il a payé

Écrit le 31 août 2026, sur un second signalement de l'auteur, le lendemain du premier :
*« je voudrais vraiment un retour très visuel qui fait comprendre qu'on n'a pas besoin de
rappuyer sur générer »*. La correction de la veille avait posé le compte dans la fente ; c'était
trop peu, et l'échec dit pourquoi mieux que n'importe quel principe.

> **Une fente ne peut pas contredire le contrôle qui est au-dessus d'elle.**

Trois raisons s'additionnaient, et seule la deuxième est la cause :

- la fente est **à la place, à la taille et sur la ligne de `Ctrl + Entrée`**, que l'œil a appris
  à lire comme du décor. Dix pixels qui changent de couleur ne se relisent pas ;
- **le bouton, lui, ne changeait pas.** On cliquait *Générer*, et *Générer* revenait identique,
  plein, disponible. Il disait « il ne s'est rien passé » plus fort que la ligne d'en dessous ne
  disait le contraire ;
- **le résultat atterrit ailleurs.** « Elles arrivent dans la galerie » est une consigne d'aller
  voir : depuis l'Univers, rien ne bouge du tout.

**Le bloc prend la place exacte du bouton** — mêmes 34 px, aucune hauteur neuve, contour
`--signal` sur `--fond-2` au lieu du plein. Il porte les deux faits qu'on cherche, en mono
11 px : combien partent, et depuis quand. **La jauge du produit court à son bord bas**, la même
qu'une tuile en génération et qu'une retouche de fiche — un troisième locataire pour la barre
unique, pas une barre de plus.

```
   au repos                                          [ Générer ]
                                                    Ctrl + Entrée

   pendant qu'un lot est en route      ┌────────────────────────────────────┐
                                       │  2 images en route · 00:07 / ~00:15│
                                       └────────────────────────────────────┘
                                                  Générer encore ›
```

**Générer redescend dans la fente, en lien.** Il reste à portée — lancer une seconde série sans
attendre la première est permis, et reste payant, donc il repasse par l'écran qui fait relire —
mais il cesse d'être ce qui saute aux yeux. C'est toute la réparation : **la chose qu'on
recliquerait est devenue la chose qui dit que ça marche.**

**Le bloc n'est pas un bouton, et c'est délibéré** : il n'y a rien à y cliquer. `role="status"`
le dit aussi à qui écoute l'écran, sans avoir à aller le chercher.

**Le refus l'emporte, comme partout.** Quand rien ne peut partir, un lien `Générer encore`
mentirait sur le geste disponible : la fente reprend sa raison, et le bloc au-dessus continue de
dire ce qui est en route. Les deux ne disent pas la même chose et ne se disputent pas la même
place — *ce qui est en route* est un fait, *ce qu'on peut faire ensuite* est une prédiction.

**Le bloc garde ses 34 px, quoi qu'il arrive.** Mesuré au navigateur en colonne étroite : la
phrase passait à deux lignes et le bloc à 51 px, ce qui faisait sauter toute la barre au moment
précis où elle doit rassurer. C'est le libellé du prompt négatif qui cède à la place, avec un
plancher — **un contrôle réduit à zéro pixel n'est plus un contrôle**, et sans ce plancher il
disparaissait.

#### Et une pastille sur l'onglet Galerie, parce que le bloc ne suit pas partout

La barre de prompt suit les écrans qui paient — la galerie, le codex, l'établi. Elle ne suit ni
l'**Univers**, ni un établi dont l'outil est ouvert, ni l'écran des dépenses : *un écran qui ne
peut pas dépenser ne porte pas le champ qui dépense*. Or c'est précisément là qu'on croit que
rien ne s'est passé, puisque rien ne bouge.

**La barre de tête, elle, est rendue sur les trois lieux.** L'onglet Galerie porte donc le compte
tant que quelque chose est en route — mono 9,5 px, `--signal` plein sur `--fond-0`, dans les
26 px de la rangée. Aucune hauteur neuve, et **aucune couleur neuve** : la règle « aucune couleur
de plus » protège les surfaces où l'on juge des images, et une barre de châssis n'en est pas une.
Pleine et non en simple texte coloré, parce que se voir du coin de l'œil depuis un autre onglet
est tout son métier.

Elle ne vit que sur la Galerie : c'est le seul des trois lieux où une image se pose.

**Ce que la pastille montre, l'onglet le dit.** Le calcul du nom accessible ne descend pas
chercher l'étiquette d'un enfant — mesuré le 31 août 2026 en écrivant l'essai —, donc une
étiquette posée sur la pastille faisait annoncer « Galerie 1 » : un nombre sans son unité, la
seule chose de la barre qu'on ne pouvait pas comprendre en l'écoutant. C'est **le bouton** qui
porte le nom entier, `Galerie · 2 images en route`, et la pastille qui se tait.

### L'infobulle explique, elle n'excuse jamais

Écrit le 27 août 2026, sur un constat de l'auteur : *« même si c'est mon app perso, je suis
un peu perdu dessus encore — le champ `groupe` sur un concept art, il sert à quoi ? »* La
question est juste, et l'écran ne peut pas y répondre : `groupe` et `famille` sont deux
champs voisins du même menu, l'un ne fait **rien** à la génération et l'autre décide de ce
qui part en référence *et* de ce que ça coûte. Rien à l'écran ne les distingue.

Les deux motifs ci-dessus interdisent l'infobulle. **Ils l'interdisent toujours, et cette
section dit exactement pourquoi ils ne mordent pas ici.** Ce qu'ils protègent est *la
raison* : ce qui refuse un geste ne se survole jamais, parce qu'on est bloqué maintenant.
Une explication n'a pas cette propriété — on génère très bien sans savoir ce que `groupe`
fait, on ignore seulement ce qu'on a gagné.

**Le test, et il est binaire** : *son absence empêche-t-elle un geste ?* Oui — fente
permanente, jamais un survol : « aucune clé OpenRouter », « la quantification demande une
palette », « 4× ne tient pas ici ». Non — survol, jamais une fente : ce que fait un réglage,
d'où sort son défaut, ce que remplir un champ entraîne. La règle ancienne n'est pas
assouplie, elle gagne son revers : **la fente permanente est réservée à ce qui bloque, le
survol à ce qui n'a jamais bloqué personne.** Une infobulle qui porte une raison est un bug,
pas un arbitrage.

**Le libellé est la cible — aucun glyphe neuf.** Le produit compte trois glyphes (`+` de
l'arbre, triangle plein du favori, carré de 9 px d'une étape) et le § Le bloc repliable a
déjà refusé le chevron pour ne pas en ouvrir un quatrième. Trente points d'interrogation
posés dans les panneaux seraient ce quatrième glyphe, multiplié — c'est-à-dire la maquette
écartée, qui mettait « des options partout ». Le nom du réglage est déjà à l'écran, déjà
placé, et c'est déjà le nom de la chose : il devient sa propre poignée. **Rien n'est ajouté
au repos, ni une rangée, ni une hauteur, ni une couleur.**

**La marque est un souligné pointillé `--bord-fort`, `underline-offset: 3px`.** Même token
que la poignée de barre de défilement, et pour exactement le même métier : *il y a plus
ici*. `--bord` est sous le seuil où l'œil le trouve (§ Layout, mesuré), `--bord-fort` est
au-dessus quand on cherche et en dessous quand on travaille. C'est aussi le trait que le
navigateur pose sous `<abbr>` depuis toujours — la seule décoration du produit qui se
comprenne sans être apprise.

**Elle sort du panneau qui porte son ancre, jamais dessus.** Corollaire du menu de carte —
*jamais sur l'image qu'il règle* — appliqué un cran plus loin : ce qu'il ne faut pas couvrir
est **le panneau qu'on est en train de régler**, et la bulle part du côté où il reste le plus
de place. Depuis la fiche (colonne de droite) elle part à gauche, depuis l'univers (colonne
de gauche) elle part à droite, depuis les réglages (panneau posé au milieu) elle part du côté
le plus large. Et elle est **bornée par l'écran, jamais par son contenu** — la règle du
§ Layout, qui vaut pour tout ce qui se pose.

*La règle mesurait auparavant l'ancre contre le milieu de la fenêtre. C'était juste à
l'atelier, où l'autre moitié est la grille, et faux partout où l'écran n'est que du réglage :
un panneau au milieu recevait sa propre bulle. Corrigé en R4 — le panneau se déclare, et le
placement remonte de l'ancre au premier ancêtre déclaré. Sans ancêtre déclaré — la barre
d'outils, qui traverse l'écran — c'est l'ancre qui décide, comme avant.*

**Sa verticale suit l'ancre, pas le panneau.** Elle se pose à la hauteur de ce qu'elle
explique, remonte quand elle sortirait par le bas, et se colle en haut sans plancher quand
elle est plus haute que l'écran — un plancher la rendrait plus haute que la place offerte,
donc rognée, donc son pied inatteignable.

**Fond `--fond-1`, bord `--bord-fort`, rayon 2, largeur 280 px.** Le menu de carte se
contente de `--bord` parce qu'il tombe toujours sur `--fond-0` ; une infobulle peut se poser
sur un panneau, où `--bord` disparaît. Un seul token d'écart, et c'est l'argument déjà payé
sur la barre de défilement. Aucune couleur neuve n'entre : le produit a trois sémantiques,
il en garde trois.

#### Trois lignes, toujours les mêmes trois

```
  ┌────────────────────────────────────────┐
  │ Un nom libre pour ranger les cartes    │  ce que c'est
  │ du tableau. Vide = hors groupe.        │  sans 12 px · --texte
  │                                        │
  │ Rien à la génération. Ce qui décide    │  ce que ça change
  │ des références envoyées, c'est         │  sans 12 px · --texte-2
  │ artwork officiel + famille.            │
  │                                        │
  │ toi · aucun défaut      Le guide ›     │  d'où ça sort
  └────────────────────────────────────────┘  mono 10 px · --texte-3
```

La troisième ligne est en mono parce que l'origine d'un défaut est **un fait sur le monde** —
le projet, l'univers, le catalogue, une mesure, ou toi — et que ce produit rend tout fait en
mono (§ Typography, règle 2). Elle porte le lien `--signal` vers le guide, par la règle du
§ Le grisé : *un lien quand il y a un endroit où aller*.

**Aucune explication ne saute la deuxième ligne.** Un réglage qui ne change rien en aval
doit l'écrire dans ces mots-là — `Rien à la génération.` C'est le gabarit qui produit la
réponse, pas la bonne volonté de celui qui rédige : sans ligne obligatoire, `groupe` aurait
reçu trois phrases sur le rangement, et la question de départ serait restée entière. Mise à
l'épreuve sur les deux champs qui l'ont provoquée :

| Champ | Ce que ça change |
|---|---|
| `groupe` | **Rien à la génération.** C'est un rangement pour l'œil. |
| `famille` | Seuls les artworks de la famille du sujet partent en référence, plus ceux marqués « tous ». **Le nombre de références change le coût.** |

Deux champs voisins, deux lignes qui ne se ressemblent pas : c'est tout ce que l'écran
n'arrivait pas à dire.

#### Un nom qui vit dans un `placeholder` n'est pas un nom

Trouvé en branchant le motif, le 27 août 2026, et c'est **la moitié de la réponse à la
question qui l'a lancé**. Dans le menu d'une carte, `groupe` et `note` n'avaient aucun
libellé : leur seul nom était le texte gris du champ vide, qui disparaît dès qu'on tape
dedans. Un champ rempli n'avait donc plus de nom du tout — impossible à identifier en le
relisant, et impossible à expliquer, puisque le motif accroche l'explication au libellé.

C'étaient les deux seuls champs du produit dans ce cas ; leurs voisins de la même colonne —
*Taille*, *Artwork officiel*, *Famille* — en avaient un. Ils en ont un maintenant, et le
`placeholder` redevient ce qu'il doit être : la valeur vide (`aucun`, `—`), pas l'identité du
champ.

**La règle qui en sort** : un contrôle dont le nom disparaît quand on s'en sert n'a pas de
nom. Le pointillé n'est donc pas seulement une marque d'aide — il est le test qui a révélé
le trou, parce qu'il n'avait nulle part où se poser.

#### Le survol révèle, le clic retient

La grammaire est celle du menu de carte, réemployée sans un réglage de plus : 200 ms de
repos pour paraître — assez long pour traverser un panneau sans rien déclencher, assez court
pour battre le clic —, 150 ms de grâce en partant, `Échap` ou un second clic sur le libellé
pour lâcher l'épingle. Le clic épingle parce qu'une explication de quatre lignes se lit sans
que la main reste immobile, et parce qu'on peut vouloir en copier un mot.

**Le fondu de 80 ms n'ajoute pas de ligne à la liste close du § Motion — il en rejoint une.**
C'est la même entrée que le menu de carte, pour la même raison d'admission : la chose paraît
**sans clic**, donc sans geste qui dise qu'on l'a demandée, et les 80 ms sont ce qui la fait
lire comme posée par-dessus plutôt que comme une grille qui vient de se recomposer. Un
second locataire d'une entrée existante, pas une entrée de plus.

**Le clavier n'est pas un rattrapage** : le libellé prend le focus, `Entrée` épingle,
`aria-describedby` relie le panneau au contrôle. Un réglage qu'on atteint au clavier doit
pouvoir s'expliquer au clavier.

#### Ce qui est écarté

**Un mode d'aide** — une bascule dans la barre de tête, éteinte par défaut, qui allumerait
les marques. Le calme au repos serait parfait, mais on n'est jamais perdu *avant* d'ouvrir un
panneau : on l'est en le regardant, et il faudrait alors sortir du geste pour aller allumer
une lampe. Un mode, c'est aussi un état de plus à tenir dans un produit qui en compte déjà
beaucoup, pour économiser un pointillé.

**Un texte plus long, ou une image dans l'infobulle.** Le panneau est borné à trois lignes
parce qu'au-delà c'est le guide qu'on veut, et le guide est à un clic — même partage que la
tuile et la fiche : *une tuile porte un nom, trois mesures et deux marques ; au-delà, c'est
la fiche qui prend le relais.*

**Une explication sur un contrôle grisé.** Elle existe — le libellé garde son pointillé —
mais elle ne remplace ni ne déplace la raison, qui reste dans sa fente, permanente. Les deux
cohabitent parce qu'elles ne disent pas la même chose : *pourquoi c'est fermé* n'est pas
*à quoi ça sert*.

#### Un seul corpus, trois rendus

*Deux jusqu'au 3 septembre 2026 ; le troisième est arrivé avec `R8`, et il est décrit
juste en dessous. **Ce que la règle interdit n'a pas changé d'un mot** : recopier.*

**L'infobulle et le guide sont le même texte.** Le panneau rend les trois lignes d'une
entrée du guide ; l'écran Guide rend toutes les entrées à la file, avec le contexte autour.
Ce n'est pas une commodité de construction, c'est la règle que ce document a déjà appliquée
deux fois — *deux comptes calculés à deux endroits se contredisent* (bloc « Ce qui part »),
*deux éléments qui disent la même chose à deux altitudes, et aucun des deux n'est l'autorité*
(le bandeau hors ligne). Une explication recopiée dans deux fichiers diverge en trois
semaines, et c'est celle qui est sous les yeux au moment du doute qui sera la fausse.

**Et le propos écrit sous un titre de section est le troisième rendu du même texte.**
Il ne montre que *ce que c'est* — la première ligne de l'entrée, celle que le corpus impose
déjà de tenir en **une phrase, jamais deux** —, là où la bulle y ajoute *ce que ça change*
et *d'où ça vient*. Corriger l'entrée corrige les trois d'un coup. Le motif complet, avec
sa limite, est au § **Le propos d'une section s'écrit sous son titre**.

**Un réglage sans entrée n'a pas de pointillé, et rien ne casse.** Aucune infobulle vide,
aucun `à documenter` dans le châssis. C'est le **guide** qui tient la liste de ce qui lui
manque, dans sa dernière section — un manque de guide est un fait sur le guide, et il se
range là où les guides vivent. Même partage que le journal des ratés : hors de la grille,
dans la colonne qui parle déjà de ça.

#### Le corpus est complet, et « complet » a un sens précis

Écrit le 27 août 2026, au bout du chantier. Le motif était branché sur dix-neuf entrées et
la dernière section du guide en listait **six manques**. Les combler a demandé de trancher
ce que « un réglage » veut dire, et trois réponses en sont sorties — chacune a déplacé une
frontière, pas seulement rempli une case.

**Quarante-six entrées, quatre écrans.** Le groupe *Dans la découpe* entre à cette
occasion, et c'est un **écran, pas un thème** : quand on cherche une explication, on se
souvient d'où l'on était, pas de quelle famille conceptuelle relevait le curseur. Ranger
les lignes et les colonnes sous *la retouche* au motif qu'elles viennent après la
génération aurait été un classement juste pour le rédacteur et faux pour le lecteur. Les
comptes : univers 20, atelier 4, retouche 18, découpe 4.

**Une étape de recette est un réglage, et c'est le plus structurant de tous.** Elle décide
qu'une des cinq places est occupée. Documenter `tache minimale` sans documenter
*Nettoyage des bords* aurait laissé le parent plus opaque que son enfant — le contraire de
ce qu'on cherche, puisque c'est le nom du bloc qu'on lit d'abord. Les cinq titres portent
donc leur pointillé, et leurs entrées disent l'ordre fixe : *rien ne peut se recadrer avant
qu'un alpha dise où est le sujet.*

**Un contrôle grisé s'explique — et `disabled` l'en empêchait.** Le § Ce qui est écarté
promettait déjà que le libellé d'un contrôle refusé garde son pointillé, parce que
*pourquoi c'est fermé* n'est pas *à quoi ça sert*. Un `<button disabled>` ne dispatche
aucun événement de souris, **pas même sur ses enfants** : l'explication d'une étape grisée
aurait donc été la seule du produit à ne jamais s'ouvrir, et c'est précisément celle qu'on
va chercher à ce moment-là. La rangée passe à `aria-disabled`, avec le clic gardé par une
condition. Le refus est entier — le clic ne pose rien —, la raison reste dans sa fente
juste dessous, et l'explication s'ouvre par-dessus. C'est un cas où **la règle du motif a
corrigé le code**, et pas l'inverse.

**Le seuil de la jauge de retouche sort de la liste des manques, et n'y est pas remplacé.**
Les 240 ms sous lesquelles rien ne paraît ne sont pas un réglage : personne ne peut les
toucher, et aucun libellé de l'écran ne pourrait porter leur pointillé. Ils vivent au
§ Motion, là où les décisions de mouvement se tranchent. **Une liste de manques qui garde
un item impossible à combler cesse d'être une liste de travail** — c'est la même hygiène
que le tramage retiré du corpus le même jour, par l'autre bout : là un réglage qu'on ne
peut pas atteindre, ici un manque qu'on ne peut pas écrire.

**Il reste un manque, et il est structurel** : les réglages qu'un modèle déclare en propre.
Le catalogue les nomme, et il change d'un jour à l'autre — 47 modèles le 26 août, 48 le 27.
Aucune entrée écrite d'avance ne peut les couvrir, et c'est exactement pour ça que le guide
tient une liste plutôt qu'une promesse.

#### Deux règles de rédaction que le remplissage a fait apparaître

**Deux entrées d'un même écran ne portent jamais le même nom.** Le guide rend les entrées à
la file, groupées par écran, et le nom est le titre de chacune : deux « famille » à la suite
dans *Dans l'univers* — celle d'une carte, celle d'une échelle du barème — et le lecteur ne
sait plus laquelle il lit. C'est la seule collision que le regroupement ne rattrape pas,
puisqu'il **est** le regroupement. Le même mot dans deux écrans différents, lui, est
correct : c'est le même mot à l'écran.

**Un libellé peut s'éteindre, et c'est la seule variante permise.** Les sept champs de la
bible descendent en `--texte-3` quand ils ne portent rien. Le gabarit de libellé prend donc
un état *éteint* plutôt qu'un second gabarit : **un second endroit où poser le pointillé
est un endroit où l'oublier**, et c'est la panne que ce motif ne peut pas se permettre —
elle est silencieuse. Un test la couvre désormais, en confrontant toute clé branchée à
l'écran au corpus : une clé mal tapée ne lève pas, elle rend le réglage muet.

#### Ce qui n'a pas d'ancrage à l'écran, et pourquoi c'est correct

Trois entrées vivent dans le guide seul — `famille d'une échelle`, `occupation d'une
échelle`, `se détoure / plein cadre`. Les trois contrôles sont **répétés sept fois**, une
fois par échelle du barème, et aucun ne porte de libellé : chacun montre sa valeur, ce qui
suffit à le nommer. Vingt-et-un pointillés dans un bloc de sept rangées seraient la maquette
écartée et ses « options partout » ; inventer une rangée de légende pour les porter serait
inventer un motif pour un cas. Le bloc *Barème d'échelles*, lui, porte le sien, et son
entrée nomme les trois choses qu'une échelle transporte. `Le guide ›` mène juste au-dessus
des trois entrées longues.

La même chose vaut pour `provenance`, qui n'est pas un réglage mais un fait — l'adresse
gardée au collage. **Une entrée sans ancrage est permise ; un ancrage sans entrée ne l'est
pas** : le premier laisse une explication à un clic de plus, le second laisse un réglage
muet.

**Et un contrôle a gagné un nom au passage** : le moteur de détourage. Ses trois voisins de
la passe — tolérance, seuil alpha, durcissement — en portaient un ; celui-ci se lisait sur
ses deux segments, « bord » et « modèle », c'est-à-dire sur ses **valeurs**. Même famille
que `groupe` et `note`, dont le nom vivait dans un `placeholder` : *un contrôle qui n'est
nommé que par ce qu'il vaut n'a nulle part où accrocher son explication.* Le pointillé n'a
pas seulement documenté le produit, il a servi une troisième fois de détecteur.

### Le propos d'une section s'écrit sous son titre

*Décidé le 3 septembre 2026, avec l'auteur, en construisant `R8`. La mesure qui l'a tranché
est au § 05 de `docs/maquettes-v2.1/07ter-la-fiche-repensee.html`.*

**Une phrase à demeure sous le titre d'une section, qui dit à quoi la section sert — et
cette ligne est *lue dans le recueil*, jamais retapée dans l'écran.** C'est
`EnTeteDeSection`, dans le châssis : il prend la clef d'une entrée et rend le nom, le compte
à droite, et le propos dessous.

**La question posée d'abord était mauvaise, et c'est le comptage du code qui l'a montrée.**
Écrire une phrase à demeure semblait ajouter un troisième rendu à un corpus qui n'en avait
que deux. Or le produit écrit déjà ce genre de phrase partout : **74 lignes explicatives en
dur dans dix-sept écrans**, et sur les quinze relues une par une, **treize expliquent ce que
fait un réglage sans rien refuser** — « l'opacité ne pose aucune couleur : elle décide de ce
qui est là », « multiples entiers seulement — un sprite agrandi d'une fois et demie fabrique
des pixels qui n'existent pas ». La règle n'a jamais interdit d'écrire une phrase à l'écran.
Ce qu'elle interdit est de **recopier le corpus dans un second fichier**.

**La vraie question était donc : on la tape comme les 74 autres, ou on la lit dans le
corpus ?** On la lit. Ce n'est alors pas un troisième texte, c'est **le même texte montré
une troisième fois**. Rien n'est à rédiger en plus — le corpus impose déjà que *ce que
c'est* tienne en une phrase, jamais deux, ce qui est exactement le format d'une ligne sous
un titre. La règle en sort **mieux tenue** qu'avec les 74 lignes tapées à la main.

**La limite, pour que ça ne se répande pas : la ligne ne s'écrit que là où l'on peut se
tromper de section.** Sur un panneau où chaque ligne porte un nom sans ambiguïté —
*occupation*, *décalage* —, rien ne change : le pointillé au survol suffit. C'est le même
test binaire qui décide déjà de l'existence d'une bulle.

**Et le compte de la section s'écrit sur la même ligne que le titre, aligné à droite, en
mono.** Même geste que le bloc replié qui porte son réglage : un titre qui porte sa mesure
se lit sans qu'on ouvre quoi que ce soit.

### Un outil montre le défaut qu'il répare avant de proposer de le réparer

*Écrit le 3 septembre 2026, en construisant `R9`. Le défaut réparé : l'écran du
calibrage ouvrait sur un décompte — « 6 poses · 5 calées » — et proposait un
verbe — « Calibrer les 5 poses ». Rien ne disait ce qui n'allait pas.*

**Trois choses dans cet ordre, et l'ordre est le motif.**

1. **Ce qu'il répare**, en clair, avant tout le reste. La phrase est **lue dans le
   recueil** (§ Le propos d'une section s'écrit sous son titre), et suivie du
   défaut **mesuré sur la chose qu'on a sous les yeux** — jamais sur un souvenir :
   « ses poses sortent à 64, 53 et 43 px de haut ». Un chiffre cité de mémoire
   devient faux, et `G1` a passé une tranche à le démontrer.
2. **Ce que le geste donnerait**, une ligne par fait, **au-dessus** du contrôle
   qui l'engage. Nom à gauche, chiffre à droite, dans la police des chiffres : les
   trois se lisent comme une colonne. Un fait écrit sous le bouton se lit après
   l'avoir appuyé.
3. **Le contrôle, qui annonce son résultat et non son verbe** — « Mettre les 5
   poses à 53 px », pas « Calibrer les 5 poses ». C'est le geste que le bouton qui
   paie fait depuis toujours : il annonce ce qu'il va coûter.

**Et quand il n'y a rien à réparer, il s'éteint avec sa raison.** C'est la règle
du § Le grisé porte sa raison, appliquée à un outil au lieu d'un réglage : un
contrôle allumé qui ne changerait rien invite à un geste sans effet, ce qui use
la confiance plus vite qu'un refus.

**L'avant et l'après, côte à côte, avant tout geste.** C'est la réponse visuelle
à *« qu'est-ce que ce bouton va faire »*, et elle vaut mieux qu'un paragraphe.
Deux règles la tiennent :

- **rien n'est fabriqué pour ce dessin** — l'après est la même image, transformée
  du rapport exact que le geste appliquera ;
- **quand il n'y a rien à faire, la seconde image ne se dessine pas.** Répéter la
  pile à l'identique serait un dessin qui ment sur son propre propos ; la place
  revient à une phrase qui dit pourquoi il n'y a rien à faire.

**Une marque dit un état, un mot fait un geste**, et les deux ne doivent pas se
ressembler. L'encadré « réf » et le rond plein de cet écran étaient un vocabulaire
à apprendre : leur sens ne vivait que dans un `title`. *Prendre comme référence*
et *mettre de côté* s'écrivent en toutes lettres, là où l'on règle la pose ; sur
la ligne il ne reste que la marque, sans encadré et sans clic. Le produit dit déjà
*retenir*, *éteindre*, *rallumer*.

**Et une superposition à plusieurs traitements porte sa légende.** Trois niveaux
de transparence disent trois rôles ; personne ne devine que la silhouette à demi
effacée est celle qui sert de référence. La légende nomme ce qui est montré, et
elle rétrécit quand on montre moins : nommer ce qui n'est pas là est une légende
fausse.

### Une fiche montre la chose dont elle est la fiche

*Écrit le 3 septembre 2026, en construisant `R8`. Le défaut réparé : la fiche d'une chose
du jeu ne montrait ni image d'elle, ni son nom — un écran entier de texte sur une chose qui
n'existe qu'en images.*

**En tête, un bandeau d'identité** : le portrait à gauche, 96 px sur damier ; à droite le
nom, puis une ligne de faits en mono, puis une ligne de contexte. Rien de neuf — ce sont les
mesures et les polices que le produit emploie déjà.

**Le portrait est pris parmi les images déjà faites de la chose** — la favorite de sa
première pose remplie, sinon la plus récente. **Il ne fabrique rien et ne paie rien**, et
c'est la seule règle non négociable du motif : un écran de réglage qui déclencherait une
génération pour s'illustrer serait le contraire de ce que le produit promet. Une chose sans
aucune image montre **une case vide qui le dit**, ce qui est déjà un renseignement.

**Le nom est le seul emploi de la police à empattements sur cet écran** — c'est un nom, pas
une mesure. La règle du § *Typography* ne souffre pas d'exception : les mesures sont en
mono, partout.

### L'annulation se pose dans une fente, jamais dans un bandeau

Le § Motion réserve 160 ms à « l'annulation après suppression », et ne dit pas où elle se
pose. La réponse est venue du même raisonnement que le repli hors ligne, le même jour :
**un bandeau est du châssis en travers de la grille**, et une suppression n'en mérite pas
plus qu'une panne de réseau.

Elle se pose donc dans la **barre d'outils de la grille** — 38 px qui existent déjà —, à
droite, et **dans la forme exacte de la fente sous Générer** : tiret de 8 px, mono 10 px,
`--epingle` pour le fait, lien `--signal` pour le geste. Le décompte est celui que le
serveur a annoncé, jamais un délai recompté à l'écran : c'est lui qui refuse au-delà, et
deux délais écrits à deux endroits finiraient par se contredire.

```
   Chercher   [Favoris]   12 images            — 3 supprimés · 6 s   Annuler ›
```

**La couleur est `--epingle`, et c'est la même définition que ses deux autres emplois** :
*arrêté à un instant, que le système ne bougera pas tout seul, et que seul un geste de
l'auteur relance*. Une suppression en sursis est exactement cela.

### La barre d'outils ne perd jamais son filtre

Une sélection **ajoute** des gestes à droite du compteur ; elle ne prend pas la place de la
recherche ni du filtre favoris. La règle a été écrite après l'avoir violée : ouvrir une
fiche sélectionne, donc la barre basculait en mode sélection, donc le filtre posé
disparaissait de l'écran — et « fermer le panneau remet exactement où l'on était » (US-37)
devenait faux sans que rien ne l'ait dit.

**Et l'anneau `--lumiere` n'a qu'un sens : sélectionné.** La fiche n'est pas un état de
plus — c'est la sélection quand elle vaut un. Deux images sélectionnées ferment la fiche et
laissent la barre d'outils faire le travail de lot ; une seule la rouvre.

### L'emplacement

Au moment où la génération part, N tuiles paraissent **à leur taille définitive**, avec la jauge
en pied de zone image et le compteur en mono (`1 / 3`, `00:08`). La tuile devient l'image, ou
devient l'échec — fond `rgba(196,99,92,.05)`, bordure `rgba(196,99,92,.45)`, la raison en clair à
la place du sprite et `Relancer` à la place de la méta.

**La grille ne se recompose jamais entre le départ et l'arrivée.** L'œil reste exactement où il
était, et l'échec atterrit à l'endroit précis où le succès serait arrivé.

### Densité de l'information sur une tuile

Une tuile porte au maximum : un nom, trois mesures, une marque de favori et une pastille d'état.
Au-delà, c'est la fiche qui prend le relais. C'est la règle qui empêche la grille de redevenir la
maquette écartée.

---

### La visionneuse ne défile pas — et le curseur envoie ce qu'on a lâché

Écrit le 27 août 2026, en réglant un détourage pour de vrai. Trois faits mesurés au navigateur,
bout en bout, PUT compris, sur une image dont le brut fait 1024 px :

| Le geste | Ce que ça coûte |
|---|---|
| Occupation, ancrage, marge — **la queue de la recette** | **29 ms** |
| Recadrage recalculé | 204 ms |
| Un cran de tolérance — **le détourage repasse** | **1 492 ms** |
| Le moteur `modèle` | **1 840 – 2 255 ms** |

« Chaque réglage répond sans attente perceptible » était vrai de la première ligne et faux des
deux dernières. Tout ce document en découle.

**La visionneuse est le sujet du panneau, pas son premier bloc.** Elle sort donc du défilement et
se pose sous l'en-tête de 30 px, comme lui fixe. On règle un détourage *en regardant ce qu'il
fait* ; avec l'image en tête de défilement, un curseur posé six cents pixels plus bas obligeait à
remonter à chaque cran pour voir ce qu'on venait de faire, ce qui n'est pas un réglage mais un
aller-retour.

**Ce qui bouge quand on règle reste sous les yeux ; ce qui ne bouge pas descend.** L'image, la
bascule rendu/brut et les dimensions restent — les dimensions changent avec le recadrage et la
grille, c'est un fait qu'on surveille. Le sujet de la génération descend dans le défilement : on
le lit une fois, il ne bougera plus.

**Carrée, large comme le panneau, bornée en largeur par la hauteur de l'écran.** `max-width: 46vh`
et non `max-height` : `aspect-ratio` cède devant `max-height` — le navigateur rabote la hauteur
sans redéduire la largeur, et le damier cesse d'être carré. C'est la leçon déjà payée sur le cadre
de l'écran Découpe, et la borne ne mord que sous 760 px de haut, où l'image cède au calcul plutôt
qu'aux contrôles.

**Un curseur envoie ce qu'on a lâché, pas ce qu'on a traversé.** Un cran de segment est un choix,
il part ; un cran de curseur est un point de passage, et personne n'a demandé à le voir. Ce n'est
pas une économie de confort : le serveur sérialise les retouches, donc un glissement de la
tolérance sur vingt crans, c'était **vingt appels de 1,5 s à la file** — une demi-minute pendant
laquelle l'image défilait des valeurs intermédiaires. Vérifié après : vingt-et-un crans, **zéro
appel** ; un relâchement, **un appel**. La valeur sous le curseur, elle, suit la main sans
attendre — c'est elle qui rend le contrôle vivant, pas le rendu.

### La jauge de la fiche — la même barre, deux réglages

**Une seule jauge dans tout le produit.** Celle d'une tuile en génération et celle d'une retouche
sont le même composant, les mêmes 2 px, la même courbe asymptotique qui n'atteint jamais le bout.
Elle se pose au bord bas de la zone image, à l'endroit exact où une tuile porte la sienne.

Deux réglages, parce que les deux attentes du produit n'ont pas la même échelle :

- **Pas de compteur.** Une génération court dix à vingt secondes et on peut quitter l'écran : son
  `00:08 / ~00:15` dit s'il faut attendre. Une retouche court une à deux secondes, la main encore
  sur le curseur — un nombre qui change deux fois n'apprend rien.
- **Un seuil de 240 ms**, la borne haute des durées du § Motion, réemployée. Sous ce seuil, rien
  ne paraît du tout : la queue de la recette répond en 29 ms, et y faire clignoter une jauge
  serait pire que de ne rien montrer. Vérifié : sur un cran d'occupation, la jauge n'apparaît à
  aucun instant.

**L'attente s'apprend au lieu d'être écrite.** Le serveur publie une durée attendue pour une
génération — la médiane de ce modèle-là — mais rien pour une retouche. L'écran garde donc ce que
la dernière du même genre a mis, sur cette machine et sur cette image, avec les valeurs de la
mesure en amorce. Il n'y a que deux genres, et c'est le serveur qui les sépare : les passes ont
bougé, ou seulement la queue.

**L'image ne se vide pas et ne se grise pas pendant.** Elle reste le rendu d'avant, entier et
jugeable — on compare toujours à quelque chose, et c'est la jauge qui dit que ce n'est pas encore
le bon.

### Le bloc repliable — un bloc replié ne se tait pas

Ajouté le 27 août 2026, en même temps que la règle qui borne les panneaux, et pour la raison
inverse : borner un panneau le fait défiler honnêtement, mais un panneau de 1471 px qui défile
reste un panneau de 1471 px. La question n'était pas de cacher, c'était de **résumer**.

> **Un bloc replié porte son réglage, en mono, à droite de son titre.**

C'est la seule ligne qui compte. Le repli cesse d'être un rangement et devient un résumé : la
recette d'un asset se lit en cinq rangées sans rien ouvrir, et le panneau de l'univers devient la
fiche de l'univers. **Un panneau plié se lit mieux que déplié** — sans ça, le mécanisme ne serait
pas dans ce document.

```
 Détourage             bord · 28        posé      → --signal
 Recadrage             marge 0 px
 Grille                64 px · 100 %
 Quantification                         grisé     → sa raison, tiret de 8 px
  — aucune palette : elle se déduit des artworks
 Nettoyage des bords                    pas posé  → le carré vide le dit déjà

 Bible                          —       rien de posé → --texte-3
 Taille de pixel            96 px
```

**La marque de repli est la valeur elle-même.** Replié, l'en-tête porte le réglage ; ouvert, il se
tait — la valeur est dans le bloc, sous les yeux, et rien ne s'écrit deux fois. **Aucun glyphe
neuf n'entre dans le produit**, et ce n'est pas une coquetterie : les deux candidats évidents sont
pris. Le `+` en bout de rangée d'en-tête veut dire *nouvelle entrée* dans l'arbre, le triangle
plein veut dire *favori* sur une tuile. Un chevron serait un quatrième glyphe dans un produit qui
en compte trois. L'affordance tient au survol de la rangée — `--fond-3`, 80 ms, le survol du
produit — et à la valeur en `--signal`, qui se lit comme quelque chose qu'on va éditer.
**Coût assumé** : si au bout de deux jours d'usage on clique à côté, c'est raté, et il faudra le
chevron.

**La rangée fait 26 px** — celle de l'arbre, au § Spacing. Aucune hauteur neuve, comme aucune
couleur neuve.

**Ce qui se replie**, et c'est une règle à deux conditions : ce qui coûte plus de place qu'un rang
de segments, **et** ce qui porte un choix qui se dit en une ligne. Un contrôle qui tient sur 26 px
ne se replie pas — le repli lui coûterait un clic pour ne rien rendre.

| Panneau | Ne se replie jamais | Se replie | Mesuré |
|---|---|---|---|
| **Réglages** `300` | Proportions, Variations, Sujet, les options du modèle, *Ce qui part* | Modèle — la liste vaut 280 px à elle seule | 950 → 620, il tient |
| **Fiche** `380` | la visionneuse, la rangée du jugement, Réinjecter | les 5 passes de la recette, Filiation | recette 522 → 192 |
| **Univers** `380` | — | Bible, Palette, Taille de pixel, Barème, Modèle par famille | 1471 → 130 |
| **Arbre** `240` | tout | rien | — |

L'arbre est le cas qui explique la règle : ses sections sont de la **navigation**, chaque projet
s'ouvre déjà par sa rangée, et le `+` de son en-tête a déjà un sens. Réinjecter est l'autre : une
rangée de gestes n'a pas de valeur à résumer, donc rien à dire une fois repliée.

**La recette est le cas particulier, et sa rangée porte deux actes.** Une étape de recette avait
déjà un état — *posée* ou *pas posée* —, et il ne se confond pas avec *montrée* ou *pas montrée* :
le premier change l'asset, le second ne change que l'écran. Le carré de 9 px garde le premier, le
titre prend le second, et une étape qui n'est pas posée n'a rien à replier — toute sa rangée la
pose, comme avant. **Poser une étape l'ouvre** : c'est le même geste, on demande ses contrôles en
la posant.

**Trois règles pour que ça ne dérive pas.** Replié par défaut, partout — un panneau neuf affiche
son état complet, et l'auteur ouvre ce qu'il vient toucher. L'état de repli est **global et par
bloc** : il survit au changement d'asset et à la fermeture du panneau, ce qui est déjà la promesse
d'US-37, et personne ne veut gérer deux cents états de repli. **Rien ne s'ouvre tout seul** — sauf
une étape qu'on vient de poser : l'en-tête dit déjà l'état, donc rien n'a besoin de s'ouvrir pour
se faire remarquer.

**La droite de la rangée dit toujours un fait sur le bloc**, et les deux locataires ne cohabitent
jamais : replié c'est la valeur, ouvert c'est ce que le bloc veut garder sous les yeux pendant
qu'on le règle — `48 au catalogue` pendant qu'on choisit un modèle, `déduite des artworks` quand
la palette est vide. Même fente, même mono 9,5 px, `--texte-3` pour le fait et `--signal` pour la
valeur.

---

### La grille reçoit un dépôt — un liseré, jamais un voile

Ajouté le 29 août 2026 (R3). Un fichier lâché sur la grille d'assets y entre, comme il entre
déjà sur le tableau d'inspiration depuis T4.

> **La grille est la seule surface du produit où l'on juge : rien ne se pose par-dessus.**

Le survol d'un fichier se dit par un `outline` de 1 px en `--signal`, posé en `inset` : il ne
recouvre aucune image et ne déplace rien — un `outline` ne prend pas de place dans la mise en
page. Un calque semi-opaque, la solution ordinaire, cacherait très exactement ce qu'on est en
train de regarder au moment où l'on décide où déposer.

**Les trois états de la grille le reçoivent** — pleine, filtrée à vide, et vide. Une surface
qui n'accepterait le dépôt qu'une fois pleine serait fermée au moment où elle sert le plus :
une bibliothèque vide *est* le moment où l'on fait entrer sa première image.

**Ce qui n'entre pas se dit au-dessus, une ligne par fichier.** Un refus en `--echec` qui nomme
le fichier ; un doublon en `--epingle` avec ses deux gestes — voir l'existante, ou faire entrer
quand même. Une ligne par fichier parce que « chacun avec son propre sort » n'a pas d'autre
forme : dix fichiers déposés peuvent donner huit images, un refus et un doublon.

**Et jamais dans la barre d'état.** Elle porte les pannes, et une panne grise Générer : un
import refusé n'a aucune raison d'empêcher de générer. C'est le corollaire direct de « le
grisé porte sa raison » — encore faut-il que la raison soit celle du bon geste.

Le sort réservé à ce qui entre — telle quelle, ou traitement du projet — est un **libellé qui
énonce l'état**, pas un bouton qui annonce une action : la forme du détourage d'une échelle
dans le barème. Il est ancré à droite contre l'export, parce que ce sont les deux portes de la
bibliothèque et qu'une porte qui se déplace est une porte qu'on cherche.

---

### Le dépliant du prompt — ce qui partira, et rien d'autre

Ajouté le 29 août 2026 (R2). Sous le champ de prompt, une ligne de pied déplie le texte exact
qui sera envoyé au modèle : la bible active, le sujet, puis les consignes de planche quand un
lot est armé.

> **On montre ce qui part, dans l'ordre où ça part, sans étiquette dans le texte.**

Trois décisions, et elles se tiennent :

- **Fermé par défaut, et il tient sur une ligne** — `+ ce qui partira · +2`, mono 10 px,
  `--texte-3`, la forme exacte de `+ prompt négatif` juste en dessous. Le geste quotidien est
  d'écrire, pas de relire ; le pied dit seulement *combien de blocs s'ajoutent à ton sujet*,
  ce qui suffit à donner envie d'ouvrir le jour où le compte surprend.
- **Chaque bloc porte son origine à côté, jamais dedans** — un en-tête mono 9,5 px majuscules
  `--texte-3`, la forme de l'en-tête de panneau. Coller « [bible] » dans le texte montrerait
  autre chose que ce qui part, ce qui est pire que de ne rien montrer. Le texte lui-même est
  en mono 10,5 px : c'est une **mesure**, pas de la prose — c'est le prompt caractère pour
  caractère, et la règle 2 de la typographie s'y applique telle quelle.
- **Repris, le champ change de nature et le dit par son bord** — `--signal` au lieu de
  `--bord-fort`, mono 11,5 px au lieu de sans 13,5, six lignes au lieu de deux. Ce n'est plus
  un sujet qu'on décrit, c'est un prompt qu'on écrit : un champ qui ne changerait pas
  d'apparence laisserait croire que l'atelier habille encore par-dessus.

Le dépliant est un **conteneur nommé** (`region`, « Ce qui partira ») et non une simple boîte :
il est lu autant que regardé, et un lecteur d'écran doit pouvoir y aller comme on y va de l'œil.

---

### L'écran Univers, et la carte qui n'est pas une tuile

Ce document ne portait rien sur le tableau d'inspiration ni sur l'univers — ils arrivent en
T4, et l'écran est dérivé des motifs transversaux plutôt qu'inventé. Ce qui suit est ce que
la dérivation a tranché, écrit ici parce qu'une décision d'apparence qui ne vit que dans le
code finit par contredire ce document.

**`380px · 1fr` en grille, `380px · 1fr · 380px` en toile.** L'univers à gauche, le tableau — ou
la toile — au milieu, la réserve à droite quand la toile est ouverte. 380 est la largeur de la
fiche asset : c'est *la* colonne de réglages du produit, et lui donner une **valeur** de plus
ferait un troisième vocabulaire de largeur pour la même sorte de chose. Une **colonne** de plus,
non : réécrit le 27 août 2026 avec la toile, parce que la phrase d'origine — « et pas une
troisième largeur » — interdisait un nombre et se lisait comme interdisant une colonne. La
réserve reprend la 380 telle quelle, pour ce qu'elle nomme déjà : ce qu'on manipule. La grille
reste disciplinée, comme partout.

**Et les deux colonnes se replient, par le même geste qu'à l'Atelier.** Ajouté le 28 août 2026,
à l'usage : composer sur la toile est le seul travail du produit qui demande de la place *au
milieu*, et il était encadré des deux côtés sans rien pour l'ouvrir. Rien de neuf n'entre pour
autant — même bascule dans la barre de tête, même case de grille qui tombe à zéro, mêmes 160 ms
(§ Motion). Repliées toutes les deux, il ne reste que la toile.

**Replier n'est pas fermer**, et cet écran en donne la raison la plus nette du produit : la
réserve garde ses 380 px sous une case qui les rogne, parce que **c'est cette grille-là que
l'aimant de la largeur libre mesure**. Un panneau démonté rendrait la toile bête au moment précis
où on lui donne toute la place. Corollaire : la frontière du glissement se borne à ce que la
fenêtre montre — repliée, la réserve n'attrape plus rien, alors que son rectangle, qui ne sait
rien du rognage de son parent, dit l'inverse.

**La bascule de la réserve ne paraît qu'en toile.** En grille, cette colonne n'existe pas : une
bascule pour une colonne absente mentirait sur ce que l'écran contient, et ce serait la seule du
produit à ne rien tenir.

**C'est un écran, pas un panneau — et c'est le cadrage qui le dit** (`docs/archi-versions.md`
§6.2 : « Univers · au début d'un projet, puis ponctuel »). Il couvre donc l'Atelier au lieu
de s'y ajouter. La contrepartie est exacte : l'Atelier ne montre que ce qu'on touche **à
chaque** génération, l'Univers tout ce qu'on pose **une fois** et qui s'applique ensuite
tout seul.

**Corollaire obligatoire : il porte sa propre fente de refus.** Une raison envoyée à la
barre d'état de l'Atelier serait rendue *derrière* lui — donc invisible au moment précis où
elle compte. Elle se pose dans la barre de tête de 44 px, dans la forme des autres : tiret
de 8 px, mono 10 px, `--echec` pour un refus. Le motif ne change pas, seul son emplacement
suit l'écran qui l'a provoqué.

**La carte a le rayon 2 du châssis, la tuile garde le rayon 0.** C'est la seule différence
de forme entre les deux grilles, et elle suffit à dire ce qu'elles sont : une tuile est un
produit du travail, et le rayon nul la fait lire comme une planche contact ; une carte est
de la matière rassemblée, donc du châssis. « Une seule grille d'assets dans tout le
produit » reste vrai — celle-ci n'en est pas une, et se voit tout de suite comme telle.

**Une carte porte au maximum : une image ou un texte, une provenance, un mot de pied et une
marque.** La même règle de densité que la tuile, et le même vocabulaire de marque : le coin
plein en `--signal` dit **artwork officiel** — ce que l'auteur pose est une forme —, le mot
du pied dit la famille ou le groupe — ce que le système constate est un mot. Aucune couleur
supplémentaire n'entre dans le tableau — et sur la toile, la couleur se pose sur l'îlot et sur la
note, jamais sur la carte (§ Color, *Les teintes d'îlot*).

#### Le menu d'une carte — le survol révèle, le clic retient

Écrit le 27 août 2026, en promouvant des artworks pour de vrai. Le menu vivait **dans** la carte :
elle grandissait de 300 px en s'ouvrant, la rangée entière suivait, et les voisines devenaient des
rectangles vides. Une grille qui se recompose parce qu'on regarde une carte, c'est exactement ce
que le produit refuse déjà pour la grille d'assets — *l'œil reste exactement où il était*.

**Le menu se pose par-dessus, jamais dans le flux.** Absolu, au-dessus des voisines. La grille ne
bouge plus d'un pixel : vérifié aux deux extrémités du tableau, position et hauteur de chaque
carte identiques avant et après ouverture.

**Sous la carte, ou au-dessus d'elle, jamais dessus.** C'est la réponse à « le menu est plus grand
que la vignette » : il fait 300 px pour une carte 1× qui en fait 190, donc il déborde
nécessairement — mais sur les **voisines**, et jamais sur l'image qu'il règle, ce qui serait
absurde puisque c'est elle qu'on regarde en réglant. Largeur : celle de la carte, et **au moins
240 px** — une carte 1× est trop étroite pour la rangée des familles, qui y passerait à cinq
lignes.

**La place se mesure autour de la carte, jamais autour du menu.** Écrit d'abord dans l'autre sens,
et faux : le menu rendu sous la carte, on regardait la place au-dessus de *lui*, qui comprend la
carte entière. Il basculait donc vers le haut en croyant tenir, et se posait deux cents pixels
au-dessus du cadre visible. La carte est l'ancre ; c'est autour d'elle qu'on compte.

**Et un menu est borné par l'écran, jamais par son contenu** — la règle du § Layout, un cran plus
bas. Quand il ne tient ni dessus ni dessous, il prend exactement ce qui est offert et défile en
dedans. **Sans plancher, exprès** : un plancher le rendait plus haut que la place, donc rogné par
le cadre du tableau, donc son pied inatteignable. Un menu court qui défile vaut mieux qu'un menu
complet dont on ne peut pas atteindre `Retirer`.

**Le survol révèle, le clic retient.** 200 ms de repos font paraître le menu — assez long pour
traverser la grille sans rien déclencher, assez court pour battre le clic, ce qu'il doit gagner
sur lui pour servir à quelque chose. Le pointeur qui quitte la carte *et* son menu l'efface après
150 ms de grâce, le temps de traverser la gouttière de 9 px sans le perdre.

Le clic, lui, n'est pas remplacé : il **épingle**. La carte reste choisie, anneau `--lumiere`
comme partout ailleurs, et le menu ne s'efface plus. Ce n'est pas du confort — ce menu porte
`groupe` et `note`, deux champs de saisie, et un menu qui s'évapore parce que le pointeur a dérivé
pendant qu'on tape une note est inutilisable. Corollaire : **on ne vole pas un menu à un clavier
en train de s'en servir.** Survoler une autre carte déplace le menu, sauf si un champ du menu
épinglé a le focus.

**Le fondu de 80 ms entre dans la liste close du § Motion**, et par sa propre règle d'admission.
Le menu paraît **sans clic**, donc sans geste qui dise qu'on l'a demandé : les 80 ms sont ce qui
le fait lire comme une chose venue se poser par-dessus, plutôt que comme une grille qui vient de
se recomposer — ce que le produit passe justement son temps à ne pas faire. Les 2 px de levée sont
ceux de l'arrivée d'un asset dans la grille, à un pixel près : même vocabulaire pour la même
chose, *quelque chose est là qui n'y était pas*.

**Les vignettes 1× / 2× / 4× sont les crans du zoom de la grille**, réemployés. Un seul
vocabulaire de taille dans tout le produit ; ce sont deux contrôles distincts sur deux
grilles distinctes, et ils ne se confondent pas parce qu'ils ne cohabitent jamais.

**La palette se montre en carrés de 20 px, sans nom.** C'est une vérification à l'œil —
« voir ce que la machine y a lu » (US-54) —, pas une liste à lire ; le code hexadécimal est
au survol, seul endroit du produit où une infobulle est permise parce qu'elle ne porte
aucune raison. Sans artwork, le bloc ne disparaît pas : il porte sa raison, comme tout
grisé du produit.

#### La toile, la réserve et les îlots

Écrit le 27 août 2026, au cadrage de T8, après une séance d'essai sur le produit tenu : la grille
montrait tout d'un coup d'œil et ne permettait d'organiser rien. Le tableau gagne une seconde vue,
et ce qui suit est ce qui, d'elle, relève de l'apparence.

**La règle est une phrase, et l'écran ne doit rien dire d'autre : la toile montre ce qui est
classé, la réserve contient ce qui reste à classer.** Tout en découle — pourquoi la réserve n'est
pas une grille de plus (c'est *la* grille du tableau, filtrée sur ce qui n'a pas de place),
pourquoi une carte sans groupe n'est jamais sur le plan, pourquoi tirer est le seul geste à
apprendre.

**L'interrupteur de vue est dans la barre du tableau**, à côté des crans de vignette, dans la
forme des segments existants : `grille` et `toile`. Un troisième contrôle de barre, et non un
onglet — l'écran ne se dédouble pas, c'est la même matière regardée autrement.

**L'îlot est du châssis, pas un objet dessiné.** Cadre de 1 px dans sa teinte, rayon 2 comme la
carte, fond de la même teinte à **16 %** — *8 % jusqu'au 28 août 2026, remonté le jour même : voir
§ La toile révisée, où la raison est écrite.* Son titre est le nom du groupe, en mono 10 px comme
toute mesure du produit : c'est un fait sur ce qu'il contient, pas une légende ; il porte à côté le
nombre de cartes, qui est un fait de la même sorte. **Ce titre vit désormais dans un bandeau en
teinte pleine et ne suit plus le zoom** — § La toile révisée, les deux échelles.

**Sa teinte est arrivée en T9, et l'absence de teinte reste le châssis** — `--bord-fort` pour le
cadre et pour le bandeau, `--fond-1` à 40 % pour le fond. Ce n'était pas un provisoire : un îlot
sans teinte est exactement ce que la phrase ci-dessus décrit, du châssis, et c'est pourquoi la
rangée de pastilles en compte **une de plus que la liste** — les teintes, plus celle qui montre le
châssis. La dernière n'est pas une teinte : c'est l'absence, montrée plutôt que dite, et elle évite
un glyphe en forme de croix. La liste close du produit ne bouge donc pas d'un nom. Écrit le 28 août
2026, en livrant T8, complété en livrant T9. *Six teintes alors, dix depuis le passage du même
jour ; la rangée compte donc onze pastilles, et l'argument ne dépend pas du nombre.*

**Le nom de l'îlot est la poignée de son menu, et c'est la seule surface vivante qu'il ait.** Un
îlot n'a pas d'identité, il a un nom — et depuis T7, *le libellé est la cible*. La bande de son
titre passe en `pointer-events: auto` sous un nœud qui reste en `none` ; l'argument est géométrique
et il se mesure : la boîte de l'îlot part **au-dessus** de la boîte englobante de ses membres, donc
ces 20 px ne recouvrent aucune carte, par construction. Une surface qui ne recouvre rien ne prend
rien à personne, là où rendre la *boîte* vivante aurait volé chaque prise de carte. Ce qu'on perd
est 20 px de plan par îlot pour le déplacement du plan, et ça se dit.

**Le menu s'ouvre au-dessus de la bande, et le nœud monte à `z-index: 10` en s'ouvrant.** Sans quoi
il se rendrait **sous** les cartes qui entourent l'îlot — c'est-à-dire sous exactement ce qu'il
décrit —, l'îlot étant posé à 0 et les cartes à 1. Il redescend en se refermant : un îlot resté
élevé volerait les clics de ses propres membres.

**Et il tient tant que la main est dessus.** Corrigé le 28 août 2026, à l'usage. Un menu ouvert par
le survol se referme quand on le quitte : il faut donc que l'aller *vers lui* ne soit pas un départ.
Le menu d'une carte est **dans** sa carte, et le motif marchait depuis T4 pour cette raison-là ;
celui de l'îlot est le **frère** de sa bande, et il se refermait à trois pixels du but — la teinte
d'un îlot n'était atteignable qu'en épinglant, c'est-à-dire par le geste précis que le survol
existait pour éviter. Il porte donc le même survol que la bande, et les 3 px qui les séparent sont
passés du dehors au dedans : même dessin, zone sensible continue.

**Et cette même bande est la poignée de l'îlot.** Écrit le 28 août 2026 en livrant T10, après une
séance sur le produit tenu : on déplace les cartes qu'on met dans un îlot, on ne déplace pas
l'îlot. T8 avait tranché l'inverse — « ce qui n'a pas d'existence propre n'a pas de poignée » — et
l'argument était juste sur la nature de l'îlot, faux sur le geste : *déplacer un rangement, c'est
déplacer ce qu'il contient* décrit exactement ce que l'écran écrit, ses cartes une par une, et non
une raison de s'en priver. Un îlot composé se pousse d'un bloc pour faire de la place au suivant,
et le faire carte par carte est le geste que la toile existe pour éviter.

**Aucune surface neuve** : la bande du titre était déjà la seule vivante, et elle porte les deux
gestes que la **distance** sépare. Sous trois pixels c'est un clic — sur le nom, il ouvre le menu de
teintes ; au-delà, c'est un déplacement. C'est le seul endroit du produit qui ait besoin de faire
cette distinction, et le seuil est à l'écran, pas sur le plan : c'est la main qui tremble, pas la
toile. Le curseur le dit — `grab` au repos, `grabbing` pendant —, et l'îlot **suit la main avec ses
cartes**, l'écriture venant au relâchement comme partout ailleurs. On le traverse toujours pour
prendre une carte ; on ne le déplace que par son titre.

**Déplacer un îlot ne reclasse rien.** Une carte lâchée décide de son groupe par l'endroit où elle
tombe ; un îlot lâché ne décide de rien, même posé sur un autre. Deux îlots qui se recouvrent
restaient déjà deux îlots — rien ne s'aligne tout seul sur cette toile.

**Et cette prise se montre, comme les deux autres.** Écrit le 28 août 2026, à l'usage : la bande
déplaçait déjà, mais rien ne le disait — l'îlot était le seul objet de la toile dont la prise était
à deviner, quand une carte montre les siennes dès qu'on l'approche. Une marque de 10 px paraît donc
en tête de la bande. **Ce n'est pas une troisième cible**, et c'est ce qui la sépare de la « poignée
dédiée dans un coin » écartée le même jour : elle est *dans* la bande, la bande entière déplace, et
la toucher fait exactement ce que toucher la bande fait. Elle dit où le geste vit, elle ne le prend
pas. Sa place est réservée au repos comme au survol — un nom qui se décalerait de 18 px quand la
main approche est ce que *l'œil reste exactement où il était* refuse.

*Sa forme et sa permanence ont changé le 28 août 2026, le jour même* : le carré de `--fond-3` révélé
au survol était le troisième carré identique de l'écran, et il ne disait rien. Il devient une grille
de **six points, permanente** — § La toile révisée, les trois prises. L'argument ci-dessus ne bouge
pas d'un mot ; seule la marque a cessé d'être muette.

**Et le nom garde son curseur à lui** : `pointer` sur le mot, `grab` sur le reste de la bande. Le
curseur reste ce qui sépare les gestes sur cette toile — `crosshair` tire un trait, `ew-resize`
règle une largeur —, mais il ne les sépare plus **seul** : depuis le 28 août 2026 la forme le fait
avant lui, et le curseur ne fait que confirmer une fois la main arrivée.

**La poignée de largeur est de 10 px, au coin bas-droit, et elle ne paraît qu'au survol de la
carte.** Même règle que le menu — *le survol révèle* —, même vocabulaire que le châssis : rayon 2,
cadre `--bord-fort`, fond `--fond-3`, aucune couleur neuve. Elle est à l'échelle du plan comme la
carte qu'elle règle, et la carte **suit la main pendant qu'on tire** : la largeur est une place
occupée, et une place ne se juge qu'en la voyant prise.

**Et toute poignée qu'on vise s'allume sous le pointeur**, cadre `--signal`. Ajouté le 28 août 2026.
La règle tient en deux temps : *le survol de l'objet révèle la poignée, le pointeur sur la poignée
dit qu'on l'a trouvée*. Une cible de 10 px sans retour se vise deux fois. Aucune couleur neuve —
`--signal` est déjà la poignée du curseur depuis T2, et c'est exactement le même sens : la pièce que
la main tient. La poignée de déplacement de l'îlot en est exclue, et c'est ce qui la définit : on ne
la vise pas, c'est la bande entière qui est la cible.

**Une carte sur la toile est la carte du tableau, sans un pixel de différence.** Même rayon 2,
même menu au survol, même coin plein pour l'artwork officiel. Une seconde forme de carte ferait
une troisième grille dans un produit qui n'en veut qu'une.

**La largeur libre s'aimante sur les trois largeurs de vignette du tableau** — celles qu'une carte
1×, 2× et 4× prend dans la grille, mesurées à l'ouverture et jamais écrites en dur. C'est le seul
endroit du produit où une mesure est continue ; l'aimant est ce qui l'empêche d'être arbitraire, et
le cran cesse d'être la seule valeur possible pour redevenir un repère.

**Rien ne se recompose tout seul sur la toile.** Aucun alignement automatique, aucune
distribution, aucune mise en page qui reflue quand une carte arrive : c'est *l'œil reste
exactement où il était* appliqué à la surface dont c'est la raison d'être. La liste close du
§ Motion ne s'allonge pas — le plan qui se déplace sous le geste n'est pas une animation, c'est le
geste.

**Et le fond ne bouge que quand on le déplace.** L'autre moitié de la même phrase, écrite le
28 août 2026 après l'avoir vue enfreinte : tirer un îlot par sa bande déplaçait l'îlot **et** le
plan, du même écart, si bien que l'îlot partait à deux fois la main et le pointillé du fond à une
fois. Une parallaxe — c'est-à-dire la seule chose que cette toile ne doit jamais faire, puisque tout
son propos est de savoir où sont ses cartes. Le plan ne se déplace désormais **que par le plan nu** :
ni sous une poignée, ni sous la bande d'un îlot, ni sous un menu ouvert, ni sous le champ d'une note,
ni tout seul quand un nœud tiré approche d'un bord. Ce document annonçait déjà le coût — *20 px de
plan par îlot* — sans qu'il fût payé nulle part ; il l'est.

**Un îlot qui va disparaître le dit pendant qu'on le fait disparaître.** Écrit le 28 août 2026 en
livrant T10. « Hors îlot, pas de groupe » a une conséquence que rien ne montrait : sortir la
**dernière** carte d'un groupe efface l'îlot, et avec lui sa teinte et les traits qui y
aboutissaient. Ctrl+Z les reposait déjà ; il ne les annonçait pas. Pendant le glissement, et
seulement quand le geste vide vraiment le groupe, le cadre et le nom de l'îlot passent en `--echec`
et le compte de ses cartes cède la place à *l'îlot part* — suivi du nombre de traits emportés
quand il y en a, parce que ceux-là partiraient sans qu'on les voie partir. La teinte, elle, n'est
pas nommée : elle est déjà en train de s'en aller sous les yeux, le cadre ayant changé de couleur.

**Ce n'est pas une confirmation, et le produit continue de n'en poser aucune.** Rien ne bloque, rien
ne demande « êtes-vous sûr » : c'est le même fait que la pile d'annulation retenait déjà, montré au
seul instant où l'auteur peut encore ne pas faire le geste. `--echec` reste ce qu'il a toujours été
dans ce document — *ce qui échoue ou ce qui détruit* —, et ne s'ajoute donc pas au vocabulaire.
Aucun glyphe neuf, aucune boîte de dialogue, aucune fente : la couleur et trois mots en mono 10 px,
là où le compte des cartes se lisait déjà.

**Et l'annulation ne se pose nulle part.** Le motif *L'annulation se pose dans une fente* a tranché qu'une annulation vit dans une
fente et jamais dans un bandeau, parce que le geste qu'elle rattrape est rare et explicite. Sur la
toile, le geste risqué est le déplacement — c'est-à-dire le geste permanent : une fente qui
clignote à chaque glissement serait du bruit. Ctrl+Z, sans surface, et la pile meurt en quittant
l'écran.

#### Le trait, la note, et la couleur qui entre

Écrit le 28 août 2026, en livrant T9. Trois choses s'ajoutent à la toile, et **aucune n'ajoute un
glyphe** : le produit garde les siens.

**Le trait est droit, en `--bord-fort` au repos, `--texte-2` au survol.** Droit et non courbe :
`PLAN.md` dit « un trait nu », et une courbe de Bézier ferait lire l'écran comme un outil de
diagrammes. `--bord-fort` et pas `--bord` parce qu'un lien n'est pas une séparation, c'est du
contenu — et `--bord` est sous le seuil où l'œil le trouve seul (§ Layout, mesuré). Il passe
**derrière** ce qu'il relie, comme un îlot est derrière ses cartes. Il ne prend **aucune teinte** :
la liste des surfaces colorables est **close**, et un trait coloré y ajouterait un vocabulaire de
couleur de plus sur un écran qui en compte déjà dix qui ne veulent rien dire. Un lien dit tout ce
qu'il a à dire par son mot et sa pointe. *La liste comptait trois surfaces à l'écriture — cadre
d'îlot, nom d'îlot, fond de note ; elle en compte quatre depuis le 28 août 2026, le bandeau ayant
pris le nom. C'est le nombre qui bouge, jamais la clôture.*

**Un lien qui a un mot se survole par son mot ; un lien muet se survole par sa bande.** C'est ce qui
rend le défaut muet payable : un trait de 1 px ne se survole pas, et la zone d'écoute de 20 px que
la librairie pose le long du tracé est de la surface, donc de son ressort. Le mot se pose au milieu
du trait, en **mono 10 px** sur une pastille `--fond-0` pour que le trait ne le traverse pas — c'est
un fait sur ce qui est là, comme le nom d'un îlot, pas une légende. Un lien muet n'a pas de cible au
clavier : c'est la contrepartie assumée du défaut muet, et elle se dit.

**Son pavé de réglage est le menu d'une carte, en plus court** — `--fond-1`, cadre `--bord`,
rayon 2, le fondu `paraitre` de 80 ms, le survol qui révèle et le clic qui épingle. Posé **sous** le
milieu du trait, à la gouttière de 9 px : jamais sur ce qu'il règle, la règle du menu de carte
appliquée. Trois rangées et rien de plus : `Mot`, un champ écrit au relâchement du focus comme
`groupe` et `note` ; `Pointe`, un bouton qui **est la phrase de son état** — `sans pointe` /
`pointe à l'arrivée`, le motif du bouton `silhouette` du barème ; et `Couper`, traité exactement
comme `Retirer` dans le menu d'une carte — mono 10 px, `--texte-3` qui vire à `--echec`. Il ne se
borne pas : un plan n'a pas de bord contre lequel se cogner, et une hauteur en pixels d'écran serait
fausse au premier cran de zoom.

**Il n'y a pas de troisième état de pointe, et pas de retournement.** Le sens vient du tracé — on
tire du départ vers l'arrivée, et la pointe ne fait que rendre visible ce que le geste a décidé.
Retourner un lien, c'est le couper et le retirer dans l'autre sens : deux gestes rares plutôt qu'un
contrôle permanent sur chaque trait.

**Une note s'écrit au double-clic sur le plan nu**, et le champ paraît à l'endroit exact du clic, à
la largeur d'une carte 1×, anneau `--lumiere`. C'est « créée là où elle s'applique » pris à la
lettre : un contrôle de barre aurait posé la note à sept cents pixels de l'endroit qui la demande,
et il aurait fallu ensuite l'y tirer. Le champ n'est pas encore la note — quitté vide, il ne crée
rien, et `Échap` l'abandonne : **le geste s'essaie sans rien casser**, ce qui est la moitié de sa
découverte. L'autre moitié est le corpus, par le `long` de *Vue*, dont le pointillé est à huit
pixels du segment qu'on vient de cliquer pour entrer dans la toile.

**Les pastilles ont la forme du carré de palette de l'écran Univers** — `h-5 w-5`, rayon 2,
cadre `--bord` —, parce qu'une pastille n'est pas une marque : c'est la couleur montrée, et c'est
la même défense que la palette, « une vérification à l'œil, pas une liste à lire ». La choisie prend
l'anneau `--lumiere`, qui ne veut dire que *choisi*. Elles vivent dans le menu de l'îlot pour un
îlot, dans le menu de la carte pour une note — jamais les deux au même endroit : deux champs voisins
dont l'un règle la carte et l'autre autre chose, c'est le constat `groupe` contre `famille` qui a
fait naître tout le corpus.

**Ce que la teinte colore, et ce qu'elle ne colore pas.** Îlot : cadre en teinte pleine à la place
de `--bord-fort`, fond de la même teinte à **16 %**, et **bandeau du titre en teinte pleine, nom en
`--fond-0`** — troisième et quatrième surfaces, ajoutées le 28 août 2026 ; le nom en teinte sur fond
sombre, qui tenait jusque-là, est § La toile révisée. Note : fond à **16 %**, et le bord passe de
`--bord` à la teinte. **L'anneau `--lumiere` d'une carte choisie prend le
bord, jamais le fond** — les deux ne se disputent que le bord, et le bord suffit à dire *choisi*.
Faire céder les deux rendait la teinte invisible tant que la carte restait choisie, c'est-à-dire à
l'instant précis où on vient de la choisir, puisqu'on choisit la pastille depuis le menu de la
carte. Mesuré à l'atelier lancé le 28 août 2026.

#### La toile révisée — deux échelles, trois prises, un bandeau

Écrit le 28 août 2026, après une séance à l'atelier tenu qui a rendu huit corrections d'un coup.
Elles n'en font qu'une : **la toile s'était construite en héritant des motifs de la grille, et la
grille n'est pas faite pour ça.** Ce qui suit remplace ce que les sous-sections précédentes disent
du bandeau, des prises et du classement ; le reste tient.

**La règle mère, et elle est dans `docs/DESIGN.md` § Sur la toile, deux échelles : ce qui se lit
est en pixels d'écran, ce qui se mesure est en pixels de plan.** L'image, la carte, la note, la
boîte de l'îlot sont du plan — ce sont des places. Le nom d'un îlot, son compte, le mot d'un trait
et les trois prises sont de l'écran — ce sont des lectures et des cibles. Un nom d'îlot illisible
à 0,3× et une poignée de 30 px à 2,5× étaient la même panne vue par ses deux bouts, et il en
fallait une seule réponse.

**Et la règle sœur, qui autorise tout le reste : la grille montre, la toile range.** Le principe du
produit — *chaque décision retire une concurrence à la grille* — a été appliqué ici à une surface
où il n'y a rien à juger. Sur la toile les images sont déjà retenues ; ce qui porte le geste a donc
le droit de se voir. L'exception est écrite dans `docs/DESIGN.md` § Aesthetic Direction pour qu'elle
ne se fasse pas défaire par distraction.

**Le bandeau d'un îlot passe en teinte pleine, et son nom en `--fond-0`.** La bande de 20 px était
transparente, et le nom portait la teinte sur un fond à 8 % : c'est-à-dire qu'un îlot ne se
nommait de loin que si on savait déjà où regarder. Elle devient une surface — quatrième et
dernière chose que la teinte a le droit de colorer, avec le cadre, le fond et le fond d'une note.
**Et c'est le bandeau qui décide de la couleur de son texte, pas le châssis.** Un bandeau teinté est
clair : le nom s'y pose en `--fond-0`, qui vaut 5,2 : 1 sur les dix. Un îlot sans teinte prend
`--bord-fort` — ce qui reste exactement ce que ce document dit qu'il est, du châssis montré —, et
`--bord-fort` est sombre : le nom y reste en `--texte`, à 8,4 : 1. **C'est la seule conditionnelle
que la toile s'autorise, et elle est mécanique, pas décorative** : `--fond-0` sur `--bord-fort` vaut
1,9 : 1, c'est-à-dire illisible. Mesuré en écrivant, et c'est ce qui a fait la conditionnelle — la
première écriture donnait un bandeau gris avec du texte noir dessus. **Le compte est la couleur du
nom à 90 %** : un seul nombre pour les deux cas, jamais sous 4,7 : 1.

**Le fond d'îlot double, de 8 à 16 %.** Le 8 % était écrit « sous le seuil où l'œil la trouve
seule, assez pour délimiter » — vrai, et c'était le problème : on posait une teinte et on ne
voyait pas laquelle. La saturation, elle, ne bouge pas au-delà de 30 % (`docs/DESIGN.md`
§ Les teintes d'îlot) : **la visibilité se gagne à l'opacité, jamais à la saturation**, parce que
c'est la saturation seule qui sépare un rangement d'un état.

**Trois prises, trois formes — et la forme remplace le curseur.** T8 avait tranché « aucun pixel de
vocabulaire neuf, seul le curseur diffère », et le produit portait trois carrés de 10 px
identiques. C'est la **troisième** fois que cette décision cède à l'usage : la prise de l'îlot a dû
paraître, puis les poignées ont dû s'allumer sous le pointeur, et il fallait encore les distinguer.
Un curseur ne se voit pas de loin, et sur cette toile on cherche une cible **pendant qu'on regarde
ailleurs**.

| Forme | Ce qu'elle fait | Où | Au repos |
|---|---|---|---|
| **Six points**, 12 px | on saisit — déplacer l'îlot | en tête du bandeau | **permanente** |
| **Rond**, 12 px | on tire un trait | hors du bord droit, à mi-hauteur | **permanente** |
| **Carré**, 10 px | on tire une dimension | coin bas-droit de la carte | au survol |

**Et c'est la permanence qui les sépare autant que la forme.** *Le survol révèle* garde ses raisons
partout ailleurs, et il en garde une ici : le carré règle **la carte qu'on regarde déjà**, donc il
n'a rien à faire avant que la main soit dessus. Le rond et les six points servent à **relier ou
déplacer deux objets**, c'est-à-dire à viser une cible qui n'est pas sous l'œil — la toile est la
seule surface du produit où ça arrive, et c'est la raison pour laquelle le motif y cède. Ils ne
cèdent pas ailleurs : la grille d'assets ne change pas d'un pixel.

**Le rond sort entièrement de la carte, et il déborde de 3 px sur la voisine.** La gouttière entre
deux cartes d'un îlot est de 9 px, un rond permanent de 12 en prend 12 : le compte est écrit parce
qu'il ne se rattrape pas. Il se rend au-dessus de la voisine et le mordant est sur son bord, pas
sur son image. **L'autre branche coûtait plus cher** : à cheval sur le bord, il cachait six pixels
de sprite en permanence, sur chaque carte, c'est-à-dire sur la seule chose que l'écran existe pour
montrer. Il passe en `--signal` sous le pointeur, comme les deux autres depuis T10.

**Les six points sont le premier glyphe du produit, et ils viennent avec leur règle d'admission.**
Ce document dit « aucune icône illustrative » depuis l'origine, et il n'y a jamais eu d'exception.
En voici une, et la règle qui la borne : **un glyphe n'entre que là où aucun mot ne peut tenir et
où la forme est déjà lue sans apprentissage.** Dix-huit pixels de bandeau avant le nom n'accueillent
pas un mot ; une grille de six points est lue comme *ça se saisit* par quiconque a déjà touché une
interface. Le carré de 10 px qu'elle remplace échouait aux deux : il ne disait rien, et il était le
troisième carré identique de l'écran — ce que T10 avait déjà admis en l'écrivant. **Coût** : le
produit a désormais un glyphe, donc un endroit où en ajouter un deuxième. La règle ci-dessus est
tout ce qui l'en empêche.

**Ce qui arrive de la réserve ne se pose jamais sur une carte.** Lâchée dans un îlot déjà rempli,
une carte se posait sous le pointeur et donc **derrière** ce qui s'y trouvait. Elle glisse
maintenant vers la droite, puis à la ligne, jusqu'à la première place libre : la règle que
`disposer` applique déjà aux cartes d'un îlot à l'ouverture, appliquée à une carte au lieu d'un
lot. Rien d'autre ne bouge — *l'œil reste exactement où il était*, et **ce n'est donc pas une mise
en page qui reflue** : la toile ne se recompose toujours pas toute seule.

**Et la règle s'arrête au bord de la réserve.** Un déplacement **sur** le plan garde le droit de
recouvrir, et c'est la ligne qui rend la première défendable : la main y voit les deux cartes et
décide ; un empilement voulu est un geste légitime sur une toile. Le glissement depuis la réserve
est **aveugle** — le fantôme que le navigateur traîne ne dit ni la taille réelle au zoom courant,
ni ce qu'il y a dessous. La règle ne corrige que le geste qui ne peut pas se voir.

**On entre par le centre, on sort par le tout.** Le classement se décidait au **centre** de la
carte dans les deux sens, et il suffisait d'en passer la moitié par-dessus la bordure pour qu'un
groupe s'efface — c'est-à-dire qu'un îlot lâchait une carte qui était encore visiblement dedans.
Les deux seuils se séparent : une carte **entre** dans un îlot dès que son centre y est, elle n'en
**sort** que lorsqu'elle n'en touche plus rien. C'est l'hystérésis, et c'est le remède écrit d'un
classement nerveux.

**Et quand les deux se disputent, entrer l'emporte sur rester.** Deux îlots voisins peuvent tenir
la même carte — l'un parce qu'elle le touche encore, l'autre parce que son centre y est déjà —, et
une carte n'a qu'un groupe. L'ordre est donc fixe : le centre d'abord, l'ancien îlot ensuite. Sans
lui, le classement dépendrait de l'ordre de la liste, ce qui est la manière la plus discrète de
n'avoir aucune règle. **Coût** : une carte peut être à moitié dehors en étant encore dedans, et le
cadre s'élargit au relâchement pour le dire.

**Un îlot dit ce qu'il vaudra, et non ce qu'il vaut.** T10 avait donné cette voix à l'îlot pour un
seul cas — celui où il disparaît. Elle vaut pour les trois, parce que c'est le même instant : celui
où l'auteur peut encore ne pas faire le geste.

| Pendant le glissement | Le cadre | Le fond | Le compte |
|---|---|---|---|
| **il accueille** | teinte pleine, inchangé | 16 % → **28 %** | **+1** |
| **il perd une carte** | teinte, **en pointillé** | **vidé** | **−1** |
| **il part** | `--echec` | `--echec` à 8 % | *l'îlot part — n traits* |

**Le trait porte le message, et la couleur reste réservée.** La demande disait « un contour qui
change de couleur » ; la seule couleur disponible pour dire *ça s'en va* est `--echec`, et la
dépenser sur un geste anodin — retirer une carte d'un îlot qui en compte douze — ferait cesser de
voir le seul avertissement qui compte, celui de la dernière carte. Le **pointillé** dit *cette
limite n'est pas celle que tu vas laisser* sans emprunter un mot à la sémantique, et le fond vidé
le redit sur toute la surface, là où l'œil est réellement posé pendant qu'on tire. Le troisième
état ne change pas d'un pixel.

**Le compte est l'argument, et il était déjà là.** La bande portait *n cartes* au repos et *l'îlot
part* pendant la menace : montrer la valeur **future** au lieu de la valeur courante ne demande ni
surface, ni couleur, ni glyphe. C'est le fait, dit à temps — la phrase de T10, appliquée aux trois
cas au lieu d'un.

**`+ note` entre dans la barre du tableau, et le double-clic reste.** T9 avait refusé un contrôle
de barre, et l'argument était juste : *une note se crée là où elle s'applique*, un bouton la pose
à sept cents pixels de l'endroit qui la demande. Il ne couvrait pas le vrai trou, qui est en amont :
**il n'existait aucun moyen d'écrire une note sans en avoir d'abord le texte dans le
presse-papier** — le double-clic n'existe que sur le plan, et la vue grille n'a pas de plan.

Le contrôle vit donc à gauche du segment *Vue*, en bouton compact de 24 px, et **il fait ce que la
vue permet** : en grille la note naît en réserve, qui est très exactement l'endroit de ce qui n'est
pas encore classé ; en toile le brouillon paraît au centre de ce que l'écran montre, c'est-à-dire
au milieu de ce qu'on regarde et non à sept cents pixels de là. Le double-clic sur le plan nu ne
bouge pas : il reste le geste **précis**, celui qui désigne l'endroit. **Coût, et le produit n'en a
nulle part ailleurs** : deux chemins vers un même résultat. Ils ne se doublent pas — l'un est
découvrable, l'autre est rapide —, et c'est le premier qui manquait.

---

### L'écran Découpe, et le cadre qui est l'image

**`1fr · 380px`, et l'image passe à gauche.** L'écran Univers met ses réglages à gauche
parce que l'univers *est* son sujet ; ici le sujet est la planche, et c'est elle qui prend la
largeur. 380 reste la colonne de réglages du produit — la troisième largeur qu'on s'interdit
d'inventer.

**Un écran, pas un panneau, et c'est le geste qui le dit.** On dessine des rectangles sur une
image de mille pixels ; la fiche en fait 380. Il couvre donc l'atelier, comme l'écran Univers,
et **porte sa propre fente de refus** pour la même raison : une raison envoyée à la barre
d'état de l'atelier serait rendue derrière lui, invisible au moment précis où elle compte.

**Il s'ouvre depuis la fiche, jamais depuis la barre d'outils.** On découpe **une** image,
pas une sélection — et le geste vit donc là où vivent les gestes d'une image seule. Dans la
rangée du jugement, en mono 10 px, entre le coût et Supprimer : rien ne permet de savoir
d'avance qu'une image est une planche, donc rien ne doit paraître ou disparaître selon ce
qu'on croit deviner.

**Le cadre de la planche est mis à l'échelle par calcul, pas par le CSS.** Un seul facteur —
celui qui fait entrer la planche dans la place —, et le cadre **est** l'image, au pixel près.
Décidé le 27 août 2026 en mesurant : `aspect-ratio` cède devant `max-height`, le navigateur
rabote la hauteur sans redéduire la largeur, et un cadre de 1388 × 874 pour une image carrée
décale de vingt pixels tout ce qui est posé dessus en pourcentage.

**Les rectangles reprennent la grammaire de la tuile, sans y ajouter une couleur.** Anneau
`--lumiere` pour « choisi », bord `--signal` sinon, et le numéro en mono 8,5 px sur le même
fond `rgba(11,13,16,.82)` que la pastille d'une tuile. Ce numéro est un fait mesuré — c'est
l'ordre de lecture, et c'est celui que la découpe garde.

---

### Le réglage qu'on désigne sur l'image — deux, et ils suivent les mêmes règles

*Écrit en E3, en posant la pipette à côté du rectangle de recadrage.*

Presque tous les réglages du produit se règlent dans l'absolu : un curseur, un segment, un
nombre. **Deux ne le peuvent pas**, parce que ce qu'ils désignent n'existe que dans cette
image-là — le rectangle du recadrage, et le point de la pipette. On ne dessine pas un cadrage en
tapant quatre nombres ; on ne désigne pas un creux de fond en tapant un code de couleur. Ils
partagent donc quatre règles, et il n'y en a pas de cinquième.

**Ils se posent sur le brut, jamais sur le rendu.** Les deux sont comptés en pixels de l'image
d'origine — coins inclus pour le rectangle, une seule convention dans tout le produit. C'est ce
qui les fait survivre aux réglages placés avant eux ; c'est aussi ce qui interdit de les poser
sur un rendu, que le recadrage et la remise sur grille ont déjà déplacé. Un cercle posé sur un
rendu recadré désignerait un autre pixel que celui qu'on croit toucher.

**Le cadre *est* l'image, mis à l'échelle par calcul.** Même règle et même raison que le cadre
de la Découpe, ci-dessus : une boîte qui ment décale de vingt pixels tout ce qu'on pose dessus.

**Une seule marque, en `--lumiere`, et rien d'autre.** La lampe de la table éclaire ce qu'on
vise : un liseré et un voile à 10 % pour le rectangle, un cercle de 15 px avec le pixel visé
marqué en son centre pour la pipette. Aucune couleur neuve, aucune poignée, aucun tracé — ces
tables ne se peignent pas, et c'est ce qui laisse le comparateur libre, y compris *brut*
pendant qu'on règle.

> ⚠ **La phrase a été fausse du premier jour au 1<sup>er</sup> septembre 2026, et le code le
> disait.** Elle parlait alors de *quatre modes libres* ; ils ne l'étaient que sur deux d'entre
> eux. La surface qui vise et celle qui trace étaient gardées par
> `mode === "rendu" || mode === "brut"`, comme le rectangle de recadrage : **en côte à côte et
> en superposé, la pipette et le tracé n'existaient tout simplement pas**, la scène ne rendait
> que deux balises d'image. Ce que la phrase décrivait bien était le contraire de ce qui était
> construit — les deux vues faites pour voir ce qu'une passe a changé étaient exactement celles
> où l'on ne pouvait plus rien régler.
>
> **Réparé le même jour**, et la phrase est redevenue vraie en perdant un mot : le contrôle
> unique de quatre segments est coupé en deux — *sur* `brut · rendu`, qui dit qui porte
> l'outil, et *témoin* `aucun · à côté · par-dessus`, qui ne porte jamais rien. Les quatre
> modes n'existent plus, donc la phrase ne les compte plus. **Une comparaison ne retire jamais
> un geste ; elle pose un témoin à côté** — le dessin est dans
> `docs/maquettes-v2.1/03bis-comparer-sans-lacher-l-outil.html`.

**La surface n'existe que pendant le geste, et le geste se termine.** Elle remplace l'image
seulement quand la table concernée est ouverte, et pour la pipette seulement quand une passe
attend son point : un curseur en croix permanent ferait de chaque regard sur l'image un risque
de clic. Le clic pose *et* désarme — une visée qui reste armée transforme le regard suivant en
déplacement de ce qu'on vient de poser.

---

### L'écran Guide, et la seule prose du produit

**C'est un écran, et le cadrage le dit comme il l'a dit pour les deux autres.** Univers est
« au début d'un projet, puis ponctuel » ; le Guide l'est davantage — on l'ouvre quand on ne
sait pas, on le ferme quand on sait. Il couvre donc l'Atelier au lieu de s'y ajouter, comme
Univers et Découpe, et pour la même raison : rien de ce qu'il porte ne se règle en
regardant la grille.

**Il n'a pas de fente de refus, et c'est la preuve qu'on a compris la règle.** Univers et
Découpe en portent une parce qu'ils couvrent la barre d'état et qu'un refus provoqué chez
eux serait rendu derrière eux. Le Guide ne provoque aucun refus : il ne demande rien au
serveur, ne dépense rien, ne peut pas échouer. Le motif ne s'applique pas faute de déclencheur,
et on ne pose pas une fente vide pour la symétrie.

**Sa place dans la barre de tête est à droite, après le seul écart du produit.** Univers,
Catalogue et le nom du projet parlent du travail en cours ; le Guide parle de l'outil. Il
est donc séparé — un `lg` de 24 px, la seule respiration d'une barre de 44 px — et il est le
seul élément de cette barre qui ne change jamais d'état. `?` l'ouvre au clavier, `Échap` le
ferme, comme partout.

#### `240px · 1fr`, et la seule largeur maximale du produit

240 est la colonne de l'arbre, réemployée sans discussion : c'est *où ça se range*, et un
sommaire n'est rien d'autre. Aucune troisième largeur n'est inventée, comme le § Layout et
l'écran Univers l'ont déjà tranché.

**La prose est bornée à 72 caractères, et c'est une exception assumée au § Layout.** « Max
content width : aucune. L'écran large est la ressource du produit, on la dépense » a été
écrit pour la grille — la chose qui *gagne* à s'étaler. La prose est la seule matière du
produit qui **perde** à recevoir de la largeur : à 1 600 px une ligne de français fait
190 signes, et le retour à la ligne suivante devient une recherche. La règle visait la
planche contact ; le guide est son contraire exact, et c'est le seul endroit où l'exception
vaut.

**Et l'unité n'est pas `ch` — mesuré au navigateur, pas déduit.** `72ch` rend **671 px**, soit
88 signes de français : `ch` vaut l'avance du zéro, et le chiffre d'Instrument Sans est bien
plus large que ses bas-de-casse. La valeur juste est **`36em`**, **posé sur la taille de la prose** :
540 px pour une avance moyenne mesurée à 7,69 px — **70 signes par ligne**. Cette phrase
annonçait 504 px et 74 signes jusqu'au 31 août 2026, et les deux nombres venaient d'une avance
mesurée à 13 px appliquée à une prose de 15. Posé sans le dire, `36em` héritait les 13 px du
corps et rendait **468 px, soit 61 signes** — c'est ce que l'écran de E20 a montré, et la borne
porte désormais sa taille en toutes lettres. C'est la même erreur de famille que
`aspect-ratio` cédant devant `max-height` sur le cadre de la planche : une unité qui a l'air
de dire ce qu'on veut, et qui mesure autre chose.

**La colonne de prose est calée à gauche, jamais centrée**, et la place qui reste à droite
reste **vide**. Centrer désalignerait le texte de son sommaire pour rien, et remplir la
marge de notes, de figures ou de rappels serait recommencer la maquette écartée sur le seul
écran qui pouvait s'en passer. Le Guide est la seule surface calme d'un produit dense : ce
vide *est* ce qui dit qu'on est sorti de l'atelier.

#### La typographie ne gagne aucun usage

**Instrument Serif reste à trois emplois.** Le titre de l'écran est un titre d'écran — le
deuxième emploi, inchangé. Les titres de section du guide, eux, **ne sont pas en serif** :
ils reprennent la forme de l'en-tête de panneau, déjà dans le produit — sans 12,5 px,
majuscules, `letter-spacing .11em`, `--texte-3` —, séparés du texte précédent par 48 px.

C'est un refus, et il est délibéré. Une hiérarchie de sous-titres en serif de 24 px, sur la
seule page de prose du produit, est *exactement* le basculement en blog que la règle 1 du
§ Typography annonce en toutes lettres : « trois usages de trop et le produit bascule en
blog ». La hiérarchie est portée par l'espace, ce que la direction esthétique demande depuis
la première ligne — *la typographie et l'espace font tout le travail*.

**Le corps est à 15 px, interligne 1,65** — le haut de la ligne « prose longue » de
l'échelle, aucune valeur neuve. Les mesures et les noms de fichiers y restent en mono, par
la règle 2 : un guide qui écrirait `$0,067` ou `donnees/cartes.json` en sans mentirait sur
ce qu'ils sont.

#### Quatre parties, et la troisième est le corpus des infobulles

| Partie | Ce qu'elle porte |
|---|---|
| **Le geste** | La boucle quotidienne dans l'ordre où on la fait : écrire, générer, juger, garder. Une page, aucune option. |
| **Les écrans** | Atelier, Univers, Découpe, Bibliothèque — ce que chacun est *pour*, et pourquoi c'est un écran séparé plutôt qu'un panneau de plus. |
| **Les réglages** | Un par un, **groupés par écran** — univers, atelier, retouche, découpe. C'est le même texte que les infobulles, rendu à la file : les trois lignes, plus le contexte que le panneau de 280 px ne peut pas porter. Le groupe est un écran et non un thème : quand on cherche une explication, on se souvient d'où l'on était. |
| **Ce qui n'est pas encore écrit** | La liste des réglages sans entrée. Un manque de guide est un fait sur le guide — et **rien d'autre n'y entre** : un seuil interne que personne ne peut toucher n'est pas un manque, c'est une décision, et elle vit au § Motion. |

**Le sommaire est l'arbre, sans en être un.** Rangées de 26 px, actif sur `--fond-3`, comme
la colonne de gauche de l'Atelier — mais sans `+`, sans repli et sans menu : il n'y a rien à
créer dans un guide. Une seule grammaire de liste dans le produit, et elle sait déjà se
taire quand on ne lui demande que de conduire.

**Une infobulle mène ici, et le guide n'en porte aucune.** Le lien `Le guide ›` de la
troisième ligne ouvre l'écran à l'ancre du réglage. En sens inverse rien ne survole : la
forme longue *est* déjà l'explication, et un pointillé sur un texte qui explique serait la
promesse d'un troisième niveau qui n'existe pas.

---

### L'écran Personnages, et la matrice qui n'est pas une grille

Écrit le 28 août 2026, en livrant C1. Comme l'écran Univers, il est **dérivé** des motifs de ce
document plutôt qu'inventé — et la dérivation a corrigé le code trois fois, ce qui est la seule
raison valable de tenir ce fichier.

**`380px · 1fr`, le jeu à gauche, ses manques à droite.** Aucune largeur neuve : 380 est la
colonne de la fiche asset, de l'écran Univers et de la réserve, réemployée pour ce qu'elle nomme
déjà — *ce qu'on pose et ce qu'on manipule*. Elle porte ici les deux listes qu'on écrit une fois,
les personnages et les attitudes du jeu ; le `1fr` porte ce qu'on lit, ligne à ligne. C'est la
répartition de l'écran Découpe prise par l'autre bout : là le sujet était une planche et prenait
la largeur ; ici le sujet est *ce qui manque*, et ce qui manque est une liste.

**Il couvre l'atelier, donc il porte sa propre fente de refus**, dans sa barre de tête de 44 px —
tiret de 8 px, mono 10 px, `--echec`. Le motif ne change pas, seul son emplacement suit l'écran
qui l'a provoqué, comme pour Univers et Découpe.

**Ce n'est pas une grille d'assets, et la privation est le motif.** Ni recherche, ni filtre, ni
sélection multiple, ni vignette dans la liste des personnages. « Une seule grille dans tout le
produit » ne se tient pas en interdisant les grilles, mais en refusant à celle-ci les gestes qui
en feraient une — c'est exactement ce que la réserve de T8 avait fait, par le même moyen. Une
ligne par attitude, 52 px de haut au minimum, les images de la case posées dedans en 44 px : on
lit une colonne, on ne balaie pas une planche contact.

**La case vide est une case, pas un trou.** Même hauteur que les autres, `rien encore` en mono
10 px `--texte-3`, et le compte `m / n` en mono 9,5 px à droite. Une case qui disparaîtrait — ou
qui se réduirait à une ligne fine — rendrait l'écran illisible au moment précis où il sert :
*savoir quoi lancer sans tenir la liste dans sa tête* suppose que le manque occupe autant de
place que le fait.

**Et le manque n'a pas de couleur.** Le compte passe en `--ok` quand la case est pleine, et reste
en `--texte-3` sinon. C'est délibéré : `--echec` veut dire *ce qui échoue ou ce qui détruit*, et
un jeu en cours de fabrication n'échoue pas — il est en cours. Une colonne de rouge à l'ouverture
d'un projet neuf dirait que quelque chose est cassé, quand tout est normal. Le vert dit *fini*,
l'absence de couleur dit *pas encore*, et il n'y a pas de troisième état.

**Le rang de 26 px, encore.** La liste des personnages et les lignes du plan reprennent la rangée
de l'arbre — actif sur `--fond-3`, survol `--fond-2`, 80 ms. Aucune hauteur neuve, aucune
grammaire de liste neuve : le produit en a une, et elle sait déjà se taire quand on ne lui demande
que de conduire (§ L'écran Guide).

#### La coche porte une attitude, jamais une image

Écrit le 28 août 2026, en livrant C2. **C'est le seul endroit du produit où la privation de C1 se
discute**, et elle ne cède pas : *la matrice n'offre ni recherche, ni filtres, ni sélection
multiple*. Une case à cocher paraît pourtant sur chaque rangée — et l'invariant tient, parce que
ce qui se coche est une **ligne du plan du jeu**, pas une vignette.

La différence n'est pas de vocabulaire, c'est elle qui empêche l'écran de redevenir une seconde
planche contact. Les images d'une case restent ce qu'elles étaient : on ne les coche pas, on ne
les glisse pas, on ne les compte pas. Un essai d'écran confronte l'intitulé de chaque coche à
`Faire partir … avec les autres` — il tombe le jour où l'une d'elles passera sur une vignette, et
c'est son métier.

La coche est en `--signal`, à gauche du nom de l'attitude, avant le rang de 26 px : c'est la
colonne de ce qu'on décide, et elle précède ce qu'on lit.

#### Le geste du lot n'existe qu'à partir de deux

`Fabriquer ensemble ›` est absent tant que deux attitudes ne sont pas cochées — **absent, pas
grisé**. C'est la bascule de `+ personnage` et celle de la réserve avant elle : le § Le grisé
porte sa raison suppose une chose indisponible, et ici il n'y a pas de chose.

Ce qu'il annonce, il l'annonce en clair, en mono 10 px `--texte-3` à sa gauche : **N attitudes,
un seul appel**. Le prix, lui, ne se lit pas ici : il se lit dans l'atelier, dans le `<dl>` de
*Ce qui part*, à côté du bouton qui paie — et c'est là aussi qu'on lit ce qu'un compte faux
coûterait. *La matrice arme, l'atelier tire* vaut pour l'argent comme pour le geste.

#### Ce qu'un compte faux coûterait — une rangée, jamais une probabilité

Elle entre dans le `<dl>` de *Ce qui part*, sous *coût attendu*, dans la forme des autres :
`un compte faux` à gauche, `≈ $0,0245 à repayer` à droite. Le chiffre est **le même** que celui
du dessus, et ce n'est pas une redite : un lot refusé sur le compte est un lot entier à repayer
au prix plein, et c'est la seconde moitié de l'arbitrage que l'auteur doit faire seul.

**Aucune probabilité, nulle part**, et aucune couleur d'alarme. Le produit dit ce que ça
coûterait ; il ne sait pas si ça arrivera, et l'écrire serait un nombre qui ne mesure rien —
la règle du coût attendu et de l'attente de la jauge, appliquée une troisième fois. Le survol
porte le fait : *le lot entier est refusé, rien n'entre, et il se relance au prix plein*.

#### Les mesures d'un lot se lisent sur la rangée de leur case

Deux lignes en mono 9,5 px `--texte-3`, à droite des vignettes et avant le compte `m / n` :
`ressemblance 0,98 · case 3` et `grille 4 px · dérive 1,00×`. Elles ne paraissent que sur une
case sortie d'une planche — l'immense majorité des images du produit n'en sortent pas, et une
colonne vide en permanence serait du cadrage affiché.

**Le chiffre et son jumeau, jamais un seuil, jamais une couleur.** `--echec` veut dire *ce qui
échoue ou ce qui détruit*, et une case qui ressemble à sa voisine n'échoue pas : elle est là,
gardée, et c'est l'auteur qui décide de la relancer. Nommer le jumeau est ce qui rend le chiffre
utile — « 0,98 » tout seul demanderait de chercher à quoi.

#### Ce qu'un personnage écarte se relègue ; ce qu'une génération écarte reste barré

Deux listes de cet écran portent un décochage, et **elles ne le rendent pas de la même façon** —
ce qui mérite d'être écrit, parce que la contradiction est apparente.

Une attitude qu'un personnage ne tient pas **sort de la liste** et va se ranger sous `pas pour
lui`, une rangée de boutons éteints en mono 10 px, `--fond-1` cadré `--bord`, un clic pour la
rendre. Une référence écartée, elle, **reste à sa place**, barrée et en `--texte-3`.

La différence est celle de la durée. Un figurant garde ses deux attitudes pendant des semaines :
cinq rangées barrées en permanence seraient cinq rangées de bruit dans la seule liste dont le
métier est de dire ce qui manque. Un décochage de référence se lit **au moment où l'on paie**,
une fois, et une ligne qui disparaîtrait à cet instant-là ne laisserait aucun moyen de la
remettre. *Ce qui est durable se relègue, ce qui est en cours reste sous les yeux.*

#### Le second coin d'une carte

**`--epingle`, plein, 13 px, en haut à gauche : cette carte est le concept art d'un personnage.**
C'est le premier coin ajouté depuis le favori de T1, et il n'ouvre rien de neuf.

La forme, parce que le § La tuile l'a tranché : *ce que tu poses est une forme, ce que le système
constate est un mot* — une désignation est posée à la main, elle a donc droit au triangle.
L'autre coin, parce qu'une carte peut être les deux à la fois : artwork officiel en `--signal` à
droite, concept art en `--epingle` à gauche, et rien à arbitrer. La teinte, parce qu'`--epingle`
veut dire depuis T1 *arrêté à un instant, que le système ne bougera pas tout seul, et que seul un
geste de l'auteur relance* — c'est la définition exacte d'une image qu'on a désignée comme corps.

**Le nom du personnage prend le pied de la carte, il n'ajoute pas de rangée.** Le pied a un seul
emplacement de mot, et quatre locataires qui ne cohabitent jamais : la famille quand c'est un
artwork officiel, sinon les personnages désignés, sinon le groupe, sinon la provenance. Même
construction que la fente sous Générer, et pour la même raison — un fait par fente, le plus
spécifique gagne.

**Coût assumé, et il faut l'écrire : les deux coins d'une carte sont pris.** Une troisième
désignation posée à la main n'aura plus de coin. Ce n'est pas un problème tant que rien ne la
demande, mais le vocabulaire des marques est désormais clos par la géométrie, et non plus par une
décision qu'on pourrait revoir.

#### La bande « Pour » — l'intention se lit à côté du bouton qui paie, et elle porte N cases depuis C2

**La matrice arme, l'atelier tire.** Cliquer une case vide ne dépense rien : ça remplit le prompt,
ça retient la case visée, et ça rend la main. Le produit garde donc **un seul endroit d'où l'on
paie**, et l'apparence doit dire lequel.

La case visée se pose dans une bande au-dessus du prompt, à côté de celle des réinjections, et
**elle n'existe que quand il y a quelque chose dedans** — la règle de la bande des réinjections,
mot pour mot : une rangée vide en permanence serait du cadrage affiché. Le nom du personnage en
sans 11,5 px, l'attitude en mono 10 px `--signal`, dans un cadre `--signal` sur un fond de la même
teinte à 13 %, et un `×` pour la défaire. **Armer n'est pas s'engager.**

Le fond à 13 % n'est pas une couleur neuve : c'est la recette du segment choisi, appliquée au même
token. Et le `×` est celui de l'arbre et de la bande des réinjections — mono 10 px, `--texte-3`
qui vire à `--echec` —, jamais un glyphe de plus.

**Un lot y tient dans le même cadre, et le nom du personnage ne se répète pas** : il est écrit une
fois, les attitudes suivent, chacune avec son `×`. Un lot n'en vise qu'un, et neuf cadres côte à
côte auraient répété neuf fois le même mot. La bande gagne alors deux choses et pas une de plus :
`N attitudes, un seul appel` en mono 10 px `--texte-3`, et `tout retirer` ancré à droite —
retirer une attitude n'est pas tout défaire, et il faut les deux gestes.

#### Le coût attendu est une rangée, pas un bloc

Il entre dans le `<dl>` de *Ce qui part*, en dernier, dans la forme des cinq autres : libellé
`--texte-3` à gauche, valeur `--texte-2` à droite, mono. `≈ $0,067`, ou **`jamais appelé`**.

**Son libellé suit l'unité du modèle** (F2) : *coût attendu* chez un fournisseur qui facture,
*ce qu'il prendra* chez un fournisseur qui compte autrement — et la valeur porte le mot de
son unité, `≈ 1 jeton`. **Ce qui reste chez ce fournisseur-là s'écrit juste en dessous**, sur
les deux colonnes : c'est une phrase et non une mesure alignée, et c'est **la même phrase**
que porte l'écran de confirmation — écrite à un seul endroit, parce que deux calculs à deux
endroits ont déjà annoncé deux chiffres pour le même appel.

**Il est mesuré, jamais lu dans un tarif** — le produit n'en porte aucun, et « le coût réel
facturé fait foi » partout ailleurs. C'est la médiane de ce que ce modèle-là a réellement facturé
sur cette machine, et l'apparence en tire sa seule conséquence : quand il n'y a rien à mesurer,
l'écran le dit en toutes lettres au lieu d'afficher un zéro. *L'attente s'apprend au lieu d'être
écrite* (§ La jauge de la fiche) ; le prix aussi.

Le survol porte la nuance — *médiane des derniers appels réussis de ce modèle*. Il est permis par
le § L'infobulle, dont le test est binaire : son absence n'empêche aucun geste.

#### Ce qui part, ligne par ligne, et la phrase de préséance au-dessus

**Annoncer un coût sans montrer ce qui le fait n'est utile qu'à moitié.** Le bloc *Ce qui part*
disait depuis T4 *combien* d'images partent ; il dit maintenant lesquelles. Une case de 18 px —
rayon 2, `--signal` sur fond à 13 % quand la ligne part, `--bord` sur `--fond-1` quand elle est
écartée —, la provenance en mono 9,5 px tronquée, et sous une ligne écartée le fait et ses
gestes : `écartée · ce personnage`, `+ projet`, `rendre au personnage`.

**La phrase de préséance est écrite au-dessus des lignes, pas déduite de leur apparence** : *la
portée la plus étroite l'emporte — cette génération, puis ce personnage, puis le projet.* Trois
portées se lisent mal dans une couleur ; elles se lisent bien dans une phrase de dix mots posée
une fois. C'est l'arbitrage de la ligne sœur d'un contrôle grisé — le produit préfère écrire la
raison que la faire deviner.

**Un bouton sans objet ne se grise pas, il ne paraît pas.** Sans case visée, `+ personnage` ne
désigne personne : il est absent, et non grisé avec sa raison. Le § Le grisé porte sa raison
suppose une chose indisponible ; ici il n'y a pas de chose. C'est la bascule de la réserve, qui
n'existe qu'en toile pour ne pas mentir sur ce que l'écran contient. Écrit en relisant le code :
le commentaire promettait un grisé que le code ne posait pas, et c'est le code qui avait raison.

#### Deux corrections que ce document a values au code

**Le nom d'un personnage était en serif 24 px, dans un champ.** La règle 1 du § Typography
l'interdit en deux mots — *n'entre jamais dans un contrôle* —, et l'échelle nomme déjà la taille
de cette chose-là : `14 – 15 · sans · prose longue, nom en fiche`. Il est en sans 15 px, éditable
en place comme les noms du plan : bord transparent au repos, `--bord` au survol, `--bord-fort` et
`--fond-1` au focus. Ça se voyait bien en serif, et c'est précisément pourquoi la règle est
écrite — le display est ce qui donne un visage à l'outil, pas ce qui décore un champ.

**Et l'état vide de la colonne de droite n'avait pas sa serif.** Il portait un paragraphe en mono
qui répétait, presque mot pour mot, l'explication déjà posée dans la colonne de gauche : deux fois
la même phrase sur le même écran, au même instant. Il est maintenant ce que le produit fait
partout ailleurs — une invitation courte en serif 32 px, *Ce jeu n'a encore personne. Nomme le
premier.*, et **rien d'autre**. Le champ et l'explication sont à gauche ; les redire à droite
était le doublon que ce document poursuit depuis le bandeau hors ligne.

**La sortie vers le jeu se lit en dernier, et c'est l'ordre du geste** (C5). Le bloc est au
bas de la fiche, sous les cases, séparé par un filet `--bord` : on regarde ce qui est fait, ce
qui manque, et alors seulement on livre. Un bouton posé en tête aurait proposé de sortir avant
d'avoir montré ce qu'il y a à sortir.

**Grisé avec sa raison, et les deux raisons ont un ordre.** Ce qui manque à fabriquer passe
devant ce qui manque à régler : *aucune attitude remplie* d'abord, *aucun dossier de jeu*
ensuite. La première se corrige sans quitter l'écran, la seconde renvoie ailleurs, et on
n'envoie pas quelqu'un dans les Réglages pour un personnage qui n'a de toute façon rien à
livrer. La raison s'écrit à droite du bouton, en mono 10 px `--texte-3`, et sert de survol —
le § Le grisé porte sa raison, appliqué tel quel.

**Ce qui revient est un chemin, pas un fichier.** L'export de T6 rendait une archive au
navigateur ; celui-ci écrit sur la machine, et le compte rendu dit *combien* et *où* — le
chemin en `--texte`, parce que c'est lui qu'on colle dans un moteur de jeu. « Rien n'a été
écrasé » est écrit dans la même phrase : c'est la règle du dossier du jeu, et la dire au
moment où l'on vient d'écrire vaut mieux que de la promettre dans une aide.

#### Ce qui est écarté

**Un choix de dossier dans cet écran.** Le dossier du jeu se pose une fois, dans les Réglages,
bloc « Les dossiers » — c'est là que le produit range ce qui vaut pour toute la session, et
c'est le même dossier que l'agent utilise. Un second champ ici en aurait fait deux à tenir
d'accord, et le geste de livraison serait devenu un formulaire.

**Une confirmation avant de sortir.** Rien n'est écrasé, rien n'est détruit : au pire on pose
une seconde copie numérotée, qui se supprime dans l'explorateur. Le produit ne confirme que ce
qu'il ne saurait pas défaire.

**Une confirmation avant de supprimer un personnage.** Le produit n'en pose aucune, et celle-ci
serait la moins justifiée de toutes : rien ne cascade, les images restent et se marquent
« personnage supprimé ». Le survol du geste porte ce fait, et c'est tout ce qu'il y a à dire.

**Une vignette dans la liste des personnages.** Elle ferait une seconde grille dans l'écran qui
existe pour ne pas en être une. Le compte des attitudes tenues, en mono 9,5 px à droite du nom,
dit ce qu'on venait chercher.

**Un écran de création de personnage.** On ne crée pas un corps ici : on écrit un nom. Le corps
naît dans l'atelier — on écrit un sujet, on génère, et c'est l'image obtenue qu'on désigne. Cet
écran n'a donc aucun champ de prompt, et c'est ce qui garde vraie la phrase du cadrage.

---

### Le panneau du calque, et les trois outils d'une seule surface

Écrit le 29 août 2026, en livrant C4. Il complète le § L'écran Personnages ci-dessus : la
troisième colonne de cet écran-là, celle qui paraît quand on ouvre un calque.

**380 px, encore.** C'est la colonne de la fiche asset, de l'écran Univers et de la réserve,
réemployée pour ce qu'elle nomme déjà — *ce qu'on pose et ce qu'on manipule*. Aucune largeur
neuve n'entre par C4. Le cadre où l'on regarde le calque fait 340, ce qui laisse les marges du
panneau : assez pour juger un sprite de 64 px agrandi douze fois.

**Un seul cadre pour les trois outils, et c'est le motif.** La zone, le masque et la retouche se
posent sur la même image — le calque sur son corps, au pixel, damier dessous. Trois surfaces
auraient donné trois vérités sur la même chose, et il aurait fallu les tenir d'accord ; ici c'est
la même, et seul ce que la main y fait change. Les segments sont au-dessus du cadre, parce qu'on
choisit ce qu'on va faire avant de le faire, et **ils ne paraissent que sur un calque** : un corps
habillé n'a ni masque ni retouche, et trois segments morts au-dessus de son image seraient du
cadrage affiché.

**Le rectangle reste visible sous les trois, sa poignée non.** Il est ce dont la main part quand
elle affine le masque ; le cacher pendant qu'on l'affine aurait caché ce qu'on affine. Il passe
de `--signal` à `--bord-fort` dès qu'un pinceau est en main — il n'est plus ce qu'on manipule, il
est le décor de ce qu'on manipule. La poignée, elle, disparaît : une cible de retaille au milieu
d'une surface qu'on peint est un piège à clic.

**Le passage en cours se dessine en `--signal`, dans les deux sens.** Garder et ôter sont deux
gestes ordinaires ; `--echec` veut dire *ce qui échoue ou ce qui détruit*, et une gomme
n'échoue pas. Ce que le passage fait est dit par le segment allumé juste dessous, ce qu'il couvre
est dit par le trait lui-même à la largeur qu'il aura — et les deux suffisent. Le trait est le
seul élément du produit dont l'épaisseur est une **mesure du sujet** et non une valeur de
châssis : elle vaut `(2·rayon + 1)` pixels d'image, mise à l'échelle du cadre.

#### La largeur du pinceau est une mesure, donc elle est en mono

`1 px · 5 px · 13 px`, dans la forme des segments du produit. Ce qui s'affiche est le
**diamètre** — la largeur du trait est ce que la main voit, le rayon est ce que le calcul veut —
et « au pixel » n'a pas de libellé à lui : c'est le premier cran, et il est déjà écrit `1 px`.
Nommer les crans *fin · moyen · large* aurait remplacé un fait mesuré par une appréciation, ce
que le § Typography interdit en une ligne.

#### Tenir montre l'avant — un appui, jamais une bascule

`Avant ›` en mono 10 px `--signal`, à droite de la rangée qui suit le cadre. **On maintient**, et
l'image devient celle que la différence avait rendue ; on lâche, elle redevient celle qu'on
modifie. Une bascule aurait laissé l'écran sur l'avant après le regard, et la retouche suivante se
serait faite sur une image qui n'est plus la bonne — le pire moment pour se tromper de vérité.

**Absent tant que la main n'est passée nulle part**, comme `Fabriquer ensemble ›` sous deux
attitudes et comme `+ personnage` : le § Le grisé porte sa raison suppose une chose indisponible,
et ici il n'y a rien à comparer, donc pas de chose.

#### La rangée d'état d'une couche — la même trois fois

Sous le cadre, une seule rangée, et son contenu suit l'outil : ce que porte cette couche à
gauche — `zone 27 × 28 px`, `toute la case`, `3 passages`, `aucune retouche` —, ce qui la vide à
droite — `Sans zone ›`, `Sans passages ›`, `Sans retouche ›`. « Chaque couche s'annule » n'est
donc pas trois boutons à trouver : c'est le même, à la même place, sur la couche qu'on tient.

#### La mesure la plus défavorable monte d'un ton, et rien d'autre

Dans le `<dl>` des cinq mesures, celle qui décide passe de `--texte-3`/`--texte-2` à
`--texte-2`/`--texte`. **Pas de couleur, pas de signe** : `--echec` dirait *ça a échoué* quand la
phrase juste est *c'est par là qu'il faut commencer*, et le produit n'ouvre pas de glyphe. La
marque est de toute façon **redondante** avec le tri de la matrice, qui range sur ce même chiffre —
ne pas la voir ne fait rien perdre, ce qui est la condition pour avoir le droit d'être discret
(§ Le texte, sur `--texte-3`).

#### Le tri d'une colonne est un choix, et le plan reste le défaut

`par attitude · par le pire`, deux segments ancrés à droite du libellé de la colonne — et
**seulement sur une colonne de pièce** : sur celle du corps il n'y a pas de mesure à classer,
donc pas de chose indisponible, donc rien du tout.

Le défaut est le plan du jeu. C'est l'ordre de l'auteur, celui du § L'écran Personnages — *une
attitude vient avant une autre parce que c'est ainsi qu'il pense son jeu* — et surtout le seul
dans lequel une case **vide** se lit : la colonne dit d'abord ce qui manque. Trier d'office aurait
fait remonter ce qui existe et repoussé ce qui n'existe pas, c'est-à-dire caché la moitié du
métier de l'écran.

La rangée gagne une troisième ligne en mono 9,5 px `--texte-3`, sous les deux de C2 :
`à regarder · objet ou poussière`, ou `main posée`. Elle dit ce que le tri ordonne, à l'endroit
où on le lit — et elle ne paraît que sur un calque, un corps habillé n'ayant rien à retoucher.
