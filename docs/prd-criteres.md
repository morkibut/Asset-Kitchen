# PRD — les critères de succès

> Descendu de `docs/PRD.md` le 6 septembre 2026, **sans qu'un mot change**. La section pesait
> **28 %** du document, et le corpus de démarrage 596 Ko.
>
> Le PRD fait toujours foi sur ce que le produit doit faire ; ce fichier dit **à quoi chaque
> promesse se mesure**. On l'ouvre quand on écrit un critère d'acceptation qui doit s'y
> raccrocher — jamais au démarrage d'une séance.

## Critères de succès

- Depuis une installation neuve, la première image est obtenue sans traverser d'autre écran que l'assistant, qu'on peut quitter à toute étape : le nombre d'écrans obligatoires est zéro.
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
- Ce que chaque génération a réellement consommé est enregistré **dans l'unité de son fournisseur**, l'argent est totalisé par projet, et le nombre de références envoyées est visible.
- Un appel qui ne coûte rien dit **gratuit**, jamais « 0,00 $ » — et ce qu'il a consommé se lit à côté du mot.
- Le tout tourne sans aucun modèle local et sans mobiliser de carte graphique.

**Le personnage et son équipement**

- Un projet neuf porte un plan de poses utilisable sans qu'aucune ligne n'ait été écrite.
- Un personnage créé, décrit et rattaché à six poses affiche six cases vides ; une pose générée en remplit une, et les cinq autres restent visiblement vides.
- Neuf poses sélectionnées et lancées ensemble donnent neuf images de corps distinctes après un seul appel payant, et le journal du projet montre un appel et non neuf.
- Un lot qui revient avec huit images pour neuf demandées est refusé, aucune image n'entre dans le plan, et le lot se relance d'un geste.
- Une pose ratée à l'intérieur d'un lot accepté se régénère seule, sans toucher aux huit autres.
- Un lot interrompu par la fermeture de l'application se reprend au redémarrage sans repayer les images déjà reçues.
- Deux poses trop semblables dans un même lot sont signalées à l'auteur ; le lot n'est pas refusé et les images entrent.
- Un casque posé sur six poses d'un personnage donne six calques distincts, un par pose, après **un seul** appel payant, et le journal du projet montre un appel et non six.
- Chacun de ces six calques s'affiche superposé au corps de **sa** pose, et le corps d'origine de chaque pose est retrouvé octet pour octet.
- Une planche d'équipement où figurerait une pose sans corps est impossible à lancer : la pose est visiblement inéligible et porte sa raison.
- Une pièce déclarée « qui agrandit la silhouette », revenue à une échelle différente de celle envoyée, ne produit aucun calque : la dérive est nommée à l'écran et ce qui revient est proposé à garder comme corps habillés.
- La zone d'un calque déjà fabriqué se déplace et se retaille, le calque se recalcule, et le journal du projet ne bouge pas d'un centime.
- Les mesures d'un calque s'affichent toutes, et aucune ne rend un calque impossible à garder.
- Le modèle par défaut pour produire une planche et celui pour éditer un corps se règlent séparément, et l'auteur n'a pas à les choisir à chaque génération.
- Un personnage complet s'exporte dans le dossier du jeu avec un descriptif qui nomme chaque fichier, sa pose et sa pièce.
- L'agent, branché sur l'atelier, ajoute une pose au plan d'un personnage existant et la génère sans que l'écran soit ouvert.
- La fiche de n'importe quel asset nomme le modèle qui l'a produit.

**Les trois lieux, et ce que le jeu réclame**

- La barre du haut porte trois onglets et rien d'autre du travail ; toute profondeur se lit dans le fil qui dit où l'on est, et chacun de ses segments ramène.
- L'argent ne part que de deux endroits — l'établi d'une chose et le codex —, et la même barre de saisie les sert tous les deux ; la galerie n'en a aucune et le dit dans son pied.
- Écrire un nom dans le codex fait entrer la chose sur-le-champ et ouvre son établi ; aucun formulaire ne s'intercale, et rien n'est payé en nommant.
- Un jeu déclare une fois comment il regarde le monde, et l'atelier en tire la liste des directions ; le texte qui part et le nombre d'images à fabriquer sont remplis par ce seul choix et ne peuvent plus se contredire.
- Une chose du jeu affiche ce qui lui manque en cases, jamais un total de ce qu'elle tient ; le compte de ce qu'elle a rangé est écrit à côté, de sorte qu'une jauge pleine obtenue en rangeant se lise comme telle.
- Les quatre directions manquantes d'une pose partent sur une seule planche et reviennent en quatre images séparées, chacune sachant déjà dans quelle case elle se range.
- Un écran de confirmation paraît entre le bouton et la dépense : chaque texte et chaque image qui partira y tient une ligne avec son interrupteur, et le prix de chaque image jointe est écrit sur la ligne où on la coche.
- Une correction faite avant de payer vaut pour cet appel seulement ; le prochain appel repart des réglages, et garder la correction est un second geste écrit.
- Une image se retouche en la voyant en grand : les huit places de la recette et les deux fabriques s'ouvrent depuis la même barre, et aucune ne coûte un centime — l'écran le dit avant qu'on ait lu.
- Toutes les poses d'une chose se regardent empilées à la même échelle, et celle qui sort plus petite que ses sœurs se corrige sans repayer.
- Une image finie se juge sur le fond que le jeu décrit, à une taille qui est un multiple entier de la sienne, jamais interpolée.
- Tous les appels payés se lisent dans une seule liste, du plus récent au plus ancien, avec ce que chacun a coûté et ce qu'il a donné ; une image supprimée fait changer l'état de son appel, jamais disparaître sa ligne.
- Sur une machine neuve, l'assistant s'ouvre à l'étape 1 ; on en sort où l'on veut et on tombe dans le codex vide, le champ qui nomme allumé.

**Les cinq capacités que l'usage a réclamées**

- Une place de la recette s'éteint depuis la barre sans qu'on l'ouvre ; l'image se refait sans elle, et la rallumer rend les réglages d'avant à l'identique.
- Deux images traitées par la même recette, l'une avec une place en veille et l'autre sans cette place du tout, sortent identiques au pixel près.
- Les réglages d'une image se posent sur une autre en deux gestes, et le collage nomme ce qu'il a posé et ce qu'il n'a pas pu poser.
- Une recette enregistrée sous un nom se retrouve après la fermeture de l'atelier, s'applique à une image d'un autre jeu, et deux images qui l'ont reçue sortent identiques au pixel près.
- Un cadre tracé, un point de pipette, une forme entourée et un passage de la main ne se retrouvent jamais sur une autre image, ni par collage ni par recette nommée.
- La fiche d'une image montre le texte entier qui est parti la fabriquer ; une image importée dit qu'elle n'en a pas, et une découpe de planche nomme sa planche et y mène au lieu d'afficher un texte qui n'a pas été écrit pour elle.
- Une forme tracée grossièrement autour d'un sujet rend un contour posé sur le bord du sujet à l'intérieur de cette forme, rien n'est touché au-dehors, et le même tracé rend deux fois le même résultat.
- Le sujet ainsi détouré est cadré et calé dans sa case comme n'importe quel autre : le recadrage et la mise sur grille travaillent après lui, sur une image dont le fond est déjà parti.
- Le moteur d'une passe de détourage se choisit dans une liste ; un moteur absent est grisé avec sa raison, et une recette qui le nomme le dit sans casser le rendu des autres passes.
- Le moteur lourd annonce sa lenteur avant de partir, annonce une seule fois ce qu'il doit rapatrier et combien ça pèse, et le relevé qui le dit meilleur existe — les durées des deux moteurs, et ce qu'ils rendent côte à côte.

**Les tables cessent d'être à refaire**

- Le réglage de départ d'une image seule et celui d'une planche se règlent séparément ; une famille de l'univers peut porter le sien, et sans quoi elle hérite de celui de sa nature.
- L'auteur voit quel réglage de départ va s'appliquer, et d'où il vient, avant de générer.
- Un réglage de départ modifié ne touche à aucune image déjà faite, et une recette écrite avant ce changement rend exactement ce qu'elle rendait.
- Après cette livraison, le nombre de recettes du dépôt qui s'écartent encore de leur réglage de départ est compté et écrit — il était de plus d'une sur deux.
- La vraie taille de bloc d'une image est retrouvée sur un lot d'images du dépôt, le taux de réussite est mesuré et écrit, et l'auteur peut l'imposer à la main quand la détection renonce — laquelle dit qu'elle renonce.
- Deux images réduites, l'une par l'ancienne méthode et l'autre par la nouvelle, sont comparées côte à côte, et le résultat est écrit.
- Un aplat reste un aplat : la réduction n'invente aucune couleur qui ne soit dans l'image d'origine, et la palette du jeu s'applique après la réduction, jamais avant.
- Le fond sur lequel le modèle pose le sujet se voit, se choisit et s'enregistre dans les réglages du jeu ; il se corrige à la main avant de payer, pour cet appel seulement.
- L'atelier propose une couleur de fond sûre depuis la palette du jeu ; quand aucune ne l'est, il le dit et laisse le fond en place — il ne choisit jamais en silence.
- Deux mesures s'affichent sur une image revenue — les pixels de bord, et ceux encore collés à la couleur de fond —, de sorte qu'un fond mal choisi se voie sur les images qu'on voulait de toute façon, sans séance d'essais dédiée.
- La phrase qui interdit au modèle d'employer la couleur de fond dans le sujet, les reflets, les accessoires et les ombres part avec la demande, et se relit dans la génération enregistrée.
- Un jeu qui n'a pas encore de palette se comporte exactement comme avant.
- Un moteur de détourage entraîné sur du dessin est essayé et comparé aux trois actuels sur des images du jeu, et le résultat est écrit.
- Le contour tracé sur une image réduite tombe sur le bord du sujet et non entre deux couleurs, et le même réglage rend deux fois le même trait.

**L'animation, par la vidéo**

*Recadré le 3 septembre 2026 : l'animation s'obtient en animant puis en découpant, jamais en
demandant une planche. Ce que la planche et son dépliage deviennent est plus bas, sous leur
propre titre.*

- Un mouvement nommé porte son texte, sa cadence et les directions où il a un sens ; **une pose du plan dont l'identifiant correspond à un mouvement connu hérite de son texte animé**, et deux clips du même mouvement partent avec exactement le même texte.
- Un clip se commande depuis un personnage, avec son mouvement et son modèle ; **l'image de départ se propose et se change** — la case visée si elle porte une image, le portrait sinon, n'importe quelle image de la bibliothèque d'un clic.
- Le prix annoncé avant l'envoi porte sa formule ; le montant enregistré est celui de la réponse du fournisseur, et il dit s'il a été **relu ou estimé**.
- Un clip payé garde sa dépense même si son fichier est illisible, si l'extraction échoue, ou si l'atelier se ferme pendant l'attente ; le récupérer est un geste que l'auteur demande, jamais un rappel automatique.
- Plusieurs clips se lancent en un geste, le prix du lot est annoncé avant, ils reviennent **un par un** et se regardent bouger dès leur arrivée ; le journal garde ce qui a été payé, clips jetés compris.
- Un clip s'ouvre en tournant déjà en boucle, et montre côte à côte, sur un seul métronome, les images brutes du modèle et la bande passée par la chaîne du jeu.
- **Chaque image du clip se prend ou se laisse d'un clic**, et la bande n'est jamais forcée à des images régulièrement espacées ; les images retenues se voient dans l'ordre et se retirent de là.
- Plusieurs bandes se gardent depuis le même clip, chacune nommée et affectée à une case du plan de poses ; le prix par bande s'affiche et **baisse à chaque bande gardée**.
- Les images d'une bande partagent une seule fenêtre, **prise sur le clip entier** : un personnage ne change pas de taille en passant du repos à la marche, et le cadrage se reprend à la main quand l'automatique tombe mal.
- La recette du découpage se règle depuis l'écran de montage, elle **part de celle du jeu**, et tout écart avec le jeu est écrit en clair. Rien sur cet écran ne dépense, et une phrase le dit.
- Un clip se fabrique **sur la carte graphique de la maison**, dans la même liste et avec le même geste que les modèles payants ; son coût affiché est **une attente, pas un prix**, et l'écran dit si le modèle est encore à charger.
- **Un clip local enregistre une dépense de zéro, et zéro n'est pas « inconnu »** ; l'écran annonce le nombre d'images réel que le moteur rendra, recommande la durée courte, et distingue trois absences — moteur éteint, modèles à télécharger, greffon manquant.
- Le produit **ne modifie jamais l'installation de ComfyUI**, et un clip local suit exactement le même chemin qu'un clip payé une fois revenu.
- La matrice d'un personnage se lit **sur deux calques** — images fixes, animations —, chacun avec sa jauge ; une case animée dit de quel clip elle vient, et commander le clip d'une case vide se fait depuis cette case.
- **Une image du clip se met de côté sans quitter l'écran de montage** : elle entre en bibliothèque avec sa filiation, passe par la chaîne du jeu, et se range ensuite dans une case ou sur un objet en un second geste facultatif.
- Une bande sort en planche de sprites avec un descriptif écrit dans un format existant, et en image animée lisible sans moteur de jeu ; la cadence réglée à l'écran est celle qui part, et ce qui sort est exactement ce que l'aperçu montrait.
- La stabilité d'une bande est mesurée et le chiffre s'affiche à côté de l'aperçu ; la palette d'une bande est calculée une fois pour la bande, jamais par image.
- L'image précédente s'affiche en transparence sous celle qu'on corrige, une image se déplace au pixel, se remplace par une autre — du même clip ou d'un autre —, et la bande dit de quel clip vient chaque image.
- Rien n'est jamais relancé automatiquement, et tout ce qui ne commande pas fonctionne réseau coupé.

**Le dépliage, qui divise le prix de tout le reste**

*Sorti de l'animation le 3 septembre 2026 : il ne sert pas à animer, il sert à payer un appel au
lieu de huit, pour les poses fixes comme pour les objets et les décors.*

- Une planche générée apparaît dans la galerie avec sa génération, son coût et sa géométrie ; la déplier ne coûte aucun appel et fonctionne réseau coupé.
- Une planche qui revient bien est découpée toute seule et ne demande **aucun geste de plus qu'aujourd'hui** — ni avant, ni après.
- Refaire un découpage est un geste que l'auteur demande ; il repart des coupes proposées, et chaque coupe se déplace, s'ajoute et se retire avant de valider.
- Une planche se déplie plusieurs fois, les dépliages coexistent, chaque image dit de quel dépliage elle vient, et supprimer un dépliage n'emporte ni la planche ni les autres.
- **La géométrie s'écrit sur le pliage** au lieu d'être déduite du nombre de cases, sans quoi changer la formule redécouperait les planches anciennes de travers.
- Une planche qui rend neuf sujets pour huit demandés entre quand même, avec le choix de la case à écarter ; une planche qui n'en rend que sept reste refusée.
- Une planche dont le modèle a redessiné le quadrillage est signalée en toutes lettres, jamais acceptée en silence.
- Une planche peut porter **plusieurs choses différentes du jeu** dès lors que la demande dit d'avance ce que chaque case contient ; une case dont le sujet n'est pas celui annoncé se signale au lieu de se ranger de travers, et le prix par sujet s'affiche à côté du prix de la planche.

