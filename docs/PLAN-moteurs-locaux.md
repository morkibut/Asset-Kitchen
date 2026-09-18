# Les moteurs d'image locaux — les styles de sc-clone dans l'atelier

> Chantier proposé le 18 septembre 2026, à la demande de l'auteur : *pouvoir générer une image
> sur la carte graphique, avec les moteurs et workflows de `sc-clone`, et une image de référence.*
> Plan seulement : rien n'est codé.
> Quel modèle sur quelle tranche : [PLAN-moteurs-locaux-affectation.md](PLAN-moteurs-locaux-affectation.md).

## En une phrase

L'atelier sait déjà faire tourner un graphe ComfyUI, mais on doit le lui coller à la main et il
n'en a aucun. On lui donne les **22 styles de sc-clone tout prêts**, qui prennent une **image de
référence**, et qui apparaissent dans la liste des modèles comme n'importe quel autre — à 0 $,
avec un temps annoncé au lieu d'un prix.

## Ce qui existe (relevé du 18 septembre 2026)

**Dans l'atelier (gag2)** — la plomberie est là, le contenu manque :

- Un **profil de workflow** = un graphe ComfyUI au format API + des *liaisons* (quel champ reçoit
  le texte, la largeur, la référence n° 0…). Il s'importe depuis l'écran *Les workflows locaux*,
  reçoit une version (empreinte), et devient un modèle `ComfyUI:<nom>@<version>` dans le
  catalogue. Il passe par la **file locale** (une étape GPU à la fois, reprise après
  redémarrage) et par le chemin normal d'une génération (`generer_suivi`). L'agent a la même
  chose (`prepare_workflow_image`).
- Un **diagnostic** lit `/object_info` et dit ce qui manque (nœud absent, fichier absent).
- **Aucun profil n'est installé** (`donnees/profils-workflow/` n'existe pas).
- **Trois manques** qui empêchent d'y mettre les styles de sc-clone tels quels :
  1. **Pas de graine.** Le graphe est figé : deux demandes identiques rendent la même image.
  2. **Les fichiers sont écrits en dur.** Le graphe nomme `z_image_turbo_bf16.safetensors` ; sur
     ta machine, la moitié des fichiers s'appellent `D-disk\…` (jonctions de sc-clone). Un
     graphe écrit ailleurs ne tournerait pas ici.
  3. **Une référence est obligatoire ou absente.** Le format exige *exactement* N images
     (`references_min == references_max`). Un style ne peut donc pas prendre une référence
     *quand on en a une*.

**Dans sc-clone** — le contenu est là :

- `lib/catalog.mjs` : **22 styles** = un LoRA + le moteur de base qu'il exige, son mot
  déclencheur, sa force, son nombre d'étapes, et ce qu'il produit (sprite, planche, icône, tuile,
  objet). Les fichiers sont **retrouvés par motif** dans ce que ComfyUI expose, en préférant la
  meilleure quantification.
- Quatre constructeurs de graphe, un par famille :

  | Famille | Fichier | Temps mesuré | Styles |
  |---|---|---|---|
  | Z-Image Turbo | `lib/zimage.mjs` | ~30 s | 3 |
  | FLUX.2 Klein (4B et 9B, distillé ou base) | `lib/flux2.mjs` | 37 s à 3 min | 7 |
  | FLUX.1-dev (GGUF) | `lib/flux1.mjs` | 3 à 6 min | 6 |
  | SDXL | `providers.mjs` (`makeWorkflow`) | ~30-40 s | 6 |

- `lib/seamless.mjs` : la **texture raccordable** (deux nœuds, toujours ensemble — mesuré).
- `scripts/models.json` + `install-models.mjs` : téléchargement vérifié des poids.

**Sur ta machine, ce soir** : ComfyUI répond sur 8188 et **les 22 styles ont tous leurs fichiers
et leurs nœuds** (script de relevé lancé contre `/object_info`).

## L'image de référence — ce que chaque moteur sait vraiment faire

C'est le point qui décide du plan. Il y a **deux choses différentes** derrière « référence », et
l'écran ne doit pas les confondre :

| | **Garder ce sujet** | **Partir de cette image** |
|---|---|---|
| Ce que fait le modèle | Il *regarde* l'image et redessine le même personnage dans une autre pose, un autre angle | Il *repeint par-dessus* l'image : même silhouette, même cadrage, plus ou moins transformés |
| Comment | `ReferenceLatent` (natif ComfyUI) | l'image remplace le bruit de départ (`VAEEncode`, force réglable) |
| Plusieurs images | oui | une seule |
| Moteurs | **FLUX.2 Klein** (les 7 styles) | les quatre familles |

- **FLUX.2 Klein** est le seul des quatre à savoir *garder un sujet* à partir d'images — c'est un
  modèle d'édition. Les nœuds sont présents chez toi. C'est lui qui portera les références des
  sujets (celles de la fiche, avec leur usage `planche` / `direction:…` du chantier RS).
- **Z-Image, FLUX.1-dev, SDXL** : seulement *partir de cette image*. Utile pour repeindre un
  croquis, pas pour garder un personnage.
- Pistes écartées pour l'instant, faute de poids installés : **Redux** pour FLUX.1 (le modèle de
  style manque) ; **IP-Adapter** pour SDXL (nœuds présents, poids non vérifiés).
- Une référence PNG transparente est **posée sur du blanc** avant l'envoi : le chargeur de
  ComfyUI jette la transparence (appris dans sc-clone).
- Règle 4 d'`AGENTS.md` inchangée : ce que l'auteur a joint ne cède jamais. Si l'auteur joint
  deux images à un style qui n'en prend qu'une, l'appel est refusé **avant** de lancer, avec la
  phrase qui dit pourquoi ; les références que le produit ajoute de lui-même cèdent et sont
  montrées (`hors_plafond`).

## Les décisions

1. **Un style de sc-clone devient un profil de workflow ordinaire.** Pas de second fournisseur,
   pas de seconde file : on réutilise la version, le diagnostic, la file locale, le chemin de
   génération et l'agent. Ce qui est nouveau, c'est *qui écrit le profil* : l'atelier, à partir
   du catalogue, au lieu de l'auteur à la main.
2. **Les constructeurs de graphe sont portés en Python**, dans l'atelier. sc-clone reste la
   source où l'on mesure ; on ne l'importe pas à l'exécution (un autre langage, un autre dépôt).
3. **Les fichiers sont retrouvés au moment de l'installation du style**, par motif, contre
   `/object_info` — et écrits dans le profil. Si l'auteur déplace ses poids, *réinstaller* le
   style produit une nouvelle version ; les anciennes générations gardent la leur.
4. **Un profil peut déclarer plusieurs graphes, un par nombre de références** (0, 1, 2…).
   C'est la seule extension du format. Le catalogue annonce alors `references_min = 0` et
   `references_max = N`, et le reste de l'atelier (plafond, tiroir *qu'est-ce qui part avec ?*)
   fonctionne sans changer.
5. **La graine devient une liaison connue**, tirée au hasard à chaque appel et **enregistrée sur
   la génération** — pour pouvoir refaire la même image. Vaut aussi pour les profils importés à
   la main.
6. **Le mot déclencheur du style part en tête du texte**, visible dans *Relire avant l'envoi*.
7. **Le bouton porte un temps, pas un prix** (règle 8ter) : celui mesuré par famille, puis celui
   de la machine dès qu'un premier tirage a eu lieu. Le premier tirage d'une série charge le
   modèle ; le temps ne se multiplie pas.
8. **Aucun poids n'est téléchargé par l'atelier** (critère AU7 déjà coché). Un style auquel il
   manque un fichier est grisé avec la liste de ce qui manque et la commande de sc-clone qui
   l'installe.
9. **Les 22 styles sont tous proposés**, rangés sous leurs quatre moteurs et repliés par
   défaut (choix de l'auteur, 18 septembre 2026).
10. **Toutes les tranches s'ouvrent tout de suite, dans l'ordre** : les autres chantiers sont
   arrêtés, ML5 n'attend donc plus la remise à plat (choix de l'auteur, 18 septembre 2026).

## Les tranches

### ML1 · La graine, et un profil qui prend 0 à N références (serveur)

Le format des profils, seul. Rien de visible encore, mais tout le reste en dépend.

- [x] une liaison `graine` : tirée à chaque appel, enregistrée sur la génération, relue sur la
      fiche de l'image ; un profil sans liaison `graine` marche comme aujourd'hui
- [x] un profil peut déclarer un graphe par nombre de références ; le catalogue annonce
      `references_min` / `references_max` en conséquence ; un profil à un seul graphe est relu
      sans migration et garde sa version
- [x] une référence PNG transparente est posée sur blanc avant le dépôt chez ComfyUI
- [x] essais : deux appels identiques envoient deux graines différentes ; 0, 1 et 2 références
      choisissent le bon graphe ; trop d'images jointes par l'auteur → refus avant la file

### ML2 · Le catalogue des 22 styles, installé en un geste (serveur)

- [x] le catalogue de sc-clone porté tel quel (familles, styles, motifs, déclencheurs, forces,
      étapes, genre produit, temps mesuré) ; une ligne par style, comme dans sc-clone
      (`atelier/fournisseur/catalogue_styles.py`, déjà porté avant cette tranche)
- [x] les quatre constructeurs de graphe portés, **sans** référence d'abord ; ils produisent un
      profil ordinaire que `normaliser` accepte (`atelier/fournisseur/styles_locaux.py`)
- [x] la recherche des fichiers par motif contre `/object_info`, meilleure quantification
      d'abord ; ce qui manque est nommé en français (« le LoRA de style », « l'encodeur T5 »)
      (`resoudre`/`inventaire`/`qualite` dans `catalogue_styles.py`)
- [x] une route *installer ce style* / *installer tous les styles prêts* ; installer deux fois
      sans rien changer ne crée pas de version (`POST /api/workflow-profiles/styles/{id}/install`,
      `POST /api/workflow-profiles/styles/install`, `GET /api/workflow-profiles/styles`,
      outil MCP `install_local_styles`)
- [x] essais sans ComfyUI (`/object_info` doublé, relevé réel de la machine gardé en fixture) ;
      **les graphes produits sont comparés structurellement à ceux de sc-clone** pour une
      même entrée, sur un style par famille (`tests/test_ml2.py`, `tests/donnees/`)

### ML3 · Les références (serveur)

- [ ] **Klein — garder ce sujet** : graphe à 1, 2, 3 références par `ReferenceLatent`
      (relevé d'abord sur le gabarit d'édition officiel de ComfyUI, pas deviné) ; les références
      du sujet partent selon leur usage (chantier RS)
- [x] **Z-Image, FLUX.1, SDXL — partir de cette image** : graphe à une référence, option *force*
      (0 à 1, défaut 0,55 comme sc-clone)
- [ ] le catalogue dit, pour chaque style, *quel genre* de référence il prend ; *Relire avant
      l'envoi* le nomme sur chaque image jointe
- [x] essais sans ComfyUI

### ML4 · Le texte qui part vers un modèle local (serveur)

Le texte que l'atelier compose est écrit pour GPT Image : long, en paragraphes (`FRAMING`,
`CAMERA`…). Un modèle local le lit mal, et **SDXL lit par tranches de 77 mots-jetons** : au-delà,
ComfyUI découpe le texte en morceaux et chacun pèse moins — le déclencheur se noie.

- [x] le mot déclencheur en tête ; le signalement du sujet ensuite ; l'univers raccourci
      (`atelier/domaine/texte_local.py`, lu par `ServiceGenerations._texte` et `apercu` sur les
      mêmes lignes que `joindre` ; la caméra longue, le nommage des images et les titres ne partent
      pas, et sont rendus dans `local.retires`)
- [x] pour SDXL, le texte tient dans une tranche de 77, et la résolution rend ce qui a été retiré
      (`local.retires`, raison « au-delà des 77 jetons ») plutôt que de le retirer en silence —
      comptage approché du BPE de CLIP, calé pour compter large ; l'écran le montrera en ML5
- [x] le texte négatif part quand le profil le relie (SDXL, Klein base) ; sinon il n'est ni
      envoyé ni enregistré, et `negatif_lu` dit à l'écran (ML5) de ne pas le proposer
- [x] essais : le texte envoyé pour une case, une planche et une image libre, par famille
      (`tests/test_ml4.py`, dont un texte OpenRouter figé au caractère près)

### ML5 · Les écrans

Touche *Préparer une fabrication* et *Les workflows locaux* : **vérifier d'abord où en est la
remise à plat de ces écrans** — elle passe devant.

- [ ] dans le choix du modèle, les styles locaux groupés par famille, avec leur état (*prêt*,
      *il manque…*), leur temps et le genre de référence qu'ils prennent
- [ ] un bouton *Vérifier* qui relit ComfyUI et met les états à jour ; *Installer les styles
      prêts* depuis *Les workflows locaux*
- [ ] l'option *force* n'apparaît que quand une image *de départ* est jointe (règle 8nonies :
      un réglage inerte disparaît)
- [ ] une ligne dans `interface/src/aide.ts` (règle 7)
- [ ] essais d'écran ; vérification au navigateur sur un atelier jetable (port 8421)

### ML6 · La texture raccordable

- [ ] l'option *raccordable* sur les styles de genre `tuile` : les deux nœuds de
      `seamless.mjs`, toujours ensemble
- [ ] grisée avec la raison si les nœuds manquent (nœud personnalisé à installer à la main)
- [ ] essai : le graphe contient les deux nœuds ou aucun

### ML7 · S'en servir (sur la vraie carte graphique)

Gratuit, mais ça prend du temps : on annonce la durée avant de lancer.

- [ ] un tirage par famille, sans référence, depuis l'écran — temps réel relevé
- [ ] Klein avec une référence de sujet (Champy), puis deux : le sujet est-il gardé ?
- [ ] un style *partir de cette image* sur un croquis
- [ ] l'agent fait la même chose par MCP (`list_models`, `prepare_workflow_image`)
- [ ] ce qui a été appris va dans `docs/modeles-et-workflows.md` (qui ne couvre encore que la
      vidéo)

## Hors de ce chantier

- L'animation locale (Wan 2.2) : déjà dans l'atelier depuis A11 et AU8.
- Télécharger les poids depuis l'atelier.
- Redux (FLUX.1), IP-Adapter (SDXL), Qwen-Image-Edit : à rouvrir si Klein ne garde pas assez
  bien le sujet — après ML7, mesures en main.
- Les styles « planche » de sc-clone (`klein-4walk`, `klein-2x2`, `klein9b-sheet`,
  `flux1-trainer`) produisent une planche en un seul tirage ; les brancher sur le pliage et le
  découpage de l'atelier est un autre sujet. Dans ce chantier, ils sortent comme une image.
