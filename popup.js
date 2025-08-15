async function getCurrentSlug() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) {
        alert("No active tab found.");
        return resolve("");
      }
      chrome.tabs.sendMessage(tabs[0].id, { type: "getSlug" }, (res) => {
        if (chrome.runtime.lastError) {
          console.error(
            "❌ Could not connect to content script:",
            chrome.runtime.lastError
          );
          alert("Please open a LeetCode problem page before using this.");
          return resolve("");
        }
        resolve(res?.slug || "");
      });
    });
  });
}

async function hasUserSolved(username, slug) {
  if (!slug) return false;
  const query = `
      query recentAcSubmissions($username: String!) {
        recentAcSubmissionList(username: $username) {
          titleSlug
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
    return submissions.some((sub) => sub.titleSlug === slug);
  } catch (err) {
    console.error(`❌ Error checking ${username}:`, err);
    return false;
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
      li.textContent = `${user} - ⚠️ No problem detected`;
      return;
    }

    const solved = await hasUserSolved(user, slug);
    li.textContent = `${user} - ${solved ? "Solved ✅" : "Not Solved ❌"}`;
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
