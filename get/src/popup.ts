import { db } from '../firebaseConfig';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

// Firestore からドキュメントを取得する関数
const getDocumentsFromFirestore = async (): Promise<{ [key: string]: string[] }> => {
    const urlsCollectionRef = collection(db, "urls");
    const querySnapshot = await getDocs(urlsCollectionRef);
    const documents: { [key: string]: string[] } = {};

    querySnapshot.forEach(doc => {
        const data = doc.data();
        if (Array.isArray(data.urls)) {
            documents[doc.id] = data.urls;
        }
    });

    console.log('Documents from Firestore:', documents); // デバッグ用
    return documents;
}

// Firestore からドキュメントを削除する関数
const deleteDocumentFromFirestore = async (documentId: string) => {
    const documentRef = doc(db, "urls", documentId);
    try {
        await deleteDoc(documentRef);
        console.log(`Document ${documentId} deleted successfully`);
    } catch (error) {
        console.error(`Error deleting document ${documentId}:`, error);
    }
}

// ポップアップの URL リストにドキュメントを追加する関数
const populateUrlList = (documents: { [key: string]: string[] }) => {
    const urlListElement = document.getElementById('url-list');
    if (urlListElement) {
        Object.entries(documents).forEach(([domain, urls]: [string, string[]]) => {
            const listItem = document.createElement('li');
            listItem.textContent = domain;
            listItem.className = 'url-item';
            listItem.onclick = () => openUrlsInNewTabs(domain, urls); // ドメインも渡す
            urlListElement.appendChild(listItem);
        });
    } else {
        console.error('URL list element not found');
    }
}

// URL を新しいタブで開く関数
const openUrlsInNewTabs = async (documentId: string, urls: string[]) => {
    urls.forEach(url => {
        chrome.tabs.create({ url });
    });

    // ドキュメントを削除する
    await deleteDocumentFromFirestore(documentId);
}

// ポップアップがロードされたときに呼び出される関数
document.addEventListener('DOMContentLoaded', async () => {
    const documents = await getDocumentsFromFirestore();
    populateUrlList(documents);
});
