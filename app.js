/* Suivi de séances — logique de l'appli.
   Étape 1 : service worker (hors ligne + installation).
   Étape 2 : programme de départ + écran d'accueil.
   Étape 3 : écran de séance (saisie, cases à cocher, enregistrement).
   Étape 4 : historique (liste, détail, suppression). */
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

const ECRANS = ['accueil', 'seance', 'historique', 'detail'];

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
  else afficherAccueil();
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
