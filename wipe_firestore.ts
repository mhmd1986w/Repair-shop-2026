import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, writeBatch } from "firebase/firestore";
import fs from 'fs';

const configString = fs.readFileSync('./firebase-applet-config.json', 'utf8');
const firebaseConfig = JSON.parse(configString);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function wipeDatabase() {
  try {
    console.log('Fetching orders from Firestore...');
    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    console.log(`Found ${ordersSnapshot.size} orders. Wiping...`);
    
    if (ordersSnapshot.size > 0) {
      let batch = writeBatch(db);
      let count = 0;
      for (const docSnap of ordersSnapshot.docs) {
        batch.delete(docSnap.ref);
        count++;
        if (count === 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
    }
    
    console.log('Fetching logs from Firestore...');
    const logsSnapshot = await getDocs(collection(db, 'notification_logs'));
    console.log(`Found ${logsSnapshot.size} logs. Wiping...`);
    
    if (logsSnapshot.size > 0) {
      let batch = writeBatch(db);
      let count = 0;
      for (const docSnap of logsSnapshot.docs) {
        batch.delete(docSnap.ref);
        count++;
        if (count === 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
    }
    
    console.log('Database wiped successfully!');
  } catch (error) {
    console.error('Error wiping database:', error);
  }
  process.exit(0);
}

wipeDatabase();
