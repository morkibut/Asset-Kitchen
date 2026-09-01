# Les questions du lot U — ce que j'ai tranché seul, et que tu peux défaire

*Écrit le 1<sup>er</sup> septembre 2026, à la fin des treize reprises d'usage `U1` à `U13`.*

## À quoi sert ce document

Construire les treize étapes a demandé de **choisir**, une dizaine de fois, entre deux
comportements possibles. Aucun de ces choix n'était écrit d'avance : les critères disaient
*quoi* livrer, pas toujours *comment se comporter dans ce cas précis*. J'ai tranché pour
avancer, en suivant les règles que le produit s'est déjà données — et chaque fois, l'autre
possibilité tenait debout.

**Ce document les met sur la table.** Il n'y a rien à réparer ici : tout marche, tout est
mesuré, tout est en essais. Ce sont des questions de goût et d'usage, et c'est toi qui les
tranches — moi, je ne peux qu'annoncer ce que j'ai fait.

**Il est écrit pour être lu sans rien savoir du code.** Chaque question tient en quatre
morceaux :

- **Ce qui se passe aujourd'hui** — ce que tu verras si tu ouvres l'atelier maintenant ;
- **L'autre choix possible** — ce qu'on aurait pu faire à la place ;
- **Ce que ça changerait** — pour toi, en usage, pas dans le code ;
- **Pourquoi j'ai tranché comme ça** — l'argument, en une phrase.

Répondre est facile : dis-moi le numéro et ce que tu veux. Ne pas répondre est une réponse
aussi — ce qui est là reste.

---

## Un mot de vocabulaire, une fois pour toutes

Trois mots reviennent partout dans ce document. Ils désignent des choses de l'atelier, pas
des notions d'informatique.

**Une recette** — la liste de ce qu'on a fait à une image : retirer le fond, la recadrer, la
ramener sur la grille du jeu, réduire ses couleurs, nettoyer ses miettes, retracer son
contour, retoucher à la main. Sept **places**, toujours dans le même ordre. L'image d'origine
n'est jamais abîmée : on garde la photo de départ et la liste des gestes, et le résultat se
recalcule.

**Une passe de détourage** — le fond ne part pas toujours d'un coup. On peut empiler
plusieurs tentatives, chacune avec ses réglages : une large qui dégrossit, une plus fine qui
nettoie ce qui reste. Chacune de ces tentatives est une *passe*.

**Endormir une place** — depuis `U4`, chaque place a un interrupteur : elle garde tous ses
réglages et cesse d'agir, le temps qu'on regarde l'image sans elle. Ce n'est pas la vider.

---

## 1 · Éteindre le retrait du fond change aussi la taille de l'image

**Ce qui se passe aujourd'hui.** Quand tu éteins le retrait du fond, l'image redevient
entière — et elle change *aussi* de taille, parce que la mise sur la grille du jeu cesse de
la loger dans une case carrée. Deux choses bougent d'un seul interrupteur.

**L'autre choix possible.** Garder la case carrée pendant que le fond est éteint, pour que
seule une chose change à la fois.

**Ce que ça changerait.** Aujourd'hui, éteindre le fond fait un peu sursauter l'image : elle
change de fond *et* de dimensions. L'autre choix la garderait calme, au prix d'une règle à
retenir : « une place éteinte laisse quand même une trace ».

**Pourquoi j'ai tranché comme ça.** Le critère de l'étape dit *endormie veut dire sans effet,
pas presque sans effet*. Une place à qui l'on doit se demander ce qu'elle laisse traîner
n'est plus un interrupteur, c'est une nuance de plus à tenir en tête.

---

## 2 · Une place vide ne s'éteint pas

**Ce qui se passe aujourd'hui.** L'interrupteur n'apparaît que sur les places où il y a
quelque chose. Une place vide — un recadrage jamais réglé, par exemple — n'a pas
d'interrupteur : il n'y aurait rien à éteindre.

**L'autre choix possible.** Rendre toutes les places cliquables, même vides, pour pouvoir
préparer un état à l'avance.

**Ce que ça changerait.** Peu de chose au quotidien. C'est une question de cohérence : soit
l'interrupteur veut dire « cette place agit ou non », soit il veut dire « je m'autorise cette
place ou non ».

**Pourquoi j'ai tranché comme ça.** Un bouton qui ne fait rien est un bouton qu'on essaie une
fois, puis qu'on cesse de voir.

---

## 3 · Une recette rangée sous un nom emporte ses interrupteurs

**Ce qui se passe aujourd'hui.** Si tu ranges une recette sous un nom alors que sa réduction
de couleurs est éteinte, la rappeler plus tard la ramène **éteinte**. Les interrupteurs font
partie de la recette.

**L'autre choix possible.** Qu'une recette rappelée arrive toujours tout allumée — l'idée
étant qu'un interrupteur est un geste de regard, pas un réglage.

**Ce que ça changerait.** Aujourd'hui, une recette rangée est exactement l'état que tu avais
à l'écran, y compris ce que tu avais éteint pour regarder. L'autre choix ferait des
interrupteurs quelque chose de purement momentané, qui ne se range jamais.

**Pourquoi j'ai tranché comme ça.** C'est ce que le critère de l'étape demandait, mot pour
mot. Mais l'autre lecture est défendable, et c'est pour ça que la question est ici.

---

## 4 · Ce qu'on copie ne survit pas au rechargement de la page

**Ce qui se passe aujourd'hui.** *Copier les réglages* d'une image pour les coller sur une
autre marche tant que la fenêtre reste ouverte. Si tu recharges la page, le presse-papiers est
vide.

**L'autre choix possible.** Le garder sur le disque, comme une recette rangée sans nom.

**Ce que ça changerait.** Rien pour un aller-retour entre deux images, tout pour une reprise
le lendemain. Mais l'atelier a déjà une réponse à « le lendemain » : les recettes nommées,
qui se rangent exprès pour ça.

**Pourquoi j'ai tranché comme ça.** Deux mécaniques pour la même chose finissent par se
contredire. Le copier-coller est pour la séance ; le nom est pour la durée.

---

## 5 · Le grand aperçu d'une palette est lent sur des images non rangées

**Ce qui se passe aujourd'hui.** Fabriquer une palette de couleurs à partir de trois images
répond en un vingtième de seconde quand ce sont des sprites déjà rangés. Sur des images
brutes de mille pixels de côté, le même geste met **presque trois secondes**.

**L'autre choix possible.** Faire lire ces images-là en réduit, comme la galerie le fait déjà
pour ses vignettes.

**Ce que ça changerait.** Ça effacerait la seule attente qui reste sur cet écran. Ce n'était
pas dans l'étape, donc je n'y ai pas touché — l'étape parlait d'autre chose, et l'élargir sans
le dire aurait été une décision prise à ta place.

**Pourquoi j'ai tranché comme ça.** Ce n'est pas un arbitrage, c'est un travail qui n'a pas
été demandé. La question est : est-ce que ça vaut une petite étape à part ?

---

## 6 · Une île de la toile ne montre qu'une seule chose fabriquée

**Ce qui se passe aujourd'hui.** Sur la toile d'inspiration, une île qui a servi à fabriquer
*à la fois* une palette de couleurs et une ambiance n'affiche que l'ambiance sur son bandeau.

**L'autre choix possible.** Montrer les deux, ou alterner.

**Ce que ça changerait.** Une île qui a servi deux fois le dit à moitié. Le menu de l'île,
lui, propose bien les deux portes — on ne perd donc pas l'accès, seulement l'annonce.

**Pourquoi j'ai tranché comme ça.** Le bandeau d'une île est une ligne courte, posée sur des
images ; deux marques y auraient tenu à l'étroit. L'ambiance passe devant parce que c'est la
chose la plus grande des deux : une ambiance porte une palette, l'inverse n'est pas vrai.

---

## 7 · La promesse de l'écran de confirmation a été réécrite

**Ce qui se passe aujourd'hui.** L'écran qui montre ce qui part avant de payer promettait de
tout montrer *sans coupure et sans résumé*. Le texte réellement employé dans ce dépôt fait
plus de mille deux cents caractères : une seule ligne occupait l'écran entier, et un écran
qu'on doit parcourir d'un coup d'œil avant de payer ne se parcourait plus. **Les longs textes
se replient maintenant**, avec un bouton qui dit combien de caractères le pli cache et qui les
rouvre entiers.

La promesse est donc devenue : *rien n'est résumé, rien n'est réécrit, et tout est atteignable
en un clic depuis l'endroit où on le lit.*

**L'autre choix possible.** Tenir la promesse d'origine et laisser l'écran s'allonger.

**Ce que ça changerait.** C'est la seule fois de ce lot où j'ai touché à une règle et non à un
écran. Elle est réécrite aux trois endroits où elle vivait — la carte du dépôt, la maquette,
et le commentaire du code —, avec sa date et sa raison : corrigée à un seul, elle serait
devenue une contradiction que rien n'aurait signalée.

**Pourquoi j'ai tranché comme ça.** La promesse d'origine n'était pas fausse ; elle était
vraie pour un texte de cent caractères et devenue impraticable pour un texte de mille deux
cents. Le repli s'annonce et se rouvre : ce n'est pas une troncature, c'est un pli.

*Si tu préfères l'ancienne règle, c'est le seul endroit du lot où revenir en arrière demande
de rouvrir trois documents plutôt qu'un.*

---

## 8 · Le pli des longs textes se déclenche à trois cent vingt caractères

**Ce qui se passe aujourd'hui.** Un texte de plus de trois cent vingt caractères — environ
cinq lignes — se replie. En dessous, il s'affiche entier.

**L'autre choix possible.** N'importe quel autre seuil. C'est un chiffre que j'ai posé, pas
un chiffre que j'ai mesuré.

**Ce que ça changerait.** Plus bas, tu déplies plus souvent ; plus haut, l'écran se remplit
davantage. Ça se règle en changeant un seul nombre.

**Pourquoi j'ai tranché comme ça.** Cinq lignes suffisent à reconnaître un texte qu'on a
écrit, et c'est ce que le pli doit permettre : reconnaître sans déplier.

---

## 9 · Masquer une passe et toucher un de ses réglages la remontre

**Ce qui se passe aujourd'hui.** Chaque passe de retrait du fond a un bouton *masquer*, qui
la retire du calcul le temps qu'on regarde. Si tu touches ensuite un de ses réglages, elle se
remontre toute seule.

**L'autre choix possible.** Laisser le réglage bouger sans rien rallumer — l'auteur décide
seul quand la passe revient.

**Ce que ça changerait.** Aujourd'hui, on ne peut pas régler une passe masquée « à l'aveugle »
pour la rallumer ensuite d'un coup. En échange, on ne peut pas non plus tourner un bouton
pendant dix secondes en se demandant pourquoi l'image ne bouge pas.

**Pourquoi j'ai tranché comme ça.** C'est la règle déjà retenue un cran plus haut pour les
tables endormies : *toucher un réglage dit qu'on veut cette place*. Refuser aurait obligé à
faire un geste préalable pour avoir le droit de faire le geste qu'on voulait.

**Une différence, en revanche.** Une table qui se rallume l'annonce dans un bandeau ; une
passe, non. La raison : l'interrupteur d'une table vit dans une barre, loin de la colonne où
l'on règle — le rallumage se produisait hors du regard. Le bouton d'une passe est à vingt
pixels du curseur qu'on touche, et le bloc entier cesse d'être grisé sous les doigts. Le dire
une seconde fois serait dire ce qu'on voit. *Si tu trouves que ça manque, c'est une ligne à
ajouter.*

---

## 10 · La pipette s'arrête maintenant à ce qui reste de l'image

**Ce qui se passe aujourd'hui.** La pipette — celle qui retire une poche de fond que tu
désignes du doigt — ne traverse plus ce qu'une passe précédente a déjà effacé.

C'est la réparation d'un vrai défaut, reproduit et chiffré avant d'être corrigé : effacer un
pixel ne change pas sa couleur, seulement sa transparence. La tache repartait donc à travers
un fond invisible mais toujours coloré, et ressortait ailleurs dans l'image, sur une zone qui
à l'écran ne touchait même pas le point désigné — entre les deux, il n'y avait que du damier.
Mesuré sur une image d'essai : **cent vingt pixels pris en trop**.

**L'autre choix possible.** Laisser la propagation passer, et montrer d'avance la zone qu'elle
va prendre.

**Ce que ça changerait.** Le second choix rendait la surprise *lisible* ; celui-ci rend le
geste *prévisible*. Le second aurait aussi demandé un aperçu qui se recalcule à chaque
mouvement de souris.

**Pourquoi j'ai tranché comme ça.** Un outil qu'on comprend vaut mieux qu'un outil qui
s'explique.

---

## 11 · Ce qu'on entoure à main levée ne touche à rien au-dehors

**Ce qui se passe aujourd'hui.** La sélection magique — entourer grossièrement le sujet, et
laisser l'atelier trouver son bord à l'intérieur — ne modifie **que** ce qui est dans la forme
tracée. Le reste de l'image est intact.

**L'autre choix possible.** Qu'entourer un sujet efface *tout* le reste, comme dans un
logiciel de photo où le lasso garde ce qu'il enferme.

**Ce que ça changerait.** Aujourd'hui, entourer une seule fois ne suffit pas à détourer une
image entière : c'est un geste qu'on cumule — un bras, puis l'autre — et qui se combine avec
les autres façons de retirer le fond. L'autre choix aurait fait de la sélection un geste
total, plus expéditif et beaucoup plus risqué.

**Pourquoi j'ai tranché comme ça.** C'est ce que le critère demandait, et c'est ce qui la rend
cumulable au lieu de concurrente. Mais si tu attendais le geste des logiciels de photo, c'est
ici qu'il faut le dire.

---

## 12 · Un clic sans tracé ne pose rien

**Ce qui se passe aujourd'hui.** Si tu cliques sans faire glisser, rien n'est enregistré :
moins de trois points n'entourent rien.

**L'autre choix possible.** Traiter le clic isolé comme un geste raté et le dire.

**Ce que ça changerait.** Presque rien. C'est un cas limite, noté ici parce qu'un silence est
une décision comme une autre.

**Pourquoi j'ai tranché comme ça.** Un clic isolé n'est pas un geste raté : c'est un geste
qu'on n'a pas fait.

---

## 13 · Le catalogue des modèles de découpe compte trois entrées

**Ce qui se passe aujourd'hui.** Le retrait du fond « par modèle » — celui qui sert aux images
qui ne viennent pas d'ici et n'ont pas de fond uni — ne connaissait qu'un seul modèle, écrit
dans le code. Il y en a maintenant trois, du plus rapide au plus lourd, et le choix se fait
passe par passe.

Le relevé du banc gratuit, sur quatre images du dépôt : le **rapide** met neuf dixièmes de
seconde par image ; l'**intermédiaire** met un cinquième de temps en plus pour un résultat
presque identique — ils s'accordent à 96 % ou plus. Le **lourd** pèse neuf cent vingt-huit
mégaoctets, vise les silhouettes difficiles — des cheveux, une frange, un objet ajouré — et
n'est pas encore descendu sur cette machine.

**L'autre choix possible.** En proposer moins (deux suffisaient au critère), ou davantage : la
bibliothèque employée en connaît une vingtaine.

**Ce que ça changerait.** Une liste plus longue serait plus complète et moins lisible. Trois
entrées tiennent sur une ligne et se nomment en un mot chacune.

**Pourquoi j'ai tranché comme ça.** L'intermédiaire est déjà sur ta machine : il donne au banc
quelque chose à comparer sans rien télécharger, ce qui rend la mesure possible aujourd'hui
plutôt qu'après un gigaoctet d'attente.

---

## 14 · L'annonce du téléchargement reste tant que le modèle n'est pas là

**Ce qui se passe aujourd'hui.** Choisir un modèle qui n'est pas encore sur la machine affiche
une ligne : *la première fois, l'atelier descendra ce modèle — 928 Mo*. Elle reste affichée
tant que ce modèle est choisi et absent, et disparaît dès qu'il est là.

**L'autre choix possible.** L'afficher une seule fois et ne plus jamais la remontrer, même si
le modèle n'est toujours pas descendu.

**Ce que ça changerait.** Le critère disait « une seule fois ». Je l'ai lu comme *une ligne, et
non une alerte qui revient à chaque calcul* — pas comme *une seule fois dans la vie de
l'atelier*. Une annonce qui disparaîtrait avant que la chose annoncée arrive laisserait
attendre plusieurs minutes sans explication.

**Pourquoi j'ai tranché comme ça.** Une information qui décrit un état doit vivre aussi
longtemps que l'état.

---

## 15 · Un modèle absent ne fait pas tomber le reste de la recette

**Ce qui se passe aujourd'hui.** Si une recette nomme un modèle que la machine n'a pas, cette
passe-là n'agit pas, les six autres places s'appliquent, et l'image sort.

**L'autre choix possible.** Refuser la recette entière et le dire.

**Ce que ça changerait.** Aujourd'hui, une recette venue d'ailleurs donne toujours une image —
un peu moins détourée. L'autre choix donnerait une erreur franche et rien à regarder.

**Pourquoi j'ai tranché comme ça.** Une recette voyage. Elle peut nommer un modèle qu'une
autre machine n'a pas, et l'image doit alors sortir avec ce qui reste plutôt que pas du tout.
C'est la même règle qu'une passe masquée : ce qui n'agit pas n'empêche pas le reste d'agir.

---

## Ce qui n'est pas une question

Trois choses ont l'air de choix et n'en sont pas — elles sont mesurées, et la mesure a
décidé :

- **La taille du pli des vignettes jointes** (trente-quatre pixels de côté) suit la hauteur de
  la ligne où elle se pose ; toute autre valeur la ferait déborder.
- **Le point de coupure des dimensions sur une vignette de galerie** a été mesuré au
  navigateur : la ligne dispose de cent vingt pixels et en réclamait cent vingt-quatre. Le
  point de séparation en vaut treize à lui seul — c'est lui qui cède, et tout tient.
- **La forme du pinceau de la main** est carrée parce qu'on peint des pixels, et un disque
  produisait un escalier que personne n'avait dessiné.

---

## Comment répondre

Dis-moi les numéros et ce que tu veux, en une ligne chacun. Par exemple : « 3 : allumées », ou
« 13 : deux suffisent ». Ce qui n'est pas nommé reste comme c'est.
