/* Suivi de séances — logique de l'appli.
   Étape 1 : service worker (hors ligne + installation).
   Étape 2 : programme de départ + écran d'accueil. */
'use strict';

/* ---------- Programme de départ ---------- */

const CLE_DONNEES = 'suivi_donnees';
const VERSION_DONNEES = 1;

/**
 * Crée un exercice. repsMin/repsMax à null = « max ».
 * Options : unite ('reps' ou 's'), poidsDuCorps (poids saisi = lest ajouté), note.
 */
function exo(id, nom, series, repsMin, repsMax, poidsDefaut, options = {}) {
  return { id, nom, series, repsMin, repsMax, poidsDefaut, unite: 'reps', poidsDuCorps: false, note: '', ...options };
}

const PROGRAMME_DEPART = [
  {
    id: 'seance-1',
    nom: 'Push',
    exercices: [
      exo('dev-couche', 'Développé couché', 4, 8, 10, null),
      exo('dev-incline-halteres', 'Développé incliné haltères', 3, 10, 12, null),
      exo('dev-militaire', 'Développé militaire', 3, 8, 10, 14),
      exo('elevations-laterales', 'Élévations latérales', 3, 12, 15, 6, { note: '6 à 8 kg' }),
      exo('dips', 'Dips ou poulie triceps', 3, 8, 10, 20, { note: '20 kg aux dips' }),
      exo('extension-triceps-poulie', 'Extension triceps poulie haute', 3, 10, 12, 15),
    ],
  },
  {
    id: 'seance-2',
    nom: 'Pull',
    exercices: [
      exo('tirage-vertical', 'Tirage vertical', 4, 8, 10, 60),
      exo('rowing', 'Rowing barre ou poulie basse', 4, 10, 12, 50),
      exo('rdl', 'Soulevé de terre roumain (RDL)', 3, 8, 10, null),
      exo('face-pull', 'Face pull', 4, 10, 12, 12.5),
      exo('curl-barre', 'Curl biceps barre', 3, 10, 12, 35),
      exo('curl-marteau', 'Curl marteau', 3, 10, 12, 14),
    ],
  },
  {
    id: 'seance-3',
    nom: 'Legs + abdos',
    exercices: [
      exo('squat', 'Squat', 4, 8, 10, null),
      exo('presse', 'Presse à cuisses', 4, 10, 12, 130),
      exo('fentes-bulgares', 'Fentes bulgares', 3, 10, 10, 12, { note: 'par jambe' }),
      exo('leg-extension', 'Leg extension', 3, 10, 12, 70),
      exo('leg-curl', 'Leg curl', 4, 8, 10, 50),
      exo('mollets', 'Extension mollets', 4, 15, 20, 14),
      exo('gainage', 'Gainage planche', 3, 45, 60, null, { unite: 's', poidsDuCorps: true }),
    ],
  },
  {
    id: 'seance-4',
    nom: 'Push/Pull variation',
    exercices: [
      exo('dev-halteres', 'Développé haltères', 4, 8, 10, 22),
      exo('ecarte-poulie', 'Écarté poulie ou développé incliné barre', 3, 10, 12, null),
      exo('tirage-horizontal-uni', 'Tirage horizontal unilatéral', 4, 10, 12, 85),
      exo('elevations-frontales', 'Élévations frontales', 3, 12, 12, 8),
      exo('tractions-supination', 'Tractions supination', 3, null, null, null, { poidsDuCorps: true }),
      exo('curl-incline', 'Curl incliné', 3, 10, 12, 10),
    ],
  },
];

/* ---------- Données (localStorage) ---------- */

/** Données neuves : programme de départ, historique vide. */
function creerDonneesDepart() {
  return { version: VERSION_DONNEES, programme: JSON.parse(JSON.stringify(PROGRAMME_DEPART)), historique: [] };
}

/** Vérifie la forme générale des données lues. */
function donneesValides(d) {
  return d !== null && typeof d === 'object' && Number.isInteger(d.version)
    && Array.isArray(d.programme) && Array.isArray(d.historique)
    && d.programme.every((s) => s !== null && typeof s === 'object' && Array.isArray(s.exercices));
}

/** Met d'anciennes données au format actuel. Aucune migration pour l'instant. */
function migrer(donnees) {
  // Exemple futur : if (donnees.version === 1) { ...; donnees.version = 2; }
  return donnees;
}

/** Enregistre toutes les données d'un coup. Renvoie false si le stockage est plein ou bloqué. */
function ecrireDonnees(donnees) {
  try {
    localStorage.setItem(CLE_DONNEES, JSON.stringify(donnees));
    return true;
  } catch (erreur) {
    console.warn('Sauvegarde impossible :', erreur);
    return false;
  }
}

/** Met de côté des données illisibles (jamais effacées), puis repart du programme de départ. */
function recupererDonneesIllisibles(brut) {
  const donnees = creerDonneesDepart();
  try {
    localStorage.setItem(`suivi_illisible_${Date.now()}`, brut);
  } catch {
    // Pas de place pour la copie : on n'écrase rien
    return { donnees, enregistrable: false, alerte: 'Données illisibles et stockage plein : rien ne sera enregistré.' };
  }
  const enregistrable = ecrireDonnees(donnees);
  return { donnees, enregistrable, alerte: 'Données illisibles : copie mise de côté, programme de départ rechargé.' };
}

/**
 * Lit les données au démarrage. Premier lancement : programme de départ.
 * enregistrable = false quand une écriture risquerait d'écraser des données.
 */
function chargerDonnees() {
  let brut;
  try {
    brut = localStorage.getItem(CLE_DONNEES);
  } catch {
    return { donnees: creerDonneesDepart(), enregistrable: false, alerte: 'Stockage bloqué par le navigateur : rien ne sera enregistré.' };
  }

  if (brut === null) {
    const donnees = creerDonneesDepart();
    const enregistrable = ecrireDonnees(donnees);
    return { donnees, enregistrable, alerte: enregistrable ? '' : 'Stockage plein : rien ne sera enregistré.' };
  }

  let donnees;
  try {
    donnees = JSON.parse(brut);
  } catch {
    return recupererDonneesIllisibles(brut);
  }
  if (!donneesValides(donnees)) return recupererDonneesIllisibles(brut);
  if (donnees.version > VERSION_DONNEES) {
    return { donnees, enregistrable: false, alerte: 'Données d\'une version plus récente : recharge l\'appli pour la mettre à jour.' };
  }
  return { donnees: migrer(donnees), enregistrable: true, alerte: '' };
}

/* ---------- Affichage ---------- */

const ICONE_FLECHE = '<svg class="seance__fleche" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** "2026-10-13T18:30" → "13/10/2026" (chaîne vide si format inconnu). */
function formaterDate(iso) {
  const morceaux = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return morceaux ? `${morceaux[3]}/${morceaux[2]}/${morceaux[1]}` : '';
}

/** Date de la dernière fois qu'une séance a été faite, ou null. */
function derniereFois(historique, seanceId) {
  const dates = historique
    .filter((s) => s && s.seanceId === seanceId && typeof s.id === 'string')
    .map((s) => s.id)
    .sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/** Crée un élément avec une classe et un texte. */
function creer(balise, classe, texte = '') {
  const el = document.createElement(balise);
  el.className = classe;
  el.textContent = texte;
  return el;
}

/** Affiche un message en haut de l'écran (vide = le masque). */
function afficherMessage(texte) {
  const zone = document.getElementById('message');
  zone.textContent = texte;
  zone.hidden = !texte;
}

/** Bouton-carte d'une séance pour l'écran d'accueil. */
function creerBoutonSeance(seance, numero, historique) {
  const date = derniereFois(historique, seance.id);
  const nbExercices = seance.exercices.length;
  const infos = `${nbExercices} exercice${nbExercices > 1 ? 's' : ''} · `
    + (date ? `Dernière fois : ${formaterDate(date)}` : 'Pas encore faite');

  const textes = creer('span', 'seance__textes');
  textes.append(
    creer('span', 'seance__numero', `Séance ${numero}`),
    creer('span', 'seance__nom', seance.nom),
    creer('span', 'seance__infos', infos),
  );

  const bouton = creer('button', 'seance');
  bouton.type = 'button';
  bouton.dataset.seance = seance.id;
  bouton.append(textes);
  bouton.insertAdjacentHTML('beforeend', ICONE_FLECHE);
  return bouton;
}

/** Écran d'accueil : les séances du programme. */
function afficherAccueil(donnees) {
  const liste = document.getElementById('liste-seances');
  liste.replaceChildren(...donnees.programme.map((seance, i) => {
    const item = document.createElement('li');
    item.append(creerBoutonSeance(seance, i + 1, donnees.historique));
    return item;
  }));
}

/* ---------- Service worker ---------- */

const statutHorsLigne = document.getElementById('statut-hors-ligne');

/** Affiche un court message d'état en bas de page. */
function afficherStatut(message) {
  if (statutHorsLigne) statutHorsLigne.textContent = message;
}

/** Enregistre le service worker qui garde l'appli en cache. */
async function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    afficherStatut('Mode hors ligne non disponible sur ce navigateur.');
    return;
  }
  try {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready; // résolu une fois le cache rempli
    afficherStatut('Appli prête hors ligne.');
  } catch (erreur) {
    // Cas typique : page ouverte en HTTP (hors localhost) ou en navigation privée
    console.warn('Service worker non enregistré :', erreur);
    afficherStatut('Mode hors ligne indisponible (HTTPS requis).');
  }
}

/* ---------- Démarrage ---------- */

const etat = chargerDonnees();
afficherMessage(etat.alerte);
afficherAccueil(etat.donnees);

// L'écran de séance arrive à l'étape 3
document.getElementById('liste-seances').addEventListener('click', (evenement) => {
  if (evenement.target.closest('.seance')) afficherMessage('L\'écran de séance arrive à l\'étape 3.');
});

enregistrerServiceWorker();
