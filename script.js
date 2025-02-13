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
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');
const loadingSpinner = document.getElementById('loadingSpinner');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notificationMessage');

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
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 3000);
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
        // Clear the form
        emailInput.value = '';
        passwordInput.value = '';
        errorMessage.style.display = 'none';
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
                console.error('Login error:', error);
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

// Function to add sample data if none exists
async function addSampleData() {
    const snapshot = await database.ref('reports').once('value');
    if (!snapshot.exists()) {
        const sampleReports = [
            {
                id: '1',
                title: 'Illegal Dumping at River Bank',
                description: 'Large amounts of construction waste dumped near the river bank. This needs immediate attention.',
                location: 'Riverside Park',
                status: 'pending',
                timestamp: Date.now(),
                coordinates: {
                    lat: 12.9716,
                    lng: 77.5946
                },
                imageUrl: 'https://images.unsplash.com/photo-1530587191325-3db1d0093e5b'
            },
            {
                id: '2',
                title: 'Air Pollution from Factory',
                description: 'Heavy smoke emission from the industrial area affecting air quality in residential zones.',
                location: 'Industrial District',
                status: 'resolved',
                timestamp: Date.now() - 86400000,
                coordinates: {
                    lat: 12.9516,
                    lng: 77.5846
                },
                imageUrl: 'https://images.unsplash.com/photo-1569097263761-9fa00b5d3b7d'
            },
            {
                id: '3',
                title: 'Water Contamination',
                description: 'Chemical discharge in lake causing water discoloration and affecting aquatic life.',
                location: 'City Lake',
                status: 'pending',
                timestamp: Date.now() - 172800000,
                coordinates: {
                    lat: 12.9616,
                    lng: 77.5746
                },
                imageUrl: 'https://images.unsplash.com/photo-1621451537084-482c73073a0f'
            },
            {
                id: '4',
                title: 'Deforestation Alert',
                description: 'Unauthorized tree cutting observed in protected forest area. Multiple heavy machinery spotted.',
                location: 'Green Forest Zone',
                status: 'pending',
                timestamp: Date.now() - 259200000,
                coordinates: {
                    lat: 12.9816,
                    lng: 77.6046
                },
                imageUrl: 'https://images.unsplash.com/photo-1615411640812-5c2c5ea03c2c'
            },
            {
                id: '5',
                title: 'Plastic Waste on Beach',
                description: 'Large accumulation of plastic waste on the beach shoreline. Marine life at risk.',
                location: 'City Beach',
                status: 'resolved',
                timestamp: Date.now() - 345600000,
                coordinates: {
                    lat: 12.9916,
                    lng: 77.6146
                },
                imageUrl: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8'
            },
            {
                id: '6',
                title: 'Oil Spill in Harbor',
                description: 'Small oil spill detected in the harbor area. Rainbow sheen visible on water surface.',
                location: 'City Harbor',
                status: 'pending',
                timestamp: Date.now() - 432000000,
                coordinates: {
                    lat: 13.0016,
                    lng: 77.6246
                },
                imageUrl: 'https://images.unsplash.com/photo-1612965607446-25e1332775ae'
            },
            {
                id: '7',
                title: 'Noise Pollution',
                description: 'Construction site operating outside permitted hours causing disturbance.',
                location: 'Downtown',
                status: 'resolved',
                timestamp: Date.now() - 518400000,
                coordinates: {
                    lat: 13.0116,
                    lng: 77.6346
                },
                imageUrl: 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982'
            },
            {
                id: '8',
                title: 'Soil Erosion',
                description: 'Severe soil erosion noticed after recent construction activity. Risk to nearby structures.',
                location: 'Hillside Area',
                status: 'pending',
                timestamp: Date.now() - 604800000,
                coordinates: {
                    lat: 13.0216,
                    lng: 77.6446
                },
                imageUrl: 'https://images.unsplash.com/photo-1597495618548-f30d936dc862'
            },
            {
                id: '9',
                title: 'Illegal Mining',
                description: 'Suspected illegal mining activity spotted in protected area during night hours.',
                location: 'Mining District',
                status: 'pending',
                timestamp: Date.now() - 691200000,
                coordinates: {
                    lat: 13.0316,
                    lng: 77.6546
                },
                imageUrl: 'https://images.unsplash.com/photo-1578319439584-104c94d37305'
            }
        ];

        try {
            await database.ref('reports').set(sampleReports);
            console.log('Sample data added successfully');
        } catch (error) {
            console.error('Error adding sample data:', error);
        }
    }
}

// Auth state change listener
auth.onAuthStateChanged((user) => {
    hideLoading();
    if (user) {
        loginModal.style.display = 'none';
        appContainer.style.display = 'block';
        errorMessage.style.display = 'none';
        emailInput.value = '';
        passwordInput.value = '';
        
        // Initialize the app when user is logged in
        initMap();
        addSampleData().then(() => {
            fetchReports();
        });
        
        // Add event listeners for filters
        document.getElementById('searchInput').addEventListener('input', filterAndSortReports);
        document.getElementById('statusFilter').addEventListener('change', filterAndSortReports);
        document.getElementById('sortBy').addEventListener('change', filterAndSortReports);
    } else {
        loginModal.style.display = 'block';
        appContainer.style.display = 'none';
    }
});

// Function to initialize the app
function initializeApp() {
    // Add event listeners
    loginBtn.addEventListener('click', handleLogin);
    
    // Sign out button
    const signOutBtn = document.createElement('button');
    signOutBtn.className = 'sign-out-btn';
    signOutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sign Out';
    signOutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            showNotification('Successfully signed out');
        }).catch((error) => {
            console.error('Sign out error:', error);
            showNotification('Error signing out', 'error');
        });
    });
    
    document.querySelector('.logo-section').appendChild(signOutBtn);
    
    // Close map modal when clicking outside
    const mapModal = document.getElementById('mapModal');
    mapModal.addEventListener('click', (e) => {
        if (e.target === mapModal) {
            closeMapModal();
        }
    });
}

// Initialize the app
initializeApp();
