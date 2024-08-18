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
        // ドキュメントが空の場合、「アイテムがありません」と表示
        if (Object.keys(documents).length === 0) {
            const noItemsMessage = document.createElement('li');
            noItemsMessage.textContent = 'アイテムがありません';
            noItemsMessage.style.textAlign = 'center';
            noItemsMessage.style.padding = '10px';
            urlListElement.appendChild(noItemsMessage);
            return;
        }

        // ドキュメントがある場合の処理
        Object.entries(documents).forEach(([documentId, urls]: [string, string[]]) => {
            const listItem = document.createElement('li');
            listItem.className = 'url-item';

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
                event.stopPropagation(); // 削除ボタンをクリックしてもURLが開かないようにする
                await deleteDocumentFromFirestore(documentId);
                listItem.remove(); // リストから削除

                // すべてのアイテムが削除された場合、「アイテムがありません」を表示
                if (!urlListElement.hasChildNodes()) {
                    const noItemsMessage = document.createElement('li');
                    noItemsMessage.textContent = 'アイテムがありません';
                    noItemsMessage.style.textAlign = 'center';
                    noItemsMessage.style.padding = '10px';
                    urlListElement.appendChild(noItemsMessage);
                }
            };

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
