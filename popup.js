import { getApiKey } from "./key.js";
const API_KEY = await getApiKey();

const appStatus = document.getElementById("status");
const commentsContainer = document.getElementById("comments");

const MAX_RESULTS = 15;

let nextPageToken = null;
let isLoading = false;
let currentVideoId = null;

const MAX_COMMENTS_IN_DOM = 30
let commentsEndedWarningDiv = null

const maxAPIcallsPerInstance = 50
let numAPIcallsCurrentInstance = 0
let maxApiCallsReachedDiv = null

function getYouTubeVideoID(url) {
    try {
        const urlObj = new URL(url);

        // Standard watch URL
        if (urlObj.hostname.includes("youtube.com")) {
            const v = urlObj.searchParams.get("v");
            if (v) return v;

            // Shorts URL: /shorts/VIDEO_ID
            if (urlObj.pathname.startsWith("/shorts/")) {
                return urlObj.pathname.split("/shorts/")[1].split("/")[0];
            }

            // Embed URL: /embed/VIDEO_ID
            if (urlObj.pathname.startsWith("/embed/")) {
                return urlObj.pathname.split("/embed/")[1].split("/")[0];
            }
        }

        // Shortened URL: youtu.be/VIDEO_ID
        if (urlObj.hostname.includes("youtu.be")) {
            return urlObj.pathname.slice(1).split("/")[0];
        }

    } catch {
        return null;
    }

    return null;
}

function formatDate(isoString) {
    return new Date(isoString).toISOString().split("T")[0];
}

function trimOldCommentsPreserveScroll() {
    while (commentsContainer.children.length > MAX_COMMENTS_IN_DOM) {
        const first = commentsContainer.firstChild;
        const height = first.offsetHeight;

        commentsContainer.removeChild(first);
        commentsContainer.scrollTop -= height;
    }
}

async function fetchYoutubeComments(videoId, loadMore) {
    if (isLoading) return;
    isLoading = true;

    appStatus.textContent = "Fetching comments...";

    if (!loadMore) {
        commentsContainer.innerHTML = "";
        nextPageToken = null;
    }

    let url =
        `https://www.googleapis.com/youtube/v3/commentThreads` +
        `?part=snippet&videoId=${videoId}&maxResults=${MAX_RESULTS}` +
        `&order=relevance&key=${API_KEY}`;

    if (loadMore && nextPageToken) {
        url += `&pageToken=${nextPageToken}`;
    }

    try {
        if (numAPIcallsCurrentInstance >= maxAPIcallsPerInstance) {
            isLoading = false

            if (maxApiCallsReachedDiv) {return}

            maxApiCallsReachedDiv = document.createElement("div")
            maxApiCallsReachedDiv.innerHTML = `
                <div class="warning">
                    You have exceeded the maximum allowed API calls, Sorry!
                </div>
            `
            commentsContainer.appendChild(maxApiCallsReachedDiv)
            return
        } 
        
        const response = await fetch(url);
        numAPIcallsCurrentInstance += 1

        if (!response.ok) throw new Error("API request failed");

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            if (!loadMore) appStatus.textContent = "No comments found!";
            isLoading = false;
            return;
        }

        appStatus.textContent = "";

        data.items.forEach(item => {
            const comment = item.snippet.topLevelComment.snippet;

            const div = document.createElement("div");
            div.className = "comment";

            div.innerHTML = `
                <div class="comment-header">
                    <img class="profile-image" src="${comment.authorProfileImageUrl}">
                    <a class="profile-link" href="${comment.authorChannelUrl}" target="_blank">
                        <span class="author">${comment.authorDisplayName}</span>
                    </a>
                    <span class="date">- ${formatDate(comment.updatedAt)}</span>
                </div>

                <div class="text">${comment.textDisplay}</div>
                <span class="likes">Likes: ${comment.likeCount}</span>
            `;

            commentsContainer.appendChild(div);
        });
        trimOldCommentsPreserveScroll()
        
        nextPageToken = data.nextPageToken || null;

    } catch (error) {
        appStatus.textContent = "Error fetching comments!";
        console.error(error);
    }

    isLoading = false;
}

document.addEventListener("scroll", () => {
    const nearBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight;

    if (nearBottom && !isLoading) {
        if (nextPageToken) {
            fetchYoutubeComments(currentVideoId, true);

        } else if (!commentsEndedWarningDiv) {
            commentsEndedWarningDiv = document.createElement("div")
            commentsEndedWarningDiv.innerHTML = `
                <div class="warning">
                    Reached the end of the comment section, Sorry!
                </div>
            `
            commentsContainer.appendChild(commentsEndedWarningDiv)
        }
    }
});

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const url = tabs[0]?.url;
    if (!url) {
        appStatus.textContent = "No active tab!";
        return;
    }

    const videoId = getYouTubeVideoID(url);
    if (!videoId) {
        appStatus.textContent = "Not a YouTube video!";
        return;
    }

    currentVideoId = videoId;
    fetchYoutubeComments(videoId, false);
});
