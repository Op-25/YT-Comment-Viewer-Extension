import { getApiKey } from "./key.js";
const API_KEY = await getApiKey();

const appStatus = document.getElementById("status");
const commentsContainer = document.getElementById("comments");

const MAX_RESULTS = 20;

let nextPageToken = null;
let isLoading = false;
let currentVideoId = null;

let numAPIcallsCurrentInstance = 0
const maxAPIcallsPerInstance = 50

function getYouTubeVideoID(url) {
    try {
        const urlObj = new URL(url);

        if (urlObj.hostname.includes("youtube.com")) {
            return urlObj.searchParams.get("v");
        }

        if (urlObj.hostname.includes("youtu.be")) {
            return urlObj.pathname.slice(1);
        }

        if (urlObj.pathname.includes("/embed/")) {
            return urlObj.pathname.split("/embed/")[1];
        }
    } catch {
        return null;
    }
    return null;
}

function formatDate(isoString) {
    return new Date(isoString).toISOString().split("T")[0];
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
        console.log(numAPIcallsCurrentInstance, maxAPIcallsPerInstance)

        if (numAPIcallsCurrentInstance > maxAPIcallsPerInstance) {
            const warnDiv = document.createElement("div")
            warnDiv.innerHTML = `
                <div class="warning">
                    You have exceeded the maximum allowed API calls. Sorry!
                </div>
            `
            commentsContainer.appendChild(warnDiv)
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

        nextPageToken = data.nextPageToken || null;

    } catch (error) {
        appStatus.textContent = "Error fetching comments!";
        console.error(error);
    }

    isLoading = false;
}

document.addEventListener("scroll", () => {
    const nearBottom =
        window.scrollY + window.innerHeight >= document.body.scrollHeight;

    if (nearBottom && nextPageToken && !isLoading) {
        fetchYoutubeComments(currentVideoId, true);
    }
});

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const url = tabs[0]?.url;
    const videoId = getYouTubeVideoID(url);

    if (!videoId) {
        appStatus.textContent = "Not a YouTube video!";
        return;
    }

    currentVideoId = videoId;
    fetchYoutubeComments(videoId, false);
});
