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

- [x] La préparation affiche « Mémoire libre : 0,9 Go » et non l'identifiant technique du pilote.
- [x] Sous le besoin connu du modèle, un avertissement nomme l'écart et le remède (« fermez les
      autres calculs »). Il avertit, il ne bloque pas.
- [x] ComfyUI occupé par un autre calcul est dit avant le lancement.
- [x] Un modèle dont le besoin n'est pas connu n'invente pas de chiffre : l'avertissement se tait.

*Fait le 21 septembre 2026.* Un seul chiffre de besoin existe au dépôt : 6,0 Go pour le moteur de la maison (Wan 2.2), mesuré le 3 septembre ; les moteurs d'image locaux restent à besoin inconnu, donc muets. « Occupé » reprend la lecture de la file ComfyUI déjà en service. Le même petit composant sert l'écran « Faire une vidéo » et la fenêtre « Préparer une fabrication ». **Reste** : Réglages › Installation affiche encore l'identifiant technique du pilote — repris par `RV4`.

---

## RV3 · Le fond de studio évite la couleur du sujet

**Bloquée par** : aucune.

### Ce qu'on livre

Quand aucune image de référence ne part avec l'appel, le calcul du fond lit les couleurs nommées
dans la description (« cape verte ») et n'élit pas un fond de cette couleur. La relecture le dit.
Constaté le 21 septembre : un rôdeur à cape verte envoyé sur un fond vert, cape trouée au
détourage.

### Critères d'acceptation

- [x] « cape verte » sans référence → le fond envoyé n'est pas le vert de studio.
- [x] Avec une image de référence, le calcul de `RT3` est inchangé.
- [x] La relecture nomme le fond choisi et, quand il a changé à cause de la description, dit
      pourquoi en une ligne.
- [x] La tête de `atelier/domaine/fond.py` décrit cette nouvelle entrée.
- [x] ⚠️ Écrit au plan à la clôture : les tirages faits avant `RV3` sur un sujet vert ne se
      comparent plus aux suivants.

*Fait le 21 septembre 2026.* Une table fermée de mots de couleur, en français et en anglais, lus en mots entiers (« couvert » ne compte pas). Sans référence, les couleurs nommées sont traitées comme les couleurs d'une référence ; le vert de studio reste premier à égalité, donc inchangé quand rien ne le contredit. La relecture nomme le fond et, s'il a cédé, dit pourquoi (« fond magenta : ta description dit vert »). Les 41 essais de `RT3` passent sans changement. ⚠️ À partir d'ici, un sujet dont la description nomme la couleur du vert de studio part sur un autre fond : ses tirages ne se comparent plus à ceux d'avant.

---

## RV4 · Les mots

**Bloquée par** : aucune.

### Ce qu'on livre

La liste de la partie 7 de la revue, en entier. Ce que l'auteur lit dit ce qu'il reconnaît, pas
comment l'atelier est construit.

### Critères d'acceptation

- [x] « frames » devient « images », « Asset » devient « Sujet », partout à l'écran.
- [x] Aucun identifiant technique de modèle (`ComfyUI:…@<empreinte>`) n'apparaît dans une liste ni
      une relecture : le nom lisible, déjà connu ailleurs, le remplace.
- [x] Plus de « Travail conservé chez le moteur : <identifiant> », de « .env », de
      « cudaMallocAsync » — y compris dans Réglages › Installation, que `RV2` n'a pas touché.
- [x] « vote en deux temps » reçoit un nom qui dit le résultat.
- [x] Plus de « l'établi », « le carnet », « le vestiaire » à l'écran.
- [x] « Tu » partout ; un essai le tient.
- [x] Sur un calcul local, aucune ligne d'argent (« déjà payé », « 0,0000 $ par animation ») : le
      temps passé à la place.
- [x] Les sons : « 1 version », durées en minutes et secondes.
- [x] Le style de combat « karaté » a son propre texte, ou disparaît.
- [x] `essais/essai_vocabulaire.py` repasse : les 8 écarts relevés le 21 septembre (« Codex », les
      onglets de la fiche, deux retours en arrière) sont réglés dans le code ou dans
      `docs/vocabulaire.html`.
- [x] Les nouvelles phrases sont lues dans le recueil, jamais retapées (*R4*), et `aide.test.ts`
      passe.

*Fait le 22 septembre 2026.* « frame » reste dans l'atelier de retouche image par image, mot anglais que `docs/vocabulaire.html` garde. Le style « karaté » avait déjà son texte au dépôt : l'écart venait des données du testeur. « Revenir au… » devient « Reprendre le texte composé » / « Reprendre le choix automatique » (ce sont des annulations, pas des retours). Pour le Codex et les onglets, c'est `docs/vocabulaire.html` qui suit le code. Un nouveau garde-fou, `essais/essai_tutoiement.py`, tourne avec la suite ; sa liste d'impératifs est fermée, un impératif neuf s'y ajoute d'une ligne.

---

## RV5 · La fenêtre « Animer » reçoit le meilleur du formulaire A

**Bloquée par** : RV2.

### Ce qu'on livre

La fenêtre « Préparer une fabrication », en mode clip, gagne ce que seul l'écran « Faire une
vidéo » savait faire, pour pouvoir le remplacer.

### Critères d'acceptation

- [x] Le mouvement choisi remplit le texte depuis la bibliothèque des mouvements ; le nom du
      mouvement s'affiche en français, le texte anglais envoyé se déplie.
- [x] Ce texte se corrige dans la fenêtre pour cet appel ; « garder pour le jeu » est un second
      geste.
- [x] On choisit le nombre de clips (1, 2, 4, 8).
- [x] La durée proposée est toujours une durée que le modèle choisi accepte.
- [x] Le bouton porte le prix (payant) ou le temps attendu (local) ; l'état de la carte vient de
      `RV2`.
- [x] Le choix local ou payant montre des noms lisibles.

*Fait le 22 septembre 2026.* Un travail par clip, regroupés en série (`preparer_serie`, `demarrer_serie`) : N = directions cochées × nombre de clips, lancés tout ou rien pour l'agent. Le texte se compose dans un seul module serveur, que la route des mouvements et les travaux appellent ; la correction porte sur le geste, pour cet appel. Dans la fenêtre, le sélecteur de la bibliothèque s'appelle « Geste », pour ne pas le confondre avec le mouvement du plan. **Reste** : les textes neufs de la fenêtre sont écrits dans le composant, comme le reste du fichier ; ils passeront dans `aide.ts` quand `RV6` en fera la seule fenêtre.

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

- [x] Chaque bouton ouvre la même fenêtre, remplie selon l'endroit du clic.
- [x] « Tout animer » ouvre la fenêtre avec plusieurs directions cochées ; un clip part par case.
- [x] « Fabriquer… » depuis l'onglet Animations s'ouvre en mode clip, pas en image fixe.
- [x] Une seule relecture, celle des images ; la vue « ce qui part » à trois colonnes disparaît.
- [x] Tous les clips passent par le circuit des fabrications suivies et apparaissent dans
      Fabrications.
- [x] Les anciens écrans et leur code sont retirés ; aucun essai ne les monte plus.
- [x] L'agent (MCP) lance un clip par le même service que l'écran (*T7*).

*Fait le 22 septembre 2026*, en deux sessions : la première a retiré `Clip.tsx`, `AnimerEnLot.tsx` et `POST /clips` et rebranché neuf portes, puis s'est arrêtée sans commiter ; la seconde a repris ce travail, branché la dixième (« Animer un sujet » de Fabrications, qui ouvrait encore la fiche) et relancé les deux suites. **Tranché** : « En générer une variante » d'une *image* reste une image — c'est une variante fixe, pas un clip ; « Nouvelle animation » n'était plus un bouton mais le nom de « Nouvelle fabrication » dans le guide ; la vidéo libre reste son propre formulaire *dans* la fenêtre (le cas « sans sujet »), pas un écran à part ; `animate_sheet` (l'agent) découpe une planche déjà faite et ne lance aucun clip, il reste. **Pas encore vu au navigateur.**

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

### Retours de l'auteur au test de RV6 (23 septembre 2026)

Vus sur Mara, fenêtre « Préparer une fabrication », clip local, deux directions (droite, gauche).
Les deux tiennent à la **relecture d'une série** (`RelectureDeSerie`, `FabricationSuivie.tsx`),
plus pauvre que celle d'un clip seul, qu'elle devrait égaler.

- [ ] **Avant de lancer, on voit ce qui part** : pour chaque case de la série, l'image de départ
      et les références envoyées, comme la relecture d'un clip seul les montre déjà. Aujourd'hui
      une série n'affiche que « droite · Prête à lancer ».
- [ ] **Après « Lancer », la fenêtre ne laisse pas l'auteur sans retour** : chaque case dit son
      étape (image, vidéo, découpage), le temps écoulé sur le temps attendu, puis devient sa
      vignette ou « ratée » avec sa raison — sans avoir à déplier la ligne. Aujourd'hui l'écran
      reste figé sur « En cours », le bouton du bas disparaît, et rien ne dit qu'on peut fermer.
- [ ] Le pied de la fenêtre dit qu'on peut la fermer et que la fabrication continue, avec un
      bouton pour le faire.

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

- [x] Un seul écran « Livrer au jeu », sans onglet interne.
- [x] Le dossier Godot est le même quel que soit le chemin d'arrivée.
- [x] Livrer un sujet depuis sa fiche ouvre l'écran filtré sur ce sujet.
- [x] Les animations `echouee` n'y apparaissent pas.
- [x] Rien ne déborde à 1280 px ; lisible à 1024 px.
- [x] Ce que la livraison écrit dans Godot est identique à avant pour un même choix (*C03*).

*Fait le 22 septembre 2026.* Le dossier se lit sur le jeu Godot rattaché (`association.json`, format inchangé) et un fichier voisin porte le sous-dossier des fichiers ; le réglage de l'agent sort de la chaîne. L'écran s'ouvre sur un sujet par défaut (contrat des essais d'avant). Identité C03 prouvée par `essais/essai_rv8_identite.py` : 55 fichiers, mêmes empreintes. **À confirmer avec l'auteur** : le dossier `moulinssets` n'a pas de `project.godot` à côté ; et le sous-dossier par défaut `assets/asset-kitchen/fichiers`.

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

- [x] « Cases et planches » n'existe plus ; changer de nature et supprimer un sujet se font depuis
      « Modifier la fiche ».
- [x] L'onglet Animations ne montre plus les animations deux fois.
- [x] Accueil, Codex, fiche et objectif affichent le même compte pour un même sujet (essai sur
      Champy : un seul chiffre là où il y en avait cinq).
- [x] Les planches que seul cet écran montrait restent atteignables (Galerie ou onglet Images) — la
      porte de la planche vit maintenant sur l'onglet Images, à côté de chaque pose à plusieurs
      directions.

*Fait le 22 septembre 2026.* Des quatre capacités que l'établi emportait avec lui : écarter une
pose et la reprendre avait déjà un successeur, `ObjectifDuSujet.tsx` (« Objectif & règles »), en
place avant cette tranche ; sortir toutes les animations d'un sujet passe maintenant par le bouton
« Livrer… » de la page, qui ouvre « Livrer au jeu » filtré sur ce sujet, nature Animations ; le lot
d'images (cocher plusieurs poses pour les faire partir en une seule planche) est relogé dans
l'onglet Images ; lancer une planche d'équipement pose par pose, avec sa grille d'éligibilité, est
relogé dans l'onglet Équipement, sous chaque pièce portée. La génération d'images par lot
(« image-lot ») n'avait pas de successeur ailleurs ; c'est la même relocalisation que le lot
d'images ci-dessus.

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

- [x] Quatre onglets au plus (`docs/DESIGN.md`).
- [x] Rien de ce que portaient les trois onglets retirés ne devient inatteignable.
- [x] Le bandeau « à ranger » n'apparaît que s'il y a des éléments à ranger.

*Fait le 23 septembre 2026.* Quatre onglets, dans l'ordre du plan : Animations · Images · Sons ·
Équipement. Trois décisions non tranchées par le plan : « Galerie » devient une section repliable
« Sources » sous l'onglet *Animations* (clips vidéo et modèles 3D — les images et animations
qu'elle montrait aussi faisaient double emploi avec les onglets qui les rangent déjà par pose) ;
« Pas encore rangé » devient un bandeau replié par défaut, entre les onglets et leur contenu,
absent quand il n'y a rien ; « Objectif & règles » est monté dans « Modifier la fiche »
(`FicheDuSujet.tsx`), entre le type/l'ambiance et la recette. Les trois anciens onglets restent
des destinations valides pour `App.tsx` (la carte d'un sujet au Codex, la fenêtre de préparation
sans pose) : `PageDuSujet.tsx` les résout vers ce qu'ils sont devenus plutôt que de faire porter
ce changement à chaque appelant — aucun changement dans `App.tsx`. `docs/vocabulaire.html` et
`essais/essai_vocabulaire.py` sont à jour (essai vert), de même qu'`essai_docs.py`,
`essai_jetons.py`, `essai_tutoiement.py` et `essai_imports.py`.

**`src/App.test.tsx` (547 essais) a trouvé deux régressions que les essais ciblés ne voyaient
pas**, corrigées avant de livrer : (1) `ObjectifDuSujet.tsx` se monte maintenant à chaque
ouverture de « Modifier la fiche » plutôt que sur un clic d'onglet dédié — un double de test qui
ne connaît pas la route `/characters/…/objective` rend `{}`, et son calcul des mouvements
plantait sur `couverture` absent, repli défensif ajouté en ligne 50 ; (2) la section « Sources »
repliée sous *Animations* montait `SourcesDuSujet` en toute circonstance dans un `<details>` — un
`<details>` fermé garde ses enfants dans le DOM, et ses propres cases « Mouvement » portaient les
mêmes noms de pose que celles d'`AnimationsDuSujet` juste au-dessus, rendant `findByText` ambigu
sur 64 essais de l'atelier d'une animation ; `SourcesDuSujet` n'est désormais monté qu'une fois la
section dépliée. `App.test.tsx` renommait aussi `"Images de référence"` → `"Images"` sur ses 19
clics d'onglet — renommage mécanique, aucune autre de ses occurrences de « Galerie » ne visait
l'onglet retiré (elles visent la porte du Codex, sans rapport). Verdict final :
**547/547** (un essai isolé une fois en échec s'est révélé flaky, confirmé en le rejouant seul
deux fois de suite — sans rapport avec cette tranche, dans `Montage.tsx`, non touché). Les essais
ciblés (`PageDuSujet.test.tsx`, `FicheDuSujet.test.tsx`, `SourcesDuSujet.test.tsx`) et `tsc
--noEmit` restent propres après ces deux correctifs. Neuf essais de `PageDuSujet.test.tsx`
échouaient déjà avant cette tranche (`SonStyleDeCombat` dans `FicheDuSujet.tsx` lit
`resolu.styles` sans protection quand le double propre à ce fichier répond `{}` sur
`/styles/for-character/…` — `App.test.tsx` a la route, ce double-ci ne l'a pas) — hors de cette
tranche, non touché. Non vérifié au navigateur.

---

## RV13 · La page d'un son et la Galerie

**Bloquée par** : aucune.

### Ce qu'on livre

La page d'un son prend les marges standard et un titre court (« Musique · mine des nains ») ; la
demande anglaise passe en petit dessous. La Galerie a une barre de filtres par onglet, qui ne
déborde pas, et des légendes « sujet · mouvement · direction » au lieu du début de la demande.

### Critères d'acceptation

- [x] La page d'un son a les mêmes marges que les autres pages.
- [x] Aucun titre de son n'est la demande entière.
- [x] L'onglet Vidéos de la Galerie n'affiche ni les filtres ni le compteur des images.
- [x] Aucun filtre coupé à 1280 px.
- [x] Les légendes de la Galerie nomment le sujet quand il y en a un.

*Fait le 22 septembre 2026.* Le titre d'un son est sa famille et son nom coupé au mot (42 signes) ; la demande se lit en petit dessous dès que le titre a coupé quelque chose. Sans nom français, le titre garde le début de la demande : « mine des nains » demandera un nom court donné par l'auteur. La barre d'outils passe à la ligne au lieu de défiler. La légende d'une tuile ne change que si le sujet est connu.

---

## RV14 · Le montage, le calibrage, les mouvements

**Bloquée par** : aucune.

### Ce qu'on livre

Le montage d'un clip s'ouvre en plein écran, et plus sous l'en-tête de la Galerie ; son panneau de
droite se range en trois blocs (où ranger, cadre et ancrage, vitesse). Le calibrage prend le volet
standard de 380 px. Les mouvements et styles de combat deviennent une section claire des
Réglages : nom en français, texte envoyé replié.

### Critères d'acceptation

- [x] Le montage n'affiche plus l'en-tête ni les filtres de la Galerie.
- [x] Son panneau tient en trois blocs repliables.
- [x] Le calibrage n'a plus de colonne hors échelle ni le mot « établi ».
- [x] Plus de marque dorée de l'ancien style (`epingle`) sur ces écrans.
- [x] Aucun texte sous 10,5 px sur ces trois écrans.

*Fait le 22 septembre 2026.* Le montage passe en plein écran par lui-même (comme les dépliages), sans toucher la Galerie ; ses trois blocs s'ouvrent dépliés, parce que ce sont les réglages qu'on vient poser. Le calibrage revient au sujet par son nom. Calibrage et Mouvements gardent leurs arrondis et hauteurs d'avant (`essai_jetons.py`) : seul ce que RV14 demandait est repris.

---

## RV15 · Les premiers pas

**Bloquée par** : aucune.

### Ce qu'on livre

Un jeu qu'on vient de créer s'ouvre sur son accueil, avec « Créer votre premier sujet ». Un sujet
qu'on vient de créer s'ouvre sur ses images, avec un grand bouton « Fabriquer sa première image ».
« Échap » ferme toutes les fenêtres.

### Critères d'acceptation

- [x] Fermer l'assistant d'un nouveau jeu mène à l'accueil de ce jeu, fil d'Ariane remis à zéro.
- [x] Un nouveau sujet s'ouvre sur l'onglet des images, et le bouton y mène à la fenêtre remplie.
- [x] « Échap » ferme « Préparer une fabrication » et toute autre fenêtre (un essai les parcourt).

*Fait le 23 septembre 2026.* Trois correctifs ciblés, aucun nouvel écouteur : (1) `onFerme` du
parcours de création (`App.tsx`, mode `"creer"`) posait déjà `choixDuJeu` et `creeParLeParcours` à
`null` mais ne touchait jamais la pile — un jeu neuf s'ouvrait donc là où l'auteur regardait dans
le jeu d'avant, parfois un sujet dont l'identifiant n'existe même pas ici ; il pose maintenant la
racine sur `tableau-de-bord`, comme choisir un jeu dans le carnet. (2) `onPersonnage` (création
d'un sujet, `CreerUnAsset`) mémorisait l'onglet `"objectif"`, qui se redirige depuis `RV12` vers
`ongletInitial` — lequel bascule sur *Animations* dès que la famille est « personnages », onglet
vide pour un sujet qui vient de naître ; il mémorise désormais `"images"` directement, sans passer
par cette redirection. (3) Échap fermait déjà « Préparer une fabrication » et les vingt fenêtres
posées par `CadreDialogue.tsx` — le `<dialog>` natif ferme sur son événement `cancel`, et
`GU16` avait déjà réglé la coordination avec le guide ; aucun essai ne le vérifiait, d'où
`CadreDialogue.test.tsx`, qui couvre le cadre commun une fois pour ses vingt appelants plutôt que
chacun séparément. Les fenêtres qui ne passent pas par ce cadre (`Famille.tsx`, `Montage.tsx`,
`Reglages.tsx`…) portaient déjà chacune leur propre écouteur `"Escape"`, vérifié à la lecture.
Essais : `interface/src/App.test.tsx` (2 essais neufs, describe *B4 — l'ouverture*),
`interface/src/composants/CadreDialogue.test.tsx` (neuf). Suite complète : 549/549. Pas encore vu
au navigateur.

---

## RV17 · Sous le ruban d'une animation

**Bloquée par** : aucune. *Ajoutée le 23 septembre 2026, sur un retour de l'auteur au test de
`RV6` (Mara, marche · droite).*

### Ce qu'on livre

Dans l'atelier d'une animation, ce qui est sous le ruban des images devient clair et
utilisable. Aujourd'hui tout est tassé dans un petit encart qui défile (le chutier, puis
« Animation · boucle, repère et fenêtre commune » : le découpage, la boucle, le point d'ancrage…),
en texte à chasse fixe, avec des phrases d'explication à la place des gestes. L'auteur ne voit
pas comment se servir du chutier, ni quelle image est choisie.

### Critères d'acceptation

- [x] **L'image choisie se voit au premier coup d'œil** dans le ruban — plus qu'un fin liseré.
- [x] **« Retirer » et « Dupliquer » sont visibles** à côté de l'image choisie, et non cachés.
- [x] **Le chutier se comprend sans lire** : une zone visible où tombent les images retirées, en
      vignettes, qu'on peut remettre dans le ruban par un geste évident. Vide, il montre ce qu'on
      y fait en une ligne, pas un paragraphe.
- [x] **Ce qui vaut pour toute l'animation** (boucle ou aller-retour, point d'ancrage, reprendre
      le découpage) n'est plus écrasé dans un encart à défilement : il a une place lisible, sans
      barre de défilement interne sur un écran de 1080 px de haut.
- [x] Les explications en paragraphe deviennent des libellés courts ; plus de texte à chasse fixe
      pour des phrases.
- [x] Rien de ce qu'on sait faire aujourd'hui ne disparaît (*8nonies* : chaque réglage garde un
      chemin depuis l'écran).
- [x] Vérifié au navigateur, l'animation **en lecture** (*8octies*).

*Fait le 23 septembre 2026.* L'image regardée porte un contour épais `--signal` avec un fond
teinté et un liseré lumineux ; les images choisies en lot portent un contour `--encre-2` teinté —
deux signaux distincts, jamais confondus (`ImageDeLaBande`). « retirer », « dupliquer » et les
deux flèches de déplacement sont passés en boutons pleins juste sous le ruban qu'ils touchent. Le
chutier n'est plus un `<details>` replié : une carte toujours ouverte, en vignettes, avec deux
boutons directionnels (`← avant` / `après →`) par image — le geste de retour se voit sans lire.
Ce qui vaut pour toute l'animation (le découpage, la boucle, l'ancrage, la fenêtre commune) est
descendu dans un bandeau plein écran, en pied de l'atelier (`<footer data-reglages-de-l-animation>`),
en quatre blocs côte à côte : plus aucun `<details>`, plus de texte en mono pour des phrases —
mesuré sans overflow à 1920×1080 (`scrollHeight === clientHeight` sur les trois zones). Rien n'a
bougé côté données ni réglages ; seuls les libellés associés à `data-fenetre-davant` et aux deux
messages « écrit sans passer par Enregistrer » ont été raccourcis en gardant leurs sous-chaînes
attendues par les essais (`Des corrections attendent`, `Enregistrez d'abord`,
`laisserait tomber celles de l'autre`, `en garde au moins une`). Vérifié au navigateur (atelier
jetable, port 8427, animation à 12 images, personnage « Le nain ») : sélection simple et en lot,
retrait vers le chutier, remise dans le ruban, tout visible et sans défilement interne à
1920×1080, lecteur en marche pendant la vérification (8octies). `npx tsc --noEmit`,
`AtelierUnifieRetouche.test.tsx` (15/15) et `App.test.tsx` (547/547) passent ;
`essai_vocabulaire.py` et `essai_jetons.py` ne signalent aucun écart sur ce fichier. Le chutier
garde son propre défilement interne (`overflow-y-auto`, borné) quand il porte plusieurs images —
c'est une liste de contenu qui grandit, pas un encart de chrome replié ; le bandeau du bas, lui,
ne défile jamais.

---

## RV18 · « Sa vue » dit vrai, et se voit en scène

**Bloquée par** : aucune. *Ajoutée le 23 septembre 2026, sur un retour de l'auteur* (Réglages ›
Univers › étape 3 « Sa vue », avec des captures d'A Link to the Past, du premier Zelda, de
Hotline Miami, d'EarthBound, de Diablo 2 et de Hollow Knight à l'appui). Deux problèmes : des
jeux cités en exemple ne correspondent pas à la vue, et une vignette du rôdeur seul sur fond gris
ne fait pas comprendre quel jeu on pourra construire.

### Le relevé, vue par vue (fait le 23 septembre contre les captures de l'auteur)

La liste vit dans `atelier/domaine/vue.py`. ⚠️ Le texte « CAMERA » de chaque vue **part au
modèle** et certains y nomment les jeux : changer un exemple là change ce qui part, et les
tirages d'avant ne se comparent plus.

| Vue | Exemples aujourd'hui | Verdict |
|---|---|---|
| De face, fixe (1) | « les écrans de combat au tour par tour » | juste ; nommer des jeux : Dragon Quest, les combats d'EarthBound |
| De dessus, verticale (1) | « les jeux de tir à défilement vertical » | juste ; nommer : 1942, Raiden |
| De côté — plateforme (2) | Mario, Celeste, Hollow Knight | **juste** (la capture de Hollow Knight le confirme) |
| De côté — défilement (2) | « les jeux de baston de rue » | juste ; nommer : Streets of Rage, Final Fight |
| De dessus, stricte (4) | le premier Zelda, Hotline Miami | **faux à moitié.** Hotline Miami est bien vu de dessus (on voit le crâne), mais ses personnages **tournent librement**, pas 4 directions. Le premier Zelda n'est **pas** vu de dessus au sens strict : le décor est à plat, mais Link est dessiné de face ou de profil — il appartient à la famille 3/4 |
| De dessus, 3/4 (4) | Zelda A Link to the Past, Stardew Valley | **juste** (la capture le confirme : murs vus de face, sol vu de dessus). Y ajouter le premier Zelda, en plus plat |
| Oblique (cavalière) (4) | Ultima, EarthBound | projection **juste** pour EarthBound (dallages et étals en biais sur les captures) ; « Ultima » est trop vague — c'est Ultima VII. Mais EarthBound dessine **8 directions**, pas 4 |
| Isométrique (4) | Diablo 2, Age of Empires 2 | projection **juste** (vue d'un coin, losanges) ; mais ces deux jeux dessinent **8 directions**. Pour 4 : Final Fantasy Tactics, Into the Breach |

### Critères d'acceptation

- [ ] Chaque exemple cité correspond à la vue **et** au nombre de directions annoncé ; un jeu qui
      n'y correspond pas est retiré ou déplacé (tableau ci-dessus).
- [ ] « De dessus, stricte » dit la vérité sur les directions : soit elle passe à un personnage
      qui tourne (une image, que le jeu fait pivoter — comme la verticale), soit elle garde 4
      directions avec des exemples qui en ont 4. **À trancher par l'auteur.**
- [ ] L'oblique et l'isométrique disent si elles proposent 4 ou 8 directions ; si l'atelier ne
      sait faire que 4, l'écran le dit au lieu de citer des jeux à 8.
- [ ] Le texte envoyé au modèle suit les exemples corrigés, et l'écart est noté ici (*les tirages
      d'avant ne se comparent plus*).
- [ ] **Chaque vue se montre en scène** : le rôdeur dans un décor construit pour cette vue (sol,
      un mur ou un obstacle, un objet), à la place du rôdeur seul sur fond gris.
- [ ] **Au survol, la scène joue** : le rôdeur marche dans le décor, dans les directions de la
      vue — on comprend en deux secondes à quel jeu ça ressemble.
- [ ] Les scènes sont des fichiers du dépôt, fabriqués une fois (pas à chaque ouverture), et ne
      dépensent rien à l'usage.

**Tranché par l'auteur le 23 septembre 2026** : **(a)**, le rôdeur en scène animée ; et « De
dessus, stricte » devient **une image qui tourne** (le jeu la fait pivoter, comme la verticale),
avec Hotline Miami et GTA 1-2 pour exemples — le premier Zelda passe en 3/4.

*Les choix qui étaient proposés* : (a) scènes fabriquées par l'atelier lui-même —
le rôdeur et un petit décor par vue, puis animées au survol à partir de ses sprites
(recommandé : c'est le produit qui se montre, et il n'y a pas de droits sur des captures) ;
(b) captures de vrais jeux (plus parlant, plus simple, mais des images qui ne sont pas à nous) ;
(c) les deux : la scène du rôdeur, et un nom de jeu cliquable qui ouvre une capture. Le coût
d'une fabrication de huit scènes est à annoncer avant de lancer quoi que ce soit.

---

## RV19 · L'image de départ se voit avant de choisir

**Bloquée par** : RV7, RV9 (même fenêtre). *Ajoutée le 23 septembre 2026, sur un retour de
l'auteur* : « Animer les directions » sur un personnage ; au point 2 de la fenêtre, « Image de
départ », on ne voit que « La référence existante du personnage sera proposée à la relecture »
et une liste de quatre-vingts modèles « pour créer la référence si elle manque ». « On pourrait
pas avoir les propositions déjà calculées et affichées ici ? Peut-être que ce point doit arriver
après le point 3, quand on a choisi le geste et le style de combat ? »

### Critères d'acceptation

- [ ] **Dès l'ouverture, le point « Image de départ » montre, case par case, l'image qui
      partira** (la référence de la direction, sinon celle que la relecture proposerait), en
      vignette, avec « Changer » à côté. Elle est calculée par le serveur par **la même règle**
      que la relecture — pas une seconde règle côté écran.
- [ ] Une case sans image le dit en clair (« aucune image pour gauche ») ; **la liste des modèles
      n'apparaît que dans ce cas**, pour ces cases-là. Quand toutes les cases ont leur image, la
      liste disparaît et laisse une phrase (*un contrôle inerte disparaît*, 8nonies).
- [ ] Quand elle apparaît, la liste des modèles propose d'abord celui que le jeu recommande,
      présélectionné, et ne montre pas quatre-vingts lignes à plat (les modèles grisés restent
      grisés avec leur raison).
- [ ] **L'ordre de la fenêtre suit le geste** : 1. l'animation à créer (sujet, mouvement,
      directions) ; 2. le geste et le style de combat ; 3. l'image de départ ; 4. le clip ; 5.
      l'animation à obtenir. L'image proposée se recalcule quand le mouvement ou les directions
      changent.
- [ ] **« Corriger le geste » part du texte existant** (retour de l'auteur du même jour) : en
      ouvrant la correction, le champ est **rempli** avec le geste actuel, modifiable — pas
      montré en texte d'exemple grisé qu'il faudrait retaper pour changer un mot. Une correction
      qui revient au texte d'origine n'en est pas une (rien ne part en plus) ; « remettre le
      texte du mouvement » reste là.

---

## RV20 · Un texte envoyé se copie

**Bloquée par** : aucune. *Ajoutée le 23 septembre 2026, sur un retour de l'auteur* (Galerie,
volet « Le clip » : le texte envoyé est coupé à une ligne, lisible en entier seulement dans une
bulle au survol — « je peux le lire mais pas le récupérer »).

### Critères d'acceptation

- [ ] Partout où l'atelier montre un texte parti au modèle — le volet d'un clip et la fiche d'une
      image dans la Galerie, la relecture avant l'envoi, la carte de la toile (`TS5`) —, un bouton
      **« Copier »** met le texte entier dans le presse-papiers et le dit (« copié ») un instant.
- [x] Le texte coupé se déplie au clic, au lieu de n'exister qu'en bulle au survol.
- [x] Un seul petit composant sert tous ces endroits ; une copie refusée par le navigateur le dit
      au lieu d'échouer en silence.

**Fait le 23 septembre 2026.** Le composant `interface/src/composants/TexteEnvoye.tsx` exporte
`TexteEnvoye` (texte coupé à une ligne, dépliable au clic, avec son bouton) et `BoutonCopierTexte`
(le bouton seul, pour les endroits qui composent déjà leur propre affichage du texte). Posé dans
trois des quatre endroits listés : le volet d'un clip (`FicheDuClip.tsx`, qui montrait le texte
tronqué sans bouton), la fiche d'une image (`Fiche.tsx`, `LeTexteQuiLAFaite` — le bouton copiait
déjà mais échouait en silence ; il dit maintenant l'échec), et le tiroir de relecture avant
l'envoi côté image fixe (`Envoi.tsx`, à côté de « Reprendre le texte › »). **Restent à brancher,
hors de cette tranche** — un autre agent tient ces fichiers : la carte de la toile (`TS5`,
`Tableau.tsx` / `ToileFabrique.tsx`) et la fenêtre des clips (`FabricationSuivie.tsx`) ; les deux
peuvent importer `TexteEnvoye`/`BoutonCopierTexte` de `interface/src/composants/TexteEnvoye.tsx`
sans rien recomposer. Essais : `interface/src/composants/TexteEnvoye.test.tsx` (copie du texte
entier, échec dit, dépliage au clic) plus les essais existants de `Fiche.tsx` et `Envoi.tsx`, tous
au vert.

---

## RV16 · La maquette, remesurée

**Bloquée par** : RV6, RV8, RV9, RV10, RV11, RV12, RV13, RV14, RV15, RV17, RV18, RV19, RV20.

### Ce qu'on livre

La comparaison écran par écran avec la maquette validée, refaite comme le 13 septembre (26
écrans : tenu, en partie, absent), au navigateur sur un atelier jetable. Elle dit ce que ce
chantier a réellement fermé, et ce qui reste.

### Critères d'acceptation

- [ ] Un relevé daté dans `docs/releves/`, sur les 26 écrans, avec la même grille que celui du
      13 septembre.
- [ ] Chaque écart restant est nommé, avec l'écran où on le voit.
- [ ] Le tableau d'état de `docs/PLAN.md` reprend le compte.
