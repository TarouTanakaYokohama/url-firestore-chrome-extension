import { db } from '../firebaseConfig';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

// Firestore からドキュメントを取得する関数
const getDocumentsFromFirestore = async (): Promise<{ [key: string]: string[] }> => {
    try {
        const urlsCollectionRef = collection(db, "urls");
        const querySnapshot = await getDocs(urlsCollectionRef);
        const documents: { [key: string]: string[] } = {};

        querySnapshot.forEach(doc => {
            const data = doc.data();
            if (Array.isArray(data.urls)) {
                documents[doc.id] = data.urls;
            }
        });

        console.log('Documents from Firestore:', documents);
        return documents;
    } catch (error) {
        console.error('Error fetching documents from Firestore:', error);
        return {};
    }
};

// Firestore からドキュメントを削除する関数
const deleteDocumentFromFirestore = async (documentId: string) => {
    const documentRef = doc(db, "urls", documentId);
    try {
        await deleteDoc(documentRef);
        console.log(`Document ${documentId} deleted successfully`);
    } catch (error) {
        console.error(`Error deleting document ${documentId}:`, error);
    }
};

// URL を新しいタブで開く関数
const openUrlsInNewTabs = async (urls: string[], documentId: string) => {
    await deleteDocumentFromFirestore(documentId);

    // 全てのURLが開かれるのを待つ
    await Promise.all(urls.map(url => chrome.tabs.create({ url })));
};

// 空のリストメッセージを表示するヘルパー関数
const displayNoItemsMessage = (parentElement: HTMLElement) => {
    const noItemsMessage = document.createElement('li');
    noItemsMessage.textContent = 'アイテムはありません';
    noItemsMessage.className = 'no-item';
    parentElement.appendChild(noItemsMessage);
};

// リストアイテムを作成するヘルパー関数
const createListItem = (
    documentId: string,
    urls: string[],
    urlListElement: HTMLElement
) => {
    const listItem = document.createElement('li');
    listItem.className = 'url-item';

    const urlCount = document.createElement('span');
    urlCount.className = 'url-count';
    urlCount.textContent = `${urls.length}`;

    const urlContent = document.createElement('div');
    urlContent.className = 'url-content';
    urlContent.textContent = documentId;

    listItem.onclick = () => openUrlsInNewTabs(urls, documentId);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'trash';
    deleteButton.onclick = async (event) => {
        event.stopPropagation();
        await deleteDocumentFromFirestore(documentId);
        listItem.remove();

        if (!urlListElement.hasChildNodes()) {
            displayNoItemsMessage(urlListElement);
        }
    };

    listItem.appendChild(urlCount);
    listItem.appendChild(urlContent);
    listItem.appendChild(deleteButton);

    return listItem;
};

// ポップアップの URL リストにドキュメントを追加する関数
const populateUrlList = (documents: { [key: string]: string[] }) => {
    const urlListElement = document.getElementById('url-list');

    if (!urlListElement) {
        console.error('URL list element not found');
        return;
    }

    if (Object.keys(documents).length === 0) {
        displayNoItemsMessage(urlListElement);
        return;
    }

    Object.entries(documents).forEach(([documentId, urls]) => {
        const listItem = createListItem(documentId, urls, urlListElement);
        urlListElement.appendChild(listItem);
    });
};

// ポップアップがロードされたときに呼び出される関数
document.addEventListener('DOMContentLoaded', async () => {
    const documents = await getDocumentsFromFirestore();
    populateUrlList(documents);
});
