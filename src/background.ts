import { db } from '../firebaseConfig';
import { doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';

// Function to save URLs to a single Firestore document as an array field
async function saveUrlsToFirestore(domain: string, urls: string[]) {
    const docRef = doc(db, "urls", domain);

    try {
        // Attempt to update the existing document by adding URLs to the array
        await updateDoc(docRef, {
            urls: arrayUnion(...urls)
        });
        console.log(`URLs successfully saved to Firestore under domain: ${domain}`);
    } catch (error: any) {
        // If the document doesn't exist, create a new one with the URLs array
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

// Function to get the domain from a URL
function getDomainFromUrl(url: string): string {
    const urlObj = new URL(url);
    return urlObj.hostname;
}

// Function to save all URLs from the same domain and close their tabs
async function saveAllUrlsFromDomainAndCloseTabs(domain: string) {
    const urlsToSave: string[] = [];
    chrome.tabs.query({}, async (tabs) => {
        for (const tab of tabs) {
            if (tab.url && getDomainFromUrl(tab.url) === domain) {
                urlsToSave.push(tab.url);
                chrome.tabs.remove(tab.id!);  // Close the tab after collecting the URL
            }
        }

        // Save all collected URLs to Firestore
        if (urlsToSave.length > 0) {
            await saveUrlsToFirestore(domain, urlsToSave);
        }
    });
}

// Listener for the extension button click
chrome.action.onClicked.addListener((tab) => {
    if (tab && tab.url) {
        const domain = getDomainFromUrl(tab.url);
        saveAllUrlsFromDomainAndCloseTabs(domain);
    }
});
