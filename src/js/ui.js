/**
 * UI Module for AIVault
 * Handles UI interactions and dynamic elements
 */

class UIModule {
  /**
   * Initializes UI elements and event listeners
   */
  static initialize() {
    // Initialize dark mode
    this.initializeDarkMode();
    
    // Set up tab switching
    this.initializeTabs();
    
    // Set up modal functionality
    this.initializeModal();
    
    // Initialize password generator UI
    this.initializePasswordGenerator();
    
    // Set up password list functionality
    this.initializePasswordList();
  }
  
  /**
   * Initializes dark mode toggle
   */
  static initializeDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const settings = StorageModule.getSettings();
    
    // Set initial state
    if (settings.darkMode) {
      document.body.classList.add('dark-mode');
      darkModeToggle.checked = true;
    }
    
    // Handle toggle
    darkModeToggle.addEventListener('change', () => {
      document.body.classList.toggle('dark-mode');
      
      // Save setting
      const isDarkMode = document.body.classList.contains('dark-mode');
      StorageModule.saveSettings({ ...settings, darkMode: isDarkMode });
    });
  }
  
  /**
   * Initializes tab switching
   */
  static initializeTabs() {
    const passwordsTabBtn = document.getElementById('passwordsTabBtn');
    const aiAssistantTabBtn = document.getElementById('aiAssistantTabBtn');
    const passwordsTab = document.getElementById('passwordsTab');
    const aiAssistantTab = document.getElementById('aiAssistantTab');
    
    passwordsTabBtn.addEventListener('click', () => {
      passwordsTabBtn.classList.add('active');
      aiAssistantTabBtn.classList.remove('active');
      passwordsTab.classList.remove('hidden');
      aiAssistantTab.classList.add('hidden');
    });
    
    aiAssistantTabBtn.addEventListener('click', () => {
      aiAssistantTabBtn.classList.add('active');
      passwordsTabBtn.classList.remove('active');
      aiAssistantTab.classList.remove('hidden');
      passwordsTab.classList.add('hidden');
    });
  }
  
  /**
   * Initializes modal functionality
   */
  static initializeModal() {
    const addPasswordBtn = document.getElementById('addPasswordBtn');
    const passwordModal = document.getElementById('passwordModal');
    const closeModal = document.querySelector('.close-modal');
    const modalTitle = document.getElementById('modalTitle');
    
    // Open modal for adding a new password
    addPasswordBtn.addEventListener('click', () => {
      modalTitle.textContent = 'Add Password';
      this.clearModalInputs();
      passwordModal.classList.remove('hidden');
      document.getElementById('websiteInput').focus();
    });
    
    // Close modal
    closeModal.addEventListener('click', () => {
      passwordModal.classList.add('hidden');
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
      if (event.target === passwordModal) {
        passwordModal.classList.add('hidden');
      }
    });
    
    // Toggle password visibility
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const passwordInput = document.getElementById('passwordInput');
    
    togglePasswordBtn.addEventListener('click', () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        togglePasswordBtn.textContent = 'Hide';
      } else {
        passwordInput.type = 'password';
        togglePasswordBtn.textContent = 'Show';
      }
    });
    
    // Handle password input for strength meter
    passwordInput.addEventListener('input', () => {
      this.updatePasswordStrength(passwordInput.value);
    });
  }
  
  /**
   * Initializes password generator UI
   */
  static initializePasswordGenerator() {
    const generatePasswordBtn = document.getElementById('generatePasswordBtn');
    const generatorOptions = document.querySelector('.generator-options');
    const applyGenerateBtn = document.getElementById('applyGenerateBtn');
    
    // Toggle generator options
    generatePasswordBtn.addEventListener('click', () => {
      generatorOptions.classList.toggle('hidden');
    });
    
    // Generate and apply password
    applyGenerateBtn.addEventListener('click', () => {
      const options = {
        length: parseInt(document.getElementById('passwordLength').value),
        uppercase: document.getElementById('includeUppercase').checked,
        lowercase: document.getElementById('includeLowercase').checked,
        numbers: document.getElementById('includeNumbers').checked,
        symbols: document.getElementById('includeSymbols').checked
      };
      
      const generatedPassword = PasswordGenerator.generatePassword(options);
      document.getElementById('passwordInput').value = generatedPassword;
      this.updatePasswordStrength(generatedPassword);
      
      generatorOptions.classList.add('hidden');
    });
  }
  
  /**
   * Updates the password strength meter
   * @param {string} password - The password to evaluate
   */
  static updatePasswordStrength(password) {
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');
    
    const { score, label } = PasswordGenerator.evaluateStrength(password);
    
    // Reset classes
    strengthBar.className = 'strength-bar';
    
    if (score === 0) {
      strengthText.textContent = 'None';
      strengthBar.style.width = '0%';
    } else {
      strengthText.textContent = label;
      strengthBar.style.width = `${score}%`;
      
      if (label === 'Weak') {
        strengthBar.classList.add('strength-weak');
      } else if (label === 'Medium') {
        strengthBar.classList.add('strength-medium');
      } else if (label === 'Strong') {
        strengthBar.classList.add('strength-strong');
      }
    }
  }
  
  /**
   * Clears inputs in the password modal
   */
  static clearModalInputs() {
    document.getElementById('websiteInput').value = '';
    document.getElementById('usernameInput').value = '';
    document.getElementById('passwordInput').value = '';
    this.updatePasswordStrength('');
  }
  
  /**
   * Initializes password list functionality
   * This will be populated dynamically when vault is unlocked
   */
  static initializePasswordList() {
    const passwordsList = document.getElementById('passwordsList');
    const searchInput = document.getElementById('searchPasswords');
    
    // Set up search functionality
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      const items = passwordsList.querySelectorAll('.password-item');
      
      items.forEach(item => {
        const website = item.querySelector('h3').textContent.toLowerCase();
        const username = item.querySelector('p').textContent.toLowerCase();
        
        if (website.includes(query) || username.includes(query)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }
  
  /**
   * Shows a message to the user
   * @param {string} message - The message text
   * @param {string} type - Message type ('success' or 'error')
   * @param {string} elementId - ID of the element to display message in
   */
  static showMessage(message, type = 'success', elementId = 'loginMessage') {
    const messageElement = document.getElementById(elementId);
    messageElement.textContent = message;
    messageElement.className = 'message';
    messageElement.classList.add(type);
    
    // Auto-clear success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        messageElement.textContent = '';
        messageElement.className = 'message';
      }, 3000);
    }
  }
  
  /**
   * Renders password items in the list
   * @param {Array} passwords - Array of password objects
   */
  static renderPasswordList(passwords) {
    const passwordsList = document.getElementById('passwordsList');
    passwordsList.innerHTML = '';
    
    if (passwords.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'No passwords saved yet. Click "Add Password" to get started.';
      passwordsList.appendChild(emptyMessage);
      return;
    }
    
    passwords.forEach((item, index) => {
      const passwordItem = document.createElement('div');
      passwordItem.className = 'password-item';
      passwordItem.dataset.index = index;
      
      const website = document.createElement('h3');
      website.textContent = item.website;
      
      const username = document.createElement('p');
      username.textContent = item.username;
      
      const actions = document.createElement('div');
      actions.className = 'password-actions';
      
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn secondary copy-btn';
      copyBtn.textContent = 'Copy Password';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(item.password)
          .then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
              copyBtn.textContent = 'Copy Password';
            }, 2000);
          });
      });
      
      const editBtn = document.createElement('button');
      editBtn.className = 'btn secondary edit-btn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditModal(item, index);
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn secondary delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete the password for ${item.website}?`)) {
          // Using a custom event to handle deletion in the main app
          document.dispatchEvent(new CustomEvent('deletePassword', { detail: { index } }));
        }
      });
      
      actions.appendChild(copyBtn);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      
      passwordItem.appendChild(website);
      passwordItem.appendChild(username);
      passwordItem.appendChild(actions);
      
      // Add click event to view/edit the password
      passwordItem.addEventListener('click', () => {
        this.openEditModal(item, index);
      });
      
      passwordsList.appendChild(passwordItem);
    });
  }
  
  /**
   * Opens the edit modal for a password
   * @param {Object} passwordItem - The password item object
   * @param {number} index - Index of the password in the array
   */
  static openEditModal(passwordItem, index) {
    const modal = document.getElementById('passwordModal');
    const modalTitle = document.getElementById('modalTitle');
    
    modalTitle.textContent = 'Edit Password';
    
    document.getElementById('websiteInput').value = passwordItem.website;
    document.getElementById('usernameInput').value = passwordItem.username;
    document.getElementById('passwordInput').value = passwordItem.password;
    
    this.updatePasswordStrength(passwordItem.password);
    
    // Set data attribute to know we're editing
    modal.dataset.editing = 'true';
    modal.dataset.editIndex = index;
    
    modal.classList.remove('hidden');
  }
  
  /**
   * Adds AI assistant message to the chat
   * @param {string} message - The message text
   * @param {boolean} isUser - Whether the message is from the user
   */
  static addChatMessage(message, isUser = false) {
    const aiChat = document.getElementById('aiChat');
    const messageElement = document.createElement('div');
    
    messageElement.className = isUser ? 'user-message' : 'ai-message';
    
    // Handle multi-line messages
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageElement.innerHTML = `<p>${formattedMessage}</p>`;
    
    aiChat.appendChild(messageElement);
    
    // Scroll to the latest message
    aiChat.scrollTop = aiChat.scrollHeight;
  }
  
  /**
   * Shows a loading indicator in the chat
   * @returns {Element} - The loading indicator element
   */
  static showChatLoading() {
    const aiChat = document.getElementById('aiChat');
    const loadingElement = document.createElement('div');
    
    loadingElement.className = 'ai-message';
    loadingElement.innerHTML = '<p>...</p>';
    
    aiChat.appendChild(loadingElement);
    aiChat.scrollTop = aiChat.scrollHeight;
    
    return loadingElement;
  }
  
  /**
   * Switches screen (login, setup, vault)
   * @param {string} screenId - ID of the screen to show
   */
  static showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.add('hidden');
    });
    
    // Show requested screen
    document.getElementById(screenId).classList.remove('hidden');
  }
}

// Export the module
window.UIModule = UIModule;