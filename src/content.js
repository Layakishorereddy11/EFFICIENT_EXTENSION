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
    const payload = {
        url: window.location.href,
        mapping: formMapping
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
}

// Updated autoFillForm function
async function autoFillForm() {
    if (hasAutoFilled || isAutoFilling) return;
    
    try {
        isAutoFilling = true;
        const url = `http://localhost:5001/api/mapping?url=${encodeURIComponent(window.location.href)}`;
        const response = await fetchWithRetry(url);
        const data = await response.json();
        
        if (data && data.mapping) {
            const entries = Object.entries(data.mapping);
            for (const [xpath, value] of entries) {
                await new Promise(resolve => setTimeout(resolve, 100));
                fillElement(xpath, value);
            }
            hasAutoFilled = true;
        }
    } catch (error) {
        console.error('Error fetching mapping:', error);
    } finally {
        isAutoFilling = false;
    }
}

// Fill element by XPath
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
                    default:
                        element.value = value;
                }
                break;
            case 'select':
                element.value = value;
                break;
            default:
                element.value = value;
        }

        // Trigger events
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

