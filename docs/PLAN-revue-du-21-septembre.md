# Plan : la revue du 21 septembre — moins de chemins, plus de retours

> **Source** : [`docs/releves/revue-2026-09-21.html`](releves/revue-2026-09-21.html), la revue
> complète de l'application faite le 21 septembre 2026 au navigateur, sur une copie des données de
> l'auteur, avec trois générations réelles sur la carte graphique (une vidéo, deux images) et trois
> relevés dans le code. Publiée aussi à
> <https://claude.ai/artifact/RGwKZh8tNi6otYgkGLqGUR>.
>
> **Ouvert le 21 septembre 2026, à la demande de l'auteur**, qui a validé le découpage le jour même
> et demandé que la fusion des retours du 20 septembre passe **en premier** (`RV0`).
>
> **Ce chantier ne dépense rien.** Aucune tranche n'appelle un modèle payé. ⚠️ Une seule exception à
> surveiller, et elle ne coûte pas d'argent mais des comparaisons : `RV3` change la couleur de fond
> envoyée au fournisseur quand la description nomme une couleur.
>
> Quel modèle sur quelle tranche : [`PLAN-revue-du-21-septembre-affectation.md`](PLAN-revue-du-21-septembre-affectation.md).

---

## Ce que c'est, en une phrase

**Une action, un chemin ; et l'écran dit ce qui s'est passé, là où l'on a cliqué.**

## Ce que c'est, en trois gestes

1. On clique « + générer », « Tout animer » ou « Nouvelle animation » : c'est toujours la même
   fenêtre « Animer », déjà remplie.
2. On lance : une case « en cours » apparaît dans la rangée, puis devient la vignette.
3. Si la vidéo revient noire, figée ou vide, la case dit « ratée », avec la raison, et propose
   « Relancer ».

## Ce que ce n'est pas

- **Pas une nouvelle capacité.** Tout ce que ce chantier touche existe déjà ; il le regroupe, le
  nettoie ou le fait parler.
- **Pas une refonte du design.** Le style papier de `docs/DESIGN.md` est en vigueur ; on y ramène
  les écrans qui en sont sortis, l'écran des tuiles servant de modèle.
- **Pas le coup de main.** L'aide IA (`PLAN-assistant.md`) reste à programmer ensuite.

---

## Décisions d'architecture

Elles valent pour toutes les tranches et ne rebougent pas en cours de route.

- **Une génération qui échoue au contrôle d'arrivée prend le statut `echouee`**, qui existe déjà,
  avec une raison lisible. Pas de nouveau statut. Sa dépense reste inscrite (*une dépense ne
  s'efface jamais*, E18) ; son fichier brut reste sur le disque pour qu'on puisse le regarder.
- **Le contrôle d'arrivée ne relance jamais rien.** « Relancer » est un geste de l'auteur (*rien
  n'est jamais relancé automatiquement*, T1).
- **Le contrôle se fait sur la machine, sans modèle** : des mesures d'images (luminance, écart
  entre images successives, part de pixels restés opaques après détourage). Il ne dépend d'aucun
  fournisseur et tourne réseau coupé.
- **La fenêtre « Animer » est la fenêtre « Préparer une fabrication »**, déjà l'unique chemin des
  images. On ne crée pas un cinquième formulaire : on enrichit celui-là, puis on retire les
  autres. Côté serveur, **un seul circuit** : celui des fabrications suivies (les travaux de
  production), qui sait déjà relire, suivre et livrer.
- **Le texte du mouvement reste celui de la bibliothèque des mouvements** (Réglages › Univers).
  Une correction faite dans la fenêtre vaut **pour cet appel seulement** ; la garder est un
  second geste écrit (*E14*).
- **Un seul compte d'avancement d'un sujet**, calculé à un seul endroit du serveur et lu par tous
  les écrans : *animations et images prêtes pour le jeu, sur le nombre demandé par son objectif*.
- **Un seul dossier Godot par jeu**, mémorisé par le jeu, lu par tous les chemins de livraison.
- **Le fond de studio reste un calcul par appel** (`RT3`, `atelier/domaine/fond.py`). `RV3`
  ajoute une seule entrée à ce calcul — les couleurs nommées dans la description — et **n'en
  change pas le principe** ; la tête du module doit le dire.
- **« Tu » partout.** Mesuré le 21 septembre : le guide tutoie (153 contre 1) et les écrans aussi
  (118 contre 64). La revue disait l'inverse ; elle se trompait, et c'est le tutoiement qui coûte
  le moins à généraliser.

---

## RV0 · Les retours du 20 septembre rejoignent `main`

**Bloquée par** : aucune — démarrable immédiatement. **À faire avant toute autre tranche.**

### Ce qu'on livre

La branche `feat/retours-du-20-septembre` (seize commits d'avance, aucun de retard sur `main` le
21 septembre) est fusionnée dans `main`, et le tableau d'état de `docs/PLAN.md` est remis à jour.

### Critères d'acceptation

- [x] `main` contient les neuf tranches `RT` ; la suite serveur et la suite d'écran passent sur
      l'état fusionné (`docs/essais.md`). *Fait le 21 septembre 2026 en avance rapide (`main` n'avait
      aucun commit d'avance) : 3 846 essais serveur et 2 815 d'écran verts. Le garde-fou
      `essais/essai_vocabulaire.py` échouait déjà avant la fusion (8 écarts, dont « Codex » absent
      de `docs/vocabulaire.html`) : repris par `RV4`.*
- [x] Le tableau d'état ne dit plus que *Le son* vit sur une branche à part.
- [x] Le tableau d'état porte une ligne pour *Les moteurs locaux* et *Les styles de combat*,
      chantiers finis qui n'y figuraient pas.
- [x] Le tableau d'état porte la ligne de ce chantier.

---

## RV1 · Une vidéo ratée se dit ratée

**Bloquée par** : aucune.

### Ce qu'on livre

À l'arrivée d'un clip, l'atelier regarde ses images avant de le découper. Toutes noires, toutes
identiques, ou vides après détourage : le clip passe en `echouee` avec sa raison, n'est pas
découpé, et sa case propose « Relancer ». Constaté le 21 septembre : 25 images noires rangées comme
une animation réussie, transparente, et proposée à la livraison.

### Critères d'acceptation

- [x] Un clip dont toutes les images sont noires (ou presque) est `echouee`, raison « la vidéo est
      revenue noire ».
- [x] Un clip dont toutes les images sont identiques est `echouee`, raison « la vidéo ne bouge
      pas ».
- [x] Un clip qui ne garde presque rien après détourage est `echouee`, raison « le détourage n'a
      rien laissé ».
- [x] Un clip `echouee` n'est jamais monté automatiquement et n'apparaît pas dans la livraison.
- [x] Sa dépense reste comptée, son fichier brut reste consultable.
- [x] L'écran montre la raison sur la case du clip, avec un bouton « Relancer » qui rouvre la
      préparation remplie à l'identique ; rien ne part sans ce clic.
- [x] Un vrai clip réussi passe le contrôle sans changement (essai sur un clip existant du dépôt).

---

*Fait le 21 septembre 2026.* Le contrôle vit dans un module pur sans fournisseur ; seuils calibrés sur les 45 clips réussis de `donnees/` et les 4 clips versionnés du banc pixel, chacun avec au moins ×5 de marge (note de décision : noire = 80 % des images au centile 99 de luminance ≤ 24 ; immobile = médiane des écarts successifs < 0,10 ; vide = meilleure image < 0,5 % de pixels opaques). Les imports ne sont jamais contrôlés. Le second montage automatique, celui des fabrications suivies, est contrôlé aussi ; le travail passe « à vérifier » et propose une nouvelle demande. **Simplification** : « Relancer » rouvre la préparation de la case (pose et direction), comme « + générer », et non la demande à l'identique ; `RV6` la rendra identique quand la fenêtre sera unique. **Pas encore vu au navigateur** : se vérifie avec `RV7`.

---

## RV2 · La carte graphique prévient avant de lancer

**Bloquée par** : aucune.

### Ce qu'on livre

Avant un calcul local, la préparation montre la mémoire libre de la carte en clair, et prévient
quand elle est sous ce que le modèle demande, ou quand ComfyUI est déjà occupé par un autre
calcul. Le 21 septembre, « 0,9 Go libres » et « Occupé » s'affichaient sans alerte, et la vidéo est
revenue noire.

### Critères d'acceptation

- [ ] La préparation affiche « Mémoire libre : 0,9 Go » et non l'identifiant technique du pilote.
- [ ] Sous le besoin connu du modèle, un avertissement nomme l'écart et le remède (« fermez les
      autres calculs »). Il avertit, il ne bloque pas.
- [ ] ComfyUI occupé par un autre calcul est dit avant le lancement.
- [ ] Un modèle dont le besoin n'est pas connu n'invente pas de chiffre : l'avertissement se tait.

---

## RV3 · Le fond de studio évite la couleur du sujet

**Bloquée par** : aucune.

### Ce qu'on livre

Quand aucune image de référence ne part avec l'appel, le calcul du fond lit les couleurs nommées
dans la description (« cape verte ») et n'élit pas un fond de cette couleur. La relecture le dit.
Constaté le 21 septembre : un rôdeur à cape verte envoyé sur un fond vert, cape trouée au
détourage.

### Critères d'acceptation

- [ ] « cape verte » sans référence → le fond envoyé n'est pas le vert de studio.
- [ ] Avec une image de référence, le calcul de `RT3` est inchangé.
- [ ] La relecture nomme le fond choisi et, quand il a changé à cause de la description, dit
      pourquoi en une ligne.
- [ ] La tête de `atelier/domaine/fond.py` décrit cette nouvelle entrée.
- [ ] ⚠️ Écrit au plan à la clôture : les tirages faits avant `RV3` sur un sujet vert ne se
      comparent plus aux suivants.

---

## RV4 · Les mots

**Bloquée par** : aucune.

### Ce qu'on livre

La liste de la partie 7 de la revue, en entier. Ce que l'auteur lit dit ce qu'il reconnaît, pas
comment l'atelier est construit.

### Critères d'acceptation

- [ ] « frames » devient « images », « Asset » devient « Sujet », partout à l'écran.
- [ ] Aucun identifiant technique de modèle (`ComfyUI:…@<empreinte>`) n'apparaît dans une liste ni
      une relecture : le nom lisible, déjà connu ailleurs, le remplace.
- [ ] Plus de « Travail conservé chez le moteur : <identifiant> », de « .env », de
      « cudaMallocAsync ».
- [ ] « vote en deux temps » reçoit un nom qui dit le résultat.
- [ ] Plus de « l'établi », « le carnet », « le vestiaire » à l'écran.
- [ ] « Tu » partout ; un essai le tient.
- [ ] Sur un calcul local, aucune ligne d'argent (« déjà payé », « 0,0000 $ par animation ») : le
      temps passé à la place.
- [ ] Les sons : « 1 version », durées en minutes et secondes.
- [ ] Le style de combat « karaté » a son propre texte, ou disparaît.
- [ ] `essais/essai_vocabulaire.py` repasse : les 8 écarts relevés le 21 septembre (« Codex », les
      onglets de la fiche, deux retours en arrière) sont réglés dans le code ou dans
      `docs/vocabulaire.html`.
- [ ] Les nouvelles phrases sont lues dans le recueil, jamais retapées (*R4*), et `aide.test.ts`
      passe.

---

## RV5 · La fenêtre « Animer » reçoit le meilleur du formulaire A

**Bloquée par** : RV2.

### Ce qu'on livre

La fenêtre « Préparer une fabrication », en mode clip, gagne ce que seul l'écran « Faire une
vidéo » savait faire, pour pouvoir le remplacer.

### Critères d'acceptation

- [ ] Le mouvement choisi remplit le texte depuis la bibliothèque des mouvements ; le nom du
      mouvement s'affiche en français, le texte anglais envoyé se déplie.
- [ ] Ce texte se corrige dans la fenêtre pour cet appel ; « garder pour le jeu » est un second
      geste.
- [ ] On choisit le nombre de clips (1, 2, 4, 8).
- [ ] La durée proposée est toujours une durée que le modèle choisi accepte.
- [ ] Le bouton porte le prix (payant) ou le temps attendu (local) ; l'état de la carte vient de
      `RV2`.
- [ ] Le choix local ou payant montre des noms lisibles.

---

## RV6 · Un seul chemin pour animer

**Bloquée par** : RV5.

### Ce qu'on livre

Les onze boutons relevés le 21 septembre (« + générer », « Animer › », « Tout animer », « Animer les
directions », « En générer une variante », « Demander un clip », « Préparer un clip vidéo »,
« Nouvelle animation », « Préparer une vidéo », « Utiliser ce workflow », « Fabriquer… ») ouvrent
tous la fenêtre « Animer », déjà remplie : sujet, mouvement, direction(s). Les écrans « Faire une
vidéo » et « Animer <sujet> » disparaissent ; la vidéo libre devient le cas « sans sujet » de la
même fenêtre.

### Critères d'acceptation

- [ ] Chaque bouton ouvre la même fenêtre, remplie selon l'endroit du clic.
- [ ] « Tout animer » ouvre la fenêtre avec plusieurs directions cochées ; un clip part par case.
- [ ] « Fabriquer… » depuis l'onglet Animations s'ouvre en mode clip, pas en image fixe.
- [ ] Une seule relecture, celle des images ; la vue « ce qui part » à trois colonnes disparaît.
- [ ] Tous les clips passent par le circuit des fabrications suivies et apparaissent dans
      Fabrications.
- [ ] Les anciens écrans et leur code sont retirés ; aucun essai ne les monte plus.
- [ ] L'agent (MCP) lance un clip par le même service que l'écran (*T7*).

---

## RV7 · Le retour, là où l'on a cliqué

**Bloquée par** : RV1.

### Ce qu'on livre

Après « Lancer », pour une image comme pour un clip, une case « en cours » apparaît à l'endroit
visé (la rangée de la direction, la case de la pose), avec le temps écoulé sur le temps attendu.
Elle devient la vignette à l'arrivée, ou dit « ratée » avec la raison de `RV1`. Une notification
cliquable signale l'arrivée ailleurs dans l'atelier.

### Critères d'acceptation

- [ ] La case « en cours » est remontée par le serveur, pas poussée par l'écran : elle survit à un
      rechargement de la page.
- [ ] Elle devient la vignette sans rechargement.
- [ ] Un échec l'affiche « ratée » avec la raison et « Relancer ».
- [ ] Après « Lancer » depuis Fabrications, la fenêtre montre le résultat arrivé, ou se ferme ; le
      mouvement et la direction visés ne reviennent pas à « Sans case visée ».
- [ ] Une notification cliquable mène à la case.
- [ ] Vérifié au navigateur sur un atelier jetable, et pas seulement par les essais d'écran.

---

## RV8 · Un seul écran de livraison

**Bloquée par** : aucune.

### Ce qu'on livre

« Livrer dans Godot » et « Exporter des fichiers » deviennent un seul écran : à gauche ce qui part
(tout le jeu, une famille, un sujet), au centre les fichiers et ce qui change, un seul dossier
Godot mémorisé par le jeu. Les boutons « Livrer… » d'une fiche, d'un son, d'un jeu de tuiles y
mènent, filtrés. Constaté le 21 septembre : les deux écrans ne voyaient pas le même dossier, et le
second débordait à droite à 1280 px.

### Critères d'acceptation

- [ ] Un seul écran « Livrer au jeu », sans onglet interne.
- [ ] Le dossier Godot est le même quel que soit le chemin d'arrivée.
- [ ] Livrer un sujet depuis sa fiche ouvre l'écran filtré sur ce sujet.
- [ ] Les animations `echouee` n'y apparaissent pas.
- [ ] Rien ne déborde à 1280 px ; lisible à 1024 px.
- [ ] Ce que la livraison écrit dans Godot est identique à avant pour un même choix (*C03*).

---

## RV9 · Une seule liste de fabrications

**Bloquée par** : aucune.

### Ce qu'on livre

La page Fabrications montre **une** liste : la plus récente en haut, une vignette par ligne, des
filtres (en cours, terminées, ratées, à reprendre), et les séries regroupées (« Son · Champy · Pas »
douze fois devient une ligne « × 12 » qui se déplie). Les calculs locaux y figurent comme les
autres. Les boutons de départ se réduisent à « Nouvelle fabrication ».

### Critères d'acceptation

- [ ] Une seule liste ; les sections « Les calculs locaux » et « Rechercher une fabrication » sont
      fondues dedans.
- [ ] Toute génération (image, clip, son, équipement, locale ou payée) y apparaît dès son départ.
- [ ] Les séries identiques se regroupent.
- [ ] L'état des moteurs locaux reste lisible en une ligne en tête.

---

## RV10 · La fiche d'un sujet perd ses doublons

**Bloquée par** : aucune.

### Ce qu'on livre

L'écran « Cases et planches » (ancien écran V2.1 caché dans « Autres outils ») est retiré ; son
« Type d'objet » et son « Supprimer » passent dans « Modifier la fiche ». La « Galerie des
animations » en bas de l'onglet Animations est retirée. Tous les écrans lisent le même compte
d'avancement.

### Critères d'acceptation

- [ ] « Cases et planches » n'existe plus ; changer de nature et supprimer un sujet se font depuis
      « Modifier la fiche ».
- [ ] L'onglet Animations ne montre plus les animations deux fois.
- [ ] Accueil, Codex, fiche et objectif affichent le même compte pour un même sujet (essai sur
      Champy : un seul chiffre là où il y en avait cinq).
- [ ] Les planches que seul cet écran montrait restent atteignables (Galerie ou onglet Images).

---

## RV11 · Les petits doublons

**Bloquée par** : aucune.

### Ce qu'on livre

« Matières » sort de toutes les listes de sujets (Codex, animer, livrer, classer au montage) ; les
méthodes locales n'ont qu'une place, Réglages, et Fabrications y renvoie par un lien ; le Codex n'a
qu'un champ de recherche.

### Critères d'acceptation

- [ ] Aucune liste de sujets ne propose « Matières ».
- [ ] Une seule page gère les méthodes locales.
- [ ] Un seul champ de recherche dans le Codex.

---

## RV12 · La fiche à quatre onglets

**Bloquée par** : RV10.

### Ce qu'on livre

Animations · Images · Sons · Équipement. « Pas encore rangé » devient un bandeau quand il y a
quelque chose à ranger ; « Objectif & règles » passe dans « Modifier la fiche » ; « Galerie »
devient un filtre.

### Critères d'acceptation

- [ ] Quatre onglets au plus (`docs/DESIGN.md`).
- [ ] Rien de ce que portaient les trois onglets retirés ne devient inatteignable.
- [ ] Le bandeau « à ranger » n'apparaît que s'il y a des éléments à ranger.

---

## RV13 · La page d'un son et la Galerie

**Bloquée par** : aucune.

### Ce qu'on livre

La page d'un son prend les marges standard et un titre court (« Musique · mine des nains ») ; la
demande anglaise passe en petit dessous. La Galerie a une barre de filtres par onglet, qui ne
déborde pas, et des légendes « sujet · mouvement · direction » au lieu du début de la demande.

### Critères d'acceptation

- [ ] La page d'un son a les mêmes marges que les autres pages.
- [ ] Aucun titre de son n'est la demande entière.
- [ ] L'onglet Vidéos de la Galerie n'affiche ni les filtres ni le compteur des images.
- [ ] Aucun filtre coupé à 1280 px.
- [ ] Les légendes de la Galerie nomment le sujet quand il y en a un.

---

## RV14 · Le montage, le calibrage, les mouvements

**Bloquée par** : aucune.

### Ce qu'on livre

Le montage d'un clip s'ouvre en plein écran, et plus sous l'en-tête de la Galerie ; son panneau de
droite se range en trois blocs (où ranger, cadre et ancrage, vitesse). Le calibrage prend le volet
standard de 380 px. Les mouvements et styles de combat deviennent une section claire des
Réglages : nom en français, texte envoyé replié.

### Critères d'acceptation

- [ ] Le montage n'affiche plus l'en-tête ni les filtres de la Galerie.
- [ ] Son panneau tient en trois blocs repliables.
- [ ] Le calibrage n'a plus de colonne hors échelle ni le mot « établi ».
- [ ] Plus de marque dorée de l'ancien style (`epingle`) sur ces écrans.
- [ ] Aucun texte sous 10,5 px sur ces trois écrans.

---

## RV15 · Les premiers pas

**Bloquée par** : aucune.

### Ce qu'on livre

Un jeu qu'on vient de créer s'ouvre sur son accueil, avec « Créer votre premier sujet ». Un sujet
qu'on vient de créer s'ouvre sur ses images, avec un grand bouton « Fabriquer sa première image ».
« Échap » ferme toutes les fenêtres.

### Critères d'acceptation

- [ ] Fermer l'assistant d'un nouveau jeu mène à l'accueil de ce jeu, fil d'Ariane remis à zéro.
- [ ] Un nouveau sujet s'ouvre sur l'onglet des images, et le bouton y mène à la fenêtre remplie.
- [ ] « Échap » ferme « Préparer une fabrication » et toute autre fenêtre (un essai les parcourt).

---

## RV16 · La maquette, remesurée

**Bloquée par** : RV6, RV8, RV9, RV10, RV11, RV12, RV13, RV14, RV15.

### Ce qu'on livre

La comparaison écran par écran avec la maquette validée, refaite comme le 13 septembre (26
écrans : tenu, en partie, absent), au navigateur sur un atelier jetable. Elle dit ce que ce
chantier a réellement fermé, et ce qui reste.

### Critères d'acceptation

- [ ] Un relevé daté dans `docs/releves/`, sur les 26 écrans, avec la même grille que celui du
      13 septembre.
- [ ] Chaque écart restant est nommé, avec l'écran où on le voit.
- [ ] Le tableau d'état de `docs/PLAN.md` reprend le compte.
