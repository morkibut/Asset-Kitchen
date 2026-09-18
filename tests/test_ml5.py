# -*- coding: utf-8 -*-
"""ML5, seconde passe : ce que l'atelier jetable a montré au navigateur sur
*Préparer une fabrication* et *Relire avant l'envoi*, corrigé côté serveur.

Quatre choses, toutes mesurées sans ComfyUI (le double de `test_ml2.py`) :

1. le catalogue dit, par modèle local, s'il lit le négatif et sous quel moteur
   le ranger — et ne dit ni l'un ni l'autre pour un modèle distant, dont le
   JSON ne doit pas changer de forme ;
2. `temps_attendu` rend un temps pour un style local — la médiane mesurée sur
   cette machine s'il y en a une, sinon la vitesse du style — et `None` pour
   tout modèle qui n'est pas local (règle 8ter) ;
3. `envoi()` porte ce même temps sous `local["temps"]` ;
4. `cout_attendu`, qui ne voit jamais un appel local (`cout_usd` y vaut
   toujours zéro), reste `None` pour lui — c'est `temps_attendu` qui répond à
   sa place, pas un `couts_mesures` qu'on aurait réparé pour l'occasion.
"""
from atelier.domaine.generation import Emplacement, Generation, Statut
from atelier.services import Atelier
from tests.test_a9 import AnimateurDouble
from tests.test_au7_au8 import raccorder
from tests.test_ml2 import ComfyStylesDouble
from tests.test_ml4 import STYLES


async def _atelier(tmp_path, double):
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, ComfyStylesDouble())
    await atelier.ouvrir()
    return atelier


async def test_le_catalogue_dit_le_moteur_et_si_le_negatif_est_lu(tmp_path, double):
    atelier = await _atelier(tmp_path, double)
    try:
        klein_distille = (await atelier.styles_locaux.installer("flux2-pixel"))["modele"]  # négatif non relié
        klein_base = (await atelier.styles_locaux.installer("klein-pxart4"))["modele"]  # négatif relié
        await atelier.catalogue.rafraichir()

        distille = atelier.catalogue.modele(klein_distille)
        base = atelier.catalogue.modele(klein_base)
        assert distille.famille == "klein" and base.famille == "klein"
        assert distille.negatif_lu is False
        assert base.negatif_lu is True

        # Le JSON d'un modèle distant ne gagne ni clé : la forme d'avant ML5
        # doit rester exactement la même pour lui.
        distant = next(m for m in atelier.catalogue.etat.modeles if not m.locale)
        from atelier.api.routes import _modele_en_json
        from atelier.domaine.demande import Demande as DemandeVide
        fiche = _modele_en_json(distant, DemandeVide(prompt="un coffre"), None)
        assert "negatif_lu" not in fiche
        assert "famille" not in fiche
        assert "temps" not in fiche
    finally:
        await atelier.file_locale.fermer()


async def test_temps_attendu_rend_la_vitesse_du_style_puis_la_mesure_de_la_machine(tmp_path, double):
    atelier = await _atelier(tmp_path, double)
    try:
        zimage = (await atelier.styles_locaux.installer("zimage-pixel"))["modele"]
        await atelier.catalogue.rafraichir()

        # Un modèle distant n'a pas de temps : il a un prix, et c'est
        # `cout_attendu` qui le dit.
        distant = next(m.identifiant for m in atelier.catalogue.etat.modeles if not m.locale)
        assert atelier.generations.temps_attendu(distant) is None

        # Fraîchement installé, jamais lancé : la vitesse du style, pas un
        # chiffre inventé.
        temps = atelier.generations.temps_attendu(zimage)
        assert temps == {"secondes": None, "mesures": 0, "vitesse": "environ 30 secondes par image"}
        # Et `cout_attendu`, qui ne voit que des sous, ne sait toujours rien
        # de lui — un appel local ne facture jamais rien.
        assert atelier.generations.cout_attendu(zimage) is None

        # Une génération réussie plus tard, mesurée sur cette machine : le
        # temps devient un chiffre, et `cout_attendu` reste `None` — c'est
        # précisément le défaut que cette passe ferme (un appel local vaut
        # toujours `cout_usd = 0`, que `couts_mesures` écarte).
        atelier.generations._base.enregistrer(Generation(
            identifiant="g1", modele=zimage, demande={}, parametres_resolus={},
            emplacements=[Emplacement(rang=0, statut=Statut.REUSSIE, duree_s=24.0, consomme=0.0)],
        ))
        atelier.generations._base.enregistrer(Generation(
            identifiant="g2", modele=zimage, demande={}, parametres_resolus={},
            emplacements=[Emplacement(rang=0, statut=Statut.REUSSIE, duree_s=26.0, consomme=0.0)],
        ))
        mesure = atelier.generations.temps_attendu(zimage)
        assert mesure["secondes"] == 25.0
        assert mesure["mesures"] == 2
        assert atelier.generations.cout_attendu(zimage) is None
    finally:
        await atelier.file_locale.fermer()


async def test_lenvoi_porte_le_temps_sous_local_temps(tmp_path, double):
    atelier = await _atelier(tmp_path, double)
    try:
        sdxl = (await atelier.styles_locaux.installer("sdxl-pixelart"))["modele"]
        await atelier.catalogue.rafraichir()
        projet = atelier.bibliotheque.courant

        rendu = atelier.envoi.envoi(projet=projet, sujet="a chest", modele=sdxl)
        assert rendu["local"] is not None
        assert rendu["local"]["temps"] == {"secondes": None, "mesures": 0, "vitesse": "environ 40 secondes par image"}

        # Un modèle distant n'a pas de bloc `local` du tout — ML4 ne le
        # touche pas, et cette passe ne l'ajoute pas non plus.
        distant = next(m.identifiant for m in atelier.catalogue.etat.modeles if not m.locale)
        rendu_distant = atelier.envoi.envoi(projet=projet, sujet="a chest", modele=distant)
        assert rendu_distant["local"] is None
    finally:
        await atelier.file_locale.fermer()


async def test_l_agent_installe_les_styles_et_lit_ce_qu_ils_font_d_une_image(tmp_path, double):
    """ML7 : par MCP, l'agent installe les styles prêts et lit dans `list_models`
    ce que l'écran montre — garder le sujet ou repeindre, et le négatif lu."""
    from atelier.mcp.serveur import creer_serveur
    from tests.test_t7 import appeler
    atelier = await _atelier(tmp_path, double)
    try:
        mcp = creer_serveur(atelier)
        installes = await appeler(mcp, "install_local_styles")
        assert len(installes["installes"]) >= 5
        modeles = {m["id"].split("@")[0]: m for m in (await appeler(mcp, "list_models"))["models"]}
        assert modeles["ComfyUI:flux2-pixel"]["reference_use"] == "keeps the subject"
        assert modeles["ComfyUI:flux2-pixel"]["negative_read"] is False
        assert modeles["ComfyUI:sdxl-pixelart"]["reference_use"] == "repaints the start image"
        assert modeles["ComfyUI:sdxl-pixelart"]["negative_read"] is True
        assert "local" not in modeles["essai:rend-du-png"]
    finally:
        await atelier.file_locale.fermer()
