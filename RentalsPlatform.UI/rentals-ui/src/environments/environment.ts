export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  hubUrl: 'http://localhost:5000/hubs/notifications',
  socialAuth: {
    googleClientId: 'YOUR_GOOGLE_CLIENT_ID',
    facebookAppId: 'YOUR_FACEBOOK_APP_ID',
  },
  push: {
    vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY',
  },
  mapbox: {
    accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
  },
};
