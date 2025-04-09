import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCw8NXuRWBDMwmmPh68IHtax6cZVMY5c0E",
  authDomain: "drawinthebox.firebaseapp.com",
  databaseURL: "https://drawinthebox-default-rtdb.firebaseio.com",
  projectId: "drawinthebox",
  storageBucket: "drawinthebox.firebasestorage.app",
  messagingSenderId: "707976363730",
  appId: "1:707976363730:web:2f01269ceac3b4bb30370b",
  measurementId: "G-GPT3Y4YSWR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
export const storage = getStorage(app);

// Para solucionar problemas de CORS no ambiente de desenvolvimento
// Esta solução depende do arquivo cors.json e do comando:
// gsutil cors set cors.json gs://drawinthebox.firebasestorage.app

// Uncomment this during local development to connect to Functions emulator
// if (window.location.hostname === 'localhost') {
//   connectFunctionsEmulator(functions, 'localhost', 5001);
// }

export default app;
