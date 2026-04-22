const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, 'src/environments/environment.prod.ts');
let content = fs.readFileSync(envFile, 'utf8');

// Define the mappings from process.env to placeholders
const mappings = {
  'PROD_API_URL': 'https://api.yourdomain.com/api',
  'PROD_HUB_URL': 'https://api.yourdomain.com/hubs/notifications',
  'PROD_GOOGLE_CLIENT_ID': 'PROD_GOOGLE_CLIENT_ID',
  'PROD_FACEBOOK_APP_ID': 'PROD_FACEBOOK_APP_ID',
  'PROD_VAPID_PUBLIC_KEY': 'PROD_VAPID_PUBLIC_KEY',
  'PROD_MAPBOX_ACCESS_TOKEN': 'PROD_MAPBOX_ACCESS_TOKEN'
};

Object.entries(mappings).forEach(([envVar, placeholder]) => {
  const value = process.env[envVar];
  if (value) {
    console.log(`Replacing ${placeholder} with value from ${envVar}`);
    content = content.replace(placeholder, value);
  } else {
    console.warn(`Warning: Environment variable ${envVar} is not set.`);
  }
});

fs.writeFileSync(envFile, content);
console.log('Environment file updated successfully.');
