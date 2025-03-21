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

// Attach events to form elements
function attachEventListeners(root) {
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

// Initialize with progressive delay
let attempts = 0;
const maxAttempts = 5;

function initializeWithRetry() {
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
    if (!isUserInteracting || isAutoFilling || hasInvertedMapping) return;
    
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

// Listen for all relevant form events
document.addEventListener('input', handleFormEvent);
document.addEventListener('change', handleFormEvent);

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

// Updated autoFillForm function
window.autoFillForm = async function() {
    if (hasAutoFilled || isAutoFilling) return;
    
    try {
        const userEmail = await new Promise(resolve => {
            chrome.storage.sync.get(['userEmail'], result => {
                resolve(result.userEmail);
            });
        });

        if (!userEmail) {
            console.error('User not logged in');
            return;
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
            }

        }

        
    } catch (error) {
        console.error('Error fetching mapping:', error);
    } finally {
        isAutoFilling = false;
    }
}

// Enhanced fillElement function to handle dropdowns and searchboxes
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
        return;
    }

    try {
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
                    // Click to open dropdown
                    element.click();
                    
                    // Find dropdown options (common patterns)
                    setTimeout(() => {
                        // Look for dropdown items in common structures
                        const options = document.querySelectorAll('.dropdown-item, .select-option, [role="option"]');
                        for (const option of options) {
                            if (option.textContent.toLowerCase().includes(String(value).toLowerCase())) {
                                option.click();
                                break;
                            }
                        }
                    }, 300);
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

// Add mutation observer for dynamic form fields
const formObserver = new MutationObserver((mutations) => {
    if (!hasAutoFilled) {
        setTimeout(autoFillForm, 1000);
    }
});

formObserver.observe(document.body, {
    childList: true,
    subtree: true
});

// Add URL change detection
function checkUrlChange() {
    if (lastUrl !== window.location.href) {
        console.log('URL changed from', lastUrl, 'to', window.location.href);
        hasAutoFilled = false;
        isAutoFilling = false;
        lastUrl = window.location.href;
        formMapping = {};
        initializePage();
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

// Add this function to check if inverted mapping exists
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
        
        hasInvertedMapping = data && data.inverted_mapping && 
            Object.keys(data.inverted_mapping).length > 0;
        
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
    // Add these functions first
    setupStepIndicatorObserving();
    setupFormNavigationTracking();
    
    // Then initialize systems
    setupUrlChangeDetection();
    detectFrameworkRouteChanges();
    initializePage();
    
    // Start retry mechanism
    attempts = 0;
    initializeWithRetry();
});

// Try one initial autofill when the page loads
setTimeout(() => {
    if (document.readyState === 'complete') {
        initializePage();
    }
}, 500);

// Monitor for significant DOM changes that suggest a form step change
const formPageTransitionObserver = new MutationObserver((mutations) => {
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

// Start observing with this configuration
formPageTransitionObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['style', 'class', 'hidden', 'aria-hidden']
});

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

// Add missing setupFormNavigationTracking function
function setupFormNavigationTracking() {
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
                // Try autofill multiple times with increasing delays
                setTimeout(() => autoFillForm(), 300);
                setTimeout(() => autoFillForm(), 800);
                setTimeout(() => autoFillForm(), 1500);
            }, true);
            
            if (isNavigationButton) formNavigationButtons.push(button);
            if (isSubmitButton) formSubmitButtons.push(button);
        }
    });
}

// Consolidate initialization to avoid duplicate handlers


// Remove duplicate event listeners
// Remove this:
// document.addEventListener('DOMContentLoaded', initializeWithRetry);
// Remove this:
// document.addEventListener('DOMContentLoaded', () => {
//     setupStepIndicatorObserving();
//     setupFormNavigationTracking();
//     detectFrameworkRouteChanges();
//     initializePage();
// });

// Also run when the page is fully loaded (for dynamic content)
window.addEventListener('load', () => {
    setupStepIndicatorObserving();
    detectFrameworkRouteChanges();
});

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

// Update your initialization code to check relevant URLs
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
        
        hasInvertedMapping = data && data.inverted_mapping && 
            Object.keys(data.inverted_mapping).length > 0;
        
        console.log(`Inverted mapping ${hasInvertedMapping ? 'exists' : 'does not exist'} for this URL`);
        return hasInvertedMapping;
    } catch (error) {
        console.error('Error checking for inverted mapping:', error);
        return false;
    } finally {
        hasCheckedInvertedMapping = true;
    }
}

// Also update your autoFill triggering to check URL relevance first


