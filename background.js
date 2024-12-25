let tabToFlaggedDomainMap = new Map(); // Maps tab IDs to their corresponding flagged domains
let debounceTimer = null; // Added debounce timer variable to prevent multiple executions

// Monitor URL changes with debounce
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    if (debounceTimer) clearTimeout(debounceTimer); // Clear previous debounce if active
    debounceTimer = setTimeout(() => {
      try {
        checkURL(changeInfo.url, tabId); // Pass tabId to track domains
      } catch (error) {
        console.error(`Error checking URL for tab ${tabId}:`, error);
      }
    }, 300);
  }

  // Check if the tab is fully loaded
  if (changeInfo.status === 'complete') {
    console.log('Tab fully loaded:', tabId);
    try {
      checkURL(tab.url, tabId); // Ensure banner check occurs when the page is completely loaded
    } catch (error) {
      console.error(`Error during tab load check for tab ${tabId}:`, error);
    }
  }
});

// Clear flagged domain for the specific tab when the tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  try {
    if (tabToFlaggedDomainMap.has(tabId)) {
      tabToFlaggedDomainMap.delete(tabId); // Remove the flagged domain for this tab
      console.log(`Tab closed. Reset flagged site for tab: ${tabId}`);
    }
  } catch (error) {
    console.error(`Error clearing flagged domain for tab ${tabId}:`, error);
  }
});

// Check if the URL matches the excluded domains
// Check if the URL matches the excluded domains
function checkURL(url, tabId) {
  console.log("Checking URL:", url);

  if (url.startsWith("chrome://") || url.startsWith("about://")) {
    console.log("Skipping chrome:// or about:// URL:", url);
    return; // Exit the function if the URL is a chrome:// or about:// URL
  }

  // Normalize the URL (remove "http://", "https://", and "www.")
  const normalizedUrl = url.replace(/^https?:\/\/(www\.)?/, '').toLowerCase();
  console.log("Normalized URL:", normalizedUrl); // Add logging for the normalized URL

  // Extract the main domain (e.g., "homeaglow" from "homeaglow.com")
  const strippedDomain = normalizedUrl.split('.')[0];
  console.log("Stripped Domain:", strippedDomain); // Log the stripped domain

  // Check if the URL is from the extension itself and avoid opening a popup
  if (strippedDomain.includes("chrome-extension")) {
    console.log("Skipping banner for extension URL:", url);
    return; // Exit the function if the URL is for the extension itself
  }

  // Track the strippedDomain for this tab
  tabToFlaggedDomainMap.set(tabId, strippedDomain);

  // Check if the domain contains "bbb" or "reddit" and exclude the banner for these
  const excludedDomains = ["bbb", "reddit", "google", "trustpilot"];
  const shouldExclude = excludedDomains.some((excluded) => strippedDomain.includes(excluded));

  if (shouldExclude) {
    console.log("Skipping banner for excluded domain:", strippedDomain);
    return; // Exit the function if the domain contains "bbb" or "reddit"
  }

  // Check if the tab still exists
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || tab.status === "unloaded") {
      console.log(`Tab ${tabId} is no longer available or has been closed.`);
      return; // The tab is unavailable or closed, do not inject the script
    }

    // Display the beige banner for all other sites
    try {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: displayBanner,
        args: [strippedDomain] // Trigger beige banner
      });
    } catch (error) {
      console.error(`Error executing script for tab ${tabId}:`, error);
    }
  });
}


function displayBanner(strippedDomain) {
  console.log(`Displaying banner for domain: ${strippedDomain}`);

  // Remove any existing banner
  const existingBanner = document.getElementById("banner");
  if (existingBanner) existingBanner.remove();

  const banner = document.createElement("div");
  banner.id = "banner";
  banner.style.position = "fixed";
  banner.style.top = "0";
  banner.style.left = "0";
  banner.style.width = "100%";
  banner.style.textAlign = "center";
  banner.style.padding = "5px"; // Reduced padding
  banner.style.fontSize = "14px"; // Reduced font size
  banner.style.zIndex = "999999"; // Ensure banner is on top
  banner.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)"; // Smaller shadow
  banner.style.backgroundColor = "#f5f5dc"; // Beige banner
  banner.style.color = "black";
  banner.style.pointerEvents = "auto"; // Makes the banner clickable

  banner.innerHTML = `
    <button id="close-banner" style="background: transparent; color: black; border: none; font-size: 16px; cursor: pointer; position: absolute; left: 10px; top: 50%; transform: translateY(-50%);">X</button>
    Notice consider verifying <strong>${strippedDomain}</strong>
    <span style="margin-left: 1px;">on: 
        <a id="search-bbb" href="#" style="margin-left: 1px; color: black; text-decoration: underline; cursor: pointer;">BBB.com</a>, 
        <a id="search-reddit" href="#" style="margin-left: 1px; color: black; text-decoration: underline; cursor: pointer;">Reddit.com/rScams</a>, or 
        <a id="search-trustpilot" href="#" style="margin-left: 1px; color: black; text-decoration: underline; cursor: pointer;">Trustpilot</a>
    </span>
  `;

  document.body.appendChild(banner);
  console.log("Banner appended to the DOM.");

  // Push page content down to avoid overlap
  document.body.style.marginTop = "30px"; // Adjust this value as needed based on the banner height

  // Add event listeners
  try {
    document.getElementById("close-banner").addEventListener("click", () => {
      console.log("Banner closed.");
      banner.remove();
      document.body.style.marginTop = "0"; // Reset the margin when the banner is closed
    });

    document.getElementById("search-bbb").addEventListener("click", (e) => {
      e.preventDefault();
      const bbbUrl = `https://www.bbb.org/search?find_text=${strippedDomain}`;
      console.log(`Opening BBB search for: ${strippedDomain}`);
      window.open(bbbUrl, "_blank");
    });

    document.getElementById("search-reddit").addEventListener("click", (e) => {
      e.preventDefault();
      const redditUrl = `https://www.reddit.com/r/Scams/search/?q=${strippedDomain}`;
      console.log(`Opening Reddit search for: ${strippedDomain}`);
      window.open(redditUrl, "_blank");
    });
  
    document.getElementById("search-trustpilot").addEventListener("click", (e) => {
      e.preventDefault();
      const trustpilotUrl = `https://www.trustpilot.com/search?query=${strippedDomain}`;
      console.log(`Opening Trustpilot search for: ${strippedDomain}`);
      window.open(trustpilotUrl, "_blank");
    });
  } catch (error) {
    console.error("Error adding event listeners to banner:", error);
  }
}
