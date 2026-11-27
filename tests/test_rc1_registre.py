"""RC1 · Le registre du contenu : une entrée à choix déposée par un agent,
jugée par l'auteur, relevée par l'agent — et ce qui l'entoure.

Exemples neutres (le marais du vocabulaire) : aucune donnée d'un jeu réel."""
import io
import json

import pytest
from PIL import Image

from atelier.api.app import creer_application
from atelier.domaine.registre import AUTEUR, RegistreRefuse, etat_de_l_entree


def png(couleur=(90, 120, 60)) -> bytes:
    flux = io.BytesIO()
    Image.new("RGBA", (16, 16), couleur + (255,)).save(flux, "PNG")
    return flux.getvalue()


def _jeu(atelier):
    return atelier.bibliotheque.courant or atelier.bibliotheque.creer_projet("Marais").identifiant


def _images(tmp_path, n=3):
    chemins = []
    for i in range(n):
        p = tmp_path / f"heron-{i}.png"
        p.write_bytes(png(couleur=(40 * i, 90, 120)))
        chemins.append(p)
    return chemins


def _trois_portraits(atelier, tmp_path, **plus):
    jeu = _jeu(atelier)
    images = _images(tmp_path)
    vue = atelier.registre.deposer(jeu, {
        "identifiant": "heron-portrait", "type": "visuel", "titre": "Portrait : le héron",
        "resume": "Trois pistes pour le héron. Prends-en une.", "rayon": "personnages",
        "auteur": "fil-portraits", "choix": True,
        "medias": [{"fichier": str(images[0]), "code": "a", "legende": "Plumes grises"},
                   {"fichier": str(images[1]), "code": "b", "legende": "Plumes blanches", "conseil": True,
                    "defauts": "le bec est un peu court"},
                   {"fichier": str(images[2]), "code": "c", "legende": "Plumes bleues"}],
    } | plus)
    return jeu, vue


# ── Le geste qui a déclenché la demande ──────────────────────────────────


def test_une_entree_a_choix_deposee_jugee_et_relevee(atelier, tmp_path):
    jeu, vue = _trois_portraits(atelier, tmp_path)
    assert vue["etat"] == "a-trancher" and vue["change"] == "depot"
    assert [m["code"] for m in vue["propositions"]] == ["a", "b", "c"]
    assert vue["propositions"][1]["conseil"] is True
    assert all(m["genre"] == "image" for m in vue["propositions"])

    # L'auteur prend « b » : l'entrée le dit tout de suite, un second clic ne crée rien.
    pris = atelier.registre.prendre(jeu, "heron-portrait", ["b"])
    assert pris["pris"] == ["b"] and pris["deja"] is False
    assert atelier.registre.prendre(jeu, "heron-portrait", ["b"])["deja"] is True
    valide = atelier.registre.decider(jeu, "heron-portrait", "valider")
    assert valide["etat"] == "validee"
    assert atelier.registre.decider(jeu, "heron-portrait", "valider")["deja"] is True

    # L'agent relève : exactement ce qu'il n'a pas lu, une fois.
    releve = atelier.registre.decisions_depuis(jeu, lecteur="fil-portraits")
    assert [(e["genre"], e.get("codes"), e.get("geste")) for e in releve["evenements"]] == [
        ("choix", ["b"], None), ("decision", None, "valider")]
    assert releve["evenements"][0]["titre"] == "Portrait : le héron"
    assert atelier.registre.decisions_depuis(jeu, lecteur="fil-portraits")["evenements"] == []


def test_redeposer_ne_double_rien(atelier, tmp_path):
    jeu, _ = _trois_portraits(atelier, tmp_path)
    vue = atelier.registre.deposer(jeu, {
        "identifiant": "heron-portrait", "type": "visuel", "titre": "Portrait : le héron", "auteur": "fil-portraits",
        "choix": True, "rayon": "personnages",
        "medias": [{"fichier": str(p), "code": c} for p, c in zip(_images(tmp_path), "abc")]})
    assert vue["versions"] == 1
    assert len(atelier.registre.lister(jeu)["entrees"]) == 1


def test_une_version_neuve_remplace_a_l_ecran_et_garde_l_histoire(atelier, tmp_path):
    jeu, _ = _trois_portraits(atelier, tmp_path)
    atelier.registre.decider(jeu, "heron-portrait", "reprise", mot="Le bec plus long")
    atelier.registre.remarquer(jeu, "heron-portrait", "La b est la bonne direction", cible="b")
    neuve = tmp_path / "heron-v2.png"
    neuve.write_bytes(png(couleur=(200, 10, 10)))
    vue = atelier.registre.deposer(jeu, {
        "identifiant": "heron-portrait", "type": "visuel", "titre": "Portrait : le héron", "auteur": "fil-portraits",
        "medias": [{"fichier": str(neuve), "code": "b2"}], "change": "Bec allongé"})
    assert vue["change"] == "version" and vue["version"] == 2
    assert [m["code"] for m in vue["propositions"]] == ["b2"]
    # La reprise visait la v1 : la v2 est de nouveau à trancher.
    assert vue["etat"] == "a-trancher"
    ancienne = vue["histoire"][0]
    assert ancienne["numero"] == 1 and [m["code"] for m in ancienne["medias"]] == ["a", "b", "c"]
    assert {e["genre"] for e in ancienne["dit"]} == {"decision", "remarque"}


def test_un_texte_a_deux_portes(atelier):
    jeu = _jeu(atelier)
    atelier.registre.deposer(jeu, {"identifiant": "lettre-du-meunier", "type": "texte", "titre": "La lettre du meunier",
                                   "corps": "Brief : une lettre inquiète.", "auteur": "fil-ecriture"})
    vue = atelier.registre.decider(jeu, "lettre-du-meunier", "valider")
    # Le brief est validé, pas le texte : l'écran ne laisse pas croire le contraire.
    assert vue["etat"] == "a-trancher" and vue["porte"] == "textes"
    vue = atelier.registre.deposer(jeu, {"identifiant": "lettre-du-meunier", "type": "texte",
                                         "titre": "La lettre du meunier", "corps": "Cher voisin…", "auteur": "fil-ecriture"})
    assert vue["porte"] == "textes"  # la porte passée reste passée d'une version à l'autre
    assert atelier.registre.decider(jeu, "lettre-du-meunier", "valider")["etat"] == "validee"


def test_annuler_et_revenir_sur_un_choix(atelier, tmp_path):
    jeu, _ = _trois_portraits(atelier, tmp_path)
    atelier.registre.prendre(jeu, "heron-portrait", ["a", "c"])
    vue = atelier.registre.prendre(jeu, "heron-portrait", ["c"])
    assert vue["pris"] == ["c"]
    dernier = [e for e in vue["journal"] if e["genre"] == "choix"][-1]
    assert dernier["annulable"]
    assert atelier.registre.annuler(jeu, dernier["repere"])["pris"] == ["a", "c"]
    with pytest.raises(RegistreRefuse):
        atelier.registre.decider(jeu, "heron-portrait", "reprise")  # une reprise demande un mot


def test_ecarter_sort_de_la_vue_sans_se_perdre(atelier, tmp_path):
    jeu, _ = _trois_portraits(atelier, tmp_path)
    atelier.registre.decider(jeu, "heron-portrait", "ecarter")
    accueil = atelier.registre.accueil(jeu)
    assert accueil["a_trancher"] == [] and [v["identifiant"] for v in accueil["hors_vue"]] == ["heron-portrait"]
    assert atelier.registre.lister(jeu)["total"] == 0
    assert atelier.registre.lister(jeu, hors_vue=True)["total"] == 1
    assert atelier.registre.decider(jeu, "heron-portrait", "relancer")["etat"] == "a-trancher"


def test_l_accueil_met_a_trancher_en_tete_puis_le_neuf(atelier, tmp_path):
    jeu, _ = _trois_portraits(atelier, tmp_path)
    atelier.registre.deposer(jeu, {"identifiant": "carte-du-marais", "type": "reference", "titre": "Carte du marais",
                                   "auteur": "fil-lore", "rayon": "lore"})
    accueil = atelier.registre.accueil(jeu)
    assert [v["identifiant"] for v in accueil["a_trancher"]] == ["heron-portrait"]
    assert [v["identifiant"] for v in accueil["nouveautes"]] == ["carte-du-marais"]
    atelier.registre.marquer_vu(jeu)
    accueil = atelier.registre.accueil(jeu)
    assert accueil["nouveautes"] == [] and accueil["par_rayon"][0]["entrees"][0]["identifiant"] == "carte-du-marais"


def test_l_agent_repond_sous_la_remarque_et_ne_valide_jamais(atelier, tmp_path):
    jeu, _ = _trois_portraits(atelier, tmp_path)
    vue = atelier.registre.remarquer(jeu, "heron-portrait", "Pourquoi trois et pas quatre ?", sorte="question")
    repere = vue["remarques"][0]["repere"]
    rep = atelier.registre.repondre(jeu, repere, "Le quatrième ratait ses pattes.", etat="faite", qui="fil-portraits")
    r = rep["remarques"][0]
    assert r["etat"] == "faite" and r["reponses"][0]["texte"].startswith("Le quatrième")
    with pytest.raises(RegistreRefuse, match="Valider est un geste de l'auteur"):
        atelier.registre.statuer(jeu, "heron-portrait", "validee", qui="fil-portraits")
    with pytest.raises(RegistreRefuse):
        atelier.registre.repondre(jeu, repere, "moi", qui=AUTEUR)


def test_un_depot_mal_forme_dit_quoi_corriger(atelier, tmp_path):
    jeu = _jeu(atelier)
    for brut, attendu in (
        ({"type": "tableau", "titre": "x", "auteur": "a"}, "Type « tableau » inconnu"),
        ({"type": "visuel", "titre": "x", "auteur": "a", "rayon": "persos"}, "Rayon « persos » inconnu"),
        ({"type": "visuel", "titre": "x", "auteur": "a", "statut": "valide"}, "Champ inconnu : statut"),
        ({"type": "visuel", "titre": "x", "auteur": "a", "medias": [{"fichier": "/nulle/part.png"}]}, "n'existe pas"),
        ({"type": "visuel", "titre": "x", "auteur": "a", "choix": True,
          "medias": [{"fichier": str(_images(tmp_path, 1)[0])}]}, "au moins deux"),
        ({"type": "visuel", "titre": "x"}, "qui l'a déposée"),
    ):
        with pytest.raises(RegistreRefuse, match=attendu):
            atelier.registre.deposer(jeu, brut)


def test_la_boite_de_depot_par_fichiers(atelier, tmp_path):
    """Un fil sans accès au port local dépose une entrée et lit une décision."""
    jeu = _jeu(atelier)
    racine = atelier.registre._racine(jeu)
    boite = racine / "depot" / "heron"
    boite.mkdir(parents=True)
    for i, p in enumerate(_images(tmp_path, 2)):
        (boite / f"piste-{i}.png").write_bytes(p.read_bytes())
    (boite / "entree.json").write_text(json.dumps({
        "identifiant": "heron-cloud", "type": "visuel", "titre": "Le héron, depuis le nuage", "auteur": "fil-nuage",
        "choix": True, "medias": [{"fichier": "piste-0.png"}, {"fichier": "piste-1.png", "conseil": True}]}),
        encoding="utf-8")
    mauvais = racine / "depot" / "casse"
    mauvais.mkdir()
    (mauvais / "entree.json").write_text('{"type": "visuel", "titre": "x", "auteur": "a", "rayon": "nulle"}', encoding="utf-8")

    accueil = atelier.registre.accueil(jeu)
    assert [v["identifiant"] for v in accueil["a_trancher"]] == ["heron-cloud"]
    assert accueil["depots_refuses"][0]["dossier"] == "casse"
    assert "Rayon « nulle » inconnu" in (mauvais / "REFUS.txt").read_text(encoding="utf-8")
    assert not boite.exists() and list((racine / "depot" / ".pris").iterdir())

    atelier.registre.prendre(jeu, "heron-cloud", ["piste-1"])
    # La décision se lit dans un fichier, sans réseau.
    fichiers = sorted((racine / "journal").glob("*.json"))
    choix = [json.loads(f.read_text(encoding="utf-8")) for f in fichiers]
    assert any(e["genre"] == "choix" and e["codes"] == ["piste-1"] and e["qui"] == AUTEUR for e in choix)


def test_tout_se_relit_sans_l_index(atelier, tmp_path):
    """On ferme, on efface l'index, on rouvre : tout est là (le critère 10)."""
    jeu, _ = _trois_portraits(atelier, tmp_path)
    atelier.registre.prendre(jeu, "heron-portrait", ["a"])
    atelier.registre.marquer_vu(jeu)
    avant = atelier.registre.lire(jeu, "heron-portrait")
    atelier.fichiers.base.unlink(missing_ok=True)
    from atelier.services import Atelier
    from tests.conftest import AnimateurMuet
    autre = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: None, fabrique_animateur=lambda: AnimateurMuet())
    apres = autre.registre.lire(jeu, "heron-portrait")
    assert apres["pris"] == ["a"] and apres["nouveau"] is False and apres["etat"] == avant["etat"]


def test_un_asset_de_la_bibliotheque_par_reference(atelier):
    jeu = _jeu(atelier)
    asset = atelier.generations.importer(png(), "heron.png", projet=jeu)["asset"]
    vue = atelier.registre.deposer(jeu, {"type": "visuel", "titre": "Depuis la bibliothèque", "auteur": "fil",
                                         "medias": [{"asset": asset["identifiant"]}]})
    m = vue["propositions"][0]
    assert m["asset"] == asset["identifiant"] and "fichier" not in m
    assert not (atelier.registre._racine(jeu) / "entrees" / vue["identifiant"] / "medias").exists()


def test_le_parcours_manuel_par_les_routes(atelier, client):
    jeu = _jeu(atelier)
    t = client.post(f"/api/projects/{jeu}/register/uploads?nom=heron.png", content=png()).json()
    t2 = client.post(f"/api/projects/{jeu}/register/uploads?nom=heron2.png", content=png(couleur=(1, 2, 3))).json()
    vue = client.post(f"/api/projects/{jeu}/register/entries", json={
        "type": "visuel", "titre": "Mon héron", "choix": True,
        "medias": [{"fichier": t["fichier"], "code": "un"}, {"fichier": t2["fichier"], "code": "deux"}]}).json()
    assert vue["auteur"] == AUTEUR and vue["etat"] == "a-trancher"
    image = client.get(f"/api/projects/{jeu}/register/entries/{vue['identifiant']}/media/"
                       + vue["propositions"][0]["fichier"].split("/")[-1])
    assert image.status_code == 200 and image.content[:4] == b"\x89PNG"
    r = client.put(f"/api/projects/{jeu}/register/entries/{vue['identifiant']}/choice", json={"codes": ["deux"]}).json()
    assert r["pris"] == ["deux"]
    refus = client.post(f"/api/projects/{jeu}/register/entries/{vue['identifiant']}/decision", json={"geste": "voler"})
    assert refus.status_code == 409
    assert "Montré : Mon héron" in client.get(f"/api/projects/{jeu}/register/retrospective.md").text


async def test_les_outils_de_l_agent_n_ont_aucun_geste_de_decision(atelier):
    app = creer_application(atelier)
    noms = {t.name for t in await app.state.mcp.list_tools()}
    assert {"list_entry_types", "list_entries", "get_entry", "submit_entry", "read_decisions",
            "answer_remark", "set_entry_status", "set_entry_waiting"} <= noms
    assert not any(n in noms for n in ("validate_entry", "decide_entry", "pick_entry"))


def test_etat_pur_une_reference_n_a_rien_a_trancher():
    entree = {"identifiant": "x", "versions": [{"numero": 1, "medias": []}]}
    assert etat_de_l_entree(entree, [], {"portes": []})["etat"] == "reference"
