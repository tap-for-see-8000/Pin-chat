import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Network } from '@capacitor/network';

export const initAndroidFeatures = async () => {
  // Only execute if running in a Capacitor native context
  const isNative = document.URL.includes('http://capacitor') || document.URL.includes('capacitor://');
  if (!isNative) return;

  try {
    // 1. Configure Status Bar
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#000000' });
    
    // 2. Hide Splash Screen after App is ready
    await SplashScreen.hide();

    // 3. Handle Android Back Button to prevent accidental app exits
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        // If at the root, prompt before exit or just minimize
        App.minimizeApp();
      }
    });

    // 4. Handle Offline Mode
    Network.addListener('networkStatusChange', status => {
      console.log('Network status changed', status);
      if (!status.connected) {
        // Dispatch custom event that React components can listen to
        window.dispatchEvent(new CustomEvent('app-offline-status', { detail: { isOffline: true } }));
      } else {
        window.dispatchEvent(new CustomEvent('app-offline-status', { detail: { isOffline: false } }));
      }
    });

  } catch (e) {
    console.error('Failed to initialize Android features', e);
  }
};
