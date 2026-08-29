# Asset Kitchen — Pièges connus

Quatre-vingt-quatre pièges, chacun payé une fois. Un piège n'entre ici que s'il a **coûté** —
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
  l'UTF-8 lève sur le tout premier octet. `lire_cle()` essaie plusieurs encodages — toute
  autre lecture de fichier écrit au terminal Windows doit faire pareil.
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
