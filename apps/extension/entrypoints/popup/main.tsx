import { ClerkProvider } from '@clerk/chrome-extension';
import React from 'react';
import { createRoot } from 'react-dom/client';

import { getExtensionConfig } from '../../src/config';
import { CapturePopup } from '../../src/popup/capture-popup';
import './style.css';

const config = getExtensionConfig();
const root = document.getElementById('root');
if (!root) throw new Error('Wip extension root was not found.');
const popupUrl = chrome.runtime.getURL('/popup.html');

createRoot(root).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={config.clerkPublishableKey}
      standardBrowser={false}
      afterSignOutUrl={popupUrl}
      signInFallbackRedirectUrl={popupUrl}
      signUpFallbackRedirectUrl={popupUrl}
    >
      <CapturePopup config={config} />
    </ClerkProvider>
  </React.StrictMode>,
);
