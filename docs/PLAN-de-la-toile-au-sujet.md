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

## Ce que ce plan ne couvre pas

- Les autres poses (marche, attaque…) : elles partent de la planche choisie par les chemins qui
  existent déjà.
- Une carte de texte seule (sans image) : elle peut remplir la description, pas faire un sujet.
