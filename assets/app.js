/* Quotepilote — page d'accueil : démo en direct (demande → inscription → devis envoyé) */
(function () {
  // Webhook n8n du flux DÉMO (séparé du flux de production de Prestige Propre).
  var DEMO_WEBHOOK = 'https://universe21.app.n8n.cloud/webhook/demo-devis';
  var DEMO_CLIENT_ID = 'demo-001';
  var MAX_DEMOS_PER_DAY = 3;
  var GRILLE = { 'Fauteuil': 40, 'Canapé 2/3 places': 60, 'Canapé 4/5 places': 70, 'Canapé en U': 80, 'Chaises (lot de 4/6)': 50, 'Pouf': 19 };

  var $ = function (id) { return document.getElementById(id); };
  var track = function (n, p) { if (window.qpTrack) window.qpTrack(n, p); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var eur = function (n) { return Math.round(n).toLocaleString('fr-FR') + ' €'; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* UTM → champ "source" des formulaires */
  try {
    var q = new URLSearchParams(location.search);
    var src = ['utm_source', 'utm_campaign', 'utm_content'].map(function (k) { return q.get(k); }).filter(Boolean).join(' / ');
    if (src) document.querySelectorAll('.utm-src').forEach(function (i) { i.value = src; });
  } catch (e) {}

  /* Header + CTA mobile */
  var header = $('top'), sticky = $('sticky-cta'), demoW = $('demo-widget'), contact = $('contact');
  function onScroll() {
    header.classList.toggle('scrolled', scrollY > 8);
    var d = demoW.getBoundingClientRect(), c = contact.getBoundingClientRect();
    var inDemo = d.top < innerHeight && d.bottom > 0, inContact = c.top < innerHeight;
    sticky.classList.toggle('show', scrollY > 700 && !inDemo && !inContact);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  document.querySelectorAll('[data-track="Contact"]').forEach(function (a) { a.addEventListener('click', function () { track('Contact'); }); });

  /* Calculateur */
  function calc() {
    var r = +$('c-req').value, l = +$('c-lost').value, a = +$('c-avg').value;
    $('o-req').textContent = r; $('o-lost').textContent = l + ' %'; $('o-avg').textContent = eur(a);
    var m = r * l / 100 * a, need = Math.max(1, Math.ceil(99 / a));
    $('o-total').textContent = eur(m) + ' / mois';
    $('o-year').textContent = 'Soit ' + eur(m * 12) + ' par an. Quotepilote coûte 99 € HT par mois : ' +
      (need === 1 ? 'un seul chantier récupéré' : need + ' chantiers récupérés') + ' et il est remboursé.';
  }
  ['c-req', 'c-lost', 'c-avg'].forEach(function (id) { $(id).addEventListener('input', calc); });
  calc();

  /* ---------- Démo ---------- */
  var req = $('req-form'), gate = $('gate-form'), result = $('demo-result');
  var demande = null;

  function setStep(n) {
    document.querySelectorAll('#stepper li').forEach(function (li) {
      var s = +li.dataset.s; li.classList.toggle('on', s === n); li.classList.toggle('done', s < n);
    });
  }
  var started = false;
  req.addEventListener('focusin', function () { if (!started) { started = true; track('ViewContent', { content_name: 'demo' }); } });

  function recent() { var a = store.get('qp_demo') || [], now = Date.now(); return a.filter(function (t) { return now - t < 864e5; }); }

  // Étape 1 → 2 : on calcule le devis et on le montre verrouillé
  req.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('req-msg'); msg.className = 'form-msg'; msg.textContent = '';
    if (!req.checkValidity()) {
      msg.className = 'form-msg err'; msg.textContent = 'Indiquez la ville et un code postal à 5 chiffres.';
      req.reportValidity(); return;
    }
    var fd = new FormData(req);
    var type = fd.get('meubleType'), qty = Math.max(1, Math.min(10, +fd.get('quantite') || 1));
    demande = { type_meuble: type, quantite: String(qty), problemes: fd.getAll('problemes'), ville: fd.get('ville').trim(), code_postal: fd.get('codePostal').trim() };
    var unit = GRILLE[type] || 0, total = unit * qty;
    $('lq-num').textContent = '2026-' + String(Math.floor(1000 + Math.random() * 9000));
    var rows = '<div class="lq-row"><span>' + esc(type) + ' × ' + qty + '</span><span>' + eur(total) + '</span></div>';
    if (demande.problemes.length) rows += '<div class="lq-row blur"><span>Traitement : ' + esc(demande.problemes.join(', ')) + '</span><span>inclus</span></div>';
    rows += '<div class="lq-row blur"><span>Intervention · ' + esc(demande.code_postal) + ' ' + esc(demande.ville) + '</span><span>détail PDF</span></div>';
    $('lq-rows').innerHTML = rows;
    $('lq-total').textContent = eur(total);
    $('g-demande').value = type + ' × ' + qty + ' · ' + demande.code_postal + ' ' + demande.ville + (demande.problemes.length ? ' · ' + demande.problemes.join(', ') : '');
    req.hidden = true; gate.hidden = false; setStep(2);
    var who = store.get('qp_gate');
    if (who) { ['nom', 'entreprise', 'email', 'telephone'].forEach(function (k) { if (who[k] && gate[k]) gate[k].value = who[k]; }); }
    $('g-name').focus({ preventScroll: true });
    demoW.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Étape 2 → 3 : inscription (Formspree) + envoi du devis (n8n)
  gate.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('gate-msg'), btn = $('gate-submit');
    msg.className = 'form-msg'; msg.textContent = '';
    if (gate._gotcha.value) return;
    if (!gate.checkValidity()) { gate.reportValidity(); return; }
    if (recent().length >= MAX_DEMOS_PER_DAY) {
      msg.className = 'form-msg err'; msg.textContent = 'Vous avez déjà testé la démo 3 fois aujourd’hui. Vérifiez votre boîte mail ou écrivez-nous.';
      return;
    }
    var fd = new FormData(gate);
    var who = { nom: fd.get('nom'), entreprise: fd.get('entreprise'), email: fd.get('email'), telephone: fd.get('telephone') };
    store.set('qp_gate', who);
    btn.disabled = true; btn.textContent = 'Envoi…';

    var lead = fetch(gate.action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } }).catch(function () {});
    track('Lead', { content_name: 'demo_signup', role: fd.get('role'), effectif: fd.get('effectif'), site_web: fd.get('site_web') });

    var payload = {
      client_id: DEMO_CLIENT_ID, is_demo: true,
      nom_prospect: who.nom, email_prospect: who.email, telephone_prospect: who.telephone,
      type_meuble: demande.type_meuble, quantite: demande.quantite, problemes: demande.problemes,
      ville: demande.ville, code_postal: demande.code_postal,
      message: 'Démo Quotepilote — ' + who.entreprise + ' (' + who.email + ')',
      entreprise_testeur: who.entreprise, email_testeur: who.email,
      role_testeur: fd.get('role'), effectif_testeur: fd.get('effectif'), site_web_testeur: fd.get('site_web'),
      website: ''
    };
    var send = fetch(DEMO_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return true; })
      .catch(function () { return false; });

    Promise.all([lead, send]).then(function (res) {
      var ok = res[1];
      var a = recent(); a.push(Date.now()); store.set('qp_demo', a);
      gate.hidden = true; result.hidden = false; setStep(3);
      $('res-email').textContent = who.email;
      if (!ok) {
        $('ring-n').textContent = '✓';
        $('res-title').textContent = 'C’est noté, ' + who.nom.split(' ')[0] + '.';
        $('res-text').textContent = 'La démo automatique est momentanément indisponible : on vous envoie ce devis à la main et on vous rappelle aujourd’hui.';
        $('after').hidden = false;
        return;
      }
      track('SubmitApplication', { content_name: 'demo' });
      var n = 90, ring = $('ring'), C = 339.3;
      var t = setInterval(function () {
        n--; $('ring-n').textContent = Math.max(n, 0);
        ring.setAttribute('stroke-dashoffset', (C * (90 - n) / 90).toFixed(1));
        if (n === 60) $('after').hidden = false;
        if (n <= 0) {
          clearInterval(t); $('ring-n').textContent = '✓';
          $('res-title').textContent = 'Votre devis est arrivé.';
          $('res-text').textContent = 'Ouvrez votre boîte mail : c’est exactement ce que recevront vos clients. Rien reçu ? Regardez dans les indésirables.';
        }
      }, 1000);
    }).finally(function () { btn.disabled = false; btn.textContent = 'Recevoir mon devis par email'; });
  });

  /* ---------- Formulaire de rappel (Formspree) ---------- */
  var cf = $('contact-form');
  cf.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('contact-msg'), btn = $('contact-submit');
    if (cf._gotcha.value) return;
    if (!cf.checkValidity()) { cf.reportValidity(); return; }
    btn.disabled = true; msg.className = 'form-msg'; msg.textContent = 'Envoi…';
    fetch(cf.action, { method: 'POST', body: new FormData(cf), headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        msg.className = 'form-msg ok';
        msg.textContent = 'C’est noté. On vous rappelle sous 24 h ouvrées pour lancer votre mois offert.';
        track('Lead', { content_name: 'contact', role: cf.role.value, effectif: cf.effectif.value });
        cf.reset();
      })
      .catch(function () { msg.className = 'form-msg err'; msg.textContent = 'L’envoi n’a pas abouti. Réessayez, ou écrivez à contact@quotepilote.fr.'; })
      .finally(function () { btn.disabled = false; });
  });
})();
