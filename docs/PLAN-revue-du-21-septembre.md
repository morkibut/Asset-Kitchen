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

- [x] La case « en cours » est remontée par le serveur, pas poussée par l'écran : elle survit à un
      rechargement de la page.
- [x] Elle devient la vignette sans rechargement.
- [x] Un échec l'affiche « ratée » avec la raison et « Relancer ».
- [x] Après « Lancer » depuis Fabrications, la fenêtre montre le résultat arrivé, ou se ferme ; le
      mouvement et la direction visés ne reviennent pas à « Sans case visée ».
- [x] Une notification cliquable mène à la case.
- [x] Vérifié au navigateur sur un atelier jetable, et pas seulement par les essais d'écran.

### Retours de l'auteur au test de RV6 (23 septembre 2026)

Vus sur Mara, fenêtre « Préparer une fabrication », clip local, deux directions (droite, gauche).
Les deux tiennent à la **relecture d'une série** (`RelectureDeSerie`, `FabricationSuivie.tsx`),
plus pauvre que celle d'un clip seul, qu'elle devrait égaler.

- [x] **Avant de lancer, on voit ce qui part** : pour chaque case de la série, l'image de départ
      et les références envoyées, comme la relecture d'un clip seul les montre déjà. Aujourd'hui
      une série n'affiche que « droite · Prête à lancer ».
- [x] **Après « Lancer », la fenêtre ne laisse pas l'auteur sans retour** : chaque case dit son
      étape (image, vidéo, découpage), le temps écoulé sur le temps attendu, puis devient sa
      vignette ou « ratée » avec sa raison — sans avoir à déplier la ligne. Aujourd'hui l'écran
      reste figé sur « En cours », le bouton du bas disparaît, et rien ne dit qu'on peut fermer.
- [x] Le pied de la fenêtre dit qu'on peut la fermer et que la fabrication continue, avec un
      bouton pour le faire.

*Fait le 23 septembre 2026.* **Le point dur, tranché** (écrit en tête de `atelier/services/retours.py`) : un retour se **déduit** des travaux conservés et du chantier des images, il ne s'enregistre nulle part — une liste plate par case visée (`personnage`, `pose`, `direction`), avec `lance_le` (l'écran compte l'écoulé), `attendu_s` compté depuis le départ (`secondes + rang × secondes_suivant` pour une série locale, `null` pour un payant), l'étape en un mot (image, vidéo, découpage), la raison et la demande à relancer ; servie par `GET …/production-jobs/by-case`. Le flux annonce désormais quelle case bouge ; l'écran relit alors. Un échec reste affiché **jusqu'au travail suivant sur la même case**. Les clips portés par un travail ne paraissent plus une seconde fois parmi les clips à monter. **Tranché aussi** : « Relancer » d'une case rouvre la fenêtre remplie de la demande à l'identique (rien ne part sans son clic) ; une case « interrompue » propose « Reprendre » ; l'avis d'arrivée passe par la fente du châssis (arrivée ou ratée d'un clip, lien « voir la case » qui ouvre la fiche sur les animations, pose dépliée) — une seule fente, donc le dernier avis remplace le précédent, et changer d'écran l'efface ; une **image** partie vers une case referme la fenêtre de préparation (rouverte, elle revenait « Sans case visée » après le désarmement voulu par US-120) — une image libre garde la fenêtre et son « Générer encore ». Les images fixes n'ont que l'état « en cours » dans leur rangée : leur issue se lit déjà ailleurs. **Vu au navigateur** sur un atelier jetable (`essais/atelier_jetable_rv7.py`, port 8426, animateur doublé qui met 45 s et rend le second clip noir) : relecture d'une série avec l'image de départ par case ; après « Lancer », « Vidéo · 2 s » par case et le pied « Tu peux fermer… » avec son bouton ; les deux cases « en cours » dans leurs rangées, **encore là après un rechargement** ; sans recharger, la première devient sa vignette et la seconde « ratée — la vidéo est revenue noire » avec « Relancer », qui rouvre la fenêtre remplie ; relancée depuis la Galerie, l'avis « l'animation est arrivée — voir la case » mène à la rangée. **Pas vu au navigateur** : la case « en cours » d'une image fixe (le fournisseur doublé rend l'image aussitôt) et la fermeture de la fenêtre après une image — tenues par les essais seulement. Le temps attendu d'un clip local n'a pas été vu non plus (le double est payant : l'écoulé seul s'affiche).

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

- [x] Une seule liste ; les sections « Les calculs locaux » et « Rechercher une fabrication » sont
      fondues dedans.
- [x] Toute génération (image, clip, son, équipement, locale ou payée) y apparaît dès son départ.
- [x] Les séries identiques se regroupent.
- [x] L'état des moteurs locaux reste lisible en une ligne en tête.

*Fait le 23 septembre 2026.* Les trois listes (travaux suivis, file locale, journal des appels)
vivent maintenant dans `SuiviDesTravaux` (`FabricationSuivie.tsx`), fusionnées et dédoublonnées :
un travail porte déjà `generation_image`, `clip` et `etape_locale` — les identifiants **des mêmes
lignes** que le journal et la file locale connaissent sous leur propre nom —, donc la fusion les
en retire avant de tout trier par date de départ. **Tranché** : pas de route serveur — ces trois
champs voyagent déjà dans le JSON d'un travail depuis leur tranche d'origine, seul leur type
TypeScript manquait ; les ajouter là a suffi, sans dupliquer la question à un second endroit.
Le regroupement d'une série suit la même règle que le mouvement/nom lancés dans la même minute
proposée par le plan quand le serveur ne porte pas de `serie` ; la règle est écrite en tête du
code qui la porte. Quatre humeurs (en cours, terminées, ratées, à reprendre) valent pour les trois
origines ; une fabrication encore « prête à lancer » (jamais partie) n'y figure pas — elle reste
dans le tiroir des brouillons. Les boutons de départ se réduisent à « Nouvelle fabrication » et
« Consommation » (dépenses, un écran de lecture) ; « Animer un sujet », « Préparer une image »,
« Préparer une vidéo » et « Préparer un son » disparaissent — la fenêtre unique porte déjà son
propre choix de sujet et de type. `interface/src/aide.ts` a suivi : les fiches des portes disparues sont
retirées, celles de la liste réécrites pour la réalité fusionnée. **Pas vu au navigateur** : vérifié
par les essais d'écran et `tsc --noEmit` seulement.

### Retours de l'auteur au premier usage (23 septembre 2026)

Vu dans son atelier, sur The Way Out reborn : **les vignettes restent des carrés gris** — aucune
ligne ne montre ce qu'elle a fabriqué. Et la liste affiche encore l'identifiant technique d'un
modèle local (« ComfyUI · qwen21-qualite@e3563da64c0c7b8eecc0e4afc6782acb… »), ce que `RV4` avait
retiré partout ailleurs.

- [x] chaque ligne terminée montre **la vignette de ce qu'elle a fabriqué** (la première image,
      ou l'image de départ d'un clip) ; une ligne en cours montre son fantôme, une ratée sa
      marque ; une série repliée montre la vignette de sa première image
- [x] **aucun identifiant technique** : le nom lisible du modèle (celui que `RV4` affiche
      ailleurs) ; la demande de l'auteur en titre quand il y en a une, plutôt que « Image ·
      modèle »
- [x] « Création manuelle » dit quelque chose de lisible (ou disparaît s'il ne distingue rien)
- [x] un essai d'écran qui **lit l'attribut `src`** d'une vignette et vérifie qu'il pointe l'image
      d'un résultat — les essais d'avant passaient avec des carrés gris
- [x] vu au navigateur, sur un atelier jetable avec des fabrications terminées

*Fait le 23 septembre 2026.* **La vignette manquait parce que rien ne joignait, à la lecture,
ce qu'un appel avait produit.** `bibliotheque.journal()` savait dire le modèle, le prompt et le
coût d'un appel, jamais l'image qu'il avait rendue : `Appel` ne portait pas d'asset. Une seule
requête de lot (`base.premiere_image_vivante`, même forme que `rangs_vivants` pour l'écran des
dépenses) joint maintenant l'asset du plus petit rang encore vivant à chaque appel du journal —
`null` pour un appel raté, un clip vidéo (qui garde sa propre couverture), ou une image supprimée
depuis. Toujours **une requête pour tout le lot**, jamais une par ligne. Pour l'origine « travail »,
deux cas ne montraient rien alors que le résultat existait déjà sur la fiche : une image locale
terminée (`TravailImageLocale.assets`, posé à l'arrivée par `travaux_workflow.py`) et une pièce
d'équipement (`TravailEquipement.cibles[0].url`, dès qu'une case est couverte — pas seulement le
travail entier terminé, une pièce pouvant couvrir certaines cases avant les autres).

**L'identifiant technique venait d'un formateur différent de celui que `RV4` avait posé partout
ailleurs.** `nomDuModele` (Fiche.tsx) coupe la chaîne brute sur `:` et l'affiche telle quelle —
c'est lui, pas `libelleModele`, que la fusion de `SuiviDesTravaux` appelait pour la file locale et
pour le journal. `libelleModele` lit le nom que le catalogue donne, mais il faut le catalogue :
`SuiviDesTravaux` charge maintenant une fois, à son ouverture, les modèles image et vidéo
(`api.modeles`/`api.modelesVideo`, `Promise.allSettled` — l'un des deux catalogues peut échouer
sans priver l'autre de ses noms) et en tire une table `identifiant → {nom, fournisseur}` ; un
identifiant absent de la table retombe sur `nomDuModele`, pour une entrée d'avant la V2.2 ou un
modèle retiré du catalogue.

**« Création manuelle » distingue déjà quelque chose** — l'auteur d'un « Agent » — et reste tel
quel ; rien à corriger là.

**Une limite reste, et elle est de construction plutôt que d'oubli : une entrée de la file locale
qui n'est rattachée à aucun travail garde sa lettre.** La file locale « ne connaît ni [le] prompt
ni la forme des fichiers produits » de ce qu'elle exécute (`atelier/services/file_locale.py`, en
tête) — c'est la frontière qui sépare l'exécuteur générique du travail qui sait ce qu'il a
demandé. Les jobs d'animation, de 3D, de son et d'image locale posent tous `etape_locale` sur leur
travail et sont donc **dédoublonnés** avant d'atteindre l'écran (`etapesDeTravaux`, RV9 § Fait) ;
une pièce d'équipement lancée en local ne le fait pas (`travaux_equipement.py` ne l'écrit jamais
sur le travail), et reste alors visible deux fois — une fois comme travail, avec sa vraie
vignette, une fois comme entrée brute de la file locale, avec sa lettre. Corriger cela demanderait
de porter `etape_locale` sur un travail à plusieurs appels, ce qu'aucune autre nature ne fait
aujourd'hui ; ouvrir cet invariant-là n'est pas dans le périmètre de ce retour, et rien dans le
screenshot de l'auteur n'a permis de confirmer que c'est bien cette entrée-là qu'il a vue. Noté
pour la prochaine fois que la liste des fabrications est rouverte.

**Essais** : `interface/src/composants/Fabrications.test.tsx` gagne deux essais — l'un lit `src`
sur les vignettes d'une ligne « appel » (asset joint par le journal) et d'une ligne « travail »
(image locale terminée), et vérifie qu'aucune n'est réduite à une lettre ; l'autre vérifie que le
nom du modèle reste lisible (« ComfyUI · Qwen 2.1 qualité ») et que l'identifiant technique brut ne
paraît nulle part dans l'écran. `tests/test_rv9_vignette.py` (nouveau) tient le côté serveur : le
journal joint l'asset d'un appel réussi, n'en joint aucun pour un appel raté, et ne le joint plus
après une suppression. **Vu au navigateur** : atelier jetable sur 8426, un appel payé terminé —
la vignette de la liste des fabrications est la même image que celle de la Galerie (confirmé par
la requête réseau, `GET /api/assets/<id>/vignette` → 200), et le modèle se lit « essai · Essai
PNG », jamais l'identifiant brut.

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

- [x] Aucune liste de sujets ne propose « Matières ».
- [x] Une seule page gère les méthodes locales.
- [x] Un seul champ de recherche dans le Codex.

**Fait le 23 septembre 2026.** Trois décisions non tranchées par le plan, une contrainte
trouvée par un essai existant. (1) Un sujet dont la nature est une matière (`capacites.matiere`)
reste une carte du Codex quand il en porte déjà une : `App.test.tsx` (« un ancien sujet de
nature "matière" la garde affichée ») fige ce comportement depuis le rangement D4, pour que sa
fiche reste l'endroit où corriger son type — un premier essai plus large (excluant ces sujets de
`sujetsCharges` dans `Famille.tsx`) le faisait échouer, corrigé en resserrant le filtre aux
listes de travail. (2) « Animer », « livrer », « classer au montage » sont les sélecteurs de
sujet de `FabricationSuivie.tsx` (le champ « Sujet », ligne ~386 — pas
`PreparerUneFabrication.tsx`, qui ne montre pas de liste pour une animation), `Livraisons.tsx`
(`PorteeAnimation`/`PorteeSujet`) et `Montage.tsx` (« Classement de l'animation »), tous les
trois filtrés par `nomsDesNaturesMatiere` (`interface/src/natures.ts`) — la liste brute reste
gardée pour la résolution d'un identifiant déjà choisi, seule la liste proposée est filtrée.
(3) « Une seule page gère les méthodes locales » : le `<details>` de `Fabrications.tsx` qui
montait `ProfilsWorkflow` en double de Réglages › Moteurs & workflows devient un lien
(`onMethodesLocales`, nouveau prop, câblé sur `ouvrirLesReglages("moteurs")` dans `App.tsx`) ;
lancer une fabrication depuis un modèle local se fait maintenant par « Nouvelle fabrication »
(qui sait déjà choisir un workflow) plutôt que par un raccourci direct depuis la liste, retiré
avec elle. Le doublon de recherche du Codex (deux champs sur `recherche`) est retiré côté
colonne des familles ; celui de la barre d'outils reste, et cherche déjà sujets et collections.
Essais : `Famille.test.tsx` (35/35), `FabricationSuivie.test.tsx`, `Livraisons.test.tsx`,
`Fabrications.test.tsx`, `AtelierUnifie.test.tsx` au vert (le seul échec de
`FabricationSuivie.test.tsx` est la mémoire libre du moteur local, connu, hors tranche) ;
`App.test.tsx` entier, **549/549**. `essai_vocabulaire.py`, `essai_jetons.py` (mêmes 4
manquements préexistants sur `Retouche.tsx`, hors tranche), `essai_tutoiement.py` et
`essai_imports.py` au vert. `tsc --noEmit` propre. Non vérifié au navigateur.

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

- [x] Chaque exemple cité correspond à la vue **et** au nombre de directions annoncé ; un jeu qui
      n'y correspond pas est retiré ou déplacé (tableau ci-dessus).
- [x] « De dessus, stricte » dit la vérité sur les directions : soit elle passe à un personnage
      qui tourne (une image, que le jeu fait pivoter — comme la verticale), soit elle garde 4
      directions avec des exemples qui en ont 4. **À trancher par l'auteur.**
- [x] L'oblique et l'isométrique disent si elles proposent 4 ou 8 directions ; si l'atelier ne
      sait faire que 4, l'écran le dit au lieu de citer des jeux à 8.
- [x] Le texte envoyé au modèle suit les exemples corrigés, et l'écart est noté ici (*les tirages
      d'avant ne se comparent plus*).
- [x] **Chaque vue se montre en scène** : le rôdeur dans un décor construit pour cette vue (sol,
      un mur ou un obstacle, un objet), à la place du rôdeur seul sur fond gris.
- [x] **Au survol, la scène joue** : le rôdeur marche dans le décor, dans les directions de la
      vue — on comprend en deux secondes à quel jeu ça ressemble.
- [x] Les scènes sont des fichiers du dépôt, fabriqués une fois (pas à chaque ouverture), et ne
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

*Fait le 23 septembre 2026.* `atelier/domaine/vue.py` : les huit exemples corrigés comme au
tableau — Dragon Quest / EarthBound pour la face fixe, 1942 / Raiden pour la verticale,
Streets of Rage / Final Fight pour le défilement, le premier Zelda ajouté à la 3/4 (« en plus
plat »), Ultima VII / EarthBound annotés « dessinent 8 directions, l'atelier en fait 4 » pour
l'oblique, et Final Fantasy Tactics / Into the Breach en remplacement de Diablo 2 / Age of
Empires 2 pour l'isométrique, qui dessinaient 8. « De dessus, stricte » (`vue-dessus-stricte`)
passe de `QUATRE_DU_CADRE` (4 directions) à `()` — une image, `images` à 1 — exactement le
motif déjà tenu par `vue-dessus-verticale` ; sa phrase de caméra ne change pas, seule sa liste
de directions change. ⚠️ **Les tirages faits avant sur cette vue, quand elle demandait quatre
directions, ne se comparent plus aux suivants.** Vérifié que `Pose.images` (le nombre d'images
*par* direction, depuis E10) ne lit jamais `Vue.images` : aucune conséquence sur les cases déjà
remplies d'un projet. Vérifié aussi que `Univers.directions_du_jeu()` ne suit la vue que si la
liste n'a jamais été touchée à la main (E10) — un jeu existant qui a renommé ou gardé ses
quatre directions sur cette vue les garde à la relecture, sans réécriture. Aucun essai (serveur
ou écran) ne nommait `vue-dessus-stricte` en dur ; le changement ne casse rien.

Scène : `interface/src/composants/SceneDeVue.tsx`, appelée par `SaVue` (`ReglesDuJeu.tsx`) à la
place de l'ancienne `Vignette`. **Découverte en ouvrant le chantier** : les huit
`interface/public/vignettes/vue-*.png` ne portent déjà *plus* de fond gris — elles sont
transparentes depuis leur génération (E8, prompt « truly transparent alpha background ») ; le
détourage attendu du plan n'avait donc rien à retirer. `essais/decouper_sujets_de_vue.py`
recadre chacune à la boîte de son sujet plus une marge (`boite_opaque`, le même utilitaire que
le contrôle d'arrivée d'un détourage) et écrit les huit `<identifiant>-sujet.png`, commités.
Le décor (sol, un mur ou obstacle, un objet) est du CSS pur aux couleurs des jetons
(`--color-apercu-herbe`, `--color-apercu-pierre`, `--color-ilot-paille`) — pas de matière du
chantier des tuiles réutilisée : ces matières sont générées par projet dans `donnees/`, aucune
n'est un fichier du dépôt à embarquer dans l'interface. Le sol de chaque carte reprend la forme
de la dalle que sa vignette de production demandait déjà (trait fin de profil, carré plein
d'aplomb, rectangle large pour la stricte, parallélogramme pour l'oblique, losange pour
l'isométrique). Trois mouvements au survol, un par nombre de directions — 0 : pivote sur place
(`vue-face-fixe`, `vue-dessus-verticale`, `vue-dessus-stricte`) ; 2 : aller-retour avec
retournement ; 4 : marche en boucle sur le sol — animés par quatre classes `scene-vue-*`
ajoutées à `index.css`, sous `@media (prefers-reduced-motion: no-preference)` (donc rien ne
bouge si le système demande moins de mouvement, et l'écran reste lisible fixe). Ces classes
sont sciemment hors de la liste close du § Motion de `docs/DESIGN.md` : comme le fondu d'une
carte du tableau (`.paraitre`, déjà commenté « hors liste ») et la vidéo d'un clip qui se lit au
survol de sa vignette (`AnimationsDuSujet.tsx`), c'est un contenu qui montre le jeu, pas une
transition de chrome — noté en tête de la nouvelle règle dans `index.css` plutôt que laissé
implicite. `interface/src/aide.ts` (« assistant.vue ») dit la nouvelle scène en une phrase.

**Décisions prises seul, faute d'arbitrage dans le plan** : le décor reste des aplats de jetons,
pas une matière du chantier des tuiles (aucune n'est un fichier du dépôt, la génération à la
volée aurait dépensé) ; la case « N directions » de chaque carte lit désormais `directions.length`
au lieu de `images` — les deux concordaient déjà pour cinq vues sur huit, et cela rend vrai le
texte des trois vues à une image (« une image, qui tourne » plutôt que « 1 direction ») sans
inventer un champ serveur de plus.

**Pas vérifié au navigateur** : la fenêtre de session n'a pas pu ouvrir d'atelier jetable sur le
port 8430 pour cette tranche (à faire avant `RV16`, qui referait de toute façon le relevé des 26
écrans). Vérifié en revanche par la suite d'essais : `npx tsc --noEmit` propre, `ReglesDuJeu.test.tsx`
(37/37), `App.test.tsx` (547/547), `aide.test.ts` (855/855), `essai_vocabulaire.py`,
`essai_jetons.py` (mêmes 4 manquements préexistants, dans `Retouche.tsx`, hors de cette
tranche), `essai_tutoiement.py`, `essai_imports.py` et les suites serveur `test_e8/e10/e12/e13/e14.py`
(116 essais) tous verts.

---

## RV19 · L'image de départ se voit avant de choisir

**Bloquée par** : RV7, RV9 (même fenêtre). *Ajoutée le 23 septembre 2026, sur un retour de
l'auteur* : « Animer les directions » sur un personnage ; au point 2 de la fenêtre, « Image de
départ », on ne voit que « La référence existante du personnage sera proposée à la relecture »
et une liste de quatre-vingts modèles « pour créer la référence si elle manque ». « On pourrait
pas avoir les propositions déjà calculées et affichées ici ? Peut-être que ce point doit arriver
après le point 3, quand on a choisi le geste et le style de combat ? »

### Critères d'acceptation

- [x] **Dès l'ouverture, le point « Image de départ » montre, case par case, l'image qui
      partira** (la référence de la direction, sinon celle que la relecture proposerait), en
      vignette, avec « Changer » à côté. Elle est calculée par le serveur par **la même règle**
      que la relecture — pas une seconde règle côté écran.
- [x] Une case sans image le dit en clair (« aucune image pour gauche ») ; **la liste des modèles
      n'apparaît que dans ce cas**, pour ces cases-là. Quand toutes les cases ont leur image, la
      liste disparaît et laisse une phrase (*un contrôle inerte disparaît*, 8nonies).
- [x] Quand elle apparaît, la liste des modèles propose d'abord celui que le jeu recommande,
      présélectionné, et ne montre pas quatre-vingts lignes à plat (les modèles grisés restent
      grisés avec leur raison).
- [x] **L'ordre de la fenêtre suit le geste** : 1. l'animation à créer (sujet, mouvement,
      directions) ; 2. le geste et le style de combat ; 3. l'image de départ ; 4. le clip ; 5.
      l'animation à obtenir. L'image proposée se recalcule quand le mouvement ou les directions
      changent.
- [x] **« Corriger le geste » part du texte existant** (retour de l'auteur du même jour) : en
      ouvrant la correction, le champ est **rempli** avec le geste actuel, modifiable — pas
      montré en texte d'exemple grisé qu'il faudrait retaper pour changer un mot. Une correction
      qui revient au texte d'origine n'en est pas une (rien ne part en plus) ; « remettre le
      texte du mouvement » reste là.

Fait le 23 septembre 2026. Une seule route neuve, en lecture, `GET
/characters/{id}/starting-image` — elle appelle `production.image_de_depart` case par case, la
même fonction que `services/travaux.py` (`preparer`) utilise à la préparation ; aucune seconde
règle côté écran. Tranché : la liste des modèles ne se cache que sur un « oui » sûr (chaque case
a sa réponse, et c'est une image) — pendant le chargement, elle reste, pour ne jamais clignoter
sur un silence qui n'est pas une réponse ; le plan ne tranchait pas ce cas. Le modèle recommandé
réutilise `modeleParDefaut` de `ToileFabrique.tsx` (la barre d'image fixe) plutôt que d'inventer
une seconde préférence. Non vu au navigateur : le worktree n'a pas d'`interface/dist` à
reconstruire sans y toucher (règle du worktree) ; vérifié par `npx tsc --noEmit`, les essais
d'écran de `FabricationSuivie.tsx` (24/25, le 25<sup>e</sup> est l'échec connu de la mémoire
locale) et la suite entière (`App.test.tsx`, 547/547), plus quatre essais serveur neufs
(`tests/test_rv19.py`).

---

## RV20 · Un texte envoyé se copie

**Bloquée par** : aucune. *Ajoutée le 23 septembre 2026, sur un retour de l'auteur* (Galerie,
volet « Le clip » : le texte envoyé est coupé à une ligne, lisible en entier seulement dans une
bulle au survol — « je peux le lire mais pas le récupérer »).

### Critères d'acceptation

- [x] Partout où l'atelier montre un texte parti au modèle — le volet d'un clip et la fiche d'une
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
l'envoi côté image fixe (`Envoi.tsx`, à côté de « Reprendre le texte › »).

**Suite le 23 septembre 2026** : les deux derniers endroits. La fenêtre des clips
(`FabricationSuivie.tsx`) portait trois textes non copiables — la relecture d'un clip seul (« Image
de départ » et « Vidéo à fabriquer », deux `<p>` sans bouton) et, par case d'une série
(`CaseDeLaSerie`), le texte de l'image de départ tronqué à deux lignes sans recours
(`line-clamp-2`) et le texte vidéo, déjà repliable dans un `<details>` mais sans bouton
« Copier ». Les quatre passent à `TexteEnvoye` ; le `<details>` disparaît, `TexteEnvoye` portant
déjà son propre dépliage au clic. La carte de la toile (`TS5`, `Tableau.tsx`) montrait la phrase
d'une carte tronquée à trois lignes (`line-clamp-3`, sans recours ni bouton) à côté de « Reprendre
ce texte › » — remplacée par `TexteEnvoye`, le bouton de reprise restant à part sous elle.
Essais : `interface/src/composants/TexteEnvoye.test.tsx`, `FabricationSuivie.test.tsx` (24/25, le
25<sup>e</sup> est l'échec connu de la mémoire locale, hors tranche) et `Tableau.test.tsx` (9/9),
plus `App.test.tsx` entier, **549/549**. `tsc --noEmit` propre. Non vérifié au navigateur.

---

## RV21 · « Modifier la fiche » se range en onglets

**Bloquée par** : RV12 (qui y a fait entrer « Objectif & règles »), et `TS12` du plan de la toile
(qui y ajoute « Palette par défaut ») — même fenêtre. *Ajoutée le 23 septembre 2026, sur un retour
de l'auteur* : « il y a beaucoup de choses et on doit scroller très longtemps ».

### Critères d'acceptation

- [x] la fenêtre « Modifier la fiche » (`FicheDuSujet.tsx`) range ses réglages en **quelques
      onglets** nommés par ce qu'on y fait — lecture recommandée : *L'essentiel* (nom, nature,
      description, portrait), *Apparence* (recette, palette par défaut, références), *Objectif
      & règles* (poses et mouvements demandés, styles de combat), *Supprimer* ou une zone à part
      pour les gestes dangereux ; les mots viennent de `docs/vocabulaire.html` ou y entrent
- [x] aucun onglet ne défile plus que la hauteur de la fenêtre à 1080 px pour un sujet ordinaire
- [x] rien ne disparaît (*8nonies*) ; un onglet qui n'a pas d'objet pour la nature du sujet
      (capacités RG1) est absent, pas vide
- [x] ce qui est modifié dans un onglet n'est pas perdu en changeant d'onglet ; le pied de la
      fenêtre dit ce qui a changé depuis l'ouverture *(critère réécrit le 24 septembre 2026 après
      relecture : ce n'est pas un « Enregistrer » unique qui retient tout, voir plus bas)*
- [x] l'essai **referme et rouvre** la fiche avec des valeurs qui ne sont pas celles du défaut
      (*8septies*)

**Fait le 23 septembre 2026.** Quatre onglets dans `FicheDuSujet.tsx`, même forme que ceux de
`PageDuSujet.tsx` (`role="tablist"`, `role="tab"`, `aria-selected`) mais une liste à part —
`ONGLETS_FICHE`, jamais lue par `essais/essai_vocabulaire.py`, qui ne mesure que la liste fermée
`ONGLETS` de la page. *L'essentiel* : nom, description, type d'objet, ambiance, collections.
*Apparence* : recette, palette par défaut, les sept textes de style, les images d'exemple.
*Objectif & règles* : l'objectif de production, et les styles de combat (personnages seulement).
*Supprimer* : le seul geste dangereux — retirer le sujet du jeu —, encadré à part, sans plus se
cacher derrière un `<details>`. Décidé sur le tas : les styles de combat vont avec l'objectif
(« poses et mouvements demandés, styles de combat » du plan) plutôt qu'avec l'apparence ; les
collections restent dans *L'essentiel* (identité et rangement) plutôt qu'une cinquième zone.
Aucun onglet n'est jamais vide pour une nature donnée — chacun porte au moins un réglage qui
s'applique à tout sujet —, donc le cas « absent, pas vide » ne se présente pas ici : rien à
masquer par nature. `demandeEdition` et le lien « Revoir l'objectif »/« Définir l'objectif »
ouvrent maintenant directement sur l'onglet *Objectif & règles*, comme avant `RV21` où ils
visaient l'onglet de la page. Mots ajoutés à `docs/vocabulaire.html` (§ L'ossature, en prose —
pas dans la liste fermée, qui reste celle de la page). Essais : `FicheDuSujet.test.tsx` (les
essais TS12 de la palette referment/rouvrent la fiche sur l'onglet *Apparence*, inchangés dans
leur fond) et `PageDuSujet.test.tsx` mis à jour pour cliquer le bon onglet avant de lire un champ
déplacé ; `App.test.tsx` inchangé (tout ce qu'il vise vit dans *L'essentiel*, l'onglet par
défaut). Vérifié au navigateur, atelier jetable sur le port 8429, à 1080 px de haut : les quatre
onglets s'affichent sans réglage manquant, aucun défilement sur *L'essentiel*, *Objectif & règles*
ou *Supprimer* pour un sujet neuf sans images ; *Apparence* défile un peu à cause des sept textes
de style, ce qui reste très inférieur au défilement d'avant la tranche (tout sur un seul onglet).

**Corrigé le 24 septembre 2026 après relecture.** Le critère du geste unique ne tenait pas :
type, ambiance, recette, palette, styles de combat, textes de style, portrait et collections
s'enregistraient déjà au changement — seuls le nom et la description attendaient « Garder la
fiche ». Deux formes possibles : basculer tout en brouillon jusqu'à un seul geste, ou garder
l'enregistrement au changement et le dire. La première aurait touché huit chemins d'écriture
différents et cassé les essais TS12 qui vérifient l'enregistrement immédiat de la palette en la
refermant puis rouvrant ; la seconde tient le critère réel de la tranche — « rien ne se perd, on
sait ce qui a été gardé » — sans rouvrir ce que RS6/TS12/SC4 avaient déjà validé. Choisi : la
seconde. `FicheDuSujet.tsx` porte maintenant `changements`, une liste des réglages touchés depuis
l'ouverture (remise à vide par `ouvrir`), et le pied de la fenêtre l'affiche — « Modifié :
Type d'objet · Palette par défaut. Déjà enregistré. » — en distinguant le nom et la description,
qui restent seuls à attendre le bouton. Nouvel essai dans `FicheDuSujet.test.tsx` qui vérifie le
récapitulatif au fil de trois changements (type, ambiance, nom).

---

## RV22 · Ce qui n'est pas encore rangé se supprime ou s'écarte

**Bloquée par** : RV12 (le bandeau « Pas encore rangé »). *Ajoutée le 23 septembre 2026, sur un
retour de l'auteur* : « si elle ne va nulle part, elle reste là pour rien ».

### Critères d'acceptation

- [x] chaque image du bandeau « Pas encore rangé » porte, à côté de « Ranger », **« Écarter »**
      (elle quitte le sujet et retourne à la Galerie, sans être supprimée) et **« Supprimer »**
      (le geste de jugement du produit, le même que dans la Galerie, avec la même confirmation)
- [x] les deux gestes se défont (« Annuler » un instant, comme ailleurs dans l'atelier) ; aucun
      ne supprime un fichier du disque sans passer par ce que la Galerie fait déjà
- [x] le bandeau se met à jour tout de suite et disparaît quand il n'y a plus rien à ranger
- [x] l'agent (MCP) sait les mêmes gestes par les mêmes services (*T7*), s'ils ne les a pas déjà

Fait le 23 septembre 2026. **Écarter** rejoue `api.designer(asset, null, null, null)` — le même
`PUT /assets/{id}/character` à `personnage: null` que la fiche pose déjà pour détacher une image
(US-122) ; rien n'est supprimé, rien n'est payé. **Supprimer** rejoue
`api.supprimerAssetsConfirmable`, puis, sur 409 `planche_a_confirmer`, renvoie vers la Galerie
plutôt que de reposer sa question ici — un choix, pas une lacune : dupliquer l'écran de
confirmation d'une planche à deux endroits aurait ouvert la fragilité que « une question, un
document » interdit déjà pour la doc. L'annulation est la **même fente**
(`FenteAnnulation`, exportée de `BarreOutils.tsx`) que la Galerie, pas une seconde forme du même
revers : même route (`api.restaurer`), même délai compté par le serveur. Le bandeau reste monté
tant qu'une annulation y est possible, même quand il n'a plus rien à ranger — sinon supprimer le
dernier élément emporterait le seul endroit où « Annuler » se trouve ; il disparaît entier une
fois l'annulation résolue (acceptée ou expirée) et la liste vide.

Fait le 24 septembre 2026. Trois outils, sur le modèle d'`edit_asset` : `detach_asset` rejoue
`atelier.production.designer(asset, personnage=None, pose=None)` — le même service que
`PUT /assets/{id}/character` à `personnage: null` — et refuse une matière avec la même phrase que
la fiche. `delete_asset` rejoue `verifier_suppression` puis `atelier.bibliotheque.supprimer` — le
même service que `POST /assets/delete` — et remonte `planche_a_confirmer` tel quel (sa phrase,
avec le compte) ; un `confirm: true` le franchit, comme le `confirmer` de la route. `restore_asset`
rejoue `atelier.bibliotheque.annuler_suppression` — le même service que `POST /assets/restore`,
avec le même délai compté par le serveur. Décision : un outil de restauration manquait à la
liste ; sans lui, un agent qui supprime par erreur n'aurait eu aucun moyen de se défaire de son
geste, alors que l'écran en a un — ajouté pour tenir la même promesse des deux côtés.
`tests/test_rv22_mcp.py` couvre les quatre gestes : écarter puis relire, supprimer puis restaurer
(et son expiration), un identifiant inconnu, et `planche_a_confirmer`. Mis à jour aussi :
`docs/releves/2026-09-13-carte-du-serveur.md` (87 → 90 outils, les trois routes désormais
équipées d'un outil MCP).

**Corrigé le 24 septembre 2026 après relecture.** Le second critère ne tenait qu'à moitié :
« Écarter » n'avait pas d'annulation, seul « Supprimer » en portait une — un sujet né de la toile
dont la copie-portrait était détachée par erreur ne pouvait pas revenir en arrière.
`EnAttenteDuSujet.tsx` porte maintenant une seconde fente (`ecarte`, même `FenteAnnulation`,
`verbe="écarté"`), à un détail près : le délai est tenu **côté client** (8 s, comme le sursis
serveur de la suppression), parce que `designer` n'a pas de sursis serveur à décompter — il agit
tout de suite, à la différence de la suppression douce. L'annulation rattache l'image avec la
pose et la direction qu'elle portait avant Écarter — `null`/`null` la plupart du temps, puisque
c'est la définition même de « pas encore rangé », mais jamais forcées à `null` en dur : une image
« à confirmer » qui porterait une direction sans pose ne la perdrait pas. Essais mis à jour dans
`EnAttenteDuSujet.test.tsx`.

---

## RV23 · Espace agrandit toute image, partout

**Bloquée par** : aucune. *Ajoutée le 23 septembre 2026, sur un retour de l'auteur* (fiche d'un
sujet, *Ses références*, vignettes « Direction — droite / gauche » : Espace n'y fait rien). « Il
doit fonctionner partout. »

Aujourd'hui l'aperçu (`Apercu.tsx`) ne s'ouvre que sur les surfaces qui ont déclaré leur vignette
(`useVisee`) ; toute vignette oubliée reste muette, et il y en a partout.

### Critères d'acceptation

- [x] **toute image affichée par l'atelier** s'agrandit avec Espace quand le pointeur est dessus —
      vignettes de références, relectures, fenêtres, Fabrications, bandeau « Prochain geste »,
      toile, chutier… — sans que chaque écran ait à le déclarer : une surface qui déclare sa
      vignette (`useVisee`) garde sa réponse plus riche (titre, mesures, animation) ; les autres
      reçoivent une réponse par défaut tirée de l'image elle-même (son adresse affichée, sa taille
      naturelle, pixelisée si l'image l'est à l'écran)
- [x] Espace ne s'ouvre jamais pendant qu'on écrit dans un champ, et ne vole pas l'Espace d'un
      écran qui s'en sert déjà (le lecteur d'une animation, l'éditeur de pixels, la toile qui
      glisse la vue)
- [x] un essai parcourt quelques vignettes **qui ne déclaraient rien** (dont celles de *Ses
      références*) et vérifie que l'aperçu s'ouvre sur la bonne image

*Fait le 24 septembre 2026.* Le repli vit dans `Apercu.tsx` (`sujetDuRepli`, `elementDuRepli`) :
sans visée déclarée, Espace reprend **l'image ou la vidéo sous le dernier pointeur connu**
(`document.elementsFromPoint`, suivi en continu par un `pointermove` sur `window`, sans jamais
provoquer de rendu), son adresse affichée (`currentSrc` puis repli sur `src`), sa taille
naturelle, pixelisée si son `image-rendering` calculé l'est. Une visée déclarée garde toujours la
priorité (`vise ?? sujetDuRepli()`). **Deux décisions non tranchées par le plan.** (1) *La taille
minimale des icônes écartées* : 28 px, entre les boutons d'icône du produit (22 px au plus) et la
plus petite vignette qui montre vraiment un sujet, celle d'une référence promue sur la fiche
(34 px, `ImagesDuSujet.tsx`) — le cas que l'auteur a signalé muet, et qu'un seuil plus prudent
aurait laissé muet quand même. (2) *Ne pas voler l'Espace des surfaces qui s'en servent déjà* :
`AtelierDeBande.tsx` et `Montage.tsx` portaient déjà un marqueur sur leur racine
(`data-atelier-de-bande`, `data-montage`), repris tel quel ; `SurfaceZoomable.tsx` n'en avait
aucun, et en reçoit un (`data-surface-zoomable`), seul fichier de la liste surveillée touché par
cette tranche. `GrilleEcoute.tsx` n'a rien à exclure : ses tuiles sont des ondes en SVG, hors du
filtre `<img>`/`<video>` du repli. `document.elementsFromPoint` manque entièrement à jsdom (vérifié :
la propriété n'existe pas sur `document`) ; le repli s'en tait plutôt que de jeter — c'est pour ça
qu'aucun des 551 essais déjà écrits d'`App.test.tsx` ne pouvait basculer en silence sur le repli,
et il en fallait un neuf, `Apercu.test.tsx`, qui fournit lui-même un double
d'`elementsFromPoint`. Essais : `Apercu.test.tsx` (4/4, un essai désarmé à la main confirme qu'il
tombe sans le correctif — 8octies), `ImagesDuSujet.test.tsx` (61/61, `SesReferencesParUsage`
exportée pour le monter tel quel), `App.test.tsx` (551/551), `Decoupe.test.tsx`,
`AtelierUnifieRetouche.test.tsx`, `SerieSon.test.tsx`, `Retouche.test.tsx` (140/140 — les écrans qui
embarquent `SurfaceZoomable`). `tsc --noEmit`, `essai_vocabulaire.py`, `essai_jetons.py`,
`essai_tutoiement.py`, `essai_imports.py` propres. **Pas vu au navigateur** : le worktree n'a pas
d'`interface/dist` (règle de la tranche, pour ne pas gêner les quatre autres agents) ; à confirmer
sur un atelier construit hors worktree. `Toile.tsx` (glisser la vue) n'a aucun geste Espace à lui —
vérifié à la lecture, aucun marqueur n'y était donc nécessaire.

---

## RV24 · La table « Couleurs » montre les couleurs de l'image

*Ajoutée le 24 septembre 2026, sur un retour de l'auteur en retouchant un bus* : « dans la grille
des couleurs affichée, il n'y a pas le vert que je vois sur l'image ».

**La cause, lue dans le code** : les pastilles de « couleurs gardées » et de « celle qui part /
celle qui vient » (`Retouche.tsx`, `CouleursGardees` et `TableDEchange`) montrent **la palette du
jeu** (`univers.palette`), jamais les couleurs de l'image qu'on retouche. Une couleur présente dans
l'image mais absente de la palette du jeu ne se choisit donc pas au clic, alors que c'est justement
celle qu'on veut garder ou remplacer.

### Critères d'acceptation

- [x] les pastilles proposent d'abord **les couleurs de l'image telle qu'elle sort de la
      réduction**, puis la palette du jeu, sous deux petits titres qui disent laquelle est laquelle
- [x] « celle qui part » se choisit aussi **à la pipette, en cliquant dans l'image**, comme la
      couleur à retirer d'un détourage
- [x] les couleurs de l'image viennent du serveur, qui les calcule déjà
      (`couleurs_obtenues`, `atelier/image/palette.py`), pas d'une lecture de pixels dans le navigateur
- [x] un essai retouche une image qui porte une couleur hors de la palette du jeu, et la trouve
      dans les pastilles ; il tombe sans le correctif (*8octies*)

*Fait le 24 septembre 2026.* `atelier/image/palette.py` gagne `couleurs_visibles` (les mêmes
pixels que `couleurs_obtenues`, triés par fréquence) ; `_couleurs_de` (`atelier/services/assets.py`)
rend `couleurs.liste`, sur `_taches_de`/`apercu_recette` — donc sur `/spots` **et**
`/recipe/preview`, qui suit déjà le brouillon en cours sans aller-retour supplémentaire. La pipette
de « celle qui part » vise un point du **rendu final** (pas une passe de détourage) : un champ
`viser` ajouté à `CorpsApercuRecette`, résolu en couleur par `_couleur_au_point` et rendu dans
`couleurs.visee` — `None` sur un point transparent ou hors image, jamais une couleur inventée. Côté
écran, `CouleursGardees` et `TableDEchange` reçoivent maintenant `couleursImage` en plus de
`palette`, groupées par `GroupesDeCouleurs` sous deux titres ; la pipette (bouton « pipette › »)
n'est proposée que sur une paire déjà nommée — pas sur celle en train de se faire, qui n'a pas
encore de rang dans `echanges` — c'est la seule réduction de portée du critère. Six essais serveur
(`tests/test_rv24_couleurs.py`) et deux essais écran (`Retouche.test.tsx`, describe RV24). Non vu
au navigateur : seulement vérifié par essais doublés.

## RV25 · Le fond enfermé dans le sujet se voit, et s'enlève

*Même retour, même image.* Le vert vif vu dans les vitres du bus est **le fond vert de l'image
brute**, vu à travers les vitres. Vérifié sur l'image enregistrée : détourée par le modèle
(`u2net`), elle garde quatre verts dans son rendu, dont `#3ca649` sur environ 2 000 pixels. Le
modèle découpe l'objet entier, vitres comprises ; le détourage « bord » ferait pareil, puisqu'il
n'enlève que le fond **relié au bord de l'image** (`detourer_bord`, `atelier/image/traitement.py`)
— c'est voulu, pour garder le blanc d'un os ou le reflet d'une fiole. Une poche de fond enfermée
par le sujet reste donc opaque, quel que soit le moteur, et rien ne le dit. Le moyen de l'enlever existe déjà : une passe « couleur », en cliquant
le vert, avec « Où retirer : partout ». Il n'est simplement proposé nulle part.

### Critères d'acceptation

- [x] après tout détourage (bord ou modèle), quand des pixels de la couleur du fond restent opaques à
      l'intérieur du sujet, la table le dit en une phrase (« des morceaux du fond restent dans le
      sujet : 3 zones ») et propose « les retirer aussi »
- [x] ce bouton ajoute la passe « couleur » déjà existante (couleur du fond visée, « partout »),
      sans nouveau moteur ; elle s'annule comme toute passe
- [x] un sujet qui porte légitimement une couleur proche du fond n'est jamais retouché sans ce
      clic : la phrase propose, elle n'agit pas
- [x] le compte des poches se fait côté serveur, de façon déterministe, et un essai le vérifie sur
      une image qui a une poche enfermée et sur une qui n'en a pas

*Fait le 24 septembre 2026.* La mesure vit dans `atelier/image/taches.py::zones_de_fond_enferme` —
tolérance serrée et fixe (16, indépendante du réglage de l'auteur), poches de moins de neuf pixels
écartées comme du bruit — et se lit sur le **rendu final**, jamais sur l'image avant les bords :
un fond enfermé par un modèle de silhouette reste opaque quoi qu'il arrive ensuite. La couleur
visée est celle qu'une passe « bord » a déclarée (`couleur_du_jeu`) si elle existe, sinon la
médiane des bordures de l'image brute — la même devinette que `detourer_bord` ferait. Rendue par
`_fond_enferme_de` dans `atelier/services/assets.py`, ajoutée à la réponse existante de
`_taches_de` (`GET /spots`, `POST /recipe/preview`) : aucune route neuve. Le point qu'une passe
« couleur » viserait est calculé côté serveur (`_point_du_bord`, `atelier/image/traitement.py`) —
un pixel réel de la couleur visée, jamais une moyenne, puisque `detourer_couleur` lit un pixel. Le
bouton compose la passe avec `PASSE_PAR_DEFAUT` (tolérance 28, la valeur par défaut du produit —
pas celle, plus serrée, de la mesure) ; rien à l'écran ne montre les poches une à une, seulement
leur compte, donc la mesure ne construit jamais la liste — un simple compteur, plus rapide sur une
image bruitée. Douze essais serveur (`tests/test_rv25_fond_enferme.py`, mesure seule et bout en
bout par `/spots`) et trois essais d'écran (`Retouche.test.tsx`, § RV25) ; `Retouche.test.tsx` en
entier (111) et les essais serveur de détourage existants (`test_e3.py`, `test_b18_detourer.py`,
`test_d3.py`, `test_e5.py`, `test_rv24_couleurs.py`) passent sans régression. Non vérifié au
navigateur réel — seulement par les essais doublés.

---

## RV26 · L'agrandissement d'Espace passe devant les fenêtres

*Ajoutée le 24 septembre 2026, sur un retour de l'auteur* : dans « Modifier la fiche », Espace sur
une vignette ouvre l'agrandissement **derrière** la fenêtre.

**La cause, lue dans le code** : `CadreDialogue.tsx` ouvre ses fenêtres par `showModal()`, qui les
pose dans la couche du dessus du navigateur ; l'aperçu (`Apercu.tsx`) est un `fixed z-50` de la page
ordinaire, et aucun `z-index` ne passe devant cette couche.

### Critères d'acceptation

- [x] l'agrandissement ouvert depuis une fenêtre (fiche du sujet, et toute fenêtre de `CadreDialogue`)
      passe devant elle ; hors fenêtre, rien ne change
- [x] Échap ferme l'agrandissement **seul**, sans fermer la fenêtre qui est dessous
- [x] le focus revient dans la fenêtre à la fermeture
- [x] un essai d'écran ouvre l'agrandissement depuis une fenêtre et vérifie qu'il est dans la couche
      du dessus (ou monté dans la fenêtre) ; il tombe sans le correctif (*8octies*)

**Fait le 24 septembre 2026.** `Apercu.tsx` s'ouvre désormais lui-même par un `<dialog>` porté en
`showModal()` (portail vers `document.body`, exactement le patron de `CadreDialogue`), au lieu d'un
`fixed z-50` de la page ordinaire — c'est ce qui le fait passer devant une fenêtre déjà ouverte, la
couche du dessus ignorant tout `z-index`. Piège trouvé en le construisant : l'UA-stylesheet du
`<dialog>` fixe `width/height: fit-content` (pas `auto`), donc `fixed inset-0` seul ne suffit pas à
le faire remplir l'écran — il lui faut aussi `h-full w-full`, comme `CadreDialogue` le fait déjà pour
son format « atelier ». Échap reste intercepté en capture sur la fenêtre (`useApercu`, geste déjà en
place depuis RV23) *avant* d'atteindre un `<dialog>` quel qu'il soit : aucun `cancel` natif ne part,
ni sur l'aperçu ni sur la fenêtre dessous — un `onCancel` défensif est posé sur l'aperçu par parité
avec `CadreDialogue`, mais ne se déclenche jamais en pratique. Le focus qui revient dans la fenêtre
à la fermeture est la sémantique native du `<dialog>` (même mécanisme, non écrit à la main, que
`CadreDialogue` utilise déjà) — **non vérifiable au navigateur cette fois** : une reproduction
minimale, un `<dialog>` isolé sans rapport avec ce dépôt, montre que le Chromium de ce panneau de
navigateur ne restaure le focus après `close()` dans aucun cas, y compris sur `CadreDialogue` seul,
non modifié ici — un artefact de l'outillage d'automatisation, pas une régression de ce correctif.
Deux essais neufs dans `Apercu.test.tsx` (« RV26 — l'agrandissement passe devant une fenêtre
ouverte ») : le premier vérifie que l'aperçu est un `<dialog>` monté par `showModal()` — vérifié qu'il
tombe si on défait le correctif (*8octies*, `apercu?.tagName` reste `"DIV"` sans lui) ; le second
vérifie qu'Échap ne ferme que l'aperçu et n'appelle jamais l'`onFermer` de la fenêtre dessous. Au
navigateur (atelier jetable, port 8431, dossier de données jetable, interface en `npm run dev` — pas
de `dist` dans le worktree) : sujet créé sans frais avec une image importée, « Modifier la fiche »
ouverte, Espace sur sa vignette — `document.elementFromPoint` sur un point recouvert par la fenêtre
retombe bien sur l'aperçu, capture à l'appui. `essai_docs.py`, `essai_vocabulaire.py` et
`essai_tutoiement.py` passent ; seul échec du cran rapide, `tests/test_rp17.py` (404 au lieu de 405,
`interface/dist` absent du worktree — pas de cette tranche, `regles-communes.md` le nomme déjà).

---

## RV27 · « Relire avant l'envoi » : la colonne des images tient son texte

*Ajoutée le 24 septembre 2026, sur un retour de l'auteur* : dans « Relire avant l'envoi », la colonne
de droite est trop étroite et le texte en sort.

**La cause, lue dans le code** : `Envoi.tsx` pose la colonne « Images envoyées » en largeur fixe
(`grid-cols-[minmax(0,1fr)_300px]`) et les phrases qui décrivent chaque image, en police à chasse
fixe, ne passent pas à la ligne : elles débordent, et la page gagne un défilement horizontal.

### Critères d'acceptation

- [ ] la colonne des images est assez large pour lire une vignette, son rôle et sa phrase sans
      déborder, à 1920 px comme à 1280 px de large
- [ ] les phrases longues passent à la ligne ; aucun défilement horizontal dans l'écran
- [ ] « Consignes facultatives », dans la même colonne, suit la même règle
- [ ] un essai d'écran vérifie que les phrases passent à la ligne (la classe ou le style qui le
      permet), et il tombe sans le correctif

---

## RV16 · La maquette, remesurée

**Bloquée par** : RV6, RV8, RV9, RV10, RV11, RV12, RV13, RV14, RV15, RV17, RV18, RV19, RV20, RV21, RV22, RV23, RV24, RV25, RV26, RV27.

### Ce qu'on livre

La comparaison écran par écran avec la maquette validée, refaite comme le 13 septembre (26
écrans : tenu, en partie, absent), au navigateur sur un atelier jetable. Elle dit ce que ce
chantier a réellement fermé, et ce qui reste.

### Critères d'acceptation

- [ ] Un relevé daté dans `docs/releves/`, sur les 26 écrans, avec la même grille que celui du
      13 septembre.
- [ ] Chaque écart restant est nommé, avec l'écran où on le voit.
- [ ] Le tableau d'état de `docs/PLAN.md` reprend le compte.
