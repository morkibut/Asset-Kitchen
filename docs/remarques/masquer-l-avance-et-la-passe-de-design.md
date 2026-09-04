# Masquer l'avancé, et la grosse passe de design

> **De quoi on parle.** L'atelier est un instrument dense : beaucoup de réglages visibles, peu
> d'ornement, presque aucune icône. Ce n'est pas un accident — c'est une direction écrite, tenue
> depuis le premier jour. La remarque demande de la revoir.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> j'ai une idée qui me parait pas si bête : dans tout les écrans et interface du jeu, il faut
> afficher que ce qui est le plus utile et qui est facile a comprendre et a prendre en main, tout le
> reste, doit être masqué par défaut ouvrable avec des bouton de réglages avancés. Ca permettrait
> d'alléger visuellement cette interface hyper chargé qui assome d'infos technique etc... Deplsu je
> pense qu'il va vraiment falloir faire une grosse passe de design pour ajouter des icones, des
> boutons, des feedbacks, bref tout ce qui pourrait moderniser et fluidifier l'experience
> utilisateur. c'set un gros chantier a voir bientôt car plus ca va plus on rajoute de choses et
> plsu ca va etre compliqué de tout repenser. a noter également : l'idée d'adapter les couleurs de
> l'interface a la palette du jeu ouvert (ce serait stylé et boosterai la créativité).

**Ce sont quatre demandes**, et elles n'ont pas le même statut : masquer l'avancé, ajouter des
icônes et des retours visuels, moderniser l'ensemble, et teinter l'interface aux couleurs du jeu
ouvert.

---

## 2 · Ce que le produit fait aujourd'hui

### a) ⚠️ La grosse passe de design a déjà eu lieu — sur le papier

**`docs/audit-design-post-v21.html`, 31 août 2026.** Un audit complet du produit, écrit en clair,
qui relève **quatorze défauts** classés par ce qu'ils coûtent à l'usage :

> le zoom absent des tables · les chiffres trop petits et trop pâles · le document de l'univers
> illisible · rien ne dit qu'on peut cliquer · Échap qui ne ferme pas · vingt-six mégaoctets pour
> quarante-neuf vignettes · un réglage par écran et sept dixièmes de vide · le guide qui décrit un
> écran disparu · deux boutons de noms différents au même endroit · deux barres d'outils qui se
> recouvrent · le bouton *supprimer* hors de l'écran · la description écrite par un hublot de
> quatre lignes · la vitrine écrasée · une bascule qui dit *appuyée* pour ce qui a disparu

**Il est cité par `DESIGN.md` et par `PIEGES.md`. Il n'est cité nulle part dans `docs/PLAN.md`** —
zéro occurrence. Ses quatorze défauts ne sont jamais devenus une liste de choses à faire.

**Et une bonne partie a pourtant été réparée, sans que personne ne le note.** Sondé le 4 septembre
2026, trois défauts sur quatorze pris au hasard :

| Le défaut de l'audit | Aujourd'hui |
|---|---|
| *Échap ne ferme pas ce qu'on ouvre* | **fait** — quatorze écrans écoutent la touche |
| *la galerie télécharge 26 Mo pour 49 vignettes* | **fait** — les vignettes sont calibrées, employées dans quatre écrans |
| *la description s'écrit par un hublot de quatre lignes* | **fait** — le champ va de 3 à 16 lignes |
| *le zoom absent des tables* | **pas fait** — c'est `G10`, écrite au plan |

**Personne ne sait donc où en est cette passe.** Elle a avancé par ricochet, tranche après tranche,
et son propre document ne le dit pas.

### b) « Masquer l'avancé » n'est pas interdit — il a une forme obligée

Le dépôt a un mécanisme pour ça, et une règle qui va avec, écrite le 27 août 2026 :

> **le bloc repliable**, et *un bloc replié porte son réglage à droite de son titre* — *« sans elle,
> le repli cacherait au lieu de résumer, et un panneau plié se lirait moins bien que déplié »*

**Ce n'est donc pas la demande qui est refusée, c'est le repli muet.** Un bloc qu'on masque doit
continuer de dire ce qu'il vaut. La demande est compatible ; sa forme est déjà tranchée.

### c) Les icônes, elles, sont refusées par écrit — et le refus a déjà été payé

`docs/DESIGN.md` écrit noir sur blanc : *« Aucun dégradé, aucune ombre décorative, **aucune icône
illustrative**, aucun coin arrondi de confort »*, et **le produit ne compte que trois glyphes** —
`+`, le triangle plein, `×`.

**Ce n'est pas une position de principe, c'est un choix déjà éprouvé** : les premières maquettes
dessinaient une roue dentée et un point d'interrogation entouré ; *« les deux ont été retirés, et
remplacés par des mots »*. Et la V2.1 a redessiné **vingt-six écrans** sans une couleur neuve, sans
un glyphe neuf, sans une largeur inventée — c'est ce que le document donne comme preuve que le
système tient.

**Les retours visuels animés tombent sous la même règle** : *« l'absence de mouvement retire la
concurrence d'attention »*.

### d) Teinter l'interface aux couleurs du jeu contredit le principe fondateur

Le document énonce **un principe unique dont tout découle** : *« chaque décision retire une
concurrence à la grille. **Le froid retire la concurrence chromatique.** »* Le mood est *« froid,
sec, silencieux. L'interface se retire pour que l'image passe devant. »*

**Et le cas exact a déjà été jugé.** La maquette du 26 août 2026 proposait un châssis ambre sur
charbon ; elle a été écartée avec sa raison : *« entre en concurrence avec le pixel art, qui sature
déjà les ors et les bruns »*. Teinter l'interface à la palette du jeu ouvert, c'est cette maquette,
en automatique.

---

## 3 · Pourquoi c'est comme ça

**La densité n'est pas un défaut du produit : c'est sa thèse.** *« La densité est celle d'un
instrument, pas d'une page. »* L'atelier a été dessiné comme Lightroom ou Aseprite, pas comme un
site — et pour la raison écrite : ce qu'on regarde, c'est l'image, et tout le reste doit s'effacer
derrière elle.

**La remarque vient d'un usage réel, et elle n'est donc pas à balayer.** Un auteur qui trouve son
outil assommant a raison sur le ressenti, quelle que soit la thèse. **Ce qui est en jeu n'est pas de
savoir qui a raison, c'est de savoir si l'on rouvre la direction — par écrit, comme le dépôt rouvre
ses décisions — ou si l'on cherche la fluidité sans la toucher.**

---

## 4 · Ce qui borne la solution

- **Un repli doit résumer, jamais cacher.** La règle est écrite et elle est bonne.
- **Une direction de design ne se contourne pas en silence.** Si l'on ajoute des icônes ou de la
  couleur, on réécrit `DESIGN.md` avec la nouvelle raison — c'est le motif du dépôt.
- **La V2.1 est la preuve du système** : vingt-six écrans sans un glyphe neuf. Le renverser coûte
  cette preuve.
- **L'audit existe et n'a pas de suite.** Toute passe de design qui ne partirait pas de lui
  referait un travail déjà payé.
- **`G7` refait déjà l'écran le plus chargé**, et `G3` rebranche vingt-trois explications
  décrochées : deux tranches écrites visent déjà la charge dont l'auteur se plaint.

---

## 5 · Les pistes

### A · Reprendre l'audit, et le transformer en liste

Relire les quatorze défauts, marquer ce qui est fait, et écrire ce qui reste dans le plan. **Aucune
décision de design n'est touchée**, et l'on saurait enfin où en est la passe.

**Ce que ça coûte** — une relecture et un relevé, gratuits. **Le risque** — aucun. *C'est le
préalable de tout le reste : sans lui, on redessine ce qui a déjà été redessiné.*

### B · Masquer l'avancé, avec la règle du repli qui résume

Passer les écrans les plus chargés en revue et replier ce qui est avancé — chaque bloc replié
portant sa valeur à droite de son titre.

**Ce que ça coûte** — une passe écran par écran, moyenne. **Le risque** — le repli est un jugement :
ce qui est *avancé* pour l'un est quotidien pour l'autre, et le dépôt n'a aucune mesure de qui
ouvre quoi. **Sans mesure, on plie au hasard.**

### C · Rouvrir la direction de design, par écrit

Écrire une décision datée qui dit ce qui change — icônes, mouvement, couleur — et pourquoi la raison
d'origine ne tient plus. Puis refaire les écrans.

**Ce que ça coûte** — le plus gros chantier du dépôt, et il touche tout. **Le risque** — les trois
règles visées ont chacune une raison mesurée derrière elles, et l'une d'elles a déjà été testée et
rejetée sur une vraie maquette. *À ne pas ouvrir sans avoir vu ce que `A` et `B` donnent.*

### D · La teinte de l'interface, prise à part

C'est la seule des quatre demandes qui soit **entièrement indépendante** des autres, et la seule qui
contredise le principe fondateur du document. Elle mérite sa propre décision — oui ou non — plutôt
que d'être noyée dans une passe.

**Ce que ça coûte** — techniquement peu : la palette du jeu est déjà calculée. **Le risque** — c'est
exactement la maquette écartée le 26 août 2026, et elle l'a été après essai.

---

## 6 · Ce qui est tranché

*Rien n'est encore tranché.* **La remarque avait déjà été écartée du périmètre de la V3.1 le
3 septembre 2026** — *« à reprendre après la V3, voire plus tard »* — et rien ici ne demande de
revenir sur ce report.

**La recommandation est `A`, et elle peut se faire tout de suite, gratuitement.** Reprendre l'audit
et dire ce qu'il en reste ne coûte qu'une relecture, ne touche à aucune décision, et **change la
nature de la remarque** : on saurait si la charge dont l'auteur se plaint est un défaut déjà relevé
ou une direction à rouvrir. `B`, `C` et `D` se jugent après, et pas avant.

---

## Ce que cette remarque recoupe

- **`G3`** — les vingt-trois explications décrochées. C'est la charge prise par l'autre bout : le
  produit n'est pas seulement dense, il explique ailleurs que là où l'on regarde.
- **`G7`** — l'écran de l'univers se refait, et c'est l'écran le plus chargé. **Une passe de design
  qui commencerait ailleurs referait ce travail.**
- **`G8`** — l'accueil s'ouvre sur chaque jeu neuf. L'audit note que l'assistant de démarrage est
  *« le plus gros manque restant »* de son propre examen.
- **`docs/audit-design-post-v21.html`** — quatorze défauts, jamais entrés au plan.
