# Asset Kitchen — PRD

> Écrit le 26 août 2026. Ce document fait foi sur **ce que doit faire le produit, du point de
> vue de l'usage**. Il ne dit rien de la construction : voir `docs/ARCHITECTURE.md`.

---

## Problème

L'auteur fabrique un jeu 2D seul. Il lui faut des assets qui appartiennent tous au même
univers — des personnages, des objets, des décors, des éléments d'interface qui ont l'air
d'avoir été dessinés par la même main.

Aucun des chemins disponibles ne lui donne ça. Les modèles installés sur sa machine ne
tiennent pas l'identité d'un sujet d'une image à la suivante, et mettent près de deux minutes
par image — assez pour que l'aller-retour cesse d'en être un. Les ateliers en ligne
généralistes lui vendent des crédits pour un univers qu'ils ne connaissent pas : à chaque
prompt il retape son style, et ce qui sort ressemble à ce qu'un autre aurait obtenu. Et sa
propre chaîne de production en lot fabrique de la quantité la nuit, quand ce dont il a besoin
c'est de fabriquer peu, bien, en regardant.

Trois frottements reviennent à chaque séance. Le style repart de zéro à chaque image, parce
que l'univers ne vit que dans sa tête et dans le prompt qu'il réécrit. La taille du pixel
dérive d'une génération à l'autre — deux images du même personnage n'ont plus la même grille,
et ne se montent donc pas ensemble. Enfin, l'agent qui l'aide à coder le jeu ne peut pas
fabriquer d'image : il faut sortir de l'éditeur, aller ailleurs, revenir avec un fichier.

Pourquoi maintenant : le doute qui bloquait tout est levé. Un banc de douze configurations a
montré qu'une famille de modèles tient réellement l'identité d'un sujet sur plusieurs
générations enchaînées, et qu'aucun des trois frottements n'est fatal — chacun se corrige
après coup, sans repayer, à condition que le produit s'en charge systématiquement.

## Solution

Un atelier personnel, qui tourne sur la machine de l'auteur et s'ouvre dans son navigateur.

On y définit **l'univers** d'un jeu une fois : des références rassemblées et triées, quelques
images promues au rang d'artwork officiel et rangées par famille, une bible en champs nommés,
une palette qui se déduit toute seule des artworks, une taille de pixel cible. Ensuite on
fabrique au cas par cas — un personnage, un tonneau, une icône — et chaque génération part
déjà habillée de cet univers, avec les seules références qui la concernent, sans qu'on ait
rien à retaper ni rien à sélectionner.

Ce qui sort est immédiatement retouchable sans repayer : recadrer, ramener sur la grille du
projet, ramener sur sa palette, détourer, découper une planche en sprites. L'image d'origine
est gardée intacte et les retouches sont une recette, qu'on rejoue, qu'on nomme, qu'on annule.
Changer la palette d'un projet la réapplique à tout ce qu'il contient sans un seul appel
payant.

Tout ce qui est produit reste dans une bibliothèque unique, rangée en projets et collections,
où l'on retrouve, réutilise et exporte. Et l'agent qui code le jeu dispose exactement des
mêmes gestes : il demande un asset, l'univers du projet s'applique, il reçoit un fichier — et
peut le déposer directement dans le dossier du jeu.

## Utilisateur cible

Une personne : l'auteur du jeu, qui est aussi l'auteur de cet outil. Il travaille seul, pour
lui, sur un écran large, en français. Il code son jeu avec l'aide d'un agent, dans une autre
fenêtre, et bascule vers l'atelier quand il lui manque une image.

Il sait ce qu'est un sprite, une grille de pixels, une palette indexée et un atlas. Il juge la
qualité à l'œil, mieux et plus vite qu'une machine ne le ferait, et il n'a aucune envie qu'on
la juge à sa place. Il paie ses images à l'appel et regarde ce que ça coûte, sans vouloir d'un
système de crédits.

Sa séance type dure une demi-heure : il ouvre l'atelier avec une image en tête, écrit, lance
trois ou quatre variations, en garde une, la retouche, la range, et retourne coder. Il ne veut
ni tunnel de configuration, ni assistant, ni écran à traverser avant d'écrire son prompt.

## User Stories

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

### Retoucher

- **US-59** — En tant qu'auteur, je veux recadrer, redimensionner, pixelliser sur grille, ramener sur la palette et nettoyer les bords, avec des réglages qui répondent instantanément.
- **US-60** — En tant qu'auteur, je veux fixer une taille de pixel cible pour mon projet et qu'elle soit imposée à tout ce qui rentre, afin que deux assets du même lot partagent la même grille.
- **US-61** — En tant qu'auteur, je veux que la grille soit ramenée à cette cible systématiquement, y compris quand le modèle a rendu une grille cinq fois plus grosse, afin que la dérive soit traitée comme le cas normal et non comme un incident.
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

## Critères de succès

- Depuis une installation neuve, la première image est obtenue sans traverser d'autre écran que celui de la clé.
- Un projet neuf se crée, reçoit une bible et trois planches, et sa palette est extraite.
- Un asset se génère, se détoure, se ramène sur la grille et la palette du projet, et se range tout seul.
- Un personnage et un petit objet générés dans le même projet sortent avec la même taille de pixel, quelle que soit la grille rendue par le modèle.
- Un artwork officiel de la famille personnages ne part pas en référence lors de la génération d'un décor ; une planche marquée « tous » part avec toutes les générations.
- Une planche de huit sprites se découpe en huit assets, et la filiation de chacun est visible.
- Une sélection s'exporte en une archive accompagnée de son descriptif.
- Sur quatre variations dont deux échouent : deux images entrent en bibliothèque, deux emplacements portent une raison lisible et un bouton relancer, et aucun échec n'apparaît dans la grille.
- L'application est arrêtée pendant une génération : au redémarrage, la génération est marquée interrompue, son coût est lisible, et aucune relance n'a eu lieu.
- L'onglet est fermé pendant une génération : l'image est en bibliothèque à la réouverture.
- La suppression d'un asset qui a huit enfants laisse les huit en place, chacun marqué « parent supprimé ».
- Un asset dont la recette a été modifiée à la main n'est pas touché par un changement de palette du projet, et le nombre d'assets remis à jour et conservés est affiché.
- Le réseau est coupé : la bibliothèque, la retouche, le détourage, la découpe et l'export fonctionnent, et le catalogue affiche sa date.
- L'agent, branché sur l'atelier, génère un asset dans le bon projet sans aucune intervention.
- L'agent atteint le plafond : il reçoit un message qui nomme le plafond et le moyen de le relever, et aucune invite n'apparaît à l'écran.
- L'agent nomme un projet inexistant : il reçoit la liste des projets existants, et aucun projet n'a été créé.
- Coller une adresse d'image fait apparaître une carte en moins d'une seconde, avant que l'image ne soit récupérée.
- Le coût réel de chaque génération est enregistré et totalisé par projet, et le nombre de références envoyées est visible.
- Le tout tourne sans aucun modèle local et sans mobiliser de carte graphique.

## Hors périmètre

**Écarté par nature du produit.** Comptes, crédits, paiement, multi-utilisateur, distribution, galerie publique, partage, presets communautaires. Pack d'assets par genre — fabriquer de la quantité est le métier d'un autre outil. Compteur de crédits maison : le suivi des coûts se lit chez le fournisseur.

**Écarté parce que l'auteur fait mieux.** Contrôle de conformité automatique. Description automatique du style. Routeur d'intention qui devinerait le type d'asset.

**Écarté par coût de construction disproportionné.** Extraction de composants d'interface et éditeur de découpe en neuf zones. Paquets prêts à importer dans un moteur — entre l'archive et le paquet il n'y a que du glisser-déposer. Modèles locaux à l'intérieur de l'application : ils restent dehors, on importe leur résultat.

**Écarté de la V1, prévu ensuite.** Génération autre que pixel art. Tuiles qui se raccordent. Personnage et ses poses préparées. Animation de sprites. Son.

**Écarté par choix d'ergonomie.** Mobile et tablette : écran large uniquement, aucun point de rupture, aucun menu escamoté, aucune mise en page de repli. Corbeille : suppression avec annulation courte. Écran séparé pour la bibliothèque : une seule grille dans tout le produit. Détourage par couleur.

**Revenu dans le périmètre — 27 août 2026.** « Toile libre dans le tableau d'inspiration : grille seulement » était écarté ici, au même titre que le reste, jusqu'à ce qu'une séance d'essai sur le produit tenu montre l'inverse : la grille montre tout d'un coup d'œil et ne permet d'organiser rien, et le champ `groupe` — une étiquette qui n'a aucune forme à l'écran — n'y suffit pas. La toile s'ajoute donc à la grille **sans la remplacer**, et devient les tranches T8 et T9 du plan. Ce qu'elle n'est pas, en revanche, reste écarté : dessin à main levée, formes et flèches libres, plusieurs toiles par projet, export de la toile en image, liens entre cartes de projets différents, alignement et distribution automatiques, et couleur choisie librement — six teintes fermées, et rien au-delà.

**Écarté par les décisions de ce document.** Sas d'acceptation avant l'entrée en bibliothèque. Suppression en cascade. Refus de supprimer tant qu'il existe une descendance. Création implicite d'un projet par l'agent. Assistant de premier lancement. Invite d'autorisation qui bloquerait l'agent en attendant l'auteur. Liste de modèles écrite en dur. Relance automatique après interruption. Réapplication forcée de la palette sur les recettes réglées à la main. Enchaînement d'outils fins que l'agent devrait composer lui-même. Passe de retouche qui monopoliserait la carte graphique.

**Écarté sur les références.** Sélection manuelle des artworks à envoyer, génération par génération : c'est l'application qui choisit, sur la famille. Obligation que l'artwork officiel soit une planche non figurative : trop contraignant, l'auteur travaille justement à partir de visuels trouvés. Déduction de la taille de pixel depuis l'image reçue : elle est imposée par le projet, jamais devinée.

## Décisions d'implémentation

**Ce qui entre en bibliothèque.** Tout ce qui est produit y entre de lui-même, rangé dans le projet courant. Juger, c'est marquer favori ou supprimer — jamais accepter. Ce qui est jugé l'est avant de partir dans le jeu, pas avant d'entrer dans la bibliothèque.

**L'échec.** Il s'affiche à l'emplacement qui attendait l'image, avec sa raison en clair et un bouton relancer qui rejoue le même prompt. Sur un lot, chaque emplacement est indépendant : les réussites arrivent, les ratés se relancent un par un. Aucun échec n'entre dans la grille. L'appel raté et son coût réel restent lisibles dans le journal du projet.

**Le premier lancement.** L'application ouvre l'Atelier, prompt actif, sur un projet « Bac à sable » préexistant. Aucun projet, aucune bible, aucun artwork n'est exigé : un univers non renseigné ne contraint simplement rien, et les défauts du produit prennent le relais. Seule la clé du fournisseur est un préalable dur, matérialisé par un bouton générer inactif portant sa raison et le lien vers son réglage.

**La suppression.** Jamais de cascade. Les enfants survivent au parent et affichent « parent supprimé ». Supprimer un projet demande confirmation avec le nombre d'assets concernés, et ces assets sont détachés, pas détruits. Annulation courte après chaque suppression, puis c'est définitif.

**Les artworks officiels sont groupés par famille.** Une carte porte une famille en plus de son groupe : personnages, objets, décors, interface, ou « tous » pour une planche de style non figurative. À la génération, seuls les artworks de la famille du sujet partent en référence, plus ceux marqués « tous ». C'est l'application qui choisit, pas l'auteur : promouvoir reste un geste unique. Le nombre de références effectivement envoyées est visible au moment de générer.

**La taille de pixel est une propriété du projet, imposée à tout ce qui rentre.** Elle n'est jamais déduite de l'image reçue. La remise sur grille est systématique et non optionnelle : un asset dont la grille a dérivé est le cas normal, pas l'incident.

**La palette rétroactive.** Toucher une recette à la main épingle l'asset. Un changement de palette du projet saute les épinglés et rend son compte : « 12 assets remis à jour, 3 conservés tels quels ». Un épinglé se réaligne d'un geste depuis sa fiche.

**Ce qui est indisponible est grisé avec sa raison**, jamais proposé puis refusé. Cela vaut pour un modèle qui ne peut pas honorer la demande, pour la quantification tant qu'aucune palette n'existe, pour l'export d'une sélection vide, et pour le bouton générer sans clé. Un modèle déjà choisi qui devient invalide reste choisi : aucune substitution silencieuse.

**La génération vit côté serveur.** Elle survit à la fermeture de l'onglet et au changement d'écran ; son résultat entre en bibliothèque quoi qu'il arrive. À la réouverture, ce qui tourne encore est réaffiché avec son avancement. Une génération coupée par un redémarrage est marquée interrompue, garde son coût, et se relance d'un geste — jamais toute seule.

**Le fournisseur absent.** Le dernier catalogue reçu sert de repli, daté en clair à l'écran. Tout ce qui ne demande pas le réseau fonctionne normalement. La génération échoue au moment où on l'essaie, pas au démarrage.

**Ce qui entre par la main.** Le collage devine et le dit : une image devient une carte image, une adresse crée immédiatement une carte en attente dont l'image arrive ensuite — et qui garde son adresse et sa raison si elle n'arrive pas —, un texte devient une carte texte. Un fichier qui n'est pas une image est refusé nommément. Un doublon est signalé avec un lien vers l'existant, et reste importable.

**L'agent ne bloque jamais l'auteur, et l'auteur ne bloque jamais l'agent.** Aucune invite d'autorisation : au plafond, l'agent reçoit un refus qui nomme le plafond et le moyen de le relever. Un projet inconnu est refusé avec la liste des projets existants ; sans projet nommé, c'est le projet ouvert dans l'atelier qui reçoit. Côté disque, un dossier manquant est créé, un fichier existant n'est jamais écrasé, un dossier non inscriptible est un refus qui donne le chemin. Côté atelier, un compteur discret montre la consommation de l'agent et ses assets apparaissent en direct dans la grille, marqués de leur provenance. Les garde-fous sont relus à chaque appel : les changer ne demande aucun redémarrage.

**Une seule grille d'assets dans tout le produit** — mêmes filtres, même recherche, même sélection multiple. Organiser n'oblige jamais à quitter l'endroit où l'on crée.

**La fiche asset est un panneau latéral**, jamais une page : la fermer remet exactement où l'on était.

**Écran large uniquement.** Les trois panneaux et la grille cohabitent d'emblée. Les panneaux se replient par choix, pour voir la grille en grand, jamais par contrainte de place.

**La retouche est non destructive.** L'image d'origine est conservée, les retouches sont une recette rejouable, annulable, nommable. Revenir à l'image brute est un geste unique.

**Le modèle est un défaut par type d'asset**, porté par l'univers du projet, pas un réglage global.

**Le coût réel de chaque génération est enregistré** — celui que le fournisseur facture, jamais celui qu'il affiche au catalogue — et totalisé par projet.

**Les dimensions mesurées font foi**, jamais celles demandées.

## Notes complémentaires

- **La maquette de l'écran Atelier est à refaire.** Le brouillon existant a été jugé trop chargé et trop loin de la fluidité recherchée. Il reste sur disque mais ne sert pas de base : l'interface doit partir du geste quotidien — écrire, générer, juger, garder — et non de la liste des décisions ci-dessus. Un réglage n'est à l'écran que si on y touche à chaque génération.
- **La recette d'animation reste le risque ouvert.** Une piste sérieuse a été observée le 26 août 2026 mais demande un prototypage avant tout engagement. Rien dans ce document ne doit la présupposer.
- **Le coût d'une génération croît avec le nombre de références chez certains fournisseurs et pas chez d'autres.** Le regroupement par famille limite l'envoi, mais un univers riche renchérit quand même, et peut inverser le classement des modèles par coût. À surveiller dès les premières séances réelles.
- **Les familles d'artworks sont pressenties, pas figées** : personnages, objets, décors, interface, tous. Une famille manquante se découvrira à l'usage.
- **Deux documents sont à corriger dans la foulée de celui-ci.** `AGENTS.md` et `docs/ARCHITECTURE.md` §1 portent encore « jugée avant d'entrer dans la bibliothèque » ; ce PRD tranche l'inverse et fait foi sur l'usage.
- **Le nom « la toile » n'est pas figé.** Le produit nomme tout en français — l'Atelier, le tableau, la réserve, la fiche, le barème — et « la toile » a été retenu faute de mieux à la séance de cadrage du 27 août 2026. « Plan de travail » ou « établi » diraient autre chose. Le jour où l'un des deux s'impose, il se change partout d'un coup, ce document compris.
- **Dépendance externe unique** : un fournisseur d'images en ligne et sa clé. Tout le reste — retouche, détourage, découpe, rangement, export — tourne sur la machine, sans réseau.
