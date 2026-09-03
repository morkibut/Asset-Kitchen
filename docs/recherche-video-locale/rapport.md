# Animer un sprite en local — ce que la machine peut, et ce qu'elle ne peut pas

> Écrit le 3 septembre 2026, à la demande de l'auteur : *« est-ce faisable ou pas, fiable ou
> pas, rapide ou lent, la qualité est-elle obtenable en local, la fidélité à l'image de
> référence et au prompt sont-elles tenues ? »*
>
> **Ce document ne décide rien sur le produit.** `docs/PRD.md` dit ce que l'atelier doit faire,
> `docs/PLAN.md` dans quel ordre. Celui-ci répond à une question de faisabilité.
>
> **Comment il a été fait.** Huit recherches en parallèle, puis une relecture **adverse** dont
> le travail était de faire tomber les affirmations, pas de les confirmer. Elle en a **réfuté
> huit et nuancé une quarantaine** — et plusieurs de ces corrections retournent la conclusion.
> Tout ce qui suit distingue **ce qui est relevé sur cette machine**, **ce qui est mesuré par un
> tiers** et **ce qui est seulement annoncé**.

---

## En une page

**C'est faisable, et ça a été fait le 3 septembre 2026 sur cette machine. Ce n'est pas rapide —
deux minutes pour une seconde de clip — mais ça ne coûte rien, ça tourne seul, et la bande de
sprites qui en sort est utilisable.**

| La question posée | La réponse — **mesurée sur cette machine le 3 septembre 2026** |
|---|---|
| **Est-ce faisable ?** | **Oui, et c'est fait.** Wan 2.2 image→vidéo 14 milliards compressé + le greffon pixel art : le clip sort, le personnage tient, la bande de sprites est utilisable |
| **Est-ce fiable ?** | **La machine, oui. La chaîne, non** — trois pannes d'intégration traversées, une par étape, aucune documentée. C'est un coût qui se paie une fois |
| **Est-ce rapide ?** | **Non. 130 secondes pour une seconde de clip** (17 images en 832 × 480), soit 7,6 s par image |
| **La qualité est-elle obtenable ?** | **Oui.** Ramenée sur 64 pixels et 24 couleurs, la bande garde capuchon, sac, lanterne, ceinture et bottes, blocs carrés et contour net |
| **La fidélité au sprite ?** | **Tenue.** Le sprite est ancré au pixel près sur la première image, et le design survit au clip. Un artefact relevé : la lanterne se dédouble sur une image |
| **La mémoire tient-elle dans 8 Go ?** | **Oui — 6,0 Go pris sur 6,92 disponibles**, sans débordement |
| **Le fond reste-t-il détourable ?** | **Oui, et mieux que chez le payant** : il dérive de 3 niveaux contre 20, et reste trois fois plus uni |

### ⚠️ Rectification du 3 septembre 2026 — l'axe de comparaison était le mauvais

**Une première version de ce rapport comparait le local au chemin payant sur le prix et la
vitesse, et concluait que « le local perd sur tous les terrains ».** L'auteur a corrigé le
cadre, et il avait raison : **son but est de refaire ces outils moins cher, pas de choisir
entre eux et le local.** Sur cet axe-là :

- **trois à cinq minutes par clip n'est pas un défaut** quand la machine tourne toute seule et
  que rien n'est facturé ;
- **`PixelLab` et `SpriteCook` ne sont pas des solutions, ce sont les concurrents à battre.**
  Ils gardent une utilité, et une seule : servir d'**étalon de qualité** — savoir à quoi
  ressemble « bien » avant de juger notre propre sortie.

### Les trois choses à retenir

1. **Le chemin qui vise l'objectif est celui du gros modèle, pas du petit.** Le greffon pixel
   art — la seule pièce qui fasse dessiner de vrais sprites plutôt qu'un rendu lissé —
   n'existe que pour le 14 milliards. Et ce 14 milliards, en version compressée avec un
   greffon d'accélération, **passe sur 8 Go**. C'est le montage du § 9.

2. **Un paquet de nœuds libre fait déjà tout l'après-clip**, et il répare au passage trois
   défauts que `docs/bilan-v3.md` a identifiés dans notre propre code. C'est le gain le plus
   sûr de cette recherche, et **il ne dépend d'aucun modèle**.

3. **Le chemin payant de la V3 reste le filet.** Rien ici ne le remet en cause tant que le
   local n'a pas fait ses preuves — mais il n'est plus l'objectif.

---

## 1 · Ce qui est vrai de cette machine — relevé, pas supposé

| Ce qui est relevé | La valeur |
|---|---|
| Carte graphique | **RTX 3080 Laptop**, 8 192 Mio, **plafond 100 W** |
| Mémoire système | 33,6 Go |
| Place libre sur le disque | **69 Go** (59 Go déjà pris par les modèles existants) |
| ComfyUI | **0.33.4**, Python 3.13.12, PyTorch 2.12.1 (CUDA 13) |
| Montages livrés d'origine | **528**, dont une centaine touchant la vidéo |
| Modèles vidéo installés | **aucun** |
| Greffon de quantification | **`ComfyUI-GGUF` déjà présent** |
| `sageattention`, `triton` | **absents tous les deux** |

> ⚠️ **Le plafond de 100 W est le chiffre le plus important du tableau.** Une RTX 3080
> « Laptop » porte à peu près le même processeur qu'une 3070, mais avec la moitié du budget
> électrique. La relecture adverse a confirmé le principe sur une source d'origine : **une
> 3070 portable autorisée à 140 W devance de plus de 10 % deux 3080 portables bridées à 100 et
> 105 W.** Tout temps lu en ligne est mesuré sur une carte de bureau ; il faut le majorer.

> ⚠️ **`sageattention` et `triton` absents.** Ce sont les deux accélérateurs que citent tous les
> modes d'emploi, et sous Windows leur installation est réputée pénible. *La relecture adverse
> a réfuté le chiffre qui circulait sur leur gain exact — il n'est appuyé par aucune mesure sur
> une carte de la génération de la tienne. On sait qu'ils aident, on ne sait pas de combien ici.*

### Deux nœuds décisifs sont déjà chez toi

Relevés le 2 septembre 2026 **dans le code installé**, `comfy_extras/nodes_context_windows.py` —
aucun greffon à ajouter :

- **`closed_loop`** avec le calendrier `looped_uniform` : **la dernière image rejoint la
  première.** C'est le mécanisme de boucle qu'un cycle de marche exige, et il est natif.
- **`retain_first_frame`** : *« remettre l'image de départ dans chaque fenêtre de calcul »*.
  C'est le seul levier natif contre la dérive du personnage. **Aucun témoignage ne dit ce que
  ça donne sur du pixel art** — c'est la mesure la plus originale que ton banc puisse produire.

---

## 2 · Est-ce faisable ? Oui, par un seul chemin

### Wan 2.2 « TI2V-5B »

| Ce qui compte | Ce qu'il donne |
|---|---|
| Part-il d'une image ? | **Oui** (`Wan22ImageToVideoLatent`) |
| Tient-il dans 8 Go ? | **Oui**, et c'est **mesuré** — voir § 3 |
| Licence | **Apache 2.0**, vérifiée à la source par la relecture adverse. Sans seuil de chiffre d'affaires |
| Montage tout fait | **Oui**, livré d'origine (`video_wan2_2_5B_ti2v`) |
| Modèle de vision en plus ? | **Non** — contrairement au Wan 2.1. 1,18 Go et un chargement économisés |

### Deux façons de l'installer, et la plus simple n'est pas la plus petite

| La façon | Ce qu'il faut faire | Place disque |
|---|---|---|
| **Par le gestionnaire de ComfyUI** | trois cases : *Wan2.2 ti2v 5B (fp16)* 10 Go, *umt5_xxl fp8* 6,7 Go, plus le décodeur à la main | **~18 Go** |
| **En quantifié, à la main** | trois adresses à télécharger | **8,7 Go** |

> **Le résultat contre-intuitif, et il est mesuré.** On croit qu'un modèle de 9,5 Go ne peut pas
> tenir dans une carte de 8 Go et qu'il faut donc le compresser. **C'est faux depuis le
> printemps 2026** : ComfyUI déborde tout seul sur la mémoire système. L'auteur du seul banc
> trouvé sur une carte de 8 Go a fait tourner la **version pleine, sans compression**, et
> conclut explicitement que la compression n'était pas nécessaire. Les 33,6 Go de mémoire
> système de cette machine sont un atout réel.

> ⚠️ **Et un piège que la relecture adverse a levé, sur le calcul de mémoire lui-même.** On
> additionne spontanément les trois fichiers pour voir s'ils tiennent : modèle quantifié 5,4 Go
> + encodeur de texte 6,7 Go + décodeur 1,4 Go = **13,5 Go, soit bien plus que la carte**.
> Cette addition est **fausse en pratique** : ComfyUI charge l'encodeur, lit la phrase, le
> décharge, puis charge le modèle. Ils ne cohabitent jamais. **Mais ça veut dire que le temps de
> chargement compte double**, et que la mémoire système est sollicitée à chaque bascule.

### Les autres, et pourquoi ils tombent

| Le chemin | Pourquoi il tombe |
|---|---|
| **Le montage AnimateDiff que tu avais repéré** | Il est classé « image vers vidéo », mais **l'image n'y sert qu'à donner un style** : le sprite n'est jamais posé comme première image du clip, donc le personnage ne serait pas conservé. Le mouvement qu'il produit est un **zoom de caméra**, pas une marche. Il réclame cinq greffons externes, dont un abandonné depuis avril 2025 |
| **Wan 2.2 en 14 milliards** | *Correction de la relecture adverse : ses deux fichiers ne cohabitent **pas** en mémoire, ils s'exécutent l'un après l'autre. Le coût est en disque et en temps de chargement, pas en mémoire vidéo.* Reste que c'est 10 à 30 minutes par clip sur 8 Go |
| **LTX-2, 2.3, 2.5** | *Correction : contrairement à ce qui circule, **Lightricks n'a publié aucun tableau officiel de mémoire** — les « 16 Go minimum » ne sont annoncés par personne.* Un utilisateur rapporte même LTX-2 tournant sur une carte de **6 Go**… avec 44 Go de mémoire système et 15 minutes pour 10 secondes. Le vrai obstacle est ailleurs : **sa licence n'est gratuite qu'en dessous d'un seuil de chiffre d'affaires** |
| **HunyuanVideo, et `FramePack` qui en dérive** | **Leur licence exclut nommément l'Union européenne.** Tu es en France : fermé, pas lent. `FramePack` s'annonce Apache 2.0 mais **fait tourner les poids de HunyuanVideo** — l'étiquette du code ne purge pas la licence des poids |
| **Wan 2.5, 2.6, 2.7, 3.0** | **N'existent pas en poids téléchargeables.** Voir § 6 |
| **Stable Video Diffusion** | Tient facilement, mais **n'accepte aucune consigne écrite** : on ne peut pas lui demander un cycle de marche |
| **Wan Alpha** — le modèle à fond transparent | Il existe et supprimerait tout le détourage. Mais il est **texte vers vidéo uniquement** : il ne part pas de notre sprite. Et c'est un 14 milliards. À reprendre le jour où une version image paraîtra |

---

## 3 · Est-ce rapide ? Non — et voici les seuls vrais chiffres

Le seul banc sérieux trouvé, sur **RTX 3070 de 8 Go**, Wan 2.2 TI2V-5B **en version pleine** :

| Ce qui est demandé | Temps mesuré |
|---|---|
| 832 × 480, **33 images** (1,4 s) | **56 secondes** |
| 832 × 480, **81 images** (3,4 s) | **142 secondes** |
| 1280 × 704, **121 images** (5 s) | **798 secondes** — treize minutes |

**Ce que ça donne sur ta machine** : la 3080 Laptop bridée à 100 W est *en dessous* d'une 3070
correctement alimentée. Estimation honnête pour un clip de 3 à 4 secondes en 480 × 480 :
**3 à 5 minutes**, hors premier chargement.

> ⚠️ **C'est le maillon faible du rapport, et il est assumé.** Aucun relevé de génération vidéo
> sur carte graphique **portable** n'a été trouvé, sur aucune carte. **Seul ton banc tranchera**
> — et c'est exactement pourquoi il est écrit.

**Le vrai point de rupture n'est pas le calcul, c'est le décodage final.** Dans le même banc, le
travail en 1280 × 704 passe l'essentiel de ses treize minutes à transformer le résultat en
images, parce qu'un découpage en tuiles ne s'est pas déclenché. En 480 × 480 le risque est
faible, mais **c'est là qu'il faut regarder si ça bloque**.

### Local contre payant

| | Local (Wan 2.2 5B) | Payant (Seedance 2.0 mini) |
|---|---|---|
| Prix d'un clip | **0 €** | 0,03 à 0,12 $ |
| Temps d'un clip | **3 à 5 minutes** (à confirmer) | quelques dizaines de secondes |
| Installation | 8,7 à 18 Go, un montage à régler | rien, c'est en place |
| Génération du modèle | celle d'il y a un an | l'état de l'art |
| Clips utilisables mesurés | **inconnu** | **2 sur 2** |

**Le local ne gagne sur aucun terrain, sauf un : le volume.** À 0,03 $ le clip, cent clips
coûtent 3 $ — ce n'est pas le prix qui freine, c'est le fait de compter. Le local supprime le
compteur, et le geste de la V3 est justement *commander plusieurs clips et garder le bon*.

---

## 4 · La fidélité au sprite — et le fait le plus dur du rapport

**Un modèle vidéo entraîné sur de la photo ne respecte pas spontanément un sprite pixel art.**
Il lisse, il ajoute du volume, il glisse vers le réalisme. C'est signalé sur les dépôts
officiels, et la communauté a dû fabriquer des correctifs.

### Le correctif existe, il est propre — et il ne marche pas ici

**`styly-agents/Wan2-2-pixel-animate`** — relevé et vérifié directement chez l'hébergeur :

| Ce qu'il est | La valeur |
|---|---|
| Ce qu'il fait | un greffon entraîné **exprès** pour animer des sprites pixel art depuis une image fixe |
| Entraînement | 226 vidéos d'animation de sprites — marches, attaques, repos, effets |
| Licence | **Apache 2.0** |
| Taille | 2,29 Go |
| Livré avec | un montage ComfyUI tout fait |
| **Modèle de base** | **`Wan2.2-I2V-A14B` — le quatorze milliards** |

> ⚠️ **C'est le fait qui coince tout.** Le seul greffon pixel art sérieux est bâti sur le gros
> modèle, celui qui demande 10 à 30 minutes par clip sur 8 Go. **Le petit modèle qui tient dans
> ta carte n'a aucun correctif pixel art**, et le greffon d'accélération qui lui est destiné n'a
> jamais été livré non plus — il reste annoncé « à faire ».
>
> Autrement dit : **sur 8 Go, on choisit entre un modèle qui tient mais ne sait pas dessiner du
> pixel art, et un modèle qui sait mais ne tient pas.**

> ⚠️ **Une correction sur la taille à viser, faite en lisant le code installé.** Un conseil qui
> circule dit de travailler en 512 × 512, au motif qu'un compresseur qui divise par 8 ferait
> correspondre un pixel de sprite à une case de calcul. **C'est vrai de Wan 2.1, faux de Wan
> 2.2** : relevé le 2 septembre dans `comfy/latent_formats.py`, la classe `Wan22` porte
> `spacial_downscale_ratio = 16`, pas 8. L'alignement parfait demanderait **1024 × 1024**, hors
> de portée. *Et la relecture adverse ajoute que même pour Wan 2.1, **aucune mesure ne montre
> qu'un canevas de 512 donne un meilleur résultat** : c'est une jolie arithmétique, pas un
> résultat.*

### Une bonne nouvelle sur le rendu

Le reproche « l'accélération tue le mouvement » vient de gens qui animent des humains
photoréalistes. Un praticien qui a comparé côte à côte note que **pour l'art plat façon dessin
animé, l'écart est faible** — un sprite pixel art est exactement ce type d'image. *Ce n'est pas
chiffré, mais ça va dans notre sens.*

Et le signalement « des textures réalistes s'ajoutent sur les images de style dessin animé »
chez LTX **a été fermé par l'éditeur le 8 mai 2026** — la relecture adverse a corrigé l'idée
qu'il restait ouvert et ignoré.

### Et la fidélité à la demande écrite ?

- **Le cadrage est bien suivi** — caméra fixe, personnage centré, fond uni : les clips payés du
  2 septembre le montrent.
- **Le découpage du temps en actions nommées n'est pas fiable** — c'est déjà le reproche fait au
  chemin payant, et rien ne dit qu'un modèle plus ancien fera mieux.

---

## 5 · Ce qui vient après le clip — et c'est le meilleur du rapport

**Tout ce qui suit la génération se fait sur le processeur, sans intelligence artificielle.** La
carte graphique n'est sollicitée que pour le détourage, que tu as déjà.

Et surtout : **quelqu'un a déjà écrit toute la chaîne.**

### `blubs-pixel-nodepack` — vérifié directement sur son dépôt

Licence **MIT**, mis à jour le 25 août 2026, **ne dépend que de ce qui est déjà dans ComfyUI**.
Huit nœuds qui couvrent la chaîne entière :

| Le nœud | Ce qu'il fait |
|---|---|
| **Sprite Chroma Key** | retire le fond par inondation depuis les bords, à pleine résolution |
| **Pixel Art Quantize** | réduit **en tenant compte de la transparence**, palette calculée sur les pixels du sujet seulement |
| **Sprite Auto-Crop & Anchor** | **union des boîtes, ancrage bas-centre** |
| **Sprite Loop Trim** | cherche tout seul le point de boucle |
| **Sprite Frame Dedup** | retire les images identiques et note leur durée |
| **Sprite Sheet Pack** | assemble la planche |
| **Aseprite Export** | écrit le fichier d'accompagnement |
| **H3 Frame Decimate** | ramène 24 images par seconde à 12 |

> **Trois choses de ce paquet répondent directement à des défauts que `docs/bilan-v3.md` a
> trouvés dans notre propre code :**
>
> - **l'union des boîtes** est exactement la « fenêtre commune » de la tranche `A2` ;
> - **l'ancrage bas-centre** est la réponse au défaut « le bas de l'image est posé sur le bas de
>   la case, poussière comprise » ;
> - **« retirer le fond AVANT de réduire »** — le paquet insiste : réduire en tenant compte de
>   la transparence empêche la couleur du fond de baver dans les pixels de bord. C'est le halo
>   du bilan, réglé par l'ordre des opérations plutôt que par un calcul.
>
> ⚠️ **Deux réserves.** Le paquet est jeune (huit étoiles) et **il est écrit autour d'un autre
> modèle** (MiniMax H3). Ses nœuds d'après-clip prennent une simple suite d'images et sont donc
> réutilisables tels quels, mais **ça n'a pas été vérifié en le faisant tourner**.

### Les autres briques, si on préfère écrire soi-même

| L'étape | Ce qui existe | Licence |
|---|---|---|
| Trouver la boucle | `LoopLab` — il regarde aussi **dans quel sens le mouvement va** au raccord, ce qui évite le pied qui repart à l'envers | MIT |
| Pixeliser | `PixelOE` (rien à télécharger, tourne sur processeur), `unfake` (trouve tout seul le pas de la grille) | Apache 2.0 / MIT |
| Interpoler | **déjà dans le cœur de ComfyUI** (`nodes_frame_interpolation.py`) — mais *l'interpolation floute le dessin animé dès que le mouvement est ample, et les aplats sans texture sont un obstacle reconnu* | — |

> ⚠️ **Un piège de licence.** Le projet universitaire de pixelisation qu'on cite partout
> (`WuZongWei6/Pixelization`) **interdit l'usage commercial, les jeux vidéo étant nommément
> cités**. Le greffon ComfyUI qui l'emballe utilise ses poids. **À écarter.**

> ⚠️ **Et un montage à ne pas reprendre tel quel.** Un « générateur de planche de sprites »
> circule, qui fait exactement notre chaîne (480 × 480, Wan bouclé, réduction au plus proche
> voisin vers 64, planche assemblée). Deux omissions décisives : **il tourne sur le 14
> milliards**, et **son étiquette de licence est déclarative, non vérifiée**.

---

## 6 · ⚠️ Un piège d'information à connaître avant de chercher soi-même

**Wan 2.5, 2.6, 2.7 et 3.0 n'existent pas en poids téléchargeables.** Le dépôt officiel s'arrête
à la 2.2. Une dizaine de sites bien référencés décrivent pourtant une *« sortie de Wan 2.7 sous
Apache 2.0 »* avec commandes de téléchargement : **l'adresse renvoie une erreur, ce sont des
pages fabriquées.**

Wan 2.5 a existé, mais uniquement comme service payant — c'est d'ailleurs par là que le dépôt y
accède (`alibaba/wan-3.0` chez OpenRouter est un service, pas un fichier).

> *La relecture adverse a nuancé jusqu'à cet avertissement : la source qui dénonce ces fausses
> pages est elle-même un blog de référencement. **Le fait tient** — le dépôt officiel s'arrête
> bien à la 2.2 — mais il se vérifie chez l'éditeur, pas chez celui qui le dit.*

---

## 7 · Les licences, en une ligne chacune

| Modèle ou outil | Licence | Pour un jeu vendu depuis la France |
|---|---|---|
| **Wan** (versions ouvertes) | Apache 2.0, **vérifié à la source** | **Libre, sans seuil** |
| Greffon pixel art `Wan2-2-pixel-animate` | Apache 2.0 | libre — mais il lui faut le 14 milliards |
| **LTX-Video / LTX-2.x** | licences maison, **conditionnelles** — gratuites seulement en dessous d'un seuil de chiffre d'affaires | à lire avant, pas un blanc-seing |
| **HunyuanVideo**, et `FramePack` qui en dérive | **exclut l'Union européenne** | **fermé** |
| `WuZongWei6/Pixelization` | non commercial, jeux cités | **fermé** |
| `blubs-pixel-nodepack`, `PixelOE`, `unfake`, `LoopLab` | MIT / Apache 2.0 | libres |

---

## 8 · Les deux voies qui ne passent pas par la vidéo

C'est la vraie trouvaille de la séance : **des outils animent déjà un sprite existant,
directement en images de sprite** — donc sans l'étape « extraire des images d'un clip », qui est
le gros du travail prévu.

### `PixelLab` — relevé directement dans son interface publique

J'ai lu sa description technique le 2 septembre 2026 plutôt que de la croire sur parole :

| Ce qu'elle offre | Ce que ça vaut ici |
|---|---|
| `animate-with-text` — animer par une action écrite | **La taille est exactement 64 × 64**, ni plus ni moins. C'est littéralement la cible du projet |
| `animate-with-skeleton` — animer par des articulations | 16 à 256 pixels. **C'est le pantin de la tranche `A8`, déjà fait et servi** |
| `estimate-skeleton` — deviner le squelette d'une image | Répond à l'objection la plus sérieuse contre la pose imposée : les détecteurs ordinaires ne savent pas lire un dessin. Celui-ci est fait pour ça |
| `color_image` — **imposer une palette** | Notre palette fermée de vingt-quatre couleurs y entre sans écrire une ligne |
| `image_guidance_scale` | Le réglage de fidélité à l'image de référence qui manque partout ailleurs |
| `view: side`, `direction: east` | Exactement la vue du nain |

**Ce qu'il faut savoir** : `animate-with-text` rend **quatre images à la fois** (une animation
plus longue se demande par tranches) ; `animate-with-skeleton` exige **exactement trois images**
par appel ; **et le prix n'a pas pu être relevé** — les pages de tarif ne se laissent pas lire
par un programme. Les chiffres qui circulent ne sont pas vérifiés et ne doivent pas entrer dans
une décision.

### `SpriteCook` — et il est **déjà branché sur cet atelier**

La relecture adverse a relevé ses tarifs et corrigé ceux qui circulaient :

- **40 crédits gratuits par mois** (pas « par tranche de 30 jours ») ;
- 8 $ pour 800 crédits, 30 $ pour 3 000, 70 $ pour 7 000 ;
- **environ 20 crédits par animation**, soit **~0,20 $ l'animation** au premier palier ;
- ⚠️ **l'usage commercial sur le palier gratuit demande vérification** — la relecture le signale
  comme le point qui ne se confirme pas.

**Et le solde du compte a été relevé le 3 septembre 2026 : 3 499 crédits, palier « adventurer ».**
À une vingtaine de crédits l'animation, **c'est de l'ordre de cent soixante-quinze animations
déjà payées**, dont rien n'est consommé.

Son outil d'animation prend par ailleurs **exactement nos réglages** — relevé dans sa
description : nombre d'images (2 à 16 en mode pixel), **taille de palette, dont la valeur par
défaut est 24** — le compte exact de la palette fermée du projet —, retrait du fond, marge de
cadrage, et **sortie directement en planche de sprites**.

> **C'est le geste le moins cher de tout ce rapport, et de loin** : zéro téléchargement, zéro
> installation, zéro attente, et c'est déjà payé. Il ne se lance pas sans ton accord — mais il
> devrait passer avant les neuf gigaoctets.

---

## 9 · Le montage retenu, et pourquoi celui-là

**C'est le chemin monté et essayé le 3 septembre 2026.** Il est le seul qui vise l'objectif :
faire tourner chez soi ce qu'on paie ailleurs.

| La pièce | Ce qu'elle apporte | Poids |
|---|---|---|
| `Wan2.2-I2V-A14B`, compressé en Q4, **deux moitiés** | le moteur. Les deux moitiés **ne cohabitent jamais en mémoire** : l'une fait les deux premières étapes, l'autre les deux dernières | 2 × 8,99 Go |
| `wan2.2_animate_adapter` | **le greffon pixel art** — 226 vidéos de sprites. C'est lui qui fait la différence entre un sprite et une bouillie lissée | 2,29 Go |
| `lightx2v` 4 étapes, haut et bas bruit | l'accélération : 20 étapes ramenées à 4 | 2 × 1,14 Go |
| `umt5` compressé + décodeur `wan_2.1_vae` | lire la phrase, rendre les images | 4,10 Go |

**26,7 Go, zéro euro, licences libres pour un jeu vendu.**

### Les réglages ne sont pas inventés

Ils sont repris du **montage officiel livré avec le greffon** (`wan2-2-video.json`, relevé chez
l'hébergeur) : quatre étapes en tout, fidélité à 1,0, méthode `ddim`, rythme `simple`, décalage
5,0, bascule d'une moitié à l'autre après deux étapes, 832 × 480.

> ⚠️ **Un seul écart, et il est forcé.** La recette d'origine emploie un nœud `PainterI2V` qui
> **n'est pas installé ici** — vérifié sur l'instance en cours. Il est remplacé par
> `WanImageToVideo`, livré avec ComfyUI, qui fait le même travail. **Si le résultat déçoit,
> c'est le premier endroit où regarder.**

> ⚠️ **Le greffon a été entraîné sur des vidéos de 600 × 370, par paquets de 8, 16, 24 ou 32
> images.** Sa propre recette lui en demande 45 en 832 × 480 — hors de son terrain. Le banc
> commence donc **plus petit**, au plus près de ce qu'il connaît, et en sort par paliers.

### Ce que le banc doit établir, et que personne n'a publié

- **combien de temps sur une carte portable bridée à 100 W** — ce chiffre n'existe nulle part,
  sur aucune carte portable ;
- **ce que le greffon pixel art donne sur 8 Go** — aucun témoignage ;
- **jusqu'où la mémoire tient** : le banc monte par paliers et **s'arrête au premier qui
  manque de mémoire**. C'est sa réponse.

### Et, quel que soit le résultat : `blubs-pixel-nodepack`

Il ne dépend d'aucun modèle et d'aucun choix de chemin. Il répare trois défauts que notre propre
bilan a trouvés dans notre code. **C'est le seul gain de cette recherche qui soit sûr.**

---

## 9 bis · ⚡ LE BANC A TOURNÉ — les premiers chiffres mesurés sur cette machine

*3 septembre 2026, sur la RTX 3080 Laptop bridée à 100 W. **Ce ne sont plus des estimations.***

### Ça tient, et ça marche

| Ce qui est mesuré | Le résultat | La barre — le clip payé qui a marché |
|---|---|---|
| **La mémoire** | **6,0 Go pris sur 6,92 disponibles** — sans débordement | — |
| **Le temps** | **130 s** pour 17 images en 832 × 480 (≈ 7,6 s l'image) | quelques dizaines de secondes |
| Le personnage garde sa taille | **5 % d'écart** | 3 % |
| Le fond reste uni (détourable) | **étalement 1 à 3 niveaux** | 0 à 9 |
| Le fond dérive en luminosité | **3 niveaux** | **20 niveaux** |
| Couleurs distinctes | 18 800 à 21 100 | 12 400 à 13 800 |

> **Deux chiffres où le local bat le payant, et ce n'est pas anecdotique.** Le fond local ne
> dérive que de **3 niveaux** contre 20, et il reste **trois fois plus uni**. Or c'est le fond
> qui décide si le détourage laisse des restes. Le défaut que l'auteur avait noté sur le clip
> payé — *« la première image est plus lumineuse »* — **n'existe pas ici**.

### La bande de sprites est utilisable

Ramené sur 64 pixels et 24 couleurs — la chaîne exacte du produit — le clip donne une bande où
**le personnage garde son design** : capuchon, sac, lanterne, ceinture, bottes. Les blocs sont
carrés, le contour noir tient, la marche est lisible.

**Deux défauts, et un seul est nouveau :**

- ⚠️ **la lanterne se dédouble** sur une image — c'est un artefact du modèle, à surveiller ;
- **la largeur du personnage varie** (37, 37, 34, 34, 40 px). Ce défaut-là **est déjà connu et
  déjà résolu sur le papier** : c'est exactement la « fenêtre commune » de la tranche `A2`.

### ⚠️ Le résultat le plus utile : **plus le clip est court, meilleur il est**

Trois longueurs tirées à demande identique, en 832 × 480 :

| Images | Temps | Mémoire | Ce que donne la bande ramenée sur 64 px |
|---|---|---|---|
| **17** *(≈ 1 s)* | **130 s** | 6,00 Go | **le plus propre** — un seul dédoublement de lanterne |
| 33 *(≈ 2 s)* | 151 s | 6,00 Go | la lanterne se dédouble, la cape fusionne avec le corps |
| 45 *(≈ 2,8 s)* | 210 s | 5,83 Go | **le pire** — lanterne triplée, main incohérente |

**Les mesures automatiques ne voient pas cette dégradation** : elles donnent 4 % d'écart de
taille et un fond à 3 niveaux de dérive sur les trois longueurs, indifféremment. **Seul l'œil
la voit** — nouvelle confirmation de ce que `docs/bilan-v3.md` § 6 avait déjà établi.

> **Ce que ça commande.** Ne pas demander un clip long en espérant y prélever plusieurs
> animations. **Demander des clips d'une seconde**, et en demander plusieurs. C'est exactement
> le geste que la V3 a déjà retenu — *commander plusieurs clips et garder le bon* — et le local
> le rend gratuit.
>
> Cela recoupe le fait technique : le greffon a été entraîné **par paquets de 8, 16, 24 et 32
> images**. Au-delà, il travaille hors de son terrain, et ça se voit.

> **Et la mémoire n'est jamais le mur.** 6,0 Go au pire sur 6,92 disponibles, y compris à
> 45 images. **La marge existe pour monter en résolution** — ce qui n'a pas été essayé et
> serait le prochain palier utile, la longueur étant, elle, à réduire et non à augmenter.

### Ce que ça change pour l'objectif

**Le pixel art ressort.** C'était le doute le plus sérieux du rapport — *« sur 8 Go on choisit
entre un modèle qui tient mais ne sait pas dessiner du pixel art, et un modèle qui sait mais ne
tient pas »*. **La réponse mesurée est : le modèle qui sait tient aussi**, en version
compressée, à 130 secondes pour une seconde de clip.

### Trois pannes traversées, et c'est un coût à porter au budget

Aucune n'était dans la documentation ; toutes trois ont demandé un diagnostic.

1. **Le nœud `PainterI2V` de la recette officielle n'existe pas** dans ce ComfyUI. Remplacé par
   `WanImageToVideo`. **Vérifié après coup : la substitution est bonne** — le sprite est ancré
   au pixel près sur la première image.
2. **Le chargeur d'encodeur quantifié refuse de démarrer** : il reconstruit son dictionnaire de
   mots et réclame `protobuf` ≥ 3.20 ; la machine porte la 3.19.6. **Cette version est celle
   qu'exigent les paquets du générateur de bruitages** — la mettre à jour aurait risqué de
   casser le son. Contourné en prenant l'encodeur non quantifié (6,3 Go au lieu de 3,9), qui
   embarque son propre dictionnaire.
3. **Deux téléchargements de 9 Go coupés en cours de route**, sans que le script le dise. Il
   fallait une boucle qui compare la taille obtenue à celle annoncée par le serveur.

> **C'est la réponse honnête à « le local est-il viable ».** La machine peut. La chaîne est
> fragile : chaque pièce vient d'un auteur différent, personne ne les a essayées ensemble, et
> il y a eu une panne par étape. **Ce coût-là est réel et se paie une fois** — les trois sont
> maintenant écrites dans le code avec leur raison à côté.

---

## 10 · Ce que je n'ai pas pu vérifier

- **Le banc n'a pas tourné.** ComfyUI a été lancé pendant la séance mais **son serveur n'a jamais
  démarré** — sa fenêtre attendait quelque chose. Aucune mesure de ce document ne vient de cette
  machine en fonctionnement.
- **Aucun temps de génération sur carte graphique portable n'a été trouvé**, sur aucune carte.
  Les 3 à 5 minutes sont une transposition, pas une mesure.
- **Aucun témoignage de greffon pixel art tournant sur 8 Go.**
- **Le prix de `PixelLab` n'a pas été relevé** ; l'usage commercial du palier gratuit de
  `SpriteCook` non plus.
- **`blubs-pixel-nodepack` n'a pas été essayé.** Il est écrit autour d'un autre modèle ; ses
  nœuds *devraient* être réutilisables, ce n'est pas vérifié.
- **La qualité du mouvement après accélération n'est pas mesurée sur du pixel art.**
- **Le budget de recherche web de la séance s'est épuisé** avant que la relecture adverse
  finisse. Les dernières vérifications se sont faites sans elle.

---

## Comment se servir du banc

```bash
python docs/recherche-video-locale/lancer_banc.py --a-sec
```

Il dit ce qui partirait, ce qu'il faut télécharger et combien ça pèse, **sans rien lancer**.
Puis `--relever` dit ce que ComfyUI voit vraiment, et `ltx` ou `wan` lance l'essai.

| Le fichier | Ce qu'il porte |
|---|---|
| `banc_comfy.py` | Le client ComfyUI — demander, attendre, récupérer, libérer la mémoire |
| `montages.py` | Les deux montages, écrits à la main, avec l'option de boucle fermée |
| `lancer_banc.py` | Le lanceur, ses paliers et son relevé de mémoire |
| `notes-templates-comfy.txt` | Les notes des montages livrés avec ComfyUI |
| `bancs/temoin-paye-brut.png` | Cinq images du clip payé qui a marché — **la barre à atteindre** |
