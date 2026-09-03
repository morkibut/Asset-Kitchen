# Audit du pipeline image — Asset Kitchen (snapshot du 2 septembre 2026)

> Périmètre : `atelier/image/*`, les services qui les appellent, `docs/bilan-v3.md` § 3–4, `docs/PLAN.md` (R6, D1–D4, A2, A5), `docs/releve-outillage.md`, fiches `research/01`, `02`, `05`.
> **[vérifié]** = lu dans le code ou mesuré ici (scripts jetables numpy/Pillow appelant les fonctions du dépôt, sur images synthétiques — ordre de grandeur, pas banc). **[supposé]** = déduit d'une source externe non rejouée ici (`rembg` n'est pas installé dans cet environnement).

---

## 1 · La carte du pipeline tel qu'il est

L'ordre vit dans `queue()` (`atelier/image/traitement.py:1215-1268`), précédé de `detourer()` (`:1151-1179`). Sept places, pas cinq : `AGENTS.md:390-392` annonce encore « détourage, recadrage, grille, quantification, bords » — *contours* et *main* (E5) n'y sont pas montés.

| # | Place | Algorithme exact | Où | Réglages | Limites vérifiées |
|---|---|---|---|---|---|
| 1 | Détourage `bord` | Médiane des 4 bordures → `max(|RGB−cible|) ≤ tol` (Chebyshev RGB) → remplissage par plages amorcé sur les bordures, 4-connexe → alpha 0/255 | `:344-429` | `tolerance=28`, `seuil_alpha=128`, `durcissement=0` (`domaine/recette.py:385-391`) | Espace RGB ; ±28 autour de (235,235,235) couvre tout le cube [207..255]³ : un sujet pâle relié à la silhouette est mangé (§ 4) |
| 1' | `couleur` (pipette) | Même remplissage, graine = le point ; `partout` = seuil global ; `reste` interdit de traverser l'alpha déjà fermé (U10) | `:432-486` | `point`, `portee` | Un point par passe pour 43 poches par image en médiane (`taches.py:173-176`) |
| 1'' | `trace` (sélection magique) | Polygone rasterisé sans lissage → liseré intérieur 1 px → médiane → remplissage borné au dedans | `:492-568` | `trace` | Même métrique RGB |
| 1''' | `modele` | `rembg.remove`, une session par modèle du catalogue (u2net / isnet-general-use / birefnet-general) → alpha → `min` avec l'alpha courant → `durcir` → `ronger` | `:148-206`, `:323-338`, `:1103-1148` | `modele` (vide = u2net) | Trois modèles « photo » ; pièges § 4 |
| — | Après chaque passe | `durcir` (seuil) puis `ronger` = érosion en croix N fois | `:574-596`, `:1143-1145` | 0–4 | Érosion aveugle à la couleur |
| 3 | Recadrage | `boite_opaque(alpha)` + marge, ou boîte explicite | `:941-955`, `:599-610` | `marge`, `boite` | Toute tache opaque compte (§ 2.2) |
| 4 | Grille | Si détouré : `boite_opaque` de l'image courante, `facteur = dedans / max(w,h)` **de cette boîte**, `resize NEAREST`, case `cible²`, centré en x + `decalage`, **bas de la boîte** sur le bas de la case ; sinon homothétie NEAREST | `:958-1017` | `cible`, `occupation`, `ancrage`, `decalage` | Aucune détection de pas : NEAREST à facteur non entier, phase inconnue (§ 3) |
| 5 | Quantification | Pillow `quantize(palette=…)` sur une table de 256 remplie en répétant la palette ; sans palette `MEDIANCUT` ; tramage `NONE`/`FLOYDSTEINBERG` ; alpha mis de côté et remis | `:1023-1086` | `couleurs`, `palette`, `tramage` | Distance RGB de Pillow (cache 6 bits/canal), pas OKLab ; pas de tramage ordonné ; **les pixels transparents participent à la coupe médiane** (`:1067-1068`) |
| 6 | Bords | `composantes(alpha>0)` → efface `< aire_min` | `:616-679` | `aire_min` en px rendus | `composantes` alloue un tableau plein cadre **par tache** (`:633`) : 16 000 zones sur 1024² = 4 s (`taches.py:169`) |
| 7 | Contours | `laisses` rebouche par remplissage depuis le bord ; anneau = dilatation carrée `dehors` & ~érosion carrée `dedans` (8-connexe) | `:768-853` | `epaisseur`, `position`, `trous` | 8-connexité imposée (`:757-760`) ; à 1 px la convention pixel art est la croix (fiche 01 § 2.6) |
| 8 | Main | `ImageDraw.line` + dilatation carrée, dernier passage gagne | `:692-923` | rayon, points | — |
| ø | `mesurer_grille` | Autocorrélation des profils `Σ|Δ|` colonnes/lignes, pas 2..64, plus petit pas ≥ 0,9 × crête et maximum local | `:1288-1350` | `maximum=64` | **Jamais appelée par `sur_grille`** ; répond (2, netteté 0,50) — au-dessus du seuil 0,35 — sur un bloc de 80 px, mesuré ici |

**Ce que la doc affirme et que le code ne fait pas.**

- `sur_grille:966-970` : *« c'est la case qui fait que deux frames d'un même personnage se superposent »* — faux (§ 2.1).
- `PIEGES.md:61-66` dit encore que *« la quantification force l'alpha à 255 »* ; `traitement.py:26-34` l'a corrigé le 31 août. Piège périmé.
- `bilan-v3.md:127-131` / `ARCHITECTURE.md:553` : *« la dérive d'échelle n'est nommée nulle part »* — inexact : `services/calibrage.py:4-13` la nomme mot pour mot et la compense par pose (`:281-285`). Le problème n'est pas l'ignorance du défaut, c'est que le remède (hauteur de boîte commune) est le mauvais invariant pour une bande (§ 2.1).
- Les tests qui « prouvent » l'absorption de la dérive de grille (`tests/test_t2.py:113-159`) tournent sur des images fabriquées par `resize(NEAREST)` d'une grille logique (`tests/conftest.py:115`), facteurs entiers exacts, phase nulle. **Aucun test n'exerce un pas non entier, une phase ou un anti-crénelage** — le cas réel.

---

## 2 · Les trois défauts du bilan § 3

### 2.1 L'échelle « pompe » — confirmé ; le remède dépasse cinq lignes

**[vérifié]** `traitement.py:990-1001` : la boîte opaque est recalculée sur l'image courante et le facteur en dépend. Le calibrage (E17) rattrape ensuite la **hauteur de boîte** par une occupation par pose (`calibrage.py:281-285`, `:310-340`) — sur une bande, une étape accroupie serait *agrandie* jusqu'à la hauteur commune : l'inverse du balancement voulu.

**« Cinq lignes »** : vrai du noyau de `sur_grille` — prendre l'échelle sur le cadre reçu et non sur la boîte (la branche `case=False`, `:985-988`, le fait déjà), poser le bas du cadre sur la case. Faux de la tranche : N étapes sont N bruts découpés chacun sur *sa* boîte avec 4 px de marge (`decoupe.py:88`, `services/pliage.py:245-246`) ; elles n'ont pas de repère commun. La fenêtre commune doit naître **au dépliage** (A1) : couper toutes les étapes à la même taille — union des boîtes dans le repère de la planche, position absolue dans la cellule conservée (fiche 05 § 2.8) — puis un champ de `Grille` disant « l'échelle vient du cadre ». Compter 1 à 2 jours (noyau, champ, sérialisation, `voyage()` `recette.py:1008-1098` où le cadre est une coordonnée qui ne voyage pas), hors écran.

**Deux choses à séparer en A2** : l'échelle (commune) et l'ancrage (par étape). Le bilan lit « ligne de sol au même pixel » comme un symptôme ; pour une marche, poser les pieds au même pixel est *le* comportement voulu — c'est la hauteur identique qui est fausse. Une fenêtre-union pure garde le balancement mais aussi le placement vertical aléatoire du modèle. Recommandation : échelle = fenêtre commune ; ancrage = pieds (bas de la boîte *nettoyée*, § 2.2) pour les mouvements au sol, fenêtre pour les sauts — un réglage de bande. Et dire lequel, du calibrage par pose ou de la fenêtre de bande, l'emporte : le plan ne le dit pas.

### 2.2 L'ancrage bas « poussière comprise » — confirmé

**[vérifié]** `boite_opaque` prend tout `alpha>0` ; `nettoyer` s'exécute **après** la grille (`:1257` contre `:1235`), en pixels rendus. Une poche non reliée au bord ou un point sombre sous les pieds décale le sujet. Remède : filtrer les composantes de l'alpha avant `boite_opaque`, seuil en pixels du brut. Le piège est `composantes` (`:616-659`) — inutilisable sur le brut à cause de l'allocation par tache. C'est la raison d'ajouter **scipy** (`ndimage.label`, ~10 ms sur 1024², BSD-3, déterministe) et de réécrire `composantes` par-dessus en gardant sa signature. Une demi-journée.

### 2.3 La recette par défaut — confirmé comme fait, discutable comme diagnostic

**[vérifié]** `Univers.recette_de` (`domaine/projet.py:664-687`) pose `Passe()` pour tout ce qui a une silhouette, sans distinction. Les 64/123 durcissements non nuls ne sont pas contestables. **Mais pourquoi l'auteur ronge-t-il ?** Mesuré ici sur un disque synthétique (contour 12 px, fond 235, flou gaussien 1 px pour l'anti-crénelage), avec `detourer_bord` du dépôt à tolérance 28 :

| | À 600 px | Après `sur_grille` NEAREST → 64 px |
|---|---|---|
| durcissement 0 | anneau complet d'1 px de pixels plus proches du fond que du contour | **26 % des pixels de contour** ont cette couleur mêlée |
| durcissement 1 | — | 0 % |

Le liseré est un millième du contour à 1024 (ce que mesure le relevé) et **un bloc sur quatre** à 64, parce que NEAREST tire un pixel par bloc et tombe une fois sur `facteur` dans l'anneau. Le relevé l'admet (`releve-outillage.md:189-193` : *« la mesure qui tranche… n'a pas été faite — la mienne non plus, qui mesurait à 1024 px »*). Le durcissement 1 est le pansement d'une réduction qui échantillonne l'anti-crénelage ; D2 et D3 suppriment la cause. Figer « durcissement 1 » en D1 avant eux, c'est mesurer le pansement.

Second fait, plus lourd : sur un rectangle pâle (215,215,215) sans contour noir avec un cœur sombre, `detourer_bord` garde **27 % du sujet** à tolérance 28 sur fond 235 (25 % à 100) ; le même sujet sur vert pur est gardé à 100 % jusqu'à tolérance 100. C'est probablement la moitié de « le détourage par défaut n'est pas efficace », et ce n'est ni le durcissement ni la tolérance qui le répare : c'est le fond.

---

## 3 · Grille pixel et quantification

**Le pas n'est pas retrouvé.** `sur_grille` ramène la boîte à `dedans` px par NEAREST (`:1002`), sans période ni phase. `mesurer_grille` est réservée au banc et à `MesuresLot` (`image/pliage.py:143`). La palette s'applique **après** la réduction (`:1235` puis `:1254`) — le quatrième point du bilan § 4 est déjà tenu.

**Ce que la réduction actuelle coûte, mesuré ici.** Grille logique 55×55 peinte à 9,4 puis 13,1 px (flou 1 px), boîte ~517 px ramenée à 64 comme le fait le produit ; « frame 2 » = même image décalée de 4 px (le modèle a posé sa grille ailleurs, comme entre deux cases d'une planche) :

| Réduction | 9,4 px : couleurs « entre deux » (> 25 de la palette) | cases qui changent entre les 2 frames | 13,1 px : entre deux | changent |
|---|---|---|---|---|
| NEAREST à la cible, pas inconnu (**produit**) | 29 % | 57 % | 24 % | 45 % |
| Vote en deux temps à la cible, pas inconnu (**D2 tel qu'écrit**) | 15 % | 52 % | 4 % | 41 % |
| NEAREST **au vrai pas** (55 px) | 0 % | 26 %* | 0 % | 0 % |
| Vote **au vrai pas** | 0 % | 33 %* | 0 % | 0 % |

\* 4 px = 0,43 bloc : les centres tombent près des frontières ; une détection de phase ramène ce chiffre à zéro.

Lecture : la réduction en deux temps réduit la bouillie mais **ne fait rien contre le bouillonnement** tant que la grille de sortie n'est pas celle du modèle. Le gain décisif vient de réduire *sur le pas détecté*. D2 (`PLAN.md:379-382`) met la réduction en deux temps en tête et « le pas réel » en critère ; l'ordre d'importance est l'inverse.

**Le conflit avec US-61.** Réduire au vrai pas donne N px, pas `cible`. Trois issues : (a) poser le sprite tel quel dans la case — l'occupation devient un résultat ; (b) rééchantillonner 55 → 64 — on refabrique des blocs inégaux ; (c) **valider** plutôt que détecter : la phrase `2D pixel art on a {cible}x{cible} grid` part déjà (`domaine/vue.py:437`), donc pas attendu = `côté de boîte / dedans`, chercher autour (×0,5 à ×3), et prendre (a) si le modèle a obéi (fiche 02, idée 8). C'est une décision de produit sur ce que « cible » veut dire, à prendre avant d'écrire D2.

**Le piège des blocs ~80 px** : réel dans son mécanisme, non mesuré dans son chiffre. Le seul relevé (`essais/mesures_grille.json`) donne des périodes de 2 à 13 px sur les crops des 24 planches ; la docstring de `mesurer_grille` cite 17 px mesurés contre 30–37 jugés à l'œil. « 80 » ressemble à 5 × 16, pas à une mesure. Il n'empêche : `mesurer_grille(maximum=64)` répond **(2, 0,50)** sur un bloc synthétique de 80 px — faux et confiant ; avec 128, (80, 0,98). Solution : des bornes **relatives au pas attendu**, jamais une borne fixe, et un arbitre d'octave par aller-retour — `_periode` (`:1346-1349`) applique déjà « le plus petit pas ≥ 0,9 × crête » sans vérification par reconstruction.

| Brique | Verdict |
|---|---|
| pixel-art-fixer (MIT) | Ne pas dépendre (CLI, opencv + Rust, 4 Mpx) ; **reprendre l'algorithme** en numpy : autocorrélation existante + histogramme de longueurs de plages + phase + aller-retour ; 3–5 j avec un banc sur les images du dépôt |
| spritefusion-pixel-snapper (MIT, WASM) | Aperçu navigateur, algorithme non documenté ; hors périmètre |
| PixelOE (Apache-2.0) | Pixelise une image HD *sans* grille latente — autre problème ; tire torch. Non |
| Quantifier à 16 couleurs avant de profiler (fiche 02, idée 5) | Oui, 2 h, coupe médiane, déterministe |
| OKLab numpy (15 lignes) | Oui, 0,5 j, dans `quantifier` et `palette.attirer` (`:357`, RGB aussi) |
| Tramage ordonné à palette | Oui si l'auteur trame ; 1 j ; seul tramage stable en animation |
| Nettoyage sur carte d'index (orphelins, jaggies) | Utile après D2 ; 2 j ; non prioritaire |

Défaut annexe **[vérifié]** : sans palette imposée, `quantifier` coupe sur tous les pixels, transparents compris (`:1067-1068`), dont le RGB est encore le gris du fond. L'écran refuse ce mode aujourd'hui (`recette.py:552-554`), mais A5 (« palette d'une bande calculée une fois ») repassera par là : masquer `alpha == 0`.

---

## 4 · Détourage

La mécanique est saine : `_remplir` (`:353-398`) est correct et 4-connexe (pas de fuite diagonale), la pipette avec `reste` et la sélection magique sont propres et déterministes. Les faiblesses sont la **métrique** et le **fond**.

| Question | Dans le code | Conséquence |
|---|---|---|
| Espace de tolérance | Chebyshev RGB (`:426`, `:482`, `:559`) | Sur gris 235, « fond » = tout ce qui est clair ; un Lab ne changerait rien *sur ce fond-là* |
| Connexité | 4 (remplissage, `composantes`, `ronger`) ; 8 (`etendre`, `restreindre`, `contourner`) | Cohérent ; offrir la croix pour le contour de 1 px |
| Trous intérieurs | Jamais percés par le bord (`PIEGES.md:67-72`) ; listés par `poches_de_fond` (`taches.py:135-197`) ; retirés un par un à la pipette | `enferme = proche & ~joignable & opaque` (`:189`) est déjà calculé : un plafond « poches ≤ N px² de la couleur du fond partent d'elles-mêmes » coûte cinq lignes et supprime la plupart des onze pipettes |
| Anti-crénelage | Le bord rend 0/255 ; `durcir` ne mord que sur le modèle ; pas d'hystérésis | Le liseré n'est pas un problème de transparence, c'est un problème d'échantillonnage (§ 2.3) |
| Durcissement | Érosion aveugle | Un **rongement conditionnel** — n'ôter que les pixels de bord plus proches du fond que de leur voisin intérieur (fiche 01, idée 9) — sans maigrir ; ~20 lignes |

**Fond chroma + despill (D3).** La tranche qui rapporte le plus pour le moins de code, pour une raison que le plan ne donne pas : la **sélectivité** (27 % → 100 % de sujet pâle gardé), pas seulement le liseré. Sur une clé, la tolérance monte à 100 sans manger le sujet, ce qui absorbe l'anneau anti-crénelé sans érosion ; le despill CbCr (40–55 lignes, `releve-outillage.md:340-352`) ne touche que 1–2 px de bord — exactement ce qu'il faut avant NEAREST. Trois manques dans D3 :

1. le gris est **codé** à trois endroits qui ne lisent pas le prompt : `image/pliage.py:42-43` (gabarit), `image/calque.py:38,189` (planche d'équipement), textes de `services/pliage.py:115-116,128,158`. Sans eux, D3 change le fond des images seules et laisse les planches en gris ; et la ruse « trait à peine plus foncé que le fond » (`image/pliage.py:36-41`) est à refaire pour une clé ;
2. l'interdiction « chroma-adjacent » n'a jamais été mesurée sur `gpt-image-2` ; le risque n'est pas le magenta franc, ce sont les potions violettes. Choisir la clé à distance de la palette du projet est juste, et vert ou magenta se décide par palette ;
3. si un fournisseur rend du JPEG (`mesures.py:7-9`), le sous-échantillonnage de chrominance étale la clé sur 2 px : le despill devient obligatoire.

**BiRefNet / isnet-anime en ONNX CPU (D4).** Sur des images générées ici sur fond franc, aucun modèle ne battra le remplissage : exact au pixel, sans rééchantillonnage, 130 ms. Le moteur modèle sert aux imports et aux pièces sans fond plat. Dans ce périmètre :

- `isnet-anime` (Apache-2.0, ~170 Mo, entrée 1024) et `birefnet-general-lite` (88,6 Mo, MIT) : oui, une entrée chacune dans `SILHOUETTES` (`:174-206`) et un banc sur dix images du dépôt.
- **Piège 1, normalisation** **[supposé — source rembg 2.0.x de mémoire]** : `BaseSession.normalize` divise par `np.max(im_ary)`, pas par 255. Nul dès qu'un pixel blanc existe ; **nul avec une clé pure** (un canal à 255 partout). Une ligne à vérifier au premier ajout.
- **Piège 2, masque réduit-réagrandi** **[supposé, même source]** : u2net infère à **320×320** puis `resize(img.size, LANCZOS)` ; isnet et birefnet à 1024. Sur 1024, le masque u2net est une carte de 320 agrandie ×3,2 : structures fines < 3 px perdues, coins arrondis, rebond de Lanczos. Les « 95 % de pixels semi-transparents » du relevé sont la trace de la normalisation min-max du logit + Lanczos (alpha 240–254 à l'intérieur), pas une matte utile. Pour du pixel art, **isnet-general-use** devrait être le défaut du moteur modèle : l'accord « 96–99 % » (`:189-192`) cache ses désaccords sur les lances et les franges.
- Déterminisme : onnxruntime CPU est reproductible à machine, version et nombre de fils fixés ; pas bit à bit entre machines. `durcir` à 128 rend la variation invisible sauf au seuil. À écrire dans `AGENTS.md`.

**pymatting** : non. Le moteur binaire n'a rien à décontaminer, et le halo mesuré au bon endroit (64 px) se règle par la réduction.

---

## 5 · Pliage / dépliage

**Gabarit** (`image/pliage.py:78-103`) : 1024², cases à traits de 3 px en (198) sur (235), marge 40, gouttière 24, exactement `forme.cases` cases (`domaine/pliage.py:52-68`). **Découpe au retour** (`services/pliage.py:232-246`, `:328-350`) : détourage bord → `zones_opaques` (composantes 4-connexes → fusion transitive à `ECART=2` → rejet sous `COTE_MIN²=256` et `EPAISSEUR_MIN=2`) → ordre de lecture par bandes (`decoupe.py:142-169`) → **compte ≠ demandé ⇒ `CompteFaux`**. Grille connue (C3) : `grille_fixe` sans marge.

**L'atelier sait où il a dessiné les cases et ne s'en sert jamais au retour.** `essais/essai_grille.py:302-313` calcule déjà « chaque sujet dans la case idéale où tombe son centre » — le mode robuste de la fiche 05 (§ 2.2, § 4.2) — et ce n'est pas dans le produit.

| Cas | Aujourd'hui | Avec la fiche 05 | Coût |
|---|---|---|---|
| Sujet en trop (9 pour 8, 4/13 au banc) | Refus, appel perdu | Attribution centre → case : la case qui en reçoit deux, ou le sujet hors case, est **désigné** ; R6 laisse écarter | 1 j avec l'écran |
| Sujet en morceaux (projectile, épée à > 2 px) | Compte trop haut → refus | **Fusion par graines** (sprite-gen) : les N plus grosses composantes sont les graines, le reste rejoint la plus proche — N est connu (`pliage.nombre`) | 20 lignes dans `_boites`, 0,5 j |
| Deux sujets qui se touchent | Compte trop bas → refus | Séparer sur la gouttière connue (profil de projection dans sa bande) ; watershed en repli ; SAM = sur-ingénierie pour huit cases sur un gabarit connu | 1 j |
| Quadrillage redessiné (8 carrés pleins, 64 % de remplissage) | Accepté en silence | Taux de remplissage de la boîte (> 0,9 = une case) **et** retrait des traits — plages fines à la couleur du trait (morphologie (w/30,1), (1,h/30)) ôtées de l'alpha avant l'étiquetage : on **récupère** la planche | 1 j |
| Alignement des vignettes | Boîte serrée + 4 px, chacune pour soi | Fenêtre commune = union des boîtes dans le repère de la planche (§ 2.1) | dans A2 |
| Nommage | Index de case et texte (`_label`, `:436-446`) | Le bon choix ; OWLv2 + hongrois ne sert qu'à qui a perdu la grille | rien |

`mesurer_lot` (`image/pliage.py:106-157`, IoU de silhouettes étirées en 64×64, pas par case) informe sans refuser ; correct, et `derive` hérite des faux positifs de `mesurer_grille`.

---

## 6 · Briques à prendre, briques à laisser

Contrainte lue dans `pyproject.toml` : dépendances dures = fastapi, uvicorn, httpx, pillow, numpy, mcp ; `rembg` + `onnxruntime` en extra. **scipy n'est pas déclaré** (`releve-outillage.md:69-76` a raison).

### À prendre (pip, CPU, licence permissive, Python 3.11, déterministe)

| Brique | Licence | Où | Gain | Effort |
|---|---|---|---|---|
| **scipy** (`ndimage.label`, `binary_fill_holes`, `distance_transform_edt`, morphologie) | BSD-3 | `composantes` réécrit par-dessus, `taches.py`, filtre de poussière | Composantes sur le brut : 4 s → 10 ms | 0,5 j |
| Filtre de poussière avant `boite_opaque` | maison | `_recadrer`, `sur_grille` | Ancrage juste | 0,5 j |
| Poches fermées ≤ N px² retirées d'office | maison, reprend `poches_de_fond` | `_detourer`, option de `Passe` | Moins de pipettes | 0,5 j |
| Rongement conditionnel | maison | variante de `ronger` | Remplace l'érosion aveugle | 1 j |
| Fond chroma + despill + tolérance par défaut liée au fond | maison, ~60 lignes | `detourer_bord`, `_detourer`, `image/pliage.py`, `calque.composer`, textes de `services/pliage.py` | Sélectivité, liseré | 2 j |
| Détecteur pas + phase avec hint, arbitre d'octave, quantification avant profilage | maison (idées MIT) | nouveau `image/grille.py` ; `sur_grille` réduit sur le pas | Bouillie 29 % → 0, bouillonnement 57 % → 0 sur synthèse | 3–5 j **+ banc de 40 vraies images jugées à l'œil** |
| Réduction en deux temps | maison, ~80 lignes | `sur_grille` | Second filet quand le pas est incertain | 1–2 j |
| OKLab numpy | maison | `quantifier`, `palette.py` | Mapping exact | 0,5 j |
| Tramage ordonné à palette | maison | `quantifier` | Stable en animation | 1 j |
| Fusion par graines + centre-en-case + retrait des traits | maison | `services/pliage._boites`, `decoupe.py` | −31 % de refus, planches quadrillées récupérées | 2 j |
| Mesure de stabilité inter-étapes | maison, 30 lignes | `image/` | L'étalon d'A5, **à écrire avant A2** | 0,5 j |
| `isnet-anime`, `birefnet-general-lite` | Apache-2.0 / MIT | `SILHOUETTES` | Imports | 0,5 j + 1 j de banc |
| JSON Aseprite à l'export | spec publique | `services/export.py` | A4 | 1 j |
| Alpha bleeding à l'export | idée MIT | `export.py` | Seulement pour un moteur en filtrage linéaire | 0,5 j, facultatif |

### À ne pas prendre

| Brique | Raison |
|---|---|
| libimagequant, xBRZ, potrace, FastSAM, YOLO-World, `@imgly/background-removal` | GPL / AGPL |
| RMBG-1.4/2.0, `bria-rmbg`, MatAnyone, EdgeSAM, MYOS, FLUX Kontext / ICEdit | Non commerciales ; `bria-rmbg` est le défaut de rembg déjà écarté (`:134-141`) |
| SAM 2, GroundingDINO, OWLv2, Florence-2, DINOv2 | torch, centaines de Mo, pensés GPU ; sur-ingénierie pour huit cases sur un gabarit dessiné par l'atelier |
| pymatting | Moteur par défaut binaire ; le halo se règle à la réduction |
| PixelOE | Autre problème (HD → pixel art) ; torch |
| unfake.js / unfake.py / pixel-art-fixer en dépendance | GPL via libimagequant pour le premier, chaîne Rust pour les autres ; reprendre l'algorithme, pas le paquet |
| opencv | Rien que scipy/numpy ne fassent ici |
| k-means (sklearn, cv2) | Non déterministe sans graine ; la coupe médiane suffit pour les étiquettes du vote |
| LayerDiffuse, ControlNet local | « Pas de ComfyUI » |

---

## 7 · Verdict par tranche

**R6** — bon problème, bon ordre. Mettre la fusion par graines, le centre-en-case et le retrait des traits *sous* l'écran : ils réduisent le nombre de planches qui arrivent devant l'auteur au lieu de seulement lui laisser corriger.

**D1** — mécanisme utile (défauts par nature, visibles avant de générer), mais le critère « le défaut livré tient compte des mesures » gravera un pansement : le durcissement non nul compense l'échantillonnage NEAREST d'un anneau anti-crénelé (§ 2.3), que D2 et D3 suppriment. Prendre D1 pour la plomberie, recompter les recettes *après* D2/D3, fixer les valeurs à ce moment-là. Ajouter une dimension « par fond » : la tolérance juste sur une clé n'est pas celle du gris.

**D2** — le bon problème, sous-spécifié sur ce qui compte : **réduire sur le pas détecté**, pas mieux estimer la couleur d'une case sur une grille fausse. Cela met en tension US-61 et demande une décision de produit (§ 3). Le piège des bornes est réel dans son mécanisme, douteux dans son chiffre, et se règle par un hint relatif. L'ambition est bonne ; l'effort est de deux semaines avec le banc, pas la demi-journée du relevé (`:228-229`) — et le banc est obligatoire, les tests ne voient que des blocs entiers alignés. Bloquer A5 sur D2 est juste.

**D3** — le meilleur rapport gain/coût du plan, pour une raison que le plan ne donne pas (la sélectivité). Manque le despill, la tolérance liée au fond, et surtout les trois endroits où le gris est codé — sans eux, les planches restent en gris. Renoncer au banc est acceptable pour un réglage, à condition de garder les deux mesures d'acceptation.

**D4** — moitié utile (deux modèles, deux pièges vérifiés en une ligne chacun), moitié mal rangée : « le contour se pose sur la frontière retrouvée par D2 » n'est pas un sujet de moteur — `contourner` trace déjà sur l'alpha réduit ; c'est la réduction de l'alpha qui décide de la frontière, donc D2. Et le défaut du moteur modèle devrait passer à isnet (1024) plutôt qu'u2net (320). N'en attendre presque rien sur les images générées ici une fois D3 en place.

**A2** — la tranche la plus rentable de la V3, diagnostic exact, deux corrections d'énoncé : le noyau tient en cinq lignes, la tranche non (la fenêtre commune naît au dépliage, dans le repère de la planche) ; et séparer échelle commune et ancrage par étape, sinon on remplace « tout à la même hauteur » par « le placement aléatoire du modèle ». Dire lequel, du calibrage par pose ou de la fenêtre de bande, l'emporte. Le filtre de poussière (scipy) est un prérequis, pas un corollaire.

**A5** — diagnostic juste, remède déjà à moitié dans A2 + D2 : fenêtre commune sur une planche = phase commune, et réduire au vrai pas supprime le bouillonnement de rééchantillonnage (57 % → 0 sur synthèse). Reste à A5 : la mesure de stabilité (à écrire en premier, elle discrimine fortement), le tramage ordonné si l'on trame, et le masquage des transparents dans toute palette de bande. La « palette recalculée par image » n'existe que sans palette de projet — vérifier que c'est le cas du banc avant de lui imputer le scintillement.

**Ce qui manque au plan** : un banc d'images réelles avec pas jugé à l'œil (le dépôt les a), scipy déclaré, le retrait automatique des poches, le rongement conditionnel, et deux corrections de doc (`PIEGES.md:61-66`, `AGENTS.md:390-392`). **Sur-ingénierie à écarter** : tout modèle de vision devant huit cases dessinées sur un gabarit connu, et toute matte pour un moteur qui rend 0 ou 255.
