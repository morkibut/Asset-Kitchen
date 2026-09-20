# Plan : les retours du 20 septembre — voir avant de choisir

> **Source** : [`docs/remarques/voir-avant-de-choisir.md`](remarques/voir-avant-de-choisir.md), qui
> porte les huit retours de l'auteur mot pour mot, ce que la lecture du code en dit, et les trois
> décisions qu'il a prises le jour même. Le brut daté est au bout de
> [`docs/remarques/journal.md`](remarques/journal.md).
>
> **Ouvert le 21 septembre 2026, et il passe devant *Le coup de main***
> ([`PLAN-assistant.md`](PLAN-assistant.md)) — décidé par l'auteur. Ce sont des défauts vus à
> l'usage, sur l'écran que traverse tout nouveau jeu ; le coup de main est une capacité neuve qui
> ne bloque rien et que rien ne bloque.
>
> **Aucun chevauchement avec un chantier en cours**, vérifié à l'ouverture : *La remise à plat* est
> close depuis le 16 septembre, *Le guide* depuis le 20, *Le rangement* est fusionné dans `main`
> (commit `2127f71`). `RG4` a touché la colonne de gauche où vit la porte *Les sons* (`RT8`), mais
> elle est arrivée ; il n'y a pas deux mains dessus.
>
> **Ce chantier ne dépense rien.** Aucune tranche n'appelle un modèle payé : les aperçus se
> calculent sur la machine, le reste est de l'écran et du texte. ⚠️ Une seule exception à
> surveiller, et elle ne coûte pas d'argent mais des comparaisons : `RT3` change ce qui part au
> fournisseur — voir l'avertissement sous la tranche.
>
> Quel modèle sur quelle tranche : [`PLAN-retours-du-20-septembre-affectation.md`](PLAN-retours-du-20-septembre-affectation.md).

---

## Ce que c'est, en une phrase

**On choisit en voyant, et on ne lit que ce qui sert.**

## Ce que c'est, en trois gestes

1. On crée un jeu. À l'étape de son allure, chaque rangée — la taille, la pixelisation, les
   couleurs — montre le rôdeur tel qu'il sortira. On clique ce qu'on voit.
2. On ne règle plus la couleur de fond : l'atelier prend, à chaque demande, celle qui s'éloigne le
   plus de l'image de référence envoyée.
3. Les phrases qui expliquaient des choses qu'on n'a pas encore rencontrées ont disparu. Celle qui
   comptait vraiment reparaît au moment où elle compte.

## Ce que ce n'est pas

- **Pas une refonte de l'étape.** L'ordre des quatre questions, les deux cartes de style et le
  parcours ne bougent pas. On rend visible ce qui était écrit, et on efface ce qui n'aurait pas dû
  l'être.
- **Pas un nouveau moteur d'image.** Les quatre méthodes de réduction et la quantification
  existent, éprouvées ; on leur ouvre une fenêtre.
- **Pas une dépense.** Rien de ce chantier n'appelle un fournisseur.

---

## Décisions d'architecture

Elles valent pour toutes les tranches et ne rebougent pas en cours de route.

- **L'aperçu se calcule sur la machine, jamais dans le navigateur.** Le moteur du navigateur
  (`interface/src/tuiles/moteur/`) sait quantifier et rééchantillonner, mais il ne connaît **pas**
  les quatre méthodes de réduction de l'écran — elles vivent en Python, et `pixeloe` tire `torch`
  derrière elle. Un aperçu à moitié exact serait pire qu'un aperçu absent : il montrerait un
  résultat que la vraie fabrication ne rendra pas. ⚠️ **Et le moteur recopié de sc-clone ne se
  modifie pas** — il est lu, jamais touché.
- **L'aperçu se garde.** Une combinaison (image, taille, méthode, couleurs) déjà calculée revient
  du disque. Sans ce cache, ouvrir l'étape referait neuf réductions dont une par `torch`.
- **L'aperçu se fait toujours sur le rôdeur**, même quand le jeu porte déjà des images. Comparer
  neuf tailles n'a de sens que si le sujet ne bouge pas, et c'est déjà l'image des deux cartes de
  style, juste au-dessus. *(Arbitré le 21 septembre 2026 ; l'auteur peut le renverser, mais alors
  la comparaison change de nature.)*
- **Le fond n'est plus un réglage du jeu, c'est un calcul par demande.** ⚠️ **Ceci renverse une
  décision datée** : `atelier/domaine/fond.py` porte, en tête, *« Il propose, il n'impose pas […]
  l'auteur a tranché autrement le 2 septembre 2026 »*. L'auteur a changé d'avis le 20 septembre.
  **La tranche `RT3` doit réécrire ce paragraphe**, pas le laisser contredire le code qu'il coiffe.
- **Le vert de repli est `#00B140`**, le vert de studio — un **septième** candidat, à écrire. Il
  n'entre pas dans la liste des six (`CANDIDATS`) : il n'est pas un concurrent qu'on élit, il est
  ce qu'on prend quand il n'y a rien à comparer.
- **Le champ `fond` de l'univers reste lisible.** Les jeux déjà écrits le portent sur le disque ;
  le retirer du modèle casserait leur relecture. Il cesse d'être écrit et cesse d'être lu par la
  production — il ne devient pas inexistant.
- **Le mot *Codex* est un nom d'écran, pas un renommage du dépôt.** La clé interne est `codex`
  depuis toujours ; c'est l'écran qui la rejoint. Les commentaires du serveur qui disent *« les
  sujets du jeu »* ne sont pas touchés par ce chantier.

---

## RT1 · L'aperçu se calcule sur la machine, et se garde

**Retour couvert** : 1, 2 et 3 (leur moitié serveur).

**Bloquée par** : aucune — démarrable immédiatement.

### Ce qu'on livre

Une route qui rend le rôdeur passé par une combinaison de réglages — une taille, une méthode de
réduction, un nombre de couleurs — et qui garde le résultat. Redemandée, la même combinaison
revient du disque sans recalculer.

C'est le mécanisme des tables de l'atelier de bande, appliqué à l'étape de l'allure : *les tables
rendent une recette complète à chaque geste*, et rien n'est payé.

### Critères d'acceptation

- [ ] Une combinaison demandée rend une image, calculée par le **même** moteur que la vraie
      fabrication — pas une approximation.
- [ ] La même combinaison redemandée revient du disque ; le second appel ne relance aucun calcul.
- [ ] La méthode qui tire `torch` ne le charge que si on la demande. Ouvrir l'étape sans cliquer
      cette méthode-là n'importe pas `torch`.
- [ ] Une combinaison impossible — un nombre de couleurs au-dessus de ce que la taille peut porter
      — reçoit un refus qui la nomme, jamais une image muette ni une erreur nue.
- [ ] Rien n'est envoyé à un fournisseur. Aucune ligne de dépense n'apparaît.

---

## RT2 · Les trois rangées montrent ce qu'elles font

**Retour couvert** : 1, 2 et 3.

**Bloquée par** : RT1.

### Ce qu'on livre

À l'étape *Son allure*, les trois rangées de boutons nus deviennent trois rangées d'images :

- **la taille** — le rôdeur à 8, 16, 24, 32, 48, 64, 96, 128, 256 ;
- **la pixelisation** — le rôdeur réduit par chacune des quatre méthodes, à la taille choisie ;
- **les couleurs** — le rôdeur au nombre de couleurs de chaque palier, à la taille et par la
  méthode choisies.

Chaque case montre exactement ce qu'elle annonce. Changer la taille refait les deux rangées du
dessous, puisque leur résultat en dépend.

### Critères d'acceptation

- [ ] Les trois rangées montrent une image par choix, et l'image correspond au choix qu'elle
      porte.
- [ ] Changer la taille met à jour la rangée des méthodes et celle des couleurs.
- [ ] Le choix retenu se voit sans lire — une marque sur la case, pas seulement un mot dessous.
- [ ] La rangée reste utilisable pendant que les images arrivent : on peut cliquer un choix avant
      que tout soit calculé.
- [ ] En style *dessin*, où la taille devient une finesse et où les deux autres rangées
      disparaissent, l'écran ne montre pas d'aperçu orphelin.
- [ ] Les neuf `taille-*.png` du dossier public, que plus rien n'affiche, sont retirés — ou
      réemployés comme repli si la machine ne peut pas calculer.

---

## RT3 · Le fond se calcule sur l'image de référence

**Retour couvert** : 4 (sa moitié serveur).

**Bloquée par** : aucune.

### Ce qu'on livre

À chaque demande d'image ou de vidéo, l'atelier choisit lui-même la couleur de fond : celle des
candidats qui s'éloigne le plus des couleurs de **l'image de référence envoyée avec cette
demande-là**. Sans image de référence, le vert de studio.

Le calcul existe déjà (`atelier/domaine/fond.py`, `proposer`) et porte exactement les six
candidats que l'auteur cite ; il change de source — l'image jointe au lieu de la palette du jeu —
et de moment — chaque appel au lieu d'une fois au réglage.

### Critères d'acceptation

- [ ] Une demande avec image de référence part sur la couleur la plus éloignée de cette image,
      mesurée par la **distance du détourage** — celle qui répond à la vraie question.
- [ ] Une demande sans image de référence part sur `#00B140`.
- [ ] Plusieurs images de référence sont traitées comme un seul ensemble de couleurs : la couleur
      retenue est loin de **toutes**.
- [ ] Le fond écrit dans un univers existant n'est plus lu par la production ; il reste sur le
      disque et sa relecture ne casse pas.
- [ ] Le paragraphe *« Il propose, il n'impose pas »* en tête de `fond.py` est réécrit : il dit la
      décision du 2 septembre, le changement d'avis du 20, et pourquoi. **Deux décisions contraires
      ne cohabitent pas dans le dépôt.**
- [ ] La vidéo passe par le même choix que l'image — l'auteur a nommé les deux.

> ⚠️ **Ce que ça coûte, et c'est déjà écrit dans `fond.py`** : changer ce qui part au fournisseur
> **invalide les comparaisons avec les tirages déjà payés**. Les notes d'animation restent valables
> entre elles, jamais contre un tirage postérieur. C'est un prix accepté, pas un oubli — et c'est
> la seconde fois que cette tranche-là le fait payer.

---

## RT4 · Le réglage du fond disparaît de l'écran

**Retour couvert** : 4.

**Bloquée par** : RT3.

### Ce qu'on livre

La section *Le fond du jeu* quitte l'étape *Son allure* : le damier, le sélecteur de couleur, le
bouton *Prendre*, le bouton *Retirer*, la phrase de l'écart et celle du refus. Le nom prêtait déjà
à confusion — *« on a l'impression qu'il s'agit de la couleur de fond du jeu »* — et le réglage
n'existe plus.

### Critères d'acceptation

- [ ] L'étape *Son allure* ne montre plus rien du fond, ni en création ni dans l'onglet *Univers*.
- [ ] La phrase *« ce jeu n'a pas encore de palette… »* disparaît avec la section qui la portait.
- [ ] Le guide ne décrit plus un réglage qui n'existe pas : les fiches d'aide qui le nommaient sont
      retirées ou réécrites. *(Le guide vient d'être clos ; il ne doit pas rouvrir faux.)*
- [ ] Rien ailleurs dans le produit ne propose encore d'écrire ce champ.

---

## RT5 · L'étape de l'allure se dégraisse

**Retour couvert** : 5.

**Bloquée par** : RT2, RT4 — dégraisser un écran qu'on est encore en train de remplir est du
travail à refaire.

### Ce qu'on livre

Un passage complet sur l'étape, avec une seule règle, celle de l'auteur : *si ce n'est pas utile ou
vital pour la configuration, ça s'enlève*. Les deux phrases qu'il cite nommément partent ; celles
du même genre aussi — ce qui explique qu'une méthode se refait gratuitement, ce qui explique le
plafond des couleurs, ce qui explique que le dossier ne changera plus jamais, ce qui explique ce
que le réalignement saute.

**Ce que RT2 rend visible remplace ce que ces phrases disaient** : une rangée d'images n'a pas
besoin qu'on écrive ce qu'elle montre.

### Critères d'acceptation

- [ ] Les deux phrases citées par l'auteur ne sont plus à l'écran.
- [ ] Une personne qui ouvre l'application pour la première fois traverse l'étape sans rencontrer
      une phrase qui parle d'un mécanisme qu'elle n'a pas encore vu.
- [ ] Ce qui reste écrit est soit une question, soit la conséquence immédiate d'un clic.
- [ ] Aucune information **nécessaire** n'est perdue en silence : ce qui part et qui comptait est
      relogé (voir `RT6`) ou nommé dans le relevé de la tranche.
- [ ] Le guide reste d'accord avec l'écran : les fiches qui citaient les phrases retirées sont
      reprises.

---

## RT6 · Le garde-fou de la taille reparaît où il sert

**Retour couvert** : 5 (sa seconde moitié, tranchée par l'auteur le 20 septembre).

**Bloquée par** : RT5.

### Ce qu'on livre

L'avertissement sur la taille de case — *changer la taille après coup laisse les images déjà faites
à leur ancienne taille* — quitte la configuration initiale, où il embrouille, et **reparaît au
moment où l'on change la taille sur un jeu qui porte déjà des images**. Là, il est vrai, il est
utile, et on ne peut pas l'ignorer.

⚠️ **Cette tranche est la raison pour laquelle `RT5` n'est pas une simple soustraction.** Tenir
`RT5` sans `RT6`, c'est avoir retiré un garde-fou et rien mis à la place.

### Critères d'acceptation

- [ ] Changer la taille sur un jeu **sans image** ne dit rien : il n'y a rien à perdre.
- [ ] Changer la taille sur un jeu **qui porte des images** avertit avant, et dit combien d'images
      resteront à leur ancienne taille.
- [ ] L'avertissement se lit sans connaître le produit : il dit ce qui arrive, pas comment c'est
      construit.
- [ ] On peut passer outre — c'est un avertissement, pas une interdiction.

---

## RT7 · Une note collée se corrige

**Retour couvert** : 6.

**Bloquée par** : aucune.

### Ce qu'on livre

Sur la toile d'*Univers & toile*, une carte texte se corrige en place : on l'ouvre, on change le
texte, c'est enregistré — sans perdre sa position, sa teinte ni les liens qui y aboutissent.

**Le serveur sait déjà le faire depuis la tranche `T9`** : la route accepte un champ `texte`, et
son commentaire dit exactement pourquoi il existe. **Aucun écran ne le lui a jamais demandé.** La
tranche est donc de l'interface seule.

**Périmètre arrêté par l'auteur** : l'édition d'abord, seule. La fenêtre complète — texte tronqué
en vue grille, lecture en markdown, recherche avec surbrillance — reste à sa place en tête du
journal, et se fera en son temps.

### Critères d'acceptation

- [x] Une carte texte posée sur la toile s'ouvre, se corrige, et le texte corrigé est celui qu'on
      relit après rechargement.
- [x] La correction ne déplace pas la carte, ne perd pas sa teinte, ne coupe pas ses liens.
- [x] Le geste se voit sans qu'on l'ait appris — une personne qui vient de coller un texte trouve
      comment le reprendre.
- [x] Le geste se défait comme les autres gestes de la toile.
- [x] Une carte **image** refuse le champ texte, et c'est le serveur qui le dit — comme
      aujourd'hui.

---

## RT8 · « Les sons » rentre dans l'atelier, et se déclare vide

**Retour couvert** : 7.

**Bloquée par** : aucune.

### Ce qu'on livre

Deux défauts du même écran, réparés ensemble.

**Le cadre** : *Les sons* est aujourd'hui le seul écran du jeu qui s'ouvre en dialogue plein écran
— il couvre tout, rend le reste inerte, et ne laisse qu'un bouton *Fermer*. Son voisin immédiat
dans la même liste, *Les tuiles*, est une surface normale qui garde la navigation. *Les sons* le
devient aussi.

**Le vide** : un jeu sans aucun son montre une page blanche sous deux phrases d'introduction. Un
écran vide qui ne se déclare pas vide se lit comme une panne. Il dit qu'il est vide, et par où
commencer.

### Critères d'acceptation

- [ ] *Les sons* garde la navigation de gauche, et la porte d'où l'on vient est marquée comme
      active — le même comportement que *Les tuiles*.
- [ ] On revient d'où l'on venait ; on ne se retrouve pas ailleurs après avoir fermé.
- [ ] Un jeu sans son montre une phrase qui le dit et les deux gestes possibles, au lieu du blanc.
- [ ] Ce qu'on était en train de régler n'est pas perdu par le changement de cadre : l'avertissement
      d'abandon qui existe aujourd'hui tient toujours.
- [ ] Le guide de l'écran *Les sons* reste juste : il vient d'être écrit et décrit un dialogue.

---

## RT9 · Les sujets deviennent le Codex

**Retour couvert** : 8.

**Bloquée par** : aucune.

### Ce qu'on livre

La porte du menu ne s'appelle plus *Les sujets* mais **Codex**, et elle contient des sujets.
L'auteur l'a tranché en voyant que le guide employait déjà les deux mots. **Le code disait `codex`
depuis toujours** — la surface s'appelle ainsi dans la pile de l'application — : l'écran le
rejoint au lieu de diverger.

Les mots *sujet*, *famille* et *collection* ne bougent pas.

### Critères d'acceptation

- [x] La porte du menu, le titre de l'écran, le fil d'ariane et les renvois depuis d'autres écrans
      disent *Codex*.
- [x] Les libellés d'accessibilité disent la même chose que le texte visible — **jamais l'un sans
      l'autre**, ce sont eux que les essais interrogent.
- [x] Le guide dit *Codex* là où il disait *Les sujets*.
- [x] Les essais qui cherchaient l'ancien libellé sont repris. ⚠️ **Ils tomberont tous d'un coup
      — une vingtaine — et c'est normal** : ce n'est pas une régression, c'est le renommage.
- [x] Les commentaires du serveur ne sont **pas** touchés : ils ne sont pas des libellés rendus.
      *(S'ils doivent suivre, c'est un second passage, à part — voir § Ce qui reste ouvert.)*

---

## Ce qui reste ouvert

Ni bloquant, ni oublié.

- **Le renommage descend-il dans le serveur ?** Les commentaires de `atelier/domaine/projet.py`,
  `services/bibliotheque.py` et voisins disent *« les sujets du jeu »*. Ce n'est jamais rendu à
  l'écran. Second passage, ou vocabulaire à deux étages assumé.
- **Les étiquettes ne se modifient pas non plus.** Relevé en lisant, jamais demandé : l'API porte
  *fabriquer*, *compter un emploi*, *oublier*, et rien pour corriger. Une faute oblige à refaire, et
  l'étiquette est partagée par tous les jeux. Même manque que `RT7`, autre objet.
- **La fenêtre complète des cartes texte** — troncature, markdown, recherche — reste en tête de
  `docs/remarques/journal.md`. `RT7` en construit le premier quart.
