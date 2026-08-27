# Asset Kitchen — Architecture

> Établi le 26 août 2026, à partir de l'analyse de SpriteCook
> (`Anatomie de SpriteCook.html`, captures dans `screen_spritecook/`)
> et de l'état des trois projets qui précèdent : `_DEV/game-asset-generator` (GAG),
> `_DEV/MySpriteAi`, `_DEV/game-asset-generator/texel-studio`.

---

## 1 · Ce que c'est

Un atelier personnel de production d'assets 2D pour jeu. On y définit **l'univers**
d'un jeu une fois, puis on fabrique au cas par cas les personnages, objets, décors
et interfaces qui lui appartiennent. **Tout ce qui est produit entre en bibliothèque
de lui-même** ; juger, c'est marquer favori ou supprimer, et ce qui est jugé l'est
avant de partir dans le jeu, pas avant d'entrer dans la bibliothèque
(`docs/PRD.md` fait foi sur ce point).

Le moteur d'image est une API payante. Ce n'est pas un compromis : c'est la seule
famille de modèles qui sait **préserver l'identité d'un sujet** d'une génération à
la suivante — la capacité sur laquelle repose tout ce qui suit la V2.

## 2 · Ce que ce n'est pas

| | |
|---|---|
| **GAG** | fabrique de la quantité, en lot, la nuit, avec des modèles locaux. Asset Kitchen fabrique peu et bien, à la main. Les deux vivent côte à côte, ils ne fusionnent pas. |
| **MySpriteAi** | outil local, ComfyUI au centre, tout dans le navigateur. Asset Kitchen n'embarque pas ComfyUI. |
| **Un produit** | usage personnel. Pas de comptes, pas de crédits, pas de multi-utilisateur, pas de distribution, pas de galerie communautaire. |

Le local reste disponible **hors de l'application** : ComfyUI ou MySpriteAi produisent
une image, on l'importe dans Asset Kitchen. L'import est un citoyen de première classe ;
l'intégration ne l'est pas.

## 3 · Décisions de cadrage

| Sujet | Décision | Pourquoi |
|---|---|---|
| Socle | Nouveau dépôt. Récupération ciblée, pas de fork. | Paradigme opposé à GAG, moteur opposé à MySpriteAi. |
| Moteur d'image | **API seulement**, via **OpenRouter comme passerelle unique**. | Cohérence d'identité impossible en local sur 8 Go — mesuré : Flux GGUF 1024 à 106,9 s/image sur cette machine. |
| Fournisseur | Un seul adaptateur : OpenRouter. Un compte, une clé, une facture. | 48 modèles image de 11 fournisseurs, paramètres unifiés, découverte de capacités, `usage.cost` par appel. Écrire trois adaptateurs donnerait le même résultat pour trois fois le travail. |
| Comptabilité | **Aucun compteur de crédits maison en V1.** Suivi des coûts dans le tableau de bord OpenRouter. | Économise tout un pan de code pour une information déjà rendue ailleurs. |
| Modèles locaux | Hors application. Import du résultat. | Évite le gestionnaire de VRAM, les rechargements, les custom nodes. |
| Détourage | `rembg` en local, en direct, passes multiples possibles. | 1–2 s, aucun GPU mobilisé longtemps, aucune dépendance à un service. |
| Post-traitement | Local, CPU, jamais sur le GPU. | Reprise de AD-9 de GAG. Un curseur doit répondre instantanément. |
| Univers | Bible écrite à la main + planches de référence + palette extraite par calcul. | La palette sert **en entrée** (contrainte de quantification), pas en contrôle. |
| Conformité | **Aucune vérification automatique.** L'humain juge à l'œil. | Écarté volontairement : coûte de l'analyse d'image pour un jugement que l'auteur fait mieux. Réintégrable plus tard si le besoin apparaît. |
| Forme | Serveur Python local + interface web dans le navigateur. | `rembg`/Pillow/SDK MCP imposent Python ; l'ergonomie impose le web ; le navigateur donne les outils de développement, qu'une WebView cache. |
| Style | V1 = pixel art. Aucune décision ne doit interdire le 2D non-pixel. | La quantification stricte abîme le 2D peint — elle devra avoir deux régimes le jour venu. |
| Validation | Manuelle, systématique. | C'est le principe du produit, pas une limite. |

## 4 · Architecture

```
                 navigateur (React + Vite + Tailwind)
                              │  HTTP + SSE
                 ┌────────────┴─────────────┐
                 │   API locale — FastAPI   │
                 └────────────┬─────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   fournisseurs          traitement            bibliothèque
   d'image (API)      (Pillow, numpy,        (SQLite + fichiers)
                          rembg)
                              ▲
                              │
                     serveur MCP (même processus,
                      mêmes fonctions que l'API)
```

Quatre règles qui tiennent l'ensemble :

1. **Le fournisseur est derrière un port.** Le vocabulaire d'un fournisseur ne franchit
   pas son adaptateur : ni `gpt-image-2`, ni `gemini-*`, ni le nom d'un paramètre
   maison ne remontent dans le domaine. Reprise de AD-11 et AD-28 de GAG.
2. **Le MCP n'a pas de logique propre.** C'est une façade sur les fonctions que
   l'interface appelle déjà. Deux chemins, une seule implémentation.
3. **Les fichiers font foi, la base est un index reconstructible.** Si la base
   SQLite disparaît, on la reconstruit en relisant le disque — aucun asset n'est
   perdu. Reprise de AD-5 de GAG.
4. **Le post-traitement ne touche jamais le GPU.** Il est CPU, pur, et ses étapes
   s'appliquent dans un ordre fixe.
5. **Le traitement est non destructif.** On garde l'image brute et la **recette** — la
   liste ordonnée des étapes et leurs réglages. Le fichier traité est un rendu, écrit sur
   disque comme cache, effaçable sans rien perdre. Recalculer coûte des millisecondes ;
   regénérer coûte de l'argent et ne rend jamais la même image. Corollaire gratuit : un
   preset *est* une recette nommée, et changer la palette d'un projet la réapplique à tous
   ses assets sans un seul appel payant.

### Squelette du dépôt

```
gag2/
├─ AGENTS.md                 écrit au fur et à mesure, jamais après coup
├─ docs/PLAN.md
├─ atelier/                  paquet Python
│  ├─ __main__.py            lance le serveur, ouvre le navigateur
│  ├─ api/                   FastAPI — les routes
│  ├─ mcp/                   serveur MCP — façade, aucune logique propre
│  ├─ services/              les gestes du produit
│  ├─ domaine/               objets et règles, aucune dépendance sortante
│  ├─ fournisseur/           le port + l'adaptateur OpenRouter
│  ├─ image/                 détourage, pixellisation, palette, découpe, export
│  └─ depot/                 SQLite + fichiers
├─ interface/                React + Vite + Tailwind
├─ donnees/                  projets et assets — hors Git
└─ pyproject.toml
```

**Une seule frontière formelle : `fournisseur/`.** L'hexagone complet de GAG protège d'un
remplacement ; or il n'y a qu'une base, qu'un disque, qu'une interface, et aucun des trois
ne changera. Le fournisseur, lui, changera. Partout ailleurs : des modules à responsabilité
claire, comme `server/` dans MySpriteAi.

**`mcp/` est le voisin de `api/`, pas son client.** Les deux appellent `services/`, aucune ne
réimplémente rien. C'est ce qui garantit que ce qu'un agent peut faire est exactement ce que
l'écran peut faire.

**Pas de noyau détaché** (contrairement à GAG) : utile pour un lot de nuit de huit heures,
inutile pour une génération de dix secondes qu'on regarde.

**Nommage — un tiers le lit → anglais, sinon → français.** Les noms d'outils MCP en anglais
(ils sont lus par des modèles entraînés en anglais ; `generer_asset` dégraderait le
déclenchement) et les chemins de routes HTTP par convention. Domaine, services, traitement
d'image, colonnes SQL, interface : en français.

## 4 bis · Fournisseur et modèles

Un seul adaptateur, OpenRouter (`https://openrouter.ai/api/v1`). Relevé du 26 août 2026,
recompté le 27 : **48 modèles image, 11 fournisseurs** (`essais/couverture.json`).

**Le catalogue décide, jamais une liste en dur.** `GET /api/v1/images/models` est relu au
démarrage : il donne par modèle le plafond de références, les résolutions, les paramètres
supportés. L'interface s'y conforme — un modèle qui n'accepte pas assez de références pour
la demande en cours est **grisé avec sa raison**, jamais proposé puis rejeté en 400.

Deux divergences qui justifient cette règle : le catalogue donne 16 références à
`gpt-image-2` là où SpriteCook en déclarait 14, et 14 à `gemini-3-pro-image` là où
SpriteCook en déclarait 10. SpriteCook code ses limites en dur, et plafonne sous les modèles.

**Un modèle par usage, pas un modèle par défaut.** Établi par le banc du 26 août 2026 :
12 configurations × 2 jets × 4 étapes, coûts et durées **mesurés** (`essais/mesures.json`),
qualité jugée image par image (`essais/jugements.json`).

**Un seul modèle par défaut : `openai/gpt-image-2` en `quality: low`.** Établi par le second
banc (`essais/essai_univers.py`), qui rejoue le scénario V1 lui-même — un guide de style à
deux planches, dix sujets variés, deux jets, trois finalistes.

| Modèle | Banc 1 *(1 perso, 1 réf)* | **Banc 2** *(univers, 10 sujets, 2–3 réfs)* | $/img avec guide |
|---|---:|---:|---:|
| **`openai/gpt-image-2` low** | 3,83 — 4ᵉ | **3,8 / 3,8** — 1er, seul régulier | **0,0245** |
| `bytedance-seed/seedream-5-0-lite` | 4,33 — 1er | 2,6 / 3,2 | 0,0350 |
| `bytedance-seed/seedream-4.5` | 4,17 — 3ᵉ | 2,0 / 2,4 — **disqualifié** | 0,0400 |

**Le banc 1 mesurait la mauvaise chose.** Il testait un personnage avec une seule référence ;
le classement s'est inversé dès qu'on a testé un univers. `seedream-4.5` déclenche le piège de
référence aux **deux** jets — C1c_marche rend le goblin du guide au lieu de la prêtresse, le
même défaut qui avait éliminé `riverflow`. Invisible avec une seule référence : le sujet n'a
alors rien à écraser.

**Ne jamais conclure d'un banc dont le protocole n'est pas le geste réel du produit.**

**Trois enseignements de conception, tirés du banc 2 :**

1. **Le guide de style contamine les sujets** — « dilue » dans 5 cas sur 6. Le squelette porte
   la tunique et les bottes du goblin ; la prêtresse elfe hérite de ses oreilles vertes, puis
   de son visage entier. **Promouvoir un personnage en artwork officiel est donc une erreur** :
   un artwork officiel doit être une planche de style — matières, palette, échantillons de
   trait — ou à défaut être choisi par famille d'assets.
2. **Aucun modèle ne tient une grille de pixel constante à l'intérieur d'un lot** — facteur 5
   chez `seedream-4.5`, 2,5 chez le gagnant. La normalisation de grille est une étape
   **obligatoire**, pilotée par une taille cible du projet, jamais déduite de l'image reçue.
3. **Les petits objets sortent plus grossiers que les personnages** (16 px de bloc contre 8),
   chez les trois modèles. La taille cible doit être imposée, pas espérée.

**Trois pièges de fournisseur, vérifiés par appel :**

- **Aucun modèle ne déclare de prompt négatif.** Relevé le 27 août 2026 sur les 48 modèles
  image : zéro `negative_prompt`. Le prompt négatif est un champ du produit (US-6), pas un
  paramètre du fournisseur — **c'est l'adaptateur qui le replie en fin de prompt**. L'envoyer
  comme paramètre reviendrait à le voir ignoré en silence, exactement comme `output_format`
  chez Seedream.
- **Les Seedream ne rendent que du JPEG.** `output_format: "png"` est accepté sans erreur puis
  ignoré (`media_type: image/jpeg`). Le catalogue ne déclare pas ce paramètre pour eux — il ne
  ment pas, il se tait. Mesuré : le bruit JPEG est absorbé par la réduction et la
  quantification (1 316 couleurs à 64 px → 32 après quantification), donc handicap réel mais
  non disqualifiant.
- **Le coût dépend du nombre de références, mais seulement pour les modèles facturés au token.**
  `gpt-image-2` va de **$0,0064 sans référence** à $0,0124 avec une puis $0,0245 avec deux —
  les deux premiers chiffres mesurés en `quality: low`, le troisième au banc 2. Les Seedream,
  facturés à l'image, ne bougent pas. **À quatre ou cinq artworks officiels, le classement des
  coûts s'inverse** — l'économie du projet dépend donc de la taille de l'univers.

**Écartés, et pourquoi.** `sourceful/riverflow-v2.5-fast` et `black-forest-labs/flux.2-klein-4b`
recopient le personnage de l'image de référence au lieu d'en créer un nouveau — une référence
de style écrase le sujet du prompt, ce qui interdit tout casting varié dans un style commun.
Aucun post-traitement ne répare ça. `google/gemini-3-pro-image` obtient 2/5 en chaînage pour
$0,136. `openai/gpt-image-1-mini` rend une bouillie illisible.

**Le constat qui décide de l'architecture : dix modèles sur douze font dériver la taille du
pixel d'une étape à l'autre** — A sur une grille de 8 px, B sur 5–7 px désalignés, C
anti-aliasé. Les frames d'un même personnage ne partagent plus le même pixel. C'est la
confirmation directe du diagnostic porté sur SpriteCook : sans la re-pixelisation sur grille
commune, **dix modèles sur douze sont inutilisables**. La couche de post-traitement n'est pas
un confort, c'est ce qui rend le produit possible.

**Deux familles de défauts, à ne jamais confondre au moment de choisir un modèle :**

| | Exemples | Verdict |
|---|---|---|
| **Corrigeable** | dérive de grille, anti-aliasing, 30 000 couleurs au lieu d'aplats | non disqualifiant — la couche 2 le règle |
| **Rédhibitoire** | la référence de style écrase le sujet ; le sujet demandé n'est pas produit | disqualifiant — aucun traitement ne répare |

**Attention au prix affiché au catalogue.** `riverflow-v2.5-fast` annonce $0,019 l'image et
facture **$0,042** : les références en entrée sont facturées en plus. Seul `usage.cost` de la
réponse dit la vérité — c'est lui qu'il faut enregistrer, jamais le tarif du catalogue.

Le modèle n'est donc pas un réglage global du projet : c'est un **défaut par type d'asset**,
porté par l'univers.

**Deux règles de prompt, valables partout**, tirées du même essai :

- **imposer `aspect_ratio` explicitement** — sans lui, Gemini part en 16:9 et Seedream en 1:1 ;
- **« one single sprite, one pose only »** — sans quoi Gemini rend spontanément une planche.

**Deux points relevés pour plus tard**

- `recraft/recraft-v4-styles-vector` sort du **SVG**. À reconsidérer le jour de l'interface.
- **Ne jamais générer petit.** 512 px coûte $0,045 contre $0,067 en 1K — un tiers de moins
  pour beaucoup moins de qualité. On génère en 1K et on réduit en post-traitement, comme
  SpriteCook le fait pour ses tuiles de 16 et 32 px.

Absents du catalogue image, contrairement à ce qu'on espérait : **Wan** (famille vidéo) et
**ERNIE-Image**. La famille Alibaba/Tongyi y est sous le nom `qwen/qwen-image-3` (4 références).

### Contrat de génération

**Asynchrone dès la première tranche.** On soumet, on reçoit un identifiant, l'interface
écoute un flux d'événements (SSE) pour l'avancement — équivalent de
`MySpriteAi/server/progress.ts`, déjà éprouvé.

- **Une génération porte un identifiant, et il est unique.** C'est ce qui empêche une
  resoumission de facturer deux fois. Règle la plus explicite du serveur SpriteCook.
- **Attente bornée pour le MCP** : l'appelant dit « attends jusqu'à N secondes, sinon rends
  l'identifiant ». L'agent obtient son image directement neuf fois sur dix, sans sondage.
- **Générations concurrentes** : les plafonds du fournisseur sont larges (100 req/min sur
  Nano Banana 2, 50 sur GPT-Image-2). Quatre variations en parallèle, pas en série.
- Pas d'URL signées ni d'expiration — le MCP tourne dans le même processus que l'API et lit
  les fichiers sur le disque. Le point le plus coûteux de l'intégration SpriteCook n'existe
  pas ici.
- **Le flux ne transporte que des faits acquis** — un emplacement part, une image arrive, un
  appel échoue, le catalogue revient. Aucun avancement intermédiaire n'y circule, parce
  qu'aucun fournisseur d'image n'en produit : relevé sur les 48 modèles du catalogue, aucun
  ne rend de progression avant l'image. Le premier message de chaque abonnement est **l'état
  complet**, ce qui fait qu'un onglet rouvert n'a rien à redemander et qu'une reconnexion se
  rattrape seule.
- **L'attente d'un modèle est une mesure, pas une table.** Elle est la médiane des durées de
  ses derniers appels réussis, relues dans l'index ; une valeur d'amorçage sert le temps de
  la première image, puis ne resert jamais. C'est ce qui rend possible la jauge *déterminée*
  que `docs/DESIGN.md` § Motion demande, sans inventer de pourcentage.

### Serveur MCP — outils et garde-fous

**Grain épais.** L'agent qui appelle ce serveur est en train de coder le jeu : son attention
est ailleurs. Il dit ce qu'il veut, pas comment l'obtenir. Ce sont les **réglages par défaut
du projet** qui rendent ça possible — modèle, résolution, palette, mode de détourage sont
déjà portés par l'univers.

| Outil | Rôle |
|---|---|
| `generate_asset` | génère, traite, range, rend un fichier — éventuellement dans le dossier du jeu |
| `check_generation` | l'état, pour les cas longs |
| `list_projects` | savoir où ranger |
| `list_assets` | retrouver et réutiliser plutôt que regénérer |
| `get_asset` | métadonnées et chemin |
| `import_asset` | faire entrer un fichier local |
| `edit_asset` | détourer, découper, recadrer un asset existant |
| `export_assets` | poser une sélection dans un dossier |
| `list_models` | le catalogue et ses plafonds |

**Deux garde-fous, tous deux réglables depuis l'interface et désactivables.** Le serveur lit
le réglage courant **à chaque appel**, jamais au démarrage — on doit pouvoir changer d'avis
en cours de session sans redémarrer.

| Garde-fou | Défaut | Réglable |
|---|---|---|
| Plafond de générations par session | activé | seuil libre, ou désactivé |
| Modèle d'exploration imposé au MCP (`gpt-image-2`, `quality: low`) | activé | modèle libre, ou désactivé |

Raison du second : un agent qui code a besoin d'un visuel correct tout de suite, pas d'un
asset final. Rapport de six sur le coût du travail agentique, pour une perte de qualité qui
ne compte pas à ce moment-là. La version de production se regénère depuis l'interface.

## 5 · Modèle d'objets

| Entité | Contenu | Note |
|---|---|---|
| **Projet** *(= l'univers)* | nom, bible (texte libre), planches de référence, palette extraite, réglages par défaut | Chez SpriteCook le projet est un dossier. Ici il **contraint** — c'est la différence centrale. |
| **Collection** | nom, projet optionnel | Rangement à plat, comme SpriteCook : Projet › Collection › Asset, et rien d'autre. |
| **Carte** *(tableau d'inspiration)* | type (image \| texte), contenu, groupe, note, provenance (URL, date), taille d'affichage, **artwork officiel** oui/non, **famille** (personnages \| objets \| décors \| interface \| tous) | Deuxième famille d'images du produit. Ne s'exporte jamais, ne compte pas dans la bibliothèque. La **famille** décide de ce qui part en référence — voir §6.1. |
| **Asset** | fichier(s), label, prompt, réglages résolus, dimensions mesurées, type, parent (filiation), favori | Les dimensions **mesurées** font foi, jamais celles demandées. |
| **Génération** | statut, avancement, paramètres résolus, coût réel, résultats | Un enregistrement par appel, y compris ceux qui échouent. |

## 6 · V1 — l'atelier

Sept briques. Objectif : une application utilisable pour de vrai, sans aucune
inconnue technique.

### 6.1 Contenu

| Brique | Ce qu'elle fait | Ce qu'elle ne fait pas |
|---|---|---|
| **Tableau d'inspiration** | Rassembler, trier, jeter. Cartes image **ou texte**. Entrée par collage (Ctrl+V, le geste principal), glisser-déposer, URL, fichier. Groupes nommés, note et provenance par carte, vignettes 1×/2×/4×. Promotion d'une carte en **artwork officiel**. | Pas de toile libre — grille seulement. Pas de corbeille : suppression avec annulation courte. |
| **Univers** | Une bible en **champs nommés** (monde, époque, trait, éclairage, contraintes techniques), chacun activable pour une génération. Les artworks officiels partent en guide de style à chaque appel. Palette extraite d'eux par calcul. | Pas de description automatique du style. Pas de contrôle de conformité. Pas de consignes par type d'asset. |

**Les artworks officiels sont groupés par famille, et seuls ceux de la famille du sujet
partent en référence.** Décidé le 26 août 2026, sur mesure.

Le banc 2 a montré qu'un artwork officiel *figuratif* contamine les sujets suivants : le
squelette héritait de la tunique et des bottes lacées du goblin, la prêtresse elfe de ses
oreilles vertes puis de son visage entier — *« peau olive marbrée, arcade lourde, nez crochu,
croc blanc : l'espèce demandée est perdue »*. Le guide a été jugé « dilue » dans 5 cas sur 6.

Ce que ça implique concrètement :

- **La carte du tableau d'inspiration porte une famille** en plus de son groupe. Familles
  pressenties : `personnages`, `objets`, `décors`, `interface`, et `tous` pour une planche de
  style non figurative — matières, palette, échantillons de trait — qui accompagne toute
  génération.
- **Au moment de générer, l'app n'envoie que les artworks de la famille du sujet**, plus ceux
  marqués `tous`. C'est elle qui choisit, pas l'utilisateur : promouvoir reste un geste unique.
- **Le budget de références s'en trouve allégé** : au lieu de tout envoyer, on envoie ce qui
  est pertinent — ce qui laisse de la place pour la source d'édition dans les chaînes de poses.
- **Effet de bord sur le coût** : moins de références envoyées, moins de tokens d'entrée
  facturés sur `gpt-image-2`. La famille est donc aussi une économie.

Écarté : imposer que l'artwork officiel soit une planche de style non figurative — trop
contraignant, et l'utilisateur travaille justement à partir de visuels trouvés. Écarté aussi :
assumer la contamination comme un effet de style — elle fait perdre l'espèce du sujet, ce
n'est pas un style, c'est une erreur.
| **Générateur** | Prompt, prompt négatif, réglages, choix du modèle, variations. Réinjection d'un asset existant comme référence, source d'édition, guide de style, ou jeu de réglages. | Pas de routeur d'intention automatique. Pas de presets communautaires. |
| **Bibliothèque** | Projets, collections, filiation, favoris, recherche, filtres, sélection multiple. Affichée **sous le champ de prompt**, pas dans un écran séparé. | Pas de galerie publique, pas de partage. |
| **Post-traitement** | Recadrage, redimensionnement, pixellisation sur grille, quantification sur la palette de l'univers, nettoyage de bords. Réglages instantanés. | Pas de passe qui monopolise le GPU. |
| **Détourage** | `rembg`, une ou plusieurs passes, seuil alpha réglable, durcissement du bord. | Pas de détourage par couleur. |
| **Slicer** | Découpe d'une planche multi-sprites par alpha connexe. Modes automatique, grille fixe, sélection manuelle. Correction à la main quand la détection se trompe. | Pas d'extraction de composants d'interface (c'est le UI Kit, hors périmètre). |
| **Export** | Téléchargement d'un PNG. Export d'une sélection en ZIP + JSON descriptif. | Pas de paquet Unity/Godot prêt à importer. |
| **MCP** | **Une dizaine d'outils complets, pas quarante-trois outils fins.** `generate_asset` génère, applique l'univers du projet, traite, range et rend **un chemin de fichier** — et sait écrire directement dans le dossier du projet de jeu. Attente bornée pour éviter le sondage. | Pas d'enchaînement à composer par l'agent. Pas d'URL signées : même machine, mêmes fichiers. |

### 6.2 Les écrans

**Une seule grille d'assets dans tout le produit.** SpriteCook en a deux — une sous le prompt
dans `/create`, une dans `/assets` — et elles ont déjà divergé : la première ne montre pas
les pastilles projet et collection. Ici, la grille qui sert à réutiliser est exactement celle
qui sert à organiser : mêmes filtres, même recherche, même sélection multiple. Organiser
n'oblige jamais à quitter l'endroit où l'on crée — c'est ce qui fait qu'on organise.

| Écran | Rôle | Fréquence |
|---|---|---|
| **Projets** | liste, création, ouverture | rare |
| **Univers** | tableau d'inspiration, bible, palette, réglages par défaut | au début d'un projet, puis ponctuel |
| **Atelier** | arbre · réglages · prompt · grille — le travail quotidien | permanent |
| **Fiche asset** | visionneuse, recette, filiation, actions | constant |
| **Réglages** | clé OpenRouter, garde-fous MCP, dossiers | rare |

- **La fiche asset est un panneau latéral**, pas une page. Une page ferait perdre la grille et
  le prompt ; fermer le panneau remet exactement où l'on était.
- **Écran large uniquement.** Le produit ne vise ni mobile ni tablette : les trois panneaux
  et la grille cohabitent d'emblée. Aucun point de rupture, aucun menu escamoté, aucune mise
  en page de repli à écrire. Les panneaux restent rétractables **par choix** — voir la grille
  en grand — jamais par contrainte de place.

### 6.3 Ordre de construction

Sept tranches verticales, décidées ici le 26 août 2026 : **T1** la première image,
**T2** le post-traitement, **T3** la bibliothèque, **T4** le tableau et l'univers,
**T5** le slicer, **T6** l'export, **T7** le MCP.

Le critère qui a produit ce découpage, et qui le tient : **chaque tranche est utilisable à
sa livraison, et on ne passe à la suivante que lorsque la précédente sert vraiment.** T1
seule vaut déjà le détour — elle remplace l'aller-retour vers SpriteCook pour un asset
isolé. Chaque tranche doit valoir son temps de construction avant que la suivante commence.

Ce que contient chaque tranche, les user stories qu'elle couvre, ses dépendances et ses
critères d'acceptation : **`docs/PLAN.md`**, qui fait foi sur l'ordre.

### 6.4 Critères d'acceptation de la V1

Distribués tranche par tranche dans `docs/PLAN.md`, chacun écrit là où il devient
vérifiable.

## 7 · V2 — Tileset autotile

Génération d'atlas de tuiles qui se raccordent. Lourd mais **déterministe** : aucune
inconnue, seulement du post-traitement précis.

- Perspectives : top-down, plateforme, isométrique.
- Jeux de pièces : 15-pièce (4×4), 17-pièce (5×4), autotile-16 plateforme.
- Recalage sur grille, découpe, assemblage en atlas, aperçu de raccord.
- Sortie : PNG + JSON de mappage.

Point d'attention relevé chez SpriteCook : aux petites tailles (16 et 32 px), le
modèle génère **plus grand** que la sortie finale, puis on recale et on découpe.
Générer directement à la taille cible ne marche pas.

## 8 · V3 — Character Creator

Un personnage, sa perspective, et ses **poses préparées**.

- Étape 1 — décrire, ou déposer un sprite existant.
- Étape 2 — style et perspective. **La perspective verrouille tout ce qui suit.**
- Étape 3 — révision : retoucher, régénérer, comparer.
- Étape 4 — poses préparées : retourner le personnage, le mettre en posture. Chaque
  pose est un asset visible, et certaines dérivent d'une autre (la marche de dos
  dérive de l'attente de dos, pas de la vue de face).

**C'est ici que se joue la valeur du projet.** Le graphe de poses est ce que
l'analyse de SpriteCook désigne comme sa meilleure idée technique, et c'est
l'entrée obligatoire de la V4.

**Prérequis à vérifier avant d'engager la V3** : que le fournisseur retenu sache
réellement préserver l'identité d'un sujet sur plusieurs générations, à partir de
références multiples. À tester tôt — voir §11.

## 9 · V4 — Animation de sprites

Le morceau à risque. Le modèle d'animation de SpriteCook n'est pas exposé : il n'y
a rien à copier, il faut retrouver une recette.

**Approche retenue** : faire produire les images par l'IA, puis fournir un bon
outil de découpe, d'alignement et de prévisualisation. Le travail manuel est
accepté s'il se fait dans une interface agréable.

L'outil, brique par brique :
- découpe d'une planche de frames (le Slicer de V1 en fait déjà la moitié) ;
- alignement : marge, marge de sécurité, forçage en puissance de deux, ancrage 3×3 ;
- pelure d'oignon, aperçu animé avec réglage de vitesse ;
- correction frame par frame ;
- sortie : spritesheet + JSON, WebP animé, GIF.

**Une piste sérieuse, trouvée par accident le 26 août 2026.** Pendant l'essai d'identité,
`gemini-3.1-flash-image` a **calqué la mise en page de son image de référence** : on
demandait un sprite, il en a rendu trois alignés (une rotation en trois étapes) — puis
l'appel suivant, qui recevait ces trois-là, en a rendu trois dans la même disposition.

Le modèle reproduit la **structure** de l'entrée, pas seulement son style. D'où l'hypothèse
à tester : **fournir une planche gabarit** — huit cases vides, alignées, à la bonne taille —
et le laisser la remplir. C'est ce que les indices relevés chez SpriteCook suggéraient déjà
(entrée plafonnée à 256×256, sortie en spritesheet, nombre de frames toujours pair). Ce
n'est plus une supposition, c'est un comportement observé.

**Prototypage préalable quand même**, avant tout engagement : la planche gabarit contre N
générations successives à partir de la pose préparée. Mais la première branche part
largement favorite.

Effet de bord côté V1 : ce même comportement est une **nuisance** tant qu'on veut un sprite
isolé. Le prompt doit imposer « one single sprite, one pose only ».

## 10 · V5 — Audio

- **Bruitages** — description → son court. Le module existe déjà dans MySpriteAi
  (Stable Audio Open en local) ; une API reste possible en second fournisseur.
- **Boucles d'ambiance** — le vrai travail est le **bouclage sans couture** :
  recouvrement, fondu croisé, correspondance de phase. C'est du traitement du signal,
  pas de la génération.
- Post-traitement commun : fondus courts, retrait des silences de tête et de queue,
  normalisation, fréquence d'échantillonnage fixe.

## 11 · Risques, et quand les lever

| Risque | Gravité | Quand le lever |
|---|---|---|
| **La recette d'animation n'existe pas** | élevée | prototypage dédié avant la V4 — **piste sérieuse trouvée**, voir §9 |
| ~~Aucun fournisseur ne préserve l'identité~~ | — | **levé le 26 août 2026.** `gemini-3.1-flash-image` tient l'identité et la dérive entre deux poses enchaînées est quasi nulle. Seedream 4.5 échoue sur ce point mais excelle au transfert de style. |
| **L'échelle du sujet dérive d'une génération à l'autre** | moyenne — bloque le montage d'animations | constaté le 26 août. Corrigé par le recadrage et la normalisation d'échelle, qui passent donc de « confort » à **obligatoires** |
| ~~La couverture image d'OpenRouter~~ | — | **levé le 27 août 2026** par `essais/essai_couverture.py` : 48 modèles image, 11 fournisseurs, 31 acceptant trois références ou plus. Et le catalogue a bougé en un jour — 47 → 48 — ce qu'une liste en dur n'aurait pas vu |
| **Le coût par image dérive** | moyenne | enregistrer le coût réel de chaque génération dès la T1, et le totaliser par projet |
| **La qualité pixel art directe** | faible | comparaison en T2 : sortie brute du modèle contre sortie post-traitée |

Le deuxième risque est le plus sournois : il ne se voit pas en V1, et il annule les
V3 et V4 s'il se réalise. **Il se teste en dix minutes dès la première tranche** —
c'est le premier essai à faire, avant même d'écrire la bibliothèque.

## 12 · Ce qu'on récupère

| Source | Pièce | Usage |
|---|---|---|
| GAG | `gag/domaine/direction.py` | extraction de palette, luminance, saturation |
| GAG | `gag/ports/`, `gag/adaptateurs/` | la forme du port fournisseur, allégée |
| GAG | AD-5, AD-9, AD-11, AD-28 | index jetable, post-traitement hors GPU, vocabulaire confiné |
| MySpriteAi | `src/lib/pixelPipeline.ts` | à porter en Python — les décisions dedans sont durement acquises (durcir l'alpha à 128 **avant** la réduction, sinon liseré clair) |
| MySpriteAi | `src/lib/audioPipeline.ts` | V5 |
| MySpriteAi | `workflows/audio/txt2sfx.api.json` | V5, si le local reste au menu |
| SpriteCook | captures `screen_spritecook/` | référence d'ergonomie, écran par écran |

## 13 · Hors périmètre, et pourquoi

| Écarté | Raison | Réversible ? |
|---|---|---|
| ComfyUI dans l'application | coût d'intégration élevé, bénéfice nul une fois le moteur passé en API | oui, derrière le port fournisseur |
| Contrôle de conformité automatique | l'auteur juge mieux et plus vite | oui, la palette mesurée est déjà là |
| Description du style par un modèle de vision | c'est de l'analyse d'image, écartée avec le reste | oui, le port existe dans GAG |
| UI Kit + éditeur 9-slice | 8 étapes, taxonomie, extraction — un produit à lui seul | oui, mais ce sera un chantier |
| Paquets moteur Unity / Godot | entre le ZIP et le paquet, il n'y a que du glisser-déposer | oui |
| Pack d'assets par genre | fabrique de la quantité — c'est le métier de GAG | non souhaitable |
| Comptes, crédits, distribution | outil personnel | non souhaitable |
| Génération non-pixel-art | V1 seulement ; rien ne doit l'interdire structurellement | prévu |
