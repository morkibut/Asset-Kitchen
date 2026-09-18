# Les références d'un sujet — chaque image part quand elle sert

> Chantier ouvert le 18 septembre 2026, à la demande de l'auteur, après une fabrication de
> Champy au bâton : la planche des quatre directions était jointe, et le modèle a rendu **un
> seul** Champy en vue isométrique. Le texte envoyé demandait « one single sprite », et la
> planche n'y était décrite que comme « le même personnage ».

## Ce qui existe (relevé du 18 septembre 2026)

- Un sujet porte une liste d'images **promues en référence** (`Personnage.references`). Elles
  partent **toutes, à chaque appel qui le vise**, en rôle `REFERENCE`, décrites au modèle par
  une seule phrase : *THE SAME CHARACTER*. Rien ne distingue une planche de quatre vues d'une
  vue de face.
- L'écran *Relire avant l'envoi* laisse décocher chaque image jointe, pour cet appel seulement ;
  les portées durables (jeu, sujet) s'écrivent depuis le panneau des réglages. **Cela reste.**
- Une image fixe part toujours avec le cadre *FRAMING — one single sprite and nothing else* et
  la caméra *CAMERA — this overrides everything above*. Seule une planche pliée y échappe.

## Les décisions

1. **Une référence promue porte un usage**, et un seul : `libre` (défaut — part toujours,
   comme aujourd'hui), `planche` (toutes les vues du sujet sur une image), ou
   `direction:<id>` (le sujet vu dans cette direction). Les références déjà promues sont
   `libre` : rien de ce qui part aujourd'hui ne change tant que l'auteur ne range rien.
2. **La fabrication choisit selon son contexte**, jamais au hasard :
   - une planche (pliée par directions, ou *refaire une planche*) → les références `planche` ;
   - une case dans une direction → les références de **cette** direction ; s'il n'y en a pas,
     la `planche` ;
   - le reste (sans case, sans direction) → aucune référence typée.
   Les `libre` partent dans tous les cas. Les autres usages restent sur la fiche.
3. **Chaque image jointe dit au modèle ce qu'elle est** : une planche est décrite comme une
   planche (« chaque case est le même personnage vu sous un autre angle »), une référence de
   direction comme « le même personnage, vu sous cet angle ».
4. **Refaire une planche** est une case de la préparation d'une image fixe : *Garder la mise en
   page de la référence*. Cochée, le cadre « un seul sprite » et la phrase qui fait primer la
   caméra ne partent pas ; une consigne demande de reproduire la planche — même nombre de vues,
   même ordre, même cadrage — en n'appliquant que la modification décrite. La mise en page vient
   de la référence `planche` du sujet, sinon de la première image jointe à la main ; sans l'une
   ni l'autre, l'appel est refusé **avant de payer**.
5. **La référence d'une direction ne se crée pas toute seule** : ce serait envoyer une image que
   l'auteur n'a pas choisie. La fiche propose, pour une direction sans référence, l'image
   retenue de cette direction, en un clic.

## Les tranches

### RS1 · L'usage d'une référence, et le choix selon le contexte (serveur)

Le champ, sa route, la sélection dans `_reinjections`, la phrase qui décrit chaque image, la
provenance lisible dans *Relire avant l'envoi*.

- [x] une référence promue porte un usage (`libre` par défaut), écrit dans le fichier du sujet
      et relu sans migration
- [x] une route règle l'usage d'une référence ; un usage de direction que le jeu ne tient pas est
      refusé
- [x] une case dans une direction n'emporte que les références de cette direction (sinon la
      planche), plus les libres ; une planche pliée par directions emporte la planche
- [x] le texte décrit une planche comme une planche, une direction comme une direction
- [x] l'écran de confirmation nomme l'usage de chaque référence ; les décocher marche toujours
- [x] essais sans appel payant

### RS2 · Refaire une planche

- [x] la case *Garder la mise en page de la référence* existe sur la préparation d'une image
      fixe, et part avec la demande
- [x] cochée : ni « one single sprite », ni la phrase qui fait primer la caméra ; une consigne
      de planche à reproduire, lisible dans *Relire avant l'envoi*
- [x] la référence `planche` du sujet part, décrite comme la mise en page à reproduire ; sinon la
      première image jointe à la main ; sinon refus avant de payer
- [x] essais sans appel payant (`tests/test_rs2.py`, `App.test.tsx` « refaire une planche »)
- [ ] **un essai payé** proposé à l'auteur, prix annoncé d'abord

Tranché en RS2 :

- le drapeau s'appelle `garder_mise_en_page` ; `generation.json` ne le porte que s'il est vrai,
  et la relance le relit ;
- « single isolated sprite » devient « isolated sprites » (fond et grille gardés) ; le cadre ne
  part pas ; la caméra reste la dernière ligne mais « vaut pour chaque vue, sans changer la mise
  en page » ; la consigne `LAYOUT` (clef `cadrage.mise-en-page`) prend la place du cadre et ne
  s'éteint pas — la case est son interrupteur ;
- **refusé**, pas ignoré, avec un lot plié, une pièce ou une case visée (pose ou direction) : une
  planche refaite ne se range pas dans une seule case. L'écran ne montre la case que pour une
  image fixe sans case visée, et ne l'envoie pas sinon ;
- l'image jointe à la main sert si elle part en « référence » ou en « image à modifier » ; une
  carte de style ne sert jamais de mise en page ;
- une planche du sujet décochée pour cet appel, ou laissée au sol par le plafond du modèle, ne
  sert pas : on retombe sur l'image jointe, sinon on refuse.

### RS3 · La fiche range ses références

- [x] l'onglet *Images de référence* montre les références par usage : la planche, une place
      par direction du jeu, les libres
- [x] l'usage d'une référence se change sur la fiche
- [x] une direction sans référence propose l'image retenue de cette direction, en un clic
- [x] essais d'écran

Tranché en RS3 :

- rangée dans `ImagesDuSujet.tsx` (nouvelle section `SesReferencesParUsage`, sous les rangées de
  poses), pas dans la fiche longue de `FicheDuSujet.tsx` : c'est bien l'onglet *Images de
  référence* que RS3 vise, et `ImagesDuSujet.tsx` en est le composant réel — la section
  `SesReferences` de la fiche longue (réglages) reste ce qu'elle était, un tableau plat sans
  usage ;
- « une place par direction du jeu » lit en fait **les directions que ce sujet tient**, l'union de
  `Case.directions` sur ses poses — une place pour une direction qu'aucune pose ne remplirait
  jamais n'aurait rien pu recevoir ;
- la retenue d'une direction reprend le départage déjà écrit pour les rangées de la matrice
  (`rangerLaLigne`, même favori/date/rang) sur les images de `CaseDirection.images`, cherchée pose
  par pose dans l'ordre du plan ; à défaut de retenue, la première image chronologique de la
  direction, jamais une proposition vide ;
- le bloc lit sa propre route (`api.referencesDeLaChose`) et la relit après chaque écriture,
  comme le fait déjà `FicheDuSujet.tsx` pour son propre volet — deux lectures indépendantes de la
  même route, pas un état partagé entre les deux écrans ;
- l'erreur du serveur (409 sur une direction non tenue, par exemple) s'affiche en clair sous la
  ligne concernée, en plus du bandeau `onErreur` déjà en place pour le reste de l'onglet.

### RS4 · La case planche passe partout

- [x] l'outil de génération de l'agent accepte `garder_mise_en_page`, avec les mêmes refus
- [x] « Reprendre les réglages » d'une image recoche la case quand sa génération l'avait
- [x] essais sans appel payant

### RS5 · L'agent peut refaire une planche

- [ ] l'outil de génération de l'agent vise un sujet (sans pose) et joint des images en référence
- [ ] avec `keep_reference_layout`, la planche du sujet ou l'image jointe sert de mise en page ;
      les refus restent ceux du service
- [ ] essais sans appel payant

**Ordre** : RS1, puis RS2 et RS3 — toutes deux dépendent de l'usage posé par RS1.
