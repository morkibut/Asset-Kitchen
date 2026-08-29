# Asset Kitchen — État du dépôt

Le journal de ce qui a été construit, tranche après tranche, et de ce que chaque tranche a
appris. **Il ne fait foi sur rien** : `docs/PLAN.md` dit ce qui reste, `docs/PRD.md` ce que
le produit doit faire, `docs/ARCHITECTURE.md` comment il est construit. Ce fichier-ci ne fait
que raconter, et il se lit dans un seul cas — **quand on veut savoir pourquoi c'est comme ça
plutôt qu'autrement**.

Il ne se lit pas au démarrage d'une session. Une tranche neuve n'a pas besoin de l'histoire
des dix précédentes ; elle a besoin de `docs/PLAN.md` et de `docs/PIEGES.md`.

Une entrée s'ajoute à chaque fin de tranche. Les plus récentes en tête.

## R4 — 29 août 2026

**R4 est écrite, et les quatre reprises sont finies.** L'infobulle sort désormais du panneau
qui porte son ancre, au lieu de choisir son côté par rapport au milieu de la fenêtre. **Les
six critères sont cochés, tenus par 12 essais de placement et 6 d'écran** ; aucun essai de
serveur n'a bougé, parce que rien du serveur n'a bougé.

**La règle d'avant n'était pas approximative, elle était juste au mauvais endroit.** Elle
disait *jamais sur l'image qu'elle règle*, et la mesurait contre le milieu de l'écran. À
l'atelier c'est vrai — l'autre moitié est la grille. À l'univers, aux réglages et dans la
fiche, l'autre moitié est encore du réglage, et le cas le plus net est celui des réglages :
un panneau de 520 px posé au milieu, une ancre dans sa moitié gauche, donc à gauche du milieu
de la fenêtre, donc une bulle qui s'ouvrait **sur le panneau lui-même**.

**Les panneaux se déclarent, l'infobulle ne les connaît pas.** Six panneaux portent une
marque, et le placement remonte de l'ancre au premier ancêtre marqué. L'alternative — une
liste d'écrans tenue dans l'infobulle — aurait fait de ce composant l'endroit qu'il faut
modifier chaque fois qu'un panneau naît ailleurs. Sans marque, le calcul retombe sur l'ancre :
la barre d'outils traverse l'écran, « hors du panneau » n'y voudrait rien dire, et elle garde
la règle d'avant là où elle était juste.

**Le calcul est sorti du composant parce que jsdom ne met rien en page**, et cette fois-ci
c'était décisif et non confortable. Un essai qui monterait l'écran Univers et mesurerait le
recouvrement lirait des rectangles nuls : il passerait avant la correction comme après, et
attesterait d'une règle qu'il ne vérifie pas. `placer()` prend donc des rectangles et rend
une position — le précédent de `Toile.test.tsx`, invoqué pour la même raison. L'écran, lui,
prouve ce que jsdom sait voir : que chaque panneau se déclare. Aucune des deux moitiés ne
suffit, et un essai nomme l'erreur d'avant pour montrer qu'elle tombe.

**Elle a été vue à l'écran, sur les trois cas.** L'univers : la bulle « Bible » couvrait
Palette, Taille de pixel, Barème et Modèle par défaut ; elle s'ouvre maintenant à droite du
panneau, sur le tableau. La fiche : « Détourage » part à gauche, sur la grille. Les réglages :
le panneau mesuré à 373–893, la bulle posée à 903 — dehors, à l'écart près.

**Le prix payé, et il est écrit** : la bulle peut recouvrir *un autre* panneau. Ouverte depuis
les réglages, elle atterrit sur la fiche restée derrière, inerte tant que les réglages sont
ouverts. La règle protège le panneau qu'on est en train de régler ; protéger tout l'écran
demanderait de replier la bulle sous son libellé, et ce n'est pas ce motif-là.

## R3 — 29 août 2026

**R3 est écrite — faire entrer une image depuis l'écran.** Un bouton dans la barre d'outils,
et le glisser-déposer sur la grille. L'image devient un asset entier : retouche, découpe,
export, suppression avec annulation, et sa fiche dit d'où elle vient — importée, coût nul, le
nom du fichier. **Les dix critères sont cochés, tenus par 18 essais de serveur et 5 d'écran.**

**La seule pièce neuve du serveur est une route qui prend les octets**, parce que celle qui
existait prend un *chemin* — ce qu'un navigateur ne donne jamais. Les deux appellent le même
service que l'outil MCP, et il n'y a donc toujours qu'un endroit du produit qui fasse entrer
une image. Les octets voyagent bruts, en corps de requête : la décision de `POST /board/paste`
en T4, reconduite sans la rediscuter — `multipart` demanderait une dépendance d'exécution de
plus pour transporter ce qu'un `POST` transporte déjà.

**Le service a changé de réponse plutôt que de place.** Il rend maintenant *ce qui est entré*
**ou** *ce qui était déjà là* : un doublon n'est pas un refus, donc il ne lève pas. C'est la
forme du collage du tableau, et c'est la leçon de C1 appliquée — *un objet a la même forme sur
toutes les routes qui le portent*, l'outil MCP compris. Cinq essais de T7 et de C1 ont été
repris pour cette raison-là, et c'est le prix juste d'un contrat qui a changé.

**Le défaut est passé à « telle quelle », et il vaut aussi pour l'agent.** Le PRD ne parlait
que de l'écran ; l'étendre à l'agent change son comportement d'avant, et c'est assumé : le
défaut d'hier — hériter de la recette du projet en silence, donc ramener une référence de 2048
pixels à 64 — est très exactement le défaut que la reprise corrige. Un agent qui le garderait
ferait vivre l'auteur et lui dans deux produits différents.

**La décision voyage sur la génération, et un essai le prouve après reconstruction.** L'index
est jetable : ce qui n'est pas dans un `generation.json` n'existe plus à la première évolution
du schéma, et une image entrée telle quelle se retrouverait sinon ramenée sur la grille du
projet un matin, sans que personne l'ait demandé.

**Et elle n'a rien coûté au balayage de palette.** Une recette vide est déjà ce que « Tout
réaligner » laisse tranquille — « un asset ramené au brut reste au brut » (US-64). Une image
entrée telle quelle le reste donc sans qu'aucune règle nouvelle ait eu à le dire : le signe
que la décision est posée au bon endroit.

**Une fonction a déménagé, et c'est le précédent de `teinte.py` qui l'a décidé.** L'empreinte
qui nomme un doublon vivait dans la carte du tableau ; la bibliothèque en a désormais besoin
aussi. Deux familles d'images l'appellent et aucune ne la possède : elle est passée dans
`atelier/image/mesures.py`, où elle ne parle que d'octets.

**L'écran a quand même été ouvert, et il a rendu un défaut qu'aucun essai ne pouvait voir.**
Les commandes d'import prenaient 151 px dans la barre d'outils et poussaient le bloc de gauche
32 px au-delà de sa largeur à 1280 : le cran de zoom 4× sortait de l'écran. La bascule dit
maintenant **brute / traitée** — le vocabulaire que la fiche emploie déjà pour le brut et le
rendu — et le groupe tient en 109 px, débord nul. Une largeur ne se prouve pas dans jsdom, qui
ne met rien en page ; elle se mesure dans un navigateur, ou elle ne se mesure pas.

**La séance d'usage complète n'a pas encore eu lieu**, pour R2 comme pour R3.

## État au 29 août 2026

**R2 est écrite — ce qui décide de l'apparence se voit et se règle.** C'est la plus grosse des
quatre reprises, et la seule qui touche à la fois au prompt, à l'univers et à la fiche. Un
dépliant sous le champ de prompt montre le texte exact qui partira — bible active, sujet,
consignes de planche —, et un geste le bascule en édition libre pour cette génération-là. La
bible passe de cinq champs nommés à sept : la technique de rendu et la vue et cadrage, qui
étaient exactement les deux consignes retapées dans chaque prompt le 28 août. La taille de
pixel accepte « aucune ». Et la fiche dit enfin ce que le projet a imposé à l'image affichée.
**Les treize critères sont cochés, tenus par 20 essais de serveur et 9 d'écran.**

**Le défaut réparé est un défaut de composition, pas de code**, et c'est la troisième fois que
le dépôt en trouve un — après la toile de T9 et le réglage d'univers de R1. « La dérive de
grille est le cas normal, pas l'incident » est juste. « Le style vient de la bible, et d'un
seul endroit » est juste. Ensemble, elles produisaient un atelier qui **imposait une apparence
que l'auteur n'avait jamais posée** : la séance du 28 août l'a mesuré sur trois projets réels
— les cinq champs de bible vides dans les trois, donc rien du style ne partait, et pourtant
tout ressortait en pixel art de 64 pixels. Aucun test ne pouvait le voir : les deux moitiés
faisaient exactement ce qu'on leur demandait.

**Un seul endroit compose le prompt, et l'aperçu emprunte ce chemin-là.** C'était la décision
de conception de la tranche, et elle a coûté un aller-retour local par frappe — atténué de
140 ms, sans réseau, sans écriture. L'alternative aurait été de recomposer à l'écran : deux
compositions qui divergent au premier champ ajouté, et celle qu'on regarde n'est pas celle qui
part. L'essai qui le tient ne compare pas l'aperçu à lui-même mais **à ce que le fournisseur a
reçu** — un aperçu vérifié contre sa propre logique ne prouverait que sa propre logique.

**Elle a réparé un défaut que personne n'avait signalé.** « Reprendre les réglages » d'un asset
reposait dans le champ de l'atelier le prompt **déjà habillé** — bible comprise —, que l'atelier
rhabillait ensuite : la bible partait en double, à chaque reprise, depuis T4. Le geste rend
désormais la main à l'auteur en mode repris, donc ce qui repart est exactement ce qui était
parti. Personne ne l'aurait trouvé sans écrire le mode repris : il fallait que les deux
chemins existent pour que leur composition devienne visible.

**« Aucune » est une valeur, pas un réglage éteint**, et le dire ainsi a décidé du code : zéro
est traité **à part** du contrôle de bornes plutôt qu'en élargissant le minimum, sans quoi 1, 2
et 4 pixels seraient passés. Sans cible, la grille **disparaît** de la recette au lieu de valoir
zéro — un asset ne doit pas porter une remise sur grille que le projet n'impose plus —, et
« Tout réaligner » la retire donc au lieu d'en poser une, en le disant avec son compte.

**Et ce que le projet impose se calcule, il ne se range pas.** La fiche demande « qu'est-ce que
le projet impose *maintenant* » : une valeur enregistrée à la naissance aurait vieilli au premier
réglage d'univers, et la fiche aurait comparé l'image à un souvenir. C'est une route à part de
l'asset, parce que la grille en affiche deux cents à la fois pour une phrase que seule la fiche
montre — le même raisonnement que la réserve de T8, un cran plus bas.

**La séance d'usage au navigateur n'a pas encore eu lieu**, et la règle du dépôt tient : *une
tranche n'est finie que lorsqu'on s'en est servi*.

## État au 28 août 2026

La chaîne de cadrage est finie — PRD, architecture, design, plan — et **le code a
commencé**. `docs/PLAN.md` fait foi sur ce qui reste.

**T1, T2, T3, T4, T5 et T6 sont finies.** T1 : le squelette, la clé, le catalogue relu au
démarrage, un appel qui rend une image téléchargeable ; l'écran Atelier ; le flux
d'événements qui remplace le sondage, la jauge déterminée, la reprise vue du navigateur et
le repli hors ligne. T2 : l'asset, la recette, le rendu-cache, le détourage en plusieurs
passes, la remise sur grille, la quantification grisée, les recettes nommées, et la fiche.
T3 : la bibliothèque — projets et collections, une seule grille filtrable et cherchable, la
sélection multiple, le favori, la suppression avec son annulation courte, la filiation, le
journal des appels ratés, la réinjection dans ses quatre rôles, et l'index reconstructible.
T4 : le tableau d'inspiration et l'univers — coller une image, une adresse ou un texte,
promouvoir en artwork officiel par famille, la palette extraite par calcul, la bible en
champs nommés, le barème d'échelles, la taille de pixel imposée, la quantification allumée,
et la palette rétroactive. T5 : le slicer — les zones opaques connexes, la grille fixe, les
rectangles dessinés à la main, la filiation de découpe ; **plus les deux dettes reportées**,
le zoom de la grille et la première exécution du second moteur de détourage. T6 : l'export —
une sélection qui sort en archive avec son descriptif, et le grisé permanent qui dit
pourquoi quand rien n'est sélectionné. **Les soixante et onze critères d'acceptation de T1 à
T6 sont cochés dans `docs/PLAN.md`, et 120 tests de serveur plus 31 d'écran les tenaient.**

**T7 est finie, et la V1 avec elle.** Le MCP : onze outils épais, façade sur les services que
l'écran appelle déjà, montés dans le **même processus** que l'API sur `/mcp` ; les deux
garde-fous relus à chaque appel — plafond de la séance, modèle d'exploration imposé — ; le
dossier du jeu et ses trois règles ; la provenance portée par la génération et héritée par
l'asset ; et l'écran Réglages qui tient enfin les trois questions promises depuis T1 — clé,
garde-fous, dossiers. **Les quatre-vingt-quatre critères d'acceptation de T1 à T7 sont cochés
dans `docs/PLAN.md`, et 145 tests de serveur plus 35 d'écran les tiennent.**

**Ce qui vient après n'est plus la V1, et T8, T9 et T10 sont finies.** T8 : le tableau
d'inspiration a sa seconde vue — un plan qu'on déplace et qu'on zoome, des îlots nommés, une
réserve à droite. T9 : ce que T8 permet de ranger, T9 permet de le **dire** — un trait d'un objet à
un autre, une note posée à même la toile, et six teintes sourdes. T10 : deux décisions de T8 que
l'usage a démenties — un îlot se **déplace** par la bande de son titre, avec ce qu'il contient, et
un îlot que le geste en cours ferait disparaître le dit en `--echec` pendant qu'on le fait. **Les
cent quinze critères d'acceptation de T1 à T10 sont cochés dans `docs/PLAN.md`, et 195 tests de
serveur plus 80 d'écran les tiennent.** Le plan n'a plus de tranche ouverte.

**C2 est écrite — le lot plié.** On coche des attitudes, elles partent en **un seul appel**, et
la planche se déplie toute seule en autant d'images de corps qu'il y avait de cases. Neuf poses
coûtent un appel au lieu de neuf, et le journal du projet le montre. Si le compte ne tombe pas
juste, **rien n'entre** et le lot se relance d'un geste, au prix plein — c'est le seul refus
automatique du produit, et il est arithmétique. Ressemblance entre cases et dérive de grille
s'affichent case par case et n'empêchent jamais de garder. **Les douze critères sont cochés,
tenus par 34 essais de serveur et 6 d'écran** ; la séance d'usage au navigateur, elle, n'a pas
encore eu lieu, et la règle du dépôt tient — *une tranche n'est finie que lorsqu'on s'en est
servi*.

**Le pliage n'a pas été écrit pour les personnages, et c'est la décision de la tranche.** Il vit
dans un module pur et un service qui ne connaissent ni personnage ni pose : ils parlent de
*cases*, et c'est le service de génération — le seul qui sache déjà relier un appel à une case
— qui les compose. C3 le réemploiera tel quel pour la planche d'équipement, sans le rouvrir.

**Il a été éprouvé sur les vingt-quatre planches réelles du 28 août avant qu'une ligne de
service soit écrite**, et il y trouve exactement le compte que le banc avait mesuré — zéro écart
sur vingt-quatre. C'est l'antidote direct au piège de C1 : *un double écrit d'après l'intention
prouve l'intention, pas le serveur*. Le même passage a donné ce que le produit affiche sans
inventer de seuil — les deux planches qui répétaient une pose ressortent à 0,999 et 1,000, les
vingt-deux autres plafonnent à 0,897.

**Trois choses ont été tranchées en écrivant, et elles se paient toutes de la même façon** : la
planche payée n'est **pas** un asset — elle reste le brut de sa génération, donc « aucune feuille
assemblée n'est livrable » est vrai par construction et non par un filtre —, le gabarit ne
s'enregistre nulle part mais compte comme une référence, et un compte faux est un emplacement
échoué, ce qui rend la relance de T1 applicable telle quelle sans inventer d'état. Le prix des
trois est écrit dans `docs/PLAN.md` : les N corps n'ont pas de parent, on ne voit pas ce qui
revient quand le compte tombe faux, et un lot refusé n'est relançable que dans l'onglet qui l'a
vu échouer.

**Et la privation de C1 a tenu.** La matrice gagne une case à cocher par rangée, et elle
n'offre toujours pas de sélection multiple : ce qui se coche est une **attitude**, pas une
image. Un essai d'écran confronte l'intitulé de chaque coche à sa forme et tombe le jour où
l'une passera sur une vignette.

**C1 est finie, et la V2 a commencé.** Le personnage, son plan, une pose, et ce qui part avec
elle. Un jeu porte **une** liste d'attitudes — repos, marche, mort —, écrite une fois et déjà
là au premier lancement ; chaque personnage coche celles qu'il tient, se décrit une fois, et
sa matrice dit d'un coup d'œil ce qui est fait et ce qui manque. On arme une pose depuis une
case vide, on paie depuis l'atelier. Une carte du tableau se désigne concept art et **reste où
elle est** ; avant de lancer, chaque référence se lit ligne par ligne avec sa provenance, et
se décoche pour cette génération, pour ce personnage, ou pour tout le projet. Et n'importe
quelle fiche nomme enfin le modèle qui a produit son image. **Les cent trente-trois critères
d'acceptation de T1 à C1 sont cochés dans `docs/PLAN.md`, et 233 tests de serveur plus 105
d'écran les tiennent.**

**Quatre décisions de construction, et trois défauts trouvés en s'en servant.** Les décisions
sont dans `docs/PLAN.md` § C1 et `docs/ARCHITECTURE.md` §7 : un seul plan par projet, le
personnage qui range **ce qu'il écarte**, la case déduite des images plutôt qu'enregistrée, et
le coût annoncé **mesuré** au lieu d'être lu dans un tarif que le produit ne porte pas.

Les défauts, eux, viennent tous de la même racine, et c'est une racine neuve : **un objet qui
voyage par deux routes doit avoir la même forme sur les deux.** Le personnage porte des cases
*déduites*, et seul le tableau de bord les mettait dans sa charge — la réponse du `PUT` et
l'annonce du flux rendaient le même objet sans elles. Or l'écran fond ce qu'il reçoit par les
deux chemins avec le même code, depuis T1 : écrire une description remplaçait donc un
personnage entier par un personnage à trous, la matrice se vidait, et le rendu suivant tombait
sur un écran blanc. **La fonte par identifiant ne protège que de l'empilement** ; elle suppose
que les deux chemins portent la même chose, et personne ne l'avait écrit. Le même défaut vu de
l'autre bout : élargir la portée d'un décochage écrivait bien sur le disque, mais rien ne
redemandait ce qui part. Et le troisième était une **copie périmée** — la case visée gardait
l'objet du moment où on l'avait armée ; elle ne garde plus qu'un identifiant.

**Ce qui les avait rendus invisibles mérite d'être écrit** : le double des essais d'écran, lui,
rendait la forme entière. Je l'avais composé en sachant ce que le serveur *devait* faire, et
les 105 essais passaient donc au vert sur un contrat que personne ne tenait. *Un double écrit
d'après l'intention prouve l'intention, pas le serveur.* Les trois sont dans `docs/PIEGES.md`.

**Et écrire le motif d'écran a corrigé le code une quatrième fois, puis deux.** Le nom d'un
personnage était en serif 24 px dans un champ, ce que la règle 1 du § Typography interdit en
deux mots ; l'état vide de la colonne de droite répétait en mono l'explication déjà posée à
gauche ; et un commentaire promettait un bouton grisé que le code, avec raison, ne posait pas.
Trois riens — mais chacun n'a été vu qu'en écrivant *pourquoi c'est comme ça*, ce qui est
exactement à quoi sert `docs/design-motifs.md`. La section « L'écran Personnages » les porte.

**T10 a été utilisée pour de vrai, et ça a trouvé quatre défauts.** Huitième fois de suite, et trois
des quatre de la même racine : *une surface que le produit tient à la main, et qui n'avait pas dit à
la librairie de plan qu'elle lui appartenait*. Tirer un îlot par sa bande déplaçait l'îlot **et** le
plan du même écart — l'îlot à deux fois la main, le fond à une fois, c'est-à-dire une **parallaxe**
sur la seule surface du produit dont tout le propos est de savoir où sont les cartes. La poignée de
largeur, le menu de teintes et le champ d'une note avaient le même trou, et `nodrag` était là, qui
paraissait suffire. S'y ajoutait le déplacement automatique de la librairie dès qu'un nœud tiré passe
à moins de 40 px d'un bord, la réserve étant collée au bord droit. Le quatrième est ailleurs : le
menu de teintes d'un îlot était **inatteignable à la souris**, le pointeur qui montait vers lui
quittant la bande, seule surface qui le tenait ouvert. `docs/PLAN.md` § T10 dit pour chacun ce qui
l'avait rendu invisible.

**Un îlot se déplace, et ça ne fait pas de lui un objet.** Il n'a toujours ni identité, ni fichier,
ni position à lui : le déplacer, c'est écrire la place de chacune de ses cartes, en **un seul
appel** (`PUT /api/board/groups/move`). Un appel par carte rendrait possible l'état où sept ont
bougé et cinq sont restées — c'est « deux appels pour un geste sont un état de trop » appliqué à un
geste qui en aurait demandé douze. La route exige donc **toutes** les places de l'îlot et rien
d'autre, les vérifie avant d'écrire la première, et ne reclasse rien : déplacer un rangement, ce
n'est pas ranger ce qu'il contient.

**Un lien est le seul objet neuf du modèle depuis T4, et il naît muet.** Ni mot, ni pointe : un
trait nu dit déjà « ceci a rapport avec cela », et c'est le cas courant — *le défaut est muet,
l'exception s'exprime*. Une extrémité est une carte par identifiant **ou** un îlot par nom de
groupe, et le couple `(genre, valeur)` existe parce que les deux ne se nomment pas dans le même
espace. Il ne survit pas à ses extrémités, et c'est la **suppression** qui l'emporte, jamais un
balayage : un trait vers rien ne représente rien, et une entrée morte sur le disque serait une
deuxième vérité qui attend son heure.

**La teinte d'un îlot vit sur le projet, jamais dans son univers ni sur ses cartes.** Sur ses
cartes, six membres feraient six vérités possibles pour un seul cadre. Dans `Univers` — « ce que le
projet impose à ce qui rentre, et ce qu'il envoie avec » —, elle aurait été le premier champ à
démentir cette phrase : une teinte n'impose rien et ne part nulle part. Une **note**, elle, *est* un
objet et porte la sienne. Une carte image n'en porte aucune, et c'est un critère : colorier chaque
carte reconstruirait un second rangement, concurrent du groupe.

**Une revue adversariale a suivi la tranche, et elle a trouvé quatre défauts de plus.** Vingt-quatre
trouvailles sur cinq lentilles, chacune soumise à **trois sceptiques chargés de la réfuter** ; six
ont survécu, dont quatre disaient la même chose. La plus utile ne portait pas sur le produit mais
sur ce qui est censé le garder : *un essai passait pour une autre raison que celle qu'il annonçait*
— la borne du mot d'un lien était éprouvée sur une paire déjà jointe, donc le refus rendu était
« ces deux-là sont déjà joints », et l'essai aurait passé même si la borne n'existait pas. **Une
assertion négative ne prouve rien**, encore, et cette fois-ci sur nos propres essais.

**T9 a été conçue par un panneau avant d'être écrite, et ça a trouvé le défaut le plus grave.**
Trois conceptions indépendantes des quatre gestes ouverts, trois juges — les documents, l'usage, les
pannes —, et le verdict a nommé un état que ni le serveur ni l'écran n'auraient signalé : *sortir la
dernière carte d'un îlot efface ses liens et sa teinte, et Ctrl+Z ne rendait que le groupe*. Chacun
des deux gestes est correct isolément ; c'est leur composition qui perdait quelque chose, en
silence. Première fois que ce dépôt fait ça, et à refaire.

**La toile ajoute deux champs à la carte, et pas une entité.** `position` et `largeur_libre`
sont portées par la carte elle-même — un `toile.json` par projet aurait la panne qui a déjà
valu son refus à `cartes.json`, et sur une toile ce n'est plus une hypothèse mais le régime
normal. Elles s'écrivent par la route qui portait déjà le groupe : tirer une carte dans un
îlot écrit sa place **et** son groupe, et deux appels rendraient possible l'état où l'un est
écrit et l'autre non — la divergence que toute la tranche est là pour empêcher.

**Un îlot n'est écrit nulle part : il est l'étendue de ses membres.** Un îlot *est* le
groupe, donc il n'a ni identité, ni fichier, ni position à lui, et l'écran le calcule à
chaque rendu. Il n'existe aucun état où la toile montrerait un rangement que le disque ne dit
pas, et un îlot vide n'existe pas faute de quoi l'écrire. `docs/ARCHITECTURE.md` §6.5
annonçait `parentId` + `extent: "parent"` : ce mécanisme *enferme* un enfant dans son parent,
donc il interdit très exactement « sortir une carte de son îlot ». Le document a été corrigé.

**T8 a été utilisée pour de vrai, et ça a trouvé cinq défauts.** Septième fois de suite.
Trois de la famille qui revient depuis T5 — *une règle déléguée à autre chose, dont personne
n'a mesuré le résultat* — dont deux fois le même `ResizeObserver` : la librairie de plan
cache un nœud dont elle ignore la taille, et elle l'apprend par lui, si bien que **toute la
toile était invisible dans un onglet d'arrière-plan** ; et son cadrage d'ouverture renonçait
en silence pour la même raison. Deux d'une famille neuve — *un garde juste dont l'hypothèse
est fausse* : Ctrl+Z n'annulait rien parce qu'il voyait un champ de saisie actif, celui du
prompt de l'atelier, resté focalisé **derrière** l'écran Univers qui le couvre. Le tableau
de `docs/PLAN.md` § T8 dit pour chacun ce qui l'avait rendu invisible.

**Le produit a été utilisé pour de vrai à chaque fin de tranche, et c'est ce qui a trouvé
presque tous les défauts.** T9 : six, dont cinq en s'en servant — et **le sixième, le plus grave,
trouvé avant la première ligne de code** par un panneau de conceptions mises à juger l'une contre
l'autre. C'est le seul de toute l'histoire du dépôt qu'aucun essai n'aurait pu voir *ni* aucune
séance : les deux gestes qui le composent sont corrects isolément. T8 : cinq de plus, dont trois
qu'aucun essai d'écran ne pouvait voir —
jsdom ne met rien en page, donc un nœud caché par la librairie y est rendu comme un nœud
visible. T1 : l'écran doublait chaque génération lancée depuis l'onglet. T3 :
cinq de plus, dont deux venaient de la même racine — deux vérités sur la même chose
finissent par diverger. T4 : deux, dont un compte de références qui ne se remettait pas à
jour quand on promouvait un artwork. T5 : trois, tous de mise en page, dont deux de la même
famille — **une règle déléguée au navigateur dont personne n'a mesuré le résultat**. T6 :
deux, de cette même famille, et **tous les deux antérieurs à la tranche qui les a trouvés**.
**Aucun test de serveur ne pouvait les voir**, et les tableaux de `docs/PLAN.md` § T3, § T4,
§ T5 et § T6 disent pour chacun ce qui l'avait rendu invisible. C'est désormais une règle du
dépôt : **une tranche n'est finie que lorsqu'on s'en est servi.**

**Une planche se découpe, et chaque morceau est un asset entier.** Le serveur *propose* des
rectangles — zones opaques connexes, ou grille fixe —, l'auteur corrige, et ce qui part à la
découpe est **sa** liste. Chaque découpe possède ses propres octets bruts, hérite de la
recette de sa planche et pointe vers elle par sa filiation. Elle possède ses octets pour une
raison précise, et ça se paie en disque : **supprimer la planche doit laisser ses découpes
en place**, or la suppression définitive efface `<rang>-*`, brut compris.

**Et ça a été vérifié sur une vraie planche, payée** (`essais/essai_decoupe_planche.py`,
$0,0042) : huit personnages demandés à `gpt-image-2` en 16:9, huit zones trouvées — ni sept
ni neuf —, dans l'ordre de lecture, chacune devenue un asset de 64 px détouré et filié. Ce
qui manquait aux tests, c'était exactement ça : **une planche que personne n'avait disposée
pour la détection**. Corollaire observé, qui n'est pas un défaut : une planche naît
**habillée comme un sprite**, donc sa tuile montre huit personnages écrasés dans 64 × 64 —
c'est le brut qui se découpe, et rien dans la grille ne dit qu'une image est une planche
avant qu'on ouvre sa fiche.

**Une sélection sort de l'atelier, et elle emporte de quoi se relire.** Une archive, un
`descriptif.json` à sa racine, et rien d'autre : pour chaque image, son label, le prompt et
les réglages résolus de l'appel qui l'a produite, les dimensions **mesurées sur le fichier
qui part**, sa filiation, et sa recette avec son empreinte. Ce qui part est le **rendu** —
celui qu'on voit, celui qui entre dans le jeu —, jamais le brut, qui reste ici : c'est lui
qui permet de refaire le rendu, et le descriptif dit lequel il est. Corollaire assumé : un
asset qu'on n'a pas traité sort tel qu'il est arrivé, donc en 1024 px à côté de sprites de
64 — c'est la même phrase appliquée jusqu'au bout, et le descriptif porte les deux
dimensions.

**L'écran tient ses quatre colonnes.** `docs/DESIGN.md` § Layout donne
`240px · 300px · 1fr · 380px` — arbre · réglages · prompt+grille · fiche. Les trois
premières sont permanentes et repliables **par choix** ; la quatrième s'ouvre avec la
sélection d'une image et se referme sur la position, le filtre et le prompt d'avant.

**La grille est faite d'assets, et le chantier y tient sa place.** Un emplacement qui n'a
pas encore donné son asset occupe la case sous **la même clé** — `<génération>-<rang>`,
l'identifiant que l'asset portera —, si bien que l'image ne se glisse pas à côté de son
attente : elle la remplace. Un échec occupe sa place tant qu'on le regarde, mais il ne
s'installe pas : la bibliothèque relue ne le contient pas, et le journal du projet garde
l'appel avec son coût réel.

**La palette se lit sur le sujet, jamais sur le fond.** La coupe médiane appliquée aux
artworks tels quels rend vingt gris sur vingt-quatre : le fond plat occupe 75 % des pixels
et son anti-crénelage l'éclate en autant de seaux. `atelier/image/palette.py` détoure donc
d'abord, avec le moteur du geste courant, et la palette passe à quinze couleurs franchement
distinctes. *Ce qui est majoritaire n'est pas ce qui compte* — la même phrase que pour le
détourage au seuil global.

**L'univers est porté par le projet, et il contraint.** Bible en cinq champs nommés,
chacun activable ; barème d'échelles, où une nature de sujet porte **sa famille et son
occupation à la fois** — c'est ce qui garde un seul contrôle au moment de générer ; taille
de pixel imposée à tout ce qui rentre ; modèle par défaut **par famille** ; et la palette,
qui est un cache nommé par l'empreinte des artworks qui l'ont produite. Un univers vide ne
contraint rien : c'est un état, pas une configuration manquante.

**Deux risques ont été levés, aucun n'a coûté un centime.** « La couverture image
d'OpenRouter » (`essais/essai_couverture.py`) : 48 modèles image, 11 fournisseurs, 31
acceptent assez de références pour un univers. « La qualité pixel art directe »
(`essais/essai_pixel.py`) : sur 44 images de six modèles, **aucune sortie brute n'a de
transparence**, la médiane est à 33 986 couleurs, et la grille rendue va de 7 à 20 px —
facteur 2 à l'intérieur d'un même lot. Après traitement : 27 couleurs, alpha franc, grille
imposée, 0 sujet perdu sur 44, 0,17 s par image. **La question s'est retournée** : le
post-traitement n'est pas un supplément qui doit prouver son apport, c'est ce sans quoi
rien n'est utilisable.

**Le détourage par défaut n'a besoin d'aucun modèle.** Un remplissage depuis le bord — un
pixel n'est du fond que s'il est *relié au bord* par une chaîne de pixels proches de la
couleur de bordure — rend une silhouette propre sur les 44 images, squelette blanc sur fond
gris clair et fioles translucides compris. `rembg` reste un **second** moteur, facultatif
(`uv pip install -e ".[detourage]"`), grisé avec sa raison quand il n'est pas là. Le geste
courant ne charge rien, ne télécharge rien, et marche hors ligne.

**Ce chemin-là a été exécuté le 27 août 2026, et il a retourné une décision.**
`essais/essai_detourage_modele.py` compare les deux moteurs sur six vraies images plus un
cas composé. Sur ce que le produit fabrique — fond plat —, les deux **s'accordent à 96,3 %**
en médiane : le second n'apporte rien, et c'est ce qui justifie qu'il reste facultatif. Sur
un fond chargé, le bord garde **100 %** de l'image — il échoue entièrement — quand le modèle
en isole 19,8 % : c'est sa raison d'être, et elle se mesure. Il coûte 482 ms contre 147.
**Le modèle est nommé, jamais laissé au défaut de la bibliothèque** : le défaut de `rembg`
2.0.81 est `bria-rmbg`, un gigaoctet qui met 15,8 s par image de 1024 px sur processeur,
là où `u2net` met 0,47 s pour deux points d'écart. Le « ~180 Mo » écrit ici depuis T2 était
la taille d'`u2net`, et le défaut avait changé sous cette note.

**Deux choses ont rendu l'exécution possible, et elles se disent.** `raison_moteur` cherche
désormais le paquet avec `find_spec` au lieu de l'importer : demander « faut-il griser ce
bouton ? » ne charge plus `onnxruntime`, et `tests/test_t2.py` — qui vérifie qu'aucune
bibliothèque d'inférence n'entre dans `sys.modules` pendant une retouche — tient sur une
machine où le second moteur est installé. Et le test qui le concerne a désormais un
symétrique : l'un vaut quand le moteur manque, l'autre quand il est là, et il y en a
toujours exactement un des deux qui travaille.

**L'interface ne redemande plus rien, et elle se branche une seule fois.** Un abonnement
par onglet, pour toute sa vie : ni le filtre, ni le projet ouvert, ni les proportions, ni
l'écran Univers ne le font se rebrancher. Les seuls appels qu'elle refait d'elle-même sont
le catalogue — parce que le grisé de chaque modèle dépend de la demande en cours —, la
grille quand un filtre change, et le tableau quand le projet ouvert change, parce que c'est
le serveur qui filtre et que le tableau appartient à son projet.

**Et « la demande en cours » a grandi en T4** : elle porte désormais les artworks que
l'application ajoute seule. Promouvoir une carte change donc ce qui partira sans que
l'écran ait touché un réglage — d'où le catalogue redemandé sur l'événement `univers`.
C'est le défaut trouvé en ouvrant l'atelier le 27 août : **une règle juste dont l'hypothèse
a changé sous elle**.

**Un agent fait exactement ce que l'écran fait, et rien de plus.** Onze outils, aucun geste
propre : ça se lit dans les **imports** d'`atelier/mcp/serveur.py` — ni fournisseur, ni base,
ni disque —, et un essai le garde. Le seul geste que les services ne savaient pas faire était
« faire entrer un fichier local » : il a été écrit dans `services/`, avec sa route HTTP, pas
dans le MCP. Un import passe par une **génération** — modèle `import`, coût nul — parce que la
bibliothèque se reconstruit en parcourant les `generation.json` : sans le sien, un asset
importé disparaîtrait à la première évolution du schéma.

**La consommation de l'agent se lit sur les générations, elle ne se tient pas en double.** Le
chiffre du refus opposé à l'agent et celui que l'auteur lit pour relever le plafond sont le
**même calcul** — deux compteurs auraient fini par se contredire au moment précis où l'on
cherche à comprendre. Le coût des appels **ratés** y est compris : c'est justement celui-là
qu'on cherche. « Par séance » veut dire depuis l'ouverture de l'atelier, et le remettre à zéro
est un geste déjà connu — fermer la fenêtre.

**T7 a été branché pour de vrai, et ça a trouvé trois défauts.** Sixième fois de suite.
**Aucun agent ne pouvait se brancher** : `POST /mcp` répondait 405, parce que le montage et le
SDK posaient chacun leur préfixe — l'adresse réelle était `/mcp/mcp`. Corrigé, `/mcp`
répondait *encore* 405 : un montage Starlette ne reconnaît que `/mcp/…`, et le chemin exact
tombait chez les fichiers statiques. Et `localhost` était refusé en 421 par la protection
contre le réattachement DNS, dont le défaut n'autorise qu'`127.0.0.1`. **L'essai qui aurait dû
les voir vérifiait « ni 404, ni page d'accueil »** — or 405 n'est ni l'un ni l'autre : *une
assertion négative ne prouve rien d'un protocole*. Il ouvre désormais une vraie session et
vérifie les deux écritures de l'adresse.

**Le produit s'explique lui-même, et le corpus a été regardé à l'œil.** 46 entrées à l'époque, quatre
écrans, deux rendus — le panneau de 280 px et l'écran Guide —, un seul manque déclaré, et
c'est le guide qui le tient. La revue de l'atelier lancé a mesuré **trente poignées sur les
quatre écrans** et trouvé un défaut de la famille habituelle : « Proportions » réagissait
208 px à droite de son mot quand « Modèle », dans le même panneau, ne réagissait que sur les
siens — un `<span>` blockifié par son parent flexible et étiré par une colonne. Corrigé sur
le gabarit, remesuré à zéro partout. Et le guide a rendu un second écart, dans l'autre sens :
sa colonne de prose fait **468 px et 72 signes**, pas les « 504 px / 74 signes » que
`docs/DESIGN.md` annonçait — l'écran avait raison, le document a été corrigé. Les deux sont
dans `docs/PIEGES.md`.
