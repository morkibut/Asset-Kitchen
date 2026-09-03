# Cahier des charges — six essais sur la planche d'animation et ses références

> Écrit le 2 septembre 2026, à la suite de la revue externe (`revue-externe-2026-09-02/`).
> **Ce document ne touche pas au produit** : tout ce qu'il décrit vit dans `essais/`, comme
> les bancs précédents. Il ne tranche rien sur le produit non plus : ce que chaque essai
> fait entrer dans `docs/PLAN.md` est écrit d'avance, au conditionnel, dans sa section
> « Si ça marche ».
>
> **Le juge est l'auteur, à l'œil, et rien d'autre ne décide.** Chaque essai produit un
> rapport HTML autonome où l'on regarde les planches bouger côte à côte, à la même échelle
> et à la même vitesse, et où l'on note d'un clic. Les chiffres calculés par la machine
> (compte de sujets, découpable, coût) sont affichés pour informer, jamais pour classer —
> la règle sortie du banc du 1ᵉʳ septembre, où la mesure automatique ne prédisait rien.

---

## 0 · Pourquoi ces six essais, et pas d'autres

Les trois bancs de septembre ont mesuré **trente-et-une formulations** — dire la même chose
avec d'autres mots — et conclu, à raison, que réécrire ne sert à rien. Ils n'ont mesuré
**aucune des six choses suivantes**, qui ne sont pas des formulations mais des
**structures** : ce qu'on envoie, dans quel ordre, à quelle taille, en combien de fois, et
par quel type de modèle.

| # | Essai | Ce qu'il change | Ce qu'il coûte | Forme |
|---|---|---|---|---|
| E1 | Les références nommées | une ligne par image jointe qui dit ce qu'elle est et ce qu'elle doit influencer ; puis le texte rangé en trois parties, mots constants | ~0,40 $ | arbitrage, 8 tirages par groupe |
| E2 | La taille de la référence | le sprite promu part en 64 px aujourd'hui ; l'envoyer en 256 et 512 px | ~0,70 $ | arbitrage |
| E3 | La grille complète | 4×2 au lieu de 3×3 à deux cases vides — la cause du « neuf pour huit » | ~0,25 $ | arbitrage |
| E4 | La mise en pose d'abord | un appel d'édition qui met le personnage dans la pose de départ, puis la planche depuis ce sprite préparé | ~0,35 $ | arbitrage en deux temps |
| E5 | La pose imposée par image | une pose par appel, l'image de posture en rôle édition, le sprite promu en référence | ≤ 0,50 $ | exploration, une boucle à la fois |
| E6 | L'image-vers-vidéo | le mécanisme de SpriteCook : le sprite animé par un modèle vidéo, huit images extraites, la chaîne du produit derrière | ≤ 3,00 $ | exploration puis arbitrage |

**Ordre conseillé** : E3 et E6 d'abord, parce qu'ils ne dépendent de rien et que E6 peut
changer la forme de la V3 à lui seul ; puis E1, E2 ; puis E4 ; E5 en dernier, parce qu'il
réutilise les images de pose de E4 et le socle de E1.

**Budget total : cinq dollars et quelques centimes**, moins que les trois bancs précédents.
Chaque script porte son plafond en dur, par lancement, et relancer ne repaie jamais ce qui
est déjà sur le disque — les deux règles de `essais/essai_animation.py`.

---

## 1 · Le socle commun — `essais/socle_essais.py`

Un seul module, partagé par les six scripts, pour que six essais ne réinventent pas six
fois la caisse, le rapport et la notation. Il reprend ce qui existe et ne réécrit rien :
`Caisse`, le portillon, l'écriture sérialisée du relevé viennent de `essai_animation.py` ;
`animer`, `vignette`, `STYLE`, `SCRIPT` viennent de `rapport_tout.py` ; le jugement machine
(`sujets`, `decoupable`, `compte_ok`, `anime`) vient de `banc_complet.juger`.

### 1.1 Ce que le socle fournit

- **`rejouer(reference: Path) -> Depart`** — relit `generation.json` de la génération de
  référence (`donnees/generations/cb3ebb37f3cd4e21987964cd1af87770`, la même que les trois
  bancs) et rend le texte parti, le négatif, les proportions, et les images jointes **dans
  l'ordre d'envoi**, chacune avec son rôle (`style`, `reference`, `gabarit`, `palette`) lu
  dans `references[].origine` et `role`. C'est le témoin de tous les essais.
- **`Variante`** — un objet `(cle, titre, propos, texte, images, echecs_prevus)`. Un essai
  est une liste de variantes ; la première est **toujours le témoin**, c'est-à-dire le
  départ rejoué tel quel.
- **`tirer(variante, jets, modele, plafond, parallele)`** — lance les tirages manquants,
  écrit `resultats_<essai>/<cle>/jet<N>.png` et `mesures.json` (coût, unité, secondes,
  octets, échec éventuel), s'arrête au plafond du lancement. Modèle par défaut :
  `openai/gpt-image-2`, `quality=low`, celui du produit.
- **`juger_machine(planche, cases)`** — le compte de sujets par `services.pliage` et
  `image.decoupe.zones_opaques` tels qu'ils sont dans le produit, le taux de remplissage de
  chaque boîte (pour voir un quadrillage redessiné), et « découpable ». Ces chiffres
  **s'affichent sous chaque planche et n'entrent dans aucun classement**.
- **`rapport(essai, variantes, notes)`** — écrit `essais/rapport-<essai>.html`, autonome
  (images en base64), qui respecte le contrat visuel du § 1.2.
- **`notes_de(essai)`** — lit `essais/notes-<essai>.json`, écrit par l'auteur depuis le
  rapport (bouton « télécharger le relevé », comme aujourd'hui).

### 1.2 Le contrat visuel — ce que chaque rapport doit montrer, sans exception

C'est la partie qui compte pour l'auteur, et elle est la même pour les six essais.

1. **Les groupes côte à côte, le témoin en premier.** Une colonne par variante, une ligne par
   tirage. Chaque case montre l'animation des huit cases brutes — **sans détourage, fond
   compris**, la règle d'A2 — montée en GIF à **125 ms par image** pour tout le monde, dans
   un carré de **132 px** réduit en LANCZOS (jamais en plus-proche-voisin sur une réduction :
   les traits fins disparaissent). Même échelle, même vitesse, même phase de départ.
2. **Un clic ouvre la planche brute à 1:1**, dans un panneau qui se ferme à Échap, avec
   les rectangles de découpe trouvés par le produit dessinés par-dessus (le geste qui a
   démasqué les huit carrés pleins).
3. **Sous chaque animation, les faits de la machine** : `sujets 9/8`, `découpable non`,
   `remplissage 64 %`, `0,0245 $`, `21 s`. En gris, petits, non cliquables.
4. **Ce qui est parti, exactement.** Un dépliant par variante montre le texte envoyé, avec
   les trois parties (contexte / références / demande) surlignées quand la variante les
   range, et **la différence mot à mot avec le témoin** — ajouts en vert, retraits en rouge.
   C'est la seule preuve que « on range, on ne réécrit pas » a été tenu.
5. **Les images envoyées, dans l'ordre, avec leur rôle et leur taille en pixels** — une
   vignette chacune, « Image 1 · style · 1024×1024 », « Image 3 · gabarit · 1024×1024 ».
6. **La notation en un clic** : trois boutons `bon` / `moyen` / `mauvais`, puis les
   **échecs prévus de l'essai en cases à cocher** (liste propre à chaque essai, § E1–E6),
   puis un champ libre d'une ligne. Une planche notée reste marquée ; les notes vivent dans
   le tiroir du navigateur sous une clé propre à l'essai **et à la séance** (date du
   lancement), et s'exportent en JSON.
7. **Le tableau du verdict se recalcule à chaque note** : par variante, bonnes / moyennes /
   mauvaises, taux de bonnes, et **prix par bonne planche** (coût total du groupe divisé par
   ses bonnes). En dessous, la règle de décision de l'essai écrite en toutes lettres, et le
   tableau dit si elle est atteinte — sans conclure à la place de l'auteur.
8. **Le témoin se renote dans chaque séance.** Ses huit planches sont déjà notées dans
   `notes-auteur.json`, mais ces notes ont bougé de 25 % à 62 % entre deux lectures : elles
   ne servent pas. Le rapport les affiche en gris à titre d'information et demande une note
   neuve. Aucune comparaison n'est faite avec une séance précédente.
9. **Le rapport marche hors ligne**, s'ouvre par double-clic, ne charge rien du réseau.

### 1.3 Les règles qui ne se discutent pas

- **Aucune ligne du produit ne change.** Les variantes se fabriquent dans le script par
  transformation du texte témoin (insertion de lignes, déplacement de blocs), jamais par
  recomposition : la différence mot à mot du rapport le prouve.
- **Mots constants** : une variante « rangement » ne retire ni n'ajoute un mot au fond de la
  demande. Les seules lignes nouvelles autorisées sont celles que l'essai teste (E1 : les
  lignes de nommage ; E4 : la ligne de sujet de la prep ; E5 : la ligne de pose).
- **Un lancement, un plafond, en dollars réels**, compté sur le lancement et non sur le
  cumul (`essai_animation.py` dit pourquoi).
- **Rien n'est relancé automatiquement.** Un échec d'appel compte comme un tirage et coûte
  zéro.
- **Aucune clé en dur** : `OPENROUTER_API_KEY` dans `.env` ; pour E6, `FAL_KEY` (ou
  `REPLICATE_API_TOKEN`) déclarée dans `.env.example` avec son nom et rien d'autre.
- **Les images payées ne vont pas dans Git** : `essais/resultats_*/` est déjà ignoré ; les
  `mesures.json` et `notes-*.json` sont versionnés.
- **La règle des huit** pour un arbitrage (E1–E4, la fin de E6) ; **une tentative à la
  fois** pour une exploration (E5, le début de E6), avec ce qu'on attend et les échecs
  prévus écrits **avant** l'envoi, et la conclusion « quel échec s'est produit » après.

---

## E1 · Les références nommées

**La question.** Aujourd'hui l'artwork de style, le sprite promu, le gabarit et la bande de
palette partent dans le même sac, avec une seule phrase pour tous (« One or more reference
images are attached… »). Le modèle « recopie la structure de son entrée » (leçon du gabarit).
Dire à chaque image ce qu'elle est et ce qu'elle doit influencer change-t-il le taux de
bonnes planches ? Et ranger le texte en trois parties, à mots constants, y ajoute-t-il
quelque chose ?

**Ce qu'on attend.** Que B fasse au moins aussi bien que A, et que l'échec « a copié la pose
ou la mise en page de l'artwork » recule. Aucun gain promis pour C au-delà de la lisibilité.

### Les groupes

| Clé | Titre | Ce qui change par rapport au témoin |
|---|---|---|
| `A-temoin` | Le produit d'aujourd'hui | rien — le départ rejoué |
| `B-nommees` | Les références nommées | la phrase générique des images est **remplacée** par une ligne par image, dans l'ordre d'envoi, numérotée (§ Le texte) ; tout le reste identique |
| `C-rangees` | Nommées et rangées | B, puis le texte réordonné en trois parties titrées `CONTEXT` / `REFERENCES` / `REQUEST`, sans qu'un mot du fond change ; `FRAMING` et `CAMERA` restent les deux dernières lignes de `REQUEST` |

Huit tirages par groupe, `openai/gpt-image-2`, `quality=low`, mêmes images, même ordre.
Le témoin est déjà sur le disque (`resultats_animation/openai_gpt-image-2/jet1..8`) : le
script le relie sans le repayer. **Seize appels neufs, ~0,40 $, plafond 0,60 $.**

### Le texte de B — les lignes de nommage

Une ligne par image, générée depuis le rôle lu dans `generation.json`, dans l'ordre d'envoi
et avec son numéro :

```
Image 1 — STYLE REFERENCE (an official artwork of this game): follow its colours,
outfit, proportions and drawing style. Do NOT copy its pose, its camera angle or
its layout.
Image 2 — THE SAME CHARACTER, already drawn in the game's camera: keep it
recognisably the same character in every cell.
Image 3 — EMPTY LAYOUT GRID: 8 cells. Draw exactly one sprite per cell, one
instant of the motion per cell, in reading order. Do NOT draw the grid lines.
Image 4 — PALETTE STRIP: not a subject, only the colours to draw with.
```

Seules les images présentes dans le témoin produisent une ligne. La phrase générique
d'aujourd'hui (`_dire_les_images`) est retirée ; le reste du texte est intact. Si le témoin
n'a pas de bande de palette, la ligne 4 n'existe pas.

### Le texte de C — le rangement

Le script découpe le texte témoin en blocs par ses marqueurs déjà présents (`View and
framing:`, la consigne de grille, `FRAMING —`, `CAMERA —`) et les réordonne sous trois
titres en majuscules, chacun suivi d'une ligne vide. `CONTEXT` reçoit les sept lignes de
bible ; `REFERENCES` les lignes de nommage de B ; `REQUEST` le sujet, la pose, la consigne
de planche, puis `FRAMING —` puis `CAMERA —`. Le rapport affiche la différence mot à mot :
elle doit être **vide hors titres, lignes vides et lignes de nommage**. Si elle ne l'est
pas, le script refuse de tirer.

### Échecs prévus (les cases à cocher)

- a copié la pose ou la mise en page de l'artwork
- a redessiné les traits de la grille
- le personnage n'est pas le même d'une case à l'autre
- les huit cases sont la même pose
- a rendu un nombre de sujets différent de huit
- autre (champ libre)

### Décision, écrite d'avance

Sur huit tirages, le bruit vaut environ une planche et demie. **B entre dans R7 si B ≥ A en
bonnes planches** — R7 ne promet que la lisibilité, donc « pas pire » suffit à adopter le
nommage, et « +2 ou plus » en fait un levier à écrire dans le bilan. **C entre dans R7 si
C ≥ B.** Si B < A − 2, le nommage tel qu'écrit nuit, et R7 se limite au rangement visuel de
l'écran de confirmation sans changer ce qui part. Dans tous les cas, l'échec « a copié la
pose » est compté à part : c'est lui que le nommage vise.

### Si ça marche

R7 reçoit deux critères de plus : « chaque image jointe est annoncée par son numéro et son
rôle, dans l'ordre d'envoi » et « la phrase générique disparaît ». Le rôle `gabarit` et le
rôle `palette` deviennent des `Reinjection` nommées (aujourd'hui elles n'en ont pas,
`services/generation.py:609-623`).

---

## E2 · La taille de la référence

**La question.** Le sprite promu part en rendu PNG **à la taille cible du projet** — 64×64
pour demander une image de 1024 px (`services/assets.py:721-732`). Le modèle voit-il assez
de son sujet ? Un agrandissement au plus proche voisin, qui garde les pixels carrés, ferait-il
mieux, et à quel surcoût (le coût croît avec la surface : +58 % mesuré à 1024²) ?

**Ce qu'on attend.** Que 256 px améliore « le personnage est le même » sans changer le reste,
et que 512 px n'apporte plus rien de plus tout en coûtant davantage.

### Les groupes

| Clé | Ce qui change |
|---|---|
| `A-temoin` | le sprite promu en 64 px, tel qu'il part aujourd'hui |
| `B-256` | le même rendu agrandi ×4 au plus proche voisin (`Image.NEAREST`) |
| `C-512` | ×8 |

Le texte est **strictement celui du témoin** (pas de nommage : E2 mesure une seule chose).
Seule l'image de rôle `reference` change ; l'artwork, le gabarit et la bande de palette
restent identiques. Huit tirages par groupe. **Seize appels neufs, ~0,70 $** (les groupes B
et C coûtent plus cher par appel, et c'est une des mesures), **plafond 1,00 $.**

Le rapport montre, au-dessus de chaque colonne, la vignette de référence envoyée à sa taille
réelle, pour que l'auteur voie ce que le modèle a vu.

### Échecs prévus

- le personnage n'est pas reconnaissable comme le même
- les proportions changent (tête, membres)
- les cases recopient la pose de la référence
- le style « escalier » de l'agrandissement se retrouve dans la planche (blocs de 4 ou 8 px)
- autre

### Décision

**La taille retenue est la plus petite dont le nombre de « même personnage » (bonnes +
moyennes sans la case « pas reconnaissable ») est ≥ celui de la taille au-dessus.** Le prix
par bonne planche est affiché à côté pour que l'auteur voie ce qu'il achète. Si 64 px n'est
jamais battu, la question est fermée et le bilan le dit.

### Si ça marche

`services/assets.py` reçoit un réglage « taille d'envoi des références » (par défaut la
taille retenue), et le prix estimé avant clic en tient compte — `couts_par_references` compte
aujourd'hui le nombre d'images, pas leur surface.

---

## E3 · La grille complète

**La question.** `geometrie(8)` rend 3×3 : dernière rangée à deux cases, et le modèle
complète la troisième — quatre planches sur treize refusées « pour un sujet de trop ». Une
grille complète 4×2, dans un format d'image qui la rend lisible, supprime-t-elle la case
fantôme sans dégrader le reste ?

**Ce qu'on attend.** Zéro « neuf pour huit » en B et C ; un personnage un peu plus petit par
case (les cases sont moins hautes en 3:2), à voir si ça se paie en lisibilité.

### Les groupes

| Clé | Grille | Format demandé | Gabarit |
|---|---|---|---|
| `A-temoin` | 3×3, 8 cases dessinées | `1:1` | celui du produit |
| `B-4x2-1:1` | 4×2 | `1:1` | `image.pliage.gabarit(Geometrie(8, 4, 2))` tel quel : sur le canevas carré du produit, les cases font ~226×468 px — **hautes**, ce qui convient à un personnage debout |
| `C-4x2-3:2` | 4×2 | `3:2` | redessiné par le script avec les constantes du produit (marge 40, gouttière 24, trait 3 px en 198 sur 235) sur un canevas 1024×683 — `gabarit()` ne dessine qu'en carré |

Le texte est celui du témoin ; seule la phrase de la consigne de grille change de chiffres
(« Exactly 4 columns and 2 rows, 8 cells total » au lieu de « Exactly 3 columns and 3 rows,
8 cells total »), ce que le rapport montre en différence. B ne change **que** la géométrie ;
C change aussi le format d'image, et c'est pour ça qu'il vient après. Huit tirages par
groupe, **seize appels, ~0,25 $, plafond 0,40 $.**

### Échecs prévus

- neuf sujets (ou plus) pour huit demandés
- moins de huit sujets
- le personnage est trop petit ou illisible dans sa case
- a redessiné les traits de la grille
- le format rendu n'est pas celui demandé (vérifié par le script sur les octets)
- autre

### Décision

**B ou C remplace 3×3 si son nombre de « neuf pour huit » est nul sur huit tirages et si ses
bonnes planches sont ≥ A − 1.** Entre B et C, le format où l'auteur juge le personnage le
plus lisible. Si les deux échouent sur la lisibilité, R6 garde la tolérance du neuvième
sujet telle qu'écrite — mais on saura pourquoi.

### Si ça marche

`geometrie()` préfère « la plus complète » à « la plus carrée » quand le modèle déclare un
format qui le permet, et la consigne de grille suit. R6 se réduit au contrôle du quadrillage
redessiné et du remplissage.

---

## E4 · La mise en pose d'abord — la « prep » de SpriteCook

**La question.** SpriteCook ne demande jamais la planche depuis le sprite de base : il
insère une génération intermédiaire qui met le personnage dans la pose de départ du
mouvement, puis anime **ce** sprite. Ton étude des prompts a mesuré, au tour 3, qu'un
référent « refait dans la caméra du jeu » donnait même taille, même silhouette, rien
d'inventé — et le produit ne le fait pas. Une planche demandée depuis un sprite déjà de
profil, en pose de contact, est-elle meilleure qu'une planche demandée depuis l'artwork de
face ?

**Ce qu'on attend.** Que l'échec dominant des bancs — la taille qui change d'une case à
l'autre — recule, et que « le personnage est le même » monte.

### Temps 1 — la prep (huit tirages, l'auteur en garde une)

Un appel d'**image seule** : images = [le sprite promu, rôle `reference`] (à la taille
retenue par E2, sinon 256 px) ; texte = les sept lignes de bible du témoin, puis une seule
ligne de demande :

```
The same character, seen from the side as in the game's camera, standing in the
contact pose of a walk cycle (front foot forward and planted, back foot behind,
arms opposite to legs), full body, single isolated sprite, plain background.
```

puis `FRAMING —` et `CAMERA —` du témoin. Huit tirages, ~0,10 $. Le rapport les montre en
grand (×4 plus proche voisin), côte à côte avec le sprite promu ; **l'auteur en choisit une
d'un clic** — celle qui est le plus « lui, de profil, en pose de contact ». Le choix est
exporté avec les notes.

Échecs prévus du temps 1 : le personnage a changé (tenue, proportions, couleurs) ; la vue
n'est pas de profil ; la pose n'est pas une pose de marche ; il y a plus d'un sujet.

### Temps 2 — la planche depuis la prep (huit tirages contre le témoin)

| Clé | Images jointes |
|---|---|
| `A-temoin` | artwork (style) + sprite promu de face (reference) + gabarit + palette — le départ rejoué |
| `B-prep` | artwork (style) + **la prep choisie** (reference) + gabarit + palette ; texte identique au témoin |

Huit tirages, ~0,20 $. Si E1 a été concluant, B reçoit aussi les lignes de nommage — et
alors A aussi, pour comparer à armes égales (c'est écrit en tête de rapport). **Plafond du
lancement : 0,50 $.**

### Échecs prévus du temps 2

- la taille du personnage change d'une case à l'autre
- les huit cases recopient la pose de la prep (rien ne bouge)
- le personnage n'est plus le même que l'artwork
- a redessiné la grille
- nombre de sujets ≠ 8
- autre

### Décision

**B remplace la référence de face si B ≥ A + 2 bonnes planches**, ou si « la taille change »
recule d'au moins trois planches sur huit. Sinon, la prep n'entre pas dans la V3 comme
étape, et le référent de la fiche 04 reste une question ouverte.

### Si ça marche

Une tranche hors version, courte : « le référent d'un personnage » — un appel guidé sans
pose, dans la caméra du jeu, jugé par l'auteur, promu comme référence de toutes les poses
(`production.py`, champ `referent` ; `generation.py:2091-2112` le fait partir en
`reference` et tait la carte de face). Et A2 hérite d'un fait : la planche part d'un sprite
déjà à l'échelle.

---

## E5 · La pose imposée par image — le quatrième chemin d'A0

**La question.** Le « guide de marche » joint en troisième image d'une planche a échoué
(2 sur 8 contre 5 sur 8 sans). Mais il était une image de plus dans une planche à huit
cases. Ici : **une seule pose par appel**, l'image de posture en **rôle édition** (elle
*est* la demande), le sprite promu en référence (l'identité). Le modèle habille-t-il une
géométrie imposée ?

**Ce qu'on attend.** Pas un taux : une réponse à « est-ce que ça obéit, et à quoi ça
ressemble quand ça obéit ». C'est une **exploration** : une tentative à la fois, quatre
poses par tour, et l'on écrit avant chaque tour ce qu'on attend et ce qui peut rater.

### Les images de pose

Fabriquées par `essais/guide_marche.py`, qui existe déjà et sait dessiner un cycle juste
(`squelette(phase, h)` et `_dessiner(…, pleine)`), mais ne rend aujourd'hui qu'une planche
entière (`planche_guide`). Il reçoit une fonction de plus, `image_guide(phase, cote=512,
pleine=True) -> bytes`, qui rend **une seule pose** : le personnage centré sur le fond du
produit, pieds sur une ligne de sol à 10 % du bas. Quatre instants — **contact, appui,
passage, envol** (phases 0, ¼, ½, ¾ du demi-cycle) — en deux formes : **silhouette pleine**
(la masse) et **bonhomme-bâton** (les articulations). Pour le tour 1, la silhouette pleine ;
le bâton est le tour 2 si la silhouette échoue.

### Le texte d'un appel

Les sept lignes de bible ; puis, parce que le rôle édition fait taire la phrase des images
dans le produit, **une** ligne écrite pour cet essai :

```
Image 1 is a pose guide: redraw it as the character shown in Image 2, in exactly
this pose and these proportions of limbs — same body position, same foot
placement. Image 2 gives the identity: colours, outfit, face, drawing style.
Single isolated sprite, plain background.
```

puis `FRAMING —` et `CAMERA —` du témoin. Images : [pose, sprite promu (taille retenue par
E2)]. `openai/gpt-image-2`, `low`. **Quatre appels par tour, ~0,10 $ ; quatre tours au
plus, plafond 0,50 $.**

### La boucle, tour par tour

Avant chaque tour, le script demande au terminal deux lignes à écrire dans
`mesures.json` : « ce que j'attends » et « ce qui peut rater » (les échecs prévus
ci-dessous, cochés d'avance). Après le tour, le rapport montre les quatre résultats **avec
la pose en surimpression** (case à cocher « superposer le guide », opacité réglable, le
guide en rouge), pour juger l'obéissance au pixel, et le sprite promu à côté pour juger
l'identité. L'auteur note chaque image : `obéit` / `obéit à moitié` / `n'obéit pas`, et
`même personnage` oui / non, puis conclut le tour : **quel échec prévu s'est produit**, ou
lequel n'était pas prévu.

Échecs prévus, tour 1 :

- a dessiné le guide lui-même (une silhouette grise, un bâton)
- a gardé l'identité mais ignoré la pose (pose idle)
- a suivi la pose mais perdu l'identité (tenue, couleurs)
- a changé de caméra (trois quarts, face)
- a rendu plusieurs sujets

Correctifs autorisés entre deux tours, **un seul par tour** : la forme du guide (silhouette
→ bâton → silhouette colorée aux couleurs du sprite) ; l'ordre des deux images ; la ligne de
texte. Jamais deux changements à la fois. **Arrêt** quand les quatre poses obéissent et sont
le même personnage, ou quand deux tours de suite n'apprennent rien.

### Si ça marche — un cinquième tour, pour voir

Huit appels, une pose chacun, sur les huit instants du cycle ; les huit images assemblées
par le socle en une bande à fenêtre commune (union des boîtes, pieds sur la même ligne) et
montrées **animées à côté du témoin**. ~0,20 $. C'est la seule fois où E5 se compare à une
planche : si la bande de huit appels est jugée meilleure, le « quatrième chemin » entre dans
A0 comme chemin retenu, et A7 (« remplacer une étape ») a enfin un mécanisme.

Si Gemini 3 Pro Image doit être essayé (deux tours n'ont rien appris chez gpt-image-2),
c'est un tour de plus, au même protocole, à son prix (vingt-trois fois plus).

---

## E6 · L'image-vers-vidéo — le mécanisme de SpriteCook

**La question.** SpriteCook n'obtient pas ses huit images en demandant une planche : il
anime le sprite avec un modèle image-vers-vidéo, extrait des images équidistantes, détoure
chacune, applique une palette commune et assemble. La cohérence entre images vient du
modèle vidéo, fait pour ça. Sur ton nain, via une API, ce chemin donne-t-il une bande de
marche utilisable plus souvent qu'une planche dessinée d'un coup — et à quel prix ?

**Ce qu'on attend.** Une marche lisible sur la majorité des clips, un personnage qui reste
lui-même, et un fond assez uni pour que le détourage du produit passe. Ce qu'on ne sait
pas : si le rendu vidéo garde l'allure pixel art, ou s'il la lisse — auquel cas la remise
sur grille (D2) devient l'étape qui décide.

### Le fournisseur et le coût — à relever avant le premier appel

Un script à part, `essais/essai_video_planche.py`, avec son propre adaptateur de vingt
lignes en `httpx` (ce n'est pas un fournisseur du produit, et il n'entre pas dans
`atelier/`). Fournisseur : **fal.ai** (clé `FAL_KEY`), qui expose plusieurs modèles
image-vers-vidéo derrière une même API de file d'attente ; Replicate en repli. Modèles à
essayer, du moins cher au plus cher : **Wan 2.2** (5B, le moins cher), **Seedance** (lite),
**Kling** (standard). Les identifiants exacts d'endpoint et les prix se lisent sur la page
du modèle **au moment d'écrire le script** et se recopient dans `mesures.json` avec la date :
l'ordre de grandeur est de cinq à quarante centimes pour cinq secondes, et il change. Le
script refuse de partir si le prix relevé n'est pas renseigné.

### L'entrée

Le sprite préparé de E4 (de profil, pose de contact) s'il existe, sinon le sprite promu ;
rendu du produit agrandi au plus proche voisin jusqu'à **768 px de haut**, posé au centre
d'un canevas **1024×576** (16:9) sur un fond plat **gris 235** (le fond du produit — la
vidéo compressera un vert, et le despill n'existe pas encore). Le texte, court, en anglais,
le même pour tous les modèles :

```
Pixel art game sprite. The character walks in place, side view, static camera,
no zoom, no camera movement, plain flat background, the character stays the
same size and the same design, seamless walk cycle loop.
```

Durée demandée : la plus courte que le modèle accepte (3 à 5 s), résolution la plus basse
(480p ou 576p), sans son. **Quatre clips par modèle, trois modèles, plafond 3,00 $.** Un clip
déjà sur le disque n'est pas repayé.

### L'extraction — et c'est l'auteur qui choisit le cycle

Le script lit chaque clip avec `imageio` + `imageio-ffmpeg` (paquets BSD ; le binaire
ffmpeg qu'ils embarquent est sous sa propre licence LGPL/GPL — sans conséquence pour un
essai, à ne pas faire entrer dans le produit tel quel ; aucune installation système) et
écrit **toutes** les images en PNG dans
`resultats_video/<modele>/clip<N>/frames/`, plus une bande de vignettes.

Le rapport montre, pour chaque clip : la vidéo elle-même (balise `<video>` locale), la bande
de toutes les images à 96 px, et **deux curseurs — début et période** — qui prélèvent huit
images équidistantes dans la fenêtre choisie et les montrent **animées en direct** à 125 ms.
C'est l'auteur qui cale le cycle à l'œil (un modèle vidéo rend rarement exactement une
période) ; le choix s'exporte avec les notes. Un bouton « figer ce cycle » écrit les huit
PNG choisis dans `resultats_video/<modele>/clip<N>/bande/`.

Un second script, `essais/monter_bande_video.py`, prend ces huit images et les passe dans
**la chaîne du produit telle qu'elle est** — détourage par le bord à tolérance 28, puis
recadrage sur une fenêtre commune (union des boîtes, pieds alignés), puis grille à la cible
du projet, puis quantification sur la palette du projet — et écrit la bande pixelisée et son
GIF. Le rapport la montre **sous la bande brute**, et à côté, **le témoin** : les planches
gpt-image-2 déjà sur le disque, à la même échelle et à la même vitesse.

### Échecs prévus

- la caméra bouge, zoome ou tourne
- le personnage se retourne ou change de direction
- le personnage change de taille ou de design au fil du clip (morphing)
- les membres fondent ou se dédoublent
- le fond n'est pas uni (dégradé, ombre, texture) et le détourage laisse des restes
- le clip ne contient pas un cycle entier, ou en contient trop peu d'instants distincts
- le rendu est lissé « 3D » et la pixelisation ne le rattrape pas
- autre

### Notation

Comme ailleurs : `bon` / `moyen` / `mauvais` **sur la bande brute** (le mouvement), puis une
seconde note **sur la bande pixelisée** (le résultat), parce que les deux peuvent diverger et
que c'est précisément ce qu'on veut savoir. Les échecs cochés. Le tableau du verdict donne,
par modèle : clips utilisables (bande brute bonne), bandes pixelisées bonnes, prix par bande
bonne — et, pour le témoin, le même prix par bonne planche.

### Décision

**Le chemin vidéo entre dans A0 comme chemin candidat si un modèle donne ≥ 2 bandes
pixelisées bonnes sur 4 clips**, à un prix par bonne bande inférieur ou égal à celui du
témoin. S'il donne 4 sur 4, la V3 change de forme : A3 se réduit à « commander deux clips et
garder le bon », A8 devient un confort, et un adaptateur vidéo devient une tranche. Si les
bandes brutes sont bonnes mais les pixelisées mauvaises, c'est D2 qui est en cause, pas la
vidéo — et c'est une raison de plus de faire D2 avant A5.

### Si ça marche

Une tranche « le sprite animé par vidéo » : un port `PortAnimateur` distinct du port image
(un appel = un clip, `consomme` en secondes ou en crédits), un adaptateur fal.ai, l'écran
de choix du cycle (les deux curseurs du rapport, tels quels), et le montage par la chaîne
existante. Les invariants tiennent : le traitement reste CPU ; seul l'appel est payant.

---

## 2 · Ce que les six essais font entrer dans le plan, selon le résultat

| Essai | S'il réussit | S'il échoue |
|---|---|---|
| E1 | R7 : nommage des images par numéro et rôle ; `gabarit` et `palette` deviennent des rôles nommés | R7 se limite à l'écran ; le bilan note « nommer ne change rien », et la question ne revient plus |
| E2 | un réglage de taille d'envoi des références ; le prix estimé compte la surface | 64 px reste, question fermée |
| E3 | `geometrie()` préfère complète à carrée ; R6 rétrécit | R6 garde la tolérance ; on sait que la case fantôme ne vient pas de la grille |
| E4 | une tranche « référent par personnage » ; A2 part d'un sprite à l'échelle | le référent reste une question ouverte du bilan |
| E5 | A0 retient le quatrième chemin ; A7 a un mécanisme | A0 se concentre sur le pantin ; le bilan écrit pourquoi une image de pose n'est pas suivie |
| E6 | une tranche « animateur vidéo » ; A3 et A8 rétrécissent | le bilan écrit que la vidéo ne tient pas sur ce sujet, avec les clips à l'appui, et A8 reste la sortie de la loterie |

Chaque résultat, réussite ou échec, rejoint `docs/bilan-v3.md` en une ligne avec le chiffre,
le prix et le nom du rapport — la règle « un chemin abandonné qu'on ne consigne pas revient
six mois plus tard ».

---

## 3 · Ce que « fini » veut dire, pour qui code

- [ ] `essais/socle_essais.py` existe, ne modifie rien dans `atelier/`, et ses fonctions
      pures (transformation du texte, différence mot à mot, extraction des rôles) ont des
      essais dans `tests/test_essais_socle.py` — **sans un centime**, sur le double.
- [ ] Six scripts `essais/essai_*.py`, chacun avec son docstring dans le style du dépôt
      (la question, ce qu'on attend, le coût, comment lancer), son plafond en dur, et sa
      sortie dans `resultats_<essai>/`.
- [ ] Six rapports `essais/rapport-<essai>.html` respectant les neuf points du § 1.2 ;
      la différence mot à mot est visible pour toute variante qui change le texte.
- [ ] Un script qui tourne **à sec** (`--a-sec`) : il montre ce qui partirait — textes,
      images avec rôles et tailles, nombre d'appels, coût estimé d'après `mesures_prix_planche.json` — et ne dépense rien. C'est le premier lancement de chaque essai, et
      l'auteur le relit avant de payer.
- [ ] `AGENTS.md` § Lancer reçoit six lignes, avec le prix de chaque essai, comme pour les
      bancs existants.
- [ ] `.env.example` déclare `FAL_KEY` ; `pyproject.toml` reçoit un extra `essais-video =
      ["imageio>=2.35", "imageio-ffmpeg>=0.5"]`, optionnel comme `detourage`.
- [ ] Les notes de l'auteur s'exportent en `essais/notes-<essai>.json` et sont
      versionnées ; `essais/verdict_essais.py` relit les six fichiers et imprime le tableau
      des décisions, règle par règle, sans jamais conclure au-delà de ce que la règle dit.
