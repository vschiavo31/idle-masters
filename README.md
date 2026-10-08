# Idle Masters V3.6.1

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

## Progression en combat (3.5.1)

L’interface de combat affiche le niveau, une barre d’XP accessible, le pourcentage et les XP restantes avant le prochain niveau. Elle reste visible au choix de zone, pendant le combat et au résultat. Chaque victoire retient les niveaux avant et après l’attribution réelle d’XP (sagesse et plusieurs niveaux compris) et affiche les niveaux gagnés au résultat. Le message est masqué si aucun niveau n’a été gagné. Les règles d’XP et le format de la sauvegarde restent identiques.

## Classes et sorts (3.6.0)

19 classes et 152 sorts sont définis dans `classes.js`. Il s’agit de livres de sorts et d’effets Idle Masters, pas des tables officielles de Dofus. Deux sorts sont disponibles au niveau 1, puis un sort aux niveaux 5, 10, 15, 20, 30 et 40. Les sorts verrouillés ne peuvent être ni lancés ni améliorés. Les livres indiquent PA, élément, effet et relance ; les sorts restent améliorables jusqu’au rang 5 avec les points de sorts existants.

Le choix est demandé au premier démarrage de cette version ; niveau, XP, inventaire, caractéristiques et victoires sont conservés. Les points investis dans les six anciens sorts sont remboursés une seule fois (`classMigration`) et leurs anciens rangs sont conservés dans `legacySpellLv`. Les nouveaux rangs sont enregistrés par ID de sort dans `spellRanks`. Changer de classe est gratuit hors combat, pour permettre les essais ; les améliorations de chaque classe restent conservées et aucun nouveau remboursement n’est accordé lors d’un changement.

`combat-effects.js` gère les dégâts de groupe, soins, vol de vie, boucliers, buffs, concentration, marques, affaiblissements, poisons, invocations, bombes et récupération de PA. Les effets sont temporaires et remis à zéro à chaque combat. Les poisons et invocations agissent avant les attaques ennemies, les bombes explosent après deux fins de tour ou avec Détonateur. Une victoire due à un effet accorde les récompenses une seule fois et annule les attaques ennemies restantes. Les effets attachés à un ennemi utilisent sa position dans le groupe pour séparer deux exemplaires de la même espèce. Une invocation est autorisée par défaut, deux pour l’Osamodas ; trois bombes au maximum. Les relances et limites de lancers empêchent les répétitions de sorts de soutien. Les passifs décrits dans l’interface sont appliqués par le moteur ; ni déplacements sur une grille ni portails spatiaux ne sont simulés.

Les nouveaux sorts débloqués sont annoncés au résultat du combat. Les tests couvrent les seuils de niveau des 19 classes, les migrations, le verrouillage pendant le combat, les effets et leurs récompenses, puis les 152 lancers dans l’interface mobile Chromium et WebKit. La récupération en session neuve vérifie aussi la classe et les rangs de sorts.

## Aperçu et changement de classe (3.6.1)

Sélectionner une classe ouvre une fiche de ses huit sorts : niveaux de déblocage, élément, PA, effets et relances. Les rangs déjà acquis dans cette classe sont affichés. L’aperçu utilise le passif de la classe consultée, sans modifier la classe active ni dépenser de kamas. Retour permet de consulter une autre classe. Confirmer est gratuit pour le premier choix, puis coûte 20 000 kamas par changement (`CLASS_CHANGE_PRICE`). Un solde insuffisant ou un combat en cours interdit la confirmation. Confirmer la classe actuelle ne dépense rien ; les confirmations répétées ne débitent pas deux fois. Les rangs et la progression restent conservés. Les tests de sauvegarde vérifient aussi le solde après changement.

### V3.7 — partage, pseudo et ladder

Le jeu est accessible par lien. Chaque joueur se connecte avec ChatGPT et possède
un personnage avec un pseudo unique (3–20 caractères). Les pseudonymes sont publics,
les comptes et les inventaires restent privés. Un personnage existant conserve sa
progression et choisit son pseudo lors de la première ouverture de cette version.
Le changement de classe conserve le pseudo et coûte toujours 20 000 kamas.

Le ladder affiche les 100 premiers ainsi que la position du joueur connecté,
triés par niveau, XP du niveau, puis date de création. Il suit la sauvegarde durable.
Les combats étant calculés dans le navigateur, ce classement entre amis n'offre
pas encore de validation anti-triche des gains côté serveur.

Les copies locales sont désormais séparées par compte et ne sont jamais importées
pour un nouvel utilisateur. Si le serveur n'est pas joignable au démarrage,
le jeu bloque le chargement et propose de réessayer pour éviter de perdre une partie.

### V3.7.1 — déblocage d’Astrub

Les victoires dans Incarnam, les Prairies et le Cimetière d’Incarnam
comptent toutes pour débloquer Astrub. La condition affiche désormais
la région concernée et la progression sur 10. Les anciens déblocages sont conservés.

### V3.8 — progression linéaire et tris

Les 25 zones suivent l’ordre affiché, du niveau le plus bas au plus haut.
Seule la première est ouverte au départ. Dix victoires au combat difficile
de chaque zone précédente débloquent la suivante ; les niveaux, boss et
combats faciles/intermédiaires ne remplacent plus cette condition.
Les victoires déjà sauvegardées restent conservées, avec leur identifiant
de zone initial. Une zone déjà visitée peut être bloquée tant que les étapes
précédentes ne sont pas terminées.

L’inventaire propose les tris niveau et perfection du jet, chacun dans les
deux sens. Le choix est sauvegardé avec le personnage.

La remise à zéro des caractéristiques est gratuite hors combat, avec
confirmation et remboursement exact des points selon les paliers (Sagesse : 3).
Le sac permet de cocher plusieurs catégories d’équipement ; les filtres
sont conservés avec le personnage, même si tout est décoché.

### V3.8.1 — sorts au rang 6

Tous les sorts de classe montent jusqu’au rang 6. Les améliorations coûtent
respectivement 1, 2, 3, 4 et 5 points, soit 15 points du rang 1 au rang 6.
Le bouton affiche le prix et bloque une amélioration sans assez de points.
Les anciens rangs restent acquis sans prélèvement rétroactif.

### V3.9 — équipement et vente

La comparaison montre les gains et pertes totaux, bonus de panoplie inclus,
avec un calcul séparé pour chaque emplacement d’anneau.
Un objet du sac ou porté peut être verrouillé ; cet état reste enregistré
après équipement, retrait et reconnexion. Le verrouillage empêche la vente.
La sélection multiple respecte les filtres ; les objets masqués et verrouillés
en sont exclus. Toute vente passe par une confirmation avec liste et montant
(5 kamas par objet). Une sélection modifiée depuis la confirmation bloque la vente.


V3.10.0: Complete monster selection catalogue from dofusdude/dofus3-main 3.7.4.4 (5,129 IDs, 446 nonempty zone groups). Subarea memberships are the union of the monster and subarea declarations in that pinned snapshot. Unplaced entries stay visible in the last group; quest monsters, summons and variants are intentionally included. Source SHA-256 hashes and release URL are in monster-catalogue.json. Rebuild with scripts/import-monster-catalogue.py and the four raw source files. Choices are private account-owned drafts in the existing durable save, preselect the 195 live monsters, and do not alter current combat. Character level is capped at 200, including save API validation and maximum-level XP displays.

V3.10.1: Exclude archmonsters, summons and quest monsters from the extension selection. The pinned source race/super-race classifications (20/27/28, plus summon race 334) and MonsterData flags (isMiniBoss bit 3, isQuestMonster bit 4, verified against DofusDB) remove 3,437 unique entries, leaving 1,692. Category totals overlap. Archived selections are cleaned and saved when opened; removed selections invalidate prior confirmation. Existing live combat and progression remain unchanged while preparing the extension.

V3.11.0: Apply the uploaded validated 688-ID selection (selected-monsters.json). game-world.json contains 270 nonempty source-zone groups, including 12 monsters without a source location in the explicit unplaced group. A monster appears in every declared source zone with one stable monster ID. All zones are freely accessible regardless of level or wins; the separate automatic-combat mastery requirement is retained. Exact grade-one source drops use independent per-object rolls and prospection, resources persist per account and are displayed in inventory, and conditional quest/profession/event drops remain visible but inactive. Fifteen selected records have no source drop entries. All supported equipment through level 200 and its set metadata are loaded; prior equipment and saves are preserved. Source XP thresholds replace the exponential curve while preserving current level and fractional XP once. Character cap remains 200. Rebuild with scripts/import-selected-world.py SOURCE_DIR SELECTION_JSON.
