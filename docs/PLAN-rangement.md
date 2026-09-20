# Le rangement — qui est quoi, et ce que chacun peut avoir

> Demandé par l'auteur le 20 septembre 2026, après une séance d'usage sur les matières de
> tuiles : « c'est un peu bancal tout ce système… il faut mettre de la logique et bien penser
> tout ça une fois pour toutes. Qui est quoi et peut avoir quoi, et faire ou ne pas faire quoi. »
>
> Quel modèle sur quelle tranche : [PLAN-rangement-affectation.md](PLAN-rangement-affectation.md).
>
> La maquette des deux colonnes : <https://claude.ai/artifact/Kq2BmNcULrPdB8HzkQeREo>
> (avant/après, fiche d'une image et colonne des sujets).
>
> **Où en est le chantier (20 septembre 2026).** Rien n'est fait, sauf le correctif qui a
> révélé le problème : voir « Ce qui a déclenché ce plan ».

## Ce qui a déclenché ce plan

L'auteur a généré des matières pour un jeu de tuiles et les a trouvées **détourées et
recolorées**, sans savoir pourquoi. Trois symptômes, une seule cause.

1. Le barème du projet est **recopié dans son fichier à sa création**, et rien ne le complétait
   ensuite. `la-foret-magique` n'avait donc pas la nature « matière », arrivée en TU2.
2. L'échelle restant introuvable, `Univers.recette_de` retombait sur `silhouette=True` : chaque
   matière naissait **découpée et recadrée comme un personnage**.
3. Sans cette nature, aucun sujet ne pouvait la porter, donc l'onglet « Mes matières » de
   l'écran des tuiles restait **vide par construction** — et l'auteur ne pouvait pas y ranger
   ses images.

Corrigé le 19 septembre par `bareme_complete` (`atelier/domaine/projet.py`) : un barème relu
reçoit les natures du barème par défaut qui lui manquent. Vérifié sur `la-foret-magique`
(plus de passe, plus de recadrage ; grille 96 px et quantification 64 couleurs conservées).

**Mais le correctif ne répare qu'un symptôme.** La page d'un sujet de nature « matière » ouvre
sur un onglet *Animations*, avec un filtre *Direction* et un bouton *Tout animer*, et écrit
juste dessous « Ce type d'objet ne réclame aucune pose ». L'écran propose ce qu'il vient de
déclarer impossible. C'est ce plan-là.

## Le mensonge de fond

L'application prétend que **tout ce qui porte des images est un sujet**. C'est déjà faux :
l'équipement n'en est pas un, les sons n'en sont pas, les jeux de tuiles n'en sont pas. La
demi-mesure est ce qui produit les écrans à moitié gris.

Le critère qui range vraiment est celui-ci : **est-ce que ça part dans le jeu ?**

| Rang | Ce que c'est | Qui | Ce que ça a |
|---|---|---|---|
| **Les sujets** | une chose du jeu, livrée telle quelle | personnage, créature, meuble, objet posé, objet tenu, décor, tuile, élément d'interface | fiche, objectif, poses, images, livraison |
| **Ce qui se compose** | fabriqué à partir d'autres images, livré à Godot | jeux de tuiles, équipement | une recette, des révisions, une livraison |
| **Les ingrédients** | ne part jamais seul | **matières**, images de référence, guides de style | un nom, une image, une collection |

Une matière est un ingrédient : Godot reçoit l'atlas, jamais la matière. La ranger parmi les
sujets, c'est la ranger parmi les choses qui se livrent — d'où la page qui lui propose une
livraison, des poses et des animations.

## Décisions d'architecture

**D1 · Une nature déclare ce qu'elle peut, et le produit l'écrit.**
Décidé le 20 septembre 2026, contre un réglage par l'auteur. Une nature répond à six questions ;
l'écran n'affiche que ce dont la réponse est oui. Une nature écrite à la main par l'auteur prend
les réponses d'un décor, et sa silhouette reste réglable comme aujourd'hui.

| Nature | Se découpe | Poses | Directions | S'anime | Sons | Sert de matière |
|---|---|---|---|---|---|---|
| personnage | oui | 6, du jeu | oui | oui | oui | — |
| créature | oui | 6, du jeu | oui | oui | oui | — |
| meuble | oui | 3 états | — | oui | oui | — |
| objet posé | oui | 1 | — | — | oui | — |
| objet tenu | oui | 1 | — | — | oui | — |
| décor | — | — | — | oui | oui | — |
| tuile | — | — | — | oui | — | — |
| matière | — | — | — | — | — | oui |
| élément d'interface | oui | 4 états | — | oui | oui | — |

`se découpe` et `poses` existent déjà (`Echelle.silhouette`, `PLANS_PAR_TYPE`) ; les quatre
autres colonnes sont à écrire.

**D2 · Un décor et une tuile s'animent, une matière non.**
Décidé le 20 septembre 2026. L'eau qui coule, une torche, l'herbe qui bouge sont des tuiles et
des décors animés — le besoin est réel. Une matière, elle, est une texture : c'est le jeu de
tuiles qui l'anime (`reglages.animation`, TU2), jamais elle.

**D3 · L'équipement reste à part.**
Décidé le 20 septembre 2026. Ce n'est pas un sujet : c'est un calque posé sur un porteur, qui
suit ses poses et ses directions. Il garde sa rubrique, sous « Ce qui se compose ».

**D4 · Les matières quittent les sujets.**
Décidé le 20 septembre 2026, après avoir pesé l'usage final. Une matière devient une entrée de
la **bibliothèque des matières du projet**, tenue par l'écran des tuiles. Ce qu'elle perd — une
fiche de sujet, un objectif, une livraison — ne veut rien dire pour une texture. Ce qu'elle
gagne : on cesse de créer un faux personnage pour ranger une image.

*Le motif décisif vient de l'agent.* `generate_tile_material` rend des images de nature
« matière », mais aucun outil MCP ne crée un sujet pour les porter — le seul qui existe
s'appelle `create_character`. Un agent qui génère des matières produit donc aujourd'hui des
images que l'écran des tuiles ne verra jamais. Le rang « ingrédient » supprime le besoin.

**D5 · Le barème se complète à la relecture, pas par une migration jouée une fois.**
Décidé le 19 septembre 2026 (`bareme_complete`). Contrepartie assumée : une nature du barème par
défaut supprimée exprès réapparaît. Le prix a été préféré à un piège reposé pour la nature
suivante. Conséquence à tenir : entre la relecture et le prochain enregistrement, l'écran Univers
montre une nature que le fichier ne porte pas encore.

## Les tranches

### RG1 · Une nature dit ce qu'elle peut

**Bloquée par** : rien.

La table de D1 entre dans le domaine, à côté de `PLANS_PAR_TYPE` : quatre capacités de plus par
nature (directions, animations, sons, sert de matière), lues par une seule fonction. Rien ne
change à l'écran dans cette tranche — c'est le socle des deux suivantes.

- [ ] Une fonction unique répond « cette nature a-t-elle des directions / des animations / des
      sons ? », et la table de D1 est celle du plan, au mot près.
- [ ] Une nature inconnue — écrite à la main par l'auteur — prend les réponses d'un décor, et
      un essai le prouve plutôt que de le supposer.
- [ ] Les deux capacités qui existaient déjà (`silhouette`, poses) ne sont pas recopiées : la
      fonction les lit où elles vivent, sinon deux tables diraient bientôt deux choses.

### RG2 · La page d'un sujet ne montre que ce qui s'applique

**Bloquée par** : RG1.

Les onglets *Animations*, *Sons*, les filtres *Direction* et *Mouvement / pose*, le bouton
*Découper une image* : chacun paraît si la nature le porte, et disparaît sinon — jamais grisé
sans raison.

- [ ] La page d'une matière n'a plus d'onglet Animations ni de filtre Direction.
- [ ] La page d'un personnage est inchangée, au pixel près.
- [ ] Aucun onglet n'est grisé sans une phrase qui dit pourquoi ; un onglet qui ne s'applique
      pas n'existe pas.

### RG3 · La fiche d'une image, en trois zones

**Bloquée par** : rien. Maquette : `Fiche-apres` de l'artifact.

La colonne de droite passe de dix-sept blocs à la file à trois zones, toujours dans le même
ordre : **où elle est rangée** (le seul endroit où l'on décide), **s'en resservir**, **d'où elle
vient** (replié).

- [ ] « Corps de » s'appelle « Sujet », et la case Pose dit pourquoi elle est vide (« une
      matière n'a pas de pose ») au lieu d'être grisée sans raison.
- [ ] « Réinjecter » est écrit en français et dit ce que ça fait.
- [ ] « Imposé par le jeu » et « Sa recette » fusionnent en un seul bloc, qui donne la valeur
      **et la raison** : « Découpe du contour : non — une matière remplit son cadre ». C'est la
      ligne qui aurait permis à l'auteur de trouver le défaut seul.
- [ ] Favori et Supprimer sont dans la zone des décisions, pas au milieu du texte descriptif.

### RG4 · La colonne de gauche des sujets

**Bloquée par** : RG1. Maquette : `Sujets-apres` de l'artifact.

- [ ] Le champ de recherche cherche ce qu'il annonce — les sujets **et** les collections.
- [ ] Une famille ouverte montre ses natures avec leur compte ; une nature se clique.
- [ ] Les familles vides tiennent sur une ligne dépliable, au lieu de trois lignes à zéro.
- [ ] « Les tuiles », « Les sons » et la galerie passent sous un titre qui dit que ce ne sont
      pas des familles.

### RG5 · Les matières deviennent une bibliothèque

**Bloquée par** : RG1.

Le rang « ingrédient » côté serveur : une matière est une image du projet marquée comme telle,
groupable en collections, sans sujet porteur.

- [ ] Une matière existe sans sujet, et se liste par une route dédiée.
- [ ] Les collections existantes la rangent, sans nouveau mécanisme de groupement.
- [ ] Une matière n'a ni objectif, ni poses, ni livraison propre — et les routes qui en
      proposent la refusent avec une phrase en clair.

### RG6 · L'écran des tuiles adopte la bibliothèque

**Bloquée par** : RG5.

- [ ] « Mes matières » lit la bibliothèque, plus les images des sujets de nature « matière ».
- [ ] L'onglet n'est plus vide par construction : une matière générée y paraît sans qu'on ait
      rien rangé.
- [ ] Une image ordinaire de la galerie peut être déclarée matière depuis sa fiche, en un geste.

### RG7 · L'agent voit les matières

**Bloquée par** : RG5.

- [ ] Un outil MCP liste les matières du projet, avec ce qu'il faut pour les poser dans une
      recette.
- [ ] `generate_tile_material` dépose ses tirages dans la bibliothèque, sans sujet à créer.
- [ ] Un agent enchaîne « générer une matière » puis « composer un jeu de tuiles » sans passer
      par l'écran, et l'essai le prouve de bout en bout.

### RG8 · La migration, et la relecture croisée

**Bloquée par** : RG6, RG7.

- [ ] Les matières déjà rangées dans un sujet rejoignent la bibliothèque sans perdre leur nom.
- [ ] Les images nées détourées avant le correctif sont retrouvables, et l'écran dit si l'on
      peut leur réappliquer la recette sans les regénérer.
- [ ] Une relecture croise ce plan, les écrans livrés et la maquette : aucun des trois ne dit
      ce que les deux autres démentent.

## Ce que ce plan ne couvre pas

- Le moteur des tuiles, ses masques et ses exports (`PLAN-tuiles.md`).
- La palette de l'univers imposée aux matières à leur naissance (64 couleurs relevées sur les
  artworks). C'est une part de la « coloration » que l'auteur a vue, et elle est **voulue** —
  mais elle n'a jamais été expliquée à l'écran. À traiter à part.
- Le nommage des familles elles-mêmes (Personnages, Décors, Objets, Interface) : elles ne
  bougent pas.

## Questions laissées ouvertes

- **Une matière peut-elle servir ailleurs que dans les tuiles ?** Un fond d'écran, une texture
  d'objet 3D. Si oui, la bibliothèque n'appartient plus à l'écran des tuiles mais au projet, et
  l'écran des tuiles n'en est qu'un lecteur. Décidé à RG5, pas avant.
- **La nature « tuile » a-t-elle encore un sens** une fois que les jeux de tuiles se fabriquent
  par recette ? Elle sert au chemin « à partir d'une image déjà faite » (AU13). À revoir quand
  ce chemin sera mesuré.
