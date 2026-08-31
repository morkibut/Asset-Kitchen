# U1 à U13 · Les treize reprises d'usage de la V2.1

*Ouvertes le 31 août 2026, après **deux** séances d'usage de l'auteur sur la V2.1 entière —
la seconde le même soir, sur les tables de l'atelier seules.*

> Le détail d'un lot en cours — ce que chaque étape livre, ses critères d'acceptation,
> ce qui la bloque, et ce qui a été mesuré pour l'écrire. **`docs/PLAN.md` fait foi sur
> l'ordre et sur l'état ; ce fichier-ci ne fait foi sur rien** : il conserve, il ne
> tranche pas. En cas d'écart, `docs/PLAN.md` a raison.
>
> Même forme que `docs/tranches/V2.1.md`, et pour la même raison : neuf étapes dans le
> plan pèseraient autant que la V2.2 entière, alors qu'aucune n'ajoute une version.

---

## D'où viennent ces treize étapes

De deux séances, pas d'une relecture.

**La première** a parcouru la V2.1 entière : l'auteur s'est servi de l'atelier refait et a
relevé **quinze points** dans l'ordre où il les a rencontrés. Deux d'entre eux étaient déjà
réparés au moment du relevé, un troisième l'a été dans la foulée : il en reste douze, et ils
tiennent en neuf étapes — `U1` à `U9`.

**La seconde**, le même soir, n'a plus regardé que les tables de l'atelier, de près. Elle a
relevé **six points**, dont une question sur le comportement du détourage à laquelle le code
répond — la réponse est écrite en `U10`, parce qu'elle explique probablement l'un des cinq
autres. Les cinq restants tiennent en quatre étapes — `U11` à `U13`, et `U10` qui porte aussi
la réponse.

**Ce que la seconde séance ajoute et que la première n'avait pas** : deux de ses points ne
sont pas des réparations mais des outils qui manquent — une sélection qu'on trace grossièrement
et que l'atelier ajuste, et un second moteur de détourage plus lourd. Ils sont ici parce qu'ils
sont nés d'un usage, comme le reste ; ils demandent un passage par le document du produit
avant d'être construits, comme les trois autres capacités du lot.

**Chaque point a été vérifié sur la machine de l'auteur avant d'être planifié**, l'atelier
tournant sur son port habituel. C'est ce qui distingue ce lot des cinq reprises de la V2 :
là-bas on repartait d'un symptôme raconté, ici chaque ligne porte ce qu'on a vu et, quand
c'était mesurable, ce qu'on a mesuré. Trois points sur douze ont changé de nature à la
vérification — le plus gros n'était pas là où le symptôme le désignait.

### Les trois points déjà fermés, et par quoi

Ils ne sont pas des étapes. Ils sont ici pour qu'on ne les replanifie pas.

| Ce que la séance a vu | Ce qui l'a fermé |
|---|---|
| Un morceau de galerie écrasé au bas de l'atelier, seulement sur une image sans chose du jeu | Commit `4afcaa8`, le 31 août 2026 à 21 h 10. La grille restait montée **sous** la table : invisible, mais vivante — 83 commandes hors écran atteignables à la tabulation, et 54 px de débordement qui faisaient reparaître son pied. Elle se retire maintenant quand une table s'ouvre |
| Générer, depuis le codex, n'ouvrait plus l'écran de confirmation | **Le même commit.** La case *ne plus me le montrer* fabriquait une clé vide quand rien n'était armé — c'est-à-dire pour toute génération écrite à la main —, donc la cocher une seule fois éteignait l'écran dans tous les jeux et pour toujours. C'était la case « pour toujours » que l'écran de confirmation s'était expressément interdite, atteinte par accident |
| La table de grille ne proposait pas toutes les tailles ; 128 sortait de l'écran | Corrigé dans la copie de travail du 31 août 2026 : les neuf tailles du domaine au lieu de sept, sur deux rangées. Le domaine et l'assistant en proposaient neuf depuis la veille, la table sept — **un jeu réglé sur 8 ou sur 256 n'avait aucun outil pour appliquer sa propre taille**. Un essai tient désormais les deux listes ensemble |

**Ce qu'il faut faire pour les voir partir** : recompiler l'interface et recharger la page
en forçant le cache. Les deux premiers sont partis après le relevé, le troisième n'est pas
encore validé.

### Les quatre arbitrages tranchés avant d'écrire

Quatre points demandaient une décision que le code ne pouvait pas prendre seul. Ils ont été
posés à l'auteur et tranchés le 31 août 2026 ; le journal des décisions d'apparence
(`docs/design-decisions.md`) en garde la raison et le coût.

1. **Le zoom de l'atelier est libre, de 1 à 250 %, sans marque.** La règle des multiples
   entiers — qui interdit d'agrandir un sprite à une échelle qui fabrique des pixels
   n'existant pas — appartient à ce qui **montre** une image : la grille et la vitrine.
   L'atelier est ce qui la **travaille**, et on n'y règle rien sans pouvoir approcher et
   reculer. La règle ne le concerne pas, et l'y avoir appliquée est la cause de U2.
2. **Éteindre une table la met en veille et garde ses réglages.** Le coût est nommé : un
   champ de plus dans la recette, donc dans son empreinte, dans les outils de l'agent et
   dans les essais.
3. **Les réglages voyagent de deux façons, et les deux sont construites** : un
   copier-coller entre deux images pour l'instant, une recette nommée pour la fois
   d'après.
4. **L'écran de confirmation replie les longs textes, avec un bouton pour les déplier** —
   partout, y compris dans la colonne qui les rendait mot pour mot. L'invariant écrit en
   E14 est amendé, pas contourné : voir U9.

---

## U1 · L'argent ne part qu'une fois, et l'écran de confirmation se quitte

**Critères : 6 · Ce que ça corrige : deux points de la séance**

### Ce qu'on livre

**Le bouton qui paie refuse le second clic.** Cinq clics rapides sur *Payer et lancer*
lançaient cinq appels payants, en silence. Ce n'est pas un manque de garde-fou : le
garde-fou existe, et il est côté serveur depuis toujours — une génération porte un
identifiant, et le service rend *déjà soumise* sans rien facturer quand il revoit le même.
**C'est l'écran qui le jetait** : il fabriquait un identifiant neuf à chaque clic, donc
chaque clic était une intention neuve, donc chacune se payait.

L'identifiant est désormais fabriqué **une fois par intention** — à l'ouverture de l'écran
de confirmation, et refait seulement quand ce qui part change. Le bouton dit qu'il est en
train de payer et n'accepte pas de second clic tant que l'appel n'est pas revenu.

**Et l'on peut quitter l'écran de confirmation en changeant d'onglet.** Cliquer *Galerie*
changeait le fil d'Ariane et laissait l'écran en place : on était enfermé dans un écran
qu'aucun onglet ne pouvait fermer. Changer d'onglet remonte de toute profondeur — c'était
déjà vrai de la découpe, des dépenses, de l'établi et des tables ; l'écran de confirmation
manquait à la liste.

### Critères d'acceptation

- [ ] Cinq clics consécutifs sur *Payer et lancer* ne produisent **qu'un seul appel payé**,
      et le journal des dépenses n'en compte qu'un.
- [ ] Pendant l'appel, le bouton dit qu'il paie et n'est plus cliquable ; il ne redevient
      cliquable que si l'appel échoue.
- [ ] Modifier le texte, le tri ou le modèle pendant que l'écran est ouvert refait
      l'identifiant : deux appels réellement différents restent deux appels.
- [ ] Le raccourci qui paie sans passer par l'écran — celui d'une série où l'on a coché
      *sauter* — porte le même verrou.
- [ ] Cliquer *Galerie*, *Univers* ou *Codex* depuis l'écran de confirmation le ferme et
      montre l'onglet demandé, sans rien dépenser.
- [ ] Un essai d'écran envoie deux clics dans la même image de rendu et vérifie qu'un seul
      appel part.

### Bloquée par

Aucune — démarrable immédiatement, et c'est la première parce que c'est la seule qui coûte
de l'argent réel.

---

## U2 · Le zoom de l'atelier, et le recadrage qui en dépendait

**Critères : 9 · Ce que ça corrige : trois points de la séance**

### Ce qu'on livre

**Un zoom d'outil, pas un zoom de vitrine.** L'atelier n'offrait que des crans entiers —
1×, 2×, 4×, 8×, 16× — plus un *ajusté* qui ne descendait jamais sous 1×. Une image plus
grande que le cadre ne pouvait donc pas être vue en entier. À la place : **plus** et
**moins**, un pour cent qu'on écrit, un retour à 100 % qui rend un pixel d'image pour un
pixel d'écran, et **la molette qui approche et recule**.

**C'est ce plancher à 1× qui cassait la table de recadrage**, et le symptôme n'y
ressemblait pas. Mesuré sur la machine de l'auteur : l'image d'origine fait 1 024 pixels de
côté, le cadre en offre 606 sur 626, et le zoom ne pouvait pas descendre — on ne voyait
donc **qu'un coin de l'image**, et ce coin étant transparent, ce que l'écran montrait était
le damier de transparence. C'est le « bruit » du relevé. Le rectangle qu'on trace se posait
juste, mais dans un coin qu'on ne pouvait pas situer : d'où « le rendu n'a rien à voir avec
le cadre que je dessine ».

**La table de recadrage est reprise sur sa maquette**, qui allait plus loin que ce qui a
été construit : deux valeurs à la place d'une case — *la boîte du sujet*, qui se recalcule,
et *une boîte tracée*, qui se fige —, les quatre coordonnées écrites avec leur provenance,
et la part du fichier que le cadrage jette. S'y ajoute ce que la séance a trouvé : **la
marge s'ajoute à la boîte tracée**, ce qui est le comportement voulu mais que rien ne
montrait — le rectangle dessiné et le rectangle obtenu sont désormais tous les deux à
l'écran, le second en pointillé.

**Et l'on télécharge l'état courant depuis n'importe quelle table.** Le PNG de ce qu'on a
sous les yeux, quelle que soit la table ouverte et quel que soit le mode — rendu ou brut.

### Critères d'acceptation

- [ ] Une image de 1 024 px s'ouvre **entière** dans le cadre de la table, sur tous les
      onglets où une table peut s'ouvrir.
- [ ] Le pour cent s'écrit à la main entre 1 et 250 ; hors bornes, il est ramené sans
      refuser.
- [ ] *Plus*, *moins* et *100 %* sont trois commandes distinctes, et 100 % rend exactement
      un pixel d'image pour un pixel d'écran.
- [ ] La molette approche et recule dans le cadre, et **ne fait plus défiler la page**.
- [ ] Le point sous le pointeur reste sous le pointeur quand on approche à la molette.
- [ ] La table de recadrage porte les deux valeurs de sa maquette, les coordonnées écrites
      avec leur provenance, et la part jetée en pour cent.
- [ ] Le rectangle tracé **et** le rectangle obtenu après marge sont visibles ensemble ; ce
      que le rendu montre est ce que le second entoure.
- [ ] Tracer un rectangle sur une image affichée à 37 % désigne les mêmes pixels qu'à 100 %.
- [ ] Un bouton télécharge le PNG de l'état courant depuis chaque table, en rendu comme en
      brut, et le fichier reçu est celui qu'on voyait.

### Bloquée par

Aucune. Mais **rien d'autre ne se juge tant qu'elle n'est pas là** : les six étapes qui
suivent se vérifient sur des images qu'il faut pouvoir regarder en entier.

---

## U3 · Un curseur prend un chiffre

**Critères : 5 · Ce que ça corrige : un point de la séance**

### Ce qu'on livre

Tous les réglages à curseur du produit acceptent qu'on écrive leur valeur. Un champ à
droite du curseur, cliquable, où l'on tape le nombre exact ; et **la frappe au clavier
pendant qu'on tient le curseur** remplit ce champ sans qu'on ait à le viser, comme dans les
logiciels d'image. Entrée valide, Échap annule, et sortir du champ vaut Entrée.

**Un seul composant les porte tous** — dix-sept emplois répartis sur sept écrans : la
retouche, la découpe, la superposition, les palettes, l'assistant de démarrage, la fiche et
les réglages. La correction se fait une fois et se voit partout, ce qui est la raison pour
laquelle cette étape est courte.

La règle acquise en T2 ne bouge pas : **un curseur envoie ce qu'on a lâché, pas ce qu'on a
traversé**. Un chiffre écrit vaut un relâchement — un seul envoi, jamais un par frappe.

### Critères d'acceptation

- [ ] Chaque réglage à curseur porte un champ où sa valeur s'écrit, et les deux disent
      toujours la même chose.
- [ ] Taper un chiffre pendant qu'on tient le curseur remplit le champ sans qu'il ait été
      cliqué.
- [ ] Entrée valide, Échap rend la valeur d'avant, quitter le champ vaut Entrée.
- [ ] Une valeur hors bornes est ramenée dans les bornes et le dit, elle n'est pas refusée
      en silence.
- [ ] Un chiffre écrit produit **un seul** envoi au serveur, comme un relâchement.

### Bloquée par

Aucune.

---

## U4 · Une table s'éteint, et ça se voit

**Critères : 7 · Ce que ça corrige : un point de la séance**

### Ce qu'on livre

**Le petit carré de la barre des tables devient un interrupteur.** Il ne disait jusqu'ici
qu'une chose — *cette place change l'image* — et il ne se cliquait pas ; on l'ouvrait, la
table, sans jamais pouvoir l'éteindre. On peut désormais l'éteindre et la rallumer d'un
clic depuis la barre, sans ouvrir la table.

**Éteindre garde les réglages.** C'est la différence avec *Sans cette table ›*, qui existe
déjà au pied de chaque colonne et qui, lui, vide la place. Une place en veille reste
écrite dans la recette, avec toutes ses valeurs, et cesse simplement d'agir sur l'image.
On la rallume et on retrouve ce qu'on avait posé.

**Et une table éteinte le dit quand on l'ouvre.** C'était l'autre moitié du relevé : rien
ne distinguait à l'écran une table qui agit d'une table qui n'agit pas, et toucher
n'importe quel réglage l'allumait sans prévenir. La colonne d'une table en veille est
visiblement éteinte, avec un seul geste pour la réveiller ; toucher un réglage la réveille
toujours, mais en le disant.

**Ce que ça coûte, et c'est nommé** : la recette gagne un champ — la liste des places en
veille. Ce champ entre dans l'empreinte de la recette, donc dans ce qui décide qu'un rendu
est à refaire ; il traverse les outils de l'agent ; et le traitement saute une place
endormie sans que l'ordre des sept places bouge d'un cran.

### Critères d'acceptation

- [ ] Cliquer le carré d'une place l'éteint ; recliquer la rallume, et les réglages sont
      ceux d'avant.
- [ ] Une place éteinte ne change plus l'image, et son carré se distingue d'un carré creux
      — *éteinte* et *vide* sont deux états, pas un.
- [ ] Ouvrir une table éteinte montre une colonne visiblement éteinte, avec le geste pour
      la rallumer.
- [ ] Toucher un réglage d'une table éteinte la rallume **et l'annonce**.
- [ ] Deux images traitées par la même recette, l'une avec une place en veille et l'autre
      sans cette place du tout, sortent identiques au pixel près.
- [ ] L'empreinte de la recette change quand une place s'endort : le rendu se refait.
- [ ] L'agent lit et pose l'état de veille comme n'importe quel autre réglage de recette.

### Bloquée par

Aucune. **À faire avant U5** : une recette qui voyage doit emporter l'état de veille,
sinon un collage rallumerait des places que l'on avait éteintes.

---

## U5 · Les réglages voyagent d'une image à l'autre

**Critères : 8 · Ce que ça corrige : un point de la séance**

### Ce qu'on livre

Deux gestes, et ils répondent à deux besoins qui n'ont pas la même durée de vie.

**Copier et coller, pour la séance en cours.** Depuis n'importe quelle table : *copier les
réglages*, puis, sur une autre image, *coller*. Rien à nommer, rien à ranger. C'est le
geste des six attitudes d'un même personnage, et la colonne *Ses sœurs* est déjà à côté.

**Les recettes nommées, pour ce qui survit à la séance.** Elles existent côté serveur
depuis T2 — on peut en enregistrer une sous un nom, les lister, en appliquer une à une
image — et **aucun écran ne les a jamais appelées**. Le client sait même déjà le faire :
deux fonctions écrites, jamais employées. Il ne manque que la surface. On l'ajoute :
enregistrer la recette courante sous un nom, la liste de ce qu'on a nommé, appliquer,
oublier.

Le déterminisme est la promesse du produit et le critère qui la garde ne bouge pas : **une
recette nommée, réappliquée ailleurs, donne exactement le même résultat.**

**Ce qui ne voyage pas, et pourquoi** : une boîte de recadrage tracée à la main est un
rectangle *de cette image-là*. Elle ne veut rien dire sur une autre — un collage l'ignore
et le dit, plutôt que de cadrer au hasard.

### Critères d'acceptation

- [ ] *Copier les réglages* puis *coller* sur une autre image donnent la même recette, état
      de veille compris.
- [ ] Un collage annonce ce qu'il a posé, et ce qu'il n'a pas pu poser.
- [ ] Une boîte de recadrage tracée à la main ne voyage pas, et le collage le dit.
- [ ] On enregistre la recette courante sous un nom depuis la barre des tables.
- [ ] La liste des recettes nommées est atteignable depuis la même barre ; on en applique
      une, on en oublie une.
- [ ] Deux images traitées par la même recette nommée sortent identiques au pixel près.
- [ ] Une recette nommée survit à la fermeture de l'atelier.
- [ ] Enregistrer un nom déjà pris propose de remplacer, et ne remplace jamais en silence.

### Bloquée par

- **U4** — l'état de veille fait partie de ce qui voyage.

---

## U6 · La palette se règle sans faire attendre

**Critères : 6 · Ce que ça corrige : un point de la séance**

### Ce qu'on livre

**Mesuré sur la machine de l'auteur le 31 août 2026** : chaque relâchement du curseur
d'attraction ou de proportion coûte **2,1 secondes**, sur un paquet de trois images
seulement, et pendant ces deux secondes rien à l'écran ne dit que quelque chose se calcule.
L'aperçu qui suit en ajoute une demie. Un paquet de neuf images — il y en a un dans le
dépôt — coûterait le triple.

**La cause n'est pas la fusion des couleurs, c'est l'empreinte.** Avant de rendre la
palette, l'atelier vérifie si elle est encore d'accord avec ses sources ; pour cela il
fabrique une empreinte, et cette empreinte est faite des couleurs elles-mêmes — donc il
**relit et requantifie toutes les images du paquet**, y compris quand on n'a bougé qu'un
curseur qui ne touche pas aux sources. Le calcul qu'on refait est celui dont on voulait
justement savoir s'il fallait le refaire.

L'empreinte se fabrique désormais avec ce qui identifie les images sans les ouvrir — quelles
cartes, dans quel état — et les couleurs lues restent en mémoire tant que ces images n'ont
pas bougé. **La propriété que l'empreinte protégeait est gardée** : ajouter une carte au
paquet recalcule la palette, c'était la raison d'être de ce calcul et elle ne se perd pas.

**Et l'attente se voit.** Le produit a déjà une jauge et un seuil de 240 millisecondes
pour ne pas clignoter sur les gestes courts : c'est celle-là qu'on emploie, pas une neuve.

### Critères d'acceptation

- [ ] Bouger l'attraction ou la proportion sans toucher aux sources répond **sous 300 ms**
      sur le paquet de trois images qui en coûte 2 100 aujourd'hui.
- [ ] Ajouter, retirer ou remplacer une carte du paquet recalcule bien la palette.
- [ ] Renommer une palette ou une ambiance ne recalcule aucune couleur.
- [ ] Un calcul qui dépasse 240 ms montre la jauge du produit, et elle disparaît avec lui.
- [ ] L'aperçu de la palette sur de vraies images ne se redemande pas tant que rien
      n'a changé.
- [ ] Un banc gratuit mesure les deux temps — avant et après — et garde son relevé.

### Bloquée par

Aucune.

---

## U7 · La toile dit ce qu'elle a fabriqué

**Critères : 5 · Ce que ça corrige : un point de la séance**

### Ce qu'on livre

Les deux boutons d'un îlot — *faire une palette de ce paquet*, *faire une ambiance de ce
paquet* — **partent sans le moindre retour**. Vérifié : le serveur répond correctement et
fabrique bien la palette, couleurs lues comprises. Mais l'écran ne bouge pas d'un pixel, ne
dit rien, ne mène nulle part, et l'objet fabriqué vit dans un autre onglet. De l'endroit où
l'on clique, cela ne se distingue pas d'un bouton mort — et c'est ce que la séance a
conclu.

Trois choses, donc. Le geste **dit ce qu'il a fait** et où c'est allé, avec le chemin pour
y aller. Un second clic sur un paquet qui a déjà sa palette ne fabrique pas un doublon : il
propose d'ouvrir celle qui existe. Et **un îlot porte la marque de ce qu'il a produit** —
on voit, sur la toile, quels paquets ont une palette ou une ambiance accrochée, sans avoir
à changer d'onglet pour le savoir.

### Critères d'acceptation

- [ ] Faire une palette depuis un îlot le dit, nomme ce qui a été créé, et propose d'y aller.
- [ ] Faire une ambiance fait de même, et l'ambiance porte bien la palette du paquet.
- [ ] Un îlot dont le paquet a une palette ou une ambiance le montre sur la toile.
- [ ] Refaire le geste sur un paquet déjà servi ne crée pas de doublon et mène à l'existant.
- [ ] Un refus du serveur se lit à l'endroit où l'on a cliqué, jamais ailleurs.

### Bloquée par

Aucune.

---

## U8 · La galerie rend le prompt, et son bouton rentre dans la vignette

**Critères : 6 · Ce que ça corrige : deux points de la séance**

### Ce qu'on livre

**Le prompt d'origine se lit sur la fiche d'une image.** Il est enregistré, entier, depuis
toujours — c'est la génération qui le porte, et l'atelier sait déjà le relire puisque
*reprendre les réglages* le repose dans le champ. Il n'était simplement affiché nulle part :
la fiche ne montre que le titre, qui en est les cinquante-six premiers caractères. On y
ajoute le texte entier, replié à quelques lignes, dépliable, et copiable — sans passer par
*reprendre*, qui change d'onglet et remplit le champ, c'est-à-dire qui fait tout autre chose
que lire.

**Et le bouton de téléchargement rentre dans la vignette.** Mesuré : à la taille de repos,
la vignette fait 132,6 px, la ligne des mesures en réclame 137, et le lien *PNG ↓* dépasse
de **13,2 px** sur la droite — il sort de la tuile et se pose sur la voisine. Aux deux
autres tailles, la place suffit. La ligne est bornée par sa tuile, et à la taille de repos
le lien se réduit à sa flèche : la planche contact ne perd pas une colonne pour un bouton
secondaire.

### Critères d'acceptation

- [ ] La fiche d'une image montre le prompt qui l'a fabriquée, entier, replié par défaut.
- [ ] On le déplie, on le copie, sans quitter la fiche ni toucher au champ de génération.
- [ ] Une image entrée par import — donc sans prompt — le dit au lieu de laisser un vide.
- [ ] À la taille de repos, rien ne dépasse de la vignette : mesuré au navigateur, pas
      estimé.
- [ ] Le téléchargement reste atteignable aux trois tailles.
- [ ] La ligne des mesures ne pousse plus la tuile : c'est ce qui produisait le débordement.

### Bloquée par

Aucune.

---

## U9 · L'écran de confirmation se lit d'un coup d'œil

**Critères : 6 · Ce que ça corrige : un point de la séance**

### Ce qu'on livre

L'écran qui montre ce qui part le montre **mot pour mot, sans coupure et sans résumé** —
c'est l'invariant qu'il a été construit pour tenir, et une phrase de sa maquette dit que des
points de suspension le trahiraient. La séance a montré la limite : le prompt réellement
employé dans ce dépôt fait plus de mille deux cents caractères, et un écran qui doit se
parcourir d'un coup d'œil avant de payer ne le fait pas quand une seule ligne occupe tout.

**L'invariant est amendé, et l'amendement est écrit.** Les longs textes se replient,
partout, avec un bouton qui les déplie ; ce qui remplace la promesse est plus fort qu'elle :
*rien n'est résumé, rien n'est réécrit, et tout est atteignable en un clic depuis l'endroit
où on le lit*. Le repli est visible et son bouton dit combien de caractères il cache — ce
n'est pas une troncature muette, c'est un pli qu'on ouvre.

**Et les images jointes se voient.** L'écran qui décide de ce qui part ne montrait aucune
image : les références y étaient des lignes de texte avec un prix. Chacune porte désormais
sa vignette, et **la barre d'espace l'ouvre en grand** — le geste de l'aperçu, celui qui
existe déjà partout ailleurs dans le produit et qui n'a jamais de bouton pour l'annoncer.

### Critères d'acceptation

- [ ] Un texte long est replié à quelques lignes avec un bouton qui dit ce qu'il cache.
- [ ] Déplié, le texte est **entier**, sans coupure ni résumé, et le repli se referme.
- [ ] Chaque image jointe porte sa vignette, à côté de son prix et de son interrupteur.
- [ ] Le pointeur sur une vignette et la barre d'espace ouvrent l'image en grand ; la
      relâcher referme.
- [ ] L'aperçu passe **au-dessus** de l'écran de confirmation, comme au-dessus des autres
      écrans qui couvrent l'atelier.
- [ ] La phrase de l'invariant est réécrite **aux trois endroits où elle vit** — la carte du
      dépôt, la maquette de l'écran de confirmation, et le commentaire du code —, avec sa
      date et sa raison. Corrigée à un seul, elle deviendrait une contradiction.

### Bloquée par

Aucune. Elle touche le même écran que U1 sans en dépendre — U1 passe d'abord parce qu'elle
coûte de l'argent.

---

## U10 · Chaque passe de détourage dit ce qu'elle enlève

**Critères : 7 · Ce que ça corrige : deux points de la seconde séance**

### Ce qu'on livre

**Un interrupteur par passe.** Une recette de détourage porte plusieurs passes qui
s'enchaînent, et on ne voit que leur somme : impossible de savoir laquelle a mangé quoi.
Chaque passe reçoit un bouton *montrer / masquer* qui la retire du calcul le temps qu'on
regarde. Ce n'est pas la même chose que la retirer — c'est le même geste que la veille d'une
table (U4), un cran plus bas, et la même règle : ce qu'on éteint garde ses réglages.

**La réponse à la question posée, parce qu'elle change la lecture de tout le reste.** Une
passe supplémentaire travaille bien **sur le résultat de la précédente**, mais seulement à
moitié, et c'est cette moitié qui surprend :

- **La transparence s'accumule et ne se rend jamais.** Chaque passe ne peut que serrer ce
  que la précédente a laissé — c'est ce qui fait que les passes s'enchaînent au lieu de se
  remplacer.
- **Mais la couleur qu'une passe examine est toujours celle de l'image d'origine.** Effacer
  un pixel ne change pas sa couleur, il ne change que sa transparence. Une seconde passe à
  la pipette lit donc un fond qui, pour elle, est encore là.

**C'est très probablement la cause du défaut de la pipette sur une seconde passe.** Le geste
« zone d'un seul tenant » se propage de proche en proche à partir du point visé, à travers
tout ce qui ressemble à la couleur visée — **y compris à travers les pixels que la première
passe a effacés**, qui ont gardé leur couleur et forment un couloir continu. La tache repart
alors par ce couloir et ressort ailleurs dans l'image, sur une zone qui n'a rien à voir avec
ce qu'on désignait. Une hypothèse, pas un constat : elle se vérifie avant de se corriger, et
l'interrupteur ci-dessus est justement l'instrument qui la rend visible.

**Ce qui décidera** : soit la propagation cesse de traverser ce qui est déjà transparent —
et c'est le choix qui rend la pipette prévisible —, soit elle continue et l'écran montre
d'avance la zone qu'elle prendra. On ne tranche pas sans avoir reproduit.

### Critères d'acceptation

- [ ] Chaque passe porte un bouton qui la masque, et le rendu se refait sans elle.
- [ ] Une passe masquée garde tous ses réglages ; la rallumer rend exactement l'état d'avant.
- [ ] Masquer une passe ne la retire pas de la recette, et les deux gestes se distinguent à
      l'écran.
- [ ] Le défaut de la pipette sur une seconde passe est **reproduit et mesuré** avant qu'une
      ligne le corrige — quelle image, quel point, quelle zone est prise en trop.
- [ ] Une pipette posée sur une poche de fond ne prend plus une zone qui n'y touche pas.
- [ ] Le comportement retenu est écrit là où la question se pose : dans la table, pas
      seulement dans le code.
- [ ] Un essai tient le cas des deux passes enchaînées, celui par lequel le défaut est passé.

### Bloquée par

Aucune.

---

## U11 · La main peint carré, et là où on la pose

**Critères : 6 · Ce que ça corrige : un point de la seconde séance, en deux moitiés**

### Ce qu'on livre

**Un pinceau carré, parce qu'on peint des pixels.** La main pose aujourd'hui un **disque** à
chaque point du tracé, avec des bouts et des joints arrondis. Sur un sprite de soixante-quatre
pixels de côté, un disque de rayon deux ne produit pas un bord net : il produit un escalier
que personne n'a dessiné. Le carré est la forme de l'unité qu'on manipule, et c'est la seule
qui rende ce que la main croit poser.

**Ce que ça coûte, et il faut le dire** : la forme du pinceau fait partie de ce qui rend une
recette déterministe. Un calque déjà peint se **redessinera légèrement différemment** après
ce changement — pas beaucoup, mais pas à l'identique. C'est le prix, et il se paie une fois.

**Et le trait tombe là où le pinceau se trouve.** Le clic atterrit aujourd'hui à quelques
pixels de l'endroit visé, vers la gauche, et l'auteur a raison de soupçonner le recadrage.
Le mécanisme est le même que celui trouvé dans la table de recadrage en U2, à un endroit
différent : **la surface qui reçoit le geste et l'image qu'on voit ne sont pas le même
rectangle.** La surface est dimensionnée d'après les mesures que l'atelier garde de l'image
rendue ; l'image, elle, est posée dedans en *tenant dans le cadre*, donc centrée avec des
bandes vides de chaque côté dès que les deux proportions diffèrent d'un cheveu. Le calcul
qui transforme un clic en pixel d'image mesure alors la surface, pas l'image, et se décale
de la largeur de la bande. Un recadrage change précisément les proportions du rendu : c'est
lui qui ouvre l'écart.

Le dépôt a déjà appris cette leçon une fois, sur l'écran de découpe — *le cadre **est**
l'image, mis à l'échelle par calcul ; une boîte qui ment décale ce qu'on pose dessus.* On
l'applique ici, et U2 l'applique au rectangle de recadrage : les trois surfaces qui reçoivent
un geste liront leurs coordonnées dans le rectangle de l'image réellement affichée.

### Critères d'acceptation

- [ ] Le pinceau couvre un carré de côté impair, centré sur le pixel visé ; le tracé entre
      deux points a des bouts et des joints carrés.
- [ ] Le curseur à l'écran est le carré exact que le prochain passage couvrira.
- [ ] L'écart est **mesuré avant correction** — combien de pixels, sur quelle image, avec
      quel recadrage —, puis mesuré après, et il vaut zéro.
- [ ] Un clic au bord de l'image marque un pixel du bord, et non le voisin.
- [ ] Le trait tombe juste à tous les niveaux de zoom, y compris ceux que U2 ouvre sous
      cent pour cent.
- [ ] Le changement de forme du pinceau est écrit où la promesse de déterminisme est écrite :
      une recette d'avant ne rend plus tout à fait la même image, et ça se dit.

### Bloquée par

Aucune, mais **à faire avec U2 ou juste après** : les deux réparent la même erreur — une
surface qui ment sur l'image qu'elle porte — à deux endroits, et les corriger séparément
ferait écrire deux fois le même calcul.

---

## U12 · La sélection magique — tracer gros, ajuster au bord

**Critères : 6 · Ce que ça ajoute : un point de la seconde séance**

### Ce qu'on livre

Un troisième outil dans la table de la main, à côté de la zone et de la retouche : **on
entoure grossièrement ce qu'on veut garder, et l'atelier va chercher le bord du sujet
lui-même** à l'intérieur de ce qu'on a entouré. Le geste des logiciels d'image, et il
répond à ce que ni le détourage automatique ni la retouche au pixel ne savent faire : le
premier décide tout seul et se trompe parfois, la seconde demande de suivre un contour au
pixel près, ce qui est long sur une silhouette entière.

**Ce qui le rend possible ici sans rien inventer** : l'atelier sait déjà remplir une zone de
proche en proche à partir d'un point, et il sait déjà durcir puis ronger un bord — ce sont
les deux mécanismes du détourage par la couleur et du réglage de durcissement. La sélection
magique les emploie dans l'autre sens : la zone tracée borne la recherche au lieu de la
lancer, et ce qui sort est un masque qu'on peut encore retoucher à la main.

**Ce qui reste à trancher, et qui se tranchera en la construisant** : le résultat est-il un
huitième réglage de la recette, ou une passe de détourage d'un genre nouveau ? La seconde
réponse est la plus probable — c'est un détourage, il en a la place dans l'ordre — mais elle
demande qu'une passe puisse porter une forme dessinée, ce qu'aucune ne fait aujourd'hui.

### Critères d'acceptation

- [ ] On trace une forme grossière autour du sujet, à main levée, et elle se voit pendant
      qu'on la trace.
- [ ] L'atelier ramène le contour sur le bord du sujet **à l'intérieur** de la forme tracée,
      et ne touche à rien au-dehors.
- [ ] Le résultat se retouche ensuite à la main, sans avoir à recommencer.
- [ ] Le geste se défait d'un seul coup, comme un passage de la main.
- [ ] Deux images traitées par la même recette donnent le même masque : rien n'est tiré au
      sort.
- [ ] Sa place dans l'ordre du traitement est écrite et justifiée, quel que soit le choix
      retenu.

### Bloquée par

- **U11** — elle se pose sur la même surface que la main, et cette surface doit d'abord dire
  la vérité sur l'endroit qu'on touche.

---

## U13 · Un second moteur de détourage, plus lourd et meilleur

**Critères : 6 · Ce que ça ajoute : un point de la seconde séance**

### Ce qu'on livre

Le détourage par modèle n'en connaît **qu'un seul, écrit en dur** : `u2net`. C'est un nom de
modèle inscrit dans le code, là où la règle du dépôt dit *le catalogue décide, jamais une
liste en dur* — la règle valait pour les modèles d'image, elle vaut ici pour la même raison.

On en ajoute un second, **plus lourd et meilleur, et qui n'est pas le défaut**. Le choix se
fait passe par passe, comme le moteur se choisit déjà entre le bord, la pipette et le modèle.
Le plus rapide reste ce qu'on obtient sans rien demander ; le plus lourd est là quand la
silhouette est difficile — des cheveux, une frange, un objet ajouré — et il annonce qu'il
sera plus lent avant de partir.

**Ce qui rend le choix sûr plutôt que théorique** : le projet voisin `../MySpriteAi` détoure
déjà avec **BiRefNet**, et c'est du savoir payé au prix fort dans cette maison. C'est donc le
premier candidat, et non une découverte à faire. La bibliothèque employée ici en propose
plusieurs sous le même appel : ajouter un moteur ne demande pas une seconde mécanique, il
demande de cesser d'en nommer un seul.

**Ce qui doit être mesuré avant de le déclarer meilleur** : le temps de chaque moteur sur une
image du dépôt, et ce qu'ils rendent côte à côte sur trois silhouettes difficiles. « Plus
puissant » est une promesse tant que ce n'est pas un relevé — et le dépôt a déjà des bancs
gratuits pour ça.

**Et un moteur qui n'est pas installé se grise avec sa raison**, comme celui d'aujourd'hui :
le produit interdit de proposer puis de refuser, et le second moteur pèse assez lourd pour
qu'on ne l'impose à personne.

### Critères d'acceptation

- [ ] Le moteur d'une passe se choisit dans une liste qui n'est plus écrite en dur.
- [ ] Le moteur rapide reste celui qu'on obtient sans rien demander.
- [ ] Le moteur lourd annonce qu'il est plus lent **avant** de partir, pas pendant.
- [ ] Un moteur absent de la machine est grisé avec sa raison et le geste pour l'installer.
- [ ] Un banc gratuit mesure les deux moteurs sur les images déjà là — durée, et ce qu'ils
      rendent — et garde son relevé.
- [ ] Une recette qui nomme un moteur absent le dit sans casser le rendu des autres passes.

### Bloquée par

Aucune.

---

## Ce que ce lot ne couvre pas

**Cinq de ces treize étapes ajoutent une capacité au produit**, et pas seulement une
réparation : la veille d'une table (U4), les réglages qui voyagent (U5), le prompt qu'on
relit sur une image (U8), la sélection magique (U12) et le second moteur de détourage (U13).
Ce que le produit doit faire est tranché dans `docs/PRD.md`, et ces cinq-là n'y sont pas
encore écrites — elles n'ont donc pas de numéro de user story. **À passer par `/cadre` avant
de les construire**, sans quoi le plan citerait des renvois qui n'existent pas.

Les huit autres corrigent un écran déjà cadré : elles ne demandent rien au produit qu'il
n'ait déjà promis. **Deux cas limites, et ils sont notés là où ils se paieront** : le
pinceau carré de U11 change le rendu de calques déjà peints, et l'interrupteur de passe de
U10 est la veille de U4 appliquée un cran plus bas — si l'une des deux change de forme,
l'autre doit suivre.
