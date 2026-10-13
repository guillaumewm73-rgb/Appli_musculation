/* Suivi de séances — logique de l'appli.
   Étape 1 : service worker (hors ligne + installation).
   Étape 2 : programme de départ + écran d'accueil.
   Étape 3 : écran de séance (saisie, cases à cocher, enregistrement).
   Étape 4 : historique (liste, détail, suppression).
   Étape 5 : progression (courbe SVG du meilleur poids).
   Étape 6 : édition du programme.
   Étape 7 : export / import JSON.
   Étape 8 : couleurs par séance, animations, effets au scroll.
   Sam : coach (conseils calculés sur le téléphone + discussion IA sur demande). */
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

// Programme transmis par Guillaume le 13/10/2026 (charges actuelles ; vide = je saisis)
const DATE_PROGRAMME_DEPART = '13/10/2026';
const PROGRAMME_DEPART = [
  {
    id: 'seance-1',
    nom: 'Push',
    exercices: [
      exo('dev-couche', 'Développé couché', 4, 8, 10, null),
      exo('dev-incline-halteres', 'Développé incliné haltères', 3, 10, 12, 20),
      exo('militaire-ou-laterales', 'Développé militaire ou élévations latérales', 3, 8, 8, 8),
      exo('dips', 'Dips ou poulie triceps', 3, 8, 10, 15),
      exo('extension-triceps-poulie', 'Extension triceps poulie haute', 3, 10, 12, 15),
      exo('pec-machine', 'Pectoral machine', 3, 8, 8, 45, { note: 'facultatif' }),
    ],
  },
  {
    id: 'seance-2',
    nom: 'Pull',
    exercices: [
      exo('tirage-vertical', 'Tirage vertical', 4, 8, 10, 45),
      exo('rowing', 'Rowing barre ou poulie basse', 4, 10, 12, 75),
      exo('rdl', 'Soulevé de terre roumain (RDL)', 3, 8, 10, null),
      exo('face-pull', 'Face pull', 4, 10, 12, null),
      exo('curl-barre', 'Curl biceps barre', 3, 10, 12, null),
      exo('curl-marteau', 'Curl marteau', 3, 8, 8, 14),
    ],
  },
  {
    id: 'seance-3',
    nom: 'Legs + abdos',
    exercices: [
      exo('pistol-squat', 'Pistol squat', 4, 6, 8, null, { poidsDuCorps: true, note: 'par jambe' }),
      exo('presse', 'Presse à cuisses', 4, 10, 12, 130, { note: '130 → 100 kg' }),
      exo('fentes-bulgares', 'Fentes bulgares', 3, 10, 10, 8, { note: 'par jambe' }),
      exo('leg-extension', 'Leg extension', 3, 10, 12, 80),
      exo('leg-curl', 'Leg curl', 4, 8, 10, 50),
      exo('mollets', 'Extension mollets', 4, 15, 20, 14),
      exo('abdos-poulie', 'Abdos poulie', 3, 20, 20, 20),
    ],
  },
  {
    id: 'seance-4',
    nom: 'Push/Pull variation',
    exercices: [
      exo('dev-halteres', 'Développé haltères', 4, 8, 10, 20),
      exo('ecarte-poulie', 'Écarté poulie ou développé incliné barre', 3, 10, 12, 5),
      exo('tirage-horizontal-uni', 'Tirage horizontal unilatéral', 4, 10, 12, 75),
      exo('elevations-frontales', 'Élévations frontales ou delts machine', 3, 12, 12, 8, { note: '20 kg à la machine' }),
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
const ICONE_TROPHEE = '<svg class="icone-trophee" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0V4z M7 6H4.5v1.5A3 3 0 0 0 7.5 10.5 M17 6h2.5v1.5a3 3 0 0 1-3 3 M12 14v3.5 M8.5 20h7 M9.5 17.5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONE_COCHE ='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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

/* ---------- Couleurs et mouvement ---------- */

const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)');
const TEINTES = ['teinte-1', 'teinte-2', 'teinte-3', 'teinte-4'];

/** Couleur d'une séance selon sa place dans le programme (Push bleu, Pull vert d'eau, Legs orange, Variation prune). */
function teinte(seanceId) {
  const index = etat.donnees.programme.findIndex((s) => s.id === seanceId);
  return TEINTES[Math.max(0, index) % TEINTES.length];
}

/** Petite vibration au toucher (Android ; ignorée ailleurs). */
function vibrer() {
  if (!mouvementReduit.matches && navigator.vibrate) navigator.vibrate(12);
}

// Les cartes apparaissent en glissant quand elles entrent à l'écran
let debutApparitions = 0;
const observateur = 'IntersectionObserver' in window
  ? new IntersectionObserver((entrees) => {
    for (const entree of entrees) {
      if (!entree.isIntersecting) continue;
      // Hors de la première vague : pas de délai, la carte suit le doigt
      const el = entree.target;
      if (performance.now() - debutApparitions > 600) el.style.setProperty('--delai', '0ms');
      el.classList.add('visible');
      observateur.unobserve(el);
      // Animation finie : on retire les classes pour rendre aux éléments leurs propres transitions
      el.addEventListener('transitionend', function nettoyer(evenement) {
        if (evenement.target !== el || evenement.propertyName !== 'transform') return;
        el.classList.remove('apparition', 'visible');
        el.style.removeProperty('--delai');
        el.removeEventListener('transitionend', nettoyer);
      });
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 })
  : null;

function animerApparitions(conteneur) {
  if (!observateur || mouvementReduit.matches) return;
  debutApparitions = performance.now();
  const elements = conteneur.querySelectorAll('.carte, .carte-sam, .sam-entete, .liste-seances > li, .tuile, .titre-section, .stats--bilan > .stat, .actions');
  elements.forEach((el, i) => {
    el.classList.add('apparition');
    el.style.setProperty('--delai', `${Math.min(i, 7) * 55}ms`);
    observateur.observe(el);
  });
}

/** Pluie de confettis aux couleurs de la séance (fin de séance). */
function lancerConfettis(classeTeinte) {
  if (mouvementReduit.matches || !Element.prototype.animate) return;
  const conteneur = creer('div', `confettis ${classeTeinte}`);
  conteneur.setAttribute('aria-hidden', 'true');
  const couleurs = ['var(--accent)', 'var(--accent-clair)', '#ededf3', 'var(--accent-fort)'];
  for (let i = 0; i < 70; i++) {
    const confetti = creer('span', 'confetti');
    confetti.style.background = couleurs[i % couleurs.length];
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const elan = 220 + Math.random() * 320;
    const dx = Math.cos(angle) * elan;
    const dy = Math.sin(angle) * elan;
    const tour = (Math.random() - 0.5) * 900;
    confetti.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${tour / 2}deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx * 1.25}px, ${dy + 520}px) rotate(${tour}deg)`, opacity: 0 },
    ], { duration: 1500 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
    conteneur.append(confetti);
  }
  document.body.append(conteneur);
  setTimeout(() => conteneur.remove(), 2400);
}

/** Petite gerbe dorée autour d'un point (record battu). */
function eclatDore(x, y) {
  if (mouvementReduit.matches || !Element.prototype.animate) return;
  const conteneur = creer('div', 'eclat');
  conteneur.setAttribute('aria-hidden', 'true');
  conteneur.style.left = `${x}px`;
  conteneur.style.top = `${y}px`;
  for (let i = 0; i < 20; i++) {
    const particule = creer('span', 'eclat__particule');
    const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.3;
    const distance = 38 + Math.random() * 34;
    particule.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0.2)`, opacity: 0 },
    ], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    conteneur.append(particule);
  }
  document.body.append(conteneur);
  setTimeout(() => conteneur.remove(), 1000);
}

/** Fait monter un nombre de 0 à sa valeur (compteurs animés). */
function compterJusqua(el, valeur, formater) {
  el.textContent = formater(valeur);
  if (mouvementReduit.matches || !Number.isFinite(valeur) || valeur === 0) return;
  const debut = performance.now();
  const duree = 1000;
  el.textContent = formater(0);
  const etape = (maintenant) => {
    const avance = Math.min(1, (maintenant - debut) / duree);
    el.textContent = formater(valeur * (1 - (1 - avance) ** 3)); // ralentit à l'arrivée
    if (avance < 1) requestAnimationFrame(etape);
  };
  requestAnimationFrame(etape);
}

const entier = (v) => String(Math.round(v));
const dixieme = (v) => formaterNombre(Math.round(v * 10) / 10);

/** Grand chiffre animé avec unité et légende ; les lecteurs d'écran lisent la phrase complète. */
function creerStat(valeur, formater, unite, legende) {
  const chiffre = creer('span', 'stat__chiffre');
  compterJusqua(chiffre, valeur, formater);
  const ligne = creer('span', 'stat__ligne');
  ligne.setAttribute('aria-hidden', 'true');
  ligne.append(chiffre);
  if (unite) ligne.append(creer('span', 'stat__unite', unite));
  const bas = creer('span', 'stat__legende', legende);
  bas.setAttribute('aria-hidden', 'true');
  const stat = creer('div', 'stat');
  stat.append(ligne, bas, creer('span', 'visuellement-cache', `${legende} : ${formater(valeur)}${unite ? ` ${unite}` : ''}.`));
  return stat;
}

/** Volume en kg ou en tonnes au-delà de 1000 kg : [valeur, format, unité]. */
function volumeAffiche(kg) {
  return kg >= 1000 ? [kg / 1000, dixieme, 't'] : [kg, entier, 'kg'];
}

/** Arc de cercle SVG (degrés, 0 = en haut, sens des aiguilles d'une montre). */
function cheminArc(cx, cy, r, debut, fin) {
  const point = (angle) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(radians)).toFixed(2)} ${(cy + r * Math.sin(radians)).toFixed(2)}`;
  };
  return `M ${point(debut)} A ${r} ${r} 0 ${fin - debut > 180 ? 1 : 0} 1 ${point(fin)}`;
}

/**
 * Anneau découpé en segments (style anneaux d'activité).
 * segments : [{ teinte: 'teinte-1', part: 0 à 1 }] ; part 0 = piste vide.
 */
function creerAnneau(segments, classe = '') {
  const svg = creerSvg('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true', focusable: 'false' }, `anneau ${classe}`);
  const n = segments.length;
  const ecart = n > 1 ? 22 : 0; // degrés entre deux segments (les bouts arrondis en mangent une partie)
  segments.forEach((segment, i) => {
    const debut = (360 / n) * i + ecart / 2;
    const fin = n > 1 ? (360 / n) * (i + 1) - ecart / 2 : 359.99;
    const d = cheminArc(60, 60, 50, debut, fin);
    svg.append(creerSvg('path', { d }, 'anneau__piste'));
    if (segment.part > 0) {
      const arc = creerSvg('path', { d, pathLength: '100' }, `anneau__arc ${segment.teinte}`);
      arc.style.strokeDashoffset = String(100 - Math.min(1, segment.part) * 100);
      arc.style.setProperty('--delai', `${200 + i * 170}ms`);
      svg.append(arc);
    }
  });
  return svg;
}

/** Bandeau doré « Nouveau record » en haut de l'écran (annoncé aux lecteurs d'écran). */
function annoncerRecord(texte) {
  let bandeau = document.getElementById('bandeau-record');
  if (!bandeau) {
    bandeau = creer('div', 'bandeau-record');
    bandeau.id = 'bandeau-record';
    bandeau.setAttribute('role', 'status');
    document.body.append(bandeau);
  }
  bandeau.replaceChildren();
  bandeau.insertAdjacentHTML('beforeend', ICONE_TROPHEE);
  const textes = creer('span', 'bandeau-record__textes');
  textes.append(creer('span', 'bandeau-record__titre', 'Nouveau record !'), creer('span', 'bandeau-record__detail', texte));
  bandeau.append(textes);
  bandeau.classList.remove('bandeau-record--visible');
  void bandeau.offsetWidth; // relance l'animation
  bandeau.classList.add('bandeau-record--visible');
  clearTimeout(annoncerRecord.minuterie);
  annoncerRecord.minuterie = setTimeout(() => bandeau.classList.remove('bandeau-record--visible'), 3200);
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

/* ---------- Records (calculés depuis l'historique, rien de plus n'est stocké) ---------- */

/** Ajoute une série faite aux meilleures marques { poids, rm, reps }. */
function ajouterMarque(marques, s) {
  if (!s || !s.fait || !(s.reps > 0)) return marques;
  const poids = s.poids > 0 ? s.poids : 0;
  const m = marques || { poids: 0, rm: 0, reps: 0 };
  return { poids: Math.max(m.poids, poids), rm: Math.max(m.rm, unRmEstime(poids, s.reps)), reps: Math.max(m.reps, s.reps) };
}

/** Meilleures marques d'un exercice dans l'historique (sauf une séance) ; null s'il n'a jamais été fait. */
function meilleuresMarques(exerciceId, idExclu = null) {
  let marques = null;
  for (const entree of etat.donnees.historique) {
    if (!entree || entree.id === idExclu || !Array.isArray(entree.exercices)) continue;
    for (const ex of entree.exercices) {
      if (!ex || ex.exerciceId !== exerciceId || !Array.isArray(ex.series)) continue;
      for (const s of ex.series) marques = ajouterMarque(marques, s);
    }
  }
  return marques;
}

/** Texte du record battu par une série (« 62,5 kg », « 1RM estimé 78 kg », « 12 reps »), ou ''. */
function texteRecord(exercice, marques, s) {
  if (!marques || !s || !s.fait || !(s.reps > 0)) return '';
  const poids = s.poids > 0 ? s.poids : 0;
  if (poids > marques.poids) return `${formaterNombre(poids)} kg`;
  if (!exercice || exercice.poidsDuCorps || exercice.unite === 's') {
    const unite = exercice && exercice.unite === 's' ? 's' : 'reps';
    return s.reps > marques.reps && poids >= marques.poids ? `${s.reps} ${unite}` : '';
  }
  const rm = unRmEstime(poids, s.reps);
  return poids > 0 && rm > marques.rm + 0.05 ? `1RM estimé ${Math.round(rm)} kg` : '';
}

/**
 * Records d'une liste de séries, dans l'ordre : chaque série est comparée à l'historique
 * et aux séries d'avant. Pas de record la toute première fois qu'on fait l'exercice.
 */
function recordsSeries(series, exercice, marquesAvant) {
  let marques = marquesAvant;
  return series.map((s) => {
    const texte = texteRecord(exercice, marques, s);
    if (marques) marques = ajouterMarque(marques, s);
    return texte;
  });
}

/* ---------- Écrans ---------- */

const ECRANS = ['accueil', 'seance', 'bilan', 'historique', 'detail', 'progression', 'programme', 'exercice', 'sauvegarde', 'sam', 'chat', 'corps'];

/**
 * Affiche un écran : titre, bouton retour, couleur de fond (séance), animations,
 * focus pour les lecteurs d'écran.
 */
function montrerEcran(nom, titre, libelleRetour = 'Retour à l\'accueil', classeTeinte = '', apres = null) {
  const memeEcran = nom === etat.ecran;
  etat.ecran = nom;
  const appliquer = () => {
    for (const ecran of ECRANS) document.getElementById(`ecran-${ecran}`).hidden = ecran !== nom;
    const retour = document.getElementById('bouton-retour');
    retour.hidden = nom === 'accueil';
    retour.setAttribute('aria-label', libelleRetour);
    document.body.classList.remove(...TEINTES);
    if (classeTeinte) document.body.classList.add(classeTeinte);
    const enSeance = nom === 'seance';
    if (!enSeance) document.getElementById('bandeau-record')?.classList.remove('bandeau-record--visible');
    garderEcranAllume(Boolean(etat.donnees.enCours));
    document.getElementById('compteur-seance').hidden = !enSeance;
    document.getElementById('avancement-seance').hidden = !enSeance;

    const h1 = document.getElementById('titre-ecran');
    h1.textContent = titre;
    h1.classList.remove('titre--entree');
    void h1.offsetWidth; // relance l'animation du titre
    h1.classList.add('titre--entree');
    window.scrollTo(0, 0);
    h1.focus({ preventScroll: true });
    animerApparitions(document.getElementById(`ecran-${nom}`));
    if (apres) apres(); // ce qui a besoin de l'écran visible (largeur d'une courbe…)
  };
  if (memeEcran) appliquer();
  else transitionEcran(appliquer);
}

/* ---------- Transitions entre écrans ---------- */

let sensTransition = 'avant'; // « arriere » quand on revient en arrière : la page glisse dans l'autre sens
let transitionsActives = false; // pas de transition au tout premier affichage

/** Change d'écran en glissé-fondu (View Transitions) ; changement immédiat si le navigateur ne sait pas faire. */
function transitionEcran(appliquer) {
  const sens = sensTransition;
  sensTransition = 'avant';
  if (!transitionsActives || !document.startViewTransition || mouvementReduit.matches || document.visibilityState !== 'visible') {
    appliquer();
    return;
  }
  document.documentElement.dataset.sens = sens;
  const transition = document.startViewTransition(appliquer);
  transition.ready.catch(() => {}); // transition sautée (onglet caché…) : l'écran change quand même
}

/** Bouton-carte d'une séance pour l'écran d'accueil. */
function creerBoutonSeance(seance, numero, prochaine) {
  const { historique, enCours } = etat.donnees;
  const nbExercices = seance.exercices.length;
  const enCoursIci = enCours && enCours.seanceId === seance.id;
  let quand;
  if (enCoursIci) {
    const { faites, total } = compterSeries(enCours);
    quand = `${faites}/${total} séries · depuis ${formaterHeure(enCours.debut)}`;
  } else {
    const date = derniereFois(historique, seance.id);
    quand = date ? `Dernière fois : ${formaterDate(date)}` : 'Pas encore faite';
  }

  const bouton = creerBoutonCarte(`Séance ${numero}`, seance.nom, `${nbExercices} exercice${nbExercices > 1 ? 's' : ''} · ${quand}`, numero, teinte(seance.id));
  bouton.dataset.seance = seance.id;
  if (enCoursIci) {
    bouton.querySelector('.seance__numero').append(creer('span', 'puce puce--en-cours', 'En cours'));
    const { faites, total } = compterSeries(enCours);
    const jauge = creer('span', 'seance__jauge');
    const remplissage = document.createElement('span');
    remplissage.style.width = `${total ? Math.round((faites / total) * 100) : 0}%`;
    jauge.append(remplissage);
    bouton.querySelector('.seance__textes').append(jauge);
  } else if (prochaine) {
    bouton.querySelector('.seance__numero').append(creer('span', 'puce', 'Prochaine'));
    bouton.classList.add('seance--prochaine'); // contour lumineux qui tourne
  }
  return bouton;
}

/** Carte cliquable : pastille numérotée de couleur, trois lignes de texte, flèche. */
function creerBoutonCarte(haut, nom, infos, numero, classeTeinte) {
  const pastille = creer('span', 'pastille-seance', numero > 0 ? String(numero) : '·');
  pastille.setAttribute('aria-hidden', 'true');
  const textes = creer('span', 'seance__textes');
  textes.append(
    creer('span', 'seance__numero', haut),
    creer('span', 'seance__nom', nom),
    creer('span', 'seance__infos', infos),
  );
  const bouton = creer('button', `seance ${classeTeinte}`);
  bouton.type = 'button';
  bouton.append(pastille, textes);
  bouton.insertAdjacentHTML('beforeend', ICONE_FLECHE);
  return bouton;
}

/** Lundi 0 h de la semaine en cours (ms). */
function debutSemaine() {
  const d = new Date();
  const lundi = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
  return lundi.getTime();
}

/** Séries faites, volume (kg) et minutes d'une liste de séances passées. */
function totauxSeances(entrees) {
  let series = 0;
  let volume = 0;
  let minutes = 0;
  for (const entree of entrees) {
    if (Number.isFinite(entree.dureeMin)) minutes += entree.dureeMin;
    volume += volumeEntree(entree);
    series += compterSeries(entree).faites;
  }
  return { series, volume, minutes };
}

/** Volume soulevé d'une séance : somme poids × reps des séries faites (lest seul au poids du corps). */
function volumeEntree(entree) {
  let volume = 0;
  for (const ex of entree.exercices) {
    for (const s of ex.series) {
      if (s.fait && s.poids > 0 && s.reps > 0) volume += s.poids * s.reps;
    }
  }
  return volume;
}

/** Carte « Cette semaine » : anneau à un segment par séance prévue, chiffres de la semaine. */
function remplirSemaine() {
  const debut = debutSemaine();
  const faites = entreesHistorique().filter((e) => tempsDepuisId(e.id) >= debut).reverse();
  const objectif = Math.max(1, etat.donnees.programme.length);
  const reste = objectif - faites.length;

  // Anneau : chaque séance faite remplit un segment, à sa couleur
  const segments = Array.from({ length: Math.max(objectif, faites.length) }, (_, i) => (
    faites[i] ? { teinte: teinte(faites[i].seanceId), part: 1 } : { teinte: '', part: 0 }));
  const centre = creer('span', 'anneau__centre');
  centre.setAttribute('aria-hidden', 'true');
  const nombre = creer('span', 'anneau__nombre');
  compterJusqua(nombre, faites.length, entier);
  centre.append(nombre, creer('span', 'anneau__sur', `sur ${objectif}`));
  const visuel = creer('div', 'anneau-bloc');
  visuel.append(creerAnneau(segments), centre);

  const titre = creer('h2', 'semaine__titre', 'Cette semaine');
  titre.id = 'titre-semaine';
  let texte;
  if (faites.length === 0) texte = 'Nouvelle semaine : c\'est parti.';
  else if (reste > 0) texte = `Encore ${reste} séance${reste > 1 ? 's' : ''} pour boucler la semaine.`;
  else texte = 'Semaine bouclée. Bravo !';
  const phrase = creer('p', 'semaine__texte', texte);
  phrase.prepend(creer('span', 'visuellement-cache', `${faites.length} séance${faites.length > 1 ? 's' : ''} sur ${objectif}. `));

  // Pastilles des séances faites : le nom accompagne toujours la couleur
  const faitesListe = creer('ul', 'semaine__faites');
  faitesListe.setAttribute('aria-label', 'Séances faites cette semaine');
  for (const entree of faites) {
    const puce = creer('li', `semaine__puce ${teinte(entree.seanceId)}`, nomSeance(entree.seanceId));
    faitesListe.append(puce);
  }
  const textes = creer('div', 'semaine__textes');
  textes.append(titre, phrase);
  if (faites.length) textes.append(faitesListe);

  const haut = creer('div', 'semaine__haut');
  haut.append(visuel, textes);

  const totaux = totauxSeances(faites);
  const [volume, formatVolume, uniteVolume] = volumeAffiche(totaux.volume);
  const stats = creer('div', 'stats');
  stats.append(
    creerStat(totaux.series, entier, '', 'Séries'),
    creerStat(volume, formatVolume, uniteVolume, 'Volume'),
    creerStat(totaux.minutes, entier, 'min', 'Entraînement'),
  );

  const carte = document.getElementById('semaine');
  carte.classList.toggle('semaine--bouclee', faites.length >= objectif);
  carte.replaceChildren(haut, stats);
}

/** Petites infos des tuiles de l'accueil. */
function remplirTuiles() {
  const { historique, programme, derniereSauvegarde } = etat.donnees;
  const nb = historique.length;
  const nbExercices = programme.reduce((total, s) => total + s.exercices.length, 0);
  document.getElementById('info-historique').textContent = `${nb} séance${nb > 1 ? 's' : ''}`;
  document.getElementById('info-programme').textContent = `${nbExercices} exercices`;
  document.getElementById('info-sauvegarde').textContent = Number.isFinite(derniereSauvegarde)
    ? `Faite ${ilYA(derniereSauvegarde)}` : 'Jamais faite';
  const pesees = listePoidsCorps();
  const derniere = pesees[pesees.length - 1];
  document.getElementById('info-corps').textContent = derniere
    ? `${formaterNombre(derniere.poids)} kg · ${ilYA(tempsDate(derniere.date))}` : 'Note ton poids';
}

/** Date de la dernière fois qu'une séance a été faite, ou null. */
function derniereFois(historique, seanceId) {
  const dates = historique
    .filter((s) => s && s.seanceId === seanceId && typeof s.id === 'string')
    .map((s) => s.id)
    .sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/** Écran d'accueil : semaine, séances, tuiles. */
function afficherAccueil() {
  const { programme, historique } = etat.donnees;
  // « Prochaine » : la première séance du programme pas encore faite cette semaine
  const debut = debutSemaine();
  const faitesCetteSemaine = new Set(historique.filter((e) => e && tempsDepuisId(String(e.id)) >= debut).map((e) => e.seanceId));
  const prochaine = programme.find((s) => !faitesCetteSemaine.has(s.id));

  remplirSemaine();
  remplirTuiles();
  document.getElementById('info-sam').textContent = resumeSam(analyserAvecSam());
  document.getElementById('liste-seances').replaceChildren(...programme.map((seance, i) => {
    const item = document.createElement('li');
    item.append(creerBoutonSeance(seance, i + 1, !etat.donnees.enCours && seance === prochaine));
    return item;
  }));
  montrerEcran('accueil', 'Salut Guillaume');
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
  const ligne = creer('div', serie.fait ? 'serie serie--faite' : 'serie');
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

  const compte = creer('span', 'exercice__compte');
  const haut = creer('div', 'exercice__haut');
  haut.append(titre, compte);

  const carte = creer('article', 'carte exercice');
  carte.dataset.exercice = i;
  carte.setAttribute('aria-labelledby', titre.id);
  carte.append(haut, creer('p', 'exercice__cible', texteCible(exercice)));
  if (definition) carte.append(creerConseilSeance(definition, i));
  carte.append(series);
  majCarteExercice(carte, exEnCours);
  majRecords(carte, exEnCours, definition);
  return carte;
}

/** Médaille dorée sur les séries record d'une carte ; renvoie les textes des records (un par série). */
function majRecords(carte, exEnCours, exercice) {
  const textes = recordsSeries(exEnCours.series, exercice, meilleuresMarques(exEnCours.exerciceId));
  carte.querySelectorAll('.serie').forEach((ligne, j) => {
    const record = Boolean(textes[j]);
    if (ligne.classList.contains('serie--record') === record) return;
    ligne.classList.toggle('serie--record', record);
    const numero = ligne.querySelector('.serie__numero');
    numero.textContent = String(j + 1);
    if (record) numero.append(creer('span', 'visuellement-cache', ' (record)'));
  });
  return textes;
}

/** Record battu : gerbe dorée sur la case, bandeau, vibration. */
function celebrerRecord(ligne, texte) {
  const boite = ligne.querySelector('.coche__boite').getBoundingClientRect();
  eclatDore(boite.left + boite.width / 2, boite.top + boite.height / 2);
  annoncerRecord(texte);
  if (!mouvementReduit.matches && navigator.vibrate) navigator.vibrate([20, 60, 40]);
}

/** Compteur « 2/4 » et état « terminé » d'une carte d'exercice. */
function majCarteExercice(carte, exEnCours) {
  const faites = exEnCours.series.filter((s) => s.fait).length;
  const total = exEnCours.series.length;
  const termine = total > 0 && faites === total;
  const compte = carte.querySelector('.exercice__compte');
  compte.textContent = termine ? 'Terminé' : `${faites}/${total}`;
  const etaitTermine = carte.classList.contains('exercice--termine');
  carte.classList.toggle('exercice--termine', termine);
  if (termine && !etaitTermine && carte.isConnected) {
    relancerAnimation(compte, 'pop');
    relancerAnimation(carte, 'exercice--brille'); // reflet qui balaie la carte
  }
}

/** Retire puis remet une classe d'animation pour la rejouer. */
function relancerAnimation(el, classe) {
  el.classList.remove(classe);
  void el.offsetWidth;
  el.classList.add(classe);
}

/** Barre d'avancement et compteur de la séance (barre du haut). */
function majAvancement() {
  const enCours = etat.donnees.enCours;
  if (!enCours) return;
  const { faites, total } = compterSeries(enCours);
  const pourcentage = total ? Math.round((faites / total) * 100) : 0;
  document.querySelector('#avancement-seance span').style.width = `${pourcentage}%`;
  const compteur = document.getElementById('compteur-seance');
  const texte = `${faites}/${total}`;
  if (compteur.textContent && compteur.textContent !== texte) relancerAnimation(compteur, 'pop');
  compteur.textContent = texte;
  compteur.setAttribute('aria-label', `${faites} séries faites sur ${total}`);
  const terminer = document.querySelector('[data-action="terminer"]');
  if (terminer) terminer.classList.toggle('bouton--pret', total > 0 && faites === total);
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
  montrerEcran('seance', seance ? seance.nom : 'Séance', 'Retour à l\'accueil', teinte(enCours.seanceId));
  majAvancement();
}

/* ---------- Minuteur de repos et écran allumé ---------- */

const minuteur = { fin: 0, total: 0, nom: '', tic: null };
let contexteAudio = null;
let verrouEcran = null;

/** Repos en secondes : milieu de la fourchette conseillée par Sam. */
function secondesRepos(exercice) {
  if (!exercice) return 90;
  if (exercice.unite === 's') return 60;
  if (LOURDS.has(exercice.id)) return 150;
  if (estIsolation(exercice)) return 75;
  return 105;
}

/** 95 → « 1:35 ». */
function formaterChrono(secondes) {
  const s = Math.max(0, Math.ceil(secondes));
  return `${Math.floor(s / 60)}:${deuxChiffres(s % 60)}`;
}

/** Le son doit être autorisé pendant un toucher (règle des navigateurs mobiles). */
function preparerSon() {
  const Contexte = window.AudioContext || window.webkitAudioContext;
  if (!Contexte) return;
  if (!contexteAudio) contexteAudio = new Contexte();
  if (contexteAudio.state === 'suspended') contexteAudio.resume();
}

/** Trois bips courts de fin de repos. */
function biper() {
  if (!contexteAudio) return;
  const debut = contexteAudio.currentTime;
  for (let i = 0; i < 3; i++) {
    const t = debut + i * 0.25;
    const oscillateur = contexteAudio.createOscillator();
    const volume = contexteAudio.createGain();
    oscillateur.frequency.value = 880;
    volume.gain.setValueAtTime(0.0001, t);
    volume.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    oscillateur.connect(volume).connect(contexteAudio.destination);
    oscillateur.start(t);
    oscillateur.stop(t + 0.2);
  }
}

/** Barre du minuteur, en bas de l'écran (créée une seule fois). */
function elementMinuteur() {
  let el = document.getElementById('minuteur');
  if (el) return el;
  el = creer('div', 'minuteur');
  el.id = 'minuteur';
  el.hidden = true;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'Minuteur de repos');

  const jauge = creer('span', 'minuteur__jauge');
  jauge.append(document.createElement('span'));
  const textes = creer('div', 'minuteur__textes');
  const temps = creer('span', 'minuteur__temps');
  temps.setAttribute('role', 'timer');
  textes.append(creer('span', 'minuteur__libelle'), temps);
  const boutons = creer('div', 'minuteur__boutons');
  for (const [action, texte, libelle] of [['moins', '−15', 'Retirer 15 secondes'], ['plus', '+15', 'Ajouter 15 secondes'], ['passer', 'Passer', 'Arrêter le repos']]) {
    const bouton = creer('button', 'minuteur__bouton', texte);
    bouton.type = 'button';
    bouton.dataset.minuteur = action;
    bouton.setAttribute('aria-label', libelle);
    boutons.append(bouton);
  }
  const annonce = creer('span', 'visuellement-cache');
  annonce.id = 'annonce-minuteur';
  annonce.setAttribute('role', 'status');
  el.append(jauge, textes, boutons, annonce);

  el.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('[data-minuteur]');
    if (!bouton) return;
    if (bouton.dataset.minuteur === 'passer') arreterMinuteur();
    else ajusterMinuteur(bouton.dataset.minuteur === 'plus' ? 15 : -15);
  });
  document.body.append(el);
  return el;
}

/** Démarre le repos (en heures absolues : juste même si l'appli passe en arrière-plan). */
function lancerMinuteur(secondes, nom) {
  minuteur.total = secondes;
  minuteur.fin = Date.now() + secondes * 1000;
  minuteur.nom = nom;
  const el = elementMinuteur();
  el.classList.remove('minuteur--fini');
  el.hidden = false;
  document.body.classList.add('avec-minuteur');
  clearInterval(minuteur.tic);
  minuteur.tic = setInterval(majMinuteur, 250);
  majMinuteur();
}

function ajusterMinuteur(delta) {
  minuteur.fin = Math.max(Date.now() + 1000, minuteur.fin + delta * 1000);
  minuteur.total = Math.max(1, minuteur.total + delta);
  majMinuteur();
}

function arreterMinuteur() {
  clearInterval(minuteur.tic);
  minuteur.tic = null;
  const el = document.getElementById('minuteur');
  if (el) el.hidden = true;
  document.body.classList.remove('avec-minuteur');
}

function majMinuteur() {
  const el = elementMinuteur();
  const reste = (minuteur.fin - Date.now()) / 1000;
  if (reste <= 0) {
    finMinuteur();
    return;
  }
  el.querySelector('.minuteur__libelle').textContent = `Repos · ${minuteur.nom}`;
  el.querySelector('.minuteur__temps').textContent = formaterChrono(reste);
  el.classList.toggle('minuteur--bientot', reste <= 5); // les 5 dernières secondes battent
  el.querySelector('.minuteur__jauge span').style.width = `${Math.min(100, (reste / minuteur.total) * 100)}%`;
}

/** Fin du repos : bips + vibration (Android), message, puis la barre disparaît. */
function finMinuteur() {
  clearInterval(minuteur.tic);
  minuteur.tic = null;
  const el = elementMinuteur();
  el.classList.remove('minuteur--bientot');
  el.classList.add('minuteur--fini');
  el.querySelector('.minuteur__libelle').textContent = 'Repos terminé';
  el.querySelector('.minuteur__temps').textContent = 'C\'est reparti !';
  el.querySelector('.minuteur__jauge span').style.width = '0%';
  document.getElementById('annonce-minuteur').textContent = 'Repos terminé : série suivante.';
  biper();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  setTimeout(() => {
    if (!minuteur.tic) arreterMinuteur();
  }, 4000);
}

/** Écran allumé pendant une séance (Wake Lock ; ignoré si le navigateur ne le permet pas). */
async function garderEcranAllume(actif) {
  if (!('wakeLock' in navigator)) return;
  try {
    if (actif && !verrouEcran && document.visibilityState === 'visible') {
      verrouEcran = await navigator.wakeLock.request('screen');
      verrouEcran.addEventListener('release', () => {
        verrouEcran = null;
      });
    } else if (!actif && verrouEcran) {
      await verrouEcran.release();
      verrouEcran = null;
    }
  } catch {
    verrouEcran = null;
  }
}

/* ---------- Échauffement et disques ---------- */

const DISQUES = [25, 20, 15, 10, 5, 2.5, 1.25];
const BARRES_EXERCICES = new Set(['dev-couche', 'rdl', 'rowing', 'curl-barre']);

function estBarre(exercice) {
  return BARRES_EXERCICES.has(exercice.id) || /\bbarre\b/i.test(exercice.nom);
}

/** L'aide a du sens pour les exercices chargés à la barre ou polyarticulaires. */
function aideChargeUtile(exercice) {
  return !exercice.poidsDuCorps && exercice.unite !== 's' && (estBarre(exercice) || !estIsolation(exercice));
}

/** Disques par côté (du plus lourd au plus léger) ; null si moins lourd que la barre. */
function disquesParCote(total, barre) {
  let reste = (total - barre) / 2;
  if (reste < 0) return null;
  const disques = [];
  for (const disque of DISQUES) {
    while (reste >= disque - 1e-9) {
      disques.push(disque);
      reste -= disque;
    }
  }
  return { disques, charge: barre + 2 * disques.reduce((a, b) => a + b, 0) };
}

/** Séries d'échauffement : 50 % × 8, 70 % × 5, 85 % × 2 (au-delà de 60 kg), arrondies à 2,5 kg. */
function seriesEchauffement(poids, minimum) {
  const paliers = poids >= 60 ? [[0.5, 8], [0.7, 5], [0.85, 2]] : [[0.5, 8], [0.75, 4]];
  const series = paliers.map(([part, reps]) => ({ poids: Math.max(minimum, arrondirCharge(poids * part, 2.5)), reps }));
  return series.filter((s, i) => s.poids < poids && (i === 0 || s.poids > series[i - 1].poids));
}

/** Contenu du panneau « Échauffement » d'un exercice, d'après le poids de la prochaine série. */
function remplirAideCharge(panneau, exercice, i) {
  const series = etat.donnees.enCours.exercices[i].series;
  const cible = series.find((s) => !s.fait && typeof s.poids === 'number') || series.find((s) => typeof s.poids === 'number');
  if (!cible) {
    panneau.replaceChildren(creer('p', 'aide-charge__texte', 'Saisis un poids pour calculer ton échauffement et tes disques.'));
    return;
  }
  const poids = cible.poids;
  const barre = etat.barre || 20;
  const blocs = [];

  if (!estIsolation(exercice)) {
    const echauffement = poids >= 20 ? seriesEchauffement(poids, estBarre(exercice) ? barre : 0) : [];
    blocs.push(creer('p', 'aide-charge__texte', echauffement.length
      ? `Échauffement avant ${formaterNombre(poids)} kg : ${echauffement.map((s) => `${formaterNombre(s.poids)} kg × ${s.reps}`).join(' · ')} (1 min de repos entre).`
      : 'Charge légère : une série à vide suffit pour t\'échauffer.'));
  }

  if (estBarre(exercice)) {
    const choix = creer('fieldset', 'formulaire__choix aide-charge__barre');
    choix.append(creer('legend', 'etiquette', 'Barre'), ...[20, 15, 10].map((b) => creerPastille('radio', `barre-${i}`, String(b), `${b} kg`, b === barre)));
    const calcul = disquesParCote(poids, barre);
    let texte;
    const visuel = creer('div', 'disques');
    visuel.setAttribute('aria-hidden', 'true');
    if (!calcul) {
      texte = `${formaterNombre(poids)} kg : moins lourd que la barre seule.`;
    } else if (!calcul.disques.length) {
      texte = 'Barre seule, sans disque.';
    } else {
      texte = `Par côté : ${calcul.disques.map(formaterNombre).join(' + ')} kg`;
      if (Math.abs(calcul.charge - poids) > 1e-9) texte += ` (le plus proche : ${formaterNombre(calcul.charge)} kg)`;
      visuel.append(creer('span', 'disques__barre'), ...calcul.disques.map((d) => {
        const disque = creer('span', 'disque', formaterNombre(d));
        disque.style.setProperty('--taille', String(Math.round(14 + d * 1.2)));
        return disque;
      }));
    }
    blocs.push(choix, visuel, creer('p', 'aide-charge__texte', texte));
  }
  panneau.replaceChildren(...blocs);
}

/** Ouvre ou ferme le panneau d'aide d'un exercice. */
function basculerAideCharge(bouton) {
  const i = Number(bouton.dataset.aide);
  const panneau = document.getElementById(`aide-${i}`);
  const ouvrir = panneau.hidden;
  if (ouvrir) {
    const exercice = trouverExerciceDansProgramme(etat.donnees.enCours.exercices[i].exerciceId);
    if (exercice) remplirAideCharge(panneau, exercice, i);
  }
  panneau.hidden = !ouvrir;
  bouton.setAttribute('aria-expanded', String(ouvrir));
}

/** Rafraîchit le panneau d'aide s'il est ouvert (poids modifié). */
function majAideCharge(i) {
  const panneau = document.getElementById(`aide-${i}`);
  if (!panneau || panneau.hidden) return;
  const exercice = trouverExerciceDansProgramme(etat.donnees.enCours.exercices[i].exerciceId);
  if (exercice) remplirAideCharge(panneau, exercice, i);
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
  if (champ === 'poids') {
    propagerPoids(series, i, j, ancienne, nouvelle);
    majAideCharge(i);
  }
  const exEnCours = etat.donnees.enCours.exercices[i];
  majRecords(ligne.closest('.exercice'), exEnCours, trouverExerciceDansProgramme(exEnCours.exerciceId));
  etat.donnees.enCours.derniereAction = Date.now();
  enregistrer();
}

/** Coche ou décoche une série : enregistrement, animation, compteurs. */
function cocherSerie(caseFait) {
  const ligne = caseFait.closest('.serie');
  const exEnCours = etat.donnees.enCours.exercices[Number(ligne.dataset.exercice)];
  const serie = exEnCours.series[Number(ligne.dataset.serie)];
  serie.fait = caseFait.checked;
  etat.donnees.enCours.derniereAction = Date.now();
  enregistrer();

  ligne.classList.toggle('serie--faite', serie.fait);
  if (serie.fait) {
    const boite = ligne.querySelector('.coche__boite');
    boite.classList.remove('pop');
    void boite.offsetWidth; // relance l'animation
    boite.classList.add('pop');
    vibrer();
  }
  const carte = ligne.closest('.exercice');
  majCarteExercice(carte, exEnCours);
  majAvancement();
  const exercice = trouverExerciceDansProgramme(exEnCours.exerciceId);
  const records = majRecords(carte, exEnCours, exercice);
  const record = records[Number(ligne.dataset.serie)];
  if (serie.fait && record) celebrerRecord(ligne, `${exercice ? exercice.nom : 'Exercice'} · ${record}`);

  if (serie.fait) {
    preparerSon();
    const { faites, total } = compterSeries(etat.donnees.enCours);
    if (faites < total) lancerMinuteur(secondesRepos(exercice), exercice ? exercice.nom : 'série suivante');
    else arreterMinuteur();
  }
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

  arreterMinuteur();
  afficherMessage(etat.enregistrable ? '' : 'Séance terminée mais non enregistrée (stockage indisponible).');
  afficherBilan(entree);
}

function abandonnerSeance() {
  if (!confirm('Abandonner cette séance ? Rien ne sera ajouté à l\'historique.')) return;
  arreterMinuteur();
  delete etat.donnees.enCours;
  enregistrer();
  afficherMessage('');
  sensTransition = 'arriere';
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

/* ---------- Bilan de fin de séance ---------- */

/** Comparaison avec la fois d'avant (même séance) : une phrase, la flèche dit le sens. */
function texteComparaison(entree) {
  const avant = entreesHistorique().find((e) => e.seanceId === entree.seanceId && e.id < entree.id);
  if (!avant) return 'Première fois que tu fais cette séance : elle sert de référence.';
  const volume = volumeEntree(entree);
  const volumeAvant = volumeEntree(avant);
  const quand = `par rapport au ${formaterDate(avant.id)}`;
  if (!volume || !volumeAvant) return `Dernière fois : ${formaterDate(avant.id)}.`;
  const ecart = Math.round(((volume - volumeAvant) / volumeAvant) * 100);
  if (ecart === 0) return `Volume identique ${quand}.`;
  return `${ecart > 0 ? '↑' : '↓'} Volume ${ecart > 0 ? '+' : '−'}${Math.abs(ecart)} % ${quand}.`;
}

/** Records battus pendant une séance : un par exercice, la charge avant le 1RM estimé. */
function recordsEntree(entree) {
  const records = [];
  for (const ex of entree.exercices) {
    const exercice = trouverExerciceDansProgramme(ex.exerciceId);
    const textes = recordsSeries(ex.series, exercice, meilleuresMarques(ex.exerciceId, entree.id)).filter(Boolean);
    const charges = textes.filter((t) => !t.startsWith('1RM'));
    const texte = charges.length ? charges[charges.length - 1] : textes[textes.length - 1];
    if (texte) records.push({ nom: exercice ? exercice.nom : 'Exercice retiré', texte });
  }
  return records;
}

/** Écran de bilan après « Terminer » : anneau des séries, chiffres animés, records, comparaison. */
function afficherBilan(entree) {
  const nom = nomSeance(entree.seanceId);
  const classeTeinte = teinte(entree.seanceId);
  const { faites, total } = compterSeries(entree);
  const records = recordsEntree(entree);

  // En-tête : anneau des séries faites, pourcentage au centre
  const centre = creer('span', 'anneau__centre');
  centre.setAttribute('aria-hidden', 'true');
  const pourcentage = creer('span', 'anneau__nombre');
  compterJusqua(pourcentage, total ? Math.round((faites / total) * 100) : 0, (v) => `${Math.round(v)} %`);
  centre.append(pourcentage, creer('span', 'anneau__sur', 'des séries'));
  const visuel = creer('div', 'anneau-bloc anneau-bloc--bilan');
  visuel.append(creer('span', 'bilan__rayons'), creerAnneau([{ teinte: classeTeinte, part: total ? faites / total : 0 }]), centre);

  const titre = creer('h2', 'bilan__titre', `${nom} terminée`);
  const heure = heureDepuisId(entree.id);
  const quand = creer('p', 'texte-secondaire', `${formaterDate(entree.id)}${heure ? ` à ${heure}` : ''}`);
  const comparaison = creer('p', 'bilan__comparaison', texteComparaison(entree));
  const textes = creer('div', 'bilan__textes');
  textes.append(titre, quand, comparaison);
  const entete = creer('section', `carte bilan ${classeTeinte}`);
  entete.append(visuel, textes);

  // Chiffres de la séance
  const [volume, formatVolume, uniteVolume] = volumeAffiche(volumeEntree(entree));
  const stats = creer('div', 'stats stats--bilan');
  stats.append(
    creerStat(entree.dureeMin, entier, 'min', 'Durée'),
    creerStat(volume, formatVolume, uniteVolume, 'Volume'),
    creerStat(faites, entier, `/ ${total}`, 'Séries'),
    creerStat(records.length, entier, '', records.length > 1 ? 'Records' : 'Record'),
  );

  // Records : médaille dorée, sinon un mot d'encouragement
  const carteRecords = creer('section', 'carte');
  carteRecords.append(creer('h2', 'exercice__nom', records.length ? 'Nouveaux records' : 'Records'));
  if (records.length) {
    const liste = creer('ul', 'liste-records');
    for (const record of records) {
      const ligne = creer('li', 'liste-records__ligne');
      ligne.insertAdjacentHTML('beforeend', ICONE_TROPHEE);
      const texte = creer('span', 'liste-records__texte');
      texte.append(creer('span', '', record.nom), creer('span', 'liste-records__valeur', record.texte));
      ligne.append(texte);
      liste.append(ligne);
    }
    carteRecords.append(liste);
  } else {
    carteRecords.append(creer('p', 'carte__texte texte-secondaire', 'Pas de record cette fois. La régularité paie : vise une rep de plus la prochaine fois.'));
  }

  const accueil = creer('button', 'bouton bouton--principal', 'Retour à l\'accueil');
  accueil.type = 'button';
  accueil.dataset.action = 'accueil';
  const detail = creer('button', 'bouton bouton--secondaire', 'Voir le détail des séries');
  detail.type = 'button';
  detail.dataset.action = 'detail';
  detail.dataset.entree = entree.id;
  const actions = creer('div', 'actions');
  actions.append(accueil, detail);

  document.getElementById('ecran-bilan').replaceChildren(entete, stats, carteRecords, actions);
  montrerEcran('bilan', 'Bravo !', 'Retour à l\'accueil', classeTeinte, () => {
    setTimeout(() => lancerConfettis(classeTeinte), 300); // après le glissé de l'écran
    if (records.length && navigator.vibrate && !mouvementReduit.matches) navigator.vibrate([20, 60, 40]);
  });
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
      const numero = etat.donnees.programme.findIndex((s) => s.id === entree.seanceId) + 1;
      const bouton = creerBoutonCarte(`${formaterDate(entree.id)}${heure ? ` · ${heure}` : ''}`, nomSeance(entree.seanceId), infos, numero, teinte(entree.seanceId));
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
  montrerEcran('detail', nomSeance(entree.seanceId), 'Retour à l\'historique', teinte(entree.seanceId));
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
  sensTransition = 'arriere';
  if (etat.ecran === 'seance') retourAccueil();
  else if (etat.ecran === 'detail') afficherHistorique();
  else if (etat.ecran === 'exercice') afficherProgramme();
  else if (etat.ecran === 'chat') afficherSam();
  else afficherAccueil();
}

/* ---------- Progression ---------- */

const SVG_NS = 'http://www.w3.org/2000/svg';
let compteurGraphes = 0;

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
  const pas = [0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
    .find((p) => Math.ceil(max / p) - Math.floor(min / p) <= 4) ?? 25000;
  const valeurs = [];
  for (let v = Math.max(0, Math.floor(min / pas) * pas); v <= max + pas - 1e-9; v += pas) {
    valeurs.push(Math.round(v * 100) / 100);
    if (v >= max) break;
  }
  return valeurs;
}

/** « +5 kg depuis le 01/09/2026 » entre le premier et le dernier point. */
function texteEvolution(points, unite = 'kg') {
  const ecart = Math.round((points[points.length - 1].valeur - points[0].valeur) * 100) / 100;
  const signe = ecart > 0 ? '+' : ecart < 0 ? '−' : '±';
  return `${signe}${formaterNombre(Math.abs(ecart))} ${unite} depuis le ${formaterDate(points[0].id)}`;
}

/* Mesures de progression : meilleur poids, 1RM estimé (formule d'Epley), volume */
const MESURES = {
  poids: { libelle: 'Meilleur poids', nom: 'du meilleur poids' },
  rm: { libelle: '1RM estimé', nom: 'du 1RM estimé' },
  volume: { libelle: 'Volume', nom: 'du volume' },
};

/** 1RM estimé (Epley) : charge × (1 + reps / 30). */
function unRmEstime(poids, reps) {
  return reps <= 1 ? poids : poids * (1 + reps / 30);
}

/** Mesures possibles pour un exercice (pas de 1RM au poids du corps ou au temps). */
function mesuresPossibles(exercice) {
  return exercice.poidsDuCorps || exercice.unite === 's' ? ['poids', 'volume'] : ['poids', 'rm', 'volume'];
}

/** Unité affichée : kg, ou reps / s pour le volume d'un exercice au poids du corps. */
function uniteMesure(exercice, mesure) {
  if (mesure !== 'volume' || !(exercice.poidsDuCorps || exercice.unite === 's')) return 'kg';
  return exercice.unite === 's' ? 's' : 'reps';
}

/** Un point par séance pour la mesure choisie : { id, temps, valeur, texte }. */
function pointsMesure(exercice, mesure) {
  const unite = uniteMesure(exercice, mesure);
  const points = [];
  for (const entree of entreesHistorique().reverse()) {
    const ex = entree.exercices.find((e) => e && e.exerciceId === exercice.id);
    const temps = tempsDepuisId(entree.id);
    const faites = ex ? ex.series.filter((s) => s.fait) : [];
    if (!faites.length || !Number.isFinite(temps)) continue;
    let valeur = null;
    let texte = '';
    if (mesure === 'poids') {
      const meilleure = meilleureSerie(ex.series);
      if (meilleure) {
        valeur = meilleure.poids;
        texte = texteSerie(exercice, meilleure);
      }
    } else if (mesure === 'rm') {
      let meilleure = null;
      for (const serie of faites) {
        if (typeof serie.poids !== 'number' || typeof serie.reps !== 'number' || serie.reps < 1) continue;
        const rm = unRmEstime(serie.poids, serie.reps);
        if (!meilleure || rm > meilleure.rm) meilleure = { rm, serie };
      }
      if (meilleure) {
        valeur = Math.round(meilleure.rm * 2) / 2;
        texte = `${formaterNombre(valeur)} kg · ${texteSerie(exercice, meilleure.serie)}`;
      }
    } else if (unite === 'kg') {
      const total = faites.reduce((somme, s) => somme + (typeof s.poids === 'number' && typeof s.reps === 'number' ? s.poids * s.reps : 0), 0);
      valeur = Math.round(total);
      texte = `${formaterNombre(valeur)} kg · ${faites.length} série${faites.length > 1 ? 's' : ''}`;
    } else {
      valeur = faites.reduce((somme, s) => somme + (typeof s.reps === 'number' ? s.reps : 0), 0);
      texte = `${valeur} ${unite} · ${faites.length} série${faites.length > 1 ? 's' : ''}`;
    }
    if (valeur !== null && valeur > 0) points.push({ id: entree.id, temps, valeur, texte });
  }
  return points;
}

/**
 * Courbe SVG maison. Toucher ou glisser sur la courbe (ou flèches du clavier)
 * choisit un point ; sa valeur s'affiche dans la zone de lecture.
 */
function dessinerGraphe(zone, lecture, points, options, animer) {
  const largeur = Math.max(240, Math.floor(zone.clientWidth));
  const hauteur = 200;
  const marge = { haut: 12, droite: 12, bas: 28, gauche: 40 };
  const valeurs = points.map((p) => p.valeur);
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
    'aria-label': `Courbe ${options.nom} : ${points.length} point${points.length > 1 ? 's' : ''}, `
      + `de ${formaterNombre(premier.valeur)} ${options.unite} le ${formaterDate(premier.id)} à ${formaterNombre(dernier.valeur)} ${options.unite} le ${formaterDate(dernier.id)}. `
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

  // Aire en dégradé sous la courbe (lavis léger de la couleur de la séance)
  const defs = creerSvg('defs', {});
  const idDegrade = `degrade-aire-${++compteurGraphes}`; // unique : plusieurs courbes peuvent coexister dans la page
  const degrade = creerSvg('linearGradient', { id: idDegrade, x1: 0, y1: 0, x2: 0, y2: 1 });
  degrade.append(
    creerSvg('stop', { offset: 0, 'stop-color': 'currentColor', 'stop-opacity': 0.28 }),
    creerSvg('stop', { offset: 1, 'stop-color': 'currentColor', 'stop-opacity': 0 }),
  );
  defs.append(degrade);
  graphe.prepend(defs);
  const trace = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.temps).toFixed(1)},${y(p.valeur).toFixed(1)}`).join('');
  const bas = hauteur - marge.bas;
  const aire = creerSvg('path', { d: `${trace}L${x(t1).toFixed(1)},${bas}L${x(t0).toFixed(1)},${bas}Z`, fill: `url(#${idDegrade})` }, 'graphe__aire');
  const ligne = creerSvg('path', { d: trace }, 'graphe__ligne');
  graphe.append(aire, ligne);
  // Points (anneau couleur de la carte pour les détacher de la ligne)
  const ronds = points.map((p) => creerSvg('circle', { cx: x(p.temps), cy: y(p.valeur), r: 4 }, 'graphe__point'));
  graphe.append(...ronds);

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
    choix.setAttribute('cy', y(p.valeur));
    lecture.replaceChildren(
      creer('span', 'lecture__valeur', p.texte),
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

  // La courbe se dessine de gauche à droite, puis les points apparaissent
  if (animer && !mouvementReduit.matches && ligne.getTotalLength) {
    const longueur = ligne.getTotalLength();
    ligne.animate([{ strokeDasharray: longueur, strokeDashoffset: longueur }, { strokeDasharray: longueur, strokeDashoffset: 0 }],
      { duration: 900, easing: 'cubic-bezier(.4,0,.2,1)' });
    aire.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 400, fill: 'backwards' });
    ronds.forEach((rond, i) => rond.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 250, delay: (900 * i) / Math.max(1, ronds.length - 1), fill: 'backwards' }));
    [curseur, choix].forEach((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 900, fill: 'backwards' }));
  }
}

/** Tableau des valeurs (équivalent accessible de la courbe), la plus récente en premier. */
function creerTableauProgression(points, titreValeur) {
  const tableau = creer('table', 'tableau');
  const legende = creer('caption', 'visuellement-cache', `${titreValeur} par date`);
  const entete = creer('thead', '');
  const ligneEntete = document.createElement('tr');
  for (const titre of ['Date', titreValeur]) {
    const th = creer('th', '', titre);
    th.scope = 'col';
    ligneEntete.append(th);
  }
  entete.append(ligneEntete);
  const corps = document.createElement('tbody');
  for (const p of [...points].reverse()) {
    const ligne = document.createElement('tr');
    ligne.append(creer('td', '', formaterDate(p.id)), creer('td', '', p.texte));
    corps.append(ligne);
  }
  tableau.append(legende, entete, corps);
  return tableau;
}

/* ---------- Carte du corps : muscles travaillés cette semaine ---------- */

/** Séries faites depuis lundi par muscle (principal = 1, secondaire = ½), séance en cours comprise. */
function seriesSemaineParMuscle() {
  const volume = Object.fromEntries(Object.keys(NOMS_MUSCLES).map((m) => [m, 0]));
  const debut = debutSemaine();
  const seances = entreesHistorique().filter((e) => tempsDepuisId(e.id) >= debut);
  if (etat.donnees.enCours) seances.push(etat.donnees.enCours);
  for (const seance of seances) {
    for (const ex of seance.exercices) {
      const exercice = trouverExerciceDansProgramme(ex.exerciceId);
      if (!exercice) continue;
      const faites = ex.series.filter((serie) => serie && serie.fait).length;
      musclesDe(exercice).forEach((muscle, i) => {
        volume[muscle] += (i === 0 ? 1 : 0.5) * faites;
      });
    }
  }
  return volume;
}

/** Niveau de couleur : 0 série, 1-4, 5-9, 10 et plus (repère hebdomadaire de prise de masse). */
const niveauMuscle = (series) => (series <= 0 ? 0 : series < 5 ? 1 : series < 10 ? 2 : 3);

// Silhouettes face / dos : [muscle ou null (neutre), forme, attributs]
const SILHOUETTE_FACE = [
  [null, 'circle', { cx: 60, cy: 18, r: 12 }],
  [null, 'rect', { x: 54, y: 29, width: 12, height: 9, rx: 3 }],
  ['epaules', 'ellipse', { cx: 34, cy: 47, rx: 11, ry: 9 }],
  ['epaules', 'ellipse', { cx: 86, cy: 47, rx: 11, ry: 9 }],
  ['pectoraux', 'rect', { x: 40, y: 40, width: 19, height: 21, rx: 7 }],
  ['pectoraux', 'rect', { x: 61, y: 40, width: 19, height: 21, rx: 7 }],
  ['biceps', 'ellipse', { cx: 27, cy: 72, rx: 7, ry: 15 }],
  ['biceps', 'ellipse', { cx: 93, cy: 72, rx: 7, ry: 15 }],
  [null, 'ellipse', { cx: 23, cy: 104, rx: 6, ry: 14 }],
  [null, 'ellipse', { cx: 97, cy: 104, rx: 6, ry: 14 }],
  ['abdos', 'rect', { x: 45, y: 64, width: 30, height: 40, rx: 9 }],
  [null, 'rect', { x: 44, y: 106, width: 32, height: 15, rx: 6 }],
  ['quadriceps', 'ellipse', { cx: 50, cy: 152, rx: 10, ry: 30 }],
  ['quadriceps', 'ellipse', { cx: 70, cy: 152, rx: 10, ry: 30 }],
  [null, 'ellipse', { cx: 50, cy: 211, rx: 7, ry: 24 }],
  [null, 'ellipse', { cx: 70, cy: 211, rx: 7, ry: 24 }],
  [null, 'ellipse', { cx: 50, cy: 241, rx: 8, ry: 4 }],
  [null, 'ellipse', { cx: 70, cy: 241, rx: 8, ry: 4 }],
];
const SILHOUETTE_DOS = [
  [null, 'circle', { cx: 60, cy: 18, r: 12 }],
  [null, 'rect', { x: 54, y: 29, width: 12, height: 9, rx: 3 }],
  ['epaules', 'ellipse', { cx: 34, cy: 47, rx: 11, ry: 9 }],
  ['epaules', 'ellipse', { cx: 86, cy: 47, rx: 11, ry: 9 }],
  ['dos', 'rect', { x: 40, y: 40, width: 40, height: 52, rx: 11 }],
  ['triceps', 'ellipse', { cx: 27, cy: 72, rx: 7, ry: 15 }],
  ['triceps', 'ellipse', { cx: 93, cy: 72, rx: 7, ry: 15 }],
  [null, 'ellipse', { cx: 23, cy: 104, rx: 6, ry: 14 }],
  [null, 'ellipse', { cx: 97, cy: 104, rx: 6, ry: 14 }],
  [null, 'rect', { x: 46, y: 94, width: 28, height: 11, rx: 5 }],
  ['fessiers', 'ellipse', { cx: 51, cy: 115, rx: 10, ry: 10 }],
  ['fessiers', 'ellipse', { cx: 69, cy: 115, rx: 10, ry: 10 }],
  ['ischios', 'ellipse', { cx: 50, cy: 153, rx: 10, ry: 26 }],
  ['ischios', 'ellipse', { cx: 70, cy: 153, rx: 10, ry: 26 }],
  ['mollets', 'ellipse', { cx: 50, cy: 207, rx: 8, ry: 20 }],
  ['mollets', 'ellipse', { cx: 70, cy: 207, rx: 8, ry: 20 }],
  [null, 'ellipse', { cx: 50, cy: 241, rx: 8, ry: 4 }],
  [null, 'ellipse', { cx: 70, cy: 241, rx: 8, ry: 4 }],
];

/** Une silhouette SVG colorée selon les séries de la semaine. */
function creerSilhouette(formes, volume, titre) {
  const svg = creerSvg('svg', { viewBox: '0 0 120 250', class: 'silhouette', 'aria-hidden': 'true' });
  for (const [muscle, forme, attributs] of formes) {
    const classe = muscle ? `zone-muscle zone-muscle--n${niveauMuscle(volume[muscle])}` : 'zone-neutre';
    const el = creerSvg(forme, attributs, classe);
    if (muscle) {
      const infobulle = creerSvg('title', {});
      infobulle.textContent = `${NOMS_MUSCLES[muscle]} : ${formaterNombre(volume[muscle])} séries`;
      el.append(infobulle);
    }
    svg.append(el);
  }
  const figure = creer('figure', 'silhouette__figure');
  figure.append(svg, creer('figcaption', 'silhouette__legende', titre));
  return figure;
}

/** Carte « Cette semaine, muscle par muscle » : silhouettes + légende + liste (lisible sans les couleurs). */
function creerCarteCorps() {
  const volume = seriesSemaineParMuscle();
  const total = Object.values(volume).reduce((a, b) => a + b, 0);
  const figures = creer('div', 'silhouettes');
  figures.append(creerSilhouette(SILHOUETTE_FACE, volume, 'Face'), creerSilhouette(SILHOUETTE_DOS, volume, 'Dos'));

  const legende = creer('ul', 'legende-muscles');
  legende.setAttribute('aria-hidden', 'true');
  ['0', '1-4', '5-9', '10+'].forEach((texte, n) => {
    const item = creer('li', '');
    item.append(creer('span', `pastille-niveau zone-muscle--n${n}`), document.createTextNode(texte));
    legende.append(item);
  });

  const liste = creer('ul', 'liste-muscles');
  for (const [muscle, series] of Object.entries(volume).sort((a, b) => b[1] - a[1])) {
    const item = creer('li', `liste-muscles__item${series >= 10 ? ' liste-muscles__item--ok' : ''}`);
    item.append(creer('span', '', NOMS_MUSCLES[muscle]), creer('span', 'liste-muscles__valeur', `${formaterNombre(series)} / 10`));
    liste.append(item);
  }

  const carte = creer('article', 'carte carte-corps');
  carte.append(
    creer('h2', 'exercice__nom', 'Cette semaine, muscle par muscle'),
    creer('p', 'exercice__cible', total
      ? 'Séries faites depuis lundi (exercice principal = 1, muscle secondaire = ½). Repère : 10 par muscle.'
      : 'Pas encore de série cette semaine : la carte se colore au fil de tes séances.'),
    figures,
    legende,
    liste,
  );
  return carte;
}

/** Pastilles « Meilleur poids · 1RM estimé · Volume » selon l'exercice. */
function remplirChoixMesure(possibles, choisie) {
  const zone = document.getElementById('choix-mesure');
  const legende = creer('legend', 'visuellement-cache', 'Mesure affichée');
  zone.replaceChildren(legende, ...possibles.map((m) => creerPastille('radio', 'mesure', m, MESURES[m].libelle, m === choisie)));
}

/** Séance du programme qui contient un exercice (pour sa couleur). */
function seanceDeExercice(exerciceId) {
  return etat.donnees.programme.find((s) => s.exercices.some((e) => e && e.id === exerciceId));
}

/** Remplit la zone de résultats pour l'exercice choisi (animer = false au redimensionnement). */
function majProgression(animer = true) {
  const exerciceId = document.getElementById('choix-exercice').value;
  etat.exerciceProgression = exerciceId;
  const exercice = trouverExerciceDansProgramme(exerciceId);
  const resultats = document.getElementById('resultats-progression');
  const possibles = mesuresPossibles(exercice);
  const mesure = possibles.includes(etat.mesureProgression) ? etat.mesureProgression : possibles[1] || possibles[0];
  remplirChoixMesure(possibles, mesure);
  const points = pointsMesure(exercice, mesure);
  const unite = uniteMesure(exercice, mesure);
  const libelle = mesure === 'poids' && exercice.poidsDuCorps ? 'Meilleur lest' : MESURES[mesure].libelle;

  if (!points.length) {
    const vide = exercice.poidsDuCorps && mesure === 'poids'
      ? 'Aucun lest enregistré pour cet exercice au poids du corps.'
      : 'Pas encore de série cochée avec un poids et des reps pour cet exercice.';
    resultats.replaceChildren(creer('p', 'texte-secondaire', vide));
    return;
  }

  const record = points.reduce((a, b) => (b.valeur > a.valeur ? b : a));
  const resume = [`Record : ${formaterNombre(record.valeur)} ${unite} le ${formaterDate(record.id)}`];
  if (points.length > 1) resume.push(texteEvolution(points, unite));
  if (mesure === 'rm') resume.push('1RM = charge que tu soulèverais une fois, estimée d\'après tes séries');

  const seance = seanceDeExercice(exerciceId);
  const carteGraphe = creer('article', `carte ${seance ? teinte(seance.id) : 'teinte-1'}`);
  const lecture = creer('p', 'lecture');
  lecture.setAttribute('aria-live', 'polite');
  const zone = creer('div', 'graphe-zone');
  carteGraphe.append(
    creer('h2', 'exercice__nom', libelle),
    creer('p', 'exercice__cible', resume.join(' · ')),
    lecture,
    zone,
  );
  if (points.length === 1) carteGraphe.append(creer('p', 'exercice__cible', 'Une seule séance : la courbe se dessinera à la prochaine.'));

  const carteTableau = creer('article', 'carte');
  carteTableau.append(creer('h2', 'exercice__nom', 'Séances'), creerTableauProgression(points, libelle));

  resultats.replaceChildren(carteGraphe, carteTableau);
  dessinerGraphe(zone, lecture, points, { nom: MESURES[mesure].nom, unite }, animer);
  if (animer) animerApparitions(resultats);
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
  const choixMesure = creer('fieldset', 'formulaire__choix');
  choixMesure.id = 'choix-mesure';
  const resultats = creer('div', 'ecran');
  resultats.id = 'resultats-progression';

  document.getElementById('ecran-progression').replaceChildren(creerCarteCorps(), etiquette, select, choixMesure, resultats);
  // Après l'affichage : la courbe a besoin de la largeur réelle
  montrerEcran('progression', 'Progression', 'Retour à l\'accueil', '', () => majProgression());
}

/* ---------- Mon corps : poids de corps ---------- */

/** Pesées valides, de la plus ancienne à la plus récente. */
function listePoidsCorps() {
  const liste = Array.isArray(etat.donnees.poidsCorps) ? etat.donnees.poidsCorps : [];
  return liste
    .filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.poids === 'number' && Number.isFinite(e.poids))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** « 2026-10-13 » → horodatage local (ms). */
function tempsDate(date) {
  const [annee, mois, jour] = date.split('-').map(Number);
  return new Date(annee, mois - 1, jour).getTime();
}

function dateDuJour() {
  return idSeance(Date.now()).slice(0, 10);
}

/** Rythme en kg par semaine sur les 4 dernières semaines (droite de tendance) ; null si trop peu de pesées. */
function rythmePoids(liste) {
  const depuis = Date.now() - 28 * 86400000;
  const points = liste.filter((e) => tempsDate(e.date) >= depuis).map((e) => [tempsDate(e.date) / 86400000, e.poids]);
  if (points.length < 2 || points[points.length - 1][0] - points[0][0] < 6) return null;
  const moyX = points.reduce((s, [x]) => s + x, 0) / points.length;
  const moyY = points.reduce((s, [, y]) => s + y, 0) / points.length;
  const haut = points.reduce((s, [x, y]) => s + (x - moyX) * (y - moyY), 0);
  const bas = points.reduce((s, [x]) => s + (x - moyX) ** 2, 0);
  return bas ? (haut / bas) * 7 : null;
}

/** « +0,3 » kg (arrondi au dixième, avec le signe). */
function formaterEcart(valeur) {
  const arrondi = Math.round(valeur * 10) / 10;
  return `${arrondi > 0 ? '+' : arrondi < 0 ? '−' : '±'}${formaterNombre(Math.abs(arrondi))}`;
}

/** Conseil de Sam sur le rythme de prise de masse (repère : +0,25 à +0,5 kg par semaine). */
function conseilPoids(rythme) {
  if (rythme === null) return 'Pèse-toi 1 à 2 fois par semaine, le matin à jeun : je calculerai ton rythme de prise de masse.';
  const texte = `${formaterEcart(rythme)} kg par semaine`;
  if (rythme < 0) return `Tu perds du poids (${texte}) : mange davantage, surtout les jours d'entraînement.`;
  if (rythme < 0.1) return `Ton poids stagne (${texte}) : ajoute environ 200 kcal par jour, par exemple un yaourt avec des flocons d'avoine.`;
  if (rythme <= 0.6) return `Bon rythme (${texte}) pour une prise de masse propre : continue comme ça.`;
  return `Ça monte vite (${texte}) : enlève environ 150 kcal par jour pour limiter le gras.`;
}

/** Écran « Mon corps » : pesée du jour, courbe, rythme, liste des pesées. */
function afficherCorps() {
  const liste = listePoidsCorps();
  const duJour = liste.find((e) => e.date === dateDuJour());

  const form = creer('form', 'formulaire');
  form.id = 'formulaire-poids';
  form.noValidate = true;
  const erreur = creer('p', 'message');
  erreur.id = 'erreur-poids';
  erreur.setAttribute('role', 'alert');
  erreur.hidden = true;
  const valider = creer('button', 'bouton bouton--principal', duJour ? 'Mettre à jour' : 'Enregistrer');
  valider.type = 'submit';
  form.append(
    erreur,
    creerChampFormulaire('poids-corps', 'Ton poids aujourd\'hui (kg)', duJour ? formaterNombre(duJour.poids) : '', { clavier: 'decimal', indice: 'Ex. : 72,5' }),
    valider,
    creer('p', 'exercice__cible', 'Le matin à jeun, 1 à 2 fois par semaine : c\'est la tendance qui compte.'),
  );
  const carteSaisie = creer('article', 'carte');
  carteSaisie.append(creer('h2', 'exercice__nom', 'Pesée du jour'), form);
  const blocs = [carteSaisie];

  let dessin = null;
  if (liste.length) {
    const points = liste.map((e) => ({ id: e.date, temps: tempsDate(e.date), valeur: e.poids, texte: `${formaterNombre(e.poids)} kg` }));
    const rythme = rythmePoids(liste);
    const resume = [`Actuel : ${formaterNombre(points[points.length - 1].valeur)} kg`];
    if (points.length > 1) resume.push(texteEvolution(points));
    if (rythme !== null) resume.push(`${formaterEcart(rythme)} kg par semaine (4 dernières semaines)`);

    const lecture = creer('p', 'lecture');
    lecture.setAttribute('aria-live', 'polite');
    const zone = creer('div', 'graphe-zone');
    const conseil = creer('div', 'conseil-seance');
    const avatar = creer('span', 'avatar-sam avatar-sam--mini', 'S');
    avatar.setAttribute('aria-hidden', 'true');
    conseil.append(avatar, creer('span', 'conseil-seance__texte', `Sam : ${conseilPoids(rythme)}`));
    const carteCourbe = creer('article', 'carte teinte-2');
    carteCourbe.append(creer('h2', 'exercice__nom', 'Poids de corps'), creer('p', 'exercice__cible', resume.join(' · ')), lecture, zone, conseil);
    blocs.push(carteCourbe);
    dessin = () => dessinerGraphe(zone, lecture, points, { nom: 'du poids de corps', unite: 'kg' }, true);

    // Liste des pesées (la plus récente en premier), chacune supprimable
    const tableau = creer('table', 'tableau');
    const corps = document.createElement('tbody');
    for (const e of [...liste].reverse().slice(0, 20)) {
      const ligne = document.createElement('tr');
      const supprimer = creer('button', 'bouton-mini', 'Supprimer');
      supprimer.type = 'button';
      supprimer.dataset.supprimerPoids = e.date;
      supprimer.setAttribute('aria-label', `Supprimer la pesée du ${formaterDate(e.date)}`);
      const cellule = document.createElement('td');
      cellule.className = 'tableau__action';
      cellule.append(supprimer);
      ligne.append(creer('td', '', formaterDate(e.date)), creer('td', '', `${formaterNombre(e.poids)} kg`), cellule);
      corps.append(ligne);
    }
    tableau.append(creer('caption', 'visuellement-cache', 'Pesées, la plus récente en premier'), corps);
    const carteListe = creer('article', 'carte');
    carteListe.append(creer('h2', 'exercice__nom', 'Pesées'), tableau);
    blocs.push(carteListe);
  }

  document.getElementById('ecran-corps').replaceChildren(...blocs);
  // Après l'affichage : la courbe a besoin de la largeur réelle
  montrerEcran('corps', 'Mon corps', 'Retour à l\'accueil', '', dessin);
}

/** Enregistre la pesée du jour (une par jour : la nouvelle remplace l'ancienne). */
function enregistrerPoidsCorps(form) {
  const champ = form.elements['champ-poids-corps'];
  const poids = lirePoids(champ.value);
  const erreur = document.getElementById('erreur-poids');
  if (poids === null || Number.isNaN(poids) || poids < 30 || poids > 250) {
    erreur.textContent = 'Indique un poids entre 30 et 250 kg, par exemple 72,5.';
    erreur.hidden = false;
    champ.focus();
    return;
  }
  const date = dateDuJour();
  if (!modifierDonnees((donnees) => {
    const liste = Array.isArray(donnees.poidsCorps) ? donnees.poidsCorps.filter((e) => e && e.date !== date) : [];
    liste.push({ date, poids });
    donnees.poidsCorps = liste;
  })) return;
  afficherCorps();
  afficherMessage(`${formaterNombre(poids)} kg enregistré pour le ${formaterDate(date)}.`);
}

function supprimerPoidsCorps(date) {
  if (!confirm(`Supprimer la pesée du ${formaterDate(date)} ?`)) return;
  if (!modifierDonnees((donnees) => {
    donnees.poidsCorps = (donnees.poidsCorps || []).filter((e) => e && e.date !== date);
  })) return;
  afficherCorps();
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
    const pastille = creer('span', 'pastille-seance', String(s + 1));
    pastille.setAttribute('aria-hidden', 'true');
    const titre = creer('h2', 'exercice__nom titre-avec-pastille');
    titre.append(pastille, creer('span', '', `Séance ${s + 1} · ${seance.nom}`));
    const carte = creer('article', `carte ${teinte(seance.id)}`);
    carte.append(titre, liste, ajouter);
    return carte;
  });
  const aide = creer('p', 'texte-secondaire', 'Touche un exercice pour le modifier. Les flèches changent l\'ordre.');

  const remettre = creer('button', 'bouton bouton--secondaire', 'Remettre le programme de départ');
  remettre.type = 'button';
  remettre.dataset.reinitialiser = 'oui';
  const carteDepart = creer('article', 'carte');
  carteDepart.append(
    creer('h2', 'exercice__nom', 'Programme de départ'),
    creer('p', 'carte__texte', `Remplace tout ton programme par celui de départ (mis à jour le ${DATE_PROGRAMME_DEPART} avec tes charges). Ton historique est gardé.`),
    remettre,
  );
  document.getElementById('ecran-programme').replaceChildren(aide, ...cartes, carteDepart);
}

/** Remplace le programme par le programme de départ ; l'historique et la séance en cours ne bougent pas. */
function remettreProgrammeDepart() {
  if (!confirm('Remplacer tout ton programme par le programme de départ ? Tes modifications du programme seront remplacées ; ton historique est gardé.')) return;
  if (!modifierDonnees((donnees) => {
    donnees.programme = JSON.parse(JSON.stringify(PROGRAMME_DEPART));
  })) return;
  afficherProgramme();
  afficherMessage('Programme de départ chargé. Ton historique est intact.');
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
  montrerEcran('exercice', exercice ? exercice.nom : 'Nouvel exercice', 'Retour au programme', teinte(seance.id));
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
  if (brut.poidsCorps !== undefined && !(Array.isArray(brut.poidsCorps) && brut.poidsCorps.every((e) => e
    && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.poids === 'number' && Number.isFinite(e.poids)))) return { erreur: abime };

  const donnees = migrer({ version: brut.version, programme, historique: brut.historique });
  if (brut.enCours && seanceEnCoursValide(brut.enCours)) donnees.enCours = brut.enCours;
  if (Number.isFinite(brut.derniereSauvegarde)) donnees.derniereSauvegarde = brut.derniereSauvegarde;
  if (Array.isArray(brut.poidsCorps)) donnees.poidsCorps = brut.poidsCorps.map((e) => ({ date: e.date, poids: e.poids }));
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

/* ---------- Sam, le coach : analyses locales (hors ligne, rien ne sort du téléphone) ---------- */

// Isolation : +1 kg ; polyarticulaire : +2 kg (règle de progression de CLAUDE.md)
const ISOLATIONS = new Set([
  'elevations-laterales', 'extension-triceps-poulie', 'face-pull', 'curl-barre', 'curl-marteau',
  'leg-extension', 'leg-curl', 'mollets', 'ecarte-poulie', 'elevations-frontales', 'curl-incline',
  'militaire-ou-laterales', 'pec-machine', 'abdos-poulie',
]);
// Polyarticulaires lourds : repos plus long
const LOURDS = new Set(['dev-couche', 'squat', 'rdl', 'presse', 'tirage-vertical', 'rowing', 'dev-halteres', 'tractions-supination']);
const MOTS_ISOLATION = /curl|extension|élévation|elevation|écarté|ecarte|face pull|mollet|oiseau|pec deck|kickback/i;

const NOMS_MUSCLES = {
  pectoraux: 'Pectoraux', epaules: 'Épaules', triceps: 'Triceps', dos: 'Dos', biceps: 'Biceps',
  quadriceps: 'Quadriceps', ischios: 'Ischios', fessiers: 'Fessiers', mollets: 'Mollets', abdos: 'Abdos',
};

// Muscle principal en premier (1 série comptée), secondaires ensuite (½ série)
const MUSCLES_EXERCICES = {
  'dev-couche': ['pectoraux', 'triceps', 'epaules'],
  'dev-incline-halteres': ['pectoraux', 'epaules', 'triceps'],
  'dev-militaire': ['epaules', 'triceps'],
  'elevations-laterales': ['epaules'],
  dips: ['triceps', 'pectoraux'],
  'extension-triceps-poulie': ['triceps'],
  'tirage-vertical': ['dos', 'biceps'],
  rowing: ['dos', 'biceps'],
  rdl: ['ischios', 'fessiers', 'dos'],
  'face-pull': ['epaules', 'dos'],
  'curl-barre': ['biceps'],
  'curl-marteau': ['biceps'],
  squat: ['quadriceps', 'fessiers'],
  presse: ['quadriceps', 'fessiers'],
  'fentes-bulgares': ['quadriceps', 'fessiers', 'ischios'],
  'leg-extension': ['quadriceps'],
  'leg-curl': ['ischios'],
  mollets: ['mollets'],
  gainage: ['abdos'],
  'dev-halteres': ['pectoraux', 'triceps', 'epaules'],
  'ecarte-poulie': ['pectoraux'],
  'tirage-horizontal-uni': ['dos', 'biceps'],
  'elevations-frontales': ['epaules'],
  'tractions-supination': ['dos', 'biceps'],
  'curl-incline': ['biceps'],
  'militaire-ou-laterales': ['epaules'],
  'pec-machine': ['pectoraux'],
  'pistol-squat': ['quadriceps', 'fessiers'],
  'abdos-poulie': ['abdos'],
};

// Exercices ajoutés à la main : muscle deviné d'après le nom
const MUSCLES_PAR_MOT = [
  [/hip thrust|fessier|glute|abduct/i, ['fessiers']],
  [/leg curl|ischio|soulevé|rdl/i, ['ischios', 'fessiers']],
  [/mollet/i, ['mollets']],
  [/gainage|abdo|crunch|planche|relevé|roue/i, ['abdos']],
  [/curl/i, ['biceps']],
  [/triceps|kickback|barre au front/i, ['triceps']],
  [/squat|presse|fente|leg extension|hack/i, ['quadriceps', 'fessiers']],
  [/tirage|rowing|traction|pull/i, ['dos', 'biceps']],
  [/épaule|epaule|élévation|elevation|militaire|oiseau/i, ['epaules']],
  [/pec|couché|couche|écarté|ecarte|dips|pompe/i, ['pectoraux', 'triceps']],
];

const AJOUTS_CONSEILLES = {
  ischios: 'leg curl assis ou soulevé de terre roumain aux haltères, 3 × 10-12',
  fessiers: 'hip thrust, 3 × 8-12 (en fin de séance Legs)',
  mollets: 'une 2e séance de mollets dans la semaine (mollets assis, 3 × 12-15)',
  abdos: 'relevés de jambes ou crunch à la poulie, 3 × 12-15',
  triceps: 'barre au front ou extension à la poulie, 3 × 10-12',
  biceps: 'curl à la poulie, 3 × 10-12',
  epaules: 'élévations latérales à la poulie, 3 × 12-15',
  pectoraux: 'écarté à la poulie, 3 × 10-12',
  dos: 'rowing poitrine appuyée, 3 × 10-12',
  quadriceps: 'hack squat ou leg extension, 3 × 10-12',
};

const ASTUCES_SAM = [
  'Prise de masse : vise environ 1,6 à 2 g de protéines par kilo de poids de corps par jour, réparties sur 3 ou 4 repas.',
  'Dors 7 à 9 h par nuit : c\'est pendant le sommeil que le muscle se reconstruit.',
  'Avant un gros exercice, fais 2 séries d\'échauffement : une à 50 %, une à 70 % de ta charge.',
  'Garde 1 ou 2 reps en réserve sur la plupart des séries : la technique reste propre et tu progresses plus longtemps.',
  'Bois régulièrement pendant la séance : même une petite déshydratation fait baisser la force.',
  'Pour prendre de la masse, mange un peu plus que tes besoins (environ +300 kcal par jour) et pèse-toi une fois par semaine.',
  'Contrôle la descente en 2 à 3 secondes : plus de travail pour le muscle, moins de risque de blessure.',
  'Une douleur vive ou dans une articulation n\'est pas normale : arrête l\'exercice et, si elle dure, consulte un professionnel de santé.',
  'Toutes les 6 à 8 semaines, une semaine plus légère (−20 à −30 % de charge) aide à recharger les batteries.',
  'Note honnêtement tes reps : ce sont elles qui me disent quand tu peux monter.',
  'Un repas avec glucides et protéines dans les 2 h après la séance aide la récupération.',
  'La régularité bat l\'intensité : 4 séances correctes chaque semaine valent mieux qu\'une séance parfaite de temps en temps.',
];

function estIsolation(exercice) {
  if (ISOLATIONS.has(exercice.id)) return true;
  return !LOURDS.has(exercice.id) && MOTS_ISOLATION.test(exercice.nom);
}

/** Temps de repos conseillé entre deux séries. */
function reposConseille(exercice) {
  if (exercice.unite === 's') return '45 s à 1 min';
  if (LOURDS.has(exercice.id)) return '2 à 3 min';
  if (estIsolation(exercice)) return '60 à 90 s';
  return '90 s à 2 min';
}

function musclesDe(exercice) {
  if (MUSCLES_EXERCICES[exercice.id]) return MUSCLES_EXERCICES[exercice.id];
  const trouve = MUSCLES_PAR_MOT.find(([motif]) => motif.test(exercice.nom));
  return trouve ? trouve[1] : [];
}

const arrondirCharge = (poids, pas) => Math.max(0, Math.round(poids / pas) * pas);

/** Dernières séances (de la plus récente à la plus ancienne) où l'exercice a au moins une série faite. */
function seancesExercice(exerciceId, combien) {
  const resultat = [];
  for (const entree of entreesHistorique()) {
    const ex = entree.exercices.find((e) => e && e.exerciceId === exerciceId);
    const faites = ex ? ex.series.filter((s) => s.fait) : [];
    if (faites.length) resultat.push({ id: entree.id, series: faites });
    if (resultat.length >= combien) break;
  }
  return resultat;
}

/** Poids le plus lourd d'une liste de séries, ou null. */
function poidsMaxSeries(series) {
  const poids = series.map((s) => s.poids).filter((p) => typeof p === 'number' && Number.isFinite(p));
  return poids.length ? Math.max(...poids) : null;
}

/**
 * Conseil de charge pour un exercice, d'après ses dernières séances.
 * type : 'monter' | 'baisser' | 'stagne' | 'garder' | 'nouveau' ; poids : charge proposée si utile.
 */
function conseilCharge(exercice) {
  const passees = seancesExercice(exercice.id, 3);
  if (!passees.length) {
    return { type: 'nouveau', court: 'Première fois', texte: `Première fois : trouve une charge qui te laisse ${texteReps(exercice)} reps propres.` };
  }
  const derniere = passees[0].series;
  const reps = derniere.map((s) => (typeof s.reps === 'number' ? s.reps : null));
  const poids = poidsMaxSeries(derniere);
  const charge = poids === null ? (exercice.poidsDuCorps ? 'PDC × ' : '') : `${formaterNombre(poids)} kg × `;
  const resume = `Dernière fois : ${charge}${reps.map((r) => r ?? '?').join(', ')}${exercice.unite === 's' ? ' s' : ''}`;
  if (reps.includes(null)) {
    return { type: 'garder', court: 'Note tes reps', texte: `${resume}. Note tes reps à chaque série pour que je puisse te dire quand monter.` };
  }
  const toutesFaites = derniere.length >= exercice.series;
  const haut = exercice.repsMax ?? exercice.repsMin;

  // Gainage et exercices au temps
  if (exercice.unite === 's') {
    if (haut !== null && toutesFaites && reps.every((r) => r >= haut)) {
      return { type: 'monter', court: `Passe à ${haut + 15} s`, texte: `${resume} : objectif tenu partout. Passe à ${haut + 15} s, ou garde le temps avec une variante plus dure.` };
    }
    return { type: 'garder', court: `Vise ${haut ?? '+'} s`, texte: `${resume}. Garde ce temps et vise ${haut} s à chaque série.` };
  }
  // « max » (tractions) : au-delà de 12 reps partout, on ajoute du lest
  if (exercice.repsMin === null) {
    if (toutesFaites && Math.min(...reps) >= 12) {
      const lest = (poids ?? 0) + 2;
      return { type: 'monter', poids: lest, court: `Lest : ${formaterNombre(lest)} kg`, texte: `${resume} : 12 reps ou plus partout. Ajoute du lest : ${formaterNombre(lest)} kg.` };
    }
    return { type: 'garder', court: 'Une rep de plus', texte: `${resume}. Vise une rep de plus que la dernière fois sur chaque série.` };
  }
  if (poids === null) {
    return { type: 'garder', court: 'Note le poids', texte: `${resume}. Note le poids utilisé pour que je suive ta progression.` };
  }

  // Règle de l'appli : haut de fourchette partout → +2 kg (+1 kg en isolation)
  const iso = estIsolation(exercice);
  if (toutesFaites && reps.every((r) => r >= haut)) {
    const nouveau = poids + (iso ? 1 : 2);
    return {
      type: 'monter', poids: nouveau, court: `Passe à ${formaterNombre(nouveau)} kg`,
      texte: `${resume} : haut de fourchette partout. Passe à ${formaterNombre(nouveau)} kg (+${iso ? 1 : 2} kg).`,
    };
  }
  // Trop dur deux séances de suite (la moitié des séries sous le bas de fourchette) : on baisse un peu
  const tropDur = (series) => series.filter((s) => typeof s.reps === 'number' && s.reps < exercice.repsMin).length >= Math.ceil(series.length / 2);
  if (passees.length >= 2 && tropDur(derniere) && tropDur(passees[1].series) && (poidsMaxSeries(passees[1].series) ?? 0) >= poids) {
    const nouveau = arrondirCharge(poids * 0.9, iso ? 1 : 2.5);
    if (nouveau < poids) {
      return {
        type: 'baisser', poids: nouveau, court: `Baisse à ${formaterNombre(nouveau)} kg`,
        texte: `${resume} : sous ${exercice.repsMin} reps deux séances de suite. Baisse à ${formaterNombre(nouveau)} kg pour travailler dans ta fourchette, puis remonte.`,
      };
    }
  }
  // Stagnation : 3 séances au même poids sans atteindre le haut de fourchette
  if (passees.length >= 3 && passees.every((p) => poidsMaxSeries(p.series) === poids)) {
    return {
      type: 'stagne', court: 'Stagnation',
      texte: `3 séances à ${formaterNombre(poids)} kg sans atteindre ${haut} reps partout. Change une chose : une série de plus, une descente plus lente (3 s), ou une semaine plus légère (−20 %).`,
    };
  }
  return { type: 'garder', court: `Reste à ${formaterNombre(poids)} kg`, texte: `${resume}. Reste à ${formaterNombre(poids)} kg et vise ${haut} reps à chaque série.` };
}

/** Records battus ces 14 derniers jours. */
function recordsRecents() {
  const depuis = Date.now() - 14 * 86400000;
  const records = [];
  for (const seance of etat.donnees.programme) {
    for (const exercice of seance.exercices.filter(Boolean)) {
      const points = pointsProgression(exercice.id);
      if (points.length < 2) continue;
      const dernier = points[points.length - 1];
      const avant = Math.max(...points.slice(0, -1).map((p) => p.poids));
      if (dernier.poids > avant && dernier.temps >= depuis) records.push({ exercice, poids: dernier.poids, gain: dernier.poids - avant, id: dernier.id });
    }
  }
  return records;
}

/** Séries prévues par semaine pour chaque muscle (principal = 1, secondaire = ½). */
function volumeParMuscle() {
  const volume = Object.fromEntries(Object.keys(NOMS_MUSCLES).map((m) => [m, 0]));
  for (const seance of etat.donnees.programme) {
    for (const exercice of seance.exercices.filter(Boolean)) {
      musclesDe(exercice).forEach((muscle, i) => {
        volume[muscle] += (i === 0 ? 1 : 0.5) * (Number(exercice.series) || 0);
      });
    }
  }
  return volume;
}

/** Exercices sautés (aucune série faite) au moins 2 fois sur les 3 dernières séances concernées. */
function exercicesSautes() {
  const entrees = entreesHistorique();
  const sautes = [];
  for (const seance of etat.donnees.programme) {
    const dernieres = entrees.filter((e) => e.seanceId === seance.id).slice(0, 3);
    if (dernieres.length < 2) continue;
    for (const exercice of seance.exercices.filter(Boolean)) {
      const fois = dernieres.filter((e) => {
        const ex = e.exercices.find((x) => x && x.exerciceId === exercice.id);
        return !ex || !ex.series.some((s) => s.fait);
      }).length;
      if (fois >= 2) sautes.push({ exercice, seance, fois, sur: dernieres.length });
    }
  }
  return sautes;
}

/** Séance à faire ensuite : celle en cours, sinon la première pas encore faite cette semaine. */
function prochaineSeance() {
  const { programme, enCours } = etat.donnees;
  if (enCours) return trouverSeance(enCours.seanceId) || null;
  const debut = debutSemaine();
  const faites = new Set(entreesHistorique().filter((e) => tempsDepuisId(e.id) >= debut).map((e) => e.seanceId));
  return programme.find((s) => !faites.has(s.id)) || programme[0] || null;
}

/** Régularité : séances cette semaine, jours depuis la dernière, semaines d'affilée à 3 séances ou plus. */
function regularite() {
  const entrees = entreesHistorique();
  const debut = debutSemaine();
  const semaine = entrees.filter((e) => tempsDepuisId(e.id) >= debut).length;
  const derniere = entrees.length ? tempsDepuisId(entrees[0].id) : null;
  const jours = derniere === null ? null : Math.floor((Date.now() - derniere) / 86400000);
  // Semaines complètes d'affilée (en partant de la semaine dernière) avec au moins 3 séances
  let serie = 0;
  for (let fin = debut; ; fin -= 7 * 86400000) {
    const nb = entrees.filter((e) => {
      const t = tempsDepuisId(e.id);
      return t >= fin - 7 * 86400000 && t < fin;
    }).length;
    if (nb < 3) break;
    serie++;
  }
  return { semaine, objectif: Math.max(1, etat.donnees.programme.length), jours, serie };
}

/** Toutes les analyses de Sam en une fois. */
function analyserAvecSam() {
  const exercices = etat.donnees.programme.flatMap((s) => s.exercices.filter(Boolean).map((exercice) => ({ exercice, seance: s })));
  const charges = exercices
    .map(({ exercice, seance }) => ({ exercice, seance, conseil: conseilCharge(exercice) }))
    .filter(({ conseil }) => ['monter', 'baisser', 'stagne'].includes(conseil.type));
  const volume = volumeParMuscle();
  const manques = Object.entries(volume).filter(([, v]) => v < 10).sort((a, b) => a[1] - b[1]);
  const jourDeLAnnee = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const pesees = listePoidsCorps();
  return {
    pesees,
    rythmePoids: rythmePoids(pesees),
    aDesSeances: entreesHistorique().length > 0,
    charges,
    records: recordsRecents(),
    volume,
    manques,
    sautes: exercicesSautes(),
    prochaine: prochaineSeance(),
    regularite: regularite(),
    astuce: ASTUCES_SAM[jourDeLAnnee % ASTUCES_SAM.length],
  };
}

/** Phrase d'accroche de Sam (accueil et écran Sam). */
function motDeSam(analyse) {
  const heure = new Date().getHours();
  const salut = heure < 12 ? 'Bonjour' : heure < 18 ? 'Salut' : 'Bonsoir';
  if (!analyse.aDesSeances) return `${salut} ! Je suis Sam, ton coach. Fais ta première séance et je te dirai quand monter en charge.`;
  const morceaux = [`${salut} !`];
  const monter = analyse.charges.filter((c) => c.conseil.type === 'monter').length;
  if (analyse.records.length) morceaux.push(`${analyse.records.length} record${analyse.records.length > 1 ? 's' : ''} battu${analyse.records.length > 1 ? 's' : ''} récemment, bravo.`);
  morceaux.push(monter ? `${monter} exercice${monter > 1 ? 's' : ''} prêt${monter > 1 ? 's' : ''} à monter en charge.` : 'Pas de hausse de charge pour l\'instant : continue comme ça.');
  if (analyse.prochaine) morceaux.push(`Prochaine séance : ${analyse.prochaine.nom}.`);
  return morceaux.join(' ');
}

/** Résumé court pour la carte Sam de l'accueil. */
function resumeSam(analyse) {
  if (!analyse.aDesSeances) return 'Tes conseils après ta première séance';
  const monter = analyse.charges.filter((c) => c.conseil.type === 'monter').length;
  const morceaux = [];
  if (analyse.records.length) morceaux.push(`${analyse.records.length} record${analyse.records.length > 1 ? 's' : ''}`);
  morceaux.push(monter ? `${monter} charge${monter > 1 ? 's' : ''} à monter` : 'charges stables');
  if (analyse.prochaine) morceaux.push(`prochaine : ${analyse.prochaine.nom}`);
  return morceaux.join(' · ');
}

/* ---------- Sam : écran des conseils ---------- */

const ETIQUETTES_CONSEIL = { monter: 'Monter', baisser: 'Baisser', stagne: 'Stagnation', garder: 'Garder', nouveau: 'Nouveau', saute: 'Sauté', ajout: 'À ajouter' };

/** Carte de l'écran Sam : titre + contenu. */
function carteSam(titre, ...contenu) {
  const carte = creer('article', 'carte carte-conseils');
  carte.append(creer('h2', 'exercice__nom', titre), ...contenu);
  return carte;
}

/** Ligne de conseil : pastille d'état + nom + explication. */
function ligneConseil(type, nom, texte) {
  const ligne = creer('li', 'conseil');
  const pastille = creer('span', `conseil__type conseil__type--${type}`, ETIQUETTES_CONSEIL[type] || '');
  const textes = creer('span', 'conseil__textes');
  textes.append(creer('span', 'conseil__nom', nom), creer('span', 'conseil__texte', texte));
  ligne.append(pastille, textes);
  return ligne;
}

/** Écran Sam : conseils calculés sur le téléphone, puis accès au chat. */
function afficherSam() {
  const analyse = analyserAvecSam();
  const blocs = [];

  const entete = creer('div', 'sam-entete');
  const avatar = creer('span', 'pastille-seance avatar-sam', 'S');
  avatar.setAttribute('aria-hidden', 'true');
  entete.append(avatar, creer('p', 'sam-entete__mot', motDeSam(analyse)));
  blocs.push(entete);

  // Prochaine séance : objectif et repos pour chaque exercice
  if (analyse.prochaine) {
    const liste = creer('ul', 'conseils');
    for (const exercice of analyse.prochaine.exercices.filter(Boolean)) {
      const conseil = conseilCharge(exercice);
      liste.append(ligneConseil(conseil.type, exercice.nom, `${conseil.texte} Repos : ${reposConseille(exercice)}.`));
    }
    const carte = carteSam(`Prochaine séance · ${analyse.prochaine.nom}`, liste);
    carte.classList.add(teinte(analyse.prochaine.id));
    blocs.push(carte);
  }

  // Charges à changer sur tout le programme
  const autres = analyse.charges.filter(({ seance }) => !analyse.prochaine || seance.id !== analyse.prochaine.id);
  if (autres.length) {
    const liste = creer('ul', 'conseils');
    for (const { exercice, seance, conseil } of autres) liste.append(ligneConseil(conseil.type, `${exercice.nom} · ${seance.nom}`, conseil.texte));
    blocs.push(carteSam('Charges sur les autres séances', liste));
  }

  if (analyse.records.length) {
    const liste = creer('ul', 'conseils');
    for (const r of analyse.records) {
      liste.append(ligneConseil('monter', r.exercice.nom, `Nouveau record : ${formaterNombre(r.poids)} kg le ${formaterDate(r.id)} (+${formaterNombre(Math.round(r.gain * 100) / 100)} kg). Bravo !`));
    }
    blocs.push(carteSam('Records', liste));
  }

  // Équilibre du programme : séries par semaine et par muscle (repère : 10 à 20)
  const barres = creer('ul', 'muscles');
  for (const [muscle, series] of Object.entries(analyse.volume).sort((a, b) => b[1] - a[1])) {
    const ligne = creer('li', `muscle${series < 10 ? ' muscle--faible' : ''}`);
    const jauge = creer('span', 'muscle__jauge');
    const remplissage = document.createElement('span');
    remplissage.style.width = `${Math.min(100, (series / 22) * 100)}%`;
    jauge.append(remplissage);
    const valeur = `${formaterNombre(series)} série${series > 1 ? 's' : ''}${series < 10 ? ' · faible' : series > 22 ? ' · beaucoup' : ''}`;
    ligne.append(creer('span', 'muscle__nom', NOMS_MUSCLES[muscle]), jauge, creer('span', 'muscle__valeur', valeur));
    barres.append(ligne);
  }
  const equilibre = carteSam('Équilibre du programme',
    creer('p', 'exercice__cible', 'Séries par semaine et par muscle. Repère pour la prise de masse : 10 à 20.'), barres);
  if (analyse.manques.length) {
    const ajouts = creer('ul', 'conseils');
    for (const [muscle] of analyse.manques) ajouts.append(ligneConseil('ajout', `${NOMS_MUSCLES[muscle]} : à renforcer`, `Idée : ${AJOUTS_CONSEILLES[muscle]}. Tu peux l'ajouter dans Programme.`));
    equilibre.append(ajouts);
  }
  blocs.push(equilibre);

  if (analyse.sautes.length) {
    const liste = creer('ul', 'conseils');
    // Les plus souvent sautés d'abord, 4 au plus pour rester lisible
    const sautes = [...analyse.sautes].sort((a, b) => b.fois / b.sur - a.fois / a.sur).slice(0, 4);
    for (const { exercice, seance, fois, sur } of sautes) {
      liste.append(ligneConseil('saute', `${exercice.nom} · ${seance.nom}`, `Sauté ${fois} fois sur tes ${sur} dernières séances. S'il ne te convient pas, remplace-le ou retire-le dans Programme.`));
    }
    blocs.push(carteSam('Exercices souvent sautés', liste));
  }

  const { semaine, objectif, jours, serie } = analyse.regularite;
  const phrases = [`Cette semaine : ${semaine}/${objectif} séances.`];
  if (jours !== null && jours >= 4) phrases.push(`Ta dernière séance date de ${jours} jours : on y retourne ?`);
  if (serie >= 2) phrases.push(`${serie} semaines d'affilée à 3 séances ou plus. Belle régularité !`);
  blocs.push(carteSam('Régularité', creer('p', 'carte__texte', phrases.join(' '))));
  const dernierePesee = analyse.pesees[analyse.pesees.length - 1];
  blocs.push(carteSam('Poids de corps', creer('p', 'carte__texte', dernierePesee
    ? `${formaterNombre(dernierePesee.poids)} kg le ${formaterDate(dernierePesee.date)}. ${conseilPoids(analyse.rythmePoids)}`
    : 'Note ton poids dans « Mon corps » : je te dirai si ta prise de masse va au bon rythme.')));
  blocs.push(carteSam('Astuce du jour', creer('p', 'carte__texte', analyse.astuce)));

  const demander = creer('button', 'bouton bouton--principal', 'Demander à Claude');
  demander.type = 'button';
  demander.dataset.action = 'copier-claude';
  const zoneClaude = creer('div', 'zone-claude');
  zoneClaude.hidden = true;
  const discuter = creer('button', 'bouton bouton--secondaire', 'Discuter dans l\'appli (API payante)');
  discuter.type = 'button';
  discuter.dataset.action = 'chat';
  const actions = creer('div', 'actions');
  actions.append(
    demander,
    zoneClaude,
    discuter,
    creer('p', 'exercice__cible', 'Les conseils ci-dessus sont calculés sur ton téléphone, même sans réseau. « Demander à Claude » copie tes données pour les coller dans l\'appli Claude, avec ton forfait Pro.'),
  );
  blocs.push(actions);

  document.getElementById('ecran-sam').replaceChildren(...blocs);
  montrerEcran('sam', 'Sam, ton coach');
}

/** Ligne « Repos » et conseil de Sam dans une carte d'exercice de la séance. */
function creerConseilSeance(exercice, i) {
  const bloc = creer('div', 'exercice__sam');
  const ligneRepos = creer('div', 'exercice__repos-ligne');
  ligneRepos.append(creer('p', 'exercice__repos', `Repos : ${reposConseille(exercice)}`));
  if (aideChargeUtile(exercice)) {
    const bouton = creer('button', 'bouton-mini', 'Échauffement');
    bouton.type = 'button';
    bouton.dataset.aide = String(i);
    bouton.setAttribute('aria-expanded', 'false');
    bouton.setAttribute('aria-controls', `aide-${i}`);
    ligneRepos.append(bouton);
  }
  bloc.append(ligneRepos);
  if (aideChargeUtile(exercice)) {
    const panneau = creer('div', 'aide-charge');
    panneau.id = `aide-${i}`;
    panneau.hidden = true;
    bloc.append(panneau);
  }
  const conseil = conseilCharge(exercice);
  if (['monter', 'baisser', 'stagne'].includes(conseil.type)) {
    const ligne = creer('div', 'conseil-seance');
    const avatar = creer('span', 'avatar-sam avatar-sam--mini', 'S');
    avatar.setAttribute('aria-hidden', 'true');
    ligne.append(avatar, creer('span', 'conseil-seance__texte', `Sam : ${conseil.court}`));
    if (typeof conseil.poids === 'number') {
      const appliquer = creer('button', 'bouton-mini', 'Appliquer');
      appliquer.type = 'button';
      appliquer.dataset.appliquer = String(conseil.poids);
      appliquer.dataset.exercice = String(i);
      appliquer.setAttribute('aria-label', `Appliquer ${formaterNombre(conseil.poids)} kg aux séries pas encore cochées de ${exercice.nom}`);
      ligne.append(appliquer);
    }
    bloc.append(ligne);
  }
  return bloc;
}

/** Met le poids proposé par Sam sur les séries pas encore cochées. */
function appliquerConseil(bouton) {
  const i = Number(bouton.dataset.exercice);
  const poids = Number(bouton.dataset.appliquer);
  const series = etat.donnees.enCours.exercices[i].series;
  series.forEach((serie, j) => {
    if (serie.fait) return;
    serie.poids = poids;
    const champ = document.querySelector(`.serie[data-exercice="${i}"][data-serie="${j}"] [data-champ="poids"]`);
    if (champ) {
      champ.value = formaterNombre(poids);
      champ.removeAttribute('aria-invalid');
    }
  });
  etat.donnees.enCours.derniereAction = Date.now();
  enregistrer();
  bouton.textContent = 'Appliqué';
  bouton.disabled = true;
  vibrer();
  majAideCharge(i);
}

/* ---------- Sam : discussion avec l'IA (Claude, en ligne, sur demande) ---------- */

const CLE_SAM_API = 'suivi_sam_cle'; // clé API : jamais dans suivi_donnees, donc jamais exportée
const CLE_SAM_DISCUSSION = 'suivi_sam_discussion';
const MODELE_SAM = 'claude-haiku-5-5';
const DUREE_DISCUSSION_MS = 12 * 3600000; // au-delà, les données envoyées à Sam sont trop vieilles
const MESSAGES_MAX = 40;

const QUESTIONS_SAM = [
  'Je dois monter en charge sur quels exercices ?',
  'Mon programme est-il équilibré ?',
  'Combien de temps de repos entre mes séries ?',
  'Que manger pour ma prise de masse ?',
];

function lireCleSam() {
  try {
    return localStorage.getItem(CLE_SAM_API) || '';
  } catch {
    return '';
  }
}

function lireDiscussion() {
  try {
    const d = JSON.parse(localStorage.getItem(CLE_SAM_DISCUSSION));
    return d && typeof d.systeme === 'string' && Array.isArray(d.messages) && Number.isFinite(d.creeLe) ? d : null;
  } catch {
    return null;
  }
}

function sauverDiscussion(discussion) {
  try {
    if (discussion) localStorage.setItem(CLE_SAM_DISCUSSION, JSON.stringify(discussion));
    else localStorage.removeItem(CLE_SAM_DISCUSSION);
  } catch {
    // Stockage plein : la discussion reste en mémoire le temps de l'écran
  }
}

/** Une séance de l'historique en une ligne pour Sam. */
function ligneHistoriqueSam(entree) {
  const exercices = entree.exercices.map((ex) => {
    const exercice = trouverExerciceDansProgramme(ex.exerciceId) || { nom: ex.exerciceId, unite: 'reps', poidsDuCorps: false };
    const series = ex.series.map((s) => `${texteSerie(exercice, s)}${s.fait ? '' : ' (non faite)'}`).join(' ; ');
    return `  - ${exercice.nom} : ${series}`;
  });
  const duree = texteDuree(entree);
  return [`${formaterDate(entree.id)} ${heureDepuisId(entree.id)} · ${nomSeance(entree.seanceId)}${duree ? ` · ${duree}` : ''}`, ...exercices].join('\n');
}

/** Données de Guillaume pour Sam : programme, séances des 12 dernières semaines, analyses locales. */
function donneesPourSam() {
  const jour = new Date().toLocaleDateString('fr-FR', { weekday: 'long' });
  const programme = etat.donnees.programme.map((seance, s) => {
    const lignes = seance.exercices.filter(Boolean).map((ex) => {
      const depart = typeof ex.poidsDefaut === 'number' ? `, poids de départ ${formaterNombre(ex.poidsDefaut)} kg` : '';
      const type = ex.unite === 's' ? 'gainage' : estIsolation(ex) ? 'isolation' : 'polyarticulaire';
      return `  - ${ex.nom} : ${texteCible(ex)}${depart}${ex.poidsDuCorps ? ', au poids du corps (poids = lest)' : ''} · ${type} · repos conseillé ${reposConseille(ex)}`;
    });
    return [`Séance ${s + 1} · ${seance.nom}`, ...lignes].join('\n');
  }).join('\n');

  const limite = Date.now() - 12 * 7 * 86400000;
  const seances = entreesHistorique().filter((e) => tempsDepuisId(e.id) >= limite).slice(0, 40);
  const historique = seances.length ? seances.map(ligneHistoriqueSam).join('\n') : 'Aucune séance enregistrée pour l\'instant.';

  const analyse = analyserAvecSam();
  const conseils = [
    ...analyse.charges.map(({ exercice, conseil }) => `- ${exercice.nom} : ${conseil.texte}`),
    ...analyse.records.map((r) => `- Record : ${r.exercice.nom} ${formaterNombre(r.poids)} kg le ${formaterDate(r.id)}`),
    ...analyse.manques.map(([m, v]) => `- ${NOMS_MUSCLES[m]} : ${formaterNombre(v)} séries par semaine (faible)`),
    ...analyse.sautes.map(({ exercice, fois, sur }) => `- ${exercice.nom} sauté ${fois} fois sur ${sur}`),
    `- Cette semaine : ${analyse.regularite.semaine}/${analyse.regularite.objectif} séances`,
    analyse.rythmePoids !== null ? `- Poids de corps : ${formaterEcart(analyse.rythmePoids)} kg par semaine sur 4 semaines` : '',
  ].filter(Boolean).join('\n');
  const pesees = analyse.pesees.slice(-12).map((e) => `- ${formaterDate(e.date)} : ${formaterNombre(e.poids)} kg`).join('\n')
    || 'Aucune pesée enregistrée.';

  return `<donnees date="${jour} ${formaterDate(idSeance(Date.now()))}">
<programme>
${programme}
</programme>
<seances_recentes>
${historique}
</seances_recentes>
<poids_de_corps>
${pesees}
</poids_de_corps>
<analyses_automatiques>
${conseils}
</analyses_automatiques>
</donnees>`;
}

/**
 * Consignes de Sam. pourClaudeAi : texte collé par Guillaume lui-même dans l'appli Claude
 * (Markdown autorisé, il s'adresse directement à Sam).
 */
function consignesSam(pourClaudeAi) {
  const presentation = pourClaudeAi
    ? 'Tu es Sam, mon coach de musculation. Je m\'appelle Guillaume, j\'ai 19 ans, je suis en prise de masse et je m\'entraîne 4 fois par semaine en salle. Mes données viennent de mon appli « Suivi de séances ».'
    : 'Tu es Sam, le coach de musculation de Guillaume dans son appli « Suivi de séances ». Guillaume a 19 ans, il est en prise de masse et s\'entraîne 4 fois par semaine en salle.';
  const format = pourClaudeAi
    ? ''
    : '\n- Texte simple, sans mise en forme Markdown (pas d\'astérisques, pas de #). Pour une liste, commence chaque ligne par « - ».';
  return `${presentation}

Ton rôle : l'aider à progresser en sécurité. Tu le conseilles sur les charges (monter, garder, baisser), les temps de repos, le choix des exercices (ajouter, remplacer, retirer), l'équilibre du programme, la récupération, le sommeil et l'alimentation pour la prise de masse.

Comment tu réponds :
- En français, en le tutoyant, comme un coach bienveillant et direct.
- Court et concret : 3 à 8 phrases ou une courte liste, sauf s'il demande plus de détails.
- Appuie-toi sur ses données et cite les chiffres (charges, reps, dates au format JJ/MM/AAAA). Si une information manque, dis-le simplement.
- Règle de progression de l'appli : quand toutes les séries d'un exercice atteignent le haut de la fourchette de reps, proposer +2 kg sur un polyarticulaire, +1 kg sur une isolation. C'est une suggestion, jamais une obligation.${format}
- Santé : tu n'es pas médecin. En cas de douleur, de blessure, de malaise ou de question médicale, conseille d'arrêter l'exercice concerné et de consulter un professionnel de santé. Jamais de produits dopants, de régimes extrêmes ni de charges dangereuses.
- Si la question n'a rien à voir avec l'entraînement, la récupération ou la nutrition sportive, ramène gentiment la discussion vers ses séances.`;
}

/**
 * Consignes et données envoyées à Sam (API). Figées pour toute une discussion :
 * modifier un message déjà envoyé invaliderait la réflexion du modèle (historique « en ajout seul »).
 */
function construireSystemeSam() {
  return `${consignesSam(false)}\n\n${donneesPourSam()}`;
}

/* ---------- Sam : « Demander à Claude » (copier-coller dans l'appli Claude, forfait Pro, sans API) ---------- */

/** Texte à coller dans une nouvelle discussion Claude ; Guillaume écrit sa question à la fin. */
function textePourClaude() {
  return `${consignesSam(true)}\n\nVoici mes données :\n${donneesPourSam()}\n\nMa question : `;
}

/** Carte affichée après la copie : étapes, bouton « Ouvrir Claude », copie manuelle si besoin. */
function creerCarteClaude(copie, texte) {
  const carte = creer('article', 'carte carte-claude');
  carte.setAttribute('role', 'status');
  const etapes = creer('ol', 'etapes');
  etapes.append(
    creer('li', '', 'Touche « Ouvrir Claude » et démarre une nouvelle discussion.'),
    creer('li', '', 'Appui long dans la zone de message, puis « Coller ».'),
    creer('li', '', 'Écris ta question à la fin, après « Ma question : », et envoie.'),
  );
  carte.append(creer('h2', 'exercice__nom', copie ? 'Copié !' : 'Copie le texte ci-dessous'));
  if (!copie) {
    const zone = creer('textarea', 'texte-copie');
    zone.readOnly = true;
    zone.value = texte;
    zone.setAttribute('aria-label', 'Texte à copier pour Claude');
    carte.append(creer('p', 'carte__texte', 'La copie automatique n\'a pas marché : sélectionne tout le texte, puis « Copier ».'), zone);
  }
  const ouvrir = creer('a', 'bouton bouton--principal', 'Ouvrir Claude');
  ouvrir.href = 'https://claude.ai/new';
  ouvrir.target = '_blank';
  ouvrir.rel = 'noopener';
  carte.append(
    etapes,
    ouvrir,
    creer('p', 'exercice__cible', `Données du ${formaterDate(idSeance(Date.now()))} à ${formaterHeure(Date.now())}. Elles passent par ton compte Claude, pas par l'appli. Après une nouvelle séance, recopie-les.`),
  );
  return carte;
}

/** Copie programme + séances + analyses pour l'appli Claude, puis affiche les étapes. */
async function copierPourClaude(bouton) {
  const zone = bouton.closest('.ecran').querySelector('.zone-claude');
  const texte = textePourClaude();
  let copie = false;
  try {
    await navigator.clipboard.writeText(texte);
    copie = true;
  } catch {
    copie = false; // presse-papiers indisponible : copie manuelle
  }
  zone.replaceChildren(creerCarteClaude(copie, texte));
  zone.hidden = false;
  bouton.textContent = 'Copier à nouveau';
  bouton.classList.replace('bouton--principal', 'bouton--secondaire');
  if (copie) vibrer();
  else zone.querySelector('textarea').select();
  zone.scrollIntoView({ block: 'nearest', behavior: mouvementReduit.matches ? 'auto' : 'smooth' });
}

/** Texte lisible d'une réponse : blocs « text » uniquement, mise en forme Markdown retirée. */
function texteReponse(contenu) {
  const blocs = Array.isArray(contenu) ? contenu : [{ type: 'text', text: String(contenu) }];
  return blocs.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n')
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s*/gm, '').trim();
}

/** Message d'erreur compréhensible selon la réponse de l'API. */
function messageErreurSam(statut, corps) {
  const detail = corps && corps.error && typeof corps.error.message === 'string' ? corps.error.message : '';
  if (statut === 401) return 'Clé API refusée : vérifie-la (bouton « Changer de clé » en bas).';
  if (statut === 400 && /credit|balance/i.test(detail)) return 'Plus de crédit sur ton compte Anthropic : recharge-le sur console.anthropic.com.';
  if (statut === 403) return 'Accès refusé par l\'API : vérifie les droits de ta clé dans la console Anthropic.';
  if (statut === 429) return 'Trop de questions d\'un coup : réessaie dans une minute.';
  if (statut >= 500) return 'Le service de Sam est surchargé : réessaie dans un moment.';
  return `Sam n'a pas pu répondre${detail ? ` : ${detail}` : '.'}`;
}

/** Appelle l'API Claude depuis le téléphone (requête HTTP directe : l'appli n'a ni dépendance ni build). */
async function appelerSam(discussion, cle) {
  let reponse;
  try {
    reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cle,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true', // appel depuis le navigateur, avec la clé de Guillaume
      },
      body: JSON.stringify({
        model: MODELE_SAM,
        max_tokens: 16000,
        output_config: { effort: 'medium' },
        cache_control: { type: 'ephemeral' }, // consignes + données réutilisées à chaque message
        system: discussion.systeme,
        messages: discussion.messages,
      }),
    });
  } catch {
    throw new Error('Pas de réseau : Sam a besoin d\'internet pour discuter. Ses conseils automatiques restent disponibles.');
  }
  const corps = await reponse.json().catch(() => null);
  if (!reponse.ok) throw new Error(messageErreurSam(reponse.status, corps));
  if (!corps || !Array.isArray(corps.content)) throw new Error('Réponse illisible : réessaie.');
  if (corps.stop_reason === 'refusal') throw new Error('Sam ne peut pas répondre à cette question. Reformule-la autrement.');
  if (!texteReponse(corps.content)) throw new Error('Sam n\'a rien répondu : réessaie.');
  return corps.content; // gardé tel quel (blocs de réflexion compris) pour la suite de la discussion
}

/** Bulle de discussion. */
function creerBulle(role, texte) {
  const bulle = creer('div', `bulle bulle--${role}`);
  if (role === 'sam') {
    const avatar = creer('span', 'avatar-sam avatar-sam--mini', 'S');
    avatar.setAttribute('aria-hidden', 'true');
    bulle.append(avatar);
  }
  const contenu = creer('p', 'bulle__texte', texte);
  if (role === 'sam') contenu.prepend(creer('span', 'visuellement-cache', 'Sam : '));
  if (role === 'moi') contenu.prepend(creer('span', 'visuellement-cache', 'Toi : '));
  bulle.append(contenu);
  return bulle;
}

function creerBulleAttente() {
  const bulle = creerBulle('sam', '');
  bulle.classList.add('bulle--attente');
  const points = bulle.querySelector('.bulle__texte');
  points.replaceChildren(creer('span', 'visuellement-cache', 'Sam réfléchit…'), creer('span', 'points', ''));
  return bulle;
}

/** Cartes de configuration : coller sa clé API, ou passer par l'abonnement Claude. */
function creerCarteCleSam() {
  const carte = creer('article', 'carte');
  const etapes = creer('ol', 'etapes');
  const lien = creer('a', '', 'console.anthropic.com');
  lien.href = 'https://console.anthropic.com/';
  lien.target = '_blank';
  lien.rel = 'noopener';
  const etape1 = creer('li', '', 'Crée un compte sur ');
  etape1.append(lien, document.createTextNode(' et ajoute un peu de crédit (5 € suffisent pour environ 2 000 questions avec Claude Haiku 5.5).'));
  etapes.append(
    etape1,
    creer('li', '', 'Dans « API Keys », crée une clé et copie-la.'),
    creer('li', '', 'Colle-la ci-dessous.'),
  );

  const formulaire = creer('form', 'formulaire');
  formulaire.id = 'formulaire-cle';
  formulaire.noValidate = true;
  const champ = creer('input', 'champ champ--formulaire');
  champ.id = 'cle-sam';
  champ.type = 'password';
  champ.autocomplete = 'off';
  champ.spellcheck = false;
  champ.placeholder = 'sk-ant-…';
  const label = creer('label', 'etiquette', 'Clé API');
  label.htmlFor = champ.id;
  const bloc = creer('div', 'formulaire__champ');
  bloc.append(label, champ);
  const erreur = creer('p', 'message');
  erreur.id = 'erreur-cle';
  erreur.setAttribute('role', 'alert');
  erreur.hidden = true;
  const valider = creer('button', 'bouton bouton--principal', 'Enregistrer la clé');
  valider.type = 'submit';
  formulaire.append(erreur, bloc, valider);

  carte.append(
    creer('h2', 'exercice__nom', 'Brancher Sam sur l\'IA'),
    creer('p', 'carte__texte', 'Pour discuter librement, Sam utilise Claude (Anthropic). Il te faut ta propre clé API :'),
    etapes,
    creer('p', 'exercice__cible', 'Conseil : fixe une limite de dépense mensuelle dans la console (« Limits »).'),
    creer('p', 'exercice__cible', 'Ta clé reste sur ce téléphone, jamais dans tes sauvegardes. Quand tu poses une question, ton prénom, ton programme et tes séances des 12 dernières semaines sont envoyés à Anthropic pour que Sam réponde. Rien n\'est envoyé tant que tu ne poses pas de question.'),
    formulaire,
  );

  const demander = creer('button', 'bouton bouton--secondaire', 'Demander à Claude');
  demander.type = 'button';
  demander.dataset.action = 'copier-claude';
  const zoneClaude = creer('div', 'zone-claude');
  zoneClaude.hidden = true;
  const sansCle = creer('article', 'carte');
  sansCle.append(
    creer('h2', 'exercice__nom', 'Pas de clé API ?'),
    creer('p', 'carte__texte', 'Utilise ton abonnement Claude : l\'appli copie tes données, tu les colles dans l\'appli Claude et tu poses ta question. Gratuit avec ton forfait.'),
    demander,
  );
  const ensemble = document.createDocumentFragment();
  ensemble.append(carte, sansCle, zoneClaude);
  return ensemble;
}

/** Écran de discussion avec Sam. */
function afficherChat() {
  const ecran = document.getElementById('ecran-chat');
  if (!lireCleSam()) {
    ecran.replaceChildren(creerCarteCleSam());
    montrerEcran('chat', 'Discuter avec Sam', 'Retour à Sam');
    return;
  }
  let discussion = lireDiscussion();
  if (discussion && Date.now() - discussion.creeLe > DUREE_DISCUSSION_MS) discussion = null; // données trop anciennes
  etat.discussion = discussion;

  const info = creer('p', 'exercice__cible', discussion
    ? `Sam (IA · Claude Haiku 5.5) · données du ${formaterDate(idSeance(discussion.creeLe))} à ${formaterHeure(discussion.creeLe)}`
    : 'Sam (IA · Claude Haiku 5.5) · pose ta question, il voit ton programme et tes séances.');

  const fil = creer('div', 'fil');
  fil.id = 'fil-sam';
  fil.setAttribute('aria-live', 'polite');
  for (const message of discussion ? discussion.messages : []) {
    fil.append(creerBulle(message.role === 'user' ? 'moi' : 'sam', message.role === 'user' ? String(message.content) : texteReponse(message.content)));
  }

  const suggestions = creer('div', 'suggestions');
  suggestions.id = 'suggestions-sam';
  suggestions.hidden = Boolean(discussion && discussion.messages.length);
  for (const question of QUESTIONS_SAM) {
    const puce = creer('button', 'suggestion', question);
    puce.type = 'button';
    puce.dataset.question = question;
    suggestions.append(puce);
  }

  const saisie = creer('form', 'saisie');
  saisie.id = 'saisie-sam';
  const zone = creer('textarea', 'saisie__zone');
  zone.id = 'question-sam';
  zone.rows = 1;
  zone.maxLength = 1000;
  zone.placeholder = 'Écris à Sam…';
  zone.setAttribute('aria-label', 'Ta question pour Sam');
  const envoyer = creer('button', 'saisie__envoyer');
  envoyer.type = 'submit';
  envoyer.setAttribute('aria-label', 'Envoyer');
  envoyer.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  saisie.append(zone, envoyer);

  const nouvelle = creer('button', 'bouton bouton--secondaire', 'Nouvelle discussion');
  nouvelle.type = 'button';
  nouvelle.dataset.action = 'nouvelle';
  const changer = creer('button', 'bouton-lien', 'Changer de clé');
  changer.type = 'button';
  changer.dataset.action = 'oublier-cle';
  const actions = creer('div', 'actions');
  actions.append(nouvelle, changer);

  ecran.replaceChildren(info, fil, suggestions, saisie, actions);
  montrerEcran('chat', 'Discuter avec Sam', 'Retour à Sam', '', () => {
    if (discussion && discussion.messages.length) fil.lastElementChild.scrollIntoView({ block: 'end' });
  });
}

/** Envoie une question à Sam et affiche sa réponse. */
async function envoyerQuestion(texte) {
  const question = texte.trim().slice(0, 1000);
  const zone = document.getElementById('question-sam');
  const fil = document.getElementById('fil-sam');
  if (!question || !zone || zone.disabled) return;

  if (!etat.discussion) etat.discussion = { creeLe: Date.now(), systeme: construireSystemeSam(), messages: [] };
  const discussion = etat.discussion;
  if (discussion.messages.length >= MESSAGES_MAX) {
    fil.append(creerBulle('erreur', 'Discussion déjà longue : lance une « Nouvelle discussion » pour continuer.'));
    return;
  }

  document.getElementById('suggestions-sam').hidden = true;
  discussion.messages.push({ role: 'user', content: question });
  zone.value = '';
  zone.style.height = '';
  zone.disabled = true;
  fil.append(creerBulle('moi', question));
  const attente = creerBulleAttente();
  fil.append(attente);
  attente.scrollIntoView({ block: 'end', behavior: mouvementReduit.matches ? 'auto' : 'smooth' });

  try {
    const contenu = await appelerSam(discussion, lireCleSam());
    discussion.messages.push({ role: 'assistant', content: contenu });
    sauverDiscussion(discussion);
    attente.replaceWith(creerBulle('sam', texteReponse(contenu)));
  } catch (erreur) {
    // Question sans réponse : on la retire (rien d'autre n'a été envoyé après) et on la remet dans la zone
    discussion.messages.pop();
    if (!discussion.messages.length) etat.discussion = null;
    attente.replaceWith(creerBulle('erreur', erreur.message));
    zone.value = question;
  } finally {
    zone.disabled = false;
    if (document.getElementById('fil-sam') === fil) fil.lastElementChild.scrollIntoView({ block: 'end' });
  }
}

/** Enregistre la clé API collée par Guillaume. */
function enregistrerCleSam(form) {
  const cle = form.elements['cle-sam'].value.trim();
  const erreur = document.getElementById('erreur-cle');
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(cle)) {
    erreur.textContent = 'Cette clé ne ressemble pas à une clé Anthropic (elle commence par « sk-ant- »).';
    erreur.hidden = false;
    form.elements['cle-sam'].focus();
    return;
  }
  try {
    localStorage.setItem(CLE_SAM_API, cle);
  } catch {
    erreur.textContent = 'Stockage plein : impossible d\'enregistrer la clé.';
    erreur.hidden = false;
    return;
  }
  afficherChat();
  afficherMessage('Clé enregistrée : Sam est prêt à discuter.');
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

// Page en cache plus ancienne que le script (la mise à jour arrive en deux temps) : on crée les écrans manquants
for (const nom of ECRANS) {
  if (document.getElementById(`ecran-${nom}`)) continue;
  const section = creer('section', 'ecran');
  section.id = `ecran-${nom}`;
  section.setAttribute('aria-labelledby', 'titre-ecran');
  section.hidden = true;
  document.getElementById('contenu').append(section);
}

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
  if (evenement.target.name === 'mesure') etat.mesureProgression = evenement.target.value;
  if (evenement.target.id === 'choix-exercice' || evenement.target.name === 'mesure') majProgression();
});

// Rotation ou redimensionnement : la courbe est redessinée à la bonne largeur
let redessinPrevu = false;
window.addEventListener('resize', () => {
  if (etat.ecran !== 'progression' || redessinPrevu) return;
  redessinPrevu = true;
  requestAnimationFrame(() => {
    redessinPrevu = false;
    if (document.getElementById('choix-exercice')) majProgression(false);
  });
});

document.getElementById('bouton-programme').addEventListener('click', () => {
  afficherMessage('');
  afficherProgramme();
});

document.getElementById('ecran-programme').addEventListener('click', (evenement) => {
  if (evenement.target.closest('[data-reinitialiser]')) {
    remettreProgrammeDepart();
    return;
  }
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

document.getElementById('bouton-corps').addEventListener('click', () => {
  afficherMessage('');
  afficherCorps();
});

const ecranCorps = document.getElementById('ecran-corps');
ecranCorps.addEventListener('submit', (evenement) => {
  evenement.preventDefault();
  enregistrerPoidsCorps(evenement.target);
});
ecranCorps.addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('[data-supprimer-poids]');
  if (bouton) supprimerPoidsCorps(bouton.dataset.supprimerPoids);
});

document.getElementById('bouton-sam').addEventListener('click', () => {
  afficherMessage('');
  afficherSam();
});

document.getElementById('ecran-sam').addEventListener('click', (evenement) => {
  const copier = evenement.target.closest('[data-action="copier-claude"]');
  if (copier) {
    copierPourClaude(copier);
    return;
  }
  if (evenement.target.closest('[data-action="chat"]')) {
    afficherMessage('');
    afficherChat();
  }
});

const ecranChat = document.getElementById('ecran-chat');
ecranChat.addEventListener('submit', (evenement) => {
  evenement.preventDefault();
  if (evenement.target.id === 'formulaire-cle') enregistrerCleSam(evenement.target);
  else envoyerQuestion(document.getElementById('question-sam').value);
});
ecranChat.addEventListener('click', (evenement) => {
  const copier = evenement.target.closest('[data-action="copier-claude"]');
  if (copier) {
    copierPourClaude(copier);
    return;
  }
  const suggestion = evenement.target.closest('[data-question]');
  const action = evenement.target.closest('[data-action]');
  if (suggestion) envoyerQuestion(suggestion.dataset.question);
  else if (action && action.dataset.action === 'nouvelle') {
    etat.discussion = null;
    sauverDiscussion(null);
    afficherChat();
  } else if (action && action.dataset.action === 'oublier-cle') {
    if (!confirm('Retirer ta clé API de ce téléphone ? Tu pourras en coller une autre.')) return;
    try {
      localStorage.removeItem(CLE_SAM_API);
    } catch {
      // rien à faire
    }
    afficherChat();
  }
});
// Zone de saisie : grandit avec le texte ; Entrée envoie, Maj + Entrée va à la ligne
ecranChat.addEventListener('input', (evenement) => {
  if (evenement.target.id !== 'question-sam') return;
  evenement.target.style.height = '';
  evenement.target.style.height = `${Math.min(evenement.target.scrollHeight, 140)}px`;
});
ecranChat.addEventListener('keydown', (evenement) => {
  if (evenement.target.id === 'question-sam' && evenement.key === 'Enter' && !evenement.shiftKey && !evenement.isComposing) {
    evenement.preventDefault();
    envoyerQuestion(evenement.target.value);
  }
});

document.getElementById('ecran-bilan').addEventListener('click', (evenement) => {
  const action = evenement.target.closest('[data-action]');
  if (!action) return;
  afficherMessage('');
  if (action.dataset.action === 'detail') afficherDetail(action.dataset.entree);
  else {
    sensTransition = 'arriere';
    afficherAccueil();
  }
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
  else if (evenement.target.name && evenement.target.name.startsWith('barre-')) {
    etat.barre = Number(evenement.target.value);
    majAideCharge(Number(evenement.target.name.slice(6)));
  }
});

// Retour dans l'appli : l'écran reste allumé si une séance est en cours, le minuteur se remet à l'heure
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (etat.donnees.enCours) garderEcranAllume(true);
  if (minuteur.tic) majMinuteur();
});
ecranSeance.addEventListener('click', (evenement) => {
  const appliquer = evenement.target.closest('[data-appliquer]');
  if (appliquer) {
    appliquerConseil(appliquer);
    return;
  }
  const aide = evenement.target.closest('[data-aide]');
  if (aide) {
    basculerAideCharge(aide);
    return;
  }
  const action = evenement.target.closest('[data-action]');
  if (!action) return;
  if (action.dataset.action === 'terminer') terminerSeance();
  else abandonnerSeance();
});

// Onde au toucher sur les boutons et les cartes : elle part du doigt et s'étale
document.addEventListener('pointerdown', (evenement) => {
  if (mouvementReduit.matches || !Element.prototype.animate) return;
  const cible = evenement.target.closest('.bouton, .seance, .tuile, .bouton-mini, .suggestion, .minuteur__bouton');
  if (!cible || cible.disabled) return;
  const cadre = cible.getBoundingClientRect();
  const taille = Math.hypot(cadre.width, cadre.height) * 2;
  const onde = creer('span', 'onde');
  onde.setAttribute('aria-hidden', 'true');
  Object.assign(onde.style, {
    width: `${taille}px`,
    height: `${taille}px`,
    left: `${evenement.clientX - cadre.left - taille / 2}px`,
    top: `${evenement.clientY - cadre.top - taille / 2}px`,
  });
  cible.append(onde);
  onde.animate([
    { transform: 'scale(0)', opacity: 0.3 },
    { transform: 'scale(1)', opacity: 0 },
  ], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => onde.remove();
}, { passive: true });

// Barre du haut : se compacte et devient « verre dépoli » dès qu'on fait défiler
const marquerDefilement = () => document.body.classList.toggle('defile', window.scrollY > 8);
window.addEventListener('scroll', marquerDefilement, { passive: true });

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
requestAnimationFrame(() => { transitionsActives = true; }); // premier affichage fait : les transitions peuvent jouer

enregistrerServiceWorker();
