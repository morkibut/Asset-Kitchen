# Asset Kitchen — Les 333 user stories

Le catalogue, groupé comme il l'a été écrit — par geste, dans l'ordre où l'auteur les
rencontre. **On l'ouvre par numéro** : un critère d'acceptation cite `US-65`, on vient
lire ce qu'elle demande.

**`docs/PRD.md` fait foi sur ce que le produit doit faire.** Ce fichier-ci en est le
détail énuméré, pas une autorité de plus : en cas d'écart, le PRD a raison. Quelle tranche
porte quelle story se lit dans `docs/PLAN.md`, § Couverture ; ce qu'une tranche en a fait,
dans `docs/tranches/<code>.md`.

### Démarrer

- **US-1** — En tant qu'auteur, je veux ouvrir l'atelier, nommer une chose et écrire son prompt sans rien avoir configuré, afin d'obtenir une image dès la première minute.
- **US-2** — En tant qu'auteur, je veux travailler d'emblée dans un projet « Bac à sable » qui existe déjà, afin de ne pas avoir à nommer un univers avant de savoir ce que je fabrique.
- **US-3** — En tant qu'auteur, je veux que le bouton générer soit inactif et dise pourquoi quand la clé du fournisseur manque, avec l'accès direct au réglage, afin de savoir quoi faire au lieu de subir un échec.
- **US-4** — En tant qu'auteur, je veux déposer la clé du fournisseur une seule fois, afin de ne plus jamais y penser.
- **US-5** — En tant qu'auteur, je veux créer un vrai projet quand j'en ressens le besoin et pas avant, afin que ranger reste un geste et jamais un préalable.

### Générer

- **US-6** — En tant qu'auteur, je veux écrire un prompt et un prompt négatif, afin de décrire ce que je veux et ce que je ne veux pas.
- **US-7** — En tant qu'auteur, je veux choisir le modèle parmi ceux que le catalogue déclare, afin de prendre le bon outil pour l'usage du moment.
- **US-8** — En tant qu'auteur, je veux voir grisé, avec sa raison écrite, tout modèle qui ne peut pas honorer la demande en cours, afin de ne jamais découvrir l'incompatibilité après avoir payé.
- **US-9** — En tant qu'auteur, je veux que le modèle que j'ai choisi reste choisi quand ma demande le rend invalide — le bouton générer devenant inactif avec sa raison —, afin de ne pas subir une substitution silencieuse.
- **US-10** — En tant qu'auteur, je veux lancer plusieurs variations d'un même prompt en une fois, afin de comparer au lieu d'itérer.
- **US-11** — En tant qu'auteur, je veux voir l'avancement de chaque génération, afin de savoir que ça travaille.
- **US-12** — En tant qu'auteur, je veux réinjecter un asset existant comme référence, comme source d'édition, comme guide de style ou comme jeu de réglages, afin de repartir de ce qui marche.
- **US-13** — En tant qu'auteur, je veux lancer une génération pendant qu'une autre tourne encore, afin de ne pas attendre.
- **US-14** — En tant qu'auteur, je veux voir le coût réel de chaque génération et le total de mon projet, afin de savoir ce que ça me coûte sans quitter l'atelier.

### La génération survit à l'écran

- **US-15** — En tant qu'auteur, je veux fermer l'onglet, changer de projet ou aller ailleurs sans perdre la génération en cours, afin de ne pas payer pour rien.
- **US-16** — En tant qu'auteur, je veux retrouver à la réouverture les générations encore en cours avec leur avancement, afin de reprendre où j'en étais.
- **US-17** — En tant qu'auteur, je veux qu'une génération interrompue par un redémarrage soit marquée comme telle, avec son coût, et relançable d'un geste, afin de décider moi-même si je repaie.
- **US-18** — En tant qu'auteur, je veux qu'aucune génération ne soit jamais relancée automatiquement, afin que rien ne soit facturé sans moi.

### Quand ça échoue

- **US-19** — En tant qu'auteur, je veux voir l'échec à la place de l'image attendue, avec sa raison en clair, afin de comprendre sans avoir à chercher.
- **US-20** — En tant qu'auteur, je veux relancer un échec d'un seul geste sans réécrire le prompt, afin de réessayer quand la cause est passagère.
- **US-21** — En tant qu'auteur, je veux recevoir les images qui ont réussi même quand d'autres variations du même lot échouent, afin de ne pas perdre le lot entier.
- **US-22** — En tant qu'auteur, je veux relancer chaque variation ratée séparément, afin de ne pas repayer celles qui ont marché.
- **US-23** — En tant qu'auteur, je veux qu'aucun échec n'apparaisse jamais dans ma bibliothèque, afin que la grille ne montre que ce que je peux réutiliser.
- **US-24** — En tant qu'auteur, je veux retrouver dans le journal de mon projet les appels ratés et leur coût réel, afin d'expliquer une facture.

### Juger, garder, jeter

- **US-25** — En tant qu'auteur, je veux que toute image produite entre en bibliothèque d'elle-même, afin de ne rien perdre par inattention.
- **US-26** — En tant qu'auteur, je veux marquer un favori, afin de retrouver le bon d'un coup d'œil.
- **US-27** — En tant qu'auteur, je veux supprimer ce qui ne sert pas, avec une annulation courte juste après, afin de nettoyer sans peur.
- **US-28** — En tant qu'auteur, je veux supprimer un asset sans perdre ceux qui en descendent, afin de ne jamais détruire par ricochet ce que j'ai payé.
- **US-29** — En tant qu'auteur, je veux voir « parent supprimé » sur un asset devenu orphelin, afin de comprendre sa filiation incomplète.
- **US-30** — En tant qu'auteur, je veux qu'on me dise combien d'assets contient un projet avant que je le supprime, et les retrouver ensuite détachés plutôt que détruits, afin de ne pas confondre ranger et détruire.
- **US-114** — En tant qu'auteur, je veux voir en grand l'image que je survole en appuyant sur la barre d'espace, et la zoomer à la molette, afin de juger un détail sans quitter la planche contact ni ouvrir quoi que ce soit.

### La bibliothèque

- **US-31** — En tant qu'auteur, je veux une seule et même grille d'assets dans tout le produit, afin de ne jamais quitter l'endroit où je crée pour organiser.
- **US-32** — En tant qu'auteur, je veux chercher, filtrer et sélectionner en multiple, afin de retrouver.
- **US-33** — En tant qu'auteur, je veux ranger en projets et en collections, afin qu'un seul niveau de rangement me suffise.
- **US-34** — En tant qu'auteur, je veux qu'un filtre sans résultat m'affiche l'état vide et le geste pour retirer le filtre, afin de sortir de l'impasse au lieu de faire face à une grille muette.
- **US-35** — En tant qu'auteur, je veux qu'une bibliothèque vide m'invite à écrire un prompt, afin de savoir par où commencer.
- **US-36** — En tant qu'auteur, je veux ouvrir la fiche d'un asset dans un panneau latéral, afin de ne perdre ni la grille ni mon prompt.
- **US-37** — En tant qu'auteur, je veux fermer ce panneau et me retrouver exactement où j'étais.
- **US-38** — En tant qu'auteur, je veux voir la filiation d'un asset, afin de savoir d'où il vient.
- **US-39** — En tant qu'auteur, je veux distinguer d'un coup d'œil ce que l'agent a produit de ce que j'ai produit moi-même, afin de savoir à qui parler quand quelque chose me surprend.
- **US-40** — En tant qu'auteur, je veux que ma bibliothèque se reconstruise à partir de mes fichiers si son index disparaît, afin de ne jamais perdre un asset pour une raison qui ne me concerne pas.

### L'univers

- **US-41** — En tant qu'auteur, je veux coller une image dans mon tableau d'inspiration, afin de rassembler sans friction.
- **US-42** — En tant qu'auteur, je veux coller une adresse et voir la carte apparaître aussitôt, en attente, afin de continuer à coller pendant que ça charge.
- **US-43** — En tant qu'auteur, je veux que la carte reste avec son adresse et sa raison quand la récupération échoue, afin de ne rien perdre et de pouvoir réessayer.
- **US-44** — En tant qu'auteur, je veux coller un texte et obtenir une carte texte, afin de noter une intention au milieu des images.
- **US-45** — En tant qu'auteur, je veux un refus qui nomme le fichier quand ce n'est pas une image, afin de savoir lequel des douze fichiers déposés pose problème.
- **US-46** — En tant qu'auteur, je veux être averti d'un doublon avec un lien vers l'existant, tout en gardant la possibilité d'importer quand même, afin de décider moi-même.
- **US-47** — En tant qu'auteur, je veux grouper mes cartes, les annoter, garder leur provenance et régler leur taille d'affichage, afin de trier vraiment.
- **US-48** — En tant qu'auteur, je veux promouvoir une carte en artwork officiel, afin de décider ce qui définit le style.
- **US-49** — En tant qu'auteur, je veux ranger chaque artwork officiel dans une famille — personnages, objets, décors, interface —, afin que le style d'un goblin ne déteigne pas sur une prêtresse elfe.
- **US-50** — En tant qu'auteur, je veux marquer « tous » une planche de style non figurative — matières, palette, échantillons de trait —, afin de transmettre la manière sans transmettre un personnage.
- **US-51** — En tant qu'auteur, je veux que l'application choisisse seule les artworks à envoyer selon le sujet demandé, afin que promouvoir reste un geste unique et que je n'aie rien à sélectionner à chaque génération.
- **US-52** — En tant qu'auteur, je veux voir combien de références partent avec ma génération, afin de comprendre ce qui la fait coûter plus ou moins cher.
- **US-53** — En tant qu'auteur, je veux que le style de mon univers parte avec chaque génération, afin de ne jamais le retaper.
- **US-54** — En tant qu'auteur, je veux voir la palette extraite de mes artworks officiels, afin de vérifier ce que la machine y a lu.
- **US-55** — En tant qu'auteur, je veux retirer un artwork officiel et voir la palette se recalculer, afin de corriger une lecture qui ne me convient pas.
- **US-56** — En tant qu'auteur, je veux remplir une bible en champs nommés, chacun activable indépendamment pour une génération, afin de doser ce qui contraint.
- **US-57** — En tant qu'auteur, je veux générer sans bible ni artwork, afin qu'un univers vide ne contraigne simplement rien plutôt que de me bloquer.
- **US-58** — En tant qu'auteur, je veux régler les défauts de mon projet — dont le modèle par type d'asset —, afin que mes générations partent déjà réglées.

### La toile

- **US-98** — En tant qu'auteur, je veux basculer entre la grille et une toile libre, afin d'organiser ma pensée au lieu de seulement tout voir d'un coup d'œil.
- **US-99** — En tant qu'auteur, je veux poser mes cartes où je veux sur un plan que je déplace et que je zoome, afin que la place d'une image finisse par dire quelque chose.
- **US-100** — En tant qu'auteur, je veux que la toile s'ouvre sur mes groupes déjà saisis, matérialisés en îlots, afin de ne pas refaire à la main un rangement que j'ai déjà écrit.
- **US-101** — En tant qu'auteur, je veux que ce qui n'est pas encore classé m'attende dans une réserve à côté, afin d'y piocher au lieu de subir cinquante cartes en vrac.
- **US-102** — En tant qu'auteur, je veux qu'une carte tirée dans un îlot y soit rangée pour de bon, afin que composer soit classer.
- **US-103** — En tant qu'auteur, je veux qu'une carte sortie de son îlot redevienne à classer, afin que ce que je vois et ce qui est écrit ne divergent jamais.
- **US-104** — En tant qu'auteur, je veux poser une carte sur la toile sans la mettre dans aucun îlot, afin d'essayer un rapprochement avant de décider qu'il fait un groupe.
- **US-105** — En tant qu'auteur, je veux agrandir ou réduire une carte sur la toile, afin de donner du poids à ce qui compte.
- **US-106** — En tant qu'auteur, je veux annuler mon dernier geste de composition, afin qu'un glissement raté n'efface pas un rangement.
- **US-107** — En tant qu'auteur, je veux retrouver ma toile exactement comme je l'ai laissée, afin qu'une composition survive à la fermeture de l'écran.
- **US-108** — En tant qu'auteur, je veux tirer un lien d'un objet à un autre, afin de montrer un rapport que la proximité ne dit pas.
- **US-109** — En tant qu'auteur, je veux écrire un mot sur un lien et lui donner une pointe, afin de dire *quel* rapport, quand ça compte.
- **US-110** — En tant qu'auteur, je veux poser une note à même la toile, afin d'écrire une intention là où elle s'applique.
- **US-111** — En tant qu'auteur, je veux donner une couleur à un îlot et à une note, afin de lire ma toile d'un coup d'œil.
- **US-112** — En tant qu'auteur, je veux déplacer un îlot entier avec ce qu'il contient, afin de pousser un groupe composé sans reprendre ses cartes une par une.
- **US-113** — En tant qu'auteur, je veux voir, pendant que je tire une carte, que ce geste va faire disparaître son îlot, afin de ne pas découvrir la perte après l'avoir faite.

### Retoucher

- **US-59** — En tant qu'auteur, je veux recadrer, redimensionner, pixelliser sur grille, ramener sur la palette et nettoyer les bords, avec des réglages qui répondent instantanément.
- **US-60** — En tant qu'auteur, je veux fixer une taille de pixel cible pour mon projet et qu'elle soit imposée à tout ce qui rentre, afin que deux assets du même lot partagent la même grille.
- **US-61** — En tant qu'auteur, je veux que la grille soit ramenée à cette cible systématiquement **dès lors que j'ai posé une cible**, y compris quand le modèle a rendu une grille cinq fois plus grosse, afin que la dérive soit traitée comme le cas normal et non comme un incident. *(« Systématique » a longtemps voulu dire « sans échappatoire » : la cible « aucune » d'US-163 en est une, et elle ne rouvre rien — tant qu'une cible est posée, la remise sur grille reste sans condition.)*
- **US-62** — En tant qu'auteur, je veux que mes petits objets sortent aussi fins que mes personnages, afin de ne pas obtenir un tonneau plus grossier que celui qui le porte.
- **US-63** — En tant qu'auteur, je veux que l'image d'origine soit toujours conservée, afin de revenir en arrière sans jamais repayer.
- **US-64** — En tant qu'auteur, je veux revenir à l'image brute d'un seul geste, afin de repartir proprement quand une retouche part de travers.
- **US-65** — En tant qu'auteur, je veux voir la quantification grisée avec sa raison tant qu'aucune palette n'existe, afin de ne pas essayer une étape qui ne peut pas aboutir.
- **US-66** — En tant qu'auteur, je veux nommer une recette et la réappliquer ailleurs, afin de traiter deux assets exactement pareil.
- **US-67** — En tant qu'auteur, je veux changer la palette de mon projet et voir tous ses assets s'y remettre sans un seul appel payant.
- **US-68** — En tant qu'auteur, je veux que les réglages que j'ai faits à la main sur un asset ne soient jamais écrasés par ce changement, et voir le compte de ce qui a été remis à jour et de ce qui a été conservé tel quel.
- **US-69** — En tant qu'auteur, je veux réaligner d'un geste, depuis sa fiche, un asset que j'avais réglé à la main, afin de le faire rentrer dans le rang quand je le décide.

### Détourer et découper

- **US-70** — En tant qu'auteur, je veux détourer en une ou plusieurs passes, en réglant le seuil et le durcissement du bord, afin d'obtenir un fond propre sans halo.
- **US-71** — En tant qu'auteur, je veux voir immédiatement qu'un détourage a mangé le sujet et le reprendre autrement, afin de ne pas garder une image abîmée.
- **US-72** — En tant qu'auteur, je veux découper une planche multi-sprites par détection automatique, afin qu'une planche de huit devienne huit assets.
- **US-73** — En tant qu'auteur, je veux corriger la découpe à la main — grille fixe ou sélection — quand la détection se trompe, afin de ne jamais être bloqué par une mauvaise détection.
- **US-74** — En tant qu'auteur, je veux que chaque découpe soit un asset dont la filiation pointe vers la planche d'origine, afin de remonter à la source.

### Sortir

- **US-75** — En tant qu'auteur, je veux télécharger une image seule, afin de la poser où je veux.
- **US-76** — En tant qu'auteur, je veux exporter une sélection en une archive accompagnée de son descriptif, afin de transférer un lot d'un coup.
- **US-77** — En tant qu'auteur, je veux que l'export soit grisé avec sa raison quand la sélection est vide, afin de ne pas déclencher une action sans objet.

### L'agent qui code le jeu

- **US-78** — En tant qu'agent, je veux demander un asset et recevoir un chemin de fichier, afin de ne pas avoir à composer un enchaînement d'appels.
- **US-79** — En tant qu'agent, je veux que l'univers du projet s'applique tout seul à ma demande, afin de ne pas répéter le style à chaque fois.
- **US-80** — En tant qu'agent, je veux attendre jusqu'à un délai que je fixe et, passé ce délai, recevoir un identifiant, afin d'obtenir mon image directement la plupart du temps sans avoir à sonder.
- **US-81** — En tant qu'agent, je veux lister les projets, les assets et les modèles, afin de retrouver et réutiliser plutôt que de regénérer.
- **US-82** — En tant qu'agent, je veux importer un fichier local, retoucher un asset existant et exporter une sélection, afin de disposer des mêmes gestes que l'écran.
- **US-83** — En tant qu'agent, je veux écrire directement dans le dossier du jeu, afin que l'asset soit utilisable sans manipulation.
- **US-84** — En tant qu'agent, je veux qu'un dossier manquant soit créé, qu'un fichier de même nom ne soit jamais écrasé, et qu'un dossier non inscriptible me soit refusé avec le chemin fautif, afin de ne jamais détruire du travail par mégarde.
- **US-85** — En tant qu'agent, je veux un refus explicite et actionnable quand j'atteins le plafond de la session — le plafond, et le moyen de le relever —, afin de savoir quoi dire à l'auteur.
- **US-86** — En tant qu'agent, je veux un refus accompagné de la liste des projets existants quand je nomme un projet inconnu, afin de me corriger tout de suite.
- **US-87** — En tant qu'agent, je veux que mes assets aillent dans le projet ouvert dans l'atelier quand je ne nomme aucun projet, afin d'atterrir au bon endroit sans avoir à demander.
- **US-88** — En tant qu'auteur, je veux ne jamais être interrompu par une demande d'autorisation, afin que l'agent ne se fige pas quand je ne regarde pas l'écran.
- **US-89** — En tant qu'auteur, je veux voir apparaître en direct dans ma grille ce que l'agent produit, marqué de sa provenance, afin de garder l'œil dessus sans le surveiller.
- **US-90** — En tant qu'auteur, je veux un compteur discret de ce que l'agent consomme, afin de savoir quand relever le plafond.
- **US-91** — En tant qu'auteur, je veux relever ou désactiver le plafond, et changer ou lever le modèle imposé à l'agent, sans rien redémarrer, afin de changer d'avis en cours de séance.

### Quand le fournisseur n'est pas là

- **US-92** — En tant qu'auteur, je veux continuer à travailler sur ce qui est déjà sur mon disque quand le fournisseur est en panne, afin qu'une panne qui ne me concerne pas ne m'arrête pas.
- **US-93** — En tant qu'auteur, je veux voir le catalogue daté en clair quand il n'a pas pu être rafraîchi, afin de savoir que je travaille sur une photo d'hier.
- **US-94** — En tant qu'auteur, je veux préparer un prompt hors ligne et le lancer au retour du réseau, afin de ne pas perdre le fil.
- **US-95** — En tant qu'auteur, je veux que l'échec survienne au moment où j'essaie de générer et non au démarrage, afin de ne jamais être accueilli par une erreur.

### Régler

- **US-96** — En tant qu'auteur, je veux régler la clé du fournisseur, les garde-fous de l'agent et mes dossiers, afin de tout tenir depuis un seul endroit.
- **US-97** — En tant qu'auteur, je veux voir les trois panneaux et la grille ensemble sur mon écran large, et replier un panneau quand je veux voir la grille en grand, afin de ne jamais subir un repli imposé par la place.

### Le personnage et son plan

- **US-115** — En tant qu'auteur, je veux créer un personnage dans mon projet et le décrire une fois, afin de fabriquer toutes ses images sans réécrire son signalement à chaque prompt.
- **US-116** — En tant qu'auteur, je veux que mon projet porte une liste de poses, chacune avec un nom et un nombre d'images, afin que tous mes personnages se comparent sur le même plan.
- **US-117** — En tant qu'auteur, je veux dire pour chaque personnage lesquelles de ces poses il tient, afin qu'un figurant ne réclame pas les mêmes images qu'un héros.
- **US-118** — En tant qu'auteur, je veux ajouter, renommer et retirer une pose du plan de mon projet à tout moment, afin que le plan suive le jeu au lieu de le précéder.
- **US-119** — En tant qu'auteur, je veux voir d'un coup d'œil, pour un personnage, ce qui est fait et ce qui ne l'est pas, afin de savoir quoi lancer sans tenir la liste dans ma tête.
- **US-120** — En tant qu'auteur, je veux générer une pose seule, afin de juger un personnage avant d'engager un lot entier sur lui.
- **US-121** — En tant qu'auteur, je veux voir avant de lancer ce qui va partir en référence et ce que ça va coûter, afin de décider en connaissance de cause.
- **US-122** — En tant qu'auteur, je veux que le corps d'un personnage naisse dans l'atelier et jamais d'une planche venue d'ailleurs, afin que tout ce qui s'empile ensuite repose sur une image dont je connais la grille et la palette.
- **US-123** — En tant qu'auteur, je veux voir sur chaque asset le modèle qui l'a produit, afin de savoir à qui redemander quand un résultat me plaît, et de qui me méfier quand il me déçoit.
- **US-124** — En tant qu'auteur, je veux qu'un personnage ou une pièce désigne des cartes de mon tableau comme concept art, afin de repartir de mes références au lieu de les redécrire en prose.
- **US-125** — En tant qu'auteur, je veux qu'une carte désignée se voie sur la toile, afin de savoir ce qui sert et ce qui dort.
- **US-126** — En tant qu'auteur, je veux décocher une référence pour cette génération, pour ce personnage ou pour tout le projet, afin de couper une contamination sans démonter mon univers.
- **US-127** — En tant qu'auteur, je veux voir d'où vient chaque référence envoyée, afin de comprendre pourquoi elle part avant de décider de la retirer.

### Le lot

- **US-128** — En tant qu'auteur, je veux sélectionner plusieurs poses et les obtenir d'une seule génération, afin de payer un appel au lieu de N.
- **US-129** — En tant qu'auteur, je veux choisir la taille de mon lot à chaque génération et voir ce qu'un compte faux me coûterait, afin d'arbitrer moi-même entre le coût et le risque de tout rater d'un coup.
- **US-130** — En tant qu'auteur, je veux que la planche reçue soit dépliée toute seule en autant d'images de corps qu'il y avait de cases, afin de n'avoir jamais à découper à la main ce que j'ai demandé plié.
- **US-131** — En tant qu'auteur, je veux qu'un lot dont le compte d'images ne tombe pas juste soit refusé et relançable, afin qu'une planche incomplète n'entre jamais silencieusement dans mon plan.
- **US-132** — En tant qu'auteur, je veux reprendre un lot interrompu sans repayer ce qui est déjà arrivé, afin qu'une coupure ne me coûte que ce qu'elle a coûté.
- **US-133** — En tant qu'auteur, je veux régénérer une pose seule à l'intérieur d'un lot déjà reçu, afin de rattraper une case ratée sans refaire la planche entière.
- **US-134** — En tant qu'auteur, je veux enregistrer sous un nom ce qui part en référence et les réglages d'une génération, afin de rejouer la même recette sur un autre personnage sans la reconstituer.
- **US-135** — En tant qu'auteur, je veux être prévenu quand deux poses d'un même lot se ressemblent trop, sans que le lot soit refusé pour autant, afin de relancer la case qui n'apporte rien plutôt que de la découvrir au montage.

### La pièce et le calque

- **US-136** — En tant qu'auteur, je veux définir sur mon projet des emplacements ordonnés — la tête, le dos, les jambes —, afin que mes pièces se posent au même endroit d'un personnage à l'autre.
- **US-137** — En tant qu'auteur, je veux décrire une pièce d'équipement une seule fois sur mon projet, afin de la poser sur n'importe lequel de mes personnages sans la redécrire.
- **US-138** — En tant qu'auteur, je veux qu'écrire le nom d'une pièce ou d'un emplacement qui n'existe pas le crée, afin que ranger ne soit jamais un préalable.
- **US-139** — En tant qu'auteur, je veux déclarer si une pièce tient dans la silhouette du personnage ou si elle l'agrandit, afin que l'atelier sache d'avance s'il peut m'en faire un calque ou non.
- **US-140** — En tant qu'auteur, je veux poser une pièce sur plusieurs poses d'un personnage d'un seul appel payant et obtenir un calque par pose, afin d'habiller tout un plan sans le payer case par case.
- **US-141** — En tant qu'auteur, je veux ne pouvoir faire partir dans une planche d'équipement que des poses qui ont déjà un corps, les autres étant visiblement inéligibles avec leur raison, afin de ne jamais payer pour habiller une case vide.
- **US-142** — En tant qu'auteur, je veux que la planche revenue soit redécoupée sur la grille exacte que l'atelier a posée et comparée case par case à ce qu'il avait envoyé, afin que chaque calque sorte d'une base connue et non devinée.
- **US-143** — En tant qu'auteur, je veux voir le calque superposé au corps de sa pose, afin de juger un résultat à l'œil au lieu de juger un chiffre.
- **US-144** — En tant qu'auteur, je veux borner un calque à une zone, afin qu'un visage repeint au passage ne parte pas avec la pièce.
- **US-145** — En tant qu'auteur, je veux déplacer et retailler cette zone après coup sans repayer, afin qu'une erreur de cadrage me coûte un glissement de souris et rien d'autre.
- **US-146** — En tant qu'auteur, je veux que le calque soit rangé à côté de l'image payée et jamais écrit dedans, afin de pouvoir revenir en arrière autant de fois qu'il le faut.
- **US-147** — En tant qu'auteur, je veux lire ce qui a bougé — la silhouette retrouvée, le corps repeint, ce qui a été ajouté, l'échelle au retour, et si c'est un objet ou une poussière — sans qu'aucune de ces mesures ne refuse à ma place, afin de garder le jugement.
- **US-148** — En tant qu'auteur, je veux qu'une pièce qui agrandit la silhouette et revient à une autre échelle que celle envoyée me le dise au lieu de me rendre un calque faux, et que ce qui revient soit gardé comme des corps habillés, afin de ne pas perdre l'appel que j'ai payé.

### La main

- **US-149** — En tant qu'auteur, je veux affiner une zone à main levée puis au pixel, afin de rattraper ce qu'un rectangle ne sait pas dire.
- **US-150** — En tant qu'auteur, je veux retoucher un calque au pixel avec le corps visible en repère dessous, afin de corriger sans perdre l'alignement.
- **US-151** — En tant qu'auteur, je veux comparer l'avant et l'après d'un seul geste, afin de voir ce que ma retouche a réellement changé.
- **US-152** — En tant qu'auteur, je veux trier ce qui me reste à regarder en commençant par le pire, afin d'attaquer par ce qui va me poser problème.
- **US-153** — En tant qu'auteur, je veux que la zone et la retouche au pixel soient deux couches séparées et rejouables, afin qu'aucune des deux ne détruise l'autre.

### Sortir un personnage

- **US-154** — En tant qu'auteur, je veux exporter un personnage complet — ses poses et ses calques — dans le dossier de mon jeu, afin qu'il soit utilisable sans manipulation.
- **US-155** — En tant qu'auteur, je veux qu'un descriptif accompagne l'export et dise ce qu'est chaque fichier, afin que l'agent sache quoi en faire sans que j'aie à le lui raconter.
- **US-156** — En tant qu'agent, je veux disposer sur les personnages et les calques exactement des mêmes gestes que l'écran, afin de compléter un plan sans que l'auteur ouvre l'atelier.
- **US-157** — En tant qu'agent, je veux écrire moi-même les lignes de catalogue de mon jeu à partir du descriptif, afin que l'atelier décrive ce qu'il produit sans avoir à connaître la structure de mon jeu.

### Ce qui décide de l'apparence

- **US-158** — En tant qu'auteur, je veux voir, avant de lancer, le texte exact qui va partir chez le modèle — la bible, mon sujet et les consignes de planche comprises —, afin de savoir ce que je demande réellement au lieu de le supposer.
- **US-159** — En tant qu'auteur, je veux reprendre ce texte à la main pour cette génération-là, afin de corriger une formulation sans démonter la bible de mon projet.
- **US-160** — En tant qu'auteur, je veux que le texte repris parte tel quel et reste attaché à la génération, afin de relire des mois plus tard ce qui a produit l'image.
- **US-161** — En tant qu'auteur, je veux décrire dans un champ nommé la vue et le cadrage de mon univers — trois quarts, de face, de profil, plan large —, afin de ne plus les retaper à chaque prompt.
- **US-162** — En tant qu'auteur, je veux décrire dans un champ nommé la technique de rendu attendue — pixel art, peinture, trait encré —, afin que ce soit moi qui décide de l'apparence plutôt qu'un défaut que je n'ai jamais posé.
- **US-163** — En tant qu'auteur, je veux choisir « aucune » comme taille de pixel de mon projet, afin que ce que le modèle a rendu me revienne tel quel quand mon jeu n'est pas en pixel art.
- **US-164** — En tant qu'auteur, je veux lire sur la fiche d'un asset le traitement que le projet lui a imposé, afin de comprendre pourquoi l'image affichée ne ressemble pas à celle qui est arrivée du fournisseur.

### Le réglage d'univers se voit à l'instant

- **US-165** — En tant qu'auteur, je veux qu'un réglage d'univers change l'écran à l'instant où je le pose, afin de ne pas avoir à recharger la page pour savoir ce que mon projet impose.
- **US-166** — En tant qu'auteur, je veux que ce que l'écran affiche soit toujours ce que le fichier porte, afin de ne jamais reposer deux fois le même réglage en croyant que le premier n'a pas pris.

### Faire entrer une image depuis l'écran

- **US-167** — En tant qu'auteur, je veux faire entrer un fichier de mon disque depuis l'écran, par un bouton et par glisser-déposer dans la grille, afin de ne pas avoir à passer par l'agent pour importer une image.
- **US-168** — En tant qu'auteur, je veux que l'image importée soit un asset entier — rangée, retouchable, découpable, exportable, et marquée comme importée —, afin qu'elle vive exactement comme celles que j'ai payées.
- **US-169** — En tant qu'auteur, je veux un refus qui nomme le fichier quand ce n'est pas une image, et l'avertissement de doublon avec le lien vers l'existant, afin de décider moi-même — comme au tableau d'inspiration.
- **US-170** — En tant qu'auteur, je veux dire, en important, si le traitement de mon projet s'applique ou si l'image entre telle quelle, afin qu'une référence ne soit pas ramenée à 64 pixels sans que je l'aie demandé.

### L'infobulle ne couvre plus ce qu'elle explique

- **US-171** — En tant qu'auteur, je veux qu'une infobulle ne se pose jamais sur un réglage cliquable, afin de ne pas avoir à la chasser pour atteindre le contrôle d'à côté.
- **US-172** — En tant qu'auteur, je veux qu'elle disparaisse dès que je pointe ailleurs et ne reste que si je l'ai épinglée volontairement, afin qu'elle ne se mette jamais entre ma main et le réglage suivant.

### Un calque se recale sans repayer

- **US-173** — En tant qu'auteur, je veux rejouer le recalage d'un calque depuis la planche qui l'a payé, sans qu'une image soit créée ni supprimée et sans un centime au journal, afin qu'un alignement raté ne me force pas à repayer un appel dont la planche est encore sur mon disque.

---

## La V2.1 — la refonte de l'interface

*Écrites le 31 août 2026, à partir du dossier `docs/maquettes-v2.1/`. Ce qui a dû être
arbitré en les écrivant vit dans `docs/v21-arbitrages.md`.*

### Trois lieux au lieu de sept surfaces

- **US-174** — En tant qu'auteur, je veux trois onglets — l'univers, le codex, la galerie — dans l'ordre où ils servent, afin de savoir où je suis sans lire cinq boutons de même poids.
- **US-175** — En tant qu'auteur, je veux qu'une profondeur se lise dans un fil qui remplace le nom de l'onglet, et que chacun de ses segments me ramène, afin de descendre dans une chose du jeu sans perdre le chemin du retour.
- **US-176** — En tant qu'auteur, je veux que le total affiché dans la barre du haut porte l'étiquette de ce qu'il compte, afin de ne pas lire le total d'un jeu comme le total de tout.
- **US-177** — En tant qu'auteur, je veux cliquer ce total pour voir d'où il vient, afin qu'un montant affiché soit une question à laquelle on peut répondre.
- **US-178** — En tant qu'auteur, je veux que les deux bascules de repli disent ce qu'elles replient sur l'écran où je suis, afin de ne pas avoir à essayer pour savoir.
- **US-179** — En tant qu'auteur, je veux que ce qui parle de l'outil — les réglages, le guide — soit séparé de ce qui parle de mon travail, afin de ne pas les confondre dans la même rangée de boutons.

### Le codex — ce que le monde contient, et ce qui lui manque

- **US-180** — En tant qu'auteur, je veux voir la liste de tout ce que mon monde contient, rangée par famille, afin de retrouver une chose sans me rappeler dans quelle image elle est.
- **US-181** — En tant qu'auteur, je veux qu'une chose du jeu porte le compte de ce qui lui manque et non celui de ce qu'elle tient, afin de savoir où il reste du travail sans ouvrir chaque fiche.
- **US-182** — En tant qu'auteur, je veux écrire un nom pour créer une chose sur-le-champ, sans formulaire et sans rien payer, afin de fabriquer un essai qui n'appartient encore à rien.
- **US-183** — En tant qu'auteur, je veux que le champ qui nomme occupe le milieu de l'écran quand mon monde est vide et redevienne une rangée quand il ne l'est plus, afin que le seul geste possible soit aussi le plus visible.
- **US-184** — En tant qu'auteur, je veux lancer d'un geste tout ce qui manque à une chose, groupé en planches, avec le prix annoncé et ce qu'un compte faux coûterait, afin de décider avant de payer.
- **US-185** — En tant qu'auteur, je veux voir le compte de ce que j'ai rangé à côté de la jauge, afin qu'une jauge pleine obtenue en rangeant se lise comme telle.
- **US-186** — En tant qu'auteur, je veux que le manque n'ait aucune couleur d'alerte et que rien ne me réclame quoi que ce soit, afin qu'un jeu en cours de fabrication n'ait pas l'air d'échouer.
- **US-187** — En tant qu'auteur, je veux que les listes que le jeu impose à tout le monde vivent dans le codex et non dans la colonne d'un personnage, afin de ne plus changer la colonne de tous en croyant régler un seul.

### L'établi — la matrice arme et tire au même endroit

- **US-188** — En tant qu'auteur, je veux ouvrir une chose du jeu et y voir ce qu'elle est, ce qu'elle a déjà et ce qu'on peut lui ajouter, afin de travailler sans chercher.
- **US-189** — En tant qu'auteur, je veux qu'un clic sur une case vide remplisse le prompt et que le bouton qui paie soit au même endroit, afin de ne plus changer d'écran à chaque génération.
- **US-190** — En tant qu'auteur, je veux que ce qui remplit le champ porte sa provenance écrite en dessous, afin de savoir qu'un champ prérempli n'est pas un champ décidé.
- **US-191** — En tant qu'auteur, je veux qu'un clic sur une case pleine ouvre l'outil de cette case en plein cadre sans quitter l'établi, afin de retoucher en voyant l'image en grand.
- **US-192** — En tant qu'auteur, je veux que la barre qui paie se retire dès qu'un écran ouvert ne peut rien dépenser, afin de savoir ce que coûte le geste en cours sans lire un titre.
- **US-193** — En tant qu'auteur, je veux qu'une seule barre de saisie existe dans tout le produit et qu'elle serve l'établi et le codex, afin qu'il n'y ait jamais deux endroits d'où l'argent part sans que je le sache.

### Les tables de retouche

- **US-194** — En tant qu'auteur, je veux une barre qui montre les sept places de ma recette dans leur ordre, chacune disant si elle agit et avec quelle valeur, afin de lire ce que l'image a subi sans aller vérifier.
- **US-195** — En tant qu'auteur, je veux qu'une table indisponible s'ouvre quand même et porte sa raison en clair à la place de ses réglages, avec ce qu'il faut faire pour l'allumer, afin de comprendre au moment où je suis allé chercher.
- **US-196** — En tant qu'auteur, je veux comparer l'image brute et l'image rendue côte à côte ou superposées, avec le mode écrit quand ce n'est pas le rendu, afin de ne jamais oublier dans quel mode je regarde.
- **US-197** — En tant qu'auteur, je veux passer d'une image à sa voisine sans refermer la table où je suis, afin de traiter une série sans rouvrir sept fois le même outil.
- **US-198** — En tant qu'auteur, je veux vider une seule place d'un geste et la recette entière d'un autre, chacun à sa place, afin de ne jamais confondre les deux portées.
- **US-199** — En tant qu'auteur, je veux que le détourage me propose les poches de fond enfermées par le sujet, en les cerclant et en les comptant sans jamais les effacer seul, afin de retirer ce qu'aucune tolérance ne peut atteindre.
- **US-200** — En tant qu'auteur, je veux désigner une couleur à la pipette et choisir si je retire cette tache-là ou toutes celles de cette couleur, afin de nettoyer un fond que le remplissage depuis le bord n'atteint pas.
- **US-201** — En tant qu'auteur, je veux poser moi-même le rectangle de recadrage sur l'image, afin d'utiliser enfin un réglage que le traitement honore et qu'aucun écran n'écrivait.
- **US-202** — En tant qu'auteur, je veux que le curseur d'occupation ne s'arrête que là où l'image change vraiment, et qu'il dise sur combien de pixels il tombe, afin de ne pas croire régler quelque chose quand rien ne bouge.
- **US-203** — En tant qu'auteur, je veux quantifier sur les couleurs déduites d'une image plutôt que sur la palette du jeu, et allumer le tramage, afin d'atteindre deux réglages que le modèle porte déjà et qu'aucun écran ne montrait.
- **US-204** — En tant qu'auteur, je veux voir la liste des taches que l'aire minimale va effacer, triée et coupée là où le seuil tombe, afin de savoir ce que je retire avant de le retirer.

### Les deux places qui manquaient

- **US-205** — En tant qu'auteur, je veux retracer le contour de la silhouette à l'épaisseur, à la couleur et à la position que je choisis, afin de remettre la ligne que la mise sur grille a mangée.
- **US-206** — En tant qu'auteur, je veux savoir qu'un contour posé à l'extérieur agrandit l'image rendue, écrit au moment où je choisis la position, afin qu'aucun réglage ne change les dimensions de mon sprite en silence.
- **US-207** — En tant qu'auteur, je veux ôter et remettre des pixels à main levée puis au pixel, afin de corriger les trois pixels qu'aucun réglage n'atteint.
- **US-208** — En tant qu'auteur, je veux empiler des calques de dessin nommables, masquables et réordonnables au-dessus de mon image, afin de poser de la matière sans toucher à ce qu'il y avait.
- **US-209** — En tant qu'auteur, je veux qu'un passage soit enregistré comme un tracé et non comme des pixels, afin qu'il survive à un changement de taille de grille et se défasse un par un.
- **US-210** — En tant qu'auteur, je veux que la palette de mon jeu me soit proposée sans m'être imposée, et qu'une couleur hors palette soit marquée au lieu d'être refusée, afin que le produit constate sans décider à ma place.

### La superposition — deux images, une troisième en sort

- **US-211** — En tant qu'auteur, je veux choisir moi-même les deux images que je superpose et les intervertir, afin de ne plus dépendre d'un réglage qui pointait vers un autre asset sans écran pour le poser.
- **US-212** — En tant qu'auteur, je veux détourer l'image du dessus sans quitter la superposition, en héritant des passes de celle du dessous, afin que le calque ne prenne pas tout le fond avec la pièce.
- **US-213** — En tant qu'auteur, je veux caler l'image du dessus au pixel, au rail comme au clavier, après une proposition automatique que je peux reprendre, afin qu'un recalage raté ne me force plus à repayer une génération.
- **US-214** — En tant qu'auteur, je veux voir en même temps le travail, le calque seul sur un fond vif et le résultat final, afin de caler en regardant ce que ça donne plutôt que ce que je manipule.
- **US-215** — En tant qu'auteur, je veux garder les réglages d'une superposition pour la pièce suivante posée sur la même image, afin de ne pas tout recommencer à chaque casque.

### La galerie — elle montre, elle ne fabrique rien

- **US-216** — En tant qu'auteur, je veux que la galerie n'ait ni champ de prompt, ni colonne de réglages, ni curseur de retouche, afin que l'écran dont le métier est de juger rende toute sa place aux images.
- **US-217** — En tant qu'auteur, je veux que le pied de la galerie dise qu'aucun appel ne part d'ici, afin de savoir d'un coup d'œil dans quelle moitié du produit je me trouve.
- **US-218** — En tant qu'auteur, je veux que la fiche d'une image dise ce qu'elle est et porte deux portes — l'établi de la chose à qui elle appartient, et les tables —, afin de ne plus régler un détourage en regardant une carte postale.
- **US-219** — En tant qu'auteur, je veux qu'une image qui n'appartient à personne me propose de la rattacher, afin qu'une image apportée ou un morceau de découpe en surplus ne reste pas orphelin.
- **US-220** — En tant qu'auteur, je veux filtrer la grille par famille, avec une dernière valeur pour ce qui n'appartient à aucune chose du jeu, afin de réduire une planche contact de quatre-vingt-huit images à ce que je cherche.

### L'univers — trois côtés, un seul allumé

- **US-221** — En tant qu'auteur, je veux que le tableau de références occupe tout l'écran, sans un seul réglage dessus, afin que la première image ne soit plus à six écrans et demi de défilement.
- **US-222** — En tant qu'auteur, je veux qu'une carte de texte ait la hauteur que son cran de zoom lui donne, comme une carte d'image, et qu'elle dise en pied ce qui ne rentre pas, afin qu'un document collé ne repousse pas tout le reste.
- **US-223** — En tant qu'auteur, je veux fabriquer une palette ou une ambiance depuis le menu d'un paquet d'images du tableau, afin de partir de ce que je viens de rapprocher.
- **US-224** — En tant qu'auteur, je veux lire en permanence ce que mon univers envoie — combien de cases de texte, combien de signes, quelles images, et ce qui n'agit qu'au retour —, afin de savoir ce que je demande vraiment.

### L'assistant — dix étapes, et le seul écran de réglages

- **US-225** — En tant qu'auteur, je veux qu'un assistant s'ouvre quand je crée un jeu et se rouvre quand je veux, afin de ne plus atterrir devant sept cases de texte vides, en anglais, sans exemple.
- **US-226** — En tant qu'auteur, je veux que l'assistant soit aussi l'écran des réglages, afin qu'il n'existe pas deux endroits qui règlent la même chose et finissent par se contredire.
- **US-227** — En tant qu'auteur, je veux enchaîner les étapes dans l'ordre la première fois et cliquer directement celle qui m'intéresse ensuite, afin que le même écran serve les deux moments.
- **US-228** — En tant qu'auteur, je veux voir dans la colonne la valeur de chaque étape, afin qu'elle devienne le récapitulatif de mon jeu sans que j'aie à ouvrir quoi que ce soit.
- **US-229** — En tant qu'auteur, je veux choisir la vue de mon jeu et la taille de ses images sur des vignettes qui les montrent, afin de ne pas choisir un nombre dans l'abstrait.
- **US-230** — En tant qu'auteur, je veux qu'un seul choix remplisse d'un coup le réglage et la phrase correspondante du texte qui part, afin qu'ils ne puissent plus se contredire.
- **US-231** — En tant qu'auteur, je veux composer une description en cliquant des étiquettes qui portent chacune son texte anglais, afin de ne plus chercher comment dire « il y a de la brume » à une intelligence artificielle.
- **US-232** — En tant qu'auteur, je veux que ma base d'étiquettes appartienne à l'atelier et non à un projet, et qu'elle grandisse de chaque étiquette que je fabrique, afin qu'un deuxième jeu parte de ce que le premier a nommé.
- **US-233** — En tant qu'auteur, je veux un texte tout prêt à copier dans un outil d'images grand public, assemblé depuis mes réglages, afin de me donner un point de départ visuel sans qu'un centime passe par l'atelier.
- **US-234** — En tant qu'auteur, je veux cocher les types d'objets que mon jeu contient, chacun tenant sur une rangée qui dit tout ce qu'il porte, afin de ne pas lire sept blocs de trois contrôles dépliés en permanence.
- **US-235** — En tant qu'auteur, je veux qu'un changement qui casse du travail déjà payé m'annonce les vrais chiffres — combien d'images, combien ça coûte — sans jamais me bloquer, afin de décider moi-même sur mon propre jeu.
- **US-236** — En tant qu'auteur, je veux qu'une liste vide dise ce qui décidera à sa place, afin d'apprendre la règle en lisant le réglage plutôt qu'en la cherchant ailleurs.

### La vue du jeu, et les directions qu'elle donne

- **US-237** — En tant qu'auteur, je veux déclarer une fois comment mon jeu regarde le monde et que l'atelier en tire la liste des directions, afin de ne plus retaper le nombre de directions à sept endroits sans lien entre eux.
- **US-238** — En tant qu'auteur, je veux renommer, retirer et ajouter des directions depuis le codex, afin que la liste tirée de la vue soit une proposition et non une contrainte.
- **US-239** — En tant qu'auteur, je veux que chaque case de mon plan soit une pose dans une direction, afin que le produit puisse me dire qu'il me manque le nord.
- **US-240** — En tant qu'auteur, je veux que la consigne d'une image soit composée de l'attitude, écrite une fois sur la pose, et de la direction, écrite une fois sur la direction, afin de ne pas recopier « facing south » sur six poses.
- **US-241** — En tant qu'auteur, je veux que le nom d'une pose cesse de partir en français au milieu d'un texte anglais, afin que ce qui part ne se contredise plus dans la même phrase.
- **US-242** — En tant qu'auteur, je veux que les images faites avant la déclaration se rangent dans la première direction avec la marque « à confirmer » et le compte de celles qui l'attendent, afin qu'un rangement par défaut ne se fasse pas passer pour une déduction.
- **US-243** — En tant qu'auteur, je veux qu'on me propose de ramener à un le nombre d'images de mes poses, avec la raison écrite, afin de ne pas découvrir trente-six manques que je n'ai pas demandés.
- **US-244** — En tant qu'auteur, je veux ranger une direction pour une pose du projet entier, ou pour une seule chose du jeu, afin qu'une mort n'ait qu'un angle et qu'un dragon n'attaque que vers le sud.

### Les poses appartiennent au type d'objet

- **US-245** — En tant qu'auteur, je veux que chaque type d'objet porte sa liste de poses, afin qu'un coffre n'hérite pas d'une pose de course qu'il faudrait ranger sur chaque coffre.
- **US-246** — En tant qu'auteur, je veux ajouter une pose à une seule chose du jeu, afin qu'un boss ait sa transformation sans qu'une case vide paraisse chez tous les autres.
- **US-247** — En tant qu'auteur, je veux lire l'origine de chaque pose — venue du type, ou ajoutée ici —, afin de savoir ce qui bougerait si je changeais le type.
- **US-248** — En tant qu'auteur, je veux que ce que je range se relègue sous un trait, barré et pâle, plutôt que de disparaître, afin de défaire un rangement sans me rappeler ce que j'ai rangé.

### Les palettes et les ambiances

- **US-249** — En tant qu'auteur, je veux fabriquer des palettes nommées, en plusieurs exemplaires, afin de ne plus être limité à une seule palette sans nom attachée au projet.
- **US-250** — En tant qu'auteur, je veux qu'une palette reste une recette — des sources, deux dosages, des retouches rangées une par une —, afin que promouvoir une image nouvelle se propage encore jusqu'en bas.
- **US-251** — En tant qu'auteur, je veux que chaque couleur du résultat dise d'où elle vient, et qu'une couleur retirée reste montrée barrée, afin de comprendre ce que je regarde et de l'annuler d'un clic.
- **US-252** — En tant qu'auteur, je veux voir la palette posée sur de vraies images à côté de celles du jeu, afin de juger un mélange sur un sprite plutôt que sur une bande de pastilles.
- **US-253** — En tant qu'auteur, je veux fabriquer une ambiance qui porte une palette, des images de référence et trois textes, afin de dire une fois ce qu'un coin de mon jeu a de différent.
- **US-254** — En tant qu'auteur, je veux que les textes qui portent la mécanique du jeu soient fermés à une ambiance, afin qu'une variante de style ne fabrique pas des images qui ne rentrent pas dans le jeu.
- **US-255** — En tant qu'auteur, je veux désigner l'ambiance d'une chose du jeu sur sa fiche, afin qu'une collection reste un dossier de rangement qui ne décide de rien.
- **US-256** — En tant qu'auteur, je veux lire des deux côtés qui utilise une ambiance et ce que chacun lui prend, afin de voir les trous sans écran récapitulatif de plus.
- **US-257** — En tant qu'auteur, je veux qu'une ambiance supprimée ne détruise aucune image et laisse simplement ce qui s'en servait retomber sur le jeu, afin qu'un réglage retiré ne soit jamais un trou.

### La fiche d'une chose du jeu

- **US-258** — En tant qu'auteur, je veux un écran qui rassemble ce qu'une chose du jeu est, ce qui l'habille, ses images de référence, ce que le jeu lui réclame et ce qui est fait, afin de régler ce qui ne tient pas dans la colonne de l'établi.
- **US-259** — En tant qu'auteur, je veux lire à côté de chaque texte d'où il vient — du jeu, de son ambiance, écrit ici, éteint, verrouillé —, afin de savoir où aller le corriger durablement.
- **US-260** — En tant qu'auteur, je veux qu'un texte que j'écris sur une chose montre en dessous, barré, celui qu'il remplace, afin de lire ce à quoi j'ai renoncé sans aller le chercher.
- **US-261** — En tant qu'auteur, je veux voir la valeur imposée par le projet juste sous le texte qui part, afin qu'une bible qui annonce soixante-quatre pendant que le projet impose cent vingt-huit devienne impossible à ne pas voir.
- **US-262** — En tant qu'auteur, je veux promouvoir une image déjà fabriquée en référence permanente d'une chose du jeu, afin qu'un personnage se ressemble d'une pose à l'autre.
- **US-263** — En tant qu'auteur, je veux que l'atelier me propose de lui-même le corps retenu et la planche des directions, avec leur provenance écrite, afin de ne pas laisser dix-sept appels sur vingt-huit partir sans une seule image.
- **US-264** — En tant qu'auteur, je veux voir la matrice changer pendant que je règle, à droite de la fiche, afin de voir ce qu'un rangement coûte ou économise au moment où je le fais.
- **US-265** — En tant qu'auteur, je veux lire le compte des places d'images de mon modèle à côté de celles que j'occupe, afin de ne jamais découvrir un plafond après avoir payé.

### La planche d'une pose

- **US-266** — En tant qu'auteur, je veux voir ce que j'achète avant de payer — combien de cases, ce qui est écrit dans chacune, ce qui part en référence, et le prix —, afin qu'une feuille ne soit pas un achat à l'aveugle.
- **US-267** — En tant qu'auteur, je veux que l'écran me propose de refaire les quatre directions plutôt que de compléter les trois qui manquent, avec les trois prix et le nombre d'appels sur lequel chacun repose, afin de choisir sur une mesure et non sur un principe.
- **US-268** — En tant qu'auteur, je veux qu'une case sache dans quelle pose et quelle direction elle se rangera **avant** de partir, afin que le rangement cesse d'être un geste séparé qu'on peut oublier.
- **US-269** — En tant qu'auteur, je veux que la géométrie de la grille et la position de chaque case soient écrites par l'atelier, montrées et non modifiables, afin de ne pas casser le découpage de ce qui revient.
- **US-270** — En tant qu'auteur, je veux qu'une planche ne soit jamais gardée en bibliothèque et que ses morceaux le soient, afin que le pliage reste une ruse d'appel et non un format de livraison.
- **US-271** — En tant qu'auteur, je veux qu'une planche ne porte qu'une seule chose du jeu, afin que la consigne « le même sujet dans chaque case » reste vraie.

### L'écran de confirmation

- **US-272** — En tant qu'auteur, je veux relire, entre le bouton et la dépense, chaque texte et chaque image qui va partir, sur sa propre ligne, afin de savoir ce que je demande au lieu de le supposer.
- **US-273** — En tant qu'auteur, je veux éteindre n'importe quelle ligne d'un clic et corriger un texte sur place, afin de faire l'essai auquel je pense sans démonter les réglages de mon jeu.
- **US-274** — En tant qu'auteur, je veux qu'une correction faite là ne vaille que pour cet appel et ne remonte nulle part, afin qu'un essai raté n'empoisonne pas tout ce qui vient après.
- **US-275** — En tant qu'auteur, je veux qu'un mot séparé me permette de garder une correction sur la chose du jeu, afin que garder soit un second geste écrit et jamais un effet de bord.
- **US-276** — En tant qu'auteur, je veux lire le prix de chaque image jointe sur la ligne où je la coche, et ce que les cases cochées pèsent dans le total, afin de savoir que presque la moitié de ma facture part dans les références.
- **US-277** — En tant qu'auteur, je veux que le texte montré soit demandé à l'atelier par le chemin même que l'envoi emprunte, afin qu'il ne puisse pas diverger de ce qui part.
- **US-278** — En tant qu'auteur, je veux que le sujet et la pose demandée ne s'éteignent jamais, avec leur marque grise, afin qu'un appel ne parte pas sans rien demander.
- **US-279** — En tant qu'auteur, je veux qu'un avertissement s'écrive sur la ligne fautive avec des chiffres, jamais en bandeau et jamais en conseil, afin de ne pas chercher lequel des deux problèmes annoncés me concerne.
- **US-280** — En tant qu'auteur, je veux une case qui saute cet écran pour la série en cours, sans jamais pouvoir l'éteindre pour toujours, afin que relire dix fois la même chose ne devienne pas une punition.
- **US-281** — En tant qu'auteur, je veux lire aussi, en gris, ce qui se passera au retour — le découpage, la palette, le détourage —, afin de savoir avant que l'image que je verrai n'est pas celle que le modèle envoie.

### Le codex généralisé

- **US-282** — En tant qu'auteur, je veux que les décors, les objets et les éléments d'interface soient des choses du jeu au même titre qu'un personnage, afin de dire ce qui leur manque comme pour tout le reste.
- **US-283** — En tant qu'auteur, je veux qu'un établi n'affiche que ce que sa famille peut avoir, sans rangées grisées « sans objet », afin qu'un écran ne me montre jamais des cases qui ne me concernent pas.
- **US-284** — En tant qu'auteur, je veux que l'établi d'une pièce d'équipement montre sur quels personnages elle est posée plutôt que des images, afin qu'une chose qui n'a pas d'image à elle ne fasse pas semblant d'en avoir.

### La vitrine

- **US-285** — En tant qu'auteur, je veux regarder une image finie en grand, seule, sur le fond que ma bible décrit, afin de voir un contour sombre disparaître sur du noir absolu — ce qu'aucun damier gris ne montre.
- **US-286** — En tant qu'auteur, je veux que les échelles soient des multiples entiers et que rien ne soit lissé, afin de ne pas juger un défaut que la fenêtre a inventé.
- **US-287** — En tant qu'auteur, je veux poser toutes les poses d'une chose à la même échelle, afin de voir celle qui sort d'un quart plus petite que ses sœurs.
- **US-288** — En tant qu'auteur, je veux ouvrir cet écran depuis le codex, depuis une fiche ou depuis une planche et y voir ce que je regardais, afin de comparer mon monde entier, une chose, ou une pose, sans trois écrans.
- **US-289** — En tant qu'auteur, je veux que la place du mouvement soit réservée et grisée avec sa raison, afin de savoir qu'elle viendra sans qu'on me dessine un lecteur sur zéro image.

### Le calibrage

- **US-290** — En tant qu'auteur, je veux superposer toutes les poses d'une chose dans la même case pour décider de leur taille commune, afin de voir un défaut que six vignettes côte à côte ne montrent pas.
- **US-291** — En tant qu'auteur, je veux qu'un bouton propose un calage et dise quelle pose a limité le résultat et ce que ça coûte en résolution, afin de reprendre ensuite à la main en connaissance de cause.
- **US-292** — En tant qu'auteur, je veux qu'une pose très différente des autres soit proposée comme mise de côté, afin qu'un personnage debout ne rapetisse pas d'un tiers parce qu'il meurt dans une autre image.
- **US-293** — En tant qu'auteur, je veux corriger la dérive horizontale d'une pose, afin qu'un bras tendu ne déplace pas le corps de six pixels dans une case de soixante-quatre.
- **US-294** — En tant qu'auteur, je veux que changer la taille de case de mon projet ne défasse aucun calibrage, afin de passer de soixante-quatre à cent vingt-huit sans rien refaire.

### Les dépenses

- **US-295** — En tant qu'auteur, je veux la liste de tous les appels payés, du plus récent au plus ancien, avec ce que chacun a coûté et ce qu'il a donné, afin de savoir où va mon argent.
- **US-296** — En tant qu'auteur, je veux distinguer ce que j'ai gardé, ce que j'ai payé pour rien et ce qui a été refusé, afin de voir le seul cas où l'argent est vraiment perdu.
- **US-297** — En tant qu'auteur, je veux qu'une image supprimée fasse changer l'état de son appel sans jamais faire disparaître sa ligne, afin qu'une dépense ne s'efface jamais.
- **US-298** — En tant qu'auteur, je veux lire le total de l'atelier entier et ce qui n'appartient à aucun jeu, afin de retrouver les onze pour cent qu'aucun écran ne montrait.
- **US-299** — En tant qu'auteur, je veux voir d'un coup d'œil les appels consécutifs sur un même sujet, afin de m'apercevoir que six relances en trente-deux minutes ont coûté le quart de tout.

### Le premier lancement

- **US-300** — En tant qu'auteur, je veux que l'assistant s'ouvre à la toute première ouverture de l'atelier, afin d'avoir quelque part où commencer quand il n'y a ni jeu, ni image, ni clé.
- **US-301** — En tant qu'auteur, je veux sortir de l'assistant à n'importe quelle étape et tomber dans le codex avec le champ qui nomme allumé, afin de fabriquer sans avoir répondu à quoi que ce soit.
- **US-302** — En tant qu'auteur, je veux déposer la clé du fournisseur depuis une étape de l'assistant sans que ce soit un second endroit où elle habite, afin qu'il y ait trois portes et une seule pièce.
- **US-303** — En tant qu'auteur, je veux que la barre du haut dise « aucune clé » dès la première seconde, afin de savoir ce qui manque sans ouvrir un menu.

### Le guide

- **US-304** — En tant qu'auteur, je veux que le guide fasse le tour des lieux qui existent vraiment et dise lequel n'est pas un onglet, afin de ne pas visiter des pièces que personne ne peut ouvrir.
- **US-305** — En tant qu'auteur, je veux que la boucle du produit commence par « nommer », afin que le premier geste possible sur une machine neuve soit le premier expliqué.
- **US-306** — En tant qu'auteur, je veux que les explications soient rangées par lieu du produit et dans l'ordre où je les rencontre, afin de chercher où j'étais plutôt que dans quelle catégorie la chose relève.
- **US-307** — En tant qu'auteur, je veux qu'un groupe sans explication affiche son zéro au lieu de disparaître, afin qu'un manque se voie dans le guide.
- **US-308** — En tant qu'auteur, je veux qu'un réglage sans explication n'ait simplement pas de trait sous son nom, afin qu'un trou du guide ne se voie jamais dans mon travail.

---

## La V2.2 — d'autres fournisseurs, dont des gratuits

*Écrites le 31 août 2026. Elles ne viennent ni d'un chantier de maquettes, ni d'une séance
d'usage, mais d'un constat d'économie : trois fournisseurs d'images rendent des crédits
chaque jour, et le produit n'en connaît qu'un seul, payant. Ce que chacun sait réellement
faire est **à relever avant de construire** — voir `docs/PLAN.md`, § F0.*

### Fabriquer chez plusieurs fournisseurs

- **US-309** — En tant qu'auteur, je veux voir les modèles de tous les fournisseurs dans une seule liste, chacun portant le nom de celui qui le propose, afin de choisir un outil sans avoir à me rappeler chez qui j'ai un compte.
- **US-310** — En tant qu'auteur, je veux que deux modèles de même nom chez deux fournisseurs ne se confondent jamais, ni à l'écran ni dans le journal, afin de savoir lequel des deux a fait l'image que je regarde.
- **US-311** — En tant qu'auteur, je veux qu'un fournisseur injoignable grise ses modèles avec sa raison sans faire disparaître ceux des autres, afin qu'une panne chez l'un ne m'arrête pas de travailler chez l'autre.
- **US-312** — En tant qu'auteur, je veux que chaque image et chaque appel gardent le nom du fournisseur, afin de pouvoir refaire plus tard la même image au même endroit.
- **US-313** — En tant qu'auteur, je veux savoir si ce qu'un modèle déclare savoir faire vient du fournisseur ou d'un relevé fait ici, afin de savoir si le grisé qu'on me montre est une certitude ou une supposition.
- **US-314** — En tant qu'auteur, je veux fabriquer ma première image sans avoir ouvert le moindre compte ni déposé la moindre clé, afin qu'une machine neuve ne soit plus un cul-de-sac.

### Ce qu'un appel consomme

- **US-315** — En tant qu'auteur, je veux qu'un appel sans prix s'affiche « gratuit » et jamais « 0,00 $ », afin de ne pas confondre sans prix et sans limite.
- **US-316** — En tant qu'auteur, je veux voir ce qu'il me reste chez un fournisseur qui compte en jetons et quand la réserve revient, afin de savoir combien d'essais il me reste aujourd'hui.
- **US-317** — En tant qu'auteur, je veux que le produit dise s'il compte cette réserve lui-même ou s'il la lit chez le fournisseur, afin de savoir si le chiffre est relevé ou déduit.
- **US-318** — En tant qu'auteur, je veux que les appels gratuits figurent dans la liste des dépenses avec ce qu'ils ont consommé, afin que « où va mon argent » devienne « où va ce que je consomme ».
- **US-319** — En tant qu'auteur, je veux que le total affiché en argent ne compte que ce qui se paie en argent, afin qu'un total en dollars reste un total en dollars.
- **US-320** — En tant qu'auteur, je veux être prévenu avant de lancer un lot quand la réserve du jour n'y suffira pas, avec ce qui manquerait, afin de choisir entre attendre demain et payer.
- **US-321** — En tant qu'auteur, je veux que le plafond de l'agent distingue ce qu'il dépense de ce qu'il consomme gratuitement, afin qu'un brouillon gratuit ne se cogne pas à un plafond posé pour l'argent.

### Les clés au pluriel

- **US-322** — En tant qu'auteur, je veux déposer une clé par fournisseur, chacune à sa place, afin d'en ajouter un sans toucher à ceux qui marchent déjà.
- **US-323** — En tant qu'auteur, je veux qu'un fournisseur qui demande deux secrets les demande tous les deux et dise lequel manque, afin de ne pas chercher pourquoi il refuse.
- **US-324** — En tant qu'auteur, je veux que la barre du haut dise avec quoi je peux produire plutôt que ce qui manque, afin de savoir ce qui m'est ouvert dès la première seconde.
- **US-325** — En tant qu'auteur, je veux retirer la clé d'un fournisseur sans perdre ses images ni ses dépenses, afin qu'arrêter d'utiliser un fournisseur n'efface pas ce qu'il a fait.
- **US-326** — En tant qu'auteur, je veux que l'étape de l'assistant qui dépose une clé les propose toutes sans devenir un second endroit où elles habitent, afin qu'il y ait plusieurs portes et une seule pièce.

### Un fournisseur qui compte sans le dire

- **US-327** — En tant qu'auteur, je veux qu'une réserve que le fournisseur n'annonce pas appel par appel soit comptée ici et annoncée comme un compte tenu ici, afin de ne pas prendre une estimation pour un relevé.
- **US-328** — En tant qu'auteur, je veux qu'un modèle nouveau chez un fournisseur paraisse sans qu'on ait rien réécrit, afin de ne jamais dépendre d'une liste vieillie.

### Un fournisseur qui répond en deux temps

- **US-329** — En tant qu'auteur, je veux qu'un fournisseur qui fait attendre affiche son attente comme les autres, afin de ne pas croire que rien ne se passe.
- **US-330** — En tant qu'auteur, je veux que toutes les images rendues par une même soumission entrent, afin de ne jamais jeter ce qui a déjà été consommé.

### Le brouillon ne coûte plus rien

- **US-331** — En tant qu'auteur, je veux que le modèle imposé à l'agent soit gratuit par défaut, afin qu'un agent qui code ne dépense plus mon argent pour des visuels de travail.
- **US-332** — En tant qu'auteur, je veux choisir ce modèle d'exploration parmi ceux qui ne coûtent rien, afin de garder la main sur ce que l'agent consomme.
- **US-333** — En tant qu'auteur, je veux qu'une image faite sans les références de mon univers reste reconnaissable plus tard, afin de ne pas chercher pourquoi elle ne ressemble pas aux autres.
