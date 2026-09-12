"""Un aperçu modifie les pixels sous les yeux, aucun objet enregistré."""
import base64
import copy
from io import BytesIO
from PIL import Image
from conftest import image_sujet


def importer(client):
    recu = client.post('/api/assets/upload?nom=source.png&traiter=false', content=image_sujet())
    assert recu.status_code == 201, recu.text
    return recu.json()['asset']


def test_apercu_fermeture_enregistrement_et_relecture_ont_les_memes_pixels(client, atelier, monkeypatch):
    origine = importer(client)
    identifiant = origine['identifiant']
    recette = {**origine['recette'], 'grille': {'cible': 48, 'occupation': 75, 'ancrage': 'bas', 'decalage': 0, 'methode': 'proche'}, 'retournement': {'sens': 'gauche-droite'}}
    sauvegardes = []
    sauver = atelier.assets.sauver
    with monkeypatch.context() as m:
        m.setattr(atelier.assets, 'sauver', lambda *a, **k: sauvegardes.append(a))
        apercu = client.post(f'/api/assets/{identifiant}/recipe/preview', json={'recette': recette})
        assert apercu.status_code == 200, apercu.text
        assert sauvegardes == []
        assert client.get(f'/api/assets/{identifiant}').json() == origine
    assert apercu.json()['largeur'] == 48
    assert apercu.json()['mesures']['hauteur']['carres'] == 48
    # Fermer revient à lire la même version durable ; aucune réponse POST n’en tient lieu.
    assert client.get(f'/api/assets/{identifiant}').json()['recette'] == origine['recette']
    recu = client.put(f'/api/assets/{identifiant}/recipe', json=apercu.json()['recette'])
    assert recu.status_code == 200, recu.text
    rouvert = client.get(f'/api/assets/{identifiant}').json()
    assert rouvert['recette']['grille']['cible'] == 48
    png = client.get(f'/api/assets/{identifiant}/image').content
    assert png == base64.b64decode(apercu.json()['rendu'].split(',')[1])
    assert atelier.assets.sauver == sauver
    brut = client.post(f'/api/assets/{identifiant}/recipe/preview', json={'recette': {}, 'reinitialiser': True})
    assert brut.status_code == 200, brut.text
    assert client.get(f'/api/assets/{identifiant}').json()['recette']['grille']['cible'] == 48
    assert client.put(f'/api/assets/{identifiant}/recipe?reinitialiser=true', json=brut.json()['recette']).status_code == 200
    # Le brut conserve son encodage RGB d’origine, l’aperçu est un PNG RGBA.
    brut_relu = Image.open(BytesIO(client.get(f'/api/assets/{identifiant}/image').content)).convert('RGBA')
    brut_apercu = Image.open(BytesIO(base64.b64decode(brut.json()['rendu'].split(',')[1]))).convert('RGBA')
    assert brut_relu.size == brut_apercu.size
    assert brut_relu.tobytes() == brut_apercu.tobytes()


def test_collage_et_recette_nommee_sont_relus_sans_ecrire_et_refus_preserve_source(client, atelier):
    origine = importer(client)
    identifiant = origine['identifiant']
    recette = {**origine['recette'], 'recadrage': {'marge': 3, 'boite': [1, 1, 20, 20]}, 'retournement': {'sens': 'gauche-droite'}}
    avant = copy.deepcopy(client.get(f'/api/assets/{identifiant}').json())
    collage = client.post(f'/api/assets/{identifiant}/recipe/preview', json={'recette': recette, 'voyageuse': True})
    assert collage.status_code == 200, collage.text
    assert collage.json()['recette']['recadrage']['boite'] is None
    assert collage.json()['laisse']
    assert client.get(f'/api/assets/{identifiant}').json() == avant
    client.put('/api/recipes/miroir', json=recette)
    nommee = client.post(f'/api/assets/{identifiant}/recipe/preview', json={'recette': {}, 'nom': 'miroir'})
    assert nommee.status_code == 200, nommee.text
    assert nommee.json()['recette']['retournement']['sens'] == 'gauche-droite'
    assert client.get(f'/api/assets/{identifiant}').json() == avant
    refus = client.post(f'/api/assets/{identifiant}/recipe/preview', json={'recette': {'grille': {'cible': 9000}}})
    assert refus.status_code == 422
    assert client.get(f'/api/assets/{identifiant}').json() == avant


def test_modele_inconnu_est_nomme_meme_sans_moteur_et_les_refus_ne_sauvent_rien(client, monkeypatch):
    import atelier.services.assets as service_assets
    from atelier.image.traitement import MODELE_ONNX

    origine = importer(client)
    identifiant = origine['identifiant']
    monkeypatch.setattr(service_assets, 'raison_moteur', lambda _: 'moteur indisponible dans cet essai')
    recette = {'passes': [{'moteur': 'modele', 'modele': 'silhouette-inconnue'}]}
    apercu = client.post(f'/api/assets/{identifiant}/recipe/preview', json={'recette': recette})
    garde = client.put(f'/api/assets/{identifiant}/recipe', json=recette)
    for refus in (apercu, garde):
        assert refus.status_code == 409, refus.text
        assert 'silhouette-inconnue' in refus.text
    # Un nom valide conserve bien le refus d'installation, sans charger le moteur.
    connu = client.put(f'/api/assets/{identifiant}/recipe', json={'passes': [{'moteur': 'modele', 'modele': MODELE_ONNX}]})
    assert connu.status_code == 409 and 'moteur indisponible dans cet essai' in connu.text
    assert client.get(f'/api/assets/{identifiant}').json() == origine
