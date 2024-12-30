/**
 * popup.ts
 *
 * - カテゴリがあるドメイン(YouTubeなど)も、urlsだけのドメイン(非YouTube)も扱います
 * - カテゴリをクリックすると:
 *   1) URLを開く
 *   2) Firestoreからカテゴリ削除
 *   3) UIから該当カテゴリを削除し、もしカテゴリが1つも無くなったらアコーディオンごと消去
 * - ゴミ箱をクリックすると:
 *   1) Firestoreからカテゴリだけ削除(URLは開かない)
 *   2) UIから該当カテゴリを削除し、もしカテゴリが1つも無くなったらアコーディオンごと消去
 */

import { db } from "../firebaseConfig";
import {
    collection,
    getDocs,
    doc,
    deleteDoc,
    setDoc,
} from "firebase/firestore";

/**
 * docDataが { urls: string[] } だけなら => { urls: ... } として返す
 * YouTubeなど { "雑談系": [...], "ゲーム系": [...], ... } なら、そのままオブジェクトにして返す
 */
const parseDocumentToCategoryMap = (
    docData: unknown
): Record<string, string[]> => {
    if (
        typeof docData === "object" &&
        docData !== null &&
        Array.isArray((docData as Record<string, unknown>).urls)
    ) {
        return { urls: (docData as { urls: string[] }).urls };
    }
    // それ以外の場合 => カテゴリごとの配列をまとめる
    const categoryMap: Record<string, string[]> = {};
    if (typeof docData === "object" && docData !== null) {
        for (const key in docData as Record<string, unknown>) {
            const value = (docData as Record<string, unknown>)[key];
            if (Array.isArray(value)) {
                categoryMap[key] = value as string[];
            }
        }
    }
    return categoryMap;
};

/**
 * Firestoreから"urls"コレクションを取得し、{ domainId: { categoryName: string[] } }の形で返す
 */
const getDocumentsFromFirestore = async (): Promise<{
    [domainId: string]: { [categoryName: string]: string[] };
}> => {
    try {
        const urlsCollectionRef = collection(db, "urls");
        const querySnapshot = await getDocs(urlsCollectionRef);

        const documents: {
            [domainId: string]: { [categoryName: string]: string[] };
        } = {};

        querySnapshot.forEach((docSnapshot) => {
            const domainId = docSnapshot.id;
            const data = docSnapshot.data();
            documents[domainId] = parseDocumentToCategoryMap(data);
        });

        return documents;
    } catch (error) {
        console.error("Error fetching documents from Firestore:", error);
        return {};
    }
};

/**
 * ドキュメント(ID=domainId)全体を削除
 */
const deleteEntireDocument = async (domainId: string): Promise<void> => {
    const ref = doc(db, "urls", domainId);
    try {
        await deleteDoc(ref);
        console.log(`Document "${domainId}" deleted successfully`);
    } catch (error) {
        console.error(`Error deleting document "${domainId}":`, error);
    }
};

/**
 * @description カテゴリを1つ削除し、残っていなければドキュメントごと削除。
 * @param domainId Firestore上のドキュメントID(例: "www.youtube.com")
 * @param categoryName 削除したいカテゴリ(例: "雑談系")
 */
const deleteCategoryFromFirestore = async (
    domainId: string,
    categoryName: string
): Promise<void> => {
    try {
        // コレクションを全部読む(最適化したいならgetDoc(docRef)でOK)
        const urlsCollectionRef = collection(db, "urls");
        const querySnapshot = await getDocs(urlsCollectionRef);

        let existingData: Record<string, unknown> | null = null;
        querySnapshot.forEach((snap) => {
            if (snap.id === domainId) {
                existingData = snap.data();
            }
        });
        if (!existingData) {
            console.warn(`Document "${domainId}" does not exist`);
            return;
        }

        // urlsだけしか無い => 丸ごと削除
        if (Array.isArray(existingData["urls"])) {
            await deleteEntireDocument(domainId);
            return;
        }

        // YouTubeなど複数カテゴリがある => 指定されたカテゴリを消す
        if (Object.prototype.hasOwnProperty.call(existingData, categoryName)) {
            delete existingData[categoryName];

            const remainingKeys = Object.keys(existingData);
            if (remainingKeys.length === 0) {
                // 全カテゴリ消した => ドキュメント削除
                await deleteEntireDocument(domainId);
            } else {
                // まだ他カテゴリが残っている => 上書き保存
                const docRef = doc(db, "urls", domainId);
                await setDoc(docRef, existingData);
                console.log(
                    `Category "${categoryName}" removed from doc "${domainId}".`
                );
            }
        }
    } catch (error) {
        console.error(`Error deleting category "${categoryName}":`, error);
    }
};

/**
 * URLを新しいタブで一斉に開く
 */
const openUrlsInNewTabs = async (urls: string[]): Promise<void> => {
    if (!urls || urls.length === 0) {
        console.warn("No URLs to open.");
        return;
    }
    await Promise.all(urls.map((url) => chrome.tabs.create({ url })));
};

/**
 * @description ドメイン(例:www.youtube.com) 1つのアコーディオン要素を作る
 * @returns <div> (中に <h3> (domain名) と <ul><li> (カテゴリ一覧) が入る)
 */
const createDomainAccordionItem = (
    domainId: string,
    categoryMap: { [categoryName: string]: string[] }
): HTMLDivElement => {
    const domainAccordion = document.createElement("div");
    domainAccordion.className = "domain-accordion";

    // domainタイトル
    const domainHeader = document.createElement("h3");
    domainHeader.textContent = domainId;
    domainAccordion.appendChild(domainHeader);

    // カテゴリ一覧
    const categoryList = document.createElement("ul");

    Object.entries(categoryMap).forEach(([categoryName, urls]) => {
        const listItem = document.createElement("li");
        listItem.className = "category-item";

        // カテゴリ名 + 件数
        const categoryTitle = document.createElement("div");
        categoryTitle.className = "category-title";
        categoryTitle.textContent = `${categoryName} (${urls.length})`;

        // カテゴリクリック: URLを開き、Firestore & UIから削除
        categoryTitle.onclick = async (event) => {
            event.stopPropagation();
            // 1) Firestoreからカテゴリを削除
            await deleteCategoryFromFirestore(domainId, categoryName);
            // 2) URLを開く
            await openUrlsInNewTabs(urls);

            // 3) UIからカテゴリ項目を削除
            listItem.remove();

            // 4) この <ul> の中にもう子要素が無ければ => ドメインごとUIから削除
            if (categoryList.childElementCount === 0) {
                domainAccordion.remove();
            }
        };

        // ゴミ箱: カテゴリだけ削除(サイトは開かない)
        const deleteButton = document.createElement("button");
        deleteButton.className = "trash";
        deleteButton.onclick = async (event) => {
            event.stopPropagation();
            // Firestore削除
            await deleteCategoryFromFirestore(domainId, categoryName);
            // UI削除
            listItem.remove();

            // もし子要素が一つも無ければドメインごと削除
            if (categoryList.childElementCount === 0) {
                domainAccordion.remove();
            }
        };

        listItem.appendChild(categoryTitle);
        listItem.appendChild(deleteButton);
        categoryList.appendChild(listItem);
    });

    domainAccordion.appendChild(categoryList);
    return domainAccordion;
};

/**
 * @description getDocumentsFromFirestore()のデータを受け取り、
 * ポップアップの #accordion-container 内にドメインごとにアコーディオンをレンダリング
 */
const populateAccordionList = (documents: {
    [domainId: string]: { [categoryName: string]: string[] };
}): void => {
    const container = document.getElementById("accordion-container");
    if (!container) {
        console.error("accordion-container element not found");
        return;
    }

    // もし取得データが空ならメッセージ
    if (Object.keys(documents).length === 0) {
        const noItemsMessage = document.createElement("p");
        noItemsMessage.textContent = "アイテムはありません";
        container.appendChild(noItemsMessage);
        return;
    }

    // ドメインごとにアコーディオンを作り、配置
    Object.entries(documents).forEach(([domainId, categoryMap]) => {
        const domainAccordion = createDomainAccordionItem(
            domainId,
            categoryMap
        );
        container.appendChild(domainAccordion);
    });
};

/**
 * DOMロード時にFirestoreからデータ取得→アコーディオン描画
 */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const documents = await getDocumentsFromFirestore();
        populateAccordionList(documents);
    } catch (error) {
        console.error("Error in DOMContentLoaded:", error);
    }
});
