import { db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";

// FirestoreにURLを配列フィールドとして保存する関数
const saveUrlsToFirestore = async (domain: string, urls: string[]) => {
  const docRef = doc(db, "urls", domain);

  try {
    const docSnapshot = await getDoc(docRef);

    if (docSnapshot.exists()) {
      // 既存のURLリストを取得
      const existingUrls = docSnapshot.data().urls || [];

      // 新しいURLリストを既存のものと比較し、重複していないもののみ追加
      const urlsToSave = urls.filter((url) => !existingUrls.includes(url));

      if (urlsToSave.length > 0) {
        // 新しいURLがあればFirestoreを更新
        await updateDoc(docRef, {
          urls: arrayUnion(...urlsToSave),
        });
        console.log(
          `New URLs successfully saved to Firestore under domain: ${domain}`
        );
      } else {
        console.log("No new URLs to save.");
      }
    } else {
      // ドキュメントが存在しない場合、新しいドキュメントを作成してURLを保存
      await setDoc(docRef, {
        urls: urls,
      });
      console.log(`Document created and URLs saved under domain: ${domain}`);
    }
  } catch (error: any) {
    console.error("Failed to save URLs to Firestore: ", error);
  }
};

// URLからドメインを取得する関数
const getDomainFromUrl = (url: string): string => {
  const urlObj = new URL(url);
  return urlObj.hostname;
};

// 同じドメインの全てのURLを保存し、タブを閉じる関数
// 同じドメインの全てのURLを保存し、タブを閉じる関数
const saveAllUrlsFromDomainAndCloseTabs = async (domain: string) => {
  let urlsToSave: string[] = [];

  // ChromeタブからURLを収集
  chrome.tabs.query({}, async (tabs) => {
    for (const tab of tabs) {
      if (
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        getDomainFromUrl(tab.url) === domain
      ) {
        urlsToSave.push(tab.url);
        chrome.tabs.remove(tab.id!); // URLを収集した後にタブを閉じる
      }
    }

    // 収集したURLの重複を削除
    urlsToSave = [...new Set(urlsToSave)];

    if (urlsToSave.length > 0) {
      // Firestoreからすでに保存されているURLを取得
      const existingUrls = await getUrlsFromFirestore(domain);

      // 既存のURLと重複していないURLのみを保存対象にする
      const newUrls = urlsToSave.filter((url) => !existingUrls.includes(url));

      // 新しいURLが存在する場合のみFirestoreに保存
      if (newUrls.length > 0) {
        await saveUrlsToFirestore(domain, newUrls);
      } else {
        console.log("No new URLs to save.");
      }
    }
  });
};

// Firestoreから既存のURLを取得する関数
const getUrlsFromFirestore = async (domain: string): Promise<string[]> => {
  const docRef = doc(db, "urls", domain);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return snapshot.data()?.urls || [];
  }
  return [];
};

// 拡張機能のボタンクリックのリスナー
chrome.action.onClicked.addListener((tab) => {
  if (tab && tab.url && !tab.url.startsWith("chrome://")) {
    const domain = getDomainFromUrl(tab.url);
    saveAllUrlsFromDomainAndCloseTabs(domain);
  }
});
