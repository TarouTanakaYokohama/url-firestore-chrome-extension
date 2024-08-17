// src/background.ts
import { db } from '../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';

chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id && tab.url) {
        const url = tab.url;
        const tabId = tab.id;

        try {
            // FirestoreにURLを個別のドキュメントとして保存
            const docRef = doc(db, "urls", `${tabId}_${Date.now()}`);
            await setDoc(docRef, { url: url });
            console.log('URL successfully saved to Firestore.');
            chrome.tabs.remove(tabId);
        } catch (error) {
            console.error('Failed to save URL to Firestore: ', error);
        }
    }
});
