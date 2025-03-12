// Initialize dynamic form elements
document.addEventListener('DOMContentLoaded', function() {
  populateYearDropdowns();
  setupNavigation();
  setupDynamicFields();
  setupSkillsManager();
  loadProfile();
});

// Populate year dropdowns
function populateYearDropdowns() {
  const yearElements = document.querySelectorAll('select[id$="Year_0"]');
  const currentYear = new Date().getFullYear();
  
  yearElements.forEach(select => {
    for (let year = currentYear - 50; year <= currentYear + 5; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      select.appendChild(option);
    }
  });
}

// Setup sidebar navigation
function setupNavigation() {
  const navItems = document.querySelectorAll('.sidebar nav ul li');
  
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      navItems.forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      
      // Smooth scroll to section
      const targetId = this.querySelector('a').getAttribute('href').substring(1);
      document.getElementById(targetId).scrollIntoView({behavior: 'smooth'});
    });
  });
}

// Setup dynamic fields (education and work experience)
function setupDynamicFields() {
  let educationCount = 1;
  let experienceCount = 1;
  
  // Add education entry
  document.getElementById('addEducation').addEventListener('click', function() {
    const educationContainer = document.getElementById('educationContainer');
    const educationEntryTemplate = document.querySelector('.education-entry').cloneNode(true);
    
    // Update IDs and names for the new entry
    educationCount++;
    const newId = educationCount - 1;
    
    educationEntryTemplate.querySelector('h3').textContent = `Education #${educationCount}`;
    
    const removeBtn = educationEntryTemplate.querySelector('.btn-remove');
    removeBtn.style.visibility = 'visible';
    removeBtn.addEventListener('click', function() {
      educationEntryTemplate.remove();
    });
    
    // Update all input fields with new index
    const inputs = educationEntryTemplate.querySelectorAll('input, select');
    inputs.forEach(input => {
      const oldId = input.id;
      const newIdName = oldId.replace('_0', `_${newId}`);
      input.id = newIdName;
      input.name = input.name.replace('[0]', `[${newId}]`);
      
      // Clear values
      if (input.tagName === 'SELECT') {
        input.selectedIndex = 0;
      } else {
        input.value = '';
      }
    });
    
    // Repopulate year dropdowns in the new entry
    const yearSelects = educationEntryTemplate.querySelectorAll('select[id$="Year_' + newId + '"]');
    const currentYear = new Date().getFullYear();
    
    yearSelects.forEach(select => {
      // Clear existing options except the first one
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      // Add year options
      for (let year = currentYear - 50; year <= currentYear + 5; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
      }
    });
    
    educationContainer.appendChild(educationEntryTemplate);
  });
  
  // Add experience entry
  document.getElementById('addExperience').addEventListener('click', function() {
    const experienceContainer = document.getElementById('experienceContainer');
    const experienceEntryTemplate = document.querySelector('.experience-entry').cloneNode(true);
    
    // Update IDs and names for the new entry
    experienceCount++;
    const newId = experienceCount - 1;
    
    experienceEntryTemplate.querySelector('h3').textContent = `Experience #${experienceCount}`;
    
    const removeBtn = experienceEntryTemplate.querySelector('.btn-remove');
    removeBtn.style.visibility = 'visible';
    removeBtn.addEventListener('click', function() {
      experienceEntryTemplate.remove();
    });
    
    // Update all input fields with new index
    const inputs = experienceEntryTemplate.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      const oldId = input.id;
      const newIdName = oldId.replace('_0', `_${newId}`);
      input.id = newIdName;
      input.name = input.name.replace('[0]', `[${newId}]`);
      
      // Clear values
      if (input.tagName === 'SELECT') {
        input.selectedIndex = 0;
      } else if (input.type === 'checkbox') {
        input.checked = false;
      } else {
        input.value = '';
      }
    });
    
    // Setup current job checkbox logic
    const currentJobCheckbox = experienceEntryTemplate.querySelector('.current-job');
    const endDateFields = experienceEntryTemplate.querySelectorAll('.end-month, .end-year');
    
    currentJobCheckbox.addEventListener('change', function() {
      endDateFields.forEach(field => {
        field.disabled = this.checked;
        if (this.checked) {
          field.value = '';
        }
      });
    });
    
    // Repopulate year dropdowns in the new entry
    const yearSelects = experienceEntryTemplate.querySelectorAll('select[id$="Year_' + newId + '"]');
    const currentYear = new Date().getFullYear();
    
    yearSelects.forEach(select => {
      // Clear existing options except the first one
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      // Add year options
      for (let year = currentYear - 50; year <= currentYear + 5; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
      }
    });
    
    experienceContainer.appendChild(experienceEntryTemplate);
  });
  
  // Initial setup for current job checkbox
  document.querySelectorAll('.current-job').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const endDateFields = this.closest('.experience-entry').querySelectorAll('.end-month, .end-year');
      endDateFields.forEach(field => {
        field.disabled = this.checked;
        if (this.checked) {
          field.value = '';
        }
      });
    });
  });
}

// Setup skills manager
function setupSkillsManager() {
  const skillInput = document.getElementById('skillInput');
  const addSkillBtn = document.getElementById('addSkill');
  const skillTags = document.getElementById('skillTags');
  const skillsHiddenInput = document.getElementById('skills');
  
  let skills = [];
  
  function updateSkillsInput() {
    skillsHiddenInput.value = JSON.stringify(skills);
  }
  
  function addSkill(skill) {
    if (!skill || skills.includes(skill)) return;
    
    skills.push(skill);
    updateSkillsInput();
    
    const tag = document.createElement('div');
    tag.className = 'skill-tag';
    tag.innerHTML = `
      ${skill}
      <button type="button" class="remove-skill">×</button>
    `;
    
    tag.querySelector('.remove-skill').addEventListener('click', function() {
      skills = skills.filter(s => s !== skill);
      updateSkillsInput();
      tag.remove();
    });
    
    skillTags.appendChild(tag);
    skillInput.value = '';
  }
  
  addSkillBtn.addEventListener('click', function() {
    addSkill(skillInput.value.trim());
  });
  
  skillInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill(this.value.trim());
    }
  });
}

// Load profile data if exists
function loadProfile() {
  chrome.storage.sync.get(['userEmail'], function(result) {
    const email = result.userEmail;
    if (email) {
      fetchProfile(email);
    }
  });
}

// Fetch profile from server
async function fetchProfile(email) {
  try {
    const response = await fetch(`http://localhost:5001/api/profile?email=${encodeURIComponent(email)}`);
    if (response.ok) {
      const profile = await response.json();
      if (profile && !profile.error) {
        populateForm(profile);
      }
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
  }
}

// Populate form with profile data
function populateForm(profile) {
  // Fill basic fields
  document.getElementById('firstName').value = profile.firstName || '';
  document.getElementById('lastName').value = profile.lastName || '';
  document.getElementById('email').value = profile.email || '';
  document.getElementById('phone').value = profile.phone || '';
  document.getElementById('dob').value = profile.dob || '';
  
  // More fields would be populated here...
}

// Handle form submission
document.getElementById('profileForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  // Gather form data
  const formData = new FormData(this);
  
  // Build profile object
  const profile = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    dob: formData.get('dob'),
    phoneCountry: formData.get('phoneCountry'),
    location: formData.get('location'),
    
    // Education
    education: getEducationData(),
    
    // Work Experience
    experience: getExperienceData(),
    
    // Work Authorization
    workAuth: {
      usAuth: formData.get('usAuth'),
      canadaAuth: formData.get('canadaAuth'),
      ukAuth: formData.get('ukAuth'),
      sponsorship: formData.get('sponsorship')
    },
    
    // Demographics
    demographics: {
      ethnicity: document.getElementById('ethnicityDecline').checked ? 'Decline to state' : 
                 Array.from(document.getElementById('ethnicity').selectedOptions).map(o => o.value),
      disability: formData.get('disability'),
      veteran: formData.get('veteran'),
      lgbtq: formData.get('lgbtq'),
      gender: formData.get('gender')
    },
    
    // Skills
    skills: JSON.parse(document.getElementById('skills').value || '[]'),
    
    // Social Links
    social: {
      linkedin: formData.get('linkedin'),
      github: formData.get('github'),
      portfolio: formData.get('portfolio'),
      other: formData.get('other')
    }
  };

  try {
    const response = await fetch('http://localhost:5001/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(profile)
    });

    if (response.ok) {
      showNotification('Profile saved successfully!', 'success');
      chrome.storage.sync.set({ userProfile: profile, userEmail: profile.email });
    } else {
      showNotification('Error saving profile', 'error');
    }
  } catch (error) {
    showNotification('Error connecting to server', 'error');
    console.error('Error:', error);
  }
});

// Get education data from form
function getEducationData() {
  const educationEntries = document.querySelectorAll('.education-entry');
  const educationData = [];
  
  educationEntries.forEach((entry, index) => {
    educationData.push({
      schoolName: document.getElementById(`schoolName_${index}`).value,
      major: document.getElementById(`major_${index}`).value,
      degreeType: document.getElementById(`degreeType_${index}`).value,
      gpa: document.getElementById(`gpa_${index}`).value,
      startMonth: document.getElementById(`startMonth_${index}`).value,
      startYear: document.getElementById(`startYear_${index}`).value,
      endMonth: document.getElementById(`endMonth_${index}`).value,
      endYear: document.getElementById(`endYear_${index}`).value
    });
  });
  
  return educationData;
}

// Get experience data from form
function getExperienceData() {
  const experienceEntries = document.querySelectorAll('.experience-entry');
  const experienceData = [];
  
  experienceEntries.forEach((entry, index) => {
    const currentJob = document.getElementById(`currentJob_${index}`).checked;
    
    experienceData.push({
      company: document.getElementById(`company_${index}`).value,
      location: document.getElementById(`location_${index}`).value,
      title: document.getElementById(`title_${index}`).value,
      type: document.getElementById(`type_${index}`).value,
      startMonth: document.getElementById(`expStartMonth_${index}`).value,
      startYear: document.getElementById(`expStartYear_${index}`).value,
      endMonth: currentJob ? 'present' : document.getElementById(`expEndMonth_${index}`).value,
      endYear: currentJob ? 'present' : document.getElementById(`expEndYear_${index}`).value,
      currentJob: currentJob,
      description: document.getElementById(`description_${index}`).value
    });
  });
  
  return experienceData;
}

function showNotification(message, type) {
  const notificationArea = document.getElementById('notificationArea');
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  notificationArea.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}