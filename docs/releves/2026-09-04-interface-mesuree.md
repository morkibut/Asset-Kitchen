# Ce que l’interface est, mesuré — 4 septembre 2026

> **Ce document ne décide rien : il établit.** Il rassemble douze relevés faits le 4 septembre
> 2026 — six lectures du code de l’atelier, six sondages sur l’état de l’art — puis le brief
> qui les consolide et les deux relectures adverses qui l’attaquent.
>
> **Il existe pour une raison précise** : une refonte partie de l’usage plutôt que du code aura
> besoin, au moment de trancher, de savoir ce que le produit fait *réellement* et ce que ça
> coûte. Ces chiffres-là ne se retrouvent pas : ils ont demandé 15 lectures et 822 consultations
> de fichiers et de sources. **Aucune affirmation ici ne vaut sans sa preuve**, et chacune porte
> la sienne — fichier et ligne, ou le comptage effectué.

**Ce qu’il ne faut pas y chercher** : des décisions. Elles vivent dans `docs/design-decisions.md`.
Le système qui en est sorti vit dans `docs/DESIGN.md`.

---

## Sommaire

1. [Ce qui dit qu'on peut cliquer dans l'atelier : presque rien — 231 des 259 boutons n'ont, au repos, aucun contour ni aucun fond visible](#releve-1)
2. [La charge de texte de l'atelier, écran par écran : 1 393 chaînes, 408 contrôles et 195 phrases d'explication réparties sur 33 composants — mais le vrai coupable est que rien n'a de bord visible](#releve-2)
3. [Le parcours ne se dessine pas : quatre trajets tracés dans le code, et ce que chaque écran annonce (ou non) de l'étape suivante](#releve-3)
4. [Les mots employés à la place des signes — relevé des 278 boutons de l'atelier, de leur libellé exact et de la place qu'ils prennent](#releve-4)
5. [Les quatorze défauts de l'audit du 31 août 2026, repris un par un dans le code du 4 septembre : onze réparés, deux sans objet, un seul encore ouvert](#releve-5)
6. [La palette du jeu existe et se calcule vraiment ; le châssis est assez centralisé pour être teinté en une ligne, mais aucune palette réelle du dépôt ne peut fournir de texte lisible.](#releve-6)
7. [Denses et calmes : ce que font Linear, Raycast, Figma, Blender et Lightroom en 2025-2026 — et les six écarts mesurés dans l'atelier](#sondage-1)
8. [Fonds chauds et intermédiaires : ce que font les autres, et jusqu'où l'atelier peut monter sans mentir sur une image](#sondage-2)
9. [La teinte dynamique tirée du contenu — état de l'art, et pourquoi ce produit est le cas où elle se retourne](#sondage-3)
10. [Un jeu d'icônes pour l'Atelier : Lucide, à 12 px, bouts carrés — et le vrai obstacle n'est pas le choix du jeu](#sondage-4)
11. [Le dévoilement progressif dans l'atelier : un mécanisme juste, appliqué six fois, et quatre contrôles qui n'existent qu'à la souris](#sondage-5)
12. [Typographie et lisibilité pour l'Atelier — ce que le code fait vraiment, et le fond chaud qu'il peut porter](#sondage-6)
13. [Le brief consolidé](#brief)
14. [Les deux relectures adverses](#critiques)

---

# Les six lectures du code

<a id="releve-1"></a>

## 1 · Ce qui dit qu'on peut cliquer dans l'atelier : presque rien — 231 des 259 boutons n'ont, au repos, aucun contour ni aucun fond visible

L'auteur a raison, et c'est mesurable : sur les 259 boutons écrits à la main dans l'interface, 231 (89 %) ne portent au repos aucun trait — cadre, fond ou soulignement — qui atteigne le seuil de visibilité de 3:1 contre son propre fond. Le seul motif qu'on ne peut pas rater, le bouton à fond cyan plein, existe en tout et pour tout à 7 endroits du produit. Pire, la seule décoration permanente qui ressemble à un lien — le soulignement pointillé — est posée sur 109 libellés qui ne sont PAS cliquables (ce sont des poignées d'infobulle, curseur « aide »), contre un seul élément cliquable souligné dans tout le produit. Et le même triplet de classes sert à dire « désactivé » à quatre endroits et « actif, clique-moi » à quatre autres. Il n'y a pas un vocabulaire de boutons : il y a 108 apparences distinctes pour 259 boutons, dont 71 n'existent qu'une seule fois.

### Les constats

**BLOQUANT — Sur les 259 balises <button> écrites à la main dans 33 fichiers, 231 ne portent au repos aucun cadre ni aucun fond dont le contraste atteigne 3:1 contre la surface qui est dessous. Ce qui les sépare d'une phrase inerte est donc : la couleur du texte, le survol, et la flèche de la souris.**

- *Le chiffre* : 231 / 259 = 89 %
- *La preuve* : comptage automatique des balises <button> dans interface/src/composants/*.tsx + App.tsx, croisé avec le calcul de contraste WCAG des jetons de interface/src/index.css:13-22 ; --bord #252b33 = 1,21:1 sur --fond-2, --bord-fort #39424c = 1,69:1, --fond-2 sur --fond-1 = 1,07:1

**BLOQUANT — Le seul motif visuellement incontestable — le bouton à fond cyan plein — n'est employé que 7 fois dans tout le produit. Il n'existe qu'à un endroit du code, et rien d'autre ne lui ressemble.**

- *Le chiffre* : 7 emplois sur environ 330 choses cliquables
- *La preuve* : interface/src/composants/chassis.tsx:536 (`bg-signal text-fond-0`) ; la propriété `principal` n'est passée qu'à Calibrage.tsx:260, ChampPrompt.tsx:278, Decoupe.tsx:446, Depliage.tsx:123, Envoi.tsx:644, Planche.tsx:374, Secrets.tsx:161

**BLOQUANT — La seule décoration permanente du produit qui ressemble à un lien — le soulignement pointillé — marque exactement l'inverse : elle est posée sur des libellés NON cliquables (poignées d'explication, curseur « point d'interrogation »). Un seul élément réellement cliquable est souligné au repos dans tout le produit.**

- *Le chiffre* : 109 marques pointillées non cliquables, contre 1 souligné cliquable
- *La preuve* : interface/src/composants/Infobulle.tsx:307-308 (`cursor-help underline decoration-dotted`) ; 109 occurrences de la propriété `aide=` qui la déclenchent ; le seul cliquable souligné au repos est App.tsx:2645

**BLOQUANT — 85 boutons sont un simple mot gris, dans la couleur exacte d'un texte inerte voisin — ni fond, ni cadre, ni soulignement, ni couleur distinctive. 73 d'entre eux ne se déclarent qu'au survol ; 12 ne se déclarent jamais, la flèche de la souris est le seul indice.**

- *Le chiffre* : 85 boutons, dont 12 sans même un effet de survol
- *La preuve* : exemples : « Supprimer » Ambiances.tsx:466, « Garder » Arbre.tsx:132, « appliquer » et « oublier » Tables.tsx:399 et 406, « éteindre » FicheChose.tsx:682, « Couper » Toile.tsx:2713, « revenir à la liste proposée » Assistant.tsx:2386 ; sans survol : Places.tsx:1356, Places.tsx:1364, Toile.tsx:2607

**BLOQUANT — Dans la même bande, à quelques pixels l'un de l'autre, un texte mort et un bouton sont écrits avec les mêmes classes. Trois cas vérifiés, tous dans du code partagé donc présents sur tous les écrans.**

- *Le chiffre* : 3 paires strictement identiques au repos
- *La preuve* : fil d'Ariane : bouton BarreChassis.tsx:87-92 (`text-[11.5px] text-texte-2`) contre segment inerte BarreChassis.tsx:95-104 (mêmes classes) ; état des fournisseurs : texte inerte BarreChassis.tsx:154 contre bouton BarreChassis.tsx:158-163 (`mesure shrink-0 text-[10px] text-texte-3` des deux côtés) ; bande de visée : texte inerte App.tsx:2838 contre bouton App.tsx:2843 (`mesure ... text-[10px] text-texte-3` des deux côtés)

**FORT — Le même triplet de classes `border-bord bg-fond-2 text-texte-3` sert à dire deux choses opposées : « ce contrôle est éteint, tu ne peux pas cliquer » à quatre endroits, et « ce contrôle est allumé et cliquable, simplement pas sélectionné » à quatre autres.**

- *Le chiffre* : 8 emplois, 4 pour « désactivé » et 4 pour « actif »
- *La preuve* : désactivé : chassis.tsx:534 (Bouton inactif), chassis.tsx:607 (segment grisé), BarreOutils.tsx:304 (export impossible), Tableau.tsx:1499 ; actif et cliquable : BarreChassis.tsx:452 (bascule de panneau), Depenses.tsx:584 (filtre non choisi), EcranReglages.tsx:335 (modèle non choisi), EcranReglages.tsx:413

**FORT — Il n'existe pas de vocabulaire de boutons : en comptant les seules classes qui touchent à l'apparence au repos, on trouve 108 signatures visuelles distinctes pour 259 boutons, et 71 de ces signatures n'apparaissent qu'une seule fois. Le composant partagé du produit n'est employé que 20 fois.**

- *Le chiffre* : 108 apparences pour 259 boutons ; 71 uniques ; 20 emplois du composant partagé
- *La preuve* : analyse des classes de chaque balise <button> après retrait des préfixes de survol et de focus ; le composant partagé est chassis.tsx:518 (`Bouton`), 20 occurrences de `<Bouton` dans tout interface/src

**FORT — Quatre contrôles n'existent visuellement pas du tout au repos : ils sont transparents ou à opacité zéro, et n'apparaissent qu'une fois la souris posée dessus. L'un d'eux supprime un projet.**

- *Le chiffre* : 4 contrôles invisibles au repos
- *La preuve* : Arbre.tsx:262 (`text-transparent group-hover:text-texte-3`, supprime un projet ou une collection), Personnages.tsx:2428, Personnages.tsx:2666, Toile.tsx:2774 (poignée de redimensionnement, `opacity-0 group-hover:opacity-100`)

**FORT — Le gris le plus sombre, --texte-3, ne dit rien : il habille aussi bien du texte mort que des boutons, et il est en dessous du seuil de lisibilité recommandé. Il porte pourtant 55 des 85 boutons gris nus.**

- *Le chiffre* : 577 emplois : 67 % sur du texte inerte, 33 % sur du cliquable ; contraste 3,01:1 sur --fond-2
- *La preuve* : comptage des occurrences de `text-texte-3` par élément JSX dans interface/src ; contraste calculé depuis index.css:22 (#5e6771) sur index.css:15 (#171b21)

**FORT — Le cyan est la seule couleur à peu près fiable pour dire « cliquable » — mais elle porte déjà deux autres métiers : « valeur posée » et « segment choisi ». Une même couleur pour trois messages ne peut pas servir de convention.**

- *Le chiffre* : 189 emplois du cyan, 91 % sur du cliquable, 9 % sur du texte mort
- *La preuve* : cyan de valeur inerte : chassis.tsx:422 (`Valeur`, la valeur d'un bloc replié) ; cyan de sélection : chassis.tsx:606 (segment choisi) ; cyan inerte dans une phrase : Assistant.tsx:1006, Tableau.tsx:697, Tables.tsx:1502, PanneauReglages.tsx:352

**FORT — Sur la même rangée d'un panneau, le seul élément souligné est le seul qui ne se clique pas, et les deux voisins non soulignés sont des boutons. C'est l'inversion complète de la convention, dans un espace de trois centimètres.**

- *Le chiffre* : 1 rangée, 3 éléments, convention inversée
- *La preuve* : Fiche.tsx:1169-1176 (« passe 1 », texte inerte, souligné pointillé) puis Fiche.tsx:1183-1190 (« masquer », bouton cyan sans soulignement) puis Fiche.tsx:1194-1198 (« retirer », bouton gris sans soulignement)

**MOYEN — Les glyphes ne forment pas un jeu fermé : 16 caractères différents servent d'icônes à l'intérieur des boutons, avec deux croix pour le même geste, deux chevrons, deux cercles et quatre flèches. À cela s'ajoutent les formes dessinées en CSS (carré de 9 px, carré de 14 px, triangle de coin, pastilles).**

- *Le chiffre* : 16 glyphes distincts dans les boutons
- *La preuve* : extraction du contenu de chaque <button> : › (67), × (21), + (21), ‹ (4), − (4), ↑ (3), ↓ (3), ✕ (3), ● (2), ○ (2), → (1), ✓ (1), ↕ (1), plus — · … ; deux croix pour la même fermeture : × Ambiances.tsx:502 et ✕ Fiche.tsx:174

**MOYEN — Quinze éléments qui ne se cliquent pas portent pourtant la forme d'un bouton — coin arrondi de 2 px, bordure et surface --fond-2. Trois d'entre eux ont même une hauteur de contrôle.**

- *Le chiffre* : 15 faux boutons
- *La preuve* : Assistant.tsx:1578, Assistant.tsx:1756, ChampPrompt.tsx:39, chassis.tsx:647, Codex.tsx:632, EcranReglages.tsx:174, Envoi.tsx:429, Envoi.tsx:440, Envoi.tsx:717, Fiche.tsx:952, Import.tsx:104, PanneauReglages.tsx:280, Places.tsx:1080, Tableau.tsx:745, App.tsx:2560

**MOYEN — Les seuls deux vrais liens du produit ne ressemblent pas à des liens. Celui qui mène à une page extérieure est écrit dans le gris des légendes mortes.**

- *Le chiffre* : 2 balises <a> dans tout le produit, 0 souligné
- *La preuve* : Fiche.tsx:298 (`text-signal`, téléchargement PNG) et Tableau.tsx:1572 (`text-texte-3`, lien externe vers la source d'une carte)

**FORT — L'information est portée par le survol, pas par le repos : 233 des 259 boutons n'ont d'apparence propre qu'au survol, et 145 des 157 boutons nus ne se déclarent que là. Rien de tout cela n'existe pour qui ne promène pas sa souris sur l'écran.**

- *Le chiffre* : 233 / 259 boutons (90 %) dépendent du survol
- *La preuve* : comptage des classes préfixées `hover:` sur chaque balise <button> de interface/src

**MOYEN — Le produit n'a pas cinq hauteurs de contrôle mais onze, et 150 boutons sur 259 n'en ont aucune : ils prennent exactement la hauteur d'un mot, donc la forme d'un mot.**

- *Le chiffre* : 11 hauteurs distinctes (26, 24, 34, 9, 38, 44, 30, 18, 20, 14, 10 px) ; 150 boutons sans hauteur
- *La preuve* : extraction des classes `h-[Npx]` sur les 259 balises <button> ; 26 px apparaît 65 fois, 24 px 23 fois — or 24 px ne figure pas dans les hauteurs annoncées

**FORT — Presque tout l'écran est écrit en très petit : 526 des 732 tailles de texte déclarées sont à 10 px ou moins, pour vingt tailles distinctes. À cette échelle, aucune nuance de gris ni aucun liseré de 1 px ne peut porter la différence entre un mot et un bouton.**

- *Le chiffre* : 72 % du texte à 10 px ou moins ; 20 tailles distinctes
- *La preuve* : comptage des classes `text-[Npx]` dans interface/src : 385 × 10 px, 130 × 9,5 px, 6 × 9 px, 3 × 8,5 px, 2 × 8 px, contre une taille de base de 13 px déclarée index.css:89

**MOYEN — Les trois écrans les plus chargés déclarent entre 75 et 97 contrôles dans leur code, sans compter ce que les listes multiplient. La galerie y ajoute jusqu'à trois zones cliquables par vignette de la grille.**

- *Le chiffre* : les tables 97, la galerie 88, l'établi 75
- *La preuve* : comptage des balises <button>, <input>, <select>, <textarea> et des contrôles partagés dans les fichiers composant chaque écran, suites de segments dépliées : tables = Tables.tsx + Places.tsx + Superposition.tsx + barre du haut ; galerie = App.tsx + Arbre + BarreOutils + ChampPrompt + Fiche + Tuile ; établi = Personnages.tsx + Calque.tsx + FicheChose.tsx ; la grille ajoute 1 à 3 zones par vignette (Tuile.tsx:146, 200, 208), soit une centaine de plus sur un écran large

**MOYEN — Vingt-trois zones cliquables ne sont pas des boutons du tout — ce sont des blocs, des cartes ou des images auxquels un clic a été branché. La réparation du curseur en main, posée dans la feuille de style, ne couvre que les boutons, les liens et deux formes qui n'existent pas dans le produit : elle ne les atteint donc pas toutes.**

- *Le chiffre* : 23 éléments non-boutons cliquables ; la règle de curseur vise `summary` et `[role=button]`, dont il y a 0 dans le produit
- *La preuve* : index.css:216-222 ; zones concernées : Codex.tsx:687 (carte), Depliage.tsx:220, Tuile.tsx:122, EcranReglages.tsx:72 (le fond de l'écran se referme au clic, rien ne le dit), Tableau.tsx:903, Tables.tsx:1905

### Ce qui marche aujourd’hui, et qu’une refonte perdrait

- Le bouton principal à fond cyan plein (chassis.tsx:536) est le seul motif que personne ne peut rater, et son contraste est bon : 7,99:1 pour le texte sur le fond cyan. Il ne manque pas de qualité, il manque de fréquence — 7 emplois. C'est le point de départ, pas quelque chose à jeter.
- Le chevron « › » est déjà, dans les faits, la marque de lien du produit : 67 emplois à l'intérieur de boutons, et 41 des 72 boutons colorés nus le portent. La convention existe à moitié ; il suffirait de la rendre systématique et lisible.
- La suite de segments (chassis.tsx:553) est le seul contrôle du produit dont l'état se lit sans bouger la souris : bordure cyan à 7,10:1, texte cyan, fond teinté. C'est le motif le plus honnête de l'interface et il est déjà employé 36 fois.
- La fente permanente qui dit pourquoi un contrôle est fermé (chassis.tsx:155, `Raison`) est une vraie bonne idée, rare dans les logiciels : elle écrit la raison sous le contrôle au lieu de la cacher dans une bulle. Elle est employée partout et ne doit pas disparaître dans une refonte.
- Le focus clavier est correct et uniforme : un liseré cyan de 2 px sur tout ce qui reçoit le focus (index.css:193-196). Le clavier voit aujourd'hui ce que la souris ne voit pas.
- La structure sémantique est saine : 157 étiquettes accessibles, 40 états de bascule déclarés, des onglets déclarés comme tels. Ce qui manque est la peau, pas le squelette — une passe de design n'aura pas à réécrire la logique.
- La hauteur de rangée de 26 px est réellement tenue : 65 boutons la portent, c'est de loin la valeur dominante. Il y a donc bien un rythme vertical sur lequel s'appuyer.
- Le damier de transparence, la jauge de génération qui avance vers une durée mesurée, et le curseur à rail fin sont trois contrôles lisibles et justes. Ce ne sont pas eux le problème.

### Ce que ce relevé impose

- Il faut un jeu fermé de quatre à six apparences cliquables, dessinées à un seul endroit et employées partout, contre les 108 apparences actuelles. Tant que chaque écran redessine son bouton à la main, aucune règle de couleur ne rattrapera l'affaire — et 71 apparences n'existent qu'une fois, donc personne ne les reconnaîtra jamais.
- Aucun trait au repos ne doit descendre sous 3:1 contre son fond. Cela condamne d'un coup les deux couleurs de bordure du produit comme marqueurs de cliquable (1,21:1 et 1,69:1) et les écarts entre surfaces (1,07:1). Éclaircir le fond, comme l'auteur le demande, ne suffira pas : il faut remonter le contraste des contours en même temps, sinon on aura simplement des boutons invisibles sur gris clair au lieu d'invisibles sur gris sombre.
- Le soulignement doit changer de camp. Il est aujourd'hui la marque du non-cliquable, à 109 contre 1. Deux issues seulement : ou on le rend au lien et on donne une autre marque aux poignées d'explication, ou on l'abandonne des deux côtés. On ne peut pas garder les deux emplois.
- « Désactivé » et « actif mais non sélectionné » doivent cesser de partager les mêmes pixels. Il faut deux formes différentes, pas deux nuances du même gris — huit contrôles portent aujourd'hui le même habit pour deux messages contraires.
- Le survol ne peut plus porter l'information : 90 % des boutons n'ont d'apparence qu'une fois la souris dessus. Le futur système doit se juger écran figé, souris posée à côté — si on ne peut pas nommer les zones cliquables sur une capture immobile, il ne marche pas.
- Le gris le plus sombre doit être rendu au texte inerte, et rien d'autre. Un tiers de ses 577 emplois est aujourd'hui cliquable, ce qui suffit à détruire la convention pour les deux tiers restants.
- Le cyan ne peut pas rester à la fois « clique ici », « c'est sélectionné » et « une valeur est posée ». Le passage à une palette tirée du jeu actif, que l'auteur demande, est l'occasion de séparer ces trois métiers en trois signaux distincts — mais il ne les séparera pas tout seul.
- Il faut un vrai jeu d'icônes fermé. Seize caractères Unicode disparates, dont deux croix pour le même geste, ne font pas un système ; et à 9 ou 10 px, une croix multipliée n'est pas identifiable. C'est exactement la demande de l'auteur (« ajouter des icônes ») et elle est justifiée par le comptage.
- La taille du texte fait partie du chantier de cliquabilité, pas d'un chantier séparé : à 10 px — 72 % du produit — aucun liseré, aucune nuance de gris et aucun glyphe ne porte la différence entre un mot et un bouton. Remonter la taille de base est une condition, pas un confort.
- Enfin la densité : entre 75 et 97 contrôles déclarés sur les trois écrans les plus chargés, plus une centaine de zones dans la grille. Même parfaitement dessinés, ils exigent une hiérarchie — deux ou trois gestes visibles de loin, le reste rangé et rendu à la demande. Un système d'affordance appliqué tel quel à 97 contrôles également visibles produirait un écran encore plus bruyant que celui d'aujourd'hui.

---

<a id="releve-2"></a>

## 2 · La charge de texte de l'atelier, écran par écran : 1 393 chaînes, 408 contrôles et 195 phrases d'explication réparties sur 33 composants — mais le vrai coupable est que rien n'a de bord visible

L'atelier affiche 1 393 chaînes de texte distinctes, 408 contrôles et 195 phrases d'explication écrites en dur dans ses 33 composants ; les trois écrans les plus chargés (les réglages du jeu, l'établi d'une chose, la fiche d'une image) en concentrent le quart. Mais le comptage n'est pas la cause : la cause est que rien à l'écran n'a de contour perceptible. Deux surfaces voisines se distinguent par un rapport de contraste de 1,05 à 1,10 contre 1, les traits qui séparent les blocs sont à 1,10-1,36 contre 1, et 63 % des boutons n'ont ni fond ni trait — dont 76 sur 258 qui ont exactement l'apparence du texte qui les entoure. Par-dessus, 94 % du texte tient dans une bande de 4,5 pixels étalée sur dix tailles indiscernables, et la couleur de texte la plus employée du produit (40 % des déclarations) est sous le seuil de lisibilité à toutes les tailles où elle est employée. Il n'y a que 5 dessins vectoriels dans tout le produit et aucune icône : chacun des 258 boutons doit donc se nommer en toutes lettres, ce qui fabrique mécaniquement la surcharge de texte que l'auteur décrit. La matière est bonne et déjà écrite — un recueil de 134 explications existe et n'est branché que sur 10 en-têtes de section — mais elle est rangée à plat, en police à chasse fixe de 10 pixels, dans un décor sans arêtes.

### Les constats

**BLOQUANT — Deux surfaces voisines de l'atelier ne se distinguent pratiquement pas l'une de l'autre. Les quatre fonds du produit tiennent dans un écart de 1,24 contre 1 du plus sombre au plus clair, et deux fonds voisins sont à 1,05-1,10 contre 1. Comme le design s'interdit par ailleurs toute ombre et tout coin arrondi, il ne reste rien pour dire où finit un panneau et où commence le suivant. C'est l'explication mécanique de « aucun workflow ne se dessine visuellement » et de « on passe son temps à faire des allers-retours avec ses yeux ».**

- *Le chiffre* : 1,05 à 1,10 contre 1 entre deux surfaces voisines ; 1,24 contre 1 sur toute l'échelle des fonds
- *La preuve* : interface/src/index.css:13-16 (--color-fond-0 #0b0d10, fond-1 #111419, fond-2 #171b21, fond-3 #1e242b) ; contrastes calculés : fond-0/fond-1 = 1,05:1 ; fond-1/fond-2 = 1,07:1 ; fond-2/fond-3 = 1,10:1 ; fond-0/fond-3 = 1,24:1

**BLOQUANT — Les traits qui structurent tout le produit sont invisibles. Le trait ordinaire est employé 345 fois et son contraste va de 1,10 à 1,36 contre 1 selon le fond ; le trait renforcé est employé 50 fois, à 1,53-1,91 contre 1. Le seuil admis pour qu'un élément d'interface non textuel soit perçu est de 3 contre 1. Autrement dit : 395 des 473 traits du produit (84 %) sont à moins de la moitié du seuil de perception, y compris ceux qui dessinent les bordures des 31 boutons qui en portent une.**

- *Le chiffre* : 345 traits à 1,10-1,36:1 et 50 à 1,53-1,91:1, contre un seuil de 3:1
- *La preuve* : interface/src/index.css:17-18 (--color-bord #252b33, --color-bord-fort #39424c) ; comptage sur App.tsx + les 33 composants : 345 border-bord, 50 border-bord-fort, 39 border-signal, 15 border-lumiere, 13 border-transparent, 8 border-epingle, 3 border-echec

**BLOQUANT — Sur 258 boutons du produit, 163 (63 %) n'ont ni fond ni trait. Parmi eux, 87 sont en cyan et se lisent comme des liens, mais 54 sont dans le gris du texte courant et 22 n'ont aucune couleur déclarée : 76 contrôles sur 258 (29 %) ont donc exactement l'apparence du texte qui les entoure. Le seul indice de cliquabilité restant est un chevron « › » accolé au libellé, qui apparaît 71 fois dans le code — un caractère de 10 pixels dans un texte de 10 pixels. C'est exactement le « on ne sait pas ce qui est cliquable » de l'auteur.**

- *Le chiffre* : 163 boutons sur 258 sans forme (63 %), dont 76 (29 %) sans forme ni couleur distinctive
- *La preuve* : Classement des 258 balises <button> de App.tsx et des 33 composants par leur classe : 64 avec un fond (bg-signal / bg-fond-1..3), 31 avec une bordure, 87 en text-signal sans forme, 54 en text-texte-2/3 sans forme, 22 sans couleur. Exemples : Personnages.tsx:2151 « Fabriquer › » (mesure shrink-0 px-1 text-[10px] text-signal), Personnages.tsx:2166 « × » (text-texte-3 hover:text-echec), Personnages.tsx:1385 « Supprimer » (ml-auto text-[10px] text-texte-3)

**BLOQUANT — La couleur de texte la plus employée du produit est sous le seuil de lisibilité. --texte-3 (#5e6771) est déclaré 496 fois sur 1 244 déclarations de couleur de texte, soit 40 % — plus que le texte principal (164) et le texte secondaire (255) réunis. Son contraste vaut 3,39:1 sur le fond le plus sombre et descend à 2,72:1 sur le fond le plus clair. Le seuil pour du texte courant est 4,5:1, et il n'est jamais atteint. Or c'est cette couleur qui porte les mesures, les explications et les libellés de rangement, à 9,5 et 10 pixels — des tailles auxquelles aucune tolérance « grand texte » ne s'applique.**

- *Le chiffre* : 496 emplois sur 1 244 (40 %), à 2,72-3,39 contre 1 pour un seuil de 4,5
- *La preuve* : interface/src/index.css:22 (--color-texte-3: #5e6771) ; contrastes calculés : 3,39 / 3,21 / 3,01 / 2,72 contre les quatre fonds ; comptage des classes de couleur : text-texte-3 496, text-texte-2 255, text-texte 164, text-signal 152, text-signal-clair 72, text-epingle 48, text-echec 45, text-ok 11

**BLOQUANT — Il n'existe aucune hiérarchie de taille perceptible. Le produit déclare 732 tailles de texte réparties sur 20 valeurs distinctes ; 526 d'entre elles (72 %) sont à 10 pixels ou moins, et 688 (94 %) tiennent entre 9 et 13,5 pixels — c'est-à-dire dans une bande de 4,5 pixels découpée en dix valeurs (9 / 9,5 / 10 / 10,5 / 11 / 11,5 / 12 / 12,5 / 13 / 13,5). Un écart d'un demi-pixel ne se voit pas. Rien ne dit donc à l'œil ce qui est un titre, ce qui est une valeur, ce qui est une explication.**

- *Le chiffre* : 20 tailles distinctes ; 94 % du texte dans une bande de 4,5 px découpée en 10 valeurs
- *La preuve* : Comptage des classes text-[Npx] sur App.tsx et les 33 composants : 10px×385, 9.5px×130, 11px×73, 11.5px×55, 15px×13, 12.5px×11, 12px×10, 32px×9, 13px×9, 14px×7, 10.5px×7, 9px×6, 8.5px×3, 24px×3, 22px×3, 8px×2, 17px×2, 13.5px×2, 28px×1, 20px×1

**FORT — Il n'y a aucune icône dans le produit — 5 dessins vectoriels en tout, dont 3 dans un seul outil de dessin. La conséquence est directe sur la charge de texte que l'auteur dénonce : chacun des 258 boutons doit se nommer en toutes lettres. Par ailleurs, docs/DESIGN.md affirme que le produit tient sur trois glyphes ; le code en rend onze différents.**

- *Le chiffre* : 5 dessins vectoriels, 0 icône, 258 boutons à nommer en toutes lettres
- *La preuve* : 5 occurrences de <svg> au total (Tables.tsx×3, Calque.tsx×1, Toile.tsx×1) sur 33 composants. docs/DESIGN.md:47-48 : « aucun glyphe neuf. Les trois glyphes du produit restent trois ». Glyphes réellement rendus dans un nœud de texte : › (26), × (19), + (11), ↓ (6), … (5), ‹ (4), ↑ (3), ✕ (3), → (2), − (2), ↕ (1) — 11 caractères distincts, 82 occurrences ; plus 71 occurrences de « › » si l'on compte les libellés en chaîne de caractères

**FORT — La police à chasse fixe, que le design réserve explicitement aux nombres, porte la moitié de ses emplois sur des boutons et des paragraphes de prose. La classe .mesure est posée sur 604 éléments : 168 sur un bouton, 145 sur un paragraphe, 162 sur un span, 30 sur un bloc, 27 sur un champ de saisie, 16 sur une liste déroulante. 313 emplois sur 604 (52 %) sont donc des boutons ou de la prose. Résultat : les explications du produit sont rendues en JetBrains Mono à 10 pixels, ce qui les rend indistinguables d'un relevé de mesures — c'est très exactement « cette interface hyper chargée qui assomme d'infos techniques ».**

- *Le chiffre* : 313 des 604 emplois de la chasse fixe (52 %) sont des boutons ou de la prose
- *La preuve* : interface/src/index.css:93-98 : « Toute mesure est en monospace, partout — un nombre est toujours un fait mesuré, jamais un libellé ». Comptage des éléments dont la balise porte la classe mesure : button 168, span 162, p 145, div 30, input 27, select 16, autres 56 (604 au total). Exemples de prose en chasse fixe : Personnages.tsx:1420, 1482, 1513 ; chassis.tsx:166 (le composant Raison, donc les 68 raisons du produit)

**FORT — Classement des dix composants les plus chargés. Score = chaînes de texte + contrôles + 2 × blocs titrés + éléments en chasse fixe. Assistant.tsx (3 106 lignes) : 192 textes, 47 contrôles, 14 blocs, 64 mesures, 71 phrases — score 331. Personnages.tsx (2 750) : 142 / 43 / 15 / 61 / 48 — score 276. Fiche.tsx (1 525) : 80 / 27 / 11 / 41 / 19 — score 170. Envoi.tsx (1 214) : 53 / 19 / 17 / 56 / 11 — score 162. Guide.tsx (577) : 118 / 2 / 8 / 8 / 39 — score 144. Places.tsx (1 611) : 78 / 29 / 8 / 17 / 30 — score 140. Ambiances.tsx (1 071) : 61 / 16 / 14 / 23 / 18 — score 128. Codex.tsx (1 251) : 64 / 15 / 11 / 26 / 10 — score 127. Tableau.tsx (1 597) : 49 / 19 / 12 / 26 / 7 — score 118. FicheChose.tsx (1 071) : 42 / 10 / 16 / 33 / 10 — score 117.**

- *Le chiffre* : Total des 33 composants : 32 613 lignes, 1 393 chaînes distinctes, 408 contrôles, 239 blocs titrés, 591 éléments en chasse fixe, 375 phrases de 45 signes ou plus
- *La preuve* : Comptage sur les 33 composants de C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/ (les 2 fichiers .test.tsx exclus des 35), commentaires et valeurs de classes retirés avant extraction

**FORT — Premier des trois pires — les réglages du jeu (Assistant.tsx). L'avancement y est représenté trois fois en même temps, à 300 pixels de distance : la colonne de gauche montre les 12 étapes avec leur numéro, leur nom et leur valeur courante tronquée ; le pied d'écran répète la même chose en 12 pastilles colorées ; et un compteur écrit « étape 4 sur 12 » juste à côté. En plus, un bloc permanent en bas de colonne affiche trois mesures du prompt (« cases de style 5 sur 7 », « signes de texte », « images officielles ») et une phrase de 92 signes sur ce qui ne part pas au modèle — un compte de prompt qui ne sert qu'au moment de générer, c'est-à-dire sur un autre écran. Ce qui est bien fait : une seule étape sur douze est ouverte à la fois.**

- *Le chiffre* : 3 représentations simultanées du même avancement ; 40 chaînes permanentes dans une colonne de 240 px
- *La preuve* : Assistant.tsx:378-393 (colonne : numéro, nom, valeur) ; Assistant.tsx:494-530 (les 12 pastilles) ; Assistant.tsx:531-533 (« étape N sur 12 ») ; Assistant.tsx:611-648 (CeQueLUniversEnvoie, 3 mesures + phrase permanente) ; Assistant.tsx:411-441 (une seule étape montée à la fois)

**FORT — Deuxième des trois pires — l'établi d'une chose du jeu (Personnages.tsx). Pour un personnage à 6 attitudes et 4 directions, la seule matrice affiche en même temps environ 72 contrôles, 126 chaînes et 60 nombres. Chaque ligne d'attitude porte 4 contrôles (coche, « la planche › », « Fabriquer › », « × ») et se dédouble en 4 sous-lignes qui portent chacune 2 contrôles de plus. Sur chaque ligne issue d'une planche, quatre nombres de contrôle qualité s'affichent en permanence — « ressemblance 0,94 · case 3 » et « grille 16 px · dérive 1,02× » — alors que le code écrit lui-même qu'ils « n'empêchent jamais de garder ». La colonne de gauche empile quatre paragraphes d'explication jamais repliés, et met sur la même ligne, au même caractère et à la même taille, trois liens qui ouvrent un écran et un lien qui détruit.**

- *Le chiffre* : 72 contrôles, 126 chaînes et 60 nombres affichés en même temps dans la matrice
- *La preuve* : Personnages.tsx:2019-2210 (LigneCase : 4 contrôles, 5 textes, le compte « faites / demandées ») ; Personnages.tsx:2273-2352 (SousLigneDirection : 2 contrôles, 4 textes, 2 nombres) ; Personnages.tsx:2733-2749 (MesuresDuLot, 4 nombres permanents) ; Personnages.tsx:1420, 1482, 1513 et 1132 (les 4 paragraphes d'explication) ; Personnages.tsx:1345-1400 (« sa fiche › », « la vitrine › », « le calibrage › », « Supprimer » côte à côte)

**FORT — Troisième des trois pires — la fiche d'une image (Fiche.tsx). Quatorze rubriques sont empilées d'un coup dans une colonne de 380 pixels : en-tête, visionneuse, libellé, modèle, ambiance, style, jugement, case du personnage, texte qui l'a faite, filiation, ce que le projet impose, sa recette, réalignement, et les deux portes avec le lien de téléchargement. Le bloc « Jugement » affiche en permanence le favori, le prix consommé, « Supprimer », puis quatre boutons de réinjection — alors que le pied de l'écran qui la porte dit lui-même qu'« aucun appel ne part d'ici ». Deux rubriques listent des valeurs techniques de traitement dont le code écrit qu'« elle se lit, elle ne se règle plus ici ». Le mécanisme de repli existe pourtant dans ce fichier : 6 blocs repliables y sont utilisés, sur 14 rubriques.**

- *Le chiffre* : 14 rubriques empilées dans 380 px, dont 6 seulement sont repliables
- *La preuve* : Fiche.tsx:165-310 (l'empilement des 14 rubriques) ; Fiche.tsx:733-825 (Jugement : favori, prix, Supprimer, 4 réinjections) ; App.tsx:2455-2459 (« aucun appel ne part d'ici ») ; Fiche.tsx:1483-1520 (RecetteEnLecture) et Fiche.tsx:295-300 (les deux portes) ; blocs repliables aux lignes 360, 469, 649, 674, 684, 989

**FORT — 195 phrases d'explication sont écrites en dur dans 28 écrans, alors qu'un recueil existe exactement pour ça et n'est presque pas branché. Le détail : 91 paragraphes de 45 signes ou plus, 36 spans longs, 68 raisons attachées à un contrôle grisé. 37 phrases supplémentaires sont enfermées dans une infobulle native du navigateur — donc invisibles au clavier, sur écran tactile, et à la première lecture. Pendant ce temps, interface/src/aide.ts tient 134 entrées d'explication (1 662 lignes), dont 97 avec une version longue, rendues à trois endroits possibles ; or seuls 10 en-têtes de section s'en servent dans tout le produit. La matière est bonne et déjà rédigée en français clair : elle est simplement au mauvais endroit.**

- *Le chiffre* : 195 phrases en dur dans les écrans contre 134 entrées rangées dans le recueil et 10 en-têtes qui l'emploient
- *La preuve* : Comptage sur les 33 composants : 91 <p> de ≥45 signes, 36 <span> longs, 68 <Raison texte=…>, 37 title= de ≥45 signes. interface/src/aide.ts : 134 clefs, 135 champs « quoi », 97 champs « long ». Usages : 109 libellés portent une clef d'aide, 9 appels à useInfobulle, 10 EnTeteDeSection (Calibrage.tsx:185, FicheChose.tsx:415/429/447/476/494/517, plus 3 dans Codex.tsx)

**MOYEN — Répartition des explications en dur par écran, du pire au moins pire : Assistant.tsx 33 en permanence (+2 en infobulle), Ambiances.tsx 18 (+2), Personnages.tsx 16 (+21 en infobulle — le champion de l'aide cachée), Places.tsx 16, Fiche.tsx 14 (+1), Envoi.tsx 12, Planche.tsx 10 (+1), FicheChose.tsx 9 (+1), Codex.tsx 8 (+3), Calibrage.tsx 7. Ces phrases pourraient presque toutes rejoindre le recueil : elles décrivent un réglage, pas un état — « Il décide des attitudes qu'on lui demande », « Elle part avec chaque image de ce personnage », « La palette agit au retour, sur la machine ». Les 68 raisons de grisé, elles, doivent rester où elles sont : elles nomment un refus, ce que le recueil s'interdit explicitement.**

- *Le chiffre* : 33 phrases permanentes sur le seul écran des réglages du jeu ; 21 phrases cachées en infobulle sur l'établi
- *La preuve* : Comptage par fichier des <p>, <span> longs et <Raison> de ≥45 signes, opposé au comptage des title= de ≥45 signes. Le partage entre les deux est écrit dans interface/src/aide.ts:24-27 : « Ce corpus ne porte jamais une raison […] Une infobulle qui porterait une raison est un bug »

**FAIBLE — Une couleur employée à l'écran n'existe pas. Personnages.tsx:2303 pose les classes text-attente et border-attente/60 sur la petite liste déroulante « à confirmer » de chaque image dont la direction est inconnue, mais aucun jeton --color-attente n'est défini dans interface/src/index.css. En Tailwind v4, ces classes ne produisent alors aucune règle : le contrôle n'a ni couleur de texte à lui ni bordure, et il est rendu à 8 pixels — la plus petite taille du produit — dans la couleur héritée de son parent.**

- *Le chiffre* : 1 contrôle, 2 classes sans effet, rendu à 8 px
- *La preuve* : interface/src/composants/Personnages.tsx:2303 (className="mesure h-[16px] w-[44px] rounded-[2px] border border-attente/60 bg-fond-2 px-0.5 text-[8px] text-attente") ; aucune occurrence de --color-attente ni de --attente dans interface/src/

### Ce qui marche aujourd’hui, et qu’une refonte perdrait

- Le recueil d'explications de interface/src/aide.ts — 134 entrées, 1 662 lignes, dont 97 avec une version longue — est écrit en français clair, sans jargon, avec un gabarit imposé (« ce que c'est », « ce que ça change », « d'où ça sort »). C'est un an de rédaction déjà faite. Une refonte qui repartirait de zéro sur les textes perdrait la meilleure matière du produit ; il faut au contraire la brancher partout plutôt que de la doubler dans les écrans.
- Le motif « le grisé porte sa raison » : 68 contrôles indisponibles portent une phrase qui dit pourquoi, juste en dessous, et jamais au survol. C'est rare et c'est juste. Exemples : Fiche.tsx:295 « cette image n'appartient à aucune chose du jeu — la rattacher plus haut lui ouvre son établi », Ambiances.tsx:608 « une seule source — tout vient d'elle ; ajoute-en une seconde pour doser ».
- La transparence du coût. 18 chaînes affichées dans 12 composants disent explicitement si un geste dépense ou non — « prépare le prompt dans l'atelier — rien n'est dépensé ici », « aucun appel ne part d'ici », « rien ne repart chez le fournisseur ». Sur un outil qui paie des appels à l'image, c'est la promesse centrale du produit et elle est tenue à la lettre.
- La profondeur plutôt que les fenêtres. Un outil ouvert remplace la matrice de l'établi au lieu de se poser dessus (Personnages.tsx:322-380), l'assistant ne monte qu'une étape sur douze (Assistant.tsx:411-441), l'écran de choix d'une planche prend la place de la grille (App.tsx:2418-2432). Il n'y a aucune boîte de dialogue modale dans le produit.
- Les états vides écrits comme des invitations, en serif 32 pixels, dans 13 fichiers : « Ce jeu n'a encore personne. Nomme le premier. » (Personnages.tsx:996), « Un jeu n'a pas un seul style. Nomme le premier coin. » (Ambiances.tsx). C'est le seul endroit où l'interface a une voix, et elle est juste.
- Le bloc repliable qui « porte sa valeur quand il est replié » (chassis.tsx:448) : replier n'y est pas ranger, c'est résumer. Le mécanisme est bon, il est simplement sous-employé — 6 emplois dans la fiche pour 14 rubriques.
- La chasse fixe avec chiffres de largeur fixe et virgule décimale sur les vraies mesures (index.css:93-98). L'intention est juste ; c'est son débordement sur les boutons et la prose qui casse tout.
- La densité est légitime là où l'écran est un tableau : la matrice de l'établi (une ligne par attitude, une colonne par direction), l'écran de confirmation avant dépense (Envoi.tsx : 56 mesures et 17 blocs, c'est le dernier écran avant de payer), les panneaux d'outil des tables (Places.tsx : 29 contrôles, un outil a des réglages), et le Guide (118 chaînes, 39 phrases — il est fait de prose). Ces quatre-là ne sont pas mal rangés, ils sont riches.

### Ce que ce relevé impose

- Remonter les fonds avant tout le reste. L'auteur dit « c'est trop sombre » ; la mesure dit pourquoi : les quatre surfaces vivent entre 0,004 et 0,017 de luminance relative, soit les deux premiers pour cent de l'échelle, et deux surfaces voisines se distinguent à 1,05 contre 1. Il faut un écart d'au moins 1,3 contre 1 entre deux surfaces voisines pour qu'un panneau se voie sans trait, ce qui suppose de remonter le fond le plus clair bien au-dessus de #1e242b — sans aller au blanc, que l'auteur refuse et qui fausserait le rendu des sprites.
- Rendre les traits visibles, ou renoncer aux traits. 84 % des séparations du produit sont à moins de 1,4 contre 1. Soit on porte le trait de rangement à 3 contre 1 minimum, soit on abandonne le trait au profit d'un écart de fond — mais on ne peut pas continuer à n'avoir ni l'un ni l'autre en interdisant par ailleurs l'ombre et l'arrondi.
- Tout contrôle doit porter une forme. Les 163 boutons sans fond ni trait sont la cause directe de « ce qui est cliquable ou pas ». Il faut trois formes closes et pas plus — le bouton plein pour le geste qui paie, le bouton à trait pour le geste ordinaire, le lien souligné pour la navigation — et interdire la quatrième catégorie actuelle, le texte gris cliquable, qui représente à elle seule 76 contrôles.
- Fermer l'échelle typographique à cinq valeurs, avec au moins 2 pixels d'écart, et remonter le plancher. Les 20 tailles actuelles, dont dix entre 9 et 13,5 pixels, ne peuvent produire aucune hiérarchie ; et 72 % du texte à 10 pixels ou moins est la deuxième cause de l'illisibilité, après le contraste.
- Rendre la chasse fixe aux nombres seuls. 313 emplois sur 604 sont à retirer : les 168 boutons et les 145 paragraphes. C'est le geste qui séparera visuellement, d'un coup, « ce qu'il faut lire » de « ce qu'il faut relever ».
- Introduire des icônes, et accepter que ce soit un système à construire. Avec 5 dessins vectoriels et zéro icône, chacun des 258 boutons doit se nommer en toutes lettres — c'est là que naît mécaniquement la charge de texte. Les gestes répétés de l'établi (fabriquer, ouvrir la planche, ranger, retirer, marquer favori) sont les premiers candidats : à eux seuls ils représentent plusieurs dizaines de libellés par écran.
- Sortir la prose des écrans vers le recueil qui l'attend. 195 phrases sont à examiner : celles qui décrivent un réglage rejoignent aide.ts et se rendent au survol ou dans le Guide ; les 68 qui nomment un refus restent où elles sont, attachées à leur contrôle — le recueil s'interdit explicitement de porter une raison, et il a raison. Corollaire : ne jamais mettre une explication dans un title= natif, les 37 actuelles sont inatteignables au clavier.
- « Afficher pile quand il faut » a un objet précis et mesurable : les 4 nombres de contrôle qualité affichés sur chaque ligne de matrice, les 12 valeurs d'étape répétées trois fois dans l'assistant, les 4 boutons de réinjection dans une fiche dont l'écran ne dépense rien, et les 14 rubriques empilées dans une colonne de 380 pixels. Un geste par défaut par ligne, le reste à la demande.
- La demande d'adapter les couleurs à la palette du jeu actif est compatible avec le système existant : dix teintes d'îlot sont déjà définies comme « le seul endroit du produit où une couleur ne veut rien dire » (index.css:26-46), et deux arcs de la roue sont déjà réservés aux quatre couleurs sémantiques. C'est le bon point d'ancrage — la palette du jeu doit entrer par là, pas par les couleurs d'état.

---

<a id="releve-3"></a>

## 3 · Le parcours ne se dessine pas : quatre trajets tracés dans le code, et ce que chaque écran annonce (ou non) de l'étape suivante

L'auteur a raison, et la cause est mécanique : le produit n'a qu'un seul niveau de poids visuel, donc aucun écran ne peut désigner son geste suivant. Sur 259 boutons, 232 (90 %) n'ont ni cadre ni fond — ce sont des textes ; le seul habillage qui crie « c'est ici qu'on agit » (fond cyan plein) n'est employé qu'à 8 endroits dans tout le produit, et 26 boutons partagent au contraire exactement la même apparence (10 px, texte cyan, sans cadre) pour des gestes aussi éloignés qu'ouvrir un écran, fermer, armer une dépense ou recalculer tout le projet. À cela s'ajoute que les surfaces ne se séparent pas : l'écart de luminosité entre le fond de page et un panneau vaut 1,05 pour 1, celui d'un onglet allumé 1,18 pour 1 — autrement dit rien ne délimite rien, et l'onglet où l'on se trouve ne se distingue quasiment que par la nuance de son texte. Enfin l'accueil est un cul-de-sac démontrable : la galerie, écran de départ, affiche « Rien n'est encore sorti d'ici. Écris. » alors qu'aucun champ ne s'y trouve, et son propre pied dit dix lignes plus bas « aucun appel ne part d'ici ». Un seul écran du produit dessine un parcours — l'assistant en 12 étapes — et il ne s'ouvre qu'une seule fois dans la vie de l'atelier, refermé pour toujours dès qu'on a nommé son jeu à l'étape 1.

### Les constats

**BLOQUANT — L'ecran d'accueil est un cul-de-sac qui se contredit lui-meme. La galerie est l'onglet de depart ; son etat vide dit « Rien n'est encore sorti d'ici. Ecris. » alors qu'aucun champ de saisie n'existe sur cet ecran, et son pied de page affirme au meme instant le contraire. Rien n'y nomme le chemin vers l'endroit ou l'on fabrique.**

- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/App.tsx:3029 (« Ecris. ») et C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/App.tsx:2461 (« aucun appel ne part d'ici ») — les deux sont rendus dans la meme colonne, simultanement ; la barre qui paie n'est passee qu'au Codex et a l'etabli (App.tsx:2594 et 2611)

**BLOQUANT — Rien n'a l'air cliquable. Sur les 259 boutons du produit, 232 n'ont ni bordure ni fond : ce sont des mots posés dans le texte, qui ne se revelent qu'au survol.**

- *Le chiffre* : 232 sur 259, soit 90 %
- *La preuve* : comptage effectue sur les 33 composants de C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/ plus App.tsx : 18 boutons portent une bordure, 21 un fond, 232 ni l'un ni l'autre

**BLOQUANT — Il n'existe qu'un seul habillage d'action dominante — un fond cyan plein — et il n'est employe qu'a huit endroits dans tout le produit. Aucun des ecrans ou l'on passe le plus de temps ne le porte.**

- *Le chiffre* : 8 emplois pour 259 boutons, soit 3 %
- *La preuve* : le drapeau `principal` du bouton partage (C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/chassis.tsx:518) n'est passe que dans Calibrage.tsx:260, ChampPrompt.tsx:278, Decoupe.tsx:446, Depliage.tsx:123, Envoi.tsx:644, Planche.tsx:374, Secrets.tsx:161 ; plus un bouton cyan ecrit a la main dans Assistant.tsx:542

**BLOQUANT — Vingt-six boutons portent exactement le meme habillage — 10 px, texte cyan, ni cadre ni fond — pour des gestes qui n'ont rien de commun : « sa fiche », « la vitrine », « le calibrage », « la planche », « Fabriquer » (qui prepare une depense), « Fermer la fiche », « Tout realigner » (qui recalcule tout le projet). L'oeil ne peut pas les classer.**

- *Le chiffre* : 26 boutons, un seul habillage ; 39 habillages de bouton distincts au total pour 259 boutons
- *La preuve* : comptage par signature de style sur les memes 34 fichiers ; exemples dans C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx:2130, 2144, 1339, 1349, 1363

**BLOQUANT — Le seul parcours reellement dessine du produit — l'assistant, 12 etapes avec un compteur « etape N sur 12 », des pastilles de progression et un bouton « Continuer » plein — ne s'ouvre qu'une seule fois dans la vie de l'atelier. Il se referme definitivement des que l'auteur nomme son jeu, ce qui est precisement l'etape 1. Au deuxieme lancement on retombe sur la galerie vide.**

- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/App.tsx:888 ouvre l'assistant si `premier_lancement` ; C:/STOCKAGE/PROJET/_DEV/gag2/atelier/services/bibliotheque.py:881 le rend faux des que le projet ne porte plus le nom par defaut ou contient une image ; App.tsx:230 fixe l'onglet de depart a la galerie

**FORT — Les surfaces ne se separent pas. Le fond de page, le fond d'un panneau et le fond d'un onglet allume sont a des ecarts de luminosite compris entre 1,05 et 1,18 pour 1 — c'est-a-dire invisibles. Un onglet actif ne se distingue quasiment que par la nuance de son texte, et une colonne ne se distingue de la page que par son filet.**

- *Le chiffre* : fond de page contre panneau : 1,05:1 ; panneau contre onglet allume : 1,18:1 ; filet de separation contre panneau : 1,29:1
- *La preuve* : calcul de contraste effectue sur les jetons de C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/index.css:13-18 ; l'onglet actif de C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/BarreChassis.tsx:395 utilise ce couple 1,18:1

**FORT — Le produit s'ecrit presque entierement en tout petit. Sur les 732 tailles de texte declarees, 661 valent 11,5 px ou moins, et 606 valent 11 px ou moins. Seules 25 declarations atteignent 13 px ou plus. Rien ne peut ressortir quand tout est a la meme (petite) taille.**

- *Le chiffre* : 90 % des tailles a 11,5 px ou moins ; 83 % a 11 px ou moins ; la taille la plus employee est 10 px, 385 fois
- *La preuve* : histogramme des declarations `text-[Npx]` sur les 34 fichiers d'interface

**FORT — Plus de la moitie des couleurs de texte employees sont le gris le plus faible de la palette, dont le contraste (3,21 pour 1) est volontairement sous le seuil de lisibilite. Le document de design le reserve « au redondant » — mais 318 de ces emplois sont combines a une taille de 10 px ou moins, et 103 portent sur des elements cliquables.**

- *Le chiffre* : 496 emplois sur 914 declarations de couleur de texte, soit 54 % ; 318 a 10 px ou moins ; 103 sur des boutons
- *La preuve* : comptage sur les 34 fichiers ; le jeton est defini en C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/index.css:22 ; exemple d'un bouton dans cette couleur : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx:2162

**FORT — Sur l'etabli d'une chose du jeu, cinq ecrans pleins se remplacent au meme endroit — la fiche, la vitrine, le calibrage, la planche, les tables de retouche — et le fil d'Ariane, seul indicateur de « ou suis-je », n'en nomme qu'un seul. On ouvre quatre ecrans differents et l'adresse affichee reste identique.**

- *Le chiffre* : 4 profondeurs sur 5 invisibles dans le fil
- *La preuve* : les cinq profondeurs sont montees en C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx:313-380 ; le fil ne s'allonge que pour l'image ouverte, C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/App.tsx:1929

**FORT — Deux commandes differentes portent le mot « Reglages » a une quarantaine de pixels l'une de l'autre, et menent a deux ecrans sans rapport : le bouton en haut a droite ouvre les reglages de l'outil (cles, dossier du jeu), l'onglet juste en dessous ouvre l'assistant qui decrit le jeu. C'est le seul chemin vers ce dernier.**

- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/BarreChassis.tsx:467 (bouton « Reglages ») et C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Univers.tsx:373 (cote « Reglages », rendu dans la barre situee juste dessous)

**FORT — La fiche d'une chose du jeu empile deux boutons rigoureusement identiques : « Fabriquer ce qui manque », qui prepare une depense, et « Ouvrir son etabli », qui change simplement d'ecran. Rien ne dit lequel est l'etape suivante, ni que le premier ne paie pas.**

- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx:925 et Codex.tsx:936 — deux appels au meme bouton partage, aucun des deux marque comme dominant

**FORT — La porte vers l'etabli d'une chose est le nom de cette chose : un texte de 13 px sans aucune marque, pose dans une carte dont le reste ne fait que la selectionner. Deux resultats differents pour un clic sur la meme carte. La phrase qui l'explique n'existe que dans le panneau vide de droite, en 10 px gris faible — et elle disparait au premier clic.**

- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx:711-721 (le nom en bouton nu, dans une carte dont le onClick selectionne) ; l'explication en C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx:789, rendue uniquement quand aucune chose n'est choisie

**FORT — Le geste terminal du produit — poser les fichiers du personnage dans le dossier du jeu — est un bouton ordinaire, au fond d'une colonne de 300 px qui defile, sous l'identite et le type. C'est l'aboutissement de tout le travail et rien ne le distingue d'un bouton de reglage.**

- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx:1119-1128, dans un panneau `overflow-y-auto` de 300 px (Personnages.tsx:1013)

**FORT — Juste apres avoir paye une planche, la decision qui suit — choisir quelles images on garde — est ecrite dans le plus petit corps de tout le produit, 9,5 px, en lien cyan a l'interieur d'une vignette.**

- *Le chiffre* : 9,5 px, la plus petite taille employee pour une action
- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Tuile.tsx:202-206

**MOYEN — L'ecran de decoupe de la galerie est inatteignable : la variable qui l'ouvre n'est jamais posee a autre chose que « ferme », dans tout le depot. Le commentaire du code affirme pourtant qu'il « garde sa porte, celle de la fiche » — porte que la fiche ne porte plus.**

- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/App.tsx:515 declare `decoupeOuverte` ; les 6 autres occurrences (App.tsx:1959, 1961, 1965, 2155, 2180, 2322, 2326) la remettent toutes a vide ; l'ecran rendu en App.tsx:2316-2328 ne s'affiche donc jamais

**MOYEN — La barre des tables de retouche aligne neuf onglets de meme poids (10 px, sans cadre), dans une bande de 34 px qui deborde et defile horizontalement. Le code lui-meme note la mesure : 1 323 px demandes pour 1 280 offerts. Une partie des outils de traitement sort donc de l'ecran.**

- *Le chiffre* : 9 tables de meme poids ; 1 323 px demandes pour 1 280 disponibles
- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Tables.tsx:85-94 (les neuf) et Tables.tsx:502-512 (la mesure inscrite dans le commentaire de la bande)

**MOYEN — Le deroule du travail n'est ecrit nulle part a l'ecran : il n'existe qu'en prose, dans le Guide, derriere une touche et un bouton. Aucun ecran de travail ne porte de compteur d'etape ni de mention de ce qui vient ensuite — le mot « etape » n'apparait dans une interface que dans l'assistant.**

- *Le chiffre* : 1 310 mots de texte dans le Guide ; 1 seul ecran sur environ 45 porte un compteur d'etape
- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Guide.tsx:349-400 decrit les trois onglets et l'etabli en paragraphes ; le seul compteur est en C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Assistant.tsx:524

**MOYEN — La densite est mesurable : 437 declarations de controle interactif, 106 fleches « › » servant de lien, 95 infobulles natives qui portent des explications que l'ecran ne montre pas, et environ 6 000 mots de texte litteral dans l'interface.**

- *Le chiffre* : 437 controles, 106 liens flechés, 95 infobulles, ~6 000 mots
- *La preuve* : comptages effectues sur les 33 composants de C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/ et App.tsx ; les fichiers les plus charges sont Assistant.tsx (63 controles), Personnages.tsx (43), Places.tsx (29), Fiche.tsx (27)

**MOYEN — Sur la galerie, le champ de recherche, le choix de collection, le filtre favoris et les trois crans de zoom font tous 26 px de haut et 10 a 11 px de texte, exactement comme les trois onglets de navigation du produit. Le controle qui change de lieu et celui qui change de tri ont le meme poids.**

- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/BarreOutils.tsx:132-175 (tous les controles en h-[26px], text-[10px] ou [11px]) et C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/BarreChassis.tsx:393 (les onglets, h-[26px], text-[12px])

**MOYEN — Les deux seuls boutons a cadre de la barre de tete sont « Reglages » et « Guide » — c'est-a-dire les deux commandes qui ne parlent pas du travail. Ils sont visuellement plus lourds que les trois onglets qui portent toute la navigation du produit.**

- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/BarreChassis.tsx:467-468 (boutons de 34 px avec bordure) contre BarreChassis.tsx:393 (onglets de 26 px sans bordure)

**MOYEN — Sur la matrice de l'etabli, chaque ligne d'attitude porte trois commandes de meme apparence — « la planche › », « Fabriquer › », « × » — dont la deuxieme est celle qui engage l'argent. Avec un plan de douze poses, la meme apparence se repete une trentaine de fois sur un seul ecran.**

- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx:2124-2163 : trois boutons consecutifs, tous en `text-[10px]`, les deux premiers en cyan

**FAIBLE — Depuis le Codex, le bouton « Payer et lancer » reste actif meme quand aucune case n'est visee : il suffit d'un modele et d'un texte. Rien a l'ecran ne dit que l'image ira alors dans la bibliotheque sans appartenir a la chose qu'on regarde.**

- *La preuve* : la liste des refus en C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/App.tsx:1141-1164 ne verifie que la panne, la liaison, le catalogue, le modele et le prompt — jamais la cible

### Ce qui marche aujourd’hui, et qu’une refonte perdrait

- Les etats vides sont excellents et il ne faut pas les perdre : un verbe a l'imperatif en gros serif — « Ecris. », « Nomme le premier. », « Colle. », « Nomme le premier coin. » — plus une phrase qui explique quoi. Le motif est deja uniforme (9 emplois du meme corps de 32 px). Ce qui leur manque n'est pas le texte, c'est le bouton a cote.
- L'assistant de l'univers est le seul endroit du produit ou un parcours est reellement dessine, et il est bien fait : douze etapes nommees et groupees, un compteur en toutes lettres, des pastilles qui distinguent « ou je suis », « ce que j'ai rempli » et « ce que je n'ai pas ouvert », un bouton « Continuer » plein et une sortie « j'ai fini pour l'instant » qui ne juge personne (Assistant.tsx:480-548). C'est le modele a generaliser.
- L'ecran de confirmation avant la depense est exemplaire : chaque texte et chaque image qui partent sur leur ligne avec un interrupteur, le prix annonce dans le libelle du bouton, un bouton dominant, et une sortie explicite « Revenir sans rien depenser » (Envoi.tsx:643-676). C'est le seul ecran ou la hierarchie fait son travail.
- Le grise porte sa raison en toutes lettres, sous le controle, au lieu d'une infobulle — un composant dedie s'en charge (chassis.tsx:155). Beaucoup de produits n'ont pas ca.
- Un seul endroit d'ou l'argent part par ecran, et la galerie le dit noir sur blanc. La regle est juste ; c'est sa mise en scene qui manque.
- Le fil d'Ariane existe, chaque etage ramene au sien, et il change de forme selon la porte par laquelle on est entre (BarreChassis.tsx:59-103). La mecanique est la, il ne lui manque que d'etre nourrie par les profondeurs qui l'ignorent.
- La discipline du code est reelle : sur 284 gestes de clic, seuls 4 sont poses sur autre chose qu'un vrai bouton. Le probleme est entierement visuel, pas structurel — un changement d'habillage suffira, sans reecrire la navigation.
- Les images sont la seule chose coloree a l'ecran, et c'est une bonne intention : la planche contact ne se salit d'aucune couleur d'interface. Elle peut se tenir meme en remontant le fond.

### Ce que ce relevé impose

- Il faut un vocabulaire de poids, et il n'en existe aujourd'hui qu'un seul niveau. Trois suffisent : une action dominante (pleine, coloree, plus grande), une action secondaire (cadre), un lien (texte). Et une regle dure : un seul dominant par ecran, celui qui fait avancer le travail. C'est ce qui transformera 26 boutons interchangeables en une hierarchie lisible.
- Chaque ecran doit designer son geste suivant, et pas seulement offrir les gestes possibles. Concretement : la galerie doit porter un bouton qui mene la ou l'on fabrique ; la fiche d'une chose doit distinguer « Fabriquer ce qui manque » d'« Ouvrir son etabli » ; l'etabli doit mettre en avant « Poser dans le dossier du jeu » quand plus rien ne manque.
- Les surfaces doivent se separer pour de vrai. A 1,05 pour 1 entre la page et un panneau, aucune colonne n'existe visuellement. Remonter le fond, comme l'auteur le demande, sert exactement a ca : degager de la place sous les surfaces pour que les panneaux, les cartes et l'onglet allume puissent se distinguer sans ajouter une seule couleur.
- La taille de base doit remonter. 83 % du texte est a 11 px ou moins ; il n'y a plus aucune marge pour dire « ceci compte plus que cela ». Il faut liberer deux ou trois crans vers le haut pour les titres, les actions et les valeurs, et reserver le 10 px aux vraies metadonnees.
- Le gris le plus faible ne peut plus habiller ni un bouton ni une explication necessaire. 103 boutons et 318 textes de 10 px l'emploient aujourd'hui — le mettre sur ce qui doit etre lu ou clique est exactement ce que l'auteur decrit comme « decrypter l'interface ».
- Le fil d'Ariane doit nommer les cinq profondeurs de l'etabli et les trois cotes de l'univers. Aujourd'hui on peut changer quatre fois d'ecran plein sans que l'adresse affichee bouge — le produit oblige l'oeil a reconstruire ou il est a partir du contenu.
- Deux commandes ne peuvent plus porter le meme mot dans la meme bande. « Reglages » l'outil et « Reglages » le jeu doivent etre renommes, et l'assistant du jeu doit devenir atteignable autrement que par un onglet de second rang.
- L'accueil doit devenir l'endroit d'ou l'on fabrique, ou envoyer explicitement vers lui. Tant que l'ecran de depart est celui qui ne peut rien produire, le premier geste du produit reste a deviner — et l'assistant qui l'expliquait ne se rouvrira jamais.
- L'assistant a droit a une seconde vie : il doit pouvoir se rouvrir a la demande, et son vocabulaire — compteur d'etape, progression, bouton qui fait avancer — doit descendre dans les parcours qui n'en ont aucun : fabriquer une image, traiter ce qui revient, sortir vers le jeu.
- Neuf tables de retouche de meme poids dans une bande qui deborde ne sont pas un outil : il faut soit les ordonner par le moment ou elles servent, soit ne montrer que celles qui s'appliquent a l'image ouverte.
- Le systeme n'a que trois glyphes dessines et 95 infobulles. Les icones que l'auteur reclame ne sont pas un ornement : elles sont ce qui permettra de distinguer d'un coup d'oeil ouvrir, fabriquer, supprimer et fermer, la ou aujourd'hui les quatre s'ecrivent en 10 px cyan.
- Il ne faut rien changer a l'ecran de confirmation avant depense, ni au grise qui porte sa raison, ni aux etats vides : ce sont les trois seuls endroits ou le produit sait deja parler. Une refonte doit les prendre pour modele, pas les remplacer.

---

<a id="releve-4"></a>

## 4 · Les mots employés à la place des signes — relevé des 278 boutons de l'atelier, de leur libellé exact et de la place qu'ils prennent

Passer aux icônes ne réglera pas ce que l'auteur décrit, et le relevé dit pourquoi : sur les 223 emplacements de bouton qui portent un texte écrit d'avance, 77 (35 %) pourraient devenir un pictogramme lu sans apprentissage, 95 (43 %) ne le peuvent pas — ce sont des actions ou des lieux que l'atelier a inventés — et 51 (23 %) sont illisibles dans les deux registres parce que le produit nomme déjà la même chose de plusieurs façons. Le défaut mesuré n'est pas la longueur des mots mais l'absence de cadre autour d'eux : 147 boutons sur 258 n'ont ni bordure ni fond, et 59 d'entre eux n'ont même pas la couleur d'accent — dans la barre de la galerie, le bouton « Supprimer » et le compteur « 12 sélectionnés » portent exactement les mêmes réglages de texte. La place gagnée en passant aux icônes est réelle mais faible : la barre la plus serrée passe de 1 284 à 1 011 pixels (−21 %) alors que sa colonne peut descendre à 520 — les icônes divisent le débordement par deux, elles ne le suppriment pas. Enfin la règle des « trois glyphes » n'existe plus dans le code : j'ai compté dix-huit caractères-signes rendus à l'écran et sept formes dessinées, avec deux croix différentes pour le même geste et un même triangle de coin qui veut dire deux choses.

### Les constats

**BLOQUANT — Plus d'un bouton sur deux n'a aucun cadre : ni bordure, ni fond de couleur. Rien dans sa forme ne dit qu'il se clique — il faut le survoler pour le découvrir. C'est exactement la plainte « on passe son temps à décrypter ce qui est cliquable ou pas ».**

- *Le chiffre* : 147 sur 258 (57 %) — dont 88 en cyan, la couleur d'accent, et 59 dans une couleur de texte ordinaire ; 75 seulement ont une bordure et 23 un fond
- *La preuve* : Comptage des classes d'apparence de chaque balise <button> des 35 fichiers de interface/src/composants (analyse de l'arbre syntaxique, script C:/Users/damie/AppData/Local/Temp/claude/C--STOCKAGE-PROJET--DEV-gag2/f996c324-e41a-4cf9-9f56-492ea7806e2f/scratchpad/formes.js)

**BLOQUANT — Dans la barre d'outils de la galerie, le bouton qui supprime la sélection et le compteur qui dit combien d'images sont sélectionnées sont écrits de façon rigoureusement identique — même police, même taille, même couleur. Seul le passage de la souris les sépare. Le geste le plus destructeur de l'écran ressemble à une information passive.**

- *Le chiffre* : les deux portent « text-[10px] text-texte-2 » en police à chasse fixe, à huit pixels l'un de l'autre
- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/BarreOutils.tsx:210 (le compteur) et :231 (le bouton Supprimer)

**FORT — La règle « trois glyphes dans tout le produit » ne décrit plus le code. En comptant seulement ce qui est réellement affiché — commentaires exclus, texte de l'interface uniquement —, je trouve dix-huit caractères-signes différents et sept formes dessinées à la main.**

- *Le chiffre* : caractères : › (71 textes), × (54), ↓ (9), → (6), − (5), ‹ (4), ⚠ (4), ↑ (4), ✕ (3), ✓ (2), ● (2), ○ (2), ◤ (2), ↕ (1), ← (1), plus + (18 libellés), · (293) et ≈, ° ; formes dessinées : triangle de coin de 13 px, carré de 9 px, carré de 14 px, le composant Carre, pastille ronde de 12 px, point de 5 px, grille de six points
- *La preuve* : Relevé sur l'arbre syntaxique de tous les .tsx (scratchpad/croix.js et glyphes2.js) ; la grille de six points est à interface/src/composants/Toile.tsx:1965, le carré de 9 px à chassis.tsx:874, celui de 14 px à Decoupe.tsx:332, le point de 5 px à chassis.tsx:1171

**FORT — Le même caractère × sert à deux choses opposées : « enlève ceci » sur un bouton, et « multiplié par » dans une mesure. Un seul libellé contient les deux emplois à trois centimètres d'écart.**

- *Le chiffre* : 17 boutons emploient × comme geste ; environ 35 autres emplacements l'emploient comme signe de multiplication (1×/2×/4×, 32×32, « réfs · ×4 », « Maj ×10 »)
- *La preuve* : Le libellé « × le rectangle — 128×96 » à interface/src/composants/Superposition.tsx:560-566 ; multiplication à PanneauReglages.tsx:466, chassis.tsx:142-144, Decoupe.tsx:715, Places.tsx:610-612

**FORT — Il y a deux croix différentes dans le produit pour le même geste — fermer ou retirer. Elles ne se ressemblent pas exactement à l'écran et ne viennent pas du même endroit du clavier.**

- *Le chiffre* : × employé dans 17 boutons, ✕ dans 3
- *La preuve* : × : App.tsx:2821 et :2952, Ambiances.tsx:502/696/966, Arbre.tsx:258, Assistant.tsx:2495/2673, Codex.tsx:820/1167, Personnages.tsx:626/720/842/2148/2343/2423, Places.tsx:1393 — ✕ : Fiche.tsx:174, Decoupe.tsx:721, Import.tsx:237

**FORT — Le seul vrai pictogramme du produit — le triangle plein posé dans un coin d'image — dit déjà deux choses différentes avec la même forme, la même couleur et le même coin. Un troisième, doré et au coin opposé, en dit une troisième. Le produit a donc déjà démontré, à petite échelle, que ses images ne se lisent pas.**

- *Le chiffre* : un triangle de 13 px, trois significations : « c'est cette image qui partira dans le jeu », « artwork officiel », « concept art de tel personnage »
- *La preuve* : interface/src/composants/Tuile.tsx:336-341 (favori, cyan, coin haut droit) ; Tableau.tsx:1002-1006 (artwork officiel, cyan, coin haut droit — identique) ; Tableau.tsx:1015-1019 (concept art, doré, coin haut gauche) ; Personnages.tsx:2668-2674

**FORT — Une seule et même action — dépenser de l'argent pour obtenir une image — est nommée par sept verbes différents selon l'écran. L'auteur doit apprendre sept mots pour un seul geste, et aucune icône ne peut réconcilier ce que le vocabulaire a séparé.**

- *Le chiffre* : 7 verbes : Générer, Fabriquer, Habiller, Lancer, Armer, Relancer, Réessayer
- *La preuve* : ChampPrompt.tsx:278 et :316 (Générer) ; Personnages.tsx:2138, 2333, 1826, Codex.tsx:922, Superposition.tsx:626, Assistant.tsx:1786 (Fabriquer) ; Personnages.tsx:2532 et 1826 (Habiller) ; Envoi.tsx:643 (Payer et lancer / Lancer — gratuit) ; Planche.tsx:373 (Armer) ; Tuile.tsx:208 et Arbre.tsx:364 (Relancer) ; Tableau.tsx:1559 (Réessayer)

**FORT — Faire disparaître quelque chose se dit de neuf façons, sans que les mots distinguent les conséquences — qui, elles, diffèrent vraiment : « Supprimer » envoie à la corbeille avec un délai pour se rétracter, « × » vide une case sans toucher la bibliothèque, « oublier » efface un enregistrement de réglages.**

- *Le chiffre* : 9 mots : supprimer, retirer, effacer, oublier, couper, mettre de côté, ne plus regarder, défaire, ranger — plus les deux croix
- *La preuve* : Supprimer (Ambiances.tsx:466, BarreOutils.tsx:227, Fiche.tsx:788, Personnages.tsx:1375, Arbre.tsx:125, Calque.tsx:744) ; Retirer/retirer (Assistant.tsx:2058, Tableau.tsx:1582, Fiche.tsx:1195, Secrets.tsx:170, App.tsx:3014, Places.tsx:442, Decoupe.tsx:455, App.tsx:2843) ; oublier (Tables.tsx:406) ; Couper (Toile.tsx:2713) ; la mettre de côté (Calibrage.tsx:284) ; « Ne plus regarder cette chose » (Codex.tsx:820)

**FORT — Quitter un écran se dit de douze façons, et le rappel de la touche Échap change même de ponctuation d'un écran à l'autre.**

- *Le chiffre* : 12 formulations ; « Fermer — Échap » à deux endroits contre « fermer · Échap » à un troisième
- *La preuve* : Depenses.tsx:281 et EcranReglages.tsx:98 (« Fermer — Échap ») ; Guide.tsx:165 (« fermer · Échap ») ; FicheChose.tsx:335, Vitrine.tsx:156, Calque.tsx:679, Envoi.tsx:946 et :192, Assistant.tsx:486, Depliage.tsx:76, Calibrage.tsx:172, Planche.tsx:133, Fiche.tsx:174

**FORT — L'état allumé / éteint — la même idée à chaque fois : « ceci compte ou ne compte pas » — se dessine de six façons différentes et s'écrit avec cinq paires de mots différentes.**

- *Le chiffre* : 6 formes, 5 paires de mots (montrer/masquer, éteindre/rallumer, cocher/décocher, allumer/éteindre, écarter/remettre)
- *La preuve* : Formes : carré de 9 px (chassis.tsx:874, Envoi.tsx:894, :1092, :1183), carré de 14 px (Decoupe.tsx:332), caractères ●/○ (Assistant.tsx:1673, EcranReglages.tsx:416), ✓ (PanneauReglages.tsx:572, Assistant.tsx:1641), pastille ronde de 12 px (Fiche.tsx:1354, Places.tsx:434), point de 5 px (chassis.tsx:1171). Mots : Fiche.tsx:1183, FicheChose.tsx:674 et :682, Envoi.tsx:879 et :1087, PanneauReglages.tsx:560, Tables.tsx:548

**FORT — Sur les 223 emplacements de bouton dont le texte est écrit d'avance, seuls 77 pourraient devenir un pictogramme évident. Presque le double ne le peut pas : ce sont soit des lieux que l'atelier a inventés (l'établi, la vitrine, le calibrage, la planche, les recettes, les tables, la superposition), soit des nuances de prix que la forme ne sait pas dire.**

- *Le chiffre* : 77 emplacements traduisibles (35 %) — 95 intraduisibles (43 %) — 51 ambigus dans les deux registres (23 %) ; en libellés distincts : 58, 89 et 32 sur 179
- *La preuve* : Classement à la main des 179 libellés distincts, rejoué par script (scratchpad/classe.js et distincts.txt). Exemples d'intraduisibles : « Payer et lancer » contre « Lancer — gratuit » (Envoi.tsx:643), « Revenir sans rien dépenser » (Envoi.tsx:664), « Rendre la main à l'atelier › » (ChampPrompt.tsx:246), « Sans zone › / Sans retouche › / Sans passages › » (Calque.tsx:605)

**MOYEN — La barre d'outils la plus serrée — celle de la galerie — ne serait pas sauvée par les icônes. En remplaçant par des carrés de 24 pixels les six contrôles qui ont un pictogramme évident, elle passe de 1 284 à 1 011 pixels ; or le fichier lui-même documente que sa colonne peut descendre à 520 pixels. Le débordement est divisé par deux, pas supprimé.**

- *Le chiffre* : 1 284 px mesurés → 1 011 px en icônes, soit −273 px (−21 %) ; groupe qui agit sur la sélection : 433 px → 307 px, soit −126 px (−29 %)
- *La preuve* : Mesure au navigateur avec les vraies polices du produit, contrôle de calibrage vérifié (la lettre M en JetBrains Mono à 10 px mesure exactement 6,00 px). Composition et largeurs prises dans interface/src/composants/BarreOutils.tsx:90-300 ; la contrainte des 520 px est écrite en commentaire à BarreOutils.tsx:102-104

**MOYEN — Dans la barre du haut, remplacer « Réglages » et « Guide » par deux carrés ne libère presque rien, et ce refus a déjà été payé une fois : les premières maquettes dessinaient une roue dentée et un point d'interrogation, tous deux retirés et remplacés par des mots.**

- *Le chiffre* : 137 px de mots contre 68 px en carrés de 34 px, soit 69 px gagnés sur une moitié de barre mesurée à 599 px (−12 %)
- *La preuve* : interface/src/composants/BarreChassis.tsx:462-469 pour les deux boutons, avec le commentaire qui rappelle le refus ; mesure au navigateur des libellés en Instrument Sans 13 px

**MOYEN — Les boutons sont larges : les neuf dixièmes dépassent la taille d'un carré d'icône. Le plus large contient une phrase de vingt-et-un mots.**

- *Le chiffre* : 189 boutons sur 223 dépassent 24 px ; largeur moyenne 85,6 px, médiane 70,8 px ; cumul de tous les libellés 19 095 px ; le plus large fait 626 px à lui seul
- *La preuve* : Mesure au navigateur des 223 libellés à leur taille et police réelles ; le libellé de 626 px est « ce morceau prend la place de l'originale… » à interface/src/composants/Decoupe.tsx:423

**MOYEN — Le produit emploie beaucoup plus de mots qu'il n'y paraît, parce qu'il en a trois jeux parallèles : ce qui s'affiche, ce que le lecteur d'écran annonce, et ce que dit l'infobulle. Ils ne disent pas tous la même chose au même endroit.**

- *Le chiffre* : 179 libellés visibles distincts, 132 étiquettes de lecteur d'écran distinctes, 88 infobulles distinctes — soit 399 formulations pour 278 boutons
- *La preuve* : Relevé sur l'arbre syntaxique des 35 fichiers de composants (scratchpad/ast.js). Exemple de divergence : Fiche.tsx:174 affiche « ✕ » et annonce « Fermer la fiche », tandis que Import.tsx:237 affiche le même « ✕ » et annonce « Oublier « … » »

**MOYEN — Cinq libellés existent en deux versions qui ne diffèrent que par la majuscule. Un même mot écrit deux fois différemment se lit comme deux mots.**

- *Le chiffre* : 5 paires : Retirer/retirer, Fermer/fermer, Favori/favori, Tout retirer/tout retirer, Paiement en cours…/paiement en cours…
- *La preuve* : scratchpad/vocab.txt, section « même libellé, casse différente », établie sur les 179 libellés distincts

**MOYEN — Le seul signe qui distingue « ce bouton mène ailleurs » de « ce bouton agit ici » est un petit chevron en fin de libellé — et ce même chevron sert aussi de séparateur dans le fil d'Ariane de la barre du haut. Le produit a donc une convention utile, mais elle porte déjà deux emplois.**

- *Le chiffre* : 53 libellés distincts sur 179 finissent par « › », soit 58 emplacements à l'écran
- *La preuve* : scratchpad/distincts.txt ; l'emploi comme séparateur de fil d'Ariane est à interface/src/composants/BarreChassis.tsx:236-240

**FAIBLE — Les trois documents de design ne s'accordent pas entre eux sur la liste des trois glyphes, et l'un d'eux annonce comme « premier glyphe du produit » une forme qui serait la quatrième.**

- *Le chiffre* : 3 inventaires incompatibles dans 2 fichiers
- *La preuve* : docs/DESIGN.md:47-48 « les trois glyphes du produit restent trois : +, le triangle plein, × » ; docs/design-motifs.md:286-287 « trois glyphes (+ de l'arbre, triangle plein du favori, carré de 9 px d'une étape) » ; docs/design-motifs.md:1274 « Les six points sont le premier glyphe du produit »

### Ce qui marche aujourd’hui, et qu’une refonte perdrait

- La barre de zoom des tables est déjà à moitié en signes et parfaitement lisible : deux carrés de 24 px pour reculer et approcher, deux mots pour « 100 % » et « ajusté ». C'est le modèle à généraliser — signe là où la forme est évidente, mot là où elle ne l'est pas, dans une bande de hauteur fermée. Voir interface/src/composants/Tables.tsx:900-975.
- Les infobulles disent la conséquence, pas la fonction : « les images déjà faites restent », « rien n'est dépensé ici », « l'image part à la corbeille — le pied de l'écran propose de la rendre ». Quatre-vingt-huit textes de ce genre. C'est le patrimoine le plus précieux du produit et une refonte le perdrait le plus facilement du monde.
- Les libellés qui portent le prix — « Payer et lancer » contre « Lancer — gratuit », « Revenir sans rien dépenser », « prépare la planche dans l'atelier — rien n'est dépensé ici » — disent avant le clic si le geste coûte. Aucun pictogramme ne sait faire ça, et c'est le cœur d'un outil où chaque image se paie.
- Le refus est écrit à côté du contrôle grisé, en permanence, et jamais caché dans un survol. Un contrôle fermé dit pourquoi il l'est.
- Le chevron « › » distingue déjà « ça mène ailleurs » de « ça agit ici », et il est tenu à 53 endroits. C'est une convention réelle, apprise, qui ne demande qu'à être rendue plus visible.
- Les rangées font déjà 24 ou 26 pixels de haut partout. C'est exactement la taille d'un carré d'icône : ajouter des cadres et des pictogrammes ne demanderait aucune hauteur nouvelle.
- Le libellé sert de poignée à son explication — le nom du réglage est déjà à l'écran et devient sa propre cible, ce qui évite trente points d'interrogation dans les panneaux. Le raisonnement reste bon même si l'exécution manque de cadre.

### Ce que ce relevé impose

- Le problème à traiter n'est pas « mots contre icônes », c'est l'absence de cadre. Cinquante-sept pour cent des boutons n'ont ni bordure ni fond : leur donner une forme cliquable règle la plainte principale sans toucher à un seul mot, et sans rien risquer sur le vocabulaire. C'est la première passe, et elle est indépendante de la seconde.
- Le budget d'icônes est plafonné par le relevé, pas par le goût : 77 emplacements sur 223. Toute icône au-delà de cette liste devra être apprise, et un outil à un seul utilisateur n'a pas de raison d'imposer un apprentissage à son unique utilisateur. La liste des 58 libellés traduisibles doit devenir une liste fermée, comme les hauteurs et les largeurs le sont déjà.
- Les 89 libellés irremplaçables imposent une forme mixte : un cadre, parfois un pictogramme, et le mot à côté. Interdire le mot à côté du signe reviendrait à effacer les nuances qui font l'outil — celles qui disent ce qu'une action coûte et ce qu'elle laisse en place.
- Avant d'ajouter la moindre image, il faut fermer le vocabulaire : un seul verbe pour dépenser, un seul pour faire disparaître, un seul pour quitter, un seul couple pour allumer et éteindre. Poser des icônes sur sept verbes qui désignent le même geste fabriquerait sept icônes pour un seul geste.
- Le caractère × doit choisir : signe d'action, ou signe de multiplication. Il ne peut pas rester les deux dans un produit qui affiche des tailles d'image partout. La multiplication est la fonction la plus fréquente et la moins remplaçable ; c'est donc l'emploi comme bouton qui doit céder.
- Une seule croix, pas deux. Et une seule signification par forme : le triangle de coin doit dire « c'est elle qui part » ou « c'est un artwork officiel », jamais les deux avec la même couleur au même coin.
- La place gagnée ne peut pas servir d'argument. Vingt-et-un pour cent sur la barre la plus serrée, douze pour cent sur la barre du haut : c'est réel mais très loin de ce qui manque. Si l'encombrement des barres est un vrai sujet, il se traite en enlevant des contrôles ou en les regroupant, pas en rétrécissant leurs libellés.
- La couleur d'accent unique est saturée : elle sert à la fois de couleur de lien, de couleur d'état choisi, de couleur du favori et de couleur du triangle « artwork officiel ». Adapter les couleurs à la palette du jeu actif, comme l'auteur le demande, suppose d'abord de séparer ces quatre emplois — sinon le nouveau jeu de couleurs héritera de la même confusion.
- Le refus historique des icônes est documenté et argumenté ; il n'a pas à être renversé en silence. La règle d'admission déjà écrite pour la grille de six points — « un glyphe n'entre que là où aucun mot ne peut tenir et où la forme est déjà lue sans apprentissage » — est le bon critère ; il suffit de l'appliquer aux 77 emplacements que le relevé désigne, et de constater qu'elle en interdit 146 autres.
- Ce qui doit survivre à la refonte, ce sont les 88 infobulles de conséquence et les libellés qui portent le prix. Ce sont eux qui font dire à l'auteur que « les fonctionnalités sont bien » ; une passe de design qui les remplacerait par des symboles muets détruirait la seule chose que l'interface fait déjà mieux que ses concurrentes.

---

<a id="releve-5"></a>

## 5 · Les quatorze défauts de l'audit du 31 août 2026, repris un par un dans le code du 4 septembre : onze réparés, deux sans objet, un seul encore ouvert

Onze des quatorze défauts sont réparés dans le code, et chacun se prouve à une ligne précise de interface/src. Deux n'ont plus d'objet : le n° 08 (le guide décrivait un écran périmé) était déjà corrigé avant même l'audit, et le n° 14 (une bascule qui annonce l'inverse) n'a jamais existé — le code écrit aria-pressed={!repliee}, ce qui est juste. Un seul reste ouvert, le n° 07 : sur Univers › Réglages, chaque réglage occupe encore l'écran seul, et aucune tranche du plan ne porte ce regroupement — G8 replie la liste de gauche, pas le panneau de droite. La refonte réclamée n'est donc pas un grand chantier : treize points sur quatorze ne demandent plus rien. En chemin, trois choses à corriger dans les documents plutôt que dans l'interface : le plan affirme que le zoom des tables est « pas fait », or il existe depuis le 31 août (G10 ne fait qu'en relever le plafond) ; les trois onglets de l'écran Univers gardent le gris pâle que le n° 02 a retiré partout ailleurs (3,2 : 1) ; et la ponctuation Markdown reste visible dans les notes de l'univers, sous-problème du n° 03 que la correction retenue n'avait pas promis de traiter.

### Les constats

**FORT — Défaut 07 — « Univers › Réglages : un réglage par écran, sept dixièmes de vide » — PAS FAIT, et aucune tranche du plan ne le porte. Le panneau de droite n'affiche toujours qu'une étape à la fois : douze conditions `etape === "…"` mutuellement exclusives se succèdent dans le même conteneur. Le regroupement par section proposé par l'audit (le jeu, le style, la production, l'atelier) n'existe que comme intertitres dans la colonne de gauche. La tranche la plus proche, G8, replie la *liste* des étapes en deux groupes et écrit explicitement « aucune étape ne disparaît : la page des réglages reste entière » — elle décide quand on voit une étape, jamais combien on en voit à la fois. N1 elle-même ne touche à aucun écran, et N2 n'est pas écrite.**

- *Le chiffre* : 1 des 14 encore ouvert ; 12 étapes, 1 seule affichée à la fois ; l'audit mesurait 70 % de panneau vide et un champ de nom de 1 064 px pour 20 lettres
- *La preuve* : interface/src/composants/Assistant.tsx:388-433 (les douze rendus exclusifs), 330-335 (les groupes, en en-têtes de colonne seulement) ; docs/PLAN.md:3494 (le critère de G8) ; docs/PLAN.md:2181-2186 (N2 n'est pas écrite)

**MOYEN — Le plan se trompe sur l'un des quatre défauts qu'il a sondés lui-même : il écrit « le zoom absent des tables — pas fait — c'est G10 ». Le zoom existe depuis le 31 août : la table ouvre en « ajusté », offre un champ en pour cent, des boutons plus/moins sur seize arrêts, un bouton 100 %, et la molette. G10 ne crée pas ce zoom, elle en relève le plafond (250 %, une constante) et corrige un « ajusté » qui échoue au-delà. Le sondage du plan sous-estime donc ce qui est déjà réparé.**

- *Le chiffre* : le sondage du plan annonçait 3 réparés sur 4 ; le relevé complet en donne 13 sur 14
- *La preuve* : interface/src/composants/Tables.tsx:1324 (`useState<ZoomTable>("ajuste")`), 882-975 (les commandes), 1366-1400 (la molette), 998-1009 (ZOOM_MAX = 250 et les arrêts) ; docs/PLAN.md:2165 (l'affirmation) ; docs/PLAN.md:3523-3535 (ce que G10 livre réellement)

**MOYEN — Le défaut 02 a été corrigé sur les deux endroits qu'il nommait, mais la même faute survit sur une troisième barre que l'audit n'avait pas mesurée : les trois côtés de l'écran Univers — Inspiration, Réglages, Ambiances et couleurs — s'écrivent en `--texte-3` quand ils sont éteints, soit 3,2 : 1 sur `--fond-1`. C'est exactement l'argument que l'audit opposait aux onglets Univers et Codex : un onglet de navigation n'est ni un grisé, ni une méta, ni une raison, et rien d'autre à l'écran ne dit qu'il existe.**

- *Le chiffre* : 3,2 : 1 contre un seuil confortable de 4,5 : 1 ; `--texte-2` sur le même fond donne 7,1 : 1
- *La preuve* : interface/src/composants/Univers.tsx:405-407 (`text-texte-3 hover:bg-fond-2 hover:text-texte-2`) ; contraste recalculé par moi sur #5E6771 contre #111419 ; à comparer à interface/src/composants/BarreChassis.tsx:396, corrigé en `text-texte-2`

**FAIBLE — Défaut 03 — la note de l'univers — FAIT pour ce que la correction retenue promettait : les retours à la ligne sont rendus et la zone défile. Mais le deuxième des trois sous-problèmes reste entier : la ponctuation d'écriture (les dièses des titres, les étoiles du gras, les barres des tableaux) s'affiche toujours telle quelle. Le texte est posé brut dans un paragraphe, et le dépôt n'embarque aucune bibliothèque de mise en forme.**

- *Le chiffre* : 1 des 3 sous-problèmes du n° 03 non traité ; la note mesurée fait 4 350 mots
- *La preuve* : interface/src/composants/Tableau.tsx:978-986 (`whitespace-pre-wrap`, `overflow-y-auto`, puis `{carte.texte}` brut) ; interface/package.json:12-16 (trois dépendances, aucune de rendu Markdown)

**FAIBLE — Défaut 01 — l'image occupait un cinquantième de la table de retouche — FAIT. La table s'ouvre en « ajusté », c'est-à-dire au pour cent qui fait tenir l'image entière dans le cadre mesuré ; changer d'image y revient ; et une commande de zoom vit à côté des modes brut / rendu / côte à côte.**

- *Le chiffre* : 1,9 % de remplissage mesuré à l'audit ; l'ouverture se fait désormais au facteur qui remplit le cadre
- *La preuve* : interface/src/composants/Tables.tsx:1324, 1328, 1338-1346 (le calcul d'ajusté), 836 (la commande posée dans la barre)

**FAIBLE — Défaut 02 — les chiffres sous les images et les onglets éteints trop pâles — FAIT aux deux endroits nommés. La ligne de mesures d'une tuile, qui porte le prix, est passée en `--texte-2` à 11 px ; les onglets Univers et Codex éteints sont passés en `--texte-2`.**

- *Le chiffre* : de 3,0 : 1 à 6,7 : 1 sur une tuile, et de 3,2 : 1 à 7,1 : 1 sur un onglet — contrastes recalculés par moi ; la taille passe de 9,5 à 11 px
- *La preuve* : interface/src/composants/Tuile.tsx:241 (`text-[11px] text-texte-2`) et 272 (le prix dans cette ligne) ; interface/src/composants/BarreChassis.tsx:396

**FAIBLE — Défaut 04 — rien ne disait qu'on peut cliquer — FAIT. Une règle nommée rend la main aux boutons actifs, aux résumés dépliants, aux étiquettes liées, aux éléments qui jouent le rôle de bouton et aux liens ; un bouton éteint reprend la flèche, ce qui est délibéré et écrit.**

- *Le chiffre* : 38 boutons mesurés sans main à l'audit ; la règle s'applique d'un coup à tous les écrans
- *La preuve* : interface/src/index.css:214-225

**FAIBLE — Défaut 05 — Échap ne fermait ni les Réglages ni les Dépenses — FAIT sur les deux surfaces nommées, et chacune l'écrit sur son bouton de sortie. Le panneau des Réglages est en outre déclaré comme fenêtre par-dessus.**

- *Le chiffre* : 9 fichiers de l'interface portent aujourd'hui une écoute directe de la touche Échap
- *La preuve* : interface/src/composants/EcranReglages.tsx:63-69 et 98 ; interface/src/composants/Depenses.tsx:159-163 et 286 ; EcranReglages.tsx:82-85 (role dialog, aria-modal)

**FAIBLE — Défaut 05b — la galerie restait vivante sous la table de retouche — FAIT. La grille de la galerie n'est plus montée quand une image est ouverte dans les tables : sa condition de rendu porte désormais `!imageDesTables`.**

- *Le chiffre* : 152 commandes atteignables au clavier à l'audit, dont 83 hors écran, et 54 px de débordement de page
- *La preuve* : interface/src/composants/../App.tsx:2361-2363 (`!depensesOuvertes && !envoiOuvert && onglet === "galerie" && !planche && !imageDesTables`), commentaire de mesure en 2352-2360

**FAIBLE — Défaut 06 — 26 Mo téléchargés pour 49 vignettes — FAIT, et par les trois gestes que l'audit classait par rentabilité. Le serveur sert une image réduite par cran de grille ; la tuile ne charge que ce qui approche de l'écran ; et la mise en mémoire est autorisée dès que l'adresse porte l'empreinte de la recette, ce qui la rend sûre.**

- *Le chiffre* : 25,5 Mo pour 0,5 Mo affiché à l'audit, 82 requêtes, 318 Ko par vignette ; la vignette est servie en 4 écrans du produit
- *La preuve* : atelier/api/routes.py:1223-1244 (la route vignette), 1216-1220 (un an de cache si `v`, sinon no-store) ; interface/src/api.ts:4264-4265 (l'adresse) ; interface/src/composants/Tuile.tsx:167-168 (`loading="lazy"`, `decoding="async"`) et 109-110 (la tuile demande la vignette)

**FAIBLE — Défaut 08 — le guide décrivait un écran nommé « Atelier » avec quatre colonnes — DEVENU SANS OBJET, et il l'était déjà le soir de l'audit. Le guide ne nomme plus d'écran « Atelier », il décrit « Le codex », et le mot est dans le sommaire comme dans le corps. Aucune largeur de colonne n'y est plus citée : les chaînes « quatre colonnes », « 240 px », « 380 px » sont introuvables dans le guide et dans le recueil d'explications.**

- *La preuve* : interface/src/composants/Guide.tsx:98-107 (la liste des lieux), 115-118 (« l'écran qui s'appelait l'Atelier n'existe plus »), 126, 368-378 (la section « Le codex ») ; recherche sans résultat de « quatre colonnes » et « Atelier » dans interface/src/aide.ts

**FAIBLE — Défaut 09 — deux boutons de noms différents menaient au même endroit — FAIT. Le lien « La régler dans les tables › » a disparu de la rubrique haute ; il ne reste qu'un seul appel à l'ouverture des tables dans toute la fiche, celui du pied.**

- *Le chiffre* : 2 contrôles pour 1 destination à l'audit, 1 aujourd'hui
- *La preuve* : interface/src/composants/Fiche.tsx:297 (l'unique bouton), 1513-1518 (la trace écrite du retrait) ; `onOuvrirLesTables` n'apparaît que trois fois dans le fichier : la prop, son type et cet appel

**FAIBLE — Défaut 10 — les deux barres de la galerie se recouvraient — FAIT, avec le diagnostic corrigé : ce n'était pas un recouvrement mais un rognage silencieux. La rangée est coupée en deux groupes ; celui qui consulte (chercher, filtrer, compter, zoomer) se replie et défile, celui qui agit sur la sélection est en `shrink-0` et ne bouge jamais.**

- *Le chiffre* : 92 px de « Désélectionner » hors cadre et « Supprimer » coupé en plein mot à 1440 px, à l'audit
- *La preuve* : interface/src/composants/BarreOutils.tsx:109-124 (la mesure et la règle), 125-126 (les deux conteneurs), 208 (`flex shrink-0` sur le groupe de la sélection), 227-241 (Supprimer et Désélectionner, tous deux `shrink-0`)

**FAIBLE — Défaut 11 — sur l'établi, le bouton qui supprime le personnage sortait de la colonne — FAIT. La rangée de liens passe à la ligne (`flex-wrap`), et Supprimer est poussé au bout par `ml-auto` pour tomber seul à la ligne suivante quand la place manque ; il est aussi le seul des quatre à ne pas porter la couleur d'un lien.**

- *Le chiffre* : 284 px de colonne visible pour 372 px de contenu, soit 72 px hors écran, à l'audit
- *La preuve* : interface/src/composants/Personnages.tsx:1335 (`flex flex-wrap items-center gap-x-3 gap-y-1`), 1377-1390 (le bouton Supprimer, `ml-auto`), 1310-1324 (la mesure d'origine)

**FAIBLE — Défaut 12 — la description d'un personnage s'écrivait par un hublot de quatre lignes — FAIT. Un champ qui grandit avec son texte a été ajouté au châssis ; il mesure la hauteur au navigateur plutôt que de l'estimer, part de trois lignes et s'arrête à seize, au-delà de quoi il défile. La description l'emploie.**

- *Le chiffre* : 733 signes dont un sixième visible à l'audit ; la boîte va désormais de 3 à 16 lignes
- *La preuve* : interface/src/composants/chassis.tsx:1081-1140 (le composant et sa mesure par `scrollHeight`) ; interface/src/composants/Personnages.tsx:1498-1508 (`lignesMin={3} lignesMax={16}`)

**FAIBLE — Défaut 13 — la vitrine écrasée par l'image hors format — FAIT, et exactement comme l'audit le proposait : l'intruse redescend à la taille commune, la plus petite reste petite, et la mention est gardée. La réduction se dit sous l'image, pour que « toutes ses poses à la même échelle » ne devienne pas un mensonge.**

- *Le chiffre* : une image sur six occupait 67 % de la surface d'image et repoussait la deuxième rangée à 1,5 écran de défilement
- *La preuve* : interface/src/composants/Vitrine.tsx:341-346 (le facteur de réduction), 322-339 (la mesure et la raison), 287 (la mention « hors taille commune » conservée)

**FAIBLE — Défaut 14 — une bascule qui annonce l'état inverse — DEVENU SANS OBJET : il n'a jamais existé, et le code le confirme. La bascule annonce appuyée quand la colonne est visible, ce qui est juste ; l'audit avait lu l'état d'avant le redessin. Le mécanisme est unique et sert les quatre bascules du produit.**

- *La preuve* : interface/src/composants/BarreChassis.tsx:448 (`aria-pressed={!repliee}`), 443-458 (la boucle unique) ; App.tsx:1841-1859 (les bascules déclarées par chaque écran)

**FAIBLE — L'audit n'a pas encore gagné, en tête, la ligne qui dit où il en est et à quelle date — c'est l'un des critères d'acceptation de N1, et il porte sur un document, pas sur l'interface. Je ne l'ai pas écrit : ce relevé est en lecture seule. L'encadré actuel de l'audit date du 31 août 2026 au soir et ne dit rien du 4 septembre.**

- *La preuve* : docs/audit-design-post-v21.html, section « Où en est ce document — corrigé le 31 août 2026, le soir » ; docs/PLAN.md:2221 (le critère)

### Ce qui marche aujourd’hui, et qu’une refonte perdrait

- Les corrections tiennent, et elles ne coûtent rien à une refonte : ce sont des lignes de style, un état d'ouverture, une règle de retour à la ligne, un doublon retiré, une image servie à la taille où on la regarde. Aucune ne fige une décision de forme, donc aucune ne serait perdue si la direction visuelle changeait.
- Chaque correction est écrite à côté du code, avec sa mesure d'origine et sa raison — Tuile.tsx:228-236, index.css:198-213, Tables.tsx:1260-1279, Vitrine.tsx:323-339. C'est ce qui a rendu ce relevé possible en une lecture ; un dépôt qui corrige en silence aurait demandé de tout remesurer au navigateur.
- L'écran des dépenses répond à une question au lieu d'afficher des données : il range les appels par « payé pour rien » (Depenses.tsx:56) et se ferme désormais par Échap comme le guide.
- Les écrans vides gardent leurs textes — « Ce jeu n'a encore personne. Nomme le premier. » (Personnages.tsx:996), « Le tableau est vide. Colle. » (Tableau.tsx:804) : un constat, puis un verbe qui invite.
- Supprimer un projet dit encore ce qu'il fait avant de le faire, dans la liste elle-même : « N assets seront détachés, pas détruits » (Arbre.tsx:121-122).
- Le guide reste l'étalon de lisibilité du produit — 15 px, colonne de 36 em (Guide.tsx:225) — et il dit désormais vrai sur les écrans qu'il décrit.
- L'atelier continue d'avouer ce qu'il ignore : la vitrine marque « hors taille commune » même après avoir ramené l'intruse à l'échelle (Vitrine.tsx:287, 338-340).

### Ce que ce relevé impose

- La « grosse passe de design » réclamée n'a pas de matière dans cet audit : 13 des 14 points ne demandent plus rien. Ce que l'auteur ressent comme une interface chargée n'est donc pas fait des défauts relevés le 31 août — il faut le mesurer ailleurs, ou l'assumer comme une direction à rouvrir. C'est exactement la question que N2 aura à poser.
- Le seul point encore ouvert, le n° 07, est aussi le seul du lot qui demandait une décision de forme — et c'est pour cette raison qu'il avait été laissé de côté. Il tombe donc naturellement dans la V2.5, pas dans une tranche de correction : soit N2 le prend, soit il faut une ligne à lui.
- La règle du gris pâle de docs/DESIGN.md n'est pas fautive, c'est son application qui l'est : elle autorise `--texte-3` pour ce qui est redondant, et le produit l'a posé deux fois sur de la navigation. Le cas est réglé sur la barre du châssis, il ne l'est pas sur les trois côtés de l'Univers. La règle gagnerait à nommer explicitement la navigation parmi ses interdits.
- Le plan ne peut plus se sonder par échantillon : trois défauts tirés au hasard ont donné une conclusion, et le quatrième — celui que le plan croyait connaître — était faux. Un audit qui n'est cité nulle part dans le plan se périme dans les deux sens : on croit ouvert ce qui est fait, et fait ce qui reste.
- La correction du n° 10 a montré que le navigateur donne la place d'un bouton dans la mise en page, pas la place de ce qu'on en voit. Toute mesure future de recouvrement doit se lire au rendu, pas aux coordonnées — c'est déjà noté dans docs/PIEGES.md, et la refonte devra s'y tenir.
- Cinq surfaces restent hors de tout examen, et l'une d'elles est le premier contact avec le produit. Aucune conclusion sur la charge visuelle ne peut se prétendre complète tant qu'elles n'ont pas été parcourues : l'assistant de démarrage — le parcours qu'on suit la première fois, quand aucun jeu n'existe encore, et le plus gros manque restant ; la planche de pose — l'écran qui commande d'un coup toutes les images d'une même pose ; les états d'erreur et d'attente — ce qui s'affiche quand un appel échoue, quand la clé manque, quand le serveur ne répond pas ; ce que fait une génération pendant qu'elle tourne — la jauge, l'arrivée des images, l'annulation ; le comportement sur un écran plus petit, que les deux défauts de disposition d'alors laissaient soupçonner.

---

<a id="releve-6"></a>

## 6 · La palette du jeu existe et se calcule vraiment ; le châssis est assez centralisé pour être teinté en une ligne, mais aucune palette réelle du dépôt ne peut fournir de texte lisible.

Le document dit vrai : la palette du jeu est bien calculée, elle n'est jamais saisie, et elle arrive déjà entière côté interface au moment du rendu (`univers.palette`, un tableau d'hexadécimaux, tenu dans l'état racine de l'écran). Le châssis est propre au-delà de ce qu'on pouvait espérer : 27 couleurs nommées dans un seul fichier, 2 108 emplois de ces noms répartis sur 34 fichiers, et **une seule** couleur du châssis recopiée à la main ailleurs. Techniquement, teinter l'interface coûte un effet de bord dans l'écran racine et une ligne corrigée — le document a raison sur le coût. Mais le relevé sur les six vrais projets renverse la conclusion : **aucune des palettes calculées ne contient de couleur capable de porter du texte** — sur quarante-huit couleurs d'un jeu réel, une seule atteint le seuil de lisibilité minimal, aucune n'atteint celui du texte courant ; une autre palette réelle plafonne à un quart du contraste nécessaire. Une palette de jeu peut donc donner une *teinte* au châssis, jamais ses *couleurs* : la seule forme faisable est de lui emprunter un angle de couleur et de garder toutes les clartés déjà mesurées.

### Les constats

**BLOQUANT — Aucune palette réelle du dépôt ne peut fournir la couleur du texte. Le texte courant du châssis se détache 14 fois plus que son fond ; sur les quatre jeux qui ont une palette, la couleur la plus claire de la palette ne se détache qu'entre 5,5 et 9 fois — et le compte de couleurs qui atteignent seulement le seuil de lisibilité minimal est de 1 sur 48, 3 sur 48, 4 sur 24 et 3 sur 24.**

- *Le chiffre* : 1 à 4 couleurs sur 24 ou 48 atteignent 4,5 : 1 ; 0 à 2 atteignent 7 : 1 ; le texte du châssis vaut 14,3 : 1
- *La preuve* : Mesure faite par moi sur les quatre donnees/projets/*/projet.json qui portent une palette, contraste calculé contre --fond-2 #171B21 ; seuils de référence dans docs/DESIGN.md:167-170

**BLOQUANT — Une palette réelle du dépôt est presque noire de bout en bout : la palette « grenouille » rend 23 couleurs dont 6 seulement sont franchement différentes, et sa couleur la plus claire ne se détache que 2,6 fois du fond. Rien dedans ne pourrait porter une étiquette, ni même un trait de séparation visible.**

- *Le chiffre* : 23 couleurs rendues, 6 distinctes, contraste maximal 2,60 : 1 (le minimum utilisable est 4,5 : 1)
- *La preuve* : donnees/projets/test-v2/projet.json, tableau « palettes » ; comptage et contrastes calculés par moi

**FORT — Les palettes de jeu sont chaudes, et le châssis a deux zones de couleur interdites par écrit — celles où vivent « échec » (rouge) et « réglé à la main » (or). Un châssis teinté depuis une palette de bois et de terre tomberait exactement dedans, et les deux couleurs qui disent quelque chose cesseraient de se distinguer du décor.**

- *Le chiffre* : 36 couleurs sur 48 (bac-a-sable) et 17 sur 24 (coeur-de-pierre) sont dans l'arc réservé à échec et réglé-à-la-main
- *La preuve* : Interdiction écrite dans docs/design-decisions.md:112 (arcs 345–55° et 120–200° fermés) ; comptage des couleurs de palette tombant dans l'arc chaud fait par moi sur donnees/projets/*/projet.json

**FORT — Deux projets sur six n'ont aucune palette du tout. Ce n'est pas un cas rare : c'est l'état de tout projet neuf tant qu'aucune image n'a été promue en artwork officiel. La teinte doit donc avoir un état « pas de palette », et cet état est le châssis actuel.**

- *Le chiffre* : 2 projets sur 6
- *La preuve* : donnees/projets/test-v2/projet.json et donnees/projets/vignettes/projet.json : palette = liste vide ; valeur de départ à interface/src/api.ts:1885

**FORT — Le châssis est déjà entièrement centralisé, et c'est la bonne nouvelle du relevé. Les 27 couleurs nommées vivent toutes dans un seul fichier ; les composants ne les emploient que par leur nom ; il n'existe aucun emploi d'une couleur toute faite de la bibliothèque de style. Écraser les 27 noms à l'ouverture d'un projet repeindrait donc tout l'écran sans toucher un seul composant.**

- *Le chiffre* : 27 couleurs nommées, 2 108 emplois répartis sur 34 fichiers, 0 couleur de bibliothèque par défaut
- *La preuve* : interface/src/index.css (27 définitions, 0 valeur de couleur écrite hors de la table) ; comptage des emplois par expression régulière sur interface/src/composants et App.tsx

**MOYEN — Une seule couleur du châssis est recopiée à la main ailleurs dans le produit : le fond le plus profond, réécrit tel quel dans le numéro d'un rectangle de découpe. C'est la seule ligne qui ne suivrait pas une teinte, et elle se corrige en un geste.**

- *Le chiffre* : 1 valeur sur 2 108 emplois
- *La preuve* : interface/src/composants/Decoupe.tsx:673 — bg-[rgba(11,13,16,.82)], qui est --fond-0 #0B0D10 recopié

**MOYEN — La bibliothèque du tableau d'inspiration apporte ses propres couleurs, et elles ne suivraient pas. Sa feuille de style embarque 57 couleurs écrites en dur et 37 réglages de couleur nommés, dont aucun n'est repris par le produit : l'écran du tableau garderait sa couleur d'origine pendant que le reste changerait.**

- *Le chiffre* : 57 couleurs en dur, 37 réglages nommés, 0 repris
- *La preuve* : interface/node_modules/@xyflow/react/dist/style.css, comptage par moi ; feuille importée à interface/src/composants/Toile.tsx:61 ; aucune occurrence de --xy- dans interface/src

**MOYEN — Les 39 endroits qui emploient une couleur en transparence sont compilés en double : une valeur figée d'abord, puis la valeur vivante dans un bloc conditionnel. Sur un navigateur récent c'est la valeur vivante qui gagne et la teinte suit ; sur un navigateur ancien ces 39 endroits resteraient cyan pendant que le reste changerait.**

- *Le chiffre* : 39 emplois, dont 16 pour le seul fond de segment actif
- *La preuve* : interface/dist/assets/index-CcBOwEwh.css : .bg-signal\/13 vaut #49b3ce21 puis color-mix(in oklab, var(--color-signal) 13%, transparent) dans un bloc @supports ; 39 emplois comptés dans interface/src

**FAIBLE — La palette n'est pas rangée du plus clair au plus sombre — vérifié faux sur les quatre palettes réelles. Un calcul de teinte qui prendrait « la première couleur » prendrait une couleur au hasard. Le produit y touche déjà à deux endroits, l'un en triant correctement, l'autre en prenant la première.**

- *Le chiffre* : 0 palette sur 4 est triée par clarté
- *La preuve* : Vérification de l'ordre faite par moi sur les 4 palettes ; interface/src/composants/Places.tsx:992-1000 (tri correct) et Places.tsx:1295 (prend palette[0])

**FAIBLE — La palette se recalcule toute seule et republie son changement à l'écran : promouvoir une image, en retirer une, ou changer le nombre de couleurs demandé suffit. L'interface changerait donc de couleur pendant que l'auteur travaille, sans qu'il l'ait demandé.**

- *La preuve* : atelier/services/univers.py:1597-1628 (recalcul sur empreinte) ; interface/src/App.tsx:1021-1035 (l'écran reçoit le message « univers » et se remet à jour)

**FAIBLE — Le nombre de couleurs demandé va de 4 à 64, et le minimum est réellement acceptable par le serveur. Une palette de 4 couleurs ne peut pas nourrir les six gris de fond du châssis, encore moins ses trois niveaux de texte.**

- *Le chiffre* : de 4 à 64 couleurs ; le châssis en emploie 27
- *La preuve* : atelier/image/palette.py:80-81 (COULEURS_MIN = 4, COULEURS_MAX = 64) ; contrôle appliqué à atelier/services/univers.py:1231-1234

**FAIBLE — Le piège « la palette contient déjà du cyan » ne se produit sur aucun jeu du dépôt : la couleur de palette la plus proche de l'accent cyan en est encore très loin sur les quatre jeux. Ce que le document de design avance — le cyan est choisi parce que le pixel art de fantasy n'en produit presque jamais — est donc vrai à la mesure. C'est le piège inverse qui mord.**

- *Le chiffre* : distance minimale 86, 105, 118 et 157 sur 441 possibles ; 0 couleur sous le seuil de confusion
- *La preuve* : Distances calculées par moi entre chaque couleur de palette et --signal #49B3CE ; l'affirmation est à docs/DESIGN.md:224-226

**FAIBLE — La palette est bien un calcul et non une saisie, et le mécanisme est explicite : les images promues en artworks officiels sont d'abord détourées de leur fond, empilées, puis réduites par coupe médiane ; le résultat est mis en cache avec l'empreinte des images qui l'ont produit, pour qu'un changement le périme tout seul.**

- *Le chiffre* : 48, 48, 24 et 24 couleurs sur les quatre jeux pourvus
- *La preuve* : atelier/image/palette.py:199-231 (le calcul) ; atelier/domaine/projet.py:532-541 (le cache et son empreinte) ; interface/src/api.ts:1812-1814

**FAIBLE — Un second genre de palette existe depuis fin août : des palettes nommées, qui sont des recettes — des sources, deux dosages, et des retouches à la main gardées comme gestes plutôt que fondues dans le résultat. C'est le seul endroit où une couleur se règle à la main, et il ne concerne pas la palette du jeu.**

- *Le chiffre* : 3 palettes nommées sur 1 projet ; 0 sur les 5 autres
- *La preuve* : atelier/domaine/ambiance.py:16-25 et 132-200 ; trois exemples réels dans donnees/projets/test-v2/projet.json

**FAIBLE — Le document de design déclare une couleur qui n'existe pas dans le code — un cyan sourd nommé pour les fonds de segment actif. Le produit obtient le même résultat par transparence. Sans importance aujourd'hui, mais c'est un nom de plus à traiter le jour où l'on écrit une table de teinte à partir du document.**

- *La preuve* : docs/DESIGN.md:206 déclare --signal-sourd ; 0 occurrence dans interface/src/index.css

### Ce qui marche aujourd’hui, et qu’une refonte perdrait

- Un seul fichier tient toutes les couleurs du produit, et il les tient vraiment : après la table des 27 couleurs, il n'y a plus une seule valeur de couleur écrite en clair dans le reste du fichier — tout passe par un nom.
- Les composants n'emploient jamais une couleur toute faite de la bibliothèque de style : zéro emploi des couleurs livrées d'origine, sur 33 composants. C'est rare, et c'est ce qui rend la teinte bon marché.
- La palette du jeu arrive déjà côté écran, entière, au moment où l'écran se dessine — servie à l'ouverture pour éviter un second aller-retour, et republiée d'elle-même quand elle change. Aucun nouvel appel réseau ne serait nécessaire.
- L'interface sait déjà dessiner des couleurs de palette et calculer sur elles : les pastilles de l'assistant, celles du panneau des places, et une fonction qui trouve la couleur la plus sombre d'une palette.
- La discipline de contraste est écrite, chiffrée et tenue : chaque couleur du document porte son écart mesuré contre le même fond de référence, et les dix couleurs de rangement sont toutes posées au même écart exactement pour qu'on ne les confonde pas avec un état. Une teinte qui se contenterait de tourner l'angle de couleur conserverait toute cette table telle quelle.
- Le cyan de l'accent a été choisi contre le contenu, et la mesure lui donne raison : sur les quatre jeux réels, aucune couleur de palette n'en approche. C'est la seule couleur du châssis qu'aucun jeu ne vient concurrencer — la teinter serait perdre la seule garantie qu'on ait.

### Ce que ce relevé impose

- Une palette de jeu peut donner un angle de couleur au châssis, jamais ses couleurs. Le relevé l'impose : la couleur la plus claire des jeux réels vaut entre 5,5 et 9 fois le fond quand le texte du châssis en vaut 14,3 ; et une palette réelle plafonne à 2,6. La seule forme faisable est donc : on prend une teinte de la palette, on garde toutes les clartés et tous les écarts déjà mesurés, et l'on recompose les 27 couleurs à cette teinte. C'est un châssis qui tourne, pas un châssis qui se remplit.
- Les quatre couleurs qui disent quelque chose — réussi, réglé à la main, échec, et l'accent — ne doivent pas dériver du tout. Deux zones de la roue leur sont déjà réservées par écrit, et c'est justement là que tombent les palettes de jeu : 36 couleurs sur 48 pour l'un des jeux. Les faire suivre la palette, c'est effacer la seule chose que la couleur dit encore dans ce produit.
- Les dix couleurs de rangement ne doivent pas dériver non plus. Elles sont une liste fermée vérifiée par le serveur, et toute leur discipline tient au fait qu'elles sont posées au même écart de clarté. Les tordre à la palette d'un jeu casserait à la fois la clôture et l'égalité.
- Il faut un état « pas de palette », et il doit être le châssis actuel — un projet neuf n'en a pas, et deux des six projets du dépôt sont dans ce cas. La teinte est donc un supplément, jamais un préalable.
- Il faut un garde-fou sur la matière de la palette avant d'en tirer quoi que ce soit : si la palette est trop grise, ou trop sombre, ou trop courte, la teinte qu'on en tirerait est du bruit. La règle mesurable existe déjà dans le produit — le nombre de couleurs franchement distinctes — et elle donne 6 sur 23 pour la palette la plus pauvre. En dessous d'un seuil, on ne teinte pas, et on le dit, exactement comme la couleur de fond du jeu se propose sans jamais s'imposer.
- Le calcul de la teinte se fait côté écran, pas côté serveur, et ce n'est pas un raccourci. Le dépôt a déjà tranché la question dans l'autre sens pour les couleurs de rangement : le serveur range un nom, l'écran seul sait ce qu'il vaut, parce que mettre une valeur du châssis dans le fichier d'un projet ferait deux vérités sur la même couleur. Une table de clartés recopiée en Python referait exactement cette faute.
- Le coût réel est de trois choses, et aucune n'est un chantier : un effet de bord dans l'écran racine qui écrit les 27 couleurs, une ligne à corriger dans l'écran de découpe où le fond le plus profond est recopié à la main, et une décision sur le tableau d'inspiration, dont la bibliothèque apporte 57 couleurs qui ne suivraient pas — soit on la raccorde par ses 37 réglages nommés, soit on assume qu'un écran ne suive pas.
- Une question de conduite reste ouverte, et elle n'est pas technique : la palette se recalcule toute seule quand on promeut ou retire une image. L'interface changerait donc de couleur au milieu d'un geste. Ou bien la teinte se fige à l'ouverture du projet, ou bien elle se pose à la main — mais « automatique » au sens strict veut dire que l'écran bouge pendant qu'on travaille.

---

# Les six sondages sur l’état de l’art

<a id="sondage-1"></a>

## 7 · Denses et calmes : ce que font Linear, Raycast, Figma, Blender et Lightroom en 2025-2026 — et les six écarts mesurés dans l'atelier

La réponse courte : les bons outils sont calmes parce qu'ils écartent franchement peu de choses, pas parce qu'ils atténuent beaucoup de choses. Ils s'autorisent trois ou quatre niveaux de surface bien séparés (Linear va de #010102 à #191a1b, soit 16 points de clarté perçue), un seul bouton plein par écran, un plancher de texte à 12-13 px, et un vrai palier de repos vertical. L'atelier fait l'inverse sur les cinq points : quatre surfaces séparées de 10,3 points seulement (donc quasi indiscernables), 427 traits dessinés à un contraste de 1,2:1 (donc du bruit sans hiérarchie), 20 tailles de texte dont 71 % à 10 px ou moins, 516 emplois d'un gris à 3,0:1 (sous le seuil de lisibilité), et aucune zone d'action fixe (zéro `sticky` dans tout le code). Le calme apparent vient d'un aplatissement, pas d'un tri. Et le point le plus grave n'est pas dans le châssis : le fond presque noir sur lequel on juge chaque sprite (#0B0D10, clarté 3,6 ; damier moyen 9,5) est cinq fois plus sombre que le gris de référence que la norme photo ISO 3664 prescrit pour un jugement critique, et la littérature sur l'effet d'entourage (Bartleson-Breneman) dit que ce fond-là fait paraître l'image plus claire et moins contrastée qu'elle n'est. Blender a écrit exactement ce raisonnement pour justifier son gris moyen ; Lightroom livre six fonds au choix. Le commentaire de `interface/src/index.css` (lignes 15-18) affirme le contraire — « un fond clair remonte la luminance d'entourage et fausse le contraste perçu d'un sprite » — et c'est la seule affirmation de design du produit que la littérature contredise frontalement.

### Ce que tout le monde fait, et que l’utilisateur attend

- Trois à quatre niveaux de surface, jamais plus, et l'élévation se dit par un pas de clarté PLUS un filet de 1 px — jamais par une ombre. Linear : #010102 → #0f1011 → #141516 → #191a1b, filets #23252a puis #34343a. Raycast : #07080a → #0d0d0d → #101111 → #121212, filets rgba(255,255,255,0.08) puis 0.16.
- Un seul bouton plein par écran. Linear : primaire = fond #5e6ad2, texte blanc, 8/14 px de marge intérieure ; secondaire = fond de surface #0f1011 + filet 1 px ; tertiaire = texte nu. Raycast : 36 px de haut pour les trois variantes, seule la matière change.
- Une échelle d'espacement en multiples de 4 px, avec un dernier cran très supérieur aux autres (Linear et Raycast s'arrêtent tous deux à 96 px entre sections) : c'est ce dernier cran qui fait le repos.
- Un plancher typographique. La plus petite taille documentée est 12 px chez les deux (Linear « Caption 12/1,4 » ; Raycast « caption-sm 12/1,5 »), et l'interface de l'application Linear tourne à 13 px.
- Un survol sur toute rangée cliquable, et une bague de focus visible — l'atelier les a déjà : 74 transitions à 80 ms, bague de 2 px en `--color-signal` (index.css, `*:focus-visible`).
- Un « où suis-je » permanent : fil d'Ariane ou onglet actif. L'atelier l'a (BarreChassis.tsx, `Fil`, cinq segments maximum, logé dans la barre de 44 px).
- Une palette de commandes au clavier. C'est ce qui a fait Cron/Notion Calendar et Superhuman : la souris devient facultative, donc l'écran n'a plus à porter chaque geste sous forme de bouton — c'est le premier levier de calme.

### Ce qui émerge en 2025-2026

- Le bouton primaire devient achromatique. Raycast met une pastille BLANCHE (#ffffff, texte noir) comme appel principal, précisément pour que l'accent coloré ne rivalise jamais avec le contenu. C'est directement transposable à un outil où l'on juge des images.
- L'élévation se joue en opacité de blanc superposée (0,02 → 0,04 → 0,05) plutôt qu'en couleurs figées, et l'enfoncement par une ombre INTERNE (rgba(0,0,0,0.2) 0 0 12px inset) — un vocabulaire d'ombre qui ne déborde jamais du bloc, donc compatible avec un « pas d'ombre » de principe.
- Interlettrage négatif progressif sur les grandes tailles seulement (Linear : -3 px à 80 px, -0,7 px à 32 px, 0 en dessous de 16 px). L'atelier a zéro `tracking-` et zéro `uppercase` dans 35 751 lignes — la retenue est bonne, mais ses trois titres à 32 px paieraient un -1 px.
- La densité devient un RÉGLAGE (compact / confortable) plutôt qu'un choix figé. Pour un outil à un seul utilisateur, c'est même le bon endroit : deux jeux de hauteurs de rangée, un raccourci pour basculer.
- Le retour en grâce du gris moyen dans les outils d'image. Blender a explicitement défendu son gris moyen contre le noir ; Lightroom livre six fonds (blanc, gris clair, gris moyen par défaut, gris foncé, très foncé, noir) accessibles par clic droit sur le fond.
- Budget de mouvement resserré à 80-200 ms, et progression DÉTERMINÉE plutôt que balayage indéterminé. L'atelier est déjà exactement là (74 × 80 ms, une seule jauge à 240 ms, index.css l'écrit noir sur blanc) — c'est le point où il est en avance.

### Là où la convention est fausse pour ce produit

- « Prends un jeu d'icônes » : faux ici. L'atelier compte 5 balises `<svg>` dans 35 751 lignes de composants (Calque.tsx:468, Tables.tsx:209/1948/2171, Toile.tsx:1851 — cette dernière en 0×0 px, c'est un porte-définitions, donc quatre marques dessinées en tout). Pour un outil à un seul utilisateur, en français, où chaque contrôle porte son mot, ajouter Lucide ou Phosphor serait une régression : 200 pictogrammes à apprendre pour remplacer des mots déjà compris. Ce qui manque n'est pas un jeu d'icônes, c'est six marques pour les verbes de rangée qui se répètent.
- « Le fond sombre protège l'œil » : vrai pour du texte, faux pour un jugement d'image. Le fond sombre COMPRIME la perception du contraste (effet Bartleson-Breneman) : on corrige alors le sprite à la hausse, et il ressort trop contrasté dans le jeu. Blender le dit dans ses propres termes : une interface sombre pousse à exagérer le contraste de ce qu'on produit.
- « Pas de mode clair, c'est une décision » : la décision est bonne pour le CHÂSSIS et fausse pour le CADRE de l'image. Il ne faut pas un thème clair ; il faut un fond commutable derrière l'asset seul. Ce sont deux choses différentes et l'atelier les a confondues (index.css lignes 13-18).
- « Barre d'action flottante en bas » : c'est ce que Figma a fait en UI3 et c'est sa critique la plus reprise sur son propre forum — la barre flotte AU-DESSUS de la zone de travail et gêne quand le fond du document a la même couleur. Pour un outil de jugement d'image, la barre d'action doit être ancrée hors du cadre de l'image, jamais posée dessus.
- « Coins arrondis de 6-8 px » : faux sur tout ce qui encadre un sprite. L'atelier a raison à 2 px — mais il a un défaut concret à corriger, voir les recommandations : `overflow-hidden rounded-[1px]` rogne réellement des pixels d'angle.
- « Un seul accent » : la règle est bonne, son APPLICATION est fausse ici. Le cyan sert à la fois d'appel à l'action et d'état sélectionné, y compris en halo autour d'une vignette d'image — et un halo coloré déplace la teinte perçue du sprite qu'il entoure.

### Les recommandations

**Donner à l'auteur un fond neutre commutable DERRIÈRE l'asset seul — six crans, damier compris — et en faire le premier réglage du produit. C'est la recommandation numéro un, très loin devant les autres.**

- *Pourquoi* : L'atelier juge chaque image sur un entourage mesuré à une clarté L* de 3,6 pour #0B0D10, et le damier lui-même à L* 9,5 en moyenne (#191e24 à 11,0 et #14181d à 8,0). La norme ISO 3664, qui régit les conditions de jugement en photographie et arts graphiques, demande un entourage neutre de 10 à 60 % de réflectance et recommande 20 % (soit L* ≈ 50) pour un jugement critique, avec une chroma CIELAB inférieure ou égale à 2. L'atelier est cinq fois plus sombre que cette référence. Conséquence mesurable : un blanc pur dans un sprite affiche 16,8:1 contre le damier, contre 4,5:1 sur un gris à 20 % — l'écart perçu est donc massivement gonflé, et l'effet Bartleson-Breneman ajoute que sous entourage sombre l'image paraît plus claire et MOINS contrastée qu'elle n'est, ce qui pousse à surcorriger. Blender a justifié son gris moyen par ce raisonnement exact ; Lightroom livre six fonds au choix, gris moyen par défaut, changeables par clic droit. Vérifié dans le code : aucun sélecteur de fond n'existe, les classes `damier` sont posées en dur à 20 endroits (App.tsx:2938, Apercu.tsx:500/524, Assistant.tsx:2044, Calibrage.tsx:577/815, Calque.tsx:441, Codex.tsx:700, Decoupe.tsx:571, Depenses.tsx:822, Envoi.tsx:762/1108, Fiche.tsx:1070, FicheChose.tsx:356, entre autres) et le seul mot d'« arrière-plan » du produit (Toile.tsx:937) parle d'autre chose.
- *Les valeurs* : Six crans, tous des gris purs (chroma nulle, donc conformes au « chroma ≤ 2 » de l'ISO 3664) : damier (transparence, l'actuel) · #FFFFFF (L* 100) · #B3B3B3 (L* 72,9) · #767676 (L* 49,6, réflectance 18,1 % — le cran de référence, à mettre par défaut pour juger) · #3D3D3D (L* 25,8) · #000000. Un raccourci clavier pour tourner entre eux, la valeur retenue par asset et non globale. Zones concernées : Apercu.tsx (le plein écran), Fiche.tsx:1070 (le cadre de fiche), Calibrage.tsx:815, Decoupe.tsx:571 — pas les vignettes de 26 à 44 px, où le damier suffit.
- *Ce que ça coûte* : Moyen. Un token de plus, un état à ranger, une commutation dans quatre composants. Aucun autre changement du châssis n'est requis.

**Remonter le plancher typographique de 8 px à 11 px, et ramener les 20 tailles à six crans.**

- *Pourquoi* : Compté dans le code : 736 tailles écrites en pixels, réparties sur 20 valeurs distinctes (8 · 8,5 · 9 · 9,5 · 10 · 10,5 · 11 · 11,5 · 12 · 12,5 · 13 · 13,5 · 14 · 15 · 17 · 20 · 22 · 24 · 28 · 32). 385 d'entre elles sont à 10 px, 130 à 9,5 px : 526 sur 736, soit 71 % du texte typé, est à 10 px ou moins. Or `body` est déclaré à 13 px dans index.css — donc la déclaration de base ne décrit pas le produit réel. Repères : la plus petite taille documentée chez Linear est 12 px (Caption 12/1,4) et chez Raycast 12 px (caption-sm 12/1,5) ; la barre latérale de l'application Linear tourne à 13 px. L'atelier prend pour texte courant ce que ces outils prennent pour plancher, puis descend trois crans en dessous. Ce n'est pas de la densité, c'est une taxe de plissement des yeux — et c'est très exactement ce qui « assomme ».
- *Les valeurs* : Six crans : 11 (mesures et étiquettes) · 12 (secondaire) · 13 (courant, comme aujourd'hui `body`) · 15 (titre de bloc) · 20 (titre d'écran) · 32 (le chiffre unique qu'on lit de loin). Supprimer 8 / 8,5 / 9 / 9,5 / 10 / 10,5 / 11,5 / 12,5 / 13,5 / 14 / 17 / 22 / 24 / 28. Interlettrage à 0 partout sauf 32 px, à -1 px. La densité se récupère sur la hauteur de rangée (26 px, déjà en place à 135 endroits) et sur l'écart, jamais sur le corps du texte.
- *Ce que ça coûte* : Élevé en volume — 736 occurrences à remapper — mais mécanique, et faisable par correspondance table à table. C'est le changement au meilleur rapport effet/risque du lot.

**Sortir `--color-texte-3` du gris illisible : le remonter à #788390.**

- *Pourquoi* : #5e6771 est employé 516 fois — c'est le token de couleur le plus utilisé du produit après `--bord`. Contraste mesuré : 3,39:1 sur fond-0, 3,21 sur fond-1, 3,01 sur fond-2, 2,72 sur fond-3. Le seuil de lisibilité communément retenu pour du texte courant est 4,5:1 ; sur fond-3, il passe même sous 3:1, seuil réservé au très gros texte. Et 318 emplacements du code font cohabiter `text-texte-3` avec une taille inférieure ou égale à 10 px sur la même ligne de classes — c'est-à-dire un gris sous le seuil, écrit en corps minuscule, sur 43 % de tout le texte typé du produit. Aucune quantité de calme dans le châssis ne compense cela : l'œil travaille en permanence.
- *Les valeurs* : #5E6771 (L* 43,2) → #788390 (L* 54,3). Contrastes obtenus : 5,05:1 sur fond-0, 4,48 sur fond-2, 4,06 sur fond-3. La teinte ne bouge pas d'un degré — seule la clarté monte, en lumière linéaire ×1,686. Si l'on veut garder un cran vraiment effacé pour le désactivé seulement, conserver l'ancien #5E6771 sous un nouveau nom (`--color-texte-eteint`) et le limiter aux contrôles `disabled`, où il porte déjà sa raison écrite à côté.
- *Ce que ça coûte* : Faible. Un token, une valeur. Le tri entre « secondaire » et « éteint » demande une passe de relecture.

**Séparer physiquement le bouton primaire de l'état sélectionné : rendre le primaire achromatique, réserver le cyan à la sélection.**

- *Pourquoi* : Aujourd'hui le cyan #49B3CE fait trois métiers. Un : bouton plein primaire, défini à deux endroits seulement (chassis.tsx:536 `bg-signal text-fond-0 hover:bg-signal-clair font-medium` et Assistant.tsx:543). Deux : état sélectionné, motif `border-signal bg-signal/13 text-signal`, compté à 16 endroits (Assistant ×5, BarreOutils, Calque, chassis:609, EcranReglages, Fiche, PanneauReglages ×2, Tableau ×2, Toile, App.tsx:2816). Trois : pastille de mesure (BarreChassis.tsx:419). L'œil ne peut donc pas apprendre « cyan plein = l'action à faire ». Pire pour un outil d'image : ce halo cyan à 13 % entoure des vignettes d'assets — un entourage coloré déplace la teinte perçue de ce qu'il entoure, dans le sens opposé sur la roue. Un sprite sélectionné n'a donc pas la même couleur apparente qu'un sprite non sélectionné. Raycast a résolu exactement ce problème en rendant son appel principal BLANC : la couleur d'accent ne rivalise jamais avec le contenu. Deuxième défaut mesuré au passage : la convention primaire n'est appliquée qu'à 7 endroits (Calibrage.tsx:260, ChampPrompt.tsx:278, Decoupe.tsx:446, Depliage.tsx:123, Envoi.tsx:644, Planche.tsx:374, Secrets.tsx:161) sur 279 boutons du produit — 259 balises `<button>` écrites à la main plus 20 emplois du composant `<Bouton>`. Le composant partagé couvre 7 % des boutons ; le reste échappe à toute règle de hiérarchie.
- *Les valeurs* : Primaire : fond `--color-lumiere` #EAF4F8 (L* 95), texte `--color-fond-0`, 34 px de haut, poids 500 — la seule surface claire de l'écran, donc impossible à rater et sans teinte qui contamine une image voisine. Secondaire : filet `--bord-fort` + `--fond-2`, tel quel aujourd'hui. Tertiaire : texte nu en `--texte-2`. Sélection : garder `border-signal bg-signal/13` PARTOUT SAUF autour d'une image — là, un filet blanc de 1 px plus un décalage de 2 px hors du cadre, jamais un aplat teinté au contact du sprite. Et faire passer les 259 boutons bruts par `<Bouton>` : un écran, un primaire.
- *Ce que ça coûte* : Le changement de couleur du primaire est trivial (deux lignes). La migration des 259 boutons bruts est un chantier à part, à mener écran par écran.

**Installer une zone d'action fixe en bas de chaque écran de travail, hors du cadre de l'image.**

- *Pourquoi* : Compté : zéro `sticky` dans tout le code de l'interface. Les 10 emplois de `fixed` sont tous des recouvrements ou des bulles (Apercu.tsx:407/449 le plein écran, EcranReglages.tsx:74, Guide.tsx:156, Infobulle.tsx:266) — aucun n'est une barre d'action. Résultat : le bouton « Générer », qui est LE geste payant du produit, flotte dans le flux du bloc de prompt (ChampPrompt.tsx:278, dans un `ml-auto flex flex-col items-end`), et il se déplace verticalement selon la longueur du prompt saisi. Toutes les références du domaine posent la même règle : action primaire en bas à droite, place fixe, parce que la prévisibilité de l'emplacement est ce qui fait agir vite. La nuance importante vient de Figma : UI3 a déplacé sa barre d'outils en bas EN FLOTTANT au-dessus du document, et c'est devenu la critique la plus reprise de son propre forum — la barre gêne quand le fond du document a la même couleur qu'elle. Donc : ancrée, pas flottante, et jamais posée sur l'image.
- *Les valeurs* : Bande de 44 px, ancrée en bas de la colonne de travail (pas de l'écran entier, pour ne pas passer sur le cadre de l'image), fond `--fond-1`, filet haut `--bord-fort` de 1 px. À droite : le primaire (34 px de haut). À sa gauche, avec 12 px d'écart : les secondaires, trois au maximum, le reste dans un dépassement. À gauche de la bande : la ligne d'état — c'est déjà le rôle que remplit « la fente » de ChampPrompt.tsx, qui n'a jamais deux locataires à la fois ; il suffit de lui donner un domicile fixe.
- *Ce que ça coûte* : Moyen. Un composant de bande, puis un déplacement par écran de travail. Le comportement « ce qui est en route prend la place du bouton », déjà écrit et bien pensé dans ChampPrompt.tsx, se transpose tel quel.

**Écarter les quatre surfaces et supprimer la moitié des traits : la hiérarchie doit se lire à la clarté, pas au filet.**

- *Pourquoi* : Mesuré : les quatre fonds ne couvrent que 10,3 points de clarté perçue au total (fond-0 L* 3,6 → fond-3 L* 13,9), avec des marches de 2,65 · 3,38 · 4,29 points, soit des rapports de 1,054 · 1,068 · 1,105. Linear couvre 16,0 points sur le même nombre de niveaux (#010102 L* 0,3 → #28282c L* 16,3, rapport 1,42) avec des marches de 4,3 · 4,6 · 7,1. L'atelier a donc 35 % moins d'écart pour distinguer autant de niveaux — c'est-à-dire des surfaces qui, en pratique, ne se distinguent pas. Pour compenser, le code dessine des lignes : 217 cadres complets plus 210 traits de bord (97 `border-t`, 60 `border-b`, 36 `border-l`, 17 `border-r`), soit 427 lignes — à un contraste de 1,21:1 sur fond-2 et 1,29:1 sur fond-1 pour `--bord`. C'est le pire des deux mondes : assez de traits pour saturer l'image, pas assez de contraste pour qu'un seul serve de repère. Linear et Raycast font l'inverse : peu de filets, mais un vrai pas de clarté sous chacun.
- *Les valeurs* : Surfaces : #0B0D10 (L* 3,6, inchangé) · #151A20 (L* 9,0) · #20272F (L* 15,3) · #2C343E (L* 21,4). Étendue portée à 17,8 points, rapport 1,545 de bout en bout, marches régulières de 5,4 · 6,3 · 6,1. Filet : #252B33 → #2E3640 (1,41:1 sur fond-2), et réservé au cadre EXTÉRIEUR d'un panneau. À l'intérieur, grouper par 12 px d'écart et un pas de surface, sans aucun trait — cible : passer sous 200 lignes dessinées au total. Le damier reste inchangé, il ne fait pas partie du châssis.
- *Ce que ça coûte* : Moyen à élevé. Les valeurs de tokens sont triviales ; l'élagage des 427 traits est une passe écran par écran, à faire au navigateur.

**Créer un vrai palier de repos vertical : un cran d'écart largement supérieur aux autres, entre sections.**

- *Pourquoi* : Compté : sur 495 écarts déclarés, 193 sont à 8 px, 110 à 4 px, 78 à 6 px, 62 à 12 px, 23 à 16 px, 7 à 20 px et UN SEUL à 40 px. Autrement dit, 92 % des écarts du produit tiennent entre 4 et 12 px, et le plus grand cran n'existe qu'une fois dans 35 751 lignes. Il n'y a donc littéralement aucun endroit où l'œil se pose. C'est là, et pas dans la taille du texte, que se joue la différence entre « dense » et « assommant » : Linear et Raycast gardent tous deux un cran `section` à 96 px, plusieurs fois supérieur au reste de leur échelle. Aucune quantité de sobriété chromatique ne remplace un blanc franc.
- *Les valeurs* : Échelle à cinq crans, en multiples de 4 : 4 (à l'intérieur d'un contrôle) · 8 (entre contrôles d'une même rangée) · 12 (entre rangées) · 24 (entre groupes) · 40 (entre sections d'un panneau — le repos). Supprimer 6 px et 20 px, qui ne font que brouiller les quatre autres. Règle simple : deux blocs séparés par 40 px n'ont besoin d'AUCUN trait entre eux, ce qui finance directement l'élagage des 427 lignes.
- *Ce que ça coûte* : Faible à moyen. Sept valeurs à remapper, mais l'ajout du cran de 40 px se pose là où il manque, sans rien casser.

**Un jeu fermé de six marques dessinées, à 14 px et 1,5 px d'épaisseur, pour les verbes de rangée qui se répètent — et rien de plus.**

- *Pourquoi* : L'atelier n'a que quatre marques réellement dessinées dans 35 751 lignes, et fait tout le reste avec des caractères de texte : « … » 74 fois, « → » 21, « ↓ » 15, « ↑ » 5, « ✕ » 3, « ✓ » 2. Pour un outil personnel en français où chaque contrôle porte son mot, c'est un bon choix, et ajouter Lucide ou Phosphor (200 pictogrammes à apprendre) serait une régression. Mais il y a un coût réel : dans une liste de trente rangées où les mêmes quatre verbes reviennent, un mot répété trente fois est plus de bruit qu'une marque. Le point de vigilance concret, mesuré : « × » apparaît 178 fois, et la vérification des contextes montre qu'il s'agit presque toujours du signe de multiplication d'une mesure — « 1024×1024 », « 4× », « ×2 », « 96 × 96 ». La fermeture, elle, s'écrit « ✕ » (3 fois). C'est aujourd'hui correct mais fragile : le jour où l'on posera un « × » comme bouton de fermeture, il entrera en collision avec un glyphe que l'auteur lit comme un nombre.
- *Les valeurs* : Six marques, pas sept : supprimer · épingler · exporter · relancer · verrouiller · déplier. Grille de dessin 24×24, rendues à 14 px, trait de 1,5 px, bouts carrés (pas d'arrondi, cohérent avec les rayons de 2 px du produit) — c'est la convention de Lucide et Tabler, qui dessinent sur 24 avec un trait de 2, à ramener à 1,5 pour une descente à 14 px. Toujours accompagnées de leur mot en infobulle, jamais seules dans un panneau : icône seule uniquement dans une rangée répétée. Interdire « × » comme marque de fermeture tant que le signe de multiplication est un glyphe de mesure — garder « ✕ ».
- *Ce que ça coûte* : Faible. Six chemins SVG et un composant. Le refus d'aller au-delà de six est la partie difficile.

**Trois corrections ponctuelles, chacune vérifiable en une minute, qui trahissent l'image elle-même.**

- *Pourquoi* : Un : le plein écran d'aperçu affiche l'image sous un voile — Apercu.tsx:407 et 449 posent `bg-fond-0/92`, donc 8 % du reste de l'interface transparaît sur la surface même où l'on juge. C'est de la lumière parasite par construction, et c'est nommément ce que l'ISO 3664 demande d'éliminer d'un poste de jugement. Deux : plusieurs cadres de vignette combinent `overflow-hidden` et un rayon — Envoi.tsx:1108 (`damier h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[1px]`), Calibrage.tsx:577 (26×26, `rounded-[1px]`), FicheChose.tsx:356 (96×96), Assistant.tsx:2044 (`rounded-[2px]`) — donc le pixel d'angle du sprite est réellement rogné. Sur une vignette de 34 px montrant une case de 32 px, un pixel d'angle rogné est un pixel du dessin qui a disparu, pas un détail cosmétique. Trois : le token `bg-signal-sourd` est employé à Tables.tsx:954 et 966 alors que `--color-signal-sourd` n'est défini NULLE PART dans le dépôt (vérifié sur tous les .css, .ts et .tsx hors node_modules). En Tailwind v4 cette classe ne produit rien : ces deux états sélectionnés n'ont aucun fond, seulement leur filet et leur texte. C'est l'illustration exacte de la consigne « les documents décrivent une intention que le code ne tient pas ».
- *Les valeurs* : Un : `bg-fond-0/92` → `bg-fond-0` (opacité pleine) sur Apercu.tsx:407 et 449 ; si le fondu d'entrée compte, l'animer en opacité sur 80 ms puis atterrir à 100 %. Deux : retirer tout rayon des conteneurs qui portent une image — le rayon reste légitime sur les boutons et les pastilles, jamais sur un cadre d'asset ; poser le filet à l'EXTÉRIEUR (`outline` de 1 px avec `outline-offset: 0`) plutôt qu'un `border` qui mange sur la surface utile. Trois : soit définir `--color-signal-sourd` dans index.css (une valeur cohérente serait #1B2A31, l'équivalent opaque de `signal/13` sur `fond-2`), soit remplacer les deux occurrences par `bg-signal/13`.
- *Ce que ça coûte* : Très faible. Cinq lignes en tout, et la troisième est une correction de bug, pas un choix de design.

### Les sources

- https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md — jetons Linear : surfaces #010102 / #0f1011 / #141516 / #18191a / #191a1b, filets #23252a et #34343a, textes #f7f8f8 / #d0d6e0 / #8a8f98 / #62666d, échelle 4-8-12-16-24-32-48-96, boutons primaire #5e6ad2 texte blanc 8/14 px, secondaire #0f1011 + filet, tertiaire texte nu, caption 12/1,4
- https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md — jetons Raycast : surfaces #07080a / #0d0d0d / #101111 / #121212, filets rgba(255,255,255,0.08) et 0.16, primaire BLANC #ffffff sur texte noir, trois variantes toutes à 36 px de haut, caption-sm 12/1,5, échelle 2-4-8-12-16-24-32-96
- https://muz.li/blog/dark-mode-design-systems-a-complete-guide-to-patterns-tokens-and-hierarchy/ — élévation en mode sombre par pas de luminance (opacité de blanc 0,02 → 0,04 → 0,05) et filets translucides plutôt que par ombre portée ; ombre interne rgba(0,0,0,0.2) 0 0 12px pour l'enfoncement
- https://www.figma.com/blog/behind-our-redesign-ui3/ — UI3 : fonds sur les champs, filets autour des menus, coins arrondis, et environ 200 pictogrammes dessinés à la main par Tim Van Damme
- https://forum.figma.com/share-your-feedback-26/ui3-feedback-3058 — la critique la plus reprise d'UI3 : la barre d'outils flottante en bas gêne l'espace de travail, surtout quand sa couleur est proche de celle du document
- https://cdn.standards.iteh.ai/samples/43234/d3de25012f6b433e886679d3a450499f/ISO-3664-2009.pdf — ISO 3664 : entourage neutre et mat, réflectance lumineuse entre 10 et 60 %, gris moyen à 20 % recommandé pour un jugement critique, chroma CIELAB inférieure ou égale à 2, et la lumière des parois comme source de voile à éliminer
- https://www.gtilite.com/pdf/ISO3664%20Standard.pdf — texte de la norme sur les conditions de visualisation en technologie graphique et photographie
- https://www.cis.rit.edu/people/faculty/johnson/pub/AIC05_quality.pdf — effet Bartleson-Breneman : sous entourage sombre l'image paraît plus claire et son contraste perçu diminue, si bien qu'une image destinée à un entourage sombre doit porter un contraste de luminance PLUS élevé
- https://www.spiedigitallibrary.org/journals/journal-of-electronic-imaging/volume-19/issue-4/043013/Measurement-of-the-optimum-surround-ratio-inducing-the-highest-perceived/10.1117/1.3506735.short — mesure du rapport d'entourage optimal pour le contraste perçu maximal
- https://blenderartists.org/t/theme-a-neutral-grey-blender-theme-and-a-problem-with-the-passepartout/1385199 — l'argument de Blender pour le gris moyen : une interface sombre pousse à exagérer le contraste de ce qu'on produit ; le gris moyen minimise l'écart entre le contenu de la vue et l'interface qui l'entoure
- https://extensions.blender.org/themes/neutral-grey/ et https://docs.blender.org/manual/en/latest/editors/preferences/themes.html — gris désaturés et bleus ardoise pour que l'interface recule et laisse les couleurs du modèle au premier plan
- https://lightroomkillertips.com/changing-the-background-color-behind-your-images/ — Lightroom Classic livre six fonds (blanc, gris clair, gris moyen par défaut, gris foncé, très foncé, noir), changeables par clic droit sur le fond ou dans les préférences
- https://lucide.dev/contribute/icon-design-guide — grille de dessin 24×24, trait de 2 px par défaut, bouts et jonctions cohérents ; base des tailles courantes 16 / 20 / 24 / 32 px
- https://primer.style/product/components/dialog/guidelines/ — action primaire alignée à droite dans le pied de la boîte de dialogue, secondaires à sa gauche
- https://v10.carbondesignsystem.com/components/button/usage/ — un seul bouton primaire par vue ; au-delà de trois appels à l'action, passer en tertiaire ou en bouton fantôme ; l'action primaire ne va jamais dans un menu de dépassement
- https://blakecrosley.com/guides/design/notion-calendar et https://pickuma.com/for-dev/cron-vs-notion-calendar-makers-schedule/ — Cron devenu Notion Calendar : navigation entièrement au clavier et palette de commandes centrale, le modèle qui permet à l'écran de ne pas porter chaque geste sous forme de bouton
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/index.css lignes 13-18 — le commentaire « Pas de mode clair — c'en est une décision : un fond clair remonte la luminance d'entourage et fausse le contraste perçu d'un sprite », que la littérature d'apparence colorée contredit
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/index.css lignes 20-33 et 88-118 — les quatre fonds #0b0d10 / #111419 / #171b21 / #1e242b, les filets #252b33 et #39424c, les textes #e6eaee / #98a2ac / #5e6771, l'accent #49b3ce, et le damier #191e24 / #14181d à 12, 16 et 24 px
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/chassis.tsx lignes 517-548 — le composant `Bouton` et sa seule distinction primaire/secondaire : `bg-signal text-fond-0 hover:bg-signal-clair font-medium` contre `border border-bord-fort bg-fond-2 text-texte hover:bg-fond-3`, hauteur 34 px, rayon 2 px, transition 80 ms
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/ChampPrompt.tsx lignes 271-300 — le bouton « Générer » dans le flux du bloc de prompt, sans zone d'action fixe
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Apercu.tsx lignes 407, 449, 500 et 524 — le plein écran de jugement en `bg-fond-0/92` et le damier de 24 px comme unique entourage
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Tables.tsx lignes 954 et 966 — `bg-signal-sourd`, jeton employé et jamais défini dans le dépôt
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Envoi.tsx ligne 1108, Calibrage.tsx ligne 577, FicheChose.tsx ligne 356 — `overflow-hidden` combiné à un rayon sur un cadre qui porte une image, donc pixel d'angle rogné
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/BarreChassis.tsx lignes 1-60 — la barre de tête de 44 px, les trois onglets et le fil d'Ariane à cinq segments logé dedans
- Comptages effectués sur C:/STOCKAGE/PROJET/_DEV/gag2/interface/src (35 751 lignes de composants hors tests) : 736 tailles de texte en pixels sur 20 valeurs distinctes dont 385 à 10 px et 130 à 9,5 px ; 516 emplois de `texte-3` et 318 lignes le mêlant à une taille ≤ 10 px ; 259 balises `<button>` contre 20 emplois de `<Bouton>` et 7 passages de `principal` ; 16 emplois du motif de sélection `border-signal bg-signal/13` ; 217 cadres complets et 210 traits de bord ; 495 écarts dont un seul de 40 px ; 5 balises `<svg>` ; 212 rayons de 2 px ; zéro ombre, zéro `sticky`, zéro `uppercase`, zéro `tracking-`

---

<a id="sondage-2"></a>

## 8 · Fonds chauds et intermédiaires : ce que font les autres, et jusqu'où l'atelier peut monter sans mentir sur une image

J'ai d'abord mesuré le fond actuel plutôt que de lire ce qu'en disent les documents. `#0B0D10` renvoie 0,40 % de la lumière de l'écran (clarté L* 3,6) : c'est le fond le plus sombre de tout le panorama que j'ai comparé — 2,4 fois plus sombre que Rosé Pine, 5,3 fois plus sombre que Gruvbox, 8,5 fois plus sombre qu'Everforest. Et il n'est pas seulement sombre : sa teinte bleue est poussée à 18-19 % de saturation, là où Gruvbox — la référence « chaude » — tient ses fonds entre 0 et 7 %. Autrement dit, l'atelier est le fond le plus TEINTÉ de tous ceux que j'ai mesurés, et il est teinté en bleu. La gêne de l'auteur a donc deux causes séparables : la profondeur, et le bleu. La seconde se corrige sans rien coûter.

Sur la question centrale, la réponse des normes va exactement à l'inverse de ce qu'affirme `docs/DESIGN.md` ligne 147 (« un fond clair remonte la luminance d'entourage, ce qui fausse le contraste perçu d'un sprite »). Les normes de salle de visionnage ne demandent pas un entourage sombre : la norme ISO 3664 recommande un entourage neutre à 20 % de réflectance (clarté L* ≈ 50), et la norme vidéo (SMPTE RP 166, UIT-R BT.2035) fixe l'entourage vers 10 % du blanc de l'écran. Et l'effet Bartleson-Breneman, mesuré en 1967, dit que c'est l'entourage SOMBRE qui abaisse le contraste perçu d'une image — pas l'entourage clair. À 0,40 %, l'atelier fait donc précisément ce qu'il croit éviter : il pousse l'auteur à surcontraster ses sprites pour qu'ils « aient l'air bien » sur la table, après quoi ils seront trop durs dans le jeu.

En revanche, l'autre moitié de la phrase du document est juste et il faut la garder : un châssis chaud entre en concurrence avec les verts, les bruns et les ors d'un pixel art de fantasy. La sortie est donc de séparer deux zones qui sont aujourd'hui confondues — le châssis (panneaux, listes, barres) peut devenir chaud et remonter ; la surface où l'on juge l'image doit rester neutre, et elle, elle a une raison de remonter beaucoup plus haut. C'est exactement ce que fait DaVinci Resolve, qui propose d'un côté une interface neutre désaturée et de l'autre un réglage séparé « fond gris dans les visionneuses ».

Bonne nouvelle : la couture existe déjà dans le code. Le damier a ses propres jetons (`--color-damier-a` / `-b`, `interface/src/index.css` lignes 60-61), indépendants des `--color-fond-*`. Et `interface/src/composants/Superposition.tsx` lignes 37-47 embarque déjà un sélecteur de fond à six choix (damier, blanc, noir, rose, bleu, vert) : le produit a donc déjà concédé qu'une surface de jugement doit être choisie, pas imposée. Il ne reste qu'à généraliser.

Le plafond du châssis n'est pas fixé par la couleur mais par l'accent. Le cyan `#49B3CE` tient le seuil AA (4,5 : 1) tant que le fond reste sous 4,1 % de luminance ; au-delà il passe sous le seuil. Comme `text-signal` est employé 224 fois dans les composants, c'est ce chiffre-là qui borne la montée : fond ≤ 4,1 %, soit une clarté L* ≤ 24.

### Ce que tout le monde fait, et que l’utilisateur attend

- Un fond sombre plutôt que clair pour un outil de production d'images : Gruvbox, Everforest, Rosé Pine, Nord, Catppuccin, Tokyo Night, Solarized, Zenburn — les huit thèmes mesurés sont entre 0,60 % et 4,97 % de luminance. Personne ne travaille sur du blanc. Le refus du blanc par l'auteur est aligné sur l'usage.
- Un damier pour dire la transparence, avec un écart faible entre les deux carreaux. L'atelier le fait déjà correctement (index.css lignes 60-61 et 103-112) : l'écart entre damier-a et damier-b vaut 0,37 point de luminance, assez pour se lire, trop peu pour que l'œil suive le motif.
- Une échelle de surfaces à quatre ou cinq crans plutôt que deux. L'atelier en a six et les emploie vraiment : j'ai compté 36 emplois de fond-0, 85 de fond-1, 150 de fond-2, 54 de fond-3 dans les composants. C'est un système vivant, pas décoratif.
- Un accent unique. Solarized, Nord, Everforest et Gruvbox en ont tous plusieurs ; l'atelier n'en a qu'un et c'est plus strict que la référence, pas moins.
- Pouvoir changer le fond derrière l'image quand on cale un sprite. Aseprite le propose (deux couleurs de damier réglables dans les préférences), DaVinci Resolve le propose (« fond gris dans les visionneuses »). L'atelier le propose déjà, mais dans un seul écran (Superposition.tsx lignes 37-47) et pas dans l'aperçu principal.

### Ce qui émerge en 2025-2026

- Les thèmes dits « chauds » ont déplacé leur chaleur du fond vers le texte. C'est le résultat le plus net de mes mesures : le fond par défaut de Gruvbox, #282828, est un gris rigoureusement neutre — rouge, vert et bleu valent 40 tous les trois. Son texte #EBDBB2 est à 58,8 % de saturation. Everforest fait pareil en plus marqué : ses fonds sont en réalité BLEU-VERT (teinte 199-206°, comme l'atelier), et sa réputation de thème chaud vient entièrement de son texte #D3C6AA (teinte 41°). Zenburn, l'ancêtre, a un fond #3F3F3F parfaitement neutre. La leçon pratique : pour obtenir « chaud » sans payer en jugement d'image, on chauffe le texte et les bordures, on laisse le fond entre neutre et à peine tiède.
- Trois niveaux de profondeur offerts pour un même thème, plutôt qu'un seul. Gruvbox propose dur / moyen / doux (1,40 % / 2,12 % / 3,00 % de luminance), Everforest propose les trois mêmes crans (1,62 % / 3,42 % / 4,34 %). L'écart entre le plus sombre et le plus clair vaut un facteur deux à trois. C'est une reconnaissance que la bonne profondeur dépend de la lumière de la pièce, pas seulement du produit — argument direct pour donner un réglage à l'auteur plutôt que de trancher pour lui.
- Séparer explicitement la couleur de l'interface de celle de la zone d'image. DaVinci Resolve offre une interface neutre désaturée en option précisément parce que son gris bleuté par défaut risque de biaiser l'œil dans l'obscurité d'une salle d'étalonnage, et un réglage indépendant pour le fond des visionneuses. C'est le motif exact dont l'atelier a besoin.
- Les fonds violets (Rosé Pine 249°, Catppuccin 240°, Tokyo Night 235°) qui donnent une impression de chaleur sans être chauds. Rosé Pine base #191724 est bleu-violet au sens strict, mais il se lit nettement moins glacial que le #0B0D10 de l'atelier. Piste intermédiaire si l'ambre franc effraie : une teinte vers 280-300° coupe la froideur sans amener les bruns qui concurrencent le pixel art.

### Là où la convention est fausse pour ce produit

- La justification écrite dans docs/DESIGN.md ligne 147 est inversée. Le document dit qu'« un fond clair remonte la luminance d'entourage, ce qui fausse le contraste perçu d'un sprite ». L'effet Bartleson-Breneman, publié en 1967 et repris dans tous les manuels d'apparence colorée, dit l'inverse : c'est l'entourage SOMBRE qui abaisse le contraste perçu, ce qui oblige à donner plus de contraste à l'image pour qu'elle paraisse juste. À 0,40 % de luminance, l'atelier pousse donc l'auteur à surcontraster ses sprites — le défaut même que le document croit prévenir. Le même commentaire est recopié dans le code, index.css lignes 8-9.
- « Pas de mode clair — c'en est une décision » (index.css ligne 8). Défendable pour l'interface, indéfendable pour la surface de jugement. Les deux normes que j'ai vérifiées placent l'entourage d'une image à juger entre 10 % et 20 % de luminance ; la surface de jugement de l'atelier est à 1,08 %. Ce n'est pas un « mode clair », c'est simplement le chiffre que la gestion de la couleur demande depuis trente ans.
- Le fond de l'atelier n'est pas neutre, contrairement à ce que « des neutres froids » (DESIGN.md ligne 143) laisse entendre. J'ai mesuré 17,8 à 19,0 % de saturation sur les six surfaces. Un vrai neutre est à 0 %. Gruvbox tient ses fonds entre 0 et 7,4 %. L'atelier est donc, de tout le panorama, celui dont le fond est le plus coloré — et le mot « neutre » du document ne décrit pas ce que fait le code.
- Le refus du blanc n'implique pas le noir. Entre le blanc que l'auteur refuse et le #0B0D10 qui le gêne, il y a un facteur 200 de luminance. La question n'a jamais été binaire, et les huit thèmes mesurés occupent tous la zone intermédiaire que l'atelier a sautée.
- Le texte tertiaire est déjà sous le seuil d'accessibilité AA aujourd'hui, avant toute modification : #5E6771 sur #171B21 donne 3,01 : 1 contre 4,5 requis, et j'ai compté 496 emplois de text-texte-3 dans les composants. Ce n'est pas causé par le changement de fond, mais tout travail sur la palette devrait le corriger au passage plutôt que le reconduire.
- Le chiffre « 18 % de gris = #D6D6D6 » circule largement, y compris sur les forums Adobe, et il est faux. Il confond une réflectance de 18 % avec un encrage de 18 % dans un nuancier d'impression. Un vrai gris à 18 % de luminance vaut #6D6D6D ; un gris de clarté L* 50 vaut #777777. Si quelqu'un propose #D6D6D6 comme fond de jugement, il propose en réalité une surface à 68 % de luminance, presque quatre fois trop claire.

### Les recommandations

**Palier 1 — tourner la teinte sans toucher à la clarté. La correction gratuite, à faire dans tous les cas.**

- *Pourquoi* : J'ai mesuré que les six fonds de l'atelier sont à 17,8-19,0 % de saturation, teinte 212-218° (bleu franc). Gruvbox, la référence chaude, tient ses fonds entre 0 et 7,4 % de saturation. Le fond de l'atelier est donc plus teinté que la référence « colorée » à laquelle on le compare — simplement dans l'autre sens. En mesurant l'écart entre le canal rouge et le canal bleu : l'atelier va de -5 à -13 points (bleu dominant), Gruvbox va de 0 à +11 (rouge dominant). Basculer le signe de cet écart et ramener la saturation au niveau Gruvbox donne immédiatement le « chaud » demandé, pour un coût de contraste nul : la luminance ne bouge que de 0,40 % à 0,44 % sur fond-0, et le rapport de contraste de tous les textes reste identique à la deuxième décimale. Aucun des 496 emplois de text-texte-3 ni des 224 emplois de text-signal ne change de verdict.
- *Les valeurs* : fond-0 #0B0D10 → #0F0E0C (L* 3,6 → 4,0) · fond-1 #111419 → #171513 (6,2 → 6,9) · fond-2 #171B21 → #1F1C19 (9,6 → 10,5) · fond-3 #1E242B → #282521 (13,9 → 14,9) · bord #252B33 → #302D28 (17,3 → 18,6) · bord-fort #39424C → #48433D (27,5 → 28,7). Teinte cible 34°, saturation ramenée à ~10 % (55 % de la valeur actuelle).
- *Ce que ça coûte* : Six valeurs dans interface/src/index.css lignes 13-18. Aucun composant à toucher. Aucun contraste à revérifier.

**Palier 2 — la recommandation principale : monter le châssis à une luminance de 1,4 % à 4,1 % (clarté L* 12 à 24), en ambre désaturé. C'est le « chaud et intermédiaire » demandé.**

- *Pourquoi* : Cette fourchette est bornée par deux chiffres que j'ai calculés, pas par un goût. Le plancher : à 1,4 % on est au niveau du fond de Catppuccin Mocha et de Gruvbox dark hard — c'est le minimum pour que le fond cesse de lire comme du noir. Le plafond : 4,1 %, parce que c'est exactement là que le cyan #49B3CE (luminance 38,1 %) tombe à 4,5 : 1 et cesse de tenir le seuil AA pour du petit texte. Au-delà, il faut soit éclaircir l'accent, soit renoncer à 224 emplois. La marche entre paliers reprend celle du système actuel (+2,6 / +3,4 / +4,3 / +3,4 / +10,3 en clarté L*) : la hiérarchie des surfaces ne change pas, elle se translate.
- *Les valeurs* : fond-0 #221F1C (luminance 1,40 %, L* 12,0) · fond-1 #2A2723 (2,06 %, L* 15,8) · fond-2 #322E2A (2,80 %, L* 19,2) · fond-3 #3D3834 (4,07 %, L* 23,9) · bord #47423E (5,58 %, L* 28,3) · bord-fort #615C56 (10,87 %, L* 39,4). Teinte 30-33°, saturation 6-10 %.
- *Ce que ça coûte* : Six valeurs, plus les trois textes du palier 3 qui doivent bouger avec. Le cyan tombe de 7,10 : 1 (niveau AAA) à 5,53 : 1 sur fond-2 et 4,75 : 1 sur fond-3 — il reste AA partout, mais il perd le niveau AAA. C'est le vrai prix, et il est chiffrable.

**Palier 3 — accorder les trois textes en même temps, sinon les rapports de contraste se dégradent silencieusement.**

- *Pourquoi* : Le texte actuel #E6EAEE est bleuté (teinte 210°, saturation 19 %) : posé sur un fond ambre il produira une discordance visible. Surtout, les rapports doivent être reconduits, pas abandonnés. J'ai calculé les trois valeurs chaudes qui reproduisent à l'identique les rapports d'aujourd'hui : le texte principal passe de 14,29 : 1 à 10,82 : 1 (reste très au-dessus du niveau AAA qui demande 7 : 1), le secondaire de 6,66 à 5,98 : 1 (reste AA), et le tertiaire de 3,01 à 3,00 : 1 — rigoureusement inchangé. À noter au passage : ce texte tertiaire est DÉJÀ sous le seuil AA aujourd'hui (3,01 : 1 contre 4,5 requis) et il est employé 496 fois. Le passage au chaud ne crée pas ce défaut, mais c'est l'occasion de le voir.
- *Les valeurs* : texte #E6EAEE → #E9E6E2 (luminance 79,4 %) · texte-2 #98A2AC → #B2ACA4 (41,7 %) · texte-3 #5E6771 → #7C766E (18,4 %). Si l'on veut aussi réparer le tertiaire, il lui faut au minimum #9B948A sur fond-2 (4,5 : 1) ou #BFBAB4 pour atteindre AAA (7 : 1).
- *Ce que ça coûte* : Trois valeurs dans index.css lignes 20-22. 496 + emplois hérités automatiquement, aucun composant à éditer.

**Découpler la surface de jugement du châssis, et la faire monter beaucoup plus haut que lui — vers 10 % de luminance, pas 1 %.**

- *Pourquoi* : C'est ici que la question centrale se tranche. Aujourd'hui le damier moyenne 1,08 % de luminance : l'image est jugée dans le noir. Les normes visent 10 % (norme vidéo SMPTE RP 166 / UIT-R BT.2035, entourage à 10 % du blanc de l'écran) à 20 % (norme ISO 3664 pour les arts graphiques, entourage neutre à 20 % de réflectance, clarté L* ≈ 50). Le modèle d'apparence colorée CIECAM02 pose le même chiffre : le fond de référence vaut 20 % de la luminance du blanc, et l'entourage actuel de l'atelier tombe dans la catégorie « sombre », celle où le modèle applique une correction de contraste. L'écart entre 1 % et 10 % n'est donc pas un ajustement de confort, c'est un facteur dix par rapport à ce que les normes demandent. Réserve honnête : ces normes visent le jugement d'une photo destinée au papier ou à un écran de télévision. Un sprite est destiné à un jeu, et le vrai fond de référence est celui du jeu. C'est pourquoi je ne recommande pas une valeur fixe mais un choix, avec un défaut plus haut qu'aujourd'hui.
- *Les valeurs* : Trois crans à proposer sous l'image : neutre bas #3F3F3F/#383838 (4,5 % de luminance, L* 27) — neutre norme vidéo #5A5A5A/#525252 (9,3 %, L* 38) — neutre norme ISO #6D6D6D/#646464 (14,0 %, L* 46). Tous strictement neutres : rouge = vert = bleu, aucune teinte. Défaut suggéré : le cran médian #5A5A5A. Pour mémoire, un vrai gris à 18 % de luminance vaut #6D6D6D et un gris de clarté L* 50 vaut #777777 — ce ne sont PAS #D6D6D6, chiffre qui circule beaucoup et qui confond la réflectance de 18 % avec un encrage de 18 % dans un nuancier d'impression.
- *Ce que ça coûte* : Deux jetons existent déjà (index.css lignes 60-61) : le raccordement est déjà fait. Le sélecteur existe déjà lui aussi dans Superposition.tsx lignes 37-47 — il s'agit de le remonter dans Apercu.tsx (qui n'utilise aujourd'hui que le damier, lignes 500 et 524) et dans la fiche.

**Marquer une couture franche entre le châssis chaud et la surface neutre — un écart d'au moins 2 crans de clarté, jamais un dégradé.**

- *Pourquoi* : C'est la condition pour que les deux moitiés de la phrase de DESIGN.md ligne 145-148 tiennent ensemble. Si le châssis monte à 2,8 % et la surface à 9,3 %, l'écart de clarté est de L* 19 contre L* 38 : l'œil lit sans hésitation deux zones distinctes, et la zone chaude cesse d'entrer en concurrence avec l'image parce qu'elle est clairement en-dehors. C'est le motif que DaVinci Resolve applique avec deux réglages séparés (interface neutre désaturée d'un côté, fond gris dans les visionneuses de l'autre), et que la norme ISO 3664 formalise en distinguant le fond immédiat de l'entourage. Si au contraire on faisait monter le châssis jusqu'au niveau de la surface, on perdrait la couture ET l'accent cyan d'un seul coup.
- *Les valeurs* : Écart minimum recommandé : 15 points de clarté L* entre fond-2 du châssis et la surface de jugement. Avec le palier 2 (fond-2 à L* 19,2) et le neutre médian (L* 38,2), l'écart vaut 19 points. Bordure de séparation : un trait de 1 px en --color-bord, jamais une ombre ni un dégradé.
- *Ce que ça coûte* : Aucune valeur nouvelle. C'est une règle à inscrire, et une vérification à faire écran par écran.

**Si l'auteur veut aller au-delà de 4,1 % de luminance sur le châssis, éclaircir l'accent avant, pas après.**

- *Pourquoi* : J'ai vérifié le point de rupture précisément. Sur un fond à 4,92 % (#433E38), le cyan #49B3CE tombe à 4,34 : 1 — sous le seuil AA pour du texte courant, il ne resterait valable que pour du gros texte. Sur un fond à 6,61 %, il tombe à 3,71 : 1. Éclaircir l'accent vers #63C4DD le remonte à 6,71 : 1 sur fond-2 et 5,77 : 1 sur fond-3, ce qui rachète environ deux crans de fond. Variante à considérer si l'auteur veut un accent chaud plutôt que le cyan : un ambre #D7B675 donne 6,95 : 1 sur fond-2 — mais il entre alors en concurrence directe avec les ors du pixel art, ce que le document redoutait à juste titre. Le cyan a une vertu que je n'ai pas trouvée ailleurs : il occupe la seule région de la roue chromatique qu'un décor de fantasy n'occupe pas.
- *Les valeurs* : Point de rupture mesuré : fond à 4,1 % de luminance (≈ #3D3834, L* 24). Accent de remplacement si dépassement : #63C4DD (cyan remonté) ou #8ED8E8 (le --signal-clair qui existe déjà, ligne 25).
- *Ce que ça coûte* : Une valeur. Mais 224 emplois de text-signal en dépendent, donc la vérification vaut d'être faite avant de bouger le fond, pas après.

### Les sources

- Mesures faites par moi sur C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/index.css lignes 13-29 et 60-61 : luminance relative et clarté L* des 17 jetons de couleur, formules sRGB et CIE L*
- Comptages faits par moi dans C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/ : 36 emplois de fond-0, 85 de fond-1, 150 de fond-2, 54 de fond-3, 496 de text-texte-3, 224 de text-signal
- C:/STOCKAGE/PROJET/_DEV/gag2/docs/DESIGN.md lignes 143-148 — la justification du châssis sombre et froid, que les sources de gestion de la couleur contredisent
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Superposition.tsx lignes 37-47 — le sélecteur de fond à six choix qui existe déjà
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Apercu.tsx lignes 500 et 524 — l'aperçu principal, qui n'offre que le damier
- ISO 3664:2009, conditions de visionnage pour les arts graphiques et la photographie — entourage neutre mat, réflectance entre 10 % et 60 %, gris moyen à 20 % recommandé : https://cdn.standards.iteh.ai/samples/43234/d3de25012f6b433e886679d3a450499f/ISO-3664-2009.pdf
- Recommandation UIT-R BT.2035 (07/2013), environnement de visionnage de référence — 10 lux, chromaticité D65, blanc de référence 100 cd/m² : https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.2035-0-201307-I!!PDF-E.pdf
- Bartleson et Breneman 1967, relation entre entourage et contraste perçu : https://www.imaging.org/common/uploaded%20files/pdfs/Papers/1997/RP-0-67/2355.pdf
- Le modèle CIECAM02 et ses trois entourages (moyen, faible, sombre), fond de référence à 20 % du blanc : https://rawpedia.rawtherapee.com/CIECAM02
- Palette Gruvbox, valeurs dur / moyen / doux : https://github.com/morhetz/gruvbox-contrib/blob/master/color.table
- Palette Everforest, les trois niveaux de fond : https://github.com/sainnhe/everforest/blob/master/palette.md
- Palette Rosé Pine (main, moon, dawn) : https://rosepinetheme.com/palette/ingredients/
- Palette Solarized : https://ethanschoonover.com/solarized/
- Palette Nord : https://www.nordtheme.com/docs/colors-and-palettes/
- Palette Catppuccin : https://github.com/catppuccin/palette
- Réglages d'interface DaVinci Resolve — interface neutre désaturée et fond gris dans les visionneuses : https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part133.htm
- Fond de transparence réglable dans Aseprite : https://www.aseprite.org/docs/canvas/
- La confusion 18 % / #D6D6D6 sur les forums Adobe : https://community.adobe.com/t5/photoshop-ecosystem-discussions/18-gray-card-color-code-in-photoshop/td-p/10449206

---

<a id="sondage-3"></a>

## 9 · La teinte dynamique tirée du contenu — état de l'art, et pourquoi ce produit est le cas où elle se retourne

Tous les systèmes qui teignent une interface avec les couleurs d'un contenu font la même chose : ils fixent la CLARTÉ par rôle et ne laissent bouger que la teinte et la saturation. C'est ce qui garantit le contraste, et j'ai vérifié que ça marche — en tournant la teinte des neuf gris du châssis à clarté constante, le contraste ne bouge que de 0,15 au pire (`--texte-2` passe de 6,58 à 6,73). Le mécanisme n'est pas le problème.

Le problème est ailleurs, et il est propre à cet atelier. Trois mesures faites sur le dépôt et sur les données réelles :

1) **Sur les quatre projets de l'auteur qui ont une palette, la teinte dominante tombe à moins de 30° d'une sémantique. Quatre sur quatre.** `coeur-de-pierre` est à 12° de `--echec`, `essai-animation` à 15° de `--epingle`. Et deux projets sur six (`test-v2`, `vignettes`) ont une palette vide : il n'y a rien à en tirer.

2) **Un châssis teint à la couleur du jeu affaiblit les images de ce jeu.** L'œil s'adapte à ce qui domine l'écran ; un fond vert fait paraître un sprite vert moins vert. Chiffré : à la chroma que le châssis porte déjà (0,013 en OKLCH), un sprite de la même teinte perd 10 à 17 % de sa saturation apparente ; à la chroma où la teinte se verrait vraiment (0,03), il en perd 24 à 41 %. C'est exactement le jugement que l'atelier sert à porter — « cette image est-elle dans la palette du jeu ? » — et la teinte le fausse dans le sens qui trompe : elle fait rater ce qui est juste.

3) **Ce que l'auteur demande existe déjà, et au bon endroit.** La vitrine (`atelier/services/production.py:1276`) propose les trois premières couleurs de la palette du jeu comme fonds de jugement, dans la colonne centrale seulement, panneaux latéraux restés neutres. La raison est écrite dans le code : « une couleur que le jeu emploie — le sujet s'y détache, ou non ». Teindre le châssis mettrait la même couleur des deux côtés et supprimerait la comparaison que la vitrine a été construite pour créer.

Et le mécanisme lui-même est déjà dans le produit : les dix teintes d'îlot sont un contraste fixé (4,58 à 4,62 sur `--fond-2`, mesuré) où seule la teinte varie. C'est la bonne réponse, appliquée au bon objet.

La recommandation : ne pas teindre le châssis ; donner au projet une identité colorée bornée — une teinte d'îlot, un liseré, une pastille — et étendre la vitrine, qui est le seul endroit où la couleur du jeu a un métier.

### Ce que tout le monde fait, et que l’utilisateur attend

- Un espace de couleur où la clarté est séparée de la teinte. Material 3 emploie HCT (Hue, Chroma, Tone) ; le web moderne emploie OKLCH. Les deux servent la même fin : pouvoir tourner la teinte sans déplacer la clarté, donc sans déplacer le contraste.
- Une clarté fixée par rôle, écrite en dur, jamais dérivée. Material 3 (fichier color_spec_2021.ts) : surface = tone 6 en sombre / 98 en clair ; texte sur surface = 90 / 10 ; texte secondaire = 80 / 30 ; filet = 60 / 50 ; accent = 80 / 40. Ces nombres ne dépendent pas de la couleur source. Seules la teinte et la chroma en dépendent.
- Une chroma plafonnée, et très bas sur les neutres. Material 3 : la palette neutre est plafonnée à chroma 4, la variante neutre à 8, sur une échelle où l'accent monte à 48 minimum. Autrement dit, le fond n'est jamais vraiment coloré — il est teinté d'un souffle.
- Un jeu de couleurs sémantiques PROTÉGÉ. Dans material-color-utilities, la palette d'erreur est écrite `TonalPalette.fromHueAndChroma(25, 84)` — teinte 25°, chroma 84, en dur, identique quel que soit le fond d'écran. Elle n'est pas dérivée de la source. Aucun système grand public ne laisse le rouge d'erreur bouger.
- Une zone bornée, jamais tout le châssis. Spotify pose le dégradé tiré de la pochette derrière l'en-tête d'un album ; la barre de navigation, le lecteur et la bibliothèque restent sur le même gris sombre. Aucun produit livré ne teint l'application entière — ils teignent un bandeau.
- Un garde-fou de contraste après coup. Material 3 vérifie et corrige : `toneAllowsLightForeground(tone)` ne rend vrai qu'à tone ≤ 49, et `enableLightForeground` redescend une clarté à 49 quand il le faut pour tenir 4,5 : 1. La dérivation ne fait pas confiance à elle-même.
- Une extraction de palette par quantification. Spotify découpe l'image en composantes par k-moyennes ; Material quantifie le fond d'écran ; l'atelier fait déjà pareil — `atelier/image/palette.py:220` emploie `Image.quantize` en median-cut.

### Ce qui émerge en 2025-2026

- OKLCH est devenu utilisable sans réserve. Chrome et Edge depuis la version 111 (mars 2023), Safari depuis 16.2, Firefox depuis 113 ; `color-mix()` est passé « largement disponible » en 2025-2026. Sur cette machine — Windows 11, Chrome ou Edge — la question ne se pose pas.
- La syntaxe de couleur relative — `oklch(from var(--base) l c calc(h + 40))` — permet de dériver un jeu entier sans une ligne de JavaScript. C'est la manière dont on écrira ces systèmes en 2026.
- Le glissement de « teindre l'interface » vers « teindre un objet ». La critique de Material You dans la presse spécialisée porte moins sur le contraste que sur la perte d'identité : quand toutes les applications prennent la couleur du fond d'écran, on ne les distingue plus les unes des autres. Les éditeurs qui tiennent à leur marque (Spotify, Meta, YouTube) n'ont jamais adopté le thème dynamique.
- Le retour du contraste piloté par un curseur plutôt que par un seuil. Material 3 a un `contrastLevel` continu de -1 à +1 et une `ContrastCurve(bas, normal, moyen, haut)` par rôle — la surface conteneur passe de 12 à 20 en sombre selon le réglage. On ne vise plus « AA », on vise une courbe.
- La séparation explicite entre couleurs dynamiques et couleurs statiques dans les outils. Le Theme Builder de Material permet de déclarer des couleurs qui ne suivront pas le fond d'écran — pour la marque, et pour tout ce qui a un sens fixe.

### Là où la convention est fausse pour ce produit

- Tous ces systèmes teignent une interface qui montre du contenu QUELCONQUE. Cet atelier teindrait une interface qui sert à JUGER le contenu dont la teinte est tirée. C'est le seul cas où la boucle se referme sur elle-même : le fond devient une preuve à charge en faveur de ce qu'on lui compare.
- La norme professionnelle du jugement d'image dit exactement l'inverse de Material You. ISO 3664 (« Viewing conditions — Graphic technology and photography ») exige que l'entourage d'une image ait une chroma CIELAB **au plus égale à 2**, c'est-à-dire qu'il paraisse neutre, et une réflectance de 10 à 60 %. Mesuré : `--fond-2` `#171B21` est à C*ab = 4,76, soit déjà 2,4 fois au-dessus de ce que la norme tolère, et `--bord-fort` à 7,35, soit 3,7 fois. Le châssis actuel n'est pas neutre — mais il est CONSTANT, ce qui est la propriété qui compte.
- Un accent tiré du jeu n'a pas la place de tomber. Les quatre sémantiques occupent quatre points de la roue (OKLCH : `--echec` 25°, `--epingle` 87°, `--ok` 150°, `--signal` 218°). Avec un seuil de confusion de 25°, **54 % de la roue est déjà prise** ; à 30°, 66 %. Une teinte tirée d'un jeu a plus d'une chance sur deux d'atterrir sur une sémantique. Et sur les données réelles, c'est quatre fois sur quatre.
- Le cyan du produit a été choisi CONTRE le contenu, pas d'après lui. `docs/DESIGN.md` l'écrit : « le cyan est choisi contre le contenu : c'est la seule famille chromatique qu'un asset de fantasy ne produit presque jamais. » Teindre le châssis avec la palette du jeu inverse la règle qui a fondé la palette du châssis — l'accent irait se noyer précisément dans les couleurs qu'il doit surmonter.
- Le mode clair a déjà été refusé pour cette raison exacte, et c'est écrit dans le code : `interface/src/index.css:8-9` — « Pas de mode clair — c'en est une décision : un fond clair remonte la luminance d'entourage et fausse le contraste perçu d'un sprite. » Le même raisonnement s'applique à la chromaticité, en plus fort : la luminance d'entourage fausse le contraste, la chromaticité d'entourage fausse la teinte ET la saturation.
- La stabilité vaut mieux que la neutralité. Le châssis actuel n'est pas innocent — mesuré, il fait paraître une pierre bleue 60 % moins saturée qu'elle n'est, et un or terne 22 % plus saturé. Mais il fait la même chose sur tous les projets, tous les jours. L'œil de l'auteur s'est calibré dessus. Une teinte qui change avec le projet ouvert détruit cette calibration à chaque changement de projet, et détruit surtout la comparaison entre deux projets.

### Les recommandations

**Ne pas teindre le châssis. Répondre au vrai besoin — savoir quel jeu est ouvert — par une marque bornée, pas par une ambiance.**

- *Pourquoi* : Le besoin derrière la demande est légitime : quand on travaille sur plusieurs jeux, on veut savoir du coin de l'œil lequel est ouvert. Mais la couleur du fond est le plus mauvais instrument pour le dire, parce que c'est le seul élément de l'écran qui touche à TOUTES les images en même temps. Une marque de 200 pixels dit la même chose sans rien fausser. Et le produit a déjà le vocabulaire : les dix teintes d'îlot, que `docs/DESIGN.md` définit explicitement comme « le seul endroit du produit où une couleur ne veut rien dire » — un rangement, pas un état. C'est exactement le statut qu'il faut à une couleur de projet.
- *Les valeurs* : Attribuer à chaque projet une des dix teintes d'îlot existantes (`--color-ilot-ardoise` … `--color-ilot-paille`, `interface/src/index.css:49-58`). Mesurées : contraste 4,58 à 4,62 sur `--fond-2`, saturation HSL 30 % pour les dix. Les poser à trois endroits, pas plus : une pastille de 8 px près du nom du projet dans la barre de tête, un liseré de 2 px sur le bord gauche de l'écran, la couleur du titre d'onglet du navigateur. Zéro pixel de fond touché.
- *Ce que ça coûte* : Faible. Un champ `teinte` sur le projet, trois points d'affichage. Le tableau `COULEUR_TEINTE` d'`interface/src/api.ts:1418` fait déjà la correspondance nom → token.

**Étendre la vitrine plutôt que le châssis — c'est là que la couleur du jeu a déjà un métier, et elle y est bornée par construction.**

- *Pourquoi* : `atelier/services/production.py:1276` propose déjà les trois premières couleurs de la palette du jeu comme fonds de jugement, et écrit la raison en clair : « une couleur que le jeu emploie — le sujet s'y détache, ou non ». Le composant les pose sur la colonne centrale seulement (`interface/src/composants/Vitrine.tsx:171`), panneaux latéraux en `bg-fond-1`. C'est la bonne architecture : la couleur du jeu est là où on la compare, le neutre est tout autour pour servir de référence. Teindre le châssis mettrait la couleur des deux côtés et supprimerait la référence — on ne peut pas juger un écart quand les deux termes ont bougé ensemble.
- *Les valeurs* : Passer de 3 fonds de palette à 6, et ajouter le fond gris ISO : un neutre à C*ab ≤ 2 et L* ≈ 20 (`#2E2E2E` mesure C*ab = 0,0 et L* = 19,8), qui est la référence du métier pour juger une image. Porter le même choix de fonds à l'aperçu plein écran (`interface/src/composants/Apercu.tsx:500`), qui n'a aujourd'hui que le damier.
- *Ce que ça coûte* : Faible côté serveur (`couleurs[:3]` → `couleurs[:6]`), moyen côté aperçu (reprendre le sélecteur de fonds de la vitrine).

**Si la teinte dynamique se fait malgré tout : la borner à une chroma OKLCH de 0,022 au maximum sur les fonds, et n'y toucher qu'en dehors des écrans de jugement.**

- *Pourquoi* : Deux plafonds indépendants se rejoignent presque au même endroit. Le premier est optique : au-delà de 0,03 de chroma, un sprite de la même teinte perd plus du quart de sa saturation apparente (mesuré : 24 % à f = 0,5 de remplissage d'écran, 41 % à f = 0,8). Le second est technique : à la clarté de `--fond-2` (L = 0,221 en OKLCH), le sRGB commence à écrêter au-dessus de 0,039 — j'ai compté 7 teintes sur 24 hors gamut à C = 0,05, et 15 sur 24 à C = 0,08. La fenêtre praticable est donc étroite, et 0,022 la garde du bon côté des deux.
- *Les valeurs* : Chroma maximale tenable à toutes les teintes, mesurée par dichotomie sur le gamut sRGB : `--fond-0` 0,031 · `--fond-1` 0,035 · `--fond-2` 0,039 · `--fond-3` 0,045 · `--bord` 0,050 · `--bord-fort` 0,064 · `--texte-3` 0,087 · `--texte-2` 0,120 · `--texte` 0,031. Plafond recommandé : 0,022 partout, soit 1,7 fois ce que le châssis porte aujourd'hui (0,007 à 0,021). Et le désactiver entièrement sur la vitrine, l'aperçu et la superposition.
- *Ce que ça coûte* : Moyen. Il faut une fonction de dérivation, un plafond, et un interrupteur par écran.

**Protéger les quatre sémantiques et les dix teintes d'îlot : elles ne bougent jamais, quelle que soit la palette du jeu.**

- *Pourquoi* : C'est ce que fait Material 3 et c'est ce qu'il faut faire ici, en plus strict. La palette d'erreur de Material est écrite en dur — `TonalPalette.fromHueAndChroma(25, 84)` — et ne suit pas le fond d'écran, parce qu'un rouge qui n'est plus rouge ne dit plus « erreur ». Ici l'enjeu est plus lourd : `--epingle` veut dire « réglé à la main » et `--echec` veut dire « appel raté », c'est-à-dire de l'argent perdu. Mesuré sur les vrais projets, la teinte dominante tombe à 12° de `--echec` pour `coeur-de-pierre`, 15° de `--epingle` pour `essai-animation`, 23° de `--echec` pour `coeur-de-pierre-01`, 29° de `--epingle` pour `bac-a-sable`. Sans protection, l'accent devient indiscernable d'un état d'échec sur ces quatre projets.
- *Les valeurs* : Teintes OKLCH mesurées des sémantiques : `--echec` 25°, `--epingle` 87°, `--ok` 150°, `--signal` 218°. Règle : une teinte dérivée doit rester à plus de 30° de chacune des quatre. Si la teinte dominante du jeu tombe dans un arc interdit, la faire glisser vers le bord de l'arc — ne pas prendre la deuxième couleur de la palette, qui ne veut rien dire de plus. À 30° de garde, 66 % de la roue est interdite ; le glissement est donc la règle, pas l'exception.
- *Ce que ça coûte* : Faible si la dérivation est écrite proprement dès le départ — c'est une clause de plus dans la fonction.

**Le mécanisme, s'il se fait : fixer la clarté OKLCH aux neuf valeurs actuelles, ne laisser varier que teinte et chroma, dériver les 17 tokens de châssis depuis une seule teinte source.**

- *Pourquoi* : J'ai vérifié que la garantie de contraste est réelle et pas une promesse : en tournant la teinte sur douze positions à clarté et chroma constantes, le contraste sur `--fond-2` ne bouge au pire que de 0,15 (`--texte-2` : 6,58 à 6,73, soit 2,2 % d'écart ; `--texte` : 14,21 à 14,34). La raison est mathématique — la clarté CIE L* est une fonction monotone de la luminance relative, celle-là même dont WCAG calcule le rapport. Fixer la clarté fixe donc le contraste exactement, à l'arrondi du gamut près. Contrôle indépendant : six couleurs de teintes espacées de 60°, calées sur la clarté de `--texte`, donnent des contrastes de 14,22 à 14,36 sur `--fond-2`.
- *Les valeurs* : Les neuf clartés OKLCH à conserver telles quelles : `--fond-0` 0,158 · `--fond-1` 0,190 · `--fond-2` 0,221 · `--fond-3` 0,257 · `--bord` 0,287 · `--bord-fort` 0,375 · `--texte-3` 0,510 · `--texte-2` 0,707 · `--texte` 0,935. Les chromas actuelles, à conserver comme plancher : 0,0072 · 0,0112 · 0,0132 · 0,0158 · 0,0170 · 0,0209 · 0,0194 · 0,0185 · 0,0069 — noter qu'elles montent puis redescendent, la chroma culminant sur `--bord-fort` et retombant sur `--texte`. Ce n'est pas un dégradé linéaire, c'est une courbe à reproduire. Écriture : `oklch(0.221 var(--teinte-c) var(--teinte-h))`, une variable de teinte et une de chroma pour tout le châssis. Le nombre exact de tokens de couleur est 27 dont 10 d'îlot, soit **17 tokens de châssis**, pas 20.
- *Ce que ça coûte* : Moyen. La dérivation elle-même tient en trente lignes ; la vérification (rejouer les contrastes annoncés dans `docs/DESIGN.md` sur chaque teinte possible) est le vrai travail.

**L'injection technique est presque gratuite, et c'est vérifié : un seul bloc `:root` non calqué suffit à repeindre les 2 112 usages de couleur.**

- *Pourquoi* : J'ai lu le CSS construit. Tailwind v4 émet les tokens dans `@layer theme{:root,:host{ --color-fond-0:#0b0d10; … }}` — un bloc de 1 303 caractères. Comme la règle est dans un calque, **toute règle `:root` non calquée l'emporte**, sans discussion de spécificité : c'est la cascade de calques. Il suffit donc d'injecter un `<style>` non calqué, ou de poser les variables sur `document.documentElement.style`. Et les 2 112 classes de couleur du code passent toutes par `var()` — vérifié sur `.bg-fond-2{background-color:var(--color-fond-2)}`. Même les modificateurs d'opacité suivent : `.bg-signal\/13` est émis deux fois, d'abord en hexadécimal figé `#49b3ce21`, puis sous `@supports (color:color-mix(in lab,red,red))` en `color-mix(in oklab,var(--color-signal) 13%,transparent)` — c'est la seconde qui s'applique sur Chrome et Edge, donc elle suit l'écrasement.
- *Les valeurs* : Décompte des usages de classes de couleur dans `App.tsx` et les 34 composants : 2 112 au total — `--texte-3` 514 · `--bord` 358 · `--texte-2` 256 · `--signal` 231 · `--texte` 164 · `--fond-2` 146 · `--fond-1` 83 · `--signal-clair` 75 · `--epingle` 65 · `--echec` 55 · `--fond-3` 53 · `--bord-fort` 53 · `--fond-0` 32 · `--lumiere` 19 · `--ok` 14. Fuites hors tokens : 9 seulement, toutes des couleurs de CONTENU et non de châssis — le magenta `#FF00FF` de marquage (`Assistant.tsx:2047`, `Envoi.tsx:765`) et les six fonds de repérage de `Superposition.tsx:41-46`. Aucune ne doit suivre la teinte.
- *Ce que ça coûte* : Très faible. C'est le seul point de la demande qui est facile.

**Corriger d'abord `bg-signal-sourd` — c'est un token annoncé par le document, employé par le code, et absent de la feuille de style. Deux boutons ne portent aujourd'hui aucun fond.**

- *Pourquoi* : `docs/DESIGN.md` déclare `--signal-sourd` `rgba(73,179,206,.13)` dans le tableau des sémantiques. `interface/src/index.css` ne le définit nulle part — j'ai listé les 27 tokens de couleur, il n'y est pas. Or `interface/src/composants/Tables.tsx:954` et `:966` écrivent `bg-signal-sourd` sur les boutons de zoom « 100 % » et « ajusté ». J'ai cherché `.bg-signal-sourd` dans le CSS construit (`interface/dist/assets/index-CcBOwEwh.css`) : **absent**. Ces deux boutons, quand ils sont actifs, ne se signalent donc que par leur bordure et la couleur de leur texte, pas par le fond plein que le motif prévoit — alors que les seize autres emplois du même motif ailleurs dans le produit écrivent `bg-signal/13` et fonctionnent. Ce n'est pas un détail cosmétique dans ce dossier : c'est la preuve que l'invariant « aucune couleur n'est écrite ailleurs que dans les tokens » n'est pas tenu à 100 %, et une teinte dynamique repose entièrement sur cet invariant.
- *Les valeurs* : Remplacer `bg-signal-sourd` par `bg-signal/13` aux lignes 954 et 966 de `Tables.tsx` — c'est la valeur exacte que le document décrit (`rgba(73,179,206,.13)`) et celle qu'emploient les seize autres occurrences du motif.
- *Ce que ça coûte* : Deux caractères. À faire avant toute autre chose.

**Prévoir le cas « pas de palette », qui est un tiers des projets réels, et ne pas le traiter par un repli silencieux.**

- *Pourquoi* : Sur les six projets du dossier `donnees/projets`, deux ont une palette vide : `test-v2` et `vignettes`. Et la palette n'est jamais saisie — `interface/src/api.ts:1812` le dit : « Déduite par calcul des artworks officiels, jamais saisie ». Un jeu neuf, avant son premier artwork officiel, n'a donc pas de couleur. Si le châssis change d'identité au moment où le premier artwork entre, l'auteur verra l'interface changer de couleur sans avoir rien demandé, en plein travail — c'est le reproche le plus constant fait à Material You : la couleur bouge pour des raisons que l'utilisateur ne relie pas à son geste.
- *Les valeurs* : Mesuré sur les quatre projets pourvus : teinte dominante pondérée par la chroma — `coeur-de-pierre-01` 2° (concentration 0,56) · `coeur-de-pierre` 37° (0,91) · `bac-a-sable` 58° (0,87) · `essai-animation` 102° (0,52). La concentration compte autant que la teinte : à 0,52, la palette n'a pas de teinte dominante nette et le chiffre est du bruit. Poser un seuil — sous 0,70 de concentration, on ne dérive rien.
- *Ce que ça coûte* : Faible, mais c'est la clause qu'on oublie et qui produit la mauvaise surprise.

### Les sources

- Fichiers du dépôt — mesures faites moi-même : interface/src/index.css (27 tokens de couleur, dont 10 d'îlot, soit 17 de châssis ; lignes 8-9 pour le refus du mode clair) · interface/src/composants/Tables.tsx:954 et :966 (bg-signal-sourd, token inexistant) · interface/src/composants/Vitrine.tsx:171 (le fond de palette sur la colonne centrale seule) · interface/src/composants/Superposition.tsx:41-46 (les six fonds de repérage écrits en dur) · interface/src/api.ts:1418 (COULEUR_TEINTE) et :1812 (« palette déduite par calcul, jamais saisie ») · atelier/services/production.py:1249-1282 (les fonds de la vitrine, couleurs[:3]) · atelier/image/palette.py:220 (quantification median-cut) · atelier/domaine/ambiance.py:67-71 (COULEURS_MIN 4, COULEURS_MAX 64) · interface/dist/assets/index-CcBOwEwh.css (@layer theme{:root,:host}, .bg-signal/13 sous @supports color-mix, .bg-signal-sourd absent) · donnees/projets/*/projet.json (les six palettes réelles) · docs/DESIGN.md § Color (le cyan choisi contre le contenu, les arcs interdits, les contrastes annoncés — tous vérifiés au calcul)
- Material Design 3 — Dynamic color : https://m3.material.io/styles/color/dynamic
- material-color-utilities, color_spec_2021.ts — les clartés par rôle : surface 6/98, onSurface 90/10, onSurfaceVariant 80/30, outline 60/50, primary 80/40, error 80/40, errorContainer 30/90 : https://github.com/material-foundation/material-color-utilities/blob/main/typescript/dynamiccolor/color_spec_2021.ts
- material-color-utilities, core_palette.ts — les chromas et rotations : neutre min(chroma/12, 4), variante neutre min(chroma/6, 8), tertiaire teinte+60, et l'erreur en dur fromHueAndChroma(25, 84) : https://github.com/material-foundation/material-color-utilities/blob/main/typescript/palettes/core_palette.ts
- material-color-utilities — le système de couleur dynamique, ContrastCurve, ToneDeltaPair, toneAllowsLightForeground (vrai à tone ≤ 49) : https://deepwiki.com/material-foundation/material-color-utilities/3-dynamic-color-system
- ISO 3664:2009 — Graphic technology and photography, Viewing conditions : entourage neutre et mat, chroma CIELAB ≤ 2, réflectance 10 à 60 %, gris moyen 20 % recommandé : https://www.iso.org/standard/43234.html et le texte : https://cdn.standards.iteh.ai/samples/43234/d3de25012f6b433e886679d3a450499f/ISO-3664-2009.pdf
- Ekroll & Faul, « Basic Characteristics of Simultaneous Color Contrast Revisited », Psychological Science 2012 : https://journals.sagepub.com/doi/abs/10.1177/0956797612443369
- « What predicts the strength of simultaneous color contrast? », Journal of Vision — la loi de Kirschmann généralisée : un entourage plus saturé induit davantage : https://pmc.ncbi.nlm.nih.gov/articles/PMC5852948/
- Brenner & Cornelissen, « The Influence of Chromatic and Achromatic Variability on Chromatic Induction and Perceived Colour », Perception 2002 — l'induction est réduite quand l'entourage est varié, maximale quand il est uni : https://journals.sagepub.com/doi/10.1068/p02sp
- Fairchild, « Von Kries 2020: Evolution of degree of chromatic adaptation », CIC28 — le facteur D d'adaptation incomplète : http://markfairchild.org/PDFs/PRO51.pdf
- « Everything I hate about Google's new Material You design system », Android Police — la perte d'identité entre applications, le refus des éditeurs tiers : https://www.androidpolice.com/everything-i-hate-about-material-you/
- « Google Material You unicolor themes are doomed to fail », Android Authority — les palettes ternes tirées de fonds d'écran peu colorés : https://www.androidauthority.com/google-material-you-unicolor-themes-3113986/
- Comment Spotify fabrique ses fonds — extraction par k-moyennes, filtrage sur le contraste avec le texte blanc, application en dégradé sur l'en-tête seulement : https://medium.com/@shanmugashree3/how-spotify-creates-those-stunning-backdrops-that-match-every-song-playlist-00fe13eab033
- oklch() — MDN, et l'état du support navigateur : https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch
- « Modern CSS Color Functions 2026: OKLCH, color-mix(), hsl() and Beyond » — Chrome/Edge 111+, Safari 16.2+, Firefox 113+ ; color-mix() largement disponible : https://www.colorpick.app/blog/css-color-functions-2026-guide
- « Designing Error, Warning, and Success Colors for Your System » — les couleurs d'état gardent leur sens à travers les thèmes plutôt que d'être ajustées dynamiquement : https://paletterx.com/blog/color-for-error-and-success-states

---

<a id="sondage-4"></a>

## 10 · Un jeu d'icônes pour l'Atelier : Lucide, à 12 px, bouts carrés — et le vrai obstacle n'est pas le choix du jeu

Deux choses que j'ai vérifiées dans le code avant de répondre, et qui changent la question.

D'abord, le produit n'a pas trois signes dessinés, il en a une dizaine. J'ai compté tous les caractères-symboles employés dans les 34 composants (essais exclus) : le chevron « › » apparaît 99 fois, dans 23 des 34 fichiers ; s'y ajoutent le point plein et le point creux (3 chacun), le coin plein « ◤ » (3), la coche (2), la croix (3), 27 flèches, le triangle plein dessiné en bordure (4 endroits), et le « + ». Or `docs/design-motifs.md` ligne 770 écrit qu'« un chevron serait un quatrième glyphe » — comme s'il n'existait pas. Il existe, cent fois. Ajouter un jeu d'icônes n'est donc pas une rupture : c'est une mise en ordre de dix signes qui ne se ressemblent pas.

Ensuite, le produit dessine au bout carré. Deux endroits du code posent `strokeLinecap="square"` et `strokeLinejoin="miter"` — c'est-à-dire un trait qui s'arrête net et des angles francs — avec la raison écrite juste au-dessus : « Bouts et joints carrés, parce que le pinceau l'est » (Calque.tsx lignes 488-489, Tables.tsx lignes 1963-1964). Tous les jeux d'icônes libres sérieux dessinent au bout rond. C'est le vrai critère de tri, et il n'en laisse qu'un debout.

Je recommande Lucide, pour une raison que j'ai lue dans sa source et pas dans sa documentation : c'est le seul de la liste dont on peut écraser le bout de trait. Les autres jeux à trait (Tabler, Heroicons contour) l'imposent ; les jeux remplis (Phosphor, Radix, Remix, Material) n'ont pas de trait du tout, donc rien à accorder au pinceau du produit.

Un dernier point de mesure, parce qu'il commande toutes les tailles : le trait de Lucide n'est pas fixe, il suit la taille de rendu. À 12 pixels il vaut exactement 1 pixel — la même épaisseur que la bordure du châssis. À 24 pixels, exactement 2. À 14, 15, 16 ou 18, il tombe entre deux pixels et devient flou. Ce produit n'a donc que deux tailles d'icône possibles, et 16 px — la valeur que tout le monde emploie par réflexe — n'en fait pas partie.

Enfin, le point le plus urgent n'a rien à voir avec le choix du jeu : les trois croix de fermeture actuelles n'ont aucune taille de cible. Celle de la fiche (Fiche.tsx lignes 174-181) n'a ni largeur, ni hauteur, ni marge intérieure, et hérite d'un texte de 9,5 px. Sa zone cliquable fait environ 10 sur 14 pixels, contre les 24 sur 24 qu'exige la norme d'accessibilité en vigueur depuis juin 2025.

### Ce que tout le monde fait, et que l’utilisateur attend

- Livrer un composant React par icône, que l'outil de construction puisse écarter tout le reste. Lucide (2 057 fichiers séparés) et Tabler (6 186) le font ; Material Symbols ne fournit aucun composant React officiel — c'est une police et des fichiers d'image, ce qui en fait le seul de la liste à ne pas cocher cette case.
- La couleur suit le texte, jamais une valeur écrite dans l'icône. Tous les jeux comparés emploient « currentColor », c'est-à-dire qu'ils prennent la couleur de leur voisinage. C'est ce qui permettrait à une icône de virer au cyan du produit au survol sans une ligne de plus.
- Une licence libre sans contrepartie. Vérifié pour chacun : Lucide en ISC, Phosphor / Radix / Tabler / Heroicons en MIT, Remix Icon et Material Symbols en Apache 2.0. Aucune ne demande d'attribution visible dans le produit.
- Une zone cliquable d'au moins 24 sur 24 pixels autour de chaque icône. Ce n'est plus une bonne pratique mais une exigence : critère 2.5.8 de la norme WCAG 2.2, niveau AA, rendu contraignant en Europe le 28 juin 2025. Les trois croix actuelles du produit ne l'atteignent pas.
- Une étiquette lue à voix haute sur chaque icône seule. Le produit le fait déjà correctement : j'ai compté 150 attributs d'accessibilité pour 252 boutons, et les trois croix existantes en ont toutes une (« Fermer la fiche », « Oublier … », « Retirer le rectangle … »).
- Une grille de dessin unique et déclarée. Lucide et Tabler dessinent sur 24 unités, Radix sur 15, Heroicons sur 24 / 20 / 16 selon le jeu, Phosphor sur 256, Material Symbols sur 960. Mélanger deux grilles dans un même produit donne des icônes qui n'ont pas le même poids optique côte à côte.

### Ce qui émerge en 2025-2026

- Lucide est devenu le choix par défaut, et l'écart est écrasant. Relevé au registre npm le 4 septembre 2026 : 97,8 millions de téléchargements par semaine, contre 5,5 pour Radix Icons, 4,1 pour Heroicons, 3,4 pour Phosphor, 3,1 pour Tabler, 0,83 pour Remix Icon, 0,57 pour Material Symbols. Sa dernière publication date du 3 septembre 2026, c'est-à-dire la veille de ce relevé.
- Les jeux « de marque » se figent quand leur produit parent ralentit. Radix Icons n'a pas été publié depuis le 14 novembre 2024, Heroicons depuis le 18 novembre 2024 — vingt-deux mois de silence pour les deux. Ce sont pourtant les deux jeux dont les spécifications conviennent le mieux à un outil dense. Pour un outil qu'on garde des années, c'est le critère qui tranche.
- Les axes variables se généralisent : Material Symbols expose la graisse, le remplissage, le contraste et la taille optique dans une seule police, et les fait varier en continu. Le contre-mouvement est tout aussi net, et c'est lui qui gagne : Lucide n'offre qu'une seule graisse et écrase le marché, quand Phosphor en offre six (fin, léger, normal, gras, plein, bicolore, soit 1 512 icônes × 6 = 9 072 fichiers) et Tabler deux.
- Le poids du paquet n'a plus de rapport avec ce qui arrive au navigateur. Les jeux livrent désormais un module par icône : 30,4 Mo décompressés chez Lucide, 63,0 chez Tabler, alors que j'ai mesuré 879 octets compressés pour dix-huit icônes réelles. Le chiffre affiché sur les comparatifs en ligne induit en erreur d'un facteur de plusieurs milliers.
- L'accessibilité de la zone cliquable est passée du conseil à l'obligation. Le critère des 24 sur 24 pixels est entré en vigueur en Europe le 28 juin 2025 avec la directive sur l'accessibilité. Une icône minuscule sans marge n'est plus un parti pris esthétique défendable, même dans un outil à un seul utilisateur.
- Le nombre d'icônes n'est plus un argument de vente. Les jeux les plus employés ne sont pas les plus fournis : Lucide en compte 1 799 nommées, Material Symbols 3 903, Tabler plus de 6 000 fichiers — et Radix, qui n'en a que 318, tenait encore 5,5 millions de téléchargements par semaine avant de se figer. Ce qui se vend est la cohérence, pas le catalogue.

### Là où la convention est fausse pour ce produit

- « Un fond sombre chaud » — c'est faux, et le brief se contredit lui-même : il écrit « presque noir et froid » deux phrases plus haut. La valeur du code (index.css) est un rouge de 11, un vert de 13, un bleu de 16 : la dominante est bleue, la teinte tourne autour de 210 degrés. C'est un fond franchement froid. Ça compte pour la décision : sur un fond froid, un trait de 1 pixel se détache déjà nettement ; il n'y a aucune raison de compenser par un trait plus gras, ce qui est le réflexe qu'on aurait sur un fond chaud.
- « Le produit n'a que trois signes dessinés » — j'ai compté, il en a une dizaine. Le chevron « › » apparaît 99 fois dans 23 des 34 composants, alors que design-motifs.md ligne 770 affirme qu'il « serait un quatrième glyphe », donc qu'il n'existe pas. S'y ajoutent le point plein et le point creux (Assistant.tsx ligne 1673, EcranReglages.tsx lignes 389 et 416), le coin plein qui marque un favori (Calque.tsx lignes 689 et 741, Fiche.tsx ligne 767), la coche (Assistant.tsx ligne 1641, PanneauReglages.tsx ligne 572), et 27 flèches. La vraie question n'est donc pas « faut-il des icônes » mais « faut-il continuer à en avoir dix qui ne se ressemblent pas ».
- « Prendre la taille standard de 16 pixels » — c'est précisément la mauvaise valeur ici. À 16 px, le trait de Lucide vaut 1,33 pixel : il tombe entre deux pixels de l'écran et devient laiteux. Les deux seules tailles justes pour ce jeu sont 12 et 24 pixels, où le trait vaut pile 1,00 et pile 2,00.
- « Plus de contraste, donc un trait plus épais » — l'inverse ici. Le texte du produit est à 10 pixels dans 375 endroits, la bordure du châssis fait 1 pixel, et le tiret qui porte une raison dans la barre d'outils fait 1 pixel de haut sur 2 de large (BarreOutils.tsx ligne 196). Une icône à trait de 1,33 pixel serait plus lourde que tout ce qui l'entoure et attirerait l'œil sans le mériter.
- « Le français est long, donc remplacer les mots par des icônes fait gagner de la place » — c'est le contresens le plus coûteux. J'ai mesuré 25 libellés du produit contre leur équivalent anglais usuel : +39,9 % de caractères au total, médiane à +50 %, et les verbes courts sont les pires (Enregistrer contre Save : +175 % ; Ajouter contre Add : +133 % ; Modifier contre Edit : +100 %). Pire, ces libellés sont en JetBrains Mono — une police à chasse fixe où chaque caractère occupe 0,6 fois la taille de police, sans aucun resserrement possible. « Désélectionner » fait donc 84 pixels à 10 px, contre 48 pour « Deselect ». Mais remplacer « Supprimer » (54 px) par une icône de 12 px dans une cible de 26 px ne gagne que 28 pixels — et coûte l'appariement mot-geste que Wiedenbeck montre nécessaire. Le vrai gain est ailleurs : icône + mot dans la zone qui ne bouge jamais (Exporter, Importer), et mot seul dans la zone qui n'apparaît qu'avec une sélection. Le seul candidat honnête au remplacement par une icône seule est « Désélectionner » : le geste le moins coûteux, le plus répété, et le plus long.
- « Aucun coin arrondi de confort » — le code en compte 224 : 210 à 2 pixels, 11 à 1 pixel, 3 à 3 pixels, plus 9 cercles complets. Les jetons de rayon existent d'ailleurs explicitement dans index.css (2, 3 et 4 pixels). Le rayon dessiné par Lucide (2 unités sur une grille de 24, soit 1 pixel une fois rendu à 12) est donc EN DESSOUS de ce que le produit s'autorise déjà. Ce n'est pas un obstacle, contrairement à ce que le brief laisse croire.
- « La recherche prouve qu'il faut toujours un libellé sous l'icône » — la littérature est en réalité partagée, et les billets qui l'affirment citent tous les mêmes deux ou trois sources sans leurs chiffres. Kacmar et Carey (1991) ne trouvent aucune différence significative de temps entre texte seul, icône seule et les deux. Les travaux récents de suivi du regard trouvent même que l'ajout de texte RALENTIT la recherche visuelle. Ce que la recherche établit solidement, c'est un gain sur le taux d'erreur et sur l'apprentissage des premiers jours — deux choses qui comptent peu pour un utilisateur unique et quotidien, sauf sur les gestes qui se paient.
- Radix Icons est le meilleur choix sur le papier et le pire en pratique. Sa grille de 15 pixels est exactement la densité de ce produit, et ses 318 icônes forment un jeu qu'on peut vraiment connaître. Mais : il n'a que 58 % de coordonnées entières (il est fait pour être rendu à 15 pixels pile, pas à 12), il n'a pas de trait du tout — donc il ne pourra jamais partager le bout carré de Calque.tsx —, et il n'a pas été publié depuis novembre 2024.

### Les recommandations

**Prendre Lucide, et l'habiller aux bouts carrés du produit dans un composant unique, comme index.css tient les couleurs en un seul endroit**

- *Pourquoi* : J'ai lu la source de lucide-react version 1.40.0 (fichier dist/esm/Icon.mjs) : les réglages qu'on passe à une icône sont appliqués EN DERNIER, après les réglages par défaut. Autrement dit, demander « bout carré, angle franc » écrase le « bout rond, angle rond » que Lucide pose d'origine (fichier defaultAttributes.mjs). C'est le seul jeu de la liste où c'est possible : Tabler et Heroicons-contour imposent leur bout rond, et Phosphor, Radix, Remix et Material Symbols n'ont pas de trait du tout — ce sont des formes pleines, il n'y a rien à régler. Le produit pourrait donc parler la même langue que son propre pinceau (Calque.tsx lignes 488-489). Limite honnête : les arrondis que Lucide DESSINE dans ses tracés (rayon de 2 unités sur une grille de 24, soit 1 pixel une fois rendu à 12) ne s'annulent par aucun réglage. Mais le produit s'autorise déjà 224 coins arrondis dans son code — 210 à 2 px, 11 à 1 px, 3 à 3 px — donc l'arrondi de Lucide reste sous ce que le châssis pratique.
- *Les valeurs* : strokeLinecap="square", strokeLinejoin="miter", color="currentColor". Paquet : lucide-react, licence ISC (libre, sans obligation).
- *Ce que ça coûte* : Un composant d'une vingtaine de lignes. Lucide fournit aussi un fournisseur de réglages global (LucideProvider) qui pose la taille, la couleur et l'épaisseur pour tout le produit, mais il ne couvre pas le bout de trait — d'où le composant maison.

**Deux tailles d'icône dans tout le produit, et pas une troisième : 12 pixels partout, 24 pixels pour les grands gestes**

- *Pourquoi* : Le trait de Lucide vaut 2 unités sur une grille de 24, et il rétrécit avec l'icône : le trait rendu vaut deux fois la taille divisée par 24. À 12 px cela donne exactement 1,00 pixel ; à 24 px, exactement 2,00. Entre les deux, on obtient 1,17 px à 14, 1,25 à 15, 1,33 à 16, 1,50 à 18 — des valeurs qui ne tombent pas sur un pixel de l'écran et qui rendent le trait laiteux. J'ai aussi compté les coordonnées du tracé de la corbeille de Lucide : 98 % sont des nombres entiers sur la grille de 24. À 12 px, tout retombe donc sur des demi-pixels francs. La taille de 16 px, que tout le monde prend par défaut, est précisément la mauvaise ici.
- *Les valeurs* : 12 px (trait rendu 1,00 px) et 24 px (trait 2,00 px). Interdites : 14, 15, 16, 18, 20 px.
- *Ce que ça coûte* : Aucun. C'est une contrainte à écrire, pas du code.

**Caler la taille sur le TEXTE de la rangée, jamais sur sa hauteur**

- *Pourquoi* : J'ai compté les hauteurs de contrôle dans le code : 131 rangées à 26 px, 40 à 24 px, 27 à 34 px, 12 à 44 px, 12 à 38 px, 4 à 30 px. Et les tailles de texte : 375 emplois à 10 px, 72 à 11 px. Le texte ne bouge donc quasiment pas d'une barre à l'autre, alors que la hauteur varie du simple au double. Si l'icône suivait la hauteur, elle serait deux fois plus grosse dans la barre d'outils que dans une rangée, pour dire la même chose. Détail de mesure : JetBrains Mono a une hauteur de majuscule de 0,73 fois la taille de police, soit 7,3 px quand le texte est à 10. La zone vivante d'une icône Lucide de 12 px fait 10 px (elle garde 1 px de marge de chaque côté). Le rapport est de 1,37 — l'icône domine légèrement la majuscule, ce qui est exactement ce qu'il faut pour qu'elle se repère sans écraser le mot.
- *Les valeurs* : Rangées 24 et 26 px, barre d'outils 38 px, rangée 34 px → icône 12 px. Zones vides et grands gestes 44 px → 24 px. En-tête de panneau 30 px (chassis.tsx ligne 226, texte de 9,5 px) → aucune icône.
- *Ce que ça coûte* : Aucun.

**Réparer d'abord les trois croix existantes : elles sont sous le seuil légal de zone cliquable**

- *Pourquoi* : C'est le point le plus urgent, et il ne dépend d'aucun choix de jeu d'icônes. La croix de fermeture de la fiche (Fiche.tsx lignes 174-181) n'a ni largeur, ni hauteur, ni marge intérieure ; elle vit dans un en-tête dont le texte fait 9,5 px. Sa zone cliquable mesure donc environ 10 sur 14 pixels. Celle du panneau d'import (Import.tsx lignes 237-244) n'a rien non plus. Celle de la découpe (Decoupe.tsx lignes 720-728) n'a qu'une marge horizontale d'un cran, rien en hauteur. La norme d'accessibilité WCAG 2.2, critère 2.5.8, exige 24 sur 24 pixels — et elle est devenue contraignante en Europe le 28 juin 2025 avec la directive sur l'accessibilité. Et le châssis étant volontairement muet (pas de relief, pas de cadre de rangée), la petitesse de la cible n'est compensée par aucun autre indice.
- *Les valeurs* : Une icône de 12 px demande 6 px de marge tout autour pour atteindre 24 px. Dans une rangée de 26 px, un carré de 26 sur 26 la couvre et déborde de 1 px.
- *Ce que ça coûte* : Trois classes à ajouter. Aucune hauteur nouvelle : le carré de 26 px tient exactement dans les rangées de 26 px que le produit emploie déjà 131 fois.

**Mot seul par défaut. Icône + mot uniquement sur ce qui se paie. Icône seule uniquement là où aucun mot ne tient**

- *Pourquoi* : La recherche n'est pas unanime là-dessus, et personne ne le dit. Wiedenbeck (1999) mesure l'apprentissage de novices sur quatre blocs par séance : les meilleures performances sont sur « libellé seul » ET sur « icône + libellé » à égalité — c'est l'icône SEULE qui perd. Egido et Patterson (1988) trouvent que la meilleure performance demande les deux ensemble. Mais Kacmar et Carey (1991) ne trouvent AUCUNE différence significative de temps de sélection entre les trois formats. Et les travaux récents de suivi du regard (revue Displays, 2022 et 2024) trouvent que l'ajout de texte est corrélé NÉGATIVEMENT à la vitesse de recherche visuelle, avec très peu d'écart entre « texte seul » et « icône + texte » — ce qui compte vraiment étant la familiarité de l'icône, pas sa présence. Synthèse honnête : le gain de l'icône + mot n'est pas en vitesse, il est en TAUX D'ERREUR et en apprentissage des premiers jours. Pour un outil à un seul utilisateur qui s'en sert quotidiennement, l'apprentissage est amorti en une semaine ; il ne reste que l'erreur sur les gestes coûteux. Ici, le geste coûteux est littéral : Générer paie un appel à un modèle d'image, et Supprimer est irréversible.
- *Les valeurs* : Icône + mot : Générer, Supprimer, Exporter, Importer. Mot seul : tout le reste, c'est-à-dire l'état actuel. Icône seule : la croix de fermeture, les chevrons de navigation, et la poignée de saisie — soit les cas que design-motifs.md ligne 1276 borne déjà (« un glyphe n'entre que là où aucun mot ne peut tenir »).
- *Ce que ça coûte* : Aucun code en plus — c'est une règle de tri.

**Plafonner le jeu à vingt icônes, et écrire la règle d'admission**

- *Pourquoi* : J'ai relevé 52 étiquettes d'accessibilité distinctes dans les composants, mais la plupart nomment des champs de saisie, pas des gestes. En les triant, il reste environ 18 verbes : fermer, ajouter, supprimer, exporter, importer, ranger, favori, chercher, approcher, reculer, retailler, télécharger, réglages, sommaire, aperçu, générer, relancer, annuler. La littérature d'ergonomie prend douze éléments comme taille de palette représentative des produits du marché — c'est l'ordre de grandeur d'un jeu qu'on retient sans l'apprendre. Au-delà, ce qui limite n'est pas la place ni le poids mais la mémoire : les travaux de suivi du regard cités plus haut montrent que la performance suit la familiarité de chaque icône, et la familiarité se dilue avec le nombre. Contrainte propre à ce produit : un seul utilisateur, pas de collègue pour lui rappeler ce que veut dire la vingt-cinquième.
- *Les valeurs* : 18 verbes recensés aujourd'hui, plafond à 20. Formule proposée : « une icône n'entre que si elle nomme un geste qui existe déjà sous forme de mot ailleurs dans le produit, et le jeu ne dépasse jamais vingt ».
- *Ce que ça coûte* : Aucun. Une phrase à ajouter dans le journal de design, dans la forme de celle qui existe déjà.

**Ne pas croire le poids affiché du paquet : j'ai mesuré ce qui part vraiment**

- *Pourquoi* : Le paquet Lucide fait 30,4 méga-octets une fois décompressé, ce qui semble disqualifiant. Mais il livre un fichier par icône — 2 057 fichiers séparés — et l'outil de construction ne garde que ce qu'on emploie. J'ai téléchargé les tracés de 18 icônes représentatives et je les ai compressés : 4 074 octets bruts, 879 octets une fois compressés, soit 49 octets par icône. En ajoutant le petit composant commun, le budget réel tourne autour de 2 kilo-octets. C'est moins que le fichier index.css du produit.
- *Les valeurs* : 18 icônes = 879 octets compressés. Le paquet décompressé (30,4 Mo) ne part jamais au navigateur.
- *Ce que ça coûte* : Néant.

### Les sources

- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/index.css — les jetons de couleur et de rayon (fond #0b0d10, accent #49b3ce, rayons 2/3/4 px), 293 lignes
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Calque.tsx lignes 488-489 — strokeLinecap="square" strokeLinejoin="miter"
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Tables.tsx lignes 1954-1964 — « Bouts et joints carrés (U11), parce que le pinceau l'est »
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Fiche.tsx lignes 174-181 — croix de fermeture sans aucune taille ni marge
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Import.tsx lignes 237-244 — croix sans taille
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Decoupe.tsx lignes 720-728 — croix avec marge horizontale seule
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/chassis.tsx ligne 226 — en-tête de panneau, 30 px de haut, texte de 9,5 px
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/BarreOutils.tsx lignes 99-108 (mesure du débordement à 1280 px), 153-173 (libellés en mono), 196 (tiret de raison), 236 (Supprimer), 260-266 (Exporter et Importer ancrés à droite)
- C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/BarreChassis.tsx lignes 383-395 — les trois onglets de lieu, rangée de 26 px
- C:/STOCKAGE/PROJET/_DEV/gag2/docs/DESIGN.md ligne 36 (« aucune icône illustrative, aucun coin arrondi de confort ») et ligne 48 (« Les trois glyphes du produit restent trois »)
- C:/STOCKAGE/PROJET/_DEV/gag2/docs/design-motifs.md ligne 286 (« Le libellé est la cible — aucun glyphe neuf »), ligne 770 (« Un chevron serait un quatrième glyphe »), ligne 1276 (la règle d'admission d'un glyphe)
- Comptages faits par moi sur les 34 composants (essais exclus) : 5 balises SVG en tout et aucune n'est une icône ; 252 boutons ; 150 étiquettes d'accessibilité, dont 52 littéraux distincts ; 99 chevrons dans 23 fichiers ; 131 rangées de 26 px, 40 de 24, 27 de 34, 12 de 44, 12 de 38, 4 de 30 ; 375 textes de 10 px et 72 de 11 px ; 224 coins arrondis ; 667 emplois de la classe monospace
- Registre npm, relevé du 4 septembre 2026 — versions, licences, tailles décompressées et téléchargements hebdomadaires des sept jeux comparés
- Interface de listage jsDelivr — comptage des fichiers par jeu : Lucide 2 057 modules (1 799 icônes nommées d'après tags.json), Tabler 6 186, Phosphor 1 512 icônes en 6 graisses, Radix 318 composants sur grille 15, Heroicons 324 icônes en 4 jeux, Remix Icon 1 538 en contour et 1 538 en plein, Material Symbols 3 903 noms
- Sources SVG téléchargées et analysées une par une : grilles de dessin (24, 15, 16, 20, 256, 960 unités), épaisseurs de trait déclarées (2 pour Lucide et Tabler, 1,5 pour Heroicons-contour), bouts et joints, et proportion de coordonnées entières (98 % chez Lucide, 100 % chez Tabler, 58 % chez Radix)
- Source lue de lucide-react 1.40.0 : dist/esm/Icon.mjs (les réglages passés à l'icône sont appliqués en dernier), defaultAttributes.mjs (bouts et joints ronds par défaut), context.mjs (le fournisseur global LucideProvider)
- Mesure de poids faite par moi : 18 tracés d'icônes Lucide, 4 074 octets bruts, 879 une fois compressés
- https://lucide.dev/contribute/icon-design-guide — grille de 24 pixels, marge d'au moins 1 pixel, trait de 2 pixels, bouts et joints ronds, tracés centrés, 2 pixels entre éléments distincts
- Wiedenbeck S. (1999), « The use of icons and labels in an end user application program: an empirical study of learning and retention », Behaviour & Information Technology 18(2), 68-82 — https://www.tandfonline.com/doi/abs/10.1080/014492999119129
- Egido & Patterson (1988) et Kacmar & Carey (1991), cités dans la revue de littérature de l'étude d'oculométrie ci-dessous
- « Influence mechanism of icon semantics on visual search performance: Evidence from an eye-tracking study », Displays, 2022 — https://www.sciencedirect.com/science/article/abs/pii/S0169814122001433
- « Semantic distance of icons: Impact on user cognitive performance and a new model for semantic distance classification », Displays, 2024 — https://www.sciencedirect.com/science/article/abs/pii/S0169814124000660
- WCAG 2.2, critère de succès 2.5.8 « Target Size (Minimum) », niveau AA — 24 sur 24 pixels CSS, contraignant en Europe depuis le 28 juin 2025 : https://www.digitala11y.com/understanding-sc-2-5-8-target-size-minimum/
- Mesure d'expansion du français faite par moi sur 25 paires de libellés réellement présents dans BarreOutils.tsx, BarreChassis.tsx et Fiche.tsx, comparés à leur équivalent anglais usuel : +39,9 % de caractères au total, médiane +50 %

---

<a id="sondage-5"></a>

## 11 · Le dévoilement progressif dans l'atelier : un mécanisme juste, appliqué six fois, et quatre contrôles qui n'existent qu'à la souris

Le produit a construit le bon mécanisme et ne s'en sert presque pas. Le bloc repliable existe (chassis.tsx:448) avec sa règle « un bloc replié porte sa valeur » — et cette règle est tenue 7 fois sur 7 : tous les appels passent bien un résumé. Mais il n'y a que 7 appels, soit 4 blocs distincts, plus 2 replis simples (App.tsx:484, ChampPrompt.tsx:169). Six choses repliables dans un produit qui compte 259 boutons, 51 champs, 16 listes et 13 zones de texte. Les trois panneaux les plus chargés n'en ont aucun : Assistant 47 contrôles, Personnages 43, Places 29. L'exemple phare du document de motifs (Détourage / Recadrage / Grille / Quantification, design-motifs.md:754-758) n'existe pas dans le code : ces réglages vivent dans BarreChassis.tsx, Places.tsx et Tables.tsx, où l'on ne trouve ni un `<Bloc>` ni un `usePli`. Et `ouvrirPli` — le geste « qui implique de voir », c'est-à-dire exactement le rattrapage d'un contrôle caché — est exporté (chassis.tsx:415) et jamais appelé, ni dans le produit ni dans les essais. Le vrai défaut n'est donc pas qu'on cache trop : c'est qu'on cache mal aux quatre endroits où l'on cache. Quatre contrôles n'apparaissent qu'au survol, et un seul (Toile.tsx:2774) reparaît au clavier. Deux d'entre eux — le × qui vide une case et le coin qui marque un favori, Personnages.tsx:2428 et 2666 — utilisent `hidden`, c'est-à-dire `display:none` : ils sortent de l'ordre de tabulation et de l'arbre d'accessibilité. Marquer une image favorite est donc, aujourd'hui, un geste que seule la souris peut faire. Le troisième (Arbre.tsx:262) est focalisable et reçoit bien le contour cyan de index.css:193, mais son glyphe reste transparent : au clavier on obtient un cadre vide de 12 px. Côté découvrabilité, le recueil compte 135 entrées dont 98 sont accrochées à un contrôle ; les 37 autres (27 %) ne s'atteignent que par le Guide — qui n'a aucun champ de recherche. Il n'y a pas de palette de commandes, et les quatre raccourcis existants (Ctrl+Z, Ctrl+Entrée, Espace pour l'aperçu, ? pour le Guide) ne sont écrits nulle part dans l'interface au repos.

### Ce que tout le monde fait, et que l’utilisateur attend

- Un contrôle qui agit doit rester atteignable au clavier et visible quand il reçoit le focus. Aujourd'hui, `focus-visible` n'apparaît qu'une seule fois dans tout le produit (Toile.tsx:2774), et deux contrôles réels sont hors de portée du clavier (Personnages.tsx:2428 et 2666, `hidden group-hover:block` = `display:none`).
- Un bloc replié montre sa valeur courante à droite de son titre. C'est la règle du produit (design-motifs.md:747) et elle est réellement tenue partout où le bloc est employé — 7 appels sur 7 passent `etat` (Fiche.tsx:360, 469, 649, 674, 684, 989 ; PanneauReglages.tsx:168). C'est le seul motif du document que le code applique à 100 %.
- Deux niveaux de dévoilement, jamais trois. Au-delà de deux, l'utilisabilité s'effondre parce que les gens se perdent en passant d'un niveau à l'autre (NN/g). Le produit respecte cette limite : aucun bloc repliable n'en contient un autre.
- Un moyen de chercher un réglage par son nom. C'est ce qui manque : le Guide rend 135 entrées à la file sans champ de recherche, et 37 d'entre elles n'existent que là.
- Une sélection ajoute des gestes, elle n'en retire jamais. Tenu, et bien tenu : BarreOutils.tsx:207 fait paraître quatre gestes de plus quand on sélectionne, sans toucher au filtre ni à la recherche — le commentaire des lignes 128 à 132 dit pourquoi.
- Un raccourci non écrit à l'écran n'existe pas. Quatre raccourcis vivent dans le produit — Ctrl+Z (Tables.tsx:1426, Toile.tsx:1223), Ctrl+Entrée (ChampPrompt.tsx:175), Espace pour l'aperçu (Apercu.tsx:251), ? pour le Guide (App.tsx:598) — et aucun ne se lit dans l'interface au repos. Le mot « Espace » n'apparaît même pas une fois dans les 135 entrées d'aide.

### Ce qui émerge en 2025-2026

- Le repli qui résume est devenu la norme et non plus un raffinement : iOS et macOS mettent la valeur en gris à droite de chaque rangée de réglage, Figma laisse la valeur visible en permanence dans son panneau de droite et ne replie que les sections vides (qui deviennent une rangée « + »), Linear et Stripe font pareil. Le produit est déjà là-dessus, en avance sur son propre code.
- Recul net du survol comme seul chemin. Depuis WCAG 2.1 (critères 2.1.1 Clavier et 1.4.13 Contenu au survol ou au focus) et la généralisation des écrans tactiles sur les portables, révéler uniquement au pointeur est traité comme un défaut à corriger, pas comme une finesse. GitHub, GitLab et Linear ont rendu permanents des boutons de ligne qui étaient au survol.
- La recherche dans les réglages est devenue obligatoire partout où il y a plus d'une trentaine de réglages : macOS, Windows, Chrome, VS Code. C'est la réponse admise à « je sais que ça existe, je ne sais pas où ».
- La palette de commandes s'est généralisée (VS Code, Linear, Notion, GitHub, Slack, Raycast) — mais toujours accompagnée d'une pastille « ⌘K » visible dans le champ de recherche. Personne ne livre plus le raccourci nu, précisément parce qu'il ne se découvre pas.
- Les barres contextuelles flottantes remplacent les menus cachés : Notion, Figma et Linear font paraître une barre au-dessus de la sélection plutôt que d'attendre un clic droit. Le produit fait déjà ça avec BarreOutils.tsx:207, en version fixe.
- Retour de l'aplatissement pour les outils d'expert. Le travail de référence (CommandMaps, prix du meilleur article à CHI 2012) montre qu'une disposition plate où tout est visible d'un coup bat significativement le Ribbon et les menus chez les gens expérimentés, sans rien coûter aux débutants. Pour un outil à un seul utilisateur qui est l'auteur, c'est le résultat le plus directement applicable.

### Là où la convention est fausse pour ce produit

- Le dévoilement progressif a été inventé pour l'apprentissage, et il n'y a rien à apprendre ici. L'étude fondatrice (Carroll et Carrithers, 1984) bridait un traitement de texte pour des débutants : le groupe témoin passait près d'un quart de son temps à sortir d'erreurs que l'interface bridée rendait inatteignables. Le résultat est solide et il ne s'applique pas. L'unique utilisateur de cet atelier en est l'auteur — il a écrit les 135 entrées d'aide et les 35 composants. Il n'y a pas de novice à protéger, pas de courbe d'apprentissage à lisser. Le seul argument qui survit est la place à l'écran, et c'est un argument beaucoup plus faible.
- Le résultat de recherche le plus pertinent pour ce produit dit l'inverse de la convention. CommandMaps (Scarr, Cockburn, Gutwin et Bunt, CHI 2012, prix du meilleur article) compare une disposition plate où tout est visible d'un coup au Ribbon et aux menus : pour les gens expérimentés, la disposition plate est significativement plus rapide que les deux ; pour les débutants, elle ne coûte rien. Un outil à un seul utilisateur expérimenté sur écran large est le cas exact où l'aplatissement gagne. NN/g dit la même chose autrement pour les accordéons : quand tout le contenu sert, sur un écran large, défiler coûte moins cher que décider quel en-tête ouvrir.
- La base de preuves est plus mince qu'on ne le dit. Carroll et Rosson concluaient dès 1997 qu'il n'existe pas de preuve empirique de l'efficacité du dévoilement progressif ; l'essentiel du corpus est fait d'études de cas et d'expérience de praticien. Ce n'est pas une raison de ne rien replier — c'est une raison de ne pas invoquer « la recherche » pour cacher un contrôle qu'on cache en réalité pour gagner de la place.
- Le mode expert suppose un expert que presque personne ne devient. Alan Cooper a nommé ça les « éternels intermédiaires » (About Face, 1995) : la plupart des gens apprennent juste assez pour travailler, puis s'arrêtent. La conséquence pratique ici est particulière et exigeante : l'auteur ne sera pas expert de son propre produit trois mois après avoir écrit un écran. Le dévoilement doit donc résister à son propre oubli — ce qui est exactement le métier du résumé à droite du titre, et exactement ce que le survol seul ne fait pas.
- Ce qui coûte de l'argent ne relève pas de l'arbitrage esthétique. Toute la littérature sur le dévoilement raisonne en clics et en confusion. Ici la mauvaise unité est l'euro : un réglage replié qui change ce qui part chez le fournisseur est une facture qu'on ne voit pas. C'est un critère que la convention ne fournit pas et que ce produit doit poser lui-même — il l'a d'ailleurs déjà à moitié posé, dans le champ `change` obligatoire du recueil.
- « On n'a aucune mesure d'usage » n'est pas tout à fait vrai, et c'est utilisable. Le produit tient un journal de dépenses (Depenses.tsx, 34 ko) et le Codex garde ce qui a été fabriqué. La fréquence à laquelle un réglage a réellement été changé — et non la fréquence supposée — est déductible des générations passées. Avant d'appliquer des heuristiques à l'aveugle, il vaut la peine de vérifier ce que ces données savent déjà.

### Les recommandations

**Interdire le survol comme unique chemin vers un contrôle, et écrire la règle en trois termes : visible si survolé, OU choisi, OU au focus clavier. Le dépôt contient déjà l'écriture correcte, à un seul endroit — Tableau.tsx:857, `const ouvert = choisie || survolee` : le menu d'une carte paraît au survol ou quand la carte est sélectionnée, et la sélection passe par un vrai bouton (Tableau.tsx:939), donc elle est atteignable au clavier. Il ne reste qu'à généraliser cette ligne aux trois cas fautifs.**

- *Pourquoi* : Trois contrôles réels sont aujourd'hui inaccessibles ou invisibles au clavier. Personnages.tsx:2428 (le × qui vide une case) et Personnages.tsx:2666 (le coin qui marque une image favorite) utilisent `hidden group-hover:block` ; `hidden` vaut `display:none`, ce qui retire l'élément de l'ordre de tabulation ET de l'arbre d'accessibilité. Conséquence directe et vérifiable : on peut retirer une marque de favori au clavier — le coin est visible quand l'image est déjà favorite — mais on ne peut pas en poser une. Arbre.tsx:262 (le × qui supprime une entrée) est mieux loti : c'est un bouton, il reste focalisable, et le contour cyan de 2 px posé par index.css:193 l'entoure bien. Mais son `text-transparent` n'est jamais annulé au focus : on obtient un cadre vide de 12 px de large, sans glyphe dedans. Un seul des quatre cas est correct — Toile.tsx:2774, qui écrit `opacity-0 group-hover:opacity-100 focus-visible:opacity-100`. Un contrôle qui n'apparaît qu'au survol échoue à trois titres cumulés : on ne sait pas qu'il existe, on ne peut pas le chercher des yeux puisque la recherche visuelle exige que la cible soit rendue, et il sort du clavier. C'est la définition même d'un échec au critère WCAG 2.1.1.
- *Les valeurs* : Remplacer `hidden group-hover:block` par `opacity-0 group-hover:opacity-100 focus-visible:opacity-100` : l'opacité garde l'élément dans le flux, la tabulation et l'arbre d'accessibilité, là où `display:none` l'en sort. Pour Arbre.tsx:262, ajouter `focus-visible:text-texte-3` à côté de `group-hover:text-texte-3`. Transition 80 ms, celle du produit (index.css et duration-[80ms] partout). Contour de focus déjà posé globalement : `outline: 2px solid var(--color-signal)` avec `outline-offset: 1px` (index.css:193-196), aucun token neuf.
- *Ce que ça coûte* : Six lignes modifiées dans trois fichiers, aucun glyphe neuf, aucune hauteur neuve. Le seul effet visible : sur une tuile non favorite, le coin gris occupe désormais 14 px avec une opacité de 0 au lieu de ne pas être rendu — donc rien à l'œil, mais un arrêt de plus dans la tabulation par tuile.

**Poser un plafond au résumé d'un bloc replié, et le faire respecter : si la valeur ne tient pas dans ce plafond, ce n'est pas une valeur, c'est un contenu — et le bloc ne doit pas se replier. Le cas à corriger est `fiche.prompt` (Fiche.tsx:684-692), dont l'`etat` est le prompt entier.**

- *Pourquoi* : La règle du produit dit qu'un panneau plié doit se lire mieux que déplié (design-motifs.md:751). Elle tient pour « Modèle », dont l'`etat` est un nom (PanneauReglages.tsx:172). Elle ne tient pas pour le texte d'une image : `Valeur` (chassis.tsx:414-427) coupe à `max-w-[60%]` en mono 9,5 px, et le bloc ouvert affiche par ailleurs la longueur réelle (`${parti.length} signes`, Fiche.tsx:691) — le code sait donc lui-même que le texte est long. Replié, on lit le début d'une phrase ; ce n'est pas un résumé, c'est un contenu tronqué. Le repli redevient là ce que la règle interdit : un rangement.
- *Les valeurs* : Calcul du plafond réel dans la fiche : panneau 380 px (Fiche.tsx:170), padding `p-2` soit 8 px de chaque côté → 364 px utiles ; `max-w-[60%]` → 218 px ; moins le `pl-2` du résumé → 210 px. JetBrains Mono à 9,5 px avance 0,6 em, soit 5,7 px par signe → environ 36 signes. Dans un panneau de 280 px la même formule donne environ 26 signes. Règle à écrire : un `etat` de plus de 36 signes est un défaut, pas une troncature. Pour le prompt, mettre un fait qui tient — « 412 signes » — ou les trois premiers mots suivis du compte.
- *Ce que ça coûte* : Une ligne dans Fiche.tsx, et une phrase dans le document de motifs. Perte assumée : replié, on ne lit plus le début du prompt. C'est le prix de la règle, et il est petit — le bloc s'ouvre d'un clic, et son ouverture est le seul endroit où le texte entier est lisible de toute façon.

**Trancher ce qui est avancé par la conséquence, jamais par la fréquence supposée — et se servir du critère que le produit a déjà écrit. Chaque entrée du recueil porte un champ `change` obligatoire (aide.ts:53-55), dont la valeur « Rien à la génération. » est explicitement admise comme réponse. C'est une classification déjà rédigée, 135 fois, et jamais exploitée.**

- *Pourquoi* : Sans mesure d'usage, la fréquence n'est pas devinable — et il faut se méfier de l'idée qu'elle le serait avec des mesures. Microsoft a publié sa télémétrie de Word 2003 : les cinq commandes de tête représentent environ 32 % de tous les usages, coller à lui seul plus de 11 %, mais surtout l'écart d'usage entre la 100e commande et la 400e est du même ordre que celui entre la 1re et la 11e. Autrement dit, la queue est plate : passé une dizaine de commandes, classer par fréquence ne discrimine plus rien, même quand on mesure. Un classement par fréquence deviné à l'aveugle est donc pire que de ne rien classer. La conséquence, elle, est connaissable sans mesure : soit un réglage change ce qui part chez le fournisseur, soit non. Et le produit, qui dépense de l'argent réel, a un troisième critère que la littérature générale n'a pas — la réversibilité au sens strict : est-ce qu'annuler ce geste coûte un nouvel appel payé ?
- *Les valeurs* : Trois questions, dans cet ordre. Un : est-ce que ce réglage change ce qui part chez le fournisseur ? Si oui, il ne se replie jamais — c'est de l'argent, pas du confort. La réponse est déjà écrite dans le champ `change` de son entrée d'aide. Deux : est-ce que revenir en arrière coûte un appel payé ? Si oui, il ne se replie jamais. Trois : est-ce qu'il a un défaut qui convient dans la grande majorité des cas ? Si oui, il se replie AVEC sa valeur. Un réglage qui ne passe aucune des trois questions n'est pas avancé, il est superflu — c'est la seule conclusion que ce tri autorise à tirer, et elle est utile.
- *Ce que ça coûte* : Un passage sur les 135 entrées de aide.ts pour lire leur champ `change` et en déduire le tri. Le champ existe déjà et est obligatoire, donc il n'y a rien à rédiger. Risque réel : le champ `change` a été écrit pour expliquer, pas pour classer ; quelques entrées diront « Rien à la génération » pour un réglage qu'on veut pourtant voir. Il faut lire, pas appliquer mécaniquement.

**Mettre un champ de recherche dans le Guide. C'est la seule correction de découvrabilité que les chiffres du dépôt réclament vraiment, et elle passe avant toute idée de palette de commandes.**

- *Pourquoi* : Le recueil compte 135 entrées. 98 sont accrochées à un contrôle par un attribut `aide` ; les 37 autres — soit 27 % — n'existent que dans le Guide. Parmi elles : les sept champs de la bible (`bible.monde`, `bible.epoque`, `bible.trait`, `bible.rendu`, `bible.eclairage`, `bible.technique`, `bible.vue`), les huit étapes de traitement (`etape.detourage`, `etape.grille`, `etape.quantification`, `etape.recadrage`, `etape.contours`, `etape.bords`, `etape.main`), et trois entrées du barème. Or le Guide n'a aucun champ de recherche : `grep` sur Guide.tsx ne trouve ni « Chercher » ni `<input>`. Ces 135 entrées se lisent à la file, et le seul index disponible est le Ctrl+F du navigateur. C'est le point où un contrôle caché devient réellement un contrôle qu'on ne trouve pas — pas au survol d'une tuile, mais dans un texte de référence sans porte d'entrée.
- *Les valeurs* : Un `<input>` de 26 px (la hauteur de contrôle la plus basse du produit, celle de BarreOutils), en JetBrains Mono 11 px, `border-bord`, `bg-fond-2`, placeholder « Chercher un réglage » — exactement le champ de BarreOutils.tsx:135, recopié. Filtrage sur `nom` et `quoi` en minuscules sans accents. Aucun token, aucune hauteur, aucun glyphe neuf.
- *Ce que ça coûte* : Une quinzaine de lignes dans Guide.tsx. Effet de bord à surveiller : le Guide s'ouvre parfois sur une ancre (`ouvrirGuide(cle)`, Guide.tsx:38), donc le filtre doit se vider quand une ancre est demandée, sinon on filtre l'entrée vers laquelle on vient de sauter.

**Utiliser `ouvrirPli`, ou le retirer. Il est exporté depuis chassis.tsx:415 avec un commentaire qui dit son métier — « ouvrir un pli sans le basculer, pour le geste qui implique de voir » — et il n'est appelé nulle part : ni dans le produit, ni dans les essais (0 occurrence dans App.test.tsx, où `toutReplier` en compte 42).**

- *Pourquoi* : C'est précisément le mécanisme qui rattrape un contrôle caché, et c'est le seul du dépôt. Deux emplois évidents l'attendent. Premier : un refus qui vise un réglage replié doit ouvrir ce réglage — sinon la fente de refus dit « la quantification demande une palette » pendant que le bloc Quantification reste fermé, et l'auteur lit une raison sans voir la chose. Second : le lien « Le guide › » d'une infobulle fait le trajet dans un sens (du réglage vers l'explication) ; le trajet inverse, du Guide vers le réglage, n'existe pas. Tant que la fonction dort, le châssis fait croire que le produit sait ouvrir un bloc à bon escient. Il ne le sait pas.
- *Les valeurs* : Rien à inventer : la fonction existe, sa signature est `ouvrirPli(cle: string)`, et les clés sont déjà stables (`fiche.impose`, `fiche.prompt`, `fiche.filiation`, `reglages.modele`, `barre.reglages`, `prompt.negatif`).
- *Ce que ça coûte* : Deux appels, ou une suppression de trois lignes. Si le choix est de supprimer, il faut le dire dans le journal des décisions — sinon quelqu'un la réécrira dans six mois.

**Renommer le `Bloc` local de Depenses.tsx. Il porte le même nom que le bloc repliable du châssis et ne se replie pas : c'est un titre en majuscules au-dessus d'un div (Depenses.tsx:827-836), employé trois fois (lignes 716, 730, 757).**

- *Pourquoi* : Les trois appels de Depenses.tsx ressemblent à s'y méprendre à des blocs repliables auxquels on aurait oublié de passer `cle` et `etat` — `<Bloc titre="Ce qui est revenu">`. Un lecteur qui vient de PanneauReglages.tsx ou de Fiche.tsx lira ces trois lignes comme un oubli et corrigera dans le mauvais sens. Le fichier n'importe d'ailleurs pas `Bloc` du châssis (Depenses.tsx:41 n'importe que `EnTetePanneau`), donc rien ne casse aujourd'hui — c'est un piège de lecture, pas un défaut de rendu, et c'est exactement le genre que le dépôt attrape ailleurs.
- *Les valeurs* : `Rubrique` ou `Section` : deux noms libres dans le dépôt, et tous deux disent ce que la chose fait — un titre au-dessus d'un contenu, sans état.
- *Ce que ça coûte* : Quatre lignes dans un seul fichier.

**Ne pas ajouter de palette de commandes. C'est la recommandation la moins attendue et c'est la plus solide au vu des chiffres.**

- *Pourquoi* : Une palette répond à la question « quel est le nom de la commande que je veux ». Ce n'est pas la question que pose ce produit. Il n'y a pas de commandes à lancer par leur nom : il y a des réglages qu'on pose, et un geste qui coûte de l'argent. Le vrai manque mesuré ici est un index dans 135 explications, pas une liste d'actions — et une palette ne l'aurait pas comblé, elle aurait ajouté un second endroit où chercher, avec un vocabulaire différent de celui du recueil. Surtout, la palette déplace le problème plutôt qu'elle ne le résout : elle est elle-même invisible. Le produit en fait déjà la démonstration involontaire avec l'aperçu — on vise une image au survol (Apercu.tsx:225) puis on presse Espace (Apercu.tsx:251), et ce raccourci n'est écrit qu'à un seul endroit du produit, dans le Guide (Guide.tsx:311). Le mot « Espace » n'apparaît pas une seule fois dans les 135 entrées d'aide. Une fois l'aperçu ouvert, il s'enseigne lui-même (« Espace ou Échap · fermer », Apercu.tsx:438 et 546) — mais il fallait déjà savoir pour l'ouvrir. Ajouter ⌘K reviendrait à créer un cinquième raccourci non écrit.
- *Les valeurs* : Si l'idée revient malgré tout, la seule forme défendable est une pastille « ⌘K » en mono 9,5 px, `--texte-3`, posée dans le champ « Chercher » de BarreOutils.tsx:135 — et la palette doit chercher dans le recueil d'aide, pas dans une liste de commandes séparée. Sinon elle crée un second vocabulaire, ce que la règle « un seul corpus » interdit déjà (aide.ts:1-8).
- *Ce que ça coûte* : Zéro : c'est une décision de ne pas construire. Le coût est de renoncer au réflexe.

### Les sources

- Code du dépôt — le bloc repliable et son registre global : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/chassis.tsx:305-517 (EnTeteDeSection, ouverts/abonnes, toutReplier:381, usePli:410, ouvrirPli:415, Valeur:414-427, Bloc:448)
- Code du dépôt — les 7 appels de Bloc : Fiche.tsx:360, 469, 649, 674, 684, 989 ; PanneauReglages.tsx:168. Les 2 usePli : App.tsx:484, ChampPrompt.tsx:169
- Code du dépôt — les 4 révélations au survol : Arbre.tsx:250 et 262, Personnages.tsx:2428 et 2666, Toile.tsx:2774 (le seul avec focus-visible)
- Code du dépôt — le contour de focus global : interface/src/index.css:193-196
- Code du dépôt — le bon motif, appliqué une seule fois : Tableau.tsx:857 (`const ouvert = choisie || survolee`) et Tableau.tsx:939 (le bouton de la carte, atteignable au clavier)
- Code du dépôt — la barre contextuelle qui ajoute sans retirer : BarreOutils.tsx:128-132 (le commentaire) et 207 (la condition sur la sélection)
- Code du dépôt — l'aperçu au survol puis Espace : Apercu.tsx:225 (useVisee), 251 (useApercu), 438 et 546 (l'aide affichée une fois ouvert) ; enseigné une seule fois au repos, Guide.tsx:311
- Code du dépôt — le recueil et le Guide sans recherche : aide.ts (135 entrées, champ `change` obligatoire lignes 53-55), Guide.tsx (aucun <input>)
- Code du dépôt — le nom en double : Depenses.tsx:827 (Bloc local non repliable) contre chassis.tsx:448
- Code du dépôt — l'assistant, seul vrai dévoilement par étapes : Assistant.tsx:132-162 (12 étapes, 4 groupes)
- Document du dépôt — la règle et son exemple introuvable : docs/design-motifs.md:741-758 ; le coût déjà reconnu par l'auteur : docs/design-decisions.md ligne 48 (« l'affordance tient au survol et à la couleur de la valeur »)
- Comptages faits pour cette réponse : 259 <button>, 51 <input>, 16 <select>, 13 <textarea>, 20 <Bouton>, 36 <Segments>, 17 <Curseur> hors essais ; densité par panneau — Assistant 47 contrôles / 0 repli, Personnages 43 / 0, Places 29 / 0, Fiche 26 / 6, Superposition 24 / 0, Tables 22 / 0 ; recueil — 135 entrées, 98 ancrées, 37 orphelines, 0 ancre sans entrée
- Nielsen Norman Group, « Progressive Disclosure » — améliore 3 des 5 composantes de l'utilisabilité ; au-delà de 2 niveaux, l'utilisabilité s'effondre : https://www.nngroup.com/articles/progressive-disclosure/
- Nielsen Norman Group, « Accordions on Desktop: When and How to Use » — sur écran large, quand tout le contenu sert, mieux vaut tout montrer : https://www.nngroup.com/articles/accordions-on-desktop/
- Jakob Nielsen, « Progressive Disclosure: From Training Wheels to Week-Long AI Agents » — reprend Carroll & Carrithers 1984 (le groupe témoin perd près d'1/4 de son temps en récupération d'erreurs), la limite de 2 niveaux, et la règle des 80 % de tâches faites sans rien ouvrir : https://www.uxtigers.com/post/progressive-disclosure
- Carroll & Carrithers, « Blocking Learner Error States in a Training-Wheels System », Human Factors 26(4), 1984 : https://journals.sagepub.com/doi/10.1177/001872088402600402
- Scarr, Cockburn, Gutwin & Bunt, « Improving Command Selection with CommandMaps », CHI 2012 (prix du meilleur article) — l'aplatissement bat le Ribbon et les menus chez les expérimentés, sans coût pour les débutants : https://dl.acm.org/doi/10.1145/2207676.2207713
- Findlater & McGrenere, « A Comparison of Static, Adaptive, and Adaptable Menus », CHI 2004 — le menu statique bat l'adaptatif ; ce qui bouge tout seul coûte : https://dl.acm.org/doi/10.1145/985692.985704
- Télémétrie Microsoft sur Word 2003 (série « Why the UI » de Jensen Harris, relayée) — 5 commandes = ~32 % des usages, coller > 11 % à lui seul, et l'écart entre la 100e et la 400e commande est du même ordre que celui entre la 1re et la 11e : https://blog.granneman.com/2008/02/21/the-most-popular-commands-in-word/
- Jensen Harris, « No Distaste for Paste (Why the UI, Part 7) », blog Microsoft — la source d'origine de ces chiffres : https://learn.microsoft.com/en-us/archive/blogs/jensenh/no-distaste-for-paste-why-the-ui-part-7
- WCAG 2.1, critère 1.4.13 « Contenu au survol ou au focus » (niveau AA) et critère 2.1.1 « Clavier » — un contenu qui ne paraît qu'au pointeur échoue au critère clavier : https://www.digitala11y.com/understanding-sc-1-4-13-content-on-hover-or-focus/
- Thompson, Hamilton & Rust, « Feature Fatigue: When Product Capabilities Become Too Much of a Good Thing », Journal of Marketing Research 42(4), 2005 — on surestime la capacité avant l'usage et l'utilisabilité après : https://journals.sagepub.com/doi/abs/10.1509/jmkr.2005.42.4.431
- Apple, Human Interface Guidelines, « Disclosure controls » — la famille de contrôles de dévoilement, livrée depuis les Macintosh HIG de 1992 : https://developer.apple.com/design/human-interface-guidelines/disclosure-controls

---

<a id="sondage-6"></a>

## 12 · Typographie et lisibilité pour l'Atelier — ce que le code fait vraiment, et le fond chaud qu'il peut porter

Le système décrit dans les documents et celui écrit dans le code ne sont pas le même. Le corps est déclaré à 13 px (index.css:89) mais l'écran réel est à 10 px : 385 emplois de text-[10px] contre 9 de text-[13px], 14 tailles distinctes en tout. La couleur la plus employée du produit est la plus pâle : --texte-3 (#5e6771, index.css:22) apparaît 496 fois, plus que les trois autres réunies, et 203 de ces emplois sont à 10 px. Ce couple donne un contraste perçu de Lc 22,3 sur --fond-1 : sous Lc 30, qui est le plancher absolu de TOUT texte. WCAG 2 ne le voit pas — il annonce 3,21:1 (« conforme en grand texte »), et il annonce même 7,50:1 pour --texte-2 qui ne vaut en réalité que Lc 50,5. C'est précisément l'erreur que WCAG 2 commet sur fond sombre, et c'est le vrai sujet du dossier. Côté polices : les trois familles viennent du CDN Google (index.html) et Instrument Serif n'y arrive qu'en 2 fontes — romain et italique, un seul poids, aucun gras possible. J'ai mesuré 26 familles libres au navigateur (largeur du français, hauteur d'œil, débord des accents, chiffres tabulaires, couverture des 30 signes français) : Archivo tient le plus de français par ligne à lisibilité égale, et possède un axe de chasse réel (font-stretch: 62% 125%) qui rend 8,3 % de largeur sans changer de famille. Enfin le fond chaud intermédiaire est possible mais plafonné : au-delà de L* 37 environ, le texte clair ne peut plus atteindre Lc 90. Le bon palier est L* 14–29 pour le châssis, le pourtour de l'asset restant neutre.

### Ce que tout le monde fait, et que l’utilisateur attend

- Une échelle de tailles fermée et courte. Le produit en a 14 (de 8 à 32 px), dont trois demi-pixels (9,5 px) ; cinq suffisent.
- Des chiffres tabulaires partout où des nombres s'empilent en colonne. Acquis ici via .mesure (index.css:97), mais obtenu par la famille monospace plutôt que par la propriété — ce qui le rend indissociable du mono.
- Des polices variables, auto-hébergées en woff2. Aujourd'hui les trois familles viennent du CDN Google (index.html) : une dépendance réseau et un point de fuite de trafic pour un outil personnel qui n'en a pas besoin.
- Un focus visible qui ne dépend pas de la couleur seule. Acquis (index.css : outline 2 px --signal, offset 1 px).
- Aucun texte porteur de sens sous 12 px. Non tenu : 458 éléments à 10 ou 11 px, plus 8 à 8–9 px.
- Les capitales espacées quand on compose en majuscules. Acquis et bien fait : 34 des 36 emplois de uppercase portent tracking-[.11em].
- Un interligne explicite attaché à chaque taille, jamais hérité par accident.
- Une grille d'espacement unique. Ici trois vocabulaires cohabitent (multiples de 4, multiples de 2, valeurs arbitraires en pixels).

### Ce qui émerge en 2025-2026

- APCA reste la méthode candidate de WCAG 3, mais WCAG 3 n'est pas attendu en recommandation avant 2028 : en 2026 on conçoit en APCA et on justifie en WCAG 2, sans attendre d'obligation légale.
- Le critère de taille minimale se déplace du pixel vers la hauteur d'œil : la règle utile est « œil ≥ 7,5 px », ce qui donne 14,1 px pour une police à 0,53 de hauteur d'œil et 15,5 px pour une police à 0,48. Deux polices à la même taille nominale n'ont pas la même lisibilité.
- Le poids devient un levier de contraste à part entière : passer de 400 à 500 abaisse l'exigence d'un cran complet dans la table APCA pour environ 1 % de largeur en plus.
- Retour du fond moyen chaud contre le noir pur, motivé par l'halation et la dilatation pupillaire — et non par la lumière bleue, dont la littérature s'est détournée.
- Les axes variables autres que le poids (chasse, taille optique) commencent à servir pour de bon dans les interfaces denses, en remplacement des familles condensées séparées.
- Les grotesques neutres surexposées (Inter et consorts) refluent au profit de familles à personnalité mesurée ; et les polices conçues pour la basse vision, comme Atkinson Hyperlegible Next, sortent du registre purement accessible pour devenir des choix d'interface ordinaires.

### Là où la convention est fausse pour ce produit

- « 4,5:1 suffit. » Faux ici, et dangereusement rassurant : --texte-2 affiche 7,12:1 sur --fond-1 — niveau AAA — pour un contraste réellement perçu de Lc 50,5, insuffisant pour du corps de texte. Sur fond sombre, WCAG 2 délivre des certificats de conformité à des textes illisibles.
- « Le mode sombre repose les yeux. » L'étude de 2025 ne montre aucune différence significative de fatigue subjective (11,47→18,37 en clair, 12,40→18,87 en sombre, p > 0,05). Le fond sombre se justifie ici par le jugement des assets, pas par l'œil.
- « Plus de contraste, mieux c'est. » Non : au-delà de Lc ~95 sur fond sombre, l'halation dégrade la lisibilité au lieu de l'améliorer, particulièrement chez les astigmates. Le produit est à Lc 93,6, en haut de la plage utile.
- « Toute mesure est en monospace. » La règle est belle et elle coûte cher : le monospace n'apporte rien à un montant (tabular-nums suffit) et fait payer 36 % de largeur à toute phrase française qui tombe dedans — ce qui est arrivé au moins sept fois dans le code.
- « Un fond chaud partout, c'est plus doux. » Vrai pour le châssis, faux pour le pourtour immédiat de l'image : un entourage chaud déplace l'adaptation chromatique et fera corriger à l'auteur une dérive de couleur qui n'existe pas. Le pourtour de l'asset et le damier alpha doivent rester strictement neutres.
- « Un fond intermédiaire, donc à mi-chemin. » Il n'y a pas de terrain praticable au milieu : le texte clair tient jusqu'à L* 37, le texte sombre ne repart qu'à partir de L* 81. Entre les deux, aucune des deux polarités n'atteint le seuil du corps de texte.
- « La densité s'obtient en rapetissant le texte. » C'est ce qui a produit les 385 emplois de 10 px. Sur une police à axe de chasse, condenser à 90 % rend 8,3 % de largeur sans rien coûter en lisibilité — le texte reste à sa taille.

### Les recommandations

**Monter le corps de 10 px à 13–15 px, et passer le poids de 400 à 500. C'est la correction la moins chère du dossier.**

- *Pourquoi* : La table APCA est formelle : 12 px est classé « texte non porteur de sens seulement », et la taille minimale d'un texte de contenu est 13 px — à condition que la hauteur d'œil atteigne 7,5 px. Le produit a 385 éléments à 10 px et 73 à 11 px : ils sont sous le plancher de toute la table, il n'existe aucune couleur qui les rende conformes. Le poids est le levier gratuit : la table exige Lc 90 pour 16 px/400 mais seulement Lc 75 pour 16 px/500. J'ai mesuré au navigateur ce que coûte ce passage en largeur : +1,73 % pour Archivo, +1,31 % pour Instrument Sans, +0,73 % pour Public Sans. Un cran de contraste entier pour 1 % de largeur.
- *Les valeurs* : Échelle fermée à 5 tailles au lieu de 14 : 11 px (jamais porteur de sens seul — suffixes d'unité, en-têtes de colonne déjà en capitales espacées), 13 px (plancher du contenu), 15 px (lecture principale et valeurs), 19 px (titres de section), 28 px (le rare display). Poids 500 par défaut pour le corps dense, 600 pour les en-têtes.
- *Ce que ça coûte* : Élevé mécaniquement mais sans risque : 385 + 73 occurrences à remplacer, remplacement littéral. Les rangées à h-[26px] devront passer à 28 px pour loger 13 px/500 avec son interligne.

**Traiter --texte-3 (#5e6771) comme un défaut, pas comme un niveau de gris. C'est le point le plus grave du produit.**

- *Pourquoi* : Lc 22,3 sur --fond-1, Lc 20,4 sur --fond-3 : sous le plancher absolu de Lc 30 que l'APCA fixe pour n'importe quel texte, à n'importe quelle taille. Et il porte 496 emplois — c'est la couleur de texte la plus fréquente du produit, employée 3 fois plus que --texte (164). Le châssis est donc majoritairement écrit dans la seule teinte qui ne se lit pas. WCAG 2 l'absout (3,39:1 sur --fond-0, donc « AA grand texte »), ce qui explique qu'il ait survécu.
- *Les valeurs* : Sur le fond chaud proposé (#322f29), les trois niveaux deviennent : texte-1 #e9e8e6 (Lc 88,0 / 10,92:1), texte-2 #d0cecb (Lc 72,0 / 8,51:1), texte-3 #b8b6b2 (Lc 58,0 / 6,60:1). Et une règle : texte-3 n'est jamais autorisé sous 15 px/600.
- *Ce que ça coûte* : Faible — trois valeurs dans index.css. Le travail réel est de vérifier que rien d'important n'était caché dans texte-3.

**Mesurer en APCA (Lc), garder WCAG 2 en simple filet. Voici la différence en clair.**

- *Pourquoi* : WCAG 2 fait un rapport entre deux luminances : (clair + 0,05) / (sombre + 0,05). Ce +0,05 est une constante forfaitaire censée représenter la lumière parasite de la pièce. Sur fond clair elle est négligeable ; sur fond presque noir elle domine le calcul, et le rapport s'envole alors que l'œil ne voit presque rien. APCA ne fait pas un rapport mais une différence de clarté perçue, avec des exposants différents selon le sens (texte clair sur fond sombre n'est pas symétrique de l'inverse : 0,65/0,62 contre 0,56/0,57), et un ré-étalonnage des noirs sous Y 0,022. La preuve dans ce produit : --texte-2 #98a2ac sur #111419 donne 7,12:1, ce qui passe WCAG 2 AAA les doigts dans le nez, et Lc 50,5, ce qui ne suffit pour aucun texte de contenu de la table.
- *Les valeurs* : Seuils APCA à retenir : Lc 90 = préféré pour le corps (14 px/400, 16 px/400) ; Lc 75 = minimum du corps (18 px/400, 16 px/500, 14 px/700) ; Lc 60 = minimum du texte non-corps (24 px/400, 21 px/500) ; Lc 45 = gros texte seulement ; Lc 30 = plancher absolu de tout texte ; Lc 15 = non-texte. La table par taille : 14 px → 400:100, 500:100, 600:90, 700:75. 15 px → 400:100, 500:90, 600:75, 700:70. 16 px → 400:90, 500:75, 600:70, 700:60. 12 px → non-contenu quel que soit le poids. Aux 11 px du produit : hors table, aucune valeur ne convient.
- *Ce que ça coûte* : Nul en code — c'est un changement d'outil de jugement. Le calcul APCA tient en 12 lignes.

**Le fond chaud intermédiaire : il existe un plafond, et il faut le connaître avant de choisir la teinte.**

- *Pourquoi* : Éclaircir le fond réduit mécaniquement le contraste atteignable, parce que le texte clair est borné par le blanc. J'ai calculé la courbe : avec du blanc pur, Lc 100 reste atteignable jusqu'à un fond de L* 24, Lc 90 jusqu'à L* 37, Lc 75 jusqu'à L* 51. Passé L* 37, le corps à 14–15 px/400 devient impossible quoi qu'on fasse. Dans l'autre sens, un fond clair avec texte noir n'atteint Lc 75 qu'à partir de L* 81 — il n'y a pas de terrain praticable au milieu. Le fond actuel #0b0d10 est à L* 3,6 ; le gris d'atelier des logiciels d'image (#535353) est à L* 35,3. Un fond chaud « intermédiaire » utilisable se situe donc entre les deux, pas au centre arithmétique.
- *Les valeurs* : Rampe chaude proposée (teinte 34°, saturation dégressive) : fond-0 #282420 (L* 14,5), fond-1 #322f29 (L* 19,4), fond-2 #3d3933 (L* 24,1), fond-3 #48433d (L* 28,7), bord #5b554d (L* 36,5), bord-fort #787168 (L* 48,1). Marge de contraste conservée : Lc 105 à 97 selon le palier.
- *Ce que ça coûte* : Moyen — la rampe de fonds et la rampe de textes changent ensemble ; les dix teintes d'îlot devront être recalées, leur saturation ayant été plafonnée pour un fond froid.

**Chauffer le châssis, mais laisser NEUTRE le pourtour immédiat de l'asset. C'est l'exception qui sauve le reste.**

- *Pourquoi* : Un entourage coloré déplace l'adaptation chromatique de l'œil : un sprite jugé sur un pourtour brun-chaud paraîtra plus froid qu'il n'est, et l'auteur corrigera une dérive qui n'existe pas. C'est toute la raison pour laquelle les logiciels d'image posent leur toile sur un gris moyen strictement neutre. Le commentaire d'index.css défend déjà l'idée voisine (un fond clair fausse le contraste perçu du sprite) — l'argument vaut aussi pour la teinte, pas seulement pour la clarté. Le damier alpha (#191e24 / #14181d) est aujourd'hui froid : il porte le même défaut en plus discret.
- *Les valeurs* : Pourtour de l'aperçu et de la fiche : #565351 (L* 35,5, saturation nulle). Damier alpha à re-neutraliser : #565351 / #4F4C4A. Le châssis chaud s'arrête au bord de la zone d'image.
- *Ce que ça coûte* : Faible — deux ou trois valeurs, mais la règle doit être écrite dans DESIGN.md sinon elle sera reperdue au prochain passage.

**Polices : Archivo pour le texte et l'interface. Mesuré, pas supposé.**

- *Pourquoi* : J'ai chargé 26 familles libres au navigateur et mesuré. La comparaison honnête n'est pas « à 13 px » mais « à la taille dont chaque police a besoin pour atteindre 7,5 px de hauteur d'œil » — car une hauteur d'œil élevée permet de composer plus petit. Archivo a le rapport œil/capitale le plus haut des grotesques pratiques (0,768) et une hauteur d'œil de 0,531 em, ce qui l'autorise à 14,1 px là où Source Sans 3 (0,484) exige 15,5 px et Atkinson 15,0 px. À ces tailles-là, Archivo loge 49,1 signes français par 320 px contre 46,4 pour Instrument Sans (l'actuelle) : +5,8 % de français par ligne. Elle a aussi le plus faible débord d'accent que j'aie mesuré (É dépasse H de 0,18 em seulement, contre 0,23 pour Instrument Sans et 0,25 pour IBM Plex Sans) — ce qui compte énormément en français, où les capitales accentuées sont ce qui se fait rogner en premier dans une rangée serrée. Les 30 signes français testés (« » é É è ê ç Ç à À ù û ï ë ÿ Ÿ œ Œ æ Æ € ’ “ ” – — … × · №) sont tous présents. Et elle a un axe de chasse réel.
- *Les valeurs* : Trio proposé : Archivo (variable, wght 100–900 + wdth 62–125 %) pour texte et interface ; Instrument Serif conservé pour le display seul ; JetBrains Mono conservé mais réduit (voir plus bas). Alternative si la largeur prime : Source Sans 3, 48,9 signes/ligne et chiffres tabulaires natifs, mais hauteur d'œil plus basse. À auto-héberger en woff2 plutôt que via le CDN Google.
- *Ce que ça coûte* : Moyen. Attention : Instrument Serif n'existe qu'en 2 fontes (romain + italique, poids 400) — il n'y a pas de gras et il n'y en aura pas. Si un titre gras est un jour nécessaire, il faudra Source Serif 4 (variable, 18 fontes).

**Se servir de l'axe de chasse d'Archivo pour les colonnes denses, au lieu de rapetisser le texte.**

- *Pourquoi* : C'est la réponse propre au problème qui a produit les 385 emplois de 10 px : le français est long, les colonnes sont étroites, et le réflexe a été de réduire la taille — ce qui détruit la lisibilité. L'axe de chasse réduit la largeur sans toucher à la hauteur d'œil ni au contraste, donc sans rien coûter en lisibilité. J'ai vérifié qu'il fonctionne réellement via Google Fonts (la CSS déclare font-stretch: 62% 125%) : à wdth 90 le texte perd 8,3 % de largeur et passe de 49,1 à 53,6 signes par ligne ; à wdth 85, 12,5 % et 56,1 signes.
- *Les valeurs* : font-variation-settings: 'wdth' 90 sur les en-têtes de colonne et les libellés de tableau. Ne pas descendre sous 85. Piège : demander la police en instances statiques (family=Archivo:wght@400;500) livre une fonte SANS l'axe — il faut family=Archivo:wdth,wght@62..125,100..900.
- *Ce que ça coûte* : Faible, mais il faut charger la bonne URL, sinon l'axe est silencieusement absent.

**Le monospace : une grotesque à chiffres tabulaires suffit pour les mesures. Réserver le mono aux identifiants.**

- *Pourquoi* : L'alignement des colonnes de nombres est obtenu par font-variant-numeric: tabular-nums, pas par le monospace — et index.css:97 pose déjà tabular-nums, donc l'alignement serait acquis même sans la famille mono. Ce que le mono apporte en plus, c'est la distinction caractère par caractère (0/O, 1/l/I), qui est précieuse pour une graine, une empreinte, un chemin de fichier, et inutile pour « 0,42 € ». Ce qu'il coûte, je l'ai mesuré : toutes les monos testées ont une chasse de 0,6 em, soit un chiffre 4,6 % plus large qu'Archivo et 18,7 % plus large que Source Sans 3 ; et surtout, le français pris dedans est 35,7 % plus large (871 px contre 642 px pour la même phrase à 11 px). Or la règle « toute mesure est en monospace » (index.css:95) a débordé sur de la prose : j'ai trouvé « on relit la base… » (Depenses.tsx:292), « rien encore » (Personnages.tsx:2083 et 2316), « en attente » (Tuile.tsx:218), « Ctrl + Entrée », « Entrée le crée », « remplacé ↓ », « brut ». Ce sont des phrases françaises payées 36 % de largeur pour un bénéfice nul.
- *Les valeurs* : Mono conservé pour : graines, empreintes, chemins, identifiants, extraits de prompt. Retiré de : montants, durées, dimensions, comptes, pourcentages, et de toute phrase. Ces derniers passent en Archivo + font-variant-numeric: tabular-nums. Si le mono est refait, Geist Mono est 6 % plus compact en hauteur d'encre que JetBrains Mono (1,06 em contre 1,13) à chasse identique.
- *Ce que ça coûte* : Moyen — la classe .mesure sert aujourd'hui deux rôles à la fois. Il faut la scinder en .mesure (chiffres, tabulaires, police de texte) et .identifiant (mono), puis trier ses ~900 emplois.

**Poser une grille verticale de 4 px et donner un interligne explicite à chaque taille.**

- *Pourquoi* : Aujourd'hui 180 éléments sur 1592 (11 %) portent un interligne explicite ; les 89 % restants héritent du 1,5 que la preflight de Tailwind pose sur html (node_modules/tailwindcss/preflight.css:30). Les utilitaires de taille arbitraire comme text-[10px] ne fixent aucun interligne — seule l'échelle nommée le fait — donc le produit compose 10 px sur 15 px sans l'avoir décidé. Et quand il décide, il décide 20 fois différemment : leading-4 (92), leading-snug (21), leading-tight (18), leading-relaxed (17), leading-[1.5], leading-[1.45], leading-[1.6], leading-[1.65], leading-[1.2], leading-[1.05]… Même désordre sur les rangées : la documentation annonce 44/38/34/30/26, le code emploie 26 (133 fois), 24 (40), 34 (27), 44 (12), 38 (12), 30 (4) — donc un sixième palier non documenté (24) dix fois plus fréquent que le palier documenté 30, et trois valeurs hors grille de 4 px (26, 34, 38). Idem sur les écarts : gap-1.5 (6 px) 78 fois, plus une soixantaine de gap-[2px], gap-[3px], gap-[5px], gap-[9px], gap-0.5, gap-2.5 — environ 106 écarts hors grille.
- *Les valeurs* : Interlignes : 11 px → 16 px (1,45) ; 13 px → 20 px (1,54) ; 15 px → 22 px (1,47) ; 19 px → 26 px (1,37) ; 28 px → 34 px (1,21). Un principe : plus le texte est petit, plus l'interligne relatif est GRAND. Rangées : 24 / 28 / 32 / 40 px seulement (au lieu de six valeurs). Écarts : 4 / 8 / 12 / 16 / 24 px seulement — le 6 px disparaît. Prose de plus de deux lignes : 1,5 minimum et largeur de colonne bornée à 60–75 signes, soit ~380 px à 13 px/500 avec Archivo.
- *Ce que ça coûte* : Élevé en volume, nul en risque. À faire en même temps que le changement de tailles, pas séparément.

**Ne pas pousser le contraste au maximum. Viser Lc 88, pas Lc 107.**

- *Pourquoi* : C'est le point que la conformité seule fait rater. Le texte clair sur fond très sombre produit de l'halation : la pupille se dilate sur un écran sombre, ce qui accroît les aberrations optiques, et les lettres claires « bavent » sur le fond. Cela touche particulièrement les 30 à 50 % d'adultes astigmates, chez qui le fond clair masquait le défaut en contractant la pupille. Le produit est actuellement à Lc 93,6 (16,09:1) pour #e6eaee sur #0b0d10 — proche du maximum théorique de Lc 107,9 qu'atteindrait du blanc pur sur noir pur. Le fond chaud aide doublement : il remonte le plancher, donc le même texte demande moins d'écart, et il réduit la dilatation pupillaire.
- *Les valeurs* : Corps à Lc 88 (#e9e8e6 sur #322f29, soit 10,92:1) plutôt qu'à Lc 93,6. Ne jamais employer #ffffff comme couleur de texte, ni #000000 comme fond. Plage de travail : Lc 75 à 95 pour le corps, jamais au-delà.
- *Ce que ça coûte* : Nul — c'est un choix de valeur, et il va dans le sens du confort ET de la conformité.

**Ne rien faire de particulier contre la lumière bleue. Le sujet est clos.**

- *Pourquoi* : Une revue Cochrane de 17 essais randomisés conclut que les verres filtrant le bleu ne font probablement aucune différence sur la fatigue visuelle, avec peu ou pas d'effet sur la performance visuelle ; une méta-analyse de novembre 2025 sur des mesures objectives de sommeil n'a pas déplacé ce résultat. La recherche récente attribue les symptômes au clignement incomplet plutôt qu'au spectre. Réchauffer la palette est donc justifié par le confort perçu et par l'halation, mais il serait faux de le justifier par la lumière bleue — et ce serait une raison fragile, qui s'effondrerait à la première vérification.
- *Les valeurs* : Aucun filtre ambré, aucune température de couleur « nuit », aucune réduction de saturation du cyan au motif du bleu. Le cyan --signal reste légitime ; il doit seulement remonter en clarté (#49b3ce ne vaut que Lc 49,5 sur le fond chaud, insuffisant pour un libellé de 13 px ; #7fd0e4 donne Lc 66,2).
- *Ce que ça coûte* : Nul.

**Savoir que le fond sombre n'est pas, en soi, un repos pour les yeux — et ne pas le vendre comme tel.**

- *Pourquoi* : L'étude de 2025 la plus directe sur le sujet (30 utilisatrices de tablette, une heure d'usage) ne trouve aucune différence significative de fatigue visuelle subjective entre mode clair et mode sombre : le score monte de 11,47 à 18,37 en clair et de 12,40 à 18,87 en sombre (p > 0,05). Les deux fatiguent. Le mode sombre n'a l'avantage que sur deux mesures secondaires (fréquence critique de fusion et symptômes de sécheresse oculaire, p < 0,05). Par ailleurs la littérature ergonomique donne systématiquement l'avantage au texte sombre sur fond clair pour la vitesse de lecture. La bonne raison de garder un fond sombre ici n'est donc pas oculaire : c'est que l'entourage doit rester plus sombre que les assets jugés. Cette raison-là est solide, et elle suffit.
- *Les valeurs* : Garder le fond sombre, mais le chauffer et le remonter à L* 14–29 : on récupère l'essentiel du confort sans perdre l'argument de jugement d'image.
- *Ce que ça coûte* : Nul — c'est un ajustement du discours dans DESIGN.md, pour que la décision repose sur son vrai motif.

### Les sources

- Mesures faites par moi sur le dépôt : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/index.css (lignes 22, 65, 88, 89, 95–97), C:/STOCKAGE/PROJET/_DEV/gag2/interface/index.html, et comptages sur App.tsx + les 35 fichiers de C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/ (385 text-[10px], 496 text-texte-3, 180/1592 éléments avec interligne explicite, 133 h-[26px], 36 uppercase dont 34 avec tracking)
- Interligne hérité vérifié dans C:/STOCKAGE/PROJET/_DEV/gag2/interface/node_modules/tailwindcss/preflight.css:30 (line-height: 1.5 sur html)
- Contrastes APCA et WCAG 2 calculés par moi (APCA-W3 0.1.9) — scripts dans le dossier de travail temporaire : apca.js, warm.js, seuil.js, final.js, ramp.js
- Mesures typographiques faites par moi au navigateur sur 26 familles chargées depuis Google Fonts : largeur d'une phrase française de 129 signes, hauteur d'œil, hauteur de capitale, débord de l'accent de É, chiffres tabulaires, couverture de 30 signes français, axe de chasse d'Archivo (font-stretch: 62% 125%)
- https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html — seuils Lc 15/30/45/60/75/90 et leurs usages
- https://readtech.org/ARC/tests/visual-readability-contrast/?tn=criterion — table APCA taille/poids (14, 15, 16, 18, 21, 24 px), minimum de 13 px et règle de hauteur d'œil 7,5 px, 12 px en non-contenu
- https://git.apcacontrast.com/documentation/WhyAPCA — pourquoi le rapport WCAG 2 se trompe sur les fonds sombres
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12027292/ — mode clair contre mode sombre, fatigue visuelle après une heure (30 sujets, p > 0,05)
- https://www.allaboutvision.com/conditions/computer-vision-syndrome/digital-eye-strain/is-dark-mode-better-for-eyes/ — halation, dilatation pupillaire, 30–50 % d'adultes astigmates
- https://www.tandfonline.com/doi/full/10.1080/08164622.2025.2579166 — fatigue visuelle numérique et prescription de verres : écart entre preuves et pratique
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12668929/ — méta-analyse 2025 sur les verres filtrant le bleu (mesures objectives de sommeil)
- https://ateliertriay.github.io/bricolage/ — exemple de grotesque variable libre à axes multiples (candidat écarté)

---

<a id="brief"></a>

# Le brief consolidé

## Le problème central

Ce n'est pas la quantité de texte qui assomme, c'est que rien à l'écran n'a de bord : sur les 259 boutons écrits à la main, 231 (89 %) n'ont au repos ni cadre ni fond visible, les deux surfaces voisines d'un panneau ne se distinguent qu'à 1,05-1,10 contre 1 (il en faudrait au moins 1,3), et 395 des 473 traits de séparation sont à moins de la moitié du seuil où l'œil perçoit un trait — si bien que l'information est portée par le survol pour 233 boutons sur 259, c'est-à-dire par un geste, pas par l'image. La surcharge de mots est un symptôme de cette absence de forme : sans une seule icône dans tout le produit (5 dessins vectoriels, aucun pictogramme) et sans vocabulaire de boutons (108 apparences différentes pour 259 boutons, dont 71 qui n'existent qu'une fois), chaque geste doit s'écrire en toutes lettres, et il s'écrit en tout petit — 526 des 732 tailles déclarées sont à 10 pixels ou moins, dans un gris (496 emplois, la couleur la plus fréquente du produit) qui est sous le seuil de lisibilité. Conséquence directe sur le parcours que l'auteur ne voit pas se dessiner : le seul habillage qui crie « c'est ici qu'on agit » n'existe qu'à 7 ou 8 endroits sur environ 330 choses cliquables, donc aucun écran ne peut désigner son geste suivant — et le fond presque noir, lui, n'est pas seulement inconfortable, il fausse le jugement des images qu'on vient y juger.

## Les contraintes dures

*Ce qu’aucune proposition ne peut ignorer, chacune avec sa source.*

**1. Aucune marque au repos ne peut descendre sous 3 contre 1 face à son fond. Cela condamne d'un coup les deux couleurs de trait actuelles comme marqueurs de cliquable, et les écarts entre surfaces. Éclaircir le fond ne suffit pas : il faut remonter les contours en même temps, sinon on obtient des boutons invisibles sur gris clair au lieu d'invisibles sur gris sombre.**

> Relevé code n°1 : trait ordinaire à 1,21 contre 1 sur le fond des cartes (345 emplois), trait renforcé à 1,69 (50 emplois), deux surfaces voisines à 1,07.

**2. Plancher de texte à 13 pixels pour tout ce qui porte du sens, et pas plus de cinq tailles au total. À 10 pixels, aucune nuance de gris, aucun liseré d'un pixel et aucun glyphe ne peut porter la différence entre un mot et un bouton.**

> Relevé code n°2 : 20 tailles distinctes, 526 déclarations sur 732 à 10 px ou moins, 94 % du texte tassé dans une bande de 4,5 px découpée en dix valeurs. Table de référence de la méthode APCA : 12 px est classé « non porteur de sens », minimum du contenu 13 px.

**3. Le gris le plus sombre (#5E6771) doit être rendu au texte inerte, ou remonté. Il est employé 496 fois — plus que les deux autres gris réunis — dont 318 fois en dessous de 11 pixels et 103 fois sur des boutons.**

> Relevés code n°1, n°2 et n°3 : 3,01 contre 1 sur le fond des cartes, sous le seuil de 4,5 ; mesuré en perception réelle (APCA) il tombe à 22 sur une échelle où 30 est le plancher absolu de tout texte.

**4. Le fond ne peut pas monter indéfiniment : le cyan de l'accent tient le seuil de lisibilité tant que le fond reste sous une luminance de 4,1 %, soit une clarté d'environ 24 sur 100. Au-delà, il faut éclaircir l'accent avant de bouger le fond — 224 à 231 endroits du code en dépendent.**

> Sondage « fonds chauds » : point de rupture calculé à 4,34 contre 1 sur un fond à 4,92 % ; comptage de text-signal dans les composants.

**5. Aucune palette de jeu réelle ne peut fournir une couleur de texte. Sur les 48 couleurs d'un jeu de l'auteur, une seule atteint le seuil minimal de lisibilité ; une autre palette réelle plafonne à 2,60 contre 1, soit un peu plus du tiers de ce qu'il faut. Et deux projets sur six n'ont aucune palette du tout.**

> Relevé code n°6, mesures sur les six fichiers de projet réels.

**6. Deux arcs de la roue des couleurs sont fermés parce que les quatre couleurs qui disent quelque chose y vivent (échec, réglé à la main, réussi, accent). Or les palettes de jeu tombent dedans : 36 couleurs sur 48 pour un projet, 17 sur 24 pour un autre, et la teinte dominante des quatre projets pourvus tombe à moins de 30 degrés d'une de ces quatre couleurs — quatre fois sur quatre.**

> Relevé code n°6 et sondage « teinte dynamique » : écarts mesurés de 12, 15, 23 et 29 degrés.

**7. Le pourtour immédiat d'une image doit être neutre (sans teinte) et beaucoup plus clair que le châssis. Aujourd'hui l'auteur juge ses sprites sur un entourage cinq fois plus sombre que ce que la norme de jugement d'image prescrit, ce qui le pousse à surcontraster : l'image paraîtra ensuite trop dure dans le jeu.**

> Sondages « denses et calmes » et « fonds chauds » : damier à 1,08 % de luminance contre 10 à 20 % demandés par la norme ISO 3664 ; effet Bartleson-Breneman (un entourage sombre abaisse le contraste perçu).

**8. Toute zone cliquable doit faire au moins 24 sur 24 pixels. Trois croix de fermeture sont aujourd'hui en dessous, dont une qui n'a ni largeur, ni hauteur, ni marge et mesure environ 10 sur 14 pixels.**

> Relevé icônes : critère 2.5.8 de la norme WCAG 2.2, contraignant en Europe depuis le 28 juin 2025 ; Fiche.tsx:174, Import.tsx:237, Decoupe.tsx:720.

**9. Le survol ne peut plus porter l'information. Le futur système doit se juger écran figé, souris posée à côté : si on ne peut pas nommer les zones cliquables sur une capture immobile, il ne marche pas. Et deux contrôles réels sont aujourd'hui hors du clavier — poser un favori sur une image est un geste que seule la souris peut faire.**

> Relevé code n°1 : 233 boutons sur 259 n'ont d'apparence qu'au survol. Sondage « dévoilement » : Personnages.tsx:2428 et 2666 emploient display:none, ce qui sort l'élément du clavier.

**10. Le vocabulaire des mots doit se fermer avant qu'une seule icône n'entre : sept verbes disent aujourd'hui « dépenser pour obtenir une image », neuf disent « faire disparaître », douze disent « quitter ». Poser des icônes sur sept verbes qui désignent le même geste fabriquerait sept icônes pour un geste.**

> Relevé n°4 sur les 278 boutons et leurs 179 libellés distincts.

**11. Le budget d'icônes est plafonné par la mesure, pas par le goût : sur 223 emplacements de bouton, 77 seulement (35 %) peuvent devenir un pictogramme lu sans apprentissage ; 95 (43 %) ne le peuvent pas — ce sont des lieux que l'atelier a inventés (l'établi, la vitrine, le calibrage, la planche, les tables) ou des nuances de prix qu'aucune forme ne dit.**

> Relevé n°4, classement à la main des 179 libellés distincts puis rejoué par script.

**12. Les icônes ne libéreront pas la place attendue : la barre la plus serrée passe de 1 284 à 1 011 pixels (−21 %) alors que sa colonne peut descendre à 520. Si l'encombrement est un vrai sujet, il se traite en enlevant des contrôles, pas en rétrécissant leurs libellés.**

> Relevé n°4, mesures faites au navigateur avec les vraies polices.

**13. Le français coûte cher en largeur : +39,9 % de caractères par rapport à l'anglais (médiane +50 %), et la police à chasse fixe ajoute encore 35,7 % sur une phrase. Or la moitié de ses emplois (313 sur 604) sont des boutons ou de la prose, pas des nombres.**

> Relevés n°2 et « typographie » : mesures au navigateur sur 25 paires de libellés et sur une phrase de référence.

**14. La densité est légitime sur quatre écrans et ne doit pas être aérée : la matrice de l'établi (une ligne par attitude, une colonne par direction), l'écran de confirmation avant dépense, les panneaux d'outils des tables, et le Guide qui est fait de prose. Ils sont riches, pas mal rangés.**

> Relevé code n°2, section « ce qui marche ».

**15. La refonte des couleurs est bon marché, celle des boutons ne l'est pas. Les 27 couleurs vivent dans un seul fichier, 2 108 emplois passent tous par un nom, une seule valeur est recopiée à la main (Decoupe.tsx:673). En revanche les 259 boutons sont écrits à la main et le composant partagé n'est employé que 20 fois : changer la peau coûte une ligne, changer les formes coûte un chantier écran par écran.**

> Relevés code n°6 et n°1.

**16. Écran large, un seul utilisateur, et c'est l'auteur du produit lui-même. Il n'y a pas de novice à protéger : les arguments d'apprentissage progressif ne s'appliquent pas, et un jeu de 200 pictogrammes à apprendre serait une régression.**

> Cadre du produit + sondage « dévoilement » (CommandMaps, CHI 2012 : l'aplatissement bat les menus chez les expérimentés, sans coût pour les débutants).

## Les pistes de couleur

### Ambre sourd, plafond cyan — la demande littérale, prise au plus haut où le cyan tient encore

Le châssis quitte le bleu et monte de la clarté 3,6 à la clarté 24 sur 100, c'est-à-dire d'un noir bleuté à une terre grise très sombre. Le fond le plus clair du châssis est posé exactement au point de rupture mesuré : un pas de plus et l'accent cyan cesse d'être lisible. Les trois niveaux de texte sont réchauffés avec lui, en reconduisant exactement les rapports d'aujourd'hui. Aucun autre changement n'est requis : six valeurs de fond, trois de texte, dans un seul fichier.

**Les valeurs** — Fonds : #221F1C, #2A2723, #322E2A, #3D3834. Traits : #47423E, #615C56. Textes : #E9E6E2 (principal), #B2ACA4 (secondaire), #7C766E (grisé). Accent : #49B3CE conservé tel quel. Teinte 30-33 degrés, saturation 6 à 10 % contre 18-19 % aujourd'hui.

**Le risque** — Le cyan tombe de 7,1 à 5,5 contre 1 sur les cartes et 4,75 sur le survol : il reste lisible mais perd son confort. Surtout, l'ambre installe le châssis dans l'arc de couleurs où vivent déjà les deux couleurs qui disent « réglé à la main » et « appel raté » — et dans celui des bruns et des ors du pixel art de fantasy, ce que le document de design redoutait à juste titre. À vérifier avec un sprite de terre cuite à l'écran avant de trancher.

### Graphite neutre — monter sans chauffer, et rester conforme au jugement d'image jusque sous l'asset

On répond à « c'est trop sombre » sans répondre à « c'est trop froid » : le fond monte au même endroit que la piste ambre, mais sans aucune teinte. C'est la seule piste où le châssis lui-même satisfait la norme de jugement d'image (entourage sans teinte), donc la seule où la couture entre le châssis et le pourtour de l'asset n'a pas besoin d'être défendue. C'est aussi la moins risquée pour l'accent et pour les dix teintes de rangement.

**Les valeurs** — Fonds : #1A1A1A, #222222, #2A2A2A, #343434. Traits : #444444, #5C5C5C. Textes : #E8E8E8, #B4B4B4, #8A8A8A. Accent : #49B3CE conservé. Rouge, vert et bleu strictement égaux partout — saturation nulle.

**Le risque** — Ne répond pas à la demande de chaleur, et l'auteur peut trouver l'ensemble terne : aujourd'hui le bleu à 18 % de saturation donne au moins une identité au produit. Second effet : si le châssis est neutre et que le pourtour de l'asset l'est aussi, les deux zones ne se distinguent plus que par la clarté — il faut alors garantir au moins 15 points d'écart entre elles, sans quoi on ne sait plus où finit l'outil et où commence l'image.

### Ambre haut, accent remonté — la montée la plus franche, payée par le cyan

La piste qui s'éloigne le plus de l'écran actuel : le fond des cartes monte à la clarté 24 et le survol à 29, soit huit fois la clarté d'aujourd'hui. À cette hauteur le cyan actuel ne suffit plus (il tombe à la moitié du contraste perçu nécessaire pour un libellé de 13 pixels) : on l'éclaircit vers un cyan de ciel. En échange, on obtient un châssis dont les surfaces se lisent sans un seul trait, ce qui finance directement la suppression des 427 lignes dessinées.

**Les valeurs** — Fonds : #282420, #322F29, #3D3933, #48433D. Traits : #5B554D, #787168. Textes : #E9E8E6, #D0CECB, #B8B6B2 — mesurés respectivement à 88, 72 et 58 sur l'échelle de contraste perçu, là où 75 est le minimum d'un texte de contenu. Accent : #7FD0E4 en remplacement de #49B3CE.

**Le risque** — On perd le cyan sourd, qui a été choisi contre le contenu et pas d'après lui — c'est la seule couleur du châssis qu'aucun jeu réel ne vient concurrencer (distance minimale mesurée de 86 sur 441 possibles). Et cette rampe dépasse le plafond de 4,1 % de luminance qu'un autre relevé fixe : les deux relevés ne peuvent pas être vrais ensemble, il faudra trancher à l'œil, écran allumé, avec un sprite dessus.

## Les pistes de hiérarchie

### Quatre formes fermées, dessinées à un seul endroit, et la cinquième interdite

Un bouton plein pour le geste qui fait avancer le travail ou qui paie ; un bouton à cadre visible (au moins 3 contre 1) pour le geste ordinaire ; un lien souligné pour ce qui mène ailleurs ; du texte inerte pour le reste. Interdiction absolue de la cinquième catégorie actuelle, le mot gris cliquable. Le soulignement change de camp : il est rendu au cliquable, et les poignées d'explication reçoivent une autre marque. « Éteint » et « allumé mais non choisi » cessent de partager les mêmes pixels. Tout passe par le composant partagé, employé aujourd'hui 20 fois sur 259.

**Ce que ça répare** — 231 boutons sur 259 sans aucune marque au repos ; 108 apparences pour 259 boutons dont 71 n'existent qu'une fois ; 85 boutons qui sont un simple mot gris, dont 12 sans même un effet de survol ; trois paires où un texte mort et un bouton sont écrits avec exactement les mêmes classes, à quelques pixels l'un de l'autre, dans du code partagé donc sur tous les écrans ; 109 soulignements posés sur du non-cliquable contre un seul cliquable souligné ; le même triplet de classes employé quatre fois pour « désactivé » et quatre fois pour « actif ».

**Le risque** — C'est le chantier long : 259 boutons écrits à la main, écran par écran. Et une règle de formes appliquée telle quelle aux 97 contrôles de l'écran des tables produirait un écran plus bruyant qu'aujourd'hui — elle ne vaut qu'accompagnée de la piste sur le geste dominant.

### Un dominant par écran, et c'est le geste suivant — pas seulement les gestes possibles

Chaque écran désigne ce qu'il faut faire maintenant, et un seul. La galerie, écran de départ, porte un bouton qui mène là où l'on fabrique. La fiche d'une chose distingue « Fabriquer ce qui manque » (qui prépare une dépense) d'« Ouvrir son établi » (qui change d'écran) — aujourd'hui les deux sont rigoureusement identiques. L'établi met en avant « Poser dans le dossier du jeu » quand plus rien ne manque. Le fil d'Ariane nomme les cinq profondeurs de l'établi et les trois côtés de l'univers. Et deux commandes cessent de porter le mot « Réglages » à quarante pixels l'une de l'autre.

**Ce que ça répare** — Le seul habillage d'action dominante n'est employé qu'à 7 ou 8 endroits sur environ 330 choses cliquables ; 26 boutons portent exactement la même apparence pour des gestes qui vont d'« ouvrir un écran » à « recalculer tout le projet » ; l'écran d'accueil se contredit lui-même (« Rien n'est encore sorti d'ici. Écris. » alors qu'aucun champ n'y existe, et « aucun appel ne part d'ici » dix lignes plus bas) ; on change quatre fois d'écran plein sans que l'adresse affichée bouge ; le geste terminal du produit est un bouton ordinaire au fond d'une colonne de 300 pixels qui défile.

**Le risque** — Désigner un dominant, c'est décider ce que l'auteur est censé faire ensuite. Sur les écrans où plusieurs suites sont également légitimes (la fiche d'une image, la galerie), le choix sera arbitraire et devra être assumé plutôt que déduit.

### La hiérarchie se lit à la clarté et au vide, pas au filet

Écarter franchement les quatre surfaces — au moins 1,3 contre 1 entre deux voisines, soit cinq à six points de clarté par marche au lieu des 2,6 à 4,3 actuels — puis supprimer la moitié des traits et réserver ceux qui restent au cadre extérieur d'un panneau. À l'intérieur, on groupe par le vide. Et on crée enfin un palier de repos : une échelle d'écarts à cinq crans (4, 8, 12, 24, 40 pixels) où le dernier est très supérieur aux autres. Deux blocs séparés de 40 pixels n'ont besoin d'aucun trait entre eux — c'est ce qui finance la suppression des lignes.

**Ce que ça répare** — Quatre fonds qui ne couvrent que 10,3 points de clarté au total, avec 1,05 à 1,10 contre 1 entre deux voisins ; 427 lignes dessinées (217 cadres complets et 210 traits de bord) dont 84 % sont à moins de la moitié du seuil de perception — assez pour saturer l'image, pas assez pour qu'une seule serve de repère ; 92 % des 495 écarts du produit tassés entre 4 et 12 pixels, et un seul écart de 40 pixels dans 35 751 lignes, donc littéralement aucun endroit où l'œil se pose.

**Le risque** — Élaguer 427 traits est une passe à faire au navigateur, écran par écran, et elle est irréversible à l'œil nu : on ne s'aperçoit qu'un trait manquait qu'en le voyant manquer. À faire après la montée des fonds, jamais avant.

### Une bande d'action ancrée, jamais flottante, jamais posée sur l'image

Une bande de 44 pixels au bas de la colonne de travail : à droite le dominant, à sa gauche trois secondaires au maximum, à gauche la ligne d'état — le rôle que joue déjà la fente du champ de prompt, qui n'a jamais deux locataires à la fois. Elle est ancrée au bas de la colonne, pas de l'écran, pour ne jamais recouvrir le cadre de l'image.

**Ce que ça répare** — Il n'existe aucune zone d'action fixe dans tout le produit ; le bouton « Générer », qui est le geste payant, flotte dans le flux du bloc de prompt et se déplace verticalement selon la longueur du texte saisi ; sur la matrice de l'établi, trois commandes de même apparence se suivent sur chaque ligne et c'est la deuxième qui engage l'argent, répétée une trentaine de fois sur un écran.

**Le risque** — Figma a fait flotter sa barre d'outils en bas dans sa refonte, et c'est devenu la critique la plus reprise de son propre forum : elle gêne dès que le fond du document a la même couleur qu'elle. Ancrée, jamais flottante — et il faut retrouver 44 pixels de hauteur sur des écrans déjà denses.

### Ce qu'on cache doit pouvoir se rattraper — et rien d'important ne se cache derrière le survol

Trois règles. Un contrôle est visible s'il est survolé OU choisi OU au focus clavier — le produit a déjà écrit cette ligne correctement à un seul endroit, il suffit de la généraliser. Un bloc replié porte sa valeur, et si cette valeur ne tient pas en une trentaine de signes, ce n'est pas une valeur mais un contenu : le bloc ne se replie pas. Enfin, ce qui décide de replier n'est pas la fréquence supposée mais la conséquence : un réglage qui change ce qui part chez le fournisseur, ou dont le retour en arrière coûte un appel payé, ne se replie jamais.

**Ce que ça répare** — Six choses repliables seulement dans un produit qui compte 408 contrôles, et aucune sur les trois panneaux les plus chargés ; quatre contrôles qui n'existent qu'au survol, dont deux hors du clavier (poser un favori est aujourd'hui impossible sans souris) et un qui, au clavier, ne montre qu'un cadre vide de 12 pixels ; quatorze rubriques empilées dans une colonne de 380 pixels dont six seulement se replient ; 37 des 135 explications ne s'atteignent que par le Guide, qui n'a aucun champ de recherche.

**Le risque** — Le réflexe « c'est chargé, donc replions » est le mauvais. La recherche la plus pertinente pour ce cas (un seul utilisateur, expérimenté, écran large) donne l'avantage à l'écran plat sur les menus. Replier doit rester l'exception argumentée, sinon on remplace un écran illisible par un écran vide où tout est à chercher.

## Les pistes d’icônes

### Zéro icône neuve d'abord : fermer le vocabulaire et réparer les cibles

La première tranche ne dessine rien. Un seul verbe pour dépenser (contre sept aujourd'hui : Générer, Fabriquer, Habiller, Lancer, Armer, Relancer, Réessayer), un seul pour faire disparaître (contre neuf), un seul pour quitter (contre douze), un seul couple pour allumer et éteindre (contre cinq paires et six formes). Une seule croix au lieu de deux, et le signe × rendu à la multiplication puisqu'il est employé une trentaine de fois comme tel dans les tailles d'image. Les trois croix de fermeture passent à 24 sur 24 pixels de zone cliquable. C'est le préalable des deux autres pistes : poser des icônes sur sept verbes qui désignent le même geste fabriquerait sept icônes pour un geste.

**Le risque** — Ne répond pas littéralement à la demande de l'auteur (« ajouter des icônes ») et se verra peu : c'est un travail de vocabulaire, pas d'image. Il faut le vendre comme la première moitié du chantier d'icônes, sinon il passera pour un renvoi à plus tard.

### Six marques dessinées, et pas une septième — seulement pour les verbes de rangée qui se répètent

Un jeu minuscule et fermé, dessiné à la main sur une grille de 24, rendu à 12 pixels, trait d'un pixel, bouts et angles carrés — le produit dessine déjà comme ça, avec la raison écrite à côté du code (« parce que le pinceau l'est »). Six verbes seulement, ceux qui reviennent trente fois dans une liste : supprimer, épingler, exporter, relancer, verrouiller, déplier. Toujours accompagnés de leur mot en explication ; jamais seuls dans un panneau, seulement dans une rangée répétée. Le triangle de coin, lui, doit choisir un seul sens : il en porte trois aujourd'hui.

**Le risque** — Six formes dessinées à la main, c'est six occasions de redessiner deux fois la même chose — le produit l'a déjà démontré à petite échelle avec un triangle qui dit trois choses différentes, même couleur, même coin. Il faut un dessinateur unique et un refus écrit d'aller au-delà de six.

### Lucide, habillé aux bouts carrés, plafonné à vingt, en deux tailles seulement

C'est le seul jeu libre dont on peut écraser le bout de trait pour qu'il parle la même langue que le pinceau du produit (les autres jeux à trait l'imposent rond, les jeux pleins n'ont pas de trait du tout). Deux tailles et pas une troisième : 12 pixels, où le trait vaut exactement un pixel, et 24, où il vaut exactement deux — à 16 pixels, la valeur que tout le monde prend par réflexe, il vaut 1,33 pixel et devient laiteux. La taille se cale sur le texte de la rangée, jamais sur sa hauteur. Poids réel : environ deux kilo-octets pour dix-huit icônes. Règle d'admission écrite, plafond à vingt — dix-huit verbes ont été recensés dans le produit.

**Le risque** — Deux mille pictogrammes disponibles derrière une porte ouverte : sans règle écrite et sans plafond, le jeu dérive et l'utilisateur unique se retrouve avec des symboles qu'il devra apprendre. Et 95 des 223 libellés du produit ne sont traduisibles par aucune image — l'établi, la vitrine, le calibrage, la planche, les tables sont des lieux que l'atelier a inventés.

## La teinte dynamique tirée de la palette du jeu

**Faisable ?** Techniquement oui, et pour presque rien — mais à refuser sous la forme demandée. Le mécanisme est propre : les 27 couleurs vivent dans un seul fichier, les 2 108 emplois passent tous par un nom, une seule valeur est recopiée à la main, et la palette du jeu arrive déjà entière côté écran au moment du rendu. Un bloc de style non calqué suffirait à repeindre tout le produit. Ce n'est pas le coût qui condamne l'idée, ce sont quatre mesures : aucune palette réelle ne peut fournir une couleur de texte (une seule sur 48 atteint le seuil minimal, une autre palette plafonne à 2,60 contre 1) ; la teinte dominante des quatre projets pourvus tombe à moins de 30 degrés d'une des quatre couleurs qui disent quelque chose, quatre fois sur quatre ; deux projets sur six n'ont aucune palette, et c'est l'état de tout jeu neuf ; et surtout la boucle se referme sur elle-même — un châssis teint à la couleur du jeu fait paraître les sprites de ce jeu moins colorés qu'ils ne sont, de 10 à 17 % à la teinte que le châssis porte déjà, de 24 à 41 % à une teinte franchement visible. C'est exactement le jugement que l'atelier sert à porter, faussé dans le sens qui trompe : il fait rater ce qui est juste.

**Comment** — Répondre au vrai besoin — savoir du coin de l'œil quel jeu est ouvert — par une marque bornée plutôt que par une ambiance. Attribuer à chaque projet une des dix teintes de rangement qui existent déjà (liste fermée, toutes posées au même contraste, seul endroit du produit où une couleur ne veut rien dire), et la poser à trois endroits seulement : une pastille de 8 pixels près du nom du projet, un liseré de 2 pixels sur le bord gauche, le titre de l'onglet du navigateur. Zéro pixel de fond touché. Puis étendre la vitrine, qui est le seul endroit où la couleur du jeu a déjà un métier : elle propose les trois premières couleurs de la palette comme fonds de jugement, avec la raison écrite dans le code (« une couleur que le jeu emploie — le sujet s'y détache, ou non ») ; passer à six, ajouter un gris de jugement sans teinte, et porter le même sélecteur à l'aperçu plein écran et à la fiche, qui n'ont aujourd'hui que le damier. Teindre le châssis mettrait la même couleur des deux côtés et supprimerait la comparaison que la vitrine a été construite pour créer.

**Les garde-fous** :

- Si la teinte du châssis se fait malgré tout : figer les neuf clartés actuelles et ne laisser varier que la teinte et la saturation. Vérifié : en tournant la teinte à clarté constante, le contraste ne bouge au pire que de 0,15 sur toute la table.
- Plafonner la saturation très bas — au plus 0,022 sur l'échelle OKLCH, soit environ 1,7 fois ce que le châssis porte aujourd'hui. Au-delà de 0,03, un sprite de la même teinte perd plus du quart de sa saturation apparente ; et au-delà de 0,039 le rendu commence à écrêter à cette clarté.
- Les quatre couleurs qui disent quelque chose (réussi, réglé à la main, échec, accent) ne dérivent jamais, comme la couleur d'erreur de Material 3 qui est écrite en dur et ne suit pas le fond d'écran. Les dix teintes de rangement non plus : leur discipline tient au fait qu'elles sont toutes au même écart de clarté.
- Garde de 30 degrés autour de chacune des quatre sémantiques. Comme cela ferme 66 % de la roue, le glissement d'une teinte trop proche vers le bord de l'arc est la règle et non l'exception — et il ne faut jamais prendre « la deuxième couleur de la palette » à la place, elle ne veut rien dire de plus.
- Un état « pas de palette », et il doit être le châssis par défaut. Deux projets sur six sont dans ce cas, et c'est l'état de tout jeu neuf tant qu'aucune image n'a été promue.
- Un seuil de matière : si la palette est trop grise, trop sombre ou trop courte, la teinte qu'on en tire est du bruit. Une palette réelle du dépôt rend 23 couleurs dont 6 seulement sont franchement différentes. En dessous du seuil, on ne teinte pas, et on le dit.
- La teinte se fige à l'ouverture du projet, jamais en continu. La palette se recalcule toute seule quand on promeut ou retire une image : sans cette règle, l'interface changerait de couleur au milieu d'un geste, ce qui est le reproche le plus constant fait aux thèmes dynamiques.
- Teinte désactivée sur la vitrine, l'aperçu plein écran et la superposition — les trois écrans où l'on juge une image. Le châssis chaud s'arrête au bord de la zone d'image.
- Avant tout : corriger la classe bg-signal-sourd, employée deux fois dans les tables alors que la couleur correspondante n'est définie nulle part. Deux boutons actifs n'ont donc aujourd'hui aucun fond. Une teinte dynamique repose entièrement sur l'idée qu'aucune couleur n'est écrite ailleurs que dans la table des noms — cette exception la contredit.

> ⚠️ **Abandonnée par l’auteur le 4 septembre 2026**, après lecture des mesures. Conservée ici
> parce que les mesures restent vraies et qu’elles évitent de rouvrir l’idée par oubli.

## La typographie

"Remonter le plancher et fermer l'échelle avant tout le reste : c'est le changement au meilleur rapport effet sur risque du dossier, et il est purement mécanique. Cinq tailles au lieu de vingt — 11 px pour ce qui n'est jamais porteur de sens seul (unités, en-têtes de colonne déjà en capitales espacées), 13 px comme plancher du contenu, 15 px pour la lecture principale et les valeurs, 19-20 px pour les titres de section, 28-32 px pour le rare grand chiffre — avec un interligne explicite attaché à chaque cran (16 / 20 / 22 / 26 / 34 px) au lieu du 1,5 hérité par accident sur 89 % des éléments. Passer le poids par défaut de 400 à 500 : cela abaisse d'un cran entier l'exigence de contraste pour environ 1 % de largeur en plus, mesuré. Rangées ramenées à quatre valeurs (24 / 28 / 32 / 40) au lieu de six dont trois hors de toute grille, et écarts à cinq crans multiples de 4.\n\nFamille : remplacer Instrument Sans par Archivo en version variable, pour trois raisons mesurées et pas de goût. Elle a la hauteur d'œil la plus haute des grotesques pratiques (0,531 em, rapport œil sur capitale de 0,768), ce qui l'autorise à composer à 14,1 px là où d'autres exigent 15,5 pour la même lisibilité ; elle loge 5,8 % de français en plus par ligne qu'Instrument Sans à lisibilité égale ; et elle a le plus faible débord d'accent mesuré (le É ne dépasse le H que de 0,18 em contre 0,23 pour Instrument Sans), ce qui compte énormément en français où les capitales accentuées sont ce qui se fait rogner en premier dans une rangée serrée. Surtout, elle possède un axe de chasse réel (62 à 125 %) : condenser à 90 % rend 8,3 % de largeur sans toucher à la taille ni au contraste — c'est la réponse propre au problème qui a produit les 385 emplois de 10 px, où le réflexe avait été de rapetisser le texte. Attention au piège : demander la police en instances fixes livre une fonte sans cet axe.\n\nInstrument Serif reste pour le grand titre seul, en sachant qu'il n'existe qu'en deux fontes — romain et italique, un seul poids : il n'y a pas de gras et il n'y en aura pas. Si un titre gras devient nécessaire un jour, il faudra changer de serif.\n\nLa police à chasse fixe est rendue aux identifiants seuls — graines, empreintes, chemins, extraits de prompt — et retirée des montants, durées, dimensions, comptes et pourcentages, qui passent en Archivo avec les chiffres de largeur fixe (déjà posés dans le fichier de style, donc l'alignement des colonnes est acquis sans elle). C'est le geste qui séparera d'un coup « ce qu'il faut lire » de « ce qu'il faut relever » : 313 des 604 emplois actuels sont des boutons ou de la prose, et une phrase française prise dans la mono coûte 35,7 % de largeur pour un bénéfice nul.\n\nDeux règles de méthode. Mesurer le contraste en perception réelle (APCA), garder l'ancien calcul en simple filet : sur fond sombre il délivre des certificats de conformité à des textes illisibles — le gris secondaire du produit affiche 7,12 contre 1, ce qui est le meilleur niveau, pour un contraste réellement perçu de 50 quand il en faut 75. Et ne pas pousser le contraste au maximum : viser 88 sur cette échelle plutôt que les 93,6 actuels, parce qu'au-delà le texte clair bave sur le fond sombre, particulièrement chez les 30 à 50 % d'adultes astigmates. Enfin, auto-héberger les fontes plutôt que de les tirer du réseau à chaque ouverture, comme aujourd'hui."

## Les contradictions

*Là où les relevés se contredisent entre eux, ou contredisent la demande. Ce sont elles qui ont fait les vraies décisions.*

**1.** Le fond sombre et le jugement d'image. Le document de design et le code affirment tous deux qu'« un fond clair remonte la luminance d'entourage et fausse le contraste perçu d'un sprite ». Trois relevés disent l'inverse, et c'est la seule affirmation de design du produit que la littérature contredise frontalement : c'est l'entourage SOMBRE qui abaisse le contraste perçu, donc l'atelier pousse aujourd'hui l'auteur à surcontraster ses sprites — le défaut même que la phrase croyait prévenir. La norme de jugement d'image demande un entourage à 10-20 % de réflectance ; le damier de l'atelier est à 1,08 %. Mais l'autre moitié de la phrase est juste et doit survivre : un châssis chaud entre bien en concurrence avec les verts, les bruns et les ors du pixel art. Le produit a confondu deux choses, le châssis et le pourtour de l'image ; la sortie est de les séparer, pas de choisir un camp.

**2.** Jusqu'où monter le fond, les deux relevés ne s'accordent pas. Le sondage sur les fonds chauds plafonne le châssis à 4,1 % de luminance (clarté 24) parce que c'est exactement là que l'accent cyan cesse d'être lisible pour du petit texte. Le sondage typographique propose une rampe qui monte jusqu'à la clarté 28,7 et remplace l'accent par un cyan plus clair. Les deux ne peuvent pas être vrais ensemble : ou le cyan reste #49B3CE et le fond s'arrête à 24, ou le fond monte et le cyan change. Aucune lecture ne tranche — c'est un arbitrage à faire à l'écran.

**3.** Le nombre de boutons sans forme change selon le relevé : 231 sur 259 (89 %), 232 sur 259 (90 %), 163 sur 258 (63 %), 147 sur 258 (57 %). Les quatre ne comptent pas la même chose — les uns comptent l'absence de contraste suffisant, les autres l'absence pure et simple d'une classe de bordure ou de fond. Le fait tient dans tous les cas et la conclusion ne bouge pas ; mais aucun de ces chiffres ne doit être cité seul comme s'il faisait autorité.

**4.** Le nombre de glyphes du produit : le document de design dit trois ; le document des motifs en donne deux inventaires incompatibles et appelle « premier glyphe du produit » une forme qui serait la quatrième ; les relevés comptent 11, 16 ou 18 caractères-signes réellement rendus, plus sept formes dessinées en CSS. Le document ne décrit plus le code depuis longtemps — et l'un des relevés note qu'un chevron employé 99 fois dans 23 fichiers est décrit ailleurs comme « un quatrième glyphe » qui n'existerait pas.

**5.** L'auteur demande des icônes ; la mesure dit qu'elles ne règlent pas sa plainte. Seuls 77 emplacements sur 223 peuvent devenir un pictogramme lu sans apprentissage, le gain de place est de 21 % sur la barre la plus serrée quand il en faudrait le triple, et pour un outil à un seul utilisateur en français un jeu de 200 pictogrammes serait une régression. Ce qui règle la plainte, c'est le cadre autour des mots — 57 à 89 % des boutons n'en ont aucun. Les icônes viennent après, et seulement pour les verbes qui se répètent trente fois dans une liste.

**6.** L'auteur demande d'adapter les couleurs de l'interface à la palette du jeu actif ; quatre mesures s'y opposent, dont une qui touche au métier même du produit : teindre le châssis à la couleur du jeu fait paraître les sprites de ce jeu de 10 à 41 % moins colorés qu'ils ne sont, et c'est précisément le jugement que l'atelier sert à porter. La demande derrière la demande — savoir quel jeu est ouvert — est légitime et se satisfait autrement.

**7.** « Trop chargé » appelle le réflexe de replier, et la recherche la plus pertinente dit l'inverse. Le dévoilement progressif a été inventé pour des débutants ; ici l'unique utilisateur est l'auteur du produit. Le travail de référence sur les dispositions plates (prix du meilleur article, CHI 2012) donne l'avantage à l'écran où tout est visible chez les expérimentés, sans coût pour les débutants. Et le vrai défaut mesuré n'est pas qu'on cache trop — six choses repliables pour 408 contrôles — mais qu'on cache mal aux quatre endroits où l'on cache, dont deux sont hors du clavier.

**8.** Le plan du dépôt se trompe sur son propre état : il affirme que le zoom des tables est « pas fait » alors qu'il existe depuis le 31 août. Plus largement, 13 des 14 défauts de l'audit du 31 août sont réparés, et un seul reste ouvert. La « grosse passe de design » réclamée n'a donc aucune matière dans cet audit : ce que l'auteur ressent aujourd'hui vient d'ailleurs, et c'est ce que les douze relevés viennent de mesurer.

**9.** Le brief se décrit lui-même comme « presque noir et froid », ce qui est juste, et le document de design parle de « neutres froids », ce qui est faux : mesuré, le fond est à 17,8-19 % de saturation, teinte 212-218 degrés — c'est le fond le plus TEINTÉ de tout le panorama comparé, et il est teinté en bleu. Gruvbox, la référence en matière de thème chaud, tient ses fonds entre 0 et 7,4 %. Conséquence pratique : la gêne de l'auteur a deux causes séparables, la profondeur et le bleu, et la seconde se corrige sans rien coûter en contraste.

**10.** « Aucun coin arrondi de confort » dit le document ; le code en compte 224, dont 210 à deux pixels, et les jetons de rayon sont explicitement définis. Ce n'est pas un désaccord grave, mais il retire l'argument qu'on opposerait à un jeu d'icônes légèrement arrondi.

**11.** La règle « toute mesure est en monospace » est juste et sa mise en œuvre la contredit : 313 emplois sur 604 sont des boutons ou de la prose. Les explications du produit sont donc rendues en chasse fixe à 10 pixels, ce qui les rend indistinguables d'un relevé de mesures — c'est très exactement ce que l'auteur décrit comme « une interface qui assomme d'infos techniques ».

**12.** Le gris le plus sombre est délibérément sous le seuil de lisibilité, et le document l'assume en disant qu'il ne porte jamais d'information dont l'absence bloquerait. Le code le dément : un tiers de ses 577 emplois est cliquable, 103 sont des boutons, et il est posé sur des onglets de navigation qui n'ont aucune autre marque. La règle n'est pas fautive, son application l'est.

## Ce qu’il ne faut pas perdre

**1.** Les libellés qui portent le prix avant le clic : « Payer et lancer » contre « Lancer — gratuit », « Revenir sans rien dépenser », « prépare la planche dans l'atelier — rien n'est dépensé ici », « aucun appel ne part d'ici ». Dix-huit chaînes de ce genre dans douze écrans. C'est la promesse centrale d'un outil qui paie ses images, aucun pictogramme ne sait la dire, et une passe de design qui remplacerait ces mots par des symboles muets détruirait la seule chose que l'interface fait déjà mieux que ses concurrentes.

**2.** Les 88 à 95 explications qui disent la conséquence et non la fonction : « les images déjà faites restent », « l'image part à la corbeille — le pied de l'écran propose de la rendre ». C'est le patrimoine le plus précieux du produit et le plus facile à perdre dans une refonte.

**3.** Le grisé qui porte sa raison en toutes lettres, sous le contrôle, en permanence, et jamais dans une bulle au survol : 68 emplois, un composant dédié. C'est rare dans les logiciels, et le recueil d'explications s'interdit explicitement de porter une raison — le partage est juste, il faut le garder.

**4.** Le recueil d'explications : 134 à 135 entrées, 1 662 lignes, 97 versions longues, un gabarit imposé (ce que c'est, ce que ça change, d'où ça sort), écrit en français clair sans jargon. C'est un an de rédaction déjà faite. Une refonte qui repartirait de zéro sur les textes perdrait la meilleure matière du produit : il faut le brancher partout (10 en-têtes l'emploient aujourd'hui) plutôt que de le doubler dans les écrans.

**5.** Les états vides écrits comme des invitations, en serif 32 pixels, dans treize fichiers : « Ce jeu n'a encore personne. Nomme le premier. », « Le tableau est vide. Colle. » C'est le seul endroit où l'interface a une voix, et elle est juste. Il ne leur manque pas un texte, il leur manque un bouton à côté.

**6.** L'écran de confirmation avant la dépense : chaque texte et chaque image qui partent sur leur ligne avec un interrupteur, le prix annoncé dans le libellé du bouton, un dominant, une sortie explicite. C'est le seul écran du produit où la hiérarchie fait déjà son travail — il est le modèle de la refonte, pas sa matière.

**7.** L'assistant en douze étapes : étapes nommées et groupées, compteur en toutes lettres, pastilles qui distinguent « où je suis », « ce que j'ai rempli » et « ce que je n'ai pas ouvert », bouton plein, sortie qui ne juge personne. C'est le seul parcours réellement dessiné du produit ; son vocabulaire doit descendre dans les parcours qui n'en ont aucun, et il doit pouvoir se rouvrir (il se referme aujourd'hui pour toujours dès l'étape 1).

**8.** Le bloc replié qui porte sa valeur à droite de son titre : sept appels sur sept respectent la règle. C'est le seul motif du document que le code applique à 100 %.

**9.** La suite de segments : le seul contrôle du produit dont l'état se lit sans bouger la souris (bordure et texte colorés, fond teinté), déjà employé 36 fois. Le motif le plus honnête de l'interface.

**10.** Le focus clavier, correct et uniforme : un liseré de 2 pixels sur tout ce qui le reçoit. Aujourd'hui, le clavier voit ce que la souris ne voit pas.

**11.** Le budget de mouvement : 74 transitions à 80 millisecondes, une seule jauge et elle est déterminée, pas un balayage indéfini. C'est le point où le produit est en avance sur les références comparées — il n'y a rien à y faire.

**12.** La structure sous la peau : 157 étiquettes accessibles, 40 états de bascule déclarés, des onglets déclarés comme tels, et seulement 4 clics posés hors d'un vrai bouton sur 284. Ce qui manque est la peau, pas le squelette : la refonte n'aura pas à réécrire la navigation.

**13.** La discipline des couleurs : 27 couleurs dans un seul fichier, aucune couleur de bibliothèque par défaut, une seule valeur recopiée à la main dans tout le produit. C'est exactement ce qui rend une refonte de palette bon marché — et ce qu'une refonte bâclée détruirait en réécrivant des couleurs à la main dans les composants.

**14.** Les dix teintes de rangement : liste fermée, toutes posées au même contraste, seul endroit du produit où une couleur ne veut rien dire. Elles ne doivent dériver d'aucune palette de jeu — leur discipline tient à cette égalité.

**15.** Le cyan choisi contre le contenu et non d'après lui : sur les quatre jeux réels, aucune couleur de palette ne s'en approche. C'est la seule couleur du châssis qu'aucun jeu ne vient concurrencer, et le mesurer donne raison au document. Si une piste de couleur l'éclaircit, elle doit savoir ce qu'elle paie.

**16.** Le damier et son écart volontairement faible entre les deux carreaux, assez pour se lire, trop peu pour que l'œil suive le motif. Il faut le re-neutraliser (il est froid aujourd'hui), pas le refaire.

**17.** La densité légitime de quatre écrans : la matrice de l'établi, l'écran de confirmation avant dépense, les panneaux d'outils des tables, et le Guide qui est fait de prose. Ils ne sont pas mal rangés, ils sont riches — les aérer serait la mauvaise réponse.

**18.** La règle « un seul endroit d'où l'argent part par écran », et le fait que la galerie le dise noir sur blanc. La règle est juste ; c'est sa mise en scène qui manque.

**19.** Le chevron comme marque de « ça mène ailleurs » : la convention existe déjà à moitié, apprise, tenue à 53 endroits sur 179 libellés. Il ne lui manque que d'être rendue systématique et visible — et de cesser de servir aussi de séparateur dans le fil d'Ariane.

## Les questions posées à l’auteur

*Toutes tranchées depuis, sauf mention contraire. Voir `docs/design-decisions.md`.*

**1.** Chaud, ou seulement moins sombre ? Le fond actuel n'est pas neutre : il est teinté en bleu à 18 % de saturation, plus teinté que Gruvbox qui sert de référence en matière de thème chaud. Tourner cette teinte sans changer une seule clarté ne coûte rien en contraste et pourrait suffire à faire tomber la gêne. Faut-il essayer d'abord ce geste gratuit, ou monter et chauffer d'un coup ?

**2.** Accepte-t-il de perdre le cyan #49B3CE ? C'est le seul arbitrage que la mesure ne tranche pas : ou le fond s'arrête à la clarté 24 et le cyan reste tel quel, ou le fond monte plus haut et le cyan s'éclaircit vers le ciel — auquel cas on perd la couleur qui avait été choisie contre le contenu et qu'aucun jeu réel ne vient concurrencer.

**3.** Le pourtour de l'image doit être nettement plus clair que tout le reste de l'écran — c'est ce que la norme de jugement demande et l'écart mesuré est d'un facteur dix. Est-il prêt à travailler avec une zone claire au milieu d'un châssis sombre, ou est-ce que cette couture le gênera au point de ne pas s'en servir ?

**4.** Combien de crans de fond veut-il, et lequel par défaut ? Les thèmes de référence en livrent trois (dur, moyen, doux) parce que la bonne profondeur dépend de la lumière de la pièce et non du produit. Un réglage, ou une valeur tranchée une fois pour toutes ?

**5.** À quoi doit servir la couleur du jeu, exactement : savoir du coin de l'œil quel jeu est ouvert, ou sentir l'ambiance du jeu pendant qu'on travaille ? Les deux appellent des réponses opposées — une pastille et un liseré pour la première, une teinte de fond pour la seconde, et la mesure interdit la seconde.

**6.** Est-il prêt à fermer le vocabulaire, c'est-à-dire à renommer des gestes qu'il a nommés lui-même ? Un seul verbe pour dépenser au lieu de sept, un seul pour faire disparaître au lieu de neuf, un seul pour quitter au lieu de douze. C'est le préalable de toute icône, et cela touche des mots auxquels il tient peut-être.

**7.** Sur l'établi, quel est le geste dominant : « Fabriquer ce qui manque », ou « Poser les fichiers dans le dossier du jeu » ? Un seul dominant par écran, et personne d'autre que lui ne sait lequel de ces deux gestes est l'aboutissement de son travail.

**8.** Les douze étapes des réglages du jeu : lesquelles veut-il voir ensemble sur un même écran ? C'est le seul défaut de l'audit encore ouvert, le seul du lot qui demandait une décision de forme, et il n'est porté par aucune tranche du plan.

**9.** Densité : un réglage compact contre confortable, comme le proposent désormais les outils denses, ou une seule densité assumée ? Pour un outil à un seul utilisateur c'est peut-être le bon endroit — mais c'est deux jeux de hauteurs à tenir au lieu d'un.

**10.** Cinq surfaces n'ont jamais été examinées, dont le premier contact avec le produit : l'assistant de démarrage quand aucun jeu n'existe, la planche de pose, ce qui s'affiche quand un appel échoue ou que la clé manque, ce que fait une génération pendant qu'elle tourne, et le comportement sur un écran plus petit. Faut-il les mesurer avant d'écrire le nouveau système, ou les traiter au fil de la refonte ?

---

<a id="critiques"></a>

# Les deux relectures adverses

*Le brief ci-dessus a été attaqué sous deux angles avant d’être retenu : « répare-t-il vraiment
ce dont l’auteur se plaint ? » et « que détruit-il sans s’en rendre compte ? ». Une bonne partie
de ce que dit `docs/DESIGN.md` vient de ces deux lectures-là, pas du brief.*

## Relecture 1

**L’angle** — Ce document est un excellent audit et un mauvais brief. Il mesure admirablement le grain de l'interface — la couleur d'un trait, la taille d'un mot, le contraste d'un cadre — et il ne monte jamais d'un cran au-dessus. Or l'auteur ne se plaint pas du grain : sur ses huit phrases, trois portent sur le pixel (« pas lisible », « on ne sait pas ce qui est cliquable », « trop sombre ») et cinq portent sur ce qui se passe entre les écrans (« aucun workflow ne se dessine », « des allers-retours avec les yeux », « pas intuitif pour un sou », « surchargé de liens », et les « feedbacks » réclamés la veille). Le brief répond très bien aux trois premières et esquive les cinq autres — non pas en les niant, mais en les transformant en questions posées à l'auteur à la fin du document. C'est exactement l'inversion qu'il faut refuser : l'auteur dit « je ne vois pas de parcours », et on lui répond « quel est votre geste dominant sur l'établi ? ». La réponse « un dominant par écran » ne fabrique pas un parcours, elle fabrique une suite d'écrans mieux ponctués. Il manque une couche entière entre la table des couleurs et l'écran : la chaîne de production elle-même — d'où l'on vient, où l'on va, ce qui reste à faire sur l'objet en cours, ce qui se passe quand un appel part et quand il rate. Et il manque la décision : onze pistes et dix questions, c'est un menu, pas un brief. Un dossier de ce niveau de mesure a gagné le droit de trancher.

**Le verdict** — Non, pas entièrement : le brief répare vraiment la lisibilité, le repérage du cliquable et, en partie, la profondeur du fond, mais il laisse intactes les deux plaintes les plus fortes — l'absence de parcours visible et les allers-retours du regard — il ne dit rien des retours d'information demandés, et il ne tranche rien.

### Ce qui manquait

**1. La chaîne de production n'est décrite nulle part — donc « aucun workflow ne se dessine » reste entier**

*Pourquoi ça compte* — C'est la plainte la plus forte de l'auteur, et le brief lui oppose deux choses : un bouton mis en avant par écran, et un fil d'adresse en haut. Aucune des deux ne fabrique un parcours. Un parcours, c'est une suite d'écrans qui se tiennent : on part de l'univers du jeu, on ouvre une chose, on descend dans son établi, on paie une image, elle revient, on la détoure, on la pose sur une planche, on la range dans le dossier du jeu. Aujourd'hui le produit compte trois onglets (Univers, Codex, Galerie) et une dizaine d'écrans profonds — établi, tables, découpe, dépenses, envoi, réglages, guide, dépliage, calibrage, planche, vitrine — et rien à l'écran ne dit qu'ils forment une chaîne. Poser un bouton principal dans chacun d'eux les rend plus lisibles un par un, et laisse l'auteur exactement aussi perdu sur l'ensemble. Le brief le sait, puisqu'il désigne l'assistant en douze étapes comme « le seul parcours réellement dessiné du produit » — puis se contente d'écrire que « son vocabulaire doit descendre dans les parcours qui n'en ont aucun », sans dire un mot de comment.

*Ce qu’il fallait ajouter* — Trois choses concrètes. Un : écrire la chaîne noir sur blanc, en une page, avec les étapes nommées dans les mots de l'auteur, et dire à quel écran correspond chaque étape — c'est le document qui manque, et il se fait en une heure sans toucher au code. Deux : un état d'avancement porté par l'objet lui-même, visible partout où il apparaît — pour un personnage, combien de cases de sa matrice sont remplies, ce qui a été détouré, ce qui est posé dans le dossier du jeu ; l'établi calcule déjà ces nombres, ils ne sont simplement montrés nulle part ailleurs. Trois : un contrat d'entrée et de sortie pour chaque écran profond — d'où on y arrive, et où l'on est renvoyé quand on en sort, y compris après une dépense. C'est ce qui remplacera « je clique et je ne sais plus où je suis » par « je clique et je reviens où j'étais avec une chose de plus faite ».

**2. Les allers-retours du regard ne sont ni mesurés, ni traités : la mise en page à trois ou quatre colonnes n'est jamais remise en cause**

*Pourquoi ça compte* — L'auteur dit « on passe son temps à faire des allers-retours avec ses yeux ». Le brief lui répond avec une échelle d'écarts (4, 8, 12, 24, 40 pixels) et une bande d'action en bas. Ni l'une ni l'autre ne parle de distance parcourue par l'œil. Or la cause est dans la structure : l'écran principal met l'arbre du rangement à gauche (240 px), les réglages dans une deuxième colonne (300 px), la grille des images au milieu, et la fiche de l'image à droite (380 px). Pour un seul geste — choisir une image, vérifier son réglage, lire son prix, la relancer — le regard traverse trois colonnes, deux fois. Aucune règle de proximité n'existe : rien n'oblige un réglage à se tenir près de ce qu'il change. Le brief ne mesure pas une seule distance en pixels entre un contrôle et son effet, ne compte pas combien de colonnes une tâche courante fait traverser, et ne dit jamais si les colonnes survivent à la refonte. Pire, la bande d'action proposée met l'état à gauche et le bouton principal à droite d'une même barre : c'est un aller-retour horizontal de plus, ajouté.

*Ce qu’il fallait ajouter* — Un relevé par tâche, et non par composant : prendre les six gestes que l'auteur fait vraiment dans une journée (fabriquer une case manquante, relancer une image ratée, détourer, poser dans le dossier du jeu, changer un réglage de modèle, retrouver une image d'hier), et pour chacun noter la suite des zones que l'œil doit visiter et la distance parcourue. Puis une règle écrite : un contrôle se tient dans la même colonne que ce qu'il modifie, et un objet ne raconte pas sa vie dans trois endroits à la fois. Enfin, une décision assumée sur les colonnes : trois colonnes fixes en permanence, ou une colonne de travail qui prend toute la place et des panneaux qu'on appelle. Sans ce relevé, la refonte peut être entièrement réussie au niveau du bouton et laisser la plainte intacte.

**3. Les « feedbacks » explicitement demandés par l'auteur ne sont traités nulle part**

*Pourquoi ça compte* — Le 3 septembre, l'auteur demande trois choses en une phrase : des icônes, des boutons, des retours d'information. Le brief consacre trois pistes aux icônes, cinq aux boutons et à la hiérarchie, et zéro aux retours d'information. Ce qui s'en approche le plus est une ligne de la liste des acquis, qui félicite le produit d'avoir une seule jauge et de la remplir de façon déterminée. Or c'est là que vit une grande part de « pas intuitif pour un sou » : dans un outil qui dépense de l'argent réel à chaque image, savoir qu'un appel est parti, où il en est, quand il revient, ce qu'il a coûté, et surtout ce qui s'affiche quand il rate ou que la clé est absente, c'est le cœur du confort. Le brief admet lui-même, tout à la fin et sous forme de question, que cinq surfaces n'ont jamais été examinées — dont exactement celles-là : ce qui s'affiche quand un appel échoue, et ce que fait une génération pendant qu'elle tourne. Les reléguer en question, c'est promettre une passe de design qui ne touchera pas l'endroit où l'auteur souffre le plus.

*Ce qu’il fallait ajouter* — Sortir ces cinq surfaces des questions et les remettre dans le travail, en les traitant en premier parce qu'elles sont peu nombreuses et très visibles. Pour chacune, écrire ce qu'on voit : le premier contact quand aucun jeu n'existe, une génération en cours (où, combien de temps, combien ça coûte, comment on l'arrête), un appel qui rate (ce qui s'est passé, ce qu'on peut faire, est-ce que ça a été facturé), la clé absente, la planche de pose. C'est trois à cinq écrans, pas un chantier — et c'est ce qui se verra le plus vite.

**4. Le brief nomme lui-même le bon remède au « surchargé » — enlever des contrôles — et n'en enlève pas un seul**

*Pourquoi ça compte* — Il écrit noir sur blanc : « si l'encombrement est un vrai sujet, il se traite en enlevant des contrôles, pas en rétrécissant leurs libellés ». C'est la phrase la plus juste du document, et elle n'a aucune suite. Le produit compte plus de quatre cents contrôles, dont près de cent sur le seul écran des tables, et le brief ne propose de retirer aucun d'entre eux. Il propose au contraire d'en encadrer 259 — c'est-à-dire de les rendre tous plus visibles. Un écran surchargé dont chaque élément reçoit un cadre est un écran plus surchargé, pas moins. C'est le risque le plus sérieux du dossier, et il est reconnu à demi-mot dans le risque de la première piste de hiérarchie (« une règle de formes appliquée telle quelle aux 97 contrôles de l'écran des tables produirait un écran plus bruyant qu'aujourd'hui ») sans jamais être résolu.

*Ce qu’il fallait ajouter* — Un objectif chiffré de retrait, écran par écran, décidé avant de dessiner quoi que ce soit : sur l'écran des tables, passer de 97 contrôles visibles en permanence à un nombre que l'on s'engage à tenir. Et le critère pour trancher : un contrôle reste à l'écran s'il sert dans le geste courant de cet écran ; sinon il descend dans un panneau appelé, ou il disparaît. C'est un travail de deux heures par écran, à faire avec l'auteur, et c'est le seul qui réponde littéralement au mot « surchargé ».

**5. Personne n'a calculé que remonter le plancher de texte va augmenter la quantité d'encre à l'écran**

*Pourquoi ça compte* — Le brief propose de faire passer le plancher de 10 à 13 pixels et de monter le poids par défaut. Sur 526 déclarations concernées, cela représente environ un tiers de surface de texte en plus, sur un produit dont l'auteur dit qu'il est surchargé de texte. La compensation proposée — la police Archivo condensée à 90 %, soit 8,3 % de largeur récupérée, plus 5,8 % de français logé en plus par ligne — ne couvre pas la moitié de l'augmentation, et elle ne joue que sur la largeur, pas sur la hauteur. Le brief additionne des gains partiels sans jamais poser l'addition complète. Résultat probable : un écran plus lisible mot par mot, et plus lourd d'ensemble — c'est-à-dire une réponse à « pas lisible » qui aggrave « surchargé de texte ».

*Ce qu’il fallait ajouter* — Faire le calcul, écran par écran, avant de décider : combien de surface le texte occupe aujourd'hui, combien il occuperait à 13 pixels de plancher, et de combien il faut réduire le nombre de mots pour revenir au même total. Cela transforme le retrait de contrôles et de mots en une contrainte chiffrée au lieu d'une bonne intention — et cela donne le budget de mots par écran, qui est probablement le livrable le plus utile de toute la refonte.

**6. Aucune recommandation : onze pistes, dix questions, zéro décision**

*Pourquoi ça compte* — Trois pistes de couleur, cinq de hiérarchie, trois d'icônes, plus dix questions à l'auteur — dont plusieurs demandent une décision de design que l'auteur n'est pas en position de prendre (« quel est le geste dominant sur l'établi », « lesquelles des douze étapes voulez-vous voir ensemble », « combien de crans de fond »). L'auteur vient de dire qu'il ne comprend pas son interface ; lui rendre onze options et dix questions revient à lui demander de faire le travail. Un dossier qui a mesuré à ce niveau de détail a gagné le droit de recommander, et il doit le faire — quitte à se tromper et à être corrigé.

*Ce qu’il fallait ajouter* — Une combinaison recommandée, en une page : une piste de couleur, une piste d'icônes, l'ensemble des pistes de hiérarchie retenues, ce que cette combinaison coûte, ce qu'elle sacrifie, et ce qui la ferait abandonner. Les dix autres pistes restent en annexe. Et les questions à l'auteur passent de dix à trois au maximum — celles où seul lui peut répondre parce qu'il s'agit de son goût ou de son métier, pas de celles où il s'agit de trancher un arbitrage de conception.

**7. Aucun ordre des travaux, aucune tranche, aucun coût**

*Pourquoi ça compte* — Le brief dit que la couleur coûte une ligne et que les boutons coûtent un chantier écran par écran, ce qui est juste — et il s'arrête là. Il ne dit pas dans quel ordre faire les choses, alors qu'il connaît lui-même une dépendance dure (« élaguer les traits est à faire après la montée des fonds, jamais avant ») et une autre (« fermer le vocabulaire est le préalable de toute icône »). Pour un auteur qui travaille par tranches et tient un plan dans son dépôt, un document sans ordre ni découpage est inutilisable tel quel : il ne peut pas commencer.

*Ce qu’il fallait ajouter* — Un découpage en cinq à sept tranches livrables, chacune visible à l'œil en fin de tranche, dans l'ordre imposé par les dépendances : d'abord la peau (fond, contrastes, échelle de tailles — pas cher, immédiatement visible, réversible), puis le vocabulaire des mots, puis le composant de bouton et un écran pilote, puis la propagation écran par écran par ordre de douleur, puis l'élagage des traits, puis les icônes. Avec, pour chaque tranche, ce qui doit être vrai pour la déclarer finie.

**8. Le composant de bouton partagé, sur lequel tout repose, n'est spécifié nulle part**

*Pourquoi ça compte* — La piste principale de hiérarchie dit « tout passe par le composant partagé, employé aujourd'hui 20 fois sur 259 ». C'est la bonne idée, et c'est le seul livrable qui empêchera les 108 apparences de repousser. Mais le brief ne dit pas ce que ce composant sait faire : quelles familles il propose, quelles hauteurs, comment on lui passe une icône, comment il rend un bouton éteint et où il affiche la raison de l'extinction, comment il garantit la zone cliquable de 24 pixels, comment il traite un bouton qui annonce un prix. Sans cette liste, chaque écran réinventera sa variante et on refabriquera le problème en deux mois.

*Ce qu’il fallait ajouter* — Une page qui décrit le composant comme un contrat : les quatre familles fermées, les hauteurs autorisées, l'emplacement de l'icône, l'état éteint avec sa raison obligatoire, la zone cliquable minimale garantie par le composant lui-même, et l'interdiction explicite d'écrire un bouton à la main. À écrire avant le premier écran refait, pas après.

**9. Aucun garde-fou mécanique contre la rechute**

*Pourquoi ça compte* — Le désordre actuel n'est pas venu d'un mauvais choix, il est venu de l'absence de barrière : 259 boutons écrits à la main, 20 tailles de texte, 108 apparences. Si la refonte se contente de tout remettre droit à un instant donné, la dérive recommencera au premier écran écrit vite. Le brief propose des règles écrites — il ne propose aucun moyen de les faire tenir toutes seules.

*Ce qu’il fallait ajouter* — Trois vérifications automatiques qui refusent le code fautif : une taille de texte hors des cinq autorisées, une couleur écrite en dur au lieu de passer par son nom, un bouton écrit à la main au lieu du composant partagé. C'est une demi-journée de travail et cela protège des années. Ajouter une quatrième vérification, plus ambitieuse mais faisable : le contraste minimal de toute marque au repos.

**10. Les écrans ne sont pas classés par douleur, donc l'auteur ne sait pas par où commencer**

*Pourquoi ça compte* — Le brief compte les boutons du produit entier et cite quelques écrans en exemple, mais ne range jamais les écrans du pire au moins mauvais. Or la douleur est très concentrée : quatre fichiers — l'assistant, la toile, l'établi des personnages et les tables — représentent à eux seuls un tiers de tout le code de l'interface, et c'est l'écran des tables qui porte près de cent contrôles. Refaire d'abord la vitrine ou le guide donnerait le sentiment que rien n'a changé.

*Ce qu’il fallait ajouter* — Un classement des écrans sur trois mesures simples déjà disponibles — nombre de contrôles visibles en permanence, nombre de mots à l'écran, nombre de colonnes qu'une tâche courante fait traverser — et la règle : on refait dans cet ordre, et on s'arrête pour regarder après les deux premiers.

**11. Le pourtour de l'image, qui est le métier du produit, n'a pas une seule valeur chiffrée**

*Pourquoi ça compte* — Le brief établit comme contrainte dure que la zone autour d'une image doit être neutre et beaucoup plus claire que le reste, avec une mesure à l'appui (un dixième de ce que demande la norme de jugement d'image). C'est la découverte la plus importante du dossier, parce qu'elle ne touche pas au confort mais à la justesse du travail : l'auteur surcontraste ses images sans le savoir. Et pourtant, alors que chaque piste de couleur donne quatre valeurs exactes pour le châssis, aucune ne donne la valeur du pourtour. La contrainte est posée puis abandonnée.

*Ce qu’il fallait ajouter* — La valeur du damier et du pourtour, chiffrée comme le reste, dans chacune des trois pistes ; la liste exacte des endroits où ce pourtour s'applique (la vitrine, l'aperçu plein écran, la fiche, la superposition, la planche) ; et la couture entre le châssis sombre et cette zone claire, dessinée et non seulement décrite — c'est la seule chose de tout le dossier que l'auteur risque de trouver franchement laide, et elle mérite d'être vue avant d'être décidée.

**12. Le geste le moins cher pour répondre à « trop sombre » n'est pas une piste**

*Pourquoi ça compte* — Le brief découvre que le fond n'est pas neutre mais teinté en bleu, plus teinté que la référence des thèmes chauds, et il note dans ses questions que tourner cette teinte sans toucher à aucune clarté ne coûte rien en contraste — vérification faite, le contraste ne bouge au pire que de 0,15 sur toute la table. Autrement dit : il existe un geste gratuit, sans risque et réversible, qui pourrait suffire à faire tomber une partie de la gêne, et il est rangé dans les questions au lieu d'être la piste zéro. C'est l'inverse de ce qu'un dossier de décision doit faire.

*Ce qu’il fallait ajouter* — En faire la première piste et la première tranche : tourner la teinte à clarté constante, regarder pendant deux jours de travail réel, puis seulement décider s'il faut aussi monter. Cela sépare les deux causes que le brief a lui-même identifiées — la profondeur et le bleu — au lieu de les traiter d'un bloc.

**13. Rien ne permet de savoir si la montée proposée suffit à faire tomber « trop sombre »**

*Pourquoi ça compte* — Les trois pistes montent le fond de très sombre à sombre — une clarté de 24 à 29 sur 100 reste un fond nettement sombre. L'auteur a dit deux choses : « trop sombre pour le moment » et « je veux pas un truc blanc non plus ». La deuxième est respectée par construction, la première n'est vérifiée par rien. Il est parfaitement possible que la refonte livre les trois pistes et que l'auteur redise « c'est encore trop sombre » — auquel cas tout le raisonnement sur le plafond du cyan sera à refaire, mais après coup.

*Ce qu’il fallait ajouter* — Encadrer la réponse au lieu de la viser : proposer quatre fonds à comparer côte à côte, dont un délibérément trop clair, et laisser l'auteur pointer celui qui est juste et celui qui est trop. Un sélecteur temporaire dans un coin de l'écran, une après-midi de travail réel avec de vraies images à l'écran, et la question est close en un jour — le brief dit lui-même que les couleurs vivent dans un seul fichier et que les changer coûte une ligne. Il n'y a aucune raison de laisser cet arbitrage ouvert dans un document.

**14. Aucune image du résultat, aucun écran pilote**

*Pourquoi ça compte* — L'auteur se plaint de ne pas voir. On lui répond par un document de plusieurs milliers de mots contenant des valeurs de couleur en hexadécimal, des rapports de contraste et des comptages. Il n'existe pas une seule vue du résultat proposé. Le brief désigne pourtant lui-même l'écran modèle — l'écran de confirmation avant dépense, « le seul écran du produit où la hiérarchie fait déjà son travail » — et l'écran le plus douloureux. Tout est réuni pour montrer, et rien n'est montré.

*Ce qu’il fallait ajouter* — Un écran refait pour de vrai, pas une maquette : la fiche ou l'établi, avec la nouvelle peau, le nouveau composant de bouton, la nouvelle échelle de tailles et le retrait de contrôles décidé. On le met à côté de l'ancien, on regarde, on tranche. C'est ce qui remplacera dix questions par une réponse, et c'est ce qui doit sortir avant que la moindre règle ne soit gravée dans le document qui fait foi.

**15. Le sort des 496 emplois du gris le plus sombre n'est pas tranché**

*Pourquoi ça compte* — Le brief pose comme contrainte dure que ce gris « doit être rendu au texte inerte, ou remonté ». Ce sont deux décisions opposées et le brief n'en choisit aucune. La différence est énorme : le remonter, c'est une ligne dans un fichier et tout le produit gagne en lisibilité d'un coup ; le rendre au texte inerte, c'est reprendre à la main 103 boutons et un tiers de 577 emplois, et se demander à chaque fois quelle autre couleur mettre. L'un est la tranche la moins chère du dossier, l'autre est un chantier. Les laisser côte à côte sous un « ou » masque un écart de coût d'un facteur cent.

*Ce qu’il fallait ajouter* — Trancher, et dire pourquoi. La réponse raisonnable est probablement les deux dans cet ordre : remonter le gris tout de suite pour que rien ne reste illisible, puis, écran par écran et seulement là où le nouveau vocabulaire de boutons passe, rendre ce gris à ce qui ne se clique pas. Ce qui compte est que l'ordre et le coût soient écrits.

### Les erreurs relevées dans le brief

- Le brief enfreint sa propre règle dans sa première phrase. Il écrit, dans ses contradictions, qu'aucun des quatre comptages de boutons sans forme (231, 232, 163, 147 sur 259) « ne doit être cité seul comme s'il faisait autorité » — et il ouvre son diagnostic central sur « 231 sur 259, 89 % ». Soit le chiffre est citable, soit la règle vaut ; les deux ne tiennent pas ensemble, et un lecteur qui repère cela cesse de faire confiance au reste du dossier.

- Deux comptages du petit texte cohabitent sans être réconciliés : « 526 des 732 tailles déclarées sont à 10 px ou moins » d'un côté, « les 385 emplois de 10 px » de l'autre. Ce sont peut-être deux choses différentes (les déclarations dans le style contre les emplois réels), mais rien ne le dit, et l'écart est du simple au tiers.

- Le brief affirme comme un acquis à préserver que « une seule valeur de couleur est recopiée à la main dans tout le produit », et écrit vingt lignes plus bas, en garde-fou, qu'une classe employée deux fois pointe vers une couleur qui n'est définie nulle part — donc deux boutons actifs sans fond. La discipline des couleurs est très bonne, mais elle n'est pas à 100 %, et c'est précisément ce que le brief promet.

- La démonstration « les icônes ne libèrent pas la place » est biaisée. Elle compare le gain obtenu en remplaçant des mots par des dessins (1 284 px qui tombent à 1 011) au minimum de la colonne (520 px), c'est-à-dire à un tout autre problème. Personne n'a jamais prétendu que des icônes feraient tenir une barre d'outils dans la moitié de sa largeur. La conclusion (« les icônes viennent après ») est probablement juste, mais elle est portée par un mauvais argument, et l'auteur qui a demandé des icônes le sentira.

- « 13 des 14 défauts de l'audit du 31 août sont réparés, donc la grosse passe de design réclamée n'a aucune matière dans cet audit » : le raisonnement ne tient pas. Que les défauts d'un audit précédent soient corrigés ne dit rien de la plainte d'aujourd'hui, qui porte sur autre chose. Cette phrase donne l'impression de répondre à l'auteur « vous vous plaignez de rien », ce qui n'est ni vrai ni utile.

- Les deux plafonds de fond se contredisent frontalement — l'un arrête le châssis à 4,1 % de luminance pour sauver le cyan, l'autre monte jusqu'à 28,7 en changeant le cyan — et le brief se contente de constater que « les deux ne peuvent pas être vrais ensemble ». Ce n'est pas une contradiction, c'est une erreur quelque part : ou une des deux mesures porte sur un texte d'une taille différente, ou l'une des deux est fausse. Le dossier doit dire laquelle, ou dire qu'il ne sait pas et pourquoi.

- « L'information est portée par le survol pour 233 boutons sur 259 » surinterprète le relevé. Ce que le survol porte, c'est l'apparence du bouton, pas son information : le mot est là, lisible, avant le survol. Le vrai défaut — on ne voit pas qu'un mot est cliquable — est déjà assez grave sans être gonflé, et l'exagération donne prise à une objection facile.

- Le brief présente « un dominant par écran » comme la réponse au parcours qui ne se dessine pas, puis écrit dans le risque de cette même piste que sur les écrans où plusieurs suites sont légitimes « le choix sera arbitraire », et renvoie finalement la question à l'auteur. Une piste dont le contenu principal est reporté ne répare rien : elle nomme le problème une deuxième fois.

- La bande d'action de 44 px est décrite comme la réponse au geste payant qui flotte — et son propre risque note qu'« il faut retrouver 44 pixels de hauteur sur des écrans déjà denses », sans jamais dire où on les prend. Sur les quatre écrans que le brief déclare par ailleurs légitimement denses et interdits d'aération, ces 44 px n'existent nulle part.

- « Aucun coin arrondi de confort » est démenti par 224 coins arrondis dans le code, et le brief le note — mais il en tire seulement qu'on perd un argument contre les icônes arrondies. Le vrai enseignement est plus lourd : le document qui fait foi sur l'apparence décrit un produit qui n'existe plus, sur au moins quatre points (les coins, les glyphes, les « neutres froids », l'application de la règle du gris). Tant que ce document n'est pas remis à jour ou déclaré caduc, toute nouvelle règle écrite au même endroit subira le même sort.

---

## Relecture 2

**L’angle** — Je défends le système actuel par ses raisons, pas par principe — et je lâche quatre de ses règles qui n'en ont plus. Le brief est un excellent relevé de l'état du code et un mauvais lecteur du document qui l'a produit : il compte des disciplines comme des défauts, cite deux réparations déjà faites comme des preuves à charge, et surtout il ne mentionne jamais la seule chose qui tenait vraiment ce produit ensemble — les deux listes fermées de hauteurs (44/38/34/30/26) et de largeurs (380/300/240), leurs deux exceptions nommées, et l'ordre du sacrifice qui décide de ce qui sort d'une bande trop pleine. Trois de ses pistes cassent ces listes sans le dire. Une quatrième, la piste ambre, est mot pour mot la maquette écartée le 26 août 2026 après essai. Ce que le brief a raison de tuer, en revanche, il ne le tue pas assez : la phrase fausse sur le fond clair vit à trois endroits, dont un commentaire de feuille de style, et si elle y reste elle reviendra à la relecture suivante.

**Le verdict** — Oui sur le diagnostic — l'absence de bord au repos est réelle et bien mesurée — mais non comme fondation d'une refonte : trois de ses cinq pistes de hiérarchie et deux de ses trois pistes de couleur détruisent des règles dont la raison tient encore, et le brief ne les cite pas une seule fois.

### Ce qui manquait

**1. Le plancher de texte à 13 px casse la liste fermée des hauteurs de contrôle, et le brief ne nomme jamais cette liste.**

*Pourquoi ça compte* — Les cinq hauteurs 44/38/34/30/26 px sont la seule discipline que les vingt-six écrans de la V2.1 se sont imposée et qu'ils ont tenue entièrement — le document en tire sa phrase la plus forte : « aucune largeur ni hauteur inventée ». Or la rangée de 26 px est celle de la barre d'état, de la rangée d'arbre, du bouton de segment et du champ de recherche, et elle porte aujourd'hui du texte de 10 ou 11 px précisément parce que 26 est le plancher. Le brief demande 13 px de texte avec un interligne explicite de 20 px : dans une rangée de 26, il reste 3 px de garde de chaque côté. La liste s'ouvre en silence, et avec elle la seule chose qui empêchait chaque écran neuf de réinventer sa propre hauteur.

*Ce qu’il fallait ajouter* — Écrire noir sur blanc ce que devient la liste des cinq hauteurs sous le nouveau plancher : soit on remonte le plancher à 11 px (ce que le document a déjà fait une fois, sur la méta de tuile, le 31 août 2026) et les cinq hauteurs tiennent, soit on va à 13 px et il faut publier une nouvelle liste fermée, mesurée, avec le même engagement. Ce qui n'est pas tenable, c'est de remonter le texte sans dire ce que devient la rangée qui le porte.

**2. La piste « ambre sourd » et la piste « ambre haut » sont mot pour mot la maquette écartée le 26 août 2026, et l'essai a déjà été payé.**

*Pourquoi ça compte* — Le document nomme le fichier — `docs/maquette-atelier.html`, châssis ambre sur charbon — et donne la raison du refus : la peinture au pixel de fantasy sature déjà les verts, les bruns et les ors, donc un châssis chaud entre en concurrence directe avec ce qu'on lui demande de juger. Le brief connaît l'argument (il l'écrit lui-même dans le risque de sa première piste, « à vérifier avec un sprite de terre cuite à l'écran ») mais le traite comme une vérification à faire, alors qu'elle a été faite et tranchée. Rouvrir une décision est légitime ; la rouvrir sans savoir qu'elle a coûté une maquette entière ne l'est pas.

*Ce qu’il fallait ajouter* — Dire explicitement que la piste ambre rouvre la décision du 26 août, et ce qu'on apporte de neuf par rapport à l'essai qui l'avait fermée. Le brief a bien un élément neuf et il ne le met pas en avant : la séparation du châssis et du pourtour de l'image. C'est le seul argument qui permette de rouvrir honnêtement.

**3. Un châssis ambre éteint la seule couleur chaude que le produit s'était autorisée.**

*Pourquoi ça compte* — L'ambre `--epingle` (#C8A03C) dit trois choses dans tout le produit : réglé à la main, interrompu, catalogue servi de repli. Quand il est entré, le 27 août 2026, son coût a été nommé en toutes lettres : « un point chaud de plus dans un châssis froid — tenu hors de la grille, jamais à côté d'un sprite ». Il n'est lisible que parce que tout le reste est froid. Poser le châssis à la teinte 30-33 degrés, comme le proposent les deux pistes ambre, met le fond dans le même arc que ce signal — et le brief a lui-même écrit la règle qui l'interdit ailleurs : les deux arcs 345-55° et 120-200° sont fermés parce que les quatre couleurs qui disent quelque chose y vivent. Il applique cette règle aux couleurs de rangement et l'oublie pour le fond, qui occupe pourtant mille fois plus de pixels.

*Ce qu’il fallait ajouter* — Étendre la garde des arcs interdits au châssis lui-même, ou dire ce que devient `--epingle` s'il tombe : quelle couleur porte désormais « réglé à la main » sur un fond de la même famille.

**4. La bande d'action ancrée de 44 px rouvre le bandeau refusé le 27 août 2026, et surcharge la fente qui n'a jamais deux locataires.**

*Pourquoi ça compte* — Le refus du bandeau hors ligne portait deux raisons, et aucune n'était esthétique. La première : une bande pleine largeur est du châssis permanent en travers de la grille, dans un système dont le principe unique est que chaque décision retire une concurrence à la grille. La seconde est arithmétique : elle ajoute une quatrième hauteur sur une colonne qui compte déjà 44 px en tête et 26 en pied. La piste du brief refait exactement cette bande, sur la colonne de fabrication cette fois. Pire, elle propose d'y loger la ligne d'état « le rôle que joue déjà la fente du champ de prompt, qui n'a jamais deux locataires à la fois » — or cette fente en a déjà trois qui se relaient (le raccourci au repos, la raison quand générer est grisé, le repli hors ligne), et c'est exactement ce qui rend la règle « jamais deux à la fois » tenable. En faire le pied permanent d'une bande d'action ajoute un quatrième locataire qui, lui, est toujours là.

*Ce qu’il fallait ajouter* — Trancher franchement : soit la bande prend une des cinq hauteurs et remplace quelque chose, soit elle n'existe pas. Et si elle existe, dire ce que devient la fente, qui est aujourd'hui le seul endroit du produit où un refus s'explique avant le clic.

**5. Le monospace : le brief coupe la règle au mauvais endroit, et défait au passage une réparation du 1er septembre 2026.**

*Pourquoi ça compte* — Le brief a raison sur le constat — 313 emplois sur 604 sont des boutons ou de la prose, et une phrase française en chasse fixe coûte 35,7 % de largeur pour rien. Mais il en conclut qu'il faut retirer la chasse fixe aux montants, durées, dimensions et comptes, c'est-à-dire à ce que la règle visait, tout en la gardant aux identifiants, qui sont un cas rare. Or le 1er septembre 2026 le produit a réparé un défaut avec la règle telle qu'elle est : le bouton de téléchargement était invisible parce qu'il était écrit en chasse fixe de 10 px dans une bande où sept éléments sur huit sont des faits mesurés, et la réparation a consisté à en faire la seule chose de la bande qui ne soit pas en chasse fixe. Cette réparation ne fonctionne que si la chasse fixe veut dire « fait mesuré ». Si les mesures en sortent, la bande devient entièrement en police de texte et le bouton reperd sa marque le jour même où on la lui donne.

*Ce qu’il fallait ajouter* — Renverser la coupe : la chasse fixe garde les mesures, elle perd la prose et les libellés de boutons. C'est la direction que le produit a déjà prise une fois, un bouton à la fois — et l'alignement des colonnes est acquis sans elle, puisque les chiffres de largeur fixe sont déjà posés dans la feuille de style.

**6. Les dix couleurs de rangement détournées en marque de projet cassent deux de leurs quatre disciplines.**

*Pourquoi ça compte* — C'est la meilleure idée du brief sur la teinte dynamique et elle contredit ce qu'elle réutilise. La deuxième discipline dit que ces couleurs ne colorent que quatre surfaces du tableau d'inspiration, jamais une marque sur une carte, jamais un contrôle. Un liseré de 2 px sur le bord gauche de la fenêtre et une pastille près du nom du projet sont exactement des marques hors du tableau. La troisième discipline dit que la liste est fermée parce que le premier îlot rouge se lirait comme un échec — c'est-à-dire que ces couleurs valent précisément parce qu'elles ne veulent rien dire. Leur faire dire « ce jeu-ci est ouvert » leur donne un sens, et à partir de là deux îlots de la même teinte dans deux projets différents ne racontent plus la même chose. S'ajoute un détail de forme : une pastille ronde colorée existe déjà dans le produit et elle dit un état, avec le vert, l'ambre et le rouge. Une pastille ronde de projet entre dans ce vocabulaire-là.

*Ce qu’il fallait ajouter* — Choisir une marque qui n'emprunte rien à la sémantique existante ni au rangement : le titre de l'onglet du navigateur ne coûte rien, le nom du jeu est déjà dans la barre de tête. Si une couleur est vraiment nécessaire, il faut une onzième valeur née dans ce qui reste des arcs, réservée à ce métier-là, et pas un emprunt.

**7. L'ordre du sacrifice dans une bande pleine — aucune piste du brief ne le remplace, et sa piste typographique le met en défaut.**

*Pourquoi ça compte* — Le produit a une règle mesurée pour ce qui arrive quand une bande de la liste fermée n'a plus la place : les mesures partent en premier (parce qu'elles se relisent ailleurs), puis les libellés des contrôles, jamais un geste. Elle a été écrite le 1er septembre 2026 après mesure au navigateur — la bande du comparateur réclamait 973 px pour 840 disponibles à 1 600 px de fenêtre — et une barre de défilement horizontale a été construite puis retirée le jour même, parce qu'elle prend 16 px sur les 38 de la bande et rogne de quatre les segments de 26. Or cette bande est l'un des quatre écrans que le brief classe lui-même comme « densité légitime, à ne pas aérer ». Remonter ses libellés de 10 à 13 px, en français qui coûte déjà +39,9 % de largeur, la fait déborder à toutes les tailles de fenêtre, et le brief ne propose rien qui rattrape ça.

*Ce qu’il fallait ajouter* — Remesurer cette bande précise aux nouvelles tailles avant d'arrêter l'échelle, et dire ce que devient l'ordre du sacrifice. C'est le seul mécanisme du produit qui empêche une bande d'écraser ses contrôles, et une bande qui écrase ses contrôles ment sur leur état.

**8. Le damier ne peut pas devenir un pourtour de jugement à 10-20 % de clarté sans cesser d'être un signal.**

*Pourquoi ça compte* — Le brief a raison sur deux points : le damier est froid aujourd'hui (#191E24 et #14181D sont bleutés) et le pourtour d'une image doit être neutre. Mais il enchaîne sur la norme de jugement d'image, qui demande un entourage à 10-20 % de clarté, et applique cette valeur au damier. Or le damier n'est pas un entourage de jugement, c'est le mot du produit pour « il n'y a pas de couleur ici » — c'est ce qui révèle la transparence d'un sprite détouré, et c'est aussi ce qui a servi le 3 septembre 2026 à montrer qu'aucune couleur de fond n'était posée, à la place d'une pastille qui affirmait le contraire de ce qu'elle disait. À 15 % de clarté, une zone transparente cesse de se lire comme une absence : sur un sprite qui contient des gris clairs, elle devient indistinguable du contenu. Et l'écart volontairement faible entre les deux carreaux — assez pour se lire, trop peu pour que l'œil suive le motif — ne survit pas à un carreau de 12 px porté à cette clarté.

*Ce qu’il fallait ajouter* — Séparer trois surfaces au lieu de deux : le châssis, le pourtour de jugement, et le damier. Le pourtour clair et neutre est le bon endroit pour la norme, et le produit a déjà commencé à le construire — la vitrine propose les trois premières couleurs de la palette du jeu comme fonds de jugement, avec la raison écrite dans le code. C'est cette surface-là qu'il faut étendre, pas le damier.

**9. Le pointillé et le recueil d'explications sont une seule pièce, et le brief demande de couper l'une en gardant l'autre.**

*Pourquoi ça compte* — Le mécanisme entier tient en trois décisions liées. Le libellé du réglage est la cible (donc aucun point d'interrogation à ajouter). Le trait pointillé qui le souligne reprend le jeton de la poignée de barre de défilement pour le même métier : il y a plus à savoir ici. Et le guide et les explications au survol sont un seul corpus rendu de deux façons, avec une règle tenue par des essais automatiques — une explication sans point d'accroche est permise, un point d'accroche sans explication ne l'est pas. Le brief veut rendre le soulignement au cliquable. Il n'existe alors plus aucune marque pour dire qu'un libellé porte une explication, et les 135 entrées que le brief appelle « un an de rédaction déjà faite » deviennent atteignables seulement par le guide — ce qu'il déplore ailleurs pour 37 d'entre elles.

*Ce qu’il fallait ajouter* — Si le soulignement change de camp, il faut livrer dans le même mouvement la nouvelle marque du point d'accroche, et vérifier qu'elle n'est pas un glyphe (le produit a refusé trente points d'interrogation pour ça) ni une couleur (elles sont toutes prises). Sinon, il faut renoncer à souligner les liens et trouver leur marque ailleurs.

**10. Une refonte de peau emporte silencieusement six règles de comportement que le brief n'évoque pas une fois.**

*Pourquoi ça compte* — Ce sont des règles payées à l'écran, pas au banc d'essai, et aucune n'apparaît dans le brief. Un panneau est borné par l'écran, jamais par son contenu — mesuré : trois colonnes sur quatre rognaient en silence, la fiche demandait 1 310 px pour ce qu'on lui donnait. Un bloc ne s'écrase jamais pour tenir — la liste des modèles était tombée à 0 px et avait disparu entièrement. La gouttière de 9 px est réservée en permanence partout où ça défile, parce que 9 px qui apparaissent peuvent retirer une colonne entière de la grille au moment où l'on y cherche quelque chose. Le cran de zoom choisi reste choisi même devenu indisponible, et la barre le dit — le seul endroit du produit où l'on rend autre chose que ce qui est demandé, et il ne le fait jamais en silence. Un cran tient quand deux tuiles y tiennent, pas une. Et sur le tableau d'inspiration, tout objet déclare son échelle, écran ou plan. Rien de tout cela n'est de la peau, mais tout cela vit dans les mêmes fichiers que ce que la refonte va réécrire écran par écran.

*Ce qu’il fallait ajouter* — Une liste de garde, à vérifier écran par écran pendant la passe, avec ce qui a été mesuré pour chacune. Sans elle, ces six règles se perdront une par une et il faudra les repayer à l'usage, comme la première fois.

**11. La classe de fond manquante est un défaut plus grave que le brief ne le dit, et elle atteint le motif qu'il désigne comme le meilleur du produit.**

*Pourquoi ça compte* — Vérifié : `--color-signal-sourd` n'est défini nulle part dans la feuille de style, alors que le document le déclare (fond d'un segment actif et anneau de focus) et que deux endroits de `Tables.tsx` l'utilisent. Deux boutons actifs n'ont donc aucun fond. Or la suite de segments est très exactement ce que le brief appelle « le seul contrôle du produit dont l'état se lit sans bouger la souris » et « le motif le plus honnête de l'interface ». Il est cassé aux deux endroits qui en avaient le plus besoin. Et le même jeton est déclaré pour l'anneau de focus, qui utilise en réalité l'accent plein — donc le document décrit un jeton qui n'existe dans aucun de ses deux rôles annoncés.

*Ce qu’il fallait ajouter* — Le corriger avant toute autre chose, et corriger le document en même temps. Toute la thèse « repeindre le produit coûte une ligne » repose sur l'idée qu'aucune couleur ne vit hors de la table des noms ; c'est le seul contre-exemple, et il est dans le sens le plus dangereux — un nom sans valeur, qui ne lève aucune erreur.

**12. Ce qui doit tomber, et le brief n'ose pas assez : la phrase fausse sur le fond clair vit à trois endroits, dont un commentaire de feuille de style.**

*Pourquoi ça compte* — « Un fond clair remonte la luminance d'entourage et fausse le contraste perçu d'un sprite » est écrite dans `docs/DESIGN.md`, dans le journal des décisions au 26 août 2026, et en tête de `interface/src/index.css` (lignes 7 à 9). Le brief a raison : c'est l'inverse qui est vrai, un entourage sombre abaisse le contraste perçu, donc l'atelier pousse aujourd'hui à surcontraster. Mais il ne dit pas où la phrase vit. Le produit a déjà appris cette leçon-là : le 31 août 2026, une correction écrite dans un document et pas dans les deux autres endroits où la même promesse était inscrite a été notée comme une contradiction en attente. Si la phrase reste dans le commentaire du fichier de style, elle reviendra à la relecture suivante et refermera la décision.

*Ce qu’il fallait ajouter* — Retirer la phrase aux trois endroits en un seul geste, et garder l'autre moitié, qui est juste : un châssis chaud entre bien en concurrence avec les verts, les bruns et les ors. C'est cette moitié-là qui a écarté la maquette ambre, et elle survit intacte.

**13. Ce qui doit tomber aussi : les paliers de texte de 8,5 et 9,5 px, et le compte de trois glyphes.**

*Pourquoi ça compte* — Sur la typographie, le produit a déjà admis une fois que 9,5 px ne portait pas ce qu'on lui demandait — la méta de tuile est montée de 9,5 à 11 px le 31 août 2026 — et il n'a pas généralisé. Les vingt tailles distinctes et les 526 déclarations à 10 px ou moins que le brief mesure sont la conséquence directe de cette non-généralisation. Sur les glyphes, le compte de trois est périmé depuis le 28 août 2026 : la grille de six points est entrée ce jour-là avec sa règle d'admission, et le rond et le carré des prises sont devenus permanents dans la même passe. Le document le sait — le journal l'écrit en toutes lettres, « aucune icône illustrative n'avait jamais eu d'exception, elle en a une » — mais la section qui fait foi n'a jamais été mise à jour. Un troisième point du même genre traîne : la page qui fait foi dit encore « une infobulle que le produit s'interdit » alors que l'infobulle est entrée le 27 août 2026 avec un test binaire, et que le composant existe avec ses essais.

*Ce qu’il fallait ajouter* — Trois corrections d'inventaire, sans discussion de fond : monter le plancher, corriger le compte des glyphes en gardant leur règle d'admission (qui est plus forte que le plafond proposé), et retirer l'interdiction périmée de l'infobulle. Ces trois-là ne coûtent rien et enlèvent au brief trois de ses arguments — ce qui est le meilleur signe qu'elles étaient à faire.

**14. Ce qui doit tomber enfin : le favori qui n'existe qu'au survol, et les cibles sous 24 px.**

*Pourquoi ça compte* — Vérifié dans `Personnages.tsx` : le triangle du favori et la croix qui vide une case sont écrits en « caché, visible au survol du groupe », ce qui les retire de la navigation au clavier, et le triangle mesure 14 sur 14 pixels. Le produit n'a aucun argument à opposer, et il en a deux contre lui, écrits par lui-même : le 27 août 2026, une rangée d'étape est passée en désactivation logique plutôt que réelle avec ce commentaire — « la rangée redevient focalisable au clavier, ce qui est plutôt le bon comportement » ; et le carré de 9 px d'une étape garde délibérément une cible de 26 px. La règle existe, elle n'a simplement pas été appliquée ici.

*Ce qu’il fallait ajouter* — Rien à décider, seulement à réparer : cible de 24 px minimum, et visible si survolé OU choisi OU au focus clavier — le brief note lui-même que le produit a déjà écrit cette ligne correctement à un endroit.

### Les erreurs relevées dans le brief

- « Les deux onglets éteints sont écrits dans le gris le plus sombre, sans autre marque » — c'est faux depuis le 31 août 2026. Vérifié dans le code : `interface/src/composants/BarreChassis.tsx` porte en clair le commentaire « Un onglet éteint est en --texte-2, jamais en --texte-3 — corrigé le 31 août 2026 » et applique bien le gris moyen. Or c'est l'une des trois preuves sur lesquelles le brief appuie sa contrainte dure sur ce gris. Un défaut réparé cité comme vivant.

- « L'assistant se referme pour toujours dès l'étape 1 » — faux depuis le 1er septembre 2026. La décision « une seule humeur au lieu de deux » a été prise exactement pour ça, elle est écrite en tête de `Assistant.tsx` (lignes 44-45) et appliquée. Le brief la classe pourtant dans « ce qu'il ne faut pas perdre » comme un manque à corriger.

- « Le document dit aucun coin arrondi, le code en compte 224 — ce n'est pas grave mais ça retire l'argument contre un jeu d'icônes arrondi ». C'est une mauvaise lecture : le même document définit ses rayons cinq paragraphes plus loin (2, 3, 4 px, plus le rond réservé aux pastilles d'état). Les deux mots qui portent la règle sont « de confort » — un rayon de 2 px n'en est pas un, il existe pour que le 0 de la tuile se lise comme une décision et non comme un oubli. Et l'argument contre l'arrondi des formes dessinées est ailleurs, il est mesuré, et il tient : le pinceau de la main est passé du rond au carré le 31 août 2026 parce qu'un disque de rayon 2 sur un sprite de 64 pixels ne fait pas un bord net, il fait un escalier que personne n'a dessiné.

- « Le seul habillage qui crie c'est ici qu'on agit n'existe qu'à 7 ou 8 endroits sur environ 330 choses cliquables » — présenté comme une carence, c'est une règle écrite avec son coût. Le produit n'avait qu'un seul bouton plein, celui qui paie ; l'assistant lui en a donné un second le 1er septembre 2026, et la décision nomme la borne qui rend le second payable : les deux ne se rencontrent jamais, l'un vit dans l'assistant, l'autre dans l'établi. Compter les boutons pleins comme un manque revient à compter une discipline.

- « 109 soulignements posés sur du non-cliquable contre un seul cliquable souligné » — ce ne sont pas des soulignements égarés. C'est le pointillé, tranché le 27 août 2026 contre trente points d'interrogation dans les panneaux, et c'est la seule décoration du produit qui se comprenne sans être apprise (c'est le trait de l'abréviation). Le brief demande dans une piste de « rendre le soulignement au cliquable » et dans une autre de « garder le recueil de 135 explications » : le second est accroché au premier, il n'existe aucun autre point d'accroche.

- « Il n'y a aucune icône dans tout le produit — 5 dessins vectoriels, aucun pictogramme. » Le compte de 5 balises SVG est juste, mais les formes du produit sont dessinées en feuille de style, pas en SVG : la grille de six points qui dit « ça se saisit », le rond, le carré, et le triangle du favori (fabriqué avec des bordures, vérifié dans `Personnages.tsx`). Le produit a donc bien des pictogrammes, et surtout il a déjà une règle écrite pour en admettre un nouveau.

- « Le budget d'icônes est plafonné par la mesure : au plus vingt. » Le produit a déjà une borne, posée le 28 août 2026 et plus sévère : un dessin n'entre que là où aucun mot ne peut tenir et où la forme est lue sans apprentissage. Un plafond de vingt est un compte ; la règle existante est une condition. Vingt places libres admettent dix-neuf formes que la condition refuserait — le brief présente comme un resserrement ce qui est un relâchement.

- « La galerie dit noir sur blanc qu'un seul endroit paie par écran. » La galerie ne paie pas du tout : c'est la raison pour laquelle elle perd sa colonne de réglages de 300 px dans le document (« la galerie ne paie jamais, donc elle n'a rien à régler avant de payer »).

- Le brief compte douze étapes d'assistant à un endroit et raisonne ailleurs sur un document qui en décrit dix. Douze est juste depuis le 3 septembre 2026 (l'étape du style graphique s'est insérée en deuxième position) : c'est le document qui est en retard, pas le produit — et cette insertion a déjà cassé huit phrases qui renvoyaient à « l'étape 2 », ce qui a produit la règle « une étape se désigne par son nom d'abord, son rang ensuite ». Une refonte qui renumérote sans le savoir refera cette panne.

---
