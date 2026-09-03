# Audit B — Génération, fournisseurs, consistance, architecture serveur (snapshot du 2 septembre 2026)

> Périmètre : `atelier/fournisseur/*`, `atelier/services/{generation,production,envoi,prix,catalogue,fournisseurs,reserves,agent,evenements,pliage,export}.py`, `atelier/domaine/*`, `atelier/mcp/serveur.py`, `atelier/depot/*`, `atelier/api/{app,routes,production}.py`, `docs/{PLAN,ARCHITECTURE,archi-fournisseur,bilan-v3,v3-animation,PIEGES}.md`, `docs/archive/essais-v3/etude-prompts.md`, fiches `research/03`, `04`, `05`, `13`.
> **[vérifié]** = lu dans le code, ou compté ici (scripts jetables sur les fichiers du dépôt). **[supposé]** = déduit d'une source externe non rejouée. **La suite d'essais n'a pas été exécutée** : PyPI répond 403 depuis cet environnement, aucune dépendance ne s'installe. Tout ce qui suit est une lecture statique, et je le signale là où un essai aurait tranché.

---

## 1 · Le contrat de génération réel

### 1.1 Port et adaptateurs

| Pièce | Où | Ce qu'elle fait réellement [vérifié] |
|---|---|---|
| `PortFournisseur` | `fournisseur/port.py:40-107` | Cinq gestes : `nom`, `catalogue()`, `generer(modele, demande) → ImageProduite`, `indisponible()`, `compte()`, `secrets()`. Un appel = une image ; `consomme` + `unite` viennent de la réponse, jamais d'un tarif. |
| `OpenRouter` | `fournisseur/openrouter.py:72-246` | `GET /api/v1/images/models` (public) → `Modele` par fiche ; `POST /api/v1/images` avec clé Bearer. Seul fournisseur qui accepte des images. |
| `Pollinations` | `fournisseur/pollinations.py:103-247` | `GET /prompt/<texte>?model=&width=&height=&nologo=true`. `references_max=0`, `variations_max=1`, un jeton par image lu dans `x-usage-total-tokens`, modèle servi vérifié via `x-model-used`. |
| `toile.py` | `fournisseur/toile.py:75-106` | **N'est pas un fournisseur de génération** : le récupérateur d'une image à une adresse collée sur le tableau (http/https seuls, 20 s, 32 Mo), rangé là parce qu'il traduit les pannes `httpx` en français comme les deux autres. |
| `Fournisseurs` | `services/fournisseurs.py:33-121` | Liste de **fabriques** (adaptateur neuf à chaque `de(nom)`, clé relue à chaque appel). Aucun repli automatique d'un fournisseur sur l'autre. |
| Composition | `services/__init__.py:121-145` | `FOURNISSEURS = [_openrouter, _pollinations]`, le payant d'abord. |

Le port est **réellement étanche** : `aspect_ratio`, `input_references`, `n`, `b64_json`, `usage.cost` n'apparaissent que dans `openrouter.py` (grep sur `atelier/`). Le catalogue est relu au démarrage et photographié sur disque (`donnees/catalogue.json`, 48 + 1 modèles, `services/catalogue.py:299-311`).

### 1.2 Ce que `gpt-image-2` reçoit, champ par champ

Corps construit par `OpenRouter.corps_appel` (`openrouter.py:214-246`) :

| Champ | Valeur | Source | Note |
|---|---|---|---|
| `model` | `openai/gpt-image-2` (`Modele.chez_lui`) | `catalogue.py:93-96` | jamais l'identifiant `OpenRouter:…` |
| `prompt` | texte composé + `"\n\nDo not include: <négatif>"` si le champ négatif est rempli | `openrouter.py:267-271` | **le négatif ferme le prompt** — voir § 2.3 |
| `aspect_ratio` | `demande.proportions` si le modèle la déclare | `:227-228` | gpt-image-2 déclare 9 ratios dont `21:9` et `auto` (`catalogue.json`) |
| `resolution` | **jamais envoyé** : gpt-image-2 ne déclare aucune résolution (`resolutions: []`) | `:229-230` | la taille rendue est le défaut du fournisseur, **mesurée** sur les octets reçus (`generation.py:828`) [vérifié] ; 1024² en 1:1 [supposé, non relu ici] |
| `quality` | `"low"` par défaut (`OPTIONS_DEFAUT`, `services/catalogue.py:53`) ; `auto/low/medium/high` déclarés | `Modele.retenir` `:231-232` | un réglage non déclaré est **écarté et enregistré** (`Generation.ecartees`) |
| `background` | jamais posé par le produit. Le catalogue déclare `["auto","opaque"]` pour gpt-image-2 : **`transparent` n'existe pas chez lui via OpenRouter** [vérifié dans `donnees/catalogue.json`] ; il existe pour `gpt-image-1`, `gpt-image-1-mini`, `gpt-5-image(-mini)`, `riverflow-v2.5-pro/-fast`. Le relevé d'outillage l'avait déjà noté (`docs/releve-outillage.md:355-362`). | — | l'alpha natif reste donc un chemin fermé sur le modèle principal |
| `n` | jamais : une variation = un appel `POST` séparé | `:18-20` | c'est ce qui rend la relance unitaire possible |
| `input_references` | liste ordonnée de `data:<type>;base64,…`, type lu sur les octets | `:233-245`, `:274-287` | ordre : source d'édition, réinjections manuelles, concept arts (style), images promues (référence), images d'ambiance (style), artworks de la famille (style) — dédoublonné — puis **gabarit**, puis **bande de palette** (`generation.py:1753-1758`, `:609-623`, `:2205-2235`) |
| en-têtes | `Authorization`, `X-Title: Asset Kitchen` | `:184-190` | |

**Ce que les images d'entrée sont vraiment** [vérifié] : un asset (image promue, réinjection) part en **rendu PNG**, donc à la taille cible du projet si la recette a une grille — un personnage promu en 64 px part en **64×64** (`services/assets.py:721-732`) ; une carte du tableau part **telle quelle**, octets d'origine, jusqu'à 32 Mo (`services/univers.py:1278-1286`) ; le gabarit est un PNG 1024² à traits gris 198 sur fond 235 (`image/pliage.py:29-42`, `:78-103`) ; la bande de palette est un PNG d'aplats redessiné à chaque appel (`image/palette.py:268-`). Le modèle reçoit donc, sans qu'aucune phrase ne dise lequel est lequel, un sprite de 64 px, un artwork en pleine résolution et une grille vide de 1024 px — l'angle mort que R7 nomme.

### 1.3 Erreurs, délais, relances

| Cas | Comportement [vérifié] | Où |
|---|---|---|
| Réseau, timeout | `FournisseurIndisponible` (503), phrase française ; **délai unique de 300 s** par appel, sans distinction connexion/lecture | `openrouter.py:49`, `:181-195`, `:290-302` |
| 4xx/5xx | `AppelRefuse` (502) ; 401/402/429 ont leur phrase ; le reste cite 200 caractères du message | `:197-198`, `:305-323` |
| Réponse sans image | `usage.cost` lu **avant** de lever : le montant reste au journal | `:200-208` |
| Retry / backoff | **Aucun**, ni sur 429 ni sur 5xx. « Rien n'est jamais relancé automatiquement » (US-18) est une règle assumée (`generation.py:16-17`). | `generation.py:731-771` (relance manuelle par emplacement) |
| Annulation | **Inexistante** : aucun `cancel` sur une tâche en vol (grep `cancel` sur `services/`, `api/`, `mcp/` : rien) | — |
| Cadence Pollinations | déclarée (`cadence_s=15`, `pollinations.py:74`) et **affichée**, jamais **appliquée** par le service : deux soumissions à 5 s d'écart partent toutes les deux et la seconde reçoit le 429 traduit | `reserves.py:112`, `pollinations.py:340-341` |

L'absence de retry est un choix défendable (une relance repaie). L'absence d'annulation gênera A3 : arrêter trois planches quand la première est bonne n'est pas possible aujourd'hui.

### 1.4 Le coût

- **Enregistré** : `usage.cost` de la réponse, par emplacement, avec unité (`generation.py:861-862`, `domaine/generation.py:171-172`). `cout_usd` est déduit (`consommation.py:76-84`) — un jeton vaut zéro dollar par construction.
- **Estimé avant clic** : médiane des 12 derniers appels réussis du modèle + décomposition base/pas-par-image sur 60 appels (`services/prix.py:58-138`, `depot/base.py:347-417`). Aucun tarif de catalogue n'entre jamais, y compris pour un modèle jamais appelé (l'écran dit « ne sait pas »). C'est cohérent avec la règle du dépôt et avec le piège `riverflow` (annoncé $0,019, facturé $0,042).
- **Mesuré sur gpt-image-2 low** : $0,0064 sans référence, $0,0124 avec une, $0,0245 avec deux ; 48 % de la facture part dans les images jointes (`prix.py:18-25`). Une planche coûte le prix d'un appel, quel que soit le nombre de cases (`services/planche.py:22-43`, `essais/mesures_prix_planche.json`).

C'est la partie la plus solide du périmètre. Une limite : `couts_par_references` compte le **nombre** d'images, pas leur **taille**, alors que gpt-image-2 facture l'entrée au token donc à la surface [supposé, fiche 03 § 2.7] — mesuré indirectement : un référent 1024² coûte 58 % de plus qu'une carte de 100 px (`etude-prompts.md:276-278`). Le pas « par image » moyenne des tailles disparates.

### 1.5 Exécution : tâches, concurrence, reprise, événements

| Sujet | État [vérifié] | Où |
|---|---|---|
| File de jobs | **Aucune** : `asyncio.create_task` par soumission, gardée dans `self._en_vol` ; les N emplacements d'une génération partent en `gather` | `generation.py:724-729`, `:796-810` |
| Concurrence | **Non bornée** — ni sémaphore, ni priorité. Le seul plafond est celui de la séance de l'agent (`services/agent.py:216-238`, 20 par défaut, réservé/libéré autour de l'appel) | — |
| Persistance | `_sauver` à chaque changement d'état : fichier `generation.json` (écriture atomique par renommage, `depot/fichiers.py:86-98`) **puis** index SQLite **puis** diffusion | `generation.py:2168-2184` |
| Reprise | au démarrage, les emplacements non terminés passent `interrompue`, coût gardé, aucune relance ; les planches reçues mais non dépliées se déplient gratuitement | `generation.py:182-199`, `pliage.py:295-324`, `services/__init__.py:355-368` |
| Événements | **SSE**, pas WebSocket : `GET /api/events` ; premier message = état complet ; battement en commentaire ; file bornée à 64 par abonné, le plus vieux tombe | `api/routes.py:85-149`, `services/evenements.py:43-99` |
| Idempotence | même identifiant soumis deux fois → la première génération est rendue, rien n'est facturé | `generation.py:513-516` |
| Attente MCP | sondage de l'index toutes les 250 ms, borné à 300 s | `generation.py:773-786`, `mcp/serveur.py:55-56` |

**Les écritures sont synchrones dans la boucle d'événements** (SQLite, `os.replace`) — quelques millisecondes par état, invisible à quatre variations, à surveiller si A3 lance dix planches. Un abonné SSE lent perd des événements mais pas d'état, chaque message portant l'objet entier.

Ce que la fiche 13 § 3.3 recommande — table `jobs`, annulation coopérative, reprise `running → interrupted` — est **déjà là aux deux tiers**. Ce qui manque et vaut d'être pris : un `asyncio.Semaphore` par fournisseur (trois lignes) et l'annulation (une route, `Task.cancel()`, un statut `annulee` qui garde le coût si l'appel était parti). À ne pas prendre : Huey, une table `jobs` séparée, WebSocket — aucun avancement intermédiaire n'existe à transporter (`archi-fournisseur.md:174-179`).

---

## 2 · Comment le prompt est composé

### 2.1 La chaîne, dans l'ordre où le texte s'assemble

Un seul endroit compose (`ServiceGenerations.lignes`, `generation.py:1232-1471`), un seul joint (`domaine/envoi.joindre`, `envoi.py:325-369`), et l'aperçu (`/api/prompt/preview`, `/api/outgoing`) passe par le même chemin que la soumission. C'est vérifiable dans le code et c'est tenu.

| # | Groupe | Ce qui part | Origine | Où |
|---|---|---|---|---|
| 1 | `jeu` / `ambiance` | 7 lignes `Intitulé: texte`, dans l'ordre `monde, epoque, rendu, trait, eclairage, vue, technique`. Chaque texte = phrase de l'atelier (grille `2D pixel art on a NxN grid`, calage `single isolated sprite…, strict NxN px tile snap`, phrase de vue) **puis** texte de l'auteur, sauf si l'auteur redit déjà le sujet (`_redit`). Par champ, la fiche de la chose gagne sur l'ambiance qui gagne sur le jeu ; les perdantes restent visibles, éteintes. | `projet.py:100-157`, `:429-479` ; `envoi.py:214-311` (`resoudre`) ; `production.py:711-768` (`couches`) | |
| 2 | `sujet` | signalement de la chose (ou texte tapé) `, ` consigne de pose + direction (`Pose.dit()` + `Direction.consigne`, `plan.py:143-153`, `production.py:1926-1970`). Virgule si une ligne, saut de ligne si le signalement est une liste. | `generation.py:1322-1373`, `envoi.py:372-395` | |
| 3 | `planche` | consigne de grille de C2 (`_creer`) ou d'habillage de C3 (`_habiller`) | `services/pliage.py:67-163` | |
| 4 | `jointes` | une phrase par **rôle** présent (`style` → « the look to follow » ; `reference` → « this same subject already drawn »), puis « Do NOT copy the camera angle or the pose… », puis la phrase de la bande de palette. Muet pour une édition. | `generation.py:1473-1526` | |
| 5 | `cadrage` | `FRAMING — one single sprite…` (sauf planche, sauf univers vide) puis `CAMERA — this overrides everything above…` + faces visibles + exemple du corps (famille personnages seulement) | `vue.py:243-368`, `:470-475` ; `production.py:1974-2031` | |
| 6 | négatif | `Do not include: …` ajouté **par l'adaptateur**, après tout le reste | `openrouter.py:267-271` | |

Le `Tri` de l'écran de confirmation (lignes éteintes/rallumées, textes corrigés) ne vaut que pour l'appel et n'est jamais enregistré (`envoi.py:90-157`) ; `generation.json` porte le texte parti, et `pris` dit ce que l'appel a pris à l'ambiance (`domaine/generation.py:312-335`). Une génération se relit donc des mois après sans reconstituer l'univers du jour. Bien.

### 2.2 Forces

1. **Tout ce qui décide est mesuré** : caméra en queue (1,55 → 1,13), cadre (+37 % de pixels de sujet), phrase des images jointes (1,15), retrait de `all standing on the same baseline`, silence de l'atelier quand l'auteur redit — chaque bloc cite son banc (`etude-prompts.md:66-116`, `vue.py:450-475`).
2. **Une seule composition, trois lecteurs** (écran, MCP, relance) ; le MCP hérite du signalement et de la consigne sans les recomposer (`mcp/serveur.py:755-765`).
3. **Le pliage est une ruse d'appel documentée** : gabarit mesuré (11/12 contre 9/12), un prix par appel, seul refus arithmétique (`pliage.py:56-64`, `:205-246`).
4. **L'ordre des images est déterministe** (tri par identifiant, dédoublonnage sur `(origine, asset)`) : R7 n'a rien à réordonner.

### 2.3 Faiblesses concrètes

1. **Le prompt négatif, s'il est rempli, prend la dernière place** — celle que le banc a identifiée comme décisive (« un modèle d'image pondère la fin », `etude-prompts.md:102-104`). Le champ est vide et mesuré sans effet (A4 : 1,69), mais la mécanique est fausse : `_prompt_complet` colle le négatif **après** `CAMERA — this overrides everything above` (`openrouter.py:267-271`). Le replier avant `cadrage`, ou retirer le champ. [vérifié]
2. **Les images ne sont pas nommées.** `_dire_les_images` dit « One or more reference images are attached » ; rien ne dit *laquelle* est l'artwork, le sprite, la grille ou la palette (`generation.py:1500-1526`) — et le modèle « recopie la structure de son entrée » (leçon du gabarit, `image/pliage.py:33-38`). [vérifié]
3. **`View and framing:` en tête et `CAMERA` en queue disent deux fois la caméra.** Redondance mesurée utile ; à garder tant que ce n'est pas remesuré.
4. **La géométrie de la planche fabrique le défaut que R6 veut réparer.** `geometrie(8)` rend 3×3 pour 8 cases (`domaine/pliage.py:52-68`) : dernière rangée incomplète, le modèle complète la neuvième — « quatre planches sur treize refusées pour un sujet de trop » (`PLAN.md:211-217`). Une grille **complète** (8 → 4×2, 6 → 3×2, 12 → 4×3, ratio d'image choisi parmi ceux du modèle) supprime la cause. C'est une géométrie, pas une reformulation : elle n'est pas dans les 31 réglages mesurés morts. [cause vérifiée ; effet à mesurer, règle des huit]
5. **Le texte repris est tout ou rien** (`demande.py:49`) : corriger un mot perd la composition entière. R7 règle ça si chaque partie se corrige séparément.
6. **La consigne de pose reste `idle stance, full body` pour les huit vues** (`plan.py:56-63`) — mesuré sans effet une fois la caméra en queue ; A6 est l'endroit pour la remplacer par un mouvement à étapes.

### 2.4 Ce que R7 devrait faire exactement

Le PLAN dit « on range, on ne réécrit pas » (`PLAN.md:301`). Voici le rangement concret, à mots constants :

| Partie | Contenu | Source déjà existante |
|---|---|---|
| **CONTEXT** | les 7 lignes de bible résolues, telles quelles | groupe `jeu`/`ambiance` |
| **REFERENCES** | une ligne **par image, dans l'ordre d'envoi** : `Image 1 — style reference (an official artwork of this game): follow its colours, outfit, drawing style; do not copy its pose or layout.` / `Image 2 — the same character, already drawn: keep it recognisably the same.` / `Image 3 — empty layout grid: 8 cells, draw one sprite per cell, do not draw the outlines.` / `Image 4 — palette strip: not a subject.` | `Reinjection.role` + `origine` (`domaine/generation.py:61-73`), plus deux rôles à nommer pour le gabarit et la bande, qui n'ont pas de `Reinjection` aujourd'hui (`generation.py:609-623`) |
| **REQUEST** | sujet, pose + direction, consignes de planche, `FRAMING`, `CAMERA` — la caméra **reste en dernier** | groupes `sujet`, `planche`, `cadrage` |

Et cinq règles d'exécution : **le négatif ne ferme plus le texte** (replié dans REQUEST avant `FRAMING`, ou supprimé) ; **l'ordre des images est gelé et affiché avec son numéro** sur l'écran de confirmation (les lignes de `compter_references` portent déjà tout, `generation.py:1863-1887` ; gabarit et bande y entrent comme lignes non décochables) ; **`Demande.resume()` enregistre les trois parties** (`demande.py:87-108`), une génération d'avant R7 se relisant avec une seule ; **la référence ordinale (« Image 2 ») est une hypothèse** — largement rapportée pour GPT-Image [supposé, non mesuré ici] — donc huit tirages avec et sans numéros sur la même planche du banc avant de la garder ; **le texte d'avant et d'après, côte à côte, une fois**, seul moyen de vérifier « aucun mot ajouté ». Coût : deux jours, dans `generation.py:1232-1526` et `envoi.py:325-369`, plus l'écran.

### 2.5 Ce que les fiches 04/05 suggèrent de plus, et ce qu'il faut écarter

| Suggestion | Verdict | Pourquoi |
|---|---|---|
| Nommer chaque image, garder les mêmes tokens d'une requête à l'autre (05 § 2.1) | **prendre** — c'est R7 | non mesuré, mais c'est le seul levier que les bancs n'ont pas essayé |
| Décrire chaque case explicitement, en ordre de lecture (05 § 2.1) | **déjà fait** | `_creer` énumère `1. … ; 2. …` (`pliage.py:97-100`) ; « énumérer chaque instant marche » (`v3-animation.md:187-188`) |
| ≤ 6 par rangée, ≤ 3 rangées (05 § 2.1) | **déjà tenu** | 3×3 max pour 8 ; mais préférer une grille complète (§ 2.3.4) |
| Clause de constance renforcée / « preserve list » répétée (05 § 2.1, 04 § 2.6) | **ne pas prendre** | mesuré : clause remplacée = 20 % de bonnes contre 62 % (`bilan-v3.md:75-79`) |
| `CRITICAL:` en majuscules, hex exacts | **ne pas prendre** | le produit a déjà `CAMERA —`, `FRAMING —`, `Do NOT` ; c'est une formulation, et les formulations sont mesurées mortes |
| Fond chroma `#00FF00` + contour clair (04/05) | **pas avant D3** | le détourage par inondation sur gris rend 80 pixels sales sur 138 465 (`bilan-v3.md:96-105`) ; D3 est prévu pour tester le fond « et coûte un banc » |
| Retry partiel par masque alpha (05 § 3.9) | **pas disponible** | OpenRouter n'expose ni `edits` ni masque — « pas d'édition/inpaint dédiée, mais `input_references` » (fiche 13 § 3.6) [supposé] ; demanderait un adaptateur OpenAI direct |
| `background=transparent` pour les planches (05 § 2.1) | **fermé sur gpt-image-2** | § 1.2 ; ouvert sur `gpt-image-1`, qui « rend une bouillie illisible » au banc (`archi-fournisseur.md:100`) |
| Seed fixe (04 § 2.6) | **impossible** | gpt-image-2 ne déclare pas `seed` (`catalogue.json`) ; Seedream/Qwen/FLUX le déclarent |

---

## 3 · Consistance du personnage entre générations

### 3.1 Ce que le produit fait [vérifié]

| Levier | Mécanisme | Où |
|---|---|---|
| Signalement | la description du personnage part avec chaque appel, jamais retapée ; un appel sans signalement est refusé | `production.py:1875-1924`, `generation.py:563-567` |
| Concept arts | cartes du tableau désignées par la chose, rôle `style`, origine `carte` | `generation.py:2091-2112` |
| **Images promues** | assets fabriqués, promus « référence permanente » par la chose, rôle `reference` — c'est **l'ancre par personnage**, en identifiants | `production.py:1145-1164`, `personnage.references` |
| Ambiance | trois textes de bible + cartes + palette, par lot de style ; ce que l'appel prend est enregistré | `production.py:711-835`, `domaine/ambiance.py` |
| Artworks de la famille | l'échelle du barème porte sa famille, qui décide des artworks joints | `generation.py:1775-1786`, `projet.py:206-256` |
| Palette | bande d'aplats en image, jamais en texte (option cochable) | `generation.py:1974-2000` |
| Plan de poses | la **matrice** pose × direction, déduite des assets, jamais enregistrée ; `viser` refuse une case qui n'existe plus avant qu'un centime parte | `production.py:1700-1873` |
| « Prep » | **n'existe pas** au sens SpriteCook (génération intermédiaire qui retourne un sprite avant de l'animer). Le plus proche : C3, où la planche pleine des corps part en édition (`pliage.py:132-163`) |
| Mesure de lot | ressemblance de silhouette entre cases et dérive de grille, **affichées, jamais refusantes** | `image/pliage.py:106-`, `pliage.py:222-226` |

### 3.2 Ce qui manque, et ce que le dépôt a déjà mesuré à ce sujet

**Le référent dans la caméra du jeu.** Mesuré dans l'étude des prompts (tour 3, `etude-prompts.md:124-140`, `:244-288`) : avec la carte de face en référence, trois poses reviennent à trois tailles et l'une invente une dague ; avec « la chose refaite une fois dans la caméra du jeu », même taille, même silhouette, rien d'inventé. Le mécanisme existe à moitié (`promouvoir_reference`) ; ce qui manque est **l'étape guidée** — un appel sans pose, dans la caméra/grille/palette du jeu, jugé par l'auteur, qui remplace la carte de face comme référence de toutes les poses. C'est l'« ancre par personnage » de la fiche 04 (§ 3.10), mesurée ici sur ce modèle. Effort : deux à trois jours, un champ `referent` sur la chose (`production.py`) et `_concepts` qui le fait partir en `reference` en taisant la carte de face (`generation.py:2091-2112`).

**La taille de la référence.** Le rendu part à la taille cible (§ 1.2) : 64 px pour demander un sprite de 1024 px. La fiche 04 recommande un agrandissement `nearest ×8` avant envoi (§ 4.1). Le coût croît avec la surface (+58 % à 1024²), et personne n'a mesuré ce que perd un sprite envoyé en 64 px. Huit tirages — 64 px contre 256 px `nearest` — coûtent moins d'un dollar et tranchent.

**Le scoring automatique d'identité.** Ce qui « ne prédisait rien » (`v3-animation.md:40-83`) est **une mesure de forme maison** — la variation du rapport hauteur/largeur entre cases — confrontée à des notes de **qualité de mouvement** ; elle confondait marche et incohérence de taille. Ce n'est ni une mesure d'identité, ni DINOv2. « Est-ce le même personnage ? » est ce que DINOv2/DreamSim mesurent (fiche 04 § 2.7), et le dépôt a **135 planches notées** pour le vérifier gratuitement : similarité de chaque case au sprite promu, et voir si les planches notées mauvaises pour dérive se séparent des bonnes. Si oui, une aide au tri — jamais un refus ; si non, une seconde mesure morte écrite en une ligne. `onnxruntime` est déjà une dépendance optionnelle (`rembg`), c'est la bonne porte. Un jour d'essai avant tout code produit.

### 3.3 Le quatrième chemin : une pose imposée par image, via édition

**Quels modèles acceptent une image d'entrée.** Sur les 48 modèles OpenRouter de la photo du 2 septembre, 47 déclarent `references_max ≥ 1` — seul `meta/muse-image` n'en prend aucune ; gpt-image-2 en prend 16, les Gemini 14, Seedream 14, FLUX.2 8, Qwen-image-3 4 (`donnees/catalogue.json`) [vérifié]. **Il n'existe pas de point d'entrée « édition » distinct chez OpenRouter** : l'édition, c'est `input_references` plus une instruction, et le produit le fait déjà — le rôle `edition` ouvre la liste et donne sa filiation (`domaine/generation.py:54-56`, `generation.py:2218-2221`), et C3 envoie une planche pleine avec « Return the SAME sheet with the item added » (`pliage.py:151-163`).

**Ce que le dépôt a déjà mesuré de proche.** Le « guide de marche » joint comme troisième image : 2 bonnes sur 2 à quatre cases mais non découpables (`D-4-guide`), 2 sur 8 avec le bloc du produit, contre 5 sur 8 sans guide (`v3-animation.md:198-213`, `:447-456`) — « le modèle ne suit pas une pose qu'on lui montre, du moins pas comme ça, et pas quand le personnage ne fait que trois cents pixels ». En sens inverse, deux faits positifs : le gabarit de silhouette vue de dessus (bras B1) donne le meilleur rapport du banc de vue, 0,99 (`etude-prompts.md:81`, `:283-287`) ; et le modèle « recopie la structure de son entrée » au point de redessiner les traits d'un gabarit — défaut pour une grille, exactement ce qu'on veut d'une pose.

**Ce qui distingue le quatrième chemin du guide mesuré mort** : une seule pose par appel, en pleine image, l'image de pose en **rôle `edition`** (elle *est* la demande) et le sprite promu en `reference` (l'identité), avec le prompt du produit. Le test coûte **zéro ligne de code** : importer le bonhomme-bâton comme asset (`importer`, `generation.py:330-434`), le réinjecter en `edition`, promouvoir le sprite, lancer une case ; $0,0245 par appel à deux images (`prix.py:21-22`). C'est la boucle que A0 prescrit (`PLAN.md:614`). **Ce qui peut rater, à écrire d'avance** : le modèle habille le bâton en bâton (mitigation : une silhouette pleine déformée, ce que B1 suggère) ; il perd l'identité au profit de la pose (référent à taille utile, § 3.2) ; il rend la pose dans une autre caméra (`CAMERA` reste en queue). Si trois tours n'apprennent rien, `google/gemini-3-pro-image` est le second candidat — « presque jamais mauvais », 23 fois plus cher (`bilan-v3.md:58-62`). Le modèle conçu pour ça — Qwen-Image-Edit à keypoint natif (fiche 04 § 2.3) — n'est pas au catalogue image d'OpenRouter sous ce nom [supposé : `qwen/qwen-image-3` y est, sans qu'on sache s'il porte le contrôle de pose], et l'auteur a jugé le local hors jeu. Donc gpt-image-2 d'abord.

---

## 4 · Architecture serveur

### 4.1 Couches et couplage [vérifié]

| Couche | Ce qu'elle importe | Ce qu'elle ne doit pas importer, et tient |
|---|---|---|
| `domaine/` | rien d'`atelier` sauf lui-même | pas de `httpx`, pas de `sqlite3` — tenu |
| `fournisseur/` | `domaine`, `httpx` | pas de `services` — tenu |
| `depot/` | `domaine` | — |
| `services/` | tout ce qui précède ; `production`, `pliage`, `export`, `decoupe` n'importent **pas** `fournisseur` (vérifié par leurs imports) | `generation.py` est le seul service qui parle au port |
| `api/`, `mcp/` | `services` seulement ; `mcp/serveur.py` n'importe ni `fournisseur`, ni `depot`, ni `sqlite3` | tenu — et un essai le vérifie (`carte-du-depot.md:69`) |

Le point de composition (`services/__init__.py:148-336`) construit dix-sept services dans un ordre commenté, sans cycle. `ServiceGenerations` reçoit onze collaborateurs (`generation.py:124-178`) : c'est le nœud du graphe, et c'est normal — il est le seul endroit d'où l'argent part. `ServiceEnvoi` lit un attribut privé d'un autre service (`self._generations._catalogue`, `envoi.py:629`) : petite entorse, sans conséquence.

### 4.2 Les fichiers de 2 000 lignes

Compté ici : `generation.py` fait 2 235 lignes dont **1 115 de code** (49 %), 592 de docstrings, 326 de commentaires ; `production.py` 2 355 dont 1 192 de code (50 %). La moitié est de la documentation en place, et c'est une richesse. Le problème n'est pas la taille, c'est que `generation.py` porte **six responsabilités** que ses bandeaux `── … ──` séparent déjà : import (`:328-460`), exécution (`:462-967`), jeux de réglages (`:969-1022`), pliage des cases (`:1024-1228`), composition du texte (`:1230-1671`), choix des références (`:1673-2164`). R7 va grossir les deux dernières. Le découpage qui ne casse rien : `services/composition.py` et `services/references.py`, appelés par `ServiceGenerations` qui garde sa façade — les 833 essais ne bougent pas. Un jour, sans risque, **avant** R7.

### 4.3 Les essais

833 fonctions `test_` comptées dans `tests/` (55 fichiers) contre 822 annoncés (`AGENTS.md:33-34`) — cohérent. Le double `FournisseurDouble` (`tests/conftest.py:206-`) joue le catalogue, l'échec, l'attente, le coût par demande, les jetons et les secrets, et vérifie ce qui arrive **au bout du port** (`references_recues`). C'est le bon niveau. Deux trous relevés en lisant, non exécutés :

- **Une planche d'équipement partant chez un modèle sans place de référence part sans sa planche.** `_jointes` rend `()` dès que `references_max <= 0` (`generation.py:1216-1218`), et `Modele.refus` ne compte que `demande.references` (`catalogue.py:108-116`) ; la docstring de `_jointes` affirme que le catalogue grise avant (`:1223-1226`), rien ne le fait. « The attached image is a sprite sheet… » part donc seul. Le cas est réel depuis F6 : le garde-fou de l'agent impose `Pollinations:sana`, sans place, et `equip_character` passe par `modele_impose` (`mcp/serveur.py:823`). Les essais de C5 le manquent parce que le double paie en dollars, donc `gratuits()` est vide et le repli tombe sur `essai:rend-du-png` à deux places. [vérifié par lecture, à confirmer par un essai de dix lignes]

### 4.4 Dépôt : SQLite jetable et fichiers

`VERSION = 5`, aucune migration, index jeté et reconstruit depuis `donnees/` quand le schéma change (`depot/base.py:37-39`, `:126-144`). Une connexion par opération, WAL, fermée à coup sûr (`:146-165`, piège Windows payé). Le fichier s'écrit avant l'index (`generation.py:2176-2183`). Les colonnes qui doublent `contenu` sont réécrites depuis l'objet. C'est exactement la fiche 13 § 3.5 (« sidecar JSON par asset + SQLite index ») — déjà en place, sans FTS5 ni sqlite-vec, dont un atelier personnel n'a pas besoin. Une seule dette : `durees_mesurees`/`couts_mesures`/`couts_par_references` désérialisent le JSON complet des 12 à 60 dernières générations à chaque affichage de prix (`base.py:324-417`) — des millisecondes, acceptable.

### 4.5 MCP

- **Seize outils** (`mcp/serveur.py:111-926`), grain « verbe » : `generate_asset`, `generate_pose`, `equip_character`, `edit_asset`, `slice_asset`, `import_asset`, `export_assets`, `export_character`, plus lecture et budget. La fiche 13 recommande « ~15 outils-verbes depuis la même couche de service » — **c'est déjà l'état**, et fait à la main : `FastMCP.from_fastapi(app)` produirait un outil par route (une centaine), à élaguer, en perdant les descriptions écrites (`:114-121`) et la traduction des refus (`_refus_lisible`, `:61-89`). **Ne pas prendre.**
- **Même processus** que l'API, monté sur `/mcp`, chemin exact corrigé, `Host`/`Origin` limités à la boucle locale (`api/app.py:132-143`, `:195-215`). SDK `mcp>=2.1` (`MCPServer`), pas `fastmcp`.
- **Ce qui manque (fiche 13 § 3.7)** : des ressources `asset://id` — utile, non nécessaire ; `report_progress` — inutile, aucun avancement n'existe ; un lanceur `stdio` — une trentaine de lignes, utile aux clients sans HTTP.
- **Sécurité.** Le transport MCP vérifie `Host` ; **l'API FastAPI ne le vérifie pas** (ni `TrustedHostMiddleware` ni `CORSMiddleware`, grep sur `atelier/`). Écoute sur `127.0.0.1:8420` (`__main__.py:43-44`). Une page web ne peut pas poster du JSON cross-origin sans pré-vol, et FastAPI refuse un corps `text/plain` en 422 [supposé, comportement standard] ; reste le réattachement DNS, qui permettrait à un site de lancer des générations payantes. Probabilité faible, parade : trois lignes de `TrustedHostMiddleware`. À prendre. L'agent écrit dans n'importe quel dossier via `folder` (`agent.py:376-`), sans jamais écraser : acceptable pour un outil personnel.

### 4.6 Secrets

Une place par fournisseur, déclarée par l'adaptateur (`domaine/secret.py`), valeur lue à chaque appel dans l'environnement puis `.env` (`reglages.py:73-91`), jamais affichée entière (6 caractères), écriture qui ne touche pas aux autres lignes, encodages multiples (piège PowerShell). La route `PUT /api/settings/keys/{nom}` refuse un nom qu'aucun fournisseur ne déclare (`fournisseurs.py:104-121`). Rien à redire.

### 4.7 Dette réelle contre dette acceptable

| Dette | Verdict | Coût de réparation |
|---|---|---|
| Planche d'équipement sans image chez un modèle à 0 place (§ 4.3) | **réelle** — paie un appel pour rien | 3 lignes : `Modele.refus` doit compter le gabarit/planche, ou `_plier` refuser avec `references_max` |
| Négatif en queue de prompt (§ 2.3.1) | **réelle** mais dormante | 5 lignes |
| Pas de `TrustedHost` sur l'API (§ 4.5) | **réelle**, faible probabilité | 3 lignes |
| Concurrence non bornée, pas d'annulation (§ 1.5) | acceptable aujourd'hui, **réelle dès A3** | 30 lignes |
| Fichiers de 2 000 lignes (§ 4.2) | acceptable ; à découper avant R7 | 1 jour |
| I/O synchrones dans la boucle (§ 1.5) | acceptable | — |
| Cadence Pollinations affichée, non appliquée | acceptable (le 429 est traduit) | 10 lignes |
| Pas de retry | **choix** documenté, pas une dette | — |

---

## 5 · Ce que la recherche apporterait ici, brique par brique

| Brique | Fiche | Apport ici | Effort | Où l'insérer | Prendre ? |
|---|---|---|---|---|---|
| Nommer chaque image jointe, ordre gelé, numéros | 05 § 2.1 | le seul levier de prompt non mesuré | 2 j | `generation.py:1473-1526`, `envoi.py:325-369`, écran | **oui — R7** |
| Grille complète pour N cases | (05 § 2.1, dérivé) | supprime « 9 pour 8 » à la source | 0,5 j + 8 tirages | `domaine/pliage.py:52-68` | **oui, avant la tolérance de R6** |
| Référent par personnage dans la caméra du jeu (« ancre ») | 04 § 3.10, § 4.3 | mesuré bon ici (tour 3) | 2–3 j | `production.py` (champ), `generation.py:2091-2112` | **oui** |
| Référence envoyée à taille utile (`nearest ×4`) | 04 § 4.1 | inconnu, coût mesuré +58 % à 1024 | 0,5 j + 8 tirages | `assets.py:721-732` | **à mesurer d'abord** |
| Pose imposée par édition (quatrième chemin) | 04 § 2.3, § 4.2 | conditionnement au lieu d'espoir | 0 j pour l'essai ; 2–4 j si adopté (rôle `pose` + phrase) | rôles `Reinjection`, `_dire_les_images` | **oui, c'est A0** |
| DINOv2/DreamSim comme aide au tri d'identité | 04 § 2.7 | validable gratuitement sur 135 planches notées | 1 j d'essai ; 2 j si retenu, `onnxruntime` déjà optionnel | `image/`, affichage à côté des mesures de lot | **essayer, ne pas croire** |
| Aseprite JSON pour la bande | 05 § 2.7, releve-outillage:538-542 | format le plus lu ; clés relevées | 1 j | `services/export.py` (nouveau descriptif, à côté de `descriptif.json`) | **oui — A4** |
| Sémaphore par fournisseur + annulation | 13 § 3.3 | nécessaire à A3 | 0,5 j | `generation.py:724-810`, une route | **oui** |
| `TrustedHostMiddleware` | 13 § 3.7 (implicite) | ferme le réattachement DNS | 3 lignes | `api/app.py:155-161` | **oui** |
| Chunk PNG `tEXt` de provenance à l'export | 13 § 3.5 | un PNG qui sait d'où il vient | 0,5 j | `export.py:426-` | oui, tard |
| Fond chroma + despill | 04/05 | à mesurer | — | D3 | **pas avant D3** |
| Retry partiel par masque | 05 § 3.9 | — | adaptateur OpenAI direct, 2 j | `fournisseur/` | non (pas chez OpenRouter) |
| Prix depuis `/api/v1/models` (`pricing`) | 13 § 3.3 | annoncer un prix pour un modèle jamais appelé | 0,5 j | `prix.py` | non — contredit « mesuré, jamais tarif » ; à la rigueur en « annoncé », grisé |
| File de jobs SQLite / Huey, WebSocket | 13 § 3.3 | — | — | — | non |
| `FastMCP.from_fastapi` + élagage | 13 § 4.3 | — | — | — | non (§ 4.5) |
| Modèles locaux, LoRA, ControlNet, IP-Adapter | 03, 04 | — | — | — | non — l'auteur a mesuré, et « pas de ComfyUI » est une règle durable |
| Scoring en cascade ImageReward/HPSv2/VLM-juge | 03 § 3.10 | — | — | — | non — « faire juger par une machine » est écarté (`ARCHITECTURE.md:605`) |
| sqlite-vec, FTS5, tagging ONNX | 13 § 3.5 | — | — | — | non, pas à cette échelle |

---

## 6 · Verdict sur R6, R7, A1, A3, A4, A6, A7

| Tranche | Bon problème ? | Bon ordre ? | Ambition | Angle mort principal |
|---|---|---|---|---|
| **R6** | oui — 31 % d'appels jetés, et du vide gardé en silence | oui, première | juste ; **manque la cause** | la grille 3×3 incomplète (§ 2.3.4) : réparer la géométrie avant de tolérer le neuvième sujet ; sinon on tolère un défaut qu'on fabrique |
| **R7** | oui — texte relisible, images nommées | oui, indépendante | juste, promesse bornée honnêtement | le négatif en queue ; l'ordinal des images à mesurer ; découper `generation.py` d'abord |
| **A1** | oui — sans planche gardée, pas de tri | oui, conditionnée à R6 | juste | l'invariant « aucune feuille assemblée n'est livrable » (`generation.py:867-871`) : la planche devenue asset doit être **non exportable** par construction (un drapeau sur `Asset`, exclu par `export.py`), sinon l'invariant devient un filtre à tenir |
| **A3** | oui — le tri est moins cher que la retouche, mesuré | oui | juste | `preparer` **refuse** aujourd'hui `variations > 1` sur un pliage (`generation.py:546-550`) ; `appels = 1 if cases` dans le prix (`envoi.py:195`) ; concurrence non bornée et pas d'annulation |
| **A4** | oui | oui | juste, courte | `export.py` n'écrit aujourd'hui **ni atlas ni planche** — un PNG par asset à plat + `descriptif.json` maison `FORMAT = 1` (`export.py:66-76`, `:454-488`) ; le format à écrire est **le JSON d'Aseprite** (`releve-outillage.md:538-542`), non nommé dans le PLAN |
| **A6** | oui | oui | juste | le mouvement doit porter **les instants**, pas une phrase : « décrire un mouvement ne marche pas, énumérer chaque instant marche » |
| **A7** | oui — repayer une étape au lieu de dix planches | après A3 | **la plus dure** techniquement | une seule étape à rendre cohérente avec sept autres est le pire cas de consistance ; c'est là que le quatrième chemin paie le plus — A7 dépend d'A0 plus qu'A8 |

**R6.** Le PLAN traite l'effet (accepter neuf pour huit, mesurer le remplissage — `mesurer_lot` rend déjà ressemblance et grille par case, `image/pliage.py:106-`, il manque le taux d'opaque de la boîte). La cause est `geometrie()`, qui préfère « la plus carrée » à « la plus complète ». Pour 8 cases, 4×2 en `3:2` ou `16:9` — gpt-image-2 déclare les deux — donne des cases quasi carrées et **aucune case fantôme**. Huit tirages tranchent ; s'ils confirment, R6 se réduit au contrôle du quadrillage redessiné, qui reste nécessaire.

**R7.** Voir § 2.4. Un ajout : `en_blocs` (`envoi.py:410-422`) est encore lu par l'agent et par R2 ; le rangement en trois parties doit le **remplacer**, pas s'y ajouter, sinon deux découpages du même texte coexistent.

**A3.** (1) Le refus de `variations > 1` sur un lot plié est délibéré (« c'est tout son intérêt ») ; le lever revient à dire qu'un emplacement = une planche, ce qui tombe dans le modèle existant : N emplacements, chacun déplié à son arrivée et relançable seul (`generation.py:879-902`). (2) `prix_de(mesure, images, appels=N)` sait multiplier (`prix.py:117-138`) ; il manque `appels = N` dans `envoi.py:195`, et l'affichage du taux de la séance — à 62 % par planche, quatre planches donnent 98 % de chances d'une bonne ; à 10 %, 34 %. (3) Le tri reste **à l'œil**, et c'est juste ; l'aide d'identité (§ 3.2) n'y entre que si l'essai gratuit sur les 135 notes la valide.

**A4.** Le « format le plus lu » que le PLAN ne nomme pas est le JSON d'Aseprite. Deux formes (`frames` en objet-hash ou en tableau) — prendre le **tableau**, qui garde l'ordre, avec `duration` en millisecondes (la cadence), `meta.frameTags` pour mouvement et direction, `sourceSize`/`spriteSourceSize` pour la fenêtre commune d'A2 [supposé : clés relevées par la recherche, non recopiées dans le dépôt ; Phaser le lit nativement, Godot et Unity via importeurs]. `descriptif.json` reste pour la filiation et la recette.

**A6.** Le proto existe : `Pose` + `CONSIGNES` + `consigne` par pose (`plan.py:56-153`). Ce qui change est le rang (atelier, comme `etiquettes.json`) et le contenu — une liste d'instants en anglais, une cadence, les directions où le mouvement a un sens. « Deux bandes du même mouvement partent avec le même texte » est déjà tenu **par construction** : composition déterministe, images triées par identifiant.

**A7.** Remplacer une étape, c'est une case seule dont les sept voisines sont la référence — sept images jointes (48 % de la facture, `prix.py:22-23`) et la question de consistance la plus dure du produit. Sans pose imposée (A0) ou référent stable (§ 3.2), le taux d'une étape isolée qui s'accorde à sa bande n'est mesuré nulle part. A7 après A0, pas seulement après A3.

---

## 7 · Ce que je ferais dans l'ordre, si je n'avais que dix jours

1. Trois corrections de dette réelle (§ 4.7) — une demi-journée, dont la planche d'équipement sans image.
2. Grille complète + huit tirages (§ 2.3.4) — avant d'écrire la tolérance de R6.
3. Découper `generation.py` en trois modules à façade constante — un jour.
4. R7 tel que § 2.4, avec la mesure des ordinaux.
5. L'essai gratuit DINOv2 sur les 135 notes, et l'essai à $0,10 du quatrième chemin (A0), en parallèle.
6. Le référent par personnage, si l'essai de taille de référence (§ 3.2) dit dans quelle taille il doit partir.

Rien de tout cela ne rouvre ce que les bancs ont fermé : aucune reformulation, aucun modèle local, aucun juge automatique qui refuse.
