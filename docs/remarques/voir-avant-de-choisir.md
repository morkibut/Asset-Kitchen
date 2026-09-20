# « Voir avant de choisir » — huit retours de la séance du 20 septembre

> **État : relevé et étayé, rien n'est tranché.** Six des huit retours de l'auteur du
> 20 septembre 2026 portent sur le même écran — l'étape 2 du parcours de création,
> `interface/src/composants/ReglesDuJeu.tsx` — ; les deux derniers visent l'écran *Les sons* et le
> nom de la porte *Les sujets*. Le texte de l'auteur est au § 1, mot pour mot. Ce que le code dit
> déjà est au § 2 : **trois des demandes sont à moitié construites**, une renverse une décision
> datée, et une est un défaut net. Les questions ouvertes sont au § 4.

---

## 1 · Ce que l'auteur a écrit — 20 septembre 2026

> * quand on créer un nouveau jeu, dans la configuration a l'étape 2 - son allure : il y a le mode
>   de pixelisation. ce serait bien d'avoir un visuel du rodeur qu'on a juste au-dessus avec les
>   différentes pixelisation pour choisir le style visuellement.
> * Pareil pour "La taille — le côté de l'image, en pixels"
> * pareil pour "Les couleurs demandées"
>
> * "Le fond du jeu" c'est pas trop clair on la l'impression qu'il s'agit de la couleur de fond du
>   jeu. En fait j'aimerai enlever ce paramètre. je voudrait que de manière intelligente partout ou
>   on fait des appels de génération vidéo ou image on est un algo qui appelle avec la couleur la
>   plus différenciantes par rapport a l'image de référence envoyé (magenta, bleu, vert, orange...).
>   et si il n'y a pas d'image de référence par défaut tu prend le vert des fond vert.
> * dans la config masque "ce jeu n'a pas encore de palette : rien ne dit quelles couleurs il
>   contient, donc rien ne dit lesquelles éviter", masque aussi "La taille de case est le seul choix
>   qu'on ne reprend pas gratuitement : changer le style ou la méthode se refait sur la machine,
>   puisque la grande image est gardée sur le disque. Changer la taille après coup laisse les images
>   déjà faites à leur ancienne taille." et de manière générale masque tout les texte qui embrouille
>   et ne sont pas clair pour une personne qui utilise l'app pour la première fois. si c'est pas
>   utile ou vital pour la configuration, tu l'enlève.
> * dans l'onglet Univers : ajoute la possibilité de modifier un texte / note qu'on a ecris.

Puis, dans un second message, deux retours de plus :

> autre point quand on clique dans son on se retrouve dans une fenetre immense sans menu ni rien
> autour.
>
> ensuite autre point : le guide décris le menu "les sujets" comme "le codex". moi perso je préfère
> que ca s'appelle le codex et qu'il contienne des sujets. tu peux changer le nom du coup.

Une copie d'écran accompagne le message : l'étape *Son allure* en style **pixel**, taille **64**,
méthode **vote en deux temps**, **32** couleurs. Les deux vignettes du haut — le rôdeur en pixel,
le rôdeur en dessin — sont les seules images de l'écran. Tout le reste est du texte et des
boutons nus.

---

## 2 · Ce que le code dit déjà

### 2a · Les vignettes de taille existent, et personne ne les affiche

`interface/public/vignettes/` porte **neuf planches déjà faites** : `taille-8.png`, `-16`, `-24`,
`-32`, `-48`, `-64`, `-96`, `-128`, `-256`. Elles ne sont référencées nulle part dans le code de
l'interface : le seul appel au composant `Vignette` (`ReglesDuJeu.tsx:246`) sert les deux cartes
de style, `style-pixel` et `style-dessin`. La rangée de tailles
(`ReglesDuJeu.tsx:400-440`) est une suite de boutons portant un nombre.

**La deuxième demande est donc du câblage, pas de la fabrication.** À vérifier d'abord : que ces
neuf PNG montrent bien le rôdeur, et non un autre sujet — s'ils montrent autre chose, la demande
devient « refaire les neuf ».

### 2b · Les planches de pixelisation et de couleurs existent, mais comme bancs d'essai

`essais/planche_pixelisation.py` fabrique déjà « une seule image PNG par taille, avec les six
méthodes côte à côte et leur nom écrit dessous ». `essais/planche_couleurs.py` fabrique déjà
« une méthode, tous les paliers de couleurs ». Ce sont des outils de jugement pour l'auteur, pas
des ressources du produit : elles écrivent dans `essais/resultats/`.

**Il manque donc un tirage, pas un algorithme** : passer le rôdeur dans ces deux scripts, et
déposer le résultat découpé dans `interface/public/vignettes/`. Deux réserves :

* le banc compte **six** méthodes, l'écran n'en propose que **quatre** (`vote`, `pixeloe`,
  `lanczos`, `proche`) — la planche doit être refaite sur les quatre de l'écran ;
* les paliers de couleurs **dépendent de la taille choisie** (`paliersDeCouleurs(univers.cible_px)`,
  et le plafond est le côté du sprite). Une planche de couleurs figée à 64 mentirait à 16. Soit
  une planche par taille, soit une planche unique assumée comme une illustration du principe.

### 2c · Le fond : l'algorithme demandé est écrit depuis le 2 septembre — sur une autre source

`atelier/domaine/fond.py` porte déjà `proposer(palette)`, et sa liste de candidats est
**exactement celle que l'auteur cite** : magenta, cyan, rose vif, vert pur, violet, orange vif.
La distance employée est celle du détourage (Tchebychev), c'est-à-dire la bonne question : *le
découpage va-t-il manger une couleur du jeu ?*

Trois écarts entre ce qui existe et ce qui est demandé :

| | aujourd'hui | demandé |
|---|---|---|
| sur quoi on calcule | la **palette du projet** | l'**image de référence envoyée** à cet appel-là |
| quand on calcule | une fois, au réglage | à **chaque** appel image ou vidéo |
| sans rien à comparer | on ne propose rien, et on le dit | le **vert de studio `#00B140`** (tranché § 4·3) |
| qui décide | l'auteur, dans l'écran | l'atelier, tout seul |

⚠️ **La quatrième ligne renverse une décision datée.** L'en-tête de `fond.py` dit :
*« Il propose, il n'impose pas. […] La version précédente de la tranche voulait qu'il calcule la
couleur et l'impose ; l'auteur a tranché autrement le 2 septembre 2026. »* Le retour du
20 septembre revient au calcul imposé. **Ce n'est pas un oubli de l'auteur, c'est un changement
d'avis, et il faut l'écrire comme tel** dans `fond.py` plutôt que de laisser deux décisions
contraires coexister dans le dépôt.

Ce qu'il faut toucher, une fois la décision confirmée :

* `atelier/domaine/fond.py` — une seconde entrée qui prend des couleurs lues sur une image, et un
  repli explicite sur le vert ;
* `atelier/services/production.py:3254` (`fond(projet)` lit `univers.fond`) et `:3272`
  (`replier(interdiction(...))`, qui écrit la phrase envoyée au modèle) ;
* `atelier/services/generation.py:943` — `_fond_des_references(...)` existe déjà et applique un
  fond aux images de référence : **c'est le point d'accroche naturel**, il voit déjà les deux
  côtés ;
* `atelier/api/univers.py` — le champ `fond` du `PUT` ; le retirer casserait les univers écrits,
  le garder en lecture seule ne casse rien ;
* `interface/src/composants/ReglesDuJeu.tsx:538-620` — la section entière disparaît, avec le
  damier, le bouton *Prendre*, le bouton *Retirer* et la phrase de l'écart.

**Et il y a un coût déjà écrit** : `fond.py` prévient que changer ce qui part au fournisseur
*« invalide les comparaisons avec les tirages déjà payés »*. Le même prix se repaie ici.

### 2d · Les textes à masquer

Les deux phrases citées sont dans `ReglesDuJeu.tsx`. Passer la section du fond à la trappe (§ 2c)
emporte la première — *« ce jeu n'a pas encore de palette »* est la `raison` rendue par
`proposer()` quand la palette est vide, affichée par `{fondPropose?.raison && <Note>…}`.

La consigne générale — *« si c'est pas utile ou vital pour la configuration, tu l'enlèves »* — vise
au moins six blocs du même écran, dont celui qui explique que changer de méthode ne coûte rien,
celui qui explique le plafond de couleurs, celui qui explique que le dossier ne changera plus
jamais, et celui qui explique ce que le réalignement saute. **Cette consigne demande un passage
complet sur l'écran, pas trois suppressions** ; elle rejoint la consigne permanente déjà notée
en mémoire : *soit c'est utile et très clair, soit on ne l'écrit pas*.

⚠️ **Un garde-fou, à ne pas perdre en chemin** : l'avertissement sur la taille de case dit une
chose vraie et coûteuse — changer la taille après coup laisse les images déjà faites à leur
ancienne taille, et c'est le seul réglage de l'écran qui ne se reprend pas gratuitement.
Le masquer supprime le texte, pas le piège. Deux issues : le déplacer là où il sert
(au moment où l'on change la taille sur un jeu qui porte déjà des images), ou l'assumer perdu.
**À trancher par l'auteur, pas par nous.**

### 2e · La note collée sur la toile — le serveur sait la corriger, aucun écran ne le lui demande

**Précisé par l'auteur le jour même** : il ne s'agit ni des lignes de la bible ni des étiquettes,
mais des **cartes texte de *Univers & toile*** — *« si je colle du texte, je peux plus le
modifier »*.

Le retour est exact, et le manque est d'un seul côté :

* **le serveur sait le faire depuis `T9`.** La route `PUT /board/{carte}` accepte un champ `texte`,
  et son commentaire dit exactement pourquoi il existe : *« Le texte d'une note, corrigé en place.
  Sans lui, réparer une faute demanderait de retirer la note et de la recoller — donc de perdre sa
  place, sa teinte et les liens qui y aboutissent. »* (`atelier/api/univers.py:108`,
  `interface/src/api.ts:6210`.)
* **aucun écran ne l'envoie.** `Toile.tsx` n'appelle `reglerCarte` que par `poser()`
  (`Toile.tsx:1343-1375`), qui ne connaît que `groupe`, `position` et `largeur_libre`. Le mot
  `texte` n'apparaît jamais dans un appel. La capacité est construite, payée, testée côté serveur —
  et injoignable.

**Ce retour rejoint la toute première entrée du journal**, écrite par l'auteur avant cette séance :
les cartes texte doivent être tronquées en vue grille, et une fenêtre doit s'ouvrir pour lire le
texte complet, l'éditer, l'afficher en markdown et y chercher. **L'édition est la moitié de cette
fenêtre-là** : les deux demandes se construisent ensemble, pas l'une après l'autre.

À noter en passant, puisque la lecture l'a croisé : les **étiquettes** ne s'éditent pas non plus.
L'API en porte trois gestes — `POST /labels` (fabriquer), `POST /labels/{id}/used` (compter un
emploi), `DELETE /labels/{id}` (oublier), `atelier/api/univers.py:877-906`. Corriger une faute
oblige à oublier et refaire, et l'étiquette est partagée par tous les jeux. **Ce n'est pas ce que
l'auteur demandait ; c'est un manque du même genre, relevé et laissé en attente.**

### 2f · « Les sons » est le seul écran du jeu qui sort de l'atelier

Le retour est exact, et la cause est en une ligne. *Les sons* s'ouvre en **dialogue plein écran** :

```
App.tsx:3292   <CadreDialogue titre="Les sons du jeu" … <AtelierSon … /> />
```

`CadreDialogue` en format `atelier` (le défaut) rend un `<dialog>` `showModal()` qui fait
`h-full w-full max-w-full border-0` — il couvre tout, rend le reste inerte, et ne laisse que le
bouton *Fermer* du composant enfant.

**Son voisin dans la même liste ne fait pas ça.** *Les tuiles*, juste au-dessus dans « Ailleurs
dans le jeu », est une **surface de la pile** : `tuilesOuvertes = dans(pile, "tuiles")`, et la
navigation reste affichée, marquée sur *Les sujets* (`App.tsx:2062`). Les deux portes sont côte à
côte dans `Famille.tsx:1345-1375` et se comportent différemment.

Deux défauts, donc, et ils se réparent séparément :

1. **le cadre** — faire de *Les sons* une surface comme *Les tuiles*, plutôt qu'un dialogue ;
2. **le vide** — la copie d'écran montre un écran *entièrement blanc* sous les deux phrases
   d'introduction. Le jeu ouvert (*The Way Out reborn*) n'a aucun son, et `AtelierSon` ne dit rien
   du tout dans ce cas : ni « aucun son », ni par où commencer. Un écran vide qui ne se déclare pas
   vide se lit comme une panne.

### 2g · *Les sujets* → *Codex*

Le mot **`codex` est déjà la clé interne partout** : la surface s'appelle `codex` dans la pile de
`App.tsx`, et `Guide.tsx:211` fait la traduction `codex: "Les sujets"`. Le guide, lui, emploie les
deux. L'auteur tranche pour *Codex* à l'écran, contenant des *sujets* — le code et le nom visible
se rejoignent au lieu de diverger, ce qui est la bonne direction.

Ce qu'il faut toucher : **20 occurrences hors essais**, dans 8 fichiers de l'interface —
`NavigationAtelier.tsx:10` (la porte), `Famille.tsx` (le `<h1>`, deux `aria-label`, la phrase de
sous-titre), `lieux-noms.ts:116`, `Guide.tsx:211`, `aide.ts` (deux textes d'aide),
`Fabrications.tsx:61` (*« Créez d'abord un personnage depuis Les sujets »*), `AtelierTuiles.tsx`.
**Et 20 de plus dans les essais**, qui cherchent le libellé à l'écran : ils tomberont tous, et
c'est normal.

⚠️ Deux pièges du renommage :

* les `aria-label` (`"Les sujets du jeu"`) sont ce que les essais interrogent — les changer *avec*
  le texte visible, jamais l'un sans l'autre ;
* le mot dans le **serveur** (`atelier/domaine/projet.py`, `services/bibliotheque.py`…) n'est que
  de la prose de commentaire, jamais un libellé rendu : **ne pas y toucher** ferait diverger le
  vocabulaire du dépôt de celui de l'écran ; y toucher est un second passage, à part.

---

## 3 · Ce que ça donne comme travail, par taille

| # | Demande | Où | Taille |
|---|---|---|---|
| 1 | Vignettes sur la rangée des **tailles** | interface seule, PNG déjà présents | petite |
| 2 | Vignettes sur les quatre **méthodes** | tirage à refaire (4 méthodes, pas 6) + interface | moyenne |
| 3 | Vignettes sur les paliers de **couleurs** | tirage + question du palier dépendant de la taille | moyenne |
| 4 | **Retirer le fond**, le calculer par appel | domaine, deux services, l'API, l'écran ; renverse une décision datée | grosse |
| 5 | **Masquer les textes** qui embrouillent | passage complet sur l'écran ; **et bâtir l'endroit où le garde-fou de la taille reparaît** (§ 4·2) | moyenne |
| 6 | **Modifier une note collée** sur la toile | interface seule ; le serveur sait déjà | petite, et à faire avec la fenêtre de lecture du journal |
| 7 | *Les sons* dans l'atelier, et son écran vide qui se déclare | une surface, comme les tuiles | moyenne |
| 8 | *Les sujets* → **Codex** | 20 libellés, 8 fichiers, 20 essais à reprendre | petite mais large |

---

## 4 · Ce que l'auteur a tranché le 20 septembre 2026

Trois questions lui ont été posées le jour même ; les trois ont leur réponse.

1. **La chose à modifier dans *Univers*, ce sont les cartes texte de la toile** — ni la bible, ni
   les étiquettes. *« Si je colle du texte, je peux plus le modifier. »* Le § 2e est réécrit sur
   cette réponse.
2. **L'avertissement sur la taille de case est déplacé, pas supprimé.** Il quitte la configuration
   initiale et reparaît **au moment où l'on change la taille sur un jeu qui porte déjà des
   images** — c'est-à-dire là où il sert et où on ne peut pas l'ignorer. ⚠️ Corollaire à ne pas
   perdre : *masquer le texte* dans l'étape 2 n'est pas tout le travail ; il faut **aussi
   construire l'endroit où il reparaît**, sinon la moitié tenue est celle qui enlève le
   garde-fou.
3. **Le vert par défaut est le vert de studio, `#00B140`** — pas le `#00FF00` que `fond.py` porte
   déjà sous le nom *pure green*. C'est donc **un septième candidat à écrire**, pas un candidat
   existant à réemployer, et il n'entre pas dans la liste des six : il est le **repli**, celui
   qu'on prend quand aucune image de référence ne permet de calculer.

## 5 · Ce qui reste ouvert

* **Le Codex et le vocabulaire du serveur** : la porte devient *Codex* à l'écran. Les commentaires
  du serveur, qui disent *« les sujets du jeu »* partout, suivent-ils dans un second passage, ou le
  mot reste-t-il un nom d'écran seulement ?
* **La planche des couleurs et le palier dépendant de la taille** (§ 2b) : une planche par taille,
  ou une planche unique assumée comme illustration du principe ?
* **Les étiquettes non modifiables** (§ 2e, dernier paragraphe) : relevé, jamais demandé. À
  prendre ou à laisser.
