// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDd2WsNK0uXEpzLKdsCLmTwF05o9MS1spk",
    authDomain: "ecomate-64a5b.firebaseapp.com",
    projectId: "ecomate-64a5b",
    storageBucket: "ecomate-64a5b.appspot.com",
    messagingSenderId: "172694023486",
    appId: "1:172694023486:web:4eb47c9c075fc25cd0106f",
    databaseURL: "https://ecomate-64a5b-default-rtdb.firebaseio.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Global variables
let allReports = [];
let map = null;
let markers = [];

// DOM Elements
const loginModal = document.getElementById('loginModal');
const appContainer = document.getElementById('appContainer');
const loginForm = document.querySelector('.login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const loadingSpinner = document.querySelector('.loading-spinner');

// Show loading spinner
function showLoading() {
    loadingSpinner.style.display = 'flex';
}

// Hide loading spinner
function hideLoading() {
    loadingSpinner.style.display = 'none';
}

// Show error message
function showError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }

    showLoading();
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        hideLoading();
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                showError('Invalid email or password');
                break;
            case 'auth/too-many-requests':
                showError('Too many failed attempts. Please try again later');
                break;
            default:
                showError('An error occurred. Please try again');
        }
    }
}

// Function to format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Function to format time ago
function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60,
        second: 1
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
        }
    }
    return 'just now';
}

// Function to update statistics
function updateStats(reports) {
    const totalReports = reports.length;
    const pendingReports = reports.filter(report => report.status === 'pending').length;
    const resolvedReports = reports.filter(report => report.status === 'resolved').length;

    document.getElementById('totalReports').textContent = totalReports;
    document.getElementById('pendingReports').textContent = pendingReports;
    document.getElementById('resolvedReports').textContent = resolvedReports;
}

// Function to show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Function to get status button content
function getStatusButtonContent(status) {
    return status === 'pending' 
        ? '<i class="fas fa-check-circle"></i> Mark as Resolved'
        : '<i class="fas fa-undo"></i> Mark as Pending';
}

// Function to change report status
async function changeStatus(reportId, currentStatus) {
    const newStatus = currentStatus === 'pending' ? 'resolved' : 'pending';
    const statusBtn = document.querySelector(`[data-report-id="${reportId}"]`);
    
    try {
        statusBtn.disabled = true;
        statusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        await database.ref(`reports/${reportId}`).update({
            status: newStatus
        });
        
        const reportIndex = allReports.findIndex(report => report.id === reportId);
        if (reportIndex !== -1) {
            allReports[reportIndex].status = newStatus;
        }
        
        filterAndSortReports();
        showNotification(`Status updated to ${newStatus}`, 'success');
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Failed to update status', 'error');
        statusBtn.disabled = false;
        statusBtn.innerHTML = getStatusButtonContent(currentStatus);
    }
}

// Function to create a report card
function createReportCard(report) {
    const reportCard = document.createElement('div');
    reportCard.className = 'report-card';

    reportCard.innerHTML = `
        <img src="${report.imageUrl}" alt="Report Image" onerror="this.src='https://via.placeholder.com/300x200?text=Image+Not+Available'">
        <div class="report-info">
            <h3>Report #${report.id.substring(0, 8)}</h3>
            <p>${report.description}</p>
            <div class="status-container">
                <span class="report-status status-${report.status}">${report.status.toUpperCase()}</span>
                <button class="status-toggle-btn" data-report-id="${report.id}" onclick="changeStatus('${report.id}', '${report.status}')">
                    ${getStatusButtonContent(report.status)}
                </button>
            </div>
            <div class="location-info">
                <i class="fas fa-map-marker-alt"></i>
                <span class="location-text">
                    ${report.location.latitude.toFixed(6)}, ${report.location.longitude.toFixed(6)}
                </span>
                <button onclick="showOnMap(${report.location.latitude}, ${report.location.longitude}, '${report.description}')" 
                        class="map-button">
                    <i class="fas fa-map"></i> View on Map
                </button>
            </div>
            <div class="timestamp">
                <i class="far fa-clock"></i> ${timeAgo(report.timestamp)}
            </div>
        </div>
    `;

    return reportCard;
}

// Function to initialize OpenStreetMap
function initMap() {
    const defaultLocation = [8.4898, 76.9469];
    map = L.map('map').setView(defaultLocation, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'OpenStreetMap contributors'
    }).addTo(map);

    L.control.scale().addTo(map);
}

// Function to show location on map
function showOnMap(lat, lng, description) {
    const modal = document.getElementById('mapModal');
    modal.style.display = 'block';

    if (!map) {
        initMap();
    } else {
        map.invalidateSize();
    }

    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    const position = [lat, lng];
    map.setView(position, 16);

    const customIcon = L.divIcon({
        className: 'custom-marker',
        html: '<i class="fas fa-map-marker-alt"></i>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });

    const marker = L.marker(position, {
        icon: customIcon,
        title: description
    }).addTo(map);

    marker.bindPopup(`<div class="popup-content"><strong>${description}</strong></div>`).openPopup();
    markers.push(marker);
}

// Function to close map modal
function closeMapModal() {
    const modal = document.getElementById('mapModal');
    modal.style.display = 'none';
    
    if (markers.length > 0) {
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
    }
}

// Function to filter and sort reports
function filterAndSortReports() {
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    let filteredReports = [...allReports];

    if (statusFilter !== 'all') {
        filteredReports = filteredReports.filter(report => report.status === statusFilter);
    }

    if (searchQuery) {
        filteredReports = filteredReports.filter(report => 
            report.description.toLowerCase().includes(searchQuery) ||
            report.id.toLowerCase().includes(searchQuery)
        );
    }

    filteredReports.sort((a, b) => {
        if (sortBy === 'newest') {
            return b.timestamp - a.timestamp;
        } else {
            return a.timestamp - b.timestamp;
        }
    });

    displayReports(filteredReports);
    updateStats(filteredReports);
}

// Function to display reports
function displayReports(reports) {
    const reportsContainer = document.getElementById('reportsContainer');
    reportsContainer.innerHTML = '';
    
    if (reports.length === 0) {
        reportsContainer.innerHTML = '<p class="no-results">No reports found matching your criteria.</p>';
        return;
    }

    reports.forEach(report => {
        const reportCard = createReportCard(report);
        reportsContainer.appendChild(reportCard);
    });
}

// Function to fetch reports
function fetchReports() {
    showLoading();
    const reportsRef = database.ref('reports');
    
    reportsRef.on('value', (snapshot) => {
        hideLoading();
        allReports = [];
        
        snapshot.forEach((reportSnapshot) => {
            const report = reportSnapshot.val();
            allReports.push(report);
        });

        filterAndSortReports();
    }, (error) => {
        console.error("Error fetching reports:", error);
        hideLoading();
        document.getElementById('reportsContainer').innerHTML = 
            '<p class="error-message">Error loading reports. Please try again later.</p>';
    });
}

// Auth state change listener
auth.onAuthStateChanged((user) => {
    hideLoading();
    if (user) {
        loginModal.style.display = 'none';
        appContainer.style.display = 'block';
        loginError.style.display = 'none';
        emailInput.value = '';
        passwordInput.value = '';
        
        // Initialize app when user is logged in
        initializeApp();
    } else {
        loginModal.style.display = 'block';
        appContainer.style.display = 'none';
    }
});

// Function to initialize the app
function initializeApp() {
    // Add event listeners
    document.getElementById('searchInput').addEventListener('input', filterAndSortReports);
    document.getElementById('statusFilter').addEventListener('change', filterAndSortReports);
    document.getElementById('sortBy').addEventListener('change', filterAndSortReports);
    
    // Map modal events
    document.querySelector('.close').addEventListener('click', closeMapModal);
    document.querySelector('.back-button').addEventListener('click', closeMapModal);
    
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('mapModal');
        if (event.target === modal) {
            closeMapModal();
        }
    });
    
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeMapModal();
        }
    });
    
    // Fetch initial data
    fetchReports();
}

// Event listeners
loginBtn.addEventListener('click', handleLogin);

// Sign out function
function signOut() {
    auth.signOut().catch(error => {
        console.error('Error signing out:', error);
        showNotification('Error signing out. Please try again.', 'error');
    });
}

// Add sign out button to header
const headerContent = document.querySelector('.header-content');
const signOutBtn = document.createElement('button');
signOutBtn.className = 'sign-out-btn';
signOutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sign Out';
signOutBtn.onclick = signOut;
headerContent.appendChild(signOutBtn);

// Make functions globally available
window.changeStatus = changeStatus;
window.showOnMap = showOnMap;
window.closeMapModal = closeMapModal;
