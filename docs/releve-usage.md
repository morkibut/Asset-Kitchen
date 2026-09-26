# Le relevé d'usage

> **Ce document ne fait foi sur rien.** Il note ce qu'une séance d'usage a trouvé, *avant*
> que ce soit cadré. Quand une entrée est tranchée, elle part dans `docs/PRD.md` (ce que le
> produit doit faire) ou `docs/PLAN.md` (dans quel ordre), et ne laisse ici qu'une ligne de
> renvoi. Une entrée qui reste ici est une entrée sur laquelle personne n'a encore décidé.
>
> Il se lit **à la demande**, jamais au démarrage d'une session. Les plus récentes en tête.

---

## 25 septembre 2026 — ce que montre un tutoriel PixelLab

Source : la vidéo *PixelLab Tutorial: Images Pro Flash, Skeleton V3 & PixMiniMax* (PixelLab,
18 min), regardée image par image sur les passages cités. Trois idées que l'atelier n'a pas.
**Rien n'est cadré ni planifié.**

### 1 · Repeindre une zone : le modèle ne touche qu'à ce qu'on a peint

**Ce qu'on voit (5:21 à 7:25).** Sur un personnage torse nu de 64×64, l'auteur peint au pinceau
une tache grise sur la tête, écrit « coiffure » et lance. Le résultat arrive **sur un calque à
part** (« New layer with changes ») qui ne contient **que les pixels changés** : les cheveux et
quelques pixels de front. Il efface ces derniers à la main, et il a un calque de coiffure propre.
Il recommence avec un tee-shirt sur le torse, puis un pantalon sur les jambes : trois calques
empilés sur le corps d'origine, qui n'a pas bougé d'un pixel. La fenêtre annonce le prix avant
de partir (« 5 generations for 1 image at 64x64 »). Le résultat propose ensuite : recommencer,
jeter, recommencer avec la même graine, et **réduire les couleurs** (automatiquement, ou à un
nombre choisi — 7 à l'écran).

**Ce qu'on fait nous.** Aucun appel de l'atelier n'envoie de masque au modèle. Le modèle
redessine l'image entière, puis on retrouve la pièce **par différence** entre avant et après.
C'est exactement ce qui rate une pièce qui **se substitue** (voir plus bas, 29 août 2026) : un
tee-shirt qui remplace un torse nu en est le cas type. PixelLab n'a pas ce problème, parce que
tout ce qui change est par construction dans la zone peinte.

**L'auteur l'a constaté à l'usage** : la retouche de zone marche bien mieux chez PixelLab.

**Vérifié le 26 septembre 2026 : par OpenRouter, c'est impossible.** Aucun des 55 modèles image
n'accepte de masque — ni dans les réglages déclarés, ni dans ceux que chaque service laisse
passer en plus (relevé service par service). Même GPT Image, qui prend un masque chez OpenAI en
direct, n'en reçoit pas par OpenRouter.

**En local, c'est possible sans rien télécharger.** Le ComfyUI installé a les nœuds de retouche
de zone (`InpaintModelConditioning`, `SetLatentNoiseMask`, `VAEEncodeForInpaint`) et des
modèles déjà sur le disque pour s'en servir (Flux 2 Klein, Qwen Image, Z-Image, SDXL). Un profil
local reçoit déjà jusqu'à 16 images jointes ; le nœud qui charge une image en sort aussi un
masque, lu dans sa transparence. **Piste à essayer avant d'écrire du code** : un profil de
retouche dont la seconde image jointe porte la zone en transparence.

**Verdict du banc PX1 (26 septembre 2026, deux passes)** : **partiel**, et la première passe
s'est trompée en disant « bon ».

**Ce que la première passe avait montré**, sur `qwen21-rapide` et `sdxl-pixelart` : 0 pixel
changé hors de la zone peinte sur 48 tirages. C'est vrai, et ça ne suffit pas — cette mesure ne
dit rien de ce qui se passe *dans* la zone. Une relecture visuelle stricte des planches a montré
que `sdxl-pixelart`, jugé « bon » à tort, **effaçait le sujet sous la zone au lieu de le
repeindre** : le visage disparaissait entièrement sous la coiffure sur les huit tirages de la
tête, le torse ressortait troué (de la peau devenue transparente là où le vêtement n'était pas
allé). La cause était dans le graphe : `VAEEncodeForInpaint` grise les pixels sous le masque
**avant** de les encoder — le moteur ne voit alors plus ce qu'il y avait, et doit tout
redessiner de mémoire, ce qu'un modèle généraliste à haut denoise ne sait pas faire proprement.
Une seconde règle aggravait la fuite : tout pixel repeint dans une couleur proche du fond
neutre devenait transparent, **y compris quand ce pixel portait déjà le sujet** avant l'appel —
un trou pur, jamais rattrapé.

**La correction, sur les deux points.** Le graphe encode l'image **telle quelle** (`VAEEncode`,
jamais grisée) puis pose le masque par-dessus (`SetLatentNoiseMask`) — le visage et le corps
sous la zone restent dans le latent de départ, et un denoise partiel (0,9, après deux essais à
0,7 et 0,8 qui changeaient trop peu) les laisse transparaître au lieu de les remplacer par du
bruit pur. Le recollage ne rend plus transparent un pixel que le moteur a repeint en fond **s'il
portait déjà le sujet** — dans ce cas l'original reprend sa place, jamais un trou. Et la boîte de
la tête s'arrête maintenant au-dessus du visage (repérée par la couleur de peau, pas par une
bande fixe) : on peint la coiffure, plus jamais les yeux.

**Rejoué avec la correction**, sur 48 tirages nouveaux (`sdxl-pixelart` et `klein-pxart4`, huit
par zone) : **0 pixel hors zone et 0 pixel de sujet effacé, sur les 48**, mesuré (la mesure
`pixels_sujet_devenus_transparents` de `essais/banc_px1_zone.py`) et vérifié à l'œil sur les deux
planches — le visage est intact sur chacun des seize tirages de la tête, aucun torse ni aucune
jambe n'est troué. C'est la bonne nouvelle, et elle est solide : la fuite du premier essai est
fermée, pas seulement cachée.

**Ce qui reste imparfait, et c'est pourquoi le verdict est « partiel » et non « bon »** : la
*qualité* de ce qui est peint dans la zone varie d'un tirage à l'autre, sur les deux moteurs.
`sdxl-pixelart` (28 étapes, cfg 6, ~28 s/tirage) rend une coiffure ou un vêtement propre sur
la plupart des tirages, mais un tirage sur huit sur la tête est un aplat gris sans forme (g202),
un autre un empâtement flou (g303) ; sur le torse, un tirage laisse des marques rougeâtres sur
les bras (g808). `klein-pxart4` (FLUX.2 Klein non distillé, cfg 5, ~61 s/tirage — deux fois plus
lent) rend une coiffure propre sur les huit tirages de la tête, mais les jambes sont souvent
un empâtement plutôt qu'un pantalon net (g101 : 7,4 % de la zone à peine peinte). Aucun des deux
moteurs ne garantit un résultat propre à chaque tirage — ce que huit tirages par zone montrent
justement, et que huit tirages n'auraient pas montré à un seul essai.

**Verdict pour PX2/PX3** : construire la suite **vaut le coup**, avec la correction ci-dessus
(encodage non destructif, jamais `VAEEncodeForInpaint`) comme base obligatoire — c'est elle qui
manquait, pas le principe de la zone. Le geste « garder / jeter / recommencer » que PX3 doit
livrer n'est pas un confort, c'est la réponse au problème de qualité inégale mesuré ici : un
tirage sur trois ou quatre ne se garde pas, et c'est exactement ce que PixelLab propose de faire
à la main. `sdxl-pixelart` reste le moteur de référence recommandé (deux fois plus rapide que
`klein-pxart4`, qualité comparable) ; `qwen21-rapide` (12 étapes, distillé, cfg 1) reste hors
jeu pour l'inpainting, déjà écarté à la première passe. Planches de comparaison et mesures :
`essais/banc_px1_zone.py`, listé dans `docs/bancs.md`.

**Banc PX3bis (26 septembre 2026) — partiel, interrompu à la demande de l'auteur.** Question : la
couleur écrite dans le texte est-elle celle qui domine les pixels que l'outil « Repeindre » a
changés ? Moteur `sdxl-retouche-zone` seul, zone de la tête, huit tirages par case. Chiffre : la
part médiane des pixels changés qui sont de la teinte demandée.

| Couleur demandée | Force 0,9 | Force 1,0 |
|---|---|---|
| bleu | 19 % | 26 % |
| vert | 25 % | 67 % |
| jaune | 62 % | 63 % |

**Pas essayé** : la zone du torse (un seul tirage fait, 0 %), la force 1,0 sur le torse, et la
variante proposée par l'auteur — la description du jeu réduite à quelques mots de style et placée
*après* la demande. **Ce qui est déjà réparé**, trouvé en relisant le code avant de mesurer : le
fond neutre posé derrière le sprite était choisi « le plus loin des couleurs de l'image », ce qui
donnait du cyan pour une demande de bleu ; il écarte maintenant les teintes proches d'une couleur
nommée dans le texte. Les chiffres ci-dessus ont été faits **après** cette réparation. L'auteur a
arrêté le banc : l'objectif est d'abord la technique sur tous les moteurs, l'amélioration vient
après, à partir d'une liste de pistes. Script : `essais/banc_px3bis_couleur.py` ; planches (hors
Git) : `essais/resultats/banc-px3bis/`.

### 2 · Une boucle propre : la même image au début et à la fin

**Ce qu'on voit (15:46).** L'écran d'animation a deux cases : « First frame » (obligatoire) et
« Last frame » (facultative, « la pose où l'animation doit finir »). Pour une animation de repos,
l'auteur prend une image de l'animation précédente et la met **dans les deux cases**. Le
mouvement revient donc exactement à son point de départ. Il retire ensuite l'image en double
pour que la boucle ne saute pas.

**Ce qu'on fait nous.** Nos animations ne prennent qu'une image de départ. Il n'existe aucune
notion d'image d'arrivée, ni dans le code ni dans la doc.

**Vérifié le 26 septembre 2026.** OpenRouter le déclare modèle par modèle
(`supported_frame_images`), et **16 modèles vidéo sur 29** acceptent une image de fin : Kling
3.0 (pro et std) et Kling O1, Veo 3.1 (et fast, lite), Seedance 1.5 pro, 2.0 (et fast, mini)
et 2.5, Hailuo 3 (et max), Flux 3 Video, Wan 2.7. L'atelier lit déjà ce champ, mais ne retient
que « accepte une image de départ » (`atelier/fournisseur/openrouter_video.py`, `_lire_fiche`)
et n'envoie que celle-là.

**En local aussi, sans rien télécharger** : les poids Wan 2.2 I2V 14B du modèle maison sont
installés, et ComfyUI a le nœud natif `WanFirstLastFrameToVideo`. Ce qui bloque est dans
l'atelier : un profil vidéo local exige **exactement une** image jointe
(`atelier/domaine/workflow.py`), et l'appel maison n'en envoie qu'une.

### 3 · Donner de la place avant un grand geste

**Ce qu'on voit (8:00).** Un monstre de 64×64 remplit son cadre. Avant de lui faire frapper le
sol des deux bras, l'auteur ouvre « Reframe Canvas » : il agrandit le cadre à 80×80 en tirant
les bords ou en tapant la taille, et il peut déplacer le sprite dedans. Sans ça, les bras
sortent de l'image.

**Ce qu'on fait nous.** Rien ne permet d'ajouter de la marge autour de l'image de départ d'une
animation. C'est gratuit (aucun appel) et ça évite de payer une animation coupée.

### Au passage, un piège qu'il a rencontré

Son bouton « améliorer la consigne » a lu le personnage vu de face et a écrit « vers la
caméra ». Envoyée à l'angle nord-est, la phrase a fait déraper le mouvement ; et la couleur de
l'effet a changé d'un angle à l'autre. Sa solution : une consigne par angle, et la couleur de
l'effet écrite en toutes lettres. Nos planches envoient déjà un texte par angle ; **non vérifié
pour les animations**.

---

## 31 août 2026 — la seconde séance, sur les seules tables de l'atelier

Six points relevés le même soir, en regardant de près ce que la première séance avait
parcouru de loin. **Tous sont tranchés** : ils sont devenus `U10` à `U13` dans
`docs/PLAN.md`, et l'un des six était une question — elle a sa réponse en `U10`.

**Ce que cette séance apprend, et qui ne tient pas dans ses six points.** Regarder un écran
de près cesse de trouver des défauts et commence à trouver des **absences** : deux des six
ne sont pas des réparations mais des outils qui manquent — une sélection qu'on trace
grossièrement et que l'atelier ajuste au bord du sujet, et un second moteur de détourage plus
lourd. C'est un signe sur l'atelier plutôt que sur la séance : un outil qu'on répare est un
outil dont on se sert.

### La réponse à la question posée, parce qu'elle n'était écrite nulle part

*Une passe de détourage supplémentaire s'applique-t-elle à l'image d'origine ou au résultat de
la précédente ?* Les deux, et c'est ce qui surprend :

- **La transparence s'accumule et ne se rend jamais.** Chaque passe ne peut que serrer ce que
  la précédente a laissé — c'est ce qui fait que les passes s'enchaînent au lieu de se
  remplacer, et c'était écrit dans le code.
- **Mais la couleur qu'une passe examine est toujours celle de l'image d'origine.** Effacer un
  pixel ne change que sa transparence, jamais sa couleur. Une seconde passe à la pipette lit
  donc un fond qui, pour elle, est encore là — et sa tache peut repartir à travers ce qui a
  déjà été effacé, puisque ce couloir a gardé la couleur qu'elle cherche.

**C'est la première explication du défaut de la pipette sur une seconde passe**, et ce n'est
pas encore un constat : personne ne l'a reproduit. `U10` l'exige avant qu'une ligne corrige
quoi que ce soit.

### Deux moteurs, et un nom écrit en dur

Le détourage par modèle n'en connaît **qu'un seul, `u2net`, écrit dans le code** — là où la
règle du dépôt dit *le catalogue décide, jamais une liste en dur*. Le projet voisin
`../MySpriteAi` détoure déjà avec **BiRefNet**, du savoir payé au prix fort dans cette maison :
le second moteur n'est pas une découverte à faire, c'est un nom à cesser d'écrire en dur.
Voir `U13`.

---

## 31 août 2026 — la première séance, sur la V2.1 entière

Quinze points relevés par l'auteur dans l'ordre où il les a rencontrés, le jour même où la
V2.1 s'est close. **Tous sont tranchés** : trois étaient déjà réparés, les douze autres sont
devenus les neuf étapes `U1` à `U9` de `docs/PLAN.md`, avec leurs critères dans
`docs/tranches/U.md`. Rien ne reste ouvert ici — ce qui suit ne garde que les **quatre
mesures** prises pendant la vérification, parce qu'elles n'ont pas d'autre endroit où vivre
et qu'elles seront les points de comparaison quand les étapes seront tenues.

**Chaque point a été vérifié sur la machine de l'auteur, l'atelier tournant**, avant d'être
planifié. C'est ce qui a fait changer trois points de nature, dont le plus lourd.

### Ce qui a été mesuré, le 31 août 2026

| Ce qu'on a mesuré | La mesure |
|---|---|
| Le cadre d'une table contre l'image qu'il doit montrer | Image d'origine **1 024 × 1 024**, cadre **606 × 626**, facteur d'ajustement bloqué à **1×** par une règle qui interdit de réduire. On ne voyait donc qu'un coin — transparent, donc le damier. C'est le « bruit » du relevé, et c'est aussi pourquoi le rectangle de recadrage paraissait sans rapport avec son rendu |
| Un cran du curseur d'attraction d'une palette | **2 089 puis 2 170 ms** par relâchement, sur un paquet de **trois** images ; l'aperçu qui suit ajoute **462 ms**. La cause n'est pas la fusion des couleurs : c'est l'empreinte, qui relit et requantifie toutes les images du paquet pour décider s'il faut les relire. Un paquet de neuf images existe dans le dépôt |
| Le lien de téléchargement d'une vignette, au cran de repos | Tuile **132,6 px**, ligne de mesures réclamant **137 px** dans une boîte de **115**, lien débordant de **13,2 px** au-delà du bord droit |
| Le verrou de double dépense | **Il existe et il est côté serveur** : une génération porte un identifiant, et le service rend *déjà soumise* sans rien facturer quand il revoit le même. L'écran fabriquait un identifiant neuf **à chaque clic** — le verrou était donc jeté avant d'avoir servi, et cinq clics valaient cinq appels payés |

### Ce que la séance apprend, au-delà de ses quinze points

**Deux points sur quinze étaient déjà réparés au moment du relevé** — par un correctif du
même soir, une heure plus tôt. Ce n'est pas un hasard de calendrier : l'auteur se sert de
l'atelier pendant qu'on le corrige, et un relevé d'usage a donc une date de péremption
courte. **Vérifier avant de diagnostiquer** a évité de replanifier deux étapes entières.

**Le symptôme désignait rarement la cause.** « Du bruit dans la table de recadrage » était un
zoom sans réduction. « Les palettes sont lentes » était l'empreinte qui refait le calcul
qu'elle sert à éviter. « On peut payer cinq fois » était un verrou existant que l'écran
jetait. Trois fois sur douze, la réparation n'était pas là où l'on regardait — et les trois
fois, c'est d'avoir fait tourner le produit qui l'a montré.

---

## 29 août 2026 — la première séance de C3, et ce que la différence ne voit pas

Six planches d'équipement payées sur un personnage qui portait déjà la pièce, un seul modèle
(`openai/gpt-image-2`), deux pièces — un casque et une hache — envoyées chacune aux deux
occupations, 0,92 et 0,62. Ce qui suit n'est **ni cadré ni planifié** ; le défaut de recalage
trouvé le même jour l'est, lui, et vit dans `docs/PIEGES.md` et dans R5.

### Une pièce qui s'ajoute revient nette, une pièce qui se substitue revient en poussière

Le casque est revenu en semis de pixels épars, sur les quatre planches où il figurait, y
compris celle que l'échelle et les mesures déclaraient bonne. **La différence n'est pas
l'échelle**, qui vaut 1,00 partout, et ce n'est pas non plus la portée déclarée : c'est la
place que la pièce prend sur le corps.

**La hache dit les deux moitiés du défaut à elle seule** : son fer, qui dépasse de la
silhouette, revient entier au pixel près ; son manche, là où il croise le bras, ne revient pas.
Une seule pièce, un seul appel, et le calque s'arrête net à la frontière du corps.

- Ce qui **s'ajoute** occupe des pixels où le corps était transparent, donc `ajout` le trouve
  entier, et rien ne peut l'effacer.
- Ce qui **se substitue** occupe l'empreinte de ce qu'il remplace, avec des valeurs voisines.
  Il relève donc de `touche`, et `touche` compare les couleurs **avec une tolérance au voisin
  de 3×3** — un choix juste, pris pour ne pas compter un résidu de recalage sous le pixel comme
  du repeint, et qui absorbe du même coup la substitution.

Deux décisions correctes séparément, dont la composition perd la pièce : la famille de défaut
que T9 avait trouvée sur la toile, et que la V2 vient de retrouver deux fois — ici, et sur les
deux recalages successifs du même jour.

### Ce que ça remet en cause

**La taxinomie des pièces.** Le produit oppose *contenue* et *qui agrandit* — la question de
l'échelle, et elle est bien posée. Ce qui décide de la **lisibilité** du calque est *ajoute*
contre *substitue*, et les deux découpes ne se recouvrent pas : un casque est contenu et se
substitue, une hache agrandit et s'ajoute. Rien ne dit qu'il faille une seconde portée déclarée
— l'auteur en aurait deux à poser au lieu d'une —, mais rien ne dit non plus que le produit
puisse rester muet sur un cas qu'il rate systématiquement.

**Trois pistes, aucune tranchée.** Baisser le seuil ou renoncer à la tolérance 3×3 sur la seule
zone de la pièce, quand elle est donnée. Rendre la substitution visible autrement — un cinquième
chiffre qui dise « la pièce est tombée là où il y avait déjà du corps ». Ou l'assumer et compter
sur la main de C4, qui est de toute façon ce qui rattrape ce que la différence ne voit pas.

**C'est la troisième qui a été prise, le 29 août 2026 — et il reste la moitié de l'entrée.**
C4 est livrée, et sa seconde couche ne fait pas que retirer : elle **ramène** les pixels revenus
là où la mesure n'a rien trouvé. Sur ce casque-ci, mesuré par la route de l'image : 451 pixels
opaques avant, 1 044 après un seul passage de la main, et la pièce est lisible. Ce qui reste
ouvert et **non cadré** est la première piste : rien n'annonce *d'avance* qu'une pièce va se
substituer, et aucune des cinq mesures ne le dit — celle-ci affichait une échelle à 1,00 et une
silhouette à 100 %. La réparation coûte donc un geste au lieu d'une image perdue, et c'est tout
ce qui a changé. Voir `docs/archive/plan-versions-tenues.md`, C4, et `docs/status/etat.md`.

**Ce que ça ne remet pas en cause** : ni le pliage, ni le compte, ni le masque, ni le fait que
les mesures ne refusent rien. Le calque illisible est **gardé**, comme prévu, et il se retouche.

---

## 29 août 2026 — le point de comparaison avec SpriteCook

Relevé après usage de l'atelier tenu (V1 close, C1, C2, R1 et R2 écrites) et d'une séance
complète sur SpriteCook, parcours *Create Your Character* de bout en bout.

### Le constat, en une phrase

**L'atelier fait plus de choses que SpriteCook et en demande beaucoup plus à celui qui s'en
sert.** Sur la matière — le post-traitement non destructif, la palette rétroactive, le pliage
d'un lot en un seul appel, le MCP, le coût réel enregistré — il est déjà devant. Sur le geste,
il est derrière : SpriteCook conduit, l'atelier attend qu'on lui dicte.

### Ce qui a été demandé, et ce qui a été construit

| Ce que SpriteCook fait | Ce que l'atelier fait aujourd'hui |
|---|---|
| Cinq écrans nommés, un pas à la fois, chacun annonce le suivant sur son bouton | Un écran, trois panneaux, tous les réglages disponibles en même temps |
| On tape « Dwarf miner » (deux mots) et le produit fabrique le reste | On tape ce qu'on veut, et ce qu'on tape est tout ce qui part |
| Un style et une perspective se choisissent **en images**, trois vignettes | Sept champs de bible en texte libre, tous vides à l'ouverture |
| Une image importée est **analysée** : « détecté comme *detailed* », avec la raison, et le réglage reste modifiable | Une image importée déclare tout : famille, échelle, traitement — rien n'est proposé |
| Chaque animation reçoit un **prompt de mouvement rédigé pour ce personnage-là**, relisible et modifiable, plus un bouton *Enhance* | Le nom de la pose part tel quel dans le prompt : « marche » |
| Le prix s'affiche sur le bouton avant de payer | Le prix s'affiche aussi — c'est acquis depuis T1 |
| Rien ne se retouche à la main : ce qui rate se régénère, et se repaie | Tout se retouche sans repayer — sauf au pixel, qui n'existe pas encore |

Le produit a été construit sur une lecture juste de SpriteCook (`readme.md` : « la valeur
n'est pas dans le modèle d'image, elle est dans le post-traitement et les workflows
guidés »). **La première moitié a été prise, la seconde a été laissée.**

### La racine : le produit sait, et il ne dit rien

Une règle du PRD dit, à la section *Hors périmètre* : « **Écarté parce que l'auteur fait
mieux.** Contrôle de conformité automatique. Description automatique du style. Routeur
d'intention qui devinerait le type d'asset. » Elle est juste, et elle a été écrite contre une
panne réelle : un produit qui déciderait à la place de l'auteur, ou qui refuserait son travail
sur une mesure.

**Elle a été appliquée plus loin que ce qu'elle dit.** Elle interdit de *décider* à la place
de l'auteur ; elle a été lue comme interdisant de lui *proposer* quoi que ce soit. Résultat :
tout écran de l'atelier ouvre sur du vide, et chaque vide est une décision qu'il faut prendre
avant d'avancer.

SpriteCook ne décide jamais non plus — il annonce. Sur l'import du nain, il affiche :
« *Detected as pixel art, but it exceeds the 256×256 pixel animation limit. We switched this
upload to detailed.* » Il a deviné, il dit qu'il a deviné, il dit pourquoi, et les deux
boutons restent là pour le contredire. Personne n'a rien perdu.

**Le dépôt a déjà cette règle, mais dans un seul sens.** « Ce qui est indisponible est grisé
avec sa raison, jamais proposé puis refusé » est un invariant depuis T1. Il lui manque son
jumeau, et c'est la seule idée neuve de ce relevé :

> **Ce qui est devinable est prérempli avec sa provenance, et se défait d'un clic.**

Un champ prérempli n'est pas un champ décidé : il porte d'où vient sa valeur — « proposé,
d'après ta bible », « proposé, d'après l'image » —, il s'efface, et ce qui part reste
exactement ce qui est affiché. L'invariant de R2 — *ce qui est montré est ce qui part, mot
pour mot* — n'est pas touché : il porte sur le trajet entre le champ et le fournisseur, pas
sur qui a rempli le champ.

---

### 1 · La consigne de pose — le défaut le plus cher, et le moins cher à réparer

**Le constat.** Une pose est un nom et un nombre d'images, rien d'autre
(`atelier/domaine/plan.py`). Ce nom part **tel quel** dans le prompt : pour un lot,
`atelier/services/pliage.py` écrit « *The cells, in reading order, show: 1. marche; 2. idle* » ;
pour une pose seule, `interface/src/App.tsx` compose `description du personnage + ", " + nom de
la pose`. Un modèle reçoit donc le mot **« marche »**, en français, au milieu d'une consigne
anglaise, sans direction, sans vue, sans cadrage.

**Pourquoi c'est comme ça.** Le commentaire de `_plier` le dit sans le voir : « le texte d'une
case est le **nom** de la pose, pas son identifiant : il part dans le prompt, et un repère de
fichier n'a jamais décrit une attitude à un modèle ». C'est exact — et un *nom* non plus. La
règle « le prompt est en anglais, parce que c'est ce sur quoi les modèles sont entraînés » vaut
pour les consignes de planche ; le nom de pose la traverse en français.

**Ce qu'on propose.** Une pose gagne **un second champ : sa consigne, en anglais**. Le nom
reste l'étiquette de l'auteur (« Marche sud ») ; la consigne est ce qui part :

> `walking posture, facing south, front view, full body, top-down 2D game pose`

Trois choses en font une correction et pas une option de plus :

- **Elle est préremplie.** Un projet neuf reçoit un plan de poses par défaut ; ces poses-là
  arrivent avec leur consigne déjà écrite. Créer « marche sud » propose la consigne standard,
  et l'auteur la garde ou la réécrit.
- **Elle se voit avant de partir.** Le dépliant « ce qui partira » de R2 gagne un bloc de plus,
  `pose`, à côté de `bible`, `sujet` et `planche`. Rien n'est ajouté en chemin.
- **Elle ne dit jamais le style.** Le style vient de la bible, d'un seul endroit — c'est la
  décision de T4, et elle tient. La consigne de pose dit une **attitude**, une **direction** et
  une **vue**, jamais un rendu.

**Ce que ça coûte.** Un champ sur `Pose`, une ligne dans `_plier`, un bloc dans `parties()`, un
champ de plus dans l'écran des poses. C'est la correction au meilleur rapport de toute cette
liste.

### 2 · Rédiger et étoffer — le bouton qui manque sous le champ de prompt

**Le constat.** Entre « nain mineur » et le texte qui marche, il n'y a rien. Le texte qui
marche, l'auteur le connaît — il en a donné un exemple de dix lignes, qui décrit la carrure, la
barbe, la chemise, la ceinture, les sandales, le sac, les deux lanternes, puis l'attitude et la
vue. Personne ne l'écrit dix fois par séance.

**Pourquoi c'est comme ça.** Les reprises ont écarté « prompt réécrit par l'application,
traduit ou enrichi automatiquement : ce qui est montré est ce qui part, mot pour mot ». La
règle vise l'enrichissement **en chemin** — invisible, entre le champ et l'appel. Elle
n'interdit pas d'écrire **dans le champ**, sous les yeux de l'auteur, avant qu'il relise.

**Ce qu'on propose.** Deux boutons sous le champ, et deux seulement :

- **Rédiger** — le champ est vide ou tient en trois mots ; l'atelier propose un signalement
  complet, dans la forme de l'exemple : silhouette, visage, vêtement du haut, du bas,
  chaussures, ce qui est porté, ce qui est tenu, puis l'attitude. Le champ se remplit, il est
  éditable, et rien n'est parti.
- **Étoffer** — le champ contient déjà quelque chose ; l'atelier le complète sans le
  contredire, et **montre ce qu'il a ajouté** avant que l'auteur accepte.

Deux garde-fous qui font que ça ne casse rien :

- **Ça n'appelle pas le fournisseur d'images**, donc ça ne coûte pas un centime d'appel
  d'image ; ça appelle un modèle de texte, dont le coût s'affiche comme tout le reste et qui se
  coupe par un réglage. Réseau coupé, les deux boutons sont **grisés avec leur raison**, comme
  le reste du produit.
- **Ça n'écrit jamais le style.** Le style est dans la bible. Rédiger décrit un *sujet*.

**Une variante à trancher, et qui vaut peut-être mieux que le bouton :** un **gabarit de
signalement** — huit champs nommés (silhouette, tête, haut, bas, pieds, porté, tenu, attitude)
qui se replient en une phrase. Ça ne demande aucun modèle de texte, ça marche réseau coupé, et
ça apprend à l'auteur la forme qui marche au lieu de la lui rendre. C'est la même idée que la
bible en champs nommés, appliquée au sujet.

### 3 · Le personnage par le texte, ou par l'image qu'on a déjà

**Le constat.** L'atelier sait faire naître un corps de personnage à partir d'un prompt (C1) :
on écrit un sujet, on génère, on désigne l'image comme corps. C'est le chemin par le texte, et
il est bon. **Le chemin par l'image n'existe pas** : quand l'auteur a déjà une planche de son
nain, il ne peut pas dire « voilà mon personnage, décris-le et reprends à partir de là ».

**Ce qu'on propose.** Une seconde entrée, en face de la première, sur l'écran des personnages :
*j'ai déjà son image*. On dépose l'image — R3 vient d'apporter l'import depuis l'écran, c'est
là-dessus que ça se pose —, et l'atelier **propose**, provenance affichée, tout modifiable :

- un **signalement rédigé depuis l'image**, qui remplit la description du personnage ;
- l'image **désignée comme concept art** du personnage (US-124 existe déjà) ;
- ce qu'il a **mesuré** de l'image, dit en clair : « grille de pixel détectée : 4 px ; ton
  projet impose 64 ». `atelier/image/traitement.py` sait déjà mesurer une grille
  (`mesurer_grille`), et cette mesure n'est aujourd'hui montrée nulle part.

  > *Deux moitiés de cette ligne ont bougé le 3 septembre 2026, en `D2`.* **La mesure est
  > montrée** : la table de grille d'une image dit sur quels carrés le modèle a peint, et
  > combien l'image en compte. Et **ce n'est plus `mesurer_grille` qui la fait** — celle-là
  > répondait *2 avec une netteté de 0,94* sur une peinture, faux et confiant. C'est
  > `retrouver_grille`, qui sait **renoncer** et le dit. Ce qui reste à décider ici est donc la
  > seule chose que la ligne demandait vraiment : la montrer **au moment de l'import**, à côté
  > de ce que le projet impose.

**Ce que ça ne remet pas en cause.** « Le corps naît dans l'atelier, et jamais d'une planche
venue d'ailleurs » (US-122) reste vrai : l'image importée devient une **référence** et une
**description**, pas un corps. La première pose se génère toujours ici. C'est la promesse de la
grille et de la palette connues, et elle tient.

### 4 · Le récap complet de ce qui part

**Le constat.** Ce qui part est réparti sur **quatre endroits de l'écran**, et aucun ne montre
les images :

| Où | Ce qu'on y voit | Ce qui manque |
|---|---|---|
| Dépliant sous le prompt (R2) | le **texte** exact : bible, sujet, planche | aucune image |
| Bloc « Ce qui part », colonne 2 | le **compte** : 3 / 4 références, dont artworks, dont gabarit | — |
| Liste sous ce bloc (C1) | une ligne par image, sa **provenance** (« artwork officiel », « concept art », « réinjection »), sa portée, sa case à décocher | **aucune vignette, aucun nom** — on décoche « artwork officiel » sans savoir lequel |
| Bande « Repart avec », au-dessus du prompt | les vignettes des réinjections **posées à la main** | ni les artworks, ni les concept arts, ni le gabarit |

Le mécanisme est là — `compter_references` rend déjà la ligne avec sa provenance et sa portée
(`atelier/services/generation.py`). **Il lui manque la vignette et le nom**, et il manque un
endroit qui montre le texte et les images ensemble.

**Ce qu'on propose.** Un bouton unique, à côté du bouton qui paie : **« Voir ce qui part »**.
Il ouvre un panneau qui montre, dans l'ordre d'envoi et rien d'autre :

1. le texte complet, bloc par bloc, avec son origine — c'est le dépliant de R2, déplacé ;
2. **chaque image, en vignette**, avec son nom, sa provenance en clair (« artwork officiel ·
   famille personnages », « concept art de Balthazar », « réinjection · source d'édition »), et
   sa case à décocher avec ses trois portées — c'est la liste de C1, avec l'image ;
3. le **gabarit** de cases vides quand un lot est armé, dessiné, avec sa ligne « on ne le
   décoche pas, et voici pourquoi » ;
4. en pied : le compte contre le plafond du modèle, et le coût.

Les quatre endroits actuels ne disparaissent pas tous : la bande « Repart avec » et le compte
restent, parce qu'ils se lisent sans rien ouvrir. **Ce qui disparaît, c'est la liste aveugle de
la colonne 2**, remplacée par une ligne « 4 images · voir ce qui part › ».

### 5 · Le détourage : la pipette, la poche fermée, et la gomme

**Le constat, et il est structurel.** Le moteur de détourage courant est un remplissage
**depuis le bord** de l'image (`_remplir_depuis_le_bord`). Une zone de fond **enfermée par le
sujet** — le blanc coincé sous un bras, entre la lanterne et la jambe, dans une boucle de
ceinture — n'est jamais atteinte par ce remplissage. Ce n'est pas un problème de réglage :
**aucune valeur de tolérance ne peut y arriver**, parce que le chemin n'existe pas. Monter la
tolérance mange le sujet bien avant d'atteindre la poche.

**Pourquoi ça n'avait pas été vu.** Le moteur a été mesuré le 27 août sur douze images de six
modèles — douze silhouettes propres. Ces douze images avaient toutes un fond plat *ouvert*. La
poche fermée est un mode de panne différent, et il ne se voit qu'à l'usage.

**Et le PRD l'avait écarté.** Section *Hors périmètre*, « Écarté par choix d'ergonomie » :
« **Détourage par couleur.** » C'est la troisième fois qu'une ligne de cette section est
retournée par une séance d'usage — après la toile du tableau d'inspiration (T8, le 27 août) et
la génération autre que pixel art (R2, le 28 août). Le motif est chaque fois le même : la ligne
était juste **comme réglage global** et fausse **comme geste ponctuel**.

**Ce qu'on propose — trois outils, du moins cher au plus fin, et tous non destructifs.**

1. **La pipette.** Un troisième moteur de passe, à côté de `bord` et `modele` : `couleur`. On
   clique une couleur dans l'image, et ce qui lui ressemble à ± tolérance devient transparent.
   Deux portées, et c'est l'auteur qui choisit : *cette tache-ci* — la zone connexe sous le
   curseur — ou *partout dans l'image*. C'est une **passe de recette** de plus, donc rejouable,
   annulable, nommable, et elle traverse la palette rétroactive comme les autres.
   `atelier/image/traitement.py` a déjà tout ce qu'il faut (`composantes`, `durcir`, `ronger`) ;
   il manque la passe et le clic.

2. **La poche fermée, proposée.** C'est le *prérempli* appliqué au détourage : après la passe
   de bord, l'atelier cherche les zones de fond **entièrement enfermées** par le sujet et les
   **montre en surbrillance** — « 3 poches trouvées, 412 px au total · les effacer ? ». Il ne
   les efface pas tout seul : il les montre et attend un clic. Le calcul est un balayage de
   composantes connexes, il ne coûte rien, ne touche pas le fournisseur et marche réseau coupé.
   Dans le cas du nain, il aurait réglé le problème sans que l'auteur ait à viser quoi que ce
   soit.

3. **La gomme au pixel.** Pour les trois pixels que rien n'atteint. Elle est **déjà prévue**,
   mais au mauvais endroit : la tranche C4 « La main » la réserve à la retouche d'un *calque
   d'équipement*, qui n'existera qu'après C3. **Il faut la sortir de C4** et la poser sur la
   recette de n'importe quel asset : une sixième place nommée, « la main », après les bords —
   dernière, parce qu'elle porte sur l'image telle qu'elle sortira. Elle garde toutes les règles
   de T2 : couche séparée, annulable, rejouable, et elle ne détruit pas le détourage qu'elle
   corrige.

### 6 · Choisir en images ce qui décide de l'apparence

**Le constat.** La bible porte sept champs nommés depuis R2, dont les deux qui décident le plus
: *technique de rendu* et *vue et cadrage*. Ce sont sept boîtes de texte vides. Un auteur qui ne
sait pas quoi y écrire n'écrit rien — et c'est très exactement ce qu'a montré la séance du
28 août : les cinq champs vides sur trois projets réels.

**Ce qu'on propose.** Pour ces deux champs-là seulement, **des vignettes plutôt qu'un champ
vide** — c'est ce que SpriteCook fait avec ses trois perspectives, et ça marche parce qu'on
choisit une image, pas une phrase. Trois ou quatre vignettes par champ, chacune montrant **le
texte anglais qu'elle écrit** sous elle. On clique, le champ se remplit, il reste éditable, et
il porte « proposé ». Les cinq autres champs ne bougent pas.

**Ça ne construit pas un tunnel.** On ne traverse rien : les vignettes sont *dans* le panneau
d'univers, à la place du champ vide. L'atelier s'ouvre toujours sur un prompt actif.

---

### Ce que ce relevé remet en cause dans les documents d'autorité

Rien n'est modifié par ce document — il note ce qui devra l'être.

| Document | Passage | Ce que l'usage a montré |
|---|---|---|
| `docs/PRD.md`, *Hors périmètre* | « Écarté par choix d'ergonomie … Détourage par couleur » | Faux comme geste ponctuel. Troisième retournement d'une ligne de cette section |
| `docs/PRD.md`, *Hors périmètre* | « Écarté parce que l'auteur fait mieux » | Juste, mais à préciser : **décider** est écarté, **proposer avec sa provenance** ne l'est pas |
| `docs/PRD.md`, *Hors périmètre* (reprises) | « Prompt réécrit par l'application … automatiquement » | Juste pour l'enrichissement **en chemin**. Écrire **dans le champ**, sous les yeux de l'auteur, est autre chose |
| `docs/PRD.md`, *Utilisateur cible* | « Il ne veut ni tunnel de configuration, ni assistant, ni écran à traverser » | Tient. Rien ici n'ajoute d'écran à traverser : tout se pose dans les écrans existants |
| `docs/archive/plan-versions-tenues.md`, C4 « La main » | la retouche au pixel réservée au calque d'équipement | À sortir de C4 : la gomme sert au détourage de n'importe quel asset, et C3 n'est pas écrite |

### Ce que ce relevé ne remet pas en cause

Les invariants tiennent tous, et c'est ce qui rend ces corrections peu coûteuses : le traitement
reste non destructif ; le post-traitement ne touche ni le GPU ni le fournisseur ; le style vient
de la bible et d'un seul endroit ; ce qui est montré est ce qui part ; rien n'est jamais relancé
automatiquement ; le catalogue décide ; les dimensions mesurées font foi ; le corps naît dans
l'atelier ; une seule grille d'assets dans tout le produit.

### L'ordre proposé, si on les prend

1. **La consigne de pose** — le plus mauvais résultat de génération aujourd'hui, la correction
   la plus petite.
2. **La pipette et la poche fermée** — un blocage constaté, sans contournement possible.
3. **Le récap complet de ce qui part** — le mécanisme existe, il lui manque la vignette.
4. **Rédiger / étoffer le sujet** — le plus visible à l'usage, mais il faut d'abord trancher
   entre le bouton et le gabarit de signalement.
5. **La gomme au pixel** — sortie de C4, posée sur la recette.
6. **Le personnage par l'image** — se pose sur R3, qui vient d'arriver.
7. **Les vignettes de bible** — le moins urgent, le plus tributaire du dessin.
