/**
 * Main App for AIVault
 * Coordinates all functionality of the password vault and AI assistant
 */

class App {
  constructor() {
    // Password vault data
    this.passwords = [];
    this.masterPassword = null;
    this.isVaultUnlocked = false;
    
    // TOTP data
    this.totpSecrets = [];
    
    // Shared passwords
    this.sharedPasswords = [];
    
    // Currently selected password (for sharing)
    this.selectedPassword = null;
    
    // Initialize AI Assistant
    this.aiAssistant = new AIAssistant();
    
    // TOTP timer reference
    this.totpTimer = null;
  }
  
  /**
   * Initializes the app
   */
  async initialize() {
    // Initialize UI
    UIModule.initialize();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Check if vault exists
    if (StorageModule.vaultExists()) {
      UIModule.showScreen('loginScreen');
    } else {
      UIModule.showScreen('setupAccountScreen');
    }
    
    // Preload AI model
    this.aiAssistant.initModel();
  }
  
  /**
   * Sets up event listeners for the app
   */
  setupEventListeners() {
    // Account setup events
    document.getElementById('createAccountBtn').addEventListener('click', () => this.createVault());
    document.getElementById('unlockBtn').addEventListener('click', () => this.unlockVault());
    document.getElementById('logoutBtn').addEventListener('click', () => this.lockVault());
    
    // Navigation between login/setup screens
    document.getElementById('setupAccountLink').addEventListener('click', (e) => {
      e.preventDefault();
      UIModule.showScreen('setupAccountScreen');
    });
    
    document.getElementById('backToLoginLink').addEventListener('click', (e) => {
      e.preventDefault();
      UIModule.showScreen('loginScreen');
    });
    
    // Password management events
    document.getElementById('savePasswordBtn').addEventListener('click', () => this.savePassword());
    document.addEventListener('deletePassword', (e) => this.deletePassword(e.detail.index));
    
    // AI Assistant events
    document.getElementById('aiSendBtn').addEventListener('click', () => this.sendAIPrompt());
    document.getElementById('aiPrompt').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendAIPrompt();
      }
    });
    
    // Quick action buttons
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.dataset.prompt;
        document.getElementById('aiPrompt').value = prompt;
        this.sendAIPrompt();
      });
    });
    
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.add('hidden');
        });
        
        // Show the corresponding tab content
        const tabId = btn.id.replace('Btn', '');
        document.getElementById(tabId).classList.remove('hidden');
        
        // Special handling for TOTP tab
        if (tabId === 'totpTab' && this.isVaultUnlocked) {
          this.renderTOTPCodes();
          this.startTOTPTimer();
        }
      });
    });
    
    // TOTP events
    document.getElementById('addTOTPBtn').addEventListener('click', () => this.showTOTPModal());
    document.getElementById('saveTOTPBtn').addEventListener('click', () => this.saveTOTP());
    document.querySelector('.close-totp-modal').addEventListener('click', () => {
      document.getElementById('totpModal').classList.add('hidden');
    });
    
    // TOTP tab switching
    document.querySelectorAll('.totp-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active class from all tab buttons
        document.querySelectorAll('.totp-tab-btn').forEach(b => b.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Hide all tab content
        document.querySelectorAll('.totp-tab-content').forEach(content => {
          content.classList.add('hidden');
        });
        
        // Show the corresponding tab content
        const tabId = btn.dataset.tab + 'Tab';
        document.getElementById(tabId).classList.remove('hidden');
      });
    });
    
    // Password sharing events
    document.getElementById('sharePasswordBtn').addEventListener('click', () => this.showShareModal());
    document.getElementById('generateShareBtn').addEventListener('click', () => this.generateShare());
    document.getElementById('cancelShareBtn').addEventListener('click', () => {
      document.getElementById('shareModal').classList.add('hidden');
    });
    document.querySelector('.close-share-modal').addEventListener('click', () => {
      document.getElementById('shareModal').classList.add('hidden');
    });
    
    // Share tab switching
    document.querySelectorAll('.share-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active class from all tab buttons
        document.querySelectorAll('.share-tab-btn').forEach(b => b.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Hide all tab content
        document.querySelectorAll('.share-tab-content').forEach(content => {
          content.classList.add('hidden');
        });
        
        // Show the corresponding tab content
        const tabId = btn.dataset.tab + 'Tab';
        document.getElementById(tabId).classList.remove('hidden');
      });
    });
    
    // Copy share link button
    document.getElementById('copyShareLinkBtn').addEventListener('click', () => {
      const linkInput = document.getElementById('generatedShareLink');
      linkInput.select();
      document.execCommand('copy');
      
      const copyBtn = document.getElementById('copyShareLinkBtn');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    });
    
    // Settings events
    document.getElementById('exportDataBtn').addEventListener('click', () => this.exportVaultData());
    document.getElementById('importDataBtn').addEventListener('click', () => this.showImportModal());
    document.getElementById('resetVaultBtn').addEventListener('click', () => this.resetVault());
    
    // Save settings
    document.querySelectorAll('#settingsTab input').forEach(input => {
      input.addEventListener('change', () => this.saveSettings());
    });
    
    // Handle import button
    document.getElementById('importShareBtn').addEventListener('click', () => this.importSharedPassword());
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'updatePasswords' && this.isVaultUnlocked) {
        // Update passwords from background script
        console.log('Received updatePasswords message with', message.passwords.length, 'passwords');
        
        // Only update if we actually have passwords
        if (message.passwords && message.passwords.length > 0) {
          this.passwords = message.passwords;
          
          // Save to encrypted storage
          this.saveVaultData();
          
          // Update UI
          UIModule.renderPasswordList(this.passwords);
        }
        
        sendResponse({ success: true });
        return true;
      }
      
      if (message.action === 'updateUserSettings' && this.isVaultUnlocked) {
        // Update user settings
        const settings = StorageModule.getSettings() || {};
        const newSettings = { ...settings, ...message.settings };
        StorageModule.saveSettings(newSettings);
        sendResponse({ success: true });
        return true;
      }
    });
  }
  
  /**
   * Creates a new vault with master password
   */
  async createVault() {
    const newPassword = document.getElementById('newMasterPassword').value;
    const confirmPassword = document.getElementById('confirmMasterPassword').value;
    
    if (!newPassword) {
      UIModule.showMessage('Please enter a master password.', 'error', 'setupMessage');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      UIModule.showMessage('Passwords do not match.', 'error', 'setupMessage');
      return;
    }
    
    const strength = PasswordGenerator.evaluateStrength(newPassword);
    if (strength.score < 50) {
      UIModule.showMessage('Please use a stronger master password.', 'error', 'setupMessage');
      return;
    }
    
    try {
      // Create verification string
      const verificationString = await EncryptionModule.createVerificationString(newPassword);
      StorageModule.saveVerificationString(verificationString);
      
      // Derive master key for encryption
      const masterKey = await EncryptionModule.deriveMasterKey(newPassword);
      
      // Create empty vault
      const emptyVault = JSON.stringify([]);
      const encryptedVault = await EncryptionModule.encrypt(emptyVault, masterKey);
      StorageModule.saveVaultData(encryptedVault);
      
      // Create empty TOTP vault
      const emptyTOTP = JSON.stringify([]);
      const encryptedTOTP = await EncryptionModule.encrypt(emptyTOTP, masterKey);
      StorageModule.saveTOTPSecrets(encryptedTOTP);
      
      // Create empty shared passwords vault
      const emptyShared = JSON.stringify([]);
      const encryptedShared = await EncryptionModule.encrypt(emptyShared, masterKey);
      StorageModule.saveSharedPasswords(encryptedShared);
      
      // Show success message
      UIModule.showMessage('Vault created successfully!', 'success', 'setupMessage');
      
      // Switch to login screen
      setTimeout(() => {
        document.getElementById('newMasterPassword').value = '';
        document.getElementById('confirmMasterPassword').value = '';
        UIModule.showScreen('loginScreen');
      }, 1500);
    } catch (error) {
      console.error('Error creating vault:', error);
      UIModule.showMessage('Error creating vault: ' + error.message, 'error', 'setupMessage');
    }
  }
  
  /**
   * Unlocks the vault with master password
   */
  async unlockVault() {
    const password = document.getElementById('masterPassword').value;
    
    if (!password) {
      UIModule.showMessage('Please enter your master password.', 'error');
      return;
    }
    
    try {
      // Verify master password
      const verificationString = StorageModule.getVerificationString();
      const isValid = await EncryptionModule.verifyMasterPassword(password, verificationString);
      
      if (!isValid) {
        UIModule.showMessage('Incorrect master password.', 'error');
        return;
      }
      
      // Derive the master key for decryption
      const masterKey = await EncryptionModule.deriveMasterKey(password);
      
      // Decrypt vault data
      const encryptedData = StorageModule.getVaultData();
      if (!encryptedData) {
        // Handle case where vault data is missing
        console.warn('No vault data found, creating empty vault');
        this.passwords = [];
      } else {
        try {
          const decryptedData = await EncryptionModule.decrypt(encryptedData, masterKey);
          
          // Safely parse JSON with error handling
          try {
            this.passwords = JSON.parse(decryptedData);
            if (!Array.isArray(this.passwords)) {
              console.error('Vault data is not an array, resetting to empty array');
              this.passwords = [];
            }
          } catch (jsonError) {
            console.error('Error parsing vault data JSON:', jsonError);
            UIModule.showMessage('Your vault data appears to be corrupted. Creating a new empty vault.', 'error');
            this.passwords = [];
          }
        } catch (decryptError) {
          console.error('Error decrypting vault data:', decryptError);
          UIModule.showMessage('Error decrypting vault data. Creating a new empty vault.', 'error');
          this.passwords = [];
        }
      }
      
      // Process password data to add additional metadata if missing
      this.passwords = this.passwords.map(password => {
        if (!password.lastUpdated) {
          password.lastUpdated = Date.now();
        }
        return password;
      });
      
      // Decrypt TOTP secrets if they exist
      const encryptedTOTP = StorageModule.getTOTPSecrets();
      if (encryptedTOTP) {
        try {
          const decryptedTOTP = await EncryptionModule.decrypt(encryptedTOTP, masterKey);
          try {
            this.totpSecrets = JSON.parse(decryptedTOTP);
            if (!Array.isArray(this.totpSecrets)) {
              console.error('TOTP secrets data is not an array, resetting to empty array');
              this.totpSecrets = [];
            }
          } catch (jsonError) {
            console.error('Error parsing TOTP secrets JSON:', jsonError);
            this.totpSecrets = [];
          }
        } catch (decryptError) {
          console.error('Error decrypting TOTP secrets:', decryptError);
          this.totpSecrets = [];
        }
      } else {
        this.totpSecrets = [];
      }
      
      // Decrypt shared passwords if they exist
      const encryptedShared = StorageModule.getSharedPasswords();
      if (encryptedShared) {
        try {
          const decryptedShared = await EncryptionModule.decrypt(encryptedShared, masterKey);
          try {
            this.sharedPasswords = JSON.parse(decryptedShared);
            if (!Array.isArray(this.sharedPasswords)) {
              console.error('Shared passwords data is not an array, resetting to empty array');
              this.sharedPasswords = [];
            }
          } catch (jsonError) {
            console.error('Error parsing shared passwords JSON:', jsonError);
            this.sharedPasswords = [];
          }
        } catch (decryptError) {
          console.error('Error decrypting shared passwords:', decryptError);
          this.sharedPasswords = [];
        }
      } else {
        this.sharedPasswords = [];
      }
      
      // Save master password in memory for session
      this.masterPassword = password;
      this.isVaultUnlocked = true;
      
      // Save corrected vault data if needed
      if (encryptedData === null) {
        await this.saveVaultData();
      }
      
      // Notify background script that the vault is unlocked
      chrome.runtime.sendMessage({
        action: 'unlockVault',
        masterPassword: password,
        passwords: this.passwords
      });
      
      // Check for expiring passwords
      this.checkExpiringPasswords();
      
      // Render passwords
      UIModule.renderPasswordList(this.passwords);
      
      // Clear password field
      document.getElementById('masterPassword').value = '';
      
      // Switch to vault screen
      UIModule.showScreen('vaultScreen');
    } catch (error) {
      console.error('Vault unlock error details:', error);
      UIModule.showMessage('Error unlocking vault: ' + error.message, 'error');
    }
  }
  
  /**
   * Locks the vault
   */
  lockVault() {
    // Notify background script that the vault is locked
    chrome.runtime.sendMessage({
      action: 'lockVault'
    });
    
    // Clear TOTP timer if running
    if (this.totpTimer) {
      clearInterval(this.totpTimer);
      this.totpTimer = null;
    }
    
    this.masterPassword = null;
    this.isVaultUnlocked = false;
    this.passwords = [];
    this.totpSecrets = [];
    this.sharedPasswords = [];
    
    // Switch to login screen
    UIModule.showScreen('loginScreen');
  }
  
  /**
   * Saves a password to the vault
   */
  savePassword() {
    if (!this.isVaultUnlocked) {
      return;
    }
    
    const modal = document.getElementById('passwordModal');
    const website = document.getElementById('websiteInput').value.trim();
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const setupTOTP = document.getElementById('setupTOTP').checked;
    
    if (!website || !username || !password) {
      alert('Please fill in all fields.');
      return;
    }
    
    // Prepare password object with metadata
    const passwordObj = {
      website,
      username,
      password,
      lastUpdated: Date.now(),
      hasTOTP: setupTOTP
    };
    
    // Check if we're editing or adding
    const isEditing = modal.dataset.editing === 'true';
    const editIndex = parseInt(modal.dataset.editIndex);
    
    if (isEditing) {
      // Update existing password
      this.passwords[editIndex] = passwordObj;
    } else {
      // Add new password
      this.passwords.push(passwordObj);
    }
    
    // Save updated passwords to storage
    this.saveVaultData();
    
    // Notify background script of the updated passwords
    chrome.runtime.sendMessage({
      action: 'updatePasswords',
      passwords: this.passwords
    });
    
    // Update UI
    UIModule.renderPasswordList(this.passwords);
    
    // If TOTP setup is checked, show TOTP modal
    if (setupTOTP) {
      this.selectedPassword = passwordObj;
      this.showTOTPModal();
    }
    
    // Close modal
    modal.classList.add('hidden');
    delete modal.dataset.editing;
    delete modal.dataset.editIndex;
  }
  
  /**
   * Deletes a password from the vault
   * @param {number} index - Index of password to delete
   */
  deletePassword(index) {
    if (!this.isVaultUnlocked || index < 0 || index >= this.passwords.length) {
      return;
    }
    
    // Get password details before removing
    const password = this.passwords[index];
    
    // Remove password from array
    this.passwords.splice(index, 1);
    
    // If password had TOTP, remove the corresponding TOTP secret
    if (password.hasTOTP) {
      const totpIndex = this.totpSecrets.findIndex(
        totp => totp.website === password.website && totp.username === password.username
      );
      
      if (totpIndex !== -1) {
        this.totpSecrets.splice(totpIndex, 1);
      }
    }
    
    // Save updated passwords to storage
    this.saveVaultData();
    
    // Notify background script of the updated passwords
    chrome.runtime.sendMessage({
      action: 'updatePasswords',
      passwords: this.passwords
    });
    
    // Update UI
    UIModule.renderPasswordList(this.passwords);
  }
  
  /**
   * Saves vault data to storage
   */
  async saveVaultData() {
    if (!this.isVaultUnlocked || !this.masterPassword) {
      return;
    }
    
    try {
      // Derive master key for encryption first
      const masterKey = await EncryptionModule.deriveMasterKey(this.masterPassword);
      
      // Save passwords
      const vaultData = JSON.stringify(this.passwords);
      const encryptedData = await EncryptionModule.encrypt(vaultData, masterKey);
      StorageModule.saveVaultData(encryptedData);
      
      // Save TOTP secrets
      const totpData = JSON.stringify(this.totpSecrets);
      const encryptedTOTP = await EncryptionModule.encrypt(totpData, masterKey);
      StorageModule.saveTOTPSecrets(encryptedTOTP);
      
      // Save shared passwords
      const sharedData = JSON.stringify(this.sharedPasswords);
      const encryptedShared = await EncryptionModule.encrypt(sharedData, masterKey);
      StorageModule.saveSharedPasswords(encryptedShared);
    } catch (error) {
      console.error('Error saving vault data:', error);
      alert('Error saving vault data: ' + error.message);
    }
  }
  
  /**
   * Shows the TOTP setup modal
   */
  showTOTPModal() {
    if (!this.isVaultUnlocked) {
      return;
    }
    
    // Reset form
    document.getElementById('totpAccount').value = '';
    document.getElementById('totpSecret').value = '';
    
    // If a password was selected, pre-fill the account name
    if (this.selectedPassword) {
      document.getElementById('totpAccount').value = 
        `${this.selectedPassword.website} (${this.selectedPassword.username})`;
    }
    
    // Show the modal
    document.getElementById('totpModal').classList.remove('hidden');
  }
  
  /**
   * Saves a TOTP secret
   */
  saveTOTP() {
    if (!this.isVaultUnlocked) {
      return;
    }
    
    const account = document.getElementById('totpAccount').value.trim();
    const secret = document.getElementById('totpSecret').value.trim().replace(/\s+/g, '');
    
    if (!account || !secret) {
      alert('Please fill in all fields.');
      return;
    }
    
    // Validate the secret
    try {
      const testCode = TOTPModule.generateTOTP(secret);
      if (!testCode) {
        throw new Error('Invalid secret key');
      }
    } catch (error) {
      alert('Invalid TOTP secret key. Please check and try again.');
      return;
    }
    
    // Create TOTP entry
    const totpEntry = {
      account,
      secret,
      issuer: account.split(' ')[0],
      timestamp: Date.now()
    };
    
    // If this is linked to a password, add the website and username
    if (this.selectedPassword) {
      totpEntry.website = this.selectedPassword.website;
      totpEntry.username = this.selectedPassword.username;
      
      // Update the password to mark that it has TOTP
      const passwordIndex = this.passwords.findIndex(
        p => p.website === this.selectedPassword.website && p.username === this.selectedPassword.username
      );
      
      if (passwordIndex !== -1) {
        this.passwords[passwordIndex].hasTOTP = true;
      }
      
      // Clear selected password
      this.selectedPassword = null;
    }
    
    // Add to TOTP secrets
    this.totpSecrets.push(totpEntry);
    
    // Save to storage
    this.saveVaultData();
    
    // Render TOTP codes if on TOTP tab
    if (!document.getElementById('totpTab').classList.contains('hidden')) {
      this.renderTOTPCodes();
      this.startTOTPTimer();
    }
    
    // Close modal
    document.getElementById('totpModal').classList.add('hidden');
  }
  
  /**
   * Renders TOTP codes
   */
  renderTOTPCodes() {
    if (!this.isVaultUnlocked) {
      return;
    }
    
    const totpList = document.getElementById('totpList');
    totpList.innerHTML = '';
    
    if (this.totpSecrets.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'No 2FA accounts added yet. Click "Add 2FA Account" to get started.';
      totpList.appendChild(emptyMessage);
      return;
    }
    
    this.totpSecrets.forEach((totpEntry, index) => {
      const totpItem = document.createElement('div');
      totpItem.className = 'totp-item';
      totpItem.dataset.index = index;
      
      const account = document.createElement('h3');
      account.textContent = totpEntry.account;
      
      const code = document.createElement('div');
      code.className = 'totp-code';
      
      // Generate TOTP code
      const totpCode = TOTPModule.generateTOTP(totpEntry.secret);
      code.textContent = totpCode;
      
      // Add timer
      const timer = document.createElement('div');
      timer.className = 'totp-timer';
      
      const timerBar = document.createElement('div');
      timerBar.className = 'timer-bar';
      
      const remainingTime = TOTPModule.getRemainingTime();
      const percentage = (remainingTime / 30) * 100;
      timerBar.style.width = `${percentage}%`;
      
      timer.appendChild(timerBar);
      
      // Actions
      const actions = document.createElement('div');
      actions.className = 'totp-actions';
      
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn secondary copy-btn';
      copyBtn.textContent = 'Copy Code';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(totpCode);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy Code';
        }, 2000);
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn secondary delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete the 2FA code for ${totpEntry.account}?`)) {
          this.deleteTOTP(index);
        }
      });
      
      actions.appendChild(copyBtn);
      actions.appendChild(deleteBtn);
      
      totpItem.appendChild(account);
      totpItem.appendChild(code);
      totpItem.appendChild(timer);
      totpItem.appendChild(actions);
      
      totpList.appendChild(totpItem);
    });
  }
  
  /**
   * Starts the TOTP timer to update codes
   */
  startTOTPTimer() {
    // Clear existing timer
    if (this.totpTimer) {
      clearInterval(this.totpTimer);
    }
    
    // Update every second
    this.totpTimer = setInterval(() => {
      const remainingTime = TOTPModule.getRemainingTime();
      
      // Update all timer bars
      document.querySelectorAll('.timer-bar').forEach(bar => {
        const percentage = (remainingTime / 30) * 100;
        bar.style.width = `${percentage}%`;
      });
      
      // If time is up, regenerate all codes
      if (remainingTime === 30) {
        this.renderTOTPCodes();
      }
    }, 1000);
  }
  
  /**
   * Deletes a TOTP secret
   * @param {number} index - Index of TOTP secret to delete
   */
  deleteTOTP(index) {
    if (!this.isVaultUnlocked || index < 0 || index >= this.totpSecrets.length) {
      return;
    }
    
    // Get TOTP details before removing
    const totp = this.totpSecrets[index];
    
    // Remove TOTP from array
    this.totpSecrets.splice(index, 1);
    
    // If TOTP was linked to a password, update the password
    if (totp.website && totp.username) {
      const passwordIndex = this.passwords.findIndex(
        p => p.website === totp.website && p.username === totp.username
      );
      
      if (passwordIndex !== -1) {
        this.passwords[passwordIndex].hasTOTP = false;
      }
    }
    
    // Save to storage
    this.saveVaultData();
    
    // Render TOTP codes
    this.renderTOTPCodes();
  }
  
  /**
   * Shows the password sharing modal
   */
  showShareModal() {
    if (!this.isVaultUnlocked) {
      return;
    }
    
    const modal = document.getElementById('passwordModal');
    const shareModal = document.getElementById('shareModal');
    
    // If we're in the password modal, get the password from the inputs
    if (!modal.classList.contains('hidden')) {
      const website = document.getElementById('websiteInput').value.trim();
      const username = document.getElementById('usernameInput').value.trim();
      const password = document.getElementById('passwordInput').value;
      
      if (!website || !username || !password) {
        alert('Please fill in all fields before sharing.');
        return;
      }
      
      this.selectedPassword = { website, username, password };
    }
    
    // Reset the share modal
    document.querySelector('.generated-link-container').classList.add('hidden');
    document.getElementById('shareQRCode').innerHTML = '';
    document.getElementById('shareRecipient').value = '';
    
    // Show the modal
    shareModal.classList.remove('hidden');
  }
  
  /**
   * Generates a share link or QR code
   */
  generateShare() {
    if (!this.isVaultUnlocked || !this.selectedPassword) {
      return;
    }
    
    try {
      // Get expiry days from select
      const expiryDays = parseInt(document.getElementById('shareExpiry').value);
      const expiryMs = expiryDays * 24 * 60 * 60 * 1000;
      
      // Get recipient email
      const recipientEmail = document.getElementById('shareRecipient').value.trim();
      
      // Create shareable password
      const shareData = PasswordSharingModule.createShareablePassword(
        this.selectedPassword,
        recipientEmail || null
      );
      
      // Customize expiry
      shareData.package.expires = Date.now() + expiryMs;
      
      // Generate share URL
      const shareURL = PasswordSharingModule.generateShareURL(
        shareData.package,
        shareData.key
      );
      
      // Active tab
      const activeTab = document.querySelector('.share-tab-btn.active').dataset.tab;
      
      if (activeTab === 'link') {
        // Show link
        document.getElementById('generatedShareLink').value = shareURL;
        document.querySelector('.generated-link-container').classList.remove('hidden');
        
        // Show instructions
        alert(`Share this link with the recipient. They will also need the decryption key: ${shareData.key}`);
      } else {
        // Generate QR code
        const qrCodeURL = PasswordSharingModule.generateQRCode(shareURL);
        
        // Display QR code
        const qrContainer = document.getElementById('shareQRCode');
        qrContainer.innerHTML = '';
        
        const qrImage = document.createElement('img');
        qrImage.src = qrCodeURL;
        qrImage.alt = 'Password sharing QR code';
        qrContainer.appendChild(qrImage);
        
        // Also show key
        const keyInfo = document.createElement('p');
        keyInfo.textContent = `Decryption key: ${shareData.key}`;
        keyInfo.className = 'qr-key-info';
        qrContainer.appendChild(keyInfo);
        
        // Show instructions
        alert(`Share this QR code with the recipient. They will also need the decryption key shown below the QR code.`);
      }
      
      // Store shared password info
      this.sharedPasswords.push({
        ...shareData.package,
        key: shareData.key,
        password: this.selectedPassword
      });
      
      // Save to storage
      this.saveVaultData();
    } catch (error) {
      console.error('Error generating share:', error);
      alert('Error generating share: ' + error.message);
    }
  }
  
  /**
   * Shows the import modal
   */
  showImportModal() {
    if (!this.isVaultUnlocked) {
      return;
    }
    
    // Reset form
    document.getElementById('importShareURL').value = '';
    document.getElementById('importShareKey').value = '';
    
    // Show modal
    document.getElementById('importModal').classList.remove('hidden');
  }
  
  /**
   * Imports a shared password
   */
  importSharedPassword() {
    if (!this.isVaultUnlocked) {
      return;
    }
    
    const shareURL = document.getElementById('importShareURL').value.trim();
    const shareKey = document.getElementById('importShareKey').value.trim();
    
    if (!shareURL || !shareKey) {
      alert('Please enter both the share URL and decryption key.');
      return;
    }
    
    try {
      // Parse the share URL
      const passwordData = PasswordSharingModule.decodeShareURL(shareURL, shareKey);
      
      // Check if password already exists
      const existingIndex = this.passwords.findIndex(
        p => p.website === passwordData.website && p.username === passwordData.username
      );
      
      if (existingIndex !== -1) {
        if (!confirm(`A password for ${passwordData.website} (${passwordData.username}) already exists. Do you want to replace it?`)) {
          return;
        }
        
        // Replace existing password
        this.passwords[existingIndex] = {
          ...passwordData,
          lastUpdated: Date.now()
        };
      } else {
        // Add new password
        this.passwords.push({
          ...passwordData,
          lastUpdated: Date.now()
        });
      }
      
      // Save to storage
      this.saveVaultData();
      
      // Update UI
      UIModule.renderPasswordList(this.passwords);
      
      // Close modal
      document.getElementById('importModal').classList.add('hidden');
      
      // Show success message
      alert('Password imported successfully!');
    } catch (error) {
      console.error('Error importing shared password:', error);
      alert('Error importing shared password: ' + error.message);
    }
  }
  
  /**
   * Checks for passwords that will expire soon
   */
  checkExpiringPasswords() {
    if (!this.isVaultUnlocked || !this.passwords.length) {
      return;
    }
    
    // Get settings
    const settings = StorageModule.getSettings();
    const expiryDays = settings.passwordExpiryDays || 90;
    const expiryThreshold = expiryDays * 24 * 60 * 60 * 1000;
    const warningDays = 14; // Start warning 14 days before expiry
    const warningThreshold = warningDays * 24 * 60 * 60 * 1000;
    
    // Current time
    const now = Date.now();
    
    // Find expiring passwords
    const expiringPasswords = this.passwords.filter(password => {
      if (!password.lastUpdated) return false;
      
      const passwordAge = now - password.lastUpdated;
      return passwordAge > (expiryThreshold - warningThreshold) && passwordAge < expiryThreshold;
    });
    
    // If we have expiring passwords, show warning
    if (expiringPasswords.length > 0) {
      // Show in UI
      const expiryContainer = document.getElementById('expiryNotifications');
      const expiryList = document.getElementById('expiryList');
      expiryList.innerHTML = '';
      
      expiringPasswords.forEach(password => {
        const passwordAge = now - password.lastUpdated;
        const daysUntilExpiry = Math.ceil((expiryThreshold - passwordAge) / (24 * 60 * 60 * 1000));
        
        const item = document.createElement('div');
        item.className = 'expiry-item';
        
        const info = document.createElement('div');
        info.className = 'expiry-info';
        info.innerHTML = `<strong>${password.website}</strong> (${password.username}) will expire in ${daysUntilExpiry} days`;
        
        const updateBtn = document.createElement('button');
        updateBtn.className = 'btn secondary';
        updateBtn.textContent = 'Update Now';
        updateBtn.addEventListener('click', () => {
          // Find the password in the list and open its edit modal
          const index = this.passwords.findIndex(
            p => p.website === password.website && p.username === password.username
          );
          
          if (index !== -1) {
            UIModule.openEditModal(password, index);
          }
        });
        
        item.appendChild(info);
        item.appendChild(updateBtn);
        expiryList.appendChild(item);
      });
      
      expiryContainer.classList.remove('hidden');
    }
  }
  
  /**
   * Saves user settings
   */
  saveSettings() {
    if (!this.isVaultUnlocked) {
      return;
    }
    
    const settings = {
      darkMode: document.body.classList.contains('dark-mode'),
      passwordExpiryDays: parseInt(document.getElementById('passwordExpiryDays').value),
      enableAutoFill: document.getElementById('enableAutoFill').checked,
      checkPasswordStrength: document.getElementById('checkPasswordStrength').checked,
      enableTOTP: document.getElementById('enableTOTP').checked,
      cloudSync: document.getElementById('cloudSync').checked
    };
    
    // Save settings
    StorageModule.saveSettings(settings);
    
    // Show confirmation
    alert('Settings saved successfully!');
  }
  
  /**
   * Exports vault data
   */
  exportVaultData() {
    if (!this.isVaultUnlocked) {
      return;
    }
    
    if (!confirm('Warning: This will export your encrypted vault data. You will need your master password to decrypt it. Continue?')) {
      return;
    }
    
    try {
      // Create export object
      const exportData = {
        vault: StorageModule.getVaultData(),
        totp: StorageModule.getTOTPSecrets(),
        shared: StorageModule.getSharedPasswords(),
        verification: StorageModule.getVerificationString(),
        exported: Date.now()
      };
      
      // Convert to JSON
      const jsonData = JSON.stringify(exportData);
      
      // Create download link
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `aivault-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting vault data:', error);
      alert('Error exporting vault data: ' + error.message);
    }
  }
  
  /**
   * Resets the vault (deletes all data)
   */
  resetVault() {
    if (!confirm('WARNING: This will permanently delete all your stored passwords and settings. This action cannot be undone. Are you sure you want to continue?')) {
      return;
    }
    
    if (!confirm('FINAL WARNING: All your data will be permanently deleted. Are you absolutely sure?')) {
      return;
    }
    
    try {
      // Clear all data
      StorageModule.clearAll();
      
      // Reset state
      this.masterPassword = null;
      this.isVaultUnlocked = false;
      this.passwords = [];
      this.totpSecrets = [];
      this.sharedPasswords = [];
      
      // Show setup screen
      UIModule.showScreen('setupAccountScreen');
      
      // Show success message
      alert('Vault has been reset successfully.');
    } catch (error) {
      console.error('Error resetting vault:', error);
      alert('Error resetting vault: ' + error.message);
    }
  }
  
  /**
   * Sends a prompt to the AI assistant
   */
  async sendAIPrompt() {
    const promptInput = document.getElementById('aiPrompt');
    const prompt = promptInput.value.trim();
    
    if (!prompt) {
      return;
    }
    
    // Show user message
    UIModule.addChatMessage(prompt, true);
    
    // Clear input
    promptInput.value = '';
    
    // Show loading indicator
    const loadingElement = UIModule.showChatLoading();
    
    try {
      // Get response from AI
      const response = await this.aiAssistant.getResponse(prompt);
      
      // Remove loading indicator
      loadingElement.remove();
      
      // Show AI response
      UIModule.addChatMessage(response);
    } catch (error) {
      // Remove loading indicator
      loadingElement.remove();
      
      // Show error message
      UIModule.addChatMessage('Sorry, I encountered an error. Please try again.');
      console.error('AI assistant error:', error);
    }
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.initialize();
  
  // Make app globally available for debugging
  window.app = app;
});