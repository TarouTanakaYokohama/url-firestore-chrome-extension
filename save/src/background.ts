/**
 * Firebase設定ファイルからdbインスタンスをインポート
 * db は Firestoreインスタンス
 * @see https://firebase.google.com/docs/firestore/quickstart
 */
import { db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, setDoc, arrayUnion } from "firebase/firestore";

/**
 * 動画カテゴリをEnumで定義
 * 可読性と拡張性を高めるため
 */
enum VideoCategory {
    ENGINEER = "エンジニア系",
    CHAT = "雑談系",
    GAME = "ゲーム系",
    MUSIC = "音楽系",
    REVIEW = "レビュー系",
    OTHERS = "その他",
}

/**
 * Firestore内でカテゴリごとにURLリストを管理するための構造体
 */
interface CategoryMap {
    [VideoCategory.ENGINEER]: string[];
    [VideoCategory.CHAT]: string[];
    [VideoCategory.GAME]: string[];
    [VideoCategory.MUSIC]: string[];
    [VideoCategory.REVIEW]: string[];
    [VideoCategory.OTHERS]: string[];
}

/**
 * Firestoreに保存する際のデータ型
 *  - YouTubeドメインの場合: CategoryMap形式
 *  - 通常ドメインの場合: { urls: string[] }形式
 *
 * Firestoreでドキュメントを部分更新する際に
 * ドット記法キーを許容するためインデックスシグネチャを追加
 */
type DomainDocData = CategoryMap & {
    urls?: string[];
    [key: string]: unknown;
};

/**
 * YouTube動画タイトルからカテゴリを判定する関数
 * @param title - YouTubeタブのタイトル文字列
 * @returns VideoCategory
 * @example
 * const category = classifyYouTubeVideoCategory("Chat Radio Q&A");
 * console.log(category); // VideoCategory.CHAT
 */
const classifyYouTubeVideoCategory = (title: string): VideoCategory => {
    // 大文字小文字を区別しないため、小文字に変換して判定する
    const lowerTitle = title.toLowerCase();

    // キーワードごとにカテゴリを振り分け
    if (
        lowerTitle.includes("プログラ") ||
        lowerTitle.includes("web") ||
        lowerTitle.includes("ロードマップ") ||
        lowerTitle.includes("本") ||
        lowerTitle.includes("react") ||
        lowerTitle.includes("next") ||
        lowerTitle.includes("app")
    ) {
        return VideoCategory.ENGINEER;
    } else if (
        lowerTitle.includes("雑談") ||
        lowerTitle.includes("話") ||
        lowerTitle.includes("語") ||
        lowerTitle.includes("爆笑") ||
        lowerTitle.includes("予想") ||
        lowerTitle.includes("ラジオ") ||
        lowerTitle.includes("radio") ||
        lowerTitle.includes("振り返") ||
        lowerTitle.includes("質問")
    ) {
        return VideoCategory.CHAT;
    } else if (
        lowerTitle.includes("game") ||
        lowerTitle.includes("ゲーム") ||
        lowerTitle.includes("耐久")
    ) {
        return VideoCategory.GAME;
    } else if (
        lowerTitle.includes("song") ||
        lowerTitle.includes("music") ||
        lowerTitle.includes("ミュージック") ||
        lowerTitle.includes("カラオケ") ||
        lowerTitle.includes("karaoke") ||
        lowerTitle.includes("歌")
    ) {
        return VideoCategory.MUSIC;
    } else if (
        lowerTitle.includes("review") ||
        lowerTitle.includes("買") ||
        lowerTitle.includes("使") ||
        lowerTitle.includes("バイ") ||
        lowerTitle.includes("活用") ||
        lowerTitle.includes("ランキング") ||
        lowerTitle.includes("レビュー")
    ) {
        return VideoCategory.REVIEW;
    } else {
        return VideoCategory.OTHERS;
    }
};

/**
 * FirestoreにYouTubeのURLをカテゴリ別に保存する関数
 *  - ドメインごとのドキュメントに { [category]: string[] } の形式で保存する
 * @param domain - ドメイン名 (例: "www.youtube.com")
 * @param categoryMap - カテゴリをキー、URL配列を値とするオブジェクト
 * @example
 * await saveCategorizedUrlsToFirestore("www.youtube.com", { ... });
 */
const saveCategorizedUrlsToFirestore = async (
    domain: string,
    categoryMap: CategoryMap
): Promise<void> => {
    const docRef = doc(db, "urls", domain);

    try {
        const docSnapshot = await getDoc(docRef);

        // ドキュメントが存在しない場合
        // 空のカテゴリはFirestoreに保存しないようにする
        if (!docSnapshot.exists()) {
            const initialData: Partial<CategoryMap> = {};
            (Object.keys(categoryMap) as Array<keyof CategoryMap>).forEach(
                (key) => {
                    // 配列が空でなければ、initialDataにコピー
                    if (categoryMap[key].length > 0) {
                        initialData[key] = categoryMap[key];
                    }
                }
            );

            // 登録すべきデータがあれば新規作成する
            if (Object.keys(initialData).length > 0) {
                await setDoc(docRef, initialData);
                console.log(
                    `Firestoreに新規ドキュメントを作成しました: ${domain}`
                );
            } else {
                console.log("Firestoreに保存すべきデータがありませんでした。");
            }
            return;
        }

        // 既に存在するドキュメントの場合、既存データを取得
        const existingData = docSnapshot.data() as DomainDocData;
        const updatedData: DomainDocData = { ...existingData };

        // カテゴリごとにURLをチェックし、新しいものだけを追加
        (Object.keys(categoryMap) as Array<keyof CategoryMap>).forEach(
            (key) => {
                const currentUrls = existingData[key] || [];
                const newUrls = categoryMap[key].filter(
                    (url) => !currentUrls.includes(url)
                );
                // 新規URLがある場合のみ配列に追加
                if (newUrls.length > 0) {
                    updatedData[key] = [...currentUrls, ...newUrls];
                }
            }
        );

        // 更新対象データだけをupdateDocで部分的に更新
        await updateDoc(docRef, updatedData);
        console.log(
            `YouTubeのURLをカテゴリ別にFirestoreに保存しました: ${domain}`
        );
    } catch (error: unknown) {
        console.error("YouTubeカテゴリ別URLの保存に失敗しました:", error);
    }
};

/**
 * YouTube以外のドメイン用にURLを配列としてFirestoreに保存する関数
 *  - ドキュメント形式 { urls: string[] }
 * @param domain - ドメイン名
 * @param urls - 保存したいURL配列
 */
const saveUrlsToFirestore = async (
    domain: string,
    urls: string[]
): Promise<void> => {
    const docRef = doc(db, "urls", domain);

    try {
        const docSnapshot = await getDoc(docRef);

        // ドキュメントがすでに存在する場合は既存データを取得して重複を排除
        if (docSnapshot.exists()) {
            const existingUrls: string[] = docSnapshot.data().urls || [];
            // 重複しないURLだけを抽出
            const urlsToSave = urls.filter(
                (url) => !existingUrls.includes(url)
            );

            if (urlsToSave.length > 0) {
                await updateDoc(docRef, {
                    urls: arrayUnion(...urlsToSave),
                });
                console.log(`Firestoreに新しいURLを追加しました: ${domain}`);
            } else {
                console.log("追加できる新しいURLはありませんでした。");
            }
        } else {
            // ドキュメントが存在しない場合は新規作成
            await setDoc(docRef, { urls });
            console.log(
                `新しいドキュメントを作成し、URLを保存しました: ${domain}`
            );
        }
    } catch (error: unknown) {
        console.error("FirestoreへのURL保存に失敗しました:", error);
    }
};

/**
 * 渡されたフルURL文字列からドメイン(ホスト名)を抽出する関数
 * @param url - フルURL
 * @returns hostname (例: "www.youtube.com")
 * @example
 * const domain = getDomainFromUrl("https://www.youtube.com/watch?v=xxx");
 * console.log(domain); // "www.youtube.com"
 */
const getDomainFromUrl = (url: string): string => {
    const urlObj = new URL(url);
    return urlObj.hostname;
};

/**
 * YouTube以外のドメイン用にFirestoreから既存URL配列を取得する関数
 *  - urls フィールドが存在すればそれを返す
 * @param domain - ドメイン名
 * @returns URL配列
 */
const getUrlsFromFirestore = async (domain: string): Promise<string[]> => {
    const docRef = doc(db, "urls", domain);
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
        const data = snapshot.data() as DomainDocData;
        return data.urls || [];
    }
    return [];
};

/**
 * 同じドメインのタブをすべて閉じる前に、URLをFirestoreに保存する関数
 *  - YouTubeドメインの場合はカテゴリ分けして保存
 *  - 通常ドメインの場合は単に配列として保存
 * @param domain - 保存対象のドメイン名
 * @example
 * await saveAllUrlsFromDomainAndCloseTabs("www.youtube.com");
 */
const saveAllUrlsFromDomainAndCloseTabs = async (
    domain: string
): Promise<void> => {
    const isYouTubeDomain = domain.includes("youtube.com");

    // YouTube用のカテゴリマップを初期化
    let categoryMap: CategoryMap = {
        [VideoCategory.ENGINEER]: [],
        [VideoCategory.CHAT]: [],
        [VideoCategory.GAME]: [],
        [VideoCategory.MUSIC]: [],
        [VideoCategory.REVIEW]: [],
        [VideoCategory.OTHERS]: [],
    };

    // 通常ドメイン用のURL一覧
    let urlsToSave: string[] = [];

    // chrome.tabs.query で開いているタブをすべて検索
    chrome.tabs.query({}, async (tabs) => {
        for (const tab of tabs) {
            if (
                tab.url &&
                !tab.url.startsWith("chrome://") &&
                getDomainFromUrl(tab.url) === domain
            ) {
                const title = tab.title ?? "";

                // YouTubeの場合はカテゴリ分け
                if (isYouTubeDomain) {
                    const category = classifyYouTubeVideoCategory(title);
                    categoryMap[category].push(tab.url);
                } else {
                    // 通常ドメインの場合はそのまま配列に追加
                    urlsToSave.push(tab.url);
                }

                // URLを取得したらタブを閉じる
                chrome.tabs.remove(tab.id!);
            }
        }

        // FirestoreにURL情報を保存
        if (isYouTubeDomain) {
            // 重複排除
            (Object.keys(categoryMap) as Array<keyof CategoryMap>).forEach(
                (key) => {
                    categoryMap[key] = Array.from(new Set(categoryMap[key]));
                }
            );

            // YouTube用にカテゴリ分けして保存
            await saveCategorizedUrlsToFirestore(domain, categoryMap);
        } else {
            // 通常ドメインの場合
            urlsToSave = Array.from(new Set(urlsToSave)); // 重複を除去

            if (urlsToSave.length > 0) {
                const existingUrls = await getUrlsFromFirestore(domain);
                const newUrls = urlsToSave.filter(
                    (url) => !existingUrls.includes(url)
                );

                if (newUrls.length > 0) {
                    await saveUrlsToFirestore(domain, newUrls);
                } else {
                    console.log("新規で保存すべきURLはありません。");
                }
            }
        }
    });
};

/**
 * 拡張機能アイコンがクリックされた時のリスナー
 *  - 現在のタブのドメインを取得し、URLをFirestoreに保存してタブを閉じる
 */
chrome.action.onClicked.addListener((tab) => {
    if (
        tab &&
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://")
    ) {
        const domain = getDomainFromUrl(tab.url);
        saveAllUrlsFromDomainAndCloseTabs(domain);
    }
});
