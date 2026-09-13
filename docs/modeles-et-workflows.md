# Les modèles et workflows retenus — quoi lancer, pour quel asset, à quel coût

> Écrit le 13 septembre 2026. **On l'ouvre avant de toucher au code de génération** : il dit quel
> modèle, quel workflow, quel prompt et quels réglages produisent un asset correct, et combien de
> temps ça prend. Il évite de refaire des essais déjà faits.
>
> ⚠️ **Ce document ne décide rien sur le produit.** `docs/PRD.md` dit ce que l'atelier doit faire.
> Celui-ci dit seulement ce qui, mesuré, marche et ce qui ne marche pas.
>
> **D'où viennent les chiffres.** D'un banc tenu dans un dépôt voisin — `sc-clone`, une
> reconstruction locale de SpriteCook — entre le 11 et le 13 septembre 2026 : **46 essais** sur la
> même machine et le même sprite de référence, avec la même graine. Ils ne viennent **pas** de la
> chaîne de cet atelier. Le rapport de faisabilité du 3 septembre
> (`docs/archive/recherche-video-locale/rapport.md`) mesurait autre chose — 832 × 480 — et ses durées ne
> sont donc pas comparables aux durées ci-dessous, qui sont toutes en 512 × 512.
>
> **Couverture.** Les personnages seulement. Les objets et les tuiles suivront, dans ce même
> document et avec la même structure.

---

## En une page

**Un seul moteur a survécu au tri : Wan 2.2 image→vidéo A14B en Q4, deux experts, avec le
raccourci LightX2V en 4 étapes.** Tous les autres candidats ont été écartés après mesure — la
liste et les raisons sont plus bas, pour qu'on ne les reteste pas.

| Question | Réponse mesurée |
|---|---|
| Quel moteur pour animer un personnage ? | **Wan 2.2 I2V A14B Q4**, deux experts, LightX2V 4 étapes, guidage 1, euler / simple |
| Quelle taille ? | **512 × 512** — c'est la taille des mesures ci-dessous |
| Quelle durée ? | **49 images à 16 im/s, soit 3 secondes.** En dessous, le modèle rend une marche au lieu d'une course |
| Combien de temps ? | **96 à 257 s** par animation de 3 s, selon l'adaptateur |
| La VRAM tient-elle dans 8 Go ? | **Oui — 7,3 à 8,3 Go de pointe**, jamais de débordement |
| Le prompt négatif sert-il ? | **Non.** Le guidage est à 1 : il est **entièrement ignoré**. Tout doit passer par le positif |

---

## Le socle commun

Toutes les configurations retenues partagent exactement ceci :

```
Wan 2.2 I2V A14B, quantifié Q4, deux experts chargés l'un après l'autre (2 × 8,99 Go)
LoRA wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise  à 1
LoRA wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise   à 1
WanImageToVideo : 512 × 512
KSamplerAdvanced : 4 étapes, coupées 0→2 puis 2→4, guidage 1, euler, simple
```

Deux pièges de câblage, tous deux **silencieux** — ils ne lèvent aucune erreur :

1. **Le conditionnement de l'échantillonneur doit venir de `WanImageToVideo`**, pas des encodeurs
   de texte. C'est lui qui porte l'image de départ. Branché sur le texte, le modèle est aveugle à
   la référence et invente un personnage — sans rien signaler.
2. **Un LoRA entraîné sur Wan 2.1 ne se pose que sur l'expert « low noise ».**

---

## Personnages

### Ce qu'il faut lancer

| Action | Adaptateur | Images | Durée du rendu | VRAM | fidélité / mouvement / dérive |
|---|---|---|---|---|---|
| **course** | `wan_pixel_animation_birdman` à 0,9 | 49 | **96 s** | 7,3 Go | 2,5 / 12,1 / 24,0 |
| course | aucun | 49 | 183 s | 7,9 Go | 2,2 / 12,4 / 24,6 |
| course | `wan2.2_animate_adapter_model` à 1,0 | 49 | 225 s | 7,7 Go | 1,5 / 12,7 / 22,4 |
| course | `wan2.2_animate_adapter_model` à 0,6 | 49 | 234 s | 7,9 Go | 2,0 / 13,1 / 21,7 |
| **attaque** | `wan2.2_animate_adapter_model` à 1,0 | 49 | 202 s | 8,2 Go | 1,5 / 7,1 / 6,3 |
| attaque | `wan2.2_animate_adapter_model` à 0,6 | 49 | 257 s | 8,1 Go | 2,0 / 6,7 / 7,5 |
| marche | `wan2.2_animate_adapter_model` à 1,0 | 17 | 141 s | 7,8 Go | 1,8 / 8,2 / 14,5 |
| marche | `wan2.2_animate_adapter_model` à 0,8 | 33 | 153 s | 7,9 Go | 1,8 / 10,9 / 29,0 |
| marche | `wan2.2_animate_adapter_model` à 0,6 | 17 | 189 s | 8,2 Go | 2,5 / 9,2 / 12,0 |
| marche | `wan2.2_animate_adapter_model` à 0,8 | 17 | 256 s | 8,2 Go | 2,2 / 8,4 / 15,0 |
| marche | aucun | 17 | 284 s | 7,8 Go | 2,9 / 9,2 / 17,1 |

**Si un seul réglage doit être câblé par défaut : `birdman` à 0,9, 49 images.** C'est plus de deux
fois plus rapide que les autres 3 secondes, pour un mouvement équivalent (12,1 contre 12,7 et
13,1). Il perd un peu en fidélité (2,5 contre 1,5).

Ce que veulent dire les trois nombres — écart moyen par canal sur 0–255, donc **plus bas = plus
proche** : la **fidélité** compare la première image à la référence ; le **mouvement**, chaque
image à la précédente ; la **dérive**, la dernière image à la première. Le mouvement seul ne dit
rien : c'est le rapport mouvement / dérive qui distingue un personnage qui s'anime d'un
personnage qui s'éloigne.

⚠️ **Le seuil de dérive acceptable dépend de l'action, il ne peut pas être un réglage global.**
Une attaque revient à sa pose — dérive 6 à 8. Une course ne revient pas — dérive 21 à 25. Juger
les deux au même barème rejetterait toutes les courses.

### Les prompts exacts

**Course** — formulation trouvée sur Grok Imagine, qui marche telle quelle sur Wan :

```
Make this character run on the spot, to create an animated 2D video game asset.
```

**Attaque** — geste, direction et déroulement fixés :

```
The mushroom character briefly draws its staff back, thrusts the tip sharply toward screen
right, then returns to its starting pose and holds. One attack only, feet planted, slight torso
lean and subtle cape follow-through. Keep the original facing direction and the staff in the
same hand. Fixed camera and framing; entire character and staff visible throughout. Preserve the
original design, colors and crisp pixel-art edges. The white background remains unchanged.
```

### Comment écrire un prompt d'animation — et les deux façons de le rater

**Ne décrivez jamais la mécanique du corps.** C'est la découverte la plus coûteuse du banc :
demander un genou qui monte, une poussée de pied ou une phase de suspension fait **sauter** le
personnage au lieu de le faire courir. Ce modèle distillé n'a pas la finesse d'articuler un
membre à la fois ; il exécute l'idée globale « le corps se soulève ». Mesuré : les deux seuls
prompts de ce type sont les deux seuls à produire un décollage de 21 et 23 px, quand tous les
autres restent sous 3 px.

**En image→vidéo, l'image porte déjà l'apparence.** Redécrire le costume, les couleurs et le
style consomme du texte pour rien et dilue la consigne de mouvement. Le texte ne sert qu'au
**mouvement** et à la **caméra** — c'est aussi ce que recommande le guide Wan d'Alibaba.

Ce qui marche, dans l'ordre : **geste concret + direction explicite → déroulement → ce qui reste
fixe → caméra**.

| | À privilégier | À éviter |
|---|---|---|
| geste | `thrusts the staff`, `swings the sword` | `attacks`, `fights` |
| direction | `toward screen right`, `toward the camera` | `forward` seul, dont le repère est ambigu |
| déroulement | une préparation, une action, une fin | empiler course + saut + attaque dans un essai |
| ancrage | `feet planted`, en laissant le buste bouger | `completely motionless` alors qu'on demande une action |
| contraintes | l'état voulu : `fixed camera` | une liste d'interdits : `no pan, no zoom, no orbit…` |

**La durée compte autant que le texte.** 17 images à 16 im/s font 1 seconde : trop court pour
qu'un cycle s'installe, et le modèle rend une marche même quand on demande une course. C'est
passer à 49 images qui a débloqué la course, pas une énième reformulation.

**Le retour au repos n'est pas garanti.** `returns to the starting pose` exprime une intention.
Sur les attaques mesurées, les dernières images reviennent vers une garde, pas vers la pose
d'origine. Piste non encore essayée : conditionner l'image de début **et** de fin sur la même
référence, ce que ComfyUI documente pour Wan 2.2.

### Deux défauts connus, tous deux réparables en post

- **Le fond dérive vers un blanc crème** sur quelques images des séquences de 3 s. Le détourage
  du sprite le retire.
- **La dérive verticale** peut se corriger hors GPU, en réalignant chaque image sur la ligne des
  pieds de la première — ce qu'un pipeline de sprites fait de toute façon en assemblant une
  planche. Mesuré : l'envol passe de 25 px à 0 sans rien perdre de la cadence.

---

## Ce qui a été écarté, et pourquoi

**À ne pas retester sans raison nouvelle.** Tous mesurés sur le même sprite, en 512 × 512.

| Candidat | Mesure | Pourquoi il est écarté |
|---|---|---|
| **Wan 2.2 TI2V-5B** Q4_K_M | 17 img · 199 s · mouvement **0,4** | Ne bouge pratiquement pas. Un seul passage au lieu de deux experts, mais sans mouvement l'économie ne sert à rien |
| **LTX-Video 2B 0.9.8** distillé | 25 img · 111 s · mouvement 5,2 · dérive **29,6** | Le plus rapide du banc, et le moins fidèle dans la durée : le personnage part |
| LTX-Video avec guidage | 25 img · 52 s · mouvement **0,2** | Figé |
| **HunyuanVideo 1.5** 480p I2V | 17 img · 205 s · mouvement 6,5 | Correct mais dominé par Wan sur les trois mesures, pour un temps comparable |
| HunyuanVideo, variante distillée | 17 img · 157 s · mouvement 6,0 | Idem |
| **Wan Animate 2** (piloté par vidéo) | 21 img · 276 s | **Capacité perdue en silence.** Un poids Animate 2 est structurellement identique à un poids i2v : ComfyUI ne le reconnaît que par une entrée `config` dans les métadonnées, que la conversion GGUF supprime. Le modèle se charge en i2v ordinaire et **la branche de pose est ignorée** sans le dire. Les seuls poids officiels font 32,79 Go en bf16 — hors d'atteinte ici |
| **Wan 2.2 Animate v1** piloté par un mannequin | 17 img · 592 s · fidélité **21,5** | Redimensionne le personnage jusqu'à le sortir du cadre. Pire fidélité du banc, de loin — toutes les autres sont sous 4 |
| Wan Animate v1, mannequin recadré aux proportions du sprite | 17 img · 693 s · fidélité **37,9** · mouvement 0,7 | Le désaccord de cadrage a bien été corrigé — 72 % de la hauteur, pieds sur la même ligne — et **le résultat empire**. Le cadrage n'était donc pas la cause. Après trois tentatives, la voie pilotée est close sur cette machine |

---

## Comment refaire ou étendre ces mesures

Le banc vit dans `sc-clone` : `scripts/try-video.mjs` construit les graphes et les envoie à
ComfyUI, `scripts/page-journal.mjs` produit un journal HTML triable où chaque essai affiche
**le prompt exact relu dans le graphe envoyé**, donc impossible à désynchroniser du code.

Deux règles de méthode payées cher :

- **Une variation de prompt se teste sur UNE configuration, pas sur le lot.** Six configurations
  identiques n'apprennent rien de plus qu'une seule sur le texte, et multiplient la facture par
  six. Le lot complet ne sert qu'au classement final.
- **Une idée changée par essai, et un témoin.** Entre deux séries j'ai un jour changé six choses
  à la fois, puis lu un chiffre global : quand il a monté, il était impossible de savoir
  pourquoi. Le témoin — le prompt suspect avec une seule clause retirée — est ce qui a
  effectivement tranché.

---

## Objets et tuiles

À écrire. Même structure : ce qu'il faut lancer, les prompts exacts, ce qui a été écarté et
pourquoi.
