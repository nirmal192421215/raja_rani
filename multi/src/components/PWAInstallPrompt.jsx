import { useState, useEffect } from 'react';
import './PWAInstallPrompt.css';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Don't show if they've dismissed it recently
      if (!localStorage.getItem('pwa-dismissed')) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="pwa-prompt glass-card">
      <div className="pwa-prompt-icon">
        <img src="/icon-192x192.png" alt="App Icon" />
      </div>
      <div className="pwa-prompt-info">
        <h4>Install Raja Rani</h4>
        <p>Add to home screen for the best experience!</p>
      </div>
      <div className="pwa-prompt-actions">
        <button className="btn btn--gold" onClick={handleInstall}>Install</button>
        <button className="pwa-dismiss" onClick={handleDismiss}>✕</button>
      </div>
    </div>
  );
}
