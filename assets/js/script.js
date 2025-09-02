// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', function() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// Set current year
document.getElementById('current-year').textContent = new Date().getFullYear();

// Scroll animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

document.querySelectorAll('.animate-on-scroll').forEach(el => {
  observer.observe(el);
});

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Waitlist form handling
document.getElementById('waitlist-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const email = e.target.email.value.trim();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const successMessage = document.getElementById('success-message');
  
  if (!email) return;
  
  // Simple validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('Please enter a valid email address');
    return;
  }
  
  // Show loading state
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;
  
  // Simulate API call
  setTimeout(() => {
    successMessage.classList.add('show');
    document.querySelector('.enhanced-waitlist-form').style.display = 'none';
    document.querySelector('.form-benefits').style.display = 'none';
    document.querySelector('.urgency-banner').style.display = 'none';
    
    // Re-initialize icons for the success message
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }, 1500);
});

// Animated counter
function animateCounter() {
  const counter = document.querySelector('.animated-counter');
  if (!counter) return;
  
  const target = parseInt(counter.getAttribute('data-target'));
  const duration = 2000;
  const increment = target / (duration / 16);
  let current = 0;
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    counter.textContent = Math.floor(current).toLocaleString();
  }, 16);
}

// Start counter animation when section comes into view
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter();
      counterObserver.unobserve(entry.target);
    }
  });
});

const counterElement = document.querySelector('.waitlist-counter');
if (counterElement) {
  counterObserver.observe(counterElement);
}

// Enhanced scroll animations with stagger effect
const animateElements = document.querySelectorAll('.animate-on-scroll');
animateElements.forEach((el, index) => {
  el.style.transitionDelay = `${index * 0.1}s`;
});

// Magnetic button effect
document.querySelectorAll('.btn--primary').forEach(btn => {
  let bounds;
  
  function rotateToMouse(e) {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const leftX = mouseX - bounds.x;
    const topY = mouseY - bounds.y;
    const center = {
      x: leftX - bounds.width / 2,
      y: topY - bounds.height / 2
    }
    const distance = Math.sqrt(center.x**2 + center.y**2);
    
    btn.style.transform = `
      scale3d(1.05, 1.05, 1) 
      rotate3d(${center.y/100}, ${-center.x/100}, 0, ${Math.log(distance)* 2}deg)
    `;
  }

  btn.addEventListener('mouseenter', function(e) {
    bounds = btn.getBoundingClientRect();
  });
  
  btn.addEventListener('mousemove', rotateToMouse);
  
  btn.addEventListener('mouseleave', function() {
    btn.style.transform = '';
  });
});

// Parallax effect for hero image
window.addEventListener('scroll', () => {
  const heroImage = document.querySelector('.hero-image');
  if (heroImage) {
    const scrolled = window.pageYOffset;
    const rate = scrolled * -0.3;
    heroImage.style.transform = `translate3d(0, ${rate}px, 0)`;
  }
});

// Enhanced script.js
class ZintleWaitlist {
  constructor() {
    this.currentStep = 1;
    this.formData = {};
    this.websocket = null;
    this.isBackendAvailable = false;
    this.init();
  }

  init() {
    this.checkBackendAvailability();
    this.setupWebSocket();
    this.loadDynamicData();
    this.setupEventListeners();
    this.initializeCounters();
  }

  // Add the missing method
  async checkBackendAvailability() {
    try {
      const response = await fetch('http://localhost:3001/api/stats');
      this.isBackendAvailable = response.ok;
      console.log('Backend available:', this.isBackendAvailable);
    } catch (error) {
      this.isBackendAvailable = false;
      console.log('Backend not available, running in static mode');
    }
  }

  initializeCounters() {
    // Initialize counter with fallback values immediately
    let counter = document.getElementById('dynamic-counter');
    if (!counter) {
      counter = document.querySelector('.animated-counter');
    }
    
    const spotsElement = document.getElementById('spots-left');
    
    // Set initial values to prevent NaN
    if (counter) {
      counter.textContent = '0'; // Start with 0, will be updated by loadDynamicData
    }
    
    if (spotsElement) {
      spotsElement.textContent = '500'; // Start with max spots
    }
  }

  setupWebSocket() {
    if (!this.isBackendAvailable) return;
    
    try {
      this.websocket = new WebSocket('ws://localhost:8080');
      
      this.websocket.onopen = () => {
        console.log('WebSocket connected');
      };
      
      this.websocket.onerror = (error) => {
        console.log('WebSocket connection failed, running in static mode');
      };
      
      this.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'counter_update') {
          this.updateCounter(data.count);
        }
        if (data.type === 'spots_update') {
          this.updateSpotsLeft(data.spots);
        }
      };
    } catch (error) {
      console.log('WebSocket not available, running in static mode');
    }
  }

  async loadDynamicData() {
    try {
      const response = await fetch('http://localhost:3001/api/stats');
      const data = await response.json();
      
      console.log('API Response:', data); // Debug log
      
      // Ensure we have valid numbers
      const totalSignups = parseInt(data.totalSignups) || 0;
      const spotsLeft = parseInt(data.spotsLeft) || 500;
      
      console.log('Parsed values:', { totalSignups, spotsLeft }); // Debug log
      
      this.updateCounter(totalSignups);
      this.updateSpotsLeft(spotsLeft);
      this.isBackendAvailable = true;
    } catch (error) {
      console.error('Failed to load dynamic data:', error);
      // Fallback to static data
      this.updateCounter(1247);
      this.updateSpotsLeft(253);
      this.isBackendAvailable = false;
    }
  }

  updateCounter(count) {
    // Try both selectors to ensure compatibility
    let counter = document.getElementById('dynamic-counter');
    if (!counter) {
      counter = document.querySelector('.animated-counter');
    }
    
    console.log('Updating counter:', count, 'Element found:', !!counter); // Debug log
    
    if (counter) {
      // Ensure count is a valid number
      const validCount = isNaN(count) ? 0 : count;
      const currentValue = parseInt(counter.textContent) || 0;
      this.animateCounter(counter, currentValue, validCount);
    }
  }

  updateSpotsLeft(spots) {
    const spotsElement = document.getElementById('spots-left');
    console.log('Updating spots:', spots, 'Element found:', !!spotsElement); // Debug log
    
    if (spotsElement) {
      const validSpots = isNaN(spots) ? 500 : spots;
      spotsElement.textContent = validSpots;
    }
  }

  animateCounter(element, start, end) {
    // Ensure all values are valid numbers
    const validStart = isNaN(start) ? 0 : start;
    const validEnd = isNaN(end) ? 0 : end;
    
    console.log('Animating counter from', validStart, 'to', validEnd); // Debug log
    
    const duration = 1000;
    const increment = (validEnd - validStart) / (duration / 16);
    let current = validStart;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= validEnd) {
        current = validEnd;
        clearInterval(timer);
      }
      element.textContent = Math.floor(current).toLocaleString();
    }, 16);
  }

  nextStep() {
    if (this.validateCurrentStep()) {
      this.currentStep++;
      this.showStep(this.currentStep);
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.showStep(this.currentStep);
    }
  }

  showStep(step) {
    document.querySelectorAll('.form-step').forEach(el => {
      el.classList.remove('active');
    });
    
    document.getElementById(`step-${step}`).classList.add('active');
    
    // Update progress bar
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
      progressFill.style.width = `${(step / 3) * 100}%`;
    }
  }

  validateCurrentStep() {
    if (this.currentStep === 1) {
      const email = document.getElementById('email-input').value;
      if (!this.validateEmail(email)) {
        this.showError('Please enter a valid email address');
        return false;
      }
      this.formData.email = email;
    }
    
    if (this.currentStep === 2) {
      const primarySkill = document.querySelector('[name="primary_skill"]').value;
      const biggestChallenge = document.querySelector('[name="biggest_challenge"]:checked')?.value;
      const interestLevel = document.querySelector('[name="interest_level"]').value;
      
      if (!primarySkill || !biggestChallenge || !interestLevel) {
        this.showError('Please answer all questions');
        return false;
      }
      
      this.formData.primarySkill = primarySkill;
      this.formData.biggestChallenge = biggestChallenge;
      this.formData.interestLevel = interestLevel;
    }
    
    return true;
  }

  async submitForm() {
    if (!this.validateCurrentStep()) return;
    
    if (!this.isBackendAvailable) {
      console.log('Demo mode: Form data would be:', this.formData);
      this.currentStep = 3;
      this.showStep(3);
      this.celebrateSignup();
      return;
    }
    
    try {
      const response = await fetch('http://localhost:3001/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.formData)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        this.currentStep = 3;
        this.showStep(3);
        this.celebrateSignup();
        
        // Refresh counter after successful submission
        setTimeout(() => {
          this.loadDynamicData();
        }, 500);
      } else if (response.status === 409) {
        this.showError('This email is already registered! You\'re already on our waitlist. 🎉');
      } else {
        this.showError(result.error || 'Something went wrong');
      }
    } catch (error) {
      this.showError('Network error. Please try again.');
    }
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  showError(message) {
    // Create and show error toast
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  celebrateSignup() {
    // Add celebration animation
    const celebration = document.createElement('div');
    celebration.className = 'celebration-animation';
    document.body.appendChild(celebration);
    
    setTimeout(() => {
      celebration.remove();
    }, 2000);
  }

  setupEventListeners() {
    // Global functions for form navigation
    window.nextStep = () => this.nextStep();
    window.prevStep = () => this.prevStep();
    window.submitForm = () => this.submitForm();
  }
}

// Initialize the waitlist system
document.addEventListener('DOMContentLoaded', () => {
  new ZintleWaitlist();
});

// Floating navbar on scroll (desktop only)
let lastScrollY = 0;
const navbar = document.querySelector('.nav');

function handleNavbarScroll() {
  const currentScrollY = window.scrollY;
  
  // Only apply floating effect on desktop
  if (window.innerWidth > 768) {
    if (currentScrollY > 100) {
      navbar.classList.add('floating');
    } else {
      navbar.classList.remove('floating');
    }
  } else {
    // Remove floating class on mobile
    navbar.classList.remove('floating');
  }
  
  lastScrollY = currentScrollY;
}

// Back to top functionality
function createBackToTopButton() {
  const backToTop = document.createElement('button');
  backToTop.className = 'back-to-top';
  backToTop.innerHTML = '<i data-lucide="arrow-up"></i>';
  backToTop.setAttribute('aria-label', 'Back to top');
  
  document.body.appendChild(backToTop);
  
  // Initialize icon
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  
  return backToTop;
}

function handleBackToTopScroll(button) {
  if (window.scrollY > 500) {
    button.classList.add('visible');
  } else {
    button.classList.remove('visible');
  }
}

// Initialize back to top button
const backToTopButton = createBackToTopButton();

// Back to top click handler
backToTopButton.addEventListener('click', () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});

// Combined scroll handler
function handleScroll() {
  handleNavbarScroll();
  handleBackToTopScroll(backToTopButton);
}

// Throttled scroll handler for better performance
let ticking = false;

function requestTick() {
  if (!ticking) {
    requestAnimationFrame(() => {
      handleScroll();
      ticking = false;
    });
    ticking = true;
  }
}

window.addEventListener('scroll', requestTick);

// Handle resize to reset navbar on mobile
window.addEventListener('resize', () => {
  if (window.innerWidth <= 768) {
    navbar.classList.remove('floating');
  } else {
    // Recheck scroll position on desktop
    if (window.scrollY > 100) {
      navbar.classList.add('floating');
    }
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Initial check
  handleScroll();
});
