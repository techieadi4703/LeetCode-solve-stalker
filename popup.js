async function getCurrentSlug() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) {
        alert("No active tab found.");
        return resolve("");
      }

      const tabUrl = tabs[0].url || "";
      const match = tabUrl.match(/leetcode\.com\/problems\/([^/?#]+)/);
      if (match) {
        return resolve(match[1]);
      }

      chrome.tabs.sendMessage(tabs[0].id, { type: "getSlug" }, (res) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Could not connect to content script:",
            chrome.runtime.lastError.message
          );
          alert("Please open a LeetCode problem page before using this.");
          return resolve("");
        }
        resolve(res?.slug || "");
      });
    });
  });
}

function getTodayStartTimestamp() {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  return Math.floor(todayStart.getTime() / 1000);
}

async function getUserSubmissionStats(username, slug) {
  const query = `
      query recentAcSubmissions($username: String!) {
        recentAcSubmissionList(username: $username) {
          titleSlug
          timestamp
        }
      }
    `;
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { username } }),
    });
    const data = await res.json();
    const submissions = data.data?.recentAcSubmissionList || [];
    const solved = slug
      ? submissions.some((sub) => sub.titleSlug === slug)
      : false;
    const todayStartTimestamp = getTodayStartTimestamp();
    const solvedToday = new Set(
      submissions
        .filter((sub) => parseInt(sub.timestamp, 10) >= todayStartTimestamp)
        .map((sub) => sub.titleSlug)
    );

    return { solved, todayCount: solvedToday.size };
  } catch (err) {
    console.error(`❌ Error checking ${username}:`, err);
    return { solved: false, todayCount: 0 };
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const input = document.getElementById("username");
  const button = document.getElementById("addBtn");
  const list = document.getElementById("userList");
  const slug = await getCurrentSlug();
  chrome.storage.local.get({ users: [] }, (data) => {
    data.users.forEach((user) => addUserToList(user, slug));
  });
  async function addUserToList(user, slug) {
    const li = document.createElement("li");
    li.textContent = `${user} - Checking...`;
    list.appendChild(li);

    if (!slug) {
      const { todayCount } = await getUserSubmissionStats(user, slug);
      li.textContent = `${user} - ⚠️ No problem detected | Today: ${todayCount}`;
      return;
    }

    const { solved, todayCount } = await getUserSubmissionStats(user, slug);
    li.textContent = `${user} - ${solved ? "Solved ✅" : "Not Solved ❌"} | Today: ${todayCount}`;
  }

  function addUser() {
    const username = input.value.trim();
    if (!username) return;

    chrome.storage.local.get({ users: [] }, (data) => {
      const lowerCaseUsers = data.users.map((u) => u.toLowerCase());
      if (lowerCaseUsers.includes(username.toLowerCase())) {
        alert("User already in the list!");
        return;
      }

      const users = [...data.users, username];
      chrome.storage.local.set({ users });
      addUserToList(username, slug);
    });

    input.value = "";
  }

  button.addEventListener("click", addUser);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addUser();
  });
});
