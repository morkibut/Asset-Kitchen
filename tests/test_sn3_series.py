"""SN3 : une série de tirages, et les jeux de variantes.

ComfyUI est doublé (le double de SN1 : les profils livrés, graine reliée) ;
la file locale, les travaux, la reprise et la bibliothèque des sons sont réels.
Rien n'est payé."""
import asyncio
import shutil

import httpx
import pytest

from atelier.domaine.travail import TravailRefuse
from atelier.domaine.variantes_son import VariantesRefusees
from atelier.services import Atelier
from atelier.services.travaux import _hash, _json
from tests.test_au7_au8 import raccorder
from tests.test_au14_generation import fermer, sonore  # noqa: F401 — la fixture
from tests.test_sn1_installation import ComfySortieChoisie, son  # noqa: F401 — la fixture

PAS = {"famille": "bruitage", "prompt": "Single footstep of a leather boot on dry grass"}


def graines_envoyees(comfy):
    """La graine partie dans chaque envoi (le KSampler du profil livré)."""
    return [next(n["inputs"]["seed"] for n in e["prompt"].values() if n["class_type"] == "KSampler") for e in comfy.envois]


async def rouvrir(atelier, comfy, double):
    """Le même atelier, rouvert sur le même dossier et le même ComfyUI doublé.
    Construit avant d'être raccordé au double, l'atelier inscrit aussi le
    moteur par défaut (127.0.0.1), qui n'existe pas ici et dont l'occupation
    « inconnue » bloquerait la file : un artefact du double, retiré. Sur la
    machine, l'atelier rouvert retrouve la même adresse."""
    autre = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double)
    raccorder(autre, comfy)
    for identifiant in [i for i in autre.file_locale._moteurs if "comfy.test" not in i]:
        autre.file_locale.retirer_moteur_inutilise(identifiant)
    await autre.ouvrir()
    autre.travaux_audio.intervalle = .01
    return autre


async def serie_rendue(atelier, cle="pas", **autres):
    await atelier.installation_son.installer()
    projet = atelier.bibliotheque.courant
    s = await atelier.series_son.preparer(projet, {"cle": cle, **PAS, **autres})
    await atelier.series_son.demarrer(projet, s["identifiant"])
    await atelier.travaux.attendre_tout()
    return projet, atelier.series_son.lire(projet, s["identifiant"])


# ── Une série ───────────────────────────────────────────────────────────


async def test_huit_tirages_d_un_pas_reviennent_dans_une_serie_avec_huit_graines(son):  # noqa: F811
    atelier, comfy = son
    await atelier.installation_son.installer()
    projet = atelier.bibliotheque.courant
    avant = atelier.series_son.annoncer(projet, PAS)
    assert avant["nombre"] == 8 and avant["graine_par_tirage"]
    # Pas encore de mesure sur cette machine : le temps est inconnu, et dit.
    assert avant["annonce"]["temps_s"] is None and avant["annonce"]["cout_usd"] == 0
    s = await atelier.series_son.preparer(projet, {"cle": "pas", **PAS})
    assert s["etat"] == "preparee" and len(s["tirages"]) == 8 and not comfy.envois
    graines = [t["graine"] for t in s["tirages"]]
    assert len(set(graines)) == 8 and all(isinstance(g, int) for g in graines)
    # Préparer deux fois la même série ne crée rien de plus.
    encore = await atelier.series_son.preparer(projet, {"cle": "pas", **PAS})
    assert encore["identifiant"] == s["identifiant"] and [t["travail"] for t in encore["tirages"]] == [t["travail"] for t in s["tirages"]]
    assert len(atelier.travaux.lister(projet)) == 8
    with pytest.raises(TravailRefuse, match="autre série"):
        await atelier.series_son.preparer(projet, {"cle": "pas", **PAS, "nombre": 3})
    await atelier.series_son.demarrer(projet, s["identifiant"])
    await atelier.travaux.attendre_tout()
    fini = atelier.series_son.lire(projet, s["identifiant"])
    assert fini["etat"] == "terminee" and fini["compte"] == {"rendu": 8}, fini["compte"]
    assert len(comfy.envois) == 8 and sorted(graines_envoyees(comfy)) == sorted(graines)
    sons = [t["son"] for t in fini["tirages"]]
    assert len({x["identifiant"] for x in sons}) == 8 and all(x["existe"] and x["mesures"] for x in sons)
    # Le nom par défaut ne répète ni l'étiquette de la famille (déjà le
    # préfixe de `nom_stable`), ni un rang de tirage (déjà le numéro que la
    # livraison d'un jeu de variantes pose) : juste la description.
    assert [x["nom"] for x in sons][:2] == ["Single footstep of a leather boot on dry grass",
                                            "Single footstep of a leather boot on dry grass"]
    provenance = atelier.sons.lire(projet, sons[2]["identifiant"])["provenance"]
    assert provenance["serie"] == {"identifiant": s["identifiant"], "rang": 3} and provenance["famille"] == "bruitage"
    # Le temps de la série suivante vient des mesures de la file locale.
    apres = atelier.series_son.annoncer(projet, {**PAS, "nombre": 4})
    assert apres["annonce"]["temps_s"] is not None and apres["annonce"]["mesures"] == 8
    # Démarrer une série terminée ne relance rien.
    await atelier.series_son.demarrer(projet, s["identifiant"])
    await atelier.travaux.attendre_tout()
    assert len(comfy.envois) == 8


async def test_nombre_par_famille_et_bornes(son):  # noqa: F811
    atelier, comfy = son
    await atelier.installation_son.installer()
    projet = atelier.bibliotheque.courant
    assert atelier.series_son.annoncer(projet, {"famille": "musique", "prompt": "exploration"})["nombre"] == 4
    assert atelier.series_son.annoncer(projet, {**PAS, "nombre": 16})["nombre"] == 16
    for mauvais in (0, 17, True, "8"):
        with pytest.raises(VariantesRefusees):
            atelier.series_son.annoncer(projet, {**PAS, "nombre": mauvais})
    with pytest.raises(TravailRefuse, match="inconnu"):
        await atelier.series_son.preparer(projet, {"cle": "x", **PAS, "graine": 3})


async def test_un_workflow_sans_graine_ne_tire_pas_huit_fois_le_meme_son(sonore):  # noqa: F811
    atelier, comfy, p = sonore
    projet = atelier.bibliotheque.courant
    demande = {"modele": p["modele"], "prompt": "Une lame quitte le cuir.", "secondes": 2.5}
    with pytest.raises(TravailRefuse, match="graine"):
        await atelier.series_son.preparer(projet, {"cle": "lame", **demande})
    assert not atelier.travaux.lister(projet)
    seul = await atelier.series_son.preparer(projet, {"cle": "lame", "nombre": 1, **demande})
    assert len(seul["tirages"]) == 1


async def test_une_serie_coupee_apres_trois_tirages_reprend_sans_relancer_les_trois(son, double):  # noqa: F811
    atelier, comfy = son

    class ComfyQuiCoupe(ComfySortieChoisie):
        rendus_max = 3

        def repondre(self, requete):
            if requete.url.path.startswith("/history/"):
                numero = requete.url.path.split("/")[-1]
                if numero in self.jobs and int(numero.split("-")[1]) > self.rendus_max:
                    return httpx.Response(200, json={})  # encore en calcul
            return ComfySortieChoisie.repondre(self, requete)

    comfy.__class__ = ComfyQuiCoupe
    raccorder(atelier, comfy)  # le transport lie la méthode : la relier à nouveau
    await atelier.installation_son.installer()
    projet = atelier.bibliotheque.courant
    s = await atelier.series_son.preparer(projet, {"cle": "pas", **PAS})
    await atelier.series_son.demarrer(projet, s["identifiant"])
    limite = asyncio.get_running_loop().time() + 30
    while True:
        lu = atelier.series_son.lire(projet, s["identifiant"])
        if lu["compte"].get("rendu") == 3 and len(comfy.envois) == 4:
            break
        assert asyncio.get_running_loop().time() < limite, lu["compte"]
        await asyncio.sleep(.05)
    rendus = {t["rang"]: (t["travail"], t["son"]["identifiant"]) for t in lu["tirages"] if t["son"]}
    assert set(rendus) == {1, 2, 3}
    await fermer(atelier)  # l'atelier se ferme en plein calcul du quatrième

    autre = await rouvrir(atelier, comfy, double)
    coupe = autre.series_son.lire(projet, s["identifiant"])
    assert coupe["etat"] == "a_reprendre" and coupe["compte"]["rendu"] == 3
    await asyncio.sleep(.3)
    assert len(comfy.envois) == 4  # rien ne repart tout seul
    comfy.rendus_max = 99
    demarres = []
    demarrer = autre.travaux.demarrer

    async def espion(projet_, identifiant, *args, **kw):
        demarres.append(identifiant)
        return await demarrer(projet_, identifiant, *args, **kw)
    autre.travaux.demarrer = espion
    repris = await autre.series_son.reprendre(projet, s["identifiant"])
    assert repris["relances"] == [4, 5, 6, 7, 8]
    await autre.travaux.attendre_tout()
    fini = autre.series_son.lire(projet, s["identifiant"])
    assert fini["etat"] == "terminee" and fini["compte"] == {"rendu": 8}, fini["compte"]
    assert not {travail for travail, _ in rendus.values()} & set(demarres)
    # Le quatrième a été suivi par son numéro, pas renvoyé : huit envois en tout.
    assert len(comfy.envois) == 8
    assert {t["rang"]: t["son"]["identifiant"] for t in fini["tirages"] if t["rang"] <= 3} == \
        {r: son_ for r, (_, son_) in rendus.items()}
    assert len(autre.sons.lister(projet)) == 8
    await fermer(autre)


# ── Le jeu de variantes ─────────────────────────────────────────────────


async def test_garder_quatre_tirages_forme_un_jeu_qui_se_rouvre_dans_l_ordre(son, double):  # noqa: F811
    atelier, comfy = son
    projet, serie = await serie_rendue(atelier)
    par_rang = {t["rang"]: t["son"]["identifiant"] for t in serie["tirages"]}
    jeu = atelier.series_son.garder(projet, serie["identifiant"], {"rangs": [2, 5, 1, 7], "nom": "Pas sur l'herbe"})
    attendu = [par_rang[r] for r in (2, 5, 1, 7)]
    assert jeu["sons"] == attendu and jeu["a_livrer"] == attendu
    assert jeu["famille"] == "bruitage" and jeu["serie"] == serie["identifiant"]
    assert [m["rang"] for m in jeu["membres"]] == [2, 5, 1, 7]
    assert atelier.series_son.lire(projet, serie["identifiant"])["jeux"] == [jeu["identifiant"]]
    with pytest.raises(TravailRefuse):
        atelier.series_son.garder(projet, serie["identifiant"], {"rangs": [9]})
    await fermer(atelier)
    autre = await rouvrir(atelier, comfy, double)
    rouvert = autre.variantes_son.lire(projet, jeu["identifiant"])
    assert rouvert["sons"] == attendu and rouvert["nom"] == "Pas sur l'herbe"
    assert autre.variantes_son.sons_a_livrer(projet, jeu["identifiant"]) == attendu
    # Un son dans deux jeux ; supprimer un jeu garde tous ses sons.
    second = autre.variantes_son.creer(projet, {"nom": "Pas mêlés", "sons": [par_rang[2], par_rang[3]]})
    assert {j["identifiant"] for j in autre.variantes_son.lister(projet, par_rang[2])} == {jeu["identifiant"], second["identifiant"]}
    renomme = autre.variantes_son.renommer(projet, jeu["identifiant"], "Pas sur l'herbe sèche")
    assert renomme["nom"] == "Pas sur l'herbe sèche" and renomme["revision"] == 2
    autre.variantes_son.retirer(projet, jeu["identifiant"], par_rang[5])
    assert autre.variantes_son.ajouter(projet, jeu["identifiant"], par_rang[8], 0)["sons"] == \
        [par_rang[8], par_rang[2], par_rang[1], par_rang[7]]
    supprime = autre.variantes_son.supprimer(projet, jeu["identifiant"])
    assert supprime["sons_gardes"] == [par_rang[8], par_rang[2], par_rang[1], par_rang[7]]
    assert len(autre.sons.lister(projet)) == 8
    with pytest.raises(VariantesRefusees):
        autre.variantes_son.lire(projet, jeu["identifiant"])
    await fermer(autre)


async def test_garder_applique_les_reglages_de_la_famille_a_chaque_son_garde(son):  # noqa: F811
    """Correction du 18 septembre 2026 : garder crée pour chaque son gardé une
    nouvelle version avec la recette proposée de sa famille (mono pour un
    bruitage), visible dans ses versions. `appliquer_reglages=False` s'en passe."""
    atelier, comfy = son
    projet, serie = await serie_rendue(atelier)
    par_rang = {t["rang"]: t["son"]["identifiant"] for t in serie["tirages"]}
    avant = atelier.sons.lire(projet, par_rang[1])
    assert avant["revision"] == 1 and avant["mesures"]["canaux"] == 2
    atelier.series_son.garder(projet, serie["identifiant"], {"rangs": [1], "nom": "Avec réglages"})
    apres = atelier.sons.lire(projet, par_rang[1])
    assert apres["revision"] == 2 and apres["recette"]["mono"] is True and apres["mesures"]["canaux"] == 1
    assert len(apres["versions"]) == 2

    autre = atelier.series_son.garder(projet, serie["identifiant"], {"rangs": [2], "nom": "Sans réglages",
        "appliquer_reglages": False})
    son2 = atelier.sons.lire(projet, par_rang[2])
    assert son2["revision"] == 1 and son2["mesures"]["canaux"] == 2
    assert autre["identifiant"]


async def test_serie_fige_le_modele_et_le_texte_a_la_preparation(son):  # noqa: F811
    """Le modèle et le texte composé sont figés à la préparation de la série
    et passés tels quels à chaque tirage. `_completer` prépare d'ordinaire
    tous les tirages dans la foulée ; on simule ici une préparation coupée en
    route (un tirage sans travail encore) pour éprouver la reprise après un
    changement de l'univers : elle ne doit pas mélanger deux textes."""
    import json as _json_mod
    atelier, comfy = son
    await atelier.installation_son.installer(identifiants=["sa3-small-sfx"])
    projet = atelier.bibliotheque.courant
    s = await atelier.series_son.preparer(projet, {"cle": "pas", "nombre": 2, **PAS})
    premier = atelier.travaux.lire(projet, s["tirages"][0]["travail"])
    texte_fige = premier["composition"]["texte"]
    modele_fige = premier["demande"]["modele"]

    # On efface le travail du second tirage : comme une préparation coupée
    # avant que `_completer` ne l'atteigne.
    chemin = atelier.series_son._chemin(projet, s["identifiant"])
    brut = _json_mod.loads(chemin.read_text(encoding="utf-8"))
    assert brut.get("texte_fige") == texte_fige and brut["modele"] == modele_fige
    brut["tirages"][1]["travail"] = None
    chemin.write_text(_json_mod.dumps(brut), encoding="utf-8")

    # Un second moteur, préféré par l'univers pour le bruitage à partir de
    # maintenant : une reprise ne doit pas s'y mettre pour le tirage manquant.
    installes = await atelier.installation_son.installer(identifiants=["sa-open-1"])
    atelier.univers.regler_univers(projet, son={"moteurs": {"bruitage": installes["sa-open-1"]["profil"]["modele"]}})
    reprise = await atelier.series_son.reprendre(projet, s["identifiant"])
    second = atelier.travaux.lire(projet, reprise["tirages"][1]["travail"])
    assert second["demande"]["modele"] == modele_fige
    assert second["snapshot_audio"]["prompt"] == texte_fige


async def test_un_son_sature_entre_dans_un_jeu_un_son_disparu_y_reste_signale(son):  # noqa: F811
    atelier, comfy = son
    projet, serie = await serie_rendue(atelier, nombre=3)
    a, b, c = (t["son"]["identifiant"] for t in serie["tirages"])
    sature = atelier.sons.regler(projet, a, 1, {"gain_db": 24})
    assert sature["mesures"]["ecretes"] > 0
    # Il est signalé dans la série, jamais écarté par elle.
    tirage = atelier.series_son.lire(projet, serie["identifiant"])["tirages"][0]
    assert tirage["etat"] == "rendu" and tirage["son"]["sature"]
    jeu = atelier.variantes_son.creer(projet, {"nom": "Trois pas", "sons": [b]})
    jeu = atelier.variantes_son.ajouter(projet, jeu["identifiant"], a)
    membre = jeu["membres"][1]
    assert membre["son"] == a and membre["statut"] == "present" and membre["sature"] and membre["signal"]
    assert jeu["a_livrer"] == [b, a]
    # Écarté : il reste listé, signalé, et ne part pas.
    atelier.sons.juger(projet, c, 1, "ecartee")
    jeu = atelier.variantes_son.ajouter(projet, jeu["identifiant"], c)
    assert jeu["membres"][2]["statut"] == "ecarte" and jeu["a_livrer"] == [b, a]
    # Supprimé de la galerie : il reste listé, signalé, jamais retiré en silence.
    shutil.rmtree(atelier.sons._dossier(projet, b))
    jeu = atelier.variantes_son.lire(projet, jeu["identifiant"])
    assert jeu["sons"] == [b, a, c] and jeu["membres"][0]["statut"] == "supprime"
    assert {s["son"] for s in jeu["signalements"]} == {a, b, c} and jeu["a_livrer"] == [a]
    assert atelier.variantes_son.retirer(projet, jeu["identifiant"], b)["sons"] == [a, c]


# ── Les demandes d'avant ────────────────────────────────────────────────


async def test_les_empreintes_des_demandes_d_avant_ne_changent_pas(son):  # noqa: F811
    atelier, comfy = son
    installes = await atelier.installation_son.installer()
    modele = installes["sa3-small-sfx"]["profil"]["modele"]
    projet = atelier.bibliotheque.courant
    # AU14 : une demande sans famille, préparée seule.
    brut = {"cle": "porte", "modele": modele, "prompt": "Wooden door creaks open", "secondes": 3}
    t = await atelier.travaux_audio.preparer(projet, brut)
    avant = {"cle": "porte", "modele": modele, "prompt": "Wooden door creaks open", "prompt_negatif": "",
             "secondes": 3, "options": {}, "nom": "", "livrer_provisoire": False}
    assert t["empreinte"] == _hash(_json({"demande": avant, "acteur": "auteur"})) and "serie" not in t
    # SN2 : une demande avec famille, préparée seule.
    t = await atelier.travaux_audio.preparer(projet, {"cle": "sn2", **PAS})
    sn2 = {"cle": "sn2", "modele": modele, "prompt": PAS["prompt"], "prompt_negatif": "", "secondes": None,
           "options": {}, "nom": "", "livrer_provisoire": False, "famille": "bruitage"}
    assert t["empreinte"] == _hash(_json({"demande": sn2, "acteur": "auteur"}))
    # Un tirage de série : la même forme de demande, la série reste à côté.
    s = await atelier.series_son.preparer(projet, {"cle": "pas", "nombre": 2, **PAS})
    tirage = atelier.travaux.lire(projet, s["tirages"][1]["travail"])
    # Correction du 18 septembre 2026 : le nom par défaut d'un tirage ne
    # répète plus l'étiquette de la famille ni son rang (voir la nomination
    # de `nom_stable`) — juste la description.
    attendu = {**sn2, "cle": "serie:pas:02", "nom": PAS["prompt"]}
    assert tirage["empreinte"] == _hash(_json({"demande": attendu, "acteur": "auteur"}))
    assert tirage["serie"] == {"identifiant": s["identifiant"], "rang": 2}


# ── Les routes et les outils ────────────────────────────────────────────


async def test_routes_et_outils(son):  # noqa: F811
    atelier, comfy = son
    await atelier.installation_son.installer()
    projet = atelier.bibliotheque.courant
    from atelier.api.app import creer_application
    application = creer_application(atelier)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=application), base_url="http://atelier") as client:
        base = f"/api/projects/{projet}"
        vu = (await client.post(base + "/audio-series/estimate", json={**PAS, "nombre": 2})).json()
        assert vu["nombre"] == 2 and vu["annonce"]["cout_usd"] == 0
        s = await client.post(base + "/audio-series/prepare", json={"cle": "route", "nombre": 2, **PAS})
        assert s.status_code == 200, s.text
        s = s.json()
        assert (await client.post(base + f"/audio-series/{s['identifiant']}/start")).status_code == 200
        await atelier.travaux.attendre_tout()
        assert (await client.get(base + "/audio-series")).json()[0]["etat"] == "terminee"
        garde = await client.post(base + f"/audio-series/{s['identifiant']}/keep", json={"rangs": [2, 1], "nom": "Deux"})
        assert garde.status_code == 201, garde.text
        jeu = garde.json()["identifiant"]
        refus = await client.post(base + "/sound-variants", json={"nom": "", "sons": []})
        assert refus.status_code == 409 and refus.json()["code"] == "variantes_refusees"
        assert (await client.patch(base + f"/sound-variants/{jeu}", json={"nom": "Deux pas"})).json()["nom"] == "Deux pas"
        un = garde.json()["sons"][0]
        assert (await client.delete(base + f"/sound-variants/{jeu}/sounds/{un}")).json()["sons"] == garde.json()["sons"][1:]
        assert (await client.post(base + f"/sound-variants/{jeu}/sounds", json={"son": un})).json()["sons"][-1] == un
        assert len((await client.get(base + "/sound-variants", params={"son": un})).json()) == 1
        assert (await client.delete(base + f"/sound-variants/{jeu}")).json()["supprime"] == jeu
    serveur = application.state.mcp
    noms = {o.name for o in await serveur.list_tools()}
    assert {"prepare_sound_series", "get_sound_series", "start_sound_series", "keep_sound_takes",
            "get_sound_variant_set", "edit_sound_variant_set", "delete_sound_variant_set"} <= noms
    cree = await serveur.call_tool("edit_sound_variant_set", {"project": projet, "request": {"nom": "Agent", "sons": [un]}})
    assert not cree.is_error and cree.structured_content["sons"] == [un]
