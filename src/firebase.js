import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSy8dabafv0j-jTnKlUWi_90klMNMhkGgHdM",
  authDomain: "ipl-auction-pro-27e39.firebaseapp.com",
  databaseURL: "https://ipl-auction-pro-27e39-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ipl-auction-pro-27e39",
  storageBucket: "ipl-auction-pro-27e39.firebasestorage.app",
  messagingSenderId: "3753373944608",
  appId: "1:3753373944608:web:90547a1d199ad2774ce945"
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)