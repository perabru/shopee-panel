/* Web-first installation and opt-in updates. No login is required to install. */
(() => {
  'use strict';
  const baseUrl = new URL('.', document.currentScript?.src || location.href.split('#')[0]);
  const displayMode = window.matchMedia('(display-mode: standalone)');
  let installPrompt = null;
  let installed = displayMode.matches || navigator.standalone === true;
  let waitingWorker = null;
  let reloadAfterUpdate = false;
  let registration = null;

  function syncInstallButtons() {
    document.querySelectorAll('[data-action="install-app"]').forEach(button => {
      button.hidden = installed;
      button.setAttribute('aria-label','Instalar Vitrine Livre no dispositivo');
    });
  }
  function closeDialog(dialog, previousFocus) {
    if (typeof dialog.close === 'function') dialog.close();
    dialog.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  function showDialog(title, paragraphs, action) {
    document.querySelector('[data-pwa-dialog]')?.remove();
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.dataset.pwaDialog = '';
    dialog.className = 'pwa-dialog';
    dialog.setAttribute('aria-labelledby','pwa-dialog-title');
    const heading = document.createElement('h2');
    heading.id = 'pwa-dialog-title';
    heading.textContent = title;
    dialog.append(heading);
    for (const text of paragraphs) {
      const p = document.createElement('p');
      p.textContent = text;
      dialog.append(p);
    }
    const actions = document.createElement('div');
    actions.className = 'pwa-dialog-actions';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-white';
    close.textContent = action ? 'Agora não' : 'Entendi';
    close.addEventListener('click',()=>closeDialog(dialog,previousFocus));
    actions.append(close);
    if (action) {
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = 'btn btn-orange';
      confirm.textContent = action.label;
      confirm.addEventListener('click',()=>{closeDialog(dialog,previousFocus);action.run();});
      actions.append(confirm);
    }
    dialog.append(actions);
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog,previousFocus);});
    document.body.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open',''); dialog.setAttribute('role','dialog'); }
    close.focus();
  }
  function installationInstructions() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isIOS) showDialog('Adicionar ao iPhone ou iPad',[
      'Abra esta página no Safari.',
      'Toque em Compartilhar (no menu da página, se necessário) e escolha “Adicionar à Tela de Início”.',
      'Se aparecer “Abrir como App da Web”, ative essa opção. Depois toque em “Adicionar”.',
      'Você também pode continuar usando o site normalmente. Produtos, login e publicação precisam de internet.'
    ]);
    else if (isAndroid) showDialog('Instalar no Android',[
      'No Chrome, abra o menu de três pontos e procure “Instalar app” ou “Adicionar à tela inicial”.',
      'Se a opção ainda não aparecer, mantenha esta página aberta por alguns instantes e tente novamente. Alguns navegadores e dispositivos não oferecem instalação.',
      'O site funciona no navegador mesmo sem instalar. Produtos, login e publicação precisam de internet.'
    ]);
    else showDialog('Instalar Vitrine Livre',[
      'No Chrome ou Edge, procure o ícone de instalação na barra de endereço ou a opção “Instalar” no menu do navegador.',
      'No celular, você pode adicionar o site à tela inicial. A instalação depende do navegador e continua sendo opcional.',
      'Produtos, login e publicação precisam de internet.'
    ]);
  }
  async function installApp() {
    if (installed) return;
    if (!installPrompt) { installationInstructions(); return; }
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      await prompt.userChoice;
      // appinstalled is the authoritative success signal. Acceptance alone is not installation.
    } catch { installationInstructions(); }
  }
  function offerUpdate(worker) {
    waitingWorker = worker;
    if (!worker || document.getElementById('pwa-update-notice')) return;
    const notice = document.createElement('aside');
    notice.id = 'pwa-update-notice';
    notice.className = 'pwa-update-notice';
    notice.setAttribute('aria-label','Atualização do aplicativo');
    const text = document.createElement('span');
    text.textContent = 'Uma nova versão está disponível.';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-orange btn-sm';
    button.textContent = 'Atualizar';
    button.addEventListener('click',()=>showDialog('Atualizar o aplicativo',[
      'A página será recarregada. Finalize e salve qualquer alteração antes de continuar.',
      'Os produtos já publicados e os dados da sua conta serão mantidos.'
    ],{label:'Atualizar e recarregar',run:()=>{
      if (!waitingWorker) return;
      reloadAfterUpdate = true;
      waitingWorker.postMessage({type:'SKIP_WAITING'});
      notice.remove();
    }}));
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'pwa-dismiss';
    dismiss.setAttribute('aria-label','Lembrar da atualização depois');
    dismiss.textContent = '×';
    dismiss.addEventListener('click',()=>notice.remove());
    notice.append(text,button,dismiss);
    document.body.append(notice);
  }
  async function registerWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    try {
      registration = await navigator.serviceWorker.register(new URL('sw.js',baseUrl).href,{scope:baseUrl.pathname,updateViaCache:'none'});
      if (registration.waiting) offerUpdate(registration.waiting);
      registration.addEventListener('updatefound',()=>{
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange',()=>{
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(registration.waiting || worker);
        });
      });
    } catch (error) { console.info('Instalação do app indisponível; o site continua funcionando.',error); }
  }
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    installPrompt = event;
    syncInstallButtons();
  });
  window.addEventListener('appinstalled',()=>{
    installed = true;
    installPrompt = null;
    syncInstallButtons();
  });
  displayMode.addEventListener?.('change',event=>{
    installed = event.matches || navigator.standalone === true;
    syncInstallButtons();
  });
  document.addEventListener('click',event=>{
    if (!event.target.closest?.('[data-action="install-app"]')) return;
    event.preventDefault();
    installApp();
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange',()=>{
    // Another tab may activate a worker: never reload this page without its own explicit choice.
    if (!reloadAfterUpdate) return;
    reloadAfterUpdate = false;
    location.reload();
  });
  function init() {
    const style = document.createElement('style');
    style.textContent = '.pwa-dialog{border:0;border-radius:22px;padding:28px;max-width:min(520px,calc(100vw - 32px));color:#202735;background:#fff;box-shadow:0 24px 90px #0003}.pwa-dialog::backdrop{background:#15203680}.pwa-dialog h2{font-size:1.4rem;margin:0 0 16px}.pwa-dialog p{font-size:1rem;line-height:1.6;margin:12px 0}.pwa-dialog-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;margin-top:24px}.pwa-update-notice{position:fixed;z-index:1500;right:16px;bottom:calc(80px + env(safe-area-inset-bottom));max-width:calc(100vw - 32px);padding:14px;display:flex;align-items:center;gap:12px;border:1px solid #dfe4ed;border-radius:16px;background:#fff;color:#202735;box-shadow:0 10px 40px #0002;font-size:1rem}.pwa-dismiss{border:0;background:transparent;color:#5d687b;font-size:24px;min-width:36px;min-height:40px;cursor:pointer}.pwa-install-link{font:inherit;color:inherit;background:none;border:0;padding:0;text-align:left;cursor:pointer;text-decoration:underline;text-underline-offset:4px;min-height:44px}[data-action="install-app"][hidden]{display:none!important}';
    document.head.append(style);
    if (!document.querySelector('[data-action="install-app"]')) {
      const footer = document.querySelector('.footer-links');
      if (footer) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pwa-install-link';
        button.dataset.action = 'install-app';
        button.textContent = 'Instalar app';
        footer.append(button);
      }
    }
    syncInstallButtons();
    registerWorker();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  // Recheck when a user returns to the app; no background timer and no automatic reload.
  document.addEventListener('visibilitychange',()=>{
    if (document.visibilityState === 'visible' && registration && navigator.onLine) {
      if (registration.waiting) offerUpdate(registration.waiting);
      registration.update().catch(()=>{});
    }
  });
})();
