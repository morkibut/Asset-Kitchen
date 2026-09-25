# -*- coding: utf-8 -*-
"""TN7 — un texte repris retrouve le fond de son appel.

`docs/PLAN-transparence-native.md` § TN7. Relevé à la relecture croisée du
25 septembre 2026 : reprendre les réglages d'une image faite sur fond vert —
toute image Qwen d'avant TN2, ou un appel « refaire sur fond coloré » de TN4 —
et l'envoyer vers un autre appel sur fond coloré gardait la phrase de
l'atelier « single isolated sprite on a flat solid #00B140 studio green
background » dans le texte, sans jamais la remplacer. La lecture des couleurs
de la description (RV3, `atelier.domaine.fond.couleurs_nommees`) y lisait
alors « green » comme si l'auteur l'avait écrit, et choisissait le magenta :
le texte partait en nommant le vert, le négatif interdisait le magenta, et
aucun des deux ne protégeait ce qui allait vraiment se rendre.

Le même geste que la relecture avait posé pour le fond vide
(`ServiceGenerations._repris_au_fond`, `atelier.domaine.transparence.sans_fond_colore`)
règle ce cas (`ServiceGenerations._sans_le_fond_d_avant`) : le texte envoyé ne
nomme jamais plus qu'une couleur, celle de l'appel qui part, et la lecture des
couleurs de la description ne voit jamais la phrase que l'atelier a lui-même
écrite.

Aucun appel payé, aucun ComfyUI réel — `test_d3.MODELE` ("essai:rend-du-png")
ne déclare pas la transparence, donc chaque appel de ce fichier est sur fond
coloré, exactement le terrain de TN7.
"""

from __future__ import annotations

from atelier.domaine.fond import VERT_DE_STUDIO
from tests.test_d3 import MODELE, _envoi, _lancer, _technique


# ── 1 · Le défaut trouvé le 25 septembre 2026, reproduit tel quel ───────────


def test_un_texte_repris_dun_fond_vert_ne_fait_plus_choisir_le_magenta_a_rv3(client):
    """Un premier appel sur fond coloré (aucune référence, aucune couleur
    décrite) part sur le vert de studio, comme RT3 le fait par défaut. Le
    reprendre ne doit pas faire lire « green » à RV3 comme si l'auteur
    l'avait écrit : sans correctif, la description crue faisait choisir le
    magenta — le plus loin du vert."""
    premier = _envoi(client)
    assert "studio green" in premier["texte"] and "#00B140" in premier["texte"]
    assert premier["fond"]["couleur"] == VERT_DE_STUDIO.couleur

    repris = _envoi(client, prompt=premier["texte"], repris=True)

    # Toujours le repli par défaut, jamais un candidat choisi pour fuir la
    # propre phrase de l'atelier.
    assert repris["fond"]["couleur"] == VERT_DE_STUDIO.couleur
    assert repris["fond"]["motif"] == ""
    assert "#00B140" in repris["texte"]
    assert "magenta" not in repris["texte"].lower()
    assert "#FF00FF" not in repris["texte"]


# ── 2 · Une seule couleur part, et le négatif n'en interdit qu'une ──────────


def test_le_texte_repris_vers_un_autre_fond_colore_ne_nomme_quune_couleur(client):
    """Un texte repris d'un fond vert, renvoyé vers un fond coloré différent —
    choisi ici sur l'écran de confirmation, exactement comme « refaire sur
    fond coloré » — ne nomme que la couleur de cet appel-ci, jamais les deux,
    et le négatif n'interdit que celle-là."""
    premier = _envoi(client)

    apercu = _envoi(
        client, prompt=premier["texte"], repris=True, tri={"fond": "#FF00FF"}
    )

    assert "#FF00FF magenta" in apercu["texte"]
    assert apercu["texte"].count("flat solid") == 1
    assert "#00B140" not in apercu["texte"]
    assert "studio green" not in apercu["texte"]
    assert "green" not in apercu["texte"].lower()

    assert "#FF00FF" in apercu["fond"]["interdiction"]
    assert "green" not in apercu["fond"]["interdiction"].lower()
    assert "#00B140" not in apercu["fond"]["interdiction"]


def test_relire_avant_lenvoi_et_la_soumission_composent_le_meme_texte(client):
    """« Relire avant l'envoi » (l'aperçu) et la soumission ne peuvent pas se
    contredire : une seule résolution des trois couches (`AGENTS.md`, point
    6)."""
    premier = _envoi(client)
    corps = {"prompt": premier["texte"], "repris": True, "tri": {"fond": "#FF00FF"}}

    apercu = _envoi(client, **corps)
    lancee = _lancer(client, **corps)

    assert lancee["statut"] == "reussie", lancee
    assert lancee["demande"]["prompt"] == apercu["texte"]
    assert "#00B140" not in lancee["demande"]["prompt"]
    assert lancee["demande"]["prompt"].count("flat solid") == 1


def test_un_aller_retour_vert_puis_magenta_puis_vert_ne_garde_quune_couleur(client):
    """Trois reprises de suite, chacune sur un fond différent : à chaque
    étape, le texte qui part ne nomme que la couleur de l'appel du jour."""
    vert = _envoi(client)
    assert "#00B140" in vert["texte"] and "magenta" not in vert["texte"].lower()

    magenta = _envoi(
        client, prompt=vert["texte"], repris=True, tri={"fond": "#FF00FF"}
    )
    assert "#FF00FF" in magenta["texte"] and "#00B140" not in magenta["texte"]

    de_nouveau_vert = _envoi(
        client, prompt=magenta["texte"], repris=True, tri={"fond": "#00B140"}
    )
    assert "#00B140" in de_nouveau_vert["texte"]
    assert "#FF00FF" not in de_nouveau_vert["texte"]
    assert "magenta" not in de_nouveau_vert["texte"].lower()
    assert de_nouveau_vert["texte"].count("flat solid") == 1


# ── 3 · Un texte écrit par l'auteur n'est jamais réécrit ────────────────────


def test_un_texte_ecrit_par_lauteur_qui_nomme_une_couleur_garde_son_effet(client):
    """La cape verte de RV3, non repris : la description est celle de
    l'auteur, mot pour mot, et doit continuer à écarter le vert de studio —
    le correctif de TN7 ne touche jamais un texte que l'auteur a écrit
    lui-même, seulement la phrase que l'atelier y avait ajoutée."""
    envoi = _envoi(
        client, prompt="un rôdeur encapuchonné, cape verte, torche à la main"
    )

    assert envoi["fond"]["couleur"] != VERT_DE_STUDIO.couleur
    assert "vert" in envoi["fond"]["motif"]


def test_un_texte_repris_qui_ne_nommait_aucun_fond_nen_recoit_pas_un(client):
    """Un texte repris qui ne portait ni la consigne de transparence ni une
    couleur de fond — les propres mots de l'auteur, rien de plus — n'en reçoit
    pas un à la reprise : ce n'est pas parce que l'appel a une couleur que
    tout texte repris doit la nommer, seul un texte qui la nommait déjà en a
    besoin (garde ML4)."""
    repris = _envoi(
        client, prompt="CAMERA sideways, mes propres mots.", repris=True
    )

    assert "flat solid" not in repris["texte"]
    assert repris["texte"] == "CAMERA sideways, mes propres mots."
