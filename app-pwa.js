'use strict';

const installButton = document.getElementById('pwaInstallButton');
const installStatus = document.getElementById('pwaInstallStatus');
let installPrompt = null;

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(registration => registration.update())
      .catch(error => {
        console.error('PWA service worker registration failed:', error);
        if (installStatus) installStatus.textContent = 'Programu haikuweza kuwekwa tayari kwa matumizi bila intaneti.';
      });
  });
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  if (installButton) installButton.hidden = false;
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  if (installButton) installButton.hidden = true;
  if (installStatus) installStatus.textContent = 'Mchezo Wetu imeongezwa kwenye kifaa hiki.';
});

if (installButton) {
  installButton.addEventListener('click', async () => {
    if (!installPrompt) {
      if (installStatus) {
        installStatus.textContent = /iPhone|iPad|iPod/i.test(navigator.userAgent)
          ? 'Kwenye Safari, gusa Share kisha chagua Add to Home Screen.'
          : 'Tumia menyu ya kivinjari kisha chagua Install app au Add to Home Screen.';
      }
      return;
    }

    installButton.disabled = true;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (installStatus) {
        installStatus.textContent = choice.outcome === 'accepted'
          ? 'Mchezo Wetu inaongezwa kwenye kifaa hiki.'
          : 'Usakinishaji haujakamilika. Unaweza kujaribu tena baadaye.';
      }
      installPrompt = null;
      installButton.hidden = true;
    } catch (error) {
      console.error('PWA install prompt failed:', error);
      if (installStatus) installStatus.textContent = 'Imeshindikana kuanzisha usakinishaji. Jaribu tena kupitia menyu ya kivinjari.';
    } finally {
      installButton.disabled = false;
    }
  });
}
