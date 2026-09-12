"""La bibliothèque trie les sujets du jeu avant d’en servir une page."""
from tests.test_b9 import _creer, _plan, _poser

def test_tri_sur_famille_entiere_et_collection(client, tmp_path):
    z = _creer(client, "Zulu")
    a = _creer(client, "Alpha")
    b = _creer(client, "Beta")
    route = "/api/characters/families/personnages"
    alphabet = client.get(route, params={"tri": "nom", "limite": 1})
    assert alphabet.status_code == 200, alphabet.text
    assert alphabet.json()["personnages"][0]["identifiant"] == a and alphabet.json()["total"] == 3
    envers = client.get(route, params={"tri": "nom-desc", "limite": 1}).json()
    assert envers["personnages"][0]["identifiant"] == z
    _poser(client, tmp_path, b, _plan(client)[0])
    resultats = client.get(route, params={"tri": "resultats", "limite": 1}).json()
    assert resultats["personnages"][0]["identifiant"] == b
    refuse = client.get(route, params={"tri": "inconnu"})
    assert refuse.status_code == 409
