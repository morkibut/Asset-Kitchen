# Audit C — L'interface React (snapshot du 2 septembre 2026)

> Périmètre : `interface/src/App.tsx`, `api.ts`, `aide.ts`, `main.tsx`, `index.css`, `montage-essais.ts`, les 31 composants de `composants/`, `App.test.tsx` (en diagonale), `index.html`, `package.json`, `vite.config.ts` ; `docs/{PLAN § V3, DESIGN, design-decisions, PIEGES, carte-du-depot, bilan-v3, v3-animation}.md` ; `essais/rapport_arbitrage.py` + `rapport_tout.py` ; fiches `research/02`, `06`, `11`, `12`. Le serveur n'est lu que pour les contrats (`atelier/api/routes.py`, `services/evenements.py`).
> **[vérifié]** = lu dans le code ou compté ici (grep/wc). **[supposé]** = déduit, non rejoué. **Ni `tsc` ni `vitest` n'ont tourné** : le registre npm répond 403 depuis cet environnement (`npm install` → `403 @tailwindcss/vite`). Tout ce qui suit est une lecture statique ; je le signale là où une exécution aurait tranché.

---

## 1 · Architecture réelle

### 1.1 L'arbre de composants [vérifié]

Un seul point d'entrée (`main.tsx:6-10`), un seul composant racine `App` qui rend tout. **Aucun routeur** — zéro `pushState`, `location.hash`, `localStorage` dans `src/` (grep). L'écran courant est une combinaison de booléens et d'identifiants tenus dans `App` (`onglet`, `depensesOuvertes`, `envoiOuvert`, `tablesOuvertes`, `decoupeOuverte`, `carteDecoupee`, `choseOuverteId`, `caseOuverte`, `reglagesOuverts`), et le JSX de `App.tsx:2093-2632` est une suite de gardes `{!depensesOuvertes && !envoiOuvert && onglet === "galerie" && … && <Ecran…/>}`. Un rechargement perd la position.

| Niveau | Composant (fichier) | Rendu par | Rôle |
|---|---|---|---|
| Châssis | `BarreChassis` (`BarreChassis.tsx:301`), `BarreEtat` (`App.tsx:2978`) | `App.tsx:2095, 2589` | 44 px onglets + fil d'Ariane + fente ; 26 px liaison/panne |
| Transverses | `EcranDepenses`, `EcranEnvoi`, `EcranGuide`, `EcranReglages`, `Apercu` | `App.tsx:2172, 2186, 2602, 2605, 2631` | posés sur n'importe quel onglet |
| Galerie | `Arbre` · `BarreOutils` · `CeQuiNEstPasEntre` · `Grille`→`Tuile` · `Fiche` | `App.tsx:2326-2402` | `240 · 1fr · 380` |
| Galerie › profondeur | `EcranTables` (→ `EcranDecoupe`, `EcranSuperposition`) | `App.tsx:2241-2270` ; `Tables.tsx:1455` | tables et fabriques |
| Univers | `EcranUnivers` → `Tableau` / `Toile` + `Reserve` / `Assistant` / `CoteAmbiancesEtCouleurs` | `App.tsx:2438` ; `Univers.tsx:283-348` | trois côtés |
| Codex | `EcranCodex` → `FicheDeLaChose`, `EcranVitrine` | `App.tsx:2492` ; `Codex.tsx:213, 289` | familles, manque |
| Codex › établi | `EcranEtabli` → `EcranPlanche`, `EcranCalibrage`, `EcranVitrine`, `FicheDeLaChose`, `PanneauCalque`, `EcranTables` | `App.tsx:2529-2561` ; `Personnages.tsx:312-387` | matrice pose × pièce |

**La toile** (`Toile.tsx`, 2 839 l.) n'est ni un canvas raster ni un éditeur : c'est la vue « plan » du tableau d'inspiration, un **graphe de cartes/îlots/liens sur `@xyflow/react`** (`Toile.tsx:43-61`, nœuds `ilot/carte/brouillon`, arête `lien`, `:800-801`). L'îlot est calculé (`:368`), la géométrie est en fonctions pures testées sans écran (`Toile.test.tsx`), la pile d'annulation vit dans l'écran Univers (`:817`). Hors sujet pour l'animation.

### 1.2 État : `useState` dans `App`, trois mini-magasins, pas de store [vérifié]

- `App()` (`App.tsx:154-2648`) tient **65 `useState`**, 9 `useEffect`, 7 `useCallback`, 1 `useMemo`, 7 `useRef`. Aucun `useReducer`, aucun store externe (grep).
- L'état partagé hors React est un motif maison à trois exemplaires en `useSyncExternalStore` : le repli des blocs (`chassis.tsx:284-350`, un `Set` de module), l'aperçu visé (`Apercu.tsx:142-290`), le guide (`Guide.tsx:36-63`). Trois `createContext`, tous locaux (`chassis.tsx:595`, `Tableau.tsx:66`, `Toile.tsx:789`).
- Ce qui bouge sans rebrancher le flux passe par un ref mutable `vivant` (`App.tsx:612-621`) : filtre, projet courant, sept fonctions de relecture réécrites à chaque rendu. L'abonnement SSE ne dépend donc de rien (`:869-1086`) — propre, mais c'est le symptôme d'un état trop haut.
- Dérivations à la main : `fiche` (`:633`), `cases`/`enPlanche` (`:400-406`), `entrees` (`:1073`, l'unique `useMemo` structurant).

### 1.3 Client API et flux [vérifié]

- **Client** : un objet littéral `api` de **132 méthodes** (`api.ts:2418-3718`) sur un wrapper `appeler<T>` (`:2396-2416`) : `fetch('/api'+chemin)`, erreur réseau → `Refus("l'atelier ne répond pas","atelier_arrete")`, HTTP ≠ 2xx → `Refus(raison, code, ou_aller)`. Un seul appel hors JSON, `exporter` (`:3693-3718`). Proxy Vite `/api` → `127.0.0.1:8420` (`vite.config.ts:10-13`).
- **Types** : ~150 `export type` écrits à la main (`api.ts:4-2384`), **aucune génération OpenAPI, aucun validateur** (grep `openapi|zod|valibot`). Le contrat est tenu par les doubles de `App.test.tsx` qui recopient les charges (`App.test.tsx:75`). Un champ renommé côté Pydantic ne casse rien à la compilation : c'est le vrai couplage.
- **SSE** : `ecouter()` (`api.ts:3829-3859`) ouvre un `EventSource('/api/events')` et abonne 14 genres + `liaison`. Le premier message `etat` porte bibliothèque, univers, générations **et grille entière** (`App.tsx:870-899`). File serveur par abonné : **64 messages**, le plus ancien jeté au débordement (`services/evenements.py:34, 62-67`).
- « Fondre par identifiant, jamais empiler » est réécrit quatre fois (`fondre` `:122`, `fondreAsset` `:2649`, `carte` `:924`, `lien` `:940`). L'interface ne redemande d'elle-même que catalogue, grille, production (`:666`, `:735`, `:804`).

### 1.4 Images : URL versionnée, cache immuable, vignette serveur [vérifié]

Aucun blob (le seul `createObjectURL` est l'archive d'export, révoqué au clic, `api.ts:3738-3749`). Toute image est un `<img src>` vers trois adresses (`api.ts:3644-3681`) : `image(generation, rang)`, `rendu(id, empreinte, brut)`, `vignette(id, empreinte, cote)` (crans 128/256/512, réduite serveur, `routes.py:1154-1168`). `v=<empreinte>` rend l'adresse immuable : `public, max-age=31536000, immutable` si `v`, `no-store` sinon (`routes.py:1147-1152`). La grille pose `loading="lazy" decoding="async"` (`Tuile.tsx:136-148`).

**Exception non corrigée** : les vignettes de 44 px de l'établi (`Personnages.tsx:2313`, `:2465-2472`), du codex (`Codex.tsx:696`) et des sœurs des tables (`Tables.tsx:1813`) chargent `sujetAsset(asset).src` — **le rendu entier** (`Apercu.tsx:67-93`), donc le fichier 1024 px pour un asset non traité. La leçon « 25,5 Mo pour 0,5 » (`api.ts:3656-3661`) n'a été appliquée qu'à la galerie.

### 1.5 Rendu des pixels : `<img>` + `pixelated`, trois régimes de zoom [vérifié]

Zéro `<canvas>`, `ImageData`, `getContext`, `OffscreenCanvas`, `Worker`, WebGL dans `src/` (grep). 34 `imageRendering: "pixelated"` inline. Le zoom a trois règles, documentées comme décisions (`docs/design-decisions.md:129, 132`) :

| Surface | Échelle | Où | Entier ? |
|---|---|---|---|
| Grille | colonne `minmax(128/256/512px, 1fr)` | `chassis.tsx:124-130`, `App.tsx:2928` | non |
| Vitrine, Calibrage | `[1,2,4,8]` ; `floor(384/cible)` | `Vitrine.tsx:30`, `Calibrage.tsx:452` | **oui** |
| Tables | libre **1–250 %**, `ajusté`, molette ×1,09 | `Tables.tsx:998-1025, 1324-1400` | non — « à 137 % un pixel sur trois est doublé, rien ne le signale » (refus de l'auteur) |
| Aperçu | `ajuste × zoom` continu 1–16 | `Apercu.tsx:297, 370-386` | non |
| Calque | `340 / largeur` | `Calque.tsx:44, 127` | non |
| Découpe | `min(place/l, place/h)` | `Decoupe.tsx:531-534` | non |

La conversion clic → pixel (`getBoundingClientRect` puis division) est écrite **quatre fois** : `Calque.tsx:142-149`, `Tables.tsx:1882-1891` (via `rectangleDeLImage`, `chassis.tsx:1086-1100`), `Decoupe.tsx:536-543`, `Superposition.tsx:756-762` — avec deux arrondis (`floor` / `round`).

### 1.6 La main : un capteur de gestes, pas un éditeur [vérifié]

C'est le point qui change le plus la lecture du plan V3. **La main ne peint rien dans le navigateur** :

- L'image est un `<img>` (`Calque.tsx:335-341`, `Tables.tsx:1932-1942`) ; le passage en cours est un `<svg><polyline>` (`Calque.tsx:347-372`, `Tables.tsx:1947-1967`) ; le curseur un `<span>` calé sur la grille (`Tables.tsx:1975-1990`).
- Au `pointerup`, la **liste de points** part au serveur (`api.affiner`, `Calque.tsx:166-172, 256` ; `onPassage` → `poser(recette)`, `Tables.tsx:1893-1900`). Le serveur peint, change l'empreinte, l'image revient par le flux. Un trait est une donnée de recette (`Trait`, `api.ts:249`), pas un pixel.
- **Annuler** = retirer le dernier passage et reposter la recette (`sansLeDernier`, `Places.tsx:1041` ; Ctrl+Z `Tables.tsx:1423-1435`) ou vider la couche (`Calque.tsx:484-507`). **Aucun « refaire »**, aucune pile locale, aucun diff.
- Conséquence : la latence d'un geste est un aller-retour HTTP + rendu serveur + SSE + `<img>` rechargé [non mesuré]. Acceptable pour un pinceau d'un pixel ; pas pour un déplacement continu au clavier (§ 3).

### 1.7 Tests [vérifié]

`App.test.tsx` : 17 185 lignes, **43 `describe`, 475 `test`**, zéro `skip`. Les 2 670 premières lignes sont le montage : `FluxDouble` (un `EventSource` factice qui émet quand le test décide, `:87-118`), un `fetchDouble` routeur par URL (`:2500`, JSON ou `Blob` pour `/api/exports`), des doubles de mesure (`:131-180`). `montage-essais.ts:20-38` bouche `ResizeObserver`, `DOMMatrixReadOnly`, `scrollIntoView` pour `@xyflow`. `Toile.test.tsx` et `Infobulle.test.tsx` testent des fonctions pures. Ce que jsdom ne voit pas est écrit (`montage-essais.ts:13-16`, `PIEGES.md:220, 356`) ; **aucun essai au navigateur automatisé** (pas de Playwright dans `package.json`). Durée d'exécution inconnue [supposé : lourde au démarrage, un seul fichier de 17 000 lignes].

### 1.8 Taille et couplage : problème réel ?

| Fichier | Lignes | Ce qui y vit | Verdict |
|---|---|---|---|
| `App.tsx` | 3 044 | 65 états, le flux, 3 relectures, `cases`, l'assemblage de tous les écrans, `Grille`/`BarreEtat` (`:2649-3044`) | **Réel, coût d'entrée** : chaque écran ajoute ses booléens et un `set…(null)` dans `onOnglet` (`:2097-2117`, neuf `set…(null)` avant `setOnglet`). Les états V3 suivront le même chemin. |
| `api.ts` | 3 916 | 2 380 l. de types commentés + 1 300 l. de méthodes | **Pas un problème** : fichier de contrat sans logique, ses commentaires documentent le serveur vu de l'écran. Il manque un test de conformité, pas un découpage. |
| `Toile.tsx` | 2 839 | `Plan()` seul fait 1 044 l. (`:845-1889`), 18 `useCallback` | lourd, contenu |
| `Tables.tsx` | 2 346 | l'écran, le zoom, 4 surfaces de geste (`:1844-2346`) | c'est le fichier qu'A7 étendra ; ses surfaces devraient déjà partager un hook |
| `Personnages.tsx` | 2 551 | l'établi, la matrice, 5 pleins cadres | idem pour A2/A3 |

Le vrai couplage n'est pas la taille : **rien n'est mémoïsé** (zéro `React.memo`, 8 `useMemo` dans tout `src/`, zéro `useTransition`) et l'état vit au sommet. Ça tient parce que les listes sont courtes (200 assets par grille par défaut, `routes.py:990`). Ça tiendra moins quand quatre bandes tourneront à 8 images/s sous ce même `App` (§ 5).

---

## 2 · Qualité

### 2.1 Performance sur 1024 px et sur 64 px zoomés

| Cas | Ce qui se passe | État |
|---|---|---|
| Grille de 200 tuiles | 200 `<img loading=lazy>` de vignettes serveur, pas de virtualisation (`App.tsx:2922-2952`) ; plafond serveur 200, max 1 000 (`routes.py:990`) | [vérifié] bon à 200 ; à 1 000, ~2 000 nœuds DOM [supposé] |
| Table sur un brut 1024 à 250 % | un `<img>` de 2 560 px dans un cadre qui défile ; molette native `passive:false` (`Tables.tsx:1382-1400`), ancre recalée en `useLayoutEffect` (`:1409-1418`) | [vérifié] DOM natif, pas de coût React |
| Sprite 64 px ×12 | `<img>` 768 px ; curseur et polyline en unités d'image via `viewBox` (`Tables.tsx:1950-1951`) | [vérifié] léger |
| Vignettes 44 px de l'établi | plein fichier (§ 1.4) : une matrice de 24 cases non traitées = 24 × ~1 Mo décodés [supposé] | défaut réel, correction triviale (`vignetteAsset(asset, 128)`) |

Aucune mesure de décodage ni de mémoire, aucun `createImageBitmap` (grep). Correct pour l'existant : **l'interface affiche des fichiers, elle ne manipule pas de pixels**.

### 2.2 Re-rendus inutiles [vérifié]

Chaque SSE `asset` appelle `setGrille` (`App.tsx:900`) → `App` entier se re-rend, donc tous les enfants montés, faute de `memo`. Une planche de 8 cases = 8 `asset` + N `generation` en quelques secondes. Aujourd'hui invisible (mêmes `src`, React ne fait que réconcilier ; [supposé] 5–20 ms par passe). Ce qui le rendra sensible : **un aperçu animé piloté par `setState` dans cet arbre déclencherait ces passes à chaque image**. Règle à poser avant A2 : l'horloge d'animation ne passe jamais par l'état d'un ancêtre commun.

### 2.3 Mémoire

Pas de fuite identifiée : aucun blob d'image, les 15 écouteurs `keydown` sur `window` sont tous retirés au nettoyage (grep). Le cache HTTP immuable est la seule rétention, voulue.

### 2.4 Accessibilité clavier — le point faible, et il compte pour A7 [vérifié]

- 148 `aria-label`, 38 `aria-pressed`, 18 `role=`, **0 `aria-live`** : la fente de refus (`BarreChassis.tsx:260-280`) et la barre d'état changent de texte sans être annoncées.
- **0 gestion des flèches** dans tout `src/` (grep `Arrow(Left|Right|Up|Down)`). Raccourcis existants : `?` (`App.tsx:597-611`), Espace (`Apercu.tsx:240-275`, en capture), Échap (14 écrans, chacun son écouteur `window`), Suppr/Retour sur un rectangle de découpe (`Decoupe.tsx:216-226`), Ctrl+Z (`Tables.tsx:1423`, `Toile.tsx:1247`).
- Le « déplacement au pixel » existe une fois, en Superposition : deux **boutons** `←`/`→` par axe, Maj ×10 (`Superposition.tsx:74-156`, `touches={["←","→"]}` `:457`). Les glyphes sont des libellés, **aucune touche n'est écoutée** (grep dans le fichier). Pour l'US-397 il faut un vrai gestionnaire de flèches, et une règle de priorité entre les 14 écouteurs `window` — rien ne les arbitre aujourd'hui.
- `tabIndex` : 2 occurrences (`Decoupe.tsx:637`). Les surfaces de geste (`role="application"` `Calque.tsx:321`, `data-toile-main`) ne sont **pas focalisables**.
- `prefers-reduced-motion` : 0 occurrence. Sans conséquence tant que Motion ≤ 240 ms ; à traiter dès qu'une bande boucle.

### 2.5 État d'erreur [vérifié]

Un modèle unique et bon : `Refus{code, ou_aller}` (`api.ts:2386-2394`) → `setPanne` ou `Fente` → un mot dans la barre, un geste (`App.tsx:98`). Le message `etat` efface la panne (`:896`). Manques : **aucun `ErrorBoundary`** (grep) — une exception de rendu blanchit l'application ; 2 `onError` pour 34 `<img>` (une image 404 reste un damier muet) ; reconnexion SSE déléguée à `EventSource` sans compteur.

### 2.6 i18n

Français partout, identifiants et ARIA compris. Virgule décimale forcée à la main (`toFixed().replace(".", ",")` en six endroits), `toLocaleString("fr-FR")` (`api.ts:3911`). Cohérent avec un produit personnel.

---

## 3 · Ce que la structure porte pour la V3

| Besoin | Existe ? | Réutilisable | Manque |
|---|---|---|---|
| **Timeline / pas à pas** | non — aucune notion de séquence, cadence, image courante | rien | un type `Bande{etapes[], cadence, fenetre}` dans `api.ts`, une rangée de vignettes avec l'active cerclée `--lumiere` |
| **Aperçu animé** (A2) | non — les seules boucles sont deux `setInterval` de 250 ms (`chassis.tsx:964`, `BarreOutils.tsx:336`) ; un seul `requestAnimationFrame`, pour un focus (`Codex.tsx:617`), et `design-decisions.md:74` note qu'il **ne bat pas en arrière-plan** | le damier, `pixelated`, la règle des multiples entiers (`Vitrine.tsx:23-30`) | une horloge de module + `useSyncExternalStore` (le motif du pli), un `<canvas>` 2D par bande. La maquette use de **GIF serveur** (`rapport_tout.py:326-347` : `duration=MS`, 256 couleurs, LANCZOS) — vitesse figée, aucune synchronisation entre cartes |
| **Rectangles de coupe** (A1, US-372) | à moitié : `Decoupe.tsx` propose, **ajoute** (tracer), **retire** (Suppr), choisit ; `Calque.tsx` **déplace** et **retaille** un rectangle par un coin (`:192-268, 397-417`) | `Planche()`+`Rectangle()` (`Decoupe.tsx:480-666`), `api.decoupeProposee`/`decouper` | fusionner les deux sur un `Boite[]` avec `choisie`, poignées, flèches ; serveur : brancher le pliage sur le chemin du découpage manuel (`PLAN.md:684-687`) |
| **N planches côte à côte** (A3) | non ; maquette HTML seule, avec sa note : « cent onze animations qui tournent en même temps saturent le navigateur » (`rapport_tout.py:403-407`) | le comparateur « à côté » (`Tables.tsx:680-704`), la matrice comme lieu | tout l'écran (§ 5) |
| **Pelure d'oignon** (A7, US-396) | oui : deux `<img>` à opacité réglable (`Superposition.tsx:796-817`, `Calque.tsx:326-341`), empilement ×entier (`Calibrage.tsx:438-549`) | directement | rien de structurel |
| **Déplacement au pixel** (A7, US-397) | souris/boutons : `translate(dx/l %, dy/h %)` CSS local puis `poser()` serveur au `onFini` (`Superposition.tsx:815`, `:74-156`) | `Cran` | le clavier (§ 2.4) |
| **Ancrage 9 points** (A7) | non | `Segments` à 9 valeurs | trivial écran, serveur pour le recalcul |
| **Remplacer une étape** (A7) | `api.relancer`, `onRelancer={relancer}` (`App.tsx:2383`) | oui | la filiation « étape ← planche/dépliage » dans `Asset` (n'a que `parent`) |
| **Pantin** (A8 : pièces, pivots, ordre, 16 points) | non | `Decoupe` (pièces), `Superposition` (calage), `ListeBoites` (ordre, `Decoupe.tsx:668`) — **pas `@xyflow`**, graphe de nœuds DOM et `ResizeObserver` piégé trois fois (`PIEGES.md:356-364`) | un éditeur de points sur image ; **la déformation est prévue côté serveur** (`bilan-v3.md:235-258`, `PLAN.md:940-946`) |

**Faut-il PixiJS/WebGL pour le pantin ?** Non, pas dans ce découpage. Le plan rend chaque étape en grand côté Python puis pixelise ; l'écran montre des images rendues, 16 épingles, un ordre. DOM ou Canvas 2D suffit. PixiJS ne se justifierait que pour **déformer en direct sous la souris**, ce qui exigerait de porter l'ARAP en TS (la fiche 06 chiffre l'éditeur PixiJS à 4–6 semaines, `06:220`) et de doubler le calcul serveur. Le compromis : traîner le pivot → au relâcher, le serveur rend et renvoie (le modèle exact de la main). Si la latence gêne, une rotation rigide locale de la pièce (`ctx.rotate`, vingt lignes) avant tout WebGL.

**Ce qui manque de transversal, et qu'aucune tranche ne nomme** : un composant « surface d'image » unique (mesure, conversion pointeur→pixel, échelle entière ou libre, couches DOM/SVG dessus). Écrit quatre fois (§ 1.5), A1/A3/A7/A8 en ajouteraient chacune une. C'est le premier chantier écran de la V3.

---

## 4 · Briques de la recherche : prendre, ne pas prendre

| Brique | Licence | Verdict | Effort |
|---|---|---|---|
| **Canvas 2D maison** (fiche 02 § 2.7 : « Canvas 2D + `ImageData` suffit ») | natif | **prendre** : un `<canvas>` par bande, `imageSmoothingEnabled=false`, `drawImage` d'`ImageBitmap` à ×entier, horloge unique | 2–3 j |
| `@xyflow/react` (déjà là) | MIT | **garder pour la toile, ne pas l'étendre** au pantin ni au tri de planches | — |
| **Phaser** en playground (fiche 12 § 2.9 : « le playground charge le ZIP exporté ») | MIT, ~1,2 Mo | **prendre en A4, en page isolée** (iframe/route à part, `pixelArt: true`) : la seule vérité extérieure sur « ce qui sort est ce que l'aperçu montrait » (`PLAN.md:817`) | 2–3 j |
| **JSON Canvas** (fiche 11 § 2.2) | spec MIT | plus tard, hors V3, sérialiseur serveur | 2 j |
| **dotting** (React, 57★) | MIT | non : un modèle de pixels client que le produit refuse (§ 1.6) ; l'éditeur est reporté (`PLAN.md:990-996`) | — |
| **Pixelorama iframe** (Godot WASM ~30 Mo, COOP/COEP) | MIT | non en V3 : casse le châssis et le non-destructif par recette | — |
| Piskel / LibreSprite / jspaint / Excalidraw | dormant / GPL / — / lourd | non | — |
| **react-timeline-editor** | MIT | non : une bande est **N images à cadence fixe**, pas des pistes ; une rangée de vignettes maison suffit et respecte les tokens de `index.css` | maison 1–2 j |
| **`@theatre/core`** | Apache (Studio AGPL) | non : aucune interpolation dans le plan (un mouvement = 48 angles rejoués, `PLAN.md:872`) | — |
| **PixiJS 8 `MeshSimple`** | MIT | **non en A8** tant que la déformation est serveur ; issue de secours si un aperçu temps réel devient nécessaire | 0 ; 3–4 sem. le jour où |
| DragonBonesJS / Konva / Fabric | MIT | non côté écran (le format DragonBones est une sortie serveur, fiche 06 `:143,159` ; poignées = `<div>` positionnés comme `Rectangle`) | — |

Règle qui ressort du code : l'interface **n'a gagné qu'une dépendance depuis l'origine** (`carte-du-depot.md:73`) et chaque surface est `<img>` + DOM/SVG. La V3 peut tenir cette ligne avec un seul ajout natif — le `<canvas>` 2D pour ce qui bouge — et zéro paquet npm.

---

## 5 · Verdict tranche par tranche, côté écran

### A1 · Planche gardée, dépliage refait — bon découpage, coût écran faible

- **Réutilise** `EcranDecoupe` presque tel quel. À ajouter : déplacer/retailler le rectangle choisi (code de `Calque.tsx:192-268` à généraliser à `Boite[]`), flèches 1 px / Maj ×10 dans le même gestionnaire que Suppr (`Decoupe.tsx:216-226`).
- **UX** : la découpe s'ouvre depuis la fiche ; la porte « Redéplier » doit être sur la fiche de la planche, pas dans la matrice, sinon deux entrées. Le fil d'Ariane sait déjà dire `… › planche › Découpage`.
- **Angle mort** : « les dépliages coexistent » (`PLAN.md:699`) suppose qu'une image remonte à *son* dépliage ; `Asset` n'a que `parent` — il faut un identifiant de dépliage dans le type et dans la fiche.
- **Coût** : 2–4 jours, moitié en essais (le double doit rendre une planche-asset et des dépliages).

### A2 · La bande et son aperçu — juste, mais sous-estimé côté écran

- Le plan compte « cinq lignes » serveur et un aperçu. **L'aperçu n'a aucune base** (§ 3) : horloge, canvas, vitesse, pas à pas, étape manquante « visible comme telle » (`PLAN.md:749`), et **une décision de design** — `DESIGN.md § Motion` tient une liste close, « rien au-dessus de 240 ms » ; une bande qui tourne est du contenu, pas du châssis, mais il faut l'écrire dans `design-decisions.md` avec `prefers-reduced-motion` (pause par défaut, lecture au survol ou au clic).
- **À trancher avant de coder** : l'aperçu « monté sur les pixels bruts » (`PLAN.md:737-740`) réduit des cases de 256–512 px ; en `pixelated` la réduction est au plus proche voisin et **fait disparaître les traits fins**. Le brut se rend en `image-rendering: auto` (ou réduit serveur en LANCZOS comme la maquette), le rendu final en `pixelated` ×entier. Deux régimes pour deux questions — « juger le mouvement et juger le découpage sont deux métiers », appliqué à l'échelle.
- **Coût** : 4–6 jours écran, plus `api.ts` (`Bande`, `Etape`, genre SSE `bande`).

### A3 · N planches côte à côte — le geste principal, et le seul écran vraiment neuf

Sur le cas nommé (4 planches × 8 étapes de 64 px, même échelle, même vitesse) :

| Contrainte | Ce que ça impose |
|---|---|
| Même échelle | `echelle = floor(largeurDispo / (N × largeurFenetre))` sur les crans entiers ; deux planches peuvent avoir deux fenêtres communes — il faut une échelle **du lot**, calculée sur la plus grande, sinon « côte à côte » ment |
| Même vitesse, même phase | une seule horloge `t0`/`cadence` de module, N canvases lisant `floor((now−t0)·fps/1000) mod n` dans **un seul** `requestAnimationFrame` ; des GIF (maquette) ou des `steps()` CSS ne se synchronisent pas et dérivent au changement de vitesse |
| Arrière-plan | `rAF` s'arrête (`design-decisions.md:74`) — acceptable ; recaler `t0` sur `visibilitychange` |
| Arrivée une par une (`PLAN.md:779`) | 4 planches = 4 `asset` + 32 `asset` de dépliage + N `generation` : **~40 messages** dans une file de 64 (`evenements.py:34`) — ça passe, mais une relecture de grille en parallèle ou un cinquième tirage approche du seuil où le plus ancien est jeté [supposé] |
| Mémoire | 32 cases brutes de 256–512 px ≈ 8–32 Mo décodés [supposé] ; `createImageBitmap` + `close()` en quittant ; à 64 px rendus, négligeable |
| Garder/jeter annulable (`:781`) | le motif existe (`Annulation`, `BarreOutils.tsx:336`) — réemployer |
| Composer deux planches (US-384) | un état `Record<rang, {planche, case}>` ; l'écran montre **la bande composée qui tourne** en plus des N sources — N+1 canvases sur la même horloge |
| Où il vit | un plein cadre de l'établi, comme la planche d'une pose (`Personnages.tsx:312`), **et il garde la barre qui paie** (« le prix du lot s'annonce avant », `:777`) — second plein cadre à la garder, la doc dit qu'il n'y en a qu'un (`carte-du-depot.md:80`) : à corriger |

**UX** : 4 bandes de 64 px ×3 tiennent dans un écran ; 4 planches **brutes** de 8 cases de 256 px ne tiennent plus, l'auteur jugera sur des réductions. La maquette a été notée sur des GIF de 132 px (`rapport_tout.py:349`) — c'est la taille qui a suffi ; partir de là, offrir ×2 sur la planche choisie. **Coût** : 6–10 jours écran (écran, horloge partagée avec A2, composition, essais avec un `FluxDouble` qui émet 40 messages dans l'ordre). La tranche la plus chère côté écran, et le plan ne le dit pas.

### A7 · Corriger une étape — bien découpé, si Superposition est généralisée

- Pelure + déplacement + ancrage = **une `Superposition` où « dessous » est l'étape précédente**, avec `opaciteDessous` (`Superposition.tsx:200`) et le décalage déjà en CSS local avant envoi (`:815`). Remplacer une étape = `relancer` ciblé. Rien de neuf structurellement.
- **Le clavier est le vrai travail** (§ 2.4) : surface focalisable, flèches écoutées **sur l'élément** et non sur `window`, priorité avec Échap/Espace/`?`, position dans un `aria-live`. Un jour, à faire une fois pour A1, A7, A8.
- **Angle mort** : « chaque correction est annulable » (`PLAN.md:907`) alors que le produit n'a qu'« annuler le dernier passage » et aucun « refaire ». Et « la fenêtre se recalcule à chaque changement, jamais à moitié » (`:905`) est serveur : l'annulation doit **reposter l'état d'avant** (le modèle de la toile, `Toile.tsx:1146-1147`), pas rejouer localement. **Coût** : 3–5 jours.

### A8 · Le pantin — sain côté écran parce que le calcul est ailleurs

- Écran : pièces (A1 + la zone de `Calque`), 16 épingles nommées déplaçables, liste ordonnée de pièces (comme `ListeBoites`), choix d'un mouvement (A6), l'aperçu d'A2 sur la bande rendue, et la `Raison` (`chassis.tsx:147`) qui dit ce que le pantin ne sait pas faire (`PLAN.md:975`).
- **DOM suffit** pour les épingles (16 `<button>` en % comme `Rectangle`, un `<svg>` pour les os) ; pas de WebGL (§ 3). Le coût est dans l'aller-retour pivot → rendu serveur → image ; au-delà de ~300 ms, prévoir la rotation rigide locale.
- **Découpage** : A8 dépend d'A0, A4, A6, A7 (`PLAN.md:978-981`) ; côté écran il ne dépend que de la surface commune et de l'aperçu d'A2. Si A0 conclut « constructible », l'écran peut commencer sur un mouvement codé en dur. **Coût écran** : 5–8 jours.

### Ce qui manque au plan, vu de l'écran

1. **Une tranche « surface d'image commune » avant A1** — sinon cinq copies de la conversion pointeur→pixel.
2. **L'horloge et le canvas d'aperçu** comptés dans A2, pas « l'aperçu montre » en une ligne.
3. **Le clavier** comme critère transversal, pas une case d'A7.
4. **`ErrorBoundary` et `aria-live`** — dix lignes, avant que des écrans à 40 messages SSE n'arrivent.
5. **Un essai au navigateur** pour ce que jsdom ne voit pas (échelle entière, synchronisation, clavier sur surface focalisée). Le dépôt le sait (`montage-essais.ts:13-16`) ; A3 est la première tranche où « ça se vérifie au navigateur à la main » cesse d'être tenable.
6. **`memo` sur `Tuile` et les écrans de profondeur, ou descendre l'état** : un aperçu qui bat sous `App` sans mémoïsation est le premier endroit où l'architecture actuelle se verra.
