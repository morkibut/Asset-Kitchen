# AU4 — accès aux outils conservés et raccords réels

Relevé du 12 septembre 2026. Ce document inventorie les accès et les preuves ;
l’état du chantier reste dans [PLAN.md](PLAN.md). L’apparence fait foi dans
[DESIGN.md](DESIGN.md) et dans la maquette validée.

| Capacité et contrôles | Accès réel | Portée et conservation | Preuve / limite |
|---|---|---|---|
| Détourage : passes, bord, pipette, sélection, modèles, palette, tolérance, seuil alpha, durcissement, masquage | Retouche → sélecteur Détourer ; animation → même panneau | Image ; réglage touché sur frame, sélection ou bande | Pipette et tracé raccordés sur le fichier source de la frame. Test de visée à coordonnées d’origine malgré une réduction de moitié à l’écran. Le seuil alpha n’a pas de curseur propre : c’est un défaut du produit (128), expliqué dans l’aide de la table (`interface/src/aide.ts`, `detourage.seuil_alpha`) plutôt qu’un réglage qu’on déplace — comme dans l’ancien accès |
| Recadrage : marge, rectangle manuel, remise à zéro | Retouche → Recadrer ; animation → même panneau | Recette non destructive ; cadre commun de l’animation conservé | Rectangle traçable dans une vue source zoomable, distincte de la case finale ; retour à l’animation après le geste |
| Pixelisation : taille, occupation, méthode, décalage | Retouche / animation → Pixéliser | Frame, sélection, bande selon le sélecteur de portée | Ancrage de bande dans « Animation · boucle, repère et fenêtre commune » |
| Couleurs : palette, nombre, remplacements, tramage ; nettoyage : taches, bord ; contours ; retournement | Sélecteur de table fixe | Même chaîne CPU et mêmes recettes ; aucune copie du moteur dans l’UI | Retournement maintenant accessible aussi dans l’atelier d’animation |
| Main : transparence, pinceau, gomme, diamètre, couleur, calques, ordre, visibilité, nom, suppression, dernier passage | Retouche → La main ; animation → La main | Une seule frame. Nouvelle Main finale après placement ; ancienne Main de recette inchangée | `AtelierUnifieRetouche.test.tsx` : trait pendant lecture, frame visible, coordonnées, voisins inchangés, défaire/refaire, sauvegarde puis réouverture. `test_au4_main.py` : pixels, compatibilité, cache reconstruit |
| Zoom, déplacement de la vue, empreinte du pinceau | Image : barre + molette existantes ; frame : facteur, ajuster, Ctrl + molette, Espace + glisser / bouton central | Vue seulement ; aucun changement de recette | Ajustement mesuré dans l’espace réellement disponible. Empreinte carrée mise à l’échelle. Validation 1280×800 / 1600×1000 confiée à la QA globale |
| Recettes nommées, appliquer, copier/coller, sauvegarder une recette | Image : menu Recettes ; bande : recettes enregistrées | Un réglage voyage, les traits de Main ne voyagent pas | Corrigé : une recette nommée sur toute la bande conserve aussi les Main individuelles historiques |
| Défaire, refaire, annuler, enregistrer | En-tête fixe de l’animation ; Ctrl Z, Ctrl Maj Z / Ctrl Y, Ctrl S | 80 états de session ; montage, recettes, Main, cadence et sens. Annuler revient au dernier enregistrement | Test UI de fermeture/réouverture. Brouillon non enregistré conservé séparément sur cet ordinateur, repris ou abandonné explicitement ; aucun enregistrement ni appel IA lors de la reprise |
| Sélection : simple, Ctrl, Maj, toutes, une seule | Timeline basse de l’animation | Une coordonnée de pinceau ne s’applique jamais en lot | Portée explicite Frame / Sélection / Animation entière ; différences de recettes restent indiquées |
| Réordre, duplication, retrait, insertion depuis chutier, vider le chutier, chercher dans le clip | Timeline et Chutier dépliable | Occurrences entières, recette et Main comprises. Copie : nouvel UUID | Identifiant conservé au déplacement ; boutons de déplacement existants maintenus |
| Poussée X/Y, remettre droit, changer de source, pelure d’oignon | Panneau droit → Position, source et pelure d’oignon | Frame choisie. Remplacer sa source remet recette et Main finale à zéro | Explication existante de la perte des réglages ; geste fait pendant lecture couvert par tests A7 |
| Cadence, boucle / aller-retour, ancrage, fenêtre commune, remesure | Lecteur + Animation dépliable | Bande entière ; remesure bloquée tant que des changements attendent | Durée calculée sur la cadence courante, sans relire l’ancienne durée enregistrée |
| Vidéo originale, aperçus synchronisés, pellicule, loupe, prélèvement, propositions de rythme, étendue, plusieurs bandes | Montage vidéo | Le clip payé reste la source ; aucune génération | 22 tests legacy de montage passent. Les deux aperçus continuent de suivre le même métronome |
| Réordre des frames retenues du montage | Vignettes de sortie : glisser-déposer ; Alt + flèches | Chaque occurrence reste distincte, même avec deux numéros de source identiques | Nouveau test UI souris + clavier et test de correspondance des prises |
| Nom et classement séparés | Montage → nom libre + Personnage / Mouvement / Direction | Destination validée dans le même jeu. Le clip, ses prises et ses retouches ne changent pas | 6 tests API : création, changement de sujet, réouverture, refus intacts et brouillon sans sujet. AU15 réévalue les calques liés à l’ancienne destination |
| Découpe : détection, grille, rectangles, noms, créer plusieurs images, reprendre la source | Retouche → Découpe · plusieurs images ; ancien accès dans Toutes les tables ; toile existante | Image originale conservée ; sorties vers bibliothèque / toile selon origine | Prélèvement CPU de la case courante, placement et Main compris ; original intact, filiation bande/occurrence/clip. Découpe zoomable puis retour aux changements non enregistrés |
| Extraction : choisir deux sources, calage automatique, déplacement direct, échelle, opacité, masque, sorties | Retouche → Extraire un élément ; ancien Superposer conservé | Une image d’entrée, une image de sortie neuve : aucune frame d’une bande n’est jamais réécrite par la fabrique elle-même, la portée ne peut donc pas s’étendre au-delà de l’asset ouvert | Bibliothèque générale : recherche, collection, favoris et pagination. Déplacement direct, rectangle, pinceau garder/retirer avec empreinte ; travail/calque/résultat zoomables. À l’ouverture, `EcranSuperposition` relit la pose via `api.ouvrirSuperposition` (`Superposition.tsx`) ; `tests/test_au4_surfaces.py::test_rouvrir_extraction_retrouve_sources_et_masque_exact` fabrique une extraction avec calage, échelle, rectangle et main non par défaut, la referme puis la rouvre par le service (`atelier.superposition.ouvrir`) et vérifie que la pose relue est identique et que l’aperçu rejoué produit le même calque, sans appel fournisseur supplémentaire |

Les fabriques sont séparées des traitements dans le nouvel accès principal.
Les essais de navigation vérifient aussi le retour de retouche vers la galerie
filtrée, la vignette choisie et le défilement du sujet. Les brouillons du montage
conservent son nom, sa cadence et l’ordre des occurrences ; ceux de la fabrication
vidéo conservent le prompt, les références, le modèle et les paramètres avant
relecture. Un profil vidéo retiré reste nommé avec la raison de son indisponibilité.
L’extraction retrouve aussi ses deux sources, son calage et son masque ; la découpe
retrouve les rectangles corrigés sans les remplacer par une nouvelle détection.
« Toutes les tables et leur état » conserve les anciens chemins pendant la
vérification de chaque atelier spécialisé. Aucune capacité ancienne n’a été
retirée pour masquer un raccord restant.

## Relecture croisée du 12 septembre 2026

Une passe précédente avait écrit ce relevé sans le confronter au code ; cette
passe-ci croise chaque ligne avec trois sources — le tableau des douze
capacités de `PLAN-atelier-unifie.md` § « Comment fermer une tranche »,
cette page, et l’écran réel — puis rouvre chaque preuve citée pour vérifier
qu’elle porte bien l’assertion annoncée.

Contrôles faits, avec leur porte dans le code : le pinceau de la main
(`ReglagesDeLaMain`, `Retouche.tsx`), le chutier avec son retrait un par un
(`viderDuChutier`, `auChutier`, `AtelierDeBande.tsx`), le classement d’une
bande séparé de son nom (`/api/strips/{id}/case`, `atelier/services/montage.py`),
le découpage d’une frame retouchée (`preleverFrameDeBande`,
`atelier/services/montage.py::prelevement_de_frame`), le réordre des frames
retenues au clavier et à la souris (`EcranMontage`, `Montage.tsx`), et les
huit tables de retouche — détourage, recadrage, pixélisation, couleurs,
nettoyage, contour, retournement, main — qui ont chacune leur fonction
`ReglagesDe…` dans `Retouche.tsx`. Une seule imprécision trouvée, corrigée
ci-dessus : le seuil alpha du détourage n’a pas de curseur propre, c’est un
défaut du produit documenté dans l’aide, pas un réglage déplacé.

Preuves rejouées pour cette passe : `npx vitest run
src/composants/AtelierUnifieRetouche.test.tsx src/composants/Retouche.test.tsx`
(105 essais, tous verts), `.venv/Scripts/python.exe -m pytest
tests/test_au4_surfaces.py -q` (2 essais, tous verts) et `npx tsc --noEmit`
(aucune erreur). L’essai `test_rouvrir_extraction_retrouve_sources_et_masque_exact`
pose une extraction avec un calage, une échelle, un rectangle et un trait de
main non par défaut, la referme, la rouvre par le service et vérifie que la
pose relue et l’aperçu rejoué sont identiques à l’originale, sans appel
fournisseur de plus.
