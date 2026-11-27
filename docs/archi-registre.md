# Le registre du contenu — la construction

> Annexe de [ARCHITECTURE.md](ARCHITECTURE.md), écrite le 27 novembre 2026 avec la tranche
> `RC1`. L'usage est dans [prd-registre.md](prd-registre.md), l'ordre dans
> [PLAN-registre.md](PLAN-registre.md). Les règles pures sont en tête de
> `atelier/domaine/registre.py`.

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
