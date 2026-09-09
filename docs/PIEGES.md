# Asset Kitchen — Pièges connus

Deux cent trois pièges, chacun payé une fois. Un piège n'entre ici que s'il a **coûté** —
une séance, un appel payant, une tranche entière —, et il s'écrit avec ce qui l'a rendu
invisible, jamais seulement avec sa correction.

**Ce fichier se lit à la demande, pas au démarrage.** On y vient de deux façons : par un
renvoi du code (`atelier/…`, `interface/…`, `tests/…` citent `docs/PIEGES.md` là où le piège
mord), ou en cherchant dedans avant d'attaquer un terrain déjà miné — encodage Windows,
appels payants, `ResizeObserver`, onglet d'arrière-plan, SQLite, montage FastAPI, MCP.

Une entrée s'ajoute en bas. **Aucune ne se supprime** : un piège corrigé reste un piège que
la prochaine réécriture retrouvera.

## Pièges connus

- **`.env` en UTF-16.** PowerShell écrit en UTF-16 avec `>` et `Out-File`. Le lire comme de
  l'UTF-8 lève sur le tout premier octet. `atelier.reglages.lire_secret()` essaie plusieurs
  encodages — toute autre lecture de fichier écrit au terminal Windows doit faire pareil.
  **Et la façon d'essayer compte** : voir la dernière entrée de cette liste.
- **Toujours reconfigurer `sys.stdout` en UTF-8 dans un script à sortie longue.** Dès que la
  sortie est redirigée, Windows encode en cp1252 : un simple `──` lève un
  `UnicodeEncodeError`. Levée depuis un thread d'un `ThreadPoolExecutor`, elle remonte par
  `pool.map` et **tue tout le lot**. Constaté le 26 août : le jet 2 du banc s'est arrêté à 4
  configurations sur 12, après avoir payé les appels. Trois lignes en tête de `main()`
  l'évitent — jamais « on verra si ça pose problème ».
- **Un lot payant doit écrire ses résultats au fur et à mesure, jamais à la fin.** C'est ce
  qui a sauvé les 4 configurations déjà faites au moment du plantage ci-dessus : les PNG et
  le `mesures.json` étaient déjà sur le disque, et la reprise n'a rien repayé.
- **Ne jamais générer petit.** 512 px coûte $0,045 contre $0,067 en 1K chez Nano Banana 2 —
  un tiers de moins pour beaucoup moins de qualité. On génère en 1K et on réduit après.
- **Imposer `aspect_ratio`.** Sans lui, Gemini part en 16:9 et Seedream en 1:1. Deux essais ne
  sont plus comparables, et un sprite n'est plus cadrable.
- **Écrire « one single sprite, one pose only ».** Sans quoi Gemini rend spontanément une
  planche de trois poses — il calque la mise en page de son image de référence.
- **L'échelle du sujet dérive d'une génération à l'autre**, malgré tous les « same size » du
  prompt. Le recadrage et la normalisation d'échelle ne sont pas du confort : sans eux, deux
  frames ne se montent pas.
- **Aucun modèle ne déclare de prompt négatif.** Relevé sur les 48 modèles image du
  catalogue : zéro `negative_prompt`. Le champ existe dans le produit (US-6) ; c'est
  l'adaptateur qui le replie en fin de prompt (`Do not include: …`). Ne jamais l'envoyer
  comme un paramètre : il serait ignoré en silence, comme `output_format` chez Seedream.
- **Le catalogue bouge d'un jour à l'autre.** 47 modèles le 26 août, 48 le 27 —
  `meta/muse-image` est apparu entre les deux. C'est précisément ce qu'une liste écrite en
  dur ne verrait pas.
- **Le coût d'un appel dépend du nombre de références, chez ceux qui facturent au token.**
  Mesuré sur `gpt-image-2` en `quality: low` : $0,0064 sans référence, $0,0124 avec une,
  $0,0245 avec deux. Un univers riche renchérit chaque appel — à surveiller dès T4.
- **Un seul échantillon ne mesure rien.** Un modèle génératif n'est pas déterministe : tout
  banc se fait en deux jets au minimum, et l'écart entre eux compte autant que la moyenne.
- **Un générateur asynchrone ne se referme pas pendant qu'il attend.** Un abonnement écrit
  en `async def … yield` lève `aclose(): asynchronous generator is already running` dès que
  l'appelant le referme alors que l'attente en cours n'est pas finie — et un flux
  d'événements est *toujours* en attente. Constaté le 27 août sur `GET /api/events`. Un
  abonné reçoit donc une **file** (`asyncio.Queue`) : l'appelant décide comment il attend,
  et annuler cette attente n'abîme rien.
- **`TestClient` et `httpx.ASGITransport` attendent la fin de la réponse.** Ils ne
  conviennent pas à un flux qui n'en a pas : le test se fige jusqu'au délai du lot entier.
  On appelle l'application ASGI directement, on lit les premiers messages, et on envoie
  `http.disconnect` — ce qui vérifie du même coup que le serveur s'en remet.
- **Durcir l'alpha AVANT la réduction, jamais après.** Repris de
  `MySpriteAi/src/lib/pixelPipeline.ts`, où ça a été payé cher. Un contour à demi transparent
  est tranché à pile ou face par un rééchantillonnage au plus proche voisin : deux passes de
  suite rendent deux silhouettes différentes. Et la quantification force l'alpha à 255 sans
  toucher à la couleur, donc un pixel de contour à peine visible ressort **opaque, de la
  couleur du fond** — le liseré clair autour du sprite. Les deux moitiés du même piège.
- **Un détourage au seuil global perce le sujet ; un remplissage depuis le bord ne le perce
  pas.** La différence tient en un mot : *relié*. Un pixel de la couleur du fond qui n'est
  relié à aucun bord — l'os d'un squelette, le reflet d'une fiole — n'est pas du fond.
  Corollaire assumé : **une région fermée reste opaque**. L'intérieur d'un cadre d'interface
  survit au détourage, et c'est la même règle qui sauve le squelette. Le rendre transparent
  est un geste de l'auteur, jamais une décision de l'outil.
- **Une mesure de périodicité par « meilleure phase » ment à grand pas.** Écrite pour mesurer
  la grille rendue, elle a répondu 40 à 64 px sur tout le corpus — c'est-à-dire le haut de sa
  propre plage de recherche, ce qui aurait dû alerter tout de suite. La cause : à grand pas, la
  phase retenue porte peu d'échantillons, donc son maximum est mécaniquement flatté.
  L'autocorrélation, elle, tombe juste sur les sujets fins — mais **prend une harmonique sur
  les plus grossiers**. Elle situe un ordre de grandeur, elle ne remplace pas l'œil : aucun
  chiffre de dérive publié ne doit venir d'elle seule.
- **Deux chemins amènent le même objet à l'écran, et ils se croisent.** La réponse du
  `POST` et l'annonce du flux portent la même génération ; le serveur publie **avant** que
  le POST ne soit revenu. Insérer sans regarder d'un côté et fondre de l'autre a doublé
  chaque génération lancée depuis l'onglet — et une clé React doublée laisse des tuiles
  orphelines qu'aucun rendu ne retire ensuite. Le défaut ne survivait à aucun
  rechargement, puisque le message d'état remplace la liste par celle du serveur : il a
  donc traversé T1 et T2 sans se voir. **Tout ce qui arrive par deux chemins se fond par
  identifiant, jamais ne s'empile.** Constaté le 27 août 2026, à la première séance faite
  au navigateur.
- **Un test qui ne rejoue pas l'ordre du serveur ne prouve rien.** Le double du flux dans
  `interface/src/App.test.tsx` publie **avant** que le POST ne réponde, parce que c'est ce
  que fait le vrai serveur — il enregistre, il annonce, puis il rend la main. Avec l'ordre
  inverse, le même test passe sur le code fautif. Vérifié en réintroduisant le défaut : le
  test tombe sur « 4 tuiles au lieu de 2 ».
- **Le message d'erreur d'`httpx` est en anglais, et il finit à l'écran.** « All connection
  attempts failed » est ressorti tel quel dans la barre d'état. Toute erreur de
  transport se traduit en une phrase du produit avant de quitter `fournisseur/` ; un message
  de bibliothèque ne franchit jamais le port.

- **`with sqlite3.connect(...)` ne ferme pas la connexion**, il ne fait que valider la
  transaction. Rendre la connexion telle quelle laissait un descripteur ouvert par
  requête — et sous Windows un fichier encore ouvert **ne se supprime pas**. C'est
  exactement le geste que T3 doit permettre : effacer `atelier.sqlite3` pour voir la
  bibliothèque se reconstruire. Une connexion s'ouvre et se referme, toujours.
- **Une colonne qui double l'objet doit être réécrite depuis lui, sans exception.**
  `cree_le` manquait à la liste des colonnes mises à jour : la date changeait dans
  `contenu` et pas dans la colonne, donc l'objet disait une chose et l'ordre de la
  grille en disait une autre. Le fichier interdit les « deux vérités » dans sa première
  phrase, et c'est une colonne oubliée qui les a créées.
- **Un état dérivable ne se garde pas en double.** La fiche ouverte et la sélection
  étaient deux états pour la même chose : deux clics dans le même rendu lisaient la même
  sélection périmée, et le second effaçait le premier au lieu de s'y ajouter. La fiche
  **est** la sélection quand elle vaut un. Corollaire, dans React : toute mise à jour qui
  lit l'état précédent passe par la forme fonctionnelle, jamais par la valeur du rendu.
- **Un abonnement au flux ne doit dépendre de rien.** Mettre le filtre ou le projet ouvert
  dans les dépendances de l'effet ferme la liaison et en rouvre une à chaque changement —
  donc à chaque frappe dans le champ de recherche —, et le serveur renvoie l'état complet à
  chaque fois. Ce qui bouge vit dans un `ref` que les gestionnaires consultent.
- **Un événement qui porte un objet ne dit pas qu'il est encore d'ici.** Supprimer un
  projet détache ses assets, chaque détachement est annoncé, et les détachés venaient
  s'installer dans la grille du projet **ouvert**, qui n'est pas le leur. Ce qui se fond
  dans une liste filtrée doit être confronté au filtre — sauf à la recherche, qui vit sur
  le serveur et qu'on ne rejoue jamais à l'écran.
- **Un appel qui échoue peut avoir coûté.** L'adaptateur levait avant de lire `usage.cost`
  quand la réponse ne portait aucune image : le montant disparaissait du journal du projet,
  c'est-à-dire exactement celui qu'on cherche à expliquer. Le coût se lit **avant** tout ce
  qui peut lever.
- **Un champ ajouté à un objet ne se rétro-remplit pas tout seul.** Les assets écrits avant
  T3 n'ont ni coût ni date de lot : relire le disque sans aller les chercher dans la
  génération affichait `$0,0000` sur des images payées, et cassait l'ordre de la grille.
  `rattraper()` est l'endroit de ces réparations — il passe déjà à chaque démarrage.
- **« Sans projet » doit vouloir dire *détaché*, jamais *antérieur au rangement*.** À
  l'apparition du tout premier projet, ce qui n'en avait pas y entre : sinon l'atelier
  s'ouvre sur une grille vide alors qu'il a déjà six images.
- **Le type d'une image de référence se lit sur ses octets.** L'adaptateur annonçait
  `data:image/png` en dur : réinjecter une image d'un modèle qui ne rend que du JPEG
  l'aurait envoyée sous une fausse étiquette, et le refus serait venu du fournisseur après
  avoir traversé tout le produit.
- **Un fichier qui fait foi s'écrit entièrement ou pas du tout.** `write_text` sur le nom
  définitif laisse un JSON tronqué si le processus s'arrête au milieu — et un
  `generation.json` tronqué est le seul cas où « la bibliothèque se reconstruit sans perdre
  un asset » tombe pour de bon. On écrit à côté, puis on renomme.
- **`nodrag` n'écarte pas le déplacement du plan ; `nopan` si.** Les deux classes de la librairie
  de plan se ressemblent et ne gardent pas la même porte : `nodrag` écarte le glissement de **nœud**,
  `nopan` le déplacement du **plan**. Toute surface où le produit tient un geste à la main doit
  porter les deux — sinon la même pression fait les deux choses, l'objet part à deux fois la main
  pendant que le fond part à une fois, et c'est une parallaxe. Et `stopPropagation` ne peut rien y
  faire, pour deux raisons plutôt qu'une : React délègue à la racine du document, donc son
  gestionnaire passe **après** l'écouteur natif de la librairie — et le `pointerdown` qu'il arrête
  n'est de toute façon pas le `mousedown` qu'elle écoute. Une classe, lue par la librairie
  elle-même, est la seule réponse. Constaté le 28 août 2026 sur les quatre surfaces de la toile.
- **Un menu ouvert par le survol doit porter ce survol lui-même.** Celui d'une carte est un enfant de
  sa carte : y aller n'est pas la quitter, et le motif marche depuis T4 pour cette seule raison.
  Celui d'un îlot est le **frère** de sa bande, et le pointeur qui montait le chercher éteignait ce
  qui le tenait ouvert. La géométrie fait la différence, pas le motif ; et jsdom ne la voit pas,
  puisqu'il ne met rien en page.
- **Les polices de l'interface viennent du réseau.** `interface/index.html` charge
  Instrument Serif, Instrument Sans et JetBrains Mono depuis Google Fonts. Hors ligne,
  l'atelier fonctionne — les replis système prennent la main —, mais il ne **ressemble** pas
  à ce que `docs/DESIGN.md` décrit. À embarquer le jour où le hors ligne devient un usage
  et pas un accident.
- **Le démarrage attend le catalogue avant de servir quoi que ce soit.** Le délai est de
  30 s : un réseau qui absorbe sans refuser retarde donc l'ouverture d'autant, bibliothèque
  comprise. Un réseau franchement coupé, lui, refuse tout de suite. Le local se fait déjà
  en premier dans `Atelier.ouvrir()` ; rendre la main avant le catalogue demanderait de
  l'annoncer sur le flux, ce que l'écran sait déjà écouter.

- **Une table de palette Pillow se complète en répétant, jamais avec des zéros.** Elle
  compte toujours 256 entrées, et `quantize(palette=…)` ramène chaque pixel à la plus
  proche des **256** — pas à la plus proche de celles qu'on a écrites. Compléter avec des
  zéros posait donc 254 noirs purs : mesuré sur six gris et une palette de deux couleurs
  claires, les deux plus sombres ressortaient en `#000000`, une couleur que la palette du
  projet ne déclare pas. Même famille que le liseré du seuil alpha — *une valeur de
  remplissage qui n'est pas neutre finit par se voir*. Le défaut a dormi de T2 à T4 parce
  que le seul chemin qui l'empruntait était grisé.
- **Une palette lue sur des images entières ne dit rien du sujet.** La coupe médiane
  appliquée aux artworks tels quels rend vingt gris sur vingt-quatre : le fond plat occupe
  75 % des pixels et son anti-crénelage l'éclate en autant de seaux. On détoure d'abord.
  Corollaire à connaître : **une région fermée reste opaque**, donc l'intérieur d'un cadre
  d'interface entre dans la palette — c'est la même règle qui sauve le squelette.
- **Le dédoublonnage des références se fait sur le couple, pas sur l'identifiant.** Depuis
  T4 deux familles d'images partent par le même tuyau — un asset de la bibliothèque et une
  carte du tableau —, et elles ne se nomment pas dans le même espace.
- **Un artwork retiré ne doit pas rendre les générations passées non relançables.** Les
  artworks entrent dans `generation.references`, et `_octets_references` refusait l'appel
  dès qu'un identifiant manquait. Un asset disparu arrête toujours l'appel — c'est l'image
  que l'auteur a choisie de montrer ; une **carte** disparue est sautée, parce qu'un artwork
  inspire et n'a pas été choisi appel par appel. Sans cette différence, retirer une planche
  cassait US-19 sur tout l'univers.
- **Un balayage de masse n'écrit pas un événement par objet.** La diffusion garde 64
  messages par abonné : cent assets remis à jour en perdraient les plus anciens sur un
  onglet lent, pour un écran qui redemande de toute façon la grille entière. `sauver` prend
  donc `annoncer=False`, et l'appelant annonce **une fois**, à la fin.
- **Un asset ramené au brut reste au brut.** `revenir_au_brut` désépingle, donc l'épingle
  ne le protège pas d'un balayage de palette — et lui reposer une grille défferait « revenir
  à l'image d'origine est un seul geste » par un geste qui ne le concernait pas. Le vide
  **est** la décision : le balayage saute une recette vide et la compte comme conservée.
- **La réapplication de palette ne passe jamais par `poser_recette`**, qui épingle. Le
  premier passage épinglerait tout le projet et le second ne remettrait plus rien à jour :
  la fonction s'annulerait elle-même à son deuxième usage.
- **Un montage FastAPI ajouté après celui de l'interface n'est jamais atteint.**
  `creer_application` monte `interface/dist` sur « / », qui attrape tout. Constaté en montant
  un dossier de planches pour une séance : la planche revenait en JSON de vingt-deux octets,
  et le produit refusait à juste titre « ce n'est pas une image ».
- **Le message de Pillow ne franchit pas le port non plus.** `mesurer()` lève « cannot
  identify image file <_io.BytesIO object at 0x…> » — de l'anglais qui nomme un tampon
  mémoire. Ce qui compte, et que le PRD demande, c'est **quel fichier** pose problème parmi
  les douze qu'on vient de déposer. Même règle que pour `httpx`.
- **`aspect-ratio` cède devant `max-height`, et le cadre ment.** Un cadre en
  `width: 100%` + `aspect-ratio: 1/1` + `max-h-full` dans une zone de 1420 × 906 ressort en
  **1388 × 874** : le navigateur prend la largeur disponible, en déduit la hauteur, rabote
  la hauteur au maximum — et **ne redéduit pas la largeur**. L'image, elle, reste centrée
  par `object-contain`, donc tout ce qui est posé en pourcentage du cadre se décale de
  l'image qu'il désigne. Une mise à l'échelle qui doit être exacte se calcule : un seul
  facteur, `min(place_l / image_l, place_h / image_h)`, et le cadre **est** l'image.
- **`minmax(cran, 1fr)` accepte une colonne unique et l'étire.** Le zoom 4× de la grille
  rendait une tuile de 1028 px sur une colonne de 1060 — huit fois la taille de repos pour
  un contrôle qui en annonce quatre. Un cran de zoom n'est donc disponible que si **deux**
  tuiles y tiennent côte à côte, gouttière comprise : une grille d'une colonne n'est plus
  une planche contact, c'est une visionneuse.
- **Un `ResizeObserver` ne livre rien à un onglet qui ne compose pas ses images.** Ses
  rappels passent par la boucle de rendu ; sur un onglet en arrière-plan, le grisé du zoom
  n'est jamais apparu — la largeur mesurée restait à zéro pour toute la session. Une
  largeur se lit à la demande (`getBoundingClientRect`), au montage, au redimensionnement
  de la fenêtre, et à la fin de la transition de 160 ms des colonnes. Trois déclencheurs,
  une seule mesure.
- **Le défaut d'une bibliothèque est une cible mouvante, et il se nomme.** `rembg.new_session()`
  sans argument charge `bria-rmbg` depuis la version 2.0.81 : un gigaoctet, et **15,8 s**
  par image de 1024 px sur processeur. `u2net`, nommé, met **0,47 s** pour une silhouette
  équivalente à deux points près. Le dépôt annonçait « ~180 Mo » — la taille d'`u2net` —
  et le défaut avait changé sous cette note sans que rien ne le dise.
- **Demander si un paquet est là ne doit pas le charger.** `import rembg` tire
  `onnxruntime` dans le processus au premier `GET /api/status`, c'est-à-dire à l'ouverture
  de l'atelier, pour la seule question « faut-il griser ce bouton ? ». Or « le
  post-traitement ne touche jamais le GPU » se **prouve** en regardant `sys.modules` :
  installer le second moteur aurait fait tomber ce test sans qu'aucun détourage par modèle
  ait eu lieu. `importlib.util.find_spec` répond sans rien charger.
- **Un glob de suppression mord sur ce qui commence pareil — sauf avec son séparateur.**
  Les découpes de T5 vivent dans le dossier de la génération de leur planche, aux rangs 100
  et suivants ; effacer la planche fait `glob("0-*")`, qui ne touche pas `100-asset.json`
  parce que le motif exige le tiret. C'est ce qui rend le décalage de rang sûr, et c'est
  aussi ce qu'il ne faut pas défaire : nommer une découpe `0-1-asset.json` aurait fait
  disparaître les huit avec leur planche.
- **Une piste `minmax(0,1fr)` ne borne pas ce qu'on pose dedans.** La piste accepte de
  descendre à zéro ; l'**élément** posé dessus, lui, vaut `min-width: auto`, c'est-à-dire la
  largeur de son contenu. Une barre d'outils sans retour à la ligne qui demandait 963 px
  pour 740 élargissait donc sa colonne, puis la page entière — en-tête et pied compris — et
  poussait le bouton d'export 150 px hors de l'écran. Le défaut a traversé T3, T4 et T5
  parce que **rien n'était ancré à droite de cette barre** : ce qui débordait sortait de
  l'écran sans rien déplacer de visible. Il a fallu un contrôle *permanent* pour le voir.
  `min-w-0` sur ce qui doit céder, `shrink-0` sur ce qui doit rester.
- **La largeur d'un `select` est décidée par ses données.** Il se dimensionne sur son
  option la plus longue, et les options sont ici des **noms de projets** — donc sans
  plafond. « Ranger… » faisait déjà 162 px pour deux projets et une collection. La largeur
  d'un contrôle est une décision de mise en page ; la liste déroulée, elle, montre les noms
  entiers, et ce n'est pas elle qu'il faut borner.
- **Les transitions CSS n'avancent pas dans un onglet qui ne compose pas ses images.** Même
  famille que le `ResizeObserver` de T5, et le même piège pour qui mesure : `getComputedStyle`
  y rend un instant figé du trajet — colonnes `240px 300px 740px 0px` là où le style en
  ligne dit `… minmax(0px,1fr) 380px`, donc une fiche qu'on croit fermée alors qu'elle est
  ouverte. Une mesure de mise en page se prend transition coupée, jamais après un `sleep`.
- **`zipfile` accepte deux entrées de même nom sans broncher**, et l'outil qui décompresse
  n'en garde qu'une. Quatre variations d'un même prompt portent quatre fois le même label :
  un nom de fichier tiré du label doit donc être numéroté, et c'est le **descriptif** qui
  fait foi sur le lien entre un nom lisible et un identifiant, jamais le nom lui-même.
- **Un PNG ne se recomprime pas.** Il est déjà dégonflé : le repasser au deflate coûte du
  temps pour quelques octets. On le range tel quel (`ZIP_STORED`) et on comprime le
  descriptif, qui est du texte.
- **`Content-Disposition` n'est pas lisible par `fetch` sans qu'on l'expose.** Une réponse
  n'offre à JavaScript qu'une poignée d'en-têtes ; le nom de fichier n'en fait pas partie.
  Sans `Access-Control-Expose-Headers`, l'archive serait sauvée sous un nom inventé par
  l'interface — et deux endroits qui nomment la même archive finissent par ne plus dire la
  même date.
- **Une adresse d'objet non révoquée retient ses octets jusqu'à la fermeture de l'onglet.**
  Une image seule a une adresse et se télécharge par un `<a download>` ; une archive, elle,
  est fabriquée pour cette sélection-là et n'en a pas. On lui en donne une le temps d'un
  clic, et on la reprend aussitôt.
- **Zéro n'est pas une dimension mesurée, c'est l'absence de mesure.** Une carte d'adresse
  qui n'avait pas abouti annonçait `0×0`. Le produit dit partout que les dimensions mesurées
  font foi : une mesure ne s'affiche que si elle a été prise.

- **Un `<button disabled>` ne dispatche aucun événement de souris, pas même sur ses
  enfants.** Le motif de l'infobulle promet qu'un contrôle grisé garde son explication —
  *pourquoi c'est fermé* n'est pas *à quoi ça sert* —, et c'est justement celle qu'on va
  chercher à ce moment-là. Avec `disabled`, elle aurait été la seule du produit à ne jamais
  s'ouvrir. La rangée d'étape passe donc à `aria-disabled`, le clic gardé par une
  condition : le refus est entier, la raison reste dans sa fente, et l'explication s'ouvre
  par-dessus. Vérifié en réintroduisant le défaut — l'essai tombe.
- **Une clé d'explication mal tapée ne lève pas, elle rend le réglage muet.**
  `explication()` rend `undefined`, le pointillé ne paraît pas, et rien ne le dit. C'est la
  panne que le corpus existe pour éviter, et elle est silencieuse : un essai balaie donc les
  composants et confronte **toute clé branchée à l'écran** au corpus. Corollaire de
  rédaction : un second gabarit de libellé serait un second endroit où poser le pointillé,
  donc un endroit où l'oublier — d'où l'état *éteint* plutôt qu'un deuxième composant.
- **Un `<span>` dans un conteneur flexible est blockifié, et une colonne l'étire.** Son
  `display` calculé vaut `block` quel que soit celui qu'on écrit ; dans une rangée il se
  dimensionne sur son texte, dans une **colonne** `align-items: stretch` lui donne toute la
  largeur du panneau. « Proportions » occupait donc 268 px pour 60 px de mot — 208 px de
  zone morte qui ouvrait quand même la bulle et allumait quand même le pointillé —, à côté
  de « Modèle », content, dans le **même panneau** : la poignée dépendait de l'orientation
  du parent, pas du motif. « Le libellé est la cible » ne tient que si la cible *est* le
  libellé, d'où `w-fit` sur le gabarit. Même famille que le cadre de la planche et que la
  barre d'outils : *une règle déléguée au navigateur dont personne n'a mesuré le résultat*.
  Trouvé le 27 août 2026 en regardant l'atelier lancé, et invisible aux 31 essais d'écran —
  jsdom ne met rien en page. L'essai qui le garde vérifie donc **la règle**, et il le dit ;
  la largeur, elle, se mesure au navigateur.
- **Ce qu'un panneau flottant doit éviter est le panneau, pas la moitié d'écran.** L'infobulle
  choisissait son côté en comparant son ancre au **milieu de la fenêtre**, sous l'intention
  *jamais sur ce qu'elle règle*. Juste à l'atelier, où l'autre moitié est la grille ; faux
  partout où l'écran n'est que du réglage. Le pire cas est le panneau **centré** : une ancre
  dans sa moitié gauche est à gauche du milieu de la fenêtre, donc la bulle s'ouvrait vers la
  droite — c'est-à-dire dessus. Une règle de placement se mesure contre **le conteneur qui
  porte l'ancre** ; et ce conteneur se déclare lui-même, sans quoi le composant flottant
  devient l'endroit qu'il faut modifier chaque fois qu'un panneau naît ailleurs. Corollaire
  d'essai, du même piège que ci-dessus : **un recouvrement ne se mesure pas dans jsdom.** Tout
  rectangle y vaut zéro, donc un essai qui monterait l'écran et comparerait les boîtes
  passerait avant la correction comme après — il attesterait d'une règle qu'il ne vérifie
  pas. Le placement sort en fonction pure et s'éprouve sur de vrais rectangles ; l'écran, lui,
  vérifie ce que jsdom sait voir — que les panneaux se déclarent.
- **Un montage Starlette ne reconnaît pas son propre chemin exact.** `Mount("/mcp")` attrape
  `/mcp/…` et **pas** `/mcp` : le chemin exact traverse toute la table de routage et finit
  chez `StaticFiles` monté sur « / », qui répond **405** à un `POST`. Or `/mcp` est
  exactement ce qu'on écrit dans la configuration d'un agent. Le chemin se corrige **avant le
  routage**, jamais par une redirection : un `POST` redirigé n'est pas resoumis par tous les
  clients, et un flux d'événements redirigé se rouvre au mauvais endroit.
- **Le chemin d'un serveur monté est porté par le montage, jamais deux fois.** Le SDK MCP pose
  sa route sur `/mcp` à l'intérieur de son application ; montée elle-même sous `/mcp`,
  l'adresse réelle devient `/mcp/mcp`. On lui donne « / » à l'intérieur.
- **Une assertion négative ne prouve rien d'un protocole.** L'essai qui gardait le branchement
  vérifiait « ni 404, ni page d'accueil ». Les deux défauts ci-dessus rendaient **405** — ni
  l'un, ni l'autre —, et l'essai passait sur un serveur auquel personne ne pouvait se
  brancher. Un protocole se vérifie en **ouvrant une session**, et sur chacune des écritures
  de l'adresse qu'un client utilisera.
- **`Host` est vérifié par le transport MCP, et son défaut est plus étroit que l'usage.** La
  protection contre le réattachement DNS est justifiée pour un serveur qui écoute en local,
  mais le défaut du SDK n'autorise qu'`127.0.0.1` : `localhost` ressort en **421**, un code
  que rien n'explique côté agent. Les deux noms de la boucle locale sont nommés, avec leurs
  ports, et rien d'autre — ouvrir la liste ferait sauter la protection entière.
- **Le SDK MCP retient le texte d'une exception qu'il ne connaît pas.** Délibérément : une
  trace interne ne doit pas partir chez le client. Conséquence — « plafond de la séance
  atteint, relève-le dans l'écran Réglages » devenait « Error executing tool
  generate_asset », et l'agent n'avait plus rien à répéter à l'auteur, alors que c'est
  très exactement ce que les user stories demandent. Un refus du produit se traduit donc en
  refus **attendu** du protocole, comme `CODES` lui donne son code HTTP de l'autre côté.
- **Une seconde convention de rectangle finit par se confondre avec la première.**
  `image/decoupe.py` l'écrit en toutes lettres — une boîte est `(x0, y0, x1, y1)`, inclusive
  aux deux bouts. L'outil `slice_asset` avait été écrit avec `{x, y, largeur, hauteur}` : il
  proposait une forme et en acceptait une autre, ce qui **est** la seconde convention.
- **Une unité relative se résout contre une référence qu'il faut aller lire.** `36em` sur
  l'`<article>` du guide rend **468 px** et non 504 : `em` vaut la taille de *l'élément qui
  l'écrit* — 13 px, hérité — et non celle de la prose qu'il contient, qui fait 15 px.
  `docs/DESIGN.md` annonçait « 504 px, 74 signes » ; l'écran rend 72 signes, ce que son
  propre titre demandait. Le document narrait déjà la même erreur sur `ch` — l'avance du
  zéro — et la seconde a survécu au constat de la première, dans la même décision. Une
  largeur de colonne de texte se **remesure** sur l'écran rendu, jamais depuis l'unité.

- **Une librairie cache ce qu'elle n'a pas mesuré, et elle mesure par `ResizeObserver`.**
  `@xyflow/react` rend `visibility: hidden` tout nœud dont il ignore la taille. Or *un
  `ResizeObserver` ne livre rien à un onglet qui ne compose pas ses images* — troisième fois
  que ce piège se referme ici, après le grisé du zoom en T5 et les transitions en T6 : **toute
  la toile était invisible**, îlots compris, et le rendu HTML était pourtant complet. Aucun
  essai d'écran ne peut le voir, puisque jsdom ne met rien en page et n'applique donc pas la
  règle. Un nœud reçoit ses `width` et `height` — elles sont calculées de toute façon, puisque
  l'étendue d'un îlot est celle de ses membres. Corollaire : le cadrage d'ouverture ne passe
  pas non plus par `fitView`, qui lit les dimensions du même endroit et renonce en silence
  quand elles valent zéro. **Une largeur se lit à la demande.**
- **Un garde peut être juste et son hypothèse fausse.** « Ctrl+Z ne vole pas l'annulation d'un
  champ de saisie » est une bonne règle ; elle suppose que le champ focalisé est un champ où
  l'on est en train d'écrire. Faux ici : l'écran Univers **couvre** l'atelier sans le
  remplacer, et le champ de prompt garde le focus qu'il a pris au démarrage. Le garde voyait
  donc un `<textarea>` actif à chaque frappe et avalait **toutes** les annulations de la toile,
  en silence. Un garde qui interroge le focus doit le borner à l'écran qui le pose — d'où
  `[data-univers]`. On ne tape pas dans un champ qu'un écran recouvre.
- **Le même garde, pris par l'autre bout : un champ focalisé ne dit pas qu'on écrit.**
  Espace ouvre l'aperçu de l'image survolée ; un garde qui écartait la touche dès qu'un
  `<input>` ou un `<textarea>` avait le focus rendait la fonction **entièrement morte dans
  l'atelier**, puisque le champ de prompt prend le focus au démarrage et ne le rend jamais.
  Trouvé au premier essai, qui ne l'a jamais vu s'ouvrir. Un garde de saisie tient donc sur
  *deux* conditions — un champ où l'on peut écrire, **et** que la dernière chose faite ait été
  d'y écrire —, et le geste concurrent le désarme : poser le pointeur sur une image rend la
  touche à l'image, taper un seul signe la rend au champ. Corollaire du même piège :
  **sous un écran posé par-dessus, le garde ne s'applique plus du tout.**
- **La barre d'espace est déjà prise par trois choses, et deux ne se voient pas.** Un
  `<button>` focalisé s'active à l'espace — la tuile qu'on vient de cliquer —, `@xyflow/react`
  en fait son `panActivationKeyCode` par défaut, et une zone qui défile défile. Les trois se
  taisent avec un seul `preventDefault` au bon moment et un réglage de librairie éteint,
  nommé, avec sa raison à côté. Sans quoi une pression fait deux gestes, dont un invisible.
- **Un socle se mesure après ce qu'on y a posé, pas avant.** La disposition d'ouverture cale
  les îlots neufs sous ce qui occupe déjà la toile. Le socle était mesuré avant de compléter
  les îlots *entamés* — ceux dont une seule carte avait été placée à la main —, or ceux-là
  s'étendent vers le bas en accueillant leurs autres membres : les neufs leur rentraient
  dedans. Invisible au banc, parce qu'il faut un tableau où un même groupe mélange des cartes
  posées et des cartes qui ne l'ont jamais été — c'est-à-dire un tableau qu'on a vraiment
  commencé à composer.
- **Ce qu'on lâche, une référence le retient ; ce qu'on montre, un état le rend.** Un
  `pointerup` qui suit son `pointermove` d'assez près lit un rappel fabriqué au rendu d'avant,
  donc une valeur encore nulle — et le geste ne s'écrit pas. La valeur tirée vit donc dans les
  deux : l'état pour rendre la carte à sa largeur vive, la référence pour la poser. Même geste,
  deux lecteurs, deux endroits où la lire.
- **Une librairie cache ce qu'elle n'a pas mesuré — et elle refuse aussi de *relier* ce qu'elle
  n'a pas mesuré.** Quatrième fois que ce piège se referme (T5, T6, T8, T9), et un cran plus bas à
  chaque fois. T8 avait donné à chaque nœud ses `width` et `height` ; il refusait quand même de
  tracer la moindre arête, parce qu'`isNodeInitialized` exige `internals.handleBounds` — mesuré sur
  le DOM des **ancrages**, par le même `ResizeObserver`. Aucun trait ne paraissait, sans un mot. Le
  champ existe pour ça : un nœud porte ses `handles` comme il porte ses dimensions, et la librairie
  s'en sert au lieu de mesurer. Corollaire immédiat : son calcul de position lit `measured`, qui
  vaut zéro pour la même raison, donc le trait partait du **coin supérieur gauche** de chaque objet.
  La formule qui tient les deux : **position mesurée, taille donnée** — la position vient de la
  librairie parce qu'elle bouge pendant qu'on tire, la taille vient du produit parce qu'il la
  calcule de toute façon.
- **Le défaut d'un réglage de librairie prend le geste qu'on voulait.** `zoomOnDoubleClick` et
  `connectOnClick` valent `true` chez `@xyflow/react` 12.11.5 : le premier zoome sur le double-clic
  qui écrit une note, le second arme une liaison sur le clic qui ouvre le menu d'un îlot. Les deux
  sont éteints, **nommés, et la raison est écrite à côté** — un réglage éteint sans phrase se
  rallume à la première mise à jour.
- **Un onglet qui ne compose pas ses images ment aussi sur les couleurs.** Une transition CSS n'y
  avance pas (piège de T6), donc `getComputedStyle` y rend un instant du trajet plutôt que sa fin :
  une couleur qu'on vient de poser s'y lit encore comme l'ancienne. Ce qui se vérifie dans un tel
  onglet est le **style en ligne**, pas la valeur calculée — et une comparaison de teintes à l'œil
  ne s'y fait pas du tout.
- **`getComputedStyle` rend un objet *vivant*.** Le garder pour comparer un avant et un après ne
  compare rien : les deux lectures rendent l'état d'après. Une mesure se prend en **copiant la
  valeur** au moment où on la prend, jamais en gardant la déclaration.
- **Un état qui l'emporte sur un autre ne doit pas l'emporter sur tout.** L'anneau `--lumiere` d'une
  carte choisie l'emporte à juste titre sur sa teinte — mais le faire l'emporter sur le **fond**
  autant que sur le bord rendait la teinte invisible tant que la carte restait choisie, c'est-à-dire
  à l'instant précis où on vient de la choisir : la pastille se clique **depuis le menu de la
  carte**, qui n'est ouvert que parce qu'elle est choisie. Deux vocabulaires qui se disputent une
  surface ne se disputent qu'une **partie** de cette surface.
- **Un événement qui gagne un champ gagne aussi des lecteurs qui ne le concernent pas.** Le message
  `univers` fait redemander l'état et le catalogue depuis T4, parce que promouvoir un artwork change
  ce qui partira. Il porte désormais aussi les teintes d'îlot : colorer un îlot déclenchait donc
  **deux appels réseau pour une couleur**. La règle n'avait pas bougé ; c'est sa condition qui
  manquait, parce que jusque-là « un message `univers` est arrivé » et « l'univers a changé »
  étaient la même chose.
- **Un glissement synthétisé ne démarre pas une gestion de pointeur de librairie.** Ni le nœud
  ni le plan ne bougent sous des `PointerEvent` fabriqués, alors que le même dispatch atteint
  bien la cible et remonte jusqu'à la racine React. Ce qui *est* du produit — un dépôt HTML5,
  une poignée écrite à la main, une touche — se pilote sans peine. **Ce que la librairie tient
  se vérifie à la main, et ça se dit** plutôt que de se laisser croire couvert.

- **Un objet qui voyage par deux routes doit avoir la *même forme* sur les deux.** Le
  personnage de C1 porte des cases déduites — ce qui est fait, ce qui manque —, et seul le
  tableau de bord les mettait dans sa charge : la réponse du `PUT` et l'annonce du flux
  rendaient le même objet **sans** elles. Or l'écran fond ce qu'il reçoit par les deux
  chemins avec le même code (piège de T1, appliqué depuis) : écrire une description
  remplaçait donc un personnage entier par un personnage à trous, la matrice se vidait, et
  le rendu suivant tombait sur `cases.map of undefined` — écran blanc. La fonte par
  identifiant ne protège que de l'empilement ; elle suppose que les deux chemins portent la
  même chose. Une seule fonction compose désormais la charge, et un essai compare les **jeux
  de clés** des trois routes plutôt que leurs valeurs. Constaté le 28 août 2026 au
  navigateur.
- **Un double d'essai écrit d'après l'intention prouve l'intention, pas le serveur.** Le
  défaut ci-dessus a traversé les essais d'écran parce que leur double, lui, rendait les
  cases partout — je l'avais écrit en sachant ce que le serveur *devait* faire. Les essais
  passaient donc au vert sur un contrat que personne ne tenait. Un double se construit à
  partir de ce que la route rend **vraiment** ; quand il en sait plus que le serveur, c'est
  lui qu'il faut croire le moins.
- **La touche synthétisée du volet navigateur n'a ni `key` ni `code`.** Un `keydown` envoyé
  par l'outil arrive bien à l'élément focalisé, `isTrusted` compris, mais avec `key: ""` :
  tout gestionnaire qui teste `e.key === "Enter"` reste muet, et la fonction paraît morte
  alors qu'elle est juste. La saisie, elle, passe par `insertText` — elle produit un
  événement `input`, donc React voit le texte, mais **aucun** événement de touche. Même
  famille que le glissement synthétisé de T10 : *ce que le navigateur tient se vérifie à la
  main, et ça se dit*. Pour éprouver une touche depuis un essai piloté, on envoie un
  `KeyboardEvent` fabriqué avec son `key`.

- **Un garde écrit pour *une* case traverse en silence un appel qui en vise N.** C1 vérifiait la
  case visée avant qu'un centime parte : `viser(projet, personnage, pose or "")`. La ligne est
  juste, et sa relecture ne dit rien — elle *suppose* seulement qu'il y a exactement une pose.
  Le premier lot de C2 est donc parti avec `pose = None`, et le garde l'a refusé en annonçant
  « Le nain ne tient pas la pose «  » » : vingt et un essais rouges d'un coup pour un guillemet
  vide. Ce qui l'avait rendu invisible est que **le garde a raison** — la case *doit* être
  vérifiée —, et qu'un lecteur qui vérifie sa règle ne vérifie pas son arité. Corollaire
  général : *quand un objet passe de un à N, relire tout ce qui le lisait au singulier* — le
  compilateur ne le dira pas, `pose` est resté un champ valide.
- **`tsc -b` est incrémental, et son verdict peut porter sur l'état d'avant.** Après une série
  d'éditions, il a signalé « `zoom` is declared but its value is never read » sur une liaison
  utilisée cinquante lignes plus bas. Suivre le compilateur a **cassé la compilation** — deux
  `TS2304` là où il n'y avait rien. `--force` rend le fichier propre du premier coup. Ce qui
  l'avait rendu invisible est qu'un compilateur passe pour la source de vérité : une erreur
  qu'on ne s'explique pas se corrige au lieu de se vérifier. Un diagnostic incrémental
  surprenant se **rejoue en `--force`** avant qu'on touche au code, et c'est un `npm run build`
  qui fait foi, jamais un `tsc -b` de contrôle.

- **Une plage d'échelles qui enjambe 1,00 fait d'une image inchangée un ajout entier.** Le
  recalage de C3 cherche l'échelle qui fait le mieux retomber ce qui revient sur ce qui est
  parti, en essayant une soixantaine de valeurs. La plage était `linspace(0.55, 1.85, 66)` —
  pas de 0,02, et **1,00 n'y tombe pas** : les voisines sont 0,99 et 1,01. Une case revenue
  rigoureusement identique se retrouvait donc rééchantillonnée d'un centième, son contour se
  décalait d'un pixel sur tout le tour, et la silhouette entière ressortait en *ajout* — 9 %
  du corps « ajouté » sur une image que personne n'avait touchée, et un masque qui ne
  changeait plus rien parce que le calque était déjà partout. Ce qui l'a rendu invisible est
  que **la plage est juste** : elle couvre les deux sens, elle est symétrique à l'œil, et
  aucun de ses trois nombres n'est suspect. Corollaire général : *une recherche discrète doit
  contenir son hypothèse nulle*, et c'est la première chose à vérifier quand un cas « rien
  n'a bougé » ne rend pas exactement rien. Payé le 29 août 2026.
- **Deux recalages successifs mesurent autre chose que ce qu'ils alignent.** Le même jour :
  `recadrer_sur` alignait la case revenue sur le corps, puis `mesurer_calque` en cherchait un
  second sur le résultat déjà aligné. Les deux étaient corrects, et pourtant le calque
  affiché n'était pas celui qu'on venait de mesurer — 216 pixels d'un côté, 146 de l'autre,
  pour la même case. Ce qui l'a rendu invisible est qu'aucune des deux fonctions n'a tort
  isolément : c'est leur **composition** qui perd quelque chose, exactement la famille de
  défaut que T9 avait trouvée en mettant une conception à juger avant la première ligne. Une
  recherche coûteuse se fait **une fois** et rend tout ce qu'elle a trouvé — ici l'image
  alignée, l'échelle et la silhouette retrouvée sortent d'un seul objet.

- **Un critère qui croît avec ce qu'on cherche ne cherche rien.** Le recalage de C3 notait
  chaque échelle candidate à *la part du corps qu'elle recouvre*. La formule est juste, elle
  répond mot pour mot à « que reste-t-il de la silhouette de départ ? » — et elle est
  **monotone** : agrandir le revenu finit toujours par recouvrir tout le corps. Le critère
  demandait donc « quelle est la plus grande échelle ? », et la bonne réponse ne gagnait que
  par l'égalité, à recouvrement rigoureusement parfait. Un aller-retour de rééchantillonnage
  lui coûte deux pour mille de contour ; l'égalité tombait, et une planche revenue **intacte**
  était déclarée revenue à 0,58× — le calque valait toute la silhouette au lieu du seul
  casque. Ce qui l'a rendu invisible est que la mesure était **bonne** et le résultat
  plausible : 1,71× recouvre bien 100 % du corps, et rien dans le chiffre ne dit qu'il a été
  choisi pour sa taille. Les essais ne l'ont pas vu parce qu'ils dessinaient des blocs pleins,
  qui traversent un rééchantillonnage sans perdre un pixel — l'égalité tenait, et le
  départage à « l'échelle qui bouge le moins » sauvait la mise. **Ce qu'on rend n'est pas ce
  qui doit servir à chercher** : on cherche sur le recouvrement rapporté à l'**union**, qui
  pénalise ce qui déborde, et on rend la couverture au placement retenu. Corollaire général :
  *une note qui ne peut que monter avec le paramètre qu'on optimise n'est pas un critère,
  c'est un classement du paramètre* — et le vérifier coûte une colonne dans un tableau. Trouvé
  à l'usage le 29 août 2026, sur le premier casque envoyé, après deux appels payés.

- **Une image dérivée d'une autre casse quand celle d'en face change de taille.** Le calque de
  C3 est taillé dans le cadre du corps *tel qu'il était au dépliage*, et son rendu relit le
  corps à chaque fois. Relever la cible de pixel d'un projet rend le corps à une autre taille :
  les deux tableaux ne se superposent plus, `opaque_corps & opaque_revenu` lève, et la route de
  l'image répond **500** — donc un calque qu'on ne peut plus ni voir ni retoucher. Ce qui l'a
  rendu invisible est le **cache** : tant que la recette du calque ne bouge pas, son rendu est
  servi depuis le disque et personne ne recalcule rien. Le défaut dort donc entre le jour où la
  cible change et le premier geste qui touche la recette — ici l'arrivée de C4, qui a ajouté
  deux places et fait recalculer tous les calques d'un coup. Corollaire général : *un cache
  cache aussi les pannes du calcul qu'il remplace*, et une donnée dérivée d'une **autre**
  donnée mutable doit dire ce qu'elle fait quand celle-ci a bougé. Ici : un corps qui a changé
  de taille est traité comme un corps disparu — le calque redevient sa case, la différence
  reste dans la recette, et le rejeu du recalage (R5) retaille depuis la planche payée.
  Rééchantillonner le corps pour le faire tenir aurait été pire : ça fabrique une différence
  que personne n'a demandée, ce que tout C3 refuse. Trouvé le 29 août 2026 en ouvrant C4 sur
  `coeur de pierre - 01`.

- **Une ellipse de taille nulle ne peint aucun pixel.** Le pinceau de C4 pose un disque à
  chaque point du chemin — `ellipse([x-r, y-r, x+r, y+r])` — et relie les points par un trait
  large. À rayon nul, les deux coins de la boîte se confondent, et Pillow ne dessine **rien** :
  le geste au pixel, qui est un point seul de rayon zéro, ne marquait aucun pixel. Ce qui l'a
  rendu invisible est qu'un rayon nul sur un chemin de *deux* points marchait très bien — la
  ligne, elle, se dessine —, donc la fonction rendait le bon masque partout sauf sur le cas
  d'un seul point. Corollaire général : *un cas dégénéré d'une primitive de dessin ne se déduit
  pas de son cas général*, et le seul moyen de le savoir est de compter les pixels. `point()`
  pour le rayon nul, `ellipse()` au-delà. Payé en écrivant les essais de C4, le 29 août 2026 —
  et c'est très exactement ce que le premier essai devait trouver.

- **Le double d'écran ouvre toujours sur `ETAT`, pas sur ce que le test a demandé.** Un essai
  d'écran passe son état au serveur double (`serveurDouble({ agent })`), mais c'est
  `monter(fetchDouble)` qui pose l'état initial, et il émet la constante `ETAT` du module sur
  le flux. Le réglage demandé arrive donc **au double** — les routes répondent avec — et
  **jamais à l'écran**, qui garde celui d'un atelier neuf. Ce qui l'a rendu invisible est que
  la moitié des essais passent quand même : ils n'interrogent que des routes. Le premier à
  tomber est celui qui lit un réglage *à l'écran* — ici le bouton de sortie de C5, grisé parce
  que `dossier_jeu` valait toujours `""`. Corollaire général : *deux chemins posent l'état d'un
  écran, et le second écrase le premier.* Le geste qui répare est aussi le meilleur essai :
  émettre le réglage sur le flux (`flux.emettre("agent", …)`) et vérifier que le bouton
  s'allume **à l'instant** — ce que R1 demande de toute façon. Payé en écrivant les essais
  d'écran de C5, le 29 août 2026.

- **Une fixture pytest ne s'importe pas avec la fonction qui s'en sert.** `test_c5` réemploie
  `appeler` et `refuser` de `test_t7` ; la fixture `mcp`, qui vit dans le même fichier, reste
  invisible tant qu'elle n'est pas **nommée** dans l'import — pytest ne la cherche que dans le
  module de l'essai et dans les `conftest`. L'erreur est lisible (« fixture 'mcp' not found »)
  mais elle arrive à la *collecte*, donc neuf essais tombent d'un coup sans qu'aucun n'ait
  tourné, ce qui ressemble à une casse du montage. `from tests.test_t7 import appeler, mcp,
  refuser  # noqa: F401`, et le `noqa` dit à qui relit que l'import inutilisé est le mécanisme.
  Payé en écrivant les essais de C5, le 29 août 2026.

- **Un écran qui reconstruit un objet à partir de son propre message en efface les champs
  qu'il ne connaît pas.** Le barème envoie la famille, l'occupation et la silhouette d'un type
  d'objet ; depuis E9, ce type porte aussi sa liste de poses, réglée ailleurs et par une autre
  route. `Echelle.depuis_json` d'un message qui n'en parle pas rend `poses=None`, et un simple
  déplacement de curseur vidait donc la liste. **Ce que le message ne dit pas, il ne l'efface
  pas** : le service relit ce que le fichier gardait et le repose. C'est la troisième fois que
  le motif se paie — poster une recette effaçait la différence d'un calque (E5), nommer une
  recette la stockait avec la différence de l'image d'où elle venait (E5) —, et il porte
  toujours la même signature : **un message partiel traité comme un objet entier**. Vu en
  écrivant E9 avant qu'un utilisateur ne le paie, le 31 août 2026.

- **Le banc du corpus ne lit que des titres Markdown : un « § » qui vise une maquette HTML est
  cassé par construction.** `essais/essai_docs.py` bâtit la liste des sections d'un document en
  cherchant des lignes qui commencent par `#` ; une maquette de `docs/maquettes-v2.1/` n'en a
  aucune, donc **zéro section**, donc tout renvoi qui nomme une de ces maquettes *puis* un
  signe § et un titre ne résout jamais — quel que soit le titre visé, et même si le `<h2>`
  existe mot pour mot. (L'exemple n'est pas écrit ici tel quel : il se casserait à son tour,
  et le banc le compterait.) Ce qui l'a rendu invisible est que
  l'erreur ressemble à une faute de frappe : le banc dit « aucun titre ne répond à … », et on
  cherche le bon titre au lieu de comprendre qu'il n'y en a aucun. Le geste qui répare est de
  **nommer le fichier sans `§`** et de laisser la phrase dire ce qu'on y cherche —
  `atelier/domaine/vue.py` le fait déjà. Payé trois fois en écrivant E10, le 31 août 2026 ;
  un quatrième cas dort dans `docs/vignettes-vues.md`, qui n'est pas versionné.

- **Deux médianes calculées à deux endroits annoncent deux prix pour le même appel, et rien ne
  le signale.** L'écran de la planche lisait le banc versionné du dépôt ; la barre qui paie,
  trois centimètres plus bas dans la même fenêtre, lisait le journal de la machine. Ils ont
  affiché `$0,0128` et `$0,0160` côte à côte, tous les deux justes, tous les deux « le prix d'un
  appel ». Ce qui l'a rendu invisible est qu'**aucun essai ne peut le voir** : chacun des deux
  chiffres est correct pris seul, et il n'existe pas d'assertion qui dise « ces deux nombres
  parlent de la même chose ». Il a fallu ouvrir l'écran. Le geste qui répare est de faire lire
  **la même source** aux deux — le journal d'abord, le banc en repli —, et de **nommer** ce que
  le chiffre mesure quand les deux ne peuvent pas être la même chose : ici le modèle, parce que
  le jeu en désigne un pour ses planches et que la barre garde celui que l'auteur a choisi.
  Payé en écrivant E13, le 31 août 2026.

- **Une conclusion tirée d'un corpus et affichée à côté d'un autre corpus se retourne contre
  celui qui l'écrit.** Le même écran affirmait *« un appel a coûté de $0,0342 à $0,0342 :
  l'écart entre deux appels identiques dépasse l'écart entre deux tailles de planche »*. La
  phrase venait du banc — dix-huit appels, de $0,0128 à $0,0534 — et les chiffres qu'elle citait
  venaient du journal de la machine, où les deux seuls appels connus avaient coûté exactement le
  même prix. **La phrase démentait ses propres nombres**, dans la même ligne. Ce qui l'a rendu
  invisible est que la phrase était vraie, et que les nombres l'étaient aussi : c'est leur
  rapprochement qui mentait. Le geste qui répare : **une phrase se cite avec les nombres qui la
  portent**, donc le banc est rendu à côté du prix affiché et c'est lui que la phrase nomme.
  Payé dans la même heure que le précédent, en regardant l'écran plutôt que les essais.

- **Un `**mesure` étalé dans un dictionnaire écrase les clés qu'on venait d'y poser, et le
  compte tombe à zéro sans que rien ne lève.** L'écran de confirmation rend un prix qui porte
  son nombre d'appels ; la mesure qui le fonde porte, elle aussi, un nombre d'appels — le
  nombre d'appels *payés* sur lesquels la médiane repose. Deux sens du même mot dans le même
  dictionnaire, et l'étalement de la seconde a remplacé le premier par le second. **Aucune
  erreur nulle part** : les deux clés existent, les deux valeurs sont des entiers, et l'écran a
  affiché « 0 appel » pour un appel qui allait partir. Ce qui l'a rendu invisible est que le
  code se lit bien — `{"appels": n, **mesure}` a l'air d'ajouter, alors qu'il remplace. Le geste
  qui répare est de **ne jamais étaler une mesure dans l'objet qu'elle mesure** : elle devient
  une clé à elle, `"mesure": mesure`, et les deux sens du mot cessent de se disputer la même
  place. C'est la leçon de E13 rejouée à un cran plus fin — *une phrase se cite avec les nombres
  qui la portent*, et pas fondue dedans. Payé en écrivant E14, le 31 août 2026.

- **Un champ prérempli par le serveur écrase ce qu'on vient de taper, et l'essai qui tape trop
  tôt échoue sans dire pourquoi.** Armer une case demande son signalement au serveur et le pose
  dans le champ. Une chose sans signalement y pose une **chaîne vide** — ce qui est la vérité —,
  et un essai qui écrit dans le champ avant que la réponse revienne se le fait effacer. Le
  bouton qui paie redevient gris, l'écran de confirmation ne s'ouvre pas, et le message dit
  seulement « bouton introuvable ». Ce qui l'a rendu invisible est que **le symptôme est en aval
  de deux gestes** : on cherche pourquoi l'écran ne s'ouvre pas, pas pourquoi le champ est vide.
  Le geste qui répare est d'attendre un signe que la réponse est **arrivée** — ici la ligne de
  provenance, posée dans le même geste que le texte — et non un délai, ni l'état du bouton, qui
  est gris avant comme après. Payé trois fois dans les essais d'écran de E14, le 31 août 2026.

- **Le même piège se rejoue à un clic d'écart dès qu'un écran s'intercale, et
  corriger la source ne suffit pas.** E13 avait fait lire **la même source** aux
  deux prix d'un même écran. E14 a intercalé l'écran de confirmation entre la
  barre qui paie et la dépense — et les deux ont annoncé **$0,0160 et $0,0064
  pour le même appel**, mesuré au navigateur sur le vrai projet le 31 août 2026.
  La source était pourtant la même : la barre rendait la **médiane de tous** les
  appels de ce modèle, images jointes ou non, et l'écran comptait celles de cet
  appel-ci. **Deux questions différentes posées à la même mesure**, et les deux
  réponses justes. Ce qui l'a rendu invisible est que 670 essais serveur et 390
  essais d'écran passaient : aucun ne compare deux nombres rendus par deux routes
  différentes, et le double d'essai facturait un **prix plat**, où la médiane et
  le prix de base sont le même nombre — les deux écrans tombaient d'accord par
  accident. Le geste qui répare est double : faire descendre le **compte d'images
  qui partiront** dans le calcul de la barre, et donner au double un levier de
  prix qui varie (`FournisseurDouble.couter`), sans quoi l'essai qui compare
  passerait à vide. La leçon générale : **une source unique ne suffit pas si deux
  appelants lui posent des questions différentes** — il faut aussi qu'ils
  décrivent le même appel.

- **Un écran qui vit dans un magasin de module reste ouvert d'un essai à l'autre, et ce sont
  les *autres* essais qui échouent.** Le guide s'ouvre depuis n'importe où, donc son état vit
  hors de React — le même patron que le repli du châssis. `cleanup()` démonte l'arbre ; il ne
  touche pas au magasin. Un essai qui ouvrait le guide et ne le refermait pas faisait donc
  échouer **treize essais sans aucun rapport**, qui cherchaient leur texte dans une page de
  prose qui parle de tout le produit — et le message disait « plusieurs éléments trouvés »,
  jamais « le guide est ouvert ». Ce qui l'a rendu invisible est que le fichier d'essais avait
  déjà `reinitialiserGuide()` **dans son `beforeEach`** : la précaution existait, elle était du
  mauvais côté. Le geste qui répare est de refermer **en sortant** aussi — un état global se
  rend, il ne se reprend pas. Payé en écrivant E20, le 31 août 2026.

- **`36em` posé sur un bloc qui n'a pas dit sa taille se résout sur la taille du corps, et une
  borne de lisibilité rate son but d'un cinquième sans que rien ne paraisse.** La colonne de
  prose du guide est bornée à `36em` — la seule largeur maximale du produit, et sa raison est
  un nombre de signes par ligne, pas une esthétique. Le bloc héritait les 13 px du corps alors
  que sa prose s'écrit à 15 : 468 px au lieu de 540, **61 signes au lieu de 70**. Ce qui l'a
  rendu invisible tient en une phrase : **une colonne trop étroite ne se remarque pas, elle
  fatigue** — c'est le seul défaut de mise en page dont le symptôme n'est pas visuel. Et les
  deux documents qui la décrivent annonçaient 504 px et 74 signes, un chiffre juste calculé sur
  une avance mesurée à 13 px puis appliquée à une prose de 15 : **une mesure prise à une taille
  ne se cite pas à une autre**. Le geste qui répare est d'écrire la taille sur le bloc qui porte
  la borne, pour que le `em` soit celui de ce qu'on lit. Payé en écrivant E20, le 31 août 2026,
  et trouvé en mesurant l'écran — aucun essai ne pouvait le voir.

- **Un essai dont l'énoncé est plus large que la propriété qu'il défend échoue au bord, et le
  réflexe est alors de corriger le code.** L'essai de la pipette affirmait qu'*aucune* valeur de
  tolérance du moteur du bord n'atteint un creux de fond enfermé par le sujet. Il tombait à la
  valeur maximale — le creux part —, et il avait raison de tomber : à cette tolérance-là le
  moteur a d'abord mangé la matière qui enfermait le creux, et il ne reste plus rien du tout. Un
  détourage qui efface l'image entière n'a « atteint » rien du tout. **Le code était juste, la
  phrase était trop grande.** Le geste qui répare n'est pas de retirer la valeur qui gêne — ce
  qui aurait laissé un essai qui vérifie quatre points choisis à la main — mais d'écrire la
  propriété à l'endroit exact où elle vaut : *tant que la matière tient, le creux tient avec
  elle*, vérifié sur les deux cent vingt tolérances où c'est le cas. La leçon générale :
  **quand un essai tombe à une valeur extrême, se demander d'abord si l'extrême est encore dans
  le domaine de la phrase.** Payé en fermant E3, le 31 août 2026.

- **`uvicorn.run` avale l'échec de liaison : le processus sort avec le code 0 alors que rien
  n'a démarré.** Il journalise l'erreur en `ERROR`, éteint proprement l'application et rend la
  main — sans lever quoi que ce soit. Un lanceur qui se fie au code de sortie conclut donc au
  succès. Combiné à une bannière `Asset Kitchen — http://…` imprimée **avant** l'appel, la
  dernière ligne visible annonçait une adresse qui ne répondait pas, et le navigateur s'armait
  quand même. L'auteur voyait sa fenêtre s'ouvrir et se refermer en une seconde, sans rien de
  lisible. Le geste qui répare tient en trois : **ne rien annoncer avant que le port soit
  tenu** — on parle depuis un fil qui attend `serveur.started` —, **relire `serveur.started`
  après `run()`** plutôt que de croire le retour, et **regarder le port avant de le demander**,
  ce qui transforme le cas courant en réponse utile plutôt qu'en panne. Signalé par l'auteur le
  31 août 2026.

- **Un serveur qui tourne depuis trois heures servant une interface recompilée à l'instant est
  invisible, et c'est le pire des deux mondes.** Le lanceur du bureau recompile l'interface dès
  qu'une source bouge — mais il ne redémarre jamais le serveur, et sa branche « un atelier
  tourne déjà » se contentait d'ouvrir l'onglet puis de disparaître en deux secondes. Le
  résultat : une interface neuve qui parle à un serveur périmé, sans que rien le dise, et un
  auteur convaincu que son lanceur a planté. Ce qui l'a rendu invisible est qu'**aucune des
  deux moitiés n'est en panne** : chacune fonctionne, c'est leur écart qui ment. Le geste qui
  répare est de comparer l'heure de démarrage du processus à la date des sources — trois lignes
  de PowerShell — et de **retenir la fenêtre** quand la réponse est mauvaise, parce qu'une
  explication qu'on n'a pas le temps de lire n'existe pas.

- **Une clé de série composée de champs vides confond tous les cas « aucun », et c'est de
  l'argent.** L'écran de confirmation se saute *pour la série en cours* — une chose du jeu et
  une pose —, et la clé était `chose|poses|pièce` mise bout à bout. Sans chose visée, les trois
  morceaux sont vides : **toutes** les générations écrites à la main partageaient donc la clé
  `||`, dans tous les jeux. Cocher la case une seule fois éteignait l'écran pour chacune
  d'elles jusqu'au rechargement de l'onglet, et le clic suivant sur *Générer* partait droit à
  la dépense, en silence. C'était très exactement la case « pour toujours » que le produit
  s'interdit, atteinte par accident. Ce qui l'a rendu invisible est **un essai qui passait pour
  la mauvaise raison** : il vérifiait le saut sans jamais armer de case, c'est-à-dire sur ce
  chemin-là précisément — et il cachait du même coup que la case ne fonctionnait *pas* pour une
  vraie série, puisque payer désarme la cible. Le geste qui répare : **une clé absente vaut
  `null`, jamais une chaîne vide**, et le contrôle qui la consomme n'est pas offert quand elle
  est absente. Signalé par l'auteur et payé en argent réel, le 31 août 2026.

- **On peut payer depuis un écran qui ne montre pas ce qui part, et l'on recliquera.** Le
  chantier — ce qui est acheté, pas encore arrivé — tenait sa place dans la grille de la
  galerie, avant même que l'image existe. Mais depuis E2 on paie aussi depuis le codex et
  depuis l'établi, et là rien ne bougeait : l'auteur dépensait, l'écran restait immobile,
  et le geste naturel est de recliquer. La leçon générale : **partout où l'on peut dépenser,
  quelque chose doit dire que la dépense est partie** — et l'endroit existait déjà, c'est la
  fente sous le bouton, qui accueille un locataire à la fois. Trouvé en réparant le piège
  ci-dessus, le même jour, dans le même signalement.

- **Une mesure peut chercher l'exact inverse de ce qu'elle annonce, et son zéro passe pour une
  bonne nouvelle.** Le panneau du détourage écrivait « N poches de fond enfermées » en lisant
  les zones *transparentes* que le sujet entoure. Or ce que le remplissage depuis le bord
  n'atteint pas reste **opaque** — c'est la définition même de « il ne l'atteint pas ». La
  mesure ne trouvait donc la poche qu'*après* que la pipette l'eut retirée, c'est-à-dire au
  moment où il n'y avait plus rien à proposer. **Zéro sur les soixante images du dépôt**, là où
  la mesure juste en trouve quarante-trois par image en médiane. Ce qui l'a rendu invisible est
  qu'un bloc qui n'apparaît jamais ne se remarque pas : il n'y a pas d'écran vide à voir, il n'y
  a rien du tout, et le critère qui le portait était coché. Les essais ne pouvaient pas le voir
  non plus — ils construisaient l'image *avec* le trou déjà transparent, ce qui est le seul état
  où la fonction et sa phrase coïncident. Le geste qui répare est de **partir de l'image que le
  produit fabrique vraiment** : détourer d'abord, puis mesurer, comme l'auteur le fait. Payé en
  fermant E3, le 31 août 2026, en vérifiant la pipette sur les vraies images plutôt que sur
  l'anneau des essais.

- **Un plafond de liste posé après la description coûte cinquante-six secondes pour rendre
  deux cents éléments.** Décrire une zone connexe — sa boîte, sa couleur moyenne, un point
  dedans — coûte trois balayages de l'image entière. La liste des taches les décrivait *toutes*
  puis coupait : sur l'image la plus bruitée du dépôt, seize mille zones sur mille pixels de
  côté, cela faisait **56 s** pour deux cents lignes affichées. L'aire, elle, sort gratuitement
  du remplissage par plages. Trier dessus, couper, **puis** décrire rend la même liste en
  138 ms. La leçon est générale et vaut pour toute liste plafonnée : **le plafond doit tomber
  avant le travail, pas avant l'affichage.** Payé en fermant E3, le 31 août 2026, sur une mesure
  neuve — et la même faute dormait dans une mesure vieille de toute l'étape.

- **Une fonction privée renommée passe la vérification de types et tombe à l'exécution, dans le
  fichier même qu'on vient de relire.** `_remplir_depuis_le_bord` a été ouverte en `_remplir`
  pour que la pipette réutilise le remplissage par plages au lieu d'en écrire un second. Une
  recherche dans le dépôt avait été faite — mais *après* l'édition, sur le nom neuf. Le second
  appelant, à quatre cents lignes de là, était le contour qui laisse les trous : il fait
  exactement le même travail sur le masque inversé, ce qui est la raison même pour laquelle il
  partageait la fonction. Python ne dit rien avant l'appel, et l'appel n'a lieu que sur une
  option précise d'une place précise — **deux essais sur six cent soixante-dix**, dans un fichier
  d'une autre étape. Le geste qui répare est de chercher les appelants **sur l'ancien nom, avant
  de renommer**. Payé en fermant E3, le 31 août 2026.

- **Une bibliothèque de style peut retirer un comportement du navigateur sous les pieds du
  produit, et rien ne le dit.** Tailwind v4 a retiré le `cursor: pointer` que le navigateur
  posait sur un bouton. Aucune ligne du dépôt ne l'avait demandé, aucun test ne pouvait le voir
  — un curseur ne se rend pas dans jsdom —, et l'écran continue de fonctionner parfaitement :
  **c'est le signal qui disparaît, pas la fonction**. Mesuré au navigateur le 31 août 2026 sur
  la galerie : trente-huit boutons, trente-huit flèches ordinaires, aucune main. Il mord plus
  fort dans ce produit qu'ailleurs, parce que le châssis est volontairement muet — pas de
  relief, pas de cadre de rangée, pas de couleur d'appel — et que le curseur était donc le
  dernier indice restant de ce qui répond au clic. Ce qui l'a rendu invisible est qu'on ne
  regarde pas son propre curseur : on sait où l'on clique. Le geste qui répare tient en une
  règle dans `interface/src/index.css` ; **la leçon générale est qu'une montée de version
  majeure d'une bibliothèque de style se relit sur ses *retraits*, pas seulement sur ses
  ajouts.** Payé par l'audit de design du 31 août 2026 (`docs/audit-design-post-v21.html`).

- **Un `getBoundingClientRect` ne sait pas qu'un élément est rogné, et fait passer un
  débordement pour un recouvrement.** En mesurant la barre d'outils de la galerie, deux groupes
  de boutons paraissaient se dessiner l'un par-dessus l'autre — le rectangle de
  *Désélectionner* chevauchait celui de *brute* de 92 px. Ils ne se recouvraient pas : le
  premier groupe porte `overflow-x: auto`, et le rectangle rendu par le navigateur est celui de
  la **mise en page**, pas celui de ce qu'on voit. Le défaut était réel — un contrôle
  inatteignable —, mais sa cause était l'inverse de celle qu'on lisait, et la correction qu'elle
  suggérait (un retour à la ligne) aurait grandi une bande dont le § Layout interdit de changer
  la hauteur. Le geste qui répare la **mesure** est de comparer le rectangle de l'élément à
  celui de son cadre de défilement, ou de lire `scrollWidth` contre `clientWidth`. Payé le
  31 août 2026, en corrigeant l'audit de design.

- **Le nom accessible d'un bouton ne descend pas chercher l'étiquette de ses enfants.** La
  pastille de l'onglet Galerie portait son explication en propre — `aria-label="2 images en
  route"` sur le petit rond — et l'onglet s'annonçait quand même « Galerie 2 » : un nombre sans
  son unité, c'est-à-dire la seule chose de la barre qu'on ne pouvait pas comprendre en
  l'écoutant. Le calcul du nom d'un élément **à partir de son contenu** prend le texte des
  descendants, pas leur étiquette ; celle-ci ne sert qu'à nommer l'enfant lui-même, que personne
  ne visite. Le geste qui répare est de porter le nom entier **sur le contrôle**, et de taire la
  marque visuelle avec `aria-hidden`. La leçon générale : **une décoration qui porte du sens
  doit rendre son sens au contrôle, jamais le garder pour elle.** Et elle vaut au-delà de
  l'accessibilité — c'est aussi ce qui a fait échouer l'essai, qui cherchait l'onglet par son
  nom et ne l'a plus trouvé. Payé le 31 août 2026, en réparant le retour de génération.

- **Un nœud du navigateur capturé avant qu'un écran s'ouvre ne sert plus après qu'il se
  ferme.** L'essai gardait le champ de prompt dans une variable, ouvrait l'écran de
  confirmation, payait, puis vidait le champ pour vérifier qu'un refus reprenait la fente — et
  rien ne se passait. La barre de prompt est **démontée** pendant que l'écran de confirmation
  couvre l'atelier : après paiement, le champ est un nœud neuf, et l'ancien flottait hors de la
  page, où un événement n'atteint plus rien. Rien ne lève : l'essai échoue trois lignes plus
  loin, sur une assertion qui semble parler d'autre chose. Le geste qui répare est de
  **redemander le nœud après tout ce qui démonte l'écran**. Payé le 31 août 2026, en réparant le
  retour de génération.

- **Un commentaire qui justifie un raccourci par une vérité d'aujourd'hui devient un mensonge
  sans que rien ne bouge.** L'écran des dépenses coupait le nom d'un modèle avant la barre
  oblique — `openai/gpt-image-2` devenait `gpt-image-2` — et le commentaire disait pourquoi :
  *le fournisseur est le même pour tous, il ne distingue rien*. C'était exact tant qu'il n'y en
  avait qu'un. Le jour où un second est entré, la ligne de code n'avait pas changé, le
  commentaire non plus, et le journal des dépenses s'est mis à afficher deux modèles
  indiscernables — sur l'écran dont la question est précisément *où va mon argent*. Ce qui rend
  ce piège invisible est que **le commentaire a l'air d'un aveu de prudence** : on le lit, on le
  trouve honnête, on passe. Le geste qui répare est de chercher, avant d'élargir une hypothèse
  du produit, **les endroits qui l'ont écrite comme une raison** — `grep` sur les mots de
  l'hypothèse trouve du commentaire, pas du code, et c'est justement là qu'elle se cache. Trois
  phrases du produit sont tombées de la même façon le même jour — *sans clé, le bouton qui paie
  reste éteint*, dans la barre de tête, dans l'assistant et dans le guide. Payé le
  1<sup>er</sup> septembre 2026, en faisant entrer un second fournisseur (F1).

- **Le cache d'un fournisseur rend l'image et tait tout le reste.** Le banc gratuit de
  Pollinations a annoncé, en une phrase et sans rien d'autre, que l'adaptateur avait cessé de
  refuser un modèle inventé. Il n'avait rien cessé : le banc redemandait **la même phrase** à
  chaque lancement, et le fournisseur la servait de son cache en 0,2 s au lieu de 25 —
  `x-cache: HIT`, et **aucun de ses deux en-têtes**. Ni celui qui dit quel modèle a répondu, ni
  celui qui dit ce que l'appel a consommé. Le garde du modèle ne peut donc pas se déclencher, et
  le compte de consommation lit du vide. Deux choses rendent ce piège coûteux. La première est
  que **l'échec ressemble exactement à une régression du code** : la phrase imprimée est celle
  qu'on a écrite pour le mauvais jour, et rien ne dit que la réponse vient d'ailleurs. La
  seconde est que **la durée était la preuve, et personne ne la lit** : 0,2 s pour une image que
  ce fournisseur met une demi-minute à faire n'est pas une bonne surprise, c'est un aveu. Le
  geste qui répare tient en une ligne — **un banc qui mesure un fournisseur demande une phrase
  que personne n'a demandée**, ici le sujet suivi de l'horodatage. Et la leçon générale vaut
  au-delà : *une réponse plus rapide que la mesure connue n'est pas la même réponse.* Payé le
  1<sup>er</sup> septembre 2026, en enregistrant ce qu'un appel consomme (F2).


- **Une garde qui reconnaît un fichier par ce qu'il contient devient un refus quand le contenu
  change.** Le lecteur du `.env` doit deviner son encodage — PowerShell écrit en UTF-16 avec
  `>` et `Out-File`, et c'est un piège déjà payé en T1. La façon dont il devinait était de
  garder le premier décodage **qui contenait `OPENROUTER_API_KEY`** : imparable tant qu'il
  n'existe qu'un secret au monde, et rien n'en signalait le prix. Le jour où un fournisseur en
  demande deux autres, un fichier qui ne porte que ceux-là n'est plus reconnu comme un `.env`
  du tout — **il est illisible en entier**, et le produit annonce *aucun jeton* sur un fichier
  qui en porte un. Ce qui rend le piège coûteux est le moment : la panne se serait présentée
  le jour de F4 comme un problème de Cloudflare, alors qu'elle attendait dans un module que
  personne n'aurait ouvert. Le geste qui répare : **décoder au premier encodage qui accepte
  les octets**, et laisser l'ordre des tentatives faire le reste — une garde sur la *forme*,
  jamais sur le *contenu*. Payé le 1<sup>er</sup> septembre 2026, en passant le tiroir à clés
  au pluriel (F3).

- **Un message qui n'a pas d'endroit où s'écrire est compté et jamais lu.** L'écran de
  confirmation annonce en tête *« N avertissements — non bloquants, écrits sur la ligne
  concernée »*, et c'est vrai des avertissements qui portent la clé d'une ligne de prompt. Ceux
  du bloc d'images n'en ont pas : ils étaient rendus **par aucun chemin**. On lisait « 1
  avertissement » et l'on cherchait où — trois d'entre eux, dont deux écrits en E14, ont vécu
  ainsi jusqu'au 1<sup>er</sup> septembre 2026. Rien ne pouvait le signaler : le compte est
  juste, la liste est complète, et le seul symptôme est une phrase d'en-tête qui promet ce que
  personne ne rend. Le geste qui répare est de **rendre un message là où vit ce dont il
  parle**, et la garde qui l'aurait trouvé est plus simple encore : *un compte affiché sans
  l'objet qu'il compte est une promesse à vérifier.* Trouvé en même temps, et de la même
  façon, un sommaire qui annonçait « 1 sur 0 » — il comptait *ce qui est coché sur les places
  du modèle*, c'est-à-dire un compte sur une **capacité**, ce qui se lit bien tant que la
  capacité dépasse le compte et devient une contradiction dès qu'elle vaut zéro. Payé le
  1<sup>er</sup> septembre 2026, en rendant le brouillon de l'agent gratuit (F6).

- **Un seuil qui porte le nom d'une grandeur et en compare une autre laisse passer les cas
  dégénérés.** `zones_opaques` reçoit `cote_min`, et son commentaire l'explique très bien : le
  nom est en **côté** parce que c'est ce que l'auteur voit — *ignore ce qui fait moins de seize
  pixels* —, la comparaison est en **aire** parce qu'une lance de 4 × 200 a un petit côté
  minuscule et reste un sujet. Les deux moitiés sont justes, et l'écart entre elles est un trou :
  une rangée de 1 024 × 1 pèse 1 024, largement au-dessus des 256 du réglage par défaut, et
  passe. Trouvé le 1<sup>er</sup> septembre 2026 en ouvrant la découpe sur l'artwork de
  l'auteur — sa toute première rangée est sombre là où son fond est gris clair, un liseré de
  cadre, donc le détourage la garde à juste titre, et l'écran proposait **cinq rectangles pour
  quatre nains**. Rien ne pouvait le signaler : la détection ne lève jamais, le liseré est un
  vrai résultat, et le seul symptôme est un rectangle de trop que l'œil ne voit pas sur une
  image de mille pixels. La garde qui l'aurait trouvé : *quand un seuil compare autre chose que
  ce que son nom dit, demander ce que l'autre grandeur laisse entrer.* Ici, tout ce qui est long
  et plat. Un plancher d'épaisseur s'est ajouté à côté du rejet par l'aire — il n'écarte que ce
  qui n'a pas d'épaisseur du tout, et la lance reste un sujet.

- **Une image agrandie au-delà de seize mille pixels ne s'affiche pas, et rien ne le dit.** La
  maquette V3 animait ses deux boucles en étirant une planche de cent vingt et une images posées
  côte à côte : à la taille d'affichage, cela demandait au navigateur une surface de cinquante
  mille pixels de large. Les navigateurs plafonnent une surface à seize mille trois cent
  quatre-vingt-quatre pixels de côté, et **au-delà ils ne dessinent rien** — pas d'erreur, pas
  d'avertissement, une zone vide. Le symptôme était une page noire à mi-hauteur alors que la
  console était propre et que tous les éléments avaient les bonnes dimensions. La garde : *une
  planche d'images se range en grille, jamais en ligne*, et ce qu'on dessine se découpe dedans à
  sa taille réelle au lieu d'être agrandi avant. Onze sur onze tient dans mille trois cents.
  Payé le 3 septembre 2026, en montrant la V3.

- **Une page qui redessine sans arrêt ne se laisse pas photographier.** Le même jour, et il
  s'ajoute au précédent parce qu'ils se ressemblent à l'œil : une maquette dont le métronome
  redessine deux zones dix fois par seconde rend des captures noires, le navigateur n'ayant
  jamais fini de peindre quand on le photographie. Ce n'est pas un défaut de la page — elle est
  juste à l'écran. La garde : *toute page animée du dépôt sait s'arrêter*, par une adresse
  (`?fige`) et par la barre d'espace, et **elle cesse alors vraiment de dessiner** plutôt que de
  redessiner la même image. Les deux ensemble ont coûté une demi-heure à départager, l'un
  imitant l'autre.

- **La vignette découpée est opaque partout, sur toutes les planches.** R6 devait distinguer une
  planche saine d'une planche dont le modèle a redessiné le quadrillage, et la mesure évidente —
  *quelle part de la vignette reste opaque après détourage ?* — rend **1,00 des deux côtés**.
  Elle ne sépare rien, et elle a failli faire écrire le mauvais chiffre dans le plan. La raison
  est que `decouper` taille dans les **octets d'origine**, fond compris, marge comprise : ce qui
  en sort est un rectangle plein par construction. La mesure qui sépare est la part opaque de la
  **boîte du sujet**, prise sur l'alpha du détourage — 0,34 à 0,77 pour une planche saine, 0,99
  à 1,00 pour une planche quadrillée, rien entre les deux sur les 135 planches des bancs. La
  garde : *une mesure de remplissage se prend sur l'alpha, jamais sur un fichier découpé*. Payé
  le 3 septembre 2026.

- **Un état qui attend une décision n'est ni « en cours » ni « raté », et il disparaît de
  l'écran.** Le chantier de la galerie est *ce dont un emplacement attend encore une issue* —
  en attente, en cours, interrompu. R6 a créé un quatrième cas : une planche arrivée, payée,
  entière, dont **aucune image n'entre tant que l'auteur n'a pas tranché**. Son emplacement est
  *réussi*, donc sa tuile quittait la grille à l'arrivée ; et comme rien n'était entré en
  bibliothèque, aucun asset ne prenait sa place. L'auteur voyait sa tuile s'évanouir et n'avait
  plus aucun chemin vers ce qu'il venait de payer — c'est-à-dire exactement le gâchis que la
  tranche répare, refait par sa propre réparation. **Les essais d'écran ne peuvent pas
  l'attraper** : ils poussent la génération dans le chantier eux-mêmes, donc la question « le
  serveur la remonte-t-il ? » ne se pose jamais chez eux. Il a fallu ouvrir un second atelier sur
  le double du fournisseur et regarder. La garde : *quand un statut nouveau apparaît, se demander
  d'abord qui le remonte à l'écran*, et le vérifier au navigateur — pas en montant l'écran seul.

- **Un comptage qui n'est pas croisé raconte l'histoire de la variable qu'on a regardée.** Le
  plan de D1 tenait sur une mesure juste : 64 découpages sur 123 portent un durcissement quand le
  réglage livré est zéro, et l'écart se lisait entre une image seule (67 %) et un morceau de
  planche (38 %). Les deux chiffres sont exacts. **Croisés avec le moteur de détourage employé,
  ils ne veulent plus rien dire** : à moteur égal la nature ne décide presque plus rien, quand le
  moteur, lui, décide tout — le bord laisse le durcissement à zéro 78 fois sur 100, le modèle n'y
  laisse jamais zéro et y met 2 quatre fois sur cinq. La cause était **dans le même document**,
  trois mesures plus haut : le bord est binaire par construction et ne laisse aucune frange, le
  modèle en laisse sur 95 % du sujet. Personne n'avait joint les deux, et une tranche entière
  allait se construire sur la mauvaise moitié. La garde : *avant de faire d'un comptage une
  décision de produit, chercher la variable qui pourrait l'expliquer entièrement — et la
  chercher d'abord dans les mesures déjà écrites à côté*. Payé le 3 septembre 2026.

- **Une règle qui « complète » une charge doit partir de la charge, jamais de ce qu'on avait.**
  D1 fait suivre le durcissement quand l'auteur change de moteur, et la première écriture
  reconstruisait la passe **depuis celle qui était rangée** en n'y changeant que le moteur. Elle
  perdait alors tout ce que le même envoi apportait — poser la pipette *est* un changement de
  moteur, et le point arrivait avec lui. Un essai d'une autre tranche l'a attrapé en une minute
  (`tests/test_e3.py`, le point qui traverse le port et revient), ce qui est le seul mérite de
  l'affaire. La garde : *la valeur qui sort est celle d'après, et le produit n'y ajoute qu'un
  champ nommé — jamais une reconstruction*. Payé le 3 septembre 2026.

- **Un essai qui pose un réglage le fait vraiment, et un moteur lourd se charge dans le
  processus.** Trois essais de D1 posaient le moteur par modèle par la route qui rend une image :
  la route détoure pour de bon, donc `rembg` et `onnxruntime` entraient dans `sys.modules` — et
  `tests/test_t2.py` prouve précisément que le post-traitement ne les charge jamais. Il tombait,
  mais **seulement quand la suite entière tournait** : seul, il passait. La garde : *ne jamais
  choisir le moteur par modèle dans un essai qui rend une image ; la pipette porte la même règle
  et n'allume rien*. Payé le 3 septembre 2026.

- **Une étape du traitement qui ne s'exécute jamais ne se voit nulle part.** Depuis T4, la
  quantification n'entrait dans une recette **que s'il existait une palette**, et la palette se
  déduit des artworks officiels. Un projet sans artwork ne réduisait donc **aucune** couleur : le
  réglage `Univers.couleurs` existait, se réglait, s'enregistrait, et ne faisait rien. Mesuré le
  3 septembre 2026 : un personnage ramené à 64 carrés sortait à **905 couleurs**. Rien à l'écran ne
  le disait — au contraire, la branche « aucun artwork » **cachait le réglage**, ce qui achevait de
  rendre le défaut invisible. Et deux garde-fous le tenaient en place : le service **refusait** une
  quantification sans palette, et trois essais figeaient ce refus, dont un nommé *reste refusée*.
  La garde : *une place du traitement qui peut ne pas s'exécuter doit le dire à l'écran ; un
  réglage qu'on peut poser et qui n'agit pas est pire qu'un réglage absent*. Et son corollaire :
  *un essai qui fige une absence de comportement doit nommer ce qui la justifie, sinon il protège
  la panne au lieu du produit*. Payé le 3 septembre 2026.

- **Une bibliothèque « légère » peut tirer un moteur lourd par son seul import.** PixelOE publie
  une API `pixeloe.legacy` explicitement NumPy/OpenCV, sans GPU — et
  `from pixeloe.legacy.pixelize import pixelize` charge quand même **`torch`** dans `sys.modules`.
  Or l'invariant « le post-traitement ne touche jamais le GPU » se *prouve* en regardant
  `sys.modules` (`tests/test_t2.py`) : la simple question *faut-il griser ce bouton ?* aurait fait
  tomber l'essai sur toute machine où le paquet est installé. C'est le piège de `rembg` à
  l'identique, sur une bibliothèque qui annonce le contraire. La garde : *vérifier ce qu'un import
  charge vraiment, en lisant `sys.modules` après coup, avant de décider qu'une dépendance est
  légère ; et chercher la disponibilité avec `find_spec`, qui ne charge rien*. Payé le 3 septembre
  2026.

- **Une option qui porte le bon nom peut faire le contraire de ce qu'elle annonce.** PixelOE
  accepte `colors=32` et quantifie correctement — puis rappelle `match_color` sur l'image *non*
  quantifiée juste après, ce qui remet les milliers de couleurs d'origine. Mesuré le 3 septembre
  2026 : **470 couleurs rendues pour 32 demandées**. Le banc ne l'a vu que parce qu'il comptait les
  couleurs réellement présentes dans le résultat, au lieu de faire confiance au paramètre. La
  garde : *mesurer sur la sortie ce qu'un réglage prétend faire, surtout quand il vient d'une
  bibliothèque qu'on n'a pas écrite — un nom de paramètre n'est pas une garantie*. Payé le
  3 septembre 2026.

- **Un banc qui isole une variable peut en fausser une autre, et inventer un pire cas.** Le banc de
  pixelisation de D2 travaillait **sans détourage**, à raison : c'était le seul moyen de juger la
  réduction seule. Mais il croisait cette réduction avec le **nombre de couleurs**, et là le fond
  uni fausse tout — mesuré, il occupait 73 % des pixels et raflait donc la majorité de la palette.
  À 8 couleurs demandées, **5 partaient au fond et il en restait 3 pour le personnage** : d'où une
  bouillie noire qui n'accusait que le palier. Le produit, lui, détoure avant de quantifier et ne
  rencontre jamais ce cas. On allait donc écarter des paliers parfaitement utilisables. La garde :
  *quand un banc isole une variable, vérifier que l'isolement n'en fausse pas une autre — et
  surtout qu'il ne fabrique pas un pire cas que le produit ne produira jamais*. Payé le
  3 septembre 2026.

- **Un atelier jetable ne peut pas être peuplé et servi par la même application.** Le serveur MCP
  embarqué se monte sur l'application FastAPI, et son gestionnaire de session refuse d'ouvrir son
  cycle de vie deux fois : *« StreamableHTTPSessionManager .run() can only be called once per
  instance »*. Peupler l'atelier avec un `TestClient` — qui ouvre ce cycle — puis le servir avec
  uvicorn fait donc échouer le démarrage, et le message ne parle ni de MCP côté produit ni de ce
  qu'on essayait de faire. La garde : *deux applications sur le même atelier, donc sur le même
  dossier ; ce que l'une écrit, l'autre le lit*. Payé le 3 septembre 2026.

- **Une étape qui change de nom perd son numéro, quand le numéro se retrouve par le nom.** L'assistant
  déduit le rang et le groupe d'une étape de son **titre** — à raison : deux endroits qui
  numéroteraient les mêmes douze étapes finiraient par se contredire. Le style graphique a donné à
  l'étape des tailles un second titre — *La finesse* en dessin, *La taille* en pixel art —, et la
  recherche par nom ne l'a plus trouvée : le garde-fou `rang >= 0` a fait ce pour quoi il était là,
  et l'étape s'est affichée **sans sa ligne « étape 4 · le jeu »**, seule des douze, sans erreur ni
  message. La colonne de gauche, elle, continuait d'afficher l'ancien nom : **deux noms pour une
  étape, à 240 px l'un de l'autre**. La garde : *quand une chose se retrouve par son nom, lui donner
  un second nom est un changement de clé — il faut retrouver par tous ses noms, et n'en afficher
  qu'un seul à la fois*. Payé le 3 septembre 2026.

- **Une phrase exacte dans un mode devient un mensonge dans l'autre.** L'annonce écrite pour l'absence
  d'artwork — *« les couleurs se déduisent de chaque image, pas de la palette du jeu »* — était le
  correctif d'un vrai défaut, et elle est juste en pixel art. Le style graphique a ouvert un second
  mode où **les couleurs ne se réduisent pas du tout** : la même phrase y promettait un travail qui
  n'a pas lieu, **trois lignes au-dessus** de celle qui dit qu'il n'a pas lieu. Rien ne casse, rien
  ne se voit aux tests : c'est une phrase qui a cessé d'être vraie sans changer d'un mot. La
  garde : *quand un réglage ouvre un mode où une mécanique s'éteint, relire les phrases qui
  décrivent cette mécanique — pas seulement le code qui l'exécute*. Payé le 3 septembre 2026.

- **Une borne qu'on lève peut être porteuse ailleurs, sans que rien ne le dise.** Le calibrage écrit
  l'occupation d'une pose en **inversant** le calcul de la mise sur grille, et l'inverse d'un arrondi
  dépasse volontiers d'un pour cent : la pose d'attaque du vrai projet — 523 × 430 dans une case de
  64 — rend sa hauteur commune à **100,7 %**. Le `min(100, …)` qui traînait là ne bornait donc pas un
  réglage : il rattrapait un demi-pixel. En le levant avec le plafond de l'occupation, le calibrage
  d'un **personnage ordinaire** s'est mis à écrire 101 %, et ses images à sortir en **65 carrés au
  lieu de 64** — tout le monde hors de sa case, pour un arrondi. La garde : *avant de lever une
  borne, chercher qui s'appuie dessus sans le dire — une borne qui rattrape un arrondi ne ressemble
  pas à une borne*. Payé le 3 septembre 2026.

- **Une limite physique n'est pas une limite utile, et le curseur le dit avant l'auteur.** Le plafond
  des hauteurs a d'abord été tiré de la seule contrainte défendable — un canevas de 2 048 carrés — et
  c'était juste : sur une case de 16 carrés, 12 800 % tient dans l'image. Cent vingt-huit
  personnages. Physiquement possible, jamais utile, et **deux mille positions** sur le curseur qu'on
  venait d'ouvrir : le réglage devenait inutilisable au moment même où on le rendait utile. Il
  fallait une **seconde borne, tirée du métier** — huit personnages, la hauteur d'une porte de ville,
  au-delà de laquelle on fabrique un fond et non un sujet. La garde : *une borne physique et une
  borne d'usage sont deux choses ; la première protège la machine, la seconde protège la main, et
  aucune ne remplace l'autre*. Payé le 3 septembre 2026.

- **Un dessin qui ne peut pas montrer un défaut le rend invisible.** L'échantillon d'échelle du
  barème était une barre dans un carré, la barre haute d'un pourcentage. Il était juste, lisible, et
  **structurellement incapable** de montrer un sujet plus haut qu'un personnage : une barre dans un
  carré ne dépasse jamais le carré. Le seul écran qui aurait pu faire voir la limite en était donc la
  meilleure illustration, et personne ne l'a vue pendant des semaines. La garde : *quand un dessin
  encode la contrainte qu'on cherche à juger, il ne peut pas servir à la juger — vérifier ce qu'un
  dessin est incapable de représenter, pas seulement ce qu'il représente*. Payé le 3 septembre 2026.

- **La valeur au bord d'une plage n'a qu'un voisin, donc « le plus petit qui bat ses voisins » la
  choisit toujours.** `mesurer_grille` retenait *le plus petit pas qui approche la crête et dépasse
  ses deux voisins* — une règle juste, écrite pour ne pas rapporter une harmonique. Mais le premier
  pas de la plage, 2, **n'a pas de voisin de gauche** : sur une peinture, dont l'autocorrélation
  décroît doucement sans jamais faire de bosse, il gagne par forfait. Mesuré : **2, netteté 0,94**,
  sur une image qui n'a pas l'ombre d'une grille — faux **et** confiant, le pire des deux états. La
  garde : *quand une règle choisit « le premier qui bat ses voisins », vérifier ce qu'elle fait au
  bord de sa propre plage, où il en manque un ; et lui adjoindre une épreuve qui ne dépend pas du
  voisinage* — ici le peigne, qui demande que le contraste tombe sur les **multiples** du pas. Payé
  le 3 septembre 2026.

- **Un chiffre qui ressemble à un multiple rond est une supposition tant qu'un banc ne l'a pas
  produit.** Le plan et le bilan portaient tous deux, en gras et sous un pictogramme
  d'avertissement, *« ce dépôt a mesuré des blocs approchant quatre-vingts pixels »*, et un critère
  d'acceptation en dépendait. Personne ne l'avait mesuré : 80, c'est 5 × 16. Relevé sur les
  **149 images brutes du dépôt**, le pas le plus grossier est de **32 px** et 99 % tiennent sous 22.
  Le chiffre faux ne faisait pas qu'égarer, il **coûtait** : il demandait une plage de recherche
  deux fois et demie trop large. La garde : *avant de dimensionner quoi que ce soit sur un nombre lu
  dans un document, retrouver la mesure qui l'a produit — un multiple rond sans banc derrière lui
  n'est pas un relevé, et l'écrire en gras ne le rend pas vrai*. Payé le 3 septembre 2026.

- **Une mesure de qualité ne fait pas un arbitre quand la réponse la plus fine gagne toujours.**
  Pour trancher entre un pas et son double, l'idée qui vient d'instinct est l'aller-retour : réduire
  au pas candidat, réagrandir, regarder ce qui a changé. Elle est **dégénérée par construction** —
  tout diviseur du vrai pas reconstruit l'image aussi bien que lui, un bloc de 16 pixels d'une seule
  couleur se reconstruisant parfaitement à 8, à 4, à 2 —, et il faut donc prendre le **plus grand**
  qui reconstruise encore. Ce qui la casse pour de bon est ailleurs : dès que l'image est floue,
  c'est-à-dire toujours, la reconstruction au vrai pas devient imparfaite pendant que celle au pas 2
  reste presque parfaite. Mesuré sur le lot de réception : **170 cas justes sur 204 avec l'arbitre,
  200 sans lui, et 30 erreurs d'octave qu'il fabrique lui-même**. La garde : *avant d'employer une
  mesure de qualité pour choisir entre plusieurs réponses, vérifier qu'elle ne s'améliore pas
  mécaniquement dans une direction — sinon elle ne classe pas, elle penche*. Payé le 3 septembre
  2026.

- **Un banc qui compare des bornes ne doit contenir aucun cas hors de la plus petite d'entre
  elles.** Le lot de réception posait des grilles de 3 à 48 px pour voir ce que la détection fait
  quand le pas lui échappe — utile, et à garder. Mais le même lot servait à comparer quatre bornes
  de balayage, et les six cas à 48 px donnaient mécaniquement la victoire aux bornes larges : le
  tableau annonçait 107 contre 101 pour une différence qui ne portait que sur des pas que le dépôt
  ne produit pas. La conclusion allait être exactement l'inverse de la bonne. Séparé, le vrai chiffre
  apparaît : dans la plage réelle, 64 fait **exactement** comme 32, et c'est la petite borne — 24 —
  qui coupe, de douze cas. La garde : *un banc qui compare des réglages doit tenir chaque
  comparaison sur le domaine où la question se pose ; un cas hors domaine ne départage pas les
  réglages, il les classe par leur domaine*. Payé le 3 septembre 2026.

- **Une fabrique d'essai qui annonce une propriété dans son nom ne la garantit pas.** `image_sujet`
  du `conftest` se documente comme *« un sujet net sur un fond plat, peint sur une grille de `bloc`
  pixels »*, et c'est vrai du dessin. Ce n'est pas vrai de sa **mesure** : le sujet est une barre de
  huit colonnes logiques dans une toile de vingt-quatre, la répétition ne porte donc que sur un tiers
  de la largeur, la netteté plafonne à **0,20** et toute détection honnête y renonce. Un essai de
  route bâti dessus n'aurait pas mesuré le produit, il aurait mesuré le `conftest` — et il a d'abord
  échoué pour cette raison-là, ce qui est la meilleure des deux issues. La garde : *une fabrique
  partagée est écrite pour la question de son premier appelant ; avant de s'en servir pour une
  question neuve, vérifier que la propriété qu'on vient y chercher est mesurable et pas seulement
  dessinée*. Payé le 3 septembre 2026.

- **Insérer un élément dans une liste ordonnée fait mentir toutes les phrases qui citent un rang,
  et aucune ne lève d'erreur.** L'assistant a gagné une étape en deuxième position (`D2`), et
  **huit phrases** du produit se sont mises à désigner la mauvaise : *« l'étape 2 »* pour une étape
  devenue la troisième. Elles restaient parfaitement lisibles, parfaitement bien écrites, et
  fausses. Cinq commentaires du code étaient même décalés de **deux** crans — une insertion de `D1`
  puis une de `D2` —, et personne ne l'avait vu parce qu'un commentaire ne se relit qu'à l'occasion.
  La garde : *un rang dans une liste ordonnée ne s'écrit jamais à la main ; il se calcule, et si
  l'endroit ne peut pas calculer — un commentaire —, on **nomme** l'élément au lieu de le
  numéroter*. Payé le 3 septembre 2026.

- **Une règle avec une exception nommée est une règle qu'on n'applique pas.** L'essai qui refuse un
  numéro d'étape écrit à la main a d'abord toléré les lignes portant le code de la tranche — celles
  qui *racontent* la correction et doivent citer l'ancien numéro pour être lisibles. C'était une
  règle à deux étages dont le second demandait de savoir qu'il existe : le premier lecteur pressé
  aurait ajouté `G1` à un commentaire fautif et serait passé. La correction est allée dans l'autre
  sens — les deux commentaires disent *« la deuxième »* en toutes lettres, ce qui les rend **plus
  clairs** et rend l'essai absolu. La garde : *quand une règle mécanique demande une dérogation,
  regarder d'abord si ce qui la demande ne devrait pas changer de forme — une exception dans le
  garde-fou finit toujours par servir à autre chose que ce pour quoi elle a été écrite*. Payé le
  3 septembre 2026.

- **Une case à cocher qui ne change rien est pire qu'une case absente.** L'écran de découpe offrait
  *« me le montrer sur l'image — en magenta, ce qui ne compte pas »* sur toutes les cartes, y
  compris celles où la palette lit **100 %** de l'image : le magenta n'y couvre aucun pixel, et la
  case coche, décoche, sans jamais rien changer. Mesuré le 3 septembre 2026 : **3 des 10 artworks
  officiels du dépôt** sont dans ce cas. On la coche deux fois avant de conclure qu'elle est
  cassée — et c'est le produit qu'on soupçonne, pas l'image. La garde : *un contrôle dont l'effet
  peut être nul sur une donnée réelle doit se retirer sur cette donnée-là, pas se griser ni se
  taire — et il faut chercher les cas où l'effet est nul avant de l'offrir partout*. Payé le
  3 septembre 2026.

- **Deux bornes sur le même chiffre, à deux endroits, et une seule se voit.** Le calibrage calcule
  l'occupation à écrire dans `_occupation`, qui la borne à l'échelle déclarée par l'ensemble des
  poses — jusqu'à 300 % depuis la tranche des tailles —, puis l'écrit par `_poser`, qui la borne à
  100 %. Les deux bornes ne sont pas la même, donc **un géant déclaré à 300 % voit son calibrage
  écrasé au tiers de sa taille**. Le défaut est invisible tant que la valeur ne sort pas du service :
  personne ne compare une borne d'entrée à une borne de sortie. Il est devenu visible en `R9`, qui
  montre l'empilement d'après — il fallait alors rendre un chiffre, et rendre le mauvais aurait fait
  dessiner une hauteur et en écrire une autre. **Il n'est toujours pas corrigé**, parce que le
  corriger changerait ce que l'outil écrit et que le dernier critère de `R9` l'interdit : le service
  rend la valeur *réellement* écrite, et l'écran dessine ce qu'on obtiendra. La garde : *quand une
  valeur traverse deux fonctions qui la bornent chacune, écrire la borne une fois et la faire
  traverser — sinon la seconde borne est un plafond que personne ne relit*. Trouvé le 3 septembre
  2026.

- **Le piège du `ResizeObserver` a une famille, et `IntersectionObserver` en est.** La fiche
  d'une chose suivait le défilement de ses cinq sections avec un `IntersectionObserver` : sur un
  onglet qui ne compose pas ses images, aucune section ne croise jamais rien, et le sommaire
  reste allumé sur la première pour toute la session. **Exactement le défaut déjà consigné neuf
  jours plus tôt**, sur l'autre guetteur, avec la même cause — les rappels passent par la boucle
  de rendu — et la même garde : lire les positions **à la demande**, avec
  `getBoundingClientRect`, sur l'événement qui les change. Il a été payé une seconde fois parce
  que l'entrée nommait le *composant* et non la *famille*. La garde élargie : *aucun `*Observer`
  du navigateur ne pilote un affichage que l'écran doit tenir juste ; il peut au mieux réveiller
  une mesure que l'on fait soi-même*. Et le corollaire de vérification : **ni jsdom ni un onglet
  d'arrière-plan ne peut infirmer un guetteur** — un essai qui passe et une page qui ne bouge
  pas ne prouvent rien l'un ni l'autre. Payé le 3 septembre 2026.

- **Le tri qui désigne « la section qu'on lit » n'existe pas.** En corrigeant le guetteur
  ci-dessus, la première réécriture a seulement inversé le tri des sections qui croisent la bande
  du haut. Les deux sens sont faux, et les mesures le disent : sur la fiche du pèlerin, la bande
  fait 316 px quand « ce qui l'habille » en fait **797** — trois sections la croisent en même
  temps. Trier par le haut croissant désigne celle qu'on vient de quitter, décroissant celle où
  l'on n'est pas encore arrivé. Ce qu'on lit est **la dernière dont le titre a passé le haut**,
  avec le fond de page en cas à part, parce que la dernière section ne peut plus atteindre le
  haut. La garde : *une règle de « ce qui est en vue » se vérifie sur les hauteurs réelles du
  contenu, pas sur l'idée qu'on s'en fait — une section plus haute que la fenêtre casse toutes
  les heuristiques de tri*. Payé le 3 septembre 2026.

- **La bibliothèque de détourage normalise par le maximum de l'image, pas par 255.** Chaque
  moteur de `rembg` prépare l'image avant de la donner au modèle, et cette préparation
  (`BaseSession.normalize`) divise par **le plus grand nombre trouvé dans l'image**, jamais par
  255. Conséquence : *deux images identiques à un éclaircissement près n'entrent pas dans le
  modèle sous la même forme*, et un sprite dont aucun pixel n'atteint le blanc pur est
  silencieusement remonté. Ça ne casse rien — le modèle rend quand même un masque plausible —,
  ce qui est exactement pourquoi personne ne le voit : **il n'y a pas de symptôme**, juste deux
  masques qui diffèrent sans raison apparente entre deux versions d'une même image. On l'a
  trouvé en lisant le code de la bibliothèque pour comprendre pourquoi le banc ne reproduisait
  pas deux fois le même chiffre sur une image retouchée. La garde : *une bibliothèque de vision
  qui prend une image en entrée fait toujours une préparation qu'elle ne documente pas — la lire
  avant de comparer deux passes, et ne jamais comparer deux passes sur des images qui ne sont
  pas bit à bit les mêmes*. Payé le 3 septembre 2026.

- **Un moteur de détourage peut regarder une image huit fois plus petite que celle qu'on lui
  donne, et rendre quand même un masque de la bonne taille.** `u2net` — le moteur par défaut du
  dépôt jusqu'au 3 septembre 2026 — infère à **320 × 320**, puis réagrandit son masque en
  LANCZOS jusqu'à la taille d'origine. Sur une image de 1024, chaque pixel du masque décidé
  couvre donc **neuf pixels rendus**, et le bord n'est pas mesuré : il est interpolé. Les quatre
  autres moteurs du catalogue infèrent à 1024. Rien dans l'appel ne le dit, rien dans le
  résultat ne le montre — le masque a la bonne taille dans tous les cas, et c'est ce qui rend le
  piège invisible. La conséquence pratique s'est vue à la mesure : le moteur qui n'étire rien
  trouve **une moitié de détails ajourés en plus** entre un bras et un torse, pour la même part
  d'image gardée. ⚠️ **Et l'explication qu'on en tirait était fausse** : on croyait que les
  95 % de pixels à demi transparents venaient de ce réagrandissement. Le moteur qui infère à
  1024 en rend autant, à 3 % près. C'est la sortie douce du modèle, pas l'étirement. La
  garde : *la taille d'entrée d'un modèle de vision se lit dans sa fiche et s'écrit à côté de
  lui dans le catalogue — sans quoi on compare deux moteurs en croyant comparer deux
  algorithmes, alors qu'on compare deux résolutions*. Payé le 3 septembre 2026.

- **Une négation dans un champ déjà négatif dit le contraire de ce qu'on croit.** La phrase qui
  interdit au modèle d'employer la couleur de fond sur le sujet énumérait les endroits qui
  trahissent — *« (not on its outfit, its skin, its hair… ) »*. Elle part dans le champ négatif
  de la demande, que les deux adaptateurs replient derrière **« Do not include: »**. Le lecteur
  — humain ou modèle — reçoit donc *ne mets pas … pas sur sa tenue*, et l'énumération, qui
  devait **étendre** l'interdiction, se lit comme une liste d'**exceptions** : exactement
  l'inverse de la story. **Le code ne le montrait pas** ; il se lit toujours comme on l'a pensé,
  et la phrase n'existe en entier qu'une fois assemblée. Ce qui l'a trouvé est d'avoir imprimé
  le texte final dans la console d'un atelier jetable, à côté du reste. La garde : *tout texte
  qui part dans un champ négatif s'écrit en affirmations, et se relit assemblé, jamais dans le
  code qui le compose — et une garde mécanique vaut mieux qu'une relecture : « aucun " not " dans
  ce qui part en interdiction » est une ligne d'essai*. Payé le 3 septembre 2026.

- **Un contrôle qui ne sait pas être vide affiche une valeur qu'il n'a pas.** `<input
  type="color">` n'a pas d'état vide : il *doit* porter une couleur. Les deux écrans du fond en
  posaient donc une par défaut — celle de la proposition —, et une pastille magenta se
  retrouvait collée aux mots *« aucun fond posé »*. L'écran affirmait le contraire de ce qu'il
  disait, sur le réglage même que la tranche venait d'ouvrir. **Aucun essai ne pouvait le
  voir** : en `jsdom` la valeur est celle qu'on a écrite, et l'essai l'aurait confirmée. C'est la
  **famille** du piège de la case à cocher qui ne change rien, et la garde s'élargit : *un
  contrôle natif qui n'a pas d'état vide ne doit pas être le seul à porter l'affichage d'un
  réglage facultatif — on montre l'absence avec le vocabulaire du produit (ici le damier, qui dit
  déjà la transparence partout ailleurs) et on laisse le contrôle dessous, atteignable*. Le
  laisser atteignable est la seconde moitié : le retirer aurait fermé le seul chemin qui reste
  quand l'atelier ne peut proposer aucune couleur sûre. Payé le 3 septembre 2026.

- **Un affichage placé sous un filtre doit suivre ce filtre.** Deux fautes de la même famille
  dans le même panneau : *« 48 au catalogue »* au-dessus d'une liste de huit — un chiffre pris à
  sa source et non à ce qui est rendu —, et le modèle choisi écarté de la liste par le filtre
  alors qu'aucun autre endroit de l'écran ne le nommait. Corollaire, et il a fallu les deux :
  **ce qui décide d'un appel ne quitte jamais l'écran** — le choisi revient en tête quand le
  filtre l'écarte, avec un liseré qui dit qu'il n'est pas un résultat — **et se lit à une place
  fixe** que le défilement n'emporte pas, ce qui est le rôle du bloc « Ce qui part ». Le
  compteur, lui, compte les résultats du filtre et non les lignes rendues. Et un commentaire
  n'est pas une preuve : celui du code annonçait *« le modèle choisi reste visible »*, vrai du
  grisé et faux du filtre. ⚠️ **Payé deux fois** : trouvé et corrigé le 27 août 2026, la
  correction est restée sur une branche jamais fusionnée, la V2.1 a réécrit le panneau sans elle,
  et le défaut est revenu intact. La garde en sort élargie : *une correction de séance qui ne
  rejoint pas la branche principale le jour même n'existe pas — c'est la réécriture suivante qui
  décide, et elle ne sait rien.* Remise en place le 3 septembre 2026.

- **Une couleur dont le nom n'existe pas ne lève rien : elle ne dessine rien.** Le thème déclare
  `--color-signal`, `--color-bord`, `--color-fond-1` ; du code écrivait `var(--signal)`. Une
  déclaration CSS dont la valeur ne se résout pas est **simplement ignorée** — pas d'erreur de
  compilation, pas d'erreur de type, rien dans la console. Sur l'écran de montage, l'encadré des
  images retenues et le liseré qui dit *quelle image passe en ce moment* ne s'étaient donc jamais
  dessinés, et personne n'avait de quoi le savoir : **le navigateur d'essai ne résout pas les
  variables de couleur**, donc un essai qui lirait la couleur calculée confirmerait n'importe
  quoi. La garde est mécanique et ne dépend d'aucune relecture : *un essai qui parcourt les styles
  posés en clair et refuse tout `var(--…)` dont le nom ne commence pas par `color-`*. ⚠️ Le même
  nom court traîne ailleurs dans le dépôt, hors du terrain de la tranche — c'est une famille, pas
  un accident. Payé le 4 septembre 2026.

- **Les écouteurs d'un glissement se posent dans le geste, jamais dans un effet.** Le motif
  courant — `onMouseDown` pose un état, un `useEffect` réagit à cet état et attache `mousemove` et
  `mouseup` sur la fenêtre — a une course : **l'effet s'exécute après le rendu**, et un geste
  rapide envoie son `mousemove` et son `mouseup` avant. Le glissement ne fait alors *rien du
  tout*, sans la moindre erreur nulle part. Ce qui le rend durable est qu'un humain qui tire
  lentement ne le voit jamais : le défaut ne se montre qu'au coup sec, c'est-à-dire au geste de
  quelqu'un qui le refait pour la dixième fois. Les essais d'écran ne le voient pas non plus —
  leur `fireEvent` vide la file des effets entre deux événements, ce que la vraie souris ne fait
  pas. **La correction est d'attacher dans le gestionnaire lui-même**, et de tout détacher au
  relâchement ; le point de départ vit alors dans la fermeture, ce qui a un second mérite — le
  bord opposé ne dérive plus pendant qu'on tire. Payé le 4 septembre 2026.

- **Un `mousedown` sur une poignée remonte à ce qui la porte.** Un rectangle qu'on déplace en le
  tirant, avec des bords qu'on tire pour le redimensionner : sans `stopPropagation` sur les
  bords, les deux gestes se déclenchent l'un après l'autre et **le dernier gagne** — tirer un bord
  déplaçait la boîte entière, à taille constante. Le symptôme trompe, parce que quelque chose
  bouge : on cherche l'erreur dans le calcul de la taille, jamais dans le fait qu'un second geste
  a démarré. Payé le 4 septembre 2026, en même temps que le précédent et sur le même rectangle.

- **Une liste rendue par ComfyUI arrive sous deux formes, dans la même version.** `GET
  /object_info/<classe>` décrit chaque entrée d'un nœud, et la liste des fichiers installés est
  tantôt le **premier élément** du descripteur, tantôt sous une clé `options` plus loin dedans.
  Les deux coexistent dans une seule installation, d'un chargeur à l'autre. N'en lire qu'une rend
  une famille **vide** — donc *tous ses fichiers manquants* — sur une machine où tout est en
  place, et le produit propose alors un téléchargement de plusieurs gigaoctets pour rien. Rien ne
  lève : une liste vide est une réponse valide. **Un double d'essai qui n'emploierait qu'une forme
  ne verrait pas l'oubli** ; celui d'`A11` alterne exprès. Payé le 4 septembre 2026.

- **Un chargeur absent n'est pas un fichier présent.** Un fichier de modèle posé dans un dossier
  que ComfyUI ne lit pas **est un fichier absent**, et regarder le disque dirait le contraire. Le
  cas concret est le greffon `ComfyUI-GGUF` non installé : le nœud qui charge ces fichiers
  n'existe pas, `object_info` rend 404, et les deux moitiés du moteur ne sont chargeables par
  rien — bien qu'elles soient là, à leur place, entières. **La seule preuve qu'un fichier est
  utilisable est que l'application le liste** ; l'existence sur le disque n'en est pas une. Payé
  le 4 septembre 2026.

- **Une fabrique qui reconstruit son adaptateur à chaque appel efface tout ce qu'il retient — et
  rien ne le signale.** Le dépôt refabrique ses adaptateurs à chaque demande, pour une bonne
  raison : ils relisent leur clé sur le disque, et on doit pouvoir la déposer sans redémarrer.
  L'adaptateur du moteur local n'a pas de clé, mais il retient deux choses qui n'ont de sens que
  dans la durée — *ce que la dernière visite a vu*, d'où sort le grisé, et *un clip est-il déjà
  parti*, d'où sort l'attente annoncée. Reconstruit à chaque appel, il repartait sans mémoire :
  **le modèle ne se grisait plus jamais**, application éteinte comprise, et l'absence se
  découvrait en cliquant sur le bouton qui envoie au lieu de se lire avant. ⚠️ **Aucun essai ne
  pouvait le voir** : chacun tient sa propre instance et la garde, ce qui est exactement la
  situation corrigée. Il a fallu monter l'atelier réel et lire ce qu'il répondait. La correction
  est de garder l'objet — garder l'objet ne garde pas sa réponse, puisque chaque relecture du
  catalogue et chaque peinture d'écran le font revisiter. Payé le 4 septembre 2026.

- **Deux traducteurs pour un même objet finissent toujours par diverger, et l'écart ne lève
  jamais.** La même structure — un modèle vidéo — était mise en JSON à deux endroits, l'un dans le
  service, l'autre dans les routes. Les champs ajoutés d'un côté n'existaient pas de l'autre : le
  flux les envoyait, l'écran des modèles ne les recevait pas, et une clé absente d'un objet JSON
  ne fait rien du tout — pas d'erreur de compilation, pas d'exception, juste un champ qui vaut
  `undefined` là où l'écran l'attendait. ⚠️ Ce qui rend le cas durable est que **rien ne le
  signale au moment où on duplique** : c'est plus tard, en ajoutant un champ, qu'on paie. La
  duplication elle-même est le piège, pas l'oubli. Payé le 4 septembre 2026.


- **Un écran qui lit ce qu'un autre écrit a raison par accident, tant que personne ne le lui
  redit.** Les bandes d'un clip ne s'annonçaient pas sur le flux, et c'était juste : elles ne se
  voyaient que sur l'écran de montage, celui-là même qui venait de les écrire. Le jour où un
  second écran les a montrées — le calque animé de la matrice, **deux onglets plus loin** —, la
  même absence est devenue un défaut : on découpe un clip dans la galerie, et la case du
  personnage ne se remplit pas. ⚠️ **Aucun essai d'écran ne pouvait le dire**, parce qu'ils
  montent un serveur doublé qui répond déjà la bonne chose : la question n'est pas *que répond le
  serveur*, mais *qui le lui redemande, et quand*. Il a fallu cliquer dans l'atelier jetable et
  regarder la jauge ne pas bouger. La règle qui en sort : **quand une donnée gagne un second
  lecteur, elle a besoin d'une annonce**, et le moment où on l'ajoute est celui où on écrit le
  second lecteur — jamais plus tard. Payé le 4 septembre 2026.


- **Une surface qui ne fait que montrer a le droit de s'effacer ; une surface qui porte un
  geste, non.** La loupe de l'écran de montage suivait le pointeur et disparaissait dès qu'il
  quittait le ruban — juste, tant qu'elle ne servait qu'à regarder. Le jour où elle a reçu un
  bouton, le geste est devenu impossible **sans que rien n'échoue** : on vise une image, on part
  cliquer, et il n'y a plus de bouton. ⚠️ Ce qui rend le cas durable est qu'aucun essai ne le
  voit : un essai clique le bouton là où il est, il ne traverse pas l'écran pour aller le
  chercher. La règle : **le jour où l'on pose un geste sur une surface qui n'en portait pas, on
  relit d'abord *quand elle disparaît*.** Payé le 4 septembre 2026.


- **Un chiffre qu'aucun écran ne montre n'est vérifié par personne — et son essai se trompe avec
  lui.** La fiche d'une bande comptait la durée d'un aller-retour comme *images × 2*, ce qui
  suppose que les deux bouts se rejouent au demi-tour. Ni la vignette de la matrice ne le fait, ni
  le format d'export : quatre images en jouent **six** — 0, 1, 2, 3, 2, 1 — et non huit. Le chiffre
  était faux depuis sa naissance, un essai l'affirmait, et **rien ne pouvait le contredire** : il
  vivait dans une fiche que personne n'affichait. ⚠️ Il n'a été vu qu'au moment où une tranche l'a
  fait *sortir de l'atelier*, dans un fichier destiné à un moteur de jeu. La règle : **une valeur
  calculée que rien n'affiche est une hypothèse, pas une mesure** — quand une tranche la fait
  sortir, on la recalcule à la main avant de la croire, et on relit son essai en se demandant s'il
  ne fait que répéter le code. Payé le 4 septembre 2026.


- **Un format emprunté ne se dégrade pas d'un coup : il se dégrade d'une clé.** Le fichier
  d'accompagnement d'une planche de sprites est écrit dans le format d'un autre outil, pour qu'un
  moteur de jeu l'ouvre sans rien apprendre. Ce qui le tue n'est pas une réécriture, c'est une clé
  ajoutée « qui ne gêne personne », puis une clé renommée pour faire plus clair — et six mois plus
  tard le fichier ne s'ouvre plus nulle part, sans qu'aucun essai n'ait jamais rougi. ⚠️ **Un essai
  qui vérifie que les bonnes clés sont là ne suffit pas** : il faut vérifier qu'il n'y en a pas
  d'autres, c'est-à-dire comparer le **jeu de clés exact**. Ce qui appartient à l'atelier — d'où
  vient l'animation, ce qui a été payé, quelle recette — se met **à côté**, dans le descriptif
  maison, jamais dedans. Payé le 4 septembre 2026.


- **Une mesure trop large ne dit pas « il n'y a rien » : elle dit « je ne sais pas regarder ».**
  Une correction du contour d'une animation devait se juger sur *la part du bord qui change d'une
  image à l'autre*. Ce chiffre compte **le grésil et le vrai mouvement ensemble**, et le mouvement
  pèse tellement plus lourd qu'il l'enterre : trois bancs de suite ont annoncé un gain nul sur une
  correction qui marchait. ⚠️ **Le réflexe, chaque fois, a été de corriger le sujet d'essai jusqu'à
  ce que le chiffre bouge** — et c'est le chiffre qu'il fallait corriger. La bonne mesure tenait
  dans une phrase : *un pixel que le sujet traverse s'allume une fois et reste allumé ; un pixel
  qui s'allume, s'éteint et se rallume est revenu sur ses pas.* Sur le même banc, le même réglage
  fait −6 % sur la mesure large et −33 % sur la juste. La règle : **quand un banc dit trois fois
  « aucun écart », on suspecte la mesure avant le sujet, et le sujet avant le code** — et on
  s'oblige à écrire, en une phrase et sans chiffre, *ce que la mesure sépare de quoi*. Une mesure
  qui ne sépare rien ne mesure rien. Payé le 4 septembre 2026.


- **Une droite qui passe par le centre d'un carré le coupe toujours en deux moitiés égales.** Deux
  façons de réduire une image qui semblent très différentes — prendre *le pixel du centre* d'un
  bloc, ou prendre *la majorité* du bloc — donnent **exactement la même réponse** partout où le
  bord est droit à l'échelle du bloc. Elles ne peuvent différer qu'aux pointes, aux traits fins, et
  sur les irrégularités au pixel près. ⚠️ **Un sujet d'essai tracé par une équation n'en a aucune**,
  donc il ne sépare jamais les deux — et l'on conclut que le réglage ne sert à rien. Un découpage
  réel en est plein : la compression vidéo laisse le long de chaque bord un **écho** de quelques
  dizaines de niveaux, redessiné à chaque image, qui fait entrer et sortir des pixels du découpage.
  La règle : **avant de fabriquer un sujet d'essai, écrire ce que les deux chaînes font
  différemment, et vérifier que le sujet contient ce cas-là.** Un rectangle propre est le pire
  sujet possible pour juger d'une réduction. Payé le 4 septembre 2026.

- **Un objet qu'on sait écrire et qu'on ne sait pas relire n'est pas fini.** Le produit gardait une
  animation avec tous ses réglages — cadre, recette, vitesse, sens, images — et **ne savait pas la
  rouvrir** : la vignette remontait au clip, donc l'écran repartait des réglages du jeu et corriger
  une virgule demandait de tout refaire de mémoire. ⚠️ **Aucun des essais ne pouvait le voir, et
  c'est leur forme qui l'expliquait** : ils gardaient une bande puis vérifiaient la réponse du
  `POST` — ce qu'ils venaient d'envoyer. Personne ne relisait. La règle : **pour tout objet que le
  produit garde, un essai le referme et le rouvre**, et il vérifie que ce qui revient est ce qu'on
  y avait mis — pas ce que le défaut du système dirait. Le repère qui rend l'essai probant :
  **garder avec des réglages qui ne sont pas ceux du défaut**, sinon la relecture passe par
  accident. Trouvé par l'auteur à l'usage le 4 septembre 2026, quelques heures après la livraison
  de la tranche voisine.


- **Un essai d'écran qui « met les choses au calme » avant d'agir supprime le défaut qu'il cherche.**
  L'atelier d'une animation s'ouvre en jouant. Les essais commençaient donc par arrêter le lecteur,
  parce qu'une image qui change onze fois par seconde rend la suite illisible — et **arrêté, le
  défaut ne peut pas se produire** : l'image regardée est déjà l'image choisie. Le vrai geste, lui,
  arrive pendant que ça tourne, et il poussait la première image de la bande au lieu de celle qu'on
  regardait. ⚠️ Le défaut a été vu **au navigateur**, jamais par un essai. La règle : **quand
  l'essai neutralise un état pour pouvoir observer, se demander si le défaut vit dans l'état
  neutralisé** — et en écrire un qui le laisse en marche, ralenti plutôt qu'arrêté. Et vérifier
  qu'il tombe **en défaisant le correctif** : un essai écrit après coup passe souvent des deux
  côtés. Payé le 5 septembre 2026.


- **Une fenêtre commune mesurée sur un clip ne couvre pas une bande qui puise dans deux.** Dès
  qu'une animation peut prendre une image ailleurs, elle n'a de fenêtre **dans ni l'un ni l'autre**
  clip. Recadrer les images empruntées sur le rectangle du clip principal les rogne d'un côté — et
  **ce qui dépasse ne se voit pas dans l'atelier, il se voit dans le jeu**, des semaines plus tard.
  La règle : **une mesure d'ensemble se reprend sur l'ensemble qu'elle décrit, pas sur celui qui
  l'a fournie** ; quand la composition d'un objet s'élargit, relire chaque mesure qui portait sur
  l'ancien périmètre. Payé le 5 septembre 2026.


- **Une valeur périmée n'est pas une valeur fausse, et l'écran ne doit pas les traiter pareil.** La
  fenêtre commune d'une animation reste juste tant que le détourage ne change pas ; après, elle est
  *d'avant*. La remesurer coûte une vingtaine de secondes. Les deux réflexes sont mauvais :
  recalculer d'office fait payer les vingt secondes à chaque cran de curseur, et donner la valeur
  pour à jour laisse dépasser un bras sans rien dire. La règle : **garder l'empreinte des réglages
  avec la mesure**, et faire dire à l'écran *« mesurée avec un autre détourage »* plutôt que de
  choisir à la place de l'auteur. Le mot compte : « d'avant », pas « fausse ». Payé le 5 septembre
  2026.


- **Deux champs qui disent la même chose finissent par ne plus la dire.** Une bande portait
  `images` (des numéros) et devait porter `prises` (numéro, clip, décalage). Les garder tous les
  deux aurait demandé de les tenir d'accord à chaque écriture — et c'est l'auteur qui aurait
  découvert l'écart, dans une animation exportée. La règle : **le second est une propriété dérivée
  du premier, jamais un champ**. Il s'écrit quand même dans le JSON, parce que les écrans le lisent
  et qu'un format ne se réécrit pas pour une commodité interne. Corollaire de relecture, qui a
  évité toute migration : **une forme neuve accepte l'ancienne à la lecture** — un entier vaut une
  prise sans décalage — et **un champ vide veut dire « celui de l'objet qui me porte »**, ici le
  clip de la bande. Payé le 5 septembre 2026.

- **Un réglage qui ne fait rien la plupart du temps est pire qu'un réglage absent.** L'écran de
  montage offrait *la tolérance du détourage* et rien d'autre — or la tolérance n'est lue que par
  deux moteurs sur quatre : la pipette vise un point, le modèle décide seul, la sélection suit un
  tracé. ⚠️ **Le curseur bougeait sans que l'image change, et rien ne le disait** : l'auteur ne
  pouvait pas distinguer *ce réglage ne s'applique pas ici* de *ce réglage ne marche pas*. La
  règle : **un contrôle qui dépend d'un choix voisin disparaît quand ce choix le rend inerte, et
  laisse une phrase à sa place.** Corollaire trouvé le même jour : quand la valeur par défaut d'un
  réglage dépend d'un autre, **elle suit** — le durcissement était resté celui du moteur d'avant,
  et l'auteur l'avait retapé trente-neuf fois sur quarante. Payé le 5 septembre 2026.


- **Une route qui sert quelque chose que nul écran n'affiche n'existe pas.** `GET
  /clips/{id}/video` servait la vidéo payée depuis `A9` ; l'écran de montage montrait la pellicule
  et deux boucles tirées des *images extraites*, et la vidéo n'avait **aucun chemin** que l'auteur
  puisse prendre. ⚠️ Une revue de code ne le voit pas — la route est là, testée, correcte —, et un
  essai d'écran ne le voit pas non plus : il vérifie ce que l'écran montre, jamais ce qu'il ne
  montre pas. La règle : **à la fin d'une tranche, lister ce que le serveur sait rendre et vérifier
  que chaque chose a un chemin depuis un écran** ; ce qui n'en a pas est soit à brancher, soit à
  retirer. C'est la famille ② de la `V3.1` — *ce qui est construit et jamais branché* —, et elle se
  reforme toute seule. Payé le 5 septembre 2026.


- **Servir une vidéo sans répondre aux demandes de plage, c'est servir une vidéo qu'on ne peut pas
  parcourir.** Un navigateur se déplace dans une vidéo en demandant des tranches d'octets ; sans
  `Accept-Ranges` et sans réponse `206`, la barre de lecture ne répond pas, et certains lecteurs
  refusent même de commencer. ⚠️ **Le lecteur envoie sa toute première demande en plage**, avant
  de connaître la taille du fichier — un serveur qui ne sait répondre qu'au fichier entier semble
  donc marcher jusqu'au moment où l'on cherche un passage. Trois formes à tenir, et elles sont
  toutes envoyées en vrai : `bytes=100-199`, `bytes=10-` (jusqu'à la fin) et `bytes=-500` (les
  derniers). Une plage qui commence après la fin se refuse en **416 avec la taille**, pas en
  tranche vide : c'est ainsi que le lecteur apprend jusqu'où demander. Payé le 5 septembre 2026.


- **Un panneau intitulé « l'image choisie » qui suit l'image qui passe.** Deuxième fois en deux
  tranches, dans un panneau différent : la fiche de la frame prenait le chemin des flèches — *on
  corrige l'image qu'on regarde*, la règle d'`A7` —, si bien qu'avec le lecteur en marche on
  choisissait l'image 14, la fiche décrivait l'image 10, et taper un numéro remplaçait la 10. La
  phrase « cette image a sa recette à elle » désignait elle aussi une image au hasard. ⚠️ **Les
  765 essais d'écran n'en voyaient rien** : un essai lit un instant, et à l'arrêt l'image regardée
  *est* l'image choisie — le défaut n'existe que pendant que ça tourne. Le partage à tenir :
  **un geste instantané tombe sur ce qu'on regarde, un geste qu'on lit d'abord tombe sur ce qu'on
  a choisi**, et la flèche emmène la sélection avec elle pour que les deux se rejoignent au
  premier coup. Payé le 6 septembre 2026, vu au navigateur sur l'atelier jetable.


- **Repasser par un écran plus pauvre remet son ordre à lui.** « Reprendre le montage » rouvrait
  le montage sur une animation déjà montée ; le montage range les images retenues par numéro —
  ce qui est juste quand il n'y a pas d'autre ordre —, et refermer rendait la bande **triée**,
  déplacements et duplications perdus, pour avoir ajouté une seule image. Même trajet, même
  famille : la réserve d'images mises de côté était ignorée à l'aller, donc une image reprise
  revenait **neuve**, sans sa poussée ni sa recette, et restait dans la réserve par-dessus le
  marché. ⚠️ **Un aller-retour entre deux écrans doit être relu dans le sens du retour** :
  chaque chose que l'écran de départ savait et que l'écran d'arrivée ignore est une chose qu'il
  faut lui rendre — l'ordre, la réserve, ce qu'une case ne sait pas montrer deux fois. Payé le
  6 septembre 2026.


- **Un utilitaire Tailwind dont le jeton n'existe pas ne lève aucune erreur — il ne fait rien.**
  Ni le compilateur, ni la relecture, ni un essai d'écran ne le voient : la règle CSS n'est
  simplement pas produite, et l'élément garde la couleur de son parent. Le contrôle posé par
  `B0` en a trouvé **quinze emplois dans quatre fichiers** au premier lancement — `signal-sourd`
  (deux boutons actifs de l'écran des tables sans **aucun** fond), `texte-1` (neuf survols de
  l'atelier de bande qui ne changeaient rien), `attente`, `info`. Un gris sur du gris ne détonne
  pas, et c'est ce qui les avait laissés passer. ⚠️ **La tentation, quand le contrôle les nomme,
  est de déclarer les quatre pour le faire taire** : c'est inventer quatre valeurs que personne
  n'a mesurées, et c'est exactement comme ça que huit couleurs étaient entrées dans les planches
  sans être dans le document. Ce sont les écrans qu'on ramène sur des jetons qui existent. Le
  banc est `py essais/essai_jetons.py`. Payé le 6 septembre 2026.


- **Quand une pile remplace des états indépendants, l'ordre des appels se met à compter.**
  `B0` a remplacé douze états d'ouverture d'`App.tsx` par une pile de lieux, en les gardant
  **dérivés** — même nom, même type, même setter — pour que deux cents lectures ne bougent pas.
  Un seul appel a cassé : « ouvrir l'établi » posait la profondeur *puis* changeait de lieu, et
  poser une racine repose la pile — donc efface ce qu'on venait d'y mettre. Avec douze états
  indépendants, l'ordre n'avait aucune importance ; avec une pile, **le lieu se pose d'abord, la
  profondeur ensuite**, ce qui est aussi le sens de lecture : on va quelque part, puis on y
  descend. ⚠️ Un seul essai sur 792 l'a vu, et il ne le disait pas — il cherchait un nom dans le
  fil d'Ariane. Payé le 6 septembre 2026.


- **Une réécriture de masse peut réécrire la fonction qu'elle vient de poser.** La bascule des
  61 accès de navigation des essais d'écran remplaçait `fireEvent.click(leLieu(x))` par
  `allerA(x)` — y compris **dans le corps d'`allerA`**, dont c'était précisément la définition.
  Résultat : `allerA` s'appelant elle-même, et 250 essais rouges d'un coup. Le corps de `leLieu`
  était protégé, celui d'`allerA` ne l'était pas. ⚠️ **Une substitution doit masquer toutes les
  définitions qu'elle introduit, pas seulement la première** — et le signe, quand ça arrive, est
  un `RangeError: Maximum call stack size exceeded` dont la trace ne cite qu'une ligne, répétée.
  Payé le 6 septembre 2026.


- **Un effet de bord dans une fonction de mise à jour d'état s'exécute deux fois, par
  intermittence.** Le montage lisait son curseur au clavier par `setCurseur(c => { basculer(c);
  return c })` — la valeur renvoyée est la même, donc React évalue la fonction une fois pour
  voir si l'état bouge, renonce, puis la réévalue au rendu que `basculer` a lui-même déclenché.
  **Deux bascules, et la barre d'espace ne fait rien.** Ça ne se produit que selon ce qui est en
  attente sur le composant : l'essai passait seul et tombait dans la suite complète, un tour sur
  plusieurs. ⚠️ **Une fonction de mise à jour doit être pure et ne rien faire d'autre que
  renvoyer le prochain état** ; pour lire un état sans le mettre en dépendance, c'est une
  référence qu'il faut, pas un `set…` détourné. Payé le 6 septembre 2026.


- **`PUT /assets/favorite` écrit un champ et ne démote personne.** `services/bibliotheque.py`
  est la **seule** écriture de `.favori` du produit, et elle ne regarde pas les voisines de la
  case. Le serveur ne tient donc pas l'unicité de la retenue : il **départage** au rendu, par
  `corps_retenu`, qui prend le maximum de `(favori, cree_le, rang)`. Deux retenues dans une
  même case sont un état parfaitement atteignable, et c'est la **plus récente** qui part dans
  le jeu. ⚠️ Un écran qui trie autrement — la première, ou l'ordre d'arrivée — désigne une
  image pendant que l'export en écrit une autre, **et rien ne le signale**. Tout écran qui
  retient doit donc éteindre les autres lui-même, et **avant** d'allumer la sienne : dans
  l'autre sens, un appel qui échoue laisse deux retenues au lieu de l'état d'avant. Payé en
  relevé le 8 septembre 2026, en `B10`.
- **Une colonne de flex ne descend pas sous la largeur de son contenu, et pousse ses voisines
  hors de la fenêtre.** `min-width: auto` est la valeur par défaut d'un enfant de flex : la
  surface d'un écran refusait de se réduire et éjectait le volet de 380 px dès qu'on
  resserrait à 1000 px. `min-w-0` sur la colonne qui doit céder. ⚠️ **Aucun essai d'écran ne
  peut voir ça** — jsdom ne fait pas de mise en page, les éléments n'ont pas de largeur, et
  l'assertion passe pendant que la fenêtre déborde. C'est le second atelier qui le trouve, pas
  la suite. Payé le 8 septembre 2026, en `B10`.
- **Une bande écrite directement dans le dépôt (sans passer par un clip réel) disparaît de
  l'index au premier redémarrage du serveur.** `tests/test_b11.py` pose ses bandes à la main,
  comme `test_a12.py` le fait déjà — `Bande(...)` puis `atelier.base.enregistrer_bande(...)`,
  sans jamais faire exister le clip qu'elles nomment. Ça tient en test parce qu'un test ne
  redémarre jamais l'atelier. Un atelier jetable, si : `ServiceBibliotheque.ouvrir()` déclenche
  `reconstruire()` dès que la table `generations` est vide (le cas d'un atelier qui n'a encore
  rien généré), et `reconstruire()` ne relit une bande que si `clip in connus` — l'ensemble des
  générations trouvées sur le disque. Une bande dont le clip est inconnu est traitée comme une
  bande dont le clip a disparu : filtrée en silence, alors que sa fiche JSON est toujours là.
  ⚠️ **Le symptôme trompe** : le résumé imprimé juste avant `uvicorn.run()` (même processus,
  même `ouvrir()` d'avant) montre les bonnes bandes ; l'écran ouvert dans le navigateur (après
  le second `ouvrir()`, au démarrage d'`uvicorn`) les montre toutes vides. Un atelier jetable
  qui pose des bandes à la main doit donc aussi poser, par bande, une `Generation` minimale
  (`atelier.fichiers.ecrire_enregistrement` puis `atelier.base.enregistrer`) — voir
  `essais/atelier_jetable_b11.py::_poser_un_clip`. Payé en vérifiant au navigateur le
  9 septembre 2026, en `B11`.
- **Huit secondes, c'est le temps de cliquer trois fois, pas de regarder une capture.**
  `ANNULATION_S` (8 s) court depuis l'instant où `supprime_le` est posé, pas depuis l'ouverture
  de l'écran. Une bande écartée au montage d'un atelier jetable est donc déjà hors délai le
  temps qu'un humain (ou un outil de navigateur, plus lent encore) navigue jusqu'à l'écran et
  clique « restaurer » : le serveur répond `409` et a raison de le faire. Pour vérifier le
  vrai chemin de restauration, il faut écarter **depuis l'écran, en direct**, et cliquer
  « restaurer » tout de suite après — pas relire un état écarté au montage. Et un `POST
  /strips/delete` ou `/restore` balaie au passage **tous** les écarts expirés du sujet, pas
  seulement celui qu'on vient de nommer (`ServiceMontage.ecarter` appelle `purger()`) : une
  puce « N écartée(s) » posée au montage peut donc disparaître pour de bon après un clic fait
  ailleurs sur le même écran. Payé le 9 septembre 2026, en `B11`.
- **`GET /api/clips/engine` retrouve le moteur de la maison *par son nom*, pas par sa place.**
  `atelier/api/animation.py::_moteur` parcourt les animateurs montés et compare
  `porte.nom` à `atelier.fournisseur.maison.NOM` (`"Maison"`) ; s'il ne le trouve pas, il lève
  un `HTTPException` 404. Un atelier d'essai qui monte un animateur double appelé autrement —
  « Muet », par exemple — fait donc répondre 404 à une route qui existe, et l'écran affiche un
  message de machine. ⚠️ **Aucun essai d'écran ne peut le voir** : ils doublent `fetch` et
  servent la réponse qu'ils veulent. Un atelier jetable qui veut montrer l'étape ComfyUI doit
  nommer son double `NOM_MAISON` et lui donner `visiter()` et `telecharger()`. Payé en
  vérifiant au navigateur le 9 septembre 2026, en `B15`.
- **Un refus levé par `HTTPException(detail={"raison": ...})` arrive à l'écran en langage de
  machine.** Le client (`interface/src/api.ts`, `appeler()`) lit `charge?.raison` **à la
  racine** de la charge, et retombe sinon sur `l'atelier a répondu ${status}`. Les
  `ErreurAtelier` passent bien — le gestionnaire d'exceptions de `app.py` les met à plat —,
  mais FastAPI emballe le détail d'une `HTTPException` dans `detail`, et la raison est perdue.
  Une route qui veut être comprise doit lever une `ErreurAtelier`, pas une `HTTPException`.
  Relevé le 9 septembre 2026, en `B15` ; la seule occurrence atteignable date d'`A11`.
- **Le serveur met la virgule dans ses *phrases*, jamais dans ses *nombres*.**
  `maison.py::_virgule` écrit « il manque 26,5 Go » ; le même objet JSON rend `go: 8.7`,
  `memoire_libre_go: 6.9`, `go_a_telecharger: 26.5` — nus, avec le point du JSON. Un écran qui
  interpole ces nombres directement affiche les deux notations à deux lignes d'écart. ⚠️ **Un
  essai d'écran ne l'attrape pas** : il assertait la chaîne telle qu'elle sortait, donc il
  confirmait la faute. Tout nombre servi par le serveur et destiné à être lu passe par un
  formateur — voir `Installation.tsx::gigas` et `::mesureDuDisque`. Payé au navigateur le
  9 septembre 2026, en `B15`.
- **Un libellé de navigation ne se compose pas à partir d'un titre.** `Revenir à ${titre}` et
  `Passer à ${titre}` donnaient « revenir à les images » et « passer à les animations » : il
  faudrait connaître le genre et l'article de chaque titre, ce qui ne se calcule pas. Chaque
  étape porte ses phrases écrites à la main, à côté de son titre — c'est le même raisonnement
  que `Secret.aucun` (F3), qui existe parce que le français a un genre. ⚠️ **Aucun essai ne
  regardait ces boutons** : ils sont décoratifs jusqu'au jour où on les lit. Payé au navigateur
  le 9 septembre 2026, en `B15`.
- **Deux valeurs justes, assemblées, peuvent mentir.** `GET /api/install` rendait le dossier
  **en service** (`Fichiers.racine`) et l'origine du **réglage** (`origine_du_dossier()`).
  Chacune était exacte ; ensemble elles faisaient afficher l'ancien chemin sous la phrase « il
  a été choisi ici », entre le clic de *Ranger ici* et le redémarrage — c'est-à-dire très
  exactement pendant la fenêtre de temps où l'auteur se demande si son geste a servi. La
  réponse porte maintenant les deux chemins séparément. ⚠️ **Et un champ « ce qui change au
  prochain démarrage » ne se calcule pas en comparant deux chemins** : tous les essais du
  dépôt et tous les ateliers jetables montent l'atelier sur une racine explicite, qui diffère
  du défaut sans que personne n'ait rien choisi. Il faut un réglage réellement posé
  (`origine != "defaut"`). Payé au navigateur le 9 septembre 2026, en `B15`.
- **Un double d'essai qui ne connaît pas une route ne rend pas une erreur : il rend la réponse
  de la route d'à côté.** `GET /api/characters/pieces/uses` (`B19`) ne correspondait à aucune
  branche du double d'`App.test.tsx` et retombait sur le vestiaire de `C3`, qui rend des pièces
  **nues**. L'écran lisait alors `p.piece.identifiant` sur un objet sans `piece`, et **736 essais
  cassaient d'un coup** — alors que le navigateur, lui, marchait très bien. C'est le même piège
  de rangement des routes que côté serveur (le segment littéral avant `{identifiant}`), mais il
  se paie plus cher : côté serveur la mauvaise route rend un 422 qu'on voit ; dans un double,
  elle rend un objet de la bonne forme apparente. ⚠️ **Quand une suite d'écran casse en masse
  pendant qu'un atelier jetable marche, chercher d'abord une route que le double ignore.** Payé
  le 9 septembre 2026, en `B19`.
- **Un renvoi « § » vers une planche `.dc.html` est cassé par construction.**
  `essais/essai_docs.py` n'indexe les titres que dans les fichiers Markdown : une planche HTML
  lui rend **zéro section**, donc aucun nom de section n'y répond jamais. Le renvoi de `lieux.ts`
  vers `Navigation.dc.html § Le fil` n'est pas refusé pour une seule raison — il nomme le fichier
  sans son chemin `docs/`, et le banc ne le voit donc pas du tout. ⚠️ **Citer une planche par son
  chemin, et nommer sa section en prose, jamais derrière un `§`.** Payé le 9 septembre 2026, en
  `B19`.
- **Deux tranches qui touchent la même chaîne peuvent la livrer deux fois, chacune à moitié.**
  `B16` a redessiné *Couleurs* et *Nettoyer* dans `Retouche.tsx` avec ses propres panneaux
  (`ReglagesDesCouleurs`, `ReglagesDuNettoyage`) pendant que `B17` ajoutait les quatre curseurs,
  l'échange de couleurs, le grain et le lissage à l'**ancien** écran (`Places.tsx` §
  `PanneauQuantification`/`PanneauBords`). Les deux suites passaient : chaque tranche testait son
  propre panneau, et aucune ne touchait le fichier de l'autre. Résultat, invisible tant que
  personne n'ouvrait l'écran neuf avec une recette qui posait ces six champs : les six moteurs de
  `B17` existaient, fonctionnaient, et n'avaient **aucun contrôle** sur l'écran que `PageDuSujet`
  ouvre réellement — `ReglagesDuNettoyage` reposait en plus `bords: { aire_min }` seul, prêt à
  effacer un grain ou un lissage déjà posés dès qu'on aurait touché la tache minimale (la panne
  de `decalage` / `E17`, une deuxième fois). ⚠️ **Une intégration entre deux écrans du même
  domaine ne se vérifie pas en relisant chaque tranche : il faut ouvrir l'écran que l'utilisateur
  ouvre.** Trouvé au navigateur en fusionnant `B16` et `B17`, en reposant la question que chacune
  avait déjà refermée de son côté. Réparé en important `quantificationDe`, `CURSEURS`,
  `PAIRE_VIDE` et `TOLERANCE_D_UNE_PAIRE_MAX` depuis `Places.tsx` plutôt qu'en les réécrivant une
  troisième fois. Payé le 10 septembre 2026, à la fusion de `B16` et `B17`.
- **`requestAnimationFrame` peut n'être jamais appelé alors que la page se dit visible.** Le
  métronome de `B12` — l'écran où l'on joue le personnage au clavier — avançait sur
  `requestAnimationFrame`, avec un accumulateur sur `performance.now()` pour ne pas dériver.
  Mesuré dans le volet navigateur de l'atelier : `document.visibilityState` vaut `visible`,
  `document.hidden` vaut `false`, et **rAF est appelé zéro fois par seconde**. L'animation est
  figée, la page se croit visible, et rien ne le dit — le seul symptôme est un compteur d'images
  qui ne bouge plus. ⚠️ **Aucun essai d'écran ne peut trouver ça** : jsdom ne compose rien non
  plus, et les essais mesurent le pas *annoncé*, pas le rythme *joué*. Il faut un script dans la
  vraie page qui compte les changements d'image sur quelques secondes — une capture d'écran ne
  juge pas un métronome. La sortie : battre sur `setInterval`, qui ne dépend pas du compositeur,
  et garder `performance.now()` comme horloge — chaque réveil demande *combien d'images se sont
  écoulées*, jamais *avance d'une*. Payé le 10 septembre 2026, en fermant `B12`.
- **`round` de Python et `Math.round` de JavaScript ne rendent pas la même chose sur un demi.**
  Python arrondit au **pair le plus proche**, JavaScript pousse vers le **haut**.
  `tests/test_tailles.py` avait déjà nommé le risque sur `cible × occupation` et prouvé qu'il ne
  mordait pas — aucune case du produit ne finit par 50. Sur la durée d'une image d'animation, il
  mord : `duree_en_ms(cadence)` vaut `round(1000 / cadence)`, et mille divisé par seize fait
  **exactement 62,5** — le serveur écrit 62 dans le descriptif d'export, `Math.round` aurait joué
  63, et seize images par seconde est une cadence d'animation ordinaire. ⚠️ **Ce qui le rend
  invisible, c'est que l'écart est d'une milliseconde** : personne ne le voit, aucun essai ne le
  lève, et le produit promet pourtant que *la vitesse jouée est celle qui sortira*. La sortie :
  reproduire l'arrondi du serveur dans `dureeImageMs` (`interface/src/api.ts`), et surtout **ne
  pas tenir deux tables de valeurs attendues à la main** — `tests/test_b12.py` extrait la vraie
  fonction TypeScript de `api.ts`, la fait tourner sous Node, et la compare à celle du serveur sur
  cent vingt-trois cadences. Deux tables auraient fini par ne plus dire la même chose, ce qui est
  la panne qu'on ferme, pas celle qu'on ouvre. Payé le 10 septembre 2026, en écrivant `B12`.
- **Trois lecteurs jouaient déjà une vitesse que rien n'exporte, et le dépôt promettait le
  contraire.** `atelier/domaine/bande.py` écrit noir sur blanc *« elle porte sa cadence, et il n'y
  en a qu'une »*, `Montage.tsx` *« cette vitesse est celle qui partira dans le jeu »*,
  `AtelierDeBande.tsx` *« c'est le même chiffre qui part dans le jeu »*. C'est vrai du **chiffre**
  et faux du **rythme** : les trois écrans jouent `1000 / cadence` en flottant, alors que le
  descriptif d'export et l'image animée prennent tous deux `duree_en_ms(cadence)`, un entier. À
  douze images par seconde l'écran joue 83,33 ms et le fichier 83. ⚠️ **La promesse écrite dans
  trois fichiers a servi de preuve** : personne n'a rouvert la question, parce que trois
  commentaires disaient qu'elle était réglée. `B12` corrige son propre lecteur ; les trois autres
  jouent encore le mauvais pas, et c'est un écart connu, pas un oubli — les corriger déplacerait
  le rythme de vignettes que personne ne chronomètre. Payé le 10 septembre 2026, en relevant `B12`.
- **Un fichier qu'on n'a pas mis dans la liste des sortants devient un fichier à effacer.**
  L'aperçu de la sortie (`B21`) ne comptait, dans son arbre, que les images et les planches : le
  descriptif et le catalogue du moteur étaient écrits **après**, hors du plan. Conséquence, à la
  seconde sortie dans le même dossier : le `descriptif.json` de la fois d'avant n'était dans
  aucune des deux listes, donc il s'annonçait comme *un reste à effacer* — un fichier que la
  sortie allait réécrire trois lignes plus bas. ⚠️ **Une comparaison entre deux listes n'est
  juste que si les deux sont complètes** ; un fichier écrit « en plus », hors du parcours qui
  décide, sera lu comme étranger par tout ce qui compare. Réparé en faisant du descriptif et du
  catalogue les deux derniers éléments du même générateur — ils y sont en queue parce qu'ils
  parlent des autres. Payé le 10 septembre 2026, en `B21`.
- **Un chemin affiché par son seul nom ment dès que deux dossiers coexistent.** L'arbre de la
  sortie groupe ses fichiers par dossier et n'écrit, sur chaque ligne, que le nom — ce qui est
  juste tant qu'un dossier surplombe la ligne. Les **restes**, eux, ne sont rangés sous aucun
  groupe : `personnages/le-pelerin-repos-est.png` s'affichait donc `le-pelerin-repos-est.png`,
  juste sous le fichier prévu `le-pelerin-repos-est.png` de la racine. Deux lignes identiques à
  l'œil, l'une « nouveau », l'autre « à effacer », et rien pour dire que ce sont deux fichiers
  différents. ⚠️ **Une liste qui n'est pas dans l'arbre porte son chemin entier.** Invisible aux
  essais d'écran, qui ne montaient qu'un cas à la fois ; trouvé en changeant le rangement au
  navigateur, ce qui est exactement le geste qui fait cohabiter les deux formes de chemin. Payé
  le 10 septembre 2026, en `B21`.
- **Une raison de grisé écrite deux fois fait douter qu'il s'agisse du même empêchement.**
  « aucun dossier de jeu — pose-le dans l'installation » paraissait sous le bouton **et** à la
  place de l'arbre vide. Les deux étaient vrais, et c'est le problème : à l'écran, un même refus
  répété à deux endroits se lit comme deux refus. ⚠️ **La raison va là où l'on va cliquer**
  (`docs/DESIGN.md`, *le grisé porte sa raison*) ; le vide, lui, dit seulement qu'il est vide.
  Trouvé par un essai d'écran qui refusait de choisir entre deux occurrences du même texte — le
  doublon était réel, pas une faute d'essai. Payé le 10 septembre 2026, en `B21`.
- **Un sujet créé dans une famille prend le type de cette famille, et ce type porte ses propres
  attitudes.** Un atelier jetable qui crée « Le tonneau » avec `famille: "objets"` puis lui
  impose les poses du **plan du jeu** reçoit un `409 production_refusee` : « Le tonneau ne tient
  pas la pose repos ». Le `PUT` des poses réussit pourtant — c'est la génération qui refuse, un
  geste plus loin, si bien que la faute paraît venir de la génération. ⚠️ **Les poses d'un sujet
  se lisent sur le sujet** (ses `cases`), jamais sur le plan du projet, dès que la famille n'est
  pas celle des personnages. C'est la règle d'`E9`, et elle se voit mal parce que les deux
  listes coïncident pour la famille par défaut. Payé le 10 septembre 2026, en `B21`.
- **Depuis un worktree, le python du dépôt principal importe le dépôt principal.** Le `.venv`
  porte le dépôt en installation modifiable, si bien qu'`import atelier` résout vers
  `C:\...\gag2\atelier` et **non** vers celui du worktree. `python -c` lancé depuis le worktree
  s'en tire — `sys.path[0]` y est le dossier courant —, mais `python C:\...\scratchpad\essai.py`
  met le dossier *du script* en tête et laisse l'installation gagner. ⚠️ **Le symptôme est un
  faux vert** : une vérification écrite pour du code neuf passe en mesurant le code de l'auteur,
  et une route qu'on vient d'ajouter n'apparaît nulle part sans qu'aucune erreur ne lève. Trouvé
  en cherchant pourquoi sept routes déclarées ne se retrouvaient pas dans l'application.
  **Poser `PYTHONPATH` sur le worktree pour tout ce qu'on y lance** — pytest compris. Payé le
  10 septembre 2026, en `B20`.
- **Un axe neuf sur un objet déjà rangé recompte les cases d'une autre matrice.** `Bande` gagne
  un champ `piece` en `B20`, et une bande habillée est une bande à part entière — comme un
  calque est un asset à part entière depuis `C3`. Le compte des images tenait déjà le
  `piece IS NULL` qui sépare un corps d'un calque ; celui des bandes ne l'avait pas, faute d'axe
  à séparer. Sans lui, habiller la marche du goliath remplissait la case *marche* **une seconde
  fois** : la matrice de `B11` annonçait deux animations là où le personnage n'en a qu'une, et
  la seconde ne s'était jamais découpée. Deux endroits à corriger, et ils ne se ressemblent
  pas — `Base.bandes_par_pose` (en SQL) et `ServiceProduction.cases()` (en Python).
  ⚠️ **Quand on ajoute à un objet l'axe qui sépare déjà un autre calque du produit, chercher
  tous les endroits qui comptent cet objet — le filtre existe ailleurs, tout écrit, et c'est
  qu'il manque ici.** Payé le 10 septembre 2026, en `B20`.
- **Une pièce née hors d'une fiche ne montre aucun emploi, et ses calques n'y changent rien.**
  `B19` a tranché qu'une pièce créée par la route naît **déclarée vide**, et qu'une pièce
  déclarée ne consulte plus ses calques — sans quoi un porteur retiré reparaîtrait à la
  relecture suivante. Conséquence pour tout décor monté par les routes :
  `POST /api/characters/pieces` sans `porteur` donne une pièce que le carnet affiche « aucun
  emploi » **même après lui avoir posé six calques**. L'atelier jetable de `B20` s'est monté
  ainsi, et l'écran de la tranche n'avait alors aucune porte d'entrée — alors que le serveur,
  lui, répondait juste : la matrice se demande par *(pièce, porteur)* et n'a jamais eu besoin
  d'un emploi. ⚠️ **Un décor d'essai monté par les routes n'est pas un disque d'avant la
  tranche**, et les deux ne se lisent pas pareil ; passer `porteur` à la création est le geste
  qui les raccorde. Payé au navigateur le 10 septembre 2026, en `B20`.
- **Un aperçu qui compose et une planche qui n'en sait rien mentent d'accord.** `B20` fait
  d'une bande habillée une bande comme les autres, donc `ServiceMontage.planche` la sert — et
  il assemblait les images du **corps nu** sous le nom de l'habillée. Rien ne levait, et rien
  ne se voyait : l'écran montre l'aperçu, qui compose bien la pièce ; seul l'export aurait
  sorti le corps seul, et l'écart se serait découvert en ouvrant le fichier dans le moteur de
  jeu. ⚠️ **Quand une tranche ajoute un état à un objet, chercher tout ce qui rend cet objet en
  pixels — pas seulement ce qui l'affiche.** Un aperçu et un rendu définitif qui passent par
  deux chaînes différentes finissent toujours par diverger ; ici la réparation a été de faire
  passer les deux par la même fonction (`habiller_les_images`), et non d'en corriger une.
  ⚠️ **Et la mesure doit être en octets** : deux planches assemblées des mêmes images avec et
  sans la pièce ne peuvent pas être identiques, alors qu'un essai qui compterait les images ou
  vérifierait les dimensions serait passé dans les deux cas. Trouvé en relisant la tranche
  avant de commiter, le 10 septembre 2026, en `B20`.
- **Un champ neuf sur un objet partagé casse la fixture d'une tranche voisine, jamais la
  sienne.** `B20` ajoute cinq champs requis à `Bande` (`piece`, `habillage`, `habillee`,
  `calages`, `calage_garde`). `tests/**/EssaiDuSujet.test.tsx` (`B12`) construit ses bandes de
  test avec une fabrique locale qui n'en connaissait aucun — et `B12` avait fusionné avant que
  `B20` n'existe, donc rien ne pouvait l'avertir. `tsc -b` ne l'a levé qu'à la fusion de `B20`,
  sur un fichier que `B20` n'a jamais touché. ⚠️ **Deux tranches parallèles qui partagent un
  type ne se voient qu'à la fusion** : chacune passe ses propres essais, et c'est le
  vérificateur de types sur l'arbre entier — pas un essai — qui a trouvé l'écart. Réparé en
  complétant la fabrique avec les cinq valeurs neutres. Payé le 10 septembre 2026, en fusionnant
  `B20`.
- **Une fenêtre « les plus récentes » sans `WHERE projet` se venge sur le jeu le plus calme.**
  `GET /clips` lisait `ServiceGenerations.recentes(limite)` — les générations les plus
  fraîches, tous jeux confondus — exactement comme `chantier()` le fait déjà pour la mémoire de
  session. Un jeu qui n'a produit qu'un seul clip, il y a une heure, se fait chasser de cette
  fenêtre dès qu'un autre jeu a généré ne serait-ce que huit images depuis : rien ne l'annonce,
  la route rend 200, une liste simplement plus courte. C'est très exactement le symptôme qu'un
  clip payé « disparaît après la fermeture de son lot » — le vrai coupable n'était pas le lot
  qui ferme, c'était l'absence de tout `projet` dans la requête. ⚠️ **Une liste qui se dit
  « la plus récente » sans préciser *la plus récente de quoi* est fausse par construction dès
  qu'un second flux de faits existe** — ici, un second jeu. `Base.generations_du_projet(projet,
  limite)` existait déjà, employée ailleurs, et scoper dessus au lieu de la fenêtre globale
  suffit ; la route garde son ancien sens quand `projet` est omis, pour ne rien casser chez qui
  l'appelait déjà sans lui. Trouvé au relevé, avant d'écrire une ligne côté écran, et rejoué en
  essai (`test_un_clip_peu_actif_ne_se_fait_pas_chasser_par_un_autre_jeu`) plutôt que constaté au
  navigateur. Payé le 8 septembre 2026, en `B22`.
- **`Get-Content` puis `Set-Content` réécrit un fichier français en charabia.** Couper la queue
  d'un fichier source paraît anodin — lire les lignes, en garder les 2 097 premières, réécrire.
  Dans Windows PowerShell 5.1, `Get-Content` décode en page de codes ANSI et `Set-Content
  -Encoding utf8` réencode **avec** une marque d'ordre d'octets : `déménagé` devient
  `dÃ©mÃ©nagÃ©`, `—` devient `â€"`, et un `git diff` annonce 548 lignes changées là où on en
  attendait dix. Rien ne lève : le fichier reste du TypeScript valide, et l'accent est faux dans
  toutes les phrases du produit. ⚠️ **Aucun outil PowerShell ne doit toucher au contenu d'un
  fichier source de ce dépôt** — `Edit`/`Write` pour une modification, et `head -n N fichier >
  copie && mv` sous Git Bash pour une coupe, qui travaille en octets et ne décode rien. La
  parade quand c'est déjà arrivé : `git checkout -- <fichier>` et refaire, plutôt que corriger
  les accents un à un. Payé le 9 septembre 2026, en `B23`.
