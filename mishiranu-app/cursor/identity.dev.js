// Cursor app identity: the simulated viewer for local development. Yours to edit;
// add-app-identity seeds this file once and never rewrites it.
// While neither CURSOR_APP_ID nor VERCEL is set, a request without the identity
// header reads as this viewer (simulated: true, empty token). A published app
// never reads this file. Never write a real person's identity here.

/** @type {import('./identity').DevViewer | null} */
export const DEV_VIEWER = {
  sub: "user:dev",
  email: "dev@example.com",
  name: "Dev Viewer",
  teamId: 1,
  teamRole: "admin",
};
