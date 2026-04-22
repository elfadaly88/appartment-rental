# Project Secrets & Configuration

This project uses **Environment-Based Configuration** to keep sensitive data secure and out of version control.

## 1. Backend (.NET 9 API)

### Local Development (User Secrets)
Local secrets are stored using the `dotnet user-secrets` tool. They are stored in your local profile and never committed to Git.

To get started, initialize and set the following keys:

```bash
# 1. Initialize user secrets
dotnet user-secrets init --project RentalsPlatform.Api

# 2. Set required keys
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5444;Database=RentalsDb;Username=...;Password=..."
dotnet user-secrets set "JwtSettings:Key" "YOUR_32_CHARACTER_SECRET_KEY"
dotnet user-secrets set "CloudinarySettings:ApiKey" "..."
dotnet user-secrets set "CloudinarySettings:ApiSecret" "..."
dotnet user-secrets set "Paymob:ApiKey" "..."
dotnet user-secrets set "Paymob:SecretKey" "..."
dotnet user-secrets set "VapidDetails:PrivateKey" "..."
```

### Production (Environment Variables)
On the server, set the following environment variables. Note the double underscore (`__`) for nested sections:

- `ConnectionStrings__DefaultConnection`
- `JwtSettings__Key`
- `CloudinarySettings__ApiKey`
- `CloudinarySettings__ApiSecret`
- `Paymob__ApiKey`
- `Paymob__SecretKey`
- `VapidDetails__PrivateKey`

---

## 2. Frontend (Angular 18)

### Local Development
The project uses `src/environments/environment.development.ts` for local development. This file is ignored by Git.

1. Copy `src/environments/environment.ts` to `src/environments/environment.development.ts`.
2. Replace the `YOUR_...` placeholders with your local development keys.

### Production Build
The production build replaces `environment.ts` with `environment.prod.ts`. 

During CI/CD, the `set-env.js` script runs before `ng build` to inject environment variables into `environment.prod.ts`. Ensure the following variables are set in your CI/CD environment (e.g., GitHub Secrets):

- `PROD_API_URL`
- `PROD_HUB_URL`
- `PROD_GOOGLE_CLIENT_ID`
- `PROD_FACEBOOK_APP_ID`
- `PROD_VAPID_PUBLIC_KEY`
- `PROD_MAPBOX_ACCESS_TOKEN`

---

## Required Keys Checklist
- [ ] **Database**: Connection string to PostgreSQL.
- [ ] **JWT**: A strong secret key (min 32 chars).
- [ ] **Paymob**: API Key, Secret Key, and HMAC Secret.
- [ ] **Cloudinary**: Cloud Name, API Key, and API Secret.
- [ ] **VAPID**: Public and Private keys for Push Notifications.
- [ ] **Social Auth**: Google Client ID and Facebook App ID.
- [ ] **Mapbox**: Access Token for maps.
