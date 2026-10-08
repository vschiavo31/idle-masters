# Idle Masters V3.5.0

Jeu solo HTML/JavaScript, avec données Dofus embarquées. Aucun appel DoduAPI au démarrage.

## Lancer le jeu

Servir le dossier via HTTP (par exemple `python -m http.server 8000`) puis ouvrir `http://localhost:8000`. Une ouverture directe de `index.html` peut bloquer les fichiers JSON. GitHub Pages reste facultatif.

## Données et règles

Les trois fichiers JSON sont un instantané Dofus 3.7.4.4 déjà présent dans ce dépôt : 817 entrées candidates de bestiaire, 504 équipements, 99 panoplies. Leur source déclarée est `dofusdude/dofus3-main`. Ce ne sont pas forcément les données actuelles de Dofus.

195 monstres sélectionnés dans `local-data.js` utilisent les noms, IDs, niveaux minimums et PV minimums du bestiaire. Le reste est consultable dans l’encyclopédie. La sélection explicite évite de rendre combattables toutes les invocations et tous les acteurs de quête présents dans le fichier. Les regroupements utilisent le raceId de la source, qui peut mélanger plusieurs espèces.

Les zones, éléments d’attaque, dégâts, XP, kamas, statut de boss du Bouftou Royal et parcours de donjon sont des règles Idle Masters. Les zones suivantes se débloquent après 10 victoires en Incarnam, 10 à Astrub, puis une victoire sur le Bouftou Royal. Le donjon est un parcours de quatre rencontres dans Tainéla, pas une reproduction du donjon officiel.

Les fichiers ne contiennent **aucune table de drop officielle ni condition d’équipement Dofus**. Le jeu conserve donc une table d’équipements explicite par famille, affichée explicitement comme drops Idle Masters : 30 % de chance d’un équipement par monstre, modifiée par la prospection (plafond 72 %), puis choix uniforme parmi les pièces de la panoplie associée. Le niveau requis est appliqué ; les autres conditions Dofus ne sont pas disponibles. Les effets sont repris tels que normalisés dans les JSON existants : aucune nouvelle vérification des libellés, signes ou effets manquants auprès des données brutes n’est revendiquée.

Les bonus de panoplie utilisent le palier correspondant au nombre de pièces distinctes, sans additionner les paliers précédents. Deux exemplaires d’un même anneau ne comptent qu’une fois pour une panoplie. Dégâts fixes, dégâts élémentaires et soins sont pris en compte. PM, portée, tacle, fuite, initiative et résistances ne sont pas simulés par le combat simplifié.

## Sauvegarde

La clé `idleMastersV2` est conservée. Avant la migration 3.3.2, une copie est enregistrée sous `idleMastersBackupBefore332`. Les victoires connues sont transférées vers les IDs locaux. Les objets et historiques non reconnus restent conservés. Un objet porté dont le niveau dépasse celui du personnage est replacé dans le sac. La migration est exécutée une seule fois. L’ancien script DoduAPI reste dans le dépôt mais n’est plus chargé.

## Vérification

`node --test tests/game.test.cjs` lance les tests de données, drops, équipement, bonus de panoplie et migration. Validation réalisée dans Chromium avec un écran de 390 × 844 : démarrage, bestiaire, succès, victoire, retour au combat et annulation des tours différés ; aucune erreur JavaScript, aucun appel externe et aucun débordement horizontal. Une vérification DOM confirme aussi la sauvegarde après victoire. Cette simulation ne remplace pas un essai sur Safari iPhone.

## Version d’essai en ligne

Le projet Sites associé est déclaré dans `.openai/hosting.json`. Les mises à jour conservent ce projet et son adresse, afin de garder la sauvegarde navigateur sur la même origine. La publication nécessite `npm run build` pour créer le Worker dans `dist`, puis le workflow Sites. Les futures modifications doivent être vérifiées et publiées sur ce même site avant de remettre le lien d’essai.

À chaque push GitHub, `.github/workflows/check-game.yml` vérifie les règles et lance le parcours mobile dans Chromium et WebKit (moteur Safari). Les anciens workflows qui réinjectaient des scripts sont archivés dans `retired-workflows` et ne s’exécutent plus. Ces tests couvrent les parcours connus, sans garantir l’absence de tous les bugs.

## Drops par famille (3.3.3)

Les Bouftous ordinaires et chefs donnent la panoplie du Bouftou, le Bouftou Royal donne la Royale. Chaque Piou donne sa couleur. Tofus, Prespic, Sanglier, Arakne, Moskito et Larve donnent leurs panoplies respectives. Le Chafer donne l’Amulette du Chafer car aucune panoplie Chafer n’est disponible dans la source locale. Toutes les pièces présentes sont accessibles, sans filtrage par niveau du monstre ; le niveau requis reste appliqué pour les porter. La chance globale reste de 30 % à prospection nulle pour tous les monstres, au maximum une pièce par monstre vaincu. Les objets déjà possédés restent conservés.

## Combats de groupe (3.4.0)

Chaque zone propose trois difficultés : un, deux et trois monstres tirés au hasard dans les pools de `ENCOUNTER_TIERS`. Tainéla utilise les Bouftons Blanc/Noir, Bouftous et Chef de Guerre. Les groupes ne contiennent que des monstres de leur zone et grossissent avec la difficulté. Cliquer sur un ennemi vivant change la cible ; ses PV sont conservés indépendamment. Chaque ennemi encore vivant attaque à la fin du tour. Un ennemi vaincu cesse d’attaquer. Les XP, kamas, compteurs de monstres et drops sont cumulés et accordés une seule fois à la victoire complète. Quitter ou perdre ne donne pas de récompense partielle. Chaque monstre a son tirage de drop de famille à 30 % sans prospection, donc un groupe de trois peut donner jusqu’à trois pièces. Refaire et le mode automatique génèrent un nouveau groupe de la même difficulté. L’automatique se débloque après dix victoires sur ce combat (zone + difficulté). Les compteurs de monstres déjà sauvegardés restent conservés. Le donjon reste accessible séparément à Tainéla.

Les attaques initiales sont réduites (Pression 6–8, Flamiche 3–5, Vague 6–8, Lame de vent 5–8, Coup brutal 8–11). Les attaques des monstres sont réduites pour le combat de groupe. Au niveau 1, sans équipements ni investissement, aucun sort offensif ne peut tuer d’un seul coup un Tofu à 17 PV ; Pression demande trois attaques. Les caractéristiques et les améliorations de sorts continuent d’augmenter les dégâts.

## Sauvegarde durable (3.4.1)

La progression est stockée côté serveur dans D1 et isolée par l’identité transmise par Sites. Le même compte sur le même Site retrouve sa progression entre les appareils et les versions. La copie `idleMastersV2` sert à migrer une ancienne partie et à récupérer en cas de coupure ; un stockage navigateur inaccessible ne bloque plus le jeu. Le statut visible confirme la sauvegarde ; un bouton force l’envoi. Une révision protège les parties contre l’écrasement par un onglet plus ancien. Les erreurs restent visibles et n’effacent pas la partie. La fermeture du jeu tente un dernier envoi. Les données déjà perdues et absentes du navigateur ne peuvent pas être reconstruites.

`npm test` vérifie aussi l’API de sauvegarde contre SQLite. Le test mobile ferme la session, ouvre une session vide avec le stockage navigateur bloqué, retrouve la progression, la modifie et vérifie une nouvelle récupération. La publication utilise `npm run build` (Worker ESM), avec les migrations Drizzle dans `drizzle/`.

## Zones niveau 1–40 (3.5.0)

25 zones, dont 21 nouvelles, conservent les quatre IDs initiaux et leurs règles de déblocage. Les nouvelles zones se débloquent au niveau minimum affiché (sans imposer un nouveau boss aux parties existantes). Elles sont affichées par niveau dans une liste à défilement. Les noms, niveaux et PV des 195 monstres viennent du fichier local ; les lieux et éléments restent des associations Idle Masters. Les 817 fiches restent consultables, y compris les invocations et personnages de quête non sélectionnés. Aucun monstre absent du snapshot n’est inventé : les Biblops sont disponibles, les Blops présents dans le fichier sont des invocations et restent exclus.

Les nouvelles familles utilisent la panoplie correspondante lorsqu’elle existe : Champ Champ, Champêtre, Larvesque, Tofu, Arakne, Mousse, Kardorim, Abraknyde, Bandit, Kwaks et Sanglier. Les Vampires donnent la Cape du Vampire. Certaines panoplies ne sont que partiellement représentées jusqu’au niveau 40 (Abraknyde : deux pièces ; Kwaks : une pièce par élément). Les familles sans équipement associé disponible, dont les Scarafeuilles, donnent un pool explicitement nommé par tranche de dix niveaux ; les panoplies et objets réservés aux familles en sont exclus. Ce sont des tables Idle Masters, pas les tables officielles de Dofus. La probabilité totale reste identique par monstre. Les tables sont mises en cache pour limiter les calculs sur mobile.

Les pools des nouveaux combats sont partitionnés par PV croissants. Chaque monstre sélectionné est accessible et les PV totaux augmentent strictement d’une difficulté à la suivante, même en comparant le tirage le plus léger au plus lourd. Les tests couvrent l’intégrité et l’accessibilité de chaque monstre, les 25 zones, leurs déblocages, les pools et taux de drops, les récompenses en groupe et l’ouverture de chacun des 63 nouveaux combats via l’interface mobile Chromium et WebKit. Le test de récupération de sauvegarde vérifie aussi le niveau et la nouvelle zone choisie.
