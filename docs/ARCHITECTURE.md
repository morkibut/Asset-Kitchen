# Asset Kitchen — Architecture

> Établi le 26 août 2026, à partir de l'analyse de SpriteCook
> (`Anatomie de SpriteCook.html`, captures dans `screen_spritecook/`)
> et de l'état des trois projets qui précèdent : `_DEV/game-asset-generator` (GAG),
> `_DEV/MySpriteAi`, `_DEV/game-asset-generator/texel-studio`.

---

## 1 · Ce que c'est

Un atelier personnel de production d'assets 2D pour jeu. On y définit **l'univers**
d'un jeu une fois, puis on fabrique au cas par cas les personnages, objets, décors
et interfaces qui lui appartiennent. **Tout ce qui est produit entre en bibliothèque
de lui-même** ; juger, c'est marquer favori ou supprimer, et ce qui est jugé l'est
avant de partir dans le jeu, pas avant d'entrer dans la bibliothèque
(`docs/PRD.md` fait foi sur ce point).

Le moteur d'image est une API payante. Ce n'est pas un compromis : c'est la seule
famille de modèles qui sait **préserver l'identité d'un sujet** d'une génération à
la suivante — la capacité sur laquelle repose toute la V2, et tout ce qui la suit.

## 2 · Ce que ce n'est pas

| | |
|---|---|
| **GAG** | fabrique de la quantité, en lot, la nuit, avec des modèles locaux. Asset Kitchen fabrique peu et bien, à la main. Les deux vivent côte à côte, ils ne fusionnent pas. |
| **MySpriteAi** | outil local, ComfyUI au centre, tout dans le navigateur. Asset Kitchen n'embarque pas ComfyUI. |
| **Un produit** | usage personnel. Pas de comptes, pas de crédits, pas de multi-utilisateur, pas de distribution, pas de galerie communautaire. |

Le local reste disponible **hors de l'application** : ComfyUI ou MySpriteAi produisent
une image, on l'importe dans Asset Kitchen. L'import est un citoyen de première classe ;
l'intégration ne l'est pas.

## 3 · Décisions de cadrage

| Sujet | Décision | Pourquoi |
|---|---|---|
| Socle | Nouveau dépôt. Récupération ciblée, pas de fork. | Paradigme opposé à GAG, moteur opposé à MySpriteAi. |
| Moteur d'image | **API seulement**, via **OpenRouter comme passerelle unique**. | Cohérence d'identité impossible en local sur 8 Go — mesuré : Flux GGUF 1024 à 106,9 s/image sur cette machine. |
| Fournisseur | Un seul adaptateur : OpenRouter. Un compte, une clé, une facture. | 48 modèles image de 11 fournisseurs, paramètres unifiés, découverte de capacités, `usage.cost` par appel. Écrire trois adaptateurs donnerait le même résultat pour trois fois le travail. |
| Comptabilité | **Aucun compteur de crédits maison en V1.** Suivi des coûts dans le tableau de bord OpenRouter. | Économise tout un pan de code pour une information déjà rendue ailleurs. |
| Modèles locaux | Hors application. Import du résultat. | Évite le gestionnaire de VRAM, les rechargements, les custom nodes. |
| Détourage | **Remplissage depuis le bord** par défaut, `rembg` en second moteur facultatif. Passes multiples dans les deux cas. | *Révisé le 27 août 2026, à la mesure.* Tout ce que l'atelier produit arrive sur un fond plat : le remplissage suffit sur 44 images de six modèles, en 130 ms, sans modèle, sans téléchargement et hors ligne. Faire du modèle la dépendance par défaut aurait fait payer 180 Mo et un premier lancement en ligne pour un résultat que personne ne distinguerait. |
| Post-traitement | Local, CPU, jamais sur le GPU. | Reprise de AD-9 de GAG. Un curseur doit répondre instantanément. |
| Univers | Bible écrite à la main + planches de référence + palette extraite par calcul. | La palette sert **en entrée** (contrainte de quantification), pas en contrôle. |
| Conformité | **Aucune vérification automatique.** L'humain juge à l'œil. | Écarté volontairement : coûte de l'analyse d'image pour un jugement que l'auteur fait mieux. Réintégrable plus tard si le besoin apparaît. |
| Forme | Serveur Python local + interface web dans le navigateur. | Pillow, numpy et le SDK MCP imposent Python ; l'ergonomie impose le web ; le navigateur donne les outils de développement, qu'une WebView cache. |
| Toile de composition | **`@xyflow/react`**, ajoutée en T8 — la seule dépendance d'exécution que l'interface ait gagnée depuis React. | *Décidé le 27 août 2026.* Le plan, la conversion écran → plan, la sélection et le confinement d'une carte dans un îlot sont du code de bibliothèque, éprouvé et sous licence MIT ; les réécrire coûterait des semaines pour reproduire ce qui existe. Ce qu'elle ne fournit pas — la carte, la persistance, le classement, l'annulation — reste entièrement au produit : §6.5 fait la part exacte. |
| Style | V1 = pixel art. Aucune décision ne doit interdire le 2D non-pixel. | La quantification stricte abîme le 2D peint — elle devra avoir deux régimes le jour venu. |
| Validation | Manuelle, systématique. | C'est le principe du produit, pas une limite. |

## 4 · Architecture

```
                 navigateur (React + Vite + Tailwind)
                              │  HTTP + SSE
                 ┌────────────┴─────────────┐
                 │   API locale — FastAPI   │
                 └────────────┬─────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   fournisseurs          traitement            bibliothèque
   d'image (API)     (Pillow + numpy,       (SQLite + fichiers)
                     rembg en option)
                              ▲
                              │
                     serveur MCP (même processus,
                      mêmes fonctions que l'API)
```

Cinq règles qui tiennent l'ensemble :

1. **Le fournisseur est derrière un port.** Le vocabulaire d'un fournisseur ne franchit
   pas son adaptateur : ni `gpt-image-2`, ni `gemini-*`, ni le nom d'un paramètre
   maison ne remontent dans le domaine. Reprise de AD-11 et AD-28 de GAG.
2. **Le MCP n'a pas de logique propre.** C'est une façade sur les fonctions que
   l'interface appelle déjà. Deux chemins, une seule implémentation.
3. **Les fichiers font foi, la base est un index reconstructible.** Si la base
   SQLite disparaît, on la reconstruit en relisant le disque — aucun asset n'est
   perdu. Reprise de AD-5 de GAG.

   Deux conséquences, tirées en T3 et qui tiennent l'invariant vivant : le schéma
   de l'index **n'a aucune migration** — quand il change, l'index est jeté et le
   démarrage le refait depuis les fichiers, si bien que la reconstruction sert au
   moins une fois par évolution du schéma ; et **le fichier s'écrit avant
   l'index**, jamais l'inverse, pour qu'une coupure laisse l'index en retard sur
   le disque plutôt que le disque en retard sur l'index.
4. **Le post-traitement ne touche jamais le GPU.** Il est CPU, pur, et ses étapes
   s'appliquent dans un ordre fixe : détourage, recadrage, grille, quantification,
   bords. Aucune ne se réordonne — trois des cinq n'ont pas de sens avant celle
   qui les précède.

   **Le détourage par défaut ne demande aucun modèle**, et c'est une mesure, pas
   un principe : un remplissage depuis le bord — un pixel n'est du fond que s'il
   est *relié au bord* par une chaîne de pixels proches de la couleur de
   bordure — rend une silhouette propre sur les 44 images des bancs, squelette
   blanc sur fond gris clair et fioles translucides compris (`essais/essai_pixel.py`,
   27 août 2026). `rembg` reste **en second moteur, facultatif** — il embarque
   180 Mo de réseau de neurones et il est là pour les images qui ne viennent pas
   d'ici, donc sans fond plat. Absent, il est grisé avec sa raison, et rien du
   geste courant ne s'arrête.
5. **Le traitement est non destructif.** On garde l'image brute et la **recette** — la
   liste ordonnée des étapes et leurs réglages. Le fichier traité est un rendu, écrit sur
   disque comme cache, effaçable sans rien perdre. Recalculer coûte des millisecondes ;
   regénérer coûte de l'argent et ne rend jamais la même image. Corollaire gratuit : un
   preset *est* une recette nommée, et changer la palette d'un projet la réapplique à tous
   ses assets sans un seul appel payant.

### Squelette du dépôt

```
gag2/
├─ AGENTS.md                 écrit au fur et à mesure, jamais après coup
├─ docs/PLAN.md
├─ atelier/                  paquet Python
│  ├─ __main__.py            lance le serveur, ouvre le navigateur
│  ├─ api/                   FastAPI — les routes
│  ├─ mcp/                   serveur MCP — façade, aucune logique propre
│  ├─ services/              les gestes du produit
│  ├─ domaine/               objets et règles, aucune dépendance sortante
│  ├─ fournisseur/           le port + l'adaptateur OpenRouter
│  ├─ image/                 mesures, détourage, grille, quantification, découpe, PNG
│  └─ depot/                 SQLite + fichiers
├─ interface/                React + Vite + Tailwind
├─ donnees/                  projets et assets — hors Git
└─ pyproject.toml
```

**Une seule frontière formelle : `fournisseur/`.** L'hexagone complet de GAG protège d'un
remplacement ; or il n'y a qu'une base, qu'un disque, qu'une interface, et aucun des trois
ne changera. Le fournisseur, lui, changera. Partout ailleurs : des modules à responsabilité
claire, comme `server/` dans MySpriteAi.

**`mcp/` est le voisin de `api/`, pas son client.** Les deux appellent `services/`, aucune ne
réimplémente rien. C'est ce qui garantit que ce qu'un agent peut faire est exactement ce que
l'écran peut faire.

**Pas de noyau détaché** (contrairement à GAG) : utile pour un lot de nuit de huit heures,
inutile pour une génération de dix secondes qu'on regarde.

**Nommage — un tiers le lit → anglais, sinon → français.** Les noms d'outils MCP en anglais
(ils sont lus par des modèles entraînés en anglais ; `generer_asset` dégraderait le
déclenchement) et les chemins de routes HTTP par convention. Domaine, services, traitement
d'image, colonnes SQL, interface : en français.

## 4 bis · Fournisseur et modèles → `docs/archi-fournisseur.md`

Trois décisions tiennent ici, et le relevé qui les a dictées vit dans
**`docs/archi-fournisseur.md`** — deux bancs payés, leurs tableaux de coût et de qualité,
les pièges de fournisseur vérifiés par appel, le contrat de génération et les seize outils
du serveur MCP. Le numéro y est conservé : un renvoi `§4 bis` reste valide.

- **Un seul adaptateur, OpenRouter.** Le vocabulaire d'un fournisseur ne franchit pas son
  adaptateur — c'est la règle 1 du §4.
- **Le catalogue décide, jamais une liste en dur.** `GET /api/v1/images/models` est relu au
  démarrage ; un modèle qui ne peut pas honorer la demande est **grisé avec sa raison**,
  jamais proposé puis rejeté en 400. SpriteCook code ses limites en dur, et plafonne sous
  les modèles.
- **Un seul modèle par défaut : `openai/gpt-image-2` en `quality: low`.** Et la leçon qui a
  coûté deux bancs : *ne jamais conclure d'un banc dont le protocole n'est pas le geste réel
  du produit* — le classement s'est inversé dès qu'on est passé d'un sujet à un univers.

## 5 · Modèle d'objets

| Entité | Contenu | Note |
|---|---|---|
| **Projet** *(= l'univers)* | nom, bible (sept champs nommés), planches de référence, palette extraite, réglages par défaut — dont la taille de pixel, qui accepte « aucune » | Chez SpriteCook le projet est un dossier. Ici il **contraint** — c'est la différence centrale. |
| **Collection** | nom, projet optionnel | Rangement à plat, comme SpriteCook : Projet › Collection › Asset, et rien d'autre. Une collection qui appartient à un projet **décide** du projet de ce qu'on y range ; une collection sans projet traverse les univers. |
| **Carte** *(tableau d'inspiration)* | type (image \| texte), contenu, groupe, note, provenance (URL, date), taille d'affichage, **position sur la toile**, **largeur libre**, **teinte** (une note seulement), **artwork officiel** oui/non, **famille** (personnages \| objets \| décors \| interface \| tous) | Deuxième famille d'images du produit. Ne s'exporte jamais, ne compte pas dans la bibliothèque. La **famille** décide de ce qui part en référence — voir §6.1. La **position** et la **largeur libre** sont arrivées en T8 : elles portent la place de la carte sur la toile, et ne se confondent pas avec la taille d'affichage — voir plus bas. |
| **Asset** | fichier(s), label, prompt, réglages résolus, dimensions mesurées, type, projet, collection, parent (filiation), favori, coût, date de suppression | Les dimensions **mesurées** font foi, jamais celles demandées. Le **coût** est une copie prise à la naissance, pour la tuile ; la génération reste la vérité, elle seule connaît les appels ratés. La **date de suppression** dure le temps de l'annulation, puis les fichiers partent. |
| **Génération** | statut, avancement, paramètres résolus, coût réel, résultats, réinjections, **prompt tel qu'il est parti** et s'il a été repris à la main. Pour un import : le nom du fichier, l'empreinte de ses octets, et si le traitement du projet lui a été appliqué | Un enregistrement par appel, y compris ceux qui échouent. Une **réinjection** est un identifiant d'asset et son rôle — jamais des octets : ils se relisent depuis l'asset au moment de l'appel, et de la relance. Le rôle `edition` donne sa filiation à ce qui sort. |
| **Lien** *(toile)* | ses deux extrémités, son mot, sa pointe | Ajouté en T9, et **le seul objet neuf du modèle depuis T4**. Le mot et la pointe naissent vides : un trait nu dit déjà « ceci a rapport avec cela », et c'est le cas courant — le défaut est muet, l'exception s'exprime. Une extrémité est soit une carte, par identifiant, soit un îlot, par nom de groupe : l'îlot n'a pas d'identité propre (voir plus bas). Un lien ne survit pas à ses extrémités. |

Ce tableau tient le modèle de la V1. **Les cinq entités de la V2** — plan de poses,
personnage, emplacement, pièce, calque — sont décrites en §7, et aucune ne modifie une
ligne ci-dessus : elles s'ajoutent, et le corps comme le calque rendu restent des assets
ordinaires.

**Pourquoi le personnage mérite une entité et pas un champ.** C'est la deuxième fois seulement
depuis T4 qu'on ajoute un objet au modèle — le lien de T9 était le premier —, et la barre doit
rester haute. Une étiquette sur l'asset aurait suffi à dire « ces images vont ensemble » ; elle
ne suffit pas à dire **ce qui manque**. Le personnage porte un plan de cases dont chacune est
vide ou pleine, et c'est cette liste de cases vides — que nul asset ne peut porter, puisqu'elle
décrit des images qui n'existent pas — qui fait l'entité. Le champ `groupe` de la carte avait
déjà échoué sur ce point en T8, pour la même raison : une étiquette n'a pas de forme, et ce qui
n'existe pas encore n'a rien à étiqueter.

### Ce que la toile ajoute au modèle

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
en quittant l'écran (`docs/PLAN.md` T8) : annuler, c'est rappeler la même route avec la valeur
d'avant. Une route d'annulation aurait fait de la composition un historique de projet — elle est le
rattrapage du geste en cours, et rien d'autre.

## 6 à 10 · Les versions → `docs/archi-versions.md`

**Ce que chaque version contient, et par quel mécanisme, vit dans
`docs/archi-versions.md`** — §6 la V1 et ses briques, §7 la V2 avec le pliage, le calque
par différence et le risque de la version, §8 à §10 l'animation, les tuiles et le son. Les
numéros y sont conservés : un renvoi `§7` ou `§6.2` reste valide, seul le fichier change.

On l'ouvre quand on travaille *dans* une version. Ce qui tient l'ensemble — les cinq
règles, le squelette, le modèle d'objets, les risques — reste ici.

## 11 · Risques, et quand les lever

| Risque | Gravité | Quand le lever |
|---|---|---|
| **La recette d'animation n'existe pas** | élevée | prototypage dédié avant la V3 — **piste sérieuse trouvée**, voir §8 |
| ~~Un calque ne se repose pas sur une autre pose~~ | — | **retiré le 28 août 2026 : ce n'était pas un risque, c'était une promesse fausse.** Un casque vu de face n'est pas un casque vu de dos ; un calque est solidaire de sa pose et il en faut un par pose. Ce qui l'a remplacé — la planche d'équipement pliée, N calques pour un appel — rend le prix acceptable sans rien promettre qu'on n'ait mesuré. Voir §7 |
| ~~La toile avec marge n'a jamais été essayée~~ | — | **tiré le 29 août 2026, six planches payées.** L'échelle au retour est restée dans la tolérance à chaque fois, à 0,92 comme à 0,62 : la marge **n'a pas eu à servir**, et le repli sur le corps habillé n'a jamais été pris que sur une échelle inventée par un recalage défectueux. L'hypothèse n'est pas validée pour autant — le dézoom qu'elle prévient ne s'est pas présenté —, mais elle ne coûte rien et elle reste posée. Voir §7 |
| **La différence trouve ce qui s'ajoute et manque ce qui se substitue** | faible depuis C4 — la main ramène ce que la mesure n'a pas vu (451 pixels contre 1 044, mesuré) ; ce qui reste est que rien ne l'annonce d'avance | **mesuré le 29 août 2026**, sur les mêmes six planches : une hache est revenue en calque net, un casque en poussière. Une pièce qui occupe l'empreinte de ce qu'elle remplace relève de `touche`, et la tolérance au voisin de 3×3 — juste, elle protège du résidu de recalage — l'efface avec le bruit. La portée déclarée oppose *contenue* et *qui agrandit* ; ce qui décide ici est *ajoute* contre *substitue*, et les deux découpes ne se recouvrent pas. Non cadré : `docs/releve-usage.md` |
| ~~Le bon modèle pour une planche n'est pas le bon pour une édition~~ | — | **traité le 28 août 2026, pas seulement mesuré.** Un modèle recopie les traits du gabarit de découpe et rend la planche tramée, un autre l'ignore. Le projet porte donc **deux** défauts de modèle — planche, et édition d'un corps — sans que l'auteur ait à y penser. Passé en décision produit, ce n'est plus un risque ouvert |
| ~~Aucun fournisseur ne préserve l'identité~~ | — | **levé le 26 août 2026.** `gemini-3.1-flash-image` tient l'identité et la dérive entre deux poses enchaînées est quasi nulle. Seedream 4.5 échoue sur ce point mais excelle au transfert de style. |
| **L'échelle du sujet dérive d'une génération à l'autre** | moyenne — bloque le montage d'animations | constaté le 26 août. Corrigé par le recadrage et la normalisation d'échelle, qui passent donc de « confort » à **obligatoires** |
| ~~La couverture image d'OpenRouter~~ | — | **levé le 27 août 2026** par `essais/essai_couverture.py` : 48 modèles image, 11 fournisseurs, 31 acceptant trois références ou plus. Et le catalogue a bougé en un jour — 47 → 48 — ce qu'une liste en dur n'aurait pas vu |
| **Le coût par image dérive** | moyenne | enregistrer le coût réel de chaque génération dès la T1, et le totaliser par projet |
| ~~La qualité pixel art directe~~ | — | **levé le 27 août 2026** par `essais/essai_pixel.py`, sur 44 images de six modèles et sans un appel : aucune sortie brute n'a de transparence, la médiane est à 33 986 couleurs, et la grille rendue va de 7 à 20 px — facteur 2 **à l'intérieur d'un même lot**. Après traitement : 27 couleurs, alpha franc, grille imposée, 0 sujet perdu sur 44, 0,17 s par image. La question s'est retournée : le post-traitement n'est pas un supplément qui doit prouver son apport, c'est ce sans quoi rien n'est utilisable |

~~Le deuxième risque est le plus sournois~~ — il a été levé le 26 août, avant même
d'écrire la bibliothèque, exactement comme prévu ici. ~~Le sournois, désormais, c'est le
report d'un calque sur une autre pose~~ — **et celui-là n'a jamais existé.** Il a été écrit ici
le 28 août au matin par extrapolation, et retiré le soir même : reposer un casque de face sur
une pose de dos n'est pas un pari technique qui pourrait tenir, c'est une chose qui ne marche
pas et qu'aucun essai n'aurait sauvée.

**La leçon vaut mieux que le risque.** Ce faux risque est né d'une confusion entre *ce que
l'essai a mesuré* et *ce qu'on aurait aimé qu'il mesure* — l'essai prouvait l'extraction, on
en a déduit le report. La même séance a produit la même faute une seconde fois, dans la
conclusion imprimée de `essais/essai_silhouette.py` : une médiane sur trois pièces annonçait
que les six modèles tenaient les seuils, alors que la cape échouait sur les six. **Une moyenne
efface le seul cas qui décide.** Les deux sont corrigés ; ce qui reste à surveiller, c'est le
geste, pas le chiffre.

## 12 · Ce qu'on récupère

| Source | Pièce | Usage |
|---|---|---|
| GAG | `gag/domaine/direction.py` | extraction de palette, luminance, saturation |
| GAG | `gag/ports/`, `gag/adaptateurs/` | la forme du port fournisseur, allégée |
| GAG | AD-5, AD-9, AD-11, AD-28 | index jetable, post-traitement hors GPU, vocabulaire confiné |
| MySpriteAi | `src/lib/pixelPipeline.ts` | **porté en T2**. Les décisions dedans étaient durement acquises et elles sont reprises telles quelles : durcir l'alpha à 128 **avant** la réduction, et ne jamais forcer l'alpha à 255 en quantifiant — les deux moitiés du même liseré clair. Écarté au passage : le k-means++ de la palette, qui tire son initialisation au sort et rendrait deux images différentes pour une même recette nommée |
| MySpriteAi | `src/lib/audioPipeline.ts` | V5 |
| MySpriteAi | `workflows/audio/txt2sfx.api.json` | V5, si le local reste au menu |
| SpriteCook | captures `screen_spritecook/` | référence d'ergonomie, écran par écran |

## 13 · Hors périmètre, et pourquoi

| Écarté | Raison | Réversible ? |
|---|---|---|
| ComfyUI dans l'application | coût d'intégration élevé, bénéfice nul une fois le moteur passé en API | oui, derrière le port fournisseur |
| Contrôle de conformité automatique | l'auteur juge mieux et plus vite | oui, la palette mesurée est déjà là |
| Description du style par un modèle de vision | c'est de l'analyse d'image, écartée avec le reste | oui, le port existe dans GAG |
| UI Kit + éditeur 9-slice | 8 étapes, taxonomie, extraction — un produit à lui seul | oui, mais ce sera un chantier |
| Paquets moteur Unity / Godot | entre le ZIP et le paquet, il n'y a que du glisser-déposer | oui |
| Pack d'assets par genre | fabrique de la quantité — c'est le métier de GAG | non souhaitable |
| Comptes, crédits, distribution | outil personnel | non souhaitable |
| Génération non-pixel-art | V1 seulement ; rien ne doit l'interdire structurellement | prévu |
