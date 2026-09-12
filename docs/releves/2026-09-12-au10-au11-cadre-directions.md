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
