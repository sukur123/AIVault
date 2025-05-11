/**
 * Content Script for AIVault
 * Handles autofill functionality within web pages
 */

// Queue for pending operations - solves potential race conditions
const operationQueue = {
  pendingOperations: [],
  
  add: function(operation) {
    this.pendingOperations.push(operation);
    this.process();
  },
  
  process: function() {
    if (this.pendingOperations.length > 0) {
      const operation = this.pendingOperations.shift();
      try {
        operation();
      } catch (error) {
        console.error('AIVault: Error processing operation:', error);
      }
      
      // Process next operation on next tick
      setTimeout(() => this.process(), 0);
    }
  }
};

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fillCredentials') {
    const { username, password, autoSubmit } = message.credentials;
    fillCredentials(username, password, autoSubmit);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'detectLoginForm') {
    const formData = detectLoginForm();
    sendResponse({ success: true, formData });
    return true;
  }
  
  if (message.action === 'checkExistingCredentials') {
    // Display save prompt with existing credentials info
    showSavePrompt(message.username, message.password, message.domain, message.exists);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'generatePassword') {
    // Generate password directly in content script
    const password = generateStrongPassword();
    sendResponse({ success: true, password });
    return true;
  }
});

// Initialize content script functionality
function initialize() {
  // Wait a moment for the page to fully render before checking for forms
  setTimeout(() => {
    const formData = detectLoginForm();
    
    if (formData.hasLoginForm) {
      // Notify background script about login form
      chrome.runtime.sendMessage({
        action: 'loginFormFound',
        url: window.location.href,
        formData
      });
      
      // Add autofill buttons to password fields
      addAutofillButtons();
      
      // Add form submission listener to capture credentials
      addFormSubmitListeners();
    }
  }, 1000);
  
  // Check for pending credentials stored in sessionStorage
  checkPendingCredentials();
  
  // Set up mutation observer to detect dynamically added forms
  setupFormObserver();
}

// Add form submission listeners to capture credentials
function addFormSubmitListeners() {
  // Find all forms with password fields
  const passwordFields = document.querySelectorAll('input[type="password"]');
  const processedForms = new Set();
  
  passwordFields.forEach(passwordField => {
    const form = passwordField.closest('form');
    if (form && !processedForms.has(form)) {
      processedForms.add(form);
      
      // Remove any existing listener to avoid duplicates
      form.removeEventListener('submit', handleFormSubmit);
      
      // Add submit event listener
      form.addEventListener('submit', handleFormSubmit);
      
      // Also monitor button clicks that might submit the form
      const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type]), input[type="button"]');
      submitButtons.forEach(button => {
        // Remove any existing listener to avoid duplicates
        button.removeEventListener('click', handleButtonClick);
        
        // Add click event listener
        button.addEventListener('click', handleButtonClick);
      });
    }
  });
  
  // Also add listeners to password fields to capture credentials when they change
  passwordFields.forEach(passwordField => {
    // Remove existing listeners to avoid duplicates
    passwordField.removeEventListener('change', handlePasswordChange);
    
    // Add change event listener
    passwordField.addEventListener('change', handlePasswordChange);
  });
}

// Handle form submission
function handleFormSubmit(e) {
  // Capture credentials before the form submits
  const form = e.target;
  captureCredentials(form);
  
  // Don't prevent default form submission behavior
  // We just want to capture credentials, not interfere with normal login
}

// Handle button clicks that might submit a form
function handleButtonClick(e) {
  // If this is a button click that might submit a form, check for credentials
  const button = e.currentTarget;
  const form = button.closest('form');
  
  // If the button is in a form, try to capture credentials
  if (form) {
    // Set a small timeout to allow any form-specific JS to update field values
    setTimeout(() => {
      captureCredentials(form);
    }, 50);
  }
}

// Handle password field changes
function handlePasswordChange(e) {
  const passwordField = e.currentTarget;
  const form = passwordField.closest('form');
  if (form) {
    // We don't capture immediately on change, as the user might still be typing
    // Set a flag to check after submission instead
    passwordField.dataset.passwordChanged = 'true';
  }
}

// Capture credentials from a form
function captureCredentials(form) {
  if (!form) return;
  
  const passwordField = form.querySelector('input[type="password"]');
  if (!passwordField || !passwordField.value) return;
  
  const usernameField = findUsernameField(form);
  if (!usernameField || !usernameField.value.trim()) return;
  
  const domain = window.location.hostname;
  const username = usernameField.value.trim();
  const password = passwordField.value;
  
  // Check if we should save these credentials
  if (username && password) {
    console.log('AIVault: Captured credentials for', domain); // Debug log
    
    // First check if credentials already exist for this domain
    operationQueue.add(() => {
      chrome.runtime.sendMessage({
        action: 'checkCredentialsExist',
        domain: domain,
        username: username,
        password: password
      }, response => {
        console.log('AIVault: Received response from credential check', response); // Debug log
      });
    });
    
    // Store the credentials temporarily in case the page navigates
    // before we get a response
    try {
      sessionStorage.setItem('aivault_pending_credentials', JSON.stringify({
        domain: domain,
        username: username,
        password: password,
        timestamp: Date.now()
      }));
      console.log('AIVault: Saved pending credentials to sessionStorage'); // Debug log
    } catch (error) {
      console.error('AIVault: Error saving pending credentials:', error);
    }
  }
}

// Helper function to find the username field in a form
function findUsernameField(form) {
  if (!form) return null;
  
  // First look for common username/email field identifiers
  const usernameSelectors = [
    'input[type="email"]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][id*="email" i]',
    'input[type="text"][name*="user" i]',
    'input[type="text"][id*="user" i]',
    'input[type="text"][name*="login" i]',
    'input[type="text"][id*="login" i]',
    'input[type="text"][autocomplete="username"]',
    'input[autocomplete="email"]'
  ];
  
  for (const selector of usernameSelectors) {
    const field = form.querySelector(selector);
    if (field && isVisible(field) && !isReadOnly(field)) {
      return field;
    }
  }
  
  // If no field found by specific selectors, try any text input
  const textInputs = form.querySelectorAll('input[type="text"]');
  for (const input of textInputs) {
    if (isVisible(input) && !isReadOnly(input)) {
      return input;
    }
  }
  
  return null;
}

// Add autofill buttons next to password fields
function addAutofillButtons() {
  const passwordFields = document.querySelectorAll('input[type="password"]');
  
  passwordFields.forEach(field => {
    if (isVisible(field) && !isReadOnly(field)) {
      // Check if button already exists
      const existingButton = field.nextElementSibling;
      if (existingButton && existingButton.classList.contains('aivault-autofill-button')) {
        return;
      }
      
      // Create button container
      const container = document.createElement('div');
      container.className = 'aivault-autofill-button';
      container.style.cssText = `
        position: absolute;
        right: 5px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 9999;
        cursor: pointer;
        width: 20px;
        height: 20px;
        background-color: transparent;
      `;
      
      // Create the button icon
      const icon = document.createElement('div');
      icon.innerHTML = '🔑';
      icon.style.cssText = `
        font-size: 16px;
        line-height: 20px;
        text-align: center;
      `;
      
      // Add tooltip
      icon.title = 'Autofill/Generate password with AIVault';
      
      // Add click handler
      icon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Check if we're in a signup form (no username/email field with value)
        const form = field.closest('form');
        if (form) {
          const usernameField = findUsernameField(form);
          // If username field is empty or not found, we might be in a signup form
          if (!usernameField || !usernameField.value.trim()) {
            // Generate a strong password and fill it
            generateAndFillPassword(field);
            return;
          }
        }
        
        // Otherwise, request credentials for this site (default behavior)
        chrome.runtime.sendMessage({
          action: 'autofillRequested',
          url: window.location.href
        });
      });
      
      container.appendChild(icon);
      
      // Position the button correctly
      const fieldRect = field.getBoundingClientRect();
      const fieldStyle = window.getComputedStyle(field);
      
      // Position the container relative to the field
      const fieldParent = field.parentElement;
      if (fieldParent.style.position === 'static' || !fieldParent.style.position) {
        fieldParent.style.position = 'relative';
      }
      
      // Adjust field padding to prevent overlap
      if (parseInt(fieldStyle.paddingRight) < 30) {
        field.style.paddingRight = '30px';
      }
      
      // Add the button next to the field
      field.insertAdjacentElement('afterend', container);
    }
  });
}

// Generate a strong password and fill it into the field
function generateAndFillPassword(passwordField) {
  // Request password generation from background script
  chrome.runtime.sendMessage({ 
    action: 'generatePassword',
    options: { 
      length: 16,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true
    }
  }, response => {
    if (response && response.success && response.password) {
      // Fill the generated password
      passwordField.value = response.password;
      passwordField.dispatchEvent(new Event('input', { bubbles: true }));
      passwordField.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Show a small notification
      showPasswordGeneratedNotification(passwordField, response.password);
    } else {
      // If background script didn't generate a password, generate one directly
      try {
        // Attempt to use PasswordGenerator if available
        const generatedPassword = generateStrongPassword();
        passwordField.value = generatedPassword;
        passwordField.dispatchEvent(new Event('input', { bubbles: true }));
        passwordField.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Show a small notification
        showPasswordGeneratedNotification(passwordField, generatedPassword);
      } catch (error) {
        console.error('AIVault: Error generating password:', error);
      }
    }
  });
}

// Generate a strong password directly in the content script
function generateStrongPassword() {
  // Use a simplified version if PasswordGenerator is not available
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  let password = '';
  
  // Ensure at least one of each type
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += symbols.charAt(Math.floor(Math.random() * symbols.length));
  
  // Fill up to 16 characters
  for (let i = 4; i < 16; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle the password characters
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// Show a small notification when password is generated
function showPasswordGeneratedNotification(passwordField, password) {
  const notification = document.createElement('div');
  notification.className = 'aivault-notification';
  notification.textContent = 'Strong password generated!';
  notification.style.cssText = `
    position: absolute;
    background-color: #4B70E2;
    color: white;
    padding: 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: opacity 0.3s;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;
  
  // Position the notification
  const fieldRect = passwordField.getBoundingClientRect();
  document.body.appendChild(notification);
  
  // Position below the password field
  notification.style.left = `${fieldRect.left}px`;
  notification.style.top = `${fieldRect.bottom + 5}px`;
  
  // Add copy button
  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy';
  copyButton.style.cssText = `
    margin-left: 8px;
    padding: 2px 4px;
    background: white;
    border: none;
    border-radius: 2px;
    color: #4B70E2;
    cursor: pointer;
    font-family: inherit;
  `;
  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(password)
      .then(() => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 1500);
      })
      .catch(err => console.error('Failed to copy password: ', err));
  });
  
  notification.appendChild(copyButton);
  
  // Remove after 5 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

/**
 * Detects login forms on the current page
 * @returns {Object} - Object containing form detection data
 */
function detectLoginForm() {
  // Check for password fields
  const passwordFields = document.querySelectorAll('input[type="password"]');
  if (passwordFields.length === 0) {
    return { hasLoginForm: false };
  }
  
  // Get the form containing the password field
  const passwordField = passwordFields[0];
  const form = passwordField.closest('form');
  
  // Try to identify the username field
  let usernameField = null;
  if (form) {
    // Look for email or text inputs in the same form
    const potentialUsernameFields = form.querySelectorAll('input[type="email"], input[type="text"]');
    if (potentialUsernameFields.length > 0) {
      // Use the first visible field as the username field
      for (const field of potentialUsernameFields) {
        if (isVisible(field) && !isReadOnly(field)) {
          usernameField = field;
          break;
        }
      }
    }
  }
  
  // Determine the domain from the URL
  const domain = new URL(window.location.href).hostname;
  
  return { 
    hasLoginForm: true,
    domain,
    hasForm: !!form,
    hasUsernameField: !!usernameField,
    isSignupForm: !usernameField || !usernameField.value
  };
}

/**
 * Fills credentials into detected form fields
 * @param {string} username - Username to fill
 * @param {string} password - Password to fill
 * @param {boolean} autoSubmit - Whether to auto-submit the form
 */
function fillCredentials(username, password, autoSubmit = false) {
  // Find username/email fields
  const usernameSelectors = [
    'input[type="email"]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][id*="email" i]',
    'input[type="text"][name*="user" i]',
    'input[type="text"][id*="user" i]',
    'input[type="text"][name*="login" i]',
    'input[type="text"][id*="login" i]',
    'input[type="text"][autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[type="text"]'
  ];
  
  // Find password fields
  const passwordSelectors = [
    'input[type="password"]'
  ];
  
  let usernameField = null;
  let passwordField = null;
  let form = null;
  
  // Try to find and fill username field
  for (const selector of usernameSelectors) {
    const usernameFields = document.querySelectorAll(selector);
    if (usernameFields.length > 0) {
      // Fill the first one we find
      for (const field of usernameFields) {
        if (isVisible(field) && !isReadOnly(field)) {
          field.value = username;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          usernameField = field;
          break;
        }
      }
      if (usernameField) break;
    }
  }
  
  // Try to find and fill password field
  for (const selector of passwordSelectors) {
    const passwordFields = document.querySelectorAll(selector);
    if (passwordFields.length > 0) {
      // Fill the first one we find
      for (const field of passwordFields) {
        if (isVisible(field) && !isReadOnly(field)) {
          field.value = password;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          passwordField = field;
          
          // Store the form for potential submission
          form = field.closest('form');
          break;
        }
      }
      if (passwordField) break;
    }
  }
  
  // Auto-submit if requested and a form was found
  if (autoSubmit && form) {
    setTimeout(() => {
      // Look for submit buttons
      const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]');
      if (submitButtons.length > 0) {
        // Click the first submit button
        submitButtons[0].click();
      } else {
        // If no submit button, try to submit the form directly
        try {
          form.submit();
        } catch (e) {
          console.error("Error submitting form:", e);
        }
      }
    }, 500); // Small delay to ensure values are properly set
  }
}

/**
 * Checks if an element is visible
 * @param {Element} element - The element to check
 * @returns {boolean} - True if the element is visible
 */
function isVisible(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetWidth > 0 && 
         element.offsetHeight > 0;
}

/**
 * Checks if an element is read-only
 * @param {Element} element - The element to check
 * @returns {boolean} - True if the element is read-only
 */
function isReadOnly(element) {
  return element.readOnly || element.disabled;
}

/**
 * Shows a save prompt to store credentials
 * @param {string} username - The captured username
 * @param {string} password - The captured password
 * @param {string} domain - The current domain
 * @param {boolean} exists - Whether credentials already exist for this domain
 */
function showSavePrompt(username, password, domain, exists = false) {
  // Remove any existing prompt
  removeCredentialPrompt();
  
  // Create the modal container
  const modal = document.createElement('div');
  modal.id = 'aivault-credential-prompt';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 99999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;
  
  // Create the modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    width: 350px;
    max-width: 90%;
    max-height: 90%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;
  
  // Create the header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px;
    background-color: #f0f0f0;
    border-bottom: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  
  const title = document.createElement('h2');
  title.textContent = exists ? 'Update Password?' : 'Save Password?';
  title.style.cssText = `
    margin: 0;
    font-size: 18px;
    color: #333;
  `;
  
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.cssText = `
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
  `;
  closeButton.addEventListener('click', removeCredentialPrompt);
  
  header.appendChild(title);
  header.appendChild(closeButton);
  
  // Create the form content
  const content = document.createElement('div');
  content.style.cssText = `
    padding: 16px;
  `;
  
  const message = document.createElement('p');
  if (exists) {
    message.textContent = `A password for ${domain} already exists. Would you like to update it?`;
  } else {
    message.textContent = `Would you like to save this password for ${domain}?`;
  }
  message.style.cssText = `
    margin: 0 0 16px 0;
  `;
  
  const usernameLabel = document.createElement('label');
  usernameLabel.textContent = 'Username:';
  usernameLabel.style.cssText = `
    display: block;
    margin-bottom: 4px;
    font-weight: bold;
  `;
  
  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.value = username;
  usernameInput.style.cssText = `
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 16px;
    box-sizing: border-box;
  `;
  
  const passwordLabel = document.createElement('label');
  passwordLabel.textContent = 'Password:';
  passwordLabel.style.cssText = `
    display: block;
    margin-bottom: 4px;
    font-weight: bold;
  `;
  
  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.value = password;
  passwordInput.readOnly = true;
  passwordInput.style.cssText = `
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 16px;
    box-sizing: border-box;
    background-color: #f9f9f9;
  `;
  
  const togglePasswordBtn = document.createElement('button');
  togglePasswordBtn.textContent = 'Show';
  togglePasswordBtn.style.cssText = `
    padding: 4px 8px;
    background-color: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 16px;
    font-family: inherit;
  `;
  togglePasswordBtn.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      togglePasswordBtn.textContent = 'Hide';
    } else {
      passwordInput.type = 'password';
      togglePasswordBtn.textContent = 'Show';
    }
  });
  
  const dontAskCheck = document.createElement('input');
  dontAskCheck.type = 'checkbox';
  dontAskCheck.id = 'aivault-dont-ask';
  dontAskCheck.style.cssText = `
    margin-right: 8px;
  `;
  
  const dontAskLabel = document.createElement('label');
  dontAskLabel.textContent = `Don't ask for ${domain}`;
  dontAskLabel.htmlFor = 'aivault-dont-ask';
  dontAskLabel.style.cssText = `
    font-size: 14px;
  `;
  
  const dontAskContainer = document.createElement('div');
  dontAskContainer.style.cssText = `
    display: flex;
    align-items: center;
    margin-bottom: 16px;
  `;
  dontAskContainer.appendChild(dontAskCheck);
  dontAskContainer.appendChild(dontAskLabel);
  
  content.appendChild(message);
  content.appendChild(usernameLabel);
  content.appendChild(usernameInput);
  content.appendChild(passwordLabel);
  content.appendChild(passwordInput);
  content.appendChild(togglePasswordBtn);
  content.appendChild(dontAskContainer);
  
  // Create the footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 12px 16px;
    background-color: #f0f0f0;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: flex-end;
  `;
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    padding: 8px 16px;
    background-color: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-right: 8px;
    cursor: pointer;
    font-family: inherit;
  `;
  cancelButton.addEventListener('click', removeCredentialPrompt);
  
  const saveButton = document.createElement('button');
  saveButton.textContent = exists ? 'Update' : 'Save';
  saveButton.style.cssText = `
    padding: 8px 16px;
    background-color: #4B70E2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
  `;
  saveButton.addEventListener('click', () => {
    const updatedUsername = usernameInput.value.trim();
    const dontAsk = dontAskCheck.checked;
    
    if (!updatedUsername) {
      // Show error for empty username
      alert('Username cannot be empty');
      return;
    }
    
    // Send message to background script to save the credentials
    chrome.runtime.sendMessage({
      action: 'saveCredentials',
      domain: domain,
      username: updatedUsername,
      password: password,
      dontAskAgain: dontAsk,
      exists: exists
    }, response => {
      if (response && response.success) {
        // Show success notification
        const notification = document.createElement('div');
        notification.textContent = exists ? 'Password updated successfully!' : 'Password saved successfully!';
        notification.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background-color: #4CAF50;
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          z-index: 99999;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        `;
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => notification.remove(), 3000);
      }
      
      removeCredentialPrompt();
    });
  });
  
  footer.appendChild(cancelButton);
  footer.appendChild(saveButton);
  
  // Assemble the modal
  modalContent.appendChild(header);
  modalContent.appendChild(content);
  modalContent.appendChild(footer);
  modal.appendChild(modalContent);
  
  // Add click event to close when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      removeCredentialPrompt();
    }
  });
  
  // Add keyboard event to close on escape
  document.addEventListener('keydown', handlePromptEscapeKey);
  
  // Add to the DOM
  document.body.appendChild(modal);
}

// Remove the credential prompt
function removeCredentialPrompt() {
  const existingPrompt = document.getElementById('aivault-credential-prompt');
  if (existingPrompt) {
    document.removeEventListener('keydown', handlePromptEscapeKey);
    existingPrompt.remove();
  }
}

// Handle escape key for the credential prompt
function handlePromptEscapeKey(e) {
  if (e.key === 'Escape') {
    removeCredentialPrompt();
  }
}

// Check for pending credentials
function checkPendingCredentials() {
  try {
    const pendingCredentialsJson = sessionStorage.getItem('aivault_pending_credentials');
    if (pendingCredentialsJson) {
      const pendingCredentials = JSON.parse(pendingCredentialsJson);
      
      // Only process if the credentials are recent (within last 30 seconds)
      const now = Date.now();
      if (now - pendingCredentials.timestamp < 30000) {
        operationQueue.add(() => {
          chrome.runtime.sendMessage({
            action: 'checkCredentialsExist',
            domain: pendingCredentials.domain,
            username: pendingCredentials.username,
            password: pendingCredentials.password,
            fromPending: true
          });
        });
      }
      
      // Clear the pending credentials
      sessionStorage.removeItem('aivault_pending_credentials');
    }
  } catch (error) {
    console.error('Error processing pending credentials:', error);
  }
}

// Set up mutation observer to detect dynamically added forms
function setupFormObserver() {
  // Observer for new forms
  const observer = new MutationObserver(mutations => {
    let shouldUpdateForms = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a form or contains forms
            if (node.tagName === 'FORM' || node.querySelector('form') || node.querySelector('input[type="password"]')) {
              shouldUpdateForms = true;
              break;
            }
          }
        }
        
        if (shouldUpdateForms) break;
      }
    }
    
    if (shouldUpdateForms) {
      // Debounce the update to avoid too many operations
      clearTimeout(window._aivaultFormUpdateTimeout);
      window._aivaultFormUpdateTimeout = setTimeout(() => {
        addAutofillButtons();
        addFormSubmitListeners();
      }, 500);
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Add context menu for autofill when right-clicking on password fields
document.addEventListener('contextmenu', function(e) {
  if (e.target.nodeName === 'INPUT' && 
      (e.target.type === 'password' || 
       e.target.type === 'email' || 
       e.target.type === 'text')) {
    chrome.runtime.sendMessage({ 
      action: 'showAutofillContextMenu',
      url: window.location.href
    });
  }
});

// Listen for password field focus to show autofill icon
document.addEventListener('focusin', function(e) {
  if (e.target.nodeName === 'INPUT' && 
      (e.target.type === 'password' || 
       e.target.type === 'email' || 
       e.target.getAttribute('autocomplete') === 'username')) {
    
    // Notify background script about focused field
    chrome.runtime.sendMessage({
      action: 'passwordFieldFocused',
      url: window.location.href
    });
    
    // Add autofill buttons
    addAutofillButtons();
  }
});

// Initialize the content script
initialize();