// Ensure all scripts are loaded properly and initialize the app
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM content loaded, initializing AIVault...');
  
  // Track script loading
  const scriptsLoaded = {
    encryption: typeof EncryptionModule !== 'undefined',
    storage: typeof StorageModule !== 'undefined',
    passwordGenerator: typeof PasswordGenerator !== 'undefined',
    passwordSharing: typeof PasswordSharingModule !== 'undefined',
    totp: typeof TOTPModule !== 'undefined',
    aiAssistant: typeof AIAssistant !== 'undefined',
    ui: typeof UIModule !== 'undefined',
    app: typeof App !== 'undefined'
  };
  
  // Check if all required modules are loaded
  const missingModules = Object.entries(scriptsLoaded)
    .filter(([_, loaded]) => !loaded)
    .map(([name, _]) => name);
  
  if (missingModules.length > 0) {
    console.error('Failed to load required modules:', missingModules.join(', '));
    console.error('Scripts loaded status:', scriptsLoaded);
    alert('Some components failed to load: ' + missingModules.join(', ') + '. Please reload the extension.');
    return;
  }
  
  console.log('All modules loaded successfully');
  
  try {
    // Add additional event listeners for modals
    const closeButtons = document.querySelectorAll('.close-modal, .close-totp-modal, .close-share-modal, .close-import-modal');
    console.log('Found close buttons:', closeButtons.length);
    
    closeButtons.forEach(btn => {
      const modalClass = btn.className.replace('close-', '').replace('-modal', '');
      const modalId = modalClass + 'Modal';
      console.log('Setting up close handler for:', modalId);
      
      btn.addEventListener('click', function() {
        const modal = document.getElementById(modalId);
        if (modal) {
          modal.classList.add('hidden');
          console.log('Closed modal:', modalId);
        } else {
          console.error('Could not find modal element:', modalId);
        }
      });
    });
    
    // Add specific handler for import modal
    const importCloseBtn = document.querySelector('.close-import-modal');
    if (importCloseBtn) {
      importCloseBtn.addEventListener('click', function() {
        const importModal = document.getElementById('importModal');
        if (importModal) {
          importModal.classList.add('hidden');
          console.log('Closed import modal via specific handler');
        }
      });
    } else {
      console.warn('Import close button not found');
    }
    
    // Close modals when clicking outside
    const modals = document.querySelectorAll('.modal');
    console.log('Found modals:', modals.length);
    
    modals.forEach(modal => {
      modal.addEventListener('click', function(event) {
        if (event.target === modal) {
          modal.classList.add('hidden');
          console.log('Closed modal by clicking outside');
        }
      });
    });
    
    // Initialize auto-lock timer
    let inactivityTimer;
    const resetInactivityTimer = function() {
      clearTimeout(inactivityTimer);
      
      // Check if app is initialized and vault is unlocked
      if (window.app && window.app.isVaultUnlocked) {
        const settings = StorageModule.getSettings() || {};
        const autoLockMinutes = settings.autoLockMinutes || 5; // Default to 5 minutes
        
        inactivityTimer = setTimeout(() => {
          if (window.app && window.app.isVaultUnlocked) {
            window.app.lockVault();
            console.log('Auto-locked vault due to inactivity');
          }
        }, autoLockMinutes * 60 * 1000);
      }
    };
    
    // Reset timer on user interaction
    ['click', 'keydown', 'mousemove'].forEach(event => {
      document.addEventListener(event, resetInactivityTimer);
    });
    
    // Start the timer initially
    resetInactivityTimer();
    
    console.log('AIVault initialization complete');
  } catch (error) {
    console.error('Error during initialization:', error);
    alert('Initialization error: ' + error.message);
  }
});