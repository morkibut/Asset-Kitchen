# Les essais — deux niveaux de contrôle, et ce que chacun ne voit pas

> Descendu d'`AGENTS.md` le 20 septembre 2026, sur le modèle de `docs/bancs.md` et
> `docs/PIEGES.md` : `AGENTS.md` garde les commandes qu'on tape, le détail vit ici.
>
> **Ce document fait foi sur : quand lancer quoi, ce que les marqueurs veulent dire, et ce qui
> échappe au contrôle rapide.** Ce que chaque essai vérifie vit dans l'essai lui-même ; les
> bancs de mesure vivent dans `docs/bancs.md`.

## Le problème, d'abord

Le dépôt tient **trois mille sept cent cinquante essais de serveur dans deux cent un fichiers**,
et deux mille six cent cinquante-neuf essais d'écran dans quatre-vingt-quinze.

Mesuré le 20 septembre 2026, fichier par fichier : **71 minutes de processeur en tout**, dont
treize rien que pour démarrer pytest deux cent une fois. D'un seul bloc et d'un seul processus,
`pytest -q` met donc de l'ordre d'**une heure**. Personne ne lance ça. Donc personne ne lance
rien. Donc une faute reste cachée — et ce n'est pas une crainte : une largeur posée dans
`Guide.tsx` a fait échouer `tests/test_b0.py` pendant trois séances sans que personne le voie.

Les mêmes essais, **sur quatre processus, tiennent en une dizaine de minutes** — c'est le
contrôle complet d'aujourd'hui : 14 min 37 de bout en bout, lents et garde-fous compris.

Un contrôle qu'on ne lance pas ne prouve rien. D'où deux niveaux, et il faut lancer le bon au
bon moment.

## Le rapide — à chaque tranche de travail

```
py essais/lancer_les_essais.py
```

Il lance trois choses, et l'assemblage n'est pas arbitraire :

1. **Tout ce qui n'est pas marqué `lent`**, sur quatre processus. C'est le gros du compte.
2. **Les garde-fous**, même lents, même loin de ce qu'on a touché.
3. **Les essais proches de ce qu'on vient d'écrire**, même lents.

Les deux dernières moitiés existent pour une seule raison : sans elles, *marquer un essai lent
reviendrait à le retirer du contrôle courant*, ce qui est l'inverse du but.

## Le complet — une fois par chantier, avant de fusionner dans `main`

```
py essais/lancer_les_essais.py --complet
```

Tout, lent compris. **Les lents partent sans concurrence**, et c'est la raison d'être de la
séparation : les deux essais qui lancent le moteur Godot lui donnent trente secondes, et sous
la charge de dix processus ils dépassent ce délai alors qu'ils passent seuls. *Un essai qui
échoue à cause du voisin ne dit plus rien de vrai sur le produit.*

## Ce que j'ai touché — le cran le plus court

```
py essais/lancer_les_essais.py --proches    les garde-fous + ce qu'on vient d'écrire
py essais/lancer_les_essais.py --liste      ne rien lancer, dire seulement ce qui serait lancé
```

**Ce troisième cran existe à cause d'une mesure.** Puisque presque rien n'est assez lourd pour
mériter le marqueur `lent` (voir plus bas), `-m "not lent"` est presque toute la suite, et le
rapide coûte presque le prix du complet. Le cran court est donc le vrai geste de la boucle de
travail : on relit ce qu'on vient d'écrire, plus les garde-fous qui surveillent le reste.

⚠️ **Il ne remplace pas le rapide.** Il voit beaucoup moins. Lancer le rapide avant de quitter
une tranche.

`--liste` ne lance rien et dit deux choses : quels essais nomment les fichiers modifiés, **et
quels fichiers modifiés n'en ont aucun**. La seconde liste est la plus utile — elle nomme les
trous.

## Mesurer

```
py essais/lancer_les_essais.py --mesure                         tout, quatre à la fois
py essais/lancer_les_essais.py --mesure -n 1 tests/test_c5.py   un fichier, seul
```

Chaque fichier part dans son propre processus, avec un délai maximum, et le tableau final dit
ce qui échoue et ce qui traîne.

**Les deux usages ne se confondent pas.** Le balayage complet à quatre processus sert à
*trier* : en une passe on voit qui échoue et qui traîne. Mais une durée relevée pendant que
trois autres processus mangent la machine mesure la charge autant que le fichier — elle ne peut
pas décider d'un marqueur. **Ce qui décide du marqueur, c'est une seconde passe à `-n 1` sur
les seuls candidats.**

## Combien de processus — quatre, et c'est mesuré

La suite entière moins les lents, lancée trois fois le 20 septembre 2026 sur une machine à
seize cœurs :

| Processus | Durée | Échecs |
|---|---|---|
| **4** | **7 min 36** | 1 — celui de `Guide.tsx`, connu |
| 8 | 8 min 45 | le même, et rien de plus |
| 12 | 9 min 16 | le même, **plus deux faux échecs** |

⚠️ **Ces durées varient du simple au double d'un passage à l'autre.** La même passe à quatre
processus a été mesurée trois fois le même jour : **6 min 41, 7 min 36 et 12 min 07**, sans rien
changer. **Compter une dizaine de minutes**, et ne jamais lire un écart de durée comme une
régression.

Le contrôle complet de bout en bout — la grande passe, les lents sans concurrence, les deux
bancs — a mis **14 min 37** puis **9 min 12**.

Deux enseignements, et les deux vont contre l'intuition.

**Monter ne fait pas gagner de temps.** Au-delà de quatre, les essais se disputent la machine :
ils travaillent presque tous des images, et Pillow comme numpy occupent déjà plusieurs cœurs
chacun. Ajouter des processus ajoute de l'attente.

**Monter rend le résultat faux.** À douze, `tests/test_t1_jalon3_4.py` mesure une attente de
0,19 s là où il en attend 0,12 ± 0,06, et `tests/test_au6.py` échoue aussi. Les deux passent
seuls. *Un essai qui échoue à cause du voisin ne dit plus rien de vrai sur le produit.*

`-n` permet d'en demander un autre nombre, mais il n'y a pas de raison connue de le faire.

## Les deux marqueurs

### `lent`

**L'essai lance un processus extérieur** — le moteur Godot, Node, un navigateur sans écran.
Vingt-quatre essais le portent au 20 septembre 2026, et ils sont marqués **un par un**, jamais
par fichier : les fichiers où ils vivent contiennent surtout des essais rapides qu'on perdrait.

⚠️ **Ce n'est pas le critère qu'on attendait, et c'est la mesure qui l'a imposé.** Le chantier
partait de l'idée qu'une poignée de fichiers dépassaient quarante-cinq secondes. Mesurés seuls
le 20 septembre 2026, **aucun n'y arrive** : le plus lourd est `tests/test_c5.py` à 40,2 s, et
les chiffres qui circulaient — `test_tu10_agent` à 119 s, `test_c5` à 83 s — avaient été relevés
sous charge. Seul, `test_tu10_agent` met 23,3 s.

**La suite n'est donc pas lente à cause de quelques essais lourds : elle est lente par
accumulation**, trois mille sept cent cinquante essais à environ une seconde. Le levier qui
marche est le parallélisme, pas le marqueur.

Ce qui reste vrai, et ce pour quoi le marqueur existe : ces vingt-quatre essais-là **portent
leur propre délai d'attente** — trente secondes pour un appel à Godot. Sous la charge de
plusieurs processus, le délai se dépasse et l'essai échoue **alors qu'il passe seul**. Les
séparer, c'est les rendre fiables, pas seulement rapides.

`pytest -m lent --collect-only -q` en donne la liste à jour. **Aucune liste n'est recopiée
ici** : une liste recopiée ment le jour où l'on marque un essai de plus.

### `gardefou`

L'essai **balaie un dossier entier** au lieu d'appeler du code.

C'est la différence qui compte, et elle n'est pas une nuance : un essai qui lit
`interface/src/api.ts` **nomme** ce fichier, donc la règle de proximité le retrouvera toute
seule. Celui qui passe `rglob` sur tout `interface/src` casse sur un fichier qu'il ne nomme
nulle part — **aucune règle ne peut le deviner**. Ceux-là tournent toujours.

Au 20 septembre 2026, six fichiers le portent :

| Essai | Ce qu'il balaie |
|---|---|
| `tests/test_b0.py` | les listes fermées de `docs/DESIGN.md` dans chaque fichier du carnet, et `essai_jetons.py` sur tout `interface/src` |
| `tests/test_b27.py` | `essai_imports.py` : aucun fichier du carnet n'emprunte à un écran du dehors |
| `tests/test_b23.py` | tous les `.ts` et `.tsx` : les trois surfaces déménagées ne reviennent pas |
| `tests/test_g1.py` | tout `interface/src` : les neuf phrases visibles restent vraies |
| `tests/test_rp17.py` | tous les `.py` d'`atelier/` : une seule porte écrit dans le jeu |
| `tests/test_au10_environnement.py` | le dossier du voisin `asset3d/` en entier : le pont n'y écrit rien |

**Et deux bancs qui ne sont dans le pytest de personne**, que l'outil lance à part :

| Banc | Ce qu'il balaie |
|---|---|
| `essais/essai_docs.py` | les 2 204 renvois de tous les documents, et la dérive du corpus de démarrage |
| `essais/essai_vocabulaire.py` | les mots d'ossature de tous les écrans, contre la liste fermée de `docs/vocabulaire.html` |

L'outil **dénonce** un essai qui ressemble à un garde-fou sans en porter le marqueur, à la fin
d'un `--mesure`. Il préfère déranger pour rien que se taire : `tests/test_pont_asset3d.py` y
apparaît alors qu'il ne balaie qu'un dossier temporaire, et c'est le prix à payer.

## Ce que le niveau rapide ne voit pas — à lire une fois

- **Les essais proches se déduisent des noms.** On prend `git diff --name-only` et on garde les
  essais qui **nomment** les fichiers modifiés — par leur chemin, par leur module pointé ou par
  leur seul nom. Un essai qui passe par l'API ou par `Atelier` ne nomme aucun module profond :
  toucher `atelier/image/traitement.py` ne proposera pas les essais d'écran qui s'en servent
  sans le citer. C'est pour ce trou-là que le rapide lance aussi tout ce qui n'est pas lent, et
  pas seulement les proches.
- **La règle est volontairement trop large plutôt que trop étroite.** Un fichier nommé `api.ts`
  fera remonter beaucoup d'essais. Le prix d'un essai lancé pour rien est quelques secondes ;
  celui d'un essai oublié est une faute cachée.
- **Ce qui est marqué `lent` n'est pas vu**, sauf s'il est garde-fou ou proche. C'est le
  marché : le rapide est rapide parce qu'il renonce à quelque chose. Le complet le rattrape.
- **Rien du côté écran.** `cd interface && npm test` reste à lancer à part.

## Côté écran — lancer tout, il n'y a rien à gagner à trier

```
cd interface && npm test      les 95 fichiers, 2 659 essais, 3 min 19
```

**Et c'est tout.** `npx vitest related <fichiers>` existe, choisit **par le graphe des imports**
— plus sûr que la règle par les noms du côté serveur, puisqu'il ne peut pas rater un essai qui
importe un fichier sans le nommer en clair — et **ne fait pourtant rien gagner ici**. Mesuré le
20 septembre 2026, machine au repos :

| Ce qu'on lance | Fichiers | Essais | Durée |
|---|---|---|---|
| toute la suite | 95 | 2 659 | **3 min 19** |
| `related src/composants/FicheDuSujet.tsx` | 4 | 655 | 2 min 38 |
| `related src/composants/AtelierTuiles.tsx` | 3 | 634 | **3 min 20** |

**Trier 95 fichiers en 3 met plus de temps que de tout lancer.** La raison est simple : la suite
entière se répartit sur plusieurs processus, trois fichiers ne le peuvent pas — et ces trois-là
portent déjà le quart des essais, parce que les gros fichiers d'écran (`App.test.tsx` et ses
six cents essais) sont importés partout.

⚠️ **`App.test.tsx` a échoué une fois sous charge, puis est repassé.** Le 20 septembre 2026, le
processus de travail de vitest s'est arrêté tout seul (*Worker exited unexpectedly*) pendant que
quatre processus pytest occupaient la machine ; au repos, les 95 fichiers passent sauf
`aide.test.ts`. Ne pas « réparer » un échec de ce fichier sans l'avoir reproduit à vide — et ne
pas lancer les deux suites en même temps.

## Deux pièges de terrain

- **Dans un worktree, `interface/dist` n'existe pas** — c'est un produit de compilation, hors
  Git. Les essais qui interrogent le serveur répondent alors **404 au lieu de 405**, et l'échec
  semble venir du code : `tests/test_c5.py` et `tests/test_rp17.py` l'ont payé. L'outil le
  détecte au lancement et donne le geste :
  `cmd /c "mklink /J interface\dist ..\gag2\interface\dist"`.
- **`essais/essai_docs.py` écrit son relevé** dans `essais/mesures_docs.json` à chaque passage —
  c'est ainsi qu'il mesure la dérive du corpus d'une fois sur l'autre. Le fichier apparaît donc
  modifié après un contrôle ; ce n'est pas une faute.

## Une fois, après la fusion d'un chantier qui arrive avec ses essais

Le chantier *Le rangement* (`feat/rangement`) ajoute des `tests/test_rg*.py` que `main` n'a pas
encore. L'outil les prendra **sans qu'on y touche** : il ne tient aucune liste de fichiers, il
lit le dossier et il demande à pytest qui porte quel marqueur.

Mais rien ne dit encore si l'un d'eux est lent. **Après la fusion, lancer le complet une fois**,
et poser le marqueur sur ce qui traîne. Même consigne pour tout chantier qui arrive avec ses
essais — `feat/son`, `feat/tuiles`, et ceux qui viendront.

## Les échecs connus au 20 septembre 2026

Ils étaient là avant ce chantier et ne viennent pas de lui. Les nommer évite de les chercher.

| Où | Quoi |
|---|---|
| `tests/test_b0.py` | `Guide.tsx` — deux tailles hors des listes fermées, 28 px et 10 px (`GU7`). ⚠️ **Toujours là après la clôture du chantier du guide** le 20 septembre 2026 ; les lignes se déplacent à chaque retouche du fichier, le défaut non |
| `essais/essai_vocabulaire.py` | quatre mots d'ossature : deux onglets de `PageDuSujet.tsx`, deux libellés de retour dans `FabricationAudio.tsx` et `FicheDuSujet.tsx` |
| `interface/src/aide.test.ts` | **15 échecs** dans `main` — le travail en cours sur le guide (`GU12`) ; l'arbre de travail de l'auteur en porte davantage |

**Et un essai instable, trouvé par le contrôle complet du 20 septembre 2026** :
`tests/test_sn10_musique_adaptative.py::test_godot_passe_d_exploration_a_combat_…`. Godot y
rend `3221225477` — `0xC0000005`, une violation d'accès : le moteur **plante**, il ne dépasse
pas un délai. Ce n'est donc pas un effet de la concurrence.

Neuf tirages ce jour-là : **deux échecs, tous deux immédiatement après une passe parallèle
lourde ; sept passages**, dont celui du second contrôle complet. Il n'a pas été réparé — il
n'appartient pas à ce chantier, et on ne répare pas un essai qu'on n'a pas su reproduire à
volonté. ⚠️ **Conséquence pratique** : un contrôle complet peut finir rouge sur ce seul essai.
Le rejouer seul avant de conclure à une régression.
