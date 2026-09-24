# Les bancs — ce qui se mesure au lieu de se supposer

> Descendu d'`AGENTS.md` § Lancer le 6 septembre 2026, **sans qu'un mot change**. Le catalogue
> pesait 13 Ko d'un document qui s'ouvre à chaque séance, pour une liste qu'on ne consulte
> qu'en cherchant un banc précis.
>
> `AGENTS.md` garde les commandes qu'on tape vraiment : installer, lancer, `pytest -q`,
> `npm test`, `py essais/essai_docs.py` et `py essais/essai_jetons.py`.
>
> **`essai_jetons.py` est le second de la paire, posé par `B0` le 6 septembre 2026.** Il ne
> mesure rien du produit : il confronte `interface/src/index.css` à ce que le code écrit,
> **dans les deux sens**. Le sens qui refuse a trouvé quinze emplois de couleurs déclarées
> nulle part au premier lancement ; le sens qui compte ne refuse rien — il liste les jetons
> que rien n'emploie, parce qu'un jeton inemployé est soit une pièce pas encore dessinée,
> soit un jeton mort, et **seul un humain sait lequel**. Gratuit, sans réseau, sans atelier.
>
> ⚠️ **Les payants ne partent qu'à la main.** Chaque ligne dit ce que le banc coûte, et quand
> elle dit GRATUIT elle dit aussi pourquoi.

```
py essais/essai_couverture.py        la couverture du fournisseur, gratuit
py essais/essai_pollinations.py      l'adaptateur du fournisseur sans clé, contre le vrai
                                     fournisseur. GRATUIT — deux appels, un jeton chacun,
                                     aucun dollar, et une trentaine de secondes d'attente
                                     entre les deux : le palier sans compte n'accepte qu'un
                                     appel toutes les quinze secondes. C'est le seul essai
                                     qui prouve la promesse de F1 — *sans compte, sans clé,
                                     une image arrive* — et le seul qui lise chez lui
                                     l'en-tête de consommation de F2. **Il demande une phrase
                                     que personne n'a demandée**, l'horodatage compris : la
                                     même phrase reviendrait de son cache, sans en-têtes, et
                                     l'essai vérifierait le cache en croyant vérifier
                                     l'adaptateur (`docs/PIEGES.md`)
py essais/maquette_v3.py             les images de la maquette de la V3, refaites depuis un clip
                                     déjà payé. GRATUIT — rien ne part chez un fournisseur. Il
                                     écrit ses planches dans
                                     `docs/archive/maquettes-v3/01-du-sprite-a-la-bande.html`, qui reste
                                     un fichier qu'on ouvre d'un double-clic. La page se fige
                                     par `?fige` ou la barre d'espace : sans ça elle ne se
                                     laisse pas photographier (`docs/PIEGES.md`)
py essais/essai_pixel.py             brut contre traité, sur les images déjà là, gratuit
py essais/essai_fenetre_commune.py   la dérive de cadrage d'un clip à l'autre — A2. GRATUIT :
                                     il lit un clip déjà payé et n'en commande aucun. Il ne
                                     mesure **pas** la taille du sprite rendu — un personnage
                                     qui marche est plus large qu'un personnage au repos, et
                                     ce chiffre-là mélangerait la pose et le cadrage — mais
                                     **le facteur appliqué**, qui doit être constant dans un
                                     clip. `--clip <chemin>` pour un autre que le moonwalk.
                                     Sortie : `essais/mesures_fenetre_commune.json`, qui
                                     s'accumule par clip au lieu de s'écraser
py essais/essai_superposition_cadre.py   ce que le découpage du coin gardait, et ce qu'il
                                     jetait — sur les pièces d'équipement du dépôt. GRATUIT,
                                     et **en lecture seule sur `donnees/`** : l'atelier de
                                     l'auteur peut tourner à côté. C'est lui qui a montré que
                                     le geste de G16 était cassé pour les neuf pièces et non
                                     pour deux. Sortie : `essais/mesures_superposition_cadre.json`
py essais/essai_couleurs_et_taches.py  les deux dernières places de la recette — le nombre de
                                     couleurs, la palette, le tramage, les taches et l'aire
                                     minimale. Gratuit, sur les images déjà là ; c'est lui
                                     que citent les maquettes 14 et 15. Depuis le 31 août
                                     2026 il pèse aussi les **deux curseurs de fusion d'une
                                     palette** — la proportion et l'attraction — et c'est ce
                                     qui a levé le blocage de l'étape E11
py essais/essai_ce_qui_part.py       ce que l'univers pose et ce qui part vraiment — le poids de
                                     la bible dans le prompt, les générations qui l'ont portée,
                                     ses contradictions avec le projet et avec la consigne de
                                     reprise, ce que le nombre de couleurs achète, et le tableau.
                                     Gratuit, sur les projets déjà là ; c'est lui que cite la
                                     maquette 06
py essais/essai_palette_vive.py      le temps d'un relâchement de curseur sur une palette,
                                     avant et après U6 : 11 500 ms contre 25 sur trois vraies
                                     cartes, mesuré le 1er septembre 2026. Gratuit, et il
                                     n'écrit rien du jeu — il monte un atelier jetable dans
                                     un dossier temporaire et emprunte des octets
py essais/essai_moteurs_de_detourage.py  les cinq moteurs de détourage par modèle mis côte à
                                     côte, sur quatre images du dépôt. GRATUIT — rien ne part
                                     chez un fournisseur, tout tourne sur le processeur. **Le
                                     premier lancement rapatrie les modèles manquants depuis
                                     github.com/danielgatis/rembg — 382 Mo pour les deux qui
                                     manquaient le 3 septembre 2026, et non les 257 annoncés :
                                     l'allégé pèse 214 Mo, pas 88,6** ; les lancements suivants
                                     ne téléchargent rien. Il compte la part de l'image gardée,
                                     le temps, et surtout **l'ajouré trouvé** — c'est la seule
                                     colonne qui sépare les moteurs, et c'est elle qui a fait
                                     changer le moteur par défaut. Comptez trois minutes
py essais/essai_export.py            l'archive rouverte, sur ce que l'atelier a — gratuit
                                     (demande un atelier lancé)
py essais/essai_premiere_image.py    UN APPEL PAYANT, ~$0,006
py essais/essai_univers_chaine.py    UN APPEL PAYANT, ~$0,023 — la chaîne de T4 de bout en bout
py essais/essai_decoupe_planche.py   UN APPEL PAYANT, ~$0,004 — une vraie planche, découpée
py essais/essai_prix_planche.py      TROIS APPELS PAYANTS, $0,081 le 31 août 2026 — ce qu'une
                                     planche coûte par image selon son nombre de cases. Son
                                     relevé, `essais/mesures_prix_planche.json`, est versionné :
                                     c'est lui que l'écran de `E13` lira, et un prix mesuré qui
                                     ne serait pas dans le dépôt serait un prix en dur
py essais/essai_animation.py         BANC PAYANT, $2,87 le 1er septembre 2026 — huit modèles,
                                     la même demande à tous : le prompt du produit et ses
                                     trois images, relus dans une vraie génération. Sans ça
                                     le banc mesurerait autre chose que ce que le produit
                                     envoie. Sortie : `essais/resultats_animation/`
py essais/essai_recette.py           BANC PAYANT, $2,45 le 1er septembre 2026 — vingt-neuf
                                     demandes au même modèle, sept axes. Il a un **plafond
                                     cumulé** : il relit ce qui est déjà sur le disque et
                                     n'engage que la différence, donc une reprise ne repaie
                                     pas la séance. Sortie : `essais/resultats_recette/`
py essais/banc_complet.py            les deux bancs d'animation repassés par UN SEUL juge —
                                     gratuit, tout est sur le disque. Sortie : `essais/tout.json`
py essais/verdict_auteur.py          les mêmes, reclassés sur les NOTES DE L'AUTEUR, et la
                                     confrontation des deux jugements — c'est elle qui a
                                     montré que la mesure automatique ne prédisait rien.
                                     Gratuit. Entrée : `essais/notes-auteur.json`.
                                     Sortie : `essais/verdict.json`
py essais/rapport_tout.py            les 111 animations qui tournent, avec leur note, leur
                                     consigne, leurs images jointes et leur prix — gratuit,
                                     ~12 Mo. C'est en s'en servant qu'on a vu que la mesure
                                     était fausse. Sortie : `essais/rapport-animation.html`

pytest -q tests/test_essais_socle.py  les fonctions pures du socle des six essais du
                                     2 septembre 2026, sur le double, sans un centime
py essais/essai_references_nommees.py --a-sec   E1 — les références nommées. Le premier
                                     lancement de chaque essai est À SEC : il montre ce
                                     qui partirait — textes, différence mot à mot, images
                                     avec rôle et taille, appels, coût — et n'engage rien.
                                     Sans `--a-sec` : PAYANT. Refait le 2 septembre 2026 après
                                     une première séance à 0 bonne sur 8 : un témoin neuf et
                                     trois textes neufs — rangé, rangé avec priorité des images,
                                     réécrit par l'IA — à DEUX tirages chacun (~$0,25), avec
                                     les artworks officiels que le personnage désigne, dans
                                     l'ordre du produit ; plafond $0,60. Sortie :
                                     `essais/resultats_references_nommees/`,
                                     `essais/rapport-references-nommees.html`
py essais/essai_taille_reference.py --tirages 2   E2 — la référence en 64, 256 ou 512 px.
                                     QUATRE APPELS PAYANTS à deux tirages (~$0,14, la
                                     surface se paie), plafond $1,00. Le témoin est celui
                                     de E1 avec les artworks du jour, relu sans repayer.
                                     Sa taille retenue est relue par E4 et E5
py essais/essai_grille_complete.py --tirages 2    E3 — la grille 4×2 au lieu de 3×3.
                                     QUATRE APPELS PAYANTS à deux tirages (~$0,11),
                                     plafond $0,40 ; même témoin que E2
py essais/essai_mise_en_pose.py      E4 — la « prep » de SpriteCook, en deux temps : huit
                                     images seules (~$0,10), l'auteur en choisit une dans
                                     le rapport, puis huit planches (~$0,20). PAYANT,
                                     plafond $0,50 par lancement
py essais/essai_pose_imposee.py      E5 — la pose imposée par image, une exploration :
                                     UN APPEL PAYANT par pose (`--poses contact,passage`
                                     fait un tour à ~$0,03), quatre tours au plus, un seul
                                     correctif par tour, `--bande` pour le cinquième
                                     (huit appels, ~$0,14). Plafond $0,50 par lancement.
                                     Le script demande « ce que j'attends » et « ce qui
                                     peut rater » avant chaque envoi (`--attendu`,
                                     `--peut-rater` pour les passer sans terminal)
py essais/essai_video_planche.py     E6 — le sprite animé par un modèle image-vers-vidéo
                                     chez fal.ai (`FAL_KEY` dans `.env`, hors du produit).
                                     REFUSE DE PARTIR tant que l'endpoint et le prix du jour
                                     ne sont pas recopiés dans `essais/resultats_video/mesures.json`.
                                     Deux clips par modèle, trois modèles (Wan 2.2 5B,
                                     Seedance 1.0 pro fast, Kling 2.1 standard), cinq à
                                     vingt-huit centimes le clip relevés le 2 septembre
                                     2026, ~$0,96 en tout, plafond $3,00. Demande
                                     `uv pip install -e ".[essais-video]"` pour lire les clips
py essais/monter_bande_video.py      les huit images d'un cycle figé dans le rapport de E6,
                                     passées dans la chaîne du produit sur une fenêtre
                                     commune — gratuit
py essais/verdict_essais.py          les six relevés `essais/notes-<essai>.json` relus, et
                                     chaque règle du cahier appliquée telle qu'écrite —
                                     gratuit, ne conclut rien au-delà

py essais/banc_miroir_ts19.py preparer --sujet elias
                                     TS19 — la planche des directions sort-elle encore en
                                     miroir ? `preparer` est GRATUIT : il copie le jeu du
                                     sujet dans un dossier temporaire et montre les deux
                                     textes (sans et avec la phrase « the same subject from
                                     opposite sides, not a mirrored copy ») et le prix.
                                     `payer --sujet elias` : BANC PAYANT, seize appels —
                                     huit par phrase, alternés — sur
                                     `OpenRouter:openai/gpt-image-2.5-sunburst`. Prix
                                     annoncé : **environ $0,80** (un appel ≈ $0,05, relevé
                                     sur les deux planches d'Elias du 24 septembre 2026 :
                                     $0,031 et $0,071, donc entre $0,50 et $1,15). Il
                                     annonce le prix du jour et attend « oui » ; plafond
                                     $1,50 (`--plafond`). Se lance depuis le dépôt
                                     principal (il lit `donnees/`) ; l'atelier de l'auteur
                                     n'est pas touché. Il relève le signal « ces deux vues
                                     sont un miroir » et l'écart de chaque paire ; le
                                     verdict se fait à l'œil. Sortie :
                                     `essais/resultats/miroir-ts19/`
```

Les six essais et leur cahier vivent dans `revue-externe-2026-09-02/cahier-des-essais.md`,
hors de `docs/` : ils décrivent des essais, pas le produit. Leur socle commun est
`essais/socle_essais.py`.

