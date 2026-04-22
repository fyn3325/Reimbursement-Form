# Firebase Setup (Storage + Realtime Database)

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Enable **Realtime Database** and **Storage** in the project

## 2. Add Web App

1. Project Settings → General → Your apps → Add app → Web
2. Copy the config values into `.env.local`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 3. Security Rules

### Realtime Database

```json
{
  "rules": {
    "claims": {
      ".read": true,
      ".write": true
    }
  }
}
```

For production, add authentication and restrict read/write.

### Storage

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /receipts/{claimId}/{itemId} {
      allow read, write: if true;
    }
  }
}
```

For production, add authentication.

## 4. Fallback

If Firebase env vars are not set, the app uses **localStorage** as fallback. No Firebase config needed for local-only usage.
