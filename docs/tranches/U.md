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
sont nés d'un usage, comme le reste ; ils demandaient un passage par le document du produit
avant d'être construits, comme les trois autres capacités du lot — **fait le
1<sup>er</sup> septembre 2026**, voir la dernière section.

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

**Critères : 6 · Ce que ça corrige : deux points de la séance · *tenue le
1<sup>er</sup> septembre 2026***

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

- [x] Cinq clics consécutifs sur *Payer et lancer* ne produisent **qu'un seul appel payé**,
      et le journal des dépenses n'en compte qu'un.
- [x] Pendant l'appel, le bouton dit qu'il paie et n'est plus cliquable ; il ne redevient
      cliquable que si l'appel échoue.
- [x] Modifier le texte, le tri ou le modèle pendant que l'écran est ouvert refait
      l'identifiant : deux appels réellement différents restent deux appels.
- [x] Le raccourci qui paie sans passer par l'écran — celui d'une série où l'on a coché
      *sauter* — porte le même verrou.
- [x] Cliquer *Galerie*, *Univers* ou *Codex* depuis l'écran de confirmation le ferme et
      montre l'onglet demandé, sans rien dépenser.
- [x] Un essai d'écran envoie deux clics dans la même image de rendu et vérifie qu'un seul
      appel part.

### Bloquée par

Aucune — démarrable immédiatement, et c'est la première parce que c'est la seule qui coûte
de l'argent réel.

### Ce qu'elle a appris en étant faite

**Il fallait deux verrous, pas un.** Le drapeau d'état qui grise le bouton ne suffit pas :
il n'est vrai qu'au **rendu suivant**, et deux clics partis dans la même image de rendu
traversent tous les deux le gestionnaire avant que quoi que ce soit ait été redessiné. Un
second verrou, lu et écrit dans le même tour de boucle, arrête le second clic ; c'est lui
que mesure l'essai qui pose deux clics sans rendu entre eux. Le grisé, lui, sert à autre
chose et il est indispensable aussi : il **dit** que ça paie.

**L'identifiant doit se refaire à deux moments, et le second n'était pas prévu.** Quand ce
qui part change, l'étape l'annonçait. Mais aussi **quand un appel est réellement parti** :
le réemployer ferait rendre *déjà soumise* par le serveur, c'est-à-dire qu'une seconde image
volontairement identique — le geste courant, quand on cherche une variante — serait avalée
en silence. Un verrou qui ne se rend jamais est un verrou qui ferme la porte de l'intérieur.
L'identifiant se refait donc quand l'intention change *et* quand elle est consommée ; il ne
se refait pas quand l'appel échoue, puisque rien n'a été enregistré et que réessayer est la
même intention.

**Un échec d'appel n'est pas une panne de l'atelier, et les deux vivaient dans le même
état.** C'est ce qui a rendu le deuxième critère faux au premier essai : une génération
refusée grisait le bouton qui paie jusqu'à ce qu'un autre geste relise le catalogue, si bien
que le seul moment où l'on veut recliquer était précisément celui où l'on ne pouvait plus.
Les deux sont désormais distincts, et ils ne disent pas la même chose — une **panne** dit
*l'atelier ne répond pas* et empêche de partir, un **échec** dit *cet appel-là n'est pas
passé, rien n'a été facturé* et invite à recommencer. L'échec est un locataire de plus dans
la fente sous le champ, et il passe avant le revers hors ligne : c'est la dernière chose qui
s'est produite, donc celle qui décide du geste suivant.

---

## U2 · Le zoom de l'atelier, et le recadrage qui en dépendait

**Critères : 9 · Ce que ça corrige : trois points de la séance · *tenue le
1<sup>er</sup> septembre 2026***

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

- [x] Une image de 1 024 px s'ouvre **entière** dans le cadre de la table, sur tous les
      onglets où une table peut s'ouvrir.
- [x] Le pour cent s'écrit à la main entre 1 et 250 ; hors bornes, il est ramené sans
      refuser.
- [x] *Plus*, *moins* et *100 %* sont trois commandes distinctes, et 100 % rend exactement
      un pixel d'image pour un pixel d'écran.
- [x] La molette approche et recule dans le cadre, et **ne fait plus défiler la page**.
- [x] Le point sous le pointeur reste sous le pointeur quand on approche à la molette.
- [x] La table de recadrage porte les deux valeurs de sa maquette, les coordonnées écrites
      avec leur provenance, et la part jetée en pour cent.
- [x] Le rectangle tracé **et** le rectangle obtenu après marge sont visibles ensemble ; ce
      que le rendu montre est ce que le second entoure.
- [x] Tracer un rectangle sur une image affichée à 37 % désigne les mêmes pixels qu'à 100 %.
- [x] Un bouton télécharge le PNG de l'état courant depuis chaque table, en rendu comme en
      brut, et le fichier reçu est celui qu'on voyait.

### Bloquée par

Aucune. Mais **rien d'autre ne se juge tant qu'elle n'est pas là** : les six étapes qui
suivent se vérifient sur des images qu'il faut pouvoir regarder en entier.

### Ce qu'elle a appris en étant faite

**Vérifié sur la machine, sur l'image de la séance.** Une image d'origine de 1 024 px dans un
cadre de 825 × 758 s'ouvre à **77 %**, soit 640 × 698 pixels d'écran — entière, avec de l'air
autour. C'est le même écran qui n'en montrait qu'un coin la veille.

**L'ancre du zoom se pose en deux temps, et il n'y a pas de raccourci.** Garder sous le
pointeur le point qu'on vise demande de connaître la mise en page *après* le changement de
taille — les marges automatiques qui centrent une image plus petite que son cadre, la garde
de 24 px du cadre. On note donc où l'on était **dans l'image** au moment du geste, et on
rattrape le défilement une fois la nouvelle taille posée. Prédire la mise en page aurait
marché la plupart du temps, et une prédiction fausse se voit comme un sursaut.

**La molette demande un écouteur posé à la main.** React pose les siens en *passif* sur la
racine du document : `preventDefault` y est ignoré, et la page défilerait derrière le zoom.
C'est un piège de plateforme et non un choix, et il vaut d'être écrit — le prochain écran qui
voudra la molette le paiera sinon une seconde fois.

**Le rectangle obtenu est mesuré par le serveur, jamais recalculé à l'écran.** L'étape
demandait de montrer *le rectangle tracé et le rectangle obtenu ensemble* ; le second est le
premier élargi de la marge **et rogné sur les bords de l'image**, ce qui est exactement ce que
le traitement fait. Un second calcul écrit à l'écran aurait divergé au premier arrondi — et
l'écart entre ce qu'on dessine et ce que le rendu garde est précisément ce que l'étape existe
pour montrer. Cinq lectures sont donc descendues du serveur : la boîte du sujet, le rectangle
obtenu, la part jetée, les bords que le sujet touche, et ce qu'une boîte tracée coupe.

**Le résumé du recadrage dans la barre des tables disait toujours la marge**, y compris
quand elle valait zéro à côté d'un rectangle qui, lui, coupait. Il n'était faux que depuis
qu'un écran sait tracer — c'est-à-dire depuis cette étape —, et c'est le genre de défaut qui
naît d'une place qui gagne un second réglage sans que son résumé le sache.

---

## U3 · Un curseur prend un chiffre

**Critères : 5 · Ce que ça corrige : un point de la séance · *tenue le
1<sup>er</sup> septembre 2026***

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

- [x] Chaque réglage à curseur porte un champ où sa valeur s'écrit, et les deux disent
      toujours la même chose.
- [x] Taper un chiffre pendant qu'on tient le curseur remplit le champ sans qu'il ait été
      cliqué.
- [x] Entrée valide, Échap rend la valeur d'avant, quitter le champ vaut Entrée.
- [x] Une valeur hors bornes est ramenée dans les bornes et le dit, elle n'est pas refusée
      en silence.
- [x] Un chiffre écrit produit **un seul** envoi au serveur, comme un relâchement.

### Bloquée par

Aucune.

### Ce qu'elle a appris en étant faite

**Le champ n'a pas de valeur à lui, et c'est ce qui tient le critère.** « Les deux disent
toujours la même chose » se garantit en n'ayant qu'une seule vérité : le champ montre la
valeur du curseur, et il ne prend une valeur propre que **pendant la frappe**, qui est un
état de passage. Un second état tenu d'accord avec le premier aurait fini par diverger, et
c'est le genre d'écart qu'on ne voit qu'après avoir réglé quelque chose de travers.

**Le nom du réglage descend jusqu'au contrôle, il ne se réécrit pas dix-sept fois.** Un
champ de nombre a besoin d'un nom pour être trouvable — cinq champs de quarante-six pixels
dans une colonne se ressemblent tous —, et ce nom est déjà écrit à gauche du contrôle, dans
la rangée qui le porte. Le faire redire à chaque emploi aurait fabriqué dix-sept occasions
de le laisser diverger du libellé visible. **Il y a deux rangées de réglage dans le
produit** — celle des tables et celle de la fiche —, et les deux le fournissent ; c'est
d'ailleurs le seul endroit où l'étape a touché à autre chose qu'au composant.

**Le champ est invisible au repos, et c'est délibéré.** Bordure transparente, fond
transparent : il a l'aspect exact de la valeur en mono qu'il remplace, et il ne se révèle
qu'au survol et au focus. L'étape ne devait rien ajouter à l'écran — elle devait rendre
saisissable ce qui s'affichait déjà.

---

## U4 · Une table s'éteint, et ça se voit

**Critères : 7 · Ce que ça corrige : un point de la séance · *tenue le
1<sup>er</sup> septembre 2026***

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

- [x] Cliquer le carré d'une place l'éteint ; recliquer la rallume, et les réglages sont
      ceux d'avant.
- [x] Une place éteinte ne change plus l'image, et son carré se distingue d'un carré creux
      — *éteinte* et *vide* sont deux états, pas un.
- [x] Ouvrir une table éteinte montre une colonne visiblement éteinte, avec le geste pour
      la rallumer.
- [x] Toucher un réglage d'une table éteinte la rallume **et l'annonce**.
- [x] Deux images traitées par la même recette, l'une avec une place en veille et l'autre
      sans cette place du tout, sortent identiques au pixel près.
- [x] L'empreinte de la recette change quand une place s'endort : le rendu se refait.
- [x] L'agent lit et pose l'état de veille comme n'importe quel autre réglage de recette.

### Bloquée par

Aucune. **À faire avant U5** : une recette qui voyage doit emporter l'état de veille,
sinon un collage rallumerait des places que l'on avait éteintes.

### Ce qu'elle a appris en étant faite

**La promesse « endormie veut dire sans effet » est facile à écrire et facile à trahir**, et
elle a été trahie deux fois en une heure. Les deux fuites viennent du même endroit : un
chemin du dépôt qui lit les réglages d'une place **sans lui demander si elle dort**.

- *Le cache du détourage.* Il se reconstruisait une recette neuve — `Recette(passes=…)` —
  pour n'en garder que les passes, et la veille n'y montait pas. Le détourage endormi
  continuait donc de s'appliquer, et pas seulement à l'image : ce cache est le seul endroit
  du dépôt qui détoure, et tout ce qui en descend en héritait, y compris la boîte du sujet
  que la table de recadrage affiche depuis U2 et la couleur que lit la pipette. La
  correction n'est pas de porter la veille jusque-là mais de **vider les passes** : la clé
  du cache ne pèse que les passes, donc porter un drapeau à côté aurait fait partager une
  entrée à deux états très différents. Un détourage endormi *est* un détourage sans passe.
- *La grille.* C'est la seule place du traitement qui en regarde une autre — elle demande
  au détourage si l'image est un sprite, pour décider de la poser dans une case carrée. Elle
  lisait « le détourage est écrit », et il fallait lire « le détourage agit ».

**Il y avait une tentation, et on ne l'a pas suivie.** Garder la case pendant qu'on éteint
le détourage aurait évité que l'image change de taille en même temps qu'elle change de fond
— ce qui est plus agréable à regarder. Mais une place dont il faut se demander ce qu'elle
laisse traîner n'est pas un interrupteur : c'est une nuance de plus à tenir en tête, et
c'est très exactement ce que l'étape existe pour supprimer.

**Le carré ne se clique que là où il y a quelque chose à éteindre.** Endormir une place vide
n'aurait rien changé à l'image tout en écrivant un mot dans la recette — un interrupteur qui
ne commande rien. Sur une place vide, le carré reste ce qu'il a toujours été : une marque.

**Deux boutons collés, et pas un bouton dans un bouton.** Le carré commande la veille, le
nom ouvre la table : ce sont deux gestes, et un bouton imbriqué dans un autre n'est ni du
HTML valide ni atteignable au clavier. Ils partagent le fond et l'arrondi, donc la puce
reste une puce à l'œil — c'est la mise en page qui les réunit, pas le balisage.

**Le réveil se pose autour du couple `regler`/`poser`, jamais dans le crochet de recette.**
Le crochet sert *toutes* les recettes de l'écran, y compris celle que la barre pose pour
endormir : un réveil câblé là-dedans aurait rendu l'endormissement impossible — poser la
recette qui endort aurait rallumé la place dans le même souffle. Et le réveil ne s'accroche
qu'à `poser`, pas à `regler` : `regler` part cent fois pendant qu'un curseur glisse, et
l'annonce serait partie avant le geste qu'elle décrit.

**Le domaine ne refuse pas un nom de place inconnu ; les portes d'entrée, si.** Le domaine
relit des fichiers, et une recette écrite avant qu'une place soit renommée doit continuer de
s'ouvrir — il filtre en silence. Mais un agent qui écrit *quantifications* au pluriel
croirait avoir éteint la palette et regarderait ensuite un rendu quantifié sans comprendre :
la route HTTP et l'outil de l'agent vérifient donc tous les deux, avec la même phrase et la
liste de ce qui existe.

**La veille est triée à l'écriture comme à la lecture.** L'empreinte se calcule sur le texte
de la recette : sans tri, éteindre la grille puis la palette aurait donné une autre
empreinte — donc un autre rendu à calculer — que l'inverse, pour exactement la même image.

---

## U5 · Les réglages voyagent d'une image à l'autre

**Critères : 9 · Ce que ça corrige : un point de la séance · *tenue le
1<sup>er</sup> septembre 2026***

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

**Ce qui ne voyage pas, et pourquoi.** *Élargi au cadrage du 1<sup>er</sup> septembre 2026,
où l'auteur a tranché la règle générale* (`docs/prd-decisions.md`, `US-342`). Une boîte de
recadrage tracée à la main est un rectangle *de cette image-là* : elle ne veut rien dire sur
une autre. Et elle n'est pas seule — **un réglage voyage, une coordonnée ne voyage pas** : ni
le cadre tracé, ni le point de la pipette, ni la forme entourée de la sélection magique
(U12), ni les passages de la main et ses calques de dessin, ni le décalage du calibrage, ni
la différence d'un calque. Six attitudes d'un même personnage n'ont pas la même silhouette,
et un passage recopié tomberait à côté. Une place privée de ce qui la désignait **arrive sans
effet et le dit**, plutôt que d'agir au hasard.

**Le prix de cette règle est réel et il se paie une fois** : une recette nommée emporte la
main aujourd'hui — le code ne retire que la différence et le décalage. Elle cessera de
l'emporter, et une recette écrite avant ce jour perdra donc ses passages en étant rappelée.

**Et une recette nommée appartient à l'atelier, pas à un jeu** — comme la base d'étiquettes.
Elle emporte les couleurs sous lesquelles on l'a enregistrée, telles quelles : c'est une
recette, pas un lien vers la palette d'un jeu.

### Critères d'acceptation

- [x] *Copier les réglages* puis *coller* sur une autre image donnent la même recette, état
      de veille compris.
- [x] Un collage annonce ce qu'il a posé, et ce qu'il n'a pas pu poser.
- [x] Rien de ce qui désigne un endroit de cette image-là ne voyage — cadre tracé, point de
      pipette, passage de la main —, ni par collage ni par recette nommée, et la place qui en
      dépendait arrive sans effet en le disant.
- [x] Une recette nommée écrite avant cette étape se rappelle sans lever, et ce qu'elle perd
      — ses passages de main — est annoncé au lieu d'être posé.
- [x] On enregistre la recette courante sous un nom depuis la barre des tables.
- [x] La liste des recettes nommées est atteignable depuis la même barre ; on en applique
      une, on en oublie une.
- [x] Deux images traitées par la même recette nommée sortent identiques au pixel près.
- [x] Une recette nommée survit à la fermeture de l'atelier, et s'applique à une image d'un
      autre jeu que celui où elle a été enregistrée.
- [x] Enregistrer un nom déjà pris propose de remplacer, et ne remplace jamais en silence.

### Bloquée par

- **U4** — l'état de veille fait partie de ce qui voyage.

### Ce qu'elle a appris en étant faite

**Une règle, trois portes, et la troisième n'est pas une redite.** Coller, enregistrer et
rappeler passent tous par la même fonction du domaine. On aurait pu croire que couper à
l'enregistrement suffisait — puisque le disque ne porterait alors plus rien à couper —, et
c'est faux pour une raison qui ne se voit qu'en regardant le disque existant : il porte des
recettes écrites avant que la règle existe. Le critère « se rappelle **sans lever**, et ce
qu'elle perd est annoncé au lieu d'être posé » est exactement le critère de cette
troisième porte.

**C'est le serveur qui coupe, jamais l'écran.** L'écran envoie la recette qu'il a sous les
yeux, entière, et prend ce que le serveur a décidé. La tentation était de couper dans
l'écran — il connaît la recette, la règle tient en dix lignes —, et elle aurait fabriqué
deux découpages : l'auteur aurait fini par apprendre que *coller* et *rappeler* ne font pas
tout à fait la même chose, sans jamais savoir lequel croire.

**Une route à part pour coller, et c'est le contrat qui l'exige.** `PUT …/recipe` pose
exactement ce qu'on lui donne ; `POST …/paste` coupe ce qui ne voyage pas et le dit. Les
confondre aurait fait de chaque réglage posé un collage — et un cadre tracé serait tombé au
premier envoi de la table de recadrage.

**Ce qui reste, reste entier.** On retire la coordonnée, pas la place qui la portait : le
recadrage garde sa marge, la passe garde sa tolérance. C'est ce qui rend lisible « la place
arrive sans effet » — c'est bien la place qui est là et qui ne fait rien, pas la recette qui
manque un morceau.

**Une liste vide et *rien du tout* ne disent pas la même chose.** Le panneau distingue
« aucun voyage n'a encore eu lieu » de « tout a voyagé » : les confondre aurait effacé la
seule bonne nouvelle que le panneau ait à donner, et laissé l'auteur se demander à chaque
collage si le silence voulait dire *réussi* ou *pas encore parti*.

**Un seul point d'entrée pour deux durées de vie.** Copier-coller sert la séance, les
recettes nommées lui survivent — et ils répondent à la même question : *je veux ces
réglages-là, ailleurs*. Les éloigner l'un de l'autre aurait obligé à savoir d'avance lequel
on voulait. La barre fait 34 px et déborde déjà à sept places : quatre boutons de plus en
auraient fait une bande à faire glisser pour atteindre un geste de portée générale.

**Le presse-papiers vit hors de React.** Copier ici et coller là suppose de survivre au
démontage de l'écran — on change d'image, donc de composant. Le tenir dans un état de React
aurait demandé de le remonter jusqu'à l'ancêtre commun de toutes les images, c'est-à-dire
l'application entière, pour un usage qui ne concerne que cette barre-ci.

---

## U6 · La palette se règle sans faire attendre

**Critères : 6 · Ce que ça corrige : un point de la séance · *tenue le
1<sup>er</sup> septembre 2026***

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

- [x] Bouger l'attraction ou la proportion sans toucher aux sources répond **sous 300 ms**
      sur le paquet de trois images qui en coûte 2 100 aujourd'hui.
- [x] Ajouter, retirer ou remplacer une carte du paquet recalcule bien la palette.
- [x] Renommer une palette ou une ambiance ne recalcule aucune couleur.
- [x] Un calcul qui dépasse 240 ms montre la jauge du produit, et elle disparaît avec lui.
- [x] L'aperçu de la palette sur de vraies images ne se redemande pas tant que rien
      n'a changé.
- [x] Un banc gratuit mesure les deux temps — avant et après — et garde son relevé.

### Bloquée par

Aucune.

### Ce qu'elle a appris en étant faite

**Le chiffre est pire que ce que la séance disait, et le banc le montre.**
`essais/essai_palette_vive.py` mesure sur trois vraies cartes du disque, de 1 254 pixels de
côté : **11 500 millisecondes avant, 25 après** — 460 fois. L'auteur avait relevé 2,1
secondes, sur des images plus petites ; l'écart entre les deux relevés n'est pas une
contradiction, c'est la taille des images, et c'est ce qui rend le défaut pénible à
diagnostiquer sur une séance et évident sur un banc.

**On ne fixe pas une durée dans les essais, on fixe un nombre de lectures.** Une assertion
sur une milliseconde mesurerait la machine qui la lance. Ce qui produit le temps est
structurel — *combien de fois le paquet est-il ouvert ?* — et c'est ça que
`tests/test_u6.py` fixe : zéro, pour trois relâchements de curseur, contre quinze avant.
La durée, elle, vit dans le banc, qui garde son relevé et qu'on peut refaire.

**Une empreinte qui n'ouvre plus les fichiers doit quand même savoir qu'un fichier a
bougé**, et c'était toute la difficulté. Elle le sait parce qu'une carte du tableau porte
déjà l'empreinte de ses octets : la signature d'un paquet est la liste triée de ses cartes
et de leurs empreintes. Trié, parce que l'ordre de lecture du disque n'est pas une propriété
du paquet — le laisser entrer aurait fait recalculer une palette parce qu'un dossier a été
parcouru dans un autre ordre.

**Le service disait « il ne tient aucun cache en mémoire », et il en tient un maintenant.**
La phrase a été réécrite plutôt que contournée. La distinction qu'elle protégeait tient
toujours : les *palettes* ne sont pas gardées — elles vivent dans le fichier du projet, et
une copie ici serait une seconde vérité. Ce qui est gardé est la *lecture d'un paquet de
fichiers*, dont la clé porte l'empreinte de chaque fichier lu : une entrée ne peut pas
survivre à ce dont elle est la lecture. C'est l'arrangement du détourage gardé dans le
service des assets, pour la même raison.

**Le banc a trouvé un second défaut, qui n'est pas dans cette étape.** L'aperçu de la
palette coûte **2 900 millisecondes sur des images brutes de mille pixels**, et 20 sur des
sprites de soixante-quatre. C'est le cas ordinaire qui est rapide — une bibliothèque rangée
porte des sprites —, mais un auteur qui règle une palette avant d'avoir posé la moindre
grille attend trois secondes par mouvement de curseur. Le relevé est gardé ; rien n'a été
changé, parce que ce n'est pas ce que l'étape promettait et qu'un correctif au passage
n'aurait été ni mesuré ni cadré.

**La jauge n'est pas neuve, et c'est la moitié du travail.** Le produit en a exactement une,
avec son seuil de 240 ms qui l'empêche de clignoter sur un geste court. L'employer telle
quelle a demandé de la poser au-dessus du panneau plutôt que dedans — et de réserver ses
deux pixels en permanence : une jauge qui pousse le panneau vers le bas en paraissant fait
sauter ce qu'on regarde, et c'est précisément le geste où l'œil est resté sur les couleurs.

---

## U7 · La toile dit ce qu'elle a fabriqué

**Critères : 5 · Ce que ça corrige : un point de la séance · *tenue le
1<sup>er</sup> septembre 2026***

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

- [x] Faire une palette depuis un îlot le dit, nomme ce qui a été créé, et propose d'y aller.
- [x] Faire une ambiance fait de même, et l'ambiance porte bien la palette du paquet.
- [x] Un îlot dont le paquet a une palette ou une ambiance le montre sur la toile.
- [x] Refaire le geste sur un paquet déjà servi ne crée pas de doublon et mène à l'existant.
- [x] Un refus du serveur se lit à l'endroit où l'on a cliqué, jamais ailleurs.

### Bloquée par

Aucune.

### Ce qu'elle a appris en étant faite

**Les cinq critères posent une seule question au serveur** : *ce paquet-là a-t-il déjà
produit quelque chose, et quoi ?* La marque sur l'îlot, le second clic qui ne fait pas de
doublon, le chemin vers l'existant — les trois s'y répondent d'un coup. Une fois la question
posée au bon endroit, le reste est de l'écriture.

**Lu, jamais rangé.** Un paquet n'a pas d'identité à lui : c'est un nom de groupe écrit sur
des cartes, et il disparaît avec sa dernière carte. Lui accrocher un champ *sa palette*
aurait fabriqué une seconde vérité que renommer un îlot ferait diverger, et un objet qui
pointe vers un paquet qui n'existe plus. La réponse se lit dans l'autre sens : une palette
dit de quel paquet elle est la lecture, et il suffit de retourner la liste. C'est aussi ce
qui rend la marque juste sans qu'on ait à la nettoyer — supprimer la palette retire la
marque, sans une ligne pour le faire.

**Elle part avec les cartes, pas par une seconde route.** Même raison que les liens de T9 :
un îlot qui montrerait sa marque un aller-retour après les cartes aurait, à chaque
ouverture, un instant où il paraît n'avoir rien fabriqué.

**Le bouton change de mot avant qu'on clique**, plutôt que de s'excuser après. *Ouvrir sa
palette ›* au lieu de *faire une palette de ce paquet* : le geste dit ce qu'il fera. Le
refus du serveur pour un nom déjà pris reste en place — c'est le filet, pour une palette
créée dans une autre fenêtre entre-temps.

**Le compte rendu se lit là où l'on a cliqué, le refus part par le chemin des refus.** Les
deux ne sont pas de la même nature : la bonne nouvelle appartient au geste — elle nomme ce
qui vient d'être créé et porte le chemin pour y aller —, la mauvaise est du même genre que
toutes les autres du produit et passe par la fente du châssis. Lui inventer une seconde
place dans le menu aurait fait deux grammaires pour une mauvaise nouvelle.

**La marque n'a demandé ni glyphe, ni couleur, ni surface.** Elle se pose là où l'îlot parle
déjà de lui-même — `2 cartes · ambiance`, dans la même encre que le compte. Et elle
disparaît pendant qu'on tire une carte : l'îlot dit alors ce qu'il *vaudra*, et ce qu'il a
fabriqué n'est pas ce qui est en jeu à cet instant-là.

**L'ambiance l'emporte sur la palette dans la marque**, parce qu'elle la contient : dire les
deux serait redondant, dire la palette seule serait dire la moitié.

---

## U8 · La galerie rend le prompt, et son bouton rentre dans la vignette

**Critères : 7 · Ce que ça corrige : deux points de la séance · *tenue le
1<sup>er</sup> septembre 2026***

### Ce qu'on livre

**Le prompt d'origine se lit sur la fiche d'une image.** Il est enregistré, entier, depuis
toujours — c'est la génération qui le porte, et l'atelier sait déjà le relire puisque
*reprendre les réglages* le repose dans le champ. Il n'était simplement affiché nulle part :
la fiche ne montre que le titre, qui en est les cinquante-six premiers caractères. On y
ajoute le texte entier, replié à quelques lignes, dépliable, et copiable — sans passer par
*reprendre*, qui change d'onglet et remplit le champ, c'est-à-dire qui fait tout autre chose
que lire.

**C'est le texte tel qu'il est parti**, avec ce que le jeu et l'ambiance y avaient ajouté, et
non le seul signalement écrit dans le champ : depuis E14, le champ ne porte plus que le
sujet, et une vieille image doit dire ce qui l'a faite, pas ce qu'on taperait aujourd'hui.

**Une image sans texte à elle nomme sa parente, et ne montre pas son texte.** *Tranché par
l'auteur au cadrage du 1<sup>er</sup> septembre 2026* (`US-352`). Une découpe de planche, un
calque rendu : la fiche dit qu'il n'y a pas de texte ici et mène à l'image dont elle
descend — on va le lire là où il a été écrit. Montrer le texte de la planche sur l'un de ses
huit morceaux aurait affiché sur une image un texte qui en décrit huit.

**Et le bouton de téléchargement rentre dans la vignette.** Mesuré : à la taille de repos,
la vignette fait 132,6 px, la ligne des mesures en réclame 137, et le lien *PNG ↓* dépasse
de **13,2 px** sur la droite — il sort de la tuile et se pose sur la voisine. Aux deux
autres tailles, la place suffit. La ligne est bornée par sa tuile, et à la taille de repos
le lien se réduit à sa flèche : la planche contact ne perd pas une colonne pour un bouton
secondaire.

### Critères d'acceptation

- [x] La fiche d'une image montre le prompt qui l'a fabriquée, entier, replié par défaut, et
      c'est bien le texte parti — celui du jeu et de l'ambiance compris, pas le seul sujet.
- [x] On le déplie, on le copie, sans quitter la fiche ni toucher au champ de génération.
- [x] Une image entrée par import — donc sans prompt — le dit au lieu de laisser un vide.
- [x] Une image née d'une autre nomme sa parente et y mène, sans afficher le texte de
      celle-ci.
- [x] À la taille de repos, rien ne dépasse de la vignette : mesuré au navigateur, pas
      estimé.
- [x] Le téléchargement reste atteignable aux trois tailles.
- [x] La ligne des mesures ne pousse plus la tuile : c'est ce qui produisait le débordement.

### Bloquée par

Aucune.

### Ce qu'elle a appris en étant faite

**Le débordement tenait en trois caractères de feuille de style, et ce n'étaient pas ceux
qu'on aurait cherchés.** Une case de grille vaut `min-width: auto` par défaut, c'est-à-dire
*au moins la largeur de mon contenu* : la tuile s'élargissait pour loger sa ligne de
mesures, et sortait de sa colonne. Ce n'est donc pas le lien qui débordait de la tuile,
c'est la tuile qui débordait de sa case — le lien n'était que l'endroit où ça se voyait.
Une fois `min-w-0` posé, tout le reste — la flèche seule, le point qui cède — n'est plus
qu'une question de tenir dans une largeur qui, elle, ne bouge plus.

**Mesuré trois fois au navigateur, et la troisième mesure a changé le dessin.** À la taille
de repos, la ligne dispose de 120 pixels et ses quatre morceaux en réclament 124 : les
dimensions se coupaient de trois pixels, et `831×907` se lisait `831×9…`. Le point de
séparation et son écart valent treize pixels à eux deux — il cède donc à la taille de repos,
parce qu'un point n'est pas une mesure et que ce qu'il fait, l'écart le fait déjà. Relevé
final, tuile de 137,9 px : la ligne demande exactement 120, rien ne se coupe, et le lien
reste à 9 px du bord droit. Aux deux autres crans, 321 px et 652 px, la place est large.

**Ce qui cède est choisi, et il est écrit pourquoi.** Le prix est l'enjeu que le produit met
au centre ; le téléchargement est une cible qu'on vise. Ni l'un ni l'autre ne se tronque.
Les dimensions, elles, sont redites en entier sur la fiche à un clic — et une largeur
coupée reste lisible là où un prix coupé ne veut plus rien dire.

**Le cran de zoom descend jusqu'à la tuile, plutôt qu'une largeur mesurée.** La tuile
pourrait se mesurer elle-même ; elle dépendrait alors d'une mise en page qui n'existe pas au
premier rendu, et clignoterait le temps d'une image. Le cran est connu d'avance, et c'est
déjà lui qui décide de tout le reste de la grille.

**Le prompt n'a demandé aucune route neuve.** Le fichier de la génération porte le texte
*tel qu'il est parti*, bible repliée comprise, depuis T4 : la fiche allait déjà le chercher
pour dire ce que l'ambiance avait donné. Une seule lecture pour les deux blocs — deux appels
sur le même fichier auraient fait deux instants différents du même fait.

**Trois cas, et le troisième est le seul qui demandait une décision.** Un texte, pas de
texte, ou un texte qui est ailleurs. Le troisième — une découpe de planche, un calque rendu
— nomme sa parente et y mène plutôt que d'afficher le texte de celle-ci : montrer le texte
de la planche sur l'un de ses huit morceaux aurait affiché sur une image un texte qui en
décrit huit.

**Le texte défile dans sa boîte, il n'étale pas la fiche.** Mesuré sur une vraie image du
jeu : 3 816 signes. Le laisser s'étaler enverrait tout ce qui suit — la filiation, la
recette, le réalignement — hors de portée du défilement, pour un texte qu'on lit une fois.

---

## U9 · L'écran de confirmation se lit d'un coup d'œil

**Critères : 6 · Ce que ça corrige : un point de la séance · *tenue le
1<sup>er</sup> septembre 2026***

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

- [x] Un texte long est replié à quelques lignes avec un bouton qui dit ce qu'il cache.
- [x] Déplié, le texte est **entier**, sans coupure ni résumé, et le repli se referme.
- [x] Chaque image jointe porte sa vignette, à côté de son prix et de son interrupteur.
- [x] Le pointeur sur une vignette et la barre d'espace ouvrent l'image en grand ; la
      relâcher referme.
- [x] L'aperçu passe **au-dessus** de l'écran de confirmation, comme au-dessus des autres
      écrans qui couvrent l'atelier.
- [x] La phrase de l'invariant est réécrite **aux trois endroits où elle vit** — la carte du
      dépôt, la maquette de l'écran de confirmation, et le commentaire du code —, avec sa
      date et sa raison. Corrigée à un seul, elle deviendrait une contradiction.

### Bloquée par

Aucune. Elle touche le même écran que U1 sans en dépendre — U1 passe d'abord parce qu'elle
coûte de l'argent.

### Ce qu'elle a appris en étant faite

**Amender un invariant coûte plus cher que le tenir, et c'est tant mieux.** La phrase vivait
à trois endroits — la carte du dépôt, la maquette 08bis, l'en-tête de `Envoi.tsx` —, et
chacun l'énonçait avec ses mots. Corrigée à un seul, elle serait devenue une contradiction
que rien n'aurait signalée : deux documents du dépôt disant l'inverse l'un de l'autre sur la
règle que l'écran existe pour tenir. Les trois portent désormais la même phrase neuve, sa
date et sa raison — et la raison est ce qui compte, parce que la phrase d'origine n'était pas
fausse : elle était vraie pour un texte de cent caractères et devenue impraticable pour un
texte de mille deux cents.

**Le pli est annoncé, sans quoi ce serait la troncature qu'on venait d'interdire.** Le bouton
dit *déplier — N caractères de plus*, et N est compté sur le texte réel, pas arrondi. La
coupure tombe sur une fin de mot : un pli qui couperait « pixe » ferait douter de ce qu'il
cache, ce qui est exactement ce qu'un pli ne doit pas faire. Trois cent vingt caractères, cinq
lignes environ dans la colonne du milieu — assez pour reconnaître un texte, trop peu pour
qu'il mange l'écran.

**Les vignettes ont demandé l'objet entier, jamais une adresse.** L'écran sait déjà nommer
l'adresse de l'image d'un asset et celle d'une carte, à un seul endroit chacune —
`imageAsset` et `sujetCarte`. Envoyer depuis le serveur une adresse toute faite aurait posé
là un second vocabulaire d'adresses, que la première empreinte ajoutée aurait fait diverger :
deux écrans montrant deux images différentes de la même chose, sans que rien ne le dise. Le
serveur envoie donc `montre` — la carte entière ou l'asset entier —, et l'écran s'en sert
avec les fonctions qu'il a. `tests/test_u9.py` compare l'objet reçu à celui que rendent
`GET /api/assets/{id}` et `GET /api/board` : c'est le même, mot pour mot.

**Une image disparue rend `None`, jamais une erreur.** Une référence peut nommer une carte
retirée du tableau entre le moment où la ligne a été composée et celui où on la regarde. La
ligne reste — elle dit ce qui partirait, avec son prix et sa case —, elle n'a simplement pas
de vignette. Une exception à cet endroit aurait éteint l'écran entier juste avant un
paiement, pour une image qu'on ne comptait pas regarder.

**Le service de l'envoi ne connaissait pas la bibliothèque, et ça ne s'est vu qu'à l'essai.**
Il recevait les générations, la production, l'univers et le projet ouvert : de quoi montrer
une carte du tableau, pas un asset promu. Le câblage manquant rendait `montre` vide sur la
moitié des lignes sans rien casser — c'est `test_u9.py` qui l'a nommé, et c'est le genre de
trou qu'un écran ne signale jamais puisqu'il se contente d'afficher un peu moins.

**Le passage au-dessus ne se mesure pas en pixels ici.** L'aperçu est `fixed inset-0 z-50` et
il est monté **hors** de l'écran de confirmation, à la racine de l'atelier : c'est ce qui fait
qu'aucune colonne ni aucun défilement ne le rogne. L'essai tient les deux faits — les classes
et la position dans l'arbre — plutôt qu'un rectangle, parce que jsdom ne met rien en page et
qu'une assertion sur des pixels y serait vraie sans rien prouver.

---

## U10 · Chaque passe de détourage dit ce qu'elle enlève

**Critères : 7 · Ce que ça corrige : deux points de la seconde séance · *tenue le
1<sup>er</sup> septembre 2026***

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

**C'était bien la cause du défaut de la pipette sur une seconde passe — reproduit et chiffré
avant qu'une ligne le corrige.** Le geste « zone d'un seul tenant » se propage de proche en
proche à partir du point visé, à travers tout ce qui ressemble à la couleur visée — **y
compris à travers les pixels que la première passe a effacés**, qui ont gardé leur couleur et
forment un couloir continu. La tache repart alors par ce couloir et ressort ailleurs dans
l'image, sur une zone qui n'a rien à voir avec ce qu'on désignait.

**Le banc `essais/essai_pipette_seconde.py`** le montre sur une image dessinée pour lui —
deux poches de la même couleur, chacune dans son bloc, reliées au dehors par deux pixels de
fond. Une passe de bord à tolérance 8 retire le fond et les deux couloirs ; une pipette posée
sur la poche de gauche à tolérance 20 prenait **les deux**, soit **120 pixels sur une zone qui
ne touchait pas le point désigné**. À l'écran, entre elles, il n'y avait que du damier.

**Ce qui a été retenu** : la propagation s'arrête à ce qui reste. L'autre issue possible —
la laisser passer et montrer d'avance la zone qu'elle prendra — a été écartée : elle rendait
la surprise lisible au lieu de rendre le geste prévisible.

### Critères d'acceptation

- [x] Chaque passe porte un bouton qui la masque, et le rendu se refait sans elle.
- [x] Une passe masquée garde tous ses réglages ; la rallumer rend exactement l'état d'avant.
- [x] Masquer une passe ne la retire pas de la recette, et les deux gestes se distinguent à
      l'écran.
- [x] Le défaut de la pipette sur une seconde passe est **reproduit et mesuré** avant qu'une
      ligne le corrige — quelle image, quel point, quelle zone est prise en trop.
- [x] Une pipette posée sur une poche de fond ne prend plus une zone qui n'y touche pas.
- [x] Le comportement retenu est écrit là où la question se pose : dans la table, pas
      seulement dans le code.
- [x] Un essai tient le cas des deux passes enchaînées, celui par lequel le défaut est passé.

### Bloquée par

Aucune.

### Ce qu'elle a appris en étant faite

**Le défaut ne se voyait pas parce que la preuve était invisible par construction.** Le
couloir par lequel la tache s'échappe est du fond déjà effacé : il est transparent à l'écran
et coloré dans les nombres. Aucune capture d'écran ne pouvait le montrer, et c'est pour ça
que la question a traîné une séance entière. Le banc le dessine plutôt que de le chercher
dans une image du dépôt — un banc qui ouvrirait une vraie image donnerait un chiffre que la
prochaine retouche ferait mentir.

**« Une passe est écrite » et « une passe agit » sont deux questions, et cinq endroits les
posaient.** C'est très exactement la fuite de U4, un cran plus bas : le traitement, la remise
sur grille, la mesure des poches, la découpe et la superposition demandaient tous la première
en croyant demander la seconde. Une lecture unique — `Recette.passes_vives()` — répond
maintenant pour les deux extinctions à la fois, celle de la place et celle de la passe. Sans
elle, masquer la dernière passe aurait gardé la case de la grille, et l'image aurait changé
de taille pour une raison que rien n'affiche.

**L'essai de la case de la grille a d'abord passé sans rien prouver.** Il tournait sur une
image opaque de bord à bord, dont la boîte du sujet *est* l'image entière : la case ne
changeait donc rien, et l'essai aurait dit vrai avec la lecture fautive comme avec la bonne.
Il a fallu une image déjà trouée pour que la question ait une réponse visible — et la
vérification de cette vérification est ce qui a rattrapé l'essai.

**Toucher un réglage remontre la passe, mais sans bandeau d'annonce.** La règle est celle de
U4 ; l'annonce, non. Là-bas l'interrupteur vit dans une barre, loin de la colonne où l'on
règle, et le réveil se produisait hors du regard. Ici le bouton est vingt pixels au-dessus du
curseur qu'on touche et le bloc entier cesse d'être grisé sous les doigts : le dire une
seconde fois serait dire ce qu'on voit.

**Un champ neuf sur une passe est un champ qui doit être absent des vieux fichiers.** Son
absence vaut *visible*, et c'est ce qui fait qu'une recette écrite avant ce jour rend
exactement ce qu'elle rendait. Le champ entre en revanche dans l'empreinte, et c'est voulu :
masquer une passe change le rendu, et un rendu qui change doit changer de nom.

---

## U11 · La main peint carré, et là où on la pose

**Critères : 6 · Ce que ça corrige : un point de la seconde séance, en deux moitiés ·
*tenue le 1<sup>er</sup> septembre 2026***

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

- [x] Le pinceau couvre un carré de côté impair, centré sur le pixel visé ; le tracé entre
      deux points a des bouts et des joints carrés.
- [x] Le curseur à l'écran est le carré exact que le prochain passage couvrira.
- [x] L'écart est **mesuré avant correction** — combien de pixels, sur quelle image, avec
      quel recadrage —, puis mesuré après, et il vaut zéro.
- [x] Un clic au bord de l'image marque un pixel du bord, et non le voisin.
- [x] Le trait tombe juste à tous les niveaux de zoom, y compris ceux que U2 ouvre sous
      cent pour cent.
- [x] Le changement de forme du pinceau est écrit où la promesse de déterminisme est écrite :
      une recette d'avant ne rend plus tout à fait la même image, et ça se dit.

### Bloquée par

Aucune, mais **à faire avec U2 ou juste après** : les deux réparent la même erreur — une
surface qui ment sur l'image qu'elle porte — à deux endroits, et les corriger séparément
ferait écrire deux fois le même calcul.

### Ce qu'elle a appris en étant faite

**L'hypothèse du relevé était juste dans son mécanisme et fausse dans son ampleur, et c'est
la mesure qui l'a dit.** Deux choses pouvaient décaler le trait, et l'étape n'en nommait
qu'une.

*La première, celle que l'étape décrivait* — une surface qui ment sur l'image qu'elle
porte —, **existe et a été mesurée à un huitième de pixel** sur l'image de la séance :
surface de 648 × 707, image de 831 × 907, donc 0,12 px de bande vide de chaque côté. Elle
est réelle et elle est corrigée pour les trois surfaces, mais elle n'explique pas ce que
l'auteur a vu. La raison est que l'atelier tient ses mesures de rendu à jour — `rendu_largeur`
et `rendu_hauteur` sont réécrites à chaque rendu —, si bien que le rectangle supposé et le
rectangle réel coïncident presque toujours. **C'est un défaut qui attend son heure**, pas
celui qu'on cherchait ; le jour où une mesure vieillira d'un rendu, il mordra d'un coup, et
alors ce sera de dix pixels et non d'un huitième : mesuré sur un cas construit, une image de
64 px dans une surface de 600 × 400 déplaçait le clic de **quatre pixels au milieu et de dix
au bord**, dans un sens à gauche et dans l'autre à droite. C'est ce qui rendait le défaut
difficile à décrire : il ne se comporte pas comme un décalage constant.

*La seconde, que l'étape ne nommait pas, est celle qui mordait* : **le curseur suivait le
pointeur, le pinceau peint le pixel plancher.** Le cercle se dessinait exactement sous la
pointe ; le carré peint est centré sur `floor(x)`, donc jusqu'à un demi-pixel d'image à
gauche et en haut de là où le cercle se dessinait. À seize fois — l'agrandissement courant
sur un sprite de soixante-quatre —, cela fait **huit pixels d'écran, vers la gauche et vers
le haut**. C'est le symptôme du relevé au mot près. Le curseur est désormais calé sur la
grille de l'image : il *est* le carré que le passage couvrira, et non plus une indication.

**La leçon générale**, et elle vaut au-delà de cette étape : un aperçu qui suit le pointeur
au pixel d'écran ment dès que l'écran est plus fin que la grille qu'on manipule. Toute
surface qui montre ce qu'un geste va faire doit se caler sur l'unité du geste, pas sur celle
du pointeur.

**Et le pinceau carré s'obtient sans écrire un second pinceau.** Le chemin se trace d'un
pixel de large — la rasterisation fixe de `ImageDraw`, qui est ce qui rend le tracé
déterministe —, puis il s'épaissit par la **dilatation carrée** que le produit emploie déjà
pour les contours et les bords. Un rectangle posé à chaque pixel du chemin donnerait
exactement le même masque, en mille fois plus d'appels de dessin.

---

## U12 · La sélection magique — tracer gros, ajuster au bord

**Critères : 7 · Ce que ça ajoute : un point de la seconde séance · *tenue le
1<sup>er</sup> septembre 2026***

### Ce qu'on livre

**On entoure grossièrement ce qu'on veut garder, et l'atelier va chercher le bord du sujet
lui-même** à l'intérieur de ce qu'on a entouré. Le geste des logiciels d'image, et il
répond à ce que ni le détourage automatique ni la retouche au pixel ne savent faire : le
premier décide tout seul et se trompe parfois, la seconde demande de suivre un contour au
pixel près, ce qui est long sur une silhouette entière.

**Elle vit avec le détourage, et non avec la main.** *La séance l'avait vue comme un
troisième outil de la table de la main, à côté de la zone et de la retouche ; l'auteur a
tranché l'inverse au cadrage du 1<sup>er</sup> septembre 2026, sur une question qu'il a posée
en retour.* C'est une **quatrième façon de désigner ce qu'on retire**, à côté du remplissage
depuis le bord, de la pipette et du modèle — un seul endroit décide de ce qui est effacé. Et
elle doit agir **avant le recadrage et la mise sur grille**, qui ont tous les deux besoin de
savoir où est le sujet : tant que le fond est encore là, la boîte du sujet, c'est toute
l'image, et un détourage fait en dernier rendrait un sprite mal cadré et mal calé dans sa
case.

**La question posée en retour, et sa réponse**, parce qu'elle vaut pour la suite : *un tracé
propre à une image va-t-il entrer dans une recette ?* **Oui — dans les deux emplacements
envisagés**, la main étant une place de la recette autant que le détourage, et ses passages y
étant enregistrés comme des tracés. Ce qui protège n'est donc pas l'emplacement, c'est la
règle du voyage tranchée en U5 : une coordonnée ne voyage pas, et le point de la pipette est
déjà exactement ce cas-là.

**Ce qui le rend possible ici sans rien inventer** : l'atelier sait déjà remplir une zone de
proche en proche à partir d'un point, et il sait déjà durcir puis ronger un bord — ce sont
les deux mécanismes du détourage par la couleur et du réglage de durcissement. La sélection
magique les emploie dans l'autre sens : la zone tracée borne la recherche au lieu de la
lancer, et ce qui sort est un masque qu'on peut encore retoucher à la main.

**Ce qui reste à faire, et non plus à trancher** : une passe doit pouvoir porter une **forme
dessinée**, ce qu'aucune ne fait aujourd'hui — elles portent un seuil, une tolérance, un
durcissement, et au plus un point. C'est le seul travail neuf de l'étape ; le reste emploie
ce qui existe.

### Critères d'acceptation

- [x] On trace une forme grossière autour du sujet, à main levée, et elle se voit pendant
      qu'on la trace.
- [x] L'atelier ramène le contour sur le bord du sujet **à l'intérieur** de la forme tracée,
      et ne touche à rien au-dehors.
- [x] Le résultat se retouche ensuite à la main, sans avoir à recommencer.
- [x] Le geste se défait d'un seul coup, comme un passage de la main.
- [x] Deux images traitées par la même recette donnent le même masque : rien n'est tiré au
      sort.
- [x] Elle agit **avant** le recadrage et la mise sur grille : le sujet détouré par un tracé
      est cadré et calé dans sa case comme n'importe quel autre.
- [x] La forme tracée ne voyage pas — ni par collage, ni par recette nommée —, comme le point
      de la pipette.

### Bloquée par

- **U11** — on y trace sur l'image, comme la main y peint et comme la pipette y désigne un
  point ; c'est la même surface, et elle doit d'abord dire la vérité sur l'endroit qu'on
  touche. *La raison ne change pas parce que l'outil a changé de table : c'est le tracé sur
  l'image qui la porte, pas l'endroit d'où on l'ouvre.*

### Ce qu'elle a appris en étant faite

**Tout le geste tient dans une inversion d'une ligne : le tracé borne le remplissage au lieu
de l'amorcer.** `_remplir` reçoit ses graines depuis E3 — les quatre bordures pour le moteur
du bord, le point désigné pour la pipette. La sélection magique lui donne le **liseré de la
forme entourée**, et lui interdit d'en sortir. Le seul travail neuf de l'étape est ce que le
cadrage avait annoncé : qu'une passe puisse porter une forme dessinée. Le reste est déjà là.

**« Rien ne bouge au-dehors » a une conséquence qu'il fallait mesurer pour la voir.** Un
essai voulait montrer que la sélection agit avant le recadrage, et il attendait un sprite
ramené sur la boîte du sujet. Il a rendu l'image entière — et c'était juste : ce qui est hors
du tracé reste opaque, donc la boîte opaque reste celle de l'image. L'essai a été refait en
entourant tout le cadre. La règle n'a pas plié devant l'essai ; c'est l'essai qui disait la
mauvaise chose.

**La seconde rasterisation du dépôt, et elle hérite de l'obligation de la première.**
`pinceau` est déterministe parce qu'une recette rejouée doit rendre le même masque — un
critère depuis T2. Le remplissage de polygone l'est pour la même raison, et il ne lisse rien :
un bord lissé aurait été tranché à pile ou face par le seuil qui suit, et deux rendus de la
même recette auraient différé d'un pixel sans que rien l'explique.

**La couleur du fond se lit sur le liseré, jamais dans la recette.** Médiane, comme la
bordure de l'image pour le moteur du bord, et pour la raison exacte : un sujet qui dépasse du
tracé déplacerait une moyenne, il ne déplace pas une médiane. Une couleur rangée à côté de la
forme serait une copie que plus rien ne met à jour — la faute écrite en long sur `Passe`
depuis E3.

**Un état armé, deux lectures.** La visée de la pipette et l'entourage de la sélection
partagent `viseeArmee` et se dérivent chacune de leur côté. Deux états auraient pu s'armer
ensemble, et la surface aurait alors reçu deux gestes à la fois — un clic qui pose un point
*et* commence un tracé.

**Le corpus a refusé la clé avant nous.** L'écran branchait `detourage.trace` sur une entrée
qui n'existait pas ; l'essai qui tient « toute clé branchée à l'écran a son entrée dans le
corpus » l'a nommée à la première exécution. C'est le genre de règle qui ne sert à rien tant
qu'on n'ajoute rien, et qui paie le jour où l'on ajoute.

---

## U13 · Un second moteur de détourage, plus lourd et meilleur

**Critères : 7 · Ce que ça ajoute : un point de la seconde séance · *tenue le
1<sup>er</sup> septembre 2026***

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

**Deux absences, et elles ne se traitent pas pareil.** *Tranché par l'auteur au cadrage du
1<sup>er</sup> septembre 2026* (`US-363`). Un moteur **pas installé du tout** est grisé, avec
sa raison et le geste pour l'obtenir. Un moteur **installé dont le modèle n'est pas encore
descendu** reste choisissable, et dit avant de partir — une seule fois — ce qu'il va
rapatrier et combien ça pèse. Griser les deux aurait obligé à sortir de l'atelier pour un
téléchargement que l'atelier sait faire ; les confondre aurait laissé tomber une attente de
plusieurs minutes sur un geste annoncé comme lent de quelques secondes.

### Critères d'acceptation

- [x] Le moteur d'une passe se choisit dans une liste qui n'est plus écrite en dur.
- [x] Le moteur rapide reste celui qu'on obtient sans rien demander.
- [x] Le moteur lourd annonce qu'il est plus lent **avant** de partir, pas pendant.
- [x] Un moteur absent de la machine est grisé avec sa raison et le geste pour l'installer.
- [x] Un moteur installé dont le modèle n'est pas encore descendu reste choisissable et
      annonce, avant de partir et une seule fois, ce qu'il rapatrie et ce que ça pèse.
- [x] Un banc gratuit mesure les deux moteurs sur les images déjà là — durée, et ce qu'ils
      rendent — et garde son relevé.
- [x] Une recette qui nomme un moteur absent le dit sans casser le rendu des autres passes.

### Bloquée par

Aucune.

### Ce qu'elle a appris en étant faite

**Trois modèles au catalogue, et le relevé du banc.** `essais/essai_moteurs_silhouette.py`,
gratuit, sur quatre images déjà sur le disque : le **rapide** (`u2net`, 176 Mo) met 929 ms
par image et garde 21,9 % de l'image ; l'**intermédiaire** (`isnet-general-use`, 179 Mo) met
1 138 ms pour 21,5 %, et les deux s'accordent à **96 à 99 %** — un cinquième de temps en plus
pour presque le même résultat. Le **lourd** (`birefnet-general`, 928 Mo) n'est pas descendu
sur cette machine : le banc le **saute en le disant** plutôt que de déclencher un gigaoctet de
téléchargement, ce qui cesserait d'en faire un banc gratuit.

**Le poids annoncé est vérifié, pas estimé.** `--poids` pose une question à l'adresse de
téléchargement — elle rend la taille sans rapatrier un octet — et confronte les trois chiffres
du catalogue : les trois tombent juste, à l'octet. C'est le seul geste du banc qui demande le
réseau, et il est derrière une option pour cette raison. Un « ~900 Mo » écrit au jugé aurait
été exactement le genre de chiffre qu'on croit avant de lancer plusieurs minutes de patience.

**Deux absences, deux mécaniques, et la seconde ne pouvait pas passer par `rembg`.** Savoir
si un modèle est descendu, c'est regarder un fichier sur le disque ; le demander à `rembg`
aurait tiré `onnxruntime` dans le processus de l'atelier, or *le post-traitement ne touche
jamais le GPU* se **prouve** en regardant `sys.modules`, et cette question-là se pose à chaque
ouverture d'atelier. L'atelier recalcule donc les deux dossiers que `rembg` emploie, et un
essai les confronte aux siens **dans un autre processus**. Le pire qu'une divergence puisse
faire est d'annoncer un téléchargement qui n'aura pas lieu ; elle ne peut pas fausser un rendu.

**Un essai a mesuré l'état laissé par un autre, et il a fallu le reprendre.** La vérification
« lire le catalogue ne charge pas le moteur » regardait `sys.modules` sur place — et `rembg`
y était déjà, chargé par l'essai de T5 qui détoure pour de vrai quand le paquet est installé.
Elle passait sur une machine sans `rembg` et tombait sur une machine avec : exactement
l'essai qui ment dans un sens et pas dans l'autre. Elle repart maintenant d'un processus neuf.

**Une passe dont le moteur manque est sautée, elle ne fait pas tomber les autres.** Une
recette voyage : elle peut nommer un modèle qu'une autre machine n'a pas, et l'image doit
alors sortir avec les six autres places plutôt que pas du tout. C'est la règle de la passe
masquée (U10) appliquée à une absence subie au lieu d'une extinction voulue — et `sans_moteur`
en donne la liste, parce que sauter en silence serait la moitié du critère.

**Le champ absent d'une vieille recette vaut *le défaut du produit*.** Une passe par modèle
écrite avant ce jour se relit sans nom de modèle, prend le rapide, et rend exactement ce
qu'elle rendait. Nommer explicitement ce même défaut change l'empreinte — c'est un autre texte
dans le fichier — et c'est voulu : on ne fait pas passer deux écritures différentes pour la
même, même quand le calcul est identique.

---

## Ce que ce lot ne couvre pas

**Cinq de ces treize étapes ajoutent une capacité au produit**, et pas seulement une
réparation : la veille d'une table (U4), les réglages qui voyagent (U5), le prompt qu'on
relit sur une image (U8), la sélection magique (U12) et le second moteur de détourage (U13).
Ce que le produit doit faire est tranché dans `docs/PRD.md`, et ces cinq-là n'y étaient pas
écrites. **Elles y sont depuis le 1<sup>er</sup> septembre 2026** — trente-trois user
stories, `US-334` à `US-366`, et les décisions qui les tiennent dans
`docs/prd-decisions.md`. Quelle étape porte lesquelles se lit dans `docs/PLAN.md`.

**Le cadrage a tranché quatre points que ce fichier portait comme ouverts**, et les quatre
sont reportés ci-dessus, dans l'étape qu'ils changent : *une coordonnée ne voyage pas* (U5,
et une recette nommée y perd les passages de main qu'elle emporte aujourd'hui), *la
sélection magique agit avec le détourage et non avec la main* (U12), *une image sans texte à
elle nomme sa parente sans montrer son texte* (U8), et *un moteur installé dont le modèle
n'est pas encore descendu reste choisissable et annonce son poids* (U13).

Les huit autres corrigent un écran déjà cadré : elles ne demandent rien au produit qu'il
n'ait déjà promis. **Deux cas limites, et ils sont notés là où ils se paieront** : le
pinceau carré de U11 change le rendu de calques déjà peints, et l'interrupteur de passe de
U10 est la veille de U4 appliquée un cran plus bas — si l'une des deux change de forme,
l'autre doit suivre.

---

## Ce qui a été tranché seul, et reste à confirmer → `docs/questions-du-lot-U.md`

**Quinze choix, écrits pour être lus sans rien savoir du code.** Construire les treize étapes
a demandé de choisir une quinzaine de fois entre deux comportements possibles, là où les
critères disaient *quoi* livrer sans dire *comment se comporter dans ce cas précis*. Rien n'y
est cassé et rien n'y attend une réparation : ce sont des questions de goût et d'usage, et
c'est l'auteur qui les tranche. Chacune dit ce qui se passe aujourd'hui, l'autre choix
possible, ce que ça changerait en usage, et l'argument qui a fait pencher.

**La plus lourde des quinze est la septième** : la promesse de l'écran de confirmation a été
**réécrite** — c'est la seule fois du lot où une règle a bougé plutôt qu'un écran. Elle l'est
aux trois endroits où elle vivait, avec sa date et sa raison ; revenir en arrière demanderait
donc de rouvrir trois documents plutôt qu'un.
