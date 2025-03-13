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

// Initialize
document.addEventListener('DOMContentLoaded', initializeWithRetry);

function captureValue(element) {
    if (!isUserInteracting || isAutoFilling) return;
    
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
        hasAutoFilled = false;
        isAutoFilling = false;
        lastUrl = window.location.href;
        formMapping = {};
        initializeWithRetry();
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

