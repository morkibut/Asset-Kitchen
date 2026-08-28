// Le corpus des explications — un seul texte, deux rendus.
//
// « L'infobulle et le guide sont le même texte » (`docs/DESIGN.md` § Un seul
// corpus, deux rendus). Le panneau de 280 px rend les trois lignes d'une
// entrée ; l'écran Guide les rend toutes à la file, avec la version longue
// quand il y en a une. Une explication recopiée dans deux fichiers diverge en
// trois semaines, et c'est celle qui est sous les yeux au moment du doute qui
// sera la fausse.
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
// rencontre les choses : ce qu'on pose une fois (l'univers), ce qu'on touche à
// chaque génération (l'atelier), ce qu'on retouche après (la fiche), ce qu'on
// ne fait que sur une planche (la découpe), et ce qu'on règle une fois pour
// toutes — le cadre de l'agent, arrivé en T7.

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
  /** Où ça se règle, pour le sommaire du guide. **Un écran, pas un thème** :
   *  quand on cherche une explication, on se souvient d'où l'on était. */
  ou: "univers" | "atelier" | "retouche" | "decoupe" | "reglages"
}

export const AIDE: Record<string, Explication> = {
  // ── L'univers — la bible ──────────────────────────────────────────────────
  //
  // Cinq champs voisins dans le même bloc, tous du texte libre, et rien à
  // l'écran ne dit lequel porte quoi. C'est la forme exacte du défaut qui a
  // lancé ce chantier — `groupe` contre `famille` —, à cinq exemplaires.

  "univers.bible": {
    nom: "Bible",
    ou: "univers",
    quoi: "Cinq champs nommés qui disent ce qu'est ton jeu — monde, époque, trait, éclairage, contraintes techniques.",
    change:
      "Chaque champ actif et non vide part en tête du prompt, à chaque génération, sans que tu le retapes. Un champ éteint ne part pas : l'interrupteur est le doseur.",
    origine: "toi, une fois par projet · cinq champs vides au départ",
    long:
      "Cinq champs nommés plutôt qu'un texte libre, et toute la différence est dans le geste : un texte libre est ce qu'on retape, des champs nommés sont ce qu'on dose. Tu peux relâcher le trait sans relâcher le monde, essayer une génération sans les contraintes techniques, et remettre l'interrupteur sans avoir rien réécrit.\n\nLa liste est close, et son ordre est celui de l'écran comme celui du prompt. Un sixième champ se paierait à chaque génération, en lecture et en décision.\n\nLes intitulés partent en anglais — « World: », « Lighting: » —, parce que tous les modèles du catalogue sont entraînés dessus et qu'« Éclairage : » dégraderait ce que « Lighting: » obtient. C'est une traduction de fournisseur : elle ne remonte jamais dans le produit. Ton texte, lui, part exactement tel que tu l'as écrit.",
  },

  "bible.monde": {
    nom: "monde",
    ou: "univers",
    quoi: "Où ça se passe et de quoi c'est fait — le lieu, la matière, l'ambiance.",
    change:
      "Part sous « World: » en tête du prompt, à chaque génération. C'est le champ qui tient la cohérence entre deux images faites à trois semaines d'écart.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.epoque": {
    nom: "époque",
    ou: "univers",
    quoi: "Le moment technologique du jeu — ce qui existe déjà, et ce qui n'existe pas encore.",
    change:
      "Part sous « Era: ». C'est ce qui empêche une arbalète de ressortir avec une lunette de visée.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.trait": {
    nom: "trait",
    ou: "univers",
    quoi: "Comment c'est dessiné : le contour, les aplats, les ombres.",
    change:
      "Part sous « Line and shading: ». C'est le champ le plus proche du rendu, donc le premier à relâcher quand tout se ressemble trop.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.eclairage": {
    nom: "éclairage",
    ou: "univers",
    quoi: "D'où vient la lumière, et ce qu'elle laisse comme ombres.",
    change:
      "Part sous « Lighting: ». Deux sprites éclairés de deux côtés différents ne se montent pas dans la même scène.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.technique": {
    nom: "contraintes techniques",
    ou: "univers",
    quoi: "Ce que l'image doit être, indépendamment de ce qu'elle montre — fond uni, une seule pose, aucun cadre.",
    change:
      "Part sous « Technical constraints: ». C'est le champ qui évite les pièges mesurés des modèles, et il agit en amont de tout le post-traitement.",
    origine: "toi · vide, donc ne part pas",
    long:
      "Deux phrases y valent leur place, et elles ont été payées au banc d'essai.\n\n« One single sprite, one pose only » — sans elle, Gemini rend spontanément une planche de trois poses : il calque la mise en page de son image de référence. Le piège est mesuré, pas supposé.\n\nUne consigne de fond uni, ensuite. Le détourage par défaut remplit depuis le bord et rend une silhouette propre sur un fond plat sans demander aucun réseau ; sur un fond chargé, mesuré, il garde 100 % de l'image — il échoue entièrement. Ce champ-là est donc ce qui garde le geste courant gratuit.",
  },

  // ── L'univers — la palette ────────────────────────────────────────────────

  "univers.palette": {
    nom: "Palette",
    ou: "univers",
    quoi: "Les couleurs de ton univers, lues par calcul sur tes artworks officiels — elle ne se saisit jamais.",
    change:
      "Elle devient la palette de quantification de tout ce qui naît dans le projet. Sans artwork officiel il n'y a pas de palette, et l'étape Quantification reste grisée avec sa raison.",
    origine: "calculée · un cache nommé par l'empreinte des artworks qui l'ont produite",
    long:
      "La palette est dérivable des artworks : la garder comme une valeur saisie serait une seconde vérité sur la même chose, et deux vérités sur la même chose finissent par diverger. Elle porte donc l'empreinte des artworks qui l'ont produite — promouvoir une carte, en retirer une, ou changer le nombre de couleurs ne correspond plus, donc se recalcule tout seul.\n\nElle est lue sur le sujet, jamais sur le fond. La coupe médiane appliquée aux artworks tels quels rendait vingt gris sur vingt-quatre : le fond plat occupe 75 % des pixels et son anti-crénelage l'éclate en autant de seaux. On détoure donc d'abord, et la palette passe à quinze couleurs franchement distinctes.\n\nCorollaire à connaître : une région fermée reste opaque au détourage, donc l'intérieur d'un cadre d'interface entre dans la palette. C'est la même règle qui sauve l'os d'un squelette.",
  },

  "univers.couleurs": {
    nom: "Couleurs demandées",
    ou: "univers",
    quoi: "Combien de couleurs on demande à la lecture des artworks — le seul réglage qu'on ait sur la palette.",
    change:
      "Change la palette, donc le rendu de tout ce qui se quantifie ensuite. La changer relance le calcul sur les mêmes artworks, sans un appel payant.",
    origine: "toi · défaut 24",
  },

  // ── L'univers — ce qu'il impose ───────────────────────────────────────────

  "univers.cible_px": {
    nom: "Taille de pixel",
    ou: "univers",
    quoi: "Le côté de case, en pixels, imposé à tout ce qui entre dans ce projet.",
    change:
      "Toute image née ici arrive déjà remise sur cette grille. Les assets déjà là ne bougent pas tout seuls — « Tout réaligner » est un geste, jamais un effet de bord.",
    origine: "toi, une fois par projet · défaut 64",
    long:
      "Imposée, jamais déduite de l'image reçue. Dix modèles sur douze font dériver la taille du pixel d'une génération à l'autre : la grille rendue va de 7 à 20 px, facteur 2 à l'intérieur d'un même lot. Déduire la cible de ce qui revient reviendrait à laisser le fournisseur décider de l'échelle de ton jeu.\n\nRéaligner ne coûte rien — aucun appel payant, aucune image regénérée : les octets bruts sont là, et la recette se rejoue en millisecondes. Le balayage saute les assets ramenés au brut, parce que le vide est une décision : revenir à l'image d'origine est un seul geste, et lui reposer une grille le déferait.",
  },

  "univers.bareme": {
    nom: "Barème d'échelles",
    ou: "univers",
    quoi: "La liste des natures de sujet de ton jeu — personnage, meuble, objet tenu, décor — et ce que chacune vaut.",
    change:
      "C'est lui qui remplit le contrôle Sujet de l'atelier. Une échelle porte trois choses à la fois : sa famille, son occupation, et si le sujet se détoure.",
    origine: "sept échelles au départ · mesurées le 27/08 sur sept sujets réels",
    long:
      "Sans barème, tout ce qui sort du produit fait la même hauteur. Ce n'est pas une coïncidence, c'est ce que donne mécaniquement une occupation à 100 % : la case est remplie, donc tout la remplit — et un coffre ressort aussi haut qu'une prêtresse.\n\nTrois choses dans un seul objet parce que deux taxonomies — une pour l'échelle, une pour la famille — se paieraient deux fois à chaque génération. Dire « c'est un objet tenu en main », c'est du même coup dire quelle part de case il occupe et quels artworks partent avec lui. C'est ce qui garde un seul contrôle au moment de générer.\n\nLes sept échelles de départ sont des valeurs de départ, pas une table de vérité : un jeu où les personnages sont des insectes n'a rien à en faire.",
  },

  "bareme.famille": {
    nom: "famille d'une échelle",
    ou: "univers",
    quoi: "La catégorie d'artworks qu'un sujet de cette nature ira chercher en référence.",
    change:
      "Choisir « objet tenu » à la génération envoie les artworks de la famille objets, plus ceux marqués « tous ». Le nombre de références change le coût.",
    origine: "toi · la famille d'origine de l'échelle",
    long:
      "C'est le même mécanisme que la famille d'une carte, pris par l'autre bout : la carte dit à quelle famille un artwork appartient, l'échelle dit quelle famille un sujet va chercher. Les deux se rencontrent au moment de générer, et rien d'autre ne décide de ce qui part.",
  },

  "bareme.occupation": {
    nom: "occupation d'une échelle",
    ou: "univers",
    quoi: "La part du côté de la case qu'un sujet de cette nature remplit une fois sur grille, en pourcentage.",
    change:
      "C'est la valeur que la recette reprendra à la naissance de l'asset — 100 % pour un personnage, 40 % pour un objet tenu en main.",
    origine: "toi · mesuré le 27/08 sur sept sujets réels",
    long:
      "Deux images arrivent du fournisseur au même format. Si tu les remets simplement sur une grille de 64 px, le tonneau devient aussi grand que le personnage. L'occupation dit « ce tonneau remplit 45 % de sa case », et l'échelle redevient juste.\n\nElle se pose ici, une fois pour le projet, et pas génération par génération : tu ne veux pas rejouer ce calcul à chaque image. La fiche la porte quand même, pour les cas particuliers — mais y toucher épingle l'asset, qui cesse alors de suivre l'univers.",
  },

  "bareme.silhouette": {
    nom: "se détoure / plein cadre",
    ou: "univers",
    quoi: "Si un sujet de cette nature a un contour, ou s'il occupe tout le cadre.",
    change:
      "« Plein cadre » retire le détourage et le recadrage de la recette posée à la naissance. C'est le réglage du décor : l'enfermer dans une case carrée lui ajouterait des bandes transparentes que personne n'a demandées.",
    origine: "toi · se détoure, sauf « décor »",
    long:
      "Le détourage suit la nature du sujet, pas un réglage de plus. Ne pas poser de passe suffit à dire « décor » : la remise sur grille lit déjà cette distinction — avoir demandé un détourage, c'est avoir dit que ce qu'on traite a une silhouette.\n\nLa remise sur grille, elle, reste de la partie dans les deux cas. Un décor aussi doit tomber sur le pixel du projet.",
  },

  "univers.modeles": {
    nom: "Modèle par famille",
    ou: "univers",
    quoi: "Le moteur d'image proposé par défaut selon la famille du sujet — pas un réglage global.",
    change:
      "Choisir un sujet à l'atelier propose le modèle de sa famille. Une famille sans modèle retombe sur le défaut du catalogue ; ce n'est pas un trou, c'est un réglage qu'on n'a pas posé.",
    origine: "toi · aucun, donc le catalogue décide",
  },

  // ── L'univers — le tableau d'inspiration ──────────────────────────────────
  //
  // Les deux premières entrées sont celles qui ont provoqué tout ce chantier :
  // voisines dans le même menu, l'une inerte et l'autre décisive, et rien à
  // l'écran ne les distinguait.

  "carte.groupe": {
    nom: "groupe",
    ou: "univers",
    quoi: "Un nom libre pour ranger les cartes du tableau. Vide = hors groupe.",
    change:
      "Rien à la génération. C'est un rangement pour l'œil. Ce qui décide des références envoyées, c'est artwork officiel + famille.",
    origine: "toi · aucun défaut",
    long:
      "Un tableau d'inspiration monte vite à cent cartes, et le groupe est ce qui te permet d'en retrouver douze. Il ne voyage nulle part : ni dans un prompt, ni dans une référence envoyée au fournisseur, ni dans un export. Tu peux le remplir, le changer, le vider sans qu'aucune image déjà produite ne bouge, et sans qu'aucune génération à venir ne change de résultat ni de prix.\n\nSi tu cherches le champ qui agit, c'est famille — juste à côté, dans le même menu.",
  },

  "carte.famille": {
    nom: "famille",
    ou: "univers",
    quoi: "La catégorie d'un artwork officiel : personnages, objets, décors, interface, ou « tous » pour une planche non figurative.",
    change:
      "Beaucoup. À la génération, seuls les artworks de la famille de ton sujet partent en référence, plus ceux marqués « tous ». Le nombre de références change le coût.",
    origine: "toi, en promouvant · défaut « tous »",
    long:
      "C'est le mécanisme qui empêche un artwork de contaminer un sujet qui n'a rien à voir avec lui. Au banc d'essai, un goblin figuratif laissé en référence a transmis sa tunique et ses bottes lacées au squelette généré ensuite : la famille est la réponse à ça.\n\n« Tous » est le cas particulier utile — une planche de matières, de palette ou d'échantillons de trait, qui accompagne toute génération sans transmettre de personnage. C'est le défaut, et c'est le bon défaut pour une planche de style.\n\nDeux conséquences à garder en tête : le compte de références est plafonné par modèle (le bloc « Ce qui part » affiche n / max, en rouge au-dessus), et chez certains fournisseurs le prix croît avec le nombre de références — un univers riche peut donc renverser le classement des modèles par coût.",
  },

  "carte.officiel": {
    nom: "artwork officiel",
    ou: "univers",
    quoi: "Promouvoir une carte : elle cesse d'être une inspiration et devient une référence que l'application enverra toute seule.",
    change:
      "C'est l'interrupteur. Une carte non promue ne part jamais, quoi qu'il y ait dans son groupe ou sa famille.",
    origine: "toi · non promu par défaut",
    long:
      "Promouvoir est un geste unique : tu poses officiel et famille une fois, et l'application choisit seule à chaque génération. Il n'y a rien à sélectionner au moment de générer, et c'est délibéré — le cadrage du produit écarte explicitement la sélection manuelle des artworks, génération par génération.\n\nUn texte ne peut pas être promu : ce qui part en référence, ce sont des octets d'image, et la bible dit déjà ce qu'un texte aurait à dire.",
  },

  "carte.note": {
    nom: "note",
    ou: "univers",
    quoi: "Une annotation libre sur une carte — pourquoi tu l'as gardée, ce que tu veux en retenir.",
    change: "Rien à la génération. Elle ne part nulle part, comme le groupe.",
    origine: "toi · aucun défaut",
  },

  "carte.source": {
    nom: "provenance",
    ou: "univers",
    quoi: "L'adresse d'où vient la carte, gardée telle quelle au collage.",
    change:
      "Rien à la génération. Elle est là pour créditer et retrouver : une image trouvée dont on a perdu la source est une image qu'on ne peut plus faire ni l'un ni l'autre.",
    origine: "le collage · vide si tu as collé des octets",
  },

  "carte.taille": {
    nom: "taille",
    ou: "univers",
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
    ou: "univers",
    quoi: "Les deux façons de regarder le même tableau : la grille, qui montre tout d'un coup d'œil, et la toile, où une carte se pose où tu veux et garde sa place.",
    change:
      "Rien à la génération. Mais tirer une carte dans un îlot écrit son groupe, et l'en sortir le vide : sur la toile, composer et classer sont le même geste.",
    origine: "toi · la grille au départ · rien ne s'enregistre",
    long:
      "La règle tient en une phrase, et c'est tout ce qu'il y a à comprendre de cet écran : **la toile montre ce qui est classé, la réserve contient ce qui reste à classer.** Une carte groupée est dans son îlot, une carte posée sans groupe est sur le plan nu, et ce qui n'a ni l'un ni l'autre attend à droite.\n\nUn îlot *est* un groupe — pas un cadre indépendant. Il n'a ni nom propre ni existence propre : il est l'étendue de ses cartes. Le créer, c'est taper un nom de groupe dans le menu d'une carte, ou en tirer une dans un îlot voisin ; le vider de son dernier membre le fait disparaître, parce qu'un groupe sans carte n'est écrit nulle part.\n\nUne carte peut être posée sans être classée : trois images côte à côte pour voir si elles vont ensemble avant de décider qu'elles font un groupe. Son pied dit « posée ».\n\n**Trois gestes, et ils tiennent en trois lignes.** *Tirer* une carte la pose et la classe. *Tirer depuis la petite poignée* d'une carte ou du nom d'un îlot trace un lien vers ce qu'on lâche dessous. *Double-cliquer* sur le plan nu écrit une note à cet endroit-là — c'est une carte texte, tu la retrouves dans la grille.\n\nCtrl+Z défait le dernier geste de composition — déplacer, élargir, classer, déclasser, tirer un lien, le couper. La pile vit dans l'onglet et meurt en quittant l'écran : ce n'est pas un historique de projet, c'est le rattrapage du geste en cours. Au retour, ce qui est sur le disque fait foi.",
  },

  // ── L'Univers — les liens, les notes et la couleur (T9) ───────────────────
  //
  // Cinq entrées pour quatre user stories, et aucune ne porte de raison : ce qui
  // refuse un geste — « ces deux-là sont déjà joints », « aucun îlot de ce
  // nom » — vit dans la fente de l'écran Univers, et ne se survole pas.

  "lien.mot": {
    nom: "mot d'un lien",
    ou: "univers",
    quoi: "Une étiquette courte posée au milieu d'un trait, pour dire *quel* rapport il montre.",
    change:
      "Rien à la génération. Un lien naît muet, et il reste muet tant que tu n'écris rien : un trait nu dit déjà « ceci a rapport avec cela », et c'est le cas courant.",
    origine: "toi · vide au tracé · 32 signes au plus",
    long:
      "Le défaut est muet, l'exception s'exprime. C'est ce qui rend le geste de tracer gratuit : si le mot était demandé au moment du tracé, il faudrait répondre à chaque trait à une question dont la réponse est presque toujours « rien ».\n\nLa borne de 32 signes n'est pas du confort. L'étiquette se pose entre deux objets qui peuvent être à trente pixels l'un de l'autre, et ce qui déborde recouvre ce qu'il relie. Au-delà, ce que tu veux écrire est une note — et une note se pose à même la toile.\n\nLe vider le retire, et le trait redevient ce qu'il était en naissant. Un lien qui porte un mot se survole par son mot ; un lien muet se survole par sa bande.",
  },

  "lien.pointe": {
    nom: "pointe",
    ou: "univers",
    quoi: "La flèche au bout d'un trait, quand le sens du rapport compte.",
    change:
      "Rien à la génération. Elle ne change que ce que le trait montre : sans elle il dit « ces deux-là ont rapport », avec elle il dit « celui-ci va vers celui-là ».",
    origine: "toi · sans pointe au tracé",
    long:
      "Elle se pose à l'arrivée, et l'arrivée est l'objet sur lequel tu as lâché : on tire du départ vers l'arrivée, et la pointe ne fait que rendre visible ce que le geste a déjà décidé.\n\nIl n'y a pas de troisième état — pas de double pointe, pas de retournement. Retourner un lien, c'est le couper et le retirer dans l'autre sens : deux gestes rares plutôt qu'un contrôle permanent sur chaque trait.",
  },

  "note.texte": {
    nom: "texte d'une note",
    ou: "univers",
    quoi: "Ce qu'une carte texte dit — l'intention que tu as posée au milieu des images.",
    change:
      "Rien à la génération. Une note ne part nulle part : ce qui voyage en référence, ce sont des octets d'image, et la bible dit déjà ce qu'un texte aurait à dire.",
    origine: "toi · au collage, ou au double-clic sur la toile",
    long:
      "Sur la toile, un double-clic sur le plan nu ouvre un champ à l'endroit exact où tu as cliqué, et ce que tu écris devient une note posée là. Un champ quitté vide ne crée rien.\n\nLe corriger ici plutôt que de retirer la note et de la recoller : recoller lui ferait perdre sa place, sa teinte et les liens qui y aboutissent.",
  },

  "note.teinte": {
    nom: "teinte d'une note",
    ou: "univers",
    quoi: "Une des six couleurs sourdes, posée sur le fond d'une note.",
    change:
      "Rien à la génération, et rien au rangement non plus. C'est **le seul endroit du produit où une couleur ne veut rien dire** : elle est là parce que tu l'as choisie, jamais parce qu'un état la commande.",
    origine: "toi · sans teinte au départ",
    long:
      "La liste est fermée à six, et il n'existe aucun sélecteur libre : le premier îlot rouge vif se lirait comme un échec. Les six sont posées à la même clarté et sous le contraste de toutes les couleurs qui, elles, disent quelque chose — réussi, réglé à la main, raté, et l'accent du produit.\n\nUne carte image n'en porte aucune, et ce n'est pas un oubli : colorier chaque carte reconstruirait un second rangement, invisible dans la grille et concurrent du groupe. La couleur se pose sur ce qui rassemble — un îlot, une note —, jamais sur ce qui est rassemblé.\n\nLa septième pastille n'est pas une septième couleur : c'est le châssis, c'est-à-dire l'absence de teinte, montrée plutôt que dite.",
  },

  "ilot.teinte": {
    nom: "teinte d'un îlot",
    ou: "univers",
    quoi: "La même palette de six, posée sur le cadre et le nom d'un îlot.",
    change:
      "Rien à la génération, et rien au groupe. Un îlot teinté et un îlot nu contiennent exactement les mêmes cartes, et envoient exactement les mêmes références.",
    origine: "toi · sans teinte au départ · part avec le dernier membre",
    long:
      "Elle ne vit pas sur les cartes de l'îlot : six membres feraient six réponses possibles pour un seul cadre. Elle vit avec le projet, une entrée par nom de groupe.\n\nCorollaire de « un îlot *est* son groupe » : quand la dernière carte en sort, l'îlot cesse d'exister, et sa couleur s'en va avec lui — comme les liens qui y aboutissaient. Ctrl+Z rend les trois d'un coup.",
  },

  // ── L'Atelier ─────────────────────────────────────────────────────────────

  "reglages.modele": {
    nom: "modèle",
    ou: "atelier",
    quoi: "Le moteur d'image qui fabriquera la génération, choisi dans le catalogue du fournisseur.",
    change:
      "Le prix, le rendu, et deux plafonds : le nombre de références acceptées et le nombre de variations possibles. Un modèle qui ne peut pas honorer ta demande reste visible et grisé, avec sa raison — jamais remplacé en silence.",
    origine: "le catalogue · la barre d'état en donne la date",
    long:
      "Le catalogue est une photo, pas un flux : il est relu au démarrage et par le bouton Catalogue, et la barre d'état dit toujours de quand elle date. Hors ligne, le produit sert la dernière photo reçue — générer reste actif, et c'est le seul endroit du produit où l'on propose puis refuse, assumé, avec la conséquence écrite sous le bouton.\n\nLes réglages propres à un modèle ne sont écrits nulle part dans le code de l'interface : ils sont dessinés depuis ce que le catalogue déclare. Un modèle qui gagne un réglage demain l'affiche demain.",
  },

  "reglages.proportions": {
    nom: "proportions",
    ou: "atelier",
    quoi: "Le rapport largeur / hauteur de l'image demandée au fournisseur.",
    change:
      "La forme de ce qui revient, avant tout post-traitement. Les valeurs que le modèle choisi n'accepte pas sont grisées, jamais cachées.",
    origine: "le modèle choisi · défaut 1:1",
    long:
      "Toujours imposé, jamais laissé au défaut du fournisseur : sans lui, Gemini part en 16:9 et Seedream en 1:1. Deux essais cessent alors d'être comparables, et un sprite n'est plus cadrable.",
  },

  "reglages.variations": {
    nom: "variations",
    ou: "atelier",
    quoi: "Combien d'images partent d'un seul clic — 1, 2 ou 4.",
    change:
      "Multiplie le prix à l'identique : 4 variations, ce sont 4 appels et 4 fois le coût. Ce ne sont pas 4 images différentes demandées, ce sont 4 tirages de la même demande.",
    origine: "toi · défaut 1",
  },

  "reglages.sujet": {
    nom: "sujet",
    ou: "atelier",
    quoi: "La nature de ce que tu fabriques — un personnage, un objet tenu en main, un décor — choisie dans le barème de ton univers.",
    change:
      "Trois choses d'un seul geste : quels artworks partent en référence, quel modèle est proposé par défaut, et quelle part de la case le sujet occupera une fois sur grille.",
    origine: "le barème de l'univers · aucun sujet par défaut",
    long:
      "C'est le seul contrôle que le tableau d'inspiration ajoute à l'Atelier, et il porte trois conséquences parce que deux taxonomies — une pour l'échelle, une pour la famille — se paieraient deux fois à chaque génération.\n\nSans sujet choisi, seules les planches marquées « tous » partiront en référence : c'est écrit sous le contrôle, en clair, plutôt que laissé à deviner.\n\nLe barème lui-même se pose dans l'écran Univers, une fois pour le projet. C'est lui qui dit qu'un personnage remplit 90 % de sa case et une fiole 40 % — et c'est ce qui met un tonneau et un personnage à la même échelle de pixel.",
  },

  // ── La retouche — les cinq places de la recette ───────────────────────────
  //
  // **L'ordre ne se négocie pas**, et c'est ce que ces cinq entrées ont à dire
  // avant tout le reste : trois des cinq n'ont aucun sens avant celle qui les
  // précède. Rien ne peut se recadrer avant qu'un alpha dise où est le sujet.

  "etape.detourage": {
    nom: "Détourage",
    ou: "retouche",
    quoi: "La première place de la recette : trouver le fond et le rendre transparent.",
    change:
      "Tout ce qui suit en dépend — le recadrage cherche le sujet dans l'alpha, la grille mesure son occupation dessus. C'est aussi l'étape la plus chère : environ 130 ms, contre 28 pour les quatre autres réunies.",
    origine: "posé par l'univers quand le sujet a une silhouette",
    long:
      "Une étape, mais plusieurs passes possibles. Une passe est un moteur avec ses réglages ; deux passes s'enchaînent sur le résultat de la première, ce qui permet d'attaquer un fond en deux temps — un remplissage large, puis un durcissement de contour.\n\nSéparé de la finition dans le code pour une raison qui se voit à l'usage : bouger un curseur de grille ou de couleurs ne relance pas le détourage, et la retouche reste instantanée. Un cran de tolérance, lui, coûte la seconde et demie complète.",
  },

  "detourage.moteur": {
    nom: "moteur",
    ou: "retouche",
    quoi: "Comment le fond est trouvé : « bord » remplit depuis les bords de l'image, « modèle » demande une silhouette à un réseau.",
    change:
      "« Bord » ne demande aucun réseau et répond en dizaines de millisecondes ; « modèle » coûte une à deux secondes par passe. Le rendu diffère surtout sur les images qui n'ont pas de fond plat.",
    origine: "mesuré le 27/08 sur 12 images · défaut « bord »",
    long:
      "Le remplissage depuis le bord est le moteur du geste courant : sur douze images issues de six modèles, PNG et JPEG, il a rendu douze silhouettes propres — squelette blanc sur fond gris clair et fioles translucides comprises.\n\nSa règle tient en un mot : relié. Un pixel n'est du fond que s'il est relié à un bord par une chaîne de pixels proches de la couleur de bordure. C'est ce qui le distingue d'un seuil global, qui perce le sujet — l'os d'un squelette et le reflet d'une fiole ont la couleur du fond sans y être reliés. Corollaire assumé : une région fermée reste opaque, donc l'intérieur d'un cadre d'interface survit au détourage. Le rendre transparent est un geste de l'auteur, jamais une décision de l'outil.\n\nLes deux moteurs ont été confrontés le 27 août sur six vraies images plus un cas composé. Sur ce que le produit fabrique — fond plat — ils s'accordent à 96,3 % en médiane : le second n'apporte rien, et c'est ce qui justifie qu'il reste facultatif. Sur un fond chargé, le bord garde 100 % de l'image — il échoue entièrement — quand le modèle en isole 19,8 %. C'est sa raison d'être, et elle se mesure.",
  },

  "detourage.tolerance": {
    nom: "tolérance",
    ou: "retouche",
    quoi: "Jusqu'où une couleur peut s'écarter du fond et compter quand même comme fond — l'écart toléré sur chaque composante de couleur.",
    change:
      "Monter mange le sujet par les bords ; descendre laisse un halo de fond autour de lui. Chaque cran relance le détourage : environ 1,5 s.",
    origine: "toi · défaut 28",
    long:
      "C'est pour ce réglage que le curseur du produit envoie ce qu'on a lâché et non ce qu'on a traversé. Mesuré au navigateur : un cran de tolérance coûte 1 492 ms au serveur, et un glissement sur vingt crans, c'était vingt appels sérialisés — une demi-minute de file pendant laquelle l'image défilait des valeurs que personne n'avait demandé à voir.\n\nLa valeur sous le curseur suit ta main tout de suite. Le rendu, lui, attend que tu lâches.",
  },

  "detourage.seuil_alpha": {
    nom: "seuil alpha",
    ou: "retouche",
    quoi: "Au-dessus de cette valeur un pixel appartient au sujet, en dessous il appartient au fond. 0 à 255.",
    change:
      "Tranche les contours à demi transparents. Sans ce durcissement, un rééchantillonnage au plus proche voisin les décide à pile ou face, et deux passes identiques rendent deux silhouettes différentes.",
    origine: "défaut du produit · 128",
    long:
      "C'est le réglage qui évite le liseré clair autour d'un sprite, et le piège est subtil : la quantification force l'alpha à 255 sans toucher à la couleur, donc un pixel de contour à peine visible ressort opaque, de la couleur du fond.\n\nD'où l'ordre fixe des étapes : le seuil se durcit avant la réduction sur grille, jamais après.",
  },

  "detourage.durcissement": {
    nom: "durcissement",
    ou: "retouche",
    quoi: "Combien de pixels sont rongés au bord de la silhouette après le seuil, de 0 à 4.",
    change:
      "Retire un liseré résiduel quand le seuil seul n'a pas suffi. Trop haut, il grignote les détails fins — une lame, une antenne, un doigt.",
    origine: "toi · défaut 0",
  },

  "etape.recadrage": {
    nom: "Recadrage",
    ou: "retouche",
    quoi: "La deuxième place : rogner l'image sur la boîte opaque du sujet.",
    change:
      "Ramène le sujet contre les bords de son image. Sans lui, l'occupation de l'étape suivante se mesurerait sur du vide, et deux sujets cadrés différemment ne sortiraient pas à la même échelle.",
    origine: "posé par l'univers quand le sujet a une silhouette",
  },

  "recadrage.marge": {
    nom: "marge",
    ou: "retouche",
    quoi: "Combien de pixels de l'image d'origine sont gardés autour de la boîte opaque du sujet.",
    change:
      "Élargit le recadrage. Sans marge, le sujet touche les quatre bords de son image recadrée — ce qui gêne les étapes suivantes et l'export.",
    origine: "toi · défaut 0",
  },

  "etape.grille": {
    nom: "Grille",
    ou: "retouche",
    quoi: "La troisième place : remettre le sujet sur la grille de pixel du projet.",
    change:
      "C'est l'étape qui rend le produit possible — elle met toutes tes images sur le même pixel. Posée systématiquement, jamais en option : une grille qui a dérivé est le cas normal, pas l'incident.",
    origine: "posée par l'univers, toujours",
  },

  "grille.cible": {
    nom: "taille de pixel",
    ou: "retouche",
    quoi: "Le côté de la case, en pixels logiques — la taille finale de ton sprite avant export.",
    change:
      "C'est l'étape qui rend le produit possible : elle remet toutes tes images sur le même pixel. Elle est demandée, jamais déduite de l'image reçue.",
    origine: "l'univers du projet, sinon toi · défaut 64",
    long:
      "Dix modèles sur douze font dériver la taille du pixel d'une étape à l'autre. Sans cette remise sur grille, les frames d'un même personnage ne partagent plus le même pixel, et un petit objet ressort plus grossier que le personnage qui le porte.\n\nDéduire la cible de l'image reçue reviendrait à laisser le fournisseur décider de l'échelle de ton jeu. C'est pour ça qu'elle se demande.",
  },

  "grille.occupation": {
    nom: "occupation",
    ou: "retouche",
    quoi: "La part de la case que le sujet remplit une fois mis à l'échelle, en pourcentage.",
    change:
      "C'est elle, et non la taille de l'image d'origine, qui met un tonneau et un personnage à la même échelle de pixel.",
    origine: "le barème de l'univers via le sujet · défaut 100 %",
    long:
      "Le réglage le plus important du produit, et le moins évident. Deux images arrivent du fournisseur au même format ; si tu les remets simplement sur une grille de 64 px, le tonneau devient aussi grand que le personnage. L'occupation dit « ce tonneau remplit 45 % de sa case », et l'échelle redevient juste.\n\nC'est pour ça que le barème vit dans l'univers et se pose une fois : tu ne veux pas rejouer ce calcul à chaque génération.",
  },

  "grille.ancrage": {
    nom: "ancrage",
    ou: "retouche",
    quoi: "Où le sujet se pose dans sa case quand il ne la remplit pas dans les deux sens — en bas ou au centre.",
    change:
      "Décide de l'alignement entre deux frames du même personnage. En bas par défaut, parce qu'un personnage se tient debout sur le bord bas de sa case.",
    origine: "défaut du produit · bas",
    long:
      "Deux frames d'une même animation posées au centre flotteraient l'une par rapport à l'autre : le personnage semblerait monter et descendre entre deux images. Le bas est le bon défaut pour tout ce qui pose au sol.\n\nLe centre sert à ce qui n'a pas de sol — une icône, un objet d'inventaire, un effet.",
  },

  "etape.quantification": {
    nom: "Quantification",
    ou: "retouche",
    quoi: "La quatrième place : ramener l'image à un nombre fini de couleurs, celles de la palette du projet.",
    change:
      "Donne au rendu sa cohérence de palette. Elle vient après la grille et jamais avant : quantifier 1024 px pour les jeter ensuite coûte cent fois plus pour le même résultat.",
    origine: "posée par l'univers quand il a une palette",
    long:
      "Elle est déterministe, et c'est un critère du produit : une recette nommée, réappliquée ailleurs, donne exactement le même résultat. La coupe médiane de Pillow ne tire rien au sort ; une initialisation tirée au hasard — un k-means++, par exemple — rendrait deux images différentes pour la même recette.\n\nElle force l'alpha à 255 sans toucher à la couleur. C'est la seconde moitié du piège du liseré : un pixel de contour à peine visible qui a survécu au seuil ressort opaque, de la couleur du fond. Le seuil alpha se durcit avant, jamais après.",
  },

  "quantification.palette": {
    nom: "palette",
    ou: "retouche",
    quoi: "Les couleurs auxquelles l'image sera ramenée — celles de l'univers du projet, montrées ici en lecture seule.",
    change:
      "Rien à régler ici. La palette se déduit par calcul des artworks officiels, dans l'écran Univers ; la poser à la main ferait deux vérités sur la même chose.",
    origine: "l'univers du projet · absente s'il n'a aucun artwork officiel",
  },

  "quantification.couleurs": {
    nom: "couleurs",
    ou: "retouche",
    quoi: "Sur combien de couleurs l'image est ramenée.",
    change:
      "Donne au rendu sa cohérence de palette. Cette étape s'applique après la réduction sur grille, jamais avant — quantifier 1024 px pour les jeter ensuite coûte cent fois plus pour le même résultat.",
    origine: "toi · défaut 32",
  },

  "etape.bords": {
    nom: "Nettoyage des bords",
    ou: "retouche",
    quoi: "La cinquième et dernière place : effacer les taches trop petites pour être le sujet.",
    change:
      "Ne se pose jamais tout seul, et c'est délibéré : c'est le seul geste du post-traitement qui puisse enlever quelque chose au sujet. Il reste à la fiche, là où on le voit agir.",
    origine: "toi seul · jamais posé par l'univers",
  },

  "bords.aire_min": {
    nom: "tache minimale",
    ou: "retouche",
    quoi: "En dessous de cette aire, en pixels, une tache opaque isolée est effacée.",
    change:
      "Retire les pixels isolés qu'une réduction au plus proche voisin laisse derrière elle. À 64 px de côté un pixel isolé se voit ; à 1024 il ne se voyait pas.",
    origine: "toi · défaut 3 px, et 0 n'efface rien",
    long:
      "Une tache est une zone opaque connexe, trouvée par le même remplissage par plages que la détection de la découpe — donc la même réponse sur la même image.\n\nMonter trop haut efface un détail détaché du corps : la pointe d'une lance, une étincelle, un éclat de magie. Le réglage est le dernier de la recette parce qu'il travaille sur ce que les quatre autres ont laissé, et pas sur l'image reçue.",
  },

  // ── La retouche — ce que la fiche fait d'un asset ─────────────────────────

  "fiche.recettes": {
    nom: "Recettes",
    ou: "retouche",
    quoi: "Les recettes que tu as nommées, à reposer sur cette image d'un clic.",
    change:
      "Applique les cinq places d'un coup, sans un appel payant. Une recette nommée réappliquée ailleurs donne exactement le même résultat — c'est un critère du produit, et rien dans le traitement ne tire au sort.",
    origine: "toi, en nommant · aucune au départ",
    long:
      "Une recette est nommée par son empreinte autant que par toi : deux recettes égales sont interchangeables, et c'est cette empreinte qui nomme le fichier de rendu sur le disque. Reposer une recette déjà appliquée ne recalcule donc rien.\n\nUne recette vide ne s'enregistre pas — elle n'aurait rien à rejouer.",
  },

  "fiche.reinjecter": {
    nom: "Réinjecter",
    ou: "retouche",
    quoi: "Renvoyer cette image dans le générateur, dans l'un de ses quatre rôles.",
    change:
      "Trois rôles envoient l'image — référence (elle inspire), source d'édition (elle engendre), guide de style (elle donne la manière). Le quatrième n'envoie rien : il reprend le prompt, le modèle et les réglages de la génération qui a produit cet asset.",
    origine: "toi · le contrat de génération nomme les rôles",
    long:
      "Réinjecter ne coûte rien tant que tu n'as pas cliqué Générer : le rôle se pose dans le panneau de l'atelier, et le bloc « Ce qui part » se met à jour pour le dire. Le compte de références y grimpe d'un cran, et il est plafonné par le modèle choisi.\n\nLe quatrième rôle est le seul qui touche au prompt. Il est là pour la reprise : refaire une image dont on a perdu les réglages est le geste qu'on fait le plus souvent après un tri.",
  },

  // ── Les réglages — le cadre de l'agent ────────────────────────────────────
  //
  // Trois entrées, et elles répondent toutes à la même question de fond : *que
  // se passe-t-il quand je ne regarde pas l'écran ?* L'agent n'attend jamais une
  // autorisation — c'est ce qui l'empêche de se figer, et c'est exactement ce
  // qui rend ces trois réglages nécessaires.

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
    quoi: "Le modèle imposé à l'agent, quel que soit celui qu'il demande.",
    change:
      "Toutes ses générations partent sur ce modèle et ces options. Éteint, l'agent choisit — et s'il ne choisit pas, c'est encore celui-ci qui sert : personne ne doit tomber sur le modèle le plus cher du catalogue par accident.",
    origine: "toi · défaut gpt-image-2 en quality low, actif",
    long:
      "Un agent qui code a besoin d'un visuel correct tout de suite, pas d'un asset final : rapport de six sur le coût du travail agentique, pour une perte de qualité qui ne compte pas à ce moment-là. La version de production se regénère depuis l'atelier, avec le modèle que tu veux.\n\nSi le catalogue ne déclare pas ce modèle — il a disparu, ou l'atelier tourne sur son catalogue de repli —, c'est le défaut du catalogue qui prend la main. Un garde-fou qui rendrait l'agent inutilisable te protégerait de la dépense en supprimant le produit.",
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
  // ── L'écran Découpe ───────────────────────────────────────────────────────
  //
  // **Deux gestes séparés exprès** : proposer ne crée rien, découper coupe ce
  // qu'on lui donne. C'est cette séparation, et rien d'autre, qui tient la
  // promesse « sans jamais bloquer » — et c'est ce que ces entrées doivent dire
  // avant de décrire un curseur.

  "decoupe.mode": {
    nom: "Détection",
    ou: "decoupe",
    quoi: "Comment les rectangles sont proposés : « auto » cherche les zones opaques, « grille » découpe en cases égales.",
    change:
      "Ne découpe rien — propose. Ce qui part à la découpe est la liste que tu vois à droite, corrections à la main comprises. Changer ce réglage relance la détection et remplace ce que tu as dessiné.",
    origine: "toi · défaut auto",
    long:
      "Le mode auto lit un alpha, donc il détoure d'abord : une planche telle qu'elle arrive du modèle est opaque de bord à bord, et sa seule zone connexe serait l'image entière. C'est la même règle que pour la palette — ce qui est majoritaire n'est pas ce qui compte.\n\nLa grille fixe n'est pas un repli de l'auto : elle répond à une planche d'une autre nature — des sprites qui se touchent, des cases vides à conserver — et c'est toi qui sais laquelle tu as.\n\nUne détection qui rend une seule boîte, ou aucune, est un résultat et pas une panne. Rien ici ne bloque : tu dessines les rectangles qui manquent, tu retires ceux qui sont en trop, et c'est ta liste qui part.",
  },

  "decoupe.taille_min": {
    nom: "taille minimale",
    ou: "decoupe",
    quoi: "En dessous de ce côté, en pixels, une zone opaque n'est pas un sprite.",
    change:
      "Monte-la pour ignorer les éclats de fond qui ont survécu au seuil ; descends-la pour rattraper un petit sprite oublié. Chaque cran relance la détection et remplace ce que tu avais dessiné.",
    origine: "toi · défaut 16 px",
    long:
      "Exprimé en côté et non en aire parce que c'est ce que l'œil voit sur l'image : « ignore ce qui fait moins de seize pixels ». La comparaison, elle, se fait sur l'aire — une lance de 4 × 200 pixels a un petit côté minuscule et reste un sujet.\n\nDeux morceaux séparés de moins de deux pixels sont réunis avant le rejet, jamais après : un arc détaché du corps qui le tient vaut 24 px une fois recollé, et les rejeter séparément les perdrait tous les deux.",
  },

  "decoupe.colonnes": {
    nom: "colonnes",
    ou: "decoupe",
    quoi: "Le nombre de colonnes égales dans lesquelles la planche est coupée.",
    change:
      "Avec les lignes, décide du nombre de découpes proposées : colonnes × lignes, cases vides comprises. Le reste de la division se répartit — rien n'est jeté au bord droit.",
    origine: "toi · défaut 4",
    long:
      "Une planche de 1000 px en 3 colonnes donne 334, 333 et 333, et la dernière case va bien jusqu'au dernier pixel. Une division qui laisse tomber deux pixels laisse tomber une colonne de sprite au bord droit, et ça ne se voit qu'après découpe.",
  },

  "decoupe.lignes": {
    nom: "lignes",
    ou: "decoupe",
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
 */
export const SANS_ENTREE: readonly string[] = [
  "les réglages qu'un modèle déclare en propre — le catalogue les nomme, et il change d'un jour à l'autre",
]

/** L'entrée d'un réglage, ou `undefined` — auquel cas rien ne se marque. */
export function explication(cle: string | undefined): Explication | undefined {
  return cle ? AIDE[cle] : undefined
}
