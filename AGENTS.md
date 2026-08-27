# Asset Kitchen

Atelier personnel de production d'assets 2D pour jeu. On y définit **l'univers** d'un jeu
une fois, puis on fabrique au cas par cas les personnages, objets, décors et interfaces qui
lui appartiennent. **Tout ce qui est produit entre en bibliothèque de lui-même** ; juger,
c'est marquer favori ou supprimer, et ce qui est jugé l'est avant de partir dans le jeu, pas
avant d'entrer dans la bibliothèque. Un serveur MCP expose les mêmes gestes à un agent qui
code le jeu.

Ce fichier-ci ne dit que **comment travailler dans ce dépôt**. Ce qu'il faut construire vit
dans `docs/`, réparti selon la règle d'autorité ci-dessous.

## État au 27 août 2026

La chaîne de cadrage est finie — PRD, architecture, design, plan — et **le code a
commencé**. `docs/PLAN.md` fait foi sur ce qui reste.

**T1 est finie.** Le squelette, la clé, le catalogue relu au démarrage, un appel qui rend
une image téléchargeable ; l'écran Atelier — réglages, prompt, grille d'emplacements,
relance d'un raté ; puis le flux d'événements qui remplace le sondage, la jauge
déterminée, la reprise vue du navigateur et le repli hors ligne à l'écran. **Les seize
critères d'acceptation de T1 sont cochés dans `docs/PLAN.md`, et 28 tests les tiennent.**
Trois images réelles sont sorties, dont deux variations en parallèle (11,7 s et 18,8 s,
$0,0125). **La prochaine tranche est T2, le post-traitement.**

**Le risque « couverture image d'OpenRouter » est levé** (`essais/essai_couverture.py`) :
48 modèles image, 11 fournisseurs, 31 acceptent assez de références pour un univers.

**L'écran tient deux colonnes, pas quatre.** `docs/DESIGN.md` § Layout donne
`240px · 300px · 1fr · 380px` — arbre · réglages · prompt+grille · fiche. L'arbre et la
fiche naissent avec la bibliothèque (T3) ; les afficher vides aujourd'hui montrerait le
cadrage au lieu de servir le geste, ce qui est exactement le reproche fait à la maquette
écartée. Le design n'est pas amendé, il est atteint en T3.

**L'interface ne redemande plus rien.** Elle se branche une fois sur `GET /api/events` et
écoute ; le seul appel qu'elle refait d'elle-même est le catalogue, parce que le grisé de
chaque modèle dépend de la demande en cours. Vérifié au navigateur : deux requêtes au
chargement, plus une seule ensuite tant que rien ne change.

## Lancer

```
uv venv --python 3.11
uv pip install -e ".[dev]"
cd interface && npm install && npm run build

py -m atelier                        lance le serveur et ouvre le navigateur
py -m atelier --sans-navigateur --port 8421
pytest -q                            les critères d'acceptation, sans un centime
py essais/essai_couverture.py        la couverture du fournisseur, gratuit
py essais/essai_premiere_image.py    UN APPEL PAYANT, ~$0,006
```

`interface/dist` est un produit de compilation, hors Git : **sans `npm run build`, le
serveur sert une page qui le dit** au lieu de l'atelier. En développement,
`cd interface && npm run dev` sert l'interface sur 5173 et relaie `/api` vers 8420.

L'API est documentée d'elle-même sur `/api/docs`.

## Les documents et leur autorité

**Une question, un document qui fait foi.** Aucun ne répète ce qu'un autre dit — il le
référence. C'est cette règle, et elle seule, qui évite la divergence entre documents : la
fragilité n°1 relevée chez SpriteCook, où la doc publique et le schéma du serveur ne se
recouvraient plus.

| La question | Le document qui tranche | Produit par |
|---|---|---|
| Que doit faire le produit, du point de vue de l'usage ? | `docs/PRD.md` | `/cadre` |
| Comment est-ce construit ? | `docs/ARCHITECTURE.md` | à la main, `/interroge` en amont |
| Dans quel ordre le construit-on ? | `docs/PLAN.md` | `/planifie` |
| À quoi ça ressemble ? | `docs/DESIGN.md` + `docs/design-preview.html` | `/design` |
| Comment travaille-t-on ici ? | `AGENTS.md` | à la main |

En cas de contradiction entre deux documents, **celui dont c'est la question l'emporte**, et
l'autre est corrigé dans la foulée — jamais laissé en l'état.

## Les skills et leurs frontières

Chaque skill possède **un livrable et un seul**. Un skill qui écrit hors de sa colonne
produit de la duplication, et la duplication devient contradiction.

| Skill | Écrit | S'arrête à |
|---|---|---|
| `/interroge` | **rien** | dialogue de cadrage. Ce qui en sort est reporté à la main dans le bon document. |
| `/cadre` | `docs/PRD.md` | l'usage. Ni techno nommée, ni chemin de fichier, ni code. Test : si l'utilisateur ne peut pas observer la différence, c'est hors PRD. |
| `/planifie` | `docs/PLAN.md` | l'ordre. Pas de noms de fichiers ni de fonctions — ils changeront. |
| `/design` | `docs/DESIGN.md`, `docs/design-preview.html` | l'apparence. Aucune décision de comportement produit. |
| `/investigue` | **rien** | réactif, sur un symptôme constaté. Quatre phases, chacune validée avant la suivante. |
| `/illustre` | un PNG/SVG dans `docs/` | un diagramme qui *argumente*. Jamais décoratif. |
| `/branche`, `/livre` | git | — |

**Les trois débordements à surveiller**, parce qu'ils se produiront :

1. **`/cadre` qui redemande ce qui est tranché.** Le skill explore le repo avant d'interroger :
   lui donner `docs/ARCHITECTURE.md` en entrée le fait aller droit aux trous — les user
   stories, les états vides, les erreurs.
2. **`/planifie` qui réinvente le découpage.** Les tranches T1→T7 existent déjà dans
   `ARCHITECTURE.md` §6.3. Son travail est de les accrocher aux user stories et de leur
   donner des critères d'acceptation, pas d'en inventer d'autres.
3. **`/design` qui décide du produit.** Il choisit la typo, la couleur, la densité, le
   mouvement. Il ne choisit pas ce que fait un écran — ça, c'est le PRD.

**Après chaque skill, élaguer.** Ce qui migre vers `PRD.md` ou `PLAN.md` sort
d'`ARCHITECTURE.md` et y devient une simple référence. Le document rétrécit à mesure que la
chaîne avance : c'est le signe que ça marche.

## Où sont les choses

| | |
|---|---|
| `atelier/` | le paquet Python — `domaine/` les objets et les règles, `fournisseur/` le port et l'adaptateur OpenRouter, `services/` les gestes, `api/` les routes, `depot/` SQLite et fichiers, `image/` le traitement, `mcp/` vide jusqu'à T7 |
| `atelier/services/evenements.py` | la diffusion — ce que l'atelier annonce, à qui écoute. C'est elle qui remplace le sondage : un service qui change d'état le dit, personne ne redemande |
| `interface/` | React + Vite + Tailwind. `src/index.css` porte **tous** les tokens de `docs/DESIGN.md` — aucune couleur, aucun rayon, aucune durée n'est écrit ailleurs |
| `tests/conftest.py` | le double de fournisseur et les trois montages partagés. Il rend de vraies images, de vrais coûts, de vraies dimensions — **aucun test ne coûte un centime** |
| `tests/test_t1_jalon1.py` | les critères de T1 tenus par les jalons 1 et 2 — clé, catalogue, image téléchargeable, variations concurrentes, emplacements indépendants |
| `tests/test_t1_jalon3_4.py` | ceux des jalons 3 et 4 — flux d'événements, jauge déterminée, onglet rouvert, repli hors ligne |
| `essais/essai_couverture.py` | la couverture image du fournisseur, et sa dérive depuis le relevé précédent. Gratuit |
| `essais/essai_premiere_image.py` | la première image, de bout en bout par l'API. **Payant**, ne part qu'à la main |
| `donnees/` | l'index SQLite, la photo du catalogue, les générations et leurs images. Hors Git |
| `docs/ARCHITECTURE.md` | décisions techniques, squelette, fournisseur et modèles, modèle d'objets, contrat de génération, MCP, V1→V5, risques |
| `docs/PRD.md` | ce que le produit doit faire, à l'usage — 97 user stories, états vides, erreurs, cas limites |
| `docs/PLAN.md` | l'ordre de construction — les sept tranches, leurs user stories, leurs dépendances et leurs critères d'acceptation |
| `docs/DESIGN.md` + `docs/design-preview.html` | l'apparence — typographie, palette, densité, mouvement, et le spécimen qui les montre |
| `docs/maquette-atelier.html` | **brouillon écarté** — jugé trop chargé et trop loin de la fluidité recherchée. Reste sur disque, ne sert pas de base. L'interface part du geste quotidien : écrire, générer, juger, garder. |
| `essais/essai_identite.py` | banc de modèles — quatre appels enchaînés, deux jets, parallèle |
| `essais/resultats/jet<N>/<config>/` | images produites + `mesures.json` (coût et durée réels) |
| `essais/planches/` | planches contact assemblées, pour comparer d'un coup d'œil |
| `essais/catalogue.json`, `prix.json` | relevé OpenRouter du 26 août 2026 |
| `screen_spritecook/` | 30 captures de SpriteCook — la référence d'ergonomie, écran par écran |
| `Anatomie de SpriteCook.html` | l'analyse fonctionnelle qui a servi de point de départ |

## Les projets voisins — les lire avant de réinventer

Deux tentatives précédentes vivent à côté. Elles ne sont pas des impasses : elles portent du
savoir payé au prix fort.

- **`../MySpriteAi`** — pipeline pixel complet en TypeScript, détourage BiRefNet, module SFX,
  gestionnaire de VRAM. `src/lib/pixelPipeline.ts` est à porter en Python : les décisions
  dedans ont été acquises par la douleur (durcir l'alpha à 128 **avant** la réduction, sinon
  liseré clair autour du sprite). Son `AGENTS.md` est un inventaire de pièges vérifiés.
- **`../game-asset-generator`** (GAG) — architecture hexagonale Python, 29 décisions.
  `gag/domaine/direction.py` et `gag/ports/vision.py` portent la dérivation de direction
  artistique : c'est le cœur de l'univers d'Asset Kitchen, déjà écrit.

**GAG n'est pas l'ancêtre d'Asset Kitchen, c'est son opposé** : GAG fabrique de la quantité
en lot avec des modèles locaux, Asset Kitchen fabrique peu et bien, à la main, par API. Les
deux vivent côte à côte.

## Règles durables

Écrites ici une fois pour toutes. Elles n'ont jamais à être répétées dans un prompt.

- **Français partout, sauf ce qu'un tiers lit.** Les noms d'outils MCP sont en anglais (ils
  sont lus par des modèles entraînés en anglais ; `generer_asset` dégraderait le
  déclenchement) et les chemins de routes HTTP par convention. Domaine, services, traitement
  d'image, colonnes SQL, interface : en français.
- **Le catalogue décide, jamais une liste en dur.** `GET /api/v1/images/models` donne les
  plafonds de références, les résolutions et les paramètres de chaque modèle. Un modèle qui
  ne peut pas honorer la demande est **grisé avec sa raison**, jamais proposé puis rejeté en 400.
- **Le traitement est non destructif.** On garde l'image brute et la recette. Le rendu est un
  cache effaçable. Recalculer coûte des millisecondes ; regénérer coûte de l'argent et ne rend
  jamais la même image.
- **Le post-traitement ne touche jamais le GPU.** CPU, pur, étapes dans un ordre fixe.
- **Pas de ComfyUI dans l'application.** Le local reste dehors : on génère ailleurs, on importe.
- **Aucune clé en dur.** `.env` seul, jamais versionné ; `.env.example` documente les noms.

## Pièges connus

- **`.env` en UTF-16.** PowerShell écrit en UTF-16 avec `>` et `Out-File`. Le lire comme de
  l'UTF-8 lève sur le tout premier octet. `lire_cle()` essaie plusieurs encodages — toute
  autre lecture de fichier écrit au terminal Windows doit faire pareil.
- **Toujours reconfigurer `sys.stdout` en UTF-8 dans un script à sortie longue.** Dès que la
  sortie est redirigée, Windows encode en cp1252 : un simple `──` lève un
  `UnicodeEncodeError`. Levée depuis un thread d'un `ThreadPoolExecutor`, elle remonte par
  `pool.map` et **tue tout le lot**. Constaté le 26 août : le jet 2 du banc s'est arrêté à 4
  configurations sur 12, après avoir payé les appels. Trois lignes en tête de `main()`
  l'évitent — jamais « on verra si ça pose problème ».
- **Un lot payant doit écrire ses résultats au fur et à mesure, jamais à la fin.** C'est ce
  qui a sauvé les 4 configurations déjà faites au moment du plantage ci-dessus : les PNG et
  le `mesures.json` étaient déjà sur le disque, et la reprise n'a rien repayé.
- **Ne jamais générer petit.** 512 px coûte $0,045 contre $0,067 en 1K chez Nano Banana 2 —
  un tiers de moins pour beaucoup moins de qualité. On génère en 1K et on réduit après.
- **Imposer `aspect_ratio`.** Sans lui, Gemini part en 16:9 et Seedream en 1:1. Deux essais ne
  sont plus comparables, et un sprite n'est plus cadrable.
- **Écrire « one single sprite, one pose only ».** Sans quoi Gemini rend spontanément une
  planche de trois poses — il calque la mise en page de son image de référence.
- **L'échelle du sujet dérive d'une génération à l'autre**, malgré tous les « same size » du
  prompt. Le recadrage et la normalisation d'échelle ne sont pas du confort : sans eux, deux
  frames ne se montent pas.
- **Aucun modèle ne déclare de prompt négatif.** Relevé sur les 48 modèles image du
  catalogue : zéro `negative_prompt`. Le champ existe dans le produit (US-6) ; c'est
  l'adaptateur qui le replie en fin de prompt (`Do not include: …`). Ne jamais l'envoyer
  comme un paramètre : il serait ignoré en silence, comme `output_format` chez Seedream.
- **Le catalogue bouge d'un jour à l'autre.** 47 modèles le 26 août, 48 le 27 —
  `meta/muse-image` est apparu entre les deux. C'est précisément ce qu'une liste écrite en
  dur ne verrait pas.
- **Le coût d'un appel dépend du nombre de références, chez ceux qui facturent au token.**
  Mesuré sur `gpt-image-2` en `quality: low` : $0,0064 sans référence, $0,0124 avec une,
  $0,0245 avec deux. Un univers riche renchérit chaque appel — à surveiller dès T4.
- **Un seul échantillon ne mesure rien.** Un modèle génératif n'est pas déterministe : tout
  banc se fait en deux jets au minimum, et l'écart entre eux compte autant que la moyenne.
- **Un générateur asynchrone ne se referme pas pendant qu'il attend.** Un abonnement écrit
  en `async def … yield` lève `aclose(): asynchronous generator is already running` dès que
  l'appelant le referme alors que l'attente en cours n'est pas finie — et un flux
  d'événements est *toujours* en attente. Constaté le 27 août sur `GET /api/events`. Un
  abonné reçoit donc une **file** (`asyncio.Queue`) : l'appelant décide comment il attend,
  et annuler cette attente n'abîme rien.
- **`TestClient` et `httpx.ASGITransport` attendent la fin de la réponse.** Ils ne
  conviennent pas à un flux qui n'en a pas : le test se fige jusqu'au délai du lot entier.
  On appelle l'application ASGI directement, on lit les premiers messages, et on envoie
  `http.disconnect` — ce qui vérifie du même coup que le serveur s'en remet.
- **Le message d'erreur d'`httpx` est en anglais, et il finit à l'écran.** « All connection
  attempts failed » est ressorti tel quel dans le bandeau hors ligne. Toute erreur de
  transport se traduit en une phrase du produit avant de quitter `fournisseur/` ; un message
  de bibliothèque ne franchit jamais le port.

## Règle systématique : comment finir une étape

Toute fin d'étape se rend en **trois temps, dans cet ordre**. Systématiquement, sans qu'on
ait à le redemander.

1. **Les questions ouvertes sont posées de façon cliquable**, jamais en prose. La réponse
   recommandée passe en premier et le dit.
2. **Les actions à faire et les informations importantes sont mises en exergue** — titrées,
   isolées, écrites pour quelqu'un qui ne connaît pas le projet. Une action noyée dans un
   paragraphe technique ne se fait pas.
3. **Le prompt de reprise vient en dernier**, dans un bloc à copier.

**Le prompt de reprise fait trois lignes** : la tâche du jour, l'état en une phrase, et
« lis `AGENTS.md` et les documents de `docs/` ». Ne jamais y recopier le contexte du dépôt,
les règles ci-dessus, l'état Git ni la liste du reste à faire : tout cela vit déjà dans les
fichiers, et la nouvelle session les lit seule.
