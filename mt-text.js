/**
 * Magic Translator — Helpers de texte purs (testables)
 * ═════════════════════════════════════════════════════
 *
 * Fonctions SANS dépendance au DOM, au réseau ni aux API navigateur :
 * texte en entrée → texte en sortie. Extraites du script de contenu pour être
 * couvertes par des tests unitaires (test/text.test.js), tout en restant
 * utilisables dans Thunderbird.
 *
 * Double usage :
 *   • Script de contenu : injecté AVANT translator-injected.js (voir background.js).
 *     Pose l'API sur globalThis.MTText, que le script principal consomme.
 *   • Tests Node : `import "./mt-text.js"` exécute ce fichier (effet de bord) ;
 *     l'API est ensuite lue sur globalThis.MTText.
 *
 * @see translator-injected.js — consommateur (lancerTraduction)
 * @see test/text.test.js — tests unitaires
 */

(function (global) {
  "use strict";

  /**
   * Sépare les espaces de tête/fin d'un texte de son « cœur ».
   * Permet de ne PAS envoyer les espaces de bord à Google (qui les altère) et de
   * les réattacher tels quels à la réinjection — préserve l'espacement aux frontières.
   *
   * @param   {string} txt
   * @returns {{lead: string, coeur: string, trail: string}}
   */
  const extraireEspaces = (txt) => {
    const lead = txt.match(/^\s*/)[0];
    const trail = txt.match(/\s*$/)[0];
    const coeur = txt.slice(lead.length, txt.length - trail.length);
    return { lead, coeur, trail };
  };

  /**
   * Découpe un texte trop long (> maxLen) en segments traduisibles séparément,
   * en coupant de préférence sur un saut de ligne ou une espace proche de la limite
   * (coupe dure en dernier recours). Le recollage par join("") reconstitue le texte.
   *
   * @param   {string} texte
   * @param   {number} maxLen
   * @returns {string[]} Segments contigus
   */
  const decouperLong = (texte, maxLen) => {
    if (!maxLen || maxLen <= 0) return [texte];
    const segments = [];
    let reste = texte;
    while (reste.length > maxLen) {
      let coupe = reste.lastIndexOf("\n", maxLen);
      if (coupe < maxLen * 0.5) coupe = reste.lastIndexOf(" ", maxLen);
      if (coupe < maxLen * 0.5) coupe = maxLen; // aucun séparateur proche → coupe dure
      segments.push(reste.slice(0, coupe));
      reste = reste.slice(coupe);
    }
    if (reste) segments.push(reste);
    return segments;
  };

  global.MTText = { extraireEspaces, decouperLong };
})(typeof globalThis !== "undefined" ? globalThis : this);
