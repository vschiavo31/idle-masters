# Idle Masters V3.3.2

Jeu solo HTML/JavaScript, avec données Dofus embarquées. Aucun appel DoduAPI au démarrage.

## Lancer le jeu

Servir le dossier via HTTP (par exemple `python -m http.server 8000`) puis ouvrir `http://localhost:8000`. Une ouverture directe de `index.html` peut bloquer les fichiers JSON. GitHub Pages reste facultatif.

## Données et règles

Les trois fichiers JSON sont un instantané Dofus 3.7.4.4 déjà présent dans ce dépôt : 817 entrées candidates de bestiaire, 504 équipements, 99 panoplies. Leur source déclarée est `dofusdude/dofus3-main`. Ce ne sont pas forcément les données actuelles de Dofus.

21 rencontres sélectionnées dans `local-data.js` utilisent les noms, IDs, niveaux minimums et PV minimums du bestiaire. Le reste est consultable dans l’encyclopédie. La sélection explicite évite de rendre combattables toutes les invocations et tous les acteurs de quête présents dans le fichier. Les regroupements utilisent le raceId de la source, qui peut mélanger plusieurs espèces.

Les zones, éléments d’attaque, dégâts, XP, kamas, statut de boss du Bouftou Royal et parcours de donjon sont des règles Idle Masters. Les zones suivantes se débloquent après 10 victoires en Incarnam, 10 à Astrub, puis une victoire sur le Bouftou Royal. Le donjon est un parcours de quatre rencontres dans Tainéla, pas une reproduction du donjon officiel.

Les fichiers ne contiennent **aucune table de drop officielle ni condition d’équipement Dofus**. Le jeu conserve donc une table d’équipements par tranche de niveau, affichée explicitement comme drops Idle Masters : 30 % de chance d’un équipement, modifiée par la prospection (plafond 72 %), puis choix uniforme dans la table complète. Le niveau requis est appliqué ; les autres conditions Dofus ne sont pas disponibles. Les effets sont repris tels que normalisés dans les JSON existants : aucune nouvelle vérification des libellés, signes ou effets manquants auprès des données brutes n’est revendiquée.

Les bonus de panoplie utilisent le palier correspondant au nombre de pièces distinctes, sans additionner les paliers précédents. Deux exemplaires d’un même anneau ne comptent qu’une fois pour une panoplie. Dégâts fixes, dégâts élémentaires et soins sont pris en compte. PM, portée, tacle, fuite, initiative et résistances ne sont pas simulés par le combat simplifié.

## Sauvegarde

La clé `idleMastersV2` est conservée. Avant la migration 3.3.2, une copie est enregistrée sous `idleMastersBackupBefore332`. Les victoires connues sont transférées vers les IDs locaux. Les objets et historiques non reconnus restent conservés. Un objet porté dont le niveau dépasse celui du personnage est replacé dans le sac. La migration est exécutée une seule fois. L’ancien script DoduAPI reste dans le dépôt mais n’est plus chargé.

## Vérification

`node --test tests/game.test.cjs` lance les tests de données, drops, équipement, bonus de panoplie et migration. Validation réalisée dans Chromium avec un écran de 390 × 844 : démarrage, bestiaire, succès, victoire, retour au combat et annulation des tours différés ; aucune erreur JavaScript, aucun appel externe et aucun débordement horizontal. Une vérification DOM confirme aussi la sauvegarde après victoire. Cette simulation ne remplace pas un essai sur Safari iPhone.
