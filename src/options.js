document.getElementById('profileForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const profile = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      address: document.getElementById('address').value
    };
    chrome.storage.sync.set({ userProfile: profile }, function() {
      alert('Profile saved!');
    });
  });
  