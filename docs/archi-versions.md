# Asset Kitchen — Les versions, brique par brique

Ce que chaque version contient, et **par quel mécanisme**. Les sections gardent leur
numéro d'origine — §6 à §10 — parce que soixante-dix renvois du code et des documents
les nomment ainsi ; les renuméroter les casserait tous pour un gain nul.

**`docs/ARCHITECTURE.md` fait foi sur la construction** : les décisions de cadrage, les
cinq règles qui tiennent l'ensemble, le squelette, le modèle d'objets et les risques y
restent. Ce fichier-ci porte le détail d'une version donnée — les briques de la V1, le
pliage et le calque de la V2, ce que la **V3 a mesuré**, et ce que les V4 et V5 supposent
encore. On l'ouvre quand on travaille *dans* une version, pas pour savoir comment le produit
est bâti.

**Trois versions n'ont pas de section ici, et c'est voulu** : la **V2.1** — l'interface refaite
— est décrite dans `docs/ARCHITECTURE.md` § 5 ; la **V2.2** — les autres fournisseurs — dans
`docs/archi-fournisseur.md` ; et la **V2.3** — le traitement qui cesse d'être à refaire — n'a
que son plan, dans `docs/PLAN.md`, parce qu'elle ne pose aucune brique neuve : elle répare des
briques existantes. L'ordre réel des versions est **V1, V2, V2.1, V2.2, V2.3, V3, V4, V5** —
**plus une version d'édition, sans rang fixé**, qui portera le dessin à la main (trait,
rectangle, pot de peinture, symétrie, et ce qui va avec). Décidée le 2 septembre 2026 : jusque-là
le dessin reste un pinceau d'un seul pixel, et rien du plan ne présuppose l'inverse.

Dans quel ordre chaque version a été construite : `docs/PLAN.md`. Ce que chaque tranche a
livré : `docs/tranches/<code>.md`. **Ce que les bancs de la V3 ont mesuré, et qui commande son
§8 : `docs/bilan-v3.md`.**

---

## 6 · V1 — l'atelier

Sept briques, et deux qui sont venues après, de l'usage. Objectif : une application
utilisable pour de vrai, sans aucune inconnue technique.

### 6.1 Contenu

| Brique | Ce qu'elle fait | Ce qu'elle ne fait pas |
|---|---|---|
| **Tableau d'inspiration** | Rassembler, trier, jeter. Cartes image **ou texte**. Entrée par collage (Ctrl+V, le geste principal), glisser-déposer, URL, fichier. Groupes nommés, note et provenance par carte, vignettes 1×/2×/4×. Promotion d'une carte en **artwork officiel**. **Deux vues sur la même matière depuis T8** : la grille, et une toile où une carte se pose, où l'îlot donne enfin une forme au groupe, et où un lien dit ce que la proximité ne dit pas. | Pas de mise en page automatique sur la toile : rien ne s'aligne, ne se distribue ni ne reflue tout seul. Pas de couleur sur une carte — l'îlot et la note seulement, sinon c'est un second rangement, invisible dans la grille et concurrent du groupe. Pas d'historique de composition : la pile d'annulation meurt avec l'écran. Pas de corbeille : suppression avec annulation courte. |
| **Univers** | Une bible en **sept champs nommés** (monde, époque, technique de rendu, trait, éclairage, vue et cadrage, contraintes techniques), chacun activable pour une génération. Les artworks officiels partent en guide de style à chaque appel. Palette extraite d'eux par calcul. Taille de pixel imposée à ce qui rentre, **ou aucune**. | Pas de description automatique du style. Pas de contrôle de conformité. Pas de consignes par type d'asset. Pas de texte libre à côté des champs. |

**Les artworks officiels sont groupés par famille, et seuls ceux de la famille du sujet
partent en référence.** Décidé le 26 août 2026, sur mesure.

Le banc 2 a montré qu'un artwork officiel *figuratif* contamine les sujets suivants : le
squelette héritait de la tunique et des bottes lacées du goblin, la prêtresse elfe de ses
oreilles vertes puis de son visage entier — *« peau olive marbrée, arcade lourde, nez crochu,
croc blanc : l'espèce demandée est perdue »*. Le guide a été jugé « dilue » dans 5 cas sur 6.

Ce que ça implique concrètement :

- **La carte du tableau d'inspiration porte une famille** en plus de son groupe. Familles
  pressenties : `personnages`, `objets`, `décors`, `interface`, et `tous` pour une planche de
  style non figurative — matières, palette, échantillons de trait — qui accompagne toute
  génération.
- **Au moment de générer, l'app n'envoie que les artworks de la famille du sujet**, plus ceux
  marqués `tous`. C'est elle qui choisit, pas l'utilisateur : promouvoir reste un geste unique.
- **Le budget de références s'en trouve allégé** : au lieu de tout envoyer, on envoie ce qui
  est pertinent — ce qui laisse de la place pour la source d'édition dans les chaînes de poses.
- **Effet de bord sur le coût** : moins de références envoyées, moins de tokens d'entrée
  facturés sur `gpt-image-2`. La famille est donc aussi une économie.

Écarté : imposer que l'artwork officiel soit une planche de style non figurative — trop
contraignant, et l'utilisateur travaille justement à partir de visuels trouvés. Écarté aussi :
assumer la contamination comme un effet de style — elle fait perdre l'espèce du sujet, ce
n'est pas un style, c'est une erreur.
| **Générateur** | Prompt, prompt négatif, réglages, choix du modèle, variations. Réinjection d'un asset existant comme référence, source d'édition, guide de style, ou jeu de réglages. | Pas de routeur d'intention automatique. Pas de presets communautaires. |
| **Bibliothèque** | Projets, collections, filiation, favoris, recherche, filtres, sélection multiple. Affichée **sous le champ de prompt**, pas dans un écran séparé. | Pas de galerie publique, pas de partage. |
| **Post-traitement** | Recadrage, redimensionnement, pixellisation sur grille, quantification sur la palette de l'univers, nettoyage de bords. Réglages instantanés. | Pas de passe qui monopolise le GPU. |
| **Détourage** | Remplissage depuis le bord par défaut — aucun modèle, aucun réseau ; `rembg` en second moteur facultatif. Une ou plusieurs passes, seuil alpha et durcissement du bord réglables à chacune. | Pas de détourage par couleur au seuil global : il perce les clairs du sujet. |
| **Slicer** | Découpe d'une planche multi-sprites par alpha connexe. Modes automatique, grille fixe, sélection manuelle. Correction à la main quand la détection se trompe. | Pas d'extraction de composants d'interface (c'est le UI Kit, hors périmètre). |
| **Export** | Téléchargement d'un PNG. Export d'une sélection en ZIP + JSON descriptif — **un geste, donc `services/`** ; `image/` n'en tient que la conversion en PNG. Ce qui part est le rendu, jamais le brut : le brut est ce qui permet de refaire le rendu, et il reste dans l'atelier. **Et depuis C5, un personnage entier dans le dossier du jeu** : un fichier par pose et par pièce posée, à plat, plus le même descriptif — enrichi du rôle (`corps`, `calque`, `corps_habille` : le dernier remplace le corps au lieu de s'empiler dessus), de la pose, de la pièce et de son rang. Le dépôt est celui du dossier du jeu de T7, réemployé et non réécrit. | Pas de paquet Unity/Godot prêt à importer. **L'atelier décrit, l'agent écrit** : aucune ligne de code de jeu, aucune arborescence inventée. |
| **MCP** | **Une dizaine d'outils complets, pas quarante-trois outils fins.** `generate_asset` génère, applique l'univers du projet, traite, range et rend **un chemin de fichier** — et sait écrire directement dans le dossier du projet de jeu. Attente bornée pour éviter le sondage. | Pas d'enchaînement à composer par l'agent. Pas d'URL signées : même machine, mêmes fichiers. |

### 6.2 Les écrans

**Une seule grille d'assets dans tout le produit.** SpriteCook en a deux — une sous le prompt
dans `/create`, une dans `/assets` — et elles ont déjà divergé : la première ne montre pas
les pastilles projet et collection. Ici, la grille qui sert à réutiliser est exactement celle
qui sert à organiser : mêmes filtres, même recherche, même sélection multiple. Organiser
n'oblige jamais à quitter l'endroit où l'on crée — c'est ce qui fait qu'on organise.

| Écran | Rôle | Fréquence |
|---|---|---|
| **Projets** | liste, création, ouverture | rare |
| **Univers** | tableau d'inspiration — grille **ou toile** —, bible, palette, réglages par défaut | au début d'un projet, puis ponctuel |
| **Atelier** | arbre · réglages · prompt · grille — le travail quotidien | permanent |
| **Fiche asset** | visionneuse, recette, filiation, actions | constant |
| **Découpe** | une planche multi-sprites, les rectangles qui en sortiront, leur correction à la main | ponctuel, sur une planche |
| **Réglages** | clé OpenRouter, garde-fous MCP, dossiers | rare |

- **La fiche asset est un panneau latéral**, pas une page. Une page ferait perdre la grille et
  le prompt ; fermer le panneau remet exactement où l'on était.
- **La découpe, elle, est un écran**, ajouté en T5, et pour la raison inverse : on y dessine
  des rectangles sur une image de mille pixels, et la fiche en fait 380. Il s'ouvre **depuis**
  la fiche — on découpe une image, jamais une sélection — et il couvre l'Atelier comme
  l'écran Univers, avec la même contrepartie : il porte sa propre fente de refus.
- **L'écran Univers passe à trois colonnes quand la toile est ouverte** : `380px · 1fr · 380px`,
  réglages de l'univers · toile · réserve, contre `380px · 1fr` en mode grille (`docs/DESIGN.md`
  § Layout). La troisième colonne n'introduit **aucune largeur nouvelle** — c'est la 380 de la
  fiche asset, réemployée pour ce qu'elle nomme déjà : la colonne de ce qu'on manipule. Elle
  n'introduit pas non plus une grille de plus : la réserve **est** la grille du tableau, filtrée
  sur ce qui n'a pas encore de place, ce qui laisse intacte la règle d'une seule grille dans tout
  le produit. Les réglages restent visibles pendant qu'on compose, et c'est la raison d'être de la
  colonne de gauche. La bascule est un segment dans la barre du tableau, pas un onglet : l'écran ne
  se dédouble pas, c'est la même matière regardée autrement.
- **Écran large uniquement.** Le produit ne vise ni mobile ni tablette : les trois panneaux
  et la grille cohabitent d'emblée. Aucun point de rupture, aucun menu escamoté, aucune mise
  en page de repli à écrire. Les panneaux restent rétractables **par choix** — voir la grille
  en grand — jamais par contrainte de place.

### 6.3 Ordre de construction

Sept tranches verticales, décidées ici le 26 août 2026 : **T1** la première image,
**T2** le post-traitement, **T3** la bibliothèque, **T4** le tableau et l'univers,
**T5** le slicer, **T6** l'export, **T7** le MCP.

Le critère qui a produit ce découpage, et qui le tient : **chaque tranche est utilisable à
sa livraison, et on ne passe à la suivante que lorsque la précédente sert vraiment.** T1
seule vaut déjà le détour — elle remplace l'aller-retour vers SpriteCook pour un asset
isolé. Chaque tranche doit valoir son temps de construction avant que la suivante commence.

**T8 la toile et T9 les liens et les notes** se sont ajoutées le 27 août 2026, d'une séance
d'essai sur le produit tenu. Elles ne s'intercalent nulle part : la chaîne de production s'arrête à
T7, rien avant elles ne les attend, et aucune tranche de la V1 ne change d'ordre. Elles sont nées
de l'usage et non du cadrage — la meilleure raison qu'une tranche puisse avoir, et la seule qui
autorisait à revenir sur le « pas de toile libre » écrit ici même la veille.

Ce que contient chaque tranche, les user stories qu'elle couvre, ses dépendances et ses
critères d'acceptation : **`docs/PLAN.md`**, qui fait foi sur l'ordre.

### 6.4 Critères d'acceptation de la V1

Distribués tranche par tranche dans `docs/PLAN.md`, chacun écrit là où il devient
vérifiable.

### 6.5 bis · Ce que la toile ajoute au modèle

*Écrit le 27 août 2026 avec T8 et T9.* Deux tranches nées de l'usage, qui ajoutent une entité,
deux champs à la carte, et rien d'autre.

**L'îlot n'est pas une entité — il *est* le groupe.** Un îlot nommé sur la toile et un `groupe`
écrit sur une carte sont la même chose vue de deux endroits, et c'est ce qui interdit deux
rangements concurrents. Tirer une carte dans un îlot écrit son groupe, l'en sortir le vide :
composer et classer sont le même geste, dans les deux sens, et il n'existe aucun état où l'écran
et le disque divergent. La contrepartie est assumée — **un îlot vide n'existe pas**, puisqu'un
groupe sans carte n'a nulle part où être écrit. La teinte d'un îlot, elle, ne peut pas vivre sur
ses cartes : six cartes feraient six vérités possibles pour un seul îlot. Elle vit dans le fichier
du projet, une entrée par nom de groupe, et part avec le dernier membre. Une note est une carte
texte : elle porte sa teinte elle-même.

**Et elle vit sur le `Projet`, pas dans son `Univers`** — écrit en livrant T9, parce que « le
fichier du projet » laissait les deux ouverts. `Univers` est défini dans sa première phrase comme
*ce que le projet impose à ce qui rentre, et ce qu'il envoie avec* : une teinte d'îlot n'impose rien
et ne part nulle part, et l'y poser en aurait fait le premier champ à démentir cette phrase-là. Elle
voyage en revanche dans l'**enveloppe** du message `univers`, qui portait déjà `projet` et `nom`
sans qu'ils soient dans l'objet — un genre d'événement de plus pour un dictionnaire de six entrées
aurait fait un troisième canal sur un fichier qui en a un.

**La position et la largeur libre sont sur la carte, jamais dans un fichier de mise en page.**
Un `toile.json` par projet aurait exactement la panne qui a déjà valu son refus à `cartes.json`
(`atelier/depot/fichiers.py`) : relire, modifier, réécrire — deux gestes dans le même instant se
relisent tous les deux avant d'écrire, et le second efface le premier. Sur une toile ce n'est plus
une hypothèse, c'est le régime normal : on déplace vite et souvent. La carte porte sa place, et un
déplacement n'écrit qu'un fichier, le sien.

**La largeur libre n'est pas la taille d'affichage, et aucune des deux ne ment sur l'autre.** La
taille d'affichage est le cran 1× / 2× / 4× que lit la grille ; la largeur libre est une place
occupée sur un plan — continue, aimantée sur ces mêmes trois largeurs (`docs/design-motifs.md` § L'écran
Univers). Une valeur unique pour les deux aurait fait qu'agrandir une carte sur la toile change la
grille de tout le monde. La hauteur ne se stocke pas : elle suit le rapport de l'image.

**Posée n'est pas classée, et la réserve est la lecture de « ni l'un ni l'autre ».** Une carte peut
avoir une position sans groupe — c'est le brouillon, trois images côte à côte pour voir si elles
vont ensemble avant de décider qu'elles font un îlot. Le cas inverse existait avant la toile : une
carte groupée depuis T4 n'a jamais été déplacée, donc n'a pas de position ; elle se pose dans son
îlot à l'ouverture et n'écrit la sienne qu'au premier geste. Ce qui n'a **ni groupe ni position**
attend en réserve.

**Un fichier par lien, sous le tableau du projet** — `donnees/projets/<projet>/tableau/liens/<lien>.json`.
Deux raisons, et la seconde est un fait du code. La première est celle de la carte, mot pour mot :
écrire vite et souvent sans relire le tout. La seconde est que `parcourir_cartes` lit
`tableau/*.json` et tient pour une carte tout JSON qui porte un identifiant — poser les liens à
côté des cartes en ferait des cartes fantômes dans le tableau. Un sous-dossier, et la règle du
dossier reste vraie telle quelle.

**Pas d'index pour les liens, comme pour les cartes.** Ils ne se cherchent pas, ne se filtrent pas,
ne se paginent pas : une toile se lit en entier. Corollaire hérité — jeter `atelier.sqlite3` ne
touche ni au tableau ni aux liens, puisqu'ils n'y sont jamais entrés.

**Un lien meurt avec son extrémité, et c'est la suppression qui l'emporte, pas un balayage.**
`effacer_carte` efface déjà la carte et ses octets ensemble ; elle efface désormais aussi les liens
qui y aboutissent. Un trait vers rien ne représente rien, et une entrée morte sur le disque serait
une deuxième vérité qui attend son heure. Un îlot n'ayant pas d'existence propre, un lien vers un
îlot disparaît avec le dernier membre du groupe.

**La route qui les accepte est celle qui existe déjà.** `PUT /api/board/{carte}` porte depuis T4
les réglages qui se remplissent ensemble — groupe, note, taille — et T8 lui ajoute **la position et
la largeur**, sans en ouvrir une nouvelle. La raison est celle d'origine, renforcée : tirer une
carte dans un îlot écrit sa position *et* son groupe, et deux appels rendraient possible un état où
l'un est écrit et l'autre non — c'est-à-dire la divergence que toute la tranche est là pour
empêcher. Elle est appelée **à la fin du geste, pas pendant** : un glissement écrit une fois, au
relâchement, jamais à chaque image.

Les liens ont les leurs, sur le même préfixe et dans la même langue — chemins en anglais, charges
utiles en français : `POST /api/board/links` en pose un, `PUT /api/board/links/{lien}` lui donne
son mot et sa pointe, `DELETE /api/board/links/{lien}` le coupe. `GET /api/board` les rend **avec
les cartes**, comme il rend déjà les groupes : la toile se lit en un aller-retour, parce qu'elle
est le tableau — et il rend les **teintes** avec, pour la même raison.

**La teinte d'un îlot se pose par `PUT /api/board/groups/tint`, et le nom du groupe est dans le
corps.** Deux décisions, deux raisons. Le nom d'abord : un groupe est du texte libre, `nord/sud` en
chemin devient `%2F`, et un nom qui doit revenir intact ne s'encode ni dans un chemin ni dans une
clé composite — c'est le refus de `"ilot:nom"` qui a déjà donné `Bout(genre, valeur)`. Les **trois
segments** ensuite : à deux, `/board/tint` entre en concurrence avec `PUT /board/{carte}` et n'est
atteinte que si elle est déclarée avant, donc l'adresse dépendrait de l'ordre des fonctions dans un
fichier. Le dépôt a déjà payé un chemin qui ne s'atteint pas (`Mount("/mcp")`, voir
`docs/PIEGES.md`) ; à trois segments il n'y a plus d'ordre à respecter.

**Et `PUT /api/board/groups/move` déplace un îlot entier**, écrit le 28 août 2026 avec T10. Trois
segments pour la raison exacte de `tint`, et le nom du groupe dans le corps pour la même. Ce qu'elle
ajoute est une **cardinalité** : un îlot n'a pas de position à lui, donc le déplacer, c'est écrire la
place de chacune de ses cartes — et un appel par carte rendrait possible l'état où sept ont bougé et
cinq sont restées, un îlot déchiré en deux moitiés que personne n'a demandé. C'est « deux appels
pour un geste sont un état de trop » appliqué à un geste qui en aurait demandé douze. Elle exige
donc **toutes** les places de l'îlot et rien d'autre — un sous-ensemble en ferait un second
`PUT /board/{carte}` capable d'écrire des places en lot sous un nom de groupe qui ne les regarde
pas —, elle les vérifie **avant** d'écrire la première, et elle n'élague rien : aucun groupe ne
change, donc l'îlot garde ses liens et sa teinte. Les places sont **absolues et non un écart**,
parce qu'une carte groupée avant T8 n'a pas de position écrite : c'est l'ouverture qui lui en
calcule une, et un écart n'aurait rien eu à quoi s'ajouter pour elle.

**`PUT /api/board/{carte}` gagne le texte d'une note en même temps que sa teinte**, et ça comble un
trou de T4 : sans lui, corriger une faute demanderait de retirer la note et de la recoller — donc
de perdre sa place, sa teinte et les liens qui y aboutissent, c'est-à-dire tout ce que T9 vient
d'ajouter. Le trou ne s'était jamais vu parce qu'une note au bout d'une liste se retape sans rien
perdre.

**`POST /api/board/links` accepte un mot et une pointe, et c'est pour l'annulation seule.** « Il
naît muet » reste vrai : c'est une règle de l'**écran**, qui ne les envoie jamais en tirant un
trait. Mais défaire une coupe, c'est reposer le lien tel qu'il était — et une route qui ne saurait
reposer qu'un trait nu forcerait l'annulation à passer par un second appel, donc par un état où le
geste est à moitié défait. T8 a déjà tranché cette question : deux appels pour un geste sont un
état de trop.

**Et rien n'existe côté serveur pour l'annulation.** La pile de Ctrl+Z vit dans l'onglet et meurt
en quittant l'écran (`docs/archive/plan-versions-tenues.md` T8) : annuler, c'est rappeler la même route avec la valeur
d'avant. Une route d'annulation aurait fait de la composition un historique de projet — elle est le
rattrapage du geste en cours, et rien d'autre.

*Descendu de `docs/ARCHITECTURE.md` § 5 le 2 septembre 2026, sans qu'un mot change : la moitié « modèle » de la toile était là-bas et sa moitié « dépendance » ici, et les deux se renvoyaient l'une à l'autre. **`docs/ARCHITECTURE.md` fait toujours foi sur le modèle d'objets** ; ce qui suit en est le détail pour la toile.*

---

### 6.5 La dépendance de la toile

**`@xyflow/react`, ajoutée en T8.** L'interface avait deux dépendances d'exécution — `react`,
`react-dom` — et elle en a trois. Le fait mérite d'être écrit parce qu'il ne doit pas se
reproduire : tout le reste du produit est du châssis maison, et le rester est une décision
renouvelée, pas un état de fait.

Ce qu'elle fournit, et qu'on ne réécrit donc pas :

| | |
|---|---|
| **Le plan** | déplacement et zoom sous une transformation unique, et la conversion écran → plan dont chaque geste a besoin |
| **Le nœud** | position, glissement, sélection simple et multiple |
| **Le lien** | le tracé entre deux ancrages, son étiquette, sa pointe, et le fait qu'il suive ses extrémités quand elles bougent |

Ce qu'elle ne fournit pas, et qui reste entièrement au produit :

| | |
|---|---|
| **La carte** | un nœud est un emplacement ; ce qu'on y dessine est le composant du produit, sans un pixel d'écart avec la carte de la grille (`docs/DESIGN.md`) |
| **L'îlot** | il n'est pas un nœud de la librairie mais **une étendue calculée** — voir ci-dessous |
| **La persistance** | elle ne connaît ni fichier ni route. Ce qui s'écrit, quand, et par quel appel : §5 |
| **Le classement** | « poser dans un îlot écrit le groupe » est une règle du produit, et c'est le produit qui décide dans quel îlot une carte a été lâchée |
| **La poignée de largeur** | écrite à la main, parce que la toile ne retient que la **largeur** : un redimensionnement à deux dimensions rendrait possible une carte qui ment sur ce qu'elle montre |
| **L'annulation** | aucune pile fournie. Ctrl+Z, sa pile en mémoire et sa mort à la fermeture sont à écrire |
| **La réserve** | elle est hors du plan — c'est la grille du tableau. Le glissement qui traverse la frontière est du code maison |
| **La couleur, la typographie, la forme** | `docs/DESIGN.md` fait foi, y compris pour les six teintes d'îlot |

**L'îlot n'emprunte rien à la librairie, et cette ligne-là a été écrite deux fois.** Le premier jet
annonçait ici `parentId` + `extent: "parent"` comme « le mécanisme exact de tirer dans un îlot ».
Il ne l'est pas, et pour deux raisons qui se sont vues à l'exécution le 28 août 2026. La première :
`extent: "parent"` **enferme** l'enfant dans son parent — il interdit très exactement « sortir une
carte de son îlot », qui est un critère de la tranche. La seconde est la plus profonde : un nœud
parent porte sa propre position, donc l'îlot deviendrait une entité, avec un fichier et une place à
lui — c'est-à-dire le second rangement que §5 refuse dans sa première phrase. **Un îlot est
l'étendue de ses membres, calculée à chaque rendu**, et il n'existe donc aucun état où l'écran
montrerait un rangement que le disque ne dit pas.

**Et les dimensions de chaque nœud sont données, jamais laissées à mesurer.** La librairie rend
`visibility: hidden` un nœud dont elle ne connaît pas la taille, et elle l'apprend par un
`ResizeObserver` — *qui ne livre rien à un onglet qui ne compose pas ses images* (`AGENTS.md`,
mesuré en T5). Toute la toile y était invisible. Le produit calcule ces tailles de toute façon,
puisque l'étendue d'un îlot est celle de ses membres : il les lui donne. Même cause pour le cadrage
d'ouverture, qui se calcule sur une largeur lue à la demande plutôt que sur celle que la librairie
croit avoir.

**T9 a déplacé la frontière d'un cran, et dans le sens du produit.** La ligne « Le lien » du
tableau ci-dessus annonçait que la librairie fournirait « le tracé entre deux ancrages, son
étiquette, sa pointe, et le fait qu'il suive ses extrémités ». Elle fournit l'étiquette — rendue à
l'échelle du plan —, la zone d'écoute de 20 px le long d'un trait de 1 px, et le calque où tout ça
se pose. Elle ne fournit **pas** le tracé, et c'est mesuré, pas préféré :

- **Elle refuse de résoudre une arête dont les nœuds ne sont pas « initialisés »**, et
  `isNodeInitialized` exige `internals.handleBounds` — mesuré sur le DOM des ancrages par un
  `ResizeObserver`. *Qui ne livre rien à un onglet qui ne compose pas ses images.* Aucun trait ne
  paraissait, sans un mot. Quatrième fois que ce piège se referme ici (T5, T6, T8, T9), et un cran
  plus bas que la précédente : T8 avait donné à chaque nœud ses dimensions, il fallait aussi lui
  donner ses **ancrages** — le champ existe (`node.handles`), et la librairie s'en sert au lieu de
  mesurer.
- **Et son calcul de position lit `measured`**, qui vaut zéro pour la même raison : les deux boîtes
  étaient vides, donc le trait partait du coin supérieur gauche de chaque objet. La réponse est la
  formule de T8 appliquée aux arêtes — **position mesurée, taille donnée** : la position vient de la
  librairie parce qu'elle bouge pendant qu'on tire une carte, la taille vient du produit parce qu'il
  la calcule de toute façon.

Le tracé est donc une fonction pure du produit, `ancrer(depart, arrivee)`, qui rend les deux points
où le segment joignant les centres croise chaque boîte. **C'est aussi ce qui permet à un îlot d'être
une extrémité sans avoir d'identité** : son étendue est déjà calculée, puisqu'elle est celle de ses
membres. Un ancrage qu'il aurait fallu *mesurer* aurait exigé qu'il soit un objet — §5 se referme
sur §6.5.

Deux réglages de la librairie sont **éteints, et ça se dit**, parce que leurs défauts prennent des
gestes que T9 utilise : `zoomOnDoubleClick` (défaut `true` — le double-clic écrit une note, il ne
peut pas aussi zoomer) et `connectOnClick` (défaut `true` — un clic sur le nom d'un îlot ouvre son
menu ; un lien se tire, il ne se clique pas). Et `deleteKeyCode={null}`, hérité de T8, cesse d'être
un héritage le jour où il y a de vraies arêtes : sans lui, la touche Suppr couperait un lien sans
passer par la route ni par la pile d'annulation.

**Le partage est net, et c'est ce qui rend la dépendance acceptable : elle tient la surface, le
produit tient la matière.** Le jour où elle gênerait, ce qu'on perdrait est du geste — un plan, un
glissement, un trait — jamais un objet, jamais un fichier, jamais une règle. C'est la ligne que
`fournisseur/` défend ailleurs, obtenue ici sans écrire de port : le modèle ne connaît pas la
librairie, et la librairie ne connaît pas le modèle.

Licence MIT, comme le reste de la chaîne d'interface.

## 7 · V2 — Le personnage et son équipement

Un personnage, ses poses, et les pièces qu'il porte. **C'est ici que se joue la valeur du
projet** : la V1 fabrique des images une par une, la V2 fabrique un personnage cohérent
d'une pose à l'autre — ce que l'analyse de SpriteCook désigne comme sa meilleure idée
technique, et l'entrée obligatoire de la V3.

Passée devant les tuiles le 28 août 2026, sur deux essais payés qui ont levé les deux doutes
qui la retenaient : un jeu de poses tient dans une seule image sans que la grille de pixels
dérive (`essais/essai_grille.py` — dérive médiane 1,00× dans un appel, contre 2,5× entre
deux), et une pièce **contenue dans la silhouette** s'extrait d'un corps habillé sans qu'un
pixel du corps soit repeint (`essais/essai_silhouette.py` — 0,3 % sur les jambières, 0,8 %
sur le casque, six modèles et deux jets). Le même essai a montré la limite, et elle est
écrite dans le produit : une pièce qui **agrandit** la silhouette casse la méthode sur les six
modèles sans exception — voir plus bas.

**Le coût annoncé avant de générer est mesuré, jamais lu dans un tarif.** Le produit ne
porte aucun prix de catalogue et ne doit pas en porter : le coût réel facturé fait foi
partout ailleurs, et l'essai du 28 août a relevé un écart de 1 à 4,6 entre modèles avec un
favori pressenti qui était le plus cher. Ce que l'écran annonce est donc la **médiane de ce
que ce modèle-là a réellement facturé sur cette machine**, et « jamais appelé » quand il n'en
sait rien — le même geste que l'attente de la jauge de T1, qui s'apprend au lieu de s'écrire.

**Le corps naît dans l'atelier, et nulle part ailleurs.** Il n'y a pas d'écran de création de
personnage avec son propre prompt — c'est la décision qui remplace l'assistant en quatre
étapes écrit ici le 26 août. On écrit un sujet, on génère, on obtient une image, et c'est
cette image qu'on désigne comme corps. L'unité manipulée reste l'image de corps : un
personnage est un nom, une description, et un plan de cases dont chacune attend ou contient
une image dont on connaît déjà la grille et la palette.

### Ce que la version ajoute au modèle

| Entité | Contenu | Note |
|---|---|---|
| **Plan de poses** *(projet)* | liste de poses, chacune un identifiant, un nom et un nombre d'images | Propriété du **projet**, et **il n'y en a qu'un** — voir plus bas. Un projet neuf en reçoit un par défaut, immédiatement utilisable. Ajouter une pose ajoute une case vide, jamais une génération. Une pose porte un **identifiant** distinct de son nom : elle se renomme à tout moment, et les images déjà faites ne doivent pas perdre leur case. |
| **Personnage** *(projet)* | nom, description, **poses écartées**, concept arts désignés, références écartées | Un fichier par personnage sous son projet — ni index, ni entrée dans `atelier.sqlite3`. Sa suppression suit la règle générale : jamais de cascade, les images survivent et affichent « personnage supprimé ». |
| **Emplacement** *(projet)* | nom, rang | Ordonné — la tête, le dos, les jambes. Écrire un nom qui n'existe pas le crée. |
| **Pièce** *(projet)* | nom, description, emplacement, **portée** (contenue \| agrandit), concept arts désignés | Décrite une fois sur le projet, posée sur n'importe quel personnage. La **portée** est déclarée par l'auteur, jamais devinée : elle décide si la pièce donne un calque ou un corps habillé. Défaut : contenue. |
| **Calque** *(personnage)* | planche payée d'origine et sa case, recette (recherche de différence, zone, masque à main levée, retouches pixel), pièce, **pose**, mesures | **Une recette, pas un fichier figé** — exactement comme la retouche d'un asset ordinaire en T2. Revenir à la différence brute est un geste unique. La **pose** n'est pas une provenance, c'est une appartenance : un calque ne vaut que sur la pose où il est apparu. |

**Ce que C3 a tranché en écrivant, et qui précise cette ligne.** Le calque **est** un asset,
et c'est sa recette qui le dit : elle gagne une sixième place, `différence`, juste après le
détourage, qui nomme l'asset du corps et le masque rectangle. Trois promesses deviennent
alors vraies *par construction* au lieu d'être tenues à la main — le corps d'origine n'est
jamais modifié, puisque la place ne décrit qu'un calcul ; le masque se déplace sans un
centime, puisque c'est un rendu qu'on recalcule ; et revenir à la différence brute est un
geste unique, puisqu'on vide la zone. Rien ne distingue par ailleurs un calque d'un **corps
habillé** qu'un drapeau aurait dit : les deux portent la même pièce, et seule la présence
d'une différence les sépare. Le prix, écrit dans `docs/PLAN.md` : une place de plus change
l'empreinte de toutes les recettes déjà écrites, donc chaque rendu du disque se recalcule une
fois.

**Ce que C4 a tranché en écrivant, et qui précise la même ligne.** La main entre dans cette
sixième place et nulle part ailleurs, en **deux champs distincts** — ce qu'elle dit du masque,
ce qu'elle dit du calque. « Modifier l'une ne détruit pas l'autre » devient alors la forme de
l'objet et non une précaution à tenir, et rejouer le recalage (R5) n'a pas eu une ligne à
ajouter : la différence est reprise entière, donc tout ce que la main y avait posé reste posé.

Une couche est **un vecteur, jamais une image** : un chemin, un rayon, et garder ou ôter. Un
masque en octets aurait pesé la taille de l'image à chaque geste et aurait perdu ce qui fait une
recette — se rejouer. Le prix est que la rasterisation doit être déterministe, ce qui est déjà
un critère depuis T2.

Et la seconde couche **ramène**, quand la première ne sait que restreindre. C'est ce qui rend la
main capable de rattraper une pièce qui se substitue au corps : aucun réglage de masque ne
fabrique une différence que la comparaison de couleur n'a pas vue (§ Le risque de la version).

Aucun de ces objets n'est une image de plus : le corps et le calque rendu sont des assets
ordinaires, rangés dans la même bibliothèque, avec la même filiation et le même coût.

**Trois décisions prises en construisant C1, et qui corrigent ce tableau.**

**Un seul plan par projet, et il n'a pas de nom.** Cette section en prévoyait plusieurs,
nommés, entre lesquels chaque personnage aurait choisi. C'est inutile tant qu'un personnage
peut **écarter** les poses qu'il ne tient pas (US-117) : un figurant et un héros se comparent
alors au même plan, l'un en cochant moins de cases. Deux façons concurrentes de dire « ce
personnage n'a pas besoin de ça » — sa liste et ses cases décochées — auraient fini par se
contredire. Le nom reviendra avec le second plan, s'il vient.

**Le personnage range ce qu'il *écarte*, jamais ce qu'il tient.** À l'écran on coche des
poses tenues ; le fichier garde le complément. Le sens est le même, la panne évitée ne l'est
pas : ajouter une pose au plan doit ajouter une case vide à *chaque* personnage, et avec une
liste de poses tenues il aurait fallu réécrire tous les personnages du projet à chaque
ajout — un balayage capable de réussir à moitié, pour un geste qui ne devrait rien écrire du
tout. Avec l'écart, la case neuve paraît partout sans qu'un seul fichier soit touché.

**La case n'est pas un objet : c'est l'image qui dit sa case.** L'asset porte `personnage` et
`pose`, hérités de sa génération à la naissance comme il hérite du projet et de la
provenance ; la matrice se **calcule** là-dessus. Il n'existe donc nulle part une liste de
cases pleines à tenir d'accord avec le disque : une image supprimée vide sa case toute seule,
et supprimer un personnage n'a rien à défaire — l'image reste, marquée `personnage_supprime`,
exactement comme un enfant survit à son parent. C'est la règle « un état dérivable ne se
garde pas en double », et c'est aussi ce qui rend vraie sans effort la promesse « jamais de
cascade ».

**Corollaire sur le port** : un personnage qui franchit le port porte **toujours** ses cases,
que ce soit par la réponse d'un appel ou par l'annonce du flux. Elles ne sont pas dans son
fichier — elles se déduisent —, mais une charge amputée remplacerait, à l'écran, un objet
entier par un objet à trous. Payé le 28 août 2026 (`docs/PIEGES.md`).

### Le pliage — la fonction générale de l'atelier

> ⚠️ **Renversé en `A1`, le 2 septembre 2026.** Le paragraphe d'origine est gardé barré
> ci-dessous, parce que c'est lui que soixante-dix renvois viennent lire et qu'il vaut mieux
> voir ce qui a changé que ne plus rien trouver.

~~Le pliage est **une ruse d'appel, pas un format de livraison**. On demande N images dans une
seule planche, on paie un appel au lieu de N, et la planche est dépliée toute seule en N
images séparées. Ce qui sort du produit, ce sont ces images-là et leur descriptif — jamais la
feuille assemblée.~~

**Ce qui tient toujours** : on demande N images dans une seule planche, et l'on paie un appel
au lieu de N. **Ce qui tombe, en trois points** :

- **La planche est devenue un objet du produit.** Elle se voit dans la galerie comme n'importe
  quelle image, avec sa génération, son coût et sa géométrie ; elle se garde ; elle se
  supprime en disant combien d'images en dépendent.
- **Elle est toujours dépliée « toute seule » — mais le dépliage se refait.** Le premier
  découpage reste automatique, et une planche qui revient bien ne demande aucun geste de plus
  qu'aujourd'hui. Quand il tombe mal, l'auteur le **refait** : l'atelier repropose ses coupes,
  il les déplace, en ajoute, en retire, et valide — autant de fois qu'il veut. Les dépliages
  coexistent, et chaque image sortie dit **de quelle planche et de quel dépliage** elle vient.
  *Tranché par l'auteur le 2 septembre 2026 : le défaut n'était pas que le dépliage soit
  automatique, c'est qu'il fût sans retour.*
- **La feuille assemblée n'est plus interdite en sortie.** Les images séparées et leur
  descriptif restent la sortie ordinaire, mais une bande d'animation sort **assemblée** en
  planche de sprites, avec son descriptif écrit dans un format existant.

**Ce qui l'impose est mesuré, pas préféré.** Une planche d'animation revient bonne **une fois
sur dix**, et aucune façon de la demander ne fait mieux (`docs/bilan-v3.md`). On commande donc
plusieurs planches et l'on garde la bonne — ce qui suppose de pouvoir **juger** une planche
avant de choisir, donc de la voir, et de prendre une étape ici et une étape là. Tant que la
planche n'existait nulle part, un découpage tombé mal n'avait rien à reprendre : il fallait la
repayer. *Le détail est dans `docs/PLAN.md` § P1 — la tranche qui s'appelait `A1` avant de
sortir de la V3.*

Ce n'est pas un dispositif du lot de poses : **c'est la manière dont l'atelier habille ou
transforme N images d'un seul appel**, sur une grille carrée dont il connaît la géométrie case
par case. La V2 en a deux usages — le lot de poses (créer N corps) et la planche d'équipement
(habiller N corps) —, et le découpeur de T5 sert les deux. Ce qui change entre eux tient en un
mot : le lot de poses part d'une grille **vide** et l'application ne connaît pas ce qui va
revenir ; la planche d'équipement part d'une grille **qu'elle a composée elle-même**, donc
elle connaît exactement l'avant de chaque case. C'est cette base connue qui rend la différence
solide, et non devinée.

Le gabarit de cases vides devient donc une pièce du produit et pas un accessoire d'essai :
mesuré le 28 août 2026, le compte revient exact 11 fois sur 12 avec gabarit contre 9 sur 12
sans. Deux pièges mesurés le même jour l'accompagnent, et sont traités plus bas : un modèle
recopie les traits du gabarit dans l'image, et deux planches sur vingt-quatre ont répété une
pose sans que le compte en souffre.

- **La taille du lot est le choix de l'auteur.** Le produit annonce ce que ça coûte et ce que
  ça risque ; il ne plafonne pas.
- **Tout ou rien sur le compte, indépendant sur le reste.** Si le nombre d'images revenues ne
  correspond pas au nombre demandé, rien n'entre et le lot se relance d'un geste. Si le compte
  est bon, tout entre, et chaque pose devient jugeable et régénérable seule.
- **Aucune autre mesure ne peut refuser un lot.** Ressemblance, dérive de grille, netteté :
  elles s'affichent toutes, elles n'empêchent jamais de garder.

C'est le seul refus automatique de la version, et il est arithmétique — c'est ce qui le rend
tenable.

> **Révisé par `R6`, le 3 septembre 2026, et seulement d'un côté.** Le refus ne mord plus que
> sur un compte **insuffisant** : sept images pour huit reste refusé, parce qu'il manque une
> étape et qu'aucun choix ne la fabriquera. Neuf pour huit contient au contraire tout ce qui a
> été demandé — le jeter coûtait **31 % des appels de planche** du banc d'animation —, donc la
> planche s'ouvre et l'auteur écarte ce qu'il ne veut pas. Rien d'autre n'a bougé : aucune
> mesure ne refuse toujours, et rien n'entre tant que le compte n'est pas juste.

**Où il vit, et ce que la construction de C2 a tranché.** Le pliage est un module pur —
`atelier/image/pliage.py`, le gabarit et les deux mesures — et un service —
`atelier/services/pliage.py`, plier et déplier. La coupure est celle du slicer de T5 : un
calcul pur se rejoue à l'identique et se mesure au banc, une écriture sur disque non. **Ni
l'un ni l'autre ne connaît personnage ni pose**, et ça se lit dans leurs imports : ils parlent
de *cases*, et c'est le service de génération — le seul qui sache déjà relier un appel à une
case — qui les compose. C'est ce qui laissera C3 le réemployer sans le rouvrir.

- ~~**La planche payée n'est pas un asset.**~~ **Vrai de C2, renversé par `A1` le 2 septembre
  2026.** Tel que C2 l'a construit, la planche reste le brut de sa génération et seules les N
  images séparées entrent en bibliothèque ; elles vivent aux rangs 100 et suivants dans le
  dossier de la génération, comme les découpes de T5 et protégées par le même piège du tiret
  dans le glob de suppression. **`A1` fait de la planche un objet visible et gardé**, et
  demande en plus la filiation que ce choix-ci ne donne pas : les N corps n'ont pas de
  `parent`, c'est la génération qui les relie — or `A1` exige que chaque image dise **sa
  planche et son dépliage**, ce qu'une génération seule ne distingue pas quand on déplie deux
  fois. *C'est le premier travail de la tranche.*
- **Un compte faux est un emplacement échoué**, avec sa raison et son coût. La relance de T1
  s'applique alors telle quelle, au prix plein, sans qu'aucun état neuf soit inventé.
- **Le gabarit ne s'enregistre nulle part** : il se redessine depuis la géométrie, à la
  soumission comme à la relance, donc les deux envoient exactement la même chose. Il compte en
  revanche comme une référence — plafond du modèle, et facture chez ceux qui facturent au
  token —, et l'écran le dit.
- **La reprise d'un lot est un rangement, jamais une relance.** Une planche payée et reçue que
  la fermeture a laissée non dépliée se déplie au démarrage, gratuitement et sans appeler
  personne — *et `A1` le confirme au lieu de le rouvrir : **le dépliage reste automatique**,
  tranché par l'auteur le 2 septembre 2026. Ce que `A1` ajoute est le **retour en arrière**,
  pas une validation de plus* ; ce qui a été coupé *en vol* reste marqué interrompu et attend un geste, comme
  depuis T1. Les deux moitiés sont écrites côte à côte pour qu'on ne les confonde jamais.

### Le calque par différence, sur une planche d'équipement

Une pièce se fabrique **par différence, sans repère ajouté**. Rien n'est ajouté à l'image
envoyée pour aider le recalage — ni ancre, ni mire, ni silhouette — et le corps d'origine
n'est jamais modifié.

Ce qui part n'est pas un corps, c'est **une planche que l'application a composée elle-même** :

1. l'auteur coche les poses qu'il veut habiller, parmi celles qui ont déjà un corps ;
2. l'application range ces corps sur une grille carrée dont elle connaît la géométrie case par
   case, et les cases en trop restent vides ;
3. elle envoie la planche avec « la même planche, avec la pièce en plus, ne touche à rien
   d'autre » ;
4. elle redécoupe le retour sur **la même** grille — le découpeur de T5 fait déjà la moitié du
   travail ;
5. case par case, elle compare l'avant qu'elle connaît exactement et l'après ; chaque
   différence est un calque, **propre à sa pose** ;
6. l'auteur rattrape à la main ce qui tombe faux.

**N calques pour un appel payant au lieu de N.** Et la comparaison part d'une base connue au
lieu d'être devinée, ce qui est plus solide que la méthode une-pièce-un-corps.

La zone est **facultative et rejouable** : par défaut la différence est cherchée sur toute la
case ; la restreindre, la déplacer, la retailler sont des étapes de la recette, qui ne
redemandent jamais d'image au fournisseur.

**Un calque est solidaire de sa pose.** Un casque vu de face n'est pas un casque vu de dos : il
faut un calque par pose, et pour huit frames d'un cycle de marche, huit calques. Ce n'est pas
une limite technique à lever, c'est une évidence de dessin. Ce que le pliage divise, c'est le
nombre d'appels payants — jamais le nombre de calques. Le produit ne propose donc jamais de
reposer un calque ailleurs que sur la pose où il est apparu.

**Une pièce contenue, une pièce qui agrandit.** C'est la seule limite de méthode de la version,
et elle est mesurée, pas pressentie. `essais/essai_silhouette.py`, six modèles et deux jets :

| Pièce | Silhouette retrouvée | **Corps repeint** | Ajout | Échelle au retour |
|---|---:|---:|---:|---:|
| Jambières | 99,5 % | **0,3 %** | 2,3 % | 1,00 |
| Casque | 99,2 % | **0,8 %** | 6,1 % | 0,96 |
| **Cape** | 100,0 % | **23,5 %** | 203 % | **0,62** |

La colonne qui décide est *repeint*, pas *silhouette* : une silhouette à 100 % avec 23 % de
repeint veut dire que le modèle a gardé la forme et redessiné l'intérieur. Et la planche
contact donne la cause : le modèle **dézoome le personnage** pour faire tenir la cape dans le
cadre. À 0,62, il n'y a plus de différence à calculer — remettre à l'échelle rééchantillonne le
pixel art d'un facteur 1,61 et détruit la grille avant même la comparaison.

Le produit en tire une règle, portée par la **portée** que l'auteur déclare sur la pièce :

- **contenue** (casque, jambières, ceinture, gants, plastron) → la différence, telle quelle ;
- **qui agrandit** (cape, ailes, arme longue, sac à dos, monture) → la planche part sur une
  toile avec marge pour que la pièce ait la place ; si l'échelle revient malgré tout
  différente de celle envoyée, **aucun calque n'est fabriqué**. Le produit nomme la dérive et
  garde ce qui revient comme des **corps habillés** — des images de corps ordinaires,
  utilisables et exportables, mais qui ne s'empilent pas.

**Deux nombres, et ils sortent du tableau ci-dessus.** La marge est le dézoom que le modèle
s'accordait tout seul : le sujet d'une pièce qui agrandit part à **0,62** de sa case, contre
0,92 pour une pièce contenue — de quoi ne pas coller aux bords, rien de plus. Et la dérive se
juge à **0,08** près : 1,00 et 0,96 passent, 0,62 non, et aucune valeur intermédiaire n'a
jamais été observée. Ce ne sont pas des réglages choisis, ce sont les mesures retournées.

**Une seule case qui dérive décide pour la planche entière.** Un appel, une pièce, un
verdict : rendre trois calques et deux corps habillés du même lot ferait un état que personne
ne sait lire, et la dérive est de toute façon une propriété de la façon dont le modèle a
traité *la pièce*. C'est le « tout ou rien » du compte de C2, appliqué au second verdict.

Ce n'est pas un refus au sens de T2 : rien n'est jeté, l'appel payé reste acquis, et la seule
chose que le produit refuse de faire, c'est prétendre qu'un calque faux en est un.

**Ce qui est figé dans un calque, et ce qui ne l'est pas.** Le seuil, le masque et le calcul de
différence vivent dans la recette : ils se rejouent à chaque rendu, et déplacer la zone ne
coûte rien depuis C3. **L'alignement, lui, est dans le brut** — le brut d'un calque est la case
découpée *puis recalée* —, et le verdict calque / corps habillé en dépend. C'est la seule
partie du calcul qu'un rendu ne rejoue pas, et c'est pour ça qu'elle a son geste : le recalage
se rejoue depuis la planche, sur l'asset déjà né, sans qu'aucun rang neuf ne paraisse (R5,
`docs/PLAN.md`).

Ce que cette écriture ne viole pas : **le brut d'un calque n'a jamais été l'image payée.**
L'image payée est la planche, qui reste le brut de sa génération et n'est jamais touchée ; le
brut du calque est un dérivé, au même titre que celui d'une découpe de T5. **Un brut dérivé est
un cache** — la règle « image payée + recette, le rendu est un cache effaçable » s'applique
donc un cran plus haut pour ces assets-là, et c'est ce cran qui rend un mauvais recalage
réparable sans repayer.

### La matrice de production

Deux axes — les poses d'un côté, les emplacements de l'autre —, des vignettes dans les cases,
les cases vides visiblement vides. **Ce n'est pas la grille de la bibliothèque** : ni
recherche, ni filtres, ni sélection multiple. Elle ne rompt donc pas la règle d'une seule
grille dans tout le produit, pas plus que la réserve de T8 ne l'avait rompue. On y voit ce
qui manque, et on lance depuis là.

**En C1 elle n'a qu'un axe — les poses.** Le second, les emplacements, n'a rien à montrer
avant que la pièce existe : il arrive avec elle, en C3. Une colonne vide affichée d'avance
serait du cadrage montré à la place du geste — le reproche qui a fait écarter la maquette.

**Et en C3 elle se lit une colonne à la fois.** Le second axe est là, mais il ne se déploie
pas en damier : on choisit la colonne — le corps, ou une pièce —, et la matrice reste une
ligne par attitude. Un damier de vignettes aurait rendu à cet écran très exactement ce que la
privation de C1 lui refuse, une seconde planche contact. Le motif de C1 le disait déjà, mot
pour mot : *on lit une colonne, on ne balaie pas une planche contact.*

**Et « lancer depuis là » veut dire *armer*, pas payer.** Cliquer une case vide remplit le
prompt de l'atelier avec le signalement du personnage et le nom de l'attitude, retient la
case visée, et rend la main : c'est le bouton Générer de l'atelier qui dépense. Il n'existe
donc **qu'un seul endroit d'où l'on paie** dans tout le produit, et « le corps naît dans
l'atelier et nulle part ailleurs » reste vrai au pied de la lettre. La case visée se voit
jusqu'au départ, dans une bande au-dessus du prompt, et se désarme dès que l'appel est parti :
une intention qui survivrait à son geste enverrait l'image suivante — un tonneau, un décor —
dans la case d'un personnage.

### Ce que la V2 n'est pas

Ni squelette, ni os, ni interpolation entre deux poses — c'est la V3. Ni salle d'essai
montrant le personnage équipé dans un décor. Ni bibliothèque de poses partagée entre projets :
le plan appartient au projet qui le porte. Ni génération d'une pièce seule sur fond vide : une
pièce n'existe qu'apparue sur un corps. Ni calque unique porté sur toutes les poses. Ni
combinaison de deux pièces qui agrandissent sur le même corps : deux corps habillés ne
s'empilent pas. Ni détection automatique de ce qui agrandit la silhouette : l'auteur déclare.

### Deux pièges mesurés, et ce que le produit en fait

**Le gabarit recopié.** Un des six modèles rend les traits du gabarit de découpe dans l'image :
la planche est juste, mais elle arrive tramée. Un autre l'ignore comme demandé. Le projet porte
donc **deux défauts de modèle** — produire une planche, éditer un corps — et non un seul, sans
que l'auteur ait à y penser au moment de générer. Ils sont posés en C2 sur l'univers, en deux
champs nommés et **hors du dictionnaire `modeles`** : celui-là est indexé par *famille de
sujet* — ce qu'on fabrique —, et ceux-ci répondent à une autre question, *quelle sorte d'appel
on fait*. Trois niveaux décident donc du défaut, sans trou : le modèle de planche quand un lot
est armé, sinon la famille du sujet, sinon le catalogue.

**La planche redondante.** Deux planches sur vingt-quatre ont répété la même pose. Le compte
était bon, donc le contrat était tenu, donc rien n'a refusé — et c'est correct : un compte
d'images insuffisant reste le seul refus automatique du produit (revoir l'encadré de `R6`,
plus haut dans cette section). Mais la ressemblance entre cases d'un même lot est mesurée et
montrée case par case, et la pose qui n'apporte rien se relance seule. Un compte juste peut
donner une planche sans valeur ; le produit ne le cache pas.

> **Et `R6` en a trouvé une seconde forme, pire parce qu'elle ne se voyait pas.** Une planche
> dont le modèle a redessiné le quadrillage a elle aussi un compte juste — les cases bordées
> font des taches opaques —, sauf qu'elle ne porte **aucun** sujet : les deux tiers de chaque
> « case » sont du fond. Mesuré le 3 septembre 2026 sur les 95 planches du banc des recettes :
> **47 étaient dans ce cas**, toutes entrées en bibliothèque sans un mot. Elles s'arrêtent
> désormais, comme les planches en surplus, et pour la même raison — un compte juste ne dit
> rien de ce qu'on tient.

### Le risque de la version

**La différence trouve ce qui s'ajoute, et manque ce qui se substitue.** C'est le troisième
risque que porte cette section, et le premier qui ait été mesuré plutôt que pressenti.

Les deux précédents sont clos, et il faut dire comment. « Le report d'un calque sur une autre
pose » était un faux risque : un calque est solidaire de sa pose, c'est une évidence de dessin,
et il ne fallait pas le promettre — le risque disparaît avec la promesse. **La toile avec marge,
elle, a été essayée le 29 août 2026, et elle n'a pas eu à servir** : six planches payées, un
seul modèle, deux pièces envoyées chacune aux deux occupations, et l'échelle au retour est
restée dans la tolérance à chaque fois, **à 0,92 comme à 0,62**. L'hypothèse — donner de la
place au modèle l'empêcherait de dézoomer — n'est pas validée pour autant : elle n'a pas été
mise à l'épreuve, faute que le dézoom qu'elle prévient se présente. La marge reste posée, elle
ne coûte rien, et le repli sur le corps habillé n'a jamais été pris que sur une échelle
inventée par un recalage défectueux (`docs/PIEGES.md`).

Ce que la même séance a mesuré, en revanche, déplace la limite de méthode. **Un casque est
revenu en poussière, et une hache a dit les deux moitiés du défaut à elle seule** : son fer,
qui dépasse de la silhouette, revient entier au pixel près ; son manche, là où il croise le
bras, ne revient pas. Ce qui décide n'est ni l'échelle ni la taille de la pièce, c'est la place
qu'elle prend : ce qui **s'ajoute** hors du corps relève d'`ajout`, et rien ne peut l'effacer ;
ce qui **se substitue** à l'intérieur relève de `touche`, et `touche` l'efface avec le bruit,
parce que la comparaison de couleur est délibérément tolérante au voisin de 3×3 pour ne pas
compter un résidu de rééchantillonnage comme du repeint. Les deux décisions sont justes
séparément ; c'est leur composition qui perd la pièce.

La portée déclarée oppose *contenue* et *qui agrandit* — la question de l'échelle. Ce qui
décide de la lisibilité du calque est *ajoute* contre *substitue*, et **les deux découpes ne se
recouvrent pas** : un casque est contenu et se substitue, une hache agrandit et s'ajoute. Rien
n'est cadré là-dessus ; `docs/releve-usage.md` le porte.

**C4 l'a rattrapé, et il faut être précis sur ce que ça veut dire.** La seconde couche de la
main ne fait pas que retirer : elle **ramène** les pixels revenus là où la mesure n'a rien
trouvé, ce qu'aucun réglage de masque ne peut faire. Mesuré le 29 août 2026 sur le casque de la
séance, par la route de l'image : 451 pixels de poussière avant, 1 044 après un seul passage, et
le casque lisible. Ce qui reste ouvert est la **détection** — le produit ne sait toujours pas
dire *d'avance* qu'une pièce va se substituer, et aucune des cinq mesures ne le dit non plus,
puisque celle du 29 août affichait une échelle à 1,00 et une silhouette à 100 %. Le risque a
donc changé de gravité et non de nature : il coûte un geste, plus une image illisible.

**Le repli, lui, existe déjà et n'a pas bougé** : les mesures ne refusent rien, l'appel payé
reste acquis, et un calque illisible se retouche au lieu de se repayer — d'autant que la
planche qui l'a payé reste sur le disque et que son recalage se rejoue sans un centime (R5).

Le découpage en tranches, les user stories et les critères : **`docs/PLAN.md`**, qui fait foi
sur l'ordre.

## 8 · V3 — Animation de sprites

> ⚠️ **Réécrite le 2 septembre 2026.** Cette section supposait ; elle est désormais **mesurée**.
> Trois bancs payés les 1ᵉʳ et 2 septembre — **141 planches, 6,03 $**, toutes regardées et
> notées une par une par l'auteur — ont répondu, et pas dans le sens espéré. **Le document qui
> fait foi sur ces chiffres est `docs/bilan-v3.md`** ; le découpage en neuf tranches `A0` à `A8`
> est dans `docs/PLAN.md`. Cette section-ci ne garde que ce qu'il faut savoir pour construire.

**Ce n'est plus le morceau à risque : le risque est levé, et la réponse est négative.** Une
planche d'animation revient bonne **une fois sur dix**. Ce n'est pas un échec, c'est un prix —
de cinq à dix-sept centimes l'animation utilisable, une fois les ratés payés par les réussites.
Mais ce chiffre **interdit un produit et en impose un autre**.

### Ce que la mesure interdit

~~**Approche retenue** : faire produire les images par l'IA, puis fournir un bon outil de
découpe, d'alignement et de prévisualisation. Le travail manuel est accepté s'il se fait dans
une interface agréable.~~

**Écarté, mesuré.** Cette approche bâtit la version sur *« on commande une planche, on la
corrige »*. À une bonne sur dix, il faudrait corriger neuf fois sur dix — ce qui coûte plus cher
que de recommander. **Le tri est moins cher que la retouche**, mais seulement si le tri ne coûte
rien en gestes.

**Et mieux écrire la demande est mort comme levier.** Trente-et-un réglages essayés sur trois
bancs : le nombre de cases, six formulations, ce qu'on joint, le format, la clause de constance.
Les cinq réécritures de fond donnent **zéro bonne planche sur vingt** ; les planches à quatre
cases, **zéro sur seize**. **Le texte du produit ne bouge pas**, et c'est autant de travail qui
n'a pas lieu d'être.

### Ce que la mesure impose

**Le geste central est : commander plusieurs planches, les regarder bouger côte à côte, garder
la bonne** — ou prendre une étape ici et une étape là pour composer une bonne bande avec deux
planches à moitié bonnes.

L'outil, brique par brique, **révisé** :

- **la planche devient un objet du produit** — elle se voit, elle se garde, son découpage se
  fait toujours tout seul, et il **se refait à la main** autant de fois qu'on veut ; c'est le
  renversement décrit au §7, et rien ne se construit sans lui ;
- **une bande est un tout** : ses étapes se recadrent sur **une fenêtre commune**, jamais chacune
  sur la sienne. ~~alignement : marge, marge de sécurité, forçage en puissance de deux, ancrage
  3×3~~ — l'alignement image par image est **exactement le défaut mesuré** : le recadrage prend
  chaque étape sur sa propre boîte, et les huit images livrées d'une même marche faisaient
  toutes la même hauteur, ligne de sol au même pixel, **écart zéro**. Le balancement disparaît
  avant que l'œil puisse le voir ;
- **commander N planches d'un coup et trier** — la brique qui n'était pas prévue, et qui est la
  principale ;
- **pelure d'oignon, aperçu animé avec réglage de vitesse** — tenu, et l'aperçu se monte sur les
  **cases brutes, fond compris** : juger le mouvement et juger le découpage sont deux métiers ;
- **correction étape par étape** — tenu, et c'est la dernière économie : une bande bonne aux
  sept huitièmes ne se rejette plus entière, on repaie **une étape** ;
- **le mouvement devient un objet nommé de l'atelier**, avec ses étapes et sa cadence, qui se
  rejoue sur tous les jeux suivants ;
- **le contour cesse de grésiller** quand la bande tourne — un défaut fixe est un défaut, un
  défaut animé est un défaut qu'on regarde ;
- **sortie** : planche de sprites + descriptif dans un format existant, image animée — **et le
  pantin**, voir plus bas. On n'invente aucun format.

### La brique qui supprime la loterie — le pantin

**Décidée le 2 septembre 2026.** À partir d'**une seule** image déjà validée, l'atelier découpe
le personnage en morceaux articulés, pose les épingles aux articulations, applique un mouvement
de la bibliothèque et rend la bande **sans un seul appel payant**. Rien n'est redessiné : ce
sont les pixels d'origine, déplacés — donc le personnage ne peut plus changer de taille ni de
visage entre deux étapes, et **le défaut dominant des trois bancs disparaît par construction**.

**Ce qui sort vers le jeu, ce sont les images *et* le pantin** : la planche de sprites reste la
livraison principale, le squelette et ses mouvements sortent en plus, dans un format existant.

> ⚠️ **L'ordre des opérations commande tout le reste : déformer en grand format, pixeliser à la
> fin.** Le problème n'est pas la rotation, c'est **quantifier la géométrie trop tôt**. Et
> **le pantin ne fait bouger que ce qui est déjà dessiné** : une marche de profil oui, un
> demi-tour, une main qui se retourne ou un visage qui change d'expression non — les huit
> directions restent une affaire de génération.

### Ce qui reste vrai de la version d'origine, et qui a servi

**L'observation du 26 août 2026 tient, et elle a donné le gabarit.** Pendant l'essai d'identité,
un modèle a **calqué la mise en page de son image de référence** : on demandait un sprite, il en
a rendu trois alignés, et l'appel suivant en a rendu trois dans la même disposition. Le modèle
reproduit la **structure** de l'entrée, pas seulement son style.

**L'hypothèse qui en est sortie a été essayée et elle est bonne** : fournir une **planche
gabarit** — des cases vides, alignées, à la bonne taille — et laisser le modèle la remplir.
Mesuré le 28 août 2026 : le compte revient exact **11 fois sur 12** avec gabarit contre **9 sur
12** sans. Le gabarit est aujourd'hui une pièce du produit.

> ⚠️ **Mais le modèle qui a révélé le comportement n'est pas celui qui produit les animations.**
> Sur le banc d'animation, à demande identique, il rend **zéro bonne planche sur huit**. Celui
> que le produit emploie déjà en rend **cinq sur huit**, et pour vingt-trois fois moins cher par
> bonne planche. L'observation valait pour ce qu'elle a appris, pas pour un choix de modèle.

**Et l'effet de bord côté V1 reste vrai** : ce même comportement est une **nuisance** tant qu'on
veut un sprite isolé. Le prompt doit imposer *« one single sprite, one pose only »*.

**Enfin, une chose que les bancs ont apprise sur le produit et qui n'est pas de l'animation** :
quatre planches sur treize ont été **refusées pour un sujet de trop** — le modèle complétant une
grille que le gabarit ne dessinait qu'aux trois quarts. C'est la tranche `R6`, prise avant tout
le reste et hors de toute version, parce qu'elle répare aussi les planches d'équipement du §7.

## 9 · V4 — Tileset autotile

Génération d'atlas de tuiles qui se raccordent. Lourd mais **déterministe** : aucune
inconnue, seulement du post-traitement précis.

- Perspectives : top-down, plateforme, isométrique.
- Jeux de pièces : 15-pièce (4×4), 17-pièce (5×4), autotile-16 plateforme.
- Recalage sur grille, découpe, assemblage en atlas, aperçu de raccord.
- Sortie : PNG + JSON de mappage.

Point d'attention relevé chez SpriteCook : aux petites tailles (16 et 32 px), le
modèle génère **plus grand** que la sortie finale, puis on recale et on découpe.
Générer directement à la taille cible ne marche pas.

## 10 · V5 — Audio

> Repris et élargi le 18 septembre 2026 : [archi-son.md](archi-son.md) et
> [PLAN-son.md](PLAN-son.md). Stable Audio Open y cède la place par défaut à Stable Audio 3,
> et reste en secours ; ce qui suit est l'intention d'origine.

- **Bruitages** — description → son court. Le module existe déjà dans MySpriteAi
  (Stable Audio Open en local) ; une API reste possible en second fournisseur.
- **Boucles d'ambiance** — le vrai travail est le **bouclage sans couture** :
  recouvrement, fondu croisé, correspondance de phase. C'est du traitement du signal,
  pas de la génération.
- Post-traitement commun : fondus courts, retrait des silences de tête et de queue,
  normalisation, fréquence d'échantillonnage fixe.
