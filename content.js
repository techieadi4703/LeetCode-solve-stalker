chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "getSlug") {
        const match = window.location.pathname.match(/problems\/([^/]+)/);
        sendResponse({ slug: match ? match[1] : "" });
    }
});
async function getCurrentSlug() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs.length) {
                alert("No active tab found.");
                return resolve("");
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "getSlug" }, (res) => {
                if (chrome.runtime.lastError) {
                    console.error("❌ Could not connect to content script:", chrome.runtime.lastError);
                    alert("Please open a LeetCode problem page before using this.");
                    return resolve("");
                }
                resolve(res?.slug || "");
            });
        });
    });
}

async function fetchAllSubmissions(slug) {
    let submissions = [];
    let offset = 0;
    const limit = 20; // LeetCode's default page size

    while (true) {
        const res = await fetch(`https://leetcode.com/api/submissions/${slug}/?offset=${offset}&limit=${limit}`, {
            credentials: "include"
        });
        const data = await res.json();

        if (!data.submissions_dump || data.submissions_dump.length === 0) {
            break; // no more submissions
        }

        submissions = submissions.concat(data.submissions_dump);
        offset += limit;

        // optional delay to avoid rate limit
        await new Promise(r => setTimeout(r, 500));
    }

    return submissions;
}
