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
    document.querySelectorAll(".chatStickerButtons").forEach((button) => button.remove());  //get rid of existing save sticker buttons
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

    let container = document.createElement("div");
    container.classList.add("chatStickerButtons");
    if (!userStickers[imageCode]) { //only if not already saved
        let saveButton = document.createElement("div");
        saveButton.classList.add("saveStickerButton");
        saveButton.dataset.url = imageUrl;
        saveButton.dataset.code = imageCode;
        saveButton.innerText = "Save Sticker";
        saveButton.addEventListener("click", saveStickerChatClicked);

        container.appendChild(saveButton);
    }

    let queueButton = document.createElement("div");
    queueButton.classList.add("saveStickerButton");
    queueButton.dataset.url = imageUrl;
    queueButton.dataset.code = imageCode;
    queueButton.innerText = "Queue";
    queueButton.addEventListener("click", queueStickerFromChat);
    container.appendChild(queueButton);

    clickedElement.style.position = "relative";
    clickedElement.appendChild(container);
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
            stickerSave.addEventListener("click", saveStickerClicked);
            stickerSave.dataset.code = imageCode;
            stickerSave.dataset.url = imageUrl;
            stickerSave.innerHTML = "&#128427;";
            sticker.appendChild(stickerSave);
        }
    });
}

function saveStickerClicked(e) { //save sticker to storage
    e.target.remove();
    e.stopPropagation();
    saveStickerToStorage(e);
}

function saveStickerChatClicked(e) {
    e.target.parentNode.remove();
    e.stopPropagation();
    saveStickerToStorage(e);
}

function saveStickerToStorage(e) {
    if (!userStickers[e.target.dataset.code]) {
        let dateSaved = Date.now();
        userStickers[e.target.dataset.code] = Object.assign({ dateSaved }, e.target.dataset);
        chrome.storage.local.set({ stickers: userStickers }).then(() => {

        });
    }
}

function confirmDeleteSticker(e) {
    e.stopPropagation();
    const code = e.target.dataset.code;
    const url = e.target.dataset.url;

    const confirmBox = document.createElement("div");
    confirmBox.classList.add("deleteConfirmation");

    const heading = document.createElement("h3");
    heading.innerText = "Delete this sticker?";
    confirmBox.appendChild(heading);

    const sticker = document.createElement("div");
    sticker.classList.add("savedSticker");
    sticker.style.backgroundImage = `url(${url})`;
    confirmBox.appendChild(sticker);

    const buttonSpan = document.createElement("span");
    buttonSpan.classList.add("buttonSpan");

    const cancelButton = document.createElement("button");
    cancelButton.classList.add("cancelButton");
    cancelButton.innerText = "Cancel";
    cancelButton.addEventListener("click", cancelDeleteSticker);
    buttonSpan.appendChild(cancelButton);

    const deleteButton = document.createElement("button");
    deleteButton.classList.add("deleteButton");
    deleteButton.innerText = "Delete";
    deleteButton.addEventListener("click", (e) => deleteUserSticker(e, code));
    buttonSpan.appendChild(deleteButton);

    confirmBox.appendChild(buttonSpan);

    userStickersMenu.appendChild(confirmBox);
}

function cancelDeleteSticker(e) {
    e?.stopPropagation();
    document.querySelector(".deleteConfirmation").remove();
}

function deleteUserSticker(e, code) { //delete a sticker from storage
    e.preventDefault();
    cancelDeleteSticker();
    if (userStickers[code]) {
        delete userStickers[code];
        chrome.storage.local.set({ stickers: userStickers }).then(() => {

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
    stickerDelete.addEventListener("click", confirmDeleteSticker);
    stickerDelete.dataset.url = url;
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
    if (!document.contains(chatInput)) {
        getChatInput();
    }
    let stickerToSend = document.createElement("img");
    stickerToSend.style.userSelect = "none";
    stickerToSend.src = url;
    stickerToSend.dataset.sticker = code;
    insertStickerAtCaret(stickerToSend);
}

function queueStickerFromChat(e) {
    e.target.parentNode.remove();
    e.stopPropagation();
    queueSticker(e.target.dataset.url, e.target.dataset.code);
}

function insertStickerAtCaret(sticker) {
    let sel = window.getSelection();
    if (sel?.focusNode == chatInput || sel?.focusNode?.parentNode == chatInput) {
        let range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(sticker);
        range.collapse(false);
        chatInput.focus();
    }
    else { //input not selected so insert at end
        chatInput.focus();
        chatInput.appendChild(sticker);
        let range = document.createRange();
        range.selectNodeContents(chatInput);
        range.collapse(false);
        sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}
