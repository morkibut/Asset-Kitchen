# Plan — atelier unifié, de la demande de l'agent au jeu Godot

> PRD source : [PRD.md](PRD.md), US-519 à US-544. Ordre actif annoncé dans [PLAN.md](PLAN.md).
> Branche : `codex/atelier-unifie`, issue de la refonte existante.
> Les objectifs desktop, animation prioritaire, moteurs locaux, asset3d et MCP pour l'agent
> Godot ont été explicitement demandés. Le découpage ci-dessous est proposé en autonomie ;
> les critères non cochés ne sont pas des fonctionnalités livrées.
>
> Affectation : [PLAN-atelier-unifie-affectation.md](PLAN-atelier-unifie-affectation.md).

## Décisions architecturales

- Les API et le MCP sont deux façades des mêmes services. Les contrats existants restent
  compatibles ; les nouvelles capacités ne sont pas codées uniquement dans une façade.
- Le parcours manuel de création est complet, sans client MCP ni configuration d'agent.
  La maquette complète est validée ; les capacités existantes inventoriées restent requises.
- Les concepts durables sont sujet, objectif, source, résultat, travail et livraison.
  Les formes de données et les frontières sont définies dans
  [l'architecture de l'atelier unifié](archi-atelier-unifie.md).
- Le projet Godot est associé explicitement. Les demandes agentiques sont bornées par son
  cadre de délégation ; le jeu livré fonctionne sans l'atelier.
- Le design papier reste la référence. Les maquettes peuvent changer d'organisation ;
  leur conformité visuelle ne remplace pas la réussite d'un parcours.
- Pas de réécriture générale : réutiliser génération, montage, recettes, exports et MCP.
  Les résultats anciens restent ouvrables. Chaque écran remplacé doit nommer les capacités
  qu'il reprend et fermer l'ancienne porte une fois celles-ci reprises.
- Les équipements complets sont requis : une pièce commune, des emplois par personnage,
  des calques ciblés et des tenues composées. La précision de l'auteur annule le report
  envisagé à 22 h 56. Leur préparation UX couvre le parcours entier ; AU15 à AU17 portent
  son implémentation, sans renuméroter ni déclarer livrées les tranches précédentes.

## Les six jalons lisibles

**Préparation UX, avant de modifier les écrans du produit.** L'auteur essaie une maquette
interactive des parcours, puis ses remarques précisent le contenu des tranches concernées.
La [maquette de l'atelier](maquettes-atelier-unifie/02-atelier.html) et son
[inventaire de couverture](maquettes-atelier-unifie/couverture.md) distinguent les gestes
testables, les traitements simulés et les outils encore à détailler. Ce travail de conception
ne compte pas comme une tranche AU livrée ; l'état de cette préparation vit dans PLAN.md.

Critères de passage à l'implémentation des écrans concernés :

- [x] L'auteur a essayé le parcours manuel personnage → animation → livraison et noté ses frictions.
- [x] Toile et retouche ont été essayées avec modification, fermeture et réouverture.
- [x] L'auteur peut essayer un équipement depuis sa pièce et son emploi jusqu'aux calques
  de poses, directions et frames, puis combiner plusieurs équipements ; un simple inventaire
  de préparations sans extraction, placement ni composition ne couvre pas ce parcours.
- [ ] Chaque écran à remplacer possède un inventaire des fonctions actuelles reprises ; les
  détails manquants de la maquette sont complétés avant de fermer sa porte actuelle.
- [ ] Les arbitrages de comportement sont reportés dans le PRD, ceux d'apparence dans le
  design, et les impacts de séquencement dans le plan, sans recopier les mêmes décisions.

La preuve technique AU1 reste le premier développement ; elle peut éclairer la maquette
de livraison. Les générations simulées ne constituent jamais une preuve d'intégration.

**Validation d'ensemble de l'auteur le 12 septembre 2026.** La maquette est approuvée pour
implémentation complète. Les inventaires de capacités et les preuves de production restent
obligatoires avant retrait des accès existants ; la validation du dessin ne les remplace pas.

**Consolidation UX autorisée le 12 septembre.** La [revue comparative](revue-ux-complete-2026-09-12.md)
alimente cette préparation, sans ouvrir de seconde file de production. Les trois premiers
parcours se travaillent en parallèle : reprendre une retouche dans un espace compact,
retrouver et ranger un résultat dans une bibliothèque chargée, préparer une fabrication
avec sa référence et son envoi relu. Leur raccord précède la vérification animée des
équipements, les liens de la toile vers l'envoi et la relecture des livraisons simulées.

Critères de consolidation, à éprouver dans le prototype avant leur raccord au produit :

- [x] Le brouillon et le contexte de retouche se retrouvent après fermeture, sans modifier l'original.
- [x] Image, contrôles de vue et timeline restent utilisables ensemble dans une fenêtre desktop.
- [x] Recherche, filtres, collections et regroupement des dérivés restent lisibles avec un catalogue chargé.
- [x] Les trois entrées de fabrication partagent la relecture, conservent les paramètres et annoncent leur portée.
- [x] Un équipement se vérifie en mouvement ; les bases absentes et les calques à revoir ne se disent pas prêts.
- [x] Les références choisies dans la toile se relisent avant l'envoi ; les notes libres restent hors de la demande.
- [x] Travaux et consommations ont les mêmes comptes ; la livraison montre les révisions et les fichiers prévus.

Les [parcours vérifiés](releves/2026-09-12-consolidation-prototype.md) distinguent les
gestes essayés de leurs limites. Ces cases concernent la simulation interactive ; elles
ne ferment aucun critère de fidélité Godot, de génération réelle ou de stockage du produit.

1. **Une animation existante arrive dans Godot via l'agent** — AU1.
2. **L'auteur ou l'agent crée un personnage animé, avec les outils de correction complets** — AU2 à AU5.
3. **Les équipements adaptés aux héros se combinent sans nouvelle génération** — AU15 à AU17.
4. **Les fabrications locales s'enchaînent sans perdre le travail** — AU6 à AU8.
5. **Une source 3D produit plusieurs animations et angles** — AU9 à AU11.
6. **Le même atelier couvre les autres assets, puis tuiles et son** — AU12 à AU14.

**Complément de maquette demandé le 12 septembre : sources vidéo et 3D.** Il prolonge
US-521, US-522, US-526 et US-528, sans remplacer les preuves de production AU8 à AU11.

- [x] La fabrication vidéo produit un clip source ; plage, échantillonnage, cadre et
  pivot sont relus avant de créer la bande liée au personnage, mouvement et direction.
- [x] La source 3D expose référence et consigne, modèle, squelette, mouvements, caméra,
  style et rendus ; chaque étape conserve ses réglages après réouverture.
- [x] La disponibilité du modèle ne signifie pas que son rig ou ses animations sont prêts.
  Corriger une étape indique ce qui est à vérifier sans effacer les résultats antérieurs.
- [x] L'aperçu réagit à la caméra, au mouvement et au style ; ses limites de simulation
  sont explicites. Les frames produites rejoignent la retouche et la livraison communes.

Preuves et limites : [essai des sources vidéo et 3D](releves/2026-09-12-sources-video-3d.md).
Ces coches valident le parcours du prototype, sans clore AU8 à AU11.

Ordre conseillé : AU1 → AU2 → AU3 → AU4 → AU5 → AU15 → AU16 → AU17 → AU6 → AU7 → AU8
→ AU9 → AU10 → AU11 → AU12 → AU13 → AU14. Les dépendances réelles sont indiquées par tranche.
Les tuiles et le son restent en deuxième temps, conformément à la demande.

## AU1 · Une animation existante arrive dans Godot

**User stories** : US-525, US-531, US-533. **Bloquée par** : aucune.

### Ce qu'on livre

Depuis un jeu explicitement associé, l'agent trouve une bande existante, l'exporte et obtient
de quoi la jouer dans une scène Godot. L'interface montre la même sélection et sa livraison.
C'est une première preuve gratuite du trajet complet, avant d'y brancher la génération.

### Critères d'acceptation

- [x] Une demande MCP retrouve et exporte une animation existante sans appel fournisseur.
- [x] Le résultat renvoie les fichiers, leurs rôles et les paramètres nécessaires ; Godot
  joue la bande avec le bon ordre, la cadence, la boucle et le pivot.
- [x] Relancer l'export ne remplace aucun fichier inconnu ; un dossier invalide est expliqué.
- [x] Une scène de démonstration s'ouvre réellement dans Godot ; son absence sur la machine
  est un contrôle non effectué, jamais une réussite déduite du manifeste.

## AU2 · Le personnage porte les animations utiles au jeu

**User stories** : US-519 à US-521, US-523, US-534, US-535. **Bloquée par** : AU1.

### Ce qu'on livre

L'auteur ou l'agent définit l'objectif du personnage : fixes, animé ou les deux. Il choisit
les mouvements et directions utiles, importe une référence et voit ce qui reste à produire.

### Critères d'acceptation

- [x] Une marche dans une direction peut être le seul objectif ; aucune pose fixe n'est exigée.
- [x] Une référence ne remplit pas une animation ; « non demandé » ne compte pas comme manquant.
- [x] UI et MCP lisent le même objectif et la même couverture, même après redémarrage.
- [x] Un ancien personnage rouvre son plan, ses images, bandes et équipements sans perte.
- [x] L'univers garde un accès direct à sa toile existante : images, textes, notes, îlots
  et liens ; modifier une composition puis la rouvrir retrouve son contenu et sa disposition.
- [x] Créer un sujet et lui donner un objectif depuis l'interface ne demande aucun agent.
- [x] Les animations se parcourent par mouvement puis direction, comme des dossiers ;
  les vignettes séparent versions retenues, à juger et écartées. Le survol joue toute la
  bande centrée. La galerie conserve les filtres mouvement, direction et jugement.
- [x] Les équipements associés montrent un aperçu identifiable.
- [x] Les familles et collections existantes restent accessibles dans la navigation ;
  rechercher, ranger une sélection et rouvrir une collection conserve son contenu (US-538).
- [x] Créer un équipement depuis le personnage conserve ce lien et propose sa référence
  dans l'envoi ; les variantes et le retour au personnage restent accessibles (US-537).
  L'accès existant reste disponible jusqu'à la reprise complète de ce parcours en AU15–AU17.
- [x] La galerie distingue les résultats des fiches d'assets : filtres par média et
  rattachement, ouverture et réutilisation sur la toile sans nouvelle fabrication (US-540).

## AU3 · De la demande de l'agent à une nouvelle animation

**User stories** : US-521, US-522, US-526, US-531, US-532, US-534. **Bloquée par** : AU2.

### Ce qu'on livre

L'auteur depuis l'interface ou l'agent par MCP demande une animation d'un personnage.
L'atelier réutilise ou crée sa référence,
produit un clip avec un moteur existant, prépare une bande et permet de la livrer via AU1.
L'auteur voit la demande, sa source, ses réglages et son état dans le personnage.

### Critères d'acceptation

- [x] Chemin complet depuis un personnage vide, avec moteur doublé et stockage réel jetable.
- [x] Le même chemin s'effectue entièrement depuis l'interface sans client MCP connecté,
  jusqu'à l'export ; une demande manuelle n'est pas attribuée à l'agent.
  Preuve : `tests/test_au3_manuel.py`. Le premier essai crée le personnage vide, son
  objectif, sa référence, son clip, sa bande et ses fichiers Godot par la seule API de
  l'interface, sans qu'aucune session MCP ne soit ouverte. Le second montre que le geste
  manuel n'entre ni dans le compteur de séance de l'agent, ni dans les plafonds du cadre
  de délégation, qui refusent toujours l'agent au bon moment.
- [x] La méthode doit accepter les références nécessaires ; le cadre de l'agent est relu
  avant soumission et deux demandes concurrentes ne contournent pas ses plafonds.
- [x] Répéter la clé de demande retrouve le travail ; une fermeture après soumission ne
  déclenche pas une nouvelle fabrication. L'acceptation externe incertaine reste explicite.
- [x] L'agent reçoit une attente bornée puis un résultat exploitable ; l'UI montre le même état.
- [x] La livraison provisoire autorisée n'exige pas une intervention humaine à chaque image.
- [x] La relecture montre le fournisseur et le modèle, le coût annoncé et les références
  en vignettes ; textes et images se modifient dans cette même relecture. L'envoi conserve
  ce qui a réellement été soumis, sans modifier implicitement les règles de l'univers.
- [x] Une fabrication libre d'image ou de vidéo ne demande aucun asset : paramètres,
  références et règles activées se relisent ; le résultat entre en galerie et peut être
  posé sur la toile ou rattaché ensuite (US-539, US-540). Les sources 3D suivent AU9–AU11.

## AU4 · Juger et corriger l'animation sans perdre le contexte

**User stories** : US-523, US-524, US-536. **Bloquée par** : AU3.

### Ce qu'on livre

Depuis le personnage, comparer deux versions, ouvrir la bonne bande, corriger son montage
ou une frame, puis retrouver la liste avec la sélection conservée.

### Critères d'acceptation

- [x] Les actions principales restent visibles dans des fenêtres desktop de 1280 × 800 et
  1600 × 1000, sans imposer plusieurs arbres ni couper un contrôle par un volet.
- [x] Aperçu à taille de jeu et zoom pixel ; durée, boucle et repère se jugent ensemble.
- [x] Une correction pendant la lecture est conservée après fermeture et réouverture.
- [x] Les anciennes capacités de montage et de retouche ont toutes une porte identifiée.
- [x] L'inventaire des outils ci-dessous est détaillé contrôle par contrôle avant déplacement ;
  chaque capacité a son accès, sa portée et une preuve d'usage. Une lacune bloque le retrait
  de l'ancien accès, pas seulement la clôture d'une future tranche.
- [x] Les traitements d'une frame, d'une sélection et de toute la bande sont distingués ;
  la correction ciblée ne modifie pas silencieusement les autres frames.
- [x] Réglages avancés, recettes nommées, calques, annulation et réouverture sont repris ;
  une liste de noms d'outils ou des panneaux vides ne constituent pas une livraison.
- [x] Le choix d'une table reste accessible pendant le défilement de ses réglages ; la
  composition par calques et les ateliers de fabrication ont des accès distincts.
- [x] Une planche se découpe par détection, grille ou rectangles manuels : relire les zones,
  nommer les sorties, créer plusieurs images et reprendre le découpage depuis sa source.
  Les découpes issues de la toile y restent ; la planche originale est conservée.
- [x] Extraire un élément permet de proposer un calage des parties communes, d'ajuster
  position, échelle et opacité, puis de garder ou retirer des pixels à la main. Refermer et
  rouvrir restitue sources, masque et composition ; la portée sur les frames reste explicite.
- [x] Choisir une image ouvre une bibliothèque filtrable avec aperçus. Position et échelle
  se règlent par curseur et valeur ; la variante se déplace aussi directement sur l'image.
- [x] Toutes les tables permettent zoom et déplacement de la vue, distincts du déplacement
  du calque ; l'empreinte du pinceau suit le zoom. La portée explique quelles frames
  changent et qu'un élément fixe ne suit pas automatiquement le mouvement du personnage.
- [x] Depuis un clip, choisir les frames, leur ordre, cadence et boucle permet de créer
  plusieurs bandes sans nouvel appel. Reprendre une bande retrouve ce montage ; les
  aperçus source et sortie restent synchronisés et les corrections existantes sont préservées.
- [x] Le nom libre de la bande ne détermine pas son classement : personnage, mouvement
  et direction sont des choix explicites, conservés à la réouverture. L'ordre des frames
  se change par glisser-déposer et au clavier.

## AU5 · La révision remplace le bon asset dans Godot

**User stories** : US-525, US-533. **Bloquée par** : AU4.

### Ce qu'on livre

L'auteur ou l'agent choisit une révision, prévisualise les fichiers concernés et met à jour
le jeu sans casser les références vers les animations inchangées.

### Critères d'acceptation

- [x] Remplacer une marche conserve le repos et les autres directions ; les choix d'export
  ne dépendent pas d'un favori modifié dans une autre vue.
- [x] Une modification manuelle dans le dossier du jeu produit un conflit lisible.
- [x] Une livraison interrompue n'est pas annoncée terminée ; la précédente reste récupérable.
- [x] Godot recharge la bonne version ; l'export conserve strictement le descriptif Aseprite.

## AU6 · Plusieurs demandes locales, un travail suivi

**User stories** : US-526, US-532. **Bloquée par** : AU3.

### Ce qu'on livre

Un lot explicite d'animations s'exécute dans une file ; l'auteur continue à retoucher et
l'agent suit les éléments terminés, en attente ou échoués.

### Critères d'acceptation

- [x] Les étapes GPU appartenant à l'atelier s'ordonnent sans chevauchement involontaire.
- [x] Aucun verrou interne n'est présenté comme une garantie sur les travaux d'une autre app.
- [x] Annuler vise seulement le travail possédé ; une annulation indisponible est dite telle.
- [x] Reprise après redémarrage, résultat partiel et erreur d'un élément ne refont pas les autres.
- [x] Durées mesurées à froid et à chaud restent distinctes ; le total d'un lot n'est pas
  une multiplication trompeuse du premier démarrage.

## AU7 · Une image par un workflow local nommé

**User stories** : US-522, US-527. **Bloquée par** : AU6.

### Ce qu'on livre

Choisir un premier workflow image configuré, vérifier ses prérequis, fabriquer une référence
ou un asset et le retrouver dans le même personnage et la même bibliothèque.

### Critères d'acceptation

- [x] Le catalogue expose les paramètres utiles et les capacités de références réelles.
- [x] Le workflow et sa version voyagent avec le résultat ; une sortie inattendue est refusée
  sans perdre la consommation ni les fichiers déjà reçus.
- [x] UI et agent suivent le même parcours ; les anciens moteurs restent disponibles.
- [x] Une installation manquante est expliquée ; aucun paquet ni poids n'est installé implicitement.

## AU8 · Une vidéo par un workflow local choisi

**User stories** : US-522, US-526, US-527. **Bloquée par** : AU7.

### Ce qu'on livre

Passer du montage local unique à plusieurs profils vidéo, choisis selon la capacité,
puis reprendre le même montage et la même livraison.

### Critères d'acceptation

- [x] L'image de départ obligatoire reste obligatoire ; aucun repli ne la retire.
- [x] Un profil nouvellement configuré se vérifie, se lance et se rouvre avec sa version.
- [x] Le travail aboutit à une bande exportable et pas seulement à un fichier vidéo isolé.

## AU9 · Un rendu asset3d existant devient une animation du jeu

**User stories** : US-528, US-531. **Bloquée par** : AU5.

### Ce qu'on livre

Depuis le personnage, consulter les sources 3D existantes, choisir un rendu, l'importer
comme bande, le corriger et l'utiliser dans Godot. Première connexion 3D sans génération.

### Critères d'acceptation

- [x] L'animation garde le lien vers le personnage, le rendu et les réglages d'origine.
- [x] Le résultat importé reste consultable après arrêt du serveur 3D.
- [x] Une API incompatible ou un fichier manquant produit une raison précise.

## AU10 · Une source 3D se fabrique depuis le personnage

**User stories** : US-521, US-526 à US-528, US-531. **Bloquée par** : AU6, AU9.

### Ce qu'on livre

L'auteur ou l'agent lance la fabrication locale d'un modèle et de son squelette depuis
une référence. Le résultat revient dans l'asset, prêt à produire un premier rendu exportable.

### Critères d'acceptation

- [x] Les étapes lourdes déjà terminées se réutilisent ; chaque identifiant externe se conserve.
- [x] Les prérequis, la pose technique nécessaire et l'état de la ressource GPU sont expliqués.
- [x] L'échec ou la fermeture ne perd pas un modèle terminé et ne relance pas le pipeline entier.
- [x] L'intégration s'éprouve avec asset3d sans modifier automatiquement son environnement.

## AU11 · Un modèle, plusieurs mouvements et directions

**User stories** : US-520, US-523, US-528. **Bloquée par** : AU10.

### Ce qu'on livre

Depuis la même source 3D, choisir une animation, une caméra et les sorties utiles ; fabriquer
les sprites, comparer et livrer. Une image de pose reste une sortie facultative.

### Critères d'acceptation

- [x] Un nouvel angle ou mouvement ne refabrique ni le modèle ni un squelette déjà réutilisable.
- [ ] Le rendu conserve cadre, pivot et dimensions cohérents entre les directions demandées.
- [x] Les corrections du squelette réellement utilisées sont identifiées ; un ancien rendu
  ne prétend pas se reproduire à l'identique avec de nouvelles corrections.

## AU12 · Les autres assets suivent le même parcours

**User stories** : US-519, US-529, US-531. **Bloquée par** : AU5, AU7.

### Ce qu'on livre

Produire un objet fixe, un objet animé, un décor et un élément d'interface dans l'univers,
par l'auteur ou l'agent, avec recherche et réutilisation avant nouvelle génération.

### Critères d'acceptation

- [x] Un coffre animé n'exige aucun rig de personnage ; un portrait n'exige aucune animation.
- [x] Les réglages visuels hérités et leurs dérogations se lisent avant fabrication.
- [x] Les résultats se retrouvent, se corrigent et s'exportent par les mêmes portes.

## AU13 · Des tuiles qui se raccordent dans Godot

**User stories** : US-530, US-531. **Bloquée par** : AU12.

### Ce qu'on livre

Un premier ensemble de tuiles cohérent, corrigible, prévisualisé en répétition et utilisable
dans une petite carte Godot. Le détail se recadre sur les besoins du jeu avant exécution.

### Critères d'acceptation

- [ ] Produire, juger les raccords, corriger et exporter un ensemble choisi avec l'agent.
- [x] Une carte réelle vérifie bords, coins, transparence et dimensions ; une tuile isolée ne suffit pas.
- [x] L'export porte les relations utiles au jeu et ne se limite pas à un dossier de PNG.

## AU14 · Des sons cohérents avec l'univers

**User stories** : US-530 à US-532. **Bloquée par** : AU12.

### Ce qu'on livre

Un premier bruitage demandé par l'agent ou l'auteur, généré ou importé, écouté, ajusté,
conservé avec sa source et joué dans Godot. Réutiliser le savoir du projet voisin avant
de choisir un moteur ; le détail se recadre au moment de cette tranche.

### Critères d'acceptation

- [x] Écouter, choisir une version et vérifier durée, niveau et boucle si demandée.
- [x] Un fichier silencieux ou invalide n'est pas annoncé comme un résultat prêt.
- [x] Le jeu lit le fichier exporté ; les travaux audio partagent le cadre et la file locale.

## AU15 · Un équipement a son premier calque sur un personnage

**User stories** : US-537, US-541, US-542, US-544, US-545. **Bloquée par** : AU4.

### Ce qu'on livre

Depuis un personnage, créer une pièce ou choisir l'épée commune, ouvrir son emploi, puis
importer une image équipée ou un calque pour une pose fixe ou une frame précise. Extraire,
corriger, placer et retenir ce calque, puis rouvrir le personnage équipé. Ce premier chemin
ne demande aucun fournisseur et pose le contrat réutilisé par les deux tranches suivantes.

### Critères d'acceptation

- [x] La même pièce possède des emplois distincts chez l'humain, le nain et le mutant ;
  leur identité commune se renomme une fois, leurs images et placements restent indépendants.
- [x] Le calque vise un résultat de base précis : pose fixe et direction, ou bande,
  direction et frame. Référence, image équipée et calque utilisable ont des états distincts.
- [x] Extraire conserve base, variante, masque et réglages ; un calque importé garde aussi
  sa source. Déplacement direct, valeurs et ordre devant ou derrière le corps se rouvrent.
- [x] Les masques d'occultation et l'ordre des couches permettent de corriger ce qui passe
  devant ou derrière ; l'original du corps et les autres emplois ne sont jamais modifiés.
- [x] En vue 3/4, l'ordre des images est expliqué indépendamment de l'orientation ; une
  partie d'une pièce peut passer sous le personnage et une autre au-dessus, par frame.
- [x] Depuis la retouche, associer le rendu à une pièce distingue référence, personnage
  équipé à extraire et calque transparent ; la cible est explicite et la source conservée.
- [x] La fiche de la pièce présente d'abord ses emplois et leurs porteurs ; les usages
  à part ou en mise en scène restent distincts des calques portés, comme dans l'existant.
- [x] Retenir une variante ne détruit pas les autres ; une image équipée contenant le corps
  complet ne devient pas un calque superposable par simple changement d'étiquette.
- [x] UI et MCP lisent la même relation pièce → emploi → cible et le même état enregistré.
- [x] La compatibilité conserve les calques de pose historiques et B20 : TIENT recale chaque
  frame, GLISSE garde un calage commun, la main reste prioritaire. Ces résultats restent
  lisibles tels quels ; ils ne sont pas transformés en variantes directionnelles inventées.
  Les emplois « à part » et « mise en scène » existants restent ouvrables.

## AU16 · Toutes les poses et frames utiles portent leur équipement

**User stories** : US-522, US-526, US-541, US-542, US-544. **Bloquée par** : AU15, AU3.

### Ce qu'on livre

Depuis l'emploi, parcourir mouvement ou pose → direction → version d'animation → frames,
choisir une cible, une sélection ou les manques et fabriquer les images équipées. Les
retours passent par extraction et correction pour devenir des calques retenus ; l'auteur
peut contrôler la bande en lecture. L'agent suit la même fabrication bornée qu'en AU3.

### Critères d'acceptation

- [x] Couverture fixe et animée restent distinctes : absente, à extraire, à vérifier,
  prête, à revoir. Les vignettes et filtres conduisent au calque concerné ; une animation
  non produite n'invente aucun nombre de frames, une direction non demandée n'est pas un trou.
- [x] La relecture nomme les cibles et montre leurs corps de base, les références de la pièce,
  le fournisseur, le modèle et la consommation annoncée ; elle ne commande aucune combinaison.
- [x] La relecture distingue images ciblées, planches et appels : le pliage existant est
  réutilisé sur les corps ou frames déjà rendus, quelle que soit leur origine. Capacité,
  références et résolution viennent du catalogue ; le coût est par appel, pas par case.
  Le dépliage conserve chaque correspondance et se reprend sans nouvelle génération.
- [x] Le chemin image par image annonce son nombre d'appels distinct. Une modification du
  clip source n'est proposée qu'avec un workflow compatible ; réutiliser une graine ne
  garantit pas le même mouvement. Les retours vidéo exigent une vérification des frames.
  Les rendus 3D utilisent le pliage d'images tant qu'aucun véritable habillage 3D n'est fourni.
- [x] Une reprise ne refabrique pas les cibles terminées et n'écrase pas une variante retenue ;
  annulation, erreur partielle et soumission incertaine suivent les règles d'AU3.
- [x] Une correction manuelle de masque ou de placement s'applique à la portée choisie ;
  la lecture utilise le bon calque sur chaque frame et ne confond pas des variantes de direction.
- [x] Les réemplois du même calque restent explicites et contrôlables ; « automatique »
  signifie proposition de placement, jamais promesse de qualité ni validation de toute la bande.
- [x] Réordonner conserve l'identité des frames et leurs placements ; ajout, remplacement ou
  changement de version signale les cibles à compléter ou revoir sans perdre les anciens calques.
- [x] Fermer pendant la lecture puis rouvrir retrouve sélection, sources et corrections
  avec des valeurs différentes des défauts ; une image équipée seule ne remplit pas la couverture.

## AU17 · Les tenues se combinent et arrivent dans Godot

**User stories** : US-525, US-531, US-533, US-543, US-544. **Bloquée par** : AU16, AU5.

### Ce qu'on livre

Choisir casque, sac et épée préparés pour un personnage, activer ou désactiver chacun,
juger les poses et animations puis conserver une tenue. Exporter les calques synchronisés
pour les combiner dans le jeu, ou les sprites assemblés de la tenue choisie.

### Critères d'acceptation

- [x] Les huit combinaisons de trois pièces, corps seul compris, se prévisualisent sans
  appel fournisseur et sans modification des sources. La tenue garde des choix de calques
  précis ; retenir ensuite une autre variante ne change pas une livraison en silence.
- [x] Ordre devant ou derrière le corps, masques et priorités se voient en lecture et se
  conservent à la réouverture. Un conflit visuel se corrige sans régénérer la combinaison.
- [x] Une frame manquante ou à revoir reste visible et empêche d'annoncer la tenue prête ;
  l'aperçu ne substitue pas silencieusement l'épée d'un autre emploi ou d'une autre direction.
- [x] Les couches exportées partagent cadre, pivot, ordre, cadence et boucle avec le corps ;
  une scène Godot vérifie une combinaison puis le retrait d'une pièce, sans nouvelle fabrication.
- [x] La sortie assemblée correspond à l'aperçu. Les descriptifs Aseprite restent inchangés ;
  composition et provenance vont dans le manifeste séparé, selon le contrat de livraison d'AU1.
- [x] L'auteur et l'agent peuvent retrouver une tenue, exporter ses couches ou sa composition
  et remplacer la bonne livraison sans modifier les autres animations ni les emplois d'un autre héros.

## AU18 · Une vidéo qui vient d'ailleurs entre dans le jeu

**Relevé d'usage du 13 septembre 2026.** **Bloquée par** : rien — AU3 et AU9 ont déjà livré
tout ce qui est en aval.

### Ce qu'on livre

Une vidéo du disque — un clip filmé, un rendu sorti d'ailleurs, une capture — entre dans
l'atelier et devient **un clip comme un autre** : ses images sont tirées à l'entrée, on y
taille des bandes, on en prélève des images, et elle se pose sur la toile où elle se rejoue.
Rien n'est dépensé, et rien n'est recopié.

**Pourquoi un clip et pas un objet neuf.** Tout ce qui vient après existait déjà et ne
demandait qu'une porte d'entrée : le montage, la pellicule, le prélèvement d'image, la fiche,
le rejeu. Inventer une seconde sorte d'objet aurait dédoublé six écrans pour un fichier qui
se comporte exactement comme un clip payé.

### Critères d'acceptation

- [x] Une vidéo importée devient un clip du jeu, rangé sur le personnage, le mouvement et la
  direction choisis ; elle ne dépense rien et sa fiche dit *source importée — aucun nouvel appel*.
- [x] Ses images sont tirées à l'entrée, une fois : frames, couverture et montage marchent
  sans rien redécoder.
- [x] Un fichier qui n'est pas une vidéo lisible est refusé en français **en nommant le
  fichier**, et ne laisse rien sur le disque — rien n'a été payé, rien n'a à être conservé.
- [x] Le même fichier deux fois se signale comme doublon sans refuser ; `forcer` le fait
  entrer quand même. Même forme que l'import d'une image.
- [x] Un clip se pose sur la toile et s'y rejoue. La carte porte sa première image et pointe
  vers son fichier ; aucune copie de la vidéo n'est écrite.
- [x] Deux clips qui commencent par la même image font deux cartes distinctes.
- [x] Le clip importé se relit entier après effacement de l'index : son `generation.json`
  porte tout.

### Défaut voisin réparé au passage

Les images d'un rendu asset3d importé étaient écrites sur **six** chiffres quand le décodeur
en écrit **quatre**, et les routes de frame et de couverture ne lisaient que les quatre. Une
séquence 3D importée n'a donc jamais pu montrer une image — alors que son montage, lui,
marchait : il parcourt le dossier au lieu de nommer le fichier. L'import écrit désormais sur
quatre chiffres, et **les six restent lus** : rien de ce qui est sur le disque n'a à être
renommé pour redevenir visible.

## AU19 · Une feuille de sprites qui vient d'ailleurs devient une animation

**Relevé d'usage du 13 septembre 2026.** L'auteur importe une feuille de douze cases — un
champignon qui marche — et cherche comment la monter en animation. **Le geste n'existe pas.**
**Bloquée par** : rien — AU18 vient de livrer la porte d'entrée voisine, et tout l'aval est en
place depuis A10.

### Ce qu'on livre

Une feuille de sprites devient **un clip comme un autre** : ses cases sont ses images, on y
taille des bandes, et une bande se range sur un mouvement et une direction du personnage.
Rien n'est dépensé, et la transparence des cases est conservée intacte.

**Ce que le produit savait, et ce qui manquait.** Il savait découper une feuille — en *images
fixes*, sans ordre et sans suite. Il savait fabriquer une animation — mais seulement en
partant d'une **vidéo**. Les deux moitiés ne se touchaient pas : une image d'animation ne sait
désigner qu'un numéro de frame dans un clip, jamais une image de la bibliothèque. L'auteur qui
importait une feuille n'avait donc aucun chemin, et le seul contournement passait par une
vidéo — c'est-à-dire par la perte de la couche alpha, sur des sprites dont c'est justement le
plus précieux.

**Pourquoi un clip, et pas une nouvelle sorte d'objet.** C'est le raisonnement d'AU18,
reconduit sans changer un mot : le montage, la pellicule, le prélèvement d'image, la fiche,
l'affectation à une case et l'export existent déjà et n'attendaient qu'une porte. Un clip
*est* un dossier d'images numérotées ; une feuille découpée aussi. La séquence d'un rendu
asset3d entre déjà par là — `nature: rendu3d` —, et le montage sait depuis ce jour-là qu'un
clip n'a pas toujours de fichier vidéo derrière lui. La feuille prend une nature de plus,
`planche`, et rien d'autre ne bouge.

**Ce qui coupe est ce qui coupait déjà.** Les rectangles sont ceux de l'atelier de découpe —
grille fixe, zones opaques ou tracés à la main —, dans la forme du dépôt, avec la même
vérification. La détection ne décide toujours de rien : l'auteur voit, corrige, et ce qui part
est sa liste, dans son ordre. **La marge d'élargissement est nulle ici**, seule différence
avec la découpe en images : deux cases de tailles inégales feraient une animation qui tressaute.

**Une feuille à plusieurs lignes est un jeu de directions.** C'est la forme courante et c'est
celle de ce jeu-ci : quatre lignes, une par direction. Un appel fait donc **un clip et autant
de bandes que de lignes**, chacune affectée à sa direction ; sans directions nommées, la
feuille entière fait une seule animation.

**Ce que ça ne fait pas.** Les cases n'entrent pas dans la bibliothèque comme douze images :
ce qui est demandé est une animation, et douze demi-images sans ordre encombreraient la
galerie sans servir. Découper en images reste le geste voisin, inchangé.

### Critères d'acceptation

- [x] Une feuille de la bibliothèque et ses rectangles deviennent un clip du jeu, rangé sur le
  personnage, le mouvement et la direction choisis ; rien n'est dépensé et sa fiche dit
  *feuille découpée — aucun nouvel appel*.
- [x] Les cases sont écrites une fois comme images du clip, dans l'ordre reçu ; montage,
  pellicule et prélèvement marchent sans rien redécouper.
- [x] La transparence d'une case survit entière — aucune conversion vidéo sur le chemin.
- [x] Une bande naît du même geste, à la cadence par défaut, cadrée sur la case entière, et
  elle apparaît dans la matrice du personnage à sa case mouvement × direction.
- [x] Plusieurs lignes et autant de directions nommées font autant de bandes, dans l'ordre des
  lignes, sur le même clip.
- [x] Un rectangle hors de l'image, trop petit, ou une feuille inconnue sont refusés en
  français, et rien n'est écrit sur le disque.
- [x] L'écran de découpe porte la seconde sortie — *en faire une animation* — à côté de celle
  qui fabrique des images, avec le mouvement et la direction sous les yeux.
- [x] L'agent le fait aussi : un outil MCP prend la feuille et ses rectangles, et rend le clip
  et ses bandes. Ce que l'écran peut faire, l'agent le peut aussi.
- [x] Le clip issu d'une feuille se relit entier après effacement de l'index : son
  `generation.json` porte tout.

## Comment fermer une tranche

### Ce qui doit être repris au fil du parcours

Ce tableau est un minimum de couverture, pas un inventaire exhaustif déjà vérifié.
Il se complète depuis les écrans, le code et les critères historiques avant leur remplacement.
Les capacités existantes restent utilisables pendant cette reprise ; elles ne sont pas
reportées après les nouveaux moteurs, les tuiles ou le son.

| Capacité existante | Accès dans la nouvelle organisation | Tranche responsable |
|---|---|---|
| Création manuelle, import, génération, variantes et export | Univers / Assets, puis résultat concerné ; MCP facultatif | AU2–AU3 et AU5 |
| Toile : images, textes, notes, îlots, liens et organisation spatiale | Univers → Toile, à côté des règles visuelles | AU2, dès le changement de navigation |
| Détourage et masques, recadrage, grille et réduction | Image ou frame → tables ; « Pixelisation » pour la réduction | AU4 |
| Couleurs, palette, nettoyage, contours et transformations | Même atelier de retouche, avec réglages avancés accessibles | AU4 |
| Calques, sélection, peinture et gomme au pixel | Composition distincte des tables, même image ou frame | AU4 |
| Découpe d'une image en plusieurs images | Image, frame ou carte → atelier de découpe → sorties relues | AU4 ; accès toile maintenu dès AU2 |
| Extraction par différence après calage | Deux images → Extraire un élément → masque → calque du personnage | AU4 |
| Chutier, sélection, ordre, duplication et suppression de frames | Animation → montage, puis retouche de la frame | AU4 |
| Cadence, boucle, cadrage commun, pivot, comparaison et prévisualisation | Animation → montage / aperçu pour le jeu | AU4–AU5 |
| Recettes nommées, sauvegarde, réouverture et portée des modifications | Dans les outils concernés, sans refaire les réglages | AU4 |
| Équipements existants, emplois, calques et habillage animé | Personnage → équipement → emploi ; accès conservé jusqu'à reprise vérifiée | AU2 / AU4 puis AU15–AU17 |

### Preuves de clôture

Les cases se cochent après usage du parcours et vérifications ciblées. Pour toute donnée
nouvelle : sauvegarder avec des valeurs non par défaut, fermer, rouvrir. Pour chaque capacité
serveur : nommer son accès UI et son accès MCP, ou expliquer pourquoi le geste reste manuel.
Revue visuelle dans une fenêtre desktop et essai de panne pertinents ; aucune génération
payante automatique. Mettre à jour l'aide et le seul tableau d'état de PLAN.md.

## Sort du plan précédent

L'amendement RF n'est plus une file de travail parallèle. Ses constats sont repris ainsi :
RF0 (build et polices) accompagne la première preuve et la revue visuelle ; RF1–RF2
(galerie et sujet) AU2–AU3 ; RF3–RF4 (retouche et animation) AU4 ; RF5 (équipement) rejoint
AU15–AU17 avec les capacités existantes préservées pendant la reprise ; RF6
(réglages) AU3/AU7 ; RF7 (sortie) AU1/AU5. Les tranches déjà tenues restent historiques.
Le pantin 2D et le dépliage généralisé sont différés ; leur utilité sera rejugée sur un
besoin concret du jeu, sans les supprimer de l'historique.
