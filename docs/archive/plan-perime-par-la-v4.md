# Plan — les tranches d'avant la V4, périmées par le carnet

> Descendu de `docs/PLAN.md` le 6 septembre 2026, **sans qu'un mot change**.
>
> Ces quatre blocs étaient ouverts quand la V4 est entrée. Le carnet refait l'interface
> entière — les trois onglets tombent, la surface n'a plus que quatre présentations —, donc
> les écrans que ces tranches devaient réparer sont redessinés. **Elles ne se reprennent pas
> telles quelles.** `docs/PLAN-carnet.md` fait foi sur ce qui se construit maintenant.
>
> **Ce qui a été construit sous ces codes est livré et tient.** Seul le reste est périmé, et
> le tableau dit où passe la ligne.

| Bloc | Ce qui est livré et tient | Ce qui est périmé |
|---|---|---|
| **V2.5** — le design reprend la main | `N1`, le relevé | la suite. `docs/PLAN-carnet.md` **est** la suite de `N1`, et le relevé a été refait deux fois |
| **V3.01** — la commande d'un clip se relit avant de partir | le tiroir qui montre ce qui part et le corrige pour cet appel | la liste de modèles qui se plie et se filtre — le carnet redessine l'écran qui la porte |
| **V3.03** — l'atelier d'une animation au niveau des tables | `V3.03.1` la recette par frame, `V3.03.2` les tables sur une sélection du ruban, `V3.03.3` le montage de la bande | `V3.03.4`, la main — `B21` du carnet reprend les calques d'animation |
| **V3.1** — l'atelier tient ce qu'il dit | `G1` et `G16` | les quatorze autres tranches `G` |

⚠️ **À rouvrir avant de clore la V4.** Les quatorze tranches `G` de la V3.1 nomment des
défauts réels — une phrase devenue fausse, une attente qu'on ne voit pas, une explication
décrochée, un geste qu'on ne trouve pas. Le carnet redessine les écrans ; **il ne garantit
pas qu'il corrige ces défauts-là**. Ce fichier se relit à ce moment, pas avant.

---

## V2.5 — Le design reprend la main

*Ouverte le 4 septembre 2026, sur demande de l'auteur, en instruisant sa remarque du 3 septembre :
**« cette interface hyper chargée qui assomme d'infos techniques »**. Elle était écartée du
périmètre de la V3.1 le jour même — *« après la V3, voire plus tard »* ; l'auteur l'avance, et lui
donne sa version à elle. Le dossier est `docs/remarques/masquer-l-avance-et-la-passe-de-design.md`.*

**Ce qu'elle vise, en clair.** L'atelier est dense, et **c'est une thèse, pas un accident** :
`docs/DESIGN.md` écrit *« la densité est celle d'un instrument, pas d'une page »*, et le principe
dont tout découle est que *chaque décision retire une concurrence à la grille*. Un auteur qui trouve
son outil assommant a raison sur le ressenti, quelle que soit la thèse. **Cette version décide, par
écrit, ce qu'on garde de la thèse et ce qu'on rouvre.**

### ⚠️ Pourquoi elle commence par un relevé et non par un dessin

**Une passe de design a déjà eu lieu, et personne ne sait où elle en est.**
`docs/archive/audit-design-post-v21.html`, daté du 31 août 2026, relève **quatorze défauts** classés par ce
qu'ils coûtent à l'usage. Il est cité par `docs/DESIGN.md` et par `docs/PIEGES.md`. **Il n'est cité
nulle part dans ce plan** — zéro occurrence avant aujourd'hui. Ses quatorze défauts ne sont jamais
devenus une liste de travaux.

**Et une bonne partie a été réparée sans que personne ne le note.** Sondage du 4 septembre 2026, sur
trois défauts pris au hasard plus celui que le plan connaît :

| Le défaut de l'audit | Aujourd'hui |
|---|---|
| *Échap ne ferme pas ce qu'on ouvre* | **fait** — quatorze écrans écoutent la touche |
| *la galerie télécharge 26 Mo pour 49 vignettes* | **fait** — vignettes calibrées, employées dans quatre écrans |
| *la description s'écrit par un hublot de quatre lignes* | **fait** — le champ va de 3 à 16 lignes |
| *le zoom absent des tables* | **pas fait** — c'est `G10`, écrite au plan |

**Redessiner avant de relever, ce serait refaire un travail déjà payé.**

### Les trois demandes de l'auteur, et elles n'ont pas le même statut

| La demande | Ce que le dépôt en dit aujourd'hui |
|---|---|
| **masquer l'avancé** | **compatible, et sa forme est déjà tranchée** — *un bloc replié porte son réglage à droite de son titre*, écrit le 27 août 2026, *« sans elle, le repli cacherait au lieu de résumer »*. Ce n'est pas la demande qui est refusée, c'est le repli muet |
| **ajouter des icônes, des retours visuels** | **refusé par écrit** — *« aucune icône illustrative »*, trois glyphes dans tout le produit, et *« l'absence de mouvement retire la concurrence d'attention »*. **Le refus a déjà été payé** : les premières maquettes dessinaient une roue dentée et un point d'interrogation, *« les deux ont été retirés, et remplacés par des mots »* |
| **teinter l'interface à la palette du jeu** | **contredit le principe fondateur** — *« le froid retire la concurrence chromatique »* — et **le cas exact a déjà été jugé** : la maquette du 26 août 2026, châssis ambre sur charbon, écartée avec sa raison — *« entre en concurrence avec le pixel art, qui sature déjà les ors et les bruns »* |

**Rien de tout cela n'est un refus définitif.** Le dépôt rouvre ses décisions ; il les rouvre **par
écrit, avec leur nouvelle raison**, et jamais en les contournant. C'est ce que cette version aura à
faire — ou à ne pas faire, en le disant.

### Ce que cette version ne fait pas encore

**Elle n'a qu'une tranche écrite.** `N2` et au-delà — replier l'avancé, rouvrir la direction,
trancher la teinte — **ne s'écrivent qu'une fois `N1` rendu** : on ne sait pas encore si la charge
dont l'auteur se plaint est faite de défauts déjà relevés ou d'une direction à rouvrir, et c'est
exactement ce que `N1` répond.

### ⚠️ Ce qu'elle tient pour acquis sans l'avoir mesuré

**Que ce qui est *avancé* pour l'auteur l'est pour tout usage.** Le dépôt n'a **aucune mesure de qui
ouvre quoi** : replier au jugé revient à parier. `N1` ne le mesurera pas non plus. *Si `N2` existe,
elle devra dire comment elle décide, ou l'assumer comme un pari.*

---

### N1 · L'audit de design repris, et ce qu'il en reste

*Aucune US — c'est un relevé, et un relevé n'a pas d'utilisateur qui le demande ; c'est le cas d'`E0`,
`F0` et `A0`*

**Ce qu'on livre.** Un état écrit des quatorze défauts de l'audit du 31 août 2026 : **fait**, **pas
fait**, ou **devenu sans objet**, chacun avec sa preuve dans le code. Et, pour ce qui reste, une
place : une tranche existante qui le porte déjà, ou une ligne dans cette version.

**Ce que ça ne fait pas.** **Aucun écran n'est touché.** C'est une lecture, pas une correction.

**Pourquoi ça compte plus qu'il n'y paraît.** Trois défauts sur quatre sondés étaient déjà réparés
sans que rien ne l'écrive. Si la proportion tient, la « grosse passe de design » que l'auteur
réclame est **en grande partie déjà faite**, et ce qui reste est une poignée de points — pas un
chantier. *Si elle ne tient pas, on saura enfin de quoi on parle.*

**Aucun appel, aucun centime** : c'est une relecture du dépôt.

**Critères d'acceptation**

- [ ] Les quatorze défauts de l'audit portent chacun un état : **fait**, **pas fait**, **sans objet**
- [ ] Chaque « fait » cite le fichier et la ligne qui le prouvent — pas une impression
- [ ] Chaque « pas fait » nomme la tranche qui le porte, ou dit qu'aucune ne le porte
- [ ] Les surfaces que l'audit déclare **non examinées** sont listées telles quelles — l'assistant de
      démarrage, la planche de pose, les états d'erreur et d'attente — sans être jugées
- [ ] L'audit lui-même gagne, en tête, la ligne qui dit où il en est et à quelle date
- [ ] `docs/PLAN.md` le cite : il ne doit plus être un document que le plan ignore
- [ ] **Aucun fichier de l'interface n'est modifié par cette tranche**

**Bloquée par** — aucune. *Elle ne dépend de rien et bloque tout le reste de la version.*

---

## V3.01 — la commande d'un clip se relit avant de partir

*Née de l'usage le 5 septembre 2026, sur la V3 livrée la veille. Deux constats de l'auteur en
regardant `EcranClip` : l'argent part d'un écran où le texte se lit mais ne se corrige pas, et la
liste des modèles ne se laisse ni filtrer ni lire d'un coup d'œil. Aucun des deux ne contredit le
cadrage — `A9` disait que l'écran de commande *est* la confirmation, et c'est exactement ce qui
change : ce qu'il tenait derrière sa règle — *un écran qui recouvre, montre ce qui part, et porte
le montant sur son bouton* — tient toujours ; ce qui s'ajoute est la **relecture et la
correction**, que l'écran de commande, plein de réglages, n'offre pas.*

⚠️ **Le nom V3.1 est pris** — il désigne le bloc *l'atelier tient ce qu'il dit*, plus bas. La
reprise de la V3 livrée s'appelle donc *V3.01*, et le chiffre ne dit rien de plus.

### V3.01.1 · Le tiroir « ce qui part avec ce clip » — ✅ **livrée le 5 septembre 2026**

**Ce qu'on livre.** Entre le bouton « Commander ce clip · ≈ X » et la dépense, un écran de
confirmation s'intercale — le même geste que celui des images fixes, et la question qu'il
tranche est la même : *qu'est-ce qui part, et puis-je le corriger avant que ça parte ?* Il
recouvre l'atelier, montre le texte exact qui partira, mot pour mot, et l'image de départ avec
sa filiation, et porte sur son bouton le montant du **lot** — ou le temps, pour le moteur de la
maison, avec la même annonce qu'au-dessus.

On y **corrige le texte pour cet appel** : la correction part, le mouvement de la bibliothèque
ne bouge pas, et « reprendre le texte » le redonne intact — c'est le contrat de l'écran des
images fixes, appliqué tel quel. Ce qui n'est **pas** débrayable : **l'image de départ**.
Un modèle vidéo n'en accepte qu'une et aucun plafond ne la fait céder (`A9`, point 8bis) — le
tiroir le dit en toutes lettres au lieu de proposer un interrupteur qui ne voudrait rien dire.
Elle se change, depuis la bibliothèque, comme dans l'écran au-dessus. Et rien d'autre ne part :
ni textes du jeu, ni images d'ambiance — la phrase *« ce clip n'hérite que de votre sprite »*
reste vraie, et le tiroir ne la force pas.

**Ce que ça change côté serveur, et c'est presque rien.** Le corps de `/api/clips` accepte déjà
un texte et un mouvement, mais le mouvement **écrase** le texte. L'ordre s'inverse : le texte
corrigé part, et le mouvement reste inscrit sur la génération — c'est lui que le montage d'`A10`
lit pour nommer ses bandes, et une correction d'un appel ne doit pas casser la filiation. Si le
texte relu vaut le texte du mouvement, on envoie seulement le mouvement, comme aujourd'hui : la
bibliothèque d'`A6` reste le seul endroit où le texte anglais s'écrit, et une correction ne le
duplique pas.

**Critères d'acceptation**

- [x] Le bouton « Commander ce clip · ≈ … » **ouvre la confirmation au lieu d'envoyer** ; rien ne part tant que le bouton du tiroir n'a pas été pressé, et Échap referme sans rien dépenser
- [x] Le tiroir montre **le texte exact qui partira, mot pour mot**, et l'image de départ avec sa filiation — jamais réassemblés à l'écran
- [x] Le texte se corrige **pour cet appel seulement** : il part corrigé, le mouvement de la bibliothèque ne bouge pas, et « reprendre le texte » le redonne intact
- [x] Un lot se re-dit dans le tiroir : chacun des N clips se paie, et le bouton porte le même montant de lot — ou le même temps — que l'écran au-dessus
- [x] L'image de départ est **obligatoire et le dit** : aucun interrupteur ne peut la retirer, seule la changer est possible
- [x] La correction part, et **le mouvement d'origine reste inscrit sur la génération** : le montage d'`A10` nomme ses bandes comme avant, texte corrigé ou non
- [x] Un clip commandé depuis le tiroir se relit après coup avec le texte corrigé — la garde se fait avec un texte retouché, pas avec celui du défaut
- [x] Tout fonctionne réseau coupé : le tiroir s'ouvre sur ce que l'écran a déjà relu

**Ce qui a été livré, le 5 septembre 2026.** Cinq essais de serveur, sept d'écran, et le
pronostic du plan s'est vérifié : **côté serveur, c'était presque rien** — une résolution, le
texte corrigé qui prime sur le mouvement —, **et côté écran, un composant entier**. Le tiroir
est la moitié vidéo de l'écran de confirmation, monté sur le même contrat : ce qui part, mot
pour mot, corrigeable pour cet appel seulement ; ce qui ne part jamais — l'image — nommé en
toutes lettres.

| Ce qui est arrivé | Où | Ce que ça tient |
|---|---|---|
| La résolution | `atelier/api/animation.py` § `commander_clip` | le prompt corrigé **prime** sur le mouvement, et le mouvement reste inscrit — sans correction, le serveur relit le mouvement comme en `A9`, et le texte anglais n'a qu'un seul endroit où il s'écrit (A6) |
| Le tiroir | `interface/src/composants/Clip.tsx` § `ConfirmationClip` | trois colonnes — ce qui part (image et format), le texte mot pour mot, le modèle et le montant — et le bouton qui paie. Il est fait de ce que l'écran a déjà relu : **ouvrir ne demande rien au serveur**, et c'est la forme réseau coupé du critère |
| Le texte corrigeable | même composant, `data-correction-clip` | le brouillon fait autorité pendant qu'on écrit (M3), « remettre le texte du mouvement » efface le brouillon avec la correction, et vider le texte éteint le bouton avec sa raison |
| L'image qui ne se retire pas | même composant | **obligatoire et le dit** — un modèle vidéo n'en accepte qu'une, donc aucun interrupteur, seulement « changer d'image › » |
| L'entrée du guide | `interface/src/aide.ts` § `clip.confirmation` | un écran qui naît doit une ligne au guide — c'est elle |
| La garde, refermée et rouverte | `tests/test_v301.py` § la relecture | un clip au texte corrigé se relit du disque avec **son** texte et **son** mouvement — jamais avec le défaut |

> ⚠️ **Un détail du refus, découvert en écrivant les essais.** Un prompt réduit à des
> espaces n'est pas une correction : le serveur reprend le mouvement, comme si le prompt était
> absent. C'est la même réserve que la route d'`A9` sur le prompt, appliquée à la relecture —
> *des espaces ne sont pas un texte*.

**Bloquée par** — aucune. **Elle ne bloque rien** : la 3.01.2, la liste de modèles, démarre
indépendamment.

### V3.01.2 · La liste de modèles se plie et se filtre — ✅ **livrée le 5 septembre 2026**

**Ce qu'on livre.** La colonne des modèles se lit d'un coup d'œil : **le moteur de la maison en
tête** — le modèle qui ne coûte rien passe avant ceux qui coûtent, et le premier de la liste,
qui est aussi le premier que l'écran présélectionne, devient donc le local quand il est là —,
puis les payants **par prix croissant pour la demande courante** (le prix change avec la durée,
le format et la résolution choisis, et le tri suit, au même endroit où le prix se calcule : le
serveur. **L'écran n'a pas de règle de tri à lui** — deux endroits qui trient finissent par ne
plus trier pareil).

Un **interrupteur « seulement ce qui peut partir »**, allumé par défaut, retire de la colonne
les modèles grisés et leur bruit — le cas d'école étant un atelier sans clé, où vingt-huit
cartes grisées mangent la liste. Éteint, ils reparaissent **intercalés par prix, avec leur
raison**, pour celui qui veut savoir pourquoi rien ne part chez un fournisseur — et l'aller
réparer. Dans les deux états, rien ne se propose pour être rejeté en 400 : la règle du
catalogue est respectée, le grisé est seulement rangé.

Et chaque carte **se plie** : repliée, elle ne montre que son nom et son estimation — le
montant du lot, ou le temps pour le local — ; son détail — la formule, la durée conseillée et
sa raison, ce que le dépôt a mesuré, la raison du grisage — se déplie d'un geste à lui, jamais
confondu avec le geste qui choisit.

**Critères d'acceptation**

- [x] La liste arrive **triée du serveur**, et l'écran n'a pas de règle de tri à lui : le local gratuit en tête, puis les payants par prix croissant pour la demande courante
- [x] Le modèle présélectionné est le premier qui peut partir — c'est donc le moteur de la maison quand il est présent
- [x] L'interrupteur « seulement ce qui peut partir » est **allumé par défaut** ; éteint, les modèles qui ne peuvent pas partir reparaissent avec leur raison, intercalés par prix
- [x] Une carte repliée ne montre que **son nom et son estimation** ; le détail se déplie d'un geste distinct du choix — et le geste qui déplie **reste possible sur une carte grisée**, seul le choix est interdit
- [x] Une clé absente ne grise que les modèles de son fournisseur, et ne dit rien du moteur local — la règle d'`A11` tient telle quelle
- [x] Tout fonctionne réseau coupé

**Ce qui a été livré, le 5 septembre 2026.** Deux essais de serveur, huit d'écran, et le
pronostic du plan s'est vérifié : **le tri était une ligne — l'écran n'a pas de règle de tri à
lui —, et la carte s'est refaite autour de deux gestes qui ne se confondent pas.**

| Ce qui est arrivé | Où | Ce que ça tient |
|---|---|---|
| Le tri | `atelier/api/animation.py` § `modeles_video` | la maison d'abord — son zéro est « certain » et le dit —, puis les payants par prix croissant **pour la demande courante**, calculé au même endroit que le prix. Un modèle au jeton passe devant un modèle à la seconde en carré et derrière en 16:9 : c'est ce que « pour la demande courante » veut dire, et l'essai le prouve dans les deux formats |
| Le filtre | `interface/src/composants/Clip.tsx` § `seulementPossibles` | l'interrupteur carré du produit, allumé par défaut, avec le compte des masqués sur le bouton même ; éteint, les grisés reparaissent dans l'ordre du serveur, et chacune se déplie pour lire sa raison |
| La carte à deux gestes | `Clip.tsx` § `CarteModele` | **choisir** est le bouton du nom et de l'estimation ; **déplier** est le chevron, à côté, vivant sur une carte grisée — seul le choix est interdit, la lecture ne l'est jamais. Le pli porte la formule, la durée conseillée, la mesure, et la raison du grisage en tête |
| La présélection | déjà en place, sans une ligne changée | l'écran prenait « le premier non grisé » : avec la liste triée, c'est le local quand il est là — le critère est rempli *par le tri* et non par une règle neuve |
| Le guide | `interface/src/aide.ts` § `clip.liste` | l'entrée du réglage nouveau — l'ordre vient du serveur, tu filtres |

> ⚠️ **Le piège du tri était l'ordre de la clé, pas la clé.** La première version mettait la
> maison *en dernier* — `1 if de_la_maison` — et le banc l'a rendu tel quel, fidèlement : un
> tri faux et le serveur obéissant. C'est l'essai qui compare l'ordre rendu à l'ordre déclaré
> qui l'a vu, pas une inspection du code. La leçon est celle de `A5` : une mesure qu'on ne
> lit pas n'est pas une mesure — ici, un tri qu'on ne compare pas à son entrée ne trie rien.

**Bloquée par** — aucune. **La 3.01.1 peut partir seule.**

---

## V3.03 — l'atelier d'une animation au niveau des tables

*Demande de l'auteur le 5 septembre 2026. Deux moments, et l'écran d'aujourd'hui les confond :*
***monter le clip*** *— « un écran dédié pour voir la vidéo, sélectionner les frames qu'on veut garder
et voir l'animation sans traitement des frames, ni détourage ni traitement de couleur » — et*
***éditer l'animation*** *— « traiter les frames une par une ou toutes à la fois ou juste une
sélection, avec tous les outils classiques des tables de l'atelier (détourage, quantification, la
main…), et en plus changer l'ordre des frames, ajouter, dupliquer, supprimer, et aller chercher une
frame en plus depuis le clip ».*

**Le partage qui commande la version.** Le montage s'arrête là où le traitement commence : il ne
montre que le brut — la vidéo, la pellicule, les images retenues sans détourage ni réduction de
couleurs — parce qu'on **juge le mouvement** sur un écran qui ne sait pas encore traiter. L'atelier
d'une animation porte tout le reste : chaque frame y devient une image de l'établi, avec sa recette
à elle, ses tables, la main, et la bande elle-même se monte. *« On ne taille pas et on ne corrige pas
avec la même main »* — la phrase d'A7 — devient une séparation d'écrans, là où elle était deux
colonnes d'un même écran.

| Tranche | Ce qu'elle livre |
|---|---|
| **V3.03.1** | chaque frame porte sa recette, l'écran se refait dans la grammaire des tables, le montage redevient brut — le socle. **Livrée** |
| **V3.03.2** | les tables sur une sélection : une frame, plusieurs, toutes, et les recettes nommées. **Livrée**, moins le grisé de la main, qui part avec elle en `V3.03.4` |
| **V3.03.3** | la bande se monte : retirer, dupliquer, déplacer, reprendre au clip, le chutier. **Livrée**, et le cadre se montre à la reprise du montage sans s'y reprendre |
| **V3.03.4** | la main sur une frame — **et son grisé sur une sélection**, repris de `V3.03.2` |

### V3.03.1 · Chaque frame porte sa recette, et le montage redevient brut — ✅ **livrée le 5 septembre 2026**

**Ce qu'on livre.** Trois choses, et la première porte les deux autres.

**① Une frame est une image.** Chaque prise d'une bande porte désormais une **recette individuelle
facultative**. Le défaut reste la recette de la bande — qui elle-même part de celle du jeu : une
bande d'avant se relit telle quelle, et rien ne migre. La recette individuelle naît au premier
réglage touché sur la frame, elle part d'une **copie** de la recette de la bande à cet instant, et
l'écart s'écrit sur la frame du ruban : *« s'écarte de la bande : détourage »*. « Reprendre la
recette de la bande » rend la frame au défaut, et c'est un geste annulable comme les autres.

**La fenêtre commune ne change pas de camp.** Elle se mesure avec la recette de la bande, et **une
frame qui s'en écarte peut déborder** : l'écran le dit avec la phrase du dossier « d'avant » — *elle
n'est pas fausse, elle est mesurée avec un autre détourage* —, et « Reprendre la fenêtre » reste un
bouton : les vingt secondes de remesure ne se paient pas sans raison.

**② L'écran se refait dans la grammaire des tables.** Le réglage à gauche, la chose en grand au
milieu, ses voisines à droite — la phrase d'A7 devient l'écran des tables : à gauche, les tables de
la frame choisie — détourage complet (les quatre moteurs et toutes leurs valeurs : la tolérance, le
durcissement, la sélection, et la phrase qui remplace une valeur que le moteur ne lit pas — `A7` bis
①), puis recadrage, grille, quantification, bords, contours — ; au milieu, la frame en grand avec le
zoom des tables ; à droite, le ruban des frames, le lecteur, et **les réglages de la bande** — la
vitesse, le sens, la fenêtre, l'ancrage — qui restent avec les contrôles jeu et pause, tranché avec
l'auteur le 5 septembre 2026.

**Ce qui survit d'A7, et ce qui n'y revient pas.** La pelure d'oignon, la poussée au pixel bornée,
les neuf ancrages, l'échange d'une image avec un autre clip du même personnage, l'annulation, et
*on corrige l'image qu'on regarde* — le lecteur peut tourner pendant qu'on travaille. Ce qui ne
revient pas : les curseurs de recette sans nom du panneau actuel — *trois nombres à la file et il
faut deviner lequel règle quoi*, vu en A7 et jamais réparé —, que la grammaire des tables nomme pour
de bon.

**③ Le montage redevient brut.** La boucle traitée et le panneau de recette quittent le montage.
Juger le mouvement et juger le découpage sont deux métiers — A10 le disait des deux boucles —, et
montrer un traitement qu'on ne peut pas régler revient à faire juger une image qu'on ne peut pas
corriger : *« une bande mal ramenée sur sa grille n'est pas jugeable du tout »*, et l'inverse est
vrai du mouvement sous un détourage. L'aperçu traité vit désormais dans l'atelier d'une animation,
frame par frame, là où le traitement se règle. La bande garde sa recette — elle part toujours de
celle du jeu —, mais elle se règle dans l'atelier, pas au montage. *Ce qui sort est exactement ce
que l'aperçu montrait* devient vrai frame par frame, là où on le regarde.

**Critères d'acceptation**

- [x] Une bande gardée avant la tranche se rouvre telle quelle, la recette de la bande vaut pour chaque frame — rien ne migre
- [x] Toucher un réglage sur une frame lui donne sa recette individuelle, copie de la bande à cet instant, et le ruban écrit l'écart
- [x] « Reprendre la recette de la bande » rend la frame au défaut, et se défait
- [x] L'écran se lit comme les tables : panneau gauche (tables de la frame), frame en grand avec zoom au centre, ruban + lecteur + réglages de bande à droite
- [x] La table détourage d'une frame offre les quatre moteurs et toutes leurs valeurs, et la phrase qui remplace celle qu'un moteur ne lit pas
- [x] Le montage ne montre plus la boucle traitée ni le panneau de recette ; il n'évalue plus que le mouvement
- [x] Une frame qui s'écarte de la bande porte la phrase « d'avant » pour la fenêtre commune, et « Reprendre la fenêtre » reste un bouton
- [x] Les gestes d'A7 survivent : pelure d'oignon, poussée au pixel bornée, neuf ancrages, remplacement par une image d'un autre clip du même personnage
- [x] On corrige l'image qu'on regarde, lecteur en marche — l'essai laisse tourner, ralenti, et tombe en défaisant le correctif (8octies)
- [x] Une garde se referme et se rouvre avec ses recettes individuelles — gardée avec des réglages qui ne sont pas ceux du défaut (8septies)
- [x] Tout se fait au clavier autant qu'à la souris ; tout fonctionne réseau coupé ; le guide reçoit ses lignes

> **Ce que « lecteur en marche » veut dire ici, et qui a été tranché en le
> construisant.** Les flèches corrigent l'image *affichée* — la règle d'`A7`, et
> elle ne bouge pas. **Les tables, elles, suivent l'image *choisie***. Les avoir
> fait suivre l'affichée a donné un panneau qui apparaissait et disparaissait
> onze fois par seconde : *on ne clique pas un bouton qui s'en va*. Une flèche
> est instantanée, une table se lit avant d'être touchée, et lire prend plus
> longtemps qu'une image de l'animation.

**Bloquée par** — aucune. **Elle ne bloque rien** : les trois suivantes la prennent pour socle.

### V3.03.2 · Les tables sur une sélection : une frame, plusieurs, toutes — ✅ **livrée le 5 septembre 2026**, sauf le grisé de la main

**Ce qu'on livre.** L'autre moitié de la demande : *« traiter les frames une par une ou toutes à la
fois ou juste une sélection, avec tous les outils classiques des tables »*. Le ruban se sélectionne
au clic, comme la colonne des sœurs de `G12` : c'est l'ensemble déjà sous les yeux, et l'amendement
de la grille unique vaut pour lui. Les tables du panneau gauche s'appliquent à la sélection entière :
une valeur que les frames n'ont pas en commun s'affiche « séparé » et se pose pour toutes en une
passe.

Une **recette nommée** se pose sur la sélection — elle remplace tout l'ensemble à la fois (`A7` bis
②, *une recette est un ensemble, en prendre la moitié rendrait une image que personne n'a jamais
jugée*) — et elle n'écrit rien avant « Enregistrer » : elle serait le seul geste de l'écran à ne pas
s'annuler. « Remettre la recette de la bande » vaut aussi pour la sélection.

> ⚠️ **Rien ne se réécrit en silence.** Une frame à recette individuelle l'est pour une raison, et
> une recette posée par-dessus l'écrase. La règle de `G12` — le liseré sur ce qui va changer, et
> *ce qui n'a pas voyagé se dit une fois pour le lot* — s'écrit ici pour le ruban : les frames à
> recette individuelle portent leur liseré, l'écran dit combien il y en a et ce qui va être
> remplacé, une fois, pas trente fois. La main, quand elle arrivera en 03.4, s'ajoute au liseré.
> **`G12` ne bloque pas cette tranche** : elle agit sur une autre surface, la colonne des sœurs de
> l'établi ; si elle se ferme avant, les deux chemins se partagent la même phrase, jamais deux
> phrases différentes pour le même fait.

**Et une table qui ne se sélectionne pas, et le dit.** La main ne s'applique qu'à une frame à la
fois : peindre est un geste de pixels, une coordonnée ne voyage pas (lot U), et poser la même passe
sur d'autres images serait faire des retouches à leur insu. Sur une sélection, la table s'éteint
avec sa raison — comme toujours, *le grisé porte sa raison*.

**Critères d'acceptation**

- [x] Le ruban se sélectionne au clic et s'étend ; la sélection porte un geste, elle n'est pas un état complet
- [x] Les tables s'appliquent à la sélection : une valeur « séparé » se pose pour toutes en une passe
- [x] Une recette nommée se pose sur la sélection, remplace tout l'ensemble, et n'écrit rien avant « Enregistrer »
- [x] « Remettre la recette de la bande » s'applique à la sélection
- [x] Un liseré marque les frames à recette individuelle ; ce qui va être écrasé se dit une fois pour le lot, et la phrase vaut aussi pour les retouches à la main quand elles existent
- [ ] La main est grisée avec sa raison sur une sélection de plusieurs frames — **reporté en `V3.03.4`, voir ci-dessous**
- [x] Une route serveur prend une liste — pas trente appels pour trente frames
- [x] La garde se referme et se rouvre avec les recettes posées en lot (8septies)

> ### ⚠️ Deux choses que la construction a trouvées, et qui changent le cadrage
>
> **① Une valeur voyage, une recette remplace — et c'est la tranche entière.**
> Les tables rendent une recette *complète* à chaque geste : bouger un curseur
> renvoie toute la recette de l'image regardée. L'écrire telle quelle sur la
> sélection lui donnerait aussi les valeurs qu'elle ne partageait pas, **sans
> un mot**, et ça ne se verrait qu'à l'export. Un réglage des tables ne déplace
> donc que ce qui a changé ; une recette nommée, elle, remplace l'ensemble —
> c'est ce qui justifie qu'elle *seule* annonce d'avance ce qu'elle écrase.
> Corollaire : **toute la bande choisie se règle sur la bande**, pas image par
> image ; douze recettes individuelles identiques annonceraient douze écarts là
> où il n'y en a aucun.
>
> **② Le critère de la main portait sur un geste absent, et sur le mauvais
> risque.** La table de la main n'arrive qu'en `V3.03.4`, et aucun écran n'en
> pose sur une frame aujourd'hui : la griser serait faire attendre un geste qui
> n'existe pas (`AGENTS.md`, 8nonies). Et une recette nommée **ne peut pas
> propager** de retouche — le serveur la lui retire à l'enregistrement (`U5`,
> `US-342`). Le risque réel est l'inverse : *remplacer tout l'ensemble*
> **effacerait** la main que l'image avait. C'est ce qui est tenu ici ; la
> phrase et le grisé partent avec la table, en `V3.03.4`.

**Bloquée par** — `V3.03.1`.

### V3.03.3 · La bande se monte : retirer, dupliquer, déplacer, et prendre au clip — ✅ **livrée le 5 septembre 2026**

**Ce qu'on livre.** Une bande gardée n'est pas un tirage figé. Le ruban s'édite : **retirer** une
frame, **dupliquer** — la recette individuelle de la source suit la copie, c'est la même image —,
**déplacer** — glisser, ou flèches au clavier —, et l'ordre du ruban est l'ordre de l'export.

**Et le clip rouvre sa porte.** *« Aller chercher une frame en plus depuis le clip si il m'en
manque une »* : depuis l'atelier, « prendre des images dans le clip › » ouvre une vue de toute la
pellicule du clip — comme le montage, sans le montage —, on y prend une ou plusieurs images, et
elles entrent dans le **chutier**. Le chutier est la réserve de la bande : les images écartées du
film mais pas encore posées. Depuis le chutier, chaque image s'insère à la position choisie — avant
ou après la frame sélectionnée. Il se garde avec la bande et se relit avec elle : *un objet qu'on
sait écrire et qu'on ne sait pas relire n'est pas fini*, et l'essai referme et rouvre (8septies).

**Reprendre le montage de la bande.** Depuis l'atelier, « Reprendre le montage › » ouvre le montage
**avec les images déjà retenues et les réglages en place** — le cadre, la vitesse, le sens — ; on y
change la sélection, et refermer met la bande à jour. Aujourd'hui le montage repart toujours des
réglages du jeu : c'est le cul-de-sac d'A7 raconté une fois de plus, par l'autre bout.

> ⚠️ **Une recette individuelle voyage avec sa prise.** Remplacer la prise d'une frame par une
> autre image — au montage comme à l'échange d'`A7` — ne transfère pas les retouches : c'est une
> autre image, et la retouche mentirait dessus. La prise emportée garde sa recette avec elle, au
> chutier si elle y va.

**Critères d'acceptation**

- [x] Retirer, dupliquer, déplacer une frame : chaque geste est annulable, et l'ordre du ruban est l'ordre de l'export
- [x] La vue du clip montre toutes les images du clip d'origine ; on y prend une ou plusieurs images, d'un geste, vers le chutier
- [x] Le chutier liste les images mises de côté ; chaque image s'insère à la position choisie dans la bande
- [x] Le chutier se garde avec la bande et se rouvre — un essai referme et rouvre (8septies)
- [x] « Reprendre le montage › » ouvre le montage avec les images retenues **et la vitesse** de la bande ; changer la sélection et refermer met la bande à jour. **Le cadre s'y montre, il ne s'y reprend pas** — voir ① ci-dessous
- [x] Remplacer la prise d'une frame ne transporte pas sa recette individuelle, et l'écran le dit
- [x] Tout se fait au clavier autant qu'à la souris ; tout fonctionne réseau coupé ; le guide reçoit ses lignes

> ### ⚠️ Trois choses que la construction a trouvées
>
> **① Le cadre se montre à la reprise, il ne s'y reprend pas.** Le critère
> demandait que le montage rouvre « avec le cadre de la bande ». Il le montre —
> mais il ne le renvoie pas, et c'est volontaire : le cadre d'une bande est un
> **rectangle mesuré** sur les images retenues, et la correction ne remesure
> rien. Lui repasser le choix du montage (« le cadre du clip ») remplacerait ce
> rectangle par un autre, sans un mot, et l'auteur ne le verrait qu'à l'export.
> La reprise renvoie donc les prises, le chutier, la vitesse et le sens ; le
> cadre s'affiche en lecture avec sa raison, et se règle là où il se mesure —
> dans l'atelier. *Le grisé porte sa raison* vaut aussi pour une valeur qu'on
> lit sans pouvoir la toucher.
>
> **② Reprendre le montage d'une bande mêlée effacerait des images.** Une
> bande peut emprunter des frames à un second clip (`A7`) ; le montage, lui, ne
> connaît qu'un clip à la fois. Rouvrir dessus perdrait les empruntées en
> silence. Le bouton s'éteint donc avec sa raison plutôt que de mentir
> (`AGENTS.md`, 8nonies), et les gestes du ruban — eux — continuent de marcher
> sur une bande mêlée.
>
> **③ Les gestes du ruban portent sur la sélection, pas sur l'image affichée.**
> C'est la grammaire posée en `V3.03.2`, et la reprendre ici évite un piège :
> l'image *affichée* change toute seule quand le lecteur tourne. Retirer,
> dupliquer, déplacer et insérer visent ce que l'auteur a **choisi**, et un
> essai le vérifie **lecteur en marche, ralenti** (`AGENTS.md`, 8octies) —
> l'arrêter d'abord aurait effacé le défaut qu'il cherche.

**Bloquée par** — `V3.03.1`.

### V3.03.4 · La main sur une frame — **à construire**

**Ce qu'on livre.** La table « la main » portée telle quelle à la frame choisie : le pinceau carré
de côté impair, poser et ôter, la toile grossie, le zoom, l'annulation, les témoins avant et après.
Retirer des pixels, en repeindre d'autres : c'est la table de l'établi, et ses règles viennent avec
elle — les passages se gardent dans la **recette de la frame**, une coordonnée ne voyage pas, et la
frame touchée porte le liseré de 03.2.

**Elle ne s'applique qu'à une frame à la fois**, et la raison est écrite à la place des réglages
quand plusieurs frames sont choisies : peindre est un geste de pixels, et dupliquer une passe de
main sur d'autres images serait poser des retouches sans les avoir regardées.

> ⚠️ **Ce grisé était un critère de `V3.03.2`, et il a été reporté ici** le 5 septembre 2026 : une
> table absente ne se grise pas, et une phrase expliquant pourquoi un geste inexistant est
> indisponible ferait attendre ce geste (`AGENTS.md`, 8nonies). Ce que `V3.03.2` tient déjà, et
> qui n'attend pas la table : **poser une recette nommée n'efface pas la main d'une image** —
> elle n'en porte aucune, le serveur la lui retire (`U5`), donc *remplacer tout l'ensemble*
> remplacerait des passages par du vide.

**Critères d'acceptation**

- [ ] La table « la main » s'ouvre sur la frame choisie avec ses outils et ses témoins, comme sur une image de l'établi
- [ ] Les passages se gardent dans la recette de la frame, et la garde se referme et se rouvre (8septies)
- [ ] Une frame touchée à la main le dit sur le ruban, et le liseré de 03.2 la montre
- [ ] Sur une sélection de plusieurs frames, la table s'éteint avec sa raison
- [ ] Tout fonctionne réseau coupé ; le guide reçoit sa ligne

**Bloquée par** — `V3.03.1`.

---

## V3.1 — L'atelier tient ce qu'il dit

*Née le 3 septembre 2026 du carnet de l'auteur — douze remarques relevées en une semaine d'usage,
mesurées et arbitrées une par une le jour même. **Aucune n'était ce qu'elle paraissait.***

**Ce qu'elle répare, en clair.** Presque rien de cette version n'est neuf. Ce sont des choses que
le produit **avait déjà faites** — une phrase juste le jour où elle a été écrite, une barre
d'attente calculée à chaque geste, une explication rédigée avec soin, une décision prise pour une
bonne raison — et qui ont cessé d'être vraies, ou branchées, ou justes, **sans que rien ne le
signale**.

**L'écart se paie deux fois.** Il coûte à l'usage : on dézoome pour lire un menu, on regarde un
écran figé pendant deux secondes, on lit qu'un fond est écarté alors qu'il n'y a rien à écarter.
Et il coûte à la confiance : quand une phrase du produit s'est révélée fausse, les suivantes ne se
croient plus. C'est le vrai sujet de cette version.

**Ce qu'elle livre.** L'atelier redevient d'accord avec lui-même. Ce qu'il affirme est vrai au
moment où on le lit ; ce qu'il a construit est atteignable ; les règles qu'il a posées et que
l'usage contredit sont rouvertes plutôt que défendues. Et les quelques gestes qui manquaient
vraiment arrivent sur des écrans qu'on aura déjà rouverts pour le reste.

**Pourquoi après la V3.** L'animation est l'objectif, et rien ici ne la bloque. Mais rien ici ne
dépend d'elle non plus : chaque tranche se prend seule, et les quatre familles peuvent s'entamer
dans n'importe quel ordre si l'usage le réclame.

### Les quatre familles, et elles commandent l'ordre

Les quarante-trois changements ne sont pas quarante-trois problèmes. Ils retombent dans quatre
familles, et les trois premières ont la même racine : **le dépôt écrit ses règles mieux qu'il ne
les tient, et rien ne mesure l'écart.**

| | La famille | Ce qu'on y trouve | Tranches |
|---|---|---|---|
| **①** | **Ce que le produit dit de lui-même a cessé d'être vrai** | neuf phrases mesurées ou promises, justes le jour où elles ont été écrites | `G1` |
| **②** | **Ce qui est construit et jamais branché** | une barre d'attente jetée, une image servie et jamais montrée, vingt-trois explications accrochées à rien, un bouton qu'on ne trouve pas, **une image payée que rien n'ouvre** | `G2` · `G3` · `G4` · `G5` · `G16` |
| **③** | **Des décisions que l'usage contredit** | un menu non borné, un accueil qui ne s'ouvre qu'une fois, des replis regroupés loin de ce qu'ils commandent, un calcul posé au milieu d'une surface d'idées | `G6` · `G7` · `G8` |
| **④** | **Des gestes qui manquent vraiment** | et ceux-là seuls ouvrent des user stories neuves | `G9` → `G12` · `G16` |

Trois défauts mesurés la même semaine mais jamais arbitrés ferment la version : `G13` à `G15`.
*L'arbitrage de `G15` est écrit, et il retourne le titre de la tranche : la réduction de couleurs a
cessé de dépendre de l'artwork en `D2`. Il est en bas, sous ses critères.*

### Ce que cette version ne fait pas

- **La hiérarchie du prompt.** Mesuré : l'univers pèse 41 à 45 % du texte envoyé, et **la consigne
  de pose 1,5 à 2,3 %**. *Reporté après la V3 par l'auteur, le 3 septembre 2026*, avec la mesure
  faite — c'est elle qui servira de point de départ, et elle ne se refait pas. La remarque du
  1ᵉʳ septembre sur la vue du jeu est la même question prise deux jours plus tôt.
- **Une IA qui aide à formuler l'univers.** Le produit n'a **aucun contrat de texte** — deux ports
  seulement, l'image et l'animation. C'est un troisième genre de fournisseur, avec sa clé, son
  catalogue et sa place dans les dépenses ; pas un réglage.
- **L'historique des retouches**, et le retour en arrière qu'il permettrait. *« Pour bien plus
  tard »*, et c'est son absence qui rend `G12` prudente.
- **Masquer l'avancé, et la grosse passe de design.** *Écarté par l'auteur le 3 septembre 2026 :
  après la V3, voire plus tard.*
- **Les types d'objets sur mesure.** On peut en éteindre un ; on n'en crée pas.
- **Un banc qui mesurerait ce qu'une case de l'univers change.** *« Ça a été testé ? »* restera
  **non**, et c'est assumé : deux mots dans un prompt ne valent pas huit tirages payés par branche.

### ⚠️ Ce que la version ne se donne pas les moyens de tenir

**Aucun garde-fou mécanique sur les nombres écrits dans les phrases.** *Tranché par l'auteur le
3 septembre 2026 : on relit, et on corrige quand ça se voit.* La règle proposée — *un nombre
affiché se calcule, ou il ne s'affiche pas* — a été écartée.

**Le risque est connu et il est écrit ici plutôt que découvert plus tard** : les neuf phrases de
`G1` avaient toutes été écrites **justes**, par quelqu'un d'attentif, et aucune relecture ne les a
rattrapées — la plus ancienne a tenu sept jours, la plus récente deux. Rien dans cette version
n'empêche la dixième.

*Les trois autres familles, elles, ont leur garde-fou, et il est tranché : un essai par famille —
`G2`, `G3` et `G4` le portent chacun.*

---

### G1 · Les phrases qui ont cessé d'être vraies — ✔ **close le 3 septembre 2026**
*Aucune US neuve — elles tiennent celles qui existent* · **famille ①**

**Ce qu'on livre.** Neuf phrases visibles du produit disent à nouveau vrai. Aucune n'était une
approximation : toutes ont été mesurées ou vérifiées le jour de leur écriture, et toutes ont été
démenties par un changement venu d'ailleurs.

> ### Ce que la tranche a trouvé en plus, en les corrigeant
>
> **Elles étaient douze, pas neuf, et les trois de plus sont de la même famille.** Le tableau
> ci-dessous en listait neuf ; en les corrigeant une par une, trois autres nombres écrits à la
> main sont tombés dans le même filet : *« les huit vues en cartes, les neuf tailles à leur vraie
> échelle, les huit types côte à côte »* — une seule ligne de commentaire, trois comptes, et le
> produit en porte aujourd'hui **dix** de tailles. Ils sont **retirés** plutôt que remesurés :
> ce que la phrase dit ne dépend d'aucun d'eux.
>
> **Les numéros d'étape étaient huit et non sept, et ils sont désormais calculés.** Ils se
> désignent par leur **nom d'abord** — « l'étape « La vue » » — parce que c'est le nom qu'on
> retrouve dans la colonne de gauche ; le rang suit, compté depuis la liste. Le nom suit le style,
> puisque la quatrième étape en porte deux depuis `D2`.
>
> **Et cinq commentaires du code citaient « l'étape 10 » pour la douzième** — décalés de deux
> crans, par `D1` puis par `D2`. Ils ne s'affichent nulle part, mais ils envoient le prochain
> lecteur au mauvais endroit. Ils nomment l'étape au lieu de la numéroter.
>
> ### Deux chiffres remesurés, deux chiffres retirés
>
> | la phrase | ce qu'elle disait | ce qui est écrit maintenant |
> |---|---|---|
> | la lecture de palette | *« une centaine de millisecondes »* | **6 ms à 1,2 s, 360 ms en médiane** — remesuré sur les 92 cartes du dépôt |
> | le fond écarté d'un artwork | *« 100 % … le reste — le fond — est écarté »* | deux phrases selon qu'il reste quelque chose : **3 des 10 artworks officiels du dépôt sont lus à 100,0 %**, et il n'y a alors rien à écarter |
> | le poids de l'univers dans le prompt | *« plus de la moitié du texte »* | **retiré** — c'est un rapport entre deux textes qui bougent chacun de leur côté |
> | la hauteur du menu d'une carte | *« il fait 300 px pour une carte 1× qui en fait 190 »* | **retiré** — ce qui décide la règle est le rapport, pas les valeurs |
>
> **Le seuil de 100 % a un effet de plus, trouvé en écrivant la phrase** : la case *« me le
> montrer sur l'image »* et le renvoi *« découper le montre en magenta »* s'offraient sur une
> carte où le magenta ne couvrirait aucun pixel. Une case qui ne change pas l'image est pire
> qu'une case absente — on la coche deux fois avant de conclure qu'elle est cassée. Les deux se
> retirent au même seuil.
>
> ### Le garde-fou est là où il ne coûte rien, et nulle part ailleurs
>
> La règle générale — *un nombre affiché se calcule, ou il ne s'affiche pas* — reste écartée,
> c'est la décision de l'auteur. **Un seul essai la fige, et sur la seule famille où le calcul est
> gratuit** : `tests/test_g1.py` refuse qu'un numéro d'étape soit écrit à la main dans l'écran, et
> il est **sans exception** — les deux commentaires qui racontent la correction disent « la
> deuxième » en toutes lettres plutôt que de demander une dérogation. Une règle à deux étages dont
> le second demande de savoir qu'il existe n'est pas une règle.

| Ce que le produit dit | Ce qui est vrai | Depuis |
|---|---|---|
| *« plus de la moitié du texte »* — l'univers dans le prompt | **41 à 45 %** | le 1ᵉʳ septembre 23 h 14, quand le bloc caméra a ajouté 512 caractères |
| *« il fait 300 px »* — le menu d'une carte | deux blocs de plus depuis | l'arrivée de *concept art de* et de la lecture de palette |
| *« une centaine de millisecondes »* — la lecture de palette | **913 ms** sur la plus grande image du dépôt | la mesure n'a jamais couvert les grandes images |
| *« les huit types couvrent ce qu'on sait faire »* | **sept** dans le projet de l'auteur | le 31 août, quand un huitième type est entré dans le barème livré |
| **sept numéros d'étape** cités en dur | tous décalés d'un cran | l'insertion de l'étape *Le style* |
| *« une carte non promue ne part jamais »* | **faux** — un concept art part sans être promu | l'arrivée des concept arts |
| *« une retouche dans la fiche porte la même barre »* | la retouche n'est plus dans la fiche | le 31 août, tranche `E4` |
| *« et l'image avec, en magenta »* — l'explication de la lecture de palette | le bloc ne montre aucune image | depuis toujours |
| *« 100 % … le reste — le fond — est écarté »* | **il n'y a pas de reste** | sur 4 des 9 artworks du dépôt |

**Et trois textes qui ne sont pas faux, seulement illisibles ou à côté.** L'aide de l'*époque*
affirme qu'elle *« décide des armes, des vêtements et des outils »* — c'est l'auteur qui décide, en
écrivant sa description ; elle cadre une **époque technologique**, et c'est tout ce qu'elle fait.
Les deux phrases *« Écrit par l'étape N. On le lit ici, on le choisit là-bas — sur une vignette »*
demandent de tenir deux endroits en tête sans dire lesquels. Et le texte à copier réclame *« trois
variantes qui explorent différentes températures de couleur »* quand ce qu'on cherche est **trois
manières de penser la même scène**.

**Ce qui remplace un nombre écrit à la main, quand c'est possible sans rien construire** : le rang
d'une étape se calcule depuis la liste des étapes, le compte des types se lit sur le barème du
projet, et le poids de l'univers **disparaît de la phrase** plutôt que d'être remesuré.

**Critères d'acceptation**

- [x] Les neuf phrases disent vrai, vérifié sur les projets de l'auteur — et **trois de plus**,
      tombées dans le même filet en les corrigeant
- [x] Aucun numéro d'étape n'est écrit à la main : le rang se calcule depuis la liste des étapes
      (`laDesignation`), et un essai le refuse sans exception — `tests/test_g1.py`
- [x] Le compte des types d'objets se lit sur le projet ouvert — `univers.bareme.length`, affiché
      trois lignes sous le barème qui le porte
- [x] La phrase de l'allure ne cite plus de proportion, et dit *l'univers* au lieu de *la tête*
- [x] L'aide de l'*époque* dit ce qu'elle fait — *« ce sont tes descriptions qui décident des
      armes »* — et dit qu'aucun banc n'a mesuré ce qu'elle change
- [x] Les deux phrases *« écrit par l'étape N »* nomment l'étape par son nom, et le nom suit le
      style pour la seule étape qui en porte deux
- [x] Le texte à copier demande trois approches de la même scène, et non trois températures de
      couleur — on choisissait un filtre là où l'on cherche une direction
- [x] Aucun appel payant : cette tranche est de l'écriture. Les deux remesures — la lecture de
      palette et la part lue des artworks — se font sur des fichiers déjà sur le disque

**Bloquée par** — aucune, et elle ne bloque plus rien : *les numéros d'étape étaient à corriger
avant que `D2` soit committée, et c'est fait le même jour.*

---

### G2 · La barre d'attente revient aux tables
*Aucune US neuve — US-6 et US-13 le promettaient déjà* · **famille ②**

**Ce qu'on livre.** Quand une retouche fait attendre, l'écran le dit. Mesuré : l'attente va de
**0,8 à 2,3 seconde**, et elle est la pire **au premier contact avec l'écran** — une image qui sort
d'une génération fait 1 024 px et n'a pas encore de grille, ce qui est exactement l'état dans
lequel on ouvre les tables la première fois. Une fois l'image sur une grille de 64 px, tout retombe
sous le quart de seconde.

**Ce n'est pas un manque, c'est une régression.** La barre a été posée sur la retouche le 27 août,
avec son attente **apprise** — le crochet retient ce que la dernière retouche du même genre a mis,
sur cette machine et sur cette image. Le 31 août, la retouche a déménagé de la fiche vers les
tables : la barre a été retirée d'un côté et jamais remontée de l'autre. **Le calcul, lui, a suivi
le déménagement** — il tourne encore, et personne ne le lit.

**Et aucun essai ne l'a vue partir.** Le seul essai qui exerce cette barre vise le travail des
couleurs, et son commentaire affirme pourtant qu'elle sert *« à la génération **et à la
retouche** »*. Il affirme le partage sans l'exercer.

**Aucune roue qui tourne.** La liste de ce qui bouge reste close, et son seul mouvement continu
reste celui qui dit *où ça en est* — une roue dirait seulement *ça travaille*.

**Critères d'acceptation**

- [ ] Une retouche qui dépasse 240 ms montre la barre ; en dessous, rien ne paraît
- [ ] La barre est celle du produit — la même que la génération et le travail des couleurs
- [ ] Elle se pose en pleine largeur, entre la barre des tables et les trois colonnes, sur 2 px **réservés en permanence**
- [ ] Deux retouches lancées coup sur coup sont une seule attente, pas deux
- [ ] Les réglages restent manœuvrables pendant l'attente : rien ne se verrouille
- [ ] **Un essai pose une retouche lente et attend la barre** — c'est ce qui a manqué pendant une semaine
- [ ] La documentation de la barre cesse de dire que la retouche vit dans la fiche

**Bloquée par** — aucune.

---

### G3 · Les vingt-trois explications s'accrochent
*Aucune US neuve — US-268 les promettait toutes* · **famille ②**

**Ce qu'on livre.** Une explication écrite pour un réglage devient atteignable **depuis ce
réglage**. Compté le 3 septembre 2026 : **35 entrées du recueil sur 122 ne sont citées par aucun
écran**. Une douzaine décrivent un écran entier et vivent légitimement au guide ; **les
vingt-trois autres nomment un contrôle que l'écran montre pourtant** — les sept cases de l'univers,
les trois du barème, les sept places de la recette, et six autres.

**Le cas qui a fait remonter la remarque.** L'auteur n'a pas compris trois réglages des *types
d'objets*. Les trois ont **chacun leur explication écrite dans le recueil**, et l'une d'elles
répond mot pour mot à sa question. Aucune n'est branchée. *Le reproche n'est pas qu'on ne lui a
rien expliqué : c'est qu'on lui a tout expliqué ailleurs.*

**Le dépôt s'était posé la question, et dans un seul sens.** Une règle existe déjà — *une maquette
qui ajoute un écran ou un réglage doit une ligne au guide, et elle l'écrit chez elle* —, écrite
après avoir découvert que onze sujets entiers n'étaient expliqués nulle part. **Elle ne couvre pas
l'inverse**, et l'inverse s'est produit vingt-trois fois.

**Un mot à corriger au passage** : l'interrupteur du barème affiche *« il se découpe »*, quand ce
qu'il fait est **détourer** — et *découper* est le nom d'un autre geste du produit. Le bon mot
était déjà écrit, dans l'entrée qu'on ne pouvait pas atteindre.

**Critères d'acceptation**

- [ ] Les vingt-trois entrées sont atteignables depuis le contrôle qu'elles nomment
- [ ] Aucune explication n'est recopiée dans un écran : elles sont lues dans le recueil
- [ ] **Un essai refuse une entrée qui nomme un contrôle sans être citée par un écran**, avec une liste d'exceptions déclarée pour celles qui décrivent un écran entier
- [ ] Le message d'échec de cet essai nomme la clé et le contrôle attendu
- [ ] L'interrupteur du barème dit *il se détoure*

**Bloquée par** — aucune.

---

### G4 · Les curseurs posent au relâchement
*Aucune US neuve — la règle existe depuis le 27 août 2026* · **famille ②**

**Ce qu'on livre.** Un glissement de curseur envoie **un** ordre au serveur, pas quatre-vingt-dix.

**Ce que l'auteur voyait.** *« Si on les déplace, il continue à bouger tout seul pendant plusieurs
secondes. »* Ce n'est pas un défaut d'affichage : la poignée du curseur **montre l'écho du serveur
au lieu de montrer la main**. Chaque cran traversé écrit l'univers entier ; la réponse remplace
l'univers ; la poignée lit sa position dedans. Elle suit donc la main avec le retard de la file, et
quand on lâche, elle rejoue les réponses en route une par une.

**Mesuré** : 15,4 ms par écrit, **90 crans** pour un glissement d'un bout à l'autre, soit ≈ 1,4 s
de calcul serveur, 90 allers-retours et 90 redessins de tout l'écran. Pendant ce temps, **le
serveur ne sert rien d'autre**.

**La règle est écrite sur le curseur lui-même depuis le 27 août** — *« il envoie ce qu'on a lâché,
pas ce qu'on a traversé »* —, et le produit la tient **dix fois sur dix-sept**. Sur les sept
curseurs qui ne la tiennent pas, quatre font travailler le serveur à chaque cran : celui du barème,
et les trois de la découpe, qui font recalculer une détection **jusqu'à 128 fois** pour un seul
glissement.

**Le piège, et il est déjà écrit ailleurs** : la valeur locale se resynchronise **sur le projet,
jamais sur la réponse du serveur**. S'y resynchroniser rendrait la dérive telle quelle.

**Critères d'acceptation**

- [ ] Un glissement du curseur d'occupation envoie un seul ordre au serveur
- [ ] Les trois curseurs de la découpe ne redemandent une détection qu'au relâchement
- [ ] La poignée suit la main sans attendre aucune réponse
- [ ] Un chiffre écrit dans le champ vaut un relâchement : un seul envoi
- [ ] **Un essai exige que tout curseur pose au relâchement**, ou porte une ligne disant pourquoi il n'en a pas besoin
- [ ] Les trois curseurs légitimes — le pinceau, les deux opacités — portent cette ligne

**Bloquée par** — aucune.

---

### G5 · Le geste qu'on ne trouve pas
*Aucune US neuve — US-352 le livrait déjà* · **famille ②**

**Ce qu'on livre.** Mettre à jour une recette nommée cesse d'être un geste caché. **Le bouton
existe déjà** : retaper le nom exact d'une recette change *Enregistrer* en *Remplacer ›*. Ce n'est
pas un manque, c'est un geste que rien n'annonce — l'auteur l'a réclamé sans savoir qu'il l'avait.

**Critères d'acceptation**

- [ ] Remplacer une recette nommée se voit sans avoir à retaper son nom
- [ ] Le geste reste explicite : rien ne se remplace par accident

**Bloquée par** — aucune. *Se pose dans le même panneau que `G12`.*

---

### G6 · Le menu ne sort plus de l'écran
*Aucune US neuve* · **famille ③** · **provisoire, et assumé**

**Ce qu'on livre.** Sur la toile, le menu d'une carte cesse de sortir par le bas. Le garde-fou
**existe depuis le 27 août** — le menu bascule au-dessus, s'aligne à droite, et défile en dedans
quand il ne tient nulle part — mais il est **éteint sur la toile**, par une décision écrite :
*« un plan n'a pas de bord contre lequel un menu se cogne — on le déplace, ou on l'agrandit »*.

**La décision avait prévu le contournement, et l'auteur dit qu'il ne convient pas** : *« on ne peut
jamais le voir entier sauf si on dézoome et colle le visuel tout en haut »*. Le plan est infini, le
regard ne l'est pas.

**Et son objection technique a été levée depuis, dans le fichier voisin.** Elle disait qu'une
hauteur en pixels d'écran serait fausse dès le premier cran de zoom ; la toile sait désormais poser
du contenu à taille d'écran dans le plan zoomé, et **cinq choses passent déjà par là**, dont les
prises d'une carte.

> ⚠️ **Cette tranche sera jetée par `G7`, et c'est su d'avance.** Une fois la colonne construite, le
> menu flottant ne paraît plus sur la toile : il n'y a plus rien à borner. *Arbitré dans ce sens
> sciemment — quelques lignes perdues contre des semaines de gêne en moins.*

**Critères d'acceptation**

- [ ] Sur la toile, aucun menu ne sort du cadre visible, à aucun cran de zoom
- [ ] Le menu se pose à taille d'écran **par la forme unique** que la toile emploie déjà, jamais par un calcul à lui
- [ ] La décision écrite est réécrite avec sa nouvelle raison, pas retirée en silence

**Bloquée par** — aucune.

---

### G7 · L'écran de l'univers se refait
*1 US (499)* · **famille ③** · **la plus grosse tranche de la version**

**Ce qu'on livre.** La toile redevient ce qu'elle doit être — *un cadre pour poser des idées et les
organiser en concepts et en ambiances* — et le détail d'une carte s'en va dans une colonne.

**Trois choses en une, parce qu'elles se posent au même endroit.**

**Une colonne de droite** de 380 px, qui paraît **quand une carte est choisie** et pas au survol :
son visuel en grand, ses réglages, et ses explications lues dans le recueil. Le problème de
placement **cesse d'exister** au lieu d'être borné.

> ⚠️ **Sur la toile, le survol cesse d'ouvrir un menu.** Sinon le débordement revient par la porte
> qu'on vient de fermer : deux endroits régleraient la même carte, et l'un des deux sortirait
> toujours de l'écran. **En vue grille, rien ne change.**

**La réserve passe à gauche**, et sa bascule quitte la barre du haut pour venir contre la colonne
qu'elle commande. *Cela révise une règle du châssis* — toutes les bascules au même endroit — dont
la raison était qu'un geste unique se cherche à un endroit unique. L'usage dit le contraire :
l'auteur a cherché ce bouton contre sa colonne. **La règle devient : une bascule se pose contre ce
qu'elle commande**, et elle se réécrit avec cette raison.

**Le bloc de lecture de palette s'en va.** *« Ce que la palette y lit »* quitte l'écran de
l'univers — *« une mécanique avancée qui ne devrait pas être mise comme ça sur la toile »*. Avec
lui partent le bouton *regarder*, le pour cent, la phrase contradictoire et le renvoi vers
*Découper*. **On ne répare donc pas cette phrase, on la retire**, et le menu perd son bloc le plus
lourd. La question déménage dans le détail d'une palette, là où elle se pose ; son explication —
l'une des meilleures du recueil — part avec elle.

> ⚠️ **Un calcul de plus, à chiffrer avant de le promettre.** L'atelier sait dire **quelle part**
> d'une image a été écartée et **où** elle est. Il ne sait pas dire **quelle couleur** ce fond
> aurait apportée : la palette se calcule après le détourage. La *« couleur exclue »* demandée par
> l'auteur est un calcul neuf, pas un déplacement.

**Et les cinq changements du menu s'y posent en même temps**, parce que les faire deux fois serait
les faire une fois pour rien : les deux réglages voisins deviennent **« Référence de tout le jeu »**
et **« Référence de cette chose »** ; une ligne mesurée dit ce que **cette carte-ci** fera —
mesuré, **quatre désignations sur six ne font rien** dans le dépôt, parce que la carte partait
déjà ; et le pied de carte cesse de taire une désignation quand la carte est aussi promue.

**Et une chose du jeu se crée depuis là — ajouté le 4 septembre 2026.** *« On règle l'univers avant
d'avoir peuplé le codex ; à ce moment-là il n'y a aucun personnage à qui attribuer une image. »*

> ⚠️ **Le geste ne manque pas seulement : il est invisible.** Le bloc *Concept art de* n'existe
> qu'à la condition qu'il y ait au moins une chose du jeu. **Quand le codex est vide, il ne
> s'affiche pas du tout** — pas une liste vide, pas une phrase, pas un grisé avec sa raison :
> rien. L'auteur ne voit pas qu'il ne peut pas désigner, il ne voit pas qu'il *pourrait*. Le motif
> du dépôt — *le grisé porte sa raison* — n'est pas appliqué là où il servirait le plus.
>
> **Mesuré le 4 septembre 2026** : **deux projets du dépôt sur six ont des images sur leur toile
> et aucune chose du jeu à qui les attribuer** — *cœur de pierre* avec **55 cartes**, *bac à
> sable* avec 5. Sur ces soixante cartes, le geste n'a jamais pu être proposé une seule fois.
>
> **Le réglage voisin, lui, s'affiche toujours** : promouvoir en artwork officiel ne demande
> aucune chose du jeu. Les deux sont côte à côte dans le même menu — celui que cette tranche
> refait — et **l'un est toujours là quand l'autre disparaît sans un mot**.

La colonne montre donc le bloc **même quand le codex est vide**, avec sa raison, et **un champ pour
nommer une chose sur place**. Le champ du codex est réemployé tel quel : nommer suffit à créer, et
le serveur pose la famille. La chose naît, la carte lui est désignée dans le même geste, et la
marque apparaît sur la carte — *le geste va où son effet se voit*, et son effet est là.

*Cela ferme une promesse que le Guide fait et que le code ne tient pas* : « nommer, c'est créer,
**partout** ». `G9` la relève par l'autre bout, pour les poses.

**Critères d'acceptation**

- [ ] Cliquer une carte ouvre une colonne de 380 px qui montre son visuel en grand
- [ ] Tous les réglages d'une carte vivent dans la colonne, et à un seul endroit
- [ ] Les explications y sont **lues** dans le recueil, jamais recopiées
- [ ] Sur la toile, le survol n'ouvre plus de menu ; en vue grille, rien ne change
- [ ] La réserve est à gauche, sa bascule est contre elle, et replier n'est toujours pas fermer
- [ ] *Ce que la palette y lit* a disparu de l'écran de l'univers
- [ ] Les deux réglages de référence portent des noms qui se répondent
- [ ] Une ligne dit ce que cette carte-ci fera, y compris *« la désigner n'ajoute rien »* — en constat, jamais en reproche
- [ ] Une carte promue **et** désignée dit les deux dans son pied
- [ ] La règle des bascules et la décision du menu non borné sont réécrites avec leur raison
- [ ] **Le bloc de désignation s'affiche même quand le codex est vide**, avec sa raison — il ne
      disparaît plus en silence
- [ ] Un champ y nomme une chose du jeu **sur place**, et la carte lui est désignée dans le même geste
- [ ] La marque de la désignation apparaît sur la carte sans qu'on ait changé d'écran
- [ ] Le Guide dit vrai : *nommer, c'est créer* vaut aussi ici

**Bloquée par** — `G6` la rend inutile ; les deux peuvent se faire dans l'ordre inverse.

---

### G8 · L'accueil s'ouvre sur chaque jeu neuf
*2 US (500, 501)* · **famille ③**

**Ce qu'on livre.** Créer un jeu ouvre l'assistant, et ses douze étapes se coupent en deux.

**Mesuré sur les six projets de l'auteur** : **trois n'ont ni vue ni bible** — exactement ceux où
l'assistant ne s'est jamais ouvert. Le barème a été touché **une fois sur quarante-quatre
rangées**. Et trois étapes sur douze n'ont **jamais servi**, dans aucun projet.

**Ce que ça révise.** Une décision écrite dit que créer un second jeu *« referme la porte, et c'est
exactement quand elle doit se refermer »*. Sa raison reste juste pour ce qu'elle visait — ne pas
rouvrir l'assistant sous les doigts de quelqu'un qui travaille. **Elle n'avait pas examiné le jeu
neuf créé plus tard**, qui est aussi vide que le premier. La règle devient : *l'assistant s'ouvre
sur un jeu qui n'a rien*.

**Le partage des douze étapes n'est pas une opinion, il sort de la mesure.** Ce qu'on sait en
commençant — le nom, le style, la vue, la taille, les poses, les emplacements. Ce que le produit
décide déjà bien tout seul, replié — les types, les modèles, le détourage, la façon de réduire, les
fournisseurs. **Chacune des repliées porte déjà, dans son explication, la phrase qui dit que son
défaut est bon.**

**Critères d'acceptation**

- [ ] Créer un projet ouvre l'assistant
- [ ] Un jeu qui n'a rien ouvre l'assistant ; un jeu où l'on travaille ne le voit jamais s'ouvrir seul
- [ ] Les douze étapes sont réparties en deux groupes, le second replié derrière une ligne qui dit pourquoi il peut attendre
- [ ] **Aucune étape ne disparaît** : la page des réglages reste entière
- [ ] **Rien n'est exigé pour commencer** : l'accueil ne ressemble pas à un formulaire à remplir
- [ ] La décision de la porte qui se referme est réécrite avec sa nouvelle raison

**Bloquée par** — aucune.

---

### G9 · Démarrer la première pose
*Aucune US neuve — US-189 rouvre* · **famille ④**

**Ce qu'on livre.** Sur un projet neuf, on voit par où commencer. Aujourd'hui le bouton qui lance
tout ressemble à trois liens gratuits, et **trois documents — dont le guide du produit — promettent
que nommer une chose ouvre son établi**, ce que le code ne fait pas.

**Critères d'acceptation**

- [ ] Nommer une chose ouvre son établi, et Échap remonte au codex
- [ ] Une ligne de pose vide arme l'atelier sur cette pose
- [ ] Le codex propose **une pose seule** d'abord, qui sert ensuite de référence aux autres
- [ ] La phrase d'accueil se lit dans le recueil, et disparaît dès la première image
- [ ] Le guide du produit cesse de promettre ce que l'écran ne fait pas
- [ ] US-189 est rouverte : elle était comptée livrée, et son geste n'existait pas

**Bloquée par** — aucune.

---

### G10 · Le zoom des tables monte
*Aucune US neuve* · **famille ④**

**Ce qu'on livre.** Le zoom des tables cesse de plafonner à 250 %. Le plafond devient **une règle
et non un nombre** — 32 pixels d'écran par pixel d'image, avec un plancher —, ce qui le rend juste
sur une image de 16 px comme sur une de 1 024.

**Et *ajusté* cesse de mentir.** Il promet de remplir le cadre et **échoue sur 73 des 118 images du
dépôt**, parce qu'il passe par le même plafond que le zoom manuel.

**Critères d'acceptation**

- [ ] Le plafond s'adapte à l'image ; *ajusté* remplit le cadre quelle que soit la taille
- [ ] Le champ dit son maximum pendant qu'on tape
- [ ] Le damier grossit avec le zoom, et un quadrillage sourd paraît au-delà d'un seuil
- [ ] Les trois textes qui citaient l'ancien plafond sont corrigés

**Bloquée par** — aucune.

---

### G11 · Éteindre un type d'objet
*2 US (495, 496)* · **famille ④** · **le seul point de la version qui touche au disque**

**Ce qu'on livre.** Un type d'objet s'éteint sans se supprimer — comme une table de la recette
s'éteint sans se vider. Il reste dans le barème, ses réglages sont gardés, il cesse d'être proposé
au moment de fabriquer. *Un jeu de plateforme n'a que faire de « meuble » et d'« objet posé ».*

> ⚠️ **Éteindre ne retire pas du barème, et c'est essentiel.** Une image déjà fabriquée porte le nom
> de son type, et le serveur refuse un nom qu'il ne trouve plus. Un type éteint doit rester
> résoluble, sans quoi l'éteindre casserait des images anciennes.

**Et ça débloque un défaut mesuré.** Tant qu'on ne pouvait rien retirer, ajouter les types manquants
à un vieux projet lui imposait des rangées dont il n'a que faire. Une fois qu'on peut éteindre, **un
projet reçoit les types entrés après sa création** — le projet principal de l'auteur en porte sept
là où le produit en livre huit, et sa bible en porte cinq là où les autres en ont sept.

**Critères d'acceptation**

- [ ] Un type éteint ne paraît plus dans le choix du sujet, et ses réglages sont gardés
- [ ] Une image fabriquée avec un type depuis éteint reste lisible et relançable
- [ ] Un projet reçoit les types du barème livré entrés après sa création
- [ ] Le bouton *+ type sur mesure* reste éteint et porte une raison qui dit vrai

**Bloquée par** — aucune. *Se pose avec `G1`, qui corrige la phrase de ce bouton.*

---

### G12 · Une recette sur plusieurs images
*2 US (497, 498)* · **famille ④** · **et un défaut à réparer avant**

**Ce qu'on livre.** Une recette nommée se pose sur une sélection d'images en un geste, depuis la
colonne des sœurs — l'ensemble qu'on a déjà sous les yeux.

> ⚠️ **Un défaut se répare d'abord.** Poser une recette nommée peut réécrire en silence un réglage
> de bord que l'auteur avait posé à la main, ce qui contredit un critère d'acceptation déjà livré.
> *Sur une image à la fois, on le verrait. Sur trente, non.*

**Ce qui protège le travail fait à la main.** Un liseré orange sur les images déjà retouchées à la
main, avec une légende et un bouton pour toutes les désélectionner. Un liseré rouge, non
sélectionnable, sur **les calques que la recette choisie décalerait** — et **seulement pour ces
recettes-là** : mesuré place par place, la grille et le recadrage décalent un calque, la
quantification et les contours ne lui font rien. Les liserés se recalculent quand on change de
recette.

**Ce qui n'a pas voyagé se dit une fois pour le lot**, pas trente fois.

**Critères d'acceptation**

- [ ] Le défaut du bord réécrit en silence est réparé **avant** que la pose en lot existe
- [ ] La colonne des sœurs porte un zoom, et une sélection au clic
- [ ] Un sélecteur de recette et un bouton *appliquer* au pied de la colonne
- [ ] Liseré orange sur les images retouchées à la main, légende, et bouton pour les désélectionner
- [ ] Liseré rouge et non sélectionnable sur les calques que **la recette choisie** décalerait, recalculé à chaque changement de recette
- [ ] Ce qui n'a pas voyagé est dit une fois pour tout le lot
- [ ] Une route serveur qui prend une liste, pour ne pas sérialiser trente appels
- [ ] L'invariant de la grille unique est amendé : la colonne des sœurs est une quatrième surface

**Bloquée par** — aucune. *`G5` se pose dans le même panneau.*

---

### G13 · Le modèle « lourd » ne détoure rien
*Aucune US neuve* · **les trois défauts**

**Ce qu'on livre.** Le catalogue des modèles de détourage cesse de proposer un modèle qui ne fait
rien. **Vérifié le 3 septembre 2026** : la bibliothèque installée ne connaît pas ce nom-là et
**retombe sans rien dire sur le rapide** — 100,00 % d'accord entre les deux résultats, à la
milliseconde près. L'écran annonce pourtant *« plusieurs secondes par image »*, et **973 Mo dorment
sur le disque dans un dossier que rien n'ouvre**.

**Ce qui reste à trancher** : retirer le modèle du catalogue, ou exiger la version de bibliothèque
qui le connaît. La dépendance est déclarée sans borne haute, donc rien n'oblige une machine à porter
la version sur laquelle les mesures ont été faites.

**Critères d'acceptation**

- [ ] Aucun modèle proposé ne rend silencieusement le résultat d'un autre
- [ ] Un modèle que la bibliothèque installée ne connaît pas est grisé avec sa raison, jamais proposé
- [ ] Le poids annoncé et la lenteur annoncée correspondent à ce que le modèle fait vraiment

**Bloquée par** — aucune. *À arbitrer avant d'être construite.*

---

### G14 · Le calage horizontal effacé en silence
*Aucune US neuve* · **les trois défauts**

**Ce qu'on livre.** Un calage patiemment ajusté cesse de disparaître au premier cran de curseur.
**Vérifié par la route** : le décalage n'est écrit que par le calibrage, et la charge de l'écran ne
le porte pas — reposer n'importe quel réglage de la grille le remet donc à zéro, sans un mot.

**Critères d'acceptation**

- [ ] Reposer un réglage de grille ne remet aucun calage à zéro
- [ ] Un calage ne se perd jamais sans que l'auteur l'ait demandé

**Bloquée par** — aucune. *À arbitrer avant d'être construite.*

---

### G15 · Sans artwork officiel, aucune couleur n'est réduite
*Aucune US neuve* · **les trois défauts**

**Ce qu'on livre.** L'atelier cesse de laisser sortir un sprite à dix mille couleurs sans le dire.
La réduction de couleurs n'entre que s'il existe une palette, et **la palette se déduit des artworks
officiels et d'eux seuls** — pas d'artwork déposé, donc pas de palette, donc aucune réduction, et
rien ne le signale.

**Ce que ça demande.** L'annoncer, proposer de choisir une image de l'univers, et renvoyer vers un
chapitre du guide qui explique comment fabriquer les artworks d'un personnage — **ce chapitre
n'existe pas**.

> Un auteur qui a désigné des concept arts et promu zéro carte n'a **aucune palette**, et croit
> avoir donné ses couleurs à son jeu. C'est le même fait que `G7` prend par l'autre bout.

**Et le mur tombe : une image de la galerie peut être promue — ajouté le 4 septembre 2026.**

> ⚠️ **Une image que l'atelier a fabriquée et payée ne peut pas donner ses couleurs au jeu.**
> Mesuré le 4 septembre 2026 : promouvoir en artwork officiel **se pose sur une carte** de la
> toile, et rien d'autre n'est promouvable ; une image fabriquée est un **asset**, elle vit dans la
> galerie ; **aucun geste ne fait passer l'un dans l'autre, dans un sens ni dans l'autre.** Et une
> carte ne naît que de quatre collages — un fichier, une adresse, un texte, le découpage d'une
> carte déjà là : **aucun ne passe par un fournisseur.**
>
> Le seul chemin existant est de **télécharger l'image puis de la redéposer** sur la toile, ce qui
> fabrique une seconde copie du même fichier dont l'atelier ne saura plus qu'elle vient de lui.

La tranche l'ouvre : **une image de la bibliothèque se promeut en artwork officiel**, exactement
comme une carte. Rien ne bouge sur la toile, rien ne se duplique, et la palette gagne les images que
l'atelier sait faire. *C'est ce qui donne une réponse au cas que le reste de la tranche ne couvre
pas* : proposer de **choisir** une image de l'univers suppose qu'il y en ait une, et cette
remarque-ci est née du cas où il n'y en a aucune.

> **Deux tiers de la remarque d'origine n'ont rien à construire, et il faut le dire.** L'auteur
> demandait aussi *« que la description du personnage vive quelque part »* et *« pouvoir composer
> des prompts sur mesure et fournir différentes références »*. **Les deux existent** : la
> description est un champ de la chose du jeu, qui part dans chaque appel la concernant et que le
> geste *garder cette correction sur la chose* écrit ; la composition d'un prompt avec plusieurs
> références **est le cœur du produit**. Ce qui manque n'est pas de les construire, c'est que
> l'auteur ne sache pas qu'ils existent — **et c'est le sujet de cette tranche-ci**, qui est celle
> qui dit ce que le produit fait.
**Critères d'acceptation**

- [ ] Un projet sans artwork officiel le dit avant qu'une image en sorte
- [ ] Le produit propose de promouvoir une image de l'univers depuis l'endroit où le manque se voit
- [ ] Le guide gagne le chapitre qui explique comment fabriquer les artworks d'une chose
- [ ] Rien ne réclame : le manque s'annonce, il ne s'excuse pas
- [ ] **Une image de la bibliothèque se promeut en artwork officiel**, et compte dans la palette
      exactement comme une carte promue
- [ ] Elle ne se duplique nulle part : aucun fichier de plus sur le disque
- [ ] La promotion dit la même chose des deux côtés — sur une carte et sur une image — **et un
      essai le tient**
- [ ] Le manque annoncé propose **les deux** chemins : choisir une image de l'univers, ou en
      fabriquer une

#### L'arbitrage, commencé le 3 septembre 2026 puis arrêté

> **Rien n'a été construit, et c'est voulu** : la V3.1 est deux versions plus loin que ce qui est
> ouvert — la V2.3 est close depuis le 3 septembre 2026, et la V3 n'est pas ouverte. Ce qui
> suit est **mesuré**, et n'attend que d'être relu le jour où la tranche s'ouvrira pour de bon.

**Le titre de la tranche est faux, et il faudra le réécrire.** « Sans artwork officiel, aucune
couleur n'est réduite » a cessé d'être vrai en `D2`. Ce qui commande la réduction est désormais le
**style** du jeu et l'existence d'une **taille de carrés** — plus la palette : `Univers.recette_de`
pose une quantification dès qu'un jeu est en pixel art et porte une cible, avec ou sans artwork.

> **Mesuré.** Un jeu en pixel art, 64 carrés de côté, 32 couleurs demandées, **zéro artwork
> officiel** : une image de **65 536 teintes en ressort avec 32**. Le sprite à dix mille couleurs
> que la tranche veut empêcher **ne peut plus sortir**.

**Les deux cas où rien n'est réduit sont des décisions, pas des défauts**, et aucun des deux ne
dépend de l'artwork : un jeu **en dessin** — le réduire en ferait une affiche sérigraphiée, et
`Univers.recette_de` le dit en toutes lettres —, et un jeu **sans taille de carrés**, où il n'y a
pas de sprite du tout.

**Ce qui reste vrai est plus petit, et mérite quand même la tranche.** Sans artwork officiel il n'y
a **pas de palette commune** : chaque image invente son propre vocabulaire de couleurs, et le jeu ne
parle donc pas d'une seule voix. C'est *ce fait-là* que la tranche doit annoncer — pas l'absence de
réduction, qui n'existe plus.

| Critère | Ce qui est déjà là, mesuré |
| --- | --- |
| ① le dire avant qu'une image sorte | **à moitié.** L'assistant le dit, et branche même sur le style — deux phrases, l'une pour le pixel art, l'autre pour le dessin. **Les tables disent autre chose** : *« ce jeu n'a pas de palette — l'univers en déduit une des artworks officiels »*, une promesse de mécanisme là où il faudrait la conséquence, et sans branche de style. Le serveur, lui, rend déjà `traitement.quantification.note` — **et personne ne la lit** : le champ existe depuis `D2` et aucun écran ne s'en sert. Son texte ne branche pas non plus sur le style, alors que l'écran, si : c'est le piège *« une phrase exacte dans un mode devient un mensonge dans l'autre »* en germe |
| ② proposer de promouvoir une image | **pas fait.** Les deux phrases existent, **aucune n'est cliquable**. Le chemin se copie sans rien inventer : `Raison` porte déjà `ouAller` / `onAller`, et `EcranUnivers` porte déjà `onAllerAuxAmbiances`, qui fait exactement ce geste vers un autre côté. Il manque le jumeau vers le côté Inspiration, descendu jusqu'à l'assistant **et** jusqu'à la table de quantification |
| ③ le chapitre du guide | **pas fait.** Le guide a deux parties — *Le geste* (six temps) et *Les lieux* (quatre) — et son chapitre `L'univers` nomme le tableau d'inspiration sans dire un mot de la promotion en artwork officiel, ni de ce qu'elle change |
| ④ rien ne réclame | **tenu** partout où le manque se dit aujourd'hui |

> ⚠️ **Un défaut trouvé en chemin, dans le panneau même qu'il faudra réécrire.** La table de
> quantification propose **4 · 8 · 16 · 32 · 64** couleurs. Le projet, lui, compte depuis `D2` en
> **8 · 16 · 32 · 64 · 128 · 256**, plafonnés par le côté du sprite. Un jeu réglé à 128 couleurs
> ouvre sa table et **n'y voit aucun segment allumé** — la comparaison est stricte —, et le premier
> clic écrase son réglage sans un mot. `paliersDeCouleurs(univers.cible_px)` existe déjà et rend la
> bonne liste ; il faudra la seconde rangée, comme la cible de la table de grille.

> ⚠️ **Ce que la promotion d'une image laisse ouvert.** Un artwork officiel porte une **famille**, qui décide avec quelles générations il part. Une carte en a une ; une image de la bibliothèque porte autre chose — un personnage, une pose, une pièce. *À trancher en construisant : la déduire de la chose du jeu à laquelle l'image appartient est la piste évidente, elle n'est pas vérifiée.*

**Bloquée par** — aucune, mais **elle ne se prend pas maintenant** : c'est la V3.1, et la V3 passe
devant — la V2.3 est close depuis le 3 septembre 2026. *L'arbitrage ci-dessus est fait ; il reste
à trancher le nouveau titre et à construire.*

---

### G16 · Ce qui est revenu du modèle se voit, et se reprend à la main — ✅ **livrée le 3 septembre 2026**
*3 US — `US-369` reprise à `P1`, `US-502` et `US-503` neuves* · **familles ② et ④**

> **Prise hors tour, le 3 septembre 2026, à la demande de l'auteur.** La V2.3 attendait alors `D3`
> et `D4`, et la V3 n'est pas ouverte : cette tranche passe devant en vertu de la seule permission que la
> version se donne — *si une gêne devient insupportable à l'usage, sa tranche se prend seule, sans
> rien déplacer*. Rien d'autre ne bouge, et l'ordre des autres tranches est intact.

**Le défaut, en clair.** Quand une pièce d'équipement revient du modèle, l'atelier ne range pas ce
qu'il a reçu : il le compare au corps de la pose, en déduit le vêtement seul, et c'est ce
vêtement-là qui entre en bibliothèque. **L'image payée, elle, reste sur le disque sans aucune porte
pour l'ouvrir.** L'auteur ne voit donc jamais ce qu'il a acheté. Et quand le calage automatique
tombe mal, il ne peut pas le refaire : la table de superposition existe, mais elle ne travaille
qu'avec deux images qu'on lui nomme, et la seule qu'on puisse lui donner aujourd'hui est **le
résultat** du calage qu'on voudrait justement défaire.

**Ce qu'on livre**, et les quatre morceaux tiennent ensemble parce qu'ils reposent tous sur la même
image — celle que le modèle a renvoyée :

1. **La planche revenue entre dans la galerie**, comme une image à part entière : elle se cherche,
   s'ouvre en grand, se met en favori, s'exporte, et elle porte sa génération et son coût.
2. **La carte d'une pose d'équipement gagne une bascule *calque* / *brut***, dans la colonne de
   droite de la fiche du personnage : on voit le vêtement découpé, ou **la case telle qu'elle est
   arrivée**, sans quitter l'écran ni perdre ce qu'on était en train de régler. La carte parle
   d'une pose, elle montre donc la case de cette pose ; la planche entière se regarde dans la
   galerie.
3. **Un bouton *superposition* sur cette même carte** ouvre la table qui existe déjà, **remplie des
   deux bonnes images** : la case telle qu'elle est arrivée en dessus, le corps de la pose en
   dessous. On y refait le calage, le seuil, la zone, à la main.
4. **Valider fabrique un second vêtement à côté du premier**, sans toucher au premier. Les deux
   coexistent, on compare, on supprime le moins bon. *Choix de l'auteur le 3 septembre 2026, contre
   le remplacement — qui était l'autre option, et qui aurait fait perdre l'ancien résultat.*

**Ce qui la rend courte, et ce n'est pas une impression.** L'adresse qui sert l'image renvoyée
**existe et fonctionne** — elle n'est branchée sur aucun écran qu'on puisse atteindre, ce qui est le
cas d'école de la famille ②. Le recalcul d'une case à partir de la planche **existe aussi** : c'est
ce que fait le rejeu du recalage, qui sait déjà refuser proprement quand la planche a quitté le
disque. Et une image sans recette s'affiche déjà par l'adresse de son emplacement plutôt que par son
rendu. Il n'y a donc ni fichier neuf, ni migration, ni calcul neuf : **il y a des portes à poser sur
ce qui est là**.

**Quatre décisions durables.**

- **Rien de plus sur le disque.** La case telle qu'elle est arrivée se **recalcule** de la planche,
  elle ne se range jamais. C'est la règle du rejeu du recalage, réemployée sans une ligne de plus —
  et c'est ce qui évite de dupliquer chaque équipement en bibliothèque.
- **Aucune adresse neuve pour la planche.** Celle des images d'une génération la sert déjà.
- **La planche entre sans recette**, comme une image importée telle quelle : ce n'est pas un sprite,
  on ne la met ni sur grille ni en palette, et la nature *morceau de planche* continue de ne
  désigner que ses morceaux. **Aucune troisième nature ne s'ouvre**, et la phrase du dépôt qui
  l'affirme reste vraie.
- **Aucun appel, aucun centime.** Tout se recalcule de ce qui a été payé une fois, et la tranche
  entière se vérifie réseau coupé.

**Le mot *brut* cesse de désigner deux choses en silence.** Sur un corps habillé, *brut* est la case
telle qu'elle est arrivée ; sur un vêtement, c'est la case **déjà mise à l'échelle et calée sur le
corps**. Deux images d'une même planche, deux sens du même mot, et rien à l'écran ne dit lequel on
regarde — c'est ce qui a fait écrire à l'auteur *« le brut semble prendre souvent le calque déjà
découpé »*, et il avait raison. La tranche ne refait pas le rangement : elle **dit**, sur la bascule
et sur la table, ce que chacun des deux montre. *Faire que les deux bruts soient la même chose est
un autre sujet, et il n'est pas ouvert ici.*

> ⚠️ **Ce que cette tranche prend à `P1`, et ce qu'elle lui laisse.** `US-369` — *« retrouver la
> planche entière dans ma galerie »* — quitte `P1` et arrive ici ; le critère correspondant a été
> retiré de sa liste, qui le dit. `P1` garde tout son vrai sujet : **refaire un découpage à la
> main**, plusieurs découpages qui coexistent, la filiation de chaque image jusqu'à son découpage, et
> la suppression qui ne casse rien. *Elle n'en est ni raccourcie, ni avancée d'un jour.*

**Critères d'acceptation**

- [ ] Une planche revenue apparaît dans la galerie comme une image, avec sa génération et son coût
- [ ] Elle se cherche, s'ouvre en grand, se met en favori et s'exporte comme n'importe quelle image
- [ ] Elle porte un nom qui dit ce qu'elle est et de quelle demande elle vient
- [ ] **Elle n'hérite d'aucune recette** : ni grille, ni réduction de couleurs, ni détourage du projet
- [ ] La carte d'une pose d'équipement porte une bascule *calque* / *brut*, et l'écran dit lequel des deux il montre
- [ ] Sur cette carte, *brut* montre **la case de cette pose**, telle qu'elle est arrivée — pas la planche entière
- [ ] Basculer ne perd rien de ce qui était en cours de réglage sur la carte
- [ ] Un bouton *superposition* sur cette carte ouvre la table **déjà remplie** : la case telle qu'elle est arrivée en dessus, le corps de la pose en dessous
- [ ] La case telle qu'elle est arrivée se recalcule de la planche — **aucun fichier neuf, aucune migration**
- [ ] Valider fabrique un **second** vêtement à côté du premier, et ne touche pas au premier
- [ ] La fiche du personnage dit lequel des deux compte pour cette pose, et laisse en changer
- [ ] Supprimer l'un des deux ne touche ni à l'autre, ni à la planche
- [ ] Une planche qui a quitté le disque **refuse** le geste avec sa raison, au lieu de l'offrir et d'échouer
- [ ] Aucun appel au fournisseur, aucun centime : la tranche entière se vérifie réseau coupé

> ⚠️ **Ce qu'elle laisse à `P1`, et qui se voit à l'usage dès maintenant.** Supprimer une
> planche depuis la galerie efface son fichier — c'est la règle du produit depuis T3, *pas
> d'image sur le disque, pas d'asset*. Le recalage et la case arrivée refusent alors **avec
> leur raison**, proprement ; mais l'auteur ne sait pas, au moment où il supprime, combien
> d'images en dépendent. C'est mot pour mot le critère de `P1` — *supprimer la planche
> demande confirmation et dit combien d'images en dépendent* —, et il reste chez elle.

**Bloquée par** — aucune.

---

