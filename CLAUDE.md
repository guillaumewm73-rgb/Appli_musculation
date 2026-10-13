# CLAUDE.md — Suivi de séances (Keepcool)

## Objectif
Construire une web app mobile (PWA) pour suivre mes séances de musculation : cocher les séries, noter poids et répétitions, voir ma progression. Usage principal : sur mon téléphone, pendant la séance, une main, en salle.

Le projet doit rester simple, rapide à ouvrir et utilisable sans connexion.

## Utilisateur
- Guillaume, 19 ans, prise de masse, 4 séances par semaine à Keepcool (Chambéry).
- Interface en français. Poids en kg. Dates au format JJ/MM/AAAA.
- Je veux des réponses courtes, concrètes et orientées action. Pas de jargon inutile.

## Contraintes techniques (à respecter)
- HTML + CSS + JavaScript vanilla. Pas de framework, pas de build, pas de dépendance externe.
- Un dossier avec : `index.html`, `style.css`, `app.js`, `manifest.webmanifest`, `sw.js`, `icons/`.
- Stockage local via `localStorage` (clés préfixées `suivi_`). Aucune donnée envoyée à un serveur, sauf la discussion avec Sam (voir plus bas), uniquement quand Guillaume pose une question.
- Fonctionne hors ligne grâce à un service worker (cache de l'appli).
- Installable sur l'écran d'accueil (manifest + icônes 192 et 512 px).
- Mobile first : gros boutons (min 44 px), texte lisible, thème sombre par défaut.
- Accessible : labels sur les champs, contrastes suffisants, focus visible.
- Code lisible, commenté en français quand c'est utile. Fonctions courtes.

## Style visuel
Suivre `DESIGN.md` : base Mercury (fond onyx, cartes graphite, texte ivoire, contrôles en pilule) + v2 demandée par Guillaume : une couleur par séance, halo coloré, animations et effets au défilement (désactivés si « Réduire les animations »). Une seule action principale par écran. Les jetons sont en tête de `style.css`.

## Programme de départ
Données initiales à charger au premier lancement (mises à jour par Guillaume le 13/10/2026). Les poids sont ceux de ses dernières séances ; ils sont modifiables dans l'appli. Un champ vide signifie : je saisis moi-même. Dans l'appli, Programme → « Remettre le programme de départ » recharge ce programme en gardant l'historique.

### Séance 1 — Push (pectoraux, épaules, triceps)
| Exercice | Séries × reps | Poids de départ |
|---|---|---|
| Développé couché | 4 × 8-10 | |
| Développé incliné haltères | 3 × 10-12 | 20 kg |
| Développé militaire ou élévations latérales (au choix) | 3 × 8 | 8 kg |
| Dips ou poulie triceps | 3 × 8-10 | 15 kg |
| Extension triceps poulie haute | 3 × 10-12 | 15 kg |
| Pectoral machine (facultatif) | 3 × 8 | 45 kg |

### Séance 2 — Pull (dos, biceps)
| Exercice | Séries × reps | Poids de départ |
|---|---|---|
| Tirage vertical | 4 × 8-10 | 45 kg |
| Rowing barre ou poulie basse | 4 × 10-12 | 75 kg |
| Soulevé de terre roumain (RDL) | 3 × 8-10 | |
| Face pull | 4 × 10-12 | |
| Curl biceps barre | 3 × 10-12 | |
| Curl marteau | 3 × 8 | 14 kg |

### Séance 3 — Legs + abdos
| Exercice | Séries × reps | Poids de départ |
|---|---|---|
| Pistol squat | 4 × 6-8 par jambe | poids du corps |
| Presse à cuisses | 4 × 10-12 | 130 kg (→ 100 kg) |
| Fentes bulgares | 3 × 10 par jambe | 8 kg |
| Leg extension | 3 × 10-12 | 80 kg |
| Leg curl | 4 × 8-10 | 50 kg |
| Extension mollets | 4 × 15-20 | 14 kg |
| Abdos poulie | 3 × 20 | 20 kg |

### Séance 4 — Push/Pull variation
| Exercice | Séries × reps | Poids de départ |
|---|---|---|
| Développé haltères | 4 × 8-10 | 20 kg |
| Écarté poulie ou développé incliné barre | 3 × 10-12 | 5 kg |
| Tirage horizontal unilatéral | 4 × 10-12 | 75 kg |
| Élévations frontales ou delts machine (au choix) | 3 × 12 | 8 kg (20 kg à la machine) |
| Tractions supination | 3 × max | poids du corps |
| Curl incliné | 3 × 10-12 | 10 kg |

## Fonctionnalités — version 1 (MVP)
1. **Écran d'accueil** : les 4 séances en gros boutons, avec la date de la dernière fois.
2. **Écran de séance** : liste des exercices. Pour chaque série, saisir poids et reps, puis cocher. Les valeurs de la dernière séance sont pré-remplies.
3. **Terminer la séance** : enregistre la date, la durée et toutes les séries dans l'historique.
4. **Historique** : liste des séances passées, consultable et supprimable.
5. **Progression** : pour un exercice choisi, courbe simple du meilleur poids dans le temps (canvas ou SVG maison, pas de librairie).
6. **Édition du programme** : ajouter, retirer, renommer ou réordonner un exercice, changer les séries et reps cibles.
7. **Export / import JSON** : sauvegarde et restauration de toutes les données (indispensable car tout est local).

## Sam, le coach (validé par Guillaume le 13/10/2026)
- **Conseils locaux** (hors ligne, rien ne sort du téléphone) : charge à monter/garder/baisser (règle +2 kg polyarticulaire, +1 kg isolation quand le haut de fourchette est atteint partout ; baisse si sous le bas de fourchette deux séances de suite ; stagnation sur 3 séances), repos conseillé par exercice, équilibre du programme (séries par muscle, repère 10-20), exercices souvent sautés, records, régularité, astuce du jour. Dans la séance : repos + conseil avec bouton « Appliquer ».
- **Discussion IA** : API Claude appelée depuis le navigateur (`fetch`, pas de SDK car ni dépendance ni build), modèle `claude-haiku-5-5` (choisi par Guillaume), effort `medium`. Envoie le prénom, le programme, les séances des 12 dernières semaines et les analyses locales. Conversation en ajout seul (consignes figées par discussion, blocs de réflexion renvoyés tels quels).
- Clé API dans `suivi_sam_cle`, discussion dans `suivi_sam_discussion` : hors de `suivi_donnees`, donc jamais exportées.
- **« Demander à Claude »** (action principale de l'écran Sam, choisie par Guillaume) : copie dans le presse-papiers les consignes de Sam + ses données, puis ouvre claude.ai. Guillaume colle et pose sa question avec son forfait Claude Pro : pas d'API, rien n'est envoyé par l'appli. Si la copie échoue, le texte s'affiche à copier à la main.

## Ajouts après l'analyse des applis concurrentes (13/10/2026)
- **Minuteur de repos** : démarre quand une série est cochée (durée = repos conseillé par Sam : 2 min 30 polyarticulaire lourd, 1 min 45 autre polyarticulaire, 1 min 15 isolation), ±15 s, « Passer », bips + vibration (Android). L'écran reste allumé pendant une séance (Wake Lock).
- **Échauffement et disques** dans chaque exercice chargé : séries à 50/70/85 %, disques par côté (barre 20/15/10 kg).
- **Progression** : choix de la mesure (meilleur poids, 1RM estimé par Epley, volume) + **carte du corps** (séries faites depuis lundi par muscle, une seule teinte en 4 niveaux, liste chiffrée).
- **Mon corps** : poids de corps (une pesée par jour), courbe, rythme sur 4 semaines et conseil de Sam (repère prise de masse : +0,25 à +0,5 kg/semaine).
- Décision de données (validée par Guillaume) : `poidsCorps` = liste `{ date: "AAAA-MM-JJ", poids }` dans `suivi_donnees`, incluse dans l'export et vérifiée à l'import.

## Fonctionnalités — version 2 (plus tard, ne pas faire d'office)
- Notes par séance (fatigue, sommeil, douleurs).

## Modèle de données (proposition)
```json
{
  "version": 1,
  "programme": [
    {
      "id": "seance-1",
      "nom": "Push",
      "exercices": [
        { "id": "dev-couche", "nom": "Développé couché", "series": 4, "repsMin": 8, "repsMax": 10, "poidsDefaut": null, "unite": "reps", "poidsDuCorps": false, "note": "" }
      ]
    }
  ],
  "historique": [
    {
      "id": "2026-10-13T18:30",
      "seanceId": "seance-1",
      "dureeMin": 62,
      "exercices": [
        { "exerciceId": "dev-couche", "series": [ { "poids": 60, "reps": 10, "fait": true } ] }
      ]
    }
  ]
}
```
Garder un champ `version` pour pouvoir migrer les données plus tard.

Décisions validées (étape 2) :
- Tout est stocké dans une seule clé `suivi_donnees` (programme + historique).
- `unite` : `"reps"` ou `"s"` (gainage). `poidsDuCorps` : le poids saisi = lest ajouté. `note` : précision courte (« par jambe »). `repsMin`/`repsMax` à `null` = « max ».

Décisions validées (étape 3) :
- L'historique garde seulement les identifiants (`seanceId`, `exerciceId`), pas de copie des noms.
- Exercice jamais fait : poids de départ pré-rempli, reps vides (objectif affiché en gris).
- Séance en cours : champ optionnel `enCours` dans `suivi_donnees` (même format qu'une entrée d'historique, plus `debut` et `derniereAction` en ms). Enregistrée à chaque saisie, reprise automatiquement à l'ouverture. Durée = du début à la dernière saisie.

Décisions (étapes 6-7) :
- `derniereSauvegarde` (ms, optionnel) dans `suivi_donnees` : date du dernier export.
- Import = remplacement complet, après vérification de tout le fichier et confirmation. Copie de secours des données remplacées dans `suivi_avant_import`, restaurable depuis l'écran Sauvegarde.

## Étapes de développement
1. Structure du projet + manifest + service worker + page d'accueil vide qui s'installe.
2. Chargement du programme de départ + écran d'accueil.
3. Écran de séance : saisie, cases à cocher, enregistrement.
4. Historique.
5. Progression (courbe).
6. Édition du programme.
7. Export / import JSON.
8. Finitions : thème, icônes, test hors ligne, test d'installation.

Après chaque étape : montre ce qui marche, dis comment le tester, puis passe à la suivante.

## Façon de travailler
- Commence par proposer un plan court, puis code l'étape 1 uniquement.
- Ne fais pas de refactoring ni de fonctionnalité que je n'ai pas demandé.
- Si un choix est important (stockage, structure des données), explique-le en 2 phrases et demande-moi.
- Teste mentalement les cas limites : séance interrompue, champ vide, données corrompues, stockage plein.
- Ne casse jamais les données existantes : toute modification du format passe par une migration.
- Pas de collecte de données ni de traceurs.

## Lancer en local
```
npx serve .
```
Puis ouvrir l'adresse affichée. Pour tester l'installation sur téléphone, l'appli doit être servie en HTTPS.

## Publication (quand la v1 est prête)
Hébergement statique gratuit : GitHub Pages, Netlify ou Cloudflare Pages. Ouvrir l'adresse sur le téléphone, puis « Ajouter à l'écran d'accueil ».

## Critères de réussite
- Je peux faire une séance complète en moins de 10 interactions par exercice.
- L'appli s'ouvre en moins de 2 secondes et marche sans réseau.
- Je ne perds aucune donnée en fermant l'appli ou en rechargeant la page.
