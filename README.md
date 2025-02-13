# EcoMate Reports Dashboard

A web-based dashboard for managing environmental reports with real-time updates, map integration, and status tracking.

## Features

- 🔐 Secure Authentication
- 📊 Real-time Report Updates
- 🗺️ Interactive Map Integration
- 📱 Responsive Design
- 🔍 Search and Filter Reports
- 📊 Status Management
- 📈 Statistics Dashboard

## Technologies Used

- Firebase Authentication
- Firebase Realtime Database
- OpenStreetMap with Leaflet.js
- HTML5, CSS3, JavaScript
- Font Awesome Icons
- Google Fonts (Inter)

## Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/ecomate-reports.git
```

2. Configure Firebase
- Replace the Firebase configuration in `script.js` with your own Firebase project details
- Enable Email/Password authentication in Firebase Console
- Set up Realtime Database rules

3. Run the application
- Open `index.html` in a web browser
- Login with your Firebase credentials

## Firebase Configuration

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    databaseURL: "YOUR_DATABASE_URL"
};
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
