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

    console.log('Documents from Firestore:', documents);
    return documents;
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
const openUrlsInNewTabs = (urls: string[]) => {
    urls.forEach(url => {
        chrome.tabs.create({ url });
    });
};

// ポップアップの URL リストにドキュメントを追加する関数
const populateUrlList = (documents: { [key: string]: string[] }) => {
    const urlListElement = document.getElementById('url-list');
    if (urlListElement) {
        if (Object.keys(documents).length === 0) {
            const noItemsMessage = document.createElement('li');
            noItemsMessage.textContent = 'アイテムがありません';
            noItemsMessage.style.textAlign = 'center';
            noItemsMessage.style.padding = '10px';
            urlListElement.appendChild(noItemsMessage);
            return;
        }

        Object.entries(documents).forEach(([documentId, urls]: [string, string[]]) => {
            const listItem = document.createElement('li');
            listItem.className = 'url-item';

            // 配列数の表示
            const urlCount = document.createElement('span');
            urlCount.className = 'url-count';
            urlCount.textContent = `${urls.length}`;

            const urlContent = document.createElement('div');
            urlContent.className = 'url-content';
            urlContent.textContent = documentId;

            // クリックでURLを開く
            listItem.onclick = () => openUrlsInNewTabs(urls);

            // 削除ボタン
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.textContent = '🗑️';
            deleteButton.onclick = async (event) => {
                event.stopPropagation();
                await deleteDocumentFromFirestore(documentId);
                listItem.remove();

                if (!urlListElement.hasChildNodes()) {
                    const noItemsMessage = document.createElement('li');
                    noItemsMessage.textContent = 'アイテムがありません';
                    noItemsMessage.style.textAlign = 'center';
                    noItemsMessage.style.padding = '10px';
                    urlListElement.appendChild(noItemsMessage);
                }
            };

            listItem.appendChild(urlCount);
            listItem.appendChild(urlContent);
            listItem.appendChild(deleteButton);
            urlListElement.appendChild(listItem);
        });
    } else {
        console.error('URL list element not found');
    }
};

// ポップアップがロードされたときに呼び出される関数
document.addEventListener('DOMContentLoaded', async () => {
    const documents = await getDocumentsFromFirestore();
    populateUrlList(documents);
});
