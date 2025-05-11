/**
 * Encryption Module for AIVault
 * Handles encryption and decryption of sensitive data
 * Using AES-256 with the WebCrypto API where available, falling back to CryptoJS
 */

const EncryptionModule = {
  /**
   * Initializes encryption keys from a master password
   * @param {string} masterPassword - The master password
   * @returns {Promise<Object>} - Object containing derived keys
   */
  async deriveMasterKey(masterPassword) {
    try {
      // Use WebCrypto API if available
      if (window.crypto && window.crypto.subtle) {
        // Convert password to raw bytes
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(masterPassword);
        
        // Import password as raw key material
        const keyMaterial = await window.crypto.subtle.importKey(
          'raw',
          passwordBuffer,
          { name: 'PBKDF2' },
          false,
          ['deriveBits', 'deriveKey']
        );
        
        // Create a random salt (or use a fixed one for consistency)
        // For a password manager, a fixed salt is acceptable since each user has a unique master password
        const salt = encoder.encode('AIVault-Static-Salt-For-Consistency');
        
        // Derive a 256-bit key using PBKDF2
        const derivedKey = await window.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        
        // Export the key as raw bytes for storage/verification
        const exportedKey = await window.crypto.subtle.exportKey('raw', derivedKey);
        
        return {
          key: derivedKey,
          keyBytes: new Uint8Array(exportedKey),
          useWebCrypto: true
        };
      } else {
        // Fallback to CryptoJS
        const key = CryptoJS.PBKDF2(masterPassword, 'AIVault-Static-Salt-For-Consistency', {
          keySize: 256 / 32,
          iterations: 100000,
          hasher: CryptoJS.algo.SHA256
        });
        
        return {
          key: key,
          keyString: key.toString(),
          useWebCrypto: false
        };
      }
    } catch (error) {
      console.error('Error deriving master key:', error);
      
      // Force fallback to CryptoJS
      const key = CryptoJS.PBKDF2(masterPassword, 'AIVault-Static-Salt-For-Consistency', {
        keySize: 256 / 32,
        iterations: 100000,
        hasher: CryptoJS.algo.SHA256
      });
      
      return {
        key: key,
        keyString: key.toString(),
        useWebCrypto: false
      };
    }
  },
  
  /**
   * Creates a verification string to validate the master password
   * @param {string} masterPassword - The master password
   * @returns {Promise<string>} - Encrypted verification string
   */
  async createVerificationString(masterPassword) {
    const verificationText = 'AIVault-Verification-' + Date.now();
    const masterKey = await this.deriveMasterKey(masterPassword);
    
    return this.encrypt(verificationText, masterKey);
  },
  
  /**
   * Verifies a master password against the stored verification string
   * @param {string} masterPassword - The master password to verify
   * @param {string} verificationString - The stored verification string
   * @returns {Promise<boolean>} - Whether the password is correct
   */
  async verifyMasterPassword(masterPassword, verificationString) {
    try {
      const masterKey = await this.deriveMasterKey(masterPassword);
      const decrypted = await this.decrypt(verificationString, masterKey);
      
      // Check if the decrypted string starts with our verification prefix
      return decrypted && decrypted.startsWith('AIVault-Verification-');
    } catch (error) {
      console.error('Error verifying master password:', error);
      return false;
    }
  },
  
  /**
   * Encrypts data with the derived master key
   * @param {string|Object} data - Data to encrypt
   * @param {Object} masterKey - The derived master key
   * @returns {Promise<string>} - Encrypted string
   */
  async encrypt(data, masterKey) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    try {
      if (masterKey.useWebCrypto) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(dataString);
        
        // Generate a random IV
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        
        // Encrypt the data
        const encryptedBuffer = await window.crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv: iv,
            tagLength: 128
          },
          masterKey.key,
          dataBuffer
        );
        
        // Combine IV and encrypted data for storage
        const result = {
          iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
          data: Array.from(new Uint8Array(encryptedBuffer)).map(b => b.toString(16).padStart(2, '0')).join(''),
          version: 1  // For potential future format changes
        };
        
        return JSON.stringify(result);
      } else {
        // Fallback to CryptoJS
        const iv = CryptoJS.lib.WordArray.random(16);
        const encrypted = CryptoJS.AES.encrypt(dataString, masterKey.key, {
          iv: iv,
          padding: CryptoJS.pad.Pkcs7,
          mode: CryptoJS.mode.CBC
        });
        
        const result = {
          iv: iv.toString(CryptoJS.enc.Hex),
          data: encrypted.toString(),
          version: 1
        };
        
        return JSON.stringify(result);
      }
    } catch (error) {
      console.error('Encryption error:', error);
      
      // Fallback to CryptoJS
      const iv = CryptoJS.lib.WordArray.random(16);
      const encrypted = CryptoJS.AES.encrypt(dataString, masterKey.key, {
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC
      });
      
      const result = {
        iv: iv.toString(CryptoJS.enc.Hex),
        data: encrypted.toString(),
        version: 1
      };
      
      return JSON.stringify(result);
    }
  },
  
  /**
   * Decrypts data with the derived master key
   * @param {string} encryptedData - Encrypted data string
   * @param {Object} masterKey - The derived master key
   * @returns {Promise<string|Object>} - Decrypted data
   */
  async decrypt(encryptedData, masterKey) {
    try {
      const encryptedObj = JSON.parse(encryptedData);
      const { iv, data, version } = encryptedObj;
      
      if (masterKey.useWebCrypto) {
        // Convert hex strings back to Uint8Arrays
        const ivArray = new Uint8Array(iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const encryptedArray = new Uint8Array(data.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        
        // Decrypt the data
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: ivArray,
            tagLength: 128
          },
          masterKey.key,
          encryptedArray
        );
        
        // Convert the decrypted data back to a string
        const decoder = new TextDecoder();
        const decrypted = decoder.decode(decryptedBuffer);
        
        // Try to parse as JSON, return as string if not valid JSON
        try {
          return JSON.parse(decrypted);
        } catch {
          return decrypted;
        }
      } else {
        // Fallback to CryptoJS
        const ivParams = CryptoJS.enc.Hex.parse(iv);
        
        // For version 1 (current), use CBC mode
        const decrypted = CryptoJS.AES.decrypt(data, masterKey.key, {
          iv: ivParams,
          padding: CryptoJS.pad.Pkcs7,
          mode: CryptoJS.mode.CBC
        });
        
        const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
        
        // Try to parse as JSON, return as string if not valid JSON
        try {
          return JSON.parse(decryptedString);
        } catch {
          return decryptedString;
        }
      }
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data. Possible incorrect password or corrupted data.');
    }
  },
  
  /**
   * Generates a random password
   * @param {Object} options - Password generation options
   * @returns {string} - Generated password
   */
  generateRandomPassword(options = {}) {
    // Default options
    const config = {
      length: options.length || 16,
      uppercase: options.uppercase !== false,
      lowercase: options.lowercase !== false,
      numbers: options.numbers !== false,
      symbols: options.symbols !== false
    };
    
    // Character sets
    const charSets = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      symbols: '!@#$%^&*()-_=+[]{}|;:,.<>?'
    };
    
    // Build character set based on options
    let charSet = '';
    if (config.uppercase) charSet += charSets.uppercase;
    if (config.lowercase) charSet += charSets.lowercase;
    if (config.numbers) charSet += charSets.numbers;
    if (config.symbols) charSet += charSets.symbols;
    
    // Ensure at least one character type is selected
    if (charSet === '') {
      charSet = charSets.lowercase;
    }
    
    // Generate password
    let password = '';
    
    // Ensure at least one character from each selected type
    if (config.uppercase) {
      password += charSets.uppercase.charAt(Math.floor(Math.random() * charSets.uppercase.length));
    }
    if (config.lowercase) {
      password += charSets.lowercase.charAt(Math.floor(Math.random() * charSets.lowercase.length));
    }
    if (config.numbers) {
      password += charSets.numbers.charAt(Math.floor(Math.random() * charSets.numbers.length));
    }
    if (config.symbols) {
      password += charSets.symbols.charAt(Math.floor(Math.random() * charSets.symbols.length));
    }
    
    // Fill up to desired length
    const charSetLength = charSet.length;
    while (password.length < config.length) {
      const randomIndex = Math.floor(Math.random() * charSetLength);
      password += charSet.charAt(randomIndex);
    }
    
    // Shuffle the password characters
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  }
};

// Export the module
window.EncryptionModule = EncryptionModule;