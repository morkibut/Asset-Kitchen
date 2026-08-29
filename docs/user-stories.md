# Asset Kitchen — Les 173 user stories

Le catalogue, groupé comme il l'a été écrit — par geste, dans l'ordre où l'auteur les
rencontre. **On l'ouvre par numéro** : un critère d'acceptation cite `US-65`, on vient
lire ce qu'elle demande.

**`docs/PRD.md` fait foi sur ce que le produit doit faire.** Ce fichier-ci en est le
détail énuméré, pas une autorité de plus : en cas d'écart, le PRD a raison. Quelle tranche
porte quelle story se lit dans `docs/PLAN.md`, § Couverture ; ce qu'une tranche en a fait,
dans `docs/tranches/<code>.md`.

### Démarrer

- **US-1** — En tant qu'auteur, je veux ouvrir l'atelier et écrire un prompt sans rien avoir configuré, afin d'obtenir une image dès la première minute.
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

