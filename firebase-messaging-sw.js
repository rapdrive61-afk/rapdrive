// Vercel Serverless Function: /api/send-push
// Requiere instalar: npm i firebase-admin
// Variables de entorno recomendadas en Vercel:
// FIREBASE_PROJECT_ID=rapdrive
// FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@rapdrive.iam.gserviceaccount.com
// FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

const admin = require('firebase-admin');

function getAdminApp() {
  if (admin.apps.length) return admin.app();

  // Opción 1: service account completo en JSON
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  // Opción 2: variables separadas
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Faltan variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY');
  }
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });
  try {
    getAdminApp();
    const { tokens, title, body, icon, badge, tag, data } = req.body || {};
    const cleanTokens = Array.isArray(tokens) ? tokens.filter(Boolean) : tokens ? [tokens] : [];
    if (!cleanTokens.length) return res.status(400).json({ ok:false, error:'No tokens' });

    const message = {
      tokens: cleanTokens,
      notification: { title: title || 'Rap Drive', body: body || '' },
      webpush: {
        notification: {
          title: title || 'Rap Drive',
          body: body || '',
          icon: icon || '/rapdrive-icon-192.png',
          badge: badge || '/rapdrive-badge-72.png',
          tag: tag || 'rapdrive-push',
          renotify: true,
          vibrate: [180, 80, 180],
        },
        fcmOptions: {
          link: data?.url || '/',
        },
      },
      data: Object.fromEntries(Object.entries(data || {}).map(([k,v]) => [k, String(v ?? '')])),
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    return res.status(200).json({ ok:true, successCount:response.successCount, failureCount:response.failureCount, responses:response.responses });
  } catch (error) {
    console.error('send-push error', error);
    return res.status(500).json({ ok:false, error:error.message });
  }
};
