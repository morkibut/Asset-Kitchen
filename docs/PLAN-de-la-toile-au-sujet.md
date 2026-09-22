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

- [ ] une route crée le sujet depuis une carte : nom, famille, concept art, copie de l'image en
      asset du sujet, portrait posé
- [ ] le panneau d'une carte image porte le bouton ; il ouvre la fenêtre « Créer un sujet »
      pré-remplie, l'image visible
- [ ] une carte déjà concept art d'un sujet le dit et ouvre ce sujet au lieu d'en créer un second
- [ ] la fenêtre « Créer un sujet » du Codex peut aussi partir d'une carte de la toile
- [ ] essais sans appel payant

### TS3 · La première planche

- [ ] sur un sujet sans planche, « Faire la planche des directions » ouvre la préparation
      remplie : pose de repos, directions du jeu, concept art joint comme personnage à
      reproduire
- [ ] le texte qui part décrit le concept art comme le design à reproduire, et ne demande que
      les directions du jeu (lisible dans *Relire avant l'envoi*)
- [ ] « C'est la référence » sur une planche du sujet la promeut en `planche` et range ses vues
- [ ] l'outil de génération de l'agent sait le même geste
- [ ] essais sans appel payant ; **un essai payé**, fait par l'auteur, sur un personnage de la
      toile

## Ce que ce plan ne couvre pas

- Les autres poses (marche, attaque…) : elles partent de la planche choisie par les chemins qui
  existent déjà.
- Une carte de texte seule (sans image) : elle peut remplir la description, pas faire un sujet.
