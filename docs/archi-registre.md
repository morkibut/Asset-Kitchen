# Le registre du contenu — la construction

> Annexe de [ARCHITECTURE.md](ARCHITECTURE.md), écrite le 27 novembre 2026 avec la tranche
> `RC1`. L'usage est dans [prd-registre.md](prd-registre.md), l'ordre dans
> [PLAN-registre.md](PLAN-registre.md). Les règles pures sont en tête de
> `atelier/domaine/registre.py`.

## 0. Après le complément du 27 novembre : une fiche par sujet

Ce qui suit dans les sections 1 à 8 décrit `RC1` telle qu'écrite, autour de **l'entrée**. Le
complément ([prd-registre.md § Une fiche par sujet](prd-registre.md#une-fiche-par-sujet))
coupe l'entrée en deux, et **ce qui tient reste tel quel** : le journal d'évènements, l'état
déduit, une décision par fichier, les portes, les remarques, les médias par empreinte, la
boîte de dépôt, le MCP sans geste de décision.

**Les fichiers, après** :

```
projets/<jeu>/registre/
├─ reglages.json                       types → rubrique, variantes admises, textes attendus
├─ fiches/<sujet>/fiche.json           le sujet de contenu : son texte, ses variantes
├─ fiches/<sujet>/apports/<apport>.json ce qu'un agent a déposé, toutes versions comprises
├─ fiches/<sujet>/medias/…             les fichiers venus d'ailleurs, par empreinte
├─ journal/<repere>.json               inchangé ; un évènement vise un apport, et donc sa fiche
└─ depot/…                             inchangé, mais un dépôt nomme son sujet
```

- **`<sujet>` est l'identifiant du sujet de l'atelier** quand le type est une chose dessinée
  (personnage, bête, lieu, objet) : la fiche *est* le sujet, enrichi. Pour un sujet de
  contenu (quête, lettre, décision), l'identifiant est propre au registre. Un seul écrivain
  par fichier, comme avant : `fiche.json` par le geste « écrire le texte », un apport par son
  dépôt.
- **Le texte** (R6) vit dans `fiche.json`, pas dans la description du sujet : la description
  part au modèle à chaque demande, l'histoire ne doit pas y partir.
- **Une variante** (R7) est une clé de `fiche.json` ; un apport la vise ou vise la fiche.
- **L'état à deux niveaux** : celui d'un apport se déduit comme celui de l'entrée aujourd'hui
  (`etat_de_l_entree` devient `etat_de_l_apport`, même ordre) ; celui d'une fiche se déduit de
  ses apports (à traiter dès qu'un l'est), et celui d'une variante des siens. **Les trois zones
  de R4 sont un classement de ces états**, calculé à la lecture, jamais rangé par l'agent.
- **Rattacher** un apport à un autre sujet est un évènement du journal, pas un déplacement de
  décisions : l'apport garde son identifiant, donc ses décisions et remarques le suivent
  (R5). Le fichier de l'apport, seul, change de dossier.

**Le MCP, après** — toujours façade, toujours sans geste de décision :

| Outil | Ce qu'il fait |
|---|---|
| `list_subjects` | Les fiches d'une rubrique, courtes, triées par état puis par date |
| `find_subject` | Retrouve un sujet par son nom, à l'orthographe près, pour ne pas en créer un second |
| `get_subject` | Une fiche : son texte, ses variantes, ses trois zones, **et les décisions déjà prises** |
| `submit_contribution` | Dépose un apport sur un sujet (et une variante) ; un lot se dépose en un appel et **se répartit** fiche par fiche ; un apport sans sujet est refusé, avec sa raison |
| `set_subject_story` | Écrit ou met à jour le texte d'un sujet |
| `move_contribution` | Rattache un apport mal rangé à son vrai sujet, ses décisions avec lui |
| `read_decisions` | Inchangé, mais chaque décision dit **le sujet, la variante et l'apport** visés |
| `answer_remark`, `set_contribution_status`, `set_contribution_waiting` | Les anciens gestes de l'agent, sur un apport |

`list_entry_types` devient `list_subject_types` (rubrique, variantes admises, textes attendus).
La boîte de dépôt suit : `entree.json` devient `apport.json` avec un champ `sujet` obligatoire,
ou `apports.json` pour un lot, réparti de la même façon.

## 1. Où vivent les fichiers

Dans le jeu, à côté de sa bible :

```
projets/<jeu>/registre/
├─ reglages.json                  les types, leurs portes, les rayons — facultatif
├─ entrees/<entree>/entree.json   ce que l'agent a déposé, toutes versions comprises
├─ entrees/<entree>/medias/…      les fichiers venus d'ailleurs, nommés par leur empreinte
├─ journal/<repere>.json          un évènement : dépôt, version, décision, choix, remarque,
│                                 réponse, statut, attente, annulation
├─ vu.json                        ce que l'auteur a déjà vu — l'écran seul l'écrit
├─ lecteurs/<agent>.json          le repère de lecture d'un agent — lui seul l'écrit
├─ televersements/…               les fichiers posés par l'écran avant de créer une entrée
└─ depot/<dossier>/entree.json    la boîte de dépôt des agents qui n'atteignent pas le port
   depot/.pris/…                  les dépôts pris, gardés tels quels
```

**Jamais deux mains sur le même fichier**, la leçon de `cartes.json` :

- `entree.json` n'est écrit que par un dépôt (l'agent qui dépose, ou l'écran quand l'auteur
  crée une entrée), sous le verrou du registre ;
- **chaque décision est un fichier neuf** dans `journal/`. Rien n'est relu puis réécrit : deux
  gestes à la même seconde font deux fichiers ;
- `vu.json` et `lecteurs/<agent>.json` n'ont chacun qu'un écrivain.

## 2. L'état se déduit, il ne s'enregistre pas

Comme le retour de `RV7` se déduit des travaux, **l'état d'une entrée se recalcule à chaque
lecture** depuis son `entree.json` et ses évènements (`etat_de_l_entree`). Il n'y a pas de
champ « statut » qu'un geste mettrait à jour : une décision annulée disparaît du calcul, et
c'est tout ce qu'annuler veut dire. L'ordre de calcul est écrit en tête du domaine.

Le repère d'un évènement est **trié dans le temps** — vingt chiffres de nanosecondes, puis du
hasard. « Ce qui est plus grand que mon repère » est exactement « ce que je n'ai pas lu ».
`read_decisions` avec un `reader` garde ce repère pour l'agent et l'avance.

## 3. L'index SQLite n'en sait rien

Le registre se lit **directement sur les fichiers**. Effacer l'index ne perd rien, et il n'y a
rien à reconstruire. Mille entrées et quelques milliers d'évènements se relisent en quelques
dizaines de millisecondes ; si la mesure dit un jour le contraire, un index jetable se posera
par-dessus, comme pour la bibliothèque — **jamais une seconde vérité**.

## 4. Les médias

- **Un fichier venu d'ailleurs** est copié **une fois**, nommé par son empreinte : redéposer
  la même image ne la recopie pas, et deux entrées qui montrent le même fichier ne doublent
  rien sur le disque. Sa provenance (le chemin d'origine) est gardée.
- **Un asset de la bibliothèque** est montré **par référence** (`/api/assets/<id>/image`) : rien
  n'est copié, et l'asset reste réglé à son propre écran (favori, choisi pour le jeu).
- Le genre se lit à l'extension : image, vidéo (avec ses sous-titres `.vtt`), son, texte.

## 5. Versions

Redéposer une entrée dont **les médias ou le corps** ont changé ajoute une version ; sinon
seules les légendes, défauts et conseils se mettent à jour. Une porte validée le reste d'une
version à l'autre ; une reprise et un choix visent une version. L'histoire d'une entrée montre
ses versions précédentes, chacune avec ce que l'auteur en a dit.

## 6. Les deux portes des agents

**Le MCP** (`atelier/mcp/registre.py`) — façade sans logique propre, mêmes services que l'écran :
`list_entry_types`, `list_entries` (courte par défaut, 30 lignes), `get_entry`, `submit_entry`,
`read_decisions`, `answer_remark`, `set_entry_status`, `set_entry_waiting`. **Aucun outil ne
décide** : valider n'est pas un outil d'agent, et un essai le tient.

**La boîte de dépôt** — pour les agents qui n'atteignent pas `127.0.0.1:8420` mais savent écrire
dans un dossier de la machine. Un dossier par entrée sous `registre/depot/`, `entree.json`
dedans (les mêmes champs, en français), ses médias à côté, **`entree.json` écrit en dernier**.
L'atelier relève la boîte à chaque ouverture du registre et à chaque liste de l'agent :

- un dépôt pris part dans `depot/.pris/` — rien n'est effacé ;
- un dépôt refusé **reste là**, sa raison s'affiche à l'écran et s'écrit dans
  `REFUS.txt` à côté, pour l'agent qui ne voit pas l'écran. Rien n'est ignoré en silence.

Les décisions se lisent dans `journal/*.json` sans réseau ; l'atelier éteint ne perd aucun
dépôt, il le prend au prochain passage.

## 7. Ce qui prépare la suite sans la construire

- **Le téléphone** : tout est fichier lisible hors de l'atelier, et une décision est un
  évènement qui peut venir d'ailleurs. Une copie relue ailleurs pourra déposer ses évènements
  dans une boîte comme celle des agents ; rien à l'étape 1 ne suppose l'écran du PC.
- **Les liens** (étape 2) seront un objet à part du lien de la toile : ceux de la toile sont
  muets, relient des cartes et des îlots, et ne survivent pas à leurs extrémités ; ceux du
  contenu sont typés, relient des entrées et des assets, et un lien vers une entrée écartée
  doit se signaler, pas disparaître. **Séparer**, donc — c'est la conclusion, pas un réflexe.
- **Le graphe** (étape 2) se déduit et doit se ranger tout seul : `@xyflow/react` est déjà
  là ; la mise en page automatique est le besoin neuf.

## 8. Pourquoi des objets neufs

La barre de [archi-objets.md](archi-objets.md) est haute. **L'entrée** n'est pas un asset :
elle montre un texte, une décision ou plusieurs assets à la fois, et elle a des portes.
**L'évènement du journal** n'est pas un champ : une décision est un état déduit de faits datés,
et c'est ce qui rend « relever depuis un repère » et « annuler » exacts. Une étiquette sur un
asset n'aurait porté ni l'une ni l'autre.
