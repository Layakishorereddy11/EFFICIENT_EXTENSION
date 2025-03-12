document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  if (!email) {
    alert('Please enter your email');
    return;
  }

  try {
    const response = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    if (response.ok) {
      const data = await response.json();
      chrome.storage.sync.set({ 
        userEmail: email,
        userProfile: data.profile
      }, () => {
        window.close();
      });
    } else {
      alert('Login failed');
    }
  } catch (error) {
    alert('Server error');
  }
});