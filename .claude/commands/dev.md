# Start Development Server

Start a development server for a specific app.

Usage: /dev [app]

Apps: backend, super-admin, business-app, store-setup, main

$ARGUMENTS: app name (backend, super-admin, business-app, store-setup, main)

---

Start the development server for the specified application:

- backend: `cd Silo-system/backend && npm run dev` (port 9000)
- super-admin: `cd Silo-system/super-admin && npm run dev` (port 3000)
- business-app: `cd Silo-system/business-app && npm start`
- store-setup: `cd Silo-system/store-setup && npm run dev` (port 3001)
- main: `cd Silo-system/Main && npm run dev`
