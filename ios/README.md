# Portée pour iPhone

L'app iOS ouvre la version en ligne de Portée (https://peralex03.github.io/Portee/) dans une fenêtre plein écran. Chaque mise à jour du site arrive dans l'app sans nouveau build. Après une première ouverture avec réseau, Portée s'ouvre aussi hors ligne.

Ce que l'app ajoute à la version web :

- la position passe par l'iPhone : l'accès est demandé une seule fois, pas à chaque lancement ;
- l'écran reste allumé pendant le suivi en direct ;
- « Exporter pour Calque » ouvre la feuille de partage d'iOS (Fichiers, AirDrop, Messages) ;
- si iOS arrête la page par manque de mémoire, elle se recharge seule au lieu de rester noire ;
- un message clair si le tout premier lancement se fait sans connexion.

## Ce qu'il faut

1. Xcode 16 ou plus récent.
2. L'adhésion Apple Developer Program (pour TestFlight).
3. L'identifiant Apple connecté dans Xcode : Xcode > Settings > Accounts.

## Mise en route

1. Ouvrir `Portee.xcodeproj` dans Xcode.
2. Cliquer sur le projet « Portee » (en haut à gauche), cible « Portee », onglet « Signing & Capabilities » :
   - cocher « Automatically manage signing » ;
   - choisir l'équipe dans « Team » ;
   - « Bundle Identifier » : `ch.alexandreperez.portee` par défaut. Il peut être changé, il doit être unique chez Apple.
3. Brancher l'iPhone, le choisir en haut de la fenêtre, puis lancer (bouton lecture).

## Envoi sur TestFlight

1. Sur https://appstoreconnect.apple.com : Apps > « + » > Nouvelle app. Plateforme iOS, nom « Portée » (ou un autre s'il est pris, par exemple « Portée Radio »), langue français, le même Bundle ID que dans Xcode, référence (SKU) libre, par exemple `portee`.
2. Dans Xcode, choisir la destination « Any iOS Device (arm64) », puis Product > Archive.
3. Dans la fenêtre qui s'ouvre : Distribute App > App Store Connect > Distribute.
4. Sur App Store Connect, onglet TestFlight : le build apparaît après quelques minutes de traitement.
   - Chiffrement : `Info.plist` déclare `ITSAppUsesNonExemptEncryption = NO`. Portée n'utilise que le HTTPS du système, sans chiffrement à elle. C'est une déclaration du titulaire du compte : pour répondre soi-même à la question, retirer cette clé.
   - Testeurs internes (membres de l'équipe App Store Connect) : disponibles tout de suite.
   - Testeurs externes (lien public ou e-mails) : Apple examine d'abord le build.
5. Pour chaque nouvel envoi, augmenter « Build » (cible Portee > General > Identity) avant d'archiver.

## À vérifier au premier lancement

Ce projet a été écrit sans Mac : il n'a pas encore été compilé. Merci de contrôler :

- l'app s'ouvre sur la carte, plein écran, sans bande en haut ni en bas ;
- poser une station lance le calcul et affiche la couverture ;
- le suivi en direct demande la position une fois, puis la suit ; l'écran ne se met pas en veille ;
- un nouveau lancement ne redemande pas la position ;
- Études > Exporter pour Calque ouvre la feuille de partage ;
- Études > Importer un fichier ouvre le sélecteur de fichiers ;
- en mode avion, après une première ouverture : l'app s'ouvre quand même.

Si la compilation échoue ou si un point ne marche pas, copier le message d'erreur : la correction est rapide.

## Changer d'hébergement

L'adresse est à deux endroits, à garder identiques : `Portee/WebViewController.swift` (constantes `home`, `host`, `root`) et `Portee/Info.plist` (`WKAppBoundDomains`).

## App Store public

Pour TestFlight, aucun obstacle attendu. Pour l'App Store public, la règle 4.2 d'Apple refuse souvent les apps qui ne font qu'afficher un site web, comme pour Calque. La position native, l'écran allumé et le partage de fichiers aident, mais ne garantissent pas l'acceptation.
