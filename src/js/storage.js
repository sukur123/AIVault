/**
 * Storage Module for AIVault
 * Handles data storage and retrieval using local storage and IndexedDB
 */

const StorageModule = {
  // Storage keys
  VERIFICATION_KEY: 'aivault_verification',
  VAULT_DATA_KEY: 'aivault_vault_data',
  SETTINGS_KEY: 'aivault_settings',
  TOTP_SECRETS_KEY: 'aivault_totp_secrets',
  SHARED_PASSWORDS_KEY: 'aivault_shared_passwords',
  IDB_NAME: 'aivault_database',
  IDB_VERSION: 1,
  
  /**
   * Initializes the storage module
   * @returns {Promise<boolean>} - Success status
   */
  async initialize() {
    try {
      // Check if IndexedDB is available and initialize it
      if (window.indexedDB) {
        await this.initializeIndexedDB();
      }
      return true;
    } catch (error) {
      console.error('Error initializing storage:', error);
      return false;
    }
  },
  
  /**
   * Initializes IndexedDB for password storage history
   * @returns {Promise<IDBDatabase>} - The database instance
   */
  async initializeIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.IDB_NAME, this.IDB_VERSION);
      
      request.onerror = function(event) {
        console.error('Failed to open IndexedDB:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = function(event) {
        const db = event.target.result;
        resolve(db);
      };
      
      request.onupgradeneeded = function(event) {
        const db = event.target.result;
        
        // Create object store for password history
        if (!db.objectStoreNames.contains('passwordHistory')) {
          const store = db.createObjectStore('passwordHistory', { keyPath: 'id', autoIncrement: true });
          store.createIndex('website', 'website', { unique: false });
          store.createIndex('username', 'username', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        // Create object store for favicons
        if (!db.objectStoreNames.contains('favicons')) {
          const store = db.createObjectStore('favicons', { keyPath: 'domain' });
          store.createIndex('domain', 'domain', { unique: true });
        }
      };
    });
  },
  
  /**
   * Gets the IndexedDB database instance
   * @returns {Promise<IDBDatabase>} - The database instance
   */
  async getDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.IDB_NAME, this.IDB_VERSION);
      
      request.onerror = function(event) {
        console.error('Failed to open IndexedDB:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = function(event) {
        const db = event.target.result;
        resolve(db);
      };
    });
  },
  
  /**
   * Checks if a vault exists
   * @returns {boolean} - Whether a vault exists
   */
  vaultExists() {
    return !!this.getVerificationString();
  },
  
  /**
   * Saves the verification string for the master password
   * @param {string} verificationString - Encrypted verification string
   * @returns {boolean} - Success status
   */
  saveVerificationString(verificationString) {
    try {
      localStorage.setItem(this.VERIFICATION_KEY, verificationString);
      return true;
    } catch (error) {
      console.error('Error saving verification string:', error);
      return false;
    }
  },
  
  /**
   * Retrieves the verification string for the master password
   * @returns {string|null} - The verification string or null if not found
   */
  getVerificationString() {
    try {
      return localStorage.getItem(this.VERIFICATION_KEY);
    } catch (error) {
      console.error('Error retrieving verification string:', error);
      return null;
    }
  },
  
  /**
   * Saves encrypted vault data to local storage
   * @param {string} encryptedData - Encrypted vault data
   * @returns {boolean} - Success status
   */
  saveVaultData(encryptedData) {
    try {
      localStorage.setItem(this.VAULT_DATA_KEY, encryptedData);
      return true;
    } catch (error) {
      // Check if the error is due to storage quota
      if (error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded. Trying to compress data...');
        
        // Try compressing the data
        try {
          // Split into chunks if needed
          const maxChunkSize = 2 * 1024 * 1024; // 2MB chunks
          if (encryptedData.length > maxChunkSize) {
            const chunks = [];
            for (let i = 0; i < encryptedData.length; i += maxChunkSize) {
              chunks.push(encryptedData.slice(i, i + maxChunkSize));
            }
            
            // Store number of chunks
            localStorage.setItem(`${this.VAULT_DATA_KEY}_chunks`, chunks.length.toString());
            
            // Store each chunk
            for (let i = 0; i < chunks.length; i++) {
              localStorage.setItem(`${this.VAULT_DATA_KEY}_${i}`, chunks[i]);
            }
            
            return true;
          }
        } catch (compressionError) {
          console.error('Error compressing data:', compressionError);
        }
      }
      
      console.error('Error saving vault data:', error);
      return false;
    }
  },
  
  /**
   * Retrieves encrypted vault data from local storage
   * @returns {string|null} - The encrypted vault data or null if not found
   */
  getVaultData() {
    try {
      // Check if we have chunked data
      const chunksStr = localStorage.getItem(`${this.VAULT_DATA_KEY}_chunks`);
      if (chunksStr) {
        const numChunks = parseInt(chunksStr, 10);
        if (isNaN(numChunks) || numChunks <= 0) {
          console.error('Invalid chunk count in storage');
          return null;
        }
        
        let fullData = '';
        let missingChunks = false;
        
        // Reconstruct from chunks
        for (let i = 0; i < numChunks; i++) {
          const chunk = localStorage.getItem(`${this.VAULT_DATA_KEY}_${i}`);
          if (chunk) {
            fullData += chunk;
          } else {
            console.error(`Missing chunk ${i} of ${numChunks}`);
            missingChunks = true;
            break;
          }
        }
        
        if (missingChunks) {
          return null;
        }
        
        return fullData || null;
      }
      
      // Regular storage
      const data = localStorage.getItem(this.VAULT_DATA_KEY);
      
      // Handle empty or invalid data
      if (!data) {
        console.warn('No vault data found in storage');
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error retrieving vault data:', error);
      return null;
    }
  },
  
  /**
   * Saves encrypted TOTP secrets to local storage
   * @param {string} encryptedData - Encrypted TOTP secrets
   * @returns {boolean} - Success status
   */
  saveTOTPSecrets(encryptedData) {
    try {
      localStorage.setItem(this.TOTP_SECRETS_KEY, encryptedData);
      return true;
    } catch (error) {
      console.error('Error saving TOTP secrets:', error);
      return false;
    }
  },
  
  /**
   * Retrieves encrypted TOTP secrets from local storage
   * @returns {string|null} - The encrypted TOTP secrets or null if not found
   */
  getTOTPSecrets() {
    try {
      return localStorage.getItem(this.TOTP_SECRETS_KEY);
    } catch (error) {
      console.error('Error retrieving TOTP secrets:', error);
      return null;
    }
  },
  
  /**
   * Saves encrypted shared passwords to local storage
   * @param {string} encryptedData - Encrypted shared passwords
   * @returns {boolean} - Success status
   */
  saveSharedPasswords(encryptedData) {
    try {
      localStorage.setItem(this.SHARED_PASSWORDS_KEY, encryptedData);
      return true;
    } catch (error) {
      console.error('Error saving shared passwords:', error);
      return false;
    }
  },
  
  /**
   * Retrieves encrypted shared passwords from local storage
   * @returns {string|null} - The encrypted shared passwords or null if not found
   */
  getSharedPasswords() {
    try {
      return localStorage.getItem(this.SHARED_PASSWORDS_KEY);
    } catch (error) {
      console.error('Error retrieving shared passwords:', error);
      return null;
    }
  },
  
  /**
   * Saves user settings
   * @param {Object} settings - User settings object
   * @returns {boolean} - Success status
   */
  saveSettings(settings) {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  },
  
  /**
   * Retrieves user settings
   * @returns {Object|null} - User settings or null if not found
   */
  getSettings() {
    try {
      const settingsString = localStorage.getItem(this.SETTINGS_KEY);
      return settingsString ? JSON.parse(settingsString) : {};
    } catch (error) {
      console.error('Error retrieving settings:', error);
      return {};
    }
  },
  
  /**
   * Adds a password history entry to IndexedDB
   * @param {Object} passwordEntry - Password history entry
   * @returns {Promise<boolean>} - Success status
   */
  async addPasswordHistory(passwordEntry) {
    try {
      if (!window.indexedDB) {
        return false;
      }
      
      const db = await this.getDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['passwordHistory'], 'readwrite');
        const store = transaction.objectStore('passwordHistory');
        
        // Add timestamp if not provided
        if (!passwordEntry.timestamp) {
          passwordEntry.timestamp = Date.now();
        }
        
        const request = store.add(passwordEntry);
        
        request.onsuccess = function() {
          resolve(true);
        };
        
        request.onerror = function(event) {
          console.error('Error adding password history:', event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error('Error adding password history:', error);
      return false;
    }
  },
  
  /**
   * Gets password history for a specific website and username
   * @param {string} website - The website domain
   * @param {string} username - The username
   * @returns {Promise<Array>} - Array of password history entries
   */
  async getPasswordHistory(website, username) {
    try {
      if (!window.indexedDB) {
        return [];
      }
      
      const db = await this.getDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['passwordHistory'], 'readonly');
        const store = transaction.objectStore('passwordHistory');
        const history = [];
        
        // Get cursor to scan through all entries
        const cursorRequest = store.openCursor();
        
        cursorRequest.onsuccess = function(event) {
          const cursor = event.target.result;
          if (cursor) {
            if (cursor.value.website === website && cursor.value.username === username) {
              history.push(cursor.value);
            }
            cursor.continue();
          } else {
            // Sort by timestamp, newest first
            history.sort((a, b) => b.timestamp - a.timestamp);
            resolve(history);
          }
        };
        
        cursorRequest.onerror = function(event) {
          console.error('Error getting password history:', event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error('Error getting password history:', error);
      return [];
    }
  },
  
  /**
   * Saves a favicon for a domain
   * @param {string} domain - The domain
   * @param {string} faviconUrl - The favicon URL or data URL
   * @returns {Promise<boolean>} - Success status
   */
  async saveFavicon(domain, faviconUrl) {
    try {
      if (!window.indexedDB) {
        return false;
      }
      
      const db = await this.getDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['favicons'], 'readwrite');
        const store = transaction.objectStore('favicons');
        
        const request = store.put({
          domain,
          faviconUrl,
          timestamp: Date.now()
        });
        
        request.onsuccess = function() {
          resolve(true);
        };
        
        request.onerror = function(event) {
          console.error('Error saving favicon:', event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error('Error saving favicon:', error);
      return false;
    }
  },
  
  /**
   * Gets a favicon for a domain
   * @param {string} domain - The domain
   * @returns {Promise<string|null>} - The favicon URL or null if not found
   */
  async getFavicon(domain) {
    try {
      if (!window.indexedDB) {
        return null;
      }
      
      const db = await this.getDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['favicons'], 'readonly');
        const store = transaction.objectStore('favicons');
        const index = store.index('domain');
        
        const request = index.get(domain);
        
        request.onsuccess = function(event) {
          if (event.target.result) {
            resolve(event.target.result.faviconUrl);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = function(event) {
          console.error('Error getting favicon:', event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error('Error getting favicon:', error);
      return null;
    }
  },
  
  /**
   * Clears all stored data
   * @returns {Promise<boolean>} - Success status
   */
  async clearAllData() {
    try {
      // Clear localStorage
      localStorage.removeItem(this.VERIFICATION_KEY);
      localStorage.removeItem(this.VAULT_DATA_KEY);
      localStorage.removeItem(this.TOTP_SECRETS_KEY);
      localStorage.removeItem(this.SHARED_PASSWORDS_KEY);
      
      // Check for chunked data
      const chunksStr = localStorage.getItem(`${this.VAULT_DATA_KEY}_chunks`);
      if (chunksStr) {
        const numChunks = parseInt(chunksStr, 10);
        for (let i = 0; i < numChunks; i++) {
          localStorage.removeItem(`${this.VAULT_DATA_KEY}_${i}`);
        }
        localStorage.removeItem(`${this.VAULT_DATA_KEY}_chunks`);
      }
      
      // Keep settings but reset some sensitive values
      const settings = this.getSettings();
      if (settings) {
        // Reset cloud sync setting
        if (settings.cloudSync) {
          settings.cloudSync = false;
        }
        this.saveSettings(settings);
      }
      
      // Clear IndexedDB if available
      if (window.indexedDB) {
        const db = await this.getDB();
        
        return new Promise((resolve) => {
          // Clear password history
          const transaction = db.transaction(['passwordHistory', 'favicons'], 'readwrite');
          
          const historyStore = transaction.objectStore('passwordHistory');
          const clearHistoryRequest = historyStore.clear();
          
          const faviconStore = transaction.objectStore('favicons');
          const clearFaviconRequest = faviconStore.clear();
          
          clearHistoryRequest.onsuccess = clearFaviconRequest.onsuccess = function() {
            resolve(true);
          };
          
          clearHistoryRequest.onerror = clearFaviconRequest.onerror = function(event) {
            console.error('Error clearing IndexedDB:', event.target.error);
            resolve(false);
          };
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error clearing data:', error);
      return false;
    }
  },
  
  /**
   * Alias for clearAllData for compatibility
   * @returns {Promise<boolean>} - Success status
   */
  clearAll() {
    return this.clearAllData();
  }
};

// Automatically initialize the storage module
StorageModule.initialize().catch(error => {
  console.error('Failed to initialize storage module:', error);
});

// Export the module
window.StorageModule = StorageModule;