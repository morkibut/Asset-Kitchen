// Le corpus des explications — un seul texte, trois rendus.
//
// « L'infobulle et le guide sont le même texte » (`docs/design-motifs.md` § Un seul
// corpus, trois rendus). Le panneau de 280 px rend les trois lignes d'une
// entrée ; l'écran Guide les rend toutes à la file, avec la version longue
// quand il y en a une. Une explication recopiée dans deux fichiers diverge en
// trois semaines, et c'est celle qui est sous les yeux au moment du doute qui
// sera la fausse.
//
// **Le troisième rendu est arrivé en R8** : la ligne écrite à demeure sous le
// titre d'une section, par `EnTeteDeSection`. Elle ne montre que `quoi` — la
// bulle y ajoute `change` et `origine` —, et elle ne s'écrit que là où l'on peut
// se tromper de section. Ce n'est pas un troisième texte, c'est le même montré
// une troisième fois : ce que la règle interdit n'a pas changé d'un mot, et
// c'est **recopier**.
//
// **Aucune entrée ne saute `change`.** Un réglage qui ne change rien en aval
// doit l'écrire dans ces mots-là — « Rien à la génération. » C'est le gabarit
// qui produit la réponse, pas la bonne volonté de celui qui rédige : sans champ
// obligatoire, `groupe` aurait reçu trois phrases sur le rangement, et la
// question qui a lancé ce chantier serait restée entière.
//
// **Ce corpus ne porte jamais une raison.** Ce qui refuse un geste — « aucune
// clé OpenRouter », « la quantification demande une palette » — vit dans une
// fente permanente sous le contrôle, et ne se survole pas (§ Le grisé porte sa
// raison). Une infobulle qui porterait une raison est un bug, pas un arbitrage.
//
// **L'ordre du fichier est l'ordre du guide**, et il suit l'ordre où l'on
// rencontre les choses : ce qu'on pose une fois, ce qu'on nomme, ce qu'on
// fabrique, ce qu'on juge, ce qu'on retouche, et ce qu'on règle une fois pour
// toutes.
//
// **Neuf groupes depuis E20, et trois d'entre eux sont l'univers coupé en
// trois.** Il aurait pu rester un seul sac, et c'était juste tant qu'il était un
// seul écran ; il a maintenant trois côtés qui ne se ressemblent pas — on
// regarde des images sur l'un, on remplit des cases sur l'autre. Chercher le mot
// *pointe* dans un sac où la moitié des entrées parlent de formulaires est
// exactement ce que la règle « un lieu, pas un thème » cherche à éviter.
//
// **Trois groupes portent le nom d'un écran qui n'existait plus.** `atelier`,
// `retouche` et `decoupe` nommaient l'écran de la V1 qui portait le prompt et la
// grille, le panneau de retouche, et la Découpe quand elle était un écran à elle
// seule. Les trois ont disparu de l'interface entre E1 et E4 ; leurs entrées,
// elles, étaient restées justes — *une entrée décrit un réglage, pas un écran*,
// et ce qui fait un détourage ne change pas parce que la pièce a changé de nom.

export type Explication = {
  /** Le nom du réglage, tel qu'il paraît à l'écran. */
  nom: string
  /** Ce que c'est. **Une phrase, jamais deux.** */
  quoi: string
  /** Ce que ça change. **Obligatoire**, et « Rien à la génération. » est une
   *  réponse — c'est même la plus utile de toutes. */
  change: string
  /** D'où ça sort : le projet, l'univers, le catalogue, une mesure, ou toi.
   *  Rendu en mono, parce que l'origine d'un défaut est un fait sur le monde. */
  origine: string
  /** La version longue, rendue par l'écran Guide seul. Le panneau de 280 px ne
   *  la porte jamais : au-delà de trois lignes, c'est le guide qu'on veut. */
  long?: string
  /** Où ça se règle, pour le sommaire du guide. **Un lieu, pas un thème** :
   *  quand on cherche une explication, on se souvient d'où l'on était.
   *
   *  Les trois premiers sont les trois côtés de l'univers ; les six autres sont
   *  ailleurs dans le produit. Le mot « Dans » n'est pas dans les noms : il est
   *  écrit une fois, en tête de chaque moitié du sommaire — répété neuf fois
   *  dans une colonne de 240 px, il mangerait la place pour rien. */
  ou:
    | "inspiration"
    | "jeu"
    | "ambiances"
    | "codex"
    | "etabli"
    | "galerie"
    | "tables"
    | "fabriques"
    | "reglages"
}

export const AIDE: Record<string, Explication> = {
  // ── L'univers — la bible ──────────────────────────────────────────────────
  //
  // Sept champs voisins dans le même bloc, tous du texte libre, et rien à
  // l'écran ne dit lequel porte quoi. C'est la forme exacte du défaut qui a
  // lancé ce chantier — `groupe` contre `famille` —, à sept exemplaires.

  "univers.bible": {
    nom: "Bible",
    ou: "jeu",
    quoi: "Sept champs nommés qui disent ce qu'est ton jeu — monde, époque, technique de rendu, trait, éclairage, vue et cadrage, contraintes techniques.",
    change:
      "Chaque champ actif et non vide part en tête du prompt, à chaque génération, sans que tu le retapes. Un champ éteint ne part pas : l'interrupteur est le doseur. L'écran de confirmation, qui s'ouvre entre le bouton et la dépense, montre le résultat exact — une ligne par champ, avec son interrupteur.",
    origine: "toi, une fois par projet · sept champs vides au départ",
    long:
      "Des champs nommés plutôt qu'un texte libre, et toute la différence est dans le geste : un texte libre est ce qu'on retape, des champs nommés sont ce qu'on dose. Tu peux relâcher le trait sans relâcher le monde, essayer une génération sans les contraintes techniques, et remettre l'interrupteur sans avoir rien réécrit.\n\nLa liste est close, et son ordre est celui de l'écran comme celui du prompt. Un champ de plus se paierait à chaque génération, en lecture et en décision.\n\nDeux d'entre eux sont arrivés après coup, et ils disent pourquoi la liste est close plutôt que libre : une séance sur trois projets réels a montré que la technique de rendu et le cadrage se retapaient dans chaque prompt, faute d'avoir où se poser. Ce ne sont pas deux libertés de plus, ce sont deux décisions déjà prises et écrites nulle part.\n\nLes intitulés partent en anglais — « World: », « Lighting: » —, parce que tous les modèles du catalogue sont entraînés dessus et qu'« Éclairage : » dégraderait ce que « Lighting: » obtient. C'est une traduction de fournisseur : elle ne remonte jamais dans le produit. Ton texte, lui, part exactement tel que tu l'as écrit.",
  },

  "bible.monde": {
    nom: "monde",
    ou: "jeu",
    quoi: "Où ça se passe et de quoi c'est fait — le lieu, la matière, l'ambiance.",
    change:
      "Part sous « World: » en tête du prompt, à chaque génération. C'est le champ qui tient la cohérence entre deux images faites à trois semaines d'écart.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.epoque": {
    nom: "époque",
    ou: "jeu",
    quoi: "Le moment technologique du jeu — ce qui existe déjà, et ce qui n'existe pas encore. Elle ne choisit rien à ta place : ce sont tes descriptions qui décident des armes, des vêtements et des outils.",
    change:
      "Part sous « Era: ». C'est ce qui empêche une arbalète de ressortir avec une lunette de visée. **Ce que cette case-là change dans l'image n'a pas été mesuré** — aucun banc ne l'a isolée, et il n'y en aura pas : deux mots dans un prompt ne valent pas huit tirages payés par branche.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.rendu": {
    nom: "technique de rendu",
    ou: "jeu",
    quoi: "Avec quoi l'image est censée être faite — pixel art, peinture numérique, trait encré, rendu 3D.",
    change:
      "Part sous « Rendering technique: ». C'est le champ qui décide de l'apparence là où elle se décide vraiment : dans ce que le modèle dessine, pas dans ce que le post-traitement lui fait ensuite.",
    origine: "toi · vide, donc ne part pas",
    long:
      "Il existe parce qu'une séance sur trois projets réels a trouvé les cinq champs de bible vides dans les trois — donc rien sur l'apparence ne partait — et pourtant tout ce qui sortait ressemblait à du pixel art de 64 pixels. La cause n'était pas dans le prompt : elle était après l'image, dans une remise sur grille systématique et une quantification qui s'allume dès qu'il y a une palette.\n\nCe champ rend la décision à la seule personne qui puisse la prendre. Il se lit avec la taille de pixel : « aucune » là-bas et « peinture numérique » ici, et le produit cesse d'imposer une apparence que tu n'as jamais posée.",
  },

  "bible.vue": {
    nom: "vue et cadrage",
    ou: "jeu",
    quoi: "D'où on regarde le sujet et jusqu'où on le voit — trois quarts, de face, de profil, plan large, corps entier.",
    change:
      "Part sous « View and framing: ». C'est ce qui évite qu'un personnage sorte de face et le suivant de trois quarts, alors que les deux doivent tenir dans la même scène.",
    origine: "toi · vide, donc ne part pas",
    long:
      "Il entre pour une raison mesurée : c'est, avec la technique de rendu, la consigne qui se retapait dans chaque prompt lors de la séance du 28 août 2026. Une consigne qu'on retape à chaque fois est une décision d'univers qui n'a pas de place où se poser.\n\nÀ ne pas confondre avec le barème d'échelles : celui-ci décide de la part de case qu'un sujet occupe *après* coup, par le rééchantillonnage. Ce champ-ci agit avant, sur ce que le modèle cadre. Les deux se complètent ; aucun ne remplace l'autre.",
  },

  "bible.trait": {
    nom: "trait",
    ou: "jeu",
    quoi: "Comment c'est dessiné : le contour, les aplats, les ombres.",
    change:
      "Part sous « Line and shading: ». C'est le champ le plus proche du rendu, donc le premier à relâcher quand tout se ressemble trop.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.eclairage": {
    nom: "éclairage",
    ou: "jeu",
    quoi: "D'où vient la lumière, et ce qu'elle laisse comme ombres.",
    change:
      "Part sous « Lighting: ». Deux sprites éclairés de deux côtés différents ne se montent pas dans la même scène.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.technique": {
    nom: "contraintes techniques",
    ou: "jeu",
    quoi: "Ce que l'image doit être, indépendamment de ce qu'elle montre — fond uni, une seule pose, aucun cadre.",
    change:
      "Part sous « Technical constraints: ». C'est le champ qui évite les pièges mesurés des modèles, et il agit en amont de tout le post-traitement.",
    origine: "toi · vide, donc ne part pas",
    long:
      "Deux phrases y valent leur place, et elles ont été payées au banc d'essai.\n\n« One single sprite, one pose only » — sans elle, Gemini rend spontanément une planche de trois poses : il calque la mise en page de son image de référence. Le piège est mesuré, pas supposé.\n\nUne consigne de fond uni, ensuite. Le détourage par défaut remplit depuis le bord et rend une silhouette propre sur un fond plat sans demander aucun réseau ; sur un fond chargé, mesuré, il garde 100 % de l'image — il échoue entièrement. Ce champ-là est donc ce qui garde le geste courant gratuit.",
  },

  // ── Les ambiances et les couleurs — le troisième côté de l'univers ────────
  //
  // **Les deux entrées d'ici décrivaient le modèle d'avant**, celui où il
  // n'existait qu'*une* palette, sans nom, attachée au projet et lue sur ses
  // artworks. Il a changé en E11 : une palette est devenue un objet nommé, en
  // plusieurs exemplaires, et une ambiance est un lot de style qui en porte une.
  // **Une explication fausse coûte plus cher qu'une explication absente** : on
  // la lit, et on la croit. Réécrites en E20.

  "univers.palette": {
    nom: "Une palette",
    ou: "ambiances",
    quoi: "Une liste de couleurs qui porte un nom, tirée d'un paquet d'images. Ton jeu peut en avoir autant que tu veux, et une chose du jeu n'en porte qu'une à la fois.",
    change:
      "La quantification ramène chaque pixel sur la couleur la plus proche de la palette en cours. Partout ailleurs, une couleur hors palette se marque au lieu d'être refusée.",
    origine: "toi · aucune palette au départ, et un jeu sans palette ne quantifie rien",
    long:
      "Le jeu en a une par défaut, et c'est celle que l'assistant montre : elle se lit **par calcul sur les artworks officiels**, et ne se saisit jamais. Elle porte l'empreinte des artworks qui l'ont produite — promouvoir une carte, en retirer une, ou changer le nombre de couleurs ne correspond plus, donc se recalcule tout seul.\n\nElle est lue sur le sujet, jamais sur le fond. La coupe médiane appliquée aux artworks tels quels rendait vingt gris sur vingt-quatre : le fond plat occupe 75 % des pixels et son anti-crénelage l'éclate en autant de seaux. On détoure donc d'abord, et la palette passe à quinze couleurs franchement distinctes. Corollaire à connaître : une région fermée reste opaque au détourage, donc l'intérieur d'un cadre d'interface entre dans la palette. C'est la même règle qui sauve l'os d'un squelette.\n\nLes autres se fabriquent côté Ambiances et couleurs, et ce sont des **recettes** : des sources — d'autres palettes, des paquets du tableau d'inspiration —, deux dosages, et des retouches. Une couleur du résultat dit d'où elle vient, et une couleur retirée reste montrée barrée : on doit pouvoir défaire.",
  },

  "univers.couleurs": {
    nom: "Couleurs demandées",
    ou: "ambiances",
    quoi: "Combien de couleurs on demande à la lecture d'un paquet d'images — le seul réglage qu'on ait sur une palette lue par calcul.",
    change:
      "Change la palette, donc le rendu de tout ce qui se quantifie ensuite. La changer relance le calcul sur les mêmes images, sans un appel payant.",
    origine: "toi · défaut 24",
  },

  "univers.fond": {
    nom: "Le fond du jeu",
    ou: "ambiances",
    quoi: "La couleur sur laquelle on demande que le sujet soit posé. Elle part dans le texte, avec une phrase qui interdit au modèle de l'employer sur le sujet lui-même.",
    change:
      "Ce que le modèle rend derrière le sujet, et donc ce que le découpage aura à retirer. Une couleur que rien dans ton jeu ne contient rend le découpage presque parfait ; sans fond posé, le modèle rend un gris clair — qui est aussi la couleur d'une joue, et le découpage la mange avec le fond.",
    origine: "toi · aucun fond au départ, et l'atelier en propose un sans jamais l'imposer",
    long:
      "L'atelier calcule la distance de quelques couleurs franches à la palette de ton jeu et te propose la première qui passe le seuil. **Il ne l'impose jamais** : s'il n'y a pas de candidat sûr, il le dit et laisse le fond en place plutôt que de choisir en silence. La distance employée est celle du découpage lui-même — un pixel est mangé avec le fond quand aucune de ses trois composantes ne s'en écarte de plus que la tolérance —, si bien que la question posée est exactement celle qui compte : *le découpage va-t-il manger une couleur de mon jeu ?*\n\nIl se corrige aussi **juste avant de payer**, sur l'écran de confirmation, et cette correction-là ne vaut que pour cet appel : elle ne remonte pas au jeu. C'est le même geste que corriger une ligne de texte avant de partir.\n\n⚠️ **Changer le fond change ce qui part au fournisseur.** Les images tirées avant ne se comparent donc plus à celles d'après — pas parce qu'elles sont moins bonnes, mais parce qu'on n'a plus demandé la même chose. C'est un prix accepté, pas un oubli.\n\nCe que ça a coûté de ne pas l'avoir : le produit demandait *un fond plat* sans dire lequel depuis le premier jour, et presque chaque image revenait avec un découpage à reprendre à la main.",
  },

  "ambiance.lot": {
    nom: "Une ambiance",
    ou: "ambiances",
    quoi: "Un lot de style réutilisable : une palette, des images de référence, et trois textes. On la désigne sur une chose du jeu.",
    change:
      "Rien tant qu'on ne s'en sert pas. Au moment de fabriquer, on choisit ce qu'on lui prend — tout, les couleurs seules, ou tout sauf les images —, et ce choix ne vaut que pour cet appel-là.",
    origine: "toi · aucune ambiance au départ",
    long:
      "Les palettes sont les ingrédients, les ambiances les recettes — c'est pour ça que les deux listes vivent au même endroit.\n\nSes trois textes remplacent ceux du jeu, champ par champ : le monde, l'éclairage, le trait. Ils ne s'ajoutent pas, ils prennent la place — et l'écran de confirmation le montre, ligne par ligne, la perdante barrée sous la gagnante. Éteindre les lignes d'une ambiance rallume donc les textes du jeu **d'elles-mêmes** : ils redeviennent la couche la plus haute qui reste candidate.\n\nCe qu'un appel lui a réellement pris est enregistré avec la génération. Sans ça, relire une vieille image ne dirait plus d'où venait ce qu'elle montre : le réglage aura changé, l'ambiance aura été retouchée, et le texte enregistré porte les mots sans dire lequel venait du jeu.",
  },

  // ── L'univers — ce qu'il impose ───────────────────────────────────────────

  "univers.cible_px": {
    nom: "Taille de pixel",
    ou: "jeu",
    quoi: "Le côté de case, en pixels, imposé à tout ce qui entre dans ce projet — ou aucune, et le rendu du modèle entre tel quel.",
    change:
      "Toute image née ici arrive déjà remise sur cette grille. Sur « aucune », il n'y a pas de remise sur grille du tout : le détourage, le recadrage et la palette continuent, l'occupation du barème cesse d'agir. Les assets déjà là ne bougent pas tout seuls — « Tout réaligner » est un geste, jamais un effet de bord.",
    origine: "toi, une fois par projet · défaut 64",
    long:
      "« Aucune » est une valeur, pas un réglage éteint : elle dit que ton jeu n'est pas en pixel art, et c'est la seule échappatoire à la seule étape que le projet imposait sans en avoir. Elle existe parce que le contraire produisait un atelier qui imposait une apparence que personne n'avait posée — toute image revenait sur 64 pixels, et rien à l'écran ne le disait.\n\nSur « aucune », « Tout réaligner » ne rééchantillonne rien et le dit avec son compte : il retire la grille des assets qu'il touche au lieu de leur en poser une.\n\nAvec une cible, elle est imposée et jamais déduite de l'image reçue. Dix modèles sur douze font dériver la taille du pixel d'une génération à l'autre : la grille rendue va de 7 à 20 px, facteur 2 à l'intérieur d'un même lot. Déduire la cible de ce qui revient reviendrait à laisser le fournisseur décider de l'échelle de ton jeu.\n\nRéaligner ne coûte rien — aucun appel payant, aucune image regénérée : les octets bruts sont là, et la recette se rejoue en millisecondes. Le balayage saute les assets ramenés au brut, parce que le vide est une décision : revenir à l'image d'origine est un seul geste, et lui reposer une grille le déferait.",
  },

  "univers.bareme": {
    nom: "Barème d'échelles",
    ou: "jeu",
    quoi: "La liste des natures de sujet de ton jeu — personnage, meuble, objet tenu, décor — et ce que chacune vaut.",
    change:
      "C'est lui qui remplit le contrôle Sujet de l'atelier. Une échelle porte trois choses à la fois : sa famille, sa hauteur, et si le sujet se détoure.",
    origine: "sept échelles au départ · mesurées le 27/08 sur sept sujets réels",
    long:
      "Sans barème, tout ce qui sort du produit fait la même hauteur. Ce n'est pas une coïncidence, c'est ce que donne mécaniquement une hauteur à 100 % : la case est remplie, donc tout la remplit — et un coffre ressort aussi haut qu'une prêtresse.\n\nLa hauteur se compte en personnages, et elle peut les dépasser : 300 % fait un bâtiment de trois personnages, et l'image revient d'autant plus grande. Jusqu'au 3 septembre 2026 elle était bornée au personnage, et c'est une famille entière d'assets que le produit ne savait pas commander — bâtiments, arbres, tours, portes de ville.\n\nTrois choses dans un seul objet parce que deux taxonomies — une pour l'échelle, une pour la famille — se paieraient deux fois à chaque génération. Dire « c'est un objet tenu en main », c'est du même coup dire quelle hauteur il fait et quels artworks partent avec lui. C'est ce qui garde un seul contrôle au moment de générer.\n\nLes sept échelles de départ sont des valeurs de départ, pas une table de vérité : un jeu où les personnages sont des insectes n'a rien à en faire.",
  },

  "bareme.famille": {
    nom: "famille d'une échelle",
    ou: "jeu",
    quoi: "La catégorie d'artworks qu'un sujet de cette nature ira chercher en référence.",
    change:
      "Choisir « objet tenu » à la génération envoie les artworks de la famille objets, plus ceux marqués « tous ». Le nombre de références change le coût.",
    origine: "toi · la famille d'origine de l'échelle",
    long:
      "C'est le même mécanisme que la famille d'une carte, pris par l'autre bout : la carte dit à quelle famille un artwork appartient, l'échelle dit quelle famille un sujet va chercher. Les deux se rencontrent au moment de générer, et rien d'autre ne décide de ce qui part.",
  },

  "bareme.occupation": {
    nom: "occupation d'une échelle",
    ou: "jeu",
    quoi: "La part du côté de la case qu'un sujet de cette nature remplit une fois sur grille, en pourcentage.",
    change:
      "C'est la valeur que la recette reprendra à la naissance de l'asset — 100 % pour un personnage, 40 % pour un objet tenu en main.",
    origine: "toi · mesuré le 27/08 sur sept sujets réels",
    long:
      "Deux images arrivent du fournisseur au même format. Si tu les remets simplement sur une grille de 64 px, le tonneau devient aussi grand que le personnage. L'occupation dit « ce tonneau remplit 45 % de sa case », et l'échelle redevient juste.\n\nElle se pose ici, une fois pour le projet, et pas génération par génération : tu ne veux pas rejouer ce calcul à chaque image. La fiche la porte quand même, pour les cas particuliers — mais y toucher épingle l'asset, qui cesse alors de suivre l'univers.",
  },

  "bareme.silhouette": {
    nom: "se détoure / plein cadre",
    ou: "jeu",
    quoi: "Si un sujet de cette nature a un contour, ou s'il occupe tout le cadre.",
    change:
      "« Plein cadre » retire le détourage et le recadrage de la recette posée à la naissance. C'est le réglage du décor : l'enfermer dans une case carrée lui ajouterait des bandes transparentes que personne n'a demandées.",
    origine: "toi · se détoure, sauf « décor »",
    long:
      "Le détourage suit la nature du sujet, pas un réglage de plus. Ne pas poser de passe suffit à dire « décor » : la remise sur grille lit déjà cette distinction — avoir demandé un détourage, c'est avoir dit que ce qu'on traite a une silhouette.\n\nLa remise sur grille, elle, reste de la partie dans les deux cas. Un décor aussi doit tomber sur le pixel du projet.",
  },

  "univers.modeles": {
    nom: "Modèle par famille",
    ou: "jeu",
    quoi: "Le moteur d'image proposé par défaut selon la famille du sujet — pas un réglage global.",
    change:
      "Choisir un sujet à l'atelier propose le modèle de sa famille. Une famille sans modèle retombe sur le défaut du catalogue ; ce n'est pas un trou, c'est un réglage qu'on n'a pas posé.",
    origine: "toi · aucun, donc le catalogue décide",
  },

  "univers.style": {
    nom: "style graphique",
    ou: "jeu",
    quoi: "Comment ton jeu est dessiné : en pixel art, avec des carrés de couleur visibles, ou en dessin, sans carrés apparents.",
    change:
      "C'est la question qui commande toutes les autres. Elle décide de ce que « la taille » veut dire, de ce qui part au modèle, et de ce que l'atelier fait de l'image au retour.",
    origine: "défaut du produit · en pixel art",
    long:
      "**En pixel art, la taille est le dessin.** Si tu dis 64, ton personnage *est fait* de 64 carrés. Un personnage de 32 et un de 128 ne sont pas la même image en deux tailles : ce sont deux dessins différents. Et passer de l'image du modèle à 64 carrés, c'est redessiner — c'est là qu'on perd des choses, et c'est tout le sujet du réglage « réduction ».\n\n**En dessin, la taille n'est qu'une finesse.** Ton personnage n'est pas « fait de 512 carrés », il est dessiné. 512 dit seulement combien de détail le fichier garde, et réduire de 1024 à 512 marche tout seul, sans bouillie — il n'y a rien à écraser.\n\n**Ce que le style change, concrètement :**\n\n· la question suivante — « combien de carrés ? » de 8 à 512, ou « quelle finesse ? » de 256 à 2048 ;\n· ce qui part au modèle — la phrase « 2D pixel art on a NxN grid » n'est envoyée qu'en pixel art ;\n· les couleurs — réduites à une palette finie en pixel art, gardées telles quelles en dessin, parce que réduire les couleurs d'un dessin en ferait une affiche sérigraphiée.\n\n**Changer de style ne rejoue aucune image déjà rendue.** Ce que le style décide entre dans les prochaines recettes, comme la taille de case. Si la taille posée n'a plus de sens dans le nouveau style — 64 carrés qui deviendraient une finesse de 64, c'est-à-dire une vignette —, elle passe au défaut du nouveau style et l'écran le montre tout de suite.\n\n**Godot ne demande rien de tout ça**, mais il a besoin d'une chose qui en dépend : le filtre de texture. « Nearest » en pixel art, sans quoi tes carrés deviennent flous ; « Linear » en dessin, sans quoi tes contours deviennent crénelés.",
  },

  "univers.detourage": {
    nom: "Le détourage de départ",
    ou: "jeu",
    quoi: "Comment l'atelier retire le fond d'une image qui revient, avant que tu y touches.",
    change:
      "Rien ne part au modèle et rien ne coûte : c'est un traitement fait sur ta machine, au retour. Une ligne laissée vide n'est pas un trou — le produit décide à ta place. Et changer un réglage ici ne retouche aucune image déjà faite.",
    origine: "toi · aucun, donc le produit décide",
    long:
      "Trois niveaux décident, dans cet ordre : la famille du sujet, puis la façon dont l'image est venue — toute seule, ou dans une planche découpée —, puis le produit. Une famille réglée l'emporte entièrement sur sa nature. La fiche de chaque image te dit ensuite lequel des trois a décidé, pour que tu saches où aller le changer.\n\nCe qui est livré vient d'un comptage fait sur tes propres recettes, le 3 septembre 2026 : sur les 123 détourages que tu as réglés à la main, le bord rongé suit le moteur employé et presque rien d'autre. Le moteur du bord le laisse à zéro quatre fois sur cinq — il découpe net et ne laisse pas de frange. Le moteur par modèle, lui, en laisse toujours une, et tu l'as rongée de deux pixels quatre fois sur cinq. Depuis cette tranche, changer de moteur amène son bord rongé avec lui, et une valeur que tu as déplacée toi-même n'est jamais réécrite.\n\nLa tolérance et le seuil de transparence ne sont pas ici, et c'est un choix : tu les as laissés à leur valeur livrée 96 fois sur 100. Ils se règlent sur une image, dans sa table de détourage, là où tu vois ce qu'ils font.",
  },

  // ── L'univers — le tableau d'inspiration ──────────────────────────────────
  //
  // Les deux premières entrées sont celles qui ont provoqué tout ce chantier :
  // voisines dans le même menu, l'une inerte et l'autre décisive, et rien à
  // l'écran ne les distinguait.

  "carte.groupe": {
    nom: "groupe",
    ou: "inspiration",
    quoi: "Un nom libre pour ranger les cartes du tableau. Vide = hors groupe.",
    change:
      "Rien à la génération. C'est un rangement pour l'œil. Ce qui décide des références envoyées, c'est artwork officiel + famille.",
    origine: "toi · aucun défaut",
    long:
      "Un tableau d'inspiration monte vite à cent cartes, et le groupe est ce qui te permet d'en retrouver douze. Il ne voyage nulle part : ni dans un prompt, ni dans une référence envoyée au fournisseur, ni dans un export. Tu peux le remplir, le changer, le vider sans qu'aucune image déjà produite ne bouge, et sans qu'aucune génération à venir ne change de résultat ni de prix.\n\nSi tu cherches le champ qui agit, c'est famille — juste à côté, dans le même menu.",
  },

  "carte.famille": {
    nom: "famille",
    ou: "inspiration",
    quoi: "La catégorie d'un artwork officiel : personnages, objets, décors, interface, ou « tous » pour une planche non figurative.",
    change:
      "Beaucoup. À la génération, seuls les artworks de la famille de ton sujet partent en référence, plus ceux marqués « tous ». Le nombre de références change le coût.",
    origine: "toi, en promouvant · défaut « tous »",
    long:
      "C'est le mécanisme qui empêche un artwork de contaminer un sujet qui n'a rien à voir avec lui. Au banc d'essai, un goblin figuratif laissé en référence a transmis sa tunique et ses bottes lacées au squelette généré ensuite : la famille est la réponse à ça.\n\n« Tous » est le cas particulier utile — une planche de matières, de palette ou d'échantillons de trait, qui accompagne toute génération sans transmettre de personnage. C'est le défaut, et c'est le bon défaut pour une planche de style.\n\nDeux conséquences à garder en tête : le compte de références est plafonné par modèle (le bloc « Ce qui part » affiche n / max, en rouge au-dessus), et chez certains fournisseurs le prix croît avec le nombre de références — un univers riche peut donc renverser le classement des modèles par coût.",
  },

  "carte.concept": {
    nom: "Concept art de",
    ou: "inspiration",
    quoi: "Les personnages qui se servent de cette carte comme référence.",
    change:
      "Elle part avec chaque génération de ce personnage-là, **quelle que soit la famille du sujet** — un artwork officiel se filtre par famille, un concept art a été désigné pour lui.",
    origine: "toi · les personnages viennent du projet",
    long:
      "Désigner ne déplace rien : la carte reste sur le tableau, à sa place, ni promue ni copiée en bibliothèque. Il n'y a pas de second endroit où ranger des images, et c'est ce qui évite d'en avoir deux qui divergent.\n\nUne carte peut servir à plusieurs personnages — d'où des bascules et non un choix unique. Le coin qui paraît en haut à gauche dit qu'elle sert ; celui d'en haut à droite dit qu'elle est un artwork officiel. Une carte peut porter les deux.",
  },

  "carte.officiel": {
    nom: "artwork officiel",
    ou: "inspiration",
    quoi: "Promouvoir une carte : elle cesse d'être une inspiration et devient une référence que l'application enverra toute seule.",
    change:
      "C'est l'interrupteur des références envoyées toutes seules : une carte non promue n'en devient jamais une, quoi qu'il y ait dans son groupe ou sa famille. Elle peut malgré tout partir si tu la désignes toi-même comme concept art d'une chose du jeu — c'est alors ton geste, pas une règle du projet.",
    origine: "toi · non promu par défaut",
    long:
      "Promouvoir est un geste unique : tu poses officiel et famille une fois, et l'application choisit seule à chaque génération. Il n'y a rien à sélectionner au moment de générer, et c'est délibéré — le cadrage du produit écarte explicitement la sélection manuelle des artworks, génération par génération.\n\nUn texte ne peut pas être promu : ce qui part en référence, ce sont des octets d'image, et la bible dit déjà ce qu'un texte aurait à dire.",
  },

  "carte.lecture": {
    nom: "ce que la palette y lit",
    ou: "inspiration",
    quoi: "La part de cet artwork qui donne ses couleurs au jeu. Pour voir ce qui a été mis de côté — en magenta, sur l'image en grand —, il faut ouvrir l'écran de découpe : ce bloc-ci donne le chiffre, pas l'image.",
    change:
      "Rien. C'est une mesure, elle ne règle rien : elle montre ce que l'application fait déjà de cette image.",
    origine: "mesuré sur l'image · rien n'est calculé tant que tu n'as pas cliqué",
    long:
      "Avant de tirer les couleurs d'un artwork, l'application en détoure le fond : un ciel, un mur, un carré uni derrière un personnage sont écartés d'eux-mêmes, et n'entrent pas dans la palette du jeu. C'est vrai depuis toujours, mais rien ne le montrait — d'où la question qui revenait à chaque promotion, « est-ce que mon fond va polluer mes couleurs ? ». Non.\n\nCe qui pollue vraiment, ce sont les voisins : un titre d'interface, une barre de vie, un second personnage dans le même cadre. Eux sont opaques, donc ils comptent. C'est là que découper la carte sert à quelque chose — pas pour retirer un fond, qui ne compte déjà pas.\n\nQuand rien n'est mis de côté, ce n'est pas une panne : une matière ou une texture qui remplit son cadre n'a pas de fond à retirer, et la palette prend l'image entière. L'écran le dit avec cette phrase-là plutôt qu'avec un « 0 % », qui voudrait dire l'inverse.",
  },

  "carte.decouper": {
    nom: "découper une carte",
    ou: "inspiration",
    quoi: "Couper une carte en plusieurs, ou la recadrer — sans quitter le tableau.",
    change:
      "Chaque morceau devient une carte du même tableau, dans la réserve, non promue. Ce sont des cartes et jamais des images produites : elles n'ont ni recette ni rendu.",
    origine: "toi · l'originale reste, sauf si tu demandes le remplacement",
    long:
      "Une planche trouvée porte souvent trois personnages sur un même fond. Découper en fait trois cartes, qu'on promeut séparément — et c'est ce qui compte pour la palette : ce n'est pas le fond qui la pollue, ce sont les voisins.\n\nLe remplacement n'existe qu'avec **un seul** rectangle, et c'est alors un recadrage : le morceau prend tout ce qui faisait l'originale — son groupe, sa note, sa place, sa promotion — et l'originale s'en va. C'est le seul endroit du produit où découper efface quelque chose, d'où la case décochée par défaut.",
  },

  "carte.note": {
    nom: "note",
    ou: "inspiration",
    quoi: "Une annotation libre sur une carte — pourquoi tu l'as gardée, ce que tu veux en retenir.",
    change: "Rien à la génération. Elle ne part nulle part, comme le groupe.",
    origine: "toi · aucun défaut",
  },

  "carte.source": {
    nom: "provenance",
    ou: "inspiration",
    quoi: "L'adresse d'où vient la carte, gardée telle quelle au collage.",
    change:
      "Rien à la génération. Elle est là pour créditer et retrouver : une image trouvée dont on a perdu la source est une image qu'on ne peut plus faire ni l'un ni l'autre.",
    origine: "le collage · vide si tu as collé des octets",
  },

  "carte.taille": {
    nom: "taille",
    ou: "inspiration",
    quoi: "La place qu'une carte occupe dans le tableau : 1×, 2× ou 4×.",
    change:
      "Rien à la génération. Ce sont les crans du zoom de la grille d'assets, réemployés — un seul vocabulaire de taille dans tout le produit.",
    origine: "toi · défaut 1×",
    long:
      "C'est un cran, et il vaut des deux côtés du tableau : dans la grille il décide du nombre de colonnes que la carte occupe, sur la toile il donne sa largeur de départ.\n\nÉlargir une carte sur la toile ne le change pas, et c'est voulu. La largeur libre est une place occupée sur un plan ; la taille est un cran que lit la grille. Une valeur unique pour les deux aurait fait qu'agrandir une carte pour lui donner du poids sur la toile change la grille de tout le monde.",
  },

  // ── L'Univers — la toile ──────────────────────────────────────────────────
  //
  // Une seule entrée, et c'est délibéré : la règle de cet écran tient en une
  // phrase, et si l'interrupteur qui l'ouvre doit l'expliquer, c'est ici.

  "tableau.vue": {
    nom: "Vue",
    ou: "inspiration",
    quoi: "Les deux façons de regarder le même tableau : la grille, qui montre tout d'un coup d'œil, et la toile, où une carte se pose où tu veux et garde sa place.",
    change:
      "Rien à la génération. Mais tirer une carte dans un îlot écrit son groupe, et l'en sortir le vide : sur la toile, composer et classer sont le même geste.",
    origine: "toi · la grille au départ · rien ne s'enregistre",
    long:
      "La règle tient en une phrase, et c'est tout ce qu'il y a à comprendre de cet écran : **la toile montre ce qui est classé, la réserve contient ce qui reste à classer.** Une carte groupée est dans son îlot, une carte posée sans groupe est sur le plan nu, et ce qui n'a ni l'un ni l'autre attend à droite.\n\nUn îlot *est* un groupe — pas un cadre indépendant. Il n'a ni nom propre ni existence propre : il est l'étendue de ses cartes. Le créer, c'est taper un nom de groupe dans le menu d'une carte, ou en tirer une dans un îlot voisin ; le vider de son dernier membre le fait disparaître, parce qu'un groupe sans carte n'est écrit nulle part — et pendant que tu tires cette dernière carte dehors, l'îlot vire au rouge et te dit ce qu'il emporte.\n\nUne carte peut être posée sans être classée : trois images côte à côte pour voir si elles vont ensemble avant de décider qu'elles font un groupe. Son pied dit « posée ».\n\n**Quatre gestes, et ils tiennent en quatre lignes.** *Tirer* une carte la pose et la classe. *Tirer un îlot par la bande de son titre* le déplace avec toutes ses cartes, sans rien reclasser — un clic au même endroit ouvre son menu, c'est la distance qui sépare les deux. *Tirer depuis la petite poignée* d'une carte ou du nom d'un îlot trace un lien vers ce qu'on lâche dessous. *Double-cliquer* sur le plan nu écrit une note à cet endroit-là — c'est une carte texte, tu la retrouves dans la grille. Le bouton **+ note** de la barre fait la même chose sans viser : en toile il pose le brouillon au milieu de ce que tu regardes, en grille il le fait naître en réserve. Le double-clic reste le geste précis, celui qui désigne l'endroit.\n\nCtrl+Z défait le dernier geste de composition — déplacer une carte ou un îlot entier, élargir, classer, déclasser, tirer un lien, le couper. Un îlot de douze cartes se défait d'un seul Ctrl+Z, pas de douze : la pile compte les gestes, pas les écritures. La pile vit dans l'onglet et meurt en quittant l'écran : ce n'est pas un historique de projet, c'est le rattrapage du geste en cours. Au retour, ce qui est sur le disque fait foi.",
  },

  // ── L'Univers — les liens, les notes et la couleur (T9) ───────────────────
  //
  // Cinq entrées pour quatre user stories, et aucune ne porte de raison : ce qui
  // refuse un geste — « ces deux-là sont déjà joints », « aucun îlot de ce
  // nom » — vit dans la fente de l'écran Univers, et ne se survole pas.

  "lien.mot": {
    nom: "mot d'un lien",
    ou: "inspiration",
    quoi: "Une étiquette courte posée au milieu d'un trait, pour dire *quel* rapport il montre.",
    change:
      "Rien à la génération. Un lien naît muet, et il reste muet tant que tu n'écris rien : un trait nu dit déjà « ceci a rapport avec cela », et c'est le cas courant.",
    origine: "toi · vide au tracé · 32 signes au plus",
    long:
      "Le défaut est muet, l'exception s'exprime. C'est ce qui rend le geste de tracer gratuit : si le mot était demandé au moment du tracé, il faudrait répondre à chaque trait à une question dont la réponse est presque toujours « rien ».\n\nLa borne de 32 signes n'est pas du confort. L'étiquette se pose entre deux objets qui peuvent être à trente pixels l'un de l'autre, et ce qui déborde recouvre ce qu'il relie. Au-delà, ce que tu veux écrire est une note — et une note se pose à même la toile.\n\nLe vider le retire, et le trait redevient ce qu'il était en naissant. Un lien qui porte un mot se survole par son mot ; un lien muet se survole par sa bande.",
  },

  "lien.pointe": {
    nom: "pointe",
    ou: "inspiration",
    quoi: "La flèche au bout d'un trait, quand le sens du rapport compte.",
    change:
      "Rien à la génération. Elle ne change que ce que le trait montre : sans elle il dit « ces deux-là ont rapport », avec elle il dit « celui-ci va vers celui-là ».",
    origine: "toi · sans pointe au tracé",
    long:
      "Elle se pose à l'arrivée, et l'arrivée est l'objet sur lequel tu as lâché : on tire du départ vers l'arrivée, et la pointe ne fait que rendre visible ce que le geste a déjà décidé.\n\nIl n'y a pas de troisième état — pas de double pointe, pas de retournement. Retourner un lien, c'est le couper et le retirer dans l'autre sens : deux gestes rares plutôt qu'un contrôle permanent sur chaque trait.",
  },

  "note.texte": {
    nom: "texte d'une note",
    ou: "inspiration",
    quoi: "Ce qu'une carte texte dit — l'intention que tu as posée au milieu des images.",
    change:
      "Rien à la génération. Une note ne part nulle part : ce qui voyage en référence, ce sont des octets d'image, et la bible dit déjà ce qu'un texte aurait à dire.",
    origine: "toi · au collage, au double-clic sur la toile, ou par « + note »",
    long:
      "Sur la toile, un double-clic sur le plan nu ouvre un champ à l'endroit exact où tu as cliqué, et ce que tu écris devient une note posée là. Un champ quitté vide ne crée rien, et Échap l'abandonne : le geste s'essaie sans rien casser.\n\nLe bouton **+ note** de la barre du tableau ouvre le même champ sans avoir à viser — au milieu de ce que la toile montre, ou en réserve quand tu es en grille, qui est très exactement l'endroit de ce qui n'est pas encore classé. C'est le seul chemin qui existe quand tu n'as pas déjà le texte dans le presse-papier.\n\nLe corriger ici plutôt que de retirer la note et de la recoller : recoller lui ferait perdre sa place, sa teinte et les liens qui y aboutissent.",
  },

  "note.teinte": {
    nom: "teinte d'une note",
    ou: "inspiration",
    quoi: "Une des dix couleurs sourdes, posée sur le fond d'une note.",
    change:
      "Rien à la génération, et rien au rangement non plus. C'est **le seul endroit du produit où une couleur ne veut rien dire** : elle est là parce que tu l'as choisie, jamais parce qu'un état la commande.",
    origine: "toi · sans teinte au départ",
    long:
      "La liste est fermée à dix, et il n'existe aucun sélecteur libre : le premier îlot rouge vif se lirait comme un échec. Les dix sont posées à la même clarté et sous le contraste de toutes les couleurs qui, elles, disent quelque chose — réussi, réglé à la main, raté, et l'accent du produit. Deux arcs de la roue sont interdits, et ce sont ceux des sémantiques : c'est pour ça qu'aucune n'est un rouge, un vert franc ou un ambre.\n\nUne carte image n'en porte aucune, et ce n'est pas un oubli : colorier chaque carte reconstruirait un second rangement, invisible dans la grille et concurrent du groupe. La couleur se pose sur ce qui rassemble — un îlot, une note —, jamais sur ce qui est rassemblé.\n\nLa dernière pastille n'est pas une couleur de plus : c'est le châssis, c'est-à-dire l'absence de teinte, montrée plutôt que dite.",
  },

  "ilot.teinte": {
    nom: "teinte d'un îlot",
    ou: "inspiration",
    quoi: "La même palette de dix, posée sur le cadre, le bandeau et le fond d'un îlot.",
    change:
      "Rien à la génération, et rien au groupe. Un îlot teinté et un îlot nu contiennent exactement les mêmes cartes, et envoient exactement les mêmes références.",
    origine: "toi · sans teinte au départ · part avec le dernier membre",
    long:
      "Elle ne vit pas sur les cartes de l'îlot : six membres feraient six réponses possibles pour un seul cadre. Elle vit avec le projet, une entrée par nom de groupe.\n\nCorollaire de « un îlot *est* son groupe » : quand la dernière carte en sort, l'îlot cesse d'exister, et sa couleur s'en va avec lui — comme les liens qui y aboutissaient. Ctrl+Z rend les trois d'un coup.",
  },

  // ── Le codex — l'inventaire du monde, et le seul endroit où l'on nomme ────
  //
  // **Un onglet entier sur trois, et le guide n'en disait pas un mot** — ni
  // visite, ni réglage. Écrit en E20.

  "codex.index": {
    nom: "Le codex",
    ou: "codex",
    quoi: "L'index de ce que ton monde contient, rangé par famille : personnages, décors, objets, interface, équipement. Chaque chose y porte ce qui lui manque encore.",
    change:
      "Rien à la génération. C'est de là qu'on ouvre l'établi d'une chose, et c'est le second des deux seuls endroits d'où l'argent part.",
    origine: "toi, au fur et à mesure · les cinq familles existent avant toute chose",
  },

  "codex.nommer": {
    nom: "Écrire un nom",
    ou: "codex",
    quoi: "La dernière rangée de la liste. On y tape le nom d'une chose, et la chose entre dans le codex sur-le-champ, dans la famille allumée à gauche.",
    change:
      "Rien à la génération : on nomme, on ne paie pas. Mais c'est ce qui permet de fabriquer une image qui n'appartient encore à rien, sans ouvrir un troisième endroit où l'argent part.",
    origine: "toi · vide, et seul au milieu de l'écran quand le monde l'est aussi",
  },

  "codex.vitrine": {
    nom: "La vitrine",
    ou: "codex",
    quoi: "L'image en grand, seule, pour la juger : sur le fond qu'on choisit, à la taille qu'elle fait vraiment, et à côté de ce à quoi on veut la comparer.",
    change:
      "Rien du tout, et c'est le point. Elle ne modifie aucune image et ne coûte pas un centime — la barre qui paie s'y retire, et son absence le dit avant qu'on ait lu quoi que ce soit.",
    origine:
      "trois portes · le codex, la fiche d'une chose, la planche d'une pose",
    long:
      "Ce qu'elle montre change avec la porte : tout le monde, toutes les poses d'une chose, ou les quatre vues d'une pose.\n\nElle se range ici et non dans la galerie parce que c'est le cinquième verbe du codex — il *montre*. Dans la galerie on n'ouvre qu'une image à la fois, et par un autre geste : pose le pointeur sur une vignette et appuie sur la barre d'espace, elle emplit l'écran. Ce raccourci vaut partout dans l'atelier, sans exception.",
  },

  // ── La fiche d'une chose du jeu — ses six parties (R8) ────────────────────
  //
  // **Elles sont ici pour être lues trois fois, pas deux.** Le corpus servait
  // la bulle au survol et le guide ; depuis R8 il sert aussi **la ligne écrite
  // sous le titre d'une section**, à demeure, sans qu'on survole quoi que ce
  // soit. Ce n'est pas un troisième texte, c'est le même montré une troisième
  // fois : corriger l'entrée corrige les trois affichages d'un coup.
  //
  // **La règle « un seul corpus, deux rendus » n'a jamais interdit d'écrire une
  // phrase à l'écran** — le produit en écrit 74 en dur dans dix-sept écrans, et
  // treize des quinze relues expliquent un réglage sans rien refuser. Ce
  // qu'elle interdit est de **recopier le corpus dans un second fichier**,
  // parce que les deux divergent en trois semaines et que la fausse sera celle
  // qu'on a sous les yeux. Lire l'entrée, c'est tenir la règle **mieux** que ne
  // la tenaient ces 74 lignes.
  //
  // **Elles sont préfixées `codex.` et non `fiche.`** : `fiche.*` est déjà pris
  // par la fiche d'une **image** dans la galerie, et deux écrans différents
  // sous le même préfixe se confondraient au premier ajout.

  "codex.chose.sujet": {
    nom: "Ce qu'il est",
    ou: "codex",
    quoi: "Le texte qui redit à la machine de qui il s'agit, et qui repart avec chaque image qu'on demande de cette chose.",
    change:
      "Il part dans le texte de chaque génération de cette chose, avant le reste. Sans lui, l'appel ne dit pas de quoi il s'agit et la machine invente.",
    origine: "toi · vide au départ",
  },

  "codex.chose.habillage": {
    nom: "Ce qui l'habille",
    ou: "codex",
    quoi: "Les sept textes de style qui décrivent le monde autour de la chose — le monde, l'époque, le rendu, la vue, le trait, la lumière, la technique.",
    change:
      "Ils partent avec chaque image. Par défaut ils viennent du jeu ; en réécrire un ici ne vaut que pour cette chose, et le texte remplacé reste lisible en dessous, barré.",
    origine: "le jeu, ou l'ambiance choisie, ou toi",
  },

  "codex.chose.exemples": {
    nom: "Ses images d'exemple",
    ou: "codex",
    quoi: "Les images qu'on joint à la demande pour montrer le style visé, et qui sont disponibles pour chaque image de cette chose.",
    change:
      "Rien tout seul. Ce qui part vraiment se coche juste avant de payer — mais une image qui n'est pas retenue ici n'y sera pas proposée.",
    origine: "le tableau d'inspiration, les images déjà faites, toi",
  },

  "codex.chose.poses": {
    nom: "Ce que le jeu réclame",
    ou: "codex",
    quoi: "Les attitudes que cette chose doit avoir : repos, marche, course pour un personnage ; fermé, ouvert, vidé pour un coffre.",
    change:
      "Rien à la génération. C'est cette liste qui décide du nombre de cases à remplir, donc de ce que le tableau de droite compte.",
    origine: "le type d'objet · plus ce que cette chose s'est ajouté",
  },

  "codex.chose.faites": {
    nom: "Ce qui est fait",
    ou: "codex",
    quoi: "Les images qui existent déjà pour cette chose, une par attitude remplie.",
    change:
      "Rien du tout, et c'est le point : on regarde, on ne modifie rien et on ne paie rien.",
    origine: "les images faites · le manque n'a pas de couleur, il est en cours",
  },

  "codex.chose.matrice": {
    nom: "Sa matrice",
    ou: "codex",
    quoi: "Le tableau des attitudes de cette chose, avec ce qui les remplit, et il change pendant qu'on règle à gauche.",
    change:
      "Rien à la génération. Ranger une attitude retire sa ligne et son coût — le compte des rangées reste écrit à côté, pour qu'un tableau plein obtenu en rangeant ne passe pas pour un travail fini.",
    origine: "les images faites, comptées par le serveur",
  },

  "codex.bande.image": {
    nom: "L'image choisie",
    ou: "codex",
    quoi: "Une image de l'animation, et ce qu'on lui a fait à elle seule : de combien elle a été poussée, et de quel clip elle vient.",
    change:
      "Cette image-là, et aucune autre. C'est toute la différence avec les réglages de gauche : ceux-là valent pour l'animation entière, celui-ci ne corrige qu'une pose qui tombe à côté.",
    origine: "prise dans le clip · poussée à la main",
    long:
      "Les flèches la déplacent d'un pixel du sprite ; avec Maj, de cinq. On peut aussi la faire glisser à la souris.\n\nAux bords, les flèches cessent d'avoir un effet plutôt que de rogner l'image. C'est voulu : une correction qui mangerait un bras ne se verrait pas ici, et se découvrirait dans le jeu.\n\nLa remplacer par une autre image du clip ne coûte rien : le clip est déjà payé, et il porte toutes ses images. Une bande peut ainsi prendre ses images dans deux clips différents — chaque image dit alors d'où elle vient.\n\nL'image d'avant, montrée en transparence sous celle-ci, est ce qui permet de juger un déplacement au lieu de le deviner.",
  },

  // ── L'établi — ce qu'on touche à chaque génération ────────────────────────

  "reglages.modele": {
    nom: "modèle",
    ou: "etabli",
    quoi: "Le moteur d'image qui fabriquera la génération, choisi dans une liste où plusieurs fournisseurs se mélangent — chaque ligne dit qui le propose.",
    change:
      "Le prix, le rendu, et deux plafonds : le nombre de références acceptées et le nombre de variations possibles. Un modèle qui ne peut pas honorer ta demande reste visible et grisé, avec sa raison — jamais remplacé en silence.",
    origine: "les catalogues · chaque ligne dit d'où vient sa fiche",
    long:
      "Un modèle se nomme par deux choses ensemble : qui le propose, et son nom chez lui. C'est nécessaire depuis qu'il y en a plusieurs — deux fournisseurs peuvent offrir un modèle du même nom, et le nom seul ne dirait plus lequel a fait l'image. Tu le retrouves partout : sur la ligne du choix, sur la fiche d'une image, et dans la liste des dépenses.\n\nTous ne demandent pas la même chose. L'un veut une clé, un autre ne demande rien du tout — et c'est celui-là qui fait qu'une image peut arriver sur une machine où rien n'a été déposé. Ce qui manque à un fournisseur grise ses modèles à lui, et eux seuls ; les autres restent choisissables.\n\nLe catalogue est une photo, pas un flux : il est relu au démarrage et par le bouton Catalogue, et chaque ligne dit si sa fiche vient d'être relue chez le fournisseur ou si elle a été relevée à telle date. Hors ligne, le produit sert la dernière photo reçue — générer reste actif, et c'est le seul endroit du produit où l'on propose puis refuse, assumé, avec la conséquence écrite sous le bouton.\n\nLes réglages propres à un modèle ne sont écrits nulle part dans le code de l'interface : ils sont dessinés depuis ce que le catalogue déclare. Un modèle qui gagne un réglage demain l'affiche demain.",
  },

  "reglages.proportions": {
    nom: "proportions",
    ou: "etabli",
    quoi: "Le rapport largeur / hauteur de l'image demandée au fournisseur.",
    change:
      "La forme de ce qui revient, avant tout post-traitement. Les valeurs que le modèle choisi n'accepte pas sont grisées, jamais cachées.",
    origine: "le modèle choisi · défaut 1:1",
    long:
      "Toujours imposé, jamais laissé au défaut du fournisseur : sans lui, Gemini part en 16:9 et Seedream en 1:1. Deux essais cessent alors d'être comparables, et un sprite n'est plus cadrable.",
  },

  "reglages.variations": {
    nom: "variations",
    ou: "etabli",
    quoi: "Combien d'images partent d'un seul clic — 1, 2 ou 4.",
    change:
      "Multiplie le prix à l'identique : 4 variations, ce sont 4 appels et 4 fois le coût. Ce ne sont pas 4 images différentes demandées, ce sont 4 tirages de la même demande.",
    origine: "toi · défaut 1",
    long:
      "Un **lot d'attitudes** les éteint, et c'est l'inverse exact : quatre variations, ce sont quatre appels pour la même demande ; neuf attitudes cochées ensemble, c'est **un seul appel** pour neuf demandes différentes. Les deux ne se combinent pas — c'est tout l'intérêt du lot, et le refus le dit plutôt que de ramener silencieusement les variations à un.\n\nCe qu'un lot risque est écrit à côté du prix : si le nombre d'images revenues n'est pas celui demandé, **rien n'entre** et le lot se relance au prix plein. C'est le seul refus automatique du produit, et il est arithmétique. Tout le reste — ressemblance entre cases, dérive de grille — s'affiche case par case et ne bloque jamais : deux planches sur vingt-quatre, à l'essai qui a décidé de la méthode, avaient le compte juste et répétaient une pose. Le contrat était tenu, la planche sans valeur, et c'est à toi de le voir.",
  },

  "reglages.sujet": {
    nom: "sujet",
    ou: "etabli",
    quoi: "La nature de ce que tu fabriques — un personnage, un objet tenu en main, un décor — choisie dans le barème de ton univers.",
    change:
      "Trois choses d'un seul geste : quels artworks partent en référence, quel modèle est proposé par défaut, et quelle part de la case le sujet occupera une fois sur grille.",
    origine: "le barème de l'univers · aucun sujet par défaut",
    long:
      "C'est le seul contrôle que le tableau d'inspiration ajoute à la barre qui paie, et il porte trois conséquences parce que deux taxonomies — une pour l'échelle, une pour la famille — se paieraient deux fois à chaque génération.\n\nSans sujet choisi, seules les planches marquées « tous » partiront en référence : c'est écrit sous le contrôle, en clair, plutôt que laissé à deviner.\n\nLe barème lui-même se pose dans l'univers, côté Réglages du jeu, une fois pour le projet. C'est lui qui dit qu'un personnage remplit 90 % de sa case et une fiole 40 % — et c'est ce qui met un tonneau et un personnage à la même échelle de pixel.",
  },

  "atelier.import": {
    nom: "Importer",
    ou: "etabli",
    quoi: "Faire entrer une image de ton disque dans la bibliothèque — par le bouton, ou en la déposant sur la grille.",
    change:
      "Elle devient un asset entier : elle se retouche, se découpe, se réinjecte, s'exporte et se supprime comme celles que tu as payées. Sa fiche dit « importé » et un coût nul, et son nom est celui du fichier.",
    origine: "ton disque · le même geste que l'agent a depuis le serveur MCP",
    long:
      "Un appel par fichier, et chacun répond pour lui-même : douze fichiers déposés ensemble font entrer les onze images et nomment le douzième s'il n'en est pas une. Les onze premières paraissent sans attendre que la douzième soit lue.\n\nSi les mêmes octets sont déjà dans ce projet, rien n'entre : le doublon est signalé avec un lien vers l'image existante, et « Importer quand même » reste offert. C'est exactement la règle du tableau d'inspiration, et la portée est la même — ce projet-ci, pas toute la bibliothèque : la même référence a de bonnes raisons de servir dans deux jeux.\n\nRien de tout cela ne demande le réseau, et rien ne coûte un centime.",
  },

  "atelier.import.traitement": {
    nom: "brute ou traitée",
    ou: "etabli",
    quoi: "Ce que le projet appliquera à l'image qui entre : rien du tout, ou sa recette — détourage, taille de pixel, palette.",
    change:
      "Sur « brute », l'image entre aux dimensions du fichier et sa recette reste vide — c'est le même mot que la visionneuse de la fiche, et il veut dire la même chose. Sur « traitée », elle arrive habillée comme une image générée ici.",
    origine: "toi · défaut « brute »",
    long:
      "Le défaut a changé, et c'est une correction : l'import héritait de la recette du projet en silence, donc une référence de 2048 pixels revenait à 64 sans que personne l'ait demandé.\n\nLe choix vaut pour la séance et pour les deux gestes — le bouton et le dépôt —, plutôt que d'ouvrir une question à chaque fichier : douze fichiers déposés ensemble poseraient douze fois la même.\n\nUne image entrée telle quelle le reste : « Tout réaligner » ne la touche pas, parce qu'une recette vide est une décision, pas un oubli. C'est la même règle qui protège un asset ramené au brut.",
  },

  "atelier.apercu": {
    nom: "Ce qui partira",
    ou: "etabli",
    quoi: "Le texte exact envoyé au modèle, rangé en trois parties : le contexte — ce que ton jeu est —, les références — ce que chaque image jointe est —, et la demande — ton sujet, les consignes de planche, et la caméra qui ferme le texte.",
    change:
      "Rien à la génération tant que tu le lis — c'est une lecture, pas un réglage. « Reprendre le texte » en fait le contenu du champ : ce que tu écris alors part mot pour mot, sans que l'atelier ajoute quoi que ce soit.",
    origine: "composé par l'atelier · l'ordre est celui de l'envoi",
    long:
      "Il existe pour une raison mesurée : sur trois projets réels, la bible était vide dans les trois, donc rien du style ne partait — et pourtant tout ce qui sortait se ressemblait. Sans voir ce qui part, il n'y a aucun moyen de savoir si ce qu'on obtient vient du prompt ou du post-traitement.\n\nLe texte n'est pas recomposé à l'écran : il est demandé à l'atelier, par le chemin même que la soumission emprunte. Deux compositions écrites à deux endroits finiraient par diverger, et celle qui compte est celle qui part.\n\nReprendre le texte ne touche pas à ton univers : les textes du jeu restent exactement ce qu'ils étaient, et la reprise ne vaut que pour cette génération-là. Ce qui est parti reste attaché à la génération, au même titre que le modèle et le coût — reprendre les réglages d'un asset, des mois plus tard, renvoie donc exactement le même texte.\n\nRien d'autre ne change en mode repris : le sujet choisi décide toujours des artworks qui partent, du modèle proposé et de la part de case ; le gabarit d'un lot part toujours.\n\nCe texte se lit désormais sur **l'écran de confirmation** : le tiroir replié sous le champ a disparu en E14, parce que deux réponses à la même question finissent par n'en avoir qu'une de vraie.",
  },

  "envoi.ecran": {
    nom: "L'écran de confirmation",
    ou: "etabli",
    quoi: "Ce qui s'ouvre entre le bouton et la dépense. Il montre, ligne par ligne et rangé en trois parties, tout ce qui va être envoyé — le contexte du jeu, les références, la demande — avec un interrupteur sur chacune et son prix à côté.",
    change:
      "Rien tout seul : c'est une relecture. Ce qu'on y éteint ou corrige ne vaut que pour cet appel-là, et rien ne remonte dans les réglages du jeu ni dans l'ambiance.",
    origine: "composé par l'atelier · l'ordre est celui de l'envoi",
    long:
      "Garder une correction est un **second geste, écrit** : le bouton « garder sur la chose » l'inscrit sur la fiche de la chose visée, et il ne paraît que là où il a une case où aller. Sans chose visée, la correction part quand même — ce qui manque est l'endroit où la garder.\n\nLe sujet et la consigne de la pose ne s'éteignent pas, et leur marque grise le dit : sans le premier l'appel ne demande rien, sans la seconde l'image qui revient n'appartient à aucune case.\n\nUne case le saute **pour la série en cours**, et il revient dès qu'on change de chose ou de pose. Il n'y a pas de case « pour toujours » : on la cocherait le premier jour, quand on ne sait pas encore qu'on en aura besoin.\n\nOn y lit aussi, en gris, ce qui n'agira qu'**au retour** — le découpage, la remise sur grille, le détourage. Rien de tout ça ne part au modèle et rien ne coûte un centime, mais l'image qu'on verra revenir n'est pas celle que le modèle envoie, et il vaut mieux le savoir avant.\n\n**Les trois parties sont celles du texte qui part**, et les mots qui les annoncent — CONTEXT, REFERENCES, REQUEST — partent avec, en anglais, comme les intitulés de la bible. Chaque image jointe porte son numéro sur sa ligne, et le même numéro dans le texte : « Image 3 » à l'écran est « Image 3 » chez le modèle. La caméra reste la dernière phrase, parce qu'un modèle d'image pondère la fin — trente images payées l'ont établi.\n\n**Ce rangement ne promet aucune image meilleure**, et c'est mesuré : cinq façons de ranger ont été tirées, aucune n'a battu le texte d'avant. Ce qu'il donne à coup sûr est un texte qu'on relit sans démêler un pavé.",
  },

  // ── Le calibrage ──────────────────────────────────────────────────────────
  //
  // **Cinq entrées, dont une écrite le 30 août 2026 et jamais lisible** (R9) :
  // elle était complète, juste, et accrochée à rien — aucun composant ne la
  // citait. Poser le pointillé sur le nom de l'outil a suffi à la brancher.
  //
  // **Son `quoi` a changé, et c'est le cœur de la tranche.** Il disait ce que
  // l'outil *est*, et pourquoi il n'est pas dans la barre des tables — une
  // raison de construction, juste, mais qui n'apprend rien à qui ouvre l'écran
  // sans savoir à quoi il sert. Il dit maintenant **le défaut qu'il répare**,
  // parce que c'est cette phrase-là que l'écran écrit en tête, à demeure :
  // *un outil montre le défaut qu'il répare avant de proposer de le réparer.*
  // La raison de construction est descendue dans `long`, où elle attendait.
  "etabli.calibrage": {
    nom: "Le calibrage",
    ou: "etabli",
    quoi: "Les poses d'une même chose ne sortent pas toutes à la même hauteur, et cet outil les remet toutes à la même — sans rien redessiner et sans rien payer.",
    change:
      "Il réécrit la taille rendue des poses qu'on lui désigne. Le défaut qu'il corrige est mesuré : six poses du même personnage, même recette, sont sorties à 64, 60, 64, 53, 64 et 43 pixels de haut — un bras tendu élargit la boîte du sujet, et la mise sur grille rétrécit tout le reste.",
    origine:
      "la matrice de l'établi, qui marque en doré les poses hors taille commune",
    long:
      "Il travaille sur toutes les poses à la fois, et c'est pour ça qu'il n'est pas dans la barre des tables : la barre parle de l'image ouverte, lui écrit dans les autres.\n\nIl n'écrit que dans l'**occupation**, qui existait déjà et qui est une part de la case : c'est ce qui fait qu'un changement de taille de case ne défait aucun calage. Et il n'épingle pas — un calage n'est pas une main posée sur une image.\n\nIl ne coûte rien : aucun appel payant ne part d'ici.",
  },

  "calibrage.occupation": {
    nom: "occupation",
    ou: "etabli",
    quoi: "La part de la case que la chose occupe en hauteur — à cent pour cent elle touche le haut et le bas, à quatre-vingts elle flotte.",
    change:
      "La taille à laquelle elle apparaîtra dans le jeu, et rien d'autre. Comme c'est une part et non un nombre de pixels, changer la taille de la case plus tard ne défait aucun calage.",
    origine: "la recette de l'image · l'outil la réécrit, la main aussi",
  },

  // **`calibrage.decalage` et non `decalage`** : `superposition.decalage` existe
  // déjà et parle d'autre chose — de combien un calque glisse sur le corps qu'il
  // habille. Deux réglages qui portent le même mot dans deux outils sont deux
  // entrées, jamais une seule qui essaierait de couvrir les deux.
  "calibrage.decalage": {
    nom: "décalage",
    ou: "etabli",
    quoi: "De combien la chose est poussée à gauche ou à droite dans sa case.",
    change:
      "Où elle se trouve dans la case, pas sa taille. Il sert à recentrer une pose dont le geste déporte la silhouette — un bras tendu, une arme levée.",
    origine: "cet outil seul · il ne part jamais dans une recette qu'on nomme",
  },

  "calibrage.reference": {
    nom: "la référence",
    ou: "etabli",
    quoi: "La pose à laquelle on compare les autres à l'œil — c'est presque toujours le repos, la première qu'on a dessinée.",
    change:
      "Rien du tout : elle décide seulement quelle silhouette est montrée à demi effacée dans l'empilement. Elle ne décide pas de la hauteur commune.",
    origine: "toi · la première pose au départ",
  },

  "calibrage.mise_de_cote": {
    nom: "mettre de côté",
    ou: "etabli",
    quoi: "Sortir une pose du calage commun — on le fait pour une pose couchée ou accroupie, qui est basse pour de bonnes raisons.",
    change:
      "Elle cesse de tirer la hauteur commune vers le bas, donc les autres cessent d'être rapetissées à cause d'elle. Sa case, elle, se remplit et se compte comme avant.",
    origine:
      "toi · l'outil la propose quand une pose est très en dehors des autres",
  },

  // ── Les tables — les sept places de la recette ────────────────────────────
  //
  // **L'ordre ne se négocie pas**, et c'est ce que ces entrées ont à dire avant
  // tout le reste : trois places n'ont aucun sens avant celle qui les précède.
  // Rien ne peut se recadrer avant qu'un alpha dise où est le sujet.

  "etape.detourage": {
    nom: "Détourage",
    ou: "tables",
    quoi: "La première place de la recette : trouver le fond et le rendre transparent.",
    change:
      "Tout ce qui suit en dépend — le recadrage cherche le sujet dans l'alpha, la grille mesure son occupation dessus. C'est aussi l'étape la plus chère : environ 130 ms, contre 28 pour les quatre autres réunies.",
    origine: "posé par l'univers quand le sujet a une silhouette",
    long:
      "Une étape, mais plusieurs passes possibles. Une passe est un moteur avec ses réglages ; deux passes s'enchaînent sur le résultat de la première, ce qui permet d'attaquer un fond en deux temps — un remplissage large, puis un durcissement de contour.\n\nSéparé de la finition dans le code pour une raison qui se voit à l'usage : bouger un curseur de grille ou de couleurs ne relance pas le détourage, et la retouche reste instantanée. Un cran de tolérance, lui, coûte la seconde et demie complète.",
  },

  "detourage.moteur": {
    nom: "moteur",
    ou: "tables",
    quoi: "Comment le fond est trouvé : « bord » part des bords de l'image, « pipette » part d'un point que tu désignes, « modèle » demande une silhouette à un réseau.",
    change:
      "« Bord » et « pipette » ne demandent aucun réseau et répondent en dizaines de millisecondes ; « modèle » coûte une à deux secondes par passe. Le rendu diffère surtout sur les images qui n'ont pas de fond plat.",
    origine: "mesuré le 27/08 sur 12 images · défaut « bord »",
    long:
      "Le remplissage depuis le bord est le moteur du geste courant : sur douze images issues de six modèles, PNG et JPEG, il a rendu douze silhouettes propres — squelette blanc sur fond gris clair et fioles translucides comprises.\n\nSa règle tient en un mot : relié. Un pixel n'est du fond que s'il est relié à un bord par une chaîne de pixels proches de la couleur de bordure. C'est ce qui le distingue d'un seuil global, qui perce le sujet — l'os d'un squelette et le reflet d'une fiole ont la couleur du fond sans y être reliés.\n\nEt c'est aussi ce qui lui interdit une chose. Un creux de fond entièrement entouré par le sujet — la lumière entre un bras et un torse, le trou d'une anse, l'intérieur d'un anneau — n'est relié à aucun bord : aucune valeur de tolérance ne l'atteindra jamais, parce que le chemin n'existe pas. La pipette est là pour ça, et pour rien d'autre : tu désignes ce creux du doigt, et il part.\n\nLes deux premiers moteurs ont été confrontés le 27 août sur six vraies images plus un cas composé. Sur ce que le produit fabrique — fond plat — le bord et le modèle s'accordent à 96,3 % en médiane : le second n'apporte rien, et c'est ce qui justifie qu'il reste facultatif. Sur un fond chargé, le bord garde 100 % de l'image — il échoue entièrement — quand le modèle en isole 19,8 %. C'est sa raison d'être, et elle se mesure.",
  },

  "detourage.couleur": {
    nom: "couleur visée",
    ou: "tables",
    quoi: "Le point que tu as cliqué dans l'image, et la couleur qu'il y avait dessous — c'est de là que la pipette part.",
    change:
      "Tant qu'aucun point n'est posé, la passe ne retire rien du tout. Recliquer ailleurs déplace le point de cette passe, sans en créer une deuxième.",
    origine: "toi · cliquée dans l'image",
    long:
      "Ce qui est gardé est le point, pas la tache qu'il désigne, et ce n'est pas un détail. Une tache est une zone d'un seul tenant que l'atelier retrouve à chaque rendu : elle change de rang et de place dès qu'un réglage au-dessus bouge d'un cran, et ta recette se mettrait alors à viser autre chose sans rien dire. Un point, lui, ne bouge pas.\n\nLa couleur, elle, n'est pas gardée : elle se lit sous le point à chaque fois. Une couleur écrite à côté du point qui la porte serait une copie que plus rien ne met à jour.\n\nLe point est compté sur l'image d'origine — celle d'avant tout traitement —, comme le rectangle de recadrage. C'est pour ça que tu vises sur elle et pas sur le rendu.",
  },

  "detourage.portee": {
    nom: "portée",
    ou: "tables",
    quoi: "Ce que la pipette retire depuis ton point : « cette tache » ne retire que la zone d'un seul tenant sous le curseur, « partout » retire toutes les zones de cette couleur dans l'image.",
    change:
      "« Cette tache » règle un creux sans toucher au reste — c'est le geste pour lequel la pipette existe. « Partout » va plus vite et atteint aussi ce qui touche le sujet : un reflet, un œil, une dent de la même couleur que le fond partiront avec.",
    origine: "toi · défaut « cette tache »",
    long:
      "« Cette tache » veut dire : la zone d'un seul tenant que tu vois, et rien d'autre. Elle s'arrête à ce qui reste de l'image — jamais elle ne traverse ce qu'une passe précédente a déjà effacé.\n\nCette phrase a été écrite le 1er septembre 2026, et elle répare un défaut. Effacer un pixel ne change pas sa couleur ; ça ne change que sa transparence. Une seconde pipette lisait donc un fond qui, pour elle, était encore là, elle s'y propageait de proche en proche et ressortait ailleurs dans l'image — sur une zone qui n'avait rien à voir avec le point désigné, et qui à l'écran ne le touchait même pas. Entre les deux il n'y avait que du damier.\n\nDeux réponses étaient possibles : montrer d'avance la zone que la pipette prendra, ou l'empêcher de traverser ce qui n'est plus là. C'est la seconde qui a été retenue, parce qu'elle rend le geste prévisible au lieu de rendre sa surprise lisible.",
  },

  "detourage.silhouette": {
    nom: "modèle",
    ou: "tables",
    quoi: "Quel modèle va chercher la silhouette, du plus rapide au plus lourd. Le rapide est ce que tu obtiens sans rien demander.",
    change:
      "Le lourd trouve un meilleur bord sur les silhouettes difficiles — des cheveux, une frange, un objet ajouré — et met plusieurs secondes par image au lieu d'une demi-seconde. Le choix se fait passe par passe : deux passes du même détourage peuvent employer deux modèles.",
    origine: "toi · défaut « rapide »",
    long:
      "Le détourage par modèle n'en connaissait qu'un seul, écrit dans le code. C'était une liste en dur là où la règle de la maison dit que le catalogue décide — et il fallait toucher au code pour en essayer un autre.\n\nUn modèle est un fichier de plusieurs centaines de mégaoctets, et il n'est pas dans le produit : il descend la première fois qu'on s'en sert, puis il reste. Deux absences se ressemblent et ne se traitent pas pareil. Si le moteur par modèle n'est pas installé du tout, il est grisé avec sa raison : rien ne le rendra choisissable sans une installation. Si le moteur est là mais que ce modèle-ci n'est pas encore descendu, il reste choisissable, et l'atelier dit ce qu'il va rapatrier et ce que ça pèse avant de partir. Griser les deux t'aurait envoyé faire à la main un téléchargement que l'atelier sait faire ; les confondre t'aurait laissé attendre plusieurs minutes sur un geste annoncé comme lent de quelques secondes.\n\nUne recette qui nomme un modèle absent de ta machine ne casse rien : cette passe-là n'agit pas, les autres places s'appliquent, et l'image sort. C'est la même règle que pour une passe masquée — ce qui n'agit pas n'empêche pas le reste d'agir.",
  },

  "detourage.trace": {
    nom: "forme entourée",
    ou: "tables",
    quoi: "La forme que tu as tracée à main levée autour du sujet, dans l'image. Elle se referme toute seule : le geste est d'entourer, pas de dessiner une ligne.",
    change:
      "Rien tant qu'elle est vide. Une fois tracée, l'atelier cherche le bord du sujet à l'intérieur de ce que tu as entouré et ne touche à rien au-dehors. Retracer remplace la forme de cette passe ; retirer la passe défait le geste d'un coup.",
    origine: "toi · tracée dans l'image",
    long:
      "C'est la sélection magique des logiciels d'image, et elle répond à ce que ni le détourage automatique ni la retouche au pixel ne savent faire : le premier décide tout seul et se trompe parfois, la seconde demande de suivre un contour au pixel près, ce qui est très long sur une silhouette entière.\n\nTu traces gros, et c'est voulu : ton trait ne devient jamais le contour du sprite. Il borne la recherche. L'atelier part du liseré de ta forme — des pixels de fond, puisque tu as entouré large — et remplit vers l'intérieur jusqu'à buter sur le sujet. Ce qui sort est le bord du sujet lui-même, trouvé dans les pixels, pas ta main.\n\nElle vit avec le détourage et non avec la main : c'est une quatrième façon de désigner ce qu'on retire, à côté du bord, de la pipette et du modèle, et un seul endroit décide de ce qui est effacé. Elle agit donc avant le recadrage et la mise sur grille, qui ont tous les deux besoin de savoir où est le sujet — tant que le fond est là, la boîte du sujet, c'est toute l'image.\n\nLa forme ne voyage pas. Coller les réglages sur une autre image ou enregistrer une recette sous un nom la laisse derrière : c'est une coordonnée, comme le point de la pipette et comme le rectangle de recadrage, et une silhouette entourée sur une attitude tomberait à côté sur l'attitude suivante.",
  },

  "detourage.masquee": {
    nom: "masquer une passe",
    ou: "tables",
    quoi: "Retire cette passe du calcul le temps que tu regardes. Elle garde tous ses réglages, et « montrer » rend exactement l'image d'avant.",
    change:
      "L'image se refait sans elle, et c'est tout ce que ça fait. Masquer n'est pas retirer : retirer la perd, masquer la met de côté. Toucher un de ses réglages la remontre — poser une valeur, c'est dire qu'on veut cette passe.",
    origine: "toi · défaut visible",
    long:
      "Plusieurs passes s'enchaînent et tu ne vois que leur somme : impossible de savoir laquelle a mangé quoi. C'est le même geste que d'endormir une table, un cran plus bas, et la même règle — ce qu'on éteint garde ses réglages.\n\nUne passe supplémentaire travaille bien sur le résultat de la précédente, mais seulement à moitié, et c'est cette moitié qui surprend. La transparence s'accumule et ne se rend jamais : chaque passe ne peut que serrer ce que la précédente a laissé. La couleur, elle, ne bouge pas — effacer un pixel ne change pas sa couleur.\n\nC'est de là que venait le défaut de la pipette sur une seconde passe, corrigé le 1er septembre 2026 : la tache repartait à travers le fond déjà effacé, qui avait gardé sa couleur et formait un couloir invisible, et elle ressortait ailleurs dans l'image. Mesuré sur une image d'essai : 120 pixels pris sur une zone qui ne touchait pas le point désigné. Depuis, la propagation s'arrête à ce qui reste.",
  },

  "detourage.tolerance": {
    nom: "tolérance",
    ou: "tables",
    quoi: "Jusqu'où une couleur peut s'écarter du fond et compter quand même comme fond — l'écart toléré sur chaque composante de couleur.",
    change:
      "Monter mange le sujet par les bords ; descendre laisse un halo de fond autour de lui. Chaque cran relance le détourage : environ 1,5 s.",
    origine: "toi · défaut 28",
    long:
      "C'est pour ce réglage que le curseur du produit envoie ce qu'on a lâché et non ce qu'on a traversé. Mesuré au navigateur : un cran de tolérance coûte 1 492 ms au serveur, et un glissement sur vingt crans, c'était vingt appels sérialisés — une demi-minute de file pendant laquelle l'image défilait des valeurs que personne n'avait demandé à voir.\n\nLa valeur sous le curseur suit ta main tout de suite. Le rendu, lui, attend que tu lâches.",
  },

  "detourage.seuil_alpha": {
    nom: "seuil alpha",
    ou: "tables",
    quoi: "Au-dessus de cette valeur un pixel appartient au sujet, en dessous il appartient au fond. 0 à 255.",
    change:
      "Tranche les contours à demi transparents. Sans ce durcissement, un rééchantillonnage au plus proche voisin les décide à pile ou face, et deux passes identiques rendent deux silhouettes différentes.",
    origine: "défaut du produit · 128",
    long:
      "C'est le réglage qui évite le liseré clair autour d'un sprite, et le liseré naît ici, pas ailleurs. Un pixel de contour à peine visible, dont la couleur est déjà celle du fond, passe le seuil et ressort franchement opaque — de la couleur du fond. Baisser ce seuil l'efface, ronger un pixel de plus aussi.\n\nCe paragraphe accusait la quantification, et c'est faux : mesuré sur six images, elle met la transparence de côté et la remet telle quelle. Elle ne fait que ramener la couleur de ces pixels-là sur ta palette. Y toucher ne changera jamais rien au liseré.\n\nD'où l'ordre fixe des étapes : le seuil se durcit avant la réduction sur grille, jamais après.",
  },

  "detourage.durcissement": {
    nom: "durcissement",
    ou: "tables",
    quoi: "Combien de pixels sont rongés au bord de la silhouette après le seuil, de 0 à 4.",
    change:
      "Retire un liseré résiduel quand le seuil seul n'a pas suffi. Trop haut, il grignote les détails fins — une lame, une antenne, un doigt.",
    origine: "toi · défaut 0",
  },

  "etape.recadrage": {
    nom: "Recadrage",
    ou: "tables",
    quoi: "La deuxième place : rogner l'image sur la boîte opaque du sujet.",
    change:
      "Ramène le sujet contre les bords de son image. Sans lui, l'occupation de l'étape suivante se mesurerait sur du vide, et deux sujets cadrés différemment ne sortiraient pas à la même échelle.",
    origine: "posé par l'univers quand le sujet a une silhouette",
  },

  "recadrage.marge": {
    nom: "marge",
    ou: "tables",
    quoi: "Combien de pixels de l'image d'origine sont gardés autour de la boîte opaque du sujet.",
    change:
      "Élargit le recadrage. Sans marge, le sujet touche les quatre bords de son image recadrée — ce qui gêne les étapes suivantes et l'export.",
    origine: "toi · défaut 0",
  },

  "fiche.recette": {
    nom: "Sa recette",
    ou: "galerie",
    quoi: "Les places du traitement qui sont posées sur cette image, avec ce que chacune vaut.",
    change:
      "Rien : c'est une lecture. La fiche dit ce que l'image est ; les tables disent ce qu'on lui fait, et c'est là qu'on la règle — sur l'image en grand, ce que 380 pixels de colonne ne permettaient pas.",
    origine: "l'image elle-même",
  },

  "detourage.poches": {
    nom: "poches de fond enfermées",
    ou: "tables",
    quoi: "Les zones de fond que le sujet entoure complètement, et que le remplissage depuis le bord n'atteint donc pas : il n'y mène aucun chemin, à aucune tolérance.",
    change:
      "Rien, tant que tu n'y touches pas. Le produit les compte et propose de retirer les plus grandes ; il n'en efface aucune tout seul. La lumière entre un bras et un torse est du fond, l'intérieur d'un cabochon de lanterne est de la matière, et rien dans les pixels ne dit lequel des deux tu regardes. « La retirer › » ajoute simplement une passe pipette déjà visée dessus, qui s'annule comme les autres.",
    origine: "mesuré sur l'image détourée",
    long:
      "Seules les plus grandes sont listées, et c'est une décision prise à la mesure plutôt qu'au jugé. Sur les soixante images du dépôt, détourées au réglage courant, une image porte quarante-trois de ces zones en médiane et jusqu'à seize mille — mais les trois quarts font un à trois pixels : du bruit de compression qui se trouve avoir la couleur du fond. Aucun seuil de taille ne sépare proprement le bruit du reste, c'est une longue traîne sans marche. On montre donc celles dont on se demande vraiment si c'est du fond ou de la matière, et le compte entier est écrit à côté.\n\nCe bloc annonçait longtemps zéro partout, et c'était une erreur, corrigée le 31 août 2026 : il lisait les trous de la silhouette, qui sont l'inverse exact. Un trou est du transparent — le détourage l'a déjà retiré. Une poche est encore opaque, justement parce que le détourage n'a pas pu l'atteindre. L'ancien bloc ne trouvait donc la poche qu'une fois celle-ci retirée, c'est-à-dire au moment où il n'y avait plus rien à proposer.",
  },

  "detourage.fond": {
    nom: "le fond, tel qu'il est revenu",
    ou: "tables",
    quoi: "Deux nombres, et la couleur de fond que cette image-là porte vraiment — lue sur ses bordures, jamais celle qu'on avait demandée. *Les pixels à demi transparents* sont ce que le découpage a laissé au bord ; *les pixels encore à la couleur du fond* sont ceux du sujet qu'un cran de tolérance de plus emporterait.",
    change:
      "Rien : c'est une lecture. Ce qu'elle sert à décider est ailleurs — le bord rongé, juste au-dessus, pour les premiers ; la couleur de fond du jeu, dans l'assistant, pour les seconds.",
    origine: "mesuré sur l'image détourée",
    long:
      "**Ces deux nombres remplacent un banc d'essai.** La tranche qui a fait du fond un réglage du jeu réclamait d'abord huit tirages payants par branche avant sa première ligne de code ; l'auteur l'a retiré le 2 septembre 2026. La raison tient : le fond est devenu un réglage, pas une valeur imposée — si la couleur choisie donne un moins bon résultat, on la change en un geste et on le voit sur l'image suivante. Un banc aurait mesuré pendant trois heures ce que l'usage dit en trois images.\n\nCe qui prend sa place se lit **sur les images qu'on voulait de toute façon**, et c'est la doctrine du dépôt sur les notes de qualité, appliquée pour la première fois à un réglage d'envoi.\n\nLa couleur montrée est celle qui est *revenue* et non celle qu'on avait demandée : comparer la couleur demandée à elle-même n'aurait rien mesuré. Un écart entre les deux est une information — c'est la dérive du modèle, et c'est elle qui dit de combien il faut se tenir à l'écart de la palette du jeu.",
  },

  "bords.taches": {
    nom: "taches effacées",
    ou: "tables",
    quoi: "Toutes les taches opaques de l'image, de la plus petite à la plus grande, avec celle où le seuil tombe.",
    change:
      "Rien par elle-même : c'est la liste de ce que le curseur au-dessus va faire. Le trait bleu marque le seuil — au-dessus ce qui s'efface, au-dessous ce qui reste.",
    origine: "mesuré sur l'image détourée",
  },

  "recadrage.boite": {
    nom: "ce qu'on garde",
    ou: "tables",
    quoi: "Deux valeurs, et une seule agit. *La boîte du sujet* est le plus petit rectangle qui contient tout ce qui n'est pas transparent : elle est mesurée, et remesurée chaque fois que le détourage change. *Une boîte tracée* est un rectangle qu'on a posé soi-même sur l'image, et qui ne bouge plus.",
    change:
      "Le recadrage s'arrête à ce rectangle-là, et non à ce que le sujet occupe. C'est le seul moyen de garder une part de fond que rien ne rend opaque — l'ombre portée d'un sprite, l'auréole d'une lanterne. La seconde valeur ne se choisit pas dans la colonne : on trace sur l'image, et le segment bascule tout seul. Le premier segment est le clic qui défait.",
    origine: "mesurée sur l'alpha, ou tracée par toi",
    long:
      "Une boîte tracée n'agit que quand elle **coupe** le sujet, et la table le dit sous le rectangle. Plus large que lui, elle est sans effet sur le rendu : la remise sur grille recherche elle-même la boîte du sujet et rogne dessus, si bien que le surplus transparent disparaît de toute façon. C'est la même mécanique qui rend la marge sans effet quand une case est posée.\n\nElle ne voyage pas non plus. Quatre coordonnées ne veulent rien dire sur une autre image : posées sur une plus petite, elles tombent en partie hors du cadre ; posées sur un sujet cadré autrement, elles coupent n'importe où. C'est la règle générale du produit — un réglage voyage, une coordonnée ne voyage pas.",
  },

  "tables.zoom": {
    nom: "le pour cent d'agrandissement",
    ou: "tables",
    quoi: "À quelle taille l'image est montrée dans la table. Libre entre 1 et 250 %, écrit à la main ou réglé par *plus* et *moins* ; la molette approche et recule, et le point qu'on vise ne bouge pas de sous le pointeur.",
    change:
      "Rien à l'image — c'est une loupe, pas un réglage. *100 %* rend exactement un pixel d'image pour un pixel d'écran ; *ajusté* fait tenir l'image entière dans le cadre, et c'est ce qu'on obtient en ouvrant une table.",
    origine: "toi · ajusté à l'ouverture",
    long:
      "Ailleurs dans le produit — la grille de la galerie, la vitrine — l'agrandissement ne prend que des multiples entiers : un sprite montré à une échelle qui n'est pas entière fabrique des pixels qui n'existent pas, et on jugerait alors un défaut né de la fenêtre où on l'a regardé. Cette règle appartient à ce qui **montre** une image ; la table est ce qui la **travaille**, et on n'y règle rien sans pouvoir approcher et reculer librement.\n\nL'avoir appliquée ici a coûté cher : une image d'origine de 1 024 pixels de côté dans un cadre de 606 ne pouvait pas descendre sous 100 %, donc on n'en voyait qu'un coin — et ce coin étant transparent, l'écran ne montrait que le damier. La table de recadrage paraissait cassée alors qu'elle marchait.",
  },

  "tables.png": {
    nom: "PNG ↓",
    ou: "tables",
    quoi: "Télécharge l'image telle qu'elle est sous les yeux — le rendu, ou le brut quand on regarde le brut.",
    change:
      "Rien : c'est une copie. L'image reste dans la bibliothèque, sa recette aussi, et le fichier reçu est celui qu'on voyait.",
    origine: "l'état courant de la table",
  },

  "quantification.tramage": {
    nom: "tramage",
    ou: "tables",
    quoi: "Comment les couleurs qui n'existent pas dans la palette sont approchées : par la plus proche, ou par un mélange de points.",
    change:
      "Sans tramage, un dégradé réduit à seize couleurs se pose en bandes franches. Avec, les bandes se mêlent en un semis de points — ce qui ressemble davantage au pixel art d'époque et ce qui, sur un sprite de 64 px, se voit beaucoup.",
    origine: "toi · défaut aucun",
  },

  "etape.grille": {
    nom: "Grille",
    ou: "tables",
    quoi: "La troisième place : remettre le sujet sur la grille de pixel du projet.",
    change:
      "C'est l'étape qui rend le produit possible — elle met toutes tes images sur le même pixel. Posée systématiquement, jamais en option : une grille qui a dérivé est le cas normal, pas l'incident.",
    origine: "posée par l'univers, toujours",
  },

  "grille.cible": {
    nom: "taille de pixel",
    ou: "tables",
    quoi: "Le côté de la case, en pixels logiques — la taille finale de ton sprite avant export.",
    change:
      "C'est l'étape qui rend le produit possible : elle remet toutes tes images sur le même pixel. Elle est demandée, jamais déduite de l'image reçue.",
    origine: "l'univers du projet, sinon toi · défaut 64",
    long:
      "Dix modèles sur douze font dériver la taille du pixel d'une étape à l'autre. Sans cette remise sur grille, les frames d'un même personnage ne partagent plus le même pixel, et un petit objet ressort plus grossier que le personnage qui le porte.\n\nDéduire la cible de l'image reçue reviendrait à laisser le fournisseur décider de l'échelle de ton jeu. C'est pour ça qu'elle se demande.\n\nLa ligne au-dessus du réglage dit sur quoi tu travailles : quand le modèle a vraiment peint des carrés, l'atelier les retrouve et te donne combien l'image en compte. C'est un renseignement, pas une décision — le chiffre ne se pose jamais tout seul.",
  },

  "grille.du-modele": {
    nom: "les carrés du modèle",
    ou: "tables",
    quoi: "La taille des carrés que le modèle a vraiment peints dans l'image qu'il t'a rendue — ou rien, quand il n'en a peint aucun.",
    change:
      "Rien. C'est une lecture, pas un réglage : elle te dit ce que l'image contient avant que tu choisisses la taille juste en dessous.",
    origine: "mesuré sur l'image détourée, à chaque ouverture de la table",
    long:
      "Tu demandes du pixel art ; le modèle rend ce qu'il veut. Deux jeux de ce dépôt ont demandé exactement la même chose et n'ont pas reçu la même chose : l'un a reçu des carrés bien visibles, l'autre une peinture aux dégradés fins alors que sa consigne réclamait mot pour mot une grille stricte de 64.\n\nQuand les carrés sont là, l'atelier les retrouve et te dit combien l'image en compte. Demander plus de carrés que ce nombre-là ne fabrique aucun détail : il n'y en a plus à récupérer, et tu obtiendras des blocs coupés en deux plutôt qu'un sprite plus fin.\n\nQuand il n'y a pas de carrés du tout, l'atelier le dit et se tait. C'est la bonne réponse : sur une peinture, il n'y a rien à retrouver, et inventer un chiffre te ferait travailler sur une mesure fausse. La taille redevient alors entièrement ton choix — ce qu'elle est de toute façon, l'atelier ne la déduit jamais de l'image reçue.\n\nMesuré sur les 149 images du dépôt : sur le jeu qui a reçu des carrés, l'atelier en annonce sur 26 images sur 27 ; sur le jeu qui a reçu des peintures, il se tait sur 24 sur 26.",
  },

  "grille.occupation": {
    nom: "hauteur",
    ou: "tables",
    quoi: "La hauteur du sujet, comptée en personnages : 100 % en fait un, 300 % en fait trois.",
    change:
      "C'est elle, et non la taille de l'image d'origine, qui met un tonneau et un personnage à la même échelle de pixel. Au-delà de 100 %, l'image revient plus grande.",
    origine: "le barème de l'univers via le sujet · défaut 100 %",
    long:
      "Le réglage le plus important du produit, et le moins évident. Deux images arrivent du fournisseur au même format ; si tu les remets simplement sur une grille de 64 carrés, le tonneau devient aussi grand que le personnage. La hauteur dit « ce tonneau fait 45 % d'un personnage », et l'échelle redevient juste.\n\nElle peut passer 100 %, et c'est ce qui rend un bâtiment, un arbre ou une tour fabricables : 300 % veut dire trois personnages de haut, et l'image revient trois fois plus grande. Le carré, lui, ne change jamais de taille — c'est la règle des jeux 2D, et l'enfreindre se voit tout de suite : deux tailles de pixel dans une même scène, ça s'appelle des « mixels », et l'œil les repère aux bords. Ce qui change entre un personnage et un bâtiment, c'est le nombre de carrés, jamais leur dimension.\n\nLe plafond dépend de ta case : un sujet ne monte pas au-delà de huit personnages, et pas au-delà de ce qu'une image de 2048 carrés peut porter — la plus basse des deux bornes gagne.\n\nC'est pour ça que le barème vit dans l'univers et se pose une fois : tu ne veux pas rejouer ce calcul à chaque génération.",
  },

  "grille.ancrage": {
    nom: "ancrage",
    ou: "tables",
    quoi: "Le point de la case par lequel le sujet est accroché, quand il ne la remplit pas entièrement. Neuf au choix : les quatre coins, les quatre milieux de bord, et le centre.",
    change:
      "Décide de l'alignement entre deux frames du même personnage. En bas par défaut, parce qu'un personnage se tient debout sur le bord bas de sa case.",
    origine: "défaut du produit · bas",
    long:
      "Deux frames d'une même animation posées au centre flotteraient l'une par rapport à l'autre : le personnage semblerait monter et descendre entre deux images. Le bas est le bon défaut pour tout ce qui pose au sol.\n\nLes huit autres existent pour ce qui ne se tient pas debout. Une icône ou un objet d'inventaire tient par son centre ; une flamme au bout d'une torche et une bannière suspendue tiennent par leur haut ; une porte qui pivote tient par son côté.\n\nIl n'y en avait que deux avant le 4 septembre 2026, le bas et le centre, et c'était assez tant qu'on posait des images isolées. Une animation, elle, a un point fixe, et ce point n'est pas toujours au milieu d'un bord.",
  },

  "grille.methode": {
    nom: "réduction",
    ou: "tables",
    quoi: "Comment l'image passe de ses milliers de pixels aux carrés de la case. Quatre façons, qui rendent quatre sprites différents.",
    change:
      "C'est un choix de style, pas un classement : le vote rend un sprite calme, les traits épaissis un sprite détaillé, la réduction douce une image floue mais lisse, et « au plus proche » un résultat brut.",
    origine: "défaut du projet · vote en deux temps",
    long:
      "Réduire une image de mille pixels à soixante-quatre carrés, c'est jeter quatre-vingt-dix-neuf pixels sur cent. Ce qu'on garde, et comment, décide de tout.\n\n**Au plus proche** garde un pixel sur N et jette les autres sans les regarder : un trait fin a une chance sur N de survivre. C'est ce que l'atelier faisait avant, et c'est un tirage au sort.\n\n**La réduction douce** fait la moyenne de chaque bloc. Rien n'est perdu, mais tout est mélangé : les contours deviennent des dégradés, ce qui convient à un dessin réduit et pas à un sprite.\n\n**Le vote en deux temps** regarde quelle couleur domine chaque case pour décider la forme, puis peint la case avec la moyenne des pixels d'origine de cette couleur-là. On obtient un trait net sans perdre les nuances.\n\n**Les traits épaissis** dilatent les lignes fines avant de réduire, pour qu'elles survivent au lieu d'être noyées. Une lance ou un fil reste un trait continu ; en échange, le contour est plus agité.\n\nLe projet donne le départ ; cette image-ci garde le dernier mot. Changer la méthode ne coûte rien : aucun appel payant ne part d'ici.",
  },

  "etape.quantification": {
    nom: "Quantification",
    ou: "tables",
    quoi: "La quatrième place : ramener l'image à un nombre fini de couleurs, celles de la palette du projet.",
    change:
      "Donne au rendu sa cohérence de palette. Elle vient après la grille et jamais avant : quantifier 1024 px pour les jeter ensuite coûte cent fois plus pour le même résultat.",
    origine: "posée par l'univers quand il a une palette",
    long:
      "Elle est déterministe, et c'est un critère du produit : une recette nommée, réappliquée ailleurs, donne exactement le même résultat. La coupe médiane de Pillow ne tire rien au sort ; une initialisation tirée au hasard — un k-means++, par exemple — rendrait deux images différentes pour la même recette.\n\nElle force l'alpha à 255 sans toucher à la couleur. C'est la seconde moitié du piège du liseré : un pixel de contour à peine visible qui a survécu au seuil ressort opaque, de la couleur du fond. Le seuil alpha se durcit avant, jamais après.",
  },

  "quantification.palette": {
    nom: "palette",
    ou: "tables",
    quoi: "Les couleurs auxquelles l'image sera ramenée — celles de l'univers du projet, montrées ici en lecture seule.",
    change:
      "Rien à régler ici. La palette du jeu se déduit par calcul de ses artworks officiels, et les autres se fabriquent dans l'univers, côté Ambiances et couleurs ; la poser à la main ferait deux vérités sur la même chose.",
    origine: "l'univers du projet · absente s'il n'a aucun artwork officiel",
  },

  "quantification.couleurs": {
    nom: "couleurs",
    ou: "tables",
    quoi: "Sur combien de couleurs l'image est ramenée.",
    change:
      "Donne au rendu sa cohérence de palette. Cette étape s'applique après la réduction sur grille, jamais avant — quantifier 1024 px pour les jeter ensuite coûte cent fois plus pour le même résultat.",
    origine: "toi · défaut 32",
  },

  "etape.bords": {
    nom: "Nettoyage des bords",
    ou: "tables",
    quoi: "La cinquième et dernière place : effacer les taches trop petites pour être le sujet.",
    change:
      "Ne se pose jamais tout seul, et c'est délibéré : c'est le seul geste du post-traitement qui puisse enlever quelque chose au sujet. Il reste à la fiche, là où on le voit agir.",
    origine: "toi seul · jamais posé par l'univers",
  },

  "bords.aire_min": {
    nom: "tache minimale",
    ou: "tables",
    quoi: "En dessous de cette aire, en pixels, une tache opaque isolée est effacée.",
    change:
      "Retire les pixels isolés qu'une réduction au plus proche voisin laisse derrière elle. À 64 px de côté un pixel isolé se voit ; à 1024 il ne se voyait pas.",
    origine: "toi · défaut 3 px, et 0 n'efface rien",
    long:
      "Une tache est une zone opaque connexe, trouvée par le même remplissage par plages que la détection de la découpe — donc la même réponse sur la même image.\n\nMonter trop haut efface un détail détaché du corps : la pointe d'une lance, une étincelle, un éclat de magie. Le réglage est le dernier de la recette parce qu'il travaille sur ce que les quatre autres ont laissé, et pas sur l'image reçue.",
  },

  // ── L'assistant de démarrage — le seul écran qui règle un jeu ─────────────
  //
  // **Il n'y a pas d'autre panneau de réglages à côté**, et c'est la décision :
  // deux endroits qui règlent la même chose finissent toujours par se
  // contredire. Ces entrées disent ce que chaque étape décide, et surtout **ce
  // qu'un seul choix remplit ailleurs** — c'est cette liaison-là qu'on ne
  // devine pas en regardant un contrôle.

  "assistant.ecran": {
    nom: "L'assistant de démarrage",
    ou: "jeu",
    quoi: "Les dix étapes qui s'ouvrent à la toute première ouverture et à la création d'un jeu. Elles posent ce qui s'applique à tout : le nom, la vue, la taille d'image, la clé, les types d'objets, les poses.",
    change:
      "Rien n'est exigé. **On en sort à n'importe quelle étape**, une étape passée reste passée sans rien bloquer ni se redemander, et un réglage vide ne contraint rien — les défauts du produit prennent le relais.",
    origine:
      "toi · dix étapes vides, et un jeu « Bac à sable » qui existait déjà",
  },

  "assistant.nom": {
    nom: "Le nom du jeu",
    ou: "jeu",
    quoi: "Comment le jeu s'appelle, dans l'atelier.",
    change:
      "Rien à la génération : c'est le seul réglage qui ne part jamais au modèle. Le dossier, lui, ne se renomme pas — un dossier qui change de nom sous ses fichiers est un déménagement.",
    origine: "toi · « Bac à sable » au premier lancement",
    long:
      "L'assistant **ne crée pas le jeu, il le renomme** : sur une machine neuve le « Bac à sable » existe déjà, et rien n'est exigé pour commencer. C'est ce qui permet de sortir de l'assistant à n'importe quelle étape et de fabriquer tout de suite.",
  },

  "assistant.vue": {
    nom: "La vue du jeu",
    ou: "jeu",
    quoi: "D'où l'on regarde le monde — de face, de côté, de dessus, en isométrie.",
    change:
      "**La liste des directions de ton jeu**, et la phrase de style qui part au modèle. C'est cette liste qui multiplie toute la production, donc tout ce qu'on paiera : un personnage qui marche vu de côté se dessine deux fois ; le même vu de dessus, quatre.",
    origine: "toi · aucune au départ",
    long:
      "Ce choix ne décide pas de l'apparence du jeu. Il remplit **deux endroits d'un coup** : la liste des directions, que le codex affiche et qu'on peut y renommer, et la phrase de la case *vue* qui part au modèle. Ces deux-là ne peuvent plus se contredire, parce qu'ils viennent du même geste.\n\nAvant, le nombre de directions était retapé **sept fois** — une dans la description, puis à la main sur chaque pose — et rien ne reliait ces sept endroits.\n\n**La liste est une proposition, jamais une contrainte.** On renomme, on retire, on ajoute depuis le codex, et un clic la rend à ce que la vue propose. Tant qu'on n'y touche pas elle suit la vue ; dès qu'on y touche elle ne la suit plus — et le codex écrit lequel des deux, parce que ce ne sont pas la même promesse.\n\n**Le nombre de directions ne part plus dans le texte**, depuis le 31 août 2026 : il contredisait la consigne des planches d'équipement, et chaque image dit désormais elle-même la direction qu'elle montre.",
  },

  "assistant.taille": {
    nom: "La taille des images",
    ou: "jeu",
    quoi: "Le côté de la case où tout ce qui rentre est ramené.",
    change:
      "**C'est le plus coûteux des dix réglages.** Tout ce qui a été fabriqué a été découpé à l'ancienne taille : les images ne se recoupent pas, il faut les refabriquer, et chacune se paie. La ligne le dit avec le compte et le coût — puis laisse passer.",
    origine: "toi · 64 px au départ, ou « aucune »",
    long:
      "Le choix remplit aussi **la phrase de grille et celle de calage** dans la description, ce qui répare la contradiction mesurée du dépôt : le réglage disait 128 pendant que le texte envoyé disait 64, trois fois.\n\n**Le réglage n'est jamais grisé.** Le produit n'a qu'un seul refus automatique — le compte d'images — et en ajouter un deuxième reviendrait à bloquer un auteur sur son propre jeu. Un chiffre exact aide mieux qu'une case grise.\n\n« Aucune » est une valeur et non un trou : elle dit *ce jeu n'est pas en pixel art*, et l'image entre telle que le modèle l'a rendue.",
  },

  "assistant.etiquettes": {
    nom: "Les étiquettes",
    ou: "jeu",
    quoi: "Une paire : un libellé qu'on clique, et le texte anglais qui part vraiment au modèle.",
    change:
      "Cliquer une étiquette écrit son texte anglais dans la case ouverte. Rien d'autre : ce qui est écrit reste du texte libre, que tu corriges à la main.",
    origine: "toi · la base est vide au départ, et partagée par tous tes jeux",
    long:
      "C'est ce qui rend la description **mécanique** au lieu d'être rédigée : on ne cherche plus comment dire « il y a de la brume » à une intelligence artificielle, on l'a trouvé une fois, on l'a nommé, on le reclique.\n\n**La base appartient à l'atelier, pas à un jeu** — comme la clé du fournisseur, elle ne dépend d'aucun. Elle naît vide, personne ne l'écrit à ta place, et elle grandit de chaque étiquette fabriquée dans n'importe quel projet. Au premier jeu, l'étape est donc sept champs de texte libre, et elle le dit franchement.\n\nLa recherche ne montre que les étiquettes **de la case ouverte** : une étiquette d'éclairage n'a rien à faire dans la case du trait.",
  },

  "assistant.texte": {
    nom: "Le texte à copier",
    ou: "jeu",
    quoi: "Ta description assemblée, prête à coller dans un outil d'images grand public.",
    change:
      "**Rien, et pas un centime** : ce texte ne part nulle part depuis l'atelier. Tu le colles où tu veux, tu récupères des images, tu les déposes sur le tableau.",
    origine: "les étapes précédentes, reprises mot pour mot",
    long:
      "Il répond à un vrai problème : **on n'a pas toujours d'images à déposer**, et un jeu qui démarre n'a que des mots. L'atelier a bien de quoi générer lui-même, mais chaque image se paierait avant même que le jeu existe, et sur un modèle choisi à un moment où rien n'est réglé.\n\nEt il a une seconde vertu : **c'est la première fois qu'on voit sa description assemblée**. Beaucoup de contradictions se remarquent là, en lisant les lignes à la suite.",
  },

  "assistant.poses": {
    nom: "Les poses et les états",
    ou: "jeu",
    quoi: "Ce que chaque chose du jeu peut faire — au repos, en marche, ouverte, vidée.",
    change:
      "Chaque pose est une case à remplir dans le codex. **La liste appartient au type d'objet** : un personnage a ses six attitudes, un meuble ses trois états, une tuile aucune — et changer l'une ne touche pas les autres. **Le nombre d'images d'une pose vient du choix de vue**, pas d'une saisie : il ne se retape plus.",
    origine: "toi, ou l'atelier · une liste proposée par type",
  },

  "assistant.emplacements": {
    nom: "Les emplacements d'équipement",
    ou: "jeu",
    quoi: "Les endroits d'un corps où l'on peut accrocher une pièce — la tête, le dos, la main.",
    change:
      "**L'ordre compte** : il décide de quelle pièce se dessine par-dessus l'autre. L'étape ne sert que si un type de ce jeu a une silhouette — un jeu de tuiles et de décors n'équipe personne.",
    origine: "toi · vide au départ",
  },

  "assistant.fournisseurs": {
    nom: "Les fournisseurs, et ce qu'ils demandent",
    ou: "reglages",
    quoi: "Un tiroir par fournisseur. Chacun dit ce qu'il lui faut pour travailler — une clé, un compte et un jeton, ou rien du tout — et ce que tu y déposes n'est jamais redemandé.",
    change:
      "Un fournisseur à qui il manque quelque chose a ses modèles **grisés, avec leur raison** — mais l'atelier n'est pas éteint pour autant : l'un d'eux ne demande ni compte ni clé, et le bouton qui paie reste actif sur ses modèles à lui. Tu peux donc fabriquer une première image sur une machine où rien n'a été déposé. Ce que tu n'auras pas sans le fournisseur payant, c'est ce qui a besoin d'images de référence : le gratuit n'en accepte aucune, donc pas d'univers, pas de casting dans un style commun. Ce que tu déposes vaut pour tous tes jeux, pas seulement celui-ci.",
    origine: "toi · vide au départ · trois portes, une seule pièce",
    long:
      "Chaque place se dépose à la dernière étape de l'assistant de démarrage, dans la fenêtre des réglages, ou par une variable d'environnement — **c'est la même valeur au même endroit**, et l'atelier la relit à chaque appel. En changer une ne demande aucun redémarrage, et n'efface aucune autre.\n\nUn fournisseur peut en demander plusieurs : un compte *et* un jeton, par exemple. Il te dit alors lequel manque, pas seulement qu'il manque quelque chose. Un autre n'en demande aucune, et son tiroir le dit plutôt que de rester vide sans explication.\n\nUne clé n'apparaît jamais en entier, nulle part : tu en vois les six derniers caractères, de quoi la reconnaître sans la lire. Celle qui vient de l'environnement de ta machine ne se retire pas depuis cet écran — l'atelier n'écrit pas là-dedans, et un bouton qui semblerait le faire mentirait.\n\nEn retirer une grise les modèles de son fournisseur, et **rien d'autre** : ni une image, ni une ligne de dépense. Ce qui est parti est parti, et le compte le dit toujours.",
  },

  "reglages.depenses": {
    nom: "Les dépenses",
    ou: "reglages",
    quoi: "La liste de tous les appels, du plus récent au plus ancien, chacun avec sa date, son sujet, son modèle et ce qu'il a réellement consommé — les réussis, les ratés et les interrompus.",
    change:
      "Rien du tout : on ne règle rien ici, on lit. Une image supprimée fait changer l'état de son appel, jamais disparaître sa ligne — **une dépense ne s'efface jamais**.",
    origine: "l'atelier, à chaque appel · rien à remplir",
    long:
      "Les deux totaux du produit ne comptent pas la même chose, et il vaut mieux le savoir avant de les comparer : celui de la barre du haut compte **le jeu ouvert**, celui d'ici compte **l'atelier depuis le premier jour**. C'est ce que les étiquettes *ce jeu, en argent* et *dépensé par l'agent* ont été ajoutées pour lever.\n\nDepuis qu'un fournisseur ne facture rien, un appel peut ne rien coûter et consommer quand même. Ces appels-là sont dans la liste comme les autres, et ils y disent **gratuit** — jamais *0,00 $*, qui se lirait *sans limite* là où il faut lire *sans prix*. Ce qu'ils ont pris est écrit à côté, avec son mot, et il n'est jamais ajouté au total : un total en argent ne compte que de l'argent.\n\nL'argent n'appartient à aucun jeu en particulier, et c'est pour ça que cet écran se range avec les réglages de l'atelier plutôt qu'avec la galerie.",
  },

  "reglages.consommation": {
    nom: "Ce qu'un appel consomme",
    ou: "reglages",
    quoi: "Ce qu'un appel prend chez son fournisseur, dans l'unité de celui-ci : des dollars chez l'un, des jetons chez l'autre — et « rien du tout » n'existe pas, un appel consomme toujours quelque chose.",
    change:
      "Rien à la génération : c'est ce qui s'enregistre après, et ce que l'écran annonce avant. Le chiffre affiché sur un modèle est la **médiane de ses derniers appels sur cette machine**, jamais un tarif lu quelque part.",
    origine: "la réponse du fournisseur, à chaque appel · rien à remplir",
    long:
      "Le mot **gratuit** veut dire *sans prix*, pas *sans limite*. Un modèle qui ne coûte rien prend quand même quelque chose chez celui qui le sert, et ce quelque chose est écrit à côté du mot : *gratuit · 1 jeton*.\n\nCe qu'il reste chez un fournisseur est dit aux deux endroits où ça sert — l'écran où l'on choisit un modèle, et celui qui confirme un appel —, avec **d'où le chiffre vient**. *Compté ici* veut dire compté sur les appels partis de cette machine : c'est un minimum, pas un relevé, parce qu'un appel lancé ailleurs entame la même réserve sans que ce compteur-là le voie. *Relevé chez le fournisseur* veut dire que c'est lui qui l'a dit, et c'est alors un fait.\n\nAucun des deux fournisseurs du produit n'annonce de réserve aujourd'hui. Celui qui ne demande rien limite une **cadence** — un appel toutes les quinze secondes — et non un nombre d'images : l'écran dit donc ce qui est parti depuis minuit, et à quel rythme on peut relancer, plutôt qu'un « il vous reste » que personne n'a mesuré.",
  },

  // ── La sixième place : les contours ───────────────────────────────────────
  //
  // **La seule table entièrement neuve du lot** (E5) : rien n'en existait dans
  // le produit. La panne qu'elle répare est précise — la mise sur grille mange
  // les contours fins, et ce qui reste n'est pas un contour absent, ce qui
  // serait franc, mais un contour *troué*, qui se voit et ne se rattrape pas.

  "etape.contours": {
    nom: "Les contours",
    ou: "tables",
    quoi: "La sixième place de la recette. Elle trace un trait sur le bord du sujet, d'une couleur choisie, et le pose dedans, dehors, ou à cheval.",
    change:
      "Posé dehors, le trait agrandit l'image rendue : c'est le seul réglage du produit qui change les dimensions du sprite sans qu'on le lui ait demandé, et la table le dit en ligne sœur au moment où l'on choisit la position.",
    origine:
      "toi · éteinte au départ · la couleur proposée est la plus sombre de ta palette",
  },

  "contours.epaisseur": {
    nom: "épaisseur du contour",
    ou: "tables",
    quoi: "La largeur du trait, en pixels de l'image rendue — celle qui part dans le jeu.",
    change:
      "Rien à la génération. Au-delà de huit ce n'est plus un contour, c'est un cadre, et il vaut mieux le dessiner à la main : le plafond est là pour ça, pas pour une limite technique.",
    origine: "toi · défaut 1 px",
    long:
      "L'unité est celle de l'image **rendue**, et pas celle de l'image reçue : une fois la grille posée, l'image rendue *est* la case du sprite, et un pixel y est un bloc.\n\nLa table ne devine pas l'épaisseur, et elle pourrait — mesurer celle du contour existant là où il survit. Mais un contour troué donne des épaisseurs qui varient de un à trois, et proposer la médiane de quelque chose de cassé serait deviner à partir de la panne qu'on répare.",
  },

  "contours.couleur": {
    nom: "couleur du contour",
    ou: "tables",
    quoi: "La couleur exacte du trait. La palette du jeu est proposée en rangée ; le champ reste libre.",
    change:
      "Rien à la génération. Une couleur qui n'est pas dans la palette du jeu se marque « hors palette » au lieu d'être refusée — le produit constate, il ne décide pas à ta place.",
    origine: "toi · proposé : la plus sombre de ta palette, ou le noir sans palette",
    long:
      "La règle du produit tient en une ligne : **la palette est imposée par la quantification, qui ramène chaque pixel sur la couleur la plus proche ; elle est proposée partout ailleurs.** Ici on est *après* la quantification — ce que le trait pose ne sera pas rattrapé, et c'est précisément ce qui mérite d'être dit plutôt que refusé.",
  },

  "contours.position": {
    nom: "position du contour",
    ou: "tables",
    quoi: "Dehors, dedans, ou à cheval sur le bord de la silhouette.",
    change:
      "Posé dehors, le trait agrandit l'image rendue : c'est le seul réglage du produit qui change les dimensions du sprite sans qu'on le lui ait demandé. La table écrit de combien, au moment où tu choisis.",
    origine: "toi · défaut externe",
    long:
      "**Externe** pose la ligne autour : le sujet n'est pas entamé, et les dimensions grandissent de deux fois l'épaisseur. **Interne** la pose en dedans : la boîte ne bouge pas, le sujet est mangé. **Centré** partage, et le pixel qui ne tombe pas juste va vers l'extérieur.\n\nLe défaut est externe pour la même raison que le pixel impair va dehors : agrandir est réversible, manger le sujet ne l'est pas.",
  },

  "contours.trous": {
    nom: "les trous",
    ou: "tables",
    quoi: "Un trou de la silhouette — une boucle de ceinture, l'espace entre un bras et un torse — reçoit-il la même ligne que le pourtour ?",
    change:
      "Rien à la génération. Cerclés, un trou plus petit que deux fois l'épaisseur se bouche : la table donne le compte et la plus petite taille pour que ça se voie venir.",
    origine: "toi · défaut cerclés",
    long:
      "Un trou est un bord du sujet exactement comme le pourtour, et c'est ce que fait un style « contour noir 2 px » — d'où le défaut. **Laissés** ne trace que le pourtour extérieur, pour les styles qui veulent une découpe nette sans lignes à l'intérieur du sujet.",
  },

  "contours.taches": {
    nom: "taches contournées",
    ou: "tables",
    quoi: "Combien de zones opaques ont reçu la ligne, et la taille de la plus petite.",
    change:
      "Rien : c'est une lecture. Un compte qui surprend envoie dans la table des bords, qui est juste avant dans l'ordre.",
    origine: "une mesure sur ton image",
    long:
      "Il n'y a **pas d'aire minimale ici**, et c'est délibéré : un contour tracé autour de trois miettes ferait trois pâtés, mais la table des bords existe déjà pour retirer les miettes, et deux réglages qui font la même chose à deux endroits finissent par se contredire. Ce que cette table fait à la place, c'est le dire.\n\nCe n'est pas un verdict : un personnage à deux lanternes détachées fait légitimement trois taches.",
  },

  // ── La septième place : la main ───────────────────────────────────────────
  //
  // **C'est la seule table qui n'applique aucune règle**, et c'est exactement
  // ce qu'une explication doit dire — sinon on la cherche parmi les réglages,
  // où elle n'est pas.

  "etape.main": {
    nom: "La main",
    ou: "tables",
    quoi: "La septième et dernière place. Le crayon, la gomme et la pipette, au pixel. Là où les six autres tables appliquent une règle à toute l'image, celle-ci ne fait que ce que tu désignes.",
    change:
      "Rien à la génération, et rien tant que tu ne poses pas un pixel. Elle existe pour les trois pixels qu'aucun réglage n'atteint : un coin de fond collé au sujet, une dent dans un contour, une miette accrochée à la silhouette.",
    origine: "toi, geste par geste · rien au départ",
    long:
      "Comme toutes les tables, elle ne coûte rien. Le post-traitement ne touche jamais le fournisseur — on peut y passer une heure sans dépenser un centime, et c'est ce que la barre qui paie, absente ici, annonce avant qu'on ait lu quoi que ce soit.",
  },

  "main.calques": {
    nom: "les calques de la main",
    ou: "tables",
    quoi: "Une pile : « l'opacité » au fond, et autant de calques de dessin qu'on veut au-dessus.",
    change:
      "Rien à la génération, et rien tant que tu ne poses pas un pixel. Masquer un calque n'efface rien — il garde ses passages et cesse simplement d'être appliqué.",
    origine: "toi · « l'opacité » seule au départ",
    long:
      "**« L'opacité » est le sol, et elle est d'une autre nature** : elle ne pose pas de couleur, elle décide de ce qui est là sur l'image que les six tables précédentes ont produite. Elle ne se supprime pas et ne se déplace pas — un calque de dessin sous l'image n'aurait aucun sens.\n\nLa pile se lit du dessus au dessous, comme partout où il y a des calques ; elle s'applique dans l'autre sens, qui est celui d'un pinceau.",
  },

  "main.sens": {
    nom: "le sens du geste",
    ou: "tables",
    quoi: "Ce que le prochain passage fera : ôter ou remettre sur l'opacité, poser ou effacer sur un calque de dessin.",
    change:
      "Rien à la génération. Le dernier passage l'emporte sur un pixel donné, comme un pinceau sur une toile.",
    origine: "toi · le premier des deux",
    long:
      "Sur l'opacité : **ôter** rend transparent, **remettre** ramène ce que l'image avait avant qu'on le retire — la couleur est toujours là dessous, ni le détourage ni la quantification n'y touchent.\n\nSur un calque de dessin : **poser** ajoute des pixels à la couleur choisie, **effacer** retire ce que ce calque-là avait posé, et rien d'autre. Le pixel retombe alors sur ce qu'il y avait dessous.",
  },

  "main.diametre": {
    nom: "le pinceau",
    ou: "tables",
    quoi: "La largeur du trait, en pixels de l'image rendue. Impairs seulement — un pinceau a un centre.",
    change:
      "Rien à la génération, et rien tant qu'aucun passage n'est posé : ce curseur ne déclenche aucun calcul, il suit la main sans attendre le relâchement.",
    origine: "toi · défaut 5 px",
    long:
      "**Le cran 1 px est le pixel** : un rayon nul ne couvre qu'un pixel de large, et c'est l'autre bout de « à main levée, puis au pixel ». Les deux échelles du geste sont les deux bouts d'un seul réglage, et non deux outils.\n\nC'est le diamètre qui s'affiche, pas le rayon : la largeur du trait est ce que la main voit.",
  },

  "main.couleur": {
    nom: "la couleur du pinceau",
    ou: "tables",
    quoi: "Ce qu'un passage pose sur un calque de dessin. La palette du jeu est proposée ; le champ reste libre.",
    change:
      "Rien à la génération. Une couleur hors palette se marque au lieu d'être refusée : une couleur de plus dans un jeu est un fait qui se lit, pas une faute.",
    origine: "toi · proposé : la première de ta palette",
    long:
      "**La couleur est portée par le passage, pas par le calque** : un même calque peut en contenir plusieurs, ce qui évite d'en créer un par teinte — et ce qui laisse la porte ouverte le jour où un remplissage ou un dégradé s'ajoutera.\n\nL'opacité, elle, ne pose aucune couleur : elle décide de ce qui est là.",
  },

  "main.passages": {
    nom: "le calque actif",
    ou: "tables",
    quoi: "Combien de passages porte le calque choisi, et ce que Ctrl + Z va retirer.",
    change:
      "Rien : c'est un compte, et un geste. Ctrl + Z retire le dernier passage du calque actif ; « Sans la main › », en pied, vide la table entière.",
    origine: "toi, geste par geste · rien au départ",
    long:
      "**Il n'y a pas de liste de passages, et c'est la seule table dans ce cas.** Un geste à main levée en produit des dizaines : trente rangées ne se relisent pas, elles se subissent. Le calque est l'unité de lecture — c'est lui qu'on nomme, qu'on masque, qu'on supprime — et le passage n'existe que comme un compte et un Ctrl + Z.\n\nUn passage est enregistré comme un **tracé, jamais comme des pixels** : il pèse quelques octets, il se défait un par un, et il se rejoue sur une image dont les dimensions ont changé. Remettre la grille à une autre taille ne fait pas perdre le dessin.",
  },

  // ── La retouche — ce que la fiche fait d'un asset ─────────────────────────

  "fiche.impose": {
    nom: "Imposé par le projet",
    ou: "galerie",
    quoi: "Ce que l'univers de ton projet a appliqué à cette image-là — la taille de pixel, la part de case qu'elle occupe, la palette.",
    change:
      "Rien : c'est une lecture. Chaque ligne dit si la valeur du projet est encore appliquée ou si tu l'as réglée à la main depuis, et les sept places en dessous sont l'endroit où l'on change.",
    origine: "l'univers du projet, tel qu'il est maintenant · l'échelle demandée à la naissance",
    long:
      "Sans cette rubrique, tu vois une image qui ne ressemble pas à ce que le modèle a rendu, sans jamais savoir pourquoi : la remise sur grille et la quantification s'appliquent à la naissance, sans rien demander et sans rien dire.\n\nElle est calculée à la lecture, jamais rangée avec l'asset : la question posée est « qu'est-ce que le projet impose *maintenant* », et une valeur enregistrée aurait vieilli au premier réglage d'univers.\n\nElle dit « on ne sait pas » quand la génération de l'image n'est plus sur le disque. Une image importée n'en a jamais eu : le produit préfère l'avouer que de répondre « rien d'imposé », qui est une réponse différente et fausse.",
  },

  "fiche.recettes": {
    nom: "Recettes",
    ou: "galerie",
    quoi: "Les recettes que tu as nommées, à reposer sur cette image d'un clic.",
    change:
      "Applique les sept places d'un coup, sans un appel payant. Une recette nommée réappliquée ailleurs donne exactement le même résultat — c'est un critère du produit, et rien dans le traitement ne tire au sort.",
    origine: "toi, en nommant · aucune au départ",
    long:
      "Une recette est nommée par son empreinte autant que par toi : deux recettes égales sont interchangeables, et c'est cette empreinte qui nomme le fichier de rendu sur le disque. Reposer une recette déjà appliquée ne recalcule donc rien.\n\nUne recette vide ne s'enregistre pas — elle n'aurait rien à rejouer.\n\nDans l'atelier d'une animation, elle **remplace tous les réglages à la fois** : une recette est un ensemble, et en prendre la moitié rendrait une image que personne n'a jamais jugée. Comme le reste de cet écran, elle n'écrit rien tant que tu n'as pas enregistré.",
  },

  "fiche.reinjecter": {
    nom: "Réinjecter",
    ou: "galerie",
    quoi: "Renvoyer cette image dans le générateur, dans l'un de ses quatre rôles.",
    change:
      "Trois rôles envoient l'image — référence (elle inspire), source d'édition (elle engendre), guide de style (elle donne la manière). Le quatrième n'envoie rien : il reprend le prompt, le modèle et les réglages de la génération qui a produit cet asset.",
    origine: "toi · le contrat de génération nomme les rôles",
    long:
      "Réinjecter ne coûte rien tant que tu n'as pas cliqué Générer : le rôle se pose dans le panneau de l'atelier, et le bloc « Ce qui part » se met à jour pour le dire. Le compte de références y grimpe d'un cran, et il est plafonné par le modèle choisi.\n\nLe quatrième rôle est le seul qui touche au prompt. Il est là pour la reprise : refaire une image dont on a perdu les réglages est le geste qu'on fait le plus souvent après un tri.",
  },

  "fiche.personnage": {
    nom: "Corps de",
    ou: "galerie",
    quoi: "Le personnage et l'attitude dont cette image est le corps.",
    change:
      "Rien à la génération. La case correspondante cesse d'être vide dans l'écran Personnages, et l'image y paraît en vignette — elle ne bouge pas de la bibliothèque pour autant.",
    origine: "toi · le plan d'attitudes vient du projet",
    long:
      "Un corps naît dans l'atelier et nulle part ailleurs : on écrit un sujet, on génère, on obtient une image, et c'est ici qu'on dit ce qu'elle est. Il n'existe pas d'écran de création de personnage avec son propre prompt, et c'est délibéré — tout ce qui s'empilera ensuite repose sur une image dont on connaît déjà la grille et la palette.\n\nLes attitudes proposées sont celles que ce personnage-là tient, jamais toutes celles du jeu : désigner une case qu'il ne réclame pas n'aurait aucun sens. Retirer la désignation ne touche pas à l'image — elle reste dans la bibliothèque, sa case redevient vide.",
  },

  // ── Les réglages — le cadre de l'agent ────────────────────────────────────
  //
  // Trois entrées, et elles répondent toutes à la même question de fond : *que
  // se passe-t-il quand je ne regarde pas l'écran ?* L'agent n'attend jamais une
  // autorisation — c'est ce qui l'empêche de se figer, et c'est exactement ce
  // qui rend ces trois réglages nécessaires.

  // ── Les mouvements (A6) ────────────────────────────────────────────────────
  //
  // Trois entrées pour un réglage à trois champs. **Une entrée décrit un
  // réglage, pas un écran** — la règle qui a fait vieillir six phrases seulement
  // sur cent en vingt étapes.

  "mouvement.nom": {
    nom: "Nom du mouvement",
    ou: "reglages",
    quoi: "Le nom français du mouvement — ce que tu lis, et jamais ce qui part au modèle.",
    change:
      "Rien à la génération : le nom ne quitte pas l'atelier. Mais **le repère qu'il produit accroche le mouvement à la case du plan** : un mouvement nommé « marche » anime la pose « marche » sans que tu relies quoi que ce soit. Renommer un mouvement déjà nommé ne défait pas ce lien — le repère, lui, ne bouge plus.",
    origine: "toi · sept mouvements arrivent avec l'atelier",
    long: "Le repère se dérive du nom au moment où tu le nommes, et pas après : « vol plané » donne `vol-plane`. C'est ce repère-là qui doit correspondre à l'identifiant d'une pose pour que la case en hérite.\n\nUn mouvement livré renommé reste livré : c'est son origine, pas son état. Le fichier l'emporte alors sur le catalogue, et ton nom survit à la mise à jour suivante.",
  },
  "mouvement.texte": {
    nom: "Ce qui part au modèle",
    ou: "reglages",
    quoi: "Le texte anglais envoyé pour obtenir le clip. C'est la moitié qui agit.",
    change:
      "Tout. C'est ce texte-là qui décide de ce que le modèle anime, et **deux clips du même mouvement partent avec exactement le même** : ce qui varie d'un tirage à l'autre redevient le tirage, et non la frappe.",
    origine: "toi · les livrés arrivent écrits",
    long: "Un texte de mouvement dit un **cycle**, pas une posture. C'est toute la différence avec la consigne d'une pose : `walking posture, full body` est juste pour une image et faux pour un clip, où il faut dire que ça boucle et que le personnage n'avance pas dans le cadre — sans quoi il sort du champ, et la fenêtre de découpage devient énorme pour rien.\n\nLes textes livrés portent deux précautions qui valent d'être gardées quand tu en écris un : *in place, without moving across the frame* pour les déplacements, et *returning to the neutral stance* pour ce qui n'est pas un cycle. La seconde est ce qui permet de découper **deux animations dans un seul clip**, en repérant le retour au repos entre deux actions.\n\nChanger ce texte ne touche à rien de ce qui est déjà parti : il était parti au moment du clic.",
  },
  "mouvement.cadence": {
    nom: "Cadence",
    ou: "reglages",
    quoi: "Les images par seconde de la bande qu'on tirera du clip.",
    change:
      "Elle règle la vitesse de l'aperçu **et** elle est écrite dans le fichier d'accompagnement à l'export. Un seul réglage pour les deux : séparés, ils finiraient par se contredire, et c'est toi qui paierais l'écart.",
    origine: "toi · 12 images par seconde à défaut",
    long: "Douze est le compromis du pixel art : au-dessous le pas saccade, au-dessus tu paies des images que l'œil ne distingue plus à cette taille. Les livrés s'en écartent quand le mouvement le demande — le repos à huit, la course à quatorze.",
  },

  // ── Commander un clip (A9) ────────────────────────────────────────────────
  //
  // Rangées dans l'établi, parce que c'est de là qu'on ouvre l'écran : *un
  // lieu, pas un thème*. Le mouvement, lui, reste dans les réglages — on
  // l'écrit là-bas, on le choisit ici.

  "clip.depart": {
    nom: "L'image de départ",
    ou: "etabli",
    quoi: "La première image du clip — celle que le modèle va animer, et il n'en prend qu'une.",
    change:
      "Tout ce à quoi le clip ressemblera. **Elle est obligatoire et ne cède jamais** : sans elle il n'y a pas d'appel du tout, là où les images jointes d'une génération ordinaire s'effacent quand le modèle n'a plus de place. Le clip n'hérite de rien d'autre — ni des textes du jeu, ni de son ambiance.",
    origine: "l'atelier propose · tu changes d'un clic",
    long: "L'atelier propose **l'image de la case visée** quand elle en porte une : l'attitude et l'angle ont déjà été validés en fixe, et le clip les suit. Sinon il propose le **portrait** du personnage — la première image qu'il montre de lui, celle que tu as promue en référence, sinon le corps retenu de sa première attitude.\n\nCe n'est qu'une proposition : aucun automatisme ne sait tout, et n'importe quelle image de ta bibliothèque la remplace d'un clic.\n\nCe qui part n'est pas le sprite tel quel : il est agrandi sur la toile du format demandé. Un sprite de soixante-quatre pixels envoyé à un modèle qui rend du 480 lui demanderait d'inventer tout ce qu'il ne voit pas.",
  },

  "clip.format": {
    nom: "Le format du clip",
    ou: "etabli",
    quoi: "Sa durée, ses proportions et sa taille — les trois choses qui décident du prix.",
    change:
      "Le prix, à chaque cran. Un modèle vidéo se facture au **jeton vidéo** — hauteur × largeur × images par seconde × durée —, donc la surface compte autant que le temps : le carré coûte près de moitié moins que le format large, et il cadre mieux un personnage seul.",
    origine: "toi · 5 secondes, carré, petit format",
    long: "Cinq secondes plutôt que quatre, et c'est mesuré : quatre suffisent à un cycle de marche seul, mais le geste de la version est d'en tirer **plusieurs animations dans un clip**, et il faut de la place pour les transitions entre elles.\n\nUn modèle qui ne sait pas faire la durée que tu demandes se grise avec sa raison plutôt que de disparaître : ce qui est impossible se voit avant d'être choisi.",
  },

  "clip.lot": {
    nom: "Combien de clips",
    ou: "etabli",
    quoi: "Le nombre de clips que ce geste lance d'un coup. Un est le défaut.",
    change:
      "Le prix, multiplié d'autant, et le bouton l'annonce avant. **Chacun est une dépense à part** : quatre clips coûtent quatre fois, et l'écran des dépenses le dira quatre fois — y compris pour ceux que tu jetteras.",
    origine: "toi · un clip",
    long: "Un même texte ne rend jamais deux fois le même clip. En lancer plusieurs et n'en garder qu'un est le geste ordinaire ici, et il tient en un clic : *garder celui-ci* écarte les autres du même lot.\n\nLes clips écartés quittent la galerie, **jamais le journal**. C'est le premier invariant du produit, et il compte le plus ici : un lot de quatre coûte quatre fois, et n'en voir plus qu'un au journal ferait croire qu'on a payé une fois.\n\nRien n'expire : un clip écarté est toujours là, et *les rendre* marche quand tu veux — contrairement à une image jetée, dont les octets s'effacent après quelques secondes.",
  },

  "clip.prix": {
    nom: "Le prix du clip",
    ou: "etabli",
    quoi: "Ce que le clip devrait coûter, avec la formule qui produit ce chiffre.",
    change:
      "Rien à ce qui part. C'est une **borne haute** affichée avant l'envoi : ce qui s'enregistre après est le montant que le fournisseur a facturé, et l'écart mesuré sur treize clips va de quatre pour cent de plus à cinquante-huit pour cent de moins.",
    origine: "relu chez le fournisseur, à chaque changement de format",
    long: "La formule est là parce qu'un prix vidéo se **calcule** au lieu de se lire dans une grille : sans elle, le montant serait à croire sur parole. Elle dit le tarif, la surface, la cadence facturée et la durée — de quoi refaire le calcul et le vérifier sur la page du modèle.\n\nUn modèle dont le tarif n'a pas pu être relu est grisé avec sa raison. Ce n'est pas du zèle : un clip se fait attendre deux minutes, et proposer sans savoir ce qu'on engage serait proposer à l'aveugle.\n\n**Un des modèles de la liste ne coûte rien** : il tourne sur la carte graphique de cette machine. Ce qu'il coûte est du temps, et le bouton l'annonce à la place du montant — la règle *rien ne part sans que ce que ça coûte soit annoncé* ne disparaît pas, elle change d'unité. Ce temps ne se multiplie pas comme un prix : le premier clip charge le modèle en mémoire, les suivants sont plus courts.",
  },

  "clip.moteur": {
    nom: "La carte de cette machine",
    ou: "etabli",
    quoi: "Ce que ton ordinateur peut faire lui-même, et ce qu'il lui manque pour ça.",
    change:
      "Rien à ce qui part. Ce panneau ne dépense jamais d'argent — il regarde ce que l'application du moteur a sur son disque, et il te dit si le modèle gratuit est utilisable maintenant.",
    origine: "relu à chaque ouverture de cet écran",
    long: "Trois choses peuvent manquer, et elles ne se réparent pas de la même façon.\n\n**L'application du moteur n'est pas ouverte.** C'est la seule des trois qui empêche : rien ne peut partir, et l'atelier ne sait pas ouvrir une fenêtre à ta place. Ouvre-la, reviens ici, le grisé tombe tout seul — le relevé se refait à chaque fois.\n\n**Des fichiers manquent.** Le modèle reste choisissable : l'atelier sait les rapatrier, et il te dit lesquels, combien ils pèsent et sous quelle licence **avant** que tu lances quoi que ce soit. C'est une question qu'on se pose avant, jamais après : ce qui descend là finira dans un jeu que tu vends.\n\n**Le greffon qui garde les gros pixels manque.** Simple avertissement — le clip sortira, il sortira lissé. Un clip lissé se juge à l'œil ; un refus ne se juge pas.\n\nUn téléchargement coupé se reprend là où il s'est arrêté : relance, rien n'est perdu.",
  },

  "clip.mesure": {
    nom: "Ce qui est mesuré",
    ou: "etabli",
    quoi: "Ce que ce dépôt-ci a observé du modèle en payant ses propres essais, et rien d'autre.",
    change:
      "Rien à ce qui part. C'est ce qui te permet de choisir en sachant sur quoi tu t'appuies — **aucun modèle proposé n'atteint la barre des huit tirages** : ce sont des propositions étayées, pas un arbitrage clos.",
    origine: "les essais payés du dépôt · vide quand rien n'a été mesuré",
    long: "Aucun fournisseur ne déclare ça, et un écran qui proposerait deux modèles sans le dire ferait passer une hypothèse pour un résultat.\n\nVide veut dire *on n'en sait rien*, et l'écran l'écrit plutôt que de laisser croire qu'un modèle proposé a été éprouvé.",
  },

  "clip.liste": {
    nom: "La liste de modèles",
    ou: "etabli",
    quoi: "L'ordre dans lequel les modèles se présentent, et le filtre qui range ce qui ne peut pas partir.",
    change:
      "Ce que tu lis d'abord, et à quel point la liste te laisse tranquille. **L'ordre vient du serveur** — le modèle gratuit en tête, puis les payants du moins cher au plus cher pour la demande courante — et l'interrupteur, allumé, ne montre que ce qui peut partir.",
    origine: "le serveur trie · tu filtres",
    long: "Le prix d'un clip change avec la durée, le format et la résolution : le tri suit cette demande-là, au même endroit où le prix se calcule, et il n'y a pas de règle de tri à l'écran — deux endroits qui trient finiraient par ne plus trier pareil.\n\nL'interrupteur *seulement ce qui peut partir* est allumé par défaut : dans un atelier sans clé, vingt-huit cartes grisées avaleraient la liste. Éteint, elles reparaissent, intercalées par prix, et chacune se déplie pour lire pourquoi elle ne peut pas partir.\n\nUne carte repliée ne montre que le nom et l'estimation — c'est tout ce qu'il faut pour comparer. Le détail, le pli l'ouvre d'un geste à lui, distinct du geste qui choisit, et il reste possible sur une carte grisée : seul le choix est interdit, la lecture ne l'est jamais.",
  },

  "clip.confirmation": {
    nom: "Ce qui part avec le clip",
    ou: "etabli",
    quoi: "Le tiroir qui s'ouvre entre « Commander ce clip » et la dépense : la dernière relecture, corrigeable.",
    change:
      "Ce qui va partir. **Le texte, mot pour mot, et l'image de départ — rien d'autre.** Une correction faite ici vaut pour cet appel seulement, et ne touche jamais au mouvement de la bibliothèque.",
    origine: "le mouvement choisi et l'image de départ · ta correction éventuelle",
    long: "Un clip n'emporte qu'une image et un texte : un modèle vidéo n'en accepte qu'une, et aucun plafond ne la fait céder. L'image se **change**, jamais elle ne se retire — proposer un interrupteur qui ne voudrait rien dire serait un mensonge de forme, et le tiroir le dit en toutes lettres.\n\nLe texte se **corrige pour cet appel** : la correction part, le mouvement de la bibliothèque ne bouge pas, et *remettre le texte du mouvement* le redonne intact. Le corriger pour tous les clips suivants se fait dans les Réglages, là où il s'écrit — une correction durable est un second geste, comme partout dans le produit.\n\nLe bouton porte le montant du **lot** — chacun des N clips se paie, y compris ceux qu'on jettera —, ou le temps, chez le moteur de la maison. Rien n'est consommé tant qu'il n'est pas pressé.",
  },

  "clip.fiche": {
    nom: "La fiche d'un clip",
    ou: "galerie",
    quoi: "La colonne de droite qui s'ouvre quand on clique sur la vignette d'un clip — comme la fiche d'une image, pour ce que la galerie garde sans que ce soit une image.",
    change:
      "**La vidéo du clip, en boucle** — son rythme, ses fondus, ce qu'il fait entre deux images —, ce qu'il a coûté, ce qu'il anime, ce qu'il a produit, et la porte du montage.",
    origine: "le clip, tel qu'il est arrivé · les bandes qu'on en a déjà taillées",
    long: "La fiche d'un clip est la fiche d'une image, adaptée à ce qu'un clip est : la vignette, c'est la **vidéo elle-même** — pas une image prélevée que l'écran rejoue à sa cadence —, avec jeu, pause et une barre de lecture qui se déplace.\n\nElle dit ce que le clip porte — le texte qui l'a fait, le modèle, combien il a coûté **et si ce montant a été relu chez le fournisseur** —, ce qu'il anime — le personnage, la pose, la direction —, et le sprite dont il est parti.\n\nCe qu'il a produit s'y lit dans l'autre sens : les bandes déjà gardées, chacune s'ouvrant dans l'atelier d'une animation. Et *Découper* y mène au montage, comme sur la tuile. **Rien ici ne dépense** : le clip est déjà payé, et garder ou jeter restent les gestes de la grille.",
  },

  // ── Le montage : découper un clip en bandes (A10) ─────────────────────────

  "bande.nom": {
    nom: "Le nom de l'animation",
    ou: "galerie",
    quoi: "Comment cette animation-là s'appellera, une fois tirée du clip.",
    change:
      "Ce que tu liras dans la liste des bandes, et ce qui partira dans le descriptif de l'export. **Un clip en porte plusieurs** : un même tirage donne souvent un repos et une marche, et sans nom tu ne saurais plus laquelle est laquelle.",
    origine: "l'atelier propose le mouvement demandé · tu écris ce que tu veux",
    long: "Une bande se garde sous un nom, toujours : c'est la seule chose que l'écran exige.\n\nLa case qu'elle remplit, elle, est facultative. **Une bande sans case est un brouillon, et un brouillon ne bloque rien** — tu gardes d'abord, tu ranges ensuite, comme partout ailleurs dans l'atelier.",
  },

  "bande.cadre": {
    nom: "Le cadre de la bande",
    ou: "galerie",
    quoi: "Le rectangle sur lequel toutes les images de la bande sont recadrées.",
    change:
      "La taille à laquelle ton personnage sort, et **si elle reste la même d'une animation à l'autre**. Pris sur le clip entier, toutes les bandes de ce clip ont la même assise ; pris sur la bande seule, elles ne s'accordent plus entre elles.",
    origine: "mesuré par l'atelier · repris à la main si besoin",
    long: "Sans cadre commun, chaque image se recadre sur sa propre silhouette. Un bras tendu agrandit la silhouette, donc réduit tout le personnage : mesuré sur un vrai clip, **il grandit de dix pour cent en se mettant à marcher**.\n\nUne fenêtre par bande cale les images *d'une* bande entre elles ; il faut une fenêtre par clip pour caler *les bandes* entre elles. C'est pourquoi « du clip » est le choix par défaut.\n\nLes deux autres existent quand même : un cadrage automatique se trompe parfois, et une bande où le personnage quitte le champ a besoin du sien.",
  },

  "bande.recette": {
    nom: "La recette du découpage",
    ou: "galerie",
    quoi: "Ce qu'on fait aux images du clip pour en tirer des sprites : détourer, réduire, limiter les couleurs.",
    change:
      "L'aspect de la bande, et rien d'autre. **Elle part de celle du jeu et ne s'y substitue jamais** : ce que tu changes ici s'écrit sur cette bande-là, ton jeu ne bouge pas, et la bande suivante repart du jeu.",
    origine:
      "celle du jeu · celle de la bande · celle d'une image ou de plusieurs",
    long: "La règle a changé le 3 septembre 2026 : le jeu est le **point de départ**, jamais une prison. Une bande a le droit de sortir plus fine ou avec moins de couleurs que le reste.\n\nCe qui reste de l'ancienne règle en est le fond : **une bande qui s'écarte de son jeu le dit**, en clair, sous les réglages, une phrase par écart.\n\nIl y a un cran de plus depuis le 5 septembre 2026 : **une image seule peut porter sa recette à elle**. Elle naît au premier réglage que tu touches sur cette image-là, copiée de celle de la bande à cet instant — rien ne se remet à zéro —, et le ruban marque d'un liseré les images qui s'écartent. « Reprendre la recette de l'animation » rend l'image au défaut, et se défait comme le reste.\n\n**Tu peux en choisir plusieurs.** Clique une image du ruban, puis maj-clique une autre pour prendre tout ce qui est entre les deux ; ctrl-clic en ajoute ou en retire une ; « toutes » et « une seule » font la même chose sans souris. Ce que tu règles ensuite se pose sur toutes les images choisies.\n\nDeux gestes, et ils ne font pas la même chose. **Un curseur ne déplace que la valeur que tu touches** : une image qui avait douze couleurs les garde, seule la tolérance que tu viens de bouger voyage. **Une recette enregistrée remplace tout** — c'est un ensemble, en prendre la moitié donnerait une image que personne n'a jamais jugée —, et l'écran te dit avant, en une phrase, combien d'images vont perdre la leur. Quand les images choisies ne sont pas d'accord, la table concernée porte le mot *séparé* et les curseurs montrent la valeur de l'image en cours.\n\nUne retouche à la main, elle, ne se remplace pas : une recette enregistrée n'en porte aucune — l'atelier la lui retire quand tu l'enregistres, parce qu'un point posé sur une pose tombe ailleurs sur la suivante — et poser cette recette laisse donc en place celle que l'image avait.\n\nUne animation d'avant ce jour-là se rouvre telle quelle : sans recette d'image, c'est celle de la bande qui vaut pour toutes, et rien n'a été migré.\n\nLa fenêtre commune, elle, reste mesurée avec la recette de la bande. Une image qui s'en écarte peut donc déborder d'un côté, et l'écran te le dit plutôt que de remesurer vingt secondes à chaque cran de curseur : c'est un bouton.",
  },

  "bande.vitesse": {
    nom: "La vitesse de la bande",
    ou: "galerie",
    quoi: "Combien d'images par seconde, et dans quel sens elles se jouent.",
    change:
      "L'aperçu que tu regardes **et** ce qui partira dans ton moteur de jeu. C'est le même réglage : deux — un pour regarder, un pour livrer — finiraient par se contredire, et c'est toi qui découvrirais l'écart dans le jeu.",
    origine: "proposée par le mouvement · réglée ici",
    long: "*En boucle* : la dernière image est suivie de la première. *Aller-retour* : on repart en arrière au lieu de sauter au début — ce qui double la durée sans doubler les images, et qui est la bonne réponse pour un balancement, une respiration, une flamme.\n\nIl n'y a pas de *une seule fois* : ce n'est pas une propriété de la bande, c'est une décision de ton moteur au moment où il la joue.",
  },

  "bande.gardees": {
    nom: "Les bandes de ce clip",
    ou: "galerie",
    quoi: "Ce que tu as déjà tiré de ce tirage-ci.",
    change:
      "Le prix par animation, qui **baisse à chaque bande gardée**. Un clip de cinq secondes porte plus qu'un cycle de marche, et c'est ce compteur qui te dit ce que tu as vraiment payé pour une animation utilisable.",
    origine: "ce que tu as gardé",
    long: "Effacer une bande n'efface ni le clip ni ses images : un découpage raté ne coûte rien. C'est toute la différence avec l'autre moitié de l'atelier, où jeter une image est jeter de l'argent.\n\nLe prix par bande est le seul chiffre que la version ne connaissait pas d'avance : combien de clips faut-il pour une animation utilisable. Il se remplit à l'usage, ici.",
  },

  "agent.plafond": {
    nom: "Plafond de la séance",
    ou: "reglages",
    quoi: "Le nombre d'images que l'agent peut faire produire depuis l'ouverture de l'atelier.",
    change:
      "Atteint, l'agent reçoit un refus qui nomme le plafond et te renvoie ici — aucune fenêtre ne s'ouvre, rien ne t'interrompt. Il compte des images, pas des appels : quatre variations d'un seul prompt en consomment quatre, parce que c'est ce qui est facturé.",
    origine: "toi · défaut 20, actif · repart à zéro à chaque ouverture",
    long:
      "Il compte depuis l'ouverture de l'atelier et pas plus loin : le remettre à zéro est un geste que tu connais déjà, fermer la fenêtre. Un total gardé sur le disque poserait la question de quand le purger, qui n'a pas de bonne réponse.\n\nLe désactiver ne perd pas le chiffre que tu y avais posé : l'interrupteur et la valeur sont deux réglages, et rallumer te rend le tien.\n\nLe changer prend effet à l'appel suivant. Rien à redémarrer — l'atelier relit ce réglage à chaque question que l'agent lui pose.",
  },
  "agent.modele": {
    nom: "Modèle d'exploration",
    ou: "reglages",
    quoi: "Le modèle imposé à l'agent, quel que soit celui qu'il demande. Il se choisit parmi ceux qui ne coûtent pas d'argent, et il n'y a que ceux-là dans la liste.",
    change:
      "Toutes ses générations partent sur ce modèle. Éteint, l'agent choisit — et s'il ne choisit pas, c'est encore celui-ci qui sert : personne ne doit tomber sur le modèle le plus cher du catalogue par accident. **C'est aussi le seul moyen de lui laisser un modèle payant**, et c'est voulu : un « modèle d'exploration » qui pourrait être le plus cher ne protégerait de rien.",
    origine: "toi · défaut : le modèle gratuit, actif",
    long:
      "Un agent qui code a besoin d'un visuel correct tout de suite, pas d'un asset final. C'était déjà l'idée avant : un modèle payant en qualité basse, rapport de six sur le coût du travail agentique. Depuis qu'un fournisseur ne facture rien, c'est la totalité — **une séance de code entière ne fait plus bouger ton total en argent**.\n\nCe qu'un modèle gratuit ne sait pas faire : prendre des images d'entrée. Le style de ton jeu — tes artworks officiels, les concept arts de la chose, les images de son ambiance — **ne part donc pas avec ces images-là**. L'appel part quand même, sur le texte seul, et la fiche de l'image le dit ensuite : *partie sans le style du jeu*. Sans cette phrase tu retrouverais des semaines plus tard des images qui ne ressemblent pas aux autres sans savoir pourquoi.\n\nLa version de production se regénère depuis l'atelier : *reprendre les réglages* repose le texte tel qu'il est parti, tu choisis un modèle payant, et le style du jeu repart tout seul — rien à recocher.\n\nSi le catalogue ne déclare pas ce modèle — il a disparu, ou l'atelier tourne sur son catalogue de repli —, l'atelier en cherche un autre gratuit avant de prendre le défaut du catalogue. Un garde-fou posé pour ne rien dépenser qui se replierait sur un payant coûterait de l'argent en silence, ce qui est pire que pas de garde-fou.",
  },
  "agent.dossier": {
    nom: "Dossier du jeu",
    ou: "reglages",
    quoi: "Où l'agent pose les fichiers quand il ne dit pas où.",
    change:
      "Un dossier manquant est créé, et un fichier de même nom n'est jamais écrasé — il est numéroté. Un dossier qui refuse l'écriture est refusé à l'agent avec le chemin fautif, pour qu'il sache lequel des trois qu'il vient de nommer a posé problème.",
    origine: "toi · vide au départ, et c'est un état légitime",
    long:
      "Vide, l'agent nomme son dossier à chaque appel — c'est permis, et c'est même ce qu'il fera s'il range ses sprites et ses tuiles à deux endroits différents.\n\nCe qui est posé là est le rendu, jamais le brut : l'image qu'on voit, celle qui entre dans le jeu. Le brut reste ici, et c'est lui qui permet de refaire le rendu.",
  },
  // ── Les fabriques ─────────────────────────────────────────────────────────
  //
  // **Une fabrique ne modifie pas une image, elle en écrit d'autres sur le
  // disque.** Ce n'est pas la même chose qu'une retouche qu'on défait, et c'est
  // pour ça que ce groupe existe — le guide ne disait nulle part qu'il y a des
  // outils qui ne sont pas des tables, et c'est pourtant la distinction qui
  // décide où on va les chercher.

  "fabrique.planche": {
    nom: "La planche de poses",
    ou: "fabriques",
    quoi: "Une feuille où le modèle dessine plusieurs attitudes du même personnage en un seul appel, et que l'atelier redécoupe ensuite en images séparées.",
    change:
      "Elle divise le prix : une planche coûte le prix d'un appel quel que soit le nombre de cases qu'elle porte. Et elle achète quelque chose qu'aucun appel séparé ne garantit — les cases sortent à la même échelle et dans le même style, puisqu'elles ont été peintes ensemble.",
    origine: "les cases que tu coches dans l'établi ou dans le codex",
    long:
      "Le risque se dit avec : c'est **un jet unique**, que le modèle ne rend pas deux fois. Une planche ratée se repaie entière, et un compte de cases faux ne fait rien entrer du tout — la planche entière se relance au prix plein.\n\nLa feuille elle-même n'entre jamais en bibliothèque ; ses morceaux, oui, chacun filié vers elle.",
  },

  // ── La première fabrique : le découpage ───────────────────────────────────
  //
  // **Deux gestes séparés exprès** : proposer ne crée rien, découper coupe ce
  // qu'on lui donne. C'est cette séparation, et rien d'autre, qui tient la
  // promesse « sans jamais bloquer » — et c'est ce que ces entrées doivent dire
  // avant de décrire un curseur.

  // ── La seconde fabrique : la superposition ───────────────────────────────
  //
  // **Le guide ne disait nulle part qu'il existe des outils qui ne sont pas des
  // tables**, et c'est pourtant la distinction qui décide où on les cherche :
  // une table règle une image et rend la même ; celui-ci en prend deux et en
  // fabrique une troisième.

  "fabrique.superposition": {
    nom: "La superposition",
    ou: "fabriques",
    quoi: "L'outil qui pose une pièce d'équipement sur un personnage : il prend le corps nu et le corps habillé, et il en tire le calque de ce qui a été ajouté.",
    change:
      "Rien sur les deux images de départ, qui ne sont jamais repeintes. Elle en produit une troisième — un calque —, et un calque est solidaire de la pose sur laquelle la pièce est apparue : il en faut un par pose.",
    origine: "deux images que tu désignes, dans la même pose",
  },

  "superposition.images": {
    nom: "les deux images",
    ou: "fabriques",
    quoi: "Le dessus, qui se déplace, et le dessous, qui est le sol et ne bouge jamais.",
    change:
      "Rien sur les deux images de départ, qui ne sont jamais repeintes. Intervertir les deux change le résultat, puisque le calque est fait de ce que le **dessus** ajoute.",
    origine: "toi · deux images que tu désignes, dans la même pose",
    long:
      "Le cas principal est l'aller-retour d'un équipement : l'atelier assemble une planche avec les corps du personnage, la fait habiller par le modèle, et redécoupe chaque case — il obtient alors, pour chaque corps, l'image envoyée et l'image revenue. C'est cette paire qui remplit l'outil par défaut.\n\nMais il marche sur **n'importe quelles deux images** de la bibliothèque, sans aller-retour et sans planche. Poser un corps nu sur un corps casqué donnerait le crâne nu au lieu du casque : c'est pour ça que le sens compte.",
  },

  "superposition.detourage": {
    nom: "avant de caler",
    ou: "fabriques",
    quoi: "L'état du détourage des deux images — c'est lui qui décide si un calque est seulement possible.",
    change:
      "Rien tant que tu ne reprends pas les passes. Une image qui revient du modèle est opaque de bord à bord : sans alpha sur le dessus, le calque emporte tout le fond de l'image.",
    origine: "la recette de chaque image · reprendre écrit dans celle du dessus",
    long:
      "Un pixel entre dans le calque s'il est **opaque dans le dessus et transparent dans le dessous**. Si le dessus n'est pas détouré, tout y est opaque — fond compris —, donc tout ce qui entoure le corps remplit la condition et part avec la pièce.\n\nLe dessus hérite du détourage du dessous, prérempli : même sujet, même fond plat, même modèle. Ce que ça pose va dans la recette de l'image, pas dans la superposition — le détourage d'une image est vrai pour elle-même, elle en aura besoin de toute façon pour partir dans le jeu.\n\nL'alerte nomme la conséquence et propose le geste ; **elle ne refuse pas**. Une image qui remplit légitimement son cadre existe, et l'atelier n'a pas les moyens de savoir laquelle il a sous les yeux.",
  },

  "superposition.voir": {
    nom: "voir les deux images",
    ou: "fabriques",
    quoi: "L'opacité et le mode de couleur du dessous, l'opacité du dessus.",
    change:
      "Rien du tout à ce qui sort — c'est de l'affichage, et rien d'autre. Ils existent pour une seule raison : caler à l'œil deux images qui se ressemblent.",
    origine: "toi · le dessous teinté à 50 %, le dessus à 92 %",
    long:
      "**Teinte** repeint tous les pixels opaques du dessous d'une seule couleur vive : c'est celui qui sert au calage, parce qu'aucune de ces couleurs n'existe dans un sprite. **Négatif** sert quand les deux images ont déjà des couleurs proches. **Normale** sert à vérifier le rendu final.",
  },

  "superposition.calage": {
    nom: "le calage",
    ou: "fabriques",
    quoi: "Où le dessus se pose sur le dessous — une proposition, puis ce que tu ajustes.",
    change:
      "Rien à la génération, et pas un centime : les deux images sont déjà payées. Avant, un recalage raté n'avait aucun recours — le calque était perdu et il fallait relancer une génération.",
    origine: "une proposition du produit, reprise à la main",
    long:
      "**Recaler est un bouton, pas un mode.** Il essaie 131 échelles et cherche pour chacune le décalage qui fait le mieux coïncider les deux silhouettes, sur des vignettes de 128 px pour rester rapide. Puis il remplit les trois champs et s'arrête là : il ne verrouille rien, ne refuse rien, et n'empêche aucun ajustement.\n\nOn le relance autant qu'on veut — il repart alors de zéro, pas de l'ajustement. Quand il tombe à côté, ce qui arrive quand le modèle a dézoomé le personnage pour faire de la place à la pièce, on corrige à la main.",
  },

  "superposition.echelle": {
    nom: "échelle du dessus",
    ou: "fabriques",
    quoi: "La taille du dessus par rapport au dessous. Détente à 1,000.",
    change:
      "C'est **le seul réglage de l'outil qui abîme l'image** : rééchantillonner du pixel art à un facteur qui n'est pas simple détruit la grille. Le champ le marque ; il ne le refuse pas.",
    origine: "toi · proposé par le recalage",
    long:
      "**Elle ne part pas toujours de la taille d'arrivée de l'image.** Le cadre du dessous fait loi : un dessus plus grand que lui y entre entier, réduit pour tenir, et c'est *à partir de là* que 1,000 se compte. L'écran le dit quand ça arrive, avec la taille de départ et la réduction — sans quoi on lirait « × 1,00 » en croyant que rien n'a bougé.\n\nUn dessus qui tient déjà dans le cadre, lui, s'y pose à sa taille et rien n'est dit : c'est le cas courant.",
  },

  "superposition.decalage": {
    nom: "décalage du dessus",
    ou: "fabriques",
    quoi: "De combien le dessus se déplace, en pixels de l'image rendue.",
    change:
      "Rien à la génération. Le signe suit l'écran : la touche qui monte fait monter l'image.",
    origine: "toi · proposé par le recalage",
    long:
      "Les touches sont dessinées sous chaque rail plutôt que listées dans une aide, et **elles sont aussi les boutons** : une seule chose à l'écran fait donc deux métiers — elle enseigne et elle agit. Un raccourci écrit dans une aide n'est jamais lu ; dessiné sous le réglage qu'il commande, il se voit au moment où on en a besoin. Maj multiplie le pas par dix.",
  },

  "superposition.seuil": {
    nom: "ce qu'on garde du dessus",
    ou: "fabriques",
    quoi: "De combien une couleur doit changer pour compter comme changée, et le rectangle hors duquel le dessus est masqué.",
    change:
      "Rien à la génération. **Le rectangle sert deux fois** : il isole la pièce pour qu'on voie le corps dessous pendant qu'on cale, et ce qu'il masque à l'écran, il le masque aussi à la sortie.",
    origine: "toi · aucun rectangle au départ, seuil 32",
    long:
      "Le seuil est un réglage qui décide **partout** ; le rectangle est un cadre qui décide **quelque part**. Les deux se complètent : le seuil fait le gros du travail d'un coup, le rectangle rattrape ce qu'une couleur ne pouvait pas voir — un casque sombre sur des cheveux sombres, par exemple, qu'aucun seuil ne distingue.",
  },

  "superposition.sorties": {
    nom: "ce qu'on en sort",
    ou: "fabriques",
    quoi: "Le calque — ce que le dessus ajoute, sur fond transparent — et l'aplat — les deux fondues en une.",
    change:
      "Les deux **se cochent au lieu de s'exclure** : on veut souvent le calque pour le réutiliser et l'aplat pour l'avoir tout de suite. Ce qui est fabriqué n'a rien coûté — l'argent a été dépensé deux fois, pour les deux images, et les deux filiations y mènent.",
    origine: "toi · le calque seul au départ",
    long:
      "Le calque est la pièce d'équipement : elle va au vestiaire du personnage et s'empile ensuite sur les autres poses. L'aplat est le personnage habillé, en une seule image, prêt à partir dans le jeu tel quel.\n\nCe qui sort est un asset entier, et c'est le seul geste du produit dont le résultat a **deux ascendants** : ses pixels et son parent viennent du dessus, le dessous est une référence gardée pour que la superposition se rejoue. Sa recette est vide, parce que les deux images étaient déjà rendues.",
  },

  "superposition.fond": {
    nom: "le fond du calque",
    ou: "fabriques",
    quoi: "Sur quoi on regarde le calque seul — le damier, ou l'un des cinq aplats vifs.",
    change:
      "Rien : c'est de l'affichage. Il sert à repérer les **pixels oubliés**, ceux qui auraient dû partir avec le corps et sont restés accrochés au calque.",
    origine: "toi · le damier au départ",
    long:
      "Sur le damier, les miettes de fond se confondent avec la transparence ; sur un aplat vif elles sautent aux yeux. La bonne couleur dépend de celles du sprite, d'où six fonds et pas un.",
  },

  "superposition.resultat": {
    nom: "le résultat",
    ou: "fabriques",
    quoi: "Le dessous à 100 %, le calque par-dessus — tel que ce sera dans le jeu.",
    change:
      "Rien : c'est une lecture. Maintenir « masquer le calque » le retire le temps de l'appui, et c'est ce qui dit si la pièce tient sur le corps.",
    origine: "les deux images, telles que tu les as calées",
    long:
      "Les trois vues sont **vivantes** : déplacer le dessus d'un pixel les met toutes à jour. C'est ce qui permet de caler en regardant le résultat plutôt que le travail, et c'est la raison d'être de cette disposition à trois panneaux.",
  },

  "superposition.mesures": {
    nom: "ce que la comparaison a mesuré",
    ou: "fabriques",
    quoi: "Cinq nombres : silhouette, corps repeint, ajout, échelle, compacité.",
    change:
      "Rien. **Aucune ne refuse quoi que ce soit** — elles disent si la superposition a réussi, et servent à ranger les calques d'un vestiaire dans l'ordre où il faut les regarder. Le seul refus automatique du produit reste le compte d'images.",
    origine: "une mesure sur tes deux images",
    long:
      "**Silhouette** : ce qui reste du corps de départ. Proche de 1, le modèle a gardé la forme.\n\n**Corps repeint** : la part du corps dont la couleur a changé, hors de l'endroit où la pièce est tombée. C'est la mesure qui décide — beaucoup de repeint veut dire que le modèle a redessiné le personnage au lieu de l'habiller.\n\n**Ajout** : ce qui est apparu, en part du corps. Elle s'affiche mais ne classe rien : une pièce contenue en ajoute peu, une cape beaucoup, et les deux vont bien.\n\n**Échelle** : la taille du dessus au retour. 0,62 veut dire que le modèle a dézoomé pour faire de la place.\n\n**Compacité** : la part de la différence qui tient dans sa plus grosse tache. Proche de 1, un objet ; proche de 0, une poussière semée partout, donc un repeint déguisé.",
  },

  "decoupe.mode": {
    nom: "Détection",
    ou: "fabriques",
    quoi: "Comment les rectangles sont proposés : « auto » cherche les zones opaques, « grille » découpe en cases égales.",
    change:
      "Ne découpe rien — propose. Ce qui part à la découpe est la liste que tu vois à droite, corrections à la main comprises. Changer ce réglage relance la détection et remplace ce que tu as dessiné.",
    origine: "toi · défaut auto",
    long:
      "Le mode auto lit un alpha, donc il détoure d'abord : une planche telle qu'elle arrive du modèle est opaque de bord à bord, et sa seule zone connexe serait l'image entière. C'est la même règle que pour la palette — ce qui est majoritaire n'est pas ce qui compte.\n\nLa grille fixe n'est pas un repli de l'auto : elle répond à une planche d'une autre nature — des sprites qui se touchent, des cases vides à conserver — et c'est toi qui sais laquelle tu as.\n\nUne détection qui rend une seule boîte, ou aucune, est un résultat et pas une panne. Rien ici ne bloque : tu dessines les rectangles qui manquent, tu retires ceux qui sont en trop, et c'est ta liste qui part.",
  },

  "decoupe.taille_min": {
    nom: "taille minimale",
    ou: "fabriques",
    quoi: "En dessous de ce côté, en pixels, une zone opaque n'est pas un sprite.",
    change:
      "Monte-la pour ignorer les éclats de fond qui ont survécu au seuil ; descends-la pour rattraper un petit sprite oublié. Chaque cran relance la détection et remplace ce que tu avais dessiné.",
    origine: "toi · défaut 16 px",
    long:
      "Exprimé en côté et non en aire parce que c'est ce que l'œil voit sur l'image : « ignore ce qui fait moins de seize pixels ». La comparaison, elle, se fait sur l'aire — une lance de 4 × 200 pixels a un petit côté minuscule et reste un sujet.\n\nDeux morceaux séparés de moins de deux pixels sont réunis avant le rejet, jamais après : un arc détaché du corps qui le tient vaut 24 px une fois recollé, et les rejeter séparément les perdrait tous les deux.",
  },

  "decoupe.colonnes": {
    nom: "colonnes",
    ou: "fabriques",
    quoi: "Le nombre de colonnes égales dans lesquelles la planche est coupée.",
    change:
      "Avec les lignes, décide du nombre de découpes proposées : colonnes × lignes, cases vides comprises. Le reste de la division se répartit — rien n'est jeté au bord droit.",
    origine: "toi · défaut 4",
    long:
      "Une planche de 1000 px en 3 colonnes donne 334, 333 et 333, et la dernière case va bien jusqu'au dernier pixel. Une division qui laisse tomber deux pixels laisse tomber une colonne de sprite au bord droit, et ça ne se voit qu'après découpe.",
  },

  "decoupe.lignes": {
    nom: "lignes",
    ou: "fabriques",
    quoi: "Le nombre de rangées égales dans lesquelles la planche est coupée.",
    change:
      "Avec les colonnes, décide du nombre de découpes proposées. Une case vide donne quand même un rectangle : la grille fixe ne saute rien, et c'est ce qui la rend prévisible. Retire-le à la main si tu n'en veux pas.",
    origine: "toi · défaut 2",
  },
}

/**
 * Ce qui n'a pas encore d'entrée.
 *
 * **Un réglage sans entrée n'a pas de pointillé, et rien ne casse** — aucune
 * bulle vide, aucun « à documenter » dans le châssis. C'est le guide qui tient
 * la liste de ses manques, dans sa dernière section : un manque de guide est un
 * fait sur le guide, et il se range là où les guides vivent. Même partage que
 * le journal des ratés, qui vit hors de la grille.
 *
 * **Cette liste ne porte que ce qu'on pourrait écrire et qu'on n'a pas écrit.**
 * Un seuil interne — les 240 ms sous lesquelles la jauge de retouche ne paraît
 * pas — n'est pas un réglage : personne ne peut le toucher, et aucun libellé de
 * l'écran ne pourrait porter son pointillé. Il vit dans `docs/DESIGN.md`
 * § Motion, là où les décisions de mouvement se tranchent. Une liste de manques
 * qui garde un item impossible à combler cesse d'être une liste de travail.
 *
 * **Elle a été tenue à la main, et c'est pour ça qu'elle mentait.** Elle disait
 * une ligne quand onze sujets entiers n'étaient expliqués nulle part — le codex,
 * les ambiances, la planche de poses, l'écran de confirmation, la vitrine, les
 * contours, la main, la superposition, le calibrage, les dépenses, le premier
 * lancement. Rien ne rappelait de l'allonger quand un écran naissait. La règle
 * qui remplace la bonne volonté est écrite ailleurs, dans le dossier des
 * maquettes : **une maquette qui ajoute un écran ou un réglage doit une ligne au
 * guide, et elle l'écrit chez elle**. Les onze ont payé, et les entrées sont
 * ici.
 */
export const SANS_ENTREE: readonly string[] = [
  "les réglages qu'un modèle déclare en propre — le catalogue les nomme, et il change d'un jour à l'autre",
  "les deux dosages d'une palette — la proportion et l'attraction : ce qu'ils font est mesuré, ce qu'ils veulent dire ne l'est pas encore écrit",
]

/** L'entrée d'un réglage, ou `undefined` — auquel cas rien ne se marque. */
export function explication(cle: string | undefined): Explication | undefined {
  return cle ? AIDE[cle] : undefined
}
