# De la toile au sujet — la première planche d'un personnage

> Chantier ouvert le 22 septembre 2026, à la demande de l'auteur. Au début d'un jeu, il pose
> ses personnages sur la toile (texte, artwork, première version en pixel art), puis va au
> Codex créer le sujet — et là, **rien de la toile ne le suit** : la fenêtre « Créer un sujet »
> ne prend ni image ni carte. Il manque aussi l'étape qui passe d'un artwork à la planche des
> directions du jeu, celle d'où partent ensuite les poses et les animations.

## Ce qui existe (relevé du 22 septembre 2026)

- Une **carte de la toile** n'est pas un asset : son image est un fichier à part
  (`Carte.fichier`, `atelier/domaine/carte.py:117`). Le sens asset → carte existe
  (`services/univers.py`, `poser_asset`) ; le sens carte → asset n'existe pas.
- Une carte peut déjà être **le concept art** d'un sujet (`Personnage.concept_arts`, US-124,
  panneau de la carte « Concept art de »). Elle part alors en rôle `STYLE` — une inspiration,
  pas un modèle à recopier.
- **Créer un sujet** (`POST /characters`, `CreerUnAsset.tsx`) ne prend que nom, famille,
  description.
- Les **références promues** portent un usage — `libre`, `planche`, `direction:<id>`
  (`docs/PLAN-references-du-sujet.md`) — et une planche refaite se découpe à l'arrivée en ses
  vues (RS6–RS9). Mais **aucun chemin ne fabrique la première planche** : RS2 ne sait que
  reproduire une planche existante.
- La **planche d'une pose pliée par directions** (E13, `services/planche.py`) fabrique une
  pose dans toutes les directions du jeu en un appel, et la déplie toute seule dans les cases.
  C'est le bon moteur pour la première planche : la pose de repos, dans les directions du jeu.
- Les **directions du jeu** se lisent dans l'univers (`vue`, `directions`,
  `GET /characters/directions`).
- Le **portrait** d'un sujet se choisit sur sa fiche (`image_de_reference`, RP19, « Changer »
  sur le portrait). ~~Mais la carte du Codex ne le lit pas~~ — `base.vignettes_par_personnage`
  (`atelier/depot/base.py`) le lit désormais en premier, et retombe sur l'image la plus récente
  sans lui (TS1).

## Les décisions

1. **Le Codex montre le portrait.** La vignette d'un sujet est son `image_de_reference` si elle
   est choisie, sinon la règle d'aujourd'hui. Aucun nouveau champ : le choix existe déjà.
2. **Créer un sujet depuis une carte** : le panneau d'une carte image porte « Créer un sujet
   avec cette image ». Le sujet naît avec le nom de la carte, la famille de la carte si elle en
   a une, le texte de la carte voisine s'il y en a un (sinon vide). La carte devient son concept
   art ; son image est **copiée dans la bibliothèque** comme une image importée du sujet, et
   cette copie devient son portrait. Rien n'est promu en référence : la toile n'envoie rien de
   plus qu'aujourd'hui tant que l'auteur n'a pas fait la planche.
3. **La première planche** est la planche de la pose de repos, pliée par les directions du jeu
   (E13), lancée depuis la fiche d'un sujet qui n'a pas encore de planche : « Faire la planche
   des directions ». Le concept art y part **comme le personnage à reproduire** (rôle
   référence, décrit comme tel), et non plus comme une simple inspiration de style. Seules les
   directions du jeu sont demandées.
4. **On itère, puis on choisit.** Chaque tirage revient comme une planche du sujet. Sur l'une
   d'elles, « C'est la référence » la promeut en usage `planche` et range ses vues dans les
   directions. C'est d'elle que partent ensuite les autres poses et les animations.
5. **L'agent fait la même chose** par les mêmes services (*T7*).

## Les tranches

> Le modèle et le niveau de réflexion de chaque tranche : `docs/PLAN-de-la-toile-au-sujet-affectation.md`.

### TS1 · Le Codex montre le portrait

- [x] la vignette d'un sujet est son portrait choisi ; sans choix, rien ne change
- [x] choisir un autre portrait sur la fiche change la carte du Codex au retour
- [x] essais serveur et d'écran

**Tranché en TS1** : `vignettes_par_personnage` prend désormais les `Personnage`
entiers (plus une liste d'identifiants) pour lire `image_de_reference` sans
aller-retour de plus — un seul lot de lecture des portraits choisis, à côté du
lot déjà groupé pour la plus fraîche. Le repli suit exactement la règle de
`ServiceProduction.image_de_reference` (RP19) : un asset supprimé, devenu un
calque, ou rattaché à un autre sujet ne compte plus comme portrait. Aucun
changement d'écran n'a été nécessaire : `EcranFamille` se démonte entièrement
en quittant le Codex pour la page d'un sujet (rendu conditionnel dans
`App.tsx`), et remonte au retour — la grille relit donc déjà la route à chaque
retour, sans cache à percer.

### TS2 · Créer un sujet depuis une carte de la toile

- [x] une route crée le sujet depuis une carte : nom, famille, concept art, copie de l'image en
      asset du sujet, portrait posé
- [x] le panneau d'une carte image porte le bouton ; il ouvre la fenêtre « Créer un sujet »
      pré-remplie, l'image visible
- [x] une carte déjà concept art d'un sujet le dit et ouvre ce sujet au lieu d'en créer un second
- [x] la fenêtre « Créer un sujet » du Codex peut aussi partir d'une carte de la toile
- [x] essais sans appel payant

**Tranché en TS2** (serveur) : l'image de la carte entre **toujours** en bibliothèque comme une
copie neuve, importée pour le sujet et marquée de sa carte (`origine` dans la demande de sa
génération, modèle `import`) — un asset qui porte déjà les mêmes octets garde son histoire et
n'est ni rattaché ni déplacé. `POST /board/{carte}/subject` (`nom`, `description`, `famille`
facultatifs ; le nom par défaut est la première ligne de la note de la carte, puis le fichier
d'origine, puis « Sujet de la toile », suffixé s'il est pris ; la famille par défaut est celle
de la carte promue, sinon `personnages`). Une carte déjà concept art rend `200` avec
`deja: {identifiant, nom}` et ne crée rien — la forme du doublon au collage. L'écran le sait
avant de cliquer par les `concept_arts` de `GET /characters`. Service :
`atelier/services/sujet_depuis_carte.py` ; outil de l'agent : `create_character_from_card`.

**Tranché en TS2** (écran) : deux contextes React, `CREER_SUJET` et `OUVRIR_SUJET`
(`Tableau.tsx`), fournis par `Univers.tsx` — même geste que `DECOUPER`, pour que le panneau
d'une carte (grille et toile, un seul composant `Reglages`) porte le bouton sans qu'un prop
traverse quatre couches. La fenêtre « Créer un sujet » (`CreerUnAsset.tsx`) devient le seul
appelant de `creerSujetDepuisCarte` : une carte arrivée par `carteInitiale` (le panneau) ou
choisie via « Partir d'une image de la toile » (`cartesImages`, un pavé de vignettes, sans
recherche) suivent le même chemin de validation et la même réponse `deja`. Le nom et la
description proposés reprennent la première ligne de la note et son reste, à l'identique du
défaut serveur — l'auteur les corrige avant de valider, il ne les redemande pas.

### TS3 · La première planche

- [x] sur un sujet sans planche, « Faire la planche des directions » ouvre la préparation
      remplie : pose de repos, directions du jeu, concept art joint comme personnage à
      reproduire
- [x] le texte qui part décrit le concept art comme le design à reproduire, et ne demande que
      les directions du jeu (lisible dans *Relire avant l'envoi*)
- [x] « C'est la référence » sur une planche du sujet la promeut en `planche` et range ses vues
      (serveur ; le bouton reste à l'écran)
- [x] l'outil de génération de l'agent sait le même geste
- [ ] essais sans appel payant ; **un essai payé**, fait par l'auteur, sur un personnage de la
      toile

**Tranché en TS3** (serveur) :

- le drapeau s'appelle `premiere_planche` (`Demande`, écrit dans `generation.json` seulement
  s'il est vrai, relu à la relance) ; il passe par `POST /generations`, `/outgoing` et
  `/prompt/preview`. Le service remplit la pose et les directions
  (`ServiceGenerations.cases_de_premiere_planche`) : la pose `repos` si le sujet la tient, sinon
  la première de son plan ; les directions du jeu qu'il tient pour elle, dans l'ordre du jeu.
  Deux ou plus font la planche pliée d'E13 ; une, la case de cette direction ; aucune (jeu vu de
  face), la case de la pose. Données, elles doivent être exactement celles-là — sinon refus ;
- **le concept art part en référence seulement, jamais aussi en style** : une seule fois
  l'image, une seule place dans le plafond du modèle. Il se nomme `THE CHARACTER DESIGN TO
  REPRODUCE` (rôle à nommer `reference-design`, usage `design` sur la réinjection seulement) ;
- **la carte d'abord, le portrait à défaut** : la carte est ce que l'auteur a désigné, et depuis
  TS2 le portrait d'un sujet né d'une carte en est une copie à l'octet près — l'envoyer aussi
  ferait partir deux fois la même image. Ni l'un ni l'autre : refus avant de payer
  (« rien à reproduire ») ;
- le personnage à reproduire **est la demande**, comme le gabarit : il ne s'écarte à aucune
  portée et ne cède pas devant le plafond du modèle ; seules les références promues `libre`
  l'accompagnent (une planche déjà rangée décrirait un autre dessin) ;
- `GET /characters/{id}/first-sheet` dit ce que la planche demanderait (pose, directions,
  image), sans rien facturer ;
- « C'est la référence » : `PUT /characters/{id}/references/sheet` `{asset}`
  (`ServiceProduction.choisir_la_planche`). **Une seule planche à la fois** : les autres
  références `planche` du sujet sont dépromues, et restent en bibliothèque. L'ordre des vues est
  lu sur l'appel qui l'a faite — les cases d'une planche pliée, dans l'ordre de lecture (ses
  morceaux sont déjà dépliés dans leurs cases à l'arrivée), sinon l'ordre figé d'une planche
  refaite, sinon celui de la fiche ; les morceaux ne sont pas marqués favoris ;
- l'agent : `generate_pose(first_sheet=true)` (poses facultatives) et
  `choose_character_sheet(character, asset)` — pas « reference » dans le nom : RP19 veut
  qu'aucun outil n'ait l'air de choisir le portrait. Essais : `tests/test_ts3.py`.

**Tranché en TS3** (écran) :

- « Faire la planche des directions » vit dans le bloc *Planche* de *Ses références*
  (`SesReferencesParUsage`, `ImagesDuSujet.tsx`), à la place du texte « rien encore » — c'est le
  geste suivant d'un sujet qui n'a pas encore de planche, montré exactement là où la ligne
  apparaîtra une fois choisie ;
- une planche « première planche » se reconnaît par `generation.demande.premiere_planche`, lu sur
  la fiche de l'image (`Fiche.tsx`) — c'est le seul signe qu'elle sait lire sans redemander les
  usages du sujet, donc « C'est la référence » n'y paraît que sur celles-là ;
- le refus (409, « rien à reproduire ») remplace le bouton par la phrase du serveur et un lien
  « Aller à la toile › », dans le même bloc — il n'y a pas de second endroit où avertir.

### TS8 · Le sujet neuf dit quoi faire ensuite

*Ajoutée le 23 septembre 2026, au test de `TS3` par l'auteur* : « je ne trouve pas où on crée
cette planche… quand je crée le personnage j'arrive dans l'onglet Objectifs mais rien ne me dit
ce que je dois faire. » Le bouton de `TS3` existe, mais il est enterré : onglet **Images**,
tout en bas, section *Ses références*, bloc *Planche*, à la place de « rien encore ». Un sujet
créé depuis la toile s'ouvre ailleurs, sur un onglet qui ne propose rien.

- [x] un sujet qui vient d'être créé s'ouvre sur **son prochain geste**, pas sur un onglet de
      réglages : pour un personnage avec un concept art et sans planche, c'est « Faire la planche
      des directions », en grand, en haut, avec l'image qui servira à côté
- [x] tant que le sujet n'a pas de planche, ce geste reste visible en tête de la page du sujet,
      quel que soit l'onglet ouvert — pas seulement dans le bloc *Planche* en bas des Images
- [x] une fois la planche revenue, la même place propose « C'est la référence » sur elle, puis le
      geste suivant (les poses, les animations)
- [x] l'onglet Objectifs, ouvert seul, dit en une ligne à quoi il sert et renvoie au prochain
      geste
- [x] à régler avec `RV15` (*un nouveau sujet s'ouvre sur ses images, avec « Fabriquer sa
      première image »*) : une seule règle d'arrivée pour tout sujet neuf, pas deux

*Fait le 23 septembre 2026.* Un nouveau composant, `interface/src/composants/ProchainGeste.tsx`,
monté en tête de `PageDuSujet.tsx` — juste sous l'en-tête, avant la fiche et les onglets — donc
visible quel que soit l'onglet ouvert. **La règle tient en quatre cas, lus sur ce que le sujet a
déjà, jamais sur la façon dont il est né** : rien nulle part → « Fabriquer sa première image »
(la même règle que `RV15`, qui ouvre déjà le sujet neuf sur l'onglet *Images* — le bandeau y
apparaît donc dès l'arrivée, sans second geste) ; un concept art (ou un portrait) et une image
déjà posée mais aucune planche choisie → « C'est la référence », montrée directement avec la
vignette de la candidate ; un concept art et rien de posé encore → « Faire la planche des
directions » (`TS3`), avec la vignette du concept art à côté ; une planche déjà choisie → le
bandeau n'a plus rien à imposer et se tait. **Tranché** : « le geste suivant » du troisième
critère (poses, animations) reste le bouton *Fabriquer…* déjà en tête de la page, qui les
propose un à un depuis toujours — un second bouton à côté aurait dit deux fois la même chose,
et rien dans ce chantier ne change ce que ce bouton sait déjà faire. La candidate de la
seconde règle est « la retenue, sinon la plus récente », toutes cases confondues : une planche
vaut aussi pour un jeu à une seule vue (`TS3`, décision 3), donc même une image seule en est une
valable, et la choisir passe avant d'en redemander une pour ne pas payer deux fois le même appel.
« Faire la planche » et « C'est la référence » appellent les mêmes routes que le bloc *Planche*
de `ImagesDuSujet.tsx` (`api.premierePlanche`, `api.choisirLaPlanche`) — la même résolution,
montrée à deux endroits, jamais réécrite ; le bloc du bas continue de servir qui reste sur
l'onglet *Images*, et les deux relisent le même sujet. Pour l'onglet Objectifs : il n'existe
plus comme onglet depuis `RV12` (dissous dans « Modifier la fiche »), donc « ouvert seul » ne se
pose plus tout à fait de la même façon ; `ObjectifDuSujet.tsx` porte désormais une ligne de plus
sous son intitulé (« Le prochain geste, s'il y en a un, reste en tête de sa page »), qui renvoie
sans lien cliquable — fermer le dialogue suffit, le bandeau est déjà là. Essais :
`interface/src/composants/PageDuSujet.test.tsx` (5 essais neufs, les quatre cas plus la
persistance entre onglets), suite complète de l'interface 2 791/2 806 verts (les 12 échecs
restants sont tous connus d'avance — 9 `SonStyleDeCombat`, 2 « mémoire libre » d'un modèle
local, 1 hors de ce fichier — et non touchés). `tsc --noEmit` propre, `essai_vocabulaire.py`,
`essai_jetons.py`, `essai_tutoiement.py`, `essai_imports.py` et `essai_docs.py` verts (les
écarts jetons/Retouche.tsx restants sont connus d'avance). Non vérifié au navigateur : pas
d'`interface/dist` dans le worktree (`AGENTS.md`).

*Corrigé le 24 septembre 2026 après relecture.* Deux défauts. **« C'est la référence » proposait
une vue** : après une première planche, les cases ne portent que ses vues, la feuille entière n'en
a aucune — une vue était promue en planche du sujet, sans ordre de vues. La candidate est
désormais la feuille : `idDeLaCandidate` fait passer les vues d'une planche devant les images
isolées et propose leur `planche` (une image isolée reste valable sans vue, `TS3` décision 3).
Tranché : **les deux côtés**, parce qu'un seul ne suffisait pas — la feuille ne tombe plus non plus
dans « Pas encore rangé » (`en_attente`, `production.py`) tant qu'une de ses vues est rangée, la
règle des clips dont on a tiré des bandes ; elle n'y était proposée à « Écarter » et
« Supprimer » que comme une image perdue. Sortie de ses cases, elle y revient. **« Rien encore »
à un sujet qui a des images** : le bandeau compte maintenant aussi ce qui attend d'être rangé
(même route que « Pas encore rangé »), et se tait. Essais : `tests/test_ts8_planche_candidate.py`
et deux essais neufs dans `PageDuSujet.test.tsx`, chacun vérifié en défaisant le correctif.

### TS11 · La première planche d'un sujet dont le concept art est une carte

*Défaut vu par l'auteur le 23 septembre 2026, en préparant l'essai payé de `TS3` sur Elias* :
« Faire la planche des directions » (bandeau de `TS8`) ouvre la préparation ; la référence
jointe — le concept art d'Elias, **une carte de la toile** (`9c09adf6b8d745ac`) — s'affiche
cassée : l'écran demande `/api/assets/9c09adf6b8d745ac/image` (404) alors que l'image de la
carte se sert à `/api/board/9c09adf6b8d745ac/image`. Le pied dit aussi « aucun prompt » et
« Relire avant l'envoi » reste grisé, alors qu'Elias a une description. `TS3` avait été essayé
sur un sujet né par `TS2`, dont le concept art est une **copie en asset** ; un concept art posé
comme carte seule n'a jamais été essayé. Bloque l'essai payé de `TS3`.

- [x] la référence d'un concept art qui est une carte part et s'affiche comme une carte (image de
      la carte, rôle référence) — dans la préparation, dans « Relire avant l'envoi » et dans ce
      qui part au modèle ; ou bien elle est copiée en asset du sujet au premier geste, comme `TS2`
      — choisir, et le dire ici
- [x] le texte de la demande est rempli par le geste (le signalement du sujet, et ce que `TS3`
      ajoute) ; « Relire avant l'envoi » est actif
- [x] le même chemin tient depuis le bandeau de `TS8` **et** depuis le bloc *Planche* de l'onglet
      Images
- [x] un essai part d'un sujet dont le concept art est une carte **non copiée**, et tombe sans le
      correctif

*Fait le 23 septembre 2026.* **Trois défauts, pas un.** (1) *À l'écran* : `armerPremierePlanche`
(`gestes.ts`) — seul point de passage des deux portes, bandeau et bloc *Planche* — recopiait le
design de `first-sheet` sans son `origine` ; la carte devenait un asset, d'où l'image demandée à
`/api/assets/…` (404). La route et le service rendaient bien `origine: "carte"` : la marque se
perdait là, et nulle part ailleurs. (2) *Le texte vide* : le même geste posait `setPrompt("")`
alors que sa provenance annonçait « d'après son signalement » — et le serveur refuse un appel sans
texte. Il demande maintenant le signalement à `POST /characters/subject`, comme `armer` pour toute
case. (3) *Ce qui partait au modèle, vu au serveur* : même avec l'origine, la copie de l'écran
passait devant la réinjection du service au dédoublonnage (première occurrence gardée) et perdait
l'usage `design` — plus de « THE CHARACTER DESIGN TO REPRODUCE », une ligne « carte de la toile ».
Sans l'origine, c'était pire : un asset introuvable plus la carte. Le défaut touchait donc **aussi**
les sujets nés de `TS2` (leur concept art est la carte, pas sa copie) ; `TS3` ne l'avait pas vu
parce que ses essais serveur n'envoyaient jamais ce que l'écran joint. Réparé par
`_sans_le_design` (`services/generation.py`) : la réinjection du service fait foi, à la
soumission comme dans le compte de la relecture. Et une carte à reproduire devenue illisible
**arrête** l'appel au lieu d'être sautée comme un artwork. **Tranché : la carte part comme
carte**, sans copie au premier geste — c'est déjà la règle de `TS3` (« la carte d'abord »), le
tuyau sait lire une carte depuis `T4`, et `first-sheet` est une lecture gratuite qui ne doit rien
écrire en bibliothèque ; copier aurait fait naître un asset à chaque préparation abandonnée.
Essais : `tests/test_ts11.py` (4, dont 3 tombent sans le correctif serveur), deux essais
d'`App.test.tsx` (bandeau et bloc *Planche*, tombent sans le correctif d'écran sur
`/api/assets/…?brut=false`, l'adresse même du journal de l'auteur), `gestes-preparation.test.tsx` mis à jour.
Vu au navigateur sur un atelier jetable (Elias, carte non copiée) : image de la carte chargée,
champ rempli, « Relire avant l'envoi » actif depuis les deux portes, relecture « concept art ·
personnage à reproduire » avec le texte `DESIGN` — aucun envoi lancé. Reste : le grisé de
`GET /models` ne connaît pas `premiere_planche` (il compte la carte comme une image jointe, ce
qui tombe juste en nombre) ; l'essai payé de `TS3` peut maintenant se faire.

*Corrigé le 24 septembre 2026 après relecture.* Le reste ci-dessus est tenu : `GET /models`
prend `premiere_planche`, compte le concept art comme le personnage à reproduire — il ne cède
pas — et grise d'avance un modèle sans image d'entrée avec sa raison (« n'accepte aucune image
de référence »). Les images que l'écran joint et qui sont ce concept art ne se comptent qu'une
fois, comme `_sans_le_design` à l'envoi (avant, le total en comptait deux). L'écran passe le
drapeau depuis la cible armée (`App.tsx`). Le 409 à l'envoi reste le filet. Essais : deux de
`tests/test_ts11.py`, et les deux de TS11 d'`App.test.tsx` vérifient que la liste est demandée
avec le drapeau — tous tombent sans le correctif. L'outil MCP n'a pas été touché.

### TS12 · Les palettes de la toile servent à la retouche et au sujet

*Demandé par l'auteur le 23 septembre 2026*, dans l'atelier d'une animation (Mara, marche ·
droite, table « Couleurs », section Quantification) : « couleurs de » ne propose que **le jeu**
ou **l'image** ; les palettes nommées qu'il fabrique sur la toile (un paquet → « Faire une
palette », `Toile.tsx`, `Palette` dans `atelier/domaine/ambiance.py`) n'y sont pas. Et « Modifier
la fiche » d'un sujet ne permet pas de lui donner une palette par défaut, comme on lui donne
une recette.

- [x] la quantification propose **le jeu**, **l'image**, et **chaque palette nommée du jeu**,
      montrée avec ses pastilles ; choisir une palette réduit l'image à ses couleurs
- [x] **déterminisme** (règle durable d'AGENTS.md) : une recette qui nomme une palette garde
      **la copie de ses couleurs** au moment du choix ; si la palette change ensuite sur la
      toile, la recette rend toujours la même image, et l'écran dit « la palette X a changé
      depuis » avec un geste pour reprendre ses nouvelles couleurs
- [x] « Modifier la fiche » d'un sujet porte **« Palette par défaut »** (aucune, ou une palette
      nommée) ; les images qui arrivent ensuite pour ce sujet sont quantifiées avec elle ; celles
      déjà faites ne bougent pas (*traitement non destructif*) tant qu'on ne réapplique pas
- [x] l'agent (MCP) lit et pose la palette d'un sujet par le même service (*T7*)
- [x] une palette supprimée de la toile ne casse aucune recette (la copie des couleurs reste) ;
      le sujet qui la portait par défaut retombe sur « aucune », et sa fiche le dit

*Fait le 23 septembre 2026.* **La décision** est écrite en tête de `atelier/domaine/recette.py` :
la quantification garde la copie des couleurs (`palette`, comme pour le jeu depuis T2) plus
`palette_nommee` et `palette_nom`, qui ne servent qu'à la relire. Les deux clés ne s'écrivent
que remplies et **sortent de l'empreinte** (comme le nom d'une recette) : aucune recette
existante ne change de rendu ni de nom de cache — pas de prix à écrire dans AGENTS.md. Le
sujet garde un **renvoi** (`palette`, comme `recette` en RS6) ; ses images prennent la copie à
leur naissance, par-dessus sa recette ou celle du jeu (image seule et morceaux d'une planche
refaite ; pas la feuille, pas un lot plié, pas une image brute de la toile). Tranché en
route : (1) une palette supprimée **vide** le renvoi et laisse son nom dans
`palette_supprimee`, que la fiche dit — garder l'identifiant aurait fait prendre au sujet une
palette neuve du même nom, qui reprend le même identifiant ; (2) « Tout réaligner » sur le
projet **laisse** une quantification qui nomme une palette ; demandé pour une image, il la
remet sur le jeu et efface la provenance ; (3) l'agent : `set_character_objective` gagne
`palette` (identifiant ou nom, `""` retire, `objective` devient facultatif) et
`list_characters` la lit — pas d'outil neuf. La table « Couleurs » lit les palettes elle-même
(`/moods`), donc l'atelier d'une animation les reçoit sans rien de plus. **Vu au navigateur**
sur un atelier jetable (8429) : la liste et ses pastilles dans la table d'une image,
l'enregistrement, « a changé depuis » après une retouche de la palette, la fiche refermée et
rouverte, la notice après suppression. **Pas vu** : l'atelier d'une animation lui-même (même
composant, non ouvert faute de bande dans l'atelier jetable). Reste : les couleurs copiées à
la naissance sont celles gardées dans le fichier du projet, recalculées chaque fois que les
palettes sont lues — une palette dont une source a changé sans que personne ne l'ait relue
donnerait sa lecture précédente.

*Corrigé le 24 septembre 2026 après relecture.* « Chaque nouvelle image » tenait mal : les
vues dépliées d'une planche (première planche, planche de poses, corps habillés d'une planche
d'équipement) naissaient sans la palette du sujet. Elles la reçoivent maintenant, par la même
copie, posée sur la recette du jeu pour un morceau de planche (`recette_d_une_vue_depliee`) —
le sujet est celui de **la case**, donc chaque vue d'une planche à plusieurs sujets prend la
palette du sien. La feuille garde sa recette vide ; un calque d'équipement garde sa différence.
Sans palette au sujet, rien ne change (essai). La fiche (`impose`) lit la même chose. Essais :
deux de `tests/test_ts12.py`, dont un qui referme l'atelier, le rouvre et relit chaque vue
après une retouche de la palette — il tombe sans le correctif.

## La toile qui fabrique — façon Mixboard

*Ajouté le 23 septembre 2026, sur les retours de l'auteur au premier usage.* La barre
« Fabriquer » en bas de la toile existe depuis le 22 septembre (commits `793ccae`, `0eed66f`) :
une phrase, 1, 2 ou 3 versions, un modèle, et le bouton qui annonce le prix ou le temps ; des
fantômes se posent pendant la fabrication ; la sélection de la toile part en référence
(« à partir de 1 image »). **Ce que l'usage a montré** : on ne choisit pas la taille, on perd
le texte d'une image une fois faite, et prendre une carte en référence n'est pas un geste
visible — il faut savoir que la sélection compte. L'auteur demande de se rapprocher de
Mixboard : la toile est l'endroit où l'on essaie, et chaque image garde de quoi repartir.

### TS4 · L'image arrive brute, en 512 ou 1024 — **à faire en premier**

L'auteur, le 23 septembre : la barre sort « des merdouilles en 64 px ». La carte l'affiche
(« 64×64 posée ») : l'image ne revient pas brute. **Cause probable, à confirmer en lisant le
chemin** : la barre envoie la demande comme une image du jeu (`repris: false`), donc le serveur
enveloppe la phrase de l'univers du jeu et applique au retour la recette du jeu, dont la
réduction à sa taille de sprite. **Décidé par l'auteur** : la toile est l'endroit où l'on
essaie ; ce qui en sort n'est pas encore un asset du jeu.

- [x] une image fabriquée depuis la toile arrive **brute** : aucune recette appliquée — ni
      détourage, ni réduction, ni grille, ni palette. La carte montre la taille reçue
- [x] la barre propose **512 et 1024**, 512 par défaut ; une taille que le modèle choisi ne sait
      pas faire est grisée avec sa raison (*le catalogue décide*)
- [x] le texte qui part est **celui que l'auteur a tapé**, sans le style du jeu ajouté d'office
      — à trancher avec l'auteur : une case « avec le style du jeu », décochée par défaut ?
- [x] ce qui part se relit depuis la barre avant de cliquer (le texte exact, la taille, les
      références), comme partout ailleurs
- [x] le bouton annonce le temps ou le prix **pour la taille choisie** tant qu'aucun tirage n'a
      réussi ici, sur la vitesse déclarée du style, qui distingue déjà 512 et 1024 ; une fois
      mesuré sur cette machine, il dit une **moyenne toutes tailles**, faute pour la file locale
      de garder la taille de chaque tirage — dit en clair, jamais laissé deviner *(critère réécrit
      le 24 septembre 2026 après relecture, voir plus bas)*
- [x] le choix est retenu d'une fabrication à l'autre, comme le modèle et le nombre
- [x] une image de la toile qu'on fait entrer dans un sujet (TS2) reçoit alors la recette du jeu,
      comme une image importée — l'image brute reste gardée (*traitement non destructif*)

*Fait le 23 septembre 2026.* Cause confirmée : deux défauts, pas un. La barre envoyait bien
`repris: false` (la bible et les consignes de planche du jeu se repliaient dans le texte), et
surtout aucune génération de la toile ne portait de drapeau disant « ne traite pas » — la
naissance de l'asset appliquait donc la recette du projet (grille à 64) comme n'importe quelle
génération ordinaire. Réparé par un drapeau `brut` sur `Demande` (même famille que
`premiere_planche` : absent du `generation.json` tant qu'il n'est pas vrai), lu à trois endroits
de `ServiceAssets` (`impose`, `recette_du_projet`, `recette_du_sujet`) qui savaient déjà lire
`traiter=False` pour un import « telle quelle ». Le texte suit sa propre règle, `repris` — la
case « avec le style du jeu », décochée par défaut, la bascule ; `brut`, lui, ne se décoche
jamais depuis la toile. Tranché : le prix d'un appel ne dépend pas de la taille (point 8
d'AGENTS.md), donc seul le temps d'un modèle local varie avec elle — un modèle payant annonce le
même prix aux deux tailles. `sujet_depuis_carte.py` passe maintenant `traiter=True` à l'import :
promouvoir une carte en concept art d'un sujet est le geste qui la fait entrer dans le jeu, à la
différence d'un import générique (US-170) qui ne sait pas encore ce que l'auteur en fera — trois
essais de `test_ts2.py` attendaient l'ancien comportement et ont été corrigés pour vérifier le
brut (`octets(asset, brut=True)`) plutôt que le rendu. « Ce qui part » réutilise `api.envoi`
(`/outgoing`) tel quel, replié sous un bouton, fermé par défaut. Non vérifié au navigateur : la
tranche a été vérifiée par essais seulement (`ToileFabrique.test.tsx`, `test_ts4.py`,
`test_ts2.py`), pas par une session d'usage.

*Corrigé le 24 septembre 2026 après relecture.* Le troisième critère n'était tenu que pour le
texte : case « avec le style du jeu » décochée, un artwork marqué « tous » partait encore en
image. Désormais `brut` et `repris` ensemble (`sans_le_style_du_jeu`, `generation.py`) retirent
l'ambiance et les artworks, à la soumission, à l'aperçu et dans le compte de « Ce qui part » — une
seule fonction pour les trois. Case cochée, ou hors de la toile, rien ne change : `repris` seul ne
touche toujours que le texte (R2). `/outgoing` et `/prompt/preview` reçoivent `brut` pour le dire.
La relecture « Ce qui part » de la barre (`RepliCeQuiPart`, `ToileFabrique.tsx`) envoie
`brut: true` à `api.envoi`, et `ToileFabrique.test.tsx` le vérifie. Essais : `tests/test_ts4_artworks.py` (sept, dont trois qui
vérifient que les autres chemins ne bougent pas), vérifié en défaisant le correctif.

**Corrigé le 24 septembre 2026 après relecture.** Le critère du temps par taille ne tenait
qu'à moitié : `ToileFabrique.tsx` (`annonce`) mesurait bien « 12 s en 512, 16 s en 1024 » quand
aucun tirage n'avait encore réussi (la vitesse déclarée du style, coupée à la bonne clause), mais
une fois `temps.secondes` mesuré sur cette machine, c'était la médiane de *tous* les tirages, 512
et 1024 confondus (`atelier/services/file_locale.py`, `mesures()` ne groupe pas par taille) — le
bouton annonçait alors un chiffre qui semblait tenir la taille choisie sans la tenir. Réparé côté
bouton, pas côté serveur (`atelier/services/generation.py`, où vit la mesure, était hors de cette
tranche) : `annonce` ajoute « , moyenne toutes tailles » au temps mesuré, pour dire ce qu'il est
plutôt que de laisser deviner. Mesurer réellement par taille reste à faire côté serveur, à
part.

### TS5 · Le texte d'une image reste sur sa carte

- [x] une carte fabriquée depuis la toile montre sa phrase (repliée si elle est longue)
- [x] un geste « Reprendre ce texte » remet la phrase dans la barre, avec le modèle et la taille
      d'origine, pour la corriger et relancer
- [x] une image fabriquée ailleurs et posée sur la toile montre aussi son texte, s'il existe

*Fait le 23 septembre 2026.* Le point dur était exactement celui annoncé : la phrase vit sur la
génération (`generation.json`, `demande`), pas sur la carte. Trouvé en lisant
`ServiceGenerations.soumettre` : `demande.sujet` porte déjà le texte de l'auteur, gardé à part
*avant* que la bible et les consignes de planche ne le noient dans `demande.prompt` — un champ
existant depuis le 1ᵉʳ septembre 2026, pour nommer l'asset, et qui se trouve être exactement ce
qu'il fallait ici. Rien à changer côté génération. Ajouté : `ServiceUnivers.phrase_de_carte`, qui
remonte le fil `carte.source` (`asset:<id>`) → `Asset.generation` → `Generation.demande`, et
`GET /board` l'appelle une fois par carte **dans sa propre boucle serveur** — c'est bien la seule
lecture que fait la toile, aucune route n'est ajoutée, aucun aller-retour de plus depuis l'écran.
Tranché : le tri « reprendre exactement » l'emporte sur le tri « la lettre du plan » — la case
« avec le style du jeu » (donc `repris`) revient elle aussi avec la phrase, alors que les trois
critères ne nomment que le modèle et la taille ; sans elle, reprendre une phrase composée avec le
style du jeu relançait un appel qui n'aurait plus eu le même texte. Densité de la carte respectée
(AGENTS.md, `docs/design-motifs.md` § Le menu d'une carte) : la phrase et « Reprendre ce texte »
vivent dans le menu au survol, à côté d'Îlot/Note, jamais sur la face visible — `line-clamp-3`
fait le repli. Une ligne de guide ajoutée (`carte.phrase`, `interface/src/aide.ts`). Non vérifié
au navigateur : vérifié par essais serveur (`tests/test_ts5.py`) et écran
(`Tableau.test.tsx`, `ToileFabrique.test.tsx`).

### TS9 · Les deux défauts vus au premier usage de TS4 et TS5

*Ajoutée le 23 septembre 2026, sur deux retours de l'auteur au navigateur.*

1. **« 2 » ou « 3 » versions ne font qu'une image avec le modèle local.** La barre borne en
   silence le nombre au plafond du modèle (`Math.min(versions, modele.variations_max)` dans
   `ToileFabrique.tsx`), et un style local déclare une variation par appel. Le bouton annonce
   pourtant trois images, et trois fantômes ne se posent pas.
2. **La phrase et « Reprendre ce texte » n'apparaissent sur une carte fabriquée qu'après un
   rechargement de la page.** La phrase n'arrive qu'avec la lecture complète de la toile ; la
   carte posée à l'arrivée ne la porte pas.

- [x] demander N versions à un modèle qui n'en fait qu'une par appel lance **N appels** (ou
      autant qu'il en faut au plafond du modèle), et pose N fantômes ; le bouton annonce le bon
      prix (payant : prix d'un appel × nombre d'appels, point 8) ou le temps (local : non
      multiplié, 8ter) ; un échec d'un des appels n'efface pas les autres
- [x] une carte fabriquée depuis la barre montre sa phrase et « Reprendre ce texte » **dès qu'elle
      est posée**, sans recharger — la lecture qui la pose porte la phrase, ou la toile relit ses
      cartes à l'arrivée
- [x] un essai d'écran pour chacun, qui **tombe en défaisant le correctif** (8octies)

*Fait le 23 septembre 2026.* Deux corrections indépendantes. **Défaut 1** : le plafond
(`Math.min(versions, variations_max)`) est retiré de `BarreDeFabrication` — le nombre voulu
(`n`) part désormais entier, jamais rogné. Le découpage en appels vit dans
`useFabricationSurToile.lancer` (`ToileFabrique.tsx`) : `places` porte désormais **toutes** les
images voulues, coupées en lots d'au plus `variations_max`, un lot par appel — décidé **l'un
après l'autre** (pas en parallèle) plutôt qu'en même temps : la file ComfyUI d'un modèle local
sérialise de toute façon les appels simultanés, et suivre un appel avant de lancer le suivant est
le plus simple à lire sans rien perdre ; un échec n'empêche pas les suivants, chaque appel gardant
son propre lot de fantômes et son propre suivi. Conséquence sur le prix : `annonce()` ne
multiplie plus par le nombre d'images mais par le nombre d'**appels** (point 8) — trois versions
qu'un seul appel rend ne payaient déjà qu'une fois avant TS9 en apparence, mais seulement parce
que le plafond rognait `n` à 1 ; le prix affiché était donc juste par accident dans ce cas précis
et faux dès que `variations_max` dépassait 1 avec plus de versions demandées que le plafond ne
pouvait honorer en un coup — corrigé du même geste. **Défaut 2** : `ServiceUnivers._sauver`, le
seul point d'écriture d'une carte, joint désormais `phrase_de_carte(carte)` à l'évènement `carte`
qu'il publie — la même forme que ce que `/board` calcule déjà. C'est cet évènement, et non la
réponse du `POST` qui pose l'image, que `ToileFabrique.poser` laisse faire apparaître la carte à
l'écran (`flux.ts`) ; corriger la réponse du `POST` n'aurait rien changé, puisque rien ne la lit.
Essais : `tests/test_ts9.py` (deux essais serveur, vérifiés en retirant le correctif — la charge
de l'évènement lève alors `KeyError: 'phrase'`) ; `ToileFabrique.test.tsx` (trois essais TS9 —
N appels, échec isolé, prix par appel — vérifiés de même). **Trouvé sur l'état intégré, une fois
les autres tranches du jour fusionnées** : `tests/test_u9.py::
test_lobjet_montre_est_celui_des_autres_ecrans` cassait, parce que `atelier/services/montre.py`
(l'écran de confirmation et la fiche d'une chose) construisait sa carte à la main
(`univers.carte(...).en_json()`), sans passer par `phrase_de_carte` — la phrase que `_sauver` et
`/board` joignent depuis ce même correctif. Choisi : **la forme, pas l'essai** — `montre.py`
appelle désormais `phrase_de_carte` lui aussi, pour la raison que ce fichier porte déjà en
toutes lettres depuis U9/R8 (« deux réponses écrites à deux endroits auraient fini par rendre
deux formes différentes du même objet ») : la phrase est une information légitime de plus sur
une carte, et les trois écrans qui en montrent une (la toile, l'écran de confirmation, la fiche
d'une chose) doivent la montrer pareil, pas deux sur trois. Le test n'a pas bougé — c'est lui qui
a trouvé le vrai défaut. Non vérifié au navigateur : vérifié par essais seulement.

### TS10 · « Développer ce sujet »

*Demandée par l'auteur le 23 septembre 2026*, à côté de « Reprendre ce texte » : un geste qui
part **d'une image** au lieu de son texte. C'est le « Modifier » de `TS7`, choisi par l'auteur ;
le reste de `TS7` attend toujours son tri.

- [x] le menu d'une carte image porte **« Développer ce sujet »**, à côté de « Reprendre ce
      texte » (et sur toute carte image, pas seulement celles fabriquées par la barre)
- [x] le geste met l'image **en référence** dans la barre (la liste de `TS6`, avec sa vignette et
      sa croix) et place le curseur dans le champ, **vide**, avec un exemple en gris qui dit quoi
      écrire : « une variante plus sombre », « la même de dos », « sans la cape »…
- [x] ce qui part dit au modèle de **partir de cette image** (rôle d'édition, comme la
      référence d'une carte en `TS6`) et d'appliquer la demande ; « Ce qui part » (`TS4`) le
      montre avant de cliquer
- [x] le résultat se pose **à côté de l'image d'origine**, reliée à elle par un lien de la toile,
      pour qu'on voie d'où il vient
- [x] plusieurs versions (`TS9`) marchent de même : N variantes de la même image

*Fait le 23 septembre 2026.* Aucune route neuve : le geste recompose entièrement des chemins qui
existaient déjà — `prises` (`TS6`), le drapeau `brut` et le rôle `edition` (`TS4`), le découpage en
appels (`TS9`), `api.lier`/`/board/links` (`T9`). « Développer ce sujet » (`DEVELOPPER`, contexte de
`Tableau.tsx`, à côté de `PRENDRE_REFERENCE`) remplace `prises` par **la seule** carte cliquée — une
décision : mélanger le développement avec d'anciennes références prises aurait rendu ambigu ce que le
lien final doit désigner — et retient son identifiant à part (`origineDeveloppement`), parce que
`prises` peut encore changer (une croix) entre le clic sur « Développer » et le clic sur « Fabriquer ».
`origineDeLiaison` (`ToileFabrique.tsx`, fonction pure) revérifie cette appartenance **au moment du
lancement**, pas au clic sur « Développer » : retirer la vignette entre les deux annule la liaison
comme elle annule déjà la référence. Le champ vide et l'exemple grisé suivent le motif de `Reprise`
(TS5) — une `cle` qui change à chaque clic, portée par un nouveau type `Developpement` — avec trois
amorces tirées au hasard (`EXEMPLES_DEVELOPPEMENT`). Le lien se tire **après la pose**, dans
`useFabricationSurToile.poser` (`ToileFabrique.tsx`) qui reçoit désormais un paramètre `lier`, pour
qu'il appelle **la même fonction que l'écran** (`tirer`, remontée dans `Toile.tsx` avant le crochet de
fabrication pour rester utilisable par lui) — un trait tiré à la main et un trait tiré par une
fabrication empruntent donc la même route, y compris pour l'annulation (`pile`). Un échec de la
liaison ne défait pas la pose : l'image posée reste, elle n'a rien coûté de plus à garder sans son
lien. `Fantome` porte un champ `origines?: string[]` — au pluriel, pas pour ce chantier-ci mais pour
que `TS7` (« Combiner », plusieurs cartes vers un seul résultat) puisse le remplir sans retoucher la
mécanique de pose. Le placement « à côté de l'image d'origine » n'a rien demandé de neuf : `fabriquer`
(`Toile.tsx`) pose déjà ses fantômes à droite des références présentes sur le plan (TS6/TS9), et
l'image en développement en fait partie dès qu'elle y est. Essais : `ToileFabrique.test.tsx` (le champ
qui se vide avec l'exemple, la reliaison au retour, N versions reliées à la même origine, une
fabrication ordinaire qui ne tire aucun lien — vérifiée en retirant l'appel à `lier` dans `poser`,
8octies), `Toile.test.tsx` (`origineDeLiaison`, dont le cas de la croix retirée entre les deux clics),
`Tableau.test.tsx` (le bouton sur toute carte image, absent sur une note ou une image pas encore
arrivée, absent hors toile). Non vérifié au navigateur : pas d'`interface/dist` dans ce worktree
(`AGENTS.md`).

### TS6 · Prendre une carte comme référence

- [x] chaque carte image porte un bouton visible « Prendre comme référence » (sur la carte ou
      dans son panneau) ; les références prises apparaissent en vignettes au-dessus de la barre,
      chacune avec sa croix
- [x] la sélection de la toile ne décide plus seule en silence : ce qui part se lit dans la barre
      avant de cliquer
- [x] le plafond d'images du modèle s'applique comme ailleurs (*point 4* : ce que l'auteur a joint
      ne cède pas — la barre le dit au lieu de lancer)

*Fait le 23 septembre 2026.* Tranché : « la sélection propose, le bouton prend » — choisir des
cartes sur la toile (Ctrl+clic, cadre) ne remplit plus la barre en silence. L'ancien « Varier »
du menu d'une carte devient « Prendre comme référence » (ou « Retirer des références » quand
elle y est déjà) : une bascule qui accumule plutôt qu'un remplacement à une seule carte. La
liste explicite (`prises`, dans `Toile.tsx`) est la seule source des références de la barre —
`referencesDeLaToile` (qui combinait sélection, carte choisie et « variee ») devient
`referencesPrises`, qui ne lit plus que cette liste. Chaque référence paraît en vignette
(`api.imageCarte`, 34 px, le cran des hauteurs de contrôle) avec sa propre croix — retirer l'une
ne touche pas les autres. Le plafond (`Modele.references_max`) est vérifié côté client
(`refusDesReferences`, pure) : au-delà, le bouton se désactive et affiche la raison au lieu du
prix, sans jamais rogner la liste pour faire tenir l'appel. Lancer une fabrication vide la liste
des références prises, comme un brouillon envoyé. Non vérifié au navigateur — vérifié par essais
seulement (`ToileFabrique.test.tsx`, `Toile.test.tsx`, `Tableau.test.tsx`, `App.test.tsx`).

### TS7 · Les gestes de Mixboard

**Triés par l'auteur le 23 septembre 2026 : les trois restants sont retenus.** « Modifier » est
devenu `TS10` (« Développer ce sujet »). À faire après `TS10`, dont `TS7` reprend la pose reliée.

- [x] plusieurs cartes image choisies : « Combiner » — une phrase, les cartes en référence, le
      résultat posé entre elles
- [x] « Encore » sur une carte fabriquée : la même demande (phrase, modèle, taille, références,
      case « style du jeu ») repart sans rien retaper, le résultat posé à côté de l'original
- [x] le lien entre une image fabriquée et celles qui ont servi de référence est visible sur la
      toile (un trait de la toile, comme les liens existants), pour toute fabrication de la barre

*Fait le 23 septembre 2026.* **Le lien visible porte les deux autres gestes** : `originesReliees`
(`Toile.tsx`) remplace l'usage de `origineDeLiaison` (TS10) dans `fabriquer` par une union —
toutes les références qui partent avec l'appel, plus l'origine d'un développement, plus la carte
qu'« Encore » relance sans la réinjecter comme référence. TS10 ne reliait qu'à l'origine d'un
développement ; depuis cette tranche, **toute** fabrication de la barre avec des références relie
son résultat à chacune d'elles — une carte prise à la main (`TS6`, sans Développer ni Encore) tire
donc désormais un lien aussi, ce qui est la généralisation demandée. « Combiner » : un bouton
au-dessus de la barre, visible dès que la sélection de la toile (`selection`, pas `prises`) tient
au moins deux images prêtes — `referencesPrises(cartes, selection)` (déjà écrite pour `TS6`), pas
une seconde fonction. Il remplit `prises` avec les cartes combinées et réutilise **exactement** le
mécanisme de vidage-avec-exemple de `Développer` (`Developpement`, `EXEMPLES_COMBINAISON`) — un
`Developpement` ne porte aucune contrainte sur le nombre de références, la généralisation n'a rien
demandé de neuf à ce type. Le placement « entre elles » vit dans `departDeFabrication` (pure,
`Toile.tsx`) : à côté d'une seule référence ou d'aucune (TS10, inchangé), centré sur leur englobant
dès qu'il y en a deux ou plus — `placeLibre`, en aval, écarte le résultat des cartes qu'il
recouvrirait. « Encore » : un nouveau contexte `ENCORE` (`Tableau.tsx`), à côté du bloc *Phrase*
existant (`carte.phrase`, TS5) — un bouton `Encore ›` qui reçoit la carte et sa phrase. Décision :
« Encore » ne peut pas réutiliser `origineDeveloppement` tel quel, parce que l'original n'est
**jamais** renvoyé comme référence (relancer la même demande, ce n'est pas la modifier) — il lui
faut sa propre variable (`origineEncore`) pour que le résultat se relie quand même à lui. Les
références se relisent sur `PhraseDeCarte.references` — **champ serveur neuf** (`ServiceUnivers.
phrase_de_carte`, `atelier/services/univers.py`) : `generation.references` porte déjà, sans
retouche, exactement ce que l'auteur a joint à cet appel-là — aucune passe locale
(`_reinjections`) ne s'y ajoute pour un appel de la barre, puisqu'il part sans personnage et avec
une échelle vide. `referencesDEncore` (pure) n'en reprend que les entrées `origine === "carte"` :
une référence venue de la bibliothèque (un artwork promu) n'a pas de vignette à rouvrir depuis la
barre. Le reste de la demande (phrase, modèle, taille, case « style du jeu ») suit **le même
chemin que « Reprendre ce texte »** (`setReprise`, TS5) — aucune retouche à `BarreDeFabrication`.
Essais serveur : `tests/test_ts7.py` (deux essais — `phrase.references` telle que l'appel les a
reçues, et une liste vide plutôt qu'absente). Essais d'écran : `Toile.test.tsx`
(`originesReliees`, `departDeFabrication`, `referencesDEncore` — chacun avec un cas qui tombe sans
le correctif, 8octies), `Tableau.test.tsx` (le bouton `Encore ›`, gardé par `carte.phrase` comme
`Reprendre ce texte`). Non vérifié au navigateur : pas d'`interface/dist` dans ce worktree
(`AGENTS.md`).

*Corrigé le 24 septembre 2026 après relecture.* L'hypothèse ci-dessus était fausse :
`generation.references` porte tout ce qui est parti, et une échelle vide envoie quand même les
artworks marqués « tous » (rôle `style`). « Encore » les reprenait donc comme des cartes prises à
la main, en image à modifier, et reliait le résultat à eux. `referencesDEncore` écarte désormais le
rôle `style` — une carte prise part toujours en `edition` —, et le serveur les rajoute seul si la
case « avec le style du jeu » revient cochée. Voir aussi la correction de `TS4`. Essai :
`Toile.test.tsx`, un cas neuf.

## Les retours du 24 septembre sur la toile

> Ajoutées le 24 septembre 2026, sur les retours de l'auteur à l'usage de la toile, une fois
> TS1 à TS12 fusionnées dans `main`.

### TS13 · La toile revient après « Ambiances et couleurs »

**Le défaut** : passer de l'onglet « Ambiances et couleurs » à « Inspiration » laisse la toile
vide sur « la toile se règle sur la grille… » (`Toile.tsx`, l'état `crans`). Il faut repasser
par « grille » puis revenir sur « toile » pour qu'elle s'affiche. La cause est à lire avant de
corriger : sans doute une mesure prise pendant que la toile était cachée, et jamais reprise.

- [ ] revenir d'« Ambiances et couleurs » à « Inspiration » montre la toile, sans détour par la grille
- [ ] un essai d'écran fait l'aller-retour et tombe sans le correctif (*8octies*)

### TS14 · La barre « Fabriquer » se replie

- [x] la barre de fabrication en bas de la toile se replie en une ligne et se déplie, comme sur
      Mixboard ; repliée, elle ne cache plus la toile
- [x] le texte en cours, les références prises, le modèle et la taille survivent au repli
- [x] l'état replié ou déplié est retenu d'une visite à l'autre (préférence du navigateur)

**Fait le 24 septembre 2026.** `BarreDeFabrication` (`interface/src/composants/ToileFabrique.tsx`)
reste le même composant monté dans les deux états — replier ne fait que rendre moins de JSX,
rien n'est réinitialisé. Repliée, une seule ligne : le bouton « ▸ Fabriquer » pour déplier, et
le début du texte en cours s'il y en a un. Le chevron « ▾ » à côté du libellé « Fabriquer »
replie. L'état suit le même garde `localStorage` (try/catch) que le modèle, le nombre de
versions et la taille — une seule clé, `atelier.toile.fabrique`, réécrite en entier à chaque
réglage via un nouvel `enregistrer()` qui porte toujours les cinq champs pour ne pas en perdre un
au passage. Une ligne ajoutée dans `interface/src/aide.ts`, entrée `toile.fabriquer` (origine et
long) plutôt qu'une entrée neuve — c'est un réglage de plus sur un écran déjà décrit, pas un
écran nouveau. Deux essais dans `ToileFabrique.test.tsx` : repli/dépli garde texte, référence et
taille ; démonter puis remonter la barre relit le repli retenu — les deux tombent si on
neutralise le rendu replié (vérifié en défaisant le correctif). Pas de vérification au
navigateur : le worktree n'a pas de `dist` construit et monter un atelier jetable complet avec un
projet et des cartes pour ce geste aurait coûté plus que ce que les essais d'écran, sabotés puis
rétablis, ne couvrent déjà. `Toile.tsx` n'a pas été touché — la barre reste montée telle quelle,
sans changement de ses props.

### TS16 · « ouvrir sa palette » d'un îlot marche, et n'existe qu'une fois

**Le défaut** : dans la fenêtre d'un îlot, « ouvrir sa palette › » ne mène nulle part, alors que
son doublon « aller voir sa palette » marche. Les deux disent la même chose.

- [ ] il ne reste qu'un bouton pour aller à la palette de l'îlot, et il y mène
- [ ] même vérification pour « son ambiance » : un seul bouton, qui marche
- [ ] un essai clique le bouton qui reste et vérifie où il mène

### TS15 · Le détail d'une carte et d'un îlot s'ouvre dans la colonne de droite

Cliquer une carte ou un îlot n'ouvre plus de fenêtre par-dessus la toile. Leur détail prend la
place de la réserve, dans la colonne de droite, et la réserve revient quand on le ferme.

- [ ] une carte cliquée montre, dans la colonne de droite : sa miniature (150 px de haut au
      plus, si c'est une image), puis tout ce que la fenêtre montrait, et toutes ses actions
- [ ] même chose pour un îlot : son nom, ses cartes, sa palette, son ambiance, ses actions
- [ ] rien ne disparaît (*8nonies*) : chaque action de l'ancienne fenêtre a sa place dans le panneau
- [ ] une croix, Échap, ou un clic sur la toile vide ferme le détail et rend la réserve
- [ ] cliquer une autre carte change le détail sans le fermer
- [ ] la mise en page suit `docs/DESIGN.md` : des groupes titrés, les actions dangereuses à part
- [ ] le guide (`aide.ts`) dit où se trouve désormais le détail

**Bloquée par** : TS16, qui touche la même fenêtre d'îlot.

### TS17 · Choisir un modèle : les habitués d'abord

Le choix du modèle d'image devient un panneau. Il montre d'abord les modèles dont l'auteur se sert
le plus, puis la liste complète sur demande. Il sert d'abord à la barre « Fabriquer » de la toile,
puis à tous les autres endroits où l'on choisit un modèle d'image.

- [x] en tête, les **3 modèles gratuits les plus utilisés**, puis les **3 modèles payants les plus
      utilisés**, comptés sur les générations passées de l'auteur ; un modèle local compte comme gratuit
- [x] « voir plus de modèles » ouvre la liste complète, avec un champ de recherche qui filtre par nom
- [x] sans historique, les tops sont remplacés par la liste complète (pas de cases vides)
- [x] le catalogue décide toujours : un modèle qui ne peut pas honorer la demande reste grisé avec
      sa raison, y compris dans les tops
- [x] le compte d'usage vient du serveur (une route, ou un champ du catalogue), pas du navigateur
- [ ] un seul composant, posé dans la barre de la toile et dans les autres choix de modèle d'image

*Fait le 24 septembre 2026.* Le compte d'usage est un champ du catalogue (`GET /api/models` →
`habitues: { gratuits, payants }`), calculé par `ServiceGenerations.habitues` sur
`Base.comptes_par_modele` — **toutes les générations réussies, tous projets confondus** (décision :
les habitudes d'un auteur ne se réinventent pas d'un jeu à l'autre). Tri déterministe : compte
décroissant, puis ordre du catalogue. Le composant `ChoixModele` (`interface/src/composants/
pieces.tsx`) est posé dans `BarreDeFabrication` (toile), avec les tops, « voir plus de modèles »,
la recherche, Échap, et les flèches + Entrée sur ce qui est affiché. Il **n'est pas encore posé**
dans les trois autres endroits où l'on choisit un modèle d'image — `FabricationSuivie.tsx` (radios,
pas un `<select>`, remaniement plus large), `RelectureEquipement.tsx` et `FabricationVideoLibre.tsx`
(risque non nul, hors budget de cette tranche) — à faire dans une tranche suivante. Non vérifié au
navigateur : le worktree n'a pas d'`interface/dist` et ne doit pas en construire un (`AGENTS.md`) ;
vérifié par 7 essais serveur (`tests/test_ts17.py`) et 7 essais d'écran dédiés dans
`ToileFabrique.test.tsx`, plus les 28 essais existants du même fichier, tous verts.

### TS18 · Une carte s'ouvre dans l'atelier de retouche

Depuis le détail d'une carte image (colonne de droite, TS15), « Retoucher dans l'atelier » ouvre
son image dans l'atelier de retouche, avec tous ses outils, comme un clic sur une image de la
Galerie.

**Le point à trancher** : une carte n'est pas un asset (`Carte.fichier`, `atelier/domaine/carte.py`).
Lecture recommandée :
- une carte fabriquée par la toile, ou posée depuis la bibliothèque, a déjà son asset : on ouvre
  celui-là ;
- sinon (une image collée ou importée), on reprend la copie en bibliothèque de TS2
  (`sujet_depuis_carte.py`), sans rattacher l'image à un sujet ;
- la retouche ne touche ni l'image de la carte ni l'image brute ; « Poser sur la toile », depuis
  l'atelier, pose la version retouchée **reliée** à la carte d'origine (le lien de TS10).

- [ ] le détail d'une carte image porte « Retoucher dans l'atelier », qui ouvre l'atelier de retouche
- [ ] une carte qui a déjà son image en bibliothèque n'en crée pas une seconde copie
- [ ] la version retouchée revient sur la toile, reliée à la carte, sans remplacer l'originale
- [ ] un essai referme puis rouvre l'atelier sur la même carte, avec une retouche qui n'est pas
      celle par défaut, et la relit (*8septies*)
- [ ] aucun appel payé : retoucher reste du traitement local

**Bloquée par** : TS15 (le bouton vit dans le détail de la colonne de droite).

### TS19 · La planche des directions ne dessine pas un miroir

*Ajoutée le 24 septembre 2026, sur un retour de l'auteur* : sa planche de référence d'Elias sort
en miroir. Les deux vues de profil sont la même image retournée : la trousse de soin, le fusil et
le sac changent de côté avec lui, au lieu de montrer l'autre côté de son corps.

**La cause** : le texte qui part décrit chaque vue de profil par « seen from the side, facing
right / left » (`atelier/domaine/direction.py`) et rien de plus. Pour un modèle, retourner l'image
est la façon la plus simple de tenir cette phrase.

- [ ] quand la planche porte deux directions opposées (est et ouest, gauche et droite, et leurs
      diagonales), le texte dit qu'il s'agit **du même personnage vu de l'autre côté, pas d'un
      miroir** : ce qu'il porte d'un côté du corps reste de ce côté-là du corps (une sacoche sur sa
      hanche gauche se voit d'un profil et se cache de l'autre)
- [ ] la phrase est lisible dans *Relire avant l'envoi*, et le concept art part toujours comme le
      design à reproduire (*TS3*, *TS11*)
- [ ] **à l'arrivée**, deux vues opposées qui sont presque exactement le miroir l'une de l'autre
      sont signalées sur la planche (« ces deux vues sont un miroir ») ; le calcul est local et
      déterministe (comparer une vue à l'autre retournée), et ne coûte rien
- [ ] un essai vérifie la phrase qui part, et un autre le signalement, sur une paire miroir et sur
      une paire qui ne l'est pas
- [ ] **un banc payé, lancé à la main par l'auteur**, compare l'ancienne phrase et la nouvelle sur
      huit tirages chacune ; son prix est annoncé avant de partir

### TS20 · Refaire la planche des directions

*Ajoutée le 24 septembre 2026, sur une question de l'auteur* : « comment je fais si je veux refaire
une nouvelle planche de référence sur le même personnage parce que la première ne me va plus ? »

**Aujourd'hui** : « Faire la planche des directions » ne se montre que dans le bloc *Planche* vide
(`ImagesDuSujet.tsx`, `boutonPlanche`) et dans le bandeau du sujet neuf. Une fois une planche choisie,
le seul chemin est un détour : retirer la planche des images d'exemple, pour que le bouton revienne.
« C'est la référence » sait déjà remplacer l'ancienne planche (`choisir_la_planche`, qui dépromeut les
autres).

- [ ] le bloc *Planche* porte « Refaire la planche des directions » même quand une planche est choisie
- [ ] la nouvelle planche part du **concept art** comme la première (*TS3*), et **l'ancienne planche ne
      part pas avec elle** : sinon le modèle recopierait le dessin qu'on veut quitter
- [ ] l'ancienne reste la référence jusqu'à ce que l'auteur clique « C'est la référence » sur une
      nouvelle ; elle reste alors en bibliothèque, dépromue
- [ ] le prix est annoncé sur le bouton, comme pour la première
- [ ] un essai : un sujet avec une planche choisie refait sa planche, et la demande qui part ne porte
      pas l'ancienne planche ; puis « C'est la référence » sur la nouvelle remplace l'ancienne

**Après** : TS19 (même texte envoyé, même écran de la planche).

## Ce que ce plan ne couvre pas

- Les autres poses (marche, attaque…) : elles partent de la planche choisie par les chemins qui
  existent déjà.
- Une carte de texte seule (sans image) : elle peut remplir la description, pas faire un sujet.
