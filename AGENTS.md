# Asset Kitchen

Atelier personnel de production d'assets 2D pour jeu. On y définit **l'univers** d'un jeu
une fois, puis on fabrique au cas par cas les personnages, objets, décors et interfaces qui
lui appartiennent. **Tout ce qui est produit entre en bibliothèque de lui-même** ; juger,
c'est marquer favori ou supprimer, et ce qui est jugé l'est avant de partir dans le jeu, pas
avant d'entrer dans la bibliothèque. Un serveur MCP expose les mêmes gestes à un agent qui
code le jeu.

Ce fichier-ci ne dit que **comment travailler dans ce dépôt**. Ce qu'il faut construire vit
dans `docs/`, réparti selon la règle d'autorité ci-dessous.

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

**Ce qui vient après n'est plus la V1, et T8 comme T9 sont finies.** T8 : le tableau
d'inspiration a sa seconde vue — un plan qu'on déplace et qu'on zoome, des îlots nommés, une
réserve à droite. T9 : ce que T8 permet de ranger, T9 permet de le **dire** — un trait d'un objet à
un autre, une note posée à même la toile, et six teintes sourdes. **Les cent six critères
d'acceptation de T1 à T9 sont cochés dans `docs/PLAN.md`, et 185 tests de serveur plus 75 d'écran
les tiennent.** Le plan n'a plus de tranche ouverte.

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
dans § Pièges connus.

## Lancer

```
uv venv --python 3.11
uv pip install -e ".[dev]"
uv pip install -e ".[detourage]"   facultatif — le second moteur de détourage, ~180 Mo
                                   (le modèle `u2net` se télécharge au premier appel)
cd interface && npm install && npm run build

py -m atelier                        lance le serveur et ouvre le navigateur
py -m atelier --sans-navigateur --port 8421
pytest -q                            les critères d'acceptation, sans un centime
cd interface && npm test             les essais d'écran — flux et fetch doublés, sans serveur
py essais/essai_couverture.py        la couverture du fournisseur, gratuit
py essais/essai_pixel.py             brut contre traité, sur les images déjà là, gratuit
py essais/essai_export.py            l'archive rouverte, sur ce que l'atelier a — gratuit
                                     (demande un atelier lancé)
py essais/essai_premiere_image.py    UN APPEL PAYANT, ~$0,006
py essais/essai_univers_chaine.py    UN APPEL PAYANT, ~$0,023 — la chaîne de T4 de bout en bout
py essais/essai_decoupe_planche.py   UN APPEL PAYANT, ~$0,004 — une vraie planche, découpée
```

**Brancher un agent.** Le serveur MCP vit dans le même processus que l'API, sur `/mcp` :

```
claude mcp add --transport http atelier http://127.0.0.1:8420/mcp
```

L'atelier doit tourner — c'est le même processus. `localhost` marche aussi ; **rien d'autre**,
l'en-tête `Host` étant vérifié par le transport contre le réattachement DNS.

`interface/dist` est un produit de compilation, hors Git : **sans `npm run build`, le
serveur sert une page qui le dit** au lieu de l'atelier. En développement,
`cd interface && npm run dev` sert l'interface sur 5173 et relaie `/api` vers 8420.

`donnees/atelier.sqlite3` est un **index jetable**. Au premier démarrage qui suit une
évolution du schéma, il est effacé et refait en relisant `donnees/` : quelques dizaines de
millisecondes, rien à faire, et rien à sauvegarder. L'effacer soi-même est un geste sans
conséquence — c'est même un critère d'acceptation de T3.

L'API est documentée d'elle-même sur `/api/docs`.

## Les documents et leur autorité

**Une question, un document qui fait foi.** Aucun ne répète ce qu'un autre dit — il le
référence. C'est cette règle, et elle seule, qui évite la divergence entre documents : la
fragilité n°1 relevée chez SpriteCook, où la doc publique et le schéma du serveur ne se
recouvraient plus.

| La question | Le document qui tranche | Produit par |
|---|---|---|
| Que doit faire le produit, du point de vue de l'usage ? | `docs/PRD.md` | `/cadre` |
| Comment est-ce construit ? | `docs/ARCHITECTURE.md` | à la main, `/interroge` en amont |
| Dans quel ordre le construit-on ? | `docs/PLAN.md` | `/planifie` |
| À quoi ça ressemble ? | `docs/DESIGN.md` + `docs/design-preview.html` | `/design` |
| Comment travaille-t-on ici ? | `AGENTS.md` | à la main |

En cas de contradiction entre deux documents, **celui dont c'est la question l'emporte**, et
l'autre est corrigé dans la foulée — jamais laissé en l'état.

## Les skills et leurs frontières

Chaque skill possède **un livrable et un seul**. Un skill qui écrit hors de sa colonne
produit de la duplication, et la duplication devient contradiction.

| Skill | Écrit | S'arrête à |
|---|---|---|
| `/interroge` | **rien** | dialogue de cadrage. Ce qui en sort est reporté à la main dans le bon document. |
| `/cadre` | `docs/PRD.md` | l'usage. Ni techno nommée, ni chemin de fichier, ni code. Test : si l'utilisateur ne peut pas observer la différence, c'est hors PRD. |
| `/planifie` | `docs/PLAN.md` | l'ordre. Pas de noms de fichiers ni de fonctions — ils changeront. |
| `/design` | `docs/DESIGN.md`, `docs/design-preview.html` | l'apparence. Aucune décision de comportement produit. |
| `/investigue` | **rien** | réactif, sur un symptôme constaté. Quatre phases, chacune validée avant la suivante. |
| `/illustre` | un PNG/SVG dans `docs/` | un diagramme qui *argumente*. Jamais décoratif. |
| `/branche`, `/livre` | git | — |

**Les trois débordements à surveiller**, parce qu'ils se produiront :

1. **`/cadre` qui redemande ce qui est tranché.** Le skill explore le repo avant d'interroger :
   lui donner `docs/ARCHITECTURE.md` en entrée le fait aller droit aux trous — les user
   stories, les états vides, les erreurs.
2. **`/planifie` qui réinvente le découpage.** Les tranches T1→T7 existent déjà dans
   `ARCHITECTURE.md` §6.3. Son travail est de les accrocher aux user stories et de leur
   donner des critères d'acceptation, pas d'en inventer d'autres.
3. **`/design` qui décide du produit.** Il choisit la typo, la couleur, la densité, le
   mouvement. Il ne choisit pas ce que fait un écran — ça, c'est le PRD.

**Après chaque skill, élaguer.** Ce qui migre vers `PRD.md` ou `PLAN.md` sort
d'`ARCHITECTURE.md` et y devient une simple référence. Le document rétrécit à mesure que la
chaîne avance : c'est le signe que ça marche.

## Où sont les choses

| | |
|---|---|
| `atelier/` | le paquet Python — `domaine/` les objets et les règles, `fournisseur/` le port et l'adaptateur OpenRouter, `services/` les gestes, `api/` les routes, `depot/` SQLite et fichiers, `image/` le traitement, `mcp/` vide jusqu'à T7 |
| `atelier/services/evenements.py` | la diffusion — ce que l'atelier annonce, à qui écoute. C'est elle qui remplace le sondage : un service qui change d'état le dit, personne ne redemande |
| `atelier/domaine/recette.py` | les cinq places d'une recette, **dans un ordre fixe** — détourage, recadrage, grille, quantification, bords. Et l'empreinte, qui nomme un rendu et rend deux recettes égales interchangeables |
| `atelier/image/traitement.py` | le pipeline : CPU, pur, aucune entrée-sortie. `detourer` et `finir` sont séparés parce que le premier coûte 130 ms et le second 28 — c'est ce qui rend la retouche instantanée |
| `atelier/services/assets.py` | poser une recette, revenir au brut, nommer une recette — et **le seul endroit du dépôt qui écrive un asset** (`sauver`). **Aucun `fournisseur` dans ce fichier**, et ça se lit dans les imports : T2 n'appelle jamais l'extérieur |
| `atelier/services/bibliotheque.py` | ranger, retrouver, juger, jeter, reconstruire. Pas de `fournisseur` non plus : tout T3 marche réseau coupé. C'est ici que vivent l'annulation courte, le refus de supprimer le dernier projet, l'adoption de ce qui existait avant les projets — et **le seul endroit qui écrive un projet** (`sauver_projet`), par où l'univers passe |
| `atelier/services/univers.py` | le tableau et l'univers — coller, promouvoir, extraire la palette, réaligner. **Le seul service qui sorte sans être une génération**, et par une seule méthode : `recuperer`, l'adresse collée. Tout le reste marche réseau coupé |
| `atelier/domaine/lien.py` | **le seul objet neuf du modèle depuis T4** — un trait entre deux objets de la toile. Il naît muet, et une extrémité est un couple `(genre, valeur)` parce qu'une carte et un îlot ne se nomment pas dans le même espace. `depuis_json` rend **rien** plutôt que de lever : un lien illisible est un lien sans extrémité, donc un lien qui doit disparaître, et c'est déjà la règle |
| `atelier/domaine/teinte.py` | la liste close des six teintes, et rien de ce qu'elles valent — **aucun hexadécimal ici** : le produit range un *nom*, l'écran seul sait ce qu'il vaut par son token. Un module à part parce que la carte et le projet s'en servent tous les deux et qu'aucun ne la possède |
| `atelier/domaine/carte.py` | la deuxième famille d'images du produit. Elle ne s'exporte jamais, ne compte pas dans la bibliothèque, n'a ni recette ni rendu. Elle appartient à son projet, et part avec lui |
| `atelier/domaine/projet.py` (§ Univers) | la bible en cinq champs nommés, le barème d'échelles — une nature de sujet porte **sa famille et son occupation à la fois** —, la cible de pixel, les modèles par famille, et `recette_de()`, **le seul endroit qui dise ce qu'un projet impose** |
| `atelier/image/palette.py` | d'où vient la palette d'un univers. CPU, pure, aucune entrée-sortie. Détoure d'abord — sans quoi le fond plat écrit la palette à lui seul |
| `atelier/image/decoupe.py` | **où** couper une planche. CPU, pure : elle reçoit un alpha ou des dimensions, elle rend des rectangles. Ce qu'on en fait appartient au service |
| `atelier/services/decoupe.py` | découper. **Deux gestes séparés exprès** — `proposer` ne crée rien, `decouper` coupe ce qu'on lui donne. C'est cette séparation, et rien d'autre, qui tient « sans jamais bloquer ». Aucun `fournisseur` : une planche déjà là se découpe réseau coupé |
| `atelier/mcp/serveur.py` | les onze outils de l'agent. **Une façade, et rien d'autre** : chaque fonction traduit, appelle un service, retraduit. Le jour où l'une d'elles calcule quelque chose, c'est que le geste manquait aux services. Ça se lit dans les imports — ni `fournisseur`, ni `depot`, ni `sqlite3` —, et un essai le vérifie. Les noms d'outils sont en anglais ; les **raisons de refus** restent en français, parce qu'un agent les répète à l'auteur |
| `atelier/services/agent.py` | le **cadre** de l'agent, pas un geste de plus : le plafond de la séance, le modèle d'exploration imposé, et le dépôt d'un fichier dans le dossier du jeu. Les garde-fous se relisent **à chaque appel** — même règle que la clé —, et la consommation se *lit* sur les générations plutôt que se tenir en double. Aucun `fournisseur` : autoriser une dépense ne demande pas de sortir |
| `atelier/services/export.py` | sortir de l'atelier. **Le seul service qui ne reçoive pas la diffusion** : un export ne change aucun état — rien n'est rangé, rien n'est jugé, rien n'est créé —, donc il n'a rien à annoncer, et ça se lit dans la ligne qui le compose. Aucun `fournisseur` non plus : l'archive se fabrique réseau coupé |
| `atelier/fournisseur/toile.py` | aller chercher une image à une adresse collée. Le second sortant du dépôt, et il traduit toute panne de transport en une phrase du produit |
| `atelier/api/univers.py` | les routes de T4 — le tableau et l'univers. Un troisième routeur parce qu'il répond à une troisième question : ce qui contraint une image **avant** qu'elle existe |
| `atelier/domaine/projet.py` | deux niveaux de rangement, et pas un de plus. `repere()` fait du nom un dossier lisible — `projets/bac-a-sable/` — pour que `donnees/` s'ouvre aussi à la main |
| `atelier/api/bibliotheque.py` | les routes de T3, montées sous le même préfixe que les autres. Un module à part parce qu'elles répondent à une autre question : `routes.py` dit comment on fabrique une image, celles-ci où elle se range |
| `interface/` | React + Vite + Tailwind. `src/index.css` porte **tous** les tokens de `docs/DESIGN.md` — aucune couleur, aucun rayon, aucune durée n'est écrit ailleurs. **Trois dépendances d'exécution depuis T8** : `react`, `react-dom` et `@xyflow/react`, la seule que l'interface ait gagnée depuis l'origine. Elle tient la surface — le plan, le nœud, le glissement —, le produit tient la matière ; `docs/ARCHITECTURE.md` §6.5 fait la part exacte, et le rester est une décision renouvelée, pas un état de fait |
| `tests/conftest.py` | le double de fournisseur et les trois montages partagés. Il rend de vraies images, de vrais coûts, de vraies dimensions — **aucun test ne coûte un centime** |
| `tests/test_t1_jalon1.py` | les critères de T1 tenus par les jalons 1 et 2 — clé, catalogue, image téléchargeable, variations concurrentes, emplacements indépendants |
| `tests/test_t1_jalon3_4.py` | ceux des jalons 3 et 4 — flux d'événements, jauge déterminée, onglet rouvert, repli hors ligne |
| `interface/src/App.test.tsx` | les essais d'écran — le seul endroit du dépôt où l'interface est **montée et pilotée**. `fetch` et `EventSource` y sont doublés, comme `tests/conftest.py` double le fournisseur. Ils existent parce qu'un défaut a traversé T1 et T2 sans que rien ne le voie : ce que le serveur tient, l'écran ne le tient pas. Cinq des seize critères de T3 n'existent que là |
| `interface/src/composants/Arbre.tsx` | la colonne de 240 px : projets, collections, total, et le journal des ratés sous l'arbre |
| `interface/src/composants/BarreOutils.tsx` | les 38 px au-dessus de la grille — chercher, filtrer, agir sur une sélection, et la fente de l'annulation |
| `interface/src/composants/Decoupe.tsx` | l'écran Découpe — `1fr · 380px`, la planche à gauche, ce qui sortira à droite. Le sujet est l'image, donc c'est elle qui prend la largeur. Il porte sa propre fente de refus, comme l'écran Univers. **Le cadre est mis à l'échelle par calcul** : `aspect-ratio` cède devant `max-height`, et un cadre qui ment décale les rectangles de l'image |
| `interface/src/composants/Univers.tsx` | l'écran Univers — `380px · 1fr`, l'univers à gauche, le tableau à droite. Il couvre l'atelier, donc **il porte sa propre fente de refus** : une raison envoyée derrière lui serait invisible au moment où elle compte |
| `interface/src/composants/Tableau.tsx` | le tableau d'inspiration. Le collage y est le geste principal, et il devine : des octets font une carte image, une adresse une carte en attente, le reste une note. Depuis T8 il porte **une seule grille pour les deux vues** — la réserve n'est pas une grille de plus, c'est celle-ci filtrée sur ce qui n'a encore ni groupe ni place —, et la carte y est un seul composant posé de deux façons |
| `interface/src/composants/Toile.tsx` | la seconde vue du tableau. **Trois fonctions pures en tiennent toute la géométrie** — où une carte se pose, jusqu'où un îlot s'étend, lequel attrape une carte lâchée — et c'est ce qui les rend vérifiables : `Toile.test.tsx` les éprouve sans monter d'écran, là où jsdom ne pourrait rien mesurer. Chaque nœud porte ses **dimensions données** : la librairie cache ce qu'elle n'a pas mesuré, et elle mesure par un `ResizeObserver` |
| `interface/src/aide.ts` | **le corpus des explications — un seul texte, deux rendus.** 55 entrées, cinq écrans. Chacune tient trois champs obligatoires : *ce que c'est · ce que ça change · d'où ça sort*, et la deuxième porte tout le poids — « Rien à la génération. » est une réponse, c'est même la plus utile. Il ne porte **jamais une raison** : ce qui refuse un geste vit dans une fente permanente, et ne se survole pas |
| `interface/src/composants/Infobulle.tsx` | le survol qui révèle et le clic qui épingle. Le **libellé est la cible** — aucun glyphe neuf : le nom du réglage devient sa propre poignée, souligné d'un pointillé `--bord-fort`. Rendre un libellé sans clé n'est pas une erreur : rien ne se marque, et c'est le cas d'un réglage que le corpus ne documente pas |
| `interface/src/composants/EcranReglages.tsx` | les trois questions promises depuis T1, au même endroit (US-96) : la clé, les garde-fous de l'agent, le dossier du jeu. Un panneau posé sur l'atelier et non un quatrième écran plein — il ne couvre pas le travail, il le règle. Le compteur de l'agent y est **à côté du réglage qu'il fait relever** : lu ailleurs, il faudrait revenir |
| `interface/src/composants/Guide.tsx` | l'écran Guide, la seule prose du produit. Il **ne porte pas de fente de refus**, et c'est la preuve qu'on a compris la règle : il ne demande rien au serveur, ne dépense rien, ne peut pas échouer. Sa troisième partie est le corpus rendu à la file, groupé **par écran** — pas par thème : quand on cherche une explication, on se souvient d'où l'on était |
| `tests/test_t3.py` | les critères de T3 — le Bac à sable, le journal des ratés, la grille unique, la suppression sans cascade, l'annulation, la reconstruction depuis les fichiers, les quatre rôles de réinjection, et le hors ligne. Deux tests **prouvent** le hors ligne en comptant les appels du double avant et après |
| `tests/test_t4.py` | les critères de T4 — la palette extraite de **vraies** planches (`essais/guide/`), la famille qui décide des références, le compte dédoublonné, la palette rétroactive et ses deux comptes, le barème, et le hors ligne. Trois tests **comptent les appels du double** : le tableau et la palette ne demandent jamais le fournisseur |
| `tests/test_t5.py` | les critères de T5 — la planche de huit, la filiation dans les deux sens, les trois issues d'une détection ratée, la suppression sans cascade, la reconstruction, et le hors ligne prouvé en comptant les appels du double. Plus le symétrique du moteur absent : **le moteur par modèle exécuté pour de vrai** quand il est là |
| `tests/test_t6.py` | les critères de T6 — l'archive et son descriptif, les homonymes numérotés, le rendu et non le brut, le JPEG converti, le refus d'une sélection vide, l'image seule qui se télécharge encore, et le hors ligne prouvé en comptant les appels du double. Ils **ouvrent** l'archive au lieu de la mesurer : `zipfile` la relit, `json` relit le descriptif, Pillow rouvre chaque PNG et confronte ses dimensions à celles annoncées. L'export est le seul geste dont personne ne voit le résultat avant de l'ouvrir ailleurs, une semaine plus tard |
| `tests/test_t9.py` | les critères de T9 — le lien muet à la naissance, la toile lue en un aller-retour, la paire déjà jointe refusée en le disant, le lien qui meurt avec son extrémité **et sur le disque**, la note née posée et classée, le texte corrigé en place, les six teintes seules, et le hors ligne prouvé en comptant les appels du double. Trois des neuf critères n'y sont pas : deux sont de la géométrie ou de la couleur, le troisième est une pile qui n'existe que dans l'onglet |
| `tests/test_t8.py` | les critères de T8 — la place et la largeur libre écrites par la route du groupe, le vide qui efface là où l'absence ne touche pas, la toile relue du disque après l'index effacé, la largeur libre qui ne touche jamais au cran de vignette et réciproquement, et le hors ligne prouvé en comptant les appels du double. Six des treize critères n'y sont pas : ils portent sur ce que l'écran montre ou sur une géométrie que le serveur ne connaît pas |
| `interface/src/composants/Toile.test.tsx` | la géométrie de la toile, **sans monter d'écran**. Il existe parce que jsdom ne met rien en page : un essai qui tirerait une carte à travers le plan classerait toujours dans le même îlot, celui de la boîte vide qui contient l'origine. Les fonctions sont pures pour cette raison-là |
| `tests/test_t7.py` | les critères de T7 — les outils appelés **par le serveur**, `call_tool` comme un vrai client, parce qu'appeler les fonctions Python sauterait la validation de schéma et ne prouverait rien du contrat. Plus la vraie poignée de main MCP sur les deux écritures de l'adresse, et deux tests qui **comptent les appels du double** : importer, retoucher, découper et exporter ne demandent jamais le fournisseur |
| `tests/test_t2.py` | les critères de T2 — grille cible, même bloc de pixel, brut conservé, rendu recalculable, recette nommée, quantification grisée, passes de détourage. Plusieurs **comptent les appels du double** avant et après une retouche : c'est ainsi que « le post-traitement n'appelle jamais le fournisseur » se prouve |
| `essais/essai_couverture.py` | la couverture image du fournisseur, et sa dérive depuis le relevé précédent. Gratuit |
| `essais/essai_detourage_modele.py` | les deux moteurs de détourage, l'un contre l'autre. Gratuit. Sortie : `essais/mesures_detourage.json` et `essais/planches/detourage_moteurs.png`. Le cas « fond chargé » y est **composé**, et le banc le dit : aucune des 188 images du dépôt n'a de fond qui résiste au remplissage depuis le bord |
| `essais/essai_pixel.py` | le banc du post-traitement — brut contre traité, sur les 44 images des bancs déjà sur le disque. Gratuit. Sortie : `essais/mesures_pixel.json` et `essais/planches/pixel_64.png` |
| `essais/essai_export.py` | l'archive de T6, **ouverte** — sur ce que l'atelier contient vraiment, pas sur des images fabriquées. Gratuit, mais il demande un atelier lancé : il passe par la route. Chaque fiche du descriptif est confrontée à son fichier, dimensions remesurées par Pillow. Sortie : `essais/mesures_export.json` |
| `essais/essai_premiere_image.py` | la première image, de bout en bout par l'API. **Payant**, ne part qu'à la main |
| `essais/essai_univers_chaine.py` | la chaîne de T4 : bible repliée, artworks choisis par famille, asset né habillé, barème mesuré. **Payant**, un seul appel — le barème se vérifie en appliquant six échelles à la même image reçue. Travaille dans son propre `donnees/`, et ne range dans celui de l'atelier que sur `--ranger` |
| `essais/essai_decoupe_planche.py` | la chaîne de T5 : une planche **demandée exprès** à un modèle, puis détectée, découpée, filiée. **Payant**, un seul appel — tout le reste est gratuit, et c'est ce que la tranche promet. Même règle de `donnees/` séparé et de `--ranger`. C'est le seul essai qui vérifie ce qu'aucune image fabriquée ne peut vérifier : une planche **que personne n'a disposée pour la détection** |
| `donnees/` | l'index SQLite (**jetable**), `agent.json` le cadre de l'agent — un fichier à part de l'état parce qu'il se relit à chaque appel du MCP —, `atelier.json` le projet courant, la photo du catalogue, les recettes nommées, `collections.json`, `projets/<repère>/projet.json` — l'univers —, `projets/<repère>/tableau/<carte>.json` et ses octets à côté, et par génération : `generation.json`, `<rang>-brut.<ext>` l'image telle qu'elle est arrivée, `<rang>-asset.json` la recette, le rangement et les mesures, `<rang>-rendu.png` **un cache, effaçable sans rien perdre**. Les découpes de T5 y tiennent les rangs 100 et suivants, dans le dossier de la génération de leur planche. Hors Git. **Les cartes n'entrent jamais dans l'index** — elles n'ont aucune question à lui poser, et effacer `atelier.sqlite3` ne peut donc pas les perdre |
| `docs/ARCHITECTURE.md` | décisions techniques, squelette, fournisseur et modèles, modèle d'objets, contrat de génération, MCP, V1→V5, risques |
| `docs/PRD.md` | ce que le produit doit faire, à l'usage — 97 user stories, états vides, erreurs, cas limites |
| `docs/PLAN.md` | l'ordre de construction — les sept tranches, leurs user stories, leurs dépendances et leurs critères d'acceptation |
| `docs/DESIGN.md` + `docs/design-preview.html` | l'apparence — typographie, palette, densité, mouvement, et le spécimen qui les montre |
| `docs/maquette-atelier.html` | **brouillon écarté** — jugé trop chargé et trop loin de la fluidité recherchée. Reste sur disque, ne sert pas de base. L'interface part du geste quotidien : écrire, générer, juger, garder. |
| `essais/essai_identite.py` | banc de modèles — quatre appels enchaînés, deux jets, parallèle |
| `essais/resultats/jet<N>/<config>/` | images produites + `mesures.json` (coût et durée réels) |
| `essais/planches/` | planches contact assemblées, pour comparer d'un coup d'œil |
| `essais/catalogue.json`, `prix.json` | relevé OpenRouter du 26 août 2026 |
| `screen_spritecook/` | 30 captures de SpriteCook — la référence d'ergonomie, écran par écran |
| `Anatomie de SpriteCook.html` | l'analyse fonctionnelle qui a servi de point de départ |

## Les projets voisins — les lire avant de réinventer

Deux tentatives précédentes vivent à côté. Elles ne sont pas des impasses : elles portent du
savoir payé au prix fort.

- **`../MySpriteAi`** — pipeline pixel complet en TypeScript, détourage BiRefNet, module SFX,
  gestionnaire de VRAM. `src/lib/pixelPipeline.ts` est à porter en Python : les décisions
  dedans ont été acquises par la douleur (durcir l'alpha à 128 **avant** la réduction, sinon
  liseré clair autour du sprite). Son `AGENTS.md` est un inventaire de pièges vérifiés.
- **`../game-asset-generator`** (GAG) — architecture hexagonale Python, 29 décisions.
  `gag/domaine/direction.py` et `gag/ports/vision.py` portent la dérivation de direction
  artistique : c'est le cœur de l'univers d'Asset Kitchen, déjà écrit.

**GAG n'est pas l'ancêtre d'Asset Kitchen, c'est son opposé** : GAG fabrique de la quantité
en lot avec des modèles locaux, Asset Kitchen fabrique peu et bien, à la main, par API. Les
deux vivent côte à côte.

## Règles durables

Écrites ici une fois pour toutes. Elles n'ont jamais à être répétées dans un prompt.

- **Français partout, sauf ce qu'un tiers lit.** Les noms d'outils MCP sont en anglais (ils
  sont lus par des modèles entraînés en anglais ; `generer_asset` dégraderait le
  déclenchement) et les chemins de routes HTTP par convention. Domaine, services, traitement
  d'image, colonnes SQL, interface : en français.
- **Le catalogue décide, jamais une liste en dur.** `GET /api/v1/images/models` donne les
  plafonds de références, les résolutions et les paramètres de chaque modèle. Un modèle qui
  ne peut pas honorer la demande est **grisé avec sa raison**, jamais proposé puis rejeté en 400.
- **Le traitement est non destructif.** On garde l'image brute et la recette. Le rendu est un
  cache effaçable. Recalculer coûte des millisecondes ; regénérer coûte de l'argent et ne rend
  jamais la même image.
- **Le post-traitement ne touche jamais le GPU, et n'appelle jamais le fournisseur.** CPU,
  pur, étapes dans un ordre fixe : détourage, recadrage, grille, quantification, bords.
  Aucune ne se réordonne — trois des cinq n'ont pas de sens avant celle qui les précède.
- **Chaque étape est déterministe, et c'est un critère.** « Une recette nommée, réappliquée
  ailleurs, donne exactement le même résultat » : une initialisation tirée au sort — le
  k-means++ de MySpriteAi, par exemple — rendrait deux images différentes pour la même
  recette. La coupe médiane de Pillow ne tire rien au sort ; c'est elle qui quantifie.
- **Pas de ComfyUI dans l'application.** Le local reste dehors : on génère ailleurs, on importe.
- **Aucune clé en dur.** `.env` seul, jamais versionné ; `.env.example` documente les noms.

## Pièges connus

- **`.env` en UTF-16.** PowerShell écrit en UTF-16 avec `>` et `Out-File`. Le lire comme de
  l'UTF-8 lève sur le tout premier octet. `lire_cle()` essaie plusieurs encodages — toute
  autre lecture de fichier écrit au terminal Windows doit faire pareil.
- **Toujours reconfigurer `sys.stdout` en UTF-8 dans un script à sortie longue.** Dès que la
  sortie est redirigée, Windows encode en cp1252 : un simple `──` lève un
  `UnicodeEncodeError`. Levée depuis un thread d'un `ThreadPoolExecutor`, elle remonte par
  `pool.map` et **tue tout le lot**. Constaté le 26 août : le jet 2 du banc s'est arrêté à 4
  configurations sur 12, après avoir payé les appels. Trois lignes en tête de `main()`
  l'évitent — jamais « on verra si ça pose problème ».
- **Un lot payant doit écrire ses résultats au fur et à mesure, jamais à la fin.** C'est ce
  qui a sauvé les 4 configurations déjà faites au moment du plantage ci-dessus : les PNG et
  le `mesures.json` étaient déjà sur le disque, et la reprise n'a rien repayé.
- **Ne jamais générer petit.** 512 px coûte $0,045 contre $0,067 en 1K chez Nano Banana 2 —
  un tiers de moins pour beaucoup moins de qualité. On génère en 1K et on réduit après.
- **Imposer `aspect_ratio`.** Sans lui, Gemini part en 16:9 et Seedream en 1:1. Deux essais ne
  sont plus comparables, et un sprite n'est plus cadrable.
- **Écrire « one single sprite, one pose only ».** Sans quoi Gemini rend spontanément une
  planche de trois poses — il calque la mise en page de son image de référence.
- **L'échelle du sujet dérive d'une génération à l'autre**, malgré tous les « same size » du
  prompt. Le recadrage et la normalisation d'échelle ne sont pas du confort : sans eux, deux
  frames ne se montent pas.
- **Aucun modèle ne déclare de prompt négatif.** Relevé sur les 48 modèles image du
  catalogue : zéro `negative_prompt`. Le champ existe dans le produit (US-6) ; c'est
  l'adaptateur qui le replie en fin de prompt (`Do not include: …`). Ne jamais l'envoyer
  comme un paramètre : il serait ignoré en silence, comme `output_format` chez Seedream.
- **Le catalogue bouge d'un jour à l'autre.** 47 modèles le 26 août, 48 le 27 —
  `meta/muse-image` est apparu entre les deux. C'est précisément ce qu'une liste écrite en
  dur ne verrait pas.
- **Le coût d'un appel dépend du nombre de références, chez ceux qui facturent au token.**
  Mesuré sur `gpt-image-2` en `quality: low` : $0,0064 sans référence, $0,0124 avec une,
  $0,0245 avec deux. Un univers riche renchérit chaque appel — à surveiller dès T4.
- **Un seul échantillon ne mesure rien.** Un modèle génératif n'est pas déterministe : tout
  banc se fait en deux jets au minimum, et l'écart entre eux compte autant que la moyenne.
- **Un générateur asynchrone ne se referme pas pendant qu'il attend.** Un abonnement écrit
  en `async def … yield` lève `aclose(): asynchronous generator is already running` dès que
  l'appelant le referme alors que l'attente en cours n'est pas finie — et un flux
  d'événements est *toujours* en attente. Constaté le 27 août sur `GET /api/events`. Un
  abonné reçoit donc une **file** (`asyncio.Queue`) : l'appelant décide comment il attend,
  et annuler cette attente n'abîme rien.
- **`TestClient` et `httpx.ASGITransport` attendent la fin de la réponse.** Ils ne
  conviennent pas à un flux qui n'en a pas : le test se fige jusqu'au délai du lot entier.
  On appelle l'application ASGI directement, on lit les premiers messages, et on envoie
  `http.disconnect` — ce qui vérifie du même coup que le serveur s'en remet.
- **Durcir l'alpha AVANT la réduction, jamais après.** Repris de
  `MySpriteAi/src/lib/pixelPipeline.ts`, où ça a été payé cher. Un contour à demi transparent
  est tranché à pile ou face par un rééchantillonnage au plus proche voisin : deux passes de
  suite rendent deux silhouettes différentes. Et la quantification force l'alpha à 255 sans
  toucher à la couleur, donc un pixel de contour à peine visible ressort **opaque, de la
  couleur du fond** — le liseré clair autour du sprite. Les deux moitiés du même piège.
- **Un détourage au seuil global perce le sujet ; un remplissage depuis le bord ne le perce
  pas.** La différence tient en un mot : *relié*. Un pixel de la couleur du fond qui n'est
  relié à aucun bord — l'os d'un squelette, le reflet d'une fiole — n'est pas du fond.
  Corollaire assumé : **une région fermée reste opaque**. L'intérieur d'un cadre d'interface
  survit au détourage, et c'est la même règle qui sauve le squelette. Le rendre transparent
  est un geste de l'auteur, jamais une décision de l'outil.
- **Une mesure de périodicité par « meilleure phase » ment à grand pas.** Écrite pour mesurer
  la grille rendue, elle a répondu 40 à 64 px sur tout le corpus — c'est-à-dire le haut de sa
  propre plage de recherche, ce qui aurait dû alerter tout de suite. La cause : à grand pas, la
  phase retenue porte peu d'échantillons, donc son maximum est mécaniquement flatté.
  L'autocorrélation, elle, tombe juste sur les sujets fins — mais **prend une harmonique sur
  les plus grossiers**. Elle situe un ordre de grandeur, elle ne remplace pas l'œil : aucun
  chiffre de dérive publié ne doit venir d'elle seule.
- **Deux chemins amènent le même objet à l'écran, et ils se croisent.** La réponse du
  `POST` et l'annonce du flux portent la même génération ; le serveur publie **avant** que
  le POST ne soit revenu. Insérer sans regarder d'un côté et fondre de l'autre a doublé
  chaque génération lancée depuis l'onglet — et une clé React doublée laisse des tuiles
  orphelines qu'aucun rendu ne retire ensuite. Le défaut ne survivait à aucun
  rechargement, puisque le message d'état remplace la liste par celle du serveur : il a
  donc traversé T1 et T2 sans se voir. **Tout ce qui arrive par deux chemins se fond par
  identifiant, jamais ne s'empile.** Constaté le 27 août 2026, à la première séance faite
  au navigateur.
- **Un test qui ne rejoue pas l'ordre du serveur ne prouve rien.** Le double du flux dans
  `interface/src/App.test.tsx` publie **avant** que le POST ne réponde, parce que c'est ce
  que fait le vrai serveur — il enregistre, il annonce, puis il rend la main. Avec l'ordre
  inverse, le même test passe sur le code fautif. Vérifié en réintroduisant le défaut : le
  test tombe sur « 4 tuiles au lieu de 2 ».
- **Le message d'erreur d'`httpx` est en anglais, et il finit à l'écran.** « All connection
  attempts failed » est ressorti tel quel dans la barre d'état. Toute erreur de
  transport se traduit en une phrase du produit avant de quitter `fournisseur/` ; un message
  de bibliothèque ne franchit jamais le port.

- **`with sqlite3.connect(...)` ne ferme pas la connexion**, il ne fait que valider la
  transaction. Rendre la connexion telle quelle laissait un descripteur ouvert par
  requête — et sous Windows un fichier encore ouvert **ne se supprime pas**. C'est
  exactement le geste que T3 doit permettre : effacer `atelier.sqlite3` pour voir la
  bibliothèque se reconstruire. Une connexion s'ouvre et se referme, toujours.
- **Une colonne qui double l'objet doit être réécrite depuis lui, sans exception.**
  `cree_le` manquait à la liste des colonnes mises à jour : la date changeait dans
  `contenu` et pas dans la colonne, donc l'objet disait une chose et l'ordre de la
  grille en disait une autre. Le fichier interdit les « deux vérités » dans sa première
  phrase, et c'est une colonne oubliée qui les a créées.
- **Un état dérivable ne se garde pas en double.** La fiche ouverte et la sélection
  étaient deux états pour la même chose : deux clics dans le même rendu lisaient la même
  sélection périmée, et le second effaçait le premier au lieu de s'y ajouter. La fiche
  **est** la sélection quand elle vaut un. Corollaire, dans React : toute mise à jour qui
  lit l'état précédent passe par la forme fonctionnelle, jamais par la valeur du rendu.
- **Un abonnement au flux ne doit dépendre de rien.** Mettre le filtre ou le projet ouvert
  dans les dépendances de l'effet ferme la liaison et en rouvre une à chaque changement —
  donc à chaque frappe dans le champ de recherche —, et le serveur renvoie l'état complet à
  chaque fois. Ce qui bouge vit dans un `ref` que les gestionnaires consultent.
- **Un événement qui porte un objet ne dit pas qu'il est encore d'ici.** Supprimer un
  projet détache ses assets, chaque détachement est annoncé, et les détachés venaient
  s'installer dans la grille du projet **ouvert**, qui n'est pas le leur. Ce qui se fond
  dans une liste filtrée doit être confronté au filtre — sauf à la recherche, qui vit sur
  le serveur et qu'on ne rejoue jamais à l'écran.
- **Un appel qui échoue peut avoir coûté.** L'adaptateur levait avant de lire `usage.cost`
  quand la réponse ne portait aucune image : le montant disparaissait du journal du projet,
  c'est-à-dire exactement celui qu'on cherche à expliquer. Le coût se lit **avant** tout ce
  qui peut lever.
- **Un champ ajouté à un objet ne se rétro-remplit pas tout seul.** Les assets écrits avant
  T3 n'ont ni coût ni date de lot : relire le disque sans aller les chercher dans la
  génération affichait `$0,0000` sur des images payées, et cassait l'ordre de la grille.
  `rattraper()` est l'endroit de ces réparations — il passe déjà à chaque démarrage.
- **« Sans projet » doit vouloir dire *détaché*, jamais *antérieur au rangement*.** À
  l'apparition du tout premier projet, ce qui n'en avait pas y entre : sinon l'atelier
  s'ouvre sur une grille vide alors qu'il a déjà six images.
- **Le type d'une image de référence se lit sur ses octets.** L'adaptateur annonçait
  `data:image/png` en dur : réinjecter une image d'un modèle qui ne rend que du JPEG
  l'aurait envoyée sous une fausse étiquette, et le refus serait venu du fournisseur après
  avoir traversé tout le produit.
- **Un fichier qui fait foi s'écrit entièrement ou pas du tout.** `write_text` sur le nom
  définitif laisse un JSON tronqué si le processus s'arrête au milieu — et un
  `generation.json` tronqué est le seul cas où « la bibliothèque se reconstruit sans perdre
  un asset » tombe pour de bon. On écrit à côté, puis on renomme.
- **Les polices de l'interface viennent du réseau.** `interface/index.html` charge
  Instrument Serif, Instrument Sans et JetBrains Mono depuis Google Fonts. Hors ligne,
  l'atelier fonctionne — les replis système prennent la main —, mais il ne **ressemble** pas
  à ce que `docs/DESIGN.md` décrit. À embarquer le jour où le hors ligne devient un usage
  et pas un accident.
- **Le démarrage attend le catalogue avant de servir quoi que ce soit.** Le délai est de
  30 s : un réseau qui absorbe sans refuser retarde donc l'ouverture d'autant, bibliothèque
  comprise. Un réseau franchement coupé, lui, refuse tout de suite. Le local se fait déjà
  en premier dans `Atelier.ouvrir()` ; rendre la main avant le catalogue demanderait de
  l'annoncer sur le flux, ce que l'écran sait déjà écouter.

- **Une table de palette Pillow se complète en répétant, jamais avec des zéros.** Elle
  compte toujours 256 entrées, et `quantize(palette=…)` ramène chaque pixel à la plus
  proche des **256** — pas à la plus proche de celles qu'on a écrites. Compléter avec des
  zéros posait donc 254 noirs purs : mesuré sur six gris et une palette de deux couleurs
  claires, les deux plus sombres ressortaient en `#000000`, une couleur que la palette du
  projet ne déclare pas. Même famille que le liseré du seuil alpha — *une valeur de
  remplissage qui n'est pas neutre finit par se voir*. Le défaut a dormi de T2 à T4 parce
  que le seul chemin qui l'empruntait était grisé.
- **Une palette lue sur des images entières ne dit rien du sujet.** La coupe médiane
  appliquée aux artworks tels quels rend vingt gris sur vingt-quatre : le fond plat occupe
  75 % des pixels et son anti-crénelage l'éclate en autant de seaux. On détoure d'abord.
  Corollaire à connaître : **une région fermée reste opaque**, donc l'intérieur d'un cadre
  d'interface entre dans la palette — c'est la même règle qui sauve le squelette.
- **Le dédoublonnage des références se fait sur le couple, pas sur l'identifiant.** Depuis
  T4 deux familles d'images partent par le même tuyau — un asset de la bibliothèque et une
  carte du tableau —, et elles ne se nomment pas dans le même espace.
- **Un artwork retiré ne doit pas rendre les générations passées non relançables.** Les
  artworks entrent dans `generation.references`, et `_octets_references` refusait l'appel
  dès qu'un identifiant manquait. Un asset disparu arrête toujours l'appel — c'est l'image
  que l'auteur a choisie de montrer ; une **carte** disparue est sautée, parce qu'un artwork
  inspire et n'a pas été choisi appel par appel. Sans cette différence, retirer une planche
  cassait US-19 sur tout l'univers.
- **Un balayage de masse n'écrit pas un événement par objet.** La diffusion garde 64
  messages par abonné : cent assets remis à jour en perdraient les plus anciens sur un
  onglet lent, pour un écran qui redemande de toute façon la grille entière. `sauver` prend
  donc `annoncer=False`, et l'appelant annonce **une fois**, à la fin.
- **Un asset ramené au brut reste au brut.** `revenir_au_brut` désépingle, donc l'épingle
  ne le protège pas d'un balayage de palette — et lui reposer une grille défferait « revenir
  à l'image d'origine est un seul geste » par un geste qui ne le concernait pas. Le vide
  **est** la décision : le balayage saute une recette vide et la compte comme conservée.
- **La réapplication de palette ne passe jamais par `poser_recette`**, qui épingle. Le
  premier passage épinglerait tout le projet et le second ne remettrait plus rien à jour :
  la fonction s'annulerait elle-même à son deuxième usage.
- **Un montage FastAPI ajouté après celui de l'interface n'est jamais atteint.**
  `creer_application` monte `interface/dist` sur « / », qui attrape tout. Constaté en montant
  un dossier de planches pour une séance : la planche revenait en JSON de vingt-deux octets,
  et le produit refusait à juste titre « ce n'est pas une image ».
- **Le message de Pillow ne franchit pas le port non plus.** `mesurer()` lève « cannot
  identify image file <_io.BytesIO object at 0x…> » — de l'anglais qui nomme un tampon
  mémoire. Ce qui compte, et que le PRD demande, c'est **quel fichier** pose problème parmi
  les douze qu'on vient de déposer. Même règle que pour `httpx`.
- **`aspect-ratio` cède devant `max-height`, et le cadre ment.** Un cadre en
  `width: 100%` + `aspect-ratio: 1/1` + `max-h-full` dans une zone de 1420 × 906 ressort en
  **1388 × 874** : le navigateur prend la largeur disponible, en déduit la hauteur, rabote
  la hauteur au maximum — et **ne redéduit pas la largeur**. L'image, elle, reste centrée
  par `object-contain`, donc tout ce qui est posé en pourcentage du cadre se décale de
  l'image qu'il désigne. Une mise à l'échelle qui doit être exacte se calcule : un seul
  facteur, `min(place_l / image_l, place_h / image_h)`, et le cadre **est** l'image.
- **`minmax(cran, 1fr)` accepte une colonne unique et l'étire.** Le zoom 4× de la grille
  rendait une tuile de 1028 px sur une colonne de 1060 — huit fois la taille de repos pour
  un contrôle qui en annonce quatre. Un cran de zoom n'est donc disponible que si **deux**
  tuiles y tiennent côte à côte, gouttière comprise : une grille d'une colonne n'est plus
  une planche contact, c'est une visionneuse.
- **Un `ResizeObserver` ne livre rien à un onglet qui ne compose pas ses images.** Ses
  rappels passent par la boucle de rendu ; sur un onglet en arrière-plan, le grisé du zoom
  n'est jamais apparu — la largeur mesurée restait à zéro pour toute la session. Une
  largeur se lit à la demande (`getBoundingClientRect`), au montage, au redimensionnement
  de la fenêtre, et à la fin de la transition de 160 ms des colonnes. Trois déclencheurs,
  une seule mesure.
- **Le défaut d'une bibliothèque est une cible mouvante, et il se nomme.** `rembg.new_session()`
  sans argument charge `bria-rmbg` depuis la version 2.0.81 : un gigaoctet, et **15,8 s**
  par image de 1024 px sur processeur. `u2net`, nommé, met **0,47 s** pour une silhouette
  équivalente à deux points près. Le dépôt annonçait « ~180 Mo » — la taille d'`u2net` —
  et le défaut avait changé sous cette note sans que rien ne le dise.
- **Demander si un paquet est là ne doit pas le charger.** `import rembg` tire
  `onnxruntime` dans le processus au premier `GET /api/status`, c'est-à-dire à l'ouverture
  de l'atelier, pour la seule question « faut-il griser ce bouton ? ». Or « le
  post-traitement ne touche jamais le GPU » se **prouve** en regardant `sys.modules` :
  installer le second moteur aurait fait tomber ce test sans qu'aucun détourage par modèle
  ait eu lieu. `importlib.util.find_spec` répond sans rien charger.
- **Un glob de suppression mord sur ce qui commence pareil — sauf avec son séparateur.**
  Les découpes de T5 vivent dans le dossier de la génération de leur planche, aux rangs 100
  et suivants ; effacer la planche fait `glob("0-*")`, qui ne touche pas `100-asset.json`
  parce que le motif exige le tiret. C'est ce qui rend le décalage de rang sûr, et c'est
  aussi ce qu'il ne faut pas défaire : nommer une découpe `0-1-asset.json` aurait fait
  disparaître les huit avec leur planche.
- **Une piste `minmax(0,1fr)` ne borne pas ce qu'on pose dedans.** La piste accepte de
  descendre à zéro ; l'**élément** posé dessus, lui, vaut `min-width: auto`, c'est-à-dire la
  largeur de son contenu. Une barre d'outils sans retour à la ligne qui demandait 963 px
  pour 740 élargissait donc sa colonne, puis la page entière — en-tête et pied compris — et
  poussait le bouton d'export 150 px hors de l'écran. Le défaut a traversé T3, T4 et T5
  parce que **rien n'était ancré à droite de cette barre** : ce qui débordait sortait de
  l'écran sans rien déplacer de visible. Il a fallu un contrôle *permanent* pour le voir.
  `min-w-0` sur ce qui doit céder, `shrink-0` sur ce qui doit rester.
- **La largeur d'un `select` est décidée par ses données.** Il se dimensionne sur son
  option la plus longue, et les options sont ici des **noms de projets** — donc sans
  plafond. « Ranger… » faisait déjà 162 px pour deux projets et une collection. La largeur
  d'un contrôle est une décision de mise en page ; la liste déroulée, elle, montre les noms
  entiers, et ce n'est pas elle qu'il faut borner.
- **Les transitions CSS n'avancent pas dans un onglet qui ne compose pas ses images.** Même
  famille que le `ResizeObserver` de T5, et le même piège pour qui mesure : `getComputedStyle`
  y rend un instant figé du trajet — colonnes `240px 300px 740px 0px` là où le style en
  ligne dit `… minmax(0px,1fr) 380px`, donc une fiche qu'on croit fermée alors qu'elle est
  ouverte. Une mesure de mise en page se prend transition coupée, jamais après un `sleep`.
- **`zipfile` accepte deux entrées de même nom sans broncher**, et l'outil qui décompresse
  n'en garde qu'une. Quatre variations d'un même prompt portent quatre fois le même label :
  un nom de fichier tiré du label doit donc être numéroté, et c'est le **descriptif** qui
  fait foi sur le lien entre un nom lisible et un identifiant, jamais le nom lui-même.
- **Un PNG ne se recomprime pas.** Il est déjà dégonflé : le repasser au deflate coûte du
  temps pour quelques octets. On le range tel quel (`ZIP_STORED`) et on comprime le
  descriptif, qui est du texte.
- **`Content-Disposition` n'est pas lisible par `fetch` sans qu'on l'expose.** Une réponse
  n'offre à JavaScript qu'une poignée d'en-têtes ; le nom de fichier n'en fait pas partie.
  Sans `Access-Control-Expose-Headers`, l'archive serait sauvée sous un nom inventé par
  l'interface — et deux endroits qui nomment la même archive finissent par ne plus dire la
  même date.
- **Une adresse d'objet non révoquée retient ses octets jusqu'à la fermeture de l'onglet.**
  Une image seule a une adresse et se télécharge par un `<a download>` ; une archive, elle,
  est fabriquée pour cette sélection-là et n'en a pas. On lui en donne une le temps d'un
  clic, et on la reprend aussitôt.
- **Zéro n'est pas une dimension mesurée, c'est l'absence de mesure.** Une carte d'adresse
  qui n'avait pas abouti annonçait `0×0`. Le produit dit partout que les dimensions mesurées
  font foi : une mesure ne s'affiche que si elle a été prise.

- **Un `<button disabled>` ne dispatche aucun événement de souris, pas même sur ses
  enfants.** Le motif de l'infobulle promet qu'un contrôle grisé garde son explication —
  *pourquoi c'est fermé* n'est pas *à quoi ça sert* —, et c'est justement celle qu'on va
  chercher à ce moment-là. Avec `disabled`, elle aurait été la seule du produit à ne jamais
  s'ouvrir. La rangée d'étape passe donc à `aria-disabled`, le clic gardé par une
  condition : le refus est entier, la raison reste dans sa fente, et l'explication s'ouvre
  par-dessus. Vérifié en réintroduisant le défaut — l'essai tombe.
- **Une clé d'explication mal tapée ne lève pas, elle rend le réglage muet.**
  `explication()` rend `undefined`, le pointillé ne paraît pas, et rien ne le dit. C'est la
  panne que le corpus existe pour éviter, et elle est silencieuse : un essai balaie donc les
  composants et confronte **toute clé branchée à l'écran** au corpus. Corollaire de
  rédaction : un second gabarit de libellé serait un second endroit où poser le pointillé,
  donc un endroit où l'oublier — d'où l'état *éteint* plutôt qu'un deuxième composant.
- **Un `<span>` dans un conteneur flexible est blockifié, et une colonne l'étire.** Son
  `display` calculé vaut `block` quel que soit celui qu'on écrit ; dans une rangée il se
  dimensionne sur son texte, dans une **colonne** `align-items: stretch` lui donne toute la
  largeur du panneau. « Proportions » occupait donc 268 px pour 60 px de mot — 208 px de
  zone morte qui ouvrait quand même la bulle et allumait quand même le pointillé —, à côté
  de « Modèle », content, dans le **même panneau** : la poignée dépendait de l'orientation
  du parent, pas du motif. « Le libellé est la cible » ne tient que si la cible *est* le
  libellé, d'où `w-fit` sur le gabarit. Même famille que le cadre de la planche et que la
  barre d'outils : *une règle déléguée au navigateur dont personne n'a mesuré le résultat*.
  Trouvé le 27 août 2026 en regardant l'atelier lancé, et invisible aux 31 essais d'écran —
  jsdom ne met rien en page. L'essai qui le garde vérifie donc **la règle**, et il le dit ;
  la largeur, elle, se mesure au navigateur.
- **Un montage Starlette ne reconnaît pas son propre chemin exact.** `Mount("/mcp")` attrape
  `/mcp/…` et **pas** `/mcp` : le chemin exact traverse toute la table de routage et finit
  chez `StaticFiles` monté sur « / », qui répond **405** à un `POST`. Or `/mcp` est
  exactement ce qu'on écrit dans la configuration d'un agent. Le chemin se corrige **avant le
  routage**, jamais par une redirection : un `POST` redirigé n'est pas resoumis par tous les
  clients, et un flux d'événements redirigé se rouvre au mauvais endroit.
- **Le chemin d'un serveur monté est porté par le montage, jamais deux fois.** Le SDK MCP pose
  sa route sur `/mcp` à l'intérieur de son application ; montée elle-même sous `/mcp`,
  l'adresse réelle devient `/mcp/mcp`. On lui donne « / » à l'intérieur.
- **Une assertion négative ne prouve rien d'un protocole.** L'essai qui gardait le branchement
  vérifiait « ni 404, ni page d'accueil ». Les deux défauts ci-dessus rendaient **405** — ni
  l'un, ni l'autre —, et l'essai passait sur un serveur auquel personne ne pouvait se
  brancher. Un protocole se vérifie en **ouvrant une session**, et sur chacune des écritures
  de l'adresse qu'un client utilisera.
- **`Host` est vérifié par le transport MCP, et son défaut est plus étroit que l'usage.** La
  protection contre le réattachement DNS est justifiée pour un serveur qui écoute en local,
  mais le défaut du SDK n'autorise qu'`127.0.0.1` : `localhost` ressort en **421**, un code
  que rien n'explique côté agent. Les deux noms de la boucle locale sont nommés, avec leurs
  ports, et rien d'autre — ouvrir la liste ferait sauter la protection entière.
- **Le SDK MCP retient le texte d'une exception qu'il ne connaît pas.** Délibérément : une
  trace interne ne doit pas partir chez le client. Conséquence — « plafond de la séance
  atteint, relève-le dans l'écran Réglages » devenait « Error executing tool
  generate_asset », et l'agent n'avait plus rien à répéter à l'auteur, alors que c'est
  très exactement ce que les user stories demandent. Un refus du produit se traduit donc en
  refus **attendu** du protocole, comme `CODES` lui donne son code HTTP de l'autre côté.
- **Une seconde convention de rectangle finit par se confondre avec la première.**
  `image/decoupe.py` l'écrit en toutes lettres — une boîte est `(x0, y0, x1, y1)`, inclusive
  aux deux bouts. L'outil `slice_asset` avait été écrit avec `{x, y, largeur, hauteur}` : il
  proposait une forme et en acceptait une autre, ce qui **est** la seconde convention.
- **Une unité relative se résout contre une référence qu'il faut aller lire.** `36em` sur
  l'`<article>` du guide rend **468 px** et non 504 : `em` vaut la taille de *l'élément qui
  l'écrit* — 13 px, hérité — et non celle de la prose qu'il contient, qui fait 15 px.
  `docs/DESIGN.md` annonçait « 504 px, 74 signes » ; l'écran rend 72 signes, ce que son
  propre titre demandait. Le document narrait déjà la même erreur sur `ch` — l'avance du
  zéro — et la seconde a survécu au constat de la première, dans la même décision. Une
  largeur de colonne de texte se **remesure** sur l'écran rendu, jamais depuis l'unité.

- **Une librairie cache ce qu'elle n'a pas mesuré, et elle mesure par `ResizeObserver`.**
  `@xyflow/react` rend `visibility: hidden` tout nœud dont il ignore la taille. Or *un
  `ResizeObserver` ne livre rien à un onglet qui ne compose pas ses images* — troisième fois
  que ce piège se referme ici, après le grisé du zoom en T5 et les transitions en T6 : **toute
  la toile était invisible**, îlots compris, et le rendu HTML était pourtant complet. Aucun
  essai d'écran ne peut le voir, puisque jsdom ne met rien en page et n'applique donc pas la
  règle. Un nœud reçoit ses `width` et `height` — elles sont calculées de toute façon, puisque
  l'étendue d'un îlot est celle de ses membres. Corollaire : le cadrage d'ouverture ne passe
  pas non plus par `fitView`, qui lit les dimensions du même endroit et renonce en silence
  quand elles valent zéro. **Une largeur se lit à la demande.**
- **Un garde peut être juste et son hypothèse fausse.** « Ctrl+Z ne vole pas l'annulation d'un
  champ de saisie » est une bonne règle ; elle suppose que le champ focalisé est un champ où
  l'on est en train d'écrire. Faux ici : l'écran Univers **couvre** l'atelier sans le
  remplacer, et le champ de prompt garde le focus qu'il a pris au démarrage. Le garde voyait
  donc un `<textarea>` actif à chaque frappe et avalait **toutes** les annulations de la toile,
  en silence. Un garde qui interroge le focus doit le borner à l'écran qui le pose — d'où
  `[data-univers]`. On ne tape pas dans un champ qu'un écran recouvre.
- **Un socle se mesure après ce qu'on y a posé, pas avant.** La disposition d'ouverture cale
  les îlots neufs sous ce qui occupe déjà la toile. Le socle était mesuré avant de compléter
  les îlots *entamés* — ceux dont une seule carte avait été placée à la main —, or ceux-là
  s'étendent vers le bas en accueillant leurs autres membres : les neufs leur rentraient
  dedans. Invisible au banc, parce qu'il faut un tableau où un même groupe mélange des cartes
  posées et des cartes qui ne l'ont jamais été — c'est-à-dire un tableau qu'on a vraiment
  commencé à composer.
- **Ce qu'on lâche, une référence le retient ; ce qu'on montre, un état le rend.** Un
  `pointerup` qui suit son `pointermove` d'assez près lit un rappel fabriqué au rendu d'avant,
  donc une valeur encore nulle — et le geste ne s'écrit pas. La valeur tirée vit donc dans les
  deux : l'état pour rendre la carte à sa largeur vive, la référence pour la poser. Même geste,
  deux lecteurs, deux endroits où la lire.
- **Une librairie cache ce qu'elle n'a pas mesuré — et elle refuse aussi de *relier* ce qu'elle
  n'a pas mesuré.** Quatrième fois que ce piège se referme (T5, T6, T8, T9), et un cran plus bas à
  chaque fois. T8 avait donné à chaque nœud ses `width` et `height` ; il refusait quand même de
  tracer la moindre arête, parce qu'`isNodeInitialized` exige `internals.handleBounds` — mesuré sur
  le DOM des **ancrages**, par le même `ResizeObserver`. Aucun trait ne paraissait, sans un mot. Le
  champ existe pour ça : un nœud porte ses `handles` comme il porte ses dimensions, et la librairie
  s'en sert au lieu de mesurer. Corollaire immédiat : son calcul de position lit `measured`, qui
  vaut zéro pour la même raison, donc le trait partait du **coin supérieur gauche** de chaque objet.
  La formule qui tient les deux : **position mesurée, taille donnée** — la position vient de la
  librairie parce qu'elle bouge pendant qu'on tire, la taille vient du produit parce qu'il la
  calcule de toute façon.
- **Le défaut d'un réglage de librairie prend le geste qu'on voulait.** `zoomOnDoubleClick` et
  `connectOnClick` valent `true` chez `@xyflow/react` 12.11.5 : le premier zoome sur le double-clic
  qui écrit une note, le second arme une liaison sur le clic qui ouvre le menu d'un îlot. Les deux
  sont éteints, **nommés, et la raison est écrite à côté** — un réglage éteint sans phrase se
  rallume à la première mise à jour.
- **Un onglet qui ne compose pas ses images ment aussi sur les couleurs.** Une transition CSS n'y
  avance pas (piège de T6), donc `getComputedStyle` y rend un instant du trajet plutôt que sa fin :
  une couleur qu'on vient de poser s'y lit encore comme l'ancienne. Ce qui se vérifie dans un tel
  onglet est le **style en ligne**, pas la valeur calculée — et une comparaison de teintes à l'œil
  ne s'y fait pas du tout.
- **`getComputedStyle` rend un objet *vivant*.** Le garder pour comparer un avant et un après ne
  compare rien : les deux lectures rendent l'état d'après. Une mesure se prend en **copiant la
  valeur** au moment où on la prend, jamais en gardant la déclaration.
- **Un état qui l'emporte sur un autre ne doit pas l'emporter sur tout.** L'anneau `--lumiere` d'une
  carte choisie l'emporte à juste titre sur sa teinte — mais le faire l'emporter sur le **fond**
  autant que sur le bord rendait la teinte invisible tant que la carte restait choisie, c'est-à-dire
  à l'instant précis où on vient de la choisir : la pastille se clique **depuis le menu de la
  carte**, qui n'est ouvert que parce qu'elle est choisie. Deux vocabulaires qui se disputent une
  surface ne se disputent qu'une **partie** de cette surface.
- **Un événement qui gagne un champ gagne aussi des lecteurs qui ne le concernent pas.** Le message
  `univers` fait redemander l'état et le catalogue depuis T4, parce que promouvoir un artwork change
  ce qui partira. Il porte désormais aussi les teintes d'îlot : colorer un îlot déclenchait donc
  **deux appels réseau pour une couleur**. La règle n'avait pas bougé ; c'est sa condition qui
  manquait, parce que jusque-là « un message `univers` est arrivé » et « l'univers a changé »
  étaient la même chose.
- **Un glissement synthétisé ne démarre pas une gestion de pointeur de librairie.** Ni le nœud
  ni le plan ne bougent sous des `PointerEvent` fabriqués, alors que le même dispatch atteint
  bien la cible et remonte jusqu'à la racine React. Ce qui *est* du produit — un dépôt HTML5,
  une poignée écrite à la main, une touche — se pilote sans peine. **Ce que la librairie tient
  se vérifie à la main, et ça se dit** plutôt que de se laisser croire couvert.

## Règle systématique : comment finir une étape

Toute fin d'étape se rend en **trois temps, dans cet ordre**. Systématiquement, sans qu'on
ait à le redemander.

1. **Les questions ouvertes sont posées de façon cliquable**, jamais en prose. La réponse
   recommandée passe en premier et le dit.
2. **Les actions à faire et les informations importantes sont mises en exergue** — titrées,
   isolées, écrites pour quelqu'un qui ne connaît pas le projet. Une action noyée dans un
   paragraphe technique ne se fait pas.
3. **Le prompt de reprise vient en dernier**, dans un bloc à copier.

**Le prompt de reprise fait trois lignes** : la tâche du jour, l'état en une phrase, et
« lis `AGENTS.md` et les documents de `docs/` ». Ne jamais y recopier le contexte du dépôt,
les règles ci-dessus, l'état Git ni la liste du reste à faire : tout cela vit déjà dans les
fichiers, et la nouvelle session les lit seule.
