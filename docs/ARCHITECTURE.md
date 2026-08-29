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
la suivante — la capacité sur laquelle repose toute la V2, et tout ce qui la suit.

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
| Détourage | **Remplissage depuis le bord** par défaut, `rembg` en second moteur facultatif. Passes multiples dans les deux cas. | *Révisé le 27 août 2026, à la mesure.* Tout ce que l'atelier produit arrive sur un fond plat : le remplissage suffit sur 44 images de six modèles, en 130 ms, sans modèle, sans téléchargement et hors ligne. Faire du modèle la dépendance par défaut aurait fait payer 180 Mo et un premier lancement en ligne pour un résultat que personne ne distinguerait. |
| Post-traitement | Local, CPU, jamais sur le GPU. | Reprise de AD-9 de GAG. Un curseur doit répondre instantanément. |
| Univers | Bible écrite à la main + planches de référence + palette extraite par calcul. | La palette sert **en entrée** (contrainte de quantification), pas en contrôle. |
| Conformité | **Aucune vérification automatique.** L'humain juge à l'œil. | Écarté volontairement : coûte de l'analyse d'image pour un jugement que l'auteur fait mieux. Réintégrable plus tard si le besoin apparaît. |
| Forme | Serveur Python local + interface web dans le navigateur. | Pillow, numpy et le SDK MCP imposent Python ; l'ergonomie impose le web ; le navigateur donne les outils de développement, qu'une WebView cache. |
| Toile de composition | **`@xyflow/react`**, ajoutée en T8 — la seule dépendance d'exécution que l'interface ait gagnée depuis React. | *Décidé le 27 août 2026.* Le plan, la conversion écran → plan, la sélection et le confinement d'une carte dans un îlot sont du code de bibliothèque, éprouvé et sous licence MIT ; les réécrire coûterait des semaines pour reproduire ce qui existe. Ce qu'elle ne fournit pas — la carte, la persistance, le classement, l'annulation — reste entièrement au produit : §6.5 fait la part exacte. |
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
   d'image (API)     (Pillow + numpy,       (SQLite + fichiers)
                     rembg en option)
                              ▲
                              │
                     serveur MCP (même processus,
                      mêmes fonctions que l'API)
```

Cinq règles qui tiennent l'ensemble :

1. **Le fournisseur est derrière un port.** Le vocabulaire d'un fournisseur ne franchit
   pas son adaptateur : ni `gpt-image-2`, ni `gemini-*`, ni le nom d'un paramètre
   maison ne remontent dans le domaine. Reprise de AD-11 et AD-28 de GAG.
2. **Le MCP n'a pas de logique propre.** C'est une façade sur les fonctions que
   l'interface appelle déjà. Deux chemins, une seule implémentation.
3. **Les fichiers font foi, la base est un index reconstructible.** Si la base
   SQLite disparaît, on la reconstruit en relisant le disque — aucun asset n'est
   perdu. Reprise de AD-5 de GAG.

   Deux conséquences, tirées en T3 et qui tiennent l'invariant vivant : le schéma
   de l'index **n'a aucune migration** — quand il change, l'index est jeté et le
   démarrage le refait depuis les fichiers, si bien que la reconstruction sert au
   moins une fois par évolution du schéma ; et **le fichier s'écrit avant
   l'index**, jamais l'inverse, pour qu'une coupure laisse l'index en retard sur
   le disque plutôt que le disque en retard sur l'index.
4. **Le post-traitement ne touche jamais le GPU.** Il est CPU, pur, et ses étapes
   s'appliquent dans un ordre fixe : détourage, recadrage, grille, quantification,
   bords. Aucune ne se réordonne — trois des cinq n'ont pas de sens avant celle
   qui les précède.

   **Le détourage par défaut ne demande aucun modèle**, et c'est une mesure, pas
   un principe : un remplissage depuis le bord — un pixel n'est du fond que s'il
   est *relié au bord* par une chaîne de pixels proches de la couleur de
   bordure — rend une silhouette propre sur les 44 images des bancs, squelette
   blanc sur fond gris clair et fioles translucides compris (`essais/essai_pixel.py`,
   27 août 2026). `rembg` reste **en second moteur, facultatif** — il embarque
   180 Mo de réseau de neurones et il est là pour les images qui ne viennent pas
   d'ici, donc sans fond plat. Absent, il est grisé avec sa raison, et rien du
   geste courant ne s'arrête.
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
│  ├─ image/                 mesures, détourage, grille, quantification, découpe, PNG
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

**La remise sur grille est donc systématique — tant qu'une cible est posée** (R2, US-163).
« Systématique » a longtemps voulu dire « sans échappatoire », et c'en était une de trop : le
constat ci-dessus vaut pour un jeu en pixel art, et un jeu qui ne l'est pas n'a rien à gagner à
être ramené sur une grille. La cible « aucune » est une valeur d'univers déclarée, pas un
réglage éteint ; sans elle, le post-traitement imposait une apparence que l'auteur n'avait
jamais posée, et rien à l'écran ne le lui disait. **Elle ne rouvre rien** : dès qu'une cible est
posée, la dérive reste le cas normal et la remise reste sans condition.

**Faire entrer une image est un geste du produit, et il n'a qu'un endroit.** Le service qui
le porte est appelé par l'outil de l'agent, par la route qui prend un *chemin* — ce qu'un
appelant local a — et, depuis R3, par celle qui prend les **octets** — ce qu'un navigateur
donne. Trois portes, une serrure : c'est ce qui garde vraie la phrase « ce que l'agent peut
faire, l'écran le peut aussi », dans les deux sens. Les octets voyagent bruts, en corps de
requête : ni `multipart`, ni base64, comme le collage du tableau depuis T4.

**Et ce qui part se voit avant de partir** (R2, US-158). La composition du prompt — bible
active en tête, sujet, consignes de planche en queue — vit à **un seul endroit**, et l'aperçu
emprunte ce chemin-là plutôt que d'en écrire un second : deux compositions divergeraient, et
celle qui compte est celle qui part. L'auteur peut reprendre ce texte pour une génération
donnée ; il part alors mot pour mot, et l'enregistrement le dit.

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
| `import_asset` | faire entrer un fichier local — telle quelle ou avec le traitement du projet, et le doublon se dit plutôt que d'entrer deux fois |
| `edit_asset` | détourer, recadrer, remettre sur grille, revenir au brut |
| `slice_asset` | proposer des rectangles sur une planche, puis les découper |
| `export_assets` | poser une sélection dans un dossier |
| `list_models` | le catalogue et ses plafonds |
| `get_budget` | ce qui reste avant le plafond de la séance |

**Onze plutôt que neuf, et les deux ajouts tiennent à la même règle.**
`slice_asset` est sorti d'`edit_asset` parce que découper est **deux gestes
séparés** — proposer ne crée rien, découper coupe ce qu'on lui donne —, et qu'un
outil qui ferait les deux d'un coup fabriquerait huit assets à jeter sur une
détection ratée. `get_budget` existe parce qu'un plafond qui ne se consulte qu'en
le heurtant n'est pas un garde-fou : l'agent doit pouvoir regarder avant de
lancer un lot.

**Le serveur est monté sur l'application FastAPI, chemin `/mcp`**, et partage
l'unique `Atelier` du processus. C'est ce qui fait que ce que l'agent produit
paraît en direct dans la grille : un second processus aurait sa propre diffusion
et son propre écrivain sur le disque. Deux conséquences à connaître — le chemin
**exact** `/mcp` doit être corrigé avant le routage, un montage Starlette ne
reconnaissant que `/mcp/…` ; et l'en-tête `Host` est vérifié par le transport
contre le réattachement DNS, les deux noms de la boucle locale étant nommés et
rien d'autre.

**Un refus du produit franchit le protocole avec sa phrase.** Le SDK range toute
exception qu'il ne connaît pas en « crash » et retient son texte côté serveur ;
`ErreurAtelier` est donc traduite en refus attendu, exactement comme `CODES` dans
`api/app.py` lui donne son code HTTP. Même règle, deux protocoles : *un refus du
produit est une réponse, jamais une panne*.

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
| **Projet** *(= l'univers)* | nom, bible (sept champs nommés), planches de référence, palette extraite, réglages par défaut — dont la taille de pixel, qui accepte « aucune » | Chez SpriteCook le projet est un dossier. Ici il **contraint** — c'est la différence centrale. |
| **Collection** | nom, projet optionnel | Rangement à plat, comme SpriteCook : Projet › Collection › Asset, et rien d'autre. Une collection qui appartient à un projet **décide** du projet de ce qu'on y range ; une collection sans projet traverse les univers. |
| **Carte** *(tableau d'inspiration)* | type (image \| texte), contenu, groupe, note, provenance (URL, date), taille d'affichage, **position sur la toile**, **largeur libre**, **teinte** (une note seulement), **artwork officiel** oui/non, **famille** (personnages \| objets \| décors \| interface \| tous) | Deuxième famille d'images du produit. Ne s'exporte jamais, ne compte pas dans la bibliothèque. La **famille** décide de ce qui part en référence — voir §6.1. La **position** et la **largeur libre** sont arrivées en T8 : elles portent la place de la carte sur la toile, et ne se confondent pas avec la taille d'affichage — voir plus bas. |
| **Asset** | fichier(s), label, prompt, réglages résolus, dimensions mesurées, type, projet, collection, parent (filiation), favori, coût, date de suppression | Les dimensions **mesurées** font foi, jamais celles demandées. Le **coût** est une copie prise à la naissance, pour la tuile ; la génération reste la vérité, elle seule connaît les appels ratés. La **date de suppression** dure le temps de l'annulation, puis les fichiers partent. |
| **Génération** | statut, avancement, paramètres résolus, coût réel, résultats, réinjections, **prompt tel qu'il est parti** et s'il a été repris à la main. Pour un import : le nom du fichier, l'empreinte de ses octets, et si le traitement du projet lui a été appliqué | Un enregistrement par appel, y compris ceux qui échouent. Une **réinjection** est un identifiant d'asset et son rôle — jamais des octets : ils se relisent depuis l'asset au moment de l'appel, et de la relance. Le rôle `edition` donne sa filiation à ce qui sort. |
| **Lien** *(toile)* | ses deux extrémités, son mot, sa pointe | Ajouté en T9, et **le seul objet neuf du modèle depuis T4**. Le mot et la pointe naissent vides : un trait nu dit déjà « ceci a rapport avec cela », et c'est le cas courant — le défaut est muet, l'exception s'exprime. Une extrémité est soit une carte, par identifiant, soit un îlot, par nom de groupe : l'îlot n'a pas d'identité propre (voir plus bas). Un lien ne survit pas à ses extrémités. |

Ce tableau tient le modèle de la V1. **Les cinq entités de la V2** — plan de poses,
personnage, emplacement, pièce, calque — sont décrites en §7, et aucune ne modifie une
ligne ci-dessus : elles s'ajoutent, et le corps comme le calque rendu restent des assets
ordinaires.

**Pourquoi le personnage mérite une entité et pas un champ.** C'est la deuxième fois seulement
depuis T4 qu'on ajoute un objet au modèle — le lien de T9 était le premier —, et la barre doit
rester haute. Une étiquette sur l'asset aurait suffi à dire « ces images vont ensemble » ; elle
ne suffit pas à dire **ce qui manque**. Le personnage porte un plan de cases dont chacune est
vide ou pleine, et c'est cette liste de cases vides — que nul asset ne peut porter, puisqu'elle
décrit des images qui n'existent pas — qui fait l'entité. Le champ `groupe` de la carte avait
déjà échoué sur ce point en T8, pour la même raison : une étiquette n'a pas de forme, et ce qui
n'existe pas encore n'a rien à étiqueter.

### Ce que la toile ajoute au modèle

*Écrit le 27 août 2026 avec T8 et T9.* Deux tranches nées de l'usage, qui ajoutent une entité,
deux champs à la carte, et rien d'autre.

**L'îlot n'est pas une entité — il *est* le groupe.** Un îlot nommé sur la toile et un `groupe`
écrit sur une carte sont la même chose vue de deux endroits, et c'est ce qui interdit deux
rangements concurrents. Tirer une carte dans un îlot écrit son groupe, l'en sortir le vide :
composer et classer sont le même geste, dans les deux sens, et il n'existe aucun état où l'écran
et le disque divergent. La contrepartie est assumée — **un îlot vide n'existe pas**, puisqu'un
groupe sans carte n'a nulle part où être écrit. La teinte d'un îlot, elle, ne peut pas vivre sur
ses cartes : six cartes feraient six vérités possibles pour un seul îlot. Elle vit dans le fichier
du projet, une entrée par nom de groupe, et part avec le dernier membre. Une note est une carte
texte : elle porte sa teinte elle-même.

**Et elle vit sur le `Projet`, pas dans son `Univers`** — écrit en livrant T9, parce que « le
fichier du projet » laissait les deux ouverts. `Univers` est défini dans sa première phrase comme
*ce que le projet impose à ce qui rentre, et ce qu'il envoie avec* : une teinte d'îlot n'impose rien
et ne part nulle part, et l'y poser en aurait fait le premier champ à démentir cette phrase-là. Elle
voyage en revanche dans l'**enveloppe** du message `univers`, qui portait déjà `projet` et `nom`
sans qu'ils soient dans l'objet — un genre d'événement de plus pour un dictionnaire de six entrées
aurait fait un troisième canal sur un fichier qui en a un.

**La position et la largeur libre sont sur la carte, jamais dans un fichier de mise en page.**
Un `toile.json` par projet aurait exactement la panne qui a déjà valu son refus à `cartes.json`
(`atelier/depot/fichiers.py`) : relire, modifier, réécrire — deux gestes dans le même instant se
relisent tous les deux avant d'écrire, et le second efface le premier. Sur une toile ce n'est plus
une hypothèse, c'est le régime normal : on déplace vite et souvent. La carte porte sa place, et un
déplacement n'écrit qu'un fichier, le sien.

**La largeur libre n'est pas la taille d'affichage, et aucune des deux ne ment sur l'autre.** La
taille d'affichage est le cran 1× / 2× / 4× que lit la grille ; la largeur libre est une place
occupée sur un plan — continue, aimantée sur ces mêmes trois largeurs (`docs/DESIGN.md` § L'écran
Univers). Une valeur unique pour les deux aurait fait qu'agrandir une carte sur la toile change la
grille de tout le monde. La hauteur ne se stocke pas : elle suit le rapport de l'image.

**Posée n'est pas classée, et la réserve est la lecture de « ni l'un ni l'autre ».** Une carte peut
avoir une position sans groupe — c'est le brouillon, trois images côte à côte pour voir si elles
vont ensemble avant de décider qu'elles font un îlot. Le cas inverse existait avant la toile : une
carte groupée depuis T4 n'a jamais été déplacée, donc n'a pas de position ; elle se pose dans son
îlot à l'ouverture et n'écrit la sienne qu'au premier geste. Ce qui n'a **ni groupe ni position**
attend en réserve.

**Un fichier par lien, sous le tableau du projet** — `donnees/projets/<projet>/tableau/liens/<lien>.json`.
Deux raisons, et la seconde est un fait du code. La première est celle de la carte, mot pour mot :
écrire vite et souvent sans relire le tout. La seconde est que `parcourir_cartes` lit
`tableau/*.json` et tient pour une carte tout JSON qui porte un identifiant — poser les liens à
côté des cartes en ferait des cartes fantômes dans le tableau. Un sous-dossier, et la règle du
dossier reste vraie telle quelle.

**Pas d'index pour les liens, comme pour les cartes.** Ils ne se cherchent pas, ne se filtrent pas,
ne se paginent pas : une toile se lit en entier. Corollaire hérité — jeter `atelier.sqlite3` ne
touche ni au tableau ni aux liens, puisqu'ils n'y sont jamais entrés.

**Un lien meurt avec son extrémité, et c'est la suppression qui l'emporte, pas un balayage.**
`effacer_carte` efface déjà la carte et ses octets ensemble ; elle efface désormais aussi les liens
qui y aboutissent. Un trait vers rien ne représente rien, et une entrée morte sur le disque serait
une deuxième vérité qui attend son heure. Un îlot n'ayant pas d'existence propre, un lien vers un
îlot disparaît avec le dernier membre du groupe.

**La route qui les accepte est celle qui existe déjà.** `PUT /api/board/{carte}` porte depuis T4
les réglages qui se remplissent ensemble — groupe, note, taille — et T8 lui ajoute **la position et
la largeur**, sans en ouvrir une nouvelle. La raison est celle d'origine, renforcée : tirer une
carte dans un îlot écrit sa position *et* son groupe, et deux appels rendraient possible un état où
l'un est écrit et l'autre non — c'est-à-dire la divergence que toute la tranche est là pour
empêcher. Elle est appelée **à la fin du geste, pas pendant** : un glissement écrit une fois, au
relâchement, jamais à chaque image.

Les liens ont les leurs, sur le même préfixe et dans la même langue — chemins en anglais, charges
utiles en français : `POST /api/board/links` en pose un, `PUT /api/board/links/{lien}` lui donne
son mot et sa pointe, `DELETE /api/board/links/{lien}` le coupe. `GET /api/board` les rend **avec
les cartes**, comme il rend déjà les groupes : la toile se lit en un aller-retour, parce qu'elle
est le tableau — et il rend les **teintes** avec, pour la même raison.

**La teinte d'un îlot se pose par `PUT /api/board/groups/tint`, et le nom du groupe est dans le
corps.** Deux décisions, deux raisons. Le nom d'abord : un groupe est du texte libre, `nord/sud` en
chemin devient `%2F`, et un nom qui doit revenir intact ne s'encode ni dans un chemin ni dans une
clé composite — c'est le refus de `"ilot:nom"` qui a déjà donné `Bout(genre, valeur)`. Les **trois
segments** ensuite : à deux, `/board/tint` entre en concurrence avec `PUT /board/{carte}` et n'est
atteinte que si elle est déclarée avant, donc l'adresse dépendrait de l'ordre des fonctions dans un
fichier. Le dépôt a déjà payé un chemin qui ne s'atteint pas (`Mount("/mcp")`, voir
`docs/PIEGES.md`) ; à trois segments il n'y a plus d'ordre à respecter.

**Et `PUT /api/board/groups/move` déplace un îlot entier**, écrit le 28 août 2026 avec T10. Trois
segments pour la raison exacte de `tint`, et le nom du groupe dans le corps pour la même. Ce qu'elle
ajoute est une **cardinalité** : un îlot n'a pas de position à lui, donc le déplacer, c'est écrire la
place de chacune de ses cartes — et un appel par carte rendrait possible l'état où sept ont bougé et
cinq sont restées, un îlot déchiré en deux moitiés que personne n'a demandé. C'est « deux appels
pour un geste sont un état de trop » appliqué à un geste qui en aurait demandé douze. Elle exige
donc **toutes** les places de l'îlot et rien d'autre — un sous-ensemble en ferait un second
`PUT /board/{carte}` capable d'écrire des places en lot sous un nom de groupe qui ne les regarde
pas —, elle les vérifie **avant** d'écrire la première, et elle n'élague rien : aucun groupe ne
change, donc l'îlot garde ses liens et sa teinte. Les places sont **absolues et non un écart**,
parce qu'une carte groupée avant T8 n'a pas de position écrite : c'est l'ouverture qui lui en
calcule une, et un écart n'aurait rien eu à quoi s'ajouter pour elle.

**`PUT /api/board/{carte}` gagne le texte d'une note en même temps que sa teinte**, et ça comble un
trou de T4 : sans lui, corriger une faute demanderait de retirer la note et de la recoller — donc
de perdre sa place, sa teinte et les liens qui y aboutissent, c'est-à-dire tout ce que T9 vient
d'ajouter. Le trou ne s'était jamais vu parce qu'une note au bout d'une liste se retape sans rien
perdre.

**`POST /api/board/links` accepte un mot et une pointe, et c'est pour l'annulation seule.** « Il
naît muet » reste vrai : c'est une règle de l'**écran**, qui ne les envoie jamais en tirant un
trait. Mais défaire une coupe, c'est reposer le lien tel qu'il était — et une route qui ne saurait
reposer qu'un trait nu forcerait l'annulation à passer par un second appel, donc par un état où le
geste est à moitié défait. T8 a déjà tranché cette question : deux appels pour un geste sont un
état de trop.

**Et rien n'existe côté serveur pour l'annulation.** La pile de Ctrl+Z vit dans l'onglet et meurt
en quittant l'écran (`docs/PLAN.md` T8) : annuler, c'est rappeler la même route avec la valeur
d'avant. Une route d'annulation aurait fait de la composition un historique de projet — elle est le
rattrapage du geste en cours, et rien d'autre.

## 6 · V1 — l'atelier

Sept briques, et deux qui sont venues après, de l'usage. Objectif : une application
utilisable pour de vrai, sans aucune inconnue technique.

### 6.1 Contenu

| Brique | Ce qu'elle fait | Ce qu'elle ne fait pas |
|---|---|---|
| **Tableau d'inspiration** | Rassembler, trier, jeter. Cartes image **ou texte**. Entrée par collage (Ctrl+V, le geste principal), glisser-déposer, URL, fichier. Groupes nommés, note et provenance par carte, vignettes 1×/2×/4×. Promotion d'une carte en **artwork officiel**. **Deux vues sur la même matière depuis T8** : la grille, et une toile où une carte se pose, où l'îlot donne enfin une forme au groupe, et où un lien dit ce que la proximité ne dit pas. | Pas de mise en page automatique sur la toile : rien ne s'aligne, ne se distribue ni ne reflue tout seul. Pas de couleur sur une carte — l'îlot et la note seulement, sinon c'est un second rangement, invisible dans la grille et concurrent du groupe. Pas d'historique de composition : la pile d'annulation meurt avec l'écran. Pas de corbeille : suppression avec annulation courte. |
| **Univers** | Une bible en **sept champs nommés** (monde, époque, technique de rendu, trait, éclairage, vue et cadrage, contraintes techniques), chacun activable pour une génération. Les artworks officiels partent en guide de style à chaque appel. Palette extraite d'eux par calcul. Taille de pixel imposée à ce qui rentre, **ou aucune**. | Pas de description automatique du style. Pas de contrôle de conformité. Pas de consignes par type d'asset. Pas de texte libre à côté des champs. |

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
| **Détourage** | Remplissage depuis le bord par défaut — aucun modèle, aucun réseau ; `rembg` en second moteur facultatif. Une ou plusieurs passes, seuil alpha et durcissement du bord réglables à chacune. | Pas de détourage par couleur au seuil global : il perce les clairs du sujet. |
| **Slicer** | Découpe d'une planche multi-sprites par alpha connexe. Modes automatique, grille fixe, sélection manuelle. Correction à la main quand la détection se trompe. | Pas d'extraction de composants d'interface (c'est le UI Kit, hors périmètre). |
| **Export** | Téléchargement d'un PNG. Export d'une sélection en ZIP + JSON descriptif — **un geste, donc `services/`** ; `image/` n'en tient que la conversion en PNG. Ce qui part est le rendu, jamais le brut : le brut est ce qui permet de refaire le rendu, et il reste dans l'atelier. | Pas de paquet Unity/Godot prêt à importer. |
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
| **Univers** | tableau d'inspiration — grille **ou toile** —, bible, palette, réglages par défaut | au début d'un projet, puis ponctuel |
| **Atelier** | arbre · réglages · prompt · grille — le travail quotidien | permanent |
| **Fiche asset** | visionneuse, recette, filiation, actions | constant |
| **Découpe** | une planche multi-sprites, les rectangles qui en sortiront, leur correction à la main | ponctuel, sur une planche |
| **Réglages** | clé OpenRouter, garde-fous MCP, dossiers | rare |

- **La fiche asset est un panneau latéral**, pas une page. Une page ferait perdre la grille et
  le prompt ; fermer le panneau remet exactement où l'on était.
- **La découpe, elle, est un écran**, ajouté en T5, et pour la raison inverse : on y dessine
  des rectangles sur une image de mille pixels, et la fiche en fait 380. Il s'ouvre **depuis**
  la fiche — on découpe une image, jamais une sélection — et il couvre l'Atelier comme
  l'écran Univers, avec la même contrepartie : il porte sa propre fente de refus.
- **L'écran Univers passe à trois colonnes quand la toile est ouverte** : `380px · 1fr · 380px`,
  réglages de l'univers · toile · réserve, contre `380px · 1fr` en mode grille (`docs/DESIGN.md`
  § Layout). La troisième colonne n'introduit **aucune largeur nouvelle** — c'est la 380 de la
  fiche asset, réemployée pour ce qu'elle nomme déjà : la colonne de ce qu'on manipule. Elle
  n'introduit pas non plus une grille de plus : la réserve **est** la grille du tableau, filtrée
  sur ce qui n'a pas encore de place, ce qui laisse intacte la règle d'une seule grille dans tout
  le produit. Les réglages restent visibles pendant qu'on compose, et c'est la raison d'être de la
  colonne de gauche. La bascule est un segment dans la barre du tableau, pas un onglet : l'écran ne
  se dédouble pas, c'est la même matière regardée autrement.
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

**T8 la toile et T9 les liens et les notes** se sont ajoutées le 27 août 2026, d'une séance
d'essai sur le produit tenu. Elles ne s'intercalent nulle part : la chaîne de production s'arrête à
T7, rien avant elles ne les attend, et aucune tranche de la V1 ne change d'ordre. Elles sont nées
de l'usage et non du cadrage — la meilleure raison qu'une tranche puisse avoir, et la seule qui
autorisait à revenir sur le « pas de toile libre » écrit ici même la veille.

Ce que contient chaque tranche, les user stories qu'elle couvre, ses dépendances et ses
critères d'acceptation : **`docs/PLAN.md`**, qui fait foi sur l'ordre.

### 6.4 Critères d'acceptation de la V1

Distribués tranche par tranche dans `docs/PLAN.md`, chacun écrit là où il devient
vérifiable.

### 6.5 La dépendance de la toile

**`@xyflow/react`, ajoutée en T8.** L'interface avait deux dépendances d'exécution — `react`,
`react-dom` — et elle en a trois. Le fait mérite d'être écrit parce qu'il ne doit pas se
reproduire : tout le reste du produit est du châssis maison, et le rester est une décision
renouvelée, pas un état de fait.

Ce qu'elle fournit, et qu'on ne réécrit donc pas :

| | |
|---|---|
| **Le plan** | déplacement et zoom sous une transformation unique, et la conversion écran → plan dont chaque geste a besoin |
| **Le nœud** | position, glissement, sélection simple et multiple |
| **Le lien** | le tracé entre deux ancrages, son étiquette, sa pointe, et le fait qu'il suive ses extrémités quand elles bougent |

Ce qu'elle ne fournit pas, et qui reste entièrement au produit :

| | |
|---|---|
| **La carte** | un nœud est un emplacement ; ce qu'on y dessine est le composant du produit, sans un pixel d'écart avec la carte de la grille (`docs/DESIGN.md`) |
| **L'îlot** | il n'est pas un nœud de la librairie mais **une étendue calculée** — voir ci-dessous |
| **La persistance** | elle ne connaît ni fichier ni route. Ce qui s'écrit, quand, et par quel appel : §5 |
| **Le classement** | « poser dans un îlot écrit le groupe » est une règle du produit, et c'est le produit qui décide dans quel îlot une carte a été lâchée |
| **La poignée de largeur** | écrite à la main, parce que la toile ne retient que la **largeur** : un redimensionnement à deux dimensions rendrait possible une carte qui ment sur ce qu'elle montre |
| **L'annulation** | aucune pile fournie. Ctrl+Z, sa pile en mémoire et sa mort à la fermeture sont à écrire |
| **La réserve** | elle est hors du plan — c'est la grille du tableau. Le glissement qui traverse la frontière est du code maison |
| **La couleur, la typographie, la forme** | `docs/DESIGN.md` fait foi, y compris pour les six teintes d'îlot |

**L'îlot n'emprunte rien à la librairie, et cette ligne-là a été écrite deux fois.** Le premier jet
annonçait ici `parentId` + `extent: "parent"` comme « le mécanisme exact de tirer dans un îlot ».
Il ne l'est pas, et pour deux raisons qui se sont vues à l'exécution le 28 août 2026. La première :
`extent: "parent"` **enferme** l'enfant dans son parent — il interdit très exactement « sortir une
carte de son îlot », qui est un critère de la tranche. La seconde est la plus profonde : un nœud
parent porte sa propre position, donc l'îlot deviendrait une entité, avec un fichier et une place à
lui — c'est-à-dire le second rangement que §5 refuse dans sa première phrase. **Un îlot est
l'étendue de ses membres, calculée à chaque rendu**, et il n'existe donc aucun état où l'écran
montrerait un rangement que le disque ne dit pas.

**Et les dimensions de chaque nœud sont données, jamais laissées à mesurer.** La librairie rend
`visibility: hidden` un nœud dont elle ne connaît pas la taille, et elle l'apprend par un
`ResizeObserver` — *qui ne livre rien à un onglet qui ne compose pas ses images* (`AGENTS.md`,
mesuré en T5). Toute la toile y était invisible. Le produit calcule ces tailles de toute façon,
puisque l'étendue d'un îlot est celle de ses membres : il les lui donne. Même cause pour le cadrage
d'ouverture, qui se calcule sur une largeur lue à la demande plutôt que sur celle que la librairie
croit avoir.

**T9 a déplacé la frontière d'un cran, et dans le sens du produit.** La ligne « Le lien » du
tableau ci-dessus annonçait que la librairie fournirait « le tracé entre deux ancrages, son
étiquette, sa pointe, et le fait qu'il suive ses extrémités ». Elle fournit l'étiquette — rendue à
l'échelle du plan —, la zone d'écoute de 20 px le long d'un trait de 1 px, et le calque où tout ça
se pose. Elle ne fournit **pas** le tracé, et c'est mesuré, pas préféré :

- **Elle refuse de résoudre une arête dont les nœuds ne sont pas « initialisés »**, et
  `isNodeInitialized` exige `internals.handleBounds` — mesuré sur le DOM des ancrages par un
  `ResizeObserver`. *Qui ne livre rien à un onglet qui ne compose pas ses images.* Aucun trait ne
  paraissait, sans un mot. Quatrième fois que ce piège se referme ici (T5, T6, T8, T9), et un cran
  plus bas que la précédente : T8 avait donné à chaque nœud ses dimensions, il fallait aussi lui
  donner ses **ancrages** — le champ existe (`node.handles`), et la librairie s'en sert au lieu de
  mesurer.
- **Et son calcul de position lit `measured`**, qui vaut zéro pour la même raison : les deux boîtes
  étaient vides, donc le trait partait du coin supérieur gauche de chaque objet. La réponse est la
  formule de T8 appliquée aux arêtes — **position mesurée, taille donnée** : la position vient de la
  librairie parce qu'elle bouge pendant qu'on tire une carte, la taille vient du produit parce qu'il
  la calcule de toute façon.

Le tracé est donc une fonction pure du produit, `ancrer(depart, arrivee)`, qui rend les deux points
où le segment joignant les centres croise chaque boîte. **C'est aussi ce qui permet à un îlot d'être
une extrémité sans avoir d'identité** : son étendue est déjà calculée, puisqu'elle est celle de ses
membres. Un ancrage qu'il aurait fallu *mesurer* aurait exigé qu'il soit un objet — §5 se referme
sur §6.5.

Deux réglages de la librairie sont **éteints, et ça se dit**, parce que leurs défauts prennent des
gestes que T9 utilise : `zoomOnDoubleClick` (défaut `true` — le double-clic écrit une note, il ne
peut pas aussi zoomer) et `connectOnClick` (défaut `true` — un clic sur le nom d'un îlot ouvre son
menu ; un lien se tire, il ne se clique pas). Et `deleteKeyCode={null}`, hérité de T8, cesse d'être
un héritage le jour où il y a de vraies arêtes : sans lui, la touche Suppr couperait un lien sans
passer par la route ni par la pile d'annulation.

**Le partage est net, et c'est ce qui rend la dépendance acceptable : elle tient la surface, le
produit tient la matière.** Le jour où elle gênerait, ce qu'on perdrait est du geste — un plan, un
glissement, un trait — jamais un objet, jamais un fichier, jamais une règle. C'est la ligne que
`fournisseur/` défend ailleurs, obtenue ici sans écrire de port : le modèle ne connaît pas la
librairie, et la librairie ne connaît pas le modèle.

Licence MIT, comme le reste de la chaîne d'interface.

## 7 · V2 — Le personnage et son équipement

Un personnage, ses poses, et les pièces qu'il porte. **C'est ici que se joue la valeur du
projet** : la V1 fabrique des images une par une, la V2 fabrique un personnage cohérent
d'une pose à l'autre — ce que l'analyse de SpriteCook désigne comme sa meilleure idée
technique, et l'entrée obligatoire de la V3.

Passée devant les tuiles le 28 août 2026, sur deux essais payés qui ont levé les deux doutes
qui la retenaient : un jeu de poses tient dans une seule image sans que la grille de pixels
dérive (`essais/essai_grille.py` — dérive médiane 1,00× dans un appel, contre 2,5× entre
deux), et une pièce **contenue dans la silhouette** s'extrait d'un corps habillé sans qu'un
pixel du corps soit repeint (`essais/essai_silhouette.py` — 0,3 % sur les jambières, 0,8 %
sur le casque, six modèles et deux jets). Le même essai a montré la limite, et elle est
écrite dans le produit : une pièce qui **agrandit** la silhouette casse la méthode sur les six
modèles sans exception — voir plus bas.

**Le coût annoncé avant de générer est mesuré, jamais lu dans un tarif.** Le produit ne
porte aucun prix de catalogue et ne doit pas en porter : le coût réel facturé fait foi
partout ailleurs, et l'essai du 28 août a relevé un écart de 1 à 4,6 entre modèles avec un
favori pressenti qui était le plus cher. Ce que l'écran annonce est donc la **médiane de ce
que ce modèle-là a réellement facturé sur cette machine**, et « jamais appelé » quand il n'en
sait rien — le même geste que l'attente de la jauge de T1, qui s'apprend au lieu de s'écrire.

**Le corps naît dans l'atelier, et nulle part ailleurs.** Il n'y a pas d'écran de création de
personnage avec son propre prompt — c'est la décision qui remplace l'assistant en quatre
étapes écrit ici le 26 août. On écrit un sujet, on génère, on obtient une image, et c'est
cette image qu'on désigne comme corps. L'unité manipulée reste l'image de corps : un
personnage est un nom, une description, et un plan de cases dont chacune attend ou contient
une image dont on connaît déjà la grille et la palette.

### Ce que la version ajoute au modèle

| Entité | Contenu | Note |
|---|---|---|
| **Plan de poses** *(projet)* | liste de poses, chacune un identifiant, un nom et un nombre d'images | Propriété du **projet**, et **il n'y en a qu'un** — voir plus bas. Un projet neuf en reçoit un par défaut, immédiatement utilisable. Ajouter une pose ajoute une case vide, jamais une génération. Une pose porte un **identifiant** distinct de son nom : elle se renomme à tout moment, et les images déjà faites ne doivent pas perdre leur case. |
| **Personnage** *(projet)* | nom, description, **poses écartées**, concept arts désignés, références écartées | Un fichier par personnage sous son projet — ni index, ni entrée dans `atelier.sqlite3`. Sa suppression suit la règle générale : jamais de cascade, les images survivent et affichent « personnage supprimé ». |
| **Emplacement** *(projet)* | nom, rang | Ordonné — la tête, le dos, les jambes. Écrire un nom qui n'existe pas le crée. |
| **Pièce** *(projet)* | nom, description, emplacement, **portée** (contenue \| agrandit), concept arts désignés | Décrite une fois sur le projet, posée sur n'importe quel personnage. La **portée** est déclarée par l'auteur, jamais devinée : elle décide si la pièce donne un calque ou un corps habillé. Défaut : contenue. |
| **Calque** *(personnage)* | planche payée d'origine et sa case, recette (recherche de différence, zone, masque, retouches pixel), pièce, **pose**, mesures | **Une recette, pas un fichier figé** — exactement comme la retouche d'un asset ordinaire en T2. Revenir à la différence brute est un geste unique. La **pose** n'est pas une provenance, c'est une appartenance : un calque ne vaut que sur la pose où il est apparu. |

Aucun de ces objets n'est une image de plus : le corps et le calque rendu sont des assets
ordinaires, rangés dans la même bibliothèque, avec la même filiation et le même coût.

**Trois décisions prises en construisant C1, et qui corrigent ce tableau.**

**Un seul plan par projet, et il n'a pas de nom.** Cette section en prévoyait plusieurs,
nommés, entre lesquels chaque personnage aurait choisi. C'est inutile tant qu'un personnage
peut **écarter** les poses qu'il ne tient pas (US-117) : un figurant et un héros se comparent
alors au même plan, l'un en cochant moins de cases. Deux façons concurrentes de dire « ce
personnage n'a pas besoin de ça » — sa liste et ses cases décochées — auraient fini par se
contredire. Le nom reviendra avec le second plan, s'il vient.

**Le personnage range ce qu'il *écarte*, jamais ce qu'il tient.** À l'écran on coche des
poses tenues ; le fichier garde le complément. Le sens est le même, la panne évitée ne l'est
pas : ajouter une pose au plan doit ajouter une case vide à *chaque* personnage, et avec une
liste de poses tenues il aurait fallu réécrire tous les personnages du projet à chaque
ajout — un balayage capable de réussir à moitié, pour un geste qui ne devrait rien écrire du
tout. Avec l'écart, la case neuve paraît partout sans qu'un seul fichier soit touché.

**La case n'est pas un objet : c'est l'image qui dit sa case.** L'asset porte `personnage` et
`pose`, hérités de sa génération à la naissance comme il hérite du projet et de la
provenance ; la matrice se **calcule** là-dessus. Il n'existe donc nulle part une liste de
cases pleines à tenir d'accord avec le disque : une image supprimée vide sa case toute seule,
et supprimer un personnage n'a rien à défaire — l'image reste, marquée `personnage_supprime`,
exactement comme un enfant survit à son parent. C'est la règle « un état dérivable ne se
garde pas en double », et c'est aussi ce qui rend vraie sans effort la promesse « jamais de
cascade ».

**Corollaire sur le port** : un personnage qui franchit le port porte **toujours** ses cases,
que ce soit par la réponse d'un appel ou par l'annonce du flux. Elles ne sont pas dans son
fichier — elles se déduisent —, mais une charge amputée remplacerait, à l'écran, un objet
entier par un objet à trous. Payé le 28 août 2026 (`docs/PIEGES.md`).

### Le pliage — la fonction générale de l'atelier

Le pliage est **une ruse d'appel, pas un format de livraison**. On demande N images dans une
seule planche, on paie un appel au lieu de N, et la planche est dépliée toute seule en N
images séparées. Ce qui sort du produit, ce sont ces images-là et leur descriptif — jamais la
feuille assemblée.

Ce n'est pas un dispositif du lot de poses : **c'est la manière dont l'atelier habille ou
transforme N images d'un seul appel**, sur une grille carrée dont il connaît la géométrie case
par case. La V2 en a deux usages — le lot de poses (créer N corps) et la planche d'équipement
(habiller N corps) —, et le découpeur de T5 sert les deux. Ce qui change entre eux tient en un
mot : le lot de poses part d'une grille **vide** et l'application ne connaît pas ce qui va
revenir ; la planche d'équipement part d'une grille **qu'elle a composée elle-même**, donc
elle connaît exactement l'avant de chaque case. C'est cette base connue qui rend la différence
solide, et non devinée.

Le gabarit de cases vides devient donc une pièce du produit et pas un accessoire d'essai :
mesuré le 28 août 2026, le compte revient exact 11 fois sur 12 avec gabarit contre 9 sur 12
sans. Deux pièges mesurés le même jour l'accompagnent, et sont traités plus bas : un modèle
recopie les traits du gabarit dans l'image, et deux planches sur vingt-quatre ont répété une
pose sans que le compte en souffre.

- **La taille du lot est le choix de l'auteur.** Le produit annonce ce que ça coûte et ce que
  ça risque ; il ne plafonne pas.
- **Tout ou rien sur le compte, indépendant sur le reste.** Si le nombre d'images revenues ne
  correspond pas au nombre demandé, rien n'entre et le lot se relance d'un geste. Si le compte
  est bon, tout entre, et chaque pose devient jugeable et régénérable seule.
- **Aucune autre mesure ne peut refuser un lot.** Ressemblance, dérive de grille, netteté :
  elles s'affichent toutes, elles n'empêchent jamais de garder.

C'est le seul refus automatique de la version, et il est arithmétique — c'est ce qui le rend
tenable.

**Où il vit, et ce que la construction de C2 a tranché.** Le pliage est un module pur —
`atelier/image/pliage.py`, le gabarit et les deux mesures — et un service —
`atelier/services/pliage.py`, plier et déplier. La coupure est celle du slicer de T5 : un
calcul pur se rejoue à l'identique et se mesure au banc, une écriture sur disque non. **Ni
l'un ni l'autre ne connaît personnage ni pose**, et ça se lit dans leurs imports : ils parlent
de *cases*, et c'est le service de génération — le seul qui sache déjà relier un appel à une
case — qui les compose. C'est ce qui laissera C3 le réemployer sans le rouvrir.

- **La planche payée n'est pas un asset.** Elle reste le brut de sa génération, et seules les
  N images séparées entrent en bibliothèque : « ce qui sort du produit, ce sont des images
  séparées » devient vrai *par construction* au lieu d'être un filtre d'export à tenir. Elles
  vivent aux rangs 100 et suivants dans le dossier de la génération, comme les découpes de T5
  et protégées par le même piège du tiret dans le glob de suppression. Prix assumé : les N
  corps n'ont pas de `parent` — c'est la génération qui les relie.
- **Un compte faux est un emplacement échoué**, avec sa raison et son coût. La relance de T1
  s'applique alors telle quelle, au prix plein, sans qu'aucun état neuf soit inventé.
- **Le gabarit ne s'enregistre nulle part** : il se redessine depuis la géométrie, à la
  soumission comme à la relance, donc les deux envoient exactement la même chose. Il compte en
  revanche comme une référence — plafond du modèle, et facture chez ceux qui facturent au
  token —, et l'écran le dit.
- **La reprise d'un lot est un rangement, jamais une relance.** Une planche payée et reçue que
  la fermeture a laissée non dépliée se déplie au démarrage, gratuitement et sans appeler
  personne ; ce qui a été coupé *en vol* reste marqué interrompu et attend un geste, comme
  depuis T1. Les deux moitiés sont écrites côte à côte pour qu'on ne les confonde jamais.

### Le calque par différence, sur une planche d'équipement

Une pièce se fabrique **par différence, sans repère ajouté**. Rien n'est ajouté à l'image
envoyée pour aider le recalage — ni ancre, ni mire, ni silhouette — et le corps d'origine
n'est jamais modifié.

Ce qui part n'est pas un corps, c'est **une planche que l'application a composée elle-même** :

1. l'auteur coche les poses qu'il veut habiller, parmi celles qui ont déjà un corps ;
2. l'application range ces corps sur une grille carrée dont elle connaît la géométrie case par
   case, et les cases en trop restent vides ;
3. elle envoie la planche avec « la même planche, avec la pièce en plus, ne touche à rien
   d'autre » ;
4. elle redécoupe le retour sur **la même** grille — le découpeur de T5 fait déjà la moitié du
   travail ;
5. case par case, elle compare l'avant qu'elle connaît exactement et l'après ; chaque
   différence est un calque, **propre à sa pose** ;
6. l'auteur rattrape à la main ce qui tombe faux.

**N calques pour un appel payant au lieu de N.** Et la comparaison part d'une base connue au
lieu d'être devinée, ce qui est plus solide que la méthode une-pièce-un-corps.

La zone est **facultative et rejouable** : par défaut la différence est cherchée sur toute la
case ; la restreindre, la déplacer, la retailler sont des étapes de la recette, qui ne
redemandent jamais d'image au fournisseur.

**Un calque est solidaire de sa pose.** Un casque vu de face n'est pas un casque vu de dos : il
faut un calque par pose, et pour huit frames d'un cycle de marche, huit calques. Ce n'est pas
une limite technique à lever, c'est une évidence de dessin. Ce que le pliage divise, c'est le
nombre d'appels payants — jamais le nombre de calques. Le produit ne propose donc jamais de
reposer un calque ailleurs que sur la pose où il est apparu.

**Une pièce contenue, une pièce qui agrandit.** C'est la seule limite de méthode de la version,
et elle est mesurée, pas pressentie. `essais/essai_silhouette.py`, six modèles et deux jets :

| Pièce | Silhouette retrouvée | **Corps repeint** | Ajout | Échelle au retour |
|---|---:|---:|---:|---:|
| Jambières | 99,5 % | **0,3 %** | 2,3 % | 1,00 |
| Casque | 99,2 % | **0,8 %** | 6,1 % | 0,96 |
| **Cape** | 100,0 % | **23,5 %** | 203 % | **0,62** |

La colonne qui décide est *repeint*, pas *silhouette* : une silhouette à 100 % avec 23 % de
repeint veut dire que le modèle a gardé la forme et redessiné l'intérieur. Et la planche
contact donne la cause : le modèle **dézoome le personnage** pour faire tenir la cape dans le
cadre. À 0,62, il n'y a plus de différence à calculer — remettre à l'échelle rééchantillonne le
pixel art d'un facteur 1,61 et détruit la grille avant même la comparaison.

Le produit en tire une règle, portée par la **portée** que l'auteur déclare sur la pièce :

- **contenue** (casque, jambières, ceinture, gants, plastron) → la différence, telle quelle ;
- **qui agrandit** (cape, ailes, arme longue, sac à dos, monture) → la planche part sur une
  toile avec marge pour que la pièce ait la place ; si l'échelle revient malgré tout
  différente de celle envoyée, **aucun calque n'est fabriqué**. Le produit nomme la dérive et
  garde ce qui revient comme des **corps habillés** — des images de corps ordinaires,
  utilisables et exportables, mais qui ne s'empilent pas.

Ce n'est pas un refus au sens de T2 : rien n'est jeté, l'appel payé reste acquis, et la seule
chose que le produit refuse de faire, c'est prétendre qu'un calque faux en est un.

### La matrice de production

Deux axes — les poses d'un côté, les emplacements de l'autre —, des vignettes dans les cases,
les cases vides visiblement vides. **Ce n'est pas la grille de la bibliothèque** : ni
recherche, ni filtres, ni sélection multiple. Elle ne rompt donc pas la règle d'une seule
grille dans tout le produit, pas plus que la réserve de T8 ne l'avait rompue. On y voit ce
qui manque, et on lance depuis là.

**En C1 elle n'a qu'un axe — les poses.** Le second, les emplacements, n'a rien à montrer
avant que la pièce existe : il arrive avec elle, en C3. Une colonne vide affichée d'avance
serait du cadrage montré à la place du geste — le reproche qui a fait écarter la maquette.

**Et « lancer depuis là » veut dire *armer*, pas payer.** Cliquer une case vide remplit le
prompt de l'atelier avec le signalement du personnage et le nom de l'attitude, retient la
case visée, et rend la main : c'est le bouton Générer de l'atelier qui dépense. Il n'existe
donc **qu'un seul endroit d'où l'on paie** dans tout le produit, et « le corps naît dans
l'atelier et nulle part ailleurs » reste vrai au pied de la lettre. La case visée se voit
jusqu'au départ, dans une bande au-dessus du prompt, et se désarme dès que l'appel est parti :
une intention qui survivrait à son geste enverrait l'image suivante — un tonneau, un décor —
dans la case d'un personnage.

### Ce que la V2 n'est pas

Ni squelette, ni os, ni interpolation entre deux poses — c'est la V3. Ni salle d'essai
montrant le personnage équipé dans un décor. Ni bibliothèque de poses partagée entre projets :
le plan appartient au projet qui le porte. Ni génération d'une pièce seule sur fond vide : une
pièce n'existe qu'apparue sur un corps. Ni calque unique porté sur toutes les poses. Ni
combinaison de deux pièces qui agrandissent sur le même corps : deux corps habillés ne
s'empilent pas. Ni détection automatique de ce qui agrandit la silhouette : l'auteur déclare.

### Deux pièges mesurés, et ce que le produit en fait

**Le gabarit recopié.** Un des six modèles rend les traits du gabarit de découpe dans l'image :
la planche est juste, mais elle arrive tramée. Un autre l'ignore comme demandé. Le projet porte
donc **deux défauts de modèle** — produire une planche, éditer un corps — et non un seul, sans
que l'auteur ait à y penser au moment de générer. Ils sont posés en C2 sur l'univers, en deux
champs nommés et **hors du dictionnaire `modeles`** : celui-là est indexé par *famille de
sujet* — ce qu'on fabrique —, et ceux-ci répondent à une autre question, *quelle sorte d'appel
on fait*. Trois niveaux décident donc du défaut, sans trou : le modèle de planche quand un lot
est armé, sinon la famille du sujet, sinon le catalogue.

**La planche redondante.** Deux planches sur vingt-quatre ont répété la même pose. Le compte
était bon, donc le contrat était tenu, donc rien n'a refusé — et c'est correct : le compte
d'images reste le seul refus automatique du produit. Mais la ressemblance entre cases d'un
même lot est mesurée et montrée case par case, et la pose qui n'apporte rien se relance seule.
Un compte juste peut donner une planche sans valeur ; le produit ne le cache pas.

### Le risque de la version

**La toile avec marge n'a jamais été essayée.** Ce document a porté un temps « le report d'un
calque sur une autre pose » comme risque principal. C'en était un faux : un calque est
solidaire de sa pose, c'est une évidence de dessin, et il ne fallait pas le promettre — le
risque disparaît avec la promesse, et le pliage rend le prix acceptable de toute façon.

Ce qui reste réellement non mesuré tient en une hypothèse : **donner de la place au modèle
l'empêcherait de dézoomer** sur une pièce qui agrandit la silhouette. C'est une idée
plausible, pas un résultat. Elle se teste en un appel payant, et ce test appartient à C3. Si
elle ne tient pas, la pièce qui agrandit se rabat sur le corps habillé — ce que le produit sait
déjà faire par construction — et rien d'autre ne bouge. **Gravité faible, donc, là où la
précédente rédaction en annonçait une élevée** : le repli est déjà écrit.

Le découpage en tranches, les user stories et les critères : **`docs/PLAN.md`**, qui fait foi
sur l'ordre.

## 8 · V3 — Animation de sprites

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

## 9 · V4 — Tileset autotile

Génération d'atlas de tuiles qui se raccordent. Lourd mais **déterministe** : aucune
inconnue, seulement du post-traitement précis.

- Perspectives : top-down, plateforme, isométrique.
- Jeux de pièces : 15-pièce (4×4), 17-pièce (5×4), autotile-16 plateforme.
- Recalage sur grille, découpe, assemblage en atlas, aperçu de raccord.
- Sortie : PNG + JSON de mappage.

Point d'attention relevé chez SpriteCook : aux petites tailles (16 et 32 px), le
modèle génère **plus grand** que la sortie finale, puis on recale et on découpe.
Générer directement à la taille cible ne marche pas.

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
| **La recette d'animation n'existe pas** | élevée | prototypage dédié avant la V3 — **piste sérieuse trouvée**, voir §8 |
| ~~Un calque ne se repose pas sur une autre pose~~ | — | **retiré le 28 août 2026 : ce n'était pas un risque, c'était une promesse fausse.** Un casque vu de face n'est pas un casque vu de dos ; un calque est solidaire de sa pose et il en faut un par pose. Ce qui l'a remplacé — la planche d'équipement pliée, N calques pour un appel — rend le prix acceptable sans rien promettre qu'on n'ait mesuré. Voir §7 |
| **La toile avec marge n'a jamais été essayée** | faible — le repli est déjà écrit | **en C3, en un appel payant.** L'idée que donner de la place au modèle l'empêche de dézoomer sur une pièce qui agrandit la silhouette est une hypothèse, pas un résultat. Si elle tombe : la pièce qui agrandit se rabat sur le corps habillé, ce que le produit sait déjà faire, et rien d'autre ne bouge |
| ~~Le bon modèle pour une planche n'est pas le bon pour une édition~~ | — | **traité le 28 août 2026, pas seulement mesuré.** Un modèle recopie les traits du gabarit de découpe et rend la planche tramée, un autre l'ignore. Le projet porte donc **deux** défauts de modèle — planche, et édition d'un corps — sans que l'auteur ait à y penser. Passé en décision produit, ce n'est plus un risque ouvert |
| ~~Aucun fournisseur ne préserve l'identité~~ | — | **levé le 26 août 2026.** `gemini-3.1-flash-image` tient l'identité et la dérive entre deux poses enchaînées est quasi nulle. Seedream 4.5 échoue sur ce point mais excelle au transfert de style. |
| **L'échelle du sujet dérive d'une génération à l'autre** | moyenne — bloque le montage d'animations | constaté le 26 août. Corrigé par le recadrage et la normalisation d'échelle, qui passent donc de « confort » à **obligatoires** |
| ~~La couverture image d'OpenRouter~~ | — | **levé le 27 août 2026** par `essais/essai_couverture.py` : 48 modèles image, 11 fournisseurs, 31 acceptant trois références ou plus. Et le catalogue a bougé en un jour — 47 → 48 — ce qu'une liste en dur n'aurait pas vu |
| **Le coût par image dérive** | moyenne | enregistrer le coût réel de chaque génération dès la T1, et le totaliser par projet |
| ~~La qualité pixel art directe~~ | — | **levé le 27 août 2026** par `essais/essai_pixel.py`, sur 44 images de six modèles et sans un appel : aucune sortie brute n'a de transparence, la médiane est à 33 986 couleurs, et la grille rendue va de 7 à 20 px — facteur 2 **à l'intérieur d'un même lot**. Après traitement : 27 couleurs, alpha franc, grille imposée, 0 sujet perdu sur 44, 0,17 s par image. La question s'est retournée : le post-traitement n'est pas un supplément qui doit prouver son apport, c'est ce sans quoi rien n'est utilisable |

~~Le deuxième risque est le plus sournois~~ — il a été levé le 26 août, avant même
d'écrire la bibliothèque, exactement comme prévu ici. ~~Le sournois, désormais, c'est le
report d'un calque sur une autre pose~~ — **et celui-là n'a jamais existé.** Il a été écrit ici
le 28 août au matin par extrapolation, et retiré le soir même : reposer un casque de face sur
une pose de dos n'est pas un pari technique qui pourrait tenir, c'est une chose qui ne marche
pas et qu'aucun essai n'aurait sauvée.

**La leçon vaut mieux que le risque.** Ce faux risque est né d'une confusion entre *ce que
l'essai a mesuré* et *ce qu'on aurait aimé qu'il mesure* — l'essai prouvait l'extraction, on
en a déduit le report. La même séance a produit la même faute une seconde fois, dans la
conclusion imprimée de `essais/essai_silhouette.py` : une médiane sur trois pièces annonçait
que les six modèles tenaient les seuils, alors que la cape échouait sur les six. **Une moyenne
efface le seul cas qui décide.** Les deux sont corrigés ; ce qui reste à surveiller, c'est le
geste, pas le chiffre.

## 12 · Ce qu'on récupère

| Source | Pièce | Usage |
|---|---|---|
| GAG | `gag/domaine/direction.py` | extraction de palette, luminance, saturation |
| GAG | `gag/ports/`, `gag/adaptateurs/` | la forme du port fournisseur, allégée |
| GAG | AD-5, AD-9, AD-11, AD-28 | index jetable, post-traitement hors GPU, vocabulaire confiné |
| MySpriteAi | `src/lib/pixelPipeline.ts` | **porté en T2**. Les décisions dedans étaient durement acquises et elles sont reprises telles quelles : durcir l'alpha à 128 **avant** la réduction, et ne jamais forcer l'alpha à 255 en quantifiant — les deux moitiés du même liseré clair. Écarté au passage : le k-means++ de la palette, qui tire son initialisation au sort et rendrait deux images différentes pour une même recette nommée |
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
