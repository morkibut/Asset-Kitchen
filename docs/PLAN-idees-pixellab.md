# Plan : trois idées vues chez PixelLab — repeindre une zone, donner de la marge, finir sur une image

> **Ouvert le 26 septembre 2026, en autopilote, à la demande de l'auteur**, après l'analyse d'un
> tutoriel PixelLab (`docs/releve-usage.md` § 25 septembre 2026). L'auteur a choisi de commencer
> par **l'essai de la zone en local**.
>
> **Ce chantier ne dépense rien.** Tout ce qui se vérifie tourne sur la machine (ComfyUI, 0 $).
> Ce qui ne se vérifie qu'avec un appel payé (une image de fin chez OpenRouter) est **construit et
> essayé avec le double du fournisseur**, puis laissé à l'auteur avec son prix.
>
> Quel modèle sur quelle tranche : [`PLAN-idees-pixellab-affectation.md`](PLAN-idees-pixellab-affectation.md).

---

## Ce que c'est, en trois gestes

1. **Repeindre une zone.** Sur une image, on peint une tache sur la tête et on écrit « une
   coiffure ». Seule la zone peinte change ; le reste de l'image ne bouge pas d'un pixel, et ce
   qui a changé devient un calque qu'on garde ou qu'on jette.
2. **Donner de la marge.** Avant d'animer un grand geste, on dit combien de place laisser autour
   du sujet, pour que les bras ne sortent pas de l'image.
3. **Finir sur une image.** Pour une boucle, l'animation finit sur l'image de départ ; elle
   revient donc à son point de départ, et l'image en double n'entre pas dans la bande.

## Ce que ce n'est pas

- **Pas de retouche de zone par OpenRouter** : aucun de ses 55 modèles image n'accepte de masque
  (vérifié le 26 septembre 2026). La zone passe par ComfyUI, sur la machine.
- **Pas de nouveau fournisseur ni de téléchargement.** Les nœuds et les poids nécessaires sont
  déjà installés ; on n'installe rien dans ComfyUI.
- **Pas le squelette de PixelLab** (Skeleton V3) : nos animations passent par la vidéo.

## Ce qui a été relevé avant d'écrire

- **Une image jointe à ComfyUI est aplatie sur du blanc** avant d'être déposée. Une zone marquée
  par la transparence serait effacée en route : le masque doit voyager **à part**, sous son nom.
- **Aucun appel de l'atelier ne passe de masque aujourd'hui**, ni en image ni en vidéo.
- **La marge est fixe** : le sujet occupe 80 % de l'image envoyée au modèle vidéo, sans réglage.
- **L'image de fin** : OpenRouter déclare modèle par modèle s'il la prend (16 sur 29) ; l'atelier
  lit ce champ mais ne retient que l'image de départ. Le modèle maison (Wan 2.2) la prendrait par
  le nœud natif `WanFirstLastFrameToVideo`, et ses poids sont déjà là.

---

## PX1 · Le banc de la zone — est-ce que ça marche, sur la machine ?

**Livre** un banc gratuit qui répond à une seule question : *sur un sprite de l'atelier, un
moteur local repeint-il une zone proprement, sans toucher au reste ?*

Il part d'un personnage en pixel art, peint trois zones (la tête, le torse, les jambes), demande
une coiffure, un vêtement du haut, un pantalon, et garde huit tirages par zone et par moteur
essayé. Le résultat est recollé **dans la zone seulement**, ramené à la grille du sprite et à ses
couleurs. Les images vont dans un dossier que l'auteur ouvre, avec une planche de comparaison.

**Ce que la mesure sépare** : un pixel hors de la zone qui a changé (une faute, qui doit valoir
zéro par construction), un pixel de la zone qui a changé (le travail demandé), et une zone
revenue identique (un tirage raté).

### Critères d'acceptation

- [x] Le banc tourne sans rien écrire dans les données de l'auteur, et aucun appel payé n'est
      possible. *Écart assumé* : il parle à ComfyUI en direct au lieu de monter un atelier
      jetable — il n'importe aucun fournisseur payant, ce qui tient le critère par construction.
- [x] Au moins deux moteurs locaux essayés, huit tirages par zone et par moteur.
- [x] Hors de la zone : zéro pixel changé, sur tous les tirages.
- [x] Un verdict écrit dans `docs/releve-usage.md` : quel moteur, quel réglage, et si la suite
      (PX2, PX3) vaut d'être construite.

**Faite le 26 septembre 2026, en deux passes.** La première annonçait « bon » sur une mesure qui ne
voyait que l'extérieur de la zone : les planches montraient le visage effacé sous la coiffure et
le corps mangé sous le vêtement (`VAEEncodeForInpaint` grise la zone avant de l'encoder). La
seconde garde l'image sous la zone (`VAEEncode` + `SetLatentNoiseMask`, force 0,9), ne perce
jamais un pixel qui portait le sujet, et mesure ce qui se perd : **0 pixel hors zone et 0 pixel
de sujet effacé sur 48 tirages**, `sdxl-pixelart` (28 s) et `klein-pxart4` (61 s). **Verdict :
partiel** — six ou sept tirages sur huit se gardent ; un bloc gris sur une tête, et des pantalons
qui laissent voir le short quand la zone ne le couvre pas. **Décision de l'orchestrateur : PX2 et
PX3 se construisent**, avec `sdxl-pixelart` comme moteur de référence ; le geste « garder, jeter,
recommencer » de PX3 répond directement à l'irrégularité mesurée.

## PX2 · Le masque voyage jusqu'au moteur local

**Livre** une liaison `masque` dans un profil local : une image en noir et blanc déposée **sans
être aplatie**, lue par ComfyUI comme une zone. Un style local de retouche de zone s'installe
comme les autres styles et figure dans la liste des modèles ; un modèle qui ne sait pas repeindre
une zone est **grisé avec sa raison** quand on lui en donne une.

*Ne se construit que si le verdict de PX1 est bon.*

### Critères d'acceptation

- [x] Un profil déclare la liaison `masque` ; un profil qui ne la déclare pas refuse un masque
      par un message, jamais en silence.
- [x] Le masque arrive à ComfyUI tel qu'il est parti (essai qui relit l'image déposée).
- [x] Le style de retouche de zone s'installe, se liste, et se grise avec sa raison si ses
      fichiers manquent.
- [x] Les essais des moteurs locaux déjà écrits passent sans qu'une assertion bouge.

**Faite le 26 septembre 2026.** La liaison s'appelle `masque` (une au plus, sur un profil image
qui prend au moins une référence) ; la capacité, `masque` sur la fiche d'un modèle, lisible par
`GET /api/models`. Le masque est une image en niveaux de gris de la taille de la première
référence, déposée telle quelle (`atelier-masque-<hash>.png`), jamais aplatie ; il est gardé dans
le dossier de la génération et relu à la relance. Deux raisons de grisé : « ne sait pas repeindre
une zone » et « repeint une zone : il lui faut la zone peinte ». Le style
`sdxl-retouche-zone` (« SDXL · Retouche de zone (pixel) », force 0,5 à 1, 0,9 par défaut) est
rangé parmi les **outils**, pas parmi les styles : c'est un geste, pas une apparence ; il
s'installe à l'unité et ne part pas avec « installer tous les styles prêts ». Vérifié sur le vrai
ComfyUI (0 $, 32 s) : écart moyen 4 hors zone (le bruit du codage), 67 dedans. ⚠️ La coiffure est
revenue **rouge pour un texte qui la demandait bleue** : l'obéissance au texte est à surveiller
dans PX3. **Reste pour PX3** : aucun écran ne montre encore la capacité ni l'outil ; la liste des
modèles de l'agent ne l'expose pas ; le chemin des fabrications suivies refuse un masque avec la
raison.

## PX3 · Peindre une zone dans l'atelier

**Livre** l'outil sur la fiche d'une image : un pinceau qui peint la zone, un texte, un bouton
qui annonce le temps. Le résultat arrive **sur un calque qui ne porte que les pixels changés dans
la zone**, ramené aux couleurs de l'image ; on le garde, on le jette, ou on recommence. Le
calque gardé se referme et se rouvre avec sa zone et son texte. L'agent a le même geste.

*Ne se construit que si PX2 est faite.*

### Critères d'acceptation

- [x] Peindre, écrire, lancer : le calque ne contient aucun pixel hors de la zone.
- [x] Le temps est annoncé sur le bouton avant de partir.
- [x] Un calque gardé se rouvre avec sa zone et son texte, gardé avec des réglages qui ne sont
      pas ceux du défaut.
- [x] Le guide a sa ligne pour le nouveau réglage (`interface/src/aide.ts`).
- [x] L'agent peut demander la même retouche.
- [x] *Ajouté par l'auteur en cours de route* : le calque se retouche avec la main et l'éditeur
      de pixels, comme un calque d'équipement.

**Faite le 26 septembre 2026.** La fabrique « Repeindre » vit dans l'atelier de retouche ; le bouton
« Repeindre une zone » est aussi posé à côté d'« Extraire un élément ». On peint la zone au pinceau
carré (gomme, tailles 1 à 15, « Défaire le dernier trait », « Effacer la zone »), on écrit ce qu'il
faut y mettre, le bouton annonce le temps médian mesuré sur la machine (ou la vitesse de la
famille, marquée « Pas encore mesuré sur cette machine »). Le résultat se garde, se jette ou se
recommence. Le calque ne porte **que les pixels changés** — jamais calculé par la différence, dont
la tolérance avale une substitution —, ramenés aux couleurs de l'image, et il est rangé dans la
place `difference` comme un calque d'équipement : « Retoucher ce calque › » ouvre la main et
l'éditeur de pixels, qui y passent tels quels. L'agent a `repaint_zone`. Vérifié sur le vrai
ComfyUI (0 $, 36 s) : 0 pixel hors zone, 0 pixel de sujet perdu, rouvert à l'identique. ⚠️ **La
couleur n'obéit pas** : une coiffure demandée bleue est revenue rouge à la force 0,9 ; à 1,0, un
tirage sur deux est venu bleu — trop peu pour conclure. ⚠️ Un tirage servi par le cache de ComfyUI
compte comme une mesure de temps (3,6 s). Le calque vaut pour **cette image** : le poser sur les
autres poses ou les animations n'est pas dans cette tranche.

### Retours de l'auteur — 26 septembre 2026, premier essai réel

*Mara (The Way Out reborn), 128×128, zone peinte sur le dos, « un gros sac à dos bien rempli
d'affaires récupérées en exploration ».* Mesuré sur la génération gardée
(`donnees/generations/dc6a9ac8…`, lue sans y toucher) : zone de 1 422 pixels, calque de 739.

- [ ] **L'objet sort plein de trous.** Deux causes, toutes deux voulues par PX3 et fausses pour un
      objet qu'on veut garder seul :
      - **131 pixels du nouveau sac manquent au calque** parce qu'ils ont gardé la couleur de
        l'ancien : le calque ne porte que les pixels *changés*. Sur Mara on ne le voit pas (l'image
        de base est dessous) ; sur l'objet seul, ce sont des trous. Le calque doit porter **tout ce
        que le moteur a peint dans la zone**, y compris ce qui ressemble à l'image de base.
      - **552 pixels de la zone sont restés vides** : partout où le moteur a peint une couleur
        jugée proche du fond neutre, le recollage n'a rien posé. Une partie de ces pixels est
        vraisemblablement du sac. Le seuil « c'est du fond » est trop large pour un objet (à
        vérifier sur l'image brute).
- [ ] **Rien ne permet de rectifier après coup.** « Retoucher ce calque › » n'existe que dans le
      panneau du résultat, juste après la génération. Une fois gardé, le calque apparaît dans la
      Galerie comme une image « Mara · sans pose » ; sa fiche porte « La retoucher », mais l'auteur
      n'y a trouvé aucun moyen de corriger les trous (non vérifié : ce que ce bouton ouvre pour un
      calque repeint). Il faut pouvoir rouvrir un calque repeint **depuis sa fiche** et y retoucher :
      retirer, et surtout **ramener** les pixels manquants depuis l'image brute du moteur.
- [ ] **« Garder » ne fait rien.** Le résultat entre en bibliothèque dès qu'il revient (règle du
      produit) ; « Garder » ferme seulement le panneau, « Jeter » supprime. L'auteur croit choisir,
      il ne choisit rien.
- [ ] **Ce que produit « Repeindre » n'a pas de nom dans le produit.** C'est une image rattachée
      au sujet Mara, sans pose ni direction, qui connaît l'image d'en dessous ; ce n'est **ni une
      nouvelle version de la pose, ni un équipement** au sens du Codex (un sujet de la famille
      « équipements », avec un emplacement, porté sur les poses et les animations). *Décision de
      l'auteur attendue* : ce que le geste doit produire (voir la question posée le 26 septembre).
- [ ] **Le parcours de A à Z, pensé d'abord et joué au navigateur** (demande de l'auteur : « ça
      doit être simple et intuitif de A à Z »). Ouvrir une image → peindre la zone → écrire →
      lancer → voir le résultat → garder → **retrouver le calque plus tard, sur son image et dans la
      Galerie, et le corriger** → s'en servir. Chaque étape a son chemin à l'écran, sans détour ; le
      calque gardé se présente comme un calque de son image (avec son sujet, sa pose, son texte),
      pas comme une image de plus « sans pose ».

## PX3bis · La couleur demandée obéit

*Ajoutée le 26 septembre 2026, en autopilote, après PX3 : une coiffure demandée bleue revenait
rouge.* **Livre** un banc gratuit de huit tirages par réglage, sur trois couleurs nommées dans le
texte, qui choisit la force par défaut de l'outil de retouche de zone ; et un tirage servi par
le cache de ComfyUI ne compte plus comme une mesure de temps.

### Critères d'acceptation

- [ ] ~~Huit tirages par force essayée et par couleur~~ — **interrompu**, voir ci-dessous.
- [ ] ~~La force par défaut est celle qui obéit le mieux~~ — **abandonné** : rien n'a bougé.
- [x] Un tirage servi par le cache n'entre pas dans le temps annoncé. *Son essai automatique
      reste à écrire : il part avec PX7.*

**Interrompue le 26 septembre 2026, à la demande de l'auteur.** L'objectif du chantier est
d'abord **la technique, disponible sur tous les moteurs** ; améliorer vient après, à partir d'une
liste de pistes (PX8). Ce qui reste de la tranche : deux réparations techniques et des chiffres
partiels. *Le temps annoncé* ignore désormais un tirage que ComfyUI a resservi depuis son cache
(signal `execution_cached`). *Le fond neutre* posé derrière le sprite écarte les teintes proches
d'une couleur nommée dans le texte — il choisissait du cyan pour une demande de bleu. La force par
défaut (0,9) et la composition du texte **n'ont pas bougé**. Les chiffres partiels, et ce qui n'a
pas été essayé, sont dans `docs/releve-usage.md` § 25 septembre 2026, point 1.

## PX7 · Repeindre une zone avec chaque moteur local

*Ajoutée le 26 septembre 2026, à la demande de l'auteur : la technique doit servir avec les
différents modèles, pas avec un seul.* **Livre** un outil de retouche de zone par famille de moteur
local installée — Qwen-Image 2.1, FLUX.2 Klein, Z-Image, FLUX.1, SDXL — construit sur la même
recette que `sdxl-retouche-zone` (l'image gardée sous la zone, jamais grisée). Dans « Repeindre »,
on choisit le modèle ; un modèle dont les fichiers manquent est grisé avec sa raison.

**On ne juge pas la qualité ici** : on vérifie que chaque outil **fonctionne** — il s'installe, il
part, il revient, rien ne bouge hors de la zone.

### Critères d'acceptation

- [x] Un outil de retouche de zone par famille de moteur local présente sur la machine ; chacun
      déclare la liaison `masque`.
- [x] « Repeindre » et l'agent laissent choisir le modèle ; un modèle absent ou incapable est
      grisé avec sa raison.
- [x] Un tirage réel par outil, sur la machine : il revient, 0 pixel hors de la zone. Aucune
      comparaison de qualité.
- [x] Les deux réparations de PX3bis ont leur essai automatique (le cache, le fond).

**Faite le 26 septembre 2026.** Cinq outils, une même recette (l'image gardée sous la zone,
`SetLatentNoiseMask`, jamais `VAEEncodeForInpaint`) : `sdxl-retouche-zone`,
`zimage-retouche-zone`, `klein-retouche-zone` (avec `SplitSigmasDenoise`, son échantillonneur
n'ayant pas de force), `qwen21-retouche-zone` (sur le graphe « qualité ») et
`flux1-retouche-zone`. Dans « Repeindre », une liste choisit le modèle ; un moteur non installé
y est grisé avec sa raison et propose de s'installer. L'agent passe le même choix à
`repaint_zone` (`model`). Un tirage réel par outil, 0 $ : les cinq reviennent, 0 pixel hors de la
zone, 0 pixel de sujet perdu — SDXL 42 s, Z-Image 52 s, Qwen 68 s, Klein 77 s, FLUX.1 189 s. **La
qualité n'a pas été comparée**, comme demandé. ⚠️ Ces tirages partaient d'un personnage carré
dessiné par le banc, pas d'un vrai asset : ils prouvent que chaque outil fonctionne, ils ne disent
rien de ce qu'il dessine. L'auteur l'a relevé : un prochain essai part d'un vrai personnage de ses
projets, copié hors de `donnees/`. Essais : `tests/test_px7_moteurs.py` (16).

## PX8 · La liste des pistes d'amélioration

*Ajoutée le 26 septembre 2026, à la demande de l'auteur.* **Livre** une liste, dans
`docs/releve-usage.md`, de ce qu'on pourrait améliorer sur les trois idées, chaque piste avec : ce
qu'on a vu, ce qu'on essaierait, ce que ça coûterait, et ce qui est déjà mesuré. **Rien ne se
mesure ni ne se code dans cette tranche** ; c'est l'auteur qui choisira. Au moins : le texte court
en tête (la piste de l'auteur), la couleur qui n'obéit pas, la force, la qualité selon le moteur,
les pantalons qui laissent voir le short, et le calque posé sur les autres poses et les animations.

**Faite le 26 septembre 2026.** Onze pistes dans `docs/releve-usage.md` § 25 septembre 2026, « Les
pistes d'amélioration », chacune avec ce qu'on a vu, ce qu'on essaierait, ce que ça coûterait et ce
qui est déjà mesuré. Deux écarts avec PixelLab y sont relevés dans le code : « Recommencer » tire
toujours une graine neuve (pas de « même graine »), et la réduction des couleurs est fixée à
l'avance (quatre couleurs neuves au plus) au lieu de se régler après coup.

## PX9 · Repeindre, de A à Z : un résultat qui a un nom

*Ajoutée le 26 septembre 2026, après le premier essai réel de l'auteur (Mara, un sac à dos) —
voir « Retours de l'auteur » sous PX3. Décision de l'auteur le même jour : **on choisit ce que
devient le résultat après l'avoir vu.*** Cette tranche reprend les quatre retours et ne livre
qu'une chose : un parcours sans trou.

### Le parcours, tel qu'il doit se jouer

1. **Ouvrir** une image d'un sujet (Mara, une pose) → atelier de retouche → « Repeindre une zone ».
2. **Peindre** la zone, **écrire** ce qu'on veut, choisir le modèle, **lancer** (le temps est
   annoncé).
3. **Voir** le résultat : l'image avec la zone repeinte, et la pièce seule.
4. **Décider**, trois boutons qui font vraiment quelque chose :
   - **« En faire une nouvelle version de cette pose »** — l'image complète (l'image d'origine et la
     zone repeinte) devient une version de la même pose et direction de Mara, rangée avec elles ;
     l'image d'origine reste.
   - **« En faire un équipement de Mara »** — on donne un nom (« Sac à dos ») et un emplacement
     (proposé d'après la zone : le dos) ; l'atelier crée le sujet « Sac à dos » dans la famille des
     équipements, et la pièce devient **son calque sur cette pose de Mara**, exactement comme un
     équipement fabriqué autrement. La suite (le porter sur les autres poses et les animations) est
     celle qui existe déjà pour les équipements.
   - **« Jeter »** — rien ne reste. Et « Recommencer » relance un tirage.
   Tant qu'on n'a pas décidé, le résultat n'encombre ni la Galerie ni les poses : il attend sur
   l'image, dans la liste « à décider ».
5. **Retrouver et corriger plus tard** : la nouvelle version se retouche comme toute image ; le
   calque d'équipement se rouvre depuis l'équipement **et** depuis l'image de Mara, avec la main
   et l'éditeur de pixels, qui peuvent **ramener** des pixels depuis l'image rendue par le moteur.

### Critères d'acceptation

- [ ] La pièce n'a plus de trous : elle porte **tout ce que le moteur a peint dans la zone**, pas
      seulement ce qui a changé ; ce qui est vraiment du fond est retiré, et le seuil est vérifié
      sur la génération de Mara du 26 septembre (relue, jamais modifiée).
- [ ] Les trois décisions font ce qu'elles disent ; un résultat non décidé n'apparaît ni dans la
      Galerie ni parmi les poses, et se retrouve sur son image.
- [ ] « En faire un équipement » crée le sujet équipement avec son emplacement, et le calque est
      reconnu partout où les calques d'équipement le sont (fiche de l'équipement, fiche de la pose,
      ordre devant/derrière, export).
- [ ] Un calque repeint se rouvre et se corrige depuis l'équipement et depuis l'image de base ;
      la main peut ramener des pixels depuis l'image du moteur.
- [ ] **Le parcours ci-dessus est joué au navigateur de bout en bout**, sur une copie d'un vrai
      personnage des projets de l'auteur, sur un atelier jetable, en deux passes : une pour chaque
      décision.
- [ ] Le guide dit en une ligne ce que devient le résultat selon le bouton ; les mots suivent
      `docs/vocabulaire.html`.
- [ ] L'agent a les mêmes trois décisions.

## PX4 · La marge avant d'animer

**Livre** un réglage « place autour du sujet » sur l'écran qui prépare une animation : la part
de l'image que le sujet occupe, aujourd'hui fixée à 80 %. Il se garde avec le clip, se relit à la
réouverture, et l'agent peut le donner.

### Critères d'acceptation

- [x] Le réglage change l'image envoyée au modèle vidéo (essai sur l'image composée).
- [x] Sans réglage, l'image envoyée est identique à celle d'aujourd'hui.
- [x] Un clip gardé avec une marge qui n'est pas celle du défaut se rouvre avec elle.
- [x] Le guide a sa ligne ; l'agent peut donner la marge.

**Faite le 26 septembre 2026.** Le réglage s'appelle `part_sujet` partout (code, demande, agent) :
la part de l'image que le sujet occupe, de 40 à 95 %, 80 par défaut. Il se règle dans « 4. Le
clip » de la fenêtre de fabrication (« Place autour du sujet »), se relit sur l'écran de
confirmation et sur la fiche du clip, et il est gardé **sur le clip fini** : « Relancer » le
reprend. Un clip d'avant ce jour se lit à 80 %. Une première version ne le gardait que sur la
fabrication en cours, et un clip fini repartait à 80 % en silence : corrigé avant la fermeture
(`AGENTS.md`, point 8septies). Essais : `tests/test_px4_marge.py`, `interface/src/fabrication.test.ts`.

## PX5 · Finir sur une image

**Livre** l'image de fin : « finir sur l'image de départ » (la boucle), ou une autre image. Un
modèle qui ne la prend pas est grisé avec sa raison. Elle part chez OpenRouter dans le champ
prévu, et chez le modèle maison par le nœud natif. Quand la fin est l'image de départ, l'image en
double est retirée de la bande pour que la boucle ne saute pas.

### Critères d'acceptation

- [x] Le catalogue sait quels modèles prennent une image de fin, et grise les autres avec leur
      raison quand on en demande une.
- [x] L'appel OpenRouter porte l'image de fin (essai sur le corps de l'appel, fournisseur doublé).
- [x] Le modèle maison reçoit l'image de fin par `WanFirstLastFrameToVideo` (essai sur le graphe).
- [x] Une boucle n'a pas l'image en double à sa fin.
- [x] Un clip gardé avec une image de fin se rouvre avec elle ; l'agent peut la demander.
- [x] Le guide a sa ligne.
- [x] ~~Un essai payé chez OpenRouter~~ — **remplacé le 26 septembre 2026 par un essai local**,
      l'auteur travaillant en local : un clip d'une seconde de Michel le nain (*Cœur de pierre*,
      copie hors de `donnees/`) sur le modèle maison, « Finir sur l'image de départ », 95 s, 0 $.
      Le graphe passe bien par `WanFirstLastFrameToVideo` ; première et dernière image du clip à
      8 sur 255 d'écart moyen ; la bande a ses 8 images, sans le doublon de fin. ⚠️ Le mouvement
      demandé était minuscule : l'essai prouve la mécanique, pas qu'un geste ample se referme.
      L'appel OpenRouter n'est vérifié que par ses essais automatiques.

**Faite le 26 septembre 2026.** Le réglage s'appelle `image_de_fin` (demande, clip gardé, agent) :
vide pour une fin libre, `"depart"` pour la boucle, sinon l'identifiant d'une image du jeu. À
l'écran, « Fin de l'animation » dans « 4. Le clip » : *Libre*, *Finir sur l'image de départ
(boucle)*, *Une autre image…* (la grille de choix d'image existante). L'image de fin est composée
comme celle de départ (même toile, même fond, même `part_sujet`). Un modèle qui ne la prend pas
est grisé : « ne sait pas finir sur une image choisie ». Chez le modèle maison, le nœud devient
`WanFirstLastFrameToVideo` ; sans image de fin, le graphe est inchangé. Pour une boucle, la bande
prend une image de plus sur le clip et retire la dernière. **Les profils vidéo locaux restent à
une seule image**, grisés avec la raison. Au 26 septembre 2026, **15** modèles OpenRouter
acceptent une image de fin (16 la veille). L'essai payé le moins cher :
`OpenRouter:bytedance/seedance-1-5-pro`, environ 0,026 $ pour 4 s en 480p carré, d'après le
catalogue du jour. Essais : `tests/test_px5_image_de_fin.py` (21). Pas vu au navigateur.

## PX6 · La relecture croisée

**Livre** une relecture des tranches faites, confrontées entre elles et au plan : ce que le
serveur sait rendre a un chemin depuis un écran, les mots suivent `docs/vocabulaire.html`, les
critères cochés le sont à raison. Le tableau d'état de `docs/PLAN.md` reçoit sa ligne.

**Faite le 26 septembre 2026.** Les coutures tiennent : `part_sujet` et `image_de_fin` (PX4,
PX5) sont posés au même endroit (« 4. Le clip » de `FabricationSuivie.tsx`), avec les mêmes
noms partout — la demande, le clip gardé, la fiche du clip (`FicheDuClip.tsx`), l'agent — et se
relisent à la réouverture. La capacité `masque` (PX2) protège déjà **tout** chemin de
génération, pas seulement celui de la zone : `Modele.refus` refuse un masque envoyé à un modèle
qui ne le déclare pas quel que soit l'appelant, donc le « reste pour PX3 » noté par PX2 (« le
chemin des fabrications suivies refuse un masque avec la raison ») était déjà tenu par
construction, sans qu'aucune tranche l'écrive exprès. `list_models` expose `repaints_zone`
(PX2 → PX7) à l'agent, et l'écran « Repeindre » comme `repaint_zone` choisissent le modèle sur
la même liste `_modeles_capables()` (PX7) ; les cinq outils déclarent tous la liaison `masque`.

**Un défaut trouvé et corrigé** : `Repeindre.tsx` mélangeait deux tutoiements sur le même
panneau — « ton texte part mot pour mot » (tutoiement, comme le reste de l'atelier — 55
fichiers le tutoient, un seul, ancien et hors chantier, vouvoie) à côté de deux raisons de
bouton grisé écrites en vouvoiement, « Peignez d'abord la zone à repeindre. » et « Écrivez ce
qu'il faut mettre dans la zone. ». Corrigé en « Peins d'abord la zone à repeindre. » et « Écris
ce qu'il faut mettre dans la zone. » (`interface/src/composants/Repeindre.tsx`,
`Repeindre.test.tsx`), vérifié au navigateur en peignant réellement une zone. **Laissé tel
quel** : les messages de refus du serveur (`TEXTE_VIDE`, `ZONE_VIDE` dans
`atelier/services/zone.py`) restent en vouvoiement — c'est la convention déjà en place pour les
messages de refus ailleurs dans le serveur (`atelier/audio/texte.py`,
`atelier/services/generation.py`), une question distincte du ton d'un écran, et hors du
périmètre de ce chantier.

**Une absence relevée, non comblée** : `FabricationVideoLibre.tsx` (« Faire une vidéo libre »,
sans sujet) partage le même type de demande et la même route serveur que `FabricationSuivie.tsx`
(`ServiceTravaux.preparer(..., source_libre=True)`, qui lit `part_sujet` et `image_de_fin`
exactement pareil), mais son écran ne pose ni « Place autour du sujet » ni « Fin de
l'animation » — ces deux réglages restent donc hors de portée d'un clip libre, alors que le
serveur les honorerait. Ni PX4 ni PX5 ne nomment cet écran dans leurs critères (« l'écran qui
prépare une animation », au singulier), donc rien n'est décoché ; c'est une piste de plus pour
l'auteur, pas un défaut des critères tenus.

**Vérifié au navigateur** sur un atelier jetable (`essais/atelier_jetable_px6.py`, port 8427,
fournisseur et ComfyUI doublés, rien payé, rien écrit dans `donnees/`) : la fabrique
« Repeindre » (le pinceau, `sdxl-retouche-zone` installé et prêt, les quatre autres outils
grisés avec leur raison, le temps sur le bouton, le tutoiement une fois corrigé) et, sur un
personnage avec une pose, la fenêtre de préparation d'un clip — « Place autour du sujet · 80 %
de la toile » et les trois choix de « Fin de l'animation », y compris la sélection de « Finir
sur l'image de départ (boucle) ». Aucune génération, aucun appel payé, aucun calcul GPU réel :
le double de ComfyUI a répondu à la place de la machine.

**Essais** : `pytest -q -n4 --dist loadfile` (4 420 passés, 4 sautés, 0 échec) ;
`npx tsc --noEmit` (rien à dire) ; `npm test` complet (2 échecs isolés, tous deux confirmés
flaky sous charge en les rejouant seuls — `SonRetro.test.tsx` et un test d'`App.test.tsx`,
aucun des deux touché par ce chantier) ; `essai_vocabulaire.py`, `essai_jetons.py`,
`essai_imports.py`, `essai_docs.py` : rien à signaler.
