/**
 * Background Service Worker for AIVault
 * Handles autofill functionality and browser events
 */

// Keep track of the unlocked vault state
let isVaultUnlocked = false;
let masterPassword = null;
let passwords = [];
let userSettings = {
  autoFillEnabled: true,
  autoSubmitEnabled: false,
  passwordExpiryDays: 90,
  notifyPasswordExpiry: true,
  neverSaveDomains: [] // Domains where user has chosen "Don't ask again"
};

// Set up context menu for autofill
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'aivault-autofill',
    title: 'Autofill with AIVault',
    contexts: ['editable']
  });
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'aivault-autofill') {
    if (!isVaultUnlocked) {
      // Notify user that vault is locked
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icon128.png',
        title: 'AIVault',
        message: 'Vault is locked. Please unlock it first.',
        priority: 2
      });
      return;
    }
    
    // Try to autofill on the current page
    tryAutofill(tab.id, tab.url, true);
  }
});

// Listen for navigation events to trigger autofill
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0 && isVaultUnlocked && userSettings.autoFillEnabled) {
    // Only run in main frame and if vault is unlocked and autofill is enabled
    tryAutofill(details.tabId, details.url);
  }
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'unlockVault') {
    isVaultUnlocked = true;
    masterPassword = message.masterPassword;
    passwords = message.passwords;
    if (message.settings) {
      userSettings = { ...userSettings, ...message.settings };
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'lockVault') {
    isVaultUnlocked = false;
    masterPassword = null;
    passwords = [];
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updatePasswords') {
    passwords = message.passwords;
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updateSettings') {
    userSettings = { ...userSettings, ...message.settings };
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'getCredentials') {
    if (!isVaultUnlocked) {
      sendResponse({ success: false, error: 'Vault is locked' });
      return true;
    }
    
    const url = message.url;
    const matchingCredentials = findCredentialsForUrl(url);
    sendResponse({ success: true, credentials: matchingCredentials });
    return true;
  }
  
  if (message.action === 'generatePassword') {
    try {
      // Use PasswordGenerator if available (imported in manifest.json)
      const options = message.options || {};
      
      // Create dynamic function to evaluate password generation code
      const generatePasswordFn = new Function(`
        return {
          generatePassword: function(options) {
            const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const lowercase = 'abcdefghijklmnopqrstuvwxyz';
            const numbers = '0123456789';
            const symbols = '!@#$%^&*()_+{}[]|:;"<>,.?/~\`-=';
            
            // Default options
            const config = {
              length: options.length || 16,
              uppercase: options.uppercase !== undefined ? options.uppercase : true,
              lowercase: options.lowercase !== undefined ? options.lowercase : true,
              numbers: options.numbers !== undefined ? options.numbers : true,
              symbols: options.symbols !== undefined ? options.symbols : true
            };
            
            // Ensure at least one character type is selected
            if (!config.uppercase && !config.lowercase && !config.numbers && !config.symbols) {
              config.lowercase = true; // Default to lowercase if nothing selected
            }
            
            // Build character set based on options
            let charSet = '';
            if (config.uppercase) charSet += uppercase;
            if (config.lowercase) charSet += lowercase;
            if (config.numbers) charSet += numbers;
            if (config.symbols) charSet += symbols;
            
            // Generate password
            let password = '';
            const charSetLength = charSet.length;
            
            // Make sure to include at least one character from each selected type
            if (config.uppercase) password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
            if (config.lowercase) password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
            if (config.numbers) password += numbers.charAt(Math.floor(Math.random() * numbers.length));
            if (config.symbols) password += symbols.charAt(Math.floor(Math.random() * symbols.length));
            
            // Fill the rest randomly
            for (let i = password.length; i < config.length; i++) {
              const randomIndex = Math.floor(Math.random() * charSetLength);
              password += charSet.charAt(randomIndex);
            }
            
            // Shuffle the password characters
            return password.split('').sort(() => 0.5 - Math.random()).join('');
          }
        };
      `)();
      
      const password = generatePasswordFn.generatePassword(options);
      
      sendResponse({ success: true, password });
    } catch (error) {
      console.error("Error generating password:", error);
      sendResponse({ success: false, error: error.message });
    }
    
    return true;
  }
  
  if (message.action === 'injectContentScript') {
    // Handle content script injection request from the showCredentialSavePrompt function
    try {
      const tabId = message.tabId;
      if (tabId) {
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['src/js/content.js']
        }).then(() => {
          // After injecting, send the data to the content script
          if (message.data) {
            chrome.tabs.sendMessage(tabId, {
              action: 'checkExistingCredentials',
              ...message.data
            });
          }
        }).catch(err => console.error('AIVault: Error injecting content script:', err));
      }
    } catch (error) {
      console.error('AIVault: Error handling inject content script request:', error);
    }
    return true;
  }
  
  if (message.action === 'checkPasswordExpiry') {
    if (!isVaultUnlocked) {
      sendResponse({ success: false, error: 'Vault is locked' });
      return true;
    }
    
    const expiringPasswords = checkExpiringPasswords();
    sendResponse({ success: true, expiringPasswords });
    return true;
  }
  
  if (message.action === 'loginFormFound' && sender.tab) {
    // Content script found a login form
    if (isVaultUnlocked && userSettings.autoFillEnabled) {
      const tabId = sender.tab.id;
      const url = message.url;
      tryAutofill(tabId, url);
    }
    return true;
  }
  
  if (message.action === 'passwordFieldFocused' && sender.tab) {
    // Content script detected a password field focus
    if (isVaultUnlocked) {
      try {
        // Show the popup badge to indicate autofill is available
        chrome.action.setBadgeText({
          text: '🔑',
          tabId: sender.tab.id
        });
        
        // Reset the badge after 3 seconds
        setTimeout(() => {
          chrome.action.setBadgeText({
            text: '',
            tabId: sender.tab.id
          }).catch(err => console.error("Error clearing badge:", err));
        }, 3000);
      } catch (error) {
        console.error("Error setting badge:", error);
      }
    }
    return true;
  }
  
  if (message.action === 'autofillRequested' && sender.tab) {
    // Handle autofill request from content script
    if (!isVaultUnlocked) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icon128.png',
        title: 'AIVault',
        message: 'Vault is locked. Please unlock it first.',
        priority: 2
      }).catch(err => console.error("Error creating notification:", err));
      return true;
    }
    
    tryAutofill(sender.tab.id, message.url, true);
    return true;
  }
  
  if (message.action === 'showAutofillContextMenu' && sender.tab) {
    // We don't need to do anything here since the context menu is already set up
    return true;
  }
  
  if (message.action === 'getSpecificCredential') {
    // Request for specific credential from the credential picker
    if (!isVaultUnlocked) {
      sendResponse({ success: false, error: 'Vault is locked' });
      return true;
    }
    
    const id = message.id;
    const credential = passwords.find(p => p.id === id);
    
    if (credential) {
      sendResponse({ success: true, credential });
    } else {
      sendResponse({ success: false, error: 'Credential not found' });
    }
    return true;
  }
  
  if (message.action === 'checkCredentialsExist') {
    // Check if credentials already exist for a domain
    if (!isVaultUnlocked) {
      sendResponse({ success: false, error: 'Vault is locked' });
      return true;
    }
    
    const domain = message.domain;
    const username = message.username;
    const password = message.password;
    
    // Skip if domain is in the "never save" list
    if (userSettings.neverSaveDomains && userSettings.neverSaveDomains.includes(domain)) {
      sendResponse({ success: true, shouldSkip: true });
      return true;
    }
    
    // Find credentials for this domain
    const matchingCredentials = findCredentialsForDomain(domain);
    const existingCredential = matchingCredentials.find(cred => cred.username === username);
    
    // Only show prompt if password is different or credentials don't exist
    if (existingCredential && existingCredential.password === password) {
      // Password is the same, no need to update
      sendResponse({ success: true, shouldSkip: true });
      return true;
    }
    
    // Inject the credential save prompt
    try {
      const fromPending = message.fromPending || false;
      
      // Need to check if we have a valid tab to show the prompt in
      if (sender.tab && sender.tab.id) {
        showCredentialSavePrompt(sender.tab.id, domain, username, password, !!existingCredential);
      } else if (fromPending) {
        // This is from a pending credential after navigation, find the tab with the matching domain
        findTabByDomain(domain).then(tabId => {
          if (tabId) {
            showCredentialSavePrompt(tabId, domain, username, password, !!existingCredential);
          }
        });
      }
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error showing credential save prompt:', error);
      sendResponse({ success: false, error: error.message });
    }
    
    return true;
  }
  
  if (message.action === 'saveCredentials') {
    // Save or update credentials
    if (!isVaultUnlocked) {
      sendResponse({ success: false, error: 'Vault is locked' });
      return true;
    }
    
    try {
      const domain = message.domain;
      const username = message.username;
      const password = message.password;
      const exists = message.exists;
      const dontAskAgain = message.dontAskAgain;
      
      // Add domain to "never save" list if requested
      if (dontAskAgain) {
        if (!userSettings.neverSaveDomains) {
          userSettings.neverSaveDomains = [];
        }
        userSettings.neverSaveDomains.push(domain);
        
        // Update settings in app
        chrome.runtime.sendMessage({
          action: 'updateUserSettings',
          settings: userSettings
        });
      }
      
      let updatedCredential = null;
      
      if (exists) {
        // Find the existing credential and update it
        const index = passwords.findIndex(p => 
          isDomainMatch(p.website, domain) && p.username === username
        );
        
        if (index !== -1) {
          passwords[index].password = password;
          passwords[index].lastUpdated = Date.now();
          updatedCredential = passwords[index];
        } else {
          // If the exact credential wasn't found, create a new one
          updatedCredential = {
            website: domain,
            username: username,
            password: password,
            lastUpdated: Date.now()
          };
          passwords.push(updatedCredential);
        }
      } else {
        // Add new credential
        updatedCredential = {
          website: domain,
          username: username,
          password: password,
          lastUpdated: Date.now()
        };
        passwords.push(updatedCredential);
      }
      
      // Update passwords in app - make sure this runs before sending the response
      chrome.runtime.sendMessage({
        action: 'updatePasswords',
        passwords: passwords
      }, function(response) {
        console.log('Updated passwords in main app:', response);
      });
      
      sendResponse({ success: true, updatedCredential });
    } catch (error) {
      console.error('Error saving credentials:', error);
      sendResponse({ success: false, error: error.message });
    }
    
    return true;
  }
});

/**
 * Shows the credential save prompt in a specific tab
 * @param {number} tabId - Tab ID where the prompt should be shown
 * @param {string} domain - Domain of the website
 * @param {string} username - Captured username
 * @param {string} password - Captured password
 * @param {boolean} exists - Whether credentials already exist for this domain
 */
async function showCredentialSavePrompt(tabId, domain, username, password, exists) {
  try {
    console.log('AIVault: Showing credential save prompt for', domain); // Debug log
    
    // Send the credentials to display in the prompt directly
    chrome.tabs.sendMessage(tabId, {
      action: 'checkExistingCredentials',
      domain: domain,
      username: username,
      password: password,
      exists: exists
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('AIVault: Error sending message to content script:', chrome.runtime.lastError);
        
        // If content script not ready, try injecting it
        chrome.scripting.executeScript({
          target: { tabId },
          function: () => {
            // Check if our handler already exists
            if (typeof showSavePrompt !== 'function') {
              // The content script needs to be injected
              chrome.runtime.sendMessage({
                action: 'injectContentScript',
                tabId: tabId,
                data: {
                  domain: domain,
                  username: username,
                  password: password,
                  exists: exists
                }
              });
            }
          }
        }).catch(err => console.error('AIVault: Error checking for content script:', err));
      } else {
        console.log('AIVault: Credential prompt response', response);
        
        // If there was an error showing the prompt, log it
        if (!response || !response.success) {
          console.error('AIVault: Error showing credential prompt');
        }
      }
    });
  } catch (error) {
    console.error('AIVault: Error showing credential save prompt:', error);
  }
}

/**
 * Function to be injected into the page to prepare for credential save prompt
 * This is a placeholder that does nothing because the actual functionality is in content.js
 */
function injectCredentialSavePrompt() {
  // The actual prompt UI is already defined in content.js, this is just a hook
  // to ensure the script is loaded before attempting to show the prompt
}

/**
 * Find a tab that matches a specific domain
 * @param {string} domain - Domain to look for
 * @returns {Promise<number|null>} - Tab ID or null if no matching tab found
 */
async function findTabByDomain(domain) {
  try {
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      try {
        const tabDomain = new URL(tab.url).hostname;
        if (tabDomain.includes(domain) || domain.includes(tabDomain)) {
          return tab.id;
        }
      } catch (e) {
        // Skip tabs with invalid URLs
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding tab by domain:', error);
    return null;
  }
}

/**
 * Finds credentials for a specific domain
 * @param {string} domain - Domain to search for
 * @returns {Array} - Array of matching credentials
 */
function findCredentialsForDomain(domain) {
  if (!passwords.length) return [];
  
  return passwords.filter(entry => isDomainMatch(entry.website, domain));
}

/**
 * Checks if two domains match for credential purposes
 * @param {string} savedDomain - Domain from saved credential
 * @param {string} currentDomain - Current page domain
 * @returns {boolean} - True if domains match
 */
function isDomainMatch(savedDomain, currentDomain) {
  if (!savedDomain || !currentDomain) return false;
  
  // Normalize domains
  savedDomain = savedDomain.toLowerCase();
  currentDomain = currentDomain.toLowerCase();
  
  // Direct match
  if (savedDomain === currentDomain) return true;
  
  // Check if one contains the other
  if (savedDomain.includes(currentDomain) || currentDomain.includes(savedDomain)) return true;
  
  // Check domain parts
  const savedParts = savedDomain.split('.');
  const currentParts = currentDomain.split('.');
  
  // Compare domain parts (e.g., "example.com" should match "sub.example.com")
  if (savedParts.length >= 2 && currentParts.length >= 2) {
    const savedMainDomain = savedParts.slice(-2).join('.');
    const currentMainDomain = currentParts.slice(-2).join('.');
    
    return savedMainDomain === currentMainDomain;
  }
  
  return false;
}

/**
 * Attempts to autofill credentials on the current page
 * @param {number} tabId - ID of the current tab
 * @param {string} url - Current URL
 * @param {boolean} showUI - Whether to show a credential selector UI if multiple matches found
 */
async function tryAutofill(tabId, url, showUI = false) {
  if (!isVaultUnlocked || !passwords.length) return;
  
  const matchingCredentials = findCredentialsForUrl(url);
  
  if (matchingCredentials.length === 0) {
    return;
  }
  
  if (matchingCredentials.length === 1 || !showUI) {
    // If only one credential or UI not requested, use the first match
    const credential = matchingCredentials[0];
    
    // Send message to content script to fill the form
    chrome.tabs.sendMessage(tabId, {
      action: 'fillCredentials',
      credentials: {
        username: credential.username,
        password: credential.password,
        autoSubmit: userSettings.autoSubmitEnabled
      }
    });
  } else {
    // Multiple credentials found and UI requested, show a credential picker
    // First, inject the credential picker script if not already present
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/js/credentialPicker.js']
      });
      
      // Then send the credentials to the picker
      chrome.tabs.sendMessage(tabId, {
        action: 'showCredentialPicker',
        credentials: matchingCredentials.map(c => ({
          id: c.id,
          username: c.username,
          website: c.website
        })),
        autoSubmit: userSettings.autoSubmitEnabled
      });
    } catch (error) {
      console.error('Failed to inject credential picker:', error);
      
      // Fallback: use the first credential
      const credential = matchingCredentials[0];
      chrome.tabs.sendMessage(tabId, {
        action: 'fillCredentials',
        credentials: {
          username: credential.username,
          password: credential.password,
          autoSubmit: userSettings.autoSubmitEnabled
        }
      });
    }
  }
}

/**
 * Finds matching credentials for the given URL
 * @param {string} url - Current URL
 * @returns {Array} - Array of matching credentials
 */
function findCredentialsForUrl(url) {
  if (!passwords.length) return [];
  
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Filter and ensure each password has an ID
    return passwords.filter(entry => {
      try {
        // Ensure credential has an ID (use website+username hash if no ID exists)
        if (!entry.id) {
          entry.id = `${entry.website}-${entry.username}`.replace(/[^a-z0-9]/gi, '-');
        }
        
        // Check if the website field contains the hostname
        // or if the hostname contains the website field
        const website = (entry.website || '').toLowerCase();
        
        // Generate domain variations for more accurate matching
        const domainParts = hostname.split('.');
        const possibleDomains = [];
        
        for (let i = 0; i < domainParts.length - 1; i++) {
          possibleDomains.push(domainParts.slice(i).join('.'));
        }
        
        return possibleDomains.some(domain => 
          website.includes(domain) || domain.includes(website)
        );
      } catch (e) {
        return false;
      }
    });
  } catch (error) {
    console.error('Error parsing URL:', error);
    return [];
  }
}

/**
 * This function is injected into the page to autofill credentials
 * @param {Array} credentials - Array of credentials to autofill
 */
function injectAutofill(credentials) {
  if (!credentials || !credentials.length) return;
  
  // If multiple credentials match, use the first one for now
  // In a more advanced implementation, we would show a dropdown to choose
  const credential = credentials[0];
  
  // Find username/email fields
  const usernameSelectors = [
    'input[type="email"]',
    'input[type="text"][name*="email"]',
    'input[type="text"][name*="user"]',
    'input[type="text"][id*="email"]',
    'input[type="text"][id*="user"]',
    'input[type="text"][autocomplete="username"]',
    'input[type="text"]'
  ];
  
  // Find password fields
  const passwordSelectors = [
    'input[type="password"]'
  ];
  
  // Try to find and fill username field
  for (const selector of usernameSelectors) {
    const usernameFields = document.querySelectorAll(selector);
    if (usernameFields.length > 0) {
      // Fill the first one we find
      for (const field of usernameFields) {
        if (isVisible(field) && !isReadOnly(field)) {
          field.value = credential.username;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
      break;
    }
  }
  
  // Try to find and fill password field
  for (const selector of passwordSelectors) {
    const passwordFields = document.querySelectorAll(selector);
    if (passwordFields.length > 0) {
      // Fill the first one we find
      for (const field of passwordFields) {
        if (isVisible(field) && !isReadOnly(field)) {
          field.value = credential.password;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
      break;
    }
  }
  
  // Helper function to check if an element is visible
  function isVisible(element) {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  }
  
  // Helper function to check if an element is read-only
  function isReadOnly(element) {
    return element.readOnly || element.disabled;
  }
}

/**
 * Checks for passwords that are expiring soon
 * @returns {Array} - Array of passwords expiring in the next X days
 */
function checkExpiringPasswords() {
  if (!passwords.length) return [];
  
  const now = Date.now();
  const notificationThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  const expiryThreshold = userSettings.passwordExpiryDays * 24 * 60 * 60 * 1000;
  
  return passwords.filter(entry => {
    // Check if lastUpdated exists and is within expiry threshold
    if (entry.lastUpdated) {
      const passwordAge = now - entry.lastUpdated;
      const daysUntilExpiry = Math.ceil((expiryThreshold - passwordAge) / (24 * 60 * 60 * 1000));
      
      // Return true if password will expire in the next notification threshold
      return passwordAge + notificationThreshold >= expiryThreshold && daysUntilExpiry > 0;
    }
    return false;
  }).map(entry => ({
    ...entry,
    daysUntilExpiry: Math.ceil((expiryThreshold - (now - entry.lastUpdated)) / (24 * 60 * 60 * 1000))
  }));
}

// Show notification for expiring passwords (once per day)
chrome.alarms.create('checkPasswordExpiry', { periodInMinutes: 1440 }); // 24 hours

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkPasswordExpiry' && isVaultUnlocked && userSettings.notifyPasswordExpiry) {
    const expiringPasswords = checkExpiringPasswords();
    
    if (expiringPasswords.length > 0) {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/assets/icon128.png',
          title: 'Password Expiry Warning',
          message: `${expiringPasswords.length} password(s) will expire soon. Click to review.`,
          priority: 2
        });
      } catch (error) {
        console.error('Error creating notification:', error);
      }
    }
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  // Open the extension popup to show expiring passwords
  chrome.action.openPopup();
});

// Create a QR code for password sharing
async function createQRCode(data) {
  try {
    // In a service worker, we can't directly manipulate the DOM or canvas
    // Instead, we'll send a message to the popup to generate the QR code
    
    // Create a data URL for the QR code (simplified for now)
    // In a real implementation, we would use QRCode.js library dynamically
    // For now, we'll return a placeholder that the popup can handle
    
    return { 
      success: true, 
      data: {
        text: data,
        timestamp: Date.now()
      }
    };
  } catch (error) {
    console.error('QR code generation error:', error);
    return { success: false, error: error.message };
  }
}