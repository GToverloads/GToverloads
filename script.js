 // Wait for the entire page to load before running any scripts
window.addEventListener('load', () => {

    // Initialize Firebase Services and other constants
    const auth = firebase.auth();
    const db = firebase.firestore();
    const BACKEND_URL = "https://gtoverloads-backend.onrender.com";

    // ======================================================
    // == 1. INTRO & "SHOW ONCE" LOGIC                     ==
    // ======================================================
    const introScreen = document.getElementById('intro-screen');
    const mainContent = document.getElementById('main-content');

    const runIntroAnimation = () => {
        if (mainContent) mainContent.classList.add('revealed');
        setTimeout(() => { if (introScreen) introScreen.classList.add('slide-up'); }, 2500);
        setTimeout(() => { if (introScreen) introScreen.remove(); }, 4000);
        try { sessionStorage.setItem('introShown', 'true'); } catch (e) { console.warn("Session storage is not available."); }
    };

    const skipIntroAnimation = () => {
        if (introScreen) introScreen.remove();
        if (mainContent) mainContent.classList.add('revealed');
    };

    try {
        if (sessionStorage.getItem('introShown')) {
            skipIntroAnimation();
        } else {
            runIntroAnimation();
        }
    } catch (e) {
        console.warn("Session storage is not available, running intro animation by default.");
        runIntroAnimation();
    }

    // ======================================================
    // == 2. SETTINGS PANEL & THEME SWITCHER LOGIC         ==
    // ======================================================
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsOverlay = document.getElementById('settings-overlay');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const colorOptions = document.querySelectorAll('.color-option');
    const body = document.body;

    const openSettings = () => {
        if (settingsPanel) settingsPanel.classList.add('visible');
        if (settingsOverlay) settingsOverlay.classList.add('visible');
    };
    const closeSettings = () => {
        if (settingsPanel) settingsPanel.classList.remove('visible');
        if (settingsOverlay) settingsOverlay.classList.remove('visible');
    };

    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);
    if (settingsOverlay) settingsOverlay.addEventListener('click', closeSettings);

    const applySavedTheme = () => {
        try {
            const savedTheme = localStorage.getItem('theme');
            const savedColor = localStorage.getItem('color');
            if (savedTheme === 'dark' || savedTheme === 'blackish') {
                body.dataset.theme = savedTheme;
                if(darkModeToggle) darkModeToggle.checked = true;
            } else {
                body.dataset.theme = 'light';
                if(darkModeToggle) darkModeToggle.checked = false;
            }
            if (savedColor) body.dataset.color = savedColor;
        } catch (e) { console.warn("Local storage is not available for saving theme."); }
    };

    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', () => {
            try {
                const theme = darkModeToggle.checked ? 'dark' : 'light';
                body.dataset.theme = theme;
                localStorage.setItem('theme', theme);
            } catch (e) { console.warn("Could not save theme preference."); }
        });
    }
    
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            try {
                const newColor = option.dataset.color;
                body.dataset.color = newColor;
                localStorage.setItem('color', newColor);
            } catch (e) { console.warn("Could not save color preference."); }
        });
    });

    applySavedTheme();

    // ======================================================
    // == 3. FIREBASE AUTH & HISTORY LOGIC                 ==
    // ======================================================
    const authContainer = document.getElementById('auth-container');
    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');

    const saveToHistory = (toolName) => {
        const user = auth.currentUser;
        if (user && db) {
            db.collection('users').doc(user.uid).collection('history').add({
                tool: toolName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(error => console.error("Error saving history:", error));
        }
    };

    const fetchHistory = (user) => {
        if (!user || !historyList || !db) return;
        if(historySection) historySection.style.display = 'block';
        if(historyList) historyList.innerHTML = '<p class="history-loading">Loading history...</p>';
        db.collection('users').doc(user.uid).collection('history')
          .orderBy('timestamp', 'desc').limit(5).get()
          .then(querySnapshot => {
              if (querySnapshot.empty) {
                  if(historyList) historyList.innerHTML = '<p>No recent activity found.</p>';
                  return;
              }
              let historyHTML = '';
              querySnapshot.forEach(doc => {
                  const item = doc.data();
                  const date = item.timestamp ? item.timestamp.toDate().toLocaleString() : 'Just now';
                  historyHTML += `<div class="history-item"><p class="history-tool">${item.tool}</p><p class="history-date">${date}</p></div>`;
              });
              if(historyList) historyList.innerHTML = historyHTML;
          }).catch(error => {
              console.error("Error fetching history:", error);
              if(historyList) historyList.innerHTML = '<p>Could not load history.</p>';
          });
    };

    const updateAuthStateUI = (user) => {
        if (!authContainer) return;
        const loggedOutView = document.getElementById('logged-out-view');
        const loggedInView = document.getElementById('logged-in-view');

        if (user) {
            loggedInView.innerHTML = `
                <div class="settings-section">
                    <h3>Welcome, ${user.displayName ? user.displayName.split(' ')[0] : 'User'}!</h3>
                    <div class="user-info">
                        <img src="${user.photoURL || 'https://via.placeholder.com/80'}" alt="User Avatar" class="user-avatar">
                        <p>${user.email}</p>
                    </div>
                    <button id="sign-out-btn" class="auth-btn">Sign Out</button>
                </div>`;
            loggedInView.style.display = 'block';
            if (loggedOutView) loggedOutView.style.display = 'none';
            if (document.getElementById('sign-out-btn')) {
                document.getElementById('sign-out-btn').addEventListener('click', () => auth.signOut());
            }
            fetchHistory(user);
        } else {
            if (loggedInView) loggedInView.style.display = 'none';
            if (loggedOutView) loggedOutView.style.display = 'block';
            if (historySection) historySection.style.display = 'none';
            const googleBtn = document.getElementById('google-signin-btn');
            const emailForm = document.getElementById('email-password-form');
            const forgotPassLink = document.getElementById('forgot-password-link');
            const signupLink = document.getElementById('signup-link');
            if(googleBtn) googleBtn.addEventListener('click', () => {
                const provider = new firebase.auth.GoogleAuthProvider();
                auth.signInWithPopup(provider).catch(error => console.error("Sign-In Error:", error));
            });
            if(emailForm) emailForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('email-input').value;
                const password = document.getElementById('password-input').value;
                const button = document.getElementById('email-signin-btn');
                if (button.textContent === 'Sign In') {
                    auth.signInWithEmailAndPassword(email, password).catch(error => alert(`Error: ${error.message}`));
                } else {
                    auth.createUserWithEmailAndPassword(email, password).catch(error => alert(`Error: ${error.message}`));
                }
            });
            if(forgotPassLink) forgotPassLink.addEventListener('click', (e) => {
                e.preventDefault();
                const email = document.getElementById('email-input').value;
                if (!email) { alert("Please enter your email address first."); return; }
                auth.sendPasswordResetEmail(email).then(() => alert("Password reset email sent!")).catch(error => alert(`Error: ${error.message}`));
            });
            if(signupLink) signupLink.addEventListener('click', (e) => {
                e.preventDefault();
                const isSigningUp = signupLink.textContent.includes('Create');
                const button = document.getElementById('email-signin-btn');
                if (isSigningUp) {
                    button.textContent = 'Sign Up';
                    signupLink.textContent = 'Already have an account? Sign In';
                } else {
                    button.textContent = 'Sign In';
                    signupLink.textContent = 'Create an account';
                }
            });
        }
    };
    
    auth.onAuthStateChanged(updateAuthStateUI);

    // ======================================================
    // == 4. ORBITING MENU & OTHER LOGIC (RESTORED)        ==
    // ======================================================
    const orbitContainer = document.querySelector('.orbit-container');
    if (orbitContainer) {
        const orbitWrapper = orbitContainer.querySelector('.orbit-wrapper');
        const orbitIcons = orbitContainer.querySelectorAll('.orbit-icon');
        const numIcons = orbitIcons.length;

        const placeIconsInOrbit = () => {
            const radius = orbitContainer.offsetWidth / 2;
            const wrapperRotation = getRotationDegrees(orbitWrapper);
            orbitIcons.forEach((icon, index) => {
                const angle = (360 / numIcons) * index;
                const iconRotation = -angle - wrapperRotation;
                icon.style.transform = `rotate(${angle}deg) translate(${radius}px)`;
                const innerIcon = icon.querySelector('i');
                if (innerIcon) {
                    innerIcon.style.transform = `rotate(${iconRotation}deg)`;
                }
            });
        };
        
        function getRotationDegrees(element) {
            if (!element) return 0;
            const st = window.getComputedStyle(element, null);
            const tr = st.getPropertyValue("transform");
            if (tr === 'none') return 0;
            const values = tr.split('(')[1].split(')')[0].split(',');
            const a = values[0];
            const b = values[1];
            return Math.round(Math.atan2(b, a) * (180/Math.PI));
        }

        placeIconsInOrbit();
        setInterval(placeIconsInOrbit, 50);
        window.addEventListener('resize', placeIconsInOrbit);
        
        // Save to history when an orbit icon is clicked
        orbitIcons.forEach(link => {
            link.addEventListener('click', () => {
                const toolName = link.getAttribute('title');
                if (toolName && auth.currentUser) {
                    saveToHistory(toolName);
                }
            });
        });
    }

    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    if (revealElements.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        revealElements.forEach(element => { observer.observe(element); });
    }

    // ======================================================
    // == 5. IMAGE CONVERTER TOOL LOGIC                    ==
    // ======================================================
    const imageInputElement = document.getElementById('image-input');
    const uploadArea = document.querySelector('.upload-area');
    const convertBtn = document.getElementById('convert-btn');
    
    if (uploadArea && imageInputElement && convertBtn) {
        uploadArea.addEventListener('click', () => imageInputElement.click());
        imageInputElement.addEventListener('change', () => {
            const file = imageInputElement.files[0];
            if (file) {
                document.getElementById('preview-area').style.display = 'block';
                document.getElementById('image-preview').src = URL.createObjectURL(file);
                document.getElementById('image-name').textContent = file.name;
                uploadArea.style.display = 'none';
                convertBtn.disabled = false;
            }
        });
        convertBtn.addEventListener('click', () => {
            const file = imageInputElement.files[0];
            const format = document.getElementById('format-select').value;
            const loadingSpinner = document.getElementById('loading-spinner');
            const resultArea = document.getElementById('result-area');
            const downloadLink = document.getElementById('download-link');
            if (!file) { alert("Please select a file first."); return; }
            loadingSpinner.style.display = 'block';
            convertBtn.disabled = true;
            resultArea.style.display = 'none';
            const formData = new FormData();
            formData.append('file', file);
            formData.append('format', format);
            fetch(`${BACKEND_URL}/convert-image`, { method: 'POST', body: formData })
            .then(response => {
                if (!response.ok) { throw new Error(`Server error: ${response.statusText}`); }
                const contentDisposition = response.headers.get('content-disposition');
                let filename = "downloaded_file";
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                    if (filenameMatch && filenameMatch.length > 1) {
                        filename = filenameMatch[1];
                    }
                }
                return response.blob().then(blob => ({ blob, filename }));
            })
            .then(({ blob, filename }) => {
                const url = window.URL.createObjectURL(blob);
                downloadLink.href = url;
                downloadLink.download = filename;
                loadingSpinner.style.display = 'none';
                resultArea.style.display = 'block';
                if (auth.currentUser) {
                    saveToHistory(`Image converted to ${format.toUpperCase()}`);
                }
            })
            .catch(error => {
                console.error("Error:", error);
                alert("An error occurred during conversion. Please make sure the backend server is running.");
                loadingSpinner.style.display = 'none';
                convertBtn.disabled = false;
            });
        });
    }
});
// ======================================================
    // == NEW: IMAGE COMPRESSOR TOOL LOGIC                 ==
    // ======================================================
    const compressBtn = document.getElementById('compress-btn');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');

    if (compressBtn && qualitySlider && qualityValue) {
        // Update the displayed quality value when the slider changes
        qualitySlider.addEventListener('input', () => {
            qualityValue.textContent = qualitySlider.value;
        });

        // The image input logic is the same as the converter
        const imageInputCompress = document.getElementById('image-input');
        const uploadAreaCompress = document.querySelector('.upload-area');
        
        if (uploadAreaCompress && imageInputCompress) {
            uploadAreaCompress.addEventListener('click', () => imageInputCompress.click());
            imageInputCompress.addEventListener('change', () => {
                const file = imageInputCompress.files[0];
                if (file) {
                    document.getElementById('preview-area').style.display = 'block';
                    document.getElementById('image-preview').src = URL.createObjectURL(file);
                    document.getElementById('image-name').textContent = `Original Size: ${(file.size / 1024).toFixed(2)} KB`;
                    uploadAreaCompress.style.display = 'none';
                    compressBtn.disabled = false;
                }
            });
        }

        compressBtn.addEventListener('click', () => {
            const file = imageInputCompress.files[0];
            const quality = qualitySlider.value;
            const loadingSpinner = document.getElementById('loading-spinner');
            const resultArea = document.getElementById('result-area');
            const downloadLink = document.getElementById('download-link');
            const resultStats = document.getElementById('result-stats');

            if (!file) { return; }

            loadingSpinner.style.display = 'block';
            compressBtn.disabled = true;
            resultArea.style.display = 'none';

            const formData = new FormData();
            formData.append('file', file);
            formData.append('quality', quality);

            fetch(`${BACKEND_URL}/compress-image`, {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) { throw new Error('Compression failed on the server.'); }
                const originalSize = file.size;
                const contentDisposition = response.headers.get('content-disposition');
                let filename = "downloaded_file";
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                    if (filenameMatch && filenameMatch.length > 1) { filename = filenameMatch[1]; }
                }
                return response.blob().then(blob => ({ blob, filename, originalSize }));
            })
            .then(({ blob, filename, originalSize }) => {
                const url = window.URL.createObjectURL(blob);
                const newSize = blob.size;
                const reduction = 100 - (newSize / originalSize) * 100;

                downloadLink.href = url;
                downloadLink.download = filename;
                resultStats.textContent = `New Size: ${(newSize / 1024).toFixed(2)} KB | Reduction: ${reduction.toFixed(1)}%`;
                
                loadingSpinner.style.display = 'none';
                resultArea.style.display = 'block';
                compressBtn.disabled = false;

                if (auth.currentUser) {
                    saveToHistory(`Image Compressed`);
                }
            })
            .catch(error => {
                console.error("Error:", error);
                alert("An error occurred during compression.");
                loadingSpinner.style.display = 'none';
                compressBtn.disabled = false;
            });
        });
    }
