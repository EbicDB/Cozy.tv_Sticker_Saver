let userStickers;
let oldHref = document.location.href;
const stickerClasses = ["chat_sticker"];
let channelStickersMenu;
let chatInput;
let chatInputPlaceholder;
let userStickersMenu;

window.addEventListener("load", getChatInput);
window.addEventListener("click", pageClicked);

chrome.storage.local.get(["stickers"]).then(loadStickers); //inital load
function loadStickers(result) {
    userStickers = result.stickers ? result.stickers : {};
}

chrome.storage.onChanged.addListener(storageChanged)

function storageChanged(changes, namespace) { //listen for changes on user stickers storage and refresh ui, ensures sticker saves and deletes are reflected in all open cozy tabs 
    if (namespace === "local" && "stickers" in changes) {
        userStickers = changes.stickers.newValue;
        if (document.querySelector(".userStickersMenu")) {
            renderUserStickers();
        }
        channelStickersMenu = document.querySelector("div.grid.h-full.bg-gray-500.p-2.overflow-y-auto.scrollbar-pretty.grid-cols-5.gap-2");
        if (channelStickersMenu) {
            addSaveButtons();
        }
    }
}

function getChatInput() {
    chatInput = document.querySelector("[contenteditable=true]");
    if (!chatInput) {
        setTimeout(getChatInput, 1000); //try again
    }
    else {
        chatInputPlaceholder = chatInput.previousSibling;
    }
}

function pageClicked(e) {
    document.querySelectorAll(".saveStickerButton").forEach((button) => button.remove());  //get rid of existing save sticker buttons
    let clickedElement = e.target;

    if (document.location.href !== oldHref) { //changing to new channel, reload chat input
        setTimeout(getChatInput, 1000);
        if (channelStickersMenu) {
            addSaveButtons();
        }
        oldHref = document.location.href;
    }
    else if (clickedElement.innerText === "saved") { //load user stickers menu
        renderUserStickers();
    }
    else if (stickerClasses.some((className) => clickedElement.classList.contains(className))) { //chat sticker clicked
        chatStickerClicked(clickedElement);
    }
    else { //check if in channel stickers menu
        channelStickersMenu = document.querySelector("div.grid.h-full.bg-gray-500.p-2.overflow-y-auto.scrollbar-pretty.grid-cols-5.gap-2");
        if (channelStickersMenu) { //if yes add save buttons to stickers
            addSaveButtons();
        }
    }
}

function chatStickerClicked(clickedElement) { //chat sticker clicked, display save button
    let imageUrl = clickedElement.style["backgroundImage"];
    imageUrl = imageUrl.slice(imageUrl.indexOf('"') + 1, imageUrl.lastIndexOf('"'));
    let imageCode = imageUrl.slice(imageUrl.lastIndexOf("/") + 1, imageUrl.lastIndexOf(".webp"));

    if (!userStickers[imageCode]) { //only if not already saved
        clickedElement.style.position = "relative";
        let button = document.createElement("div");
        button.classList.add("saveStickerButton");
        button.dataset.url = imageUrl;
        button.dataset.code = imageCode;
        button.innerText = "Save Sticker";
        button.addEventListener("click", saveSticker);

        clickedElement.appendChild(button);
    }
}

function addSaveButtons() { //add save buttons to channel stickers in sticker menu
    document.querySelectorAll(".channelStickerSave").forEach((save) => save.remove()); //get rid of existing save buttons
    channelStickersMenu.childNodes.forEach((sticker) => {
        let imageUrl = sticker.style["backgroundImage"];
        imageUrl = imageUrl.slice(imageUrl.indexOf('"') + 1, imageUrl.lastIndexOf('"'));
        let imageCode = imageUrl.slice(imageUrl.lastIndexOf("/") + 1, imageUrl.lastIndexOf(".webp"));

        if (!userStickers[imageCode]) { //only add save button if sticker not already saved
            sticker.style.position = "relative";

            let stickerSave = document.createElement("div");
            stickerSave.className = "channelStickerSave";
            stickerSave.addEventListener("click", saveSticker);
            stickerSave.dataset.code = imageCode;
            stickerSave.dataset.url = imageUrl;
            stickerSave.innerHTML = "&#128427;";
            sticker.appendChild(stickerSave);
        }
    });
}

function saveSticker(e) { //save sticker to storage
    e.target.remove();
    e.stopPropagation();
    if (!userStickers[e.target.dataset.code]) {
        let dateSaved = Date.now();
        userStickers[e.target.dataset.code] = Object.assign({ dateSaved }, e.target.dataset);
        /* if (document.querySelector(".userStickersMenu")) { //render it if saved menu is open
            renderUserSticker(e.target.dataset.url, e.target.dataset.code);
        } */
        chrome.storage.local.set({ stickers: userStickers }).then(() => {
            //console.log("saved");
        });
    }
}

function deleteUserSticker(e) {
    e.stopPropagation();
    if (userStickers[e.target.dataset.code]) {
        delete userStickers[e.target.dataset.code];
        e.target.parentNode.remove();
        chrome.storage.local.set({ stickers: userStickers }).then(() => {
            //console.log("deleted");
        })
    }
}

function renderUserSticker(url, code) { //render saved sticker, add a delete button
    let sticker = document.createElement("div");
    sticker.classList.add("cursor-pointer", "savedSticker");
    sticker.style.backgroundImage = `url(${url})`;
    sticker.dataset.url = url;
    sticker.dataset.code = code;
    sticker.addEventListener("click", userStickerClicked);

    let stickerDelete = document.createElement("div");
    stickerDelete.className = "savedStickerDelete";
    stickerDelete.addEventListener("click", deleteUserSticker);
    stickerDelete.dataset.code = code;
    stickerDelete.innerHTML = "&#x2716;";
    sticker.appendChild(stickerDelete);

    userStickersMenu.appendChild(sticker);
}

function renderUserStickers() { //loop over saved stickers, render them in save date order
    if (!document.querySelector(".userStickersMenu")) {
        userStickersMenu = document.querySelector(".w-full.flex.justify-center.pt-4.h-full.bg-gray-500");
        userStickersMenu.className = "userStickersMenu";
        userStickersMenu.classList.add("scrollbar-pretty");
    }
    userStickersMenu.innerHTML = "";

    const sortedStickers = Object.values(userStickers).sort((a, b) => a.dateSaved > b.dateSaved ? 1 : -1);

    for (let sticker of sortedStickers) {
        renderUserSticker(sticker.url, sticker.code);
    }
}

function userStickerClicked(e) {
    queueSticker(e.target.dataset.url, e.target.dataset.code);
}

function queueSticker(url, code) { //add a sticker to the chat text box
    let stickerToSend = document.createElement("img");
    stickerToSend.style.userSelect = "none";
    stickerToSend.src = url;
    stickerToSend.dataset.sticker = code;
    chatInput.appendChild(stickerToSend);
    chatInputPlaceholder.classList.add("opacity-0");
    placeCaretAtEnd();
}

function placeCaretAtEnd() { //put cursor after queued sticker
    chatInput.focus();
    if (typeof window.getSelection != "undefined"
        && typeof document.createRange != "undefined") {
        var range = document.createRange();
        range.selectNodeContents(chatInput);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } else if (typeof document.body.createTextRange != "undefined") {
        var textRange = document.body.createTextRange();
        textRange.moveToElementText(chatInput);
        textRange.collapse(false);
        textRange.select();
    }
}
