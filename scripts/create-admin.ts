import * as admin from 'firebase-admin';
import * as path from 'path';
import { hashPassword } from '../src/modules/admin/admin-auth.service';

// alternativa ao POST /admin/users. uso: npx ts-node scripts/create-admin.ts <email> <password> [nome]
const [email, password, nome] = process.argv.slice(2);
if (!email || !password || password.length < 12) {
  console.error('Uso: create-admin.ts <email> <password (>=12 chars)> [nome]');
  process.exit(1);
}

const serviceAccount = require(path.join(__dirname, '../.env.json')).serviceAccount;
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  const mail = email.trim().toLowerCase();
  const existing = await db.collection('admin_users').where('email', '==', mail).limit(1).get();
  const data = { email: mail, nome: nome ?? null, password_hash: await hashPassword(password), activo: true };
  if (existing.empty) {
    await db.collection('admin_users').add({ ...data, criado_em: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`Admin criado: ${mail}`);
  } else {
    await existing.docs[0].ref.update(data);
    console.log(`Password actualizada: ${mail}`);
  }
  process.exit(0);
})();
