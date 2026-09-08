# Asset Kitchen — État du dépôt

Le journal de ce qui a été construit, tranche après tranche, et de ce que chaque tranche a
appris. **Il ne fait foi sur rien** : `docs/PLAN.md` dit ce qui reste, `docs/PRD.md` ce que
le produit doit faire, `docs/ARCHITECTURE.md` comment il est construit. Ce fichier-ci ne fait
que raconter, et il se lit dans un seul cas — **quand on veut savoir pourquoi c'est comme ça
plutôt qu'autrement**.

Il ne se lit pas au démarrage d'une session. Une tranche neuve n'a pas besoin de l'histoire
des dix précédentes ; elle a besoin de `docs/PLAN.md` et de `docs/PIEGES.md`.

Une entrée s'ajoute à chaque fin de tranche. Les plus récentes en tête.

## V4 · B16 — les tables dans la grammaire du carnet — 9 septembre 2026

**La chaîne de retouche redessinée, et aucun moteur ajouté.** Une barre horizontale de huit
tables dans l'ordre du domaine, un trait, puis les deux fabriques. L'image seule à gauche, les
réglages **hors de l'image** dans la colonne de droite, la jauge sous l'image, le témoin
*avant · les deux · après* au-dessus. La logique est empruntée à ce qui existe — `useRecette`
et `useMesures` de `Places.tsx`, `valeur`/`indisponible` de `Tables.tsx`, la courbe de la jauge
de `chassis.tsx` — pour qu'il n'y ait **qu'une vérité par fait**.

**La vraie tranche était ailleurs : six contradictions à trancher comme des décisions de
produit.** Le détail de chacune est dans `docs/tranches/V4.md`. Les deux qui ont changé le
domaine :

⚠️ **La marge du recadrage se grisait sur une condition fausse.** L'écran testait
`recette.grille != null`, et se trompait dans trois cas : une grille endormie, une grille sans
détourage vif (le calcul fait alors une homothétie sur toute l'image, et la marge agit), et
l'inverse. La condition est descendue dans le domaine — `Recette.marge_sans_effet()` —, là où
la neutralisation a lieu, et le serveur la rend avec les mesures. **C'est le serveur qui
coupe, jamais l'écran** ; deux dérivations d'une même règle finissent toujours par ne plus
s'accorder.

⚠️ **Un seuil de nettoyage à zéro faisait une recette non vide.** Donc un rendu calculé, mis
en cache, et un asset épinglé — pour une image identique au brut, à l'octet près. `Recette.vide`
suit maintenant l'invariant `E3` : *une place compte quand elle change l'image, pas quand elle
figure dans la recette*. Ce n'est pas la veille : éteindre garde la valeur, ici la valeur
elle-même ne fait rien.

**Ce que le navigateur a trouvé et que 1 000 essais d'écran ne voyaient pas** — cinq défauts,
tous corrigés : une valeur écrite deux fois, une image trop petite pour montrer quoi que ce
soit, une raison de grisé enfermée dans une infobulle (ce que la règle 2 du design interdit
en toutes lettres), une barre qui s'annonçait par ses phrases au lieu de ses noms (un `title`
sur un bouton **devient** son nom accessible), et un grossissement affiché qui n'était pas
appliqué. Les essais d'écran cherchent un texte ; le texte était toujours là.

**Et le plafond avait deux moitiés.** Monter la borne de la route de 512 à `CIBLE_MAX` ne
servait à rien tant que la table ne proposait que les dix tailles du pixel art : un jeu en
dessin réglé sur 1 024 n'avait aucun cran à cliquer. La table lit maintenant le style du jeu.
C'est exactement la panne que `test_e8` avait fermée le 31 août pour l'autre liste, rouverte
un cran plus haut — et la liste neuve est tenue contre le domaine par un essai, comme l'autre.

⚠️ **L'écran neuf double l'ancien, il ne le remplace pas.** `EcranTables` garde trois
locataires que cette tranche n'a pas mandat de déménager : le cadre de découpe qui se monte
dedans, la colonne des sœurs, et les trois surfaces où l'on pose une coordonnée. L'écran neuf
les montre et dit qu'elles ne voyagent pas ; il ne les pose pas. C'est le traitement réservé à
la matrice par `B10`.

## V4 · B15 — l'installation — 9 septembre 2026

**Ce qu'on branche une fois sur cette machine a enfin un écran** : le compte et la clé, ComfyUI,
le dossier de travail, ce que le disque porte. Quatre étapes, deux modes — `Installation.tsx`
reprend sans le discuter le motif de `B14` : en première ouverture il prend la fenêtre entière
et s'ouvre tout seul sur un atelier neuf jamais visité ; rouvert par le pied du carnet, il
s'ouvre sur le sommaire des quatre, carnet visible.

**C'était la seule tranche du plan qui pose un secret et qui écrit sur le disque de quelqu'un**,
et c'est ce qui a commandé chaque arbitrage.

⚠️ **On choisit un dossier, on ne déménage rien.** Trois façons de tenir le geste, et la plus
élégante était la pire : `shutil.move` sur des gigaoctets, avec une base SQLite ouverte dessus,
sur Windows, pendant que le serveur tourne — un échec au milieu laisse la moitié des images d'un
côté et l'index de l'autre. Ce qui est fait à la place : **poser une adresse**, que l'atelier lit
au démarrage suivant. Rien ne bouge, rien ne s'efface, l'ancien dossier reste où il est, et
revenir en arrière c'est retaper l'ancien chemin. L'écran montre les deux chemins pour qu'une
copie à la main soit évidente. Trois essais mesurent des **absences** — rien de déplacé, rien de
copié, rien d'effacé, et **aucune route d'installation qui efface**, lu sur la table de routage
et non sur une intention.

⚠️ **L'adresse de ComfyUI ne se changeait pas du tout.** Un commentaire de
`atelier/fournisseur/maison.py` promettait `ATELIER_COMFY` depuis six jours ; la variable n'était
lue nulle part, et `_maison()` construisait le moteur sans argument — adresse en dur. Elle se
règle maintenant par l'écran ou par l'environnement, et **prend effet sans redémarrer** :
`MoteurDeLaMaison` est le seul adaptateur gardé du dépôt (pour le grisé et le premier tirage), et
`_maison()` compare son adresse à celle des réglages pour ne le refabriquer que si elles
diffèrent — donc jamais dans le cas normal.

**Rien ne s'efface, nulle part.** Le *Vider les rendus* de la planche n'est pas construit : le
disque se **mesure**, poste par poste, en séparant ce qui a été payé de ce qui se refait tout
seul, et l'écran écrit ce qu'un nettoyage libérerait. Une suppression de masse pilotée par un
glob est exactement le geste que `docs/PIEGES.md` a déjà payé une fois, aucun critère ne la
demande, et elle mérite sa tranche et ses essais à elle.

**Trois des six critères étaient déjà tenus, et déjà mesurés, avant la première ligne** — le
grisé par fournisseur (`F1`), le retrait d'une clé qui n'efface ni image ni dépense (`F3`),
l'image qui arrive sans aucune clé (`F1`). Ils sont cités dans l'en-tête de `tests/test_b15.py`
plutôt que redoublés : deux jeux d'essais sur le même fait finissent par ne plus dire la même
chose.

⚠️ **Le navigateur a trouvé six choses qu'aucun essai ne voyait**, sur `atelier_jetable_b15.py`.
Deux fautes de français composées à partir d'un titre — *« Revenir à les images »*, *« Passer à
les images »* : chaque étape porte maintenant ses deux phrases écrites à la main, parce que le
français n'a pas de règle qui se calcule sans le genre et l'article. Un point décimal anglais à
deux lignes d'une virgule française — *« il manque 26,5 Go »* puis *« 8.7 Go »* : le serveur met
la virgule dans ses phrases et rend ses nombres nus. Une licence promise par le nom d'un essai
et jamais affichée — elle est pourtant la question qu'on se pose **avant** de télécharger, parce
que ce qui descend là finira dans un jeu vendu. *« Descendre les 1 fichiers »*. Et surtout : le
dossier **en service** affiché sous l'origine du **réglage**, si bien qu'entre le clic et le
redémarrage l'écran montrait l'ancien chemin avec la phrase « il a été choisi ici ». Chacune des
deux valeurs, prise seule, était juste — c'est leur assemblage qui mentait, et il ne mentait que
pendant la fenêtre de temps où l'auteur se demande justement si son geste a servi.

**Le sixième défaut était dans l'essai, pas dans le produit** : le double d'animateur s'appelait
« Muet » et `GET /api/clips/engine` retrouve le moteur *par son nom*. Il a montré au passage
qu'un refus porté par `HTTPException(detail={"raison": …})` arrive à l'écran en langage de
machine — `appeler()` lit `charge?.raison` à la racine, FastAPI l'emballe dans `detail`. Une
seule est atteignable en pratique, elle vient d'`A11`, et elle est notée plutôt que corrigée
ici.

**Une chose reste non exercée, et elle est écrite en clair** : `OpenRouter.solde()` interroge
`GET /credits` puis retombe sur `GET /key`, et **ces deux formes n'ont jamais parlé au vrai
service** — aucun appel réel n'a été fait dans cette tranche. Quand rien ne se lit, la
vérification annonce le compte de modèles et écrit *le solde n'a pas été lu*, ce qui est vrai,
plutôt qu'un chiffre qui ne l'est pas.

**Deux suites vertes** : 1 010 essais d'écran (+38), 1 719 côté serveur (+45 : les 44 de
`tests/test_b15.py` et un cas paramétré de plus, `Installation.tsx` entrant dans
`LES_FICHIERS_DU_CARNET`), `tsc -b` propre, le garde-fou de design sans reproche et les 1 595
renvois de doc tous justes.

⚠️ **Et un garde-fou resté rouge jusqu'au dernier moment** : `test_g1.py::test_aucun_numero_d_
etape_n_est_ecrit_a_la_main` refusait les quatre bandeaux de section de `Installation.tsx`
(« Étape 1 · Ce qui va être demandé »). C'est très exactement le défaut que `B14` avait déjà
reproduit trois jours plus tôt, et pour lequel cet essai avait été élargi. Les bandeaux disent
maintenant le nom de l'étape, comme ceux de `ReglesDuJeu.tsx` — un rang écrit à la main se
décale quand une étape s'insère.

## V4 · B13 — la grille du jeu, et comparer — 8 septembre 2026

**Deux écrans en lecture seule, tous deux accrochés au bandeau d'onglets de
`PageDuSujet.tsx`, à côté de *Sa fiche*/*Ses images*/*Ses animations*.** La grille du jeu
pose le sujet sur sa case avec ses voisins étiquetés de leur occupation ; comparer met deux
sujets — ou deux images d'un même sujet, quand le second choix est le premier — côte à
côte, avec l'écart chiffré et l'action qui le corrige. Aucun des deux ne coûte, n'écrit ni
n'ajoute une route : `univers` et `personnages` sont déjà chargés à la racine de `App.tsx`.

**Le plan supposait un calcul manquant — le plafond réel d'occupation. Il existait déjà,**
testé aux deux bouts (`occupation_max`, `atelier/domaine/recette.py`, et son double
`occupationMax`, `interface/src/api.ts`, déjà employé par `Assistant.tsx` et `Places.tsx`).
`B13` n'écrit donc aucune ligne de domaine : elle réemploie l'existant, montré à côté du
reste. Les quatre écarts chiffrés de `Comparer.tsx` viennent eux aussi de nombres déjà
réels — `rendu_largeur`/`rendu_hauteur`, `recette.contours`, `recette.quantification.couleurs`
— sans qu'aucun ne soit inventé ; la ligne « Son ombre » de la planche a été abandonnée,
faute de toute mesure du produit qui la porte.

⚠️ **Le relevé a trouvé trois défauts en vérifiant au navigateur, aucun par les essais
d'écran.** Une couleur écrite en clair dans un `style` en ligne (`GrilleDuJeu.tsx`), que
`essai_jetons.py` interdit partout dans le texte source et pas seulement dans une
`className` — corrigée par un jeton déjà déclaré et un mélange `overlay` plutôt qu'une
transparence littérale. Un écart de contour qui ne comptait pas quand un seul des deux
côtés en portait un — la règle exigeait les deux non nuls avant de comparer, donc *« une
image détourée, l'autre jamais »*, le cas le plus courant, se lisait *« le même »*. Et
« La retoucher » qui restait sans effet visible quand l'écart appartenait au second sujet
comparé : l'outil de retouche ne cherche une image que dans les cases du sujet dont la
page est affichée, et le bouton ne portait que l'identifiant de l'image, jamais celui de
son sujet. Les trois sont corrigés, et le dernier a changé la façon dont *La retoucher*
navigue : elle bascule d'abord sur la page du bon sujet — ce qui referme Comparer de
lui-même, la pile de lieux coupant ce qui est plus profond que l'étage remplacé — avant
d'ouvrir la case.

**Vérifié sur un atelier jetable dédié**, port 8480 (`essais/atelier_jetable_b13.py`) : un
sujet dont l'image dépasse sa case, porte un contour que l'autre n'a pas, et un compte de
couleurs au-delà du réglage du jeu — les trois écarts et leurs trois formes de correction
en même temps, sur un seul sujet-témoin.

## V4 · B14 — les règles du jeu, en quatre étapes — 9 septembre 2026

**Commencer un jeu se fait en quatre pas — son nom, son allure, sa vue, son monde — et le même
parcours rouvert *est* l'écran des règles du jeu.** Pas deux écrans qui se ressemblent : un
fichier, `interface/src/composants/ReglesDuJeu.tsx`, deux modes. En création il prend la fenêtre
entière et enchaîne les pas ; rouvert depuis le carnet il s'ouvre sur la liste des quatre, le
carnet visible à côté. Un essai compare les deux entrées sur la route, la méthode **et le corps
du message** — le septième critère est tenu par construction, pas par vigilance.

⚠️ **Le relevé a trouvé trois sources de consigne de caméra, là où la planche en annonçait
deux.** Avant `B14`, l'auteur pouvait écrire « vu du dessus » dans la ligne *vue* de la bible
**et** choisir une vue dans les réglages : les deux partaient, dans le même envoi, à quelques
lignes d'écart. Une liste de vingt mots anglais (`_REDITES`, `atelier/domaine/projet.py`)
essayait de rattraper le cas en détectant si le texte d'auteur disait déjà la même chose — et son
commentaire avouait lui-même être « volontairement courte ». Elle ne rattrapait rien d'écrit en
français, ni « vu du ciel, bien au-dessus ».

**La liste n'a pas été allongée : la seconde place d'écriture a été supprimée.** `rendu` et `vue`
deviennent des **cases de l'atelier** (`CHAMPS_DE_L_ATELIER`) — l'atelier seul y écrit, à partir
du style, de la cible en pixels et de la vue choisie. `_REDITES` tombe de vingt mots à quatre, et
ne garde que `technique`, le seul doublon que la planche laisse ouvert. Allonger la liste aurait
reconduit le défaut sous une forme un peu plus longue.

**Rien n'a été effacé du disque.** Le texte d'auteur devenu inerte reste enregistré, reste relu,
et remonte par `atelier.sans_effet` dans la réponse de `/api/universe`. L'écran le montre **barré**,
avec un lien vers l'étape qui écrit à sa place. Supprimer en silence du texte que quelqu'un a
tapé aurait été le contraire de ce que la tranche répare.

**Le troisième doublon reste, et c'est mesuré.** Le rappel `CAMERA — this overrides everything
above` en queue de prompt a été gardé : `essais/essai_vue.py` l'a payé sur trente images, et le
rapport de cadrage est passé de 1,55 à 1,13 grâce à lui. `B14` retire la répétition **dans la
bible**, pas le rappel qui marche.

**Deux jeux du même nom : un avertissement, pas un refus.** Le jeu se crée, reçoit son dossier
`-2`, et la phrase nomme **l'autre jeu** — première version du code, elle citait le nom qu'on
venait de taper, et c'est un essai qui l'a attrapé. Le même essai a montré que `_creer` faisait
`strip()` là où `renommer_projet` faisait `" ".join(nom.split())` : créer et renommer ne
jugeaient pas les espaces de la même façon.

**Quatre essais serveur existants ont changé** — leurs décors écrivaient dans `vue` ou `rendu`
pour fabriquer une ligne, ce qui ne produit plus rien. Chacun garde son intention, réglée par la
vraie vue plutôt que par du texte ; `tests/test_e12.py::test_le_desaccord_entre_le_texte_et_la_
grille_se_voit` est même devenu l'essai qui **mesure** la disparition d'un des doublons.

**Deux suites vertes** : 972 essais d'écran (+22), 1 674 côté serveur (+18 : les 17 de
`tests/test_b14.py` et un cas paramétré de plus, `ReglesDuJeu.tsx` entrant dans
`LES_FICHIERS_DU_CARNET`), `tsc -b` propre et le garde-fou de design sans reproche.

## V4 · B11 — ses animations, et le départage — 9 septembre 2026

**L'onglet *Ses animations* de la page d'un sujet (`B10`) est construit.** Même rangement que
*Ses images* — une ligne par pose, une rangée par direction, la retenue en tête —, mais pour des
bandes plutôt que des images, et deux choses y diffèrent sciemment.

**Le vrai travail était sous l'écran, avant tout pixel.** `Bande` ne portait ni `favori`, ni
`rang`, ni `supprime_le` — les trois existent sur `Asset` depuis `T3`. Le relevé a d'abord tranché
une question d'architecture plutôt que de recopier la table des assets : une case de ce produit
ne porte jamais plus qu'une poignée de bandes, et le dépôt entier n'en tient jamais plus que
quelques centaines — loin de l'échelle qui a fait indexer les colonnes d'un asset. Les trois
champs vivent donc dans `contenu`, comme `Collection.membres` avant `B8.2`, et `VERSION` n'a pas
bougé.

⚠️ **Écarter la retenue d'une bande promeut la plus récente des gardées — un geste que les
images n'ont pas besoin de faire.** Une image démotée reste départagée par `corps_retenu`, qui
relit toutes les images vivantes de la case et en reprend une au rendu suivant. Une bande
écartée, elle, **sort** du calcul : `ServiceProduction.cases()` la range dans
`animations_ecartees`, et il n'existe aucune fonction équivalente à `corps_retenu` qui
repêcherait une gardée à sa place. Sans ce geste, écarter la seule retenue d'une rangée qui a
d'autres bandes aurait laissé la case sans retenue en silence. L'écran appelle donc `PUT
/strips/favorite` sur la plus récente des gardées, juste après le `POST /strips/delete` — et
seulement s'il y en a une.

**Les écartées se voient, contrairement aux images de `B10`.** `assets_du_personnage` filtre les
images écartées en SQL avant que la matrice ne les compte, si bien qu'aucune n'apparaît jamais
dans la charge d'un sujet — c'est pour ça que `B10` avait renoncé au chip « N écartées » de sa
maquette. Une bande n'a pas cette contrainte (le filtre est en Python, pas en SQL) et le critère
d'acceptation de `B11` demande explicitement l'écart « derrière la flèche » : `bandes_ecartees`
existe pour cette seule raison, replié par défaut sous un bouton qui déplie et propose de
restaurer.

**Deux trouvailles au navigateur, sur l'atelier jetable**, ajoutées à `docs/PIEGES.md` : une
bande écrite directement dans le dépôt (sans passer par un vrai clip, comme le font déjà les
essais serveur) disparaît de l'index dès que l'atelier redémarre — `ServiceBibliotheque
.reconstruire()` ne relit une bande que si son clip a une génération connue, et un clip inventé
n'en a pas. Et la fenêtre de restauration de huit secondes est plus courte qu'un aller-retour
d'outil de navigateur : une bande écartée au montage du décor est déjà hors délai le temps qu'on
l'atteigne à l'écran, ce qui n'est pas un défaut — c'est `restaurer` fait en direct, juste après
un écart fait en direct, qui vérifie le vrai chemin.

**Deux suites vertes** : 950 essais d'écran (+33), 1656 côté serveur (+11 : les dix de
`tests/test_b11.py` et un cas paramétré de plus sur `LES_FICHIERS_DU_CARNET`), `tsc -b` propre.

## V4 · B10 — la page d'un sujet — 8 septembre 2026

**Cliquer un sujet ouvre sa page, plus son atelier.** Quatre onglets sur un seul écran — *Sa
fiche*, *Ses images*, *Ses animations*, *L'essai* —, dont les deux premiers construits. Les
deux autres sont dans la barre, cliquables, et disent qu'ils viennent : les cacher aurait fait
croire que la page est finie, et les remplir aurait empiété sur `B11` et `B12`.

**La matrice n'a pas été remplacée : elle est descendue d'un cran.** Le plan la faisait
disparaître. Le relevé a compté ce qu'elle porte encore et que rien d'autre ne sert — commander
un clip, l'atelier d'une animation, le vestiaire, la planche d'une pose, le calibrage, la
vitrine, le miroir, les poses cochées, plus la fiche plein cadre. **Huit fonctions du produit
n'ont aucun autre chemin** avant `B11`, `B12` et `B19` : les retirer pour livrer un onglet
aurait été une régression déguisée en refonte. Elle est donc devenue la profondeur suivante de
la page, comme la vitrine et le calibrage étaient déjà des profondeurs d'elle.

**Un marqueur d'essai a changé de porteur, et c'est ce qui a sauvé 349 essais.** `data-etabli`
veut dire *un sujet est ouvert* : il est passé sur la page, la matrice prend `data-matrice`.
Deux marqueurs identiques imbriqués auraient fait dire au premier `querySelector` venu autre
chose selon la profondeur ouverte. Une seule aide — `ouvrirLEtabli` — descend maintenant
l'étage supplémentaire, et les 57 appels qui la traversent n'ont rien eu à changer.

⚠️ **Retenir une image démote à l'écran, parce que le serveur ne démote pas.** `PUT
/assets/favorite` écrit un champ et ne regarde pas les voisines : c'est la seule écriture de
`.favori` du produit. Le serveur *départage* au lieu d'imposer l'unicité — `corps_retenu` prend
le maximum de `(favori, cree_le, rang)` —, si bien que deux retenues dans une case sont
possibles et que c'est la plus récente qui part dans le jeu. L'écran éteint donc les autres
**avant** d'allumer la sienne : un échec au premier appel laisse l'état d'avant intact. Et son
tri reprend le départage du serveur au mot, sans quoi le liseré aurait désigné une image et
l'export en aurait écrit une autre.

⚠️ **Le total affiché compte ses images, pas ses appels, et le dit.** La planche écrit *« Ce
qu'il a coûté »*. Ce chiffre n'existe nulle part : `GET /spending` porte bien le sujet par
ligne mais rend les 500 derniers appels de tout l'atelier, sans filtre — un total tiré de là
serait tronqué **en silence**. L'écran écrit *« Ce que ses images ont coûté »*, exact pour ce
qu'il nomme, et renvoie les générations ratées vers Les dépenses.

**Quatre commandes de la maquette n'ont pas été écrites** — *Recadrer*, *Le dupliquer*, *Le
comparer*, *Générer les 9 calques* — faute de route derrière, et le chip « N écartées » non
plus : la charge d'un sujet filtre `supprime_le IS NULL`, donc il n'aurait jamais rien pu
montrer.

⚠️ **Trois défauts que seul le navigateur a vus.** Une pose dont toutes les images attendent
leur angle annonçait « 1 sans retenue » — vrai et inutile, on ne départage pas des images dont
on ignore d'où elles regardent. La surface poussait le volet de 380 px hors de la fenêtre dès
qu'on resserrait, parce qu'une colonne de flex refuse de descendre sous la largeur de son
contenu ; `min-w-0` sur les deux surfaces, et **aucun essai d'écran ne pouvait le voir — ils
n'ont pas de largeur**. Et le total s'écrivait en rouille à zéro, ce qui faisait une dépense
d'un sujet fait d'images importées.

**Un défaut vu là qui n'est pas de cette tranche** : à 1000 px, *tout* l'atelier déborde —
mesuré sur le codex, qui ne porte pas une ligne de `B10` : grille de châssis à 700 px pour
872 px de contenu. C'est la largeur minimale du châssis actuel, et elle appartient à `B0`.

## V4 · B9.4 à B9.7 — l'écran d'une famille — 8 septembre 2026

**Cliquer « Les personnages » dans le carnet ouvre enfin une grille de personnages.** La route
existait depuis `B9.2` et personne ne l'affichait ; c'est fini. Trois vues — la grille, la liste,
le tableau des poses —, une recherche, trois filtres, la sélection multiple, un volet à droite,
le glisser-déposer vers les collections, et un panneau de réglages à côté.

**La famille est un lieu, pas un `useState`.** `lieux.ts` gagne un variant `famille` posé sur le
codex. Sans lui, la pile aurait dit *codex* pendant qu'un état disait *laquelle* : deux portes
vers la même famille n'auraient pas atterri au même endroit, et le fil d'Ariane aurait deviné ce
que la pile ne savait pas. Le nom est entré dans la liste des états d'ouverture interdits de
`tests/test_b0.py` le jour même où il est entré dans la pile.

**Les trois comptes de filtre portent sur la famille entière, jamais sur la page servie.** Comptés
sur la page, l'onglet aurait dit *Incomplets 31* au-dessus d'une grille qui n'en montre que les
premiers chargés — et le chiffre aurait *baissé* en cliquant « Charger la suite », c'est-à-dire
l'inverse de ce que fait ce bouton.

**Les collections vides sont servies à part, et il le faut.** Une collection sans membre ne
figure sur la carte d'aucun sujet : lue depuis les cartes, elle serait invisible. Or c'est
précisément celle qu'on veut remplir en y glissant quelque chose.

⚠️ **Le « 10 + 3 » du survol ne peut pas se lire dans le glissement.** `getData` est vide pendant
un `dragover` — la règle du drag-and-drop HTML, pas un défaut. Le compte projeté est donc calculé
au `dragstart` et remonté au parent, parce que la seconde cible de dépôt vit dans le carnet, qui
n'a pas les sujets de la page pour le calculer lui-même. Et il ne compte que **ceux qui n'y sont
pas déjà** : annoncer trois pour n'en poser qu'un mentirait sur ce qui va se passer.

⚠️ **Deux allers-retours pour un, et seul le navigateur l'a vu.** Remettre la limite de page à 120
dans un `useEffect` la remettait après le départ du chargement : ouvrir une collection lisait
d'abord la famille avec l'ancienne limite déroulée — 360 sujets pour rien — puis la relisait à
120. La remise se fait pendant le rendu. Mesuré sur l'atelier jetable : *avant 2, après 1*.
**L'essai qui le garde compare la liste des lectures, pas un temps** — la mesure trop large du
point 8sexies aurait dit « c'est rapide » des deux.

⚠️ **Et l'écran ne posait pas son fond.** Le châssis autour est encore sombre : une grille de
cartes claires se dessinait sur du noir. Aucun essai d'écran ne pouvait le voir, aucun
compilateur non plus — c'est très exactement ce que le second atelier sert à trouver.

**Le panneau de réglages a corrigé sa propre conception.** Elle annonçait un *PATCH partiel* sur
`PUT /universe` ; la route remplace tout l'univers. Le panneau garde donc les deux tables
entières en mémoire, n'édite que les lignes de la famille ouverte, et renvoie toujours le tout.
Deux essais vérifient que les trois autres familles ressortent inchangées du corps envoyé.

**La maquette n'a pas été suivie sur trois points, et c'est assumé.** Le rouille sur ce qui manque
(le rouille ne sert qu'au bouton qui lance et au chiffre qui coûte, précédent de `TableauDeBord`),
le fantôme du glisser réduit à un rectangle, et les commandes que rien n'appellerait — *Exporter*,
*Générer la pose manquante*, *Les retirer du jeu* — qui n'ont pas été écrites.

## V4 · B9.1 — le compte groupé par sujet — 7 septembre 2026

**La grille d'une famille saura dire « 4 poses sur 6 » de deux cents sujets en deux requêtes.**
Le produit savait déjà répondre à cette question — c'est la matrice, `cases()` — mais une fois
par sujet, avec un aller-retour SQL chacun : `bilan_du_jeu` l'appelle en boucle depuis `B5` et
le dit lui-même. `comptes(projet, sujets)` remplace la boucle par un `GROUP BY personnage, pose`
sur les images et un autre sur les bandes. Aucune route ne le sert : c'est `B9.2`, et le silence
est voulu — 8nonies interdit une route que nul écran n'affiche.

**Ce que le morceau a trouvé n'était pas dans son périmètre : la matrice comptait les images
d'un homonyme d'un autre jeu.** Un identifiant de sujet n'est unique que par jeu — le piège
nommé en toutes lettres par `B8.1` — et `assets_du_personnage` ne filtrait que par sujet. Le
`pelerin` du Marais se disait donc complet en montrant les images du `pelerin` des Salines.

⚠️ **Et c'est la *forme* de l'essai qui l'a trouvé, pas son sujet.** Le compte groupé filtre par
jeu parce qu'un `GROUP BY` l'exige : sans ça, deux univers s'additionnent dans la même ligne. Un
essai écrit sur le nouveau chemin seul aurait passé ; un essai écrit sur l'ancien seul aussi.
Ce qui a fait tomber le défaut est l'essai qui exige que **les deux chemins disent la même
chose**, sur dix cas dont la matrice seule connaît la règle — une pose écartée, une pose ajoutée
pour ce sujet-là, un angle rangé, un calque, une image supprimée. C'est la leçon à emporter :
quand un second chemin naît pour répondre à une question déjà répondue, le confronter au premier
vaut mieux que de le vérifier seul, **et il faut le confronter avant de croire au nouveau**.

**Une règle est sortie de `cases`, et il fallait qu'elle en sorte.** *Ce qu'une pose réclame* —
`pose.images × directions tenues` d'un côté, *une bande par direction* de l'autre — vivait à
l'intérieur de la boucle qui fabrique les objets d'écran. Le compte groupé en avait besoin sans
fabriquer un seul de ces objets. La recopier aurait fait deux vérités sur ce que le produit
réclame, et elles n'auraient divergé qu'au premier angle rangé, longtemps après. `reclame()` la
porte une fois pour les deux, et rend les deux calques ensemble — ils ne se comptent pas pareil.

**Le mémo du projet comptait autant que les deux requêtes.** `plan_de` relit le jeu à chaque
appel, donc une fois par sujet : quinze ouvertures de base pour douze sujets, cinq pour deux.
Deux requêtes groupées devant douze relectures de projet ne gagnent rien du tout — c'est le
défaut mesuré en `M3`, rejoué à l'identique par un écran neuf. `@projet_lu_une_fois()` ramène le
compte à trois quel que soit le nombre de sujets. **Et l'essai compte des allers-retours, pas des
secondes** : un temps mesuré sur douze sujets aurait dit « c'est rapide » d'une boucle qui ne
l'est pas, ce qui est très exactement la mesure trop large du point 8sexies.

**`complet` ne regarde que les images, et c'est une décision, pas un oubli.** Toute pose réclame
au moins une animation par direction ; si `complet` les comptait, le filtre *Incomplets* de
`B9.6` rendrait le jeu entier tant qu'une bande manque — donc toujours — et ne trierait plus
rien. Le calque animé est rendu à côté, entier, pour qu'une carte le montre sans que le filtre
s'y noie.

**1 616 essais au vert.**

## V4 · B9.2 et B9.3 — la route qui sert une famille, avec ses collections — 7 septembre 2026

**Une route pour deux morceaux du découpage, parce qu'ils composent la même carte.** `GET
/characters/families/{famille}` rend une page de sujets d'une famille, chacun portant déjà son
compte de complétude et ses collections — pagination façon `B3`, filtre de famille en mémoire,
jointure sur `collections_membres`.

**Le piège que la décision 1 de `B9` ne nommait pas assez fort : filtrer avant de paginer, pas
après.** Charger une page de l'index puis n'en garder que les sujets de la bonne famille aurait
rendu une page plus courte que demandé dès qu'une autre famille s'y mêle, et un total faux. La
méthode lit donc le jeu entier par l'index avant de répartir, et ne pagine qu'ensuite —
`personnages_du_projet` gagne un `limite=None` pour ça, réservé à cette route.

**Les collections sont jointes dans la route, pas dans `ServiceProduction`.** Aucun des deux
services n'a besoin de l'autre pour répondre à sa propre question ; seule la route compose les
deux, exactement comme d'autres routes composent déjà `production` et `equipement`.

**1 623 essais au vert.**

## V4 · B8.5 — la recherche en deux groupes — 7 septembre 2026

**La table de `B8.3` a enfin un lecteur.** Elle attendait depuis sa naissance — « rien ne la lit
encore », disait sa propre entrée — et c'est ce morceau qui la fait servir : chercher un sujet
par son nom ou sa description passe désormais par elle, jamais par le disque, ce qui est
exactement la raison pour laquelle elle existe.

**Une décision que le relevé n'avait pas prise : deux colonnes de recherche, pas une.** Le
critère sépare bien les deux groupes — un sujet répond à son nom et sa description, une image
au nom de son sujet, jamais à sa description —, mais rien n'avait tranché *comment* l'index
tiendrait cette distinction. Une seule colonne normalisée aurait suffi au premier groupe mais
aurait fait fuir la seconde : chercher le mot d'une description de sujet aurait fait remonter
les images de ce sujet, sur un mot que personne n'a tapé pour les chercher, elles. `personnages`
porte donc `recherche` (nom + description) pour le premier groupe et `recherche_nom` (le nom
seul) pour la jointure du second — un coût de build minime pour ne pas répondre à côté.

**Le nom d'un sujet ne se grave jamais dans une image, contrairement à sa pose et sa
direction.** Les trois sont des identifiants stables et pourraient sembler symétriques ; ils ne
le sont pas. La pose et la direction naissent déjà normalisées et ne vivent que sur l'asset —
les graver dans sa colonne `recherche`, comme le prompt l'était déjà, ne crée aucune seconde
vérité puisque l'asset se réécrit en entier à chaque changement de case. Le nom d'un sujet, lui,
vit sur le `Personnage`, qui se renomme sans qu'aucune image ne soit touchée : le graver aurait
recréé exactement le défaut que `B8.1` refusait pour la collection elle-même. La recherche d'une
image par le nom de son sujet passe donc par une jointure à l'instant de la requête — jamais par
une copie —, et `test_renommer_un_sujet_change_aussitot_ce_que_ses_images_trouvent` le vérifie en
renommant un sujet en cours de route et en cherchant sous les deux noms.

**Aucune migration.** Comme pour `label` avant elle, `recherche` se recalcule à chaque écriture ;
la reconstruction depuis le disque la remplit d'elle-même, sans qu'une ligne de migration soit
écrite nulle part.

**1 602 essais au vert.**

## V4 · B8.4 — les gestes de la collection — 7 septembre 2026

**Le mot *collection* ne dit plus qu'une seule chose, et le garde-fou posé en `B8.1` peut se
refermer.** Quatre chemins existants reprenaient l'ancien sens — `Asset.collection`, un champ
posé sur l'image — et c'est ce morceau qui les a fait basculer vers le nouveau : une collection
qui range des sujets, pas des images. Deux gestes neufs s'ajoutent, `ranger_sujet` et
`retirer_sujet`, chacun un aller simple vers `Collection.avec` / `.sans` — la forme posée en
`B8.1`, inchangée depuis.

**`arbre()` change le nom de sa clé, pas seulement ce qu'elle compte.** L'ancien
`compter_par_collection` comptait des images ; le nouveau compte des lignes de
`collections_membres`, donc des sujets. Garder la clé `assets` avec un sujet dessous aurait
affiché un chiffre plausible et faux à un écran qui n'a pas encore changé — exactement le risque
que le relevé de `B8` avait nommé d'avance. La clé devient `sujets`, et un écran qui lirait
encore l'ancienne verrait un zéro visible plutôt qu'un compte qui ment.

**Un essai de `B8.1` rangeait encore par l'ancien chemin, et personne ne l'avait vu venir.**
`test_l_index_efface_la_bibliotheque_se_reconstruit_depuis_les_fichiers` (`test_t3.py`) posait
une image dans un projet en passant `collection` sans `projet` à `PUT arrangement` — le geste
d'avant `B8.4`, où « une collection décide du projet ». Le paramètre `collection` de `ranger()`
est parti avec cette tranche ; l'essai continuait de l'envoyer, il était désormais simplement
ignoré, et l'image ne rangeait plus nulle part — trouvé à l'exécution, pas à la lecture, parce
que rien dans le corps de la requête ne signale un champ mort. Corrigé en rangeant par `projet`
explicitement, et en laissant la vérification des membres à `test_b8.py`, comme le commentaire
de l'essai le demandait déjà.

**Aucune validation neuve.** `ranger_sujet` et `retirer_sujet` ne jugent ni le jeu ni le sujet —
la décision de `B8.1` reconduite : `avec()` ne juge pas, et ranger un sujet ne le déplace
d'aucun univers.

**1 596 essais au vert.**

## V4 · B8.3 — les sujets entrent dans l'index — 6 septembre 2026

**Renverse une décision écrite en toutes lettres, et ça n'a coûté que deux crochets.**
`atelier/services/production.py` disait depuis T1 que les personnages sont « lus du disque,
jamais d'un index » ; `B9` a besoin d'en faire défiler des centaines, et parcourir chaque
fichier de chaque jeu à chaque écran ne le permettra pas. Le relevé de `B8` avait déjà trouvé
qu'un seul endroit écrit un sujet (`_sauver`) et un seul l'efface (`supprimer_personnage`) : la
table `personnages` s'y accroche, sans toucher à un troisième endroit.

**Le couple `(projet, identifiant)` en clé, comme pour un membre de collection.** Les
identifiants de sujet ne sont uniques que par jeu — `pelerin` existe dans le Marais et pourrait
exister ailleurs — et une clé nue aurait fait écraser l'un par l'autre dans l'index le jour où
deux jeux partageraient un nom.

**Rien ne la lit encore, et c'est voulu.** `personnages()` continue de lire le disque ; router
cette lecture est le travail de `B8.4` et de `B9`, pas de celui-ci. Même choix que `B8.2` avait
fait pour `collections_membres` : poser l'index avant ses lecteurs plutôt que de le faire
naître avec le premier geste qui s'en sert.

**L'essai qui coûte, un troisième jumeau.** Point 8septies d'`AGENTS.md`, comme pour `B8.1` et
`B8.2` : l'index est effacé du disque, un atelier neuf remonté sur le même dossier, la table lue
en SQL directement. Et le sens inverse se vérifie aussi — un sujet supprimé avant l'effacement
de l'index ne doit pas ressusciter, puisque son fichier n'est plus sur le disque pour le
reconstruire.

**1 591 essais au vert.**

## V4 · B8.2 — la table de jointure — 6 septembre 2026

**Plus petite que ce que le découpage annonçait.** `B8.1` l'avait déjà prévenu : la
reconstruction relit les adhésions depuis `collections.contenu`, qui porte la fiche entière,
donc `reconstruire()` n'avait rien à changer. Il restait la table elle-même —
`collections_membres(collection, jeu, sujet)` — et le passage de `VERSION`, de 6 à 7.

**Une seule règle d'écriture, et c'est celle de tout le fichier.** La table se réécrit en
entier à chaque sauvegarde d'une collection — tout effacer, tout réinsérer — plutôt que de la
diffé : même règle que `contenu`, qui se réécrit toujours depuis l'objet, jamais deux vérités.
Une collection ne porte jamais assez de membres pour que ça coûte quoi que ce soit.

**`ON DELETE CASCADE` fait le geste de `B8.4` avant que `B8.4` existe.** Supprimer une
collection vide ses lignes de jointure sans qu'un appelant ait à y penser — `foreign_keys=ON`
est déjà la politique du dépôt depuis T3, la cascade n'a rien demandé de nouveau ailleurs. La
même leçon que les deux crochets uniques qui écrivent et effacent un sujet, relevée en `B8.1`.

**Pourquoi une table plutôt qu'une lecture de plus.** Aucun geste de `B8.1` ou `B8.2` n'en a
besoin — rien ne route encore dessus. Elle existe pour `B8.4` et `B8.5` : compter les sujets
d'une collection ou chercher où vit un sujet deviennent des jointures SQL, là où ce serait des
boucles Python sur chaque fiche sans elle. Poser l'index avant ses lecteurs, plutôt que de la
faire naître en même temps que le premier geste qui la lit.

**L'essai qui coûte, jumeau de celui de `B8.1`, posé sur l'index cette fois.** Point 8septies
d'`AGENTS.md` : l'index est effacé du disque, un atelier neuf remonté sur le même dossier, et
la table est lue en SQL directement — jamais la réponse d'un geste qu'on vient de faire.
Vérifié **en défaisant le correctif** : retirer la réécriture de la table fait tomber trois
essais sur quatre — le quatrième, celui de la suppression, passe trivialement puisqu'il n'y a
alors rien à effacer, et c'est le signal attendu plutôt qu'un trou dans l'essai.

**1 586 essais au vert.**

## V4 · B8.1 — le modèle de l'adhésion — 6 septembre 2026

**La collection porte enfin ses membres, et personne ne le lui demande encore.** C'est le
premier des six morceaux de `B8`, et le seul en `[HARD]` : il pose la forme dont les cinq
autres héritent. Trois fichiers touchés, aucune route, aucun écran.

**Le piège était le couple, et il a été payé d'avance.** Un membre est `(jeu, sujet)`, jamais
un identifiant seul : les identifiants de sujet sont uniques *par jeu*, et une collection peut
n'appartenir à aucun jeu — « à refaire », « pour la démo » en traversent plusieurs. Un
identifiant nu aurait fait entrer l'homonyme d'un autre univers au premier rangement, sans
qu'aucun écran puisse le distinguer d'un geste voulu. Le relevé l'avait vu avant la première
ligne ; c'est la deuxième fois qu'une conception jugée avant d'écrire épargne un défaut
qu'aucun essai n'aurait cherché.

**La persistance n'a pas eu une ligne à changer, et ça vaut d'être su.** L'index garde chaque
collection sous forme de fiche JSON complète, et la reconstruction relit `collections.json` par
le même `depuis_json` : les membres traversent le disque et l'index gratuitement. `B8.2` — la
table de jointure — n'est donc pas un travail de survie de la donnée mais d'index de recherche,
ce qui la rend plus petite qu'annoncée.

**Deux arbitrages de l'auteur en fin de morceau, et les deux ont renversé la recommandation.**

*Le code du carnet parle la langue des écrans* : `Membre(jeu, sujet)`, et les clés du fichier
avec, là où le reste du dépôt dit `projet` et `personnage`. Le champ `Collection.projet` ne suit
pas — c'est le jeu de la collection elle-même, écrit sous ce nom depuis T3, et le renommer ferait
disparaître le jeu de toutes les collections déjà sur le disque.

*Un groupe peut mêler deux univers* : ranger n'est jamais refusé. L'argument est plus fort que
celui qu'on lui opposait — **ranger un sujet ne le déplace pas d'univers**, contrairement à
ranger une image, donc il n'y a rien à trancher et rien à refuser. Ce que la souplesse coûte est
nommé d'avance : un compte de sujets doit toujours dire de quel jeu il parle, et `sujets_du_jeu()`
est le seul chemin par lequel un groupe se lit. Lire `membres` sans filtrer, c'est additionner
deux jeux — le défaut à surveiller en `B8.4` et en `B9`.

⚠️ **Le mot *collection* veut dire deux choses jusqu'à `B8.4`, et le garde-fou a été posé tout
de suite.** Les cinq essais qui parlaient de collection ont été réécrits pour **nommer laquelle
des deux ils vérifient** et ce qu'ils deviendront quand la colonne partira. Quatre portent
l'ancienne — celle qui se pose sur une image —, un porte les deux. Sans ça, l'essai qui tombera
en `B8.4` ne dirait pas s'il constate une régression ou le changement voulu.

**L'essai qui coûte n'interroge jamais la réponse d'un `POST`** (point 8septies d'`AGENTS.md`) :
il pose deux adhésions qui ne sont pas le défaut, lit le fichier, efface l'index, remonte un
atelier sur le même dossier et regarde ce que `donnees/` a su rendre. Et il a été vérifié **en
défaisant le correctif** — `en_json` privée de sa ligne de membres fait tomber deux essais sur
neuf, dont celui-là ; un essai écrit après coup passe des deux côtés une fois sur deux.

## V4 · B0 — le socle du carnet — 6 septembre 2026

**Le châssis neuf est posé à côté de l'ancien, pas à sa place.** Un seul lieu est réellement
branché — le tableau de bord du jeu —, et les quarante autres écrans s'ouvrent exactement comme
avant, à l'intérieur de la surface. C'est la balle traçante : si le carnet, la pile de lieux et
l'aide de navigation des essais tiennent sur un lieu, ils tiendront sur vingt.

### La décision qui commande tout le reste : deux systèmes cohabitent

`index.css` porte maintenant deux `@theme`. Trois noms se disputaient — `signal`, `ok`,
`echec` — et **c'est le carnet qui les garde** : ce sont les mots de `docs/DESIGN.md`, et un
écran neuf qui écrit `bg-signal` doit obtenir du rouille. L'ancien prend `ancien-`, sur
**504 emplois dans 37 fichiers**.

⚠️ **Ce n'est pas de la comptabilité, c'est une mesure.** `bg-ancien-signal` dans un fichier dit
« cet écran n'a pas encore été repris », et l'avancement de la refonte se compte d'un `grep`.

**Ce qui a été refusé** : donner aux anciens noms les valeurs du papier. Cela aurait basculé
quarante écrans à la lumière d'un seul coup, alors que leurs contrastes ont été choisis pour du
noir — `--texte` `#e6eaee` est *invisible* sur `#f7f3ec` — et qu'une tranche qui livre un lieu
n'a pas de quoi en vérifier quarante.

### Douze états sont devenus une pile, et les douze noms n'ont pas bougé

`App.tsx` portait douze états d'ouverture indépendants. Ils sont maintenant **dérivés** de la
pile de lieux — même nom, même type, même setter —, si bien que deux cents lectures n'ont pas
changé d'une lettre alors que la source de vérité, elle, a entièrement changé.

Deux choses en sont tombées :

- **Un treizième état était mort** : `decoupeOuverte`, sept écritures, toutes à `null`, et un
  écran entier derrière. Écrit à la main il se lisait comme les onze autres ; rangé dans une
  pile, il n'avait aucun genre à recevoir. **Une pile ne cherche pas les états morts — elle les
  rend impossibles à écrire.**
- ⚠️ **L'ordre des appels s'est mis à compter.** Poser une racine repose la pile : « ouvrir
  l'établi » posait la profondeur *puis* changeait de lieu, et perdait la descente. Avec douze
  états indépendants, l'ordre n'avait aucune importance ; avec une pile, **le lieu d'abord, la
  profondeur ensuite**, ce qui est aussi le sens de lecture.

Le fil d'Ariane, lui, se déduit de la pile : 110 lignes de ternaires imbriqués remplacées par un
annuaire qui nomme un lieu et une fonction qui empile les étages.

### Le contrôle en sens inverse a trouvé des boutons sans fond

`D0` demandait le garde-fou **dans les deux sens**. Le sens qui refuse a trouvé, au premier
lancement, quinze emplois de quatre couleurs déclarées nulle part : `signal-sourd` — **deux
boutons actifs de l'écran des tables sans aucun fond** —, `texte-1` — neuf survols de l'atelier
de bande qui ne changeaient rien —, `attente` et `info`.

⚠️ **Un utilitaire Tailwind dont le jeton n'existe pas ne lève aucune erreur** : la règle CSS
n'est pas produite, l'élément garde la couleur de son parent, et un gris sur du gris ne détonne
pas. Ni le compilateur, ni la relecture, ni 792 essais d'écran ne le voyaient.

**Ce qui a été refusé : déclarer les quatre pour faire taire le contrôle.** Cela aurait inventé
quatre valeurs que personne n'a mesurées — exactement la façon dont les huit couleurs de `D0`
étaient entrées. Ce sont les écrans qu'on a ramenés sur des jetons qui existent.

L'autre sens ne refuse rien : il compte **13 jetons déclarés que rien n'emploie**, et c'est un
compte à lire, pas une faute à corriger.

### Ce qui reste écrit en clair, et pourquoi

Les tailles, les écarts et les durées **ne deviennent pas des jetons**. Un `--h-controle` qui
vaudrait `34` cacherait très exactement ce que `docs/DESIGN.md` ferme : ses listes *sont* des
listes de valeurs. Ce qui les tient est un contrôle — `py essais/essai_jetons.py` —, pas un nom.
Les couleurs et les arrondis restent des jetons : `#a8492c` ne dit rien à personne, et c'est là
que le nom sert.

### Ce qu'elle laisse

Le tableau de bord est **livré incomplet, et c'est écrit dans le fichier** : *ce qui manque le
plus* et l'addition d'un lot demandent des comptes que le serveur ne rend pas par famille, et
les calculer à l'écran donnerait un chiffre faux dès que la bibliothèque dépasse ce que la
grille tient en mémoire. `B5` les finit.

## V4 · D0 — le système de design réécrit — 6 septembre 2026

**La tranche a trouvé son sujet en se fermant, et pas en s'écrivant.** `docs/DESIGN.md`, son
spécimen et l'archive de l'ancien système existaient déjà en entrant — écrits le matin même,
en même temps que le plan de la version. Il restait à **vérifier** les cinq critères au lieu
de les affirmer, et c'est la vérification qui a rapporté.

### Le comptage n'avait été fait que dans un sens

Celui d'origine demandait : *ce que le document écrit, les planches l'emploient-elles ?* Bonne
question, et la réponse était oui. **La réciproque n'avait pas été posée**, et c'est par là que
ça fuyait : huit couleurs de châssis employées dans **21 à 40 planches sur 47** n'étaient
déclarées nulle part.

Elles avaient toutes la même cause, et elle tient en une phrase :

> **Un signal n'est pas une couleur, c'est un trio** — un fond, un trait, une encre.

Le document ne déclarait que le fond de chacun des trois signaux. Concrètement : **un bandeau
d'avertissement n'était pas dessinable à partir de `docs/DESIGN.md`**. `B0` l'aurait découvert
en écrivant la feuille de style, c'est-à-dire au moment le plus cher — celui où l'on cherche
une valeur qu'aucun document n'a.

### Le spécimen contredisait son propre document, et le damier dit pourquoi

Le même comptage passé sur le spécimen y a trouvé quatre écarts. Le plus instructif est le
damier : le document écrivait *« carreaux de 14 px »* **sans donner de couleur**. Le spécimen
avait donc rempli le vide avec ce qu'il avait sous la main — `#cfcfcf` sur `#b6b6b6`, le gris
de **l'ancien système sombre**, deux valeurs qui n'existent nulle part dans le carnet. Personne
ne l'avait vu : un gris sur du gris ne détonne pas.

⚠️ **Une valeur qu'un document ne donne pas ne lève aucune erreur** — elle est remplacée en
silence par la précédente. C'est la même famille de panne que `--color-signal-sourd`, qui était
déclaré et défini nulle part ; ici, l'inverse.

Après correction : **zéro valeur hors liste sur 415 éléments mesurés** au navigateur, tailles,
arrondis, écarts et couleurs confondus.

### Ce qu'elle change pour `B0`

Le garde-fou prévu ne regarde que ce que le code écrit. Il lui faut sa seconde moitié :
**lister les jetons que rien n'emploie**. Elle ne refuse rien — elle rend un compte, parce
qu'un jeton inemployé est soit une pièce pas encore dessinée, soit un jeton mort, et seul un
humain sait lequel.

### Et une chose que le dépôt cessera de faire

**Aucun document ne compte plus les planches.** Elles étaient 43 le matin, 47 le soir, et le
chiffre était écrit dans quatre documents — faux dans les quatre avant la fin de la journée.
*Tranché par l'auteur :* le dossier grandit avec les fonctionnalités, c'est normal, et on
construit sur ce qui est déjà dessiné et sur ce que le code tient déjà. **Ce qui fait foi,
c'est le dossier, pas son cardinal.**

## V4 · B1 — le miroir — 6 septembre 2026

**La V4 s'ouvre.** Une image se retourne, gratuitement, et le retournement est **une
place de la recette** — pas un bouton d'export. La distinction n'est pas de forme : une
place s'endort et se rallume sans se vider, se rejoue sans rien coûter, voyage avec une
recette nommée, et se lit à côté du titre quand la table est repliée.

Le pèlerin qui marche vers l'ouest cesse de se payer. Et **le vrai gain n'est pas
l'argent** : une génération rend *un autre* pèlerin, qui change de robe en se retournant.
Un miroir rend le même, au pixel près — mesuré, palette identique des deux côtés.

### La règle que la tranche pose pour toutes les suivantes

**Une place vide ne s'écrit pas dans l'empreinte.** Sans elle, une place de plus changeait
le JSON canonique de toutes les recettes du disque — donc leur empreinte, donc le nom de
leur rendu —, et **tout le cache se recalculait**. Elle ne vaut que pour la clé neuve : les
huit clés existantes s'écrivent toujours, `null` compris, et c'est ce qui garde le JSON
d'une recette d'avant identique au caractère près. Les 61 recettes distinctes du dépôt sont
figées avec leur empreinte d'avant, et un essai les compare à chaque passage.

### Ce que la vérification au navigateur a trouvé

**Le miroir ne retournait pas l'image**, et rien ne le disait. 1 529 essais de serveur,
778 d'écran, tous verts ; l'asset créé, filié, à zéro dollar, rangé dans la bonne case et
étiqueté `miroir · gratuit` — et à l'écran, les deux vignettes identiques.

La cause n'était pas dans la tranche : le service appliquait **deux fois** la queue de la
recette à chaque rendu. Sept places l'ont supporté sans qu'on le voie ; deux ne le
supportent pas — le contour, qui se retraçait autour de la silhouette qu'il venait
d'agrandir, et le retournement, qui est une involution. `en_rendu` sépare désormais
l'encodage de la chaîne, et deux essais tiennent la réparation **sur les octets servis par
la route** : c'est la seule façon dont ça pouvait se voir, tous les autres appelant `queue`
une fois.

*La tranche était complète, relue, et fausse.*

### Les directions d'un jeu sont libres, et la table du miroir se tait

Mesuré sur les 170 images du dépôt : les directions réellement écrites sont `bas`, `haut`
et `droite` — et `gauche` n'apparaît nulle part. Ni `bas` ni `haut` n'appartiennent à une
liste que le produit livre. La table des paires ne connaît donc que les identifiants
livrés et **se tait sur le reste** : deviner qu'un mot français désigne une direction
opposée serait la déduction que le produit refuse ailleurs. La direction se propose quand
on la connaît, et se demande quand on ne la connaît pas.

`sud` et `nord` se rendent eux-mêmes : le geste se grise avec sa raison, **avant** le clic.
Un miroir ne montre pas le dos d'un personnage.

Le détail — les cinq critères un par un, les trois défauts que la relecture a rattrapés, et
ce que la tranche laisse ouvert — est dans `docs/tranches/V4.md`.

## V3.03.3 — la bande se monte — 6 septembre 2026

Une animation gardée cesse d'être un tirage figé. Le ruban **se retire, se duplique, se
déplace** ; ce qu'on retire descend au **chutier** — la réserve de la bande, gardée avec elle
et relue avec elle — d'où chaque image se repose à la place qu'on choisit. « Prendre des
images dans le clip » rouvre la pellicule entière sans passer par le montage. Et
« Reprendre le montage › » rouvre le découpage sur *cette* animation, avec ses images et sa
vitesse : le cul-de-sac d'`A7` fermé par l'autre bout.

Les gestes du ruban portent sur la **sélection** de la V3.03.2, pas sur l'image qui passe.
Un essai le vérifie lecteur en marche, ralenti — l'arrêter d'abord effacerait le défaut avant
de le chercher.

### Le cadre se montre à la reprise, il ne s'y reprend pas

Le critère demandait « le cadre de la bande ». Le montage le montre, et ne le renvoie pas.
Un cadre de bande est un **rectangle mesuré** sur les images retenues ; la correction ne
remesure rien, et lui repasser le choix du montage — « le cadre du clip » — remplacerait ce
rectangle sans un mot. Il s'affiche donc en lecture, avec sa raison, et se règle là où il se
mesure. Même raisonnement pour une **bande mêlée** : le montage ne connaît qu'un clip, y
reprendre le découpage laisserait tomber les images empruntées, et le bouton s'éteint plutôt
que de mentir.

### Le chutier n'a pas demandé de migration

Une bande est un objet JSON dans une colonne : ajouter une réserve n'a coûté aucun schéma.
**Absent veut dire vide**, et c'est l'état de toutes les bandes d'avant — le chutier est une
réserve, pas un état qu'il faudrait deviner. La règle qu'il tient est sur les *prises*, pas
sur les numéros : une image dupliquée puis à demi retirée est légitimement au ruban **et** au
chutier, parce que ce sont deux prises et que chacune porte sa recette.

### Trois défauts que 765 essais d'écran ne voyaient pas

**Ils lisent un instant.** L'atelier jetable de la tranche, lui, tourne.

La fiche titrée « l'image choisie » suivait l'image *qui passe* : on choisissait l'image 14,
la fiche décrivait la 10, et taper un numéro remplaçait la 10. Deuxième fois en deux tranches,
dans un panneau différent — la V3.03.1 l'avait réparé pour les tables. Le partage qui tient :
un geste **instantané** tombe sur ce qu'on regarde, un geste qu'on **lit d'abord** tombe sur
ce qu'on a choisi ; et la flèche emmène désormais la sélection avec elle, si bien que les deux
se rejoignent au premier coup.

Les deux autres étaient sur le même trajet, celui du retour de montage. Le montage range les
images par numéro — juste quand il n'y a pas d'autre ordre, faux sur une reprise : refermer
rendait la bande **triée**, déplacements et duplications perdus, pour une seule image ajoutée.
Et la reprise ignorait le chutier à l'aller : une image mise de côté revenait **neuve**, sans
sa poussée ni sa recette, et restait dans la réserve par-dessus le marché. La leçon est dans
`docs/PIEGES.md` : **un aller-retour entre deux écrans se relit dans le sens du retour**, et
chaque chose que l'écran de départ savait et que l'écran d'arrivée ignore est une chose qu'il
faut lui rendre.

Les trois portent maintenant leur essai, et les trois essais tombent quand on défait le
correctif.

## V3.03.1 et .2 — une image de l'animation devient une image de l'établi — 5 septembre 2026

Deux tranches d'un coup, et la seconde ne tient que par la première. **Chaque frame d'une bande
porte désormais sa recette à elle**, facultative, née du premier réglage qu'on touche et copiée
de celle de la bande à cet instant ; puis **les tables se posent sur une sélection du ruban** —
une image, plusieurs, toutes. L'atelier d'une animation a repris la grammaire des tables : les
six panneaux de l'établi à gauche, la frame en grand au milieu avec son zoom, le ruban et le
lecteur à droite. Les trois curseurs sans nom d'`A7` ont disparu.

**Le montage, lui, est redevenu brut** : plus de boucle traitée, plus de panneau de recette. On
y juge le mouvement, pas le traitement — *une bande mal ramenée sur sa grille n'est pas jugeable*,
et l'inverse est vrai du mouvement sous un détourage.

### Un panneau qui clignotait onze fois par seconde

L'atelier s'ouvre en jouant. Les tables ont d'abord suivi l'image **affichée**, par analogie avec
les flèches — et le titre, la phrase d'écart et le bouton « reprendre la recette » apparaissaient
et disparaissaient à la cadence de l'animation. *On ne clique pas un bouton qui s'en va, et on ne
lit pas un panneau qui bat.*

**Les deux gestes n'ont pas le même temps, et c'est ce qui les sépare.** Une flèche est
instantanée : on regarde, on pousse, ça tombe là où l'œil était — la règle d'`A7`, et elle ne
bouge pas. Une table se *lit* avant d'être touchée, et lire prend plus longtemps qu'une image de
l'animation. Elle suit donc la frame **choisie**. Vu au navigateur, sur l'atelier jetable ; aucun
essai ne pouvait le voir, ils lisent un instant.

### Une valeur voyage, une recette remplace — et c'est toute la V3.03.2

Les tables rendent une recette **complète** à chaque geste : bouger un curseur renvoie toute la
recette de l'image regardée. L'écrire telle quelle sur les cinq images choisies leur donnerait
aussi les quatre valeurs qu'elles ne partageaient pas, **sans un mot**, et ça ne se verrait qu'à
l'export. Un réglage des tables ne déplace donc que ce qui a changé ; une recette nommée, elle,
remplace l'ensemble — *en prendre la moitié rendrait une image que personne n'a jamais jugée*.
C'est ce qui explique que la seconde soit le seul geste de l'écran à annoncer d'avance ce qu'il
écrase.

Corollaire trouvé en le construisant : **toute la bande choisie se règle sur la bande**, pas
image par image. Douze recettes individuelles identiques annonceraient douze écarts là où il n'y
en a aucun, le ruban se couvrirait de liserés, et « reprendre la recette de l'animation » n'aurait
plus rien à reprendre. Les recettes individuelles qui subsistent, elles, **suivent quand même** :
sans ça un curseur posé sur les douze n'en bougerait que neuf.

### Le critère de la main portait sur le mauvais risque

Le plan voulait la table de la main *grisée avec sa raison* sur une sélection de plusieurs images.
Deux choses l'ont déplacé en `V3.03.4`. La table n'existe pas encore dans cet écran, et **une
phrase expliquant pourquoi un geste absent est indisponible fait attendre ce geste**. Surtout, une
recette nommée **ne peut pas propager** de retouche : le serveur la lui retire à l'enregistrement
(`U5`, `US-342`). Le risque réel va dans l'autre sens — *remplacer tout l'ensemble* effacerait la
main que l'image avait. C'est celui-là qui est tenu, au seul endroit atteignable.

### Ce que la tranche a coûté ailleurs

Le socle serveur reçu du fil précédent était incomplet et l'annonçait fini : **l'aperçu jetait les
recettes de frame** — rappelé à chaque geste, il aurait rendu tout curseur posé sur une image sans
effet à l'écran jusqu'à l'enregistrement. La règle de partage des recettes est maintenant écrite
**une fois pour les deux chemins de la planche**, celui qu'on enregistre et celui qu'on regarde.

Et deux manques d'`A7` rapportés dans `BlocPasse`, où ils servent aussi l'établi : le durcissement
suit le moteur (`D1`), et la tolérance d'un moteur qui ne la lit pas laisse une phrase à sa place
au lieu d'un curseur mort.

**Les places d'une recette sont maintenant nommées à deux endroits** — le serveur les comparait
déjà frame par frame, l'écran doit dire ce qui est *séparé* dans une sélection que le serveur ne
connaît pas. Un essai tient les deux listes ensemble, comme pour les crans de cible et les noms de
moteurs avant elles.

## V3.02 — le clip a une fiche, comme une image — 5 septembre 2026

Une tranche, écrite et livrée le même jour, sans un centime. La galerie traitait les clips comme
des tuiles à découper : **le bouton « Ouvrir la fiche » était là, désactivé**. Un clic ouvre
maintenant la même colonne de droite que pour une image — la vidéo en boucle avec jeu et pause,
ce que le clip porte, ce qu'il a produit, et la porte du montage.

### Le serveur n'a eu qu'un champ, et c'est le bon signe

Tout le reste existait déjà : la route vidéo depuis `A9`, les demandes de plage depuis `A7` bis, la
liste des bandes d'un clip depuis `A10`, le texte corrigé du tiroir depuis `V3.01.1`. La seule chose
qu'aucun écran ne pouvait lire était **le sprite dont le clip est parti** : le fichier partait, la
filiation restait muette. Un champ `depart` sur le clip, écrit à la commande, relu comme tout le
reste — et les clips d'avant se relisent avec un départ vide, sans migration.

C'est la règle 8nonies payée une fois de plus **à l'envers** : ce qui manquait n'était pas la
chose, c'était l'écran qui l'emploie.

### La fiche est un état à part, jamais une sélection

Un clip ne sélectionne pas comme une image : les gestes de la barre d'outils — favori, supprimer,
exporter — sont des gestes d'image, et une clé de clip qui s'y mêlerait ferait *supprimer* tenter
d'effacer une vidéo payée. La fiche du clip tient donc un état à elle, et la colonne s'ouvre sur
l'un ou sur l'autre. Elle se referme avec sa tuile : un clip jeté quitte la grille, et une colonne
ouverte sur ce qui n'existe plus serait une porte sur un mur.

### Les portes de la fiche

- **Découper ›** ouvre le montage et referme la fiche : deux lecteurs du même clip ne luttent pas
  pour l'œil.
- **Une bande** du clip s'ouvre dans l'atelier d'une animation, par le codex — le passage inverse
  de celui qu'`A12` tient déjà.
- **Le sprite de départ** ouvre sa fiche d'image, qui remplace celle du clip : la colonne est une
  porte, jamais deux panneaux empilés sur la même question.

### Ce qu'un essai d'écran a payé, et qui aurait pu s'appeler flakiness

Le premier jet demandait au double de servir l'asset de départ **au flux seulement**, pas à la
route des assets. Or la galerie **relit sa grille au montage** : la route répondait « il n'y a pas
d'image », et la tuile du sprite s'effaçait sous la fiche — d'un essai à l'autre, à un timing près.
Le double doit passer l'état **aux deux endroits où le vrai serveur le tient**, et l'essai le
raconte dans son code plutôt que de le laisser invérifiable.

## V3.01 — la commande d'un clip se relit, et la liste de modèles se plie — 5 septembre 2026

Deux séances, deux tranches, et les deux sont nées de la même phrase de l'auteur en regardant
`EcranClip` : *« quand j'appuie sur commander ce clip, je n'ai à aucun moment la fenêtre de
confirmation »*. Il avait raison, et le cadre d'`A9` disait pourtant l'inverse : *l'écran de
commande **est** la confirmation*. L'usage a montré la limite du mot : l'écran de commande montre
ce qui part — le texte se lit, l'image est là, le bouton porte le montant —, mais il est plein de
réglages, et le texte ne se corrige pas.

### La relecture manquait, et elle tenait en trois colonnes

La première tranche (la 3.01.1) intercale un **tiroir** entre « Commander ce clip » et la
dépense : ce qui part (l'image et le format), le texte mot pour mot, le modèle et le montant du
lot. Le même contrat que l'écran des images, appliqué à un clip.

Deux choses le distinguent, et toutes deux sont des décisions, pas des oublis :

- **Le texte se corrige pour cet appel seulement.** La correction part, le mouvement de la
  bibliothèque ne bouge pas, et « remettre le texte du mouvement » le redonne intact. C'est le
  contrat de l'écran des images, rendu mot pour mot.
- **L'image de départ est obligatoire, et le tiroir le dit en toutes lettres.** Un modèle vidéo
  n'en accepte qu'une, et aucun plafond ne la fait céder (point 8bis) : proposer un interrupteur
  qui ne voudrait rien dire aurait été un mensonge de forme. On la change, on ne la retire pas.

Côté serveur, le changement tient en une résolution : le texte corrigé **prime** sur le
mouvement, qui reste inscrit sur la génération pour que le montage d'`A10` nomme ses bandes comme
avant. Sans correction, le comportement d'`A9` est intact — *le texte anglais n'a qu'un seul
endroit où il s'écrit*.

> ⚠️ **La garde refermée et rouverte.** La leçon d'`A7` — *un objet qu'on sait écrire et qu'on ne
> sait pas relire n'est pas fini* — s'est appliquée ici sans qu'on ait à la redécouvrir : un essai
> commande un clip au texte corrigé, **rouvre l'atelier**, et relit du disque son texte **et** son
> mouvement. C'est la forme que prend la règle pour une dépense : la garde se fait avec un texte
> retouché, jamais avec celui du défaut.

### La liste de modèles ne se laissait pas lire

La seconde tranche (la 3.01.2) répond aux trois demandes de l'auteur, et chacune a trouvé sa
place naturelle :

- **Le local gratuit en premier** — et la présélection a suivi sans une ligne changée : l'écran
  prenait « le premier non grisé », et le tri l'a fait tomber sur le moteur de la maison quand il
  est là.
- **Le tri par prix** — calculé au serveur, **pour la demande courante** : le prix change avec la
  durée, le format et la résolution, et le tri vit au même endroit que le calcul. L'essai le
  prouve dans les deux sens : un modèle au jeton passe devant un modèle à la seconde en carré, et
  derrière en 16:9.
- **Les cartes repliées** — repliée, une carte ne montre que le nom et l'estimation : c'est tout
  ce qu'il faut pour comparer. Le détail — formule, durée conseillée, mesure, raison du grisage —
  se déplie d'un **chevron distinct du geste qui choisit**, et il reste vivant sur une carte
  grisée : seul le choix est interdit, la lecture ne l'est jamais.

Le filtre « seulement ce qui peut partir », allumé par défaut, est venu avec : un atelier sans
clé a vingt-huit cartes grisées qui avaleraient la liste. Éteint, elles reparaissent, intercalées
par prix, et chacune se déplie pour lire pourquoi.

> ⚠️ **Le tri était inversé, et le serveur l'obéissait parfaitement.** La première clé mettait la
> maison *en dernier* — `1 if de_la_maison` — et le banc a rendu cet ordre-là, fidèlement : un tri
> faux et un serveur obéissant, sans aucune erreur. C'est l'essai qui **compare l'ordre rendu à
> l'ordre déclaré** qui l'a vu, pas une relecture du code. La leçon est celle d'`A5` : une mesure
> qu'on ne lit pas n'est pas une mesure — ici, un tri qu'on ne compare pas à son entrée ne trie
> rien.

### Ce que la tranche n'a pas demandé au cadre

Deux choses que l'auteur aurait pu demander et n'a pas demandées, et il vaut la peine de noter
pourquoi elles ne sont pas venues : **garder la correction** — elle ne remonte nulle part, et le
mouvement se corrige dans les Réglages, comme avant —, et **l'option de joindre la bible au
clip** — *ce clip n'hérite que de votre sprite*, la phrase d'`A9` reste vraie, et le tiroir ne la
force pas.

## A7 bis — trois demandes, et aucune ne demandait un mécanisme neuf — 5 septembre 2026

Trois remarques de l'auteur, nées du même usage : découper un clip du pèlerin, garder l'animation,
la reprendre. **Aucune n'ouvre de question** — chacune branche ou complète ce qui existait déjà.

### Le détourage ne se réglait que par sa tolérance

Et ⚠️ **la tolérance ne sert à rien sur trois moteurs sur quatre** : la pipette vise un point, le
modèle ne lit aucune tolérance, la sélection suit un tracé. L'écran offrait donc un curseur qui,
la plupart du temps, ne faisait rien — sans le dire.

Les quatre moteurs se choisissent maintenant, et **le durcissement suit celui qu'on prend**. C'est
la mesure de `D1` : à moteur égal la nature de l'image ne décide presque rien, et laisser le
durcissement du moteur d'avant est ce que l'auteur avait dû retaper trente-neuf fois sur quarante.

Un cas qui n'avait aucune issue : **une recette de jeu sans aucune passe**. Le fond restait, et il
n'y avait rien à régler ni aucun moyen d'ajouter un détourage. C'est un bouton, maintenant.

### Une recette enregistrée ne se posait que sur une image

Elle s'applique à une animation entière, et **elle remplace tous les réglages à la fois** : une
recette est un ensemble, en prendre la moitié rendrait une image que personne n'a jamais jugée.
Elle n'écrit rien tout de suite — sans quoi elle serait le seul geste de cet écran à ne pas
s'annuler.

### La vidéo payée ne se regardait nulle part

> ⚠️ **La route existait.** `GET /clips/{id}/video` sert le fichier depuis `A9`, et **aucun écran
> ne s'en servait**. Le montage montre la pellicule, la loupe et deux boucles — toutes tirées des
> *images extraites*. La vidéo restait sur le disque, joignable, invisible.

Ce n'est pas la même chose que les images, et c'est ce qui rend le manque réel : les images sont
figées et l'écran les rejoue à *sa* cadence, alors que la vidéo porte le rythme du modèle, ses
fondus, ce qu'il fait entre deux images. Elle se prend sur la boucle de gauche — celle qui demande
déjà *le mouvement est-il bon ?* — et pas d'emblée : ce qu'on vient faire sur cet écran est
découper, et les deux boucles sur le même métronome sont ce qui permet de comparer.

**La route sait maintenant répondre aux demandes de plage.** Sans ça la barre de lecture ne marche
pas : un navigateur qui ne peut pas demander « les octets 400 000 à 500 000 » ne sait pas se
déplacer dans une vidéo — il la rejoue depuis le début, ou refuse de la lire. Son lecteur envoie
d'ailleurs sa toute première demande en plage, avant même de connaître la taille du fichier.

### Ce que les trois disent ensemble

Aucune ne demandait un mécanisme neuf. Une route servait une vidéo que rien n'affichait ; un
curseur réglait une valeur que trois moteurs sur quatre ignorent ; des recettes nommées existaient
et ne se posaient que sur une image. **Ce qui manquait était le chemin, pas la chose** — et c'est
exactement la famille ② de la `V3.1`, *ce qui est construit et jamais branché*, retrouvée trois
fois de plus par l'usage, en une seule séance.

## A7 — reprendre une image sans refaire la bande : le vrai sujet n'était pas dans le plan — 5 septembre 2026

La dernière tranche de la V3, et **son sujet principal n'était écrit nulle part**. Le plan
promettait trois gestes de retouche ; ce qui manquait d'abord était l'écran où les faire.

### Une animation gardée était un cul-de-sac

Le produit savait garder une animation avec tous ses réglages — le cadre, la recette, la vitesse,
le sens, ses images — et **ne savait pas la rouvrir**. La vignette de la matrice remontait au
*clip* : l'écran repartait donc des réglages du jeu, et corriger une virgule demandait de tout
refaire de mémoire.

Trouvé par l'auteur à l'usage, dans les heures qui ont suivi la livraison d'`A4`. Une phrase de son
carnet : *« si je veux juste modifier un élément de détourage ou autre… je peux pas. »*

> ⚠️ **Aucun essai ne pouvait le voir**, et c'est la leçon de la tranche. Ils gardaient une bande
> puis vérifiaient ce qu'ils venaient d'écrire — la réponse du `POST`. Personne ne la rouvrait.
>
> **Un objet qu'on sait écrire et qu'on ne sait pas relire n'est pas fini**, et l'essai qui le dit
> est celui qui **referme l'écran avant de regarder**. Les trente-deux essais de la tranche le font
> tous : ils lisent ce qui revient d'un `GET`, jamais ce qu'ils viennent d'envoyer.

### L'écran, et pourquoi il n'est pas le montage

Le montage *taille un clip en animations* : on y choisit des images sur une pellicule. L'atelier
d'une animation *retravaille une bande gardée* : on y corrige une image à la fois. Deux écrans
parce que ce sont deux moments — **on ne taille pas et on ne corrige pas avec la même main**.

La grammaire est celle des tables : le réglage à gauche, la chose en grand au milieu, ses voisines
à droite. Ici les voisines sont les images de l'animation, et le lecteur — jouer, arrêter, la
vitesse — est sous elles, là où on les regarde.

**La vignette de la matrice ouvre l'atelier, son nom remonte au clip.** Deux portes, et elles ne
mènent pas au même endroit : l'une retravaille ce qui est gardé, l'autre retourne à la matière qui
l'a fournie. Avant la tranche il n'y avait que la seconde, et c'était tout le défaut.

### Le second défaut, trouvé au navigateur et par rien d'autre

L'animation tourne à l'ouverture. La première flèche arrive donc pendant que les images défilent —
et elle poussait la **première** image de la bande, celle que l'auteur ne regardait pas.
L'animation s'arrêtait ailleurs, et la correction se voyait sur une pose au hasard.

> **Les essais d'écran ne pouvaient pas le voir non plus, et il faut dire pourquoi** : leur premier
> geste était d'arrêter le lecteur, parce qu'une image qui change onze fois par seconde rend la
> suite illisible. Or arrêté, l'image regardée **est** l'image choisie : le défaut ne peut pas se
> produire. L'essai qui le tient est celui qui laisse tourner, à deux images par seconde pour avoir
> la marge — et il a été vérifié en défaisant le correctif.

**On corrige l'image qu'on regarde.** Une ligne de code, et il a fallu l'écrire exprès.

### « Jamais à moitié », une fois qu'il a fallu l'écrire

Le critère était court et le sens n'était pas donné. Ce qu'il a voulu dire :

1. **Le rectangle et la planche sont refaits dans le même geste.** Écrire l'un et laisser l'autre
   pour plus tard donnerait une bande dont la fenêtre est neuve et les pixels d'avant, sans que
   rien ne le signale.
2. **La fenêtre d'une animation se remesure sur ses images à elle, pas sur celles d'un clip.**
   Depuis cette tranche une bande peut puiser dans deux clips, et elle n'a alors de fenêtre dans ni
   l'un ni l'autre. Prendre celle du clip principal recadrerait les images empruntées sur un
   rectangle mesuré sans elles — et **ce qui dépasse ne se verrait pas dans l'atelier, il se
   verrait dans le jeu**.

Et ce qu'il ne veut pas dire : *à chaque changement* n'est pas *automatiquement*. Remesurer coûte
une vingtaine de secondes, donc c'est un bouton. Une fenêtre mesurée avec un autre détourage n'est
pas fausse, elle est **d'avant** — l'écran le dit dans ces mots-là, et personne ne paie les vingt
secondes sans raison.

### Une forme neuve qui relit l'ancienne sans migration

Une bande portait des numéros d'image ; elle porte maintenant des **prises** — un numéro, un clip,
un décalage. Deux décisions rendent la migration inutile :

- **Un clip vide veut dire « le clip de la bande ».** Une bande d'`A10` n'a donc rien à écrire.
- **La relecture accepte un entier aussi bien qu'un objet.** Les fichiers d'avant se rouvrent tels
  quels, et se réécrivent dans la forme neuve à la première correction.

Et `images` n'est plus un champ : c'est une **propriété dérivée** des prises. Deux champs à tenir
d'accord finissent toujours par diverger, et c'est l'auteur qui découvre l'écart.

### Ce que la poussée fait aux bords, et pourquoi

**Elle borne au lieu de rogner** — c'est la règle déjà posée pour le décalage de grille, reprise
ici : *aux bords, les boutons cessent d'avoir un effet.* Une correction qui mangerait un bras ne se
verrait pas sur l'image qu'on corrige, et se découvrirait dans le jeu.

Elle s'applique **après la réduction**, donc une pression de flèche vaut un pixel du sprite, pas un
pixel de la vidéo. Sans quoi le geste serait imprévisible : un pixel de vidéo ne se voit pas sur un
sprite de 48 px de haut.

### Les neuf ancrages, et ce qu'ils rendent possible

Deux jusqu'ici — le bas et le centre —, et ils suffisaient tant que l'ancrage n'était qu'un réglage
d'image isolée. Une animation a un point fixe, et ce point n'est pas toujours au milieu d'un bord :
une flamme au bout d'une torche tient par son haut, une porte qui pivote tient par son côté.

Les deux anciens valent exactement ce qu'ils valaient — un essai le tient, parce que changer la
valeur d'un défaut sous les bandes déjà livrées serait un dégât silencieux.

### Ce que l'écran offre comme clips, et ce qu'il n'offre pas

Aller chercher une image dans un autre clip est ce qui reste de l'ancienne `A3` : *quand deux clips
sont chacun bons à moitié, prendre une image dans l'un et une dans l'autre*. L'écran ne propose que
les clips **du même personnage**. Deux clips du même personnage ont la même silhouette, donc leurs
images se montent ensemble ; le clip d'un autre personnage donnerait une animation où le sujet
change au milieu, et l'offrir serait tendre un piège.

Ils portent leur repère court à côté de leur mouvement, parce que deux tirages de la même marche
portent le même mot et que la liste les rendrait indiscernables.

### Ce que la tranche n'a pas réparé, et qui a été vu au passage

Les curseurs de recette — taille du pixel, couleurs, tolérance — **n'affichent pas leur nom**. Le
composant reçoit le libellé et ne s'en sert que pour l'étiquette du champ de valeur. On lit donc
trois nombres à la file et il faut deviner lequel règle quoi. C'est vrai du montage depuis `A10`,
donc antérieur à cette tranche et hors de son périmètre — mais c'est écrit ici pour que la prochaine
personne qui ouvre cet écran ne croie pas l'avoir introduit.

## A5 — le contour qui ne bout pas : la mesure a coûté plus cher que la correction — 4 septembre 2026

**Deux décisions qui étaient *de l'image* deviennent *de la bande*** : la silhouette et la palette.
Et une mesure arrive avec elles — la première du produit qui regarde **deux images ensemble**.

### La leçon de la tranche n'est pas dans la correction, elle est dans la mesure

La correction tenait en une page : décider la silhouette au vote de majorité plutôt qu'au tirage
d'un pixel, et calculer la palette une fois pour la bande plutôt qu'à chaque image. Ce qui a pris
la tranche entière, c'est de **savoir dire si ça avait servi**.

Le plan écrivait la mesure en toutes lettres, et elle était fausse : *compter les pixels de contour
qui changent d'état d'une image à l'autre*. Ça compte **le vrai mouvement autant que le grésil**,
et le mouvement pèse tellement plus lourd qu'il l'enterre. Trois bancs de suite ont rendu un gain
nul sur une correction qui marchait.

La bonne mesure tient dans une phrase : **un pixel que le sujet traverse s'allume une fois et reste
allumé ; un pixel qui s'allume, s'éteint et se rallume est revenu sur ses pas.** Sur le même banc,
le même réglage fait **−6 % sur la mesure large et −33 % sur la juste**.

> ⚠️ **Une mesure trop large ne dit pas « il n'y a rien ». Elle dit « je ne sais pas regarder ».**
> C'est la phrase à retenir de cette tranche, et elle vaut bien au-delà d'elle : trois fois de
> suite, le réflexe a été de corriger le *sujet d'essai* jusqu'à ce que le chiffre bouge. C'est le
> chiffre qu'il fallait corriger.

### Une droite qui passe par le centre d'un carré le coupe en deux moitiés égales

C'est de la géométrie de collège, et c'est ce qui explique les bancs muets. Réduire une image en
prenant **le pixel du centre d'un bloc** et la réduire en prenant **la majorité du bloc** donnent
exactement la même réponse partout où le bord est droit à l'échelle du bloc — puisque la droite qui
passe par le centre le partage en deux.

Les deux chaînes ne peuvent donc différer que là où le bord **n'est pas droit** : les pointes, les
traits fins, et surtout les irrégularités au pixel près. Un sujet tracé par une équation n'en a
aucune. Un découpage réel en est plein, parce que la compression vidéo laisse le long de chaque
bord un **écho** de quelques dizaines de niveaux, redessiné à chaque image — et c'est cet écho qui
fait entrer et sortir des pixels du découpage. Le quatrième sujet du banc le porte, et il mesure.

### Les deux moitiés de la tranche n'ont pas la même portée, et il fallait le dire

Sur le clip d'`A10` — dessiné à la main, bords nets et droits —, la moitié « silhouette » ne change
**rien du tout** : neuf cent vingt-cinq allers-retours des deux côtés. L'atelier jetable l'imprime
au lieu de le taire. Ce qui s'y voit très bien, en revanche, c'est la palette : quarante-quatre
couleurs dont neuf ne duraient qu'une image, contre quinze dont aucune — et les deux images animées
ne pèsent même pas le même poids.

Annoncer un gain global aurait été plus flatteur et faux. **La silhouette gagne sur les images de
modèle vidéo ; la palette gagne partout.**

### Trois chiffres calculés, un seul affiché

L'écran ne montre que celui des allers-retours et celui des couleurs. Celui du bord qui change
voyage dans l'aperçu — il sert à qui compare deux réglages — mais **il ne s'affiche pas**, et un
essai d'écran est là pour que le rebrancher se voie. *Un chiffre à l'écran qui ne sait pas répondre
est pire qu'un chiffre absent.*

Aucun des trois n'est un seuil : le produit n'en tire aucun refus et n'en grise rien. Et la phrase
dit à l'auteur ce que le chiffre ne sait pas — revenir sur ses pas, sur une marche, **c'est
peut-être simplement un bras qui balance**.

### Ce que la tranche a réuni au passage

`monter` et `assembler` faisaient la même chose par deux chemins. Tant qu'aucune décision n'était
*de la bande*, ça tenait ; à la première — la palette —, les deux auraient divergé, et l'auteur
l'aurait découvert par l'écart entre son aperçu et son export. Elles partagent maintenant `_rendre`,
et ne se distinguent plus que par ce qu'elles rendent.

L'*avant* que le banc mesure est **joué par le produit lui-même**, par un drapeau que seuls le banc
et un essai posent. Un banc qui recopierait l'ancienne chaîne mesurerait sa propre copie, et il
continuerait d'annoncer un gain longtemps après que le produit aurait changé.

---

## A4 — la bande sort de l'atelier : la version devient livrable — 4 septembre 2026

**Une animation gardée devient trois fichiers** : une planche de sprites, le fichier
d'accompagnement qui la décrit, et une image qui tourne toute seule. Jusqu'à cette tranche, une
bande ne servait qu'à être regardée dans l'atelier.

### Le pronostic du plan s'est vérifié : ce qui s'ajoutait était le format, pas la machinerie

L'archive existe depuis `T6`, et c'est le seul geste du produit qui fasse sortir des images. La
planche de sprites, elle, existe depuis `A10`, et il n'y a qu'un endroit qui l'assemble. Ce que
la tranche a eu à écrire tient donc en trois choses : **le fichier d'accompagnement**, **l'image
animée**, et **deux boutons**.

### N'inventer aucun format n'est pas une intention, c'est un essai qui compte des clés

Le fichier d'accompagnement d'une planche de sprites le plus lu par les moteurs est celui
qu'écrit Aseprite, l'éditeur de pixel art. Ses clés exactes avaient été relevées avant que la
tranche ne s'ouvre, et elles sont écrites **telles quelles**. Ce que ça ouvre, sans une ligne de
plus :

- **Phaser** lit ce fichier d'une seule instruction et fabrique l'animation tout seul, parce qu'il
  sait lire les *étiquettes* que le format porte ;
- **l'extension Godot la plus installée** pour ce genre d'image lit le même fichier ;
- ses quatre champs de base sont aussi ceux de **l'outil d'atlas le plus répandu** — le fichier se
  lit donc **aussi** comme un atlas ordinaire par tout ce qui n'a jamais entendu parler d'Aseprite.

⚠️ **Un format emprunté ne se dégrade jamais d'un coup.** Il se dégrade d'une clé ajoutée « qui ne
gêne personne », puis d'une clé renommée pour faire plus clair, et six mois plus tard le fichier ne
s'ouvre plus nulle part. C'est pour ça qu'un essai vérifie **le jeu de clés exact**, un à un, et
refuse tout ce qui s'y ajouterait.

Une seule décision de forme a été prise : le format existe en deux variantes, l'une qui range les
images sous leur nom et l'autre qui les met en liste. *Le descriptif dit leur ordre* est un critère
de la tranche, et **l'ordre des clés d'un objet JSON n'est garanti par aucune norme**. La liste le
porte dans sa forme ; personne n'a à le rétablir.

### « Mêmes pixels » se rend vrai par construction, pas par discipline

Le sixième critère demande que ce qui sort soit exactement ce que l'aperçu montrait. Deux façons
de le tenir :

| | Ce que ça donne |
|---|---|
| Refaire les images pour l'image animée | deux chemins vers les mêmes pixels, à surveiller pour toujours |
| **Découper l'image animée dans la planche exportée** | les deux fichiers **ne peuvent pas** diverger : l'un est fait de l'autre |

C'est la seconde. Et la planche elle-même n'est pas recalculée par l'export : elle est demandée au
montage, le seul endroit du produit qui en assemble une.

### Le format de l'image animée : un PNG animé, pas un GIF

Deux raisons, et la première est un critère.

1. **Un GIF changerait les pixels.** Il ne connaît que deux cent cinquante-six couleurs et une
   transparence tout-ou-rien. Sur un sprite déjà réduit à seize couleurs il tomberait juste ; sur
   un décor sorti sans réduction, non — et il tomberait faux **en silence**.
2. **Un PNG animé est un PNG.** Une visionneuse qui ne sait pas l'animer affiche la première image
   au lieu d'échouer. C'est la meilleure façon de tenir *lisible sans moteur de jeu* : le pire cas
   est une image fixe, pas un fichier qui ne s'ouvre pas.

### Un nombre qui ne paraît nulle part finit par être faux

⚠️ La fiche d'une bande comptait la durée d'un aller-retour comme `images × 2`, ce qui suppose que
les deux bouts se rejouent au demi-tour. **Ni la vignette de la matrice ne le fait, ni le format
d'export** : sur quatre images, un va-et-vient en joue six — 0, 1, 2, 3, 2, 1 — et non huit.

Personne ne l'avait vu, et pour une raison simple : **ce nombre ne paraissait nulle part**. Il
vivait dans la fiche d'une bande, un essai l'affirmait, et aucun écran ne l'affichait. `A4` le fait
sortir de l'atelier — et un nombre qui part dans un fichier de jeu doit être celui que le fichier
joue.

> **La leçon générale** : un chiffre qu'aucun écran ne montre n'est pas vérifié par l'usage. Il
> l'est par ses essais, et un essai écrit en même temps que le code se trompe avec lui. La tranche
> qui fait *sortir* ce chiffre est celle qui le corrige.

### Deux sorties, et l'écran ne dresse aucune liste

Une sélection d'animations, ou toutes celles d'un personnage. La seconde compte : « les animations
de ce personnage » a déjà une écriture — celle qui remplit le calque animé de la matrice — et en
faire une deuxième à l'écran l'aurait fait diverger de la jauge qui la compte. L'écran nomme le
personnage ; le serveur rassemble.

Le bouton du personnage ne porte **aucun nombre**, et c'est délibéré : l'archive emporte aussi les
animations d'une attitude rangée sous le trait, que la jauge ne compte pas. Un chiffre affiché là
aurait annoncé moins que ce que l'archive contient.

### Ce que ça a coûté

Rien. Dix-huit essais côté atelier, six côté écran, aucun appel payant : l'atelier jetable monte
un vrai clip rendu par un double qui facture zéro, en taille deux animations, et **déplie l'archive
sur le disque avant même d'ouvrir** — c'est ce qu'il y a de plus utile à regarder, et l'écran ne
peut pas le montrer.

---

## A13 — l'image attrapée au vol : la version sort de l'animation — 4 septembre 2026

**Une image de la pellicule se met de côté, et elle entre en bibliothèque comme une image de
plus.** Une pose fixe, un objet, un détail de décor : ce qu'on en fait n'appartient plus à
l'animation.

### Le pronostic du plan s'est vérifié : il ne manquait qu'une destination

L'écran de montage avait déjà tout — les images extraites depuis l'arrivée du clip, la loupe parce
qu'à sept pixels de large on ne sait pas ce qu'on clique, la chaîne du jeu qui tourne sur l'aperçu
de droite. Le geste tient donc en **une route et un bouton**, et c'est la tranche la moins chère
de la version.

Ce qui a demandé du soin n'est pas le geste, c'est **où le poser**.

### Une surface qui porte un geste ne peut pas s'effacer au moment où l'on va le faire

⚠️ La loupe montrait l'image survolée et disparaissait dès que le pointeur quittait le ruban.
Parfait tant qu'elle ne faisait que **montrer** : on regarde, on part, elle n'a plus rien à dire.

Lui donner un bouton l'a rendue inatteignable, et d'une façon qui ne ressemble pas à un défaut :
on vise une image, on part cliquer le bouton, et il n'y a plus de bouton. Rien n'échoue, rien ne
lève ; le geste est simplement impossible.

La correction tient en une ligne — le survol ne se relâche plus en sortant du ruban — et le
clavier reprend la main en le remettant à rien, de sorte que la loupe suit **le dernier des deux
qui a parlé**. C'est une règle d'interface ordinaire, mais elle n'apparaît qu'au moment où une
surface passive devient active.

> **La leçon générale** : le jour où l'on pose un geste sur une surface qui n'en portait pas, il
> faut relire *quand elle disparaît*. Une surface qui ne fait que montrer a le droit de s'effacer
> au moindre mouvement ; une surface qui porte un geste, non.

### Pourquoi le geste n'est pas sur la cellule du ruban

Une cellule fait sept pixels de large. Lui demander de distinguer deux gestes — *prendre pour la
bande* et *mettre de côté* — reviendrait à viser au pixel près, cent vingt fois de suite, sur un
écran dont la loupe existe précisément parce qu'on n'y voit rien. La loupe, elle, montre déjà
l'image dont on parle : c'est la surface qui sait de quoi il est question.

Et **une image peut être les deux à la fois** : on garde le contact pour la bande *et* on prélève
la même image comme pose fixe. C'est pour ça que la marque du prélèvement est un trait en pied de
cellule et non un second encadré — deux encadrés sur la même cellule ne se distingueraient pas.

### Une image prélevée n'est pas une image importée

Les deux n'ont appelé personne et ne se relancent pas. Mais une image importée est arrivée d'un
disque, et **une image prélevée vient de quelque chose qui a été payé**. Elle porte donc un
« modèle » à elle — `clip` —, et une filiation qui nomme le clip, l'image, la génération qui l'a
payée et le mouvement demandé.

La filiation est écrite **dans la demande de sa génération**, donc dans le `generation.json` du
disque : elle survit à l'effacement de l'index, comme tout le reste de ce qu'on sait d'une entrée.
Sans elle, rien ne pourrait dire ensuite d'où l'image sort.

### Qui prépare, et qui fait entrer

⚠️ Le service de montage **prépare** un prélèvement — les octets, le nom, la taille à laquelle
l'espèce du personnage vit dans ce jeu, la filiation — et il ne le fait pas entrer. Lui donner le
service qui fait naître les images y aurait fait rentrer le catalogue et le fournisseur par la
porte de derrière, et **c'est cette privation qui autorise la phrase du pied de son écran** :
*rien ici ne dépense*.

C'est donc la route qui compose, comme celle du tableau de bord d'un personnage. Un routeur
assemble ; c'est très exactement son travail.

---

## A12 — la matrice sur deux calques, et l'objectif de la version atteint — 4 septembre 2026

**« Il manque la mort du nain » devient lisible en deux versions : l'image, ou l'animation.** La
matrice d'un personnage se lit désormais sur deux calques — les images fixes, et les animations —,
chacun avec sa jauge, et l'on passe de l'un à l'autre d'un geste.

### Pourquoi un calque, et pas un contenu de plus dans la case

C'est la décision de la tranche, et tout en découle. Si une case portait l'image fixe **et**
l'animation, elle serait « remplie » dès qu'elle a l'une des deux : une pose animée manquante se
cacherait derrière une pose fixe présente — très exactement ce que l'auteur vient voir.

Deux calques gardent aussi l'invariant d'`E2` intact au lieu de le tordre : *une case est prise
dès qu'une image la porte* ne devient pas *dès qu'une image **ou** une bande la porte*, il vaut
**deux fois**, une fois par calque.

> **La leçon générale** : quand deux choses différentes remplissent le même trou, les fondre fait
> disparaître celle qui manque derrière celle qui est là. Ce n'est pas une question d'affichage,
> c'est le compte lui-même qui devient faux.

### Le compte qui ne se multiplie pas, et c'est le seul du produit

Le calque des images compte **le produit de deux facteurs** : *tant d'images dans tant de
directions*. Une marche à huit images sur quatre angles en demande trente-deux, et c'est juste.

Le calque animé ne se compte pas ainsi, et c'est le seul endroit du produit où les deux divergent.
**Une bande porte déjà ses huit images dedans** : il en faut une par direction, pas une par image.
Rejouer la multiplication aurait demandé trente-deux animations pour une marche, et la jauge
aurait plafonné à un huitième pour toujours — sans que rien ne lève, et sans que le chiffre ait
l'air faux.

### Ce que seule la vraie chaîne pouvait montrer : une bande ne s'annonçait pas

⚠️ Tant que les bandes ne se voyaient que sur l'écran de montage — celui-là même qui venait de les
écrire —, personne d'autre n'avait à l'apprendre, et le flux n'en portait rien. C'était juste, et
ça a cessé de l'être au moment précis où le calque animé est né : **on découpe un clip dans la
galerie, et la case d'un personnage se remplit dans le codex, deux écrans plus loin.**

Sans annonce, la matrice aurait eu raison **jusqu'au prochain changement de projet**. Aucun essai
d'écran ne pouvait le dire : ils montent un serveur doublé qui répond déjà la bonne chose, et la
question n'est pas *que répond le serveur* mais *qui le lui redemande, et quand*. Ce qui l'a
montré est d'avoir cliqué la croix dans l'atelier jetable et regardé la jauge ne pas bouger.

> **La leçon, et elle a un jumeau dans `A11`** : un écran qui lit ce qu'un autre écrit a besoin
> d'une annonce, sinon il a raison **par accident** — parce qu'il vient d'être ouvert. Le jumeau
> d'`A11` disait la même chose de l'autre côté : un adaptateur refabriqué à chaque appel repart
> sans mémoire, et l'essai qui le garde ne le voit pas.

### La bascule *est* la jauge

Le critère demandait deux choses : passer d'un calque à l'autre d'un geste, et lire le total de
chacun. Les fondre en un seul objet — deux segments, chacun portant son compte — évite l'écran où
l'on lit un chiffre à un endroit et où l'on change de calque à un autre. Et ça met les deux totaux
**côte à côte** : *une pose dessinée sur six, une pose animée sur six*, leur écart est le sujet
même de la tranche.

Le calque des images reste le défaut, et c'est ce qui tient *un projet sans aucune animation se
comporte comme aujourd'hui* : on ouvre sur l'écran d'avant. La bascule, elle, est là même sans une
seule animation — sans quoi le calque animé serait inatteignable, et l'on ne pourrait jamais
commander le premier clip.

### Ce que la rangée animée n'a pas, et pourquoi

Pas de case à cocher : ce qui se coche part en **une planche d'images**, et une animation ne se
plie pas — un clip se commande case par case, avec son image de départ à lui. Pas de croix sur la
ligne : retirer une attitude au personnage est un geste du plan, il vaut pour les deux calques, et
il vit déjà sur celui des images. **Deux chemins vers la même décision finissent par se
contredire.**

La croix qui existe est ailleurs, sur la vignette, et elle ne défait qu'une désignation : la bande
redevient un brouillon, elle reste dans son clip, elle se réaffecte. Le clip, lui, a été payé une
fois — **aucun geste de la matrice ne peut le perdre**.

### Comment on éprouve une matrice animée sans payer un clip

Les animations de l'atelier jetable sont **écrites directement dans le dépôt**, avec leur planche
de sprites : quatre carrés de couleurs franches. Aucun clip n'est commandé, aucune vidéo n'est
décodée, et le décodeur vidéo cesse d'être une condition pour regarder une matrice. Ce qu'on
vérifie au navigateur est *que ça tourne* — quatre positions distinctes qui se suivent, lues au
script parce qu'une capture d'écran n'attrape pas un métronome.

---

## A11 — le moteur de la maison, et le prix qui tombe à zéro — 4 septembre 2026

**Le même clip, la même chaîne, la même bande — sur la carte graphique de l'atelier au lieu du
compte d'un fournisseur.** Rien de ce qu'`A9` et `A10` ont construit ne change : le clip revient,
ses images se tirent, il se découpe. Ce qui change est ce qui s'affiche à côté du bouton.

### Un prix de zéro n'est pas un prix inconnu, et le code confondait les deux

C'est la décision qui a demandé le plus de soin, et elle corrige une règle qui se serait retournée
contre le produit. Depuis `A9`, un modèle dont le tarif n'a pas pu être relu chez le fournisseur
est **grisé**, avec sa raison. La règle est bonne : elle interdit d'engager l'auteur sans savoir
ce qu'il engage.

Mais un moteur qui tourne sur la machine n'a **aucun tarif chez personne**, et son montant est
pourtant parfaitement connu — il vaut zéro. Appliquée telle quelle, la règle qui protège de la
dépense aurait grisé **le seul modèle qui n'en fait aucune**. Il a donc fallu une troisième
valeur : un genre de tarif de plus, un montant de zéro, et une formule qui dit *gratuit, la carte
de la maison* au lieu de multiplier quelque chose par zéro.

> **La leçon générale**, et elle vaut au-delà de cette tranche : *une absence de donnée et une
> donnée qui vaut zéro sont deux choses différentes, et un produit qui les représente pareil finit
> par refuser exactement ce qu'il devrait offrir.*

### L'invariant n'a pas été affaibli, il a changé d'unité

*Rien ne part sans que ce que ça coûte soit annoncé* était formulé en argent. Le tenir ici
demandait de le reformuler sans le desserrer : le bouton porte **un temps**, mesuré sur cette
machine et non deviné, et il le porte au même endroit et de la même façon qu'un montant.

Deux choses ont demandé plus qu'une conversion :

- **Le premier tirage n'a pas le même prix que les suivants.** Le modèle reste chargé en mémoire
  d'un clip à l'autre : le premier paie le chargement — relevé ≈ 7,6 s par image contre ≈ 4,7 s
  ensuite. Annoncer la seconde valeur pour le premier clip ferait attendre le double de ce qui a
  été promis, et **c'est exactement la même faute que d'annoncer un prix trop bas**.
- **Un lot ne se multiplie donc pas.** Quatre clips, ce n'est pas quatre fois le premier ; c'est
  le premier plus trois suivants. L'écran ne peut pas le déduire — ce sont deux mesures, pas un
  rapport —, et les deux voyagent ensemble jusqu'à lui pour cette raison.

### Les trois absences, et pourquoi elles ne peuvent pas se confondre

L'application du moteur peut ne pas être ouverte, ses fichiers peuvent ne pas être descendus, un
greffon peut manquer. Le réflexe serait une seule phrase — *le moteur n'est pas prêt*. Elle aurait
été fausse trois fois :

| Ce qui manque | Ce qu'on peut faire | Donc |
|---|---|---|
| L'application n'est pas ouverte | rien, depuis l'atelier | **le modèle est grisé** — l'atelier ne sait pas ouvrir une fenêtre à la place de quelqu'un |
| Des fichiers manquent | les rapatrier, d'ici | **le modèle reste choisissable**, et l'atelier propose. Refuser obligerait à sortir pour un téléchargement qu'il sait faire |
| Le greffon des gros pixels manque | rien, et ce n'est pas grave | **un avertissement** : le clip sortira, il sortira lissé. Un clip lissé se juge ; un refus ne se juge pas |

### Ce que la tranche a appris sur le fait d'avoir deux fournisseurs

Le produit n'avait jamais eu **deux animateurs**. Avec un seul, *ce qui manque au fournisseur*
grisait tous les modèles, et la formule ne portait pas à conséquence. Avec deux, elle aurait grisé
le moteur de la maison parce qu'une clé manque **ailleurs**.

Le routage se fait par le nom du fournisseur, qui voyage déjà sur chaque modèle depuis `A9` —
c'est lui qui permet de relire un clip payé des mois plus tard. Réemployer une donnée qui existe
plutôt que d'inventer un second registre est ce qui empêche les deux de diverger : **deux tables
qui disent la même chose finissent toujours par ne plus la dire pareil.** Le même raisonnement a
fait supprimer, dans cette tranche, le second traducteur de modèle en JSON qui vivait du côté des
routes : il avait *déjà* divergé, et l'écran des modèles ne recevait pas des champs que le flux
envoyait.

### Comment on éprouve une application qu'on ne peut pas démarrer

ComfyUI est une application tierce. On ne peut ni la lancer dans un essai, ni compter sur sa
présence, ni faire tourner une carte graphique quarante-neuf fois. Le double se branche donc à
**un seul endroit**, celui où l'adaptateur ouvre ses requêtes, et tout le reste du fichier est
exercé pour de vrai : la construction du montage, la lecture des listes de fichiers installés, le
tri des trois absences, la reprise d'un téléchargement coupé.

⚠️ **Le double rend les listes de fichiers sous les deux formes que ComfyUI emploie**, en
alternance. Les deux coexistent dans la même version de l'application ; n'en lire qu'une rend une
famille vide — donc *tous ses fichiers manquants* — sur une installation complète. Un double qui
n'aurait employé qu'une forme aurait laissé passer ça.

### Ce que les essais ne peuvent pas voir, et qui reste vrai

> ⚠️ **Plus le clip est long, plus la bande se dégrade — et aucune mesure automatique ne le voit.**
> Écart de taille, uniformité du fond, dérive de luminosité : les trois longueurs donnent les mêmes
> chiffres. Seul l'œil voit la lanterne se dédoubler et la cape fusionner avec le corps. C'est la
> **troisième fois** que ce dépôt le constate, après le banc des planches et le classement calculé
> qui avait été rejeté. La règle tient : *la mesure propose, l'auteur juge.*
>
> Ce que le produit en fait : il **recommande une seconde, et écrit la raison là où l'on choisit**
> plutôt que dans un document que personne n'ouvrira au moment de décider.

### Le geste de la vérification, et ce qu'il fallait pouvoir cliquer sans conséquence

La leçon d'`A10` — *les essais ne demandent jamais ce qu'un bouton fait* — a commandé la forme de
l'atelier jetable : **quatre décors sur quatre ports**, un par absence, plutôt qu'un seul dont on
aurait deviné le reste. Le bouton qui télécharge se clique pour de vrai dans le décor où il manque
des fichiers, avec un hébergeur doublé qui rend trois octets et un dossier de modèles jetable :
**tout le chemin du téléchargement s'exécute, et rien ne descend.** Le vrai bouton, lui, rapatrie
vingt-six gigaoctets dans le dossier du vrai ComfyUI — ce n'est pas une vérification, c'est un
geste que l'auteur décide.

Et une chose n'a été vue qu'à l'écran, comme toujours : les tailles s'écrivaient avec un point
décimal (« 8.9 Go ») juste sous une phrase du serveur qui disait « 8,9 Go ». Rien ne casse ; on
doute simplement que les deux parlent du même chiffre.

> ### ⚠️ Le défaut que seul l'atelier réel pouvait montrer
>
> Cinquante essais passaient, l'atelier jetable montrait les trois absences, et **le modèle ne se
> grisait jamais en production** — application éteinte comprise. L'auteur l'aurait découvert en
> cliquant sur *Commander*, c'est-à-dire à l'endroit exact où le produit promet de ne jamais
> proposer pour rejeter ensuite.
>
> La cause est une bonne habitude appliquée là où elle ne valait plus. Le dépôt refabrique ses
> adaptateurs à chaque appel, pour relire leur clé sur le disque sans redémarrer. Celui-ci n'a pas
> de clé, et il retient deux choses qui n'ont de sens que dans la durée : ce que la dernière visite
> a vu, et si un clip est déjà parti. Reconstruit à chaque appel, **il repartait sans mémoire**, et
> les deux valeurs restaient à leur défaut pour toujours.
>
> **Aucun essai ne pouvait le voir, et c'est le point.** Chaque essai construit son adaptateur et
> le garde — c'est-à-dire exactement la situation qu'il fallait corriger. Le double ne pouvait pas
> mentir sur ce point-là : il était, par construction, du bon côté. Ce qui l'a montré est d'avoir
> monté le vrai `Atelier` et lu ce qu'il répondait — trois lignes, hors de tout essai.
>
> La leçon rejoint celle d'`A9` et d'`A10` par un autre chemin : *ce qu'un double ne peut pas
> jouer, personne ne le vérifie.* Là où les deux tranches précédentes butaient sur ce qu'un essai
> d'écran ne rend pas — une couleur, un temps de rendu, un geste rapide —, celle-ci bute sur ce
> qu'un essai **construit lui-même** : la fabrique. L'essai ajouté monte donc la vraie fabrique du
> produit, et c'est le seul de tout le fichier dans ce cas.

## A10 — le montage, où un clip payé devient plusieurs animations — 4 septembre 2026

**Un clip de cinq secondes porte plus qu'une animation, et c'est tout le sujet de cette
tranche.** Le banc du 2 septembre l'avait montré deux fois : un texte minuté seconde par seconde,
avec un retour à la même pose neutre entre deux actions, rend un clip où le repos et la marche se
découpent séparément. Ce qui manquait était l'écran qui permet de les séparer — et de recommencer
dans le même clip autant de fois qu'on veut, **sans jamais repayer**.

### Ce qu'une bande est, et ce qu'elle n'est pas

Une bande **n'est pas une image de plus dans la bibliothèque**. La question s'est posée
franchement — la faire entrer comme un asset aurait donné gratuitement l'affichage, la sélection,
l'export — et c'est le critère d'`A13` qui a tranché : *une image prélevée entre en bibliothèque
**comme une image de plus***. S'il faut le dire d'une image, c'est que ça n'est pas vrai d'une
bande. En faire un asset aurait obligé chaque endroit du produit qui manipule une image à savoir
qu'un asset peut en porter douze.

Et ce qu'une bande garde n'est pas des pixels : **c'est une intention**. Des numéros d'image, un
cadre, une recette. Sa planche de sprites est un cache, effaçable sans rien perdre — la règle 5 de
l'architecture, sans exception. C'est ce qui rend vrai, *par construction et non par discipline*,
le critère qui comptait le plus : **ce qui sort est exactement ce que l'aperçu montrait.** L'écran
n'anime pas une liste d'images qu'un exportateur ré-assemblerait ensuite à sa façon ; il anime la
planche elle-même, celle que l'export écrira. Deux chemins vers les mêmes pixels finissent
toujours par ne plus les rendre identiques, et c'est l'auteur qui découvre l'écart.

### Ce que la machine remarque, et pourquoi elle le remarque deux fois

À l'ouverture, l'atelier lit le clip et pose deux phrases : *ici, il ne bouge presque pas* et
*ici, la boucle se referme le mieux*. **Elles ne décident de rien** — c'est la règle déjà écrite
de l'écran de découpe, et c'est elle qui fait qu'une machine qui se trompe ne bloque personne.

Les deux se cherchent avec des mesures différentes, et il le fallait : **un moment immobile est la
boucle parfaite, et la plus mauvaise animation qui soit**. Chercher les deux de la même façon
aurait toujours rendu le repos. La recherche de boucle exige donc du mouvement *à l'intérieur* du
cycle, en plus d'une bonne fermeture.

Elles ne se prennent pas non plus sur la même image : la fenêtre commune se mesure sur l'image
**recadrée**, parce que c'est le système de coordonnées de la mise sur grille ; le rythme se
mesure sur l'image détourée mais **non recadrée**, parce que recadrer chaque image sur sa propre
silhouette ramènerait le sujet au même endroit et ferait passer une marche pour un repos.

### La leçon d'`A9`, et les deux qu'elle n'avait pas encore dites

L'entrée d'`A9` finit sur une phrase : *écrire un serveur sans son écran, c'est écrire sans le
seul endroit d'où l'on voit ce qu'il fait*. Elle s'est vérifiée encore, et deux fois plus large.

> ### ⚠️ Six défauts, et pas un seul essai ne pouvait en voir un
>
> Trente-six essais côté atelier et dix-neuf côté écran passent aujourd'hui, et pas un seul de
> ceux qui existaient avant ne voyait quoi que ce soit. Ce que le premier quart
> d'heure devant un vrai atelier a trouvé :
>
> 1. **Aucune des deux propositions ne paraissait**, sur un clip qui porte exactement les deux. La
>    mesure prenait la médiane du mouvement pour repère, et un clip dont la moitié des images ne
>    bougent pas a une médiane nulle : **la détection se taisait exactement quand le repos était le
>    plus long**, c'est-à-dire dans le cas qu'on cherche.
> 2. *Une de plus ferait tomber ce prix à…* **annonçait le même prix**. Avec zéro bande gardée,
>    « une de plus » se calculait sur zéro.
> 3. **Le liseré des images retenues ne s'était jamais dessiné.** Le style écrivait `var(--signal)`
>    et le thème déclare `--color-signal`. **Une couleur inconnue ne fait pas d'erreur, elle ne
>    fait rien** — ni la compilation, ni les types, ni le navigateur d'essai n'avaient de quoi le
>    voir, parce que celui-ci ne résout pas les variables de couleur.
> 4. Rejoindre le bouton *Garder* au clavier demandait **cent vingt et une pressions** : toutes les
>    cellules du ruban étaient dans l'ordre de tabulation.
> 5. **Le bouton *à la main* n'ouvrait rien.** Les trois choix de cadre s'affichaient, l'écran
>    disait lequel était en usage, et *à la main* allumait un mode que rien ne permettait de
>    régler. Les essais demandaient ce que le bouton **dit**, jamais ce qu'il **fait**.
> 6. Une fois le cadre construit, **tirer un bord ne faisait rien** — et quand ça faisait quelque
>    chose, ça déplaçait la boîte au lieu de l'agrandir.
>
> Les deux dernières portent chacune une leçon générale.
>
> **Un geste rapide passe avant le rendu.** Les écouteurs de glissement étaient posés dans un
> `useEffect` déclenché par un état posé au `mousedown` ; l'effet s'exécute **après** le rendu, et
> un coup sec envoie son `mousemove` et son `mouseup` avant. Le geste ne faisait alors rien du
> tout, sans la moindre erreur nulle part. Un humain lent ne s'en aperçoit pas — c'est précisément
> ce qui rend le défaut durable. **La même course dormait aux poignées de la pellicule** ; elle y
> est corrigée aussi, et le motif est banni : les écouteurs se posent dans le geste.
>
> **Un `mousedown` sur un bord remonte à ce qui le porte.** Sans `stopPropagation`, le rectangle
> l'entendait comme *déplacer*, et le dernier geste déclenché gagnait.

### Deux familles d'essais qui ne voient rien, et ce qu'on en fait

`A9` avait nommé le trou : *aucun essai ne rouvre un atelier déjà rempli, aucun ne recharge une
page*. Il faut y ajouter deux lignes, découvertes ici :

- **Les essais d'écran ne résolvent pas les couleurs.** Un nom de variable inventé passe partout.
  Un essai a été ajouté qui refuse, dans tout l'écran de montage, un `var(--…)` dont le nom ne
  commence pas par `color-` — la seule famille que le thème déclare.
- **Les essais ne demandent jamais ce qu'un bouton fait.** Ils vérifient qu'il paraît, qu'il porte
  le bon mot, qu'il est allumé. C'est ainsi qu'un mode entier a pu s'afficher sans rien ouvrir.

Le reste est resté vérifié à la main, dans un atelier jetable sur le port 8432, dont le clip est
fabriqué sur place : vingt-quatre images, douze immobiles et douze où un bras s'allonge puis se
replie, **pour que les deux propositions aient une réponse connue d'avance**. La planche servie
par l'export y a été comparée octet pour octet à celle que l'aperçu montrait ; la page a été
rechargée, l'écran rouvert, et la bande gardée était toujours là.

### Le chiffre qui manquait à la version

Personne ne sait combien de clips il faut payer pour une animation utilisable. L'écran affiche le
prix par bande de ce clip-ci et le voit baisser à chaque bande gardée — 0,067 $ pour une, la
moitié pour deux. **C'est cet affichage-là qui produira le chiffre**, à l'usage, sans banc
supplémentaire. Il n'y avait pas d'autre façon de l'obtenir : un banc aurait mesuré ce qu'un
opérateur pressé garde, pas ce qu'un auteur garde.

## A9 — commander un clip, et l'attendre — 4 septembre 2026

**Le serveur savait commander un clip depuis la veille, et il ne servait à rien.** La tranche
avait été ouverte en écrivant d'abord la mécanique — comment on demande une vidéo, comment on
l'attend, comment on la range — en remettant l'écran à plus tard. C'était une exception assumée,
et elle a coûté exactement ce qu'une exception de ce genre coûte : **trois défauts que cinquante
essais n'ont pas vus, et que la première minute passée devant un vrai atelier a montrés tous les
trois**.

> ### ⚠️ Ce qui rendait ces trois-là invisibles est une seule chose
>
> Chaque essai monte un atelier **neuf**, par un client d'essai, fait son geste, et s'arrête.
> **Aucun ne rouvre un atelier déjà rempli. Aucun ne recharge une page.** Or les deux défauts
> graves vivaient précisément dans *la deuxième fois* :
>
> - **L'atelier ne redémarrait plus du tout.** À l'ouverture, l'atelier repasse sur ce qui est
>   arrivé pendant qu'il dormait et fabrique les images qui manquent. Il tombait sur trois clips
>   payés, tentait de découper un fichier vidéo comme une image, et s'arrêtait là. Pas une tuile
>   cassée dans un coin : **plus d'atelier**, plus rien, sur un dépôt dont tous les essais
>   passaient.
> - **La galerie était vide** alors que trois clips payés dormaient sur le disque. Un clip est
>   *réussi* dès qu'il arrive, donc il quittait la file des choses en cours — et rien ne prenait
>   le relais, puisqu'un clip n'entre jamais en bibliothèque. Il disparaissait en arrivant.
>   **C'est mot pour mot le défaut réparé pour la planche** quelques tranches plus tôt : la même
>   chose ne se range pas au même endroit selon qu'elle est en route ou arrivée.
>
> Le troisième était moins grave et plus gênant à voir : la ligne qui explique le prix — celle
> dont tout l'objet est de rendre un montant vérifiable de tête — s'écrivait en notation
> savante, avec un point à la place de la virgule et un compte de milliers collé d'un bloc.
> **Un nombre qu'on n'arrive pas à lire ne vérifie rien.**
>
> *La leçon ne porte pas sur les clips. Elle porte sur l'ordre : écrire un serveur sans son
> écran, c'est écrire sans le seul endroit d'où l'on voit ce qu'il fait.* Le reste de la version
> ne recommence pas.

**Le produit avait une règle qui disait *deux lieux seulement d'où l'argent part* ; ils sont
trois.** On ne commande pas une animation depuis la barre de saisie qui sert à faire des images :
il n'y a là ni durée, ni format, ni image de départ obligatoire, et les entasser dans une barre
qui marche aurait abîmé la barre pour loger l'exception. **Ce qui protégeait vraiment l'auteur
tient toujours** : l'argent ne part jamais sans un écran qui recouvre tout le produit, montre ce
qui va partir, et porte le montant sur son bouton. Ce qui passe de deux à trois est un compte,
pas une garantie — et c'était le bon moment pour le dire à voix haute plutôt que de laisser la
règle vieillir en silence.

**La porte de cet écran est une case de l'établi, et de là seulement.** *Animer ›* est posé à
côté de *Fabriquer ›*, sur la ligne d'une attitude et sur celle d'une direction. La raison est
courte : **c'est la case qui sait ce qu'on anime**, donc c'est elle qui peut proposer une image
de départ juste. Une porte ouverte ailleurs — un bouton dans la galerie, une entrée de menu —
aurait ouvert l'écran sans savoir de quoi il parle, et aurait rendu obligatoire un choix que la
case rend automatique. Changer d'image reste possible d'un clic, depuis l'écran.

**La notion de *portrait* n'existait nulle part dans le produit, et elle n'a pas été inventée
comme objet.** Il fallait bien une image de repli quand la case visée est vide ; il n'a pas
fallu pour autant un nouveau champ, une nouvelle case à cocher, un nouveau statut à tenir à
jour. La règle est écrite une fois, en toutes lettres, à l'endroit qui répond à la question —
la première image mise en avant du personnage, sinon le corps retenu de sa première attitude.
**Une règle nommée est moins chère qu'un objet nommé** : elle ne se désynchronise de rien.

**Un lot de clips porte une marque écrite, pas une marque devinée.** Un geste peut lancer
jusqu'à huit clips d'un coup ; quand l'auteur en garde un, les autres partent. Il aurait été
tentant de reconnaître les frères par leur texte et leur heure — c'est gratuit et ça marche
presque toujours. *Presque* : le jour où l'auteur relance deux fois la même chose, ça jette la
mauvaise vidéo payée. Chaque clip porte donc le nom du geste qui l'a lancé, et rien n'est
déduit. ⚠️ La borne à huit est **une borne de sécurité, pas la règle des huit tirages** — celle-là
dit ce qu'il faut voir avant de juger un modèle, celle-ci dit ce qu'un seul clic a le droit de
payer.

**Et un clip écarté n'expire pas.** Une image supprimée se rattrape pendant quelques secondes,
puis c'est fini ; un clip écarté, lui, reste là indéfiniment — il quitte la galerie, il ne quitte
ni le disque ni le journal des dépenses. Le bandeau qui propose de les rendre n'a donc **aucun
compte à rebours**, et le code dit pourquoi : un compte à rebours annoncerait une échéance qui
n'existe pas. On ne fait pas payer à l'auteur la peur de perdre quelque chose qu'on ne jette
jamais.

---

## A2 — le cadre qui ne dérive pas — 4 septembre 2026

**Le commentaire du code disait l'inverse de ce que la ligne faisait.** Il affirmait que la case
carrée *fait que deux images d'un même personnage se superposent au lieu de flotter*. La ligne
juste en dessous calculait l'échelle sur la boîte de **l'image courante** — donc sur ce que
*cette* image occupe, et rien d'autre. Le code connaissait la dérive horizontale : `E17` lui a
donné un décalage à rattraper à la main. Il ne connaissait pas la dérive d'échelle, qui est la
fatale — on peut recentrer un personnage à la main, on ne peut pas le redimensionner case par
case.

> ### ⚠️ Le pire cas n'est pas celui que la tranche annonçait
>
> Le plan disait *un bras tendu agrandit la boîte, donc réduit tout le personnage*. C'est vrai, et
> **c'est le petit cas** : sur les quatre clips mesurés, un bras tendu coûte 1 à 5 %, parce que la
> hauteur reste le côté long et que l'échelle se prend dessus.
>
> **Le gros cas est l'accroupi, et personne ne l'avait vu venir.** Un personnage qui s'accroupit a
> une boîte plus *courte* ; l'échelle la ramène à la case, donc elle le **grossit**. Mesuré sur
> `melange-lanterne-accroupi` : **17,2 % d'écart entre deux images du même clip**. C'est-à-dire un
> personnage qui enfle d'un sixième en se baissant.
>
> *La dérive la plus violente vient de ce qui raccourcit le sujet, pas de ce qui l'élargit.*

**La méthode de mesure a dû être corrigée avant la mesure.** Le chiffre du 3 septembre — *37 px de
large au repos, 41 en marchant, il grandit de 10 %* — mesurait la **largeur du sprite rendu**. Or
un personnage qui marche *est* plus large qu'un personnage au repos : ce chiffre-là mélangeait une
différence de pose et une dérive de cadrage, et il n'était donc pas relisible. Ce qui se mesure
maintenant est **le facteur appliqué** — le nombre par lequel chaque image est réduite. Il doit
être constant dans un clip ; tout ce qui l'en écarte est de la dérive, et rien d'autre.
`essais/mesures_fenetre_commune.json` porte les quatre clips.

**La réparation tient en un argument facultatif, et c'est ce qui la rend sûre.** `sur_grille`
accepte une `fenetre` ; sans elle, **rien ne change d'un cheveu** — une image déjà faite rend
exactement les octets qu'elle rendait, et un essai le tient au byte près. Une correction de cadrage
qui aurait retouché toutes les images du dépôt aurait été une régression, pas une réparation.

**Le corollaire d'ordre a demandé une conversion qui n'était pas prévue.** Le nettoyage des taches
doit précéder le calcul des boîtes — sinon une ombre isolée sous les pieds soulève le personnage,
puisque l'ancrage pose le bas de la boîte sur le bas de la case. Mais `Bords.aire_min` compte des
pixels **de la case du projet**, 64 carrés de côté, parce que le nettoyage s'y fait *après* la
réduction. Appliqué tel quel à une image de 480 px, il n'écarte rien : une ombre de deux carrés y
pèse quelques centaines de pixels. Le seuil se convertit donc par le carré du facteur de réduction
— une surface se convertit au carré d'une longueur. Sur `melange-lanterne-accroupi`, **2 814 taches
écartées** ; sur le moonwalk, 10.

**Et l'assise commune se paie, ce qui n'était pas dit.** La fenêtre du clip doit contenir tous les
extrêmes : le sujet sort à 56 px au lieu de 60 sur le clip le plus agité — 7 % de moins. C'est le
prix d'une taille qui ne bouge jamais, et c'est exactement pourquoi `A10` garde deux autres cadres,
la bande et la main.

**Ce que la tranche n'a pas fait, volontairement.** Aucune route pour la fenêtre d'un clip :
l'écran de montage dira ce qu'il lui faut, et bâtir la route avant l'écran serait bâtir la
mauvaise. ⚠️ **Un chiffre pour celui qui la posera** : détourer et mesurer les 121 images d'un clip
prend une vingtaine de secondes. Acceptable une fois, insupportable à chaque cran de curseur — la
fenêtre devra se garder.

---

## A6 — le mouvement, dit une fois pour toutes — 4 septembre 2026

**La V3 s'ouvre, et par sa plus petite tranche.** *« On ne commande pas un clip sans nommer ce
qu'on demande »* : c'est la phrase du plan, et elle explique pourquoi cette tranche-là passe avant
l'écran qui paie.

**Ce qui manquait n'était pas une liste.** Le produit savait dire une pose depuis `E10` — la case
« marche » sait qu'elle s'écrit `walking posture, full body`. C'est une **posture figée** : juste
pour une image, fausse pour un clip, où il faut dire que ça boucle. Ajouter une seconde liste à
côté des poses aurait été le réflexe, et c'était le piège : deux listes concurrentes finissent par
diverger, et l'auteur découvre l'écart sur une case, un jour, sans savoir laquelle des deux ment.
**Le lien se fait donc par l'identifiant seul** — la pose `marche` trouve le mouvement `marche` —,
et il n'y a rien à relier, rien à cocher, rien à tenir d'accord.

**Ce que la correspondance a coûté à écrire : rien, et c'est le résultat.** Les sept mouvements
livrés recouvrent exactement le plan de poses de départ, plus le saut. Un atelier neuf sur un
projet neuf sait donc animer ses six cases sans qu'une ligne soit écrite. Un essai le tient, parce
que la correspondance serait fausse d'un mot et que rien ne le signalerait.

> ### Ce que les textes livrés portent, et qui vient des bancs payés
>
> Deux précautions reviennent dans chacun des sept, et aucune n'est un ornement.
>
> **`in place, without moving across the frame`** — sans elle, le personnage traverse le cadre.
> La fenêtre commune d'`A2` se prend alors sur tout ce qu'il a parcouru, et la bande sort avec un
> personnage minuscule au milieu de beaucoup de vide.
>
> **`returning to the neutral stance`** sur ce qui n'est pas un cycle — le saut, l'attaque, les
> dégâts. C'est ce que le banc du 2 septembre a découvert deux fois : un texte qui ramène au repos
> entre deux actions rend un clip où **repos et marche se découpent séparément**. C'est la
> découverte qui commande tout l'écran de montage, et elle est maintenant écrite dans le
> vocabulaire plutôt que dans une tête.

**Les deux choix tranchés seuls.** *Le bloc est dans les Réglages*, parce que c'est l'écran qui
tient déjà ce qui ne dépend d'aucun jeu — la clé, les garde-fous, le dossier. On y **écrit** un
mouvement ; on le **choisira** ailleurs, sur l'écran de commande d'`A9`, qui ne fera que lire cette
liste. Deux endroits qui l'écriraient finiraient par en montrer deux. Et *masquer ne veut pas dire
la même chose des deux côtés* : un livré laisse une pierre et se remontre, un fabriqué s'en va pour
de bon — le motif exact des étiquettes livrées, repris tel quel parce que le catalogue se relit à
chaque lecture et rendrait un livré effacé à la ligne suivante.

**Ce que la tranche n'a pas fait, et qui se verra en `A9`.** Le texte d'un mouvement n'est encore
parti dans aucun appel : rien de cette tranche ne parle à un fournisseur. Ce qu'elle a mesuré est
donc ce qu'un écran affiche et ce qu'une route rend, pas ce qu'un modèle en fait. **La première
fois qu'un de ces sept textes sera jugé, c'est un clip payé qui le jugera.**

---

## M7 — le détourage de départ redevient complet, et se règle depuis l'image — 4 septembre 2026

**Une remarque en deux moitiés, et la seconde était le vrai reproche.** L'étape *Le détourage de
départ* n'offrait que deux des quatre réglages qu'elle commande ; et elle est la onzième des douze
étapes de l'univers, c'est-à-dire un endroit qu'on traverse **en réglant son jeu, donc avant d'avoir
fabriqué la moindre image** — alors qu'on ne sait quel détourage convient qu'après en avoir vu
quelques-unes.

> ### ⚠️ Le chiffre qui avait servi à cacher deux réglages ne se retrouve pas
>
> `D1` les avait écartés **délibérément et par écrit**, sur un comptage : *« comptées sur les 123
> passes écrites à la main, la tolérance est restée à sa valeur livrée 96 fois sur 100, et le seuil
> de transparence aussi »*. L'intention était juste — ne pas assommer avec ce que personne ne
> touche.
>
> **Recompté sur les 147 passes du dépôt, le chiffre ne vaut que pour l'un des deux.** La tolérance
> a été déplacée 13 fois, soit une sur onze : pour elle la décision tenait, de justesse. Le seuil de
> transparence l'a été **34 fois, près d'une sur quatre**, dans cinq projets sur six, et vingt-deux
> de ces trente-quatre fois avec le moteur du modèle — précisément celui dont l'écran ne laisse pas
> non plus choisir le modèle.
>
> **La sélection était juste pour un des quatre** : le réglage le plus déplacé de tous — le bord
> rongé, une fois sur deux — est bien celui que l'écran offrait. Les trois autres étaient écartés à
> tort, et le plus employé des trois l'était sur un chiffre faux.
>
> La leçon n'est pas *« ne pas mesurer »* — c'est l'inverse. Une mesure faite sur un sous-ensemble
> qu'on ne nomme pas décide comme si elle valait pour tout, et personne ne peut la relire. Celle-ci
> a décidé de ce qu'un écran montre pendant un jour entier.

**Les quatre reviennent visibles, et non repliés.** *Tranché par l'auteur.* Le nombre de contrôles
d'un écran d'assistant se règle par le repli de **l'étape entière** — c'est ce que `G8` fera —, pas
par le repli de chacun de ses réglages : un réglage replié dans un bloc replié est un réglage que
personne ne verra jamais.

**Le modèle de silhouette n'y revient pas.** *Tranché par l'auteur.* Celui qui s'annonce comme lourd
ne détoure rien du tout aujourd'hui : la bibliothèque ne connaît pas ce nom-là et retombe en silence
sur le rapide. Offrir un choix dont un des termes ne fait rien serait pire que de ne pas l'offrir.
Il attend `G13`.

**La ligne vide dit enfin ce qu'elle cache.** Tant qu'aucun moteur n'est choisi, il n'y a rien à
régler — et rien ne le disait : l'auteur a lu le bord rongé comme **absent du produit**. Elle dit
maintenant *choisis un moteur pour régler la tolérance, le seuil et le bord rongé*, à la suite de ce
qui décidera à sa place.

### Le mauvais moment se répare par l'autre bout

**On ne déplace pas l'étape.** Son rangement est juste : elle décide de ce que l'atelier fait de
l'image **au retour**, comme les emplacements et les modèles. C'est le geste qui manquait, pas la
place de l'étape. Depuis la table de détourage d'une image, *enregistrer ce réglage comme défaut du
projet* fait de ce qu'on vient de régler — et de voir — le défaut du jeu. L'étape devient la
**relecture de ce qu'on a promu**, et elle le dit.

**Ce qui restait ouvert est tranché, et le domaine en avait déjà décidé une moitié.** *Ce qu'on
promeut exactement* n'était pas une préférence : **un défaut ne porte qu'une passe**, et le domaine
retire au passage ce qu'une passe a de propre à une image — le point de la pipette, le tracé à main
levée. Le geste promeut donc **la première passe**, et ce n'est pas arbitraire : c'est celle qui
s'applique à une image que personne n'a encore touchée, les suivantes corrigeant *cette* image-là
sur ce que la première a déjà retiré. L'écran le dit quand il y en a plusieurs, et il dit que le
point visé ne part pas quand la première en a un.

**La portée par défaut n'existe pas, et c'est la réponse à l'autre moitié.** Les deux que le produit
connaît sont proposées côte à côte — la nature de l'image, sa famille — et aucune n'est
présélectionnée : promouvoir dans la mauvaise se voit à la dixième image, pas à la première. Une
image dont le barème du jeu ne nommait pas la famille n'en propose qu'une, **sans bouton grisé** :
ce qui n'existe pas ne se grise pas.

> ### ⚠️ Le dictionnaire des familles repart entier, ou une famille se perd
>
> La route qui pose les défauts lit ce champ comme **la liste complète des familles réglées** — une
> famille absente du message est retirée. N'envoyer que celle qu'on vient de promouvoir effacerait
> les autres, sans un mot, et le jeu perdrait un réglage à chaque promotion. C'est la convention des
> modèles par famille ; un essai la tient désormais, parce que le défaut est invisible tant qu'une
> seule famille est réglée.

> ### ⚠️ Un champ de nombre borné à chaque frappe se réécrit sous les doigts
>
> Le seuil de transparence a **un** pour plus petite valeur. Le borner à chaque frappe y posait `1`
> dès qu'on vidait le champ, et taper `200` ensuite donnait `1200`, donc le maximum : la valeur
> qu'on visait devenait inatteignable autrement qu'en corrigeant chiffre par chiffre. Le champ garde
> désormais ce qu'on tape jusqu'à ce qu'on le quitte — le motif du champ de correction de `M3`, pour
> la même raison. Le défaut ne se voyait pas sur l'unique champ d'avant : *le bord rongé* va de zéro
> à quatre, un seul chiffre, et vider un champ dont le plus petit est zéro ne réécrit rien.

**Et le geste dit où relire son effet.** Il vit dans un autre écran que celui où on le fait : sans la
phrase qui nomme cet écran, on ne saurait ni si ça a marché, ni où aller vérifier.

**Aucun appel, aucun centime** : promouvoir un réglage n'appelle personne.

## M5 — la référence qui manque s'ajoute sans rien perdre — 4 septembre 2026

**Le défaut n'était l'oubli de personne : trois décisions justes se rencontraient.** Aucune n'est
fautive prise seule, et c'est ce qui l'a rendu invisible pendant deux versions. La fenêtre de
confirmation **recouvre tout le produit** — c'est ce qui en fait le seul endroit d'où l'argent part,
et c'est un invariant. Le geste qui fait repartir une image **va où son effet se voit**, donc il
change d'onglet. Et le tri — ce qu'on vient d'éteindre, d'allumer ou de réécrire — **repartait de
rien à chaque ouverture**, y compris après un changement d'onglet.

**Leur rencontre mettait l'auteur devant un choix que personne n'avait voulu lui imposer** : garder
ses corrections, ou ajouter l'image dont il venait de voir qu'elle manquait. Au pire moment — cette
fenêtre est le seul endroit du produit qui montre **quelles** références partent, donc le seul où
l'on s'aperçoit qu'il en manque une. On pouvait y décocher une image jointe ; on ne pouvait jamais
en ajouter une.

**La règle du tri est révisée par écrit, pas contournée.** Elle visait un vrai danger — un réglage
qui traînerait d'un appel au suivant — et elle reste. Ce qui change est **ce qu'elle appelle un
autre appel** : sortir chercher une image et revenir n'en est pas un. C'est le motif du dépôt, celui
de `G6`, `G7` et `G8` : on rouvre la décision à l'endroit où elle est écrite, avec sa nouvelle
raison.

**« Le même appel », et il fallait le dire.** Douze choses le décrivent, et ce sont exactement
celles qu'on choisit avant de payer : le texte écrit à la main, l'interdiction écrite à la main, le
modèle, le barème du projet, le nombre de variations, le projet ouvert, le fait d'avoir repris le
texte tel qu'il part, la chose du jeu visée, sa pièce d'équipement, sa direction, ses poses, ses
angles. **Deux absences sont délibérées**, et elles portent tout le sens de la tranche :

- **les images jointes n'y sont pas.** C'est le geste que la tranche rend possible ; les y mettre
  aurait vidé les corrections au moment précis de s'en servir.
- **la bible du jeu n'y est pas non plus.** Elle change *ce qui part*, elle ne change pas *ce qu'on
  demande*. Une ligne réécrite pour cet appel-ci reste sa correction, même si le monde a bougé.

L'appel qui **a** changé, lui, repart d'un tri vide comme avant, et un essai tient les deux cas —
c'était un critère à part entière, parce qu'une révision qui n'emporterait que le cas neuf laisserait
la moitié ancienne sans preuve.

**La surface de choix n'a pas été inventée.** L'invariant du produit dit *une seule grille d'assets
dans tout l'atelier* : celle qui s'ouvre par-dessus la confirmation **est** celle-là, avec ses
tuiles, son dépôt de fichier, son filtre. Elle arrive donc avec la recherche de la galerie, la même —
pas une seconde. C'était la contrainte principale de cette moitié, et c'est ce qui en fait un
réemploi plutôt qu'une neuvième façon de choisir une image.

**Elle se pose par-dessus, elle ne remplace pas.** La fenêtre de confirmation reste montée derrière,
et c'est très exactement ce qui fait que les corrections en cours ne bougent pas d'un caractère
pendant l'ajout : il n'y a rien à préserver, puisque rien n'est démonté. Un clic joint l'image, la
grille se retire, et l'effet est sous les yeux — la ligne entre dans la liste qu'on était en train de
lire, le compte monte, le prix suit. C'est ce qui rend le changement d'onglet inutile ici, sans avoir
à toucher à la règle qui l'impose ailleurs.

> ### ⚠️ *Arrêter la propagation* n'arrête pas ce qui écoute au même endroit
>
> L'aperçu et la grille de choix écoutent Échap **sur la même fenêtre**. Arrêter la propagation ne
> fait rien entre deux écouteurs posés là — les deux se déclenchent —, et une seule pression
> refermait l'image en grand **et** la grille. Ce qui les départage est la marque que le premier
> laisse : une touche déjà consommée ne se reprend pas.
>
> **Le code se lisait comme on l'avait pensé**, et c'est l'essai qui a trouvé, en demandant à trois
> surfaces empilées de se défaire une par une. C'est le piège déjà payé de la case qui ne change
> rien, sous une autre forme.

> ### ⚠️ Un second défaut, trouvé en vérifiant : la grille survivait à la sortie
>
> La grille de choix est un état **de la fenêtre de confirmation**, pas du produit. Sortir en la
> laissant ouverte — par l'onglet, qui remonte de toute profondeur — la reposait par-dessus la
> confirmation **suivante**, devant un appel qui n'avait rien demandé. Les quatre façons de sortir
> passent désormais par le même endroit.
>
> Et sa première version **recouvrait la barre du haut et celle du bas**, que même la fenêtre de
> confirmation laisse en place. Vu au navigateur, pas dans le code : une surface qui les efface dit
> qu'on a quitté l'atelier, au milieu d'un geste qui n'en sort pas.

**Ce que la tranche n'a pas fait, et c'était écrit d'avance.** Elle n'empêche pas *réinjecter* de
changer d'onglet depuis la fiche d'une image. Ç'aurait été utile s'il fallait continuer à sortir ;
on ne sort plus. La question se rouvrira si le geste court venait à disparaître.

**Aucun appel, aucun centime** — et c'est vrai des deux moitiés : choisir une image de référence n'a
jamais rien dépensé.

## M4 — la planche cesse d'être mal décrite — 4 septembre 2026

**Deux remarques écrites le même jour, sur le même écran, sans se ressembler.** *« Le gabarit qu'on
me propose, je ne l'ai jamais validé »* et *« pourquoi on parle de planche et de cases pour une
seule pose ? »* disent la même chose : **la planche est mal décrite, et elle l'est à trois endroits
différents.**

**L'écran nommait une image autrement que le texte qui part, au même instant.** Le texte disait
*voici la planche existante, n'y change que ce qu'on demande* ; l'écran, quelques centimètres plus
bas, *voici une grille vide, place les sujets dedans*. Deux demandes opposées pour une seule image,
au moment où l'on décide de payer — l'auteur cherchait un gabarit qu'il aurait validé, c'était son
propre corps, redessiné à la volée.

> ### La décision existait deux fois, et les deux copies avaient divergé
>
> Le serveur **savait** laquelle des deux c'était : une fonction écrite exprès pour qu'aucun rang ne
> se trompe, avec son commentaire — *une planche d'équipement en envoie une aussi, et c'est la
> planche elle-même, pas un gabarit*. Mais le **compte des images** refaisait le choix pour son
> compte, et ne rendait qu'un **nombre**. L'écran n'avait donc pas de quoi choisir ses mots, et il a
> gardé ceux du plus ancien des deux cas : le gabarit vient de `C2`, la planche d'équipement de
> `C3`, qui a réemployé la même place et le même compteur sans rouvrir la phrase.
>
> La réparation n'est pas dans les mots : elle est un cran plus bas. Le choix vit maintenant dans
> **une seule fonction**, que le texte et le compte appellent tous les deux, et le compte rend le
> nom du rôle à côté du nombre.

**Le texte qui part décrivait une grille qui n'existe pas — sur 64 % des planches du dépôt.** Les
nombres ne s'accordaient jamais : *1 sprites*, *1 columns*, *1 rows*. La faute apparaissait dès
qu'une dimension valait un, c'est-à-dire dans le cas courant — 14 planches sur 22, et **les 7
planches d'équipement toutes**. À **une seule case**, c'était pire qu'une faute d'accord : le texte
affirmait au modèle qu'il regardait une feuille de contact quadrillée, lui demandait de garder
exactement la même grille, et lui interdisait les bordures de cases — pour une image qui n'a ni
cases ni grille. **Ce qui partait était une description de ce que l'image n'est pas.**

**La redondance, elle, n'a pas été touchée, et c'est délibéré.** Le banc du 28 août 2026 l'a
étalonnée : *tout ce qu'on ne dit pas explicitement « ne change pas » est une invitation à le
changer*. Ce qui était en cause n'était pas la redondance mais la grille absente ; les six mêmes
garanties se répètent donc à une case, dites de l'image entière au lieu de la case.

**Le prix est écrit et il est payé.** Ce changement invalide les comparaisons avec les tirages déjà
payés — **sur les planches d'une et de deux cases, et sur elles seules** : à trois cases et au-delà,
la grille la plus carrée n'a jamais de dimension à un, et le texte est identique au caractère près.

> ### ⚠️ Une troisième phrase fausse, trouvée en relisant l'écran de la planche
>
> Le critère demandait de relire cet écran **en entier**, et la relecture a rapporté plus que ce
> qu'elle cherchait. La phrase visée — *« la planche n'y entre pas… c'est une ruse pour payer moins,
> pas un format de livraison »* — était vraie jusqu'au 3 septembre 2026 à 23 h 45, heure de la
> livraison de `G16` ; c'est la dixième du genre de celles de `G1`, et elle avait tenu **un jour**.
>
> La seconde n'était dans aucun périmètre. *« Un compte de cases faux ne fait rien entrer : la
> planche entière se relance, au prix plein »* n'est plus vrai que d'une moitié depuis `R6` : un
> sujet qui manque refuse encore, **un sujet de trop ne jette plus rien**. Le relevé qui avait
> changé la règle est net — quatre planches sur treize du banc d'animation refusées pour un sujet en
> trop, soit 31 % des appels payés perdus sur un geste dont c'est le régime normal. La phrase
> promettait donc, avant de payer, le contraire de ce que le produit fait. Elle a tenu **le jour
> même** : `R6` et cet écran ont été touchés à quelques heures d'intervalle.
>
> **La leçon n'est pas neuve, elle est simplement recomptée** : un écran qu'aucune tranche ne rouvre
> vieillit sans qu'on le voie, et c'est le fait de le relire *en entier* — pas de chercher la phrase
> qu'on venait corriger — qui a trouvé la seconde.

**Ce qui restait ouvert est tranché : la ligne sans case.** La colonne de la case reste **vide** au
lieu de porter un carré grisé, et la vignette garde son alignement avec celles du dessus ; la raison
s'écrit à la suite du nom, dans le gris des origines. Le motif du dépôt — *le grisé porte sa raison*
— n'est pas enfreint : il vaut pour ce qu'on **pourrait** faire et qui est refusé, et cette image-là
n'est refusée nulle part. Une case grisée aurait demandé de comprendre pourquoi elle l'est ; une
ligne sans case dit qu'il n'y a rien à décider.

**Et la légende se recopie, elle ne déménage pas.** Le bloc *« Image 1 — …, Image 2 — … »* est du
texte qui va au modèle : il se lit en haut, entier, dans l'ordre où il s'assemble. Chaque image en
porte le morceau qui la concerne, découpé **par celui qui l'a écrit** — recouper le bloc à
l'affichage aurait été une seconde vérité sur la numérotation, celle-là même qu'un seul endroit
existe pour empêcher.

## M3 — corriger un texte cesse de figer l'écran — 4 septembre 2026

**Trois défauts vécus comme un seul.** L'auteur les a dits en trois mots — *« ça freeze »* — et ils
se cachaient l'un l'autre. Composer ce qui part relisait le projet du jeu **jusqu'à quarante-deux
fois** pour répondre à une seule question ; chaque lettre tapée déclenchait un aller-retour
complet ; et le champ de correction n'avait aucune mémoire à lui, si bien que le curseur repartait
à la fin **deux fois par lettre**. Réparer un seul des trois n'aurait rien donné de visible.

> ### Le montage d'essai retrouve les chiffres des vraies données, à l'unité près
>
> 5 lectures pour l'aperçu du texte, 15 pour la confirmation d'une image ordinaire, 42 pour celle
> d'un équipement — exactement ce que la mesure du 4 septembre avait relevé sur le dépôt de
> l'auteur. Cela dit quelque chose de plus que le chiffre : **le compte ne dépendait pas du contenu
> du jeu mais de la façon dont la composition est écrite**. Un projet de deux images le relisait
> autant de fois qu'un projet de deux cents. La réparation valait donc pour tout le monde, et pas
> seulement pour l'atelier chargé de celui qui s'en plaignait.

**La portée du mémo est explicite et courte, et c'est là qu'est la décision.** Un cache posé une
fois pour toutes sur la lecture du projet aurait été plus court à écrire, et faux : on n'aurait
plus su dire de quand datait ce qu'on lisait. Un service l'ouvre le temps de composer, le referme,
et hors de là le projet se relit du disque comme avant ; l'enregistrer ou l'oublier vide le mémo
sur-le-champ. **La connexion par opération, elle, ne bouge pas** — refermer à chaque fois est ce
qui permet d'effacer le fichier de l'index sous Windows, et c'est un critère du produit depuis
`T3`. Ce qui n'avait jamais été décidé, c'était de refaire quarante-deux fois le même aller-retour.

**Un essai qui compte a besoin d'une couture pour compter.** L'index sépare désormais *répondre* de
*aller chercher* : sans cette séparation, l'essai aurait compté des **appels** — quarante-deux
avant comme après — au lieu de compter des **lectures**. C'est la même leçon que le banc de `M1`
sur la mesure prise au mauvais endroit, et elle est arrivée deux fois en un jour.

**Le témoin est la moitié qui compte.** Chaque cas est joué deux fois, mémo débranché puis branché,
et les deux réponses sont comparées caractère par caractère. Un mémo qui répondrait autre chose que
le disque serait pire que la lenteur qu'il répare.

> ### ⚠️ Deux essais d'écran ont été écrits contre eux-mêmes avant d'être gardés
>
> Le premier essai du repos de frappe **passait même sans repos du tout**. Six frappes envoyées
> d'affilée dans une seule bouffée d'instructions ne laissent rien se déclencher entre elles : la
> minuterie de la dernière annulait toutes les précédentes, et l'essai félicitait un code qui
> n'avait rien réparé. Espacées de trente millisecondes — la frappe d'un dactylo pressé —, elles
> font **six** demandes sans la réparation et **une** avec.
>
> Le second, celui du curseur, a été vérifié de la même façon : sans le brouillon du champ, il
> saute de 11 à 18, c'est-à-dire à la fin de la ligne. **Un essai qu'on n'a pas vu échouer ne
> prouve rien** — c'est le piège de la case qui ne change rien, déjà payé, sous une autre forme.

**Ce que la tranche n'a pas fait, et l'auteur l'a écarté lui-même.** Un bouton *valider* à la place
du lien *fermer* existait pour supprimer les allers-retours ; une fois les deux premiers défauts
réparés, il n'y en avait plus à supprimer. Il aurait coûté un geste de plus à chaque correction et
laissé, entre la frappe et la validation, **un prix affiché qui ne correspond plus au texte lu** —
exactement ce que la règle *« le texte et le prix ensemble »* interdit.

**Vérifié au navigateur, sur un atelier jetable en 8427.** Curseur posé au septième caractère de
*marais de fer*, cinq lettres tapées à la main : le champ montre *marais gris de fer*, le curseur
reste au douzième, et il y reste encore après que la réponse du serveur a redessiné l'écran. Deux
demandes en tout — une à l'ouverture, une une fois la frappe posée.

## M2 — le coin du calque, dessiné avant d'être bâti — 4 septembre 2026

**Une maquette qui ne construit rien, et c'est son critère.** Elle est là pour trancher, pas pour
livrer : `docs/maquettes-v2.4/01-le-coin-du-calque.html` s'ouvre d'un double-clic, sans serveur,
et **aucun fichier de l'interface ni du serveur n'a été touché** par la tranche. Ses croquis sont
dessinés à la main en HTML, aux couleurs et aux dimensions du produit ; rien n'y est calculé.

**Quatre questions étaient ouvertes, quatre réponses les ferment, et chacune écrit ce qu'elle
écarte.** Un écran plutôt que deux — les deux sortes de calque ne diffèrent que sur un point,
*l'image du dessous est imposée dans un cas, choisie dans l'autre*, et deux écrans pour un seul
écart, ce sont deux vérités qui divergent le jour où l'une gagne un réglage. La carte d'un
vêtement reste, réduite à une fiche qui **montre et qui renvoie** — la faire disparaître
obligerait à ouvrir un écran entier pour *regarder* un calque, ce qu'on fait dix fois plus souvent
qu'on ne le retouche. **C'est l'outil qui décide, pas le geste** : le seuil de trois pixels qui
sépare ailleurs un clic d'un glissement ne s'applique pas ici, parce que **les deux gestes sont
des glissements** de même longueur. Et la main se pose **sur le même cadre que le calage**, après
lui dans l'ordre de lecture, parce que c'est l'ordre du calcul — elle ôte ce que la comparaison a
gardé de trop.

> ### Rien de ce que l'écran gagne n'est neuf en dessous
>
> C'est la contrainte que la maquette s'est donnée, et elle se vérifie ligne par ligne. Le
> grossissement existe déjà — *voir en grand*, molette, image qu'on attrape, seize fois, avec sa
> raison écrite ; il reste à le poser sur le cadre. La main existe **en entier sauf l'écran** :
> le champ dans la définition d'une superposition, la route qui l'accepte, le calcul qui
> l'applique. Le choix d'outil est le motif de la carte d'un vêtement, à un quatrième outil près.
> Les deux portes nouvelles s'ouvrent sur ce que `G16` et `M6` ont déjà livré. **Ce qui reste à
> bâtir tient dans une surface où tracer, un bloc de colonne et deux liens.**

**La dette du guide est écrite maintenant, parce que rien ne la rappelle ensuite.** La règle du
dépôt veut qu'un écran ou un réglage neuf doive une ligne au recueil d'explications ; la maquette
en nomme quatre à écrire — le grossissement, la main, l'outil du cadre, le dessous imposé — et
trois à relire plutôt qu'à dédoubler.

**Une seule chose reste ouverte, et c'est à l'auteur : le nom de l'écran.** *Superposition* décrit
ce qu'il faisait, pas ce qu'il fera ; un nom se choisit une fois l'écran vu, et le renommer coûte
aussi la ligne du guide, la puce des tables et deux essais. La maquette ne chiffre pas non plus ce
que la construction coûte — **ce n'est pas son travail** : la tranche qui bâtira l'écran le comptera
en s'écrivant, et saura alors s'il s'agit d'une tranche ou de deux.

**Deux pièges de fabrication, tous deux dans le HTML de la page.** Un croquis en `min-width` s'est
étiré à toute la largeur de la colonne en laissant son dessin tassé à gauche — une largeur fixe le
règle. Et les blocs posés en absolu portaient un ordre d'empilement qui **créait un contexte
d'empilement** : leurs étiquettes se retrouvaient prisonnières sous le voile, invisibles quelle que
soit leur propre valeur. L'ordre est retiré des blocs, gardé sur les seules étiquettes, avec la
raison en commentaire dans la feuille de style.

## M1 — le découpage du coin, réparé — 4 septembre 2026

**Un contrat sain, une image huit fois trop grande, et personne entre les deux.** Le serveur ne
redimensionnait pas l'image du dessus pour la faire entrer dans le cadre du dessous : il la collait
au coin haut-gauche et jetait ce qui dépassait. C'était écrit, c'était volontaire, et c'était sans
conséquence tant que les deux images avaient des tailles voisines. `G16` a ouvert le geste *refaire
ce découpage à la main* en partant de la case **telle qu'elle est arrivée du modèle** — et cette
image-là fait 1 024 pixels de côté quel que soit le corps.

**La phrase qui n'a pas été rouverte.** *« Ce qui déborde est perdu »* datait de `C3` ; elle est
restée telle quelle quand `G16` a introduit, dans la même fonction, une image huit fois plus grande
que son cadre. Aucun essai ne l'a vue parce que **tous ceux de la superposition emploient deux
images de même taille** — il n'en existait pas un seul avec deux tailles différentes.

> ### ⚠️ La mesure a élargi le défaut : neuf pièces sur neuf, et non deux
>
> Le banc écrit pour la tranche — `essais/essai_superposition_cadre.py`, gratuit, en lecture seule
> sur le disque — reprend **chaque** pièce d'équipement du dépôt, la repose sur le corps que son
> pliage désigne, et compte les pixels de sujet que le calque contient. **Neuf sur neuf en
> rendaient zéro** : le coin gardait entre 0,4 % et 7,8 % de la case arrivée, jamais l'endroit où
> le dessin se trouve, et le calque sortait **rempli de fond uni à 95–98 % du cadre** — un
> résultat d'apparence honnête, dont le bouton *recaler* tirait des chiffres tout aussi honnêtes.
>
> Les deux casques de *balthazar-2* que la tranche nomme restent les siens, mais pour l'autre
> raison : ce sont les deux **qui avaient besoin du geste**. Leurs chiffres se retrouvent — *0 sur
> 213 836* et *0 sur 180 320*, le coin gardant 7,7 % et 1,6 %.
>
> **Et le compte de ce qui ne bouge pas était pris sur la mauvaise image.** La tranche disait *six
> des huit pièces*, ce qui est vrai des tailles rangées sur le disque ; le service, lui, lit
> l'image **rendue**, et sur le rendu **les neuf tiennent déjà dans leur cadre**. Elles rendent
> donc toutes le calque d'avant la tranche, au pixel près — le banc le vérifie une par une, et
> c'est la moitié qui compte : une réparation qui abîmerait le cas courant serait pire que le
> défaut.

**La réduction emploie la moyenne de surface, et ce n'était pas un choix libre.** C'est déjà celui
du retour d'une planche, avec sa raison écrite : *on réduit une image de modèle vers la grille du
projet, et le plus proche voisin y perdrait un pixel sur deux du contour*. Or le contour est
précisément ce que la comparaison lit.

**L'écran ne montrait pas la même image que le calcul, et dans les deux sens.** Le cadre de travail
posait le dessus en `object-contain` : il **réduisait** l'image que le serveur coupait au coin, et
il **agrandissait** celle que le serveur laissait à sa taille dans un coin. Le serveur rend
maintenant le rectangle où il pose le dessus, en pixels du cadre, et l'écran le dessine tel quel.
La leçon est celle de `G16` — *la vignette de gauche avait été corrigée, le grand cadre non* — et
elle vaut deux fois : **on ne répare pas un calcul sans regarder ce que l'écran en montre.**

**La phrase, enfin, existe pour l'échelle.** Sans elle on lit *× 1,00* et on croit que l'image part
de sa taille d'arrivée. Elle ne paraît que lorsqu'il y a eu réduction : dans le cas courant, il n'y
a rien à dire, et une phrase qui paraîtrait partout cesserait d'être une réponse.

## M6 — deux images pour une case, et laquelle part — 4 septembre 2026

**La question posée était la bonne, et la réponse était « ni l'un ni l'autre ».** L'auteur
demandait : *oubli, ou bug ?* C'était un **oubli d'écran** — la règle existe depuis `C2`, elle
décide déjà, et rien n'était cassé. *Le favori d'abord, sinon la plus récente* (`corps_retenu`),
écrite une seule fois et lue par trois chemins : le corps qu'une planche d'équipement emporte, le
calque qui sort à l'export, le calibrage.

**Ce qui manquait tenait entièrement à l'écran, et c'est un motif qu'on a déjà vu.** La fiche du
personnage est le seul endroit du produit qui montre des images concurrentes côte à côte — et
c'était le seul à n'offrir ni la marque qui décide, ni la réponse à *« laquelle gagne ? »*. Le
geste existait ailleurs, dans la galerie, ce qui suppose de savoir que la règle existe et d'aller
retrouver la bonne image dans un autre écran. **Une règle qu'on ne peut pas voir n'existe pas pour
celui qui s'en sert.**

**Et deux vrais défauts se cachaient dedans**, trouvés en vérifiant la remarque. Les mesures
posées à droite d'une rangée décrivaient la **première image de la case** au lieu de la retenue :
les deux coïncident tant que personne ne marque de favori — la liste arrive la plus fraîche en
tête —, et dès qu'un favori plus ancien est posé, la rangée décrit un calque quand l'export en
sort un autre. **Mesuré au navigateur : 1,9 % puis 10,7 % de repeint sur la même rangée**, selon
la marque posée. Et **marquer un favori était le seul geste de la bibliothèque à ne prévenir
personne** : la galerie s'en tirait parce qu'elle se recharge elle-même après l'appel, la fiche du
personnage n'a pas ce second chemin — elle écrit et elle reçoit —, et c'est justement l'écran dont
le favori décide de ce qui part.

**Le serveur dit désormais ce qu'il retiendrait**, pièce par pièce, calculé par la fonction même
qui décide à l'export. Recomposer la règle dans la page aurait fait deux règles à deux endroits,
qui finissent toujours par désigner deux images différentes — c'est la raison déjà écrite pour le
corps, appliquée une seconde fois.

**La marque ne paraît que quand la case a le choix.** Une marque répond à une question, et une
case à une seule image n'en pose pas ; un liseré sur chaque vignette du produit aurait fait un
ornement. Le geste, lui, n'invente rien : c'est le coin plein en cyan, qui veut dire *favori*
partout ailleurs, et la carte de droite reprend les deux mots de la fiche de la galerie — *◤
favori* et *Supprimer cette image* — sous la phrase qui dit lequel part. *« Juger, c'est marquer
favori ou supprimer »*, appliqué là où l'on juge.

> **Le navigateur a trouvé ce qu'aucun essai ne cherchait.** Supprimer depuis la fiche marchait,
> l'image partait — et le bandeau *annuler* ne se voyait nulle part : il vit dans la barre
> d'outils de la galerie, que cet écran-là ne montre pas. **On jetait depuis un endroit d'où l'on
> ne pouvait pas défaire**, sous une infobulle qui promettait le contraire. Le compte rendu part
> maintenant dans la fente du châssis, **avec le geste qui rend**. Et le premier essai de ce geste
> a échoué pour une seconde raison : le bouton posé au moment de la suppression capturait
> l'annulation telle qu'elle était *avant* — c'est-à-dire vide. Les identifiants se passent, ils
> ne se relisent pas.

**Deux déplacements, chacun pour éviter un piège.** La croix qui vide une case est descendue en
bas de la vignette : elle occupait l'angle du coin de favori, et c'est le coin qui ne peut pas
déménager sans cesser d'être la même marque partout. Et le bouton de la carte dit *Supprimer cette
image* et non *Supprimer* : la colonne de gauche du même écran porte déjà un *Supprimer*, celui de
la chose entière.

**Ce qui reste ouvert et n'appartient pas à cette tranche.** Le corps retenu vaut pour l'attitude
entière, toutes directions confondues — c'est ainsi que le serveur le choisit depuis `C2`, et la
matrice le montre tel quel plutôt que d'inventer une seconde règle par direction. Le jour où une
pose devra retenir un corps *par* direction, c'est `corps_retenu` qui changera, à un seul endroit.

## D4 — le catalogue s'ouvre, et deux des trois choses qu'on attendait sont fausses — 3 septembre 2026

**La V2.3 se ferme avec elle, cinq tranches sur cinq.**

### Ce que le banc devait confirmer, et ce qu'il a dit à la place

Le relevé d'outillage annonçait deux manques, et la tranche les avait recopiés. Le banc les a
mesurés — cinq modèles, quatre images du dépôt, gratuit
(`essais/essai_moteurs_de_detourage.py`).

| modèle | entrée | ms | part gardée | **ajouré trouvé** |
|---|---|---|---|---|
| `birefnet-general-lite` | 1024 | 12 058 | 0,214 | **4,8** |
| `isnet-anime` | 1024 | 1 578 | 0,213 | **2,2** |
| `u2net` | 320 | 894 | 0,219 | 2,5 |
| `isnet-general-use` | 1024 | 1 539 | 0,215 | 3,8 |
| `birefnet-general` | 1024 | 21 595 | 0,214 | 3,5 |

**La part gardée ne sépare rien**, et c'est elle que le relevé regardait : cinq modèles à
quatre millièmes près. Ce qui sépare est l'**ajouré** — l'espace entre un bras et un torse, une
boucle de ceinture, une frange —, et il fallait le compter pour le voir.

**Le modèle entraîné sur du dessin est le plus mauvais des cinq sur ce point-là.** La tranche
l'annonçait comme *« le plus proche de notre cas d'usage »* ; il trouve **un** trou là où les
autres en trouvent trois à sept, et c'est celui qui s'écarte le plus de tous les autres — 0,925
d'accord au pire. La raison se comprend après coup, et elle est dans son nom : `isnet-anime`
apprend à découper **un personnage d'un seul tenant**, ce qui est exactement le contraire de
garder l'ajouré. *Il reste au catalogue avec cette note écrite à côté de lui — un modèle écarté
sans avoir été essayé se repropose tous les six mois.*

**L'allégé bat le lourd, et il ne pèse pas ce qu'on disait.** 214 Mo pesés sur le disque, pas
88,6 : le chiffre du relevé était celui des poids PyTorch, pas de l'export ONNX que `rembg`
rapatrie — un quart du lourd, pas un onzième. Il le bat quand même : plus d'ajouré, deux fois
moins de temps, 99,5 % d'accord avec lui. **C'est la seconde fois que ce relevé donne un
chiffre faux à cette tranche**, la première étant *« nos deux modèles »* pour trois.

### Et une affirmation de la tranche elle-même est tombée

Elle écrivait que les *« 95 % de pixels à demi transparents »* cités par trois documents du
dépôt étaient **en partie la trace du réagrandissement** du masque de `u2net`, qui infère à 320
et étire. La mesure dit non : `isnet-general-use`, qui infère à 1024 et n'étire rien, en rend
**autant** — 421 092 contre 445 278, 3 % d'écart. C'est la sortie douce du modèle, pas
l'étirement, et c'est le durcissement qui la tranche depuis toujours.

**Le paragraphe fautif est laissé dans le plan avec la correction sous les yeux**, plutôt que
retiré : une affirmation effacée en silence se réécrit toute seule six mois plus tard.

### Ce qui a été construit, et ce qui a servi à le construire

**Le défaut du moteur par modèle passe à `isnet-general-use`**, pour la ligne de l'ajouré : une
moitié de détails en plus, à part gardée égale, pour 0,7 seconde de plus — et le moteur par
modèle sert les images **importées**, pas ce que l'atelier fabrique. ⚠️ *Une recette d'avant
`U13` ne nomme aucun modèle et retombe sur ce défaut : son rendu change. Celles qui nomment
`u2net` ne bougent pas d'un pixel.*

**Les deux réparations de bord partagent une seule mesure**, et c'est ce qui les fait marcher
sur les quatre moteurs à la fois : aucun ne déclare la couleur qu'il a prise pour du fond — le
modèle ne rend qu'un masque —, mais tous laissent derrière eux les pixels qu'ils ont ouverts, et
*effacer un pixel ne change pas sa couleur*. **Le fond d'une passe se lit dans son propre
résultat.**

- **Le rongement conditionnel épargne 47 185 pixels de sujet** sur les quatre images du banc,
  à un cran de rongement et à deux — 15 538 au premier, 31 647 au second, ce qui dit assez que
  le second cran est celui qui mangeait vraiment. Et il ne peut **jamais** en manger plus que
  l'érosion aveugle — c'est un sous-ensemble, vérifié une fois pour toutes plutôt qu'image par
  image. Un trait
  d'un pixel d'épaisseur ne se ronge plus jamais, parce qu'aucun de ses pixels n'a de voisin
  franchement intérieur à qui se comparer. *C'est le cas que l'érosion effaçait en entier : une
  antenne, une lanière, la pointe d'une épée.*
- **La décontamination repeint 9 à 51 % du pourtour** selon l'image, d'un écart moyen de 88 à
  197 niveaux — ce qui dit assez que le défaut était réel. Elle ne touche pas à l'alpha, jamais
  d'une valeur : c'est ce qui la sépare du *matting*, et un bord doux est très exactement ce que
  le durcissement existe pour supprimer.

**Le contour a gagné ses deux régimes, et il manquait un nombre pour ça.** D2 rendait le pas sur
lequel le modèle a peint ; elle ne rendait pas **où la grille commence**. La recherche de phase
existait dans le peigne depuis D2 — elle était jetée aussitôt faite. Sans elle, un trait posé
sur la bonne maille mais au mauvais départ tombe à cheval sur deux blocs, ce qui est la moitié
du défaut qu'on répare.

**Un critère était déjà livré, et il a été vérifié au lieu d'être réécrit** : la couleur du
trait se prend déjà dans la palette du jeu depuis `E5`, pastilles cliquables et marque « hors
palette » comprises. *Une tranche qui réclame du travail livré est la façon la plus chère de
perdre une journée* — c'est écrit dans la tranche elle-même, et c'est la seconde fois qu'elle
l'évite.

### La leçon, et elle est la même que celle de la veille

Trois affirmations sur cinq venaient d'un document non vérifié, et les trois étaient fausses.
La tranche s'était déjà fait prendre une fois — *« nos deux modèles »* pour trois — et l'avait
écrit en tête de sa propre section. **Ça ne l'a pas empêchée de recopier les deux suivantes.**
Ce qui les a trouvées n'est pas une relecture : c'est d'avoir **compté la bonne chose**, et la
bonne chose n'était pas celle que le relevé regardait.

---

## D3 — le fond cesse d'être une phrase enterrée dans le code — 3 septembre 2026

**Le produit demandait *un fond plat* sans dire lequel, depuis le premier jour.** Le modèle
rendait donc un gris clair — c'est-à-dire une couleur que le sujet porte aussi, sur une joue,
une lame, une pierre. De là le découpage à reprendre à la main sur presque chaque image :
le remplissage depuis le bord mange ce qui ressemble au fond, et une joue grise ressemble à un
fond gris.

### Ce que la tranche a coûté, et ce n'est pas ce qui était prévu

**Elle devait coûter un banc de huit tirages par branche.** L'auteur l'a retiré le 2 septembre :
*« pas besoin de tester ça »*. La raison tient — le fond devient un **réglage**, pas une valeur
imposée, et une mauvaise couleur se change en un geste. Ce qui remplace le banc est plus utile
que lui : **deux mesures d'acceptation lues sur les images qu'on voulait de toute façon** — les
pixels de bord à demi transparents, et les pixels du sujet encore à portée de tolérance du fond.
C'est la doctrine du dépôt sur les notes de qualité, appliquée pour la première fois à un
réglage d'**envoi** et non à un modèle.

### Trois choses ont été tranchées en construisant, et aucune n'était écrite

**1 · Le fond ne fabrique pas de ligne à lui dans le texte qui part.** La case `technique`
disait déjà *un fond plat* ; elle dit maintenant lequel. Lui donner une ligne de plus aurait
fait partir la couleur deux fois dans le même appel.

**2 · Mais il a fallu un quatrième écart sur l'écran de confirmation**, à côté des lignes
éteintes, des lignes rallumées et des textes corrigés. La raison est mécanique : le fond
fabrique **deux** textes qui partent dans **deux champs différents** — la phrase de calage et la
phrase d'interdiction. Le corriger en tapant dans la ligne aurait changé l'un sans l'autre, et
l'appel serait parti en demandant du magenta tout en interdisant du cyan, **sans que rien ne le
dise**. C'est le premier réglage de l'écran de confirmation qui ne soit pas du texte.

**3 · Un jeu en dessin a un fond comme les autres.** La phrase de calage ne partait qu'en pixel
art, puisqu'elle porte le calage en carrés. Elle se coupe désormais en deux moitiés, et le fond
part seul quand il n'y a pas de carrés. Sans ça la tranche aurait été muette pour la moitié des
projets — trouvé en relisant `phrase_du_produit`, pas en essayant.

### Ce que la tranche ne coûte pas, et c'est ce qui la rendait facile

**Le champ d'interdiction existait déjà** — `Demande.prompt_negatif`, depuis `T1` —, et les deux
adaptateurs le replient en fin de demande sous *« Do not include: »*. La phrase qui interdit au
modèle d'employer la couleur du fond sur le sujet entre donc dans un mécanisme qui était là,
sans une ligne d'adaptateur. C'est ce que le bilan annonçait, et c'était juste.

### Le seul chiffre qui ne vient pas d'un relevé, et il est écrit comme tel

Le seuil de sûreté d'une couleur candidate est **trois fois la tolérance du détourage**. Une
tolérance parce qu'en dessous la couleur serait mangée avec le fond ; les deux autres paient le
fait que **le modèle ne rend jamais exactement l'hexadécimal demandé**. Cette dérive-là n'est
pas connue — aucune image du dépôt n'a été tirée sur un fond franc —, et c'est la mesure
« pixels encore collés à la couleur de fond » qui la dira sur les premières qui reviendront.
*Le seuil se reposera alors sur ce qu'on aura vu.*

⚠️ **Le prix de la tranche, dit une fois** : elle change ce qui part au fournisseur. Les images
tirées avant ne se comparent plus à celles d'après — pas parce qu'elles sont moins bonnes, mais
parce qu'on n'a plus demandé la même chose. Les 135 notes d'animation restent valables entre
elles, jamais contre un tirage postérieur.

### Et le passage au navigateur a trouvé trois choses que rien d'autre ne pouvait trouver

Les 1 169 essais de serveur et les 576 d'écran étaient au vert avant. Un atelier jetable monté
sur le port 8424, avec deux jeux — l'un dont la palette laisse le magenta très loin, l'autre
construit exprès pour qu'**aucune** couleur candidate ne soit sûre — a rendu trois défauts en
vingt minutes.

**La phrase d'interdiction disait le contraire de ce qu'elle voulait dire.** Elle énumérait les
endroits qui trahissent en écrivant *« (not on its outfit, its skin… ) »*, et elle part dans un
champ que les adaptateurs replient derrière *« Do not include: »*. Une négation dans une
négation : l'énumération cessait d'**étendre** l'interdiction pour la **retrancher** — ne mets
pas cette couleur sur le sujet, sauf sur sa tenue et sa peau. **Le code ne pouvait pas le
montrer** : il se lit toujours comme on l'a pensé, et la phrase n'existe en entier qu'une fois
assemblée. Ce qui l'a trouvée est de l'avoir imprimée dans une console, à côté du reste. Un
essai la garde désormais : *aucun « not » dans ce qui part en interdiction*.

**Les deux écrans du fond affichaient une couleur qu'ils n'avaient pas.** `<input type="color">`
n'a pas d'état vide — il *doit* porter une couleur —, donc une pastille magenta se retrouvait
collée aux mots *« aucun fond posé »*. C'est la famille du piège déjà payé de la case à cocher
qui ne change rien, et **aucun essai ne pouvait le voir** : en `jsdom` la valeur est celle qu'on
a écrite, et l'essai l'aurait confirmée. Le damier prend la place — c'est le mot du produit pour
« pas de couleur » partout ailleurs —, et le sélecteur reste **dessous**, atteignable : le
retirer aurait fermé le seul chemin qui reste le jour où l'atelier ne peut rien proposer de sûr.

**Et deux petites choses de langue**, qui ne se voient qu'écrites : une part en pourcentage
rendue *« 9.1 % »* au milieu d'une phrase française, et la fiche d'un moteur qui redisait mot
pour mot la ligne juste au-dessus d'elle — l'écran écrit désormais le côté d'inférence pour
**tous** les modèles, et la note du catalogue n'avait plus à le répéter.

*Trois défauts d'écriture sur trois, et pas un seul de logique.* C'est ce que la vérification au
navigateur attrape, et c'est très exactement ce qu'aucune suite d'essais ne peut attraper à sa
place.

---

## G16, le lendemain — deux défauts que seul l'usage pouvait trouver — 4 septembre 2026

**Un symptôme, deux causes, et la seconde était la pire.** L'auteur signale que les images ne
s'affichent plus après avoir refait un calque à la main. Le journal du serveur donne un `400`
sur `/generations/…/slots/100/image`, répété.

**La première cause était une règle vraie devenue fausse.** L'écran composait l'adresse d'une
image ainsi : *une image traitée se lit par son empreinte, une image sans recette se lit par son
emplacement*. Le second membre n'est vrai que des images de `C1` — **tout ce qui naît d'un
dépliage, d'une découpe ou d'une superposition porte un rang qui n'est l'emplacement de rien**.
Un calque né d'une superposition a la recette vide (voulu depuis `E6` : les deux images étaient
déjà rendues) et le rang 102 : l'écran demandait l'emplacement 102 d'un appel qui n'a que le 0.
La vignette de la grille, elle, marchait — elle passe par l'adresse de l'asset. C'est l'aperçu
qui ne marchait pas, et c'est l'aperçu qu'on regarde.

**La seconde a été trouvée en vérifiant la première, et elle cassait bien plus.** Une
superposition écrit son résultat dans le dossier de la **même génération**, au premier rang
libre — donc au-dessus des cases, sans en remplir aucune. Or le rejeu du recalage (`R5`) et la
case arrivée (`G16`) retrouvaient « leur » case en comptant les rangs du dossier : après **un
seul** calque refait à la main, l'atelier lisait *« cinq images rangées pour quatre cases »* et
refusait les deux gestes **sur toute la planche**, définitivement. Refaire un calque cassait le
geste qui l'avait fabriqué, et pour toutes ses sœurs.

> **Le défaut attendait depuis que `E6` et `R5` se sont croisés sans se voir.** Personne n'avait
> encore refait une superposition sur une planche d'équipement — il fallait aller chercher la
> table à la main. `G16` a mis ce chemin sur la route ordinaire, et l'usage l'a trouvé en un
> jour. C'est le cas d'école d'un défaut que ni les essais ni la relecture n'atteignent : les
> deux gestes marchaient, séparément, depuis des semaines.

**Réparé par la filiation, pas par un drapeau.** Une image dépliée n'a ni parent ni
superposition — elle sort d'une case, pas d'une autre image. Un drapeau de plus aurait été une
seconde vérité sur une question à laquelle la filiation répond déjà. Deux essais de non-retour
tiennent les deux défauts.

**Et une lenteur, mesurée puis levée.** Afficher la case arrivée coûtait **2,5 s** au
navigateur : elle passait par la lecture de planche qui aligne *chaque* case sur *son* corps
pour produire les calques, alors qu'elle rend la case **avant** tout ça. Le découpage seul
suffit — **483 ms**, cinq fois moins. Le rejeu du recalage, lui, garde la lecture complète : il
a besoin des alignements.

**Ce qui reste ouvert, et qui est écrit dans les remarques du jour.** Le zoom manque
*entièrement* dans la superposition — `G10` fait monter le plafond **des tables**, et cet
écran-là n'en est pas une ; la main n'y est pas non plus, alors que le champ existe dans le
domaine avec sa raison écrite et n'a aucun écran ; et un calque né d'une superposition s'annonce
*« corps habillé »*, parce que sa recette est vide et que c'est elle qui départage les deux.
Les trois se tiennent : **trois endroits fabriquent ou réparent un calque et ne se ressemblent
pas.** À reprendre en entier.

## G16 — ce qui est revenu du modèle se voit, et se reprend à la main — 3 septembre 2026

**La remarque disait trois choses, et elle n'en disait qu'une.** *« Je ne peux pas voir
l'image générée […] et le brut semble prendre souvent le calque déjà découpé. »* Trois
manques distincts — voir la feuille payée, refaire le calage à la main, et un mot qui
désigne deux choses — mais un seul fait dessous : **il n'existait aucune façon de nommer
la case telle qu'elle était arrivée**. Les trois tombent avec elle.

**Le mot *brut* désignait deux images, et personne ne l'avait remarqué.** Mesuré sur
l'atelier jetable, pour une même case d'une même planche : la case **arrivée** fait
512×512, entièrement opaque, et porte le fond du modèle, le corps et la pièce ; le **brut
rangé** fait 64×64 et 2 118 pixels opaques — déjà remis à l'échelle, recalé et détouré ;
le **rendu** en garde 363, la pièce seule. Trois images, deux sens du mot. `_accueillir`
l'écrivait depuis C3 en toutes lettres — *« son brut est la case ramenée dans le cadre du
corps »* — et aucun écran ne le disait.

**Presque rien n'a été construit, et c'est la marque de la famille ②.** L'adresse qui sert
la feuille existait depuis T1 ; le recalcul d'une case à partir d'elle existait depuis R5,
dans le rejeu du recalage ; une image sans recette s'affichait déjà par l'adresse de son
emplacement. La tranche a posé **des portes** : un asset pour la feuille, une adresse pour
la case arrivée, un drapeau sur la superposition, deux boutons.

**L'invariant renversé était prévu, et il a coûté ce qu'il annonçait.** *Le pliage est une
ruse d'appel, jamais un format de livraison* (C2) tombe ici plutôt qu'en `P1`. Neuf essais
le disaient et disent maintenant l'autre — et l'un d'eux, en tombant, a trouvé la seule
chose que le renversement cassait vraiment : **au rattrapage du démarrage, une planche qui
attend encore un choix serait entrée en bibliothèque**, contre la règle de `R6`. Le refus
manquait ; il est écrit, mot pour mot comme celui de la reprise, juste à côté.

**Ce que la feuille est, décidé à un seul endroit.** Trois chemins la font entrer — le
dépliage des corps, celui d'un équipement, le rattrapage —, et trois constructions écrites
à trois endroits auraient fini par donner trois images différentes : l'une avec son coût,
l'autre sans, la troisième avec une recette de projet qui l'aurait mise sur grille. Elle
est donc construite dans `atelier/domaine/planche.py`, et nulle part ailleurs.

**Trois décisions qui l'empêchent d'être un sprite** : recette **vide** — donc ni grille,
ni réduction de couleurs, ni détourage —, **aucune pose** — donc invisible pour la matrice,
qui saute ce qui n'en a pas —, et **le coût de l'appel sur elle**, zéro sur ses morceaux.
Vérifié : quatre cases pleines, une image chacune, la feuille dans aucune.

**Un hasard heureux dans les rangs.** `premier_rang_libre` réservait déjà les rangs des
emplacements depuis C2 — la feuille avait donc son rang libre, et rien n'a eu à bouger.

**Ce que la tranche laisse ouvert, et qu'il vaut mieux écrire.** Supprimer la feuille depuis
la galerie efface son fichier, et le recalage comme la case arrivée refusent alors avec leur
raison — proprement, mais l'auteur ne sait pas ce qu'il perd au moment où il supprime. C'est
exactement le critère de `P1` — *supprimer la planche demande confirmation et dit combien
d'images en dépendent* —, et il reste chez elle.

**Et un effet de bord qui se voit à l'écran, déjà prévu par le produit.** Partir de la case
arrivée, c'est partir d'une image **avec son fond** : le premier aperçu annonce 117 % de part
ajoutée. L'alerte *« sans alpha sur le dessus, le calque prendrait tout le fond »* était là
depuis E6, avec son bouton — *reprendre les passes du dessous* —, et un clic ramène l'ajout à
40 %. Rien à construire ; il fallait juste que ce chemin devienne le chemin ordinaire.

**Ce que ça coûte :** rien au fournisseur, et c'est vérifié par le compte d'appels — regarder
la feuille, regarder la case arrivée, refaire le calage et fabriquer ne touchent personne.
Douze essais neufs, dix essais anciens réécrits pour dire le nouvel invariant. Vérifié au
navigateur sur un atelier jetable, port 8423 : la bascule, le bouton, la table préremplie sur
les deux bonnes images, et le second vêtement qui arrive dans la même case avec le premier
intact.

## R9 — un outil qui ne disait pas ce qu'il réparait — 3 septembre 2026

**L'écran ouvrait sur un décompte et proposait un verbe.** *« 6 poses · 5 calées »*,
puis un bouton marqué *« Calibrer les 5 poses »*. Rien ne disait ce qui n'allait pas,
rien ne disait ce qu'on obtiendrait — et l'explication de l'outil, écrite le 30 août
2026, complète et juste, **n'était citée par aucun composant** : elle n'était donc
lisible nulle part. Six jours d'un texte parfait rangé dans un tiroir.

**Le principe qui a tenu la tranche** : *un outil montre le défaut qu'il répare avant
de proposer de le réparer*. Il est monté dans `docs/design-motifs.md`, avec l'ordre
qui le fait — ce qu'il répare, ce que le geste donnerait, puis le geste.

**Le critère du plan était faux à moitié, et la moitié fausse était la plus
intéressante.** Il disait « il reste allumé aujourd'hui ». Le bouton s'éteignait bien,
mais uniquement dans le cas dégénéré — aucune pose avec un corps, ou toutes mises de
côté — et **muet** : l'écran montrait alors *« Calibrer les 0 poses »* en gris, le
paragraphe explicatif disparaissait avec lui, et rien ne disait pourquoi. Ce que la
tranche a posé n'est donc pas une extinction, c'est **un compte** et trois raisons.

**Un défaut trouvé, montré, et délibérément pas corrigé.** L'occupation calibrée
traverse deux fonctions qui la bornent chacune, et pas au même endroit :
`_occupation` à l'échelle déclarée par l'ensemble — jusqu'à 300 % —, `_poser` à
100 %. Un géant déclaré tel voit son calibrage écrasé au tiers. **Personne ne compare
une borne d'entrée à une borne de sortie**, et tant que la valeur ne sortait pas du
service, l'écart ne se voyait pas ; il est devenu visible le jour où l'écran a dû
dessiner l'après. Le réparer changerait ce que l'outil écrit, ce que le dernier
critère interdit noir sur blanc — le service rend donc la valeur *réellement* écrite,
l'écran dessine ce qu'on obtiendra, et le piège est consigné.

**Et le défaut est mesuré sur la chose qu'on a sous les yeux.** La maquette citait les
six hauteurs du vrai projet ; les compter sur les poses de la chose ouverte dit la
même chose et ne peut pas devenir faux. C'est `G1` appliqué avant d'avoir eu à le
payer une treizième fois.

**Le navigateur a confirmé l'empilement d'après, et corrigé un chiffre.** Sur l'atelier
jetable, `repos` est bien agrandi de `scale(0.4375)` autour de son bas et retombe à 28 px
réels, la ligne dorée est à sa place, et une pose déjà à la hauteur commune ne porte
aucune transformation. Ce qui était faux tenait en un mot : le sous-titre disait
« 4 hauteurs différentes » sous quatre poses dont deux sortent à la même hauteur. Il
compte maintenant les hauteurs **distinctes** — `G1` pris avant qu'il ne coûte.

**Ce que ça coûte :** rien en usage, rien au fournisseur. Huit essais serveur, douze
côté écran, cinq repris — et **aucun essai de `E17` n'a bougé** : la tranche ajoute
deux chiffres par pose, elle n'en révise aucun, et un essai de `R9` répète les valeurs
de `E17` pour qu'une révision furtive se voie.

## R8 — un écran plein de texte pour une chose qui n'existe qu'en images — 3 septembre 2026

**Le défaut était mécanique, pas esthétique, et c'est ce qui rendait la tranche courte.** Le
produit possède deux systèmes faits exactement pour ce que la fiche d'une chose ne faisait
pas : l'explication au survol, adossée à un recueil unique qui alimente aussi le guide, et la
vignette, qui montre une image en petit et l'ouvre en grand à la barre d'espace. **La fiche
n'employait ni l'un ni l'autre** — le recueil comptait 123 entrées et **zéro** pour cet
écran, et l'écran d'une chose qui possède des images n'en montrait aucune. On retenait ou
l'on retirait une image de référence en lisant deux mots.

**Le troisième rendu du corpus est la vraie décision de la tranche.** Écrire une phrase à
demeure sous un titre de section semblait ajouter un rendu à un corpus qui n'en avait que
deux. Le comptage du code a montré que la question était mal posée : le produit écrit déjà
**74 lignes explicatives en dur dans dix-sept écrans**, dont treize sur quinze relues
expliquent un réglage sans rien refuser. La règle n'a jamais interdit d'écrire une phrase à
l'écran — elle interdit de **recopier** le corpus dans un second fichier. La ligne est donc
*lue* dans le recueil, et corriger l'entrée corrige les trois affichages.

**Deux critères du plan étaient faux, et les deux le sont restés dans le plan.**
« Cinq entrées » : la maquette en annonçait cinq au récapitulatif et en rédigeait six au
détail — la matrice de droite est un sixième titre à l'écran, et un titre sans entrée aurait
été le seul sans bulle, sans propos et absent du guide. « Écrit trois fois » : le compte des
cases paraissait à trois endroits **et deux des trois ne comptaient pas pareil** — l'un sur
toutes les cases du plan, rangées comprises, l'autre sur les seules poses tenues, si bien
qu'une chose à deux poses rangées se lisait « sur 6 » à gauche et « sur 4 » à droite. Le
dessin validé garde les trois lieux, qui répondent à trois questions ; ce qui disparaît est
le **quatrième**, le très gros chiffre à empattements. Ce qui est tenu est **un seul calcul**.

*Les deux phrases de critère n'ont pas été réécrites pour coller au résultat — elles portent
un renvoi vers l'arbitrage. Un critère retouché après coup ne mesure plus rien.*

**Deux règles d'apparence enfreintes, trouvées en dessinant.** Une mesure écrite en serif de
32 px, alors que `docs/DESIGN.md` dit *toute mesure est en mono, partout* ; et le nom d'un
champ de style écrit dans le gris réservé à ce que quelque chose d'autre redit — or rien ne
redit le nom d'un champ. Les deux corrections sont montées dans `docs/DESIGN.md`, à côté des
trois enfreintes déjà consignées : c'est la troisième fois que la même règle de couleur est
prise en défaut par la même question — *qu'est-ce qui redit ceci ailleurs ?*

**Et les deux vrais défauts sont sortis du navigateur, pas des essais.** Montée sur un
atelier jetable, la fiche a montré que **le sommaire ne suivait pas le défilement du tout** :
elle employait un `IntersectionObserver`, et un guetteur ne livre rien à un onglet qui ne
compose pas ses images — **exactement le piège consigné neuf jours plus tôt sur
`ResizeObserver`**, payé une seconde fois parce que l'entrée nommait le composant et non la
famille. La correction suivante — inverser le tri — était fausse aussi, et les mesures l'ont
dit : la bande du haut fait 316 px quand une section en fait 797, trois se croisent à la
fois, et aucun sens de tri ne désigne celle qu'on lit. Le second défaut était plus simple :
**deux titres du sommaire se coupaient**, alors que la tranche existait pour réparer un
résumé coupé.

**Ce que ça coûte :** rien en usage, et rien au fournisseur. Quatre essais serveur, dix côté
écran, plus huit clics d'onglet **retirés** d'essais existants — ils ouvraient des parties
que la fiche montre désormais sans rien ouvrir.

## R7 — un rangement construit contre une mesure qui disait non — 3 septembre 2026

**La tranche avait été close avant d'être construite, et sur un chiffre.** Cinq variantes du
texte qui part, tirées à images égales le 2 septembre avec un témoin neuf : **aucune ne
passe**, et le pavé du produit les bat toutes — 0 sur 4 pour les trois titres, contre 2 sur 4
pour le témoin. La règle écrite d'avance disait *au moins la moitié de bonnes, sinon on
n'insiste pas*.

**Elle a été rouverte par décision de l'auteur, en connaissance du chiffre, et pour la
relisibilité seule.** Aucun gain de taux n'est promis — ni dans le plan, ni dans le dossier
de tranche, ni dans l'entrée que l'auteur lit à l'écran. C'est la première tranche du dépôt
dans ce cas, et l'encadré qui la disait close **reste** dans le plan, corrigé et non effacé :
une tranche qu'on rouvre contre une mesure doit garder la mesure sous les yeux.

**Le banc a servi de source, pas de modèle à réécrire.** Les deux variantes reprises sont
recopiées **mot pour mot** de `essais/socle_essais.py`, et un essai le vérifie à chaque
exécution. La raison est comptable : un tirage futur doit mesurer la même chose que celui
qui a déjà été payé, et un texte voisin rendrait les $0,25 du 2 septembre inutilisables.

**La caméra ne bouge pas, et c'est ce qui rendait la tranche faisable.** Un banc payé de
trente images a établi que le rapport hauteur/largeur du sujet passe de **1,55 à 1,13** quand
la caméra ferme le texte : un modèle d'image pondère la fin. La caméra appartient à la
*demande*, qui est la troisième partie et dont elle est la dernière ligne — ranger ne l'a
donc pas déplacée. Le seul déplacement est le bloc des références, qui remonte de
l'avant-dernier rang au deuxième, et c'est exactement le déplacement que le banc a tiré.

**Trois défauts trouvés en construisant, et réparés.** Deux groupes de l'écran de
confirmation s'affichaient **sans titre depuis le 1ᵉʳ septembre**, nés le jour même — un
titre absent ne laisse pas un trou, il laisse un blanc. Le texte annonçait au modèle **une
bande de couleurs qui ne partait pas** dès que la case était cochée : une entorse à `E14`
que seul le modèle aurait pu remarquer. Et la liste des dépenses allait devenir illisible,
toutes ses lignes commençant par `CONTEXT` — elles écrivent maintenant le **sujet**, ce qui
les rend distinctes pour la première fois.

## G1 — douze phrases justes le jour de leur écriture, et fausses depuis — 3 septembre 2026

**Aucune n'était une approximation, et c'est tout le sujet.** Toutes ont été mesurées ou
vérifiées le jour où elles ont été écrites, par quelqu'un d'attentif, et toutes ont été
démenties par un changement venu d'ailleurs — la plus ancienne a tenu sept jours, la plus
récente deux. Un écran qui ment sans le savoir coûte deux fois : à l'usage d'abord, à la
confiance ensuite, parce qu'une phrase prise en défaut emmène les suivantes avec elle.

### Elles étaient neuf au plan, elles étaient douze

Les trois de plus sont tombées dans le même filet en corrigeant les autres : *« les huit vues
en cartes, les neuf tailles à leur vraie échelle, les huit types côte à côte »* — une seule
ligne, trois comptes, et le produit porte aujourd'hui **dix** tailles. Elles sont **retirées**
et non remesurées : ce que la phrase dit ne dépend d'aucun des trois.

### Les numéros d'étape, et pourquoi ils se sont tous décalés le même jour

Ils étaient huit, écrits à la main, et l'insertion de l'étape du style les a **tous** décalés
d'un cran sans qu'une seule erreur ne se lève : *« l'étape 2 »* désignait une étape devenue la
troisième, ce qui est exact au caractère près et simplement faux. Cinq commentaires du code
citaient même *« l'étape 10 »* pour la douzième — décalés de deux crans, par `D1` puis par `D2`.

Ils se désignent maintenant par leur **nom d'abord**, le rang ensuite : c'est le nom qu'on
retrouve dans la colonne de gauche, qui n'affiche que des noms. Le nom suit le style, puisque la
quatrième étape en porte deux depuis `D2`.

### Deux chiffres remesurés, deux chiffres retirés

| la phrase | ce qu'elle disait | ce qui est écrit maintenant |
|---|---|---|
| la lecture de palette | *« une centaine de millisecondes »* | **6 ms à 1,2 s, 360 ms en médiane** — sur les 92 cartes du dépôt |
| le fond écarté d'un artwork | *« 100 % … le reste — le fond — est écarté »* | deux phrases selon qu'il reste quelque chose : **3 des 10 artworks officiels sont lus à 100,0 %** |
| le poids de l'univers dans le prompt | *« plus de la moitié du texte »* | **retiré** — un rapport entre deux textes qui bougent chacun de leur côté |
| la hauteur du menu d'une carte | *« il fait 300 px pour une carte 1× qui en fait 190 »* | **retiré** — ce qui décide la règle est le rapport, pas les valeurs |

Et le seuil de 100 % a montré un défaut de plus, trouvé en écrivant la phrase : la case *« me le
montrer sur l'image »* et le renvoi *« découper le montre en magenta »* s'offraient sur une carte
où le magenta ne couvre aucun pixel. **Une case qui ne change pas l'image est pire qu'une case
absente** — on la coche deux fois avant de conclure qu'elle est cassée.

### Le garde-fou est là où il ne coûte rien, et nulle part ailleurs

La règle générale — *un nombre affiché se calcule, ou il ne s'affiche pas* — reste écartée : c'est
la décision de l'auteur, et le risque est écrit dans le plan plutôt que découvert plus tard.
**Un seul essai la fige, sur la seule famille où le calcul est gratuit** : les numéros d'étape.
Il est **sans exception**, et c'est ce qui l'a rendu utilisable — une première écriture tolérait
les lignes portant `G1`, c'est-à-dire une règle à deux étages dont le second demandait de savoir
qu'il existe. Les deux commentaires concernés disent maintenant *« la deuxième »* en toutes
lettres.

## D2, seconde moitié — le pas est retrouvé, et surtout la détection sait se taire — 3 septembre 2026

**Le plus vieux défaut du produit avait deux moitiés, et c'est la seconde qui manquait.** Un
modèle rend une image de mille pixels « à l'allure pixel art » ; parfois elle porte vraiment
des carrés, parfois c'est une peinture. Le produit ne savait pas dire dans lequel des deux cas
il se trouvait — et sa mesure de grille, `mesurer_grille`, répondait **2 avec une netteté de
0,94 sur une peinture**. Faux, et confiant : le pire des deux états.

### La pièce qui manquait s'appelle le peigne

L'autocorrélation d'une image lisse décroît doucement depuis le pas 2 sans jamais faire de
bosse ; la règle du produit — *le plus petit pas qui approche la crête* — attrapait alors ce 2,
parce qu'il n'a pas de voisin de gauche à qui se comparer. **Le peigne demande autre chose** :
que le contraste tombe sur les *multiples* du pas, et pas n'importe où. Sur une grille il y est
presque tout ; sur une peinture il est partout.

Mesuré sur les 149 images brutes du dépôt : **0,40 au plus bas quand la détection annonce un
pas, 0,35 au plus haut quand elle se tait.** Le seuil est posé exactement dans ce vide, et rien
ne le franchit par accident.

### Le taux, sur un lot bâti à partir de vraies images du dépôt

Aucune image du dépôt ne vient avec son pas écrit à côté, et personne ne le lit à l'œil sans se
tromper. Le banc de réception (`essais/essai_grille_produit.py`, gratuit) fabrique donc la
vérité : douze vrais dessins du dépôt, pris dans les six jeux, ramenés à quarante cases par la
réduction du produit puis reposés sur une grille de pas connu — nets, flous, décalés, et à pas
non entier, qui est le cas réel.

| | |
|---|---|
| **200 sur 204, soit 98 %** | exacts, sur la plage que le dépôt produit (2 à 32 px) |
| 0 erreur d'octave, 0 franc raté | les quatre écarts sont des **renoncements**, tous sur un pas de 9,4 px |
| 12 cas posés **hors borne** | 12 renoncements — aucun pas faux annoncé avec assurance |

Et sur les images brutes, où aucune vérité n'existe, la séparation suit les jeux : le jeu du
marais, qui a reçu des carrés, fait **annoncer 26 fois sur 27** ; *cœur de pierre*, qui a reçu
des peintures alors que sa bible réclamait mot pour mot *« strict 64x64 px tile snap »*, fait
**renoncer 24 fois sur 26**.

### Trois chiffres circulaient pour la borne, aucun n'était bon

Le plan visait **80 px** — un chiffre jamais relevé, qui ressemble à 5 × 16 plus qu'à une
mesure. Les détecteurs de référence s'arrêtent à **24** et *coupent* le dépôt : le jeu des
vignettes monte à 32. La mesure d'avant balayait jusqu'à **64**, deux fois plus large que ce
que le dépôt produit. La borne est donc **32 px**, le plus grossier pas trouvé sur les
149 images ; 99 % tiennent sous 22.

> ⚠️ **Une affirmation héritée n'est pas reproduite, et c'est écrit plutôt que tu.** Le plan et
> le bilan disent tous deux que *relever la borne fait perdre de la finesse*. Cet effet
> n'apparaît pas : à 64 la réussite est exactement celle de 32, et sur les images brutes la
> borne ne change **rien du tout** — 61 annonces, de 24 à 128. La raison est mécanique : le pas
> retenu est le *plus petit* qualifié, donc élargir la recherche ne lui donne pas d'occasion de
> se tromper. Ce qui décide n'est pas ce qu'une grande borne coûterait, c'est ce qu'une petite
> borne **coupe** — douze cas de plus renoncés à 24.

### Ce qui a été mesuré puis écarté

**L'arbitre d'aller-retour** — réduire au pas candidat, réagrandir, regarder ce qui a changé —
est l'idée qui vient d'instinct, et elle **abîme** le détecteur : 170 cas justes sur 204 contre
200 sans lui, et **30 erreurs d'octave qu'il fabrique lui-même**. La raison est mécanique : sur
une image floue à pas 13,1, la reconstruction au pas 13 est imparfaite tandis que celle au pas
2 est presque parfaite — des blocs de deux pixels sont uniformes dans n'importe quelle image
lisse. L'arbitre choisit petit **pour la mauvaise raison**.

**Additionner les canaux plutôt que de convertir en gris** est le second résultat
contre-intuitif du banc d'étude, et la mesure de réception le nuance : sur des images pleines
l'écart est d'**un cas sur 204**. Ce qui décide est ailleurs, et c'est franc — un sprite
détouré d'une seule teinte porte toute sa grille dans sa silhouette, le gris jette l'alpha en
entrant, et il répond **2 à tous les coups**.

### Ce que l'écran montre, et ce qu'il ne pose pas

Une ligne au-dessus du réglage de taille : *« le modèle a peint des carrés de 8 pixels :
l'image en compte 48 de côté, et au-delà il n'y a plus de détail à récupérer »*. Le pas seul ne
servirait à rien — la taille se règle en carrés, jamais en pixels de l'image reçue.

Quand la détection renonce, elle le dit avec ses mots, et **les crans de taille restent là** :
c'est alors l'auteur qui la pose, ce qu'il faisait déjà et ce qui ne change pas. La cible est
demandée, jamais déduite de l'image reçue (US-61) ; ce que la tranche ajoute est qu'elle cesse
de se choisir à l'aveugle.

### Un défaut réparé en passant

La dérive de grille d'une planche — le rapport du pas le plus grossier au plus fin — se
calculait sur des faux positifs : une case peinte sans grille répondait 2, et ce 2 entrait dans
le calcul. La revue externe le nommait. Une case sans grille rend maintenant zéro, l'écran
l'affiche « — » comme il le faisait déjà, et la mesure ne réencode plus chaque case en PNG pour
la redécoder aussitôt — vingt-quatre allers-retours par planche, pour rien.

## D5 — rien ne pouvait être plus grand qu'un personnage, et c'était une famille d'assets entière — 3 septembre 2026

**Le réglage d'échelle ne savait dire que *plus petit*.** Chaque image revenait dans une case carrée
du même côté, et l'échelle disait quelle part de cette case le sujet remplit : un personnage 100 %,
un meuble 66 %, un objet tenu 40 %. Le plafond était donc le personnage, et il était écrit **en douze
endroits**, comptés — trois corps de route, deux refus de service, un calcul d'image, trois du
calibrage, la liste des positions du curseur, et les deux curseurs d'écran. Un moulin, un arbre, une tour, une porte de ville : le produit n'avait
aucune façon de les demander.

Le modèle était **juste vers le bas** — c'est bien ainsi qu'un objet tenu en main se dessine — et
faux vers le haut, où il n'allait pas.

### La règle des vrais jeux 2D a dessiné la réparation

**Le carré ne change jamais de taille.** Ce qui change entre un personnage et un bâtiment est le
*nombre* de carrés qu'il couvre, jamais leur dimension : un personnage fait 32 carrés de haut, une
maison en fait 96. Agrandir les carrés pour les gros objets est l'erreur classique et elle porte un
nom — des **« mixels »** —, parce que deux tailles de pixel dans une même image se voient
immédiatement : l'œil compare les bords. Les moteurs le confirment, et c'est le point qui tranche :
la résolution de base, la taille de tuile et le filtrage n'ont **aucune variante « pour les gros
objets »**. La taille de tuile est une propriété du jeu, pas de l'objet.

### Donc l'occupation reste, et c'est son plafond qui tombe

Elle disait déjà la bonne chose — une hauteur relative au personnage —, et 300 % se lit *trois
personnages*. **Rien ne se convertit, aucun fichier ne se réécrit**, et tout ce qui est à 100 % ou
en dessous rend exactement l'image d'avant : c'est le premier critère de la tranche, et le plus
important, puisque le dépôt a des centaines d'images déjà traitées et qu'une image retraitée ne se
compare à rien.

| ce qu'on déclare | ce qui revient |
|---|---|
| 40 % — un objet tenu | 26 carrés dans une image de 64 · inchangé |
| 100 % — un personnage | 64 carrés, l'image entière · inchangé |
| **300 % — un bâtiment** | **une image de 192 carrés · impossible avant** |
| 800 % — le plafond | une image de 512 carrés, huit personnages |

### La forme du fichier, laissée au produit par l'auteur

Ses mots : *« choisis ce qui est le mieux et compatible avec godot »*. C'est une **boîte carrée dont
le côté suit la hauteur déclarée**. Trois raisons, et la troisième est la plus lourde : un moteur la
pose telle quelle ; son côté reste un multiple entier de la case du projet, donc elle tombe aussi
sur une grille de tuiles ; et les images d'une même animation **continuent de se superposer au
pixel**. Un fichier taillé au ras du sujet aurait été plus léger et aurait fait perdre cette
superposition — qui est très exactement le défaut que la tranche d'animation doit réparer.

### Deux bornes, et l'une d'elles a été trouvée par un essai qui échouait

Le plafond est la plus basse de deux bornes. **Celle du métier — huit personnages** : un bâtiment de
trois étages en fait quatre à cinq, un grand arbre cinq à six, une porte de ville six à huit ;
au-delà on fabrique un fond, et un fond est un décor qui ignore la case. **Celle de la machine — un
canevas de 2048 carrés**, le plus grand nombre que le produit connaisse déjà.

La première n'était pas prévue. Sans elle, une case de 16 carrés autorisait 12 800 % — cent
vingt-huit personnages, physiquement possible et jamais utile — et le curseur y gagnait **deux mille
positions**. C'est l'essai des crans, écrit en E3, qui l'a dit en échouant : une case plus fine
rendait moins de crans qu'une grossière, l'inverse de ce qu'il affirme depuis.

### Ce que l'auteur a demandé pour l'écran, et pourquoi c'est plus qu'un habillage

*« Les deux, avec un rappel visuel, une sorte d'échantillon »*. Un nombre de carrés est ce que
réclament les moteurs de jeu et les outils de dessin ; un nombre de personnages est ce qui se lit
quand on décrit un monde. L'écran dit les deux et **dessine** le rapport : le cadre de l'échantillon
*est* le fichier qui reviendra, et un trait pointillé y marque la hauteur d'un personnage — au tiers
du cadre pour un bâtiment de trois.

Le dessin d'avant plafonnait à la case, et c'est ce qui le rendait faux : **une barre dans un carré
ne peut jamais dépasser le carré**, donc il montrait très exactement la limite qu'on venait de
lever.

### Ce que la tranche a appris

- **Une borne qu'on lève peut être porteuse ailleurs.** Le calibrage s'appuyait sur le plafond de
  100 % sans le dire : l'inverse d'un arrondi dépasse volontiers d'un pour cent, et sans borne le
  calibrage d'un personnage ordinaire écrivait 101 % — ses images sortaient en 65 carrés au lieu de
  64. Un demi-pixel d'arrondi faisait sortir tout le monde de la case.
- **Une limite physique n'est pas une limite utile.** 12 800 % était possible et absurde. Il fallait
  une seconde borne, tirée du métier et non de la machine.
- **Un dessin qui ne peut pas montrer un défaut le cache.** L'échantillon d'avant était une barre
  dans un carré : il ne *pouvait pas* dessiner un moulin plus haut qu'un personnage, donc il rendait
  la limite invisible au moment même où on la subissait.
- **Un essai qui échoue pour la bonne raison vaut une mesure.** Deux des trois trouvailles de cette
  tranche viennent d'essais existants qui ont cessé de passer — pas d'une relecture.

### Ce qui reste ouvert

La **largeur**. Un sujet déclare sa hauteur, et sa largeur suit ses propres proportions dans une
boîte carrée : un mur trois fois plus large que haut y laisse du vide de part et d'autre. Aucune
image du dépôt n'est dans ce cas, et l'ouvrir demanderait une seconde question à chaque type — on
attend qu'un vrai sujet la réclame.

## D2, première moitié — la réduction devient un choix, le style graphique devient une question, et un réglage qui ne faisait rien depuis T4 se met à agir — 3 septembre 2026

**La tranche s'est coupée en deux, et la mesure a dessiné la coupure.** D2 promettait deux choses :
retrouver la grille d'une image qui en porte déjà une, et réduire sans bouillie. La première moitié
livrée est la **réduction** ; la détection reste.

Ce n'est pas un renoncement. Le banc est parti de deux illustrations que l'auteur a fournies, et
elles n'ont **aucune grille à retrouver** — ce sont des peintures. Le chemin qu'elles demandent est
celui que la revue externe appelle *pipeline B* : convertir. Livrer la détection d'abord aurait été
livrer la moitié qui ne sert à aucune des images qu'on avait sous la main.

### Ce que le banc a montré, et pourquoi il y a quatre méthodes et non une

Quatre façons de passer de 1254 pixels à N carrés, **toutes ramenées au même nombre de couleurs**
pour que la comparaison porte sur la seule réduction :

| méthode | ce qu'elle rend |
|---|---|
| **vote en deux temps** | contour net **et** intérieur lisible — un sprite calme |
| **traits épaissis** (PixelOE) | garde les traits d'un pixel — la hampe d'une lance reste entière —, contour plus agité |
| **réduction douce** (Lanczos) | la silhouette la plus lisse, l'intérieur mou : un dessin réduit, pas un sprite |
| **au plus proche** | ce que l'atelier faisait : un pixel sur N gardé, les autres jetés sans être regardés |

**Aucune ne gagne, et c'est le résultat.** L'auteur a tranché : *« clairement les 4 ont des rendus
différents avec leurs avantages et inconvénients et peuvent influencer le style souhaité par le
créateur »*. Les quatre restent donc vivantes — choisies au projet, changeables **image par image
en cours de route** —, avec le vote en deux temps pour défaut.

Ce que l'atelier faisait jusque-là était le pire des quatre, et personne ne l'avait choisi : la
réduction au plus proche voisin était écrite dans le code, sans réglage. Sur un dessin fin, un trait
d'un pixel de large avait une chance sur N de survivre. **C'était un tirage au sort qui se faisait
passer pour une méthode.**

### Le défaut trouvé en chemin était plus gros que la tranche

La quantification n'entrait dans une recette **que s'il existait une palette**, et la palette se
déduit des artworks officiels. Un projet sans artwork ne réduisait donc **aucune couleur** : mesuré,
un personnage ramené à 64 carrés sortait à **905 couleurs**. Le réglage `Univers.couleurs` existait
depuis T4, se réglait, s'enregistrait — et ne faisait rien.

Trois choses le maintenaient en place, et chacune paraissait raisonnable seule :

1. `recette_de` ne **posait** pas la quantification sans palette ;
2. le service la **refusait** si on l'écrivait à la main ;
3. l'écran **cachait** le réglage dans ce cas — donc ne montrait même pas ce qui manquait.

Et trois essais figeaient la règle, dont un nommé *reste refusée*. **Un essai qui fige une absence
de comportement protège la panne si personne n'écrit pourquoi.** Les trois ont été réécrits à
l'envers, avec la raison dans le corps du test.

Le pivot est ailleurs qu'on l'aurait cru : ce qui commande la quantification n'est pas la palette,
c'est **la taille de case** — c'est-à-dire le fait même de faire du pixel art. Un nombre fini de
couleurs *est* ce qui distingue un sprite d'une image rétrécie. Sans taille imposée — un jeu en
dessin — les couleurs ne sont plus touchées, parce que les réduire transformerait le dessin en
affiche sérigraphiée.

### Le plafond des couleurs est mesuré, pas décrété

Six paliers tranchés par l'auteur — **8 · 16 · 32 · 64 · 128 · 256** —, *« avec le max bloqué au
nombre de pixel »*. Le plafond retenu est **le côté du sprite**, et il tombe sur la mesure à chaque
taille : le sujet occupe environ 27 % de la toile, et au-delà du côté l'image ne contient plus assez
de teintes distinctes pour remplir la palette demandée — 32 carrés rendent 30 couleurs quand on en
demande 32, et 229 quand on en demande 256.

**Le banc s'est trompé avant de se corriger, et ça vaut d'être écrit.** Jugé sur une image non
détourée — à la demande de l'auteur, pour isoler la pixelisation —, le fond uni occupait **73 % des
pixels** et raflait la majorité de la palette : à 8 couleurs demandées, 5 partaient au fond et il en
restait **3** pour le personnage. On allait écarter des paliers parfaitement utilisables sur la foi
d'une bouillie que le produit ne fabrique jamais, puisqu'il détoure avant de quantifier. Palette
comptée sur le sujet seul, **8 couleurs suffisent déjà** à 64 carrés.

### Le style graphique — la décision la plus lourde du jeu se prenait par accident

Elle n'était pas au programme, et elle est sortie de la question des couleurs. En cherchant quand
réduire les couleurs, une chose est apparue : *ne pas réduire les couleurs* et *ne pas faire de pixel
art* sont **la même décision**, et le produit ne la posait nulle part. Elle se **déduisait** de la
neuvième valeur d'une liste de tailles, trois étapes plus loin, dont le libellé disait *ce jeu n'est
pas en pixel art*. On choisissait une taille, et on décidait sans le savoir de tout le reste.

Le style est donc devenu la **deuxième** question du jeu, juste après le nom, et il se choisit en
image — la demande de l'auteur : *« on propose le choix du style de jeu ici et on met une image
cliquable pour chaque style »*. Les deux vignettes sont **le même personnage**, passé par la chaîne
du produit lui-même : ce qu'on compare en cliquant est bien ce que l'atelier rendra.

Une fois posé, il commande trois choses que l'auteur ne réglait pas séparément :

| | en pixel art | en dessin |
|---|---|---|
| ce que la taille veut dire | **combien de carrés** de côté — 8 à 512 | **combien de détail** — 256 à 2048 |
| les couleurs | réduites au palier choisi | gardées : un dessin a ses nuances |
| ce qui part au modèle | *2D pixel art on a 64x64 grid*, et le calage | rien de tout cela |

**La troisième ligne était un dégât, pas une élégance.** Un jeu en dessin qui gardait une finesse de
1024 envoyait au modèle *2D pixel art on a 1024x1024 grid* — le contraire mot pour mot de ce que
l'auteur avait choisi, sur la case qui décide de l'allure. Le défaut n'était pas atteignable avant
que le style existe : « aucune taille » était la seule façon de dire « pas de pixel art », et elle
vidait les deux phrases par le même geste.

**Changer d'avis ne casse rien**, et c'est la règle de D1 réemployée — *on ne réécrit que ce que
personne n'a choisi*. Passer en dessin ramène la taille dans la nouvelle liste et pose la réduction
douce **seulement si** la méthode était encore le défaut d'avant ; une méthode choisie à la main
survit à la bascule. Et les projets d'avant se relisent sans qu'un fichier soit réécrit : sans champ
`style`, il se déduit de la taille, exactement comme le produit le déduisait déjà.

**Deux défauts sont nés du style lui-même, et tous deux étaient muets.** L'étape des tailles a pris
un second titre — *La finesse* en dessin —, et le rang d'une étape se retrouve par son titre : elle
est devenue introuvable dans sa propre liste, s'est affichée **sans sa ligne « étape 4 · le jeu »**,
seule des douze, tandis que la colonne de gauche continuait d'afficher l'ancien nom. Deux noms pour
une étape, à 240 px l'un de l'autre. Et l'annonce écrite la veille pour l'absence d'artwork —
*« les couleurs se déduisent de chaque image »* — est restée affichée en dessin, où **rien ne se
déduit** : une phrase exacte devenue fausse sans changer d'un mot, trois lignes au-dessus de celle
qui dit le contraire. Les deux sont corrigés et tenus par des essais.

### Ce que la tranche a appris

- **Une étape du traitement qui ne s'exécute jamais ne se voit nulle part.** Un réglage qu'on peut
  poser et qui n'agit pas est pire qu'un réglage absent : l'auteur croit avoir réglé quelque chose.
- **Une bibliothèque « légère » peut tirer un moteur lourd par son seul import.** `pixeloe.legacy`
  s'annonce NumPy/OpenCV et charge `torch`. La disponibilité se cherche donc avec `find_spec`, qui
  ne charge rien — exactement comme `rembg` deux ans plus tôt.
- **Une option qui porte le bon nom peut faire le contraire de ce qu'elle annonce.** Le `colors=32`
  de PixelOE rendait 470 couleurs : il quantifie, puis rappelle un étalonnage qui défait tout.
- **Un banc qui isole une variable peut en fausser une autre**, et fabriquer un pire cas que le
  produit ne produira jamais.
- **Donner un second nom à une chose qu'on retrouve par son nom est un changement de clé.**
  L'étape des tailles a perdu son numéro le jour où elle a pu s'appeler autrement — sans erreur,
  sans message, et le garde-fou a fait exactement ce pour quoi il était là.
- **Une phrase exacte dans un mode devient un mensonge dans l'autre.** Quand un réglage ouvre un
  mode où une mécanique s'éteint, il faut relire les phrases qui décrivent cette mécanique — pas
  seulement le code qui l'exécute.

### Ce qui reste, et ce qui suit

**Rien ne reste : la seconde moitié est livrée le même jour**, et elle a son entrée en tête de ce
journal — *le pas est retrouvé, et surtout la détection sait se taire*. Ce paragraphe disait alors
qu'il restait à **retrouver le pas** d'une image qui porte déjà une grille, que le banc du
détecteur existait (`essais/essai_grille_retrouvee.py`, 19 sur 19 sur le corpus bâti), que le test
du peigne séparait franchement une peinture d'une vraie grille — **0,12 contre 0,69** — et que le
pas maximal des images réelles du dépôt était de **32 px**, non 80. Les quatre se sont vérifiés.

A suivi immédiatement, à la demande de l'auteur, et c'est fait le même jour : **la tranche des
tailles**, `D5`, plus haut dans ce journal.

## D1 — le réglage n'appartenait pas à la nature de l'image, il appartenait au moteur — 3 septembre 2026

**La tranche a été construite en entier, et sa mesure de départ n'a pas survécu au recomptage.**

Le plan tenait sur un chiffre juste : sur les 123 détourages écrits à la main dans ce dépôt,
**64 portent un durcissement du bord quand le réglage livré est zéro**, et l'écart se lisait
entre une image seule (67 %) et un morceau de planche (38 %). D'où le titre de la tranche : *une
recette par défaut, par nature d'image*.

**Recompté en croisant avec le moteur de détourage, cet écart s'évapore.**

| moteur    | passes | durcissement laissé à zéro | valeur la plus fréquente |
|-----------|--------|----------------------------|--------------------------|
| le bord   |   72   |          **78 %**          | **0** (56 sur 72)        |
| la pipette|   11   |           0 %              | **1** (6 sur 11)         |
| le modèle |   40   |           2 %              | **2** (32 sur 40)        |

À moteur égal, la nature ne décide presque plus rien — 100 % contre 93 % sur le moteur par
modèle. Le moteur, lui, décide tout. **Et la raison était déjà écrite dans le même document**,
trois mesures plus haut dans `docs/bilan-v3.md` : le moteur du bord ne produit aucun pixel à demi
transparent, il est binaire par construction ; le moteur par modèle en produit sur 95 % du sujet.
*Le durcissement ne corrige pas un goût, il corrige une frange — et la frange appartient au
moteur qui la fabrique.* Personne n'avait joint les deux comptages, et une tranche entière allait
se construire sur la mauvaise moitié.

**Ce qui a été livré, du coup.** La structure demandée, entière : deux natures d'image et quatre
familles qui se règlent, la provenance affichée avant de générer *et* sur la fiche, rien du passé
réécrit. Et le contenu que la mesure vraie dicte : **le durcissement voyage avec le moteur**, y
compris au moment où l'auteur en change sur une image — geste qu'il avait retapé à la main
**39 fois sur 40**. Un durcissement qu'il a déplacé lui-même n'est jamais réécrit, qu'il l'ait
posé dans le même envoi ou trois jours plus tôt.

**Ce que ça rapporte, sur ses 123 passes** : le durcissement tapé à la main tombe de **54 % à
24 %**. Le critère du plan demandait l'autre chiffre — combien de recettes s'écartent encore de
leur défaut : **53 sur 108**, et le durcissement est en cause dans les 53. Ce n'est pas un échec,
c'est ce qu'un moteur choisi image par image produit, et aucun défaut ne peut le deviner.

**Trois choses apprises.**

1. **Un comptage non croisé raconte l'histoire de la variable qu'on a regardée.** Avant de faire
   d'un chiffre une décision de produit, chercher la variable qui pourrait l'expliquer
   entièrement — et la chercher d'abord dans les mesures déjà écrites à côté.
2. **Une règle qui complète une charge doit partir de la charge.** La première écriture de « le
   durcissement suit le moteur » reconstruisait la passe depuis celle qui était rangée, et perdait
   le point de la pipette que le même envoi apportait. Un essai d'une autre tranche l'a attrapé.
3. **Un écran de défauts qui montre tout ne montre rien.** La tolérance et le seuil de
   transparence sont restés à leur valeur livrée 96 fois sur 100 : les mettre là aurait fait
   quatre curseurs dont deux ne bougent jamais. Ils se posent sur une image, où l'on voit ce
   qu'ils font.

Le banc : `essais/essai_defauts_de_detourage.py`, gratuit, il relit la base. 29 essais serveur,
7 essais d'écran, aucun centime.

---

## R6 — une planche sur deux entrait pleine de vide, et personne ne le disait — 3 septembre 2026

**La tranche a été ouverte pour un gâchis visible, et elle en a trouvé un plus gros à côté.**
Le visible : le compte d'images était le seul refus automatique du produit, et il jetait des
appels payés entiers — **quatre planches sur treize du banc d'animation refusées pour un sujet
de trop**, trente-et-un pour cent des appels perdus sur un geste dont c'est le régime normal.
L'invisible : quand un modèle redessine les traits du quadrillage, le remplissage depuis le bord
**s'arrête sur eux**, le fond de chaque case reste opaque, huit cases bordées font huit taches,
le compte tombe juste — et l'atelier acceptait.

**Mesuré, et c'est la mesure qui a fait la tranche.** La chaîne du produit passée sur les
135 planches des deux bancs :

| | remplissage de la boîte du sujet | combien |
|---|---|---|
| planche saine | 0,34 à 0,77, médiane 0,63 | 32 à huit sujets |
| quadrillage redessiné | **0,99 à 1,00** | **47 planches sur 95** |

Les deux populations ne se touchent pas — rien entre 0,77 et 0,99 —, donc le seuil est posé au
milieu du vide, à **0,90**. Et **une planche du banc des recettes sur deux** était entrée en
bibliothèque comme des cases bordées dont les deux tiers sont du fond. Le plan estimait ce défaut
à *« 64 % contre 34 % »* ; 64 %, c'est la valeur d'une planche **saine**.

**Le piège de la mesure, et il a failli se refermer.** Le premier réflexe est de mesurer la part
opaque de la **vignette découpée**. Elle vaut **1,00 sur toutes les planches, saines comprises** —
parce qu'une vignette est taillée dans les octets d'origine, fond compris. Elle ne sépare rien.
C'est la **boîte du sujet**, prise sur l'alpha du détourage, qui dit si ce qu'on tient est une
silhouette ou un rectangle.

**Un surplus s'ouvre, un manque refuse — et c'est la seule asymétrie.** Neuf sujets pour huit
contiennent tout ce qui a été demandé ; sept n'en contiennent pas assez, et aucun choix ne
fabriquera l'étape qui manque. Les deux anomalies, elles, se règlent du même geste : la planche
s'arrête, montre ses sujets mesurés, et l'auteur écarte ce qu'il ne veut pas. **Jamais un refus,
toujours un regard.**

**Trois états, et le troisième est celui qu'on oublie.** *Personne n'a regardé*, *j'ai regardé et
j'écarte ceci*, *j'ai regardé et je garde tout*. Le troisième doit exister et se distinguer du
premier, sans quoi une planche aux cases pleines entrerait en silence — ce que la tranche existe
pour empêcher. Un `null` d'un côté, une liste vide de l'autre.

**Et le défaut trouvé en regardant, pas en lisant.** Le chantier est *ce dont un emplacement
attend encore une issue*, et celui d'une planche en attente est **réussi** : sa tuile quittait
donc la grille à l'arrivée, et comme rien n'était entré en bibliothèque, aucune image ne prenait
sa place. L'auteur voyait un écran vide et n'avait plus aucun chemin vers ce qu'il venait de
payer — **le gâchis silencieux de la tranche, refait à l'identique par sa propre réparation.**
Les essais d'écran ne pouvaient pas l'attraper : ils injectent la génération eux-mêmes. Il a
fallu ouvrir un second atelier sur le double du fournisseur et regarder.

**Ce que ça coûte :** rien, ni en construction ni en usage. Vingt-cinq essais côté serveur, huit
côté écran, tous sur des planches fabriquées ou déjà sur le disque. Écarter un sujet ne rappelle
personne : c'est la même image, recoupée autrement.

## A10 se dessine, et deux règles tombent avant d'être écrites — 3 septembre 2026

**La maquette de la V3 a servi à ce qu'une maquette doit servir : trouver les erreurs avant le
code.** Elle est vivante — la bande pixelisée s'y recalcule dans le navigateur par la chaîne du
produit —, et c'est ce qui a permis de voir deux choses.

**Une bande n'est pas un début et une période.** Le montage des essais prélevait N images
régulièrement espacées dans une fenêtre. L'auteur l'a tranché en une phrase : *je dois pouvoir
choisir individuellement chaque frame si besoin.* Il a raison, et la raison se dit en une image :
un pas de marche demande **deux images serrées au moment du contact et une seule pendant la
glisse**. Une bande est donc **une liste d'images choisies** ; la fenêtre qu'on tire ne fait plus
que la proposer.

**La fenêtre commune se prend sur le clip, pas sur la bande** — et c'est l'erreur juste à côté de
la bonne réponse. Mesuré sur le clip du 2 septembre : la fenêtre du repos seul fait 217 × 376,
celle de la marche 246 × 380. Ramené à 64 pixels de haut, **le même personnage sort à 37 pixels
de large au repos et 41 en marchant** : il grandirait de 10 % en se mettant à marcher. Une
fenêtre par bande cale les images *d'une* bande entre elles ; il faut une fenêtre par clip pour
caler *les bandes* entre elles.

**Et une règle a changé de forme, à la demande de l'auteur.** *L'éditeur n'invente aucune taille
de pixel ni aucune palette : ce sont celles du projet, en lecture seule* devient **la recette du
jeu est le point de départ, jamais une prison**. Le fond est gardé, et c'était lui qui comptait :
*une bande qui s'écarte de son jeu le dit*, en clair, à côté du chiffre changé.

**Ce que ça coûte :** rien. Quatre user stories de plus, cinq critères de plus sur `A10`, et zéro
ligne de code à défaire — parce que rien de tout cela n'était encore écrit.

## A9 — le clip entre dans l'atelier, et rien de ce qui est payé ne se perd — 3 septembre 2026

**La première tranche de la V3 est écrite côté serveur, et elle n'a pas coûté un centime.**
Trente-six essais, tous sur un double. L'atelier sait commander un clip vidéo à partir d'un
sprite de la bibliothèque, l'attendre, encaisser ce qu'il a réellement coûté, en tirer ses
images, et **aller rechercher un clip déjà payé au lieu de le repayer**.

**Le second port du dépôt.** Depuis F1 la frontière du dépôt était le fournisseur d'images ;
il y en a un deuxième. Ce n'est pas un modèle de plus, et trois choses l'empêchaient d'en
être un. Un appel d'image part et revient dans la même requête, un clip se soumet et
s'attend deux minutes — **et l'atelier peut fermer entre-temps**. L'image de départ d'un clip
est *obligatoire*, là où les trois rôles d'image jointe du produit sont facultatifs et cèdent
tous devant le plafond du modèle. Et ce qui revient n'est pas une image : la chaîne qui mesure
tout fichier reçu y lève « illisible », et le rattrapage enregistrait alors **un échec à zéro
dollar** — un clip payé disparu du journal.

**L'ordre d'écriture est toute la tranche.** Le numéro du travail s'écrit *avant* la première
seconde d'attente. La dépense s'écrit *avant* le fichier, le fichier *avant* les images. Chacun
de ces « avant » ferme un trou par lequel de l'argent déjà dépensé sortait du journal, et chacun
a son essai — dont un qui regarde ce qu'il y a sur le disque **pendant** que le clip se fabrique.

**Deux choses ont changé de forme en cours de route, et les deux valaient mieux.** Le montant
facturé se lit dans la réponse d'attente, sous `usage.cost` : le verrou d'ouverture de la
tranche est tombé avant qu'elle s'ouvre. Et un montant *absent* de cette réponse ne s'écrit plus
comme un zéro : le produit enregistre zéro **en disant qu'il ne sait pas**, parce qu'un total
faux vers le bas en silence est pire qu'un trou qu'on voit.

**Ce que la tranche ajoute au dépôt, et qui se justifie.** Un décodeur de vidéos — rien de ce
qui était là ne sait ouvrir un conteneur vidéo. Il est **optionnel**, sur le modèle du second
détoureur : sans lui, un clip s'achète, se paie, se garde et se récupère ; seules ses images
attendent. **Un clip payé n'est jamais perdu faute d'une bibliothèque.**

**Ce qui reste.** L'écran. Il est dans `A10` avec l'éditeur de montage, parce que commander un
clip, l'attendre et le découper sont **un seul geste continu** — les dessiner séparément ferait
deux écrans là où il en faut un.

## La V3 change de méthode : l'animation passe par la vidéo — 2 septembre 2026

**Six essais payés le même soir, 2,29 $, et ils renversent la version.** Le plan bâtissait la V3
sur la planche de huit cases. Il la bâtit désormais sur un clip vidéo qu'on découpe.

**Ce qui est mort, mesuré.** Quatre chemins, et chacun avait sa règle écrite d'avance. Nommer
les images jointes, ranger le texte en sections, le faire réécrire par une IA : cinq variantes,
zéro bonne planche, le témoin les bat toutes — **`R7` est close avant d'avoir été construite**.
Agrandir la référence à 256 ou 512 pixels : le 64 n'est pas battu. Préparer la pose d'abord :
quatre planches mauvaises sur quatre. Imposer la géométrie par une image de posture : la pose
est suivie au pixel, mais **le modèle emprunte aussi la carrure du guide**, trois correctifs
n'y ont rien changé. *Ce qu'on montre à un modèle, il le copie en entier* — c'est le résultat
le plus instructif de la journée, et il vaut au-delà de la V3.

**Ce qui vit.** Un modèle image-vers-vidéo reçoit le sprite et rend cent images d'un mouvement
continu. Six clips, six marches lisibles, personnage stable, fond détourable. Puis la
découverte qui commande tout : **un clip de cinq secondes porte plusieurs animations** si le
texte minute les actions seconde par seconde, nomme les transitions et impose un retour à la
même pose neutre entre deux actions. Un paiement, plusieurs bandes.

**Ce que ça ajoute au plan.** Deux tranches, `A9` — le clip entre dans l'atelier — et `A10` — le
montage, qui découpe plusieurs animations dans un clip —, seize user stories, et trois décisions
durables de plus. `A0` est clos, `A8` déclassée de finale à complément, `A3` change d'objet, et
le seul gain du côté planche — une grille de quatre colonnes sur deux rangées — descend dans
`R6` avec sa précaution.

**Ce que le plan écrit noir sur blanc sans l'avoir mesuré**, parce qu'un chemin neuf doit dire
ce qu'il ignore : un seul personnage, le plus facile qui soit ; aucune bande pixelisée notée ;
le montant réellement facturé d'un clip jamais relu, dix-huit fois sur dix-huit ; et le prix par
bande utilisable inconnu. **La vidéo ne se justifie donc pas par son prix mais par ce qu'elle
fait et qu'une planche ne fait pas.**

---

## Six arbitrages de l'auteur sur le plan, dont un qui me corrige — 2 septembre 2026

**Un récapitulatif du plan écrit pour être lisible sans rien connaître du code a servi à ce
qu'il devait servir** : l'auteur l'a relu et a tranché six points. Ils sont écrits ici parce que
trois d'entre eux **changent ce qui sera construit**, et un **annule une conclusion que j'avais
tirée trop large**.

**1 · Le fond ne coûte plus de banc.** `D3` exigeait huit tirages par branche avant la première
ligne ; c'est retiré. La raison tient : **le fond devient un réglage, pas une valeur imposée** —
une mauvaise couleur se change en un geste et se voit sur l'image suivante. Ce qui remplace le
banc est plus utile que lui : **deux mesures d'acceptation affichées sur chaque image revenue**,
les pixels de bord et ceux encore collés à la couleur de fond. *Elles se lisent sur les images
qu'on voulait de toute façon* — ce qui est très exactement la doctrine du dépôt sur les notes de
qualité, appliquée ici pour la première fois à un réglage d'envoi.

**2 · Le relevé du pantin passe de la comparaison à la boucle.** `A0` comparait trois formes de
pantin d'un coup, environ un dollar. Jugé trop cher, et surtout mal fait : *« je préfère imaginer
un test, anticiper ce qui peut échouer et le corriger, puis le tester, analyser le résultat,
corriger, refaire — plutôt que tester quinze choses d'un coup et choisir la meilleure. »*

**La règle qui en sort ne détruit pas celle des huit tirages, elle la borne** : on avance **une
tentative à la fois quand on explore** — « est-ce que ça marche seulement ? » —, et l'on tire
**assez de fois quand on arbitre** — « laquelle de ces deux branches est la meilleure ? », où le
bruit déciderait à notre place. `A0` est une exploration. *Et une méthode de boucle est écrite
avec, pour qu'une boucle ne soit pas quinze essais déguisés en un : on écrit d'avance ce qu'on
attend et les deux ou trois façons dont ça peut rater, et l'on conclut chaque tour par **quel
échec s'est produit**, jamais par une note. Un échec anticipé se corrige, un échec constaté se
re-tire.* L'ordre des trois questions change aussi : **la gratuite qui peut tout arrêter passe en
premier** — si un bras plié bave à la réduction, rien d'autre n'a d'objet, et rien n'a été payé.

**3 · « Le texte du produit ne bouge pas » était faux, et c'est moi qui l'avais écrit.** Les
bancs ont mesuré des **formulations** — dire la même chose avec d'autres mots. Ils n'ont **jamais
touché à la mise en page**. J'en avais tiré une interdiction générale, reprise dans quatre
documents. **Corrigée partout, et une tranche est née : `R7`, hors version comme `R6`**, parce
qu'elle sert toutes les générations et pas seulement l'animation — le texte se range en trois
parties nommées : le contexte, les références, la demande.

**Et le cadrage de `R7` a récupéré une remarque d'usage qui dormait**, ce qui en fait la partie
dont on peut attendre quelque chose : **une image jointe ne dit pas ce qu'elle est.** Un artwork
de style, un gabarit de découpe et un sprite de pose partent aujourd'hui dans le même sac, sans
qu'une ligne dise lequel est lequel — alors que le comportement qui a donné le gabarit est
précisément que *le modèle recopie la structure de son entrée*. **La tranche ne promet aucun gain
de taux**, et c'est écrit comme tel : elle promet un texte relisible.

**4 · Le nombre de planches était déjà un choix ; c'est mon résumé qui trompait.** Le critère
existait. Il est désormais explicite en deux lignes — le nombre se choisit **à chaque
lancement**, et **une seule planche reste un choix valable, c'est le défaut**. *Leçon de
rédaction : un résumé qui dit « on commande plusieurs planches » là où le plan dit « le nombre se
choisit » invente une contrainte que le produit n'a pas.*

**5 · Le doute de droit d'auteur sur le modèle de découpe est levé comme condition.** Retiré des
critères de `D4` et du PRD ; gardé comme fait, avec la raison de l'auteur — *« tous les modèles
sont comme ça, c'est un projet perso, rien de commercial derrière »*. Une seule clause survit,
sans insister : le jour où quelque chose sortirait de ce jeu contre de l'argent, la question se
rouvre — pour ce modèle comme pour tous les autres.

**6 · Les petits outils de dessin ne se font pas, et ce n'est pas un refus.** Le trait droit, le
rectangle, le pot de peinture et la symétrie avaient été proposés comme un ajout léger à la table
de retouche. *« On ne les fait pas, il y aura plus tard une version avec éditeur. »* **La raison
vaut d'être gardée** : chacun paraît petit isolé, et les prendre un par un fabriquerait un
demi-éditeur que personne n'aurait décidé. C'est un **rang**, pas une exclusion — la version
d'édition n'a pas de place fixée dans l'ordre, et aucune tranche du plan ne présuppose ces
outils.

**Ce que la séance dit sur la méthode.** Le récapitulatif avait été demandé pour vérifier *« si
on n'a rien oublié, ou si des choix ne correspondent pas à mes souhaits »*. Sur quatorze étapes,
**deux choix ne correspondaient pas** et **un troisième reposait sur une conclusion trop large**.
Aucun des trois n'aurait été trouvé en relisant le plan : ils se sont vus **parce que le plan
était réécrit sans jargon, pour quelqu'un qui ne l'a pas écrit**. Le plan compte désormais
**quinze étapes, 67 promesses et 109 vérifications**.

## Le dépliage reste automatique, et il se refait — 2 septembre 2026

**La seule question que le relevé d'architecture avait laissée ouverte est tranchée**, et par
l'auteur : *« je veux un dépliage automatique, mais la possibilité de refaire le dépliage à la
main si je le souhaite. »*

**Ce que ça corrige dans le cadrage de `A1`, et ce n'est pas un détail de formulation.** La
tranche était écrite comme *« son dépliage devient un geste de l'auteur : l'atelier propose les
coupes, l'auteur les corrige et valide »* — c'est-à-dire un écran de validation posé sur
**chaque** planche revenue. Cela aurait fait payer à toutes les générations le prix des rares
qui tombent mal, et alourdi le geste le plus fréquent du produit pour servir le plus rare.

**La formule qui s'en dégage vaut d'être gardée : le coupable n'était pas « automatique »,
c'était « sans retour ».** Ce qui coûtait cher n'a jamais été que la machine découpe toute
seule — elle le fait bien la plupart du temps —, c'est qu'un découpage tombé mal n'avait rien à
reprendre, parce que la planche n'existait nulle part. **La correction est donc de garder la
planche, pas de retirer l'automatisme.**

**Deux conséquences, écrites là où elles se lisent.** Le premier dépliage reste automatique et
ne demande **aucun geste de plus qu'aujourd'hui** — c'est devenu un critère d'acceptation de la
tranche, formulé pour être vérifiable. Et **la reprise au redémarrage ne se rouvre pas** : une
planche payée et reçue que la fermeture a laissée non dépliée continue de se déplier seule au
démarrage, comme depuis `C2` ; la décision la confirme au lieu de la remettre en cause.

Reporté aux six endroits qui le portaient : `docs/PLAN.md` § P1 — la tranche s'appelait alors
`A1`, et son titre, qui annonçait *« se déplie à la main »*, disait donc l'inverse —,
`docs/PRD.md` § Solution et § Critères de succès, `docs/user-stories.md` (`US-372` et `US-374`,
dont la seconde promettait exactement le contraire), `docs/ARCHITECTURE.md` § 3, et
`docs/archi-versions.md` §7 et §8.

## L'architecture relue, et une erreur que le recadrage venait d'introduire — 2 septembre 2026

**Ce qui a été fait.** Un relevé à six angles sur `docs/ARCHITECTURE.md` et ses annexes, chaque
trouvaille sérieuse passée devant un sceptique dont la consigne était de **réfuter par défaut**.
Soixante-neuf trouvailles brutes, soixante-deux après dédoublonnage, huit soumises au sceptique,
**six confirmées et deux réfutées**.

**Le résultat n'était pas celui qu'on cherchait, et c'est ce qui le rend utile.** Les six
confirmées ne sont **pas** dans `ARCHITECTURE.md` : elles sont toutes dans son annexe
`docs/archi-versions.md`, dont le §8 — l'animation — avait été écrit **avant** les trois bancs
payés et enseignait donc l'inverse de ce qu'ils ont mesuré. Il réclamait un prototypage déjà
fait, et proposait *« produire les images puis fournir un bon outil de correction »* — très
exactement l'approche que la mesure écarte. Le §7 y ajoutait la règle du pliage que `A1`
renverse, portée sans une marque de révision.

**Et le relevé a trouvé une erreur vieille de deux heures, qui était la mienne.** La tranche
`D4`, écrite le matin même, réclamait *« un cran intermédiaire entre nos deux modèles »* et
*« un catalogue qui cesse d'être deux noms en dur »*. Vérifié dans le code : le produit porte
**trois** modèles de détourage depuis `U13`, dans un catalogue structuré, et celui du milieu
porte littéralement le titre **« intermédiaire »** — le commentaire du code invoque même la
règle *« le catalogue décide, jamais une liste en dur »*. Le produit compte par ailleurs
**quatre** moteurs de découpe, pas trois.

**La faute venait du relevé d'outillage, qui parle de « nos deux modèles », et elle a été
recopiée sans vérifier.** Elle avait atteint quatre documents en une matinée. Corrigée aux cinq
endroits, **source comprise**, avec la raison écrite à chaque fois pour qu'elle ne reparte pas.
Ce qui reste vrai de `D4` après le tri : aucun de nos trois modèles n'est entraîné sur du
dessin, essayer le lourd coûte 972 Mo, et le contour doit se poser sur la vraie frontière. *Et
le seul modèle entraîné sur du dessin porte un doute de droit d'auteur que le relevé signalait
et que la tranche escamotait : il est maintenant écrit dans les critères.*

**La correction la plus grave portait sur les risques.** `ARCHITECTURE.md` déclarait la dérive
d'échelle **corrigée** par « le recadrage et la normalisation d'échelle » — alors que c'est
précisément la normalisation qui la **fabrique**, en calculant le facteur sur la boîte de
l'image courante. Le document déclarait donc réglé le seul défaut qui détruit ce qui est payé
en animation. Deux lignes de risque le disent maintenant, avec la réparation chiffrée.

**Ce qui a été repris par ailleurs** : la table des décisions de cadrage, dont six lignes sur
quinze étaient périmées et à laquelle il manquait les trois décisions du 2 septembre ; le compte
des places de la recette — **huit, pas sept**, la *différence* était omise parce qu'elle ne se
voit que sur un calque ; les quatre entités de la V2.1 comptées comme trois ; les deux entités
de la V2.2 absentes du modèle ; et une note du carnet du PRD qui envoyait corriger un défaut
**déjà corrigé** — une note « il reste à faire X » ne s'efface pas toute seule quand X est fait.

**Enfin la coupe annoncée la veille et non prise a été prise** : les 8,9 Ko de *« ce que la
toile ajoute au modèle »* descendent dans `docs/archi-versions.md` § 6.5 bis, à côté de la
dépendance de la toile qui y était déjà — deux moitiés d'un même sujet qui se renvoyaient l'une
à l'autre entre deux fichiers. **Les 1 033 renvois tombent juste**, corpus à 248 Ko.

**La leçon, et elle est nouvelle.** Les deux compactages précédents cherchaient du **poids** ; le
recadrage de la veille cherchait ce qui était **fini**. Celui-ci cherchait ce qui était **faux**,
et il a trouvé son plus gros défaut dans un travail vieux de deux heures. *Un document
d'autorité écrit vite doit être relu par quelqu'un qui essaie de le réfuter — et une recopie
depuis un relevé non vérifié est le chemin le plus court vers une erreur qui se propage.*

## La doc est recadrée, et le plan cesse de raconter du travail fini — 2 septembre 2026

**Ce qui l'a déclenché.** Le corpus de démarrage était remonté à **300 Ko**, et `docs/PLAN.md`
en portait 173 à lui seul — dont **plus des trois quarts racontaient des versions livrées**. À
côté, ce que les trois bancs d'animation et le relevé d'outillage avaient appris était réparti
sur **sept fichiers et 210 Ko**, sans qu'aucun ne conclue. Ouvrir la V3 aurait voulu dire les
lire tous les sept.

**Ce qui a été fait**, dans l'ordre où ça compte :

- **`docs/bilan-v3.md` est né.** Il ne raconte rien, il conclut : les six chiffres qui décident
  de la version, ce que chaque banc a répondu, **ce qui est mort et ne doit pas se reproposer**,
  les trois défauts que le code porte aujourd'hui, ce que le relevé d'outillage rapporte axe par
  axe, et les limites de tout ce qui précède. 20 Ko contre 210.
- **`docs/PLAN.md` est passé de 173 à 54 Ko** : il ne garde que `R6`, la V2.3 et la V3. Les
  cinq versions tenues sont descendues dans `docs/archive/plan-versions-tenues.md`, **sans
  qu'un mot change**. Ce qui en est remonté, et ne devait pas descendre : **les invariants**,
  rassemblés pour la première fois en une seule table par thème, avec la tranche qui les a
  instaurés et, pour les six qui ont été révisés, ce qui les a remplacés.
- **`docs/PRD.md` a rattrapé deux versions.** Il s'arrêtait au 1<sup>er</sup> septembre et
  **contredisait la V3 en trois endroits** : *« animation de sprites »* écartée, *« squelette,
  os, interpolation : c'est l'animation, pas le personnage »*, et *« le pliage est une ruse
  d'appel, jamais un format de livraison »*. Les trois sont barrées à leur place, avec un
  paragraphe daté qui dit ce qui les renverse. Il gagne deux frottements, deux blocs de
  critères vérifiables et deux paragraphes de hors-périmètre.
- **`AGENTS.md § Où en est le dépôt` est passé de 16 à 8,6 Ko.** Il racontait tranche par
  tranche ce que `docs/status/etat.md` raconte déjà — la règle *« aucun document ne répète ce
  qu'un autre dit »* était enfreinte par le fichier qui la porte. Il garde un tableau d'état et
  **huit points qu'il faut savoir avant de toucher au code**, qui sont les endroits où une règle
  a changé de forme sans changer de nom.
- **Neuf documents sont descendus dans `docs/archive/`** : les cinq études préparatoires de la
  V3, les vingt-et-un points d'interface traités un par un, et trois carnets clos.

**Ce que le banc a trouvé, et c'est exactement pour ça qu'il existe.** Le déplacement a cassé
**65 renvois** — 56 depuis le code, 9 entre documents —, et aucun n'aurait levé la moindre
erreur : un renvoi qui cite une section déplacée **ment en silence**. `essais/essai_docs.py`
les a tous nommés, fichier et ligne, et son relevé JSON a permis de les reprendre en une passe.
Les 994 renvois tombent à nouveau juste, et le corpus de démarrage est à **242 Ko**.

**La leçon, et elle est neuve.** Les deux compactages précédents avaient descendu une section
parce qu'elle **pesait** trop. Celui-ci descend parce qu'elle **est finie** — ce n'est pas le
même critère, et il est meilleur : un document d'autorité doit dire *ce qui reste*, jamais *ce
qui a été fait*. Le second est un journal, et il en existait déjà un.

## La V2.2 se ferme à cinq tranches sur six — 1<sup>er</sup> septembre 2026

**Ce qui l'a fermée n'est pas une décision de portée, c'est un compte que ce dépôt n'a pas.**
Il reste `F4` — Cloudflare Workers AI —, et elle ne demande ni décision ni construction
préalable : elle demande un identifiant de compte et un jeton, tous deux gratuits, chez un
fournisseur où personne n'a ouvert de compte. Le relevé `F0` avait déjà dû le décrire sur sa
documentation seule, pour la même raison, et il l'avait écrit.

**La marche à suivre pour ouvrir ce compte a été écrite le jour de la clôture**, dans
`docs/tranches/V2.2.md` § F4 : cinq gestes, et le seul piège qu'ils portent — un jeton créé à
la main veut le droit de lire **et** celui d'écrire, faute de quoi l'atelier afficherait tous
les modèles sans pouvoir fabriquer une image. Écrite d'avance parce qu'une manip qu'on
retrouve six mois plus tard se refait deux fois : une fois de travers, une fois bien.

**Ce que la version a livré**, dans l'ordre où ça se remarque : sur une machine où rien n'a
été déposé, **une image arrive** ; un appel qui ne coûte rien dit **gratuit** et non `0,00 $`,
avec ce qu'il a réellement pris écrit à côté ; chaque fournisseur a **sa place à secrets**, y
compris celui qui en demandera deux ; et **une séance de code entière ne fait plus bouger le
total en argent**.

**Ce qu'elle laisse en état de marche pour `F4`**, et qui ne sera pas à inventer ce jour-là :
la réserve du domaine accepte un plafond **facultatif** — parce qu'aucun fournisseur d'ici
n'en annonce —, et `F4` sera la première à en brancher un vrai ; le tiroir à secrets tient
deux places pour un seul fournisseur, ce que Cloudflare demande. Chacune des deux a **un
double d'essai qui la vérifie déjà**, écrit exprès : `FournisseurAvecPlafond` dans
`tests/test_f2.py`, `FournisseurADeuxPlaces` dans `tests/test_f3.py`.

**Et une leçon revenue quatre fois de suite, sous quatre formes.** Des commentaires du domaine
en `F1`, trois mots du produit en `F2`, une garde du lecteur de configuration en `F3`, deux
affichages de l'écran de confirmation en `F6` : *une chose juste sous une hypothèse devient
fausse quand l'hypothèse s'élargit.* Rien dans le code ne le signale — chaque morceau reste
juste tout seul —, et le seul remède qui a marché est de relire ce qui parlait au singulier :
« la clé », « l'argent », « au moins une place ». C'est la façon la moins chère de trouver, et
c'est aussi la seule.

**Le détail des six tranches est descendu ici**, dans `docs/tranches/V2.2.md`, le jour de la
clôture. Le plan portait ce que chaque tranche livre, l'annexe portait ses critères : deux
fichiers qui se renvoyaient l'un à l'autre pour un seul sujet. Ce qu'on lit avant d'avoir rien
lu — les cinq documents ouverts au début de chaque séance — passe de **320,6 Ko à 300,6 Ko**,
et l'on ouvre désormais un seul fichier pour reprendre une tranche.

## F6 — 1<sup>er</sup> septembre 2026

**Le travail de l'agent ne coûte plus d'argent.** Le modèle qu'il impose est celui du
fournisseur qui ne facture rien. C'était déjà l'idée en `T7` — *un agent qui code a besoin
d'un visuel correct tout de suite, pas d'un asset final* —, et elle valait alors un rapport de
six sur le coût du travail agentique ; elle vaut désormais la totalité.

**La tranche creuse un trou en le faisant, et c'est là qu'est passé le travail.** Un modèle
gratuit n'accepte aucune image d'entrée. Avant `F6`, cela voulait dire que le produit refusait
l'appel **tout entier** dès qu'un jeu avait un seul artwork officiel — c'est-à-dire sur
presque tout jeu réel. Le garde-fou aurait donc été éteint le jour même, ce qui est la façon
la plus sûre de perdre un garde-fou. La règle posée tient en une phrase : **ce que le produit
ajoute de lui-même cède devant le plafond du modèle ; ce que l'auteur a joint ne cède jamais.**

**Ce qui a coûté n'est pas la règle, c'est tout ce qui l'entoure.** *Rien ne se perd en
silence* demandait quatre choses, et chacune touchait un endroit différent : le grisé d'un
modèle se compte désormais sur ce qui ne cède pas — sinon la liste dirait *indisponible* d'un
modèle chez qui la soumission passe, c'est-à-dire l'inverse exact de la règle de `T1` ;
l'écran de confirmation marque les lignes qui ne partiront pas et l'écrit en toutes lettres ;
le prix ne compte que ce qui part ; et la génération enregistre ce qu'elle a laissé au sol.
Cette dernière ligne est celle qui se lit le plus tard : sans elle, une image faite sans le
style du jeu et une image faite dans un jeu sans style se liraient pareil, des mois après.

**Le repli du garde-fou a changé, et c'est le même raisonnement poussé d'un cran.** Il rendait
le défaut du catalogue quand le modèle imposé n'y était plus — c'est-à-dire le meilleur modèle
du banc, c'est-à-dire un payant. Un garde-fou posé pour ne rien dépenser qui se replie sur un
payant le jour où le gratuit change de nom **coûte de l'argent en silence**, ce qui est pire
que pas de garde-fou du tout. Il cherche donc un autre gratuit d'abord.

**Deux défauts d'affichage attendaient depuis E14, et c'est un modèle sans places qui les a
montrés.** Le premier : l'écran de confirmation annonce *« N avertissements — non bloquants,
écrits sur la ligne concernée »*, et les avertissements du bloc d'images n'ont pas de ligne de
prompt à eux — ils n'étaient donc rendus par **aucun chemin**. On lisait « 1 avertissement » et
l'on cherchait où. Le second : son sommaire annonçait « 1 sur 0 », parce qu'il comptait *les
cochées sur les places du modèle*, c'est-à-dire un compte sur une **capacité**. Les deux
étaient justes tant qu'un modèle avait au moins une place, et faux dès qu'il n'en avait
aucune — c'est le même piège que les trois tranches précédentes ont payé sous trois autres
formes.

**Ce que la vérification a montré, et qu'aucun essai ne montrait.** Un appel réel chez le
gratuit, sur un jeu portant un artwork officiel : l'image revient en **1 jeton et $0,00**, et
sa fiche dit *partie sans le style du jeu — 1 image n'a pas suivi, ce modèle n'en accepte
pas*. C'est la phrase entière de la tranche, lue à l'endroit où elle servira.

## F3 — 1<sup>er</sup> septembre 2026

**Le tiroir à clés a cessé d'être « la clé ».** Une place par fournisseur, chacun déclarant ce
qu'il demande — une clé, deux secrets, ou rien du tout —, et déposer l'une ne touche à aucune
autre. Le produit n'avait jamais eu qu'un champ ; le relevé `F0` avait trouvé un fournisseur
qui en demande **deux** — un compte *et* un jeton —, et un formulaire à un champ l'aurait
découvert en `F4`, au pire moment.

**La séparation qui a rendu la tranche courte.** L'adaptateur déclare *quelles places existent
et comment on en parle à l'auteur* ; ce qu'il y a dedans se lit ailleurs, dans le module des
réglages, qui ne connaît plus qu'une chose : **une place nommée, et sa valeur**. Le module ne
sait donc plus qu'OpenRouter existe, et un fournisseur neuf n'y ajoute pas une ligne. La règle
de T1 — *la valeur se relit à chaque appel, jamais au démarrage* — n'a pas été réécrite, elle
a été **étendue au pluriel** : les fabriques reconstruisent chaque fournisseur au moment où
l'on s'en sert, et chacun relit ses valeurs en naissant.

**Une garde du lecteur de configuration attendait de devenir une panne.** Pour deviner
l'encodage du fichier — PowerShell écrit en UTF-16, piège payé en T1 —, il gardait le premier
décodage **qui contenait le nom de la clé d'OpenRouter**. Imparable tant qu'il n'existe qu'un
secret au monde ; le jour où un fichier ne porte que les deux valeurs de Cloudflare, il n'est
plus reconnu comme un fichier de configuration **du tout**, et le produit annonce *aucun jeton*
sur un fichier qui en porte un. La panne se serait présentée en `F4` comme un problème de
Cloudflare. C'est le troisième jour de suite que la même chose se produit sous une forme
différente — des commentaires en `F1`, trois mots du produit en `F2`, une garde technique
ici : *une chose juste sous une hypothèse devient fausse quand l'hypothèse s'élargit*, et rien
dans le code ne le signale, puisque chaque morceau reste juste tout seul.

**Deux mots de la barre du haut n'ont pas survécu.** Elle disait `clé …a41c` ou `aucune clé` ;
le critère demandait de garder les seconds pour le cas où rien ne peut produire. Ils nomment
la mauvaise chose dès qu'un fournisseur demande autre chose qu'une clé, et la barre dit donc
**avec quoi on peut produire** — `2 fournisseurs prêts`, `1 sur 2`, `rien pour produire`. Ce
n'est pas un changement de mots mais un renversement de ce qu'elle annonce : elle décrivait
*ce qui manque*, dans un monde où un seul manque éteignait tout ; il en manque désormais un
sur deux et une image part quand même.

**Et le français a coûté un champ de plus.** *« aucune clé OpenRouter »* et *« aucun jeton
Cloudflare »* ne se composent pas avec la même règle : une phrase du produit ne se fabrique
pas par concaténation. Chaque place déclare donc sa forme négative en toutes lettres, ce qui a
permis de reproduire la phrase d'avant **mot pour mot** quand il n'y a qu'une place — et de ne
réécrire aucun essai de T1.

**Ce qu'une vérification à la main a trouvé et qu'aucun essai ne cherchait.** Déposer une clé
depuis l'étape de l'assistant laissait la barre du haut annoncer `1 sur 2` sur un atelier où
les deux fournisseurs étaient prêts : l'étape tenait son tiroir à jour toute seule et ne
prévenait personne, là où la fenêtre des réglages prévenait déjà. Deux rendus du même
composant, un seul branché. C'est exactement la leçon d'E13 — *deux endroits qui montrent la
même chose divergent par ce qu'ils font, pas par ce qu'ils affichent*.

## F2 — 1<sup>er</sup> septembre 2026

**Le produit compte dans l'unité du fournisseur, et « gratuit » a cessé de s'écrire
`$0,0000`.** C'était le mensonge par omission que l'écran des dépenses avait été construit
pour arrêter, rouvert un cran plus bas par l'arrivée d'un fournisseur qui ne facture pas :
zéro dollar est vrai, et se lit *sans limite* là où il faut lire *sans prix*. Ce qu'un appel
prend chez Pollinations — un jeton, annoncé dans ses en-têtes — est désormais enregistré à
côté du mot.

**La forme trouvée est plus petite que la tranche ne le laissait croire, et c'est ce qui l'a
rendue tenable.** Le premier réflexe était d'ajouter une unité à côté du coût, partout. Le
second, celui qui a été suivi : **le coût en argent est *déduit* de la quantité et de son
unité**, et vaut zéro dès que l'unité n'en est pas une. L'invariant *un total en argent ne
compte que de l'argent* est alors tenu **par construction** — un jeton ne peut pas entrer dans
une somme de dollars, où qu'elle soit calculée —, et aucune des dizaines de sommes de
`cout_usd` du dépôt n'a eu à apprendre qu'il existe d'autres unités. Huit cents essais sont
restés verts à travers un changement de modèle d'objets.

**Le relevé avait écrit la contrainte, et le plan ne l'avait pas lue.** Deux des dix critères
demandaient d'afficher *ce qui reste*. Or « ce qui reste » demande un plafond, et **aucun des
deux fournisseurs n'en annonce** : celui qui ne demande rien limite une **cadence**, un appel
toutes les quinze secondes, pas un quota. C'était écrit noir sur blanc dans la cinquième
conclusion du relevé `F0`, un jour plus tôt. Le produit a donc été construit avec un plafond
**facultatif** — `reste` vaut alors `null`, qui n'est pas zéro : zéro veut dire *attends
demain*, `null` veut dire *rien ne te limite*. Un double annonce un plafond pour que la
machinerie soit vérifiée avant que `F4` ne l'utilise pour de bon.

**Et le banc gratuit a annoncé une régression qui n'existait pas.** Il redemandait la même
phrase à chaque lancement ; le fournisseur la servait de son cache en 0,2 s au lieu de 25, et
**sans aucun de ses deux en-têtes** — ni celui qui dit quel modèle a répondu, ni celui qui dit
ce que l'appel a consommé. Le garde du modèle instauré en `F1` ne pouvait donc pas se
déclencher, et le banc a écrit que l'adaptateur avait cessé de refuser. Deux choses valaient
d'être apprises. La première : **la durée était la preuve, et personne ne la lit** — 0,2 s
pour une image qui en demande vingt-cinq n'est pas une bonne surprise, c'est un aveu. La
seconde : **un banc qui mesure un fournisseur demande une phrase que personne n'a demandée**,
sinon il mesure un cache en croyant mesurer un adaptateur. Le garde, lui, garde son trou : sur
une réponse cachée, on ne peut pas savoir quel modèle a fait l'image. Sans conséquence tant
que ce palier ne déclare **qu'un** modèle — ce qui est mesuré —, et à rouvrir sinon.

**Trois mots du produit étaient justes parce qu'il n'y avait qu'une unité** : *payé*,
*facturé*, *à repayer*. Chacun devient faux chez un fournisseur qui ne facture pas, et aucun
n'aurait levé d'erreur. C'est le même piège qu'`F1` avait payé sur les commentaires, une
couche plus haut — *une phrase juste sous une hypothèse devient fausse quand l'hypothèse
s'élargit* —, et il vaut la peine de noter qu'il s'est reproduit **le lendemain**, sur le même
sujet, sans que la première leçon suffise à le voir venir.

## F1 — 1<sup>er</sup> septembre 2026

**Le produit connaît plusieurs fournisseurs d'images, et le second ne demande rien.** Sans
compte, sans clé, sans carte : on écrit un sujet, et une image arrive en une seconde et demie.
C'est Pollinations, celui que le relevé `F0` avait désigné — un seul modèle sur le palier
anonyme, aucune image de référence, et un jeton par appel.

**Ce qui a été le plus difficile n'était pas d'ajouter un fournisseur, c'était de nommer un
modèle.** Jusqu'ici un modèle s'appelait `openai/gpt-image-2`, et ce nom se promenait partout
— dans la liste où l'on choisit, dans le fichier d'une génération, sur la fiche d'une image,
dans le journal des dépenses. Deux fournisseurs peuvent proposer le même nom : Cloudflare
héberge les modèles de Leonardo, et le relevé l'a trouvé. Le nom est donc devenu
`OpenRouter:openai/gpt-image-2` — **les deux ensemble, jamais l'un seul** —, et il a fallu le
suivre jusqu'au bout de chaque chemin. Toutes les images déjà sur ce disque portent l'ancien
nom : le catalogue les rattrape, **mais seulement quand un seul fournisseur revendique ce
nom-là**. Sinon il dit qu'il ne sait pas, plutôt que de choisir entre un payant et un gratuit
à pile ou face.

**Une règle du dépôt a rencontré une autre, et il a fallu trancher.** Le critère de la tranche
demandait que couper la liaison d'un fournisseur **grise** ses modèles. Une règle plus
ancienne dit que *l'échec survient au moment où on génère, jamais au démarrage* — et la V2.2
l'hérite sans la rediscuter. Un catalogue qui n'a pas répondu ne prouve rien sur l'adresse qui
génère : éteindre le bouton sur cette base, c'est accueillir l'auteur par une erreur que rien
n'a mesurée. **La règle plus ancienne l'emporte**, et la distinction est désormais écrite dans
le produit : ce qui **manque** — une clé — grise et refuse ; ce qui est **injoignable** sert sa
photo datée et laisse générer. L'arbitrage entier, avec ce qu'il faudrait changer pour le
renverser, est dans `docs/tranches/V2.2.md` § F1.

**Et trois phrases du produit sont devenues fausses le même jour**, aux trois endroits où
elles vivaient : *« sans clé, le bouton qui paie reste éteint »*. Le plan l'avait annoncé —
c'est la seule des trois révisions de la V2.2 qui *se voit sans la chercher*. Le piège n'est
pas d'avoir écrit la phrase, c'est qu'elle était **justifiée par un commentaire honnête** :
« le fournisseur est le même pour tous, il ne distingue rien ». On lit ça, on trouve ça
prudent, on passe. C'est écrit dans `docs/PIEGES.md`.

**Ce qui reste ouvert, et qui appartient à F2** : un appel gratuit affiche encore `$0,0000`.
Rien n'est faux — zéro dollar est bien parti —, mais c'est le mensonge par omission que
l'écran des dépenses avait été construit pour arrêter, un cran plus bas. Ce que l'appel
consomme vraiment est connu et non enregistré : un jeton, annoncé dans les en-têtes.

## Le compactage des documents — 29 août 2026

**Le corpus de démarrage est passé de 315 à 139 Ko sans qu'une ligne soit supprimée.** Sept
passes, et ce qui est sorti est descendu en annexe avec un renvoi. Ce n'est pas une tranche :
rien du produit n'a changé, seuls les documents ont été redécoupés.

**Ce qui a été trouvé en mesurant, et qu'aucun de nous ne voyait.** `AGENTS.md` portait la
règle depuis le début — *« dès qu'une section pèse plus que le document qui la porte, elle
sort en annexe »* — et elle n'a jamais déclenché une seule fois. La raison est arithmétique :
**aucune section n'atteint jamais la moitié de son document**. La plus lourde du corpus
d'alors, « Où sont les choses » dans `AGENTS.md`, en faisait 71 % — un cas unique. Partout
ailleurs le document doublait par accumulation de sections moyennes, chacune parfaitement en
règle. Une règle qui ne peut pas se déclencher est une règle qu'on croit avoir.

**Et 36 renvois mentaient en silence.** Le code et les documents renvoient aux documents près
de six cents fois — un « § » qui nomme une section, un numéro qui nomme un chapitre, une
lettre et un chiffre qui nomment une tranche — et rien ne vérifiait qu'une section citée
existait encore. L'extraction du 28 août avait
emporté treize sections de `DESIGN.md` vers `design-motifs.md` ; les trente-trois renvois qui
les visaient étaient restés sur l'ancienne adresse, sans qu'aucun test ne s'en aperçoive.
C'est exactement la fragilité n°1 relevée chez SpriteCook, où la doc publique et le schéma du
serveur ne se recouvraient plus.

**Le banc est donc venu avant le découpage, et non après.** `essais/essai_docs.py` pèse le
corpus section par section — sous-sections comprises, sans quoi le poids d'un chapeau
déciderait à la place de ce qu'il porte — et résout chaque renvoi contre les titres réels du
document visé. Les 36 renvois cassés ont été réparés **avant** la première passe de découpage,
et c'est ce qui a rendu les six suivantes vérifiables : tout renvoi cassé apparu ensuite était
le fait du découpage, et de rien d'autre. Il y en a eu 41, tous repointés.

**Le banc s'est trouvé un trou à lui-même, à la sixième passe.** Il ne lisait que les renvois
écrits avec leur chemin complet ; un sur six s'écrit sans — `` `PLAN.md` `` tout court. Huit
renvois cassés par la quatrième passe étaient donc passés sous son nez pendant qu'il annonçait
tout vert. Il les lit depuis.

**Ce qui est sorti, et où :**

| Passe | Ce qui sort | Vers | Gain |
|---|---|---|---:|
| 1 | le détail des vingt tranches | `docs/tranches/` — un fichier par tranche, de `T1` à `R5` | 50 Ko |
| 2 | la carte fichier par fichier | `docs/carte-du-depot.md` | 33 Ko |
| 3 | les 173 user stories, le carnet des séances | `docs/user-stories.md`, `docs/prd-carnet.md` | 38 Ko |
| 4 | les dossiers de version, §6 à §10 | `docs/archi-versions.md` | 44 Ko |
| 5 | le relevé du fournisseur, §4 bis | `docs/archi-fournisseur.md` | 14 Ko |

L'ancienne archive du plan — un seul fichier pour les dix tranches finies — a été dissoute
dans les vingt : chaque tranche a désormais une adresse, au lieu d'un rang dans un long
document.

**Une décision de méthode, qui a rendu le reste possible : les numéros de section ne bougent
pas.** Soixante-dix renvois disent « §7 » ou « §6.2 ». Renuméroter `ARCHITECTURE.md` après en
avoir sorti cinq sections les aurait tous cassés d'un coup, pour un gain nul. Une section
déplacée **garde son numéro dans son nouveau fichier**, et c'est le fichier du renvoi qui
change. `docs/archi-versions.md` s'ouvre donc sur un §6.

**La règle a changé, et pas dans le sens attendu.** Le plan visait un plafond de 140 Ko, et
le corpus l'a tenu à 139. Le plafond n'a pas été gardé : *un seuil rond refuserait le jour où
l'on écrit une phrase de plus, ce qui n'est pas une faute, et se relèverait le jour où il
gêne, ce qui n'est pas un garde-fou.* Le banc mesure désormais la **dérive** — chaque relevé
comparé au précédent, et le plus haut connu écrit en dur pour que l'échelle ne se perde pas.
Ce qui le fait échouer est ailleurs, et c'est objectif : un renvoi cassé désigne une section
qui n'existe plus.

**Trois manques comblés en passant**, tous trouvés par le découpage et non cherchés : `C4` et
`C5` n'avaient pas de ligne d'état dans le plan ; `mcp/` était encore décrit comme « vide
jusqu'à T7 » ; et deux renvois visaient `AGENTS.md` pour ce qu'il n'a jamais porté — un piège
vit dans `PIEGES.md`, une dette reportée dans le fichier de sa tranche.

## C4 — 29 août 2026

**C4 est écrite : la main rattrape ce que la différence ne voit pas.** Le masque d'un calque
s'affine à main levée puis au pixel, le calque lui-même se retouche au pixel avec le corps en
repère dessous, l'avant et l'après se comparent en maintenant un contrôle, et une colonne de
pièce se trie par la mesure la plus défavorable. **Les sept critères sont cochés, tenus par
16 essais de serveur et 8 d'écran.**

**La décision qui n'était pas dans le cadrage : la retouche ne fait pas que retirer, elle
ramène.** Une seconde couche qui n'aurait su qu'effacer aurait laissé entier le défaut de la
séance du 29 août — *la différence trouve ce qui s'ajoute et manque ce qui se substitue* —,
puisque aucun réglage de masque ne fabrique une différence que la comparaison de couleur n'a
pas vue. La couche tranche donc **après** la mesure et dans les deux sens : elle ôte ce qui est
en trop, et elle ramène les pixels revenus là où la mesure n'a rien trouvé. C'est la seule
moitié de C4 qui répare quelque chose ; l'autre ne fait qu'affiner ce qui marchait déjà.

**Et ça se mesure sur la vraie image.** Le casque du 29 août, celui qui était revenu en semis de
pixels épars : **451 pixels opaques avant, 1 044 après un seul passage de la main**, et le casque
est lisible. L'avant, lui, rend toujours 451 — il se calcule, il ne se garde nulle part.

**Un vecteur, jamais une image.** Une couche enregistre le chemin parcouru et son rayon, pas le
masque qu'il produit. Un masque en octets aurait pesé la taille de l'image à chaque geste, et
surtout il aurait perdu ce qui fait une recette : se rejouer. Le prix est que la rasterisation
doit être déterministe — ce qui est un critère depuis T2, et ce qui a immédiatement coûté un
piège : *une ellipse de taille nulle ne peint aucun pixel*, donc le geste au pixel ne marquait
rien tant qu'il tenait en un seul point.

**Rayon zéro est le pixel.** « À main levée, puis au pixel » n'est pas deux outils : même liste
de points, même rasterisation, un nombre de différence. Deux chemins de code séparés auraient
fini par ne plus se rejoindre au rayon 1, et l'écran aurait dû apprendre lequel appeler.

**Ce que C4 a trouvé en s'en servant, et qui n'était pas de C4.** Ouvrir le panneau sur le
projet réel a rendu **500** : un calque dont le corps a changé de taille — parce que la cible de
pixel du projet a été relevée depuis — ne se rendait plus du tout. Le défaut est de C3 ; C4 l'a
**révélé** en ajoutant deux places à la recette, donc en faisant recalculer tous les calques
d'un coup. Ce qui l'avait rendu invisible est le cache : tant qu'une recette ne bouge pas, son
rendu est servi depuis le disque et personne ne recalcule rien. *Un cache cache aussi les pannes
du calcul qu'il remplace* (`docs/PIEGES.md`). Un corps qui a changé de taille est désormais
traité comme un corps disparu.

**Deux refus, et ils tiennent le motif.** Le tri par le pire n'est pas le défaut — le plan du
jeu reste l'ordre des rangées, parce que c'est celui de l'auteur et le seul dans lequel une case
*vide* se lit. Et « ce qui reste à regarder » ne s'écrit nulle part : c'est un calque sur lequel
la main n'est pas passée, et ça se lit dans sa recette, comme *ceci est un calque* depuis C3.

**Ce qui reste ouvert.** Le produit ne dit toujours pas **d'avance** qu'une pièce va se
substituer : aucune des cinq mesures ne l'annonce — celle du 29 août affichait une échelle à
1,00 et une silhouette à 100 %. Le risque a changé de gravité, pas de nature.

## C5 — 29 août 2026

**C5 est écrite : le personnage part dans le jeu, et l'agent a la boucle entière.** Ses poses
et ses calques se posent dans le dossier du jeu, à plat, avec un descriptif qui dit ce qu'est
chaque fichier — sa pose, sa pièce, la place de cette pièce sur le corps et son rang. Cinq
outils MCP complètent le plan sans que l'écran soit ouvert : lire ce qui manque, ajouter une
attitude, remplir, habiller, livrer. **Les huit critères sont cochés, tenus par 22 essais de
serveur et 4 d'écran.** Elle a été écrite pendant que C4 s'éprouvait encore : le plan la
disait recommandée mais non bloquante, et elle l'était.

**La décision qui n'était pas dans le cadrage : ce qui sort est ce que la matrice retient.**
Un corps par pose, un calque par pièce — le favori d'abord, sinon la plus récente. Sortir les
quatre variations d'une pose aurait rendu le tri à qui ouvre le dossier, alors que l'auteur y
a déjà répondu en marquant son favori, et « utilisable sans manipulation » dit exactement le
contraire de « choisis toi-même ». La règle n'a pas été écrite pour l'occasion : c'est
`corps_retenu`, celle qui compose déjà la planche d'équipement de C3. Un second barème aurait
fait sortir une autre image que celle que l'écran montre comme le corps de la pose.

**À plat, et c'est un refus.** Pas de sous-dossier par personnage, pas de convention de
moteur : « aucune structure inventée » ne s'arrête pas au code de jeu. Un dossier
`sprites/héros/` créé d'office est une décision de rangement prise pour un jeu dont l'atelier
ne sait rien. Ce qui remplace la structure est le descriptif, et c'est pour ça qu'il porte le
**rang de l'emplacement** : sans lui, un agent qui empile un casque et une cape doit inventer
lequel passe devant.

**Ce que la première sortie d'un vrai personnage a trouvé, et qu'aucun essai ne voyait.**
Balthazar est sorti en sept fichiers ; l'un d'eux, annoncé « calque », montrait un nain
entier. La pièce était le casque de `coeur de pierre - 01`, déclarée « agrandit » : ce qui
était revenu n'était pas un calque mais un **corps habillé** (US-148), et le descriptif le
donnait à empiler sur le corps. Ce qui l'avait rendu invisible est le montage des essais —
une pièce « contenue » qui revient à l'échelle produit toujours un vrai calque, donc le seul
cas qui distingue les deux n'était jamais joué là où le rôle s'écrit. Le rôle vient
maintenant de `Recette.calque`, la question que l'écran pose déjà pour afficher « ceci n'est
pas un calque », et il y en a trois : `corps`, `calque`, `corps_habille`.

**Ce que C5 a trouvé et qui n'était pas de C5 : deux endroits écrivaient le sujet d'une
case.** L'écran le composait depuis C1 — signalement du personnage et nom de l'attitude pour
une case, signalement seul pour un lot, description de la pièce pour une planche. L'agent arme
les mêmes cases ; laisser le MCP le recomposer aurait fait une seconde vérité, et laisser
l'agent le retaper aurait rompu la promesse d'US-115 au premier appel payé. La composition est
donc descendue dans `ServiceProduction.sujet`, l'écran la demande en armant, le MCP l'appelle
en générant. Le prix est un aller-retour de plus sur un geste local et gratuit — et un refus
n'empêche pas d'armer : la case est visée, le champ reste à écrire.

**Le MCP a perdu sa dernière logique.** `export_assets` rouvrait l'archive de T6 pour en
ressortir les fichiers un par un : la seule fonction du serveur qui *faisait* quelque chose,
donc la seule entorse à l'invariant de T7. Le geste vit dans le service, les deux sorties le
partagent, et l'essai qui lit les imports interdit maintenant `zipfile` en plus des quatre
autres. Un invariant se répare mieux le jour où l'on rouvre le fichier pour une autre raison.

**Ce qui reste ouvert.** Personne n'a encore sorti un personnage dans un vrai jeu : la règle
du dépôt — *une tranche n'est finie que lorsqu'on s'en est servi* — n'est pas encore tenue
pour C5. Deux points attendent cette séance-là : les gestes de finesse de C4 ne sont pas
exposés à l'agent (borner, affiner, retoucher demandent un œil, et on verra si l'agent les
réclame), et le vestiaire reste un geste d'auteur — l'agent s'en sert, il ne le peuple pas.

## R5 — 29 août 2026

**R5 est écrite : un calque se recale sans repayer.** Le geste part d'une image sortie d'une
planche d'équipement, relit la planche payée, et repose l'alignement, les cinq mesures et le
verdict sur les assets déjà nés — même identifiant, même rang, même place en bibliothèque.
**Les neuf critères sont cochés, tenus par 9 essais de serveur et 2 d'écran.**

**Le problème que les essais devaient poser, et comment.** Rejouer le même calcul rend le même
résultat : un essai qui déplierait puis rejouerait sans rien changer entre les deux ne
prouverait même pas que le rejeu a lu la planche. Deux montages le rendent visible — **abîmer
le brut du calque** puis rejouer, et il revient ; **changer la portée de la pièce** entre les
deux, et le verdict bascule pour la planche entière sans qu'un identifiant bouge.

**Une seule lecture de planche pour les deux chemins.** Le dépliage et le rejeu doivent tomber
sur exactement le même résultat, sans quoi recaler changerait l'image pour une raison qui n'est
pas le défaut qu'on répare. C'est la raison qui avait déjà sorti `decouper_retour` de `deplier`
en C3, appliquée un cran plus haut.

**Et ce que le rejeu a mesuré sur les six planches du 29 août.** **Cinq sur six bougent**, pas
quatre : aux deux calques manifestement faux et aux deux corps habillés prononcés sur une
échelle inventée s'ajoute un calque dont l'échelle était juste et dont le *placement* se
déplace — le critère monotone départageait aussi les décalages. La sixième, seule produite
après la correction, revient **identique**. Le rejeu est donc fidèle là où il n'y a rien à
réparer, et ne change que ce que le défaut avait changé. Vérifié sur une **copie** du dossier
de données : rien n'a été écrit dans celui de l'auteur.

## La première séance de C3 — 29 août 2026

**C3 a servi, sur un personnage qui portait déjà la pièce, et six planches ont été payées** —
un seul modèle, deux pièces, un casque et une hache, chacune envoyée aux deux occupations,
0,92 et 0,62. Dixième fois de suite que se servir d'une tranche trouve ce qu'aucun test ne
voyait.

**Le défaut : le recalage cherchait sur une note qui ne peut que monter.** Chaque échelle
candidate était notée à la part du corps qu'elle recouvre — une mesure juste, et monotone :
agrandir le revenu finit toujours par tout recouvrir, donc le critère demandait « quelle est la
plus grande échelle ? » et la bonne réponse ne gagnait que par l'égalité. Un aller-retour de
rééchantillonnage coûte deux pour mille de contour ; l'égalité tombait, et une planche revenue
intacte était déclarée revenue à 0,58×, le calque valant toute la silhouette au lieu du seul
casque. On cherche désormais sur le recouvrement rapporté à l'**union**, et on rend la
couverture au placement retenu. Les essais ne l'avaient pas vu parce qu'ils dessinent des blocs
pleins, qui traversent un rééchantillonnage sans perdre un pixel. `docs/PIEGES.md` le porte,
avec le corollaire : *une note qui ne peut que monter avec le paramètre qu'on optimise n'est pas
un critère, c'est un classement du paramètre.* La correction porte la suite de serveur de 343
à **345 essais** ce jour-là.

**La toile avec marge a été tirée, et elle n'a pas eu à servir.** L'échelle au retour est
restée dans la tolérance sur les six planches, à 0,92 comme à 0,62. Ce n'est pas l'hypothèse
validée — elle n'a pas été mise à l'épreuve, faute que le dézoom qu'elle prévient se présente.
Le seul risque de méthode de la V2 tombe donc, et un autre le remplace, mesuré celui-là : **la
différence trouve ce qui s'ajoute et manque ce qui se substitue.** Le casque est revenu en
poussière — même empreinte que la chevelure qu'il remplace, valeurs voisines, et la tolérance
au voisin de 3×3 qui protège du bruit de recalage l'efface avec lui. Et la hache dit les deux
moitiés du défaut à elle seule : son fer, qui dépasse de la silhouette, revient entier au pixel
près ; son manche, là où il croise le bras, ne revient pas. Encore deux décisions justes
séparément dont la composition perd quelque chose. Ce n'est ni cadré ni planifié :
`docs/releve-usage.md`.

**Et la décision de la séance : une planche déjà dépliée ne réaccouche jamais ; ce qu'elle a
calculé se rejoue.** Quatre images fausses restent sur le disque — deux calques figés sur un
mauvais recalage, deux corps habillés prononcés sur une échelle inventée — alors que les
planches qui les ont payées sont là. Redéplier aurait créé des rangs neufs, obligé à supprimer
les anciens, et laissé orphelins les calques qui désignent leur corps par identifiant : c'est un
piège, pas un geste. Ce qui se rejoue est le calcul, sur les assets déjà nés — même
identifiant, même rang, même place. Ce qui l'autorise tient en une phrase qui dépasse le
calque : **le brut d'un calque n'a jamais été l'image payée** ; l'image payée est la planche, et
un brut dérivé est un cache. C'est R5 dans `docs/PLAN.md`.

## C3 — 29 août 2026

**C3 est écrite : la pièce et le calque.** Un projet porte des emplacements ordonnés et des
pièces décrites une fois ; on coche les poses à habiller, l'atelier compose lui-même la
planche des corps existants, l'envoie en un appel, redécoupe le retour sur la grille qu'il a
posée et compare case par case. Chaque différence est un calque, propre à sa pose. **Les
seize critères sont cochés, tenus par 18 essais de serveur et 9 d'écran.**

**Le pliage de C2 a été réemployé sans être rouvert, et c'est ce qui rend la tranche
courte.** La grille, le gabarit, le découpeur, le compte et son refus arithmétique n'ont pas
bougé d'une ligne : `decouper_retour` a simplement été extraite de `deplier`, et les deux
usages l'appellent. Un booléen — `geometrie_connue` — distingue toujours les deux, et une
seule ligne du service de génération aiguille entre « ranger N corps » et « fabriquer N
calques ». La prédiction écrite en C2 s'est vérifiée telle quelle.

**La décision de la tranche : un calque est un asset, et c'est sa recette qui le dit.** Le
cadrage promettait « une recette, pas un fichier figé » ; la conséquence exacte est une
sixième place dans la recette, `différence`, qui nomme l'asset du corps et le masque
rectangle. Trois critères deviennent alors vrais *par construction* au lieu d'être tenus à la
main — le corps n'est jamais modifié, le masque se déplace sans un centime, et vider la zone
rend la différence brute. Il n'existe nulle part un drapeau « ceci est un calque » : un corps
habillé porte la même pièce et la même pose, et seule l'absence de différence l'en sépare.

**Deux pièges payés le même jour, et ils se ressemblent.** Le premier : la plage d'échelles
du recalage ne contenait pas 1,00 — 0,99 puis 1,01 —, donc une case revenue rigoureusement
identique se rééchantillonnait d'un centième et sa silhouette entière ressortait en *ajout*.
Le second : `recadrer_sur` alignait, puis `mesurer_calque` cherchait un **second** alignement
sur le résultat déjà aligné, et le calque affiché n'était plus celui qu'on venait de mesurer.
Les deux fonctions étaient justes ; c'est leur composition qui perdait quelque chose — très
exactement la famille de défaut que T9 avait trouvée en mettant une conception à juger. Tous
deux sont dans `docs/PIEGES.md`.

**Ce que la tranche n'a pas fait, et qu'il faut dire.** Elle n'a pas servi au navigateur, et
elle n'a tiré **aucun appel payant**. La toile avec marge — le seul risque de méthode qui
reste en V2 — est écrite, mesurable et repliable : la toile part à 0,62, l'échelle au retour
est mesurée case par case, et une dérive au-delà de 0,08 rend des corps habillés au lieu de
calques sans qu'aucune image ne soit perdue. Il reste à savoir laquelle des deux branches le
produit prendra, et ça coûte un appel.

*(Écrit à la livraison. La séance est venue le jour même — voir l'entrée en tête : l'appel a été
tiré six fois, la marge n'a pas eu à servir, et un défaut de recalage qu'aucun des vingt-sept
essais ne voyait a été trouvé.)*

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
sont dans `docs/archive/plan-versions-tenues.md` § C1 et `docs/archi-versions.md` §7 : un seul plan par projet, le
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
quittant la bande, seule surface qui le tenait ouvert. `docs/archive/plan-versions-tenues.md` § T10 dit pour chacun ce qui
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
pas, et un îlot vide n'existe pas faute de quoi l'écrire. `docs/archi-versions.md` §6.5
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
de `docs/archive/plan-versions-tenues.md` § T8 dit pour chacun ce qui l'avait rendu invisible.

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
**Aucun test de serveur ne pouvait les voir**, et les tableaux de `docs/archive/plan-versions-tenues.md` § T3, § T4,
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
