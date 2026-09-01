- dans l'onglet univers, les cartes de type texte doivent être améliorer : 
> déjà le texte doit être tronqué visuellement pour ne montrer que les premières lignes (en vue grille ou univers)
> en vue tuile, pour les cartes textes, il devrait y avoir un bouton pour afficher le texte complet qui ouvre une popup permettant de voir le texte complet et pouvoir l'éditer
> le texte doit supoorter et interprêter le markdown pour la mise en page. 
> dans la popup de visualisation et d'édition on doit avoir la possibilité de faire une recherche dans le texte. et d'afficher le résultat de la recherche en mettant en surbrillance le texte trouvé.


- dans les réglages, le "modèle d'exploration" n'est pas compréhensible. a quel moment il s'applique, a quoi sert cette option ? car la si on lit l'infobulle on comprend que ca impose un modèle quel que soit les réglages choisis. Et ca ne se reflète pas dans l'atelier quand on change un modèle (ca devrait indiqué clairement que cette option est active et qu'on peu pas choisir de modèle si c'est le cas) sauf si cette option intervient que quand on dépasse le plafon de la séance réglé dans les réglages. mais dans tout les cas ces deux options sont assez obscure et pas indiqué clairement. Surtout qu'un plafond par séance n'a pas trop de sens : fermer et reouvrir relance le plafond a zero... ca controle des dépense d'une manioère étrange et inutile. 


- plus tard j'aimerai quand même avoir le détail des couts par projet et pour toute l'app. pas un truc ultra détaillé mais qui permet de savoir combien le projet a couté a peu prés. 


- dans le projet "coeur de pierre - 01" j'ai importer mon propre asset (une image avec 4 postude de mon personnage). j'ai utiliser l'outil de découpe sur l'image balthazar start.jfif et en résultat j'ai 4 image dansl a grille mais sans visuel. comme si la découpe n'avais pas marché (problème de format don penser a ajouer un convertisseur ?). j'ai testé avec un jpeg c'est pareil. Par contre si je fait un détourage avant la ca marche sur le jpeg. bref a controler et tester.

- l'outil de découpe est trop cacher, c'est un outil plutot important qu'il faudrait bien voir sur une fiche. 

- l'outil pour générer "ce qu'on porte" sur un personnage est a améliorer (je pense qu'il n'est pas fini). mes remarques pour le moment : 
on peut pas choisir si c'est un calque ou un corps habillé. il manque l'outil pour créer le calque par différence avec retouceh manuelle. si on envoi une pose d'un personnage qui contient plusieurs direction, ca doit créer une planche avec les 4 directions de l'habit en une génération, la ca prend la dernière iamge seulement de la pose. deplus si l'objet générer ne rentre pas dans le cadre il est coupé, il faut donc avoyer une version avec des marge de sécurité peut-être ? 


---

## Séance du 1<sup>er</sup> septembre 2026 — quatre remarques de plus

*Relevées pendant que le lot « l'assistant refait » était en cours. À traiter en suivant :
analyse mesurée, maquette, propositions, puis développement.*

- ~~**Univers > toile — un mode édition sur une image posée.**~~ Quand on pose une image, on
  voudrait pouvoir la découper en plusieurs, la recadrer, détourer son fond, sans quitter la
  toile. Les tables de l'établi portent déjà tous ces outils ; il s'agit de pouvoir en employer
  un seul, isolément, ici. **Le cas réel** : un artwork importé contient trois personnages sur
  un fond ; on veut en faire trois artworks séparés, et on ne veut pas que le fond entre dans
  la palette quand on promeut l'image en artwork officiel.

  **Fait le 1<sup>er</sup> septembre 2026.** Maquette
  `docs/maquettes-v2.1/06bis-decouper-une-carte.html`, construite le jour même. Le menu d'une
  carte gagne *Découper ›*, qui ouvre l'écran de découpe sur elle ; ses morceaux sont des
  cartes du même tableau, qui arrivent en réserve, non promues. Recadrer est la même découpe à
  un seul rectangle, avec une case — décochée — qui fait hériter le morceau de tout ce qui
  faisait l'originale et emporte celle-ci.

  **Le troisième verbe a été mesuré, et il n'a rien donné à construire.** Le fond n'entre
  *déjà* pas dans la palette : `palette_de()` détoure depuis toujours, et sur les six artworks
  officiels du dépôt il écarte de 30 à 60 % des pixels, à raison — sans lui, la palette du
  donjon passe de 6 à 34 couleurs presque noires. Ce qui pollue une palette, ce sont les
  **voisins** : un titre d'interface, une barre de vie, un second personnage dans le cadre.
  Il n'y a donc pas d'outil de gommage ; il y a une **fenêtre** — le pour-cent dans le menu de
  la carte, et l'image en magenta dans l'écran de découpe, qui montre ce qui est écarté.
  Contre-épreuve gardée avec : découper améliore la palette une fois sur deux, jamais
  systématiquement, et l'écran ne le promet pas.

- **Codex — des catégories pour ranger les choses du jeu.** Sur un jeu qui a beaucoup d'assets,
  la liste devient vite chargée. Regrouper les personnages par *héros*, *méchants*,
  *bestiaire*… Une famille dit déjà ce qu'une chose *est* ; ce qui manque est où l'auteur la
  range.

- **Le panneau « réglages de l'appel » ne se referme pas.** Ouvert, on ne le voit pas, et on ne
  sait pas où cliquer pour le refermer. **Et la remarque générale qui va avec** : l'interface
  manque de fluidité, beaucoup de choses sont trop textuelles et peu naturelles à trouver sans
  chercher.

- **Le prompt d'une pose ne tient pas la vue du jeu — c'est un défaut, pas une préférence.**
  Mesuré sur le jeu *Test v2*, vue *de dessus, verticale*. Le texte envoyé était :

  ```
  World: Royaume de tourbe et de fer, marais au nord, vieux chemins boueux, ruines médiévales
  Era: Haut Moyen Âge, avant la poudre
  Rendering technique: 2D pixel art on a 64x64 grid
  Line and shading: Contour brun d'1 pixel, aplats de couleurs, aucun dégradé
  Lighting: Lumière rasante, ambiance sombre, ombres portées courtes
  View and framing: strict top-down view seen from directly above
  Technical constraints: Sprite isolé sur fond plat, grille stricte 32×32 px, pas de perspective

  Cape verte sombre
  Tunique beige
  Bottes brunes
  Petit sac à dos
  Torche dans une main, idle stance, full body
  ```

  **Ce qui est sorti** : des vues de face, ressemblant à l'image de référence qui était de face.
  La consigne de vue est noyée en sixième position sur sept, entre deux lignes qui la
  contredisent — `Technical constraints` dit *pas de perspective* et une grille de 32 quand le
  réglage dit 64 —, et l'image de référence, elle, montre le contraire de ce que le texte
  demande. **Il faut que l'atelier écrive des prompts hiérarchisés et efficaces** : ce qui décide
  du cadrage et de la pose doit passer devant, pas derrière la couleur des bottes.

  *Trois pistes déjà visibles en lisant la donnée du jeu, à vérifier avant de dessiner :*
  l'ordre des sept cases est celui de la fiction vers le cadre, donc le cadre finit dernier ;
  la case `technique` de ce jeu est tapée à la main et contredit deux réglages ; et rien ne dit
  au modèle que l'image jointe est une **référence de style** et non une **référence de pose**.
