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
   *  Les confondre ferait grossir le mauvais groupe de vingt et une entrées.
   *
   *  ⚠️ **Les trois écrans des tuiles ont chacun le leur depuis `GU13`**, et ils
   *  portent le nom de leur genre dans `lieux.ts` — `tuiles`, `jeu-de-tuiles`,
   *  `livraison-de-tuiles` — pour qu'on lise d'un coup d'œil lequel sert quoi.
   *  Aucun des trois n'était testé dans `ecranDuGuide` (`App.tsx`) : les ouvrir
   *  montrait le guide de la racine du dessous, le plus souvent `codex`, qui ne
   *  parle ni de matières ni de raccords. C'est la panne exacte que `GU7` (1/2)
   *  a réparée sur les règles du jeu et `GU12` (2/2) sur la sortie ; la
   *  décision d'architecture n°5 du plan la ferme pour de bon — **un genre de
   *  `lieux.ts` sans écran de guide est une erreur d'essai, pas un oubli.**
   *
   *  Trois valeurs et non une, parce que les trois écrans ne se règlent pas
   *  ensemble : la liste des jeux ne porte aucun réglage, l'atelier d'un jeu en
   *  porte une vingtaine, et la livraison n'en porte aucun mais décide de ce
   *  qui part. Une seule valeur aurait mis les fiches de l'atelier sous le nez
   *  de qui ouvre la liste.
   *
   *  ⚠️ **Le son a deux valeurs, et une seule est un genre de `lieux.ts`**
   *  (`GU14`, puis `RT8`). `son` est l'atelier des sons — la liste, un son
   *  ouvert, ses réglages, sa livraison. Un dialogue plein écran au départ
   *  (`sonsOuverts`, `App.tsx`) ; `RT8` en a fait un lieu de la pile (genre
   *  `sons`, `lieux.ts`), posé sur la racine d'où l'on vient au lieu de la
   *  recouvrir — comme *Les tuiles* déjà. `un-son` reste, lui, un dialogue :
   *  c'est le formulaire qui fabrique un son (`FabricationAudio`), corps de la
   *  fenêtre de préparation quand son type est *Son*. Deux valeurs parce qu'on
   *  ne fait pas la même chose dans les deux : on y *demande* un son, on y
   *  *règle* un son déjà reçu. Les quatre fiches `son.*` rangées sous
   *  `galerie` par `GU12` — faute d'un écran — sont revenues ici.
   *
   *  ⚠️ **Quatre valeurs de plus depuis `GU15`** (1/2), et chacune répare un
   *  écran qui empruntait le guide d'un autre :
   *
   *  - `fabrications` est la racine du même nom (`Fabrications.tsx`) : le
   *    journal des appels, la file des calculs locaux, les méthodes locales,
   *    et la liste des demandes qu'on rouvre. Ses neuf fiches empruntaient
   *    `ou: "clip"` — l'écran d'un clip —, où aucune n'était à sa place.
   *  - `envoi` est *Relire avant l'envoi* (`Relecture.tsx`), le dernier écran
   *    avant que l'argent parte. Il n'était testé nulle part dans
   *    `ecranDuGuide` : on y voyait le guide de la racine du dessous, sur le
   *    seul écran du produit où l'on paie.
   *  - `grille` est *Sur la grille du jeu* (`GrilleDuJeu.tsx`) et `comparer`
   *    *Deux côte à côte* (`Comparer.tsx`). Les deux **prennent la place** de
   *    la page d'un sujet, ils ne s'y posent pas : le résumé de `sujet` — on y
   *    écrit qui il est, on y fabrique ce qui manque — n'y est vrai d'aucune
   *    de ses trois lignes.
   *
   *  Les quatre ont leur résumé et leurs fiches depuis `GU15` (2/2) : seize
   *  pour `envoi` (dont `envoi.ecran`, venue de `sujet`), dix-huit pour
   *  `fabrications` (neuf déjà là, neuf neuves), quatre pour `grille` — clés
   *  `grille-du-jeu.*`, parce que `grille.*` est déjà le préfixe des réglages
   *  de la retouche — et huit pour `comparer`. */
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
    | "tuiles"
    | "jeu-de-tuiles"
    | "livraison-de-tuiles"
    | "son"
    | "un-son"
    | "fabrications"
    | "envoi"
    | "grille"
    | "comparer"
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

  // **Le 2ᵉ geste était faux, corrigé en `GU16` (2/2)** : il parlait du fond et
  // des couleurs demandées, qui ne sont pas sur cet écran — ils se règlent à
  // l'étape *Son allure* des règles du jeu, et ont leurs fiches sous `ou:
  // "jeu"` depuis `GU9`. L'essai au navigateur de `GU16` (1/2) l'a vu.
  ambiances: {
    aQuoi:
      "Ambiances et couleurs — les palettes de ce jeu, tirées d'images, et les lots de style qu'on désigne ensuite sur un sujet.",
    gestes: [
      "On écrit un nom dans la colonne de gauche, et la palette ou l'ambiance existe.",
      "On compose une palette à partir d'images, on dose la fusion, on la retouche.",
      "On donne à une ambiance sa palette, ses références et ses trois cases de texte.",
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

  tuiles: {
    aQuoi:
      "Les tuiles du jeu — la liste des jeux déjà faits, sols, chemins et murs : on en ouvre un, ou on part d'une image déjà là.",
    gestes: [
      "On regarde la sorte, les pièces et la taille de chaque jeu déjà fait.",
      "On ouvre un jeu pour le reprendre, ou on en commence un nouveau.",
      "On part d'une image déjà faite quand le jeu existe en dehors d'ici.",
    ],
  },

  "jeu-de-tuiles": {
    aQuoi:
      "Un jeu de tuiles — choisir sa sorte ou partir d'une image, puis poser ses matières et sa carte jusqu'à ce que les raccords tiennent.",
    gestes: [
      "On choisit une sorte ou une image, puis on nomme le jeu.",
      "On pose une matière par emplacement, intégrée, à soi, ou générée sur la machine.",
      "On peint la carte, on vérifie les raccords, puis on enregistre ou on livre.",
    ],
  },

  "livraison-de-tuiles": {
    aQuoi:
      "Livrer à Godot — ce qui part d'un jeu de tuiles, sa planche, sa vérification, et le dossier où tout ira s'écrire.",
    gestes: [
      "On relit les fichiers qui partent, et la planche telle qu'elle sera livrée.",
      "On vérifie que les raccords tiennent avant de continuer plus loin.",
      "On regarde où ça va, puis on dépose dans le projet Godot lié.",
    ],
  },

  son: {
    aQuoi:
      "Les sons — chaque son du jeu s'écoute, se règle en coupe, en boucle et en niveau, puis se garde en version avant de partir vers Godot.",
    gestes: [
      "On importe un son, ou on en ouvre un, et on l'écoute avant de le juger.",
      "On règle la coupe, la boucle et le niveau, puis on conserve une version de plus.",
      "On relit les fichiers qui partiraient dans Godot, puis on livre au jeu.",
    ],
  },

  "un-son": {
    aQuoi:
      "Un son — on décrit ce qu'on veut entendre, plusieurs tirages se calculent sur cette machine, et on garde ceux qui vont au jeu.",
    gestes: [
      "On choisit une famille, puis on écrit en anglais ce qu'on doit entendre.",
      "On relit le texte qui part, on règle durée, tirages et moteur, puis on lance.",
      "On écoute les tirages au clavier, et on garde ceux qui iront dans le jeu.",
    ],
  },

  fabrications: {
    aQuoi:
      "Fabrications — le journal de tout ce qui a été demandé, ce qui tourne en ce moment, et les portes pour préparer une demande neuve.",
    gestes: [
      "On repère d'un coup d'œil ce qui tourne, ce qui est terminé et ce qui a échoué.",
      "On cherche une demande par son texte ou son modèle, et on filtre par état.",
      "On rouvre un résultat, ou on prépare une fabrication neuve à relire avant l'envoi.",
    ],
  },

  envoi: {
    aQuoi:
      "Relire avant l'envoi — le dernier écran avant la dépense : ce qui part au modèle, mot pour mot, et ce que l'appel devrait coûter.",
    gestes: [
      "On lit le texte exact, les images jointes et le prix estimé avant de décider.",
      "On appuie sur Modifier l'envoi pour éteindre ou corriger, pour cet appel seulement.",
      "On lance l'appel — payant chez un fournisseur — ou on ferme sans rien dépenser.",
    ],
  },

  grille: {
    aQuoi:
      "Sur la grille du jeu — le sujet posé à sa vraie taille sur les cases du moteur, à côté des autres types, sans rien fabriquer.",
    gestes: [
      "On choisit un zoom entier et on voit le sujet à sa vraie taille sur les cases.",
      "On allume d'autres types de sujet à côté de lui pour juger l'échelle.",
      "On lit ce qu'il occupe de sa case, puis on revient à sa page ou on compare.",
    ],
  },

  comparer: {
    aQuoi:
      "Deux côte à côte — deux images, deux animations ou deux sujets sur la même scène, avec l'écart chiffré et la porte pour le corriger.",
    gestes: [
      "On choisit ce qu'on compare, la pose ou le mouvement, puis l'image de chaque côté.",
      "On lit les écarts chiffrés, et ce qui dépasse en rouge ou ce qui sépare les deux.",
      "On retouche ce qui dépasse, ou on choisit pour le jeu l'animation qui reste.",
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

  // ── Fabrications — la racine du même nom (`Fabrications.tsx`) ─────────────
  //
  // **Ces neuf fiches empruntaient `ou: "clip"`, et aucune ne parle d'un
  // clip** (`GU15`, 1/2). Elles décrivent l'écran *Fabrications* : le journal
  // des appels, la file des calculs locaux, les méthodes locales, la vidéo
  // libre, et les demandes qu'on rouvre depuis *Créer et suivre les
  // fabrications*. L'écran n'avait pas de valeur à lui ; il en a une, et les
  // neuf y sont rangées sur six zones, dans l'ordre où `Fabrications.tsx` les
  // montre. Textes inchangés, sauf trois `quoi` ramenés sous les 140 signes de
  // `GU3` — la phrase de trop est retirée, aucun mot n'est réécrit.
  //
  // ⚠️ **Six des neuf décrivent la fenêtre d'une demande**, celle que
  // `SuiviDesTravaux` ouvre ici même (`FenetreDuTravail`) et que le lieu
  // `travail` rouvre par sa seconde porte, l'onglet *Agent MCP* des réglages.
  // C'est ce qui fait que `travail` hérite de cet écran-ci plutôt que du sien
  // (`ecranDuGuide`, `App.tsx`).
  //
  // **Neuf fiches de plus depuis `GU15` (2/2)**, pour ce que l'écran montre
  // sans que rien ne l'explique : les portes qui ouvrent la préparation, la
  // liste des travaux suivis, et le journal — sa recherche, ses boutons
  // *Actualiser* et *Consommation*, ses lignes et leurs quatre boutons.
  // L'ordre du fichier est
  // celui de l'écran, de haut en bas ; le journal, qui est en bas, passe donc
  // avant le rendu 3D rouvert, qui n'est dans aucune page mais dans la fenêtre
  // d'un travail.
  //
  // **Rien de ce qui se lit ici ne paie.** Les portes ouvrent la fenêtre de
  // préparation, qui n'envoie rien ; l'argent ne part que du bouton de
  // *Relire avant l'envoi* (`ou: "envoi"`). *Consommation* mène aux dépenses,
  // un écran de lecture. Chaque fiche qui ouvre quelque chose le dit.

  "fabrication.commencer": {
    nom: "Nouvelle fabrication, Préparer une image",
    groupe: "Commencer une fabrication — une image, un sujet, un son",
    quoi: "Les deux boutons ouvrent la même fenêtre, sur une image libre : le modèle, la demande et les références se choisissent dedans.",
    change: "Rien ne part à l'ouverture. La fenêtre change de type — image, clip, son — sans qu'on la referme ; le prix se lit ensuite sur Relire avant l'envoi, et c'est ce bouton-là qui paie.",
    origine: "toi · une demande neuve, sans sujet visé",
    ou: "fabrications",
  },
  "fabrication.animer-un-sujet": {
    nom: "Animer un sujet",
    groupe: "Commencer une fabrication — une image, un sujet, un son",
    quoi: "On choisit un sujet dans la liste : sa page s'ouvre sur l'onglet Animations, où se règlent le mouvement, la direction et l'image de départ.",
    change: "Rien à la génération ici : choisir un sujet ne prépare ni n'envoie rien. La liste est celle des sujets du jeu ouvert.",
    origine: "les sujets du jeu",
    ou: "fabrications",
  },
  "fabrication.un-son": {
    nom: "Préparer un son",
    groupe: "Commencer une fabrication — une image, un sujet, un son",
    quoi: "Ouvre la fenêtre de préparation sur le type Son : on décrit un effet, une ambiance ou une musique.",
    change: "Rien à payer : les moteurs de son tournent sur cette machine, et le résultat rejoint l'atelier des sons. L'écran Un son détaille chaque geste.",
    origine: "toi · une demande de son neuve",
    ou: "fabrications",
  },
  "fabrication.nouvelle-animation": {
    nom: "Nouvelle animation",
    groupe: "Créer et suivre les fabrications",
    quoi: "Le bouton du haut de la liste ouvre la fenêtre de préparation sur le type Clip, comme Préparer une vidéo plus bas.",
    change: "Rien ne part à l'ouverture : la demande se prépare, puis se relit avant l'envoi. Le bouton ne mène pas à un sujet précis — pour animer un sujet donné, on passe par sa page.",
    origine: "toi · une demande de clip neuve",
    ou: "fabrications",
  },
  "fabrication.liste-des-travaux": {
    nom: "La liste des travaux suivis",
    groupe: "Créer et suivre les fabrications",
    quoi: "Chaque ligne est un travail conservé : son nom, qui l'a demandé — l'agent ou toi —, la date, et où il en est.",
    change: "Cliquer une ligne la rouvre pour la relire et la suivre ; rien ne part tant qu'on n'a pas pressé le bouton de sa relecture. La liste se relit d'elle-même toutes les cinq secondes.",
    origine: "l'atelier · les travaux conservés pour ce jeu",
    long: "Les états sont ceux du travail, pas ceux du journal plus bas : Prête à lancer, En cours, À reprendre, À vérifier, État à vérifier chez le fournisseur, Terminée, Annulée. « Agent » dit qu'un agent MCP a demandé le travail ; « Création manuelle », que c'est toi.",
    ou: "fabrications",
  },
  "fabrication.relecture": {
    nom: "La demande relue avant l’envoi",
    groupe: "Créer et suivre les fabrications",
    quoi: "Le texte composé, les références, le fournisseur, le modèle et ses réglages se relisent ensemble avant de lancer une fabrication.",
    change: "Modifier prépare une nouvelle version de la demande. Reprendre garde l’envoi précédent et son identifiant : un travail déjà accepté ne se paie pas une seconde fois.",
    origine: "toi · demande conservée avec ses résultats",
    ou: "fabrications",
  },
  "fabrication.file-locale": {
    nom: "Le suivi des calculs locaux",
    groupe: "Les calculs locaux",
    quoi: "La file ordonne les calculs de l’atelier et distingue un moteur disponible, occupé ou non vérifiable.",
    change: "Annuler retire une attente avant son envoi. Reprendre retrouve le travail conservé. Les durées sont mesurées ; un chargement inconnu n’est pas annoncé comme un modèle déjà prêt.",
    origine: "atelier · observation des moteurs et historique conservé sur cette machine",
    ou: "fabrications",
  },
  "fabrication.video-libre": {
    nom: "Image de départ → clip → montage et classement",
    groupe: "Une vidéo libre",
    // Raccourcie de 158 à 128 signes (`GU3`) : « Vous pouvez l'importer, la
    // choisir… » disait en deux phrases ce que la liste dit en une.
    quoi: "Une image de départ part toujours au modèle vidéo : importée, choisie dans la bibliothèque, ou fabriquée avec un modèle d’image.",
    change: "Le clip rejoint la galerie. Le montage permet ensuite de choisir un personnage, son mouvement et sa direction, puis de garder les frames en animation. Reprendre conserve le travail envoyé et ses références.",
    origine: "toi · image, mouvement et méthode de fabrication",
    ou: "fabrications",
  },
  "workflow.version": {
    nom: "Une version de workflow local",
    groupe: "Mes méthodes locales — importer, vérifier, choisir un workflow",
    quoi: "Un profil nomme un graphe ComfyUI, ses entrées, ses références et les réglages utilisables au quotidien.",
    change: "Modifier crée une nouvelle version. Une fabrication conserve le graphe et les images de sa propre version ; reprendre suit le numéro déjà envoyé sans recommander. Vérifier lit les prérequis, sans installer ni lancer de modèle.",
    origine: "toi · profil importé ; ComfyUI · prérequis observés",
    ou: "fabrications",
  },
  "fabrication.recherche": {
    nom: "Rechercher une fabrication",
    groupe: "Le journal — chercher, filtrer, rouvrir",
    quoi: "Un mot cherché dans le texte de la demande et dans le nom du modèle, sans tenir compte des majuscules.",
    change: "Se combine avec le filtre État : les deux s'appliquent ensemble. Ne change que ce qui s'affiche, rien n'est effacé du journal.",
    origine: "toi · vide au départ",
    ou: "fabrications",
  },
  "fabrications-etat": {
    nom: "État des fabrications",
    groupe: "Le journal — chercher, filtrer, rouvrir",
    quoi: "Le journal réunit les demandes conservées et les appels encore en cours.",
    change: "Le filtre À reprendre montre les échecs et les interruptions. Une demande terminée ouvre ses résultats ; un clip ouvre son montage sans commander une nouvelle vidéo.",
    origine: "atelier · journal des appels",
    ou: "fabrications",
  },
  "fabrication.actualiser": {
    nom: "Actualiser, Consommation",
    groupe: "Le journal — chercher, filtrer, rouvrir",
    quoi: "Actualiser relit le journal sur le disque ; Consommation quitte cet écran pour celui des dépenses.",
    change: "Rien à payer ni à envoyer. Le journal se relit aussi tout seul quand une fabrication change d'état. Les dépenses sont un écran de lecture : on y voit ce que chaque appel a coûté.",
    origine: "l'atelier · le journal des appels de ce jeu",
    ou: "fabrications",
  },
  "fabrication.ligne": {
    nom: "Une ligne du journal",
    groupe: "Le journal — chercher, filtrer, rouvrir",
    quoi: "La date, Vidéo ou Images, l'état, la demande, le modèle — et, en rouge, la raison de chaque image ratée.",
    change: "États : En attente, En cours, Terminé, Échec, Interrompu ; les deux derniers sont en rouge. Une demande sans texte s'écrit « Demande sans texte ». Rien à la génération : on lit.",
    origine: "l'atelier · journal des appels, complété par les fabrications en cours",
    ou: "fabrications",
  },
  "fabrication.boutons-de-la-ligne": {
    nom: "Les boutons d'une ligne",
    groupe: "Le journal — chercher, filtrer, rouvrir",
    quoi: "Selon la ligne : ouvrir le montage du clip, voir les résultats dans la galerie, ouvrir le sujet, ou reprendre depuis la galerie.",
    change: "Aucun ne lance ni ne paie. Reprendre depuis la galerie ne fait qu'ouvrir la galerie, sur une demande échouée ou interrompue : un nouvel appel se prépare et se relit à part. Ouvrir le sujet paraît quand la demande en vise un.",
    origine: "l'état de la ligne · le sujet visé par la demande",
    ou: "fabrications",
  },
  "source3d.import": {
    nom: "Importer un rendu 3D",
    groupe: "Un rendu 3D rouvert — importer, inspecter, corriger, cadrer",
    quoi: "Le rendu rejoint le personnage sous forme de frames transparentes, avec ses réglages, son modèle et les fichiers disponibles.",
    change: "On choisit le mouvement, la direction et la cadence. L’import ne relance aucun calcul ; la copie reste retouchable après arrêt d’asset3d. Le modèle animé fourni par une ancienne version d’asset3d reflète ses corrections au moment de l’import, pas nécessairement celles du rendu historique.",
    origine: "rendu choisi dans le moteur externe · copie conservée dans ce jeu",
    ou: "fabrications",
  },
  "source3d.inspection": {
    nom: "Inspecter le modèle animé",
    groupe: "Un rendu 3D rouvert — importer, inspecter, corriger, cadrer",
    quoi: "La vue 3D permet de tourner la caméra, de zoomer, de voir le squelette et de lire les animations intégrées au fichier.",
    change: "Les réglages de cette inspection changent seulement la vue. Le cadre englobe les poses de l’animation pour garder la silhouette entière pendant la lecture ; les frames déjà importées ne sont pas recalculées.",
    origine: "copie GLB locale · caméra de consultation",
    ou: "fabrications",
  },
  "source3d.corrections": {
    nom: "Corrections du squelette",
    groupe: "Un rendu 3D rouvert — importer, inspecter, corriger, cadrer",
    // Raccourcie de 170 à 123 signes (`GU3`) : « avec le curseur ou la valeur
    // en degrés » devient « en degrés » — les deux entrées restent dites par
    // l'écran, qui les montre côte à côte.
    quoi: "Un os proposé par le moteur, puis sa vrille, sa flexion et son écart en degrés. Gauche et droite sont celles du personnage.",
    change: "Enregistrer actualise le GLB de contrôle avec Blender, sans génération IA. Les corrections s’appliquent aux prochains rendus ; les travaux conservés gardent leur copie. Le rendu refuse des corrections changées depuis sa relecture. Les réglages non enregistrés restent disponibles comme brouillon.",
    origine: "source 3D externe · os et bornes déclarés par le moteur",
    ou: "fabrications",
  },
  "source3d.camera": {
    nom: "Caméra et portion du rendu 3D",
    groupe: "Un rendu 3D rouvert — importer, inspecter, corriger, cadrer",
    // Raccourcie de 204 à 136 signes (`GU3`). La phrase retirée disait un fait
    // qu'aucun autre champ ne portait — *la vue 3D peut transmettre son angle
    // au prochain rendu* : remise dans `change` par `GU15` (2/2), vérifiée sur
    // le bouton « Utiliser cet angle pour le rendu » d'`ApercuModele3D.tsx`.
    quoi: "Un angle du catalogue, ou l’azimut et la hauteur en degrés. Une portion limite le mouvement à extraire ; une pose garde une seule frame.",
    change: "L’angle, la portion et les corrections sont conservés avec le travail. Le bouton « Utiliser cet angle pour le rendu » de la vue 3D transmet son angle au prochain rendu. Le zoom de consultation ne change pas le cadre exporté : toutes les frames gardent la même taille et un cadre commun, mesuré sur le mouvement entier.",
    origine: "toi · paramètres acceptés et relus par le moteur externe",
    ou: "fabrications",
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

  // **Écrite en `GU16` (2/2)** : l'essai au navigateur de la première moitié a
  // trouvé la page d'une pièce servie par le seul résumé, alors qu'elle porte
  // un réglage qu'on touche — le genre d'un emploi neuf, et son porteur.
  "equipement.nouvel-emploi": {
    nom: "Ajouter un emploi",
    ou: "equipement",
    groupe: "La page d'une pièce — ses emplois",
    quoi: "Trois genres : portée par quelqu'un, une image à part, une mise en scène. Le premier demande un porteur, les deux autres un nom libre.",
    change:
      "Rien à la génération : on crée la case, on ne fabrique rien. Un emploi porté réclame ensuite un calque par pose et par direction du porteur ; les deux autres genres ne réclament qu'une image. La liste des porteurs ne montre que ceux qui ne la portent pas déjà.",
    origine: "toi · les personnages du jeu qui peuvent porter cette pièce",
  },

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
      "Toute image née ici arrive déjà remise sur cette grille. Sur « aucune », il n'y a pas de remise sur grille du tout : le détourage, le recadrage et la palette continuent, l'occupation du barème cesse d'agir. Les images déjà là ne bougent pas toutes seules — « Tout réaligner » est un geste, jamais un effet de bord. Sur un jeu qui porte déjà des images, changer cette case le dit avant de le faire, avec le compte de ce qui reste à l'ancienne taille — on peut passer outre.",
    origine: "toi, une fois par projet · défaut 64",
    long:
      "« Aucune » dit que ton jeu n'est pas en pixel art — le rendu du modèle entre tel quel, sans grille imposée. Avec une cible, elle est toujours imposée, jamais déduite : dix modèles sur douze font dériver la taille du pixel d'une génération à l'autre, de 7 à 20 px dans un même lot. Réaligner ne coûte rien — aucun appel payant — et saute les images déjà ramenées au brut.",
  },

  // **Relogée ici par `GU9`** (`docs/releves/guide-2026-09-20.md`) :
  // `univers.couleurs` vivait sous `ou: "ambiances"`, un héritage du modèle
  // d'avant `C2`. Le code la règle ici depuis longtemps — `ReglesDuJeu.tsx` le
  // dit dans son propre tableau de migration, « 7a » — et l'écran Ambiances et
  // couleurs n'en montre plus aucune trace.
  //
  // `univers.fond` l'a rejointe le même jour, puis a disparu avec elle le 20
  // septembre 2026 (RT4) : le réglage qu'elle décrivait n'existe plus, le fond
  // se calculant désormais à chaque demande d'image (`atelier/domaine/fond.py`).

  "univers.couleurs": {
    nom: "Couleurs demandées",
    ou: "jeu",
    groupe: "Son allure — le style, la taille, les couleurs",
    quoi: "Combien de couleurs ton jeu garde — lues dans ta palette, ou gardées sur chaque image sans palette. Ne paraît qu'en pixel art.",
    change:
      "Avec une palette : elle en relance le calcul sur les mêmes artworks, sans un appel payant, et ça change le rendu de tout ce qui se quantifie ensuite. Sans palette : elle règle directement combien de teintes chaque image garde à sa sortie.",
    origine: "toi · défaut 32",
    long:
      "Elle sert deux fois, et c'est voulu : avant `D2` elle ne servait que la première — un projet sans artwork ne réduisait aucune couleur, en silence. Le plafond dépend de la taille de case : une petite image ne porte pas assez de teintes distinctes pour remplir une liste longue — la liste proposée à l'écran raccourcit d'elle-même, plutôt que de refuser un choix hors barème.",
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

  // Son monde — les cinq lignes qu'on tape

  "univers.bible": {
    nom: "Bible",
    ou: "jeu",
    groupe: "Son monde — les cinq lignes qu'on tape",
    quoi: "Sept lignes nommées disent ce qu'est ton jeu. Cinq se tapent ici ; rendu et vue s'écrivent seules, depuis les étapes d'avant.",
    change:
      "Chaque ligne active et non vide part en tête du prompt, à chaque génération, sans que tu la retapes. Une ligne éteinte ne part pas : l'interrupteur est le doseur. Le compte de l'étape — « 0 ligne sur 5 » — ne compte que les cinq qu'on tape ; les deux autres n'ont rien à écrire.",
    origine: "toi, une fois par projet · sept champs vides au départ",
    long:
      "Des champs nommés plutôt qu'un texte libre : un texte libre est ce qu'on retape, un champ nommé est ce qu'on dose — on relâche le trait sans relâcher le monde, sans rien réécrire. La liste est close et dans l'ordre de l'écran comme du prompt. Les intitulés partent en anglais parce que les modèles du catalogue sont entraînés dessus ; ton texte, lui, part tel quel.",
  },

  "bible.monde": {
    nom: "monde",
    ou: "jeu",
    groupe: "Son monde — les cinq lignes qu'on tape",
    quoi: "Où ça se passe et de quoi c'est fait — le lieu, la matière, l'ambiance.",
    change:
      "Part sous « World: » en tête du prompt, à chaque génération. C'est le champ qui tient la cohérence entre deux images faites à trois semaines d'écart.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.epoque": {
    nom: "époque",
    ou: "jeu",
    groupe: "Son monde — les cinq lignes qu'on tape",
    quoi: "Le moment technologique du jeu — ce qui existe déjà, et ce qui n'existe pas encore.",
    change:
      "Part sous « Era: ». C'est ce qui empêche une arbalète de ressortir avec une lunette de visée — elle ne choisit rien à ta place : ce sont tes descriptions qui décident des armes, des vêtements et des outils. **Ce que cette case-là change dans l'image n'a pas été mesuré** — aucun banc ne l'a isolée, et il n'y en aura pas : deux mots dans un prompt ne valent pas huit tirages payés par branche.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.trait": {
    nom: "trait",
    ou: "jeu",
    groupe: "Son monde — les cinq lignes qu'on tape",
    quoi: "Comment c'est dessiné : le contour, les aplats, les ombres.",
    change:
      "Part sous « Line and shading: ». C'est le champ le plus proche du rendu, donc le premier à relâcher quand tout se ressemble trop.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.eclairage": {
    nom: "éclairage",
    ou: "jeu",
    groupe: "Son monde — les cinq lignes qu'on tape",
    quoi: "D'où vient la lumière, et ce qu'elle laisse comme ombres.",
    change:
      "Part sous « Lighting: ». Deux sprites éclairés de deux côtés différents ne se montent pas dans la même scène.",
    origine: "toi · vide, donc ne part pas",
  },

  "bible.technique": {
    nom: "contraintes techniques",
    ou: "jeu",
    groupe: "Son monde — les cinq lignes qu'on tape",
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

  // Ses sons — la cinquième étape, et la seule que `GU7` n'avait pas couverte
  //
  // **Écrite en `GU16` (2/2)** : le résumé de l'écran nommait « ses sons »
  // depuis `GU4`, et l'étape existe bel et bien dans `ETAPES`
  // (`ReglesDuJeu.tsx`) avec ses quatre cases de texte, sa tonalité, son tempo
  // et son moteur par famille — aucune fiche ne la décrivait. Le même geste que
  // « Son monde », pour l'oreille.

  "univers.son.cases": {
    nom: "Les quatre lignes du son",
    ou: "jeu",
    groupe: "Ses sons — le style sonore du jeu",
    quoi: "Époque et matière, rendu sonore, orchestre, humeur : quatre lignes en anglais qui disent comment ce monde sonne.",
    change:
      "Elles se posent devant chaque description de son, comme la bible se pose devant chaque description d'image. Chacune ne part qu'avec les familles qu'elle concerne : l'époque avec les bruitages et les ambiances, l'orchestre avec la musique. Une ligne vide ne part pas.",
    origine: "toi · quatre lignes vides au départ",
    long:
      "Un jeu sans ce bloc ne contraint rien : la description d'un son part seule, avec la prise de son de sa famille. Le compte en tête de l'étape — « 0 ligne sur 4 écrite » — dit où en est le bloc sans qu'on l'ouvre.",
  },

  "univers.son.reference": {
    nom: "Tonalité et tempo de référence",
    ou: "jeu",
    groupe: "Ses sons — le style sonore du jeu",
    quoi: "La gamme et la vitesse que les musiques de ce jeu suivront par défaut, quand on n'en demande pas d'autres.",
    change:
      "Elles remplissent d'avance les deux mêmes réglages quand on demande une musique. Laissées vides, chaque demande repart du défaut du moteur — 90 battements par minute.",
    origine: "toi · vides au départ",
  },

  "univers.son.moteurs": {
    nom: "Le moteur de chaque famille",
    ou: "jeu",
    groupe: "Ses sons — le style sonore du jeu",
    quoi: "Avec quoi chaque famille de sons se calcule : bruitage, interface, ambiance, musique, jingle, chanson, voix.",
    change:
      "Le moteur proposé quand on demande un son de cette famille — on le change encore au moment de lancer. Sans choix posé, l'atelier prend la première méthode installée de la famille. Rien à payer : tous tournent sur cette machine.",
    origine: "toi · les méthodes sonores installées sur cette machine",
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
      "C'est la valeur que la recette reprendra à la naissance de l'image — 100 % pour un personnage, 40 % pour un objet tenu en main. Cette ligne se lit ici ; elle se règle dans les réglages de la famille, avec les deux autres traits de la même échelle.",
    origine: "toi · mesuré le 27/08 sur sept sujets réels",
    long:
      "Deux images arrivent du fournisseur au même format ; sans occupation, un tonneau remis sur grille deviendrait aussi grand qu'un personnage. Elle se pose une fois pour le projet, pas génération par génération. La fiche d'une image la porte aussi, pour les cas particuliers — mais y toucher l'épingle, qui cesse alors de suivre l'univers.",
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
      "Trois niveaux décident, dans cet ordre : la famille du sujet, puis la façon dont l'image est venue, puis le produit. Une famille réglée l'emporte sur sa nature. La fiche de chaque image dit ensuite lequel des trois a décidé. La tolérance et le bord rongé ne sont pas ici : ils se règlent image par image, dans la table Détourage.",
  },

  "assistant.poses": {
    nom: "Les poses et les états",
    ou: "jeu",
    groupe: "S'applique à tout le jeu, mais se règle ailleurs",
    quoi: "Ce que chaque sujet du jeu peut faire — au repos, en marche, ouvert, vidé.",
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
      "Rien à la génération. Ce sont les crans du zoom de la galerie, réemployés — un seul vocabulaire de taille dans tout le produit.",
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
  // **Une entrée a quitté ce bloc en `GU9`** : `univers.couleurs` ne se règle
  // plus ici depuis `C2` — elle se règle à l'étape « Son allure » des règles
  // du jeu (`ou: "jeu"`), où `ReglesDuJeu.tsx` l'a relogée. `univers.fond`
  // l'accompagnait jusqu'au 20 septembre 2026 (RT4), où le réglage qu'elle
  // décrivait a disparu avec elle. Il ne reste ici que ce que l'écran
  // Ambiances et couleurs montre vraiment : les ambiances, et les palettes.

  // Les ambiances

  "ambiance.lot": {
    nom: "Une ambiance",
    ou: "ambiances",
    groupe: "Les ambiances",
    quoi: "Un lot de style réutilisable : une palette, des images de référence, et trois textes. On la désigne sur un sujet du jeu.",
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
  // que la porte *Codex* et la grille d'une famille montrent toutes
  // deux. Il reçoit `bibliotheque.collections` — sa colonne de gauche —,
  // venue de `ou: "sortie"`. `tuiles.terrains` était logée ici pour la même
  // raison — les écrans des tuiles héritaient du codex faute d'un `ou` à
  // eux — et `GU13` (2/2) lui a donné le sien : elle vit maintenant sous
  // `ou: "jeu-de-tuiles"`, avec le reste de l'atelier qu'elle décrit.
  //
  // ⚠️ **`codex.vitrine` décrivait un écran supprimé** — `Vitrine.tsx` est
  // parti du dépôt le 16 septembre 2026. Ce qu'il en reste est ailleurs :
  // l'aperçu à la barre d'espace, partout, et `Comparer.tsx`, qui attend
  // son écran de guide en `GU15`. `GU12` (2/2) l'a retirée
  // (`docs/releves/guide-2026-09-20.md` § *Les fiches qui mentent, une par
  // une*).

  "bibliotheque.collections": {
    nom: "collections de sujets",
    ou: "codex",
    groupe: "La colonne des familles et des collections",
    quoi: "Des groupes nommés pour retrouver les personnages, objets, décors et interfaces du jeu.",
    change: "On choisit une famille à gauche, puis une collection. Une sélection se range dans une collection, ou se glisse sur son nom ; retirer un sujet d’un groupe garde toutes ses images. La recherche et le tri portent sur la famille entière, pas sur les sujets déjà affichés.",
    origine: "toi · rangement conservé dans la bibliothèque",
  },

  "codex.nommer": {
    nom: "Écrire un nom",
    ou: "codex",
    groupe: "En haut de l'écran — nommer un sujet",
    quoi: "Le bouton en haut à droite : dans une famille ouverte il dit « Ajouter un… » et ouvre un champ ; ailleurs il dit « Créer un sujet ».",
    change:
      "Rien à la génération : on nomme, on ne paie pas. Dans une famille, Entrée suffit à faire exister le sujet, prêt à recevoir sa première image. Sans famille choisie — et sur Les équipements —, le guichet demande d'abord laquelle.",
    origine: "toi · vide tant qu'on n'a pas cliqué le bouton",
  },

  "assets-recherche": {
    nom: "Rechercher un sujet",
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
      "Rien à la génération. C'est de là qu'on ouvre l'établi d'un sujet, ou qu'on ouvre le guichet pour en commander plusieurs à la fois.",
    origine: "toi, au fur et à mesure · les familles existent avant le premier sujet",
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
    quoi: "Le texte qui redit à la machine de qui il s'agit, et qui repart avec chaque image qu'on demande de ce sujet.",
    change:
      "Il part dans le texte de chaque génération de ce sujet, avant le reste. Sans lui, l'appel ne dit pas de quoi il s'agit et la machine invente.",
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
      "Ils partent avec chaque image. Par défaut ils viennent du jeu ; en réécrire un ici ne vaut que pour ce sujet, et le texte remplacé reste lisible en dessous, barré.",
    origine: "le jeu, ou l'ambiance choisie, ou toi",
  },

  "codex.chose.exemples": {
    nom: "Ses images d'exemple",
    ou: "sujet",
    groupe: "La fiche du sujet",
    quoi: "Les images qu'on joint à la demande pour montrer le style visé, et qui sont disponibles pour chaque image de ce sujet.",
    change:
      "Rien tout seul. Ce qui part vraiment se coche juste avant de payer — mais une image qui n'est pas retenue ici n'y sera pas proposée.",
    origine: "le tableau d'inspiration, les images déjà faites, toi",
  },

  // **« Ses cases » a été retirée** (RV10, 21-22 sept. 2026) : le compte
  // qu'elle affichait — ce que le jeu réclame, ce qui est fait — vit
  // maintenant en un seul endroit, l'avancement rendu par le serveur et lu
  // pareil par la carte du Codex, la fiche et l'objectif (`ObjectifDuSujet.tsx`).
  // « Type d'objet » et « Supprimer » sont passés dans *Modifier la fiche*
  // (`FicheDuSujet.tsx`) depuis le 16 septembre 2026 déjà.

  // **Déplacée depuis `ou: "equipement"` en `GU8`** (`docs/PLAN-guide.md`) :
  // son propre texte le disait déjà — « les cases que tu coches dans
  // l'établi ou dans le codex ». **Sa seule porte est désormais l'onglet
  // Images** (RV10) : « les angles d'une planche de pose » (E13) ferment un
  // appel sur plusieurs directions d'une même pose d'*un personnage*, jamais
  // sur une pièce d'équipement.
  "fabrique.planche": {
    nom: "La planche de poses",
    groupe: "La fiche du sujet",
    ou: "sujet",
    quoi: "Une feuille où le modèle dessine plusieurs attitudes du même personnage en un seul appel, redécoupée ensuite en images séparées.",
    change:
      "Elle divise le prix : une planche coûte le prix d'un appel quel que soit le nombre de cases qu'elle porte. Et elle achète quelque chose qu'aucun appel séparé ne garantit — les cases sortent à la même échelle et dans le même style, puisqu'elles ont été peintes ensemble.",
    origine: "les directions de la pose, ouverte depuis l'onglet Images",
    long:
      "Le risque se dit avec : c'est **un jet unique**, que le modèle ne rend pas deux fois. Une planche ratée se repaie entière, et un compte de cases faux ne fait rien entrer du tout — la planche entière se relance au prix plein.\n\nLa feuille elle-même n'entre jamais en bibliothèque ; ses morceaux, oui, chacun filié vers elle.",
  },

  // ── La barre qui paie — ce qu'on touche à chaque génération (GU6) ─────────
  //
  // Ce qui suit est la barre commune aux lieux d'où l'argent part
  // (`BarreQuiPaie.tsx`).
  //
  // ⚠️ **Ces sept fiches ne sont pas sur la page d'un sujet, et les groupes le
  // disent depuis `GU16` (2/2)** : `BarreQuiPaie` n'est plus montée qu'avec sa
  // présentation `"preparation"` (`App.tsx`), c'est-à-dire **dans la fenêtre
  // *Préparer une fabrication*** — le modèle et le coût dans son corps, les
  // quatre autres sous le repli *Réglages de l'univers et références
  // héritées*. L'essai au navigateur de `GU16` (1/2) l'avait relevé : on
  // cherchait « la barre qui paie » sur la page du sujet, où il n'y a rien.
  // La fenêtre n'a pas d'écran de guide à elle ; elle hérite de la racine d'où
  // on l'ouvre, et c'est une limite connue, écrite au relevé.

  "reglages.modele": {
    nom: "modèle",
    ou: "sujet",
    groupe: "Préparer une fabrication — le modèle, et ce qu'il consomme",
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
    groupe: "Préparer une fabrication — le modèle, et ce qu'il consomme",
    quoi: "Ce qu'un appel prend chez son fournisseur, dans son unité — dollars pour l'un, jetons pour l'autre. Aucun n'y consomme « rien ».",
    change:
      "Rien à la génération : c'est ce qui s'enregistre après, et ce que l'écran annonce avant. Le chiffre affiché sur un modèle est la **médiane de ses derniers appels sur cette machine**, jamais un tarif lu quelque part.",
    origine: "la réponse du fournisseur, à chaque appel · rien à remplir",
    long:
      "Le mot **gratuit** veut dire *sans prix*, pas *sans limite* : un modèle gratuit prend quand même quelque chose chez qui le sert, écrit à côté — *gratuit · 1 jeton*. Ce qui reste chez un fournisseur se dit aux deux endroits où ça sert — le choix du modèle, la confirmation de l'appel —, avec d'où le chiffre vient : compté ici, ou relevé chez le fournisseur.",
  },

  "reglages.styles-locaux": {
    nom: "styles locaux",
    ou: "sujet",
    groupe: "Préparer une fabrication — le modèle, et ce qu'il consomme",
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
    groupe: "Préparer une fabrication — Réglages de l'univers et références héritées",
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
    groupe: "Préparer une fabrication — Réglages de l'univers et références héritées",
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
    groupe: "Préparer une fabrication — Réglages de l'univers et références héritées",
    quoi: "La nature de ce que tu fabriques — un personnage, un objet tenu en main, un décor — choisie dans le barème de ton univers.",
    change:
      "Trois choses d'un seul geste : quels artworks partent en référence, quel modèle est proposé par défaut, et quelle part de la case le sujet occupera une fois sur grille.",
    origine: "le barème de l'univers · aucun sujet par défaut",
    long:
      "Sans sujet choisi, seules les planches marquées « tous » partent en référence — c'est écrit sous le contrôle, en clair, plutôt que laissé à deviner. Le barème se pose dans l'univers, côté Réglages du jeu, une fois pour le projet : c'est lui qui dit qu'un personnage remplit 100 % de sa case et une fiole 40 %, et c'est ce qui met un tonneau et un personnage à la même échelle de pixel.",
  },

  // **Réécrite en `GU16` (2/2), contre le bloc qui existe.** Elle décrivait
  // encore le dépliant « Ce qui partira » — le texte assemblé en trois parties
  // —, remplacé en `E14` par l'écran *Relire avant l'envoi*, où `envoi.textes`
  // et `envoi.texte-a-la-main` le disent déjà. Deux fiches disaient donc la
  // même chose de deux écrans différents. Ce qui porte ce nom aujourd'hui est
  // le petit récapitulatif de `PanneauReglages.tsx`, qui n'avait aucune fiche.
  "atelier.apercu": {
    nom: "Ce qui part",
    ou: "sujet",
    groupe: "Préparer une fabrication — Réglages de l'univers et références héritées",
    quoi: "Le récapitulatif de l'appel : le modèle choisi, le compte de références sur ce que ce modèle accepte, et d'où elles viennent.",
    change:
      "Rien : c'est une lecture. Le compte passe en rouge quand il dépasse les places du modèle. Le gabarit d'une planche y a sa ligne parce qu'il part vraiment, et qu'il se paie chez qui facture à l'image.",
    origine: "composé par l'atelier · compté pour l'appel en préparation",
    long:
      "Il dit combien d'images partent ; la liste juste dessous dit lesquelles, d'où elles viennent, et laquelle on peut couper. Le texte exact, lui, ne se lit pas ici : il se lit en entier sur *Relire avant l'envoi*, juste avant de payer.",
  },

  // **`envoi.ecran` a changé d'écran en `GU15` (2/2)** : elle décrit *Relire
  // avant l'envoi*, pas la page d'un sujet, et elle logeait sous `sujet` parce
  // que l'envoi n'avait pas d'écran de guide. Elle est passée sous `ou:
  // "envoi"`, et son texte a été mis d'accord avec l'écran tel qu'il est : elle
  // parlait de « chaque chose, ligne par ligne, avec un interrupteur » comme si
  // c'était le premier regard, alors que la lecture d'abord est en blocs et que
  // les interrupteurs n'existent qu'après *Modifier l'envoi* ; et d'un gris
  // « au retour » que l'ancienne présentation dessinait. Les fiches de cet
  // écran sont en bas du fichier.
  "envoi.ecran": {
    nom: "L'écran de confirmation",
    ou: "envoi",
    groupe: "Le cadre — ce qui s'ouvre avant la dépense",
    quoi: "Ce qui s'ouvre entre le bouton et la dépense : le texte exact, les images jointes, le prix, puis le bouton qui lance.",
    change:
      "Rien ne part tant qu'on n'a pas pressé le bouton du bas. À l'ouverture tout se lit sans rien changer ; ce qu'on corrige ensuite ne vaut que pour cet appel et ne remonte dans aucun réglage du jeu ni de l'ambiance.",
    origine: "composé par l'atelier · le même chemin que l'envoi",
    long:
      "« Garder sur le sujet » inscrit la correction sur sa fiche ; sans sujet visé, elle part quand même, mais n'a nulle part où se garder. Le texte montré est demandé par le chemin même que l'envoi emprunte : ce qu'on lit est ce qui part.",
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
    quoi: "Les poses d'un même sujet ne sortent pas toutes à la même hauteur ; cet outil les remet à la même, sans rien redessiner ni payer.",
    change:
      "Il réécrit la taille rendue des poses qu'on lui désigne. Le défaut qu'il corrige est mesuré : six poses du même personnage, même recette, sont sorties à 64, 60, 64, 53, 64 et 43 pixels de haut — un bras tendu élargit la boîte du sujet, et la mise sur grille rétrécit tout le reste.",
    origine:
      "ses poses, comparées entre elles — il marque en doré celles hors taille commune",
    long:
      "Il travaille sur toutes les poses à la fois — la barre des tables parle de l'image ouverte, lui écrit dans les autres, donc il vit à part. Il n'écrit que dans l'occupation, une part de la case : changer la taille de la case ne défait donc aucun calage. Il n'épingle pas, et ne coûte rien : aucun appel payant ne part d'ici.",
  },

  "calibrage.occupation": {
    nom: "occupation",
    ou: "sujet",
    groupe: "Le calibrage",
    quoi: "La part de la case que le sujet occupe en hauteur — à cent pour cent il touche le haut et le bas, à quatre-vingts il flotte.",
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
    quoi: "De combien le sujet est poussé à gauche ou à droite dans sa case.",
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
    origine: "toi · les réglages restent sur cette machine, l'image d'origine ne bouge pas",
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
    nom: "bord rongé",
    groupe: "La table Détourage",
    ou: "tables",
    quoi: "Combien de pixels sont rongés au bord de la silhouette une fois le fond retiré, de 0 à 4.",
    change:
      "Retire un liseré de fond que la tolérance seule n'a pas emporté. Trop haut, il grignote les détails fins — une lame, une antenne, un doigt.",
    origine: "toi · défaut 0",
  },

  "detourage.comparaison": {
    nom: "comparaison",
    groupe: "La table Détourage",
    ou: "tables",
    quoi: "Comment deux couleurs sont dites proches : par canal — rouge, vert, bleu — ou par teinte, qui ignore l'ombre et le dégradé.",
    change:
      "Ce que la tolérance mesure. Par canal, un fond assombri par une ombre s'éloigne vite et reste en place ; par teinte, il part avec le reste du fond sans qu'on monte la tolérance au point de manger une peau. Ne paraît que sur les moteurs « bord » et « pipette ».",
    origine: "toi · défaut « par canal »",
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
    nom: "Pixelisation",
    groupe: "La table Pixelisation",
    ou: "tables",
    quoi: "La troisième place : remettre le sujet sur la grille de pixel du projet.",
    change:
      "C'est l'étape qui rend le produit possible — elle met toutes tes images sur le même pixel. Posée systématiquement, jamais en option : une grille qui a dérivé est le cas normal, pas l'incident.",
    origine: "posée par l'univers, toujours",
  },

  "grille.cible": {
    nom: "taille de case",
    groupe: "La table Pixelisation",
    ou: "tables",
    quoi: "Le côté de la case, en pixels logiques — la taille finale de ton sprite avant export.",
    change:
      "La taille à laquelle le sprite sort d'ici. Monter la case abaisse le plafond de la hauteur, et l'écran ramène la valeur sous le nouveau plutôt que de refuser.",
    origine: "l'univers du projet, sinon toi · défaut 64",
    long:
      "Dix modèles sur douze font dériver la taille du pixel d'une étape à l'autre : sans cette remise à niveau, les frames d'un même personnage ne partagent plus le même pixel. La déduire de l'image reçue laisserait le fournisseur décider de l'échelle du jeu : elle se demande, jamais ne se devine. En dessin, le même cran s'appelle « finesse » et compte du détail, pas des carrés.",
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
    nom: "façon de réduire",
    groupe: "La table Pixelisation",
    ou: "tables",
    quoi: "Comment l'image passe de ses milliers de pixels aux carrés de la case, en quatre façons qui rendent quatre sprites différents.",
    change:
      "C'est un choix de style, pas un classement : le vote rend un sprite calme, les traits épaissis un sprite détaillé, la réduction douce une image floue mais lisse, et « au plus proche » un résultat brut.",
    origine: "défaut du projet · contour net (recommandé)",
    long:
      "Réduire mille pixels à soixante-quatre carrés, c'est en jeter quatre-vingt-dix-neuf sur cent : ce qu'on garde et comment décide de tout le style du sprite. Le projet donne un défaut, mais cette image garde le dernier mot, et changer de méthode ne coûte rien — aucun appel payant ne part d'ici.",
  },

  // ⚠️ **« Couleurs, la table » et non « Couleurs » tout court** : la table
  // porte ce nom à l'écran (`NOM_DE_LA_TABLE`, `Retouche.tsx`) **et** son
  // premier réglage aussi (`<Reglage nom="couleurs">`). Deux lignes du même
  // volet se seraient appelées pareil — c'est l'essai « deux entrées du même
  // écran ne portent pas le même nom » (`App.test.tsx`) qui l'a dit, à la
  // relecture croisée de `GU16`. Le mot de l'écran est gardé, avec ce qui
  // distingue la table du réglage qu'elle contient.
  "etape.quantification": {
    nom: "Couleurs, la table",
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
      "Combien de teintes le sprite garde à la fin. En demander plus que l'image n'en porte n'en fabrique aucune ; le choix proposé suit la taille de case, parce qu'une petite image ne porte pas assez de teintes distinctes.",
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
      "L'écart se mesure comme dans le détourage réglé « par canal » : le plus grand des trois écarts, sur le rouge, le vert et le bleu. Monter trop haut fait déborder la paire sur un voisin qu'on voulait garder ; le rendu se refait à chaque cran, donc le débordement se voit tout de suite.",
  },

  "etape.bords": {
    nom: "Nettoyage",
    groupe: "La table Nettoyage",
    ou: "tables",
    quoi: "La cinquième place : effacer les taches trop petites pour être le sujet.",
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
    origine: "toi · défaut 0, et 0 ne rebouche rien",
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
    nom: "Contour",
    groupe: "La table Contour",
    ou: "tables",
    quoi: "La sixième place de la recette. Elle trace un trait sur le bord du sujet, d'une couleur choisie, et le pose dedans, dehors, ou à cheval.",
    change:
      "Elle rattrape ce que la mise sur grille a mangé : un contour fin n'y survit pas entier, et ce qui reste est un trait troué, qui se voit. Le trait se retrace ici d'un seul tenant, après la réduction et après les couleurs.",
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
      "Rien à la génération, sur aucun des dix sens : c'est un calcul sur l'image déjà rendue, jamais un nouvel appel au modèle. Ranger le résultat sous une direction du jeu se fait ensuite dans la fenêtre Enregistrer sous…, pas ici.",
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
    nom: "Main",
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

  // ── La fabrique Superposer — poser une pièce sur une pose ────────────────
  //
  // **Née sous `ou: "equipement"`, jamais atteignable là** (`GU8`,
  // `docs/PLAN-guide.md`) : une des deux fabriques de `TABLES`
  // (`interface/src/recette.ts`), montée uniquement par `Retouche.tsx`,
  // jamais par `Emplois.tsx`/`Emploi.tsx`. Choisie depuis la barre des
  // tables, pas dans le fil d'un emploi — c'est pour ça que son groupe suit
  // les treize de `GU5` plutôt que de s'y mêler. Groupée et vérifiée ici.

  "fabrique.superposition": {
    nom: "Superposer",
    groupe: "La fabrique Superposer",
    ou: "tables",
    quoi: "Il prend deux images — un corps nu et le même habillé — et en tire le calque de ce qu'une pièce a ajouté.",
    change:
      "Rien sur les deux images de départ, qui ne sont jamais repeintes. Elle en produit une troisième — un calque —, et un calque est solidaire de la pose sur laquelle la pièce est apparue : il en faut un par pose.",
    origine: "deux images que tu désignes, dans la même pose",
  },

  "superposition.images": {
    nom: "les deux images",
    groupe: "La fabrique Superposer",
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
    groupe: "La fabrique Superposer",
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
    groupe: "La fabrique Superposer",
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
    groupe: "La fabrique Superposer",
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
    groupe: "La fabrique Superposer",
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
    groupe: "La fabrique Superposer",
    ou: "tables",
    quoi: "De combien le dessus se déplace, en pixels de l'image rendue.",
    change:
      "Rien à la génération. Le signe suit l'écran : la touche qui monte fait monter l'image.",
    origine: "toi · proposé par le recalage",
    long:
      "Les touches sont dessinées sous chaque rail plutôt que listées dans une aide, et **elles sont aussi les boutons** : une seule chose à l'écran fait donc deux métiers — elle enseigne et elle agit. Un raccourci écrit dans une aide n'est jamais lu ; dessiné sous le réglage qu'il commande, il se voit au moment où on en a besoin. Maj multiplie le pas par dix.",
  },

  "superposition.main": {
    nom: "Garder, Retirer",
    groupe: "La fabrique Superposer",
    ou: "tables",
    quoi: "Les deux pinceaux du calque : Garder récupère un pixel que la comparaison a manqué, Retirer efface un pixel resté en trop.",
    change:
      "Le calque qui sortira, et rien d'autre : les deux images de départ ne sont jamais repeintes. C'est le rattrapage du seuil, là où aucune valeur ne distinguait la pièce du corps.",
    origine: "toi · le pinceau se règle en pixels",
    long: "Les deux pinceaux montrent le calque en cours sous l'empreinte du pinceau, pour qu'on voie ce qu'on prend. Ctrl + molette approche, Espace + glisser déplace la vue. Rouvrir un résultat retrouve ses deux images, ses réglages et les traits déjà posés.",
  },

  "superposition.seuil": {
    nom: "ce qu'on garde du dessus",
    groupe: "La fabrique Superposer",
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
    groupe: "La fabrique Superposer",
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
    groupe: "La fabrique Superposer",
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
    groupe: "La fabrique Superposer",
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
    groupe: "La fabrique Superposer",
    ou: "tables",
    quoi: "Cinq nombres : silhouette, corps repeint, ajout, échelle, compacité.",
    change:
      "Rien. **Aucune ne refuse quoi que ce soit** — elles disent si la superposition a réussi, et servent à ranger les calques d'un vestiaire dans l'ordre où il faut les regarder. Le seul refus automatique du produit reste le compte d'images.",
    origine: "une mesure sur tes deux images",
    long:
      "**Silhouette** : ce qui reste du corps de départ, proche de 1 si la forme est gardée.\n\n**Corps repeint** : la part du corps changée hors de l'ajout — beaucoup veut dire un redessin plutôt qu'un habillage.\n\n**Ajout** : ce qui est apparu, en part du corps.\n\n**Échelle** : la taille du dessus au retour, 0,62 pour un dézoom.\n\n**Compacité** : proche de 1, un objet ; proche de 0, une poussière semée.",
  },

  // ── La fabrique Découper — une planche multi-sprites, en rectangles ───────
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
    groupe: "La fabrique Découper",
    ou: "tables",
    quoi: "Comment les rectangles sont proposés : « auto » cherche les zones opaques, « grille » des cases égales, « gouttières » les bandes de fond.",
    change:
      "Ne découpe rien — propose. Ce qui part à la découpe est la liste que tu vois à droite, corrections à la main comprises. Changer ce réglage relance la détection et remplace ce que tu as dessiné. Le même écran s'ouvre par quatre portes — la table Découper d'une retouche, une carte de la toile, « Refaire le découpage » sur la fiche d'une image, et « viser ou découper une frame » dans l'atelier d'une bande — et ces cinq réglages sont les mêmes partout.",
    origine: "toi · défaut auto",
    long:
      "Auto détoure d'abord : une planche fraîche est opaque de bord à bord, sa seule zone connexe serait l'image entière.\n\nGrille répond à une autre nature de planche — sprites qui se touchent, cases vides à conserver.\n\nGouttières lisent la brute telle quelle : bandes d'une seule couleur, coupées là.\n\nUne détection à une boîte, ou aucune, est un résultat, pas une panne.",
  },

  "decoupe.taille_min": {
    nom: "taille minimale",
    groupe: "La fabrique Découper",
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
    groupe: "La fabrique Découper",
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
    groupe: "La fabrique Découper",
    ou: "tables",
    quoi: "Le nombre de rangées égales dans lesquelles la planche est coupée.",
    change:
      "Avec les colonnes, décide du nombre de découpes proposées. Une case vide donne quand même un rectangle : la grille fixe ne saute rien, et c'est ce qui la rend prévisible. Retire-le à la main si tu n'en veux pas.",
    origine: "toi · défaut 2",
  },

  "decoupe.animation": {
    nom: "en faire une animation",
    groupe: "La fabrique Découper",
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
  // ⚠️ **`atelier.navigation` décrit le châssis et non la galerie** : elle
  // se pose sur l'écran d'ouverture du produit, faute d'un `ou` pour ce
  // qui se voit partout — un point pour `GU16`, comme `bande.cadre`.
  // (Les quatre `son.*` qui logeaient ici ont quitté la galerie en
  // `GU14` : elles ont leur écran, plus bas, avec les autres fiches du son.)

  // **Tranchée en `GU16` (2/2)** : `GU12` laissait ouverte la question d'un
  // `ou` pour ce qui se voit partout. Il n'y en aura pas — un écran de guide
  // décrit l'écran qu'on a sous les yeux, et une valeur « le châssis » ne
  // serait jamais calculée par `ecranDuGuide`. La fiche reste sur l'écran
  // d'ouverture du produit, et son groupe dit en toutes lettres que la colonne
  // est la même partout.
  "atelier.navigation": {
    nom: "Replier la navigation",
    ou: "galerie",
    groupe: "La colonne de gauche — la même sur tous les écrans",
    quoi: "La colonne de gauche, la même sur tous les écrans — le jeu, sa toile, ses sujets, sa galerie, ses fabrications, sa livraison.",
    change:
      "Le bouton du haut la replie sans retirer une seule destination : il ne reste que les noms courts. Les familles et les collections se rangent sous Codex ; les outils gardent leur place dans leurs ateliers.",
    origine: "toi · dépliée au départ",
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
      "Elle devient une image entière du jeu : elle se retouche, se découpe, se réinjecte, s'exporte et se supprime comme celles que tu as payées. Sa fiche dit « importé » et un coût nul, et son nom est celui du fichier.",
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
      "Le choix vaut pour toute la séance, bouton et dépôt confondus, plutôt que de reposer la question à chaque fichier : douze fichiers déposés ensemble la poseraient douze fois.\n\nUne image entrée telle quelle le reste : « Tout réaligner » ne la touche pas, une recette vide étant un choix, pas un oubli — la même règle que pour une image ramenée au brut.",
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
      "Trois rôles envoient l'image — référence (elle inspire), source d'édition (elle engendre), guide de style (elle donne la manière). Le quatrième n'envoie rien : il reprend le prompt, le modèle et les réglages de la génération qui a produit cette image.",
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

  "bande.historique": {
    nom: "Défaire et refaire une correction",
    ou: "bande",
    groupe: "En haut de l'écran — défaire, refaire, le brouillon",
    quoi: "Revenir sur les corrections de la session, puis les rétablir.",
    change: "Le montage, les recettes, la Main, la cadence et la boucle. La lecture et le zoom ne créent pas d’étape dans cet historique.",
    origine: "Défaire / Refaire · Ctrl + Z / Ctrl + Maj + Z · Ctrl + S pour enregistrer",
    long: "Les changements restent des essais jusqu’à Enregistrer. L’historique permet de parcourir les quatre-vingts derniers états de cette session. Annuler revient au dernier état enregistré. À la réouverture, la bande reprend ses corrections enregistrées ; un brouillon non enregistré peut être repris explicitement. L’historique de gestes démarre une nouvelle session.",
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

  // **Le codex, plus la galerie** : depuis la V3.03, le montage ne règle
  // aucun traitement — il taille le mouvement —, et la recette d'une
  // animation se règle dans son atelier, qui s'ouvre depuis l'onglet
  // Animations d'un sujet.
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
      "Une recette est un ensemble : dans l'atelier d'une animation, elle remplace tous les réglages à la fois — en prendre la moitié rendrait une image que personne n'a jugée. Une recette vide ne s'enregistre pas, et rien ne s'écrit tant que tu n'as pas enregistré. Deux recettes égales sont interchangeables : en reposer une déjà appliquée ne recalcule rien.",
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
      "Une image de la bande vient toujours d'un clip, et se souvient duquel : c'est ce qui permet d'aller en rechercher une autre au même endroit. La poussée, elle, n'appartient qu'à cette image-là, et ne suit pas si on remplace sa source. Les trois lignes du dessous sont les trois gestes qu'on lui fait.",
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

  // **Tranchée en `GU16` (2/2)** : `GU11` laissait ouverte la question d'une
  // fiche partagée entre l'atelier d'une bande et le montage. Elle reste ici,
  // là où le cadre **se règle** ; le montage ne fait que le lire, et
  // `bande.montage` le dit déjà de son côté.
  "bande.cadre": {
    nom: "Le cadre de la bande",
    ou: "bande",
    groupe: "Le cadre — la fenêtre commune",
    quoi: "Le rectangle sur lequel toutes les images de la bande sont recadrées.",
    change:
      "La taille à laquelle ton personnage sort, et **si elle reste la même d'une animation à l'autre**. Pris sur le clip entier, toutes les bandes de ce clip ont la même assise ; pris sur la bande seule, elles ne s'accordent plus entre elles. L'écran du montage le montre aussi, en lecture : il ne s'y règle pas.",
    origine: "mesuré par l'atelier · repris à la main si besoin",
    long: "Sans cadre commun, chaque image se recadre sur sa propre silhouette — un bras tendu l'agrandit, donc réduit le personnage. Une fenêtre par bande cale les images entre elles ; il en faut une par clip pour caler les bandes entre elles, d'où « du clip » par défaut. Les deux autres existent : un cadrage automatique se trompe parfois, et une bande où le personnage quitte le champ a besoin du sien.",
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
    long: "Sans personnage, l'animation reste un brouillon libre ; avec un personnage mais sans mouvement, un brouillon sur sa fiche. Les choix viennent du jeu et du personnage, et une direction déjà rangée n'est pas reproposée. Reclasser ne refabrique rien. Les équipements liés à l'ancien porteur ou à l'ancienne case redemandent une vérification.",
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

  "agent.cadre-durable": {
    nom: "Le budget est réservé avant les générations",
    quoi: "Ce que l'agent a le droit de fabriquer seul dans ce jeu : le local, le payant, un nombre d'appels, un budget, un temps de calcul.",
    change:
      "Avant qu'une demande parte, l'atelier vérifie qu'il reste de l'argent et retient le montant estimé. Fermer l'atelier ne remet pas le compteur à zéro : ce cadre appartient au jeu, pas à la séance.",
    origine: "toi · un cadre par jeu, gardé avec lui",
    ou: "reglages",
    groupe: "Agent MCP — le cadre de délégation du jeu",
    long:
      "Une demande complète peut demander plusieurs générations — une référence neuve, puis un clip : le compte descend de deux. Deux demandes lancées ensemble puisent dans les mêmes limites. Le prix retenu est une estimation : une facture plus élevée est comptée quand même, et peut bloquer la suite. Le temps de calcul sonore se compte à part — c'est la carte graphique, pas de l'argent.",
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

  // ── Les tuiles — trois écrans, trois `ou` (`GU13`) ────────────────────────
  //
  // Le chantier livré le 19 septembre 2026 (`docs/PLAN-tuiles.md`) n'avait
  // encore aucune fiche : `GU13` (1/2) a d'abord réparé le routage
  // (`ecranDuGuide`, `App.tsx`) et posé trois valeurs neuves d'`Explication["ou"]`
  // — `tuiles`, `jeu-de-tuiles`, `livraison-de-tuiles` —, chacune son propre
  // lieu plutôt qu'un héritage. `GU13` (2/2) écrit ici les fiches des trois.
  //
  // `ou: "tuiles"` ne couvre que la liste des jeux (`ListeDesJeux`,
  // `Tuiles.tsx`) : ouvrir un jeu, en créer un neuf ou partir d'une image
  // quitte aussitôt ce lieu pour `jeu-de-tuiles`. `ou: "jeu-de-tuiles"`
  // couvre donc trois écrans du même composant selon `ecran` — le choix de
  // la sorte, la préparation d'un atlas depuis une image, et l'atelier
  // ouvert (`AtelierDuJeu`, `AtelierTuiles.tsx`) — et c'est le plus gros
  // morceau des trois. `tuiles.terrains` la rejoint ici, déplacée depuis
  // `ou: "codex"` où `GU12` l'avait logée à défaut d'un lieu à elle : elle
  // décrit l'éditeur d'un atlas (`EditeurTuiles`), pas le codex.

  "tuiles.carte": {
    nom: "Une carte de la liste",
    ou: "tuiles",
    groupe: "La liste des jeux de tuiles",
    quoi: "Chaque carte dit comment ce jeu a été fait : sa sorte, ses pièces, la taille d'une pièce — ou, depuis une image, les pièces retenues.",
    change: "Rien à la génération : la carte ouvre le jeu qu'elle montre, elle ne calcule rien de plus.",
    origine: "toi · calculé depuis la recette ou l'atlas déjà enregistré",
  },

  "tuiles.depuis-image": {
    nom: "À partir d'une image déjà faite",
    ou: "tuiles",
    groupe: "La liste des jeux de tuiles",
    quoi: "Ouvre l'atelier qui découpe une image déjà là en tuiles, plutôt que de dessiner un jeu neuf par sorte.",
    change: "Rien à la génération ici : le lien mène à la préparation de l'atlas, où l'on choisit l'image, la grille, puis chaque tuile.",
    origine: "toi",
  },

  "jeu-de-tuiles.sorte": {
    nom: "La sorte, et son nom",
    ou: "jeu-de-tuiles",
    groupe: "Quelle sorte de tuiles ?",
    quoi: "Sol, chemin, mur, quinze coins ou dix-sept pièces libres : la sorte décide ce que ces tuiles dessinent, et son nom se propose tout seul.",
    change: "Fixé à la création : chaque sorte a ses propres pièces et ses propres réglages, et n'en change plus une fois l'atelier ouvert.",
    origine: "toi · sol par défaut",
  },

  "jeu-de-tuiles.taille-piece": {
    nom: "La taille d'une pièce",
    ou: "jeu-de-tuiles",
    groupe: "Quelle sorte de tuiles ?",
    quoi: "La taille d'une pièce en pixels — 16, 32 ou 64 le plus souvent, ou une autre valeur dans la liste déroulante.",
    change:
      "Si le reste du jeu est dans une autre taille, ces pièces ne s'accorderont pas à tes personnages. À 96 ou 128 px : « la planche met deux à quatre fois plus de temps à se redessiner à cette taille » — sans rien changer au résultat.",
    origine: "toi · la taille du jeu par défaut",
  },

  "jeu-de-tuiles.atlas-porte": {
    nom: "Importer, choisir ou fabriquer l'atlas",
    ou: "jeu-de-tuiles",
    groupe: "Préparer l'atlas — l'image et la grille",
    quoi: "Trois façons d'obtenir l'image de l'atlas : l'importer depuis le disque, la choisir en bibliothèque, ou la fabriquer par IA.",
    change: "L'image entre en bibliothèque si elle n'y était pas encore, et y reste conservée quoi qu'il arrive ensuite à cet ensemble.",
    origine: "toi · une image du même projet",
  },

  "jeu-de-tuiles.grille-atlas": {
    nom: "Taille de tuile, marge, espacement",
    ou: "jeu-de-tuiles",
    groupe: "Préparer l'atlas — l'image et la grille",
    quoi: "La grille qui découpe l'atlas en tuiles : la taille d'une tuile, la marge extérieure, l'espacement entre les tuiles, en pixels.",
    change: "Fixe la grille de cet ensemble pour de bon : un atlas de dimensions différentes veut un nouvel ensemble, pas un changement ici.",
    origine: "toi · 16 px, aucune marge, aucun espacement par défaut",
  },

  "jeu-de-tuiles.editeur": {
    nom: "Choisir, nommer, retoucher une tuile",
    ou: "jeu-de-tuiles",
    groupe: "Préparer l'atlas — l'éditeur",
    quoi: "Choisir une tuile de l'atlas pour la nommer, la retenir, l'extraire pour la retoucher, ou la remplacer par une correction.",
    change: "Une tuile non retenue reste dans l'atlas sans entrer dans aucun terrain. Une correction doit garder la taille de la tuile, en largeur et en hauteur.",
    origine: "toi · l'atlas importé, choisi ou fabriqué",
    long:
      "Extraire pose une copie dans la bibliothèque, prête à retoucher comme n'importe quelle image ; l'utiliser comme correction remplace seulement le rendu de cette tuile-là, jamais les autres. « Retrouver la tuile d'origine » efface la correction sans toucher à la retouche gardée en bibliothèque.",
  },

  "tuiles.terrains": {
    nom: "terrains et raccords des tuiles",
    ou: "jeu-de-tuiles",
    groupe: "Préparer l'atlas — l'éditeur",
    quoi: "Le terrain au centre et sur les huit bords ou coins d'une tuile carrée.",
    change: "Les cases voisines de la carte doivent annoncer le même terrain sur leur raccord commun. Ces relations sont exportées dans le TileSet de Godot. Elles ne jugent pas les pixels eux-mêmes : les répétitions et la transparence se regardent sur la carte d'essai.",
    origine: "toi · aucun terrain implicite",
  },

  "jeu-de-tuiles.garder-atlas": {
    nom: "Garder, actualiser, restaurer",
    ou: "jeu-de-tuiles",
    groupe: "Préparer l'atlas — l'éditeur",
    quoi: "Enregistrer les changements de règles, ou repartir d'une révision précédente de cet ensemble.",
    change: "« Garder les changements » écrit une révision neuve. « Actualiser les images retouchées » en écrit une aussi, pour prendre en compte les tuiles retouchées.",
    origine: "toi · l'historique des révisions de cet ensemble",
    long:
      "« Actualiser les images retouchées » n'est proposé que quand rien d'autre n'a changé : c'est le seul cas où retoucher une tuile en bibliothèque et revenir ici suffit, sans repasser par « Garder ». « Restaurer » reprend la révision choisie dans la liste ; les révisions précédentes restent intactes.",
  },

  "jeu-de-tuiles.carte-essai": {
    nom: "La carte d'essai, et le diagnostic",
    ou: "jeu-de-tuiles",
    groupe: "Préparer l'atlas — l'éditeur",
    quoi: "Peindre la tuile choisie sur une petite carte, pour vérifier les répétitions, les coins et la transparence avant de livrer.",
    change: "Le diagnostic ne se recalcule qu'une fois les changements gardés ; il liste chaque raccord qui ne correspond pas encore à son voisin.",
    origine: "toi · les tuiles retenues et leurs terrains",
    long:
      "Le paquet Godot se télécharge directement une fois le diagnostic prêt ; « Relire la livraison Godot » montre en plus l'arbre des fichiers et les conflits, comme la livraison d'un jeu fabriqué par sorte.",
  },

  "jeu-de-tuiles.matieres": {
    nom: "La colonne des matières",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — les matières",
    quoi: "Un bouton par emplacement du jeu — surface, face, sol au pied… — avec sa matière actuelle et d'où elle vient.",
    change: "Cliquer ouvre le tiroir pour la changer. Rien ne coûte ici : chaque changement refait les pièces sur ta machine.",
    origine: "toi · Intégrée, Mes matières, Vide, ou Sur la carte seulement",
    long:
      "« Intégrée » vient du fond du moteur, dessinée à la volée depuis la graine. « Mes matières » vient d'une image de la bibliothèque. « Vide » veut dire qu'une couleur provisoire tient la place. « Sur la carte seulement » ne sert que le sol de fond, qui n'entre dans aucune pièce fabriquée.",
  },

  "jeu-de-tuiles.bordures-liees": {
    nom: "Bordure liée à sa surface",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — les matières",
    quoi: "Une bordure suit la matière de la surface qu'elle borde, tant qu'elle n'a pas sa propre matière.",
    change: "« Relier » lui redonne la matière de la surface et la suit désormais à chaque changement. La délier lui laisse sa propre matière, réglable à part.",
    origine: "toi · liée par défaut",
  },

  "jeu-de-tuiles.second-terrain": {
    nom: "Sur un autre sol",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — les matières",
    quoi: "Ajoute un second sol sous les bords de celui-ci — le sable sous l'herbe, la berge sous l'eau.",
    change: "Une matière de plus apparaît dans la colonne pour ce sol dessous, avec sa propre bordure à régler.",
    origine: "toi · éteint par défaut · seulement pour les sortes qui ont un dessous",
  },

  "jeu-de-tuiles.carte": {
    nom: "Peindre la carte",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — carte, planche, vérifier",
    quoi: "Clic ou glisser pour poser la pièce choisie ; clic droit pour l'effacer, case par case.",
    change: "Change seulement l'aperçu de test de ce jeu ; rien ne part tant que tu ne livres pas.",
    origine: "toi · une île au hasard pour commencer, sur simple demande",
    long:
      "« Île/chemins/pièces au hasard » et « Tout effacer » repartent d'un coup ; le sol de fond et le personnage ne changent que l'aperçu, pas le paquet livré. Les dix-sept pièces libres n'ont pas de carte : elles se posent à la main dans Godot, et l'onglet Planche seul les montre.",
  },

  "jeu-de-tuiles.planche": {
    nom: "La planche",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — carte, planche, vérifier",
    quoi: "Toutes les pièces fabriquées, rangées comme le TileSet de Godot les recevra ; survoler l'une d'elles dit son nom.",
    change: "Rien : la planche montre le résultat des réglages, elle ne se règle pas elle-même.",
    origine: "toi · calculée depuis les matières et les réglages fins",
  },

  "jeu-de-tuiles.verifier": {
    nom: "Vérifier",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — carte, planche, vérifier",
    quoi: "La liste des raccords qui ne correspondent pas encore entre pièces voisines, groupés par défaut semblable.",
    change: "Rien : cliquer un défaut l'amène sur la planche, surligné, pour le regarder de près.",
    origine: "toi · calculé depuis la planche fabriquée",
    long:
      "Les dix-sept pièces libres n'ont pas de raccord automatique : l'onglet dit qu'il n'y a rien à vérifier, et c'est normal. Sinon, un arrondi plus petit ou des bords moins irréguliers sont les deux premiers réglages à essayer.",
  },

  "jeu-de-tuiles.reglages-fins": {
    nom: "Arrondi, irrégularité, relief, et les autres",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — les réglages fins",
    quoi: "Les curseurs et menus qui redessinent les pièces : arrondi, irrégularité, relief, bords nets ou organiques, nuances, décor.",
    change: "Chaque changement refait toutes les pièces sur ta machine, gratuitement ; rien ne part tant que tu ne livres pas.",
    origine: "toi · valeurs par défaut raisonnables à la création",
    long:
      "Propres au mur : l'ombre du mur et la pénombre dans les angles. Propres à un sol ou un mur : les cailloux qui débordent sur la case voisine. « Réduire une image » ne sert que pour une image plus grande qu'une pièce. Variantes et animation de la pièce pleine n'existent que pour les sortes à raccords, hors les dix-sept pièces libres.",
  },

  "jeu-de-tuiles.palette-jeu": {
    nom: "Palette du jeu, mêmes couleurs",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — les réglages fins",
    quoi: "Remplace « Mêmes couleurs » par les couleurs de la palette de l'univers (TU6), quand ce jeu en a une.",
    change: "Toutes les matières intégrées se redessinent avec cette palette au lieu de leurs propres teintes.",
    origine: "l'univers du projet · indisponible tant qu'il n'a pas de palette",
    long:
      "« Mêmes couleurs pour toutes les matières » se règle à part, et se désactive tout seul dès que « Palette du jeu » est cochée : les deux ne peuvent pas décider en même temps de la teinte d'une pièce.",
  },

  "jeu-de-tuiles.graine": {
    nom: "La graine",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — les réglages fins",
    quoi: "Le nombre qui décide du dessin précis des matières intégrées, à taille et réglages égaux.",
    change: "Tirer une autre graine change seulement l'apparence des matières intégrées, jamais celle des matières venues d'une image.",
    origine: "toi · tirée au hasard à la création du jeu",
  },

  "jeu-de-tuiles.tiroir": {
    nom: "Intégrées, Mes matières",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — le tiroir de matière",
    quoi: "Choisir la matière d'un emplacement : parmi celles du moteur, ou parmi les images de tes sujets « matière ».",
    change: "Pose la matière choisie sur cet emplacement, refait ses pièces, et ferme le tiroir.",
    origine: "le moteur · les sujets de nature « matière » du jeu",
    long:
      "« Mes matières » reste vide tant qu'aucun sujet de nature « matière » n'a d'image : c'est ce que l'onglet dit dans ce cas, plutôt que de rester silencieux.",
  },

  "jeu-de-tuiles.generer-matiere": {
    nom: "C'est fait de quoi ? Le motif",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — le tiroir de matière",
    quoi: "Deux champs obligatoires : la matière seule, puis comment elle est posée sur cet emplacement précis.",
    change: "Composent le texte envoyé au modèle local ; rien ne part tant que les deux ne sont pas remplis.",
    origine: "toi · un exemple prêt selon le cadrage choisi",
    long:
      "« C'est fait de quoi ? » — la matière seule : pierre, bois, terre, sable. Le même texte pour tout le jeu, c'est lui qui fait que le sol et le mur vont ensemble. « Le motif » — comment cette matière est posée sur l'emplacement visé : dis le compte et la taille, « quatre grandes dalles, deux par deux ». Ce qui n'est pas écrit n'est pas deviné.",
  },

  "jeu-de-tuiles.cout-matiere": {
    nom: "Une matière générée, une matière intégrée",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — le tiroir de matière",
    quoi: "Une matière générée est gratuite, sur ta machine — mais elle prend du temps, et réclame le modèle installé.",
    change: "Rien à payer dans les deux cas ; seule une génération occupe la file locale, minutes par image, multipliées par les tirages.",
    origine: "ta machine · le modèle local installé",
    long:
      "Une matière intégrée ne coûte ni temps ni disque : elle se redessine à la volée depuis la graine, à chaque ouverture. Une génération attend son tour dans la file locale — l'écran annonce une durée mesurée sur ta machine une fois qu'elle existe — et reste bloquée tant que le modèle qu'elle réclame n'est pas installé. Joindre une image de référence l'allonge encore : 512 px au lieu de 256.",
  },

  "jeu-de-tuiles.entete-atelier": {
    nom: "Nom, taille, enregistrer, livrer",
    ou: "jeu-de-tuiles",
    groupe: "L'atelier — en haut de l'écran",
    quoi: "Le nom du jeu, la taille d'une pièce, et les deux gestes qui comptent : enregistrer, ou livrer à Godot.",
    change: "Enregistrer écrit une révision neuve du jeu ; livrer y mène directement s'il reste des changements non enregistrés.",
    origine: "toi",
    long:
      "Changer la taille d'une pièce ici referait toutes les pièces à la nouvelle taille — 96 ou 128 px coûtent deux à quatre fois plus de temps à se redessiner, sans rien changer au résultat, comme au choix de la sorte.",
  },

  "livraison-de-tuiles.ce-qui-part": {
    nom: "Ce qui part, et la planche",
    ou: "livraison-de-tuiles",
    groupe: "Ce qui part",
    quoi: "La liste des fichiers du paquet Godot — leur rôle et leur état — et la planche telle qu'elle sera livrée.",
    change: "Rien : cet écran ne fait que relire ce que l'atelier a déjà préparé, avant le dépôt.",
    origine: "le jeu de tuiles ouvert · préparé à l'ouverture de cet écran",
  },

  "livraison-de-tuiles.verification": {
    nom: "La vérification",
    ou: "livraison-de-tuiles",
    groupe: "La vérification",
    quoi: "Trois états possibles : rien à vérifier, des défauts qui se verront dans le jeu, ou tout se raccorde.",
    change: "Rien ici : « Voir lesquels » ramène à l'atelier, sur l'onglet Vérifier, pour corriger avant de revenir livrer.",
    origine: "calculé depuis la planche du jeu",
  },

  "livraison-de-tuiles.ou-ca-va": {
    nom: "Où ça va",
    ou: "livraison-de-tuiles",
    groupe: "Où ça va",
    quoi: "Le dossier du projet Godot où le paquet sera écrit, et les conflits qui empêchent encore le dépôt.",
    change: "Rien : ce qui existe déjà à cet endroit sera remplacé ; l'ancienne version reste dans l'historique des livraisons.",
    origine: "le projet Godot lié · l'historique des livraisons",
    long:
      "« Projet Godot et historique » ouvre l'écran qui règle le dossier lié et retrouve une livraison passée — utile si un conflit vient d'un chemin mal réglé plutôt que d'un vrai fichier à choisir.",
  },

  "livraison-de-tuiles.deposer": {
    nom: "Déposer dans Godot",
    ou: "livraison-de-tuiles",
    groupe: "Où ça va",
    quoi: "Écrit le paquet dans le projet Godot lié — seul geste de cet écran qui change quelque chose sur le disque.",
    change: "Une fois déposé, l'écran dit dans quel dossier et quelle scène ouvrir dans Godot pour voir la carte.",
    origine: "toi",
  },

  // ── Le son — deux écrans, deux `ou` (`GU14`) ─────────────────────────────
  //
  // Le son n'a jamais eu d'écran de guide : quatre fiches `son.*` logeaient
  // sous `galerie` faute de mieux, et `GU12` a laissé exprès le vrai travail
  // ici. `GU14` (1/2) a d'abord posé le routage (`ecranDuGuide`, `App.tsx`) et
  // deux valeurs neuves d'`Explication["ou"]` :
  //
  // - `son`, *Les sons* — l'atelier des sons (`AtelierSon.tsx`), avec ses
  //   réglages (`ReglagesSon.tsx`) et la relecture de sa livraison. Un
  //   dialogue posé par-dessus une racine à l'écriture de cette fiche ; `RT8`
  //   en a fait un lieu de la pile (genre `sons`, `lieux.ts`), posé sur la
  //   racine au lieu de la recouvrir, comme *Les tuiles*.
  // - `un-son`, *Un son* — le formulaire qui fabrique un son
  //   (`FabricationAudio.tsx`, `SonRetro.tsx`, `SerieSon.tsx`), corps de la
  //   fenêtre de préparation quand son type est *Son*.
  //
  // **Rien ne se paie dans tout le son**, et c'est vérifié dans le code : les
  // moteurs sont tous locaux (l'annonce de temps porte `cout_usd: 0`, la
  // consommation locale aussi), sfxr est un calcul sans modèle, l'import ne
  // fait que copier un fichier. Ce que chaque geste coûte, c'est du **temps**
  // — quelques secondes pour un bruitage, près d'une minute par tirage pour
  // YuE2 — et de la **disponibilité** : un moteur non installé est grisé.
  // Chaque fiche qui calcule le dit dans ces deux mots-là.
  //
  // Deux fiches sont posées ailleurs, parce que leur écran est ailleurs : le
  // calage sonore d'un sujet sous `sujet` (c'est son onglet *Sons*), et la
  // livraison des sons sous `sortie` (c'est l'onglet *Sons* de *Livrer au
  // jeu*).

  // ── Les sons — la liste et l'import ──────────────────────────────────────

  "son.importer": {
    nom: "Importer un son",
    ou: "son",
    groupe: "La liste des sons — importer, ouvrir",
    quoi: "Un fichier audio de ton disque entre dans le jeu comme un son, sans famille, avec sa source gardée telle quelle.",
    change:
      "Il paraît dans la liste et se règle comme les autres. La source ne change jamais : chaque réglage conservé produit une version à côté. Rien à payer, rien à calculer ailleurs que sur ta machine.",
    origine: "ton disque",
    long:
      "Formats lus : WAV, Ogg, MP3, FLAC, M4A, 256 Mo au plus. Un son importé n'a pas de famille : tant qu'on ne lui en pose pas une, il se livre à l'ancienne. Les sons fabriqués dans Un son arrivent ici aussi, avec leur famille déjà posée.",
  },

  // ── Les sons — une version : juger, classer, restaurer ───────────────────

  "son.versions": {
    nom: "Les versions d'un son",
    ou: "son",
    groupe: "Une version — choisir, juger, restaurer",
    quoi: "Chaque « Conserver une version » en ajoute une ; la liste les garde toutes, et la source reste dessous, intacte.",
    change:
      "Choisir une ancienne version la fait écouter et régler. Restaurer dans une nouvelle version la recopie en tête, sans rien effacer. La liste se fige tant que des réglages ne sont pas conservés.",
    origine: "l'atelier · une version de plus à chaque conservation",
  },

  "son.jugement": {
    nom: "À juger, retenue, écartée",
    ou: "son",
    groupe: "Une version — choisir, juger, restaurer",
    quoi: "Ton verdict sur une version : à juger au départ, retenue si tu la gardes, écartée si tu n'en veux pas.",
    change:
      "Une version écartée ne se livre pas. Une seule est retenue à la fois : en retenir une remet l'ancienne à juger. Une version silencieuse ne peut pas être retenue.",
    origine: "toi · à juger au départ",
  },

  "son.famille": {
    nom: "La famille d'un son",
    ou: "son",
    groupe: "Une version — choisir, juger, restaurer",
    quoi: "Elle décide du fichier livré : son nom, son format, son bus dans Godot. Sans famille, le son se livre à l'ancienne.",
    change:
      "Poser ou changer la famille ajoute une version, sans toucher aux réglages. Appliquer les réglages de la famille les prend en plus, et ne paraît que s'ils diffèrent des tiens.",
    origine: "toi, ou la demande qui a fabriqué le son",
    long:
      "Bruitage et interface : WAV en mono, crête à −3 dBFS. Ambiance : Ogg, −26 LUFS. Musique, jingle, chanson : Ogg, −17 LUFS, bus Music. Voix : Ogg en mono, −17 LUFS. Le nom du fichier commence par sfx_, ui_, amb_, mus_ ou vo_, puis suit le nom du son.",
  },

  // ── Les sons — l'écoute ──────────────────────────────────────────────────

  "son.ecoute": {
    nom: "Écouter, et la forme d'onde",
    ou: "son",
    groupe: "L'écoute — lecteur, forme d'onde, provenance",
    quoi: "Le lecteur joue la version conservée, celle qui sera livrée ; la case « Écouter la source » joue le fichier d'origine.",
    change:
      "Rien ne change : on écoute. Cliquer la forme d'onde place la lecture. Des réglages touchés ne s'entendent qu'après « Conserver une version ». Un son en boucle rejoue sa boucle.",
    origine: "la version ouverte",
  },

  "son.provenance": {
    nom: "Source et provenance",
    ou: "son",
    groupe: "L'écoute — lecteur, forme d'onde, provenance",
    quoi: "D'où vient ce son : le fichier d'origine, le moteur, la graine, le texte parti, la série dont il sort.",
    change:
      "Rien à régler : on lit, et on peut télécharger la source intacte. Le document brut, replié dessous, est ce que l'atelier a conservé mot pour mot.",
    origine: "l'atelier · écrit à la réception du son",
  },

  // ── Les sons — régler ────────────────────────────────────────────────────

  "son.coupe": {
    nom: "Coupe et rognage du silence",
    ou: "son",
    groupe: "Régler — coupe et fondus",
    quoi: "Le début et la fin gardés dans la source, en secondes, et le silence retiré aux deux bouts.",
    change:
      "Le rendu se refait à la conservation, la source reste intacte. Rogner le silence retire ce qui est sous le seuil aux extrémités, en gardant la marge : une sélection entièrement sous le seuil est refusée.",
    origine: "toi · source entière ; seuil à −45 dB, marge de 10 ms",
  },

  "son.fondus": {
    nom: "Fondus d'entrée et de sortie",
    ou: "son",
    groupe: "Régler — coupe et fondus",
    quoi: "Une rampe au début et à la fin du son, en millisecondes, pour qu'il ne claque pas en commençant ou en finissant.",
    change:
      "Posés après la coupe et avant le niveau. Les 5 ms du départ ne comptent pas comme un réglage : le bloc ne s'ouvre seul qu'au-delà.",
    origine: "toi · 5 ms de chaque côté",
  },

  "son.niveau": {
    nom: "Niveau : normaliser, niveau visé, gain",
    ou: "son",
    groupe: "Régler — niveau et hauteur",
    quoi: "La force du son : un niveau perçu visé pour une ambiance ou une musique, une crête pour un bruitage, puis un gain.",
    change:
      "Le niveau visé (LUFS) est un gain, pas un compresseur, et s'arrête à −1 dBTP de crête. Ailleurs, « Normaliser » ramène la crête à la cible, tous canaux ensemble. Le gain vient après.",
    origine: "toi · rien au départ, ou les réglages de la famille",
    long:
      "Le niveau visé n'existe que pour l'ambiance, la musique, la chanson, le jingle et la voix ; un bruitage est trop court pour se mesurer ainsi. Une saturation est signalée en haut de la fiche mais n'empêche rien : seul un rendu silencieux bloque la livraison.",
  },

  "son.format": {
    nom: "En mono, fréquence de sortie",
    ou: "son",
    groupe: "Régler — niveau et hauteur",
    quoi: "Mélanger les canaux en un seul, ou changer la fréquence d'échantillonnage du fichier livré.",
    change:
      "Mono fait la moyenne des canaux. Sans choix, la fréquence de la source est gardée. Bruitages et sons d'interface passent en mono avec les réglages que leur famille propose.",
    origine: "toi · stéréo et fréquence de la source",
  },

  "son.hauteur": {
    nom: "Hauteur (demi-tons)",
    ou: "son",
    groupe: "Régler — niveau et hauteur",
    quoi: "Monte ou descend le son de 24 demi-tons au plus, comme une bande qu'on accélère : plus aigu, il devient aussi plus court.",
    change:
      "La coupe est faite avant : c'est le son coupé qui est transposé, donc la durée conservée change, et la boucle se règle sur la durée obtenue.",
    origine: "toi · aucun décalage",
  },

  "son.boucle": {
    nom: "Jouer en boucle",
    ou: "son",
    groupe: "Régler — la boucle",
    quoi: "Le passage à rejouer sans fin, après la coupe et les fondus : un début et une fin, en secondes.",
    change:
      "Les repères partent avec le fichier, dans le .import que Godot lit ; un Ogg s'arrête à la fin de la boucle. Un son fabriqué avec un nombre de mesures propose sa boucle pile sur une mesure.",
    origine: "toi · lecture unique au départ",
  },

  "son.raccord": {
    nom: "Le raccord",
    ou: "son",
    groupe: "Régler — la boucle",
    quoi: "Recaler sur un passage par zéro, fondu enchaîné, et « Écouter le raccord » : les deux secondes autour du saut.",
    change:
      "Le verdict, raccord net ou le raccord claque, se mesure sur la version conservée : il faut d'abord en conserver une. Le recalage cherche à 50 ms des repères ; le fondu mêle la fin de la boucle à son début.",
    origine: "toi · sans recalage ni fondu",
  },

  // ── Les sons — conserver, relire, livrer ─────────────────────────────────

  "son.conserver": {
    nom: "Nom, conserver, abandonner",
    ou: "son",
    groupe: "Conserver, relire, livrer",
    quoi: "Le nom du son, et le bouton qui écrit tes réglages dans une nouvelle version. Abandonner les remet à la version ouverte.",
    change:
      "Conserver ne touche jamais la source : il ajoute une version, qu'on peut rouvrir. Il ne se fait que depuis la dernière version. Le nom compte : c'est de lui que vient le nom du fichier livré.",
    origine: "toi · le nom du fichier, ou de la demande",
    long:
      "Un son qui s'appelle « Épée qui frappe » et qui est un bruitage se livre sous le nom sfx_epee_qui_frappe. Renommer un son déjà livré change donc le nom de son fichier dans le jeu.",
  },

  "son.livraison": {
    nom: "Relire la livraison Godot",
    ou: "son",
    groupe: "Conserver, relire, livrer",
    quoi: "La liste des fichiers qui partiraient dans ton projet Godot, avec leurs noms stables, sans rien écrire encore.",
    change:
      "Livrer cette version écrit le paquet dans le projet Godot lié. Un fichier que l'atelier n'a pas écrit est signalé en conflit, et se tranche dans Livrer au jeu. Rien à payer.",
    origine: "la version ouverte · le projet Godot lié",
    long:
      "Le bouton attend une version conservée, audible et non écartée. Credits.json dit d'où vient chaque son : moteur, licence, graine, texte parti. Chaque .import dit à Godot si le son boucle. L'archive du paquet se télécharge aussi, sans projet lié.",
  },

  // ── Un son — la demande ──────────────────────────────────────────────────

  "son.demande-famille": {
    nom: "La famille demandée",
    ou: "un-son",
    groupe: "La demande — famille, texte, paroles",
    quoi: "Ce qu'on fabrique : un bruitage, un son d'interface, une ambiance, une musique, un jingle ou une chanson. La voix est à venir.",
    change:
      "Elle décide de ce qui suit : les réglages qui paraissent, les moteurs proposés, la forme du fichier livré. Elle est posée sur les sons qui arrivent, sans rien à refaire.",
    origine: "toi · bruitage au départ",
  },

  "son.texte": {
    nom: "Ce qu'on doit entendre",
    ou: "un-son",
    groupe: "La demande — famille, texte, paroles",
    quoi: "Une phrase en anglais sur ce qu'on entend, pas un titre. Elle part avec ce que l'univers du jeu y ajoute.",
    change:
      "Le texte part au moteur local sans traduction : un texte français est signalé, pas corrigé. Rien ne part avant « Lancer ». L'interface et rétro n'en prend pas : elle part d'un départ.",
    origine: "toi · vide, avec un exemple gris",
  },

  "son.paroles": {
    nom: "Paroles et partition",
    ou: "un-son",
    groupe: "La demande — famille, texte, paroles",
    quoi: "Pour une chanson : les paroles avec leurs repères, et une partition que YuE2 écrit d'abord, qu'on corrige, puis qu'on joue.",
    change:
      "Écrire la partition n'envoie que le premier étage ; Jouer cette partition envoie le second avec le texte relu, tel quel. Tout se calcule sur ta machine, gratuitement, et longtemps.",
    origine: "toi · repères Intro, Verse, Chorus, Outro",
    long:
      "YuE2 est le plus lent des moteurs sonores. Lancer N tirages fait les deux étages d'un coup, pour une série ; la partition à la main sert à corriger la mélodie avant de la jouer. Les paroles ne partent que si le moteur choisi les reçoit.",
  },

  "son.relecture": {
    nom: "Relire avant l'envoi",
    ou: "un-son",
    groupe: "Relire ce qui part",
    quoi: "Le texte final tel qu'il sera envoyé : le tien en noir, ce que l'univers et le moteur ajoutent en gris.",
    change:
      "Éditer ce texte le remplace à la main, pour cette série seulement ; Revenir au texte composé rend la main. Rien ne part avant « Lancer ».",
    origine: "l'univers du jeu · le moteur · toi",
  },

  // ── Un son — les réglages ────────────────────────────────────────────────

  "son.duree": {
    nom: "Durée",
    ou: "un-son",
    groupe: "Réglages — durée, tirages, moteur",
    quoi: "La longueur demandée au moteur : quelques secondes pour un bruitage ou un jingle, une demi-minute et plus pour une ambiance.",
    change:
      "Elle vient des puces de la famille : 0,5 à 4 s pour un bruitage, 20 à 60 s pour une ambiance, 2 à 8 s pour un jingle. Plus le son est long, plus le calcul l'est. Une musique se compte en mesures.",
    origine: "toi · 1 s, 30 s, 4 s selon la famille",
    long:
      "Un bruitage demandé plus court que le minimum du moteur est calculé à ce minimum, puis coupé à la durée voulue : la coupe est déjà posée dans sa première version. Une chanson n'a pas de durée à choisir.",
  },

  "son.tirages": {
    nom: "Les tirages",
    ou: "un-son",
    groupe: "Réglages — durée, tirages, moteur",
    quoi: "Combien de sons d'un coup : autant de calculs, chacun avec sa graine, pour choisir à l'oreille.",
    change:
      "4, 8 ou 12 pour un bruitage, une ambiance ou l'interface ; 2, 4 ou 6 pour une musique ; 2, 4 ou 8 pour un jingle ou une chanson. Le temps annoncé grandit avec eux ; aucun ne coûte d'argent.",
    origine: "toi · 8, ou 4 pour la musique et la chanson",
  },

  "son.moteur": {
    nom: "Fournisseur et modèle",
    ou: "un-son",
    groupe: "Réglages — durée, tirages, moteur",
    quoi: "Le modèle local qui calcule le son : celui de la famille au départ, les autres installés sur cette machine en choix.",
    change:
      "Un moteur absent ou incomplet est grisé avec ce qui manque ; l'installer se fait dans Réglages, onglet Moteurs. Tous tournent sur ta machine, sans clé ni compte : aucun ne se paie, tous prennent du temps.",
    origine: "la famille · les moteurs installés",
    long:
      "Les moteurs connus : Stable Audio 3 Small-SFX, Stable Audio Open 1.0, Stable Audio 3 Medium, ACE-Step 1.5 et YuE2. Chaque famille propose ceux qui lui vont, et le premier tirage d'un moteur paie son chargement en mémoire.",
  },

  "son.musique": {
    nom: "Tempo, tonalité, mesure, mesures",
    ou: "un-son",
    groupe: "Musique — tempo, tonalité, mesures",
    quoi: "La vitesse, la gamme, la mesure et la longueur d'une musique, comptée en mesures et non en secondes.",
    change:
      "Seuls les réglages que le moteur reçoit partent ; les autres sont grisés, et la boucle se compte alors en 4/4. La durée de la boucle affichée compte une marge pour la couper proprement.",
    origine: "toi · 16 mesures en 4/4 ; tempo et tonalité de l'univers, sinon 90",
  },

  "son.adaptative": {
    nom: "Une musique qui s'adapte",
    ou: "un-son",
    groupe: "Musique — tempo, tonalité, mesures",
    quoi: "Assemble des musiques déjà gardées : des couches qu'on monte ou baisse, ou des morceaux qui s'enchaînent sur la mesure.",
    change:
      "Aucun tirage : rien n'est calculé, rien n'est payé, on compose avec ce qui existe. Voir ce qui part au jeu relit les fichiers avant d'écrire quoi que ce soit dans le projet Godot.",
    origine: "les musiques gardées du jeu",
    long:
      "Une couche joue avec les autres, à un volume de −80 à +6 dB. Un morceau s'enchaîne à un autre par une transition : départ (tout de suite, au temps, à la mesure, à la fin), arrivée et fondu. Seules les musiques, jingles et chansons prêts sont proposés.",
  },

  "son.retro": {
    nom: "Interface et rétro",
    ou: "un-son",
    groupe: "Interface et rétro — sans texte",
    quoi: "Pas de texte : on part d'un départ — clic, saut, pièce, explosion — et sfxr calcule le son en un instant.",
    change:
      "Un son en fait un ; Tirer N variantes en fait 4, 8 ou 12 autour du départ, ou autour du son seul quand il n'y en a qu'un. Aucune IA, aucun modèle, aucune attente, aucun prix : le calcul se fait dans l'atelier.",
    origine: "toi · départ « clic », 8 variantes",
  },

  // ── Un son — lancer, écouter, garder ─────────────────────────────────────

  "son.lancer": {
    nom: "Lancer N tirages",
    ou: "un-son",
    groupe: "Lancer, écouter, garder",
    quoi: "Le bouton qui envoie la demande au moteur local, avec le temps que le calcul prendra sur cette machine.",
    change:
      "Le temps vient des calculs déjà faits ici ; s'il est inconnu, le premier tirage le mesure. Rien ne se paie : c'est ta carte graphique qui travaille. Une série coupée se reprend d'un geste, sans refaire les tirages rendus.",
    origine: "les calculs déjà faits sur ta machine",
    long:
      "De l'ordre d'une seconde par bruitage, quelques secondes pour ACE-Step, 35 à 95 s pour un tirage de YuE2 (relevé du 19 septembre 2026, carte de 8 Go). Le premier tirage de chaque moteur paie en plus son chargement.",
  },

  "son.serie": {
    nom: "Écouter et garder les tirages",
    ou: "un-son",
    groupe: "Lancer, écouter, garder",
    quoi: "Une forme d'onde par tirage : un clic écoute, « Garder » le range dans le jeu de variantes, les autres restent dans la série.",
    change:
      "Garder écrit tout de suite : le premier gardé forme le jeu et reçoit les réglages de sa famille, les suivants s'y ajoutent, un tirage dégardé en sort. Saturé et silencieux informent, ils n'empêchent rien.",
    origine: "les tirages de la série",
  },

  "son.variantes": {
    nom: "Le jeu de variantes",
    ou: "un-son",
    groupe: "Lancer, écouter, garder",
    quoi: "Les tirages gardés ensemble sous un seul nom : le jeu en joue un au hasard, jamais deux fois le même de suite.",
    change:
      "Le nom du jeu se change dans son champ : c'est lui que Godot verra. Régler ouvre un tirage dans l'atelier des sons ; Voir ce qui part au jeu relit les fichiers, sans rien écrire.",
    origine: "toi · le nom de la demande",
  },

  // ── Les sons d'un sujet — deux fiches posées sous `sujet` ────────────────

  "son.emplacements": {
    nom: "Les emplacements de sons",
    ou: "sujet",
    groupe: "L'onglet Sons — les emplacements d'un sujet",
    quoi: "Les sons que sa famille prévoit — pas, saut, coup — remplis ou vides ; on peut en nommer d'autres à la main.",
    change:
      "Un emplacement vide lance une série déjà décrite par le sujet ; garder un tirage le range dans le jeu de l'emplacement, sous un nom stable qui suit le nom du sujet. Renommer le sujet renommerait ses sons dans le jeu.",
    origine: "la famille du sujet · toi pour les emplacements ajoutés",
  },

  "son.calage": {
    nom: "Caler un son sur une animation",
    ou: "sujet",
    groupe: "L'onglet Sons — les emplacements d'un sujet",
    quoi: "Un son gardé se cale sur une image d'une animation : « image 3 : pas ». Jouer le fait entendre à chaque passage.",
    change:
      "Le repère tient à l'image, pas à un temps : changer la cadence ici change celle de l'animation, et le repère reste sur son image. Une voix ne se cale pas. Rien à payer.",
    origine: "toi · les animations du sujet",
  },

  // ── Livrer au jeu — l'onglet Sons ────────────────────────────────────────

  "livraison.sons": {
    nom: "Les sons dans Godot",
    ou: "sortie",
    groupe: "Livrer dans Godot — les sons",
    quoi: "Les sons du jeu rangés par famille : un jeu de variantes part comme un seul son, un tirage jamais gardé ne part pas.",
    change:
      "Voir ce qui part au jeu relit les fichiers de la ligne ; rien n'est écrit tant qu'on n'a pas livré. Les sons d'un sujet partent aussi avec lui, sous leurs noms stables.",
    origine: "les sons gardés du jeu",
  },

  // ── Relire avant l'envoi — le seul écran d'où l'argent part (`GU15`) ───────
  //
  // `Envoi.tsx` monte, dans le cadre commun de `Relecture.tsx`, ce qu'une
  // **image fixe** a de particulier. Les autres relectures — un clip, un son,
  // un rendu 3D — ont leur propre corps et leur propre fenêtre.
  //
  // **Ce qui coûte de l'argent, et ce qui n'en coûte pas, est dit à chaque
  // fiche qui le touche** — et c'est vérifié dans le code, pas supposé. Tout ce
  // qui se lit ou se corrige ici ne coûte rien : rien n'est appelé avant le
  // bouton du bas. Le bouton a trois formes : *Payer et lancer* (un fournisseur
  // qui facture en dollars), *Lancer sur ma carte graphique* (un style local :
  // un temps, jamais un prix) et *Lancer la fabrication* (un modèle dont la
  // consommation se compte dans une autre unité). **Sans montant écrit, le
  // coût est inconnu et l'argent part quand même** : c'est la seule phrase de
  // l'écran qu'on ne peut pas se permettre de ne pas lire.
  //
  // **Les fiches suivent l'écran de haut en bas, colonne de gauche puis colonne
  // de droite**, comme le fait `Envoi.tsx` : le cadre, le résumé en trois
  // cases, les textes, le fond, le retour, les images, les consignes, le pied.
  // `envoi.ecran`, plus haut, ouvre la liste : elle a été déplacée sous ce
  // `ou` depuis `sujet`.

  "envoi.cadre": {
    nom: "Modifier l'envoi, Fermer",
    ou: "envoi",
    groupe: "Le cadre — ce qui s'ouvre avant la dépense",
    quoi: "À l'ouverture l'écran se lit sans rien pouvoir changer ; Modifier l'envoi ouvre les interrupteurs, les corrections et les images.",
    change:
      "Terminer les modifications les referme. Les modifications ne valent que pour cette génération : l'univers reste inchangé. Fermer, ou Échap, revient sans rien dépenser ; le bouton est retenu tant que l'envoi est en cours.",
    origine: "toi · verrouillé à l'ouverture",
  },

  "envoi.modele-et-resultat": {
    nom: "Fournisseur et modèle, Résultat demandé",
    ou: "envoi",
    groupe: "Le résumé en trois cases",
    quoi: "Le modèle qui recevra la demande, son identifiant dessous, puis ce qu'on lui demande : format, générations, options réglées.",
    change:
      "Rien à régler ici : ces deux cases lisent ce qui a été choisi à la préparation. Le nombre de générations est celui des appels que le prix compte.",
    origine: "la préparation · le modèle et le format choisis",
  },

  "envoi.consommation": {
    nom: "Consommation estimée",
    ou: "envoi",
    groupe: "Le résumé en trois cases",
    quoi: "Ce que l'appel devrait coûter : des dollars chez un fournisseur payant, un temps sur un style local — et, dessous, d'où vient le chiffre.",
    change:
      "C'est une estimation, jamais une facture : la ligne du dessous dit sur combien de générations passées elle est mesurée. Sans mesure, l'écran écrit « Coût inconnu » et non $0,0000, qui se lirait gratuit ; le montant réellement payé se lit ensuite dans les dépenses.",
    origine: "mesure · générations déjà passées à ce modèle, sinon durée mesurée sur cette machine",
    long:
      "Une moyenne n'est le prix de personne : elle ne tombera juste sur aucune génération donnée. Chaque image jointe ajoute son propre pas, mesuré sur ses propres générations ; quand il n'est pas mesurable, le chiffre est la médiane, images comprises. Sur un style local, la ligne dit d'où vient la durée : mesurée sur cette machine, ou la vitesse du style à défaut.",
  },

  "envoi.textes": {
    nom: "Textes envoyés",
    ou: "envoi",
    groupe: "Les textes envoyés — lire, éteindre, corriger",
    quoi: "Le texte exact que le modèle reçoit, mot pour mot, rangé en parties : le contexte, les références, la demande.",
    change:
      "Rien n'est résumé ni réécrit : ce qu'on lit est ce qui part. Un style local reçoit son texte d'un bloc, avec ce qui n'est pas parti et pourquoi. On lit d'abord ; on change avec Modifier l'envoi.",
    origine: "l'atelier · composé par le serveur, dans l'ordre de l'envoi",
  },

  "envoi.interrupteur": {
    nom: "L'interrupteur d'une ligne",
    ou: "envoi",
    groupe: "Les textes envoyés — lire, éteindre, corriger",
    quoi: "Le carré à gauche d'une ligne : plein, elle part ; creux, elle ne part pas ; gris, elle part et ne se décoche pas.",
    change:
      "Ce qui est éteint n'est pas envoyé, et les textes et le coût se recalculent. Cela ne vaut que pour cet appel : le sujet, l'ambiance et les règles du jeu ne bougent pas. Les lignes sont rangées en groupes : textes du jeu, ambiance, sujet, planche, ce que les images disent, caméra.",
    origine: "toi · pour cet appel seulement",
    long:
      "Éteindre les trois lignes d'une ambiance rallume d'elles-mêmes les textes du jeu qu'elle remplaçait : on ne garde que des écarts, jamais un état complet. Une ligne marquée « remplacé ↓ » est masquée par celle du dessous.",
  },

  "envoi.corriger": {
    nom: "Corriger, remettre, garder",
    ou: "envoi",
    groupe: "Les textes envoyés — lire, éteindre, corriger",
    quoi: "Corriger réécrit le texte d'une ligne ; remettre rend l'original ; « garder sur le sujet › » l'inscrit sur la fiche du sujet.",
    change:
      "Une correction ne vaut que pour cet appel et ne remonte nulle part : garder est un second geste, écrit, proposé seulement quand une fiche peut la recevoir. Le texte corrigé part mot pour mot.",
    origine: "toi · pour cet appel seulement",
  },

  "envoi.texte-a-la-main": {
    nom: "Modifier le texte complet à la main",
    ou: "envoi",
    groupe: "Les textes envoyés — lire, éteindre, corriger",
    quoi: "Le champ de la demande reçoit tout le texte assemblé, et c'est ce texte-là qui part, mot pour mot.",
    change:
      "L'écran se referme sur la préparation, sans rien envoyer : on écrit dans le champ, puis on lance comme d'habitude. Ce n'est plus la somme des lignes qui part, c'est ce champ.",
    origine: "toi · le texte assemblé au moment du clic",
  },

  "envoi.fond": {
    nom: "Fond et prompt négatif",
    ou: "envoi",
    groupe: "Le fond et le prompt négatif",
    quoi: "La couleur de fond demandée et, dessous, la consigne négative : ce qu'on interdit au modèle.",
    change:
      "Avec Modifier l'envoi, on prend une autre couleur, « Sans fond » ou « Reprendre la couleur calculée » ; cela ne vaut que pour cet appel. Le titre se réduit à « Fond » quand un style local ne lit pas le négatif : le fond part quand même, et le détourage au retour en dépend.\n\nSans image jointe, l'atelier regarde aussi ce que tu as écrit : si ta description nomme une couleur — « cape verte », « red cloak » — il évite un fond de cette couleur-là plutôt que de retomber sur le vert de studio par défaut, et te dit pourquoi juste en dessous.",
    origine: "l'atelier · la couleur calculée sur les images envoyées ou, à défaut, sur les couleurs que ta description nomme, et l'interdiction qui en découle",
  },

  "envoi.retour": {
    nom: "Traitements appliqués au retour",
    ou: "envoi",
    groupe: "Au retour, sur la machine",
    quoi: "Ce que l'atelier fait à l'image une fois reçue : la liste s'ouvre d'un clic et se lit sans rien changer.",
    change:
      "Rien de tout cela ne part au modèle ni ne coûte un centime : ça se passe sur cette machine, et les originaux sont conservés. Ces traitements se modifient dans la retouche, à un seul endroit.",
    origine: "les règles du jeu et la retouche · appliqués après l'arrivée",
  },

  "envoi.images": {
    nom: "Images envoyées",
    ou: "envoi",
    groupe: "Les images envoyées et les consignes",
    quoi: "Chaque image jointe, avec sa vignette, sa provenance et son prix ; « n images · m places » dit combien le modèle en accepte.",
    change:
      "Avec Modifier l'envoi, on décoche une image : elle ne part plus, pour cet appel seulement, et le coût se recalcule. La barre d'espace l'ouvre en grand ; « Ajouter une référence » en joint une de plus sans quitter l'écran. Une image au-delà des places du modèle est marquée.",
    origine: "les références du jeu, du sujet et de l'appel · les places du modèle",
    long:
      "Chaque image cochée ajoute son prix, écrit sur sa ligne — sauf chez un fournisseur qui ne facture pas. Une planche jointe n'a pas de case : il n'y a rien à décider. Un style local dit ce qu'il fait d'une image jointe : la garder comme sujet, ou repeindre par-dessus.",
  },

  "envoi.consignes": {
    nom: "Consignes facultatives",
    ou: "envoi",
    groupe: "Les images envoyées et les consignes",
    quoi: "Des consignes en plus, chacune avec son texte et son interrupteur, que le modèle sait suivre ou non.",
    change:
      "Éteinte, une consigne ne part pas ; cela ne vaut que pour cet appel. Une consigne que le modèle ne sait pas suivre reste visible, grisée, avec ce qui l'empêche, plutôt que de disparaître.",
    origine: "le modèle · ses options, avec leur texte",
  },

  "envoi.prix": {
    nom: "Le prix au pied de l'écran",
    ou: "envoi",
    groupe: "Le pied — le prix, et le bouton qui lance",
    quoi: "Le même chiffre que la case du haut, répété là où l'on décide : « estimation » quand il est chiffré, un temps pour un style local.",
    change:
      "Dessous, « Aucune génération avant de lancer » dit que rien n'est parti. Un refus s'écrit en rouge et retient le bouton ; un appel parti revenu sans image s'écrit en rouge aussi, et le bouton reste vivant. Il attend aussi la fin de l'actualisation des textes, des images et du coût.",
    origine: "la case Consommation estimée · répétée au pied",
  },

  "envoi.avertissements": {
    nom: "Le compte des avertissements",
    ou: "envoi",
    groupe: "Le pied — le prix, et le bouton qui lance",
    quoi: "« N avertissements — non bloquants » : chacun est écrit là où il porte, sur sa ligne de texte ou dans le bloc des images.",
    change:
      "Aucun ne retient le bouton : on peut lancer avec. Le compte dit qu'il y en a, sans qu'on ait à descendre les chercher.",
    origine: "l'atelier · la liste entière, lignes et images mêlées",
  },

  "envoi.sauter": {
    nom: "Ne plus me le montrer pour cette série",
    ou: "envoi",
    groupe: "Le pied — le prix, et le bouton qui lance",
    quoi: "Une case pour sauter cet écran tant qu'on reste sur le même sujet et la même pose. Elle ne paraît que si une case du jeu est visée.",
    change:
      "Cochée, le bouton de la barre lance directement — et paie, si le modèle est payant : c'est la seule façon de lancer sans dernière relecture. L'écran revient dès qu'on change de sujet ou de pose. Sur une image libre, sans sujet ni pose, il n'y a pas de suivante qui lui ressemble : la case est absente, et il n'y a pas de case « pour toujours ».",
    origine: "toi · décochée au départ",
  },

  "envoi.bouton": {
    nom: "Payer et lancer, Lancer sur ma carte graphique, Lancer la fabrication",
    ou: "envoi",
    groupe: "Le pied — le prix, et le bouton qui lance",
    quoi: "Le seul bouton d'où l'argent part : son mot dit s'il paie, s'il lance sur ta machine, ou si le modèle ne facture pas en dollars.",
    change:
      "« Payer et lancer $0,0245 » : l'appel part chez le fournisseur et se facture ; le montant est l'estimation. Sans montant — « Payer et lancer » seul —, le coût est inconnu et l'argent part quand même. « Lancer sur ma carte graphique » : un style local se lance, il ne se paie pas. « Lancer la fabrication » : le modèle compte sa consommation dans une autre unité que les dollars.",
    origine: "le modèle · le fournisseur, ou le style local, qui reçoit la demande",
    long:
      "Le bouton devient « Envoi en cours… » dès le premier clic et ne repart pas : un second clic ne repaie pas. Un appel parti qui revient sans image s'écrit en rouge au pied de l'écran, et le bouton reste vivant — mais en refaire un se paie de nouveau.",
  },

  // ── Sur la grille du jeu — la page d'un sujet, posée sur les cases (`GU15`) ─
  //
  // `GrilleDuJeu.tsx` **ne fabrique rien, ne modifie rien, ne coûte rien** : ni
  // barre qui paie, ni bouton qui écrit. Deux contrôles (le zoom, les
  // voisins), un volet de lecture. Les clés portent `grille-du-jeu.` et non
  // `grille.`, qui est déjà le préfixe des réglages de la table Pixelisation
  // (`ou: "tables"`) : `grille.occupation` et `grille.ancrage` y décrivent ce
  // qu'on *règle*, ici on ne fait que *lire* les mêmes valeurs.

  "grille-du-jeu.zoom": {
    nom: "Le zoom ×1, ×2, ×4, ×8",
    ou: "grille",
    groupe: "Le zoom",
    quoi: "Un facteur entier, jamais un zoom continu : à ×1,5 un pixel du jeu n'est plus un carré.",
    change:
      "Grossit ensemble le sujet, ses voisins et les cases, sans toucher à l'image. Rien à la génération, rien d'écrit.",
    origine: "toi · ×2 au départ",
    long:
      "Un facteur non entier fabrique des pixels qui n'existent pas : certains carrés du jeu deviendraient plus larges que d'autres, et l'on jugerait une image que le jeu n'affichera jamais. C'est la même règle que la vitrine du sujet.",
  },

  "grille-du-jeu.voisins": {
    nom: "À côté de lui",
    ou: "grille",
    groupe: "À côté de lui — juger l'échelle",
    quoi: "Allume un autre type de sujet à côté du sien : une silhouette grise à la hauteur que le barème du jeu lui donne, avec son %.",
    change:
      "C'est un type, pas un vrai sujet du jeu : rien n'est cherché ni fabriqué, et rien ne s'écrit. Ça sert à juger l'échelle du sujet par rapport à ce qui l'entoure.",
    origine: "le barème du jeu · un exemplaire de chaque autre type",
  },

  "grille-du-jeu.occupation": {
    nom: "Ce qu'il occupe",
    ou: "grille",
    groupe: "Ce qu'il occupe — le volet",
    quoi: "Son type de sujet, sa part de la case, la case du jeu, puis son ancrage, son décalage, sa réduction et s'il se détoure.",
    change:
      "Rien à régler ici : c'est une lecture. La part de la case et « Se détoure » viennent du barème du jeu, que règle la famille du type ; l'ancrage, le décalage et la réduction viennent de la recette de son portrait, et se règlent dans la retouche.",
    origine: "le barème du jeu · la recette de l'image qui sert de portrait",
    long:
      "Sans image pour le portrait, les trois dernières lignes disent les valeurs par défaut — en bas, 0 px, au plus proche — et non celles d'une image réelle. Sans taille de case imposée, la ligne « La case du jeu » écrit « aucune imposée ».",
  },

  "grille-du-jeu.plafond": {
    nom: "Le plafond réel de sa case, le barème du jeu",
    ou: "grille",
    groupe: "Ce qu'il occupe — le volet",
    quoi: "Le pourcentage maximal qu'un sujet peut occuper sur cette case, puis la liste des types du jeu avec leur part de case.",
    change:
      "Rien à régler ici. Le plafond est de 800 % — huit personnages de haut — au plus ; il descend quand la toile de 2 048 px de côté ne suffit plus pour la case du jeu. Le type du sujet est surligné dans la liste.",
    origine: "le calcul de la retouche · le barème du jeu",
  },

  // ── Deux côte à côte — comparer, sans rien fabriquer (`GU15`) ──────────────
  //
  // `Comparer.tsx` porte **trois écrans sous un seul composant**, et son `<h1>`
  // change avec le mode : *Le même, deux fois* (deux images d'un sujet),
  // *Deux animations, même temps* et *Deux côte à côte* (deux sujets). Les
  // fiches disent le cas général et, quand un contrôle n'existe que dans un
  // mode, le mode. **Un seul geste écrit** dans tout l'écran : *Choisir pour le
  // jeu*, sur des animations — il retient l'une et éteint ses sœurs. Le reste
  // ne fabrique rien, ne modifie rien, ne coûte rien.

  "comparer.avec": {
    nom: "Comparer avec",
    ou: "comparer",
    groupe: "Ce qu'on compare",
    quoi: "Ses images, ses animations, ou un autre sujet du jeu : ce choix décide de ce que l'écran compare, et de son titre.",
    change:
      "Le titre le dit : « Le même, deux fois » pour deux de ses images, « Deux animations, même temps » pour deux animations, « Deux côte à côte » pour deux sujets. Comparer ne coûte rien et n'écrit rien — sauf « Choisir pour le jeu » sur des animations.",
    origine: "toi · un autre sujet du jeu, quand il y en a un",
  },

  "comparer.pose": {
    nom: "La pose, le mouvement, les versions comparées",
    ou: "comparer",
    groupe: "Ce qu'on compare",
    quoi: "Quelle pose ou quel mouvement on regarde, puis quelle version de chaque côté, repérée par sa date.",
    change:
      "Pour des images : une pose qui en porte au moins deux. Pour des animations : un mouvement qui en porte deux, dans la même direction, repérées par leur date et leur cadence. Changer de mode remet la pose à la première disponible.",
    origine: "les images et les animations du sujet",
  },

  "comparer.affichage": {
    nom: "Zoom, alignés ou superposés",
    ou: "comparer",
    groupe: "Comment on le regarde",
    quoi: "Le zoom en crans entiers ×1 à ×8, et — pour des images — alignés au sol ou superposés.",
    change:
      "Ne change que l'écran, jamais l'image ni ce qui sort à l'export. Superposés pose la seconde image à moitié transparente sur la première, au même sol. Le zoom est plafonné pour que la scène reste lisible, même à ×8.",
    origine: "toi · ×4, alignés au sol au départ",
  },

  "comparer.lecture": {
    nom: "Lire ensemble, Remettre au début, image d'avant et d'après, vitesse",
    ou: "comparer",
    groupe: "Comment on le regarde",
    quoi: "Une seule horloge pour les deux animations : pause, remise au début, un cran à la fois, et une vitesse ×0.5, ×1 ou ×2.",
    change:
      "Chaque côté joue à sa propre cadence, celle qui sortira à l'export : la vitesse ne vaut que pour l'écran. Un cran avance du plus court des deux temps d'image et arrête la lecture ; « Remettre au début » est le seul geste qui remet les deux en phase.",
    origine: "toi · en lecture, ×1 au départ",
  },

  "comparer.ecarts": {
    nom: "Les écarts, chiffrés",
    ou: "comparer",
    groupe: "Ce que les chiffres disent",
    quoi: "Un tableau : ce que mesure chaque côté, l'écart entre les deux, et sur fond rouge ce qui sort de la norme du jeu.",
    change:
      "Quatre lignes pour des images — hauteur, largeur, contour, couleurs —, cinq pour des animations — frames, cadence, temps d'image, sens, tour. Rien n'y est mesuré de neuf : ce sont des nombres que le produit calculait déjà, et l'ombre n'est pas mesurée.",
    origine: "les images et les animations, telles que le jeu les exporte",
  },

  "comparer.pas-ensemble": {
    nom: "Ce qui ne va pas ensemble",
    ou: "comparer",
    groupe: "Ce que les chiffres disent",
    quoi: "Pour des images : un défaut par carte — une image qui dépasse sa case, un contour différent, des couleurs au-delà de la palette.",
    change:
      "Rien ne se paie ici. « La retoucher » ouvre la retouche sur cette image ; « sa dernière génération a coûté » n'est qu'un repère avant de décider d'en refaire une, depuis la page du sujet.",
    origine: "la case du jeu, le contour et la palette de l'univers",
  },

  "comparer.ce-qui-les-separe": {
    nom: "Ce qui les sépare",
    ou: "comparer",
    groupe: "Ce que les chiffres disent",
    quoi: "Pour des animations : ce qui les distingue, en phrases — la cadence, le sens, le nombre de frames. Des écarts, pas des fautes.",
    change:
      "Rien en rouge : deux cadences différentes sont souvent ce qu'on vient départager. Si rien ne diffère, le volet dit qu'elles jouent pareil, et que la différence est ce qui est dessiné dedans.",
    origine: "les deux animations choisies",
  },

  "comparer.retenu": {
    nom: "Retenu, Non jugé, Écarté",
    ou: "comparer",
    groupe: "Le verdict sur une animation",
    quoi: "Sous chaque animation, son verdict — non jugé, retenu, écarté — et « Choisir pour le jeu » retient celle-ci.",
    change:
      "C'est le seul geste qui écrit sur cet écran : il retient cette animation et éteint ses sœurs. Il change laquelle sort dans le jeu, jamais comment elle joue. « La retoucher » ouvre son atelier. Rien à payer.",
    origine: "toi · non jugé au départ",
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
