# Portée

Portée radio sur carte : relief, bâtiments et forêt. Poser une ou plusieurs antennes (SE-235 portable ou véhicule, SE-135, autre poste), régler puissance, antenne, hauteur et fréquence, et voir sur la carte les zones en liaison sûre, bonne, incertaine ou hors portée. Toucher un point affiche le profil du trajet et le bilan de liaison ; les liaisons entre stations sont calculées dans l'onglet Stations.

En direct : la couverture se recalcule pendant qu'on fait glisser une antenne, et le bouton de position lance le suivi GPS (marge vers chaque station, trace colorée de son parcours, écran maintenu allumé).

Ouvrir : https://peralex03.github.io/Portee/ puis, sur iPhone, Partager > Sur l'écran d'accueil.

App web autonome, même interface que Calque : un seul fichier `index.html`, sans serveur. Les études restent sur l'appareil.

Modifier : les sources sont dans `src/` (moteur de calcul `engine.js`, interface `app.js`, `style.css`, `template.html`). `npm install` puis `python3 build.py` reconstruit `index.html` ; `node test/test.js` lance les tests du moteur.

Données : relief swisstopo (3d.geo.admin.ch, dérivé de swissALTI3D), bâtiments et forêt des tuiles vectorielles swisstopo, altitude des sites et recherche de lieux de geo.admin.ch. Aucune autre source n'est contactée (politique de sécurité du contenu dans la page).

Calcul : Blomquist-Ladell (espace libre + combinaison quadratique de la perte de sol en terre plane, hauteurs effectives, et de la diffraction de Bullington selon UIT-R P.526, courbure au facteur k), perte forfaitaire en forêt. Prévision seulement : gains d'antenne et sensibilité sont des valeurs typiques, à remplacer par celles du règlement 58.430 « Système radio SE-235 ».

Carte et données © swisstopo, VBS (geo.admin.ch) · Leaflet (BSD-2) · Inter (OFL)
