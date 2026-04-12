(function () {
  if (window.PaymobSdkLoaded) {
    return;
  }

  window.PaymobSdkLoaded = true;

  if (!window.Paymob) {
    var script = document.createElement('script');
    script.src = 'https://js.paymob.com/v1/paymob.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }
})();
