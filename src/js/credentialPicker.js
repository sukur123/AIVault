/**
 * Credential Picker UI Script
 * Provides UI for selecting credentials when multiple matches are found
 */

// Create and inject the credential picker modal
function createCredentialPicker(credentials, autoSubmit) {
  // Remove any existing picker
  removeCredentialPicker();
  
  // Create the modal container
  const modal = document.createElement('div');
  modal.id = 'aivault-credential-picker';
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
  title.textContent = 'Choose Credentials';
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
  closeButton.addEventListener('click', removeCredentialPicker);
  
  header.appendChild(title);
  header.appendChild(closeButton);
  
  // Create the credential list
  const credentialList = document.createElement('div');
  credentialList.style.cssText = `
    padding: 16px;
    overflow-y: auto;
    max-height: 300px;
  `;
  
  credentials.forEach(credential => {
    const credentialItem = document.createElement('div');
    credentialItem.style.cssText = `
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    credentialItem.onmouseover = () => {
      credentialItem.style.backgroundColor = '#f5f5f5';
    };
    credentialItem.onmouseout = () => {
      credentialItem.style.backgroundColor = 'white';
    };
    
    const usernameElement = document.createElement('div');
    usernameElement.textContent = credential.username;
    usernameElement.style.cssText = `
      font-weight: bold;
      margin-bottom: 4px;
    `;
    
    const websiteElement = document.createElement('div');
    websiteElement.textContent = credential.website;
    websiteElement.style.cssText = `
      font-size: 14px;
      color: #666;
    `;
    
    credentialItem.appendChild(usernameElement);
    credentialItem.appendChild(websiteElement);
    
    credentialItem.addEventListener('click', () => {
      // Request the full credentials (including password) from the background script
      chrome.runtime.sendMessage({
        action: 'getSpecificCredential',
        id: credential.id
      }, response => {
        if (response && response.success) {
          // Fill the credentials
          fillCredentials(response.credential.username, response.credential.password, autoSubmit);
        }
        removeCredentialPicker();
      });
    });
    
    credentialList.appendChild(credentialItem);
  });
  
  // Create the footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 12px 16px;
    background-color: #f0f0f0;
    border-top: 1px solid #ddd;
    text-align: right;
  `;
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    padding: 8px 16px;
    background-color: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-left: 8px;
    cursor: pointer;
  `;
  cancelButton.addEventListener('click', removeCredentialPicker);
  
  footer.appendChild(cancelButton);
  
  // Assemble the modal
  modalContent.appendChild(header);
  modalContent.appendChild(credentialList);
  modalContent.appendChild(footer);
  modal.appendChild(modalContent);
  
  // Add click event to close when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      removeCredentialPicker();
    }
  });
  
  // Add keyboard event to close on escape
  document.addEventListener('keydown', handleEscapeKey);
  
  // Add to the DOM
  document.body.appendChild(modal);
}

// Remove the credential picker
function removeCredentialPicker() {
  const existingPicker = document.getElementById('aivault-credential-picker');
  if (existingPicker) {
    document.removeEventListener('keydown', handleEscapeKey);
    existingPicker.remove();
  }
}

// Handle escape key
function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    removeCredentialPicker();
  }
}

// Fill credentials
function fillCredentials(username, password, autoSubmit = false) {
  if (!username || !password) return;
  
  // Find form
  let form = null;
  let usernameField = null;
  let passwordField = null;
  
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
  
  // Try to find the form first by looking for a password field
  for (const selector of passwordSelectors) {
    const passwordFields = document.querySelectorAll(selector);
    
    for (const field of passwordFields) {
      if (isVisible(field) && !isReadOnly(field)) {
        passwordField = field;
        form = field.form || findClosestForm(field);
        break;
      }
    }
    
    if (passwordField) break;
  }
  
  // Now find a username field, preferably in the same form
  for (const selector of usernameSelectors) {
    const usernameFields = document.querySelectorAll(selector);
    
    for (const field of usernameFields) {
      if (isVisible(field) && !isReadOnly(field)) {
        if (!form || (field.form && field.form === form) || isInSameForm(field, passwordField)) {
          usernameField = field;
          if (!form) form = field.form || findClosestForm(field);
          break;
        }
      }
    }
    
    if (usernameField) break;
  }
  
  // Fill the fields if found
  if (usernameField) {
    usernameField.value = username;
    usernameField.dispatchEvent(new Event('input', { bubbles: true }));
    usernameField.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  if (passwordField) {
    passwordField.value = password;
    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    passwordField.dispatchEvent(new Event('change', { bubbles: true }));
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
  
  // Helper function to find closest form ancestor
  function findClosestForm(element) {
    let parent = element.parentElement;
    while (parent) {
      if (parent.tagName === 'FORM') return parent;
      parent = parent.parentElement;
    }
    return null;
  }
  
  // Helper function to check if two elements are in the same form-like container
  function isInSameForm(el1, el2) {
    if (!el1 || !el2) return false;
    
    // Check if they share a common form-like ancestor
    const commonAncestors = ['form', 'div', 'section', 'main'];
    let parent = el1.parentElement;
    
    while (parent) {
      if (commonAncestors.includes(parent.tagName.toLowerCase())) {
        if (parent.contains(el2)) return true;
      }
      parent = parent.parentElement;
    }
    
    return false;
  }
}

// Helper functions
function isVisible(element) {
  return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function isReadOnly(element) {
  return element.readOnly || element.disabled;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showCredentialPicker') {
    createCredentialPicker(message.credentials, message.autoSubmit);
    sendResponse({ success: true });
    return true;
  }
});

// Let the background script know the picker is loaded
chrome.runtime.sendMessage({ action: 'credentialPickerLoaded' });