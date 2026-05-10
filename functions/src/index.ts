import * as functions from 'firebase-functions/v2'

// TODO Phase 1 — Cloud Functions implemented per SME spec
// All functions are listed in SME Requirements Document Section 6.3

export const healthCheck = functions.https.onRequest((_req, res) => {
  res.json({ status: 'ok', project: 'pmtool-3f8db', phase: 0 })
})
