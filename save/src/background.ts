import { db } from '../firebaseConfig';
import { doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';

// FirestoreにURLを配列フィールドとして保存する関数
const saveUrlsToFirestore = async (domain: string, urls: string[]) => {
    const docRef = doc(db, "urls", domain);

    try {
        // 既存のドキュメントを更新し、URLを配列に追加
        await updateDoc(docRef, {
            urls: arrayUnion(...urls)
        });
        console.log(`URLs successfully saved to Firestore under domain: ${domain}`);
    } catch (error: any) {
        // ドキュメントが存在しない場合、新しいドキュメントを作成してURLを保存
        if (error.code === 'not-found') {
            await setDoc(docRef, {
                urls: urls
            });
            console.log(`Document created and URLs saved under domain: ${domain}`);
        } else {
            console.error('Failed to save URLs to Firestore: ', error);
        }
    }
}

// URLからドメインを取得する関数
const getDomainFromUrl = (url: string): string => {
    const urlObj = new URL(url);
    return urlObj.hostname;
}

// 同じドメインの全てのURLを保存し、タブを閉じる関数
const saveAllUrlsFromDomainAndCloseTabs = async (domain: string) => {
    const urlsToSave: string[] = [];
    chrome.tabs.query({}, async (tabs) => {
        for (const tab of tabs) {
            if (tab.url && !tab.url.startsWith('chrome://') && getDomainFromUrl(tab.url) === domain) {
                urlsToSave.push(tab.url);
                chrome.tabs.remove(tab.id!);  // URLを収集した後にタブを閉じる
            }
        }

        // 収集した全てのURLをFirestoreに保存
        if (urlsToSave.length > 0) {
            await saveUrlsToFirestore(domain, urlsToSave);
        }
    });
}

// 拡張機能のボタンクリックのリスナー
chrome.action.onClicked.addListener((tab) => {
    if (tab && tab.url && !tab.url.startsWith('chrome://')) {
        const domain = getDomainFromUrl(tab.url);
        saveAllUrlsFromDomainAndCloseTabs(domain);
    }
});
