/* Medición con Google Analytics 4. Solo se activa si config.js trae un ID de medición (G-XXXXXXXXXX) o una etiqueta de Google (GTM-XXXXXXX). */
(function () {
  "use strict";
  var id = (window.PPS_CONFIG || {}).gaId;
  if (!id || !/^(G|GTM)-[A-Z0-9]+$/.test(id)) return;
  var isTag = id.indexOf("GTM-") === 0;
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/" + (isTag ? "gtm.js" : "gtag/js") + "?id=" + encodeURIComponent(id);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  if (!isTag) gtag("config", id);

  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("a, button") : null;
    if (!el) return;
    var href = el.getAttribute("href") || "";
    if (href === "#agenda") gtag("event", "clic_agendar_reunion");
    else if (el.id === "chat-fab" || el.id === "faq-chat") gtag("event", "abrir_asistente");
    else if (el.id === "send-mail") gtag("event", "enviar_solicitud_correo");
    else if (href.indexOf("mailto:") === 0) gtag("event", "clic_correo");
    else if (href.indexOf("wa.me") > -1) gtag("event", "clic_whatsapp");
  }, true);
  document.addEventListener("submit", function (e) {
    if (e.target && e.target.id === "chat-form") gtag("event", "pregunta_asistente");
    else gtag("event", "generate_lead", { metodo: "formulario_reunion" });
  }, true);
})();
