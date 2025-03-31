// Helper: Compute a unique XPath for an element.
function getXPath(element) {
    if (element.id !== '') {
      return "//*[@id='" + element.id + "']";
    }
    if (element === document.body) {
      return '/html/body';
    }
    var ix = 0;
    var siblings = element.parentNode ? element.parentNode.childNodes : [];
    for (var i = 0; i < siblings.length; i++) {
      var sibling = siblings[i];
      if (sibling === element) {
        return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
}

let formMapping = {};

// Add tracking variables
let hasAutoFilled = false;
let isAutoFilling = false;
let lastUrl = window.location.href;
let isUserInteracting = false;

// Add these variables to the top of your file
let hasCheckedInvertedMapping = false;
let hasInvertedMapping = false;
let formSubmitButtons = [];
let formNavigationButtons = [];

// Set manual mode to disable automatic capturing and filling
const manualModeOnly = true;

// Create UI for capture and autofill buttons
function createButtonUI() {
    // Create container for buttons
    const container = document.createElement('div');
    container.id = 'efficient-extension-buttons';
    Object.assign(container.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: '9999',
        display: 'flex',
        gap: '10px',
        padding: '8px',
        borderRadius: '8px',
        background: 'rgba(255, 255, 255, 0.9)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(5px)',
        transition: 'all 0.3s ease',
        transform: 'scale(0.7)', // Initially smaller
        opacity: '0.8',          // Initially semi-transparent
        transformOrigin: 'top right'
    });

    // Create a toggle button to show/hide
    const toggleButton = document.createElement('div');
    toggleButton.id = 'efficient-toggle-btn';
    
    // Add beautiful toggle icon using SVG
    toggleButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
    `;
    
    Object.assign(toggleButton.style, {
        position: 'absolute',
        top: '-10px',
        left: '-10px',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: '#333',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        cursor: 'pointer',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
        transition: 'transform 0.3s ease',
        zIndex: '10000',
        border: '2px solid white'
    });

    // Create capture button
    const captureButton = document.createElement('button');
    captureButton.id = 'efficient-capture-btn';
    
    // Add beautiful save/capture icon using SVG and text
    captureButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Capture
    `;
    
    Object.assign(captureButton.style, {
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        background: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
        color: 'white',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    });
    
    // Create autofill button
    const autofillButton = document.createElement('button');
    autofillButton.id = 'efficient-autofill-btn';
    
    // Add beautiful autofill icon using SVG and text
    autofillButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>
        Autofill
    `;
    
    Object.assign(autofillButton.style, {
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        background: 'linear-gradient(135deg, #2196F3, #0D47A1)',
        color: 'white',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    });

    // Hover effects for container
    container.addEventListener('mouseenter', () => {
        container.style.transform = 'scale(1)';
        container.style.opacity = '1';
    });
    
    container.addEventListener('mouseleave', () => {
        container.style.transform = 'scale(0.7)';
        container.style.opacity = '0.8';
    });

    // Hover effects for buttons
    captureButton.addEventListener('mouseover', () => {
        captureButton.style.transform = 'scale(1.05)';
        captureButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    });
    captureButton.addEventListener('mouseout', () => {
        captureButton.style.transform = 'scale(1)';
        captureButton.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    });
    
    autofillButton.addEventListener('mouseover', () => {
        autofillButton.style.transform = 'scale(1.05)';
        autofillButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    });
    autofillButton.addEventListener('mouseout', () => {
        autofillButton.style.transform = 'scale(1)';
        autofillButton.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    });

    // Toggle button functionality
    let isCollapsed = false;
    toggleButton.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        if (isCollapsed) {
            captureButton.style.display = 'none';
            autofillButton.style.display = 'none';
            container.style.padding = '4px';
            container.style.background = 'rgba(255, 255, 255, 0.7)';
            toggleButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    <line x1="12" y1="11" x2="12" y2="17"></line>
                    <line x1="9" y1="14" x2="15" y2="14"></line>
                </svg>
            `;
        } else {
            captureButton.style.display = '';
            autofillButton.style.display = '';
            container.style.padding = '8px';
            container.style.background = 'rgba(255, 255, 255, 0.9)';
            toggleButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            `;
        }
    });

    // Add event listeners
    captureButton.addEventListener('click', () => {
        console.log('Hard capture triggered');
        // Add active visual effect
        captureButton.style.transform = 'scale(0.95)';
        setTimeout(() => captureButton.style.transform = 'scale(1)', 200);
        
        forceCaptureFormData();
    });
    
    autofillButton.addEventListener('click', () => {
        console.log('Hard autofill triggered');
        // Add active visual effect
        autofillButton.style.transform = 'scale(0.95)';
        setTimeout(() => autofillButton.style.transform = 'scale(1)', 200);
        
        hasAutoFilled = false;
        autoFillForm().then((success) => {
            // Show success notification
            if (success) {
                showToast('Form autofilled!', '#2196F3');
            } else {
                showToast('No data available for autofill', '#FF9800');
            }
        }).catch(error => {
            console.error('Error autofilling form:', error);
            showToast('Error autofilling form', '#F44336');
        });
    });

    // Add buttons to container
    container.appendChild(captureButton);
    container.appendChild(autofillButton);
    container.appendChild(toggleButton);
    
    // Add container to body
    document.body.appendChild(container);
    
    // Initially show full UI for a few seconds, then minimize
    setTimeout(() => {
        if (!container.matches(':hover')) {
            container.style.transform = 'scale(0.7)';
            container.style.opacity = '0.8';
        }
    }, 3000);
}

// Function to force capture all form data on the page
function forceCaptureFormData() {
    isUserInteracting = true;
    formMapping = {};
    
    const formElements = document.querySelectorAll('input, textarea, select');
    let capturedCount = 0;
    
    formElements.forEach(element => {
        if (element.id || element.name) {
            captureValue(element);
            capturedCount++;
        }
    });
    
    // Also capture custom React-Select components
    captureCustomSelectComponents();
    
    // Show feedback toast
    showToast(`${capturedCount} form fields captured!`, '#4CAF50');
}

// Function to capture custom select components (like React-Select)
function captureCustomSelectComponents() {
    // Find all React-Select and similar custom dropdown components
    const customSelects = Array.from(document.querySelectorAll(
        // React-Select selectors
        '.select__control, [class*="select-container"], [class*="css-"][role="combobox"], ' +
        // Other common custom select implementations
        '[role="listbox"], [aria-haspopup="listbox"], ' + 
        '.custom-select, .dropdown, [data-value]'
    )).filter(el => {
        // Verify it's not just a container for a standard select
        const hasStandardSelect = el.querySelector('select');
        return !hasStandardSelect && isVisible(el);
    });
    
    console.log(`Found ${customSelects.length} custom select components`);
    
    customSelects.forEach(select => {
        try {
            // Try to find the visible value
            let selectedValue = '';
            
            // Look for common patterns to find selected value
            const valueContainer = select.querySelector(
                '.select__value-container, .select__single-value, [class*="singleValue"], ' +
                '.selected-option, .dropdown-value, [class*="valueContainer"]'
            );
            
            if (valueContainer && valueContainer.textContent.trim() !== '' && 
                !valueContainer.textContent.includes('Select...')) {
                selectedValue = valueContainer.textContent.trim();
            }
            
            // Find the label for this select component
            let label = '';
            
            // Try to find associated label
            const parent = findParentWithClass(select, 'select, form-group, form-field, field');
            if (parent) {
                const labelEl = parent.querySelector('label');
                if (labelEl) {
                    label = labelEl.textContent.trim().replace(/\*$/, ''); // Remove trailing asterisk
                }
            }
            
            // If we found both label and value, store them
            if (label && selectedValue) {
                // Use the label as the key in our mapping
                console.log(`Captured custom select: ${label} = ${selectedValue}`);
                // Also store with XPath as backup
                const xpath = getXPath(select);
                formMapping[`custom_select:${label}`] = selectedValue;
                formMapping[xpath] = selectedValue;
            } else if (selectedValue) {
                // Just use XPath if no label found
                const xpath = getXPath(select);
                console.log(`Captured custom select with XPath: ${xpath} = ${selectedValue}`);
                formMapping[xpath] = selectedValue;
            }
        } catch (e) {
            console.error('Error capturing custom select:', e);
        }
    });
}

// Helper to find parent with specified classes
function findParentWithClass(element, classNames) {
    const classes = classNames.split(',').map(cls => cls.trim());
    let current = element;
    
    while (current && current !== document.body) {
        for (const cls of classes) {
            if (current.classList.contains(cls) || 
                current.className.includes(cls) ||
                (current.getAttribute('class') || '').includes(cls)) {
                return current;
            }
        }
        current = current.parentElement;
    }
    
    return null;
}

// Helper to check if element is visible
function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

// Show toast notification
function showToast(message, color) {
    const toast = document.createElement('div');
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '12px 20px',
        background: color,
        color: 'white',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        zIndex: '10000',
        opacity: '0',
        transition: 'opacity 0.3s ease'
    });
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Fade in
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    // Fade out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Initialize UI when DOM is loaded
function initializeUI() {
    if (!document.getElementById('efficient-extension-buttons')) {
        createButtonUI();
    }
}

// Add MutationObserver to handle dynamic content
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // ELEMENT_NODE
                attachEventListeners(node);
            }
        });
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Attach events to form elements - modified to respect manual mode
function attachEventListeners(root) {
    if (manualModeOnly) return; // Skip automatic event attachment in manual mode
    
    const formElements = root.querySelectorAll('input, textarea, select');
    formElements.forEach(element => {
        element.addEventListener('input', handleFormEvent);
        element.addEventListener('change', handleFormEvent);
        element.addEventListener('blur', handleFormEvent);
    });
}

// Handle iframes
function handleIframes() {
    const iframes = document.getElementsByTagName('iframe');
    Array.from(iframes).forEach(iframe => {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            attachEventListeners(iframeDoc);
            observer.observe(iframeDoc.body, {
                childList: true,
                subtree: true
            });
        } catch (e) {
            console.log('Cannot access iframe:', e);
        }
    });
}

// Retry helper function with exponential backoff
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            retries++;
            if (retries === maxRetries) throw error;
            await new Promise(resolve => 
                setTimeout(resolve, Math.pow(2, retries) * 1000)
            );
        }
    }
}

// Initialize with progressive delay - disabled in manual mode
let attempts = 0;
const maxAttempts = 5;

function initializeWithRetry() {
    if (manualModeOnly) return; // Skip in manual mode
    
    if (attempts >= maxAttempts) return;
    
    setTimeout(async () => {
        try {
            await autoFillForm();
        } catch (error) {
            attempts++;
            initializeWithRetry();
        }
    }, Math.pow(2, attempts) * 1000);
}


function captureValue(element) {
    // Only capture if we're not autofilling and no mapping exists
    // In manual mode, we skip automatic form data capture checks
    if (!manualModeOnly && (!isUserInteracting || isAutoFilling || hasInvertedMapping)) return;
    
    const xpath = getXPath(element);
    let value;

    switch(element.type) {
        case 'checkbox':
            value = element.checked;
            break;
        case 'radio':
            value = element.checked ? element.value : null;
            break;
        case 'select-multiple':
            value = Array.from(element.selectedOptions).map(option => option.value);
            break;
        default:
            value = element.value;
    }

    if (value !== null) {
        formMapping[xpath] = value;
        console.log('Captured:', xpath, value);
        debounceSendMapping();
    }
}

// Listen for all relevant form events - modified for manual mode
function setupFormEventListeners() {
    if (manualModeOnly) return; // Skip in manual mode
    
document.addEventListener('input', handleFormEvent);
document.addEventListener('change', handleFormEvent);
}

function handleFormEvent(event) {
    isUserInteracting = true;
    const target = event.target;
    if (!['input', 'textarea', 'select'].includes(target.tagName.toLowerCase())) {
        return;
    }
    captureValue(target);
}

let debounceTimeout;
function debounceSendMapping() {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(sendMappingToBackend, 2000);
}

// Update sendMappingToBackend function
function sendMappingToBackend() {
    chrome.storage.sync.get(['userEmail'], function(result) {
        if (!result.userEmail) {
            console.error('User not logged in');
            return;
        }else{
            console.log('User logged in:', result.userEmail);
        }


        const payload = {
            url: window.location.href,
            mapping: formMapping,
            user_email: result.userEmail
        };

        fetch('http://localhost:5001/api/mapping', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'include',
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            console.log('Mapping saved:', data);
        })
        .catch(error => {
            console.error('Error saving mapping:', error);
        });
    });
}

// Updated autoFillForm function to return a promise
window.autoFillForm = async function() {
    if (hasAutoFilled || isAutoFilling) return Promise.resolve(false);
    
    try {
        const userEmail = await new Promise(resolve => {
            chrome.storage.sync.get(['userEmail'], result => {
                resolve(result.userEmail);
            });
        });

        if (!userEmail) {
            console.error('User not logged in');
            return Promise.resolve(false);
        }

        isAutoFilling = true;
        const url = `http://localhost:5001/api/inverted-mapping?url=${encodeURIComponent(window.location.href)}`;
        const response = await fetchWithRetry(url);
        const data = await response.json();

        const url_profile = `http://localhost:5001/api/profile?email=${encodeURIComponent(userEmail)}`;
        const response_profile = await fetchWithRetry(url_profile);
        const data_profile = await response_profile.json();
        if(data_profile){
            
            if (data && data.mapping) {
                console.log('Auto-filling form inverted:', data.mapping);

                const new_mapping = createInvertedMappingForAuto(data, data_profile);
                console.log('Auto-filling form new generated:', new_mapping.mapping);
                const entries = Object.entries(new_mapping.mapping);
                for (const [xpath, value] of entries) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    fillElement(xpath, value);
                }
                hasAutoFilled = true;
                return Promise.resolve(true);
            }
        }
        return Promise.resolve(false);
    } catch (error) {
        console.error('Error fetching mapping:', error);
        return Promise.reject(error);
    } finally {
        isAutoFilling = false;
    }
}

// Enhanced fillElement function to handle complex custom dropdowns
window.fillElement = fillElement;
window.createInvertedMappingForAuto = createInvertedMappingForAuto;

function fillElement(xpath, value) {
    const element = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
    ).singleNodeValue;

    if (!element) {
        console.log('Element not found:', xpath);
        
        // Try to find custom selects by label if XPath fails
        if (xpath.includes('custom_select:')) {
            const label = xpath.replace('custom_select:', '');
            fillCustomSelectByLabel(label, value);
            return;
        }
        return;
    }

    try {
        // Check if this is a custom select component
        if (element.classList.contains('select__control') || 
            element.getAttribute('role') === 'combobox' ||
            element.classList.contains('select-container') ||
            xpath.includes('select') || xpath.includes('dropdown')) {
            
            fillCustomSelect(element, value);
            return;
        }
        
        switch(element.tagName.toLowerCase()) {
            case 'input':
                switch(element.type) {
                    case 'checkbox':
                    case 'radio':
                        element.checked = value;
                        break;
                    // Handle searchbox/autocomplete inputs
                    case 'search':
                        element.value = value;
                        // Focus the element first
                        element.focus();
                        // Wait briefly before simulating typing
                        setTimeout(() => {
                            // Simulate typing by triggering input events
                            element.value = value;
                            element.dispatchEvent(new Event('input', { bubbles: true }));
                            element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
                            // After typing, trigger search/enter
                            setTimeout(() => {
                                element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                            }, 300);
                        }, 100);
                        break;
                    default:
                        element.value = value;
                }
                break;
            case 'select':
                // Handle standard select dropdowns
                element.value = value;
                
                // If no option was selected (value not found), try matching by text
                if (element.value !== value) {
                    for (let i = 0; i < element.options.length; i++) {
                        if (element.options[i].text.toLowerCase().includes(String(value).toLowerCase())) {
                            element.selectedIndex = i;
                            element.value = element.options[i].value;
                            break;
                        }
                    }
                }
                break;
            // Handle custom dropdown elements
            case 'div':
            case 'span':
                if (element.getAttribute('role') === 'combobox' || 
                    element.classList.contains('dropdown') || 
                    element.classList.contains('select')) {
                    fillCustomSelect(element, value);
                    return;
                } else {
                    // For other div/span elements, try setting innerText
                    element.innerText = value;
                }
                break;
            default:
                element.value = value;
        }

        // Trigger events for all elements
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        
    } catch (error) {
        console.error('Error filling element:', xpath, error);
    }
}

// Function to fill custom select components (React-Select, etc)
function fillCustomSelect(element, value) {
    console.log('Filling custom select component with:', value);
    
    try {
        // First find the actual clickable control element
        let controlElement = element;
        
        // If we're not already at the control element, find it
        if (!element.classList.contains('select__control') && !element.getAttribute('role') === 'combobox') {
            controlElement = element.querySelector('.select__control, [role="combobox"], .dropdown-toggle, .select-toggle');
        }
        
        if (!controlElement) {
            // Try to search up the tree for parent with select__control
            controlElement = findParentWithClass(element, 'select__control, select-shell, remix-css-b62m3t-container');
            
            // If still not found, try to find any parent with 'select' in the class name
            if (!controlElement) {
                let current = element;
                while (current && current !== document.body) {
                    if (current.className && current.className.includes && 
                        (current.className.includes('select') || current.className.includes('Select'))) {
                        controlElement = current;
                        break;
                    }
                    current = current.parentElement;
                }
            }
            
            // If we found a parent container, now try to find the actual control inside it
            if (controlElement) {
                const nestedControl = controlElement.querySelector('.select__control, [role="combobox"]');
                if (nestedControl) {
                    controlElement = nestedControl;
                }
            }
        }
        
        if (!controlElement) {
            console.error('Could not find control element for custom select');
            return;
        }
        
        // Check if the dropdown is already open (menu is visible)
        const isMenuOpen = document.querySelector('.select__menu, .select__menu-list, [role="listbox"]');
        
        if (!isMenuOpen) {
            // 1. Click to open the dropdown
            controlElement.click();
            console.log('Clicked select control to open dropdown');
        } else {
            console.log('Menu is already open, proceeding with selection');
        }
        
        // 2. Wait for dropdown to open, then find and click the matching option
        setTimeout(() => {
            // Look specifically for options in React-Select components first
            let options = [];
            
            // Try React-Select specific selectors first
            const reactSelectOptions = document.querySelectorAll(
                '.select__option, [id^="react-select"][role="option"], ' +
                '[class*="remix-css"][role="option"], [class*="select__option"]'
            );
            
            if (reactSelectOptions.length > 0) {
                options = Array.from(reactSelectOptions);
                console.log(`Found ${options.length} React-Select options`);
            } else {
                // Fallback to other common dropdown patterns
                const menuSelectors = [
                    '.select__menu-list > div', '[class*="menu"] > div', '[class*="option"]',
                    '.dropdown-item', '.select-option', '[role="option"]', '[role="menuitem"]',
                    '[role="listbox"] > *', '.list-item'
                ];
                
                // Query all potential option elements
                for (const selector of menuSelectors) {
                    const found = document.querySelectorAll(selector);
                    if (found.length > 0) {
                        options = Array.from(found);
                        console.log(`Found ${options.length} options with selector: ${selector}`);
                        break;
                    }
                }
            }
            
            if (options.length === 0) {
                console.error('No dropdown options found');
                // Try clicking again on the control as fallback
                controlElement.click();
                return;
            }
            
            // Log all options for debugging
            options.forEach((opt, idx) => {
                console.log(`Option ${idx}: ${opt.textContent.trim()}`);
            });
            
            // Find the option with matching text
            const matchingOption = options.find(option => {
                const optionText = option.textContent.trim().toLowerCase();
                const targetValue = String(value).toLowerCase();
                return optionText === targetValue || optionText.includes(targetValue) || targetValue.includes(optionText);
            });
            
            if (matchingOption) {
                console.log('Found matching option:', matchingOption.textContent);
                
                // Scroll the option into view if possible
                if (matchingOption.scrollIntoView) {
                    matchingOption.scrollIntoView({ block: 'nearest' });
                }
                
                // Ensure option has focus before clicking (for React-Select)
                if (matchingOption.focus) {
                    matchingOption.focus();
                }
                
                // Click the option and trigger proper React events
                matchingOption.click();
                
                // Simulate React synthetic events for better compatibility
                matchingOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                matchingOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                
                // Dispatch a custom event React-Select might listen for
                const reactSelectEvent = new CustomEvent('reactSelectOptionSelected', { 
                    detail: { value, option: matchingOption }, 
                    bubbles: true 
                });
                matchingOption.dispatchEvent(reactSelectEvent);
                
                // React-Select sometimes needs an input change event on the parent control
                if (controlElement) {
                    const input = controlElement.querySelector('input');
                    if (input) {
                        input.value = value;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            } else {
                console.error('No matching option found for value:', value);
                
                // Try direct text input as fallback for React-Select
                const input = controlElement.querySelector('input');
                if (input) {
                    console.log('Attempting to set input value directly:', value);
                    input.value = value;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                }
                
                // Close the dropdown by clicking elsewhere
                document.body.click();
            }
        }, 300);
    } catch (e) {
        console.error('Error filling custom select:', e);
    }
}

// Find and fill custom select by label text
function fillCustomSelectByLabel(label, value) {
    console.log(`Looking for custom select with label: ${label}`);
    
    // Find all labels with matching text
    const labels = Array.from(document.querySelectorAll('label')).filter(
        el => el.textContent.trim().toLowerCase().includes(label.toLowerCase())
    );
    
    if (labels.length === 0) {
        console.error(`No label found matching: ${label}`);
        
        // Try an alternative approach - looking for elements with ID containing the label text
        const labelWords = label.toLowerCase().split(/\s+/);
        const possibleIds = Array.from(document.querySelectorAll('[id*="label"], [id*="month"], [id*="date"], [id*="select"]'))
            .filter(el => {
                const idLower = el.id.toLowerCase();
                return labelWords.some(word => word.length > 2 && idLower.includes(word));
            });
        
        if (possibleIds.length > 0) {
            console.log(`Found ${possibleIds.length} possible label elements by ID`);
            // Try to find the select control near these elements
            for (const possibleLabel of possibleIds) {
                const parentContainer = possibleLabel.closest('.select, .form-group, .form-field, .field, [class*="select"]');
                if (parentContainer) {
                    const selectControl = parentContainer.querySelector(
                        '.select__control, [role="combobox"], .select-shell, [class*="select"]'
                    );
                    if (selectControl) {
                        console.log(`Found select control via ID pattern match: ${possibleLabel.id}`);
                        fillCustomSelect(selectControl, value);
                        return;
                    }
                }
            }
        }
        return;
    }
    
    // For each matching label, try to find the associated select
    for (const labelEl of labels) {
        const forId = labelEl.getAttribute('for');
        let selectControl;
        
        if (forId) {
            // Find element with this ID
            const element = document.getElementById(forId);
            if (element) {
                // If it's a select or combobox, use it
                if (element.tagName === 'SELECT' || element.getAttribute('role') === 'combobox') {
                    selectControl = element;
                } else {
                    // Otherwise look for select control in the same container
                    const container = findClosestContainer(element);
                    if (container) {
                        selectControl = container.querySelector(
                            '.select__control, [role="combobox"], .dropdown-toggle, .select-toggle, .select-shell, [class*="remix-css"]'
                        );
                    }
                }
            }
        } else {
            // If no 'for' attribute, look at parent container
            const container = findClosestContainer(labelEl);
            if (container) {
                selectControl = container.querySelector(
                    '.select__control, [role="combobox"], .dropdown-toggle, .select-toggle, .select-shell, [class*="remix-css"]'
                );
            }
        }
        
        if (!selectControl) {
            // If we couldn't find the control, try by finding anything containing 'select' in the same container
            const container = findClosestContainer(labelEl);
            if (container) {
                const potentialControls = Array.from(container.querySelectorAll('*')).filter(el => {
                    return el.className && el.className.includes && 
                           (el.className.includes('select') || el.className.includes('Select'));
                });
                
                if (potentialControls.length > 0) {
                    selectControl = potentialControls[0];
                }
            }
        }
        
        if (selectControl) {
            console.log(`Found custom select for label: ${label}`);
            fillCustomSelect(selectControl, value);
            return;
        }
    }
    
    console.error(`Could not find select control for label: ${label}`);
}

// Helper function to find closest container
function findClosestContainer(element) {
    return element.closest('.select, .form-group, .field, .form-field, [class*="select-container"], [class*="select__container"]');
}

// Add mutation observer for dynamic form fields - modified for manual mode
const formObserver = new MutationObserver((mutations) => {
    if (manualModeOnly) return; // Skip in manual mode
    
    if (!hasAutoFilled) {
        setTimeout(autoFillForm, 1000);
    }
});

// Only observe if not in manual mode
if (!manualModeOnly) {
formObserver.observe(document.body, {
    childList: true,
    subtree: true
});
}

// Add URL change detection
function checkUrlChange() {
    if (lastUrl !== window.location.href) {
        console.log('URL changed from', lastUrl, 'to', window.location.href);
        hasAutoFilled = false;
        isAutoFilling = false;
        lastUrl = window.location.href;
        formMapping = {};
        initializePage();
        
        // Re-initialize UI on URL change
        setTimeout(initializeUI, 300);
    }
}

// Add URL change detection interval
setInterval(checkUrlChange, 1000);

// Helper function for string comparison (like Python's safe_string_compare)
function safeStringCompare(value1, value2) {
  // Convert values to strings and handle nulls
  if (value1 == null || value2 == null) return false;
  
  // Convert to strings and lowercase for comparison
  const str1 = String(value1).toLowerCase();
  const str2 = String(value2).toLowerCase();
  
  // Check if either contains the other
  return str1.includes(str2) || str2.includes(str1);
}

// JavaScript version of the Python function
function createInvertedMappingForAuto(mappings, profiles) {
  // Deep copy the mappings object
  const invertedMapping = JSON.parse(JSON.stringify(mappings));
  
  // Iterate through each key-value pair in the mapping
  for (const [key, value] of Object.entries(mappings.mapping || {})) {
    console.log(`Key: ${key}, Value: ${value}`);
    
    // Check each key in the profile for matches
    for (const [profileKey, profileValue] of Object.entries(profiles)) {
      if (safeStringCompare(profileKey, value)) {
        console.log(`Profile Key: ${profileKey}, Profile Value: ${profileValue}`);
        invertedMapping.mapping[key] = profileValue;
        break;
      }
    }
  }
  
  return invertedMapping;
}

// Add this helper function to filter out non-relevant domains
function isRelevantUrl(url) {
    const irrelevantDomains = [
        'googletagmanager.com',
        'google-analytics.com',
        'doubleclick.net', 
        'recaptcha.net',
        'googleadservices.com',
        'google.com/recaptcha',
        'gstatic.com',
        'facebook.net',
        'linkedin.com/analytics',
        'twitter.com/widgets',
        'bing.com',
        'ads.linkedin.com'
    ];
    
    try {
        const domain = new URL(url).hostname;
        return !irrelevantDomains.some(bad => domain.includes(bad));
    } catch (e) {
        return true; // If URL parsing fails, consider it relevant
    }
}

// Update initialization code to check relevant URLs
async function checkInvertedMappingExists() {
    try {
        // Skip check for irrelevant URLs
        if (!isRelevantUrl(window.location.href)) {
            console.log('Skipping mapping check for analytics/tracking URL');
            return false;
        }
        
        const url = `http://localhost:5001/api/inverted-mapping?url=${encodeURIComponent(window.location.href)}`;
        const response = await fetchWithRetry(url);
        const data = await response.json();
        
        hasInvertedMapping = data && data.mapping && 
            Object.keys(data.mapping).length > 0;
        
        console.log(`Inverted mapping ${hasInvertedMapping ? 'exists' : 'does not exist'} for this URL`);
        return hasInvertedMapping;
    } catch (error) {
        console.error('Error checking for inverted mapping:', error);
        return false;
    } finally {
        hasCheckedInvertedMapping = true;
    }
}

// Enhanced form change detection
const formChangeObserver = new MutationObserver((mutations) => {
    // Check for new form elements or form structure changes
    let hasNewFormElements = false;
    let hasFormVisibilityChange = false;
    
    for (const mutation of mutations) {
        // Check for added nodes
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    // Check if this is a form element
                    if (node.tagName === 'FORM' || 
                        ['INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName) ||
                        node.querySelectorAll('input, select, textarea').length > 0) {
                        
                        hasNewFormElements = true;
                        attachEventListeners(node);
                        findFormControlButtons(node);
                        break;
                    }
                }
            }
        }
        
        // Check for style/visibility changes
        if (mutation.type === 'attributes' && 
           (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
            const target = mutation.target;
            
            // Check if this is a form container that became visible
            if (target.tagName === 'FORM' || 
                target.querySelectorAll('input, select, textarea').length > 0) {
                
                const style = window.getComputedStyle(target);
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                    hasFormVisibilityChange = true;
                    break;
                }
            }
            
            // Look for modal/popup indicators
            if (target.classList.contains('modal') || 
                target.classList.contains('popup') ||
                target.classList.contains('dialog') ||
                target.getAttribute('role') === 'dialog') {
                hasFormVisibilityChange = true;
                break;
            }
        }
    }
    
    if (hasNewFormElements || hasFormVisibilityChange) {
        console.log('Form change detected, attempting autofill');
        attemptAutofill();
    }
});

// Find form navigation buttons to monitor
function findFormControlButtons(root = document) {
    const potentialButtons = root.querySelectorAll(
        'button, input[type="submit"], input[type="button"], a.button, .btn, [role="button"]'
    );
    
    potentialButtons.forEach(button => {
        // Check text content for navigation keywords
        const text = (button.textContent || button.value || '').toLowerCase();
        const isNavigationButton = /next|continue|proceed|suivant|weiter|siguiente|avançar|次へ|下一步|forward|go/i.test(text);
        const isSubmitButton = /submit|save|finish|complete|done|send|enviar|提交|保存|envoyer|absenden/i.test(text);
        
        if (isNavigationButton || isSubmitButton) {
            // Add navigation listeners
            button.addEventListener('click', () => {
                console.log('Form navigation detected');
                setTimeout(attemptAutofill, 500);
                setTimeout(attemptAutofill, 1500);  // Try again after a longer delay
            });
            
            if (isNavigationButton) formNavigationButtons.push(button);
            if (isSubmitButton) formSubmitButtons.push(button);
        }
    });
}

// Improved autofill attempt function
function attemptAutofill() {
    if (!isRelevantUrl(window.location.href)) {
        console.log('Not attempting autofill on non-form related URL');
        return;
    }
    
    if (!hasAutoFilled && !isAutoFilling) {
        console.log('Attempting autofill');
        autoFillForm();
    }
}

// Initialize the page
async function initializePage() {
    // Reset state variables
    attempts = 0;
    hasAutoFilled = false;
    isAutoFilling = false;
    formMapping = {};
    hasCheckedInvertedMapping = false;
    
    // First check if inverted mapping exists
    const mappingExists = await checkInvertedMappingExists();
    
    // Find form control buttons
    findFormControlButtons();
    
    // Start observation with enhanced sensitivity
    formChangeObserver.observe(document.body, {
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });
    
    // Try autofill if mapping exists
    if (mappingExists) {
        console.log('Inverted mapping found, attempting autofill');
        setTimeout(attemptAutofill, 500);
    }
}

// Enhanced URL change detection with hash change support
function setupUrlChangeDetection() {
    // Standard URL change check
    setInterval(checkUrlChange, 1000);
    
    // Add hash change listener (for single page apps)
    window.addEventListener('hashchange', () => {
        console.log('URL hash change detected');
        hasAutoFilled = false;
        isAutoFilling = false;
        formMapping = {};
        setTimeout(initializePage, 300);
    });
    
    // Add history state change listener (for pushState/replaceState)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        console.log('History pushState detected');
        dispatchEvent(new Event('locationchange'));
    };
    
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        console.log('History replaceState detected');
        dispatchEvent(new Event('locationchange'));
    };
    
    window.addEventListener('locationchange', () => {
        hasAutoFilled = false;
        isAutoFilling = false;
        formMapping = {};
        setTimeout(initializePage, 300);
    });
}

// Add event listeners to detect modal dialogs (often used for forms)
document.addEventListener('click', (e) => {
    // Find potential modal/popup triggers
    if (e.target.matches('button, a, [role="button"]')) {
        const text = (e.target.textContent || '').toLowerCase();
        if (/apply|login|signup|register|sign up|sign in|join/i.test(text)) {
            console.log('Potential form trigger clicked');
            setTimeout(attemptAutofill, 500);
            setTimeout(attemptAutofill, 1500);
        }
    }
});

// Add this function to detect step changes in numbered forms
function setupStepIndicatorObserving() {
    // Find common step indicators
    const stepIndicators = document.querySelectorAll(
        '.step-indicator, .progress-indicator, [role="progressbar"], ' +
        '.step-wizard, .wizard-steps, .form-stepper, ' +
        '[class*="step"]:not(button):not(input), [class*="progress"]:not(button)'
    );
    
    if (stepIndicators.length > 0) {
        console.log("Found form step indicators:", stepIndicators.length);
        
        // Observe changes to step indicators
        const stepObserver = new MutationObserver((mutations) => {
            const significantChange = mutations.some(m => 
                m.attributeName === 'class' || 
                m.attributeName === 'aria-valuenow' ||
                m.attributeName === 'data-step' || 
                m.type === 'childList'
            );
            
            if (significantChange) {
                console.log("Step change detected via step indicator");
                hasAutoFilled = false;
                setTimeout(() => autoFillForm(), 400);
            }
        });
        
        stepIndicators.forEach(indicator => {
            stepObserver.observe(indicator, { 
                attributes: true, 
                attributeFilter: ['class', 'aria-valuenow', 'aria-valuetext', 'data-step'],
                childList: true
            });
        });
    }
}

// Modify the original initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing page');
    
    // Only set up automatic behavior if not in manual mode
    if (!manualModeOnly) {
    // Add these functions first
    setupStepIndicatorObserving();
    setupFormNavigationTracking();
    
    // Then initialize systems
    setupUrlChangeDetection();
    detectFrameworkRouteChanges();
    }
    
    // Always initialize page structure
    initializePage();
    
    // Initialize UI with buttons
    initializeUI();
    
    // Start retry mechanism only if not in manual mode
    if (!manualModeOnly) {
    attempts = 0;
    initializeWithRetry();
    }
    
    // Set up form event listeners (will be skipped if in manual mode)
    setupFormEventListeners();
});

// Try one initial autofill when the page loads - skip in manual mode
setTimeout(() => {
    if (document.readyState === 'complete') {
        initializePage();
        // Make sure UI is initialized
        initializeUI();
        
        // Skip autofill in manual mode
        if (!manualModeOnly) {
            autoFillForm();
        }
    }
}, 500);

// Monitor for significant DOM changes that suggest a form step change
const formPageTransitionObserver = new MutationObserver((mutations) => {
    if (manualModeOnly) return; // Skip in manual mode
    
    // Group mutations by target to detect batch changes
    const formSectionChanges = new Set();
    let significantChanges = false;
    
    for (const mutation of mutations) {
        // Skip small text changes
        if (mutation.type === 'characterData') continue;
        
        // Check for significant DOM changes
        if (mutation.type === 'childList' && 
            (mutation.addedNodes.length > 2 || mutation.removedNodes.length > 2)) {
            
            // Check if this looks like a form section
            const addedFormElements = Array.from(mutation.addedNodes)
                .filter(node => node.nodeType === 1) // Element nodes only
                .filter(el => 
                    el.tagName === 'FORM' || 
                    el.querySelector('input, select, textarea') ||
                    el.tagName === 'DIV' && (
                        el.className.includes('step') || 
                        el.className.includes('page') ||
                        el.className.includes('section')
                    )
                );
                
            if (addedFormElements.length > 0) {
                formSectionChanges.add(mutation.target);
                significantChanges = true;
            }
        }
        
        // Check for visibility attribute changes
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'style' || 
             mutation.attributeName === 'class' || 
             mutation.attributeName === 'hidden')) {
            
            const target = mutation.target;
            
            // Check if it's a form container with inputs
            if (target.querySelectorAll('input, select, textarea').length > 0) {
                const style = window.getComputedStyle(target);
                const wasHidden = mutation.oldValue && 
                    (mutation.oldValue.includes('display: none') || 
                     mutation.oldValue.includes('visibility: hidden') ||
                     mutation.oldValue.includes('hidden'));
                const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
                
                // If it changed from hidden to visible
                if (wasHidden && isVisible) {
                    formSectionChanges.add(target);
                    significantChanges = true;
                }
            }
        }
    }
    
    if (significantChanges && formSectionChanges.size > 0) {
        console.log(`Form transition detected across ${formSectionChanges.size} sections`);
        hasAutoFilled = false; // Reset autofill flag
        setTimeout(() => autoFillForm(), 500); // Trigger autofill after a short delay
    }
});

// Only observe if not in manual mode
if (!manualModeOnly) {
formPageTransitionObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['style', 'class', 'hidden', 'aria-hidden']
});
}

// Detect SPA framework route changes that don't affect URL
function detectFrameworkRouteChanges() {
    // React - detect component mounting/unmounting
    const reactRoot = document.getElementById('root') || document.getElementById('app');
    if (reactRoot) {
        const reactObserver = new MutationObserver(debounce(() => {
            console.log('React component change detected');
            setTimeout(() => !hasAutoFilled && autoFillForm(), 500);
        }, 300));
        
        reactObserver.observe(reactRoot, { childList: true, subtree: true });
    }
    
    // Track Angular router outlet changes
    const angularOutlets = document.querySelectorAll('[ng-view], [data-ng-view], [ng-outlet], router-outlet');
    if (angularOutlets.length) {
        const angularObserver = new MutationObserver(() => {
            console.log('Angular route change detected');
            setTimeout(() => !hasAutoFilled && autoFillForm(), 500);
        });
        
        angularOutlets.forEach(outlet => {
            angularObserver.observe(outlet, { childList: true });
        });
    }
}

// Add missing debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add missing setupFormNavigationTracking function - modified for manual mode
function setupFormNavigationTracking() {
    if (manualModeOnly) return; // Skip in manual mode
    
    // Use a more comprehensive selector to catch various button types
    const potentialButtons = document.querySelectorAll(
        'button, input[type="submit"], input[type="button"], a.button, .btn, [role="button"], [type="submit"], ' +
        '.next-button, .submit-button, [aria-label*="next"], [aria-label*="continue"]'
    );
    
    potentialButtons.forEach(button => {
        // Check text content for navigation keywords with more comprehensive patterns
        const text = (button.textContent || button.value || button.getAttribute('aria-label') || '').toLowerCase();
        const isNavigationButton = /next|continue|proceed|forward|suivant|weiter|siguiente|avançar|次へ|下一步/i.test(text);
        const isSubmitButton = /submit|save|finish|complete|done|send/i.test(text);
        
        if (isNavigationButton || isSubmitButton) {
            // Use capture to ensure our handler runs
            button.addEventListener('click', () => {
                console.log('Form navigation button clicked:', text);
                // Reset autofill state
                hasAutoFilled = false;
                
                // Only trigger autofill in non-manual mode
                if (!manualModeOnly) {
                // Try autofill multiple times with increasing delays
                setTimeout(() => autoFillForm(), 300);
                setTimeout(() => autoFillForm(), 800);
                setTimeout(() => autoFillForm(), 1500);
                }
            }, true);
            
            if (isNavigationButton) formNavigationButtons.push(button);
            if (isSubmitButton) formSubmitButtons.push(button);
        }
    });
}


window.addEventListener('load', () => {
    // Only set up automatic behavior if not in manual mode
    if (!manualModeOnly) {
    setupStepIndicatorObserving();
    detectFrameworkRouteChanges();
    }
    
    // Make sure UI is visible
    initializeUI();
});



