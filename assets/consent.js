/* Quotepilote — consentement cookies (CNIL) + Meta Pixel.
   Le pixel n'est chargé qu'après un clic sur « Accepter ». Refus = aucun traceur.
   Choix conservé 6 mois (recommandation CNIL), modifiable via « Gérer les cookies ». */
(function () {
  var PIXEL_ID = '1016069524798256';
  var KEY = 'qp_consent', MAX_AGE = 1000 * 60 * 60 * 24 * 182;
  var queue = [], loaded = false;

  function read() {
    try { var c = JSON.parse(localStorage.getItem(KEY)); if (c && Date.now() - c.t < MAX_AGE) return c.v; } catch (e) {}
    return null;
  }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {} }

  function loadPixel() {
    if (loaded) return; loaded = true;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    queue.forEach(function (a) { window.fbq.apply(null, a); }); queue = [];
  }

  var STANDARD = ['ViewContent', 'Lead', 'Contact', 'SubmitApplication', 'Schedule', 'CompleteRegistration'];
  window.qpTrack = function (name, params) {
    var args = [STANDARD.indexOf(name) > -1 ? 'track' : 'trackCustom', name, params || {}];
    if (read() !== 'granted') return;           // pas de consentement = pas d'envoi
    if (loaded && window.fbq) window.fbq.apply(null, args); else queue.push(args);
  };

  function banner(show) { var b = document.getElementById('cookie'); if (b) b.classList.toggle('show', show); }

  function init() {
    var c = read();
    if (c === 'granted') loadPixel();
    else if (c === null) banner(true);
    var yes = document.getElementById('cookie-yes'), no = document.getElementById('cookie-no'), s = document.getElementById('cookie-settings');
    if (yes) yes.addEventListener('click', function () { write('granted'); banner(false); loadPixel(); });
    if (no) no.addEventListener('click', function () { write('denied'); banner(false); if (loaded) location.reload(); });
    if (s) s.addEventListener('click', function () { banner(true); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
