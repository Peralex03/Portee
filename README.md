# Portée

Portée radio sur carte : relief, bâtiments et forêt. Poser une ou plusieurs antennes (SE-235 portable ou véhicule, SE-135, autre poste), régler puissance, antenne, hauteur et fréquence, et voir sur la carte les zones en liaison sûre, bonne, incertaine ou hors portée. Toucher un point affiche le profil du trajet et le bilan de liaison ; les liaisons entre stations sont calculées dans l'onglet Stations.

Relais : liaisons entre stations tracées sur la carte avec leur marge (sens le plus faible), couverture du réseau limitée aux stations reliées à une station principale, et recherche de l'emplacement d'un relais entre deux stations (la carte montre où les deux liaisons passent, toucher un point pour le détail et poser le relais).

En direct : la couverture se recalcule pendant qu'on fait glisser une antenne, et le bouton de position lance le suivi GPS (marge vers chaque station, trace colorée de son parcours, écran maintenu allumé).

Ouvrir : https://peralex03.github.io/Portee/ puis, sur iPhone, Partager > Sur l'écran d'accueil.

App web autonome, même interface que Calque : un seul fichier `index.html`, sans serveur. Les études restent sur l'appareil.

Modifier : les sources sont dans `src/` (moteur de calcul `engine.js`, interface `app.js`, `style.css`, `template.html`). `npm install` puis `python3 build.py` reconstruit `index.html` ; `node test/test.js` lance les tests du moteur.

Données : relief swisstopo (3d.geo.admin.ch, dérivé de swissALTI3D), bâtiments et forêt des tuiles vectorielles swisstopo, altitude des sites et recherche de lieux de geo.admin.ch. Aucune autre source n'est contactée (politique de sécurité du contenu dans la page).

Matériel : catalogue du règlement 58.430 « Système radio SE-235 » (2003) : SE-235/t et SE-235/m avec LV-235 (0,5 / 5 / 50 W), antennes MA-235, HA-235, FA-235/t, FA-235/m, FA-235/m8, FzA-235, stations relais SE-235/m2 et SE-235/t (deux postes, deux côtés réglables). Gains efficaces et seuil de réception étalonnés sur le tableau des portées du règlement (ch. 43, Plateau, 80 % des emplacements, FHOP) : `node tools/etalonnage.js`, écart moyen 7 %. SE-135 : valeurs provisoires.

Terrain : essais « Liaison OK / Pas de liaison » en suivi en direct, correction proposée pour accorder la carte aux essais (Paramètres, Étalonnage terrain).

Échange : partage d'une étude par QR code (lien qui l'ouvre sur un autre téléphone) ; export GeoJSON lisible par Calque (stations en signe 52.003 « Installation de transmission (radio) », liaisons, zones hors portée) ; import d'un export de Portée ou d'une carte de Calque (les points deviennent des stations).

Hors ligne : `sw.js` garde l'app et les tuiles de carte ; le moteur garde relief, bâtiments, forêt et routes à chaque calcul. Carte, Préparer la zone : charge la carte de la zone de l'étude.

Calcul : Blomquist-Ladell (espace libre + combinaison quadratique de la perte de sol en terre plane, hauteurs effectives, et de la diffraction de Bullington selon UIT-R P.526, courbure au facteur k), perte forfaitaire en forêt. Prévision seulement : un essai de liaison sur le terrain reste la référence.

Carte et données © swisstopo, VBS (geo.admin.ch) · Leaflet (BSD-2) · QR Code Generator, Kazuhiko Arase (MIT) · Inter (OFL)
