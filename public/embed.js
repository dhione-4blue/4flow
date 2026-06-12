/* =====================================================================
   4Flow — Script de embed de formulários (estilo ActiveCampaign)
   Uso na página externa:
     <div data-4flow-form="ID_DO_FORMULARIO"></div>
     <script src="https://SEU_DOMINIO/embed.js" async></script>
   O script injeta um iframe responsivo e ajusta a altura
   automaticamente conforme o conteúdo do formulário.
   ===================================================================== */
(function () {
  'use strict';

  // Detecta a origem do próprio script para montar a URL do app
  var scripts = document.querySelectorAll('script[src*="embed.js"]');
  var origem = '';
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].getAttribute('src');
    if (src && src.indexOf('embed.js') !== -1) {
      var a = document.createElement('a');
      a.href = src;
      origem = a.protocol + '//' + a.host;
      break;
    }
  }
  if (!origem) origem = window.location.origin;

  function montar() {
    var alvos = document.querySelectorAll('[data-4flow-form]:not([data-4flow-pronto])');
    for (var i = 0; i < alvos.length; i++) {
      var el = alvos[i];
      var formId = el.getAttribute('data-4flow-form');
      if (!formId) continue;
      el.setAttribute('data-4flow-pronto', '1');

      var iframe = document.createElement('iframe');
      iframe.src = origem + '/#/f/' + formId;
      iframe.id = '_4flow-form-' + formId;
      iframe.title = 'Formulário 4Flow';
      iframe.setAttribute('allow', 'camera; microphone');
      iframe.style.width = '100%';
      iframe.style.border = 'none';
      iframe.style.minHeight = '560px';
      iframe.style.display = 'block';
      el.appendChild(iframe);
    }
  }

  // Ajuste automático de altura via postMessage enviado pelo formulário
  window.addEventListener('message', function (e) {
    if (!e.data || !e.data._4flowHeight || !e.data.formId) return;
    var iframe = document.getElementById('_4flow-form-' + e.data.formId);
    if (iframe) iframe.style.height = e.data._4flowHeight + 'px';
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }
})();
