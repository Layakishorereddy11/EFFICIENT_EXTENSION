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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    attachEventListeners(document);
    handleIframes();
});

function captureValue(element) {
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
//   // On page load, retrieve the mapping for this page and autofill fields.
//   window.addEventListener('load', () => {
//     const pageUrl = encodeURIComponent(window.location.href);
//     fetch('http://localhost:5001/api/mapping?url=' + pageUrl)
//       .then(response => response.json())
//       .then(data => {
//         console.log('Mapping retrieved:', data);
//         if (data && data.mapping) {
//           // Get the user’s profile from chrome.storage.
//           chrome.storage.sync.get(['userProfile'], function(result) {
//             const profile = result.userProfile;
//             if (!profile) {
//               console.log('No user profile found. Set up your profile in the options page.');
//               return;
//             }
//             // For each captured XPath, attempt to determine which profile field to use.
//             for (const xpath in data.mapping) {
//               let valueToFill = '';
//               // Use simple heuristics based on the XPath string.
//               if (xpath.toLowerCase().includes('name') && profile.name) {
//                 valueToFill = profile.name;
//               } else if (xpath.toLowerCase().includes('email') && profile.email) {
//                 valueToFill = profile.email;
//               } else if (xpath.toLowerCase().includes('phone') && profile.phone) {
//                 valueToFill = profile.phone;
//               } else if (xpath.toLowerCase().includes('address') && profile.address) {
//                 valueToFill = profile.address;
//               }
//               if (valueToFill) {
//                 const element = document.evaluate(
//                   xpath,
//                   document,
//                   null,
//                   XPathResult.FIRST_ORDERED_NODE_TYPE,
//                   null
//                 ).singleNodeValue;
//                 if (element) {
//                   element.value = valueToFill;
//                   console.log('Autofilled', xpath, valueToFill);
//                 }
//               }
//             }
//           });
//         }
//       })
//       .catch(error => {
//         console.error('Error retrieving mapping:', error);
//       });
//   });