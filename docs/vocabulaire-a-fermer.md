# Fermer le vocabulaire — la liste, avant de renommer quoi que ce soit

> Écrit le 4 septembre 2026, à la demande de l'auteur : *« propose-moi la liste avant »*.
> **Rien n'est renommé tant que cette liste n'est pas validée ligne par ligne.**
>
> Pourquoi c'est le préalable de toute icône : **sept verbes disent aujourd'hui « dépenser pour
> obtenir une image »**. Poser des pictogrammes dessus fabriquerait sept icônes pour un geste.

**Ce qui a été compté** — sur les 278 boutons des 35 fichiers de `interface/src/composants` :
**179 libellés visibles distincts**, 132 étiquettes de lecteur d'écran distinctes, 88 infobulles
distinctes. Soit **399 formulations pour 278 boutons**, et elles ne disent pas toutes la même chose
au même endroit.

**Comment répondre** : tu peux valider en bloc, ou ligne par ligne. Les cases `?` sont celles où je
ne suis **pas** sûr que la nuance soit fausse — c'est toi qui sais.

---

## 1 · Dépenser pour obtenir une image — 7 mots, et il en faut 2

C'est la famille qui compte le plus : c'est le geste qui coûte de l'argent.

| Aujourd'hui | Où | Ce qu'il fait vraiment | Proposé |
|---|---|---|---|
| **Générer** | `ChampPrompt.tsx:278` et `:316` | demande une image neuve | **Fabriquer** |
| **Fabriquer** | `Personnages.tsx:2138 · 2333 · 1826`, `Codex.tsx:922`, `Superposition.tsx:626`, `Assistant.tsx:1786` | demande une image neuve | **Fabriquer** — c'est lui qu'on garde, il est déjà le plus employé |
| **Habiller** | `Personnages.tsx:2532` et `:1826` | demande une image neuve **avec une pièce d'équipement** | **Fabriquer** — l'équipement se dit dans ce qui suit le verbe, pas dans le verbe |
| **Lancer** | `Envoi.tsx:643` — *Payer et lancer* / *Lancer — gratuit* | l'écran de confirmation, au moment où l'on paie | **`Fabriquer — $0,067`** / **`Fabriquer — gratuit`**. ⚠️ **Jamais *Payer et fabriquer*** — tranché par l'auteur le 4 septembre 2026 : *pas deux actions dans le même bouton, et « payer » n'a pas de sens.* Le prix reste dans le libellé, c'est le double verbe qui part |
| **Armer** | `Planche.tsx:373` | **ne paie pas** — le code le dit en clair ligne 408 : *« armer pose la planche dans la barre qui paie, en bas »* | **Préparer** — `Préparer la planche — 6 cases`. Ce n'est pas la même famille : c'est le seul verbe des sept qui ne dépense rien, et le confondre avec `Fabriquer` ferait croire qu'on paie |
| **Relancer** | `Tuile.tsx:208`, `Arbre.tsx:364` | redemande **la même chose**, après coup | **Refaire** |
| **Réessayer** | `Tableau.tsx:1559` | redemande la même chose **après un échec** | **Refaire** |

**La règle qui en sort** : **`Fabriquer`** quand on demande quelque chose de neuf, **`Refaire`** quand
on redemande la même chose. Et **le prix reste toujours dans le libellé** — c'est un acquis du
produit qu'on ne touche pas : `Fabriquer — $0,067`, `Fabriquer — gratuit`.

> **`Revenir sans rien dépenser` devient `Annuler`** — tranché par l'auteur le 4 septembre 2026 :
> *« on sait où on est et ce qu'on est en train de faire. Soit on valide, soit on annule. C'est
> standard. »* La promesse sur l'argent ne se perd pas : elle est déjà portée, mieux, par la ligne
> juste en dessous — *« rien n'est consommé tant que le bouton n'est pas pressé »*. L'ancienne
> formule la répétait à trois pixels d'écart, et devait couvrir le cas payant **et** le cas gratuit,
> d'où sa tournure négative.
>
> **Et la deuxième sortie du même écran disparaît** : `‹ revenir`, en haut à gauche, appelle le même
> `onFermer`. Deux sorties et deux mots pour un seul geste, sur un seul écran.
> L'infobulle `Échap revient sans rien dépenser` suit : **`Échap annule`**.

---

## 2 · Faire disparaître — 9 mots, et il en faut 3

**Ici la nuance est réelle**, et c'est justement ce que les neuf mots ne disent pas : les
conséquences diffèrent vraiment, mais aucun mot ne permet de savoir laquelle.

| Le geste | Ce qui se passe réellement | Proposé |
|---|---|---|
| l'image part à la corbeille, **on peut la rendre** | `Supprimer` (6 emplois), `Supprimer cette image`, `Supprimer ›` | **Supprimer** |
| la case se vide, **l'image reste dans la bibliothèque** | `×` (17 emplois), `Retirer` / `retirer` (8 emplois), `Tout retirer` | **Retirer** |
| un réglage enregistré est effacé | `oublier` (`Tables.tsx:406`) | **Oublier** |

| Aujourd'hui | Où | Proposé |
|---|---|---|
| **effacer** | divers | **Retirer** ou **Supprimer**, selon la conséquence |
| **Couper** | `Toile.tsx:2713` | **`Couper` reste** — vérifié : il appelle `onCouperLien`, il coupe un **lien** entre deux objets de la toile, pas un objet. C'est le mot juste, et aucun des trois autres ne le dit |
| **la mettre de côté** | `Calibrage.tsx:284` | **Retirer** |
| **Ne plus regarder cette chose** | `Codex.tsx:820` | **`Fermer`** — vérifié : ce n'est pas une disparition du tout, c'est l'étiquette du `×` qui **ferme le panneau** (`onFermer`). Elle appartient à la famille 3, et c'est un bon exemple de ce que le vocabulaire ouvert produit : un geste anodin décrit comme un abandon |
| **Tout défaire ›** / **× tout défaire** / **remettre à zéro ›** / **repartir de zéro ›** | `Tables.tsx:643`, divers | **`Réinitialiser`** — tranché par l'auteur : standard et clair |
| **Défaire le dernier · Ctrl + Z** / **défaire ›** | `ChampPrompt.tsx:218` | **`Annuler`** — tranché par l'auteur : le même mot sert à annuler un geste et à quitter l'écran de confirmation, **et le contexte les sépare** (l'un est dans une barre d'outils, l'autre sous le bouton qui paie). C'est aussi le mot standard du `Ctrl + Z` en français |
| **ranger** | divers | **Retirer** |

**La règle qui en sort** : **trois mots pour trois conséquences**, et chacun dit laquelle. Un mot de
disparition qui ne dit pas si l'on peut revenir en arrière est un piège dans un outil qui paie ses
images.

---

## 3 · Quitter — 12 formulations, et il en faut 2

Le rappel de la touche Échap change même de ponctuation d'un écran à l'autre.

| Aujourd'hui | Où | Proposé |
|---|---|---|
| `Fermer — Échap` | `Depenses.tsx:281`, `EcranReglages.tsx:98` | **`Fermer — Échap`** ← la forme retenue |
| `fermer · Échap` | `Guide.tsx:165` | idem |
| `Fermer la fiche — Échap` | `Fiche.tsx:174` | idem — le nom de l'écran est déjà en tête du panneau |
| `Fermer la vitrine — Échap` | `Vitrine.tsx:156` | idem |
| `Fermer` / `fermer` | `FicheChose.tsx:335`, `Calque.tsx:679`, `Envoi.tsx:946`, `Depliage.tsx:76` | idem |
| `✕` seul | `Fiche.tsx:174`, `Import.tsx:237`, `Decoupe.tsx:721` | **la croix reste**, mais elle annonce `Fermer` au lecteur d'écran partout — aujourd'hui l'une d'elles annonce *« Oublier … »* |
| `‹ l'établi` | `Calibrage.tsx:172`, `Planche.tsx:133` | **`‹ l'établi`** ← la seconde forme retenue |
| `‹ Retour` | `Assistant.tsx:486` | **`‹ <le nom du lieu>`** — *Retour* ne dit pas où |
| `‹ revenir` | `Envoi.tsx:192` | idem |
| `Revenir` | `Assistant.tsx` | idem |
| `revenir à la liste proposée` | `Assistant.tsx:2386` | garde son nom de lieu — il est juste |
| `j'ai fini pour l'instant` | `Assistant.tsx` | **elle reste telle quelle.** C'est la sortie de l'assistant, et elle **ne juge personne** — le document de design range cette qualité parmi les acquis à ne pas perdre. Une sortie qui dirait *Fermer* ferait croire qu'on abandonne |

**La règle qui en sort** : **`Fermer — Échap`** quand ça se referme sur place, **`‹ <le nom du
lieu>`** quand ça remonte quelque part. Un retour qui ne nomme pas sa destination oblige à cliquer
pour savoir où l'on va.

---

## 4 · Ce qui s'allume et s'éteint — deux idées, pas une · **tranché le 4 septembre 2026**

Les onze endroits ne faisaient pas la même chose. Lus dans le code, ils en font **deux** — et
l'auteur a tranché les deux séparément.

### A · « ça part, ou ça ne part pas » chez le fournisseur → **`actif` / `inactif`**

**Sept endroits, un seul couple de mots.** Aucun de ces gestes ne cache quoi que ce soit : dans
l'écran de confirmation, la ligne éteinte **reste à l'écran, barrée** — c'est tout le sens de cet
écran, montrer ce qui part *et* ce qui ne part pas.

| Écran | Ce que ça fait | Mots d'aujourd'hui |
|---|---|---|
| **Fiche d'une chose du jeu** (`FicheChose.tsx:674` et `:682`) | ce champ de style ne partira plus pour cette chose | `éteindre / rallumer` |
| **Confirmation avant la dépense** (`Envoi.tsx:925`) | cette ligne ne part pas dans l'appel | `Éteindre / Allumer` |
| **Réglages d'une génération** (`PanneauReglages.tsx:560`) | cette image de référence ne part pas | `Écarter / Remettre` |
| **Assistant des réglages du jeu** (`Assistant.tsx:1654`) | ce champ de l'univers part, ou non | `part avec chaque génération / ne part pas` |
| **Réglages du jeu en grand** (`EcranReglages.tsx:404`) | le même champ, vu ailleurs | `actif / inactif` ← **la forme retenue** |
| **Fiche d'une image**, bloc du traitement (`Fiche.tsx:1183`) | retire une passe du calcul, elle garde ses réglages | `montrer / masquer` |
| **Barre des tables de l'établi** (`Tables.tsx:548`) | met une table en veille | `écarter / remettre` |

> Les deux derniers ne parlent pas d'un appel mais d'un **calcul local**. C'est la même idée
> appliquée plus près : *ça compte, ou ça ne compte pas*. Ils prennent le même mot.

### B · voir ou ne pas voir → **une icône d'œil, ouvert ou fermé**

**Deux endroits seulement, et ce sont les seuls où quelque chose disparaît vraiment.**

| Écran | Ce que ça fait | Mots d'aujourd'hui |
|---|---|---|
| **Superposition** (`Superposition.tsx:739`) | **maintenu enfoncé**, retire le calque du dessus le temps de l'appui — c'est ce qui dit si la pièce tient sur le corps | `masquer le calque` |
| **Découpe** (`Decoupe.tsx:332`) | peint en magenta, **sur l'image**, ce qui ne compte pas | `me le montrer sur l'image` |

### Ce qui porte l'état : la couleur et la forme, pas le mot

**Décision de l'auteur, et elle vaut au-delà de ces onze endroits** :

> *Une interface trop textuelle est fatigante et lourde à utiliser. Une icône ou un bouton
> bascule se comprend naturellement, sans se lire.*

- **Le code couleur est primordial** : ce qui est actif et ce qui ne l'est pas doivent se distinguer
  **à la couleur**, avant de se lire.
- **Un interrupteur bascule remplace le mot** partout où l'état est binaire. Le mot reste comme
  **étiquette de ce que l'interrupteur commande**, pas comme description de son état.
- **Six dessins existaient pour la même idée** — carré de 9 px, carré de 14 px, `●`/`○`, `✓`,
  pastille ronde, point de 5 px. **Il n'en reste qu'un**, l'interrupteur bascule. La pastille ronde
  reste réservée aux **états** (en ligne, réussi, raté), où elle sert déjà et ne se clique pas.

Les règles de dessin sont dans `docs/archive/DESIGN-chassis-chaud-2026-09-04.md`
§ Les interrupteurs.

### Et les infobulles cessent de faire de la philosophie

**Décision de l'auteur, et c'est une règle d'écriture générale** :

> *Fini les phrases mystère sans sujet ni sens. On ne fait pas de la philosophie.*

| Aujourd'hui | Ce qui la remplace |
|---|---|
| *« un refus écrit, pas une case vide »* | **« ne sera pas utilisé pour la génération IA »** |

**La règle** : une explication dit **la conséquence, avec un sujet, en mots concrets**. Ce qui est
visé n'est pas la brièveté — c'est l'aphorisme : une phrase qui oppose deux abstractions
(*« un refus écrit, pas une case vide »*) demande de reconstituer soi-même de quoi on parle. Une
phrase qui nomme la chose et ce qui va lui arriver ne le demande pas.

⚠️ **Cette règle ne condamne pas les explications qui disent la conséquence** — *« les images déjà
faites restent »*, *« l'image part à la corbeille — le pied de l'écran propose de la rendre »* — que
`docs/DESIGN.md` range parmi les acquis. Celles-là ont un sujet et disent ce qui arrive. **Elles
sont le modèle, pas la cible.**

---

## 5 · Les cinq mots écrits deux fois

Un même mot écrit de deux façons se lit comme deux mots.

| Les deux versions | Proposé |
|---|---|
| `Retirer` / `retirer` | **majuscule en tête pour un bouton, minuscule pour un lien dans une phrase** |
| `Fermer` / `fermer` | idem |
| `Favori` / `favori` | idem |
| `Tout retirer` / `tout retirer` | idem |
| `Paiement en cours…` / `paiement en cours…` | idem |

**La règle qui en sort** : la majuscule dit *c'est un bouton*, la minuscule dit *c'est un mot dans
une phrase*. Elle ne coûte rien et elle se vérifie automatiquement.

---

## 6 · Les signes — trois corrections gratuites

Le compte de « trois glyphes » ne décrit plus le code : **dix-huit caractères-signes** sont
réellement affichés, plus sept formes dessinées.

| Le défaut | La correction |
|---|---|
| **Deux croix pour le même geste** — `×` dans 17 boutons, `✕` dans 3 | une seule, `×` |
| **`×` sert aussi de multiplication** dans une trentaine de mesures (`1×`, `32×32`, `Maj ×10`) — et un libellé contient **les deux emplois à trois centimètres d'écart** (`Superposition.tsx:560`) | **`×` est rendu à la multiplication**, et le geste prend la forme dessinée du jeu d'icônes |
| **Le triangle plein dit trois choses** — *cette image partira dans le jeu* (`Tuile.tsx:336`), *artwork officiel* (`Tableau.tsx:1002`, forme et couleur **identiques**), *concept art* (`Tableau.tsx:1015`, doré, coin opposé) | **un sens par forme.** Le troisième change de forme, ou de nom |

---

## 7 · Le chevron `›` — la convention à moitié apprise

**53 libellés distincts sur 179 finissent par `›`**, soit 58 emplacements. Il veut dire *ça mène
ailleurs* — et c'est une bonne convention, déjà apprise.

**Deux corrections** :

1. **Elle devient systématique.** Aujourd'hui elle est tenue à 53 endroits sur les 179 : tout ce qui
   change d'écran le porte, et rien d'autre.
2. **Il cesse de servir de séparateur dans le fil d'Ariane** (`BarreChassis.tsx:236`). Un signe qui
   dit *ça mène ailleurs* et qui sert aussi de ponctuation entre deux mots ne dit plus rien.

---

## 8 · Ce qui ne change pas, et qu'il faut protéger de la passe

Ces libellés sont longs, ils sont irremplaçables par une image, et **ils sont ce que l'interface
fait déjà mieux que ses concurrentes.** Une passe de renommage qui les raccourcirait détruirait la
promesse centrale d'un outil qui paie ses images.

- `Payer et lancer` contre `Lancer — gratuit` (`Envoi.tsx:643`) — devient **`Fabriquer — $0,067`** / **`Fabriquer — gratuit`**. Le prix reste dans le libellé ; c'est le double verbe qui part
- `Rendre la main à l'atelier ›` (`ChampPrompt.tsx:246`)
- `prépare la planche dans l'atelier — rien n'est dépensé ici`
- `aucun appel ne part d'ici`
- `l'appel est parti — il ne se rattrape plus`
- `me le montrer sur l'image — en magenta, ce qui ne compte pas`
- `Sans zone ›` / `Sans retouche ›` / `Sans passages ›` (`Calque.tsx:605`)

Et **les 88 à 95 explications qui disent la conséquence et non la fonction** — *« les images déjà
faites restent »*, *« l'image part à la corbeille — le pied de l'écran propose de la rendre »*. Le
document de design les range parmi les acquis les plus précieux et les plus faciles à perdre.

---

## Ce que ça donne, en résumé

| Famille | Aujourd'hui | Après | Ce qui reste à trancher par toi |
|---|---|---|---|
| dépenser | 7 mots | **2** — `Fabriquer`, `Refaire` — plus `Préparer`, qui n'était pas de la famille | ✅ tranché |
| faire disparaître | 9 mots | **3** — `Supprimer`, `Retirer`, `Oublier` — plus `Couper`, qui coupe un lien et pas un objet | ✅ tranché |
| annuler et remettre à zéro | 6 formulations | **2** — `Annuler`, `Réinitialiser` | ✅ tranché |
| quitter | 12 formulations | **2** — `Fermer — Échap`, `‹ <lieu>` | ✅ tranché |
| ça part ou pas · ça compte ou pas | 5 paires, 6 dessins | **`actif / inactif`, un seul interrupteur** | ✅ tranché |
| voir ou ne pas voir | mêlé au précédent | **une icône d'œil**, 2 endroits | ✅ tranché |
| casse | 5 doublons | **0** | ✅ tranché |
| signes | 18 caractères | une croix, un sens par forme | ✅ tranché |

**Tout est tranché.** Les cinq questions que ce document posait au départ se sont répondues : quatre
dans le code — `Armer` ne paie pas, `Couper` coupe un lien, `Ne plus regarder cette chose` est en
réalité une fermeture de panneau, `masquer` dans la fiche veut dire *ne compte plus* — et la
dernière par l'auteur, le 4 septembre 2026.

**Ce que la vérification a montré en passant**, et qui vaut d'être noté : **trois libellés sur quatre
décrivaient autre chose que ce qu'ils font.** Ce n'est pas un vocabulaire trop riche, c'est un
vocabulaire qui a dérivé de ses gestes — et c'est une raison de plus de le fermer.

---

## Ce que ce document ne couvre pas, et qui est plus grave

Le 4 septembre 2026, en relisant **le tout premier écran de la liste**, l'auteur a trouvé un défaut
qui n'est pas de vocabulaire : **le mot « fiche » nomme deux objets différents, et le chemin vers
l'un des deux n'existe pas.**

- Dans la **galerie**, on clique un asset et la colonne de droite s'appelle **la fiche**.
- Dans le **codex**, on clique un personnage et on n'arrive **pas** sur sa fiche : on arrive sur un
  écran qui porte son nom et qui sert à fabriquer des poses, avec dans la colonne de gauche **un
  morceau de fiche** et un lien minuscule vers *sa fiche*, *la vitrine* et *le calibrage*.

Ce n'est pas un mot à renommer, c'est **une structure d'écrans à revoir** — et c'est exactement ce
que l'auteur décrivait par *« aucun workflow ne se dessine visuellement »*. Ça se traite dans la
refonte des écrans, pas ici. **Noté pour ne pas être perdu.**
