/* Suivi de séances — logique de l'appli.
   Étape 1 : service worker (hors ligne + installation).
   Étape 2 : programme de départ + écran d'accueil.
   Étape 3 : écran de séance (saisie, cases à cocher, enregistrement).
   Étape 4 : historique (liste, détail, suppression).
   Étape 5 : progression (courbe SVG du meilleur poids).
   Étape 6 : édition du programme.
   Étape 7 : export / import JSON. */
'use strict';

/* ---------- Programme de départ ---------- */

const CLE_DONNEES = 'suivi_donnees';
const CLE_AVANT_IMPORT = 'suivi_avant_import'; // copie de secours faite juste avant un import
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
  migrer(donnees);
  if (donnees.enCours != null && !seanceEnCoursValide(donnees.enCours)) {
    // Séance en cours abîmée : on l'ignore, le programme et l'historique restent intacts
    delete donnees.enCours;
    return { donnees, enregistrable: true, alerte: 'Séance en cours illisible : ignorée.' };
  }
  return { donnees, enregistrable: true, alerte: '' };
}

/* ---------- Outils ---------- */

const ICONE_FLECHE = '<svg class="seance__fleche" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONE_HAUT = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONE_BAS = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONE_COCHE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** "2026-10-13T18:30" → "13/10/2026" (chaîne vide si format inconnu). */
function formaterDate(iso) {
  const morceaux = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return morceaux ? `${morceaux[3]}/${morceaux[2]}/${morceaux[1]}` : '';
}

function deuxChiffres(n) {
  return String(n).padStart(2, '0');
}

/** Heure locale « 18:30 » d'un horodatage en millisecondes. */
function formaterHeure(ms) {
  const d = new Date(ms);
  return `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`;
}

/** Identifiant d'historique = date et heure locales de début : « 2026-10-13T18:30 ». */
function idSeance(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}T${formaterHeure(ms)}`;
}

/** Évite deux séances avec le même identifiant (même minute). */
function idUnique(base) {
  const pris = new Set(etat.donnees.historique.map((s) => s && s.id));
  let id = base;
  for (let n = 2; pris.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** 12.5 → « 12,5 » ; null → « ». */
function formaterNombre(n) {
  return n === null || n === undefined ? '' : String(n).replace('.', ',');
}

/** Poids saisi (« 12,5 ») → nombre ; null si vide ; NaN si invalide. */
function lirePoids(texte) {
  const propre = texte.trim().replace(',', '.');
  if (propre === '') return null;
  const n = Number(propre);
  return Number.isFinite(n) && n >= 0 && n < 1000 ? n : NaN;
}

/** Reps (ou secondes) saisies → entier ; null si vide ; NaN si invalide. */
function lireReps(texte) {
  const propre = texte.trim();
  if (propre === '') return null;
  return /^\d{1,4}$/.test(propre) ? Number(propre) : NaN;
}

/** Objectif de reps : « 8-10 », « 12 » ou « max ». */
function texteReps(exercice) {
  const { repsMin, repsMax } = exercice;
  if (repsMin === null || repsMin === undefined) return 'max';
  return repsMax === null || repsMax === undefined || repsMax === repsMin ? `${repsMin}` : `${repsMin}-${repsMax}`;
}

/** Objectif complet : « 4 × 8-10 reps · par jambe ». */
function texteCible(exercice) {
  const reps = texteReps(exercice);
  const unite = reps === 'max' ? '' : (exercice.unite === 's' ? ' s' : ' reps');
  return `${exercice.series} × ${reps}${unite}${exercice.note ? ` · ${exercice.note}` : ''}`;
}

/** Crée un élément avec une classe et un texte. */
function creer(balise, classe, texte = '') {
  const el = document.createElement(balise);
  if (classe) el.className = classe;
  el.textContent = texte;
  return el;
}

/** Affiche un message en haut de l'écran (vide = le masque). */
function afficherMessage(texte) {
  const zone = document.getElementById('message');
  zone.textContent = texte;
  zone.hidden = !texte;
}

/* ---------- Séance en cours ---------- */

function trouverSeance(seanceId) {
  return etat.donnees.programme.find((s) => s.id === seanceId);
}

function trouverExercice(seance, exerciceId) {
  return seance ? seance.exercices.find((e) => e && e.id === exerciceId) : undefined;
}

/** Séries de la dernière séance enregistrée qui contient cet exercice, ou null. */
function dernieresSeries(exerciceId) {
  let series = null;
  let idTrouve = '';
  for (const entree of etat.donnees.historique) {
    if (!entree || typeof entree.id !== 'string' || !Array.isArray(entree.exercices) || entree.id < idTrouve) continue;
    const ex = entree.exercices.find((e) => e && e.exerciceId === exerciceId && Array.isArray(e.series) && e.series.length);
    if (ex) {
      series = ex.series;
      idTrouve = entree.id;
    }
  }
  return series;
}

/** Valeurs de départ : celles de la dernière fois, sinon poids de départ et reps vides. */
function preRemplirSeries(exercice) {
  const avant = dernieresSeries(exercice.id);
  return Array.from({ length: exercice.series }, (_, i) => {
    if (!avant) return { poids: exercice.poidsDefaut ?? null, reps: null, fait: false };
    const s = avant[Math.min(i, avant.length - 1)] || {};
    return { poids: s.poids ?? null, reps: s.reps ?? null, fait: false };
  });
}

/** Nouvelle séance en cours, au même format qu'une entrée d'historique. */
function creerSeanceEnCours(seance) {
  const maintenant = Date.now();
  return {
    seanceId: seance.id,
    debut: maintenant,
    derniereAction: maintenant,
    exercices: seance.exercices.filter(Boolean).map((ex) => ({ exerciceId: ex.id, series: preRemplirSeries(ex) })),
  };
}

function seanceEnCoursValide(e) {
  return typeof e === 'object' && typeof e.seanceId === 'string'
    && Number.isFinite(e.debut) && Number.isFinite(e.derniereAction) && Array.isArray(e.exercices)
    && e.exercices.every((ex) => ex && Array.isArray(ex.series) && ex.series.every((s) => s && typeof s === 'object'));
}

/** Séries faites et total d'une séance (en cours ou de l'historique). */
function compterSeries(seance) {
  let faites = 0;
  let total = 0;
  for (const ex of seance.exercices) {
    for (const s of ex.series) {
      total++;
      if (s.fait) faites++;
    }
  }
  return { faites, total };
}

/** Enregistre l'état courant. Renvoie false si rien n'a pu être écrit. */
function enregistrer() {
  if (!etat.enregistrable) return false;
  if (ecrireDonnees(etat.donnees)) return true;
  afficherMessage('Stockage plein : la dernière saisie n\'est pas enregistrée.');
  return false;
}

/* ---------- Écrans ---------- */

const ECRANS = ['accueil', 'seance', 'historique', 'detail', 'progression', 'programme', 'exercice', 'sauvegarde'];

/** Affiche un écran : titre, bouton retour, focus pour les lecteurs d'écran. */
function montrerEcran(nom, titre, libelleRetour = 'Retour à l\'accueil') {
  for (const ecran of ECRANS) document.getElementById(`ecran-${ecran}`).hidden = ecran !== nom;
  const retour = document.getElementById('bouton-retour');
  retour.hidden = nom === 'accueil';
  retour.setAttribute('aria-label', libelleRetour);
  etat.ecran = nom;
  const h1 = document.getElementById('titre-ecran');
  h1.textContent = titre;
  window.scrollTo(0, 0);
  h1.focus({ preventScroll: true });
}

/** Bouton-carte d'une séance pour l'écran d'accueil. */
function creerBoutonSeance(seance, numero) {
  const { historique, enCours } = etat.donnees;
  const nbExercices = seance.exercices.length;
  let quand;
  if (enCours && enCours.seanceId === seance.id) {
    quand = `En cours depuis ${formaterHeure(enCours.debut)}`;
  } else {
    const date = derniereFois(historique, seance.id);
    quand = date ? `Dernière fois : ${formaterDate(date)}` : 'Pas encore faite';
  }

  const bouton = creerBoutonCarte(`Séance ${numero}`, seance.nom, `${nbExercices} exercice${nbExercices > 1 ? 's' : ''} · ${quand}`);
  bouton.dataset.seance = seance.id;
  return bouton;
}

/** Carte cliquable à trois lignes (petit texte, nom, infos) avec flèche. */
function creerBoutonCarte(haut, nom, infos) {
  const textes = creer('span', 'seance__textes');
  textes.append(
    creer('span', 'seance__numero', haut),
    creer('span', 'seance__nom', nom),
    creer('span', 'seance__infos', infos),
  );
  const bouton = creer('button', 'seance');
  bouton.type = 'button';
  bouton.append(textes);
  bouton.insertAdjacentHTML('beforeend', ICONE_FLECHE);
  return bouton;
}

/** Date de la dernière fois qu'une séance a été faite, ou null. */
function derniereFois(historique, seanceId) {
  const dates = historique
    .filter((s) => s && s.seanceId === seanceId && typeof s.id === 'string')
    .map((s) => s.id)
    .sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/** Écran d'accueil : les séances du programme. */
function afficherAccueil() {
  document.getElementById('liste-seances').replaceChildren(...etat.donnees.programme.map((seance, i) => {
    const item = document.createElement('li');
    item.append(creerBoutonSeance(seance, i + 1));
    return item;
  }));
  montrerEcran('accueil', 'Suivi');
}

/** Champ texte poids ou reps, avec le bon clavier sur téléphone. */
function creerChamp(champ, valeur, clavier, indice, libelle) {
  const input = document.createElement('input');
  input.className = 'champ';
  input.type = 'text';
  input.inputMode = clavier;
  input.autocomplete = 'off';
  input.value = valeur;
  input.placeholder = indice;
  input.dataset.champ = champ;
  input.setAttribute('aria-label', libelle);
  return input;
}

/** Ligne d'une série : numéro, poids, reps, case « fait ». */
function creerLigneSerie(exercice, serie, i, j) {
  const ligne = creer('div', 'serie');
  ligne.dataset.exercice = i;
  ligne.dataset.serie = j;
  const prefixe = `${exercice.nom}, série ${j + 1}`;
  const libellePoids = `${prefixe}, ${exercice.poidsDuCorps ? 'lest' : 'poids'} en kg`;
  const libelleReps = `${prefixe}, ${exercice.unite === 's' ? 'secondes' : 'répétitions'}`;

  const caseFait = document.createElement('input');
  caseFait.type = 'checkbox';
  caseFait.checked = serie.fait === true;
  caseFait.dataset.champ = 'fait';
  caseFait.setAttribute('aria-label', `${prefixe} faite`);
  const coche = creer('label', 'coche');
  coche.append(caseFait);
  coche.insertAdjacentHTML('beforeend', `<span class="coche__boite" aria-hidden="true">${ICONE_COCHE}</span>`);

  ligne.append(
    creer('span', 'serie__numero', String(j + 1)),
    creerChamp('poids', formaterNombre(serie.poids), 'decimal', exercice.poidsDuCorps ? '0' : 'kg', libellePoids),
    creerChamp('reps', formaterNombre(serie.reps), 'numeric', texteReps(exercice), libelleReps),
    coche,
  );
  return ligne;
}

/** Carte d'un exercice avec ses séries. */
function creerCarteExercice(exEnCours, i, definition) {
  const exercice = definition || {
    nom: 'Exercice retiré du programme', series: exEnCours.series.length,
    repsMin: null, repsMax: null, unite: 'reps', poidsDuCorps: false, note: '',
  };
  const titre = creer('h2', 'exercice__nom', exercice.nom);
  titre.id = `exercice-${i}`;

  const entete = creer('div', 'series__entete');
  entete.setAttribute('aria-hidden', 'true');
  entete.append(
    creer('span', '', 'Série'),
    creer('span', '', exercice.poidsDuCorps ? 'Lest kg' : 'kg'),
    creer('span', '', exercice.unite === 's' ? 'Secondes' : 'Reps'),
    creer('span', '', 'Fait'),
  );

  const series = creer('div', 'series');
  series.append(entete, ...exEnCours.series.map((serie, j) => creerLigneSerie(exercice, serie, i, j)));

  const carte = creer('article', 'carte exercice');
  carte.setAttribute('aria-labelledby', titre.id);
  carte.append(titre, creer('p', 'exercice__cible', texteCible(exercice)), series);
  return carte;
}

/** Écran de séance : exercices, séries, boutons Terminer / Abandonner. */
function afficherSeance() {
  const enCours = etat.donnees.enCours;
  const seance = trouverSeance(enCours.seanceId);
  const numero = etat.donnees.programme.indexOf(seance) + 1;

  const info = creer('p', 'texte-secondaire', `${numero > 0 ? `Séance ${numero} · ` : ''}commencée à ${formaterHeure(enCours.debut)}`);
  const cartes = enCours.exercices.map((ex, i) => creerCarteExercice(ex, i, trouverExercice(seance, ex.exerciceId)));

  const terminer = creer('button', 'bouton bouton--principal', 'Terminer la séance');
  terminer.type = 'button';
  terminer.dataset.action = 'terminer';
  const abandonner = creer('button', 'bouton bouton--secondaire', 'Abandonner la séance');
  abandonner.type = 'button';
  abandonner.dataset.action = 'abandonner';
  const actions = creer('div', 'actions');
  actions.append(terminer, abandonner);

  document.getElementById('ecran-seance').replaceChildren(info, ...cartes, actions);
  montrerEcran('seance', seance ? seance.nom : 'Séance');
}

/* ---------- Actions ---------- */

/** Ouvre une séance : reprend celle en cours ou en commence une nouvelle. */
function ouvrirSeance(seanceId) {
  const seance = trouverSeance(seanceId);
  const enCours = etat.donnees.enCours;
  if (!seance) return;
  if (!enCours || enCours.seanceId !== seanceId) {
    const autre = enCours && trouverSeance(enCours.seanceId);
    if (enCours && !confirm(`La séance ${autre ? autre.nom : ''} est en cours. L'abandonner pour commencer ${seance.nom} ?`)) return;
    etat.donnees.enCours = creerSeanceEnCours(seance);
    enregistrer();
  }
  afficherMessage('');
  afficherSeance();
}

/** Recopie un nouveau poids sur les séries suivantes non cochées qui avaient le même poids. */
function propagerPoids(series, i, j, ancien, nouveau) {
  for (let k = j + 1; k < series.length; k++) {
    if (series[k].fait || series[k].poids !== ancien) continue;
    series[k].poids = nouveau;
    const champ = document.querySelector(`.serie[data-exercice="${i}"][data-serie="${k}"] [data-champ="poids"]`);
    if (champ) champ.value = formaterNombre(nouveau);
  }
}

/** Saisie dans un champ poids ou reps : enregistrée à chaque frappe. */
function saisirValeur(input) {
  const ligne = input.closest('.serie');
  const i = Number(ligne.dataset.exercice);
  const j = Number(ligne.dataset.serie);
  const series = etat.donnees.enCours.exercices[i].series;
  const champ = input.dataset.champ;
  const valeur = champ === 'poids' ? lirePoids(input.value) : lireReps(input.value);

  if (Number.isNaN(valeur)) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');

  const ancienne = series[j][champ] ?? null;
  const nouvelle = Number.isNaN(valeur) ? null : valeur;
  series[j][champ] = nouvelle;
  if (champ === 'poids') propagerPoids(series, i, j, ancienne, nouvelle);
  etat.donnees.enCours.derniereAction = Date.now();
  enregistrer();
}

/** Coche ou décoche une série. */
function cocherSerie(caseFait) {
  const ligne = caseFait.closest('.serie');
  const serie = etat.donnees.enCours.exercices[Number(ligne.dataset.exercice)].series[Number(ligne.dataset.serie)];
  serie.fait = caseFait.checked;
  etat.donnees.enCours.derniereAction = Date.now();
  enregistrer();
}

/** Enregistre la séance dans l'historique puis revient à l'accueil. */
function terminerSeance() {
  const { donnees } = etat;
  const enCours = donnees.enCours;
  const { faites, total } = compterSeries(enCours);
  if (faites === 0) {
    alert('Coche au moins une série avant de terminer.');
    return;
  }
  const restantes = total - faites;
  const pluriel = restantes > 1 ? 's' : '';
  if (restantes > 0 && !confirm(`${restantes} série${pluriel} non cochée${pluriel}. Terminer quand même ?`)) return;

  // Durée = du début à la dernière série saisie (juste même si on appuie sur Terminer plus tard)
  const entree = {
    id: idUnique(idSeance(enCours.debut)),
    seanceId: enCours.seanceId,
    dureeMin: Math.round((enCours.derniereAction - enCours.debut) / 60000),
    exercices: enCours.exercices,
  };
  donnees.historique.push(entree);
  delete donnees.enCours;
  if (etat.enregistrable && !ecrireDonnees(donnees)) {
    // On remet tout comme avant : la séance reste en cours, rien n'est perdu
    donnees.historique.pop();
    donnees.enCours = enCours;
    alert('Stockage de l\'appli plein : séance non enregistrée.');
    return;
  }

  const seance = trouverSeance(entree.seanceId);
  const nom = seance ? seance.nom : 'Séance';
  afficherAccueil();
  afficherMessage(etat.enregistrable
    ? `${nom} enregistrée : ${entree.dureeMin} min.`
    : `${nom} terminée mais non enregistrée (stockage indisponible).`);
}

function abandonnerSeance() {
  if (!confirm('Abandonner cette séance ? Rien ne sera ajouté à l\'historique.')) return;
  delete etat.donnees.enCours;
  enregistrer();
  afficherMessage('');
  afficherAccueil();
}

/** Retour à l'accueil. La séance reste en cours si une série est cochée. */
function retourAccueil() {
  const enCours = etat.donnees.enCours;
  if (enCours && compterSeries(enCours).faites === 0) {
    delete etat.donnees.enCours;
    enregistrer();
  }
  afficherMessage('');
  afficherAccueil();
}

/* ---------- Historique ---------- */

/** Nom d'une séance du programme, ou repli si elle a été retirée. */
function nomSeance(seanceId) {
  const seance = trouverSeance(seanceId);
  return seance ? seance.nom : 'Séance retirée du programme';
}

/** Cherche un exercice dans tout le programme (identifiants uniques). */
function trouverExerciceDansProgramme(exerciceId) {
  for (const seance of etat.donnees.programme) {
    const exercice = trouverExercice(seance, exerciceId);
    if (exercice) return exercice;
  }
  return undefined;
}

/** "2026-10-13T18:30" → "18:30" (vide si format inconnu). */
function heureDepuisId(id) {
  const morceaux = /T(\d{2}:\d{2})/.exec(String(id));
  return morceaux ? morceaux[1] : '';
}

/** Entrées lisibles de l'historique, la plus récente en premier. */
function entreesHistorique() {
  return etat.donnees.historique
    .filter((e) => e && typeof e.id === 'string' && Array.isArray(e.exercices)
      && e.exercices.every((ex) => ex && Array.isArray(ex.series) && ex.series.every((s) => s && typeof s === 'object')))
    .sort((a, b) => (a.id < b.id ? 1 : -1));
}

function texteDuree(entree) {
  return Number.isFinite(entree.dureeMin) ? `${entree.dureeMin} min` : '';
}

/** Écran Historique : une carte par séance passée. */
function afficherHistorique() {
  const entrees = entreesHistorique();
  const ecran = document.getElementById('ecran-historique');
  if (!entrees.length) {
    ecran.replaceChildren(creer('p', 'texte-secondaire', 'Aucune séance enregistrée pour l\'instant.'));
  } else {
    const liste = creer('ul', 'liste-seances');
    liste.setAttribute('aria-label', 'Séances passées');
    liste.append(...entrees.map((entree) => {
      const { faites, total } = compterSeries(entree);
      const heure = heureDepuisId(entree.id);
      const infos = [texteDuree(entree), `${faites}/${total} série${total > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
      const bouton = creerBoutonCarte(`${formaterDate(entree.id)}${heure ? ` · ${heure}` : ''}`, nomSeance(entree.seanceId), infos);
      bouton.dataset.entree = entree.id;
      const item = document.createElement('li');
      item.append(bouton);
      return item;
    }));
    ecran.replaceChildren(liste);
  }
  montrerEcran('historique', 'Historique');
}

/** « 60 kg × 10 reps », « PDC + 10 kg × 8 reps », « PDC × 45 s ». */
function texteSerie(exercice, serie) {
  const poids = typeof serie.poids === 'number' ? `${formaterNombre(serie.poids)} kg` : '';
  const charge = exercice.poidsDuCorps ? (poids ? `PDC + ${poids}` : 'PDC') : (poids || '– kg');
  const unite = exercice.unite === 's' ? 's' : 'reps';
  const reps = typeof serie.reps === 'number' ? `${serie.reps} ${unite}` : `– ${unite}`;
  return `${charge} × ${reps}`;
}

/** Carte d'un exercice passé : une ligne par série. */
function creerCarteDetail(exHistorique) {
  const exercice = trouverExerciceDansProgramme(exHistorique.exerciceId)
    || { nom: 'Exercice retiré du programme', unite: 'reps', poidsDuCorps: false };
  const liste = creer('ol', 'detail-series');
  liste.append(...exHistorique.series.map((serie, j) => {
    const ligne = creer('li', serie.fait ? 'detail-serie' : 'detail-serie detail-serie--non-faite');
    ligne.append(
      creer('span', 'serie__numero', String(j + 1)),
      creer('span', '', texteSerie(exercice, serie)),
      creer('span', 'detail-serie__etat', serie.fait ? '' : 'non faite'),
    );
    return ligne;
  }));
  const carte = creer('article', 'carte');
  carte.append(creer('h2', 'exercice__nom', exercice.nom), liste);
  return carte;
}

/** Détail d'une séance passée, avec le bouton Supprimer. */
function afficherDetail(entreeId) {
  const entree = entreesHistorique().find((e) => e.id === entreeId);
  if (!entree) {
    afficherHistorique();
    return;
  }
  const heure = heureDepuisId(entree.id);
  const duree = texteDuree(entree);
  const info = creer('p', 'texte-secondaire', `${formaterDate(entree.id)}${heure ? ` à ${heure}` : ''}${duree ? ` · ${duree}` : ''}`);

  const supprimer = creer('button', 'bouton bouton--secondaire', 'Supprimer cette séance');
  supprimer.type = 'button';
  supprimer.dataset.supprimer = entree.id;
  const actions = creer('div', 'actions');
  actions.append(supprimer);

  document.getElementById('ecran-detail').replaceChildren(info, ...entree.exercices.map(creerCarteDetail), actions);
  montrerEcran('detail', nomSeance(entree.seanceId), 'Retour à l\'historique');
}

/** Supprime une séance passée après confirmation. */
function supprimerEntree(entreeId) {
  const { historique } = etat.donnees;
  const index = historique.findIndex((e) => e && e.id === entreeId);
  if (index < 0) return;
  const entree = historique[index];
  if (!confirm(`Supprimer la séance ${nomSeance(entree.seanceId)} du ${formaterDate(entree.id)} ? C'est définitif.`)) return;

  historique.splice(index, 1);
  if (etat.enregistrable && !ecrireDonnees(etat.donnees)) {
    historique.splice(index, 0, entree); // rien n'a changé
    alert('Stockage de l\'appli plein : suppression impossible.');
    return;
  }
  afficherHistorique();
  afficherMessage(etat.enregistrable
    ? `Séance du ${formaterDate(entree.id)} supprimée.`
    : `Séance du ${formaterDate(entree.id)} supprimée de l'écran, mais pas du stockage (indisponible).`);
}

/** Bouton retour de la barre du haut : dépend de l'écran affiché. */
function retour() {
  afficherMessage('');
  if (etat.ecran === 'seance') retourAccueil();
  else if (etat.ecran === 'detail') afficherHistorique();
  else if (etat.ecran === 'exercice') afficherProgramme();
  else afficherAccueil();
}

/* ---------- Progression ---------- */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Crée un élément SVG avec ses attributs. */
function creerSvg(balise, attributs, classe) {
  const el = document.createElementNS(SVG_NS, balise);
  for (const [nom, valeur] of Object.entries(attributs)) el.setAttribute(nom, valeur);
  if (classe) el.setAttribute('class', classe);
  return el;
}

/** "2026-10-13T18:30" → horodatage local en ms (NaN si format inconnu). */
function tempsDepuisId(id) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(id);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : NaN;
}

/** Meilleure série faite : la plus lourde, puis celle avec le plus de reps. null si aucune. */
function meilleureSerie(series) {
  let meilleure = null;
  for (const s of series) {
    if (!s.fait || typeof s.poids !== 'number' || !Number.isFinite(s.poids)) continue;
    const reps = typeof s.reps === 'number' ? s.reps : null;
    if (!meilleure || s.poids > meilleure.poids || (s.poids === meilleure.poids && (reps ?? -1) > (meilleure.reps ?? -1))) {
      meilleure = { poids: s.poids, reps };
    }
  }
  return meilleure;
}

/** Un point par séance où l'exercice a une série faite avec un poids, du plus ancien au plus récent. */
function pointsProgression(exerciceId) {
  const points = [];
  for (const entree of entreesHistorique().reverse()) {
    const ex = entree.exercices.find((e) => e && e.exerciceId === exerciceId);
    const meilleure = ex && meilleureSerie(ex.series);
    const temps = tempsDepuisId(entree.id);
    if (meilleure && Number.isFinite(temps)) points.push({ id: entree.id, temps, ...meilleure });
  }
  return points;
}

/** Graduations rondes couvrant [min, max] : 5 valeurs au plus. */
function graduations(min, max) {
  if (min === max) {
    min -= 2.5;
    max += 2.5;
  }
  // Pas « de salle » : multiples de 2,5 kg dès que possible
  const pas = [0.5, 1, 2.5, 5, 10, 25, 50, 100].find((p) => Math.ceil(max / p) - Math.floor(min / p) <= 4) ?? 250;
  const valeurs = [];
  for (let v = Math.max(0, Math.floor(min / pas) * pas); v <= max + pas - 1e-9; v += pas) {
    valeurs.push(Math.round(v * 100) / 100);
    if (v >= max) break;
  }
  return valeurs;
}

/** « +5 kg depuis le 01/09/2026 » entre le premier et le dernier point. */
function texteEvolution(points) {
  const ecart = Math.round((points[points.length - 1].poids - points[0].poids) * 100) / 100;
  const signe = ecart > 0 ? '+' : ecart < 0 ? '−' : '±';
  return `${signe}${formaterNombre(Math.abs(ecart))} kg depuis le ${formaterDate(points[0].id)}`;
}

/**
 * Courbe SVG maison. Toucher ou glisser sur la courbe (ou flèches du clavier)
 * choisit un point ; sa valeur s'affiche dans la zone de lecture.
 */
function dessinerGraphe(zone, lecture, points, exercice) {
  const largeur = Math.max(240, Math.floor(zone.clientWidth));
  const hauteur = 200;
  const marge = { haut: 12, droite: 12, bas: 28, gauche: 40 };
  const valeurs = points.map((p) => p.poids);
  const ticks = graduations(Math.min(...valeurs), Math.max(...valeurs));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const t0 = points[0].temps;
  const t1 = points[points.length - 1].temps;
  const x = (t) => (t1 === t0
    ? (marge.gauche + largeur - marge.droite) / 2
    : marge.gauche + ((t - t0) / (t1 - t0)) * (largeur - marge.gauche - marge.droite));
  const y = (v) => marge.haut + ((yMax - v) / (yMax - yMin)) * (hauteur - marge.haut - marge.bas);

  const premier = points[0];
  const dernier = points[points.length - 1];
  const graphe = creerSvg('svg', {
    width: largeur, height: hauteur, viewBox: `0 0 ${largeur} ${hauteur}`, role: 'img', tabindex: '0',
    'aria-label': `Courbe du meilleur poids : ${points.length} séance${points.length > 1 ? 's' : ''}, `
      + `de ${formaterNombre(premier.poids)} kg le ${formaterDate(premier.id)} à ${formaterNombre(dernier.poids)} kg le ${formaterDate(dernier.id)}. `
      + 'Flèches gauche et droite pour lire chaque point.',
  }, 'graphe');

  // Grille horizontale (traits fins) et valeurs en kg
  for (const v of ticks) {
    const yLigne = Math.round(y(v)) + 0.5;
    graphe.append(creerSvg('line', { x1: marge.gauche, x2: largeur - marge.droite, y1: yLigne, y2: yLigne }, 'graphe__grille'));
    const texte = creerSvg('text', { x: marge.gauche - 8, y: yLigne, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, 'graphe__texte');
    texte.textContent = formaterNombre(v);
    graphe.append(texte);
  }

  // Dates : première et dernière séance (« 01/09 »)
  const dates = t1 === t0 ? [[premier, 'middle']] : [[premier, 'start'], [dernier, 'end']];
  for (const [point, ancrage] of dates) {
    const texte = creerSvg('text', { x: x(point.temps), y: hauteur - 8, 'text-anchor': ancrage }, 'graphe__texte');
    texte.textContent = formaterDate(point.id).slice(0, 5);
    graphe.append(texte);
  }

  // Courbe et points (anneau couleur de la carte pour les détacher)
  const trace = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.temps).toFixed(1)},${y(p.poids).toFixed(1)}`).join('');
  graphe.append(creerSvg('path', { d: trace }, 'graphe__ligne'));
  for (const p of points) graphe.append(creerSvg('circle', { cx: x(p.temps), cy: y(p.poids), r: 4 }, 'graphe__point'));

  // Curseur : trait vertical + point agrandi sur la séance choisie
  const curseur = creerSvg('line', { y1: marge.haut, y2: hauteur - marge.bas }, 'graphe__curseur');
  const choix = creerSvg('circle', { r: 6 }, 'graphe__point');
  graphe.append(curseur, choix);

  let indexChoisi = points.length - 1;
  const choisir = (i) => {
    indexChoisi = Math.max(0, Math.min(points.length - 1, i));
    const p = points[indexChoisi];
    const xPoint = x(p.temps);
    curseur.setAttribute('x1', xPoint);
    curseur.setAttribute('x2', xPoint);
    choix.setAttribute('cx', xPoint);
    choix.setAttribute('cy', y(p.poids));
    lecture.replaceChildren(
      creer('span', 'lecture__valeur', texteSerie(exercice, p)),
      creer('span', 'lecture__date', formaterDate(p.id)),
    );
  };

  // Le point le plus proche du doigt en X : pas besoin de viser le point
  const pointLePlusProche = (evenement) => {
    const xDoigt = evenement.clientX - graphe.getBoundingClientRect().left;
    let meilleur = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.temps) - xDoigt) < Math.abs(x(points[meilleur].temps) - xDoigt)) meilleur = i;
    });
    choisir(meilleur);
  };
  graphe.addEventListener('pointerdown', pointLePlusProche);
  graphe.addEventListener('pointermove', (evenement) => {
    if (evenement.pointerType === 'mouse' || evenement.buttons) pointLePlusProche(evenement);
  });
  graphe.addEventListener('keydown', (evenement) => {
    const sauts = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
    if (!(evenement.key in sauts)) return;
    evenement.preventDefault();
    const saut = sauts[evenement.key];
    choisir(Number.isFinite(saut) ? indexChoisi + saut : (saut < 0 ? 0 : points.length - 1));
  });

  choisir(indexChoisi);
  zone.replaceChildren(graphe);
}

/** Tableau des valeurs (équivalent accessible de la courbe), la plus récente en premier. */
function creerTableauProgression(points, exercice) {
  const tableau = creer('table', 'tableau');
  const legende = creer('caption', 'visuellement-cache', 'Meilleure série par séance');
  const entete = creer('thead', '');
  const ligneEntete = document.createElement('tr');
  for (const titre of ['Date', 'Meilleure série']) {
    const th = creer('th', '', titre);
    th.scope = 'col';
    ligneEntete.append(th);
  }
  entete.append(ligneEntete);
  const corps = document.createElement('tbody');
  for (const p of [...points].reverse()) {
    const ligne = document.createElement('tr');
    ligne.append(creer('td', '', formaterDate(p.id)), creer('td', '', texteSerie(exercice, p)));
    corps.append(ligne);
  }
  tableau.append(legende, entete, corps);
  return tableau;
}

/** Remplit la zone de résultats pour l'exercice choisi. */
function majProgression() {
  const exerciceId = document.getElementById('choix-exercice').value;
  etat.exerciceProgression = exerciceId;
  const exercice = trouverExerciceDansProgramme(exerciceId);
  const points = pointsProgression(exerciceId);
  const resultats = document.getElementById('resultats-progression');

  if (!points.length) {
    const vide = exercice && exercice.poidsDuCorps
      ? 'Aucun lest enregistré pour cet exercice au poids du corps.'
      : 'Pas encore de série cochée avec un poids pour cet exercice.';
    resultats.replaceChildren(creer('p', 'texte-secondaire', vide));
    return;
  }

  const record = points.reduce((a, b) => (b.poids > a.poids ? b : a));
  const resume = [`Record : ${formaterNombre(record.poids)} kg le ${formaterDate(record.id)}`];
  if (points.length > 1) resume.push(texteEvolution(points));

  const carteGraphe = creer('article', 'carte');
  const lecture = creer('p', 'lecture');
  lecture.setAttribute('aria-live', 'polite');
  const zone = creer('div', 'graphe-zone');
  carteGraphe.append(
    creer('h2', 'exercice__nom', exercice.poidsDuCorps ? 'Meilleur lest' : 'Meilleur poids'),
    creer('p', 'exercice__cible', resume.join(' · ')),
    lecture,
    zone,
  );
  if (points.length === 1) carteGraphe.append(creer('p', 'exercice__cible', 'Une seule séance : la courbe se dessinera à la prochaine.'));

  const carteTableau = creer('article', 'carte');
  carteTableau.append(creer('h2', 'exercice__nom', 'Séances'), creerTableauProgression(points, exercice));

  resultats.replaceChildren(carteGraphe, carteTableau);
  dessinerGraphe(zone, lecture, points, exercice);
}

/** Écran Progression : choix de l'exercice, courbe, tableau. */
function afficherProgression() {
  const exercices = etat.donnees.programme.flatMap((s) => s.exercices.filter(Boolean));
  if (!exercices.length) {
    document.getElementById('ecran-progression').replaceChildren(creer('p', 'texte-secondaire', 'Le programme ne contient aucun exercice.'));
    montrerEcran('progression', 'Progression');
    return;
  }

  // Par défaut : le dernier exercice regardé, sinon le premier qui a des données
  let choisi = exercices.find((ex) => ex.id === etat.exerciceProgression);
  if (!choisi) choisi = exercices.find((ex) => pointsProgression(ex.id).length) || exercices[0];

  const select = document.createElement('select');
  select.id = 'choix-exercice';
  select.className = 'champ champ--liste';
  for (const seance of etat.donnees.programme) {
    const groupe = document.createElement('optgroup');
    groupe.label = seance.nom;
    for (const ex of seance.exercices.filter(Boolean)) {
      const option = creer('option', '', ex.nom);
      option.value = ex.id;
      option.selected = ex.id === choisi.id;
      groupe.append(option);
    }
    select.append(groupe);
  }
  const etiquette = creer('label', 'etiquette', 'Exercice');
  etiquette.htmlFor = select.id;
  const resultats = creer('div', 'ecran');
  resultats.id = 'resultats-progression';

  document.getElementById('ecran-progression').replaceChildren(etiquette, select, resultats);
  montrerEcran('progression', 'Progression');
  majProgression(); // après l'affichage : la courbe a besoin de la largeur réelle
}

/* ---------- Édition du programme ---------- */

/** Applique une modification et l'enregistre ; si l'écriture échoue, tout revient comme avant. */
function modifierDonnees(modification) {
  const avant = JSON.stringify(etat.donnees);
  modification(etat.donnees);
  if (!etat.enregistrable || ecrireDonnees(etat.donnees)) return true;
  etat.donnees = JSON.parse(avant);
  alert('Stockage de l\'appli plein : modification non enregistrée.');
  return false;
}

/** Identifiant lisible et unique dans le programme : « Hip thrust » → « hip-thrust ». */
function nouvelIdExercice(nom) {
  const base = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'exercice';
  const pris = new Set(etat.donnees.programme.flatMap((s) => s.exercices.filter(Boolean).map((e) => e.id)));
  let id = base;
  for (let n = 2; pris.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** Petit bouton rond à icône (flèches de l'ordre). */
function creerBoutonIcone(icone, libelle, donnees) {
  const bouton = creer('button', 'bouton-icone bouton-icone--petit');
  bouton.type = 'button';
  bouton.setAttribute('aria-label', libelle);
  Object.assign(bouton.dataset, donnees);
  bouton.insertAdjacentHTML('beforeend', icone);
  return bouton;
}

/** Ligne d'exercice : nom + objectif (ouvre le formulaire), flèches monter / descendre. */
function creerLigneProgramme(seance, exercice, i, total) {
  const ouvrir = creer('button', 'programme-ligne__exercice');
  ouvrir.type = 'button';
  ouvrir.dataset.modifier = exercice.id;
  ouvrir.dataset.seance = seance.id;
  ouvrir.append(creer('span', 'programme-ligne__nom', exercice.nom), creer('span', 'programme-ligne__cible', texteCible(exercice)));

  const monter = creerBoutonIcone(ICONE_HAUT, `Monter ${exercice.nom}`, { deplacer: exercice.id, sens: '-1', seance: seance.id });
  const descendre = creerBoutonIcone(ICONE_BAS, `Descendre ${exercice.nom}`, { deplacer: exercice.id, sens: '1', seance: seance.id });
  monter.disabled = i === 0;
  descendre.disabled = i === total - 1;

  const ligne = creer('li', 'programme-ligne');
  ligne.append(ouvrir, monter, descendre);
  return ligne;
}

/** Contenu de l'écran Programme (sans changer d'écran ni de position de défilement). */
function remplirProgramme() {
  const cartes = etat.donnees.programme.map((seance, s) => {
    const exercices = seance.exercices.filter(Boolean);
    const liste = creer('ol', 'programme-liste');
    liste.append(...exercices.map((ex, i) => creerLigneProgramme(seance, ex, i, exercices.length)));
    const ajouter = creer('button', 'bouton bouton--secondaire', 'Ajouter un exercice');
    ajouter.type = 'button';
    ajouter.dataset.ajouter = seance.id;
    const carte = creer('article', 'carte');
    carte.append(creer('h2', 'exercice__nom', `Séance ${s + 1} · ${seance.nom}`), liste, ajouter);
    return carte;
  });
  const aide = creer('p', 'texte-secondaire', 'Touche un exercice pour le modifier. Les flèches changent l\'ordre.');
  document.getElementById('ecran-programme').replaceChildren(aide, ...cartes);
}

function afficherProgramme() {
  remplirProgramme();
  montrerEcran('programme', 'Programme');
}

/** Change l'ordre d'un exercice dans sa séance. */
function deplacerExercice(seanceId, exerciceId, sens) {
  modifierDonnees((donnees) => {
    const exercices = donnees.programme.find((s) => s.id === seanceId).exercices;
    const i = exercices.findIndex((e) => e && e.id === exerciceId);
    const j = i + sens;
    if (i < 0 || j < 0 || j >= exercices.length) return;
    [exercices[i], exercices[j]] = [exercices[j], exercices[i]];
  });
  remplirProgramme();
  // Garde le focus sur la flèche de l'exercice déplacé pour enchaîner les déplacements
  const selecteur = `[data-deplacer="${CSS.escape(exerciceId)}"]`;
  const meme = document.querySelector(`${selecteur}[data-sens="${sens}"]`);
  const cible = meme && !meme.disabled ? meme : document.querySelector(`${selecteur}:not(:disabled)`);
  if (cible) cible.focus();
}

/** Champ de formulaire avec son label visible. */
function creerChampFormulaire(nom, libelle, valeur, options = {}) {
  const input = creer('input', 'champ champ--formulaire');
  input.id = `champ-${nom}`;
  input.name = nom;
  input.type = 'text';
  input.autocomplete = 'off';
  input.value = valeur ?? '';
  if (options.clavier) input.inputMode = options.clavier;
  if (options.indice) input.placeholder = options.indice;
  if (options.max) input.maxLength = options.max;
  const label = creer('label', 'etiquette', libelle);
  label.htmlFor = input.id;
  const bloc = creer('div', 'formulaire__champ');
  bloc.append(label, input);
  return bloc;
}

/** Bouton radio ou case en pastille. */
function creerPastille(type, nom, valeur, libelle, coche) {
  const input = document.createElement('input');
  input.type = type;
  input.name = nom;
  input.value = valeur;
  input.checked = coche;
  const label = creer('label', 'pastille');
  label.append(input, creer('span', '', libelle));
  return label;
}

/** Formulaire d'ajout ou de modification d'un exercice. */
function afficherFormulaireExercice(seanceId, exerciceId) {
  const seance = trouverSeance(seanceId);
  if (!seance) return;
  const exercice = exerciceId ? trouverExercice(seance, exerciceId) : null;
  const v = exercice || { nom: '', series: 3, repsMin: 8, repsMax: 12, poidsDefaut: null, unite: 'reps', poidsDuCorps: false, note: '' };

  const form = creer('form', 'formulaire');
  form.noValidate = true;
  form.dataset.seance = seance.id;
  if (exercice) form.dataset.exercice = exercice.id;

  const erreur = creer('p', 'message');
  erreur.id = 'erreur-formulaire';
  erreur.setAttribute('role', 'alert');
  erreur.hidden = true;

  const ligneSeries = creer('div', 'formulaire__ligne');
  ligneSeries.append(creerChampFormulaire('series', 'Séries', v.series, { clavier: 'numeric' }));
  const ligneReps = creer('div', 'formulaire__ligne');
  ligneReps.append(
    creerChampFormulaire('repsMin', 'Reps min', v.repsMin, { clavier: 'numeric', indice: 'max' }),
    creerChampFormulaire('repsMax', 'Reps max', v.repsMax, { clavier: 'numeric', indice: 'max' }),
  );

  const unite = creer('fieldset', 'formulaire__choix');
  unite.append(
    creer('legend', 'etiquette', 'Compter en'),
    creerPastille('radio', 'unite', 'reps', 'Répétitions', v.unite !== 's'),
    creerPastille('radio', 'unite', 's', 'Secondes', v.unite === 's'),
  );

  const enregistrerBouton = creer('button', 'bouton bouton--principal', exercice ? 'Enregistrer' : 'Ajouter l\'exercice');
  enregistrerBouton.type = 'submit';
  const actions = creer('div', 'actions');
  actions.append(enregistrerBouton);
  if (exercice) {
    const supprimer = creer('button', 'bouton bouton--secondaire', 'Retirer du programme');
    supprimer.type = 'button';
    supprimer.dataset.retirer = exercice.id;
    actions.append(supprimer);
  }

  form.append(
    creer('p', 'texte-secondaire', `Séance ${etat.donnees.programme.indexOf(seance) + 1} · ${seance.nom}`),
    erreur,
    creerChampFormulaire('nom', 'Nom', v.nom, { max: 60, indice: 'Ex. : Hip thrust' }),
    ligneSeries,
    ligneReps,
    creer('p', 'exercice__cible', 'Laisse les reps vides pour « max ».'),
    unite,
    creerChampFormulaire('poidsDefaut', 'Poids de départ (kg)', formaterNombre(v.poidsDefaut), { clavier: 'decimal', indice: 'Vide = je saisis' }),
    creerPastille('checkbox', 'poidsDuCorps', 'oui', 'Au poids du corps (le poids saisi = lest)', v.poidsDuCorps === true),
    creerChampFormulaire('note', 'Note', v.note, { max: 60, indice: 'Ex. : par jambe' }),
    actions,
  );

  document.getElementById('ecran-exercice').replaceChildren(form);
  montrerEcran('exercice', exercice ? exercice.nom : 'Nouvel exercice', 'Retour au programme');
}

/** Lit et vérifie le formulaire. Renvoie { exercice } ou { erreur, champ }. */
function lireFormulaire(form) {
  const valeur = (nom) => form.elements[nom].value.trim();
  const nom = valeur('nom');
  if (!nom) return { erreur: 'Donne un nom à l\'exercice.', champ: 'nom' };

  const series = lireReps(valeur('series'));
  if (!Number.isInteger(series) || series < 1 || series > 10) return { erreur: 'Séries : un nombre entre 1 et 10.', champ: 'series' };

  let repsMin = lireReps(valeur('repsMin'));
  let repsMax = lireReps(valeur('repsMax'));
  if (Number.isNaN(repsMin) || repsMin === 0) return { erreur: 'Reps min : un nombre entier (ou vide).', champ: 'repsMin' };
  if (Number.isNaN(repsMax) || repsMax === 0) return { erreur: 'Reps max : un nombre entier (ou vide).', champ: 'repsMax' };
  if (repsMin === null) repsMin = repsMax; // une seule valeur = objectif fixe
  if (repsMax === null) repsMax = repsMin;
  if (repsMin !== null && repsMin > repsMax) [repsMin, repsMax] = [repsMax, repsMin];

  const poidsDefaut = lirePoids(valeur('poidsDefaut'));
  if (Number.isNaN(poidsDefaut)) return { erreur: 'Poids de départ : un nombre comme 12,5 (ou vide).', champ: 'poidsDefaut' };

  return {
    exercice: {
      nom, series, repsMin, repsMax, poidsDefaut,
      unite: form.elements.unite.value === 's' ? 's' : 'reps',
      poidsDuCorps: form.elements.poidsDuCorps.checked,
      note: valeur('note'),
    },
  };
}

/** Enregistre le formulaire : ajout ou modification. */
function enregistrerExercice(form) {
  const lu = lireFormulaire(form);
  const erreur = document.getElementById('erreur-formulaire');
  if (lu.erreur) {
    erreur.textContent = lu.erreur;
    erreur.hidden = false;
    form.elements[lu.champ].focus();
    return;
  }
  const { seance: seanceId, exercice: exerciceId } = form.dataset;
  const nomSeanceCible = nomSeance(seanceId);
  const ok = modifierDonnees((donnees) => {
    const seance = donnees.programme.find((s) => s.id === seanceId);
    const existant = exerciceId && seance.exercices.find((e) => e && e.id === exerciceId);
    if (existant) Object.assign(existant, lu.exercice);
    else seance.exercices.push({ id: nouvelIdExercice(lu.exercice.nom), ...lu.exercice });
  });
  if (!ok) return;
  afficherProgramme();
  afficherMessage(exerciceId ? `« ${lu.exercice.nom} » modifié.` : `« ${lu.exercice.nom} » ajouté à ${nomSeanceCible}.`);
}

/** Retire un exercice du programme ; ses séances passées restent dans l'historique. */
function retirerExercice(seanceId, exerciceId) {
  const seance = trouverSeance(seanceId);
  const exercice = trouverExercice(seance, exerciceId);
  if (!exercice) return;
  if (!confirm(`Retirer « ${exercice.nom} » de ${seance.nom} ? Les séances passées restent dans l'historique.`)) return;
  if (!modifierDonnees((donnees) => {
    const cible = donnees.programme.find((s) => s.id === seanceId);
    cible.exercices = cible.exercices.filter((e) => e && e.id !== exerciceId);
  })) return;
  afficherProgramme();
  afficherMessage(`« ${exercice.nom} » retiré du programme.`);
}

/* ---------- Sauvegarde : export / import ---------- */

const estTexte = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;
const estNombreOuNull = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));
const estEntierOuNull = (v) => v === null || (Number.isInteger(v) && v >= 0);

/** Exercice du programme importé, nettoyé ; null s'il est invalide. */
function nettoyerExercice(e) {
  if (!e || !estTexte(e.id) || !estTexte(e.nom) || !Number.isInteger(e.series) || e.series < 1 || e.series > 20) return null;
  const repsMin = e.repsMin ?? null;
  const repsMax = e.repsMax ?? null;
  const poidsDefaut = e.poidsDefaut ?? null;
  if (!estEntierOuNull(repsMin) || !estEntierOuNull(repsMax) || !estNombreOuNull(poidsDefaut)) return null;
  return {
    id: e.id, nom: e.nom, series: e.series, repsMin, repsMax, poidsDefaut,
    unite: e.unite === 's' ? 's' : 'reps',
    poidsDuCorps: e.poidsDuCorps === true,
    note: typeof e.note === 'string' ? e.note : '',
  };
}

/** Séance de l'historique importée : forme complète attendue. */
function entreeImportValide(e) {
  return e && estTexte(e.id) && estTexte(e.seanceId)
    && (e.dureeMin === undefined || estNombreOuNull(e.dureeMin))
    && Array.isArray(e.exercices)
    && e.exercices.every((x) => x && estTexte(x.exerciceId) && Array.isArray(x.series)
      && x.series.every((serie) => serie && estNombreOuNull(serie.poids ?? null)
        && estNombreOuNull(serie.reps ?? null) && typeof (serie.fait ?? false) === 'boolean'));
}

/**
 * Vérifie un fichier importé. Tout doit être valide, sinon rien n'est importé
 * (un import partiel ferait perdre des données sans prévenir).
 */
function validerImport(brut) {
  const abime = 'Fichier abîmé : import annulé, rien n\'a changé.';
  if (!brut || typeof brut !== 'object' || !Number.isInteger(brut.version)
    || !Array.isArray(brut.programme) || !Array.isArray(brut.historique)) {
    return { erreur: 'Ce fichier n\'est pas une sauvegarde de l\'appli.' };
  }
  if (brut.version > VERSION_DONNEES) {
    return { erreur: 'Sauvegarde faite avec une version plus récente de l\'appli : ouvre l\'appli avec du réseau pour la mettre à jour, puis réessaie.' };
  }
  const programme = [];
  for (const seance of brut.programme) {
    if (!seance || !estTexte(seance.id) || !estTexte(seance.nom) || !Array.isArray(seance.exercices)) return { erreur: abime };
    const exercices = seance.exercices.map(nettoyerExercice);
    if (exercices.includes(null)) return { erreur: abime };
    programme.push({ id: seance.id, nom: seance.nom, exercices });
  }
  if (!brut.historique.every(entreeImportValide)) return { erreur: abime };

  const donnees = migrer({ version: brut.version, programme, historique: brut.historique });
  if (brut.enCours && seanceEnCoursValide(brut.enCours)) donnees.enCours = brut.enCours;
  if (Number.isFinite(brut.derniereSauvegarde)) donnees.derniereSauvegarde = brut.derniereSauvegarde;
  return { donnees };
}

/** « aujourd'hui », « hier », « il y a 5 jours ». */
function ilYA(ms) {
  const jour = (t) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const jours = Math.round((jour(Date.now()) - jour(ms)) / 86400000);
  if (jours <= 0) return 'aujourd\'hui';
  if (jours === 1) return 'hier';
  return `il y a ${jours} jours`;
}

/** Copie de secours d'avant le dernier import, ou null. */
function lireCopieAvantImport() {
  try {
    const copie = JSON.parse(localStorage.getItem(CLE_AVANT_IMPORT));
    return copie && Number.isFinite(copie.date) && copie.donnees ? copie : null;
  } catch {
    return null;
  }
}

/** Ouvre la feuille de partage (iPhone, Android) ou télécharge le fichier. */
async function exporterDonnees() {
  const fichier = new File(
    [JSON.stringify(etat.donnees, null, 2)],
    `suivi-seances-${idSeance(Date.now()).slice(0, 10)}.json`,
    { type: 'application/json' },
  );
  try {
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: 'Sauvegarde Suivi de séances' });
    } else {
      telechargerFichier(fichier);
    }
  } catch (erreur) {
    if (erreur.name === 'AbortError') return; // partage annulé : rien n'est exporté
    telechargerFichier(fichier);
  }
  etat.donnees.derniereSauvegarde = Date.now();
  enregistrer();
  remplirSauvegarde();
  afficherMessage('Sauvegarde exportée. Garde le fichier en lieu sûr (Fichiers, iCloud, mail…).');
}

function telechargerFichier(fichier) {
  const url = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = fichier.name;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Remplace toutes les données par un fichier exporté, après vérification et confirmation. */
async function importerFichier(fichier) {
  if (!fichier) return;
  if (!etat.enregistrable) {
    alert('Stockage indisponible : import impossible.');
    return;
  }
  if (fichier.size > 5 * 1024 * 1024) {
    alert('Fichier trop gros pour être une sauvegarde de l\'appli.');
    return;
  }
  let brut;
  try {
    brut = JSON.parse(await fichier.text());
  } catch {
    alert('Fichier illisible : choisis un fichier .json exporté par l\'appli.');
    return;
  }
  const { donnees, erreur } = validerImport(brut);
  if (erreur) {
    alert(erreur);
    return;
  }
  const nbFichier = donnees.historique.length;
  const nbActuel = etat.donnees.historique.length;
  if (!confirm(`Remplacer toutes les données de l'appli par ce fichier ?\n\n`
    + `Fichier : ${nbFichier} séance${nbFichier > 1 ? 's' : ''} dans l'historique.\n`
    + `Actuellement : ${nbActuel} séance${nbActuel > 1 ? 's' : ''}.\n\n`
    + 'Tes données actuelles sont gardées en copie de secours.')) return;

  // Jamais de remplacement sans copie de secours
  try {
    localStorage.setItem(CLE_AVANT_IMPORT, JSON.stringify({ date: Date.now(), donnees: etat.donnees }));
  } catch {
    alert('Stockage plein : impossible de garder une copie de secours. Import annulé, rien n\'a changé.');
    return;
  }
  const avant = etat.donnees;
  etat.donnees = donnees;
  if (!ecrireDonnees(donnees)) {
    etat.donnees = avant;
    alert('Stockage de l\'appli plein : import annulé, rien n\'a changé.');
    return;
  }
  afficherAccueil();
  afficherMessage(`Import réussi : ${nbFichier} séance${nbFichier > 1 ? 's' : ''} dans l'historique.`);
}

/** Revient aux données d'avant le dernier import. */
function restaurerCopieAvantImport() {
  const copie = lireCopieAvantImport();
  const { donnees, erreur } = copie ? validerImport(copie.donnees) : { erreur: 'Aucune copie de secours.' };
  if (erreur) {
    alert(erreur);
    return;
  }
  if (!confirm(`Revenir aux données du ${formaterDate(idSeance(copie.date))} (avant l'import) ? Les données actuelles seront remplacées.`)) return;
  const avant = etat.donnees;
  etat.donnees = donnees;
  if (!ecrireDonnees(donnees)) {
    etat.donnees = avant;
    alert('Stockage de l\'appli plein : rien n\'a changé.');
    return;
  }
  localStorage.removeItem(CLE_AVANT_IMPORT);
  afficherAccueil();
  afficherMessage('Données d\'avant l\'import restaurées.');
}

/** Contenu de l'écran Sauvegarde. */
function remplirSauvegarde() {
  const { historique, derniereSauvegarde } = etat.donnees;
  const nb = historique.length;

  const exporter = creer('button', 'bouton bouton--principal', 'Exporter mes données');
  exporter.type = 'button';
  exporter.dataset.action = 'exporter';
  const carteExport = creer('article', 'carte');
  carteExport.append(
    creer('h2', 'exercice__nom', 'Exporter'),
    creer('p', 'exercice__cible', Number.isFinite(derniereSauvegarde)
      ? `Dernière sauvegarde : ${formaterDate(idSeance(derniereSauvegarde))} (${ilYA(derniereSauvegarde)})`
      : 'Jamais sauvegardé.'),
    creer('p', 'carte__texte', `Un fichier avec ton programme et ${nb} séance${nb > 1 ? 's' : ''} d'historique. `
      + 'Sur iPhone : « Enregistrer dans Fichiers » ou envoie-le-toi par mail.'),
    exporter,
  );

  const choisir = creer('button', 'bouton bouton--secondaire', 'Choisir un fichier');
  choisir.type = 'button';
  choisir.dataset.action = 'choisir';
  const entree = creer('input', 'visuellement-cache');
  entree.type = 'file';
  entree.accept = '.json,application/json';
  entree.id = 'fichier-import';
  entree.tabIndex = -1;
  entree.setAttribute('aria-hidden', 'true');
  const carteImport = creer('article', 'carte');
  carteImport.append(
    creer('h2', 'exercice__nom', 'Restaurer'),
    creer('p', 'carte__texte', 'Remplace toutes les données de l\'appli par celles d\'un fichier exporté. Le fichier est vérifié avant.'),
    choisir,
    entree,
  );

  const cartes = [carteExport, carteImport];
  const copie = lireCopieAvantImport();
  if (copie) {
    const restaurer = creer('button', 'bouton bouton--secondaire', 'Revenir à cette copie');
    restaurer.type = 'button';
    restaurer.dataset.action = 'restaurer';
    const carteCopie = creer('article', 'carte');
    carteCopie.append(
      creer('h2', 'exercice__nom', 'Copie de secours'),
      creer('p', 'carte__texte', `Tes données d'avant le dernier import (${formaterDate(idSeance(copie.date))}).`),
      restaurer,
    );
    cartes.push(carteCopie);
  }

  const intro = creer('p', 'texte-secondaire', 'Tes données sont seulement sur ce téléphone. Exporte-les régulièrement pour ne rien perdre.');
  document.getElementById('ecran-sauvegarde').replaceChildren(intro, ...cartes);
}

function afficherSauvegarde() {
  remplirSauvegarde();
  montrerEcran('sauvegarde', 'Sauvegarde');
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

document.getElementById('liste-seances').addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('.seance');
  if (bouton) ouvrirSeance(bouton.dataset.seance);
});

document.getElementById('bouton-retour').addEventListener('click', retour);

document.getElementById('bouton-historique').addEventListener('click', () => {
  afficherMessage('');
  afficherHistorique();
});

document.getElementById('bouton-progression').addEventListener('click', () => {
  afficherMessage('');
  afficherProgression();
});

document.getElementById('ecran-progression').addEventListener('change', (evenement) => {
  if (evenement.target.id === 'choix-exercice') majProgression();
});

// Rotation ou redimensionnement : la courbe est redessinée à la bonne largeur
let redessinPrevu = false;
window.addEventListener('resize', () => {
  if (etat.ecran !== 'progression' || redessinPrevu) return;
  redessinPrevu = true;
  requestAnimationFrame(() => {
    redessinPrevu = false;
    if (document.getElementById('choix-exercice')) majProgression();
  });
});

document.getElementById('bouton-programme').addEventListener('click', () => {
  afficherMessage('');
  afficherProgramme();
});

document.getElementById('ecran-programme').addEventListener('click', (evenement) => {
  const cible = evenement.target.closest('[data-modifier], [data-deplacer], [data-ajouter]');
  if (!cible) return;
  afficherMessage('');
  if (cible.dataset.deplacer) deplacerExercice(cible.dataset.seance, cible.dataset.deplacer, Number(cible.dataset.sens));
  else if (cible.dataset.ajouter) afficherFormulaireExercice(cible.dataset.ajouter, null);
  else afficherFormulaireExercice(cible.dataset.seance, cible.dataset.modifier);
});

const ecranExercice = document.getElementById('ecran-exercice');
ecranExercice.addEventListener('submit', (evenement) => {
  evenement.preventDefault();
  enregistrerExercice(evenement.target);
});
ecranExercice.addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('[data-retirer]');
  if (bouton) retirerExercice(bouton.closest('form').dataset.seance, bouton.dataset.retirer);
});

document.getElementById('bouton-sauvegarde').addEventListener('click', () => {
  afficherMessage('');
  afficherSauvegarde();
});

const ecranSauvegarde = document.getElementById('ecran-sauvegarde');
ecranSauvegarde.addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('[data-action]');
  if (!bouton) return;
  if (bouton.dataset.action === 'exporter') exporterDonnees();
  else if (bouton.dataset.action === 'choisir') document.getElementById('fichier-import').click();
  else if (bouton.dataset.action === 'restaurer') restaurerCopieAvantImport();
});
ecranSauvegarde.addEventListener('change', (evenement) => {
  if (evenement.target.id !== 'fichier-import') return;
  importerFichier(evenement.target.files[0]);
  evenement.target.value = ''; // permet de rechoisir le même fichier
});

document.getElementById('ecran-historique').addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('[data-entree]');
  if (bouton) afficherDetail(bouton.dataset.entree);
});

document.getElementById('ecran-detail').addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('[data-supprimer]');
  if (bouton) supprimerEntree(bouton.dataset.supprimer);
});

const ecranSeance = document.getElementById('ecran-seance');
ecranSeance.addEventListener('input', (evenement) => {
  if (evenement.target.matches('.champ')) saisirValeur(evenement.target);
});
ecranSeance.addEventListener('change', (evenement) => {
  if (evenement.target.matches('[data-champ="fait"]')) cocherSerie(evenement.target);
});
ecranSeance.addEventListener('click', (evenement) => {
  const action = evenement.target.closest('[data-action]');
  if (!action) return;
  if (action.dataset.action === 'terminer') terminerSeance();
  else abandonnerSeance();
});

// Séance interrompue (appli fermée, téléphone verrouillé) : on la reprend directement.
// Si rien n'était coché, le chrono repart de maintenant.
const enCoursAuDemarrage = etat.donnees.enCours;
if (enCoursAuDemarrage) {
  if (compterSeries(enCoursAuDemarrage).faites === 0) {
    enCoursAuDemarrage.debut = Date.now();
    enCoursAuDemarrage.derniereAction = enCoursAuDemarrage.debut;
    enregistrer();
  }
  afficherSeance();
} else {
  afficherAccueil();
}
afficherMessage(etat.alerte);

enregistrerServiceWorker();
