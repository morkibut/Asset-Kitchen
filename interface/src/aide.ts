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
  /** La zone de l'écran où le réglage se trouve, en toutes lettres : « le
   *  pinceau », « la palette », « ce qui part dans le prompt ». C'est ce qui
   *  casse les listes de soixante-treize fiches à la file : le volet met les
   *  fiches d'une même zone sous un même titre.
   *
   *  **Facultatif ici, obligatoire pour de vrai.** Les 229 fiches du dépôt ne
   *  l'ont pas encore — elles le reçoivent écran par écran, de `GU4` à `GU15`.
   *  Le rendre obligatoire au type aujourd'hui casserait la compilation sur
   *  toutes. C'est un essai (`GU3`) qui refuse une fiche sans `groupe`, et il
   *  est rouge jusqu'à ce que le dernier écran soit passé : c'est la mesure
   *  d'avancement du chantier, pas un oubli. */
  groupe?: string
  /** Où ça se règle, pour le volet du guide (`B7`). **Un lieu, pas un thème** :
   *  quand on cherche une explication, on se souvient d'où l'on était.
   *
   *  **Ce ne sont plus les neuf écrans de la V1** — ils ont disparu avec elle,
   *  et personne ne les rouvre plus. Ce sont, autant que possible, les genres
   *  mêmes de `Lieu` (`interface/src/lieux.ts`) : `codex`, `sujet`, `galerie`,
   *  `case`, `clip`, `bande`, `tables`, `depenses`, `tableau-de-bord`. Trois
   *  valeurs de plus, sans équivalent dans la pile parce qu'un **côté** de
   *  l'univers n'est pas un lieu où l'on empile — `inspiration` et
   *  `ambiances` : les deux côtés de l'écran univers, au même nom que
   *  `Univers.tsx` exporte déjà (`type Cote`). Et `equipement`, **qui a enfin
   *  le sien depuis `B19`** : la page d'une pièce (`Emplois.tsx`) et celle
   *  d'un emploi (`Emploi.tsx`) rendent cette valeur, et les **dix-sept**
   *  entrées des fabriques s'y ouvrent. Avant, aucun écran ne la rendait
   *  jamais : dix-sept explications écrites et joignables par rien. Le plan de
   *  la V4 en annonce dix-neuf ; le dépôt en porte dix-sept, et c'est le
   *  compte relevé.
   *
   *  ⚠️ **`jeu` et `reglages` ne sont pas la même chose**, et `GU7` a corrigé
   *  les deux d'un coup — elles nommaient l'une et l'autre autre chose que ce
   *  qu'elles servaient (`docs/releves/guide-2026-09-20.md` § *Le grand
   *  constat*) :
   *
   *  - `jeu` est l'onglet *Univers* des réglages (`Reglages.tsx`), c'est-à-dire
   *    `ReglesDuJeu.tsx` en mode reprise : le nom du jeu, son allure, sa vue,
   *    son monde, ses sons — ce qu'on pose une fois par projet et qui repart
   *    avec chaque demande. Ce n'était **jamais** un côté de l'univers : la
   *    valeur était injoignable jusqu'à `GU7`, parce que `coteUnivers` ne peut
   *    valoir que `"inspiration"` ou `"ambiances"`.
   *  - `reglages` est tout ce qui ne parle d'aucun jeu : l'installation de la
   *    machine (`Installation.tsx`) **et** les trois autres onglets des
   *    réglages — moteurs, agent, consommations. Les deux écrans montent les
   *    mêmes blocs, d'où une seule valeur pour les deux.
   *
   *  Les confondre ferait grossir le mauvais groupe de vingt et une entrées. */
  ou:
    | "tableau-de-bord"
    | "codex"
    | "sujet"
    | "galerie"
    | "case"
    | "clip"
    | "bande"
    | "montage"
    | "tables"
    | "depenses"
    | "inspiration"
    | "jeu"
    | "ambiances"
    | "reglages"
    | "equipement"
    | "sortie"
}

/**
 * Le résumé d'un écran — trois lignes en tête du volet, avant tout réglage.
 *
 * **Ce n'est pas une fiche**, et c'est pour ça que ça vit à part de `AIDE` :
 * une fiche décrit un réglage qu'on peut toucher, un résumé décrit la page.
 * Les mélanger aurait rendu `groupe` et `ou` vides de sens sur trente entrées
 * qui ne sont le réglage de rien.
 */
export type ResumeDecran = {
  /** À quoi sert cette page. Une phrase. */
  aQuoi: string
  /** Les trois gestes qu'on y fait, un par ligne. Des gestes, pas des
   *  concepts : « on y peint », pas « on y applique une recette ». */
  gestes: readonly string[]
}

/**
 * Un résumé par écran du guide.
 *
 * **Vide aujourd'hui, et c'est voulu** : les textes s'écrivent d'un coup en
 * `GU4`, par la même main, pour qu'ils se ressemblent. Le volet fonctionne
 * sans — un écran sans résumé ouvre directement sur ses réglages, comme
 * avant. Partiel au type, parce que le remplissage se fait écran par écran ;
 * c'est un essai (`GU3`) qui refuse un écran sans résumé, pas le compilateur.
 */
export const RESUMES: Partial<Record<Explication["ou"], ResumeDecran>> = {
  tables: {
    aQuoi:
      "On reprend ici une image déjà faite : huit tables la traversent dans l'ordre, du fond qu'on retire au pixel qu'on repeint à la main.",
    gestes: [
      "On ouvre une table, on pousse ses réglages, et l'image se refait à chaque cran.",
      "On bascule du brut au rendu pour juger ce qu'on vient de changer.",
      "On enregistre les retouches, ou on range la recette pour la reposer ailleurs.",
    ],
  },

  sujet: {
    aQuoi:
      "La page d'un sujet du jeu — un personnage, un coffre, un décor : qui il est, ce que le jeu lui réclame, et ce qui est déjà fait.",
    gestes: [
      "On écrit qui il est et ce qui l'habille ; ces textes repartent avec chaque image.",
      "On parcourt ses onglets pour voir ce qui existe déjà et ce qui manque encore.",
      "On fabrique ce qui manque, puis on range les images qui reviennent.",
    ],
  },

  jeu: {
    aQuoi:
      "Ce qu'on pose une fois pour tout le jeu — son nom, son allure, sa vue, son monde, ses sons — et qui repart avec chaque image demandée.",
    gestes: [
      "On clique l'étape qu'on veut reprendre : l'ordre est libre, et chacune se saute.",
      "On choisit le pixel ou le dessin, puis la taille que tout le jeu suivra.",
      "On déplie une ligne du monde et on la tape ; une ligne vide ne part pas.",
    ],
  },

  "tableau-de-bord": {
    aQuoi:
      "Le tableau de bord — l'écran d'accueil du jeu ouvert : ce qu'il contient par famille, ce qui manque, et ce qu'il a coûté.",
    gestes: [
      "On regarde ce que le jeu contient déjà, famille par famille, en un coup d'œil.",
      "On repère ce qui manque le plus, et on ouvre un sujet pour juger ce qui reste.",
      "On part demander une image, ou on va découper une feuille déjà arrivée.",
    ],
  },

  codex: {
    aQuoi:
      "Le codex — l'inventaire de tout ce que le jeu contient déjà, rangé par famille et par collection, prêt à s'y ouvrir.",
    gestes: [
      "On ouvre une famille ou une collection pour voir les sujets qu'elle range.",
      "On filtre les sujets incomplets ou sans description pour savoir où revenir.",
      "On ouvre un sujet pour le compléter, ou on en crée un nouveau sur-le-champ.",
    ],
  },

  galerie: {
    aQuoi:
      "La galerie — chaque résultat conservé dans le jeu, quel que soit son média : images, animations, vidéos, modèles 3D et sons.",
    gestes: [
      "On choisit un type de média, puis on cherche un résultat par son nom.",
      "On parcourt les vignettes, page après page, pour juger ce qui est arrivé.",
      "On ouvre un résultat pour l'écouter, le lire, ou préparer ce qui vient après.",
    ],
  },

  case: {
    aQuoi:
      "La fiche d'une image dans la galerie — son grand format, sa recette, sa provenance, et ce qu'on choisit d'en faire.",
    gestes: [
      "On regarde l'image en grand, sa recette et d'où elle vient avant de trancher.",
      "On lit le prompt entier et ce qu'elle a coûté pour juger si elle est bonne.",
      "On la marque favori, on la réinjecte dans un rôle, ou on la désigne sur sa pose.",
    ],
  },

  clip: {
    aQuoi:
      "Le clip — l'image de départ choisie, le mouvement demandé, le prix des modèles, puis ce que la fabrication a rendu.",
    gestes: [
      "On choisit l'image de départ et le mouvement que le clip doit suivre.",
      "On compare les modèles et leur prix, puis on commande ce clip.",
      "On retrouve le clip payé, ce qu'il porte, ce qu'il a coûté, et ses bandes.",
    ],
  },

  bande: {
    aQuoi:
      "L'atelier d'une animation — une bande déjà gardée dans le jeu, reprise et corrigée image par image, table après table.",
    gestes: [
      "On ouvre une image de la bande et on choisit la table à lui appliquer.",
      "On compare avec l'image précédente en transparence pour juger le déplacement.",
      "On enregistre la bande, ou on range le brouillon pour le reprendre plus tard.",
    ],
  },

  montage: {
    aQuoi:
      "Le montage — un clip déjà payé, taillé en plusieurs bandes d'animation choisies image par image, sans jamais dépenser.",
    gestes: [
      "On regarde ce que le modèle a rendu et la chaîne du jeu tourner à la même vitesse.",
      "On choisit les images à retenir, dans l'ordre où elles doivent se jouer.",
      "On nomme l'animation, on règle sa cadence et son sens, puis on la garde.",
    ],
  },

  depenses: {
    aQuoi:
      "Les dépenses — chaque appel payé au jeu, quel qu'il soit : ce qu'il a rendu, gardé, perdu ou refusé, sans jamais payer ici.",
    gestes: [
      "On filtre par jeu, par période, ou par ce qu'un appel a donné en retour.",
      "On ouvre un appel pour lire ce qui est parti et ce qui en est revenu.",
      "On repère ce qui a été payé pour rien, et on récupère un clip resté en attente.",
    ],
  },

  inspiration: {
    aQuoi:
      "Inspiration — la toile de ce jeu, où l'on classe, note et compose des images de référence pour bâtir tout son monde.",
    gestes: [
      "On colle ou on range des images sur la toile, en îlots qu'on nomme soi-même.",
      "On regarde ce qui sert déjà un personnage et ce qui dort sans emploi.",
      "On choisit un lot de cartes et on part le fabriquer, avec ou sans les notes.",
    ],
  },

  ambiances: {
    aQuoi:
      "Ambiances et couleurs — les palettes de couleurs de ce jeu, le fond qu'on pose, et les lots de style qu'on assemble.",
    gestes: [
      "On regarde la palette du jeu et celles qu'on a composées depuis des images.",
      "On choisit le fond et le nombre de couleurs demandées pour juger le résultat.",
      "On range des sources et des textes dans une ambiance, prête à resservir.",
    ],
  },

  reglages: {
    aQuoi:
      "Ce qui ne parle d'aucun jeu et vaut pour toute la machine : les moteurs et les méthodes, le cadre de l'agent, l'argent dépensé, l'installation.",
    gestes: [
      "On dépose une clé chez un fournisseur, ou on installe une méthode locale.",
      "On branche ComfyUI et le dossier où tout se range, une fois pour tous les jeux.",
      "On règle le cadre de délégation : ce que l'agent a le droit de faire et de payer.",
      "On ouvre les consommations pour juger ce que ce jeu a coûté.",
    ],
  },

  equipement: {
    aQuoi:
      "Une pièce d'équipement — chacun de ses emplois possibles sur un personnage, et les calques que chacun réclame encore.",
    gestes: [
      "On ouvre un emploi de la pièce : porté par quelqu'un, à part, ou en scène.",
      "On parcourt une rangée par pose pour juger quel calque manque encore.",
      "On règle l'emplacement, et si le calque se pose devant ou derrière le corps.",
    ],
  },

  sortie: {
    aQuoi:
      "Livrer au jeu — ce qui en sort vers Godot, où cela va, comment ça se range, et ce qui a changé depuis la dernière fois.",
    gestes: [
      "On choisit ce qui sort, où ça va, et comment ça se range sur le disque.",
      "On regarde l'arbre des fichiers pour juger ce qui est nouveau, remplacé ou inchangé.",
      "On livre les fichiers d'un clic, ou on referme sans avoir rien écrit.",
    ],
  },
}

export const AIDE: Record<string, Explication> = {
  // ── Livrer au jeu — les deux onglets de `Livraisons.tsx` ────────────────
  //
  // **Trois des cinq fiches nées ici ne parlaient pas de cet écran**
  // (`GU12`) : `bibliotheque.collections` décrit la colonne des familles et
  // des collections du codex, `atelier.navigation` la colonne de gauche de
  // l'atelier, `tuiles.terrains` les raccords d'une tuile — celle-là est
  // bien accrochée, mais dans `Tuiles.tsx`. Parties vers `codex` et
  // `galerie`, textes inchangés. Les deux qui restent décrivent l'onglet
  // *Livrer dans Godot*, et `livraison.image-fixe` y est accrochée
  // (`ImagesALivrer.tsx`).

  "livraison.image-fixe": {
    nom: "L’image fixe dans Godot",
    groupe: "Livrer dans Godot — 2 · Les versions à livrer",
    quoi: "Choisir une image déjà faite — objet, décor, portrait ou interface. Remplacer la même pose et direction garde l'adresse de la scène.",
    change: "Le mode monde crée un Sprite2D ; le mode interface un TextureRect. Le repère utilise les pixels du rendu exporté. La préparation fige les pixels, la recette et la provenance avant publication.",
    origine: "toi · version relue ; atelier · fichiers et révisions conservés",
    ou: "sortie",
  },

  "livraison-godot": {
    nom: "Les versions livrées dans Godot",
    groupe: "Livrer dans Godot — l'historique des livraisons",
    quoi: "Une livraison conserve les animations choisies et les fichiers relus avant l’écriture.",
    change: "Un nouveau favori ne remplace pas le jeu ; une nouvelle livraison remplace seulement les animations choisies, et signale en conflit un fichier que l'atelier n'a pas écrit lui-même.",
    origine: "Ta sélection et le dossier Godot explicitement associé au jeu.",
    ou: "sortie",
  },

  "fabrication.video-libre": {
    nom: "Une vidéo avant de choisir son asset",
    quoi: "Une image de départ est toujours envoyée au modèle vidéo. Vous pouvez l’importer, la choisir dans la bibliothèque ou la fabriquer avec un modèle d’image.",
    change: "Le clip rejoint la galerie. Le montage permet ensuite de choisir un personnage, son mouvement et sa direction, puis de garder les frames en animation. Reprendre conserve le travail envoyé et ses références.",
    origine: "toi · image, mouvement et méthode de fabrication",
    ou: "clip",
  },
  "workflow.version": {
    nom: "Une version de workflow local",
    quoi: "Un profil nomme un graphe ComfyUI, ses entrées, ses références et les réglages utilisables au quotidien.",
    change: "Modifier crée une nouvelle version. Une fabrication conserve le graphe et les images de sa propre version ; reprendre suit le numéro déjà envoyé sans recommander. Vérifier lit les prérequis, sans installer ni lancer de modèle.",
    origine: "toi · profil importé ; ComfyUI · prérequis observés",
    ou: "clip",
  },
  "fabrication.relecture": {
    nom: "La demande relue avant l’envoi",
    quoi: "Le texte composé, les références, le fournisseur, le modèle et ses réglages se relisent ensemble avant de lancer une fabrication.",
    change: "Modifier prépare une nouvelle version de la demande. Reprendre garde l’envoi précédent et son identifiant : un travail déjà accepté ne se paie pas une seconde fois.",
    origine: "toi · demande conservée avec ses résultats",
    ou: "clip",
  },
  "fabrication.file-locale": {
    nom: "Le suivi des calculs locaux",
    quoi: "La file ordonne les calculs de l’atelier et distingue un moteur disponible, occupé ou non vérifiable.",
    change: "Annuler retire une attente avant son envoi. Reprendre retrouve le travail conservé. Les durées sont mesurées ; un chargement inconnu n’est pas annoncé comme un modèle déjà prêt.",
    origine: "atelier · observation des moteurs et historique conservé sur cette machine",
    ou: "clip",
  },
  // ── Cibles de cet emploi — associer une image, lancer une fabrication ──────
  //
  // **Les dix-neuf autres fiches nées sous `ou: "equipement"` ne décrivent pas
  // cet écran** (`GU8`, `docs/PLAN-guide.md`) : dix-huit sont les deux
  // fabriques de la retouche — superposition, découpage — jamais montées par
  // `Emplois.tsx` / `Emploi.tsx` / `CalquesDeLEmploi.tsx`, et une décrit la
  // planche de poses de l'établi d'un sujet. Elles ont rejoint `ou: "tables"`
  // et `ou: "sujet"` plus bas dans ce fichier, à leur place d'origine. Il ne
  // reste donc que ces deux-là, vraiment posées sur cet écran : les deux
  // moitiés de « Cibles de cet emploi » (`CalquesDeLEmploi.tsx`) — la liste
  // qui associe une image à une cible, et le bouton qui bascule sur
  // « Couverture & fabrication ».

  "equipement.association-image": {
    nom: "Le rôle d'une image associée à une cible",
    ou: "equipement",
    groupe: "Cibles de cet emploi — associer une image",
    quoi: "Une image associée à une cible sert de référence, de personnage complet à extraire, ou de calque déjà transparent à vérifier.",
    change:
      "L'association conserve l'image en bibliothèque. Seul un calque vérifié sur son personnage et sa frame peut remplir la cible ; une référence ne la remplit pas.",
    origine: "toi · pièce commune, emploi du personnage et cible choisie",
  },

  "equipement.couverture-fabrication": {
    nom: "Les calques manquants d'un emploi",
    ou: "equipement",
    groupe: "Couverture & fabrication — les calques manquants",
    quoi: "Chaque cible désigne une image fixe ou une frame précise du personnage qui porte cet équipement.",
    change:
      "La relecture distingue les images attendues des appels nécessaires : plusieurs cibles peuvent partager une planche. Les références et les paramètres restent modifiables avant l'envoi. Un résultat équipé doit ensuite être extrait, ajusté et vérifié sur sa cible.",
    origine: "objectif du personnage · versions choisies et variantes déjà vérifiées",
  },
  "source3d.import": {
    nom: "Importer un rendu 3D",
    quoi: "Le rendu rejoint le personnage sous forme de frames transparentes, avec ses réglages, son modèle et les fichiers disponibles.",
    change: "Choisissez le mouvement, la direction et la cadence. L’import ne relance aucun calcul ; la copie reste retouchable après arrêt d’asset3d. Le modèle animé fourni par une ancienne version d’asset3d reflète ses corrections au moment de l’import, pas nécessairement celles du rendu historique.",
    origine: "rendu choisi dans le moteur externe · copie conservée dans ce jeu",
    ou: "clip",
  },
  "source3d.inspection": {
    nom: "Inspecter le modèle animé",
    quoi: "La vue 3D permet de tourner la caméra, de zoomer, de voir le squelette et de lire les animations intégrées au fichier.",
    change: "Les réglages de cette inspection changent seulement la vue. Le cadre englobe les poses de l’animation pour garder la silhouette entière pendant la lecture ; les frames déjà importées ne sont pas recalculées.",
    origine: "copie GLB locale · caméra de consultation",
    ou: "clip",
  },
  "source3d.corrections": {
    nom: "Corrections du squelette",
    quoi: "Choisissez un os proposé par le moteur, puis réglez sa vrille, sa flexion et son écart avec le curseur ou la valeur en degrés. Gauche et droite sont celles du personnage.",
    change: "Enregistrer actualise le GLB de contrôle avec Blender, sans génération IA. Les corrections s’appliquent aux prochains rendus ; les travaux conservés gardent leur copie. Le rendu refuse des corrections changées depuis sa relecture. Les réglages non enregistrés restent disponibles comme brouillon.",
    origine: "source 3D externe · os et bornes déclarés par le moteur",
    ou: "clip",
  },
  "source3d.camera": {
    nom: "Caméra et portion du rendu 3D",
    quoi: "Choisissez un angle du catalogue ou réglez l’azimut et la hauteur en degrés. La vue 3D peut transmettre son angle au prochain rendu. Une portion limite le mouvement à extraire ; une pose en garde une seule frame.",
    change: "L’angle, la portion et les corrections sont conservés avec le travail. Le zoom de consultation ne change pas le cadre exporté : toutes les frames gardent la même taille et un cadre commun, mesuré sur le mouvement entier.",
    origine: "toi · paramètres acceptés et relus par le moteur externe",
    ou: "clip",
  },
  "fabrications-etat": {
    nom: "État des fabrications",
    quoi: "Le journal réunit les demandes conservées et les appels encore en cours.",
    change: "Le filtre À reprendre montre les échecs et les interruptions. Une demande terminée ouvre ses résultats ; un clip ouvre son montage sans commander une nouvelle vidéo.",
    origine: "atelier · journal des appels",
    ou: "clip",
  },
  // ── Les règles du jeu — l'écran « Réglages », onglet Univers ──────────────
  //
  // **Ces fiches n'étaient joignables par rien jusqu'à `GU7`.** La valeur
  // `ou: "jeu"` ne pouvait être produite que par `coteUnivers` (`App.tsx`),
  // typé `Cote` — `"inspiration" | "ambiances"`, jamais `"jeu"`. Vingt-cinq
  // fiches écrites, zéro atteignable (`docs/releves/guide-2026-09-20.md`
  // § *Le grand constat*). `ecranDuGuide` route maintenant l'onglet *Univers*
  // des réglages ici, et les trois autres onglets vers `reglages`.
  //
  // **L'ordre est celui de l'écran** : les cinq étapes de `ReglesDuJeu.tsx`
  // — Son nom, Son allure, Sa vue, Son monde —, puis la liste en lecture seule
  // que le même écran rend sous elles (`ReglesDAilleurs`). L'étape « Ses sons »
  // n'a pas encore de fiche ; elle en recevra avec la réécriture de contenu.
  //
  // **Réécrites en `GU7` (2/2)**, contre l'écran réel plutôt que contre
  // l'ancien assistant en dix étapes retiré en `C2`. Six fiches portent encore
  // la clé `assistant.*` par habitude de nommage, pas par description : leur
  // texte parle du parcours actuel. `assistant.taille` est partie — doublon
  // d'`univers.cible_px`, pas un réglage disparu (`docs/releves/guide-2026-09-20.md`).
  // `bible.rendu` et `bible.vue` ne présentent plus « rendu » et « vue » comme
  // des champs qu'on tape : ils sont en lecture seule depuis `B14`, remplis par
  // « Son allure » et « Sa vue ». Vingt et une fiches, toutes rangées, toutes
  // joignables, toutes réécrites.

  // Son nom — le jeu et son dossier

  "assistant.nom": {
    nom: "Le nom du jeu",
    ou: "jeu",
    groupe: "Son nom — le jeu et son dossier",
    quoi: "Comment le jeu s'appelle — et le seul endroit qui le crée ou le renomme.",
    change:
      "À la création, taper un nom et continuer fait naître le projet. En reprise, ça le renomme. Le dossier, lui, ne bouge jamais après coup : un dossier qui change de nom sous ses fichiers est un déménagement.",
    origine: "toi · vide en création, le nom du jeu ouvert en reprise",
    long:
      "Le dossier se calcule une seule fois, à la création — accents enlevés, minuscules, tirets — et reste ensuite figé, même si le nom change encore : c'est la partie stable, la seule que cet écran ait à montrer avant que le jeu existe. Rien de ce parcours ne coûte quoi que ce soit ; la première dépense arrive à la première image demandée.",
  },

  // Son allure — le style, la taille, les couleurs

  "univers.style": {
    nom: "style graphique",
    ou: "jeu",
    groupe: "Son allure — le style, la taille, les couleurs",
    quoi: "Comment ton jeu est dessiné : en pixel art, avec des carrés de couleur visibles, ou en dessin, sans carrés apparents.",
    change:
      "C'est la question qui commande toutes les autres. Elle décide de ce que « la taille » veut dire, de ce qui part au modèle, et de ce que l'atelier fait de l'image au retour.",
    origine: "défaut du produit · en pixel art",
    long:
      "En pixel art, la taille *est* le dessin : 64 carrés et 128 carrés sont deux dessins différents, pas la même image agrandie. En dessin, la taille n'est qu'une finesse — le détail que le fichier garde, réductible sans bouillie. Changer de style ne rejoue aucune image déjà faite. Godot, lui, a besoin du filtre de texture qui en dépend : « Nearest » en pixel art, « Linear » en dessin.",
  },

  "univers.cible_px": {
    nom: "Taille de pixel",
    ou: "jeu",
    groupe: "Son allure — le style, la taille, les couleurs",
    quoi: "Le côté de case, en pixels, imposé à tout ce qui entre dans ce projet — ou aucune, et le rendu du modèle entre tel quel.",
    change:
      "Toute image née ici arrive déjà remise sur cette grille. Sur « aucune », il n'y a pas de remise sur grille du tout : le détourage, le recadrage et la palette continuent, l'occupation du barème cesse d'agir. Les assets déjà là ne bougent pas tout seuls — « Tout réaligner » est un geste, jamais un effet de bord.",
    origine: "toi, une fois par projet · défaut 64",
    long:
      "« Aucune » dit que ton jeu n'est pas en pixel art — le rendu du modèle entre tel quel, sans grille imposée. Avec une cible, elle est toujours imposée, jamais déduite : dix modèles sur douze font dériver la taille du pixel d'une génération à l'autre, de 7 à 20 px dans un même lot. Réaligner ne coûte rien — aucun appel payant — et saute les assets déjà ramenés au brut.",
  },

  // **Deux entrées relogées ici par `GU9`** (`docs/releves/guide-2026-09-20.md`) :
  // `univers.couleurs` et `univers.fond` vivaient sous `ou: "ambiances"`, un
  // héritage du modèle d'avant `C2`. Le code, lui, les règle ici depuis
  // longtemps — `ReglesDuJeu.tsx` le dit dans son propre tableau de migration,
  // « 7a » et « 7b » — et l'écran Ambiances et couleurs n'en montre plus
  // aucune trace.

  "univers.couleurs": {
    nom: "Couleurs demandées",
    ou: "jeu",
    groupe: "Son allure — le style, la taille, les couleurs",
    quoi: "Combien de couleurs ton jeu garde — lues dans ta palette, ou gardées sur chaque image sans palette. Ne paraît qu'en pixel art.",
    change:
      "Avec une palette : elle en relance le calcul sur les mêmes artworks, sans un appel payant, et ça change le rendu de tout ce qui se quantifie ensuite. Sans palette : elle règle directement combien de teintes chaque image garde à sa sortie.",
    origine: "toi · défaut 32",
    long:
      "Elle sert deux fois, et c'est voulu : avant `D2` elle ne servait que la première — un projet sans artwork ne réduisait aucune couleur, en silence. Le plafond dépend de la taille de case : une petite image ne porte pas assez de teintes distinctes pour remplir une liste longue, et l'écran le dit plutôt que de laisser une liste courte se lire comme une panne.",
  },

  "univers.fond": {
    nom: "Le fond du jeu",
    ou: "jeu",
    groupe: "Son allure — le style, la taille, les couleurs",
    quoi: "La couleur sur laquelle poser le sujet, avec une phrase qui interdit au modèle de l'employer sur le sujet lui-même.",
    change:
      "Ce que le modèle rend derrière le sujet, et donc ce que le découpage aura à retirer. Une couleur que rien dans ton jeu ne contient rend le découpage presque parfait ; sans fond posé, le modèle rend un gris clair — la couleur d'une joue aussi — et le découpage la mange avec le fond.",
    origine: "toi · aucun fond au départ, et l'atelier en propose un sans jamais l'imposer",
    long:
      "⚠️ Changer le fond change ce qui part au fournisseur : les images tirées avant ne se comparent plus à celles d'après — pas moins bonnes, juste plus demandées de la même façon. L'atelier propose sans jamais imposer, et se corrige encore juste avant de payer, sur l'écran de confirmation, sans que ce choix ne remonte au jeu.",
  },

  // Sa vue — d'où l'on regarde le jeu

  "assistant.vue": {
    nom: "La vue du jeu",
    ou: "jeu",
    groupe: "Sa vue — d'où l'on regarde le jeu",
    quoi: "D'où l'on regarde le monde — de face, de côté, de dessus, en isométrie.",
    change:
      "**La liste des directions de ton jeu**, et la phrase de style qui part au modèle. C'est cette liste qui multiplie toute la production, donc tout ce qu'on paiera : un personnage qui marche vu de côté se dessine deux fois ; le même vu de dessus, quatre.",
    origine: "toi · aucune au départ",
    long:
      "Ce choix remplit deux endroits d'un coup : la liste des directions du codex, et la phrase de caméra qui part au modèle — les deux viennent du même geste, et ne peuvent plus se contredire. La liste est une proposition, jamais une contrainte : on la modifie depuis le codex, et un clic la rend à ce que la vue propose tant qu'on n'y a pas touché.",
  },

  // Son monde — les sept lignes de la bible

  "univers.bible": {
    nom: "Bible",
    ou: "jeu",
    groupe: "Son monde — les sept lignes de la bible",
    quoi: "Sept champs nommés qui disent ce qu'est ton jeu : monde, époque, rendu, trait, éclairage, vue, contraintes techniques.",
    change:
      "Chaque champ actif et non vide part en tête du prompt, à chaque génération, sans que tu le retapes. Un champ éteint ne part pas : l'interrupteur est le doseur. L'écran de confirmation, qui s'ouvre entre le bouton et la dépense, montre le résultat exact — une ligne par champ, avec son interrupteur.",
    origine: "toi, une fois par projet · sept champs vides au départ",
    long:
      "Des champs nommés plutôt qu'un texte libre : un texte libre est ce qu'on retape, un champ nommé est ce qu'on dose — on relâche le trait sans relâcher le monde, sans rien réécrire. La liste est close et dans l'ordre de l'écran comme du prompt. Les intitulés partent en anglais parce que les modèles du catalogue sont entraînés dessus ; ton texte, lui, part tel quel.",
  },

  "bible.monde": {
    nom: "monde",
    ou: "jeu",
    groupe: "Son monde — les sept lignes de la bible",
    quoi: "Où ça se passe et de quoi c'est fait — le lieu, la matière, l'ambiance.",
    change:
      "Part sous « World: » en tête du prompt, à chaque génération. C'est le champ qui tient la cohérence entre deux images faites à trois semaines d'écart.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.epoque": {
    nom: "époque",
    ou: "jeu",
    groupe: "Son monde — les sept lignes de la bible",
    quoi: "Le moment technologique du jeu — ce qui existe déjà, et ce qui n'existe pas encore.",
    change:
      "Part sous « Era: ». C'est ce qui empêche une arbalète de ressortir avec une lunette de visée — elle ne choisit rien à ta place : ce sont tes descriptions qui décident des armes, des vêtements et des outils. **Ce que cette case-là change dans l'image n'a pas été mesuré** — aucun banc ne l'a isolée, et il n'y en aura pas : deux mots dans un prompt ne valent pas huit tirages payés par branche.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.trait": {
    nom: "trait",
    ou: "jeu",
    groupe: "Son monde — les sept lignes de la bible",
    quoi: "Comment c'est dessiné : le contour, les aplats, les ombres.",
    change:
      "Part sous « Line and shading: ». C'est le champ le plus proche du rendu, donc le premier à relâcher quand tout se ressemble trop.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.eclairage": {
    nom: "éclairage",
    ou: "jeu",
    groupe: "Son monde — les sept lignes de la bible",
    quoi: "D'où vient la lumière, et ce qu'elle laisse comme ombres.",
    change:
      "Part sous « Lighting: ». Deux sprites éclairés de deux côtés différents ne se montent pas dans la même scène.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.technique": {
    nom: "contraintes techniques",
    ou: "jeu",
    groupe: "Son monde — les sept lignes de la bible",
    quoi: "Ce que l'image doit être, indépendamment de ce qu'elle montre — fond uni, une seule pose, aucun cadre.",
    change:
      "Part sous « Technical constraints: ». C'est le champ qui évite les pièges mesurés des modèles, et il agit en amont de tout le post-traitement.",
    origine: "toi · vide, donc ne part pas",
    long:
      "Deux phrases y valent leur place, mesurées au banc d'essai. « One single sprite, one pose only » évite que Gemini rende une planche de trois poses en calquant son image de référence. Une consigne de fond uni, ensuite : le détourage par défaut échoue à 100 % sur un fond chargé, et réussit sans réseau sur un fond plat — ce champ garde le geste courant gratuit.",
  },

  // Son monde — les deux lignes que l'atelier écrit

  "bible.rendu": {
    nom: "technique de rendu",
    ou: "jeu",
    groupe: "Son monde — les deux lignes que l'atelier écrit",
    quoi: "Avec quoi l'image est censée être faite — pixel art, peinture numérique, trait encré, rendu 3D.",
    change:
      "Cette ligne ne se tape plus : elle s'écrit d'elle-même depuis l'étape « Son allure », déduite du style et de la taille de case. Un clic sur la ligne y renvoie directement — la taper ici referait deux consignes dans le même envoi.",
    origine: "l'atelier · déduite du style et de la taille de case",
    long:
      "Avant, on pouvait taper ici une technique de rendu qui contredisait le style choisi à l'étape d'avant, et les deux partaient ensemble dans le même envoi. La ligne est donc devenue une lecture, jamais une saisie. Ce qui avait été tapé avant ce changement ne part plus, mais reste montré barré sous la ligne — rien n'est effacé en silence.",
  },

  "bible.vue": {
    nom: "vue et cadrage",
    ou: "jeu",
    groupe: "Son monde — les deux lignes que l'atelier écrit",
    quoi: "D'où on regarde le sujet et jusqu'où on le voit — trois quarts, de face, de profil, plan large, corps entier.",
    change:
      "Cette ligne ne se tape plus : elle reprend mot pour mot le texte de caméra choisi à l'étape « Sa vue ». Un clic sur la ligne y renvoie directement — la taper ici referait deux consignes dans le même envoi.",
    origine: "l'atelier · reprise de l'étape « Sa vue »",
    long:
      "Avant, on pouvait écrire ici une caméra différente de la vue choisie à l'étape « Sa vue », et les deux partaient dans le même envoi. La ligne est donc devenue une lecture, jamais une saisie. Ce qui avait été tapé avant ce changement ne part plus, mais reste montré barré sous la ligne — rien n'est effacé en silence.",
  },

  // Son monde — les étiquettes d'une ligne

  "assistant.etiquettes": {
    nom: "Les étiquettes",
    ou: "jeu",
    groupe: "Son monde — les étiquettes d'une ligne",
    quoi: "Une paire : un libellé qu'on clique, et le texte anglais qui part vraiment au modèle.",
    change:
      "Cliquer une étiquette ajoute son texte anglais dans la case ouverte. Rien d'autre : ce qui part reste ce qui est écrit, pas la liste des étiquettes cliquées — tu peux tout écrire à la main sans en cliquer aucune.",
    origine: "l'atelier · soixante-dix livrées, rangées par case",
    long:
      "La base n'est pas vide : soixante-dix étiquettes sont livrées avec l'atelier, réparties sur les cinq cases qu'on tape (monde, époque, trait, éclairage, contraintes techniques), et elles sont les mêmes pour tous tes jeux. Une case n'affiche que les siennes — une étiquette d'éclairage n'a rien à faire dans la case du trait.",
  },

  // S'applique à tout le jeu, mais se règle ailleurs

  "univers.bareme": {
    nom: "Barème d'échelles",
    ou: "jeu",
    groupe: "S'applique à tout le jeu, mais se règle ailleurs",
    quoi: "La liste des natures de sujet de ton jeu — personnage, meuble, objet tenu, décor — et ce que chacune vaut.",
    change:
      "C'est lui qui remplit le contrôle Sujet de l'atelier. Une échelle porte trois choses à la fois : sa famille, sa hauteur, et si le sujet se détoure. Cette ligne se lit ici, en compte ; chaque échelle se pose dans les réglages de la famille qu'elle concerne, pas sur cet écran.",
    origine: "sept échelles au départ · mesurées le 27/08 sur sept sujets réels",
    long:
      "Sans barème, tout sort à la même hauteur : la case pleine à 100 % remplit tout, un coffre comme une prêtresse. La hauteur se compte en personnages et peut les dépasser — 300 % fait un bâtiment de trois. Trois choses dans un seul objet (famille, hauteur, silhouette) : deux taxonomies séparées coûteraient double à chaque génération. Les sept échelles de départ ne sont pas une table de vérité.",
  },

  "bareme.famille": {
    nom: "famille d'une échelle",
    ou: "jeu",
    groupe: "S'applique à tout le jeu, mais se règle ailleurs",
    quoi: "La catégorie d'artworks qu'un sujet de cette nature ira chercher en référence.",
    change:
      "Choisir « objet tenu » à la génération envoie les artworks de la famille objets, plus ceux marqués « tous ». Le nombre de références change le coût. Cette ligne se lit ici ; elle se choisit dans les réglages de la famille, pas sur cet écran.",
    origine: "toi · la famille d'origine de l'échelle",
    long:
      "C'est le même mécanisme que la famille d'une carte, pris par l'autre bout : la carte dit à quelle famille un artwork appartient, l'échelle dit quelle famille un sujet va chercher. Les deux se rencontrent au moment de générer, et rien d'autre ne décide de ce qui part.",
  },

  "bareme.occupation": {
    nom: "occupation d'une échelle",
    ou: "jeu",
    groupe: "S'applique à tout le jeu, mais se règle ailleurs",
    quoi: "La part du côté de la case qu'un sujet de cette nature remplit une fois sur grille, en pourcentage.",
    change:
      "C'est la valeur que la recette reprendra à la naissance de l'asset — 100 % pour un personnage, 40 % pour un objet tenu en main. Cette ligne se lit ici ; elle se règle dans les réglages de la famille, avec les deux autres traits de la même échelle.",
    origine: "toi · mesuré le 27/08 sur sept sujets réels",
    long:
      "Deux images arrivent du fournisseur au même format ; sans occupation, un tonneau remis sur grille deviendrait aussi grand qu'un personnage. Elle se pose une fois pour le projet, pas génération par génération. La fiche d'un asset la porte aussi, pour les cas particuliers — mais y toucher l'épingle, qui cesse alors de suivre l'univers.",
  },

  "bareme.silhouette": {
    nom: "se détoure / plein cadre",
    ou: "jeu",
    groupe: "S'applique à tout le jeu, mais se règle ailleurs",
    quoi: "Si un sujet de cette nature a un contour, ou s'il occupe tout le cadre.",
    change:
      "« Plein cadre » retire le détourage et le recadrage de la recette posée à la naissance. C'est le réglage du décor : l'enfermer dans une case carrée lui ajouterait des bandes transparentes que personne n'a demandées. Cette ligne se lit ici ; elle se pose dans les réglages de la famille, avec la hauteur et la famille d'artworks de la même échelle.",
    origine: "toi · se détoure, sauf « décor »",
    long:
      "Le détourage suit la nature du sujet, pas un réglage de plus. Ne pas poser de passe suffit à dire « décor » : la remise sur grille lit déjà cette distinction — avoir demandé un détourage, c'est avoir dit que ce qu'on traite a une silhouette.\n\nLa remise sur grille, elle, reste de la partie dans les deux cas. Un décor aussi doit tomber sur le pixel du projet.",
  },

  "univers.modeles": {
    nom: "Modèle par famille",
    ou: "jeu",
    groupe: "S'applique à tout le jeu, mais se règle ailleurs",
    quoi: "Le moteur d'image proposé par défaut selon la famille du sujet — pas un réglage global.",
    change:
      "Choisir un sujet à l'atelier propose le modèle de sa famille. Une famille sans modèle retombe sur le défaut du catalogue ; ce n'est pas un trou, c'est un réglage qu'on n'a pas posé. Cette ligne se lit ici, en compte ; le modèle de chaque famille se choisit dans ses réglages, pas sur cet écran.",
    origine: "toi · aucun, donc le catalogue décide",
  },

  "univers.detourage": {
    nom: "Le détourage de départ",
    ou: "jeu",
    groupe: "S'applique à tout le jeu, mais se règle ailleurs",
    quoi: "Comment l'atelier retire le fond d'une image qui revient, avant que tu y touches.",
    change:
      "Rien ne part au modèle et rien ne coûte : c'est un traitement fait sur ta machine, au retour. Une ligne laissée vide n'est pas un trou — le produit décide à ta place. Cette ligne se lit ici, en résumé (« par nature et par famille ») ; il n'y a pas de formulaire pour la poser directement — elle se règle en marchant, depuis la table Détourage d'une image, avec le bouton « enregistrer ce réglage comme défaut du jeu ». Et changer un réglage ainsi ne retouche aucune image déjà faite.",
    origine: "toi · aucun, donc le produit décide",
    long:
      "Trois niveaux décident, dans cet ordre : la famille du sujet, puis la façon dont l'image est venue, puis le produit. Une famille réglée l'emporte sur sa nature. La fiche de chaque image dit ensuite lequel des trois a décidé. La tolérance et le seuil de transparence ne sont pas ici : ils se règlent sur une image, dans sa table de détourage.",
  },

  "assistant.poses": {
    nom: "Les poses et les états",
    ou: "jeu",
    groupe: "S'applique à tout le jeu, mais se règle ailleurs",
    quoi: "Ce que chaque chose du jeu peut faire — au repos, en marche, ouverte, vidée.",
    change:
      "Chaque pose du plan devient une case à remplir sur la fiche du sujet. **Le plan lui-même — quelles poses existent pour cette nature — se règle dans les réglages de la famille** : un personnage a ses six attitudes, un meuble ses trois états, une tuile aucune. Cette ligne n'en montre qu'un résumé. **Le nombre d'images d'une pose vient du choix de vue**, pas d'une saisie : il ne se retape plus.",
    origine: "toi, ou l'atelier · une liste proposée par type",
  },

  "assistant.emplacements": {
    nom: "Les emplacements d'équipement",
    ou: "jeu",
    groupe: "S'applique à tout le jeu, mais se règle ailleurs",
    quoi: "Les endroits d'un corps où l'on peut accrocher une pièce — la tête, le dos, la main.",
    change:
      "**L'ordre compte** : il décide de quelle pièce se dessine par-dessus l'autre. Cette ligne se lit ici, en résumé ; la liste elle-même se règle dans les réglages de la famille personnages — la seule à porter de l'équipement.",
    origine: "toi · vide au départ",
  },

  // ── Ce qui part avec chaque animation (GU10) ──────────────────────────────
  //
  // Six fiches déplacées depuis `ou: "reglages"` : `BlocDirectionsAnimees`,
  // `BlocMouvements` et `BlocStyles` (`Mouvements.tsx`) sont passées le
  // 18 septembre 2026 dans l'onglet Univers de `Reglages.tsx`
  // (`ReglesDuJeu.tsx`, sous la liste des quatre étapes) — elles étaient
  // rangées dans l'onglet Agent MCP faute de place, et le commentaire de
  // `Reglages.tsx` le dit lui-même. Textes inchangés, sauf `style.texte`
  // (`quoi` dépassait 140 signes).

  "mouvement.nom": {
    nom: "Nom du mouvement",
    ou: "jeu",
    groupe: "Ce qui part avec chaque animation",
    quoi: "Le nom français du mouvement — ce que tu lis, et jamais ce qui part au modèle.",
    change:
      "Rien à la génération : le nom ne quitte pas l'atelier. Mais **le repère qu'il produit accroche le mouvement à la case du plan** : un mouvement nommé « marche » anime la pose « marche » sans que tu relies quoi que ce soit. Renommer un mouvement déjà nommé ne défait pas ce lien — le repère, lui, ne bouge plus.",
    origine: "toi · sept mouvements arrivent avec l'atelier",
    long: "Le repère se dérive du nom au moment où tu le nommes, et pas après : « vol plané » donne `vol-plane`. C'est ce repère-là qui doit correspondre à l'identifiant d'une pose pour que la case en hérite.\n\nUn mouvement livré renommé reste livré : c'est son origine, pas son état. Le fichier l'emporte alors sur le catalogue, et ton nom survit à la mise à jour suivante.",
  },
  "mouvement.texte": {
    nom: "Ce qui part au modèle",
    ou: "jeu",
    groupe: "Ce qui part avec chaque animation",
    quoi: "Le texte anglais envoyé pour obtenir le clip. C'est la moitié qui agit.",
    change:
      "Tout. C'est ce texte-là qui décide de ce que le modèle anime, et **deux clips du même mouvement partent avec exactement le même** : ce qui varie d'un tirage à l'autre redevient le tirage, et non la frappe.",
    origine: "toi · les livrés arrivent écrits",
    long: "Un texte de mouvement dit un **cycle**, pas une posture : `walking posture, full body` est juste pour une image et faux pour un clip, où il faut dire que ça boucle et que le personnage n'avance pas dans le cadre, sans quoi il sort du champ. Changer ce texte ne touche à rien de ce qui est déjà parti.",
  },
  "mouvement.cadence": {
    nom: "Cadence",
    ou: "jeu",
    groupe: "Ce qui part avec chaque animation",
    quoi: "Les images par seconde de la bande qu'on tirera du clip.",
    change:
      "Elle règle la vitesse de l'aperçu **et** elle est écrite dans le fichier d'accompagnement à l'export. Un seul réglage pour les deux : séparés, ils finiraient par se contredire, et c'est toi qui paierais l'écart.",
    origine: "toi · 12 images par seconde à défaut",
    long: "Douze est le compromis du pixel art : au-dessous le pas saccade, au-dessus tu paies des images que l'œil ne distingue plus à cette taille. Les livrés s'en écartent quand le mouvement le demande — le repos à huit, la course à quatorze.",
  },
  "style.nom": {
    nom: "Nom du style",
    ou: "jeu",
    groupe: "Ce qui part avec chaque animation",
    quoi: "Le nom français du style — ce que tu lis, et jamais ce qui part au modèle.",
    change:
      "Rien à la génération : le nom ne quitte pas l'atelier. **Le repère qu'il produit accroche le style au personnage ou à la pièce qui le déclare** ; renommer un style déjà nommé ne défait pas ce lien.",
    origine: "toi · dix styles arrivent avec l'atelier",
  },
  "style.tient": {
    nom: "Ce qu'il tient en main",
    ou: "jeu",
    groupe: "Ce qui part avec chaque animation",
    quoi: "Ce que le style tient en main, en anglais — vide veut dire mains nues.",
    change:
      "Rien à la génération : il sert à reconnaître le style dans la liste. Ce sont les textes des mouvements qui nomment l'arme au modèle.",
    origine: "toi · vide à défaut",
  },
  "style.texte": {
    nom: "Le texte d'un mouvement, pour ce style",
    ou: "jeu",
    groupe: "Ce qui part avec chaque animation",
    quoi: "Le texte anglais que ce style dit pour ce mouvement-là. Vide, c'est le texte du mouvement seul qui part à sa place.",
    change:
      "Pour un personnage qui a ce style, il part après la phrase de la direction, à la place du texte du mouvement.",
    origine: "toi · les livrés arrivent écrits pour l'attaque, certains pour le repos",
  },

  // ── L'univers, côté Inspiration — la toile, ses cartes, ses liens ─────────
  //
  // **Deux côtés réels, pas trois** (`Univers.tsx`, `export type Cote =
  // "inspiration" | "ambiances"`) : la toile n'est pas un troisième côté,
  // c'est un mode d'affichage à l'intérieur de celui-ci
  // (`vueUnivers === "toile"`). Les deux premières fiches ci-dessous sont
  // celles qui ont provoqué tout ce chantier : voisines dans le même menu,
  // l'une inerte et l'autre décisive, et rien à l'écran ne les distinguait.

  // La barre du tableau

  "tableau.vue": {
    nom: "Vue",
    ou: "inspiration",
    groupe: "La barre du tableau",
    quoi: "Les deux façons de regarder le tableau : la grille, tout d'un coup d'œil, ou la toile, où une carte se pose où tu veux et garde sa place.",
    change:
      "Rien à la génération. Mais tirer une carte dans un îlot écrit son groupe, et l'en sortir le vide : sur la toile, composer et classer sont le même geste.",
    origine: "toi · la grille au départ · rien ne s'enregistre",
    long:
      "La règle tient en une phrase : la toile montre ce qui est classé, la réserve contient ce qui reste à classer. Une carte posée sans être classée reste sur le plan nu, son pied dit « posée ». Double-cliquer sur le plan nu écrit une note à cet endroit précis ; le bouton **+ note** de la barre fait la même chose sans viser.",
  },

  // Le menu d'une carte

  "carte.groupe": {
    nom: "îlot",
    ou: "inspiration",
    groupe: "Le menu d'une carte",
    quoi: "Un nom libre pour ranger les cartes du tableau. Vide = hors îlot.",
    change:
      "Rien à la génération. C'est un rangement pour l'œil. Ce qui décide des références envoyées, c'est artwork officiel + famille.",
    origine: "toi · aucun défaut",
    long:
      "Un tableau monte vite à cent cartes, et l'îlot est ce qui te permet d'en retrouver douze. Il ne voyage nulle part : ni dans un prompt, ni dans une référence envoyée, ni dans un export. Le champ qui agit vraiment sur la génération, c'est famille — juste à côté, dans le même menu.",
  },

  "carte.note": {
    nom: "note",
    ou: "inspiration",
    groupe: "Le menu d'une carte",
    quoi: "Une annotation libre sur une carte — pourquoi tu l'as gardée, ce que tu veux en retenir.",
    change: "Rien à la génération. Elle ne part nulle part, comme le groupe.",
    origine: "toi · aucun défaut",
  },

  "carte.taille": {
    nom: "taille",
    ou: "inspiration",
    groupe: "Le menu d'une carte",
    quoi: "La place qu'une carte occupe dans le tableau : 1×, 2× ou 4×.",
    change:
      "Rien à la génération. Ce sont les crans du zoom de la grille d'assets, réemployés — un seul vocabulaire de taille dans tout le produit.",
    origine: "toi · défaut 1×",
    long:
      "C'est un cran, et il vaut des deux côtés du tableau : dans la grille il décide du nombre de colonnes que la carte occupe, sur la toile il donne sa largeur de départ. Élargir une carte sur la toile ne le change pas, et c'est voulu : la largeur libre est une place sur le plan, la taille un cran que lit la grille.",
  },

  // Une carte texte

  "note.texte": {
    nom: "texte d'une note",
    ou: "inspiration",
    groupe: "Une carte texte",
    quoi: "Ce qu'une carte texte dit — l'intention que tu as posée au milieu des images.",
    change:
      "Rien à la génération. Une note ne part nulle part : ce qui voyage en référence, ce sont des octets d'image, et la bible dit déjà ce qu'un texte aurait à dire.",
    origine: "toi · au collage, au double-clic sur la toile, ou par « + note »",
    long:
      "Sur la toile, un double-clic sur le plan nu ouvre un champ à l'endroit exact où tu as cliqué ; un champ quitté vide ne crée rien, et Échap l'abandonne. Le bouton **+ note** de la barre ouvre le même champ sans avoir à viser. Corrige-la ici plutôt que de la recoller : recoller lui ferait perdre sa place, sa teinte et ses liens.",
  },

  "note.teinte": {
    nom: "teinte d'une note",
    ou: "inspiration",
    groupe: "Une carte texte",
    quoi: "Une des dix couleurs sourdes, posée sur le fond d'une note.",
    change:
      "Rien à la génération, et rien au rangement non plus. C'est **le seul endroit du produit où une couleur ne veut rien dire** : elle est là parce que tu l'as choisie, jamais parce qu'un état la commande.",
    origine: "toi · sans teinte au départ",
    long:
      "La liste est fermée à dix, à la même clarté que les couleurs qui, elles, disent quelque chose — réussi, réglé à la main, raté. Aucune n'est un rouge, un vert franc ou un ambre : ce sont les arcs des sémantiques. Une carte image n'en porte aucune : colorier chaque carte referait un second rangement, invisible dans la grille et concurrent du groupe.",
  },

  // Une carte image

  "carte.concept": {
    nom: "Concept art de",
    ou: "inspiration",
    groupe: "Une carte image",
    quoi: "Les personnages qui se servent de cette carte comme référence.",
    change:
      "Elle part avec chaque génération de ce personnage-là, **quelle que soit la famille du sujet** — un artwork officiel se filtre par famille, un concept art a été désigné pour lui.",
    origine: "toi · les personnages viennent du projet",
    long:
      "Désigner ne déplace rien : la carte reste sur le tableau, ni promue ni copiée. Une carte peut servir à plusieurs personnages, d'où des bascules et non un choix unique. Le coin en haut à gauche dit qu'elle sert ; celui d'en haut à droite dit qu'elle est un artwork officiel. Elle peut porter les deux.",
  },

  "carte.officiel": {
    nom: "artwork officiel",
    ou: "inspiration",
    groupe: "Une carte image",
    quoi: "Promouvoir une carte : elle cesse d'être une inspiration et devient une référence envoyée toute seule.",
    change:
      "C'est l'interrupteur des références envoyées toutes seules : une carte non promue n'en devient jamais une, quoi qu'il y ait dans son groupe ou sa famille. Elle peut malgré tout partir si tu la désignes toi-même comme concept art — c'est alors ton geste, pas une règle du projet.",
    origine: "toi · non promu par défaut",
    long:
      "Promouvoir est un geste unique : tu poses officiel et famille une fois, et l'application choisit seule à chaque génération — le cadrage du produit écarte la sélection manuelle des artworks au moment de générer. Un texte ne peut pas être promu : ce qui part en référence, ce sont des octets d'image.",
  },

  "carte.famille": {
    nom: "famille",
    ou: "inspiration",
    groupe: "Une carte image",
    quoi: "La catégorie d'un artwork officiel : personnages, objets, décors, interface, ou « tous » pour une planche non figurative.",
    change:
      "Beaucoup. À la génération, seuls les artworks de la famille de ton sujet partent en référence, plus ceux marqués « tous ». Le nombre de références change le coût.",
    origine: "toi, en promouvant · défaut « tous »",
    long:
      "C'est ce qui empêche un artwork de contaminer un sujet qui n'a rien à voir avec lui. « Tous » est le cas utile pour une planche de matières ou de trait, qui accompagne toute génération sans transmettre de personnage. Le compte de références est plafonné par modèle, et chez certains fournisseurs le prix croît avec ce nombre.",
  },

  "carte.lecture": {
    nom: "ce que la palette y lit",
    ou: "inspiration",
    groupe: "Une carte image",
    quoi: "La part de cet artwork qui donne ses couleurs au jeu. Pour la voir en magenta, il faut ouvrir l'écran de découpe.",
    change:
      "Rien. C'est une mesure, elle ne règle rien : elle montre ce que l'application fait déjà de cette image.",
    origine: "mesuré sur l'image · rien n'est calculé tant que tu n'as pas cliqué",
    long:
      "L'application détoure le fond avant de lire les couleurs : un ciel, un mur uni derrière un personnage n'entrent pas dans la palette. Ce qui pollue vraiment, ce sont les voisins opaques — un titre d'interface, un second personnage dans le cadre. Rien de mis de côté n'est pas une panne : une matière sans fond donne l'image entière.",
  },

  "carte.decouper": {
    nom: "découper une carte",
    ou: "inspiration",
    groupe: "Une carte image",
    quoi: "Couper une carte en plusieurs, ou la recadrer — sans quitter le tableau.",
    change:
      "Chaque morceau devient une carte du même tableau, dans la réserve, non promue. Ce sont des cartes et jamais des images produites : elles n'ont ni recette ni rendu.",
    origine: "toi · l'originale reste, sauf si tu demandes le remplacement",
    long:
      "Une planche porte souvent plusieurs personnages sur un même fond : découper en fait autant de cartes, promues séparément. Le remplacement n'existe qu'avec un seul rectangle — c'est alors un recadrage, et l'originale s'en va avec sa place, son groupe, sa note et sa promotion. C'est le seul endroit du produit où découper efface quelque chose.",
  },

  "carte.source": {
    nom: "provenance",
    ou: "inspiration",
    groupe: "Une carte image",
    quoi: "L'adresse d'où vient la carte — collée, ou posée depuis un clip animé — gardée telle quelle.",
    change:
      "Rien à la génération. Elle sert à créditer et à retrouver : une image dont on a perdu la source est une image qu'on ne peut plus faire ni l'un ni l'autre.",
    origine: "le collage, ou le dépôt d'un clip sur la toile · vide si tu as collé des octets",
  },

  // Le menu d'un lien

  "lien.mot": {
    nom: "mot d'un lien",
    ou: "inspiration",
    groupe: "Le menu d'un lien",
    quoi: "Une étiquette courte posée au milieu d'un trait, pour dire *quel* rapport il montre.",
    change:
      "Rien à la génération. Un lien naît muet, et le reste tant que tu n'écris rien : un trait nu dit déjà « ceci a rapport avec cela », le cas courant.",
    origine: "toi · vide au tracé · 32 signes au plus",
    long:
      "Le défaut est muet, l'exception s'exprime : demander le mot à chaque tracé transformerait un geste gratuit en question. La borne de 32 signes tient parce que l'étiquette se pose entre deux objets parfois très proches ; au-delà, c'est une note qu'il faut poser sur la toile, pas un mot de lien. Le vider retire l'étiquette.",
  },

  "lien.pointe": {
    nom: "pointe",
    ou: "inspiration",
    groupe: "Le menu d'un lien",
    quoi: "La flèche au bout d'un trait, quand le sens du rapport compte.",
    change:
      "Rien à la génération. Elle ne change que ce que le trait montre : sans elle il dit « ces deux-là ont rapport », avec elle il dit « celui-ci va vers celui-là ».",
    origine: "toi · sans pointe au tracé",
    long:
      "Elle se pose à l'arrivée, celle sur laquelle tu as lâché : la pointe ne fait que rendre visible ce que le tracé a déjà décidé. Pas de troisième état — retourner un lien, c'est le couper et le retirer dans l'autre sens, deux gestes rares plutôt qu'un contrôle permanent.",
  },

  // Le menu d'un îlot

  "ilot.teinte": {
    nom: "teinte d'un îlot",
    ou: "inspiration",
    groupe: "Le menu d'un îlot",
    quoi: "La même palette de dix, posée sur le cadre, le bandeau et le fond d'un îlot.",
    change:
      "Rien à la génération, et rien au groupe. Un îlot teinté et un îlot nu contiennent exactement les mêmes cartes, et envoient exactement les mêmes références.",
    origine: "toi · sans teinte au départ · part avec le dernier membre",
    long:
      "Elle ne vit pas sur les cartes de l'îlot — six membres feraient six réponses pour un seul cadre — mais avec le projet, une entrée par nom de groupe. Corollaire de « un îlot *est* son groupe » : quand la dernière carte en sort, l'îlot cesse d'exister, et sa couleur s'en va avec lui, comme les liens qui y aboutissaient.",
  },

  // ── L'univers, côté Ambiances — les palettes, et les lots de style ────────
  //
  // **Deux entrées ont quitté ce bloc en `GU9`** : `univers.couleurs` et
  // `univers.fond` ne se règlent plus ici depuis `C2` — elles se règlent à
  // l'étape « Son allure » des règles du jeu (`ou: "jeu"`), où
  // `ReglesDuJeu.tsx` les a relogées. Il ne reste ici que ce que l'écran
  // Ambiances et couleurs montre vraiment : les ambiances, et les palettes.

  // Les ambiances

  "ambiance.lot": {
    nom: "Une ambiance",
    ou: "ambiances",
    groupe: "Les ambiances",
    quoi: "Un lot de style réutilisable : une palette, des images de référence, et trois textes. On la désigne sur une chose du jeu.",
    change:
      "Rien tant qu'on ne s'en sert pas. Au moment de fabriquer, on choisit ce qu'on lui prend — tout, les couleurs seules, ou tout sauf les images —, et ce choix ne vaut que pour cet appel-là.",
    origine: "toi · aucune ambiance au départ",
    long:
      "Les palettes sont les ingrédients, les ambiances les recettes. Ses trois textes remplacent ceux du jeu, champ par champ, et l'écran de confirmation le montre, la perdante barrée sous la gagnante. Éteindre une ligne d'ambiance rallume donc le texte du jeu d'elle-même. Ce qu'un appel a réellement pris est enregistré avec la génération.",
  },

  // Les palettes

  "univers.palette": {
    nom: "Une palette",
    ou: "ambiances",
    groupe: "Les palettes",
    quoi: "Une liste de couleurs qui porte un nom, tirée d'un paquet d'images. Ton jeu peut en avoir autant que tu veux.",
    change:
      "La quantification ramène chaque pixel sur la couleur la plus proche de la palette en cours. Partout ailleurs, une couleur hors palette se marque au lieu d'être refusée.",
    origine: "toi · aucune palette au départ, et un jeu sans palette ne quantifie rien",
    long:
      "Le jeu en a une par défaut, « du jeu » en tête de la liste : elle se lit par calcul sur les artworks officiels, jamais ne se saisit, et se recalcule seule dès qu'un artwork ou le nombre de couleurs change. Les autres se fabriquent ici, à côté : des recettes faites de sources, de deux dosages et de retouches — une couleur retirée reste montrée barrée, pour qu'on puisse défaire.",
  },

  // ── Le codex — l'inventaire du monde, et le seul endroit où l'on nomme ────
  //
  // **Un onglet entier sur trois, et le guide n'en disait pas un mot** — ni
  // visite, ni réglage. Écrit en E20.
  //
  // **Rangé sur l'écran réel en `GU12`** : `EcranFamille` (`Famille.tsx`),
  // que la porte *Les sujets* et la grille d'une famille montrent toutes
  // deux. Il reçoit `bibliotheque.collections` — sa colonne de gauche — et
  // `tuiles.terrains`, qui venaient l'une et l'autre de `ou: "sortie"` : les
  // écrans des tuiles héritent du codex faute d'un `ou` à eux, et c'est
  // `GU13` qui leur en donnera un.
  //
  // ⚠️ **`codex.vitrine` décrivait un écran supprimé** — `Vitrine.tsx` est
  // parti du dépôt le 16 septembre 2026. Ce qu'il en reste est ailleurs :
  // l'aperçu à la barre d'espace, partout, et `Comparer.tsx`, qui attend
  // son écran de guide en `GU15`. `GU12` (2/2) l'a retirée
  // (`docs/releves/guide-2026-09-20.md` § *Les fiches qui mentent, une par
  // une*).

  "bibliotheque.collections": {
    nom: "collections de sujets", ou: "codex",
    groupe: "La colonne des familles et des collections",
    quoi: "Des groupes nommés pour retrouver les personnages, objets, décors et interfaces du jeu.",
    change: "Choisissez une famille puis une collection dans les assets. La sélection se range dans une collection ou se glisse sur son nom ; retirer un sujet d’un groupe conserve ses images. La recherche et le tri interrogent toute la famille avant de charger les résultats.",
    origine: "toi · rangement conservé dans la bibliothèque",
  },

  "codex.nommer": {
    nom: "Écrire un nom",
    ou: "codex",
    groupe: "En haut de l'écran — nommer un sujet",
    quoi: "Le bouton « Ajouter un… », en haut de l'écran, ouvre un champ : Entrée crée le sujet dans la famille ouverte à gauche.",
    change:
      "Rien à la génération : on nomme, on ne paie pas. Cela suffit à faire exister le sujet, prêt à recevoir sa première image sans détour par un autre écran.",
    origine: "toi · vide tant qu'on n'a pas cliqué « Ajouter un… »",
  },

  "assets-recherche": {
    nom: "Rechercher dans les assets",
    groupe: "La barre d'outils — chercher, la vue, le filtre, le tri",
    quoi: "La recherche porte sur les noms et descriptions de toutes les familles du jeu.",
    change: "Le filtre est envoyé au serveur : les sujets non encore affichés sont recherchés eux aussi. La colonne de gauche retrouve les collections et leur rangement.",
    origine: "toi · bibliothèque du jeu",
    ou: "codex",
  },

  "codex.index": {
    nom: "Le codex",
    ou: "codex",
    groupe: "La grille des sujets — ce que chacun a, ce qui lui manque",
    quoi: "L'index de ce que ton monde contient, par famille — personnages, décors, objets, interface, équipement — et ce qui manque à chacun.",
    change:
      "Rien à la génération. C'est de là qu'on ouvre l'établi d'une chose, ou qu'on ouvre le guichet pour en commander plusieurs à la fois.",
    origine: "toi, au fur et à mesure · les cinq familles existent avant toute chose",
  },

  "tuiles.terrains": {
    nom: "terrains et raccords des tuiles", ou: "codex",
    groupe: "L'atelier des tuiles — ouvert depuis Les tuiles",
    quoi: "Le terrain au centre et sur les huit bords ou coins d’une tuile carrée.",
    change: "Les cases voisines de la carte doivent annoncer le même terrain sur leur raccord commun. Ces relations sont exportées dans le TileSet de Godot. Elles ne jugent pas la qualité visuelle des pixels : regardez aussi les répétitions et la transparence sur la carte.",
    origine: "toi · aucun terrain implicite",
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
    ou: "sujet",
    groupe: "La fiche du sujet",
    quoi: "Le texte qui redit à la machine de qui il s'agit, et qui repart avec chaque image qu'on demande de cette chose.",
    change:
      "Il part dans le texte de chaque génération de cette chose, avant le reste. Sans lui, l'appel ne dit pas de quoi il s'agit et la machine invente.",
    origine: "toi · vide au départ",
  },

  "codex.chose.style_combat": {
    nom: "Son style de combat",
    ou: "sujet",
    groupe: "La fiche du sujet",
    quoi: "Comment ce personnage se bat — à mains nues, au bâton, à l'arc.",
    change:
      "Pour un mouvement que le style décrit, son texte remplace celui du mouvement et passe devant celui d'une pièce portée. Sans style ni pièce, le texte du mouvement part seul.",
    origine: "toi, ou la pièce qu'il porte en calque, ou aucun",
  },

  "codex.chose.habillage": {
    nom: "Ce qui l'habille",
    ou: "sujet",
    groupe: "La fiche du sujet",
    quoi: "Les sept textes de style qui décrivent le monde autour du sujet — monde, époque, rendu, vue, trait, lumière, technique.",
    change:
      "Ils partent avec chaque image. Par défaut ils viennent du jeu ; en réécrire un ici ne vaut que pour cette chose, et le texte remplacé reste lisible en dessous, barré.",
    origine: "le jeu, ou l'ambiance choisie, ou toi",
  },

  "codex.chose.exemples": {
    nom: "Ses images d'exemple",
    ou: "sujet",
    groupe: "La fiche du sujet",
    quoi: "Les images qu'on joint à la demande pour montrer le style visé, et qui sont disponibles pour chaque image de cette chose.",
    change:
      "Rien tout seul. Ce qui part vraiment se coche juste avant de payer — mais une image qui n'est pas retenue ici n'y sera pas proposée.",
    origine: "le tableau d'inspiration, les images déjà faites, toi",
  },

  "codex.chose.poses": {
    nom: "Ce que le jeu réclame",
    ou: "sujet",
    groupe: "Cases et planches — sa matrice",
    quoi: "Les attitudes que cette chose doit avoir : repos, marche, course pour un personnage ; fermé, ouvert, vidé pour un coffre.",
    change:
      "Rien à la génération. C'est cette liste qui décide du nombre de cases à remplir, donc de ce que le tableau de droite compte.",
    origine: "le type d'objet · plus ce que cette chose s'est ajouté",
  },

  "codex.chose.faites": {
    nom: "Ce qui est fait",
    ou: "sujet",
    groupe: "Cases et planches — sa matrice",
    quoi: "Les images qui existent déjà pour cette chose, une par attitude remplie.",
    change:
      "Rien du tout, et c'est le point : on regarde, on ne modifie rien et on ne paie rien.",
    origine: "les images faites · le manque n'a pas de couleur, il est en cours",
  },

  "codex.chose.matrice": {
    nom: "Sa matrice",
    ou: "sujet",
    groupe: "Cases et planches — sa matrice",
    quoi: "Le tableau des attitudes de cette chose, avec ce qui les remplit, et il change pendant qu'on règle à gauche.",
    change:
      "Rien à la génération. Ranger une attitude retire sa ligne et son coût — le compte des rangées reste écrit à côté, pour qu'un tableau plein obtenu en rangeant ne passe pas pour un travail fini.",
    origine: "les images faites, comptées par le serveur",
  },

  // **Déplacée depuis `ou: "equipement"` en `GU8`** (`docs/PLAN-guide.md`) :
  // son propre texte le disait déjà — « les cases que tu coches dans
  // l'établi ou dans le codex » — et `EtabliDuSujet.tsx` confirme : « les
  // angles d'une planche de pose » (E13) ferment un appel sur plusieurs
  // directions d'une même pose d'*un personnage*, jamais sur une pièce
  // d'équipement. Groupée ici avec ses sœurs, vérifiée.
  "fabrique.planche": {
    nom: "La planche de poses",
    groupe: "Cases et planches — sa matrice",
    ou: "sujet",
    quoi: "Une feuille où le modèle dessine plusieurs attitudes du même personnage en un seul appel, redécoupée ensuite en images séparées.",
    change:
      "Elle divise le prix : une planche coûte le prix d'un appel quel que soit le nombre de cases qu'elle porte. Et elle achète quelque chose qu'aucun appel séparé ne garantit — les cases sortent à la même échelle et dans le même style, puisqu'elles ont été peintes ensemble.",
    origine: "les cases que tu coches dans l'établi ou dans le codex",
    long:
      "Le risque se dit avec : c'est **un jet unique**, que le modèle ne rend pas deux fois. Une planche ratée se repaie entière, et un compte de cases faux ne fait rien entrer du tout — la planche entière se relance au prix plein.\n\nLa feuille elle-même n'entre jamais en bibliothèque ; ses morceaux, oui, chacun filié vers elle.",
  },

  // **Déplacée sous `ou: "bande"` en GU6**, réécrite en GU11 : elle décrit
  // une image du ruban dans l'atelier d'une bande (`AtelierDeBande.tsx`), au
  // même titre que `bande.position`, `bande.remplacer` et `bande.pelure` —
  // les quatre forment la zone « la frame choisie » (`CorrectionDeLImage`).
  "codex.bande.image": {
    nom: "L'image choisie",
    ou: "bande",
    groupe: "La frame choisie — position, remplacer, pelure d'oignon",
    quoi: "Une image de l'animation, et ce qu'on lui a fait à elle seule : de combien elle a été poussée, et de quel clip elle vient.",
    change:
      "Cette image-là, et aucune autre. C'est toute la différence avec les réglages de gauche : ceux-là valent pour l'animation entière, celui-ci ne corrige qu'une pose qui tombe à côté.",
    origine: "prise dans le clip · poussée à la main",
    long:
      "Les flèches la déplacent d'un pixel du sprite, cinq avec Maj, ou on la glisse à la souris. Aux bords, elles cessent d'agir plutôt que de rogner l'image. La remplacer par une autre image du clip ne coûte rien : il porte déjà toutes ses images. L'image d'avant, en transparence dessous, permet de juger un déplacement au lieu de le deviner.",
  },

  // ── La barre qui paie — ce qu'on touche à chaque génération (GU6) ─────────
  //
  // **Pas « l'établi »** : ce mot-là est déjà pris par le tableau des cases
  // d'un sujet (`codex.chose.matrice`, `EtabliDuSujet.tsx`), un cran plus
  // haut à l'écran. Ce qui suit est la barre commune aux deux lieux d'où
  // l'argent part (`BarreQuiPaie.tsx`) — l'établi d'une chose, et le repos de
  // l'onglet Créer de l'univers.

  "reglages.modele": {
    nom: "modèle",
    ou: "sujet",
    groupe: "La barre qui paie",
    quoi: "Le moteur d'image qui fabriquera la génération, choisi dans une liste où plusieurs fournisseurs se mélangent.",
    change:
      "Le prix, le rendu, et deux plafonds : le nombre de références acceptées et le nombre de variations possibles. Un modèle qui ne peut pas honorer ta demande reste visible et grisé, avec sa raison — jamais remplacé en silence.",
    origine: "les catalogues · chaque ligne dit d'où vient sa fiche",
    long:
      "Un modèle se nomme par deux choses ensemble, qui le propose et son nom chez lui — deux fournisseurs peuvent proposer un modèle du même nom. Ce qui manque à un fournisseur (souvent une clé) grise ses modèles à lui seuls ; les autres restent choisissables. Le catalogue est relu au démarrage ou par le bouton Catalogue ; hors ligne, générer reste possible avec la dernière photo reçue.",
  },

  // **Déplacée depuis `ou: "reglages"` en `GU10`** : elle décrit
  // `PanneauReglages.tsx` (monté par `BarreQuiPaie.tsx`, ici) et le rappel de
  // `Envoi.tsx` à la confirmation — jamais un onglet des réglages.
  "reglages.consommation": {
    nom: "Ce qu'un appel consomme",
    ou: "sujet",
    groupe: "La barre qui paie",
    quoi: "Ce qu'un appel prend chez son fournisseur, dans son unité — dollars pour l'un, jetons pour l'autre. Aucun appel ne consomme « rien ».",
    change:
      "Rien à la génération : c'est ce qui s'enregistre après, et ce que l'écran annonce avant. Le chiffre affiché sur un modèle est la **médiane de ses derniers appels sur cette machine**, jamais un tarif lu quelque part.",
    origine: "la réponse du fournisseur, à chaque appel · rien à remplir",
    long:
      "Le mot **gratuit** veut dire *sans prix*, pas *sans limite* : un modèle gratuit prend quand même quelque chose chez qui le sert, écrit à côté — *gratuit · 1 jeton*. Ce qui reste chez un fournisseur se dit aux deux endroits où ça sert — le choix du modèle, la confirmation de l'appel —, avec d'où le chiffre vient : compté ici, ou relevé chez le fournisseur.",
  },

  "reglages.styles-locaux": {
    nom: "styles locaux",
    ou: "sujet",
    groupe: "La barre qui paie",
    quoi: "Les vingt-deux styles de sc-clone, sous la liste des modèles, rangés par moteur et repliés par défaut.",
    change:
      "Le choisir revient à choisir un modèle : le prix devient nul, le temps remplace le prix, et le genre de référence qu'il accepte — garder le même sujet, ou repeindre par-dessus une image — s'écrit sous son nom.",
    origine: "ComfyUI, relu par le bouton « vérifier » · rien ne se télécharge depuis l'atelier",
    long:
      "Les quatre moteurs sont Z-Image, FLUX.2 Klein, FLUX.1-dev et SDXL. Un style grisé manque un fichier : la ligne dit lequel, et « installer » suffit si ComfyUI l'a déjà. La carte graphique tourne gratuitement : le bouton porte un temps mesuré par famille, jamais un prix ; le premier tirage charge le modèle en mémoire, les suivants sont plus rapides.",
  },

  "reglages.proportions": {
    nom: "proportions",
    ou: "sujet",
    groupe: "La barre qui paie",
    quoi: "Le rapport largeur / hauteur de l'image demandée au fournisseur.",
    change:
      "La forme de ce qui revient, avant tout post-traitement. Les valeurs que le modèle choisi n'accepte pas sont grisées, jamais cachées.",
    origine: "le modèle choisi · défaut 1:1",
    long:
      "Toujours imposé, jamais laissé au défaut du fournisseur : sans lui, Gemini part en 16:9 et Seedream en 1:1. Deux essais cessent alors d'être comparables, et un sprite n'est plus cadrable.",
  },

  "reglages.variations": {
    nom: "variations",
    ou: "sujet",
    groupe: "La barre qui paie",
    quoi: "Combien d'images partent d'un seul clic — 1, 2 ou 4.",
    change:
      "Multiplie le prix à l'identique : 4 variations, ce sont 4 appels et 4 fois le coût. Ce ne sont pas 4 images différentes demandées, ce sont 4 tirages de la même demande.",
    origine: "toi · défaut 1",
    long:
      "Un lot d'attitudes fait l'inverse : quatre variations sont quatre appels de la même demande, quand neuf attitudes cochées ensemble ne sont qu'un seul appel pour neuf demandes différentes. Les deux ne se combinent pas. Si le nombre d'images revenues n'est pas celui demandé, rien n'entre et le lot se relance au prix plein — c'est le seul refus automatique du produit, et il est arithmétique.",
  },

  "reglages.sujet": {
    nom: "sujet",
    ou: "sujet",
    groupe: "La barre qui paie",
    quoi: "La nature de ce que tu fabriques — un personnage, un objet tenu en main, un décor — choisie dans le barème de ton univers.",
    change:
      "Trois choses d'un seul geste : quels artworks partent en référence, quel modèle est proposé par défaut, et quelle part de la case le sujet occupera une fois sur grille.",
    origine: "le barème de l'univers · aucun sujet par défaut",
    long:
      "Sans sujet choisi, seules les planches marquées « tous » partent en référence — c'est écrit sous le contrôle, en clair, plutôt que laissé à deviner. Le barème se pose dans l'univers, côté Réglages du jeu, une fois pour le projet : c'est lui qui dit qu'un personnage remplit 90 % de sa case et une fiole 40 %, et c'est ce qui met un tonneau et un personnage à la même échelle de pixel.",
  },

  "atelier.apercu": {
    nom: "Ce qui partira",
    ou: "sujet",
    groupe: "La barre qui paie",
    quoi: "Le texte exact envoyé au modèle, rangé en trois parties : le contexte, les références, et la demande.",
    change:
      "Rien à la génération tant que tu le lis. Le contexte dit ce qu'est ton jeu, les références ce que chaque image jointe est, la demande porte ton sujet, les consignes de planche et la caméra. « Reprendre le texte » en fait le contenu du champ : ce que tu écris part alors mot pour mot.",
    origine: "composé par l'atelier · l'ordre est celui de l'envoi",
    long:
      "Reprendre le texte ne touche pas à ton univers : les textes du jeu restent ce qu'ils étaient, et la reprise ne vaut que pour cette génération-là. Le sujet choisi décide toujours des artworks envoyés, du modèle proposé et de la part de case ; le gabarit d'un lot part toujours. Ce texte se relit en entier sur l'écran de confirmation, juste avant de payer.",
  },

  "envoi.ecran": {
    nom: "L'écran de confirmation",
    ou: "sujet",
    groupe: "L'écran de confirmation, avant l'envoi",
    quoi: "Ce qui s'ouvre entre le bouton et la dépense — chaque chose qui va partir, ligne par ligne, avec un interrupteur et son prix.",
    change:
      "Rien tout seul : c'est une relecture. Ce qu'on y éteint ou corrige ne vaut que pour cette génération-là, et rien ne remonte dans les réglages du jeu ni dans l'ambiance.",
    origine: "composé par l'atelier · l'ordre est celui de l'envoi",
    long:
      "« Garder sur le sujet » inscrit la correction sur sa fiche ; sans sujet visé, elle part quand même, mais n'a nulle part où se garder. Le sujet et la pose ne s'éteignent pas. Une case peut sauter la relecture pour la série en cours ; elle revient au changement de sujet ou de pose — pas de case « pour toujours ». Ce qui n'agit qu'au retour (découpage, grille, détourage) est en gris.",
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
    ou: "sujet",
    groupe: "Le calibrage",
    quoi: "Les poses d'une même chose ne sortent pas toutes à la même hauteur ; cet outil les remet à la même, sans rien redessiner ni payer.",
    change:
      "Il réécrit la taille rendue des poses qu'on lui désigne. Le défaut qu'il corrige est mesuré : six poses du même personnage, même recette, sont sorties à 64, 60, 64, 53, 64 et 43 pixels de haut — un bras tendu élargit la boîte du sujet, et la mise sur grille rétrécit tout le reste.",
    origine:
      "la matrice de l'établi, qui marque en doré les poses hors taille commune",
    long:
      "Il travaille sur toutes les poses à la fois — la barre des tables parle de l'image ouverte, lui écrit dans les autres, donc il vit à part. Il n'écrit que dans l'occupation, une part de la case : changer la taille de la case ne défait donc aucun calage. Il n'épingle pas, et ne coûte rien : aucun appel payant ne part d'ici.",
  },

  "calibrage.occupation": {
    nom: "occupation",
    ou: "sujet",
    groupe: "Le calibrage",
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
    ou: "sujet",
    groupe: "Le calibrage",
    quoi: "De combien la chose est poussée à gauche ou à droite dans sa case.",
    change:
      "Où elle se trouve dans la case, pas sa taille. Il sert à recentrer une pose dont le geste déporte la silhouette — un bras tendu, une arme levée.",
    origine: "cet outil seul · il ne part jamais dans une recette qu'on nomme",
  },

  "calibrage.reference": {
    nom: "la référence",
    ou: "sujet",
    groupe: "Le calibrage",
    quoi: "La pose à laquelle on compare les autres à l'œil — c'est presque toujours le repos, la première qu'on a dessinée.",
    change:
      "Rien du tout : elle décide seulement quelle silhouette est montrée à demi effacée dans l'empilement. Elle ne décide pas de la hauteur commune.",
    origine: "toi · la première pose au départ",
  },

  "calibrage.mise_de_cote": {
    nom: "mettre de côté",
    ou: "sujet",
    groupe: "Le calibrage",
    quoi: "Sortir une pose du calage commun — on le fait pour une pose couchée ou accroupie, qui est basse pour de bonnes raisons.",
    change:
      "Elle cesse de tirer la hauteur commune vers le bas, donc les autres cessent d'être rapetissées à cause d'elle. Sa case, elle, se remplit et se compte comme avant.",
    origine:
      "toi · l'outil la propose quand une pose est très en dehors des autres",
  },

  // ── Les tables — les huit places de la recette ────────────────────────────
  //
  // **L'ordre ne se négocie pas**, et c'est ce que ces entrées ont à dire avant
  // tout le reste : trois places n'ont aucun sens avant celle qui les précède.
  // Rien ne peut se recadrer avant qu'un alpha dise où est le sujet.

  "retouche.brouillon": {
    nom: "Enregistrer les retouches d’une image",
    quoi: "Le brouillon garde tes réglages sur cet ordinateur, aperçu réel — l’image de la bibliothèque ne bouge qu’à Enregistrer les retouches.",
    change: "Défaire et Refaire parcourent les gestes. Quitter permet d’enregistrer, de conserver le brouillon ou de l’abandonner ; la reprise est proposée à la réouverture. Copier une recette ou revenir au brut prépare aussi un brouillon. La découpe, l’extraction et l’équipement utilisent la version enregistrée.",
    origine: "toi · recette non destructive et aperçu CPU local",
    groupe: "En haut de l'écran — enregistrer",
    ou: "tables",
  },

  // ── Enregistrer sous (`RP20`) ─────────────────────────────────────────────
  //
  // **Une entrée, pas trois.** Le sujet, la pose et la direction de la fenêtre
  // sont la même question posée en trois champs : *où ça va*. Trois entrées
  // auraient répété la même phrase, et la règle du guide est qu'une entrée
  // décrit un réglage — celui-ci en est un seul.

  "enregistrer-sous.case": {
    nom: "où le résultat se range",
    groupe: "En haut de l'écran — enregistrer",
    ou: "tables",
    quoi: "La pose et la direction où ranger le résultat : une image, ou une animation, toute neuve, dont la retouche repart de zéro.",
    change:
      "Rien à la génération, et rien à l'original : ni sa retouche, ni son rendu ne bougent. La nouvelle case n'est pas retenue pour le jeu — la retenir est un second geste.",
    origine:
      "l'atelier propose la case de l'image · la direction au miroir quand la retouche en porte un · toi dès que tu choisis",
    long:
      "Ce n'est pas le miroir du retournement : là-bas l'image garde ses pixels d'origine et c'est la recette qui la retourne ; ici le retournement est déjà cuit dans les pixels, et la nouvelle case repart d'une recette vide. Ce n'est pas non plus dupliquer : la copie porterait la retouche, celle-ci porte le résultat.",
  },

  "tables.zoom": {
    nom: "le pour cent d'agrandissement",
    groupe: "L'image, et la barre au-dessus d'elle",
    ou: "tables",
    quoi: "À quelle taille l'image est montrée dans la table : de 1 à 250 %, à la main, au clic, ou à la molette.",
    change:
      "Rien à l'image — c'est une loupe, pas un réglage. *100 %* rend exactement un pixel d'image pour un pixel d'écran ; *ajusté* fait tenir l'image entière dans le cadre, et c'est ce qu'on obtient en ouvrant une table.",
    origine: "toi · ajusté à l'ouverture",
    long:
      "Ailleurs dans le produit — la galerie, la vitrine — l'agrandissement ne prend que des multiples entiers : un sprite montré à une échelle qui n'est pas entière fabrique des pixels qui n'existent pas. Cette règle sert à montrer une image ; ici on la travaille, et il faut pouvoir approcher et reculer librement.",
  },

  "bande.source": {
    nom: "viser ou découper une frame",
    ou: "bande",
    groupe: "Viser ou découper une frame",
    quoi: "La pipette, le tracé du sujet et le rectangle visent l’image source ; la découpe prélève la frame retouchée.",
    change: "Une visée corrige uniquement la frame choisie. Découper crée une image en bibliothèque, sans modifier ni enregistrer l’animation.",
    origine: "toi · depuis l’atelier d’animation",
    long: "La vue source possède son zoom et son déplacement : ses coordonnées restent celles du fichier original, avant réduction. La découpe part au contraire de la case finale, placement et Main compris. Après la découpe, Revenir à l’animation retrouve les réglages en cours. Les morceaux entrent dans la bibliothèque sans nouvel appel de génération.",
  },

  "etape.detourage": {
    nom: "Détourage",
    groupe: "La table Détourage",
    ou: "tables",
    quoi: "La première place de la recette : trouver le fond et le rendre transparent.",
    change:
      "Tout ce qui suit en dépend — le recadrage cherche le sujet dans l'alpha, la grille mesure son occupation dessus. C'est aussi l'étape la plus chère : environ 130 ms, contre 28 pour les quatre autres réunies.",
    origine: "posé par l'univers quand le sujet a une silhouette",
    long:
      "Une étape peut porter plusieurs passes, qui s'enchaînent sur le résultat de la précédente — un remplissage large, puis un durcissement de contour. Bouger un curseur de grille ou de couleurs ne relance pas le détourage : la retouche reste instantanée ; un cran de tolérance, lui, coûte environ 1,5 s.",
  },

  "detourage.moteur": {
    nom: "moteur",
    groupe: "La table Détourage",
    ou: "tables",
    quoi: "Comment le fond part : bord, pipette, sélection et palette du jeu l'enlèvent directement ; modèle demande une silhouette à un réseau.",
    change:
      "« Bord », « pipette », « sélection » et « palette du jeu » ne demandent aucun réseau et répondent en dizaines de millisecondes ; « modèle » coûte une à deux secondes par passe. Le rendu diffère surtout sur les images qui n'ont pas de fond plat.",
    origine: "mesuré le 27/08 sur 12 images · défaut « bord »",
    long:
      "Le remplissage depuis le bord ne part que d'un pixel relié au bord par une chaîne de la couleur du fond : un creux entouré par le sujet n'y est jamais relié, quelle que soit la tolérance — la pipette existe pour ce cas. Sur un fond plat, bord et modèle rendent la même image à 96 % ; sur un fond chargé, modèle isole 20 % quand bord échoue entièrement.",
  },

  "detourage.silhouette": {
    nom: "modèle",
    groupe: "La table Détourage",
    ou: "tables",
    quoi: "Quel modèle va chercher la silhouette, du plus rapide — obtenu sans rien demander — au plus lourd.",
    change:
      "Le lourd trouve un meilleur bord sur les silhouettes difficiles — des cheveux, une frange, un objet ajouré — et met plusieurs secondes par image au lieu d'une demi-seconde. Le choix se fait passe par passe : deux passes du même détourage peuvent employer deux modèles.",
    origine: "toi · défaut « rapide »",
    long:
      "Un modèle pèse plusieurs centaines de mégaoctets et n'est pas livré avec le produit : s'il n'est pas installé, le moteur est grisé avec sa raison ; s'il est installé mais pas encore descendu, l'atelier dit ce qu'il va rapatrier avant de commencer. Une recette qui nomme un modèle absent n'arrête rien : cette passe n'agit pas, les autres s'appliquent, et l'image sort quand même.",
  },

  "detourage.tolerance": {
    nom: "tolérance",
    groupe: "La table Détourage",
    ou: "tables",
    quoi: "Jusqu'où une couleur peut s'écarter du fond et compter quand même comme fond — l'écart toléré sur chaque composante de couleur.",
    change:
      "Monter mange le sujet par les bords ; descendre laisse un halo de fond autour de lui. Chaque cran relance le détourage : environ 1,5 s.",
    origine: "toi · défaut 28",
    long:
      "C'est pour ce réglage que le curseur du produit envoie ce qu'on a lâché et non ce qu'on a traversé — la valeur suit ta main tout de suite, le rendu attend que tu lâches. Sans ça, glisser sur vingt crans ferait vingt appels sérialisés, chacun coûtant près de 1,5 s.",
  },

  "detourage.durcissement": {
    nom: "durcissement",
    groupe: "La table Détourage",
    ou: "tables",
    quoi: "Combien de pixels sont rongés au bord de la silhouette après le seuil, de 0 à 4.",
    change:
      "Retire un liseré résiduel quand le seuil seul n'a pas suffi. Trop haut, il grignote les détails fins — une lame, une antenne, un doigt.",
    origine: "toi · défaut 0",
  },

  "detourage.couleur": {
    nom: "couleur visée",
    groupe: "La table Détourage",
    ou: "tables",
    quoi: "Le point que tu as cliqué dans l'image, et la couleur qu'il y avait dessous — c'est de là que la pipette part.",
    change:
      "Tant qu'aucun point n'est posé, la passe ne retire rien du tout. Recliquer ailleurs déplace le point de cette passe, sans en créer une deuxième.",
    origine: "toi · cliquée dans l'image",
    long:
      "Ce qui est gardé est le point, pas la tache qu'il désigne : une tache change de rang à chaque réglage qui bouge au-dessus, et un point ne bouge pas. La couleur, elle, se relit sous le point à chaque rendu — elle n'est jamais recopiée. Le point se compte sur l'image d'origine, avant tout traitement, comme le rectangle de recadrage : c'est pour ça qu'on vise sur elle, pas sur le rendu.",
  },

  "detourage.portee": {
    nom: "portée",
    groupe: "La table Détourage",
    ou: "tables",
    quoi: "Ce que la pipette retire : « cette tache », la seule zone sous le curseur, ou « partout », toutes les zones de cette couleur dans l'image.",
    change:
      "« Cette tache » règle un creux sans toucher au reste — c'est le geste pour lequel la pipette existe. « Partout » va plus vite et atteint aussi ce qui touche le sujet : un reflet, un œil, une dent de la même couleur que le fond partiront avec.",
    origine: "toi · défaut « cette tache »",
    long:
      "« Cette tache » s'arrête à ce qui reste de l'image : elle ne traverse jamais une zone qu'une passe précédente a déjà effacée, même si cette zone garde encore la couleur du fond sous sa transparence — c'est ce qui rend le geste prévisible sur plusieurs passes empilées.",
  },

  "detourage.trace": {
    nom: "forme entourée",
    groupe: "La table Détourage",
    ou: "tables",
    quoi: "La forme que tu traces à main levée autour du sujet, refermée toute seule — le geste est d'entourer, pas de dessiner une ligne.",
    change:
      "Rien tant qu'elle est vide. Une fois tracée, l'atelier cherche le bord du sujet à l'intérieur de ce que tu as entouré et ne touche à rien au-dehors. Retracer remplace la forme de cette passe ; retirer la passe défait le geste d'un coup.",
    origine: "toi · tracée dans l'image",
    long:
      "C'est la sélection magique des logiciels d'image : tu traces gros, sans suivre le contour, et l'atelier part du liseré de ta forme — du fond — et remplit vers l'intérieur jusqu'à buter sur le sujet. Elle agit avant le recadrage et la grille, qui ont besoin de savoir où est le sujet. Comme le point de la pipette, la forme ne voyage pas : coller une recette ailleurs la laisse derrière.",
  },

  "detourage.masquee": {
    nom: "masquer une passe",
    groupe: "La table Détourage",
    ou: "tables",
    quoi: "Retire cette passe du calcul le temps que tu regardes, sans perdre ses réglages — « montrer » rend exactement l'image d'avant.",
    change:
      "L'image se refait sans elle, et c'est tout ce que ça fait. Masquer n'est pas retirer : retirer la perd, masquer la met de côté. Toucher un de ses réglages la remontre — poser une valeur, c'est dire qu'on veut cette passe.",
    origine: "toi · défaut visible",
    long:
      "Plusieurs passes s'enchaînent et ne montrent que leur somme : impossible de savoir laquelle a mangé quoi sans les masquer une à une. C'est le même geste, et la même règle, qu'endormir une table plus bas — ce qu'on éteint garde ses réglages. Un pixel effacé ne change pas de couleur : seule sa transparence bouge, et une passe suivante lit encore cette couleur-là dessous.",
  },

  "etape.recadrage": {
    nom: "Recadrage",
    groupe: "La table Recadrage",
    ou: "tables",
    quoi: "La deuxième place : rogner l'image sur la boîte opaque du sujet.",
    change:
      "Ramène le sujet contre les bords de son image. Sans lui, l'occupation de l'étape suivante se mesurerait sur du vide, et deux sujets cadrés différemment ne sortiraient pas à la même échelle.",
    origine: "posé par l'univers quand le sujet a une silhouette",
  },

  "recadrage.boite": {
    nom: "ce qu'on garde",
    groupe: "La table Recadrage",
    ou: "tables",
    quoi: "Ce qu'on garde du recadrage : la boîte du sujet, mesurée sur l'alpha à chaque changement, ou une boîte tracée à la main, qui ne bouge plus.",
    change:
      "Le recadrage s'arrête à ce rectangle-là, et non à ce que le sujet occupe. C'est le seul moyen de garder une part de fond que rien ne rend opaque — l'ombre portée d'un sprite, l'auréole d'une lanterne. La seconde valeur ne se choisit pas dans la colonne : on trace sur l'image, et le segment bascule tout seul. Le premier segment est le clic qui défait.",
    origine: "mesurée sur l'alpha, ou tracée par toi",
    long:
      "Elle n'agit que si elle coupe le sujet : plus large que lui, elle est sans effet, parce que la grille recherche elle-même la boîte du sujet et rogne dessus — même mécanique que la marge sans effet quand une case est posée. Et elle ne voyage pas : quatre coordonnées collées sur une autre image tombent hors du cadre ou coupent n'importe où.",
  },

  "recadrage.marge": {
    nom: "marge",
    groupe: "La table Recadrage",
    ou: "tables",
    quoi: "Combien de pixels de l'image d'origine sont gardés autour de la boîte opaque du sujet.",
    change:
      "Élargit le recadrage. Sans marge, le sujet touche les quatre bords de son image recadrée — ce qui gêne les étapes suivantes et l'export.",
    origine: "toi · défaut 0",
  },

  "etape.grille": {
    nom: "Grille",
    groupe: "La table Pixelisation",
    ou: "tables",
    quoi: "La troisième place : remettre le sujet sur la grille de pixel du projet.",
    change:
      "C'est l'étape qui rend le produit possible — elle met toutes tes images sur le même pixel. Posée systématiquement, jamais en option : une grille qui a dérivé est le cas normal, pas l'incident.",
    origine: "posée par l'univers, toujours",
  },

  "grille.cible": {
    nom: "taille de pixel",
    groupe: "La table Pixelisation",
    ou: "tables",
    quoi: "Le côté de la case, en pixels logiques — la taille finale de ton sprite avant export.",
    change:
      "C'est l'étape qui rend le produit possible : elle remet toutes tes images sur le même pixel. Elle est demandée, jamais déduite de l'image reçue.",
    origine: "l'univers du projet, sinon toi · défaut 64",
    long:
      "Dix modèles sur douze font dériver la taille du pixel d'une étape à l'autre : sans cette remise à niveau, les frames d'un même personnage ne partagent plus le même pixel. La déduire de l'image reçue laisserait le fournisseur décider de l'échelle du jeu : elle se demande, jamais ne se devine. La ligne au-dessus dit la taille des carrés que le modèle a peints, s'il en a peint.",
  },

  "grille.occupation": {
    nom: "hauteur",
    groupe: "La table Pixelisation",
    ou: "tables",
    quoi: "La hauteur du sujet, comptée en personnages : 100 % en fait un, 300 % en fait trois.",
    change:
      "C'est elle, et non la taille de l'image d'origine, qui met un tonneau et un personnage à la même échelle de pixel. Au-delà de 100 %, l'image revient plus grande.",
    origine: "le barème de l'univers via le sujet · défaut 100 %",
    long:
      "Deux images du même fournisseur n'arrivent pas à la même échelle : sans ce réglage, un tonneau deviendrait aussi grand qu'un personnage. Elle peut dépasser 100 % — 300 % fait trois personnages de haut — mais le carré, lui, ne change jamais de taille : deux tailles de pixel dans une scène s'appellent des « mixels », et l'œil les repère aux bords. Le plafond dépend de la case posée.",
  },

  "grille.ancrage": {
    nom: "ancrage",
    groupe: "La table Pixelisation",
    ou: "tables",
    quoi: "Le point de la case qui accroche le sujet quand il ne la remplit pas : les coins, les milieux de bord ou le centre, neuf en tout.",
    change:
      "Décide de l'alignement entre deux frames du même personnage. En bas par défaut, parce qu'un personnage se tient debout sur le bord bas de sa case.",
    origine: "défaut du produit · bas",
    long:
      "Deux frames d'une même animation posées au centre flotteraient l'une par rapport à l'autre : le bas est le bon défaut pour tout ce qui se tient debout. Les huit autres servent à ce qui ne se tient pas au sol — une icône par son centre, une flamme ou une bannière par leur haut, une porte qui pivote par son côté.",
  },

  "grille.methode": {
    nom: "réduction",
    groupe: "La table Pixelisation",
    ou: "tables",
    quoi: "Comment l'image passe de ses milliers de pixels aux carrés de la case, en quatre façons qui rendent quatre sprites différents.",
    change:
      "C'est un choix de style, pas un classement : le vote rend un sprite calme, les traits épaissis un sprite détaillé, la réduction douce une image floue mais lisse, et « au plus proche » un résultat brut.",
    origine: "défaut du projet · vote en deux temps",
    long:
      "Réduire mille pixels à soixante-quatre carrés, c'est en jeter quatre-vingt-dix-neuf sur cent : ce qu'on garde et comment décide de tout le style du sprite. Le projet donne un défaut, mais cette image garde le dernier mot, et changer de méthode ne coûte rien — aucun appel payant ne part d'ici.",
  },

  "etape.quantification": {
    nom: "Quantification",
    groupe: "La table Couleurs",
    ou: "tables",
    quoi: "La quatrième place : ramener l'image à un nombre fini de couleurs, celles de la palette du projet.",
    change:
      "Donne au rendu sa cohérence de palette. Elle vient après la grille et jamais avant : quantifier 1024 px pour les jeter ensuite coûte cent fois plus pour le même résultat.",
    origine: "posée par l'univers quand il a une palette",
    long:
      "Elle est déterministe : une recette nommée, rejouée ailleurs, rend exactement le même résultat — la coupe médiane ne tire rien au sort, à l'inverse d'un k-moyennes mal initialisé. Elle force aussi l'alpha à 255 sans toucher à la couleur, ce qui referme le liseré qu'un rééchantillonnage laisse à demi transparent.",
  },

  "quantification.palette": {
    nom: "couleurs de",
    groupe: "La table Couleurs",
    ou: "tables",
    quoi: "D'où viennent les couleurs de la palette : celles du jeu, copiées telles quelles, ou celles que l'algorithme choisit sur l'image.",
    change:
      "Copie la palette du jeu dans la recette au moment du choix, comme celle d'une passe « palette » du détourage, ou la vide pour laisser l'algorithme décider sur l'image seule.",
    origine: "l'univers du projet · « le jeu » par défaut s'il a une palette, sinon « l'image »",
  },

  "quantification.couleurs": {
    nom: "couleurs",
    groupe: "La table Couleurs",
    ou: "tables",
    quoi: "Sur combien de couleurs l'image est ramenée.",
    change:
      "Donne au rendu sa cohérence de palette. Cette étape s'applique après la réduction sur grille, jamais avant — quantifier 1024 px pour les jeter ensuite coûte cent fois plus pour le même résultat.",
    origine: "toi · défaut 32",
  },

  "quantification.algorithme": {
    nom: "algorithme",
    groupe: "La table Couleurs",
    ou: "tables",
    quoi: "Comment les couleurs de la palette sont choisies, quand elles sont trouvées dans l'image plutôt qu'imposées par le jeu.",
    change:
      "**Coupe médiane** découpe l'espace des couleurs en deux, puis en deux, et rend le milieu de chaque boîte. C'est rapide et c'est ce que l'atelier fait depuis toujours ; une couleur rare mais franche y pèse peu et se noie.\n\n**K-moyennes** part de couleurs candidates et les laisse glisser vers le centre de ce qui les entoure : le vert d'une grenouille au milieu d'une image de bruns survit au lieu de virer olive. C'est le plus lent des trois.\n\n**Découpe en huit** sature moins vite : quand tu demandes 32 couleurs et que tu n'en obtiens que 14, c'est elle qui t'en rendra le plus.\n\nGrisé quand la palette du jeu est posée : elle décide alors seule, et il n'y a rien à choisir.",
    origine: "toi · défaut coupe médiane",
  },

  "quantification.graine": {
    nom: "graine",
    groupe: "La table Couleurs",
    ou: "tables",
    quoi: "Le point de départ de k-moyennes, le seul des trois algorithmes qui tire quelque chose au sort.",
    change:
      "Deux graines donnent deux palettes légèrement différentes sur la même image : si une couleur te déplaît, changer la graine est le geste le moins cher pour en essayer une autre.\n\nElle est **écrite dans la recette**, et c'est ce qui permet à k-moyennes d'exister ici : sans elle, deux fois la même demande ne rendraient pas la même image, et le produit tient à ce que la même recette rende toujours le même pixel.",
    origine: "toi · défaut 0",
  },

  "quantification.distance": {
    nom: "distance des couleurs",
    groupe: "La table Couleurs",
    ou: "tables",
    quoi: "Comment on décide quelle couleur de la palette est « la plus proche » d'un pixel.",
    change:
      "**Brute** compte le rouge, le vert et le bleu à parts égales — ce que l'œil ne fait pas. Le vert vif d'une grenouille peut alors partir sur un gris-vert terne, parce qu'il en est proche au calcul.\n\n**À l'œil** mesure dans un espace où deux couleurs également distantes paraissent également différentes. Le vert reste vert, et les gris restent des gris. Sur les bruns et les gris, les deux donnent la même image.",
    origine: "toi · défaut brute",
  },

  "quantification.visibles_seuls": {
    nom: "ne compter que ce qu'on voit",
    groupe: "La table Couleurs",
    ou: "tables",
    quoi: "Si les pixels cachés sous la transparence entrent dans le compte des couleurs.",
    change:
      "Le fond qu'un détourage vient de retirer est encore là, sous la transparence, avec sa couleur intacte : il prend une place de la palette pour une couleur que personne ne regarde. Décoché, tu demandes 8 couleurs et tu en obtiens 7 sur le sujet. Coché, les 8 sont pour lui.\n\nUne animation ne compte déjà que les pixels visibles ; ce réglage donne la même correction à une image seule.",
    origine: "toi · défaut non",
  },

  "quantification.tramage": {
    nom: "tramage",
    groupe: "La table Couleurs",
    ou: "tables",
    quoi: "Comment les couleurs qui n'existent pas dans la palette sont approchées : par la plus proche, ou par un mélange de points.",
    change:
      "Sans tramage, un dégradé réduit à seize couleurs se pose en bandes franches. Avec, les bandes se mêlent en un semis de points — ce qui ressemble davantage au pixel art d'époque et ce qui, sur un sprite de 64 px, se voit beaucoup.\n\nIl y en a deux, et ils ne servent pas au même. **Diffusion** reporte l'erreur d'un pixel sur ses voisins : le semis dépend de ce qu'il y a autour, donc il se recalcule à chaque frame et une animation grésille. **Trame régulière** décide par la position du pixel, sur un motif fixe de 4×4 : le damier se répète et tient d'une frame à l'autre. Sur ce qui bouge, c'est le seul des deux qui convienne.",
    origine: "toi · défaut aucun",
  },

  "quantification.force_tramage": {
    nom: "force du tramage",
    groupe: "La table Couleurs",
    ou: "tables",
    quoi: "Combien de points le semis pose.",
    change:
      "À 25 %, seuls les grands dégradés reçoivent des points et les aplats restent propres. À 100 %, c'est le semis complet.\n\nGrisée tant qu'aucun tramage n'est choisi : il n'y a alors aucun point à doser.",
    origine: "toi · défaut 100 %",
  },

  "quantification.curseurs": {
    nom: "les quatre curseurs",
    groupe: "La table Couleurs — avant et après la réduction",
    ou: "tables",
    quoi: "Luminosité, contraste, saturation et teinte, appliqués à l'image avant qu'elle soit ramenée sur ses couleurs.",
    change:
      "Change la couleur du rendu sans redemander l'image. Les quatre agissent avant la réduction, jamais après : régler après, c'est décaler des couleurs déjà choisies et en refabriquer qui ne sont plus dans la palette.",
    origine: "toi · les quatre à zéro par défaut, et zéro ne touche à rien",
    long:
      "À zéro, les quatre ne changent rien et ne s'écrivent pas dans la recette : l'empreinte d'une recette déjà en usage ne bouge pas. La teinte tourne autour de l'axe des gris, comme le ferait un filtre de navigateur — un gris reste gris quel que soit l'angle. Aucun des quatre ne touche à la transparence : un sujet détouré le reste, au pixel près.",
  },

  "quantification.gardees": {
    nom: "couleurs gardées",
    groupe: "La table Couleurs — avant et après la réduction",
    ou: "tables",
    quoi: "Les couleurs qu'aucune réduction ne doit fondre avec une voisine, six au plus.",
    change:
      "Elles sont posées d'office dans la palette, avant que l'algorithme ne choisisse le reste : à 8 couleurs, en garder deux lui en laisse six.\n\nPique le noir d'un contour et le vert d'une grenouille, et à 8 couleurs le contour reste noir au lieu de virer brun foncé, la grenouille reste verte au milieu des bruns. Au-delà de six, il ne resterait plus rien à choisir.",
    origine: "toi · défaut aucune",
  },

  "quantification.echanges": {
    nom: "échanges de couleur",
    groupe: "La table Couleurs — avant et après la réduction",
    ou: "tables",
    quoi: "Des paires — cette couleur-là devient celle-ci — appliquées après la réduction.",
    change:
      "Donne une variante sans payer une image : la même cape en bleu, en vert, en rouge. La silhouette est identique à l'octet près, puisque seule la couleur des pixels opaques change.",
    origine: "toi · aucune paire par défaut",
    long:
      "Vient après la réduction, quand l'image ne porte déjà plus qu'une poignée de couleurs franches — avant, la même couleur existe en cent nuances. Toutes les paires se lisent sur l'image reçue, jamais sur le résultat d'une autre : « rouge devient bleu » puis « bleu devient vert » ne fait pas passer le rouge au vert. La transparence n'est jamais touchée.",
  },

  "quantification.echanges.tolerance": {
    nom: "tolérance de la paire",
    groupe: "La table Couleurs — avant et après la réduction",
    ou: "tables",
    quoi: "De combien une couleur de l'image peut s'écarter de la couleur nommée pour être quand même échangée.",
    change:
      "À 0, seule la couleur exacte part. Monter attrape les nuances voisines — les deux ou trois bleus qu'une réduction a laissés là où l'œil n'en voit qu'un.",
    origine: "toi · défaut 0",
    long:
      "L'écart se mesure comme partout dans le dépôt : le plus grand des trois écarts, sur le rouge, le vert et le bleu — la même règle que la détection du fond et le détourage par les bords. Monter trop haut fait déborder la paire sur un voisin qu'on voulait garder ; le rendu se refait à chaque cran, donc le débordement se voit tout de suite.",
  },

  "etape.bords": {
    nom: "Nettoyage des bords",
    groupe: "La table Nettoyage",
    ou: "tables",
    quoi: "La cinquième et dernière place : effacer les taches trop petites pour être le sujet.",
    change:
      "Ne se pose jamais tout seul, et c'est délibéré : c'est le seul geste du post-traitement qui puisse enlever quelque chose au sujet. Il reste à la fiche, là où on le voit agir.",
    origine: "toi seul · jamais posé par l'univers",
  },

  "bords.aire_min": {
    nom: "tache minimale",
    groupe: "La table Nettoyage",
    ou: "tables",
    quoi: "En dessous de cette aire, en pixels, une tache opaque isolée est effacée.",
    change:
      "Retire les pixels isolés qu'une réduction au plus proche voisin laisse derrière elle. À 64 px de côté un pixel isolé se voit ; à 1024 il ne se voyait pas.",
    origine: "toi · défaut 3 px, et 0 n'efface rien",
    long:
      "Une tache est une zone opaque connexe, trouvée par le même remplissage par plages que la détection de la découpe — donc la même réponse sur la même image.\n\nMonter trop haut efface un détail détaché du corps : la pointe d'une lance, une étincelle, un éclat de magie. Le réglage est le dernier de la recette parce qu'il travaille sur ce que les quatre autres ont laissé, et pas sur l'image reçue.",
  },

  "bords.garder": {
    nom: "garder les plus grandes",
    groupe: "La table Nettoyage",
    ou: "tables",
    quoi: "Seuls les N plus grands amas opaques restent ; tout le reste devient transparent.",
    change:
      "Efface d'un coup les îlots détachés du sujet — un reflet, une éclaboussure —, quelle que soit leur aire, dès lors qu'ils ne comptent pas parmi les plus grands.",
    origine: "toi · défaut 0, et 0 ne trie rien",
    long:
      "Les amas sont classés par aire décroissante ; seuls les N premiers survivent. À 1, un seul amas reste — le sujet, s'il est bien le plus grand morceau de l'image.\n\nÀ la différence de la tache minimale, qui juge chaque amas contre un seuil fixe, ce réglage les juge les uns contre les autres : il efface même un gros îlot, s'il en existe un plus gros encore.",
  },

  "bords.boucher_jusqua": {
    nom: "boucher les trous",
    groupe: "La table Nettoyage",
    ou: "tables",
    quoi: "Un trou — une zone transparente entièrement entourée de sujet — plus petit que ce seuil se comble, avec la couleur qui l'entoure.",
    change:
      "Répare un trou de découpe au milieu du sujet, celui que la tache minimale ne voit jamais parce qu'il est transparent et non opaque.",
    origine: "toi · défaut 0, et 0 ne comble rien",
    long:
      "Un trou se distingue d'une poche de fond par un seul fait : il est transparent, quand la poche est opaque et couleur du fond. Les deux sont enfermés dans le sujet, mais seul le trou tombe sous ce réglage — la poche a le sien, juste en dessous.\n\nLe remplissage reprend la couleur qui borde le trou, pixel par pixel autour du contour, jamais une couleur inventée.",
  },

  "bords.reboucher_jusqua": {
    nom: "reboucher les poches de fond",
    groupe: "La table Nettoyage",
    ou: "tables",
    quoi: "Une poche de fond enfermée dans le sujet, plus petite que ce seuil, devient transparente.",
    change:
      "Efface le résidu de fond resté enfermé dans le sujet après le détourage, celui qu'un remplissage parti des bords de l'image n'a jamais pu atteindre.",
    origine: "toi · défaut 0, et 0 ne reboucher rien",
    long:
      "Une poche est opaque, couleur du fond, entourée de sujet, et jamais atteinte par le remplissage qui part des bords de l'image vers l'intérieur — l'inverse exact du trou, qui est transparent. La comparaison de couleur tolère un petit écart, pour la compression ou l'anticrénelage.",
  },

  "bords.ronger_regonfler": {
    nom: "ronger puis regonfler",
    groupe: "La table Nettoyage",
    ou: "tables",
    quoi: "Retire les excroissances plus fines que ce rayon, puis regonfle le sujet du même rayon pour lui rendre sa taille.",
    change:
      "Arrondit une pointe accidentelle ou un pont fin entre deux amas qui n'auraient jamais dû se toucher, sans faire maigrir le corps du sujet.",
    origine: "toi · défaut 0, et 0 ne ronge rien",
    long:
      "L'opération est symétrique : ronger enlève une épaisseur donnée tout autour du sujet, regonfler la lui rend. Ce qui est assez épais pour survivre au rongement revient à sa taille ; ce qui est plus fin que le rayon — une pointe, un pont — disparaît et ne revient pas.\n\n« Épargner les traits fins », juste en dessous, protège ce que ce réglage emporterait sinon.",
  },

  "bords.epargner_traits_fins": {
    nom: "épargner les traits fins",
    groupe: "La table Nettoyage",
    ou: "tables",
    quoi: "Un trait d'un pixel de large — une hampe, un brin d'herbe — survit au rongement plutôt que de disparaître avec le reste.",
    change:
      "Décide si « ronger puis regonfler » peut emporter un détail fin et volontaire, ou doit le laisser filer.",
    origine: "toi · défaut oui — épargner",
    long:
      "Sans l'épargne, le rongement ne distingue pas une excroissance accidentelle d'un détail dessiné exprès : les deux sont plus fins que le rayon, les deux disparaissent. Avec l'épargne, un pixel d'un trait d'un seul pixel de large est reconnu avant le rongement et remis en place après.\n\nNe change rien seul : il agit seulement avec « ronger puis regonfler ».",
  },

  "bords.regonfler_ronger": {
    nom: "regonfler puis ronger",
    groupe: "La table Nettoyage",
    ou: "tables",
    quoi: "Regonfle le sujet de ce rayon pour combler les entailles fines du bord, puis le ronge du même rayon pour lui rendre sa taille.",
    change:
      "Comble une entaille ou un pont manquant sur le bord du sujet — l'inverse de « ronger puis regonfler », qui retire plutôt que combler.",
    origine: "toi · défaut 0, et 0 ne regonfle rien",
    long:
      "L'opération est symétrique : regonfler ajoute une épaisseur de rayon donné tout autour du sujet, ronger la lui retire. Une entaille plus fine que le rayon — une fente entre deux doigts mal découpée — se referme au regonflement et ne rouvre pas ; le contour général du sujet, lui, revient à sa taille d'origine.",
  },

  "bords.grain_min": {
    nom: "grain de couleur",
    groupe: "La table Nettoyage — la couleur, pas la silhouette",
    ou: "tables",
    quoi: "Un pixel posé au milieu du sujet, dont la couleur n'est portée par aucun voisin, reprend la couleur qui l'entoure.",
    change:
      "Efface le point de couleur accroché au sujet — celui que la tache minimale ne voit pas, parce qu'il n'est pas isolé : il est collé au corps, entouré de pixels opaques. C'est le seul réglage qui l'atteigne.",
    origine: "toi · défaut 0, et 0 n'efface rien",
    long:
      "Le chiffre dit combien des huit voisins doivent porter la couleur du pixel pour qu'on le laisse tranquille. Il ne touche jamais le bord du sujet : seuls les pixels entourés de huit pixels opaques sont concernés, et il ne repeint que si cinq voisins ou plus partagent une même couleur — sinon il s'efface seul. Il ne peut pas inventer une couleur : celle qu'il pose est toujours celle d'un voisin.",
  },

  "bords.lissage": {
    nom: "escalier des bords",
    groupe: "La table Nettoyage — la couleur, pas la silhouette",
    ou: "tables",
    quoi: "Les pixels qui ne tiennent au sujet que par un coin sont décrochés — jusqu'à trois passes.",
    change:
      "Adoucit la marche d'escalier qu'une réduction laisse sur une diagonale. Une passe suffit presque toujours ; trois est le maximum, et c'est déjà beaucoup.",
    origine: "toi · défaut 0, et 0 ne décroche rien",
    long:
      "Un pixel décroché est un pixel opaque sans voisin opaque en haut, en bas, à gauche ni à droite, mais avec un en diagonale — la dent qu'une réduction au plus proche voisin laisse sur un trait oblique. Il diffère de la tache minimale, qui efface ce qui est détaché : celui-ci rabote ce qui tient par un seul coin, sans jamais couper le sujet en deux.",
  },

  "bords.vote_voisins": {
    nom: "vote des voisins",
    groupe: "La table Nettoyage — la couleur, pas la silhouette",
    ou: "tables",
    quoi: "Chaque pixel du bord devient ce que sa majorité franche de huit voisins est déjà — jusqu'à trois passes.",
    change:
      "Régularise un bord irrégulier, dent par dent, sans jamais faire grossir ni maigrir le sujet en moyenne : ce qui gagne d'un côté est rendu de l'autre.",
    origine: "toi · défaut 0, et 0 ne vote rien",
    long:
      "Un pixel ne change d'état — opaque ou transparent — que si cinq de ses huit voisins ou plus partagent l'état inverse du sien. À quatre contre quatre, rien ne bouge : le vote ne tranche que sur une majorité franche, jamais sur un coup de dé. Ce n'est pas un lissage de couleur : il ne touche que la silhouette, jamais la teinte.",
  },

  // ── La sixième place : les contours ───────────────────────────────────────
  //
  // **La seule table entièrement neuve du lot** (E5) : rien n'en existait dans
  // le produit. La panne qu'elle répare est précise — la mise sur grille mange
  // les contours fins, et ce qui reste n'est pas un contour absent, ce qui
  // serait franc, mais un contour *troué*, qui se voit et ne se rattrape pas.

  "etape.contours": {
    nom: "Les contours",
    groupe: "La table Contour",
    ou: "tables",
    quoi: "La sixième place de la recette. Elle trace un trait sur le bord du sujet, d'une couleur choisie, et le pose dedans, dehors, ou à cheval.",
    change:
      "Posé dehors, le trait agrandit l'image rendue : c'est le seul réglage du produit qui change les dimensions du sprite sans qu'on le lui ait demandé, et la table le dit en ligne sœur au moment où l'on choisit la position.",
    origine:
      "toi · éteinte au départ · la couleur proposée est la plus sombre de ta palette",
  },

  "contours.epaisseur": {
    nom: "épaisseur du contour",
    groupe: "La table Contour",
    ou: "tables",
    quoi: "La largeur du trait, en pixels de l'image rendue — celle qui part dans le jeu.",
    change:
      "Rien à la génération. Au-delà de huit ce n'est plus un contour, c'est un cadre, et il vaut mieux le dessiner à la main : le plafond est là pour ça, pas pour une limite technique.",
    origine: "toi · défaut 1 px",
    long:
      "L'unité est celle de l'image **rendue**, pas celle reçue : une fois la grille posée, l'image rendue *est* la case du sprite, et un pixel y est un bloc.\n\nLa table ne devine pas l'épaisseur en mesurant le contour existant : un contour troué donne des épaisseurs qui varient de un à trois, et proposer leur médiane serait deviner à partir de la panne qu'on répare.",
  },

  "contours.position": {
    nom: "position du contour",
    groupe: "La table Contour",
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
    groupe: "La table Contour",
    ou: "tables",
    quoi: "Un trou de la silhouette — une boucle de ceinture, l'espace entre un bras et un torse — reçoit-il la même ligne que le pourtour ?",
    change:
      "Rien à la génération. Cerclés, un trou plus petit que deux fois l'épaisseur se bouche : la table donne le compte et la plus petite taille pour que ça se voie venir.",
    origine: "toi · défaut cerclés",
    long:
      "Un trou est un bord du sujet exactement comme le pourtour, et c'est ce que fait un style « contour noir 2 px » — d'où le défaut. **Laissés** ne trace que le pourtour extérieur, pour les styles qui veulent une découpe nette sans lignes à l'intérieur du sujet.",
  },

  "contours.couleur": {
    nom: "couleur du contour",
    groupe: "La table Contour",
    ou: "tables",
    quoi: "La couleur exacte du trait. La palette du jeu est proposée en rangée ; le champ reste libre.",
    change:
      "Rien à la génération. Une couleur qui n'est pas dans la palette du jeu se marque « hors palette » au lieu d'être refusée — le produit constate, il ne décide pas à ta place.",
    origine: "toi · proposé : la plus sombre de ta palette, ou le noir sans palette",
    long:
      "La règle du produit tient en une ligne : **la palette est imposée par la quantification, qui ramène chaque pixel sur la couleur la plus proche ; elle est proposée partout ailleurs.** Ici on est *après* la quantification — ce que le trait pose ne sera pas rattrapé, et c'est précisément ce qui mérite d'être dit plutôt que refusé.",
  },

  // ── Les six capacités de B18 ────────────────────────────────────────────────

  "contours.derivee": {
    nom: "couleur du trait",
    groupe: "La table Contour — les cinq cases à cocher",
    ou: "tables",
    quoi: "Fixe, ou dérivée : chaque pixel du trait prend alors la teinte du bord le plus proche, assombrie.",
    change:
      "Rien à la génération. Dérivée, la couleur choisie au-dessus est ignorée — le trait suit la matière du sujet plutôt qu'une seule teinte.",
    origine: "toi · défaut fixe",
    long:
      "C'était la troisième façon d'obtenir la couleur du trait, prévue dans le plan qui a produit cette table et jamais écrite : « la teinte dominante du bord, assombrie de 30 à 40 % ». Un sujet à plusieurs matières — une robe, une peau, un bâton — garde alors chacune la sienne, cernée de sa propre couleur assombrie, plutôt que d'un même noir partout.",
  },

  "contours.reserver": {
    nom: "réserver la place",
    groupe: "La table Contour — les cinq cases à cocher",
    ou: "tables",
    quoi: "La case ne grandit jamais, quel que soit le choix de position.",
    change:
      "Rien à la génération. Posé, le sujet perd l'épaisseur du trait sur son bord plutôt que le fichier — la case du jeu reste à sa taille, quoi qu'il arrive.",
    origine: "toi · défaut éteint",
    long:
      "« Réserver la place » prime sur « position » : la case ne bouge plus jamais, quel que soit le choix. Le résultat revient à poser le trait « dedans », choisi automatiquement — le sujet perd l'épaisseur du trait sur son bord plutôt que le fichier.",
  },

  "contours.inegal": {
    nom: "trait inégal",
    groupe: "La table Contour — les cinq cases à cocher",
    ou: "tables",
    quoi: "Un dégradé du haut (presque rien) vers le bas (plein), comme si la lumière venait du ciel — et rien sur la toute dernière rangée du sujet.",
    change:
      "Rien à la génération. La dernière rangée ne reçoit jamais le trait : pas de semelle noire qui décollerait le sujet de son ombre.",
    origine: "toi · défaut éteint",
    long:
      "Le trait de la table est aujourd'hui de la même force partout. Posé, il s'éclaircit vers le haut et s'arrête net sous les pieds — ce qui sépare un sprite découpé d'un sprite posé au sol.",
  },

  "contours.sur_calques": {
    nom: "sur l'ensemble empilé",
    groupe: "La table Contour — les cinq cases à cocher",
    ou: "tables",
    quoi: "Le trait se calcule sur la silhouette de tous les calques posés ensemble, pas sur ce calque seul.",
    change:
      "Rien à la génération. Une pièce d'équipement — une épée, un casque — ne porte alors plus son propre liseré là où elle touche le corps.",
    origine: "toi · défaut éteint",
    long:
      "Sur un calque d'équipement, le trait cernait la pièce toute seule — un liseré qui la détache du corps au lieu de l'y coller. Posé, le trait se trace après composition des calques, sur le pourtour de l'ensemble.",
  },

  "contours.desactive_plein_cadre": {
    nom: "s'éteindre sur une tuile",
    groupe: "La table Contour — les cinq cases à cocher",
    ou: "tables",
    quoi: "Un sujet qui touche les quatre bords de l'image sur toute leur longueur — une tuile, un décor plein cadre — ne reçoit pas de trait.",
    change:
      "Rien à la génération. Décoché, le trait se trace même sur un tel sujet, ce qui dessine un quadrillage une fois les images posées côte à côte.",
    origine: "toi · défaut actif",
    long:
      "Une tuile n'a pas de silhouette à détacher : ses bords sont ceux du cadre. Ce garde-fou est plus fin que « entièrement opaque » — une tuile texturée peut laisser passer un peu de fond sans jamais ouvrir ses quatre bords.",
  },

  // ── La septième place : le retournement ───────────────────────────────────
  //
  // **La seule place du produit qui ne demande rien au modèle et ne coûte
  // rien.** Elle existe parce qu'un personnage vu de dessus se dessine dans
  // quatre directions et que la moitié d'entre elles sont les miroirs exacts de
  // l'autre moitié : le produit n'avait aucune façon de le dire, donc les deux
  // se payaient.

  "etape.retournement": {
    nom: "Retournement",
    groupe: "La table Retournement",
    ou: "tables",
    quoi: "La septième place : produire les autres directions du sujet par un miroir ou une rotation, sans repayer un modèle.",
    change:
      "Rien à la génération sur huit des dix sens : c'est un calcul sur l'image déjà rendue, jamais un nouvel appel au modèle. Ranger le résultat sous une direction du jeu se fait ensuite dans la fenêtre Enregistrer sous…, pas ici.",
    origine: "toi · vide au départ · rien n'est posé tant qu'aucun sens n'est choisi",
  },

  "retournement.sens": {
    nom: "le sens du retournement",
    groupe: "La table Retournement",
    ou: "tables",
    quoi: "Comment l'image bascule : dix sens possibles, du miroir gauche-droite à une rotation libre.",
    change:
      "Rien à la génération sur les huit premiers, et c'est tout le sujet : ils ne demandent rien au modèle et ne coûtent rien. Aucun pixel n'est réinventé — ce sont les mêmes carrés de couleur, rangés dans un autre ordre, donc la palette de l'image retournée est exactement celle d'où elle vient. Les deux rotations libres, elles, peuvent traverser un pixel entre deux carrés — c'est ce que RotSprite réduit sans l'effacer.",
    origine: "toi · vide au départ · défaut miroir gauche-droite",
    long:
      "Le retournement s'endort sans se vider, comme les sept autres places : éteint, il garde son sens et cesse d'agir sur l'image. Trois sens ouvrent un réglage de plus sous ce cran-ci — l'angle pour les deux rotations libres, la moitié gardée pour le repli, les zones protégées pour « miroir sauf ici ».",
  },

  "retournement.angle": {
    nom: "l'angle",
    groupe: "La table Retournement",
    ou: "tables",
    quoi: "De combien tourner, pour les deux rotations libres. −180° à +180°.",
    change:
      "Le sujet pivote dans sa case. Au plus proche voisin, les diagonales se hachent dès quelques degrés sur une case de 64 px ; en RotSprite, le même angle garde des marches régulières au lieu d'un escalier au hasard.",
    origine: "toi · 0° au départ",
    long:
      "Un angle multiple de 90° ne change rien à l'image : ce sont les quatre premiers sens qui font ce travail-là sans jamais réinventer un pixel. L'angle libre n'a de sens qu'entre deux quarts de tour.",
  },

  "retournement.repli": {
    nom: "moitié gardée",
    groupe: "La table Retournement",
    ou: "tables",
    quoi: "Laquelle des deux moitiés de l'image, coupée en son milieu, est recopiée sur l'autre — le sens « miroir sur soi ».",
    change:
      "La moitié écartée disparaît, remplacée par le reflet de celle qu'on garde. La roue du moulin cesse d'avoir une pale plus large que les autres ; en échange, tout ce que le sujet avait d'unique du côté écarté se perd.",
    origine: "toi · gauche au départ",
    long:
      "L'axe du repli, lui, n'a pas encore de curseur à l'écran : il vaut le milieu de l'image tant que rien ne le déplace.",
  },

  "retournement.zones": {
    nom: "zones protégées",
    groupe: "La table Retournement",
    ou: "tables",
    quoi: "Les endroits qui reviennent tels quels après le miroir, dans le sens « miroir, sauf ici ».",
    change:
      "Sans zone, « miroir, sauf ici » retourne toute l'image comme un miroir gauche-droite ordinaire. Chaque zone ajoutée y recolle, après coup, le pixel d'origine — au prix d'une petite couture visible au raccord.",
    origine: "toi · aucune zone au départ",
    long:
      "Le geste d'aujourd'hui pose une zone ronde au centre de l'image, à ajuster à la main plus tard : peindre une zone du bout du doigt, comme la main le fait sur la table Main, viendra avec l'écran qui le demande. Exemple : un pèlerin qui tient son bâton à droite le garde à droite une fois retourné.",
  },

  // ── La huitième place : la main ───────────────────────────────────────────
  //
  // **C'est la seule table qui n'applique aucune règle**, et c'est exactement
  // ce qu'une explication doit dire — sinon on la cherche parmi les réglages,
  // où elle n'est pas.

  "etape.main": {
    nom: "La main",
    groupe: "La table Main",
    ou: "tables",
    quoi: "La huitième et dernière place : le crayon et la gomme, au pixel, là où les sept autres tables appliquent une règle à toute l'image.",
    change:
      "Rien à la génération, et rien tant que tu ne poses pas un pixel. Elle existe pour les trois pixels qu'aucun réglage n'atteint : un coin de fond collé au sujet, une dent dans un contour, une miette accrochée à la silhouette.",
    origine: "toi, geste par geste · rien au départ",
    long:
      "Comme toutes les tables, elle ne coûte rien. Le post-traitement ne touche jamais le fournisseur — on peut y passer une heure sans dépenser un centime, et c'est ce que la barre qui paie, absente ici, annonce avant qu'on ait lu quoi que ce soit.",
  },

  "main.calques": {
    nom: "les calques de la main",
    groupe: "La table Main",
    ou: "tables",
    quoi: "Une pile : « l'opacité » au fond, et autant de calques de dessin qu'on veut au-dessus.",
    change:
      "Rien à la génération, et rien tant que tu ne poses pas un pixel. Masquer un calque n'efface rien — il garde ses passages et cesse simplement d'être appliqué.",
    origine: "toi · « l'opacité » seule au départ",
    long:
      "**« L'opacité » est le sol**, d'une autre nature : elle ne pose pas de couleur, elle décide de ce qui est là sur l'image que les tables précédentes ont produite. Elle ne se supprime pas et ne se déplace pas — un calque de dessin sous l'image n'aurait aucun sens.\n\nLa pile se lit du dessus au dessous, comme partout ; elle s'applique dans l'autre sens, celui d'un pinceau.",
  },

  "main.sens": {
    nom: "le sens du geste",
    groupe: "La table Main",
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
    groupe: "La table Main",
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
    groupe: "La table Main",
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
    groupe: "La table Main",
    ou: "tables",
    quoi: "Combien de passages porte le calque choisi, et ce que Ctrl + Z va retirer.",
    change:
      "Rien : c'est un compte, et un geste. Ctrl + Z retire le dernier passage du calque actif ; « Tout effacer », en pied, vide la table entière.",
    origine: "toi, geste par geste · rien au départ",
    long:
      "**Il n'y a pas de liste de passages** : un geste à main levée en produit des dizaines, illisibles en rangées. Le calque est l'unité de lecture — on le nomme, le masque, le supprime — et le passage n'existe que comme un compte et un Ctrl + Z.\n\nUn passage est un **tracé, jamais des pixels** : il se rejoue sur une image dont les dimensions ont changé, sans perdre le dessin.",
  },

  // ── La fabrique Superposition — poser une pièce sur une pose ──────────────
  //
  // **Née sous `ou: "equipement"`, jamais atteignable là** (`GU8`,
  // `docs/PLAN-guide.md`) : une des deux fabriques de `TABLES`
  // (`interface/src/recette.ts`), montée uniquement par `Retouche.tsx`,
  // jamais par `Emplois.tsx`/`Emploi.tsx`. Choisie depuis la barre des
  // tables, pas dans le fil d'un emploi — c'est pour ça que son groupe suit
  // les treize de `GU5` plutôt que de s'y mêler. Groupée et vérifiée ici.

  "fabrique.superposition": {
    nom: "La superposition",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "Il prend deux images — un corps nu et le même habillé — et en tire le calque de ce qu'une pièce a ajouté.",
    change:
      "Rien sur les deux images de départ, qui ne sont jamais repeintes. Elle en produit une troisième — un calque —, et un calque est solidaire de la pose sur laquelle la pièce est apparue : il en faut un par pose.",
    origine: "deux images que tu désignes, dans la même pose",
  },

  "superposition.images": {
    nom: "les deux images",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "Le dessus, qui se déplace, et le dessous, qui est le sol et ne bouge jamais.",
    change:
      "Rien sur les deux images de départ, qui ne sont jamais repeintes. Intervertir les deux change le résultat, puisque le calque est fait de ce que le **dessus** ajoute.",
    origine: "toi · deux images que tu désignes, dans la même pose",
    long:
      "Le cas principal : l'atelier assemble une planche avec les corps du personnage, la fait habiller par le modèle, et redécoupe chaque case — il obtient l'image envoyée et l'image revenue. C'est cette paire qui remplit l'outil par défaut.\n\nMais il marche sur n'importe quelles deux images. Poser un corps nu sur un corps casqué donnerait le crâne nu au lieu du casque : le sens compte.",
  },

  "superposition.detourage": {
    nom: "avant de caler",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "L'état du détourage des deux images — c'est lui qui décide si un calque est seulement possible.",
    change:
      "Rien tant que tu ne reprends pas les passes. Une image qui revient du modèle est opaque de bord à bord : sans alpha sur le dessus, le calque emporte tout le fond de l'image.",
    origine: "la recette de chaque image · reprendre écrit dans celle du dessus",
    long:
      "Un pixel entre dans le calque s'il est **opaque dans le dessus et transparent dans le dessous**. Si le dessus n'est pas détouré, tout y est opaque — fond compris —, et tout ce qui entoure le corps part avec la pièce.\n\nLe dessus hérite du détourage du dessous, prérempli. L'alerte nomme la conséquence et propose le geste ; elle ne refuse pas — une image qui remplit légitimement son cadre existe.",
  },

  "superposition.voir": {
    nom: "voir les deux images",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "L'opacité et le mode de couleur du dessous, l'opacité du dessus.",
    change:
      "Rien du tout à ce qui sort — c'est de l'affichage, et rien d'autre. Ils existent pour une seule raison : caler à l'œil deux images qui se ressemblent.",
    origine: "toi · le dessous teinté à 50 %, le dessus à 92 %",
    long:
      "**Teinte** repeint tous les pixels opaques du dessous d'une seule couleur vive : c'est celui qui sert au calage, parce qu'aucune de ces couleurs n'existe dans un sprite. **Négatif** sert quand les deux images ont déjà des couleurs proches. **Normale** sert à vérifier le rendu final.",
  },

  "superposition.calage": {
    nom: "le calage",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "Où le dessus se pose sur le dessous — une proposition, puis ce que tu ajustes.",
    change:
      "Rien à la génération, et pas un centime : les deux images sont déjà payées. Avant, un recalage raté n'avait aucun recours — le calque était perdu et il fallait relancer une génération.",
    origine: "une proposition du produit, reprise à la main",
    long:
      "**Recaler est un bouton, pas un mode.** Il essaie 131 échelles et cherche pour chacune le décalage qui fait le mieux coïncider les deux silhouettes, sur des vignettes de 128 px pour rester rapide, puis remplit les trois champs et s'arrête là.\n\nOn le relance autant qu'on veut. Quand il tombe à côté — modèle dézoomé —, on corrige à la main.",
  },

  "superposition.echelle": {
    nom: "échelle du dessus",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "La taille du dessus par rapport au dessous. Détente à 1,000.",
    change:
      "C'est **le seul réglage de l'outil qui abîme l'image** : rééchantillonner du pixel art à un facteur qui n'est pas simple détruit la grille. Le champ le marque ; il ne le refuse pas.",
    origine: "toi · proposé par le recalage",
    long:
      "**Elle ne part pas toujours de la taille d'arrivée de l'image.** Le cadre du dessous fait loi : un dessus plus grand que lui y entre entier, réduit pour tenir, et c'est *à partir de là* que 1,000 se compte. L'écran le dit quand ça arrive, avec la taille de départ et la réduction.\n\nUn dessus qui tient déjà dans le cadre s'y pose à sa taille et rien n'est dit — le cas courant.",
  },

  "superposition.decalage": {
    nom: "décalage du dessus",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "De combien le dessus se déplace, en pixels de l'image rendue.",
    change:
      "Rien à la génération. Le signe suit l'écran : la touche qui monte fait monter l'image.",
    origine: "toi · proposé par le recalage",
    long:
      "Les touches sont dessinées sous chaque rail plutôt que listées dans une aide, et **elles sont aussi les boutons** : une seule chose à l'écran fait donc deux métiers — elle enseigne et elle agit. Un raccourci écrit dans une aide n'est jamais lu ; dessiné sous le réglage qu'il commande, il se voit au moment où on en a besoin. Maj multiplie le pas par dix.",
  },

  "superposition.main": {
    nom: "retoucher le masque d’extraction",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "Garder récupère les pixels du dessus que la différence a manqués ; Retirer efface ceux qui restent en trop sur le calque.",
    change: "Les traits corrigent le masque après la différence. Les deux images sources restent intactes.",
    origine: "toi · taille du pinceau réglable en pixels",
    long: "Déplacer ajuste le placement du dessus par glissement. Rectangle borne la comparaison. Garder et Retirer montrent le masque en cours, avec l’empreinte du pinceau. Ctrl + molette zoome ; Espace + glisser déplace la vue. Rouvrir un résultat retrouve ses deux sources, ses réglages et ses traits enregistrés.",
  },

  "superposition.seuil": {
    nom: "ce qu'on garde du dessus",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "De combien une couleur doit changer pour compter comme changée, et le rectangle hors duquel le dessus est masqué.",
    change:
      "Rien à la génération. **Le rectangle sert deux fois** : il isole la pièce pour qu'on voie le corps dessous pendant qu'on cale, et ce qu'il masque à l'écran, il le masque aussi à la sortie.",
    origine: "toi · aucun rectangle au départ, seuil 32",
    long:
      "Le seuil est un réglage qui décide **partout** ; le rectangle est un cadre qui décide **quelque part**. Les deux se complètent : le seuil fait le gros du travail d'un coup, le rectangle rattrape ce qu'une couleur ne pouvait pas voir — un casque sombre sur des cheveux sombres, par exemple, qu'aucun seuil ne distingue.",
  },

  "superposition.sorties": {
    nom: "ce qu'on en sort",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "Le calque — ce que le dessus ajoute, sur fond transparent — et l'aplat — les deux fondues en une.",
    change:
      "Les deux **se cochent au lieu de s'exclure** : on veut souvent le calque pour le réutiliser et l'aplat pour l'avoir tout de suite. Ce qui est fabriqué n'a rien coûté — l'argent a été dépensé deux fois, pour les deux images, et les deux filiations y mènent.",
    origine: "toi · le calque seul au départ",
    long:
      "Le calque est la pièce d'équipement : elle va au vestiaire du personnage et s'empile ensuite sur les autres poses. L'aplat est le personnage habillé, en une seule image, prêt à partir dans le jeu tel quel.\n\nCe qui sort a **deux ascendants** : ses pixels et son parent viennent du dessus, le dessous reste une référence. Sa recette est vide, les deux images étaient déjà rendues.",
  },

  "superposition.fond": {
    nom: "le fond du calque",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "Sur quoi on regarde le calque seul — le damier, ou l'un des cinq aplats vifs.",
    change:
      "Rien : c'est de l'affichage. Il sert à repérer les **pixels oubliés**, ceux qui auraient dû partir avec le corps et sont restés accrochés au calque.",
    origine: "toi · le damier au départ",
    long:
      "Sur le damier, les miettes de fond se confondent avec la transparence ; sur un aplat vif elles sautent aux yeux. La bonne couleur dépend de celles du sprite, d'où six fonds et pas un.",
  },

  "superposition.resultat": {
    nom: "le résultat",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "Le dessous à 100 %, le calque par-dessus — tel que ce sera dans le jeu.",
    change:
      "Rien : c'est une lecture. Maintenir « masquer le calque » le retire le temps de l'appui, et c'est ce qui dit si la pièce tient sur le corps.",
    origine: "les deux images, telles que tu les as calées",
    long:
      "Les trois vues sont **vivantes** : déplacer le dessus d'un pixel les met toutes à jour. C'est ce qui permet de caler en regardant le résultat plutôt que le travail, et c'est la raison d'être de cette disposition à trois panneaux.",
  },

  "superposition.mesures": {
    nom: "ce que la comparaison a mesuré",
    groupe: "La fabrique Superposition",
    ou: "tables",
    quoi: "Cinq nombres : silhouette, corps repeint, ajout, échelle, compacité.",
    change:
      "Rien. **Aucune ne refuse quoi que ce soit** — elles disent si la superposition a réussi, et servent à ranger les calques d'un vestiaire dans l'ordre où il faut les regarder. Le seul refus automatique du produit reste le compte d'images.",
    origine: "une mesure sur tes deux images",
    long:
      "**Silhouette** : ce qui reste du corps de départ, proche de 1 si la forme est gardée.\n\n**Corps repeint** : la part du corps changée hors de l'ajout — beaucoup veut dire un redessin plutôt qu'un habillage.\n\n**Ajout** : ce qui est apparu, en part du corps.\n\n**Échelle** : la taille du dessus au retour, 0,62 pour un dézoom.\n\n**Compacité** : proche de 1, un objet ; proche de 0, une poussière semée.",
  },

  // ── La fabrique Découpage — une planche multi-sprites, en rectangles ──────
  //
  // L'autre fabrique de `TABLES` (`interface/src/recette.ts`), rendue par
  // `Decoupe.tsx` et montée par `Retouche.tsx` — même origine que la
  // superposition ci-dessus, née sous `ou: "equipement"` sans jamais y être
  // atteignable (`GU8`). Groupée et vérifiée ici.
  //
  // **`decoupe.animation` racontait encore la décision `AU19`** (« on garde
  // d'abord, on range ensuite, depuis son atelier ») — retournée par `AU20`
  // (`Decoupe.tsx`) : personnage et mouvement se demandent maintenant ici,
  // pré-remplis depuis la feuille. Corrigée en relisant le code.

  "decoupe.mode": {
    nom: "Détection",
    groupe: "La fabrique Découpage",
    ou: "tables",
    quoi: "Comment les rectangles sont proposés : « auto » cherche les zones opaques, « grille » des cases égales, « gouttières » les bandes de fond.",
    change:
      "Ne découpe rien — propose. Ce qui part à la découpe est la liste que tu vois à droite, corrections à la main comprises. Changer ce réglage relance la détection et remplace ce que tu as dessiné.",
    origine: "toi · défaut auto",
    long:
      "Auto détoure d'abord : une planche fraîche est opaque de bord à bord, sa seule zone connexe serait l'image entière.\n\nGrille répond à une autre nature de planche — sprites qui se touchent, cases vides à conserver.\n\nGouttières lisent la brute telle quelle : bandes d'une seule couleur, coupées là.\n\nUne détection à une boîte, ou aucune, est un résultat, pas une panne.",
  },

  "decoupe.taille_min": {
    nom: "taille minimale",
    groupe: "La fabrique Découpage",
    ou: "tables",
    quoi: "En dessous de ce côté, en pixels, une zone opaque n'est pas un sprite.",
    change:
      "Monte-la pour ignorer les éclats de fond qui ont survécu au seuil ; descends-la pour rattraper un petit sprite oublié. Chaque cran relance la détection et remplace ce que tu avais dessiné.",
    origine: "toi · défaut 16 px",
    long:
      "Exprimé en côté et non en aire, parce que c'est ce que l'œil voit : « ignore ce qui fait moins de seize pixels ». La comparaison, elle, se fait sur l'aire — une lance de 4 × 200 pixels a un petit côté minuscule et reste un sujet.\n\nDeux morceaux séparés de moins de deux pixels sont réunis avant le rejet, jamais après.",
  },

  "decoupe.colonnes": {
    nom: "colonnes",
    groupe: "La fabrique Découpage",
    ou: "tables",
    quoi: "Le nombre de colonnes égales dans lesquelles la planche est coupée.",
    change:
      "Avec les lignes, décide du nombre de découpes proposées : colonnes × lignes, cases vides comprises. Le reste de la division se répartit — rien n'est jeté au bord droit.",
    origine: "toi · défaut 4",
    long:
      "Une planche de 1000 px en 3 colonnes donne 334, 333 et 333, et la dernière case va bien jusqu'au dernier pixel. Une division qui laisse tomber deux pixels laisse tomber une colonne de sprite au bord droit, et ça ne se voit qu'après découpe.",
  },

  "decoupe.lignes": {
    nom: "lignes",
    groupe: "La fabrique Découpage",
    ou: "tables",
    quoi: "Le nombre de rangées égales dans lesquelles la planche est coupée.",
    change:
      "Avec les colonnes, décide du nombre de découpes proposées. Une case vide donne quand même un rectangle : la grille fixe ne saute rien, et c'est ce qui la rend prévisible. Retire-le à la main si tu n'en veux pas.",
    origine: "toi · défaut 2",
  },

  "decoupe.animation": {
    nom: "en faire une animation",
    groupe: "La fabrique Découpage",
    ou: "tables",
    quoi: "Les mêmes rectangles, mais les cases deviennent les images d'une animation au lieu d'images séparées.",
    change:
      "Elles sont jouées dans l'ordre où elles sont numérotées, à 8 images par seconde, et l'atelier de l'animation s'ouvre juste après pour la régler. Rien n'est dépensé : l'image a été payée une fois, à son entrée.",
    origine: "toi",
    long:
      "Une feuille à plusieurs lignes est le plus souvent un jeu de directions : une ligne par direction. Le personnage et le mouvement visés se pré-remplissent depuis la feuille — vrai neuf fois sur dix — et se corrigent d'un clic avant de cliquer. L'atelier de l'animation s'ouvre juste après pour la régler.",
  },

  // ── La galerie — sa colonne, sa barre d'outils, son import ───────────────
  //
  // **Ce que la galerie choisit de sa grille** (RP11).
  // Quatre réglages, quatre entrées — « une entrée décrit un réglage, pas un
  // écran ». Ils sont ensemble parce qu'ils se règlent côte à côte, et chacun
  // dit surtout **ce qu'il ne fait pas** : c'est là que se logent les
  // malentendus d'une barre de filtres.
  //
  // **Tout l'écran est rangé ici depuis `GU12`**, dans l'ordre où on le
  // rencontre : la colonne de gauche, les filtres, l'import, puis l'atelier
  // du son. `fiche.recette` en est partie — son `aide=` est posé dans
  // `Fiche.tsx`, donc sur `ou: "case"`.
  //
  // ⚠️ **Les quatre `son.*` ne décrivent pas la galerie**, et aucun `ou`
  // ne leur va : `AtelierSon.tsx` et `ReglagesSon.tsx` s'ouvrent en
  // dialogue par-dessus la racine, et le guide montre donc celle-ci.
  // L'onglet *Sons* de la galerie est l'une de leurs deux portes (l'autre
  // est le bouton *Les sons* du codex). Groupées à part en attendant
  // `GU14`, qui donnera un écran au son. Même chose pour
  // `atelier.navigation`, qui décrit le châssis et non la galerie : elle
  // se pose sur l'écran d'ouverture du produit, faute d'un `ou` pour ce
  // qui se voit partout — un point pour `GU16`, comme `bande.cadre`.

  "atelier.navigation": {
    nom: "navigation repliée", ou: "galerie",
    groupe: "La colonne de gauche — la même sur tous les écrans",
    quoi: "Une colonne compacte pour passer du jeu à sa toile, ses assets, sa galerie, ses fabrications et sa livraison.",
    change: "Le bouton en haut replie la colonne sans retirer les destinations. Les familles et collections se rangent dans les assets ; les outils conservent leur place dans leurs ateliers.",
    origine: "toi · navigation dépliée au départ",
  },

  "galerie.role": {
    nom: "le rôle",
    ou: "galerie",
    groupe: "La barre d'outils — filtrer, trier, regrouper",
    quoi: "Ce qu'une image est dans l'atelier : une origine, une dérivée, un calque, un équipement, ou rien de tout ça.",
    change:
      "Ce que la grille montre. Une **origine** est une image dont d'autres sont sorties — une feuille découpée, une image dont on a tiré un miroir ; une **dérivée** est l'inverse. Ce filtre ne dit rien du sujet ni de la pose : ça, c'est la liste des familles juste à côté.",
    origine: "l'image elle-même",
  },

  "galerie.jugement": {
    nom: "le jugement",
    ou: "galerie",
    groupe: "La barre d'outils — filtrer, trier, regrouper",
    quoi: "Les favoris, ou ce qui ne l'est pas encore.",
    change:
      "Ce que la grille montre. Il n'y a que deux états parce que juger, ici, c'est marquer favori ou supprimer — et un supprimé n'est plus dans la bibliothèque. *Non jugés* est la question de cet écran : qu'est-ce que je n'ai pas encore regardé ?",
    origine: "toi, quand tu marques une image",
  },

  "galerie.tri": {
    nom: "l'ordre de la grille",
    ou: "galerie",
    groupe: "La barre d'outils — filtrer, trier, regrouper",
    quoi: "Plus récents, plus anciens, ou par nom. Le choix se retrouve à la prochaine ouverture.",
    change:
      "L'ordre de toute la bibliothèque, pas celui de la page. Le tri est fait par le serveur : sans ça, il ne trierait que les deux cents images déjà chargées, et « la plus ancienne » serait la plus ancienne des deux cents.",
    origine: "toi · défaut plus récents",
    long:
      "Par nom, ce qui n'a pas de nom passe après le reste. Beaucoup d'images n'en portent pas — le nom vient du prompt ou du fichier importé —, et les mettre en tête reviendrait à ouvrir la liste par ce qu'elle a de moins lisible.",
  },

  "galerie.regroupement": {
    nom: "regrouper",
    ou: "galerie",
    groupe: "La barre d'outils — filtrer, trier, regrouper",
    quoi: "Pose chaque image sous celle d'où elle vient : une feuille et ses cases tiennent une seule place.",
    change:
      "La place que prend la grille, jamais ce qu'elle contient. Un groupe replié compte ce qu'il montre, et un clic le déplie — rien n'est redemandé au serveur, tout est déjà là. Une image dont l'origine ne répond pas au filtre reste seule, à sa place : regrouper ne fait venir personne.",
    origine: "la filiation des images",
  },

  "atelier.import": {
    nom: "Importer",
    ou: "galerie",
    groupe: "Faire entrer une image — le bouton, ou un dépôt sur la grille",
    quoi: "Faire entrer une image de ton disque dans la bibliothèque — par le bouton, ou en la déposant sur la grille.",
    change:
      "Elle devient un asset entier : elle se retouche, se découpe, se réinjecte, s'exporte et se supprime comme celles que tu as payées. Sa fiche dit « importé » et un coût nul, et son nom est celui du fichier.",
    origine: "ton disque · le même geste que l'agent a depuis le serveur MCP",
    long:
      "Un appel part par fichier, sans attendre les autres : douze fichiers déposés font entrer onze images et nomment le douzième s'il n'en est pas une.\n\nSi les mêmes octets sont déjà dans ce projet, rien n'entre : un lien vers l'image existante paraît, avec « Importer quand même » toujours possible — projet par projet, la même référence pouvant servir ailleurs. Rien de tout cela ne coûte un centime.",
  },

  "atelier.import.traitement": {
    nom: "brute ou traitée",
    ou: "galerie",
    groupe: "Faire entrer une image — le bouton, ou un dépôt sur la grille",
    quoi: "Ce que le projet appliquera à l'image qui entre : rien du tout, ou sa recette — détourage, taille de pixel, palette.",
    change:
      "Sur « brute », l'image entre aux dimensions du fichier et sa recette reste vide — c'est le même mot que la visionneuse de la fiche, et il veut dire la même chose. Sur « traitée », elle arrive habillée comme une image générée ici.",
    origine: "toi · défaut « brute »",
    long:
      "Le choix vaut pour toute la séance, bouton et dépôt confondus, plutôt que de reposer la question à chaque fichier : douze fichiers déposés ensemble la poseraient douze fois.\n\nUne image entrée telle quelle le reste : « Tout réaligner » ne la touche pas, une recette vide étant un choix, pas un oubli — la même règle que pour un asset ramené au brut.",
  },

  // ⚠️ **`son.fabrication` ne décrit pas l'atelier du son** : la durée et le
  // moteur qu'elle porte sont ceux de `FabricationAudio.tsx`, ouvert depuis
  // *Fabrications*, jamais depuis l'onglet *Sons* de la galerie — vérifié le
  // 20 septembre 2026. Elle reste sous `ou: "galerie"` avec les trois
  // suivantes, en attendant l'écran du son de `GU14` ; seul son `groupe` est
  // corrigé pour ne pas prétendre le contraire.

  "son.fabrication": {
    nom: "durée et méthode sonore", ou: "galerie",
    groupe: "Demander un son — depuis Fabrications",
    quoi: "La durée vient des puces de la famille choisie ; le temps de calcul du moteur local se mesure à part, sur cette machine.",
    change: "La relecture conserve le texte exact, la version du workflow et ses paramètres. Un son reçu rejoint l’atelier son, même silencieux ou illisible, avec une vérification à faire.",
    origine: "toi · famille, durée et moteur choisis",
  },

  "son.coupe": {
    nom: "coupe du son", ou: "galerie",
    groupe: "L'atelier du son — ouvert depuis l'onglet Sons",
    quoi: "Le début et la fin conservés dans la source sonore, en secondes.",
    change: "Conserver une version produit un nouveau WAV sans modifier la source. Le lecteur peut revenir à la source ou à une ancienne version ; une sélection silencieuse reste à vérifier.",
    origine: "toi · source entière au départ",
  },

  "son.niveau": {
    nom: "niveau et fondus du son", ou: "galerie",
    groupe: "L'atelier du son — ouvert depuis l'onglet Sons",
    quoi: "Les fondus adoucissent les extrémités et la normalisation fixe la crête de tous les canaux ensemble.",
    change: "Les fondus se règlent en millisecondes, le niveau en décibels. La stéréo reste stéréo. Le gain vient après la normalisation ; une saturation empêche la livraison tant qu’elle n’est pas corrigée.",
    origine: "toi · fondus de 5 ms, gain nul",
  },

  "son.boucle": {
    nom: "boucle du son", ou: "galerie",
    groupe: "L'atelier du son — ouvert depuis l'onglet Sons",
    quoi: "Le passage à rejouer dans le son après la coupe et les fondus.",
    change: "Les repères sont conservés dans la ressource AudioStreamWAV pour Godot. Écoutez le raccord puis conservez la version avant de livrer ; les versions précédentes restent disponibles.",
    origine: "toi · lecture unique au départ",
  },

  // ── Les fournisseurs — l'onglet *Moteurs & workflows*, et l'installation ──
  //
  // Les huit autres fiches `assistant.*` sont parties en `GU7` : elles
  // décrivent les règles d'un jeu, pas l'atelier, et elles sont remontées
  // au bloc « Les règles du jeu » plus haut — sauf deux, retirées du corpus
  // parce que le réglage lui-même est mort (`assistant.ecran`,
  // `assistant.texte`).
  //
  // `reglages.consommation` a déménagé sous `ou: "sujet"` en `GU10` : elle
  // décrit `PanneauReglages.tsx` (monté par `BarreQuiPaie.tsx`) et
  // `Envoi.tsx`, jamais un onglet des réglages — elle rejoint `reglages.modele`
  // dans le groupe « La barre qui paie ».

  "assistant.fournisseurs": {
    nom: "Les fournisseurs, et ce qu'ils demandent",
    ou: "reglages",
    groupe: "Les fournisseurs — clés et comptes",
    quoi: "Un tiroir par fournisseur — une clé, un compte, un jeton, ou rien du tout — et ce qu'on y dépose n'est jamais redemandé.",
    change:
      "Un fournisseur à qui il manque quelque chose a ses modèles **grisés, avec leur raison** — mais l'atelier n'est pas éteint pour autant : l'un d'eux ne demande ni compte ni clé, et le bouton qui paie reste actif sur ses modèles à lui. Tu peux donc fabriquer une première image sur une machine où rien n'a été déposé. Ce que tu n'auras pas sans le fournisseur payant, c'est ce qui a besoin d'images de référence : le gratuit n'en accepte aucune, donc pas d'univers, pas de casting dans un style commun. Ce que tu déposes vaut pour tous tes jeux, pas seulement celui-ci.",
    origine: "toi · vide au départ · trois portes, une seule pièce",
    long:
      "Une clé n'apparaît jamais en entier : tu vois ses six derniers caractères. Celle qui vient de l'environnement de la machine ne se retire pas d'ici — l'atelier n'écrit pas là-dedans. La retirer grise les modèles de son fournisseur, et rien d'autre : ni une image, ni une ligne de dépense ne disparaît.",
  },

  "reglages.depenses": {
    nom: "Les dépenses",
    ou: "reglages",
    groupe: "Consommations",
    quoi: "Tous les appels, du plus récent au plus ancien : date, sujet, modèle, et ce qu'il a réellement consommé — réussi, raté ou interrompu.",
    change:
      "Rien du tout : on ne règle rien ici, on lit. Une image supprimée fait changer l'état de son appel, jamais disparaître sa ligne — **une dépense ne s'efface jamais**.",
    origine: "l'atelier, à chaque appel · rien à remplir",
    long:
      "Deux totaux ne comptent pas la même chose : celui de la barre du haut compte le jeu ouvert, celui d'ici compte l'atelier depuis le premier jour. Un appel gratuit qui consomme quand même dit **gratuit** dans la liste — jamais *0,00 $*, qui se lirait *sans limite* là où il faut lire *sans prix* — et ce qu'il a pris n'est jamais ajouté au total en argent.",
  },

  // ── La fiche d'une image — les cinq zones du panneau (`GU12`) ───────────
  //
  // Dans l'ordre où `Fiche.tsx` les montre : juger, la case du personnage,
  // ses découpages, ce que l'image est, et le pied. `fiche.recette` arrive
  // de `ou: "galerie"`, `tables.png` était déjà venue de `ou: "tables"` en
  // `GU5` — le lien *PNG ↓* n'existe que dans ce panneau-ci.
  //
  // **`fiche.recettes` est partie** : la liste des recettes nommées n'est
  // pas dans la fiche. Elle est dans le panneau de l'atelier d'une
  // animation (`AtelierDeBande.tsx`), seul endroit du dépôt qui
  // l'accroche — et dans celui de la retouche, qui n'accroche rien.

  "fiche.reinjecter": {
    nom: "Réinjecter",
    ou: "case",
    groupe: "Juger l'image — favori, réinjecter, supprimer",
    quoi: "Renvoyer cette image dans le générateur, dans l'un de ses quatre rôles.",
    change:
      "Trois rôles envoient l'image — référence (elle inspire), source d'édition (elle engendre), guide de style (elle donne la manière). Le quatrième n'envoie rien : il reprend le prompt, le modèle et les réglages de la génération qui a produit cet asset.",
    origine: "toi · le contrat de génération nomme les rôles",
    long:
      "Réinjecter ne coûte rien tant qu'on n'a pas cliqué Générer : le rôle se pose dans le panneau, et « Ce qui part » se met à jour. Le compte de références grimpe d'un cran, plafonné par le modèle choisi.\n\nLe quatrième rôle est le seul à toucher au prompt : il refait une image dont on a perdu les réglages, le geste le plus courant après un tri.",
  },

  "fiche.personnage": {
    nom: "Corps de",
    ou: "case",
    groupe: "Corps de — à quelle case du personnage elle sert",
    quoi: "Le personnage et l'attitude dont cette image est le corps.",
    change:
      "Rien à la génération. La case correspondante cesse d'être vide dans l'écran Personnages, et l'image y paraît en vignette — elle ne bouge pas de la bibliothèque pour autant.",
    origine: "toi · le plan d'attitudes vient du projet",
    long:
      "Un corps naît dans l'atelier, nulle part ailleurs : on écrit un sujet, on génère, et c'est ici qu'on dit ce qu'elle est. Aucun écran de création n'a son propre prompt — ce qui suit repose sur une image dont la grille et la palette sont connues.\n\nLes attitudes proposées sont celles de ce personnage, jamais du jeu entier. Retirer la désignation laisse l'image intacte : sa case redevient vide.",
  },

  // P1c (V3.5) : le retour en arrière du dépliage.
  "fiche.depliages": {
    nom: "Ses découpages",
    ou: "case",
    groupe: "Ses découpages — refaire le découpage d'une planche",
    quoi: "Comment cette planche a été coupée en images, et refaire ce découpage quand il est tombé mal.",
    change:
      "Un nouveau découpage fait ses propres images ; les précédents restent. Supprimer un découpage ne touche ni la planche ni les autres.",
    origine: "toi · tu corriges les coupes que l'atelier propose",
    long:
      "Le premier découpage se fait tout seul dès que la planche revient — rien à demander. Le refaire est un geste qu'on demande : l'atelier repropose les mêmes coupes, tu les déplaces, en ajoutes, en retires, puis tu valides, autant de fois que tu veux, sans jamais perdre les images déjà sorties d'un découpage précédent.",
  },

  "fiche.impose": {
    nom: "Imposé par le jeu",
    ou: "case",
    groupe: "Ce que l'image est — imposé par le jeu, sa recette",
    quoi: "Ce que l'univers de ton jeu a appliqué à cette image-là — la taille de pixel, la part de case qu'elle occupe, la palette.",
    change:
      "Rien : c'est une lecture. Chaque ligne dit si la valeur du jeu est encore appliquée ou si tu l'as réglée à la main depuis, et les huit places en dessous sont l'endroit où l'on change.",
    origine: "l'univers du jeu, tel qu'il est maintenant · l'échelle demandée à la naissance",
    long:
      "Sans cette rubrique, une image ne ressemblerait pas au rendu du modèle, sans savoir pourquoi : la remise sur grille et la quantification s'appliquent à la naissance, en silence.\n\nCalculée à la lecture plutôt que rangée avec l'image — la question est « qu'est-ce que le jeu impose *maintenant* » —, elle dit « on ne sait pas » si la génération n'est plus sur le disque.",
  },

  "fiche.recette": {
    nom: "Sa recette",
    ou: "case",
    groupe: "Ce que l'image est — imposé par le jeu, sa recette",
    quoi: "Les places du traitement qui sont posées sur cette image, avec ce que chacune vaut.",
    change:
      "Rien : c'est une lecture. La fiche dit ce que l'image est ; les tables disent ce qu'on lui fait, et c'est là qu'on la règle — sur l'image en grand, ce que 380 pixels de colonne ne permettaient pas.",
    origine: "l'image elle-même",
  },

  "tables.png": {
    nom: "PNG ↓",
    ou: "case",
    groupe: "Au pied de la fiche — les deux portes, et le PNG",
    quoi: "Télécharge l'image telle qu'elle est sous les yeux — le rendu, ou le brut quand on regarde le brut.",
    change:
      "Rien : c'est une copie. L'image reste dans la bibliothèque, sa recette aussi, et le fichier reçu est celui qu'on voyait.",
    origine: "l'état courant de la table",
  },

  // ── Commander un clip (A9) ────────────────────────────────────────────────
  //
  // **Déplacées sous `ou: "clip"` en GU11** (`docs/PLAN-guide.md`) : posées
  // sous `ou: "sujet"` depuis GU6 au motif que « c'est de là qu'on ouvre
  // l'écran », elles décrivent pourtant `Clip.tsx` au mot près — l'image de
  // départ, le format, le lot, le prix, la carte de la machine, ce qui est
  // mesuré. Ouvrir le guide *depuis Clip.tsx* ne les montrait jamais : la
  // pile de lieux route cet écran vers `"clip"` (`lieux.ts`, genre `clip`),
  // pas vers `"sujet"`. *Un lieu, pas un thème* voulait déjà dire l'écran
  // qu'on a sous les yeux, pas celui d'où l'on est venu. Le mouvement, lui,
  // reste dans les réglages — on l'écrit là-bas, on le choisit ici.

  "clip.depart": {
    nom: "L'image de départ",
    ou: "clip",
    groupe: "Commander un clip",
    quoi: "La première image du clip — celle que le modèle va animer, et il n'en prend qu'une.",
    change:
      "Tout ce à quoi le clip ressemblera. **Elle est obligatoire et ne cède jamais** : sans elle il n'y a pas d'appel du tout, là où les images jointes d'une génération ordinaire s'effacent quand le modèle n'a plus de place. Le clip n'hérite de rien d'autre — ni des textes du jeu, ni de son ambiance.",
    origine: "l'atelier propose · tu changes d'un clic",
    long: "L'atelier propose l'image de la case visée si elle en a une, sinon le portrait du personnage — l'image promue en référence, ou le corps de sa première attitude. Ce n'est qu'une proposition : n'importe quelle image de ta bibliothèque la remplace d'un clic. Ce qui part n'est pas le sprite tel quel : il est agrandi sur la toile du format demandé, sinon le modèle inventerait ce qu'il ne voit pas.",
  },

  "clip.format": {
    nom: "Le format du clip",
    ou: "clip",
    groupe: "Commander un clip",
    quoi: "Sa durée, ses proportions et sa taille — les trois choses qui décident du prix.",
    change:
      "Le prix, à chaque cran. Un modèle vidéo se facture au **jeton vidéo** — hauteur × largeur × images par seconde × durée —, donc la surface compte autant que le temps : le carré coûte près de moitié moins que le format large, et il cadre mieux un personnage seul.",
    origine: "toi · 5 secondes, carré, petit format",
    long: "Cinq secondes plutôt que quatre, et c'est mesuré : quatre suffisent à un cycle de marche seul, mais le geste de la version est d'en tirer **plusieurs animations dans un clip**, et il faut de la place pour les transitions entre elles.\n\nUn modèle qui ne sait pas faire la durée que tu demandes se grise avec sa raison plutôt que de disparaître : ce qui est impossible se voit avant d'être choisi.",
  },

  "clip.lot": {
    nom: "Combien de clips",
    ou: "clip",
    groupe: "Commander un clip",
    quoi: "Le nombre de clips que ce geste lance d'un coup. Un est le défaut.",
    change:
      "Le prix, multiplié d'autant, et le bouton l'annonce avant. **Chacun est une dépense à part** : quatre clips coûtent quatre fois, et l'écran des dépenses le dira quatre fois — y compris pour ceux que tu jetteras.",
    origine: "toi · un clip",
    long: "Un même texte ne rend jamais deux fois le même clip : en lancer plusieurs et n'en garder qu'un est le geste ordinaire, et « garder celui-ci » écarte les autres du même lot. Les clips écartés quittent la galerie, jamais le journal — un lot de quatre coûte quatre fois, et le journal le montre. Rien n'expire : un clip écarté reste là, et se rend quand tu veux, contrairement à une image jetée.",
  },

  "clip.prix": {
    nom: "Le prix du clip",
    ou: "clip",
    groupe: "Commander un clip",
    quoi: "Ce que le clip devrait coûter, avec la formule qui produit ce chiffre.",
    change:
      "Rien à ce qui part. C'est une **borne haute** affichée avant l'envoi : ce qui s'enregistre après est le montant que le fournisseur a facturé, et l'écart mesuré sur treize clips va de quatre pour cent de plus à cinquante-huit pour cent de moins.",
    origine: "relu chez le fournisseur, à chaque changement de format",
    long: "La formule dit le tarif, la surface, la cadence facturée et la durée — de quoi vérifier le calcul sur la page du modèle. Un modèle dont le tarif n'a pas pu être relu est grisé avec sa raison : un clip se fait attendre deux minutes, proposer sans le savoir serait à l'aveugle. Un modèle de la liste ne coûte rien : il tourne sur cette machine, le bouton annonce un temps à la place d'un prix.",
  },

  "clip.moteur": {
    nom: "La carte de cette machine",
    ou: "clip",
    groupe: "Commander un clip",
    quoi: "Ce que ton ordinateur peut faire lui-même, et ce qu'il lui manque pour ça.",
    change:
      "Rien à ce qui part. Ce panneau ne dépense jamais d'argent — il regarde ce que l'application du moteur a sur son disque, et il te dit si le modèle gratuit est utilisable maintenant.",
    origine: "relu à chaque ouverture de cet écran",
    long: "Trois choses peuvent manquer. L'application du moteur fermée empêche tout : ouvre-la, reviens, le grisé tombe seul. Des fichiers manquants laissent le modèle choisissable — l'atelier les rapatrie, en disant poids et licence avant de lancer quoi que ce soit. Le greffon des gros pixels manquant n'est qu'un avertissement : le clip sort lissé, et un téléchargement coupé reprend où il s'est arrêté.",
  },

  "clip.mesure": {
    nom: "Ce qui est mesuré",
    ou: "clip",
    groupe: "Commander un clip",
    quoi: "Ce que ce dépôt-ci a observé du modèle en payant ses propres essais, et rien d'autre.",
    change:
      "Rien à ce qui part. C'est ce qui te permet de choisir en sachant sur quoi tu t'appuies — **aucun modèle proposé n'atteint la barre des huit tirages** : ce sont des propositions étayées, pas un arbitrage clos.",
    origine: "les essais payés du dépôt · vide quand rien n'a été mesuré",
    long: "Aucun fournisseur ne déclare ça, et un écran qui proposerait deux modèles sans le dire ferait passer une hypothèse pour un résultat.\n\nVide veut dire *on n'en sait rien*, et l'écran l'écrit plutôt que de laisser croire qu'un modèle proposé a été éprouvé.",
  },

  "clip.liste": {
    nom: "La liste de modèles",
    ou: "clip",
    groupe: "Commander un clip",
    quoi: "L'ordre dans lequel les modèles se présentent, et le filtre qui range ce qui ne peut pas partir.",
    change:
      "Ce que tu lis d'abord, et à quel point la liste te laisse tranquille. **L'ordre vient du serveur** — le modèle gratuit en tête, puis les payants du moins cher au plus cher pour la demande courante — et l'interrupteur, allumé, ne montre que ce qui peut partir.",
    origine: "le serveur trie · tu filtres",
    long: "Le tri suit le prix du clip en cours (durée, format, résolution) — pas de règle à part, pour que deux endroits ne finissent pas par trier différemment. « Seulement ce qui peut partir » est allumé par défaut ; éteint, les cartes grisées reparaissent, chacune dépliable pour lire pourquoi elle ne peut pas partir. Une carte repliée montre son nom et son estimation — assez pour comparer.",
  },

  "clip.confirmation": {
    nom: "Ce qui part avec le clip",
    ou: "clip",
    groupe: "Commander un clip",
    quoi: "Le tiroir qui s'ouvre entre « Commander ce clip » et la dépense : la dernière relecture, corrigeable.",
    change:
      "Ce qui va partir. **Le texte, mot pour mot, et l'image de départ — rien d'autre.** Une correction faite ici vaut pour cet appel seulement, et ne touche jamais au mouvement de la bibliothèque.",
    origine: "le mouvement choisi et l'image de départ · ta correction éventuelle",
    long: "Un clip n'emporte qu'une image et un texte, jamais plus : l'image se change, elle ne se retire pas. Le texte se corrige pour cet appel seul — le mouvement de la bibliothèque ne bouge pas, « remettre le texte » le redonne intact ; le corriger pour tous les clips suivants se fait dans les Réglages. Le bouton porte le montant du lot, ou le temps chez le moteur de la maison.",
  },

  "clip.fiche": {
    nom: "La fiche d'un clip",
    ou: "clip",
    groupe: "La fiche du clip, une fois lancé",
    quoi: "La colonne de droite d'un clip, comme la fiche d'une image — pour ce que la galerie garde sans que ce soit une image.",
    change:
      "**La vidéo du clip, en boucle** — son rythme, ses fondus, ce qu'il fait entre deux images —, ce qu'il a coûté, ce qu'il anime, ce qu'il a produit, et la porte du montage. **Rien ici ne dépense** : le clip est déjà payé, et garder ou jeter restent les gestes de la grille.",
    origine: "le clip, tel qu'il est arrivé · les bandes qu'on en a déjà taillées",
    long: "La vignette est la **vidéo elle-même**, pas une image rejouée : jeu, pause, barre de lecture. Elle dit ce que le clip porte, ce qu'il a coûté **et si ce montant a été relu chez le fournisseur**, ce qu'il anime, et le sprite de départ. Les bandes déjà gardées s'y lisent aussi, chacune ouvrant son atelier.",
  },

  // ── Le montage : découper un clip en bandes (A10) ─────────────────────────
  //
  // **Trois fiches neuves en GU11** : `montage.boucles`, `montage.pellicule`
  // et `montage.propositions` décrivent des zones réelles de `Montage.tsx`
  // qui n'avaient encore aucune fiche — le seul des trois écrans de la
  // tranche qui en manquait plutôt que d'en réécrire. `bande.nom` est
  // déplacée sous `ou: "montage"` : wirée uniquement dans `Montage.tsx`,
  // jamais dans l'atelier d'une bande.

  "montage.boucles": {
    nom: "Les deux boucles",
    ou: "montage",
    groupe: "Les deux boucles — juger le mouvement, juger le découpage",
    quoi: "Deux vignettes côte à côte, sur un même métronome : ce que le modèle a rendu, et les images qu'on a retenues.",
    change:
      "Rien à la génération. Juger un mouvement et juger un découpage sont deux métiers : les séparer évite de trancher les deux au jugé d'une seule image.",
    origine: "le clip payé · les images qu'on a retenues jusqu'ici",
    long: "Elles tournent à la même vitesse, sur le même pas : au banc, chacune démarrait quand elle avait fini de charger, jamais en phase avec sa voisine. « la vidéo entière › » bascule la première boucle sur le clip tel qu'il est arrivé — son rythme, ses fondus — plutôt que sur les images figées rejouées à la vitesse de la bande.",
  },

  "montage.pellicule": {
    nom: "La pellicule",
    ou: "montage",
    groupe: "La pellicule — prendre et laisser une image",
    quoi: "Le ruban de toutes les images du clip ; un clic en prend ou en laisse une, la loupe suit ce qu'on regarde.",
    change:
      "Ce qui sera monté, dans l'ordre où on les prend. « Prélever » range une image en bibliothèque sans toucher au découpage en cours.",
    origine: "la planche contact du clip",
    long: "Les flèches déplacent le curseur, espace prend ou laisse l'image visée — le clavier fait tout ce que fait la souris, pour un geste qui se répète des dizaines de fois par clip. « Prélever » est un second geste, séparé : il met une image de côté pour la regarder, sans l'ajouter au découpage.",
  },

  "montage.propositions": {
    nom: "Des propositions gratuites",
    ou: "montage",
    groupe: "Des propositions gratuites",
    quoi: "Des découpages tout faits, à poser d'un clic — régulier, repartir de zéro, inverser l'ordre.",
    change:
      "Remplace les images retenues par la proposition choisie. Rien n'est décidé pour de bon : chaque image se corrige ensuite, une par une.",
    origine: "calculées sur le clip ouvert · gratuites",
    long: "Elles ne remplacent pas le jugement, elles évitent de partir d'un ruban vide. « Repartir de zéro » vide la sélection pour choisir une par une ; « inverser l'ordre » rejoue les images retenues à l'envers, utile pour un aller-retour tapé à la main.",
  },

  "bande.nom": {
    nom: "Le nom de l'animation",
    ou: "montage",
    groupe: "Cette animation — son nom",
    quoi: "Comment cette animation-là s'appellera, une fois tirée du clip.",
    change:
      "Ce que tu liras dans la liste des bandes, et ce qui partira dans le descriptif de l'export. **Un clip en porte plusieurs** : un même tirage donne souvent un repos et une marche, et sans nom tu ne saurais plus laquelle est laquelle.",
    origine: "l'atelier propose le mouvement demandé · tu écris ce que tu veux",
    long: "Une bande se garde sous un nom, toujours : c'est la seule chose que l'écran exige.\n\nLa case qu'elle remplit, elle, est facultative. **Une bande sans case est un brouillon, et un brouillon ne bloque rien** — tu gardes d'abord, tu ranges ensuite, comme partout ailleurs dans l'atelier.",
  },

  // **`bande.main` et `bande.historique` déplacées sous `ou: "bande"` en
  // GU6**, réécrites et zonées en GU11 : la Table de retouche → Main et
  // l'historique de gestes vivent dans le même atelier d'une bande que
  // `bande.position` et `bande.remplacer` — pas la fiche d'un sujet.
  "bande.main": {
    nom: "Retoucher une frame à la main",
    ou: "bande",
    groupe: "Retoucher une frame à la main",
    quoi: "Peindre ou gommer la frame affichée, avec son propre masque et ses calques de dessin.",
    change: "Une seule frame. Le début du trait arrête la lecture sur l’image touchée ; les autres frames gardent leurs retouches.",
    origine: "atelier de l’animation · Table de retouche → Main",
    long: "Les traits se posent après le placement de la frame : le pixel sous le pinceau est celui qui sera modifié, même si l’image a bougé. Le masque contrôle la transparence ; les calques ajoutent des couleurs, les masquent ou les renomment. Remplacer la source de cette frame efface ses retouches — les coordonnées ne désignent plus la même image. Enregistrer les conserve après fermeture.",
  },
  "bande.historique": {
    nom: "Défaire et refaire une correction",
    ou: "bande",
    groupe: "En haut de l'écran — défaire, refaire, le brouillon",
    quoi: "Revenir sur les corrections de la session, puis les rétablir.",
    change: "Le montage, les recettes, la Main, la cadence et la boucle. La lecture et le zoom ne créent pas d’étape dans cet historique.",
    origine: "Défaire / Refaire · Ctrl + Z / Ctrl + Maj + Z · Ctrl + S pour enregistrer",
    long: "Les changements restent des essais jusqu’à Enregistrer. L’historique permet de parcourir les quatre-vingts derniers états de cette session. Annuler revient au dernier état enregistré. À la réouverture, la bande reprend ses corrections enregistrées ; un brouillon non enregistré peut être repris explicitement. L’historique de gestes démarre une nouvelle session.",
  },
  // ── Les trois gestes de la frame — RP22, la section « Position, source et
  //    pelure d'oignon » ne disait ni ce qu'elle faisait ni comment s'en
  //    servir. Trois entrées plutôt qu'une : chaque geste a la sienne, comme
  //    le veut G3, au lieu d'une phrase unique qui aurait mélangé trois choses
  //    différentes.
  "bande.position": {
    nom: "Déplacer une image dans son cadre",
    ou: "bande",
    groupe: "La frame choisie — position, remplacer, pelure d'oignon",
    quoi: "Les flèches du clavier poussent l'image choisie d'un pixel du sprite ; avec Majuscule, de cinq.",
    change:
      "Cette image-là seule, dans sa case. Rien d'autre ne bouge, et rien n'est écrit avant Enregistrer.",
    origine: "toi · atelier de l'animation",
    long: "Aux bords, les flèches cessent d'avoir un effet plutôt que de rogner l'image : une correction qui mangerait un bras ne se verrait pas ici, et se découvrirait dans le jeu. « Remettre cette image droite » efface la poussée et revient à zéro, sans toucher aux autres images de l'animation.",
  },

  "bande.remplacer": {
    nom: "Remplacer la source d'une frame",
    ou: "bande",
    groupe: "La frame choisie — position, remplacer, pelure d'oignon",
    quoi: "Choisir une autre image du même clip, ou d'un clip voisin du même personnage, pour la case choisie.",
    change:
      "Rien n'est payé : le clip est déjà réglé, et il porte déjà toutes ses images. Une recette posée en regardant l'ancienne image ne suit pas — elle désignait un endroit qui n'existe pas forcément au même endroit sur la nouvelle.",
    origine: "toi · le clip et ses voisins",
    long: "La liste des clips ne montre que ceux du même personnage : un clip d'ailleurs donnerait une animation où le sujet change au milieu. Elle ne paraît pas s'il n'y en a qu'un — un menu à un seul choix n'est pas un choix.",
  },

  "bande.pelure": {
    nom: "Voir l'image précédente en transparence",
    ou: "bande",
    groupe: "La frame choisie — position, remplacer, pelure d'oignon",
    quoi: "Superposer l'image d'avant à celle qu'on règle, avec un curseur d'opacité.",
    change: "Rien à l'animation : c'est un repère pour l'œil, jamais enregistré.",
    origine: "toi · les images voisines de l'animation",
    long: "C'est ce qui permet de juger un déplacement au lieu de le deviner : à zéro pour cent, rien ne se voit ; monté, l'image d'avant apparaît en fondu derrière celle qu'on corrige.",
  },

  // **Rétrécie en GU11** : le texte listait cinq écrans (retouche,
  // extraction, découpe, montage, fabrication vidéo) — le même mécanisme
  // que `retouche.brouillon` couvre déjà pour les trois premiers. Cette
  // fiche-ci vit sous `ou: "bande"` ; elle ne parle donc que de ce que
  // l'atelier d'une bande et le montage en font.
  "atelier.brouillon": {
    nom: "Reprendre des réglages non enregistrés",
    ou: "bande",
    groupe: "En haut de l'écran — défaire, refaire, le brouillon",
    quoi: "Conserver un brouillon sur cet ordinateur quand on quitte l'atelier d'une bande ou le montage sans enregistrer.",
    change: "Reprendre restaure les réglages dans l'écran. Cela n'enregistre pas l'animation et ne lance aucun appel à un modèle.",
    origine: "Brouillon conservé · Reprendre le brouillon / Abandonner le brouillon",
    long: "Le brouillon est séparé de la version enregistrée. Au retour, on le reprend ou on l'abandonne ; si la version enregistrée a changé entretemps, un message le dit avant la reprise. Enregistrer la bande, ou garder une animation depuis le montage, termine ce brouillon.",
  },
  // **Déplacée sous `ou: "sujet"` en GU11** : son propre `origine` le disait
  // déjà — « Ses animations » — l'onglet de `PageDuSujet.tsx` qui rend
  // `AnimationsDuSujet.tsx`, pas l'atelier d'une bande. `GU6` avait réécrit
  // six zones de la fiche d'un sujet sans repérer celle-ci.
  "bande.galerie": {
    nom: "Parcourir et juger les animations",
    ou: "sujet",
    groupe: "Ses animations",
    quoi: "Une pose ou un mouvement repliable, puis une rangée par direction ; une galerie en grand se filtre en dessous.",
    change: "Le jugement distingue la retenue, les versions à juger et les écartées. Les filtres changent uniquement la vue.",
    origine: "Ses animations · Mouvement / Direction / Jugement",
    long: "La retenue reste à gauche, les essais arrivent à sa suite, puis les écartées à droite. La flèche des écartées les masque sans les supprimer. Survole une vignette ou donne-lui le focus au clavier pour voir toute son animation dans son cadre commun. Ouvrir une animation puis revenir retrouve la sélection et les filtres du sujet.",
  },
  // **Déplacée sous `ou: "montage"` en GU11** : son propre `origine` le
  // disait déjà — « montage vidéo · Classement de l'animation » — le
  // fieldset de `Montage.tsx`, pas l'atelier d'une bande.
  "bande.destination": {
    nom: "Classer une animation",
    ou: "montage",
    groupe: "Classement de l'animation",
    quoi: "Choisir le personnage, son mouvement et sa direction indépendamment du nom libre de l’animation.",
    change: "La case où l’animation se retrouve. Son clip source, son montage et ses retouches restent conservés.",
    origine: "montage vidéo · Classement de l’animation",
    long: "Aucun personnage laisse un brouillon libre. Un personnage sans mouvement laisse un brouillon dans sa fiche. Les choix viennent du jeu et du personnage : une direction rangée n’est pas reproposée. Reclasser une animation ne régénère aucune image. Les équipements liés à l’ancien porteur ou à l’ancienne case demandent une nouvelle vérification.",
  },

  "bande.cadre": {
    nom: "Le cadre de la bande",
    ou: "bande",
    groupe: "Le cadre — la fenêtre commune",
    quoi: "Le rectangle sur lequel toutes les images de la bande sont recadrées.",
    change:
      "La taille à laquelle ton personnage sort, et **si elle reste la même d'une animation à l'autre**. Pris sur le clip entier, toutes les bandes de ce clip ont la même assise ; pris sur la bande seule, elles ne s'accordent plus entre elles.",
    origine: "mesuré par l'atelier · repris à la main si besoin",
    long: "Sans cadre commun, chaque image se recadre sur sa propre silhouette — un bras tendu l'agrandit, donc réduit le personnage. Une fenêtre par bande cale les images entre elles ; il en faut une par clip pour caler les bandes entre elles, d'où « du clip » par défaut. Les deux autres existent : un cadrage automatique se trompe parfois, et une bande où le personnage quitte le champ a besoin du sien.",
  },

  // **Déplacée sous `ou: "montage"` en GU11** : wirée uniquement dans
  // `Montage.tsx` (« le pivot — le point d'ancrage dans le jeu »), jamais
  // dans l'atelier d'une bande — l'écran de reprise le lit, il ne le règle
  // pas (§ *le cadre s'y lit et ne s'y règle pas* de `Montage.tsx`).
  "bande.pivot": {
    nom: "Le pivot de l'animation",
    ou: "montage",
    groupe: "Le pivot — le point d'ancrage dans le jeu",
    quoi: "Le point de la case sur lequel le sprite s'aligne dans le jeu.",
    change:
      "L'endroit où ton personnage touche le sol dans le moteur — décalé, il flotte ou s'enfonce. Sans réglage, l'animation garde le repère déjà déclaré pour ce mouvement.",
    origine: "le repère du mouvement · posé à la main si besoin",
    long: "Deux champs, et ils se règlent ensemble : vider l'un efface aussi l'autre, parce qu'un point n'a pas qu'une coordonnée. Le laisser vide n'est pas un oubli — c'est l'animation qui suit son mouvement, comme toutes celles qui n'ont jamais touché ce champ.",
  },

  // **Le codex, plus la galerie** : depuis la V3.03, le montage ne règle
  // aucun traitement — il taille le mouvement —, et la recette d'une
  // animation se règle dans son atelier, qui s'ouvre depuis la matrice d'un
  // personnage.
  // **Déplacée sous `ou: "bande"` en GU6**, retaillée en GU11 : le « à
  // savoir » dépassait 2 750 signes. Les deux règles datées qu'il racontait
  // (3 et 5 septembre 2026) et le détail du comportement à l'échange d'une
  // frame rejoignent `docs/design-decisions.md` ; ce qui reste ici est ce
  // qu'on fait aujourd'hui, pas pourquoi.
  "bande.recette": {
    nom: "La recette du découpage",
    ou: "bande",
    groupe: "La recette — détourer, réduire, limiter les couleurs",
    quoi: "Ce qu'on fait aux images du clip pour en tirer des sprites : détourer, réduire, limiter les couleurs.",
    change:
      "L'aspect de la bande, et rien d'autre. **Trois échelles possibles** — le jeu, la bande, une image ou plusieurs — et elle ne remplace jamais celle du dessus : ce que tu changes ici s'écrit sur cette bande-là, ton jeu ne bouge pas, et la bande suivante repart du jeu. Une retouche à la main ne se remplace jamais par une recette enregistrée.",
    origine:
      "celle du jeu · celle de la bande · celle d'une image ou de plusieurs",
    long: "On règle une image, plusieurs choisies (clic, maj-clic, ctrl-clic, « toutes »), ou l'animation entière — jamais le jeu, qui reste un point de départ. Un curseur ne déplace que sa valeur ; une recette enregistrée remplace tout l'ensemble, et l'écran dit avant combien d'images vont perdre la leur. La Main, elle, ne se remplace jamais.",
  },

  "fiche.recettes": {
    nom: "Recettes",
    ou: "bande",
    groupe: "La recette — détourer, réduire, limiter les couleurs",
    quoi: "Les recettes que tu as nommées, à reposer sur cette image d'un clic.",
    change:
      "Applique les huit places d'un coup, sans un appel payant. Une recette nommée réappliquée ailleurs donne exactement le même résultat — c'est un critère du produit, et rien dans le traitement ne tire au sort.",
    origine: "toi, en nommant · aucune au départ",
    long:
      "Une recette est nommée par son empreinte autant que par toi : deux recettes égales sont interchangeables. L'empreinte est rangée à côté de l'image, avec son rendu ; un rendu dont l'empreinte ne correspond plus est traité exactement comme un fichier absent, et se refait à la première lecture. Reposer une recette déjà appliquée ne recalcule donc rien.\n\nUne recette vide ne s'enregistre pas — elle n'aurait rien à rejouer.\n\nDans l'atelier d'une animation, elle **remplace tous les réglages à la fois** : une recette est un ensemble, et en prendre la moitié rendrait une image que personne n'a jamais jugée. Comme le reste de cet écran, elle n'écrit rien tant que tu n'as pas enregistré.",
  },

  // **Déplacée sous `ou: "montage"` en GU11** : wirée uniquement dans
  // `Montage.tsx` (« le jeu » — cadence et sens), jamais dans l'atelier
  // d'une bande.
  "bande.vitesse": {
    nom: "La vitesse de la bande",
    ou: "montage",
    groupe: "Le jeu — cadence et sens",
    quoi: "Combien d'images par seconde, et dans quel sens elles se jouent.",
    change:
      "L'aperçu que tu regardes **et** ce qui partira dans ton moteur de jeu. C'est le même réglage : deux — un pour regarder, un pour livrer — finiraient par se contredire, et c'est toi qui découvrirais l'écart dans le jeu.",
    origine: "proposée par le mouvement · réglée ici",
    long: "*En boucle* : la dernière image est suivie de la première. *Aller-retour* : on repart en arrière au lieu de sauter au début — ce qui double la durée sans doubler les images, et qui est la bonne réponse pour un balancement, une respiration, une flamme.\n\nIl n'y a pas de *une seule fois* : ce n'est pas une propriété de la bande, c'est une décision de ton moteur au moment où il la joue.",
  },

  // **Déplacée sous `ou: "montage"` en GU11** : wirée uniquement dans
  // `Montage.tsx` (« gardées de ce clip »), jamais dans l'atelier d'une
  // bande.
  "bande.gardees": {
    nom: "Les bandes de ce clip",
    ou: "montage",
    groupe: "Les bandes déjà gardées de ce clip",
    quoi: "Ce que tu as déjà tiré de ce tirage-ci.",
    change:
      "Le prix par animation, qui **baisse à chaque bande gardée**. Un clip de cinq secondes porte plus qu'un cycle de marche, et c'est ce compteur qui te dit ce que tu as vraiment payé pour une animation utilisable.",
    origine: "ce que tu as gardé",
    long: "Effacer une bande n'efface ni le clip ni ses images : un découpage raté ne coûte rien. C'est toute la différence avec l'autre moitié de l'atelier, où jeter une image est jeter de l'argent.\n\nLe prix par bande est le seul chiffre que la version ne connaissait pas d'avance : combien de clips faut-il pour une animation utilisable. Il se remplit à l'usage, ici.",
  },

  // **`bande.chutier` et `bande.montage` déplacées sous `ou: "bande"` en
  // GU6**, retaillées et zonées en GU11 : toutes deux accrochées dans
  // `AtelierDeBande.tsx`, au même titre que `bande.gardees` avant son
  // départ vers `ou: "montage"` — pas la fiche d'un sujet.
  "bande.chutier": {
    nom: "Le chutier",
    ou: "bande",
    groupe: "Le chutier, et reprendre le montage",
    quoi: "La réserve d'une animation : les images mises de côté, pas encore posées dans le ruban.",
    change:
      "Ce que tu retires du ruban y va **avec sa recette**, au lieu de disparaître. Retirer cesse d'être un geste qu'on hésite à faire : l'image est à côté, elle se repose où tu veux, et rien n'est perdu.",
    origine:
      "les images que tu retires du ruban · celles que tu vas chercher dans le clip",
    long: "Deux chemins le remplissent : retirer une image du ruban, ou « prendre des images dans le clip » pour aller chercher ce qui manque dans toute la pellicule. Les boutons avant/après la reposent à côté de l'image que les tables règlent, pas de celle qui joue. Une image est dans la bande ou au chutier, jamais les deux, et il se garde avec l'animation d'une visite à l'autre.",
  },

  "bande.montage": {
    nom: "Reprendre le montage",
    ou: "bande",
    groupe: "Le chutier, et reprendre le montage",
    quoi: "Rouvrir la pellicule du clip sur une animation déjà gardée, pour en changer les images retenues.",
    change:
      "Ce que l'animation contient. Ce que tu gardes **retrouve ses réglages** — sa poussée au pixel, sa recette à elle — et ce que tu laisses tombe au chutier. Rien n'est perdu, et tu n'as rien à reposer de mémoire.",
    origine: "l'animation telle qu'elle est gardée",
    long: "Le bouton du bas dit ce qu'il fait — *Reprendre « marche »* — et revenir sans le presser laisse l'animation telle quelle. Deux cas où il est fermé : des corrections de l'atelier attendent (enregistre d'abord), ou l'animation prend ses images dans plusieurs clips. Le cadre s'y lit et ne s'y règle pas : il se reprend dans l'atelier de l'animation.",
  },

  "agent.cadre-durable": {
    nom: "Le cadre de délégation du jeu",
    quoi: "Le jeu conserve les méthodes et les limites autorisées pour les demandes complètes de l’agent.",
    change: "Avant chaque appel, l’atelier relit le cadre et réserve le budget partagé. Une fermeture ne remet pas ce total à zéro ; une acceptation externe inconnue conserve sa réservation.",
    origine: "toi · cadre propre au jeu, distinct des anciens garde-fous de séance",
    ou: "reglages",
    groupe: "Agent MCP — le cadre de délégation du jeu",
  },

  "agent.plafond": {
    nom: "Plafond de la séance",
    ou: "reglages",
    groupe: "Agent MCP — la séance",
    quoi: "Le nombre d'images que l'agent peut faire produire depuis l'ouverture de l'atelier.",
    change:
      "Atteint, l'agent reçoit un refus qui nomme le plafond et te renvoie ici — aucune fenêtre ne s'ouvre, rien ne t'interrompt. Il compte des images, pas des appels : quatre variations d'un seul prompt en consomment quatre, parce que c'est ce qui est facturé.",
    origine: "toi · défaut 20, actif · repart à zéro à chaque ouverture",
    long:
      "Il compte depuis l'ouverture de l'atelier, pas plus loin : fermer la fenêtre le remet à zéro. Le désactiver ne perd pas le chiffre posé — rallumer le rend tel quel. Le changer prend effet à l'appel suivant, sans redémarrer.",
  },
  "agent.modele": {
    nom: "Modèle d'exploration",
    ou: "reglages",
    groupe: "Agent MCP — la séance",
    quoi: "Le modèle imposé à l'agent, quel que soit celui qu'il demande — choisi parmi ceux qui ne coûtent rien, les seuls que la liste propose.",
    change:
      "Toutes ses générations partent sur ce modèle. Éteint, l'agent choisit — et s'il ne choisit pas, c'est encore celui-ci qui sert : personne ne doit tomber sur le modèle le plus cher du catalogue par accident. **C'est aussi le seul moyen de lui laisser un modèle payant**, et c'est voulu : un « modèle d'exploration » qui pourrait être le plus cher ne protégerait de rien.",
    origine: "toi · défaut : le modèle gratuit, actif",
    long:
      "Un modèle gratuit ne prend pas d'images d'entrée : le style de ton jeu — artworks, concept arts, ambiances — ne part pas avec lui, et la fiche de l'image le dit ensuite : *partie sans le style du jeu*. Si ce modèle a disparu du catalogue, l'atelier en cherche un autre gratuit avant de prendre le défaut payant du catalogue.",
  },
  "agent.dossier": {
    nom: "Dossier du jeu",
    ou: "reglages",
    groupe: "Agent MCP — la séance",
    quoi: "Où l'agent pose les fichiers quand il ne dit pas où.",
    change:
      "Un dossier manquant est créé, et un fichier de même nom n'est jamais écrasé — il est numéroté. Un dossier qui refuse l'écriture est refusé à l'agent avec le chemin fautif, pour qu'il sache lequel des trois qu'il vient de nommer a posé problème.",
    origine: "toi · vide au départ, et c'est un état légitime",
    long:
      "Vide, l'agent nomme son dossier à chaque appel — c'est permis, et c'est même ce qu'il fera s'il range ses sprites et ses tuiles à deux endroits différents.\n\nCe qui est posé là est le rendu, jamais le brut : l'image qu'on voit, celle qui entre dans le jeu. Le brut reste ici, et c'est lui qui permet de refaire le rendu.",
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
