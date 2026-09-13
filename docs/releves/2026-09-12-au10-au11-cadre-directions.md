# AU10 / AU11 — les deux derniers critères, sans GPU

Suite de `2026-09-12-implementation-atelier-unifie.md` § « Sources locales et 3D ».
Cette passe ferme ce qui se prouve sans GPU et sans écrire chez asset3d ; elle
n'avait ni l'un ni l'autre à disposition.

## AU10 — fermé

« L'intégration s'éprouve avec asset3d sans modifier automatiquement son
environnement. »

Preuve : `tests/test_au10_environnement.py`. Le pont (`atelier/pont_asset3d.py`,
fonction `charger_asset3d`) est chargé contre le vrai dossier `asset3d` voisin,
et une empreinte (taille + date de modification de chaque fichier, hors `.git`
et environnements virtuels) est comparée avant/après : aucun octet ne change,
aucun `__pycache__` n'apparaît. Un second essai charge un dossier voisin
factice ne contenant que le fichier vérifié à l'entrée : le chargement échoue
en cherchant les vrais modules du voisin, sans qu'aucun fichier n'y soit écrit
entre-temps. Le test contrôle aussi que `DOSSIER_ESSAIS`, `DOSSIER_PERSONNAGES`,
`DOSSIER_R2` et `JOURNAL_SERVICE_RIG` pointent tous sous le dossier de données
du pont (jamais chez le voisin), que son service de rig persistant reste
désactivé, et que `HF_HUB_OFFLINE` / `TRANSFORMERS_OFFLINE` valent bien `1`
avant tout sous-processus.

Lancé : `pytest tests/test_au10_environnement.py -q` → 2 passés.
La case AU10 correspondante est cochée dans `docs/PLAN-atelier-unifie.md`.

## AU11 — fermé en partie

« Le rendu conserve cadre, pivot et dimensions cohérents entre les directions
demandées. »

**Ce qui est prouvé.** Les dimensions du canevas (largeur × hauteur mesurées à
l'import) sont maintenant comparées entre les directions d'un même modèle et
d'un même mouvement : `ServiceSources3D.importer` (`atelier/services/sources_3d.py`)
refuse l'import d'une direction dont les dimensions diffèrent de celles déjà
importées pour le même personnage externe et la même animation, plutôt que de
composer silencieusement une planche à l'échelle inégale. Deux mouvements
différents peuvent avoir des dimensions différentes (le contrôle ne compare
que les directions d'un même mouvement). Preuve : `tests/test_au11_directions.py`,
trois essais avec un moteur doublé (trois directions cohérentes acceptées, une
direction à un autre cadre refusée et rien n'est écrit, deux mouvements
distincts autorisés à différer) — `pytest tests/test_au11_directions.py -q` →
3 passés.

**Ce qui reste ouvert : cadre (échelle de caméra) et pivot.** Le contrat HTTP
d'asset3d (`GET /api/personnages/{id}/rendus`, `.../rig.glb`, `/api/atelier/…`)
ne renvoie ni l'échelle de caméra orthographique (`ortho_scale`) ni le point
visé (`centre_vue`) calculés par `asset3d/blender/rendu.py` — seul un journal
interne au voisin les garde (`rapport["cadrage"]`, jamais exposé à l'atelier).
Sans cette donnée, l'atelier ne peut ni la lire ni la comparer entre deux
directions : le calcul reste entièrement invisible du côté API.

Plus grave, à la lecture du script (`asset3d/blender/rendu.py`, lignes 512 à
601) : cette échelle et ce pivot sont recalculés **indépendamment à chaque
rendu**, à partir de la silhouette projetée sur les seuls axes de la caméra de
*cette* direction (`vue_lo`/`vue_hi`, projection sur `droite`/`haut`). Deux
directions d'un même mouvement peuvent légitimement projeter des étendues
différentes (un personnage vu de face est plus large que vu de profil), ce qui
peut donner un `ortho_scale` différent d'une direction à l'autre — donc un
personnage rendu à une échelle visiblement différente selon la direction, même
si les pixels de sortie ont la même résolution. Rien dans ce dépôt ne peut
vérifier ni corriger ce point sans rendu réel : le calcul vit dans le dossier
`asset3d/blender/rendu.py` du projet voisin, hors du dépôt de l'atelier, et le
corriger reviendrait à modifier son environnement — exactement ce qu'AU10
interdit de faire automatiquement.

**Gestes à faire sur le GPU de l'auteur, pour clore ce point :**

1. Depuis l'atelier (ou directement via le pont), lancer un modèle 3D puis un
   rig une fois, avec un mouvement qui a plusieurs directions déclarées dans
   l'objectif du personnage (par exemple « marche » avec est/sud/nord/ouest).
2. Lancer un rendu pour chacune de ces directions, mêmes réglages (taille,
   cadrage, éclairage) sauf l'angle/la caméra.
3. Ouvrir les PNG produits (ou les frames importées comme sources 3D) et
   comparer, à l'œil ou en mesurant la hauteur du personnage en pixels dans
   chaque image : si la taille apparente du personnage varie sensiblement d'une
   direction à l'autre, c'est la confirmation du risque ci-dessus.
4. Si le risque est confirmé et gênant en pratique : corriger
   `asset3d/blender/rendu.py` pour calculer `ortho_scale` et `centre_vue` à
   partir d'une mesure indépendante de la direction (par exemple le rayon de la
   boîte englobante 3D complète du personnage, mesurée une fois toutes
   directions confondues, plutôt que la projection 2D propre à chaque caméra),
   puis exposer ce calcul dans le contrat HTTP (`rendus()` ou le rapport de
   l'essai) pour que l'atelier puisse un jour le vérifier automatiquement.
   Cette correction touche le projet voisin, pas ce dépôt : elle sort du
   périmètre d'une session qui n'a pas le droit d'écrire dans son
   installation.

Tant que ce point n'est pas rejoué avec un vrai GPU, la seconde puce du
critère AU11 reste décochée dans `docs/PLAN-atelier-unifie.md` ; seule la
comparaison des dimensions y est acquise.

## Le mode d'emploi de la mesure (13 septembre 2026)

Ce qui manquait pour clore AU11 est une carte graphique, pas du code. Cette
tranche n'a pas de carte graphique non plus — elle n'a donc **rien fermé** —
mais elle écrit le script qui fait la mesure décrite plus haut à la place de
l'auteur, pour qu'il n'ait qu'une commande à lancer et un texte à lire, sans
avoir à comprendre le pont vers asset3d ni son contrat HTTP.

**Ce que fait ce script.** Il fabrique, via l'atelier, un petit personnage 3D
chez asset3d, un squelette, puis un rendu de sa marche dans trois directions
(nord, est, sud). Il regarde ensuite les images obtenues et mesure deux
choses sur les pixels reçus : la taille du personnage à l'écran, et la
position de ses pieds dans l'image. Si ces deux mesures se ressemblent d'une
direction à l'autre, le cadrage est cohérent. Si l'une des trois directions
donne un personnage nettement plus petit, plus grand, ou avec les pieds
ailleurs dans l'image, le script le dit et chiffre l'écart.

**Ce que ça coûte.** Rien en argent : l'image de départ est un petit dessin
fabriqué par le script lui-même (pas une photo ni une image générée), et
aucun appel n'est fait à un service payant à aucune étape. Le seul coût est
le temps de calcul sur la carte graphique de l'auteur et l'électricité que ça
consomme — le script l'annonce avant de commencer et demande de taper « oui »
pour continuer ; il ne lance rien sans cet accord. Comptez, en tâtonnant sur
une machine qu'on n'a pas encore mesurée, quelque chose comme 15 à 40 minutes
pour les trois rendus (le modèle et le squelette ne se calculent qu'une fois,
les rendus suivants sont plus rapides).

**Avant de lancer un vrai calcul**, il est prudent de vérifier que le script
lui-même n'est pas cassé, sans rien payer ni rien attendre — une répétition à
blanc, qui ne parle à personne :

    .venv\Scripts\python.exe essais/essai_au11_cadre_directions.py --repetition

Cette commande affiche en toutes lettres « aucun rendu réel, ceci est une
répétition », déroule le même parcours avec une doublure qui invente des
images cohérentes, et se termine en quelques secondes sur un verdict
« COHÉRENT ». Si elle échoue ou plante, la mesure réelle ne marchera pas non
plus — inutile de solliciter le GPU avant de corriger ça.

**Pour la mesure réelle**, il faut d'abord qu'asset3d tourne sur la machine
(c'est l'installation voisine, avec sa propre carte graphique et son propre
lancement — ce script ne la démarre pas). Une fois asset3d lancé :

    .venv\Scripts\python.exe essais/essai_au11_cadre_directions.py

Le script vérifie l'adresse (par défaut `http://127.0.0.1:8000` ; `--adresse`
pour une autre), affiche l'annonce de coût ci-dessus, attend le « oui », puis
affiche sa progression étape par étape (modèle, squelette, rendu de chaque
direction). À la fin, il imprime un tableau — une ligne par direction, avec la
taille du personnage en pixels et la position de ses pieds — suivi d'un
verdict :

- **COHÉRENT** : les trois directions se ressemblent d'assez près. Cela ne
  ferme pas encore AU11 tout seul (le critère demande une lecture humaine du
  résultat), mais donne une base solide pour cocher la seconde puce du plan
  — à faire à la main, avec ce relevé en référence, pas automatiquement par
  ce script.
- **INCOHÉRENT** : le script donne la ou les directions en cause et l'écart
  chiffré (par exemple « la taille apparente varie de 18 % entre "est" et
  "nord" »). C'est la confirmation du risque décrit plus haut — le calcul de
  cadrage d'asset3d dépend de la caméra de chaque direction. La correction se
  ferait alors dans le projet voisin (`asset3d/blender/rendu.py`), pas dans ce
  dépôt : voir la puce 4 des « gestes à faire » ci-dessus.

Dans les deux cas, le résultat détaillé reste sur le disque dans
`essais/resultats_au11_cadre/mesures.json` (ce fichier-là revient dans Git ;
les images de rendu, non — voir `.gitignore`), et peut être relu plus tard sans
relancer le calcul.

**Ce que ce relevé ne fait toujours pas** : cocher la seconde puce d'AU11 dans
`docs/PLAN-atelier-unifie.md`. Elle reste à cocher par l'auteur, après avoir lu
un vrai verdict — pas par cette tranche, qui n'a pas pu produire ce verdict
faute de GPU.
