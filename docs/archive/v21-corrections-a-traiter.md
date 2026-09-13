# V2.1 — les corrections à traiter dans le dossier des maquettes

> Écrit le 31 août 2026, après une relecture croisée des vingt-six fichiers de
> `docs/archive/maquettes-v2.1/` — les vingt-cinq maquettes et leur sommaire — confrontés
> les uns aux autres, puis aux documents d'autorité du dépôt.
>
> **Ce document ne fait autorité sur rien, et ne tranche rien.** Il tient la
> liste de ce qui ne s'accorde pas dans le dossier : deux maquettes qui
> dessinent le même écran différemment, un fichier qui se contredit lui-même, un
> chiffre présenté comme mesuré qui n'est pas le même d'une page à l'autre, une
> décision prise une fois et jamais reportée. Rien de tout ça n'est une question
> de conception — ce sont des écarts d'écriture, et chacun se corrige en
> choisissant laquelle des deux versions est la bonne.
>
> **Ce qu'il n'est pas.** Les décisions prises sans que personne les demande, et
> les questions de fond encore ouvertes, vivent dans
> [`v21-arbitrages.md`](v21-arbitrages.md) et n'ont pas à être recopiées ici.
> Quand un écart d'ici est déjà tranché ailleurs, la ligne le dit et renvoie —
> il ne reste alors qu'à appliquer.
>
> **Comment s'en servir.** Chaque point porte un identifiant stable, ce qui
> diverge, où exactement, et ce qui décide quand quelque chose décide. Un point
> corrigé se barre au lieu de disparaître : c'est la raison qui a de la valeur,
> pas la ligne.
>
> **Où ce document est cité.** Deux endroits y renvoient, et un seul point par
> endroit : le § 03 du sommaire du dossier des maquettes, juste sous son titre —
> parce que c'est ce paragraphe-là qui annonce que le chantier se ferme —, et
> l'en-tête de [`v21-arbitrages.md`](v21-arbitrages.md), parce que sa règle de
> conflit ne couvre pas le cas traité ici.

> **Où on en est. Les soixante-deux points sont traités**, le 31 août 2026, dans
> l'ordre du document — sections A à H. Un point traité garde son titre barré et
> un encadré qui dit ce qui a été décidé, pourquoi, et quels fichiers ont bougé.
>
> **Les documents d'autorité ont été ouverts en section F**, sur autorisation
> explicite : le document du produit, l'architecture et le document du design
> portent chacun une correction, et chacune est datée sur place. C'est la première
> fois que ce chantier écrit hors du dossier de maquettes autrement que par
> report.
>
> **Un instrument de mesure a été trouvé en route.** Le dépôt porte sa propre base
> de données, `donnees/atelier.sqlite3` — 53 images, 28 générations, 3 projets —
> et les bancs d'essai de `essais/` gardent leurs relevés en clair. Les chiffres
> que les maquettes annoncent comme lus dans le dépôt peuvent donc se recompter au
> lieu de se croire. C'est ce qui a corrigé C-13, et c'est ce qui a permis de
> comprendre la section D — sans pour autant la corriger comme elle le demandait.
>
> **La section D a changé de sens en route.** Elle reprochait à sept chiffres de
> ne pas tenir la règle *« un chiffre cité est un chiffre mesuré »*. Le recompte a
> montré que le fautif était la règle : ces nombres bougent tous les jours, parce
> que l'atelier sert tous les jours — la base est passée de 24 appels payés à 23
> pendant qu'on lisait. **Une maquette n'est pas un rapport sur le dépôt.** La
> règle a donc été remplacée, la décision D28 étendue à tout le dossier, et les
> chiffres d'illustration sont désormais annoncés comme tels là où ils paraissent.

**Soixante-deux points**, rangés du plus coûteux au plus anodin :
cinq arrêtent quelqu'un qui construirait un écran demain,
dix opposent deux maquettes,
quatorze opposent un fichier à lui-même,
sept portent sur des chiffres annoncés comme mesurés,
sept sur les mesures de l'interface,
six sur des reports décidés et jamais appliqués,
sept sur ce que le sommaire annonce et qui ne se vérifie pas,
et six sur ce qui n'est défini nulle part.

---

## ~~A · Ce qui arrête quelqu'un qui construirait demain~~

Cinq points. Ils ne se corrigent pas en changeant un mot : il faut décider
laquelle des deux versions est le produit.

> **Les cinq sont traités — 31 août 2026.** Les quatre qui changeaient ce que le
> produit fait ont été tranchés par l'auteur ; le cinquième (A-2) se lisait dans
> les fichiers. Ce qui a été décidé est écrit sous chaque point, et appliqué dans
> les maquettes.

### ~~A-1 · La planche d'une pose paie, et la règle dit que deux écrans seulement paient~~

> **Tranché et appliqué le 31 août 2026 — la planche est une profondeur de
> l'établi, pas un troisième lieu.** Elle s'ouvre depuis l'établi d'une chose et
> *Échap* y ramène : c'est le même endroit vu de plus près, une pose au lieu de
> toute la matrice. Sa barre qui paie reste telle quelle, et la règle *« les
> lieux d'où l'argent part restent deux »* reste vraie mot pour mot — le premier
> des deux se lit désormais *l'établi d'une chose, sa planche comprise*.
>
> **Rien à changer dans le document du produit**, dont la phrase servait de
> raison écrite au refus d'une barre dans la galerie. La précision a été ajoutée
> aux quatre endroits qui pouvaient laisser croire le contraire :
> `02-etabli-personnage` § 03, `05-codex` § 08, `08bis-ecran-de-confirmation`
> § 07 (sous sa table des trois portes) et `07bis-fiche-entite` § 04.

**La règle**, écrite dans sept fichiers du dossier et reprise dans le document
du produit : *les lieux d'où l'argent part restent deux — l'établi d'une chose
et le codex*. Elle sert de justification à la galerie qui perd son champ de
saisie, et au refus d'en remettre un dans l'univers.

**Le dessin dit autre chose.** `08-planche-de-pose` § 03 dessine une barre de
paiement complète : la bande *« Pour marche · nord · sud · est · ouest »*, le
texte assemblé, le bouton `Fabriquer la planche $0,023`, le raccourci
`Ctrl + Entrée`. Et `07bis-fiche-entite` § 04 l'écrit noir sur blanc dans son
tableau : *« La planche d'une pose — barre de prompt : présente — c'est l'écran
où l'on achète les images d'une pose »*.

`08bis-ecran-de-confirmation` porte les deux versions dans la même section : son
§ 07 liste **trois portes** — l'établi, le codex, la planche — tout en écrivant
*« les endroits d'où l'on paie passent de trois à deux »*, et son § 09 s'adresse
aux *« trois écrans qui portent la barre de saisie »*. Pendant ce temps
`02-etabli-personnage` § 03 et `05-codex` § 08 disent que cette barre est en pied
de l'établi et du codex **« et nulle part ailleurs »**.

**Ce qui pèse.** La règle a déjà voyagé jusqu'au document du produit — elle y est
la raison écrite d'un rejet (*« une barre de saisie dans l'univers, ou dans la
galerie : les lieux d'où l'argent part restent deux »*). Si la planche est un
troisième lieu, c'est cette phrase-là qu'il faut réécrire, pas seulement une
maquette. Si elle n'en est pas un, c'est son croquis qu'il faut refaire.

### ~~A-2 · Dans le codex, l'endroit qui paie est décrit à deux endroits et dessiné nulle part~~

> **Appliqué le 31 août 2026 — c'est la colonne de droite, et le croquis avait
> raison.** Deux des trois phrases et le dessin disaient déjà la même chose ; la
> troisième était l'intruse. Le § 08 disait *« en pied du codex »*, il dit
> maintenant *« en pied de la colonne de droite du codex »*, et renvoie
> explicitement à ce que le croquis du § 03 montre : la fente qui dit
> *15 cases · 5 planches* et le bouton *Fabriquer ce qui manque*. La même
> correction a été portée dans `02-etabli-personnage` § 03, qui recopiait la
> phrase.
>
> **Le second champ n'existe pas.** Le champ qui nomme, en dernière rangée de la
> liste, n'est pas un champ de saisie payant — le § 03 le disait déjà, et rien
> n'a eu à changer.

Trois réponses dans le même fichier, `05-codex` :

- § 08 : la barre de paiement est *« rendue en pied de l'établi et **en pied du
  codex** »* ;
- § 03 : *« dans le codex c'est **la barre de droite**, pas cette rangée-ci »* ;
- son croquis : **ni l'une ni l'autre**, seulement un bouton
  `Fabriquer ce qui manque ≈ $0,07` au bas de la colonne de droite.

À quoi s'ajoute que le champ qui nomme, dessiné en dernière rangée de la liste,
*« n'est pas un champ de prompt »*. Le codex porterait donc deux champs de
saisie, dont un seul est dessiné.

**Ce qui manque pour trancher** : rien. Il faut choisir entre une barre en pied,
identique à celle de l'établi, et un bouton dans la colonne de droite — et
redessiner le croquis en conséquence.

### ~~A-3 · L'assistant propose neuf tailles d'image, la table qui les applique en accepte sept~~

> **Tranché et appliqué le 31 août 2026 — la table gagne 8 et 256.** Neuf valeurs
> partout : `8 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 256`. Un jeu réglé sur 8 ou
> sur 256 pixels peut désormais appliquer sa propre taille, ce qu'aucun outil ne
> savait faire.
>
> Touché dans `13-table-grille` : les segments du croquis, l'annotation 01 et le
> domaine du réglage au § 04. **La largeur a été mesurée sur le croquis rendu**,
> pas calculée : les neuf segments tiennent sur une seule rangée dans les 284 px
> de la colonne — 28 px chacun, 4 px d'écart, et une étiquette de trois signes à
> 10 px de mono en occupe 18. Rien ne déborde, et c'est la limite : une dixième
> valeur ne tiendrait pas. L'annotation le dit. Le banc d'essai de la table gagne
> ces deux valeurs. Les dix-sept vignettes d'exemple à produire restent dix-sept.

`06ter-assistant-demarrage` § 04 et `06-univers` § 04 posent **neuf tailles**
classiques : 8, 16, 24, 32, 48, 64, 96, 128, 256 — chacune avec sa vignette
d'exemple à produire.

`13-table-grille` § 03 écrit : *« Sept valeurs de cible… ce sont les sept que le
produit accepte déjà — 16 24 32 48 64 96 128 »*, et son § 04 donne le même
domaine au réglage.

**Conséquence concrète** : un jeu réglé sur 8 ou sur 256 pixels n'a pas d'outil
pour appliquer sa propre taille. Soit la table gagne deux valeurs, soit
l'assistant en perd deux — et dans ce second cas, deux des dix-sept vignettes
d'exemple à produire n'ont plus de raison d'être.

### ~~A-4 · L'assistant liste huit vues de jeu, le codex en dessine neuf~~

> **Tranché et appliqué le 31 août 2026 — la neuvième vue disparaît, huit
> partout.** La ligne *libre · n directions · l'auteur nomme les siennes ·
> l'auteur écrit la sienne* est retirée de la table du § 05 du codex, et un
> encadré y dit pourquoi : tout l'intérêt du choix de la vue est qu'il écrit tout
> seul la liste des directions et la phrase en anglais. Une vue « libre »
> redemande à l'auteur d'écrire cette phrase — exactement ce que la même section
> lui retire quelques paragraphes plus bas (voir A-5).
>
> **Ce que ça ferme, et c'est écrit** : un jeu à trois ou à six directions n'a
> pas de vue à lui. Il en choisit une des huit et renomme ses directions depuis
> le codex, ce qui reste possible et se défait d'un clic.

`06ter-assistant-demarrage` § 03 et `06-univers` § 04 listent **huit** vues : de
face fixe, de dessus verticale, de côté plateforme, de côté à défilement, de
dessus stricte, de dessus 3/4, oblique, isométrique.

`05-codex` § 05 en dessine **neuf** — la neuvième étant *« libre · n directions ·
l'auteur nomme les siennes · l'auteur écrit la sienne »* — tout en écrivant, dans
le même paragraphe, que *« la liste complète des huit vues vit là-bas »*.

La vue « libre » n'est pas un détail de forme : c'est la seule où le nombre de
directions et la consigne en anglais ne sont pas décidés par le choix. Elle
existe, ou elle n'existe pas.

### ~~A-5 · La consigne de direction : le codex la retire du texte, l'assistant l'y écrit~~

> **Tranché et appliqué le 31 août 2026 — le report est appliqué, la phrase
> sort.** `4-directional orientation` ne s'écrit plus dans la case *technique* et
> ne part plus dans le texte envoyé au modèle. La raison, mesurée, est reprise
> aux deux endroits : cette phrase partait avec les vingt-huit générations du
> projet, dont six planches d'équipement où elle contredisait la consigne de
> l'appel — on demandait une pièce posée à plat, la bible réclamait quatre
> orientations. Elle ne manque pas, parce que chaque image dit déjà la direction
> qu'elle montre, case par case.
>
> **Cinq endroits touchés.** Dans `06ter-assistant-demarrage` : la liste *« ce
> que le choix remplit »* perd son troisième point, la phrase *« ce que
> l'assistant change »* ne promet plus d'écrire la phrase au modèle, la case
> *technique* du tableau des sept cases perd *« 4 directions »*, et le texte à
> copier dans un outil grand public aussi. Dans `06-univers` : le tableau des
> reports reçus gagne la quatrième chose, marquée reçue et appliquée, et la
> raison des sept cases ne dit plus que *technique* porte le nombre de
> directions.
>
> **Le report est marqué appliqué à sa source**, dans `05-codex` § 10. Ce qui ne
> change pas : le nombre de directions reste rempli partout où il sert — la liste
> des poses, le compte du codex —, il ne part simplement plus dans la bible. Les
> deux passages qui décrivent la panne d'aujourd'hui (*« le nombre de directions
> est retapé sept fois »*) sont gardés tels quels : ils racontent l'état du dépôt,
> pas le produit visé.

`05-codex` § 05 décide : *« la bible perd une phrase.
`4-directional orientation` n'a plus à y être écrit, puisque chaque image dit
elle-même la direction qu'elle montre »* — et son § 10 le reporte explicitement
vers l'univers, avec la mesure qui le justifie : cette phrase partait avec les
vingt-huit générations du projet, dont six planches d'équipement où elle
contredisait la consigne.

Le report n'a jamais été appliqué. `06ter-assistant-demarrage` § 03 dit toujours
que choisir la vue **écrit** cette phrase dans la case *technique*, et son § 06
décrit la case *technique* comme portant *« le calage strict sur 128, 4
directions »*. `06-univers` § 07 dit la même chose.

Les deux fichiers affirment aujourd'hui l'inverse l'un de l'autre sur ce qui part
à l'intelligence artificielle.

---

## ~~B · Deux maquettes qui dessinent la même chose, différemment~~

Dix points. Ici il y a toujours une bonne version — c'est la propagation qui a
manqué.

> **Les dix sont traités — 31 août 2026.** Sept se sont tranchés à l'évidence :
> une des deux versions portait sa raison écrite, l'autre ne l'avait pas reçue.
> Deux se sont révélés à la lecture n'être pas des contradictions mais des mots
> qui recouvraient deux choses (B-6, B-7) — il fallait écrire la distinction, pas
> choisir. Un seul demandait un arbitrage, et l'auteur l'a rendu (B-8).

### ~~B-1 · L'établi au repos, dessiné deux fois et de deux façons incompatibles~~

> **Corrigé le 31 août 2026 — la structure a été redessinée sur la forme de
> l'établi.** C'est `02-etabli-personnage` qui avait raison, et son § 00 le disait
> lui-même. Le croquis du § 04 de `01-structure` ne dessine plus trois rangées
> côte à côte : il porte une barre de colonne (*le corps · casque · plastron ·
> + pièce*), six rangées d'attitude avec leurs cases, et **la barre qui paie en
> pied**, qui manquait. La rangée *Animations* disparaît — elle n'était pas
> repoussée en V3, elle est inutile.
>
> **Le § 06 du même fichier redessinait la forme abandonnée une seconde fois**,
> dans son tableau « la forme de l'établi change avec la famille ». Sa ligne
> *Personnage* disait encore *Identité · Poses · Animations (V3) · Équipements* ;
> elle dit maintenant la colonne et l'attitude. Ce tableau portait aussi B-2, et
> les deux corrections y sont faites ensemble.
>
> Un encadré dans chaque section dit ce qui a changé et pourquoi, et rappelle que
> le croquis de la structure reste **une carte** : l'établi complet se lit dans sa
> propre maquette.

|  | `01-structure` § 04 | `02-etabli-personnage` § 02 |
|---|---|---|
| La matrice se lit | par catégorie — **Poses / Animations / Équipements** | par attitude — repos, marche, course, attaque, dégâts, mort, une colonne à la fois |
| Une rangée « Animations » | présente, grisée, « arrive en V3 » | **abolie** — § 06 : « elle est inutile » |
| La barre où l'on paie | absente du croquis | présente en pied, en permanence |
| La colonne de gauche | « ce qu'il est » | le nom, le signalement, les concept arts, la sortie |

`02-etabli-personnage` § 00 dit lui-même que le premier dessin est faux :
*« Correction sur la carte : j'y avais dessiné des rangées côte à côte — Poses,
Animations, Équipements. C'est faux. La matrice se lit une colonne à la fois. »*

La correction n'a jamais atteint la structure, qui redessine l'ancienne forme
**deux fois** : dans son croquis du § 04, et dans le tableau de son § 06 (« la
forme de l'établi change avec la famille ») qui liste toujours
*Identité · Poses · Animations (V3) · Équipements* pour les quatre familles.

### ~~B-2 · Les familles du codex : cinq nommées d'un côté, quatre sous d'anciens noms de l'autre~~

> **Corrigé le 31 août 2026 — les cinq familles du codex partout.** *Biomes* et
> *types d'objets* n'existaient nulle part dans le produit ; ils redeviennent ce
> qu'ils sont, des choses rangées dans une famille. Touché aux quatre
> destinataires que le codex nommait : `01-structure` § 01 (le texte du codex),
> § 03 (les familles du croquis, qui gagnent *Équipement*), § 06 (le tableau) et
> § 08 ; `03-chassis-des-tables` § 01 ; `32-le-guide` § 04 ; `04-galerie`, dont un
> exemple parlait encore d'un *biome*.
>
> **Une exception a été écrite parce qu'elle ne l'était nulle part** (c'est aussi
> H-6) : le filtre par famille de la galerie n'a que quatre entrées, et
> l'équipement en est absent **exprès**. Une pièce n'a jamais d'image à elle — un
> casque n'existe qu'apparu sur un corps —, donc filtrer sur *équipement* ne
> rendrait jamais rien. Cinq familles rangent des choses du jeu, quatre seulement
> rangent des images.

`05-codex` § 04 tranche, avec sa raison mesurée : **cinq lignes — personnages,
décors, objets, interface, équipement** —, et corrige explicitement la structure
(*« La maquette de structure listait Personnages · Biomes · Types d'objets ·
Interface. Les deux du milieu n'existent nulle part dans le produit, qui nomme
ses familles personnages · objets · décors · interface. »*).

La correction n'a été appliquée nulle part :

- `01-structure` § 01 et § 06 : « personnages, **biomes**, **types d'objets**, interface » ;
- `03-chassis-des-tables` § 01 : les mêmes anciens noms ;
- `32-le-guide` § 04 : les mêmes — **et c'est le fichier écrit en dernier** ;
- `04-galerie` § 05 : quatre familles, l'équipement absent de son filtre.

### ~~B-3 · Le fil d'Ariane, trois formes pour le même écran~~

> **Corrigé le 31 août 2026 — la forme du châssis, partout.**
> `… › Balthazar › marche · sud · image 3 › Détourage` : cinq segments, celui de
> la pose portant les trois choses. Les deux croquis en écart ont été refaits —
> `01-structure` § 05 (qui écrivait `Pose · marche sud`, un segment de moins et
> sans la direction) et `02-etabli-personnage` § 05 (qui écrivait
> `le corps › marche · image 3`, un étage en trop).
>
> **Et la phrase fausse du codex a été corrigée à sa source** : son § 10
> affirmait que cette forme était *« déjà celle que la maquette de structure
> dessinait »*. Elle ne l'était pas ; la ligne le dit maintenant, et se marque
> reportée.

`03-chassis-des-tables` § 02 pose la règle — *« Cinq segments, et pas un de
plus »* : `Cœur de pierre › Personnages › Balthazar › marche · sud · image 3 ›
Détourage`, le segment de la pose portant les trois choses d'un coup.

- `01-structure` § 05 dessine `… › Balthazar › Pose · marche sud` ;
- `02-etabli-personnage` § 05 dessine `… › Balthazar › le corps › marche · image 3`
  — un étage en plus (« le corps »), la direction en moins.

Et `05-codex` § 10 affirme que la forme de la structure est *« déjà celle que la
maquette de structure dessinait »*. Elle ne l'est pas.

### ~~B-4 · Le total « en tout » dans la barre du haut~~

> **Corrigé le 31 août 2026 — le total de l'atelier sort des deux barres.** La
> règle l'emporte, et sa raison est sa force : l'écran des dépenses écrit que ce
> total est *« la seule chose qu'on vient chercher ici et qu'on ne trouve nulle
> part ailleurs »*. L'afficher dans la barre du haut lui retirerait sa raison
> d'exister.
>
> Retiré des croquis de `04-galerie` § 02 (`$3,180 en tout`) et de `05-codex`
> § 03 (`$0,362 en tout ›`). Le texte du codex, qui décrivait la barre comme
> portant *« le total du projet, le total de tout »*, dit maintenant **le total du
> jeu ouvert et lui seul**, avec son étiquette `ce jeu` — et il dit ce qui a été
> retiré, et pourquoi.

**La règle**, écrite dans `03-chassis-des-tables` § 02 et `30-les-depenses`
§ 06 : la barre du haut ne porte que le total du jeu ouvert, **avec son
étiquette** ; le total de l'atelier entier vit dans l'écran des dépenses, et c'est
même la seule chose qu'on vient y chercher.

Deux croquis affichent les deux : `04-galerie` § 02 (`ce jeu $2,140 ›` **et**
`$3,180 en tout`) et `05-codex` § 03 (`ce jeu $0,274 ›` **et**
`$0,362 en tout ›`), dont le texte dit d'ailleurs *« le total du projet, le total
de tout »*.

### ~~B-5 · Réglages et Guide : les mots, ou les pictogrammes~~

> **Corrigé le 31 août 2026 — les mots, partout.** Sept pictogrammes retirés :
> quatre dans `01-structure`, deux dans `02-etabli-personnage`, un dans
> `30-les-depenses`. Le point d'interrogation isolé de la barre du châssis devient
> `Guide` — dans le croquis et dans la phrase du § 02 qui le citait.
>
> Et `04-galerie` § 03, qui écrivait encore ⚙ et ? en toutes lettres dans son
> tableau *ce qui disparaît*, dit maintenant les mots et renvoie à son propre
> § 10, où la décision est prise.

Tranché deux fois — `05-codex` § 03 (*« aucun glyphe : les croquis des premières
maquettes dessinaient une roue dentée et un point d'interrogation ; ce sont bien
les mots Réglages et Guide qui restent »*) et `04-galerie` § 10.

Encore en pictogrammes : `01-structure` (quatre fois), `02-etabli-personnage`
(deux fois), `30-les-depenses` (une fois). `03-chassis-des-tables` dessine un
point d'interrogation isolé dans la droite de sa barre.

### ~~B-6 · Les états d'un champ sur la fiche : abandonnés d'un côté, gardés de l'autre~~

> **Ce n'était pas une contradiction, et c'est écrit le 31 août 2026.** En lisant
> les deux fichiers côte à côte : ce qui est abandonné, ce sont les **quatre
> positions dans la cascade**, et la cascade a bien disparu. Ce que la fiche
> garde, ce sont **deux mots qui ont changé de sens** — pas deux états rescapés.
>
> - *verrouillé* ne dit plus « ce niveau de la cascade s'impose » mais « cette
>   case est fermée aux ambiances » ;
> - *éteint* ne dit plus « ce niveau est désactivé » mais « ce champ ne part pas,
>   pour cette chose » — un refus écrit, qui reste.
>
> **La phrase à corriger était celle de `07-ambiances-et-couleurs`**, qui disait
> qu'*éteint* était devenu l'interrupteur de l'écran de confirmation. Ce sont
> deux choses différentes sous le même mot, et la différence compte : cet
> interrupteur-là **ne vaut que pour un appel et ne remonte nulle part**, tandis
> que l'*éteint* de la fiche est une propriété de la chose du jeu. Le § 07 le dit
> maintenant, et renvoie aux cinq origines de la fiche.

`07-ambiances-et-couleurs` § 07 range dans ce qui est **abandonné** *« les quatre
états d'un champ — hérité · remplacé · éteint · verrouillé »*, en précisant que
deux survivent **sous une autre forme** : verrouillé devient « cette case est
fermée aux ambiances », éteint devient l'interrupteur de l'écran de confirmation.

`07bis-fiche-entite` § 05 les garde comme deux de ses **cinq origines possibles**
pour un texte — *du jeu · son ambiance · écrit ici · éteint · verrouillé* — et
les dessine dans son croquis.

### ~~B-7 · Où vivent les commandes d'animation : trois réponses~~

> **Une seule des quatre maquettes avait fait le travail, et c'est la sienne qui
> vaut — 31 août 2026.** `08-planche-de-pose` § 09 est la seule à avoir posé les
> trois commandes **place par place**, avec ce que chacune suppose : l'ordre des
> vignettes *dans la case d'une direction*, la cadence *sur la pose*, le bouton
> pour la lire *dans la vitrine* — parce que lire une animation, c'est essayer.
>
> Les deux autres réponses n'étaient pas fausses, elles étaient **incomplètes** :
> `02-etabli-personnage` § 06 mettait les trois sur la rangée de la matrice — deux
> y sont —, et `07bis-fiche-entite` § 08 les mettait toutes dans la planche — deux
> y sont. Les deux paragraphes disent maintenant la répartition et citent la
> planche.
>
> **Et la vitrine sait enfin ce qu'elle réserve.** Son bloc *le mouvement*, grisé,
> attendait quelque chose que personne ne lui avait nommé : c'est le bouton de
> lecture. Son § 07 le dit et cite les deux autres. Les quatre maquettes se citent
> désormais, là où aucune ne citait les autres.

- `02-etabli-personnage` § 06 : trois choses **sur la ligne de la matrice qui
  existe déjà** — l'ordre des images, une cadence, un bouton pour la lire ;
- `07bis-fiche-entite` § 08 : *« Elles vont dans la planche d'une pose »* ;
- `08-planche-de-pose` § 09 : l'ordre dans la case, la cadence sur la pose, et
  **le bouton pour la lire dans la vitrine** ;
- `09-la-vitrine` § 07 : le bloc « le mouvement », réservé et grisé.

Aucune des trois maquettes ne cite les deux autres.

### ~~B-8 · Les coins d'une vignette : un vocabulaire déclaré clos, rouvert trois fois~~

> **Tranché et appliqué le 31 août 2026 — un angle par sujet.** L'auteur a choisi
> la règle la plus robuste : chaque angle répond à une question différente, donc
> une vignette peut porter les trois marques à la fois sans qu'aucune n'en cache
> une autre.
>
> - **haut-gauche · d'où l'image vient** — coin bleu : artwork officiel de
>   l'univers ; coin orange : image apportée par une ambiance ; aucun coin : image
>   ordinaire, concept art compris.
> - **haut-droite · ce que l'auteur en a fait** — le coin plein du favori, la
>   seule marque qu'il pose lui-même.
> - **bas-droite · ce que la mesure en dit** — le coin doré, hors taille commune.
>   Le contour doré d'une case de la matrice dit la même chose.
>
> **Le vocabulaire est écrit à un seul endroit**, `04-galerie` § 09, parce que
> c'est cette maquette qui tient la tuile. Le point de `02-etabli-personnage`
> § 07 qui déclarait la liste close est retiré, et il dit pourquoi. La vitrine
> précise son angle. Les trois légendes de vignette de référence — codex, fiche,
> écran de confirmation — nomment maintenant l'angle au lieu de dessiner un
> symbole seul.
>
> **Ce que ça répond au passage** : H-5 n'a plus d'objet. Une image favorite,
> promue artwork officiel et hors taille commune porte trois coins, sur trois
> angles différents.

`02-etabli-personnage` § 07 déclare la liste **fermée** : *« Le second coin de
carte en épinglé dit concept art. Les deux coins sont pris, et le vocabulaire des
marques est clos. »* Le premier étant le favori (`04-galerie` § 09).

Rouvert depuis, sans que le § 07 soit repris :

- `05-codex` § 03, `07bis-fiche-entite` § 03 et `08bis-ecran-de-confirmation`
  § 02 : *« coin bleu : artwork officiel de l'univers · coin orange : image
  apportée par son ambiance · **sans coin** : concept art »* — l'inverse de ce que
  dit l'établi ;
- `09-la-vitrine` § 09 : *« Le coin doré sur une vignette dit hors taille
  commune »*.

Quatre sens pour la même marque, et aucun fichier ne dit lequel l'emporte quand
une image est à la fois favorite, officielle et hors taille commune.

### ~~B-9 · Le vestiaire : une famille du codex, ou une liste du projet~~

> **Corrigé le 31 août 2026 — c'est une famille, et le codex portait la raison.**
> Une pièce d'équipement a un nom, une description, un emplacement et une portée :
> c'est une chose du monde, pas un réglage. La règle du codex tranche seule —
> *une famille contient des choses du jeu, une liste contient des cases à
> remplir*.
>
> Il reste donc **deux listes** sous le trait, et elles n'ont pas la même portée,
> donc **deux titres** : *ce que le jeu réclame de tous* au-dessus des directions,
> *ce que les personnages réclament* au-dessus des poses. Le croquis de
> `31-le-premier-lancement` § 05 a été refait sur cette forme — il dessinait « Le
> vestiaire » en troisième liste alors que sa propre colonne du haut portait déjà
> la famille *Équipement*, et il rangeait les poses avec ce que le jeu impose à
> tous. `01-structure` § 01 et § 07 et `03-chassis-des-tables` § 01 disaient la
> même ancienne forme et sont alignés.

`05-codex` § 04 en fait la **cinquième famille**, avec sa raison écrite : *« une
pièce d'équipement a un nom, une description, un emplacement et une portée —
c'est une chose du monde, pas un réglage »*.

`31-le-premier-lancement` § 05 le redessine comme une **liste du projet**, sous
le titre « ce que le jeu réclame de tous », à côté des directions et des poses —
et il y range aussi *« Les poses 6 · par défaut »*, alors que les poses
appartiennent au type d'objet depuis la même journée. `01-structure` § 01 et
`03-chassis-des-tables` § 01 gardent la même ancienne forme.

### ~~B-10 · La liste des palettes : celle du jeu y figure, ou non~~

> **Corrigé le 31 août 2026 — elle y figure.** La maquette des ambiances portait
> sa raison : *le projet est l'ambiance générale du jeu*, donc sa palette est une
> palette comme les autres et non une chose à part rangée ailleurs.
> `06-univers` § 05 dessine maintenant cinq palettes, `du jeu · 48 · 2 img` en
> tête, et son pied dit `5 palettes`. Un paragraphe sous le croquis dit ce qui a
> changé et pourquoi.

`07-ambiances-et-couleurs` § 04 dessine **cinq palettes**, la première étant
`du jeu · 48 · 2 img` — ce qui suit sa décision *« le projet est l'ambiance
générale du jeu »* et son report vers l'architecture (*« la palette du projet
devient un cas particulier de palette, pas une chose à part »*).

`06-univers` § 05 dessine le même écran avec **quatre palettes**, celle du jeu
absente, et son pied dit *« 4 palettes »*.

---

## ~~C · Un fichier qui se contredit lui-même~~

Quatorze points. Aucun ne demande de décision — il y a une phrase juste et une
phrase fausse dans le même document.

> **Les quatorze sont traités — 31 août 2026.** Aucun n'a demandé de décision,
> comme annoncé : dans chaque cas les autres pages du même fichier disaient
> laquelle des deux phrases était la bonne. Trois ont demandé un peu plus qu'un
> mot changé — **C-8** (le compte des temps de la boucle était faux des deux
> côtés), **C-10** (l'exemple citait un chiffre qui n'est mesuré nulle part) et
> **C-13** (deux comptes qui ne comptaient pas la même chose, et une addition qui
> dépassait son total). Deux points d'autres sections se sont fermés au passage :
> **E-1** avec C-4, **H-2** avec C-3.

### ~~C-1 · `01-structure` — trois listes au § 01, deux au § 07~~

> **Déjà refermé le 31 août 2026, en traitant B-9.** Le vestiaire a cessé d'être
> une liste pour devenir la cinquième famille du codex, et les deux passages ont
> été réécrits ensemble : le § 01 et le § 07 disent maintenant tous les deux
> *« les deux listes »* — les directions et les poses —, et le § 07 ajoute la
> phrase qui manquait, *« le vestiaire, lui, n'est pas une liste : c'est la
> cinquième famille (§ 06) »*. Vérifié : le § 06 dessine bien cinq familles.

Le § 01 dit que le codex porte **trois** listes : les directions tirées de la vue
du jeu, les poses attachées à chaque type d'objet, et le vestiaire. Le § 07 dit
*« les **deux** listes que le projet impose à tous — le plan de poses et le
vestiaire »*, qui est le modèle d'avant le 30 août.

### ~~C-2 · `01-structure` § 09 — deux onglets, et la bible dans le codex~~

> **Corrigé le 31 août 2026.** Les deux lignes du tableau *« la suite »* étaient
> les fausses ; le § 01 et le § 03 du même fichier disaient déjà le vrai. **M0**
> annonce désormais *« Univers, codex, galerie, établi. Trois onglets, une
> profondeur »*. **M3** annonce *« les cinq familles, les jauges de manque, les
> deux listes »*, suivi en gris de *« pas la bible : elle vit dans l'onglet
> Univers, qui précède celui-ci (§ 03) »* — la phrase du § 03, reprise mot pour
> mot, pour que la contradiction ne puisse pas revenir sans qu'on la voie.

Le tableau « la suite » annonce *« M0 · la structure : galerie, codex, établi.
**Deux onglets**, une profondeur »* alors que le § 01 du même fichier en compte
trois ; et *« M3 · le codex : les familles, les jauges de manque, **la bible en
tête** »* alors que son § 03 dit que la bible n'y est pas — *« elle vit dans
l'onglet Univers, qui précède celui-ci »*.

### ~~C-3 · `03-chassis-des-tables` § 02 — trois bandes, deux hauteurs~~

> **Corrigé le 31 août 2026 — et ça ferme H-2.** Il n'y a pas de troisième
> hauteur manquante : il n'y a pas de troisième bande. Le croquis juste sous la
> phrase le montrait déjà — le fil d'Ariane est écrit **à l'intérieur** de la
> barre de tête, à la place du nom de l'onglet, et la feuille de style le
> confirme : la barre de tête est haute de 44, la barre des tables de 34, et le
> fil n'a aucune hauteur à lui. Le paragraphe dit maintenant *« deux bandes
> empilées »*, avec la raison écrite.
>
> C'est aussi la réponse à **H-2**, qui demandait où était définie la hauteur de
> la bande du fil d'Ariane : nulle part, parce qu'elle n'a pas lieu d'être.

*« Trois bandes empilées, 44 + 34 px »*. Deux chiffres pour trois bandes : la
hauteur de la bande du fil d'Ariane n'est donnée nulle part, ni là, ni dans le
tableau des mesures du § 08.

### ~~C-4 · `03-chassis-des-tables` — la barre d'état à 24 px puis à 26 px~~

> **Corrigé le 31 août 2026 — et ça ferme E-1, qui est le même écart.** Le § 04
> dit maintenant 26, comme le tableau des mesures du § 08 et comme le document du
> design.
>
> **Le dessin était en écart aussi, et personne ne l'avait vu.** La feuille de
> style dessinait la barre d'état à 24 dans deux fichiers — le châssis et la
> structure — et à 26 dans les quatre autres qui la portent. Les deux retardataires
> sont passées à 26 : sinon la maquette montrait 24 pendant que sa phrase disait
> 26, ce que le dossier s'interdit.

Le § 04 énumère ce que le cadre commun fournit toujours, dont *« la barre d'état
de **24 px** »*. Le § 08, tableau des mesures du même fichier : *« Barre d'état —
**26 px** — inchangée »*.

**Déjà tranché** : le document du design range la barre d'état dans les 26 px.
C'est le § 04 qui est à corriger.

### ~~C-5 · `06ter-assistant-demarrage` — neuf étapes ou dix~~

> **Corrigé le 31 août 2026 — c'est dix.** Le fichier passe une section entière à
> expliquer pourquoi la clé du fournisseur devient une dixième étape dans un
> quatrième groupe ; les traces de neuf étaient toutes des restes. Quatre endroits
> corrigés : le pied du deuxième croquis (*« étape 5 sur 10 »*), *« le plus coûteux
> des dix »*, *« la plus longue des dix »*, et le croquis du § 06, qui portait la
> colonne amputée de son quatrième groupe — il montre désormais *l'atelier* et sa
> dixième étape, comme celui du § 05.
>
> Les mentions de *neuf* qui restent ailleurs dans le dossier sont justes : elles
> parlent des **neuf étapes qui gardent leur numéro** parce que la clé s'ajoute en
> dernier, ce qui est précisément l'argument de `31-le-premier-lancement` § 03.

Un croquis porte `étape 3 sur **10**`, l'autre `étape 5 sur **9**`. Et le texte
compte encore en neuf à deux endroits : § 04 *« c'est le plus coûteux des
neuf »*, § 06 *« c'est la plus longue des neuf »*. Le croquis du § 06 ne montre
pas non plus le quatrième groupe, « l'atelier », ni sa dixième étape.

### ~~C-6 · `09-la-vitrine` — trois portes au § 06, une seule au § 10~~

> **Corrigé le 31 août 2026 — c'est trois portes, et la vitrine se range dans le
> codex.** Le § 01 du fichier est sans ambiguïté : la vitrine est le **quatrième
> verbe du codex**, *il montre*, ajouté aux trois qu'il avait. Les deux lignes du
> § 10 étaient restées sur un modèle plus ancien où la vitrine n'ouvrait qu'une
> image de la galerie.
>
> *D'où ça vient* nomme maintenant les trois portes et dit que ce qu'on voit change
> avec la porte — tout le monde, toutes les poses d'une chose, ou les quatre vues
> d'une pose. *Où ça se range* dit *« le codex »*, et ajoute pourquoi ce n'est pas
> la galerie : on n'y ouvre qu'une image à la fois, par le raccourci — qui est
> décrit deux lignes plus bas et reste vrai.

Le § 06 dit d'où l'écran s'ouvre : du codex, de la fiche d'une chose, de la
planche d'une pose. Le § 10, qui écrit l'explication à recopier dans le guide,
dit *« où ça se range · **La galerie** — c'est de là qu'on l'ouvre »*.

### ~~C-7 · `31-le-premier-lancement` — la clé en dixième étape, puis en première~~

> **Corrigé le 31 août 2026 — c'est l'étape 10.** Le § 03 du même fichier passe une
> page à réfuter l'étape 1, en chiffrant ce qu'elle coûterait. La ligne du § 08 dit
> désormais *« à l'étape 10 de l'assistant — la dernière, dans son quatrième
> groupe — ou dans les réglages »*, avec la mention de la correction.
>
> Les deux autres *« étape 1 »* du fichier ont été vérifiées et gardées : elles ne
> parlent pas de la clé mais du nom du jeu, qui est bien la première étape.

Tout le § 03 explique **pourquoi la clé du fournisseur est la dixième étape et
pas la première**, avec le coût de l'inverse : renuméroter les neuf étapes citées
par leur numéro dans tout le dossier. Le § 08, qui écrit l'explication à recopier
dans le guide : *« Elle se dépose une fois, à **l'étape 1** de l'assistant ou dans
les réglages »*.

### ~~C-8 · `32-le-guide` § 03 — six temps annoncés, cinq listés~~

> **Corrigé le 31 août 2026, et les deux nombres étaient faux.** En cherchant
> lequel des temps manquait, il n'en manquait aucun : le compte incluait la ligne
> *« La boucle »*, qui ouvre la partie et la résume d'un trait au lieu d'être un
> temps. La preuve est dans le fichier lui-même, sous cette ligne : *« un mot en
> plus au début, rien d'autre »* — la phrase de la boucle passe de quatre verbes à
> cinq.
>
> Le guide raconte donc la boucle en **quatre temps** aujourd'hui — écrire,
> générer, juger, garder — et en **cinq** après l'ajout de *nommer*. La liste
> compte six lignes : l'ouverture, puis les cinq temps. Le § 03 le dit maintenant
> ainsi, et le nombre est vérifiable en comptant la liste qui suit.
>
> Trois autres endroits reprenaient l'annonce et ont été alignés : le pied du
> guide, le § 03 du sommaire du dossier, et `09-la-vitrine` § 10, qui disait
> *« juger est un des six temps »*.

*« La première partie du guide raconte la boucle du produit en cinq temps. Il en
faut **six** »*. La liste qui suit en contient cinq : nommer, écrire, générer,
juger, garder — et le croquis du sommaire du guide, au § 02, les montre tous les
cinq. Le sommaire du dossier reprend l'annonce (*« la boucle gagne un sixième
temps »*).

### ~~C-9 · `17-table-la-main` § 02 — sept tables avant la septième~~

> **Corrigé le 31 août 2026 — six.** Un mot changé dans l'annotation 02 : *« sur
> l'image que les six tables précédentes ont produite »*. C'est ce que disent le
> § 01 et le § 08 du même fichier, et l'ordre de la recette : la main est la
> septième et dernière place.

*« Elle décide de ce qui est là, sur l'image que **les sept tables précédentes**
ont produite »*, alors que ses § 01 et § 08 disent qu'elle est la septième et
dernière place de la recette — donc que six la précèdent, ce que le § 08 écrit
correctement : *« là où les six autres tables appliquent une règle »*.

### ~~C-10 · `08bis-ecran-de-confirmation` — le dépassement grise, et le croquis paie~~

> **Corrigé le 31 août 2026 — c'est l'exemple qui était faux, pas la règle.** Le
> croquis a raison : ses 1 204 caractères passent, ses deux avertissements sont
> non bloquants, son bouton est actif. La règle du § 06 a raison aussi : un texte
> qui dépasse ce que le modèle accepte grise et dit combien.
>
> C'est l'exemple qui liait les deux à tort, en reprenant le 1 204 du croquis pour
> en faire un dépassement. **Et le second chiffre, la limite de 1 000, n'est mesuré
> nulle part** — ni dans ce fichier, ni ailleurs dans le dossier, ni dans le dépôt ;
> la ligne d'à côté dit d'ailleurs que c'est le catalogue des modèles qui la donne,
> jamais une valeur écrite en dur. Les deux chiffres sont retirés, et la case décrit
> la **forme** du message au lieu d'en inventer une occurrence.

Le § 06 range le dépassement de longueur de texte dans ce qui *« grise et dit
combien »*, avec l'exemple `1 204 sur 1 000 caractères`. Le croquis du § 02
affiche `1 204 caractères de texte`, deux avertissements annoncés **non
bloquants**, et le bouton `Payer et lancer $0,051` actif.

### ~~C-11 · `20-outil-calibrage` § 08 — « le seul ajout au domaine », alors qu'il y en a six~~

> **Corrigé le 31 août 2026 — la phrase était vraie sur un périmètre plus étroit
> que celui qu'elle se donnait.** Le décalage horizontal est le seul ajout que la
> V2.1 fait à **la recette d'une image**, ce qui reste remarquable et reste la
> raison du paragraphe : la recette est ce qui se rejoue sur une image et ce qui
> part dans une recette nommée. Les trois autres ajouts touchent le codex, les
> ambiances et la fiche d'une chose — jamais la recette.
>
> Les deux occurrences disent maintenant *« le seul ajout que la V2.1 fait à la
> recette d'une image »*, et la seconde nomme les trois autres avec leurs fichiers,
> pour que le lecteur puisse aller vérifier au lieu de croire.

*« C'est le seul ajout au domaine de tout le dossier V2.1 : un entier, en pixels
de la case, à côté de l'ancrage. »*

Contredit par quatre fichiers : `05-codex` § 05 en compte **trois de plus** (la
liste des directions, deux listes d'écart, les références qu'une chose désigne),
`07-ambiances-et-couleurs` § 08 **deux objets neufs et deux champs**,
`07bis-fiche-entite` § 09 **un champ**.

### ~~C-12 · `31-le-premier-lancement` § 06 — daté du 30 août, appliqué le 31~~

> **Corrigé le 31 août 2026.** L'encadré porte maintenant la bonne date. Le texte
> juste en dessous la donnait déjà sans le dire : les corrections attendaient qu'une
> révision de la documentation, faite sur une autre branche, ait atterri — et c'est
> le 31 qu'elle a atterri, comme le sommaire l'écrit de son côté.

L'encadré dit *« Les cinq corrections sont appliquées · **30 août 2026** »*, et
juste après *« Elles attendaient qu'une révision de la documentation, en cours
sur une autre branche, ait atterri — c'est fait »*. Le sommaire les date du
**31 août**, jour où la révision a atterri.

### ~~C-13 · `04-galerie` — vingt-neuf décors, puis vingt et un~~

> **Corrigé le 31 août 2026, et c'est le point de la section qui a demandé le plus
> de travail.** Deux choses se cachaient sous le même mot.
>
> **La colonne de gauche range en collections**, qui sont des dossiers qu'on
> fabrique soi-même et qui n'ont aucune obligation de couvrir tout le projet.
> **Le menu du filtre coupe par famille**, qui est une propriété de chaque image et
> qui, elle, doit couvrir tout le projet sans reste. Rien ne le disait, et les deux
> portaient une ligne *décors* avec deux nombres différents.
>
> Le fichier le dit maintenant, en toutes lettres, et les deux comptes tombent
> juste : les trois collections du croquis tiennent **80 des 88 images**, huit ne
> sont dans aucune ; les cinq lignes du menu font **34 + 21 + 25 + 4 + 4 = 88**.
> C'est la ligne *sans sujet* qui portait le mauvais chiffre — elle avait emprunté
> le 19 du paragraphe voisin, qui parle du dépôt réel et pas du projet dessiné.
>
> **Ce paragraphe voisin a été recompté aussi, et il était faux.** Il annonçait
> *« sur les 28 générations du dépôt, 9 portent un sujet et 19 n'en portent
> aucun »*. Compté dans `donnees/atelier.sqlite3` : 28 générations, dont **13**
> rattachées à une chose du jeu et **15** sans. Le raisonnement du paragraphe tient
> toujours — un filtre par famille laisserait plus de la moitié de la grille hors
> de toute case —, mais il se dit maintenant avec les vrais nombres.

Le § 02 dessine l'arbre du rangement avec `· décors **29**` ; le § 05 dessine le
filtre par famille avec `décors **21**`. Et la liste du filtre ne tombe juste dans
aucun cas : 34 personnages + 21 décors + 25 objets + 4 interface + 19 sans sujet
dépassent les 88 images que l'écran annonce.

### ~~C-14 · `18-table-decoupage` § 01 — un ordre à six places~~

> **Corrigé le 31 août 2026 — un mot.** La phrase dit maintenant *« il n'a aucune
> place à tenir entre contours et la main »*, ce qui est l'ordre de la recette à
> sept places : détourage, recadrage, grille, quantification, bords, contours, la
> main.

*« Il n'a aucune place à tenir **entre bords et la main** »* : l'ordre de la
recette place les contours entre les deux. Reste d'un temps où la recette en
comptait six.

---

## ~~D · Des chiffres présentés comme mesurés, qui ne concordent pas~~

Sept points. Le dossier s'impose la règle *« un chiffre cité est un chiffre
mesuré, et la maquette dit par quel banc le rejouer »* — ces sept-là ne la
tiennent pas.

> **Section close le 31 août 2026, et pas dans le sens où elle avait été
> écrite.** Ces sept points partaient du principe que le dossier devait faire
> concorder ses chiffres. C'est le principe qui a cédé : **une maquette dessine
> une interface, elle ne rend pas compte de l'état du dépôt.** Les nombres
> qu'elle montre — un compte d'images, un prix, un pourcentage, un personnage
> nommé — sont des exemples, et ils bougent tous les jours puisque l'atelier sert
> tous les jours. Le recompte l'a montré en direct : la base est passée de 24
> appels payés à 23 pendant qu'on lisait la page qui citait 24.
>
> **Ce qui a été fait, dans cet ordre.**
>
> 1. **La règle a été remplacée** dans le sommaire (§ 06). *« Un chiffre cité est
>    un chiffre mesuré »* devient : les **mesures de l'interface** engagent — deux
>    maquettes ne peuvent pas en donner deux versions —, **tout le reste est un
>    chiffre d'exemple** qu'on ne fait pas concorder d'un fichier à l'autre.
>    L'ancienne phrase reste écrite, en gris, avec la raison de son retrait.
> 2. **La décision D28 a été étendue** à tout le dossier. Elle ne couvrait que les
>    maquettes de tables ; elle couvre maintenant les comptes, les prix, les
>    pourcentages et les personnages nommés, partout.
> 3. **Les fichiers qui présentaient leurs chiffres comme un relevé le disent
>    autrement.** `05-codex`, `07bis-fiche-entite`, `08bis-ecran-de-confirmation`
>    et `30-les-depenses` portent désormais, à leur ouverture, une phrase qui dit
>    que ce sont des exemples, qu'ils datent d'un jour et qu'on ne les rapproche
>    pas d'une maquette à l'autre.
> 4. **Quatre écarts ont quand même été corrigés**, parce qu'ils n'étaient pas des
>    désaccords entre exemples mais des fautes à l'intérieur d'un même exemple :
>    un tableau qui contredit sa propre colonne de calcul (D-2), une division
>    fausse (D-5), un personnage plus cher que le projet qui le contient (D-6), et
>    deux noms de modèle (D-7).
>
> **Rien de tout ça n'a coûté une génération.** Les relevés existaient déjà, dans
> `donnees/atelier.sqlite3` et dans `essais/mesures_ce_qui_part.json`.

### ~~D-1 · Vingt-huit appels payés, ou vingt-quatre~~

Pour la même somme de `$0,362` dépensée sur le même projet :

| Le fichier | Ce qu'il compte |
|---|---|
| `05-codex` § 02, `07bis-fiche-entite`, `30-les-depenses` § 01 | **28** appels payés |
| `08bis-ecran-de-confirmation` § 01 | **24** générations payées |
| `06-univers` | **28** dans son ouverture, **24** à son § 06 |

Le relevé des images de référence jointes diverge en conséquence, et les trois
lectures sont inconciliables : `05-codex` § 02 compte *17 appels sans image sur
28, 10 avec une, 1 avec deux* ; `08bis` § 01 compte *8 appels avec au moins une
image sur 24* ; et le § 02 du même `08bis` compte *9 sans image, 12 avec une, 3
avec deux*.

C'est le point le plus gênant de la liste : ces chiffres justifient l'existence
même de l'écran de confirmation.

> **Traité — les deux comptes étaient justes, et comptaient deux choses.** La
> base du dépôt porte **28 générations**, dont **4 images importées qui ne
> coûtent rien** : il reste **24 appels payés**. Aucune des deux maquettes ne le
> disait, et chacune montrait son nombre comme s'il était le seul.
>
> Une seconde erreur, plus discrète, se cachait dessous : les fichiers
> attribuaient ces 28 appels et ces `$0,362` **au seul projet `cœur de pierre -
> 01`**, alors que ce sont les totaux du dépôt **tous projets confondus**. Ce
> projet-là n'en porte que seize. C'est ce qui rendait le compte impossible à
> vérifier pour un lecteur.
>
> `05-codex` et `07bis-fiche-entite` disent maintenant *« vingt-huit générations,
> dont vingt-quatre payées »* et *« tous projets confondus »* ;
> `08bis-ecran-de-confirmation` explique en ouverture d'où vient son 24. Les
> relevés d'images de référence, eux, ne sont pas rapprochés : chacun est un
> exemple dans son écran.
>
> **Fichiers touchés** : `05-codex`, `07bis-fiche-entite`,
> `08bis-ecran-de-confirmation`, `30-les-depenses`.

### ~~D-2 · La hauteur de la pose « marche » : 59 ou 60 pixels~~

`13-table-grille` § 02 mesure la pose de marche à `58 × 59`, soit **59 px** de
haut. `20-outil-calibrage` § 02 la mesure à `64 × 60`, soit **60 px**, et le
répète dans son tableau des quatre repères essayés.

Or le § 09 du calibrage lui-même, et `02-etabli-personnage` § 09, redonnent la
série *« 64, **59**, 64, 53, 64 et 43 »*.

> **Corrigé : c'est 60, et le tableau fautif le démontrait tout seul.** La table
> de la grille affiche, sur la même ligne, la boîte du sujet `1015 × 958`, le
> facteur d'échelle `0,0631`, et le résultat `58 × 59`. Or `0,0631 × 958 = 60,4`
> et `0,0631 × 1015 = 64,0` : sa propre colonne de calcul dit **64 × 60**. Le
> chiffre écrit à côté ne suivait pas.
>
> Ce n'était donc pas un désaccord entre deux exemples — c'était une ligne qui se
> contredisait elle-même, et ça se corrige quelle que soit la règle sur les
> chiffres. La table de la grille passe à `64 × 60 · 60 px`, et les trois endroits
> qui redonnent la série écrivent *« 64, 60, 64, 53, 64 et 43 »*.
>
> **Fichiers touchés** : `13-table-grille` (la ligne et la phrase qui la résume),
> `02-etabli-personnage`, `20-outil-calibrage`.

### ~~D-3 · Le prix de la même planche : $0,023 ou $0,051~~

`08-planche-de-pose` § 03, pour la planche de marche de Balthazar à quatre
cases : `Fabriquer la planche **$0,023**`, cohérent avec sa propre mesure
(quatre cases à `$0,0057` l'image).

`08bis-ecran-de-confirmation` § 02, pour exactement la même planche — même
personnage, même pose, `4 cases · 1 planche` dans sa barre de tête :
`Payer et lancer **$0,051**`.

> **Traité : ce ne sont pas deux prix de la même chose.** La planche d'une pose
> chiffre **les quatre cases seules** — `$0,023`. L'écran de confirmation ajoute
> **les images de référence qu'on joint à l'appel** : sa propre barre le dit déjà,
> `$0,024 des $0,051`. Retirez les références, il reste l'ordre de grandeur de la
> planche.
>
> Et c'est exactement ce que cet écran existe pour montrer : la part qu'on ne
> voyait pas. La démonstration était dans le fichier, elle n'était simplement
> jamais rapprochée du prix de la planche. Une phrase le fait maintenant, sur
> place.
>
> **Fichier touché** : `08bis-ecran-de-confirmation`.

### ~~D-4 · Ce que coûte une image de référence jointe : $0,008 ou $0,0097~~

`08bis-ecran-de-confirmation` écrit `+$0,008` sur chaque ligne d'image et
explique le pas : *« la moyenne des deux écarts mesurés »*.

`30-les-depenses` § 02, dans le détail de l'appel choisi :
`1 image de référence jointe **+ $0,0097**`.

> **Traité : l'un est une moyenne, l'autre un appel.** Le `+$0,008` de l'écran de
> confirmation est la moyenne des deux écarts relevés — le fichier l'écrivait
> déjà, mais sans en tirer la conséquence : **une moyenne n'est le prix de
> personne.** Le relevé des dépenses, lui, montre un appel précis, à `+$0,0097`.
> Les deux ont raison, et il faudrait s'inquiéter s'ils tombaient pareil.
>
> La phrase du pas moyen dit maintenant qu'il ne tombe pas juste sur un appel
> donné, et cite l'exemple à `$0,0097` comme normal plutôt que comme
> contradiction.
>
> **Fichier touché** : `08bis-ecran-de-confirmation`.

### ~~D-5 · La part du texte de style : 52 % ou 53 %~~

`06ter-assistant-demarrage` § 06 : *« 890 caractères sur 1 690, soit **52 %** du
texte envoyé »*. `08bis-ecran-de-confirmation` § 01 et le sommaire :
*« soit **53 %** »*.

> **Corrigé : c'est 53 %, et c'est une division.** `890 ÷ 1 690 = 52,7 %`, qui
> s'arrondit à 53. Les deux nombres de la division sont écrits dans la phrase
> elle-même, à trois mots du pourcentage — n'importe quel lecteur pouvait la
> refaire. L'assistant écrivait 52.
>
> Comme D-2, ce n'était pas un désaccord entre exemples mais une faute de calcul
> à l'intérieur d'une seule phrase, et elle se corrige indépendamment de la règle
> sur les chiffres. Le banc d'essai du dépôt donne d'ailleurs 891 caractères, pas
> 890 — écart sans portée, laissé tel quel.
>
> **Fichier touché** : `06ter-assistant-demarrage` § 06.

### ~~D-6 · Balthazar n'a pas le même compte selon l'écran~~

`02-etabli-personnage` : *11 images · $0,412*, en pied de colonne et dans la
barre d'état. `07bis-fiche-entite` : *15 images · $0,155*, dans la barre de tête.

Sachant que le projet entier a coûté `$0,362` dans les fichiers qui citent le
vrai dépôt — un personnage y coûterait donc plus que le projet qui le contient.

**Nuance à trancher, pas à corriger à l'aveugle** : la décision D28 du sommaire
dit qu'un chiffre d'exemple dans une maquette de table reste un exemple. Elle
vaut pour les tables ; ici il s'agit du même personnage nommé, dans le même
projet nommé, sur deux écrans qui se citent l'un l'autre.

> **Corrigé — la nuance avait raison : la règle « c'est un exemple » ne sauvait
> pas celui-ci.** Les deux écrans ne montrent pas deux comptes
> différents : ils montrent **le même bouton**, `Sortir ce personnage`, avec la
> même étiquette dessous. Un même bouton ne peut pas afficher deux valeurs.
>
> Et l'une des deux était impossible : `$0,412` pour un personnage, dans un projet
> qui a coûté `$0,362` en tout. L'établi s'aligne donc sur la fiche —
> `15 images · $0,155` — aux deux endroits où il l'écrivait, dans le pied de la
> colonne et dans la barre d'état. Une troisième occurrence dormait dans
> `01-structure`, que le relevé n'avait pas vue ; elle est alignée aussi.
>
> **Fichiers touchés** : `02-etabli-personnage` (deux endroits), `01-structure`.

### ~~D-7 · Le modèle nommé deux fois différemment~~

`30-les-depenses` § 02 : la colonne des totaux dit `gemini-3.1-flash-**lite**`,
et les deux lignes de la liste qui composent ce total disent
`gemini-3.1-flash`. Le § 05 reprend la forme longue.

À quoi s'ajoute un modèle qui n'apparaît nulle part ailleurs :
`08bis-ecran-de-confirmation` § 02 termine sa barre d'état par
*« modèle · **seedream 4** · 14 images de référence acceptées »*, quand tout le
reste du dossier ne connaît que `gpt-image-2`, les deux Gemini et
`Nano Banana 2 Lite`.

> **Corrigé aux deux endroits : ce sont des noms, pas des chiffres.** La règle
> des chiffres d'exemple ne couvre pas les noms de modèle — le dossier tient là
> une liste fermée, et un nom qui n'y figure pas est une invention.
>
> **Le premier** se tranchait par le calcul, dans le fichier lui-même : les deux
> lignes disaient `gemini-3.1-flash` à `$0,0342` chacune, et la colonne des totaux
> disait `gemini-3.1-flash-lite` à `$0,0685`. Or `0,0342 × 2 = 0,0684`. Ce sont
> bien les deux mêmes appels : c'est le nom court des lignes qui manquait son
> suffixe. Le dépôt le confirme — il ne connaît qu'un seul Gemini,
> `google/gemini-3.1-flash-lite-image`, 2 appels, `$0,0685`.
>
> **Le second** — `seedream 4` — ne renvoie à rien : aucun autre fichier du
> dossier, aucun appel du dépôt. Remplacé par `gpt-image-2`, qui est le modèle de
> l'écran dessiné et celui qui accepte des images de référence.
>
> **Fichiers touchés** : `30-les-depenses` § 02 (deux lignes),
> `08bis-ecran-de-confirmation` § 02.

---

## ~~E · Les mesures de l'interface~~

Sept points. Le dossier promet une liste fermée — hauteurs 44 · 38 · 34 · 30 ·
26, largeurs 380 · 300 · 240 — et chaque maquette écrit *« aucune mesure neuve
n'entre »*. **Quatre de ces sept sont déjà tranchés par le document du design**,
qui a été réécrit le 31 août : il ne reste qu'à appliquer.

> **Section close le 31 août 2026.** Ce sont les seules mesures qui engagent — la
> section précédente vient de retirer cette qualité à tous les autres chiffres du
> dossier —, et elles se sont réglées en quatre gestes.
>
> **Deux étaient de vrais écarts, et se sont tranchés par le document du
> design** : le **bouton qui paie** passe à 34 px, et la barre du haut de la
> **galerie** à 44 dans la phrase comme dans le dessin.
>
> **Deux n'étaient pas des écarts, mais un mot qui recouvrait deux objets** — le
> même piège que la section C a tendu quatorze fois. La **pastille de couleur**
> et le **carré de nuancier** ne sont pas la même chose ; la **liste fermée des
> hauteurs** est une liste de hauteurs *de contrôle*, ce que sa formulation dans
> le sommaire ne disait pas. Dans les deux cas rien n'a été redimensionné : c'est
> la distinction qui manquait, et elle est écrite.
>
> **Un cinquième se réglait en changeant d'unité.** La colonne de prose du guide
> et celle du document du design veulent la même chose ; seule l'unité diffère, et
> l'une des deux se trahit à l'usage.
>
> **Un écart de dessin a été trouvé en chemin**, non listé : trois feuilles de
> style dessinaient encore le bouton qui paie à 32 px. Corrigées, sinon le dessin
> aurait contredit la phrase du fichier qu'on venait de corriger — exactement ce
> qui s'était passé avec la barre d'état en C-4.

### ~~E-1 · La barre d'état : 24 ou 26 pixels~~

> **Appliqué le 31 août 2026, en traitant C-4** — c'est le même écart vu deux
> fois. Le § 04 du châssis dit 26. Et la feuille de style de deux maquettes, qui
> dessinait encore 24, a été alignée : sans ça, le dessin aurait contredit la
> phrase dans le fichier même qui vient d'être corrigé.

`03-chassis-des-tables` § 04 dit 24, son § 08 dit 26. Les tableaux de mesures de
`05-codex`, `06-univers` et `07-ambiances-et-couleurs` disent tous 26.

**Tranché** : le document du design range la barre d'état dans les 26 px, et
nomme 24 comme l'exception réservée au *bouton compact*, celui qui vit à
l'intérieur d'une rangée. Corriger le § 04 du châssis.

### ~~E-2 · La rangée d'une pose dans la matrice : 52 ou 24 pixels~~

> **Tranché et appliqué le 31 août 2026 — une seule forme, à 44 px.** Traité hors
> de son rang, parce qu'il tombait dans la même liste que B-8 et qu'il valait
> mieux n'ouvrir cette liste qu'une fois. L'auteur a choisi la forme unique : rien
> de neuf n'entre dans la liste fermée, et 52 en sort.
>
> **La mesure a trouvé un troisième chiffre en chemin.** Le croquis de l'établi
> *déclarait* 52 et *rendait* **55** : la vignette de 44 plus les marges et le
> trait dépassaient de trois pixels le chiffre annoncé. Aucun des deux n'était
> donc juste. À 44 de rangée, la vignette devait descendre — elle passe de 44 à
> **34**, une hauteur du produit. Vérifié sur le croquis rendu : les six rangées
> font exactement 44, rien ne déborde.
>
> **Ce que ça coûte, mesuré aussi.** Les trois écrans qui portaient la matrice en
> colonne étroite passent de 24 à 44 par ligne. Sur la fiche, le bloc des six
> poses du corps passe de 159 à **279 px** : la colonne du milieu défilera là où
> elle tenait. C'est écrit dans le tableau des mesures de la fiche, à côté du
> chiffre.
>
> Touché : `02-etabli-personnage` (la feuille de style, le § 03 et le § 07),
> `05-codex` § 11, `07bis-fiche-entite` § 11, `08-planche-de-pose` § 11 et
> `09-la-vitrine` § 11 — les deux derniers voyaient leur ligne coupée en deux,
> parce qu'elle mélangeait la ligne de pose avec une option et un bouton d'échelle
> qui, eux, restent à 24.

`02-etabli-personnage` § 07 et `05-codex` § 11 disent **52 px** (« la rangée
d'attitude de la matrice »). `07bis-fiche-entite` § 11, `08-planche-de-pose`
§ 11 et `09-la-vitrine` § 09 disent **24 px** (« le rang de la barre de tables »).

**Non tranché, et c'est le seul des sept qui ne l'est pas** : 52 n'est dans aucune
des cinq hauteurs de la liste fermée, ni dans celle du document du design. Ou
bien la matrice a deux formes — une pleine dans l'établi, une compacte dans les
écrans qui la portent en colonne de droite — et il faut l'écrire ; ou bien c'est
la même et il faut choisir.

### ~~E-3 · Le bouton qui paie : 32 ou 34 pixels~~

`08-planche-de-pose` § 11 dit 32, `08bis-ecran-de-confirmation` § 10 dit 34.

**Tranché** : le document du design range **le bouton qui paie** et **le champ
qui nomme** dans les 34 px, et l'arbitrage A-15 de `v21-arbitrages.md` en donne
la raison et le coût. Corriger le § 11 de la planche.

> **Appliqué le 31 août 2026 — et il fallait toucher trois feuilles de style, pas
> une phrase.** Le § 11 de la planche passe à 34, avec la raison sur place. Mais
> le relevé ne voyait que les textes : **trois maquettes dessinaient encore le
> bouton à 32 px** — la planche elle-même, l'établi et le codex. Seul l'écran de
> confirmation le dessinait à 34.
>
> Sans ça, le fichier qu'on venait de corriger aurait affirmé 34 au-dessus d'un
> bouton de 32 — c'est exactement le piège de C-4 avec la barre d'état. Vérifié
> après coup dans les trois pages rendues, à 1440 × 900 : le bouton mesure 34, et
> rien n'est coupé nulle part.
>
> **Une réserve, qui ne se tranche pas ici.** Le document du design note que le
> code est à 32 px partout, et que la maquette qui a posé 34 croyait à tort que
> c'était déjà la valeur du produit. La décision tient — les vingt-six écrans ont
> dessiné 34, et un produit ne peut pas porter deux hauteurs de bouton — mais le
> coût est réel : tous les boutons et tous les champs. La question est rouverte
> dans [`v21-arbitrages.md`](v21-arbitrages.md), point B-9, et c'est là qu'elle se
> tranche.
>
> **Fichiers touchés** : `08-planche-de-pose` (le § 11 et la feuille de style),
> `02-etabli-personnage` et `05-codex` (leurs feuilles de style).

### ~~E-4 · La pastille d'une couleur de palette : 22 ou 34 pixels~~

Les quatre tables qui montrent une palette — quantification, bords, contours, la
main — la dessinent à **22 px**. `07-ambiances-et-couleurs` § 10 la déclare et la
dessine à **34 px**, avec la raison *« inchangée — c'est déjà celle du panneau
d'aujourd'hui »*.

**Tranché** : le document du design range *« la pastille d'une couleur de
palette »* dans les 34 px. Ce sont donc les quatre tables qui sont en écart — et
c'est l'inverse de ce que le sommaire conclut (voir G-3).

> **Traité autrement : personne n'était en écart, et rien n'a été redimensionné.**
> Ce sont **deux objets sous un seul mot**, et la lecture des feuilles de style le
> montre sans discussion.
>
> La **pastille** du panneau des ambiances est un **contrôle** : 34 px, et elle
> porte sous elle une lettre — `J`, `A`, `M` — qui dit si sa couleur vient du jeu,
> de l'ambiance ou de la main. On la survole, on la choisit.
>
> Le **carré des quatre tables** est une **image** : vingt-quatre ou quarante-huit
> carrés serrés de 22 px, sans étiquette, sans geste, qui montrent une palette en
> entier comme une preuve. On la regarde.
>
> **L'argument décisif est un compte.** Le dossier emploie *quatre* tailles de
> carré de couleur : 34 (la pastille), 22 (le nuancier), **16** (dans un champ) et
> **14** (dans une ligne de retouche). Personne n'a jamais proposé d'aligner les
> deux dernières sur 34, parce qu'il est évident qu'un carré posé *dans* un
> contrôle n'est pas un contrôle. Le carré de nuancier est du même genre. Et la
> liste fermée du document du design s'intitule, mot pour mot, *« hauteurs de
> **contrôle** »*.
>
> Les redimensionner aurait cassé quatre croquis pour rien : à 34 px, une palette
> de huit colonnes passe de 204 à 300 px de large.
>
> Le tableau des mesures des ambiances porte maintenant **les deux lignes**, l'une
> sous l'autre, avec ce qui les sépare. Au passage, la raison écrite dans la case
> de la pastille était fausse — *« inchangée, c'est déjà celle du panneau
> d'aujourd'hui »* — et le document du design l'avait déjà relevé : le panneau
> d'aujourd'hui est à 32. La case dit maintenant le vrai, et renvoie l'arbitrage
> B-9 là où il se tranche.
>
> **Conséquence pour G-3** : la conclusion du sommaire, que ce point disait
> inversée, ne l'est pas non plus. Le carré de palette n'a jamais divergé — il
> n'était simplement pas ce qu'on croyait. À reprendre en traitant G-3.
>
> **Fichier touché** : `07-ambiances-et-couleurs` § 10.

### ~~E-5 · La barre du haut de la galerie : le texte dit 38, le dessin dit 44~~

`04-galerie` § 09 écrit encore *« Les trois bandes gardent leurs hauteurs —
**38 · 38 · 26**. Aucune mesure neuve n'entre »*, alors que son propre croquis
dessine désormais la barre de tête à 44, comme les quinze autres. L'alignement du
31 août a touché le dessin et pas la phrase.

> **Corrigé : la phrase dit maintenant 44 · 38 · 26, et nomme les trois bandes.**
> Mesuré sur la page rendue à 1440 × 900 avant d'écrire : la barre de tête fait
> **44**, les deux barres d'outils **38**, la barre d'état **26**. Le dessin avait
> raison, la phrase était en retard d'un alignement.
>
> Elle nommait d'ailleurs trois hauteurs sans dire ce qu'elles portaient, ce qui
> est ce qui a permis à l'oubli de passer inaperçu : on ne relit pas trois nombres
> nus. Chacune porte maintenant son nom.
>
> **Fichier touché** : `04-galerie` § 09.

### ~~E-6 · La largeur de la prose du guide : 504 pixels ou 72 caractères~~

`32-le-guide` § 08 pose **504 px**, *« la seule largeur maximale du produit — 36
fois la taille du texte, soit 74 signes par ligne »*, et écarte explicitement
l'autre mesure : *« la mesure “72 caractères” donne 671 px, soit 88 signes — trop
long pour l'œil »*.

Le document du design borne cette même colonne à **72 caractères**, et lui a
donné un second locataire le 31 août — la carte de texte du tableau
d'inspiration, ouverte en grand. Les deux ne peuvent pas être vraies ensemble.

> **Elles le peuvent : elles disent la même chose dans deux unités, et l'une des
> deux ment.** Les deux documents veulent une ligne de prose d'environ
> soixante-dix signes. Le désaccord ne porte que sur la façon de l'écrire.
>
> `72ch` dans une feuille de style ne vaut **pas** 72 caractères : le `ch` est la
> largeur du **chiffre zéro**, l'un des signes les plus larges d'une police.
> Mesuré : une colonne de `72ch` tient **112 signes** de prose ordinaire, quand
> les 504 px du guide en tiennent **77**. Demander « 72 caractères » en `ch` rend
> donc une ligne **une fois et demie trop longue**, et le rapport ne dépend pas de
> la taille du texte, puisque les deux grandissent ensemble.
>
> *Chiffres refaits le 31 août 2026, en traitant F-6.* Cette même mesure avait
> d'abord été prise **sur le croquis**, qui dessine sa prose à 13 px, et donnait
> `72ch = 637 px` pour 107 lettres contre 85. Elle était juste pour le croquis et
> trompeuse pour le produit, dont le corps de texte est à 15 px : les pixels
> changent avec la taille, le rapport non. C'est le rapport qu'il fallait citer.
>
> Rien ne change à l'écran. Le guide garde ses 504 px, mais ne présente plus la
> règle du document du design comme une concurrente qu'il aurait écartée : il dit
> qu'il l'applique, et pourquoi il la borne en pixels pour y arriver.
>
> ~~**Un report reste à faire, et il sort des maquettes**~~ : la formulation du
> document du design, *« bornée à 72 caractères »*, sera lue en `ch` par le
> premier qui l'implémentera. **Fait le 31 août 2026, en traitant F-6** : la règle
> s'y borne désormais en pixels, avec la mesure et le piège nommé.
>
> **Fichiers touchés** : `32-le-guide` § 08 et `docs/DESIGN.md`.

### ~~E-7 · Trois mesures employées et hors de toute liste~~

Sans que ce soit une contradiction, trois valeurs sont employées partout et
n'appartiennent à aucune des deux listes fermées que le sommaire énonce :
**52 px** (voir E-2), **22 px** (la hauteur de puce, nommée comme telle par
`06ter-assistant-demarrage` § 11) et **9 px** (la marque de case, le carré plein
ou creux, nommée par cinq fichiers). Le document du design tient sa propre liste
et nomme ses exceptions ; le sommaire, lui, énonce une liste fermée qui ne les
couvre pas — c'est la phrase du sommaire qui est à reprendre, pas les mesures.

> **Corrigé, dans le sens que le point indiquait : c'est la phrase, pas les
> mesures.** Le sommaire annonçait *« aucune largeur ni hauteur inventée, la liste
> est fermée »* sans jamais dire **de quoi** elle était la liste. Elle laissait
> donc croire qu'elle couvrait tout ce qui se dessine, et faisait passer pour des
> écarts des choses qui n'en sont pas.
>
> Elle dit maintenant **hauteurs de contrôle** et **largeurs de colonne**, comme
> le document du design ; elle nomme les deux exceptions que celui-ci nomme — le
> champ de prompt à 56 px, le bouton compact à 24 — et elle ajoute ce qu'elle ne
> prétend pas couvrir : les **marques** dessinées dans ou contre un contrôle, qui
> gardent leur taille. La puce de 22 px, le carré de 9 px qui dit si une case est
> faite, le carré de nuancier de 22, celui de 16 dans un champ, celui de 14 dans
> une ligne de retouche.
>
> Des trois mesures que ce point signalait, **une a disparu en route** : le 52 px
> de la matrice, retiré en traitant E-2. Les deux autres n'avaient rien à se
> reprocher.
>
> **Fichier touché** : `00-sommaire` § 06.

---

## ~~F · Des reports décidés et jamais appliqués~~

> **Section close le 31 août 2026 — six points, et deux étaient déjà faits.**
> F-2 et F-4 avaient été appliqués sans le savoir en traitant A-5 et B-2 : les
> reports croisés se recoupaient. F-5 de même, avec B-1. Restaient trois vrais
> travaux : le verbe et la porte que le codex n'avait jamais reçus, une
> proposition de l'univers à laquelle personne n'avait répondu, et le pointage
> complet des reports vers les documents d'autorité.
>
> **Ce pointage est le premier de ce chantier, et il a trouvé trois manques.**
> Les huit paragraphes « ce qui déborde » qui visent le document du produit,
> l'architecture ou le document du design ont été relus contre les trois
> documents. La grande majorité y était déjà écrite. Trois ne l'étaient pas, et
> les trois ont été écrites — dans les documents eux-mêmes, sur autorisation.

Six points. La règle du dossier est écrite : *« une maquette qui découvre quelque
chose appartenant à une autre l'écrit dans son paragraphe “ce qui déborde” — et
un report non appliqué est une divergence en attente »*.

### ~~F-1 · Le quatrième verbe du codex, et sa porte vers la vitrine~~

> **Appliqué le 31 août 2026 — et c'est un cinquième verbe, pas un quatrième.**
> Le codex gagne **il montre** dans le tableau de son § 01, et la porte
> *voir ce qui est fait ›* à droite de la barre d'outils de son panneau du milieu,
> dans le croquis du § 03. Le verbe est écrit de façon à ne pas renverser le
> § 01 : **le codex n'affiche toujours aucun résultat, il ouvre l'écran qui en
> montre.**
>
> **La vitrine se comptait mal elle-même.** Elle annonçait « trois verbes, et il
> en gagne un quatrième », alors que le codex en liste quatre depuis toujours —
> *il range* ouvre son tableau. Il fallait recompter avant de porter le verbe :
> la vitrine dit maintenant cinq, sa table gagne la ligne *il range*, et son
> § 10 corrige « quatrième verbe » en « cinquième ».

`09-la-vitrine` § 08 reporte deux choses au codex : le verbe **« il montre »**, et
*« une porte vers la vitrine depuis la barre d'outils du panneau central — voir
ce qui est fait »*. `05-codex` § 01 liste toujours ses quatre verbes sans
celui-là, et son croquis n'a aucune porte.

### ~~F-2 · La direction retirée de la bible~~

> **Déjà fait, en traitant A-5.** Vérifié le 31 août 2026 : la case
> *technique* de l'univers a perdu `4-directional orientation`, l'assistant l'a
> perdu aussi, et le codex a marqué son report comme reporté. La seule mention qui
> reste dans l'univers est dans son encadré *« la panne que ça répare »*, où elle
> décrit ce que le produit fait **aujourd'hui** — c'est exactement sa place.

Voir **A-5**. Report écrit dans `05-codex` § 10, destinataire `06-univers`, jamais
appliqué — et les deux fichiers disent désormais l'inverse l'un de l'autre.

### ~~F-3 · L'univers nomme le fond du jeu~~

> **Répondu le 31 août 2026 : non, et la raison est dans le texte qui part.**
> Les sept cases de la bible **partent au modèle à chaque génération**. Une
> huitième case qui nommerait le fond du jeu partirait avec — et la case
> *technique* y réclame déjà, mot pour mot, un sprite isolé sur fond gris neutre
> ou transparent. Les deux se contrediraient dans le même envoi. C'est la panne
> qu'on venait de retirer de cette même case avec le nombre de directions.
>
> **Ce qui change quand même :** la phrase cesse d'être perdue. L'univers écrit
> dans son § 04 la ligne qui paraît sous la case *éclairage* — *cette phrase
> décrit aussi le fond du jeu · la vitrine le propose comme fond de comparaison* —
> et dit que le jour où il faudra une couleur exacte plutôt qu'une phrase, elle
> viendra de la palette, qui est déjà l'endroit des couleurs. La vitrine porte la
> réponse dans son § 08.

`09-la-vitrine` § 08 : *« La bible décrit le fond du jeu et personne ne s'en
sert — l'Univers pourrait le nommer explicitement plutôt que de le laisser dans
une phrase d'éclairage. »* Rien dans `06-univers` ni dans
`06ter-assistant-demarrage` ne le reprend.

### ~~F-4 · La correction des familles n'a atteint aucun de ses trois destinataires~~

> **Déjà fait, en traitant B-2.** Vérifié le 31 août 2026 par une relecture des
> vingt-six fichiers : aucun n'emploie plus *biome* ni *type d'objet* comme nom de
> famille. Les quatre mentions qui restent sont soit des encadrés qui racontent le
> changement, soit le mot *biome* employé comme nom commun pour un lieu — ce qu'il
> est.

Voir **B-2**. `05-codex` § 04 corrige nommément la structure ; ni
`01-structure`, ni `03-chassis-des-tables`, ni `32-le-guide` n'ont bougé.

### ~~F-5 · La correction de l'établi n'a pas atteint la structure~~

> **Déjà fait, en traitant B-1.** Le croquis du § 04 de `01-structure` et le
> tableau de son § 06 ont tous deux été refaits sur la forme de l'établi, et la
> rangée *Animations* a disparu des deux.

Voir **B-1**. `02-etabli-personnage` § 00 et § 06 corrigent la forme de la
matrice et suppriment la rangée « Animations » ; `01-structure` les redessine
toutes les deux.

### ~~F-6 · Les reports vers les documents d'autorité ne sont recensés nulle part ensemble~~

> **Pointé le 31 août 2026, et c'est le premier pointage du chantier.** Les huit
> paragraphes ont été relus contre `docs/PRD.md`, `docs/ARCHITECTURE.md` et
> `docs/DESIGN.md`. **La grande majorité y était déjà écrite** : l'écran de
> confirmation, l'écran des dépenses et les deux règles qui les accompagnent, les
> directions déduites de la vue, les images de référence d'une chose du jeu, les
> trois objets neufs du modèle, la palette élargie, la carte de texte qui s'ouvre
> en grand. **Trois manquaient.**
>
> **1. Le document du produit — ce que « la bible active » veut dire.** Le
> paragraphe *Le prompt exact* décrivait l'envoi comme *« la bible active, puis le
> sujet »*. Deux choses la découpent depuis : sur une reprise, seules les **cinq
> cases de la matière** partent, et **trois de ces cinq peuvent venir d'une
> ambiance**. Le paragraphe porte l'amendement, daté.
>
> **2. L'architecture — la vue du jeu n'était pas un champ.** Le projet portait la
> liste de ses directions, mais pas la vue dont elles se déduisent : elle
> n'existait qu'en anglais, au milieu d'une case de description que rien ne relit.
> Sans le champ, l'atelier ne peut ni rouvrir l'étape sur ce qui a été choisi, ni
> réécrire d'un coup les deux endroits quand on en change. **Le modèle de la V2.1
> passe de quatre champs neufs à cinq**, et les trois endroits qui donnaient le
> compte ont été mis d'accord.
>
> **3. Le document du design — une règle écrite dans l'unité qui la trahit.**
> Venu de **E-6**. La colonne de prose du Guide y était bornée « à 72 caractères »,
> ce qui invite à l'écrire `72ch`. La borne s'écrit désormais **en pixels**, avec
> la mesure qui l'explique.
>
> **Et le sommaire porte enfin la liste complète de ce qui reste.** Il annonçait
> *« trois choses, toutes dans le code »* ; il y en a **neuf**, dont six de code
> d'application et deux de banc de mesure — voir aussi **G-6**, qui en a fourni la
> neuvième. Rien n'est perdu : chacune vient d'un paragraphe « ce qui déborde »
> qui l'écrivait déjà, sans que personne les ait jamais réunies.

Le sommaire conclut *« Ce qui reste — trois choses, toutes dans le code »*. Huit
maquettes portent pourtant, dans leur paragraphe « ce qui déborde », des reports
vers le document du produit, l'architecture, le document du design ou le dépôt,
et aucun n'apparaît dans cette liste :

| La maquette | Où elle reporte |
|---|---|
| `05-codex` § 10 | trois choses au produit, trois à l'architecture, une au dépôt |
| `06-univers` § 08 | deux phrases au produit, un motif au design |
| `06ter-assistant-demarrage` § 10 | trois ajouts au modèle de données, une phrase au produit |
| `07-ambiances-et-couleurs` § 09 | deux objets et deux champs à l'architecture, une règle au produit |
| `07bis-fiche-entite` § 10 | une au dépôt |
| `08-planche-de-pose` § 10 | deux au dépôt |
| `08bis-ecran-de-confirmation` § 09 | deux au produit, une au dépôt |
| `30-les-depenses` § 09 | deux au produit, une au dépôt |

**Une partie est peut-être déjà faite** — le document du produit, l'architecture
et le design ont tous été réécrits le 31 août, et `v21-arbitrages.md` en garde la
trace. Le travail à faire n'est donc pas de tout reporter, c'est de **pointer
cette liste contre les documents d'autorité** et de barrer ce qui y est déjà.
Tant que ce n'est pas fait, la phrase du sommaire est fausse.

---

## ~~G · Ce que le sommaire annonce et qui ne se vérifie pas~~

> **Section close le 31 août 2026 — sept points, dont deux fausses alertes.**
> Trois comptes étaient faux et sont refaits (G-1, G-5, G-7). Deux annonces
> étaient justes et c'est la relecture qui s'était trompée (G-2, G-3) — le
> sommaire garde son chiffre et gagne la raison pour laquelle il se lit mal. Une
> était déjà réparée par la section E (G-4). La dernière a ajouté une ligne à la
> liste de ce qui reste (G-6).
>
> **Un enseignement, parce qu'il se répète.** Quatre de ces sept points sont des
> **nombres écrits en toutes lettres à côté d'une table qui les contredit**. Un
> nombre annoncé au-dessus d'une liste vieillit à chaque ligne ajoutée, et
> personne ne recompte. Là où c'était possible, le nombre porte désormais **le
> détail de son calcul** — c'est ce qui permet de le refaire.

Sept points, tous dans `00-sommaire.html`. C'est le fichier qu'on ouvre au moindre
doute — il est aussi celui qui a le plus vieilli.

### ~~G-1 · « Onze à ajouter » au recueil d'explications, alors qu'il y en a quatorze~~

> **Corrigé le 31 août 2026 : quatorze.** C'est le guide qui avait raison, et le
> compte se refait à la main : les entrées prêtes à recopier vivent une par
> paragraphe dans les maquettes, et il y en a quatorze — le codex et les ambiances
> en portent deux chacun, le premier lancement deux, et dix autres écrans une
> chacun. Le sommaire écrit maintenant le détail du compte à côté du nombre, pour
> qu'on puisse le refaire sans le croire.

Le § 03-B décrit ce qui attend dans le recueil d'explications de l'application :
*« six phrases à corriger, deux entrées à réécrire, **onze** à ajouter »*.

`32-le-guide` § 07 dit *« quatorze à ajouter »*, et le compte tombe juste : les
maquettes portent bien **quatorze** entrées prêtes à recopier dans leur paragraphe
« ce que cet écran doit au guide » — le codex et les ambiances en portent deux
chacune, le premier lancement deux, et dix autres une chacune.

### ~~G-2 · « Les quatorze appliqués le 31 août » — la table en compte treize~~

> **Fausse alerte, recomptée le 31 août 2026 : la table en porte bien quatorze.**
> C'est le titre qui a raison. L'erreur se comprend, et le sommaire l'écrit pour
> qu'on ne la refasse pas : **l'écran de confirmation y paraît deux fois de
> suite**, une fois pour ce que le guide lui a passé, une fois pour ce que les
> dépenses lui ont passé. Deux lignes voisines commençant par le même nom de
> fichier se lisent comme une seule.

### ~~G-3 · « Le carré de palette n'a jamais divergé » — il diverge~~

> **Fausse alerte, et c'est E-4 qui l'a montré : le sommaire avait raison, pour
> une moins bonne raison qu'il ne le croyait.** Le cinquième fichier n'a pas été
> manqué — **ce n'est simplement pas le même objet**. La pastille du panneau des
> ambiances est un **contrôle** : on la survole, on la choisit, une lettre dessous
> dit d'où sa couleur vient. Les vingt-quatre carrés serrés des quatre tables sont
> une **image** : sans étiquette et sans geste, ils montrent une palette entière
> comme une preuve.
>
> L'argument qui tranche est un compte : le dossier emploie **quatre** tailles de
> carré de couleur — 34, 22, 16 dans un champ, 14 dans une ligne de retouche — et
> personne n'a jamais proposé d'aligner les deux dernières, parce qu'un carré posé
> *dans* un contrôle n'est pas un contrôle. La liste fermée du design s'intitule
> d'ailleurs, mot pour mot, *hauteurs de contrôle*. Les aligner aurait cassé quatre
> croquis pour rien : à 34, une palette de huit colonnes passe de 204 à 300 px.
>
> Le sommaire garde sa conclusion et gagne la distinction, en note.

### ~~G-4 · « Les quatre sont alignées sur 44 » — la phrase de la galerie ne l'est pas~~

> **Réparé en traitant E-5**, et le sommaire le dit maintenant : les dessins
> étaient alignés, une phrase ne l'était pas. La galerie écrit désormais
> `44 · 38 · 26` et **nomme** ce que chaque nombre porte — la barre de tête, la
> barre d'outils, la barre d'état. C'est l'absence de ces trois noms qui avait
> laissé passer l'oubli : trois nombres nus ne se vérifient pas.

### ~~G-5 · « Quatorze questions ouvertes en tout » — la table en énumère seize~~

> **Corrigé le 31 août 2026 : seize, dont quinze distinctes.** La relecture avait
> raison sur le compte, et l'écart venait d'un retrait fait deux fois : la ligne de
> la superposition annonçait que **deux** de ses cinq questions reparaissent plus
> haut, et une seule y reparaît — *appliquer un calque déjà fabriqué aux autres
> poses*. La seconde chose citée plus haut, le refus automatique sur l'échelle,
> n'est pas une question que la maquette se pose : c'est une décision qu'elle prend
> et qui contredit le document du produit. Elle était comptée comme une question
> par erreur. Les deux phrases sont refaites.

Le § 04 annonce *« Sept maquettes gardent leurs propres questions ouvertes,
quatorze en tout »*. La table qui suit en compte seize : une pour la galerie, deux
pour la fiche, deux pour la planche, deux pour les dépenses, trois pour la
vitrine, une pour le découpage, cinq pour la superposition.

L'écart s'explique peut-être — deux des cinq questions de la superposition sont
reprises plus haut dans le même paragraphe — mais alors c'est le « cinq » de la
ligne qui ment, et il faut le dire.

### ~~G-6 · « Cinq places de recette » — il existe un troisième compte, et personne ne le cite~~

> **Confirmé et ajouté à la liste de ce qui reste, le 31 août 2026.** Le troisième
> compte existe bien, et il est dans le code : le texte d'en-tête de
> `atelier/domaine/recette.py` **énumère six places et finit sur *bords***. Il a
> été écrit avant que les contours et la main deviennent des places à part
> entière ; les trois entrées du recueil d'explications qui disent cinq datent
> d'encore avant.
>
> **Personne ne se trompe : chacun est resté à la version où il a été écrit** —
> cinq, puis six, puis sept. C'est exactement ce qu'un ordre fixe ne peut pas se
> permettre, puisqu'on le cite pour savoir ce qui passe avant quoi. La ligne est
> entrée dans le § 03-B du sommaire, qui compte désormais neuf choses restantes au
> lieu de trois.

Le § 03-B décrit le report vers le recueil d'explications : *« trois comptent cinq
places de recette là où la barre des tables en montre sept »*.

`15-table-bords` § 01 en signale un troisième, que ni le sommaire ni le guide ne
reprennent : *« le domaine ne compte pas leurs places : sa liste s'arrête à **six**
et finit sur bords ; la barre en compte sept »*. Le nombre de places de la recette
est donc écrit trois fois différemment dans le produit.

### ~~G-7 · « Le chantier des maquettes se ferme ici »~~

> **Réécrit le 31 août 2026, une fois les soixante-deux points traités.** La
> phrase était fausse au moment où elle a été écrite, et elle l'était pour une
> raison qui vaut d'être gardée : **une relecture croisée n'avait jamais été
> faite**, et un dossier qu'on n'a pas confronté à lui-même se croit toujours
> complet.
>
> Le sommaire raconte maintenant les deux temps de la journée : les seize reports
> appliqués au matin, puis la relecture qui a rouvert le chantier et ses
> soixante-deux écarts, tous traités. Il dit aussi **les trois règles du dossier
> qui ont cédé en route** — les chiffres d'illustration qui ne concordent plus, la
> liste fermée qui dit enfin ce qu'elle couvre, et « ce qui reste » qui est passé
> de trois à neuf.
>
> **Et la fermeture est reformulée au lieu d'être retirée.** Ce qui se ferme est
> le chantier **du dessin** : plus rien de ce qui reste ne se dessine. Neuf choses
> de code et de mesure, dix-sept vignettes à produire, trois appels de planche à
> payer, et les questions du § 04. La phrase pouvait rester vraie ; il fallait
> qu'elle dise de quoi elle parlait.

Le sommaire clôt le dossier en trois phrases : *« Le dossier des maquettes est
complet »*, *« Le chantier des maquettes se ferme ici »*, *« Ce qui reste tient au
§ 03 : trois reports qui appartiennent au code, dix-sept vignettes d'exemple à
produire, un banc d'essai à étendre »*.

Les points **A-1 à A-5**, **B-1 à B-10** et **F-1 à F-6** de ce document sont tous
antérieurs à cette phrase et aucun n'est dans le § 03. Le banc d'essai, lui, a été
étendu le 31 août — voir `v21-arbitrages.md`, la question B-10 et la table finale.

---

## ~~H · Ce qui n'est défini nulle part~~

> **Section close le 31 août 2026 — six points, dont trois avaient été répondus en
> chemin** (H-2, H-5, H-6, tombés dans les paragraphes de C-3, B-8 et B-2). Les
> trois derniers avaient la même forme : **un mot qui sert deux fois**, et personne
> pour dire lequel des deux sens est celui du produit. Un domicile a été donné à
> chacun.

Six points. Ce ne sont pas des contradictions : ce sont des trous que personne n'a
vus parce que chaque maquette a supposé qu'une autre s'en chargeait.

### ~~H-1 · Qui définit la barre où l'on paie~~

> **Domicile donné le 31 août 2026 : la maquette du châssis, à côté de la barre de
> tête.** Le mot *châssis* servait deux fois — le cadre de l'application, et le
> cadre d'une table de retouche — et c'est ce qui a fait qu'on a plusieurs fois
> adressé des reports au fichier du châssis pour des choses qu'il ne dessine pas.
>
> **Le fichier du châssis avait pourtant déjà le bon précédent.** Il définit la
> barre de tête, et son § 02 explique en toutes lettres que *son* croquis ne montre
> aucun total, parce que dans une table la droite de la barre porte les commandes de
> la table. Une seconde note, écrite juste en dessous, fait la même chose pour la
> barre qui paie : **elle appartient au châssis, et une table est le seul endroit où
> elle ne paraît jamais** — puisqu'une table ne coûte pas un centime, et que son
> absence est le message.
>
> L'établi garde ce qui lui appartient vraiment — **ce que la barre lui coûte en
> hauteur de matrice** — et renvoie au châssis pour la décision elle-même.
>
> **Fichiers touchés** : `03-chassis-des-tables` § 02, `02-etabli-personnage` § 03.

`02-etabli-personnage` § 03 pose la décision qui rend la structure fluide : *« la
barre de prompt est **du châssis**, pas d'un écran — même champ, même bouton, même
prix, même fente »*.

Mais `03-chassis-des-tables`, qui est le document du châssis, **ne la dessine
pas** et le dit : sa barre de tables ne porte ni champ, ni prix, ni bouton, et la
droite de sa barre de tête porte les commandes de la table. Le seul élément
partagé par trois écrans est donc défini dans la maquette de l'un d'eux, et cité
par les deux autres.

C'est aussi ce qui a produit un report mal adressé le 31 août — le sommaire le
raconte lui-même au § 03-B : deux reports visaient le châssis pour des choses
qu'il ne dessine pas.

### ~~H-2 · La hauteur de la bande du fil d'Ariane~~

Voir **C-3**. Aucun des six tableaux de mesures du dossier ne la donne.

> **Répondu le 31 août 2026, en traitant C-3.** Aucun tableau ne la donne parce
> qu'il n'y a pas de bande : le fil d'Ariane s'écrit à l'intérieur de la barre de
> tête, à la place du nom de l'onglet, et vit dans ses 44 px. Le croquis du châssis
> le montrait déjà, et sa feuille de style ne donne aucune hauteur au fil. Le
> paragraphe qui parlait de trois bandes en annonce maintenant deux.

### ~~H-3 · Ce que veut dire une jauge~~

> **Tranché le 31 août 2026 : la jauge du produit compte des cases, et le codex la
> définit.** Une case est **une pose dans une direction** — la marche vers le sud et
> la marche vers le nord sont deux cases, pas une. Le codex y consacrait déjà un
> paragraphe entier, avec le calcul du dénominateur et la raison pour laquelle
> l'équipement se compte sur les corps qui existent ; ce qui manquait était la phrase
> qui dit *c'est celle-là, et il n'y en a qu'une*.
>
> **Des trois formes, une était en retard et une n'est pas une jauge.**
> `01-structure` comptait des **poses** — `poses 4/8` — sur une ligne qui est celle
> du codex : son croquis a été refait sur `corps 6 / 21 · équip. 1 / 12`, avec un
> encadré qui dit ce qui a changé et pourquoi. La rangée d'une attitude dans
> l'établi, `marche 4 / 8`, **n'est pas une jauge du tout** : elle compte les
> vignettes d'un cycle, dans une seule case. Les deux s'écrivent pareil, alors le
> dossier écrit comment les distinguer — **une jauge porte le nom d'un ensemble**
> (*corps*, *équip.*), ce compte-là porte le nom d'une attitude.
>
> **Fichiers touchés** : `05-codex` § 09, `01-structure` § 03,
> `02-etabli-personnage` § 06.

Trois formes identiques, trois sens :

- `01-structure` § 03 : `poses 4/8` — des **poses** faites sur des poses demandées ;
- `02-etabli-personnage` § 02 : `marche 4 / 8` — des **images** faites dans une seule pose ;
- `05-codex` § 03 : `corps 6 / 21` — des **cases**, pose multipliée par direction.

Aucun fichier ne dit lequel est la forme du produit.

### ~~H-4 · Ce que compte « cases manquantes »~~

> **Tranché le 31 août 2026 : tout ce qui manque à la chose, le corps et
> l'équipement ensemble.** Le codex comptait le corps seul, la fiche comptait les
> deux ; les deux nombres étaient justes, c'est le mot qui recouvrait deux
> périmètres.
>
> **Le total l'emporte, pour une raison de lecture et non de goût :** le nombre est
> écrit **juste sous les deux jauges**, et un total qui n'additionne pas ce qui est
> écrit au-dessus de lui ne peut que tromper. Les trois lignes du croquis du codex
> ont été recalculées — 26, 27 et 20 —, et son § 08, où le bouton *Fabriquer ce qui
> manque* prend « les cases manquantes », porte la définition.
>
> **Fichiers touchés** : `05-codex` § 03 et § 08.

Pour le même personnage au même moment : `05-codex` § 03 affiche
`15 cases manquantes` (le corps seul) et `07bis-fiche-entite` § 03 affiche
`26 cases manquantes` (le corps et l'équipement). Les deux comptes sont justes ;
c'est le mot qui recouvre deux périmètres.

### ~~H-5 · Quelle marque de coin l'emporte~~

Voir **B-8**. Une image favorite, promue artwork officiel et hors taille commune
porterait trois coins sur un seul angle.

> **Répondu le 31 août 2026, en tranchant B-8.** Aucune ne l'emporte, parce
> qu'elles ne se disputent plus le même angle : la provenance en haut-gauche, le
> favori en haut-droite, la mesure en bas-droite. Une image qui est les trois
> porte les trois.

### ~~H-6 · L'équipement dans le filtre de la galerie~~

> **Écrit le 31 août 2026, en traitant B-2 — c'était correct, et c'est
> maintenant une exception écrite.** Le filtre garde ses quatre familles.
> `04-galerie` § 05 porte désormais l'encadré qui manquait : une pièce
> d'équipement n'a jamais d'image à elle, donc filtrer sur *équipement* ne
> rendrait jamais rien. Cinq familles rangent des choses du jeu, quatre seulement
> rangent des images.

`05-codex` § 04 fait de l'équipement la cinquième famille. Le filtre par famille
de `04-galerie` § 05 n'en a que quatre, plus *sans sujet* et *sans entité*. Une
pièce d'équipement n'ayant jamais d'image à elle — c'est la raison écrite du
codex — il est possible que ce soit correct ; mais alors c'est une exception, et
elle n'est écrite nulle part.

---

## Ce que ce chantier a appris — écrit à la fin, le 31 août 2026

**Quatre écarts sur cinq n'étaient pas des désaccords, mais un mot qui servait
deux fois.** *Cases manquantes*, *jauge*, *châssis*, *pastille*, *états d'un
champ*, *commandes d'animation*, *collection* contre *famille* : à chaque fois,
deux choses réelles et légitimes portaient le même nom, et le dossier semblait se
contredire alors qu'il décrivait deux objets. **Aucune de ces sept-là ne se
corrigeait en choisissant un camp** — elles se corrigeaient en écrivant la
distinction. C'est le geste le plus fréquent de tout le chantier.

**Les nombres écrits au-dessus d'une liste sont les premiers à mentir.** *Onze à
ajouter*, *quatorze appliqués*, *quatorze questions*, *trois choses qui restent*,
*cinq places de recette* : cinq comptes annoncés, quatre faux. Un nombre au-dessus
d'une table vieillit à chaque ligne ajoutée, et personne ne recompte. Là où
c'était possible, le nombre porte désormais **le détail de son calcul** à côté de
lui — c'est ce qui permet de le refaire au lieu de le croire.

**Un relevé qui ne lit que les textes rate la moitié des écarts.** Deux fois, une
phrase corrigée surplombait un dessin resté faux : la barre d'état à 24, le bouton
qui paie à 32. Les feuilles de style disent des mesures elles aussi, et elles ne se
lisent pas en lisant.

**Une mesure prise sur un croquis n'est pas une mesure du produit.** Le croquis du
guide dessine sa prose à 13 px quand le produit l'écrit à 15 : la même règle y
donnait 637 px ou 735. Ce qu'il fallait citer était le **rapport**, qui ne dépend
pas de la taille.

**Et deux règles que le dossier s'était données ne pouvaient pas être tenues.**
*Un chiffre cité est un chiffre mesuré* : impossible, les nombres du dépôt bougent
tous les jours. *La liste des mesures est fermée* : vraie, mais elle ne disait pas
de quoi elle était la liste, et on lui reprochait de ne pas couvrir des choses
qu'elle n'a jamais prétendu couvrir. Les deux ont été réécrites au § 06 du
sommaire.

---

## Ce qu'il fallait savoir avant de corriger

*Ce paragraphe a servi de mode d'emploi pendant le traitement ; il est gardé tel
quel, parce qu'il dit ce qui était su avant de commencer — et deux de ses quatre
affirmations se sont révélées fausses en chemin.*

**Trois écarts ne sont pas des fautes d'écriture, et il ne faut pas les corriger
en choisissant la version la plus récente.** A-1 (la planche paie), A-3 (neuf
tailles ou sept) et A-4 (huit vues ou neuf) changent ce que le produit fait. Le
premier a déjà voyagé jusqu'au document du produit, où il sert de raison écrite à
un rejet — le corriger dans une maquette sans le corriger là-bas ferait diverger
les deux.

**Quatre écarts de mesure sont déjà tranchés** par le document du design réécrit
le 31 août : E-1, E-3, E-4, et la hauteur du champ de saisie (56 px, nommée comme
exception). Il n'y a rien à décider, seulement à appliquer — et pour E-4, à
appliquer **dans le sens inverse de ce que le sommaire a conclu**.

> *Faux sur E-4.* Il n'y avait rien à appliquer dans aucun sens : la pastille et
> le carré de nuancier ne sont pas le même objet. Voir E-4 et G-3.

**Un écart de mesure reste entièrement ouvert** : E-2, la rangée d'une pose dans
la matrice, à 52 ou à 24 pixels. C'est le seul de la liste qui demande de
regarder deux écrans côte à côte avant de choisir.

> *Tranché par l'auteur, à 44 px* — et la mesure a trouvé qu'aucun des deux
> chiffres annoncés n'était juste, le croquis rendant 55 là où il écrivait 52.

**La règle de la journée reste celle de `v21-arbitrages.md`** : en cas de
contradiction entre une maquette et un document d'autorité, la maquette
l'emporte. Elle ne dit rien du cas traité ici — deux maquettes qui se contredisent
entre elles — et c'est précisément pourquoi ce document existe.

---

*Écrit le 31 août 2026 · relecture croisée des vingt-six fichiers de
`docs/archive/maquettes-v2.1/`, puis confrontation à `docs/PRD.md`,
`docs/ARCHITECTURE.md`, `docs/DESIGN.md` et `docs/archive/v21-arbitrages.md`.
Aucune maquette n'a été modifiée en écrivant ce document.*

*Traité le même jour, dans l'ordre du document, section par section. **Les
soixante-deux points sont clos.** Vingt-cinq maquettes et leur sommaire ont
bougé ; trois documents d'autorité portent chacun une correction datée —
`docs/PRD.md` (ce que « la bible active » envoie), `docs/ARCHITECTURE.md` (la vue
du jeu devient un champ du projet), `docs/DESIGN.md` (la colonne de prose se borne
en pixels). Ce qui reste ne se dessine pas : neuf choses de code et de mesure,
recensées au § 03-B du sommaire.*
