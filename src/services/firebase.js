import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAVaQJYZUuQ5pPz9y90Tl5A7KVqqtw78yU",
  authDomain: "analisis-data-942ef.firebaseapp.com",
  projectId: "analisis-data-942ef",
  storageBucket: "analisis-data-942ef.firebasestorage.app",
  messagingSenderId: "297906913618",
  appId: "1:297906913618:web:b3863198c97ae20fe23a8b",
  measurementId: "G-XD8Z2GCH47"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
