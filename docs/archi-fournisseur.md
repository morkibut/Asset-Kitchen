# Asset Kitchen — Le fournisseur, les modèles, et ce qu'ils ont coûté à apprendre

L'adaptateur unique, ce que le catalogue déclare, ce que deux bancs payés ont mesuré, le
contrat de génération et les seize outils du serveur MCP. La section garde son numéro —
**§4 bis** — parce que sept renvois la nomment ainsi.

L'essentiel de ce fichier est un **relevé** : des tableaux de coûts et de qualité datés,
des pièges de fournisseur vérifiés par appel, et une leçon qui vaut plus que les chiffres —
*ne jamais conclure d'un banc dont le protocole n'est pas le geste réel du produit*. Un
relevé se consulte quand on rouvre la question du modèle ; il ne se lit pas au démarrage.

**`docs/ARCHITECTURE.md` fait foi sur la construction**, et garde les décisions que
ce relevé a dictées : le catalogue décide plutôt qu'une liste en dur, et un seul modèle par
défaut.

> **« Un seul adaptateur » a été révisé le 1<sup>er</sup> septembre 2026** par la tranche `F1`,
> et pour une raison qui n'est pas celle de ce relevé-ci : lui parlait de **couverture** — 48
> modèles de 11 éditeurs derrière un seul jeu de paramètres —, et sur cette question-là sa
> conclusion tient toujours. Ce qui l'a renversée est le **prix**. Tout ce que ce document dit
> d'OpenRouter reste vrai d'OpenRouter ; il ne dit simplement plus tout le produit. La suite
> est portée par `docs/ARCHITECTURE.md` § 4 et par `docs/tranches/V2.2.md`, sous le titre de
> l'étape.

---

## 4 bis · Fournisseur et modèles

L'adaptateur OpenRouter (`https://openrouter.ai/api/v1`), **qui a été le seul jusqu'à `F1`**.
Relevé du 26 août 2026, recompté le 27 : **48 modèles image, 11 fournisseurs**
(`essais/couverture.json`). Ce que ce paragraphe décrit reste vrai de lui, et Pollinations —
le second, arrivé le 1<sup>er</sup> septembre 2026 — a sa fiche dans
`docs/archive/releve-fournisseurs.md`.

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
- **Ce qu'un appel a consommé revient avec l'image, unité comprise** (F2). L'adaptateur lit
  la quantité **dans la réponse** — `usage.cost` chez OpenRouter, l'en-tête
  `x-usage-total-tokens` chez Pollinations — et nomme son unité. Quand la réponse n'annonce
  rien, la quantité est **zéro** : c'est ce que la réponse dit, et un chiffre de repli serait
  un chiffre que personne n'a mesuré. Le cas se produit vraiment — une image servie du cache
  de Pollinations n'annonce ni son modèle ni son usage.
- **Un fournisseur déclare aussi son *compte*** (F2) : son unité, ce qu'il alloue s'il alloue
  quelque chose, d'où viendra le chiffre de ce qui reste, et sa cadence minimale entre deux
  appels. **Il ne dit jamais ce qui est parti** — ça se compte dans le produit, sur les
  générations, et l'écran doit pouvoir écrire *compté ici* à côté du chiffre. Un adaptateur
  qui rendrait « il reste 42 » sans dire d'où il le tient enfreindrait l'invariant de la
  V2.2 : *un chiffre de réserve dit toujours s'il est relevé chez le fournisseur ou compté
  ici*. Le plafond est **facultatif**, et il manque chez les deux fournisseurs du produit.

### Serveur MCP — outils et garde-fous

> **Extension décidée le 11 septembre 2026.** Le périmètre décrit ci-dessous est celui
> des outils historiques. Le parcours de production animé demandé pour l'agent Godot
> et son cadre par capacité sont définis dans `docs/archi-atelier-unifie.md` ; ils restent
> à construire. L'ancienne idée « l'agent explore, l'interface seule produit » ne limite
> plus le produit cible. Les garde-fous actuels restent appliqués jusqu'à leur migration.

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
| `preview_output` | voir ce qui serait écrit dans le dossier du jeu, marque par marque — rien n'est posé (`RP17`) |
| `list_models` | le catalogue et ses plafonds |
| `get_budget` | ce qui reste avant le plafond de la séance |
| `list_characters` | qui il y a, ce que le plan réclame, ce qui manque, et le vestiaire |
| `add_pose` | ajouter une attitude au plan du projet |
| `generate_pose` | remplir une case, ou N d'un seul appel plié |
| `equip_character` | poser une pièce sur des poses qui ont un corps |
| `write_output` | écrire dans le dossier du jeu ce que l'aperçu annonçait — tout le jeu, une famille, ou un seul sujet avec son descriptif (`RP17`) |

**Seize depuis C5, et les cinq ajouts sont la boucle de la V2** : lire ce qui manque,
compléter le plan, remplir, habiller, livrer. Aucun ne fait ce que l'écran ne fait pas —
chacun appelle le service que l'écran appelle, jusqu'au sujet du prompt, qui est composé par
`ServiceProduction.sujet` et non par la façade.

**Ce qui n'est délibérément pas exposé : les gestes de finesse de C4.** Borner une zone,
affiner un masque, retoucher au pixel demandent un œil sur l'image ; un agent qui bornerait
un calque à l'aveugle abîmerait ce que la mesure vient de produire, sans que rien ne le lui
dise. L'invariant tient dans le sens qui compte — *aucun geste que l'écran n'a pas* —, et il
ne dit pas l'inverse.

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
| Modèle d'exploration imposé au MCP (`Pollinations:sana`, sans option) | activé | **parmi les gratuits**, ou désactivé |

Raison du second : un agent qui code a besoin d'un visuel correct tout de suite, pas d'un
asset final. Rapport de six sur le coût du travail agentique, pour une perte de qualité qui
ne compte pas à ce moment-là. La version de production se regénère depuis l'interface.

> **Révisé le 1<sup>er</sup> septembre 2026 par `F6`.** Le modèle imposé était
> `gpt-image-2` en `quality: low` — payant, d'où le rapport de six. Il est désormais celui du
> fournisseur qui ne facture rien, et le rapport devient la totalité : *une séance de code
> entière ne fait plus bouger le total en argent*. Le réglage ne propose que des modèles
> gratuits, ce qui est ce que le garde-fou **est** plutôt qu'un filtre d'affichage ; pour
> imposer un payant, on l'éteint et l'agent nomme ce qu'il veut. Ses options sont vides :
> `quality` était un réglage d'OpenRouter.
>
> **Ce que le gratuit ne sait pas faire** : prendre des images d'entrée. Le style du jeu ne
> part donc pas avec ses appels — ce que le produit ajoute de lui-même cède devant le plafond
> du modèle —, et la fiche de l'image le dit ensuite. Le détail est dans
> `docs/tranches/V2.2.md` § F6.
