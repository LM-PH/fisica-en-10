import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = {
  apiKey: "AIzaSyBeik1EYJYyKuyA6no-40UgwbSs_irjNho",
  authDomain: "fisica-en-10.firebaseapp.com",
  projectId: "fisica-en-10",
  storageBucket: "fisica-en-10.firebasestorage.app",
  messagingSenderId: "283452258990",
  appId: "1:283452258990:web:b5b93604610cd0c85f0b3f",
  measurementId: "G-6RP97Z8CR5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const uploadData = async () => {
    try {
        const rawData = fs.readFileSync('questions.json', 'utf-8');
        const questions = JSON.parse(rawData);
        const colRef = collection(db, 'preguntas');

        for (let i = 0; i < questions.length; i++) {
            const docRef = await addDoc(colRef, questions[i]);
            console.log(`Document written with ID: ${docRef.id}`);
        }
        console.log("All questions uploaded successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Error adding document: ", e);
        process.exit(1);
    }
};

uploadData();
