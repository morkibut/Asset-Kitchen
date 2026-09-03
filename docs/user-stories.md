# Asset Kitchen — Les 501 user stories

Le catalogue, groupé comme il l'a été écrit — par geste, dans l'ordre où l'auteur les
rencontre. **On l'ouvre par numéro** : un critère d'acceptation cite `US-65`, on vient
lire ce qu'elle demande.

*Treize stories neuves — `482` à `494` — ont été écrites le 3 septembre 2026, quand la V3 a été
recadrée sur la seule animation. Quatre autres sont **retirées** ce jour-là, barrées à leur place
avec la raison ; elles ne sont plus portées par aucune tranche.*

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

### ~~Un fournisseur qui répond en deux temps~~

*Sans objet depuis le relevé du 31 août 2026 (`docs/releve-fournisseurs.md`) : aucun des
fournisseurs retenus ne répond en deux temps. Les deux stories sont gardées telles quelles —
elles redeviendront vraies le jour où un fournisseur de cette forme entrera — et **aucune
tranche ne les porte**.*

- **US-329** — En tant qu'auteur, je veux qu'un fournisseur qui fait attendre affiche son attente comme les autres, afin de ne pas croire que rien ne se passe.
- **US-330** — En tant qu'auteur, je veux que toutes les images rendues par une même soumission entrent, afin de ne jamais jeter ce qui a déjà été consommé.

### Le brouillon ne coûte plus rien

- **US-331** — En tant qu'auteur, je veux que le modèle imposé à l'agent soit gratuit par défaut, afin qu'un agent qui code ne dépense plus mon argent pour des visuels de travail.
- **US-332** — En tant qu'auteur, je veux choisir ce modèle d'exploration parmi ceux qui ne coûtent rien, afin de garder la main sur ce que l'agent consomme.
- **US-333** — En tant qu'auteur, je veux qu'une image faite sans les références de mon univers reste reconnaissable plus tard, afin de ne pas chercher pourquoi elle ne ressemble pas aux autres.

---

## Les cinq capacités que l'usage a réclamées

*Écrites le 1<sup>er</sup> septembre 2026. Elles ne viennent ni d'un chantier de maquettes ni
d'un besoin d'économie, mais de **deux séances de l'auteur sur l'interface refaite**, le même
soir : la première sur la V2.1 entière, la seconde sur les seules tables de l'atelier. Sur les
treize reprises que ces séances ont ouvertes, huit corrigent un écran déjà cadré et **cinq
demandent au produit quelque chose qu'il n'avait jamais promis** — les voici. Ce que chacune
livre et ses critères se lisent dans `docs/tranches/U.md`.*

### La veille d'une table — éteindre sans vider

- **US-334** — En tant qu'auteur, je veux éteindre une place de ma recette depuis la barre des tables, sans avoir à l'ouvrir, afin d'essayer mon image sans elle d'un seul clic.
- **US-335** — En tant qu'auteur, je veux qu'une place éteinte garde tous ses réglages et me les rende tels quels quand je la rallume, afin qu'essayer sans ne me coûte jamais de retaper.
- **US-336** — En tant qu'auteur, je veux distinguer d'un coup d'œil une place éteinte d'une place vide, afin de ne pas croire que je n'ai rien réglé quand je n'ai fait qu'éteindre.
- **US-337** — En tant qu'auteur, je veux qu'une table éteinte le dise quand je l'ouvre, et que toucher un de ses réglages la rallume en me l'annonçant, afin de ne jamais régler quelque chose qui n'agit pas.
- **US-338** — En tant qu'auteur, je veux que la veille soit un réglage de ma recette et non un état d'écran — qu'elle refasse le rendu, qu'elle voyage avec le reste, et que l'agent la lise et la pose comme n'importe quel autre —, afin qu'éteindre soit aussi durable que régler.
- **US-339** — En tant qu'auteur, je veux qu'une image traitée avec une place en veille sorte identique à la même sans cette place du tout, afin qu'endormie veuille dire sans effet et non presque sans effet.

### Les réglages voyagent d'une image à l'autre

*`US-66` demandait déjà de nommer une recette et de la réappliquer ailleurs : le produit sait
le faire depuis la V1, et aucun écran ne l'a jamais appelé. Ce qui suit ajoute la surface, le
geste court, et la règle de ce qui ne voyage pas.*

- **US-340** — En tant qu'auteur, je veux copier les réglages d'une image et les coller sur une autre, sans rien nommer ni ranger, afin de traiter les cinq attitudes suivantes comme la première.
- **US-341** — En tant qu'auteur, je veux qu'un collage me dise ce qu'il a posé et ce qu'il n'a pas pu poser, afin de savoir où j'en suis sans comparer place par place.
- **US-342** — En tant qu'auteur, je veux que ce qui désigne un endroit de cette image-là — un cadre tracé, un point de pipette, une forme entourée, un passage de la main — ne voyage jamais, afin qu'un collage ne cadre ni n'efface au hasard sur une silhouette qui n'est pas la même.
- **US-343** — En tant qu'auteur, je veux qu'une place privée de ce qui la désignait arrive sans effet et le dise, afin de la reprendre moi-même au lieu de découvrir le manque en regardant le rendu.
- **US-344** — En tant qu'auteur, je veux enregistrer la recette courante sous un nom depuis la barre des tables, afin de garder un traitement qui survive à ma séance.
- **US-345** — En tant qu'auteur, je veux retrouver mes recettes nommées au même endroit, en appliquer une, en oublier une, afin de n'avoir rien à ranger ailleurs.
- **US-346** — En tant qu'auteur, je veux qu'un nom déjà pris me propose de remplacer et ne remplace jamais en silence, afin de ne pas perdre un traitement que j'avais gardé.
- **US-347** — En tant qu'auteur, je veux que mes recettes nommées appartiennent à l'atelier et non à un jeu, afin de poser sur le décor d'un autre jeu le traitement que j'ai mis au point ici.

### Le texte d'une image se relit sur sa fiche

- **US-348** — En tant qu'auteur, je veux lire sur la fiche d'une image le texte entier qui est parti la fabriquer, replié par défaut et dépliable, afin de savoir ce que j'avais demandé sans changer d'onglet.
- **US-349** — En tant qu'auteur, je veux que ce soit le texte réellement parti, avec ce que le jeu et l'ambiance y avaient ajouté, afin qu'une vieille image dise ce qui l'a faite et non ce que je taperais aujourd'hui.
- **US-350** — En tant qu'auteur, je veux copier ce texte depuis la fiche sans passer par *reprendre les réglages*, afin de le relire ou l'emporter ailleurs sans armer une génération.
- **US-351** — En tant qu'auteur, je veux qu'une image entrée par import dise qu'elle n'a pas de texte, afin de ne pas chercher ce qui n'existe pas.
- **US-352** — En tant qu'auteur, je veux qu'une image née d'une autre — une découpe de planche, un calque rendu — nomme celle dont elle descend et m'y mène, sans afficher ici un texte qui n'y a pas été écrit, afin de remonter à ce qui a été demandé sans confondre les deux images.

### La sélection magique — tracer gros, ajuster au bord

- **US-353** — En tant qu'auteur, je veux entourer grossièrement à main levée ce que je veux garder, et voir ma forme pendant que je la trace, afin de désigner un sujet sans suivre son contour au pixel.
- **US-354** — En tant qu'auteur, je veux que l'atelier ramène le contour sur le bord du sujet à l'intérieur de ma forme et ne touche à rien au-dehors, afin d'obtenir un fond propre là où le remplissage se trompe et où la main serait trop longue.
- **US-355** — En tant qu'auteur, je veux que ce tracé soit une façon de plus de désigner ce qu'on retire, à côté du bord, de la pipette et du modèle, afin qu'un seul endroit décide de ce qui est effacé.
- **US-356** — En tant qu'auteur, je veux qu'il agisse avant le recadrage et la mise sur grille, afin que ces deux places sachent où est le sujet au lieu de travailler sur une image dont le fond est encore là.
- **US-357** — En tant qu'auteur, je veux retoucher ensuite le résultat à la main sans recommencer, afin de rattraper les quelques pixels que l'ajustement a manqués.
- **US-358** — En tant qu'auteur, je veux défaire ce tracé d'un seul coup, afin de l'essayer sans risque.

### Un second moteur de détourage

- **US-359** — En tant qu'auteur, je veux choisir le moteur d'une passe dans une liste que l'atelier tient de ce que ma machine sait faire, afin de ne plus dépendre d'un seul nom décidé une fois pour toutes.
- **US-360** — En tant qu'auteur, je veux que le moteur rapide reste celui que j'obtiens sans rien demander, afin qu'une silhouette facile ne me coûte jamais une attente.
- **US-361** — En tant qu'auteur, je veux disposer d'un moteur plus lourd et meilleur pour les cheveux, les franges et les objets ajourés, afin de ne pas reprendre à la main ce qu'un meilleur modèle sait faire.
- **US-362** — En tant qu'auteur, je veux qu'un moteur plus lent l'annonce avant de partir et non pendant, afin de choisir d'attendre plutôt que de le subir.
- **US-363** — En tant qu'auteur, je veux qu'un moteur installé dont le modèle n'est pas encore descendu me dise ce qu'il va rapatrier et combien ça pèse, avant de partir et une seule fois, afin qu'une attente de plusieurs minutes ne me tombe pas dessus sans prévenir.
- **US-364** — En tant qu'auteur, je veux qu'un moteur absent de ma machine soit grisé avec sa raison et le geste pour l'installer, afin de ne jamais découvrir l'absence après avoir lancé.
- **US-365** — En tant qu'auteur, je veux qu'une recette qui nomme un moteur absent le dise sans casser le rendu des autres passes, afin qu'une recette venue d'ailleurs ne me laisse pas devant une image blanche.
- **US-366** — En tant qu'auteur, je veux savoir sur quoi repose « meilleur » — la durée de chaque moteur et ce qu'ils rendent côte à côte sur des silhouettes difficiles —, afin de choisir sur un relevé et non sur une promesse.

---

## R6 — la planche qui revient de travers

*Hors V3 : cette reprise répare aussi les planches d'équipement de la V2, et elle se rembourse
dès aujourd'hui — trente-et-un pour cent des appels d'une planche se perdent pour cette raison.*

- **US-367** — En tant qu'auteur, je veux qu'une planche revenue avec plus de sujets que demandé me soit proposée avec les cases en trop à écarter, plutôt que refusée en bloc, afin qu'un appel payé ne se perde pas pour une case de trop.
- **US-368** — En tant qu'auteur, je veux être prévenu quand un « sujet » occupe presque toute sa case — c'est le quadrillage que le modèle a redessiné, pas un personnage —, afin de ne pas garder du vide payé sans le savoir.

---

## La V3 — l'animation

*Recadrée le 3 septembre 2026 : **la version ne fait qu'animer**. Les stories de la planche et de
son dépliage descendent en V3.5 — elles servent le prix de toutes les générations, pas
l'animation. Celles du pantin sortent du plan. Et quatre sont retirées parce qu'une décision
durable les contredit ou qu'une autre tranche les rend en mieux.*

### Le mouvement, dit une fois pour toutes

*`A6` — avant tout le reste : on ne commande pas un clip sans nommer ce qu'on demande.*

- **US-392** — En tant qu'auteur, je veux que l'atelier connaisse des mouvements par leur nom — repos, marche, course, saut —, chacun avec ses étapes et ses directions, afin de ne plus les décrire en mots à chaque personnage.
- **US-393** — En tant qu'auteur, je veux ajouter mes propres mouvements à cette liste, afin que l'atelier suive mon jeu au lieu de le précéder.
- **US-394** — En tant qu'auteur, je veux qu'un clip commandé deux fois pour le même mouvement parte avec exactement la même demande, afin qu'un écart entre deux tirages vienne du modèle et non de ma frappe.
- **US-395** — En tant qu'auteur, je veux que ces mouvements appartiennent à l'atelier et non à un projet, afin de les retrouver dans le jeu suivant.

### Le cadre qui ne dérive pas

*`A2` — une correction, pas une fonctionnalité.*

- **US-376** — En tant qu'auteur, je veux que toutes les images d'une bande soient recadrées sur une seule et même fenêtre, afin que le personnage ne saute pas et ne change pas de taille d'une image à l'autre.
- **US-379** — En tant qu'auteur, je veux que l'aperçu me montre les pixels que le modèle a dessinés, fond compris, afin de ne pas juger le détourage à la place de la marche.

### Le clip entre dans l'atelier

*`A9` — le serveur est écrit et éprouvé ; l'écran reste. Écrites le 2 septembre 2026, quand six
essais ont fait de la vidéo le chemin de l'animation ; celles de la file réécrites le 3 septembre,
quand l'objet commandé est devenu un clip.*

- **US-434** — En tant qu'auteur, je veux commander une vidéo d'animation depuis un personnage, en choisissant le mouvement et le modèle, afin d'obtenir une animation sans avoir à demander une planche qui rate neuf fois sur dix.
- **US-435** — En tant qu'auteur, je veux savoir avant d'envoyer ce que le clip va coûter **et d'où sort ce prix**, afin de décider en connaissance de cause plutôt que de faire confiance à un chiffre.
- **US-436** — En tant qu'auteur, je veux que le clip revienne avec ce qu'il a **réellement** coûté, afin que l'argent que je dépense ne disparaisse jamais du journal.
- **US-437** — En tant qu'auteur, je veux retrouver un clip commandé même si j'ai fermé l'atelier pendant qu'il se fabriquait, afin de ne pas payer deux fois la même attente.
- **US-438** — En tant qu'auteur, je veux que récupérer un clip déjà payé soit un geste **que je demande**, afin que l'atelier ne rappelle jamais le fournisseur sans moi.
- **US-439** — En tant qu'auteur, je veux voir mes clips dans la bibliothèque à côté du reste, afin de ne pas avoir un objet payé qui se cache.
- **US-440** — En tant qu'auteur, je veux qu'un modèle vidéo proposé sans avoir été assez mesuré me le dise, afin de ne pas prendre une hypothèse pour un résultat.
- **US-380** — En tant qu'auteur, je veux lancer plusieurs clips du même mouvement en un seul geste, afin de ne pas payer une attente par tentative.
- **US-381** — En tant qu'auteur, je veux les voir revenir un par un et bouger dès leur arrivée, afin de choisir en regardant au lieu de deviner, et sans attendre les autres.
- **US-382** — En tant qu'auteur, je veux savoir avant de lancer ce que le lot entier va coûter, afin de décider du nombre de tentatives en connaissance de cause.
- **US-383** — En tant qu'auteur, je veux garder un clip et jeter les autres d'un seul geste, afin que le tri ne me coûte pas plus cher que la fabrication.

### Le montage — plusieurs animations dans un clip

*`A10` — le cœur de la version.*

- **US-441** — En tant qu'auteur, je veux qu'un clip s'ouvre en tournant déjà en boucle, afin de juger le mouvement au lieu de l'imaginer.
- **US-442** — En tant qu'auteur, je veux faire glisser une fenêtre sur les images du clip pour choisir ce que je garde, afin de caler un cycle à l'œil sans taper un seul chiffre.
- **US-443** — En tant qu'auteur, je veux voir en même temps les images brutes et la bande passée par la chaîne du jeu, afin de juger le mouvement et le découpage séparément — ce sont deux métiers.
- **US-444** — En tant qu'auteur, je veux tirer **plusieurs animations du même clip**, chacune sous son nom, afin qu'un seul paiement remplisse plusieurs cases.
- **US-445** — En tant qu'auteur, je veux que l'atelier me montre où le clip se referme le mieux et où il ne bouge presque pas, afin de savoir où regarder sans parcourir cent images.
- **US-446** — En tant qu'auteur, je veux affecter une bande à une case du plan de poses de mon personnage, afin que ce que je découpe aille se ranger tout seul.
- **US-447** — En tant qu'auteur, je veux régler la vitesse une seule fois et que ce soit celle qui part à l'export, afin que ce que je vois dans l'atelier soit ce que le jeu jouera.
- **US-448** — En tant qu'auteur, je veux voir ce que me revient une animation de ce clip, et que ce prix baisse à chaque bande gardée, afin de savoir quand j'ai tiré du clip tout ce qu'il avait.
- **US-449** — En tant qu'auteur, je veux savoir que rien sur cet écran ne dépense, afin de découper et recommencer sans compter.
- **US-450** — En tant qu'auteur, je veux prendre ou laisser **chaque image du clip une par une**, afin de serrer deux images au moment du contact d'un pas et n'en garder qu'une pendant la glisse — ce qu'un échantillonnage régulier ne saura jamais faire.
- **US-451** — En tant qu'auteur, je veux refaire le cadrage d'une bande à la main quand le cadrage automatique tombe mal, afin de ne pas être bloqué par une mesure qui s'est trompée.
- **US-452** — En tant qu'auteur, je veux régler la recette du découpage depuis l'écran de montage — la taille du pixel, les couleurs, le détourage —, afin d'essayer et de voir, au lieu d'aller changer les réglages du jeu pour une seule bande.
- **US-453** — En tant qu'auteur, je veux que toutes les bandes tirées d'un même clip aient la même assise, afin que mon personnage ne change pas de taille en passant du repos à la marche.

### Le moteur de la maison — animer sans payer

*`A11` — la seule tranche qui amène le prix d'un clip à zéro.*

- **US-454** — En tant qu'auteur, je veux fabriquer un clip **sur la carte graphique de mon propre ordinateur**, afin de ne plus rien payer pour animer et d'en tirer autant que je veux.
- **US-455** — En tant qu'auteur, je veux voir le moteur de la maison **dans la même liste** que les modèles payants, afin de choisir sans avoir à apprendre un second écran.
- **US-456** — En tant qu'auteur, je veux qu'on m'annonce **une attente au lieu d'un prix** quand la fabrication est gratuite, afin de savoir à quoi je m'engage — le temps se dépense aussi.
- **US-457** — En tant qu'auteur, je veux que mon journal des dépenses distingue **un clip qui n'a rien coûté** d'un clip dont le prix n'a pas pu être lu, afin de ne pas confondre « gratuit » et « on ne sait pas ».
- **US-458** — En tant qu'auteur, je veux pouvoir demander un clip d'**une, deux ou trois secondes**, afin de rester dans la longueur où la bande sort propre.
- **US-459** — En tant qu'auteur, je veux qu'on me dise **combien d'images le clip contiendra vraiment**, afin de ne pas croire à une durée ronde que le moteur ne sait pas rendre.
- **US-460** — En tant qu'auteur, je veux savoir **ce qui manque et ce que ça pèse** avant de lancer un téléchargement de modèles, afin de décider en connaissance de cause et de ne pas attendre pour rien.
- **US-461** — En tant qu'auteur, je veux que l'atelier **ne touche jamais à mon installation de ComfyUI**, afin qu'ajouter la vidéo ne casse pas ce qui marchait déjà — mes bruitages notamment.

### Toutes les poses, en animation

*`A12` — c'est ici que l'objectif de la version se vérifie. Écrites le 3 septembre 2026.*

- **US-482** — En tant qu'auteur, je veux lire la matrice de mon personnage sur **deux calques** — ses images fixes et ses animations —, afin de voir ce qui manque d'un côté sans qu'une case remplie de l'autre me le cache.
- **US-483** — En tant qu'auteur, je veux **une jauge par calque**, afin de savoir combien de poses sont animées sans les compter à la main.
- **US-484** — En tant qu'auteur, je veux commander le clip d'une case vide **depuis cette case**, avec l'image de départ déjà proposée, afin de ne pas retraverser trois écrans à chaque case que je remplis.
- **US-485** — En tant qu'auteur, je veux voir chaque case animée tourner à la taille de sa vignette, afin de juger ma matrice en la regardant au lieu de la lire.
- **US-486** — En tant qu'auteur, je veux qu'une case animée dise **de quel clip** elle vient et que je puisse y remonter, afin de la redécouper autrement sans rien repayer.

### L'image attrapée au vol

*`A13` — la version rend service au-delà de l'animation. Écrites le 3 septembre 2026.*

- **US-487** — En tant qu'auteur, je veux **mettre de côté une image du clip** pendant que je découpe, sans quitter l'écran, afin de récupérer une belle attitude que je n'étais pas venu chercher.
- **US-488** — En tant qu'auteur, je veux que cette image entre dans ma bibliothèque **avec ce dont elle vient** — quel clip, quelle image, quelle génération l'a payé —, afin de savoir plus tard d'où elle sort.
- **US-489** — En tant qu'auteur, je veux la ranger **ensuite** dans une case ou sur un objet, en un second geste facultatif, afin de ne pas avoir à décider au moment où je prélève juste pour voir.
- **US-490** — En tant qu'auteur, je veux qu'elle passe par la chaîne de mon jeu comme n'importe quelle image, afin qu'une image tirée d'une vidéo ne soit pas une exception que je devrais retraiter à part.

### La bande sort de l'atelier

*`A4`.*

- **US-385** — En tant qu'auteur, je veux exporter une bande en planche de sprites accompagnée de sa description, afin de la charger dans mon moteur sans avoir à la remesurer.
- **US-386** — En tant qu'auteur, je veux l'exporter aussi en image animée, afin de la montrer sans demander à personne d'ouvrir un moteur de jeu.
- **US-387** — En tant qu'auteur, je veux que l'export dise à quelle cadence la bande a été pensée, afin que ce que je vois dans l'atelier soit ce que je verrai dans le jeu.
- **US-388** — En tant qu'auteur, je veux exporter toutes les bandes d'un personnage en une seule archive, afin de livrer un personnage complet d'un geste.

### Le contour qui ne bout pas

*`A5` — la stabilité entre deux images ; le bord juste, lui, est le sujet de `D4`.*

- **US-390** — En tant qu'auteur, je veux que le bord de ma silhouette soit calculé de la même façon sur toutes les images d'une bande, afin qu'il ne grésille pas quand la bande tourne.
- **US-391** — En tant qu'auteur, je veux comparer l'avant et l'après de cette correction sur une même bande, afin de vérifier qu'elle améliore au lieu de le croire sur parole.

### Reprendre une image sans refaire la bande

*`A7` — rétrécie le 3 septembre 2026 : choisir les images, c'est l'écran de montage.*

- **US-396** — En tant qu'auteur, je veux voir l'image précédente en transparence sous celle que je corrige, afin de juger un déplacement au lieu de le deviner.
- **US-397** — En tant qu'auteur, je veux déplacer une image au pixel dans sa fenêtre, afin de rattraper un décalage sans rien repayer.
- **US-398** — En tant qu'auteur, je veux remplacer une image par une autre du même clip, afin qu'une bande bonne aux sept huitièmes ne parte pas à la poubelle.
- **US-384** — En tant qu'auteur, je veux prendre une image dans un clip et une autre dans un autre clip, afin de composer une bonne animation avec deux clips à moitié bons.
- **US-399** — En tant qu'auteur, je veux que la fenêtre commune se recalcule quand je change une image, afin de ne pas réintroduire à la main le saut qu'elle est faite pour éviter.
- **US-400** — En tant qu'auteur, je veux ancrer une bande par l'un de ses neuf points — les pieds, le centre, un coin —, afin que le personnage tienne au sol plutôt qu'au cadre.

### Retirées le 3 septembre 2026

*Écrites ici barrées plutôt que supprimées, pour que personne ne les repropose sans savoir
pourquoi elles sont parties.*

- ~~**US-375** — déclarer une bande avec un **nombre d'étapes**.~~ **Contredite par une décision durable** : une bande est une liste d'images choisies, et son nombre d'images se lit au lieu de se régler. Un cycle de marche n'est pas régulier.
- ~~**US-377** — voir sa bande tourner tout de suite.~~ **Rendue en mieux par `US-441`** : le clip s'ouvre en tournant déjà, et deux boucles y tournent côte à côte.
- ~~**US-378** — régler la vitesse de cet aperçu.~~ **Rendue en mieux par `US-447`** : un seul curseur, qui règle l'aperçu *et* la cadence qui part à l'export.
- ~~**US-389** — un bord juste, sans arbitrer entre un halo et un sprite qui maigrit.~~ **C'est le défaut que `D4` répare** (`US-429`), sur une image seule. `A5` ne traite que la stabilité entre deux images.

### Sorties du plan avec le pantin

*Aucune ligne écrite. Le pantin était le seul moyen d'animer sans payer ; le moteur de la maison
l'est aussi, sans squelette ni maillage. Les arguments restent, en fin de `docs/PLAN.md`.*

- **US-401** — En tant qu'auteur, je veux obtenir les pièces d'un personnage — tête, buste, bras, jambes — à partir d'une de ses images, afin d'avoir de quoi l'articuler.
- **US-402** — En tant qu'auteur, je veux que l'atelier pose le squelette tout seul sur ces pièces, afin de ne pas passer une heure par personnage à planter des pivots.
- **US-403** — En tant qu'auteur, je veux corriger un pivot ou l'ordre des pièces quand la pose automatique se trompe, afin qu'un cas difficile reste faisable.
- **US-404** — En tant qu'auteur, je veux appliquer un mouvement de la bibliothèque à ce pantin et obtenir une bande sans payer un seul appel, afin qu'une animation de plus ne coûte plus rien.
- **US-405** — En tant qu'auteur, je veux que la même bande, redemandée, revienne identique, afin de ne plus dépendre d'un tirage.
- **US-406** — En tant qu'auteur, je veux que l'atelier me dise clairement ce que le pantin ne sait pas faire — changer de vue, retourner une main —, afin de savoir quand il faut repasser par une génération.

---

## La V3.5 — le dépliage généralisé

*Née le 3 septembre 2026 du recadrage de la V3. Elle ne fabrique rien de neuf : **elle divise le
prix de tout ce que le produit fabrique déjà.** Demander huit images coûte huit appels ; demander
une grande image qui en contient huit coûte un appel.*

### La planche se garde, et son dépliage se refait

*`P1` — ex-`A6` du premier découpage de la V3, sortie de l'animation le 3 septembre 2026.*

- **US-369** — En tant qu'auteur, je veux retrouver la planche entière dans ma galerie, à côté des images qui en sont sorties, afin de pouvoir la regarder, la comparer et la reprendre.
- **US-370** — En tant qu'auteur, je veux voir sur chaque image de quelle planche et de quel dépliage elle vient, afin de ne jamais perdre le fil de ce que j'ai fabriqué.
- **US-371** — En tant qu'auteur, je veux déplier une planche autant de fois que je le veux, afin qu'un découpage raté se refasse au lieu de se repayer.
- **US-372** — En tant qu'auteur, je veux corriger les coupes à la main quand je refais un dépliage — déplacer, ajouter, retirer un rectangle —, afin que la grille rendue par le modèle ne décide pas à ma place.
- **US-373** — En tant qu'auteur, je veux supprimer les images d'un dépliage sans toucher à la planche ni aux autres dépliages, afin de faire le ménage sans rien perdre d'autre.
- **US-374** — En tant qu'auteur, je veux que le premier dépliage se fasse tout seul, sans rien me demander, afin qu'une planche qui revient bien n'ajoute aucun geste à ce que je fais déjà.

### Une planche pour plusieurs choses

*`P2` — et un invariant à lever d'abord : aujourd'hui une planche ne porte qu'une seule chose du
jeu. Écrites le 3 septembre 2026.*

- **US-491** — En tant qu'auteur, je veux commander **plusieurs objets différents sur une seule planche**, afin de payer un appel au lieu de huit pour remplir mon inventaire.
- **US-492** — En tant qu'auteur, je veux dire d'avance ce que **chaque case** de la planche doit contenir, afin que le découpage range chaque morceau à sa place sans que je le fasse à la main.
- **US-493** — En tant qu'auteur, je veux qu'une case dont le sujet n'est pas celui annoncé **me le signale**, afin de ne pas ranger une potion à la place d'une clé.
- **US-494** — En tant qu'auteur, je veux voir le **prix par sujet** à côté du prix de la planche, afin de mesurer ce que le regroupement me fait vraiment économiser.

## La V2.3 — le traitement cesse d'être à refaire

### Une recette par défaut, par nature d'image

- **US-407** — En tant qu'auteur, je veux que le détourage par défaut soit celui qui marche le plus souvent sur mes images, afin de ne plus le refaire à la main sur presque chacune.
- **US-408** — En tant qu'auteur, je veux un défaut distinct pour une image seule et pour une planche, afin que le réglage suive ce que je fabrique au lieu de faire une moyenne des deux.
- **US-409** — En tant qu'auteur, je veux pouvoir donner à une famille de mon univers son propre défaut, afin qu'un décor et un personnage ne soient pas traités pareil.
- **US-410** — En tant qu'auteur, je veux voir quel défaut va s'appliquer et d'où il vient, avant de générer, afin de ne pas le découvrir sur l'image revenue.
- **US-411** — En tant qu'auteur, je veux que changer un défaut ne touche à aucune image déjà faite, afin qu'un réglage d'aujourd'hui ne réécrive pas mon travail d'hier.
- **US-412** — En tant qu'auteur, je veux régler ces défauts au même endroit que le reste de mon univers, afin de ne pas chercher dans un second écran ce que le premier décide déjà.

### La grille retrouvée, et la réduction qui ne bave plus

*Les sept sont livrées le 3 septembre 2026, en deux moitiés le même jour (`docs/PLAN.md` § D2).*

> ⚠️ **`US-413` et `US-61` se lisent ensemble, et leur écart est réel.** `US-413` veut que
> l'atelier retrouve la taille de bloc *« afin de ne pas ramener une image sur une grille qui
> n'est pas la sienne »* ; `US-61` veut que la taille de sortie soit **demandée, jamais déduite
> de l'image reçue**, parce qu'en déduire une reviendrait à laisser le fournisseur décider de
> l'échelle du jeu. Les deux ne peuvent pas être vraies au sens fort en même temps.
>
> **Ce qui est livré tranche pour `US-61`, et honore `US-413` par la lecture faible** : le pas du
> modèle est **retrouvé et montré**, avec ce qu'il vaut en carrés, juste au-dessus du réglage de
> taille ; il n'est jamais appliqué. L'auteur cesse de choisir à l'aveugle, ce qui est le besoin
> derrière `US-413` ; il continue de choisir, ce qui est l'exigence de `US-61`. Si l'auteur veut
> un jour la lecture forte — se caler d'office sur la grille du modèle —, c'est `US-61` qu'il
> faut rouvrir d'abord, et une cinquième méthode de réduction attend au banc
> (`essais/essai_conversion_pixel.py`).

- **US-413** — En tant qu'auteur, je veux que l'atelier retrouve tout seul la vraie taille de bloc que le modèle a dessinée, afin de ne pas ramener une image sur une grille qui n'est pas la sienne.
- **US-414** — En tant qu'auteur, je veux que la réduction garde les couleurs de mon sprite au lieu d'en inventer entre deux, afin qu'un aplat reste un aplat.
- **US-415** — En tant qu'auteur, je veux que l'antialiasing du modèle disparaisse au lieu d'être moyenné dans mes couleurs, afin de ne pas récupérer un bord flou sur une image nette.
- **US-416** — En tant qu'auteur, je veux que ma palette s'applique sur l'image déjà réduite, afin de ne pas fabriquer des couleurs de bord qui n'existent nulle part dans mon jeu.
- **US-417** — En tant qu'auteur, je veux imposer la taille de bloc à la main quand la détection se trompe, afin de n'être jamais bloqué par une mesure. *(Tenue depuis toujours par `US-61` : la taille est demandée. Ce que D2 ajoute est que les crans **restent là** quand la détection se tait, et que la phrase du refus les désigne.)*
- **US-418** — En tant qu'auteur, je veux que l'atelier dise clairement qu'il n'a pas su trouver la grille, afin de ne pas prendre une supposition pour une mesure. *(Le cœur de la seconde moitié : la mesure d'avant répondait « 2 » avec une netteté de 0,94 sur une peinture. Trois refus, trois phrases en français.)*
- **US-419** — En tant qu'auteur, je veux comparer l'ancienne et la nouvelle réduction sur la même image, afin de vérifier que c'est mieux au lieu de le croire.

### Le fond, réglage du projet

- **US-420** — En tant qu'auteur, je veux choisir la couleur de fond sur laquelle le modèle pose mes sujets, afin que le détourage cesse d'être un arbitrage sur presque chaque image.
- **US-421** — En tant qu'auteur, je veux que la demande interdise au modèle d'employer cette couleur et ses voisines dans le sujet, les reflets, les accessoires et les ombres, afin qu'elle ne réapparaisse pas là où elle ferait un trou.
- **US-422** — En tant qu'auteur, je veux que l'atelier me dise quand aucune couleur de fond n'est sûre pour mon univers, afin qu'il ne choisisse pas en silence une couleur que mon personnage porte déjà.
- **US-423** — En tant qu'auteur, je veux corriger la couleur de fond juste avant de lancer une génération, afin de l'adapter à un sujet particulier sans changer le réglage de tout le projet.
- **US-424** — En tant qu'auteur, je veux qu'un univers qui n'a pas encore de palette continue de se comporter comme avant, afin qu'un jeu neuf ne demande pas un réglage qu'il ne peut pas encore fournir.

### Les moteurs de détourage s'ouvrent, et le contour se pose net

- **US-425** — En tant qu'auteur, je veux savoir sur quoi chaque moteur de détourage a été entraîné, afin de comprendre pourquoi l'un réussit là où l'autre échoue.
- **US-426** — En tant qu'auteur, je veux un moteur entraîné sur du dessin et non sur de la photo, afin que le détourage travaille enfin sur des images qui ressemblent aux miennes.
- **US-427** — En tant qu'auteur, je veux essayer le moteur qui vise les silhouettes difficiles sans rapatrier près d'un gigaoctet, afin de savoir s'il vaut mieux que les autres sur mes images.
- **US-428** — En tant qu'auteur, je veux qu'un moteur absent me dise ce qu'il doit récupérer et combien ça pèse avant de le lancer, afin de décider en connaissance de cause.
- **US-429** — En tant qu'auteur, je veux que le contour se pose sur le vrai bord du sujet et non entre deux couleurs, afin d'obtenir un trait net sur une image réduite.
- **US-430** — En tant qu'auteur, je veux comparer côte à côte ce que rendent les moteurs et le temps qu'ils prennent, afin de choisir sur ce que je vois et non sur ce qu'on me promet.

### Le texte qui part se lit en trois parties

- **US-431** — En tant qu'auteur, je veux que le texte envoyé au modèle soit rangé en parties nommées — le contexte, les références, ce que je demande —, afin de relire ce qui part sans démêler un bloc.
- **US-432** — En tant qu'auteur, je veux voir ces parties séparément sur l'écran qui montre ce qui va partir, afin de corriger l'une sans toucher aux autres.
- **US-433** — En tant qu'auteur, je veux que chaque image jointe soit annoncée pour ce qu'elle est — un style, une pose, un gabarit —, afin que le modèle ne prenne pas une référence de style pour une consigne de posture.

## R8 et R9 — les deux écrans qui ne disaient pas à quoi ils servaient

### La fiche d'une chose montre la chose, et dit à quoi chaque partie sert

- **US-462** — En tant qu'auteur, je veux voir la chose sur sa propre fiche — son portrait, pris parmi ses images déjà faites —, afin de savoir de qui je parle sans ouvrir un autre écran.
- **US-463** — En tant qu'auteur, je veux que la fiche porte le nom de la chose sur sa surface et non seulement dans le fil de navigation, afin de savoir où je suis d'un coup d'œil.
- **US-464** — En tant qu'auteur, je veux que chaque partie de la fiche dise à quoi elle sert, écrit sous son titre, afin de ne plus deviner ce que « ce qui l'habille » recouvre.
- **US-465** — En tant qu'auteur, je veux l'explication complète d'une partie au survol de son titre, afin de la lire là où la question se pose au lieu d'aller chercher dans le guide.
- **US-466** — En tant qu'auteur, je veux voir chaque image d'exemple en vignette, afin de la retenir ou de l'écarter en la regardant au lieu de lire son nom.
- **US-467** — En tant qu'auteur, je veux voir les images déjà faites de cette chose sur sa fiche, afin de juger ce qui est fait au lieu de lire un chiffre qui le résume.
- **US-468** — En tant qu'auteur, je veux lire l'état complet d'une chose sans cliquer cinq fois, et sans qu'un résumé se coupe au milieu d'un mot, afin de ne pas avoir à tenir cet état dans ma tête.

### Le calibrage montre le défaut qu'il répare

- **US-469** — En tant qu'auteur, je veux que l'écran du calibrage me dise quel défaut il répare, afin de comprendre à quoi cet outil sert avant d'y toucher.
- **US-470** — En tant qu'auteur, je veux lire ce que le bouton va faire au-dessus du bouton, afin de savoir ce que j'obtiens et ce que je perds avant d'appuyer.
- **US-471** — En tant qu'auteur, je veux voir mes poses telles qu'elles sont et telles qu'elles seraient, côte à côte, afin de juger le résultat sans avoir à le déclencher pour le découvrir.
- **US-472** — En tant qu'auteur, je veux que le bouton s'éteigne et me dise pourquoi quand mes poses sont déjà à la bonne taille, afin de ne pas être invité à un geste qui ne change rien.
- **US-473** — En tant qu'auteur, je veux que les commandes de cet écran soient écrites en toutes lettres, afin de ne pas avoir à cliquer un symbole pour découvrir ce qu'il fait.
- **US-474** — En tant qu'auteur, je veux voir la silhouette de chaque pose à côté de son nom, avec ses mesures alignées et lisibles, afin de repérer celle qui sort du lot sans lire une colonne de chiffres.
- **US-475** — En tant qu'auteur, je veux l'explication de chaque réglage de cet écran au survol de son nom, afin de savoir ce que « occupation » et « décalage » déplacent avant de les changer.

### Rien ne peut être plus grand qu'un personnage

- **US-476** — En tant qu'auteur, je veux déclarer qu'un type d'objet fait plusieurs personnages de haut, afin de pouvoir enfin commander un bâtiment, un arbre ou une tour.
- **US-477** — En tant qu'auteur, je veux lire la hauteur que je règle en personnages **et** en carrés à la fois, afin de ne pas convertir de tête entre ce que je décris et ce que mon moteur de jeu demande.
- **US-478** — En tant qu'auteur, je veux un échantillon dessiné où le sujet se compare à un personnage, afin de juger un rapport d'échelle d'un coup d'œil au lieu de lire un pourcentage.
- **US-479** — En tant qu'auteur, je veux que l'image d'un sujet plus haut qu'un personnage revienne d'autant plus grande, afin qu'elle garde la même taille de carré que tout le reste du jeu.
- **US-480** — En tant qu'auteur, je veux savoir jusqu'où la hauteur peut monter sur ma case et pourquoi elle s'arrête là, afin de ne pas découvrir la borne en butant dessus.
- **US-481** — En tant qu'auteur, je veux que mes images déjà traitées rendent exactement la même chose après cette évolution, afin de ne pas avoir à toutes les revérifier.

---

## La V3.1 — l'atelier tient ce qu'il dit

*Les sept gestes que la V3.1 ajoute vraiment. Le reste de la version — une quarantaine de
changements — répare ce que le produit avait déjà promis, construit ou décidé : ceux-là n'ouvrent
aucune histoire d'usage neuve, ils tiennent celles qui existent. Nés du carnet de l'auteur, séance
du 3 septembre 2026, et arbitrés le même jour.*

> **`G1` est le premier de ces quarante et quelques changements à être livré**, le 3 septembre
> 2026, et il n'ouvre en effet aucune story : douze phrases visibles du produit avaient cessé
> d'être vraies sans changer d'un mot, et elles disent à nouveau ce qu'elles ont toujours voulu
> dire. Ce qu'il faut retenir ici est la forme du défaut, parce qu'elle se reproduira : *une
> histoire d'usage tenue par une phrase juste le jour de son écriture n'est tenue que ce jour-là*.

### Un jeu ne porte que les types d'objets qu'il contient

- **US-495** — En tant qu'auteur, je veux éteindre un type d'objet sans le supprimer, afin que la liste des sujets ne me propose que ce que mon jeu contient.
- **US-496** — En tant qu'auteur, je veux qu'un projet reçoive les types d'objets ajoutés après sa création, afin de ne pas rester privé de ce que le produit sait faire.

### Une recette se pose sur plusieurs images à la fois

- **US-497** — En tant qu'auteur, je veux poser une recette nommée sur plusieurs images d'un coup, afin de ne pas refaire trente fois le même réglage.
- **US-498** — En tant qu'auteur, je veux voir d'un coup d'œil les images qu'une pose de recette écraserait, afin de ne pas perdre une retouche faite à la main.

### Une carte de la toile se lit sans se battre avec un menu

- **US-499** — En tant qu'auteur, je veux cliquer une carte de la toile et lire son contenu dans une colonne, afin de ne plus dézoomer pour atteindre un menu qui sort de l'écran.

### Un jeu neuf dit qu'il y a des questions à répondre

- **US-500** — En tant qu'auteur, je veux que créer un jeu ouvre l'assistant, afin de savoir qu'il y a des questions à répondre avant de fabriquer.
- **US-501** — En tant qu'auteur, je veux que l'assistant sépare ce que je sais en commençant de ce que le produit décide bien tout seul, afin de ne pas être arrêté par onze questions dont neuf ont un bon défaut.

### Ce qui est revenu du modèle se voit, et se reprend à la main

- **US-502** — En tant qu'auteur, je veux voir la case telle qu'elle est revenue du modèle depuis la fiche de l'équipement, par une bascule à côté du vêtement découpé, afin de juger ce que j'ai payé au lieu de juger ce que l'atelier en a fait.
- **US-503** — En tant qu'auteur, je veux refaire à la main la superposition d'un vêtement sur son corps depuis la fiche du personnage, et garder les deux résultats côte à côte, afin qu'un calage automatique raté ne me laisse pas sans recours.
