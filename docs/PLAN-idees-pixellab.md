# Plan : trois idées vues chez PixelLab — repeindre une zone, donner de la marge, finir sur une image

> **Ouvert le 26 septembre 2026, en autopilote, à la demande de l'auteur**, après l'analyse d'un
> tutoriel PixelLab (`docs/releve-usage.md` § 25 septembre 2026). L'auteur a choisi de commencer
> par **l'essai de la zone en local**.
>
> **Ce chantier ne dépense rien.** Tout ce qui se vérifie tourne sur la machine (ComfyUI, 0 $).
> Ce qui ne se vérifie qu'avec un appel payé (une image de fin chez OpenRouter) est **construit et
> essayé avec le double du fournisseur**, puis laissé à l'auteur avec son prix.
>
> Quel modèle sur quelle tranche : [`PLAN-idees-pixellab-affectation.md`](PLAN-idees-pixellab-affectation.md).

---

## Ce que c'est, en trois gestes

1. **Repeindre une zone.** Sur une image, on peint une tache sur la tête et on écrit « une
   coiffure ». Seule la zone peinte change ; le reste de l'image ne bouge pas d'un pixel, et ce
   qui a changé devient un calque qu'on garde ou qu'on jette.
2. **Donner de la marge.** Avant d'animer un grand geste, on dit combien de place laisser autour
   du sujet, pour que les bras ne sortent pas de l'image.
3. **Finir sur une image.** Pour une boucle, l'animation finit sur l'image de départ ; elle
   revient donc à son point de départ, et l'image en double n'entre pas dans la bande.

## Ce que ce n'est pas

- **Pas de retouche de zone par OpenRouter** : aucun de ses 55 modèles image n'accepte de masque
  (vérifié le 26 septembre 2026). La zone passe par ComfyUI, sur la machine.
- **Pas de nouveau fournisseur ni de téléchargement.** Les nœuds et les poids nécessaires sont
  déjà installés ; on n'installe rien dans ComfyUI.
- **Pas le squelette de PixelLab** (Skeleton V3) : nos animations passent par la vidéo.

## Ce qui a été relevé avant d'écrire

- **Une image jointe à ComfyUI est aplatie sur du blanc** avant d'être déposée. Une zone marquée
  par la transparence serait effacée en route : le masque doit voyager **à part**, sous son nom.
- **Aucun appel de l'atelier ne passe de masque aujourd'hui**, ni en image ni en vidéo.
- **La marge est fixe** : le sujet occupe 80 % de l'image envoyée au modèle vidéo, sans réglage.
- **L'image de fin** : OpenRouter déclare modèle par modèle s'il la prend (16 sur 29) ; l'atelier
  lit ce champ mais ne retient que l'image de départ. Le modèle maison (Wan 2.2) la prendrait par
  le nœud natif `WanFirstLastFrameToVideo`, et ses poids sont déjà là.

---

## PX1 · Le banc de la zone — est-ce que ça marche, sur la machine ?

**Livre** un banc gratuit qui répond à une seule question : *sur un sprite de l'atelier, un
moteur local repeint-il une zone proprement, sans toucher au reste ?*

Il part d'un personnage en pixel art, peint trois zones (la tête, le torse, les jambes), demande
une coiffure, un vêtement du haut, un pantalon, et garde huit tirages par zone et par moteur
essayé. Le résultat est recollé **dans la zone seulement**, ramené à la grille du sprite et à ses
couleurs. Les images vont dans un dossier que l'auteur ouvre, avec une planche de comparaison.

**Ce que la mesure sépare** : un pixel hors de la zone qui a changé (une faute, qui doit valoir
zéro par construction), un pixel de la zone qui a changé (le travail demandé), et une zone
revenue identique (un tirage raté).

### Critères d'acceptation

- [ ] Le banc tourne sur un atelier jetable, sans rien écrire dans les données de l'auteur, et
      refuse de partir si un appel payé est possible.
- [ ] Au moins deux moteurs locaux essayés, huit tirages par zone et par moteur.
- [ ] Hors de la zone : zéro pixel changé, sur tous les tirages.
- [ ] Un verdict écrit en une phrase dans `docs/releve-usage.md` : quel moteur, quel réglage, et
      si la suite (PX2, PX3) vaut d'être construite.

## PX2 · Le masque voyage jusqu'au moteur local

**Livre** une liaison `masque` dans un profil local : une image en noir et blanc déposée **sans
être aplatie**, lue par ComfyUI comme une zone. Un style local de retouche de zone s'installe
comme les autres styles et figure dans la liste des modèles ; un modèle qui ne sait pas repeindre
une zone est **grisé avec sa raison** quand on lui en donne une.

*Ne se construit que si le verdict de PX1 est bon.*

### Critères d'acceptation

- [ ] Un profil déclare la liaison `masque` ; un profil qui ne la déclare pas refuse un masque
      par un message, jamais en silence.
- [ ] Le masque arrive à ComfyUI tel qu'il est parti (essai qui relit l'image déposée).
- [ ] Le style de retouche de zone s'installe, se liste, et se grise avec sa raison si ses
      fichiers manquent.
- [ ] Les essais des moteurs locaux déjà écrits passent sans qu'une assertion bouge.

## PX3 · Peindre une zone dans l'atelier

**Livre** l'outil sur la fiche d'une image : un pinceau qui peint la zone, un texte, un bouton
qui annonce le temps. Le résultat arrive **sur un calque qui ne porte que les pixels changés dans
la zone**, ramené aux couleurs de l'image ; on le garde, on le jette, ou on recommence. Le
calque gardé se referme et se rouvre avec sa zone et son texte. L'agent a le même geste.

*Ne se construit que si PX2 est faite.*

### Critères d'acceptation

- [ ] Peindre, écrire, lancer : le calque ne contient aucun pixel hors de la zone.
- [ ] Le temps est annoncé sur le bouton avant de partir.
- [ ] Un calque gardé se rouvre avec sa zone et son texte, gardé avec des réglages qui ne sont
      pas ceux du défaut.
- [ ] Le guide a sa ligne pour le nouveau réglage (`interface/src/aide.ts`).
- [ ] L'agent peut demander la même retouche.

## PX4 · La marge avant d'animer

**Livre** un réglage « place autour du sujet » sur l'écran qui prépare une animation : la part
de l'image que le sujet occupe, aujourd'hui fixée à 80 %. Il se garde avec le clip, se relit à la
réouverture, et l'agent peut le donner.

### Critères d'acceptation

- [ ] Le réglage change l'image envoyée au modèle vidéo (essai sur l'image composée).
- [ ] Sans réglage, l'image envoyée est identique à celle d'aujourd'hui.
- [ ] Un clip gardé avec une marge qui n'est pas celle du défaut se rouvre avec elle.
- [ ] Le guide a sa ligne ; l'agent peut donner la marge.

## PX5 · Finir sur une image

**Livre** l'image de fin : « finir sur l'image de départ » (la boucle), ou une autre image. Un
modèle qui ne la prend pas est grisé avec sa raison. Elle part chez OpenRouter dans le champ
prévu, et chez le modèle maison par le nœud natif. Quand la fin est l'image de départ, l'image en
double est retirée de la bande pour que la boucle ne saute pas.

### Critères d'acceptation

- [ ] Le catalogue sait quels modèles prennent une image de fin, et grise les autres avec leur
      raison quand on en demande une.
- [ ] L'appel OpenRouter porte l'image de fin (essai sur le corps de l'appel, fournisseur doublé).
- [ ] Le modèle maison reçoit l'image de fin par `WanFirstLastFrameToVideo` (essai sur le graphe).
- [ ] Une boucle n'a pas l'image en double à sa fin.
- [ ] Un clip gardé avec une image de fin se rouvre avec elle ; l'agent peut la demander.
- [ ] Le guide a sa ligne.
- [ ] **Laissé à l'auteur** : un essai payé chez OpenRouter, avec son prix annoncé.

## PX6 · La relecture croisée

**Livre** une relecture des tranches faites, confrontées entre elles et au plan : ce que le
serveur sait rendre a un chemin depuis un écran, les mots suivent `docs/vocabulaire.html`, les
critères cochés le sont à raison. Le tableau d'état de `docs/PLAN.md` reçoit sa ligne.
