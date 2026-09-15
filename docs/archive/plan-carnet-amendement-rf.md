# Amendement RF — conformité aux maquettes et parcours

> Descendu de `docs/PLAN-carnet.md` le 15 septembre 2026, **sans qu'un mot change**.
> Cet amendement est **remplacé** depuis le 11 septembre 2026 : `docs/PLAN.md` et
> `docs/PLAN-atelier-unifie.md` § *Sort du plan précédent* disent où chacun de ses
> constats a été repris. Ses cases ne se cochent plus. Il restait dans le plan du
> carnet, et le tableau de bord comptait ses soixante critères comme s'ils étaient
> ceux de la tranche `C9` — c'est pour ça qu'il descend.

## Le texte tel qu'il était — conformité aux maquettes et parcours

> **Proposition remplacée par AU — 11 septembre 2026.** Extension ciblée de la V4, issue de la
> [revue de conformité](revue-conformite-carnet-2026-09-11.md), sans nouvelle direction graphique.
> Elle ne réécrit pas les tranches validées et ne les transforme pas en travail à refaire.
> **Sources d'usage :** `docs/PRD.md`, ses user stories, les maquettes déjà retenues par la V4.
> **Apparence :** `docs/DESIGN.md` et les états des planches du carnet.
>
> Affectation des nouvelles tranches : [PLAN-carnet-affectation.md](PLAN-carnet-affectation.md#amendement-rf--les-huit-tranches-proposées).

### Ce que cet amendement change dans l'ordre

La prochaine priorité proposée est **tenir les parcours dessinés**, avant une nouvelle
famille d'outils. Retirer le dernier fichier de l'ancien châssis ne sera plus un critère
suffisant de fin de refonte. Les moteurs, les catalogues, le stockage et les règles de paiement
déjà livrés ne sont pas réimplémentés.

L'ordre conseillé est **RF0 → RF1 → RF2 → RF3 → RF4 → RF5 → RF6 → RF7**. Ce n'est pas une
chaîne de blocages complète : RF6 est possible après RF0, RF7 après RF1. On garde cet ordre
pour traiter d'abord les gestes quotidiens de production. Aucun développement ne part de ce
bloc tant que son découpage proposé n'a pas été validé.

### Décisions durables et limites

- **Même identité visuelle.** Palette, typographie, surfaces, dimensions et pièces viennent
  de DESIGN. Les compositions viennent des maquettes, pas du châssis résiduel.
- **Même modèle d'objets.** Jeu, sujet, image, clip, bande, équipement, emploi et collection
  gardent leur sens ; pas de nouveau schéma prévu pour le seul alignement graphique.
- **Mêmes services et routes.** Réutiliser les gestes existants ; un geste de lot compose
  leurs règles et ne contourne ni refus, ni filiation, ni protection du disque.
- **Même résolution avant paiement.** L'écran montre ce qui part réellement, et un clic de
  navigation, de correction ou de préparation ne paie jamais. Un modèle local annonce le temps.
- **Même navigation par lieux.** Les portes et retours lisent le lieu ; les états utiles du
  travail survivent au détour. Pas de second système de navigation ajouté pour cet amendement.
- **Adaptations nommées.** DESIGN normalise les écarts de taille des maquettes et réserve le
  rouille au lancement / coût ; les extensions déjà déclarées, dont les sœurs, restent valides.
  Une divergence qui change le produit demande un arbitrage, pas une interprétation CSS.
- **Hors périmètre maintenu.** Décors et terrains non cadrés, outils supplémentaires de Finesse,
  nouveau moteur, sélecteur natif de dossier ou nouvelle règle de nommage ne sont pas promis
  par ce seul amendement. Les capacités existantes restent accessibles.

### Preuve commune à chaque tranche

Chaque tranche livre son parcours complet : lecture des données réelles, contrôles,
éventuelles écritures par le service existant, retour et relecture. Ne pas découper une tranche
en « backend terminé » puis « interface plus tard ».

- [ ] Les états de référence concernés sont identifiés ; chaque écart est corrigé ou nommé
  comme adaptation déjà décidée / hors périmètre. Un état non regardé reste non vérifié.
- [ ] Comparaison rendue au format du dessin, puis usage à 1280 × 720 et 1440 × 900 : actions
  atteignables, carnet visible, image exploitable, pas de contrôle coupé silencieusement.
- [ ] Une capture et un scénario datés identifient la même version, les mêmes données et les
  mêmes dimensions. Les différences de contenu des sprites ne comptent pas comme écarts de design.
- [ ] Les données de recette comprennent un cas vide, un cas chargé et un refus pertinent.
  Les fournisseurs sont doublés ; aucun appel payant ne fait partie de cette validation.
- [ ] Un objet modifié est fermé puis rouvert avec des réglages différents des défauts.
- [ ] Les capacités serveur concernées ont chacune une porte visible depuis le parcours,
  y compris celles déplacées hors de la surface principale.
- [ ] Les essais métier pertinents passent ; les essais DOM sont adaptés aux nouveaux gestes
  sans abandonner leur preuve métier. Le contrôle visuel ne se réduit pas à ces essais.
- [ ] Le garde-fou des jetons reste tenu, la dette de géométrie des surfaces traitées est
  retirée après vérification, et le guide décrit les réglages et les portes réellement livrés.

### RF0 · Ouvrir la bonne version et retrouver le dessin de référence

**User stories :** US-300, US-304 ; engagement hors réseau du PRD et système typographique de DESIGN.

**Ce qu'on livre :** un lancement vérifiable du code courant, avec ses trois polices locales,
du choix du jeu à son accueil. Un jeu de recette stable permet de comparer ce même accueil
au dessin et sert ensuite aux parcours suivants. Le build ancien observé ne peut plus être
pris pour la version en cours lors de la recette.

**Références :** Ouverture, Accueil, Systeme, Etats. **Constats :** R01, R06, R08.

**Critères d'acceptation :**

- [ ] Le lancement normal et la recette servent la même révision d'interface et une API
  compatible ; la preuve donne la version servie, pas seulement le nom de la branche.
- [ ] Instrument Serif, Instrument Sans et IBM Plex Mono sont effectivement chargées depuis
  la machine avec un cache vierge et le réseau extérieur coupé.
- [ ] Ouvrir un jeu existant et commencer sans jeu conduisent aux états prévus, avec le titre,
  les comptes et le prochain geste attendus ; une clé absente ne bloque pas la consultation.
- [ ] Le jeu de recette contient images, sujet, clip, bande et recette particulière sans
  génération payante ; il n'utilise pas le dossier de travail de l'auteur.
- [ ] Le premier couple dessin / application est consigné ; les problèmes d'environnement
  ne sont pas enregistrés comme régressions du produit sans reproduction sur cette version.

**Bloquée par :** aucune — première tranche proposée.

### RF1 · Retrouver, choisir et corriger depuis la galerie

**User stories :** US-32, US-34, US-36, US-37, US-38, US-216 à US-220.

**Ce qu'on livre :** la galerie dessinée, du filtre au résultat de l'action : un carnet,
une surface et son volet ; titre compté, consultation et sélection en groupes distincts,
fiche lisible et portes directes vers la correction et le sujet. Les fonctions de l'ancien
arbre restent atteignables à leur destination avant son retrait.

**Références :** Galerie, Navigation, Vocabulaire, Etats. **Constats :** R02 à R05, R10.

**Critères d'acceptation :**

- [ ] Aucun arbre de projets / collections supplémentaire ne double le carnet dans la galerie ;
  changer de jeu, retrouver un orphelin et consulter un échec gardent un chemin explicite.
- [ ] Titre, phrase de rôle, import, sortie, filtres comptés et bande de sélection suivent la
  composition de référence ; une sélection n'écrase pas la recherche ou ses actions.
- [ ] Rechercher, vider un filtre sans résultat et sélectionner deux images fonctionnent ;
  ranger dans un sujet et corriger la sélection ont un résultat vérifiable et une portée annoncée.
- [ ] Une sélection de clips, d'images ou mixte indique les actions possibles et la raison des
  autres ; elle ne prétend pas traiter un clip comme une image fixe.
- [ ] La fiche présente identité, traitements et accès au travail avant les détails avancés ;
  réinjections, filiation, rattachement et texte envoyé restent disponibles.
- [ ] Un aller-retour en retouche restitue le filtre, la sélection et la position utile de la
  galerie ; ouvrir / fermer la fiche conserve une grille praticable aux trois tailles de recette.

**Bloquée par :** RF0.

### RF2 · Du sujet à son image, sans perdre la demande

**User stories :** US-180 à US-184, US-188 à US-193, US-239, US-240, US-410.

**Ce qu'on livre :** nommer ou ouvrir un sujet, choisir sa case, préparer une image, relire
l'envoi, annuler ou confirmer, puis retrouver le résultat au bon endroit. Les pages de famille
et de sujet et la confirmation reprennent leurs compositions prévues, avec une seule saisie
active et une seule porte de paiement pour la demande.

**Références :** Famille, Familles, Fiche, Images, Envoi, Parcours, Etats.
**Constats :** R07, R10 ; parcours de production à éprouver.

**Critères d'acceptation :**

- [ ] Jeu vide et famille fournie montrent le geste de création et les comptes attendus ; une
  création de sujet est immédiatement relue dans sa famille, sans génération implicite.
- [ ] Page et images du sujet distinguent clairement description, case vide, essais et image
  retenue ; pose et direction restent visibles jusqu'au résultat.
- [ ] La demande et les paramètres sont disposés suivant les maquettes, avec les tailles
  de DESIGN ; aucun second formulaire hérité ne concurrence le parcours.
- [ ] Ouvrir puis annuler l'envoi conserve le brouillon, sa cible et les références choisies.
- [ ] La confirmation utilise la résolution réelle : prix ou temps, plafonds et références
  écartées sont explicites ; le double fournisseur prouve qu'avant confirmer aucun appel ne part.
- [ ] Succès et échec reviennent dans le contexte du sujet ; une reprise ne crée pas une
  nouvelle dépense du seul fait de naviguer. Les images produites entrent toujours en bibliothèque.

**Bloquée par :** RF1, pour les portes de lecture des résultats.

### RF3 · Retoucher une image et poursuivre sa série

**User stories :** US-194 à US-198, US-200, US-201, US-203 ; retouche non destructive du PRD.

**Ce qu'on livre :** de la fiche à l'image corrigée, les ateliers reprennent le dessin prévu,
gardent l'image utile au centre et rendent explicites table active, témoin, portée et série.
Une correction se garde et se rouvre ; la suivante se travaille sans refaire le chemin.

**Références :** Retouche, ateliers détourer / recadrer / réduire / couleurs / nettoyer /
retourner / contour / main, Relecture. **Constats :** R07, R09.

**Critères d'acceptation :**

- [ ] La chaîne, les fabriques, l'image et les réglages retrouvent leurs zones de référence ;
  les extensions déjà décidées sont identifiées, aucun moteur existant n'est caché pour imiter un dessin ancien.
- [ ] Les textes visibles aident à choisir effet, disponibilité et durée ; les relevés
  techniques restent consultables sans occuper la place du réglage courant.
- [ ] Le nom de la série dit si l'on parcourt une sélection ou les images d'un sujet ; passer
  à la suivante conserve la table et n'applique pas implicitement la recette à toute la série.
- [ ] Brut, rendu, comparaison, ajustement et zoom restent compréhensibles ; cadre, pipette
  et pinceau visent le pixel montré, y compris au zoom et après changement de taille.
- [ ] Réglage en veille, réglage vidé, défaire et recette nommée gardent leurs effets distincts ;
  la recette particulière se retrouve après fermeture et réouverture.
- [ ] À 1280 × 720, image, réglages et navigation restent accessibles sans colonne inutile ;
  les ombres et valeurs non prévues sont retirées des contrôles concernés selon DESIGN.

**Bloquée par :** RF1. RF2 peut avancer séparément si les composants partagés ne sont pas modifiés simultanément.

### RF4 · Du clip à une bande que l'on peut reprendre

**User stories :** US-376, US-379, US-380, US-451 à US-453, US-456, US-457 ; reprise de bande du PRD.

**Ce qu'on livre :** demander un clip, le retrouver, le monter, retoucher une frame, garder
une bande et la rouvrir. Les différentes étapes prennent les compositions de leur maquette
et conservent sujet, mouvement, direction et origine en passant de l'une à l'autre.

**Références :** Animation-chaine, Clip, Clips, Animations, Atelier-animation, Essai.
**Constats :** R07 ; parcours d'animation à éprouver sur l'API courante.

**Critères d'acceptation :**

- [ ] Commande, choix du clip et montage ont leurs hiérarchies prévues ; ruban, réserve,
  lecture, cadence et réglages ne sont plus des restes de géométrie ancienne.
- [ ] Ouvrir un clip payé ou revenir à son montage ne le commande jamais à nouveau ;
  l'image initiale obligatoire et le travail fournisseur enregistré restent protégés.
- [ ] Une frame retirée ou retouchée conserve le sort et la filiation déjà décidés ; aucun
  changement d'écran ne perd silencieusement un réglage ou une sélection de frames.
- [ ] La manipulation de frame est testée **pendant la lecture**, puis la bande est fermée
  et rouverte avec une cadence et une sélection différentes du défaut.
- [ ] Le contexte du sujet et la séparation images fixes / animations survivent au retour ;
  l'essai montre la bande retenue à la cadence exportée.
- [ ] Gratuité, coût inconnu et temps local restent distincts ; les preuves utilisent des
  clips existants et des fournisseurs doublés, jamais une commande payante.

**Bloquée par :** RF2 et RF3.

### RF5 · Poser un équipement et corriger son calque

**User stories :** US-213 à US-215 ; équipement, emplois et calques animés déjà cadrés par B19–B20.

**Ce qu'on livre :** aller de la pièce à son emploi, voir le porteur, produire ou reprendre
le calque, vérifier le résultat et revenir à cet emploi. Découpe et différence suivent
leurs maquettes tout en conservant les fonctions déjà livrées.

**Références :** Emplois, Emploi, ateliers différence et découpe.
**Constats :** R07 ; parcours d'équipement à éprouver.

**Critères d'acceptation :**

- [ ] Pièce, emploi, porteur, pose et direction restent identifiables à chaque étape ; les
  calques fixes et animés gardent des comptes et des actions distincts.
- [ ] Les zones d'image, de réglage et de résultat reprennent les dessins, avec des contrôles
  à la taille de DESIGN ; un outil inerte laisse sa raison à la place de son contrôle.
- [ ] Le calage se fait en regardant le résultat ; le calque et ses réglages particuliers se
  retrouvent après fermeture et réouverture, sans modifier le corps d'origine.
- [ ] Une découpe donne accès aux images produites et à leur rattachement ; revenir à la
  planche d'origine reste possible sans régénérer.
- [ ] La sortie d'un outil revient à l'emploi ou à l'image de départ ; les références et
  méthodes déjà accessibles restent atteignables après le déplacement des contrôles.

**Bloquée par :** RF3 ; RF4 pour la partie calques animés.

### RF6 · Régler le jeu et revenir au travail

**User stories :** US-221 à US-229, US-235, US-236, US-304 à US-308, US-411, US-412.

**Ce qu'on livre :** trouver le bon réglage depuis le carnet ou la famille, le relire et
revenir à son travail. Les règles du jeu, l'installation et la toile gardent des rôles
distincts et leurs compositions prévues ; le guide indique leurs véritables portes.

**Références :** Nouveau-jeu, Installation, Toile, Guide, Barre, Navigation, Etats.
**Constats :** R10 ; composition de ces parcours à comparer.

**Critères d'acceptation :**

- [ ] Chaque réglage visible annonce sa portée : atelier, jeu, famille ou image ; aucune
  porte générique « Réglages » ne laisse deviner son contenu ou ne double un formulaire.
- [ ] Les fonctions encore portées par un panneau secondaire sont relogées avant son retrait ;
  garde-fous de l'agent, dossier et mouvements restent accessibles à leur portée décidée.
- [ ] Une modification de défaut est relue dans l'écran appelant sans recharge manuelle ;
  elle ne modifie pas implicitement les images déjà faites.
- [ ] La toile garde image, réserve et menu d'îlot selon la planche ; les réglages ne reprennent
  pas la place destinée aux références. Les cas vides gardent un geste utile.
- [ ] Guide et barre amènent au même lieu que le carnet ; les libellés suivent le vocabulaire
  actuel et ne renvoient pas à un onglet disparu.
- [ ] Retour au sujet ou à la retouche conserve le contexte utile ; les essais d'installation
  utilisent de faux secrets, sans modifier les comptes ni l'installation réelle de l'auteur.

**Bloquée par :** RF0. Partager les décisions de navigation avec RF1.

### RF7 · Livrer les images choisies et comprendre ce qui est sorti

**User stories :** US-76, US-77, US-318, US-319, US-457 ; sortie déjà cadrée par B21.

**Ce qu'on livre :** partir du sujet ou de la galerie, relire ce qui sort et sa destination,
déposer, puis retrouver le bilan et la dépense correspondante. La sortie et les dépenses
reprennent leurs compositions de référence sans changer leurs règles de calcul ou d'écriture.

**Références :** Sortie, Depenses, Relecture, Parcours. **Constats :** R11 ; fin de parcours à éprouver.

**Critères d'acceptation :**

- [ ] La porte distingue sélection, sujet et ensemble du jeu ; le lot présenté correspond
  au geste d'entrée, et sa portée est relue avant toute écriture.
- [ ] La disposition suit la maquette ; destination, rangement, collisions et moteur restent
  lisibles avec une longue liste. Les options non livrées ne se présentent pas comme fonctionnelles.
- [ ] Prévisualiser n'écrit rien ; confirmer écrit exactement ce qui a été annoncé, dans un
  dossier jetable pour la preuve. Aucun second chemin d'écriture ne contourne les protections.
- [ ] Une seconde sortie distingue ajout, remplacement et fichier étranger ; la fermeture et
  la réouverture restituent les choix selon leur portée déjà définie.
- [ ] Le bilan donne le prochain geste et l'accès au résultat ; le journal distingue argent,
  consommation gratuite et coût inconnu, sans sommer des unités différentes.
- [ ] Le gabarit de nommage et le choix de dossier font l'objet d'une décision explicite de
  couverture ; leur absence ne disparaît pas derrière une case « écran conforme ».

**Bloquée par :** RF1 ; recette finale de bout en bout après RF2 à RF6.

### Fermer la V4 après cet amendement

Ce sont les critères de clôture du bloc proposé, **pas une tranche horizontale supplémentaire** :

- [ ] Rejouer « ouvrir → sujet → image → correction → sortie » et « sujet → clip → bande →
  retouche de frame → reprise → sortie », avec un détour par les réglages et un retour.
- [ ] Chaque état d'écran retenu du sommaire a une preuve, une adaptation nommée ou un hors
  périmètre explicite ; aucun statut « conforme » ne découle du seul passage au papier.
- [ ] Les exemptions de géométrie restantes sont justifiées par leur nature non visuelle,
  pas par l'ancienneté de l'écran. Les contrôles des parcours ne restent pas exemptés.
- [ ] Les récits historiques du plan sont rangés dans leurs documents propriétaires, sans
  retirer les invariants ni casser les renvois ; le plan actif redevient lisible.
- [ ] Le tableau de `docs/PLAN.md` est mis à jour, les critères tenus vont dans le suivi V4
  et les enseignements dans le journal ; pas de tableau d'état supplémentaire.
- [ ] L'auteur a pu juger les comparaisons et utiliser les parcours. Une validation technique
  seule n'est plus présentée comme une validation de fidélité aux maquettes.

